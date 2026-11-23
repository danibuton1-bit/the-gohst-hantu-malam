import { MicButton } from "@/components/MicButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Crown } from "lucide-react";
import { EmoteIcon, EmoteWheel } from "@/components/Art";
import { SocialPanel } from "@/components/Social";
import { EMOTE_MS, PAIR_EMOTES } from "@/lib/emotes";
import { assignRoles, isMapId, MAPS, type MapId } from "@/lib/game";
import { normalizeChar } from "@/lib/art";

const SLOT = 108;
import { useApp } from "@/components/AppState";
import { Game, type GamePlayer } from "@/components/Game";
import { MuteButton } from "@/components/MuteButton";
import { ProfileCorner } from "@/components/ProfileCorner";
import { Button } from "@/components/ui/button";
import { Stage3D } from "@/components/Stage3D";
import { isOffline, OFFLINE_MS } from "@/lib/heartbeat";
import { supabase } from "@/integrations/supabase/client";
import { audio } from "@/lib/audio";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Mencari Pemain ${params.code} - Hantu Malam` },
      { name: "description", content: `Mencari pemain untuk pertandingan horor Hantu Malam.` },
      { property: "og:title", content: `Pertandingan ${params.code} - Hantu Malam` },
      { property: "og:description", content: "Lobby mabar horor: 1 hantu melawan 3 pemburu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

type RoomRow = { code: string; host_id: string; status: string; map: string };

function RoomPage() {
  const { code } = Route.useParams();
  const { ready, account, setRoom } = useApp();
  const nav = useNavigate();
  const [room, setRoomRow] = useState<RoomRow | null | undefined>(undefined);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
    const [err, setErr] = useState("");

  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);

  const refresh = useCallback(async () => {
    const [{ data: r }, { data: ps }, { data: gs }] = await Promise.all([
      supabase.from("rooms").select("code,host_id,status,map").eq("code", code).maybeSingle(),
      supabase.from("players").select("*").eq("room_code", code).order("joined_at"),
      supabase.from("game_state").select("started_at").eq("room_code", code).maybeSingle(),
    ]);
    setRoomRow(r ?? null);
    setPlayers((ps ?? []).map((p) => ({ id: p.profile_id, nama: p.nama, username: p.username, karakter: normalizeChar(p.karakter) ?? "raka", pref: p.role_pref, role: (p.role as GamePlayer["role"]) ?? null, status: p.status })));
    if (gs?.started_at) setStartedAt(new Date(gs.started_at).getTime());
  }, [code]);

  // join
  useEffect(() => {
    if (!account) return;
    setRoom(code);
    void (async () => {
      const { data: r } = await supabase.from("rooms").select("status").eq("code", code).maybeSingle();
      if (!r) { setRoomRow(null); return; }
      const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("room_code", code);
      const { data: mine } = await supabase.from("players").select("id").eq("room_code", code).eq("profile_id", account.id).maybeSingle();
      if (!mine) {
        if ((count ?? 0) >= 4) { setErr("Pertandingan penuh, kembali ke lobby dan tekan MULAI lagi."); }
        else if (r.status !== "lobby") { setErr("Pertandingan sudah berjalan, kembali ke lobby dan tekan MULAI lagi."); }
        else await supabase.from("players").insert({ room_code: code, profile_id: account.id, nama: account.nama, username: account.username, karakter: account.karakter_pilihan });
      }
      await refresh();
    })();
    const ch = supabase.channel(`room-db-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); setRoom(null); };
  }, [account, code, refresh, setRoom]);

  async function leave() {
    if (!account) return;
    await supabase.from("players").delete().eq("room_code", code).eq("profile_id", account.id);
    void nav({ to: "/home" });
  }

  async function start() {
    if (players.length < 1 || !players.slice(1).every((p) => readyIds.has(p.id))) return;
    audio.init();
    const { roles } = assignRoles(players.map((p) => ({ id: p.id, pref: p.pref ?? "hunter" })));
    await Promise.all(players.map((p) => supabase.from("players").update({ role: roles[p.id]!, status: "alive" }).eq("room_code", code).eq("profile_id", p.id)));
    await supabase.from("game_state").upsert({ room_code: code, keys_found: 0, started_at: new Date(Date.now() + 10000).toISOString(), winner: null, updated_at: new Date().toISOString() });
    await supabase.from("rooms").update({ status: "playing" }).eq("code", code);
  }

  async function setMap(m: MapId) {
    setRoomRow((r) => (r ? { ...r, map: m } : r));
    await supabase.from("rooms").update({ map: m }).eq("code", code);
  }

  async function setPref(pref: "ghost" | "hunter") {
    if (!account) return;
    setPlayers((ps) => ps.map((p) => (p.id === account.id ? { ...p, pref } : p)));
    await supabase.from("players").update({ role_pref: pref }).eq("room_code", code).eq("profile_id", account.id);
  }

  async function backToLobby() {
    await supabase.from("players").update({ role: null, status: "alive" }).eq("room_code", code);
    await supabase.from("rooms").update({ status: "lobby" }).eq("code", code);
  }

  const lobby = room?.status === "lobby";
  useEffect(() => {
    if (!lobby) { myReady.current = false; void lobbyCh.current?.track({ ready: false }); }
  }, [lobby]);

  // lobby emotes, shared with everyone in this room
  const [emotes, setEmotes] = useState<Record<string, { e: string | null; dx: number; k: number; walk: boolean }>>({});
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [wheel, setWheel] = useState(false);
  const myReady = useRef(false);
  const lobbyCh = useRef<RealtimeChannel | null>(null);
  // heartbeat: presence = alive. Anyone missing for OFFLINE_MS is removed from the room.
  const seen = useRef<Record<string, number>>({});
  const playersRef = useRef(players); playersRef.current = players;
  useEffect(() => {
    if (!account) return;
    const joinedAt = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      if (now - joinedAt < OFFLINE_MS) return;
      for (const p of playersRef.current) {
        if (p.id === account.id) continue;
        const last = seen.current[p.id] ?? joinedAt;
        const st = lobbyCh.current?.presenceState() ?? {};
        if (st[p.id]) { seen.current[p.id] = now; continue; }
        if (isOffline(last, now)) { delete seen.current[p.id]; void supabase.from("players").delete().eq("room_code", code).eq("profile_id", p.id); }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [account, code]);
  const playEmote = useCallback((id: string, e: string, target: string | null) => {
    const ids = players.map((p) => p.id);
    const ai = ids.indexOf(id), ti = target ? ids.indexOf(target) : -1;
    const k = Math.random();
    const dx = ti >= 0 ? (ti - ai) * SLOT - Math.sign(ti - ai) * 46 : 0;
    const clear = () => setEmotes((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.k !== k)));
    if (ti >= 0 && target) {
      // walk over first (legs step), then play the pair emote together
      setEmotes((m) => ({ ...m, [id]: { e: null, dx, k, walk: true } }));
      setTimeout(() => setEmotes((m) => ({ ...m, [id]: { e, dx, k, walk: false }, [target]: { e, dx: 0, k, walk: false } })), 850);
      setTimeout(clear, 850 + EMOTE_MS);
    } else {
      setEmotes((m) => ({ ...m, [id]: { e, dx: 0, k, walk: false } }));
      setTimeout(clear, EMOTE_MS);
    }
  }, [players]);
  const playRef = useRef(playEmote); playRef.current = playEmote;
  useEffect(() => {
    if (!account) return;
    const ch = supabase.channel(`room-lobby-${code}`, { config: { broadcast: { self: false }, presence: { key: account.id } } });
    ch.on("broadcast", { event: "emote" }, ({ payload }) => { const p = payload as { id: string; e: string; t: string | null }; playRef.current(p.id, p.e, p.t); });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ ready: boolean }>();
      const now = Date.now(); for (const id of Object.keys(st)) seen.current[id] = now;
      setReadyIds(new Set(Object.entries(st).filter(([, v]) => v.some((x) => x.ready)).map(([id]) => id)));
    });
    ch.subscribe((status) => { if (status === "SUBSCRIBED") { lobbyCh.current = ch; void ch.track({ ready: myReady.current }); } });
    return () => { lobbyCh.current = null; void supabase.removeChannel(ch); };
  }, [code, account]);
  function toggleReady() {
    myReady.current = !myReady.current;
    if (account) setReadyIds((r) => { const n = new Set(r); if (myReady.current) n.add(account.id); else n.delete(account.id); return n; });
    void lobbyCh.current?.track({ ready: myReady.current });
  }
  function doEmote(e: string) {
    if (!account) return;
    const ids = players.map((p) => p.id); const me = ids.indexOf(account.id);
    let t: string | null = null;
    if (PAIR_EMOTES.includes(e) && ids.length > 1) t = ids.filter((x) => x !== account.id).sort((x, y) => Math.abs(ids.indexOf(x) - me) - Math.abs(ids.indexOf(y) - me))[0] ?? null;
    playEmote(account.id, e, t);
    void lobbyCh.current?.send({ type: "broadcast", event: "emote", payload: { id: account.id, e, t } });
  }

  if (!account || room === undefined) return <main className="p-6 text-center text-muted-foreground">Memuat room...</main>;
  if (room === null) return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="font-horror text-3xl text-primary">PERTANDINGAN TIDAK ADA</h1>
      <Button asChild><Link to="/home">Kembali</Link></Button>
    </main>
  );

  const isHost = players[0]?.id === account.id;
  const inRoom = players.some((p) => p.id === account.id);
  if (room.status !== "lobby" && inRoom && players.every((p) => p.role)) {
    return <Game code={code} me={account.id} players={players} startedAt={startedAt} isHost={isHost} onBackToLobby={backToLobby} onLeave={leave} map={isMapId(room.map) ? room.map : "rumah"} />;
  }

  const myPref = players.find((p) => p.id === account.id)?.pref ?? "hunter";
  const allReady = players.slice(1).every((p) => readyIds.has(p.id));
  const ghostWanted = players.filter((p) => p.pref === "ghost").length;
  return (
    <main className="relative flex h-full min-h-full flex-col items-center justify-center gap-3 p-4">
      <header className="absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-2"><div className="w-56"><ProfileCorner /></div><div className="flex-1" /><SocialPanel room={code} /><MicButton code={code} me={account.id} /><MuteButton /></header>
      <button onClick={leave} className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Keluar</button>
      <h1 className="font-horror text-3xl text-primary">LOBBY {code}</h1>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Stage3D className="h-[38cqh] min-h-40 w-full max-w-2xl cursor-grab" kuyang={players.some((p) => p.pref === "ghost")} actors={players.slice(0, 4).map((p, i) => ({ key: p.id, karakter: p.karakter, nama: p.nama, crown: i === 0, emote: emotes[p.id]?.e ?? null, walk: emotes[p.id]?.walk ?? false }))} />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => { const p = players[i]; return (
          <div key={i} className="flex w-24 flex-col items-center rounded-md border border-border bg-card/80 px-1 py-0.5">
            {p ? <>
              <div className="flex w-full items-center justify-center gap-1 truncate text-xs font-bold">{i === 0 && <Crown className="size-3 text-gold" />}{p.nama}</div>
              <div className={`text-[10px] font-bold ${p.pref === "ghost" ? "text-primary" : "text-chart-4"}`}>{p.pref === "ghost" ? "INGIN JADI HANTU" : "PEMBURU"}</div>
              <div className={`text-[10px] font-bold ${i === 0 || readyIds.has(p.id) ? "text-gold" : "text-muted-foreground"}`}>{i === 0 ? "KAPTEN" : readyIds.has(p.id) ? "SIAP" : "BELUM SIAP"}</div>
            </> : <div className="py-2 text-xs text-muted-foreground">+ kosong</div>}
          </div>
        ); })}
      </div>
      <div className="w-full max-w-md rounded-lg border border-gold/50 bg-card/80 p-2">
        <div className="mb-1 text-center text-xs font-bold text-gold">MODE / MAP {isHost ? "(kapten memilih)" : ""}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {MAPS.map((m) => <button key={m.id} disabled={!isHost} onClick={() => void setMap(m.id)} className={`rounded-md border p-1.5 text-left text-[11px] ${room.map === m.id ? "border-primary bg-primary/25" : "border-border bg-background/40"} ${isHost ? "" : "cursor-default"}`}><div className="font-bold">{m.nama}</div><div className="text-muted-foreground">{m.desc}</div></button>)}
        </div>
      </div>
      {inRoom && <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 p-1.5 text-xs">
        <span className="text-muted-foreground">Pilih peran:</span>
        <Button size="sm" variant={myPref === "hunter" ? "default" : "secondary"} onClick={() => void setPref("hunter")}>Pemburu</Button>
        <Button size="sm" variant={myPref === "ghost" ? "default" : "secondary"} onClick={() => void setPref("ghost")}>Hantu Kuyang</Button>
      </div>}
      {inRoom && <button onClick={() => setWheel(true)} className="flex items-center gap-1 rounded-full border-2 border-gold/70 bg-card/80 px-4 py-2 text-xs font-bold"><EmoteIcon id="dance" className="size-4" /> EMOTE</button>}
      <EmoteWheel open={wheel} onClose={() => setWheel(false)} onPick={doEmote} />
      <p className="text-center text-xs text-muted-foreground">{players.length}/4 pemain · {ghostWanted === 0 || players.length < 2 ? "Tidak ada yang jadi hantu: Hantu AI akan berburu kalian." : "Satu hantu dipilih acak dari yang ingin jadi hantu."}</p>
      {isHost ? <>
        <Button className="glow-blood font-horror text-xl" size="lg" onClick={start} disabled={!allReady}>MULAI PERMAINAN</Button>
        {!allReady && <p className="text-xs text-muted-foreground">Menunggu semua pemain menekan SIAP...</p>}
      </> : inRoom && <div className="flex flex-col items-center gap-1">
        <Button size="lg" variant={readyIds.has(account.id) ? "secondary" : "default"} className="font-horror text-xl" onClick={toggleReady}>{readyIds.has(account.id) ? "BATAL SIAP" : "SIAP"}</Button>
        <p className="text-xs text-muted-foreground">{readyIds.has(account.id) ? "Menunggu host memulai permainan..." : "Tekan SIAP kalau kamu sudah siap main."}</p>
      </div>}
    </main>
  );
}
