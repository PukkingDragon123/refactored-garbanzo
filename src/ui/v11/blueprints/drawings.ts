// V11 Blueprints: the technical drawing on every sheet, as pixel line art. Each drawing is made for a
// 120 x 80 box (the pen maps it onto the sheet's drawing panel at any size) with the pen of whoever
// designed it: views of the thing, dimensions, callouts, hidden lines, hatched sections.
// DRAWINGS[id] draws one; drawFallback() traces the item's painted artwork when there is no drawing.

import type { SkPen, Pt } from './pxdraw';
import type { Ink } from './pxpaper';

type Draw = (p: SkPen, I: Ink) => void;
const PI = Math.PI;

// ---------------------------------------------------------------- parts
/** a round stick / leg between two points, r thick (two outlines and an end cap) */
function stick(p: SkPen, x0: number, y0: number, x1: number, y1: number, r = 2, grain = true) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / L) * r, ny = ((x1 - x0) / L) * r;
  p.line(x0 + nx, y0 + ny, x1 + nx, y1 + ny);
  p.line(x0 - nx, y0 - ny, x1 - nx, y1 - ny);
  p.line(x0 + nx, y0 + ny, x0 - nx, y0 - ny);
  p.line(x1 + nx, y1 + ny, x1 - nx, y1 - ny);
  if (grain) for (let t = 0.2; t < 0.9; t += 0.27) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; p.line(x + nx * 0.3, y + ny * 0.3, x + (x1 - x0) / L * 3 + nx * 0.3, y + (y1 - y0) / L * 3 + ny * 0.3, { c: p.soft }); }
}
/** lashing turns across a stick */
function lash(p: SkPen, x: number, y: number, w: number, n: number, dy = 2) {
  for (let i = 0; i < n; i++) p.line(x - w, y + i * dy, x + w, y + i * dy + 1, { c: p.soft });
}
/** a horizontal cylinder from x to x + len, radius r (the far end drawn as an arc) */
function cylH(p: SkPen, x: number, cy: number, len: number, r: number, e = 0.35) {
  p.ellipse(x, cy, r * e, r);
  p.line(x, cy - r, x + len, cy - r);
  p.line(x, cy + r, x + len, cy + r);
  p.ellipse(x + len, cy, r * e, r, { a0: -PI / 2, a1: PI / 2 });
  p.ellipse(x + len, cy, r * e, r, { a0: PI / 2, a1: PI * 1.5, dash: [2, 2], c: p.soft });
}
/** a vertical cylinder: top ellipse at y, height h */
function cylV(p: SkPen, cx: number, y: number, h: number, rx: number, ry = rx * 0.35) {
  p.ellipse(cx, y, rx, ry);
  p.line(cx - rx, y, cx - rx, y + h);
  p.line(cx + rx, y, cx + rx, y + h);
  p.ellipse(cx, y + h, rx, ry, { a0: 0, a1: PI });
  p.ellipse(cx, y + h, rx, ry, { a0: PI, a1: PI * 2, dash: [2, 2], c: p.soft });
}
/** an oblique box: front face w x h at (x, y), depth d going up and right */
function box(p: SkPen, x: number, y: number, w: number, h: number, d: number) {
  p.rect(x, y, w, h);
  p.poly([[x, y], [x + d, y - d * 0.7], [x + w + d, y - d * 0.7], [x + w, y]]);
  p.poly([[x + w + d, y - d * 0.7], [x + w + d, y + h - d * 0.7], [x + w, y + h]]);
  p.line(x + d, y - d * 0.7, x + d, y + h - d * 0.7, { dash: [2, 2], c: p.soft });
  p.line(x + d, y + h - d * 0.7, x, y + h, { dash: [2, 2], c: p.soft });
  p.line(x + d, y + h - d * 0.7, x + w + d, y + h - d * 0.7, { dash: [2, 2], c: p.soft });
}
/** a lumpy stone */
function stone(p: SkPen, cx: number, cy: number, rx: number, ry: number, s = 1) {
  const pts: Pt[] = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2, k = 1 + Math.sin(i * 2.3 + s) * 0.12; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  pts.push(pts[0]);
  p.curve(pts);
  p.line(cx - rx * 0.4, cy - ry * 0.4, cx - rx * 0.1, cy - ry * 0.55, { c: p.soft });
}
/** a leaf: pointed ellipse along an angle, with a midrib */
function leaf(p: SkPen, cx: number, cy: number, len: number, ang: number, wid = 0.35) {
  const ca = Math.cos(ang), sa = Math.sin(ang), pts: Pt[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, u = (t - 0.5) * len, v = Math.sin(t * PI) * len * wid * 0.5; pts.push([cx + ca * u - sa * v, cy + sa * u + ca * v]); }
  for (let i = 12; i >= 0; i--) { const t = i / 12, u = (t - 0.5) * len, v = -Math.sin(t * PI) * len * wid * 0.5; pts.push([cx + ca * u - sa * v, cy + sa * u + ca * v]); }
  p.curve(pts);
  p.line(cx - ca * len * 0.5, cy - sa * len * 0.5, cx + ca * len * 0.45, cy + sa * len * 0.45, { c: p.soft });
}
/** a sine wave from x0 to x1 */
function wave(p: SkPen, x0: number, y: number, x1: number, amp: number, period: number, phase = 0, c?: number) {
  const pts: Pt[] = [];
  for (let x = x0; x <= x1; x += 1.5) pts.push([x, y + Math.sin(((x - x0) / period) * PI * 2 + phase) * amp]);
  p.poly(pts, false, { c: c ?? p.c, wobble: 0 });
}
/** a curl of smoke */
function puff(p: SkPen, x: number, y: number, s = 1) {
  p.ellipse(x, y, 3 * s, 2.4 * s, { a0: PI * 0.1, a1: PI * 1.6 });
  p.ellipse(x + 4 * s, y - 3 * s, 2.6 * s, 2 * s, { a0: PI * 0.7, a1: PI * 2.1 });
}
/** a bag: straight sides, rounded bottom, open top at y */
function bag(p: SkPen, x: number, y: number, w: number, h: number) {
  const r = Math.min(w, h) * 0.3;
  p.curve([[x, y], [x - 1, y + h * 0.5], [x + r * 0.4, y + h - r * 0.3], [x + w / 2, y + h], [x + w - r * 0.4, y + h - r * 0.3], [x + w + 1, y + h * 0.5], [x + w, y]]);
}
/** a camera body seen from the front: body, grip, lens, the viewfinder hump */
function camera(p: SkPen, x: number, y: number, w = 34, h = 22) {
  p.rect(x, y, w, h);
  p.rect(x + w * 0.35, y - 5, w * 0.3, 5);
  p.circle(x + w * 0.58, y + h * 0.55, h * 0.36);
  p.circle(x + w * 0.58, y + h * 0.55, h * 0.22, { c: p.soft });
  p.line(x + 5, y + 2, x + 5, y + h - 2, { c: p.soft });
  p.rect(x + w - 8, y - 3, 4, 3);
}
/** a hand (glove) outline, fingers up */
function glove(p: SkPen, x: number, y: number, s = 1) {
  const f = (dx: number, len: number) => { p.line(x + dx * s, y + 18 * s, x + dx * s, y + (18 - len) * s); p.line(x + (dx + 4) * s, y + 18 * s, x + (dx + 4) * s, y + (18 - len) * s); p.ellipse(x + (dx + 2) * s, y + (18 - len) * s, 2 * s, 1.5 * s, { a0: PI, a1: PI * 2 }); };
  f(0, 14); f(5, 17); f(10, 16); f(15, 12);
  p.curve([[x, y + 18 * s], [x - 1, y + 26 * s], [x + 3, y + 34 * s], [x + 12 * s, y + 36 * s], [x + 19 * s, y + 30 * s], [x + 19 * s, y + 18 * s]]);
  // the thumb
  p.curve([[x, y + 24 * s], [x - 6 * s, y + 18 * s], [x - 9 * s, y + 13 * s], [x - 6 * s, y + 12 * s], [x - 1 * s, y + 18 * s]]);
  p.line(x - 1, y + 34 * s, x + 18 * s, y + 34 * s, { c: p.soft });
}
/** a sneaker / boot in side view (toe right), sole thickness t */
function shoe(p: SkPen, x: number, y: number, w = 44, h = 18, t = 3, boot = false) {
  const top = boot ? y - 12 : y;
  p.curve([[x, y + h], [x, top + 2], [x + 4, top], [x + 12, top], [x + 14, y + 4], [x + w * 0.6, y + 6], [x + w - 4, y + h * 0.55], [x + w, y + h]]);
  p.line(x, y + h, x + w, y + h);
  for (let i = 1; i <= t; i++) p.line(x, y + h + i * 2, x + w - 1, y + h + i * 2, { c: i === t ? p.c : p.soft });
  p.line(x, y + h, x, y + h + t * 2); p.line(x + w, y + h, x + w - 1, y + h + t * 2);
  for (let i = 0; i < 4; i++) p.line(x + 13 + i * 4, y + 5 + i * 0.6, x + 16 + i * 4, y + 3 + i * 0.6, { c: p.soft });
}
/** a pack seen from the front: body, lid, two straps */
function pack(p: SkPen, x: number, y: number, w = 36, h = 46) {
  p.curve([[x + 4, y], [x, y + 8], [x, y + h - 6], [x + 5, y + h], [x + w - 5, y + h], [x + w, y + h - 6], [x + w, y + 8], [x + w - 4, y], [x + 4, y]]);
  p.curve([[x + 2, y + 6], [x + w / 2, y + 11], [x + w - 2, y + 6]]);
  p.rect(x + w / 2 - 2, y + 9, 4, 4);
}

