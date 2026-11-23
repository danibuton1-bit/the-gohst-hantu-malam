import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { audio } from "@/lib/audio";

export function MuteButton({ className = "" }: { className?: string }) {
  const [m, setM] = useState(audio.muted);
  return (
    <button aria-label={m ? "Nyalakan suara" : "Matikan suara"} className={`rounded-full border border-border bg-card/80 p-2 ${className}`}
      onClick={() => { audio.init(); audio.setMuted(!m); setM(!m); }}>
      {m ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
    </button>
  );
}
