// V11 item art: food. Ship biscuit, Lou's stew, kawakawa tea, the island's emberberries, duskberries and
// goldcurrants, the village's rēwena bread, roasted kūmara and tea flask, and a fresh fish off the Kitten.
// The lures (bait you set out for animals) are here too.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, curve, ring, glassLens, stoneTex, leafBlade, noise2, fbm2, box3, lashing, rope } from './kit';
import type { Pt, Ramp, Mask } from './kit';

const art = artGroup('Food');
const lure = artGroup('Lures');

/** a glossy berry with a tiny calyx star and a highlight */
function berry(p: IP, cx: number, cy: number, r: number, R: Ramp, o: { bloom?: boolean; lift?: number } = {}) {
  const m = p.ball(cx, cy, r, r * 0.95, R, { spec: o.bloom ? 1 : 0.9, lift: o.lift ?? 0.2 });
  if (o.bloom) p.fill(m, (x, y) => (hash(x, y, 3) > 0.6 && (x + y) % 2 ? tone(p.get(x, y), 0.3) : -1));
  p.px(Math.round(cx + r * 0.35), Math.round(cy + r * 0.3), R[0]);
  if (!o.bloom) p.px(Math.round(cx - r * 0.4), Math.round(cy - r * 0.45), H('#ffffff'));
  return m;
}

// ------------------------------------------------------------------ ship biscuit (1x1): a square of hardtack, docked with holes, hard as a brick
art('ration', fp(1, 1), p => {
  const Bs = rp('#4a2a10', '#7a4a1e', '#a8743a', '#d0a060', '#ecc88a', '#fff0c8');
  // a thick square tile seen from above: the docked top, a toasted edge below
  const top = p.maskPoly([2, 9, 15, 5, 22, 11, 9, 16]);
  const front = p.maskPoly([2, 9, 9, 16, 9, 20, 2, 13]);
  const side = p.maskPoly([9, 16, 22, 11, 22, 15, 9, 20]);
  p.lit(front, Bs, (x, y) => 0.5 + (noise2(x * 0.5, y * 0.5, 3) - 0.5) * 0.3, 0.4);
  p.lit(side, Bs, (x, y) => 0.3 + (noise2(x * 0.5, y * 0.5, 4) - 0.5) * 0.3, 0.4);
  p.lit(top, Bs, (x, y) => 0.72 + (noise2(x * 0.45, y * 0.45, 5) - 0.5) * 0.35 - (x + y - 20) * 0.006, 0.5);
  // the docking holes in a skewed grid, a crack, and crumbs
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const x = Math.round(6 + i * 4.2 + j * -1.6), y = Math.round(8.4 + i * -1.2 + j * 2.4); p.px(x, y, Bs[1]); p.px(x + 1, y, Bs[4]); }
  p.line(15, 6, 14, 10, Bs[2]);
  p.fill(top, (x, y) => (!p.at(top, x, y - 1) ? Bs[4] : -1));
  for (const [x, y] of [[20, 19], [3, 18], [22, 18]] as Pt[]) p.px(x, y, Bs[3]);
});

