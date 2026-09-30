// Shared bits for the glossy "aero" desktop: springs, a pixel particle layer (sparkles, bubbles,
// confetti, ripples, cursor trail), procedurally painted glossy pixel icons and the UI sound palette.

import { audio } from '../../core/audio';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Damped spring (semi-implicit Euler, sub-stepped so stiff springs stay stable at low fps). */
export class Spring {
  v = 0;
  target: number;
  constructor(public x: number, public k = 260, public d = 20) { this.target = x; }
  step(dt: number) {
    let t = Math.min(dt, 0.25);
    while (t > 0) {
      const h = Math.min(t, 1 / 120);
      this.v += (-this.k * (this.x - this.target) - this.d * this.v) * h;
      this.x += this.v * h;
      t -= h;
    }
  }
  rest(eps = 0.002) { return Math.abs(this.v) < eps * 20 && Math.abs(this.x - this.target) < eps; }
  snap(v = this.target) { this.x = this.target = v; this.v = 0; }
}

// ------------------------------------------------------------------ sounds (the game's own synth)

export const sfx = {
  hover: () => audio.play('dialogBlip', { vol: 0.5, pitch: 2.3 + Math.random() * 0.2 }),
  press: () => audio.play('bubblePop', { vol: 0.32, pitch: 1.05 + Math.random() * 0.25 }),
  click: () => audio.play('ui', { vol: 0.26, pitch: 1.2 }),
  open: () => { audio.play('uiOpen', { vol: 0.34, pitch: 1.12 }); audio.play('bubble', { vol: 0.14, pitch: 1.5 }); },
  close: () => audio.play('uiBack', { vol: 0.34, pitch: 1.1 }),
  min: () => audio.play('whoosh', { vol: 0.2, pitch: 1.7 }),
  restore: () => audio.play('whoosh', { vol: 0.18, pitch: 2.2 }),
  menu: () => audio.play('ui', { vol: 0.22, pitch: 1.55 }),
  pick: () => audio.play('collectPop', { vol: 0.3, pitch: 1.1 }),
  bad: () => audio.play('wrong', { vol: 0.34 }),
  tick: (i: number) => audio.play('dialogBlip', { vol: 0.7, pitch: 1.2 + i * 0.06 }),
  pop: (i = 0) => audio.play('bubblePop', { vol: 0.4, pitch: 0.9 + Math.min(i, 14) * 0.07 + Math.random() * 0.05 }),
  bubbles: () => audio.play('bubble', { vol: 0.28, pitch: 1.3 }),
  win: () => { audio.play('skillUnlock', { vol: 0.5 }); setTimeout(() => audio.play('discover', { vol: 0.45 }), 380); },
  unlock: () => audio.play('discover', { vol: 0.45 }),
  star: () => audio.play('star', { vol: 0.45 }),
  bark: () => audio.play('callBark', { vol: 0.35, pitch: 1.7 }),
  type: () => audio.play('typing', { vol: 0.22 }),
  beep: () => audio.play('scanBeep', { vol: 0.3 }),
};

// ------------------------------------------------------------------ pixel painting

