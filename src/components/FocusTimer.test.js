import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FocusTimer from "./FocusTimer";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
function setup() {
  return render(
    <MemoryRouter>
      <FocusTimer />
    </MemoryRouter>,
  );
}
function advance(ms) {
  act(() => jest.advanceTimersByTime(ms));
}
test("start, pause, resume and reset preserve the correct remaining time", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Start session" }));
  advance(10000);
  expect(screen.getByRole("timer")).toHaveTextContent("24:50");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  advance(5000);
  expect(screen.getByRole("timer")).toHaveTextContent("24:50");
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  advance(2000);
  expect(screen.getByRole("timer")).toHaveTextContent("24:48");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  advance(5000);
  expect(screen.getByRole("timer")).toHaveTextContent("25:00");
});
test("duration validation rejects invalid input and completion stops at zero", () => {
  setup();
  const minutes = screen.getByLabelText(/Session length/);
  for (const invalid of ["", "0", "181", "1.5"]) {
    fireEvent.change(minutes, { target: { value: invalid } });
    fireEvent.click(screen.getByRole("button", { name: "Set duration" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enter a whole number",
    );
    expect(screen.getByRole("timer")).toHaveTextContent("25:00");
  }
  fireEvent.change(minutes, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Set duration" }));
  fireEvent.click(screen.getByRole("button", { name: "Start session" }));
  expect(minutes).toBeDisabled();
  advance(60000);
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(screen.getByRole("status")).toHaveTextContent("Session complete");
  advance(5000);
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  fireEvent.click(screen.getByRole("button", { name: "Start session" }));
  expect(screen.getByRole("timer")).toHaveTextContent("01:00");
});
test("clock-based countdown catches up after background throttling and cleans up", () => {
  const view = setup();
  fireEvent.click(screen.getByRole("button", { name: "Start session" }));
  jest.setSystemTime(Date.now() + 45000);
  advance(250);
  expect(screen.getByRole("timer")).toHaveTextContent("24:15");
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
