import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio, X } from "lucide-react";
import { askSurvivalTip } from "@/lib/survival.functions";
import { Button } from "./ui/button";

const SEEN = "hm-radio-seen";
const QUICK_HUNTER = ["Senter hampir mati", "Terjebak di lift", "Kuyang mengejarku", "Cari kunci terakhir"];
const QUICK_GHOST = ["Pemburu sembunyi di balik pintu", "Mereka kabur pakai lift", "Tidak menemukan siapa pun"];

export function SurvivalRadio({ ctx }: { ctx: () => { role: "hunter" | "ghost"; map: string; keys: number; floor: number; battery: number; room: string } }) {
  const ask = useServerFn(askSurvivalTip);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!localStorage.getItem(SEEN)) { setFresh(true); setOpen(true); localStorage.setItem(SEEN, "1"); } }, []);
  const role = ctx().role;
  const send = async (s: string) => {
    if (s.trim().length < 2 || busy) return;
    setBusy(true); setErr(null); setReply(null);
    try { const r = await ask({ data: { ...ctx(), situation: s.trim() } }); if (r.tip) setReply(r.tip); else setErr(r.error); }
    catch { setErr("Sinyal radio terputus. Coba lagi."); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button aria-label="Radio darurat" onClick={() => setOpen((o) => !o)} className={`pointer-events-auto flex size-10 items-center justify-center rounded-full border border-gold/60 bg-card/80 text-gold ${fresh && !open ? "animate-pulse" : ""}`}><Radio className="size-5" /></button>
      {open && (
        <div className="pointer-events-auto fixed left-1/2 top-14 z-[60] w-[min(92vw,380px)] -translate-x-1/2 rounded-xl border border-gold/50 bg-card/95 p-3 text-sm shadow-2xl">
          <div className="mb-2 flex items-center justify-between"><span className="font-bold text-gold">📻 RADIO DARURAT</span><button aria-label="Tutup" onClick={() => setOpen(false)}><X className="size-4" /></button></div>
          {fresh && !reply && <p className="mb-2 text-xs text-muted-foreground">Sinyal darurat terhubung. Ceritakan situasimu, operator akan kirim petunjuk bertahan hidup.</p>}
          <div className="mb-2 flex flex-wrap gap-1">{(role === "ghost" ? QUICK_GHOST : QUICK_HUNTER).map((q) => <button key={q} disabled={busy} onClick={() => void send(q)} className="rounded-full bg-muted px-2 py-1 text-[11px] hover:bg-primary/40">{q}</button>)}</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Jelaskan situasimu..." className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-foreground" onKeyDown={(e) => e.stopPropagation()} />
            <Button size="sm" disabled={busy}>{busy ? "..." : "Kirim"}</Button>
          </form>
          {reply && <div className="mt-2 max-h-40 overflow-auto whitespace-pre-line rounded-md bg-void/60 p-2 text-xs">{reply}</div>}
          {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        </div>
      )}
    </>
  );
}
