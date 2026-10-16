// V11 Blueprints: the papers, painted pixel by pixel. Each designer draws on their own stock:
//   agency   blueprint: prussian blue, a dotted grid, white worn edges, fold creases
//   aroha    harakeke (flax) paper: beaten fibres in strips, deckled edges
//   village  flax paper with a tāniko band along the top and bottom
//   jenna    graph paper torn off a pad, grease thumbprints and a coffee ring
//   joshu    kraft paper off a parcel, fibres, folded in four, an oil spot
//   ranger   an official card form (the header is printed by the sheet)
//   mori     a page torn out of his field journal: ruled, a red margin
//   whaler   old parchment: foxed, toasted edges, a corner missing
// Colours come from small ramps picked with ordered dither, so there are no gradients and no blending.

import { PixelBuffer } from '../../../art/pixel';
import { hex, mix } from '../../../art/color';
import type { C } from '../../../art/color';
import type { Designer } from '../../../game/v11/blueprints';
import { dith, rnd, vnoise } from './pxdraw';
import type { InkStyle } from './pxdraw';
import type { TextStyle } from './pxfont';

export type PaperId = 'blueprint' | 'flax' | 'village' | 'graph' | 'kraft' | 'form' | 'journal' | 'parchment';
const H = (s: string) => hex(s);

/** the ink a designer writes and draws with */
export interface Ink {
  paper: PaperId;
  /** main stroke, softer construction / hatching, accent (corrections, ticks, stamps) */
  c: C; soft: C; accent: C;
  style: InkStyle;
  /** handwriting */
  hand: Omit<TextStyle, 'color'>;
  /** who signs it */
  sig: string;
  /** the colour the paper itself is in the middle (for ghosting, knock-outs) */
  bg: C;
}
export const INKS: Record<Designer, Ink> = {
  agency: { paper: 'blueprint', c: H('#e8f0fc'), soft: H('#86aade'), accent: H('#ffd27a'), style: 'tech', hand: { font: 'hand', slant: 0.12 }, sig: 'ZEA R&D', bg: H('#22497f') },
  aroha: { paper: 'flax', c: H('#2a1e18'), soft: H('#7a6246'), accent: H('#9a3a22'), style: 'charcoal', hand: { font: 'hand', slant: 0.22, wander: 0.18, smudge: 0.1 }, sig: 'Aroha', bg: H('#d4ba86') },
  village: { paper: 'village', c: H('#2a1e18'), soft: H('#7a6246'), accent: H('#9a3a22'), style: 'charcoal', hand: { font: 'hand', slant: 0.2, wander: 0.15, smudge: 0.08 }, sig: 'Te Kāinga', bg: H('#d4ba86') },
  jenna: { paper: 'graph', c: H('#26388a'), soft: H('#8392c4'), accent: H('#c8302c'), style: 'biro', hand: { font: 'hand', slant: 0.25, wander: 0.22 }, sig: 'Jenna', bg: H('#e9e2ca') },
  joshu: { paper: 'kraft', c: H('#2a2622'), soft: H('#6a5e50'), accent: H('#7a2a1e'), style: 'pencil', hand: { font: 'hand', slant: 0.1, wander: 0.12, dropout: 0.08 }, sig: 'Joshu', bg: H('#ad865e') },
  ranger: { paper: 'form', c: H('#24262a'), soft: H('#7e8a82'), accent: H('#2f6b3a'), style: 'tech', hand: { font: 'hand', slant: 0.15, wander: 0.1 }, sig: 'Island Ranger Service', bg: H('#e6e3d2') },
  mori: { paper: 'journal', c: H('#3a2a1c'), soft: H('#8a7458'), accent: H('#2a6a8a'), style: 'pencil', hand: { font: 'hand', slant: 0.2, wander: 0.15, dropout: 0.05 }, sig: 'Mori', bg: H('#efe4c6') },
  whaler: { paper: 'parchment', c: H('#3a2414'), soft: H('#7a5434'), accent: H('#7a2a14'), style: 'biro', hand: { font: 'hand', slant: 0.28, wander: 0.2 }, sig: 'unsigned', bg: H('#c4a066') },
};

