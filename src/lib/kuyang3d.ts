// 3D Kuyang ghost: flying woman's head with long black hair, red spiral eyes, fanged grin, bloody neck and dangling organs/intestines. Flies 1.8–2.4 m.
import * as THREE from "three";

export type Kuyang = { root: THREE.Group; update: (s: { t: number; dt: number; moving: boolean }) => void };

export const KUYANG_MIN_H = 1.8;
export const KUYANG_MAX_H = 2.4;
/** Hover height for a given time: always inside 1.8–2.4 m. */
export const kuyangHeight = (t: number) => (KUYANG_MIN_H + KUYANG_MAX_H) / 2 + Math.sin(t * 1.6) * ((KUYANG_MAX_H - KUYANG_MIN_H) / 2);

function spiralTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ff1a1a"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#2a0000"; g.lineWidth = 3; g.beginPath();
  for (let a = 0; a < Math.PI * 8; a += 0.1) { const r = a * 1.2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  g.stroke();
  return new THREE.CanvasTexture(c);
}

export function buildKuyang(low = false): Kuyang {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const seg = low ? 8 : 18;
    const hairM = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8e4ea, roughness: 0.6, emissive: 0x201820, emissiveIntensity: 0.4 });
  const eyeM = new THREE.MeshBasicMaterial({ map: spiralTex() });
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x5a0008 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.4 });
  
  const blood = new THREE.MeshStandardMaterial({ color: 0x6a0410, roughness: 0.35, metalness: 0.1, emissive: 0x2a0004, emissiveIntensity: 0.5 });
  const gut = new THREE.MeshStandardMaterial({ color: 0x7a1822, roughness: 0.45, emissive: 0x300006, emissiveIntensity: 0.4 });
  // floating woman's head (no body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, seg, seg), skin); head.scale.set(0.92, 1.12, 0.95); body.add(head);
  // long black hair: cap + strands hanging far below the head
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, seg, seg, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  cap.rotation.x = -0.45; cap.position.set(0, 0.03, -0.03); body.add(cap);
  const hairs: THREE.Mesh[] = [];
  const nh = low ? 8 : 18;
  for (let i = 0; i < nh; i++) {
    const a = (i / nh) * Math.PI * 1.5 - Math.PI * 0.75; const len = 0.7 + ((i * 37) % 10) / 20;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.006, len, 5), hairM);
    h.geometry.translate(0, -len / 2, 0);
    h.position.set(Math.sin(a) * 0.22, 0.08, -Math.cos(a) * 0.16 - 0.02); h.rotation.z = Math.sin(a) * 0.12; body.add(h); hairs.push(h);
  }
  // glowing red eyes with spiral
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, seg, seg), eyeM); e.position.set(sx * 0.085, 0.05, 0.2); e.scale.z = 0.5; body.add(e);
  }
  // wide fanged grin
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, seg, seg / 2, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouthM);
  mouth.position.set(0, -0.09, 0.19); mouth.scale.set(1.15, 0.9, 0.4); body.add(mouth);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.013, i % 3 === 0 ? 0.07 : 0.045, 5), tooth);
    f.position.set(-0.085 + i * 0.028, -0.095, 0.225); f.rotation.x = Math.PI; body.add(f);
  }
  // torn bloody neck stump
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, seg), blood); neck.position.y = -0.27; body.add(neck);
  // dangling organs: heart, lungs, stomach
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.075, seg, seg), blood); heart.scale.set(1, 1.2, 0.9); heart.position.set(0.03, -0.42, 0.04); body.add(heart);
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, seg, seg), gut); l.scale.set(0.7, 1.4, 0.7); l.position.set(sx * 0.1, -0.44, -0.02); body.add(l); }
  const stomach = new THREE.Mesh(new THREE.SphereGeometry(0.09, seg, seg), gut); stomach.scale.set(1.2, 0.8, 0.8); stomach.position.set(-0.02, -0.58, 0.02); body.add(stomach);
  // swinging intestines (segmented chains)
  const tents: THREE.Group[] = [];
  const nt = low ? 3 : 5;
  for (let i = 0; i < nt; i++) {
    const tg = new THREE.Group(); const a = (i / nt) * Math.PI * 2;
    tg.position.set(Math.cos(a) * 0.07, -0.62, Math.sin(a) * 0.06);
    let parent: THREE.Object3D = tg; let r = 0.032;
    for (let k = 0; k < (low ? 4 : 7); k++) {
      const s = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.11, 3, 6), k % 2 ? gut : blood);
      m.position.y = -0.07; s.add(m); s.position.y = k === 0 ? 0 : -0.14; parent.add(s); parent = s; r *= 0.93;
    }
    tents.push(tg); body.add(tg);
  }
  const glow = new THREE.PointLight(0xff1020, 1.4, 3.5); glow.position.set(0, 0, 0.4); body.add(glow);

  let pitch = 0;
  return {
    root,
    update({ t, dt, moving }) {
      root.position.y = kuyangHeight(t);
      pitch += ((moving ? 0.45 : 0) - pitch) * Math.min(1, dt * 4); // swoop forward when chasing
      body.rotation.x = pitch;
      tents.forEach((tg, i) => {
        let k = 0;
        tg.traverse((o) => { if (o instanceof THREE.Group && o !== tg) { o.rotation.x = Math.sin(t * 3 + i + k) * 0.35 + (moving ? -0.3 : 0); o.rotation.z = Math.cos(t * 2.4 + i * 1.3 + k) * 0.25; k++; } });
      });
      hairs.forEach((h, i) => { h.rotation.x = 0.15 + Math.sin(t * 2.2 + i) * 0.12 + (moving ? 0.5 : 0); });
      glow.intensity = 1.2 + Math.sin(t * 7) * 0.3;
    },
  };
}
