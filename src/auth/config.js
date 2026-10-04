import {
  BrowserCacheLocation,
  PublicClientApplication,
} from "@azure/msal-browser";

export const loginRequest = { scopes: ["openid", "profile", "email"] };
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getAuthConfig(
  clientId = process.env.REACT_APP_AZURE_AD_CLIENT_ID,
  tenantId = process.env.REACT_APP_AZURE_AD_TENANT_ID,
) {
  if (!guid.test(clientId || "") || !guid.test(tenantId || "")) return null;
  const redirectUri = `${window.location.origin}/`;
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
      // The root is the registered callback; do not replay a page/hash from before login.
      navigateToLoginRequestUrl: false,
    },
    cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
    system: {
      loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false },
    },
  };
}

// Share initialization across StrictMode effects. A rejected start can be retried.
let startup;
export function startAuthentication(config) {
  if (!startup) {
    startup = (async () => {
      const instance = new PublicClientApplication(config);
      await instance.initialize();
      const response = await instance.handleRedirectPromise();
      const account =
        response?.account ||
        instance.getActiveAccount() ||
        instance.getAllAccounts()[0];
      if (account) instance.setActiveAccount(account);
      return instance;
    })().catch((error) => {
      startup = undefined;
      throw error;
    });
  }
  return startup;
}

const roleLabels = {
  OwnerRole: "Owner",
  WifeRole: "Wife",
  FriendRole: "Friend",
};
export function recognizedRoles(account) {
  const roles = account?.idTokenClaims?.roles;
  return Array.isArray(roles)
    ? Object.keys(roleLabels)
        .filter((role) => roles.includes(role))
        .map((role) => roleLabels[role])
    : [];
}
