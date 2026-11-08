// V12 the HUD kit drawn as hand-made pixel art (the sprites: ./kitsprites.ts). Everything is set on the
// sprites' own pixel grid and the canvas is shown at a whole number of device px per pixel, so the
// pixels are real, crisp and visible (user: "the kit lower resolution, felt like real pixel art,
// handmade"). The live parts step through an idle loop of KIT_FRAMES frames:
//   backpack     the enamel mug on its carabiner and the luggage tag swing; now and then a buckle
//                glints; on hover the flap lifts off the open mouth of the pack
//   field guide  the silk ribbon sways; a glint runs over the gilt koru; on hover the cover swings
//                open on the first page (a kiwi sketched on it) and motes of light drift up off it
//   camera       a streak of light crosses the lens; the ready light is green; on hover the lens racks
//                out, the light blinks red and the flash charges; a click fires it; the film counter
//                shows the frames left (red when it's nearly out); the print slides out as it develops
//   laptop       its upload badge
// The button around each: a dithered shadow on the ground, the object lifting on hover and pressed
// down on a click, a sweep of light across it, a little pixel keycap with its key.

import { Art, col, mixC, bayer } from '../v11/paper/px';
import { KIT_PAL, KIT_SPR } from './kitsprites';
import type { KitKind } from '../v11/kitart';

/** the canvas in sprite pixels: the 26 x 26 object, room above it to lift and below for its shadow */
export const KIT_W = 30, KIT_H = 34;
export const KIT_FRAMES = 16;
const N = 26;
const C: Record<string, number> = {};
for (const k of Object.keys(KIT_PAL)) C[k] = col(KIT_PAL[k]);
const WHITE = col('#ffffff');

export interface KitPixState {
  /** the idle loop's frame */
  t: number;
  /** 0..1 how far it's opened (hover) */
  open: number;
  /** 0..1 the click's burst (the camera's flash) */
  fire: number;
  /** sprite px up (hover) or down (press, negative) */
  lift: number;
  /** 0..1 the sweep of light across it, -1 none */
  glint: number;
  /** its key (a keycap at its top right), if any */
  key?: string;
  shots?: number;
  develop?: number;
  badge?: number;
}

/** 3 x 5 digits and the kit's key letters */
const G35: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], 'I': ['###', '.#.', '.#.', '.#.', '###'], 'G': ['.##', '#..', '#.#', '#.#', '.##'],
  'L': ['#..', '#..', '#..', '#..', '###'], 'C': ['.##', '#..', '#..', '#..', '.##'], '+': ['...', '.#.', '###', '.#.', '...'],
};

/** a working grid: the sprite's characters, plus run-time pixels set as raw colours */
class Grid {
  ch: string[][];
  raw = new Map<number, number>();
  constructor(base: string[]) { this.ch = base.map(r => r.split('')); }
  over(spr: string[]) { spr.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') this.ch[y][x] = r[x]; }); }
  set(x: number, y: number, c: string | number) {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    if (typeof c === 'number') this.raw.set(y * N + x, c); else { this.ch[y][x] = c; this.raw.delete(y * N + x); }
  }
  at(x: number, y: number) { return x < 0 || y < 0 || x >= N || y >= N ? '.' : this.ch[y][x]; }
  color(x: number, y: number): number {
    const r = this.raw.get(y * N + x);
    if (r !== undefined) return r;
    const c = this.ch[y][x];
    return c === '.' ? 0 : C[c];
  }
}

/** a four-pointed glint: a white core, gold arms (s: 0 none, 1 a pixel, 2 the cross) */
function glint(g: Grid, x: number, y: number, s: number) {
  if (s <= 0) return;
  g.set(x, y, '5');
  if (s > 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.at(x + dx, y + dy) !== '.') g.set(x + dx, y + dy, 'Y');
}

function compose(kind: KitKind, s: KitPixState): Grid {
  const f = ((Math.round(s.t) % KIT_FRAMES) + KIT_FRAMES) % KIT_FRAMES, ph = (f / KIT_FRAMES) * Math.PI * 2;
  const open = s.open > 0.5;
  const pick3 = (v: number, l: string, c: string, r: string) => (v > 0.35 ? r : v < -0.35 ? l : c);
  if (kind === 'pack') {
    const g = new Grid(KIT_SPR[open ? 'packOpen' : 'pack']);
    g.over(KIT_SPR[pick3(Math.sin(ph) + (open ? 0.5 : 0), 'mugL', 'mugC', 'mugR')]);
    g.over(KIT_SPR[pick3(Math.sin(ph * 2 + 1.3), 'tagL', 'tagC', 'tagR')]);
    glint(g, 19, 15, f === 1 ? 2 : f === 0 || f === 2 ? 1 : 0);
    return g;
  }
  if (kind === 'guide') {
    const g = new Grid(KIT_SPR[open ? 'guideOpen' : 'guide']);
    g.over(KIT_SPR[pick3(Math.sin(ph) + (open ? 0.6 : 0), 'ribL', 'ribC', 'ribR')]);
    const k = (f + 8) % KIT_FRAMES;
    if (!open) glint(g, 14, 8, k === 1 ? 2 : k === 0 || k === 2 ? 1 : 0);
    else for (let i = 0; i < 4; i++) {
      // motes of light drifting up off the open page
      const y = 19 - ((f + i * 5) % 14), x = 10 + i * 3 + (Math.sin(ph + i) > 0 ? 1 : 0);
      if (y > 0 && g.at(x, y) !== '.') g.set(x, y, y < 8 ? 'Y' : 'z');
    }
    return g;
  }
  if (kind === 'lap') return new Grid(KIT_SPR.lap);
  // the camera
  const g = new Grid(KIT_SPR[open ? 'camRacked' : 'cam']);
  // a streak of light across the glass
  if (f >= 4 && f < 8) {
    const d = (f - 4) * 2 - 3;
    for (let k = -3; k <= 3; k++) { const x = 8 + d + k, y = 15 + k; if ('678'.includes(g.at(x, y))) g.set(x, y, '9'); }
  }
  // the ready light: green and steady; red and blinking while the flash charges
  g.set(11, 7, open ? (f % 4 < 2 ? '%' : '&') : '#');
  // the flash charging, then firing
  if (open) for (let y = 9; y <= 10; y++) for (let x = 3; x <= 5; x++) g.set(x, y, (x + y + f) % 2 ? 'Y' : 'z');
  if (s.fire > 0) {
    for (let y = 8; y <= 11; y++) for (let x = 2; x <= 6; x++) g.set(x, y, '5');
    const R = Math.round(2 + s.fire * 5);
    for (let k = 1; k <= R; k++) {
      const c = k < R * 0.5 ? '5' : 'Y';
      g.set(4 + k + 1, 9, c); g.set(4 - k - 1, 9, c); g.set(4, 9 - k - 1, c); g.set(4, 10 + k, c);
      if (k < R * 0.6) { g.set(4 + k + 1, 9 - k - 1, 'Y'); g.set(4 - k - 1, 9 - k - 1, 'Y'); }
    }
  }
  // the film counter: frames left (a + when there are more than nine), red when it's nearly out
  const n = Math.max(0, Math.round(s.shots ?? 0));
  const ink = n <= 2 ? C.X : C.k;
  const dg = G35[String(Math.min(9, n))];
  dg.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === '#') g.set(19 + x, 8 + y, ink); });
  if (n > 9) g.set(22, 8, ink);
  return g;
}

