// All game art is generated as SVG strings: reused by React (inline, animated) and the 3D scene (as images).
export type CharId = "raka" | "aisyah" | "qila" | "nabila";

type Look = { nama: string; desc: string; top: string; topShade: string; torch: string };
export const CHARACTERS: Record<CharId, Look> = {
  raka: { nama: "RAKA", desc: "Pemburu berhoodie hitam. Serius, tenang, perlengkapan lengkap.", top: "#1b1b20", topShade: "#2b2b32", torch: "#2a2a2e" },
  aisyah: { nama: "AISYAH", desc: "Pemburu ceria berhijab pink dengan senter emas.", top: "#f4a9c6", topShade: "#e08aac", torch: "#e7b62c" },
  qila: { nama: "QILA", desc: "Pemburu tangguh berhijab hitam, baju belang hijau.", top: "#2f9f95", topShade: "#24827a", torch: "#2a2a2e" },
  nabila: { nama: "NABILA", desc: "Pemburu kalem berhijab dan jaket lavender.", top: "#b9a2e3", topShade: "#9c84cf", torch: "#2a2a2e" },
};
export const CHAR_IDS = Object.keys(CHARACTERS) as CharId[];
export const isChar = (v: unknown): v is CharId => typeof v === "string" && v in CHARACTERS;
/** Old saves used "zahra" for the black-hijab hunter, now called Qila. */
export const normalizeChar = (v: unknown): CharId | null => (v === "zahra" ? "qila" : isChar(v) ? v : null);

const SKIN = "#f6d5bd", SKIN_SH = "#e9b99c", INK = "#161012";

