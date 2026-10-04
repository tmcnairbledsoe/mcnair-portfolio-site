const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { createVerifier } = require('../src/auth');
const { createService } = require('../src/service');
const { createStore } = require('../src/store');
const { validateDocument } = require('../src/schema');
const { mockSupabase } = require('./supabase-mock');
const tid = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const idA = 'aaaaaaaa-1111-4111-8111-111111111111', idB = 'bbbbbbbb-1111-4111-8111-111111111111';
const assetA = 'aaaaaaaa-2222-4222-8222-222222222222', assetB = 'bbbbbbbb-2222-4222-8222-222222222222';
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Private notes <script>alert(1)</script>' }] }] };
const imageDoc = id => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { assetId: id, alt: 'A photograph' } }] }] });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC', 'base64');
let jose, keys, verify;
before(async () => {
  jose = await import('jose'); keys = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(keys.publicKey); jwk.kid = 'test'; jwk.alg = 'RS256';
  verify = createVerifier({ tenantId: tid, clientId, keyResolver: jose.createLocalJWKSet({ keys: [jwk] }) });
});
async function token(oid = a, roles = [], changes = {}, key = keys.privateKey) {
  return new jose.SignJWT({ tid, oid, ver: '2.0', scp: 'access_as_user', roles, ...changes })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(changes.iss ?? `https://login.microsoftonline.com/${tid}/v2.0`)
    .setAudience(changes.aud ?? clientId).setIssuedAt().setExpirationTime(changes.exp ?? '5m').sign(key);
}
function fixture() {
  const mock = mockSupabase(); const store = createStore(mock.client, 'portfolio-images');
  const service = createService({ authenticate: verify, getStore: () => store });
  async function call(path, { bearer, method = 'GET', body, match, type } = {}) {
    // Azure's managed proxy owns Authorization, even for anonymous visitors.
    const headers = { Authorization: 'Bearer Azure-platform-routing-token' };
    if (bearer !== undefined) headers['X-Portfolio-Authorization'] = bearer.startsWith('Bearer ') ? bearer : `Bearer ${bearer}`;
    if (match !== undefined) headers['If-Match'] = match;
    if (type) headers['Content-Type'] = type;
    return service(new Request(`https://site.example/api/${path}`, { method, headers, ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }) }));
  }
  function seed(kind, oid, id, status = kind === 'blog' ? 'draft' : 'private', document = doc) {
    const namespace = kind === 'blog' ? 'blog' : `journal:${tid}:${oid}`;
    const post = { id, namespace, kind, owner_tid: tid, owner_oid: oid, title: 'Entry', document, status, asset_ids: validateDocument(document), version: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    mock.tables.posts.push(post); return post;
  }
  function asset(kind, oid, id) {
    const namespace = kind === 'blog' ? 'blog' : `journal:${tid}:${oid}`;
    const row = { id, namespace, kind, owner_tid: tid, owner_oid: oid, storage_path: `${namespace}/${id}`, mime: 'image/png', size: png.length };
    mock.tables.assets.push(row); mock.objects.set(row.storage_path, new Blob([png])); return row;
  }
  return { ...mock, call, seed, asset, store };
}
test('real signed access token validates tenant/issuer/audience/expiry/scope/oid/version; ID/Graph tokens and fake signatures fail', async t => {
  assert.deepEqual(await verify(`Bearer ${await token(a, ['OwnerRole'])}`), { tid, oid: a, owner: true, calendarAllowed: true, journalAllowed: true });
  assert.equal((await verify(`Bearer ${await token(a, ['WifeRole'])}`)).calendarAllowed, true);
  assert.equal((await verify(`Bearer ${await token(a, ['FriendRole'])}`)).calendarAllowed, false);
  for (const changes of [{ aud: 'https://graph.microsoft.com' }, { aud: [clientId, 'other'] }, { iss: 'https://evil.example/v2.0' }, { tid: b }, { exp: Math.floor(Date.now()/1000)-60 }, { scp: undefined }, { scp: 'User.Read' }, { oid: undefined }, { oid: 'user@example.com' }, { ver: '1.0' }, { nbf: Math.floor(Date.now()/1000) + 3600 }]) {
    await t.test(JSON.stringify(changes), async () => assert.rejects(verify(`Bearer ${await token(a, ['OwnerRole'], changes)}`), e => e.status === 401));
  }
  const other = await jose.generateKeyPair('RS256');
  await assert.rejects(verify(`Bearer ${await token(a, ['OwnerRole'], {}, other.privateKey)}`), e => e.status === 401);
  for (const header of ['Bearer fake', 'Basic owner', '', 'Bearer abc.def.ghi']) await assert.rejects(verify(header), e => e.status === 401);
  assert.equal(await verify(null), null);
});
test('public published-only feed excludes all journal metadata/drafts; optional nonOwner sees no drafts; malformed authorization does not downgrade', async () => {
  const f = fixture(); f.seed('blog', a, idA, 'published'); f.seed('blog', a, idB); f.seed('journal', b, b);
  const publicList = await f.call('blog'); assert.equal(publicList.status, 200); assert.equal(publicList.jsonBody.items.length, 1);
  assert.equal(publicList.jsonBody.canWrite, false); assert.ok(!JSON.stringify(publicList.jsonBody).includes('owner_oid'));
  assert.equal((await f.call(`blog/${idB}`)).status, 404);
  assert.equal((await f.call('blog', { bearer: await token(a, ['FriendRole']) })).jsonBody.items.length, 1);
  assert.equal((await f.call('blog', { bearer: 'fake' })).status, 401);
  assert.equal((await f.call('blog', { bearer: await token(a, ['OwnerRole']) })).jsonBody.items.length, 2);
  for (const path of ['journal', `journal/${idA}`, `media/journal/${assetA}`]) assert.equal((await f.call(path)).status, 401);
});
test('A and Owner cannot list/get/edit/delete/reference/view B journals or media; namespace and metadata filters are applied', async () => {
  for (const roles of [['OwnerRole'], ['WifeRole'], ['FriendRole']]) {
    const f = fixture(); const bearer = await token(a, roles); f.seed('journal', a, idA); f.seed('journal', b, idB); f.asset('journal', b, assetB);
    const list = await f.call('journal', { bearer }); assert.equal(list.status, 200); assert.deepEqual(list.jsonBody.items.map(p => p.id), [idA]);
    for (const method of ['GET','PUT','DELETE']) assert.equal((await f.call(`journal/${idB}`, { bearer, method, match: '"1"', ...(method === 'PUT' ? { body: { title: 'Steal', document: doc, status: 'private' } } : {}) })).status, 404);
    assert.equal((await f.call(`media/journal/${assetB}`, { bearer })).status, 404);
    assert.equal((await f.call('journal', { bearer, method: 'POST', body: { title: 'Copy image', document: imageDoc(assetB), status: 'private' } })).status, 400);
    assert.ok(f.calls.some(c => c.field === 'owner_tid' && c.value === tid)); assert.ok(f.calls.some(c => c.field === 'owner_oid' && c.value === a));
    assert.equal(f.tables.posts.find(p => p.id === idB).version, 1);
  }
});

