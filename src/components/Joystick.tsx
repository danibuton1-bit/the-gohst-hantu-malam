import { toContent } from "@/lib/orient";
import { useRef, useState, type MutableRefObject } from "react";

export function Joystick({ vec }: { vec: MutableRefObject<{ x: number; y: number }> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const R = 50;
  function update(cx: number, cy: number) {
    const b = base.current!.getBoundingClientRect();
    const c = toContent(cx - (b.left + b.width / 2), cy - (b.top + b.height / 2));
    let dx = c.x, dy = c.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    vec.current = { x: dx / R, y: dy / R };
  }
  const end = () => { id.current = null; setKnob({ x: 0, y: 0 }); vec.current = { x: 0, y: 0 }; };
  return (
    <div ref={base} className="relative size-32 touch-none rounded-full border-2 border-accent/60 bg-card/40"
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (id.current === e.pointerId) update(e.clientX, e.clientY); }}
      onPointerUp={end} onPointerCancel={end}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-14 rounded-full bg-primary/70"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
