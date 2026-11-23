import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Art";
import { useApp } from "@/components/AppState";
import { Button } from "@/components/ui/button";
import { FullscreenButton } from "@/components/FullscreenButton";
import { Stage3D } from "@/components/Stage3D";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hantu Malam: Mabar Horor - Masuk" },
      { name: "description", content: "Daftar akun ID Card atau login pakai ID Card untuk main Hantu Malam bareng teman." },
      { property: "og:title", content: "Hantu Malam: Mabar Horor" },
      { property: "og:description", content: "Game horor multiplayer: cari 5 kunci dan kabur dari rumah tua sebelum hantu menangkapmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { ready, account } = useApp();
  const nav = useNavigate();
  const splash = false;
  useEffect(() => { if (!splash && ready && account) void nav({ to: "/home" }); }, [splash, ready, account, nav]);

  if (splash || !ready || account) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-6">
        <Logo className="max-h-[45cqh] w-auto max-w-md animate-flicker rounded-xl" />
        <div className="h-1.5 w-48 overflow-hidden rounded bg-muted"><div className="h-full w-1/2 animate-pulse bg-blood" /></div>
        <p className="text-sm text-muted-foreground">Memanggil arwah...</p>
      </main>
    );
  }
  return (
    <main className="relative flex h-full items-center justify-center overflow-hidden">
      <Stage3D kuyangOnly className="absolute inset-0 opacity-70" actors={[]} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <FullscreenButton className="absolute right-3 top-3 z-10" />
      <div className="relative z-10 flex h-full w-full max-w-4xl items-center justify-center px-5 py-4 flex-row gap-8">
        <Logo className="w-auto rounded-xl glow-blood max-h-[70cqh] max-w-[45vw]" />
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <h1 className="font-horror text-drip text-center text-[clamp(1.8rem,7cqh,3rem)] leading-none text-primary">HANTU MALAM</h1>
          <p className="text-center text-xs text-muted-foreground">Tanpa email. Cukup ID Card.</p>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button asChild size="lg" className="h-[clamp(2.75rem,10cqh,3.75rem)] text-sm glow-blood"><Link to="/daftar">DAFTAR</Link></Button>
            <Button asChild size="lg" variant="secondary" className="h-[clamp(2.75rem,10cqh,3.75rem)] text-sm"><Link to="/login">LOGIN ID CARD</Link></Button>
          </div>
        </div>
      </div>
    </main>
  );
}
