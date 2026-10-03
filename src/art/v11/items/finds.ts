// V11 item art: finds. The taonga (pounamu toggle, stone toki, bone matau), the other artifacts (the 1912
// bottle, the Helix tag, the carving rubbing), fossils, rock / soil / water samples, Whaea Mere's kete,
// Joshu's lost compass, cap and log pages, and Crowe's briar pipe.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, curve, ring, stoneTex, noise2, fbm2, jar, tag, rope, weaveTex } from './kit';
import type { Pt, Ramp, Mask, C } from './kit';

const art = artGroup('Finds, taonga & samples');

/** a sheet of paper (polygon) with a soft curl shading and optional ruled lines */
function paper(p: IP, pts: number[], o: { R?: Ramp; ruled?: { dy: number; c: C; x0: number } | null; stain?: number; lift?: number } = {}): Mask {
  const R = o.R ?? RP.paper;
  const m = p.maskPoly(pts);
  p.lit(m, R, (x, y) => 0.72 + (o.lift ?? 0) + Math.sin(x * 0.22 + y * 0.05) * 0.05 + (o.stain && fbm2(x * 0.12, y * 0.12, 3, o.stain) > 0.6 ? -0.16 : 0), 0.4);
  if (o.stain) p.fill(m, (x, y) => { const n = fbm2(x * 0.12, y * 0.12, 3, o.stain!); return Math.abs(n - 0.6) < 0.012 ? RP.ochre[2] : -1; });
  if (o.ruled) { const r = o.ruled; p.fill(m, (x, y) => ((y - 2) % r.dy === 0 && x > r.x0 ? r.c : -1)); }
  return m;
}
/** a drawstring cloth sample bag: a round belly, a gathered neck tied with string, the contents heaped
 *  in the open mouth, a paper tag on the string */
function sampleBag(p: IP, cloth: Ramp, fill: Ramp, seed: number) {
  const belly = p.maskEllipse(11.5, 15.8, 8.6, 7.2);
  const neck = p.maskPoly([8, 4.6, 15, 4.6, 13.6, 10.5, 9.4, 10.5]);
  const m = Pen.or(belly, neck);
  p.relief(m, cloth, p.dome(m, 4), { lift: 0.25, tex: weaveTex(2, 2, 0.3), dither: 0.3 });
  // creases gathered up into the neck
  for (const k of [-2, -1, 1, 2]) p.line(11.5 + k * 1.2, 10, 11.5 + k * 3.4, 15 + Math.abs(k), tone(cloth[2], -0.2));
  // the tie, and the contents heaped in the mouth
  for (let x = 9; x <= 14; x++) { p.px(x, 9, RP.flaxDry[x % 2 ? 2 : 4]); p.px(x, 10, RP.flaxDry[1]); }
  const heap = p.maskEllipse(11.5, 4.8, 3.8, 1.8);
  p.fill(heap, (x, y) => p.tn(fill, 0.62 + (hash(x, y, seed) > 0.7 ? 0.22 : 0) - (x - 11) * 0.06 - (y - 4) * 0.08, x, y, 0.4));
  rope(p, [[14.5, 9.6], [18, 12], [18.6, 14.6]], 0.5, RP.flaxDry, { lift: 0.3 });
  tag(p, 18.6, 14.6, 16, 15, 6, 5);
  for (const [x, y] of [[4, 22], [6, 23], [17, 22]] as Pt[]) p.px(x, y, fill[3]);
  return m;
}

