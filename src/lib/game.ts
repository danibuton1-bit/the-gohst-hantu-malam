// Shared deterministic game world: every client computes the same map, items and NPC paths.
export const WORLD = { w: 1500, h: 1000 };
export const GAME_SECONDS = 300;
export const TOTAL_KEYS = 5;
export const PLAYER_R = 18;
export const CATCH_DIST = 42;

export type Rect = { x: number; y: number; w: number; h: number };
export type Room = Rect & { name: string; floor: string };

const RW = 500, RH = 500;
const BASE_ROOMS: Room[] = [
  { name: "Ruang Tamu", x: 0, y: 0, w: RW, h: RH, floor: "#2a1a14" },
  { name: "Lorong", x: RW, y: 0, w: RW, h: RH, floor: "#1c1620" },
  { name: "Dapur", x: RW * 2, y: 0, w: RW, h: RH, floor: "#22201a" },
  { name: "Kamar Mandi", x: 0, y: RH, w: RW, h: RH, floor: "#18222a" },
  { name: "Gudang", x: RW, y: RH, w: RW, h: RH, floor: "#1f1a12" },
  { name: "Kuburan Belakang", x: RW * 2, y: RH, w: RW, h: RH, floor: "#141d12" },
];

const T = 20; // wall thickness
const DOOR = 110;
function hWall(x: number, y: number, len: number, doorAt?: number): Rect[] {
  if (doorAt === undefined) return [{ x, y: y - T / 2, w: len, h: T }];
  return [
    { x, y: y - T / 2, w: doorAt - DOOR / 2 - x, h: T },
    { x: doorAt + DOOR / 2, y: y - T / 2, w: x + len - (doorAt + DOOR / 2), h: T },
  ];
}
function vWall(x: number, y: number, len: number, doorAt?: number): Rect[] {
  if (doorAt === undefined) return [{ x: x - T / 2, y, w: T, h: len }];
  return [
    { x: x - T / 2, y, w: T, h: doorAt - DOOR / 2 - y },
    { x: x - T / 2, y: doorAt + DOOR / 2, w: T, h: y + len - (doorAt + DOOR / 2) },
  ];
}

/** Swinging doors in every doorway: hinge at one side, v=true when the door sits in a vertical wall. */
const BASE_DOORS: { x: number; y: number; v: boolean }[] = [
  { x: RW, y: 250, v: true }, { x: RW * 2, y: 320, v: true }, { x: RW, y: 700, v: true }, { x: RW * 2, y: 780, v: true },
  { x: 250, y: RH, v: false }, { x: 750, y: RH, v: false }, { x: 1250, y: RH, v: false },
];
export const DOOR_W = DOOR;

const OUTER_INNER: Rect[] = [
  ...hWall(0, T / 2, WORLD.w), ...hWall(0, WORLD.h - T / 2, WORLD.w),
  ...vWall(T / 2, 0, WORLD.h), ...vWall(WORLD.w - T / 2, 0, WORLD.h),
  ...vWall(RW, 0, RH, 250), ...vWall(RW * 2, 0, RH, 320),
  ...vWall(RW, RH, RH, 700), ...vWall(RW * 2, RH, RH, 780),
];
const MID_DOORS: Rect[] = [...hWall(0, RH, RW, 250), ...hWall(RW, RH, RW, 750), ...hWall(RW * 2, RH, RW, 1250)];
const MID_SOLID: Rect[] = hWall(0, RH, WORLD.w);
const FURNITURE: Rect[] = [
  // furniture
  { x: 120, y: 120, w: 160, h: 60 }, { x: 1180, y: 60, w: 220, h: 50 }, { x: 1320, y: 200, w: 60, h: 160 },
  { x: 80, y: 640, w: 120, h: 70 }, { x: 600, y: 600, w: 70, h: 70 }, { x: 820, y: 820, w: 90, h: 70 },
  { x: 1150, y: 640, w: 40, h: 70 }, { x: 1300, y: 600, w: 40, h: 70 }, { x: 1150, y: 840, w: 40, h: 70 },
  { x: 700, y: 180, w: 100, h: 30 },
];

