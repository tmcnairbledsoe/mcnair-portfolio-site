import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useMsal } from "@azure/msal-react";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";
import { ContentSession, useContentSession } from "./ContentSession";
import { getAuthConfig } from "./config";
jest.mock("@azure/msal-react", () => ({ useMsal: jest.fn() }));
jest.mock("./config", () => ({
  getAuthConfig: jest.fn(),
  recognizedRoles: jest.requireActual("./config").recognizedRoles,
}));
let instance, account;
function Probe() {
  const { token, signIn, accountKey } = useContentSession();
  const [result, setResult] = React.useState("");
  return (
    <>
      <p>{accountKey}</p>
      <p>{result}</p>
      <button
        onClick={() => token().then(setResult, (e) => setResult(e.message))}
      >
        Token
      </button>
      <button onClick={signIn}>Sign in again</button>
    </>
  );
}
beforeEach(() => {
  account = { homeAccountId: "A", localAccountId: "oidA" };
  instance = {
    getActiveAccount: jest.fn(() => account),
    acquireTokenSilent: jest
      .fn()
      .mockImplementation(async () => ({
        account,
        accessToken: "scoped-access",
      })),
    loginRedirect: jest.fn(),
  };
  useMsal.mockImplementation(() => ({
    instance,
    accounts: [account],
    inProgress: InteractionStatus.None,
  }));
  getAuthConfig.mockReturnValue({
    auth: { clientId: "22222222-2222-4222-8222-222222222222" },
  });
});
test("requests API scope for current account silently and verifies returned account identity", async () => {
  render(
    <ContentSession>
      <Probe />
    </ContentSession>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Token" }));
  expect(await screen.findByText("scoped-access")).toBeInTheDocument();
  expect(instance.acquireTokenSilent).toHaveBeenCalledWith({
    account,
    scopes: ["api://22222222-2222-4222-8222-222222222222/access_as_user"],
  });
  instance.acquireTokenSilent.mockResolvedValueOnce({
    account: { homeAccountId: "B", localAccountId: "oidB" },
    accessToken: "wrong-account",
  });
  fireEvent.click(screen.getByRole("button", { name: "Token" }));
  expect(
    await screen.findByText(/Could not acquire access/),
  ).toBeInTheDocument();
  expect(screen.queryByText("wrong-account")).not.toBeInTheDocument();
});
test("interaction required never opens popup/redirect automatically and explicit sign in requests delegated API consent", async () => {
  instance.acquireTokenSilent.mockRejectedValue(
    new InteractionRequiredAuthError("interaction_required"),
  );
  render(
    <ContentSession>
      <Probe />
    </ContentSession>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Token" }));
  expect(
    await screen.findByText(/API session needs sign-in again/),
  ).toBeInTheDocument();
  expect(instance.loginRedirect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
  expect(instance.loginRedirect).toHaveBeenCalledWith({
    scopes: ["api://22222222-2222-4222-8222-222222222222/access_as_user"],
  });
});
test("account switches during silent acquisition reject the previous account token", async () => {
  let resolve;
  const old = account;
  instance.acquireTokenSilent.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const page = render(
    <ContentSession>
      <Probe />
    </ContentSession>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Token" }));
  account = { homeAccountId: "B", localAccountId: "oidB" };
  page.rerender(
    <ContentSession>
      <Probe />
    </ContentSession>,
  );
  await act(async () => resolve({ account: old, accessToken: "old-secret" }));
  await waitFor(() =>
    expect(screen.getByText(/Could not acquire access/)).toBeInTheDocument(),
  );
  expect(screen.queryByText("old-secret")).not.toBeInTheDocument();
});

test("SDK active-account event updates identity even when MSAL accounts array is unchanged", async () => {
  let notify;
  instance.addEventCallback = jest.fn((fn) => {
    notify = fn;
    return "subscription";
  });
  instance.removeEventCallback = jest.fn();
  const page = render(
    <ContentSession>
      <Probe />
    </ContentSession>,
  );
  expect(screen.getByText("A:oidA:")).toBeInTheDocument();
  account = { homeAccountId: "B", localAccountId: "oidB" };
  act(() => notify({ eventType: "msal:activeAccountChanged" }));
  expect(screen.getByText("B:oidB:")).toBeInTheDocument();
  expect(screen.queryByText("A:oidA:")).not.toBeInTheDocument();
  page.unmount();
  expect(instance.removeEventCallback).toHaveBeenCalledWith("subscription");
});
