// V11 item art: the tool belt. Field camera, pocket knife, specimen jar, bug net, trowel, tweezers,
// lab gloves, claw hammer, headlamp, the cracked phone, the ghillie cape and Crowe's binoculars.

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, ring, glassLens, grainTex, jar, curve, box3, knurl } from './kit';
import type { Pt, Ramp, Mask } from './kit';

const art = artGroup('Tools');

const lit = (p: IP, m: Mask, R: Ramp, l: (x: number, y: number) => number, d = 0.5) => p.lit(m, R, l, d);

// ------------------------------------------------------------------ field camera (2x2): 3/4 view from the front-left, long lens toward us
art('camera', fp(2, 2), p => {
  const I = RP.iron, Cr = RP.chrome, Rb = RP.rubber;
  const leather = (x: number, y: number) => { const n = hash(x >> 1, (y + (x >> 1)) >> 1, 31); return n > 0.8 ? -0.09 : n < 0.12 ? 0.06 : 0; };
  // the body: silver top plate on top, leatherette front and left side
  const b = box3(p, 9, 17, 35, 26, -5, -4, 2);
  lit(p, b.top, Cr, (x, y) => 0.78 + (y < 15 ? -0.1 : 0) + (hash(x, y, 4) > 0.93 ? 0.15 : 0) + ((x + y * 4) % 13 === 0 ? -0.12 : 0), 0.3);
  lit(p, b.side, I, (x, y) => (y < 19 - (9 - x) * 0.8 ? 0.82 : 0.58 + leather(x, y)), 0.4);
  lit(p, b.front, I, (x, y) => (y < 21 ? 0.62 - (y - 17) * 0.05 : 0.4 - (y - 21) * 0.006 - (x - 9) * 0.002 + leather(x, y)), 0.5);
  p.fill(b.front, (x, y) => (y === 17 ? Cr[5] : y === 21 ? I[1] : -1));
  p.fill(b.side, (x, y) => (Math.abs(y - (17 - (9 - x) * 0.8)) < 0.6 ? Cr[4] : -1));
  // the rubber grip bulging out of the front at the left
  const grip = p.maskBox(9, 21, 9, 22, 3);
  p.relief(grip, I, p.dome(grip, 4), { lift: 0.5, tex: (x, y) => ((x + y * 2) % 4 === 0 ? -0.6 : 0) });
  p.fill(grip, (x, y) => (x === 10 && y > 23 && y < 40 ? I[4] : -1));
  p.seam(grip, I[0], 8);
  // viewfinder hump set back on the top plate, with the hot shoe; mode dial and shutter button
  const hb = box3(p, 19, 7, 13, 8, -3, -3, 1);
  lit(p, hb.top, I, () => 0.7, 0.3);
  lit(p, hb.side, I, () => 0.55, 0.3);
  lit(p, hb.front, I, (x, y) => 0.42 - (y - 7) * 0.02 + leather(x, y), 0.4);
  p.slab(p.maskPoly([20, 6, 29, 6, 27, 4, 18, 4]), Cr, 3, { bevel: false });
  p.rect(20, 5, 8, 1, I[1]);
  p.px(21, 9, H('#d8402c'));
  p.ball(36, 12.4, 3.4, 1.4, Cr, { spec: 0.9, lift: 0.6 });
  const dial = p.maskBox(33, 13, 7, 3);
  p.fill(dial, (x, y) => (y === 15 ? Cr[1] : Cr[(x % 2 ? 2 : 3) + (x < 35 ? 1 : 0)]));
  p.ball(13, 14.6, 2.6, 1.2, Cr, { spec: 0.88, lift: 0.5 });
  p.rect(11, 15, 5, 1, Cr[1]);
  ring(p, 6, 19, 0.5, 1.7, Cr);
  // scuffs: bare metal on the corners
  p.pts([[43, 18], [43, 19], [42, 41], [10, 41], [5, 37]], I[4]);
  // the lens throws shade on the body below it
  p.occlude(34, 37, 13, 9, 0.35);
  // long lens: the barrel's lit top-left flank with its zoom ring, then the front: hood rim, name ring, glass
  const M: Pt = [28, 29], F: Pt = [31.6, 32.6], R = 11.4;
  const vx = F[0] - M[0], vy = F[1] - M[1], L2 = vx * vx + vy * vy;
  const barrel = p.maskFn((x, y) => {
    const t = clamp(((x + 0.5 - M[0]) * vx + (y + 0.5 - M[1]) * vy) / L2, 0, 1);
    return Math.hypot(x + 0.5 - M[0] - vx * t, y + 0.5 - M[1] - vy * t) <= R;
  });
  lit(p, barrel, I, (x, y) => p.lum(x + 0.5 - F[0], y + 0.5 - F[1], 4) + 0.18, 0.6);
  knurl(p, Pen.sub(barrel, p.maskDisc(F[0], F[1], R)), F[0], F[1], 14, -0.4);
  p.px(24, 21, H('#e04a34'));
  ring(p, F[0], F[1], 9.4, R, I, { lift: 0.4 });
  ring(p, F[0], F[1], 7.9, 9.4, I, { lift: -0.8 });
  for (let k = 0; k < 9; k++) { const a = -2.9 + k * 0.26; p.px(F[0] + Math.cos(a) * 8.6, F[1] + Math.sin(a) * 8.6, k === 4 ? H('#e8c040') : H('#d8dce0')); }
  ring(p, F[0], F[1], 7, 8, Cr);
  glassLens(p, F[0], F[1], 7);
});

