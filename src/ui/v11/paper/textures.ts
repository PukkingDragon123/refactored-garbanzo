// Physical UI kit: procedural paper, as pixel art. Seamless 128 x 128 art-pixel tiles for every kind
// of paper the expedition owns (Mori's journal, old parchment, kraft, index cards, telex slips, flax
// paper, graph paper, blueprint paper, cork, marbled endpapers, book cloth and leather): each is a
// small palette (three to five tones) laid down with ordered dithering, Bresenham fibres and single-
// pixel flecks, then stored pre-scaled to 2 CSS px per art pixel, so `/ 256px` shows it 1:1 and crisp.
// Age is pixel art too: coffee rings, rust foxing, fold creases and toasted edges are their own small
// layers (stepped, dithered, never blurred), and torn / deckled / perforated edges are stepped
// clip-paths.
//
// Tiles are painted the first time they're asked for and installed as CSS custom properties on
// :root (--pp-t-<kind>), so each data URL lives in one place.

import { fbm, hash2, rng, rgbOf, memo } from './rng';
import { Art, col, bayer, dith, PX, shadeC } from './px';

export type PaperKind = 'journal' | 'parchment' | 'kraft' | 'card' | 'telex' | 'flax' | 'graph' | 'blueprint' | 'cork' | 'endpaper' | 'linen';

interface TileDef {
  /** tones from darkest to lightest; `base` is the index of the main tone */
  tones: string[];
  base: number;
  /** how far the mottling swings (in tones) */
  mottle: number;
  /** speckle: chance of a pixel jumping a tone */
  grain: number;
  /** fibres: count, tone index, length */
  fibres?: [number, number, number][];
  /** flecks: count, colour, size */
  flecks?: [number, string, number][];
  /** grid lines every n art px (major every 4th): colour, alpha */
  grid?: [number, string, number];
}

const TILES: Record<Exclude<PaperKind, 'endpaper' | 'linen'>, TileDef> = {
  journal: { tones: ['#d8c49a', '#e6d5ae', '#f1e5c8', '#f8efd8'], base: 2, mottle: 0.75, grain: 0.035, fibres: [[26, 1, 6], [10, 0, 4]] },
  parchment: { tones: ['#c9a466', '#dbbd82', '#e9d3a2', '#f3e2b8'], base: 2, mottle: 1.1, grain: 0.05, fibres: [[22, 1, 7]], flecks: [[16, '#b88a4a', 1]] },
  kraft: { tones: ['#9c7446', '#b58b5c', '#c9a273', '#d8b688'], base: 2, mottle: 0.8, grain: 0.09, fibres: [[70, 0, 5], [30, 3, 4]], flecks: [[40, '#7a5430', 1], [26, '#e2c89e', 1]] },
  card: { tones: ['#e4d8bc', '#efe6d0', '#f7f1e2', '#fcf9f0'], base: 2, mottle: 0.5, grain: 0.02, fibres: [[14, 1, 5]] },
  telex: { tones: ['#dccb88', '#e8daa2', '#f2e7b6', '#f8f0cc'], base: 2, mottle: 0.65, grain: 0.03, fibres: [[14, 1, 5]] },
  flax: { tones: ['#bfae7a', '#d2c394', '#e2d6ad', '#ece4c4'], base: 2, mottle: 0.8, grain: 0.05, fibres: [[90, 0, 10], [40, 1, 8]], flecks: [[30, '#6e6a38', 1]] },
  graph: { tones: ['#ddd0ac', '#e9dfc2', '#f3ead2', '#f9f3e2'], base: 2, mottle: 0.5, grain: 0.02, fibres: [[12, 1, 5]], grid: [8, '#6aa890', 0.42] },
  blueprint: { tones: ['#163a68', '#1c4679', '#21508c', '#2a5e9e'], base: 2, mottle: 0.9, grain: 0.04, fibres: [[20, 3, 5]], grid: [16, '#d8ecff', 0.3] },
  cork: { tones: ['#7e5634', '#9c6f42', '#b98a59', '#cfa270', '#e0bc88'], base: 2, mottle: 0.9, grain: 0.22, flecks: [[420, '#6e4826', 1], [260, '#e6c492', 1], [90, '#4e3018', 2]] },
};

export const TILE = 128;