// ---------------------------------------------------------------- the drawings
export const DRAWINGS: Record<string, Draw> = {
  slingshot: (p, I) => {
    // front view: the fork, the bands, the pouch
    stick(p, 34, 76, 34, 46, 3);
    p.curve([[31, 46], [26, 36], [20, 22], [19, 10]]); p.curve([[37, 46], [42, 36], [48, 22], [49, 10]]);
    p.curve([[34, 44], [27, 34], [24, 22], [23, 10]]); p.curve([[34, 44], [41, 34], [44, 22], [45, 10]]);
    p.line(19, 10, 23, 10); p.line(45, 10, 49, 10);
    lash(p, 34, 54, 3, 6);
    p.line(21, 13, 31, 33, { c: I.accent }); p.line(47, 13, 37, 33, { c: I.accent });
    p.ellipse(34, 35, 5, 3); p.circle(34, 34, 1.6, { c: p.soft });
    p.dimV(10, 10, 76, '18CM', { side: 1, ext: 4 });
    p.dimH(19, 49, 4, '9CM');
    p.callout(26, 30, 6, 30, 'A'); p.callout(44, 22, 62, 16, 'B'); p.callout(38, 36, 62, 40, 'C'); p.callout(37, 58, 56, 64, 'D');
    // detail: the pouch, opened flat
    p.rect(78, 26, 26, 14); p.circle(84, 33, 1.5); p.circle(98, 33, 1.5);
    p.line(78, 33, 72, 33, { c: I.accent }); p.line(104, 33, 110, 33, { c: I.accent });
    p.text(91, 44, 'C · POUCH', { align: 'center' });
    p.text(91, 18, 'LEATHER 6×3', { align: 'center', c: p.soft });
  },
  pebble_pouch: p => {
    bag(p, 30, 22, 34, 44);
    p.curve([[30, 22], [36, 18], [47, 21], [58, 18], [64, 22]]);
    for (let i = 0; i < 6; i++) p.line(32 + i * 6, 22, 33 + i * 6, 27, { c: p.soft });
    p.curve([[46, 20], [44, 12], [40, 8]]); p.curve([[48, 20], [52, 12], [56, 9]]);
    for (const [x, y] of [[40, 40], [50, 46], [44, 54], [55, 36], [38, 52]] as Pt[]) p.circle(x, y, 3, { dash: [2, 1], c: p.soft });
    p.rect(64, 30, 8, 12); p.text(76, 34, 'BELT LOOP');
    p.dimV(22, 22, 66, '12CM', { side: -1, ext: 3 });
    p.text(92, 58, '×25', { font: 'caps' });
  },
  smoke_bomb: (p, I) => {
    // section through the ball: clay skin, packed leaves, the wick
    p.circle(38, 44, 22); p.circle(38, 44, 18, { c: p.soft });
    p.hatchEllipse(38, 44, 17, 17, 3);
    p.curve([[38, 22], [40, 14], [46, 9], [52, 8]], { c: I.accent });
    p.callout(20, 34, 6, 18, 'A'); p.callout(44, 50, 66, 66, 'B'); p.callout(48, 9, 68, 12, 'C');
    p.dimH(16, 60, 74, '6CM');
    puff(p, 86, 34); puff(p, 96, 24, 1.3); puff(p, 104, 40, 0.9);
    p.text(84, 52, 'BURST', { c: p.soft }); p.text(84, 58, '→ CLOUD', { c: p.soft });
  },
  walking_staff: p => {
    stick(p, 12, 74, 104, 10, 2.5);
    lash(p, 76, 28, 3, 5);
    p.curve([[80, 28], [86, 36], [88, 46]], { c: p.soft });
    leaf(p, 90, 52, 14, PI / 2.3, 0.3);
    p.dimH(12, 104, 4, '1.4M');
    p.callout(78, 31, 98, 22, 'A'); p.callout(89, 56, 108, 66, 'B');
    p.text(16, 58, 'SHOULDER', { c: p.soft }); p.text(16, 64, 'HEIGHT', { c: p.soft });
  },
  trap: (p, I) => {
    box(p, 18, 34, 56, 30, 18);
    for (let x = 26; x < 74; x += 8) p.line(x, 34, x, 64, { c: p.soft });
    // the door: a flat stone held up on a cord
    p.rect(74, 22, 6, 34); p.hatch(74, 22, 6, 34, 3);
    p.curve([[77, 22], [77, 10], [60, 6], [40, 10], [38, 30]], { c: I.accent });
    p.line(38, 30, 38, 50, { c: I.accent, dash: [2, 1] });
    p.circle(38, 52, 2);
    p.dimH(18, 74, 72, '60CM'); p.dimV(10, 34, 64, '30', { side: -1 });
    p.callout(77, 40, 100, 44, 'A'); p.callout(38, 50, 22, 18, 'B');
    p.text(84, 60, 'DOOR DROPS', { c: p.soft });
  },
  braided_line: p => {
    for (let k = 0; k < 3; k++) wave(p, 8, 30, 80, 3, 12, (k * PI * 2) / 3, k === 1 ? p.soft : p.c);
    for (let r = 4; r <= 16; r += 3) p.circle(98, 32, r, { c: r % 2 ? p.c : p.soft });
    p.text(8, 46, '3 STRANDS · LEFT OVER RIGHT');
    p.dimH(8, 32, 18, '1 TWIST');
    wave(p, 10, 62, 50, 1.5, 6, 0); p.text(56, 60, 'ROLL ON THE THIGH', { c: p.soft });
  },
  fishing_reel: (p, I) => {
    p.circle(44, 40, 24); p.circle(44, 40, 18, { c: p.soft }); p.circle(44, 40, 4);
    for (let a = 0; a < 6; a++) p.line(44 + Math.cos((a * PI) / 3) * 5, 40 + Math.sin((a * PI) / 3) * 5, 44 + Math.cos((a * PI) / 3) * 17, 40 + Math.sin((a * PI) / 3) * 17, { c: p.soft });
    stick(p, 44, 40, 72, 30, 1.5, false); p.circle(74, 29, 3.5);
    p.rect(30, 66, 28, 5); p.line(40, 64, 40, 66); p.line(48, 64, 48, 66);
    // the pawl detail
    p.circle(100, 26, 10); for (let a = 0; a < 12; a++) p.line(100 + Math.cos((a * PI) / 6) * 10, 26 + Math.sin((a * PI) / 6) * 10, 100 + Math.cos((a * PI) / 6 + 0.2) * 12, 26 + Math.sin((a * PI) / 6 + 0.2) * 12);
    p.line(100, 40, 92, 44, { c: I.accent }); p.text(100, 46, 'PAWL', { align: 'center' }); p.text(100, 52, '(FLINT)', { align: 'center', c: p.soft });
    p.dimH(20, 68, 6, '9CM');
  },
  storm_lantern: (p, I) => {
    p.ellipse(50, 70, 18, 4); p.line(32, 70, 32, 62); p.line(68, 70, 68, 62); p.ellipse(50, 62, 18, 4, { a0: PI, a1: PI * 2 });
    p.curve([[38, 60], [34, 46], [38, 30], [44, 24]]); p.curve([[62, 60], [66, 46], [62, 30], [56, 24]]);
    p.hatch(38, 30, 24, 28, 4, p.soft, (x, y) => Math.abs(x - 50) < 12 - Math.abs(y - 44) * 0.1);
    p.ellipse(50, 46, 3, 6, { c: I.accent }); p.ellipse(50, 48, 1.5, 3, { c: I.accent });
    for (const x of [32, 42, 58, 68]) p.line(x, 62, x + (50 - x) * 0.2, 24, { c: p.soft });
    p.ellipse(50, 22, 10, 3); p.circle(50, 12, 6, { a0: PI, a1: PI * 2 });
    p.dimV(84, 8, 74, '30CM', { ext: 3 });
    p.callout(44, 40, 14, 30, 'A'); p.callout(50, 52, 14, 52, 'B');
  },
  tripod: (p, I) => {
    stone(p, 56, 16, 10, 5);
    camera(p, 46, 2, 20, 9);
    stick(p, 54, 20, 30, 76, 1.8); stick(p, 58, 20, 82, 76, 1.8); stick(p, 56, 21, 56, 78, 1.8);
    lash(p, 56, 21, 6, 3);
    p.ellipse(56, 24, 12, 12, { a0: PI * 0.5, a1: PI * 0.62, c: I.accent }); p.text(42, 36, '25°', { c: I.accent });
    p.dimV(98, 16, 78, '1M', { ext: 3 });
    p.dimH(30, 82, 78, '80CM');
    p.callout(64, 16, 84, 10, 'A'); p.callout(45, 50, 18, 50, 'B');
  },
  film_satchel: p => {
    p.rect(20, 26, 56, 40); p.curve([[20, 26], [26, 14], [70, 14], [76, 26]]);
    p.curve([[20, 30], [48, 40], [76, 30]]);
    for (let i = 0; i < 8; i++) p.rect(24 + i * 6.5, 46, 5, 16, { dash: [2, 1], c: p.soft });
    p.curve([[20, 28], [8, 10], [48, 2], [88, 10], [76, 28]], { c: p.soft });
    p.text(96, 40, '×8', { font: 'caps' }); p.text(92, 52, 'CARTRIDGES');
    p.dimH(20, 76, 74, '22CM');
  },
  developer_kit: (p, I) => {
    p.curve([[30, 18], [30, 26], [22, 34], [22, 68], [46, 68], [46, 34], [38, 26], [38, 18]]);
    p.rect(29, 12, 10, 6);
    p.line(22, 48, 46, 48, { c: p.soft }); p.hatch(23, 49, 22, 18, 3);
    p.rect(60, 50, 44, 18); p.line(60, 56, 104, 56, { c: p.soft });
    stick(p, 84, 14, 84, 44, 1.2, false); p.circle(84, 46, 2.5, { c: I.accent }); for (let y = 18; y < 42; y += 4) p.line(86, y, 88, y, { c: p.soft });
    p.text(92, 24, '37°', { c: I.accent });
    p.callout(34, 58, 12, 74, 'A'); p.callout(80, 60, 100, 76, 'B');
    p.dimV(14, 12, 68, '14CM', { side: -1 });
  },
  telephoto_lens: p => {
    cylH(p, 14, 40, 70, 14);
    p.line(28, 26, 28, 54, { c: p.soft }); p.line(62, 26, 62, 54, { c: p.soft });
    for (const x of [40, 52, 70]) p.ellipse(x, 40, 4, 11, { dash: [2, 2], c: p.soft });
    p.rect(84, 30, 10, 20);
    p.dimH(14, 94, 66, '30CM'); p.dimV(108, 26, 54, 'Ø8', { ext: 4 });
    p.callout(52, 34, 52, 10, 'A'); p.text(58, 8, 'OPAL ELEMENT', { c: p.soft });
  },
  gimbal: (p, I) => {
    p.curve([[24, 22], [24, 50], [40, 58], [56, 58], [72, 50], [72, 22]]);
    p.circle(24, 22, 3); p.circle(72, 22, 3);
    camera(p, 32, 14, 32, 18);
    p.line(48, 58, 48, 70); stone(p, 48, 74, 6, 4);
    for (const [x, y] of [[24, 30], [72, 30], [24, 42], [72, 42]] as Pt[]) p.rect(x - 2, y - 2, 4, 4, { c: I.accent });
    p.callout(70, 42, 92, 46, 'A'); p.callout(52, 74, 92, 70, 'B');
    p.text(86, 14, 'SHAKE -40%', { c: I.accent });
    p.dimH(24, 72, 6, '24CM');
  },
  video_rig: (p, I) => {
    camera(p, 20, 32, 46, 30);
    p.ellipse(44, 20, 14, 6); for (let i = -3; i <= 3; i++) p.line(44, 26, 44 + i * 4, 15, { c: p.soft });
    p.line(44, 26, 44, 27);
    p.circle(28, 38, 2.5, { c: I.accent }); p.text(32, 36, 'REC', { c: I.accent });
    p.callout(54, 18, 80, 10, 'A'); p.text(86, 18, 'FANSHELL', { c: p.soft }); p.text(86, 24, 'BAFFLE', { c: p.soft });
    p.dimH(20, 66, 72, '16CM');
  },
  instant_film: (p, I) => {
    p.rect(14, 18, 54, 44); p.rect(20, 24, 42, 32, { c: p.soft });
    p.rect(52, 30, 40, 36); p.rect(56, 34, 32, 22, { c: p.soft });
    p.line(96, 48, 108, 48, { c: I.accent }); p.line(106, 46, 108, 48, { c: I.accent }); p.line(106, 50, 108, 48, { c: I.accent });
    p.text(60, 60, 'ISO 1600');
    p.dimH(14, 68, 72, '12CM');
    p.callout(30, 30, 10, 8, 'A'); p.callout(72, 40, 100, 20, 'B');
  },
  lens_hood: p => {
    cylH(p, 14, 40, 36, 12);
    p.poly([[50, 28], [74, 18], [74, 62], [50, 52]]); p.ellipse(74, 40, 6, 22, { a0: -PI / 2, a1: PI / 2 });
    p.hatch(51, 22, 22, 36, 4, p.soft, (x, y) => y > 28 - (x - 50) * 0.4 && y < 52 + (x - 50) * 0.4);
    p.rect(88, 50, 24, 16, { c: p.soft }); for (let i = 0; i < 4; i++) p.line(90, 53 + i * 3, 110, 53 + i * 3, { c: p.soft, dash: [2, 2] });
    p.text(88, 44, 'KELP CLOTH');
    p.dimH(50, 74, 70, '6CM'); p.text(54, 8, 'BAIT TIN');
  },
  sealed_body: (p, I) => {
    camera(p, 24, 24, 56, 36);
    p.rect(26, 26, 52, 32, { dash: [2, 2], c: I.accent });
    for (const [x, y] of [[24, 40], [80, 32], [52, 60], [40, 24]] as Pt[]) p.circle(x, y, 2.5, { c: I.accent });
    p.text(84, 70, '14 SEAMS', { c: I.accent });
    p.callout(80, 32, 100, 18, 'A'); p.text(92, 10, 'CLAY', { c: p.soft });
  },
  fast_firmware: (p, I) => {
    p.rect(20, 14, 64, 44); p.rect(24, 18, 56, 36, { c: p.soft });
    p.text(28, 22, 'JENNA OS'); p.text(28, 30, 'V0.9.3'); p.text(28, 40, 'HELLO,', { c: p.soft }); p.text(28, 46, 'NATURE BOY', { c: p.soft });
    p.circle(70, 36, 6, { c: I.accent }); p.px(68, 34, I.accent); p.px(72, 34, I.accent); p.ellipse(70, 37, 3, 2, { a0: 0.3, a1: PI - 0.3, c: I.accent });
    p.rect(32, 62, 40, 10); for (let x = 34; x < 72; x += 4) { p.line(x, 72, x, 76); p.line(x, 58, x, 62); }
    p.text(78, 66, 'CHIP', { c: p.soft });
  },
  climbing_gloves: (p, I) => {
    glove(p, 30, 8, 1.9);
    for (let i = 0; i < 16; i++) p.px(34 + (i % 4) * 6 + (i % 2), 50 + Math.floor(i / 4) * 4, I.accent);
    p.callout(44, 54, 90, 50, 'A'); p.text(84, 60, 'FLINT GRIT', { c: p.soft });
    p.callout(32, 66, 90, 72, 'B');
  },
  waterproof_pack: (p, I) => {
    cylV(p, 46, 26, 44, 20, 6);
    for (let i = 0; i < 3; i++) p.ellipse(46, 18 - i * 3, 20, 3, { a0: PI, a1: PI * 2 });
    p.line(26, 18, 26, 26); p.line(66, 18, 66, 26);
    p.rect(40, 8, 12, 4, { c: I.accent });
    p.text(76, 12, 'ROLL ×3, CLIP');
    p.dimV(80, 26, 70, '40CM', { ext: 3 });
    p.hatch(27, 30, 38, 38, 5, p.soft, (x, y) => Math.abs(x - 46) < 19 && y < 70);
  },
  expedition_frame: (p, I) => {
    p.curve([[30, 10], [26, 40], [30, 74]]); p.curve([[70, 10], [74, 40], [70, 74]]);
    for (const y of [16, 40, 64]) p.line(28, y, 72, y);
    p.ellipse(50, 76, 30, 4, { c: I.accent }); p.rect(16, 72, 10, 8); p.rect(74, 72, 10, 8);
    pack(p, 34, 18, 32, 44);
    p.callout(28, 74, 8, 64, 'A'); p.text(86, 66, 'HIP BELT 80%', { c: I.accent });
    p.dimV(94, 10, 74, '70CM');
  },
  canteen: (p, I) => {
    p.circle(46, 46, 24); p.circle(46, 46, 18, { c: p.soft });
    p.rect(42, 14, 8, 8); p.rect(40, 10, 12, 4);
    p.curve([[24, 36], [14, 16], [46, 2], [78, 16], [68, 36]], { c: I.accent });
    p.dimH(22, 70, 76, '16CM');
    p.callout(46, 12, 80, 8, 'A'); p.text(86, 16, 'STOPPER', { c: p.soft });
    p.text(84, 40, '1 LITRE');
  },
  remedy_kit: (p, I) => {
    for (const [x, h] of [[14, 22], [30, 28], [46, 18]] as [number, number][]) { cylV(p, x + 6, 66 - h, h, 6, 2); }
    p.ellipse(84, 58, 18, 8); p.ellipse(84, 50, 18, 6, { a0: 0, a1: PI }); p.line(66, 50, 66, 58); p.line(102, 50, 102, 58);
    stick(p, 90, 54, 108, 24, 2, false);
    leaf(p, 70, 22, 22, -0.4); leaf(p, 52, 16, 14, 0.5);
    p.text(14, 72, 'CHARCOAL · KAWAKAWA · HOLLY', { c: p.soft });
    p.callout(66, 26, 90, 10, 'A');
  },
  smoker: (p, I) => {
    p.rect(20, 30, 56, 40);
    for (let y = 36; y < 70; y += 7) p.line(20, y, 76, y, { c: p.soft });
    for (let y = 30; y < 70; y += 14) for (let x = 20; x < 76; x += 14) p.line(x + ((y / 7) % 2) * 7, y, x + ((y / 7) % 2) * 7, y + 7, { c: p.soft });
    p.rect(60, 12, 10, 18);
    puff(p, 66, 8); puff(p, 76, 2, 0.8);
    p.line(28, 40, 68, 40, { c: I.accent }); for (const x of [34, 46, 58]) { p.line(x, 40, x, 44, { c: I.accent }); p.ellipse(x, 50, 3, 6); }
    p.rect(40, 62, 16, 8); p.text(42, 64, 'FIRE', { c: p.soft });
    p.dimH(20, 76, 76, '60CM');
  },
  shelter: (p, I) => {
    p.line(14, 74, 106, 74);
    p.line(20, 74, 30, 14); p.line(90, 74, 98, 30);
    p.poly([[22, 14], [102, 32], [102, 38], [22, 20]]);
    for (let x = 26; x < 100; x += 6) p.line(x, 15 + (x - 22) * 0.22, x - 2, 21 + (x - 22) * 0.22, { c: p.soft });
    p.poly([[40, 74], [58, 46], [76, 74]], false, { c: p.soft });
    p.line(58, 46, 58, 74, { dash: [2, 2], c: p.soft });
    p.curve([[102, 38], [106, 46], [108, 54]], { dash: [2, 2], c: I.accent }); p.text(84, 60, 'RAIN OFF', { c: I.accent });
    p.text(10, 4, 'RIDGE TO THE WIND →', { c: p.soft });
  },
  rain_catcher: (p, I) => {
    p.poly([[10, 18], [74, 34], [74, 38], [10, 22]]);
    for (let i = 0; i < 6; i++) p.line(16 + i * 10, 4 + (i % 2) * 3, 15 + i * 10, 8 + (i % 2) * 3, { c: I.accent });
    p.line(74, 36, 80, 50, { c: I.accent, dash: [2, 1] });
    p.line(60, 52, 100, 52); p.curve([[64, 52], [66, 70], [82, 76], [96, 70], [98, 52]]);
    p.hatch(66, 58, 30, 16, 3, p.soft, (x, y) => y > 58 && Math.abs(x - 81) < 15 - (y - 58) * 0.5);
    p.text(66, 44, 'CLAY PIT', { c: p.soft });
    p.text(12, 30, 'FALL 1 IN 20');
  },
  flax_straps: (p, I) => {
    for (let k = 0; k < 2; k++) p.curve([[16 + k * 6, 10], [20 + k * 6, 40], [18 + k * 6, 74]]);
    for (let y = 14; y < 72; y += 5) p.line(16 + ((y / 5) % 2) * 2, y, 22 + ((y / 5) % 2) * 2, y + 3, { c: p.soft });
    // the lashing knot, step by step
    for (let i = 0; i < 3; i++) {
      const x = 46 + i * 24;
      p.circle(x, 30, 7, { c: p.soft });
      p.curve([[x - 10, 40], [x - 4, 30 - i * 2], [x + 4, 24], [x + 8, 34 + i * 2]], { c: i === 2 ? I.accent : p.c });
      p.text(x, 46, String(i + 1), { align: 'center', font: 'caps' });
    }
    p.text(44, 60, 'OVER · UNDER · AROUND · PULL');
  },
  kelp_pockets: (p, I) => {
    pack(p, 34, 16, 40, 56);
    for (const x of [16, 76]) { p.rect(x, 40, 16, 22); p.rect(x + 1, 41, 14, 20, { dash: [1, 1], c: p.soft }); }
    p.text(18, 34, 'SNACKS', { c: I.accent }); p.text(78, 34, 'SNACKS', { c: I.accent });
    p.dimV(102, 40, 62, '8CM', { ext: 4 });
  },
  frame_pack: (p, I) => {
    p.curve([[30, 8], [24, 30], [26, 56], [36, 74]]); p.curve([[66, 8], [72, 30], [70, 56], [60, 74]]);
    for (const y of [14, 36, 58]) p.line(28, y, 70, y, { c: p.soft });
    pack(p, 30, 16, 36, 48);
    p.ellipse(48, 74, 22, 4, { c: I.accent });
    p.text(78, 20, 'STEAM-BEND', { c: p.soft }); p.text(78, 26, 'THE BOW', { c: p.soft });
    p.callout(36, 74, 84, 66, 'A');
  },
  kelp_soles: (p, I) => {
    shoe(p, 18, 30, 70, 22, 3);
    p.callout(70, 58, 96, 70, 'A'); p.text(8, 72, '3 LAYERS KELP + CLAY');
    p.dimV(102, 52, 58, '1CM', { ext: 3 });
  },
  grip_soles: (p, I) => {
    p.curve([[24, 40], [22, 20], [34, 10], [58, 12], [80, 20], [96, 36], [92, 56], [70, 64], [40, 62], [26, 54], [24, 40]]);
    for (let i = 0; i < 14; i++) { const x = 32 + (i % 7) * 9, y = 26 + Math.floor(i / 7) * 18 + (i % 2) * 4; p.poly([[x, y], [x + 3, y + 4], [x - 2, y + 4]], true, { c: I.accent }); }
    p.text(30, 70, 'CHIPS POINT BACK ←');
  },
  trail_boots: (p, I) => {
    shoe(p, 16, 34, 74, 22, 3, true);
    p.ellipse(80, 46, 8, 5, { dash: [2, 1], c: I.accent });
    p.callout(80, 46, 104, 30, 'A'); p.text(96, 40, 'FEATHER', { c: p.soft });
    p.dimH(16, 90, 72, 'SIZE 9');
  },
  snorkel: (p, I) => {
    p.ellipse(40, 40, 26, 16); p.ellipse(40, 40, 20, 11, { c: p.soft }); p.line(40, 29, 40, 51, { c: p.soft });
    p.curve([[70, 52], [74, 60], [80, 56], [82, 40], [82, 6]]); p.curve([[76, 52], [78, 58], [86, 54], [88, 40], [88, 6]]);
    p.line(82, 6, 88, 6);
    p.callout(30, 36, 8, 14, 'A'); p.text(4, 6, 'SEA GLASS', { c: p.soft });
    p.dimV(100, 6, 58, '35CM');
  },
  wetsuit: (p, I) => {
    p.poly([[40, 8], [60, 8], [64, 14], [80, 30], [76, 34], [64, 24], [64, 50], [62, 78], [52, 78], [50, 52], [48, 78], [38, 78], [36, 50], [36, 24], [24, 34], [20, 30], [36, 14]], true);
    for (const [x, y, w, h] of [[42, 30, 8, 6], [56, 56, 5, 8], [40, 60, 6, 5], [26, 28, 5, 4]] as [number, number, number, number][]) { p.rect(x, y, w, h, { c: I.accent }); p.hatch(x, y, w, h, 2, I.accent); }
    p.text(84, 50, 'PATCHES:'); p.text(84, 56, 'KELP + CLAY', { c: p.soft });
  },
  fins: p => {
    for (const x of [24, 66]) {
      p.curve([[x, 70], [x - 4, 40], [x - 10, 12], [x + 20, 12], [x + 14, 40], [x + 10, 70], [x, 70]]);
      p.ellipse(x + 5, 64, 6, 6, { c: p.soft });
      for (let i = 0; i < 4; i++) p.line(x + 5, 52, x - 6 + i * 7, 16, { c: p.soft });
    }
    p.text(46, 4, 'FANSHELL RIBS', { align: 'center' });
  },
  lamp_lens: (p, I) => {
    p.rect(20, 30, 22, 18); p.circle(31, 39, 7); p.circle(31, 39, 4, { c: p.soft });
    p.curve([[20, 32], [12, 36], [10, 44], [20, 46]], { c: p.soft });
    for (let i = -2; i <= 2; i++) p.line(40, 39 + i * 2, 108, 39 + i * 12, { c: I.accent, dash: [3, 2] });
    p.text(70, 12, '×2 BEAM', { c: I.accent });
  },
  solar_battery: (p, I) => {
    p.poly([[10, 20], [60, 14], [66, 44], [16, 52]], true);
    for (let i = 1; i < 4; i++) { p.line(10 + i * 12.5, 20 - i * 1.5, 16 + i * 12.5, 52 - i * 2, { c: p.soft }); }
    for (let j = 1; j < 3; j++) p.line(10 + j * 2, 20 + j * 10.6, 60 + j * 2, 14 + j * 10, { c: p.soft });
    p.curve([[40, 50], [48, 64], [70, 66], [80, 60]], { c: I.accent });
    p.rect(80, 50, 26, 16); p.rect(106, 55, 3, 6); p.text(84, 55, '+ -');
  },
  phrasebook: (p, I) => {
    p.rect(16, 10, 34, 64); p.rect(19, 16, 28, 48, { c: p.soft });
    p.circle(33, 69, 2);
    for (const [x, y, t] of [[58, 14, 'KIA ORA'], [66, 36, 'KAI'], [56, 58, 'CHUNK, NO']] as [number, number, string][]) {
      const w = t.length * 4 + 6; p.rect(x, y, w, 10); p.line(x + 3, y + 10, x - 2, y + 14); p.text(x + 3, y + 3, t);
    }
  },
  voice_pack: (p, I) => {
    p.rect(14, 18, 14, 26); p.ellipse(21, 18, 7, 7, { a0: PI, a1: PI * 2 }); p.curve([[10, 36], [12, 50], [21, 54], [30, 50], [32, 36]]); p.line(21, 54, 21, 66); p.line(14, 66, 28, 66);
    const pts: Pt[] = [];
    for (let x = 40; x < 112; x += 2) pts.push([x, 40 + Math.sin(x * 0.7) * (6 + Math.sin(x * 0.13) * 10)]);
    p.poly(pts, false, { c: I.accent });
    p.text(40, 66, 'HER GRANDMOTHER’S STORIES', { c: p.soft });
  },
  field_notebook: (p, I) => {
    p.rect(10, 12, 48, 60); p.rect(58, 12, 48, 60); p.line(58, 12, 58, 72, { c: p.soft });
    for (let y = 22; y < 70; y += 6) { p.line(14, y, 54, y, { c: p.soft }); }
    p.text(62, 16, 'DATE'); p.text(62, 26, 'PLACE'); p.text(62, 36, 'WX'); p.text(62, 46, 'BEHAV.');
    for (const y of [22, 32, 42, 52]) p.line(62, y, 102, y, { c: p.soft });
    p.text(14, 16, 'DAY 4 · 06:10', { c: I.accent });
  },
  foodweb_map: (p, I) => {
    const N: Pt[] = [[20, 16], [60, 10], [100, 18], [36, 44], [80, 42], [56, 70], [16, 66], [104, 66]];
    const E: [number, number][] = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5], [6, 3], [7, 4], [0, 1], [5, 6]];
    for (const [a, b] of E) p.line(N[a][0], N[a][1], N[b][0], N[b][1], { c: a % 2 ? I.accent : p.soft });
    N.forEach(([x, y], i) => { p.circle(x, y, 5); p.text(x, y - 2, String.fromCharCode(65 + i), { align: 'center' }); });
    p.text(4, 76, 'RED = EATS', { c: I.accent });
  },
  grant_writing: (p, I) => {
    p.rect(20, 6, 54, 70); for (let y = 14; y < 40; y += 5) p.line(26, y, 68, y, { c: p.soft });
    p.text(26, 44, 'NOVEL', { font: 'caps' }); p.line(26, 53, 58, 53, { c: I.accent });
    for (let i = 0; i < 4; i++) p.rect(28 + i * 10, 70 - (i + 1) * 4, 6, (i + 1) * 4);
    p.line(80, 60, 110, 30, { c: I.accent }); p.line(104, 30, 110, 30, { c: I.accent }); p.line(110, 36, 110, 30, { c: I.accent });
    p.text(84, 66, '+15% RP', { c: I.accent });
  },
  ethogram: (p, I) => {
    p.circle(30, 44, 20); p.rect(26, 18, 8, 6); p.line(30, 44, 30, 30); p.line(30, 44, 40, 48, { c: I.accent });
    for (let a = 0; a < 12; a++) p.line(30 + Math.cos((a * PI) / 6) * 17, 44 + Math.sin((a * PI) / 6) * 17, 30 + Math.cos((a * PI) / 6) * 19, 44 + Math.sin((a * PI) / 6) * 19, { c: p.soft });
    p.rect(60, 16, 50, 54); for (let y = 26; y < 70; y += 11) p.line(60, y, 110, y, { c: p.soft }); p.line(84, 16, 84, 70, { c: p.soft });
    p.text(62, 19, 'FEED'); p.text(62, 30, 'CALL'); p.text(62, 41, 'PREEN'); p.text(62, 52, 'FIGHT');
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3 + r; i++) p.line(87 + i * 3, 19 + r * 11, 87 + i * 3, 24 + r * 11, { c: I.accent });
  },
  survey_kit: (p, I) => {
    p.rect(14, 24, 44, 44); for (let i = 1; i < 4; i++) { p.line(14 + i * 11, 24, 14 + i * 11, 68, { c: p.soft }); p.line(14, 24 + i * 11, 58, 24 + i * 11, { c: p.soft }); }
    p.line(64, 46, 112, 46); for (let x = 64; x <= 112; x += 8) p.circle(x, 46, 1.5, { c: I.accent });
    p.dimH(14, 58, 74, '50CM'); p.text(70, 36, 'KNOT EVERY 1M');
    leaf(p, 30, 40, 10, 0.4); leaf(p, 46, 58, 8, -0.8);
  },
  eco_model: (p, I) => {
    p.curve([[14, 50], [20, 28], [44, 20], [70, 26], [96, 22], [108, 40], [100, 62], [70, 70], [40, 66], [20, 64], [14, 50]], { c: p.soft });
    const B: Pt[] = [[28, 34], [62, 30], [88, 38], [46, 56], [80, 58]];
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) if ((i + j) % 2) p.line(B[i][0], B[i][1], B[j][0], B[j][1], { c: I.accent, dash: [2, 2] });
    for (const [x, y] of B) p.rect(x - 6, y - 4, 12, 8);
    p.text(60, 4, 'ZEA MODEL V2', { align: 'center' });
  },
  hand_lens: (p, I) => {
    p.circle(42, 36, 22); p.circle(42, 36, 19, { c: p.soft });
    leaf(p, 42, 36, 26, -0.6, 0.45);
    stick(p, 58, 52, 80, 74, 3, false);
    p.ellipse(34, 26, 4, 2, { c: I.accent });
    p.text(80, 20, '×6, ROUGHLY'); p.dimH(20, 64, 4, '4CM');
  },
  autotag: (p, I) => {
    p.rect(10, 10, 70, 50);
    p.rect(18, 22, 22, 18, { c: I.accent }); p.text(18, 15, '#WEKA', { c: I.accent });
    p.rect(50, 30, 22, 22, { c: I.accent }); p.text(50, 54, '#TUI', { c: I.accent });
    p.curve([[22, 36], [26, 28], [34, 30], [36, 38]], { c: p.soft });
    for (let i = 0; i < 4; i++) p.line(84, 14 + i * 7, 84 + 10 + ((i * 7) % 18), 14 + i * 7, { c: p.soft });
    p.text(84, 46, 'AUTOTAG.PY');
  },
  reagent_kit: (p, I) => {
    p.rect(10, 50, 70, 8); p.line(10, 40, 80, 40);
    for (let i = 0; i < 4; i++) {
      const x = 18 + i * 16;
      p.line(x, 24, x, 60); p.line(x + 8, 24, x + 8, 60); p.ellipse(x + 4, 60, 4, 2, { a0: 0, a1: PI });
      const lvl = 36 + i * 5; p.line(x, lvl, x + 8, lvl, { c: I.accent }); p.hatch(x + 1, lvl, 6, 60 - lvl, 2, p.soft);
      p.text(x + 4, 16, 'ABCD'[i], { align: 'center' });
    }
    p.text(86, 34, 'A → B'); p.text(86, 42, '→ SHAKE'); p.text(86, 50, '→ WAIT');
  },
  field_microscope: (p, I) => {
    p.rect(30, 70, 50, 6); p.curve([[66, 70], [74, 50], [70, 26]]);
    p.poly([[40, 10], [50, 6], [64, 40], [54, 44]], true);
    p.rect(30, 48, 32, 4); p.ellipse(46, 60, 8, 2, { c: I.accent });
    p.line(46, 52, 46, 58, { c: p.soft, dash: [1, 1] });
    p.circle(72, 40, 4);
    p.text(84, 16, '×40 / ×100'); p.callout(46, 60, 96, 56, 'A'); p.text(86, 66, 'OPAL MIRROR', { c: p.soft });
  },
  plant_press: (p, I) => {
    box(p, 14, 52, 60, 8, 14); box(p, 14, 22, 60, 8, 14);
    leaf(p, 52, 40, 30, 0.1, 0.4);
    p.line(30, 30, 30, 52, { dash: [2, 2], c: p.soft }); p.line(64, 30, 64, 52, { dash: [2, 2], c: p.soft });
    p.text(90, 30, 'PRESS'); p.text(90, 36, '3 DAYS'); p.text(90, 50, 'FLAX TIES', { c: p.soft });
  },
  pocket_sequencer: (p, I) => {
    p.rect(30, 6, 44, 70); p.rect(34, 12, 36, 30, { c: p.soft });
    wave(p, 36, 27, 68, 8, 16, 0, I.accent); wave(p, 36, 27, 68, 8, 16, PI);
    for (let x = 38; x < 68; x += 4) p.line(x, 27 + Math.sin(((x - 36) / 16) * PI * 2) * 8, x, 27 - Math.sin(((x - 36) / 16) * PI * 2) * 8, { c: p.soft });
    for (let i = 0; i < 3; i++) p.circle(42 + i * 10, 56, 3);
    p.rect(44, 66, 16, 4, { c: I.accent });
    p.text(82, 20, 'ZEA-SEQ'); p.text(82, 26, 'MK.II', { c: p.soft }); p.dimV(86, 6, 76, '14CM');
  },
  fruit_lure: (p, I) => {
    leaf(p, 46, 42, 56, 0.15, 0.6);
    p.line(46, 22, 46, 62, { c: I.accent }); p.line(20, 40, 72, 44, { c: I.accent });
    for (const [x, y] of [[90, 30], [98, 36], [92, 42], [100, 26]] as Pt[]) p.circle(x, y, 3.5);
    p.text(82, 54, 'RIPE ONES!', { c: I.accent });
  },
  grub_lure: p => {
    box(p, 24, 34, 50, 30, 14);
    for (let x = 30; x < 74; x += 6) p.line(x, 34, x, 64, { c: p.soft });
    for (const [x, y] of [[36, 52], [48, 58], [60, 50]] as Pt[]) { p.ellipse(x, y, 4, 2); p.line(x - 4, y, x - 6, y - 3); }
    p.text(86, 40, 'KEEP THEM'); p.text(86, 46, 'DAMP');
  },
  glow_lure: (p, I) => {
    p.curve([[40, 16], [26, 34], [30, 62], [50, 70], [70, 62], [74, 34], [60, 16]]);
    p.line(40, 16, 60, 16); p.line(50, 16, 50, 6);
    for (const [x, y] of [[44, 40], [54, 50], [58, 36], [46, 58], [62, 56]] as Pt[]) p.circle(x, y, 2, { c: I.accent });
    for (let i = 0; i < 6; i++) p.line(50 + Math.cos(i) * 30, 44 + Math.sin(i) * 26, 50 + Math.cos(i) * 36, 44 + Math.sin(i) * 31, { c: I.accent, dash: [1, 1] });
    p.text(84, 70, 'AT DUSK');
  },
};
