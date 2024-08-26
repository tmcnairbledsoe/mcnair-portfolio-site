import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const PixelDrop = () => {
  const [pixels, setPixels] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const newPixel = {
        id: Date.now(),
        left: Math.random() * window.innerWidth,
        top: window.innerHeight,
        speed: Math.random() * 2 + 1,
      };

      setPixels((prevPixels) => [...prevPixels, newPixel]);

      setPixels((prevPixels) =>
        prevPixels.filter((pixel) => pixel.top > 0)
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const animationInterval = setInterval(() => {
      setPixels((prevPixels) =>
        prevPixels.map((pixel) => ({
          ...pixel,
          top: pixel.top - pixel.speed,
          speed: pixel.speed + 0.1,
        }))
      );
    }, 16);

    return () => clearInterval(animationInterval);
  }, []);

  const handleMouseEnter = () => {
    setSidebarVisible(true);
  };

  const handleMouseLeave = () => {
    setSidebarVisible(false);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <div
        style={{
          backgroundColor: "black",
          color: "white",
          width: sidebarVisible ? "250px" : "50px",
          padding: "20px",
          boxSizing: "border-box",
          borderRight: "2px solid white",
          transition: "width 0.3s ease",
          overflow: "hidden",
          whiteSpace: "nowrap",
          zIndex: 3,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <h1 style={{ fontWeight: "bold", fontSize: "24px", display: sidebarVisible ? "block" : "none" }}>My Portfolio</h1>
        <nav>
          <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
            <li>
              <Link
                to="/"
                style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
              >
                {sidebarVisible ? "Home" : "H"}
              </Link>
            </li>
            <li>
              <Link
                to="/resume"
                style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
              >
                {sidebarVisible ? "Resume" : "R"}
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
              >
                {sidebarVisible ? "Projects" : "P"}
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                style={{ color: "white", textDecoration: "none", fontSize: "18px" }}
              >
                {sidebarVisible ? "Contact" : "C"}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Pixel drop background */}
      <div
        style={{
          backgroundColor: "black",
          width: "100%",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          zIndex: 1, // Set z-index lower than content area
        }}
      >
        {pixels.map((pixel) => (
          <div
            key={pixel.id}
            style={{
              position: "absolute",
              width: "2px",
              height: "2px",
              backgroundColor: "white",
              left: `${pixel.left}px`,
              top: `${pixel.top}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PixelDrop;
