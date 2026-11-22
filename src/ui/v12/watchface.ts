// V12 Mori's field watch, painted (user: "the watch ui better cooler not ai"). The body is a hand-made
// sprite (./watchsprites.ts: the strap, the composite case, the steel compass bezel, the pushers and the
// crown); this module lays it down on whole pixels and paints the display behind the glass the way a
// real one works: a negative LCD whose every element sits in a fixed place, the unlit segments faintly
// visible (ghosts), lit in pale mint and a few colours:
//   the dome     a sun sub-dial under the twelve: the sun's path from sunrise to dark over a little
//                horizon, the passed part solid, dusk and dark notched, the sun on it (the moon at night)
//   the time     7-segment digits (a half-digit for the ten hours), the colon blinking the seconds
//   the row      AM / PM and the expedition day, small
//   the smile    stamina as chunky segments round the bottom of the display (a bolt at its end): the part
//                hunger locks hatched out, the last segment flickering when it's low, all of it blinking
//                red winded
// Faces: time, body (stamina big, the heart and its rate, hunger as pips), sun (how long until dark),
// timer (a countdown's seconds, its time left round the smile) and dive (V12 on the kelp dive: the depth
// big, the air round the smile with a tank, stamina up in the dome, the time small). The backlight
// (after dark, under 8 m, or LIGHT pressed) is flat quantised light: three hard bands brightest by the
// LED at six, the ghosts showing through, never a soft glow. Over it all the crystal: a hand-placed
// glint, a scratch, and now and then a glint that drifts across.

import { WATCH_PAL, WATCH_SPR, WL, WS } from './watchsprites';

export type FaceId = 'time' | 'body' | 'sun' | 'timer' | 'dive';
export interface FaceState {
  face: FaceId;
  /** hour of day, 0..24 */
  hour: number;
  /** the hour it gets dark */
  dark: number;
  /** the hour dusk starts */
  dusk: number;
  day?: number;
  /** stamina 0..1 (undefined: the smile shows the daylight left) */
  stamina?: number;
  staminaMax?: number;
  winded?: boolean;
  bpm?: number;
  hunger?: number;
  /** timer: the fraction left, its seconds */
  left?: number;
  secs?: number;
  red?: boolean;
  dive?: { depth: number; air: number } | null;
  lit: boolean;
  press?: string | null;
  /** bezel frame 0..3 (it turns a click at a time on hover) */
  bezel?: number;
  /** whole-pixel jitter */
  jx?: number;
  jy?: number;
  /** seconds (animation) */
  T: number;
}

// ---------------------------------------------------------------- colours
const rgba = (h: string, a = 255) => {
  const v = parseInt(h.slice(1, 7), 16);
  return ((a << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255)) >>> 0;
};
const PAL: Record<string, number> = {};
for (const k of Object.keys(WATCH_PAL)) PAL[k] = rgba(WATCH_PAL[k]);

/** the display's colours: unlit, and with the backlight on */
const LCD = {
  bg: rgba('#0a110f'), rim: rgba('#050807'), ghost: rgba('#16231d'), ink: rgba('#d4ecdd'), dim: rgba('#6f8f80'), faint: rgba('#2a3d34'),
  litBg: [rgba('#0c3a37'), rgba('#11524b'), rgba('#196b62')], litRim: rgba('#082725'), litGhost: rgba('#1f7067'), litInk: rgba('#f2fff8'), litDim: rgba('#a8dccd'), litFaint: rgba('#2c7a70'),
  green: [rgba('#3f8a2c'), rgba('#94e05c')], amber: [rgba('#a8680c'), rgba('#ffc23e')], red: [rgba('#a0220e'), rgba('#ff5a3c')],
  air: [rgba('#16889a'), rgba('#68e6f0')], sun: [rgba('#c8860e'), rgba('#ffd54a')], sunHi: rgba('#fff6c0'), moon: rgba('#c8d6ff'), dark: rgba('#7aa2ff'),
  lock: rgba('#2e1c10'), lockH: rgba('#5e3618'), heart: rgba('#ff5a5a'), heartHi: rgba('#ffb0a8'), white: rgba('#ffffff'),
};

