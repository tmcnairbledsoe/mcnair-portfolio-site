const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { HttpRequest } = require('@azure/functions');
const { createVerifier } = require('../src/auth');
const { createMcpService } = require('../src/mcp');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const tid = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
let jose, keys, service;
before(async () => {
  jose = await import('jose'); keys = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(keys.publicKey); jwk.kid = 'test';
  service = createMcpService({ authenticate: createVerifier({ tenantId: tid, clientId, keyResolver: jose.createLocalJWKSet({ keys: [jwk] }) }) });
});
async function token(roles = ['FriendRole'], claims = {}) {
  return new jose.SignJWT({ tid, oid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ver: '2.0', scp: 'access_as_user', roles, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setAudience(clientId).setIssuedAt().setExpirationTime(claims.exp ?? '5m').sign(keys.privateKey);
}
async function call({ bearer, body = { jsonrpc: '2.0', id: 1, method: 'tools/list' }, method = 'POST', headers = {} } = {}) {
  return service(new HttpRequest({ url: 'https://mcnairscode.com/api/mcp', method,
    headers: { Authorization: 'Bearer Azure-routing-token', Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', ...(bearer ? { 'X-Portfolio-Authorization': `Bearer ${bearer}` } : {}), ...headers },
    ...(method === 'POST' ? { body: { string: typeof body === 'string' ? body : JSON.stringify(body) } } : {}),
  }));
}
test('requires verified eligible user on every request, ignores proxy and forged principal', async () => {
  for (const method of ['POST', 'GET', 'DELETE']) assert.equal((await call({ method })).status, 401);
  assert.equal((await call({ headers: { 'X-MS-CLIENT-PRINCIPAL': 'OwnerRole' } })).status, 401);
  for (const bearer of ['fake', await token([], {}), await token(['ownerrole']), await token(['OtherRole']), await token(['OwnerRole'], { exp: 1 }), await token(['FriendRole'], { scp: 'User.Read' })]) {
    const result = await call({ bearer });
    assert.ok([401, 403].includes(result.status));
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
  for (const role of ['OwnerRole', 'WifeRole', 'FriendRole']) {
    const result = await call({ bearer: await token([role]) });
    assert.equal(result.status, 200); assert.deepEqual(JSON.parse(result.body).result, { tools: [] });
  }
});
test('official SDK client completes handshake, notification, ping, and empty discovery through Azure adapter', async () => {
  const bearer = await token();
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://mcnairscode.com/api/mcp'), {
    requestInit: { headers: { 'X-Portfolio-Authorization': `Bearer ${bearer}` } },
    fetch: async (url, init) => {
      const response = await service(new HttpRequest({ url: String(url), method: init.method,
        headers: Object.fromEntries(new Headers(init.headers)), ...(init.body ? { body: { string: init.body } } : {}) }));
      return new Response(response.body ?? (response.jsonBody ? JSON.stringify(response.jsonBody) : null), { status: response.status, headers: response.headers });
    },
  });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'mcnairscode');
    assert.deepEqual(await client.listTools(), { tools: [] });
    assert.deepEqual(await client.ping(), {});
    await assert.rejects(client.callTool({ name: 'read_journal', arguments: {} }));
  } finally { await client.close(); }
});
test('origin, request size, protocol, method, malformed JSON and unsupported operations are bounded', async () => {
  const bearer = await token();
  assert.equal((await call({ bearer, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call({ bearer, headers: { Origin: 'https://mcnairscode.com' } })).status, 200);
  assert.equal((await call({ bearer, headers: { 'MCP-Protocol-Version': 'invalid' } })).status, 400);
  for (const method of ['GET', 'DELETE', 'PUT']) assert.equal((await call({ bearer, method })).status, 405);
  assert.equal((await call({ bearer, body: '{' })).status, 400);
  assert.equal((await call({ bearer, body: 'x'.repeat(16385) })).status, 413);
  const unsupported = await call({ bearer, body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_journal' } } });
  assert.equal(JSON.parse(unsupported.body).error.code, -32601);
});
