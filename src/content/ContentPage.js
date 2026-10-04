import React, { useCallback, useLayoutEffect, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useContentSession } from '../auth/ContentSession';
import { useAuthStartup } from '../auth/AuthBootstrap';
import ContentEditor from './ContentEditor';
import DocumentView, { MediaContext } from './DocumentView';
import { request } from './client';
import './content.css';

// Account identity is a React key: a switch removes all previous private DOM and
// editor state during the same commit. Layout cleanup aborts requests/revokes media.
export default function ContentPage({ kind }) {
  const session = useContentSession();
  const { id } = useParams();
  return <AccountContent key={`${kind}:${session.accountKey}:${id || ''}`} kind={kind} id={id} session={session} />;
}
export function AccountContent({ kind, id, session }) {
  const { status } = useAuthStartup();
  const { account, token, signIn, ready } = session;
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [canWrite, setCanWrite] = useState(false);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lifecycle = useRef({ live: true, controllers: new Set() });
  useLayoutEffect(() => {
    const state = lifecycle.current; state.live = true;
    return () => { state.live = false; state.controllers.forEach(c => c.abort()); state.controllers.clear(); };
  }, []);
  const call = useCallback(async (path, options = {}) => {
    const state = lifecycle.current;
    const controller = new AbortController(); state.controllers.add(controller);
    try {
      const result = await request(path, { token: account ? token : null, ...options, signal: controller.signal });
      if (!state.live || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return result;
    } finally { state.controllers.delete(controller); }
  }, [account, token]);
  const showError = useCallback(failure => { if (lifecycle.current.live && failure.name !== 'AbortError') { setError(failure.message); if ([409, 412].includes(failure.status)) setConflict(true); } }, []);
  const load = useCallback(async (next = null) => {
    if (kind === 'journal' && !account) return;
    setLoading(true); setError('');
    try {
      const data = await call(id ? `${kind}/${id}` : `${kind}?limit=10${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      setItems(old => next ? [...old, ...data.items] : id ? [data] : data.items);
      setCursor(id ? null : data.cursor); setCanWrite(data.canWrite === true && !!account);
    } catch (failure) { showError(failure); }
    finally { if (lifecycle.current.live) setLoading(false); }
  }, [account, call, id, kind, showError]);
  useEffect(() => { load(); }, [load, attempt]);
  async function signInAgain() {
    try { await signIn(); } catch { setError('Could not start sign-in. Please retry.'); }
  }
  async function edit(post) {
    setBusy(true); setError('');
    try { const latest = await call(`${kind}/${post.id}`); setEditor(latest); setConflict(false); }
    catch (failure) { showError(failure); }
    finally { if (lifecycle.current.live) setBusy(false); }
  }
  async function save(post) {
    setBusy(true); setError('');
    try {
      const saved = await call(editor.id ? `${kind}/${editor.id}` : kind, { method: editor.id ? 'PUT' : 'POST', body: post, ...(editor.id ? { version: editor.version } : {}) });
      setEditor(null); setConflict(false);
      if (id) setItems([saved]); else await load();
    } catch (failure) { showError(failure); }
    finally { if (lifecycle.current.live) setBusy(false); }
  }
  async function remove(post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusy(true); setError(''); setConflict(false);
    try { await call(`${kind}/${post.id}`, { method: 'DELETE', version: post.version }); setItems(old => old.filter(p => p.id !== post.id)); }
    catch (failure) { showError(failure); }
    finally { if (lifecycle.current.live) setBusy(false); }
  }
  const media = React.useMemo(() => ({ kind, token: account ? token : null }), [kind, account, token]);
  return <div className="content-page">
    <p className="eyebrow">{kind === 'blog' ? 'Writing / Public' : 'Writing / Private'}</p>
    <h1>{kind === 'blog' ? 'Blog' : 'Private Journal'}</h1>
    {kind === 'journal' && <p>Entries and images are private to your Microsoft account.</p>}
    {kind === 'journal' && !account ? <>
      <p>Sign in with Microsoft to open your journal.</p>
      {ready ? <button onClick={signInAgain}>Sign in with Microsoft</button> : <p>{status === 'starting' ? 'Preparing sign-in…' : 'Sign-in is unavailable. Check Account in the sidebar for setup or retry.'}</p>}
    </> : <MediaContext.Provider value={media}>
      {canWrite && !editor && <button disabled={busy} onClick={() => { setEditor({}); setConflict(false); setError(''); }}>New {kind === 'blog' ? 'blog post' : 'entry'}</button>}
      {editor && <ContentEditor key={`${editor.id || 'new'}:${editor.version || 0}`} initial={editor} kind={kind} busy={busy} conflict={conflict} save={save} upload={file => call(`media/${kind}`, { method: 'POST', body: file })} cancel={() => { setEditor(null); setError(''); setConflict(false); }} reload={() => { if (window.confirm('Discard your edits and load the current version?')) edit(editor); }} />}
      {loading && <p role="status">Loading entries…</p>}
      {!loading && !error && !items.length && <p>No {kind === 'blog' ? 'published posts' : 'entries'} yet.</p>}
      {!editor && items.map(post => <article className="content-post" key={post.id}>
        <h2>{post.title}</h2><p>{new Date(post.createdAt).toLocaleDateString()}{canWrite && kind === 'blog' ? ` · ${post.status}` : ''}</p>
        <DocumentView document={post.document} />
        {canWrite && <div className="editor-toolbar"><button disabled={busy} onClick={() => edit(post)}>Edit</button><button disabled={busy} onClick={() => remove(post)}>Delete</button></div>}
      </article>)}
      {cursor && !editor && <button disabled={loading || busy} onClick={() => load(cursor)}>Load more</button>}
    </MediaContext.Provider>}
    {error && <><p role="alert">{error}</p><button disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}>Retry loading entries</button>{account && <button onClick={signInAgain}>Sign in again</button>}</>}
  </div>;
}
