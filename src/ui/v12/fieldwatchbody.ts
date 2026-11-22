// V12 Mori's field watch up close (./fieldwatch.ts, the C key): the same object as the HUD's hand-made
// sprite (./watchsprites.ts), about four times the size, so it carries the detail a close look finds.
// The case is cut from the HUD sprite's own profile (wider on the right where the crown guard stands,
// a guard either side of each pusher, chamfered lugs) and banded the same way: a dark outline, the side
// wall lit by the way it faces, the raised bumper, a groove, the flat top, a faint grain in the
// composite, scuffs and a gouge placed by hand. Four screws, each slot turned its own way. A steel
// coin-edge bezel round a black anodised compass insert: N in orange, E S W and the degrees (3, 6, 12 ...)
// in white paint, a dot every ten degrees, the first quarter graduated like a diver's, the paint chipped
// off the N's foot and a ding of bare aluminium at eight. The steel retaining ring round the glass. The
// olive nylon strap runs out of frame (twill, stitched edges, a bar-tack, a brushed steel keeper),
// darkening as it curves away over the wrist. Everything is set on whole pixels from the HUD watch's
// palette; light from the top left in hard bands, no gradients.

import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';
import { pxDraw, pxMeasure } from '../pxfont';
import { WATCH_PAL } from './watchsprites';

export const W = 400, HGT = 320, CX = 200, CY = 160;
/** the scale from the HUD sprite (its pixels) to this one */
const K = 4.1;
/** the bezel's outer edge, the insert's inner edge, the display */
export const RB = 88, RI = 70, RS = 66;

const P: Record<string, C> = {};
for (const k of Object.keys(WATCH_PAL)) P[k] = hex(WATCH_PAL[k]);
const CASE = ['k', 'a', 'b', 'c', 'd', 'e', 'f'].map(k => P[k]);
const STEEL = ['1', '2', '3', '4', '5', '6'].map(k => P[k]);
const STRAP = ['s', 't', 'u', 'v', 'x', 'y'].map(k => P[k]);

/** the HUD sprite's case profile: |dy| -> (left, right) half-widths, in its pixels */
const PROF: [number, number][] = [[24, 27], [24, 27], [24, 27], [24, 29], [24, 29], [24, 26], [24, 25], [25, 26], [25, 27], [24, 25], [24, 25], [24, 25],
  [24, 25], [24, 25], [24, 25], [24, 25], [25, 27], [25, 26], [24, 24], [23, 23], [22, 22], [21, 21], [20, 20], [18, 18], [16, 16], [14, 14], [14, 14],
  [14, 14], [13, 13], [12, 12]];
function inCase(dx: number, dy: number): boolean {
  const u = Math.abs(dy) / K;
  const i = Math.round(u);
  if (i >= PROF.length) return false;
  // (between the profile's rows the edge runs straight, except across a guard's step)
  const a = PROF[Math.min(PROF.length - 1, Math.floor(u))], b = PROF[Math.min(PROF.length - 1, Math.ceil(u))];
  const f = u - Math.floor(u);
  const step = (p: number, q: number) => (Math.abs(p - q) >= 1 && Math.abs(p - q) <= 2 ? (f < 0.5 ? p : q) : p + (q - p) * f);
  const l = step(a[0], b[0]) * K, r = step(a[1], b[1]) * K;
  return dx >= -l - 0.5 && dx <= r + 0.5;
}

export const PUSHERS: { id: 'up' | 'down' | 'start' | 'back'; x: number; y: number; side: -1 | 1; label: string }[] = [
  { id: 'up', x: CX - Math.round(24 * K) - 8, y: CY - Math.round(12 * K), side: -1, label: 'UP' },
  { id: 'down', x: CX - Math.round(24 * K) - 8, y: CY + Math.round(12 * K), side: -1, label: 'DOWN' },
  { id: 'start', x: CX + Math.round(25 * K) + 8, y: CY - Math.round(12 * K), side: 1, label: 'START' },
  { id: 'back', x: CX + Math.round(25 * K) + 8, y: CY + Math.round(12 * K), side: 1, label: 'BACK' },
];

