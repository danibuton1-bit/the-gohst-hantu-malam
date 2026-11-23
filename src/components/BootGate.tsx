import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Art";
import { preloadMedia } from "@/lib/media";

/** Free Fire-style first-launch loader: downloads the admin's lobby videos/music before any page shows. */
export function BootGate({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("Memeriksa pembaruan...");
  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    const finish = () => { const wait = Math.max(0, 1500 - (Date.now() - t0)); setTimeout(() => { if (alive) { setPct(100); setDone(true); } }, wait); };
    preloadMedia((d, total, l) => { if (!alive) return; setLabel(l); setPct(total ? Math.round((d / total) * 95) : 60); })
      .catch(() => undefined).finally(finish);
    return () => { alive = false; };
  }, []);
  if (done) return <>{children}</>;
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-6">
      <Logo className="max-h-[45cqh] w-auto max-w-md animate-flicker rounded-xl" />
      <div className="h-2 w-64 overflow-hidden rounded border border-gold/50 bg-muted">
        <div className="h-full bg-blood transition-all duration-300" style={{ width: `${Math.max(5, pct)}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{label} {pct}%</p>
    </main>
  );
}
