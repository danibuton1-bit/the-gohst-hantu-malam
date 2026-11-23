import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Clapperboard, Crosshair, Eye, EyeOff, Film, Orbit, RotateCcw, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { batterySvg, characterSvg, CHARACTERS, exclaimSvg, ghostSvg, keySvg, kuntilanakSvg, hoodieSvg, loadImg, normalizeChar, pocongSvg, type CharId } from "@/lib/art";
import { applyMap, BOT_GHOST_ID, GHOST_SPAWN, isMapId, npcsAt, WORLD, type MapId } from "@/lib/game";
import { createScene } from "@/lib/scene3d";
import { toContent } from "@/lib/orient";
import { Joystick } from "./Joystick";
import { squadBots } from "./Game";
import { Button } from "./ui/button";

/** Cinematic feel: all motion is critically damped toward a target, like a broadcast drone. */
export const DRONE = { SPEED: 260, VERT: 2.2, MIN_H: 0.6, MAX_H: 40, ACCEL: 3.2, CAM_DAMP: 4, ROT_DAMP: 5, TURN: 1.6, FOLLOW_DIST: 170 };
/** Ease-in-out for choreographed trailer shots. */
export const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** Trailer presets: crane rises 1.2m -> 30m tilting down; orbit circles the target 360 degrees. */
export const SHOTS = { CRANE_S: 14, CRANE_LO: 1.2, CRANE_HI: 30, ORBIT_S: 24, ORBIT_R: 320, ORBIT_H: 14, LOCK_S: 16, LOCK_R: 120, LOCK_H: 2.4 };
/** Camera yaw/pitch that aims exactly at a world point (chest height ~1m), so the subject stays dead-center. */
export function aimAt(cx: number, cy: number, ch: number, tx: number, ty: number) {
  return { yaw: Math.atan2(cx - tx, cy - ty), pitch: -Math.atan2(ch - 1, Math.max(0.2, Math.hypot(cx - tx, cy - ty) / 50)) };
}
export type Shot = "crane" | "drop" | "orbit" | "lock" | null;
export const damp = (cur: number, target: number, k: number, dt: number) => target + (cur - target) * Math.exp(-k * dt);

type P = { id: string; nama: string; karakter: string; role: string | null };
type L = { x: number; y: number; tx: number; ty: number; yaw: number; moving: boolean; alive: boolean; emote: string | null; emoteUntil: number };