// ------------------------------------------------------------------ pocket knife (1x2)
art('knife', fp(1, 2), p => {
  const f = frame(6.6, 45.6, 17.8, 3.2); // butt -> tip
  const L = f.len, b0 = 21.4;
  const S = RP.steel, Cr = RP.chrome;
  const prof = (u: number) => {
    const t = (u - b0) / (L - b0);
    return { t, spine: -2.2 + (t > 0.66 ? ((t - 0.66) / 0.34) ** 1.6 * 2.2 : 0), edge: 2.8 - Math.pow(t, 2.3) * 2.8 };
  };
  const blade = p.maskFn((x, y) => {
    const [u, v] = f.loc(x, y);
    if (u < b0 || u > L) return false;
    const q = prof(u);
    return v >= q.spine && v <= q.edge;
  });
  // polished flat (light toward the spine, a long glint), dark grind line, bright honed bevel
  p.fill(blade, (x, y) => {
    const [u, v] = f.loc(x, y);
    const q = prof(u);
    const k = (v - q.spine) / Math.max(0.6, q.edge - q.spine);
    if (k > 0.86) return S[5];
    if (k > 0.7) return S[4];
    if (k > 0.56) return S[1];
    if (k < 0.16) return S[3];
    if (k < 0.42 && q.t > 0.12 && q.t < 0.7) return S[5];
    return k < 0.42 ? S[4] : S[2];
  });
  const [nx, ny] = f.at(24.6, -1.1);
  p.px(nx, ny, S[0]); p.px(nx + 1, ny, S[1]);
  // bolster, red scales with two rivets, steel liner, a key-ring shackle
  p.tube([f.at(18.6, 0), f.at(22, 0)], 3.3, Cr, { cap: 'flat' });
  const hm = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return u >= 0.6 && u <= 19 && Math.abs(v) <= 3.1 - (u < 2.6 ? (2.6 - u) * 0.5 : 0); });
  p.relief(hm, RP.red, p.dome(hm, 2.6), { spec: 0.95, lift: 0.4 });
  p.fill(hm, (x, y) => { const [, v] = f.loc(x, y); return v > 2.3 ? Cr[2] : -1; });
  for (const u of [5.2, 14.4]) { const [x, y] = f.at(u, -0.3); p.px(x, y, Cr[4]); p.px(x + 1, y + 1, RP.red[1]); p.px(x + 1, y, Cr[2]); }
  const [sx, sy] = f.at(-0.6, 0);
  ring(p, sx, sy, 0.7, 1.9, Cr);
});

// ------------------------------------------------------------------ specimen jar (1x1)
art('jar', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.brass, level: 0.32,
    fill: (inner, top) => {
      // damp moss on the floor, a fern sprig and a little violet beetle
      p.fill(inner, (x, y) => (y >= top ? RP.moss[y === top ? 4 : hash(x, y, 3) > 0.55 ? 3 : 2] : -1));
      p.tube([[9.5, top + 0.5], [10, 12], [12.5, 8.6]], 0.55, RP.fern, { spec: 1 });
      p.ball(8.7, 11.6, 1.8, 1, RP.lime, { ang: -0.5, spec: 1 });
      p.ball(13.6, 10, 1.7, 0.9, RP.lime, { ang: 0.6, spec: 1 });
      p.ball(14.6, top - 1.2, 1.7, 1.3, RP.violet, { spec: 0.88 });
      p.pts([[13, top - 1], [16, top - 1], [13, top], [16, top]], RP.violet[0]);
    },
    label: null,
  });
});

