import { getSound } from "./sound-settings";
import { playSfx, playTrack, setTrackMuted, stopTrack } from "./media";
// Every sound is synthesized with the Web Audio API — no audio files.
class HorrorAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private musicTimer: number | null = null;
  private breath: { g: GainNode; src: AudioBufferSourceNode } | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastBeat = 0;

  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m: boolean) {
    this.muted = m; setTrackMuted(m);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  private noise(dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = "bandpass") {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, 0.005, peak, dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  step() { this.noise(0.09, 180 + Math.random() * 80, 1.2, 0.35, "lowpass"); }
  pickup() { this.tone(880, 0.15, "triangle", 0.25); setTimeout(() => this.tone(1320, 0.25, "triangle", 0.2), 90); }
  creak() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(180, t + 0.6); o.frequency.linearRampToValueAtTime(70, t + 1.1);
    const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 8;
    const g = this.ctx.createGain(); this.env(g, t, 0.05, 0.12, 1.1);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 1.3);
  }
  tone(freq: number, dur: number, type: OscillatorType, peak: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain(); this.env(g, t, 0.01, peak, dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.1);
  }
  heartbeat(intensity: number) {
    if (!this.ctx || intensity <= 0) return;
    const now = performance.now();
    const interval = 1100 - intensity * 700;
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    const thump = (delay: number, p: number) => setTimeout(() => this.tone(52, 0.18, "sine", p), delay);
    thump(0, 0.5 + intensity * 0.5); thump(160, 0.35 + intensity * 0.4);
  }
  scream() {
    if (!this.ctx || !this.master) return;
    const vol = getSound().pocong; if (vol <= 0) return;
    const t = this.ctx.currentTime;
    for (const base of [620, 760]) {
      const o = this.ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.8, t + 0.25); o.frequency.exponentialRampToValueAtTime(base * 0.6, t + 1.2);
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9; const lg = this.ctx.createGain(); lg.gain.value = 40;
      lfo.connect(lg).connect(o.frequency);
      const g = this.ctx.createGain(); this.env(g, t, 0.02, 0.18 * vol, 1.2);
      o.connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3);
    }
    this.noise(1, 2500, 0.8, 0.2);
  }
  /** Kuyang screech: shrill rising shriek + raspy cackle. */
  kuyang() {
    if (!this.ctx || !this.master) return;
    const vol = getSound().kuyang; if (vol <= 0) return;
    if (playSfx("kuyang", vol * 0.8, this.muted)) return;
    const t = this.ctx.currentTime;
    for (const [base, p] of [[900, 0.22], [1350, 0.14], [600, 0.12]] as const) {
      const o = this.ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(base * 0.7, t); o.frequency.exponentialRampToValueAtTime(base * 2.2, t + 0.35); o.frequency.exponentialRampToValueAtTime(base * 1.4, t + 1.6);
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 14; const lg = this.ctx.createGain(); lg.gain.value = base * 0.08;
      lfo.connect(lg).connect(o.frequency);
      const f = this.ctx.createBiquadFilter(); f.type = "peaking"; f.frequency.value = 2400; f.gain.value = 12;
      const g = this.ctx.createGain(); this.env(g, t, 0.015, p * vol, 1.7);
      o.connect(f).connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9);
    }
    this.noise(1.4, 3200, 0.7, 0.28 * vol);
    for (let i = 0; i < 5; i++) setTimeout(() => this.noise(0.08, 1100, 3, 0.25 * vol), 1500 + i * 130);
  }
  shout() { this.tone(440, 0.3, "square", 0.12); setTimeout(() => this.tone(523, 0.35, "square", 0.12), 200); }
  setBreath(level: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    if (!this.breath) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 1.5;
      const g = this.ctx.createGain(); g.gain.value = 0;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.45;
      const lg = this.ctx.createGain(); lg.gain.value = 0;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(this.master); src.start(); lfo.start();
      this.breath = { g: lg, src };
    }
    this.breath.g.gain.setTargetAtTime(level * 0.25, this.ctx.currentTime, 0.3);
  }
  /** Plays the admin-uploaded track for this screen, or the built-in synth score. */
  startMusic(kind: "music_lobby" | "music_game" = "music_game") {
    if (playTrack(kind, getSound().music * 0.6, this.muted)) { if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; return; }
    if (kind === "music_lobby") return;
    if (this.musicTimer || !this.ctx) return;
    const notes = [220, 261.6, 207.7, 196, 233.1, 174.6, 246.9, 164.8];
    let i = 0;
    const play = () => {
      if (!this.ctx || !this.master) return;
      const f = notes[(i * 3 + (i % 2)) % notes.length]!;
      i++;
      const t = this.ctx.currentTime;
      const mv = getSound().music;
      for (const [mult, p] of [[1, 0.09 * mv], [2, 0.03 * mv], [0.5, 0.05 * mv]] as const) {
        if (p <= 0) continue;
        const o = this.ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * mult;
        const g = this.ctx.createGain(); this.env(g, t, 0.01, p, 2.6);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + 2.8);
      }
      if (Math.random() < 0.15) this.creak();
    };
    play();
    this.musicTimer = window.setInterval(play, 1900);
  }
  stopAll() {
    stopTrack();
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.setBreath(0);
  }
}

export const audio = new HorrorAudio();
