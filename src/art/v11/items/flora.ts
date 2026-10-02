// V11 item art: plants and fungi. Silver fern frond, harakeke leaf, kawakawa, rātā blossom, pitcher plant,
// moonfruit, cushion moss, glowcap, shelf bracket, violet inkcap, the island's sea holly, salt fern,
// glow moss and dune lily bulb, the deep places' lantern-cap, ghost fern, hot-spring mat, cave lichen,
// pā vine and giant fern spores, and the kelp holdfast.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, bez, curve, stoneTex, leafBlade, noise2, fbm2 } from './kit';
import type { Pt, Ramp, Mask, Curve } from './kit';

const art = artGroup('Plants & fungi');

/** a pinnate frond: a rachis along pts with leaflets alternating left and right, each a lobed blade
 *  with a pale midrib; len(t) = leaflet length, step = spacing along the rachis */
function pinnate(p: IP, pts: Pt[], o: { len: (t: number) => number; t0?: number; step?: number; ang?: number; wid?: number; top: Ramp; under?: Ramp; underSide?: number; rachis?: Ramp; lift?: number; serr?: boolean }) {
  const c = curve(pts);
  const step = o.step ?? 4.2;
  const n = Math.floor(c.len * (1 - (o.t0 ?? 0.1)) / step * 2);
  const ang = o.ang ?? 1.1;
  const w = o.wid ?? 1.6;
  // leaflets from the tip down so the lower ones overlap the upper ones
  for (let i = n; i >= 0; i--) {
    const side = i % 2 ? 1 : -1;
    const t = (o.t0 ?? 0.1) + (i * step * 0.5) / c.len;
    if (t > 0.97) continue;
    const q = c.at(t), L = o.len(t);
    if (L < 1) continue;
    const a = Math.atan2(q.ty, q.tx) + side * ang;
    const bx = q.x + Math.cos(a) * L + q.tx * L * 0.35, by = q.y + Math.sin(a) * L + q.ty * L * 0.35;
    const mid: Pt = [q.x + Math.cos(a) * L * 0.55 + q.tx * L * 0.05, q.y + Math.sin(a) * L * 0.55 + q.ty * L * 0.05];
    const R = o.under && side === (o.underSide ?? 1) ? o.under : o.top;
    const lc = curve(bez([q.x, q.y], mid, [bx, by], 10));
    const lobe = (k: { u: number; t: number }) => (o.serr ? 0.55 + 0.45 * Math.abs(Math.sin(k.u * 1.5)) : 1);
    const m = p.maskFn((x, y) => { const k = lc.loc(x, y); if (k.t < 0 || k.t > 1) return false; const ww = (k.t < 0.12 ? w * (0.45 + k.t * 4.5) : w * (1 - k.t) ** 0.6 + 0.3) * lobe(k); return Math.abs(k.v) <= ww; });
    p.relief(m, R, (x, y) => { if (!p.at(m, x, y)) return 0; const k = lc.loc(x, y); return 2 - Math.abs(k.v) * 0.8; }, { spec: 1, lift: (o.lift ?? 0.2) + (side < 0 ? 0.35 : -0.15) });
    p.fill(m, (x, y) => { const k = lc.loc(x, y); return Math.abs(k.v) < 0.42 && k.t < 0.88 ? tone(p.get(x, y), 0.25) : -1; });
  }
  p.tube(pts, t => 0.9 - t * 0.5, o.rachis ?? RP.olive, { spec: 1, lift: 0.3 });
  return c;
}

// ------------------------------------------------------------------ silver fern frond (1x3): green above, silver beneath
art('fernfrond', fp(1, 3), p => {
  const pts = bez([12, 70], [9, 36], [13.5, 5], 40);
  pinnate(p, pts, { len: t => (t < 0.2 ? 5 + t * 22 : 10 * (1 - t) ** 0.7 + 1.2), t0: 0.15, step: 4.4, ang: 1.15, wid: 1.9, top: RP.fern, under: RP.silverfern, underSide: 1, rachis: rp('#2a2010', '#4a3a1c', '#6e5a2e', '#8e7a44', '#b0a064', '#d6ca98'), serr: true });
  // the curled tip (a young koru)
  const k: Pt[] = []; for (let i = 0; i <= 16; i++) { const a = -1.4 + i * 0.36, r = 2.6 - i * 0.12; k.push([13.8 + Math.cos(a) * r, 5 + Math.sin(a) * r]); }
  p.tube(k, 0.7, RP.fern, { spec: 1, lift: 0.6 });
  // furry brown scales at the base of the stipe
  for (let y = 60; y < 70; y += 2) { p.px(10 + (y % 4 ? 0 : 1), y, RP.bark[3]); p.px(14, y + 1, RP.bark[2]); }
});