// ------------------------------------------------------------------ Captain's pipe (2x1): briar, an anchor on the bowl, teeth marks on the bit
art('pipe', fp(2, 1), p => {
  const Bw = rp('#1e0c06', '#3a180c', '#5c2a14', '#843e1e', '#ae5a2c', '#d88a50');
  // the stem: briar shank, a brass band, then the black bit with teeth marks
  p.tube([[16, 16], [31, 13.6]], 2.5, Bw, { spec: 0.93, lift: 0.3 });
  const bit = p.tube([[30.5, 13.6], [46, 11]], t => 2.1 - t * 0.9, RP.iron, { spec: 0.9, lift: 0.6 });
  p.fill(bit, (x) => (x === 41 || x === 43 ? RP.iron[1] : -1));
  p.tube([[30, 13.7], [32, 13.4]], 2.7, RP.brass, { cap: 'flat', lift: 0.3 });
  // the bowl: a rounded billiard bowl, the grain swirling round it
  const cx = 11, top = 3.5, R = 8;
  const bowl = p.maskFn((x, y) => { const dx = x + 0.5 - cx; if (y + 0.5 < top) return false; if (y + 0.5 <= 12) return Math.abs(dx) <= R; return Math.hypot(dx, (y + 0.5 - 12) * 1.15) <= R; });
  const dome = p.dome(bowl, 4);
  p.relief(bowl, Bw, (x, y) => (p.at(bowl, x, y) ? Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / R) ** 2)) * 4 + dome(x, y) * 0.4 : 0), { spec: 0.93, lift: 0.3, tex: (x, y) => (Math.sin(Math.hypot(x - 7, y - 19) * 1.3 + noise2(x * 0.3, y * 0.3, 4) * 2.2) > 0.72 ? -0.7 : 0) });
  // the charred rim and the ash inside
  p.fill(p.maskEllipse(cx, top + 0.6, R, 2.4), (x, y) => (Math.hypot((x + 0.5 - cx) / (R - 1.6), (y + 0.5 - top - 0.6) / 1.4) < 1 ? (hash(x, y, 2) > 0.6 ? H('#4a403c') : H('#1a1210')) : Bw[1]));
  // the anchor carved in the front of the bowl
  const A = Bw[0], L = Bw[4];
  p.pts([[11, 8], [11, 9], [11, 10], [11, 11], [11, 12], [11, 13], [11, 14], [10, 9], [12, 9], [9, 13], [13, 13], [8, 12], [14, 12], [10, 14], [12, 14]], A);
  p.pts([[12, 10], [12, 11], [12, 12], [13, 9], [14, 13], [12, 15]], L);
  p.glint(6, 8, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ pounamu toggle (1x1): a greenstone curl, worn smooth by a cord
art('taonga_toggle', fp(1, 1), p => {
  const Pn = RP.pounamu;
  const cx = 11.5, cy = 11.6;
  const m = p.maskFn((x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    // a koru curl: the band's centre radius shrinks as it winds in
    const t = ((a + Math.PI * 0.25) / (Math.PI * 2) + 1) % 1;
    const rc = 7.6 - t * 3.2;
    return (Math.abs(r - rc) < 2.5 - t * 0.6 && !(t > 0.88)) || Math.hypot(dx - 3.2, dy + 1) < 1.9 || (Math.abs(dx - 7) < 2.4 && dy > -1 && dy < 8);
  });
  const dome = p.dome(m, 2.6);
  p.relief(m, Pn, dome, { spec: 0.94, lift: 0.3, dither: 0.3 });
  // translucent depth: light glowing through the thick parts, darker veins in the stone
  p.tint(m, (x, y) => (dome(x, y) > 2.2 && x > 11 ? 0.2 : 0) + (Math.abs(noise2(x * 0.5, y * 0.2, 7) - 0.5) < 0.03 ? -0.35 : 0));
  // the drilled cord hole, worn smooth
  p.fill(p.maskDisc(18.6, 15.5, 1.3), H('#021008'));
  p.px(18, 16, Pn[4]);
  p.spark(17, 5, '#c8ffe0');
});

// ------------------------------------------------------------------ stone toki (1x2): a polished basalt adze head, tang worn by its lashing
art('taonga_toki', fp(1, 2), p => {
  const Bs = rp('#0a0d10', '#151a20', '#222a32', '#36404a', '#58646e', '#b4c2ca');
  const f = frame(14.8, 3, 9.6, 45); // butt -> cutting edge
  const L = f.len;
  // a narrow tang for the lashing, then the body widening to a broad, slightly curved blade
  const w = (u: number) => (u < 9 ? 3.4 : u < 12 ? 3.4 + (u - 9) * 0.5 : 4.9 + (u - 12) / (L - 12) * 2.3);
  const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const edge = L - Math.abs(v) * Math.abs(v) * 0.06; return u >= 0 && u <= edge && Math.abs(v) <= w(Math.max(0, u)); });
  p.fill(m, (x, y) => {
    const [u, v] = f.loc(x, y);
    const k = v / w(Math.max(0, u));
    // faces: a lit left bevel, the flat polished front, a shaded right bevel; the ground blade facet near the edge
    let l = k < -0.72 ? 0.84 : k > 0.72 ? 0.28 : 0.56 - k * 0.1;
    if (u > L - 7) l += 0.18 + (u - (L - 7)) * 0.02;
    if (u < 18) l += (noise2(x * 0.8, y * 0.8, 3) - 0.5) * 0.45; // hammer-dressed, pecked surface
    else l += (noise2(x * 0.3, y * 0.08, 4) - 0.5) * 0.12;
    return p.tn(Bs, l, x, y, 0.4);
  });
  // the lashing groove across the tang, the honed edge, a long polished streak
  p.fill(m, (x, y) => { const [u] = f.loc(x, y); return Math.abs(u - 6) < 0.6 ? Bs[0] : Math.abs(u - 7) < 0.5 ? Bs[4] : -1; });
  p.fill(m, (x, y) => (!p.at(m, x, y + 1) && f.loc(x, y)[0] > L - 3 ? Bs[5] : -1));
  for (let u = 19; u < L - 9; u++) { const [x, y] = f.at(u, -1.8); p.px(x, y, Bs[4]); }
  p.glint(Math.round(f.at(21, -1.8)[0]), Math.round(f.at(21, -1.8)[1]), H('#e8f0f4'), 0.4);
});

// ------------------------------------------------------------------ bone matau (1x1): a fishhook carved from serpent rib, barb turned in
art('taonga_matau', fp(1, 1), p => {
  const Bn = RP.ivory;
  const pts: Pt[] = [[15.5, 4], [15.5, 13], [13.5, 18.5], [9, 19.5], [6, 16.5], [6.5, 11.5]];
  const c = curve(pts);
  const m = p.tube(pts, t => 1.9 - t * 0.6, Bn, { spec: 0.93, lift: 0.4 });
  p.fill(m, (x, y) => (Math.abs(c.loc(x, y).v + 0.6) < 0.3 ? Bn[5] : -1));
  // the inward barb, and the knob carved for the line
  p.tube([[6.6, 11.6], [9.4, 13.4]], t => 1.2 - t * 0.7, Bn, { lift: 0.3 });
  p.ball(15.5, 4.2, 2.4, 2.2, Bn, { spec: 0.9, lift: 0.4 });
  p.fill(p.maskBox(13, 6, 5, 1), Bn[1]);
  // a scrap of the old flax line still knotted on
  rope(p, [[17, 5.5], [20, 4], [21.5, 1.5]], 0.6, RP.flaxDry, { lift: 0.2 });
});

