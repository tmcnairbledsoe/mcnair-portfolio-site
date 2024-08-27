import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";

const PixelDrop = ({ onSidebarToggle }) => {
  const [pixels, setPixels] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [scrollHeight, setScrollHeight] = useState(window.innerHeight);

  useEffect(() => {
    const interval = setInterval(() => {
      const newPixel = {
        id: Date.now(),
        left: Math.random() * window.innerWidth,
        top: scrollHeight,
        speed: Math.random() * 2 + 1,
      };

      setPixels((prevPixels) => [...prevPixels, newPixel]);

      setPixels((prevPixels) =>
        prevPixels.filter((pixel) => pixel.top > 0)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [scrollHeight]);

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

  useEffect(() => {
    const handleScroll = () => {
      setScrollHeight(window.innerHeight + window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseEnter = () => {
    setSidebarVisible(true);
    onSidebarToggle("150px");
  };

  const handleMouseLeave = () => {
    setSidebarVisible(false);
    onSidebarToggle("50px");
  };

  return (
    <div style={{ display: "flex", height: "100vh", position: "relative" }}>
      <Sidebar
        sidebarVisible={sidebarVisible}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
      />

      {/* Pixel drop background */}
      <div
        style={{
          backgroundColor: "black",
          width: "100%",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
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