// ---------------------------------------------------------------- the glyphs
/** 7-segment digits, 5 x 9: a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle */
const SEG7: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };
const SEGPX5: Record<string, [number, number][]> = (() => {
  const o: Record<string, [number, number][]> = { a: [], b: [], c: [], d: [], e: [], f: [], g: [] };
  for (let i = 1; i <= 3; i++) { o.a.push([i, 0]); o.g.push([i, 4]); o.d.push([i, 8]); }
  for (let j = 1; j <= 3; j++) { o.f.push([0, j]); o.b.push([4, j]); o.e.push([0, j + 4]); o.c.push([4, j + 4]); }
  return o;
})();
/** 3 x 5 segment digits (the small watch) */
const SEGPX3: Record<string, [number, number][]> = { a: [[1, 0]], b: [[2, 1]], c: [[2, 3]], d: [[1, 4]], e: [[0, 3]], f: [[0, 1]], g: [[1, 2]] };
// (the corners of a 3x5 segment digit belong to whichever segments meet there)
const CORNER3: [number, number, string][] = [[0, 0, 'af'], [2, 0, 'ab'], [0, 2, 'efg'], [2, 2, 'bcg'], [0, 4, 'de'], [2, 4, 'cd']];

/** a tiny 3 x 5 face for the display's words */
const TINY: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', W: '101101111111101', Y: '101101010010010', '%': '101001010100101', ':': '000010000010000', '!': '010010010000010',
  '-': '000000111000000', ' ': '000000000000000', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111',
};

// ---------------------------------------------------------------- the buffer
export class WatchBuf {
  d: Uint32Array;
  constructor(public w: number, public h: number) { this.d = new Uint32Array(w * h); }
  set(x: number, y: number, c: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
}

/** a sprite's rows onto the buffer ('.' skipped; `only` limits it to some characters) */
function stamp(b: WatchBuf, rows: string[], x0: number, y0: number, mask?: (ch: string, x: number, y: number) => boolean) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.' || (mask && !mask(ch, x0 + i, y0 + j))) continue;
      b.set(x0 + i, y0 + j, PAL[ch]);
    }
  }
}

// ---------------------------------------------------------------- sizes
/** the two hand-made watches: the HUD's (L) and the small one over Mori for timers (S) */
export type Variant = 'L' | 'S';
const DIMS = { L: WL, S: WS };
/** the variant and the whole-number scale for a case of about `size` px */
export function pickVariant(size: number): { v: Variant; k: number } {
  const s = Math.max(14, size);
  let best = { v: 'L' as Variant, k: 1, e: Infinity };
  for (const v of ['L', 'S'] as Variant[]) {
    const c = DIMS[v].case;
    for (let k = 1; k <= 6; k++) {
      const e = Math.abs(c * k - s) / s + (c * k > s * 1.15 ? 0.5 : 0);
      if (e < best.e) best = { v, k, e };
    }
  }
  return { v: best.v, k: best.k };
}
/** the canvas a watch of about `size` needs (the sprite and a pixel of shake each way, scaled) */
export function watchDims(size: number): { w: number; h: number } {
  const { v, k } = pickVariant(size);
  return { w: (DIMS[v].w + 2) * k, h: (DIMS[v].h + 2) * k };
}

