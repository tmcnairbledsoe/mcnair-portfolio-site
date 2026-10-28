const { createHash, randomUUID, timingSafeEqual } = require('node:crypto');
const { HttpError } = require('./auth');

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_TEXT = 32000;
const MAX_REQUEST = 40000;
const PAGE = 200;
const BATCH = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set(['queued', 'working', 'waiting', 'answered', 'failed']);

const reply = (status, body) => ({ status, headers, jsonBody: body });

function requireOwner(user) {
  if (!user) throw new HttpError(401, 'Sign in with your Owner account to use Commander.');
  if (!user.owner) throw new HttpError(403, 'Commander is available only to the Owner role.');
}

// Read at most `limit` bytes without trusting the declared content length.
async function readText(request, limit = MAX_REQUEST) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new HttpError(413, 'Message is too large.');
  const type = request.headers.get('content-type') || '';
  if (!/^application\/json\s*(?:;|$)/i.test(type)) throw new HttpError(415, 'Send a JSON body.');
  if (!request.body) throw new HttpError(400, 'A message is required.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Message is too large.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Send a valid JSON message.');
  }
}

function message(input) {
  if (typeof input.text !== 'string' || !input.text.trim()) throw new HttpError(400, 'Type a message first.');
  const text = input.text.trim();
  if (text.length > MAX_TEXT) throw new HttpError(413, 'Keep a message under 32000 characters.');
  return text;
}

function cursor(value) {
  if (value === null || value === '') return 0;
  if (!/^\d{1,18}$/.test(value)) throw new HttpError(400, 'Use a valid message position.');
  return Number(value);
}

function dto(row) {
  return {
    id: row.id, seq: Number(row.seq), role: row.role, body: row.body, state: row.state,
    replyTo: row.reply_to ?? null, createdAt: row.created_at, answeredAt: row.answered_at ?? null,
  };
}

// Upstream errors never reach the browser: only this bounded explanation does.
function failure(error) {
  if (!error) return;
  if (error.code === '23505') return;
  throw new HttpError(503, 'Commander chat storage is unavailable. Please retry later.');
}

function sameSecret(provided, secret) {
  if (typeof provided !== 'string' || provided.length > 512) return false;
  return timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(secret).digest());
}

/**
 * Owner-gated Commander chat plus the private relay the home PC dials out to.
 * Two credentials exist and never mix: an Entra Owner access token for the
 * browser, and a shared relay secret (INFINITY_RELAY_SECRET) for the home PC.
 * The relay always dials out, so the home PC never accepts inbound traffic.
 */
function createInfinityService({ authenticate, getClient, relaySecret = process.env.INFINITY_RELAY_SECRET, now = () => new Date().toISOString() }) {
  const relayConfigured = () => typeof relaySecret === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(relaySecret);

  function requireRelay(request) {
    // A browser cannot hold this secret, and Origin is present on every browser request.
    if (request.headers.get('origin') !== null) throw new HttpError(403, 'Relay requests must not come from a browser.');
    if (!relayConfigured()) throw new HttpError(503, 'The home Commander relay is not configured on this site.');
    if (!sameSecret(request.headers.get('x-infinity-relay'), relaySecret)) throw new HttpError(401, 'A valid relay credential is required.');
  }

  async function owner(request) {
    const user = await authenticate(request.headers.get('x-portfolio-authorization'));
    requireOwner(user);
    return user;
  }

  async function relayState(client) {
    const { data, error } = await client.from('infinity_relay').select('last_seen_at').eq('id', 'owner').maybeSingle();
    failure(error);
    return data?.last_seen_at ?? null;
  }

  async function touch(client) {
    const seen = now();
    const { error } = await client.from('infinity_relay').upsert({ id: 'owner', last_seen_at: seen }, { onConflict: 'id' });
    failure(error);
    return seen;
  }

  return async request => {
    try {
      const path = new URL(request.url).pathname.replace(/\/+$/, '');

      if (path === '/api/infinity/messages' && request.method === 'GET') {
        const user = await owner(request);
        const after = cursor(new URL(request.url).searchParams.get('after'));
        const client = getClient();
        const { data, error } = await client.from('infinity_messages').select('*')
          .eq('owner_oid', user.oid).gt('seq', after).order('seq', { ascending: true }).limit(PAGE);
        failure(error);
        return reply(200, { messages: (data || []).map(dto), relay: { configured: relayConfigured(), lastSeenAt: await relayState(client) }, serverTime: now() });
      }

      if (path === '/api/infinity/messages' && request.method === 'POST') {
        const user = await owner(request);
        const body = await readText(request);
        const text = message(body);
        const clientId = body.clientId === undefined ? null : String(body.clientId);
        if (clientId !== null && !UUID.test(clientId)) throw new HttpError(400, 'Use a valid message id.');
        const client = getClient();
        const row = { id: randomUUID(), owner_tid: user.tid, owner_oid: user.oid, client_id: clientId, role: 'user', body: text, state: 'queued' };
        const { error } = await client.from('infinity_messages').insert(row);
        if (error && error.code !== '23505') failure(error);
        return reply(200, { accepted: true, id: row.id });
      }

      if (path === '/api/infinity/status' && request.method === 'GET') {
        await owner(request);
        const client = getClient();
        return reply(200, { configured: true, relay: { configured: relayConfigured(), lastSeenAt: await relayState(client) }, serverTime: now() });
      }

      if (path === '/api/infinity/relay/inbox' && request.method === 'GET') {
        requireRelay(request);
        const after = cursor(new URL(request.url).searchParams.get('after'));
        const client = getClient();
        const { data, error } = await client.from('infinity_messages').select('*')
          .eq('role', 'user').eq('state', 'queued').gt('seq', after).order('seq', { ascending: true }).limit(BATCH);
        failure(error);
        const seen = await touch(client);
        return reply(200, { messages: (data || []).map(dto), lastSeenAt: seen });
      }

      if (path === '/api/infinity/relay/reply' && request.method === 'POST') {
        requireRelay(request);
        const body = await readText(request);
        if (!UUID.test(String(body.id ?? ''))) throw new HttpError(400, 'A valid message id is required.');
        const state = String(body.state ?? '');
        if (!STATES.has(state) || state === 'queued') throw new HttpError(400, 'Use a valid reply state.');
        const client = getClient();
        const { data: target, error } = await client.from('infinity_messages').select('*').eq('id', body.id).eq('role', 'user').maybeSingle();
        failure(error);
        if (!target) throw new HttpError(404, 'That message is no longer available.');
        if (state !== 'answered') {
          const { error: updated } = await client.from('infinity_messages').update({ state }).eq('id', target.id);
          failure(updated);
          return reply(200, { saved: true });
        }
        const text = message(body);
        const answeredAt = now();
        // The unique reply index makes a retried delivery harmless.
        const { error: inserted } = await client.from('infinity_messages').insert({
          id: randomUUID(), owner_tid: target.owner_tid, owner_oid: target.owner_oid, role: 'assistant',
          body: text, reply_to: target.id, state: 'answered', answered_at: answeredAt,
        });
        if (inserted && inserted.code !== '23505') failure(inserted);
        const { error: updated } = await client.from('infinity_messages').update({ state: 'answered', answered_at: answeredAt }).eq('id', target.id);
        failure(updated);
        return reply(200, { saved: true });
      }

      return reply(404, { error: 'Not found.' });
    } catch (error) {
      if (error instanceof HttpError) return reply(error.status, { error: error.message });
      return reply(503, { error: 'Commander chat is unavailable. Please retry later.' });
    }
  };
}

module.exports = { createInfinityService, MAX_TEXT };