export function DroneView({ code, onExit }: { code: string; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joy = useRef({ x: 0, y: 0 });
  const vert = useRef(0); const turn = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const [players, setPlayers] = useState<P[] | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const startShot = useRef<(k: Shot) => void>(() => {});
  const followRef = useRef<string | null>(null); followRef.current = follow;
  const [hud, setHud] = useState({ h: 3, startedAt: 0 });
  const [map, setMap] = useState<MapId>("rumah");
  const [nv, setNv] = useState(false);
  const [clean, setClean] = useState(false);
  const [bars, setBars] = useState(false);
  const [shot, setShot] = useState<Shot>(null);
  const shotRef = useRef<{ kind: Shot; t0: number; x: number; y: number; yaw: number }>({ kind: null, t0: 0, x: 0, y: 0, yaw: 0 });
  const nvRef = useRef<(on: boolean) => void>(() => {});
  useEffect(() => { nvRef.current(nv); }, [nv]);

  useEffect(() => {
    void (async () => {
      const [{ data }, { data: gs }, { data: rm }] = await Promise.all([
        supabase.from("players").select("profile_id,nama,karakter,role").eq("room_code", code),
        supabase.from("game_state").select("started_at").eq("room_code", code).maybeSingle(),
        supabase.from("rooms").select("map").eq("code", code).maybeSingle(),
      ]);
      const m = isMapId(rm?.map) ? rm.map : "rumah"; applyMap(m); setMap(m);
      const ps: P[] = (data ?? []).map((p) => ({ id: p.profile_id, nama: p.nama, karakter: normalizeChar(p.karakter) ?? "raka", role: p.role }));
      ps.push(...squadBots(ps).map((b) => ({ id: b.id, nama: b.nama, karakter: b.karakter, role: "hunter" })));
      if (!ps.some((p) => p.role === "ghost")) ps.push({ id: BOT_GHOST_ID, nama: "Hantu AI", karakter: "raka", role: "ghost" });
      setHud((h) => ({ ...h, startedAt: gs?.started_at ? new Date(gs.started_at).getTime() : Date.now() }));
      setPlayers(ps);
    })();
  }, [code]);

  useEffect(() => {
    if (!players) return;
    const url = (svg: string) => loadImg(svg).src;
    const imgs: Record<string, string> = { ghost: url(ghostSvg()), kunti: url(kuntilanakSvg()), hoodie: url(hoodieSvg()), pocong: url(pocongSvg()), key: url(keySvg()), bat: url(batterySvg()), ex: url(exclaimSvg()) };
    (Object.keys(CHARACTERS) as CharId[]).forEach((c) => { imgs[c] = url(characterSvg(c)); });
    const sc = createScene(canvasRef.current!, { me: "raka", amGhost: false, imgs, drone: true, map });
    nvRef.current = (on) => sc.setNightVision(on); sc.setNightVision(nv);
    const live: Record<string, L> = {};
    players.forEach((p) => { sc.ensurePlayer(p.id, p.role === "ghost" ? "ghost" : p.karakter, p.role !== "ghost", p.nama); live[p.id] = { x: GHOST_SPAWN.x, y: GHOST_SPAWN.y, tx: GHOST_SPAWN.x, ty: GHOST_SPAWN.y, yaw: 0, moving: false, alive: true, emote: null, emoteUntil: 0 }; });
    sc.resize(); const onResize = () => sc.resize(); window.addEventListener("resize", onResize);
    let keyMask = 0, batMask = 0;
    const ch = supabase.channel(`game-${code}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id: string; a?: number; x: number; y: number; m: boolean; st: string; k: number; b: number };
      const l = live[p.id]; if (!l) return;
      l.tx = p.x; l.ty = p.y; l.moving = p.m; if (p.a !== undefined) l.yaw = p.a; l.alive = p.st === "alive"; keyMask |= p.k; batMask |= p.b;
    });
    ch.on("broadcast", { event: "caught" }, ({ payload }) => { const l = live[(payload as { id: string }).id]; if (l) l.alive = false; });
    ch.on("broadcast", { event: "emote" }, ({ payload }) => {
      const p = payload as { id: string; e: string; t?: string }; const until = performance.now() + 3500;
      const a = live[p.id]; if (a) { a.emote = p.e; a.emoteUntil = until; }
      const b = p.t ? live[p.t] : undefined; if (b && (p.e === "hug" || p.e === "kiss")) { b.emote = p.e; b.emoteUntil = until; }
    });
    ch.subscribe();

    // drone state: position, velocity, height, yaw/pitch — rendered values chase targets smoothly
    const d = { x: WORLD.w / 2, y: WORLD.h / 2, h: 4, yaw: 0, pitch: -0.5, vx: 0, vy: 0, vh: 0, vyaw: 0 };
    const cam = { x: d.x, y: d.y, h: d.h, yaw: d.yaw, pitch: d.pitch };
    const look = (dx: number, dy: number) => { d.yaw -= dx * 0.004; d.pitch = Math.max(-1.55, Math.min(0.5, d.pitch - dy * 0.004)); };
    const cv = canvasRef.current!;
    let tid: number | null = null, x0 = 0, y0 = 0;
    const onPD = (e: PointerEvent) => { tid = e.pointerId; x0 = e.clientX; y0 = e.clientY; };
    const onPM = (e: PointerEvent) => { if (e.pointerId !== tid) return; const c = toContent(e.clientX - x0, e.clientY - y0); look(c.x, c.y); x0 = e.clientX; y0 = e.clientY; };
    const onPU = (e: PointerEvent) => { if (e.pointerId === tid) tid = null; };
    const kd = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; }, ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    cv.addEventListener("pointerdown", onPD); window.addEventListener("pointermove", onPM); window.addEventListener("pointerup", onPU);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    let last = performance.now(), raf = 0, lastSend = 0, hudT = 0; const t0 = last;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const k = keys.current;
      const ix = joy.current.x + (k["d"] ? 1 : 0) - (k["a"] ? 1 : 0);
      const iy = joy.current.y + (k["s"] ? 1 : 0) - (k["w"] ? 1 : 0);
      const iv = vert.current + (k["e"] || k[" "] ? 1 : 0) - (k["q"] || k["shift"] ? 1 : 0);
      const it = turn.current + (k["arrowleft"] ? 1 : 0) - (k["arrowright"] ? 1 : 0);
      for (const l of Object.values(live)) { l.x = damp(l.x, l.tx, 10, dt); l.y = damp(l.y, l.ty, 10, dt); }
      let tgt = followRef.current ? live[followRef.current] : null;
      if (!tgt && shotRef.current.kind === "lock") tgt = players.filter((p) => p.role !== "ghost").map((p) => live[p.id]!).find((l) => l.alive) ?? null;
      const sh = shotRef.current;
      if (sh.kind && Math.abs(ix) + Math.abs(iy) + Math.abs(iv) + Math.abs(it) > 0.1) { sh.kind = null; setShot(null); }
      if (sh.kind === "crane" || sh.kind === "drop") {
        const p = ease((now - sh.t0) / 1000 / SHOTS.CRANE_S), u = sh.kind === "crane" ? p : 1 - p;
        const cx = tgt ? tgt.x : sh.x, cy = tgt ? tgt.y : sh.y;
        d.h = SHOTS.CRANE_LO + (SHOTS.CRANE_HI - SHOTS.CRANE_LO) * u;
        const back = 40 + 110 * u; // pulls back a little while rising
        d.x = damp(d.x, cx + Math.sin(sh.yaw) * back, 3, dt); d.y = damp(d.y, cy + Math.cos(sh.yaw) * back, 3, dt);
        d.yaw = sh.yaw; d.pitch = -Math.atan2(d.h - 1, Math.max(0.3, back / 50)); d.vx = d.vy = d.vh = d.vyaw = 0;
        if (p >= 1) { sh.kind = null; setShot(null); }
      } else if (sh.kind === "orbit") {
        const cx = tgt ? tgt.x : sh.x, cy = tgt ? tgt.y : sh.y;
        const a = sh.yaw + ((now - sh.t0) / 1000 / SHOTS.ORBIT_S) * Math.PI * 2;
        d.x = damp(d.x, cx + Math.sin(a) * SHOTS.ORBIT_R, 2.5, dt); d.y = damp(d.y, cy + Math.cos(a) * SHOTS.ORBIT_R, 2.5, dt);
        d.h = damp(d.h, SHOTS.ORBIT_H, 1.5, dt); d.yaw = a; d.pitch = -Math.atan2(d.h - 1, SHOTS.ORBIT_R / 50); d.vx = d.vy = d.vh = d.vyaw = 0;
      } else if (sh.kind === "lock" && tgt) {
        // film-style lock-on: slow close orbit around the subject at head height
        const a = sh.yaw + ((now - sh.t0) / 1000 / SHOTS.LOCK_S) * Math.PI * 2;
        d.x = damp(d.x, tgt.x + Math.sin(a) * SHOTS.LOCK_R, 3, dt); d.y = damp(d.y, tgt.y + Math.cos(a) * SHOTS.LOCK_R, 3, dt);
        d.h = damp(d.h, SHOTS.LOCK_H + Math.sin(a * 0.5) * 0.6, 1.5, dt); d.yaw = a; d.vx = d.vy = d.vh = d.vyaw = 0;
      } else if (tgt && Math.abs(ix) + Math.abs(iy) < 0.05) {
        // orbit-follow: stay behind-and-above the player, looking at them
        const fx = tgt.x + Math.sin(d.yaw) * DRONE.FOLLOW_DIST, fy = tgt.y + Math.cos(d.yaw) * DRONE.FOLLOW_DIST;
        d.vx = damp(d.vx, (fx - d.x) * 2, DRONE.ACCEL, dt); d.vy = damp(d.vy, (fy - d.y) * 2, DRONE.ACCEL, dt);
        const dist = Math.hypot(tgt.x - d.x, tgt.y - d.y) / 50;
        d.pitch = damp(d.pitch, -Math.atan2(d.h - 1, Math.max(0.5, dist)), 3, dt);
      } else {
        const sx = ix * Math.cos(d.yaw) + iy * Math.sin(d.yaw), sy = -ix * Math.sin(d.yaw) + iy * Math.cos(d.yaw);
        d.vx = damp(d.vx, sx * DRONE.SPEED, DRONE.ACCEL, dt); d.vy = damp(d.vy, sy * DRONE.SPEED, DRONE.ACCEL, dt);
      }
      d.vh = damp(d.vh, iv * DRONE.VERT * (1 + d.h / 6), DRONE.ACCEL, dt);
      d.vyaw = damp(d.vyaw, it * DRONE.TURN, DRONE.ACCEL, dt);
      d.x = Math.max(-300, Math.min(WORLD.w + 300, d.x)); d.y = Math.max(-300, Math.min(WORLD.h + 300, d.y));
      if (!sh.kind) d.x = Math.max(20, Math.min(WORLD.w - 20, d.x + d.vx * dt)); d.y = Math.max(20, Math.min(WORLD.h - 20, d.y + d.vy * dt));
      d.h = Math.max(DRONE.MIN_H, Math.min(DRONE.MAX_H, d.h + d.vh * dt)); d.yaw += d.vyaw * dt;
      cam.x = damp(cam.x, d.x, DRONE.CAM_DAMP, dt); cam.y = damp(cam.y, d.y, DRONE.CAM_DAMP, dt); cam.h = damp(cam.h, d.h, DRONE.CAM_DAMP, dt);
      if ((sh.kind === "orbit" || sh.kind === "lock") && (tgt || sh.kind === "orbit")) {
        // aim from the actual (smoothed) camera position so the subject never drifts off-center
        const g = aimAt(cam.x, cam.y, cam.h, tgt ? tgt.x : sh.x, tgt ? tgt.y : sh.y);
        let dy = g.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        cam.yaw += dy * (1 - Math.exp(-12 * dt)); cam.pitch = damp(cam.pitch, g.pitch, 12, dt); d.yaw = cam.yaw; d.pitch = cam.pitch;
      } else { cam.yaw = damp(cam.yaw, d.yaw, DRONE.ROT_DAMP, dt); cam.pitch = damp(cam.pitch, d.pitch, DRONE.ROT_DAMP, dt); }
      const t = (now - t0) / 1000;
      const el = Math.max(0, (Date.now() - hud.startedAt) / 1000);
      sc.frame({ dt, t, cam, camH: cam.h, yaw: cam.yaw, pitch: cam.pitch, moving: false, battery: 100, near: 0, keyMask, batMask, npcs: npcsAt(el), firstPerson: false,
        others: players.map((p) => { const l = live[p.id]!; return { id: p.id, x: l.x, y: l.y, yaw: l.yaw, ghost: p.role === "ghost", shouting: false, visible: l.alive, moving: l.moving, pitch: 0, emote: now < l.emoteUntil ? l.emote : null }; }) });
      if (now - lastSend > 100) { lastSend = now; void ch.send({ type: "broadcast", event: "drone", payload: { x: Math.round(cam.x), y: Math.round(cam.y), h: Math.round(cam.h * 100) / 100, yaw: Math.round(cam.yaw * 100) / 100 } }); }
      if (now - hudT > 250) { hudT = now; setHud((s) => ({ ...s, h: cam.h })); }
    };
    startShot.current = (kind: Shot) => { shotRef.current = { kind, t0: performance.now(), x: d.x - Math.sin(d.yaw) * 60, y: d.y - Math.cos(d.yaw) * 60, yaw: d.yaw }; setShot(kind); };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); void supabase.removeChannel(ch); sc.dispose();
      window.removeEventListener("resize", onResize); cv.removeEventListener("pointerdown", onPD); window.removeEventListener("pointermove", onPM); window.removeEventListener("pointerup", onPU);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, code, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const hold = (r: { current: number }, v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); r.current = v; },
    onPointerUp: () => { r.current = 0; }, onPointerLeave: () => { r.current = 0; }, onPointerCancel: () => { r.current = 0; },
  });
  const cycle = () => { const ids = (players ?? []).map((p) => p.id); const i = follow ? ids.indexOf(follow) : -1; setFollow(i + 1 < ids.length ? ids[i + 1]! : null); };
  const fName = players?.find((p) => p.id === follow)?.nama;

  return (
    <div className="fixed inset-0 bg-background">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      {bars && <><div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-void" /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-void" /></>}
      {clean && <button onClick={() => setClean(false)} aria-label="Tampilkan kontrol" className="absolute right-1 top-1 z-30 rounded-full p-2 text-foreground/20"><Eye className="size-4" /></button>}
      {!clean && <>
      <div className="pointer-events-none absolute inset-0 border-[3px] border-primary/30" />
      <div className="absolute left-2 top-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onExit}><ArrowLeft /> Keluar</Button>
        <div className="rounded-md bg-card/80 px-2 py-1 text-xs font-bold"><span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-destructive" />DRONE LIVE · {code} · {hud.h.toFixed(1)} m</div>
      </div>
      <button onClick={cycle} className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-card/80 px-3 py-2 text-xs font-bold"><Crosshair className="size-4 text-primary" />{fName ? `Ikuti: ${fName}` : "Bebas"}</button>
      <button onClick={() => setNv((v) => !v)} aria-pressed={nv} className={`absolute right-2 top-12 flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold ${nv ? "bg-chart-2 text-background" : "bg-card/80"}`}><Eye className="size-4" />NIGHT VISION {nv ? "ON" : "OFF"}</button>
      <div className="absolute inset-x-0 top-24 z-20 mx-auto flex w-fit max-w-[96%] flex-wrap items-center justify-center gap-1 rounded-xl border border-gold/40 bg-card/70 p-1 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <span className="px-1 text-[10px] font-bold tracking-widest text-gold">SUTRADARA</span>
        <button onClick={() => startShot.current(shot === "crane" ? null : "crane")} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${shot === "crane" ? "bg-primary text-primary-foreground" : "bg-card/80"}`}><ArrowUp className="size-4" />CRANE NAIK</button>
        <button onClick={() => startShot.current(shot === "drop" ? null : "drop")} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${shot === "drop" ? "bg-primary text-primary-foreground" : "bg-card/80"}`}><ArrowDown className="size-4" />CRANE TURUN</button>
        <button onClick={() => startShot.current(shot === "orbit" ? null : "orbit")} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${shot === "orbit" ? "bg-primary text-primary-foreground" : "bg-card/80"}`}><Orbit className="size-4" />ORBIT 360°</button>
        <button onClick={() => startShot.current(shot === "lock" ? null : "lock")} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${shot === "lock" ? "bg-primary text-primary-foreground" : "bg-card/80"}`}><Crosshair className="size-4" />KUNCI & PUTAR</button>
        <button onClick={() => setBars((b) => !b)} aria-pressed={bars} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${bars ? "bg-gold text-background" : "bg-card/80"}`}><Film className="size-4" />SINEMA 21:9</button>
        <button onClick={() => setClean(true)} className="flex items-center gap-1 rounded-md bg-card/80 px-2 py-1.5 text-[11px] font-bold"><EyeOff className="size-4" />LAYAR BERSIH</button>
      </div>
      {shot && <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 rounded-md bg-card/80 px-3 py-1 text-xs font-bold"><Clapperboard className="mr-1 inline size-3" />SHOT OTOMATIS · sentuh kontrol untuk berhenti</div>}
      {nv && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background)/.75))] mix-blend-multiply" />}
      <div className="absolute bottom-6 left-6" onPointerDown={(e) => e.stopPropagation()}><Joystick vec={joy} /></div>
      <div className="absolute bottom-6 right-6 grid grid-cols-3 gap-2">
        <span />
        <button aria-label="Naik" {...hold(vert, 1)} className="flex size-14 items-center justify-center rounded-full border-2 border-accent/60 bg-card/70"><ArrowUp /></button>
        <span />
        <button aria-label="Putar kiri" {...hold(turn, 1)} className="flex size-14 items-center justify-center rounded-full border-2 border-accent/60 bg-card/70"><RotateCcw /></button>
        <span />
        <button aria-label="Putar kanan" {...hold(turn, -1)} className="flex size-14 items-center justify-center rounded-full border-2 border-accent/60 bg-card/70"><RotateCw /></button>
        <span />
        <button aria-label="Turun" {...hold(vert, -1)} className="flex size-14 items-center justify-center rounded-full border-2 border-accent/60 bg-card/70"><ArrowDown /></button>
        <span />
      </div>
      <div className="pointer-events-none absolute bottom-1 left-1/2 hidden -translate-x-1/2 text-[10px] text-muted-foreground sm:block">WASD gerak · E/Spasi naik · Q/Shift turun · Panah kiri/kanan putar · seret layar untuk melihat</div>
      </>}
    </div>
  );
}