// ------------------------------------------------------------------ message in a bottle (1x2): thick green glass, waxed cork, a rolled letter
art('art_bottle', fp(1, 2), p => {
  const Gl = rp('#06200e', '#0c3a1a', '#145a2a', '#22803c', '#4cb064', '#d0ffd8');
  const body = p.maskFn((x, y) => { const cx = 12; if (y < 8) return Math.abs(x + 0.5 - cx) <= 2.6 && y >= 4; if (y < 16) return Math.abs(x + 0.5 - cx) <= 2.6 + ((y - 8) / 8) ** 1.6 * 5.6; return Math.abs(x + 0.5 - cx) <= 8.2 && y <= 44 - (Math.abs(x + 0.5 - cx) > 6.6 ? 1 : 0); });
  p.fill(body, (x) => H('#1e6a34', x < 10 ? 170 : 210));
  // the rolled letter inside, tied with string, seen through green glass
  const letter = p.maskBox(8, 20, 8, 20, 2);
  p.lit(letter, rp('#3a4a2a', '#5a6a40', '#7e8c5a', '#a2ae7a', '#c6cc9c', '#e8eccc'), (x) => p.cylV((x + 0.5 - 12) / 4), 0.4);
  p.fill(letter, (x, y) => (y === 29 || y === 30 ? H('#5a3a2a') : (y - 20) % 4 === 1 && x > 9 && x < 14 ? H('#6a7454') : -1));
  // glass: dark thick edges, a bright streak, the punt at the base, the lip
  p.fill(body, (x, y) => { const e = !p.at(body, x - 1, y) || !p.at(body, x + 1, y); return e ? (x < 12 ? Gl[3] : Gl[1]) : -1; });
  for (let y = 18; y < 42; y++) { p.blend(5, y, H('#e8fff0', 200)); p.blend(6, y, H('#c8f0d8', 90)); }
  for (let y = 9; y < 14; y++) p.blend(10, y, H('#e8fff0', 180));
  p.fill(p.maskFn((x, y) => y >= 42 && y <= 44 && p.at(body, x, y)), (x) => (x < 12 ? Gl[4] : Gl[2]));
  // the cork under a cap of red sealing wax
  p.slab(p.maskBox(9, 1, 6, 4, 1), RP.pale, 3);
  const wax = p.maskFn((x, y) => y >= 0 && y <= 6 && Math.abs(x + 0.5 - 12) <= 3.6 - (y < 1 ? 0.8 : 0));
  p.relief(wax, RP.red, p.dome(wax, 2), { spec: 0.93, lift: 0.3 });
  p.px(10, 6, RP.red[2]); p.px(14, 7, RP.red[2]);
  // a barnacle on the shoulder
  p.ball(16.5, 17.5, 1.5, 1.3, RP.cream, { lift: 0.5 });
});

// ------------------------------------------------------------------ Helix sample tag (1x1): a yellow tag on a zip tie, barcode and all
art('art_tag', fp(1, 1), p => {
  // the zip tie loop
  const zt = Pen.sub(p.maskEllipse(17, 7.5, 5.4, 5), p.maskEllipse(17, 7.5, 3.8, 3.4));
  p.fill(zt, (x, y) => (y < 7 ? RP.iron[x < 17 ? 3 : 2] : RP.iron[1]));
  const T = p.maskPoly([2, 9, 15, 9, 19, 13, 15, 18, 2, 18]);
  p.relief(T, RP.helix, p.dome(T, 1.5), { spec: 0.96, lift: 0.3 });
  p.fill(p.maskDisc(15.5, 13.5, 1.2), RP.iron[1]);
  // HELIX lettering (blocks), the barcode
  for (let x = 4; x <= 11; x++) if (x !== 6 && x !== 9) { p.px(x, 11, H('#1a1408')); }
  for (let x = 4; x <= 12; x++) { if (hash(x, 1, 3) > 0.35) { p.px(x, 14, H('#1a1408')); p.px(x, 15, H('#1a1408')); p.px(x, 16, H('#1a1408')); } }
  p.px(3, 10, RP.helix[5]);
});

// ------------------------------------------------------------------ rubbing of a carving (2x2): charcoal on notebook paper
art('art_glyphrub', fp(2, 2), p => {
  const sheet = paper(p, [5, 4, 43, 3, 44, 42, 6, 44], { ruled: { dy: 4, c: H('#a8b8c8'), x0: 6 }, lift: 0.05 });
  // torn spiral-binding holes along the top
  for (let x = 8; x < 42; x += 4) { p.px(x, 4, 0); p.px(x + 1, 4, 0); p.px(x, 5, RP.paper[2]); }
  // the rubbing: charcoal over the carving, white where it was cut deep
  const cx = 24.5, cy = 24.5;
  p.fill(sheet, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (r > 17) return -1;
    const a = Math.atan2(dy, dx);
    const spiral = Math.abs(((r - a * 1.2) % 3.8 + 3.8) % 3.8 - 1.9) < 0.6 && r < 7;
    const body = Math.abs(r - 12 - Math.sin(a * 3) * 0.8) < 2.2;
    const cut = spiral || (body && Math.abs(((a * 8 + r * 0.3) % 1 + 1) % 1 - 0.5) < 0.12);
    const smudge = noise2(x * 0.35, y * 0.35, 9) * 0.5 + (hash(x, y, 4) > 0.5 ? 0.12 : 0);
    if (cut) return RP.paper[4];
    const dark = r < 7 ? 0.2 : body ? 0.05 : 0.45;
    return p.tn(RP.charcoal, dark + smudge, x, y, 0.6);
  });
  // the serpent's legs and head, and the dark hole at the centre
  for (const a of [0.6, 2.2, 3.8, 5.2]) { const x0 = cx + Math.cos(a) * 12, y0 = cy + Math.sin(a) * 12; p.line(x0, y0, x0 + Math.cos(a + 0.6) * 4.5, y0 + Math.sin(a + 0.6) * 4.5, RP.paper[4]); }
  p.fill(p.maskDisc(cx, cy, 2.4), RP.charcoal[0]);
  p.ball(cx + 12, cy - 5.5, 2.6, 2, rp('#d8d0b8', '#e4dcc4', '#ece6d0', '#f4eedc', '#fbf8ee', '#ffffff'), { lift: 0.4 });
  p.px(cx + 13, cy - 6, RP.charcoal[0]);
  // a curled-up corner
  p.fill(p.maskPoly([36, 44, 44, 36, 44, 44]), 0);
  p.fill(p.maskPoly([36, 44, 44, 36, 39, 39]), (x, y) => p.tn(RP.paper, 0.5 + (x - 36) * 0.03, x, y, 0.3));
});

