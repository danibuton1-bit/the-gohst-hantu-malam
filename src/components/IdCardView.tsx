import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { renderIdCard } from "@/lib/idcard";
import type { Profile } from "@/lib/account";
import { Button } from "./ui/button";
import { useIsAdmin } from "@/lib/admin";

export function IdCardView({ profile, compact }: { profile: Profile; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const admin = useIsAdmin(profile);
  useEffect(() => {
    let live = true;
    void renderIdCard(profile, admin === true).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [profile, admin]);
  if (!url) return <div className="aspect-[1000/620] w-full animate-pulse rounded-xl bg-muted" />;
  if (compact) return <img src={url} alt="ID Card" className="w-full rounded" />;
  return (
    <div className="space-y-3">
      <img src={url} alt={`ID Card ${profile.username}`} className="w-full rounded-xl glow-blood" />
      <Button asChild variant="secondary" className="w-full">
        <a href={url} download={`ID-CARD-${profile.kode_id}.png`}><Download /> Download ID Card (PNG)</a>
      </Button>
    </div>
  );
}
