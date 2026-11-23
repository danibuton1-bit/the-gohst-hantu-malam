import { useEffect, useRef } from "react";
import { audio } from "@/lib/audio";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ROW = 32;
export const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();
const pad = (n: number) => String(n).padStart(2, "0");

function Wheel({ items, index, onPick, label }: { items: string[]; index: number; onPick: (i: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(index);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW });
    last.current = index;
  }, [index, items.length]);
  return (
    <div className="relative h-[160px] flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-8 -translate-y-1/2 rounded-md border border-gold/60 bg-primary/20" />
      <div ref={ref} role="listbox" aria-label={label} tabIndex={0} data-no-click-sound
        className="relative z-10 h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(transparent,black_35%,black_65%,transparent)]"
        onScroll={(e) => {
          const i = Math.max(0, Math.min(items.length - 1, Math.round(e.currentTarget.scrollTop / ROW)));
          if (i !== last.current) { last.current = i; audio.tick(); }
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onPick(i), 120);
        }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); onPick(Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)))); } }}>
        <div style={{ height: ROW * 2 }} />
        {items.map((t, i) => (
          <div key={t} role="option" aria-selected={i === index} onClick={() => onPick(i)}
            className={`flex h-8 snap-center items-center justify-center text-sm font-bold transition-opacity ${i === index ? "text-gold" : "text-muted-foreground opacity-60"}`}>{t}</div>
        ))}
        <div style={{ height: ROW * 2 }} />
      </div>
    </div>
  );
}

/** Scroll-wheel birthday picker (day / month / year) replacing the phone's native date dialog. Value is YYYY-MM-DD. */
export function DateWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const maxY = new Date().getFullYear();
  const years = Array.from({ length: maxY - 1950 + 1 }, (_, i) => String(maxY - i));
  const [y0, m0, d0] = value ? value.split("-").map(Number) : [2005, 1, 1];
  const y = y0 ?? 2005, m = m0 ?? 1;
  const dim = daysIn(y, m);
  const d = Math.min(d0 ?? 1, dim);
  const set = (ny: number, nm: number, nd: number) => onChange(`${ny}-${pad(nm)}-${pad(Math.min(nd, daysIn(ny, nm)))}`);
  useEffect(() => { if (!value) set(y, m, d); }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex gap-1 rounded-md border border-border bg-background/60 px-1">
      <Wheel label="Tanggal" items={Array.from({ length: dim }, (_, i) => String(i + 1))} index={d - 1} onPick={(i) => set(y, m, i + 1)} />
      <Wheel label="Bulan" items={BULAN} index={m - 1} onPick={(i) => set(y, i + 1, d)} />
      <Wheel label="Tahun" items={years} index={Math.max(0, years.indexOf(String(y)))} onPick={(i) => set(Number(years[i]), m, d)} />
    </div>
  );
}
