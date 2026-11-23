import { createServerFn } from "@tanstack/react-start";

export type MediaKind = "lobby_bg" | "music_lobby" | "music_game" | "sfx_ghost";
type Cred = { id: string; kode: string };

async function requireAdmin(c: Cred) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("is_admin", { p_id: c.id, p_kode: c.kode });
  if (data !== true) throw new Error("Khusus admin");
  return supabaseAdmin;
}

const KINDS: MediaKind[] = ["lobby_bg", "music_lobby", "music_game", "sfx_ghost"];

/** Admin asks for a one-time upload slot in the private game-media bucket. */
export const adminUploadSlot = createServerFn({ method: "POST" })
  .inputValidator((d: Cred & { kind: MediaKind; ext: string }) => {
    if (!KINDS.includes(d.kind)) throw new Error("Jenis salah");
    return { ...d, ext: d.ext.replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase() || "bin" };
  })
  .handler(async ({ data }) => {
    const sb = await requireAdmin(data);
    const path = `${data.kind}/${crypto.randomUUID()}.${data.ext}`;
    const { data: slot, error } = await sb.storage.from("game-media").createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Gagal menyiapkan upload");
    return { path, token: slot.token };
  });

export const adminAddMedia = createServerFn({ method: "POST" })
  .inputValidator((d: Cred & { kind: MediaKind; path: string; mediaType: string; nama: string; ghost: string | null }) => {
    if (!KINDS.includes(d.kind) || !d.path.startsWith(`${d.kind}/`)) throw new Error("Data salah");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = await requireAdmin(data);
    if (data.kind !== "lobby_bg") {
      // one active track per slot: replace the old one
      let q = sb.from("media_assets").select("id,path").eq("kind", data.kind);
      if (data.kind === "sfx_ghost") q = q.eq("ghost", data.ghost ?? "kuyang");
      const { data: old } = await q;
      if (old?.length) { await sb.storage.from("game-media").remove(old.map((o) => o.path)); await sb.from("media_assets").delete().in("id", old.map((o) => o.id)); }
    }
    const { error } = await sb.from("media_assets").insert({ kind: data.kind, path: data.path, url: "", media_type: data.mediaType.slice(0, 10), nama: data.nama.slice(0, 80), ghost: data.kind === "sfx_ghost" ? (data.ghost ?? "kuyang") : null });
    if (error) throw new Error("Gagal menyimpan");
    return { ok: true };
  });

export const adminDeleteMedia = createServerFn({ method: "POST" })
  .inputValidator((d: Cred & { mediaId: string }) => d)
  .handler(async ({ data }) => {
    const sb = await requireAdmin(data);
    const { data: row } = await sb.from("media_assets").select("path").eq("id", data.mediaId).maybeSingle();
    if (row) { await sb.storage.from("game-media").remove([row.path]); await sb.from("media_assets").delete().eq("id", data.mediaId); }
    return { ok: true };
  });
