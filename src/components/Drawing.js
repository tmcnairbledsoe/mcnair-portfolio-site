import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const WIDTH = 1000,
  HEIGHT = 600;
export default function Drawing() {
  const canvasRef = useRef(null);
  const draft = useRef(null);
  const cursor = useRef({ x: WIDTH / 2, y: HEIGHT / 2 });
  const [strokes, setStrokes] = useState([]);
  const [color, setColor] = useState("#245c49");
  const [width, setWidth] = useState(5);
  const [message, setMessage] = useState("Ready to draw.");
  const [supported, setSupported] = useState(true);
  function paintStroke(context, stroke) {
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1))
      context.lineTo(point.x, point.y);
    context.stroke();
    // A tap or click is a visible dot, rather than an empty path.
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(
        stroke.points[0].x,
        stroke.points[0].y,
        stroke.width / 2,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  useEffect(() => {
    const context = canvasRef.current.getContext("2d");
    if (!context) {
      setSupported(false);
      setMessage(
        "Drawing is unavailable in this browser. Please try a browser with Canvas support.",
      );
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    strokes.forEach((stroke) => paintStroke(context, stroke));
  }, [strokes]);
  function point(event) {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(WIDTH, ((event.clientX - bounds.left) * WIDTH) / bounds.width),
      ),
      y: Math.max(
        0,
        Math.min(
          HEIGHT,
          ((event.clientY - bounds.top) * HEIGHT) / bounds.height,
        ),
      ),
    };
  }
  function start(event) {
    if (
      draft.current ||
      !supported ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    draft.current = {
      color,
      width: Number(width),
      points: [point(event)],
      pointerId: event.pointerId,
    };
    paintStroke(canvasRef.current.getContext("2d"), draft.current);
  }
  function move(event) {
    if (!draft.current || draft.current.pointerId !== event.pointerId) return;
    draft.current.points.push(point(event));
    paintStroke(canvasRef.current.getContext("2d"), draft.current);
  }
  function finish(event) {
    if (!draft.current || draft.current.pointerId !== event.pointerId) return;
    const stroke = draft.current;
    draft.current = null;
    setStrokes((previous) => [...previous, stroke]);
    setMessage("Stroke added. Your drawing is only in this tab.");
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event) {
    const offsets = {
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0],
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
    };
    if (!supported || !offsets[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    const next = {
      x: Math.max(0, Math.min(WIDTH, cursor.current.x + dx)),
      y: Math.max(0, Math.min(HEIGHT, cursor.current.y + dy)),
    };
    const from = { ...cursor.current };
    if (event.shiftKey)
      setStrokes((previous) => [
        ...previous,
        { color, width: Number(width), points: [from, next] },
      ]);
    cursor.current = next;
    setMessage(
      `Keyboard cursor: ${next.x}, ${next.y}.${event.shiftKey ? " Line drawn." : " Hold Shift to draw."}`,
    );
  }
  function download() {
    try {
      canvasRef.current.toBlob((blob) => {
        if (!blob) {
          setMessage("Could not create the image. Please try again.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "mcnair-sketch.png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("PNG download requested. Check your browser downloads.");
      }, "image/png");
    } catch {
      setMessage("Could not export this drawing. Please try again.");
    }
  }
  return (
    <>
      <Link className="text-link back-link" to="/tools">
        ← Browser tools
      </Link>
      <div className="page-heading">
        <p className="eyebrow">Make a little room for creativity</p>
        <h1>Sketchpad</h1>
        <p className="lede">
          A blank canvas, a few colors, and whatever comes to mind.
        </p>
      </div>
      <div className="tool-panel">
        <div className="drawing-controls">
          <label>
            Ink color{" "}
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              disabled={!supported}
            />
          </label>
          <label htmlFor="brush">
            Brush size{" "}
            <select
              id="brush"
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
              disabled={!supported}
            >
              {[2, 5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button
              className="secondary"
              disabled={!strokes.length}
              onClick={() => {
                setStrokes((previous) => previous.slice(0, -1));
                setMessage("Last stroke undone.");
              }}
            >
              Undo
            </button>
            <button
              className="secondary"
              disabled={!strokes.length}
              onClick={() => {
                setStrokes([]);
                setMessage("Canvas cleared.");
              }}
            >
              Clear canvas
            </button>
            <button disabled={!supported} onClick={download}>
              Download PNG ↓
            </button>
          </div>
        </div>
        <p id="drawing-help" className="footnote">
          Draw with a mouse, pen, or touch. Keyboard: focus the canvas, use
          arrow keys to move from the center, and hold Shift with an arrow key
          to draw in 10 px steps.
        </p>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          aria-label="Drawing canvas"
          aria-describedby="drawing-help"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onKeyDown={keyboard}
        >
          Your browser does not support the drawing canvas.
        </canvas>
        <p role="status" className="tool-status">
          {message}
        </p>
      </div>
      <p className="local-note">
        Browser-local: drawings are held only in this tab. Leaving or reloading
        clears the canvas. Download a PNG to keep your work. Nothing is
        uploaded.
      </p>
    </>
  );
}
