import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { FullscreenButton } from "@/components/FullscreenButton";
import { CharImg } from "@/components/Art";
import { useApp } from "@/components/AppState";
import { IdCardView } from "@/components/IdCardView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProfile, type Profile } from "@/lib/account";
import { CHAR_IDS, CHARACTERS, type CharId } from "@/lib/art";

export const Route = createFileRoute("/daftar")({
  head: () => ({
    meta: [
      { title: "Daftar Akun ID Card - Hantu Malam" },
      { name: "description", content: "Buat akun Hantu Malam cukup dengan nama dan tanggal lahir, dapatkan ID Card resmi." },
      { property: "og:title", content: "Daftar Akun ID Card - Hantu Malam" },
      { property: "og:description", content: "Buat akun dan dapatkan ID Card resmi Hantu Malam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Daftar,
});

function Daftar() {
  const { setAccount } = useApp();
  const nav = useNavigate();
  const [nama, setNama] = useState("");
  const [tgl, setTgl] = useState("");
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const char: CharId = CHAR_IDS[idx]!;
  const step = (d: number) => setIdx((i) => (i + d + CHAR_IDS.length) % CHAR_IDS.length);
  const valid = nama.trim().length >= 2 && !!tgl;

  async function generate() {
    if (!valid) { setErr("Isi nama (min 2 huruf) dan tanggal lahir."); return; }
    setBusy(true); setErr("");
    try {
      const p = await createProfile(nama.trim(), tgl, char);
      setProfile(p); setAccount(p);
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal membuat akun"); }
    finally { setBusy(false); }
  }

  if (profile) {
    return (
      <main className="flex h-full items-center justify-center overflow-hidden px-4 py-3 flex-row gap-6">
        <div className="h-auto max-w-md max-h-[85cqh] w-[55vw]"><IdCardView profile={profile} compact /></div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <h1 className="font-horror text-drip text-center text-2xl text-primary">ID CARD SIAP</h1>
          <p className="text-center text-sm">Kode ID: <b className="text-primary">{profile.kode_id}</b> · {profile.username}</p>
          <p className="text-center text-[11px] text-muted-foreground">Screenshot ID Card ini untuk login di HP lain.</p>
          <Button size="lg" className="h-12 w-full glow-blood" onClick={() => void nav({ to: "/home" })}>MASUK KE GAME</Button>
        </div>
      </main>
    );
  }

  const c = CHARACTERS[char];
  return (
    <main className="relative flex h-full overflow-hidden flex-row">
      <div className="absolute left-3 right-3 top-2 z-10 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Kembali</Link>
        <FullscreenButton />
      </div>
      {/* stage */}
      <section className="relative flex min-h-0 flex-1 items-center justify-center pt-8">
        <div className="absolute bottom-[8%] left-1/2 h-[10%] w-[60%] max-w-xs -translate-x-1/2 rounded-[50%] bg-primary/30 blur-md" />
        <button aria-label="Karakter sebelumnya" onClick={() => step(-1)} className="absolute left-2 z-10 flex size-12 items-center justify-center rounded-full border-2 border-gold/70 bg-card/80 text-gold active:scale-90"><ChevronLeft className="size-7" /></button>
        <div className="flex h-full flex-col items-center justify-center">
          <CharImg key={char} id={char} className="animate-in fade-in zoom-in-90 duration-300 h-[62cqh]" />
          <div className="font-horror text-2xl leading-none text-gold">{c.nama}</div>
          <div className="text-center text-[11px] text-muted-foreground">{c.desc}</div>
        </div>
        <button aria-label="Karakter berikutnya" onClick={() => step(1)} className="absolute right-2 z-10 flex size-12 items-center justify-center rounded-full border-2 border-gold/70 bg-card/80 text-gold active:scale-90"><ChevronRight className="size-7" /></button>
      </section>
      {/* form */}
      <form className="flex shrink-0 flex-col gap-2 border-border bg-card/80 px-4 py-3 w-[42%] justify-center border-l border-t-0"
        onSubmit={(e) => { e.preventDefault(); void generate(); }}>
        <h1 className="font-horror text-drip text-2xl leading-none text-primary">DAFTAR AKUN</h1>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="nama" className="text-xs">Nama panggilan</Label><Input id="nama" value={nama} maxLength={30} onChange={(e) => setNama(e.target.value)} placeholder="Nama kamu" className="h-10" /></div>
          <div><Label htmlFor="tgl" className="text-xs">Tanggal lahir</Label><Input id="tgl" type="date" value={tgl} max="2024-12-31" onChange={(e) => setTgl(e.target.value)} className="h-10" /></div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button type="submit" size="lg" disabled={busy} className="h-12 w-full bg-gradient-to-b from-gold to-gold/70 text-base font-black tracking-wider text-void shadow-[0_0_20px_hsl(45_90%_50%/0.5)] hover:from-gold hover:to-gold">
          {busy ? "MEMBUAT..." : "BUAT ID CARD"}
        </Button>
      </form>
    </main>
  );
}