// ------------------------------------------------------------------ bug net (2x3, the handle hangs down the left)
art('net', fp(2, 3, '##', '##', '#.'), p => {
  const cx = 28.5, cy = 17, rx = 16, ry = 11.5, ang = -0.42;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const el = (x: number, y: number, k = 1) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; const u = (dx * ca + dy * sa) / (rx * k), v = (-dx * sa + dy * ca) / (ry * k); return u * u + v * v; };
  // the sack hangs from the hoop's lower rim, tapering to a rounded tail
  const sack = p.maskFn((x, y) => {
    if (el(x, y) <= 1) return true;
    const c = curve([[cx + 2, cy + 4], [cx + 6, cy + 18], [cx + 9, cy + 27]]).loc(x, y);
    return c.t >= 0 && c.t <= 1.04 && Math.abs(c.v) <= 13.5 * (1 - c.t) ** 0.8 + 2.4 && y > cy - 2;
  });
  p.fill(sack, (x, y) => {
    const inside = el(x, y, 0.92) <= 1;
    const th = (x + y) % 5 === 0 || ((x - y) % 5 + 5) % 5 === 0;
    const l = clamp(1 - ((x - 12) * 0.5 + (y - 2) * 1.1) / 52, 0, 1);
    if (!th) return inside ? H('#f2f4ee', 22) : H('#dfe4de', 44);
    return inside ? mix(H('#6e7876', 230), H('#c8ccc4', 230), l) : mix(H('#8a9290'), H('#fbfbf4'), l);
  });
  // a few folds down the sack
  for (const [x0, y0, x1, y1] of [[34, 30, 37, 42], [40, 26, 41, 36], [27, 29, 31, 40]]) p.line(x0, y0, x1, y1, H('#9aa29e', 200));
  // the hoop: a steel ring seen at an angle, the sack's hem stitched round it
  const hoop = p.maskFn((x, y) => { const e = el(x, y); return e <= 1 && e >= 0.8; });
  p.fill(hoop, (x, y) => { const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const l = 0.55 + Math.cos(a + 2.4) * 0.4 + (el(x, y) > 0.9 ? 0.1 : -0.1); return p.tn(RP.chrome, l, x, y, 0.4); });
  // ash handle with a brass ferrule and a cord-wrapped grip
  const hs: Pt = [16.6, 26.5], he: Pt = [6.6, 69];
  const hf = frame(he[0], he[1], hs[0], hs[1]);
  p.tube([he, hs], 2.2, RP.pale, { tex: grainTex(hf.ux, hf.uy, 7, 0.9), lift: 0.2 });
  p.tube([hf.at(hf.len - 5, 0), hf.at(hf.len + 0.6, 0)], 2.6, RP.brass, { cap: 'flat' });
  const wrap = p.tube([hf.at(1.2, 0), hf.at(13, 0)], 2.7, RP.olive, { cap: 'flat', tex: (x, y) => ((x + y * 2) % 3 === 0 ? -1.2 : 0.2) });
  p.seam(wrap, RP.olive[0], 3);
  p.tube([hf.at(-0.6, 0), hf.at(1.4, 0)], 2.9, RP.brass, { cap: 'flat' });
});