// ------------------------------------------------------------------ harakeke / flax leaf (1x3): V-folded, red-edged, bending over
art('flaxleaf', fp(1, 3), p => {
  const F = rp('#0e2416', '#183e22', '#26602e', '#3a823a', '#5ca248', '#a6d47a');
  const pts = bez([11, 70], [9.5, 30], [15.5, 4], 40);
  const c = curve(pts);
  const w = (t: number) => (t < 0.06 ? 3.2 + t * 20 : 5.4 * (1 - t) ** 0.5 + 0.4);
  const m = p.band(c, w);
  // the fold: the left half faces the light, the right half falls into shade
  p.lit(m, F, (x, y) => { const q = c.loc(x, y); const k = q.v / Math.max(0.5, w(clamp(q.t, 0, 1))); return k < 0 ? 0.8 + k * 0.14 : 0.44 - k * 0.14; }, 0.4);
  p.fill(m, (x, y) => {
    const q = c.loc(x, y), ww = w(clamp(q.t, 0, 1));
    if (Math.abs(q.v) < 0.5) return F[5];
    if (Math.abs(q.v) > ww - 0.8 && q.t > 0.12) return q.v < 0 ? H('#c45a2a') : H('#7a2a1a');
    if (q.t < 0.1) return tone(p.get(x, y), q.v < 0 ? -0.1 : -0.25);
    return -1;
  });
  // the purple-red leaf base and a split strand of fibre
  p.fill(m, (x, y) => (c.loc(x, y).t < 0.08 ? mix(p.get(x, y), H('#6a2a3a'), 0.55) : -1));
  p.tube(bez([12, 62], [17, 54], [19.5, 44], 12), 0.55, RP.flaxDry, { spec: 1, lift: 0.4 });
  p.glint(9, 40, H('#e8ffd0'), 0.3);
});

// ------------------------------------------------------------------ kawakawa (1x2): two glossy heart leaves, eaten full of holes
function heart(p: IP, cx: number, cy: number, s: number, ang: number, R: Ramp, holes: [number, number, number][]) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const loc = (x: number, y: number) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return { u: (dx * ca + dy * sa) / s, v: (-dx * sa + dy * ca) / s }; };
  const m = p.maskFn((x, y) => { const { u, v } = loc(x, y); const X = u, Y = -v + 0.1; const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; });
  const z = (x: number, y: number) => { if (!p.at(m, x, y)) return 0; const { u, v } = loc(x, y); return 2.2 - Math.abs(u) * 1.6 + Math.sqrt(Math.max(0, 1.2 - u * u - v * v)) * 1.5; };
  p.relief(m, R, z, { spec: 0.955, lift: 0.3 });
  p.fill(m, (x, y) => {
    const { u, v } = loc(x, y);
    if (Math.abs(u) < 0.07 && v > -0.95) return R[4];
    const vein = Math.abs((((v * 3.2 + Math.abs(u) * 2.4) % 1.25) + 1.25) % 1.25 - 0.62) < 0.1 && Math.abs(u) > 0.12 && Math.abs(u) < 0.8;
    return vein ? tone(p.get(x, y), 0.2) : -1;
  });
  for (const [hu, hv, hr] of holes) {
    const hx = cx + (hu * ca - hv * sa) * s, hy = cy + (hu * sa + hv * ca) * s;
    p.fill(Pen.and(m, p.maskDisc(hx, hy, hr)), 0);
    p.fill(Pen.and(m, Pen.sub(p.maskDisc(hx + 0.4, hy + 0.4, hr + 0.8), p.maskDisc(hx, hy, hr))), (x, y) => tone(p.get(x, y), -0.3));
  }
  return m;
}
art('kawakawa', fp(1, 2), p => {
  const K = rp('#0a2018', '#123a26', '#1d5c30', '#2c8036', '#4ea440', '#a8dc78');
  p.tube(bez([12.5, 47], [11, 36], [12.6, 22], 14), 0.9, RP.olive, { spec: 1, lift: 0.3 });
  p.ball(12, 32, 1.4, 1.2, RP.olive, { lift: 0.4 });
  heart(p, 15.4, 35.6, 6.2, 0.75, K, [[0.3, -0.2, 0.9], [-0.35, 0.3, 0.6]]);
  heart(p, 11.6, 13.6, 9.6, -0.12, K, [[-0.4, -0.25, 1.2], [0.35, 0.1, 0.9], [0.1, -0.6, 0.7], [-0.15, 0.45, 0.6], [0.55, -0.45, 0.5]]);
});

// ------------------------------------------------------------------ rātā blossom (1x1): a scarlet pom-pom of stamens
art('ratabloom', fp(1, 1), p => {
  leafBlade(p, bez([11, 17], [5, 19], [2.4, 22], 8), t => 2.2 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true });
  leafBlade(p, bez([13, 17], [18, 19.5], [21.6, 21.4], 8), t => 2.2 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true, lift: -0.3 });
  const cx = 12, cy = 10;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + hash(i, 2, 3) * 0.12;
    const len = 6.6 + hash(i, 5, 3) * 2.6;
    const back = Math.sin(a) < -0.2 && i % 2;
    for (let k = 2; k <= len; k++) {
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k * 0.9;
      const lit = Math.cos(a + Math.PI * 0.75);
      p.px(x, y, k >= len - 0.9 ? RP.yellow[lit > 0.2 ? 5 : 3] : RP.red[back ? 1 : k < 4 ? 2 : lit > 0.3 ? 4 : lit > -0.3 ? 3 : 2]);
    }
  }
  p.ball(cx, cy, 2.6, 2.4, RP.red, { lift: -1 });
  p.px(cx - 1, cy - 1, RP.red[4]);
  p.spark(17, 5, '#fff6d0');
  p.spark(6, 13, '#fff6d0');
});

