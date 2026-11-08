// V12 item art: Big Hank's weapon belt (src/game/v12/arsenal.ts). Hand-painted with the item pen
// (src/art/v11/items/kit.ts): every form shaded from its own height field, textured (leather netting,
// moulded plastic, brushed steel, oiled walnut, paper wraps), outlined and shadowed by the shared pass.
//
//   w_bolas    (1x1) three stones in leather netting on braided flax cord, a tasselled knot
//   w_flare    (1x1) a blaze-orange marine flare pistol, fat barrel, a white warning decal
//   w_bangers  (1x1) a string of fat red firecrackers braided on a fuse, the fuse lit
//   w_netgun   (2x1) the net launcher: an olive canister on a pistol grip, the net folded in its mouth
//   w_tranq    (2x1) the dart rifle: walnut stock, blued receiver, a little scope, darts in a loop
//   w_spray    (1x1) bear spray: a black can, a hi-vis label with claw marks, the orange trigger cap

import { artGroup, fp, IP, RP, H, rp, hash, noise2, bez, clamp } from '../v11/items/kit';
import type { Pt, Mask } from '../v11/items/kit';

const art = artGroup('Hank’s wares');

const ORANGE = rp('#3a1404', '#6e2608', '#a8400c', '#e06414', '#f89a3a', '#ffe0a8');
const OLIVE = rp('#121408', '#252a12', '#3c4420', '#56622e', '#7a8644', '#c8d08a');
const BLUED = rp('#07090e', '#121822', '#1e2a38', '#2e4054', '#4a6278', '#c4dcec');
const WALNUT = rp('#1a0c06', '#38180a', '#5a2c12', '#7e4620', '#a46636', '#e4b07a');
const CRACKER = rp('#2a0404', '#5a0a08', '#94160e', '#cc2a1a', '#ee5a3a', '#ffc0a0');
const GOLDP = rp('#3a2804', '#6a4c0c', '#a07a18', '#d4ac30', '#f2d860', '#fff8c0');
const LEATHER = rp('#1c0e06', '#38200e', '#5a361a', '#7e5028', '#a2703c', '#e0b080');
const CAN = rp('#060608', '#101014', '#1c1c24', '#2c2c38', '#44445a', '#a8a8c4');
const HIVIS = rp('#4a3a04', '#8a6e06', '#c8a40c', '#f0cc18', '#fae860', '#ffffd8');

/** leather netting over a stone: a diamond lattice of dark thongs */
const netTex = (cx: number, cy: number) => (x: number, y: number) => {
  const u = x - cx + y - cy, v = x - cx - (y - cy);
  return (((u % 4) + 4) % 4 === 0 || ((v % 4) + 4) % 4 === 0) ? -1.4 : 0;
};

// ------------------------------------------------------------------ bolas (1x1)
art('w_bolas', fp(1, 1), p => {
  const knot: Pt = [12, 6];
  const stones: [number, number, number, number][] = [[5.5, 17.5, 3.9, 3.5], [18.8, 15.2, 3.6, 3.3], [13.4, 21, 3.3, 2.6]];
  // the cords first (behind the stones): braided flax, slack curves
  const cords: Pt[][] = [bez(knot, [6, 9], stones[0].slice(0, 2) as Pt, 10), bez(knot, [17, 9], stones[1].slice(0, 2) as Pt, 10), bez(knot, [13.5, 14], stones[2].slice(0, 2) as Pt, 10)];
  for (const c of cords) p.tube(c, 0.75, RP.flaxDry, { lift: 0.4, spec: 1, tex: (x, y) => (((x + y) & 1) ? -0.7 : 0.2) });
  // the stones: river stones in leather netting, each a different lump
  stones.forEach(([x, y, rx, ry], i) => {
    const m = p.lump(x, y, rx, ry, 7 + i * 5, 0.12, i * 0.7);
    p.relief(m, RP.stone, p.dome(m, 2.6), { spec: 0.95, lift: 0.25, dither: 0.3, tex: (px, py) => netTex(x, y)(px, py) * 0.6 + (hash(px, py, i) > 0.9 ? 0.3 : 0) });
    p.recolor(m, (c, px, py) => (netTex(x, y)(px, py) < 0 ? (py < y ? LEATHER[3] : LEATHER[1]) : c));
    // the leather cap where the cord ties on
    const cap = p.maskEllipse(x + (12 - x) * 0.25, y - ry + 0.6, 1.6, 1.1);
    p.lit(cap, LEATHER, () => 0.65, 0.4);
  });
  // the knot and a short tassel
  p.ball(knot[0], knot[1], 2, 1.7, RP.flaxDry, { lift: 0.6, tex: (x, y) => (((x * 3 + y) & 3) === 0 ? -0.8 : 0) });
  for (let i = 0; i < 3; i++) p.tube(bez([12, 4.6], [11 + i, 2.6], [10 + i * 1.5, 1.4], 5), 0.4, RP.flaxDry, { lift: 0.8 });
  p.glint(4, 15, H('#ffffff'), 0.3);
  p.glint(17, 13, H('#f4f0e8'), 0.2);
});

