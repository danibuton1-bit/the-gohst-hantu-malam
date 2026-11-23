// First-person 3D renderer for the shared 2D game world. World px -> meters via U.
import * as THREE from "three";
import { BATTERIES, DOORS, DOOR_W, EXIT, FLOOR2_H, FLOOR2_Y, KEYS, LIFTS, ROOMS, WALLS, WORLD, doorOpen, type MapId, type Rect } from "./game";
import { audio } from "./audio";
import { CHARACTERS, isChar, type CharId } from "./art";
import { buildAvatar, nameTag, type Avatar } from "./avatar3d";
import { buildKuyang, type Kuyang } from "./kuyang3d";
import { getGfx, pixelRatioFor } from "./graphics";

export const U = 1 / 50;
/** Weak/old Android phones: lower resolution, cheaper lights and materials, 30 fps. */
export const LOW_END = typeof navigator !== "undefined" && typeof window !== "undefined" && (
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 ||
  (/Android/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) * (window.devicePixelRatio || 1) < 1100));
const MOBILE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const Mat = (p: THREE.MeshStandardMaterialParameters) => (LOW_END ? new THREE.MeshLambertMaterial({ color: p.color ?? 0xffffff, map: p.map ?? null, emissive: p.emissive ?? 0, emissiveIntensity: p.emissiveIntensity ?? 1, transparent: p.transparent ?? false, opacity: p.opacity ?? 1 }) as unknown as THREE.MeshStandardMaterial : new THREE.MeshStandardMaterial(p));
export const EYE = 1.6;
const WALL_H = 3.2;
/** World px -> 3D. On the hotel the bottom half of the grid (floor 2) is stacked FLOOR2_H above floor 1. */
type V3 = { x: number; z: number; b: number };
const mkV = (stack: boolean) => (x: number, y: number): V3 => (stack && y >= FLOOR2_Y ? { x: x * U, z: (y - FLOOR2_Y) * U, b: FLOOR2_H } : { x: x * U, z: y * U, b: 0 });
/** Split a rect at the floor boundary so each half is stacked on its own floor. */
const splitRect = (stack: boolean, r: Rect): Rect[] => (!stack || r.y >= FLOOR2_Y || r.y + r.h <= FLOOR2_Y ? [r] : [{ ...r, h: FLOOR2_Y - r.y }, { ...r, y: FLOOR2_Y, h: r.y + r.h - FLOOR2_Y }]);
/** Horizontal plane (floor/ceiling) with an optional rectangular hole (the lift shaft). */
function slab(w: number, h: number, up: boolean, hole?: { x: number; z: number; w: number; h: number }) {
  if (!hole) return new THREE.PlaneGeometry(w, h);
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(-w / 2, h / 2); sh.closePath();
  const sz = up ? -1 : 1; // floor (rot -90) maps shape y -> -z, ceiling (rot +90) maps y -> +z
  const hp = new THREE.Path(); const hx = hole.x, hy = hole.z * sz;
  hp.moveTo(hx - hole.w / 2, hy - hole.h / 2); hp.lineTo(hx - hole.w / 2, hy + hole.h / 2); hp.lineTo(hx + hole.w / 2, hy + hole.h / 2); hp.lineTo(hx + hole.w / 2, hy - hole.h / 2); hp.closePath();
  sh.holes.push(hp);
  const g = new THREE.ShapeGeometry(sh);
  const uv = g.attributes["uv"]!; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  return g;
}

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: number) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  draw(c.getContext("2d")!, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const woodTex = (base: string) => canvasTex((g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `rgba(0,0,0,${0.15 + (i % 3) * 0.08})`; g.fillRect(0, i * 32, s, 2);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * s, i * 32 + Math.random() * 30, 20 + Math.random() * 60, 1); }
  }
}, 1);
const wallTex = canvasTex((g, s) => {
  g.fillStyle = "#4a3a34"; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 32) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, 0, 3, s); g.fillStyle = "rgba(120,90,70,.15)"; for (let y = 8; y < s; y += 40) g.fillRect(x + 12, y, 8, 8); }
  for (let k = 0; k < 6; k++) { const x = Math.random() * s; const gr = g.createLinearGradient(x, 0, x, s); gr.addColorStop(0, "rgba(40,10,10,.5)"); gr.addColorStop(1, "rgba(40,10,10,0)"); g.fillStyle = gr; g.fillRect(x, 0, 4 + Math.random() * 6, s * Math.random()); }
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, s - 30, s, 30);
}, 1);

