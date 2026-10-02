// V11 item art: building materials and raw stuff from the wreck and the shore. Tent canvas, tent poles,
// rope, flax fibre, firewood, stones, planks, scrap metal, kauri resin, copper wire, the battery pack,
// sea glass, kelp, flint, river clay, and Motu Ahi's pumice, obsidian and sulphur.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, ring, curve, grainTex, stoneTex, rope, box3, noise2, fbm2, knurl } from './kit';
import type { Pt, Ramp, Mask } from './kit';

const art = artGroup('Materials');

/** a smooth stone / lump: a noisy ellipse shaded as a dome with an optional texture */
function pebble(p: IP, cx: number, cy: number, rx: number, ry: number, R: Ramp, seed: number, o: { rough?: number; ang?: number; r?: number; spec?: number; tex?: (x: number, y: number) => number; lift?: number } = {}): Mask {
  const m = p.lump(cx, cy, rx, ry, seed, o.rough ?? 0.07, o.ang ?? 0);
  p.relief(m, R, p.dome(m, o.r ?? Math.min(rx, ry) * 0.8), { spec: o.spec ?? 0.97, tex: o.tex, lift: o.lift ?? 0.2, dither: 0.4 });
  return m;
}
/** end grain of a log at (cx, cy): growth rings, radial checks and the bark rim */
function endGrain(p: IP, cx: number, cy: number, rx: number, ry: number, seed: number, bark: Ramp = RP.bark) {
  const m = p.maskEllipse(cx, cy, rx, ry);
  const W = RP.pale;
  p.fill(m, (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.hypot(dx, dy);
    if (d > 0.82) return bark[d > 0.93 ? 1 : 2];
    const a = Math.atan2(dy, dx);
    const ring = (d * 4.2 + noise2(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed) * 0.6) % 1;
    const check = Math.abs(((a + seed) * 3 / Math.PI) % 1 - 0.5) < 0.05 && d > 0.25;
    const l = 0.62 - dx * 0.25 - dy * 0.15 + (ring < 0.22 ? -0.22 : 0) + (check ? -0.35 : 0);
    return p.tn(W, l, x, y, 0.3);
  });
  return m;
}

// ------------------------------------------------------------------ tent canvas (3x1): a rolled, sodden tent with two straps
art('canvas', fp(3, 1), p => {
  const Cv = RP.canvas, cy = 12, r = 9.3, x0 = 10, x1 = 65;
  const body = p.maskFn((x, y) => {
    const ny = (y + 0.5 - cy) / r;
    if (Math.abs(ny) > 1) return false;
    const e = Math.sqrt(Math.max(0, 1 - ny * ny));
    return x + 0.5 >= x0 && x + 0.5 <= x1 + e * 3;
  });
  p.lit(body, Cv, (x, y) => {
    const ny = (y + 0.5 - cy) / r;
    const wet = fbm2(x * 0.09, y * 0.22, 3, 5) > 0.58 ? -0.13 : 0;
    const weave = (x + y) % 2 === 0 ? 0.03 : -0.03;
    return p.cylL(ny) + wet + weave;
  }, 0.6);
  // the outer layer's edge running along the roll, and a brass grommet on its corner
  p.fill(body, (x, y) => { const ny = (y + 0.5 - cy) / r; return Math.abs(ny - 0.42 - Math.sin(x * 0.2) * 0.02) < 0.07 && x > 16 ? Cv[0] : Math.abs(ny - 0.3) < 0.06 && x > 16 ? Cv[4] : -1; });
  ring(p, 58, 15.5, 0.6, 1.7, RP.brass);
  // two webbing straps with buckles
  for (const sx of [24, 50]) {
    const st = p.maskFn((x, y) => x >= sx && x <= sx + 3 && p.at(body, x, y));
    p.lit(st, RP.olive, (x, y) => p.cylL((y + 0.5 - cy) / r) - 0.18 + (x === sx ? 0.08 : 0), 0.4);
    p.slab(p.maskBox(sx - 1, 15, 6, 4), RP.brass, 3);
    p.rect(sx + 1, 16, 2, 2, RP.olive[1]);
  }
  // the end face: the layers of the roll spiralling in to a dark core
  const end = p.maskEllipse(x0, cy, 3.6, r);
  p.fill(end, (x, y) => {
    const dx = (x + 0.5 - x0) / 3.6, dy = (y + 0.5 - cy) / r, d = Math.hypot(dx, dy);
    if (d < 0.16) return Cv[0];
    const a = Math.atan2(dy, dx) / (Math.PI * 2);
    const layer = (d * 5.5 + a) % 1;
    return Cv[layer < 0.25 ? 1 : d > 0.85 ? 3 : 2 + (dy < 0 ? 1 : 0)];
  });
  // drips off the soaked underside
  for (const [x, y] of [[30, 22], [44, 22], [56, 21]] as Pt[]) p.droplet(x, y);
});

