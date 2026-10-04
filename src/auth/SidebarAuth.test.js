import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import SidebarAuth from "./SidebarAuth";
import { useAuthStartup } from "./AuthBootstrap";
import { loginRequest } from "./config";

jest.mock("@azure/msal-react", () => ({
  MsalProvider: ({ children }) => children,
  useMsal: jest.fn(),
}));
jest.mock("./AuthBootstrap", () => ({ useAuthStartup: jest.fn() }));

let instance;
let sdk;
function signedIn(roles) {
  const account = {
    homeAccountId: "mock-account",
    name: "Example account",
    username: "owner@example.invalid",
    idTokenClaims: { roles, exp: Math.floor(Date.now() / 1000) + 3600 },
  };
  instance.getActiveAccount.mockReturnValue(account);
  instance.acquireTokenSilent.mockResolvedValue({ account });
  sdk.accounts = [account];
  return account;
}

beforeEach(() => {
  jest.clearAllMocks();
  instance = {
    getActiveAccount: jest.fn().mockReturnValue(null),
    setActiveAccount: jest.fn(),
    loginRedirect: jest.fn().mockResolvedValue(),
    logoutRedirect: jest.fn().mockResolvedValue(),
    acquireTokenSilent: jest.fn(),
  };
  sdk = { instance, accounts: [], inProgress: InteractionStatus.None };
  useMsal.mockImplementation(() => sdk);
  useAuthStartup.mockReturnValue({ status: "ready", instance });
});

test("signed-out control signs in by redirect with OIDC scopes only", async () => {
  render(<SidebarAuth />);
  expect(screen.queryByText(/Roles:/)).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Sign in with Microsoft" }),
  );
  expect(instance.loginRedirect).toHaveBeenCalledWith(loginRequest);
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
});

test.each([
  [["OwnerRole"], "Roles: Owner"],
  [["WifeRole"], "Roles: Wife"],
  [["FriendRole"], "Roles: Friend"],
  [["UnknownRole"], "No assigned role."],
  [undefined, "No assigned role."],
  [[], "No assigned role."],
  [
    ["OwnerRole", "WifeRole", "FriendRole", "UnknownRole"],
    "Roles: Owner, Wife, Friend",
  ],
])("signed-in claims %j determine recognized roles", async (roles, label) => {
  const account = signedIn(roles);
  render(<SidebarAuth />);
  expect(screen.getByText("Example account")).toBeInTheDocument();
  expect(await screen.findByText(label)).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
  );
  expect(instance.acquireTokenSilent).toHaveBeenCalledWith({
    ...loginRequest,
    account,
    forceRefresh: true,
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(instance.logoutRedirect).toHaveBeenCalledWith({ account });
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test.each(["user_cancelled", "network_error"])(
  "login %s recovers and never exposes raw SDK details",
  async (errorCode) => {
    instance.loginRedirect.mockRejectedValueOnce({
      errorCode,
      message: "RAW_TOKEN_MUST_NOT_DISPLAY",
    });
    render(<SidebarAuth />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Microsoft" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      errorCode === "user_cancelled" ? /cancelled/ : /Please retry/,
    );
    expect(screen.queryByText(/RAW_TOKEN/)).not.toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Sign in with Microsoft",
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(instance.loginRedirect).toHaveBeenCalledTimes(2);
  },
);

test("SDK busy state and a pending local redirect prevent overlapping interactions", async () => {
  sdk.inProgress = InteractionStatus.HandleRedirect;
  const view = render(<SidebarAuth />);
  expect(
    screen.getByRole("button", { name: "Sign in with Microsoft" }),
  ).toBeDisabled();
  sdk.inProgress = InteractionStatus.None;
  let complete;
  instance.loginRedirect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  view.rerender(<SidebarAuth />);
  const button = screen.getByRole("button", { name: "Sign in with Microsoft" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(instance.loginRedirect).toHaveBeenCalledTimes(1);
  await act(async () => complete());
  expect(button).toBeEnabled();
});

test("silent renewal replaces old role claims with the returned MSAL account", async () => {
  const old = signedIn(["OwnerRole"]);
  const updated = {
    ...old,
    idTokenClaims: { ...old.idTokenClaims, roles: ["FriendRole"] },
  };
  instance.acquireTokenSilent.mockResolvedValue({ account: updated });
  render(<SidebarAuth />);
  expect(await screen.findByText("Roles: Friend")).toBeInTheDocument();
  expect(screen.queryByText("Roles: Owner")).not.toBeInTheDocument();
  expect(instance.setActiveAccount).toHaveBeenCalledWith(updated);
});

test("interaction-required renewal suppresses roles and explicitly offers redirect reauthentication", async () => {
  signedIn(["OwnerRole"]);
  instance.acquireTokenSilent.mockRejectedValue(
    new InteractionRequiredAuthError("interaction_required"),
  );
  render(<SidebarAuth />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /session needs sign-in again/,
  );
  expect(screen.queryByText("Roles: Owner")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Retry role refresh" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
  await waitFor(() =>
    expect(instance.loginRedirect).toHaveBeenCalledWith(loginRequest),
  );
});

test("transient renewal failure offers retry and recovers recognized roles", async () => {
  signedIn(["WifeRole"]);
  instance.acquireTokenSilent.mockRejectedValueOnce(
    new Error("mock network failure"),
  );
  render(<SidebarAuth />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Could not refresh/,
  );
  expect(screen.queryByText("Roles: Wife")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry role refresh" }));
  expect(await screen.findByText("Roles: Wife")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(2);
});

test("logout error is retryable", async () => {
  signedIn(["FriendRole"]);
  instance.logoutRedirect.mockRejectedValueOnce(
    new Error("mock logout failure"),
  );
  render(<SidebarAuth />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Could not sign out/,
  );
  const button = screen.getByRole("button", { name: "Sign out" });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(instance.logoutRedirect).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
});

test.each([
  null,
  {
    homeAccountId: "different-account",
    idTokenClaims: { roles: ["OwnerRole"] },
  },
])(
  "renewal must return the current MSAL account: %j",
  async (returnedAccount) => {
    signedIn(["FriendRole"]);
    instance.acquireTokenSilent.mockResolvedValueOnce({
      account: returnedAccount,
    });
    render(<SidebarAuth />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Could not refresh/,
    );
    expect(screen.queryByText(/Roles:/)).not.toBeInTheDocument();
    expect(instance.setActiveAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry role refresh" }));
    expect(await screen.findByText("Roles: Friend")).toBeInTheDocument();
  },
);

test("near-expiry focus renews claims silently and unmount cleans up listeners", async () => {
  const account = signedIn(["OwnerRole"]);
  const view = render(<SidebarAuth />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
  );
  fireEvent.focus(window);
  expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(1);
  account.idTokenClaims.exp = Math.floor(Date.now() / 1000) + 30;
  fireEvent.focus(window);
  await waitFor(() =>
    expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(2),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
  );
  view.unmount();
  fireEvent.focus(window);
  expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(2);
});
