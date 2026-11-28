import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Battery, Ghost, KeyRound, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { batterySvg, characterSvg, CHARACTERS, exclaimSvg, ghostSvg, keySvg, kuntilanakSvg, hoodieSvg, loadImg, pocongSvg, type CharId } from "@/lib/art";
import { audio } from "@/lib/audio";
import { BATTERIES, BOT_GHOST_ID, BOT_PATROL, CATCH_DIST, ROOMS, WALLS, WORLD, decideOutcome, EXIT, GAME_SECONDS, GHOST_SPAWN, HUNTER_SPAWNS, KEYS, move, npcsAt, roomAt, TOTAL_KEYS, applyMap, liftAt, liftExit, LIFTS, MAP_ID, MAPS, DOORS, doorOpen, doorUsed, setDoorOpen, nearestDoor, FLOOR2_H, FLOOR2_Y, type MapId } from "@/lib/game";
import { CharImg, EmoteIcon, EmoteWheel } from "./Art";
import { Bubble } from "./Social";
import { Joystick } from "./Joystick";
import { createScene, LOW_END } from "@/lib/scene3d";
import { MicButton } from "./MicButton";
import { toContent } from "@/lib/orient";
import { PAIR_EMOTES, emoteLabel } from "@/lib/emotes";
import { MuteButton } from "./MuteButton";
import { Button } from "./ui/button";
import { SurvivalRadio } from "./SurvivalRadio";
import { createHouseNavigator, HOUSE, houseHeight, housePoint, housePath, moveHouse } from "@/lib/house";

export type GamePlayer = { id: string; nama: string; username: string; karakter: CharId; role: "ghost" | "hunter" | null; status: string; pref?: string };
type Live = { h: number; th: number; yaw: number; x: number; y: number; tx: number; ty: number; status: string; shoutUntil: number; moving: boolean; battery: number; pitch: number; emote: string | null; emoteUntil: number };

const HUNTER_SPEED = 150, GHOST_SPEED = 168;
export const BOT_MATE_PREFIX = "bot-mate-";
const BOT_NAMES = ["Bot Dimas", "Bot Sari", "Bot Yoga"];
/** Squad is always 4: empty human slots are filled with hunter bots (same list on every client). */
export function squadBots(players: { karakter: string }[]): GamePlayer[] {
  const used = new Set(players.map((p) => p.karakter));
  const free = (Object.keys(CHARACTERS) as CharId[]).filter((c) => !used.has(c));
  const n = Math.max(0, 4 - players.length);
  return Array.from({ length: n }, (_, i) => ({ id: `${BOT_MATE_PREFIX}${i}`, nama: BOT_NAMES[i]!, username: "", karakter: free[i % Math.max(1, free.length)] ?? "raka", role: "hunter" as const, status: "alive" }));
}