// ------------------------------------------------------------------ fossil serpent vertebra (2x2): a stone vertebra the size of a loaf
art('fos_vertebra', fp(2, 2), p => {
  const St = rp('#2a221a', '#4a3e30', '#6e604c', '#948468', '#bcaa88', '#e4d4b4');
  const tex = stoneTex(13, 0.6, 0.1);
  // mudstone matrix still stuck to it
  const mat = p.lump(24, 38, 20, 7, 3, 0.15);
  p.relief(mat, RP.brownstone, p.dome(mat, 3), { tex: stoneTex(3, 0.7, 0.18), lift: -0.4 });
  // transverse processes, the neural arch and spine, the big round centrum
  const wings = p.maskPoly([3, 27, 12, 18, 24, 21, 36, 18, 45, 27, 42, 32, 32, 28, 16, 28, 6, 32]);
  p.relief(wings, St, p.dome(wings, 3), { tex, lift: 0.2 });
  const spine = p.maskPoly([19, 18, 21, 3, 28, 2, 30, 18]);
  p.relief(spine, St, p.dome(spine, 3), { tex, lift: 0.4 });
  p.fill(p.maskEllipse(24.5, 15.5, 3.4, 2.4), St[0]);
  const cen = p.maskEllipse(24.5, 29, 11, 10);
  p.relief(cen, St, p.dome(cen, 6), { tex, lift: 0.3 });
  // the joint cup with growth rings, cracks, and the leg-joint facets the lab noticed
  p.fill(Pen.and(cen, p.maskEllipse(24.5, 29, 7, 6.2)), (x, y) => { const d = Math.hypot((x + 0.5 - 24.5) / 7, (y + 0.5 - 29) / 6.2); return d < 0.4 ? St[1] : Math.abs(d - 0.7) < 0.08 || Math.abs(d - 0.95) < 0.06 ? St[2] : -1; });
  for (const [a, b] of [[[33, 22], [37, 27]], [[13, 23], [9, 28]], [[22, 36], [25, 39]]] as Pt[][]) p.line(a[0], a[1], b[0], b[1], St[0]);
  for (const x of [8, 40]) p.ball(x, 29.5, 2.2, 1.6, St, { lift: 0.8 });
});

// ------------------------------------------------------------------ ammonite (1x1): a coiled shell turned to stone, ribbed like a ram's horn
art('fos_ammonite', fp(1, 1), p => {
  const St = rp('#3a2e22', '#5e4e3c', '#86745a', '#ae9c7c', '#d4c4a2', '#f6eed6');
  const cx = 11.6, cy = 12, k = 0.16;
  const m = p.maskDisc(cx, cy, 10.2);
  const whorl = (x: number, y: number) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.max(0.6, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const w = Math.log(r) / (k * Math.PI * 2) - a / (Math.PI * 2);
    return { f: ((w % 1) + 1) % 1, r, a };
  };
  // each whorl a rounded tube, crossed by curved ribs
  p.relief(m, St, (x, y) => {
    if (!p.at(m, x, y)) return 0;
    const { f, r, a } = whorl(x, y);
    return Math.sin(f * Math.PI) * 2.4 + Math.max(0, Math.cos(a * 16 + Math.log(r) * 5)) * 0.7 * Math.min(1, r / 3);
  }, { spec: 1, lift: 0.3, tex: stoneTex(5, 0.3, 0.05) });
  // the sutures where the whorls meet
  p.fill(m, (x, y) => { const { f } = whorl(x, y); return f < 0.08 || f > 0.95 ? St[0] : -1; });
});

