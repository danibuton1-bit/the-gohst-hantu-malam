// The squad (party) the player belongs to lives in the main lobby; this remembers its code.
const KEY = "hm-squad";
export const SQUAD_EVENT = "hm-squad";
export const COUNTDOWN_MS = 10_000;
export function getSquad(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } }
export function setSquad(code: string) { try { localStorage.setItem(KEY, code); } catch { /* ignore */ } }
/** Switch to a friend's squad (invite accepted); the lobby picks it up. */
export function joinSquad(code: string) { setSquad(code); window.dispatchEvent(new Event(SQUAD_EVENT)); }
/** Seconds left on a squad countdown, or null when none is running. */
export function secondsLeft(until: string | null | undefined, now: number): number | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  return ms > -3000 ? Math.max(0, Math.ceil(ms / 1000)) : null;
}