/** Selectable maps ("MODE"). All share the same grid so keys, spawns and ghost paths stay valid. */
export type MapId = "rumah" | "rumahsakit" | "kuburan" | "hotel";
export const MAPS: { id: MapId; nama: string; desc: string; names: string[] }[] = [
  { id: "rumah", nama: "Rumah Tua", desc: "Rumah klasik berhantu, gelap dan berderit.", names: BASE_ROOMS.map((r) => r.name) },
  { id: "rumahsakit", nama: "Rumah Sakit", desc: "Lampu neon berkedip hidup-mati di lorong rumah sakit.", names: ["Lobi IGD", "Lorong Bangsal", "Ruang Operasi", "Kamar Mayat", "Gudang Obat", "Ruang Isolasi"] },
  { id: "kuburan", nama: "Kuburan", desc: "Malam pekat, kabut dan asap di antara nisan.", names: ["Gerbang Makam", "Jalan Setapak", "Makam Tua", "Pohon Beringin", "Rumah Penjaga", "Makam Keramat"] },
  { id: "hotel", nama: "Hotel 2 Lantai", desc: "Naik turun antar lantai dengan lift.", names: ["Lobi Hotel (Lt.1)", "Lorong Lt.1", "Restoran (Lt.1)", "Kamar 201 (Lt.2)", "Lorong Lt.2", "Suite 203 (Lt.2)"] },
];
export const isMapId = (v: unknown): v is MapId => MAPS.some((m) => m.id === v);
/** Hotel lifts: stand on one pad and ride to the other floor. */
/** Lift 2 sits exactly above lift 1 (floor-2 y = floor-1 y + 500), so the cabin rides one vertical shaft. */
export const LIFTS = [{ x: 750, y: 410, floor: 1 }, { x: 750, y: 910, floor: 2 }];
/** Where you step out of the cabin (its open side faces the smaller y). */
export const liftExit = (l: { x: number; y: number }) => ({ x: l.x, y: l.y - 50 });
/** Floor-2 rooms are the bottom half of the grid; scene3d stacks them 3.8 m above floor 1. */
export const FLOOR2_Y = 500;
export const FLOOR2_H = 3.8;
export const LIFT_R = 45;

export let MAP_ID: MapId = "rumah";
export let ROOMS: Room[] = BASE_ROOMS;
export let DOORS = BASE_DOORS;
export let WALLS: Rect[] = [...OUTER_INNER, ...MID_DOORS, ...FURNITURE];
export function applyMap(id: MapId) {
  MAP_ID = id;
  const m = MAPS.find((x) => x.id === id)!;
  ROOMS = BASE_ROOMS.map((r, i) => ({ ...r, name: m.names[i]! }));
  DOORS = id === "hotel" ? BASE_DOORS.filter((d) => d.v) : BASE_DOORS;
  WALLS = [...OUTER_INNER, ...(id === "hotel" ? MID_SOLID : MID_DOORS), ...FURNITURE];
  doorOpen = DOORS.map(() => false);
}
/** Doors start closed and only open when a player clicks them; closed doors block movement. */
export let doorOpen: boolean[] = BASE_DOORS.map(() => false);
export function setDoorOpen(i: number, open: boolean) { if (i >= 0 && i < doorOpen.length) doorOpen[i] = open; }
export function doorRect(d: { x: number; y: number; v: boolean }): Rect {
  return d.v ? { x: d.x - T / 2, y: d.y - DOOR / 2, w: T, h: DOOR } : { x: d.x - DOOR / 2, y: d.y - T / 2, w: DOOR, h: T };
}
export function nearestDoor(x: number, y: number, max = 90) {
  let best = -1, bd = max;
  DOORS.forEach((d, i) => { const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = i; } });
  return best;
}
const blocked = (x: number, y: number, r: number) => WALLS.some((w) => circleHitsRect(x, y, r, w)) || DOORS.some((d, i) => !doorOpen[i] && circleHitsRect(x, y, r, doorRect(d)));
export function liftAt(x: number, y: number) {
  return MAP_ID === "hotel" ? LIFTS.find((l) => Math.hypot(l.x - x, l.y - y) < LIFT_R) ?? null : null;
}

export const KEYS = [
  { id: 0, name: "Kunci Ruang Tamu", x: 380, y: 400 },
  { id: 1, name: "Kunci Lorong", x: 900, y: 90 },
  { id: 2, name: "Kunci Dapur", x: 1420, y: 430 },
  { id: 3, name: "Kunci Kamar Mandi", x: 90, y: 920 },
  { id: 4, name: "Kunci Gudang", x: 940, y: 600 },
];
export const BATTERIES = [
  { id: 0, x: 250, y: 300 }, { id: 1, x: 620, y: 420 }, { id: 2, x: 1100, y: 250 },
  { id: 3, x: 350, y: 760 }, { id: 4, x: 720, y: 900 }, { id: 5, x: 1250, y: 940 },
];
export const EXIT = { x: 1420, y: 760, r: 50 };
export const HUNTER_SPAWNS = [{ x: 250, y: 260 }, { x: 160, y: 380 }, { x: 330, y: 220 }];
export const GHOST_SPAWN = { x: 1250, y: 780 };

