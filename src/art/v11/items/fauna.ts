// V11 item art: insects and animal samples. Lantern beetle, giant wētā, sky moth, leaf mantis, needle
// dragonfly, huhu grub, the island's jewel beetle, sand hopper, lantern moth and jewel hornet; fur, a
// barred feather, a shed scale and a whole shed skin, droppings, a banded quill, a serpent vertebra,
// eggshell, an armour plate, colony down and a coral twig.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, curve, stoneTex, noise2, fbm2 } from './kit';
import type { Pt, Ramp, Mask } from './kit';

const art = artGroup('Insects & animal samples');

/** a jointed insect leg: thin tube segments through the points, darker toward the foot */
function leg(p: IP, pts: Pt[], R: Ramp, r = 0.7) {
  for (let i = 0; i + 1 < pts.length; i++) p.tube([pts[i], pts[i + 1]], Math.max(0.45, r - i * 0.15), R, { lift: 0.2 - i * 0.3, spec: 0.92 });
}
/** a thin antenna: a single-pixel line along a curve */
function feeler(p: IP, pts: Pt[], c: C2) { for (const [x, y] of pts) p.px(x, y, c); }
type C2 = number;
/** a translucent wing with veins: tint fill at alpha, darker veins radiating from the base */
function wing(p: IP, m: Mask, bx: number, by: number, tint: string, a: number, vein: string, spot?: [number, number, string]) {
  p.fill(m, (x, y) => {
    const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by), ang = Math.atan2(y + 0.5 - by, x + 0.5 - bx);
    const v = Math.abs(Math.sin(ang * 9)) < 0.18 || Math.abs((d % 4) - 2) < 0.25;
    return v ? H(vein, Math.min(255, a + 90)) : H(tint, a);
  });
  // the leading edge is a darker rib
  p.fill(m, (x, y) => (!p.at(m, x, y - 1) ? H(vein, 230) : -1));
  if (spot) p.fill(Pen.and(m, p.maskDisc(spot[0], spot[1], 1.4)), H(spot[2]));
}

// ------------------------------------------------------------------ lantern beetle (1x1)
art('lanternbeetle', fp(1, 1), p => {
  const f = frame(19, 19, 5, 5); // tail -> head
  const El = rp('#070a16', '#0f1a34', '#1a2e58', '#284a84', '#4474b4', '#a8d0f4');
  for (const [u, s] of [[7, 1], [10, 1], [13, 1], [7, -1], [10, -1], [13, -1]] as Pt[]) {
    const p0 = f.at(u, s * 3.4), p1 = f.at(u + (u - 10) * 0.35 - 0.8, s * 6.3), p2 = f.at(u + (u - 10) * 0.7 - 2.4, s * 7.4);
    leg(p, [p0, p1, p2], RP.iron, 0.6);
  }
  for (const s of [-1, 1]) { const a0 = f.at(17.5, s), a1 = f.at(20, s * 3.6), a2 = f.at(21.6, s * 4.4); p.line(a0[0], a0[1], a1[0], a1[1], RP.iron[3]); p.line(a1[0], a1[1], a2[0], a2[1], RP.iron[2]); }
  // the glowing lantern segments at the tail
  const [lx, ly] = f.at(2.8, 0);
  p.ball(lx, ly, 3.6, 3.6, rp('#6a8a1a', '#a8c828', '#d8f050', '#f4ff90', '#fcffd0', '#ffffff'), { lift: 1.2, spec: 0.9 });
  // elytra with a seam, pronotum and head
  const ang = Math.atan2(f.uy, f.ux);
  const [ex, ey] = f.at(8.6, 0);
  const el = p.ball(ex, ey, 6.4, 4.8, El, { ang, spec: 0.93, k: 1.15 });
  p.fill(el, (x, y) => (Math.abs(f.loc(x, y)[1]) < 0.5 ? El[0] : -1));
  p.fill(el, (x, y) => { const [u, v] = f.loc(x, y); return Math.abs(v) > 1.2 && Math.abs(v) < 3.6 && Math.round(u) % 2 === 0 && u > 4 && u < 12 ? tone(p.get(x, y), -0.12) : -1; });
  const [px2, py2] = f.at(14.6, 0);
  p.ball(px2, py2, 2.5, 3.6, El, { ang, spec: 0.9, lift: 0.4 });
  const [hx, hy] = f.at(17.4, 0);
  p.ball(hx, hy, 1.7, 2.2, RP.iron, { ang, lift: 1 });
  p.glow(19.5, 19.5, 8, '#d8ff70', 120);
});