function hs(x: number, y: number, s: number) { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
const lightOf = (nx: number, ny: number) => (-nx * 0.62 - ny * 0.78) / (Math.hypot(nx, ny) || 1);

// ---------------------------------------------------------------- the body (painted once)
export function paintFieldBody(b: PixelBuffer) {
  paintStrap(b);
  paintCase(b);
  paintBezel(b);
  paintDetails(b);
  paintLabels(b);
}

function paintStrap(b: PixelBuffer) {
  const sw = Math.round(24 * K) & ~1, x0 = CX - sw / 2, lug = Math.round(29 * K);
  for (const dir of [-1, 1]) {
    const yA = dir < 0 ? 0 : CY + lug - 2, yB = dir < 0 ? CY - lug + 2 : HGT - 1;
    for (let y = yA; y <= yB; y++) {
      // 0 at the lug .. 1 at the canvas edge, where it curves away over the wrist
      const far = dir < 0 ? (CY - lug - y) / (CY - lug) : (y - (CY + lug)) / (HGT - (CY + lug));
      const inset = far > 0.86 ? 2 : far > 0.72 ? 1 : 0;
      for (let x = x0 + inset; x < x0 + sw - inset; x++) {
        const i = x - x0;
        let v: number;
        if (i <= inset || i >= sw - 1 - inset) v = 0;
        else if (i <= inset + 2) v = 4;
        else if (i >= sw - 3 - inset) v = 1;
        else {
          // the twill: diagonal ribs two pixels wide, a slub here and there
          const rib = Math.floor((x + y * 2) / 3) % 3;
          v = rib === 0 ? 3 : rib === 1 ? 2 : 2;
          if (rib === 0 && ((x * 7 + y) % 11 === 0)) v = 4;
          if (hs(x, y, 4) > 0.985) v = 1;
        }
        // stitches down each edge
        if ((i === inset + 4 || i === sw - 5 - inset) && (y & 3) < 2) v = 5;
        // further round the wrist, darker in hard steps
        if (far > 0.55) v = Math.max(0, v - 1);
        if (far > 0.8) v = Math.max(0, v - 1);
        if (far > 0.93) v = Math.max(0, v - 1);
        b.set(x, y, STRAP[v]);
      }
    }
  }
  // the bar-tack on the upper strap: a dense block of zigzag stitching
  const ty = CY - lug - 18;
  for (let y = ty; y < ty + 6; y++) for (let x = CX - 14; x < CX + 14; x++) if (((x + (y & 1) * 2) & 3) < 2) b.set(x, y, (y - ty) % 3 === 0 ? STRAP[5] : STRAP[4]);
  // the keeper on the lower strap: brushed steel, a glint on its top edge, a shadow under it
  const ky = CY + lug + 20;
  for (let y = ky; y < ky + 12; y++) for (let x = x0 - 4; x < x0 + sw + 4; x++) {
    const j = y - ky;
    let c = j === 0 || j === 11 || x === x0 - 4 || x === x0 + sw + 3 ? P.k : j < 3 ? STEEL[4] : j < 6 ? STEEL[3] : j < 9 ? STEEL[2] : STEEL[1];
    if (j === 1 && x > x0 + 10 && x < x0 + 34) c = STEEL[5];
    if (j > 2 && j < 10 && hs(x, 0, 9) > 0.8) c = j < 6 ? STEEL[4] : STEEL[3];
    b.set(x, y, c);
  }
  for (let x = x0; x < x0 + sw; x++) for (let k = 0; k < 3; k++) b.set(x, ky + 12 + k, STRAP[0]);
  // the strap's shadow where it leaves the lugs
  for (let x = x0; x < x0 + sw; x++) for (let k = 0; k < 3; k++) { b.set(x, CY - lug - 1 - k, STRAP[0]); b.set(x, CY + lug + 1 + k, STRAP[0]); }
}

function paintCase(b: PixelBuffer) {
  // depth into the case from its silhouette: the outline, the wall, the bumper, a groove, the top
  const x0 = CX - 140, x1 = CX + 140, y0 = CY - 125, y1 = CY + 125;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const depth = new Int16Array(w * h).fill(-1);
  const q: number[] = [];
  const ins = (x: number, y: number) => inCase(x - CX, y - CY);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!ins(x, y)) continue;
    if (!ins(x + 1, y) || !ins(x - 1, y) || !ins(x, y + 1) || !ins(x, y - 1)) { depth[(y - y0) * w + x - x0] = 1; q.push(x, y); }
  }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1], d = depth[(y - y0) * w + x - x0];
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + a, Y = y + c;
      if (X < x0 || X > x1 || Y < y0 || Y > y1) continue;
      const k = (Y - y0) * w + X - x0;
      if (depth[k] < 0 && ins(X, Y)) { depth[k] = d + 1; q.push(X, Y); }
    }
  }
  const dAt = (x: number, y: number) => (x < x0 || x > x1 || y < y0 || y > y1 ? 0 : Math.max(0, depth[(y - y0) * w + x - x0]));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = dAt(x, y);
    if (d <= 0) continue;
    // the way out of the case from here (the depth's slope)
    const nx = dAt(x - 3, y) - dAt(x + 3, y), ny = dAt(x, y - 3) - dAt(x, y + 3);
    const l = lightOf(nx, ny);
    let c: C;
    if (d <= 2) c = CASE[0];
    else if (d <= 8) c = l > 0.5 ? CASE[5] : l > 0.05 ? CASE[4] : l > -0.55 ? CASE[2] : CASE[1];
    else if (d <= 10) c = l > 0.3 ? CASE[5] : l > -0.3 ? CASE[3] : CASE[2];        // the bumper's crest
    else if (d <= 16) c = l > 0.3 ? CASE[4] : l > -0.45 ? CASE[3] : CASE[2];
    else if (d <= 19) c = l > 0.2 ? CASE[1] : CASE[0];                            // the groove
    else if (d <= 20) c = l < -0.2 ? CASE[4] : CASE[2];                           // its far lip catches the light
    else {
      const qv = (-(x - CX) * 0.62 - (y - CY) * 0.78) / 110;
      c = qv > 0.35 ? CASE[4] : qv > -0.4 ? CASE[3] : CASE[2];
    }
    // a faint grain in the composite
    if (d > 2 && hs(x, y, 2) > 0.965) c = c === CASE[4] ? CASE[3] : c === CASE[3] ? CASE[2] : c;
    b.set(x, y, c);
  }
  // the groove across the top lug's end (the end link) and the depth rating cut into the bottom one
  const lug = Math.round(29 * K);
  for (let x = CX - 46; x <= CX + 46; x++) { b.set(x, CY - lug + 12, CASE[0]); b.set(x, CY - lug + 13, CASE[1]); b.set(x, CY - lug + 14, x < CX + 10 ? CASE[5] : CASE[4]); }
  const t = '200M', tw = pxMeasure(t, 'bold');
  pxDraw(b, t, CX - tw / 2 + 1, CY + lug - 26 + 1, { font: 'bold', color: CASE[1] });
  pxDraw(b, t, CX - tw / 2, CY + lug - 26, { font: 'bold', color: CASE[4] });
  // the seam where the bezel sits on the case: a dark line, darker on the shadow side
  for (let y = CY - RB - 4; y <= CY + RB + 4; y++) for (let x = CX - RB - 4; x <= CX + RB + 4; x++) {
    const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    if (d > RB && d <= RB + 2.5) b.set(x, y, x - CX + (y - CY) > -30 || d <= RB + 1.2 ? CASE[0] : CASE[1]);
  }
}

