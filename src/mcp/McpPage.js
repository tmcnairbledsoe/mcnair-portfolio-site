import React, { useLayoutEffect, useRef, useState } from 'react';
import { useContentSession } from '../auth/ContentSession';
import PageHeading from '../components/PageHeading';
import './mcp.css';

const configuration = JSON.stringify({ mcpServers: { mcnairscode: {
  type: 'http', url: 'https://mcnairscode.com/api/mcp',
  headers: { 'X-Portfolio-Authorization': 'Bearer <YOUR_ACCESS_TOKEN>' },
} } }, null, 2);

export default function McpPage() {
  const session = useContentSession();
  return <ConnectionGuide key={session.accountKey} session={session} />;
}

export function ConnectionGuide({ session }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const live = useRef(false);
  const pending = useRef(null);
  useLayoutEffect(() => {
    live.current = true;
    return () => { live.current = false; pending.current?.abort(); };
  }, []);
  useLayoutEffect(() => {
    if (!access) return;
    const timer = setTimeout(() => {
      setAccess(null); setRevealed(false); setMessage('Token expired. Check the connection again to get a current token.');
    }, Math.max(0, access.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [access]);

  async function connect() {
    setBusy(true); setError(''); setMessage(''); setAccess(null); setRevealed(false);
    const controller = new AbortController();
    pending.current = controller;
    try {
      const token = await session.token();
      if (!live.current) return;
      async function rpc(body) {
        const response = await fetch('/api/mcp', {
          method: 'POST', cache: 'no-store', signal: controller.signal,
          headers: { 'X-Portfolio-Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(response.status === 403 ? 'Access requires an Owner, Wife, or Friend role in your Microsoft API token.' : response.status === 401 ? 'Your token is invalid or expired. Sign in again.' : 'Could not connect to MCP. Please retry.');
        if (response.status === 202) return;
        const data = await response.json();
        if (data.error) throw new Error('The MCP connection check failed. Please retry.');
        return data.result;
      }
      await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'mcnairscode-connection-check', version: '1.0.0' } } });
      await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
      const result = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const expires = payload.exp * 1000;
      if (!Number.isFinite(expires) || expires <= Date.now() || !Array.isArray(result?.tools)) throw new Error('Could not verify the connection. Please retry.');
      if (!live.current) return;
      setAccess({ token, expires });
      setMessage(`Connected successfully. ${result.tools.length} tools available.`);
    } catch (e) {
      if (live.current && e.name !== 'AbortError') setError(e.message);
    } finally { if (live.current) setBusy(false); }
  }
  async function copyToken() {
    try {
      if (access.expires <= Date.now()) throw new Error('expired');
      await navigator.clipboard.writeText(access.token);
      if (live.current) setMessage('Token copied. Paste it into your trusted agent’s private configuration.');
    } catch { if (live.current) setError('Could not copy. Reveal the token and copy it manually, or check the connection again if it expired.'); }
  }

  if (!session.account || !session.journalAllowed) return <>
    <PageHeading eyebrow="Private connections" title="MCP access">Available only to the Owner, Wife, and Friends with an assigned Microsoft role.</PageHeading>
    <p>{session.account ? 'This account does not have an eligible role.' : 'Sign in using the sidebar to continue.'}</p>
  </>;

  return <section className="mcp-page">
    <PageHeading eyebrow="Private connections" title="Connect your AI agent.">Use your Microsoft account to connect a trusted agent to McNair’s Code through the Model Context Protocol.</PageHeading>
    <div className="mcp-status"><strong>Connection only</strong><p>No tools are published yet. Connecting does not give the agent any MCP actions or content to read.</p></div>
    <article className="project-card">
      <h2>1. Check your access</h2>
      <p>Only Owner, Wife, and Friend accounts can connect. This check verifies your token with the server, completes the MCP handshake, and asks for the tool list.</p>
      <button className="button" disabled={busy || !session.ready} onClick={connect}>{busy ? 'Checking connection…' : 'Check connection & get token'}</button>
      <button className="button" disabled={busy || !session.ready} onClick={() => session.signIn().catch(() => setError('Could not start sign-in. Please retry.'))}>Sign in again</button>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
      {access && <div className="mcp-token">
        <p>Expires {new Date(access.expires).toLocaleString()}. Get a current token here after it expires.</p>
        <p id="token-help"><strong>Treat this token like a password.</strong> It also carries your existing website API permissions, including any private content your account can access. Share it only with an agent you trust. Do not paste it into chat messages, URLs, or source control. Signing out does not invalidate an already copied token before expiry.</p>
        <button className="button" onClick={copyToken}>Copy token</button>
        <button className="button" aria-expanded={revealed} aria-controls="mcp-access-token" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide token' : 'Reveal token'}</button>
        <button className="button" onClick={() => { setAccess(null); setRevealed(false); setMessage('Token cleared from this page. Copied tokens remain valid until expiry.'); }}>Clear from page</button>
        {revealed && <><label htmlFor="mcp-access-token">Access token</label><textarea id="mcp-access-token" readOnly value={access.token} aria-describedby="token-help" spellCheck={false} autoComplete="off" /></>}
      </div>}
    </article>
    <article className="project-card">
      <h2>2. Add the server to your agent</h2>
      <p>Choose a remote MCP server using <strong>Streamable HTTP</strong>. Set the URL to <code>https://mcnairscode.com/api/mcp</code> and the custom header <code>X-Portfolio-Authorization</code> to <code>Bearer &lt;YOUR_ACCESS_TOKEN&gt;</code>.</p>
      <pre aria-label="Example MCP client configuration"><code>{configuration}</code></pre>
      <p>This example uses the common mcpServers format; your client may use different configuration keys. It must support custom HTTP headers. Clients that require automatic OAuth sign-in or only accept a standard Authorization header are not supported in this first version.</p>
    </article>
    <article className="project-card">
      <h2>3. Connect</h2>
      <p>Save the private configuration and reconnect your agent. A successful connection currently returns an empty tool list. We’ll add tools later.</p>
      <p>A 401 response means the token is missing, invalid, or expired. A 403 means the account’s role or request origin is not allowed. Opening the endpoint in a browser is not a connection test: it requires authenticated MCP POST requests.</p>
    </article>
  </section>;
}