// ---------------------------------------------------------------- paint
export function paintWatch(size: number, st: FaceState): WatchBuf {
  const { v, k } = pickVariant(size);
  const D = DIMS[v];
  const b1 = new WatchBuf(D.w + 2, D.h + 2);
  const ox = 1 + (st.jx ?? 0), oy = 1 + (st.jy ?? 0);
  // the body, the bezel's frame, the pushers and the crown
  stamp(b1, WATCH_SPR[v], ox, oy);
  const bf = Math.max(0, Math.min(3, Math.round(st.bezel ?? 0)));
  if (bf > 0) stamp(b1, WATCH_SPR[`${v}bez${bf}`], ox + D.cx - D.rb, oy + D.cy - D.rb);
  for (const p of D.push) {
    // (a held pusher sits a pixel into the case)
    const sx = st.press === p.id ? -p.side : 0;
    stamp(b1, WATCH_SPR[p.spr], ox + D.cx + p.x + sx, oy + D.cy + p.y);
  }
  stamp(b1, WATCH_SPR[`${v}crown`], ox + D.cx + D.crown[0], oy + D.cy + D.crown[1]);
  // the display
  paintLcd(b1, ox + D.cx, oy + D.cy, D.lcd, v, st);
  if (k === 1) return b1;
  const b = new WatchBuf(b1.w * k, b1.h * k);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.d[y * b.w + x] = b1.d[((y / k) | 0) * b1.w + ((x / k) | 0)];
  return b;
}

// ---------------------------------------------------------------- the display
interface Lcd {
  b: WatchBuf; cx: number; cy: number; R: number; st: FaceState;
  ink: number; dim: number; ghost: number; faint: number;
}
function inLcd(L: Lcd, x: number, y: number) { const dx = x - L.cx, dy = y - L.cy; return dx * dx + dy * dy <= (L.R + 0.45) ** 2; }
function put(L: Lcd, x: number, y: number, c: number) { if (inLcd(L, L.cx + x, L.cy + y)) L.b.set(L.cx + x, L.cy + y, c); }

function paintLcd(b: WatchBuf, cx: number, cy: number, R: number, v: Variant, st: FaceState) {
  const lit = st.lit;
  const L: Lcd = { b, cx, cy, R, st, ink: lit ? LCD.litInk : LCD.ink, dim: lit ? LCD.litDim : LCD.dim, ghost: lit ? LCD.litGhost : LCD.ghost, faint: lit ? LCD.litFaint : LCD.faint };
  // the ground: flat; lit, three hard bands curving up from the LED at six
  for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
    const d2 = x * x + y * y;
    if (d2 > (R + 0.45) ** 2) continue;
    const rim = d2 > (R - 0.55) ** 2;
    let c: number;
    if (!lit) c = rim ? LCD.rim : LCD.bg;
    else {
      const e = Math.hypot(x, y - R * 1.5);
      c = rim ? LCD.litRim : e < R * 1.05 ? LCD.litBg[2] : e < R * 1.6 ? LCD.litBg[1] : LCD.litBg[0];
    }
    b.set(cx + x, cy + y, c);
  }
  if (v === 'L') lcdL(L); else lcdS(L);
  glass(L, v);
}

