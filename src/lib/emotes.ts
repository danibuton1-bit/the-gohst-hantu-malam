// Emotes are full-body character animations (CSS classes on the character), not emoji.
export const EMOTES = [
  { id: "wave", label: "Halo" },
  { id: "dance", label: "Joget" },
  { id: "laugh", label: "Ngakak" },
  { id: "salute", label: "Hormat" },
  { id: "victory", label: "Menang" },
  { id: "scared", label: "Takut" },
  { id: "shy", label: "Salting" },
  { id: "hug", label: "Peluk" },
  { id: "kiss", label: "Cium" },
] as const;
export type EmoteId = (typeof EMOTES)[number]["id"];
/** Emotes that walk to the nearest player and play with them. */
export const PAIR_EMOTES: readonly string[] = ["hug", "kiss"];
export const EMOTE_MS = 2400;
export const emoteLabel = (id: string) => EMOTES.find((e) => e.id === id)?.label ?? id;