function paintBezel(b: PixelBuffer) {
  for (let y = CY - RB; y <= CY + RB; y++) for (let x = CX - RB; x <= CX + RB; x++) {
    const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
    if (d > RB) continue;
    const l = lightOf(dx, dy), an = Math.atan2(dy, dx);
    let c: C;
    if (d > RB - 4) {
      // the coin edge: a tooth, a notch, round and round
      const notch = ((an + Math.PI) / (Math.PI * 2)) * 120 % 1 < 0.34;
      const v = (l > 0.7 ? 5 : l > 0.25 ? 4 : l > -0.3 ? 3 : l > -0.75 ? 2 : 1) - (d > RB - 1 ? 1 : 0);
      c = STEEL[Math.max(0, notch ? v - 2 : v)];
    } else if (d > RB - 6) c = STEEL[l > 0.6 ? 5 : l > 0.1 ? 4 : l > -0.5 ? 3 : 2];        // its polished top
    else if (d > RI) {
      // the black insert: a sheen in hard bands on the lit side, the rim's shadow inside it there
      c = l > 0.72 && d > RI + 4 && d < RB - 9 ? P.J : l > 0.2 ? P.j : P.i;
      if (d > RB - 8 && l > 0.4) c = P.i;
      if (d > RB - 8 && l < -0.6) c = P.J;
    } else if (d > RS) c = STEEL[l < -0.5 ? 4 : l < 0.2 ? 3 : 2];                          // the retaining ring
    else continue;
    b.set(x, y, c);
  }
  // the paint: a dot every ten degrees, a bar every thirty, the first quarter graduated, the letters and degrees
  const at = (deg: number, r: number): [number, number] => { const a = (deg * Math.PI) / 180; return [CX + Math.sin(a) * r, CY - Math.cos(a) * r]; };
  const W1 = P.W, W2 = P.w;
  for (let deg = 0; deg < 360; deg += 2) {
    if (deg % 90 === 0) continue;
    if (deg % 30 === 0) { for (let r = RB - 16; r <= RB - 9; r += 0.5) { const [x, y] = at(deg, r); b.set(Math.round(x), Math.round(y), W1); b.set(Math.round(x) + 1, Math.round(y), W2); } continue; }
    if (deg < 90 && deg % 6 === 0) { for (let r = RB - 12; r <= RB - 9; r += 0.5) { const [x, y] = at(deg, r); b.set(Math.round(x), Math.round(y), W2); } continue; }
    if (deg < 90) { const [x, y] = at(deg, RB - 9.5); b.set(Math.round(x), Math.round(y), W2); continue; }
    if (deg % 10 === 0) { const [x, y] = at(deg, RB - 11); b.set(Math.round(x), Math.round(y), W1); b.set(Math.round(x) + 1, Math.round(y), W2); b.set(Math.round(x), Math.round(y) + 1, W2); }
  }
  for (const [deg, n] of [[60, '6'], [120, '12'], [150, '15'], [210, '21'], [240, '24'], [300, '30'], [330, '33']] as [number, string][]) {
    const [x, y] = at(deg, RB - 25);
    const tw = pxMeasure(n, 'tiny');
    pxDraw(b, n, Math.round(x - tw / 2), Math.round(y - 2.5), { font: 'tiny', color: W2 });
  }
  for (const [L, deg, c] of [['N', 0, P.O], ['E', 90, W1], ['S', 180, W1], ['W', 270, W1]] as [string, number, C][]) {
    const [x, y] = at(deg, RB - 15);
    const tw = pxMeasure(L, 'bold');
    pxDraw(b, L, Math.round(x - tw / 2), Math.round(y - 5), { font: 'bold', color: c });
  }
  // the N's lume triangle under it, and its paint chipped at the foot
  for (let k = 0; k < 5; k++) for (let i = -k; i <= k; i++) b.set(CX + i, CY - RB + 6 + k, k < 2 ? P.Q : P.O);
  for (const [x, y] of [[-3, -RB + 21], [-2, -RB + 21], [-3, -RB + 20]]) b.set(CX + x, CY + y, P.j);
  // a ding of bare aluminium in the insert at eight, a bright scrape on the coin edge by it
  for (const [x, y, k] of [[-62, 34, '3'], [-61, 35, '4'], [-60, 35, '3'], [-63, 33, '2'], [-61, 36, '2'], [-76, 40, '6'], [-75, 42, '6'], [-74, 43, '5']] as [number, number, string][]) b.set(CX + x, CY + y, P[k]);
}