// ------------------------------------------------------------------ giant wētā (2x1): armoured, spiny-legged, antennae streaming back
art('weta', fp(2, 1), p => {
  const Wt = rp('#1a0a06', '#3c1a0c', '#662e12', '#94481a', '#c26c2a', '#eaa456');
  const Wl = rp('#1e0c06', '#40200e', '#6a3816', '#985622', '#c47e3a', '#eeb878');
  // far legs first (darker), then the body, then the near legs
  leg(p, [[18, 17], [16, 21.5], [13, 22.5]], Wl, 0.7);
  leg(p, [[24, 17], [24.5, 21.8], [27, 22.6]], Wl, 0.7);
  // abdomen: banded plates
  const ab = p.maskFn((x, y) => { const dx = (x + 0.5 - 33) / 12.5, dy = (y + 0.5 - 13.6) / 5.2; return dx * dx + dy * dy <= 1; });
  p.relief(ab, Wt, p.dome(ab, 3.4), { spec: 0.93, lift: 0.2 });
  p.fill(ab, (x, y) => ((x - 22) % 3 === 0 && x > 22 ? tone(p.get(x, y), -0.4) : y > 16 && (x % 3) === 1 ? Wt[4] : -1));
  // pronotum shield and head
  const pr = p.maskEllipse(18.2, 12.4, 5.2, 5);
  p.relief(pr, Wt, p.dome(pr, 3), { spec: 0.9, lift: 0.4 });
  p.seam(pr, Wt[1], 8);
  const hd = p.maskEllipse(10.6, 13.4, 4.8, 5.4);
  p.relief(hd, Wt, p.dome(hd, 3), { spec: 0.9, lift: 0.3 });
  p.seam(hd, Wt[1], 8);
  p.px(8, 12, H('#0c0604')); p.px(8, 11, H('#fff0d0'));
  p.pts([[6, 17], [7, 18], [8, 18]], Wt[1]);
  // the great hind leg: a spiny femur folded up over the abdomen, tibia down
  const fem = p.tube(bez([28, 15], [36, 6], [43, 5], 12), t => 2.6 - t * 1.2, Wl, { spec: 0.92, lift: 0.4 });
  p.fill(fem, (x, y) => (y > 4 && (x % 3 === 0) && !p.at(fem, x, y - 1) ? Wl[5] : -1));
  leg(p, [[43, 5], [46, 13], [44.5, 21.5]], Wl, 0.9);
  for (const [x, y] of [[46, 9], [46, 12], [45, 16], [45, 19]] as Pt[]) p.px(x + 1, y, RP.cream[4]);
  // near front legs
  leg(p, [[12, 17], [9, 20.5], [5.5, 21.6]], Wl, 0.8);
  leg(p, [[16, 18], [17.6, 21], [20.5, 22.5]], Wl, 0.8);
  // long pale antennae sweeping back over the body
  feeler(p, bez([8, 9], [10, 0.6], [30, 2], 40), RP.cream[2]);
  feeler(p, bez([10, 9], [16, 3], [38, 1], 50), RP.cream[3]);
});

// ------------------------------------------------------------------ sky moth (2x1): wings spread, eye-spots staring
art('skymoth', fp(2, 1), p => {
  const Or = rp('#3a1606', '#7a3410', '#b86018', '#e0922c', '#f6c060', '#fff0b8');
  const Hw = rp('#3a1414', '#6e2a26', '#a24a3a', '#cc7656', '#eaa682', '#ffdcc4');
  const wing = (pts: number[], R: Ramp, eye: Pt | null, lift: number) => {
    const m = p.maskPoly(pts);
    p.relief(m, R, p.dome(m, 3), { spec: 1, lift, tex: (x, y) => (noise2(x * 0.5, y * 0.5, 4) > 0.64 ? -0.4 : 0) });
    // dusky margin and fine scale lines
    p.fill(m, (x, y) => (!p.at(m, x, y + 1) || !p.at(m, x + (x < 24 ? -1 : 1), y) ? R[1] : -1));
    if (eye) {
      const [ex, ey] = eye;
      p.fill(Pen.and(m, p.maskDisc(ex, ey, 4)), (x, y) => { const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey); return d < 1.1 ? H('#fffbe8') : d < 2.3 ? H('#141018') : d < 3.1 ? RP.yellow[4] : H('#2a1410'); });
    }
    return m;
  };
  wing([24, 12, 14, 17, 7, 22, 4, 17, 11, 12], Hw, null, 0);
  wing([24, 12, 34, 17, 41, 22, 44, 17, 37, 12], Hw, null, -0.3);
  wing([24, 11, 13, 2, 3, 3, 1, 9, 6, 15, 18, 15], Or, [10, 8.5], 0.3);
  wing([24, 11, 35, 2, 45, 3, 47, 9, 42, 15, 30, 15], Or, [38, 8.5], -0.1);
  // furry body and feathery antennae
  p.tube([[24, 5], [24, 19]], t => (t < 0.3 ? 2.2 : 1.9 - (t - 0.3) * 1.1), rp('#1e0e08', '#3e2012', '#62381c', '#8a5428', '#b07a3c', '#d4a060'), { tex: (x, y) => (y % 2 ? -0.8 : 0), spec: 1 });
  for (const s of [-1, 1]) { feeler(p, bez([24 + s, 4], [24 + s * 3, 1], [24 + s * 7, 0.5], 10), Or[3]); p.px(24 + s * 4, 1, Or[2]); p.px(24 + s * 6, 0, Or[2]); }
});