// ------------------------------------------------------------------ pitcher plant (1x2): a speckled urn, a ribbed rim round its mouth, the lid raised
art('pitcher', fp(1, 2), p => {
  const G = rp('#12301a', '#1f5024', '#357a2a', '#58a232', '#8ccc48', '#d4f08a');
  const Rd = rp('#2e0a0c', '#5a1216', '#8e1e1e', '#c03a2a', '#e8664a', '#ffb090');
  // the urn: a narrow neck under the rim swelling to a round belly; two fringed wings down the front
  const prof = (y: number) => (y < 17 ? 0 : y < 23 ? 4.6 - (y - 17) * 0.12 : 3.9 + Math.sin(Math.min(1, (y - 23) / 19) * Math.PI) * 4.4);
  const cxAt = (y: number) => 12 + (y - 17) * 0.03;
  const body = p.maskFn((x, y) => y >= 17 && y <= 44 && Math.abs(x + 0.5 - cxAt(y)) <= prof(y) - (y > 42 ? (y - 42) * 1.8 : 0));
  p.relief(body, G, (x, y) => { if (!p.at(body, x, y)) return 0; const k = (x + 0.5 - cxAt(y)) / Math.max(1, prof(y)); return Math.sqrt(Math.max(0, 1 - k * k)) * 4; }, { spec: 0.95, lift: 0.3 });
  // red speckles, sparse near the rim, dense toward the belly
  p.fill(body, (x, y) => (hash(x, y, 4) < (y - 18) / 40 * 0.55 && hash(x >> 1, y >> 1, 5) > 0.3 ? Rd[x < 12 ? 3 : 2] : -1));
  for (const wx of [10, 14]) for (let y = 25; y < 41; y++) { p.px(wx, y, G[4]); if (y % 2 === 0) p.px(wx + (wx < 12 ? -1 : 1), y, G[3]); }
  // the mouth seen a little from above: dark throat at the back, the ribbed peristome ring round it
  const ringM = Pen.sub(p.maskEllipse(12, 16.2, 6.4, 2.9), p.maskEllipse(12, 15.7, 4.2, 1.6));
  p.fill(ringM, (x, y) => { const a = Math.atan2((y + 0.5 - 16.2) / 2.9, (x + 0.5 - 12) / 6.4); const rib = Math.abs(Math.sin(a * 9)) > 0.6; const front = y + 0.5 > 16.2; return Rd[clamp((front ? 3 : 2) + (rib ? 1 : 0) - (x > 14 ? 1 : 0), 0, 5)]; });
  p.fill(p.maskEllipse(12, 15.7, 4.2, 1.6), (x, y) => (y + 0.5 > 16 ? H('#3a1410') : H('#140806')));
  // the lid raised on its spur at the back, its paler underside toward us
  p.tube([[12.5, 13.8], [13, 9]], 0.9, G, { lift: 0.2 });
  const lid = p.maskEllipse(12.4, 7.2, 5.6, 2.8, -0.12);
  p.relief(lid, G, p.dome(lid, 2), { spec: 0.96, lift: 0.5 });
  p.fill(lid, (x, y) => (y > 7.6 ? (hash(x, y, 7) > 0.7 ? Rd[4] : G[4]) : -1));
  // a curling tendril and a drop of nectar
  p.tube([[8, 42], [4.6, 44.5], [3, 41], [5, 39]], 0.6, G, { spec: 1 });
  p.droplet(16, 30, true);
});

// ------------------------------------------------------------------ moonfruit (1x1): pale fruit that glows a little at night
art('moonfruit', fp(1, 1), p => {
  const Mf = rp('#5a5428', '#8a8244', '#b8b06a', '#dcd696', '#f4f0c4', '#fffff4');
  const m = p.ball(11.6, 13.8, 7.6, 7.2, Mf, { spec: 0.955, lift: 0.3 });
  p.fill(m, (x, y) => (Math.abs(x + 0.5 - (11.6 + (y - 13.6) * 0.18)) < 0.55 && y > 8 && y < 20 ? Mf[2] : hash(x, y, 4) > 0.94 ? Mf[3] : -1));
  p.tube([[12, 7], [13, 3.4]], 0.75, RP.wood, { lift: 0.3 });
  leafBlade(p, bez([13, 4.2], [17, 1.6], [21, 3.6], 8), t => 2 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true });
  p.glow(11.6, 13.8, 11, '#fff8c4', 64);
  p.spark(3, 7, '#fffbe0');
  p.spark(20, 18, '#fffbe0');
});

