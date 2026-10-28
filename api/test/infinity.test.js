const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { HttpRequest } = require('@azure/functions');
const { createVerifier } = require('../src/auth');
const { createInfinityService } = require('../src/infinity');
const { mockSupabase } = require('./supabase-mock');

const tid = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secret = 'relay_'.padEnd(48, 'x');
let jose, keys, verifier;

before(async () => {
  jose = await import('jose'); keys = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(keys.publicKey); jwk.kid = 'test';
  verifier = createVerifier({ tenantId: tid, clientId, keyResolver: jose.createLocalJWKSet({ keys: [jwk] }) });
});

async function token(roles = ['OwnerRole'], oid = ownerId) {
  return new jose.SignJWT({ tid, oid, ver: '2.0', scp: 'access_as_user', roles })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setAudience(clientId).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
}

function service(mock, overrides = {}) {
  return createInfinityService({ authenticate: verifier, getClient: () => mock.client, relaySecret: secret, ...overrides });
}

async function call(handler, path, { method = 'GET', bearer, relay, body, origin } = {}) {
  const headers = {};
  if (bearer) headers['X-Portfolio-Authorization'] = `Bearer ${bearer}`;
  if (relay) headers['X-Infinity-Relay'] = relay;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const result = await handler(new HttpRequest({
    url: `https://mcnairscode.com${path}`, method, headers,
    ...(body !== undefined && method !== 'GET' ? { body: { string: typeof body === 'string' ? body : JSON.stringify(body) } } : {}),
  }));
  return { status: result.status, headers: result.headers, body: result.jsonBody ?? (result.body ? JSON.parse(result.body) : null) };
}

test('Commander chat is invisible and unusable without the Owner role', async () => {
  const mock = mockSupabase(); const handler = service(mock);
  assert.equal((await call(handler, '/api/infinity/messages')).status, 401);
  assert.equal((await call(handler, '/api/infinity/status')).status, 401);
  for (const roles of [['WifeRole'], ['FriendRole'], ['ownerrole'], []]) {
    const bearer = await token(roles);
    assert.equal((await call(handler, '/api/infinity/messages', { bearer })).status, 403);
    assert.equal((await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'hello' } })).status, 403);
  }
  const owner = await token();
  assert.equal((await call(handler, '/api/infinity/messages', { bearer: owner })).status, 200);
  assert.equal(mock.tables.infinity_messages.length, 0);
});

test('owner sends a message once even when the browser retries the same id', async () => {
  const mock = mockSupabase(); const handler = service(mock); const bearer = await token();
  const clientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const first = await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: '  What is on my calendar?  ', clientId } });
  assert.equal(first.status, 200); assert.equal(first.body.accepted, true);
  assert.equal((await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'What is on my calendar?', clientId } })).status, 200);
  const rows = mock.tables.infinity_messages;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].body, 'What is on my calendar?');
  assert.equal(rows[0].state, 'queued');
  assert.equal(rows[0].owner_oid, ownerId);
});

test('owner messages from another account stay invisible', async () => {
  const mock = mockSupabase(); const handler = service(mock); const bearer = await token();
  mock.tables.infinity_messages.push({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', seq: 99, owner_tid: tid, owner_oid: otherId, role: 'user', body: 'private', state: 'queued', created_at: new Date().toISOString() });
  await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'mine' } });
  const listed = await call(handler, '/api/infinity/messages', { bearer });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.messages.map(m => m.body), ['mine']);
});

test('relay endpoints need the secret, reject browsers, and report unconfigured sites', async () => {
  const mock = mockSupabase();
  assert.equal((await call(service(mock, { relaySecret: undefined }), '/api/infinity/relay/inbox')).status, 503);
  const handler = service(mock);
  assert.equal((await call(handler, '/api/infinity/relay/inbox')).status, 401);
  assert.equal((await call(handler, '/api/infinity/relay/inbox', { relay: 'wrong_' + secret })).status, 401);
  assert.equal((await call(handler, '/api/infinity/relay/inbox', { relay: secret, origin: 'https://mcnairscode.com' })).status, 403);
  assert.equal((await call(handler, '/api/infinity/relay/inbox', { relay: secret })).status, 200);
  const owner = await token();
  const status = await call(handler, '/api/infinity/status', { bearer: owner });
  assert.equal(status.body.relay.configured, true);
  assert.ok(status.body.relay.lastSeenAt);
});

test('home relay drains queued prompts, answers once, and the page sees the reply', async () => {
  const mock = mockSupabase(); const handler = service(mock); const bearer = await token();
  await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'Summarize my week.' } });
  await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'Second question.' } });
  const inbox = await call(handler, '/api/infinity/relay/inbox', { relay: secret });
  assert.equal(inbox.status, 200);
  assert.deepEqual(inbox.body.messages.map(m => m.body), ['Summarize my week.', 'Second question.']);
  const id = inbox.body.messages[0].id;
  assert.equal((await call(handler, '/api/infinity/relay/inbox', { relay: secret })).body.messages.length, 2);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'working' } })).status, 200);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'answered', text: 'Three meetings and one deadline.' } })).status, 200);
  // A retried delivery must not duplicate the reply.
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'answered', text: 'Three meetings and one deadline.' } })).status, 200);
  const answers = mock.tables.infinity_messages.filter(m => m.role === 'assistant');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].reply_to, id);
  assert.equal(mock.tables.infinity_messages.find(m => m.id === id).state, 'answered');
  const page = await call(handler, '/api/infinity/messages', { bearer, after: 0 });
  const reply = page.body.messages.find(m => m.role === 'assistant');
  assert.equal(reply.body, 'Three meetings and one deadline.');
  assert.equal(reply.replyTo, id);
  // Answered prompts leave the relay queue.
  assert.deepEqual((await call(handler, '/api/infinity/relay/inbox', { relay: secret })).body.messages.map(m => m.body), ['Second question.']);
});

test('relay rejects bad ids, states, and oversized payloads without leaking storage errors', async () => {
  const mock = mockSupabase(); const handler = service(mock); const bearer = await token();
  await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: 'One prompt.' } });
  const id = mock.tables.infinity_messages[0].id;
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'queued' } })).status, 400);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'answered' } })).status, 400);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id: 'nope', state: 'answered', text: 'x' } })).status, 400);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', state: 'working' } })).status, 404);
  assert.equal((await call(handler, '/api/infinity/relay/reply', { relay: secret, method: 'POST', body: { id, state: 'working', junk: 'x'.repeat(50000) } })).status, 413);
  mock.failNext({ message: 'SECRET SDK ERROR' });
  const failed = await call(handler, '/api/infinity/messages', { bearer });
  assert.ok([503].includes(failed.status));
  assert.deepEqual(failed.body, { error: 'Commander chat storage is unavailable. Please retry later.' });
  assert.ok(!JSON.stringify(failed.body).includes('SECRET'));
});

test('non-JSON and empty messages are rejected before storage', async () => {
  const mock = mockSupabase(); const handler = service(mock); const bearer = await token();
  assert.equal((await call(handler, '/api/infinity/messages', { bearer, method: 'POST', body: { text: '   ' } })).status, 400);
  const raw = await handler(new HttpRequest({ url: 'https://mcnairscode.com/api/infinity/messages', method: 'POST', headers: { 'X-Portfolio-Authorization': `Bearer ${bearer}`, 'Content-Type': 'text/plain' }, body: { string: 'hello' } }));
  assert.equal(raw.status, 415);
  assert.equal(mock.tables.infinity_messages.length, 0);
});