function paintTile(kind: PaperKind): Art {
  if (kind === 'endpaper') return paintMarble();
  if (kind === 'linen') return paintCloth('#cfc4a4');
  const d = TILES[kind];
  const seed = kind.length * 131 + kind.charCodeAt(0);
  const a = new Art(TILE, TILE);
  const tones = d.tones.map(t => col(t));
  const n = tones.length - 1;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const m = fbm(x / 32, y / 32, seed, 3, 4) * 0.7 + fbm(x / 8, y / 8, seed + 5, 2, 16) * 0.3;
    const tau = d.base + (m - 0.5) * 2 * d.mottle;
    let i = Math.floor(tau + bayer(x, y) - 0.5 + 0.5);
    const h = hash2(x, y, seed + 9);
    if (h < d.grain * 0.5) i--; else if (h > 1 - d.grain * 0.5) i++;
    a.put(x, y, tones[Math.max(0, Math.min(n, i))]);
  }
  const R = rng(seed);
  // fibres: short pixel strokes, wrapped round the tile so it stays seamless
  for (const [cnt, ti, len] of d.fibres ?? []) {
    const c = tones[Math.max(0, Math.min(n, ti))];
    for (let k = 0; k < cnt; k++) {
      const x0 = R() * TILE, y0 = R() * TILE, ang = R() * Math.PI * 2, l = len * (0.5 + R() * 0.8);
      const x1 = x0 + Math.cos(ang) * l, y1 = y0 + Math.sin(ang) * l;
      a.line(x0, y0, x1, y1, c, 1, (px, py) => a.put(((px % TILE) + TILE) % TILE, ((py % TILE) + TILE) % TILE, c));
    }
  }
  for (const [cnt, cs, sz] of d.flecks ?? []) {
    const c = col(cs);
    for (let k = 0; k < cnt; k++) {
      const x = Math.floor(R() * TILE), y = Math.floor(R() * TILE);
      a.put(x, y, c);
      if (sz > 1) { a.put((x + 1) % TILE, y, c); if (R() < 0.5) a.put(x, (y + 1) % TILE, shadeC(c, -0.15)); }
    }
  }
  if (d.grid) {
    const [step, cs, al] = d.grid;
    const c = col(cs);
    for (let v = 0; v < TILE; v += step) {
      const major = (v / step) % 4 === 0;
      for (let u = 0; u < TILE; u++) {
        const k = major ? al * 1.6 : al;
        if (dith(v, u, k)) a.px(v, u, c);
        if (dith(u, v, k)) a.px(u, v, c);
      }
    }
  }
  return a;
}

/** marbled endpaper: domain-warped bands of deep green and teal with gold veins, dithered */
function paintMarble(): Art {
  const a = new Art(TILE, TILE);
  const cols = ['#173029', '#1f3d36', '#2e5e52', '#3e6e5c'].map(c => col(c));
  const vein = col('#d6b56a'), vein2 = col('#9a8448');
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const wx = fbm(x / 24, y / 24, 41, 3, TILE / 24 | 0) * 3.2, wy = fbm(x / 24 + 7, y / 24 + 3, 43, 3, TILE / 24 | 0) * 3.2;
    const v = Math.sin((x / TILE) * Math.PI * 2 * 3 + wx * 2.6 + Math.sin((y / TILE) * Math.PI * 2 * 2 + wy * 2) * 1.4);
    const band = (v + 1) / 2 * 3;
    const i = Math.max(0, Math.min(3, Math.floor(band + bayer(x, y) - 0.5)));
    let c = cols[i];
    const dv = Math.abs(v - 0.15);
    if (dv < 0.05) c = vein; else if (dv < 0.1 && dith(x, y, 0.5)) c = vein2;
    a.put(x, y, c);
  }
  return a;
}

/** book cloth / linen: a pixel weave in a colour */
function paintCloth(hex: string): Art {
  const a = new Art(TILE, TILE);
  const base = col(hex), dk = shadeC(base, -0.14), lt = shadeC(base, 0.1), dk2 = shadeC(base, -0.26);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const m = fbm(x / 32, y / 32, 11, 3, 4) - 0.5;
    const weave = ((x >> 1) + (y >> 1)) & 1;
    let c = weave ? base : (x & 1) ? dk : base;
    if (!weave && (y & 1) && (x & 1)) c = lt;
    if (m < -0.12 && dith(x, y, (-m - 0.12) * 4)) c = dk2;
    if (m > 0.14 && dith(x, y, (m - 0.14) * 3)) c = lt;
    if (hash2(x, y >> 2, 3) < 0.04) c = dk;
    a.put(x, y, c);
  }
  return a;
}

