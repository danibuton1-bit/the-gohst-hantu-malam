/** A player not seen on the room's live channel for this long is removed. */
export const OFFLINE_MS = 10_000;
export const isOffline = (lastSeen: number, now: number) => now - lastSeen >= OFFLINE_MS;