const tileTex = (a: string, line: string) => canvasTex((g, s) => { g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = line; for (let i = 0; i <= s; i += 64) { g.fillRect(i, 0, 3, s); g.fillRect(0, i, s, 3); } for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.15})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 10 + Math.random() * 30, 0, 7); g.fill(); } }, 1);
const carpetTex = (base: string) => canvasTex((g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); g.strokeStyle = "rgba(210,170,80,.35)"; g.lineWidth = 3; for (let i = 0; i < s; i += 64) for (let j = 0; j < s; j += 64) { g.beginPath(); g.moveTo(i + 32, j + 4); g.lineTo(i + 60, j + 32); g.lineTo(i + 32, j + 60); g.lineTo(i + 4, j + 32); g.closePath(); g.stroke(); } }, 1);
const wallpaperTex = canvasTex((g, s) => { g.fillStyle = "#3a2a1c"; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 32) { g.fillStyle = "rgba(200,160,90,.18)"; g.fillRect(x, 0, 10, s); } g.fillStyle = "#24180f"; g.fillRect(0, s - 50, s, 50); g.fillStyle = "rgba(200,160,90,.5)"; g.fillRect(0, s - 52, s, 3); }, 1);
const stoneTex = canvasTex((g, s) => { g.fillStyle = "#3b3d3a"; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 32) for (let x = (y / 32) % 2 ? 0 : 24; x < s; x += 48) { g.fillStyle = `rgba(${70 + Math.random() * 30},${72 + Math.random() * 30},${68 + Math.random() * 20},1)`; g.fillRect(x + 2, y + 2, 44, 28); } g.fillStyle = "rgba(40,70,30,.35)"; for (let k = 0; k < 200; k++) g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }, 1);

/** Per-map atmosphere: flickering hospital neon, cemetery moon + drifting smoke, hotel lifts. */
function buildTheme(scene: THREE.Scene, map: MapId) {
  const ups: ((t: number, dt: number, cam: { x: number; y: number }) => void)[] = [];
  if (map === "rumahsakit") {
    const tubes: { mat: THREE.MeshBasicMaterial; light: THREE.PointLight; next: number; on: boolean; seed: number }[] = [];
    for (const r of ROOMS) for (const [fx, fy] of [[0.3, 0.35], [0.7, 0.65]] as const) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe8fff4 });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.18), mat);
      const x = (r.x + r.w * fx) * U, z = (r.y + r.h * fy) * U;
      tube.position.set(x, WALL_H - 0.05, z); scene.add(tube);
      const light = new THREE.PointLight(0xd8ffef, LOW_END ? 6 : 9, 9, 1.6); light.position.set(x, WALL_H - 0.3, z); scene.add(light);
      tubes.push({ mat, light, next: 0, on: true, seed: Math.random() });
    }
    // hospital beds (decor)
    const bedMat = Mat({ color: 0xd9dde0, roughness: 0.6 }), sheet = Mat({ color: 0x8fb5a5, roughness: 0.9 });
    for (const [bx, by] of [[150, 420], [300, 80], [880, 420], [1300, 470], [380, 900], [620, 560]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 2.0), bedMat); b.position.set(bx * U, 0.25, by * U);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 1.4), sheet); sh.position.set(bx * U, 0.54, by * U + 0.2); scene.add(b, sh);
    }
    let buzzT = 0;
    ups.push((t) => {
      for (const tb of tubes) {
        if (t > tb.next) { tb.on = !tb.on || Math.random() < 0.3; tb.next = t + (tb.on ? 0.6 + Math.random() * 3 * (1 - tb.seed * 0.7) : 0.04 + Math.random() * 0.25); }
        const v = tb.on ? 1 : 0.05;
        tb.light.intensity = (LOW_END ? 6 : 9) * v; tb.mat.color.setScalar(0.15 + 0.85 * v);
      }
      if (t > buzzT) { buzzT = t + 6 + Math.random() * 6; audio.creak(); }
    });
  }
  if (map === "kuburan") {
    const moon = new THREE.DirectionalLight(0x8aa0d8, LOW_END ? 0.5 : 0.35); moon.position.set(-10, 20, -6); scene.add(moon);
    const disc = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false })); disc.position.set(-20, 26, -18); scene.add(disc);
    const smokeTex = canvasTex((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, "rgba(200,210,230,.55)"); gr.addColorStop(1, "rgba(200,210,230,0)"); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 1);
    smokeTex.repeat.set(1, 1);
    const puffs: { s: THREE.Sprite; vx: number; vz: number; ph: number }[] = [];
    for (let i = 0; i < (LOW_END ? 30 : 70); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.35 }));
      const sz = 2 + Math.random() * 3; sp.scale.set(sz, sz * 0.6, 1);
      sp.position.set(Math.random() * WORLD.w * U, 0.3 + Math.random() * 1.2, Math.random() * WORLD.h * U); scene.add(sp);
      puffs.push({ s: sp, vx: 0.15 + Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.15, ph: Math.random() * 6 });
    }
    // dead trees
    const bark = Mat({ color: 0x2a1f18, roughness: 1 });
    for (const [tx, ty] of [[60, 60], [460, 460], [560, 60], [960, 470], [60, 960], [1440, 520], [700, 940]] as const) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 4, 6), bark); tr.position.set(tx * U, 2, ty * U); scene.add(tr);
      for (let k = 0; k < 3; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.6, 5), bark); br.position.set(tx * U, 2.8 + k * 0.4, ty * U); br.rotation.set(0.9, k * 2.1, 0.5); scene.add(br); }
    }
    ups.push((t, dt) => {
      for (const p of puffs) {
        p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += Math.sin(t + p.ph) * 0.002;
        if (p.s.position.x > WORLD.w * U) p.s.position.x = 0;
        (p.s.material as THREE.SpriteMaterial).opacity = 0.25 + Math.sin(t * 0.5 + p.ph) * 0.12;
      }
    });
  }
  if (map === "hotel") {
    const V = mkV(true);
    for (const r of ROOMS) { const v = V(r.x + r.w / 2, r.y + r.h / 2); const lt = new THREE.PointLight(0xffb060, LOW_END ? 3 : 4, 7, 1.8); lt.position.set(v.x, v.b + WALL_H - 0.4, v.z); scene.add(lt); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd090 })); bulb.position.copy(lt.position); scene.add(bulb); }
  }
  return { update: (t: number, dt: number, cam: { x: number; y: number }) => ups.forEach((u) => u(t, dt, cam)) };
}