/** pebbled leather in a colour: little lit-and-shaded bumps, worn patches */
function paintLeather(hex: string): Art {
  const a = new Art(TILE, TILE);
  const base = col(hex), lt = shadeC(base, 0.12), lt2 = shadeC(base, 0.22), dk = shadeC(base, -0.18), dk2 = shadeC(base, -0.32);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const wear = fbm(x / 32, y / 32, 23, 3, 4) - 0.5;
    // a pebble grid jittered by a hash: lit on the top-left of each cell, shaded on the bottom-right
    const cx = x % 4, cy = y % 4, cell = hash2(x >> 2, y >> 2, 21);
    let c = base;
    if (cell > 0.25) {
      if ((cx === 0 && cy < 2) || (cy === 0 && cx < 2)) c = lt;
      else if (cx === 3 || cy === 3) c = dk;
    }
    if (wear > 0.12 && dith(x, y, (wear - 0.12) * 3)) c = lt2;
    if (wear < -0.15 && dith(x, y, (-wear - 0.15) * 3)) c = dk2;
    a.put(x, y, c);
  }
  return a;
}

const tileArt = memo((kind: string) => paintTile(kind as PaperKind));
const tileURL = memo((kind: string) => tileArt(kind).url(PX));

const installed = new Set<string>();
/** install a texture as a CSS variable once and return `var(--pp-t-<name>)` */
function cssVar(name: string, url: () => string): string {
  if (!installed.has(name)) {
    installed.add(name);
    document.documentElement.style.setProperty(`--pp-t-${name}`, `url(${url()})`);
  }
  return `var(--pp-t-${name})`;
}

/** the seamless tile of a paper as a CSS image value (`var(--pp-t-journal)`): show it at 256px */
export function paperTex(kind: PaperKind): string {
  return cssVar(kind, () => tileURL(kind));
}
/** the data URL of a paper tile (256 x 256, 2 px per art pixel) */
export function paperTileURL(kind: PaperKind): string { return tileURL(kind); }
/** the tile at art resolution (128 x 128) as a canvas, for canvas patterns */
export const paperTileCanvas = memo((kind: string) => tileArt(kind).canvas());
/** the tile at art resolution as a paint buffer */
export const paperTileArt = (kind: PaperKind) => tileArt(kind);

// ---------------------------------------------------------------- cover materials

const coverArt = memo((key: string) => { const [k, c] = key.split('|'); return k === 'leather' ? paintLeather(c) : paintCloth(c); });
/** a book-cover material as a CSS image value (show at 256px) */
export function coverTex(kind: 'leather' | 'cloth', colr: string): string {
  return cssVar(`${kind}-${colr.replace('#', '')}`, () => coverArt(`${kind}|${colr}`).url(PX));
}
/** a cover material at art resolution */
export const coverArtOf = (kind: 'leather' | 'cloth', colr: string) => coverArt(`${kind}|${colr}`);

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

/** a coffee ring or a water blot, as a pixel sprite */
const stainURL = memo((key: string) => {
  const [seedS, tint] = key.split('|');
  const seed = +seedS;
  const R = rng(seed * 7919 + 13);
  const S = 44, a = new Art(S, S);
  const [tr, tg, tb] = rgbOf(tint || '#7a4a1a');
  const hex = (k: number) => '#' + [tr, tg, tb].map(v => Math.round(v * k).toString(16).padStart(2, '0')).join('');
  const rim = col(hex(1), 0.36), rim2 = col(hex(1), 0.22), wash = col(hex(1), 0.1);
  const ring = R() < 0.65;
  const rx = 14 + R() * 6, ry = rx * (0.82 + R() * 0.2), cx = S / 2, cy = S / 2;
  const tilt = R() * Math.PI;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = dx * Math.cos(tilt) + dy * Math.sin(tilt), v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const ang = Math.atan2(v, u);
    const wob = 1 + (fbm(Math.cos(ang) * 1.6 + 4, Math.sin(ang) * 1.6 + 4, seed, 3) - 0.5) * (ring ? 0.12 : 0.5);
    const r = Math.hypot(u / rx, v / ry) / wob;
    if (ring) {
      const gap = fbm(ang * 2 + 9, seed, seed + 31, 2);
      if (r > 0.9 && r < 1.0 && gap > 0.36) a.px(x, y, rim);
      else if (r >= 1.0 && r < 1.07 && gap > 0.5) a.px(x, y, rim2);
      else if (r < 0.9 && dith(x, y, 0.16)) a.px(x, y, wash);
    } else {
      if (r > 0.92 && r < 1.0) a.px(x, y, rim2);
      else if (r < 0.92 && dith(x, y, 0.3)) a.px(x, y, wash);
    }
  }
  return a.url(PX);
});

