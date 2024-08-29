// src/components/Login.js
import React, { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../authConfig";

const Login = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    if (accounts.length > 0) {
      // If already logged in, redirect to home
      navigate("/");
    }
  }, [accounts, navigate]);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => {
      alert(e);
    });
  };

  return (
    <div>
      <h2>Login</h2>
      <button onClick={handleLogin}>Sign in with Microsoft</button>
    </div>
  );
};

export default Login;
