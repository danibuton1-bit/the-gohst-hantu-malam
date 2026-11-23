import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { fullscreenSupported, isFullscreen, setFullscreen } from "@/lib/orient";

/** Toggle full screen (hides browser bars). Remembers the choice. */
export function FullscreenButton({ label = false, className = "" }: { label?: boolean; className?: string }) {
  const [on, setOn] = useState(false);
  const [ok, setOk] = useState(true);
  useEffect(() => {
    setOk(fullscreenSupported()); setOn(isFullscreen());
    const f = () => setOn(isFullscreen());
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  if (!ok) return null;
  const Icon = on ? Minimize : Maximize;
  return (
    <button type="button" aria-label={on ? "Keluar layar penuh" : "Layar penuh"} aria-pressed={on}
      onPointerDown={(e) => e.stopPropagation()} onClick={() => void setFullscreen(!on)}
      className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 text-xs font-bold ${className}`}>
      <Icon className="size-4" />{label && (on ? "KELUAR LAYAR PENUH" : "LAYAR PENUH")}
    </button>
  );
}