type Ent = { sprite: THREE.Sprite; light?: THREE.PointLight };

export function createScene(canvas: HTMLCanvasElement, opts: { me: CharId | "ghost"; amGhost: boolean; imgs: Record<string, string>; drone?: boolean; map?: MapId }) {
  const MAP = opts.map ?? "rumah";
  const STACK = MAP === "hotel";
  const V = mkV(STACK);
  const L1 = LIFTS[0]!; const shaft = { x: L1.x * U, z: L1.y * U, w: 2.0, h: 1.9 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE && !LOW_END, powerPreference: LOW_END ? "low-power" : "high-performance" });
  renderer.setPixelRatio(pixelRatioFor(getGfx(), window.devicePixelRatio || 1, !!MOBILE, LOW_END));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = LOW_END ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  // ghost sees in the dark: bright violet "night vision", thin fog
  const fogCol = opts.amGhost ? 0x1c0a2a : MAP === "kuburan" ? 0x070a14 : 0x000000;
  scene.background = new THREE.Color(fogCol);
  scene.fog = new THREE.FogExp2(fogCol, opts.drone ? 0.035 : opts.amGhost ? 0.035 : 0.11);
  if (opts.drone) scene.add(new THREE.HemisphereLight(0x8899cc, 0x221111, 1.4));
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, opts.drone ? 260 : 60);
  camera.rotation.order = "YXZ";
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(opts.amGhost ? 0xc9a0ff : 0x2a2440, opts.amGhost ? 0x402050 : 0x080404, opts.amGhost ? 2.6 : LOW_END ? 0.32 : 0.22));
  if (opts.amGhost) scene.add(new THREE.AmbientLight(0x9070c0, 0.8));
  // drone night vision (toggled from the drone HUD)
  const nv = new THREE.AmbientLight(0x80ff9a, 0); scene.add(nv);

  // floors and ceilings per room
  const ceilings: THREE.Mesh[] = [];
  let nvOn = false;
  for (const r of ROOMS) {
    const outdoor = MAP === "kuburan" || (MAP === "rumah" && r.name.startsWith("Kuburan"));
    const tex = MAP === "rumahsakit" ? tileTex("#c9d6cf", "#9fb0a8") : MAP === "hotel" ? carpetTex(r.y < 500 ? "#5a1018" : "#18304a") : outdoor ? canvasTex((g, s) => { g.fillStyle = "#1a2414"; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${60 + Math.random() * 50},30,.6)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 5); } }, 1) : woodTex(r.floor === "#18222a" ? "#2b3a40" : "#4a2e1e");
    tex.repeat.set(r.w * U / 3, r.h * U / 3);
    const v = V(r.x + r.w / 2, r.y + r.h / 2);
    const inShaft = STACK && Math.abs(shaft.x - v.x) < r.w * U / 2 && Math.abs(shaft.z - v.z) < r.h * U / 2;
    const hole = inShaft ? { x: shaft.x - v.x, z: shaft.z - v.z, w: shaft.w, h: shaft.h } : undefined;
    const f = new THREE.Mesh(slab(r.w * U, r.h * U, true, v.b > 0 ? hole : undefined), Mat({ map: tex, roughness: 0.9 }));
    f.rotation.x = -Math.PI / 2; f.position.set(v.x, v.b, v.z); scene.add(f);
    if (!outdoor) {
      const c = new THREE.Mesh(slab(r.w * U, r.h * U, false, v.b === 0 ? hole : undefined), Mat({ color: 0x1a1414, roughness: 1 }));
      c.rotation.x = Math.PI / 2; c.position.set(v.x, v.b + WALL_H, v.z); scene.add(c); ceilings.push(c);
    }
  }
  // walls & furniture (first boxes are structural walls; thin ones => walls)
  const wallMat = MAP === "rumahsakit" ? Mat({ map: tileTex("#dfe8e2", "#b8c6bf"), roughness: 0.6 }) : MAP === "hotel" ? Mat({ map: wallpaperTex, roughness: 0.9 }) : MAP === "kuburan" ? Mat({ map: stoneTex, roughness: 1 }) : Mat({ map: wallTex, roughness: 0.95 });
  const WALL_HM = MAP === "kuburan" ? 1.5 : WALL_H;
  const furnMat = Mat({ map: woodTex("#3a2214"), roughness: 0.8 });
  for (const w0 of WALLS) for (const w of splitRect(STACK, w0)) {
    const isWall = Math.min(w0.w, w0.h) <= 20;
    const h = isWall ? WALL_HM : 0.9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w * U, h, w.h * U), isWall ? wallMat : furnMat);
    const v = V(w.x + w.w / 2, w.y + w.h / 2);
    m.position.set(v.x, v.b + h / 2, v.z); scene.add(m);
  }
  // hotel: one vertical lift shaft; the cabin physically rides between floor 1 (y=0) and floor 2 (y=FLOOR2_H)
  const pickables: THREE.Object3D[] = [];
  let lift: { cabin: THREE.Group; land: { l: THREE.Mesh; r: THREE.Mesh; b: number }[]; inner: { l: THREE.Mesh; r: THREE.Mesh }; label: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; last: string } } | null = null;
  if (STACK) {
    const metal = Mat({ color: 0x9a9aa2, metalness: 0.85, roughness: 0.28 });
    const dark = Mat({ color: 0x2a2a30, metalness: 0.7, roughness: 0.4 });
    const gold = Mat({ color: 0xc9a040, emissive: 0x3a2a00, metalness: 0.7, roughness: 0.3 });
    const W = 1.8, D = 1.7, H = WALL_H - 0.3, TOP = FLOOR2_H + WALL_H;
    const sg = new THREE.Group(); sg.position.set(shaft.x, 0, shaft.z); scene.add(sg);
    // shaft walls (back + sides), full height
    const sb = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, TOP, 0.1), dark); sb.position.set(0, TOP / 2, D / 2 + 0.1); sg.add(sb);
    for (const sx of [-1, 1]) { const ss = new THREE.Mesh(new THREE.BoxGeometry(0.1, TOP, D + 0.3), dark); ss.position.set(sx * (W / 2 + 0.1), TOP / 2, 0); sg.add(ss); }
    // landing doors on each floor (front, closed unless the cabin is here)
    const land = [0, FLOOR2_H].map((b) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.25, 0.14), gold); frame.position.set(0, b + H + 0.12, -D / 2 - 0.08); sg.add(frame);
      const above = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, WALL_H - H - 0.25, 0.1), dark); above.position.set(0, b + H + 0.25 + (WALL_H - H - 0.25) / 2, -D / 2 - 0.08); sg.add(above);
      const mk = (sx: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(W / 2, H, 0.05), metal); m.position.set(sx * W / 4, b + H / 2, -D / 2 - 0.1); sg.add(m); return m; };
      return { l: mk(-1), r: mk(1), b };
    });
    // cabin
    const cabin = new THREE.Group(); sg.add(cabin);
    const cf = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), gold); cf.position.y = 0.03; cabin.add(cf);
    const cr = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), metal); cr.position.y = H + 0.03; cabin.add(cr);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), metal); cb.position.set(0, H / 2, D / 2 - 0.03); cabin.add(cb);
    for (const sx of [-1, 1]) { const cs = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), metal); cs.position.set(sx * (W / 2 - 0.03), H / 2, 0); cabin.add(cs); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.05, 0.05), gold); rail.position.set(0, 1.0, D / 2 - 0.1); cabin.add(rail);
    const mkInner = (sx: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(W / 2, H, 0.04), metal); m.position.set(sx * W / 4, H / 2, -D / 2 + 0.03); cabin.add(m); return m; };
    const inner = { l: mkInner(-1), r: mkInner(1) };
    // button panel on the inner right wall: ▲ up / ▼ down
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.3), dark); panel.position.set(W / 2 - 0.07, 1.25, -0.2); cabin.add(panel);
    const btnTex = (up: boolean) => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; g.fillStyle = up ? "#1f7a3a" : "#8a1a1a"; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); if (up) { g.moveTo(32, 12); g.lineTo(52, 44); g.lineTo(12, 44); } else { g.moveTo(32, 52); g.lineTo(52, 20); g.lineTo(12, 20); } g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    for (const up of [true, false]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20), [new THREE.MeshBasicMaterial({ color: up ? 0x2fbf5a : 0xd03030 }), new THREE.MeshBasicMaterial({ map: btnTex(up) }), new THREE.MeshBasicMaterial({ color: 0x222222 })]);
      btn.rotation.z = Math.PI / 2; btn.position.set(W / 2 - 0.1, up ? 1.38 : 1.12, -0.2); btn.userData["pick"] = up ? "up" : "down"; cabin.add(btn); pickables.push(btn);
    }
    const lc = document.createElement("canvas"); lc.width = 128; lc.height = 64; const lctx = lc.getContext("2d")!;
    const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: ltex })); disp.position.set(0, H - 0.25, D / 2 - 0.06); disp.rotation.y = Math.PI; cabin.add(disp);
    const cl = new THREE.PointLight(0xfff0d0, 4, 4); cl.position.set(0, H - 0.2, 0); cabin.add(cl);
    lift = { cabin, land, inner, label: { ctx: lctx, tex: ltex, last: "" } };
  }
  // doors (auto-swing open when anyone is near)
  const doorMat = Mat({ map: woodTex("#4a2c18"), roughness: 0.9 });
  const doors = DOORS.map((d) => {
    const pivot = new THREE.Group();
    const w = DOOR_W * U * 0.96, h = WALL_H * 0.85;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), doorMat);
    panel.position.set(w / 2, h / 2, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), Mat({ color: 0xc9a040 }));
    knob.position.set(w - 0.15, h * 0.5, 0.07); pivot.add(panel, knob);
    const v = d.v ? V(d.x, d.y - DOOR_W / 2 + 1) : V(d.x - DOOR_W / 2, d.y);
    if (d.v) { pivot.position.set(v.x, v.b, v.z - (STACK && d.y >= FLOOR2_Y && d.y - DOOR_W / 2 < FLOOR2_Y ? 0 : 0)); pivot.rotation.y = -Math.PI / 2; }
    else pivot.position.set(v.x, v.b, v.z);
    const i = DOORS.indexOf(d); panel.userData["pick"] = `door:${i}`; knob.userData["pick"] = `door:${i}`; pickables.push(panel, knob);
    scene.add(pivot);
    return { d, pivot, base: pivot.rotation.y, open: 0, was: false };
  });
  const theme = buildTheme(scene, MAP);
  // graves
  const graveMat = Mat({ color: 0x5a5d58, roughness: 1 });
  for (const [gx, gy] of (MAP === "kuburan" ? [[1060, 600], [1260, 640], [1380, 880], [1080, 900], [120, 300], [380, 120], [640, 330], [880, 160], [1320, 420], [220, 820], [600, 860], [900, 640]] : MAP === "rumah" ? [[1060, 600], [1260, 640], [1380, 880], [1080, 900]] : []) as [number, number][]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.2), graveMat); g.position.set((gx + 17) * U, 0.55, (gy + 22) * U); g.rotation.z = 0.08; scene.add(g);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16, 1, false, 0, Math.PI), graveMat); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.set((gx + 17) * U, 1.1, (gy + 22) * U); scene.add(top);
  }
  // exit gate
  const gateMat = Mat({ color: 0x8b0d17, emissive: 0x8b0d17, emissiveIntensity: 0.6 });
  const gate = new THREE.Mesh(new THREE.TorusGeometry(EXIT.r * U, 0.08, 8, 32), gateMat);
  { const v = V(EXIT.x, EXIT.y); gate.position.set(v.x, v.b + EXIT.r * U + 0.1, v.z); } gate.rotation.y = Math.PI / 2; scene.add(gate);
  const gateLight = new THREE.PointLight(0x8b0d17, 2, 5); gateLight.position.copy(gate.position); scene.add(gateLight);

  const tl = new THREE.TextureLoader();
  const texCache: Record<string, THREE.Texture> = {};
  const tex = (k: string) => (texCache[k] ??= (() => { const t = tl.load(opts.imgs[k]!); t.colorSpace = THREE.SRGBColorSpace; return t; })());
  const sprite = (k: string, w: number, h: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(k), transparent: true, alphaTest: 0.1 }));
    s.scale.set(w, h, 1); scene.add(s); return s;
  };
  const keys = KEYS.map((k) => { const s = sprite("key", 0.6, 0.3); const v = V(k.x, k.y); s.position.set(v.x, v.b + 0.6, v.z); s.userData["b"] = v.b; const l = new THREE.PointLight(0xffc840, 0.8, 2.5); l.position.copy(s.position); if (!LOW_END) scene.add(l); return { sprite: s, light: l } as Ent; });
  const bats = BATTERIES.map((b) => { const s = sprite("bat", 0.25, 0.4); const v = V(b.x, b.y); s.position.set(v.x, v.b + 0.3, v.z); const l = new THREE.PointLight(0x60ff80, 0.5, 1.8); l.position.copy(s.position); if (!LOW_END) scene.add(l); return { sprite: s, light: l } as Ent; });
  const npcKuyangs: Record<string, Kuyang> = {};
  const players: Record<string, { sprite: THREE.Sprite | null; av: Avatar | null; ku: Kuyang | null; tag: THREE.Sprite | null; light: THREE.SpotLight; target: THREE.Object3D; shout: THREE.Sprite }> = {};

  // flashlight (attached to camera)
  const flash = new THREE.SpotLight(0xfff1d0, 30, 22, 0.42, 0.45, 1.6);
  flash.position.set(0.25, -0.25, 0); camera.add(flash);
  const ft = new THREE.Object3D(); ft.position.set(0, -0.1, -5); camera.add(ft); flash.target = ft;
  // viewmodel hand holding torch
  const vm = new THREE.Group(); camera.add(vm);
  const look = opts.me === "ghost" ? null : CHARACTERS[opts.me];
  if (look) {
    const sleeve = Mat({ color: look.top, roughness: 0.9 });
    const skin = Mat({ color: 0xd9a77e, roughness: 0.7 });
    const metal = Mat({ color: look.torch, metalness: 0.7, roughness: 0.35 });
    // forearm (rounded sleeve) + cuff + palm + 4 curled fingers + thumb wrapped round the torch
    const cap = (r: number, l: number, m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, LOW_END ? 3 : 6, LOW_END ? 6 : 12), m);
    const buildHand = (side: 1 | -1, holding: boolean) => {
      const g = new THREE.Group();
      const fore = cap(0.055, 0.36, sleeve); fore.rotation.x = Math.PI / 2; fore.position.set(0, 0, 0.12);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 14), skin); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0, -0.08);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.09), skin); palm.position.set(0, 0, -0.14);
      g.add(fore, cuff, palm);
      for (let i = 0; i < 4; i++) {
        const f = cap(0.012, holding ? 0.03 : 0.05, skin);
        f.position.set(-0.03 + i * 0.02, holding ? 0.025 : -0.005, holding ? -0.19 : -0.205);
        f.rotation.x = holding ? -0.2 : Math.PI / 2 + 0.25; g.add(f);
      }
      const th = cap(0.013, 0.035, skin); th.position.set(side * -0.05, 0.02, -0.15); th.rotation.set(0.6, 0, side * 0.9); g.add(th);
      return g;
    };
    const rightH = buildHand(1, true); rightH.position.set(0.28, -0.3, -0.42); rightH.rotation.x = 0.12;
    const leftH = buildHand(-1, false); leftH.position.set(-0.33, -0.38, -0.38); leftH.rotation.set(0.25, 0.15, 0.1);
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 14), metal); torch.rotation.x = Math.PI / 2; torch.position.set(0.28, -0.27, -0.66);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.08, 14), metal); head.rotation.x = Math.PI / 2; head.position.set(0.28, -0.27, -0.82);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); lens.position.set(0.28, -0.27, -0.861);
    vm.add(rightH, leftH, torch, head, lens);
    vm.userData["lens"] = lens;
  } else {
    // ghost: smoky dark claws
    const smoke = Mat({ color: 0x1a0a22, emissive: 0x400010, transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 6), smoke); c.rotation.x = -Math.PI / 2 - 0.3; c.position.set(sx * 0.32 + (i - 1) * 0.05, -0.35, -0.55); vm.add(c); }
    flash.color.set(0x9a2040); flash.intensity = 6;
  }
  vm.traverse((o) => { o.renderOrder = 10; const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.depthTest = false; (m as THREE.MeshStandardMaterial).fog = false; } });

  // admin cinematic drone: quadcopter with spinning rotors and blinking LEDs, visible to players
  const drone = new THREE.Group(); drone.visible = false; scene.add(drone);
  const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), Mat({ color: 0x1a1a1f, metalness: 0.6, roughness: 0.4 })); drone.add(dBody);
  const rotors: THREE.Mesh[] = [];
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.04), Mat({ color: 0x2a2a30 })); arm.position.set(ax * 0.16, 0, az * 0.16); arm.rotation.y = ax * az > 0 ? -Math.PI / 4 : Math.PI / 4; drone.add(arm);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.01, 0.04), Mat({ color: 0xbbbbbb, transparent: true, opacity: 0.7 })); r.position.set(ax * 0.27, 0.06, az * 0.27); drone.add(r); rotors.push(r);
  }
  const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xff2030 })); ledR.position.set(-0.12, -0.06, 0.17);
  const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0x30ff60 })); ledG.position.set(0.12, -0.06, 0.17);
  const dLight = new THREE.PointLight(0xff3040, 1.2, 3); dLight.position.y = -0.15; drone.add(ledR, ledG, dLight);
  let bobT = 0, vmX = 0;
  // 3D jumpscare: a full Kuyang lunges out of the dark straight at the camera, fangs first, with heavy shake
  const scareKu = buildKuyang(false); scareKu.root.visible = false; camera.add(scareKu.root);
  scareKu.root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { (m as THREE.MeshStandardMaterial).fog = false; m.depthTest = false; } o.renderOrder = 20; });
  const scareLight = new THREE.PointLight(0xff1020, 0, 4); scareLight.position.set(0, 0.2, -0.3); camera.add(scareLight);
  let scareAt = -1;
  const raycaster = new THREE.Raycaster(); raycaster.far = 3.2;
  return {
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); vmX = w < h ? -0.13 : 0; vm.scale.setScalar(w < h ? 0.8 : 1);
    },
    ensurePlayer(id: string, k: string, isHunter: boolean, name = "") {
      if (players[id]) return;
      const av = isHunter && isChar(k) ? buildAvatar(k, Mat as unknown as (p: THREE.MeshStandardMaterialParameters) => THREE.Material, LOW_END) : null;
      if (av) scene.add(av.root);
      const ku = !isHunter ? buildKuyang(LOW_END) : null;
      if (ku) scene.add(ku.root);
      const s = av || ku ? null : sprite(k, 1.15, 1.6);
      const tag = isHunter && name ? nameTag(name) : null; if (tag) scene.add(tag);
      const light = new THREE.SpotLight(0xfff1d0, isHunter ? 12 : 0, 14, 0.4, 0.5, 1.6);
      const target = new THREE.Object3D(); scene.add(light, target); light.target = target;
      const shout = sprite("ex", 0.35, 0.5); shout.visible = false;
      players[id] = { sprite: s, av, ku, tag, light, target, shout };
    },
    frame(st: {
      dt: number; t: number; cam: { x: number; y: number }; yaw: number; pitch: number; moving: boolean; battery: number; near: number;
      keyMask: number; batMask: number; npcs: { kind: string; x: number; y: number }[];
      others: { id: string; x: number; y: number; yaw: number; visible: boolean; shouting: boolean; ghost: boolean; moving: boolean; pitch: number; emote: string | null; liftY?: number }[];
      firstPerson: boolean; camH?: number; drone?: { x: number; y: number; h: number; yaw: number } | null;
      /** Hotel lift: cabin height (m), landing door openness per floor (0..1), travel direction, and whether the camera rides it. */
      lift?: { y: number; doors: number[]; dir: number; riding: boolean } | null;
    }) {
      doors.forEach((dr, i) => {
        const near = !!doorOpen[i];
        if (near !== dr.was && Math.hypot(st.cam.x - dr.d.x, st.cam.y - dr.d.y) < 400) audio.creak();
        dr.was = near;
        dr.open += ((near ? 1 : 0) - dr.open) * Math.min(1, st.dt * 4);
        dr.pivot.rotation.y = dr.base + dr.open * 1.6;
      });
      const cv = V(st.cam.x, st.cam.y);
      if (lift && st.lift) {
        const L = st.lift; lift.cabin.position.y = L.y;
        lift.land.forEach((ld, i) => { const o = L.doors[i] ?? 0; ld.l.position.x = -0.45 - o * 0.85; ld.r.position.x = 0.45 + o * 0.85; });
        const io = Math.max(...L.doors); lift.inner.l.position.x = -0.45 - io * 0.85; lift.inner.r.position.x = 0.45 + io * 0.85;
        const txt = L.y > FLOOR2_H - 0.05 ? "2" : L.y < 0.05 ? "1" : L.dir > 0 ? "▲" : "▼";
        if (txt !== lift.label.last) { const g = lift.label.ctx; g.fillStyle = "#120a04"; g.fillRect(0, 0, 128, 64); g.fillStyle = "#ffb030"; g.font = "bold 44px monospace"; g.textAlign = "center"; g.fillText(txt, 64, 48); lift.label.tex.needsUpdate = true; lift.label.last = txt; }
      }
      const camBase = st.lift?.riding ? st.lift.y : cv.b;
      if (st.moving) bobT += st.dt * 9;
      const bob = st.firstPerson ? Math.sin(bobT) * 0.04 : 0;
      const shake = st.near > 0.55 ? (Math.random() - 0.5) * st.near * 0.03 : 0;
      camera.position.set(cv.x, st.camH ?? camBase + EYE + Math.abs(bob), cv.z);
      if (opts.drone) {
        // aerial: roofs vanish above the walls and fog thins with altitude so the arena stays readable
        const h = st.camH ?? EYE; const above = h > WALL_H - 0.2;
        for (const c of ceilings) c.visible = !above;
        (scene.fog as THREE.FogExp2).density = (nvOn ? 0.012 : 0.035) / (1 + Math.max(0, h - 4) * 0.35);
      }
      drone.visible = !!st.drone;
      if (st.drone) { drone.position.set(st.drone.x * U, st.drone.h + Math.sin(st.t * 2) * 0.03, st.drone.y * U); drone.rotation.y = st.drone.yaw; rotors.forEach((r, i) => { r.rotation.y = st.t * 40 + i; }); const on = Math.sin(st.t * 6) > 0; ledR.visible = on; ledG.visible = !on; }
      const sa = scareAt < 0 ? 1 : (st.t - scareAt);
      if (sa >= 0 && sa < 1.4) {
        // lunge: 2.4 m -> 0.95 m, facing the camera (model faces +z) in front of the eyes in ~0.18 s, then hover there grinning
        const k = Math.min(1, sa / 0.18), d = 2.4 - (2.4 - 0.95) * (1 - (1 - k) ** 3);
        scareKu.root.visible = true; scareKu.update({ t: st.t * 3, dt: st.dt, moving: true });
        scareKu.root.position.set(Math.sin(st.t * 40) * 0.02, -0.18 - (scareKu.root.position.y - scareKu.root.position.y), -d);
        scareKu.root.position.y = 0.12 + Math.sin(st.t * 30) * 0.015; scareKu.root.rotation.set(0.1, 0, 0);
        scareLight.intensity = 6 + Math.random() * 4;
      } else { scareKu.root.visible = false; scareLight.intensity = 0; }
      const jolt = sa >= 0 && sa < 1.4 ? (1 - sa / 1.4) * 0.09 : 0;
      camera.rotation.set(st.pitch + shake + (Math.random() - 0.5) * jolt, st.yaw + (Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt * 0.8);
      vm.visible = st.firstPerson;
      vm.position.set(vmX + Math.cos(bobT * 0.5) * 0.02, bob * 0.6, 0);
      // flashlight power
      if (opts.drone) flash.intensity = 0;
      else if (!opts.amGhost) {
        const flick = st.battery < 20 ? (Math.random() < 0.15 ? 0.2 : 1) : Math.random() < 0.008 ? 0.5 : 1;
        const p = st.battery <= 0 ? 0.04 : (0.25 + st.battery / 100 * 0.75) * flick;
        flash.intensity = 45 * p; flash.distance = 8 + 16 * p;
        const lens = vm.userData["lens"] as THREE.Mesh | undefined;
        if (lens) (lens.material as THREE.MeshBasicMaterial).color.setScalar(0.3 + p * 0.7);
      }
      const open = st.keyMask === 31;
      gateMat.color.set(open ? 0x59e36b : 0x8b0d17); gateMat.emissive.set(open ? 0x59e36b : 0x8b0d17); gateLight.color.set(open ? 0x59e36b : 0x8b0d17);
      keys.forEach((k, i) => { const on = !(st.keyMask & (1 << i)); k.sprite.visible = on; k.light!.visible = on; k.sprite.position.y = (k.sprite.userData["b"] as number) + 0.6 + Math.sin(st.t * 3 + i) * 0.08; });
      bats.forEach((b, i) => { const on = !(st.batMask & (1 << i)); b.sprite.visible = on; b.light!.visible = on; });
      st.npcs.forEach((n, i) => {
        const key = `npc${i}`;
        let k = npcKuyangs[key];
        if (!k) { k = npcKuyangs[key] = buildKuyang(true); scene.add(k.root); }
        const nv3 = V(n.x, n.y);
        k.root.position.x = nv3.x; k.root.position.z = nv3.z;
        k.root.rotation.y = Math.atan2(cv.x - k.root.position.x, cv.z - k.root.position.z);
        k.update({ t: st.t + i * 1.7, dt: st.dt, moving: true }); k.root.position.y += nv3.b;
      });
      for (const o of st.others) {
        const p = players[o.id]; if (!p) continue;
        const ov = V(o.x, o.y); const ob = o.liftY ?? ov.b, ox = ov.x, oz = ov.z;
        p.light.visible = o.visible && !o.ghost;
        if (p.av) {
          p.av.root.visible = o.visible; p.av.root.position.set(ox, ob, oz); p.av.root.rotation.y = o.yaw;
          if (o.visible) p.av.update({ dt: st.dt, t: st.t, moving: o.moving, pitch: o.pitch, emote: o.emote });
        }
        if (p.ku) {
          p.ku.root.visible = o.visible; p.ku.root.position.x = ox; p.ku.root.position.z = oz; p.ku.root.rotation.y = o.yaw + Math.PI;
          if (o.visible) { p.ku.update({ t: st.t, dt: st.dt, moving: o.moving }); p.ku.root.position.y += ob; }
        }
        if (p.sprite) {
          p.sprite.visible = o.visible;
          const h = o.ghost ? 1.3 + Math.sin(st.t * 2.5) * 0.1 : 0.8;
          p.sprite.position.set(ox, ob + h, oz);
          if (o.ghost) (p.sprite.material as THREE.SpriteMaterial).opacity = 0.75 + Math.sin(st.t * 4) * 0.15;
        }
        if (p.tag) { p.tag.visible = o.visible; p.tag.position.set(ox, ob + 1.78, oz); }
        p.light.position.set(ox, ob + 1.2, oz);
        p.target.position.set(ox - Math.sin(o.yaw) * 5, ob + 0.6, oz - Math.cos(o.yaw) * 5);
        p.shout.visible = o.visible && o.shouting; p.shout.position.set(ox, ob + 2.1 + Math.sin(st.t * 12) * 0.05, oz);
      }
      theme.update(st.t, st.dt, st.cam);
      renderer.render(scene, camera);
    },
    setNightVision(on: boolean) {
      nvOn = on; nv.intensity = on ? 3.2 : 0;
      (scene.fog as THREE.FogExp2).density = on ? 0.012 : 0.035;
      scene.background = new THREE.Color(on ? 0x0a2010 : fogCol);
      renderer.toneMappingExposure = on ? 1.6 : 1;
    },
    /** Start the 3D Kuyang jumpscare (t = game time from frame()). */
    scare(t: number) { scareAt = t; },
    /** Tap/click picking: returns "door:<i>", "up" or "down" for the object under the screen point, within reach. */
    pick(clientX: number, clientY: number): string | null {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return (hit?.object.userData["pick"] as string | undefined) ?? null;
    },
    dispose() { renderer.dispose(); },
  };
}
export { WORLD };
