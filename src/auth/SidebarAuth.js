import React, { useEffect, useRef, useState } from "react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { useAuthStartup } from "./AuthBootstrap";
import { loginRequest, recognizedRoles } from "./config";

function AccountControls() {
  const { instance, accounts, inProgress } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];
  const accountRef = useRef(account);
  accountRef.current = account;
  const accountId = account?.homeAccountId;
  const [operation, setOperation] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [renewedAccount, setRenewedAccount] = useState(null);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const busy = operation || inProgress !== InteractionStatus.None;

  useEffect(() => {
    const account = accountRef.current;
    if (!account || inProgress !== InteractionStatus.None) return;
    let current = true;
    let renewing = false;
    let latestAccount = account;
    let reauthenticationRequired = false;
    async function renew(force = false) {
      const expiry = latestAccount.idTokenClaims?.exp;
      if (renewing || reauthenticationRequired || (!force && expiry && expiry * 1000 > Date.now() + 300000)) return;
      renewing = true;
      setOperation(true);
      try {
        const result = await instance.acquireTokenSilent({ ...loginRequest, account: latestAccount, forceRefresh: true });
        if (!result.account || result.account.homeAccountId !== account.homeAccountId) {
          throw new Error("MSAL renewal did not return the current account");
        }
        if (current) {
          // Display claims only from the MSAL AccountInfo, never decode a token ourselves.
          latestAccount = result.account;
          instance.setActiveAccount(result.account);
          setRenewedAccount(result.account);
          setNeedsLogin(false);
          setError("");
        }
      } catch (failure) {
        if (current) {
          reauthenticationRequired = failure instanceof InteractionRequiredAuthError;
          setNeedsLogin(reauthenticationRequired);
          setError(reauthenticationRequired
            ? "Your session needs sign-in again to refresh roles."
            : "Could not refresh account roles. Please retry.");
        }
      } finally {
        renewing = false;
        if (current) setOperation(false);
      }
    }
    renew(true);
    const onFocus = () => renew();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => {
      current = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
    // Account identity, not object identity: MSAL publishes new objects on renewal.
  }, [instance, accountId, inProgress, refreshAttempt]);

  async function redirect(signOut) {
    if (busy) return;
    setOperation(true);
    setError("");
    try {
      if (signOut) await instance.logoutRedirect({ account });
      else await instance.loginRedirect(loginRequest);
    } catch (failure) {
      setError(failure?.errorCode === "user_cancelled"
        ? "Sign-in was cancelled. You can try again."
        : `Could not ${signOut ? "sign out" : "sign in"}. Please retry.`);
    } finally {
      setOperation(false);
    }
  }

  const displayAccount = renewedAccount?.homeAccountId === account?.homeAccountId ? renewedAccount : account;
  const roles = recognizedRoles(displayAccount);
  const expired = !displayAccount?.idTokenClaims?.exp || displayAccount.idTokenClaims.exp * 1000 <= Date.now();
  return (
    <>
      {account ? <>
        <p>{account.name || "Microsoft account"}</p>
        <p>{needsLogin || error || expired ? "Roles unavailable until your session is refreshed."
          : roles.length ? `Roles: ${roles.join(", ")}` : "No assigned role."}</p>
        {(needsLogin || error || expired) && <button disabled={busy} onClick={() => redirect(false)}>Sign in again</button>}
        <button disabled={busy} onClick={() => redirect(true)}>Sign out</button>
      </> : <button disabled={busy} onClick={() => redirect(false)}>Sign in with Microsoft</button>}
      {busy && <p role="status">Please wait…</p>}
      {error && <>
        <p role="alert">{error}</p>
        {account && !needsLogin && <button disabled={busy} onClick={() => setRefreshAttempt((value) => value + 1)}>Retry role refresh</button>}
      </>}
    </>
  );
}

export default function SidebarAuth() {
  const { status, instance, retry } = useAuthStartup();
  return (
    <section className="sidebar-auth" aria-label="Microsoft account">
      <h2>Account</h2>
      {status === "unavailable" && <p>Sign-in is unavailable: public Entra client and tenant IDs are missing or invalid. Public pages remain available.</p>}
      {status === "starting" && <><button disabled>Sign in with Microsoft</button><p role="status">Preparing sign-in…</p></>}
      {status === "failed" && <><p role="alert">Could not prepare sign-in or complete the login response. Please retry.</p><button onClick={retry}>Retry sign-in setup</button></>}
      {status === "ready" && <MsalProvider instance={instance}><AccountControls /></MsalProvider>}
    </section>
  );
}
