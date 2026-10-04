import React, { act } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function visit(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
test("public navigation reaches factual pages and moves focus to the main content", () => {
  visit();
  fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
  const nav = within(
    screen.getByRole("navigation", { name: "Main navigation" }),
  );
  act(() => userEvent.click(nav.getByRole("link", { name: "Resume" })));
  expect(
    screen.getByRole("heading", { name: "Thomas McNair Bledsoe", level: 1 }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Software Developer - Metromont/),
  ).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveFocus();
  expect(nav.getByRole("link", { name: "Resume" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(document.title).toBe("Résumé · Thomas McNair Bledsoe");
  act(() => userEvent.click(nav.getByRole("link", { name: "Projects" })));
  expect(
    screen.getByRole("heading", { name: "Revit Add-in" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Chess Model Repo/ }),
  ).toHaveAttribute("href", "https://github.com/tmcnairbledsoe/chessModels");
  act(() => userEvent.click(nav.getByRole("link", { name: "Browser tools" })));
  act(() =>
    userEvent.click(screen.getByRole("link", { name: /Open focus timer/ })),
  );
  expect(
    screen.getByRole("heading", { name: "Focus timer", level: 1 }),
  ).toBeInTheDocument();
});
test.each([
  "/interests",
  "/interests/",
  "/calendar",
  "/recovery",
  "/login",
  "/chessgame",
  "/unknown",
])("removed or unknown path %s has no private page", (path) => {
  visit(path);
  expect(
    screen.getByRole("heading", { name: "That page isn’t here." }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute(
    "href",
    "/",
  );
});
test("navigation contains only public pages and a useful skip link", () => {
  visit("/tools");
  fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
  expect(
    within(screen.getByRole("navigation")).getAllByRole("link"),
  ).toHaveLength(7);
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#main",
  );
  expect(
    screen.queryByRole("link", { name: "Interests" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/shared sketchpad saves your marks online/)).toBeInTheDocument();
});
test("mobile navigation closes after choosing a page", () => {
  const originalWidth = window.innerWidth;
  window.innerWidth = 390;
  try {
    visit();
    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    // Touch browsers can synthesize mouse enter before their click event.
    fireEvent.mouseEnter(screen.getByRole("complementary"));
    fireEvent.click(toggle);
    fireEvent.click(
      screen.getByRole("link", { name: "Projects", exact: true }),
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Revit Add-in" }),
    ).toBeInTheDocument();
  } finally {
    window.innerWidth = originalWidth;
  }
});
