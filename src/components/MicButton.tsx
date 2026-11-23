import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }];
const MIC_OK = "hm-mic-ok";
/** True once the player allowed the mic (remembered on this device) or the browser already granted it. */
async function micAllowed(): Promise<boolean> {
  try { if (localStorage.getItem(MIC_OK) === "1") return true; } catch { /* storage blocked */ }
  try { const p = await navigator.permissions?.query({ name: "microphone" as PermissionName }); return p?.state === "granted"; } catch { return false; }
}
type Sig = { from: string; to?: string; kind: "hello" | "offer" | "answer" | "ice" | "bye"; data?: unknown };

/** Voice chat: peer-to-peer audio (WebRTC) signalled over a realtime channel per room. Asks politely before the browser prompt. */
export function MicButton({ code, me, className = "" }: { code: string; me: string; className?: string }) {
  const [on, setOn] = useState(false);
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState("");
  const st = useRef<{ ch?: RealtimeChannel; stream?: MediaStream; peers: Record<string, RTCPeerConnection>; audios: Record<string, HTMLAudioElement> }>({ peers: {}, audios: {} });

  const stop = () => {
    const s = st.current;
    s.ch?.send({ type: "broadcast", event: "sig", payload: { from: me, kind: "bye" } satisfies Sig });
    Object.values(s.peers).forEach((p) => p.close()); Object.values(s.audios).forEach((a) => a.remove());
    s.stream?.getTracks().forEach((t) => t.stop());
    if (s.ch) void supabase.removeChannel(s.ch);
    st.current = { peers: {}, audios: {} }; setOn(false);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setAsk(false); setErr("");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { try { localStorage.removeItem(MIC_OK); } catch { /* ignore */ } setErr("Mic diblokir. Buka pengaturan situs di browser, ubah Mikrofon ke \"Izinkan\", lalu coba lagi."); return; }
    try { localStorage.setItem(MIC_OK, "1"); } catch { /* ignore */ }
    const s = st.current; s.stream = stream;
    const ch = supabase.channel(`voice-${code}`, { config: { broadcast: { self: false } } }); s.ch = ch;
    const send = (p: Sig) => ch.send({ type: "broadcast", event: "sig", payload: p });
    const peer = (id: string) => {
      if (s.peers[id]) return s.peers[id]!;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => { if (e.candidate) void send({ from: me, to: id, kind: "ice", data: e.candidate.toJSON() }); };
      pc.ontrack = (e) => { let a = s.audios[id]; if (!a) { a = document.createElement("audio"); a.autoplay = true; document.body.appendChild(a); s.audios[id] = a; } a.srcObject = e.streams[0] ?? null; void a.play().catch(() => {}); };
      s.peers[id] = pc; return pc;
    };
    ch.on("broadcast", { event: "sig" }, async ({ payload }) => {
      const m = payload as Sig; if (m.from === me || (m.to && m.to !== me)) return;
      if (m.kind === "bye") { s.peers[m.from]?.close(); delete s.peers[m.from]; s.audios[m.from]?.remove(); delete s.audios[m.from]; return; }
      if (m.kind === "hello") { if (me < m.from) { const pc = peer(m.from); const o = await pc.createOffer(); await pc.setLocalDescription(o); void send({ from: me, to: m.from, kind: "offer", data: o }); } else void send({ from: me, to: m.from, kind: "hello" }); return; }
      const pc = peer(m.from);
      if (m.kind === "offer") { await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit); const a = await pc.createAnswer(); await pc.setLocalDescription(a); void send({ from: me, to: m.from, kind: "answer", data: a }); }
      else if (m.kind === "answer") await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
      else if (m.kind === "ice") await pc.addIceCandidate(m.data as RTCIceCandidateInit).catch(() => {});
    });
    ch.subscribe((status) => { if (status === "SUBSCRIBED") void send({ from: me, kind: "hello" }); });
    setOn(true);
  };

  return (
    <>
      <button onPointerDown={() => { if (on) { stop(); return; } void micAllowed().then((ok) => (ok ? start() : setAsk(true))); }} aria-label={on ? "Matikan mic" : "Nyalakan mic"}
        className={`flex size-9 items-center justify-center rounded-full border ${on ? "border-chart-4 bg-chart-4/30 text-chart-4" : "border-border bg-card/80 text-foreground"} ${className}`}>
        {on ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </button>
      {(ask || err) && (
        <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-void/80 p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="max-w-sm rounded-xl border border-border bg-card p-5 text-center">
            <Mic className="mx-auto mb-2 size-8 text-gold" />
            <h2 className="mb-2 text-lg font-bold">{err ? "Mic Diblokir" : "Aktifkan Suara Mic?"}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{err || "Tekan Lanjutkan, lalu pilih \"Izinkan\" saat browser meminta akses mikrofon agar kamu bisa ngobrol dengan teman satu tim."}</p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => { setAsk(false); setErr(""); }}>{err ? "Tutup" : "Nanti"}</Button>
              <Button onClick={() => void start()}>{err ? "Coba Lagi" : "Lanjutkan"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
