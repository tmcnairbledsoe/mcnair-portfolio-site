import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PixelDrop from "./components/PixelDrop";
import Resume from "./components/Resume";
import Projects from "./components/Projects";
import Contact from "./components/Contact";
import Home from "./components/Home";

function App() {
  return (
    <Router>
      <div style={{ position: "relative", height: "100vh" }}>
        <PixelDrop />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 2, // Ensures this content is above the pixel drop animation
            color: "white", // White text
            padding: "20px",
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