const RAMPS: Record<PaperId, C[]> = {
  blueprint: ['#152f5c', '#1b3b6e', '#22497f', '#28528c', '#30609c'].map(H),
  flax: ['#9c8054', '#b49766', '#c8ac7a', '#d8be8a', '#e6d0a0'].map(H),
  village: ['#9c8054', '#b49766', '#c8ac7a', '#d8be8a', '#e6d0a0'].map(H),
  graph: ['#cfc6ac', '#ddd5bb', '#e9e2ca', '#f2ecd8'].map(H),
  kraft: ['#86623e', '#9a744e', '#ad865e', '#bc966c', '#caa67c'].map(H),
  form: ['#c9c6b4', '#d9d6c4', '#e6e3d2', '#f0eee0'].map(H),
  journal: ['#d6c8a6', '#e2d5b4', '#efe4c6', '#f6eed8'].map(H),
  parchment: ['#8e683c', '#a6804c', '#ba965e', '#ccaa72', '#dcbe86'].map(H),
};
/** a ramp colour for v in 0..1, the in-between dithered */
function pick(r: C[], v: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.9999, v)) * (r.length - 1);
  const i = Math.floor(f);
  return r[dith(x, y, f - i) ? Math.min(r.length - 1, i + 1) : i];
}

type Edge = 'straight' | 'deckle' | 'torn' | 'perf';
/** how far in from each side the paper starts, per row / column */
function edges(w: number, h: number, seed: number, e: { t: Edge; r: Edge; b: Edge; l: Edge }) {
  const prof = (n: number, kind: Edge, s: number) => {
    const a = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      if (kind === 'straight') a[i] = 0;
      else if (kind === 'deckle') a[i] = Math.round(vnoise(i / 2.2, s, s) * 1.6 + (rnd(i, s, 3) < 0.12 ? 1 : 0));
      else if (kind === 'torn') a[i] = Math.round(vnoise(i / 7, s, s) * 3 + vnoise(i / 1.6, s + 1, s) * 1.4);
      else a[i] = i % 4 === 1 ? 1 : 0;
    }
    return a;
  };
  return { L: prof(h, e.l, seed + 1), R: prof(h, e.r, seed + 2), T: prof(w, e.t, seed + 3), B: prof(w, e.b, seed + 4) };
}

export interface PaperOpts { seed?: number; folds?: boolean }

/**
 * Paint a sheet of paper (w x h); outside its ragged edges stays transparent. Returns the buffer and
 * an inside(x, y) test.
 */