function paintDetails(b: PixelBuffer) {
  // screws on the four shoulders, each slot turned its own way, sunk in a countersink
  const r = 103;
  [[-1, -1, 0.3], [1, -1, 1.2], [-1, 1, 2.1], [1, 1, -0.5]].forEach(([sx, sy, rot]) => {
    const x = Math.round(CX + sx * r * 0.7071), y = Math.round(CY + sy * r * 0.7071);
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const d = Math.hypot(i, j);
      if (d > 6.4) continue;
      if (d > 5) { b.set(x + i, y + j, i + j > 0 ? CASE[0] : CASE[5]); continue; }
      const l = lightOf(-i, -j) * 0.6 + lightOf(i, j) * 0.0;
      let c = STEEL[d < 2 ? 3 : (-i - j) > 3 ? 5 : (-i - j) > -2 ? 4 : 2];
      void l;
      // the slot
      const ca = Math.cos(rot), sa = Math.sin(rot);
      if (Math.abs(i * sa - j * ca) < 0.9 && d < 4.6) c = STEEL[0];
      b.set(x + i, y + j, c);
    }
  });
  // scuffs and a gouge where it knocks against rock: the lug corners, the guards, the shoulders
  const scuffs: [number, number, number, number][] = [[-56, -116, 6, 0], [-60, -112, 3, 1], [-100, -30, 2, 3], [-101, 64, 4, 2], [56, 112, 5, 0], [108, 34, 3, 3],
    [114, -14, 3, 1], [-86, 78, 3, 0], [86, -84, 4, 1], [-94, -64, 3, 2]];
  for (const [x, y, n, dir] of scuffs) for (let k = 0; k < n; k++) {
    const X = CX + x + (dir === 0 ? k : dir === 1 ? -k : 0), Y = CY + y + (dir === 2 ? k : dir === 3 ? k : 0) + (dir === 1 ? k : 0);
    if (b.get(X, Y) !== P.k) b.set(X, Y, CASE[6]);
  }
  for (const [x, y] of [[-79, 88], [-78, 89], [-77, 89], [-76, 90]]) { b.set(CX + x, CY + y, CASE[0]); b.set(CX + x, CY + y - 1, CASE[6]); }
}