// ------------------------------------------------------------------ cushion moss (2x1): a spongy cushion on a stone, capsules on stalks
art('moss', fp(2, 1), p => {
  const rock = p.lump(24, 18, 20, 5, 4, 0.08);
  p.relief(rock, RP.stone, p.dome(rock, 3), { tex: stoneTex(4, 0.5, 0.08), lift: -0.2 });
  const M = RP.moss;
  const cush = Pen.or(p.lump(13, 14, 10, 6, 3, 0.1), p.lump(26, 11.6, 11, 7.4, 5, 0.1), p.lump(37, 14.6, 8, 5, 7, 0.12));
  const tuft = (x: number, y: number) => { const n = noise2(x * 0.5, y * 0.5, 8); return n > 0.62 ? 0.25 : n < 0.3 ? -0.35 : 0; };
  p.relief(cush, M, p.dome(cush, 4), { spec: 1, tex: tuft, lift: 0.2, dither: 0.5 });
  p.fill(cush, (x, y) => (hash(x, y, 6) > 0.9 && !p.at(cush, x, y - 2) ? M[5] : -1));
  // spore capsules on fine red stalks
  for (const [x, y, h] of [[10, 9, 4], [17, 7, 5], [24, 5, 4], [29, 5, 5], [35, 8, 4], [40, 10, 3]] as [number, number, number][]) {
    for (let k = 1; k <= h; k++) p.px(x + (k > 2 ? 1 : 0), y - k, RP.orange[2]);
    p.px(x + 1, y - h - 1, RP.orange[4]); p.px(x + 1, y - h - 2, RP.orange[3]); p.px(x + 2, y - h - 1, RP.orange[1]);
  }
});

// ------------------------------------------------------------------ glowcap (1x1): a cyan mushroom pair, glowing
art('glowcap', fp(1, 1), p => {
  const Gl = RP.glow;
  const stem = rp('#3a6a64', '#6aa49a', '#9cd2c4', '#c8f0e4', '#e8fff8', '#ffffff');
  p.ball(12, 21.6, 7.6, 1.8, RP.moss, { spec: 1, lift: -0.3 });
  p.tube([[17.4, 21], [17.6, 15.4]], 1.1, stem, { cap: 'flat' });
  p.ball(17.6, 15.4, 3.9, 3, Gl, { clip: (x, y) => y + 0.5 <= 15.6, lift: 0.4 });
  p.rect(14, 15, 8, 1, Gl[1]);
  p.tube([[9.6, 21.4], [10, 11.8]], 1.9, stem, { cap: 'flat' });
  p.ball(10, 11.4, 8, 6.6, Gl, { clip: (x, y) => y + 0.5 <= 11.8, lift: 0.4, spec: 0.95 });
  // gills under the cap's rim
  for (let x = 3; x <= 17; x++) p.px(x, 11, x % 2 ? Gl[1] : Gl[2]);
  p.rect(5, 12, 10, 1, Gl[0]);
  p.pts([[7, 7], [8, 6], [11, 5], [13, 8], [6, 9], [15, 9]], stem[4]);
  p.pts([[7, 6], [11, 4]], H('#ffffff'));
  p.glow(10, 9, 12, '#6ff0e0', 72);
  p.spark(20, 6, '#b8fff0');
  p.spark(3, 17, '#b8fff0');
});

// ------------------------------------------------------------------ shelf bracket (2x1): a woody half-disc of a fungus, growth bands to a pale rim
art('bracket', fp(2, 1), p => {
  const Br = rp('#2e1206', '#5e2a0c', '#904816', '#c27024', '#e8a03a', '#fcd070');
  // the bark it grew from
  const bark = p.maskBox(2, 2, 6, 20, 1);
  p.lit(bark, RP.bark, (x, y) => 0.5 + (x === 2 ? 0.2 : 0) + (noise2(x * 0.8, y * 0.2, 3) > 0.6 ? -0.25 : 0), 0.4);
  // the shelf seen from a little above: banded top, cream growing rim, dark pored underside
  const top = p.maskFn((x, y) => { const dx = (x + 0.5 - 7) / 40, dy = (y + 0.5 - 11) / 8.4; return dx >= 0 && dx * dx + dy * dy <= 1 && y + 0.5 <= 13.5; });
  const under = p.maskFn((x, y) => { const dx = (x + 0.5 - 7) / 39, dy = (y + 0.5 - 13.6) / 6; return dx >= 0 && dx * dx + dy * dy <= 1 && y + 0.5 > 12.5 && y < 19; });
  p.fill(under, (x, y) => (y < 15 ? H('#efe0bc') : (x + y) % 2 ? Br[1] : Br[0]));
  p.relief(top, Br, (x, y) => { if (!p.at(top, x, y)) return 0; const dx = (x + 0.5 - 7) / 40, dy = (y + 0.5 - 11) / 8.4; const d = Math.sqrt(dx * dx + dy * dy); return (1 - d) * 4 + Math.sin(d * 26) * 0.35; }, { lift: 0.3, spec: 1 });
  p.fill(top, (x, y) => { const dx = (x + 0.5 - 7) / 40, dy = (y + 0.5 - 11) / 8.4; const d = Math.sqrt(dx * dx + dy * dy); return d > 0.9 ? H('#ead6a8') : Math.sin(d * 26 + noise2(x * 0.2, y * 0.5, 2)) > 0.75 ? tone(p.get(x, y), -0.22) : -1; });
  p.drop(top, -0.4, 0, 1);
});

