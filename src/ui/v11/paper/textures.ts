// Physical UI kit: procedural paper. Seamless tiles for every kind of paper the expedition owns
// (Mori's journal, old parchment, kraft, index cards, telex slips, flax paper, graph paper, blueprint
// paper, cork, marbled endpapers, book cloth and leather), non-tiling "age" overlays (stains, coffee
// rings, foxing, folds, burnt edges) and torn / deckled edge clip-paths.
//
// Tiles are painted once into a canvas the first time they're asked for and installed as CSS custom
// properties on :root (--pp-t-<kind>), so the big data URL lives in one place and every element
// just references the variable.

import { canvas2d, fbm, hash2, rng, rgbOf, clamp01, smooth, memo } from './rng';

export type PaperKind = 'journal' | 'parchment' | 'kraft' | 'card' | 'telex' | 'flax' | 'graph' | 'blueprint' | 'cork' | 'endpaper' | 'linen';

interface TileDef {
  base: string;
  /** low-frequency mottling: [darker, lighter] colour and strength */
  mottle: [string, string, number];
  /** fine grain strength */
  grain: number;
  /** fibres: count, colour, alpha, length */
  fibres?: [number, string, number, number];
  /** flecks / granules (cork, flax) */
  flecks?: [number, string, number, number][];
  /** grid lines every n px (graph & blueprint paper) */
  grid?: [number, string, number];
}

const TILES: Record<Exclude<PaperKind, 'endpaper' | 'linen'>, TileDef> = {
  journal: { base: '#f1e5c8', mottle: ['#e2cfa4', '#f8eed6', 0.55], grain: 0.05, fibres: [70, '#b89a68', 0.09, 14] },
  parchment: { base: '#e9d3a2', mottle: ['#cfac6c', '#f4e3b8', 0.9], grain: 0.07, fibres: [50, '#a07a44', 0.08, 18] },
  kraft: { base: '#c9a273', mottle: ['#b08654', '#d8b688', 0.6], grain: 0.09, fibres: [160, '#8a6438', 0.16, 12], flecks: [[60, '#7a5430', 0.35, 1.2], [40, '#e2c89e', 0.35, 1]] },
  card: { base: '#f7f1e2', mottle: ['#ece2c8', '#fbf7ec', 0.35], grain: 0.035, fibres: [40, '#c8b48a', 0.06, 10] },
  telex: { base: '#f2e7b6', mottle: ['#e0d08e', '#f8f0cc', 0.5], grain: 0.05, fibres: [40, '#b8a060', 0.07, 10] },
  flax: { base: '#e2d6ad', mottle: ['#cbbb88', '#efe6c4', 0.6], grain: 0.06, fibres: [220, '#8a8a4a', 0.16, 26], flecks: [[50, '#6e6a38', 0.3, 1.1]] },
  graph: { base: '#f3ead2', mottle: ['#e4d6b2', '#faf3e0', 0.4], grain: 0.04, fibres: [40, '#b8a070', 0.06, 12], grid: [16, '#6aa890', 0.22] },
  blueprint: { base: '#21508c', mottle: ['#173e70', '#2e64a6', 0.75], grain: 0.06, fibres: [60, '#9cc0e8', 0.06, 14], grid: [32, '#d8ecff', 0.16] },
  cork: { base: '#b98a59', mottle: ['#9c6f42', '#cfa270', 0.55], grain: 0.14, flecks: [[900, '#6e4826', 0.55, 1.4], [500, '#e0bc88', 0.5, 1.2], [160, '#4e3018', 0.6, 2]] },
};

const S = 256;