/** the crystal: a hand-placed glint top left, a fine scratch low right, a glint drifting over now and then */
function glass(L: Lcd, v: Variant) {
  const hi = (x: number, y: number, a: number) => {
    const X = L.cx + x, Y = L.cy + y;
    if (!inLcd(L, X, Y)) return;
    const c = L.b.get(X, Y);
    const m = (s: number) => Math.round(((c >>> s) & 255) + (255 - ((c >>> s) & 255)) * a);
    L.b.set(X, Y, ((255 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0);
  };
  if (v === 'L') {
    for (const [x, y, a] of [[-9, -9, 0.5], [-10, -8, 0.5], [-11, -7, 0.35], [-8, -10, 0.35], [-7, -11, 0.18], [-10, -6, 0.12], [-11, -4, 0.1]] as [number, number, number][]) hi(x, y, a);
    for (const [x, y] of [[5, 11], [6, 10], [7, 10], [8, 9]]) hi(x, y, 0.07);
    const g = ((L.st.T * 0.16) % 1.7) - 0.35;
    if (g > 0 && g < 1) {
      const x0 = Math.round(-14 + g * 22), y0 = Math.round(-4 + g * 6);
      for (let i = 0; i < 4; i++) hi(x0 + i, y0 - i, 0.32);
    }
  } else {
    for (const [x, y, a] of [[-5, -5, 0.45], [-6, -4, 0.3], [-4, -6, 0.25]] as [number, number, number][]) hi(x, y, a);
  }
}

// ---------------------------------------------------------------- display parts
function tinyW(t: string) { return t.length * 4 - 1; }
function tiny(L: Lcd, t: string, x: number, y: number, c: number) {
  for (let i = 0; i < t.length; i++) {
    const g = TINY[t[i].toUpperCase()] ?? TINY[' '];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') put(L, x + i * 4 + q, y + r, c);
  }
}
/** a 5 x 9 segment digit at (x, y): the ghost of every segment, the lit ones over it */
function seg5(L: Lcd, ch: string, x: number, y: number, c: number, ghost = true) {
  const on = SEG7[ch] ?? '';
  for (const s of 'abcdefg') {
    const lit = on.includes(s);
    if (!lit && !ghost) continue;
    for (const [i, j] of SEGPX5[s]) put(L, x + i, y + j, lit ? c : L.ghost);
  }
}
/** the half-digit: a 1 for the ten hours (b and c of a narrow cell) */
function half5(L: Lcd, on: boolean, x: number, y: number, c: number) {
  for (const j of [1, 2, 3, 5, 6, 7]) put(L, x, y + j, on ? c : L.ghost);
}
function seg3(L: Lcd, ch: string, x: number, y: number, c: number, ghost = true) {
  const on = SEG7[ch] ?? '';
  for (const s of 'abcdefg') {
    const lit = on.includes(s);
    if (!lit && !ghost) continue;
    for (const [i, j] of SEGPX3[s]) put(L, x + i, y + j, lit ? c : L.ghost);
  }
  for (const [i, j, ss] of CORNER3) {
    const lit = [...ss].some(s => on.includes(s));
    if (lit) put(L, x + i, y + j, c); else if (ghost) put(L, x + i, y + j, L.ghost);
  }
}

/** hand-placed gauge segments (each a little block of pixels, set on the display's grid): `fill` 0..1
 *  lights them from the first; past `cap` they're hatched out; the last one lit flickers when low */
const rect = (x0: number, y0: number, w: number, h: number): [number, number][] => { const o: [number, number][] = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o.push([x0 + i, y0 + j]); return o; };
/** the big watch's smile: six blocks stepping down round the bottom of the display and up again */
const SMILE_L: [number, number][][] = [
  [...rect(-11, 8, 2, 1), ...rect(-10, 9, 2, 1), [-9, 10]], rect(-7, 10, 3, 2), rect(-3, 11, 3, 2), rect(1, 11, 3, 2), rect(5, 10, 3, 2),
  [...rect(9, 8, 2, 1), ...rect(8, 9, 2, 1), [8, 10]],
];
const DOME_L = SMILE_L.map(sg => sg.map(([x, y]) => [x, -y] as [number, number]));
const SMILE_S: [number, number][][] = [[[-5, 3], [-5, 4], [-4, 4], [-4, 5]], rect(-2, 5, 2, 2), rect(1, 5, 2, 2), [[5, 3], [5, 4], [4, 4], [4, 5]]];
function segGauge(L: Lcd, segs: [number, number][][], fill: number, cols: number[], o: { cap?: number; flick?: boolean; blink?: boolean } = {}) {
  const n = segs.length, cap = o.cap ?? 1;
  const lastOn = Math.ceil(fill * n - 0.001) - 1;
  segs.forEach((sg, si) => {
    let on = si <= lastOn && fill > 0.001;
    if (o.flick && si === lastOn && (Math.floor(L.st.T * 7) % 3 === 0 || Math.sin(L.st.T * 23) > 0.6)) on = false;
    if (o.blink) on = on && Math.floor(L.st.T * 4) % 2 === 0;
    const locked = (si + 0.5) / n > cap;
    const ys = sg.map(p => p[1]), lo = Math.max(...ys);
    for (const [x, y] of sg) put(L, x, y, on ? (y === lo && sg.length > 4 && ys.some(v => v < lo) && (x + y) % 3 === 0 ? cols[0] : cols[1]) : locked ? (((x + y) & 1) ? LCD.lockH : LCD.lock) : L.ghost);
  });
}

function bolt(L: Lcd, x: number, y: number, c: number) {
  for (const [dx, dy] of [[2, 0], [1, 1], [0, 2], [1, 2], [2, 2], [1, 3], [0, 4]]) put(L, x + dx, y + dy, c);
}
function tank(L: Lcd, x: number, y: number, c: number) {
  ['.#.', '###', '#.#', '###', '###'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') put(L, x + i, y + j, c); });
}
function heart(L: Lcd, x: number, y: number, beat: boolean) {
  const rows = beat ? ['##.##', '#####', '.###.', '..#..'] : ['.....', '##.##', '.###.', '..#..'];
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') put(L, x + i, y + j, i + j < 2 ? LCD.heartHi : LCD.heart); });
}
function sunGlyph(L: Lcd, x: number, y: number, rays: boolean) {
  put(L, x, y, LCD.sunHi); put(L, x + 1, y, LCD.sun[1]); put(L, x - 1, y, LCD.sun[1]); put(L, x, y - 1, LCD.sun[1]); put(L, x, y + 1, LCD.sun[0]);
  if (rays) for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(L, x + dx, y + dy, LCD.sun[0]);
}
function moonGlyph(L: Lcd, x: number, y: number) {
  for (const [dx, dy] of [[0, -1], [-1, 0], [-1, 1], [0, 2], [1, 2], [1, -1]]) put(L, x + dx, y + dy, LCD.moon);
}

/** the sun's path in the dome: sunrise (6) at the left on the horizon, dark at the right; the hours
 *  passed solid, the rest dotted, dusk and dark notched, the sun riding it (the moon after dark) */
function sunDome(L: Lcd, yb: number, rx: number, ry: number) {
  const st = L.st, t0 = 6, t1 = st.dark;
  const at = (h: number): [number, number] => {
    const u = Math.max(0, Math.min(1, (h - t0) / (t1 - t0))), a = Math.PI + u * Math.PI;
    return [Math.round(Math.cos(a) * rx), Math.round(yb + Math.sin(a) * ry)];
  };
  for (let x = -rx - 2; x <= rx + 2; x++) put(L, x, yb + 1, (x & 1) ? L.faint : L.ghost);
  const N = 40;
  let px = 99, py = 99;
  for (let i = 0; i <= N; i++) {
    const h = t0 + (i / N) * (t1 - t0);
    const [x, y] = at(h);
    if (x === px && y === py) continue;
    px = x; py = y;
    const passed = h <= st.hour;
    put(L, x, y, passed ? L.dim : (x & 1) ? L.dim : L.ghost);
  }
  const [dx, dy] = at(st.dusk); put(L, dx, dy - 1, LCD.amber[1]); put(L, dx, dy, LCD.amber[1]);
  const [kx, ky] = at(t1); put(L, kx, ky - 1, LCD.dark); put(L, kx, ky, LCD.dark); put(L, kx + 1, ky, LCD.dark);
  const day = st.hour >= t0 && st.hour < t1;
  if (day) { const [sx, sy] = at(st.hour); sunGlyph(L, sx, sy, Math.floor(st.T * 1.5) % 2 === 0); }
  else moonGlyph(L, 0, yb - ry + 1);
}

function digitsTime(L: Lcd, hour: number, y: number, c: number) {
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60), h12 = ((hh + 11) % 12) + 1;
  half5(L, h12 >= 10, -10, y, c);
  seg5(L, String(h12 % 10), -8, y, c);
  const colon = Math.floor(L.st.T) % 2 === 0;
  put(L, -2, y + 2, colon ? c : L.ghost); put(L, -2, y + 6, colon ? c : L.ghost);
  seg5(L, String(Math.floor(mm / 10)), 0, y, c);
  seg5(L, String(mm % 10), 6, y, c);
}

/** a span of hours as H:MM (how long until dark) */
function digitsDur(L: Lcd, h: number, y: number, c: number) {
  const hh = Math.min(19, Math.floor(h)), mm = Math.floor((h - Math.floor(h)) * 60);
  half5(L, hh >= 10, -10, y, c);
  seg5(L, String(hh % 10), -8, y, c);
  put(L, -2, y + 2, c); put(L, -2, y + 6, c);
  seg5(L, String(Math.floor(mm / 10)), 0, y, c);
  seg5(L, String(mm % 10), 6, y, c);
}

/** stamina's colours by how much is left */
function staCols(st: FaceState, s: number) { return st.winded ? LCD.red : s < 0.25 ? LCD.red : s < 0.5 ? LCD.amber : LCD.green; }

function lcdL(L: Lcd) {
  const st = L.st, T = st.T;
  // ---- the smile: stamina (or the dive's air, a timer's time left, the daylight)
  let fill: number, cols: number[], icon: 'bolt' | 'tank' | 'sun' = 'bolt', cap = 1, flick = false, blink = false;
  if (st.face === 'dive' && st.dive) {
    fill = st.dive.air; icon = 'tank';
    cols = st.dive.air < 0.15 ? LCD.red : st.dive.air < 0.3 ? LCD.amber : LCD.air;
    flick = st.dive.air < 0.3; blink = st.dive.air < 0.12;
  } else if (st.face === 'timer') {
    fill = st.left ?? 1; cols = st.red ? LCD.red : fill < 0.4 ? LCD.amber : LCD.air; flick = fill < 0.25;
  } else if (st.stamina !== undefined) {
    fill = st.stamina; cap = st.staminaMax ?? 1; cols = staCols(st, fill); flick = fill < 0.25; blink = !!st.winded;
  } else {
    fill = Math.max(0, Math.min(1, (st.dark - st.hour) / (st.dark - 6))); cols = fill < 0.2 ? LCD.red : LCD.sun; icon = 'sun';
  }
  segGauge(L, SMILE_L, fill, cols, { cap, flick, blink });
  // its icon at the start of the smile (low left)
  if (icon === 'bolt') bolt(L, -13, 2, blink && Math.floor(T * 4) % 2 ? LCD.red[1] : cols[1]);
  else if (icon === 'tank') tank(L, -13, 2, cols[1]);
  else sunGlyph(L, -12, 4, false);

  if (st.face === 'dive' && st.dive) {
    // the dome: stamina; the depth big, metres; the time small (the air is the smile)
    if (st.stamina !== undefined) segGauge(L, DOME_L, st.stamina, staCols(st, st.stamina), { cap: st.staminaMax, flick: st.stamina < 0.25, blink: !!st.winded });
    const m = Math.max(0, Math.round(st.dive.depth));
    const s = String(Math.min(99, m)).padStart(2, ' ');
    seg5(L, s[0], -8, -6, L.ink); seg5(L, s[1], -2, -6, L.ink);
    tiny(L, 'M', 5, -2, L.dim);
    const hh = Math.floor(st.hour), mm = Math.floor((st.hour - hh) * 60), tt = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`;
    tiny(L, tt, -Math.floor(tinyW(tt) / 2), 4, L.dim);
    if (st.dive.air < 0.15 && Math.floor(T * 3) % 2 === 0) tiny(L, 'AIR', -5, -12, LCD.red[1]);
    // a bubble rising off the depth now and then
    const bu = (T * 0.8) % 1;
    if (bu < 0.7) put(L, 6 + (Math.sin(T * 6) > 0 ? 1 : 0), Math.round(-5 - bu * 5), L.dim);
    return;
  }
  if (st.face === 'timer') {
    const secs = Math.max(0, Math.ceil((st.left ?? 1) * (st.secs ?? 10)));
    const c = st.red ? LCD.red[1] : L.ink;
    if (secs >= 60) digitsDur(L, secs / 60, -6, c);
    else { const s = String(secs).padStart(2, '0'); seg5(L, s[0], -6, -6, c); seg5(L, s[1], 0, -6, c); tiny(L, 'S', 7, -2, L.dim); }
    tiny(L, 'TMR', -5, -12, L.dim);
    return;
  }
  if (st.face === 'body') {
    const s = Math.round((st.stamina ?? 1) * 100);
    const c = st.winded && Math.floor(T * 4) % 2 === 0 ? LCD.red[1] : L.ink;
    const t = String(Math.min(100, s)).padStart(3, ' ');
    half5(L, t[0] === '1', -10, -6, c);
    seg5(L, t[1], -8, -6, c); seg5(L, t[2], -2, -6, c);
    tiny(L, '%', 5, -2, L.dim);
    // the heart beating at its rate and the beats a minute, in the dome
    const bpm = Math.round(st.bpm ?? 70), beat = ((T * bpm) / 60) % 1 < 0.2;
    heart(L, -8, -11, beat);
    tiny(L, String(bpm), -2, -11, L.dim);
    // hunger: a fork and five pips under the digits
    const pips = Math.round((1 - (st.hunger ?? 0)) * 5);
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3], [1, 4]]) put(L, -7 + dx, 4 + dy, L.dim);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) put(L, -3 + i * 2, 6 + j, i < pips ? ((st.hunger ?? 0) > 0.65 ? LCD.amber[1] : LCD.green[1]) : L.ghost);
    return;
  }
  if (st.face === 'sun') {
    const rest = st.dark - st.hour, late = rest <= 0;
    sunDome(L, -9, 8, 3);
    if (late) { if (Math.floor(T * 3) % 2 === 0) tiny(L, 'LATE', -7, -4, LCD.red[1]); }
    else digitsDur(L, rest, -6, rest < 1 ? LCD.amber[1] : L.ink);
    tiny(L, late ? 'HOME' : 'DARK', -7, 4, late ? LCD.red[1] : L.dim);
    return;
  }
  // the time face
  sunDome(L, -9, 8, 3);
  digitsTime(L, st.hour, -6, L.ink);
  const pm = Math.floor(st.hour) >= 12;
  tiny(L, pm ? 'PM' : 'AM', -8, 4, L.dim);
  if (st.day) tiny(L, `D${Math.min(99, st.day)}`, 2, 4, L.dim);
}

// ---------------------------------------------------------------- the small watch's display
function lcdS(L: Lcd) {
  const st = L.st, T = st.T;
  const R = L.R;
  let fill: number, cols: number[];
  if (st.face === 'timer') { fill = st.left ?? 1; cols = st.red ? LCD.red : fill < 0.4 ? LCD.amber : LCD.air; }
  else if (st.face === 'dive' && st.dive) { fill = st.dive.air; cols = fill < 0.3 ? LCD.amber : LCD.air; }
  else if (st.stamina !== undefined) { fill = st.stamina; cols = staCols(st, fill); }
  else { fill = Math.max(0, Math.min(1, (st.dark - st.hour) / (st.dark - 6))); cols = fill < 0.2 ? LCD.red : LCD.sun; }
  segGauge(L, SMILE_S, fill, cols, { flick: fill < 0.25 });
  const c = st.red ? LCD.red[1] : L.ink;
  if (st.face === 'timer') {
    const secs = Math.max(0, Math.ceil((st.left ?? 1) * (st.secs ?? 10)));
    const s = String(Math.min(99, secs)).padStart(2, '0');
    seg3(L, s[0], -4, -3, c); seg3(L, s[1], 0, -3, c);
    return;
  }
  const hh = Math.floor(st.hour), mm = Math.floor((st.hour - hh) * 60), h12 = ((hh + 11) % 12) + 1;
  if (h12 >= 10) { put(L, -7, -2, c); put(L, -7, 0, c); put(L, -7, -1, c); put(L, -7, 1, c); }
  seg3(L, String(h12 % 10), -6, -3, c);
  if (Math.floor(T) % 2 === 0) { put(L, -2, -2, c); put(L, -2, 0, c); }
  seg3(L, String(Math.floor(mm / 10)), 0, -3, c); seg3(L, String(mm % 10), 4, -3, c);
  void R;
}
