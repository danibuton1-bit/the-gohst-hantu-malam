import QRCode from "qrcode";
import { characterSvg, CHARACTERS, svgUrl } from "./art";
import { formatTanggal, qrPayload, type Profile } from "./account";

const img = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

/** Draws the official ID card to a PNG data URL (same image for display and download). */
export async function renderIdCard(p: Profile, admin = false): Promise<string> {
  await document.fonts?.ready;
  const W = 1000, H = 620;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a0610"); bg.addColorStop(0.6, "#12081c"); bg.addColorStop(1, "#050307");
  g.fillStyle = bg; roundRect(g, 0, 0, W, H, 36); g.fill();
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, "#fff1a8"); gold.addColorStop(0.35, "#d4a017"); gold.addColorStop(0.6, "#fff4c2"); gold.addColorStop(1, "#a87400");
  g.strokeStyle = admin ? gold : "#8b0d17"; g.lineWidth = admin ? 14 : 8; roundRect(g, 10, 10, W - 20, H - 20, 30); g.stroke();
  g.fillStyle = admin ? gold : "#8b0d17"; g.fillRect(10, 30, W - 20, 96);
  g.fillStyle = "#fff"; g.font = "56px Creepster, fantasy"; g.textBaseline = "middle";
  g.fillText("HANTU MALAM", 48, 80);
  g.font = "22px 'Special Elite', monospace"; g.textAlign = "right";
  g.fillText(admin ? "GAME MASTER" : "OFFICIAL ID", W - 48, 80); g.textAlign = "left";
  if (admin) {
    // crown badge
    g.fillStyle = gold; g.beginPath();
    g.moveTo(760, 230); g.lineTo(770, 170); g.lineTo(805, 205); g.lineTo(848, 150); g.lineTo(891, 205); g.lineTo(926, 170); g.lineTo(936, 230); g.closePath(); g.fill();
    g.fillStyle = "#1a0610"; g.font = "bold 20px 'Special Elite', monospace"; g.textAlign = "center"; g.fillText("ADMIN", 848, 218); g.textAlign = "left";
  }

  // avatar
  g.fillStyle = "#2a1030"; roundRect(g, 48, 160, 280, 340, 20); g.fill();
  g.strokeStyle = "#5c2a6e"; g.lineWidth = 4; g.stroke();
  const av = await img(svgUrl(characterSvg(p.karakter_pilihan)));
  g.drawImage(av, 68, 170, 240, 336);

  g.fillStyle = "#b9a3c9"; g.font = "20px 'Special Elite', monospace";
  const rows: [string, string][] = [
    ["NAMA", p.nama.toUpperCase()],
    ["TANGGAL LAHIR", formatTanggal(p.tanggal_lahir)],
    ["USERNAME", p.username],
    ["KARAKTER", CHARACTERS[p.karakter_pilihan].nama],
  ];
  rows.forEach(([k, v], i) => {
    const y = 175 + i * 82;
    g.fillStyle = "#a88fb8"; g.font = "20px 'Special Elite', monospace"; g.fillText(k, 360, y);
    g.fillStyle = "#f4eef7"; g.font = "34px 'Special Elite', monospace"; g.fillText(v.slice(0, 22), 360, y + 36);
  });
  g.fillStyle = "#c4121f"; g.font = "64px Creepster, fantasy";
  g.fillText(p.kode_id, 360, 520);

  const qr = await img(await QRCode.toDataURL(qrPayload(p), { margin: 1, width: 220, color: { dark: "#000000", light: "#ffffff" } }));
  g.fillStyle = "#fff"; roundRect(g, 738, 270, 220, 220, 12); g.fill();
  g.drawImage(qr, 738, 270, 220, 220);
  g.fillStyle = "#a88fb8"; g.font = "18px 'Special Elite', monospace"; g.textAlign = "center";
  g.fillText("SCAN UNTUK MASUK", 848, 512); g.textAlign = "left";

  g.fillStyle = "#6e5a7a"; g.font = "18px 'Special Elite', monospace";
  g.fillText("HANTU MALAM OFFICIAL ID  -  MABAR HOROR  -  JANGAN HILANG", 48, 578);
  return c.toDataURL("image/png");
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const url = URL.createObjectURL(file);
  try {
    const i = await img(url);
    for (const scale of [1, 0.5, 2]) {
      const c = document.createElement("canvas");
      c.width = Math.round(i.width * scale); c.height = Math.round(i.height * scale);
      const g = c.getContext("2d")!;
      g.drawImage(i, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height);
      const r = jsQR(d.data, d.width, d.height);
      if (r?.data) return r.data;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
