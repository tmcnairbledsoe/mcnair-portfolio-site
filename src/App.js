import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Resume from "./components/Resume";
import Drawing from "./components/Drawing";
import FocusTimer from "./components/FocusTimer";
import Home from "./components/Home";
import Projects from "./components/Projects";
import Interests from "./components/Interests";
import PageHeading from "./components/PageHeading";
import Sidebar from "./components/Sidebar";
import PixelDrop from "./components/PixelDrop";

const titles = {
  "/": "Home",
  "/resume": "Résumé",
  "/projects": "Projects",
  "/interests": "Interests",
  "/tools": "Browser tools",
  "/drawing": "Sketchpad",
  "/drawingpage": "Sketchpad",
  "/focus": "Focus timer",
};
function Tools() {
  return (
    <>
      <PageHeading
        eyebrow="The browser workbench"
        title="A little space to make things."
      >
        Two simple tools for a creative pause or a focused session. No account
        needed, and your work stays on your device.
      </PageHeading>
      <div className="card-grid">
        <article className="project-card">
          <p className="eyebrow">01 / Create</p>
          <h2>Sketchpad</h2>
          <p>
            Choose a color, draw with your mouse, pen, touch, or keyboard, and
            download a PNG. Your drawing stays in this tab until you leave.
          </p>
          <Link className="text-link" to="/drawing">
            Open sketchpad →
          </Link>
        </article>
        <article className="project-card">
          <p className="eyebrow">02 / Concentrate</p>
          <h2>Focus timer</h2>
          <p>
            Set a session length, start, pause, and reset. The timer runs in
            this tab and keeps time even when the tab is in the background.
          </p>
          <Link className="text-link" to="/focus">
            Open focus timer →
          </Link>
        </article>
      </div>
      <div className="local-note">
        Browser-local by design. Nothing you draw or time is sent to a server.
        Reloading or leaving a tool resets it.
      </div>
    </>
  );
}
function NotFound() {
  return (
    <>
      <PageHeading eyebrow="404 / Page not found" title="That page isn’t here.">
        The address may be out of date. Find your way back to the portfolio.
      </PageHeading>
      <Link className="button" to="/">
        Back to home →
      </Link>
    </>
  );
}
export default function App() {
  const [expanded, setExpanded] = useState(false);
  const { pathname: rawPath } = useLocation();
  const pathname = rawPath.replace(/\/+$/, "") || "/";
  const main = useRef(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    document.title = `${titles[pathname] || "Page not found"} · Thomas McNair Bledsoe`;
    if (previousPath.current !== pathname) {
      main.current?.focus();
      window.scrollTo(0, 0);
      previousPath.current = pathname;
    }
  }, [pathname]);
  return (
    <div className={`site-shell ${expanded ? "sidebar-open" : ""}`}>
      <PixelDrop />
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/interests" element={<Interests />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/drawing" element={<Drawing />} />
          <Route path="/drawingpage" element={<Drawing />} />
          <Route path="/focus" element={<FocusTimer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

    </div>
  );
}