// ------------------------------------------------------------------ fossil fern imprint (2x1): a siltstone slab printed with a frond
art('fos_leaf', fp(2, 1), p => {
  const Sl = rp('#2e2a22', '#4c4638', '#6e6652', '#928a72', '#b6ae94', '#dcd6bc');
  const slab = p.maskPoly([3, 7, 10, 3, 38, 2, 45, 6, 44, 18, 36, 22, 8, 21, 2, 16]);
  p.relief(slab, Sl, p.dome(slab, 2), { tex: stoneTex(7, 0.4, 0.05), lift: 0.4 });
  // the broken edge face along the bottom
  p.fill(slab, (x, y) => (!p.at(slab, x, y + 2) ? Sl[1] : !p.at(slab, x, y + 3) ? Sl[2] : -1));
  // the frond: pressed into the stone, its walls lit like a hollow (dark top-left, bright bottom-right)
  const fc = curve(bez([6, 15], [24, 6], [41, 9], 30));
  const pr = p.mask();
  const mark = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); if (p.at(slab, x, y) && p.at(slab, x, y + 2)) pr[y * p.w + x] = 1; };
  for (let i = 0; i <= 60; i++) { const q = fc.at(i / 60); mark(q.x, q.y); }
  for (let i = 0; i < 11; i++) {
    const t = 0.06 + i * 0.085, q = fc.at(t), L = 5.6 * (1 - t) ** 0.5 + 1.2;
    for (const s of [-1, 1]) for (let kk = 1; kk <= L; kk += 0.5) mark(q.x - q.ty * s * kk + q.tx * kk * 0.7, q.y + q.tx * s * kk + q.ty * kk * 0.7);
  }
  // the print is a thin carbon film: dark brown in the hollow, a lit lip on its lower right
  p.fill(pr, (x, y) => { const tl = !p.at(pr, x - 1, y) || !p.at(pr, x, y - 1), br = !p.at(pr, x + 1, y) || !p.at(pr, x, y + 1); const c = mix(p.get(x, y), H('#2e2012'), 0.62); return tl && !br ? tone(c, -0.4) : br && !tl ? tone(p.get(x, y), 0.3) : c; });
});

// ------------------------------------------------------------------ fossil serpent tooth (1x2): black, curved, grooved, still sharp
art('fos_tooth', fp(1, 2), p => {
  const Bk = rp('#060608', '#101016', '#1c1c26', '#2c2c3a', '#46465a', '#b0b4cc');
  const c = curve(bez([10, 45], [19, 26], [13, 3], 30));
  const m = p.band(c, t => (t < 0.15 ? 3.4 + t * 6 : 4.4 * (1 - t) ** 0.8 + 0.3));
  p.relief(m, Bk, (x, y) => { if (!p.at(m, x, y)) return 0; const q = c.loc(x, y); const w = 4.4 * (1 - clamp(q.t, 0, 1)) ** 0.8 + 0.3; return Math.sqrt(Math.max(0, 1 - (q.v / w) ** 2)) * 3 - (Math.abs(q.v + 0.8) < 0.5 && q.t > 0.25 ? 0.8 : 0); }, { spec: 0.93, lift: 0.5 });
  // the venom groove and the broken root
  p.fill(m, (x, y) => { const q = c.loc(x, y); return Math.abs(q.v + 0.8) < 0.45 && q.t > 0.25 && q.t < 0.85 ? Bk[0] : q.t < 0.1 ? RP.brownstone[2 + (hash(x, y, 3) > 0.5 ? 1 : 0)] : -1; });
  p.glint(17, 22, H('#e8ecff'), 0.4);
});

// ------------------------------------------------------------------ fossil scallop (1x1): a ribbed shell set in cave limestone
art('fos_shell', fp(1, 1), p => {
  const rock = p.lump(12, 13, 10.6, 9, 41, 0.12);
  p.relief(rock, RP.limestone, p.dome(rock, 3), { tex: stoneTex(41, 0.6, 0.15), lift: -0.1 });
  const SH = rp('#5a4a38', '#86745a', '#b09c7e', '#d4c4a4', '#eee4c8', '#fffaec');
  const hx = 11.5, hy = 19.5;
  const sh = Pen.and(rock, p.maskFn((x, y) => { const dx = x + 0.5 - hx, dy = y + 0.5 - hy, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); return Math.abs(a) < 0.98 && r < 13.4 - a * a * 2 - Math.abs(Math.sin(a * 6.5)) * 0.7 && r > 1; }));
  p.fill(sh, (x, y) => {
    const dx = x + 0.5 - hx, dy = y + 0.5 - hy, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy);
    const rib = Math.floor((a + 1) * 6.5) % 2;
    return p.tn(SH, 0.62 + (rib ? 0.16 : -0.12) - (dx + dy) * 0.012 + (Math.sin(r * 1.5) > 0.85 ? -0.14 : 0), x, y, 0.3);
  });
  const ears = Pen.and(rock, Pen.or(p.maskPoly([hx - 1, hy - 1.5, hx - 5.5, hy - 2.5, hx - 5, hy + 0.6, hx - 1, hy + 0.8]), p.maskPoly([hx + 1, hy - 1.5, hx + 5.5, hy - 2.5, hx + 5, hy + 0.6, hx + 1, hy + 0.8])));
  p.lit(ears, SH, (x) => 0.6 - (x - hx) * 0.03, 0.3);
});

// ------------------------------------------------------------------ cave limestone (1x1): a soft pale chip, fizzing in vinegar
art('smp_limestone', fp(1, 1), p => {
  const m = p.lump(11, 13, 9, 7.4, 51, 0.2, 0.3);
  p.relief(m, RP.limestone, p.dome(m, 3), { tex: stoneTex(51, 0.5, 0.05), lift: 0.3 });
  // shell fragments in the stone
  for (let i = 0; i < 10; i++) { const x = Math.round(4 + hash(i, 1, 5) * 14), y = Math.round(8 + hash(i, 2, 5) * 10); if (p.at(m, x, y)) { p.px(x, y, RP.cream[5]); p.px(x + 1, y, RP.cream[3]); } }
  tag(p, 18, 9, 18, 14, 5, 5);
  for (const [x, y] of [[6, 5], [9, 4], [5, 3]] as Pt[]) p.fx.px(x, y, H('#ffffff', 170));
});

