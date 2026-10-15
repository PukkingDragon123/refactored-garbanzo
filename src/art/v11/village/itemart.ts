// V11 item art for Te Kāinga (registered with the illustrated item art, src/art/v11/items/kit.ts):
// a hāngī parcel, smoked tuna (eel), parāoa parai (fried bread), boiled eggs, a shed serpent skin,
// the hue kiri, Hēmi's bone pendant of Hinerua, and the village dishes.

import { artGroup, fp, IP, RP, H, rp, hash, bez, noise2, rope } from '../items/kit';
import type { Pt } from '../items/kit';

const art = artGroup('Village');

// ------------------------------------------------------------------ hāngī parcel (2x1): leaves folded round the food, flax-tied, steaming
art('vil_hangi', fp(2, 1), (p: IP) => {
  const Lf = rp('#0e1e0c', '#1c3416', '#2c4e20', '#3e6a2a', '#5a8a38', '#a6cc6a');
  const body = p.maskEllipse(24, 14, 19, 8.4);
  p.fill(body, (x, y) => {
    const fold = Math.abs(((x * 0.7 + y) % 9) - 4.5) < 0.6;
    const l = p.lum(-(x - 24) / 19, -(y - 14) / 8.4 * 1.4, 0.8) + (fold ? -0.22 : 0) + (noise2(x * 0.4, y * 0.4, 3) - 0.5) * 0.15;
    return p.tn(Lf, l, x, y, 0.4);
  });
  // a corner of the leaf peeled back: kūmara and pumpkin inside
  const peek = p.maskEllipse(13, 12, 5, 3.4);
  p.fill(peek, (x, y) => (x < 13 ? p.tn(RP.kumaraFlesh, 0.6, x, y, 0.3) : p.tn(RP.ochre, 0.7, x, y, 0.3)));
  // the flax tie round the middle
  rope(p, [[24, 5.6], [25, 22]], 1.1, RP.flaxDry, { period: 2.4 });
  rope(p, [[6, 14], [42, 14]], 1, RP.flaxDry, { period: 2.4 });
  p.steam(18, 4, 6, '#ffffff', 120);
  p.steam(30, 4, 5, '#ffffff', 100, -1);
});

// ------------------------------------------------------------------ smoked tuna (2x1): a golden-brown smoked eel in a loose curve
art('vil_tuna', fp(2, 1), (p: IP) => {
  const E = rp('#1c0c04', '#3e1e0a', '#6a3a14', '#9a5e22', '#c88a3a', '#f6d08a');
  const pts = bez([4, 15], [24, 2], [44, 14], 22) as Pt[];
  p.tube(pts, t => 3.6 - t * 1.6, E, { spec: 0.9, lift: 0.1 });
  // the skin's sheen and the smoke stripes from the rack
  for (let i = 3; i < pts.length - 3; i += 3) { const [x, y] = pts[i]; p.px(Math.round(x), Math.round(y) - 2, E[4]); p.px(Math.round(x) + 1, Math.round(y) + 1, E[1]); }
  p.ball(4, 15.6, 3.4, 3, E, { lift: 0.1 });
  p.px(3, 14, H('#1a0c06'));
});

// ------------------------------------------------------------------ parāoa parai (1x1): golden fried bread, puffy, a drip of golden syrup
art('vil_paraoa', fp(1, 1), (p: IP) => {
  const B = RP.bread;
  const m = p.lump(12, 13, 9, 7, 5, 0.12);
  p.relief(m, B, p.dome(m, 5), { spec: 0.95, lift: 0.15, tex: (x, y) => (noise2(x * 0.5, y * 0.5, 2) > 0.7 ? -0.6 : 0), dither: 0.3 });
  const syrup = rp('#5a2a04', '#8a4808', '#c07010', '#e8a020', '#f8cc50', '#fff2b0');
  p.ball(13, 9, 3.6, 2, syrup, { spec: 0.85, lift: 0.3 });
  p.tube([[15, 10], [16, 14], [16, 17]], 0.8, syrup, { lift: 0.2 });
  p.glint(12, 8);
});

// ------------------------------------------------------------------ boiled eggs (1x1): three brown eggs in a little flax basket
art('vil_egg', fp(1, 1), (p: IP) => {
  const Eg = rp('#4a2a14', '#7a4a26', '#a8703e', '#ca9a62', '#e8c494', '#fff2dc');
  const bowl = p.maskPoly([2, 13, 22, 13, 19, 22, 5, 22]);
  p.fill(bowl, (x, y) => p.tn(RP.flaxDry, ((x + y) % 3 ? 0.55 : 0.35) - (y - 13) * 0.03, x, y, 0.3));
  for (const [x, y] of [[7.5, 10.5], [16, 10], [12, 8]] as number[][]) p.ball(x, y, 3.6, 4.4, Eg, { spec: 0.93, lift: 0.1 });
  rope(p, [[2, 13], [22, 13]], 1, RP.flaxDry, { period: 2 });
});

