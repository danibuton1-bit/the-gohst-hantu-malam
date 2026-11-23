// Graphics quality preference (per device).
export type Gfx = "hemat" | "standar" | "ultra";
const KEY = "hm-gfx";
export const getGfx = (): Gfx => {
  if (typeof localStorage === "undefined") return "standar";
  const v = localStorage.getItem(KEY);
  return v === "hemat" || v === "ultra" ? v : "standar";
};
export const setGfx = (g: Gfx) => localStorage.setItem(KEY, g);
/** Render resolution multiplier for the chosen quality. Ultra FHD = full device pixels (max 3). */
export function pixelRatioFor(g: Gfx, dpr: number, mobile: boolean, lowEnd: boolean): number {
  if (g === "ultra") return Math.min(3, dpr);
  if (g === "hemat") return 0.75;
  return lowEnd ? 0.75 : mobile ? Math.min(1.25, dpr) : Math.min(2, dpr);
}