// ------------------------------------------------------------------ tent poles (1x3): three shock-corded aluminium poles, a little bent
art('poles', fp(1, 3), p => {
  const Al = RP.aluminium;
  const poles: [Pt, Pt, Pt, number][] = [[[7.5, 3.5], [6, 36], [8.4, 68.5], 1], [[12.4, 2.5], [14.2, 34], [12, 69.5], 2], [[16.8, 4], [18.6, 26], [16.6, 68], 3]];
  for (const [a, c, b, s] of poles) {
    const pts = bez(a, c, b, 40);
    const cv = curve(pts);
    const m = p.tube(pts, 1.6, Al, { spec: 0.9, lift: 0.2 });
    // ferrules at the joints, and the shock cord showing at one pulled joint
    p.fill(m, (x, y) => { const q = cv.loc(x, y); const j = (q.t * 4) % 1; return j < 0.035 ? Al[1] : j < 0.07 ? Al[4] : -1; });
    for (const t of [0, 1]) { const e = cv.at(t); p.ball(e.x, e.y, 1.9, 1.9, RP.rubber, { lift: 0.6 }); }
    if (s === 2) { const q = cv.at(0.75); p.fill(p.maskDisc(q.x, q.y, 1.6), H('#141414')); p.px(q.x, q.y, H('#3a3a3a')); }
  }
  // a velcro strap round the bundle
  const st = p.maskFn((x, y) => y >= 33 && y <= 37 && x >= 4 && x <= 21);
  p.lit(st, RP.red, (x, y) => p.cylV((x + 0.5 - 12.5) / 8.5) + (y === 33 ? 0.12 : y === 37 ? -0.15 : 0), 0.4);
  p.rect(5, 35, 16, 1, RP.red[1]);
});