// ------------------------------------------------------------------ flare pistol (1x1)
art('w_flare', fp(1, 1), p => {
  // the fat barrel, muzzle to the right, a moulded seam along it
  const barrel = p.tube([[5.5, 8.5], [21, 8.5]], 3.4, ORANGE, { lift: 0.35, spec: 0.94, cap: 'flat', tex: (x, y) => (hash(x, y, 3) > 0.92 ? -0.4 : 0) });
  for (let x = 6; x <= 20; x++) if (p.has(x, 8)) p.px(x, 8, mix2(p.get(x, 8), ORANGE[4]));
  // the muzzle: a black bore in a raised ring
  const ring = p.maskEllipse(21.2, 8.5, 1.6, 3.4);
  p.lit(ring, ORANGE, (x, y) => 0.75 - (y - 6) * 0.08, 0.4);
  p.px(21, 7, RP.iron[0]); p.px(21, 8, RP.iron[0]); p.px(21, 9, RP.iron[1]); p.px(22, 8, RP.iron[1]);
  // the hinge, the hammer cocked back, a white warning decal
  p.ball(8.5, 11, 1.3, 1.3, RP.chrome, { lift: 0.5 });
  p.tube(bez([5.5, 7], [3.6, 5.6], [2.6, 5.8], 6), 1.0, RP.iron, { lift: 0.4 });
  const decal = p.maskBox(12, 6, 6, 3);
  p.lit(decal, RP.paper ?? rp('#4e4636', '#7a705a', '#a89e84', '#cec6aa', '#ebe4cc', '#fffcf0'), () => 0.85, 0.2);
  for (let x = 13; x <= 16; x++) p.px(x, 7, (x & 1) ? H('#c82a1a') : H('#2a1a14'));
  // the grip, raked back, with finger grooves; the trigger guard and the trigger
  const grip = p.tube([[9.5, 11.5], [7.6, 17], [5.6, 21.5]], t => 3.1 + t * 0.4, ORANGE, { lift: 0.1, spec: 0.97, cap: 'round', tex: (x, y) => (((y + x) % 3) === 0 && x < 8 ? -0.6 : 0) });
  void grip;
  const guard: Pt[] = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.05 + (i / 12) * 0.95); guard.push([13 + Math.cos(a) * 3.2, 12 + Math.sin(a) * 3.2]); }
  p.tube(guard, 0.65, RP.iron, { lift: 0.5 });
  p.tube([[12.5, 11.8], [12, 13.8]], 0.7, RP.iron, { lift: 0.8 });
  p.glint(9, 6, H('#fff2d0'), 0.4);
  void barrel;
});
/** a highlight blend that stays on the ramp */
function mix2(a: number, b: number) { return hash(a & 255, b & 255) > 0.5 ? b : a; }

// ------------------------------------------------------------------ bear bangers (1x1)
art('w_bangers', fp(1, 1), p => {
  const fuse = bez([3, 3], [10, 9], [21, 21], 20);
  p.tube(fuse, 0.6, rp('#2a1a0a', '#4a3216', '#6e5028', '#96743e', '#bc9a58', '#e8d090'), { lift: 0.4 });
  // crackers on alternate sides of the braid, each a red paper tube with a gold band and a twisted end
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = 0.24 + (i / (n - 1)) * 0.7;
    const q = fuse[Math.round(t * (fuse.length - 1))];
    const s = i % 2 ? 1 : -1;
    // perpendicular to the braid (it runs down-right)
    const dx = s * 0.72, dy = -s * 0.7;
    const a: Pt = [q[0] + dx * 0.6, q[1] + dy * 0.6], b: Pt = [q[0] + dx * 5.6, q[1] + dy * 5.6];
    p.tube([a, b], 1.75, CRACKER, { lift: 0.35, spec: 0.93, cap: 'flat', tex: (x, y) => (hash(x, y, i) > 0.9 ? -0.4 : 0) });
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    p.px(Math.round(mid[0]), Math.round(mid[1]), GOLDP[4]);
    p.px(Math.round(mid[0] + 0.7 * s), Math.round(mid[1] - 0.7 * s), GOLDP[2]);
    p.px(Math.round(b[0] + dx * 0.9), Math.round(b[1] + dy * 0.9), CRACKER[1]);
  }
  // the lit end: a spark and a curl of smoke on the emissive layer
  p.spark(3, 3, '#fff6c0', true);
  p.steam(4, 2, 4, '#e8e4dc', 110, -1);
  p.glint(12, 9, H('#ffd8c8'), 0.3);
});