// ------------------------------------------------------------------ the water and mud sample jars
art('smp_cavewater', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.tin, level: 0.72,
    fill: (inner, top) => p.fill(inner, (x, y) => (y < top ? -1 : y === top ? H('#c8f0ec', 220) : H(x < 10 ? '#5a9aa8' : '#3a7888', 200))),
    label: { y: 14, h: 5 },
  });
  p.spark(14, 18, '#c8fff0');
});
art('smp_mud', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.tin, level: 0.62,
    fill: (inner, top) => {
      p.fill(inner, (x, y) => (y < top ? -1 : p.tn(RP.mud, 0.45 + (y === top ? 0.4 : 0) - (x - 4) * 0.02 + (hash(x, y, 4) > 0.86 ? 0.2 : 0), x, y, 0.4)));
      p.fill(p.maskDisc(13, top + 4, 1.2), RP.mud[5]);
    },
    label: { y: 16, h: 4 },
  });
});
art('smp_falls', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.tin, level: 0.8, glass: '#c8f0ff',
    fill: (inner, top) => {
      p.fill(inner, (x, y) => (y < top ? -1 : y === top ? H('#e8ffff', 230) : H(x < 10 ? '#8acce0' : '#5aa8c8', 170)));
      p.px(13, 17, RP.yellow[5]); p.px(14, 17, RP.yellow[3]);
    },
    label: null,
  });
  // condensation beading on the cold glass
  for (const [x, y] of [[7, 12], [16, 15], [9, 19], [15, 10]] as Pt[]) p.droplet(x, y);
});
art('smp_hotwater', fp(1, 1), p => {
  jar(p, 4, 3, 16, 20, {
    lid: RP.tin, level: 0.7,
    fill: (inner, top) => p.fill(inner, (x, y) => (y < top ? -1 : y === top ? H('#f0f8e8', 230) : H(x < 10 ? '#a8c8a0' : '#7aa088', 190))),
    label: { y: 14, h: 4 },
  });
  // mineral crust caked on the lid, and steam
  for (let x = 4; x < 20; x++) { const h = Math.floor(hash(x, 1, 6) * 3); for (let k = 0; k < h; k++) p.px(x, 2 - k, k ? H('#e8e0b0') : H('#d0c890')); }
  p.steam(9, 0, 4, '#ffffff', 120);
  p.steam(15, 1, 4, '#ffffff', 100, -1);
});

// ------------------------------------------------------------------ forest soil core (2x1): a clear tube of dark crumbly soil, white threads through it
art('smp_soil', fp(2, 1), p => {
  const tube = p.maskFn((x, y) => x >= 5 && x <= 41 && Math.abs(y + 0.5 - 12) <= 6.6);
  // the soil: dark humus over a browner layer, crumbs and roots, fungal threads
  p.fill(tube, (x, y) => {
    const layer = x < 18 ? RP.poo : x < 31 ? RP.fur : RP.brownstone;
    const n = noise2(x * 0.5, y * 0.6, 4);
    return p.tn(layer, 0.36 + (n - 0.5) * 0.5 - (y - 12) * 0.03, x, y, 0.5);
  });
  p.fill(tube, (x, y) => (Math.abs(noise2(x * 0.25, y * 0.5, 9) - 0.5) < 0.035 ? H('#f0ece0') : -1));
  // clear plastic: the highlight along the top, a darker underside
  p.fill(tube, (_, y) => (y === 7 ? H('#ffffff', 200) : y === 8 ? -1 : y === 18 ? H('#2a2018', 220) : -1));
  for (let x = 6; x < 41; x++) p.blend(x, 8, H('#ffffff', 90));
  // red end caps
  for (const x0 of [2, 41]) { const cm = p.maskBox(x0, 4, 5, 16, 1); p.lit(cm, RP.red, (_, y) => p.cylL((y + 0.5 - 12) / 8), 0.4); }
  p.scribble(14, 26, 12, H('#ffffff', 220), 7, tube);
});

// ------------------------------------------------------------------ volcanic soil sample (1x1): rust-red grit in a cloth bag
art('smp_ash', fp(1, 1), p => { sampleBag(p, RP.canvas, RP.ash, 5); });

// ------------------------------------------------------------------ sulfur crystals (1x1): bright needles grown out of the vent gas
art('smp_sulfur', fp(1, 1), p => {
  const base = p.lump(12, 19.5, 8, 3.4, 61, 0.14);
  p.relief(base, RP.ash, p.dome(base, 2), { tex: stoneTex(61, 0.6), lift: -0.3 });
  const Su = RP.sulfur;
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (i / 12 - 0.5) * 2.4 + (hash(i, 1, 6) - 0.5) * 0.2;
    const l = 8 + hash(i, 2, 6) * 7, x0 = 12 + (hash(i, 3, 6) - 0.5) * 6, y0 = 18;
    const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
    p.tube([[x0, y0], [x1, y1]], t => 1.2 - t * 0.9, Su, { cap: 'flat', spec: 0.88, lift: Math.cos(a + 2.4) * 0.8 });
    p.px(Math.round(x1), Math.round(y1), Su[5]);
  }
  p.steam(18, 6, 4, '#e8f070', 90);
});