// ------------------------------------------------------------------ rope (2x2): a coil of three-strand rope, the whipped end hanging out
art('rope', fp(2, 2), p => {
  const Rr = rp('#2a1c0c', '#4c3418', '#755228', '#9c7438', '#c49a52', '#ecd08e');
  const loops = 5;
  const loopPts = (k: number, from: number, to: number): Pt[] => {
    const cx = 24, cy = 31 - k * 3.1, rx = 17.2 - k * 0.35, ry = 8.6 - k * 0.15;
    const out: Pt[] = [];
    for (let i = 0; i <= 26; i++) { const a = from + (to - from) * (i / 26); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return out;
  };
  // the dark well inside the coil
  p.fill(p.maskEllipse(24, 31 - (loops - 1) * 3.1, 12.5, 5.2), H('#1a1008'));
  for (let k = 0; k < loops; k++) rope(p, loopPts(k, Math.PI, Math.PI * 2), 2.7, Rr, { lift: -0.5 + k * 0.12 });
  for (let k = 0; k < loops; k++) {
    const m = rope(p, loopPts(k, 0, Math.PI), 2.7, Rr, { lift: -0.25 + k * 0.12 });
    if (k < loops - 1) p.drop(m, -0.3, 0, -1);
  }
  // the tail: over the front of the coil and down, whipped with twine, frayed at the tip
  const tail = bez([37, 22], [44, 30], [41.5, 44], 18);
  rope(p, tail, 2.5, Rr, { lift: 0.2 });
  const tc = curve(tail);
  for (const t of [0.72, 0.8]) { const q = tc.at(t); p.tube([[q.x - 2.8, q.y], [q.x + 2.8, q.y]], 0.7, RP.cream, { lift: 0.3 }); }
  const e = tc.at(1);
  for (let i = -2; i <= 2; i++) p.line(e.x + i * 0.6, e.y, e.x + i * 1.2, e.y + 2.5, Rr[4 - Math.abs(i)]);
});

// ------------------------------------------------------------------ flax fibre (1x2): a silky hank, tied at the top, twisted once
art('flax', fp(1, 2), p => {
  const F = RP.flaxDry;
  const xc = (y: number) => 12 + Math.sin((y - 4) / 42 * Math.PI) * 1.8;
  const wf = (y: number) => (y < 8 ? 2.2 + (8 - y) * 0.5 : y < 10 ? 2.2 : y < 30 ? 2.4 + Math.sin((y - 10) / 20 * Math.PI) * 4 : 2.6 + (y - 30) * 0.32);
  const hank = p.maskFn((x, y) => y >= 3 && y <= 44 && Math.abs(x + 0.5 - xc(y)) <= wf(y));
  p.lit(hank, F, (x, y) => {
    const k = (x + 0.5 - xc(y)) / wf(y);
    const tw = y > 26 && y < 34 ? (y - 26) * 0.35 : y >= 34 ? 2.8 : 0;
    const strand = Math.floor((k + 1) * 4 + tw + hash(x, y >> 2, 3) * 0.6) % 2;
    return 0.62 - k * 0.32 + (strand ? 0.08 : -0.06) + (Math.abs(k + 0.45) < 0.12 && y > 10 ? 0.3 : 0);
  }, 0.4);
  // the tie: a few turns of darker cord
  for (let y = 8; y <= 10; y++) for (let x = Math.floor(xc(y) - 3); x <= Math.ceil(xc(y) + 3); x++) if (Math.abs(x + 0.5 - xc(y)) <= 3) p.px(x, y, y === 9 ? RP.flax[2] : RP.flax[3]);
  // splayed fibre ends at the bottom
  for (let i = -5; i <= 5; i++) {
    const x0 = xc(44) + i * 0.7, len = 2 + hash(i, 4, 1) * 3;
    for (let k = 0; k < len; k++) p.px(Math.round(x0 + i * k * 0.18), 44 + k, F[clamp(3 - Math.floor(k / 2) + (i < 0 ? 1 : 0), 1, 4)]);
  }
  for (let i = -2; i <= 2; i++) p.px(Math.round(xc(3) + i), 2 - (Math.abs(i) < 2 ? 1 : 0), F[3 + (i < 0 ? 1 : 0)]);
});

// ------------------------------------------------------------------ firewood (2x1): a bundle of three logs tied with flax
function log(p: IP, x0: number, x1: number, cy: number, r: number, R: Ramp, seed: number, smooth = false) {
  const m = p.maskFn((x, y) => x + 0.5 >= x0 && x + 0.5 <= x1 + Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / r) ** 2)) * 1.6 && Math.abs(y + 0.5 - cy) <= r);
  p.lit(m, R, (x, y) => {
    const ny = (y + 0.5 - cy) / r;
    const fis = smooth ? (noise2(x * 0.08, y * 0.9, seed) - 0.5) * 0.2 : (noise2(x * 0.12, y * 1.1, seed) > 0.62 ? -0.22 : 0) + (hash(x >> 2, y, seed) > 0.9 ? -0.15 : 0);
    return p.cylL(ny) + fis;
  }, 0.5);
  endGrain(p, x0, cy, Math.max(1.6, r * 0.42), r, seed, R);
  return m;
}
art('wood', fp(2, 1), p => {
  log(p, 10, 45, 12.6, 4.4, RP.bark, 3);
  log(p, 7, 41, 8.4, 4.2, RP.driftwood, 5, true);
  const a = log(p, 5, 43, 17.6, 4.8, RP.bark, 9);
  p.drop(a, -0.25, 0, -1);
  // the flax tie round the bundle
  for (const lx of [25, 26]) for (let y = 4; y <= 22; y++) if (p.has(lx, y)) p.px(lx, y, lx === 25 ? RP.flax[4] : RP.flax[2]);
  p.px(27, 21, RP.flax[3]); p.px(28, 22, RP.flax[2]);
  // a sprig of lichen on the bark
  p.pts([[33, 14], [34, 14], [33, 15]], H('#9ab88a'));
});

