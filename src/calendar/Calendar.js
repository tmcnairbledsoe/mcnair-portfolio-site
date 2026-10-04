import React, { useCallback, useEffect, useRef, useState } from "react";
import { useContentSession } from "../auth/ContentSession";
import { recognizedRoles } from "../auth/config";
import "./calendar.css";
const names = { owner: "McNair", wife: "Charlotte", both: "Both" };
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function localReminder(value) {
  if (!value || Date.parse(value) <= Date.now()) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export default function Calendar() {
  const session = useContentSession();
  return <SharedCalendar key={session.accountKey} session={session} />;
}
export function SharedCalendar({ session }) {
  const roles = recognizedRoles(session.account),
    allowed = roles.includes("Owner") || roles.includes("Wife");
  const [day, setDay] = useState(dayKey(new Date())),
    [items, setItems] = useState([]),
    [editor, setEditor] = useState(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [emailReady, setEmailReady] = useState(false);
  const live = useRef(true),
    requests = useRef(new Set());
  const month = day.slice(0, 7);
  const currentMonth = useRef(month),
    loadSequence = useRef(0);
  currentMonth.current = month;
  useEffect(() => {
    const activeRequests = requests.current;
    live.current = true;
    return () => {
      live.current = false;
      for (const c of activeRequests) c.abort();
    };
  }, []);
  const call = useCallback(
    async (path, options = {}) => {
      const controller = new AbortController();
      requests.current.add(controller);
      try {
        const bearer = await session.token();
        if (!live.current) throw new DOMException("Cancelled", "AbortError");
        const response = await fetch(`/api/calendar${path}`, {
          ...options,
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "X-Portfolio-Authorization": `Bearer ${bearer}`,
            ...options.headers,
          },
        });
        const data = await response.json();
        if (!live.current) throw new DOMException("Cancelled", "AbortError");
        if (!response.ok) {
          const failure = new Error(
            data.error || "Could not load the calendar.",
          );
          failure.status = response.status;
          throw failure;
        }
        return data;
      } finally {
        requests.current.delete(controller);
      }
    },
    [session],
  );
  const showError = useCallback((e) => {
    if (live.current && e.name !== "AbortError") {
      setError(e.message);
      if ([401, 403].includes(e.status)) {
        setItems([]);
        setEditor(null);
      }
    }
  }, []);
  const load = useCallback(async () => {
    if (!allowed || !session.ready) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const data = await call(`?month=${month}`);
      if (currentMonth.current === month && sequence === loadSequence.current) {
        setItems(data.items);
        setEmailReady(data.emailReady);
      }
    } catch (e) {
      if (currentMonth.current === month && sequence === loadSequence.current)
        showError(e);
    } finally {
      if (live.current && sequence === loadSequence.current) setLoading(false);
    }
  }, [allowed, session.ready, call, month, showError]);
  useEffect(() => {
    load();
    const refresh = () => {
      if (!document.hidden) load();
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  function changeMonth(offset) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setDay(dayKey(date));
    setEditor(null);
    setItems([]);
    setError("");
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { id, version } = editor;
    const entry = editor;
    try {
      const body = {
        title: entry.title.trim(),
        kind: entry.kind,
        day: entry.day,
        member: entry.member,
        startTime: entry.kind === "event" ? entry.startTime : null,
        endTime: entry.kind === "event" ? entry.endTime : null,
        completed: entry.kind === "task" && entry.completed,
        reminderAt:
          entry.reminderLocal && !(entry.kind === "task" && entry.completed)
            ? new Date(entry.reminderLocal).toISOString()
            : null,
        remindTo:
          entry.reminderLocal && !(entry.kind === "task" && entry.completed)
            ? entry.remindTo
            : null,
      };
      const saved = await call(id ? `/${id}` : "", {
        method: id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(id ? { "If-Match": `"${version}"` } : {}),
        },
        body: JSON.stringify(body),
      });
      setItems((previous) => [
        ...previous.filter((p) => p.id !== saved.id),
        saved,
      ]);
      setEditor(null);
    } catch (e) {
      showError(e);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function remove(entry) {
    if (
      !window.confirm(
        `Delete “${entry.title}” and cancel its unsent reminders?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await call(`/${entry.id}`, {
        method: "DELETE",
        headers: { "If-Match": `"${entry.version}"` },
      });
      setItems((previous) => previous.filter((p) => p.id !== entry.id));
    } catch (e) {
      showError(e);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  function edit(entry) {
    setError("");
    setEditor({
      ...entry,
      reminderLocal: localReminder(entry.reminderAt),
      remindTo: entry.remindTo || entry.member,
    });
  }
  const selected = items
    .filter((p) => p.day === day)
    .sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99"));
  const first = new Date(`${month}-01T12:00:00`),
    count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const field = (name, value) =>
    setEditor((previous) => ({ ...previous, [name]: value }));
  return (
    <section className="shared-calendar">
      <p className="eyebrow">Shared / Private</p>
      <h1>Calendar</h1>
      {!allowed ? (
        <>
          <p>
            {session.account
              ? "This calendar is only available to Owner and Wife."
              : "Sign in as Owner or Wife to open the shared calendar."}
          </p>
          {!session.account && session.ready && (
            <button onClick={() => session.signIn().catch(showError)}>
              Sign in with Microsoft
            </button>
          )}
        </>
      ) : (
        <>
          <p>
            Shared with McNair and Charlotte. Event times use America/New_York.
          </p>
          <div className="calendar-legend">
            {Object.entries(names).map(([member, name]) => (
              <span className={`calendar-tag member-${member}`} key={member}>
                {name}
              </span>
            ))}
          </div>
          <div className="calendar-heading">
            <button onClick={() => changeMonth(-1)} aria-label="Previous month">
              ←
            </button>
            <h2>
              {first.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button onClick={() => changeMonth(1)} aria-label="Next month">
              →
            </button>
          </div>
          {error && (
            <p role="alert">
              {error}{" "}
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !editor ||
                    window.confirm(
                      "Discard unsaved edits and reload the calendar?",
                    )
                  ) {
                    setEditor(null);
                    setError("");
                    load();
                  }
                }}
              >
                Reload calendar
              </button>
            </p>
          )}
          {loading && <p role="status">Updating calendar…</p>}
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
              <div className="calendar-weekday" key={name}>
                {name}
              </div>
            ))}
            {Array.from({ length: first.getDay() }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: count }, (_, index) => {
              const date = `${month}-${String(index + 1).padStart(2, "0")}`;
              return (
                <button
                  key={date}
                  className={`calendar-day ${date === day ? "selected" : ""}`}
                  aria-label={`Select ${date}`}
                  aria-pressed={date === day}
                  onClick={() => {
                    if (
                      !editor ||
                      window.confirm("Discard unsaved entry edits?")
                    ) {
                      setDay(date);
                      setEditor(null);
                      setError("");
                    }
                  }}
                >
                  <strong>{index + 1}</strong>
                  {items
                    .filter((p) => p.day === date)
                    .map((entry) => (
                      <span
                        className={`calendar-tag member-${entry.member} ${entry.completed ? "completed" : ""}`}
                        key={entry.id}
                      >
                        {entry.kind === "task"
                          ? "•"
                          : `${entry.startTime}–${entry.endTime}`}{" "}
                        {names[entry.member]}: {entry.title}
                      </span>
                    ))}
                </button>
              );
            })}
          </div>
          <h2>
            {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
          {!editor && (
            <button
              disabled={busy}
              onClick={() =>
                setEditor({
                  title: "",
                  kind: "event",
                  day,
                  member: roles.includes("Owner") ? "owner" : "wife",
                  startTime: "09:00",
                  endTime: "10:00",
                  completed: false,
                  reminderAt: null,
                  reminderLocal: "",
                  remindTo: roles.includes("Owner") ? "owner" : "wife",
                })
              }
            >
              Add event or task
            </button>
          )}
          {editor && (
            <form className="calendar-form" onSubmit={save}>
              <label>
                Entry type
                <select
                  value={editor.kind}
                  disabled={busy}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setEditor((previous) => ({
                      ...previous,
                      kind,
                      startTime:
                        kind === "event" ? previous.startTime || "09:00" : null,
                      endTime:
                        kind === "event" ? previous.endTime || "10:00" : null,
                      completed: kind === "task" && previous.completed,
                    }));
                  }}
                >
                  <option value="event">Event / busy time</option>
                  <option value="task">Task</option>
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  maxLength={200}
                  value={editor.title}
                  disabled={busy}
                  onChange={(e) => field("title", e.target.value)}
                />
              </label>
              <label>
                For
                <select
                  value={editor.member}
                  disabled={busy}
                  onChange={(e) => field("member", e.target.value)}
                >
                  {Object.entries(names).map(([key, name]) => (
                    <option value={key} key={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {editor.kind === "event" ? (
                <>
                  <label>
                    Start time (Eastern)
                    <input
                      type="time"
                      required
                      value={editor.startTime || "09:00"}
                      disabled={busy}
                      onChange={(e) => field("startTime", e.target.value)}
                    />
                  </label>
                  <label>
                    End time (Eastern)
                    <input
                      type="time"
                      required
                      value={editor.endTime || "10:00"}
                      disabled={busy}
                      onChange={(e) => field("endTime", e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label>
                  <input
                    type="checkbox"
                    checked={editor.completed}
                    disabled={busy}
                    onChange={(e) => field("completed", e.target.checked)}
                  />{" "}
                  Task completed
                </label>
              )}
              <label>
                Reminder time (
                {Intl.DateTimeFormat().resolvedOptions().timeZone})
                <input
                  type="datetime-local"
                  disabled={busy || !emailReady}
                  value={editor.reminderLocal}
                  onChange={(e) => field("reminderLocal", e.target.value)}
                />
              </label>
              {editor.reminderLocal && (
                <label>
                  Email reminder to
                  <select
                    value={editor.remindTo}
                    disabled={busy}
                    onChange={(e) => field("remindTo", e.target.value)}
                  >
                    {Object.entries(names).map(([key, name]) => (
                      <option value={key} key={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!emailReady && (
                <p>
                  Email reminders are waiting for sender setup. Events and tasks
                  can still be saved.
                </p>
              )}
              <div className="actions">
                <button type="submit" disabled={busy}>
                  Save entry
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!selected.length && <p>No events or tasks for this day.</p>}
          <ul className="calendar-entries">
            {selected.map((entry) => (
              <li
                key={entry.id}
                className={`member-${entry.member} ${entry.completed ? "completed" : ""}`}
              >
                <strong>
                  {entry.kind === "task"
                    ? "• Task"
                    : `${entry.startTime}–${entry.endTime}`}{" "}
                  · {names[entry.member]}
                </strong>
                <p>{entry.title}</p>
                {entry.reminderAt && (
                  <p>
                    Reminder: {new Date(entry.reminderAt).toLocaleString()} ·{" "}
                    {names[entry.remindTo]}
                    {entry.reminders
                      ?.map(
                        (r) =>
                          ` · ${names[r.recipient]}: ${r.status === "sent" ? "accepted by email provider" : r.status}`,
                      )
                      .join("")}
                  </p>
                )}
                <div className="actions">
                  <button disabled={busy} onClick={() => edit(entry)}>
                    Edit {entry.title}
                  </button>
                  <button disabled={busy} onClick={() => remove(entry)}>
                    Delete {entry.title}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="footnote">
            Only Owner and Wife can read or change this calendar. Reminders are
            sent to the configured email addresses, even when this page is
            closed. Delivery may be a few minutes after the selected time.
          </p>
        </>
      )}
    </section>
  );
}
