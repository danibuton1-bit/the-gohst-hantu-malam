import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";
export const Route = createFileRoute("/fpstest")({ ssr: false, component: () => (
  <Game code="TEST" me="a" isHost startedAt={Date.now() - 4000} onBackToLobby={() => {}} onLeave={() => {}}
    players={[{ id: "a", nama: "Raka", username: "r", karakter: "raka", role: "hunter", status: "alive" }, { id: "b", nama: "Aisyah", username: "x", karakter: "aisyah", role: "ghost", status: "alive" }]} />) });
