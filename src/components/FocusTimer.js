import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function FocusTimer() {
  const [minutes, setMinutes] = useState("25");
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Ready when you are.");
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    function tick() {
      const seconds = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) {
        setRunning(false);
        setMessage("Session complete. Take a moment to recharge.");
      }
    }
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [running]);
  function start() {
    const seconds = remaining || duration;
    setRemaining(seconds);
    deadline.current = Date.now() + seconds * 1000;
    setRunning(true);
    setMessage("Focus session in progress.");
  }
  function pause() {
    const seconds = Math.max(
      0,
      Math.ceil((deadline.current - Date.now()) / 1000),
    );
    setRemaining(seconds);
    setRunning(false);
    setMessage(
      seconds
        ? "Paused. Resume whenever you’re ready."
        : "Session complete. Take a moment to recharge.",
    );
  }
  function reset() {
    setRunning(false);
    setRemaining(duration);
    setMessage("Timer reset. Ready when you are.");
  }
  function apply(event) {
    event.preventDefault();
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      setMessage("Enter a whole number from 1 to 180 minutes.");
      return;
    }
    setRunning(false);
    setDuration(value * 60);
    setRemaining(value * 60);
    setMessage(
      `Set for ${value} ${value === 1 ? "minute" : "minutes"}. Ready when you are.`,
    );
  }
  const display = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <>
      <Link className="text-link back-link" to="/tools">
        ← Browser tools
      </Link>
      <div className="page-heading">
        <p className="eyebrow">One thing at a time</p>
        <h1>Focus timer</h1>
        <p className="lede">Pick a task. Set aside a little time. Begin.</p>
      </div>
      <div className="timer-panel">
        <p className="eyebrow">
          {running
            ? "In focus"
            : remaining === 0
              ? "Session complete"
              : "Your next session"}
        </p>
        <div
          className="timer-display"
          role="timer"
          aria-label="Time remaining"
          aria-live="off"
        >
          {display}
        </div>
        <p role="status" className="tool-status">
          {message}
        </p>
        <div className="actions timer-actions">
          <button onClick={running ? pause : start}>
            {running
              ? "Pause"
              : remaining === 0 || remaining === duration
                ? "Start session"
                : "Resume"}
          </button>
          <button className="secondary" onClick={reset}>
            Reset
          </button>
        </div>
        <form className="duration-form" onSubmit={apply} noValidate>
          <label htmlFor="minutes">
            Session length <span className="footnote">(1–180 minutes)</span>
          </label>
          <div>
            <input
              id="minutes"
              type="number"
              min="1"
              max="180"
              step="1"
              value={minutes}
              disabled={running}
              onChange={(event) => setMinutes(event.target.value)}
            />
            <button className="secondary" disabled={running}>
              Set duration
            </button>
          </div>
        </form>
      </div>
      <p className="local-note">
        Browser-local: the timer uses this device’s clock and continues while
        the tab is in the background. Keep this page open; reloading or leaving
        resets it. No session history is saved or sent anywhere. No sound or
        system notifications.
      </p>
    </>
  );
}