// ------------------------------------------------------------------ leaf mantis (1x2): a fern leaflet with eyes
art('mantis', fp(1, 2), p => {
  const G = rp('#103018', '#1d5424', '#357e2c', '#5aa834', '#8ed04a', '#d4f490');
  // walking legs (thin), then the leaf-shaped abdomen with its veins
  for (const [a, b, c] of [[[10, 27], [5, 31], [3, 37]], [[13, 27], [18, 31], [20.5, 37]], [[10, 33], [5.5, 38], [4.5, 44]], [[13, 33], [18.5, 38.5], [19.5, 44.5]]] as Pt[][]) leg(p, [a, b, c], G, 0.6);
  const ab = p.band(curve(bez([11.6, 24], [9.6, 36], [12.6, 46], 12)), t => 6 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) + 0.4);
  const ac = curve(bez([11.6, 24], [9.6, 36], [12.6, 46], 12));
  p.relief(ab, G, (x, y) => { if (!p.at(ab, x, y)) return 0; const q = ac.loc(x, y); return 2.4 - Math.abs(q.v) * 0.35; }, { spec: 1, lift: 0.3 });
  p.fill(ab, (x, y) => { const q = ac.loc(x, y); if (Math.abs(q.v) < 0.5) return G[5]; const side = Math.abs(((q.u - Math.abs(q.v) * 0.8) % 3.2 + 3.2) % 3.2 - 1.6) < 0.35; return side && Math.abs(q.v) > 1 && Math.abs(q.v) < 5 ? (q.v < 0 ? G[4] : G[2]) : -1; });
  // thorax stalk, folded raptorial forelegs, the triangular head with huge eyes
  p.tube([[11.6, 25], [11.4, 13]], 1.3, G, { lift: 0.4, spec: 1 });
  for (const s of [-1, 1]) {
    p.tube([[11.5, 16], [11.5 + s * 4.5, 12], [11.5 + s * 3, 18.5]], 1.1, G, { lift: s < 0 ? 0.5 : 0, spec: 1 });
    p.px(Math.round(11.5 + s * 3), 19, G[1]);
  }
  const hd = p.maskPoly([7, 7, 16, 7, 11.6, 13.6]);
  p.relief(hd, G, p.dome(hd, 1.6), { lift: 0.5 });
  for (const [x, y] of [[7, 6], [15, 6]] as Pt[]) { p.ball(x + 0.5, y + 0.5, 2, 2, rp('#2a3a08', '#4a6410', '#7a9a1a', '#b0d03a', '#e8f8a0', '#ffffff'), { spec: 0.85 }); p.px(x, y + 1, H('#141a08')); }
  feeler(p, bez([10, 5], [7, 1], [3, 1.5], 8), G[3]);
  feeler(p, bez([13, 5], [16, 1], [20, 1.5], 8), G[3]);
});

// ------------------------------------------------------------------ needle dragonfly (2x2): metallic blue, glassy wings, seen from above
art('dragonfly', fp(2, 2), p => {
  const f = frame(42, 42, 8, 8); // tail -> head along the diagonal
  const Bl = rp('#06122e', '#0c2856', '#16448a', '#2468b4', '#4aa0e0', '#c4ecff');
  // four glassy wings across the thorax, then the body over them
  const wingAt = (u: number, s: number, len: number, wid: number, sweep: number) => {
    const [bx, by] = f.at(u, 0);
    const wf = frame(bx, by, ...f.at(u + sweep, s * len));
    const m = p.maskFn((x, y) => { const [a, b] = wf.loc(x, y); return a >= 0 && a <= wf.len && Math.abs(b) <= wid * Math.sin(Math.PI * Math.min(1, a / wf.len * 0.95 + 0.05)) ** 0.6; });
    const [sx, sy] = wf.at(wf.len * 0.82, 0);
    wing(p, m, bx, by, '#d8f0ff', 70, '#5a7a94', [sx, sy, '#3a2a4a']);
  };
  wingAt(30, 1, 17, 3.4, -2); wingAt(30, -1, 17, 3.4, -2);
  wingAt(26.5, 1, 18, 3.8, -4); wingAt(26.5, -1, 18, 3.8, -4);
  // the long segmented abdomen
  const ab = p.tube([f.at(0, 0), f.at(25, 0)], u => 1.1 + u * 0.7, Bl, { spec: 0.9, lift: 0.3 });
  p.fill(ab, (x, y) => { const [u] = f.loc(x, y); return Math.round(u) % 3 === 0 && u < 24 ? Bl[1] : -1; });
  const [t0x, t0y] = f.at(0.5, 0); p.px(t0x, t0y, Bl[0]);
  // thorax and the big wrap-around eyes
  const [tx, ty] = f.at(28, 0);
  p.ball(tx, ty, 3.4, 3.4, rp('#0a1a2a', '#14344a', '#1e5a6a', '#2a8a8a', '#58c4b4', '#d4fff0'), { spec: 0.9 });
  for (const s of [-1, 1]) { const [ex, ey] = f.at(32.3, s * 2); p.ball(ex, ey, 2.4, 2.4, rp('#062a2a', '#0c4a4a', '#147a74', '#22aaa0', '#62e0d0', '#ffffff'), { spec: 0.85 }); }
});

