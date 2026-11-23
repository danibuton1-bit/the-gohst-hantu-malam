// 3D Kuyang ghost: black hood, pale face, glowing red spiral eyes, fanged grin, 6 shadow tentacles. Flies 1.8–2.4 m.
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
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.95 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8e4ea, roughness: 0.6, emissive: 0x201820, emissiveIntensity: 0.4 });
  const eyeM = new THREE.MeshBasicMaterial({ map: spiralTex() });
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x5a0008 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.4 });
  const tentM = new THREE.MeshStandardMaterial({ color: 0x140406, roughness: 0.7, emissive: 0x4a0008, emissiveIntensity: 0.6 });

  // head + hood
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, seg, seg), skin); head.scale.set(1, 1.05, 0.95); body.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, seg, seg, 0, Math.PI * 2, 0, Math.PI * 0.62), black);
  hood.rotation.x = -0.35; hood.position.set(0, 0.04, -0.06); body.add(hood);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.33, seg, seg), black); back.position.set(0, 0, -0.12); back.scale.set(1, 1.05, 0.8); body.add(back);
  // eyes (glowing spiral)
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, seg, seg), eyeM); e.position.set(sx * 0.1, 0.04, 0.2); e.scale.z = 0.5; body.add(e);
  }
  // fanged grin
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, seg, seg / 2, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouthM);
  mouth.position.set(0, -0.1, 0.2); mouth.scale.set(1.2, 0.8, 0.4); body.add(mouth);
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 5), tooth);
    f.position.set(-0.09 + i * 0.036, -0.1, 0.235); f.rotation.x = Math.PI; body.add(f);
  }
  // hair strands
  if (!low) for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI - Math.PI / 2;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.005, 0.7, 5), hairM);
    h.position.set(Math.sin(a) * 0.3, -0.35, -0.05 - Math.cos(a) * 0.1); h.rotation.z = Math.sin(a) * 0.25; body.add(h);
  }
  // small hoodie torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.38, seg), black); torso.position.y = -0.42; body.add(torso);
  // 6 shadow tentacles
  const tents: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const tg = new THREE.Group(); const a = (i / 6) * Math.PI * 2;
    tg.position.set(Math.cos(a) * 0.14, -0.6, Math.sin(a) * 0.14);
    let parent: THREE.Object3D = tg; let r = 0.05;
    for (let k = 0; k < (low ? 3 : 5); k++) {
      const s = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, 0.24, 6), tentM);
      m.position.y = -0.12; s.add(m); s.position.y = k === 0 ? 0 : -0.24; parent.add(s); parent = s; r *= 0.75;
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
      glow.intensity = 1.2 + Math.sin(t * 7) * 0.3;
    },
  };
}