// ------------------------------------------------------------------ throat crystal (1x2): cloudy quartz, glowing green in its cracks
art('smp_crystal', fp(1, 2), p => {
  const Q = RP.quartz;
  // a hexagonal prism with a pointed termination: three visible faces, lit left, mid front, dark right
  const L = p.maskPoly([5, 14, 9, 11, 9, 44, 5, 41]);
  const F = p.maskPoly([9, 11, 15, 11, 15, 44, 9, 44]);
  const R = p.maskPoly([15, 11, 19, 14, 19, 41, 15, 44]);
  const T1 = p.maskPoly([5, 14, 9, 11, 12, 2]), T2 = p.maskPoly([9, 11, 15, 11, 12, 2]), T3 = p.maskPoly([15, 11, 19, 14, 12, 2]);
  const cloud = (x: number, y: number) => (noise2(x * 0.3, y * 0.15, 5) - 0.5) * 0.3;
  p.lit(Pen.or(L, T1), Q, (x, y) => 0.82 + cloud(x, y), 0.5);
  p.lit(Pen.or(F, T2), Q, (x, y) => 0.58 + cloud(x, y), 0.5);
  p.lit(Pen.or(R, T3), Q, (x, y) => 0.32 + cloud(x, y), 0.5);
  // the green-glowing cracks and the bright edges between faces
  const crack = p.maskFn((x, y) => Math.abs(noise2(x * 0.35, y * 0.12, 8) - 0.5) < 0.03 && y > 12);
  p.fill(Pen.and(crack, Pen.or(L, F, R)), H('#9cffb0'));
  p.fill(Pen.or(L, F, R, T1, T2, T3), (x, y) => (x === 9 || x === 15 ? (y < 11 ? Q[5] : Q[4]) : -1));
  p.glow(12, 28, 12, '#7aff9a', 60);
  p.spark(7, 6, '#ffffff');
});

// ------------------------------------------------------------------ striped rock sample (1x1): banded grey, red and cream
art('smp_scree', fp(1, 1), p => {
  const m = p.lump(12, 12.6, 9.8, 8.4, 71, 0.18, 0.2);
  const bands = [RP.stone, RP.ash, RP.cream, RP.stone, RP.ochre, RP.clayGrey];
  const dome = p.dome(m, 4);
  p.fill(m, (x, y) => {
    const b = Math.floor(((y - 3) + (x - 12) * 0.35 + noise2(x * 0.2, y * 0.2, 3) * 2) / 3);
    const R = bands[((b % bands.length) + bands.length) % bands.length];
    const gx = (dome(x + 1, y) - dome(x - 1, y)) / 2, gy = (dome(x, y + 1) - dome(x, y - 1)) / 2;
    return p.tn(R, p.lum(-gx, -gy, 1) + (hash(x, y, 7) > 0.85 ? -0.1 : 0), x, y, 0.4);
  });
  p.fill(m, (x, y) => (Math.abs(x - 6 - (y - 4) * 0.4) < 0.5 && y > 8 && y < 18 ? tone(p.get(x, y), -0.3) : -1));
});

// ------------------------------------------------------------------ woven flax bag (2x2): a kete plaited on the diagonal, a band of dyed black diamonds, a plaited strap
art('gift_kete', fp(2, 2), p => {
  const Fx = rp('#3a2c10', '#5e4a1c', '#86702c', '#ae9440', '#d6bc62', '#f4e0a0');
  const Bk = rp('#100c08', '#1e1812', '#2e261c', '#40362a', '#5a4e3e', '#806e58');
  // the strap: a plaited cord looping up from both top corners
  rope(p, bez([9, 21], [24, -7], [39, 21], 30), 1.8, Fx, { period: 3, lift: -0.1 });
  // the body: a soft trapezoid, plaited from strips running both diagonals, over and under
  const body = p.maskPoly([6, 18.6, 42, 18.6, 44.6, 38, 40, 45, 8, 45, 3.4, 38]);
  const dome = p.dome(body, 6);
  p.fill(body, (x, y) => {
    const a = Math.floor((x + y) / 3), b = Math.floor((x - y + 99) / 3);
    const over = (a + b) & 1;
    const across = over ? (x + y) % 3 : (x - y + 99) % 3;
    let l = 0.52 + (over ? 0.07 : -0.05) + (across === 0 ? -0.2 : across === 1 ? 0.1 : 0.03);
    const gx = (dome(x + 1, y) - dome(x - 1, y)) / 2, gy = (dome(x, y + 1) - dome(x, y - 1)) / 2;
    l += (p.lum(-gx, -gy, 1) - 0.62) * 0.9;
    // the paru-dyed strips: a band of black diamonds across the middle
    const dyed = y >= 26 && y <= 35 && Math.abs(((x + 999) % 10) - 5) + Math.abs(y - 30.5) < 5 && Math.abs(((x + 999) % 10) - 5) + Math.abs(y - 30.5) > 2;
    return p.tn(dyed ? Bk : Fx, l, x, y, 0.25);
  });
  // the rolled rim along the top, and little tassels at the bottom corners
  rope(p, [[5.5, 19.4], [42.5, 19.4]], 1.5, Fx, { period: 2.6, lift: 0.2 });
  for (const [x, y, d] of [[5, 38, -1], [43, 38, 1]] as number[][]) for (let k = 0; k < 6; k++) p.px(x + d * (k > 2 ? 1 : 0), y + k + 1, Fx[k < 3 ? 3 : 2]);
});