export function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
export function R(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(x, y, w, h); }
export function E(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number) => string | null)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const v = typeof c === 'string' ? c : c(nx, ny);
    if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); }
  }
}
/** hard-edge the alpha (kills antialiasing fuzz, keeps deliberate glass translucency) */
function hardAlpha(g: CanvasRenderingContext2D, w: number, h: number) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = a < 90 ? 0 : a > 200 ? 255 : a; }
  g.putImageData(d, 0, 0);
}
export function outline(g: CanvasRenderingContext2D, w: number, h: number, col = '#1a1014') {
  const d = g.getImageData(0, 0, w, h);
  const src = d.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  const [r, gg, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (op(x, y)) continue;
    if (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1)) { const i = (y * w + x) * 4; d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = 255; }
  }
  g.putImageData(d, 0, 0);
}
/** vertical gradient built from hard colour bands (the pixel-art take on glossy gel) */
function bands(g: CanvasRenderingContext2D, y0: number, y1: number, cols: string[]) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  cols.forEach((c, i) => { gr.addColorStop(i / cols.length, c); gr.addColorStop((i + 1) / cols.length - 0.001, c); });
  return gr;
}
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
const AQUA = ['#e8fdff', '#a6f0ff', '#5ad6f4', '#22b4e2', '#1492cc', '#46cff5'];
const GREEN = ['#f0ffe2', '#c2f59a', '#82dc52', '#4cb42c', '#34921c', '#74d84a'];
const GOLD = ['#fff8d0', '#ffe68a', '#ffd048', '#f0ae22', '#d08c14', '#ffd65a'];
const CHROME = ['#ffffff', '#eef3f7', '#cfdae3', '#a9b8c6', '#8494a6', '#c9d5df'];
const PINK = ['#fff0f8', '#ffc4e4', '#ff8cc8', '#ee5aa8', '#cc3a8a', '#ff9ad2'];
function orb(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, cols: string[], hi = 0.62) {
  g.fillStyle = bands(g, cy - r, cy + r, cols);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(255,255,255,${hi})`;
  g.beginPath(); g.ellipse(cx, cy - r * 0.42, r * 0.66, r * 0.4, 0, 0, Math.PI * 2); g.fill();
}
function gloss(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0.45) {
  g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, w, h); g.restore();
}
const ICON_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  report: g => {
    g.fillStyle = bands(g, 1, 22, ['#ffffff', '#f6fbff', '#eaf4fc', '#dcecf8']);
    g.beginPath(); g.moveTo(4, 1); g.lineTo(15, 1); g.lineTo(19, 5); g.lineTo(19, 22); g.lineTo(4, 22); g.closePath(); g.fill();
    R(g, 15, 1, 1, 4, '#b8d4ea'); R(g, 15, 4, 4, 1, '#b8d4ea'); R(g, 16, 2, 1, 2, '#d8e8f4'); R(g, 17, 3, 1, 1, '#d8e8f4');
    R(g, 6, 4, 8, 1, '#8fd0ff'); R(g, 6, 5, 8, 2, '#2f8ee0');
    for (const y of [9, 12, 15]) R(g, 6, y, 11, 1, '#9ab4c8');
    R(g, 6, 18, 5, 1, '#9ab4c8');
    orb(g, 17, 17.5, 5, GREEN);
    R(g, 14, 17, 1, 1, '#fff'); R(g, 15, 18, 1, 1, '#fff'); R(g, 16, 19, 1, 1, '#fff'); R(g, 17, 18, 1, 1, '#fff'); R(g, 18, 17, 1, 1, '#fff'); R(g, 19, 16, 1, 1, '#fff');
  },
  sheet: g => {
    g.fillStyle = bands(g, 2, 22, GREEN); rrect(g, 2, 2, 20, 20, 4); g.fill();
    R(g, 5, 8, 14, 11, '#f6fff0');
    for (const x of [9, 14]) R(g, x, 8, 1, 11, '#7cc85a');
    for (const y of [11, 14, 17]) R(g, 5, y, 14, 1, '#7cc85a');
    R(g, 15, 15, 3, 2, '#3aa0e8'); R(g, 10, 12, 3, 5, '#3aa0e8'); R(g, 6, 15, 2, 2, '#3aa0e8');
    R(g, 10, 12, 3, 1, '#9ad8ff'); R(g, 15, 15, 3, 1, '#9ad8ff');
    gloss(g, 2, 2, 20, 5, 0.45);
    R(g, 5, 3, 3, 1, '#fff');
  },
  photo: g => {
    g.fillStyle = bands(g, 2, 17, CHROME); g.fillRect(6, 2, 16, 14);
    g.fillStyle = bands(g, 5, 22, ['#ffffff', '#f4f8fb', '#e4ecf2']); g.fillRect(2, 6, 17, 16);
    g.fillStyle = bands(g, 8, 16, ['#bfe9ff', '#8fd6fa', '#5cbcf0', '#3aa4e6']); g.fillRect(4, 8, 13, 9);
    g.fillStyle = bands(g, 13, 20, ['#a6e86a', '#6cc83c', '#4aa628']);
    g.beginPath(); g.moveTo(4, 15); g.quadraticCurveTo(9, 11, 17, 14); g.lineTo(17, 20); g.lineTo(4, 20); g.closePath(); g.fill();
    R(g, 6, 9, 3, 1, '#fff'); R(g, 11, 10, 4, 1, '#fff'); R(g, 13, 9, 2, 1, '#fff');
    R(g, 3, 7, 4, 1, 'rgba(255,255,255,0.9)');
  },
  disc: g => {
    g.strokeStyle = '#3a4a5a'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(15, 15); g.lineTo(20.5, 20.5); g.stroke();
    g.strokeStyle = '#8898aa'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(15.5, 15.5); g.lineTo(20, 20); g.stroke();
    orb(g, 10, 10, 8.4, CHROME, 0.3);
    orb(g, 10, 10, 6.2, ['#e8fdff', '#b4f2ff', '#78def8', '#46c4ee', '#2aa8dc', '#7ae6ff'], 0.5);
    R(g, 8, 10, 4, 2, '#4cb42c'); R(g, 9, 9, 2, 1, '#82dc52'); R(g, 11, 12, 1, 1, '#34921c');
    R(g, 6, 6, 2, 1, '#fff'); R(g, 6, 7, 1, 1, '#fff');
  },
  folder: g => {
    g.fillStyle = bands(g, 3, 8, ['#ffe79a', '#f5c850']); rrect(g, 2, 3, 9, 6, 1.5); g.fill();
    g.fillStyle = '#fff'; g.fillRect(5, 6, 14, 6);
    R(g, 6, 7, 10, 1, '#a8c8e0'); R(g, 6, 9, 8, 1, '#a8c8e0');
    g.fillStyle = bands(g, 8, 21, GOLD); rrect(g, 2, 9, 20, 12, 2); g.fill();
    gloss(g, 2, 9, 20, 4, 0.4);
    R(g, 4, 10, 4, 1, '#fff');
  },
  game: g => {
    orb(g, 12, 12, 10, AQUA, 0.55);
    for (let i = 0; i < 4; i++) { E(g, 7.5 + i * 3, 13 + (i % 2), 1.6, 2.4, '#4cb42c'); R(g, 7 + i * 3, 12 + (i % 2), 1, 1, '#c2f59a'); }
    R(g, 5, 5, 3, 1, '#fff'); R(g, 5, 6, 1, 1, '#fff');
    R(g, 17, 17, 1, 1, '#e8fdff');
  },
  bubbles: g => {
    const b = (cx: number, cy: number, r: number) => {
      g.fillStyle = 'rgba(170,236,255,0.55)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e8fdff'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r - 0.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(Math.round(cx - r * 0.55), Math.round(cy - r * 0.6), Math.max(1, Math.round(r * 0.45)), 1);
      g.fillRect(Math.round(cx - r * 0.62), Math.round(cy - r * 0.4), 1, Math.max(1, Math.round(r * 0.3)));
    };
    b(9, 14, 7.5); b(17.5, 8, 4.8); b(18, 18, 3.4); b(6, 4, 2.4);
  },
  term: g => {
    g.fillStyle = bands(g, 2, 17, ['#6a7c90', '#3a4a5c', '#1e2a38', '#141c26']); rrect(g, 2, 2, 20, 15, 2); g.fill();
    g.fillStyle = bands(g, 4, 15, ['#0a2418', '#06180f']); g.fillRect(4, 4, 16, 11);
    R(g, 6, 7, 1, 1, '#8dffc8'); R(g, 7, 8, 1, 1, '#8dffc8'); R(g, 6, 9, 1, 1, '#8dffc8'); R(g, 9, 9, 4, 1, '#8dffc8');
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.moveTo(2, 2); g.lineTo(22, 2); g.lineTo(22, 5); g.lineTo(2, 11); g.closePath(); g.fill(); g.restore();
    g.fillStyle = bands(g, 17, 22, CHROME); g.fillRect(9, 17, 6, 2); rrect(g, 5, 19, 14, 3, 1); g.fill();
  },
  bin: g => {
    g.fillStyle = 'rgba(190,232,250,0.62)';
    g.beginPath(); g.moveTo(4, 6); g.lineTo(20, 6); g.lineTo(18, 22); g.lineTo(6, 22); g.closePath(); g.fill();
    for (const x of [8, 12, 16]) R(g, x, 8, 1, 12, 'rgba(255,255,255,0.8)');
    g.fillStyle = bands(g, 2, 6, CHROME); rrect(g, 3, 3, 18, 3, 1); g.fill(); R(g, 9, 1, 6, 2, '#a9b8c6');
    R(g, 10, 12, 4, 1, '#34a02a'); R(g, 9, 13, 1, 3, '#34a02a'); R(g, 14, 13, 1, 2, '#34a02a'); R(g, 10, 16, 3, 1, '#34a02a'); R(g, 13, 11, 1, 3, '#62d040');
    R(g, 5, 7, 1, 6, '#fff');
  },
  doc: g => {
    g.fillStyle = bands(g, 2, 22, ['#ffffff', '#f4f9fd', '#e6f0f8']);
    g.beginPath(); g.moveTo(5, 2); g.lineTo(15, 2); g.lineTo(19, 6); g.lineTo(19, 22); g.lineTo(5, 22); g.closePath(); g.fill();
    R(g, 15, 2, 1, 4, '#b8d4ea'); R(g, 15, 5, 4, 1, '#b8d4ea');
    for (const y of [9, 12, 15, 18]) R(g, 7, y, y === 18 ? 6 : 10, 1, '#9ab4c8');
  },
  lock: g => {
    g.strokeStyle = '#a9b8c6'; g.lineWidth = 2.4; g.beginPath(); g.arc(12, 9, 5, Math.PI, 0); g.lineTo(17, 12); g.moveTo(7, 9); g.lineTo(7, 12); g.stroke();
    g.fillStyle = bands(g, 11, 22, GOLD); rrect(g, 4, 11, 16, 11, 2); g.fill();
    R(g, 11, 14, 2, 4, '#7a4a10'); gloss(g, 4, 11, 16, 4, 0.4);
  },
  pug: g => {
    E(g, 12, 13, 8.5, 7.8, (nx, ny) => (nx + ny < -0.8 ? '#f6dca8' : ny > 0.55 ? '#c49058' : '#e4b87c'));
    E(g, 4.8, 7, 2.6, 3, '#3e2c2a'); E(g, 19.2, 7, 2.6, 3, '#3e2c2a');
    E(g, 12, 16, 4.6, 3.4, '#3e2c2a'); R(g, 11, 14, 2, 1, '#140c0c'); R(g, 11, 18, 2, 2, '#f07a90');
    for (const ex of [8, 16]) { E(g, ex, 11, 2.2, 2.2, '#fff'); R(g, ex - 1, 11, 2, 2, '#1a1012'); R(g, ex - 1, 10, 1, 1, '#fff'); }
    R(g, 10, 7, 4, 1, '#c49058');
  },
};
const cache = new Map<string, string>();
/** 24x24 glossy pixel icon; returns a fresh canvas each call */
export function icon(name: string, scale = 2): HTMLCanvasElement {
  const draw = ICON_DRAW[name] ?? ICON_DRAW.doc;
  const c = canvas(24, 24, g => { draw(g); hardAlpha(g, 24, 24); outline(g, 24, 24, name === 'term' ? '#0a1018' : '#15405e'); });
  c.style.width = c.style.height = 24 * scale + 'px';
  c.className = 'pxi';
  return c;
}
export function iconURL(name: string): string {
  let u = cache.get(name);
  if (!u) { u = icon(name).toDataURL(); cache.set(name, u); }
  return u;
}

/** the fat pug cursor (18x18 art px): pointer tip at the top-left, then a chunky pug head */
export function pugCursor(state: 'idle' | 'down' | 'link'): string {
  return canvas(18, 18, g => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0.5, 0.5); g.lineTo(8, 3.5); g.lineTo(3.5, 8); g.closePath(); g.fill();
    R(g, 1, 1, 2, 2, '#bff2ff');
    const sq = state === 'down' ? 0.6 : 0;
    E(g, 10.2, 10.6 + sq * 0.5, 6.8 + sq, 6.2 - sq, (nx, ny) => (nx + ny < -0.75 ? '#f8dfae' : ny > 0.5 ? '#c49058' : '#e4b87c'));
    E(g, 4.6, 5.6, 2, 2.3, '#3e2c2a'); E(g, 15.8, 5.6, 2, 2.3, '#3e2c2a');
    E(g, 10.2, 13, 3.6, 2.5, '#3e2c2a'); R(g, 9, 11, 2, 1, '#140c0c');
    if (state === 'down') { R(g, 9, 14, 2, 3, '#f07a90'); R(g, 6, 9, 2, 1, '#1a1012'); R(g, 12, 9, 2, 1, '#1a1012'); }
    else {
      for (const ex of [7, 13]) { R(g, ex - 1, 8, 2, 2, '#ffffff'); R(g, ex - (state === 'link' ? 0 : 1), 9, 1, 1, '#1a1012'); }
      R(g, 9, 14, 2, state === 'link' ? 2 : 1, '#f07a90');
    }
    R(g, 8, 6, 4, 1, '#c49058');
    outline(g, 18, 18, '#2e1c16');
  }).toDataURL();
}

// ------------------------------------------------------------------ particles

const bubCache = new Map<number, HTMLCanvasElement>();
export function bubSprite(r: number): HTMLCanvasElement {
  r = Math.max(1, Math.round(r));
  let c = bubCache.get(r);
  if (c) return c;
  const s = r * 2 + 1;
  c = canvas(s, s, g => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - r, y - r);
      if (d > r + 0.3) continue;
      const a = Math.atan2(y - r, x - r);
      let col = 'rgba(150,230,255,0.22)';
      if (d > r - 1) col = a > -2.6 && a < -0.4 ? 'rgba(255,255,255,0.95)' : 'rgba(200,245,255,0.8)';
      else if (r > 3 && d > r * 0.45 && d < r * 0.78 && a > -2.5 && a < -1.9) col = '#ffffff';
      else if (r > 4 && d > r - 2.2 && a > 0.5 && a < 1.3) col = 'rgba(180,255,220,0.55)';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
  });
  bubCache.set(r, c);
  return c;
}

type PK = 'spark' | 'bub' | 'conf' | 'ring' | 'dot';
interface P { k: PK; x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; r: number; rot: number; vr: number; front: boolean; ph: number }
interface WallBub { x: number; y: number; r: number; v: number; ph: number; top: number }

const SPARK = ['#ffffff', '#bff6ff', '#7ae6ff', '#fff3a0', '#c8ff9a'];
const CONF = ['#22c4e6', '#5cc43c', '#ffd048', '#ff7ab8', '#ffffff', '#3a8ee8', '#a6f07a'];

export class Fx {
  readonly back: HTMLCanvasElement;
  readonly front: HTMLCanvasElement;
  private gb: CanvasRenderingContext2D;
  private gf: CanvasRenderingContext2D;
  private ps: P[] = [];
  wall: WallBub[] = [];
  private wallT = 0;
  W = 0; H = 0;
  readonly PX = 2;
  constructor() {
    this.back = document.createElement('canvas');
    this.front = document.createElement('canvas');
    this.gb = this.back.getContext('2d')!;
    this.gf = this.front.getContext('2d')!;
  }
  resize(w: number, h: number) {
    this.W = Math.ceil(w / this.PX); this.H = Math.ceil(h / this.PX);
    for (const c of [this.back, this.front]) {
      c.width = this.W; c.height = this.H;
      c.style.width = this.W * this.PX + 'px'; c.style.height = this.H * this.PX + 'px';
    }
    this.gb.imageSmoothingEnabled = this.gf.imageSmoothingEnabled = false;
  }
  private add(p: Partial<P> & { k: PK; x: number; y: number }) {
    if (this.ps.length > 700) return;
    this.ps.push({ vx: 0, vy: 0, t: 0, life: 1, c: '#fff', r: 1, rot: 0, vr: 0, front: true, ph: Math.random() * 6, ...p });
  }
  sparkle(x: number, y: number, n = 10, spread = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spread * (0.35 + Math.random() * 0.65);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0.45 + Math.random() * 0.45, c: SPARK[i % SPARK.length], r: 2 + Math.random() * 2 });
    }
  }
  bubbles(x: number, y: number, n = 8, spread = 50) {
    for (let i = 0; i < n; i++) {
      this.add({ k: 'bub', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.5, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 60, life: 0.9 + Math.random() * 1.1, r: 1 + Math.floor(Math.random() * 4) });
    }
  }
  confetti(x: number, y: number, n = 70, w = 200) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const s = 220 + Math.random() * 320;
      this.add({ k: 'conf', x: x + (Math.random() - 0.5) * w, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 2 + Math.random() * 1.6, c: CONF[i % CONF.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18 });
    }
  }
  ring(x: number, y: number, c = 'rgba(200,250,255,0.95)', r = 14) { this.add({ k: 'ring', x, y, life: 0.38, c, r }); }
  trail(x: number, y: number) {
    this.add({ k: 'dot', x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 12, vx: (Math.random() - 0.5) * 10, life: 0.35 + Math.random() * 0.25, c: SPARK[Math.floor(Math.random() * 3)], r: Math.random() < 0.3 ? 2 : 1 });
  }
  /** pop a desktop bubble near (x, y); returns true if one popped */
  popAt(x: number, y: number): boolean {
    for (let i = this.wall.length - 1; i >= 0; i--) {
      const b = this.wall[i];
      if (Math.hypot(b.x - x, b.y - y) < b.r * this.PX + 10) { this.wall.splice(i, 1); this.burstWall(b); return true; }
    }
    return false;
  }
  private burstWall(b: WallBub) {
    this.add({ k: 'ring', x: b.x, y: b.y, life: 0.3, c: 'rgba(230,252,255,0.95)', r: b.r * this.PX + 4, front: false });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; this.add({ k: 'dot', x: b.x, y: b.y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 0.3, c: '#e8fdff', front: false }); }
  }
  step(dt: number, wallOn: boolean, deskH: number) {
    // ambient bubbles drifting up off the grass
    if (wallOn) {
      this.wallT -= dt;
      if (this.wallT <= 0 && this.wall.length < 9) {
        this.wallT = 0.9 + Math.random() * 1.6;
        const r = 2 + Math.floor(Math.random() * 5);
        this.wall.push({ x: Math.random() * this.W * this.PX, y: deskH + 10, r, v: 14 + Math.random() * 20 - r, ph: Math.random() * 6, top: deskH * (0.05 + Math.random() * 0.5) });
      }
    }
    for (let i = this.wall.length - 1; i >= 0; i--) {
      const b = this.wall[i];
      b.y -= b.v * dt; b.ph += dt * 1.6;
      b.x += Math.sin(b.ph) * 10 * dt;
      if (b.y < b.top) { this.wall.splice(i, 1); this.burstWall(b); }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.t += dt;
      if (p.t >= p.life) {
        if (p.k === 'bub') this.add({ k: 'ring', x: p.x, y: p.y, life: 0.22, c: 'rgba(230,252,255,0.9)', r: p.r * this.PX + 4 });
        this.ps.splice(i, 1); continue;
      }
      if (p.k === 'spark') { p.vx *= 1 - 3 * dt; p.vy = p.vy * (1 - 3 * dt) + 60 * dt; }
      else if (p.k === 'conf') { p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 420 * dt; p.rot += p.vr * dt; p.ph += dt * 5; p.vx += Math.sin(p.ph) * 40 * dt; }
      else if (p.k === 'bub') { p.ph += dt * 4; p.vx = p.vx * (1 - 2 * dt) + Math.sin(p.ph) * 30 * dt; p.vy *= 1 - 0.8 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  get busy() { return this.ps.length > 0 || this.wall.length > 0; }
  draw() {
    const { gb, gf, PX } = this;
    gb.clearRect(0, 0, this.W, this.H);
    gf.clearRect(0, 0, this.W, this.H);
    for (const b of this.wall) gb.drawImage(bubSprite(b.r), Math.round(b.x / PX - b.r), Math.round(b.y / PX - b.r));
    for (const p of this.ps) {
      const g = p.front ? gf : gb;
      const x = Math.round(p.x / PX), y = Math.round(p.y / PX), u = p.t / p.life;
      if (p.k === 'spark') {
        const s = Math.round(p.r * (1 - u));
        g.fillStyle = p.c;
        g.fillRect(x, y, 1, 1);
        if (s > 0) { g.fillRect(x - s, y, s, 1); g.fillRect(x + 1, y, s, 1); g.fillRect(x, y - s, 1, s); g.fillRect(x, y + 1, 1, s); }
        if (s > 2) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x - 1, y + 1, 1, 1); }
      } else if (p.k === 'bub') {
        g.drawImage(bubSprite(p.r), x - Math.round(p.r), y - Math.round(p.r));
      } else if (p.k === 'conf') {
        g.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
        g.fillStyle = p.c;
        const w = Math.max(1, Math.round(Math.abs(Math.cos(p.rot)) * 3));
        g.fillRect(x, y, w, 2);
        g.globalAlpha = 1;
      } else if (p.k === 'ring') {
        const r = (p.r / PX) * (0.35 + u * 0.9);
        g.globalAlpha = 1 - u;
        g.fillStyle = p.c;
        const n = Math.max(8, Math.round(r * 6));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); }
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = 1 - u;
        g.fillStyle = p.c;
        g.fillRect(x, y, p.r, p.r);
        g.globalAlpha = 1;
      }
    }
  }
}

// ------------------------------------------------------------------ wallpaper clouds (in the wallpaper's own pixel grid)

export function cloudSprite(seed: number): HTMLCanvasElement {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const w = 14 + Math.floor(rnd() * 20), h = 4 + Math.floor(rnd() * 4);
  const puffs = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => ({ x: 3 + rnd() * (w - 6), r: 1.6 + rnd() * (h - 1.5) }));
  return canvas(w + 12, h + 1, g => {
    for (let y = 0; y <= h; y++) for (let x = 0; x < w + 12; x++) {
      const cx = x - 6;
      let inside = false, top = false;
      for (const p of puffs) {
        const dy = h - y, dx = cx - p.x;
        if (dy >= 0 && dx * dx / (p.r * p.r * 2.2) + (dy * dy) / (p.r * p.r) <= 1) { inside = true; if (dy > p.r - 1.5) top = true; }
      }
      const base = y >= h - 1 && cx > 0 && cx < w;
      const wisp = y === h - 1 && ((cx >= -5 && cx <= 1) || (cx >= w - 1 && cx < w + 5)) && ((x + seed) % 3 !== 0);
      if (!inside && !base && !wisp) continue;
      g.fillStyle = wisp ? 'rgba(236,244,255,0.75)' : y === h ? '#b9c9ef' : y === h - 1 ? '#d6e0f8' : top ? '#ffffff' : '#eef3ff';
      g.fillRect(x, y, 1, 1);
    }
  });
}
