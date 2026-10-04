const { UUID } = require('./schema');
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function createVerifier({ tenantId, clientId, scope = 'access_as_user', keyResolver }) {
  if (!UUID.test(tenantId || '') || !UUID.test(clientId || '') || scope !== 'access_as_user') throw new Error('Invalid server authentication settings');
  let resolver = keyResolver;
  return async function authenticate(header) {
    if (header == null) return null;
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(header) || header.length > 16384) throw new HttpError(401, 'Sign in with a valid API access token.');
    try {
      const { jwtVerify, createRemoteJWKSet } = await import('jose');
      resolver ||= createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
      const { payload } = await jwtVerify(header.slice(7), resolver, {
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`, audience: clientId,
        algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'tid', 'oid', 'ver', 'scp'],
      });
      if (payload.aud !== clientId || payload.tid !== tenantId || !UUID.test(payload.oid || '') || payload.ver !== '2.0' || typeof payload.scp !== 'string' || !payload.scp.split(' ').includes(scope)) throw new Error('Invalid access claims');
      return { tid: tenantId, oid: payload.oid, owner: Array.isArray(payload.roles) && payload.roles.includes('OwnerRole') };
    } catch { throw new HttpError(401, 'Sign in with a valid API access token.'); }
  };
}
module.exports = { createVerifier, HttpError };
