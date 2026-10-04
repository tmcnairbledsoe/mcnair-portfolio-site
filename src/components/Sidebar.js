import React from "react";
import { NavLink } from "react-router-dom";
import mbcLogo from "../assets/mbc.png";
import SidebarAuth from "../auth/SidebarAuth";
import { useContentSession } from "../auth/ContentSession";

const links = [["/", "Home"], ["/resume", "Resume"], ["/projects", "Projects"],  ["/blog", "Blog"], ["/tools", "Browser tools"]];
export default function Sidebar({ expanded, setExpanded }) {
  const { journalAllowed } = useContentSession();
  const closeOnMobile = () => { if (window.innerWidth <= 768) setExpanded(false); };
  const hover = (open) => {
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches) setExpanded(open);
  };
  return (
    <aside className={`sidebar ${expanded ? "expanded" : ""}`} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
      <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={expanded} aria-controls="portfolio-navigation" onClick={() => setExpanded(!expanded)}>
        <img src={mbcLogo} alt="McNair Bledsoe" />
      </button>
      <div className="sidebar-content" hidden={!expanded}>
        <h2>Links</h2>
        <nav id="portfolio-navigation" aria-label="Main navigation">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} onClick={closeOnMobile}>{label}</NavLink>)}
          {journalAllowed && <NavLink to="/journal" onClick={closeOnMobile}>Journal</NavLink>}
          <NavLink to="/drawing" onClick={closeOnMobile}>Drawing Page</NavLink>
          <NavLink to="/focus" onClick={closeOnMobile}>Focus timer</NavLink>
        </nav>
        <div className="social-links">
          <a href="mailto:tmcnairbledsoe@gmail.com">Email</a>
          <a href="https://www.linkedin.com/in/thomas-bledsoe-a1272928a/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="https://github.com/tmcnairbledsoe" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <SidebarAuth />
      </div>
    </aside>
  );
}
