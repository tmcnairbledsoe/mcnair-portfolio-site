import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InfinityChat from "./InfinityChat";
import { useContentSession } from "../auth/ContentSession";

jest.mock("../auth/ContentSession", () => ({ useContentSession: jest.fn() }));

const owner = { idTokenClaims: { roles: ["OwnerRole"] } };
const token = jest.fn(async () => "token");
const session = (account) => ({ account, accountKey: account ? "owner" : "public", ready: true, token, signIn: jest.fn() });

function respond(payload, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => payload });
}
function body(messages, relay) {
  return { messages, relay: relay ?? { configured: true, lastSeenAt: new Date().toISOString() }, serverTime: new Date().toISOString() };
}

let fetchMock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  token.mockClear();
});
afterEach(() => { jest.restoreAllMocks(); });

test("non-owners never see the conversation or a composer", async () => {
  for (const account of [null, { idTokenClaims: { roles: ["WifeRole"] } }, { idTokenClaims: { roles: ["FriendRole"] } }]) {
    useContentSession.mockReturnValue(session(account));
    const view = render(<MemoryRouter><InfinityChat /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Commander" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Message Commander")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    view.unmount();
  }
});

test("owner sees the thread, its state, and a connected home PC", async () => {
  useContentSession.mockReturnValue(session(owner));
  const now = new Date().toISOString();
  fetchMock.mockImplementation((url) => {
    expect(url).toMatch(/^\/api\/infinity\/messages\?after=0$/);
    return respond(body(
      [
        { id: "a", seq: 1, role: "user", body: "What is on my calendar?", state: "answered", createdAt: now },
        { id: "b", seq: 2, role: "assistant", body: "Two meetings on Thursday.", state: "answered", replyTo: "a", createdAt: now },
      ],
    ));
  });
  render(<MemoryRouter><InfinityChat /></MemoryRouter>);
  expect(await screen.findByText("What is on my calendar?")).toBeInTheDocument();
  expect(screen.getByText("Two meetings on Thursday.")).toBeInTheDocument();
  expect(screen.getByText(/Home PC connected/)).toBeInTheDocument();
  expect(screen.getByLabelText("Message Commander")).toBeInTheDocument();
  expect(token).toHaveBeenCalled();
});

test("a queued prompt explains that it waits for the home PC", async () => {
  useContentSession.mockReturnValue(session(owner));
  fetchMock.mockImplementation(() => respond(body([
    { id: "a", seq: 1, role: "user", body: "Start the audit.", state: "queued", createdAt: new Date().toISOString() },
  ], { configured: true, lastSeenAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() })));
  render(<MemoryRouter><InfinityChat /></MemoryRouter>);
  expect(await screen.findByText("Start the audit.")).toBeInTheDocument();
  expect(screen.getByText(/Queued for your home PC/)).toBeInTheDocument();
  expect(screen.getByText(/Home PC not connected/)).toBeInTheDocument();
});

test("sending posts once and then shows the new turn", async () => {
  useContentSession.mockReturnValue(session(owner));
  const now = new Date().toISOString();
  let posted = false;
  fetchMock.mockImplementation((url, options = {}) => {
    if (options.method === "POST") {
      posted = true;
      expect(JSON.parse(options.body).text).toBe("Summarize my week.");
      return respond({ accepted: true, id: "x" });
    }
    return respond(body(posted ? [
      { id: "x", seq: 1, role: "user", body: "Summarize my week.", state: "working", createdAt: now },
    ] : []));
  });
  render(<MemoryRouter><InfinityChat /></MemoryRouter>);
  const box = await screen.findByLabelText("Message Commander");
  fireEvent.change(box, { target: { value: "  Summarize my week.  " } });
  await act(async () => { fireEvent.submit(box.closest("form")); });
  expect(await screen.findByText("Summarize my week.")).toBeInTheDocument();
  expect(screen.getByText(/Commander is working on this/)).toBeInTheDocument();
  expect(box).toHaveValue("");
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

test("the page explains a server problem instead of showing raw errors", async () => {
  useContentSession.mockReturnValue(session(owner));
  fetchMock.mockImplementation(() => respond({ error: "SECRET" }, 503));
  render(<MemoryRouter><InfinityChat /></MemoryRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent(/not available right now/);
  expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
});