// ------------------------------------------------------------------ Lou's stew (1x1): a dented billy of something spicy, steaming
art('stew', fp(1, 1), p => {
  const T = RP.tin;
  // the billy can: a short cylinder with a wire handle
  const body = p.maskFn((x, y) => Math.abs(x + 0.5 - 12) <= 9 && y >= 9 && y <= 21 - (Math.abs(x + 0.5 - 12) > 7.5 ? 1 : 0));
  p.lit(body, T, (x, y) => p.cylV((x + 0.5 - 12) / 9) + (y > 19 ? -0.15 : 0) + (Math.abs(x - 15) < 1 && y > 12 && y < 16 ? -0.2 : 0), 0.5);
  p.fill(body, (x, y) => (y === 12 || y === 18 ? tone(p.get(x, y), -0.18) : -1));
  // the stew inside: rich red-brown with carrot, a green herb and a chunk of meat
  const top = p.maskEllipse(12, 9.4, 8.6, 2.8);
  p.fill(top, (x, y) => { const n = noise2(x * 0.6, y * 0.9, 4); return n > 0.7 ? RP.orange[4] : n < 0.25 ? RP.red[1] : RP.red[y < 9 ? 3 : 2]; });
  p.pts([[9, 9], [10, 9]], RP.lime[3]); p.pts([[15, 10], [16, 10]], RP.orange[5]); p.pts([[12, 8], [13, 8]], RP.bread[2]);
  ring(p, 12, 9.4, 8.6, 9.6, T, { ry: 0.33 });
  // the handle and a spoon in it
  p.tube(bez([3, 10], [12, -2], [21, 10], 16), 0.6, T, { lift: 0.4 });
  p.tube([[16, 9], [20, 2]], 0.8, RP.tin, { lift: 0.6 });
  p.ball(20.4, 2, 1.6, 1.2, RP.tin, { spec: 0.9 });
  p.steam(8, 6, 6, '#ffffff', 130);
  p.steam(12, 5, 7, '#ffffff', 110, -1);
});

// ------------------------------------------------------------------ kawakawa tea (1x1): a speckled enamel mug with a leaf floating
art('tea', fp(1, 1), p => {
  const E = RP.enamel;
  const body = p.maskFn((x, y) => Math.abs(x + 0.5 - 10.5) <= 7.2 && y >= 8 && y <= 21);
  p.lit(body, E, (x, y) => p.cylV((x + 0.5 - 10.5) / 7.2) + (hash(x, y, 5) > 0.9 ? 0.35 : 0), 0.5);
  p.fill(body, (x, y) => (y === 21 || (y === 8) ? H('#e8eef4') : -1));
  // the handle
  const hd = Pen.sub(p.maskEllipse(18.6, 14, 4, 4.4), p.maskEllipse(18.6, 14, 2, 2.4));
  p.fill(Pen.sub(hd, body), (x, y) => p.tn(E, 0.6 - (x - 17) * 0.06 - (y - 12) * 0.04, x, y, 0.4));
  // the tea: green-amber with a heart leaf floating
  const tea = p.maskEllipse(10.5, 8.6, 6.6, 2);
  p.fill(tea, (x, y) => (x < 8 ? H('#8a7a28') : H('#6a5e1a')));
  leafBlade(p, bez([8, 9], [10.5, 7], [13.5, 8.4], 6), t => 1.6 * Math.sin(Math.PI * Math.min(1, t + 0.05)) + 0.3, RP.leaf, { veins: 0, rib: null });
  ring(p, 10.5, 8.6, 6.6, 7.6, rp('#9aa8b8', '#b8c4d0', '#d0dae2', '#e4ecf0', '#f4f8fa', '#ffffff'), { ry: 0.32 });
  p.steam(9, 5, 5, '#ffffff', 120);
  p.steam(13, 4, 6, '#ffffff', 100, -1);
});

// ------------------------------------------------------------------ emberberries (1x1): glossy red, a bit fizzy
art('berry_ember', fp(1, 1), p => {
  leafBlade(p, bez([12, 6], [17, 2.4], [22, 4.4], 8), t => 2.2 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true });
  p.tube(bez([12, 6], [11, 10], [8, 12], 8), 0.5, RP.olive, { lift: 0.2 });
  p.tube(bez([12, 6], [14, 10], [16, 13], 8), 0.5, RP.olive, { lift: 0.2 });
  const R = rp('#2e0408', '#64080e', '#a8141a', '#de3424', '#ff7a4a', '#ffd0a8');
  for (const [x, y, r] of [[15.5, 15, 3.6], [8, 14, 3.4], [12, 18.5, 3.8], [5.5, 19, 2.8], [18.5, 19.5, 2.9]] as number[][]) berry(p, x, y, r, R);
  p.spark(20, 11, '#ffe8c0');
  p.spark(3, 11, '#ffe8c0');
});