// ------------------------------------------------------------------ violet inkcap (1x2): a tall bell melting into ink
art('inkcap', fp(1, 2), p => {
  const V = RP.violet;
  p.tube([[11.8, 45], [12, 22]], 1.6, RP.cream, { cap: 'flat', lift: 0.3 });
  p.ball(12, 47, 6, 1.4, rp('#0e0618', '#1c0c30', '#2c1648', '#442466', '#5e3486', '#8e62b8'), { spec: 1, lift: -0.3 });
  const cap = p.maskFn((x, y) => { const dy = (y + 0.5 - 16) / 13, dx = (x + 0.5 - 12) / (6.6 * Math.sqrt(Math.max(0, 1 - Math.max(0, -dy) ** 2 * 0.7))); return y >= 3 && y <= 26 && dx * dx + Math.max(0, -dy) ** 2 <= 1; });
  p.relief(cap, V, (x, y) => (p.at(cap, x, y) ? Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 12) / 6.6) ** 2)) * 4 : 0), { spec: 0.96, lift: 0.2 });
  // fine striations and the shaggy scales near the top
  p.fill(cap, (x, y) => (x % 2 === 0 && y > 8 && hash(x, y >> 1, 3) > 0.35 ? tone(p.get(x, y), -0.15) : y < 9 && hash(x, y, 5) > 0.7 ? V[5] : -1));
  // the rim dissolving into drips of ink
  for (let x = 6; x <= 18; x++) {
    if (!p.has(x, 25)) continue;
    const n = Math.floor(hash(x, 4, 9) * 4.4);
    for (let k = 0; k < n; k++) p.px(x, 26 + k, k === n - 1 ? V[0] : V[1]);
  }
  p.droplet(8, 36);
});

// ------------------------------------------------------------------ sea holly (1x2): spiny blue-silver leaves and a thistle head
art('plant_seaholly', fp(1, 2), p => {
  const B = rp('#16263a', '#2a4460', '#466c88', '#6c96aa', '#9ec4cc', '#e6fbf6');
  p.tube(bez([12, 47], [11.5, 32], [12, 14], 12), 0.9, B, { lift: 0.2 });
  const spiky = (pts: Pt[], wmax: number, lift: number) => {
    const c = curve(pts);
    const m = p.band(c, t => (wmax * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)) + 0.4) * (1 + 0.45 * Math.max(0, Math.sin(t * 22))));
    p.relief(m, B, (x, y) => { if (!p.at(m, x, y)) return 0; const q = c.loc(x, y); return 2 - Math.abs(q.v) * 0.7; }, { spec: 0.96, lift });
    p.fill(m, (x, y) => (Math.abs(c.loc(x, y).v) < 0.45 ? B[5] : -1));
  };
  spiky(bez([11.6, 36], [5, 33], [1.8, 26], 10), 3.2, 0.4);
  spiky(bez([12.4, 31], [19, 29], [22, 22], 10), 3, -0.1);
  spiky(bez([11.8, 44], [5.5, 43], [2.5, 38], 10), 2.6, 0.3);
  spiky(bez([12.2, 41], [18, 41], [21.6, 36], 10), 2.6, -0.2);
  // the thistle-like flower head with its spiny ruff
  for (let i = 0; i < 12; i++) { const a = -Math.PI * (0.05 + 0.9 * (i / 11)) + Math.PI; p.line(12, 14, 12 + Math.cos(a) * 8, 14 + Math.sin(a) * 4 + 2, B[i % 2 ? 3 : 4]); }
  const hd = p.ball(12, 9, 4.4, 5.4, rp('#1a2a5a', '#2a428a', '#3e62b4', '#6a8ed4', '#a8c4ec', '#eaf4ff'), { spec: 0.93, tex: (x, y) => ((x + y) % 2 ? -0.6 : 0.3) });
  p.fill(hd, (x, y) => (hash(x, y, 2) > 0.85 ? H('#f0f6ff') : -1));
});

// ------------------------------------------------------------------ salt fern (1x2): a leathery frond crusted with salt
art('plant_saltfern', fp(1, 2), p => {
  const S = rp('#0c2422', '#163e38', '#22584c', '#357460', '#5a9a7e', '#b8e2c8');
  pinnate(p, bez([11, 46], [9, 24], [14, 4], 30), { len: t => 7.2 * (1 - t) ** 0.6 + 1, t0: 0.14, step: 4.6, ang: 1.15, wid: 2.1, top: S, rachis: RP.olive, lift: 0.3 });
  // crusts of salt crystals glinting on the fronds
  for (let i = 0; i < 40; i++) {
    const x = Math.round(2 + hash(i, 1, 8) * 20), y = Math.round(5 + hash(i, 2, 8) * 38);
    if (!p.has(x, y)) continue;
    p.px(x, y, hash(i, 3, 8) > 0.5 ? H('#ffffff') : H('#d8ece6'));
    if (hash(i, 4, 8) > 0.6 && p.has(x + 1, y)) p.px(x + 1, y, H('#b8d0ca'));
  }
  p.spark(17, 12, '#ffffff');
  p.spark(6, 30, '#ffffff');
});

