import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useContentSession } from "../auth/ContentSession";
jest.mock("../auth/ContentSession", () => ({ useContentSession: jest.fn() }));
jest.mock("../auth/SidebarAuth", () => () => null);
test("Journal navigation is hidden without a recognized role and available with one", () => {
  useContentSession.mockReturnValue({ journalAllowed: false });
  const view = () => (
    <MemoryRouter>
      <Sidebar expanded setExpanded={jest.fn()} />
    </MemoryRouter>
  );
  const page = render(view());
  expect(screen.getByRole("link", { name: "Blog" })).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Journal" }),
  ).not.toBeInTheDocument();
  useContentSession.mockReturnValue({ journalAllowed: true });
  page.rerender(view());
  expect(screen.getByRole("link", { name: "Journal" })).toBeInTheDocument();
});
test('Calendar navigation is available to Owner/Wife and hidden for Friend or no role',()=>{
 const view=()=> <MemoryRouter><Sidebar expanded setExpanded={jest.fn()}/></MemoryRouter>;
 useContentSession.mockReturnValue({account:{idTokenClaims:{roles:['FriendRole']}},journalAllowed:true});
 const page=render(view());expect(screen.queryByRole('link',{name:'Calendar'})).not.toBeInTheDocument();
 for(const role of ['OwnerRole','WifeRole']) {
  useContentSession.mockReturnValue({account:{idTokenClaims:{roles:[role]}},journalAllowed:true});page.rerender(view());
  expect(screen.getByRole('link',{name:'Calendar'})).toBeInTheDocument();
 }
});
