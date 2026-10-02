// V11 item art: the shore. The island's shells (sunwhorl, fanshell, tiger cone, opal ear and the
// Trycop's moulted claw) and the shellfish you can eat (tide-pool mussels, pipi).

import { artGroup, fp, IP, RP, H, rp, hash, clamp, mix, tone, Pen, frame, bez, curve, noise2 } from './kit';
import type { Pt, Ramp, Mask } from './kit';

const art = artGroup('Shells & shellfish');

/** a bivalve seen from above: an oval-ish valve with a hinge (umbo) at (ux, uy), growth lines, radial ribs */
function valve(p: IP, cx: number, cy: number, rx: number, ry: number, ang: number, R: Ramp, o: { ribs?: number; lines?: number; umbo?: Pt; spec?: number; lift?: number; tex?: (x: number, y: number) => number } = {}): Mask {
  const m = p.maskEllipse(cx, cy, rx, ry, ang);
  const [ux, uy] = o.umbo ?? [cx - Math.cos(ang) * rx * 0.85, cy - Math.sin(ang) * rx * 0.85];
  const dome = p.dome(m, Math.min(rx, ry) * 0.7);
  p.relief(m, R, (x, y) => {
    if (!p.at(m, x, y)) return 0;
    const d = Math.hypot(x + 0.5 - ux, y + 0.5 - uy), a = Math.atan2(y + 0.5 - uy, x + 0.5 - ux);
    return dome(x, y) + (o.ribs ? Math.cos(a * o.ribs) * 0.35 : 0) + (o.lines ? (Math.sin(d * o.lines) > 0.85 ? -0.4 : 0) : 0);
  }, { spec: o.spec ?? 0.95, lift: o.lift ?? 0.2, tex: o.tex, dither: 0.3 });
  return m;
}

// ------------------------------------------------------------------ sunwhorl (1x1): a golden turban, warm from the sun
art('shell_sunwhorl', fp(1, 1), p => {
  const Gd = rp('#3e1c06', '#7a3e0e', '#b46a1a', '#e09c32', '#f6cc64', '#fff4c4');
  const f = frame(8, 17.4, 19.8, 3); // aperture -> apex
  const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < -0.38 || t > 1) return false; const w = t < 0 ? 8.4 * Math.sqrt(1 - (t / 0.38) ** 2) : 8.4 * (1 - t) ** 0.95 + 0.4; return Math.abs(v) <= w; });
  // whorls: a stack of rounded bands, each lit on its upper flank
  p.relief(m, Gd, (x, y) => { if (!p.at(m, x, y)) return 0; const [u, v] = f.loc(x, y); const t = u / f.len; const w = t < 0 ? 8.4 : 8.4 * (1 - t) + 0.4; const band = ((u * 0.42 + v * 0.18) % 1 + 1) % 1; return Math.sqrt(Math.max(0, 1 - (v / w) ** 2)) * 4 + Math.sin(band * Math.PI) * 1.4; }, { spec: 0.95, lift: 0.3 });
  p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); const band = ((u * 0.42 + v * 0.18) % 1 + 1) % 1; return band < 0.09 && u > 1 ? Gd[1] : (hash(x, y, 4) > 0.9 && u > 0 ? Gd[4] : -1); });
  // the pearly aperture at the lower left
  const ap = p.maskEllipse(7.4, 17.6, 3.8, 3, -0.6);
  p.fill(Pen.and(ap, m), (x, y) => { const d = Math.hypot(x + 0.5 - 7, y + 0.5 - 17.2); return d < 1.4 ? H('#5a3a2a') : d < 2.4 ? H('#f4e4d8') : H('#d8c0e0'); });
  p.glint(13, 8, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ fanshell (1x1): a deeply ribbed pink scallop
art('shell_fan', fp(1, 1), p => {
  const Pk = rp('#3a1022', '#76243e', '#b0465e', '#dc7282', '#f4a6a6', '#ffe8dc');
  const hx = 12, hy = 20.4;
  const m = p.maskFn((x, y) => { const dx = x + 0.5 - hx, dy = y + 0.5 - hy, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); if (Math.abs(a) > 1) return false; const edge = 16 - Math.abs(Math.sin(a * 7)) * 1.1 - a * a * 2.4; return r <= edge && r > 1; });
  p.relief(m, Pk, (x, y) => { if (!p.at(m, x, y)) return 0; const dx = x + 0.5 - hx, dy = y + 0.5 - hy, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); return Math.cos(a * 7) * 1.1 + Math.sin(Math.min(1, r / 15) * Math.PI) * 2.6 + (Math.sin(r * 1.6) > 0.9 ? -0.3 : 0); }, { spec: 0.95, lift: 0.3 });
  // the ears at the hinge
  const ears = Pen.or(p.maskPoly([hx - 1, hy - 1, hx - 6, hy - 3, hx - 6, hy + 0.5, hx - 1, hy + 1]), p.maskPoly([hx + 1, hy - 1, hx + 6, hy - 3, hx + 6, hy + 0.5, hx + 1, hy + 1]));
  p.relief(ears, Pk, p.dome(ears, 1.5), { lift: 0.4 });
  p.fill(m, (x, y) => (hash(x, y, 7) > 0.92 ? Pk[5] : -1));
});