// ------------------------------------------------------------------ glow moss (1x1): a soft clump on cave rock, glowing faint green
art('plant_glowmoss', fp(1, 1), p => {
  const rock = p.lump(12, 17, 10, 5, 21, 0.1);
  p.relief(rock, RP.basalt, p.dome(rock, 3), { tex: stoneTex(21, 0.5), lift: 0.2 });
  const G = rp('#123a14', '#1e6020', '#34902c', '#5ec03c', '#9cf06a', '#e8ffc8');
  const m = Pen.or(p.lump(9, 12, 6.4, 4.6, 3, 0.15), p.lump(15.5, 11, 5.4, 4.4, 5, 0.15));
  p.relief(m, G, p.dome(m, 3), { tex: (x, y) => (noise2(x * 0.7, y * 0.7, 3) > 0.6 ? 0.4 : hash(x, y, 4) > 0.85 ? -0.6 : 0), lift: 0.5 });
  for (let i = 0; i < 9; i++) { const x = Math.round(5 + hash(i, 1, 6) * 14), y = Math.round(7 + hash(i, 2, 6) * 6); if (p.has(x, y)) p.px(x, y, G[5]); }
  p.glow(12, 12, 11, '#7aff7a', 70);
  p.spark(19, 6, '#c8ffb0');
});

// ------------------------------------------------------------------ dune lily bulb (1x1): papery skins, roots, a cut leaf stub
art('plant_dunelily', fp(1, 1), p => {
  const Sk = rp('#3a2a14', '#6a5030', '#987a50', '#c4a676', '#e4cc9e', '#fff4d8');
  for (let i = -3; i <= 3; i++) p.tube(bez([12 + i * 0.6, 19.5], [12 + i * 1.6, 21.5], [12 + i * 2.4, 22.8 - Math.abs(i) * 0.4], 6), 0.5, RP.cream, { spec: 1, lift: 0.2 });
  const m = p.maskFn((x, y) => { const dy = (y + 0.5 - 14) / 6.6, w = 7.4 * Math.sqrt(Math.max(0, 1 - dy * dy)) * (dy < 0 ? 1 + dy * 0.45 : 1); return Math.abs(x + 0.5 - 12) <= w && y >= 6; });
  p.relief(m, Sk, (x, y) => (p.at(m, x, y) ? Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 12) / 7.4) ** 2)) * 4.5 : 0), { spec: 0.97, lift: 0.3 });
  // papery skin lines and a torn flake
  p.fill(m, (x, y) => (Math.abs(x + 0.5 - 12 - (x < 12 ? -1 : 1) * Math.abs(y - 6) * 0.2 * (x < 12 ? 1 : 1) - (x < 12 ? -3 : 3)) < 0.5 && y > 8 ? Sk[1] : -1));
  p.fill(p.maskPoly([14, 10, 18, 9, 17, 15, 14.5, 14]), (x, y) => p.tn(rp('#5a3a1a', '#8a6a3e', '#b89a6a', '#d8c090', '#f0e0b8', '#fff8e0'), 0.75 - (x - 14) * 0.08, x, y, 0.3));
  p.tube([[12, 6.5], [12.4, 2]], 1.6, RP.leaf, { cap: 'flat', lift: 0.3 });
  p.fill(p.maskEllipse(12.4, 2.2, 1.6, 0.7), RP.lime[4]);
});

// ------------------------------------------------------------------ lantern-cap (2x1): a plate-sized cap, its gills glowing sea-green
art('plt_lanterncap', fp(2, 1), p => {
  const Cp = rp('#140c10', '#26181c', '#3c2826', '#584032', '#7a5e40', '#a88a5c');
  const Gi = rp('#0a3a30', '#12644e', '#22966c', '#46c890', '#9cf2c4', '#eafff4');
  // gills beneath the rim (seen from a little below), then the domed cap over them
  const gills = p.maskFn((x, y) => { const dx = (x + 0.5 - 24) / 21.5, dy = (y + 0.5 - 13.5) / 6; return dx * dx + dy * dy <= 1 && y + 0.5 > 13; });
  p.fill(gills, (x, y) => { const a = Math.atan2(y + 0.5 - 9, x + 0.5 - 24); const g = Math.abs(Math.sin(a * 22)) > 0.6; const d = Math.hypot((x + 0.5 - 24) / 21.5, (y + 0.5 - 13.5) / 6); return Gi[g ? (d > 0.7 ? 3 : 4) : d > 0.75 ? 1 : 2]; });
  p.tube([[24, 15], [25, 21.5]], 3, rp('#3a5a50', '#5a8678', '#80aea0', '#a8d2c4', '#d0f0e4', '#ffffff'), { cap: 'flat', lift: 0.4 });
  const cap = p.maskFn((x, y) => { const dx = (x + 0.5 - 24) / 22.5, dy = (y + 0.5 - 13.4) / 11; return dx * dx + dy * dy <= 1 && y + 0.5 <= 13.6; });
  p.relief(cap, Cp, (x, y) => { if (!p.at(cap, x, y)) return 0; const dx = (x + 0.5 - 24) / 22.5, dy = (y + 0.5 - 13.4) / 11; return Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)) * 8; }, { spec: 0.97, lift: 0.3, tex: (x, y) => (noise2(x * 0.3, y * 0.4, 6) > 0.62 ? 0.4 : 0), dither: 0.4 });
  p.fill(cap, (x, y) => (y >= 12 ? Cp[1] : hash(x, y, 2) > 0.94 ? Cp[4] : -1));
  p.glow(24, 16, 16, '#5af0b0', 70);
  p.spark(6, 19, '#b8ffe0');
  p.spark(42, 18, '#b8ffe0');
});

