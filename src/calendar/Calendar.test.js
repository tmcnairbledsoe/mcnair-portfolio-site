import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Calendar from "./Calendar";
import { useContentSession } from "../auth/ContentSession";
jest.mock("../auth/ContentSession", () => ({ useContentSession: jest.fn() }));
const account = (roles) => ({ idTokenClaims: { roles } });
const today = new Date();
const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const entry = {
  id: "one",
  version: 1,
  title: "Appointment",
  kind: "event",
  day,
  member: "wife",
  startTime: "09:00",
  endTime: "10:30",
  completed: false,
  reminderAt: null,
  remindTo: null,
  reminders: [],
};
beforeEach(() => {
  useContentSession.mockReturnValue({
    account: account(["OwnerRole"]),
    accountKey: "owner",
    ready: true,
    token: jest.fn(async () => "api-token"),
  });
  global.fetch = jest.fn(async (url, options) => ({
    ok: true,
    json: async () =>
      options.method
        ? { ...entry, ...JSON.parse(options.body) }
        : { items: [entry], emailReady: true },
  }));
});
afterEach(() => {
  delete global.fetch;
});
test("calendar waits for Microsoft session restoration before requesting private data", async () => {
  const session = useContentSession();
  useContentSession.mockReturnValue({ ...session, ready: false });
  const view = render(<Calendar />);
  expect(fetch).not.toHaveBeenCalled();
  expect(session.token).not.toHaveBeenCalled();
  useContentSession.mockReturnValue({ ...session, ready: true });
  view.rerender(<Calendar />);
  await screen.findByRole("button", { name: "Edit" });
  expect(session.token).toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
test.each([[[]], [["FriendRole"]]])(
  "calendar hides private data and makes no request without Owner/Wife role: %j",
  (roles) => {
    useContentSession.mockReturnValue({
      account: account(roles),
      accountKey: "friend",
      ready: true,
    });
    render(<Calendar />);
    expect(
      screen.getByText(/only available to Owner and Wife/),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Appointment")).not.toBeInTheDocument();
  },
);
test("Owner and Wife see colored intervals, can select days, and save named task bullets", async () => {
  useContentSession.mockReturnValue({
    account: account(["WifeRole"]),
    accountKey: "wife",
    ready: true,
    token: jest.fn(async () => "api-token"),
  });
  render(<Calendar />);
  await screen.findByRole("button", { name: "Edit" });
  expect(
    screen.getByRole("button", { name: `Select ${day}` }),
  ).toHaveTextContent("09:00–10:30 Charlotte: Appointment");
  expect(screen.getByRole("button", { name: `Select ${day}` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.change(screen.getByLabelText("Entry type"), {
    target: { value: "task" },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Pick up groceries" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Pick up groceries");
  const write = fetch.mock.calls.find(
    ([, options]) => options.method === "POST",
  );
  expect(JSON.parse(write[1].body)).toMatchObject({
    kind: "task",
    member: "wife",
    startTime: null,
    endTime: null,
    title: "Pick up groceries",
  });
  expect(write[1].headers["X-Portfolio-Authorization"]).toBe(
    "Bearer api-token",
  );
  expect(
    screen.getByRole("button", { name: `Select ${day}` }),
  ).toHaveTextContent("• Charlotte: Pick up groceries");
});
test("editing preserves versions and reminder recipients; switching account clears private calendar immediately", async () => {
  const page = render(<Calendar />);
  await screen.findByRole("button", { name: "Edit" });
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Updated appointment" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([, options]) => options.method === "PUT"),
    ).toBe(true),
  );
  const write = fetch.mock.calls.find(
    ([, options]) => options.method === "PUT",
  );
  expect(write[1].headers["If-Match"]).toBe('"1"');
  expect(Object.keys(JSON.parse(write[1].body))).not.toContain("reminders");
  useContentSession.mockReturnValue({
    account: account(["FriendRole"]),
    accountKey: "friend",
    ready: true,
  });
  page.rerender(<Calendar />);
  expect(screen.queryByText("Appointment")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
test("a selected reminder time and recipient are saved as a UTC instant", async () => {
  render(<Calendar />);
  await screen.findByRole("button", { name: "Edit" });
  expect(screen.queryByRole("button", { name: "Edit Appointment" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Reminder test" } });
  const selectedTime = `${today.getFullYear() + 1}-01-15T14:35`;
  const reminder = screen.getByLabelText(/Reminder time/);
  expect(reminder).toBeEnabled();
  fireEvent.change(reminder, { target: { value: selectedTime } });
  fireEvent.change(screen.getByLabelText("Email reminder to"), { target: { value: "both" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(true));
  const [, options] = fetch.mock.calls.find(([, options]) => options.method === "POST");
  expect(JSON.parse(options.body)).toMatchObject({ reminderAt: new Date(selectedTime).toISOString(), remindTo: "both" });
});