// ------------------------------------------------------------------ shed serpent skin (2x1): a papery, translucent moult, the scales printed on it
art('vil_kiri', fp(2, 1), (p: IP) => {
  const Sk = rp('#5a5440', '#8a826a', '#b4ac90', '#d4ccae', '#ece6cc', '#fffcec');
  const pts = bez([3, 12], [22, 2], [45, 16], 24) as Pt[];
  const m = p.tube(pts, t => 4.6 - Math.abs(t - 0.4) * 3, Sk, { spec: 1, lift: 0.25 });
  p.fill(m, (x, y) => {
    const u = (x + y * 1.4) / 3, v = (x - y * 1.4) / 3;
    const edge = Math.abs(u - Math.round(u)) < 0.14 || Math.abs(v - Math.round(v)) < 0.14;
    return edge ? Sk[1] : (hash(x, y, 4) > 0.9 ? Sk[5] : -1);
  });
  // a ragged, split end where it peeled
  for (let i = 0; i < 6; i++) p.px(44 + (i % 2), 13 + i, Sk[2]);
  p.spark(20, 4, '#fffbe0');
});

// ------------------------------------------------------------------ the hue kiri (2x3): a gourd body with a serpent-skin face, a long neck ending in a carved serpent head
art('vil_huekiri', fp(2, 3), (p: IP) => {
  const G = RP.gourd, Nk = rp('#140804', '#2a160c', '#442616', '#5e3a22', '#7a5032', '#b08460');
  const Sk = rp('#5a5440', '#8a826a', '#b4ac90', '#d4ccae', '#ece6cc', '#fffcec');
  // the neck, up the middle
  p.tube([[24, 46], [24, 10]], t => 2.6 - t * 0.6, Nk, { lift: 0.1 });
  // frets of bound flax
  for (const y of [18, 24, 30, 36]) p.tube([[21, y], [27, y]], 0.6, RP.flaxDry, { lift: 0.2 });
  // the serpent head at the top, pāua eye, a red tongue
  p.ball(24, 7, 4.6, 3.6, Nk, { lift: 0.15 });
  p.px(26, 6, H('#5ac8b0')); p.px(27, 6, H('#ffffff'));
  p.line(28, 8, 31, 9, H('#c8302a'));
  // the gourd body and its skin face
  p.ball(24, 56, 15, 13, G, { spec: 0.92, lift: 0.05 });
  const face = p.maskEllipse(24, 55, 11, 9.4);
  p.fill(face, (x, y) => {
    const u = (x + y) / 3.2, v = (x - y) / 3.2;
    const edge = Math.abs(u - Math.round(u)) < 0.13 || Math.abs(v - Math.round(v)) < 0.13;
    const l = p.lum(-(x - 24) / 11 * 0.4, -(y - 55) / 9.4 * 0.4, 1);
    return edge ? p.tn(Sk, l - 0.35, x, y) : p.tn(Sk, l, x, y, 0.3);
  });
  // two strings of muka from the bridge up the neck, the bridge, tāniko-patterned rim cord
  for (const x of [22, 26]) p.line(x, 60, x + (x < 24 ? 1 : -1), 10, H('#f0e6c8'));
  p.rect(20, 59, 9, 2, Nk[3]);
  for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; p.px(Math.round(24 + Math.cos(t) * 11.6), Math.round(55 + Math.sin(t) * 10), a % 3 === 0 ? H('#1a1010') : a % 3 === 1 ? H('#a8322a') : H('#e8dcc0')); }
});

// ------------------------------------------------------------------ Hēmi's pendant (1x1): bone carved as Hinerua coiled, on a flax cord
art('vil_hei', fp(1, 1), (p: IP) => {
  rope(p, bez([3, 2], [12, 10], [21, 2], 14) as Pt[], 0.7, RP.flaxDry, { period: 2 });
  const Bn = RP.ivory;
  const pts: Pt[] = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * Math.PI * 3.2, r = 7 - t * 4.4; pts.push([12 + Math.cos(a) * r, 15 + Math.sin(a) * r * 0.9]); }
  p.tube(pts, t => 2.4 - t * 0.8, Bn, { spec: 0.9, lift: 0.2 });
  p.ball(12 + 7, 15, 2.6, 2.2, Bn, { lift: 0.25 });
  p.px(20, 14, H('#2a8a74'));
});

// ------------------------------------------------------------------ dishes
art('dish_boilup', fp(1, 2), (p: IP) => {
  const T = RP.tin;
  const body = p.maskFn((x, y) => Math.abs(x + 0.5 - 12) <= 9.5 && y >= 22 && y <= 44);
  p.lit(body, T, (x) => p.cylV((x + 0.5 - 12) / 9.5), 0.5);
  const top = p.maskEllipse(12, 22, 9.5, 3);
  p.fill(top, (x, y) => { const n = noise2(x * 0.6, y * 0.9, 7); return n > 0.68 ? RP.kumaraFlesh[3] : n < 0.25 ? RP.fern[3] : H(y < 22 ? '#a87a4a' : '#8a5e34'); });
  p.steam(9, 16, 8, '#ffffff', 130);
  p.steam(15, 15, 9, '#ffffff', 110, -1);
});
art('dish_eelstew', fp(1, 2), (p: IP) => {
  const T = RP.enamel;
  const body = p.maskFn((x, y) => Math.abs(x + 0.5 - 12) <= 9 && y >= 24 && y <= 44);
  p.lit(body, T, (x) => p.cylV((x + 0.5 - 12) / 9), 0.5);
  const top = p.maskEllipse(12, 24, 9, 3);
  p.fill(top, (x, y) => { const n = noise2(x * 0.7, y * 0.9, 9); return n > 0.66 ? H('#c88a3a') : n < 0.3 ? RP.fern[4] : H('#6a5a28'); });
  p.steam(12, 18, 8, '#ffffff', 120);
});