// ------------------------------------------------------------------ Joshu's brass compass (1x1): open, the needle swinging, a photo in the lid
art('joshu_compass', fp(1, 1), p => {
  const Br = RP.brass;
  // the lid hinged open behind, with a little sepia photo
  const lid = p.maskEllipse(12, 7, 9, 5.4);
  p.relief(lid, Br, p.dome(lid, 2), { spec: 0.93, lift: -0.1 });
  p.fill(p.maskEllipse(12, 6.8, 6, 3.4), (x, y) => p.tn(rp('#3a2a1a', '#5a4630', '#86704e', '#b09a74', '#d8c49c', '#f4e8cc'), 0.6 - Math.hypot(x - 12, y - 6.5) * 0.06, x, y, 0.4));
  p.pts([[11, 6], [12, 6], [11, 7], [12, 7], [10, 8], [13, 8]], H('#4a3420'));
  // the case and the face: cream dial, cardinal ticks, red needle
  const cs = p.maskEllipse(12, 15.6, 9.6, 7);
  p.relief(cs, Br, p.dome(cs, 2.4), { spec: 0.92, lift: 0.3 });
  const face = p.maskEllipse(12, 15.4, 7.2, 5);
  p.fill(face, (x, y) => p.tn(RP.cream, 0.75 - (x - 12) * 0.03 - (y - 15) * 0.04, x, y, 0.3));
  for (const [x, y] of [[12, 11], [12, 19], [5, 15], [18, 15]] as Pt[]) p.px(x, y, H('#2a1a10'));
  p.line(9, 18, 12, 15, H('#2a2a3a')); p.line(12, 15, 15, 12, H('#d0302a')); p.px(15, 12, H('#ff6a4a'));
  p.px(12, 15, Br[5]);
  // the scratched K on the lid rim
  p.pts([[4, 5], [4, 6], [4, 7], [5, 6], [6, 5], [6, 7]], Br[1]);
  p.glint(8, 12, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ Joshu's spare cap (2x1): the red skipper's cap, salt-stiff, the brim chewed
art('joshu_cap', fp(2, 1), p => {
  const Cr = RP.cap;
  // the brim (in front, lower right), then the crown over it
  const brim = p.maskFn((x, y) => { const dx = (x + 0.5 - 33) / 13.5, dy = (y + 0.5 - 17.6) / 4.2; return dx * dx + dy * dy <= 1 && !(x > 42 && y < 17 && hash(x, y, 3) > 0.3) && x > 22; });
  p.relief(brim, rp('#140c0a', '#241612', '#38221a', '#4e3224', '#6a4632', '#8a6448'), p.dome(brim, 2), { lift: 0.3 });
  // chew marks: notches out of the brim's edge
  for (const x of [38, 41, 44]) { p.px(x, 21, 0); p.px(x + 1, 21, 0); p.px(x, 20, 0); }
  const crown = p.maskFn((x, y) => { const dx = (x + 0.5 - 21) / 17, dy = (y + 0.5 - 16.5) / 13.5; return dx * dx + dy * dy <= 1 && y + 0.5 <= 17.4; });
  p.relief(crown, Cr, p.dome(crown, 7), { lift: 0.1, tex: (x, y) => ((x + y) % 2 ? 0.08 : -0.08), dither: 0.4 });
  // panel seams, the button on top, the anchor badge, salt crust
  for (const a of [-0.55, 0.15]) p.tube(bez([21, 3.5], [21 + Math.sin(a) * 14, 8], [21 + Math.sin(a) * 18, 16.5], 12), 0.4, Cr, { lift: -1.5 });
  p.ball(21, 3.6, 1.8, 1.2, Cr, { lift: 0.6 });
  p.fill(p.maskFn((x, y) => y === 16 || y === 17), (x, y) => (p.at(crown, x, y) ? Cr[1] : -1));
  const A = RP.brass[4];
  p.pts([[27, 8], [27, 9], [27, 10], [27, 11], [27, 12], [26, 9], [28, 9], [25, 11], [29, 11], [26, 12], [28, 12]], A);
  p.fill(crown, (x, y) => (fbm2(x * 0.18, y * 0.25, 3, 9) > 0.62 ? mix(p.get(x, y), H('#f4ece0'), 0.55) : -1));
});

// ------------------------------------------------------------------ pages of the Kittiwake's log (2x2): three soggy pages in Joshu's hand
art('joshu_log', fp(2, 2), p => {
  const ink = H('#2a3a5a'), rule = H('#b4a890');
  // three pages fanned and overlapping, water-stained and wavy
  paper(p, [12, 2, 44, 6, 41, 40, 9, 36], { ruled: { dy: 4, c: rule, x0: 12 }, stain: 3, lift: -0.08 });
  paper(p, [3, 7, 35, 4, 37, 40, 5, 43], { ruled: { dy: 4, c: rule, x0: 4 }, stain: 5, lift: -0.02 });
  const top = paper(p, [6, 12, 38, 10, 40, 45, 8, 46], { ruled: { dy: 4, c: rule, x0: 7 }, stain: 7, lift: 0.04 });
  // the log columns, Joshu's handwriting, and the last underlined entry
  p.fill(top, (x) => (x === 14 ? H('#c86a5a') : -1));
  for (let y = 15; y < 42; y += 4) p.scribble(16, 36 - (y > 33 ? 6 : 0), y - 1, ink, y, top);
  for (let x = 16; x < 33; x++) p.px(x, 41, ink);
  // a torn corner, a ring stain from a mug
  p.fill(p.maskPoly([38, 10, 40, 10, 40, 14]), 0);
  p.fill(Pen.and(top, Pen.sub(p.maskEllipse(30, 22, 5.4, 4.6), p.maskEllipse(30, 22, 4.4, 3.6))), (x, y) => tone(p.get(x, y), -0.25));
});
