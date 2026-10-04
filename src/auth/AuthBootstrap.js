import React, { createContext, useContext, useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { ContentSession } from "./ContentSession";
import { getAuthConfig, startAuthentication } from "./config";

const unavailable = { status: "unavailable" };
const AuthContext = createContext(unavailable);
export const useAuthStartup = () => useContext(AuthContext);

export function AuthBootstrap({ children }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "starting" });
  useEffect(() => {
    let current = true;
    const config = getAuthConfig();
    if (!config) {
      setState(unavailable);
      return;
    }
    setState({ status: "starting" });
    startAuthentication(config).then(
      (instance) => {
        if (current) setState({ status: "ready", instance });
      },
      () => {
        if (current) setState({ status: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);
  return (
    <AuthContext.Provider
      value={{ ...state, retry: () => setAttempt((value) => value + 1) }}
    >
      {state.status === "ready" ? (
        <MsalProvider instance={state.instance}>
          <ContentSession>{children}</ContentSession>
        </MsalProvider>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
