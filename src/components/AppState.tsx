import { createContext, type Context, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { loadAccount, logout as clearAccount, saveAccount, type Profile } from "@/lib/account";
import type { CharId } from "@/lib/art";

export type OnlineUser = { id: string; nama: string; username: string; karakter: CharId; room: string | null };
export type Invite = { from: OnlineUser; code: string };

type Ctx = {
  ready: boolean;
  account: Profile | null;
  setAccount: (p: Profile) => void;
  logout: () => void;
  online: OnlineUser[];
  invite: Invite | null;
  clearInvite: () => void;
  sendInvite: (toId: string, code: string) => void;
  setRoom: (code: string | null) => void;
  /** Ping another player (new DM / friend request) so their panel refreshes. */
  signal: (toId: string, kind: "dm" | "friend") => void;
  signals: { dm: number; friend: number; dmFrom: string | null };
};
// Keep one context object across hot reloads; a re-created context makes useApp miss the mounted provider.
const g = globalThis as unknown as { __hmAppCtx?: Context<Ctx | null> };
const AppCtx = (g.__hmAppCtx ??= createContext<Ctx | null>(null));

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAcc] = useState<Profile | null>(null);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [room, setRoomState] = useState<string | null>(null);
  const [signals, setSignals] = useState({ dm: 0, friend: 0, dmFrom: null as string | null });
  const chan = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setAcc(loadAccount());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!account) return;
    const me = account;
    const ch = supabase.channel("hm-online", { config: { presence: { key: me.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<OnlineUser>();
      const list = Object.values(st).map((arr) => arr[0]!).filter((u) => u && u.id !== me.id);
      setOnline(list);
    });
    ch.on("broadcast", { event: "invite" }, ({ payload }) => {
      const p = payload as { to: string; from: OnlineUser; code: string };
      if (p.to === me.id) setInvite({ from: p.from, code: p.code });
    });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => {
      const p = payload as { to: string; from: string; kind: "dm" | "friend" };
      if (p.to !== me.id) return;
      setSignals((v) => (p.kind === "dm" ? { ...v, dm: v.dm + 1, dmFrom: p.from } : { ...v, friend: v.friend + 1 }));
    });
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") void ch.track(meUser(me, null));
    });
    chan.current = ch;
    return () => {
      chan.current = null;
      void supabase.removeChannel(ch);
    };
  }, [account]);

  useEffect(() => {
    if (account && chan.current) void chan.current.track(meUser(account, room));
  }, [room, account]);

  const setAccount = useCallback((p: Profile) => { saveAccount(p); setAcc(p); }, []);
  const logout = useCallback(() => { clearAccount(); setAcc(null); }, []);
  const sendInvite = useCallback((to: string, code: string) => {
    if (!account) return;
    void chan.current?.send({ type: "broadcast", event: "invite", payload: { to, code, from: meUser(account, code) } });
  }, [account]);

  const signal = useCallback((to: string, kind: "dm" | "friend") => {
    if (!account) return;
    void chan.current?.send({ type: "broadcast", event: "signal", payload: { to, kind, from: account.id } });
  }, [account]);

  return (
    <AppCtx.Provider value={{ ready, account, setAccount, logout, online, invite, clearInvite: () => setInvite(null), sendInvite, setRoom: setRoomState, signal, signals }}>
      {children}
    </AppCtx.Provider>
  );
}

const meUser = (p: Profile, room: string | null): OnlineUser => ({ id: p.id, nama: p.nama, username: p.username, karakter: p.karakter_pilihan, room });

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}