// ------------------------------------------------------------------ trowel (1x2)
art('trowel', fp(1, 2), p => {
  const f = frame(10.4, 46, 13.6, 2.4); // butt -> tip
  const S = RP.steel, L = f.len, b0 = 22;
  const wf = (u: number) => { const t = (u - b0) / (L - b0); return t < 0.2 ? 3 + (t / 0.2) * 3.8 : 6.8 * Math.pow(1 - (t - 0.2) / 0.8, 0.85) + 0.35; };
  const blade = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return u >= b0 && u <= L && Math.abs(v) <= wf(u); });
  // a dished blade: the left half lit, a bright crease down the middle, soil on the tip
  p.fill(blade, (x, y) => {
    const [u, v] = f.loc(x, y);
    const k = v / wf(u);
    if (Math.abs(k) > 0.86) return k < 0 ? S[4] : S[1];
    if (k > -0.12 && k < 0.08) return S[5];
    if (k >= 0.08 && k < 0.3) return S[1];
    return k < 0 ? (k < -0.55 ? S[4] : S[3]) : S[2];
  });
  for (let i = 0; i < 26; i++) {
    const u = L - 1 - hash(i, 1, 4) * 9, v = (hash(i, 2, 4) - 0.5) * 2 * wf(u) * 0.9;
    const [x, y] = f.at(u, v);
    p.paint(x, y, hash(i, 3, 4) > 0.5 ? RP.fur[1] : RP.fur[2]);
  }
  const [sx, sy] = f.at(L - 3.5, -1); p.paint(sx, sy, RP.fur[3]);
  // neck, brass ferrule, turned wooden handle
  p.tube([f.at(17.5, 0), f.at(22.6, 0)], 1.2, S);
  p.tube([f.at(14.8, 0), f.at(18.4, 0)], 2.7, RP.brass, { cap: 'flat' });
  const hm = p.tube([f.at(0.6, 0), f.at(15, 0)], u => 2.6 + Math.sin(u * Math.PI) * 0.7, RP.wood, { tex: grainTex(f.ux, f.uy, 5, 0.9), lift: 0.2 });
  p.fill(hm, (x, y) => { const [u] = f.loc(x, y); return Math.abs(u - 3.2) < 0.6 ? RP.wood[1] : -1; });
  p.glint(Math.round(f.at(30, -3)[0]), Math.round(f.at(30, -3)[1]), H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ tweezers (1x2), holding a plucked tuft
art('tweezers', fp(1, 2), p => {
  const S = RP.chrome;
  // two springy flat arms welded at the top, bowing apart and pinching at the tips
  const arms = [bez([16.4, 4], [10.4, 21], [8, 39.4], 32), bez([18.6, 4.6], [19.6, 22], [9.6, 40.2], 32)];
  for (const a of arms) {
    const c = curve(a);
    const m = p.tube(a, t => 1.45 - t * 0.7, S, { cap: 'flat', spec: 0.93, flat: 0.35, lift: 0.3 });
    p.fill(m, (x, y) => { const q = c.loc(x, y); return q.t > 0.34 && q.t < 0.54 && Math.round(q.u) % 2 === 0 && q.v > 0 ? S[1] : -1; });
  }
  p.ball(17.5, 4.4, 2.4, 1.8, S, { spec: 0.9, lift: 0.3 });
  // a barred down feather caught in the tips
  const fm = p.tube(bez([8.8, 40], [5.8, 41.8], [3.4, 46.4], 12), t => 1.9 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.15)) + 0.3, RP.cream, { spec: 1, lift: 0.4 });
  p.fill(fm, (x, y) => ((x + y * 2) % 4 === 0 ? RP.fur[3] : -1));
  p.px(4, 46, RP.cream[4]); p.px(2, 46, RP.cream[3]); p.px(6, 45, RP.cream[2]);
});

// ------------------------------------------------------------------ lab gloves (2x2): a pair, one over the other
function glove(p: IP, ox: number, oy: number, ang: number, s: number, mirror: number, N: Ramp, lift: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const loc = (x: number, y: number): Pt => { const dx = (x + 0.5 - ox) / s, dy = (y + 0.5 - oy) / s; return [(dx * ca + dy * sa) * mirror, -dx * sa + dy * ca]; };
  const seg = (u: number, v: number, a: Pt, b: Pt) => {
    const vx = b[0] - a[0], vy = b[1] - a[1], t = clamp(((u - a[0]) * vx + (v - a[1]) * vy) / (vx * vx + vy * vy), 0, 1);
    return Math.hypot(u - a[0] - vx * t, v - a[1] - vy * t);
  };
  const fingers: [Pt, Pt, number][] = [[[-5.2, -3], [-6.3, -14], 2.15], [[-1.7, -4], [-2, -16.2], 2.25], [[1.9, -4], [2.5, -15], 2.15], [[5.2, -2.4], [6.5, -11], 1.9]];
  const thumb: [Pt, Pt, number] = [[-6, 4], [-12, -2.6], 2.4];
  const palm = (u: number, v: number) => Math.abs(u) <= 7.2 && v >= -5 && v <= 9.5 && !(Math.abs(u) > 5 && v < -3.5 && Math.hypot(Math.abs(u) - 5, v + 3.5) > 2.2);
  const cuff = (u: number, v: number) => v >= 8.5 && v <= 17.5 && Math.abs(u) <= 6.4 + (v - 8.5) * 0.14;
  const fm = fingers.map(([a, b, r]) => p.maskFn((x, y) => { const [u, v] = loc(x, y); return seg(u, v, a, b) <= r; }));
  const tm = p.maskFn((x, y) => { const [u, v] = loc(x, y); return seg(u, v, thumb[0], thumb[1]) <= thumb[2]; });
  const pm = p.maskFn((x, y) => { const [u, v] = loc(x, y); return palm(u, v); });
  const cm = p.maskFn((x, y) => { const [u, v] = loc(x, y); return cuff(u, v); });
  const all = Pen.or(pm, cm, tm, ...fm);
  p.relief(all, N, p.dome(all, 4), { spec: 0.94, lift });
  for (const m of [...fm, tm]) p.seam(m, N[1], 15);
  // rolled cuff edge, knuckle creases
  p.fill(cm, (x, y) => { const [, v] = loc(x, y); return v > 16 ? N[4] : v > 15 ? N[2] : -1; });
  p.fill(pm, (x, y) => { const [u, v] = loc(x, y); return Math.abs(v + 3.2) < 0.5 && Math.abs(u) < 6 && (Math.round(u) & 3) !== 0 ? N[1] : Math.abs(v - 3 - u * 0.3) < 0.4 && u > -2 && u < 4 ? N[2] : -1; });
  return all;
}
art('gloves', fp(2, 2), p => {
  glove(p, 31, 22, 0.5, 1.06, -1, rp('#0c1838', '#16306a', '#24519c', '#3a7ccc', '#72b0ea', '#ccecff'), -0.3);
  const front = glove(p, 18, 25.5, -0.28, 1.1, 1, RP.nitrile, 0.3);
  p.drop(front, -0.4, 1, 1);
});