export function paintPaper(kind: PaperId, w: number, h: number, o: PaperOpts = {}): { buf: PixelBuffer; inside: (x: number, y: number) => boolean } {
  const seed = o.seed ?? 3;
  const b = new PixelBuffer(w, h);
  const R = RAMPS[kind];
  const E = edges(w, h, seed, ({
    blueprint: { t: 'deckle', r: 'deckle', b: 'deckle', l: 'deckle' },
    flax: { t: 'deckle', r: 'torn', b: 'deckle', l: 'torn' },
    village: { t: 'straight', r: 'deckle', b: 'straight', l: 'deckle' },
    graph: { t: 'perf', r: 'straight', b: 'straight', l: 'straight' },
    kraft: { t: 'torn', r: 'deckle', b: 'torn', l: 'deckle' },
    form: { t: 'straight', r: 'straight', b: 'straight', l: 'straight' },
    journal: { t: 'straight', r: 'straight', b: 'straight', l: 'torn' },
    parchment: { t: 'torn', r: 'torn', b: 'torn', l: 'torn' },
  } as Record<PaperId, { t: Edge; r: Edge; b: Edge; l: Edge }>)[kind]);
  // a missing corner on the old parchment
  const bite = kind === 'parchment' ? (x: number, y: number) => x + (h - y) < 14 + vnoise(x / 3, y / 3, seed) * 4 : () => false;
  const inside = (x: number, y: number) => x >= E.L[y] && x < w - E.R[y] && y >= E.T[x] && y < h - E.B[x] && !bite(x, y);
  const edgeDist = (x: number, y: number) => Math.min(x - E.L[y], w - 1 - E.R[y] - x, y - E.T[x], h - 1 - E.B[x] - y);
  const fx = Math.round(w * 0.5) + (seed % 5) - 2, fy = Math.round(h * 0.52);

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const d = edgeDist(x, y);
    let v = 0.6, c: C | null = null;
    const n1 = vnoise(x / 15, y / 15, seed), n2 = vnoise(x / 4.5, y / 4.5, seed + 7);
    switch (kind) {
      case 'blueprint': {
        v = 0.5 + (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.18;
        if (d < 5) v += (5 - d) * 0.08;
        c = pick(R, v, x, y);
        // the printed grid: dotted minor lines, solid major lines
        const gx = (x - 4) % 6 === 0, gy = (y - 4) % 6 === 0, Gx = (x - 4) % 30 === 0, Gy = (y - 4) % 30 === 0;
        if (Gx || Gy) c = mix(c, H('#4f80bf'), 0.55);
        else if ((gx && y % 2 === 0) || (gy && x % 2 === 0)) c = mix(c, H('#4a78b6'), 0.38);
        break;
      }
      case 'flax': case 'village': {
        const strip = Math.floor((y + vnoise(x / 26, 0, seed) * 3) / 5);
        v = 0.55 + (rnd(strip, 0, seed) - 0.5) * 0.25 + (n1 - 0.5) * 0.3;
        const f = vnoise(x / 1.4, y * 2.6, seed + 3);
        if (f > 0.8) v -= 0.22; else if (f < 0.14) v += 0.16;
        if (d < 3) v -= 0.12;
        c = pick(R, v, x, y);
        if (rnd(x, y, seed + 11) < 0.003) c = H('#5e4628');
        break;
      }
      case 'graph': {
        v = 0.7 + (n1 - 0.5) * 0.2 + (n2 - 0.5) * 0.1;
        c = pick(R, v, x, y);
        if ((x - 3) % 20 === 0 || (y - 6) % 20 === 0) c = mix(c, H('#7f9cb8'), 0.5);
        else if ((x - 3) % 4 === 0 || (y - 6) % 4 === 0) c = mix(c, H('#9cb4c8'), 0.32);
        break;
      }
      case 'kraft': {
        v = 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2;
        const f = vnoise(x / 2.2, y * 1.6, seed + 5);
        if (f > 0.84) v += 0.2; else if (f < 0.1) v -= 0.18;
        c = pick(R, v, x, y);
        if (rnd(x, y, seed + 13) < 0.004) c = H('#5a3e24');
        break;
      }
      case 'form': {
        v = 0.66 + (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.06;
        if (d < 2) v -= 0.18;
        c = pick(R, v, x, y);
        break;
      }
      case 'journal': {
        v = 0.66 + (n1 - 0.5) * 0.18 + (n2 - 0.5) * 0.08;
        c = pick(R, v, x, y);
        if (y > 14 && (y - 14) % 10 === 0) c = mix(c, H('#8eaac6'), 0.42);
        if (x === 13 || x === 14) c = mix(c, H('#d07a6a'), 0.45);
        break;
      }
      case 'parchment': {
        v = 0.58 + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.22;
        if (d < 9) v -= (9 - d) * 0.05;
        c = pick(R, v, x, y);
        if (vnoise(x / 2, y / 2, seed + 21) > 0.86 && n1 > 0.55) c = H('#8a5c32');
        break;
      }
    }
    b.set(x, y, c!);
  }
  // folds: a bright ridge and its shadow
  if (o.folds !== false && (kind === 'blueprint' || kind === 'kraft' || kind === 'parchment')) {
    for (let y = 0; y < h; y++) if (inside(fx, y)) { b.set(fx, y, mix(b.get(fx, y), H('#ffffff'), kind === 'blueprint' ? 0.16 : 0.12)); if (inside(fx + 1, y)) b.set(fx + 1, y, mix(b.get(fx + 1, y), H('#000000'), 0.16)); }
    for (let x = 0; x < w; x++) if (inside(x, fy)) { b.set(x, fy, mix(b.get(x, fy), H('#ffffff'), kind === 'blueprint' ? 0.14 : 0.1)); if (inside(x, fy + 1)) b.set(x, fy + 1, mix(b.get(x, fy + 1), H('#000000'), 0.14)); }
  }
  // grease thumbprints and a coffee ring on Jenna's pad; an oil spot on Joshu's
  if (kind === 'graph') {
    const prints: [number, number, number][] = [[w * 0.86, h * 0.22, 0.6], [w * 0.12, h * 0.8, -0.4]];
    for (const [cx, cy, a] of prints) {
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let y = Math.floor(cy - 9); y <= cy + 9; y++) for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
        if (!inside(x, y)) continue;
        const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / 5.5, t = (-dx * sa + dy * ca) / 7.5, r = Math.hypot(u, t);
        if (r > 1) continue;
        if (Math.sin(r * 15 + u * 2) > 0.35 && dith(x, y, 0.55 * (1 - r * 0.6))) b.set(x, y, mix(b.get(x, y), H('#6a5a44'), 0.42));
      }
    }
    const rx = w * 0.62, ry = h * 0.86, rr = 11;
    for (let y = Math.floor(ry - rr - 1); y <= ry + rr + 1; y++) for (let x = Math.floor(rx - rr - 1); x <= rx + rr + 1; x++) {
      if (!inside(x, y)) continue;
      const r = Math.hypot(x - rx, (y - ry) * 1.12);
      if (Math.abs(r - rr) < 1.1 && vnoise(x / 3, y / 3, seed) > 0.3) b.set(x, y, mix(b.get(x, y), H('#9a7046'), 0.4));
      else if (r < rr - 1 && dith(x, y, 0.12)) b.set(x, y, mix(b.get(x, y), H('#a87e52'), 0.25));
    }
  }
  if (kind === 'kraft') {
    const cx = w * 0.78, cy = h * 0.3;
    for (let y = Math.floor(cy - 8); y <= cy + 8; y++) for (let x = Math.floor(cx - 10); x <= cx + 10; x++) {
      if (!inside(x, y)) continue;
      const r = Math.hypot((x - cx) / 10, (y - cy) / 7) + (vnoise(x / 3, y / 3, seed) - 0.5) * 0.3;
      if (r < 1) b.set(x, y, mix(b.get(x, y), H('#5e4024'), r < 0.8 ? 0.28 : 0.4));
    }
  }
  // the tāniko bands: black, red-ochre and cream triangles
  if (kind === 'village') {
    for (const y0 of [2, h - 9]) for (let j = 0; j < 7; j++) for (let x = 0; x < w; x++) {
      const y = y0 + j;
      if (!inside(x, y)) continue;
      if (j === 0 || j === 6) { b.set(x, y, H('#2a201c')); continue; }
      const t = ((x % 12) + 12) % 12, up = Math.abs(t - 6) <= (j - 1) + 1;
      const band = Math.floor(x / 12) % 2;
      b.set(x, y, up ? (band ? H('#9a3a22') : H('#2a201c')) : H('#e2cc98'));
    }
  }
  // the very edge: worn light on the blueprint, a darker fibre rim elsewhere
  const rim = kind === 'blueprint' ? H('#6f97cf') : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
    b.set(x, y, rim ?? mix(b.get(x, y), H('#000000'), 0.22));
  }
  // punched holes on the left of the journal page (torn from the rings)
  if (kind === 'journal') for (let y = 12; y < h - 6; y += 22) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) b.set(6 + dx, y + dy, 0);
  return { buf: b, inside };
}

/** a hard pixel drop shadow for a sheet: its silhouette, offset, in a darker table colour */
export function shadowOf(src: PixelBuffer, c: C, dx = 2, dy = 3): PixelBuffer {
  const out = new PixelBuffer(src.w + dx, src.h + dy);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.data[y * src.w + x] >>> 24) out.set(x + dx, y + dy, c);
  return out;
}