// ------------------------------------------------------------------ huhu grub (1x1): a fat, glossy C of a larva
art('grub', fp(1, 1), p => {
  const Gb = rp('#5a4630', '#8c7656', '#b8a47e', '#ddcca4', '#f4e8c8', '#ffffff');
  const pts: Pt[] = [];
  for (let i = 0; i <= 20; i++) { const a = Math.PI * (0.95 + 1.25 * (i / 20)); pts.push([12 + Math.cos(a) * 6.4, 12.5 + Math.sin(a) * 5.6]); }
  const c = curve(pts);
  const m = p.tube(pts, t => 2.4 + Math.sin(t * Math.PI) * 2.2, Gb, { spec: 0.93, lift: 0.4 });
  p.fill(m, (x, y) => { const q = c.loc(x, y); return Math.round(q.u) % 3 === 0 && q.t > 0.12 ? tone(p.get(x, y), -0.22) : -1; });
  // the brown head with mandibles, and little legs
  const e = c.at(0);
  p.ball(e.x - 0.5, e.y, 2.4, 2.2, rp('#2a1206', '#4a2410', '#74401c', '#a0622e', '#c88a48', '#f0c088'), { spec: 0.88, lift: 0.3 });
  p.px(Math.round(e.x - 2.5), Math.round(e.y + 1), H('#1a0a04'));
  for (const t of [0.12, 0.2, 0.28]) { const q = c.at(t); p.px(Math.round(q.x - q.ty * -3.2), Math.round(q.y + q.tx * -3.2), RP.fur[2]); }
});

// ------------------------------------------------------------------ jewel beetle (1x1): structural green-gold, never pigment
art('bug_jewelbeetle', fp(1, 1), p => {
  const f = frame(12, 21, 12, 3); // tail -> head (pointing up)
  for (const [u, s] of [[7, 1], [10, 1], [13, 1], [7, -1], [10, -1], [13, -1]] as Pt[]) leg(p, [f.at(u, s * 3.6), f.at(u + (u - 10) * 0.4, s * 6.4), f.at(u + (u - 10) * 0.8 - 1, s * 7.6)], RP.iron, 0.6);
  const el = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return u >= 1 && u <= 12.5 && Math.abs(v) <= 5.4 * Math.sin(Math.PI * Math.min(1, (u - 0.2) / 13)) ** 0.5; });
  // iridescence: green through gold to violet with the angle of the surface
  p.fill(el, (x, y) => {
    const [u, v] = f.loc(x, y);
    const nx = v / 5.4, l = p.lum(nx, -(u - 7) / 9, 0.7);
    const IR = [H('#1a0a3a'), H('#2a1a6a'), H('#1a5a4a'), H('#2a9a3a'), H('#8ad040'), H('#f4e870')];
    const k = clamp(Math.round(l * 4.6 + (hash(x, y, 3) - 0.5) * 0.6), 0, 5);
    return IR[k];
  });
  p.fill(el, (x, y) => (Math.abs(f.loc(x, y)[1]) < 0.5 ? H('#0e2a1a') : -1));
  p.glint(9, 9, H('#ffffff'), 0.4);
  p.ball(12, 4.6, 3.4, 2.4, rp('#0a1a12', '#123a22', '#1e6a32', '#40a040', '#a0d850', '#f8ff9a'), { spec: 0.9 });
  p.ball(12, 2.6, 1.8, 1.4, RP.iron, { lift: 0.5 });
  feeler(p, [[10, 2], [9, 1], [8, 1]], RP.iron[3]); feeler(p, [[14, 2], [15, 1], [16, 1]], RP.iron[3]);
});

// ------------------------------------------------------------------ sand hopper (1x1): a springy little amphipod
art('bug_sandhopper', fp(1, 1), p => {
  const Sh = rp('#3a3428', '#625a46', '#8c8268', '#b6ac8c', '#dcd4b4', '#fffaea');
  const pts = bez([5, 10], [12, 4], [20, 13], 16);
  const c = curve(pts);
  for (let i = 0; i < 6; i++) { const q = c.at(0.15 + i * 0.13); leg(p, [[q.x, q.y + 2], [q.x + (i < 3 ? -1.5 : 1.5), q.y + 6], [q.x + (i < 3 ? -2.5 : 2.5), q.y + 8.5]], Sh, 0.5); }
  const m = p.tube(pts, t => 2.8 - Math.abs(t - 0.4) * 2.6, Sh, { spec: 0.92, lift: 0.4 });
  p.fill(m, (x, y) => { const q = c.loc(x, y); return Math.round(q.u) % 2 === 0 && q.v > 0.4 ? tone(p.get(x, y), -0.25) : -1; });
  // tail fan, a big black eye, antennae
  p.tube([[20, 13], [22, 17]], 0.8, Sh, { lift: 0.2 });
  p.px(6, 9, H('#0a0a0a')); p.px(6, 8, H('#ffffff'));
  feeler(p, bez([4, 9], [1, 6], [2, 2], 8), Sh[3]);
  feeler(p, bez([5, 8], [4, 4], [7, 1], 8), Sh[4]);
});

