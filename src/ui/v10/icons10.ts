// MoriOS V10 pixel art in the desktop's glossy aero style (see ../v7/aeroFx icon()): the Upload
// Everything crate, the Zealandia Encyclopedia, ZEA Mail and the Skill Tree icons, the encyclopedia's
// category and place-kind icons, the agency mascot (Tua the tuatara in a pith helmet) and the research
// crate the samples drop into.

import { canvas, R, E, outline, copyCanvas } from '../v7/aeroFx';

type G = CanvasRenderingContext2D;

/** vertical gradient of hard colour bands */
function bands(g: G, y0: number, y1: number, cols: string[]) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  cols.forEach((c, i) => { gr.addColorStop(i / cols.length, c); gr.addColorStop((i + 1) / cols.length - 0.001, c); });
  return gr;
}
function rrect(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function orb(g: G, cx: number, cy: number, r: number, cols: string[], hi = 0.6) {
  g.fillStyle = bands(g, cy - r, cy + r, cols);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(255,255,255,${hi})`;
  g.beginPath(); g.ellipse(cx, cy - r * 0.42, r * 0.66, r * 0.4, 0, 0, Math.PI * 2); g.fill();
}
function gloss(g: G, x: number, y: number, w: number, h: number, a = 0.45) {
  g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, w, h); g.restore();
}
function poly(g: G, pts: number[], fill: string | CanvasGradient) {
  g.fillStyle = fill;
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath(); g.fill();
}
function hardAlpha(g: G, w: number, h: number) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = a < 90 ? 0 : a > 200 ? 255 : a; }
  g.putImageData(d, 0, 0);
}

const AQUA = ['#e8fdff', '#a6f0ff', '#5ad6f4', '#22b4e2', '#1492cc', '#46cff5'];
const GREEN = ['#f0ffe2', '#c2f59a', '#82dc52', '#4cb42c', '#34921c', '#74d84a'];
const GOLD = ['#fff8d0', '#ffe68a', '#ffd048', '#f0ae22', '#d08c14', '#ffd65a'];
const CHROME = ['#ffffff', '#eef3f7', '#cfdae3', '#a9b8c6', '#8494a6', '#c9d5df'];
const RED = ['#ffe0d8', '#ff9a80', '#ec4a30', '#c42e18', '#ff7a5a'];
const WOOD = ['#ffe2a0', '#f0c060', '#d89a38', '#b87824', '#e8b050'];
const VIOLET = ['#f6eeff', '#d8c4ff', '#a888f0', '#7a5ad0', '#5a3ab0', '#b49aff'];

const upArrow = (g: G, x: number, y: number, c = '#fff') => {
  R(g, x, y, 2, 1, c); R(g, x - 1, y + 1, 4, 1, c); R(g, x - 2, y + 2, 6, 1, c); R(g, x, y + 3, 2, 4, c);
};

const DRAW: Record<string, (g: G) => void> = {
  // ---- desktop icons
  upall: g => {
    g.fillStyle = bands(g, 10, 22, WOOD); rrect(g, 2, 10, 20, 12, 2); g.fill();
    R(g, 3, 14, 18, 1, '#a8681c'); R(g, 3, 18, 18, 1, '#a8681c');
    R(g, 4, 10, 2, 12, '#c47e28'); R(g, 18, 10, 2, 12, '#c47e28');
    g.fillStyle = bands(g, 8, 12, ['#fff0c0', '#f4c868', '#dca044']); rrect(g, 1, 8, 22, 4, 1.5); g.fill();
    gloss(g, 1, 8, 22, 2, 0.4);
    orb(g, 12, 7, 6.2, AQUA, 0.5);
    upArrow(g, 11, 3);
  },
  enc: g => {
    R(g, 5, 4, 16, 17, '#f6efdc');
    for (const y of [7, 10, 13, 16]) R(g, 18, y, 3, 1, '#d8cbb0');
    g.fillStyle = bands(g, 2, 21, ['#86e07a', '#4cb44c', '#2c8c3c', '#1d7030', '#3a9a4a']); rrect(g, 3, 2, 16, 19, 2); g.fill();
    R(g, 3, 2, 3, 19, '#145a24'); R(g, 6, 2, 1, 19, '#2c8c3c');
    orb(g, 12.5, 10.5, 4.6, GOLD, 0.45);
    E(g, 12.5, 10.8, 1.6, 2.8, '#2a8a3a'); R(g, 12, 9, 1, 4, '#9ae86a');
    R(g, 9, 17, 7, 1, '#ffd65a');
    gloss(g, 3, 2, 16, 4, 0.32);
    R(g, 15, 20, 2, 3, '#e8483a'); R(g, 15, 23, 1, 1, '#e8483a');
  },
  mail: g => {
    g.fillStyle = bands(g, 6, 20, ['#ffffff', '#f4f9fd', '#e4eff8', '#d4e6f4']); rrect(g, 2, 6, 20, 14, 2); g.fill();
    poly(g, [2.5, 6.5, 21.5, 6.5, 12, 14], '#eaf4fc');
    g.strokeStyle = '#8aaac4'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(3, 7); g.lineTo(12, 14); g.lineTo(21, 7); g.stroke();
    g.beginPath(); g.moveTo(3, 19); g.lineTo(9, 13); g.moveTo(21, 19); g.lineTo(15, 13); g.stroke();
    orb(g, 12, 14, 3.8, RED, 0.45);
    R(g, 11, 13, 3, 1, '#fff'); R(g, 12, 14, 1, 1, '#fff'); R(g, 11, 15, 3, 1, '#fff');
  },
  skills: g => {
    g.strokeStyle = '#7a4a1a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 22); g.lineTo(12, 10); g.moveTo(12, 15); g.lineTo(5.5, 11.5); g.moveTo(12, 14); g.lineTo(18.5, 11.5); g.stroke();
    R(g, 7, 21, 10, 2, '#5cc43c'); R(g, 8, 21, 8, 1, '#a6e86a');
    orb(g, 5, 11, 3.8, AQUA, 0.55);
    orb(g, 19, 11, 3.8, VIOLET, 0.55);
    orb(g, 12, 6, 5, GOLD, 0.5);
    R(g, 12, 3, 1, 6, '#fff'); R(g, 9, 5, 7, 1, '#fff'); R(g, 10, 4, 5, 3, 'rgba(255,255,255,0.35)');
  },
  // ---- encyclopedia categories
  c_fauna: g => {
    orb(g, 12, 12, 10, AQUA, 0.42);
    E(g, 12, 15, 4.2, 3.4, '#0a5f8e');
    for (const [x, y] of [[6.5, 10], [10, 7.2], [14, 7.2], [17.5, 10]]) E(g, x, y, 1.8, 2.2, '#0a5f8e');
  },
  c_flora: g => {
    g.save(); g.translate(12, 11); g.rotate(-0.65);
    g.fillStyle = bands(g, -10, 10, GREEN); g.beginPath(); g.ellipse(0, 0, 5.8, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a7a1a'; g.fillRect(-0.5, -8, 1, 17);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-3.5, -6, 1, 5);
    g.restore();
    R(g, 4, 19, 2, 3, '#2a7a1a'); R(g, 5, 18, 2, 2, '#2a7a1a');
  },
  c_culture: g => {
    g.fillStyle = bands(g, 18, 23, CHROME); rrect(g, 4, 18, 16, 4, 1); g.fill();
    R(g, 6, 17, 12, 1, '#a9b8c6');
    g.fillStyle = bands(g, 4, 17, ['#ffe0a8', '#f0b060', '#d0843a', '#a8622a', '#e8a050']);
    g.beginPath(); g.moveTo(9, 3); g.lineTo(15, 3); g.lineTo(14, 6); g.quadraticCurveTo(19, 9, 17, 14); g.lineTo(15, 17); g.lineTo(9, 17); g.lineTo(7, 14); g.quadraticCurveTo(5, 9, 10, 6); g.closePath(); g.fill();
    R(g, 8, 10, 8, 1, '#7a4218'); R(g, 8, 12, 8, 1, '#ffe0a8');
    R(g, 9, 7, 2, 4, 'rgba(255,255,255,0.6)');
  },
  c_fossils: g => {
    g.fillStyle = bands(g, 2, 22, ['#f4ead4', '#e2d2b0', '#cbb68c', '#b49a70', '#d8c49c']); g.beginPath(); g.arc(12, 12, 10, 0, Math.PI * 2); g.fill();
    for (let t = 0; t < Math.PI * 4.2; t += 0.12) { const r = 8.6 - t * 0.6; if (r < 0.8) break; R(g, Math.round(12 + Math.cos(t) * r), Math.round(12 + Math.sin(t) * r), 1, 1, '#7a6040'); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; R(g, Math.round(12 + Math.cos(a) * 9), Math.round(12 + Math.sin(a) * 9), 1, 1, '#9a8058'); }
    R(g, 6, 5, 3, 1, 'rgba(255,255,255,0.7)');
  },
  c_samples: g => {
    g.fillStyle = 'rgba(200,240,255,0.75)'; rrect(g, 8.5, 3, 7, 19, 3.5); g.fill();
    g.fillStyle = bands(g, 11, 22, ['#c2f59a', '#82dc52', '#4cb42c', '#34921c']); rrect(g, 8.5, 11, 7, 11, 3.5); g.fill();
    R(g, 10, 14, 1, 1, '#fff'); R(g, 13, 17, 1, 1, '#fff'); R(g, 11, 19, 1, 1, '#e8ffe0');
    g.fillStyle = bands(g, 1, 4, CHROME); rrect(g, 7, 1.5, 10, 3, 1); g.fill();
    R(g, 9.5, 5, 1, 6, 'rgba(255,255,255,0.85)');
  },
  c_places: g => {
    for (let i = 0; i < 3; i++) R(g, 2 + i * 7, 9 + (i % 2), 7, 12, i % 2 ? '#e4d8b0' : '#f4ecd0');
    E(g, 8, 15, 4, 3, '#8ad06a'); E(g, 17, 17, 3, 2, '#8ad06a');
    for (let x = 4; x < 20; x += 3) R(g, x, 18 - (x % 2), 2, 1, '#c84a3a');
    orb(g, 15, 7, 4.8, RED, 0.5);
    poly(g, [11.2, 9, 18.8, 9, 15, 15.5], '#c42e18');
    E(g, 15, 7, 1.6, 1.6, '#fff');
  },
  // ---- place kinds (encyclopedia thumbnails)
  k_camp: g => {
    poly(g, [2, 20, 12, 5, 22, 20], bands(g, 5, 20, ['#ffcf6a', '#f0a030', '#d07818']));
    poly(g, [9, 20, 12, 12, 15, 20], '#5a3010');
    R(g, 1, 20, 22, 2, '#8a6a3a');
    R(g, 12, 3, 1, 3, '#7a4a1a'); R(g, 13, 3, 3, 2, '#e8483a');
  },
  k_village: g => {
    R(g, 1, 20, 22, 2, '#6aa83a');
    for (const [x, w, h] of [[2, 9, 8], [12, 10, 10]]) {
      R(g, x + 1, 20 - h + 4, w - 2, h - 4, '#c89058'); R(g, x + 1, 20 - h + 4, w - 2, 1, '#e8b880');
      poly(g, [x - 1, 20 - h + 5, x + w / 2, 20 - h - 1, x + w + 1, 20 - h + 5], bands(g, 20 - h - 1, 20 - h + 5, ['#e0b070', '#a86a28']));
      R(g, x + Math.floor(w / 2) - 1, 16, 2, 4, '#4a2a10');
    }
  },
  k_ruin: g => {
    R(g, 1, 20, 22, 2, '#8a8a7a');
    g.fillStyle = bands(g, 4, 20, ['#f0ece0', '#d8d2c0', '#bab2a0', '#d0c8b4']);
    g.beginPath(); g.moveTo(5, 20); g.lineTo(5, 7); g.lineTo(8, 4); g.lineTo(10, 6); g.lineTo(11, 5); g.lineTo(11, 20); g.closePath(); g.fill();
    R(g, 4, 18, 8, 2, '#a8a090');
    for (const y of [9, 12, 15]) R(g, 6, y, 1, 2, '#a8a090');
    g.fillStyle = bands(g, 13, 20, ['#e6e0d0', '#bab2a0']); rrect(g, 14, 16, 7, 4, 1); g.fill();
    R(g, 13, 19, 3, 1, '#a8a090'); R(g, 19, 13, 3, 3, '#d0c8b4');
  },
  k_cave: g => {
    g.fillStyle = bands(g, 3, 22, ['#c8c4bc', '#a8a49c', '#8a8680', '#6e6a66']);
    g.beginPath(); g.moveTo(1, 22); g.quadraticCurveTo(3, 4, 12, 3); g.quadraticCurveTo(21, 4, 23, 22); g.closePath(); g.fill();
    g.fillStyle = '#141820'; g.beginPath(); g.moveTo(7, 22); g.quadraticCurveTo(8, 11, 12, 10); g.quadraticCurveTo(16, 11, 17, 22); g.closePath(); g.fill();
    R(g, 10, 14, 1, 1, '#7ae6c8'); R(g, 13, 13, 1, 1, '#7ae6c8'); R(g, 12, 16, 1, 1, '#4ac8b0');
    R(g, 5, 7, 3, 1, 'rgba(255,255,255,0.6)');
  },
  k_ecosystem: g => {
    R(g, 11, 13, 3, 9, '#7a4a1a'); R(g, 1, 21, 22, 2, '#5cb43a');
    g.fillStyle = bands(g, 2, 16, GREEN);
    for (const [x, y, r] of [[12, 8, 6.5], [6.5, 12, 4.6], [17.5, 12, 4.6]] as const) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    R(g, 9, 4, 3, 1, 'rgba(255,255,255,0.6)'); R(g, 15, 9, 1, 1, '#e8483a'); R(g, 7, 13, 1, 1, '#ffd048');
  },
  k_ocean: g => {
    g.fillStyle = bands(g, 4, 22, ['#bfe9ff', '#7ad0f8', '#3aa8e6', '#1a80c8', '#0a5f9e']); rrect(g, 1, 4, 22, 18, 3); g.fill();
    for (const [y, o] of [[9, 0], [14, 3], [19, 1]]) for (let x = 2 + o; x < 22; x += 6) { R(g, x, y, 3, 1, '#fff'); R(g, x + 3, y + 1, 1, 1, '#e8fdff'); }
  },
  k_island: g => {
    g.fillStyle = bands(g, 15, 23, ['#7ad0f8', '#3aa8e6', '#1a80c8']); g.fillRect(0, 17, 24, 6);
    E(g, 12, 18, 9, 3.4, '#f4dc94');
    R(g, 11, 8, 2, 10, '#9a6a2a'); R(g, 12, 8, 1, 10, '#c88a48');
    for (const [dx, dy] of [[-6, 2], [-4, -1], [4, -1], [6, 2]]) poly(g, [12, 8, 12 + dx, 8 + dy, 12 + dx * 0.6, 8 + dy + 2], '#4cb42c');
    E(g, 12, 8, 2, 1.6, '#82dc52');
  },
  k_landmark: g => {
    g.fillStyle = bands(g, 12, 22, ['#a6e86a', '#6cc83c', '#4aa628']); g.beginPath(); g.moveTo(1, 22); g.quadraticCurveTo(12, 8, 23, 22); g.closePath(); g.fill();
    R(g, 11, 3, 2, 12, '#5a3a18');
    poly(g, [13, 3, 21, 5.5, 13, 8], bands(g, 3, 8, RED));
  },
};
DRAW.k_location = DRAW.c_places;
DRAW.k_site = DRAW.k_landmark;
DRAW.k_fossil = DRAW.c_fossils;

/** a V10 icon (24 px art) at the given scale, or null if the name is not one of these */
const srcs = new Map<string, HTMLCanvasElement>();
export function icon10(name: string, scale = 2): HTMLCanvasElement | null {
  const draw = DRAW[name];
  if (!draw) return null;
  let s = srcs.get(name);
  if (!s) { s = canvas(24, 24, g => { draw(g); hardAlpha(g, 24, 24); outline(g, 24, 24, '#15405e'); }); srcs.set(name, s); }
  const c = copyCanvas(s);
  c.style.width = c.style.height = 24 * scale + 'px';
  c.className = 'pxi';
  return c;
}
const urls = new Map<string, string>();
export function icon10URL(name: string): string {
  let u = urls.get(name);
  if (!u) { const c = icon10(name, 1); u = c ? c.toDataURL() : ''; urls.set(name, u); }
  return u;
}

// ------------------------------------------------------------------ Tua, the agency mascot

/** Tua the tuatara in a ZEA pith helmet (40x40 art); mood changes the eyes and mouth */
const tuas = new Map<string, HTMLCanvasElement>();
export function mascot(mood: 'happy' | 'wow' | 'meh' | 'wink' = 'happy', scale = 2): HTMLCanvasElement {
  let src = tuas.get(mood);
  if (!src) { src = paintTua(mood); tuas.set(mood, src); }
  const c = copyCanvas(src);
  c.style.width = c.style.height = 40 * scale + 'px';
  c.className = 'pxi mascot';
  return c;
}
function paintTua(mood: 'happy' | 'wow' | 'meh' | 'wink'): HTMLCanvasElement {
  return canvas(40, 40, g => {
    const G1 = '#7cae52', G2 = '#5a8c3a', G3 = '#3e6a28', BELLY = '#d4e2a4';
    // neck and the ZEA scarf
    R(g, 9, 27, 17, 12, G2); R(g, 11, 29, 2, 2, G3); R(g, 16, 33, 2, 2, G3); R(g, 21, 30, 2, 2, G3);
    R(g, 9, 27, 19, 3, '#22b4e2'); R(g, 9, 27, 19, 1, '#8aeaff'); R(g, 24, 30, 3, 5, '#1492cc');
    // crest spines down the back of the head and neck
    for (let i = 0; i < 6; i++) poly(g, [8, 12 + i * 4, 3 - (i % 2), 13 + i * 4, 8, 16 + i * 4], '#f2eecc');
    // head and snout
    E(g, 18, 19, 11, 9, (nx, ny) => (ny < -0.5 && nx < 0.2 ? G1 : ny > 0.55 ? G3 : G2));
    E(g, 28, 21, 9.5, 6.2, (nx, ny) => (ny < -0.3 ? G1 : G2));
    E(g, 27, 24.5, 9, 2.6, BELLY);
    for (const [x, y] of [[13, 23], [17, 25], [21, 15], [10, 18]]) R(g, x, y, 2, 1, G3);
    R(g, 35, 19, 1, 1, '#22301a');
    // eye
    if (mood === 'wink') { R(g, 15, 17, 6, 1, '#1a1012'); R(g, 14, 16, 1, 1, '#1a1012'); R(g, 21, 16, 1, 1, '#1a1012'); }
    else {
      E(g, 18, 17, 4.2, mood === 'wow' ? 4.6 : 4, '#ffffff');
      E(g, 19, mood === 'meh' ? 18 : 17, 2.2, mood === 'meh' ? 1.6 : 2.8, '#1a1012');
      R(g, 17, 15, 2, 2, '#ffffff');
      if (mood === 'meh') R(g, 14, 14, 8, 1, G3);
    }
    // mouth
    if (mood === 'wow') { E(g, 31, 24, 2.4, 1.8, '#5a1a1a'); R(g, 30, 23, 2, 1, '#e87a8a'); }
    else if (mood === 'meh') R(g, 26, 24, 9, 1, G3);
    else { R(g, 25, 24, 9, 1, G3); R(g, 34, 23, 1, 1, G3); R(g, 24, 23, 1, 1, G3); }
    E(g, 14, 22, 2, 1.3, 'rgba(255,140,150,0.55)');
    // the pith helmet
    E(g, 18, 10, 11, 7.5, (nx, ny) => (ny > 0.15 ? null : nx < -0.3 && ny < -0.5 ? '#fff6d8' : ny < -0.4 ? '#f0e2b4' : '#dcc890'));
    R(g, 5, 10, 27, 3, '#c8b078'); R(g, 5, 10, 27, 1, '#f0e2b4'); R(g, 7, 12, 23, 1, '#9a8048');
    R(g, 9, 8, 19, 2, '#7a5a2a');
    E(g, 18, 8.6, 2, 1.8, '#22c4e6'); R(g, 17, 8, 1, 1, '#e8fdff');
    outline(g, 40, 40, '#1a2e12');
  });
}

// ------------------------------------------------------------------ the research crate (Upload Everything)

/** the open research crate at camp (56x44 art) */
export function crateArt(scale = 2): HTMLCanvasElement {
  const c = canvas(56, 44, g => {
    // lid leaning open behind
    poly(g, [6, 16, 10, 3, 50, 3, 50, 16], bands(g, 3, 16, ['#f6cf84', '#e0a85a', '#c48238']));
    R(g, 10, 7, 40, 1, '#a8681c'); R(g, 9, 11, 41, 1, '#a8681c');
    // inside
    R(g, 6, 15, 44, 5, '#3a240e'); R(g, 6, 15, 44, 1, '#5a3a18');
    // body
    g.fillStyle = bands(g, 18, 42, WOOD); g.fillRect(4, 18, 48, 24);
    R(g, 4, 26, 48, 1, '#a8681c'); R(g, 4, 34, 48, 1, '#a8681c');
    R(g, 4, 18, 4, 24, '#c47e28'); R(g, 48, 18, 4, 24, '#c47e28'); R(g, 4, 18, 48, 2, '#ffe2a0');
    // stencil label
    R(g, 18, 28, 20, 8, '#f4e4c0'); R(g, 18, 28, 20, 1, '#fffaf0');
    for (const [x, w] of [[20, 4], [25, 3], [29, 4], [34, 2]]) R(g, x, 31, w, 2, '#7a4a18');
    R(g, 39, 29, 3, 3, '#22b4e2');
    for (const [x, y] of [[6, 21], [49, 21], [6, 38], [49, 38]]) R(g, x, y, 1, 1, '#7a4a18');
    outline(g, 56, 44, '#3a2008');
  });
  c.style.width = 56 * scale + 'px';
  c.style.height = 44 * scale + 'px';
  c.className = 'pxi crate-art';
  return c;
}
