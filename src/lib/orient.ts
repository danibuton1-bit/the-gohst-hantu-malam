// Portrait screens are rotated 90deg clockwise by CSS (.landscape-wrap) so the game always plays landscape.
export const isRotated = () => typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches;
/** Convert a screen-space delta into the rotated content's space. */
export function toContent(dx: number, dy: number) {
  return isRotated() ? { x: dy, y: -dx } : { x: dx, y: dy };
}
const FS_KEY = "hm-fullscreen";
/** Player preference: auto full screen on tap (default on). */
export const fullscreenWanted = () => typeof localStorage === "undefined" || localStorage.getItem(FS_KEY) !== "0";
export const isFullscreen = () => typeof document !== "undefined" && !!document.fullscreenElement;
export const fullscreenSupported = () => typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
export async function setFullscreen(on: boolean) {
  localStorage.setItem(FS_KEY, on ? "1" : "0");
  try {
    if (on) await tryLockLandscape();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch { /* ignore */ }
}
export async function tryLockLandscape() {
  if (!fullscreenWanted()) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch { /* unsupported: CSS rotation fallback handles it */ }
}
