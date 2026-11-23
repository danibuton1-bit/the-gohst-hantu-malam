import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/components/AppState";
import { DroneView } from "@/components/DroneView";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/drone/$code")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Drone ${params.code} - Hantu Malam` },
      { name: "description", content: "Kamera drone sinematik admin untuk menonton pertandingan Hantu Malam." },
      { property: "og:title", content: `Drone ${params.code} - Hantu Malam` },
      { property: "og:description", content: "Tonton pertandingan dari drone sinematik." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DronePage,
});

function DronePage() {
  const { code } = Route.useParams();
  const { account } = useApp();
  const admin = useIsAdmin(account);
  const nav = useNavigate();
  if (admin === null) return <main className="p-6 text-muted-foreground">Memeriksa akses...</main>;
  if (!admin) return <main className="space-y-3 p-6"><p>Drone khusus admin.</p><Button asChild><Link to="/home">Kembali</Link></Button></main>;
  return <DroneView code={code} onExit={() => void nav({ to: "/admin" })} />;
}