// ------------------------------------------------------------------ ghost fern (1x2): a pale frond that gave up on light
art('plt_ghostfern', fp(1, 2), p => {
  pinnate(p, bez([12, 46], [8.5, 25], [14, 3], 30), { len: t => (t < 0.15 ? 3.5 + t * 22 : 8.4 * (1 - t) ** 0.7 + 1), t0: 0.12, step: 4, ang: 1.15, wid: 1.6, top: RP.ghost, rachis: rp('#6a706c', '#8a908a', '#aab0a8', '#c8cec4', '#e4e8e0', '#ffffff'), serr: true, lift: 0.1 });
  p.glow(12, 22, 13, '#e8fff4', 40);
});

// ------------------------------------------------------------------ hot-spring mat (2x1): a rubbery slab of microbes, green over orange, folded
art('plt_thermomat', fp(2, 1), p => {
  const Gr = rp('#14280c', '#24461a', '#3a6a24', '#5a9030', '#86b842', '#c8e47a');
  const Or = rp('#3a1006', '#6e220c', '#a63e14', '#d6661e', '#f2943a', '#ffd08a');
  // the slab folded over at the right: the orange underside shows on the fold
  const slab = p.maskFn((x, y) => { const top = 7 + Math.sin(x * 0.18) * 1.6 + (x > 30 ? (x - 30) * 0.15 : 0), bot = 18 + Math.sin(x * 0.22 + 1) * 1.2; return x >= 3 && x <= 44 && y >= top && y <= bot; });
  p.relief(slab, Gr, (x, y) => (p.at(slab, x, y) ? 2 + Math.sin(x * 0.4 + y * 0.3) * 0.8 : 0), { spec: 0.94, lift: 0.3, tex: (x, y) => (noise2(x * 0.3, y * 0.5, 4) > 0.65 ? 0.4 : 0) });
  // the layered edge: green on top, then the orange and rust layers below
  p.fill(slab, (x, y) => { const bot = 18 + Math.sin(x * 0.22 + 1) * 1.2; const d = bot - y; return d < 1 ? Or[1] : d < 2 ? Or[3] : d < 3 ? Gr[1] : -1; });
  const fold = p.maskFn((x, y) => { const dx = x + 0.5 - 42, dy = y + 0.5 - 12; return dx > -8 && Math.hypot(dx * 0.9, dy) < 6.5 && y < 15; });
  p.relief(fold, Or, p.dome(fold, 3), { spec: 0.93, lift: 0.4 });
  p.fill(fold, (x, y) => ((x + y) % 3 === 0 ? Or[4] : -1));
  for (const [x, y] of [[12, 10], [26, 9], [36, 12]] as Pt[]) p.droplet(x, y);
  p.steam(18, 6, 5, '#ffffff', 90);
  p.steam(30, 5, 4, '#ffffff', 70, -1);
});

// ------------------------------------------------------------------ cave lichen (1x1): silver rosettes on a chip of limestone
art('plt_cavelichen', fp(1, 1), p => {
  const rock = p.lump(12, 13.5, 10, 7.6, 23, 0.16, -0.1);
  p.relief(rock, RP.limestone, p.dome(rock, 3.4), { tex: stoneTex(23, 0.5, 0.1), lift: 0 });
  const L = rp('#3a4448', '#5e6a6c', '#86928e', '#adb8b0', '#d4ddd2', '#ffffff');
  for (const [cx, cy, r] of [[8, 11, 4.4], [15.5, 14, 4], [10.5, 17.5, 2.8], [16, 8, 2.6]] as [number, number, number][]) {
    const m = Pen.and(rock, p.maskFn((x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx); return Math.hypot(dx, dy) <= r * (0.82 + 0.18 * Math.abs(Math.sin(a * 4))); }));
    p.fill(m, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r; const lobe = Math.sin(Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * 8) > 0.3; return p.tn(L, 0.7 - (x - cx) * 0.04 - (y - cy) * 0.05 + (lobe ? 0.1 : -0.1) - d * 0.2, x, y, 0.4); });
    p.px(cx - 1, cy - 1, L[5]);
  }
});