// ------------------------------------------------------------------ net launcher (2x1)
art('w_netgun', fp(2, 1), p => {
  // the shoulder pad (black rubber) and the canister: an olive tube with two raised ribs
  const pad = p.lump(5, 10.5, 3.4, 4.6, 9, 0.06);
  p.relief(pad, RP.rubber, p.dome(pad, 2), { lift: 0.3, tex: (x, y) => ((y & 1) ? -0.3 : 0) });
  p.tube([[7, 10.5], [13, 10.5]], 1.6, BLUED, { lift: 0.3 });
  p.tube([[12, 10], [40, 10]], 5.2, OLIVE, { lift: 0.25, spec: 0.95, cap: 'flat', tex: (x, y) => (hash(x >> 1, y, 5) > 0.88 ? -0.3 : 0) });
  for (const x of [17, 27]) { const r = p.tube([[x, 4.6], [x, 15.4]], 0.9, OLIVE, { lift: 0.6 }); void r; }
  // a stencilled yellow band and the safety label
  for (let y = 6; y <= 14; y++) for (const x of [33, 34]) if (p.has(x, y)) p.px(x, y, y < 9 ? HIVIS[4] : HIVIS[2]);
  for (const [x, y] of [[21, 8], [22, 8], [23, 8], [21, 10], [23, 10], [22, 9]] as Pt[]) p.px(x, y, H('#e8e4c4'));
  // the mouth: a steel cup with the folded net bulging out and four weight lugs
  const cup = p.maskEllipse(41.5, 10, 2.6, 5.8);
  p.lit(cup, RP.steel ?? BLUED, (x, y) => 0.7 - (y - 5) * 0.05, 0.4);
  const netM = p.maskEllipse(43.4, 10, 2.4, 4.6);
  p.fill(netM, (x, y) => ((x + y) & 1 ? H('#e4dcb0') : (x - y) % 3 === 0 ? H('#8a845e') : H('#c8c094')));
  for (const y of [5, 8, 12, 15]) p.ball(44.5, y, 1.1, 1.1, RP.iron, { lift: 0.6 });
  // the pistol grip and the fore grip, the trigger in its guard, a CO2 bottle under the tube
  p.tube([[20, 15], [18.6, 21.8]], 2.2, RP.rubber, { lift: 0.2, cap: 'round', tex: (x, y) => (((y) % 2) === 0 ? -0.4 : 0) });
  p.tube([[33, 15], [33.4, 20.6]], 1.8, RP.rubber, { lift: 0.3, cap: 'round' });
  p.tube([[23, 16.8], [30, 16.8]], 1.5, RP.chrome, { lift: 0.5, cap: 'round' });
  p.tube([[22.6, 15], [23.6, 17.6]], 0.55, RP.iron, { lift: 0.8 });
  p.glint(15, 6, H('#f0f4d0'), 0.4);
  p.glint(29, 6, H('#e8eec0'), 0.3);
});