// ------------------------------------------------------------------ lantern moth (1x1): pale wings, two glowing spots
art('bug_lanternmoth', fp(1, 1), p => {
  const Pm = rp('#5a5446', '#847c66', '#aca48a', '#d0caae', '#ece8d4', '#ffffff');
  const fw = (pts: number[], lift: number) => { const m = p.maskPoly(pts); p.relief(m, Pm, p.dome(m, 2.4), { spec: 1, lift, tex: (x, y) => (noise2(x * 0.6, y * 0.6, 7) > 0.62 ? -0.4 : 0) }); return m; };
  fw([12, 8, 4, 18, 1, 16, 3, 9], 0.3);
  fw([12, 8, 20, 18, 23, 16, 21, 9], -0.2);
  fw([12, 7, 4, 2, 1, 5, 4, 12], 0.4);
  fw([12, 7, 20, 2, 23, 5, 20, 12], 0);
  p.tube([[12, 4], [12, 18]], t => 1.8 - t * 0.9, rp('#3a3428', '#5e5642', '#86806a', '#aaa48c', '#d0caae', '#f4f0e0'), { tex: (x, y) => (y % 2 ? -0.7 : 0) });
  for (const [x, y] of [[5, 7], [18, 7]] as Pt[]) { p.ball(x + 0.5, y + 0.5, 1.6, 1.6, rp('#6a8a1a', '#a8c828', '#d8f050', '#f4ff90', '#fcffd0', '#ffffff'), { lift: 1.5 }); p.glow(x + 0.5, y + 0.5, 5, '#e0ff80', 110); }
  feeler(p, [[11, 3], [10, 2], [9, 1]], Pm[2]); feeler(p, [[13, 3], [14, 2], [15, 1]], Pm[2]);
});

// ------------------------------------------------------------------ jewel hornet (1x1): teal, violet and gold, cross even in death
art('bug_hornet', fp(1, 1), p => {
  const f = frame(20, 19, 4, 6); // tail -> head
  const ang = Math.atan2(f.uy, f.ux);
  // wings (glassy, smoky violet) behind the body
  for (const s of [-1, 1]) {
    const [bx, by] = f.at(12, s * 1.2);
    const wf = frame(bx, by, ...f.at(5.5, s * 8));
    const m = p.maskFn((x, y) => { const [a, b] = wf.loc(x, y); return a >= 0 && a <= wf.len && Math.abs(b) <= 2.6 * Math.sin(Math.PI * Math.min(1, a / wf.len * 0.9 + 0.1)); });
    wing(p, m, bx, by, '#c8b8f0', 90, '#5a4a8a');
  }
  for (const [u, s] of [[10, 1], [12.5, 1], [10, -1], [12.5, -1]] as Pt[]) leg(p, [f.at(u, s * 2.5), f.at(u - 1, s * 5), f.at(u - 2.5, s * 5.6)], RP.iron, 0.55);
  // striped abdomen: teal, violet and gold bands
  const ab = p.ball(...f.at(5.4, 0), 5.6, 3.6, RP.teal, { ang, spec: 0.9 });
  p.fill(ab, (x, y) => { const [u] = f.loc(x, y); const b = Math.floor((u + 0.5) / 1.8) % 3; const base = b === 0 ? RP.teal : b === 1 ? RP.violet : RP.yellow; return mix(p.get(x, y), base[clamp(RP.teal.indexOf(p.get(x, y)), 1, 4)], 0.75); });
  p.ball(...f.at(11.6, 0), 2.6, 2.4, RP.violet, { ang, spec: 0.88, lift: 0.4 });
  p.ball(...f.at(15.4, 0), 2.2, 2.5, RP.teal, { ang, spec: 0.88, lift: 0.4 });
  const [hx, hy] = f.at(15.8, 1.4); p.px(hx, hy, H('#fff4c0'));
  const [sx, sy] = f.at(0, 0); p.px(sx, sy, RP.yellow[2]);
  feeler(p, [f.at(17, 0.8), f.at(18.5, 2.5), f.at(19.5, 4)].map(([x, y]) => [Math.round(x), Math.round(y)] as Pt), RP.iron[3]);
});

// ------------------------------------------------------------------ fur tuft (1x1): brown fur snagged on a thorn twig
art('furtuft', fp(1, 1), p => {
  p.tube([[2, 20], [21, 5]], 1.1, RP.bark, { lift: 0.3 });
  for (const [x, y, dx, dy] of [[7, 15.5, -1, -3], [14, 10, 1, 3], [17, 7.5, -1, -3]] as number[][]) p.tube([[x, y], [x + dx, y + dy]], t => 0.8 - t * 0.6, RP.bark, { lift: 0.2 });
  const F = rp('#22110a', '#432213', '#6a3a1e', '#94562c', '#ba7c44', '#e0b07c');
  // the tuft: many fine curved hairs bunched where they caught
  for (let i = 0; i < 46; i++) {
    const a = -0.6 + hash(i, 1, 3) * 1.9, l = 4 + hash(i, 2, 3) * 6.5;
    const x0 = 11 + (hash(i, 3, 3) - 0.5) * 3, y0 = 12 + (hash(i, 4, 3) - 0.5) * 2;
    const tone_ = clamp(Math.round(2 + hash(i, 5, 3) * 3 - (a > 0.6 ? 1 : 0)), 1, 5);
    for (let k = 0; k < l; k++) { const t = k / l; p.px(x0 + Math.cos(a) * k + Math.sin(t * 3) * 0.8, y0 + Math.sin(a) * k + t * t * 3, F[k > l - 1.5 ? Math.min(5, tone_ + 1) : tone_]); }
  }
});

