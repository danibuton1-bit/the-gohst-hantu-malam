import { useMemo } from "react";
import { Crown, Hand, Heart, HeartHandshake, Laugh, Music, ShieldAlert, Smile, Trophy } from "lucide-react";
import { characterSvg, logoSvg, svgUrl, type CharId } from "@/lib/art";
import { cn } from "@/lib/utils";
import { EMOTES } from "@/lib/emotes";

/** Inline SVG so eyes can blink and limbs can play emote animations. */
export function CharImg({ id, className, emote, style, walking }: { id: CharId; className?: string; emote?: string | null; style?: React.CSSProperties; walking?: boolean }) {
  const html = useMemo(() => characterSvg(id).replace("<svg ", '<svg style="height:100%;width:auto;display:block;overflow:visible" '), [id]);
  const delay = useMemo(() => `${-(Math.random() * 4).toFixed(2)}s`, []);
  return (
    <div className={cn("hm-char relative inline-block select-none", emote && `hm-emote-${emote}`, walking && "hm-walk", className)} style={{ ...style, ["--blink-delay" as string]: delay }} role="img" aria-label={id}>
      <div className="h-full" dangerouslySetInnerHTML={{ __html: html }} />
      {emote === "kiss" && <div className="hm-hearts pointer-events-none absolute inset-x-0 top-0">{[0, 1, 2].map((i) => <Heart key={i} className="absolute fill-primary text-primary" style={{ left: `${45 + i * 12}%`, animationDelay: `${i * 0.3}s` }} />)}</div>}
      {emote === "hug" && <div className="hm-hearts pointer-events-none absolute inset-x-0 top-0"><HeartHandshake className="absolute left-1/2 size-8 -translate-x-1/2 text-primary" /></div>}
    </div>
  );
}

export function EmoteIcon({ id, className }: { id: string; className?: string }) {
  const I = { wave: Hand, dance: Music, laugh: Laugh, salute: Crown, victory: Trophy, scared: ShieldAlert, hug: HeartHandshake, kiss: Heart, shy: Smile }[id] ?? Hand;
  return <I className={className} />;
}

export function Logo({ className }: { className?: string }) {
  return <img src={svgUrl(logoSvg())} alt="Hantu Malam: Mabar Horor" className={cn("select-none", className)} draggable={false} />;
}

/** Free Fire-style radial emote wheel. */
export function EmoteWheel({ open, onPick, onClose, size = 240 }: { open: boolean; onPick: (id: string) => void; onClose: () => void; size?: number }) {
  if (!open) return null;
  const r = size / 2 - 34;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-void/40" onPointerDown={onClose}>
      <div className="hm-wheel relative rounded-full border-2 border-gold/70 bg-card/85 shadow-2xl" style={{ width: size, height: size }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="absolute inset-[30%] flex items-center justify-center rounded-full border border-border bg-void/80 text-center text-[10px] font-bold text-gold">EMOTE</div>
        {EMOTES.map((e, i) => {
          const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button key={e.id} onPointerDown={(ev) => { ev.stopPropagation(); onPick(e.id); onClose(); }}
              className="absolute flex size-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-muted text-foreground transition-transform hover:scale-110 hover:bg-primary/40 active:scale-95"
              style={{ left: size / 2 + Math.cos(a) * r, top: size / 2 + Math.sin(a) * r }} aria-label={e.label}>
              <EmoteIcon id={e.id} className="size-5" /><span className="text-[9px] font-bold">{e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
