import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Plane, RefreshCw } from "lucide-react";
import { useApp } from "@/components/AppState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { SoundManager } from "@/components/SoundManager";
import { MediaManager } from "@/components/MediaManager";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin - Hantu Malam" },
      { name: "description", content: "Dashboard admin Hantu Malam: pantau pertandingan yang berlangsung dan terbangkan drone sinematik." },
      { property: "og:title", content: "Dashboard Admin - Hantu Malam" },
      { property: "og:description", content: "Pantau pertandingan langsung lewat drone sinematik." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type Match = { code: string; status: string; created_at: string; players: string[] };

function AdminPage() {
  const { ready, account } = useApp();
  const admin = useIsAdmin(account);
  const nav = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);
  async function load() {
    const { data: rooms } = await supabase.from("rooms").select("code,status,created_at").in("status", ["playing", "lobby"]).order("created_at", { ascending: false }).limit(30);
    const codes = (rooms ?? []).map((r) => r.code);
    const { data: ps } = codes.length ? await supabase.from("players").select("room_code,nama").in("room_code", codes) : { data: [] };
    setMatches((rooms ?? []).map((r) => ({ ...r, players: (ps ?? []).filter((p) => p.room_code === r.code).map((p) => p.nama) })).filter((m) => m.players.length > 0));
  }
  useEffect(() => { if (admin) { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); } return undefined; }, [admin]);

  if (admin === null) return <main className="p-6 text-muted-foreground">Memeriksa akses...</main>;
  if (!admin) return <main className="space-y-3 p-6"><p>Halaman ini khusus admin.</p><Button asChild><Link to="/home">Kembali</Link></Button></main>;
  return (
    <main className="mx-auto h-full max-w-2xl space-y-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link to="/home"><ArrowLeft /></Link></Button>
        <h1 className="flex items-center gap-2 font-horror text-3xl text-gold"><Crown /> DASHBOARD ADMIN</h1>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void load()}><RefreshCw /></Button>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-primary">PERTANDINGAN</h2>
        {matches.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pertandingan berlangsung.</p>}
        {matches.map((m) => (
          <div key={m.code} className="flex items-center gap-3 rounded-lg border border-border bg-card/80 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{m.code} <span className={`ml-1 rounded px-1.5 text-[10px] ${m.status === "playing" ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>{m.status === "playing" ? "LIVE" : "LOBBY"}</span></div>
              <div className="truncate text-xs text-muted-foreground">{m.players.join(", ")}</div>
            </div>
            <Button size="sm" disabled={m.status !== "playing"} onClick={() => void nav({ to: "/drone/$code", params: { code: m.code } })}><Plane /> Drone</Button>
          </div>
        ))}
      </section>
      {account && <MediaManager account={account} />}
      <SoundManager />
    </main>
  );
}