// ------------------------------------------------------------------ tiger cone (1x1): a cone shell banded like a tiger
art('shell_cone', fp(1, 1), p => {
  const Cn = rp('#4a2410', '#8a4a1e', '#c47c38', '#e8aa62', '#f8d49a', '#fff4dc');
  const f = frame(20.6, 3.4, 4.4, 20.4); // spire -> tip
  const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < 0 || t > 1) return false; const w = t < 0.16 ? 1.6 + (t / 0.16) * 5.6 : 7.2 * (1 - (t - 0.16) / 0.84) ** 1.05 + 0.5; return Math.abs(v) <= w; });
  p.relief(m, Cn, (x, y) => { if (!p.at(m, x, y)) return 0; const [u, v] = f.loc(x, y); const t = u / f.len; const w = t < 0.16 ? 1.6 + (t / 0.16) * 5.6 : 7.2 * (1 - (t - 0.16) / 0.84) + 0.5; return Math.sqrt(Math.max(0, 1 - (v / w) ** 2)) * 4; }, { spec: 0.93, lift: 0.3 });
  // tiger bands: wavy dark stripes across the body, tented flecks between
  p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); if (u < 3) return -1; const s = Math.sin(u * 0.95 + Math.sin(v * 0.7) * 1.3); return s > 0.55 ? tone(p.get(x, y), -0.55) : s > 0.35 ? tone(p.get(x, y), -0.25) : -1; });
  // the low spire's spiral
  for (let i = 0; i < 3; i++) { const [x, y] = f.at(1 + i * 1.2, -1.5 + i); p.px(x, y, Cn[1]); }
  p.glint(14, 8, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ opal ear (2x1): a pāua shell from inside, blue-green fire
art('shell_opal', fp(2, 1), p => {
  const f = frame(5, 13, 44, 11);
  const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < -0.04 || t > 1.04) return false; const w = Math.sin(Math.PI * Math.min(1, (t + 0.04) / 1.08)) ** 0.55 * 10.2; return v >= -w * 0.88 && v <= w * 0.92; });
  // nacre: hue swirls through teal, blue, violet and green, brighter on the lit side
  const fire = (x: number, y: number) => {
    const n = noise2(x * 0.16, y * 0.3, 7) * 2 + noise2(x * 0.45, y * 0.6, 8) * 0.6;
    const cols = [H('#0c2a4a'), H('#1a4a8a'), H('#2a8aa4'), H('#3ac4a0'), H('#7ad0e8'), H('#8a6ad8'), H('#3a9a6a')];
    return cols[Math.floor((n * 3.3) % cols.length)];
  };
  p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); const edge = Math.abs(v) / 10; return edge > 0.8 ? H('#3a2a2a') : fire(x, y); });
  p.tint(m, (x, y) => { const [u, v] = f.loc(x, y); return (u < 16 && v < 0 ? 0.25 : 0) - (v > 5 ? 0.2 : 0); });
  // the rough outer lip and the row of breathing holes along the edge
  p.fill(m, (x, y) => (!p.at(m, x, y - 1) || !p.at(m, x, y + 1) ? H('#6a5048') : -1));
  for (let i = 0; i < 6; i++) { const [x, y] = f.at(10 + i * 4.4, -6.6 + Math.sin(i * 0.5) * 0.4); p.px(x, y, H('#08080c')); p.px(x + 1, y, H('#1a1a22')); p.px(x, y + 1, H('#b8e8f0')); }
  p.glint(14, 10, H('#ffffff'), 0.4);
  p.spark(30, 7, '#c8f8ff');
});

