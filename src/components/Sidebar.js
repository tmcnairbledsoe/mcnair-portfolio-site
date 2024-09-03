import React from "react";
import { Link } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { roleMapping } from "../authConfig";
import mbcLogo from '../assets/mbc.png';

const Sidebar = ({ sidebarVisible, handleMouseEnter, handleMouseLeave }) => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims.roles || [];

  const availableLinks = roles.reduce((links, role) => {
    return [...links, ...roleMapping[role]];
  }, []);

  return (
    <div
      style={{
        backgroundColor: "black",
        color: "white",
        width: sidebarVisible ? "150px" : "50px",
        padding: "20px",
        boxSizing: "border-box",
        borderRight: "2px solid white",
        transition: "width 0.3s ease",
        overflow: "hidden",
        whiteSpace: "nowrap",
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: sidebarVisible ? "flex-start" : "center",
        top: 0,
        left: 0,
        position: "fixed",
        height: "100vh"

      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div>
        {/* Hamburger Menu Icon */}
        {!sidebarVisible && (
          <div style={{ cursor: "pointer" }}>
            <img 
              src={mbcLogo} 
              alt="logo" 
              style={{ width: "24px", height: "24px" }} // Same size as the hamburger icon
              onClick={handleMouseEnter} // Trigger sidebar opening
            />
          </div>
        )}

        {/* Sidebar Content */}
        {sidebarVisible && (
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <img 
                src={mbcLogo} 
                alt="logo" 
                style={{ width: "80px", height: "auto" }} // Adjust size as needed for expanded sidebar
              />
            </div>
            <h1 style={{ fontWeight: "bold", fontSize: "24px", marginBottom: "20px", color: "white", textAlign: "left" }}>Links</h1>
            <nav>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                <li>
                  <Link to="/" style={{ color: "white", textDecoration: "none" }}>Home</Link>
                </li>
                <li>
                  <Link to="/resume" style={{ color: "white", textDecoration: "none" }}>Resume</Link>
                </li>
                <li>
                  <Link to="/projects" style={{ color: "white", textDecoration: "none" }}>Projects</Link>
                </li>
                <li>
                  <Link to="/interests" style={{ color: "white", textDecoration: "none" }}>Interests</Link>
                </li>
                <li>
                  <Link to="/blog" style={{ color: "white", textDecoration: "none" }}>Blog</Link>
                </li>
                <li>
                  <Link to="/drawing" style={{ color: "white", textDecoration: "none" }}>Drawing Page</Link>
                </li>
                {availableLinks.includes("Calendar") && (
                  <li>
                    <Link to="/calendar" style={{ color: "white", textDecoration: "none" }}>Calendar</Link>
                  </li>
                )}
                {availableLinks.includes("Journal") && (
                  <li>
                    <Link to="/journal" style={{ color: "white", textDecoration: "none" }}>Journal</Link>
                  </li>
                )}
                {!account && (
                  <li>
                    <Link to="/login" style={{ color: "white", textDecoration: "none" }}>Login</Link>
                  </li>
                )}
                <li>
                    {/* Social Media Icons */}
                    {sidebarVisible && (
                    <div style={{ textAlign: "center", marginTop: "20px" }}>
                        <a
                          href="https://mail.google.com/mail/?view=cm&fs=1&to=tmcnairbledsoe@gmail.com"
                          style={{ color: "white", textDecoration: "none", marginRight: "10px" }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i className="fas fa-envelope" style={{ fontSize: "20px" }}></i>
                        </a>
                        <a
                        href="https://www.linkedin.com/in/thomas-bledsoe-a1272928a/"
                        style={{ color: "white", textDecoration: "none", marginRight: "10px" }}
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                        <i className="fab fa-linkedin" style={{ fontSize: "20px" }}></i>
                        </a>
                        <a
                        href="https://github.com/tmcnairbledsoe"
                        style={{ color: "white", textDecoration: "none" }}
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                        <i className="fab fa-github" style={{ fontSize: "20px" }}></i>
                        </a>
                    </div>
                    )}
                </li>
              </ul>
            </nav>
          </>
        )}
      </div>
      </div>
  );
};

export default Sidebar;
