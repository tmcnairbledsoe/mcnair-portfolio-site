import React, { useCallback, useEffect, useRef, useState } from "react";
import { useContentSession } from "../auth/ContentSession";
import { recognizedRoles } from "../auth/config";
import PageHeading from "../components/PageHeading";
import "./infinity.css";

const POLL_MS = 3000;
const ONLINE_MS = 90 * 1000;
const messageId = () => {
  const random = typeof window === "undefined" ? undefined : window.crypto?.randomUUID;
  return typeof random === "function"
    ? random.call(window.crypto)
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

class ChatError extends Error {}

async function call(path, { token, signal, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers["X-Portfolio-Authorization"] = `Bearer ${await token()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ChatError("Could not reach Commander. Check your connection and try again.");
  }
  if (response.status === 401) throw new ChatError("Your session needs sign-in again. Use Sign in again, then retry.");
  if (response.status === 403) throw new ChatError("Commander is available only to the Owner role.");
  if (response.status === 503) throw new ChatError("Commander chat is not available right now. Please retry later.");
  if (!response.ok) throw new ChatError("Commander could not handle that request. Please try again.");
  if (response.status === 204) return null;
  return response.json();
}

export default function InfinityChat() {
  const session = useContentSession();
  return <Commander key={session.accountKey} session={session} />;
}

function Commander({ session }) {
  const owner = recognizedRoles(session.account).includes("Owner");
  const [messages, setMessages] = useState([]);
  const [relaySeenAt, setRelaySeenAt] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const after = useRef(0);
  const live = useRef(true);
  const pending = useRef(null);
  const end = useRef(null);

  const refresh = useCallback(async () => {
    if (!owner) return;
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const data = await call(`infinity/messages?after=${after.current}`, {
        token: session.token,
        signal: controller.signal,
      });
      if (!live.current) return;
      if (data?.messages?.length) {
        after.current = Math.max(after.current, ...data.messages.map((m) => m.seq));
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id));
          return [...current, ...data.messages.filter((m) => !seen.has(m.id))].sort((a, b) => a.seq - b.seq);
        });
      }
      setRelaySeenAt(data?.relay?.lastSeenAt ?? null);
      setError("");
    } catch (e) {
      if (live.current && e.name !== "AbortError") setError(e.message);
    } finally {
      pending.current = null;
      if (live.current) setLoaded(true);
    }
  }, [owner, session.token]);

  useEffect(() => {
    live.current = true;
    if (!owner) return undefined;
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    return () => {
      live.current = false;
      clearInterval(timer);
      pending.current?.abort();
    };
  }, [owner, refresh]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await call("infinity/messages", {
        token: session.token,
        body: { text: value, clientId: messageId() },
      });
      setText("");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      if (live.current) setBusy(false);
    }
  }

  if (!session.account || !owner) {
    return (
      <>
        <PageHeading eyebrow="Private" title="Commander">
          {session.account
            ? "This page is available only to the Owner account."
            : "Sign in with the Owner account to talk to Commander."}
        </PageHeading>
        <p>{session.account ? "Your account does not have the Owner role." : "Use the sidebar to sign in with Microsoft."}</p>
      </>
    );
  }

  const online = relaySeenAt ? Date.now() - Date.parse(relaySeenAt) < ONLINE_MS : false;

  return (
    <section className="infinity-chat">
      <PageHeading eyebrow="Your personal Commander" title="Commander">
        This is live Commander on your home PC. Messages you send here join the same conversation and work records.
      </PageHeading>
      <p className={`infinity-relay ${online ? "online" : "offline"}`} role="status">
        {loaded
          ? online
            ? "Home PC connected. Replies arrive as soon as Commander finishes."
            : "Home PC not connected right now. Your messages stay queued until it reconnects."
          : "Connecting to Commander…"}
      </p>
      {!session.ready && <p className="muted">Finishing sign-in…</p>}
      <div className="infinity-thread" aria-live="polite">
        {loaded && messages.length === 0 && (
          <p className="muted">No messages yet. Ask Commander anything.</p>
        )}
        {messages.map((message) => (
          <article className={`infinity-turn ${message.role}`} key={message.id}>
            <div className="infinity-bubble">
              <div className="infinity-author">{message.role === "user" ? "You" : "Commander"}</div>
              <p>{message.body}</p>
              <small>{new Date(message.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</small>
            </div>
            {message.role === "user" && message.state !== "answered" && (
              <p className="infinity-state">
                {message.state === "working"
                  ? "Commander is working on this…"
                  : message.state === "waiting"
                    ? "Commander needs your decision; answer it in the Infinity app on your PC."
                    : message.state === "failed"
                      ? "Commander could not answer this. Ask again, or check the Infinity app."
                      : "Queued for your home PC…"}
              </p>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      <form className="infinity-composer" onSubmit={send}>
        <label>
          Message Commander
          <textarea
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={32000}
            placeholder="What would you like done?"
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Sending…" : "Send"}
          </button>
          <button type="button" onClick={() => session.signIn().catch(() => setError("Could not start sign-in. Please retry."))}>
            Sign in again
          </button>
        </div>
      </form>
      <p className="muted">
        Only your Owner account can use this page. Messages are stored on this site so your home PC can
        pick them up; Commander still uses your local tools, models, and limits.
      </p>
      {error && <p className="infinity-error" role="alert">{error}</p>}
    </section>
  );
}