// ------------------------------------------------------------------ claw hammer (2x2 L: the head across the top, the handle down the left)
art('hammer', fp(2, 2, '##', '#.'), p => {
  const S = RP.steel, Cr = RP.chrome;
  // ash handle with a dark grip end, slightly flared
  const hf = frame(13.2, 46, 19.2, 13);
  p.tube([hf.at(0, 0), hf.at(hf.len, 0)], u => 3.6 - u * 0.9 + (u < 0.12 ? 0.5 : 0), RP.pale, { tex: grainTex(hf.ux, hf.uy, 9, 1), lift: 0.15 });
  const grip = p.maskFn((x, y) => { const [u, v] = hf.loc(x, y); return u > 0.5 && u < 11 && Math.abs(v) <= 4; });
  p.tint(grip, () => -0.32);
  p.fill(p.maskFn((x, y) => { const [u, v] = hf.loc(x, y); return Math.abs(u - 11) < 0.6 && Math.abs(v) < 3.6; }), RP.wood[1]);
  // the head: striking face (left), neck, eye block round the handle, claw curling down at the right
  const face = p.maskFn((x, y) => x >= 3 && x <= 9 && Math.abs(y + 0.5 - 11) <= 6.4 - (x < 4 ? 0.8 : 0));
  p.relief(face, Cr, (x, y) => (p.at(face, x, y) ? Math.sqrt(Math.max(0, 1 - ((y + 0.5 - 11) / 6.6) ** 2)) * 5 : 0), { spec: 0.93, lift: 0.3 });
  p.fill(face, (x) => (x === 3 ? Cr[4] : -1));
  const neck = p.maskFn((x, y) => x >= 9 && x <= 15 && Math.abs(y + 0.5 - 11) <= 4.2 + (x < 11 ? (11 - x) * 0.6 : 0));
  p.relief(neck, S, (x, y) => (p.at(neck, x, y) ? Math.sqrt(Math.max(0, 1 - ((y + 0.5 - 11) / 5) ** 2)) * 4 : 0), { spec: 0.95, lift: 0.4 });
  const eye = p.maskBox(15, 4, 10, 15, 2);
  p.relief(eye, S, p.dome(eye, 2.5), { spec: 0.96, lift: 0.5 });
  p.rect(17, 4, 5, 1, RP.wood[3]); p.px(19, 4, RP.wood[1]);
  const cc = curve(bez([24, 11], [37, 9.5], [44.5, 21], 24));
  const claw = p.band(cc, t => 6.2 * (1 - t) ** 0.85 + 0.8);
  p.relief(claw, S, (x, y) => { if (!p.at(claw, x, y)) return 0; const q = cc.loc(x, y); const w = 6.2 * (1 - q.t) ** 0.85 + 0.8; return Math.sqrt(Math.max(0, 1 - (q.v / w) ** 2)) * 3.5; }, { spec: 0.95, lift: 0.3 });
  // the V split of the claw
  p.fill(claw, (x, y) => { const q = cc.loc(x, y); return q.t > 0.55 && Math.abs(q.v) < 0.6 + (q.t - 0.55) * 1.8 ? 0 : -1; });
  p.seam(eye, S[1], 12);
  p.glint(5, 7, H('#ffffff'), 0.5);
});

