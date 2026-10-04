import React, { useEffect, useState } from "react";

export default function PixelDrop() {
  const [pixels, setPixels] = useState([]);
  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let spawn = 0;
    let nextId = 0;
    let previous = 0;
    function animate(now) {
      const elapsed = Math.min((now - previous) || 16, 50);
      previous = now;
      spawn += elapsed;
      let added = null;
      if (spawn >= 100) {
        spawn = 0;
        added = { id: nextId++, left: Math.random() * window.innerWidth, top: window.innerHeight, speed: Math.random() * 2 + 1 };
      }
      setPixels((current) => {
        const remaining = current.map((pixel) => ({ ...pixel, top: pixel.top - pixel.speed * elapsed / 16, speed: pixel.speed + 0.1 * elapsed / 16 })).filter((pixel) => pixel.top > 0);
        return (added ? [...remaining, added] : remaining).slice(-200);
      });
      frame = requestAnimationFrame(animate);
    }
    function update() {
      cancelAnimationFrame(frame);
      if (motion?.matches) setPixels([]);
      else { previous = 0; frame = requestAnimationFrame(animate); }
    }
    update();
    motion?.addEventListener("change", update);
    return () => { cancelAnimationFrame(frame); motion?.removeEventListener("change", update); };
  }, []);
  return <div className="pixel-background" aria-hidden="true">{pixels.map((pixel) => <span key={pixel.id} style={{ left: pixel.left, top: pixel.top }} />)}</div>;
}