function paintLabels(b: PixelBuffer) {
  // the pushers' names float beside them in the menus' words, with their keys
  for (const p of PUSHERS) {
    const key = p.id === 'up' ? 'W' : p.id === 'down' ? 'S' : p.id === 'start' ? 'E' : 'ESC';
    const w = pxMeasure(p.label, 'bold'), kw = pxMeasure(key, 'tiny') + 4;
    const tx = p.side < 0 ? p.x - 26 - w : p.x + 26;
    const ty = p.y - 5;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pxDraw(b, p.label, tx + dx, ty + dy, { font: 'bold', color: hex('#140c06') });
    pxDraw(b, p.label, tx, ty, { font: 'bold', color: p.id === 'start' ? P.Q : hex('#fff2d8') });
    const kx = p.side < 0 ? tx + w - kw : tx, ky = ty + 12;
    for (let x = 0; x < kw; x++) for (let y = 0; y < 9; y++) {
      const edge = x === 0 || y === 0 || x === kw - 1 || y === 8;
      if (edge && (x === 0 || x === kw - 1) && (y === 0 || y === 8)) continue;
      b.set(kx + x, ky + y, edge ? hex('#140c06') : y > 6 ? hex('#a89c88') : hex('#e8dcc4'));
    }
    pxDraw(b, key, kx + 2, ky + 2, { font: 'tiny', color: hex('#2a2016') });
    for (let i = 0; i < 8; i++) if (i % 2 === 0) b.set(p.side < 0 ? p.x - 16 - i : p.x + 16 + i, p.y, hex('#fff2d8'));
  }
}