// ------------------------------------------------------------------ headlamp (1x1)
art('headlamp', fp(1, 1), p => {
  const E = rp('#0c0d10', '#16181e', '#22252e', '#30343e', '#444a56', '#6a7280');
  // the elastic band looping behind the lamp: the inside of the far side, then the near side with its hi-vis stripe
  const outer = p.maskEllipse(12, 10.5, 11.2, 7), inner = p.maskEllipse(12, 9.4, 8.6, 4.4);
  const band = Pen.sub(outer, inner);
  p.fill(band, (x, y) => {
    const front = y + 0.5 > 10.4;
    const dx = (x + 0.5 - 12) / 11.2, dy = (y + 0.5 - 10.5) / 7;
    const stripe = Math.abs(Math.hypot(dx, dy) - 0.86) < 0.08;
    if (!front) return stripe ? RP.orange[1] : E[x < 12 ? 2 : 1];
    return stripe ? RP.orange[x < 12 ? 4 : 3] : E[x < 8 ? 4 : x < 16 ? 3 : 2];
  });
  // the housing: orange shell, black face, chrome reflector and the glowing LED
  const hs = p.maskBox(5, 10, 14, 11, 3);
  p.relief(hs, RP.orange, p.dome(hs, 3), { spec: 0.95, lift: 0.1 });
  const face = p.maskBox(7, 11, 10, 9, 2);
  p.relief(face, E, p.dome(face, 2), { lift: 0.6 });
  ring(p, 12, 15.5, 2.8, 4.2, RP.chrome);
  p.fill(p.maskDisc(12, 15.5, 2.8), (x, y) => { const d = Math.hypot(x + 0.5 - 11.4, y + 0.5 - 14.9); return d < 1.2 ? H('#ffffff') : d < 2.3 ? H('#fff4c0') : H('#f4cc5a'); });
  p.slab(p.maskBox(15, 8, 3, 2), E, 3);
  p.glow(12, 15.5, 8, '#fff2b0', 110);
});

// ------------------------------------------------------------------ the phone (1x2): cracked, 11%, translator app open
art('translator', fp(1, 2), p => {
  const I = RP.iron;
  const body = p.maskBox(3, 2, 18, 44, 3);
  p.relief(body, I, p.dome(body, 2), { lift: 0.8, spec: 0.97 });
  p.fill(body, (x, y) => (!p.at(body, x - 1, y) || !p.at(body, x, y - 1) ? RP.aluminium[3] : !p.at(body, x + 1, y) || !p.at(body, x, y + 1) ? RP.aluminium[1] : -1));
  // the screen: the translator app, two speech bubbles and a mic button
  const scr = p.maskBox(5, 6, 14, 35, 1);
  p.fill(scr, (x, y) => (y < 9 ? H('#1a4a52') : y > 31 ? H('#121c3a') : H('#16244a')));
  p.rect(6, 7, 5, 1, H('#a8f0e0'));
  p.rect(14, 7, 3, 1, H('#d8e0e8')); p.px(14, 7, RP.red[4]); p.px(17, 7, H('#d8e0e8'));
  const b1 = p.maskBox(6, 11, 10, 7, 2);
  p.slab(b1, RP.cream, 4);
  p.pts([[7, 18], [8, 18], [7, 19]], RP.cream[3]);
  for (const y of [13, 15]) p.scribble(8, 14, y, H('#4a4a6a'), y);
  const b2 = p.maskBox(8, 21, 10, 7, 2);
  p.slab(b2, RP.teal, 3);
  p.pts([[16, 28], [17, 28], [17, 29]], RP.teal[2]);
  for (const y of [23, 25]) p.scribble(10, 16, y, H('#e6fff6'), y + 3);
  p.ball(12, 35.5, 2.7, 2.7, RP.teal, { spec: 0.9, lift: 0.4 });
  p.rect(12, 34, 1, 3, H('#ffffff'));
  // a spider-web crack from a knock on the top right corner
  const o: Pt = [16, 9];
  for (const [ex, ey] of [[11, 20], [18, 19], [7, 10], [18, 6]] as Pt[]) {
    const n = Math.max(Math.abs(ex - o[0]), Math.abs(ey - o[1]));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(o[0] + (ex - o[0]) * t + Math.sin(t * 9 + ex) * 0.6), y = Math.round(o[1] + (ey - o[1]) * t);
      if (!p.at(scr, x, y)) continue;
      p.px(x, y, i < n * 0.5 ? H('#eef8ff') : H('#a8c4e0'));
      if (p.at(scr, x + 1, y + 1) && i % 2 === 0) p.px(x + 1, y + 1, H('#0a1020'));
    }
  }
  p.pts([[15, 8], [17, 8], [15, 10], [17, 10]], H('#d8ecff'));
  // glass sheen, earpiece and camera, side buttons
  for (let y = 6; y < 41; y++) for (let x = 5; x < 19; x++) { const d = x + y * 0.55; if (d > 11 && d < 13.5 && p.at(scr, x, y)) p.blend(x, y, H('#ffffff', 46)); }
  p.rect(10, 4, 4, 1, I[0]); p.px(15, 4, I[5]);
  p.rect(9, 42, 6, 1, I[4]);
  p.px(2, 12, RP.aluminium[2]); p.px(2, 13, RP.aluminium[2]); p.px(2, 17, RP.aluminium[2]); p.px(2, 18, RP.aluminium[2]);
});

