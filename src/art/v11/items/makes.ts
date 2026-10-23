// V11 item art: the blueprint materials and makes. Aroha's shaped mānuka fork, a strip of inner-tube
// rubber from the wreck's life ring, a scrap of boat-bag leather, and a clay smoke ball.

import { artGroup, fp, IP, RP, H, rp, hash, noise2, bez } from './kit';
import type { Pt } from './kit';

const art = artGroup('Makes');

// ------------------------------------------------------------------ mānuka fork (1x2): bark stripped, pale heartwood, knife facets
art('manuka_fork', fp(1, 2), p => {
  const Wd = rp('#3a2416', '#5e3c22', '#8a6038', '#b48a56', '#d6b27a', '#f2dcac');
  const grain = (x: number, y: number) => (noise2(x * 1.4, y * 0.22, 9) > 0.7 ? -0.35 : hash(x, y, 4) > 0.94 ? 0.4 : 0);
  p.tube(bez([12, 29], [6, 22], [5, 6], 14), t => 2.1 - t * 0.6, Wd, { lift: 0.3, tex: grain, spec: 0.96 });
  p.tube(bez([12, 29], [18, 22], [19, 6], 14), t => 2.1 - t * 0.6, Wd, { lift: 0.05, tex: grain, spec: 0.96 });
  p.tube([[12, 45], [12.4, 37], [12, 28]], t => 2.7 - t * 0.4, Wd, { lift: 0.2, tex: grain, spec: 0.96 });
  // the cut ends, flat and pale, and a ring of bark left at the foot of the handle
  for (const [x, y] of [[5, 5], [19, 5]] as Pt[]) { p.px(x, y, Wd[5]); p.px(x - 1, y, Wd[4]); p.px(x + 1, y, Wd[4]); }
  for (let x = 9; x <= 15; x++) if (p.has(x, 43)) { p.px(x, 43, RP.bark[2]); p.px(x, 44, RP.bark[1]); }
  // notches cut for the bands
  p.px(4, 8, Wd[0]); p.px(20, 8, Wd[0]);
  p.glint(8, 14, H('#fff4e0'), 0.3);
});

// ------------------------------------------------------------------ inner-tube rubber (1x1): a black strip, coiled once, cut ends
art('rubber_band', fp(1, 1), p => {
  const Rb = RP.rubber;
  const loop: Pt[] = [];
  for (let i = 0; i <= 30; i++) { const a = -0.4 + (i / 30) * Math.PI * 1.85; loop.push([12 + Math.cos(a) * 7.5, 12.5 + Math.sin(a) * 5.2]); }
  p.tube(loop, 1.9, Rb, { lift: 0.4, spec: 0.9 });
  // the loose tail with a square-cut end and the valve stub
  p.tube(bez([12 + Math.cos(-0.4) * 7.5, 12.5 + Math.sin(-0.4) * 5.2], [21, 14], [20, 20], 10), 1.8, Rb, { lift: 0.2, spec: 0.9 });
  p.ball(9, 7.5, 1.4, 1.2, RP.brass, { lift: 0.5 });
  p.glint(7, 9, H('#c8c8d8'), 0);
});

// ------------------------------------------------------------------ leather scrap (1x1): a soft square, cut edges, a stitch line
art('leather_scrap', fp(1, 1), p => {
  const Lt = rp('#2a140a', '#4a2614', '#6e3c20', '#94582e', '#b87a46', '#e0aa74');
  const m = p.lump(12, 12.5, 8.8, 7.6, 3, 0.1, 0.25);
  p.relief(m, Lt, p.dome(m, 3.5), { spec: 0.96, lift: 0.15, dither: 0.3, tex: (x, y) => (hash(x >> 1, y >> 1, 7) > 0.82 ? -0.12 : 0) });
  // a row of stitch holes along one side and a curl at a corner
  for (let x = 6; x <= 17; x += 2) if (p.has(x, 8)) p.px(x, 8, Lt[0]);
  p.px(17, 17, Lt[5]); p.px(18, 16, Lt[4]);
});

// ------------------------------------------------------------------ smoke ball (1x1): a clay ball, kawakawa leaf, flax wick
art('smoke_bomb', fp(1, 1), p => {
  const m = p.lump(12, 14, 7.2, 6.6, 11, 0.06);
  p.relief(m, RP.clay, p.dome(m, 4), { spec: 0.95, lift: 0.2, dither: 0.35, tex: (x, y) => (hash(x, y, 2) > 0.9 ? -0.2 : 0) });
  // a kawakawa leaf pressed into the clay, and the twisted flax wick
  const leaf = p.maskEllipse(9, 12, 3, 2, -0.5);
  p.lit(leaf, RP.leaf, (x, y) => 0.6 - (y - 12) * 0.08, 0.4);
  p.px(9, 12, RP.leaf[0]);
  p.tube(bez([13, 8], [14, 5], [17, 3], 8), 0.7, RP.flaxDry, { lift: 0.3 });
  p.px(17, 3, H('#ffd080'));
});