/** a tile of foxing: a few clusters of rust specks on transparent paper */
const foxURL = memo((key: string) => {
  const [seedS, amtS] = key.split('|');
  const R = rng(+seedS * 31 + 7);
  const a = new Art(TILE, TILE);
  const n = Math.round(+amtS * 14);
  const c1 = col('#96521e', 0.5), c2 = col('#96521e', 0.28);
  for (let k = 0; k < n; k++) {
    const cx = R() * TILE, cy = R() * TILE, m = 2 + Math.floor(R() * 5);
    for (let j = 0; j < m; j++) {
      const x = Math.floor(cx + (R() - 0.5) * 12), y = Math.floor(cy + (R() - 0.5) * 12);
      a.put((x + TILE) % TILE, (y + TILE) % TILE, R() < 0.6 ? c1 : c2);
      if (R() < 0.3) a.put((x + 1 + TILE) % TILE, (y + TILE) % TILE, c2);
    }
  }
  return a.url(PX);
});

/** a toasted edge strip (side 0 top, 1 right, 2 bottom, 3 left): darker toward the outside */
const edgeURL = memo((key: string) => {
  const [sideS, kS, tint] = key.split('|');
  const side = +sideS, k = +kS;
  const L = TILE, D = 8;
  const horiz = side === 0 || side === 2;
  const a = new Art(horiz ? L : D, horiz ? D : L);
  const [tr, tg, tb] = rgbOf(tint || '#7a4a1a');
  const c = col('#' + [tr, tg, tb].map(v => Math.round(v * 0.8).toString(16).padStart(2, '0')).join(''), 0.5);
  const c2 = col('#' + [tr, tg, tb].map(v => Math.round(v * 0.6).toString(16).padStart(2, '0')).join(''), 0.62);
  for (let t = 0; t < L; t++) {
    const depth = (2.5 + fbm(t / 10, side * 7, 5, 3, L / 10) * 6) * k;
    for (let dd = 0; dd < D; dd++) {
      const cov = Math.max(0, 1 - dd / Math.max(0.5, depth));
      const x = horiz ? t : side === 1 ? D - 1 - dd : dd;
      const y = horiz ? (side === 2 ? D - 1 - dd : dd) : t;
      if (dd === 0 && k > 0.3) { a.px(x, y, c2); continue; }
      if (dith(x, y, cov * cov * 0.9)) a.px(x, y, c);
    }
  }
  return a.url(PX);
});

/** a fold crease strip: a light ridge beside a dark valley, with dithered shade either side */
const foldURL = memo((dir: string) => {
  const L = TILE, D = 4;
  const horiz = dir === 'h';
  const a = new Art(horiz ? L : D, horiz ? D : L);
  const hi = col('#fffaf0', 0.55), lo = col('#5a3c1e', 0.3), sh = col('#5a3c1e', 0.14);
  for (let t = 0; t < L; t++) {
    const put = (d: number, c: number, cov = 1) => { const x = horiz ? t : d, y = horiz ? d : t; if (cov >= 1 || dith(x, y, cov)) a.px(x, y, c); };
    put(0, sh, 0.5); put(1, hi, 0.9); put(2, lo, 0.85); put(3, sh, 0.4);
  }
  return a.url(PX);
});

const even = (v: number) => Math.round(v / PX) * PX;

/** the age layers alone, as background layers (each with its own position and size) */
export function ageOverlay(seed = 1, o: AgeOpts = {}): string {
  const R = rng(seed * 977 + 3);
  const layers: string[] = [];
  const tint = o.tint ?? '';
  const stains = o.stains ?? 1;
  for (let k = 0; k < stains; k++) {
    const u = cssVar(`st-${(seed + k * 13) % 11}-${tint.replace('#', '')}`, () => stainURL(`${(seed + k * 13) % 11}|${tint}`));
    layers.push(`${u} ${Math.round(12 + R() * 70)}% ${Math.round(10 + R() * 75)}% / 88px 88px no-repeat`);
  }
  const fox = o.foxing ?? 0.3;
  if (fox > 0.02) {
    const fk = (Math.round(fox * 4) / 4).toFixed(2);
    layers.push(`${cssVar(`fx-${seed % 5}-${fk.replace('.', '')}`, () => foxURL(`${seed % 5}|${fk}`))} ${even(seed * 53 % 256)}px ${even(seed * 29 % 256)}px / 256px 256px repeat`);
  }
  const folds = o.folds ?? 0;
  if (folds >= 1) layers.push(`${cssVar('fold-h', () => foldURL('h'))} 0 ${48 + (seed % 5)}% / 256px 8px repeat-x`);
  if (folds >= 2) layers.push(`${cssVar('fold-v', () => foldURL('v'))} ${48 + (seed % 4)}% 0 / 8px 256px repeat-y`);
  const edge = o.edge ?? 0.6;
  if (edge > 0.02) {
    const ek = (Math.round(edge * 4) / 4).toFixed(2);
    const e = (side: number) => cssVar(`ed${side}-${ek.replace('.', '')}-${tint.replace('#', '')}`, () => edgeURL(`${side}|${ek}|${tint}`));
    layers.push(`${e(0)} ${even(seed * 17 % 256)}px 0 / 256px 16px repeat-x`, `${e(2)} ${even(seed * 41 % 256)}px 100% / 256px 16px repeat-x`,
      `${e(3)} 0 ${even(seed * 23 % 256)}px / 16px 256px repeat-y`, `${e(1)} 100% ${even(seed * 61 % 256)}px / 16px 256px repeat-y`);
  }
  return layers.join(', ');
}