// ------------------------------------------------------------------ stones (1x1): three smooth beach stones
art('stone', fp(1, 1), p => {
  pebble(p, 16.5, 8.5, 5.4, 4.2, RP.basalt, 5, { lift: 0.4 });
  const g = pebble(p, 9.6, 14.6, 8, 5.6, RP.stone, 3, { ang: -0.15, tex: stoneTex(3, 0.3, 0.06), lift: 0.3 });
  p.drop(g, -0.3, 1, 1);
  // a quartz band through the big stone
  p.fill(g, (x, y) => (Math.abs((y - 14.6) + (x - 9.6) * 0.45 - 1) < 0.6 ? H('#e8e4dc') : -1));
  const t = pebble(p, 18.2, 17.4, 4.4, 3.4, RP.brownstone, 7, { tex: (x, y) => (hash(x, y, 7) > 0.84 ? -0.8 : 0) });
  p.drop(t, -0.3, 1, 1);
});

// ------------------------------------------------------------------ planks (1x4): a broken hull board, blue paint flaking, nails
art('plank', fp(1, 4), p => {
  const W = rp('#2a1c12', '#46301e', '#644630', '#866044', '#a87e5c', '#d0aa84');
  const blue = rp('#0c1430', '#16245a', '#233f86', '#3862a8', '#6a92c8', '#b4d0ec');
  const brk = (x: number) => 9 + Math.abs(Math.sin(x * 1.7)) * 4 + (x === 8 ? -5 : x === 13 ? -3 : 0);
  // the front face and the narrow right edge showing its thickness
  const face = p.maskFn((x, y) => x >= 4 && x <= 17 && y <= 90 && y >= brk(x));
  const side = p.maskFn((x, y) => x >= 18 && x <= 20 && y <= 89 - (x - 18) && y >= brk(17) + (x - 18) - 1);
  const grain = (x: number, y: number) => {
    const line = Math.round(x + noise2(y * 0.05, x, 3) * 1.6);
    return (hash(line, Math.floor(y / 7), 3) > 0.7 ? -0.12 : 0) + (noise2(x * 0.6, y * 0.06, 4) - 0.5) * 0.18;
  };
  p.lit(face, W, (x, y) => 0.58 - (x - 4) * 0.012 + grain(x, y), 0.4);
  p.lit(side, W, (x, y) => 0.3 + grain(x, y) * 0.6, 0.3);
  // a knot
  p.fill(p.maskEllipse(11, 62, 2.4, 3.6), (x, y) => { const d = Math.hypot((x + 0.5 - 11) / 2.4, (y + 0.5 - 62) / 3.6); return d < 0.4 ? W[0] : d < 0.75 ? W[1] : W[2]; });
  // old hull paint, chipped back to the wood in patches
  p.fill(face, (x, y) => {
    if (y < 20 || y > 84) return -1;
    const chip = fbm2(x * 0.3, y * 0.12, 3, 8) > 0.6;
    if (chip) return -1;
    const edgeL = x === 4, edgeR = x === 17;
    return blue[edgeL ? 4 : edgeR ? 2 : 3 + (grain(x, y) < -0.05 ? -1 : 0)];
  });
  p.fill(face, (x, y) => (y >= 20 && y <= 84 && fbm2(x * 0.3, y * 0.12, 3, 8) > 0.6 && fbm2(x * 0.3, (y - 1) * 0.12, 3, 8) <= 0.6 ? blue[5] : -1));
  // rusty nails: one bent over at the top, two heads lower down with rust bleeding
  p.tube([[8.6, 27], [8.6, 22.5], [6, 20]], 0.7, RP.rust, { lift: 0.3 });
  for (const [x, y] of [[13, 50], [7, 78]] as Pt[]) {
    p.ball(x + 0.5, y + 0.5, 1.4, 1.4, RP.iron, { lift: 1, spec: 0.9 });
    for (let k = 2; k < 6; k++) p.px(x, y + k, tone(p.get(x, y + k), -0.25 - (k < 4 ? 0.1 : 0)));
  }
  // splinters at the break
  for (const [x, y, l] of [[8, 4, 6], [13, 6, 5], [16, 9, 3]] as [number, number, number][]) for (let k = 0; k < l; k++) p.px(x, y + k, W[k < 2 ? 4 : 3]);
});

