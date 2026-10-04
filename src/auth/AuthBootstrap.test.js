import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthBootstrap, useAuthStartup } from "./AuthBootstrap";
import { getAuthConfig, startAuthentication } from "./config";

jest.mock("./config", () => ({
  getAuthConfig: jest.fn(),
  startAuthentication: jest.fn(),
  recognizedRoles: jest.requireActual("./config").recognizedRoles,
}));
jest.mock("@azure/msal-react", () => ({
  MsalProvider: ({ children }) => children,
  useMsal: () => ({ instance: { getActiveAccount: () => null }, accounts: [] }),
}));

function Probe() {
  const { status, retry } = useAuthStartup();
  return (
    <>
      <p>{status}</p>
      <button onClick={retry}>Retry test</button>
    </>
  );
}

beforeEach(() => jest.resetAllMocks());

test("missing configuration leaves public pages available with an explanation", async () => {
  getAuthConfig.mockReturnValue(null);
  render(
    <AuthBootstrap>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </AuthBootstrap>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
  expect(await screen.findByText(/Sign-in is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Projects", exact: true }),
  ).toHaveAttribute("href", "/projects");
  expect(
    screen.queryByRole("button", { name: "Sign in with Microsoft" }),
  ).not.toBeInTheDocument();
  expect(startAuthentication).not.toHaveBeenCalled();
});

test("startup/redirect error cannot prevent public content and offers a retry", async () => {
  getAuthConfig.mockReturnValue({});
  startAuthentication.mockRejectedValue(new Error("mock failure"));
  render(
    <AuthBootstrap>
      <MemoryRouter initialEntries={["/projects"]}>
        <App />
      </MemoryRouter>
    </AuthBootstrap>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Could not prepare sign-in/,
  );
  expect(
    screen.getByRole("heading", { name: "Revit Add-in" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry sign-in setup" }));
  await waitFor(() => expect(startAuthentication).toHaveBeenCalledTimes(2));
  expect(
    screen.getByRole("heading", { name: "Revit Add-in" }),
  ).toBeInTheDocument();
});

test("bootstrap stays nonblocking while pending and recovers after failed setup", async () => {
  getAuthConfig.mockReturnValue({});
  let reject;
  startAuthentication
    .mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValueOnce({});
  render(
    <AuthBootstrap>
      <p>Public content</p>
      <Probe />
    </AuthBootstrap>,
  );
  expect(screen.getByText("Public content")).toBeInTheDocument();
  expect(screen.getByText("starting")).toBeInTheDocument();
  reject(new Error("mock failure"));
  expect(await screen.findByText("failed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry test" }));
  expect(await screen.findByText("ready")).toBeInTheDocument();
});
