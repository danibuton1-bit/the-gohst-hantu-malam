import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useApp } from "./AppState";
import { IdCardView } from "./IdCardView";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ProfileCorner() {
  const { account, logout } = useApp();
  const nav = useNavigate();
  if (!account) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 p-1.5">
      <div className="w-20 shrink-0"><IdCardView profile={account} compact /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{account.nama}</div>
        <div className="truncate text-xs text-muted-foreground">{account.username}</div>
        <Dialog>
          <DialogTrigger asChild><button className="text-xs text-primary underline">Lihat ID Card Saya</button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-horror text-2xl">ID CARD SAYA</DialogTitle></DialogHeader>
            <IdCardView profile={account} />
            <Button variant="ghost" onClick={() => { logout(); void nav({ to: "/" }); }}><LogOut /> Logout</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