// ------------------------------------------------------------------ scrap metal (2x2 L): a rusty angle bracket, bolts, a sprocket and a spring
art('scrap', fp(2, 2, '#.', '##'), p => {
  const S = RP.steel, Rs = RP.rust;
  const rust = (seed: number) => (x: number, y: number) => fbm2(x * 0.25, y * 0.25, 3, seed) > 0.56;
  // the angle bracket: front faces lit, a thin top / right thickness, rust blooms
  const v = p.maskBox(5, 5, 12, 39, 1), hz = p.maskBox(5, 32, 39, 12, 1);
  const thick = p.maskPoly([17, 5, 19, 3.5, 19, 30.5, 17, 32]);
  const thick2 = p.maskPoly([17, 32, 19, 30.5, 46, 30.5, 44, 32]);
  p.lit(Pen.or(thick, thick2), S, () => 0.85, 0.3);
  const br = Pen.or(v, hz);
  p.lit(br, S, (x, y) => 0.55 - (x - 5) * 0.004 - (y - 5) * 0.004 + (hash(x, y, 2) > 0.92 ? 0.15 : 0), 0.5);
  p.fill(br, (x, y) => (rust(4)(x, y) ? Rs[hash(x, y, 5) > 0.6 ? 3 : 2] : -1));
  p.seam(hz, S[1], 1);
  // bolt holes with hex bolts
  for (const [x, y] of [[11, 11], [11, 22], [24, 38], [38, 38]] as Pt[]) {
    p.fill(p.maskDisc(x, y, 3.2), (px, py) => p.tn(S, 0.75 - (px - x) * 0.08 - (py - y) * 0.08, px, py, 0.3));
    p.fill(p.maskPoly([x - 2.5, y - 1, x - 1, y - 2.6, x + 1.4, y - 2.6, x + 2.8, y - 1, x + 1.4, y + 1.6, x - 1, y + 1.6]), (px, py) => p.tn(RP.iron, 0.7 - (px - x) * 0.1 - (py - y) * 0.12, px, py, 0.3));
    p.px(x - 1, y - 1, RP.iron[5]);
  }
  // a little sprocket lying on the bracket
  const gm = p.maskFn((x, y) => { const dx = x + 0.5 - 35, dy = y + 0.5 - 32.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx); return r <= 6.4 + (Math.cos(a * 9) > 0.2 ? 1.4 : 0) && r > 2; });
  p.relief(gm, RP.chrome, (x, y) => (p.at(gm, x, y) ? 1.5 - Math.abs(Math.hypot(x + 0.5 - 35, y + 0.5 - 32.5) - 4.4) * 0.5 : 0), { spec: 0.92, lift: 0.2 });
  p.fill(gm, (x, y) => (rust(9)(x, y) && Math.hypot(x - 35, y - 32) > 5 ? Rs[3] : -1));
  p.drop(gm, -0.35, 1, 1);
  // a coil spring on the upright
  for (let i = 0; i < 6; i++) {
    const y = 9 + i * 2.6;
    p.tube([[7.5, y + 1.6], [14.5, y]], 0.85, RP.chrome, { spec: 0.9, lift: 0.3 });
  }
});

// ------------------------------------------------------------------ kauri resin (1x1): a lump of golden gum with a gnat inside
art('resin', fp(1, 1), p => {
  const A = rp('#4a1c04', '#8a3e08', '#c46c10', '#eca22a', '#fcd25e', '#fff6cc');
  const m = p.lump(12, 13.5, 8.6, 7.4, 7, 0.13, -0.2);
  p.relief(m, A, p.dome(m, 4.5), { spec: 0.955, lift: 0.1, dither: 0.3 });
  // light glowing through the gum on the shadow side
  p.tint(m, (x, y) => { const d = Math.hypot(x + 0.5 - 14.5, y + 0.5 - 16.5); return d < 3.6 ? 0.32 : d < 5.2 ? 0.14 : 0; });
  // a trapped gnat and bubbles
  p.pts([[10, 13], [11, 13], [11, 12], [9, 14], [12, 14]], H('#3a1404'));
  p.px(9, 12, H('#7a3a10'));
  for (const [x, y] of [[15, 11], [7, 17], [14, 18]] as Pt[]) { p.px(x, y, A[5]); p.px(x + 1, y + 1, A[2]); }
  p.glint(8, 9, H('#ffffff'), 0.5);
  p.glow(13, 14, 11, '#ffc850', 48);
});