// ------------------------------------------------------------------ barred feather (1x3): a long, stiff primary, barred brown and white
art('feather', fp(1, 3), p => {
  const pts = bez([12, 70], [10, 36], [14, 3], 40);
  const c = curve(pts);
  const Br = rp('#1e120a', '#3a2414', '#5e3c20', '#86582e', '#ae7a44', '#d8a868');
  const Wh = rp('#5a5248', '#8a8072', '#b4ac9c', '#d8d2c4', '#f0ece2', '#ffffff');
  // asymmetric vane: narrow leading edge (left), broad trailing edge (right)
  const vane = p.maskFn((x, y) => { const q = c.loc(x, y); if (q.t < 0.2 || q.t > 1) return false; const tt = (q.t - 0.2) / 0.8; const w = (q.v < 0 ? 3.2 : 6.6) * Math.sin(Math.PI * Math.min(1, tt * 0.96 + 0.04)) ** 0.45; return Math.abs(q.v) <= w; });
  p.lit(vane, Br, (x, y) => { const q = c.loc(x, y); return 0.6 - q.v * 0.03 + Math.sin(q.u * 1.2 - q.v * 0.9) * 0.08; }, 0.4);
  // white bars sweeping across the vane, barbs as fine slanted lines, a split or two
  p.fill(vane, (x, y) => { const q = c.loc(x, y); const bar = ((q.u + Math.abs(q.v) * 0.9) % 7.5) < 3.2; if (!bar) return -1; return p.tn(Wh, 0.62 - q.v * 0.03, x, y, 0.4); });
  p.fill(vane, (x, y) => { const q = c.loc(x, y); return ((q.u * 1.5 + Math.abs(q.v) * 1.4) % 2) < 0.5 ? tone(p.get(x, y), -0.12) : -1; });
  for (const [u, side] of [[30, 1], [48, -1]] as Pt[]) for (let v = 1; v < 6; v++) { const q = c.at(u / c.len); const x = Math.round(q.x - q.ty * v * side), y = Math.round(q.y + q.tx * v * side + v * 0.6); if (p.at(vane, x, y)) p.px(x, y, 0); }
  // downy afterfeather at the base, and the white rachis / quill
  for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + (hash(i, 1, 9) - 0.5) * 2.4, l = 2 + hash(i, 2, 9) * 4; const q = c.at(0.19 + hash(i, 3, 9) * 0.05); for (let k = 0; k < l; k++) p.blend(q.x + Math.cos(a) * k, q.y - Math.sin(a) * k * 0.4 + k * 0.4, H('#e8e0d0', 200 - k * 30)); }
  p.tube(pts.slice(0, 41), t => 0.9 - t * 0.5, rp('#6a6050', '#9a9080', '#c4bcaa', '#e4dece', '#f8f6ee', '#ffffff'), { spec: 0.9, lift: 0.4 });
});

// ------------------------------------------------------------------ shed scale (1x1): a keeled serpent scale, rough on one side
art('scale', fp(1, 1), p => {
  const S = rp('#1e1c0e', '#3a3618', '#5c5626', '#827a3a', '#aaa258', '#e0dc9a');
  const m = p.maskFn((x, y) => { const dx = x + 0.5 - 12, dy = y + 0.5 - 12.5; const u = dy / 9.5, v = dx / (6.4 * (1 - Math.max(0, -u) * 0.55)); return u * u + v * v <= 1; });
  p.relief(m, S, (x, y) => { if (!p.at(m, x, y)) return 0; const dx = x + 0.5 - 12; return 3 - Math.abs(dx) * 0.7 + (hash(x, y, 4) > 0.8 ? -0.4 : 0); }, { spec: 0.95, lift: 0.3 });
  // the keel ridge and a translucent, paler rim
  p.fill(m, (x, y) => (Math.abs(x + 0.5 - 12) < 0.6 && y > 5 && y < 20 ? S[5] : -1));
  p.fill(m, (x, y) => (!p.at(m, x - 1, y) || !p.at(m, x + 1, y) || !p.at(m, x, y + 1) ? S[4] : -1));
  p.glint(9, 8, H('#fffff0'), 0.3);
});

// ------------------------------------------------------------------ shed skin (3x1): a whole papery serpent skin, four little limb sheaths
art('shedskin', fp(3, 1), p => {
  const Sk = rp('#5a5040', '#8a7e64', '#b6aa8a', '#d8ceae', '#f0e8d0', '#fffcf0');
  const pts: Pt[] = [];
  for (let i = 0; i <= 50; i++) { const x = 4 + i * 1.32; pts.push([x, 12 + Math.sin(i * 0.2) * 5.4]); }
  const c = curve(pts);
  const w = (t: number) => (t < 0.08 ? 2.2 + t * 30 : 4.6 * (1 - t) ** 0.5 + 0.4);
  const m = p.band(c, w);
  // translucent paper: the diamond scale grid, wrinkles, light showing through
  p.lit(m, Sk, (x, y) => { const q = c.loc(x, y); const k = q.v / w(clamp(q.t, 0, 1)); return 0.62 - k * 0.22 + (noise2(q.u * 0.3, q.v * 0.6, 3) - 0.5) * 0.25; }, 0.5);
  p.fill(m, (x, y) => { const q = c.loc(x, y); const a = ((q.u + q.v * 1.6) % 3 + 3) % 3, b = ((q.u - q.v * 1.6) % 3 + 3) % 3; return a < 0.5 || b < 0.5 ? tone(p.get(x, y), -0.2) : -1; });
  p.fill(m, (x, y) => (!p.at(m, x, y - 1) ? H('#fffcf0', 255) : -1));
  // eye caps at the head end, and the four limb sheaths
  const h = c.at(0.02);
  p.px(Math.round(h.x + 1), Math.round(h.y - 1), H('#c8d8e0')); p.px(Math.round(h.x + 1), Math.round(h.y + 1), H('#c8d8e0'));
  for (const [t, s] of [[0.2, 1], [0.24, -1], [0.6, 1], [0.64, -1]] as Pt[]) {
    const q = c.at(t), ww = w(t);
    const x0 = q.x - q.ty * ww * s, y0 = q.y + q.tx * ww * s;
    p.tube([[x0, y0], [x0 - 1.5, y0 + s * 3]], t2 => 1.1 - t2 * 0.5, Sk, { lift: 0.3 });
  }
});

