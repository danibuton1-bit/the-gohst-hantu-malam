import createGraph from "ngraph.graph";
import { aStar, type PathFinder } from "ngraph.path";
import data from "./house-nav.json";

export const HOUSE = data;
export type HousePosition = { x: number; y: number; h: number };
type Point = { x: number; z: number; h: number };
const points: Point[] = data.points.map(([x = 0, z = 0, h = 0]) => ({ x, z, h }));
const cells = new Map<string, number[]>();
points.forEach((p, i) => {
  const key = cellKey(p.x, p.z);
  cells.set(key, [...(cells.get(key) ?? []), i]);
});
function cellKey(x: number, z: number) { return `${Math.floor(x / data.cell)},${Math.floor(z / data.cell)}`; }
export function housePoint(id: number): HousePosition {
  const p = points[id];
  if (!p) throw new Error("Invalid house placement");
  return { x: p.x * 50, y: p.z * 50, h: p.h };
}
export function houseNode(pos: HousePosition) {
  const local = cells.get(cellKey(pos.x / 50, pos.y / 50));
  let best = -1, distance = Infinity;
  const candidates = local ?? points.map((_, i) => i);
  for (const i of candidates) {
    const p = points[i]; if (!p) continue;
    const d = (p.x - pos.x / 50) ** 2 + (p.z - pos.y / 50) ** 2 + 25 * (p.h - pos.h) ** 2;
    if (d < distance) { distance = d; best = i; }
  }
  return best;
}
/** Capsule clearance and headroom were baked from the very same GLB transform.
 * Neighbour-only steps prevent tunnelling and switching to another stacked floor.
 */
export function moveHouse(pos: HousePosition, dx: number, dy: number, blocked: (pos: HousePosition) => boolean = () => false): HousePosition {
  let result = { ...pos };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  for (let s = 0; s < steps; s++) {
    for (const axis of ["x", "y"] as const) {
      const next = { ...result, [axis]: result[axis] + (axis === "x" ? dx : dy) / steps };
      const ids = cells.get(cellKey(next.x / 50, next.y / 50));
      const from = houseNode(result);
      const to = ids?.find((id) => {
        const p = points[id];
        return p && Math.abs(p.h - result.h) <= data.maxStep + .001 && (id === from || data.links[from]?.includes(id));
      });
      const p = to === undefined ? undefined : points[to];
      if (p) { const candidate = { ...next, h: p.h }; if (!blocked(candidate)) result = candidate; }
    }
  }
  return result;
}
let finder: PathFinder<Point> | undefined;
function getFinder() {
  if (finder) return finder;
  const graph = createGraph<Point>();
  points.forEach((p, i) => graph.addNode(i, p));
  data.links.forEach((ids, i) => ids.forEach((j) => { if (j > i) graph.addLink(i, j); }));
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z, a.h - b.h);
  finder = aStar(graph, { heuristic: (a, b) => distance(a.data, b.data), distance: (a, b) => distance(a.data, b.data) });
  return finder;
}
/** ngraph returns the path from destination to source. */
export function housePath(from: HousePosition, to: HousePosition): number[] {
  return getFinder().find(houseNode(from), houseNode(to)).map((n) => Number(n.id)).reverse();
}
export function houseWaypoint(from: HousePosition, to: HousePosition): HousePosition {
  const path = housePath(from, to);
  const next = path[1];
  return next === undefined ? to : housePoint(next);
}
export function createHouseNavigator() {
  let goal = -1, path: number[] = [], cursor = 0;
  return (from: HousePosition, to: HousePosition) => {
    const nextGoal = houseNode(to), current = houseNode(from);
    if (nextGoal !== goal || path.length === 0) {
      goal = nextGoal; path = housePath(from, to); cursor = 0;
    }
    const at = path.indexOf(current, cursor);
    if (at >= 0) cursor = at;
    const next = path[cursor + 1];
    return next === undefined ? to : housePoint(next);
  };
}
export function houseHeight(x: number, y: number, h = .756) {
  const id = houseNode({ x, y, h });
  return points[id]?.h ?? h;
}