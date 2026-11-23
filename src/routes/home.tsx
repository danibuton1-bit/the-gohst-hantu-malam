import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Crown, Play, Users, X } from "lucide-react";
import { EmoteIcon, EmoteWheel } from "@/components/Art";
import { SocialPanel } from "@/components/Social";
import { useApp } from "@/components/AppState";
import { Game, type GamePlayer } from "@/components/Game";
import { MicButton } from "@/components/MicButton";
import { MuteButton } from "@/components/MuteButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ProfileCorner } from "@/components/ProfileCorner";
import { Stage3D } from "@/components/Stage3D";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChar } from "@/lib/art";
import { audio } from "@/lib/audio";
import { EMOTE_MS } from "@/lib/emotes";
import { assignRoles, isMapId, MAPS, roomCode, type MapId } from "@/lib/game";
import { isOffline } from "@/lib/heartbeat";
import { useIsAdmin } from "@/lib/admin";
import { getMedia, onMedia, type MediaItem } from "@/lib/media";
import { COUNTDOWN_MS, getSquad, secondsLeft, setSquad, SQUAD_EVENT } from "@/lib/squad-store";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Lobby - Hantu Malam" },
      { name: "description", content: "Lobby squad Hantu Malam: ajak teman, pilih map dan peran, semua SIAP lalu MULAI dengan hitung mundur." },
      { property: "og:title", content: "Lobby - Hantu Malam" },
      { property: "og:description", content: "Kumpulkan squad, pilih map, dan mulai pertandingan horor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

type RoomRow = { code: string; host_id: string; status: string; map: string; countdown_until: string | null };

async function createSquad(hostId: string): Promise<string | null> {
  for (let i = 0; i < 5; i++) {
    const c = roomCode();
    const { error } = await supabase.from("rooms").insert({ code: c, host_id: hostId });
    if (!error) return c;
  }
  return null;
}

function Lobby() {
  const { ready, account, online, setRoom } = useApp();
  const nav = useNavigate();
  const isAdmin = useIsAdmin(account);
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoomRow] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [squadTick, setSquadTick] = useState(0);

  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);
  useEffect(() => { const f = () => setSquadTick((x) => x + 1); window.addEventListener(SQUAD_EVENT, f); return () => window.removeEventListener(SQUAD_EVENT, f); }, []);

  // resolve which squad I'm in (remembered, invited, or a fresh one where I'm captain)
  useEffect(() => {
    if (!account) return;
    let alive = true;
    void (async () => {
      let c = getSquad();
      if (c) {
        const { data: r } = await supabase.from("rooms").select("status").eq("code", c).maybeSingle();
        const { data: mine } = await supabase.from("players").select("id").eq("room_code", c).eq("profile_id", account.id).maybeSingle();
        const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("room_code", c);
        if (!r || (!mine && (r.status !== "lobby" || (count ?? 0) >= 4))) {
          if (r && !mine) setErr("Squad teman penuh atau sedang bermain.");
          c = null;
        } else if (!mine) {
          await supabase.from("players").insert({ room_code: c, profile_id: account.id, nama: account.nama, username: account.username, karakter: account.karakter_pilihan });
        }
      }
      if (!c) {
        c = await createSquad(account.id);
        if (c) await supabase.from("players").insert({ room_code: c, profile_id: account.id, nama: account.nama, username: account.username, karakter: account.karakter_pilihan });
      }
      if (!alive || !c) { if (!c) setErr("Gagal membuat squad, muat ulang halaman."); return; }
      setSquad(c);
      // leave any other squad I was still sitting in
      await supabase.from("players").delete().eq("profile_id", account.id).neq("room_code", c);
      setCode(c);
    })();
    return () => { alive = false; };
  }, [account, squadTick]);

  const refresh = useCallback(async () => {
    if (!code) return;
    const [{ data: r }, { data: ps }, { data: gs }] = await Promise.all([
      supabase.from("rooms").select("code,host_id,status,map,countdown_until").eq("code", code).maybeSingle(),
      supabase.from("players").select("*").eq("room_code", code).order("joined_at"),
      supabase.from("game_state").select("started_at").eq("room_code", code).maybeSingle(),
    ]);
    if (!r) { setSquadTick((x) => x + 1); return; }
    setRoomRow(r);
    setPlayers((ps ?? []).map((p) => ({ id: p.profile_id, nama: p.nama, username: p.username, karakter: normalizeChar(p.karakter) ?? "raka", pref: p.role_pref, role: (p.role as GamePlayer["role"]) ?? null, status: p.status })));
    if (gs?.started_at) setStartedAt(new Date(gs.started_at).getTime());
  }, [code]);

  useEffect(() => {
    if (!code) return;
    setRoom(code);
    void refresh();
    const ch = supabase.channel(`squad-db-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => void refresh())
      .subscribe();
    const poll = setInterval(() => void refresh(), 4000);
    return () => { clearInterval(poll); void supabase.removeChannel(ch); setRoom(null); };
  }, [code, refresh, setRoom]);

  // presence: ready flags + heartbeat + shared emotes
  const [emotes, setEmotes] = useState<Record<string, { e: string | null; k: number }>>({});
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [wheel, setWheel] = useState(false);
  const myReady = useRef(false);
  const lobbyCh = useRef<RealtimeChannel | null>(null);
  const seen = useRef<Record<string, number>>({});
  const playersRef = useRef(players); playersRef.current = players;

  const playEmote = useCallback((id: string, e: string) => {
    const k = Math.random();
    setEmotes((m) => ({ ...m, [id]: { e, k } }));
    setTimeout(() => setEmotes((m) => (m[id]?.k === k ? { ...m, [id]: { e: null, k } } : m)), EMOTE_MS);
  }, []);
  const playRef = useRef(playEmote); playRef.current = playEmote;

  useEffect(() => {
    if (!account || !code) return;
    const ch = supabase.channel(`room-lobby-${code}`, { config: { broadcast: { self: false }, presence: { key: account.id } } });
    ch.on("broadcast", { event: "emote" }, ({ payload }) => { const p = payload as { id: string; e: string }; playRef.current(p.id, p.e); });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ ready: boolean }>();
      const t = Date.now(); for (const id of Object.keys(st)) seen.current[id] = t;
      setReadyIds(new Set(Object.entries(st).filter(([, v]) => v.some((x) => x.ready)).map(([id]) => id)));
    });
    ch.subscribe((s) => { if (s === "SUBSCRIBED") { lobbyCh.current = ch; void ch.track({ ready: myReady.current }); } });
    const joinedAt = Date.now();
    const hb = setInterval(() => {
      const t = Date.now();
      const st = lobbyCh.current?.presenceState() ?? {};
      for (const p of playersRef.current) {
        if (p.id === account.id) continue;
        if (st[p.id]) { seen.current[p.id] = t; continue; }
        if (isOffline(seen.current[p.id] ?? joinedAt, t)) { delete seen.current[p.id]; void supabase.from("players").delete().eq("room_code", code).eq("profile_id", p.id); }
      }
    }, 3000);
    return () => { clearInterval(hb); lobbyCh.current = null; void supabase.removeChannel(ch); };
  }, [code, account]);

  function setReady(v: boolean) {
    myReady.current = v;
    if (account) setReadyIds((r) => { const n = new Set(r); if (v) n.add(account.id); else n.delete(account.id); return n; });
    void lobbyCh.current?.track({ ready: v });
  }
  function doEmote(e: string) {
    if (!account) return;
    playEmote(account.id, e);
    void lobbyCh.current?.send({ type: "broadcast", event: "emote", payload: { id: account.id, e } });
  }

  // lobby background media (admin uploads), rotating every 25s
  const [bgs, setBgs] = useState<MediaItem[]>([]);
  const [bgIdx, setBgIdx] = useState(0);
  useEffect(() => { const f = () => setBgs(getMedia().filter((m) => m.kind === "lobby_bg")); f(); return onMedia(f); }, []);
  useEffect(() => { if (bgs.length < 2) return; const t = setInterval(() => setBgIdx((i) => i + 1), 25000); return () => clearInterval(t); }, [bgs.length]);
  const bg = bgs.length ? bgs[bgIdx % bgs.length] : null;

  const isHost = !!account && players[0]?.id === account.id;
  const inRoom = !!account && players.some((p) => p.id === account.id);
  const playing = !!room && room.status !== "lobby" && inRoom && players.length > 0 && players.every((p) => p.role);
  const allReady = players.slice(1).every((p) => readyIds.has(p.id));
  const left = secondsLeft(room?.countdown_until, now);
  const counting = left !== null && room?.status === "lobby";

  // lobby music while not in a match
  useEffect(() => {
    if (playing) return;
    const go = () => { audio.init(); audio.startMusic("music_lobby"); };
    go(); window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, [playing]);

  useEffect(() => { if (!counting) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [counting]);
  useEffect(() => { if (!playing) { myReady.current = false; void lobbyCh.current?.track({ ready: false }); setReadyIds((r) => { const n = new Set(r); if (account) n.delete(account.id); return n; }); } }, [playing, account]);

  async function beginCountdown() {
    if (!code || !allReady) return;
    audio.init();
    setNow(Date.now());
    await supabase.from("rooms").update({ countdown_until: new Date(Date.now() + COUNTDOWN_MS).toISOString() }).eq("code", code);
    void refresh();
  }
  async function cancelCountdown() {
    if (!code) return;
    await supabase.from("rooms").update({ countdown_until: null }).eq("code", code);
    void refresh();
  }
  const starting = useRef(false);
  async function startMatch() {
    if (!code || starting.current) return;
    starting.current = true;
    try {
      if (!players.slice(1).every((p) => readyIds.has(p.id))) { await cancelCountdown(); return; }
      audio.stopAll();
      const { roles } = assignRoles(players.map((p) => ({ id: p.id, pref: p.pref ?? "hunter" })));
      await Promise.all(players.map((p) => supabase.from("players").update({ role: roles[p.id]!, status: "alive" }).eq("room_code", code).eq("profile_id", p.id)));
      await supabase.from("game_state").upsert({ room_code: code, keys_found: 0, started_at: new Date(Date.now() + 3000).toISOString(), winner: null, updated_at: new Date().toISOString() });
      await supabase.from("rooms").update({ status: "playing", countdown_until: null }).eq("code", code);
      void refresh();
    } finally { starting.current = false; }
  }
  // captain launches the match when the countdown hits zero
  useEffect(() => { if (counting && isHost && left === 0) void startMatch(); });
  // tick sound each second
  const lastLeft = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastLeft.current;
    if (counting && left !== prev && left !== null) { if (left > 0) audio.tone(left <= 3 ? 880 : 520, 0.12, "square", 0.12); else audio.matchStart(); }
    if (!counting && prev !== null && prev > 0) audio.cancel();
    lastLeft.current = counting ? left : null;
  }, [counting, left]);

  async function setMap(m: MapId) {
    if (!code) return;
    setRoomRow((r) => (r ? { ...r, map: m } : r));
    await supabase.from("rooms").update({ map: m }).eq("code", code);
  }
  async function setPref(pref: "ghost" | "hunter") {
    if (!account || !code) return;
    setPlayers((ps) => ps.map((p) => (p.id === account.id ? { ...p, pref } : p)));
    await supabase.from("players").update({ role_pref: pref }).eq("room_code", code).eq("profile_id", account.id);
  }
  async function backToLobby() {
    if (!code) return;
    await supabase.from("players").update({ role: null, status: "alive" }).eq("room_code", code);
    await supabase.from("rooms").update({ status: "lobby", countdown_until: null }).eq("code", code);
    void refresh();
  }
  async function leaveSquad() {
    if (!account || !code) return;
    await supabase.from("players").delete().eq("room_code", code).eq("profile_id", account.id);
    setSquad(""); setCode(null); setRoomRow(null); setPlayers([]); setSquadTick((x) => x + 1);
  }

  if (!account) return null;
  if (playing && room && code) {
    return <Game code={code} me={account.id} players={players} startedAt={startedAt} isHost={isHost} onBackToLobby={backToLobby} onLeave={leaveSquad} map={isMapId(room.map) ? room.map : "rumah"} />;
  }

  const myPref = players.find((p) => p.id === account.id)?.pref ?? "hunter";
  const iAmReady = readyIds.has(account.id);
  const ghostWanted = players.filter((p) => p.pref === "ghost").length;
  const actors = (players.length ? players : [{ id: account.id, nama: account.nama, karakter: account.karakter_pilihan } as GamePlayer]).slice(0, 4)
    .map((p, i) => ({ key: p.id, karakter: p.karakter, nama: p.nama, crown: i === 0 && players.length > 1, emote: emotes[p.id]?.e ?? null }));

  return (
    <main className="relative h-full min-h-full overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 70%, hsl(350 70% 18% / .7), transparent 60%), var(--background)" }}>
      {bg && (bg.media_type === "video"
        ? <video key={bg.id} src={bg.src} autoPlay muted loop playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" />
        : <img key={bg.id} src={bg.src} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
      {bg && <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/50" />}

      <header className="absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-2">
        <div className="w-52"><ProfileCorner /></div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/80 px-2 py-2 text-xs"><Users className="size-4 text-primary" />{online.length}</div>
        {isAdmin && <Link to="/admin" className="flex items-center gap-1 rounded-lg border border-gold/70 bg-card/80 px-2 py-2 text-xs font-bold text-gold"><Crown className="size-4" />ADMIN</Link>}
        <SocialPanel {...(code ? { room: code } : {})} />
        {code && <MicButton code={code} me={account.id} />}
        <MuteButton />
        <SettingsDialog />
      </header>

      {/* squad on a 3D stage */}
      <Stage3D className="absolute inset-x-[14%] bottom-[16%] top-[14%] cursor-grab" kuyang={players.some((p) => p.pref === "ghost")} actors={actors} />

      {/* emote */}
      <button onClick={() => setWheel(true)} className="absolute left-3 top-1/2 z-10 flex size-14 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-gold/70 bg-card/80 text-foreground" aria-label="Emote"><EmoteIcon id="dance" className="size-5" /><span className="text-[9px] font-bold">EMOTE</span></button>
      <EmoteWheel open={wheel} onClose={() => setWheel(false)} onPick={doEmote} />

      {/* squad list + role */}
      <div className="absolute bottom-2 left-2 z-10 flex w-52 flex-col gap-1.5">
        <div className="game-panel rounded-lg p-1.5 text-[11px]">
          <div className="mb-1 flex items-center justify-between font-bold text-gold"><span>SQUAD {players.length}/4</span>{players.length > 1 && <button onClick={() => void leaveSquad()} className="text-[10px] text-muted-foreground underline">Keluar squad</button>}</div>
          {players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1 truncate">
              {i === 0 && <Crown className="size-3 shrink-0 text-gold" />}
              <span className="truncate">{p.nama}</span>
              <span className={`ml-auto shrink-0 text-[9px] font-bold ${p.pref === "ghost" ? "text-primary" : "text-chart-4"}`}>{p.pref === "ghost" ? "HANTU" : "PEMBURU"}</span>
              <span className={`shrink-0 text-[9px] font-bold ${i === 0 || readyIds.has(p.id) ? "text-gold" : "text-muted-foreground"}`}>{i === 0 ? "KAPTEN" : readyIds.has(p.id) ? "SIAP" : "..."}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/80 p-1 text-[11px]">
          <Button size="sm" className="h-7 flex-1 px-1 text-[11px]" disabled={counting} variant={myPref === "hunter" ? "default" : "secondary"} onClick={() => void setPref("hunter")}>Pemburu</Button>
          <Button size="sm" className="h-7 flex-1 px-1 text-[11px]" disabled={counting} variant={myPref === "ghost" ? "default" : "secondary"} onClick={() => void setPref("ghost")}>Hantu Kuyang</Button>
        </div>
      </div>

      {/* map + start */}
      <div className="absolute bottom-2 right-2 z-10 flex w-60 flex-col gap-1.5">
        <div className="game-panel rounded-lg p-1.5">
          <div className="mb-1 text-center text-[10px] font-bold text-gold">MODE / MAP {isHost ? "" : "(dipilih kapten)"}</div>
          <div className="grid grid-cols-2 gap-1">
            {MAPS.map((m) => <button key={m.id} disabled={!isHost || counting} onClick={() => void setMap(m.id)} className={`truncate rounded border px-1.5 py-1 text-left text-[10px] font-bold ${room?.map === m.id ? "border-primary bg-primary/25" : "border-border bg-background/40"}`}>{m.nama}</button>)}
          </div>
        </div>
        {err && <p className="text-[10px] text-destructive">{err}</p>}
        <p className="text-center text-[9px] text-muted-foreground">{ghostWanted === 0 || players.length < 2 ? "Tidak ada hantu pemain: Hantu AI akan berburu." : "Satu hantu dipilih acak."}</p>
        {isHost ? (
          <Button size="lg" className="h-14 font-horror text-2xl glow-blood" onClick={() => void beginCountdown()} disabled={!code || !allReady || counting}>
            <Play className="size-6" /> MULAI
          </Button>
        ) : (
          <Button size="lg" className="h-14 font-horror text-2xl" variant={iAmReady ? "secondary" : "default"} disabled={counting} onClick={() => setReady(!iAmReady)}>{iAmReady ? "BATAL SIAP" : "SIAP"}</Button>
        )}
        {isHost && !allReady && <p className="text-center text-[10px] text-muted-foreground">Menunggu semua anggota SIAP...</p>}
      </div>

      {/* Free Fire-style countdown */}
      {counting && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-void/60">
          <div className="text-sm font-bold tracking-widest text-gold">PERTANDINGAN DIMULAI DALAM</div>
          <div key={left} className="font-horror text-8xl text-primary animate-in zoom-in-50 fade-in duration-300">{left}</div>
          <div className="text-xs text-muted-foreground">Map: {MAPS.find((m) => m.id === room?.map)?.nama}</div>
          <Button variant="secondary" size="lg" className="font-horror text-xl" onClick={() => void cancelCountdown()}><X className="size-5" /> BATALKAN</Button>
        </div>
      )}
    </main>
  );
}
