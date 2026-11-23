import { useEffect, useState } from "react";
import { Film, Music, Trash2, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminAddMedia, adminDeleteMedia, adminUploadSlot, type MediaKind } from "@/lib/media.functions";
import { Button } from "./ui/button";
import type { Profile } from "@/lib/account";

type Row = { id: string; kind: MediaKind; ghost: string | null; media_type: string; nama: string; path: string; url?: string };

const SLOTS: { kind: MediaKind; label: string; accept: string; many?: boolean; ghost?: string }[] = [
  { kind: "lobby_bg", label: "Latar belakang lobby (video / gambar)", accept: "video/*,image/*", many: true },
  { kind: "music_lobby", label: "Musik lobby", accept: "audio/*" },
  { kind: "music_game", label: "Musik permainan", accept: "audio/*" },
  { kind: "sfx_ghost", label: "Suara hantu Kuyang", accept: "audio/*", ghost: "kuyang" },
];

/** Admin: upload/delete lobby backgrounds, music and ghost sound effects. Players download them on the loading screen. */
export function MediaManager({ account }: { account: Profile }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const slot = useServerFn(adminUploadSlot), add = useServerFn(adminAddMedia), del = useServerFn(adminDeleteMedia);
  const cred = { id: account.id, kode: account.kode_id };

  async function load() {
    const { data } = await supabase.from("media_assets").select("id,kind,ghost,media_type,nama,path").order("created_at");
    const list = (data ?? []) as Row[];
    if (list.length) {
      const { data: s } = await supabase.storage.from("game-media").createSignedUrls(list.map((r) => r.path), 3600);
      const map = Object.fromEntries((s ?? []).map((x) => [x.path, x.signedUrl]));
      list.forEach((r) => { r.url = map[r.path] ?? undefined; });
    }
    setRows(list);
  }
  useEffect(() => { void load(); }, []);

  async function upload(kind: MediaKind, ghost: string | undefined, files: FileList | null) {
    if (!files?.length) return;
    setBusy(kind); setMsg("");
    try {
      for (const f of Array.from(files)) {
        const ext = f.name.split(".").pop() ?? "bin";
        const { path, token } = await slot({ data: { ...cred, kind, ext } });
        const { error } = await supabase.storage.from("game-media").uploadToSignedUrl(path, token, f, { contentType: f.type });
        if (error) throw new Error(error.message);
        await add({ data: { ...cred, kind, path, mediaType: f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "image", nama: f.name, ghost: ghost ?? null } });
      }
      setMsg("Berhasil diunggah. Pemain mendapatkannya saat membuka game berikutnya.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gagal mengunggah"); }
    setBusy(null); void load();
  }
  async function remove(id: string) { setBusy(id); try { await del({ data: { ...cred, mediaId: id } }); } catch { setMsg("Gagal menghapus"); } setBusy(null); void load(); }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-primary"><Film className="size-4" /> MEDIA GAME</h2>
      {SLOTS.map((s) => {
        const mine = rows.filter((r) => r.kind === s.kind && (!s.ghost || r.ghost === s.ghost));
        return (
          <div key={s.kind} className="space-y-2 rounded-lg border border-border bg-card/80 p-3">
            <div className="flex items-center gap-2 text-sm">
              {s.kind === "lobby_bg" ? <Film className="size-4 text-gold" /> : <Music className="size-4 text-gold" />}
              <span className="flex-1">{s.label}</span>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                <Upload className="size-3" /> {busy === s.kind ? "Mengunggah..." : s.many ? "Tambah" : mine.length ? "Ganti" : "Unggah"}
                <input type="file" className="hidden" accept={s.accept} multiple={!!s.many} disabled={!!busy} onChange={(e) => { void upload(s.kind, s.ghost, e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            {mine.length === 0 && <p className="text-xs text-muted-foreground">Belum ada. {s.kind === "lobby_bg" ? "Lobby memakai latar bawaan." : "Game memakai suara bawaan."}</p>}
            <div className={s.kind === "lobby_bg" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-1"}>
              {mine.map((r) => (
                <div key={r.id} className="relative overflow-hidden rounded border border-border bg-background/50">
                  {r.url && (r.media_type === "video" ? <video src={r.url} muted loop playsInline className="aspect-video w-full object-cover" onMouseEnter={(e) => void e.currentTarget.play()} />
                    : r.media_type === "image" ? <img src={r.url} alt={r.nama} className="aspect-video w-full object-cover" />
                    : <audio src={r.url} controls className="h-8 w-full" />)}
                  <div className="flex items-center gap-1 p-1 text-[10px]"><span className="flex-1 truncate">{r.nama}</span>
                    <Button size="icon" variant="ghost" className="size-6" disabled={busy === r.id} onClick={() => void remove(r.id)} aria-label="Hapus"><Trash2 className="size-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {msg && <p className="text-xs text-gold">{msg}</p>}
    </section>
  );
}
