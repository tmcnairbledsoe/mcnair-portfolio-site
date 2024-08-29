import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig"; // Your MSAL configuration
import PixelDrop from "./components/PixelDrop";
import Resume from "./components/Resume";
import Projects from "./components/Projects";
import Interests from "./components/Interests";
import Home from "./components/Home";
import Login from "./components/Login";
import Calendar from "./components/Calendar";
import Journal from "./components/Journal";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";

// Initialize MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

function App() {
  const [sidebarWidth, setSidebarWidth] = useState("50px");

  const handleSidebarToggle = (width) => {
    setSidebarWidth(width);
  };

  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <div style={{ position: "relative", height: "100vh" }}>
          <PixelDrop onSidebarToggle={handleSidebarToggle} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: window.innerWidth >= 769 ? sidebarWidth : 20,
              width: window.innerWidth >= 769 ? `calc(100% - ${sidebarWidth})` : `calc(100% - 20)`,
              zIndex: 2, // Ensures this content is above the pixel drop animation
              color: "#bfbfbf", // White text
              padding: "20px",
              transition: "left 0.3s ease, width 0.3s ease",
            }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/resume" element={<Resume />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/interests" element={<Interests />} />
              <Route path="/login" element={<Login />} />
              <Route path="/calendar" element={<ProtectedRoute roles={['OwnerRole', 'WifeRole']} element={<Calendar />} />} />
              <Route path="/journal" element={<ProtectedRoute roles={['OwnerRole']} element={<Journal />} />} />
            </Routes>
          </div>
        </div>
      </Router>
    </MsalProvider>
  );
}

export default App;
