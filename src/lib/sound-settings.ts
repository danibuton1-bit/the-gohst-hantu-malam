// Admin sound manager settings (saved on this device).
export type SoundSettings = { music: number; kuyang: number; pocong: number; kunti: number };
const KEY = "hm-sound";
export const DEFAULT_SOUND: SoundSettings = { music: 1, kuyang: 1, pocong: 1, kunti: 1 };
export function getSound(): SoundSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SOUND;
  try { return { ...DEFAULT_SOUND, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<SoundSettings>) }; } catch { return DEFAULT_SOUND; }
}
export const saveSound = (s: SoundSettings) => localStorage.setItem(KEY, JSON.stringify(s));