function paintTile(kind: PaperKind): HTMLCanvasElement {
  if (kind === 'endpaper') return paintMarble();
  if (kind === 'linen') return paintLinen('#cfc4a4');
  const d = TILES[kind];
  const seed = kind.length * 131 + kind.charCodeAt(0);
  const [c, g] = canvas2d(S, S);
  const img = g.createImageData(S, S);
  const px = img.data;
  const [br, bg, bb] = rgbOf(d.base);
  const [dr, dg, db] = rgbOf(d.mottle[0]);
  const [lr, lg, lb] = rgbOf(d.mottle[1]);
  const mk = d.mottle[2];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // mottling: two scales of tileable noise
    const m = fbm(x / 64, y / 64, seed, 4, 4) * 0.7 + fbm(x / 16, y / 16, seed + 5, 2, 16) * 0.3;
    const t = (m - 0.5) * 2 * mk;
    let r = br, gg = bg, b = bb;
    if (t < 0) { r += (dr - br) * -t; gg += (dg - bg) * -t; b += (db - bb) * -t; }
    else { r += (lr - br) * t; gg += (lg - bg) * t; b += (lb - bb) * t; }
    const n = (hash2(x, y, seed + 9) - 0.5) * 2 * d.grain * 255;
    const i = (y * S + x) * 4;
    px[i] = r + n; px[i + 1] = gg + n; px[i + 2] = b + n * 0.9; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const R = rng(seed);
  // fibres: short curved strokes, drawn three times across the edges so the tile stays seamless
  if (d.fibres) {
    const [n, col, a, len] = d.fibres;
    g.strokeStyle = col;
    g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const x0 = R() * S, y0 = R() * S, ang = R() * Math.PI * 2, l = len * (0.4 + R() * 0.9), bend = (R() - 0.5) * 0.8;
      g.globalAlpha = a * (0.4 + R() * 0.8);
      g.lineWidth = 0.6 + R() * 0.7;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const sx = x0 + ox, sy = y0 + oy;
        if (sx < -len * 2 || sx > S + len * 2 || sy < -len * 2 || sy > S + len * 2) continue;
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + Math.cos(ang + bend) * l * 0.5, sy + Math.sin(ang + bend) * l * 0.5, sx + Math.cos(ang) * l, sy + Math.sin(ang) * l);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  if (d.flecks) for (const [n, col, a, r] of d.flecks) {
    g.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const x = R() * S, y = R() * S, rr = r * (0.4 + R() * 0.9);
      g.globalAlpha = a * (0.5 + R() * 0.5);
      g.beginPath();
      g.ellipse(x, y, rr, rr * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  if (d.grid) {
    const [step, col, a] = d.grid;
    g.fillStyle = col;
    for (let v = 0; v < S; v += step) {
      const major = (v / step) % 4 === 0;
      g.globalAlpha = a * (major ? 1.6 : 1);
      g.fillRect(v, 0, major ? 1.4 : 0.8, S);
      g.fillRect(0, v, S, major ? 1.4 : 0.8);
    }
    g.globalAlpha = 1;
  }
  return c;
}

/** marbled endpaper: domain-warped bands of deep green, teal and gold veins */
function paintMarble(): HTMLCanvasElement {
  const [c, g] = canvas2d(S, S);
  const img = g.createImageData(S, S);
  const px = img.data;
  const cols = [rgbOf('#1f3d36'), rgbOf('#2e5e52'), rgbOf('#173029'), rgbOf('#3e6e5c')];
  const vein = rgbOf('#d6b56a');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wx = fbm(x / 48, y / 48, 41, 4, S / 48 | 0) * 3.2, wy = fbm(x / 48 + 7, y / 48 + 3, 43, 4, S / 48 | 0) * 3.2;
    const v = Math.sin((x / S) * Math.PI * 2 * 3 + wx * 2.6 + Math.sin((y / S) * Math.PI * 2 * 2 + wy * 2) * 1.4);
    const band = (v + 1) / 2;
    const ci = Math.min(3, Math.floor(band * 4));
    let [r, gg, b] = cols[ci];
    const vv = 1 - smooth(0, 0.06, Math.abs(v - 0.15));
    r += (vein[0] - r) * vv * 0.85; gg += (vein[1] - gg) * vv * 0.85; b += (vein[2] - b) * vv * 0.85;
    const n = (hash2(x, y, 7) - 0.5) * 14;
    const i = (y * S + x) * 4;
    px[i] = r + n; px[i + 1] = gg + n; px[i + 2] = b + n; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** book cloth: a fine linen weave in a colour */
function paintLinen(col: string): HTMLCanvasElement {
  const [c, g] = canvas2d(S, S);
  const img = g.createImageData(S, S);
  const px = img.data;
  const [r0, g0, b0] = rgbOf(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const warp = Math.sin(x * Math.PI * 0.5) * 0.5 + 0.5, weft = Math.sin(y * Math.PI * 0.5) * 0.5 + 0.5;
    const thread = (hash2(x, y >> 2, 3) - 0.5) * 0.25 + (hash2(x >> 2, y, 5) - 0.5) * 0.25;
    const m = fbm(x / 64, y / 64, 11, 3, 4) - 0.5;
    const k = 1 + (warp * 0.5 + weft * 0.5 - 0.5) * 0.16 + thread * 0.3 + m * 0.18;
    const i = (y * S + x) * 4;
    px[i] = r0 * k; px[i + 1] = g0 * k; px[i + 2] = b0 * k; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const tileURL = memo((kind: string) => paintTile(kind as PaperKind).toDataURL('image/jpeg', 0.88));

const installed = new Set<string>();
/** install a texture as a CSS variable once and return `var(--pp-t-<kind>)` */
function cssVar(name: string, url: () => string): string {
  if (!installed.has(name)) {
    installed.add(name);
    document.documentElement.style.setProperty(`--pp-t-${name}`, `url(${url()})`);
  }
  return `var(--pp-t-${name})`;
}

/** the seamless tile of a paper as a CSS image value (`var(--pp-t-journal)`) */
export function paperTex(kind: PaperKind): string {
  return cssVar(kind, () => tileURL(kind));
}
/** the raw data URL of a paper tile (for canvas drawing) */
export function paperTileURL(kind: PaperKind): string { return tileURL(kind); }
/** the tile canvas itself (for canvas patterns: transitions, sketches) */
export const paperTileCanvas = memo((kind: string) => paintTile(kind as PaperKind));

// ---------------------------------------------------------------- cover materials

/** a leather grain tile in a colour (book covers, the camera strap) */
const leatherTile = memo((col: string) => {
  const [c, g] = canvas2d(S, S);
  const img = g.createImageData(S, S);
  const px = img.data;
  const [r0, g0, b0] = rgbOf(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // pebbled grain: cellular-ish bumps from two noise scales, plus wear
    const a = fbm(x / 6, y / 6, 21, 2, S / 6 | 0), b = fbm(x / 32, y / 32, 23, 3, 8);
    const bump = smooth(0.35, 0.7, a);
    const k = 0.82 + bump * 0.22 + (b - 0.5) * 0.3 + (hash2(x, y, 29) - 0.5) * 0.06;
    const i = (y * S + x) * 4;
    px[i] = r0 * k; px[i + 1] = g0 * k; px[i + 2] = b0 * k; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.88);
});
const clothTile = memo((col: string) => paintLinen(col).toDataURL('image/jpeg', 0.88));

/** a book-cover material as a CSS image value */
export function coverTex(kind: 'leather' | 'cloth', col: string): string {
  return cssVar(`${kind}-${col.replace('#', '')}`, () => (kind === 'leather' ? leatherTile(col) : clothTile(col)));
}

// ---------------------------------------------------------------- age: stains, foxing, folds, burnt edges

export interface AgeOpts {
  /** coffee rings / water marks (count) */
  stains?: number;
  /** foxing: rust-brown speckles (0..1 amount) */
  foxing?: number;
  /** fold creases: 0 none, 1 one fold, 2 a cross fold */
  folds?: number;
  /** darkened, toasted edges (0..1) */
  edge?: number;
  /** the stain colour (coffee by default) */
  tint?: string;
}

const AW = 384, AH = 512;
const ageURL = memo((key: string) => {
  const [seedS, st, fx, fo, ed, tint] = key.split('|');
  const seed = +seedS, stains = +st, foxing = +fx, folds = +fo, edge = +ed;
  const R = rng(seed * 7919 + 13);
  const [c, g] = canvas2d(AW, AH);
  const img = g.createImageData(AW, AH);
  const px = img.data;
  const [tr, tg, tb] = rgbOf(tint || '#7a4a1a');
  // toasted edges: darker toward the border, unevenly (noise on the distance)
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const dx = Math.min(x, AW - 1 - x) / AW, dy = Math.min(y, AH - 1 - y) / AH;
    const dd = Math.min(dx * 1.33, dy) + (fbm(x / 40, y / 40, seed, 3) - 0.5) * 0.06;
    let a = edge * (1 - smooth(0, 0.11, dd)) * 0.55;
    a += edge * (1 - smooth(0, 0.025, dd)) * 0.35;
    // a faint overall unevenness
    a += (fbm(x / 120, y / 120, seed + 3, 3) - 0.5) * 0.08 * edge;
    const i = (y * AW + x) * 4;
    px[i] = tr * 0.8; px[i + 1] = tg * 0.8; px[i + 2] = tb * 0.8; px[i + 3] = clamp01(a) * 255;
  }
  g.putImageData(img, 0, 0);
  // coffee rings and water marks
  for (let k = 0; k < stains; k++) {
    const x = AW * (0.12 + R() * 0.76), y = AH * (0.1 + R() * 0.8), r = 22 + R() * 46;
    const ring = R() < 0.65;
    const steps = 80;
    g.save();
    g.translate(x, y);
    g.rotate(R() * 6);
    g.scale(1, 0.85 + R() * 0.25);
    if (ring) {
      // a ring: darker rim with a faint fill, broken in places
      g.lineCap = 'round';
      for (let s = 0; s < steps; s++) {
        const a0 = (s / steps) * Math.PI * 2, a1 = ((s + 1.2) / steps) * Math.PI * 2;
        const gap = fbm(s / 9, k, seed + 31, 2);
        if (gap < 0.32) continue;
        const rr = r * (1 + (fbm(s / 6, k + 3, seed + 37, 2) - 0.5) * 0.08);
        g.strokeStyle = `rgba(${tr},${tg},${tb},${(0.1 + gap * 0.18).toFixed(3)})`;
        g.lineWidth = 1.5 + gap * 2.5;
        g.beginPath(); g.arc(0, 0, rr, a0, a1); g.stroke();
      }
      const fill = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      fill.addColorStop(0, `rgba(${tr},${tg},${tb},0.035)`);
      fill.addColorStop(0.85, `rgba(${tr},${tg},${tb},0.07)`);
      fill.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
      g.fillStyle = fill;
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    } else {
      // a water blot: an irregular pale-brown tide mark
      g.beginPath();
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const rr = r * (0.75 + fbm(Math.cos(a) * 1.5 + 4, Math.sin(a) * 1.5 + 4, seed + k * 11, 3) * 0.6);
        if (s === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = `rgba(${tr},${tg},${tb},0.06)`;
      g.fill();
      g.strokeStyle = `rgba(${tr},${tg},${tb},0.16)`;
      g.lineWidth = 1.6;
      g.stroke();
    }
    g.restore();
  }
  // foxing: clusters of small rust specks
  const nf = Math.round(foxing * 60);
  for (let k = 0; k < nf; k++) {
    const cx = AW * R(), cy = AH * R();
    const n = 2 + Math.floor(R() * 6);
    for (let j = 0; j < n; j++) {
      const x = cx + (R() - 0.5) * 26, y = cy + (R() - 0.5) * 26, r = 0.6 + R() * 2.4;
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
      gr.addColorStop(0, `rgba(150,82,30,${(0.25 + R() * 0.35).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(150,82,30,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill();
    }
  }
  // folds: a crease is a bright line beside a dark one, with soft shading either side
  const fold = (x0: number, y0: number, x1: number, y1: number) => {
    const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny), ux = nx / l, uy = ny / l;
    for (const [o, col, w] of [[-1.2, 'rgba(255,250,235,0.55)', 1.4], [0.8, 'rgba(90,60,30,0.22)', 1.2]] as const) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(x0 + ux * o, y0 + uy * o); g.lineTo(x1 + ux * o, y1 + uy * o); g.stroke();
    }
    const sh = g.createLinearGradient((x0 + x1) / 2 - ux * 18, (y0 + y1) / 2 - uy * 18, (x0 + x1) / 2 + ux * 18, (y0 + y1) / 2 + uy * 18);
    sh.addColorStop(0, 'rgba(90,60,30,0)'); sh.addColorStop(0.48, 'rgba(90,60,30,0.07)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.05)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.save();
    g.strokeStyle = sh; g.lineWidth = 36;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.restore();
  };
  if (folds >= 1) fold(0, AH * (0.48 + (R() - 0.5) * 0.06), AW, AH * (0.5 + (R() - 0.5) * 0.06));
  if (folds >= 2) fold(AW * (0.5 + (R() - 0.5) * 0.05), 0, AW * (0.5 + (R() - 0.5) * 0.05), AH);
  return c.toDataURL('image/png');
});

/** a non-tiling age overlay (stretch it over the paper: `center / 100% 100%`) */
export function ageOverlay(seed = 1, o: AgeOpts = {}): string {
  const key = [seed % 9, o.stains ?? 1, (o.foxing ?? 0.3).toFixed(2), o.folds ?? 0, (o.edge ?? 0.6).toFixed(2), o.tint ?? ''].join('|');
  return cssVar('age-' + key.replace(/[^a-z0-9]/gi, '_'), () => ageURL(key));
}

/** a full CSS `background` for aged paper: the age overlay over the tiled paper */
export function paperBg(kind: PaperKind, seed = 1, o: AgeOpts = {}): string {
  return `${ageOverlay(seed, o)} center / 100% 100% no-repeat, ${paperTex(kind)} ${(seed * 37) % 256}px ${(seed * 91) % 256}px / 256px 256px repeat`;
}

// ---------------------------------------------------------------- edges

export type EdgeKind = 'straight' | 'deckle' | 'torn' | 'perforated';
export interface EdgeOpts { top?: EdgeKind; right?: EdgeKind; bottom?: EdgeKind; left?: EdgeKind; amp?: number }

/**
 * A clip-path polygon for ragged paper edges, in percentages (it scales with the element). Deckle
 * is the soft rough edge of handmade paper, torn a bigger ripped edge, perforated a notebook's
 * tear-off line. `amp` scales the raggedness.
 */
export function edgeClip(seed: number, o: EdgeOpts = {}): string {
  const R = rng(seed * 2654435761);
  const amp = o.amp ?? 1;
  const pts: string[] = [];
  const side = (kind: EdgeKind | undefined, n: number, at: (t: number, off: number) => [number, number]) => {
    kind = kind ?? 'straight';
    if (kind === 'straight') { pts.push(fmt(...at(0, 0))); return; }
    const big = kind === 'torn' ? 2.6 : kind === 'perforated' ? 0.9 : 0.55;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      if (kind === 'perforated') { w = i % 2 ? big * 0.9 : 0; }
      else { w = Math.max(0, Math.min(big * 1.6, w * 0.55 + (R() * big) * 1.1 + (kind === 'torn' ? Math.sin(t * 9 + seed) * big * 0.35 : 0))); }
      pts.push(fmt(...at(t, w * amp)));
    }
  };
  const fmt = (x: number, y: number) => `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  side(o.top, 46, (t, w) => [t * 100, w]);
  side(o.right, 60, (t, w) => [100 - w * 0.75, t * 100]);
  side(o.bottom, 46, (t, w) => [100 - t * 100, 100 - w]);
  side(o.left, 60, (t, w) => [w * 0.75, 100 - t * 100]);
  return `polygon(${pts.join(', ')})`;
}