// ------------------------------------------------------------------ copper wire (1x1): a loose coil, bare and bright, one end still in red insulation
art('wire', fp(1, 1), p => {
  const Cu = RP.copper;
  const loop = (k: number, a0: number, a1: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * (i / 24); out.push([11.6 + k * 0.7 + Math.cos(a) * 8.4, 11.6 + k * 0.9 + Math.sin(a) * 6.2]); }
    return out;
  };
  for (let k = 0; k < 4; k++) p.tube(loop(k, Math.PI, Math.PI * 2), 0.95, Cu, { spec: 0.9, lift: -0.6 + k * 0.1 });
  p.tube([[16, 17], [20.5, 21.5]], 0.95, Cu, { spec: 0.9 });
  p.tube([[18.6, 19.6], [21.5, 22.5]], 1.25, RP.red, { cap: 'flat' });
  for (let k = 0; k < 4; k++) p.tube(loop(k, 0, Math.PI), 0.95, Cu, { spec: 0.88, lift: -0.1 + k * 0.12 });
  p.tube([[4.5, 9], [1.5, 4.5]], 0.85, Cu, { spec: 0.9, lift: 0.4 });
  p.px(1, 4, Cu[5]);
});

// ------------------------------------------------------------------ battery pack (2x1): a sealed boat battery, terminals and a rope handle
art('battery', fp(2, 1), p => {
  const B = rp('#0e1410', '#18221a', '#243228', '#324436', '#465c4a', '#7a9480');
  const b = box3(p, 4, 9, 33, 13, 6, -6, 1);
  p.lit(b.top, B, (x, y) => 0.82 + (hash(x, y, 3) > 0.9 ? -0.08 : 0), 0.3);
  p.lit(b.side, B, (_, y) => 0.32 - (y - 5) * 0.004, 0.3);
  p.lit(b.front, B, (x, y) => 0.5 - (y - 9) * 0.012 - (x - 4) * 0.002, 0.4);
  p.fill(b.front, (x, y) => (y === 9 ? B[5] : -1));
  // the label: a yellow band with a bolt and printed lines
  const lab = p.maskBox(8, 12, 22, 6, 1);
  p.lit(lab, RP.yellow, (x) => 0.66 - (x - 8) * 0.006, 0.3);
  p.pts([[11, 13], [10, 14], [11, 14], [12, 14], [11, 15], [10, 16]], H('#1a1408'));
  for (const y of [14, 16]) p.scribble(15, 27, y, H('#3a2a08'), y);
  // terminals: lead posts with red and black caps
  for (const [x, cap] of [[12, RP.red], [30, RP.iron]] as [number, Ramp][]) {
    p.tube([[x, 7], [x, 4.5]], 1.8, RP.clay, { cap: 'flat', lift: 0.4 });
    p.ball(x, 4.3, 2.2, 1.1, cap, { spec: 0.9, lift: 0.5 });
  }
  p.px(12, 4, H('#ffffff'));
  // the rope handle arcing between the cleats
  const hp = bez([17, 6], [21.5, -0.5], [26.5, 5.5], 14);
  rope(p, hp, 1.1, RP.flaxDry, { lift: 0.4 });
});

// ------------------------------------------------------------------ sea glass (1x1): frosted pebbles of old bottle glass
art('driftglass', fp(1, 1), p => {
  const frost = (seed: number) => (x: number, y: number) => (hash(x, y, seed) > 0.8 ? 0.6 : 0);
  const glass = (cx: number, cy: number, rx: number, ry: number, R: Ramp, seed: number, ang: number) => {
    const m = p.lump(cx, cy, rx, ry, seed, 0.18, ang);
    p.relief(m, R, p.dome(m, 2.6), { spec: 0.985, tex: frost(seed), lift: 0.6, k: 0.7 });
    // translucency: a bright inner rim on the shadow side
    p.fill(m, (x, y) => (!p.at(m, x + 1, y + 1) && p.at(m, x - 1, y - 1) ? R[4] : -1));
    p.drop(m, -0.25, 1, 1);
    return m;
  };
  glass(17, 8.5, 4.6, 3.6, rp('#0e3a3a', '#1a5e5c', '#2a8682', '#4eaea6', '#8ed6cc', '#e2fff8'), 3, 0.4);
  glass(6.8, 7.4, 3.4, 2.8, rp('#5e6a6a', '#848e8c', '#a8b2ae', '#c8d0ca', '#e2e8e2', '#ffffff'), 5, -0.2);
  glass(9.6, 15.4, 6.6, 4.6, rp('#0c2a10', '#164a1c', '#22702a', '#3e963e', '#78c062', '#d4f4b4'), 7, -0.25);
  glass(18, 17.6, 3.8, 3.2, rp('#3a1a04', '#6e3608', '#a65e12', '#d68e2a', '#f2c060', '#fff0c0'), 9, 0.2);
});

