import { useEffect, useState } from "react";
import { Lock, LockOpen, Settings } from "lucide-react";
import { useApp } from "./AppState";
import { PasswordInput } from "./PasswordInput";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { hasPassword, setPassword } from "@/lib/account";
import { getGfx, setGfx, type Gfx } from "@/lib/graphics";
import { FullscreenButton } from "./FullscreenButton";

/** Pengaturan pemain: kunci akun dengan password supaya ID Card saja tidak cukup untuk login. */
export function SettingsDialog() {
  const { account } = useApp();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [oldP, setOldP] = useState(""); const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [gfx, setGfxS] = useState<Gfx>("standar");
  useEffect(() => { setGfxS(getGfx()); }, [open]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  useEffect(() => {
    if (!open || !account) return;
    setOldP(""); setP1(""); setP2(""); setErr("");
    void hasPassword(account).then(setLocked).catch(() => setLocked(false));
  }, [open, account]);
  if (!account) return null;

  async function save(remove: boolean) {
    if (!account) return;
    setErr(""); setOk("");
    if (!remove) {
      if (p1.length < 4) { setErr("Password minimal 4 karakter."); return; }
      if (p1 !== p2) { setErr("Konfirmasi password tidak sama."); return; }
    }
    setBusy(true);
    try {
      await setPassword(account, oldP, remove ? "" : p1);
      setOk(remove ? "Kunci akun dimatikan." : "Akun sudah terkunci dengan password.");
      setLocked(!remove); setOldP(""); setP1(""); setP2("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menyimpan"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button aria-label="Pengaturan" className="flex size-9 items-center justify-center rounded-lg border border-border bg-card/80"><Settings className="size-4" /></button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-horror text-2xl">PENGATURAN</DialogTitle></DialogHeader>
        <section className="space-y-2">
          <div className="font-bold">Grafis</div>
          <div className="grid grid-cols-3 gap-1">
            {([["hemat", "Hemat"], ["standar", "Standar"], ["ultra", "Ultra FHD"]] as const).map(([id, l]) => (
              <Button key={id} size="sm" variant={gfx === id ? "default" : "secondary"} onClick={() => { setGfx(id); setGfxS(id); }}>{l}</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Ultra FHD = resolusi penuh layar HP, paling tajam tapi lebih berat. Berlaku di pertandingan berikutnya.</p>
          <FullscreenButton label className="w-full" />
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2 font-bold">
            {locked ? <Lock className="size-4 text-primary" /> : <LockOpen className="size-4 text-muted-foreground" />} Kunci Akun
            <span className={`ml-auto rounded px-2 text-xs ${locked ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{locked === null ? "..." : locked ? "AKTIF" : "MATI"}</span>
          </div>
          <p className="text-xs text-muted-foreground">Kalau aktif, orang lain yang punya ID Card-mu tetap tidak bisa masuk tanpa password ini.</p>
          {locked && <div className="space-y-1"><Label htmlFor="op">Password lama</Label><PasswordInput id="op" value={oldP} onChange={(e) => setOldP(e.target.value)} /></div>}
          <div className="space-y-1"><Label htmlFor="np">{locked ? "Password baru" : "Password"}</Label><PasswordInput id="np" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="cp">Ulangi password</Label><PasswordInput id="cp" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          {ok && <p className="text-sm text-primary">{ok}</p>}
          <Button className="w-full" disabled={busy || locked === null || (locked && !oldP)} onClick={() => void save(false)}>{locked ? "GANTI PASSWORD" : "KUNCI AKUN"}</Button>
          {locked && <Button variant="ghost" className="w-full" disabled={busy || !oldP} onClick={() => void save(true)}>Matikan kunci akun</Button>}
        </section>
      </DialogContent>
    </Dialog>
  );
}