test('no-role and unrecognized-role accounts can read published blogs but cannot access any journal endpoint', async () => {
  for (const roles of [[], ['UnrelatedRole'], ['ownerrole']]) {
    const f = fixture(); const bearer = await token(a, roles);
    f.seed('blog', a, idA, 'published'); f.seed('blog', a, idB);
    const feed = await f.call('blog', { bearer });
    assert.equal(feed.status, 200); assert.deepEqual(feed.jsonBody.items.map(p => p.id), [idA]);
    assert.equal(feed.jsonBody.canWrite, false);
    assert.equal((await f.call(`blog/${idA}`, { bearer })).status, 200);
    const before = f.calls.length;
    for (const [path, method] of [['journal','GET'], ['journal','POST'], [`journal/${idA}`,'GET'], [`journal/${idA}`,'PUT'], [`journal/${idA}`,'DELETE'], ['media/journal','POST'], [`media/journal/${assetA}`,'GET']]) {
      const result = await f.call(path, { bearer, method });
      assert.equal(result.status, 403);
    }
    assert.equal(f.calls.length, before); // Denial occurs before database or storage access.
  }
});

test('publishing an Owner draft makes the post visible to signed-out and no-role readers', async () => {
  const f = fixture(); const bearer = await token(a, ['OwnerRole']);
  const body = { title: 'Public writing', document: doc, status: 'draft' };
  const created = await f.call('blog', { bearer, method: 'POST', body });
  assert.equal(created.status, 201);
  assert.equal((await f.call('blog')).jsonBody.items.length, 0);
  assert.equal((await f.call(`blog/${created.jsonBody.id}`, { bearer, method: 'PUT', match: '"1"', body: { ...body, status: 'published' } })).status, 200);
  for (const reader of [undefined, await token(b, [])]) {
    const feed = await f.call('blog', { bearer: reader });
    assert.equal(feed.status, 200); assert.equal(feed.jsonBody.items[0].id, created.jsonBody.id);
    assert.equal(feed.jsonBody.canWrite, false);
    assert.equal((await f.call(`blog/${created.jsonBody.id}`, { bearer: reader })).status, 200);
  }
});
test('journal permits own CRUD and images for Owner/Wife/Friend; ignores/rejects client identity and never publishes journal', async () => {
  for (const roles of [['OwnerRole'], ['WifeRole'], ['FriendRole']]) {
    const f = fixture(); const bearer = await token(a, roles);
    const upload = await f.call('media/journal', { bearer, method: 'POST', body: png, type: 'image/png' }); assert.equal(upload.status, 201);
    const assetId = upload.jsonBody.assetId; const metadata = f.tables.assets[0]; assert.equal(metadata.namespace, `journal:${tid}:${a}`); assert.equal(metadata.storage_path, `${metadata.namespace}/${assetId}`);
    const body = { title: 'Mine', document: imageDoc(assetId), status: 'private' };
    const create = await f.call('journal', { bearer, method: 'POST', body }); assert.equal(create.status, 201);
    const id = create.jsonBody.id;
    assert.equal((await f.call(`media/journal/${assetId}`, { bearer: await token(b, ['OwnerRole']) })).status, 404);
    assert.equal((await f.call(`media/journal/${assetId}`, { bearer })).status, 200);
    assert.equal((await f.call(`journal/${id}`, { bearer })).headers.ETag, '"1"');
    assert.equal((await f.call(`journal/${id}`, { bearer, method: 'PUT', match: '"1"', body: { ...body, title: 'Updated' } })).jsonBody.version, 2);
    assert.equal((await f.call(`journal/${id}`, { bearer, method: 'PUT', match: '"2"', body: { ...body, status: 'published' } })).status, 400);
    assert.equal((await f.call('journal', { bearer, method: 'POST', body: { ...body, ownerId: b, partitionKey: 'blog' } })).status, 400);
    assert.equal((await f.call(`journal/${id}`, { bearer, method: 'DELETE', match: '"2"' })).status, 204);
    assert.equal((await f.call(`journal/${id}`, { bearer })).status, 404);
  }
});
test('defense in depth rejects corrupt owner metadata in matching namespace, including media and references', async () => {
  const f = fixture(); const bearer = await token(a, ['OwnerRole']);
  f.seed('journal', a, idA).owner_oid = b; f.asset('journal', a, assetA).owner_oid = b;
  assert.equal((await f.call('journal', { bearer })).jsonBody.items.length, 0);
  assert.equal((await f.call(`journal/${idA}`, { bearer })).status, 404);
  assert.equal((await f.call(`media/journal/${assetA}`, { bearer })).status, 404);
  assert.equal((await f.call('journal', { bearer, method: 'POST', body: { title: 'Invalid', document: imageDoc(assetA), status: 'private' } })).status, 400);
});
test('only ACCESS token OwnerRole writes blog; browser principal/roles and forged Owner token confer no access', async () => {
  const f = fixture(); f.seed('blog', a, idA);
  for (const roles of [[], ['WifeRole'], ['FriendRole']]) for (const method of ['POST','PUT','DELETE']) {
    const result = await f.call(method === 'POST' ? 'blog' : `blog/${idA}`, { bearer: await token(a, roles), method, match: '"1"', ...(method !== 'DELETE' ? { body: { title: 'No', document: doc, status: 'published', roles: ['OwnerRole'] } } : {}) }); assert.equal(result.status, 403);
  }
  const service = createService({ authenticate: verify, getStore: () => f.store });
  const principal = Buffer.from(JSON.stringify({ userRoles: ['OwnerRole'] })).toString('base64');
  assert.equal((await service(new Request('https://site/api/blog', { method: 'POST', headers: { 'X-MS-CLIENT-PRINCIPAL': principal }, body: '{}' }))).status, 401);
});
test('blog assets stay private until CURRENT published references; unpublish/delete revokes immediately; journal asset cannot enter blog', async () => {
  const f = fixture(); const bearer = await token(a, ['OwnerRole']);
  f.asset('blog', a, assetA); f.asset('journal', a, assetB);
  assert.equal((await f.call(`media/blog/${assetA}`)).status, 404);
  assert.equal((await f.call(`media/blog/${assetA}`, { bearer: await token(b, ['FriendRole']) })).status, 404);
  assert.equal((await f.call(`media/blog/${assetA}`, { bearer })).status, 200);
  assert.equal((await f.call('blog', { bearer, method: 'POST', body: { title: 'Cross', document: imageDoc(assetB), status: 'published' } })).status, 400);
  const body = { title: 'Post', document: imageDoc(assetA), status: 'draft' };
  const created = await f.call('blog', { bearer, method: 'POST', body }); assert.equal(created.status, 201);
  const path = `blog/${created.jsonBody.id}`;
  assert.equal((await f.call(`media/blog/${assetA}`)).status, 404);
  assert.equal((await f.call(path, { bearer, method: 'PUT', match: '"1"', body: { ...body, status: 'published' } })).status, 200);
  assert.equal((await f.call(`media/blog/${assetA}`)).status, 200);
  await f.call(path, { bearer, method: 'PUT', match: '"2"', body });
  assert.equal((await f.call(`media/blog/${assetA}`)).status, 404);
  await f.call(path, { bearer, method: 'PUT', match: '"3"', body: { ...body, status: 'published' } });
  await f.call(path, { bearer, method: 'DELETE', match: '"4"' });
  assert.equal((await f.call(`media/blog/${assetA}`)).status, 404);
  assert.equal(f.tables.assets.length, 2); // No unrelated asset/post deletion.
});
test('optimistic updates/deletes reject stale and missing versions, including concurrent RPC race', async () => {
  const f = fixture(); const bearer = await token(a, ['FriendRole']); f.seed('journal', a, idA);
  const path = `journal/${idA}`, body = { title: 'Changed', document: doc, status: 'private' };
  assert.equal((await f.call(path, { bearer, method: 'PUT', body })).status, 428);
  assert.equal((await f.call(path, { bearer, method: 'PUT', body, match: '"9"' })).status, 412);
  const results = await Promise.all([f.call(path, { bearer, method: 'PUT', body, match: '"1"' }), f.call(path, { bearer, method: 'PUT', body, match: '"1"' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 412]); assert.equal(f.tables.posts[0].version, 2);
  assert.equal((await f.call(path, { bearer, method: 'DELETE', match: '"1"' })).status, 412); assert.equal(f.tables.posts.length, 1);
});
test('strict schema rejects malicious nodes/attrs/src/links/unknown body fields and bounded depth/size/count', async () => {
  const f = fixture(); const bearer = await token(a, ['FriendRole']);
  const invalid = [
    { type: 'doc', content: [{ type: 'script', content: [] }] },
    { type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil' } }] },
    { type: 'doc', content: [{ type: 'image', attrs: { assetId: assetA, alt: 'x', src: 'https://evil' } }] },
    { type: 'doc', content: [{ type: 'text', text: 'invalid child' }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] },
    { type: 'doc', content: [{ type: 'paragraph', attrs: { style: 'color:red' } }] },
    { type: 'doc', content: Array.from({length: 3001}, () => ({ type: 'paragraph' })) },
  ];
  let nested = { type: 'paragraph' }; for (let i=0;i<22;i++) nested = { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }, nested] }] };
  invalid.push({ type:'doc', content:[nested] });
  for (const document of invalid) assert.equal((await f.call('journal', { bearer, method: 'POST', body: { title: 'Bad', document, status: 'private' } })).status, 400);
  assert.equal((await f.call('journal', { bearer, method:'POST', body:{title:'x'.repeat(201),document:doc,status:'private'} })).status,400);
  assert.equal((await f.call('journal', { bearer, method:'POST', body:{title:'Good',document:doc,status:'private', content:'<img onerror=alert(1)>'} })).status,400);
  assert.equal((await f.call('journal', { bearer, method:'POST', body:Buffer.alloc(200001) })).status,413);
  assert.deepEqual(validateDocument(doc), []); // Text is rendered as escaped React text.
});
test('uploads reject SVG/GIF/HTML, MIME disagreement, oversized bytes, path IDs; headers private no-store/nosniff and safe errors', async () => {
  const f = fixture(); const bearer = await token(a, ['FriendRole']);
  for (const [body,type] of [[Buffer.from('<svg/>'),'image/svg+xml'], [Buffer.from('GIF89a'),'image/gif'], [png,'image/jpeg'], [Buffer.from('<html>'),'image/png'], [Buffer.alloc(5242881),'image/png']]) {
    const result = await f.call('media/journal',{bearer,method:'POST',body,type}); assert.ok([400,413].includes(result.status));
  }
  assert.equal((await f.call('media/journal/not-a-uuid', { bearer })).status,404);
  const response = await f.call('journal',{bearer}); assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(response.headers['X-Content-Type-Options'],'nosniff');
  f.failNext({ code:'QUOTA', message:'SUPABASE_SECRET_KEY=TOPSECRET' });
  const failure = await f.call('journal',{bearer}); assert.equal(failure.status,503); assert.ok(!JSON.stringify(failure).includes('TOPSECRET'));
});
test('pagination bounded, opaque cursor is namespace/visibility scoped and filters date+id without interpolating unvalidated data', async () => {
  const f = fixture(); const bearer = await token(a, ['FriendRole']); f.seed('journal',a,idA); f.seed('journal',a,idB);
  const first = await f.call('journal?limit=1',{bearer}); assert.equal(first.jsonBody.items.length,1); assert.ok(first.jsonBody.cursor);
  const second = await f.call(`journal?limit=1&cursor=${first.jsonBody.cursor}`,{bearer}); assert.equal(second.jsonBody.items.length,1); assert.notEqual(second.jsonBody.items[0].id,first.jsonBody.items[0].id);assert.equal(second.jsonBody.cursor,null);
  assert.equal((await f.call(`journal?cursor=${first.jsonBody.cursor}`,{bearer:await token(b,['FriendRole'])})).status,400);
  assert.equal((await f.call(`blog?cursor=${first.jsonBody.cursor}`)).status,400);
  for (const path of ['journal?limit=21','journal?limit=0','journal?limit=1e2','journal?cursor=evil,sql','journal?cursor='+ 'x'.repeat(1025)]) assert.equal((await f.call(path,{bearer})).status,400);
  assert.ok(f.calls.filter(c => c.limit).every(c => c.limit <= 21));
});

test('real raster decode accepts JPEG/PNG/WebP and rejects corrupt signature-only images', async () => {
  const sharp = require('sharp'); const f = fixture(); const bearer = await token(a, ['FriendRole']);
  for (const format of ['jpeg','png','webp']) {
    const bytes = await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).toFormat(format).toBuffer();
    assert.equal((await f.call('media/journal',{bearer,method:'POST',body:bytes,type:`image/${format}`})).status,201);
  }
  const fakePng = Buffer.alloc(24); png.copy(fakePng,0,0,24);
  for (const [bytes,type] of [[fakePng,'image/png'],[Buffer.from([255,216,255,217]),'image/jpeg']])
    assert.equal((await f.call('media/journal',{bearer,method:'POST',body:bytes,type})).status,400);
});