// ------------------------------------------------------------------ droppings (1x1): scat studded with serpent scales and a broken fang
art('dropping', fp(1, 1), p => {
  const Pu = rp('#140c08', '#281a10', '#40301c', '#5c4628', '#7a6038', '#b09068');
  const pts = bez([4, 17], [11, 21], [19.5, 15], 14);
  const m = p.tube(pts, t => 3.4 - Math.abs(t - 0.45) * 2.2, Pu, { spec: 0.96, lift: 0.2, tex: (x, y) => (noise2(x * 0.6, y * 0.6, 5) > 0.62 ? -0.5 : 0) });
  const m2 = p.tube(bez([12, 15], [15, 9.5], [9.5, 8.5], 10), t => 2.8 - t * 1.6, Pu, { spec: 0.96, lift: 0.4 });
  // glinting scale fragments and the fang
  for (const [x, y] of [[8, 17], [14, 16], [11, 12], [16, 18]] as Pt[]) { p.px(x, y, H('#c8c49a')); p.px(x + 1, y, H('#8a8660')); }
  p.tube([[13, 12], [17, 6]], t => 0.9 - t * 0.6, RP.bone, { spec: 0.9, lift: 0.5 });
  p.drop(m2, -0.3, 0, 1);
  void m;
});

// ------------------------------------------------------------------ banded quill (1x2): a barbed quill banded black and cream
art('quill', fp(1, 2), p => {
  const f = frame(10, 46, 14, 2);
  const Bk = rp('#0a0a0e', '#16161c', '#24242c', '#363640', '#4e4e5a', '#9a9aaa');
  const Cr = rp('#5a5244', '#8a8270', '#b6ae98', '#dcd6c0', '#f2eedc', '#ffffff');
  const m = p.tube([f.at(0, 0), f.at(f.len, 0)], u => (u < 0.08 ? 1.2 + u * 6 : 1.7 * (1 - u) ** 0.6 + 0.3), Cr, { spec: 0.9, lift: 0.3 });
  p.fill(m, (x, y) => {
    const [u, v] = f.loc(x, y);
    const band = Math.floor(u / 5.2) % 2 === 1 && u > 6 && u < f.len - 6;
    if (!band) return -1;
    return Bk[clamp(Math.round(2.5 - v * 0.9 + (v < -0.4 ? 1 : 0)), 0, 4)];
  });
  // backward barbs near the tip
  for (const u of [f.len - 3, f.len - 5, f.len - 7]) { const [x, y] = f.at(u, 1.6); p.px(x, y, Cr[2]); const [x2, y2] = f.at(u - 0.8, -1.6); p.px(x2, y2, Cr[3]); }
});

// ------------------------------------------------------------------ serpent vertebra (2x1): the size of a fist, with crushing marks
art('bone', fp(2, 1), p => {
  const Bn = RP.bone;
  const porous = (x: number, y: number) => (hash(x, y, 7) > 0.86 ? -0.7 : noise2(x * 0.4, y * 0.4, 3) > 0.62 ? -0.3 : 0);
  // transverse processes (wings), neural spine, and the round centrum facing us
  const wings = p.maskPoly([5, 15, 14, 9, 24, 11, 34, 9, 43, 15, 41, 18, 30, 15.5, 18, 15.5, 7, 18]);
  p.relief(wings, Bn, p.dome(wings, 2.5), { tex: porous, lift: 0.1 });
  const spine = p.maskPoly([20, 11, 22, 2, 26, 2, 28, 11]);
  p.relief(spine, Bn, p.dome(spine, 2), { tex: porous, lift: 0.3 });
  p.fill(p.maskEllipse(24, 8, 2.6, 1.6), Bn[0]);
  const cen = p.maskEllipse(24, 15.5, 7.2, 6.4);
  p.relief(cen, Bn, p.dome(cen, 4), { tex: porous, lift: 0.2 });
  // the articular cup and growth rings on the face, crushing cracks
  p.fill(Pen.and(cen, p.maskEllipse(24, 15.5, 4.4, 3.8)), (x, y) => { const d = Math.hypot((x + 0.5 - 24) / 4.4, (y + 0.5 - 15.5) / 3.8); return d < 0.5 ? Bn[1] : Math.abs(d - 0.8) < 0.1 ? Bn[2] : -1; });
  for (const [a, b] of [[[30, 10], [33, 14]], [[16, 11], [13, 14]], [[26, 19], [28, 21]]] as Pt[][]) p.line(a[0], a[1], b[0], b[1], Bn[0]);
});

