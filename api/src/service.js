const sharp = require('sharp');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('./auth');
const { UUID, MAX_BODY, validatePost } = require('./schema');
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const maxImage = 5 * 1024 * 1024;
const scopeFor = (kind, user) => ({ kind, namespace: kind === 'blog' ? 'blog' : `journal:${user.tid}:${user.oid}`, tid: user?.tid, oid: user?.oid });
const requireUser = user => { if (!user) throw new HttpError(401, 'Sign in to access your private journal.'); };
function requireJournalRole(user) { requireUser(user); if (!user.journalAllowed) throw new HttpError(403, 'Journal access requires an Owner, Wife, or Friend role.'); }
function writable(kind, user) { requireUser(user); if (kind === 'blog' && !user.owner) throw new HttpError(403, 'Only the owner can change blog posts.'); }
function belongs(item, scope) {
  return item && item.namespace === scope.namespace && item.kind === scope.kind && (scope.kind === 'blog' || (item.owner_tid === scope.tid && item.owner_oid === scope.oid));
}
function dto(post) { return { id: post.id, title: post.title, document: post.document, status: post.status, createdAt: post.created_at, updatedAt: post.updated_at, version: post.version }; }
function version(request) {
  const value = request.headers.get('if-match');
  if (!/^"[1-9][0-9]{0,9}"$/.test(value || '')) throw new HttpError(428, 'Reload this entry to obtain its current version.');
  const parsed = Number(value.slice(1, -1));
  if (parsed > 2147483646) throw new HttpError(400, 'Invalid version.');
  return parsed;
}
async function readBytes(request, max) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new HttpError(413, 'Upload or document is too large.');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new HttpError(413, 'Upload or document is too large.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
function imageType(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return 'image/jpeg';
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16)) && bytes.readUInt32LE(4) === bytes.length - 8) return 'image/webp';
  return null;
}
function cursorFor(scope, publicOnly, post) { return Buffer.from(JSON.stringify({ namespace: scope.namespace, publicOnly, date: post.created_at, id: post.id })).toString('base64url'); }
function parseCursor(value, scope, publicOnly) {
  if (value === null) return null;
  try {
    if (!/^[A-Za-z0-9_-]{1,1024}$/.test(value)) throw new Error();
    const c = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (Object.keys(c).length !== 4 || c.namespace !== scope.namespace || c.publicOnly !== publicOnly || !UUID.test(c.id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(c.date) || !Number.isFinite(Date.parse(c.date))) throw new Error();
    return c;
  } catch { throw new HttpError(400, 'Invalid page cursor. Reload the list.'); }
}
function createService({ authenticate, getStore }) {
  return async function handle(request) {
    try {
      // Even public requests reject a supplied malformed/expired token rather than downgrade.
      const user = await authenticate(request.headers.get('x-portfolio-authorization'));
      const parts = new URL(request.url).pathname.replace(/^\/api\//, '').split('/');
      let [resource, kind, id] = parts;
      const media = resource === 'media';
      if (!media) { id = kind; kind = resource; }
      if (!['blog', 'journal'].includes(kind) || parts.length > (media ? 3 : 2) || (id !== undefined && !UUID.test(id))) throw new HttpError(404, 'Content not found.');
      if (kind === 'journal') requireJournalRole(user);
      const scope = scopeFor(kind, user);
      const publicOnly = kind === 'blog' && !user?.owner;
      const method = request.method.toUpperCase();
      if (media) {
        if (method === 'POST' && !id) {
          writable(kind, user);
          const bytes = await readBytes(request, maxImage);
          const mime = imageType(bytes);
          if (!mime || request.headers.get('content-type') !== mime) throw new HttpError(400, 'Choose a JPEG, PNG, or WebP image with matching file type (maximum 5 MB).');
          try {
            const image = sharp(bytes, { failOn: 'error', limitInputPixels: 40000000 });
            const info = await image.metadata();
            if ((info.pages || 1) !== 1 || !['jpeg', 'png', 'webp'].includes(info.format)) throw new Error('Unsupported raster');
            await image.stats(); // Decode pixels, not just a spoofable file header.
          } catch { throw new HttpError(400, 'Choose a valid, static JPEG, PNG, or WebP image (up to 40 million pixels).'); }
          const assetId = randomUUID();
          const asset = { id: assetId, namespace: scope.namespace, kind, owner_tid: user.tid, owner_oid: user.oid, storage_path: `${scope.namespace}/${assetId}`, mime, size: bytes.length };
          await getStore().upload(asset, bytes);
          return { status: 201, headers, jsonBody: { assetId } };
        }
        if (method !== 'GET' || !id) throw new HttpError(405, 'Method not allowed.');
        const store = getStore();
        const asset = await store.getAsset(scope, id);
        if (!belongs(asset, scope)) throw new HttpError(404, 'Image not found.');
        if (kind === 'blog' && !user?.owner && !await store.publicReference(id)) throw new HttpError(404, 'Image not found.');
        if (asset.storage_path !== `${scope.namespace}/${id}` || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mime) || asset.size < 1 || asset.size > maxImage) throw new HttpError(404, 'Image not found.');
        const blob = await store.download(asset);
        return { status: 200, headers: { ...headers, 'Content-Type': asset.mime, 'Content-Length': String(blob.size), 'Content-Disposition': 'inline' }, body: blob.stream() };
      }
      if (method === 'GET') {
        const store = getStore();
        if (id) {
          const post = await store.getPost(scope, id);
          if (!belongs(post, scope) || (publicOnly && post.status !== 'published')) throw new HttpError(404, 'Entry not found.');
          return { status: 200, headers: { ...headers, ETag: `"${post.version}"` }, jsonBody: { ...dto(post), canWrite: kind === 'journal' || !!user?.owner } };
        }
        const url = new URL(request.url);
        const raw = url.searchParams.get('limit') ?? '10';
        if (!/^[1-9][0-9]?$/.test(raw) || Number(raw) > 20) throw new HttpError(400, 'Page size must be between 1 and 20.');
        const limit = Number(raw);
        const cursor = parseCursor(url.searchParams.get('cursor'), scope, publicOnly);
        const rows = await store.list(scope, { limit, cursor, publicOnly });
        // Defend against inconsistent stored owner metadata as well as query filtering.
        const page = rows.slice(0, limit);
        const items = page.filter(post => belongs(post, scope) && (!publicOnly || post.status === 'published')).map(dto);
        return { status: 200, headers, jsonBody: { items, cursor: rows.length > limit ? cursorFor(scope, publicOnly, page[page.length - 1]) : null, canWrite: kind === 'journal' || !!user?.owner } };
      }
      writable(kind, user);
      if (!['POST', 'PUT', 'DELETE'].includes(method) || (method === 'POST' ? !!id : !id)) throw new HttpError(405, 'Method not allowed.');
      const store = getStore();
      let expected = null;
      if (method !== 'POST') {
        expected = version(request);
        const current = await store.getPost(scope, id);
        if (!belongs(current, scope)) throw new HttpError(404, 'Entry not found.');
        if (current.version !== expected) throw new HttpError(412, 'This entry changed. Reload the current version before saving.');
      }
      if (method === 'DELETE') {
        await store.remove(scope, id, expected);
        return { status: 204, headers };
      }
      const bytes = await readBytes(request, MAX_BODY);
      let input;
      try { input = validatePost(JSON.parse(bytes.toString('utf8')), kind); }
      catch { throw new HttpError(400, 'Use a title of 1–200 characters and a supported editor document.'); }
      for (const assetId of input.asset_ids) {
        const asset = await store.getAsset(scope, assetId);
        if (!belongs(asset, scope)) throw new HttpError(400, 'An image reference is not available for this entry.');
      }
      const post = await store.save(scope, { ...input, id: id || randomUUID() }, expected);
      return { status: method === 'POST' ? 201 : 200, headers: { ...headers, ETag: `"${post.version}"` }, jsonBody: dto(post) };
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      return { status, headers, jsonBody: { error: error instanceof HttpError ? error.message : 'Content is temporarily unavailable. Please retry.' } };
    }
  };
}
module.exports = { createService, imageType, readBytes };