// ------------------------------------------------------------------ Trycop moult (2x2): a whole shed claw, round spots and all
art('shell_trycop', fp(2, 2), p => {
  const Tc = rp('#34080a', '#6c1612', '#aa3018', '#dc5a2a', '#f68e52', '#ffc894');
  const spots = (m: Mask, seed: number) => p.fill(m, (x, y) => { const n = noise2(x * 0.32, y * 0.32, seed); return n > 0.7 ? RP.cream[4] : n > 0.66 ? RP.cream[2] : -1; });
  // carpus (wrist) at the lower left, open and hollow at the cut end
  const carp = p.maskEllipse(10, 38, 7, 6, -0.6);
  p.relief(carp, Tc, p.dome(carp, 3.5), { spec: 0.95, lift: 0 });
  p.fill(p.maskEllipse(6.6, 41.5, 3.4, 2.4, -0.6), (x, y) => (y < 41 ? H('#2a0806') : H('#f0c8a0')));
  // the palm: a big swollen oval
  const palm = p.maskEllipse(22, 27, 13, 9.6, -0.7);
  p.relief(palm, Tc, p.dome(palm, 6), { spec: 0.95, lift: 0.3 });
  spots(palm, 4);
  // fixed finger (continuing the palm) and the hinged dactyl above it, both toothed
  const fixed = p.band(curve(bez([29, 21], [36, 13], [44, 5], 12)), t => 4.2 * (1 - t) ** 0.8 + 0.6);
  p.relief(fixed, Tc, p.dome(fixed, 2.5), { spec: 0.94, lift: 0.3 });
  const dact = p.band(curve(bez([26, 14], [31, 5], [40, 3], 12)), t => 3.6 * (1 - t) ** 0.8 + 0.6);
  p.relief(dact, Tc, p.dome(dact, 2.4), { spec: 0.94, lift: 0.5 });
  spots(dact, 6);
  // teeth along the gap, dark tips
  for (let i = 0; i < 5; i++) { p.px(33 + i * 2, 11 - i * 1.4, RP.cream[4]); p.px(31 + i * 2, 9 - i * 1.3, RP.cream[3]); }
  p.fill(Pen.or(fixed, dact), (x, y) => (x > 41 ? Tc[0] : -1));
  p.seam(dact, Tc[0], 12);
  p.glint(17, 21, H('#ffffff'), 0.4);
});

// ------------------------------------------------------------------ tide-pool mussels (1x1): two blue-black mussels, pearly lit edges
art('mussel', fp(1, 1), p => {
  const Mu = rp('#06080e', '#0e1424', '#1a2440', '#2c3a64', '#4c5e92', '#a8c0e8');
  const shell = (cx: number, cy: number, ang: number, lift: number) => {
    const f = frame(cx - Math.cos(ang) * 8, cy - Math.sin(ang) * 8, cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8);
    const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < 0 || t > 1) return false; const w = 4.6 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.15)) ** 0.7 * (1 + t * 0.15); return v >= -w * 0.8 && v <= w; });
    p.relief(m, Mu, (x, y) => { if (!p.at(m, x, y)) return 0; const [u, v] = f.loc(x, y); return 3 - Math.abs(v + 0.5) * 0.6 + (Math.sin(u * 1.6) > 0.8 ? -0.3 : 0); }, { spec: 0.93, lift });
    // the pearly purple-blue sheen near the lip
    p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); return v > 2.6 && u > 4 ? H('#6a58a0') : -1; });
    p.drop(m, -0.35, 1, 1);
    return m;
  };
  shell(13.5, 9, -0.55, 0.3);
  shell(10.5, 15, -0.2, 0.6);
  // byssus threads
  p.line(3, 18, 1, 21, RP.olive[3]); p.line(4, 18, 3, 22, RP.olive[2]);
  p.droplet(15, 13);
});

// ------------------------------------------------------------------ pipi (1x1): smooth little clams from the wet sand
art('pipi', fp(1, 1), p => {
  const Pi = rp('#5a4a36', '#8a7656', '#b8a47e', '#ddcca6', '#f2e8cc', '#ffffff');
  const a = valve(p, 15.4, 8.4, 6, 4.2, 0.3, Pi, { lines: 1.8, spec: 0.94, lift: 0.3 });
  p.drop(a, -0.3, 1, 1);
  const b = valve(p, 8.6, 12.6, 6.4, 4.6, -0.25, rp('#4a3a2e', '#7a644e', '#a88e72', '#d0b898', '#ecdcc0', '#ffffff'), { lines: 1.8, spec: 0.94, lift: 0.3 });
  p.drop(b, -0.3, 1, 1);
  valve(p, 15.6, 17.6, 5.8, 4, 0.1, Pi, { lines: 1.8, spec: 0.94, lift: 0.4 });
  // faint radial rays and a wet glint
  p.fill(Pen.or(a, b), (x, y) => ((x * 2 - y) % 5 === 0 ? tone(p.get(x, y), -0.12) : -1));
  p.droplet(6, 10);
});
