import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Users } from "lucide-react";
import { CharImg, EmoteIcon, EmoteWheel } from "@/components/Art";
import { SocialPanel } from "@/components/Social";
import { emblemSvg, normalizeChar, svgUrl } from "@/lib/art";
import { useApp } from "@/components/AppState";
import { MuteButton } from "@/components/MuteButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ProfileCorner } from "@/components/ProfileCorner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CHARACTERS } from "@/lib/art";
import { EMOTE_MS, PAIR_EMOTES } from "@/lib/emotes";
import { roomCode } from "@/lib/game";
import { useIsAdmin } from "@/lib/admin";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Lobby - Hantu Malam" },
      { name: "description", content: "Lobby Hantu Malam: pilih emote, lihat karakter, lalu tekan MULAI untuk langsung mencari pemain." },
      { property: "og:title", content: "Lobby - Hantu Malam" },
      { property: "og:description", content: "Tekan MULAI dan langsung masuk pertandingan horor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

/** Find an open match (lobby, <4 players) or create a new one. */
async function findMatch(profileId: string): Promise<string | null> {
  const { data: open } = await supabase.from("rooms").select("code").eq("status", "lobby").order("created_at", { ascending: false }).limit(10);
  for (const r of open ?? []) {
    const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("room_code", r.code);
    if ((count ?? 0) > 0 && (count ?? 0) < 4) return r.code;
  }
  for (let i = 0; i < 5; i++) {
    const c = roomCode();
    const { error } = await supabase.from("rooms").insert({ code: c, host_id: profileId });
    if (!error) return c;
  }
  return null;
}

function Lobby() {
  const { ready, account, online, setRoom } = useApp();
  const nav = useNavigate();
  const isAdmin = useIsAdmin(account);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [emote, setEmote] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const [wheel, setWheel] = useState(false);
  const [walk, setWalk] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!account) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("list_friends", { p_id: account.id, p_kode: account.kode_id });
      if (alive) setFriendIds(new Set(((data ?? []) as { friend_id: string; status: string }[]).filter((f) => f.status === "accepted").map((f) => f.friend_id)));
    };
    void load(); const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [account]);
  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);
  useEffect(() => setRoom(null), [setRoom]);
  useEffect(() => { if (!emote) return; const t = setTimeout(() => setEmote(null), EMOTE_MS); return () => clearTimeout(t); }, [emote, k]);
  if (!account) return null;
  const ch = CHARACTERS[account.karakter_pilihan];

  async function start() {
    if (!account) return;
    setBusy(true); setErr("");
    const c = await findMatch(account.id);
    if (c) { void nav({ to: "/room/$code", params: { code: c } }); return; }
    setErr("Gagal mencari pertandingan, coba lagi."); setBusy(false);
  }

  const buddies: typeof online = []; void friendIds; void normalizeChar; // lobby stays solo until friends accept an invite
  const pair = emote && PAIR_EMOTES.includes(emote) && buddies.length > 0;
  return (
    <main className="relative h-full min-h-full overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 70%, hsl(350 70% 18% / .7), transparent 60%), var(--background)" }}>
      <header className="absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-2">
        <div className="w-56"><ProfileCorner /></div>
        <img src={svgUrl(emblemSvg())} alt="Hantu Malam" className="mx-auto hidden size-20 sm:block" />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-xs"><Users className="size-4 text-primary" />{online.length} online</div>
        {isAdmin && <Link to="/admin" className="flex items-center gap-1 rounded-lg border border-gold/70 bg-card/80 px-3 py-2 text-xs font-bold text-gold"><Crown className="size-4" />ADMIN</Link>}
        <SocialPanel />
        <MuteButton />
        <SettingsDialog />
      </header>

      {/* character stage: you + up to two online players nearby */}
      <div className="absolute inset-0 flex items-end justify-center gap-2 pb-6">
        {buddies[0] && <div className="flex flex-col items-center opacity-80">
          <CharImg id={normalizeChar(buddies[0].karakter) ?? "raka"} emote={pair ? emote : null} className="h-[34vmin] max-h-48" />
          <div className="text-xs text-muted-foreground">{buddies[0].nama}</div>
        </div>}
        <div className="relative flex flex-col items-center">
          <button type="button" onClick={() => setWheel(true)} aria-label="Buka roda emote" className="cursor-pointer"><CharImg id={account.karakter_pilihan} emote={walk ? null : emote} walking={walk} className="h-[55vmin] max-h-80 drop-shadow-[0_0_25px_hsl(350_80%_40%/.6)] transition-transform duration-500" style={{ transform: pair || walk ? "translateX(-28%) scaleX(-1)" : undefined, transitionDuration: "750ms" }} /></button>
          <div className="text-[10px] text-muted-foreground">Ketuk karaktermu untuk emote</div>
          <div className="mt-1 h-3 w-40 rounded-full bg-primary/30 blur-md" />
          <div className="font-horror text-2xl text-primary">{ch.nama}</div>
        </div>
        {[0, 1, 2].map((i) => <div key={i} className="mb-16 hidden size-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 text-3xl text-muted-foreground/70 sm:flex" title="Undang teman">+</div>)}
        {buddies[1] && <div className="flex flex-col items-center opacity-80">
          <CharImg id={normalizeChar(buddies[1].karakter) ?? "raka"} className="h-[34vmin] max-h-48" />
          <div className="text-xs text-muted-foreground">{buddies[1].nama}</div>
        </div>}
      </div>

      {/* emote wheel */}
      <button onClick={() => setWheel(true)} className="absolute left-3 top-1/2 z-10 flex size-14 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-gold/70 bg-card/80 text-foreground" aria-label="Emote"><EmoteIcon id="dance" className="size-5" /><span className="text-[9px] font-bold">EMOTE</span></button>
      {emote && PAIR_EMOTES.includes(emote) && !buddies.length && <div className="absolute left-20 top-1/2 z-10 text-[10px] text-muted-foreground">Tidak ada teman di dekatmu</div>}
      <EmoteWheel open={wheel} onClose={() => setWheel(false)} onPick={(id) => { if (PAIR_EMOTES.includes(id) && buddies.length) { setWalk(true); setTimeout(() => { setWalk(false); setEmote(id); setK((x) => x + 1); }, 750); } else { setEmote(id); setK((x) => x + 1); } }} />

      {/* mode + start */}
      <div className="absolute bottom-3 right-3 z-10 flex w-56 flex-col gap-2">
        <div className="rounded-lg border border-border bg-card/80 p-2 text-xs">
          <div className="font-bold text-primary">MODE: 4 MAP</div>
          <div className="text-muted-foreground">Rumah Tua · Rumah Sakit · Kuburan · Hotel 2 Lantai — kapten memilih di lobby squad</div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button size="lg" className="h-16 text-2xl font-horror glow-blood" onClick={start} disabled={busy}>
          <Play className="size-6" /> {busy ? "MENCARI..." : "MULAI"}
        </Button>
      </div>
    </main>
  );
}
