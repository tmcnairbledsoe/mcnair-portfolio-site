import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Drawing from "./Drawing";
jest.mock('../drawing/useSharedDrawing',()=>({useSharedDrawing:()=>{
 const React=require('react');
 const [strokes,setStrokes]=React.useState([]);
 return {ready:true,pending:0,generation:'test',message:'Shared canvas up to date.',strokes,
 save:(stroke,deleted=false)=>setStrokes(previous=>[...previous.filter(p=>p.id!==stroke.id),...(deleted?[]:[{id:stroke.id,stroke,mine:true}])])};
}}));

const context = {
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
};
let capture;
beforeEach(() => {
  jest.clearAllMocks();
  let id=0;
  global.crypto={randomUUID:()=>`stroke-${++id}`};
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context);
  window.PointerEvent = MouseEvent;
  capture = false;
  HTMLCanvasElement.prototype.setPointerCapture = jest.fn(() => {
    capture = true;
  });
  HTMLCanvasElement.prototype.hasPointerCapture = jest.fn(() => capture);
  HTMLCanvasElement.prototype.releasePointerCapture = jest.fn(() => {
    capture = false;
  });
});
afterEach(() => jest.restoreAllMocks());
function setup() {
  render(
    <MemoryRouter>
      <Drawing />
    </MemoryRouter>,
  );
  const canvas = screen.getByLabelText("Drawing canvas");
  canvas.getBoundingClientRect = () => ({
    left: 20,
    top: 10,
    width: 500,
    height: 300,
  });
  return canvas;
}
test("pointer strokes scale to canvas coordinates and undo removes your own work", () => {
  const canvas = setup();
  expect(screen.getByRole("button", { name: "Undo my last mark" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Ink color"), {
    target: { value: "#ff0000" },
  });
  fireEvent.change(screen.getByLabelText("Brush size"), {
    target: { value: "10" },
  });
  fireEvent.pointerDown(canvas, { clientX: 70, clientY: 60 });
  fireEvent.pointerMove(canvas, { clientX: 120, clientY: 110 });
  fireEvent.pointerUp(canvas);
  expect(context.moveTo).toHaveBeenCalledWith(100, 100);
  expect(context.lineTo).toHaveBeenCalledWith(200, 200);
  expect(context.strokeStyle).toBe("#ff0000");
  expect(context.lineWidth).toBe(10);
  expect(capture).toBe(false);
  expect(screen.getByRole("button", { name: "Undo my last mark" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Undo my last mark" }));
  expect(screen.getByRole("button", { name: "Undo my last mark" })).toBeDisabled();
  fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
  fireEvent.pointerCancel(canvas);
  expect(context.arc).toHaveBeenCalledWith(20, 20, 5, 0, Math.PI * 2);
  expect(screen.queryByRole("button", { name: "Clear canvas" })).not.toBeInTheDocument();
});
test("keyboard drawing is usable without a pointer", () => {
  const canvas = setup();
  fireEvent.keyDown(canvas, { key: "ArrowRight" });
  expect(screen.getByRole("button", { name: "Undo my last mark" })).toBeDisabled();
  fireEvent.keyDown(canvas, { key: "ArrowDown", shiftKey: true });
  expect(context.moveTo).toHaveBeenCalledWith(510, 300);
  expect(context.lineTo).toHaveBeenCalledWith(510, 310);
  expect(screen.getByRole("status")).toHaveTextContent("Line drawn");
  expect(screen.getByRole("button", { name: "Undo my last mark" })).toBeEnabled();
});
test("exports a PNG locally and reports export failures", () => {
  setup();
  const toBlob = jest
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) =>
      callback(new Blob(["png"], { type: "image/png" })),
    );
  URL.createObjectURL = jest.fn(() => "blob:local-image");
  URL.revokeObjectURL = jest.fn();
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: /Download PNG/ }));
  expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
  expect(click).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "PNG download requested",
  );
  toBlob.mockImplementation((callback) => callback(null));
  fireEvent.click(screen.getByRole("button", { name: /Download PNG/ }));
  expect(screen.getByRole("status")).toHaveTextContent("Could not create");
});

test("reports unavailable canvas support without enabling drawing or export", () => {
  HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
  setup();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Drawing is unavailable",
  );
  expect(screen.getByRole("button", { name: /Download PNG/ })).toBeDisabled();
  expect(screen.getByLabelText("Ink color")).toBeDisabled();
});