// ---------------------------------------------------------------- every frame
/** the four pushers (knurled steel; the upper left ringed orange like the HUD watch's LIGHT) and the crown */
export function paintFieldPushers(b: PixelBuffer, press: Record<string, number>) {
  for (const p of PUSHERS) {
    const held = (press[p.id] ?? 0) > 0;
    const out = held ? 12 : 16, ph = 26;
    const edge = p.side < 0 ? CX - Math.round(24 * K) : CX + Math.round(25 * K);
    for (let i = 0; i <= out; i++) for (let j = 0; j < ph; j++) {
      const X = p.side < 0 ? edge - i : edge + i, Y = p.y - ph / 2 + j;
      const tipI = out - i;
      let c: C;
      if (j === 0 || j === ph - 1 || tipI === 0) c = P.k;
      else if (i < 4) c = j < ph / 2 ? STEEL[1] : STEEL[0];                       // the stem in its guard
      else {
        // knurled: ridges across the cap, lit on top, the tip's chamfer bright
        const ridge = (j >> 1) % 2 === 0;
        const v = (p.side < 0 ? 1 : 0) + (j < 5 ? 2 : j > ph - 6 ? -1 : 0) + (ridge ? 2 : 0) + (tipI <= 2 ? 1 : 0);
        c = STEEL[Math.max(0, Math.min(5, v + 1))];
      }
      if (p.id === 'up' && (i === 5 || i === 6) && c !== P.k) c = i === 5 ? P.o : (held ? P.o : P.O);
      b.set(X, Y, c);
    }
  }
  // the crown at three between its guards: a tube, a knurled head
  const cx0 = CX + Math.round(27 * K), cy0 = CY;
  for (let i = 0; i < 24; i++) for (let j = -14; j <= 14; j++) {
    const tube = i < 8;
    if (tube && Math.abs(j) > 7) continue;
    const X = cx0 + i, Y = cy0 + j;
    let c: C;
    if (Math.abs(j) === (tube ? 7 : 14) || i === 23) c = P.k;
    else if (tube) c = j < 0 ? STEEL[2] : STEEL[1];
    else if (i === 8) c = P.k;
    else { const ridge = ((j + 20) >> 1) % 2 === 0; c = STEEL[Math.max(0, Math.min(5, (ridge ? 3 : 1) + (j < -8 ? 1 : j > 8 ? -1 : 0) + (i > 20 ? 1 : 0)))]; }
    b.set(X, Y, c);
  }
}

/** the crystal: a hand-placed glint and a fine scratch (whole pixels lightened), a glint drifting over */
export function paintFieldGlass(b: PixelBuffer, T: number) {
  const hi = (x: number, y: number, a: number) => { if (Math.hypot(x + 0.5 - CX, y + 0.5 - CY) < RS - 1) b.blend(x, y, hex('#ffffff', a)); };
  for (let i = 0; i < 16; i++) { hi(CX - 46 + i, CY - 26 - i, 70); hi(CX - 45 + i, CY - 26 - i, 40); }
  for (let i = 0; i < 6; i++) hi(CX - 40 + i, CY - 18 - i, 40);
  for (let i = 0; i < 22; i++) hi(CX + 18 + i, CY + 34 - Math.round(i * 0.45), 16);
  const g = ((T * 0.22) % 1.8) - 0.4;
  if (g > 0 && g < 1) {
    const gx = Math.round(CX - RS * 0.75 + g * RS * 1.2), gy = Math.round(CY - RS * 0.2 + g * RS * 0.4);
    for (let i = 0; i < 8; i++) { hi(gx + i, gy - i, 90); hi(gx + i + 1, gy - i, 50); }
  }
}

/** the smile: chunky segments stepping round the bottom of the display (axis-aligned blocks on the
 *  pixel grid, one a step), lit from the left by `fill`, hatched past `cap` */
export function smileBlocks(): { x: number; y: number; w: number; h: number }[] {
  const n = 14, out: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.8 - (0.6 * (i + 0.5)) / n), r = RS - 8;
    out.push({ x: Math.round(CX + Math.cos(a) * r - 3), y: Math.round(CY + Math.sin(a) * r - 3), w: 6, h: 6 });
  }
  return out;
}
