// Free Fire–style 3D stage: squad avatars standing on a lit platform with idle animation; optional hovering Kuyang. Drag to rotate.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildAvatar, nameTag, type Avatar } from "@/lib/avatar3d";
import { buildKuyang } from "@/lib/kuyang3d";
import type { CharId } from "@/lib/art";
import { getGfx, pixelRatioFor } from "@/lib/graphics";

export type StageActor = { key: string; karakter: CharId; nama?: string; emote?: string | null; walk?: boolean; crown?: boolean };

export function Stage3D({ actors, kuyang = false, className, kuyangOnly = false }: { actors: StageActor[]; kuyang?: boolean; kuyangOnly?: boolean; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef(actors); live.current = actors;
  const sig = actors.map((a) => a.key + a.karakter + (a.nama ?? "")).join("|");

  useEffect(() => {
    const host = wrap.current!; const canvas = document.createElement("canvas");
    canvas.className = "block h-full w-full touch-none"; host.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(pixelRatioFor(getGfx(), window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches, false));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0306, 6, 14);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xb8a0ff, 0x200808, 0.9));
    const key = new THREE.SpotLight(0xffe2b0, 60, 14, 0.55, 0.5, 1.4); key.position.set(1.5, 5, 4); scene.add(key, key.target);
    const rim = new THREE.PointLight(0xc4121f, 12, 8); rim.position.set(0, 2.5, -2.5); scene.add(rim);
    const stage = new THREE.Group(); scene.add(stage);
    const n = Math.max(1, live.current.length);
    // open free-standing floor (no round podium), fades into fog like a Free Fire lobby
    const floorTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!; g.fillStyle = "#1a1216"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#2a1c22"; g.lineWidth = 2; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 20); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const avs: { a: Avatar; key: string }[] = [];
    if (!kuyangOnly) live.current.forEach((ac, i) => {
      const a = buildAvatar(ac.karakter, (p) => new THREE.MeshStandardMaterial(p), false);
      a.root.position.x = (i - (n - 1) / 2) * 1.05; a.root.rotation.y = (i - (n - 1) / 2) * -0.18; stage.add(a.root);
      if (ac.nama) { const t = nameTag(ac.nama, ac.crown ? "#e8b730" : "#f4efe6"); t.position.set(a.root.position.x, 1.95, 0); stage.add(t); }
      avs.push({ a, key: ac.key });
    });
    const ku = kuyang || kuyangOnly ? buildKuyang(false) : null;
    if (ku) { ku.root.position.set(0, 0, kuyangOnly ? 0 : -1.4); ku.root.scale.setScalar(kuyangOnly ? 1.6 : 1.2); stage.add(ku.root); }
    const resize = () => { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h;
      const span = kuyangOnly ? 2.6 : Math.max(2.6, n * 1.05 + 0.8);
      const dist = Math.max(3.6, (span / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1.4, camera.aspect) + 1);
      camera.position.set(0, kuyangOnly ? 2.4 : 1.5, dist); camera.lookAt(0, kuyangOnly ? 2.2 : 1.0, 0); camera.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(host);
    let rotY = 0, vel = 0, drag: number | null = null, lx = 0;
    const pd = (e: PointerEvent) => { drag = e.pointerId; lx = e.clientX; };
    const pm = (e: PointerEvent) => { if (drag !== e.pointerId) return; vel = (e.clientX - lx) * 0.01; rotY += vel; lx = e.clientX; };
    const pu = (e: PointerEvent) => { if (drag === e.pointerId) drag = null; };
    canvas.addEventListener("pointerdown", pd); window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu);
    let raf = 0, last = performance.now(); const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
      if (drag === null) { vel *= Math.exp(-dt * 3); rotY += vel + (Math.abs(vel) < 0.002 ? Math.sin(t * 0.3) * 0.0015 : 0); }
      stage.rotation.y = rotY;
      avs.forEach(({ a, key: k }, i) => { const ac = live.current.find((x) => x.key === k); a.update({ dt, t: t + i * 0.7, moving: !!ac?.walk, pitch: 0, emote: ac?.emote ?? null }); });
      if (ku) { ku.update({ t, dt, moving: false }); if (!kuyangOnly) ku.root.position.y += 0.2; else ku.root.position.y -= 0.6; }
      rim.intensity = 10 + Math.sin(t * 5) * 3;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    host.dataset["sceneReady"] = "1";
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); renderer.dispose(); canvas.remove(); };
  }, [sig, kuyang, kuyangOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={wrap} className={className} />;
}
