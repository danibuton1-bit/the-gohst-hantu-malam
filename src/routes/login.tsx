import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { useApp } from "@/components/AppState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginIdCard, parseQr } from "@/lib/account";
import { decodeQrFromFile } from "@/lib/idcard";
import { PasswordInput } from "@/components/PasswordInput";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login Pakai ID Card - Hantu Malam" },
      { name: "description", content: "Masuk ke Hantu Malam dengan upload foto ID Card atau ketik Kode ID dan nama." },
      { property: "og:title", content: "Login Pakai ID Card - Hantu Malam" },
      { property: "og:description", content: "Upload ID Card atau ketik Kode ID untuk masuk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const { setAccount } = useApp();
  const nav = useNavigate();
  const [kode, setKode] = useState("HM-");
  const [nama, setNama] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [needPass, setNeedPass] = useState(false);

  async function enter(k: string, n: string) {
    setBusy(true); setErr("");
    try {
      const r = await loginIdCard(k, n, pass);
      if (r.status === "notfound") { setErr("ID Card tidak ditemukan. Cek lagi Kode ID dan nama."); return; }
      if (r.status === "need_password") { setKode(k); setNama(n); setNeedPass(true); setErr("Akun ini dikunci. Masukkan password akun."); return; }
      if (r.status === "wrong") { setErr("Password salah."); return; }
      if (r.status !== "ok") return; setAccount(r.profile); void nav({ to: "/home" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal login"); }
    finally { setBusy(false); }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    const txt = await decodeQrFromFile(f).catch(() => null);
    const q = txt ? parseQr(txt) : null;
    setBusy(false);
    if (!q) { setErr("QR Code di foto tidak terbaca. Coba foto yang lebih jelas atau ketik Kode ID."); return; }
    await enter(q.kode, q.username);
  }

  return (
    <main className="relative flex h-full justify-center overflow-hidden px-5 pb-3 pt-9 flex-row items-center gap-6">
      <Link to="/" className="absolute left-3 top-2 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Kembali</Link>
      <div className="flex flex-col gap-2 w-[40%]">
        <h1 className="font-horror text-drip text-3xl leading-none text-primary">LOGIN ID CARD</h1>
        <label className="flex h-[clamp(4rem,18cqh,8rem)] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-accent bg-card text-center text-sm">
          <Upload className="size-6 text-primary" />
          <span>Upload foto ID Card</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      </div>
      <form className="flex flex-col gap-2 w-[45%] max-w-sm" onSubmit={(e) => { e.preventDefault(); void enter(kode, nama); }}>
        <div className="text-xs text-muted-foreground">atau ketik manual</div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="kode" className="text-xs">Kode ID</Label><Input id="kode" value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="HM-1234" className="h-10 tracking-widest" /></div>
          <div><Label htmlFor="nm" className="text-xs">Nama</Label><Input id="nm" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama di ID Card" className="h-10" /></div>
        </div>
        {needPass && <div><Label htmlFor="pw" className="text-xs">Password Akun</Label><PasswordInput id="pw" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" className="h-10" autoFocus /></div>}
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="h-12 w-full glow-blood" disabled={busy || !/^HM-\d{4}$/.test(kode) || !nama.trim() || (needPass && !pass)}>{busy ? "Mengecek..." : "MASUK"}</Button>
      </form>
    </main>
  );
}
