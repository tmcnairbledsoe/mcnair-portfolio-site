import { PublicClientApplication } from "@azure/msal-browser";
import { getAuthConfig, loginRequest, recognizedRoles, startAuthentication } from "./config";

jest.mock("@azure/msal-browser", () => ({
  BrowserCacheLocation: { SessionStorage: "sessionStorage" },
  PublicClientApplication: jest.fn(),
}));

// Synthetic IDs for mocked tests only, unrelated to any deployed application.
const clientId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";

test("configuration uses tenant authority, origin root callback, session cache and OIDC scopes only", () => {
  const config = getAuthConfig(clientId, tenantId);
  expect(config.auth).toEqual({
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: `${window.location.origin}/`,
    postLogoutRedirectUri: `${window.location.origin}/`,
    navigateToLoginRequestUrl: false,
  });
  expect(config.cache.cacheLocation).toBe("sessionStorage");
  expect(config.system.loggerOptions.piiLoggingEnabled).toBe(false);
  expect(loginRequest.scopes).toEqual(["openid", "profile", "email"]);
});

test.each([
  ["", tenantId], [clientId, ""], ["not-a-guid", tenantId], [clientId, "common"],
])("missing or malformed IDs disable authentication", (client, tenant) => {
  expect(getAuthConfig(client, tenant)).toBeNull();
});

test("recognized roles come solely from exact account ID token claims", () => {
  expect(recognizedRoles({ username: "owner@example.invalid", roles: ["OwnerRole"] })).toEqual([]);
  expect(recognizedRoles({ idTokenClaims: { roles: "OwnerRole" } })).toEqual([]);
  expect(recognizedRoles({ idTokenClaims: { roles: ["ownerrole", "OtherRole"] } })).toEqual([]);
  expect(recognizedRoles({ idTokenClaims: { roles: ["FriendRole", "OwnerRole", "WifeRole", "OwnerRole"] } }))
    .toEqual(["Owner", "Wife", "Friend"]);
});

test("startup failure can retry, initialization precedes redirect and concurrent starts share one instance", async () => {
  const sequence = [];
  const account = { homeAccountId: "redirect-account" };
  const failed = { initialize: jest.fn().mockRejectedValue(new Error("mock startup failure")) };
  const redirectFailed = {
    initialize: jest.fn().mockResolvedValue(),
    handleRedirectPromise: jest.fn().mockRejectedValue(new Error("mock redirect failure")),
  };
  const instance = {
    initialize: jest.fn(async () => { sequence.push("initialize"); }),
    handleRedirectPromise: jest.fn(async () => { sequence.push("redirect"); return { account }; }),
    setActiveAccount: jest.fn(),
  };
  PublicClientApplication.mockImplementationOnce(() => failed)
    .mockImplementationOnce(() => redirectFailed).mockImplementationOnce(() => instance);
  const config = getAuthConfig(clientId, tenantId);
  await expect(startAuthentication(config)).rejects.toThrow("mock startup failure");
  await expect(startAuthentication(config)).rejects.toThrow("mock redirect failure");
  const first = startAuthentication(config);
  expect(startAuthentication(config)).toBe(first);
  await expect(first).resolves.toBe(instance);
  expect(sequence).toEqual(["initialize", "redirect"]);
  expect(instance.setActiveAccount).toHaveBeenCalledWith(account);
  expect(PublicClientApplication).toHaveBeenCalledTimes(3);
});
