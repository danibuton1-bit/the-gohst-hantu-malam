import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { audio } from "@/lib/audio";
import { DEFAULT_SOUND, getSound, saveSound, type SoundSettings } from "@/lib/sound-settings";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

const ROWS: { k: keyof SoundSettings; label: string; test: () => void }[] = [
  { k: "music", label: "Musik latar (BGM)", test: () => { audio.startMusic(); setTimeout(() => audio.stopAll(), 4000); } },
  { k: "kuyang", label: "Teriakan Kuyang", test: () => audio.kuyang() },
  { k: "pocong", label: "Jeritan Pocong / tertangkap", test: () => audio.scream() },
];

/** Admin sound manager: volume of music and each ghost's sound effect (saved on this device). */
export function SoundManager() {
  const [s, setS] = useState<SoundSettings>(DEFAULT_SOUND);
  useEffect(() => setS(getSound()), []);
  const set = (k: keyof SoundSettings, v: number) => { const n = { ...s, [k]: v }; setS(n); saveSound(n); };
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-primary"><Volume2 className="size-4" /> SOUND MANAGER</h2>
      {ROWS.map((r) => (
        <div key={r.k} className="flex items-center gap-3 rounded-lg border border-border bg-card/80 p-3">
          <div className="w-40 text-sm">{r.label}</div>
          <Slider className="flex-1" min={0} max={1.5} step={0.05} value={[s[r.k]]} onValueChange={(v) => set(r.k, v[0] ?? 0)} aria-label={r.label} />
          <span className="w-10 text-right text-xs">{Math.round(s[r.k] * 100)}%</span>
          <Button size="sm" variant="secondary" onClick={() => { audio.init(); r.test(); }}>Tes</Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Disimpan di perangkat ini.</p>
    </section>
  );
}
