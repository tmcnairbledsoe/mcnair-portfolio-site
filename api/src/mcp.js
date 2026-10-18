const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { WebStandardStreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { HttpError } = require('./auth');

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const origins = new Set(['https://mcnairscode.com', 'https://www.mcnairscode.com']);

// Each request gets its own server and transport: no cross-account session state.
// Future tools must receive this verified identity, never client-supplied user IDs.
function createMcpServer(identity) {
  if (!identity?.journalAllowed) throw new HttpError(403, 'MCP requires an Owner, Wife, or Friend role.');
  const server = new Server({ name: 'mcnairscode', version: '1.0.0' }, {
    capabilities: { tools: {} },
    instructions: 'Connection service only. No tools are available yet.',
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  return server;
}

function createMcpService({ authenticate }) {
  return async request => {
    let server;
    try {
      const origin = request.headers.get('origin');
      if (origin !== null && !origins.has(origin)) throw new HttpError(403, 'Origin is not allowed.');
      // The SWA proxy owns Authorization. Never use its routing token as identity.
      const identity = await authenticate(request.headers.get('x-portfolio-authorization'));
      if (!identity) throw new HttpError(401, 'A valid Microsoft API access token is required.');
      server = createMcpServer(identity);
      if (request.method !== 'POST') {
        return { status: 405, headers: { ...headers, Allow: 'POST' }, jsonBody: { error: 'Use Streamable HTTP POST; standalone SSE and sessions are not supported.' } };
      }
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16384,
      });
      await server.connect(transport);
      // Azure HttpRequest is not a native Request; forward its bounded body stream.
      const webRequest = new Request(request.url, {
        method: request.method, headers: request.headers, body: request.body, duplex: 'half',
      });
      const response = await transport.handleRequest(webRequest);
      const body = await response.text();
      return { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers }, ...(body ? { body } : {}) };
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      return { status, headers, jsonBody: { error: status === 503 ? 'MCP is temporarily unavailable. Please retry.' : error.message } };
    } finally {
      if (server) await server.close();
    }
  };
}
module.exports = { createMcpService, createMcpServer };