// ------------------------------------------------------------------ pā vine flower (1x2): blood-red beaked flowers on a creeper
art('plt_pavine', fp(1, 2), p => {
  const vine = bez([5, 46], [18, 30], [9, 4], 24);
  p.tube(vine, 0.8, RP.olive, { spec: 1, lift: 0.2 });
  const vc = curve(vine);
  for (const [t, side] of [[0.18, 1], [0.42, -1], [0.66, 1], [0.86, -1]] as [number, number][]) {
    const q = vc.at(t);
    leafBlade(p, bez([q.x, q.y], [q.x + side * 4, q.y - 2.5], [q.x + side * 7, q.y + 0.5], 8), s => 2.1 * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.05)) + 0.3, RP.leaf, { veins: 0, gloss: true, lift: side < 0 ? 0.3 : -0.2 });
  }
  // kākā-beak flowers hanging in a little cluster: long hooked red tubes, paler at the throat
  const Rf = rp('#2e0408', '#5c0a10', '#94141a', '#c82a24', '#ec5a3a', '#ffb08a');
  for (const [x, y, a, l] of [[12, 20, 0.5, 9], [13.5, 21, 1.1, 8], [10.5, 21.5, 0.0, 8.5], [14, 33, 1.3, 7], [16.5, 33.5, 0.9, 7.5]] as [number, number, number, number][]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) { const s = i / 8; const aa = a + s * 1.5; pts.push([x + Math.sin(aa) * l * s * 0.8, y + Math.cos(aa * 0.6) * l * s]); }
    p.tube(pts, s => 1.5 - s * 0.9, Rf, { spec: 0.95, lift: 0.3 });
    p.px(Math.round(x), Math.round(y), RP.olive[2]);
  }
  p.tube([[9, 4], [6, 3], [5, 5.5], [7, 6.5]], 0.5, RP.olive, { spec: 1 });
});

// ------------------------------------------------------------------ giant fern spores (1x1): a paper twist of rust-brown spores, spilling
art('plt_throatfern', fp(1, 1), p => {
  const P = RP.paper;
  const cone = p.maskPoly([4, 6, 16, 3.6, 20, 20.5, 16.6, 21.6]);
  p.lit(cone, P, (x, y) => 0.72 - (x - 4) * 0.012 + ((x * 2 + y) % 7 === 0 ? -0.1 : 0), 0.4);
  // the twisted tail of the paper and the open mouth full of spores
  p.tube([[18.6, 21], [20, 23], [22, 22.6]], 1.1, P, { lift: 0.2 });
  const mouth = p.maskEllipse(10, 5.2, 6.4, 2.4, -0.2);
  p.fill(mouth, (x, y) => p.tn(RP.rust, 0.55 - (y - 4) * 0.08 + (hash(x, y, 3) > 0.7 ? 0.2 : 0), x, y, 0.5));
  for (let i = 0; i < 14; i++) { const x = Math.round(2 + hash(i, 1, 4) * 8), y = Math.round(7 + hash(i, 2, 4) * 12); if (!p.has(x, y)) p.px(x, y, RP.rust[hash(i, 3, 4) > 0.5 ? 3 : 2]); }
  p.scribble(9, 15, 12, H('#5a4a3a'), 3, cone);
  p.scribble(10, 16, 15, H('#5a4a3a'), 5, cone);
});

// ------------------------------------------------------------------ kelp holdfast (2x1): a tangle of gripping roots, a crab claw and a brittle star arm
art('v10_kelpholdfast', fp(2, 1), p => {
  const K = rp('#120c06', '#261a0c', '#423016', '#624a22', '#866834', '#b8985a');
  // the stipe going off to the right
  p.tube([[24, 11], [36, 8.5], [45, 7]], t => 2.6 - t * 0.8, K, { spec: 0.92, lift: 0.3 });
  // haptera: many branching root-fingers
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.35 + hash(i, 1, 5) * 1.3), l = 7 + hash(i, 2, 5) * 9;
    const x0 = 22 + Math.cos(a) * 2, y0 = 13 + Math.sin(a) * 1.5;
    const pts = bez([x0, y0], [x0 + Math.cos(a) * l * 0.6, y0 + Math.sin(a) * l * 0.4 + 2], [x0 + Math.cos(a) * l, y0 + Math.abs(Math.sin(a)) * l * 0.5 + 5], 10);
    p.tube(pts, t => 1.6 - t * 0.9, K, { spec: 0.94, lift: -0.2 + hash(i, 3, 5) * 0.6 });
  }
  p.ball(22, 12.6, 5, 3.4, K, { spec: 0.92, lift: 0.4 });
  // a little crab claw poking out, and a brittle star's banded arm
  p.ball(13, 16, 2, 1.4, RP.orange, { ang: 0.4, spec: 0.9 });
  p.pts([[11, 15], [10, 14], [11, 17]], RP.orange[3]);
  p.tube(bez([28, 17], [32, 20], [36, 18.5], 10), t => 1 - t * 0.6, rp('#3a1030', '#6a2050', '#9a3a70', '#c86a94', '#eaa4c0', '#fff0f6'), { spec: 0.95, tex: (x) => (x % 2 ? -0.8 : 0) });
  for (const [x, y] of [[18, 8], [27, 10], [38, 9]] as Pt[]) p.droplet(x, y);
});