/** a full CSS `background` for aged paper: the age layers over the tiled paper */
export function paperBg(kind: PaperKind, seed = 1, o: AgeOpts = {}): string {
  const age = ageOverlay(seed, o);
  return `${age ? age + ', ' : ''}${paperTex(kind)} ${even((seed * 37) % 256)}px ${even((seed * 91) % 256)}px / 256px 256px repeat`;
}

// ---------------------------------------------------------------- edges

export type EdgeKind = 'straight' | 'deckle' | 'torn' | 'perforated';
export interface EdgeOpts { top?: EdgeKind; right?: EdgeKind; bottom?: EdgeKind; left?: EdgeKind; amp?: number }

/**
 * A clip-path polygon for ragged paper edges with pixel steps: every run along the edge sits at a
 * whole number of art pixels in from the edge, so torn paper reads as stepped pixel art at any size.
 * Deckle is the soft rough edge of handmade paper, torn a bigger ripped edge, perforated a
 * notebook's tear-off line. `amp` scales the raggedness.
 */
export function edgeClip(seed: number, o: EdgeOpts = {}): string {
  const R = rng(seed * 2654435761);
  const amp = o.amp ?? 1;
  const pts: string[] = [];
  const P = (v: number) => `${(v * PX).toFixed(0)}px`;
  type At = (t: string, d: number) => string;
  const side = (kind: EdgeKind | undefined, n: number, at: At) => {
    kind = kind ?? 'straight';
    if (kind === 'straight') { pts.push(at('0%', 0)); return; }
    const maxD = kind === 'torn' ? 4 : kind === 'perforated' ? 1 : 2;
    let t = 0, d = 0;
    const segs: [number, number][] = [];
    while (t < 100) {
      const w = kind === 'perforated' ? 1.1 + (segs.length % 2) * 1.3 : (kind === 'torn' ? 1.4 : 2) + R() * (kind === 'torn' ? 3 : 4.5);
      if (kind === 'perforated') d = segs.length % 2 ? 0 : maxD;
      else {
        const step = R() < 0.5 ? -1 : 1;
        d = Math.max(0, Math.min(maxD, d + step * (R() < 0.75 ? 1 : 2)));
      }
      segs.push([t, Math.round(d * amp)]);
      t += w * (46 / n) * 0.9;
    }
    segs.forEach(([t0, dd], i) => {
      const t1 = Math.min(100, segs[i + 1]?.[0] ?? 100);
      pts.push(at(`${t0.toFixed(2)}%`, dd), at(`${t1.toFixed(2)}%`, dd));
    });
  };
  side(o.top, 46, (t, d) => `${t} ${P(d)}`);
  side(o.right, 60, (t, d) => `calc(100% - ${P(d)}) ${t}`);
  side(o.bottom, 46, (t, d) => `calc(100% - ${t}) calc(100% - ${P(d)})`);
  side(o.left, 60, (t, d) => `${P(d)} calc(100% - ${t})`);
  return `polygon(${pts.join(', ')})`;
}

/** a CSS 4x4 dither pattern (for shadows and dimming done the pixel way): colour at 50% coverage */
export const ditherURL = memo((key: string) => {
  const [hex, covS] = key.split('|');
  const a = new Art(4, 4);
  const c = col(hex);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (dith(x, y, +covS)) a.put(x, y, c);
  return a.url(PX);
});
/** a dither layer as a CSS background value: `${ditherBg('#000', 0.5)}` */
export function ditherBg(hex: string, cov: number): string {
  const k = (Math.round(cov * 16) / 16).toFixed(3);
  return `${cssVar(`dz-${hex.replace('#', '')}-${k.replace('.', '')}`, () => ditherURL(`${hex}|${k}`))} 0 0 / 8px 8px repeat`;
}
