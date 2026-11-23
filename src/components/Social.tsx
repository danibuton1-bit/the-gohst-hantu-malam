import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Globe, Lock, MessageCircle, Send, UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChar } from "@/lib/art";
import { roomCode } from "@/lib/game";
import { audio } from "@/lib/audio";
import { useApp } from "./AppState";
import { CharImg } from "./Art";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Msg = { id: string; sender_id: string; sender_nama: string; sender_karakter: string; body: string; created_at: string };
type Friend = { friend_id: string; nama: string; username: string; kode_id: string; karakter: string; status: string; incoming: boolean };
const DAY = 24 * 3600 * 1000;

async function createRoomFor(hostId: string) {
  for (let i = 0; i < 5; i++) {
    const c = roomCode();
    const { error } = await supabase.from("rooms").insert({ code: c, host_id: hostId });
    if (!error) return c;
  }
  return null;
}

/** Floating chat + friends panel. `room` = current lobby code so friends can be invited into it. */
export function SocialPanel({ room, className }: { room?: string; className?: string }) {
  const { account, online, sendInvite, signal, signals } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"dunia" | "pribadi" | "teman">("dunia");
  const [world, setWorld] = useState<Msg[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [dmWith, setDmWith] = useState<Friend | null>(null);
  const [dm, setDm] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [kode, setKode] = useState("");
  const [info, setInfo] = useState("");
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [notif, setNotif] = useState<{ k: number; who: string; kar: string | null; body: string; kind: "dunia" | "pribadi" } | null>(null);
  const lastWorld = useRef<string | null>(null);
  const showNotif = useCallback((n: Omit<NonNullable<typeof notif>, "k">) => {
    const k = Date.now(); setNotif({ ...n, k }); audio.pickup();
    window.setTimeout(() => setNotif((c) => (c?.k === k ? null : c)), 4000);
  }, []);
  const onlineIds = new Set(online.map((o) => o.id));

  const loadWorld = useCallback(async () => {
    const { data } = await supabase.from("chat_messages").select("id,sender_id,sender_nama,sender_karakter,body,created_at")
      .is("recipient_id", null).gt("created_at", new Date(Date.now() - DAY).toISOString()).order("created_at", { ascending: false }).limit(60);
    setWorld((data ?? []).reverse());
  }, []);
  const loadFriends = useCallback(async () => {
    if (!account) return;
    const { data } = await supabase.rpc("list_friends", { p_id: account.id, p_kode: account.kode_id });
    setFriends((data ?? []) as Friend[]);
  }, [account]);
  const loadDm = useCallback(async (f: Friend | null) => {
    if (!account || !f) return;
    const { data } = await supabase.rpc("list_dm", { p_id: account.id, p_kode: account.kode_id, p_other: f.friend_id });
    setDm(((data ?? []) as Msg[]).reverse());
  }, [account]);

  useEffect(() => {
    void loadWorld();
    const ch = supabase.channel(`world-chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void loadWorld())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [loadWorld]);
  useEffect(() => {
    const last = world[world.length - 1]; if (!last) return;
    const prev = lastWorld.current; lastWorld.current = last.id;
    if (prev && prev !== last.id && last.sender_id !== account?.id && !(open && tab === "dunia")) showNotif({ who: last.sender_nama, kar: last.sender_karakter ?? null, body: last.body, kind: "dunia" });
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (signals.dm && !(open && tab === "pribadi")) showNotif({ who: "Pesan pribadi", kar: null, body: "Temanmu mengirim pesan baru", kind: "pribadi" }); }, [signals.dm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadFriends(); }, [loadFriends, signals.friend]);
  useEffect(() => { void loadDm(dmWith); }, [loadDm, dmWith, signals.dm]);
  useEffect(() => { if (signals.dm && !(open && tab === "pribadi")) setUnread((u) => u + 1); }, [signals.dm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo(0, 1e6); }, [world, dm, tab, open]);

  if (!account) return null;
  const me = account;
  const accepted = friends.filter((f) => f.status === "accepted");
  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friends.filter((f) => f.status === "pending" && !f.incoming);

  async function send() {
    const body = text.trim(); if (!body) return;
    const to = tab === "pribadi" ? dmWith?.friend_id ?? null : null;
    if (tab === "pribadi" && !to) return;
    setText("");
    const { error } = await supabase.rpc("send_chat", { p_id: me.id, p_kode: me.kode_id, p_to: to as string, p_body: body });
    if (error) { setInfo(error.message); return; }
    if (to) { signal(to, "dm"); void loadDm(dmWith); } else void loadWorld();
  }
  async function addFriend() {
    setInfo("");
    const { data, error } = await supabase.rpc("send_friend_request", { p_id: me.id, p_kode: me.kode_id, p_target_kode: kode });
    if (error) { setInfo(error.message); return; }
    setInfo(data === "accepted" ? "Kalian sekarang berteman!" : "Permintaan pertemanan terkirim.");
    setKode(""); void loadFriends();
    const f = await supabase.rpc("list_friends", { p_id: me.id, p_kode: me.kode_id });
    const t = ((f.data ?? []) as Friend[]).find((x) => x.kode_id === kode.trim().toUpperCase());
    if (t) signal(t.friend_id, "friend");
  }
  async function respond(f: Friend, ok: boolean) {
    await supabase.rpc("respond_friend", { p_id: me.id, p_kode: me.kode_id, p_other: f.friend_id, p_accept: ok });
    signal(f.friend_id, "friend"); void loadFriends();
  }
  async function invite(f: Friend) {
    let code = room ?? null;
    if (!code) { code = await createRoomFor(me.id); if (!code) { setInfo("Gagal membuat lobby."); return; } }
    sendInvite(f.friend_id, code);
    setInfo(`Undangan dikirim ke ${f.nama}.`);
    if (!room) void nav({ to: "/room/$code", params: { code } });
  }

  const msgs = tab === "dunia" ? world : dm;
  return (
    <>
      {notif && <button key={notif.k} onClick={() => { setOpen(true); setTab(notif.kind); setNotif(null); setUnread(0); }} className="fixed left-1/2 top-3 z-[60] flex w-[min(92vw,22rem)] -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-gold/70 bg-card/95 p-2 text-left shadow-lg animate-in slide-in-from-top-4 fade-in duration-300">
        {notif.kar ? <CharImg id={normalizeChar(notif.kar) ?? "raka"} className="h-10 w-8 shrink-0" /> : <MessageCircle className="size-8 shrink-0 text-primary" />}
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1 text-xs font-bold"><span className="truncate">{notif.who}</span><span className={`rounded px-1 text-[9px] ${notif.kind === "dunia" ? "bg-chart-4/30" : "bg-primary/30"}`}>{notif.kind === "dunia" ? "DUNIA" : "PRIBADI"}</span></div><div className="truncate text-xs text-muted-foreground">{notif.body}</div></div>
      </button>}
      <button onClick={() => { setOpen((o) => !o); setUnread(0); }} className={`relative flex size-12 items-center justify-center rounded-full border border-border bg-card/90 text-foreground ${className ?? ""}`} aria-label="Chat dan teman">
        <MessageCircle className="size-6" />
        {(unread > 0 || incoming.length > 0) && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread + incoming.length}</span>}
      </button>
      {open && (
        <div className="fixed bottom-2 left-2 top-2 z-50 flex w-[min(340px,calc(100vw-1rem))] flex-col rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1 border-b border-border p-1.5">
            {([["dunia", Globe, "Dunia"], ["pribadi", Lock, "Pribadi"], ["teman", Users, "Teman"]] as const).map(([id, I, l]) => (
              <button key={id} onClick={() => { setTab(id); if (id === "pribadi") setUnread(0); setInfo(""); }} className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-bold ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <I className="size-3.5" />{l}{id === "teman" && incoming.length > 0 && ` (${incoming.length})`}
              </button>
            ))}
            <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground" aria-label="Tutup"><X className="size-4" /></button>
          </div>

          {tab === "teman" ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-2 text-sm">
              <div className="text-xs text-muted-foreground">Kode ID kamu: <b className="text-gold">{me.kode_id}</b></div>
              <div className="flex gap-1">
                <Input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Kode ID teman, mis. HM-1234" className="h-9" />
                <Button size="sm" onClick={addFriend} disabled={!kode.trim()}><UserPlus /></Button>
              </div>
              {info && <p className="text-xs text-gold">{info}</p>}
              {incoming.length > 0 && <Section title="Permintaan masuk">{incoming.map((f) => (
                <Row key={f.friend_id} f={f} online={onlineIds.has(f.friend_id)}>
                  <Button size="sm" onClick={() => void respond(f, true)}><Check /></Button>
                  <Button size="sm" variant="ghost" onClick={() => void respond(f, false)}><X /></Button>
                </Row>))}</Section>}
              <Section title={`Teman (${accepted.length})`}>
                {accepted.length === 0 && <p className="text-xs text-muted-foreground">Belum ada teman. Tambahkan lewat kode ID.</p>}
                {accepted.map((f) => (
                  <Row key={f.friend_id} f={f} online={onlineIds.has(f.friend_id)}>
                    <Button size="sm" variant="ghost" onClick={() => { setDmWith(f); setTab("pribadi"); }}><MessageCircle /></Button>
                    <Button size="sm" disabled={!onlineIds.has(f.friend_id)} onClick={() => void invite(f)}>Invite</Button>
                  </Row>))}
              </Section>
              {outgoing.length > 0 && <Section title="Menunggu diterima">{outgoing.map((f) => <Row key={f.friend_id} f={f} online={onlineIds.has(f.friend_id)} />)}</Section>}
            </div>
          ) : (
            <>
              {tab === "pribadi" && (
                <div className="flex gap-1 overflow-x-auto border-b border-border p-1.5">
                  {accepted.length === 0 && <span className="text-xs text-muted-foreground">Tambah teman dulu di tab Teman.</span>}
                  {accepted.map((f) => (
                    <button key={f.friend_id} onClick={() => setDmWith(f)} className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${dmWith?.friend_id === f.friend_id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {onlineIds.has(f.friend_id) && <span className="mr-1 inline-block size-1.5 rounded-full bg-chart-4" />}{f.nama}
                    </button>))}
                </div>
              )}
              {tab === "dunia" && <div className="px-2 pt-1 text-[10px] text-muted-foreground">Chat dunia dibersihkan otomatis setiap 24 jam.</div>}
              <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto p-2">
                {msgs.length === 0 && <p className="pt-6 text-center text-xs text-muted-foreground">{tab === "pribadi" && !dmWith ? "Pilih teman untuk mulai chat." : "Belum ada pesan."}</p>}
                {msgs.map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === me.id} />)}
              </div>
              {info && <p className="px-2 text-xs text-destructive">{info}</p>}
              <form className="flex gap-1 border-t border-border p-1.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <Input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={tab === "dunia" ? "Kirim ke semua pemain..." : dmWith ? `Pesan ke ${dmWith.nama}...` : "Pilih teman"} className="h-9" disabled={tab === "pribadi" && !dmWith} />
                <Button size="sm" type="submit" aria-label="Kirim"><Send /></Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="text-[10px] font-bold uppercase text-muted-foreground">{title}</div>{children}</div>;
}
function Row({ f, online, children }: { f: Friend; online: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-1.5">
      <CharImg id={normalizeChar(f.karakter) ?? "raka"} className="h-9" />
      <div className="min-w-0 flex-1"><div className="truncate font-bold">{f.nama}</div><div className="text-[10px] text-muted-foreground">{online ? <span className="text-chart-4">● Online</span> : "Offline"} · {f.kode_id}</div></div>
      {children}
    </div>
  );
}
export function Bubble({ m, mine }: { m: { sender_nama: string; body: string; created_at?: string }; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-[10px] text-muted-foreground">{mine ? "Kamu" : m.sender_nama}{m.created_at && ` · ${new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}</span>
      <span className={`max-w-[85%] break-words rounded-lg px-2.5 py-1 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.body}</span>
    </div>
  );
}

export function InvitePopup() {
  const { invite, clearInvite } = useApp();
  const nav = useNavigate();
  if (!invite) return null;
  return (
    <div className="fixed left-1/2 top-3 z-[60] flex w-[min(360px,calc(100vw-1rem))] -translate-x-1/2 items-center gap-2 rounded-xl border border-gold bg-card/95 p-2 shadow-lg">
      <CharImg id={normalizeChar(invite.from.karakter) ?? "raka"} className="h-12" />
      <div className="min-w-0 flex-1 text-sm"><b>{invite.from.nama}</b> mengajakmu main di lobby <b className="text-gold">{invite.code}</b></div>
      <Button size="sm" onClick={() => { const c = invite.code; clearInvite(); void nav({ to: "/room/$code", params: { code: c } }); }}>Gabung</Button>
      <Button size="sm" variant="ghost" onClick={clearInvite}><X /></Button>
    </div>
  );
}