// ------------------------------------------------------------------ duskberries (1x1): dusty purple, tasting of plum and pine
art('berry_dusk', fp(1, 1), p => {
  p.tube(bez([3, 4], [10, 6], [14, 12], 10), 0.6, RP.bark, { lift: 0.3 });
  leafBlade(p, bez([6, 5], [4, 1], [1.5, 1.4], 6), t => 1.6 * Math.sin(Math.PI * Math.min(1, t + 0.05)) + 0.3, RP.olive, { veins: 0 });
  const D = rp('#140a22', '#2a1442', '#462468', '#6a3c90', '#9a6ab8', '#d8c0ec');
  for (const [x, y, r] of [[14, 13, 3.6], [9, 16, 3.4], [16.5, 19, 3.2], [11, 20.5, 2.8], [19, 14.4, 2.6]] as number[][]) berry(p, x, y, r, D, { bloom: true });
});

// ------------------------------------------------------------------ goldcurrants (1x1): tiny golden berries hanging in three little strings
art('berry_gold', fp(1, 1), p => {
  const Gc = rp('#4a2a04', '#8a5808', '#c89012', '#f0c42c', '#fce678', '#fffbe0');
  p.tube(bez([2, 4], [12, 1.5], [22, 5], 12), 0.6, RP.bark, { lift: 0.3 });
  leafBlade(p, bez([9, 3], [13, -0.5], [18, 0.6], 6), t => 1.8 * Math.sin(Math.PI * Math.min(1, t + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true });
  // each string: a fine stalk, four berries alternating down it, each one round and lit, a dark gap below it
  const strings: [Pt, Pt, Pt][] = [[[6, 3.4], [3.6, 12], [5.5, 21]], [[12.5, 2.6], [14, 11], [12, 21.5]], [[19, 3.8], [21, 10], [18.5, 18]]];
  for (const [a, b, c] of strings) {
    const pts = bez(a, b, c, 12), cv = curve(pts);
    p.tube(pts, 0.4, RP.olive, { lift: 0.3 });
    for (let i = 0; i < 4; i++) {
      const t = 0.25 + i * 0.24, q = cv.at(t), s = i % 2 ? 1 : -1, r = 2.2 - i * 0.12;
      const m = p.ball(q.x + s * 1.2, q.y + 0.4, r, r, Gc, { spec: 0.86, lift: 0.3 });
      p.drop(m, -0.45, 0, 1);
      p.px(Math.round(q.x + s * 1.2 + 0.7), Math.round(q.y + 1), Gc[4]);
    }
  }
});

// ------------------------------------------------------------------ rēwena bread (2x1): a round loaf, cracked crust, the cut end soft and holey
art('vil_rewena', fp(2, 1), p => {
  const Br = RP.bread, Cr = RP.crumb;
  const loaf = p.maskFn((x, y) => { const dx = (x + 0.5 - 25) / 20.5, dy = (y + 0.5 - 13.6) / 9; return dx * dx + (dy < 0 ? dy * dy : dy * dy * 2.4) <= 1; });
  p.relief(loaf, Br, p.dome(loaf, 6), { spec: 1, lift: 0.2, tex: (x, y) => (noise2(x * 0.4, y * 0.5, 4) > 0.64 ? 0.4 : 0), dither: 0.4 });
  // the score cracks on top, pale and floury in the splits, a dusting of flour
  for (const [x0, x1] of [[13, 22], [26, 35]] as Pt[]) for (let x = x0; x <= x1; x++) { const y = Math.round(8 + Math.sin((x - x0) * 0.5) * 1.2); if (p.has(x, y)) { p.px(x, y, Cr[4]); p.px(x, y + 1, Br[1]); } }
  p.fill(loaf, (x, y) => (hash(x, y, 9) > 0.93 && y < 12 ? Cr[5] : -1));
  // the cut end at the left: soft crumb full of holes
  const cut = Pen.and(loaf, p.maskEllipse(6.6, 14, 3.4, 8.2));
  p.fill(cut, (x, y) => (hash(x, y, 2) > 0.78 ? Cr[1] : Cr[x < 6 ? 4 : 3]));
  p.steam(18, 4, 5, '#ffffff', 90);
  p.steam(30, 4, 4, '#ffffff', 80, -1);
});

// ------------------------------------------------------------------ roasted kūmara (2x1): charred purple skin split over orange flesh
art('vil_kumara', fp(2, 1), p => {
  const Sk = RP.kumara, Fl = RP.kumaraFlesh;
  const f = frame(4, 15, 44, 10);
  const w = (u: number) => 7.2 * Math.sin(Math.PI * Math.min(1, u / f.len)) ** 0.6 + 0.5;
  const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return u >= 0 && u <= f.len && Math.abs(v) <= w(u); });
  p.relief(m, Sk, (x, y) => { if (!p.at(m, x, y)) return 0; const [u, v] = f.loc(x, y); return Math.sqrt(Math.max(0, 1 - (v / w(u)) ** 2)) * 5; }, { spec: 0.97, lift: 0.2, tex: (x, y) => (noise2(x * 0.5, y * 0.5, 6) > 0.66 ? -0.8 : 0) });
  // the split: steaming orange flesh along the top
  const split = Pen.and(m, p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return v > -4.2 && v < -0.6 + Math.sin(u * 0.4) * 0.6 && u > 8 && u < f.len - 7; }));
  p.relief(split, Fl, p.dome(split, 2), { spec: 0.92, lift: 0.4 });
  p.fill(split, (x, y) => (!p.at(split, x, y - 1) ? Sk[1] : -1));
  // char spots and the root tails
  p.fill(m, (x, y) => (fbm2(x * 0.3, y * 0.3, 2, 9) > 0.68 && !p.at(split, x, y) ? H('#1a0c0a') : -1));
  p.tube([[44, 10], [47, 8.5]], 0.6, Sk, { lift: 0.2 });
  p.tube([[4, 15], [1.5, 17]], 0.6, Sk, { lift: 0.2 });
  p.steam(20, 6, 6, '#ffffff', 110);
  p.steam(28, 5, 5, '#ffffff', 90, -1);
});

