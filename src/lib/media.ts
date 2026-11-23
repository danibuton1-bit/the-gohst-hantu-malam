// Admin-uploaded media (lobby backgrounds, music, ghost SFX), downloaded once at boot into the
// browser Cache Storage and played from local blob URLs so the lobby video never buffers.
import { supabase } from "@/integrations/supabase/client";
import type { MediaKind } from "./media.functions";

export type MediaItem = { id: string; kind: MediaKind; ghost: string | null; media_type: string; nama: string; path: string; src: string };

const CACHE = "hm-media-v1";
let items: MediaItem[] = [];
let loaded = false;
const subs = new Set<() => void>();

export const getMedia = () => items;
export const mediaLoaded = () => loaded;
export function onMedia(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
export const findMedia = (kind: MediaKind, ghost?: string) => items.find((m) => m.kind === kind && (!ghost || m.ghost === ghost));

/** Fetch the media list and download every file (cached across visits). */
export async function preloadMedia(onProgress: (done: number, total: number, label: string) => void) {
  const { data: rows } = await supabase.from("media_assets").select("id,kind,ghost,media_type,nama,path").order("created_at");
  const list = (rows ?? []) as Omit<MediaItem, "src">[];
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE).catch(() => null) : null;
  // drop files the admin deleted
  if (cache) { const keep = new Set(list.map((r) => `/hm-media/${r.path}`)); for (const req of await cache.keys()) if (!keep.has(new URL(req.url).pathname)) void cache.delete(req); }
  const missing = cache ? (await Promise.all(list.map(async (r) => ((await cache.match(`/hm-media/${r.path}`)) ? null : r.path)))).filter((p): p is string => !!p) : list.map((r) => r.path);
  const signed: Record<string, string> = {};
  if (missing.length) {
    const { data } = await supabase.storage.from("game-media").createSignedUrls(missing, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed[s.path] = s.signedUrl;
  }
  const out: MediaItem[] = [];
  let done = 0;
  onProgress(0, list.length, "Memeriksa pembaruan...");
  for (const r of list) {
    const key = `/hm-media/${r.path}`;
    try {
      let res = cache ? await cache.match(key) : undefined;
      if (!res && signed[r.path]) {
        onProgress(done, list.length, `Mengunduh ${r.nama || "aset"}...`);
        const net = await fetch(signed[r.path]!);
        if (net.ok) { if (cache) await cache.put(key, net.clone()); res = net; }
      }
      if (res) out.push({ ...r, src: URL.createObjectURL(await res.blob()) });
    } catch { /* skip broken file */ }
    done++; onProgress(done, list.length, "Menyiapkan lobi...");
  }
  for (const m of items) URL.revokeObjectURL(m.src);
  items = out; loaded = true;
  subs.forEach((f) => f());
}

// ---- music / sfx playback from uploaded files ----
let track: HTMLAudioElement | null = null;
let trackKind: MediaKind | null = null;
export function playTrack(kind: "music_lobby" | "music_game", volume: number, muted: boolean): boolean {
  const m = findMedia(kind);
  if (!m) { stopTrack(); return false; }
  if (trackKind !== kind || !track) {
    stopTrack();
    track = new Audio(m.src); track.loop = true; trackKind = kind;
  }
  track.volume = Math.max(0, Math.min(1, volume)); track.muted = muted;
  void track.play().catch(() => undefined);
  return true;
}
export function stopTrack() { if (track) { track.pause(); track.src = ""; } track = null; trackKind = null; }
export function setTrackMuted(m: boolean) { if (track) track.muted = m; }
export function playSfx(ghost: string, volume: number, muted: boolean): boolean {
  const m = findMedia("sfx_ghost", ghost);
  if (!m) return false;
  if (!muted) { const a = new Audio(m.src); a.volume = Math.max(0, Math.min(1, volume)); void a.play().catch(() => undefined); }
  return true;
}
