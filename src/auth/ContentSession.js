import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";
import { useMsal } from "@azure/msal-react";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";
import { getAuthConfig, recognizedRoles } from "./config";

const SessionContext = createContext({
  account: null,
  accountKey: "public",
  ready: false,
  journalAllowed: false,
});
export const useContentSession = () => useContext(SessionContext);
export function ContentSession({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const account =
    instance.getActiveAccount() ||
    (instance.getAllAccounts ? instance.getAllAccounts()[0] : accounts[0]) ||
    null;
  // Active-account changes can leave MSAL's accounts array unchanged. Subscribe
  // to SDK events directly so the private subtree also clears on that switch.
  const subscribe = useCallback(
    (notify) => {
      const callback = instance.addEventCallback?.(notify);
      return () => {
        if (callback) instance.removeEventCallback(callback);
      };
    },
    [instance],
  );
  const snapshot = useCallback(() => {
    const current =
      instance.getActiveAccount() ||
      (instance.getAllAccounts ? instance.getAllAccounts()[0] : accounts[0]);
    return current
      ? `${current.homeAccountId}:${current.localAccountId}:${recognizedRoles(current).join(",")}`
      : "public";
  }, [instance, accounts]);
  const accountKey = useSyncExternalStore(subscribe, snapshot, snapshot);
  const current = useRef(accountKey);
  current.current = accountKey;
  const scope = `api://${getAuthConfig()?.auth?.clientId}/access_as_user`;
  const token = useCallback(async () => {
    if (!account || inProgress !== InteractionStatus.None)
      throw new Error("Sign in to continue, or wait for sign-in to finish.");
    const key = accountKey;
    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: [scope],
      });
      const active =
        instance.getActiveAccount() || instance.getAllAccounts?.()[0];
      if (
        current.current !== key ||
        result.account?.homeAccountId !== account.homeAccountId ||
        result.account?.localAccountId !== account.localAccountId ||
        active?.homeAccountId !== account.homeAccountId ||
        active?.localAccountId !== account.localAccountId ||
        !result.accessToken
      )
        throw new Error("account changed");
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError)
        throw new Error(
          "Your API session needs sign-in again. Use Sign in again to grant access.",
        );
      throw new Error(
        "Could not acquire access for this account. Please retry or sign in again.",
      );
    }
  }, [account, accountKey, instance, inProgress, scope]);
  const signIn = useCallback(
    () => instance.loginRedirect({ scopes: [scope] }),
    [instance, scope],
  );
  return (
    <SessionContext.Provider
      value={{
        account,
        accountKey,
        ready: inProgress === InteractionStatus.None,
        journalAllowed: recognizedRoles(account).length > 0,
        token,
        signIn,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
