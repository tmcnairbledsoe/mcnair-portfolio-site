const { app } = require('@azure/functions');
const { createClient } = require('@supabase/supabase-js');
const { createVerifier, HttpError } = require('./auth');
const { createStore } = require('./store');
const { createService } = require('./service');
const { createDrawingService } = require('./drawing');
let verifier, store, client;
const authenticate = header => {
    if (header === null) return null;
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(header) || header.length > 16384) throw new HttpError(401, 'Sign in with a valid API access token.');
    verifier ||= createVerifier({ tenantId: process.env.ENTRA_TENANT_ID, clientId: process.env.ENTRA_CLIENT_ID, scope: process.env.ENTRA_SCOPE });
    return verifier(header);
  };
function getClient() {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL || '') || !SUPABASE_SECRET_KEY) throw new Error('Server content settings missing');
    client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return client;
}
const handler = createService({
  authenticate,
  getStore: () => {
    if (!store) {
      const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET = 'portfolio-images' } = process.env;
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL || '') || !SUPABASE_SECRET_KEY || SUPABASE_BUCKET !== 'portfolio-images') throw new Error('Server content settings missing');
      store = createStore(getClient(), SUPABASE_BUCKET);
    }
    return store;
  },
});
const drawingHandler = createDrawingService({ authenticate, getClient });
app.setup({ enableHttpStream: true });
app.http('content', { methods: ['GET', 'POST', 'PUT', 'DELETE'], authLevel: 'anonymous', route: '{*path}', handler: request => new URL(request.url).pathname.startsWith('/api/drawing') ? drawingHandler(request) : handler(request) });