export function Game({ code, me, players, startedAt, isHost, onBackToLobby, onLeave, map = "rumah" }: {
  code: string; me: string; players: GamePlayer[]; startedAt: number; isHost: boolean; onBackToLobby: () => void; onLeave: () => void; map?: MapId;
}) {
  const [houseLoaded, setHouseLoaded] = useState(map !== "rumah");
  const [onLift, setOnLift] = useState(false);
  const [riding, setRiding] = useState(false);
  const liftRef = useRef<(dir?: "up" | "down") => void>(() => {});
  const doorRef = useRef<(i?: number) => void>(() => {});
  const [nearDoor, setNearDoor] = useState<{ i: number; open: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joy = useRef({ x: 0, y: 0 });
  const keysDown = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({ time: GAME_SECONDS, keys: 0, battery: 100, statuses: {} as Record<string, string>, near: 0, room: "", cd: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"hunters" | "ghost" | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const shoutRef = useRef<() => void>(() => {});
  const emoteRef = useRef<(e: string) => void>(() => {});
  const [bubbles, setBubbles] = useState<{ k: number; nama: string; e: string; target?: string }[]>([]);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const chatRef = useRef<(t: string) => void>(() => {});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatLog, setChatLog] = useState<{ k: number; id: string; sender_nama: string; body: string }[]>([]);
  const all = useMemo<GamePlayer[]>(() => {
    const ghost: GamePlayer[] = players.some((p) => p.role === "ghost") ? [] : [{ id: BOT_GHOST_ID, nama: "Hantu AI", username: "", karakter: "raka", role: "ghost", status: "alive" }];
    return [...players, ...squadBots(players), ...ghost];
  }, [players]);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [scare, setScare] = useState(0);
  const ambushRef = useRef<() => void>(() => {});

  const meP = players.find((p) => p.id === me)!;
  const amGhost = meP.role === "ghost";

  useEffect(() => { setIsTouch(window.matchMedia("(pointer: coarse)").matches); }, []);

  useEffect(() => {
    applyMap(map);
    audio.init(); audio.startMusic();
    const hunters = all.filter((p) => p.role === "hunter");
    const live: Record<string, Live> = {};
    all.forEach((p) => {
      const s = p.role === "ghost" ? GHOST_SPAWN : HUNTER_SPAWNS[hunters.indexOf(p) % 3]!;
      live[p.id] = { h: s.h ?? 0, th: s.h ?? 0, yaw: p.role === "ghost" ? 0 : Math.PI, x: s.x, y: s.y, tx: s.x, ty: s.y, status: "alive", shoutUntil: 0, moving: false, battery: 100, pitch: 0, emote: null, emoteUntil: 0 };
    });
    let keyMask = 0, batMask = 0, ended = false, lastSend = 0, lastStep = 0, stunUntil = 0, npcCd = 0;
    const meL = live[me]!;
    const step = (l: Live, dx: number, dy: number) => { const p = move(l.x, l.y, dx, dy, 18, l.h); l.h = p.h ?? l.h; return p; };
    const navigators = new Map<string, ReturnType<typeof createHouseNavigator>>();
    const navigate = (id: string, l: Live, x: number, y: number, h = houseHeight(x, y)) => {
      if (map !== "rumah") return { x, y, h };
      let nav = navigators.get(id); if (!nav) { nav = createHouseNavigator(); navigators.set(id, nav); }
      return nav(l, { x, y, h });
    };
    const distance = (a: { x: number; y: number; h?: number }, b: { x: number; y: number; h?: number }) => Math.hypot(a.x - b.x, a.y - b.y, map === "rumah" ? ((a.h ?? 0) - (b.h ?? 0)) * 50 : 0);
    const url = (svg: string) => loadImg(svg).src;
    const imgUrls: Record<string, string> = { ghost: url(ghostSvg()), kunti: url(kuntilanakSvg()), hoodie: url(hoodieSvg()), pocong: url(pocongSvg()), key: url(keySvg()), bat: url(batterySvg()), ex: url(exclaimSvg()) };
    (Object.keys(CHARACTERS) as CharId[]).forEach((c) => { imgUrls[c] = url(characterSvg(c)); });
    const sc = createScene(canvasRef.current!, { me: amGhost ? "ghost" : meP.karakter, amGhost, imgs: imgUrls, map });
    all.forEach((p) => { if (p.id !== me) sc.ensurePlayer(p.id, p.role === "ghost" ? "ghost" : p.karakter, p.role !== "ghost", p.nama); });
    sc.resize(); const onResize = () => sc.resize(); window.addEventListener("resize", onResize);
    let pitch = 0;
    const cv = canvasRef.current!;
    const look = (dx: number, dy: number) => { meL.yaw -= dx * 0.0042; pitch = Math.max(-1.1, Math.min(1.1, pitch - dy * 0.0042)); };
    const onMouse = (e: MouseEvent) => { if (document.pointerLockElement === cv) look(e.movementX * 0.6, e.movementY * 0.6); };
    const onClick = () => { if (!window.matchMedia("(pointer: coarse)").matches) void cv.requestPointerLock?.(); };
    let touchId: number | null = null, tx0 = 0, ty0 = 0;
    const onPD = (e: PointerEvent) => { if (e.pointerType === "mouse") return; touchId = e.pointerId; tx0 = e.clientX; ty0 = e.clientY; };
    const onPM = (e: PointerEvent) => { if (e.pointerId !== touchId) return; const d = toContent(e.clientX - tx0, e.clientY - ty0); look(d.x * 1.4, d.y * 1.4); tx0 = e.clientX; ty0 = e.clientY; };
    let tapX = 0, tapY = 0;
    const onPU = (e: PointerEvent) => { if (e.pointerId === touchId) touchId = null; };
    const onTapStart = (e: PointerEvent) => { tapX = e.clientX; tapY = e.clientY; };
    // tap / click on a door or a lift button in the 3D world; with pointer lock, click aims at the crosshair
    const onTapEnd = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > 12) return;
      const r = cv.getBoundingClientRect(); const locked = document.pointerLockElement === cv;
      const hit = sc.pick(locked ? r.left + r.width / 2 : e.clientX, locked ? r.top + r.height / 2 : e.clientY);
      if (!hit) return;
      if (hit.startsWith("door:")) doorRef.current(Number(hit.slice(5))); else liftRef.current(hit as "up" | "down");
    };
    cv.addEventListener("pointerdown", onTapStart); cv.addEventListener("pointerup", onTapEnd);
    document.addEventListener("mousemove", onMouse); cv.addEventListener("click", onClick);
    cv.addEventListener("pointerdown", onPD); window.addEventListener("pointermove", onPM); window.addEventListener("pointerup", onPU);
    let toastTimer = 0;
    const notify = (m: string) => { setToast(m); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => setToast(null), 2600); };

    const ch = supabase.channel(`game-${code}`, { config: { broadcast: { self: false } } });
    const setStatus = (id: string, s: string) => {
      const l = live[id]; if (!l || l.status === s || l.status !== "alive") return;
      l.status = s;
      if (s === "caught") { audio.scream(); if (id === me) notify("KAMU TERTANGKAP! Sekarang kamu jadi penonton."); else notify(`${all.find((p) => p.id === id)?.nama} tertangkap!`); }
      if (s === "escaped") notify(`${all.find((p) => p.id === id)?.nama} berhasil kabur!`);
      if (id === me) void supabase.from("players").update({ status: s }).eq("room_code", code).eq("profile_id", me);
    };
    const gainKeys = (mask: number, local: boolean) => {
      const fresh = mask & ~keyMask;
      if (!fresh) return;
      keyMask |= mask;
      KEYS.forEach((k) => { if (fresh & (1 << k.id)) { audio.pickup(); notify(local ? `Kamu dapat ${k.name}!` : `Tim dapat ${k.name}!`); } });
      if (keyMask === 31) { audio.creak(); setTimeout(() => notify(`Semua kunci terkumpul! Kabur lewat gerbang di ${ROOMS[5]!.name}!`), 1200); }
    };
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id: string; a?: number; p?: number; x: number; y: number; h?: number; m: boolean; st: string; k: number; b: number };
      const l = live[p.id]; if (!l) return;
      l.tx = p.x; l.ty = p.y; l.th = p.h ?? l.h; l.moving = p.m; if (p.a !== undefined) l.yaw = p.a; if (p.p !== undefined) l.pitch = p.p;
      if (p.st !== "alive") setStatus(p.id, p.st);
      gainKeys(p.k, false); batMask |= p.b;
    });
    let droneAt = 0; const droneSt = { x: 0, y: 0, h: 0, yaw: 0 };
    ch.on("broadcast", { event: "drone" }, ({ payload }) => { Object.assign(droneSt, payload as typeof droneSt); droneAt = performance.now(); });
    ch.on("broadcast", { event: "door" }, ({ payload }) => { const p = payload as { i: number; o: boolean }; setDoorOpen(p.i, !!p.o); });
    ch.on("broadcast", { event: "lift" }, ({ payload }) => { const p = payload as { to: 1 | 2 }; if (!liftS.moving) startLift(p.to, false, false); });
    ch.on("broadcast", { event: "caught" }, ({ payload }) => setStatus((payload as { id: string }).id, "caught"));
    ch.on("broadcast", { event: "shout" }, ({ payload }) => { const l = live[(payload as { id: string }).id]; if (l) { l.shoutUntil = performance.now() + 2500; audio.shout(); } });
    const showEmote = (id: string, e: string, t?: string) => {
      const until = performance.now() + 2600;
      const la = live[id]; if (la) { la.emote = e; la.emoteUntil = until + (t ? 900 : 0); }
      const lt = t ? live[t] : undefined; if (lt && PAIR_EMOTES.includes(e)) { lt.emote = e; lt.emoteUntil = until + 900; }
      const k = Math.random(); const nm = (x: string) => (x === me ? "Kamu" : all.find((p) => p.id === x)?.nama ?? "?");
      setBubbles((b) => [...b.slice(-3), { k, nama: nm(id), e, ...(t ? { target: nm(t) } : {}) }]);
      setTimeout(() => setBubbles((b) => b.filter((x) => x.k !== k)), 2600);
    };
    ch.on("broadcast", { event: "emote" }, ({ payload }) => { const p = payload as { id: string; e: string; t?: string }; showEmote(p.id, p.e, p.t); });
    ch.subscribe();
    const send = (event: string, payload: object) => void ch.send({ type: "broadcast", event, payload });

    let emoteCd = 0, walkTo: { x: number; y: number; until: number } | null = null;
    emoteRef.current = (e: string) => {
      const n = performance.now(); if (n < emoteCd) return; emoteCd = n + 1200;
      let target: string | undefined;
      if (PAIR_EMOTES.includes(e)) {
        const near = Object.entries(live).filter(([id, l]) => id !== me && id !== BOT_GHOST_ID && l.status === "alive").map(([id, l]) => ({ id, l, d: Math.hypot(l.x - meL.x, l.y - meL.y) })).sort((x, y) => x.d - y.d)[0];
        if (near && near.d < 300) { target = near.id; walkTo = { x: near.l.x, y: near.l.y, until: n + 1500 }; }
      }
      showEmote(me, e, target); void ch.send({ type: "broadcast", event: "emote", payload: { id: me, e, t: target } });
    };
    chatRef.current = (body: string) => { const t = body.trim().slice(0, 120); if (!t) return; addChat(me, t); void ch.send({ type: "broadcast", event: "chat", payload: { id: me, t } }); };
    const addChat = (id: string, t: string) => { const k = Math.random(); const nama = id === me ? "Kamu" : all.find((p) => p.id === id)?.nama ?? "?"; setChatLog((c) => [...c.slice(-5), { k, id, sender_nama: nama, body: t }]); setTimeout(() => setChatLog((c) => c.filter((x) => x.k !== k)), 12000); };
    ch.on("broadcast", { event: "chat" }, ({ payload }) => { const p = payload as { id: string; t: string }; addChat(p.id, String(p.t).slice(0, 120)); });
    // jump-in: the ghost appears right in front of a hunter
    const ambush = (g: Live) => {
      const prey = Object.entries(live).filter(([id, l]) => id !== BOT_GHOST_ID && l !== g && l.status === "alive" && all.find((p) => p.id === id)?.role === "hunter")
        .map(([, l]) => ({ l, d: distance(l, g) })).filter((o) => o.d < 520).sort((a, b) => a.d - b.d)[0];
      if (!prey) return false;
      const p = move(prey.l.x, prey.l.y, -Math.sin(prey.l.yaw) * 75, -Math.cos(prey.l.yaw) * 75, 18, prey.l.h);
      if (Math.hypot(p.x - prey.l.x, p.y - prey.l.y) < 45) return false;
      g.x = g.tx = p.x; g.y = g.ty = p.y; g.h = g.th = p.h ?? prey.l.h; g.yaw = prey.l.yaw + Math.PI;
      return true;
    };
    let ghostAmbushCd = 0;
    ambushRef.current = () => {
      const n = performance.now(); if (n < ghostAmbushCd) { notify(`Kagetkan siap dalam ${Math.ceil((ghostAmbushCd - n) / 1000)} detik`); return; }
      if (ambush(meL)) { ghostAmbushCd = n + 25000; stunUntil = n + 700; audio.creak(); } else notify("Tidak ada pemburu di dekatmu.");
    };
    let scareCd = 0, lastGhostD = 9999;
    // AI ghost (simulated by the host when nobody plays the ghost)
    const bot = live[BOT_GHOST_ID];
    let botWp = 0, botDir = 0, botStuck = 0, botSend = 0, botAmbushAt = performance.now() + 25000, botFreeze = 0, botRecoilCd = 0;
    const runBot = (now: number, dt: number) => {
      if (!bot) return;
      if (now > botAmbushAt) { botAmbushAt = now + 30000 + Math.random() * 20000; if (ambush(bot)) botFreeze = now + 900; }
      if (now < botFreeze) { bot.moving = false; if (now - botSend > 100) { botSend = now; send("pos", { id: BOT_GHOST_ID, x: Math.round(bot.x), y: Math.round(bot.y), h: bot.h, a: Math.round(bot.yaw * 100) / 100, m: false, st: "alive", k: 0, b: 0 }); } return; }
      const prey = Object.entries(live).filter(([id, l]) => id !== BOT_GHOST_ID && l.status === "alive")
        .map(([, l]) => ({ l, d: distance(l, bot) })).filter((o) => o.d < 380 || now < o.l.shoutUntil).sort((a, b) => a.d - b.d)[0];
      // after startling a hunter up close, the Kuyang recoils away and lets go for 4 s
      if (prey && prey.d < 110 && now > botRecoilCd) {
        botRecoilCd = now + 9000; botFreeze = now + 4000;
        const ax = bot.x - prey.l.x, ay = bot.y - prey.l.y, al = Math.hypot(ax, ay) || 1;
        const rp = step(bot, (ax / al) * 140, (ay / al) * 140); bot.x = bot.tx = rp.x; bot.y = bot.ty = rp.y; return;
      }
      let tx: number, ty: number;
      if (prey) { tx = prey.l.x; ty = prey.l.y; } else { const w = BOT_PATROL[botWp]!; tx = w[0]; ty = w[1]; if (Math.hypot(tx - bot.x, ty - bot.y) < 40) botWp = (botWp + 1) % BOT_PATROL.length; }
      if (MAP_ID === "hotel" && (ty < 500) !== (bot.y < 500)) {
        // other floor: walk to this floor's lift and ride it
        const l = LIFTS[bot.y < 500 ? 0 : 1]!, o = LIFTS[bot.y < 500 ? 1 : 0]!;
        if (distance(l, bot) < 30) { bot.x = bot.tx = o.x; bot.y = bot.ty = o.y; if (!prey) botWp = (botWp + 1) % BOT_PATROL.length; }
        tx = l.x; ty = l.y;
      }
      const target = navigate(BOT_GHOST_ID, bot, tx, ty, prey?.l.h ?? houseHeight(tx, ty)); tx = target.x; ty = target.y;
      let ang = Math.atan2(ty - bot.y, tx - bot.x) + (map === "rumah" ? 0 : botDir);
      const sp = GHOST_SPEED * (prey ? 0.6 : 0.5) * dt;
      const p = step(bot, Math.cos(ang) * sp, Math.sin(ang) * sp);
      if (Math.hypot(p.x - bot.x, p.y - bot.y) < sp * 0.3) { botStuck += dt; if (botStuck > 0.25) { botDir = botDir ? -botDir : Math.PI / 2; botStuck = 0; } } else if (botDir && Math.random() < dt * 0.8) botDir = 0;
      ang = Math.atan2(p.y - bot.y, p.x - bot.x);
      bot.x = bot.tx = p.x; bot.y = bot.ty = p.y; bot.th = bot.h; bot.moving = true; bot.yaw = -ang - Math.PI / 2;
      // AI ghost only startles: touching a hunter sends it back to a far patrol point
      if (Object.entries(live).some(([id, l]) => id !== BOT_GHOST_ID && l.status === "alive" && distance(l, bot) < CATCH_DIST)) {
        botWp = Math.floor(Math.random() * BOT_PATROL.length); const w = BOT_PATROL[(botWp + 6) % BOT_PATROL.length]!; const pp = move(w[0], w[1], 0, 0, 18, houseHeight(w[0], w[1])); bot.x = bot.tx = pp.x; bot.y = bot.ty = pp.y; bot.h = bot.th = pp.h ?? bot.h; botFreeze = now + 3000;
      }
      if (now - botSend > 100) { botSend = now; send("pos", { id: BOT_GHOST_ID, x: Math.round(bot.x), y: Math.round(bot.y), h: bot.h, a: Math.round(bot.yaw * 100) / 100, m: true, st: "alive", k: 0, b: 0 }); }
    };
    // hunter bots (host simulates them, like the AI ghost): grab keys, flee the ghost, escape when the gate opens
    const mates = all.filter((p) => p.id.startsWith(BOT_MATE_PREFIX)).map((p, i) => ({ id: p.id, l: live[p.id]!, dir: 0, stuck: 0, send: 0, wander: (i * 3) % BOT_PATROL.length, scared: 0 }));
    const runMates = (now: number, dt: number) => {
      const ghostId = all.find((p) => p.role === "ghost")?.id; const g = ghostId ? live[ghostId] : undefined;
      for (const b of mates) {
        const l = b.l;
        if (l.status === "alive") {
          let tx: number, ty: number, targetH: number | undefined, sp = HUNTER_SPEED * 0.85;
          const gd = g ? distance(g, l) : 9999;
          if (g && gd < 170) { // run away and shout
            tx = l.x + (l.x - g.x) * 2; ty = l.y + (l.y - g.y) * 2; sp = HUNTER_SPEED;
            if (now > b.scared) { b.scared = now + 6000; l.shoutUntil = now + 2500; send("shout", { id: b.id }); }
          } else if (keyMask === 31) { tx = EXIT.x; ty = EXIT.y; targetH = EXIT.h; }
          else {
            const k = KEYS.filter((key) => !(keyMask & (1 << key.id))).sort((a, c) => distance(a, l) - distance(c, l))[mates.indexOf(b) % 2];
            if (k) { tx = k.x; ty = k.y; targetH = k.h; } else { const w = BOT_PATROL[b.wander]!; tx = w[0]; ty = w[1]; if (Math.hypot(tx - l.x, ty - l.y) < 40) b.wander = (b.wander + 1) % BOT_PATROL.length; }
          }
          if (MAP_ID === "hotel" && (ty < 500) !== (l.y < 500)) {
            const a = LIFTS[l.y < 500 ? 0 : 1]!, o = LIFTS[l.y < 500 ? 1 : 0]!;
            if (Math.hypot(a.x - l.x, a.y - l.y) < 30) { const ex = liftExit(o); l.x = l.tx = ex.x; l.y = l.ty = ex.y; }
            tx = a.x; ty = a.y;
          }
          const target = navigate(b.id, l, tx, ty, targetH ?? houseHeight(tx, ty)); tx = target.x; ty = target.y;
          let ang = Math.atan2(ty - l.y, tx - l.x) + (map === "rumah" ? 0 : b.dir);
          const st = sp * dt; const p = step(l, Math.cos(ang) * st, Math.sin(ang) * st);
          if (Math.hypot(p.x - l.x, p.y - l.y) < st * 0.3) { b.stuck += dt; if (b.stuck > 0.25) { b.dir = b.dir ? -b.dir : Math.PI / 2; b.stuck = 0; } } else if (b.dir && Math.random() < dt * 0.8) b.dir = 0;
          ang = Math.atan2(p.y - l.y, p.x - l.x);
          l.x = l.tx = p.x; l.y = l.ty = p.y; l.th = l.h; l.moving = true; l.yaw = -ang - Math.PI / 2;
          KEYS.forEach((key) => { if (!(keyMask & (1 << key.id)) && distance(key, l) < 34) gainKeys(1 << key.id, false); });
          if (keyMask === 31 && distance(EXIT, l) < EXIT.r) setStatus(b.id, "escaped");
          else if (ghostId && ghostId !== BOT_GHOST_ID && gd < CATCH_DIST) { setStatus(b.id, "caught"); send("caught", { id: b.id }); }
        } else l.moving = false;
        if (now - b.send > 100) { b.send = now; send("pos", { id: b.id, x: Math.round(l.x), y: Math.round(l.y), h: l.h, a: Math.round(l.yaw * 100) / 100, m: l.moving, st: l.status, k: keyMask, b: 0 }); }
      }
    };
    let mapT = 0;
    const drawMap = () => {
      const c = mapRef.current; const g = c?.getContext("2d"); if (!c || !g) return;
      const s = c.width / WORLD.w; g.clearRect(0, 0, c.width, c.height);
      for (const r of ROOMS) { g.fillStyle = r.name === roomAt(meL.x, meL.y) ? "rgba(120,40,50,.55)" : "rgba(40,30,40,.6)"; g.fillRect(r.x * s, r.y * s, r.w * s, r.h * s); }
      g.fillStyle = "#8a7a80"; for (const w of WALLS) g.fillRect(w.x * s, w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s));
      g.fillStyle = "#e8b730"; KEYS.forEach((k) => { if (!(keyMask & (1 << k.id))) { g.beginPath(); g.arc(k.x * s, k.y * s, 3.2, 0, 7); g.fill(); } });
      g.fillStyle = "#79e07a"; BATTERIES.forEach((b) => { if (!(batMask & (1 << b.id))) g.fillRect(b.x * s - 1.5, b.y * s - 2.5, 3, 5); });
      g.strokeStyle = keyMask === 31 ? "#59e36b" : "#c4121f"; g.lineWidth = 2; g.beginPath(); g.arc(EXIT.x * s, EXIT.y * s, 5, 0, 7); g.stroke();
      for (const p of all) { const l = live[p.id]!; if (p.id === me || l.status !== "alive") continue; if (p.role === "ghost" && !amGhost) continue; g.fillStyle = p.role === "ghost" ? "#b06cff" : "#6ec3ff"; g.beginPath(); g.arc(l.x * s, l.y * s, 2.6, 0, 7); g.fill(); }
      g.save(); g.translate(meL.x * s, meL.y * s); g.rotate(-meL.yaw); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore();
    };
    shoutRef.current = () => {
      if (meL.status !== "alive" || performance.now() < meL.shoutUntil) return;
      meL.shoutUntil = performance.now() + 2500; audio.shout(); send("shout", { id: me });
    };
    const kd = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; if (e.key === " " ) shoutRef.current(); if (e.key.toLowerCase() === "e") { if (liftAt(meL.x, meL.y)) liftRef.current(); else doorRef.current(); } if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    let liftOn = false;
    // ---- doors: closed until someone clicks them (synced over broadcast)
    const toggleDoor = (i: number, open: boolean) => { setDoorOpen(i, open); send("door", { i, o: open }); };
    let doorLock = 0;
    doorRef.current = (i?: number) => {
      if (meL.status !== "alive") return;
      const nowD = performance.now(); if (nowD < doorLock) return; doorLock = nowD + 350;
      const idx = i ?? nearestDoor(meL.x, meL.y, 140, meL.h); const d = DOORS[idx];
      if (!d || (d.h !== undefined && Math.abs(d.h - meL.h) > .5) || Math.hypot(d.x - meL.x, d.y - meL.y) > 160) { if (i === undefined) notify("Dekati pintu dulu."); return; }
      toggleDoor(idx, !doorOpen[idx]); audio.click(); audio.creak();
    };
    // ---- hotel lift: one physical cabin riding a vertical shaft between floor 1 (0 m) and floor 2 (FLOOR2_H)
    const floorOf = (y: number) => (y >= FLOOR2_Y ? 2 : 1) as 1 | 2;
    const liftS = { f: 1 as 1 | 2, to: 1 as 1 | 2, y: 0, from: 0, t0: 0, moving: false, riding: false, doors: [0, 0] };
    const LIFT_MS = 2600, DOOR_CLOSE_MS = 900;
    function startLift(to: 1 | 2, riding: boolean, broadcast = true) {
      if (liftS.moving || (liftS.f === to && !riding)) return;
      liftS.moving = true; liftS.riding = riding; liftS.to = to; liftS.from = liftS.y; liftS.t0 = performance.now() + DOOR_CLOSE_MS;
      audio.creak(); if (riding) setRiding(true);
      if (broadcast) send("lift", { to });
    }
    liftRef.current = (dir?: "up" | "down") => {
      const l = liftAt(meL.x, meL.y); if (!l || liftS.moving || meL.status !== "alive") return;
      if (liftS.f !== l.floor) { notify("Tunggu lift datang..."); return; }
      const to = (l.floor === 1 ? 2 : 1) as 1 | 2;
      if (dir && (dir === "up") !== (to === 2)) { notify(`Kamu sudah di Lantai ${l.floor}`); return; }
      startLift(to, true);
    };
    const runLift = (now: number, dt: number) => {
      if (MAP_ID !== "hotel") return;
      if (liftS.moving) {
        const k = Math.max(0, Math.min(1, (now - liftS.t0) / LIFT_MS)), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        liftS.y = liftS.from + ((liftS.to === 2 ? FLOOR2_H : 0) - liftS.from) * e;
        if (k >= 1) {
          liftS.moving = false; liftS.f = liftS.to;
          if (liftS.riding) { const o = LIFTS[liftS.to - 1]!; meL.x = meL.tx = o.x; meL.y = meL.ty = o.y; liftS.riding = false; setRiding(false); audio.pickup(); notify(`Ding! Lantai ${liftS.to}`); }
        }
      } else if (meL.status === "alive") {
        // call the cabin when you walk up to the landing on another floor
        const mf = floorOf(meL.y), pad = LIFTS[mf - 1]!;
        if (liftS.f !== mf && Math.hypot(pad.x - meL.x, pad.y - meL.y) < 150) startLift(mf, false);
      }
      LIFTS.forEach((pad, i) => {
        const here = !liftS.moving && !liftS.riding && liftS.f === i + 1 && Math.hypot(pad.x - meL.x, pad.y - meL.y) < 160;
        liftS.doors[i]! += ((here ? 1 : 0) - liftS.doors[i]!) * Math.min(1, dt * (here ? 3 : 6));
      });
    };
    let doorT = 0;
    const botDoors = (now: number) => {
      // bots open closed doors they walk up to (host only, synced like a player click)
      if (now - doorT < 250) return; doorT = now;
      for (const p of all) if (p.id === BOT_GHOST_ID || p.id.startsWith(BOT_MATE_PREFIX)) {
        const l = live[p.id]!; if (l.status !== "alive") continue;
        const i = nearestDoor(l.x, l.y, 75, l.h); if (i >= 0 && !doorOpen[i] && !doorUsed[i]) toggleDoor(i, true);
      }
    };
    let raf = 0, last = performance.now(), hudT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (LOW_END && now - last < 30) return; // ~30 fps cap on weak phones keeps them cool
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      const countdown = Date.now() < startedAt;
      const timeLeft = Math.max(0, GAME_SECONDS - elapsed);
      const t = elapsed;

      // input
      const k = keysDown.current;
      let ix = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0) + joy.current.x;
      let iy = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0) + joy.current.y;
      const mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; }
      const canMove = sc.ready && !countdown && !ended && meL.status === "alive" && now > stunUntil && !liftS.riding;
      if (walkTo && canMove && now < walkTo.until && Math.hypot(walkTo.x - meL.x, walkTo.y - meL.y) > 38) {
        const a = Math.atan2(walkTo.x - meL.x, walkTo.y - meL.y); meL.yaw = a + Math.PI;
        ix = 0; iy = -1;
      } else walkTo = null;
      meL.moving = canMove && (mag > 0.1 || walkTo !== null);
      if (meL.moving) {
        const sp = (amGhost ? GHOST_SPEED : HUNTER_SPEED) * dt;
        const fw = -iy, sy = Math.sin(meL.yaw), cy = Math.cos(meL.yaw);
        const p = step(meL, (fw * -sy + ix * cy) * sp, (fw * -cy - ix * sy) * sp);
        meL.x = p.x; meL.y = p.y;
        if (now - lastStep > (amGhost ? 520 : 330)) { lastStep = now; if (!amGhost) audio.step(); }
      }
      meL.tx = meL.x; meL.ty = meL.y; meL.th = meL.h;
      runLift(now, dt);
      const lf = liftAt(meL.x, meL.y) && liftS.f === floorOf(meL.y) && !liftS.moving;
      if (!!lf !== liftOn) { liftOn = !!lf; setOnLift(liftOn); }
      for (const [id, l] of Object.entries(live)) if (id !== me) { l.x += (l.tx - l.x) * Math.min(1, dt * 12); l.y += (l.ty - l.y) * Math.min(1, dt * 12); l.h += (l.th - l.h) * Math.min(1, dt * 12); }

      if (sc.ready && bot && isHost && !countdown && !ended) runBot(now, dt);
      if (sc.ready && mates.length && isHost && !countdown && !ended) runMates(now, dt);
      if (isHost && !countdown && !ended) botDoors(now);
      if (now - mapT > 120) { mapT = now; drawMap(); }
      const npcs = npcsAt(t);
      if (!amGhost && meL.status === "alive" && !countdown && !ended) {
        meL.battery = Math.max(0, meL.battery - dt * 1.1);
        KEYS.forEach((key) => { if (!(keyMask & (1 << key.id)) && distance(key, meL) < 34) gainKeys(1 << key.id, true); });
        BATTERIES.forEach((b) => { if (!(batMask & (1 << b.id)) && distance(b, meL) < 34) { batMask |= 1 << b.id; meL.battery = Math.min(100, meL.battery + 60); audio.pickup(); notify("Baterai senter terisi!"); } });
        if (now > npcCd) for (const n of npcs) if (Math.hypot(n.x - meL.x, n.y - meL.y) < 40) {
          npcCd = now + 3000; stunUntil = now + 900; meL.battery = Math.max(0, meL.battery - 25); audio.scream();
          notify(n.kind === "hoodie" ? "Hantu Hoodie tertawa dan menjeratmu dengan tentakel! Senter melemah." : n.kind === "pocong" ? "Pocong melompat ke arahmu! Senter melemah." : "Kuntilanak menjerit! Senter melemah.");
          break;
        }
        if (keyMask === 31 && distance(EXIT, meL) < EXIT.r) setStatus(me, "escaped");
      }
      if (amGhost && !countdown && !ended) {
      }
      if (now - lastSend > 100) { lastSend = now; send("pos", { id: me, x: Math.round(meL.x), y: Math.round(meL.y), h: meL.h, a: Math.round(meL.yaw * 100) / 100, p: Math.round(pitch * 100) / 100, m: meL.moving, st: meL.status, k: keyMask, b: batMask }); }

      // proximity fear
      const ghostId = all.find((p) => p.role === "ghost")?.id;
      const gl = ghostId ? live[ghostId] : undefined;
      const near = !amGhost && gl && meL.status === "alive" ? Math.max(0, 1 - distance(gl, meL) / 360) : 0;
      audio.heartbeat(near); audio.setBreath(amGhost ? 0.25 : near);
      if (!amGhost && gl && meL.status === "alive" && !countdown && !ended) {
        const d = distance(gl, meL);
        const ang = Math.atan2(gl.x - meL.x, gl.y - meL.y) + Math.PI; const diff = Math.abs(((ang - meL.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (d < 130 && (lastGhostD - d > 60 || diff < 0.7) && now > scareCd) { scareCd = now + 15000; stunUntil = now + 1500; audio.kuyang(); sc.scare(t); setScare(Math.random()); setTimeout(() => setScare(0), 1400); }
        lastGhostD = d;
      }

      // outcome
      if (!ended && !countdown) {
        const res = decideOutcome(all.filter((p) => p.role === "hunter").map((p) => ({ status: live[p.id]!.status })), Infinity);
        if (res) {
          ended = true; setOutcome(res); audio.stopAll();
          if (isHost) {
            void supabase.from("game_state").update({ winner: res, keys_found: [0, 1, 2, 3, 4].filter((i) => keyMask & (1 << i)).length, updated_at: new Date().toISOString() }).eq("room_code", code);
            void supabase.from("rooms").update({ status: "ended" }).eq("code", code);
          }
        }
      }

      // camera follows me, or an alive hunter when spectating
      let cam = meL;
      if (meL.status !== "alive") { const alive = Object.entries(live).find(([id, l]) => l.status === "alive" && all.find((p) => p.id === id)?.role === "hunter"); if (alive) cam = alive[1]; }
      const fp = cam === meL;
      sc.frame({ dt, t, cam, yaw: fp ? meL.yaw : cam.yaw, pitch: fp ? pitch : 0, moving: meL.moving, battery: meL.battery, near, keyMask, batMask, npcs, firstPerson: fp && meL.status === "alive", lift: MAP_ID === "hotel" ? { y: liftS.y, doors: liftS.doors, dir: liftS.to === 2 ? 1 : -1, riding: liftS.riding && fp } : null, drone: now - droneAt < 2000 ? droneSt : null,
        others: all.filter((p) => p.id !== me).map((p) => { const l = live[p.id]!; return { id: p.id, x: l.x, y: l.y, h: l.h, yaw: l.yaw, ghost: p.role === "ghost", shouting: now < l.shoutUntil, visible: l.status === "alive" && l !== cam, moving: l.moving, pitch: l.pitch, emote: now < l.emoteUntil && !(PAIR_EMOTES.includes(l.emote ?? "") && l.moving) ? l.emote : null, ...(liftS.moving && liftAt(l.x, l.y) ? { liftY: liftS.y } : {}) }; }) });
      if (now - hudT > 200) {
        hudT = now;
        if (sc.ready) setHouseLoaded(true);
        const di = meL.status === "alive" ? nearestDoor(meL.x, meL.y, 140, meL.h) : -1;
        setNearDoor((cur) => { const nx = di >= 0 ? { i: di, open: !!doorOpen[di] } : null; return cur?.i === nx?.i && cur?.open === nx?.open ? cur : nx; });
        setHud({ time: Math.ceil(timeLeft), keys: [0, 1, 2, 3, 4].filter((i) => keyMask & (1 << i)).length, battery: meL.battery, near, room: map === "rumah" ? meL.h >= HOUSE.extension.upper - .05 ? "Rumah Tua · Lantai 2" : meL.h > 1 ? "Tangga Rumah Tua" : "Rumah Tua · Lantai 1" : roomAt(meL.x, meL.y), cd: countdown ? Math.ceil((startedAt - Date.now()) / 1000) : 0, statuses: Object.fromEntries(Object.entries(live).map(([id, l]) => [id, l.status])) });
      }
    };

    // Dev-only probes exercise the same movement and scene as a live match.
    const debug = {
      get state() { return { x: meL.x, y: meL.y, h: meL.h, ready: sc.ready, keyMask, doors: doorOpen }; },
      teleport(node: number) { const p = housePoint(node); Object.assign(meL, p, { tx: p.x, ty: p.y, th: p.h }); },
      move(dx: number, dy: number) { const p = step(meL, dx, dy); meL.x = meL.tx = p.x; meL.y = meL.ty = p.y; meL.th = meL.h; },
      look(yaw: number, p = 0) { meL.yaw = yaw; pitch = p; },
      path(node: number) { return housePath(meL, housePoint(node)); },
      walkPath(node: number) { const path = housePath(meL, housePoint(node)); for (const id of path) { const p = housePoint(id); const next = step(meL, p.x - meL.x, p.y - meL.y); Object.assign(meL, next, { tx: next.x, ty: next.y, th: next.h }); } return { x: meL.x, y: meL.y, h: meL.h }; },
      door(i: number) { doorRef.current(i); },
      doorPositions: DOORS,
      placements: HOUSE.placements,
    };
    const debugWindow = window as Window & { __game?: typeof debug };
    if (import.meta.env.DEV) debugWindow.__game = debug;
    raf = requestAnimationFrame(loop);
    return () => {
      if (import.meta.env.DEV && debugWindow.__game === debug) delete debugWindow.__game;
      cancelAnimationFrame(raf); clearTimeout(toastTimer); sc.dispose();
      window.removeEventListener("resize", onResize); document.removeEventListener("mousemove", onMouse); cv.removeEventListener("click", onClick);
      cv.removeEventListener("pointerdown", onPD); cv.removeEventListener("pointerdown", onTapStart); cv.removeEventListener("pointerup", onTapEnd); window.removeEventListener("pointermove", onPM); window.removeEventListener("pointerup", onPU);
      if (document.pointerLockElement) void document.exitPointerLock();
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      void supabase.removeChannel(ch); audio.stopAll();
    };
  }, [map, code, me, players.map((p) => p.id + p.role).join(), startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const spectating = hud.statuses[me] === "caught";
  const won = outcome === "hunters" ? !amGhost : amGhost;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void">
      <canvas ref={canvasRef} className="h-full w-full touch-none" style={{ filter: spectating ? "grayscale(1) contrast(1.1)" : amGhost ? "saturate(1.3) hue-rotate(-20deg)" : undefined }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${0.75 + hud.near * 0.2}) 100%)`, boxShadow: hud.near > 0.3 ? `inset 0 0 ${80 * hud.near}px rgba(170,0,20,.6)` : undefined }} />
      {!houseLoaded && map === "rumah" && <div className="absolute inset-0 z-50 flex items-center justify-center bg-void text-gold font-horror text-2xl">MEMUAT RUMAH...</div>}
      {/* HUD */}
      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card/80 px-3 py-1.5 text-sm">
          <span className="flex items-center gap-1 text-gold"><KeyRound className="size-4" />Kunci {hud.keys}/{TOTAL_KEYS}{hud.keys >= TOTAL_KEYS && " · Kabur!"}</span>
          {!amGhost && <span className="flex items-center gap-1"><Battery className="size-4" />{Math.round(hud.battery)}%</span>}
        </div>
        <div className="flex flex-1 flex-wrap justify-center gap-1">
          {all.filter((p) => p.role === "hunter").map((p) => {
            const st = hud.statuses[p.id] ?? "alive";
            return (
              <div key={p.id} className={`flex items-center gap-1 rounded bg-card/80 px-1.5 py-0.5 text-xs ${st === "caught" ? "opacity-40 grayscale" : ""}`}>
                <CharImg id={p.karakter} className="h-6 w-5" />
                <span className="max-w-16 truncate">{p.nama}</span>
                <span className={st === "alive" ? "text-chart-4" : st === "escaped" ? "text-gold" : "text-primary"}>{st === "alive" ? "hidup" : st === "escaped" ? "kabur" : "tertangkap"}</span>
              </div>
            );
          })}
        </div>
        <MicButton code={code} me={me} className="pointer-events-auto" />
        <MuteButton className="pointer-events-auto" />
        <SurvivalRadio ctx={() => ({ role: amGhost ? "ghost" : "hunter", map: MAPS.find((m) => m.id === MAP_ID)?.nama ?? "Rumah Tua", keys: hud.keys, floor: MAP_ID === "hotel" && /Lt\.2/.test(hud.room) ? 2 : 1, battery: hud.battery, room: hud.room })} />
      </div>
      <div className="absolute left-1/2 top-12 -translate-x-1/2 text-xs text-muted-foreground">{amGhost ? "HANTU ASAP" : "PEMBURU"} - {hud.room}</div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50" />
      {hud.near > 0.2 && <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ background: `repeating-linear-gradient(0deg, rgba(255,255,255,${hud.near * 0.05}) 0 1px, transparent 1px 3px)`, mixBlendMode: "screen" }} />}
      {onLift && !riding && hud.cd === 0 && <div className="absolute bottom-40 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-gold bg-card/90 p-2">
        <span className="px-1 text-xs font-bold text-gold">LIFT</span>
        <button onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); liftRef.current("up"); }} aria-label="Naik" className="flex size-12 items-center justify-center rounded-full bg-chart-4 text-xl font-bold text-background">▲</button>
        <button onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); liftRef.current("down"); }} aria-label="Turun" className="flex size-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">▼</button>
      </div>}
      {!onLift && nearDoor && hud.cd === 0 && <button onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); doorRef.current(nearDoor.i); }} className="absolute bottom-40 left-1/2 z-20 -translate-x-1/2 rounded-lg border-2 border-gold bg-card/90 px-5 py-2 font-horror text-lg text-gold">{nearDoor.open ? "TUTUP PINTU" : "BUKA PINTU"}</button>}
      {riding && <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded bg-void/70 px-3 py-1 font-horror text-xl text-gold animate-pulse">LIFT BERGERAK...</div>}
      {hud.cd > 0 && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-void/60 text-center"><div className="w-full bg-primary/80 py-2 font-horror text-2xl tracking-widest text-primary-foreground">PERTANDINGAN DIMULAI · {MAPS.find((m) => m.id === map)?.nama.toUpperCase()}</div><div key={hud.cd} className="mt-4 font-horror text-[9rem] leading-none text-gold drop-shadow-[0_0_30px_hsl(350_80%_40%)] animate-in zoom-in-50 duration-300">{hud.cd}</div><p className="mt-3 px-6 text-foreground">{amGhost ? "KAMU HANTU ASAP. Kagetkan para pemburu!" : "KAMU PEMBURU. Cari 5 kunci dan kabur!"}</p></div>}
      {toast && <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-lg border border-gold bg-card/90 px-4 py-2 text-center text-sm font-bold text-gold">{toast}</div>}
      {spectating && !outcome && <div className="absolute inset-x-0 top-28 text-center font-horror text-2xl text-foreground">KAMU JADI PENONTON</div>}
      <div className="pointer-events-none absolute left-1/2 top-32 flex -translate-x-1/2 flex-col items-center gap-1">
        {bubbles.map((b) => <div key={b.k} className="animate-in fade-in slide-in-from-right flex items-center gap-1.5 rounded-full bg-card/85 px-3 py-1 text-sm"><EmoteIcon id={b.e} className="size-4 text-primary" /><b>{b.nama}</b> {b.target ? (b.e === "hug" ? `memeluk ${b.target}` : `mencium ${b.target}`) : emoteLabel(b.e)}</div>)}
      </div>
      <div className="absolute bottom-32 right-6 flex flex-col items-end gap-2">
        <button onPointerDown={() => setEmoteOpen((o) => !o)} className="flex size-12 items-center justify-center rounded-full border border-border bg-card/80 text-foreground" aria-label="Emote"><EmoteIcon id="dance" className="size-5" /></button>
      </div>
      <EmoteWheel open={emoteOpen} onClose={() => setEmoteOpen(false)} onPick={(id) => emoteRef.current(id)} />
      {amGhost && !spectating && <button onPointerDown={() => ambushRef.current()} className="absolute bottom-8 right-6 flex size-20 flex-col items-center justify-center rounded-full border-2 border-primary bg-blood/80 text-[10px] font-bold text-primary-foreground glow-blood"><Ghost className="size-6" />KAGETKAN</button>}
      {scare > 0 && <div className="pointer-events-none absolute inset-0 z-50 animate-pulse" style={{ boxShadow: "inset 0 0 160px hsl(350 90% 30% / .9)" }} />}
      {/* minimap */}
      <div className="pointer-events-none absolute right-2 top-12 rounded-md border border-border bg-void/70 p-1">
        <canvas ref={mapRef} width={150} height={100} className="block h-[100px] w-[150px]" />
        <div className="mt-0.5 flex justify-between px-0.5 text-[8px] text-muted-foreground"><span className="text-gold">● kunci</span><span className="text-chart-4">▮ baterai</span><span className="text-primary">◯ keluar</span></div>
      </div>
      {/* in-game chat */}
      <div className="absolute bottom-40 left-2 flex w-60 flex-col gap-1">
        {chatLog.map((m) => <Bubble key={m.k} m={m} mine={m.id === me} />)}
        {chatOpen && <form className="pointer-events-auto flex gap-1" onSubmit={(e) => { e.preventDefault(); chatRef.current(chatText); setChatText(""); }}>
          <input autoFocus value={chatText} maxLength={120} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Pesan ke tim..." className="h-9 flex-1 rounded-md border border-input bg-card/90 px-2 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-2 text-primary-foreground" aria-label="Kirim"><Send className="size-4" /></button>
        </form>}
      </div>
      <button onPointerDown={() => setChatOpen((o) => !o)} className="absolute bottom-48 right-6 flex size-12 items-center justify-center rounded-full border border-border bg-card/80 text-foreground" aria-label="Chat"><MessageCircle className="size-5" /></button>
      {/* controls */}
      {isTouch && <div className="absolute bottom-6 left-6"><Joystick vec={joy} /></div>}
      {isTouch && <div className="pointer-events-none absolute bottom-2 right-32 text-xs text-muted-foreground">Geser layar untuk melihat</div>}
      {!amGhost && !spectating && (
        <button onPointerDown={() => shoutRef.current()} className="absolute bottom-8 right-6 flex size-20 flex-col items-center justify-center rounded-full border-2 border-primary bg-blood/80 text-xs font-bold text-primary-foreground glow-blood">
          <Megaphone className="size-6" />TOLONG!
        </button>
      )}
      {!isTouch && <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">Klik layar lalu gerakkan mouse untuk melihat. WASD / Panah untuk jalan, klik pintu atau tekan E untuk membuka{!amGhost && ", Spasi untuk teriak"}</div>}
      {outcome && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-void/90 p-6 text-center">
          <h1 className={`font-horror text-drip text-5xl ${won ? "text-gold" : "text-primary"}`}>
            {outcome === "hunters" ? (amGhost ? "PEMBURU KABUR..." : "KAMU BERHASIL KABUR!") : "HANTU MENANG..."}
          </h1>
          <p className="text-muted-foreground">{won ? "Kamu menang malam ini." : "Malam ini milik kegelapan."}</p>
          <div className="flex gap-3">
            {isHost && <Button size="lg" onClick={onBackToLobby}>Main Lagi</Button>}
            <Button size="lg" variant="secondary" onClick={onLeave}>Keluar</Button>
          </div>
          {!isHost && <p className="text-xs text-muted-foreground">Menunggu host untuk main lagi...</p>}
        </div>
      )}
    </div>
  );
}