// ------------------------------------------------------------------ kelp ribbon (1x2): a wet, ruffled blade with its float and stipe
art('kelp', fp(1, 2), p => {
  const K = rp('#141006', '#2c240c', '#4a3e14', '#6c5c20', '#928032', '#d8c87a');
  const pts = bez([11, 39], [3, 22], [14.5, 3], 30);
  const c = curve(pts);
  const w = (t: number) => (t < 0.08 ? 1.5 + t * 30 : 4.4 * (1 - t) ** 0.25 + 0.5);
  const m = p.maskFn((x, y) => { const q = c.loc(x, y); if (q.t < 0 || q.t > 1) return false; const ww = w(clamp(q.t, 0, 1)) + Math.sin(q.u * 0.9) * 0.9 * (q.t > 0.1 ? 1 : 0); return Math.abs(q.v) <= ww; });
  p.relief(m, K, (x, y) => { if (!p.at(m, x, y)) return 0; const q = c.loc(x, y); return Math.sin(q.u * 0.75) * 0.9 + (1 - Math.abs(q.v) / 5) * 1.6; }, { spec: 0.93, lift: 0.3 });
  // wet shine along the blade
  p.fill(m, (x, y) => { const q = c.loc(x, y); return Math.abs(q.v + 1.2) < 0.5 && Math.sin(q.u * 0.75) > 0.3 ? K[5] : -1; });
  // the gas float and the stipe below it
  p.ball(10.6, 41, 3, 3.2, K, { spec: 0.9, lift: 0.5 });
  p.tube([[10.4, 43.6], [12, 46.6]], 1.1, K, { lift: -0.2 });
  p.glint(9, 39);
  for (const [x, y] of [[6, 24], [13, 12], [9, 32]] as Pt[]) p.droplet(x, y);
});

// ------------------------------------------------------------------ flint nodule (1x1): chalky cortex, a broken glassy face
art('flint', fp(1, 1), p => {
  const m = p.lump(12, 13, 9.2, 7.6, 11, 0.22, 0.1);
  p.relief(m, RP.cream, p.dome(m, 4), { tex: stoneTex(11, 0.7, 0.2), lift: -0.1, spec: 1 });
  // the struck face: dark glossy flint with conchoidal ripples round the strike point
  const face = Pen.and(m, p.maskFn((x, y) => (x - 4) * 0.7 + (y - 4) * 1 < 9.5));
  p.fill(face, (x, y) => {
    const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 6.5);
    const ripple = Math.sin(d * 1.6) > 0.55;
    const l = 0.52 - (x + y - 10) * 0.025 + (ripple ? 0.14 : 0);
    return p.tn(RP.flint, l, x, y, 0.3);
  });
  p.fill(face, (x, y) => (!p.at(face, x + 1, y) || !p.at(face, x, y + 1) ? (p.at(m, x + 1, y + 1) ? RP.flint[4] : -1) : -1));
  p.glint(7, 6, H('#ffffff'), 0.5);
  p.px(10, 8, RP.flint[5]);
});