// ------------------------------------------------------------------ eggshell (1x1): gold-speckled fragments, one showing its pale inside
art('eggshell', fp(1, 1), p => {
  const E = rp('#5a4a2e', '#8a7650', '#b8a47a', '#dccca2', '#f2e8cc', '#fffcf2');
  const shard = (pts: number[], inside: boolean, lift: number) => {
    const m = p.maskPoly(pts);
    p.relief(m, E, p.dome(m, 3), { spec: 0.97, lift: inside ? lift + 0.6 : lift });
    if (!inside) p.fill(m, (x, y) => (hash(x, y, 5) > 0.82 ? (hash(x, y, 6) > 0.5 ? RP.amber[3] : RP.amber[2]) : -1));
    else p.fill(m, (x, y) => (!p.at(m, x, y - 1) || !p.at(m, x - 1, y) ? E[2] : -1));
    p.drop(m, -0.3, 1, 1);
  };
  shard([3, 10, 7, 5, 11, 6, 13, 3, 15, 8, 12, 13, 6, 14], false, 0.2);
  shard([10, 13, 16, 9, 21, 12, 20, 17, 17, 21, 12, 19], true, 0.1);
  shard([3, 17, 8, 15, 10, 19, 6, 22, 3, 21], false, 0);
});

// ------------------------------------------------------------------ armour plate (1x1): a bony osteoderm, fang marks skidding off it
art('plate', fp(1, 1), p => {
  const P = rp('#3a3226', '#64584a', '#8e8270', '#b8ac96', '#ddd2bc', '#fffaec');
  const m = p.lump(12, 12.5, 9.6, 8, 31, 0.07, 0.25);
  p.relief(m, P, (x, y) => (p.at(m, x, y) ? p.dome(m, 4)(x, y) + (Math.abs((x - 12) - (y - 12.5) * 0.5) < 1 ? 1 : 0) : 0), { tex: (x, y) => (hash(x, y, 31) > 0.84 ? -0.8 : 0), lift: 0.2 });
  // the fang grooves: two skids that failed to pierce it
  for (const [a, b] of [[[6, 9], [11, 13]], [[13, 7], [18, 11]]] as Pt[][]) { p.line(a[0], a[1], b[0], b[1], P[0]); p.line(a[0], a[1] + 1, b[0], b[1] + 1, P[4]); }
});

// ------------------------------------------------------------------ colony down (1x1): a wisp of grey down, all fluff
art('v10_down', fp(1, 1), p => {
  const D = ['#6a6e74', '#8a8e94', '#aeb2b6', '#d0d2d4', '#eeeeee'];
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 1, 4) * Math.PI * 2, l = 2 + hash(i, 2, 4) * 7;
    const cx = 12 + (hash(i, 3, 4) - 0.5) * 3, cy = 12 + (hash(i, 4, 4) - 0.5) * 3;
    const lit = Math.cos(a + 2.4);
    for (let k = 1; k < l; k++) p.blend(cx + Math.cos(a) * k, cy + Math.sin(a) * k + Math.sin(k * 0.8 + i) * 0.6, H(D[clamp(Math.round(2.5 + lit * 1.5), 0, 4)], k > l - 2 ? 150 : 240));
  }
  p.ball(12, 12.4, 1.6, 1.6, rp('#3a3c40', '#5a5c62', '#7a7e84', '#9a9ea4', '#c0c4c8', '#ffffff'));
}, { ol: 0.35, rim: 0 });

// ------------------------------------------------------------------ coral fragment (1x2): a broken branching twig, pink at the tips
art('v10_coral', fp(1, 2), p => {
  const Co = rp('#5a4a48', '#8a7a74', '#b8aaa0', '#ddd2c8', '#f4ece4', '#ffffff');
  const Pk = RP.coral;
  const br = (pts: Pt[], r0: number) => {
    const c = curve(pts);
    const m = p.tube(pts, t => r0 * (1 - t * 0.45), Co, { lift: 0.2, tex: (x, y) => (hash(x, y, 9) > 0.8 ? -0.6 : 0) });
    p.fill(m, (x, y) => { const t = c.loc(x, y).t; return t > 0.72 ? mix(p.get(x, y), Pk[clamp(Math.round(2 + (1 - t) * 2), 1, 4)], 0.8) : -1; });
    p.fill(m, (x, y) => (hash(x, y, 10) > 0.88 ? tone(p.get(x, y), -0.35) : -1));
    return c;
  };
  br([[12, 46], [11.5, 36], [12.5, 24], [11, 12], [12, 3]], 2.6);
  br([[12, 34], [16.5, 27], [19.5, 18]], 1.9);
  br([[12, 28], [6.5, 21], [5, 12]], 1.8);
  br([[12, 18], [16, 12], [16.6, 6]], 1.4);
  br([[6.5, 21], [3, 17], [2.6, 14]], 1.1);
  // the broken white base
  p.ball(12, 45.6, 3, 1.6, Co, { lift: 0.5 });
});