// ------------------------------------------------------------------ tranquilliser rifle (2x1)
art('w_tranq', fp(2, 1), p => {
  // the walnut stock: a hand-shaped slab, the grain running along it
  const stock = p.maskPoly([1, 11, 4, 9, 15, 10, 19, 11, 19, 14, 14, 15, 10, 18, 3, 18, 1, 16]);
  p.relief(stock, WALNUT, p.dome(stock, 2.4), { lift: 0.2, spec: 0.94, tex: (x, y) => (noise2(x * 0.3, y * 1.6, 3) > 0.62 ? -0.45 : 0) });
  // the butt plate
  for (let y = 10; y <= 17; y++) if (p.has(1, y) || p.has(2, y)) { p.px(1, y, RP.rubber[1]); p.px(2, y, RP.rubber[2]); }
  // the receiver, the long barrel and its tube magazine under it, the muzzle
  p.tube([[17, 11.6], [27, 11.6]], 2.1, BLUED, { lift: 0.3, spec: 0.93, cap: 'flat' });
  p.tube([[26, 11], [46, 11]], 1.05, BLUED, { lift: 0.45, spec: 0.92, cap: 'flat' });
  p.tube([[27, 13], [40, 13]], 0.8, BLUED, { lift: 0.2, cap: 'round' });
  p.ball(46.2, 11, 1.2, 1.4, BLUED, { lift: 0.5 });
  // the scope on its rings, lens glints at both ends
  p.tube([[18.5, 7], [30, 7]], 1.6, BLUED, { lift: 0.4, spec: 0.9, cap: 'flat' });
  p.tube([[18, 7], [19.6, 7]], 2.1, BLUED, { lift: 0.2, cap: 'flat' });
  p.tube([[28.6, 7], [30.6, 7]], 2.3, BLUED, { lift: 0.2, cap: 'flat' });
  for (const x of [21, 27]) p.rect(x, 9, 1, 1, BLUED[1]);
  p.px(31, 6, H('#9ae0ff')); p.px(31, 7, H('#3a8ac0')); p.px(17, 7, H('#5ab0e0'));
  // the bolt handle and its knob, the trigger guard
  p.tube([[22, 12.4], [23.6, 15]], 0.5, RP.chrome, { lift: 0.8 });
  p.ball(23.8, 15.4, 0.9, 0.9, RP.chrome, { lift: 0.8 });
  const guard: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.1 + (i / 10) * 0.9); guard.push([18.6 + Math.cos(a) * 2.4, 14 + Math.sin(a) * 2.2]); }
  p.tube(guard, 0.5, BLUED, { lift: 0.5 });
  // a leather loop on the stock holding three darts, yellow tufts up
  const loop = p.maskBox(7, 12, 5, 3, 1);
  p.lit(loop, LEATHER, (x, y) => 0.7 - (y - 12) * 0.12, 0.4);
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 1.6;
    p.tube([[x, 15.6], [x - 0.3, 9.4]], 0.45, RP.chrome, { lift: 0.7 });
    p.ball(x - 0.4, 9, 0.9, 1.1, GOLDP, { lift: 0.6 });
  }
  p.glint(9, 13, H('#ffe8c8'), 0.3);
  p.glint(36, 10, H('#d0e8ff'), 0);
});

// ------------------------------------------------------------------ bear spray (1x1)
art('w_spray', fp(1, 1), p => {
  // the can, standing a little tilted: black, a hi-vis label, a pressed-steel foot
  const ang = -0.12;
  const c = (t: number): Pt => [12 + Math.sin(ang) * (t - 14) * -1, t];
  const body = p.tube([c(8.6), c(21.6)], 5.4, CAN, { lift: 0.3, spec: 0.92, cap: 'flat' });
  const lab = p.maskFn((x, y) => p.at(body, x, y) && y >= 12 && y <= 18);
  p.lit(lab, HIVIS, x => clamp(0.85 - Math.abs(x - 10.5) * 0.08, 0, 1), 0.5);
  // claw marks across the label
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { const x = 9 + i * 2 + k * 0.5, y = 13 + k; if (p.at(lab, Math.round(x), y)) p.px(Math.round(x), y, H('#3a2408')); }
  for (let x = 6; x <= 18; x++) { if (p.at(body, x, 21)) p.px(x, 21, CAN[4]); }
  // the shoulder, the orange trigger cap with its white safety clip and nozzle
  p.ball(c(8)[0], 8.2, 4.8, 2, CAN, { lift: 0.5 });
  const cap = p.maskPoly([8, 7, 9, 3, 14, 2, 16, 4, 16, 7]);
  p.relief(cap, ORANGE, p.dome(cap, 1.6), { lift: 0.3, spec: 0.94 });
  p.tube([[16, 3.6], [19.4, 3.4]], 0.7, RP.iron, { lift: 0.5, cap: 'flat' });
  p.tube([[9.4, 6.2], [15.6, 5.2]], 0.55, rp('#5a5a5a', '#8a8a8a', '#b8b8b8', '#dedede', '#f4f4f4', '#ffffff'), { lift: 1 });
  p.glint(8, 11, H('#c8c8e8'), 0);
  p.glint(10, 3, H('#fff0d0'), 0.4);
});

void (null as unknown as Mask);
void IP;