function eyes(iris: string, girl: boolean) {
  const eye = (cx: number) => `
<ellipse cx="${cx}" cy="51" rx="6" ry="7" fill="#fff" stroke="${INK}" stroke-width=".8"/>
<ellipse cx="${cx}" cy="52" rx="4.6" ry="5.8" fill="${iris}"/>
<ellipse cx="${cx}" cy="53" rx="2.4" ry="3.2" fill="${INK}"/>
<ellipse cx="${cx}" cy="55.5" rx="3" ry="1.4" fill="#fff" opacity=".25"/>
<circle cx="${cx - 1.8}" cy="49" r="1.8" fill="#fff"/><circle cx="${cx + 1.6}" cy="54.6" r=".9" fill="#fff"/>
<path d="M${cx - 6.6} 48 Q${cx} 41.6 ${cx + 6.6} 48" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
${girl ? `<path d="M${cx + (cx < 50 ? -6.4 : 6.4)} 47.6 l${cx < 50 ? -2.4 : 2.4} -1.8" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` : ""}
<g class="hm-lid" style="transform-origin:${cx}px 44px;transform:scaleY(0)"><ellipse cx="${cx}" cy="51" rx="7" ry="7.8" fill="${SKIN}"/><path d="M${cx - 6.4} 56 Q${cx} 59 ${cx + 6.4} 56" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
  return eye(41) + eye(59);
}
const face = (o: { iris: string; girl: boolean; mood: "serius" | "senyum" }) => `
<ellipse cx="50" cy="49" rx="21" ry="20" fill="${SKIN}"/>
${o.mood === "serius" ? `<path d="M34 41 l9 1.5 M66 41 l-9 1.5" stroke="#5a3a26" stroke-width="1.6" stroke-linecap="round"/>` : `<path d="M35 41 q5 -2.5 9 -.5 M65 41 q-5 -2.5 -9 -.5" stroke="#3a2a22" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}
${eyes(o.iris, o.girl)}
<ellipse cx="34" cy="58" rx="3.6" ry="2" fill="#f19aa0" opacity="${o.girl ? ".65" : ".25"}"/><ellipse cx="66" cy="58" rx="3.6" ry="2" fill="#f19aa0" opacity="${o.girl ? ".65" : ".25"}"/>
<circle cx="50" cy="58" r=".7" fill="${SKIN_SH}"/>
${o.mood === "serius" ? `<path d="M46 63.5 q4 -2 8 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` : `<path d="M45 62 q5 4 10 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
<g class="hm-shy" opacity="0">
<ellipse cx="41" cy="51" rx="7.4" ry="8.2" fill="${SKIN}"/><ellipse cx="59" cy="51" rx="7.4" ry="8.2" fill="${SKIN}"/><rect x="43" y="59.5" width="14" height="6.5" fill="${SKIN}"/>
<path d="M36 46.5 L45 51 L36 55.5 M64 46.5 L55 51 L64 55.5" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse class="hm-blush" cx="34" cy="58.5" rx="6" ry="3.2" fill="#ff5d7a" opacity=".75"/><ellipse class="hm-blush" cx="66" cy="58.5" rx="6" ry="3.2" fill="#ff5d7a" opacity=".75"/>
<path d="M33 57 l2 -2 M36 57.5 l2 -2 M64 57.5 l2 -2 M67 57 l2 -2" stroke="#c43a55" stroke-width=".8" stroke-linecap="round"/>
<path d="M44.5 63 q1.4 -1.6 2.8 0 t2.8 0 t2.8 0 t2.8 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
</g>`;

const badge = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#2a2116" stroke="#d8ae45" stroke-width="1.2"/><path d="M${x - 1.6} ${y - 2} a2.4 2.4 0 1 0 2.6 3.6 a2 2 0 1 1 -2.6 -3.6z" fill="#d8ae45"/><text x="${x}" y="${y - 1.9}" font-size="1.7" text-anchor="middle" fill="#d8ae45" font-family="sans-serif" font-weight="bold">HANTU</text><text x="${x}" y="${y + 3.4}" font-size="1.7" text-anchor="middle" fill="#d8ae45" font-family="sans-serif" font-weight="bold">MALAM</text>`;

function torchArm(o: { sleeve: string; sleeveSh: string; glove?: boolean; torch: string; gold?: boolean }) {
  const t = o.gold
    ? `<path d="M17 98 l8 4 l-3 6 l-9 -3z" fill="#e7b62c" stroke="#9b7414" stroke-width=".8"/><path d="M13 104 l9 3 l-5 7 l-10 -5z" fill="#f2c84a" stroke="#9b7414" stroke-width=".8"/>`
    : `<rect x="14" y="97" width="13" height="6" rx="2" fill="${o.torch}" stroke="#000" stroke-width=".6" transform="rotate(35 20 100)"/><circle cx="15" cy="105" r="3.6" fill="#3a3a40" stroke="#000" stroke-width=".6"/>`;
  return `<g class="hm-armR" style="transform-origin:31px 75px">
<path class="hm-beam" d="M14 106 L-4 140 L22 140Z" fill="#ffe89a" opacity=".22"/>
<path d="M31 73 Q22 76 21 90 L21 99 Q25 102 29 99 L30 88Z" fill="${o.sleeve}" stroke="${INK}" stroke-width=".8"/>
<path d="M21 96 h8" stroke="${o.sleeveSh}" stroke-width="2"/>
${t}
<circle cx="25" cy="101" r="4.2" fill="${o.glove ? "#202024" : SKIN}" stroke="${INK}" stroke-width=".7"/>${o.glove ? `<path d="M23 104 h4" stroke="${SKIN}" stroke-width="1.6" stroke-linecap="round"/>` : ""}
${o.gold ? "" : `<circle cx="14.6" cy="105.6" r="2.2" fill="#fff6c8"/>`}
</g>`;
}
function freeArm(o: { sleeve: string; sleeveSh: string; glove?: boolean }) {
  return `<g class="hm-armL" style="transform-origin:69px 75px">
<path d="M69 73 Q78 76 79 90 L79 99 Q75 102 71 99 L70 88Z" fill="${o.sleeve}" stroke="${INK}" stroke-width=".8"/>
<path d="M71 96 h8" stroke="${o.sleeveSh}" stroke-width="2"/>
<circle cx="75" cy="101" r="4.2" fill="${o.glove ? "#202024" : SKIN}" stroke="${INK}" stroke-width=".7"/>${o.glove ? `<path d="M73 104 h4" stroke="${SKIN}" stroke-width="1.6" stroke-linecap="round"/>` : ""}
</g>`;
}
const legs = (pants: string, shade: string, shoe: string, sole: string, boots: boolean) => {
  const by = boots ? 124 : 128;
  return `
<g class="hm-legL" style="transform-origin:41px 103px">
<path d="M33 102 L49 102 L48 129 L36 129Z" fill="${pants}" stroke="${INK}" stroke-width=".8"/><path d="M37 124 h10" stroke="${shade}" stroke-width="1.4"/>
<path d="M33 ${by} h15 v8 q0 2 -2 2 h-16 q-1 -6 3 -10z" fill="${shoe}" stroke="${INK}" stroke-width=".8"/><path d="M30 137 h18" stroke="${sole}" stroke-width="2"/>
${boots ? `<path d="M38 127 l4 2 M38 130 l4 -2" stroke="#555" stroke-width=".7"/>` : ""}</g>
<g class="hm-legR" style="transform-origin:59px 103px">
<path d="M51 102 L67 102 L64 129 L52 129Z" fill="${pants}" stroke="${INK}" stroke-width=".8"/><path d="M53 124 h10" stroke="${shade}" stroke-width="1.4"/>
<path d="M52 ${by} h15 q4 4 3 10 h-16 q-2 0 -2 -2z" fill="${shoe}" stroke="${INK}" stroke-width=".8"/><path d="M52 137 h18" stroke="${sole}" stroke-width="2"/>
${boots ? `<path d="M57 127 l4 2 M57 130 l4 -2" stroke="#555" stroke-width=".7"/>` : ""}</g>`;
};

function raka() {
  return `
<path d="M70 78 q12 2 12 14 l0 12 q-4 3 -10 0z" fill="#26262c" stroke="${INK}" stroke-width=".8"/>
<rect x="76" y="88" width="9" height="9" rx="2" fill="#ece6d6" stroke="#8a8070" stroke-width=".6"/><circle cx="80.5" cy="92.5" r="2" fill="#bfb7a4"/><path d="M84 96 l2 9 l-4 -2z" fill="#ece6d6"/>
${legs("#1f1f24", "#121215", "#141416", "#2e2e33", true)}
<rect x="37" y="110" width="8" height="7" rx="1" fill="#16161a" stroke="#000" stroke-width=".5"/>
<path d="M29 72 Q50 66 71 72 L72 104 L28 104Z" fill="#1b1b20" stroke="${INK}" stroke-width=".8"/>
<path d="M50 70 V104" stroke="#3a3a42" stroke-width="1"/><path d="M38 90 h24 l-2 10 h-20z" fill="#232329" stroke="#0e0e10" stroke-width=".7"/>
<path d="M45 70 v8 M55 70 v8" stroke="#3a3a42" stroke-width=".9"/><circle cx="45" cy="78.5" r=".9" fill="#888"/><circle cx="55" cy="78.5" r=".9" fill="#888"/>
<path d="M33 73 v30 M67 73 v30" stroke="#0e0e10" stroke-width="2.4"/>
${badge(39, 81)}
<path d="M58 84 q0 -6 4 -6 q4 0 4 6 l-1 -1 l-1 1 l-1 -1 l-1 1 l-1 -1 l-1 1z" fill="#8fb3c8"/><circle cx="61" cy="80.5" r=".5" fill="${INK}"/><circle cx="63" cy="80.5" r=".5" fill="${INK}"/>
<rect x="28" y="101" width="44" height="4" fill="#111" /><rect x="47" y="101.4" width="6" height="3.2" fill="#6d6d74"/>
<rect x="31" y="103" width="6" height="7" rx="1" fill="#1a1a1e" stroke="#000" stroke-width=".5"/><rect x="63" y="103" width="6" height="7" rx="1" fill="#3a2a20" stroke="#000" stroke-width=".5"/>
<path d="M57 105 v3" stroke="#aaa" stroke-width=".8"/><rect x="54.5" y="108" width="6" height="10" fill="#e9e0c8" stroke="#8a7d60" stroke-width=".5"/><path d="M56 110 h3 M56 112 h3 M57.5 113 v4" stroke="#5a4a30" stroke-width=".6"/>
<path d="M51 105 v4 l-1 2" stroke="#b9b9b9" stroke-width="1"/>
${torchArm({ sleeve: "#1b1b20", sleeveSh: "#0e0e10", glove: true, torch: "#2a2a2e" })}
${freeArm({ sleeve: "#1b1b20", sleeveSh: "#0e0e10", glove: true })}
<path d="M17 54 Q14 12 50 10 Q86 12 83 54 Q84 70 71 74 L29 74 Q16 70 17 54Z" fill="#17171b" stroke="${INK}" stroke-width="1"/>
<path d="M24 56 Q22 22 50 20 Q78 22 76 56 Q72 70 50 70 Q28 70 24 56Z" fill="#0b0b0d"/>
${face({ iris: "#4a3426", girl: false, mood: "serius" })}
<path d="M27 46 Q22 22 50 22 Q76 22 74 44 L70 36 L66 44 L62 33 L57 42 L52 31 L47 41 L42 33 L39 43 L33 36 L31 47Z" fill="#7a4a2a" stroke="#3d2414" stroke-width=".8"/>
<path d="M26 34 L14 30 L24 40 Z M27 40 L16 44 L27 46Z" fill="#7a4a2a" stroke="#3d2414" stroke-width=".7"/>
<path d="M44 26 q6 4 12 2 M36 30 q4 3 6 8" stroke="#a8724a" stroke-width="1.2" fill="none"/>`;
}
function aisyah() {
  return `
${legs("#141416", "#000", "#f2a6c4", "#ffffff", false)}
<path d="M30 98 L70 98 L77 117 L23 117Z" fill="#e37fa7" stroke="${INK}" stroke-width=".8"/><path d="M38 99 l-3 18 M50 99 v18 M62 99 l3 18" stroke="#c96690" stroke-width="1"/>
<path d="M29 72 Q50 66 71 72 L72 100 L28 100Z" fill="#f4a9c6" stroke="${INK}" stroke-width=".8"/>
<path d="M42 70 L58 70 L57 100 L43 100Z" fill="#1c1c20"/>
<path d="M42 70 L43 100 M58 70 L57 100" stroke="#d887a8" stroke-width="1.6"/><path d="M28 97 h44" stroke="#e08aac" stroke-width="2.4"/>
<path d="M33 90 l5 -2 M67 90 l-5 -2" stroke="#d887a8" stroke-width="1"/>
${badge(63, 80)}
${torchArm({ sleeve: "#f4a9c6", sleeveSh: "#e08aac", torch: "#e7b62c", gold: true })}
${freeArm({ sleeve: "#f4a9c6", sleeveSh: "#e08aac" })}
<path d="M22 54 Q20 16 50 16 Q80 16 78 54 Q82 70 70 76 Q50 82 30 76 Q18 70 22 54Z" fill="#f6b6cf" stroke="${INK}" stroke-width="1"/>
<path d="M30 74 Q50 82 70 74 L68 70 Q50 76 32 70Z" fill="#e795b5"/>
${face({ iris: "#6b3a30", girl: true, mood: "senyum" })}
<path d="M28 50 Q28 26 50 26 Q72 26 72 50 Q68 34 50 32 Q32 34 28 50Z" fill="#f6b6cf" stroke="#c97b9c" stroke-width=".6"/>
<path d="M36 22 q14 -6 28 0" stroke="#fbd0e0" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}
function qila() {
  const stripes = [78, 83, 88, 93, 98].map((y) => `<path d="M29 ${y} H71" stroke="#e9fbf7" stroke-width="1.1" opacity=".85"/>`).join("");
  return `
<path d="M24 66 Q10 90 14 118 Q22 112 28 116 L30 74Z" fill="#111114" stroke="${INK}" stroke-width=".8"/>
${legs("#18181c", "#0a0a0c", "#1a1a1e", "#dddddd", false)}
<rect x="33" y="108" width="7" height="9" rx="1.5" fill="#101012" stroke="#2a2a2e" stroke-width=".6"/><path d="M33 112 h15" stroke="#0c0c0e" stroke-width="1.6"/>
<path d="M29 72 Q50 66 71 72 L72 102 L28 102Z" fill="#2f9f95" stroke="${INK}" stroke-width=".8"/>
${stripes}
<path d="M47 70 v12 h6 v-12" fill="#2a8f86" stroke="#1d6c65" stroke-width=".6"/><circle cx="50" cy="75" r="1" fill="#fff"/><circle cx="50" cy="79.5" r="1" fill="#fff"/>
${badge(62, 82)}
<rect x="28" y="100" width="44" height="4" fill="#0d0d0f"/><rect x="47" y="100.4" width="6" height="3.2" fill="#3a3a40"/>
<rect x="63" y="102" width="7" height="8" rx="1" fill="#141416" stroke="#000" stroke-width=".5"/>
<path d="M57 104 v3" stroke="#bbb" stroke-width=".7"/><path d="M58.6 108 a2.4 2.4 0 1 1 -2 3.6 a1.8 1.8 0 1 0 2 -3.6z" fill="#e2c15a"/>
<path d="M42 104 v3" stroke="#bbb" stroke-width=".7"/><circle cx="42" cy="108.6" r="1.6" fill="#4a7fd0"/>
${torchArm({ sleeve: "#2f9f95", sleeveSh: "#e9fbf7", torch: "#2a2a2e" })}
${freeArm({ sleeve: "#2f9f95", sleeveSh: "#e9fbf7" })}
<path d="M21 54 Q19 15 50 15 Q81 15 79 54 Q84 72 74 80 Q50 88 26 80 Q16 72 21 54Z" fill="#141417" stroke="${INK}" stroke-width="1"/>
<path d="M26 78 Q50 88 74 78 L72 72 Q50 82 28 72Z" fill="#26262c"/>
${face({ iris: "#4a3226", girl: true, mood: "senyum" })}
<path d="M28 50 Q28 25 50 25 Q72 25 72 50 Q68 33 50 31 Q32 33 28 50Z" fill="#141417" stroke="#2e2e34" stroke-width=".6"/>
<path d="M36 21 q14 -6 28 0" stroke="#34343c" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}
function nabila() {
  return `
<path d="M70 76 q10 2 11 12 l0 14 q-4 2 -9 0z" fill="#1d1d22" stroke="${INK}" stroke-width=".8"/>
${legs("#5d4a86", "#463768", "#6a5690", "#3a2e52", true)}
<rect x="57" y="110" width="8" height="8" rx="1" fill="#54427a" stroke="#3b2e58" stroke-width=".6"/>
<path d="M29 72 Q50 66 71 72 L72 104 L28 104Z" fill="#bfa8e8" stroke="${INK}" stroke-width=".8"/>
<path d="M43 70 L57 70 L56 104 L44 104Z" fill="#17171b"/><path d="M43 70 L44 104 M57 70 L56 104" stroke="#9c84cf" stroke-width="1.6"/>
<path d="M33 95 h8 M59 95 h8" stroke="#9c84cf" stroke-width="1.2"/><path d="M28 101 h44" stroke="#9c84cf" stroke-width="2.4"/>
<path d="M35 72 v30 M65 72 v30" stroke="#18181c" stroke-width="2"/>
${badge(61, 83)}
${torchArm({ sleeve: "#bfa8e8", sleeveSh: "#9c84cf", torch: "#2a2a2e" })}
${freeArm({ sleeve: "#bfa8e8", sleeveSh: "#9c84cf" })}
<path d="M22 54 Q20 15 50 15 Q80 15 78 54 Q80 66 72 70 L28 70 Q20 66 22 54Z" fill="#c4adec" stroke="${INK}" stroke-width="1"/>
<path d="M40 66 h20 v6 h-20z" fill="#17171b"/>
<path d="M26 66 Q50 82 76 68 Q80 76 70 80 Q50 88 30 80 Q22 74 26 66Z" fill="#b39ae0" stroke="${INK}" stroke-width=".8"/>
<path d="M32 74 Q50 82 70 74" stroke="#9c84cf" stroke-width="1.2" fill="none"/>
${face({ iris: "#8a6234", girl: true, mood: "senyum" })}
<path d="M28 50 Q28 25 50 25 Q72 25 72 50 Q68 33 50 31 Q32 33 28 50Z" fill="#c4adec" stroke="#9c84cf" stroke-width=".6"/>
<path d="M36 21 q14 -6 28 0" stroke="#ddd0f6" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}
const BODIES: Record<CharId, () => string> = { raka, aisyah, qila, nabila };

export function characterSvg(id: CharId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 0 112 142"><ellipse cx="50" cy="138" rx="26" ry="3.5" fill="#000" opacity=".35"/><g class="hm-body" style="transform-origin:50px 138px">${BODIES[id]()}</g></svg>`;
}

export function ghostSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200">
<defs><radialGradient id="gg" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".7" stop-color="#dfe3ea" stop-opacity=".8"/><stop offset="1" stop-color="#b9c0cc" stop-opacity=".35"/></radialGradient></defs>
<path d="M30 70 Q8 100 4 150 Q14 140 18 126" stroke="url(#gg)" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M130 70 Q152 100 156 150 Q146 140 142 126" stroke="url(#gg)" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M2 150 l-2 10 M6 152 l2 10 M10 150 l6 8" stroke="#d6dbe3" stroke-width="3" stroke-linecap="round"/>
<path d="M158 150 l2 10 M154 152 l-2 10 M150 150 l-6 8" stroke="#d6dbe3" stroke-width="3" stroke-linecap="round"/>
<path d="M80 6 C34 6 24 50 26 96 C28 130 22 160 16 180 C30 170 36 190 50 178 C60 194 70 176 80 190 C92 176 102 194 112 178 C124 190 132 170 144 180 C138 160 132 130 134 96 C136 50 126 6 80 6Z" fill="url(#gg)"/>
<path d="M30 160 C40 150 50 168 62 156 C74 168 86 150 98 162 C110 150 120 168 132 158" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" fill="none"/>
<ellipse cx="58" cy="66" rx="14" ry="20" fill="#050505"/><ellipse cx="102" cy="66" rx="14" ry="20" fill="#050505"/>
<ellipse cx="80" cy="118" rx="16" ry="26" fill="#050505"/>
<ellipse cx="80" cy="124" rx="9" ry="14" fill="#1a0606"/>
</svg>`;
}

export function kuntilanakSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
<path d="M20 50 Q14 110 8 156 L92 156 Q86 110 80 50Z" fill="#ecebe6" opacity=".92"/>
<path d="M18 40 Q10 100 14 150 L30 150 Q26 90 34 56Z" fill="#070707"/><path d="M82 40 Q90 100 86 150 L70 150 Q74 90 66 56Z" fill="#070707"/>
<ellipse cx="50" cy="40" rx="20" ry="24" fill="#d9d6cf"/>
<path d="M28 44 Q24 6 50 8 Q76 6 72 44 Q68 22 62 20 L58 60 L50 30 L42 62 L38 20 Q32 22 28 44Z" fill="#050505"/>
<circle cx="45" cy="42" r="2.2" fill="#b30000"/><circle cx="56" cy="42" r="2.2" fill="#b30000"/>
<path d="M44 54 q6 4 12 0" stroke="#4a0000" stroke-width="2" fill="none"/>
</svg>`;
}

/** "Hantu Hoodie": chibi in a black hoodie, spiral red eyes, fanged grin, shadow tentacles instead of legs. */
export function hoodieSvg(): string {
  const tent = [-38, -20, -4, 12, 28, 42].map((x, i) => `<path d="M${100 + x} 150 q${i % 2 ? 14 : -14} 30 ${i % 2 ? -6 : 6} 58 q-4 10 4 14" stroke="url(#tg)" stroke-width="${12 - Math.abs(i - 2.5)}" fill="none" stroke-linecap="round"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240"><defs><radialGradient id="au"><stop offset="0" stop-color="#ff1030" stop-opacity=".5"/><stop offset="1" stop-color="#ff1030" stop-opacity="0"/></radialGradient><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140608"/><stop offset="1" stop-color="#8a0d18"/></linearGradient><radialGradient id="ey"><stop offset="0" stop-color="#fff2a0"/><stop offset=".35" stop-color="#ff2020"/><stop offset="1" stop-color="#5a0008"/></radialGradient></defs>
<ellipse cx="100" cy="150" rx="95" ry="90" fill="url(#au)"/>${tent}
<path d="M52 108 q48 -18 96 0 l10 52 q-58 16 -116 0z" fill="#121216"/><path d="M92 112 l8 30 l8 -30" stroke="#2a2a30" stroke-width="3" fill="none"/>
<path d="M62 132 q4 -6 10 0 q2 8 -5 10 q-7 -2 -5 -10z" fill="#f2f2f2"/><circle cx="65" cy="134" r="1.3" fill="#111"/><circle cx="69" cy="134" r="1.3" fill="#111"/>
<path d="M40 70 q0 -58 60 -60 q60 2 60 60 q6 30 -6 52 l-10 -20 l-6 26 l-12 -18 l-26 0 l-12 18 l-6 -26 l-10 20 q-12 -22 -6 -52z" fill="#0b0b0e"/>
<ellipse cx="100" cy="74" rx="44" ry="40" fill="#e8e1dc"/>
<path d="M58 50 q42 -34 84 0 q-10 -6 -20 4 q-10 -12 -22 0 q-12 -12 -22 0 q-10 -10 -20 -4z" fill="#0b0b0e"/>
<g stroke="#b01020" stroke-width=".8" opacity=".7"><path d="M62 70 l10 4 M62 82 l9 -3 M138 70 l-10 4 M138 82 l-9 -3"/></g>
<circle cx="82" cy="74" r="13" fill="url(#ey)"/><circle cx="118" cy="74" r="13" fill="url(#ey)"/>
<path d="M82 74 m0 -1 a2 2 0 1 1 -2 3 a5 5 0 1 1 7 -6 a8 8 0 1 1 -12 9" stroke="#3a0006" stroke-width="1.6" fill="none"/><path d="M118 74 m0 -1 a2 2 0 1 1 -2 3 a5 5 0 1 1 7 -6 a8 8 0 1 1 -12 9" stroke="#3a0006" stroke-width="1.6" fill="none"/>
<path d="M72 94 q28 22 56 0 q-28 10 -56 0z" fill="#3a0008"/><path d="M76 96 l4 7 l3 -6 l4 8 l3 -7 l4 8 l3 -8 l4 8 l3 -8 l4 7 l3 -6 l4 6" fill="#fff" stroke="#fff" stroke-width=".5"/>
</svg>`;
}

export function pocongSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
<path d="M50 4 L42 18 L58 18Z" fill="#f2f1ec"/><path d="M44 16 q6 5 12 0" stroke="#bdbab0" stroke-width="3" fill="none"/>
<path d="M30 30 Q26 20 50 18 Q74 20 70 30 Q80 80 74 150 Q50 160 26 150 Q20 80 30 30Z" fill="#f2f1ec"/>
<ellipse cx="50" cy="44" rx="15" ry="16" fill="#6e6a5e"/>
<ellipse cx="44" cy="42" rx="4" ry="5" fill="#0a0a0a"/><ellipse cx="56" cy="42" rx="4" ry="5" fill="#0a0a0a"/>
<path d="M30 70 h40 M28 110 h44 M30 146 h40" stroke="#bdbab0" stroke-width="3"/>
<path d="M50 150 L44 160 L56 160Z" fill="#f2f1ec"/>
</svg>`;
}

export function exclaimSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><path d="M20 2 L38 52 L2 52Z" fill="#c4121f" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><rect x="17" y="16" width="6" height="20" rx="3" fill="#fff"/><circle cx="20" cy="44" r="3.6" fill="#fff"/></svg>`;
}

export function keySvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><circle cx="13" cy="15" r="10" fill="none" stroke="#e8b730" stroke-width="5"/><rect x="21" y="12" width="34" height="6" fill="#e8b730"/><rect x="42" y="16" width="5" height="9" fill="#e8b730"/><rect x="50" y="16" width="5" height="7" fill="#e8b730"/></svg>`;
}

export function batterySvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 50"><rect x="10" y="1" width="10" height="5" rx="1" fill="#9aa"/><rect x="3" y="5" width="24" height="43" rx="4" fill="#1d2b1d" stroke="#79e07a" stroke-width="3"/><rect x="8" y="12" width="14" height="9" fill="#79e07a"/><rect x="8" y="23" width="14" height="9" fill="#79e07a"/><rect x="8" y="34" width="14" height="9" fill="#79e07a"/></svg>`;
}

export function emblemSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="96" fill="#1a130c" stroke="#d8ae45" stroke-width="6"/>
<circle cx="100" cy="100" r="84" fill="none" stroke="#d8ae45" stroke-width="2" stroke-dasharray="4 5"/>
<circle cx="100" cy="100" r="62" fill="#0d0a08" stroke="#8a6a24" stroke-width="2"/>
<path d="M86 78 a26 26 0 1 0 30 40 a21 21 0 1 1 -30 -40z" fill="#d8ae45"/>
<g transform="translate(122 84)"><path d="M-9 8 q-3 14 -6 20 M-4 10 q-1 14 -3 22 M0 10 v24 M4 10 q1 14 3 22 M9 8 q3 14 6 20" stroke="#2a0d12" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M-15 4 q-2 -26 15 -28 q17 2 15 28 q-15 8 -30 0z" fill="#0b0809" stroke="#d8ae45" stroke-width="1.2"/><ellipse cx="0" cy="-2" rx="9" ry="10" fill="#e9e4da"/><circle cx="-3.6" cy="-4" r="2.4" fill="#ff1a1a"/><circle cx="3.6" cy="-4" r="2.4" fill="#ff1a1a"/><circle cx="-3.6" cy="-4" r=".9" fill="#300"/><circle cx="3.6" cy="-4" r=".9" fill="#300"/><path d="M-5 3 q5 4 10 0 q-5 2 -10 0z" fill="#600"/><path d="M-3 3 l1 3 l1 -3 M1 3 l1 3 l1 -3" fill="#fff"/></g>
${[[60, 64], [140, 128], [74, 140], [146, 92]].map(([x, y]) => `<path d="M${x} ${y! - 4} l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2 l2.8 -1.2z" fill="#d8ae45"/>`).join("")}
<path id="ta" d="M30 100 A70 70 0 0 1 170 100" fill="none"/><path id="tb" d="M24 100 A76 76 0 0 0 176 100" fill="none"/>
<text font-family="Creepster, fantasy" font-size="30" fill="#d8ae45" letter-spacing="4" text-anchor="middle"><textPath href="#ta" startOffset="50%">HANTU</textPath></text>
<text font-family="Creepster, fantasy" font-size="30" fill="#d8ae45" letter-spacing="4" text-anchor="middle"><textPath href="#tb" startOffset="50%">MALAM</textPath></text>
</svg>`;
}

export function logoSvg(): string {
  const inner = (s: string) => s.replace(/<svg[^>]*>/, "").replace("</svg>", "");
  const hunters = (["aisyah", "raka", "qila", "nabila"] as CharId[])
    .map((id, i) => `<g transform="translate(${[40, 150, 300, 410][i]} ${i === 1 || i === 2 ? 236 : 250}) scale(1.05)">${inner(characterSvg(id))}</g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 420">
<defs><radialGradient id="lgbg" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#3a1424"/><stop offset="1" stop-color="#060307"/></radialGradient></defs>
<rect width="560" height="420" fill="url(#lgbg)"/>
<circle cx="480" cy="56" r="26" fill="#e9e2cf" opacity=".8"/>
<g transform="translate(170 10) scale(1.1)">${inner(emblemSvg())}</g>
${hunters}
<rect y="388" width="560" height="32" fill="#000" opacity=".6"/>
<text x="280" y="412" text-anchor="middle" font-family="'Special Elite', monospace" font-size="20" fill="#e7d9f3" letter-spacing="6">MABAR HOROR</text>
</svg>`;
}

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function loadImg(svg: string): HTMLImageElement {
  const img = new Image();
  img.src = svgUrl(svg);
  return img;
}