export function circleHitsRect(cx: number, cy: number, r: number, b: Rect) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

export function move(x: number, y: number, dx: number, dy: number, r = PLAYER_R): { x: number; y: number } {
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4);
  if (steps > 1) {
    let p = { x, y };
    for (let i = 0; i < steps; i++) p = move(p.x, p.y, dx / steps, dy / steps, r);
    return p;
  }
  let nx = x + dx;
  if (blocked(nx, y, r)) nx = x;
  let ny = y + dy;
  if (blocked(nx, ny, r)) ny = y;
  // diagonal safety: never end inside a wall
  if (blocked(nx, ny, r)) return { x, y };
  return { x: nx, y: ny };
}

export function roomAt(x: number, y: number) {
  return ROOMS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.name ?? "";
}

/** NPC traps follow fixed loops so all clients agree without syncing. */
export type Npc = { kind: "kuntilanak" | "pocong" | "hoodie"; x: number; y: number };
const NPC_PATHS: { kind: Npc["kind"]; pts: [number, number][]; speed: number }[] = [
  { kind: "kuntilanak", pts: [[700, 100], [900, 380], [600, 380]], speed: 45 },
  { kind: "kuntilanak", pts: [[1060, 560], [1260, 560], [1420, 940], [1060, 940]], speed: 40 },
  { kind: "pocong", pts: [[120, 560], [420, 560], [420, 900], [250, 900]], speed: 55 },
  { kind: "pocong", pts: [[1100, 120], [1100, 420], [1250, 420]], speed: 50 },
  { kind: "hoodie", pts: [[620, 620], [900, 620], [900, 900], [620, 900]], speed: 48 },
];
export function npcsAt(seconds: number): Npc[] {
  return NPC_PATHS.map((p) => {
    const segs = p.pts.map((a, i) => {
      const b = p.pts[(i + 1) % p.pts.length]!;
      return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    });
    const total = segs.reduce((s, g) => s + g.len, 0);
    let d = (seconds * p.speed) % total;
    for (const s of segs) {
      if (d <= s.len) {
        const t = d / s.len;
        const hop = p.kind === "pocong" ? -Math.abs(Math.sin(seconds * 6)) * 14 : Math.sin(seconds * 2) * 6;
        return { kind: p.kind, x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t + hop };
      }
      d -= s.len;
    }
    return { kind: p.kind, x: p.pts[0]![0], y: p.pts[0]![1] };
  });
}

export type Outcome = "hunters" | "ghost" | null;
/** Hunters win once every hunter is out of play and at least one escaped; time-out with no escape = ghost. */
export function decideOutcome(hunters: { status: string }[], timeLeft: number): Outcome {
  const active = hunters.filter((h) => h.status === "alive").length;
  const escaped = hunters.filter((h) => h.status === "escaped").length;
  if (active === 0) return escaped > 0 ? "hunters" : "ghost";
  if (timeLeft <= 0) return escaped > 0 ? "hunters" : "ghost";
  return null;
}

export function roomCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

export const BOT_GHOST_ID = "bot-ghost";
/**
 * Roles from lobby preferences: one random ghost among those who want to be the ghost.
 * Nobody wants it (or a solo player) -> everyone hunts and the AI ghost plays.
 */
export function assignRoles(players: { id: string; pref: string }[], rand = Math.random): { roles: Record<string, "ghost" | "hunter">; bot: boolean } {
  const want = players.filter((p) => p.pref === "ghost");
  const ghost = players.length >= 2 && want.length > 0 ? want[Math.floor(rand() * want.length)]!.id : null;
  const roles = Object.fromEntries(players.map((p) => [p.id, p.id === ghost ? "ghost" : "hunter"])) as Record<string, "ghost" | "hunter">;
  return { roles, bot: ghost === null };
}

/** AI ghost waypoints (room centres and doorways) used while it has no target. */
export const BOT_PATROL: [number, number][] = [[1250, 760], [1000, 780], [750, 750], [750, 520], [500, 700], [250, 750], [250, 520], [250, 250], [500, 250], [750, 300], [1000, 320], [1250, 250], [1250, 520]];
