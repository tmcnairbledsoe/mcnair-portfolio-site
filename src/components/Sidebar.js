// components/Sidebar.js
import React from "react";
import { Link } from "react-router-dom";

const Sidebar = ({ sidebarVisible, handleMouseEnter, handleMouseLeave }) => {
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
            <i className="fas fa-bars" style={{ fontSize: "24px" }}></i>
          </div>
        )}

        {/* Sidebar Content */}
        {sidebarVisible && (
          <>
            <h1 style={{ fontWeight: "bold", fontSize: "24px", marginBottom: "20px", color: "white", textAlign: "left" }}>Links</h1>
            <nav>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                <li>
                  <Link
                    to="/"
                    style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/resume"
                    style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
                  >
                    Resume
                  </Link>
                </li>
                <li>
                  <Link
                    to="/projects"
                    style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
                  >
                    Projects
                  </Link>
                </li>
                <li>
                  <Link
                    to="/interests"
                    style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
                  >
                    Interests
                  </Link>
                </li>
                <li>
                    {/* Social Media Icons */}
                    {sidebarVisible && (
                    <div style={{ textAlign: "center", marginTop: "20px" }}>
                        <a
                        href="mailto:tmcnairbledsoe@gmail.com"
                        style={{ color: "white", textDecoration: "none", marginRight: "10px" }}
                        target="_self"
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