// ------------------------------------------------------------------ river clay (1x1): a slick grey lump with finger dents
art('clay', fp(1, 1), p => {
  const m = p.lump(12, 14, 9.4, 6.8, 13, 0.08, 0.05);
  const dome = p.dome(m, 4.5);
  const dent = (x: number, y: number) => {
    let d = 0;
    for (const [cx, cy] of [[9, 12], [14.5, 13.2]] as Pt[]) { const q = Math.hypot((x + 0.5 - cx) / 2.4, (y + 0.5 - cy) / 1.5); if (q < 1) d -= (1 - q * q) * 1.8; }
    return d;
  };
  p.relief(m, RP.clayGrey, (x, y) => dome(x, y) + dent(x, y), { spec: 0.955, lift: 0.2, dither: 0.3 });
  for (const [x, y] of [[6, 10], [17, 9]] as Pt[]) p.droplet(x, y);
  p.glint(7, 10, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ pumice (1x1): a pale lump of frozen froth
art('v10_pumice', fp(1, 1), p => {
  const m = p.lump(12, 13, 9.6, 7.4, 17, 0.16, -0.1);
  p.relief(m, RP.pumice, p.dome(m, 4), { lift: 0.3, tex: stoneTex(17, 0.4, 0.05), spec: 1 });
  // vesicles: little pits, shadowed on their upper-left inner edge
  for (let i = 0; i < 26; i++) {
    const x = Math.round(4 + hash(i, 1, 17) * 16), y = Math.round(6 + hash(i, 2, 17) * 14);
    if (!p.at(m, x, y) || !p.at(m, x + 1, y + 1) || !p.at(m, x - 1, y - 1)) continue;
    const big = hash(i, 3, 17) > 0.65;
    p.px(x, y, RP.pumice[0]);
    if (big) { p.px(x + 1, y, RP.pumice[1]); p.px(x, y + 1, RP.pumice[1]); }
    p.px(x + (big ? 2 : 1), y + (big ? 2 : 1), RP.pumice[4]);
  }
});

// ------------------------------------------------------------------ obsidian flake (1x1): black volcanic glass with a razor edge
art('v10_obsidian', fp(1, 1), p => {
  const O = RP.obsidian;
  const m = p.maskPoly([3, 17, 7, 7, 13, 3, 20, 4, 21.5, 9, 17, 16, 9, 21]);
  p.relief(m, O, (x, y) => { const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 18); return 3 - Math.abs(Math.sin(d * 0.9)) * 0.9 - d * 0.08; }, { spec: 0.93, lift: 0.4, slope: 1.4 });
  // conchoidal ripple bands and the bright ridge
  p.fill(m, (x, y) => { const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 18); return Math.abs((d % 3.2) - 1.6) < 0.35 ? tone(p.get(x, y), 0.18) : -1; });
  p.line(8, 15, 18, 6, H('#5a6c8e'));
  p.line(9, 15, 17, 8, O[4]);
  p.glint(12, 9, H('#e8f2ff'), 0.4);
  // the razor edge catches the light
  p.fill(m, (x, y) => (!p.at(m, x - 1, y) || !p.at(m, x, y - 1) ? H('#8aa0c8') : -1));
});

// ------------------------------------------------------------------ sulphur crust (1x1): lemon crystals on grey vent rock
art('v10_sulphur', fp(1, 1), p => {
  const rock = p.lump(12, 16.5, 10, 5.4, 19, 0.14, 0);
  p.relief(rock, RP.ash, p.dome(rock, 3), { tex: stoneTex(19, 0.6, 0.12), lift: -0.4 });
  const Su = RP.sulfur;
  // a cluster of stubby prisms: lit left facet, shaded right facet
  const xs: [number, number, number, number][] = [[7, 14, 2.4, 6], [11, 12, 2.8, 9], [15, 13, 2.4, 7], [18.5, 15, 2, 5], [9, 16.5, 2, 4], [13.5, 16, 2.2, 5]];
  for (const [x, y, w, h] of xs) {
    const m = p.maskPoly([x - w, y, x, y - h, x + w, y, x + w * 0.6, y + 2, x - w * 0.6, y + 2]);
    p.fill(m, (px, py) => { const left = px + 0.5 < x; const tip = py < y - h * 0.55; return Su[left ? (tip ? 5 : 4) : (tip ? 3 : 2)]; });
    p.drop(m, -0.25, 1, 0);
  }
  for (let i = 0; i < 14; i++) { const x = Math.round(3 + hash(i, 1, 19) * 18), y = Math.round(15 + hash(i, 2, 19) * 6); if (p.at(rock, x, y) && !p.has(x, y - 3)) p.px(x, y, Su[3]); }
  p.steam(12, 5, 5, '#e8f070', 90);
});