/**
 * Paint a kit button into `a` (KIT_W x KIT_H sprite px): its shadow on the ground, the object lifted or
 * pressed, a sweep of light across it on hover, the key it answers to, a count badge.
 */
export function paintKitPix(a: Art, kind: KitKind, s: KitPixState) {
  const g = compose(kind, s);
  const ox = 2, oy = 4 - Math.round(s.lift);
  // the shadow: an ellipse of dithered dark on the ground, smaller and fainter the higher it's lifted
  const lift = Math.max(0, s.lift);
  const rx = 12 - lift, dens = 0.55 - lift * 0.1;
  for (let y = 0; y < 4; y++) for (let x = 0; x < KIT_W; x++) {
    const dx = (x - KIT_W / 2) / rx, dy = (y - 1.5) / 1.8;
    if (dx * dx + dy * dy < 1 && bayer(x, y) < dens * (1 - dx * dx * 0.6)) a.put(x, 30 + y, col('#000000', 0.45));
  }
  // the object, the sweep of light across it
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = g.color(x, y);
    if (!c) continue;
    if (s.glint >= 0) {
      const band = (x + y * 0.6) / (N * 1.6) - (s.glint * 1.5 - 0.25);
      if (Math.abs(band) < 0.035) c = mixC(c, WHITE, 0.6);
      else if (Math.abs(band) < 0.06) c = mixC(c, WHITE, 0.25);
    }
    a.put(ox + x, oy + y, c);
  }
  // the print sliding out of the camera's slot as it develops: dark brown coming up to the picture
  if (kind === 'cam' && (s.develop ?? 1) < 1) {
    const dev = Math.max(0, s.develop ?? 0), rise = Math.min(4, Math.round(dev * 12));
    for (let y = 0; y < rise; y++) for (let x = 0; x < 9; x++) {
      const edge = x === 0 || x === 8 || y === rise - 1;
      const img = y < 2 ? mixC(col('#3a2a1a'), C.V, dev) : mixC(col('#3a2a1a'), C.K, dev);
      a.put(ox + 9 + x, oy + 23 + y, edge ? C.z : img);
    }
  }
  // the key it answers to: a little ivory keycap with the letter pressed in
  if (s.key) {
    const kx = KIT_W - 8, ky = Math.max(0, oy - 3);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) {
      const corner = (x === 0 || x === 6) && (y === 0 || y === 7);
      if (corner) continue;
      const rim = x === 0 || x === 6 || y === 0 || y === 7;
      a.put(kx + x, ky + y, rim ? C.k : y >= 6 ? C.a : C.z);
    }
    const L = G35[s.key.toUpperCase()] ?? G35.I;
    L.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === '#') a.put(kx + 2 + x, ky + 1 + y, C.l); });
  }
  // a count badge (photos to upload): a red disc and the number
  if (s.badge && s.badge > 0) {
    const bx = KIT_W - 8, by = Math.max(0, oy - 2);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const d = (x - 3) ** 2 + (y - 3) ** 2;
      if (d > 11) continue;
      a.put(bx + x, by + y, d > 7 ? C.k : C.X);
    }
    const D = G35[String(Math.min(9, s.badge))];
    D.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === '#') a.put(bx + 2 + x, by + 1 + y, C.z); });
  }
}