// ------------------------------------------------------------------ kawakawa tea flask (1x2): a gourd with a wooden stopper and a flax carry cord
art('vil_tea', fp(1, 2), p => {
  const Gd = RP.gourd;
  const m = Pen.or(p.maskEllipse(12, 32, 9, 12.5), p.maskEllipse(12, 15, 5, 6.5), p.maskFn((x, y) => Math.abs(x + 0.5 - 12) <= 2.8 && y >= 6 && y <= 16));
  p.relief(m, Gd, p.dome(m, 5.5), { spec: 0.95, lift: 0.2, dither: 0.4 });
  // burnt-in pattern bands round the belly
  p.fill(m, (x, y) => { const d = y - 32 + Math.abs(x - 12) * 0.12; return Math.abs(d) < 0.6 || Math.abs(d - 3) < 0.4 ? Gd[1] : Math.abs(d - 1.5) < 0.6 && (x % 3 === 0) ? Gd[0] : -1; });
  // stopper, cord round the neck and the carry loop
  p.tube([[12, 6.5], [12, 2.5]], 2, RP.wood, { cap: 'flat', lift: 0.3 });
  p.ball(12, 2.6, 2, 1, RP.wood, { lift: 0.8 });
  for (let x = 8; x <= 16; x++) { p.px(x, 13, RP.flaxDry[x % 2 ? 2 : 4]); p.px(x, 14, RP.flaxDry[1]); }
  rope(p, bez([8.6, 13.6], [2, 9], [5, 3], 12), 0.7, RP.flaxDry, { lift: 0.3 });
  p.glint(7, 27, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ fresh fish (2x1): a snapper, wet and gleaming
art('v10_fish', fp(2, 1), p => {
  const Fs = rp('#3a0e14', '#6a1e24', '#a4383a', '#d06a5e', '#f0a48e', '#fff0e4');
  const x0 = 3, x1 = 38;
  const T = (x: number) => (x + 0.5 - x0) / (x1 - x0);
  const top = (t: number) => 12 - 8.6 * (t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2) ** 0.75 : 1 - ((t - 0.3) / 0.7) ** 1.5 * 0.74);
  const bot = (t: number) => 12 + 6.6 * (t < 0.36 ? Math.sin((t / 0.36) * Math.PI / 2) ** 0.85 : 1 - ((t - 0.36) / 0.64) ** 1.4 * 0.7);
  // fins first (translucent): the forked tail, spiny dorsal, the anal fin and the pectoral
  const finC = (x: number, y: number, k: number) => ((x + y * k) % 3 < 1 ? H('#b84a44', 235) : H('#ec947e', 200));
  const tail = p.maskPoly([37, 10, 46.5, 2.5, 44, 12, 46.5, 21.5, 37, 14]);
  p.fill(tail, (x, y) => finC(x, y, 0));
  const dorsal = p.maskFn((x, y) => { const t = T(x); return t > 0.3 && t < 0.9 && y < top(t) + 0.5 && y > top(t) - 3.8 + Math.abs(Math.sin(x * 1.4)) * 1.4; });
  p.fill(dorsal, (x, y) => finC(x, y, 0.4));
  const anal = p.maskFn((x, y) => { const t = T(x); return t > 0.62 && t < 0.88 && y > bot(t) - 0.5 && y < bot(t) + 2.6; });
  p.fill(anal, (x, y) => finC(x, y, -0.4));
  // the body: red-pink back to a silvery belly, sky-blue spots, scale rows, a wet gleam
  const body = p.maskFn((x, y) => { const t = T(x); return t >= 0 && t <= 1 && y + 0.5 >= top(t) && y + 0.5 <= bot(t); });
  p.fill(body, (x, y) => {
    const t = T(x), tp = top(t), bt = bot(t), k = (y + 0.5 - tp) / Math.max(1, bt - tp);
    const l = p.lum(0, (k - 0.5) * 2, Math.sqrt(Math.max(0, 1 - ((k - 0.5) * 2) ** 2))) + 0.1;
    const sc = ((x + (y % 2) * 1.5) % 3) < 1 && t > 0.3;
    if (k > 0.62) return sc ? H('#f0d4cc') : H('#fbe8e0');
    return p.tn(Fs, l + (sc ? -0.08 : 0), x, y, 0.35);
  });
  for (let i = 0; i < 14; i++) { const x = Math.round(x0 + 11 + hash(i, 1, 4) * 22), t = T(x); const y = Math.round(top(t) + 1.5 + hash(i, 2, 4) * (bot(t) - top(t)) * 0.4); if (p.at(body, x, y)) p.px(x, y, H('#9ae0f4')); }
  p.fill(body, (x, y) => { const t = T(x); return t > 0.2 && t < 0.85 && Math.abs(y + 0.5 - (top(t) + 1.6)) < 0.5 ? H('#fff4f0') : -1; });
  // gill cover, the pectoral fin over the body, the golden eye, the mouth
  for (let y = 6; y < 18; y++) { const x = Math.round(13 + Math.abs(y - 12) * 0.25); if (p.at(body, x, y)) p.px(x, y, Fs[1]); }
  const pec = p.maskPoly([15, 13, 21, 11, 22, 14, 16, 15]);
  p.fill(pec, (x, y) => finC(x, y, 0.2));
  p.ball(8.4, 9.6, 2, 2, RP.amber, { lift: 0.5 });
  p.px(8, 10, H('#0a0806')); p.px(9, 10, H('#0a0806')); p.px(7, 9, H('#ffffff'));
  p.pts([[3, 12], [4, 12], [3, 13]], Fs[0]);
  for (const [x, y] of [[20, 8], [27, 15], [32, 9]] as Pt[]) p.droplet(x, y);
});

// ================================================================== lures

// ------------------------------------------------------------------ fruit lure (1x1): mashed moonfruit in a leaf parcel, tied with flax
lure('fruitlure', fp(1, 1), p => {
  const L = rp('#0c2414', '#163e20', '#22602a', '#358234', '#5aa640', '#a8d870');
  const pk = p.maskPoly([3, 14, 8, 6, 16, 5, 21, 12, 19, 20, 11, 22, 4, 19]);
  p.relief(pk, L, p.dome(pk, 4), { spec: 0.96, lift: 0.2 });
  // the leaf's folds and veins
  p.fill(pk, (x, y) => (Math.abs((x - 12) - (y - 13) * -0.8) < 0.5 ? L[4] : (Math.abs((x - 12) * 0.6 + (y - 13)) < 0.5 ? L[1] : -1)));
  // fruit squeezing out of the top fold, a flax tie
  const ooze = p.maskEllipse(13, 6.4, 4.6, 2.4, -0.2);
  p.relief(ooze, rp('#6a6428', '#9a9244', '#c8c06a', '#e8e096', '#f8f4c8', '#ffffff'), p.dome(ooze, 2), { spec: 0.92, lift: 0.4 });
  for (let x = 4; x <= 20; x++) { const y = Math.round(13 + (x - 12) * 0.3); if (p.has(x, y)) { p.px(x, y, RP.flaxDry[3]); p.px(x, y + 1, RP.flaxDry[1]); } }
  p.droplet(15, 9);
});

// ------------------------------------------------------------------ grub pot (1x1): a clay pot of wriggling grubs
lure('grublure', fp(1, 1), p => {
  const Tc = RP.terracotta;
  const pot = p.maskFn((x, y) => { const dy = (y + 0.5 - 15) / 7.4; return y >= 9 && y <= 22 && Math.abs(x + 0.5 - 12) <= 8.6 * Math.sqrt(Math.max(0, 1 - dy * dy * 0.6)) - (y > 20 ? (y - 20) * 1.5 : 0); });
  p.lit(pot, Tc, (x, y) => p.cylV((x + 0.5 - 12) / 8.6) + (noise2(x * 0.5, y * 0.5, 3) - 0.5) * 0.2, 0.5);
  ring(p, 12, 9.5, 6.4, 8.4, Tc, { ry: 0.36, lift: 0.4 });
  p.fill(p.maskEllipse(12, 9.4, 6.4, 2.2), RP.fur[0]);
  // grubs curling over the rim
  const Gb = rp('#5a4630', '#8c7656', '#b8a47e', '#ddcca4', '#f4e8c8', '#ffffff');
  for (const [a, b, c] of [[[8, 9], [6, 5], [9, 3.5]], [[12, 9], [13, 4], [16, 5.5]], [[15, 10], [19, 9], [20, 12]]] as Pt[][]) {
    const pts = bez(a, b, c, 8);
    const cv = curve(pts);
    const m = p.tube(pts, t => 1.6 - t * 0.5, Gb, { spec: 0.92, lift: 0.4 });
    p.fill(m, (x, y) => (Math.round(cv.loc(x, y).u) % 2 === 0 ? tone(p.get(x, y), -0.2) : -1));
    p.px(Math.round(c[0]), Math.round(c[1]), RP.fur[2]);
  }
});

// ------------------------------------------------------------------ fish bait (1x1): smelly scraps in a scallop shell
lure('fishbait', fp(1, 1), p => {
  const Sh = rp('#4a3a30', '#7a6658', '#a8947e', '#cebca4', '#ecdcc6', '#fffaf0');
  const sh = p.maskFn((x, y) => { const dx = x + 0.5 - 12, dy = y + 0.5 - 21; const a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); return Math.abs(a) < 1.25 && r < 11 - Math.abs(Math.sin(a * 6)) * 0.6 && y > 10; });
  p.relief(sh, Sh, p.dome(sh, 3), { lift: 0.2 });
  // a fish head and pink scraps
  const F = rp('#1a2a34', '#2e4a58', '#4a7080', '#78a0ac', '#b4d0d4', '#ffffff');
  const hd = p.maskPoly([4, 12, 10, 8, 14, 10, 13, 15, 7, 16]);
  p.relief(hd, F, p.dome(hd, 2.4), { spec: 0.9, lift: 0.3 });
  p.px(8, 11, H('#0a0a0a')); p.px(7, 10, H('#ffffff'));
  for (const [x, y, r] of [[15, 13, 2.4], [18, 15, 2], [12, 16, 2.2]] as number[][]) p.ball(x, y, r, r * 0.8, RP.coral, { spec: 0.9, lift: 0.3 });
  p.steam(9, 6, 5, '#b8e070', 120);
  p.steam(16, 8, 5, '#b8e070', 100, -1);
});

// ------------------------------------------------------------------ musk lure (1x1): droppings and resin in a leaf wrap, hung on a string
lure('scentlure', fp(1, 1), p => {
  // the leaf wrap cupped round the bottom, the dark ball of musk, amber resin poured over the top
  const L = rp('#16200c', '#283a14', '#3e5620', '#5a742e', '#7c9642', '#b6c878');
  const cup = p.maskFn((x, y) => { const dx = (x + 0.5 - 12) / 9, dy = (y + 0.5 - 13) / 9; return dx * dx + dy * dy <= 1 && y >= 13; });
  p.relief(cup, L, p.dome(cup, 3), { spec: 1, lift: 0.1 });
  p.fill(cup, (x, y) => (Math.abs(x + 0.5 - 12) < 0.6 ? L[4] : Math.abs((x - 12) * 0.6 + (y - 22)) < 0.5 ? L[1] : -1));
  const ball = p.lump(12, 12.4, 6.8, 5.6, 9, 0.1);
  p.relief(ball, RP.poo, p.dome(ball, 3.5), { spec: 1, lift: 0, tex: (x, y) => (noise2(x * 0.6, y * 0.6, 5) > 0.62 ? 0.5 : 0) });
  const rs = Pen.and(ball, p.maskFn((x, y) => y < 11 + Math.sin(x * 1.3) * 1.5 + (x % 5 === 0 ? 3 : 0)));
  p.relief(rs, RP.amber, p.dome(rs, 2), { spec: 0.9, lift: 0.1 });
  rope(p, [[12, 1.5], [12, 6.8]], 0.6, RP.flaxDry, { lift: 0.3 });
  p.steam(5, 9, 6, '#b8d070', 110);
  p.steam(19, 8, 6, '#c890d8', 100, -1);
});

// ------------------------------------------------------------------ glow lure (1x1): glowcaps set in a ball of clear resin
lure('glowlure', fp(1, 1), p => {
  const Am = rp('#2e2208', '#5a4210', '#8a6a1a', '#c09a34', '#e8cc70', '#fffbe0');
  const orb = p.ball(12, 13, 8.4, 8, Am, { spec: 0.93, lift: 0.1 });
  // light from inside: the resin brightest round the mushrooms
  p.tint(orb, (x, y) => { const d = Math.hypot(x + 0.5 - 11.5, y + 0.5 - 13.5); return d < 3.5 ? 0.45 : d < 5.5 ? 0.25 : 0; });
  const Gl = RP.glow;
  for (const [x, y, r] of [[10, 14, 3.4], [15, 12, 2.6], [12, 9, 2]] as number[][]) {
    p.fill(Pen.and(orb, p.maskFn((px, py) => Math.abs(px + 0.5 - x) < 0.8 && py >= y && py < y + r * 1.4)), Gl[4]);
    p.fill(Pen.and(orb, p.maskFn((px, py) => { const dx = (px + 0.5 - x) / r, dy = (py + 0.5 - y) / (r * 0.7); return dx * dx + dy * dy <= 1 && py + 0.5 <= y + 0.4; })), (px) => (px < x ? Gl[5] : Gl[4]));
  }
  p.glint(8, 8, H('#ffffff'), 0.5);
  p.glow(12, 13, 12, '#6ff0d0', 130);
  p.glow(12, 13, 6, '#d8fff4', 90);
  p.spark(20, 5, '#c0fff0');
  p.spark(4, 19, '#c0fff0');
});

// ------------------------------------------------------------------ bird caller (1x1): a cut reed whistle, lashed with flax
lure('caller', fp(1, 1), p => {
  const Rd = rp('#2e2a10', '#565020', '#827a34', '#aaa04c', '#d0c66c', '#f4eaa4');
  const f = frame(3, 20, 21, 4);
  p.tube([f.at(0, 0), f.at(f.len, 0)], 2.6, Rd, { cap: 'flat', spec: 0.95, lift: 0.3 });
  // nodes, the mouth notch and the finger holes
  for (const u of [5, 17]) { const m = p.maskFn((x, y) => { const [uu, v] = f.loc(x, y); return Math.abs(uu - u) < 0.7 && Math.abs(v) <= 2.7; }); p.fill(m, Rd[1]); }
  const [nx, ny] = f.at(20.5, -1.2); p.px(nx, ny, H('#1a1408')); p.px(nx - 1, ny, H('#1a1408'));
  for (const u of [9, 12]) { const [x, y] = f.at(u, -1); p.px(x, y, H('#1a1408')); p.px(x + 1, y + 1, Rd[4]); }
  const [ex, ey] = f.at(0.2, 0); p.fill(p.maskEllipse(ex, ey, 1.6, 2.4, -0.8), (x) => (x < ex ? Rd[2] : H('#2a2410')));
  // the flax lashing and a tassel
  for (let k = -2; k <= 2; k++) { const [x, y] = f.at(14 + k * 0.5, -2.7 + (k + 2) * 1.3); p.px(x, y, RP.flaxDry[3]); }
  rope(p, [[f.at(14.5, 2.8)[0], f.at(14.5, 2.8)[1]], [17, 22]], 0.5, RP.flaxDry);
});

// ------------------------------------------------------------------ camera trap (1x2): a camo box with its IR window, lens and strap
lure('trap', fp(1, 2), p => {
  const Cm = rp('#141a0c', '#222c14', '#34401e', '#4a5a2a', '#647838', '#8ea058');
  const camo = (x: number, y: number) => { const n = noise2(x * 0.28, y * 0.2, 11); return n > 0.62 ? -0.25 : n < 0.32 ? 0.18 : 0; };
  const b = box3(p, 3, 8, 15, 34, 4, -4, 2);
  p.lit(b.top, Cm, (x, y) => 0.82 + camo(x, y), 0.3);
  p.lit(b.side, Cm, (x, y) => 0.3 + camo(x, y), 0.3);
  p.lit(b.front, Cm, (x, y) => 0.56 - (y - 8) * 0.004 + camo(x, y), 0.4);
  // the strap round the middle
  const st = p.maskFn((x, y) => y >= 27 && y <= 30 && (p.at(b.front, x, y) || p.at(b.side, x, y)));
  p.lit(st, RP.iron, (x) => (x > 17 ? 0.25 : 0.55), 0.3);
  p.slab(p.maskBox(9, 26, 4, 6, 1), RP.chrome, 3);
  // IR window (dark red grid), the lens, the PIR sensor dome, a little status LED
  const ir = p.maskBox(6, 11, 9, 5, 1);
  p.fill(ir, (x, y) => ((x + y) % 2 ? H('#3a0a10') : H('#5a1218')));
  ring(p, 10.5, 20.5, 3.4, 4.6, RP.iron, { lift: 0.4 });
  glassLens(p, 10.5, 20.5, 3.4);
  p.ball(10.5, 35.5, 2.8, 2.6, rp('#5a5a5a', '#8a8a8a', '#b4b4b4', '#d4d4d4', '#ececec', '#ffffff'), { spec: 0.9, tex: (x, y) => ((x + y) % 2 ? -0.6 : 0) });
  p.px(15, 39, H('#ff4030')); p.fx.px(15, 39, H('#ff8060', 200));
});