// ------------------------------------------------------------------ ghillie cape (2x2): a hooded cape shingled with fern fronds and flax
function frond(p: IP, x0: number, y0: number, len: number, ang: number, R: Ramp, lift: number) {
  const f = frame(x0, y0, x0 + Math.sin(ang) * len, y0 + Math.cos(ang) * len);
  const w = (u: number) => (u < 2 ? 1.6 + u * 1.2 : 4.2 * (1 - u / len) ** 0.6 + 0.6);
  const m = p.maskFn((x, y) => {
    const [u, v] = f.loc(x, y);
    if (u < 0 || u > len || Math.abs(v) > w(u)) return false;
    const k = ((u - Math.abs(v) * 0.8) % 2.6 + 2.6) % 2.6;
    return !(Math.abs(v) > 1 && k < 0.7);
  });
  p.relief(m, R, (x, y) => { if (!p.at(m, x, y)) return 0; const [u, v] = f.loc(x, y); const k = ((u - Math.abs(v) * 0.8) % 2.6 + 2.6) % 2.6; return 2.4 * (1 - Math.abs(v) / w(u)) + 1 + (k > 1.9 ? -0.6 : 0); }, { lift, spec: 1 });
  p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); return Math.abs(v) < 0.5 && u > 0.6 ? R[4] : -1; });
  p.drop(m, -0.3, 0, 1);
  return m;
}
art('ghillie', fp(2, 2), p => {
  const F = RP.fern, Fd = RP.flaxDry, dry = rp('#1a1006', '#2e1e0c', '#4a3214', '#664a1e', '#80602a', '#a07c3c');
  const cape = p.maskPoly([24, 2, 30, 4, 32.5, 9, 33, 13, 39, 18, 43, 30, 45.5, 43, 2.5, 43, 5, 30, 9, 18, 15, 13, 15.5, 9, 18, 4]);
  p.relief(cape, rp('#04100a', '#081a10', '#0e2816', '#16381e', '#204a26', '#2e602e'), p.dome(cape, 6), { lift: 0 });
  // rows of fronds tied on, shingled: each row overlaps the one below
  const greens: Ramp[] = [F, RP.leaf, RP.lime, F, RP.moss, RP.leaf];
  for (let row = 4; row >= 0; row--) {
    const y = 10 + row * 7;
    const n = 4 + Math.min(row, 2);
    for (let i = 0; i < n; i++) {
      const span = 14 + row * 6;
      const x = 24 - span + (i + 0.5) * (span * 2 / n) + (hash(i, row, 4) - 0.5) * 2;
      if (!p.at(cape, Math.round(x), y + 3)) continue;
      const R = hash(i, row, 9) > 0.8 ? dry : greens[(i + row * 2) % greens.length];
      const ang = (x - 24) / 60 + (hash(i, row, 5) - 0.5) * 0.25;
      frond(p, x, y, 12 + hash(i, row, 6) * 3, ang, R, x < 22 ? 0.4 : -0.1);
    }
  }
  // flax ties dangling from the shoulders and the neck cord
  for (const [x, y, l] of [[12, 18, 15], [37, 19, 13]] as [number, number, number][]) p.tube([[x, y], [x + (x < 24 ? -1.5 : 1.5), y + l]], 0.8, dry, { spec: 1, lift: 0.3 });
  p.ball(24, 9.5, 4.4, 5, rp('#020403', '#050a07', '#09120d', '#0f1c14', '#16281c', '#16281c'), { spec: 1, lift: -1 });
  p.tube([[19, 14], [29, 14]], 1.1, Fd, { spec: 1 });
  p.ball(24, 14.5, 1.6, 1.4, Fd, { lift: 0.5 });
});

// ------------------------------------------------------------------ binoculars (2x2): Crowe's old brass Porro pair, seen from above
art('binoculars', fp(2, 2), p => {
  const Lt = rp('#140a06', '#24140c', '#3a2214', '#54341e', '#70482a', '#9a6a42');
  const Br = RP.brass, Rb = RP.rubber;
  const pebble = (x: number, y: number) => (hash(x >> 1, y >> 1, 12) > 0.78 ? -0.08 : 0);
  for (const s of [-1, 1]) {
    const ex = 24 + s * 7.5, ox = 24 + s * 12.5;
    // objective barrel (outer, near end at the bottom) with its brass rim and the lens facing us
    const ob = p.maskFn((x, y) => Math.abs(x + 0.5 - ox) <= 7 && y >= 26 && y <= 41);
    lit(p, ob, Lt, (x, y) => p.lum((x + 0.5 - ox) / 7, 0, 0.8) + pebble(x, y), 0.5);
    const rimM = p.maskEllipse(ox, 41.5, 7.2, 3.6);
    p.fill(rimM, (x, y) => p.tn(Br, p.lum((x + 0.5 - ox) / 7.2, (y + 0.5 - 41.5) / 3.6, 0.6) + 0.1, x, y, 0.4));
    const g = p.maskEllipse(ox, 41.8, 5.4, 2.6);
    p.fill(g, (x, y) => { const d = Math.hypot((x + 0.5 - ox) / 5.4, (y + 0.5 - 41.8) / 2.6); const dx = x + 0.5 - ox; return d < 0.45 ? H('#0a0e26') : dx < -1 && y < 42 ? H('#5a7ac8') : d < 0.8 ? H('#18244e') : H('#2c3c7a'); });
    p.px(Math.round(ox - 2.5), 41, H('#ffffff'));
    // prism housing: a leather-covered block with brass caps
    const hb = p.maskBox(Math.round(24 + s * 11 - 8), 11, 16, 18, 3);
    p.relief(hb, Lt, p.dome(hb, 3), { lift: 0.5, tex: pebble });
    p.fill(hb, (x, y) => (y === 11 || y === 12 ? Br[y === 11 ? 4 : 3] : y === 28 ? Br[1] : -1));
    // eyepiece: a rubber cup with the little dark glass
    const ep = p.maskFn((x, y) => Math.abs(x + 0.5 - ex) <= 4 && y >= 4 && y <= 11);
    lit(p, ep, Rb, (x) => p.lum((x + 0.5 - ex) / 4, 0, 0.8) + 0.1, 0.4);
    p.fill(p.maskEllipse(ex, 4.5, 4, 2), (x, y) => p.tn(Rb, 0.85 - (y - 3) * 0.1, x, y, 0.3));
    p.fill(p.maskEllipse(ex, 4.6, 2.2, 1.1), H('#101838'));
    p.px(Math.round(ex - 1), 4, H('#8ab0f0'));
  }
  // hinge bridge and the knurled focus wheel between the eyepieces
  const hinge = p.maskBox(18, 14, 12, 10, 2);
  p.relief(hinge, Br, p.dome(hinge, 2), { spec: 0.94, lift: 0.3 });
  const wheel = p.maskBox(20, 6, 8, 6, 1);
  p.fill(wheel, (x, y) => (y === 6 ? Br[4] : y === 11 ? Br[1] : Br[(x % 2 ? 2 : 3) + (x < 23 ? 1 : 0)]));
  p.ball(24, 19, 2, 2, Br, { spec: 0.9, lift: 0.8 });
  // strap rings on the outer sides
  ring(p, 3.5, 15, 0.6, 1.8, Br); ring(p, 44.5, 15, 0.6, 1.8, Br);
});
