// V9 fish art: the ten invented species that bite off the Kittiwake's stern (see ../../ui/v4/fishing.ts
// FISH and the field guide in ../../game/v9/species-fish.ts) and the snout louse that lives in a
// snout bass's trunk. Every fish is one shape description in fish-local units (x runs from the tail
// tip at 0 to the snout at ~1, y points to the belly) made of parts: the body (one contour: a dorsal
// and a ventral profile through the snout, nape, dorsal origin, peduncle and belly landmarks), fins
// (a membrane polygon with its own rays), tubes (trunk, barbel, finger rays, plumes) and discs (bulbs,
// the sun-wheel), each with its own painter. One rasteriser renders it at any size and angle:
//
//   fishIcon(id)                 32x32 icon on the diagonal, head up-right, like an inventory sheet
//   fishSide(id, len, o)         side view at world scale (len px from tail to snout, head right),
//                                with flop / swim bends, for Mori's hands and the catch photo
//   fishTank(id)                 tiny side view for the hold tank
//   fishShadow(id, len, swing)   white silhouette with a soft edge, tinted and drawn translucent
//                                under the water as the fish's shadow
//   louseIcon() / louseSide(len) the snout louse
//
// Look (a naturalist's plate as crisp pixel art): the body is lit as a laterally flattened solid with
// countershading (dark back, bright belly band with bounce light underneath), an iridescent sheen band
// and wet mucus glints along the upper flank. Scaled fish carry a lattice of overlapping scales that
// follows the body (rows converge on the peduncle and shrink toward the head), each scale with its own
// tone, a lit cap and a shadowed free edge; a lateral line of pored scales; a bony head with the
// operculum's lit rim over a dark gill slit, the preopercle crease and a jaw line. Fins are separate
// rays (jointed soft rays, stiff spines) over translucent membranes. Tones come from hand-picked 6-tone
// ramps with a touch of ordered dither, and the eye is placed by hand: socket, iris, pupil and glints.

import { PixelBuffer } from '../pixel';
import { C, hex, rgba, withAlpha } from '../color';
import { lmix } from '../beasts-core';
import { Pt, clamp01, frac, smooth, hash, bay, fbm, curve, inPoly, segDist, polyEdgeDist, along, cumTable, scaleHit, ScaleHit, spot, cells } from './fish-skin';

type Ramp = C[];
/** a ramp from hex strings, dark -> light */
const pal = (...h: string[]): Ramp => h.map(x => hex(x));
/** pick a tone (0 = darkest) */
const tone = (r: Ramp, t: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
/** a tone with a little ordered dither, so steps break into pixel clusters instead of bands */
const toneD = (r: Ramp, t: number, _p?: Px, _k?: number) => tone(r, t);
/** colour c over b (straight RGB; the alphas used are few, so the palette stays small) */
function over(c: C, b: C): C {
  const a = (c >>> 24) / 255;
  if (a >= 1 || !b) return c;
  const m = (s: number) => Math.round(((c >>> s) & 255) * a + ((b >>> s) & 255) * (1 - a));
  return rgba(m(0), m(8), m(16), Math.max(c >>> 24, b >>> 24));
}

/** spots sized for the render: the lattice coarsens so a spot cell spans at least minPx pixels and a
 *  spot is never a lone speck (fewer, bigger spots on small sprites) */
const spotP = (p: Px, x: number, y: number, k: number, dens: number, rad: number, seed: number, minPx = 4.5) => {
  const kk = Math.min(k, p.S / minPx);
  return spot(x, y, kk, dens, (rad * k) / kk, seed);
};

// ------------------------------------------------------------------ the shape language
/** what a part hands its painter for one pixel */
interface Px {
  /** fish-local position */
  x: number; y: number;
  /** pixel position in the output (for dither and texture) */
  px: number; py: number;
  /** pixels per fish unit */
  S: number;
  /** key light and the half vector for wet highlights, in the fish's frame (x forward, y belly-ward, z to the viewer) */
  L: [number, number, number];
  H: [number, number, number];
  /** one output pixel right (ax, ay) and down (bx, by) in fish units */
  ax: number; ay: number; bx: number; by: number;
  /** big renders get pores, joints and creases; tiny ones stay clean */
  detail: number;
}
interface Part {
  z: number;
  /** ink line where this part lies over a lower part */
  ink?: boolean;
  /** minimum rendered half-thickness in px (thin barbels, rays and prickles never vanish) */
  minPx?: number;
  hit(x: number, y: number, S: number): boolean;
  /** a colour (alpha < 255 lets the part below show through), or 0 for none */
  paint(p: Px): C;
  /** points that bound the part (for fitting) */
  bounds: Pt[];
  /** skip in silhouettes (glows, bubbles) */
  noShadow?: boolean;
  /** leave out of world-scale renders (tiny ornaments) */
  iconOnly?: boolean;
  /** icons: a soft glow of this colour around the part (the cod's lure) */
  halo?: C;
}
interface FishArt {
  parts: Part[];
  ink: C;
  eye: { x: number; y: number; r: number; iris: C; ring?: C };
  /** body length span used for world-scale sizing (tail tip .. snout tip) */
  x0: number; x1: number;
  /** icon: bend the body (the ribbon's S-curve), rotation override and extra padding */
  iconSwing?: number;
  iconArch?: number;
  iconWave?: number;
  iconRot?: number;
  iconPad?: number;
  /** icon extras drawn after the ink (bubbles, sparkles) */
  iconPost?: (b: PixelBuffer) => void;
}

// ------------------------------------------------------------------ the body
/** what the body hands a species' pattern for one pixel */
interface BodyCtx {
  u: number; v: number;
  /** tone index so far (form light, highlight band, scale hints, lateral line) and the ramp it indexes */
  t: number; ramp: Ramp;
  /** body height here in px */
  Hpx: number;
  /** ahead of the gill cover */
  head: boolean;
  /** 0 back, 1 flank, 2 belly */
  zone: number;
  /** lambert term and the highlight term */
  lam: number; spec: number;
  /** on the lateral line / on a scale-hint mark */
  lat: boolean; hint: boolean;
  /** the colour the body would paint */
  c: C;
}
interface BodyOpt {
  top: Pt[]; bot: Pt[];
  /** back / flank / belly ramps (6 tones) and where they meet (0 = dorsal edge, 1 = ventral edge) */
  back: Ramp; side: Ramp; belly: Ramp;
  zb?: number; zl?: number;
  /** an iridescent band (a ramp swapped in at the same tones) between these v */
  sheen?: Ramp; sheenV?: [number, number];
  /** how strongly the light models the form */
  light?: number;
  /** operculum margin x at mid-height, how much it bows, and the preopercle crease ahead of it */
  gill?: number; bow?: number; pre?: number;
  /** jaw line: snout x, y, length back, droop at the corner */
  mouth?: [number, number, number, number];
  /** scale hints: rows of small marks in the mid-tone band (0 = scaleless), the band, and dark marks instead of light */
  hints?: number; hintV?: [number, number]; hintDark?: boolean;
  /** lateral line: v at the gill, v at the peduncle, arch */
  lat?: [number, number, number];
  /** the lit band along the upper flank */
  spec?: number;
  /** the species' pattern: a colour, or null to keep the body's */
  mark?: (p: Px, b: BodyCtx) => C | null;
  z?: number; ink?: boolean;
}
function body(o: BodyOpt): Part {
  const top = curve(o.top), bot = curve(o.bot);
  const x0 = Math.max(o.top[0][0], o.bot[0][0]), x1 = Math.min(o.top[o.top.length - 1][0], o.bot[o.bot.length - 1][0]);
  const cl = (x: number) => Math.min(x1, Math.max(x0, x));
  const Hf = (x: number) => Math.max(1e-3, bot(cl(x)) - top(cl(x)));
  let Hmax = 0;
  for (let i = 0; i <= 64; i++) Hmax = Math.max(Hmax, Hf(x0 + ((x1 - x0) * i) / 64));
  // distance along the body measured in local body heights: hint marks crowd where the body narrows
  const G = cumTable(x => Hmax / Hf(x), x0, x1);
  const zb0 = o.zb ?? 0.36, zl0 = o.zl ?? 0.66;
  const gill = o.gill ?? 0, bow = o.bow ?? 0.08, headX = gill || x1 - 0.18;
  const gx = (v: number) => gill - (v - 0.45) * (v - 0.45) * bow;
  const nh = o.hints ?? 0, hv = o.hintV ?? [Math.max(zb0 - 0.04, 0.24), zl0 - 0.06];
  const slope = (f: (x: number) => number, x: number) => { const a = cl(x - 0.005), b = cl(x + 0.005); return (f(b) - f(a)) / (b - a || 1); };
  const ctx: BodyCtx = { u: 0, v: 0, t: 0, ramp: o.side, Hpx: 0, head: false, zone: 1, lam: 0, spec: 0, lat: false, hint: false, c: 0 };
  return {
    z: o.z ?? 10, ink: o.ink ?? true,
    bounds: [...o.top, ...o.bot],
    hit(x, y) {
      if (x < x0 || x > x1) return false;
      return y >= top(x) && y <= bot(x);
    },
    paint(p) {
      const x = p.x, y = p.y, T = top(x), H = bot(x) - T;
      const v = clamp01((y - T) / H), u = (x - x0) / (x1 - x0), Hpx = H * p.S;
      // the normal of a laterally flattened solid: a broad flank rolling off to the back and belly,
      // tipped by the profile's slope, rounding forward over the head and back over the tail stock
      const e = 2 * v - 1, ae = Math.abs(e);
      const sx = slope(top, x) * (1 - v) - slope(bot, x) * v;
      const hx = smooth(headX - 0.04, x1, x);
      let nx = sx * Math.min(1, ae * 1.3) * 0.85 + hx * hx * 0.55 - (u < 0.06 ? (0.06 - u) * 4 : 0);
      let ny = Math.sign(e) * Math.pow(ae, 1.5) * 0.95;
      const nm = Math.hypot(nx, ny);
      if (nm > 0.97) { nx *= 0.97 / nm; ny *= 0.97 / nm; }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = nx * p.L[0] + ny * p.L[1] + nz * p.L[2];
      const spec = nx * p.H[0] + ny * p.H[1] + nz * p.H[2];
      // countershading zones with gently wavering (never dithered) borders
      const wv = Math.sin(x * 31 + 0.5) * 0.02;
      const zone = v < zb0 + wv ? 0 : v < zl0 - wv ? 1 : 2;
      // a solid lit volume in a few clean bands: a bright band along the upper flank, mid tones, a
      // shadowed lower flank, then the pale belly with a darker keel line
      let t = zone === 0 ? 1.9 + (v / zb0) * 0.5 : zone === 1 ? 2.6 : 4;
      t += (lam - 0.53) * 2.9 * (o.light ?? 1);
      const sw = o.spec ?? 0.8;
      if (sw > 0) { if (spec > 0.972) t += 0.9 * sw; if (spec > 0.996) t += 0.5 * sw; }
      if (zone === 2) t = Math.max(t, 2.8 + (1 - v) * 1.4);
      if ((1 - v) * Hpx < 1.1 && Hpx > 5) t -= 0.4;
      let ramp = zone === 0 ? o.back : zone === 1 ? o.side : o.belly;
      if (o.sheen && o.sheenV && v > o.sheenV[0] - wv && v < o.sheenV[1] + wv) ramp = o.sheen;
      const head = gill > 0 && x > gx(v);
      // scale hints: a few soft rows of small marks in the mid-tone band, staggered row to row
      let hint = false;
      if (nh > 0 && !head && Hpx >= 7 && u > 0.1 && x < headX - 0.03 && v > hv[0] && v < hv[1]) {
        const rv = ((v - hv[0]) / (hv[1] - hv[0])) * nh, r = Math.floor(rv);
        if (Math.abs(rv - r - 0.5) * ((hv[1] - hv[0]) / nh) * Hpx < 0.5) {
          const P = Math.max(3, Math.min(5, (Hmax * p.S) / 7));
          const q = (G(x) * p.S) / P + (r & 1) * 0.5;
          if (frac(q) < (Hpx > 16 ? 1.6 : 1) / P) { hint = true; t += o.hintDark ? -0.9 : 0.9; }
        }
      }
      // lateral line: a clean row along the flank
      let lat = false;
      if (o.lat && !head && u > 0.04 && Hpx > 6 && !hint) {
        const [vh, vt, arch] = o.lat;
        const uu = clamp01((x - x0) / (headX - x0));
        const lv = vt + (vh - vt) * uu - arch * Math.sin(Math.PI * uu);
        if (Math.abs(v - lv) * Hpx < 0.5) { lat = true; t += 0.6; }
      }
      // the head: a gill-cover plate with a lit rim and its shadow cast on the body behind it
      if (gill > 0 && v > 0.12 && v < 0.94) {
        const dg = (x - gx(v)) * p.S;
        if (dg < 0 && dg > -(Hpx > 12 ? 2 : 1.1)) t -= 1.3;
        else if (dg >= 0 && dg < 1) t += 1;
        else if (dg >= 1) {
          t += 0.25;
          if (o.pre && Hpx > 10 && v > 0.32 && v < 0.9 && Math.abs((x - gx(v) - o.pre) * p.S) < 0.5) t -= 0.8;
        }
      }
      let c: C = 0;
      if (o.mouth) {
        const [mx, my, ml, droop] = o.mouth;
        if (x > mx - ml) {
          const f = (mx - x) / ml, dpx = (y - (my + droop * f * f)) * p.S;
          if (Math.abs(dpx) < 0.55) c = tone(o.back, 0);
          else if (dpx >= 0.55 && dpx < 1.55 && Hpx > 7) t += 0.7;
        }
      }
      if (!c) c = tone(ramp, t);
      if (!o.mark) return c;
      ctx.u = u; ctx.v = v; ctx.t = t; ctx.ramp = ramp; ctx.Hpx = Hpx; ctx.head = head; ctx.zone = zone;
      ctx.lam = lam; ctx.spec = spec; ctx.lat = lat; ctx.hint = hint; ctx.c = c;
      return o.mark(p, ctx) ?? c;
    },
  };
}

// ------------------------------------------------------------------ fins
interface FinShape { pts: Pt[]; rays: [Pt, Pt][] }
/** what a fin hands its pattern: the nearest ray's index share s, how far out along it (0 base .. 1 tip), px to it */
interface FinCtx { s: number; a: number; d: number; ray: boolean; t: number; c: C }
interface FinOpt extends FinShape {
  ramp: Ramp;
  rayRamp?: Ramp;
  /** membrane tone at the base and its change toward the tips */
  t?: number; grad?: number;
  /** membrane alpha (the rays and the fleshy base are opaque) */
  alpha?: number;
  /** stiff unjointed spines rather than soft jointed rays */
  spines?: boolean;
  /** 1 px margin colour on big renders (null: none) */
  edge?: C | null;
  z?: number; ink?: boolean; iconOnly?: boolean; minPx?: number;
  mark?: (p: Px, f: FinCtx) => C | null;
}
function fin(o: FinOpt): Part {
  const { pts, rays } = o;
  let sp = 0;
  for (let i = 1; i < rays.length; i++) sp += Math.hypot(rays[i][1][0] - rays[i - 1][1][0], rays[i][1][1] - rays[i - 1][1][1]);
  sp /= Math.max(1, rays.length - 1);
  const len = rays.map(r => Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]));
  const ctx: FinCtx = { s: 0, a: 0, d: 0, ray: false, t: 0, c: 0 };
  let lastS = -1, st = 1;
  return {
    z: o.z ?? 5, ink: o.ink, bounds: pts, iconOnly: o.iconOnly, minPx: o.minPx,
    hit: (x, y) => inPoly(pts, x, y),
    paint(p) {
      // keep rays at least ~2 px apart at their tips: small renders show fewer, never a smear
      if (p.S !== lastS) { lastS = p.S; st = Math.max(1, Math.ceil(2.05 / Math.max(1e-6, sp * p.S))); }
      let bd = Infinity, ba = 0, bk = 0;
      for (let k = 0; k < rays.length; k += st) {
        const [d, a] = segDist(p.x, p.y, rays[k][0], rays[k][1]);
        if (d < bd) { bd = d; ba = a; bk = k; }
      }
      const dpx = bd * p.S, rl = len[bk] * p.S, out = ba * rl;
      // each fin carries its own value gradient: dark at the fleshy base, lighter and translucent at the edge
      let t = (o.t ?? 2) + 0.1 + ba * (o.grad ?? 1.5) + p.L[2] * 0.2;
      let a = ba > 0.62 ? o.alpha ?? 205 : 255;
      const ray = rays.length > 0 && dpx < 0.5 && out > 0.6 && (o.spines || ba > 0.18);
      let c: C;
      if (ray) {
        // subtle soft rays in the membrane's own colour; spines stand out pale and stiff
        let tr = t + (o.spines ? 1.1 : 0.8);
        if (!o.spines && rl > 12 && frac(out / 3) < 0.3) tr -= 0.5; // the joints of a long soft ray
        c = tone(o.spines ? o.rayRamp ?? o.ramp : o.ramp, tr);
        a = o.spines ? 255 : Math.max(a, 230);
      } else c = tone(o.ramp, t);
      if (out < 1.4) a = 255;
      if (o.edge && p.detail > 0.4 && ba > 0.3 && !ray && polyEdgeDist(pts, p.x, p.y) * p.S < 0.9) { c = o.edge; a = Math.max(a, 235); }
      if (o.mark) {
        ctx.s = rays.length > 1 ? bk / (rays.length - 1) : 0.5; ctx.a = ba; ctx.d = dpx; ctx.ray = ray; ctx.t = t; ctx.c = c;
        const m = o.mark(p, ctx);
        if (m) return (m >>> 24) < 255 ? m : withAlpha(m, a);
      }
      return withAlpha(c, a);
    },
  };
}
/** a fin standing on a body profile between x0 and x1: h(s) is its height at s = 0..1 and rake leans
 *  it back; nRays evenly spaced soft rays, or spines at the peaks of a spiny() edge */
function dorsal(prof: Pt[], x0: number, x1: number, h: (s: number) => number, dir: -1 | 1, rake: number, nRays: number, spines = 0): FinShape {
  const f = curve(prof);
  const N = Math.max(16, spines * 8, nRays * 2);
  const P = (s: number): [Pt, Pt] => {
    const x = x0 + (x1 - x0) * s, y = f(x), hh = Math.abs(h(s));
    return [[x, y - dir * 0.012], [x - hh * rake, y + dir * hh]];
  };
  const base: Pt[] = [], edge: Pt[] = [];
  for (let i = 0; i <= N; i++) { const [b, e] = P(i / N); base.push(b); edge.push(e); }
  const rays: [Pt, Pt][] = [];
  if (spines) { for (let k = 1; k <= spines; k++) { const s = k / spines; if (Math.abs(h(s)) > 0.012) rays.push(P(s)); } }
  else for (let k = 0; k < nRays; k++) rays.push(P((k + 0.5) / nRays));
  return { pts: [...base, ...edge.reverse()], rays };
}
/** a fan of n rays from a base (b0 -> b1) out to an edge; rays land along rayPath (default: the outer edge) */
function fan(b0: Pt, b1: Pt, outer: Pt[], n: number, rayPath: Pt[] = outer): FinShape {
  const rays: [Pt, Pt][] = [];
  for (let k = 0; k < n; k++) {
    const s = n === 1 ? 0.5 : k / (n - 1);
    rays.push([[b0[0] + (b1[0] - b0[0]) * s, b0[1] + (b1[1] - b0[1]) * s], along(rayPath, s)]);
  }
  return { pts: [b0, ...outer, b1], rays };
}
/** a tail fin from the peduncle (x = xp, half-height hp) to lobe tips at x = 0, y = +-span; fork = notch depth 0..1 */
function tail(xp: number, hp: number, span: number, fork: number, n: number, round = 0): FinShape {
  const nn = xp * fork * 0.85;
  const trail: Pt[] = round > 0
    ? [[0.02, -span], [-round * 0.4, -span * 0.5], [-round * 0.55, 0], [-round * 0.4, span * 0.5], [0.02, span]]
    : [[0, -span], [nn * 0.45, -span * 0.42], [nn, 0], [nn * 0.45, span * 0.42], [0, span]];
  return fan([xp + 0.02, -hp], [xp + 0.02, hp], [[xp * 0.5, -span * 0.7], ...trail, [xp * 0.5, span * 0.7]], n, trail);
}
/** spiny edge: tall spines with dips between (peaks at s = k / n) */
const spiny = (hmax: number, n: number, shape: (s: number) => number = s => Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.7), dip = 0.42) =>
  (s: number) => hmax * shape(s) * (1 - dip + dip * Math.pow(Math.abs(Math.cos(s * n * Math.PI)), 2));
const softH = (hmax: number, p = 1) => (s: number) => hmax * Math.pow(Math.sin(Math.PI * s), p);

// ------------------------------------------------------------------ tubes and discs
interface TubeOpt {
  pts: Pt[]; r: number[]; ramp: Ramp; z?: number; t?: number; ink?: boolean; minPx?: number;
  /** wrinkle rings (trunk) or joints (finger rays) along the length */
  rings?: number;
  mark?: (p: Px, s: number, t: number, d: number) => C | null;
}
/** a thick polyline (trunk, barbel, finger rays): radius per point, shaded as a round tube */
function tube(o: TubeOpt): Part {
  const { pts, r } = o;
  let tot = 0;
  const segL: number[] = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segL.push(l); tot += l; }
  const near = (x: number, y: number, S: number): [number, number, number, number, number] | null => {
    let best: [number, number, number, number, number] | null = null;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [d, t] = segDist(x, y, pts[i - 1], pts[i]);
      const rr = Math.max(r[i - 1] + (r[i] - r[i - 1]) * t, (o.minPx ?? 0.5) / S);
      if (d <= rr && (!best || d / rr < best[0])) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
        const side = ((x - pts[i - 1][0]) * dy - (y - pts[i - 1][1]) * dx) < 0 ? -1 : 1;
        best = [d / rr, side, (acc + segL[i - 1] * t) / tot, i - 1, rr];
      }
      acc += segL[i - 1];
    }
    return best;
  };
  const b: Pt[] = [];
  pts.forEach((q, i) => { b.push([q[0] - r[i], q[1] - r[i]], [q[0] + r[i], q[1] + r[i]]); });
  return {
    z: o.z ?? 12, ink: o.ink, minPx: o.minPx, bounds: b,
    hit: (x, y, S) => !!near(x, y, S),
    paint(p) {
      const n = near(p.x, p.y, p.S);
      if (!n) return 0;
      const [d, side, s, i, rr] = n;
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], dl = Math.hypot(dx, dy) || 1;
      const nx = -(dy / dl) * side * d * 0.95, ny = (dx / dl) * side * d * 0.95, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let t = (o.t ?? 2) + (nx * p.L[0] + ny * p.L[1] + nz * p.L[2] - 0.5) * 2;
      if (rr * p.S >= 1.5 && nx * p.H[0] + ny * p.H[1] + nz * p.H[2] > 0.96) t += 1.2;
      if (o.rings && rr * p.S >= 1.4) {
        const k = frac(s * o.rings);
        if (k < 0.16) t -= 1; else if (k < 0.3) t += 0.35;
      }
      return o.mark?.(p, s, t, d) ?? toneD(o.ramp, t, p, 0.3);
    },
  };
}

interface DiscOpt { x: number; y: number; rx: number; ry?: number; ramp: Ramp; z?: number; t?: number; ink?: boolean; noShadow?: boolean; iconOnly?: boolean; light?: number; mark?: (p: Px, nx: number, ny: number, t: number) => C | null }
function disc(o: DiscOpt): Part {
  const ry = o.ry ?? o.rx;
  return {
    z: o.z ?? 12, ink: o.ink, noShadow: o.noShadow, iconOnly: o.iconOnly, bounds: [[o.x - o.rx, o.y - ry], [o.x + o.rx, o.y + ry]],
    hit: (x, y) => ((x - o.x) / o.rx) ** 2 + ((y - o.y) / ry) ** 2 <= 1,
    paint(p) {
      const nx = (p.x - o.x) / o.rx, ny = (p.y - o.y) / ry;
      const k = Math.min(0.97, Math.hypot(nx, ny)), a = Math.atan2(ny, nx), Nx = Math.cos(a) * k, Ny = Math.sin(a) * k, Nz = Math.sqrt(1 - k * k);
      const t = (o.t ?? 2) + (Nx * p.L[0] + Ny * p.L[1] + Nz * p.L[2] - 0.5) * (o.light ?? 1.6) * 1.4;
      return o.mark?.(p, nx, ny, t) ?? toneD(o.ramp, t, p, 0.3);
    },
  };
}
/** spikes standing out of a profile (the puffer's prickles): triangles raked back, base sunk into the body */
function prickles(prof: Pt[], x0: number, x1: number, n: number, dir: -1 | 1, len: number, ramp: Ramp, z = 9): Part {
  const f = curve(prof);
  const tri: Pt[][] = [];
  for (let k = 0; k < n; k++) {
    const x = x0 + ((x1 - x0) * (k + 0.5 + (hash(k, 3, 41) - 0.5) * 0.5)) / n, y = f(x);
    const sl = (f(Math.min(x1, x + 0.004)) - f(Math.max(x0, x - 0.004))) / 0.008;
    const nl = Math.hypot(sl, 1), nx = (-dir * sl) / nl, ny = dir / nl;
    const l = len * (0.75 + hash(k, 5, 41) * 0.5), w = len * 0.45;
    const tx = -ny, ty = nx;
    tri.push([[x - tx * w - nx * 0.02, y - ty * w - ny * 0.02], [x + tx * w - nx * 0.02, y + ty * w - ny * 0.02], [x + nx * l - 0.35 * l, y + ny * l]]);
  }
  const bounds = tri.flat();
  return {
    z, minPx: 0.5, bounds,
    hit: (x, y) => tri.some(t => inPoly(t, x, y)),
    paint(p) {
      for (const t of tri) {
        if (!inPoly(t, p.x, p.y)) continue;
        const tip = Math.hypot(p.x - t[2][0], p.y - t[2][1]) / (len * 0.6);
        return tone(ramp, tip < 0.45 ? 1 : 3.4);
      }
      return 0;
    },
  };
}

// ------------------------------------------------------------------ the species
function snoutBass(): FishArt {
  const top: Pt[] = [[0.17, -0.036], [0.25, -0.052], [0.35, -0.1], [0.46, -0.136], [0.57, -0.149], [0.66, -0.139], [0.74, -0.112], [0.8, -0.076], [0.84, -0.034]];
  const bot: Pt[] = [[0.17, 0.036], [0.25, 0.048], [0.35, 0.076], [0.46, 0.104], [0.57, 0.117], [0.66, 0.109], [0.74, 0.087], [0.8, 0.058], [0.84, 0.014]];
  const back = pal('#161e0a', '#222d12', '#32421a', '#465a24', '#5e7430', '#7a8e40');
  const side = pal('#2e3412', '#444e1a', '#5c6826', '#788430', '#96a040', '#b6bc58');
  const belly = pal('#6e6238', '#988650', '#c0ac70', '#dccc90', '#f0e4b6', '#fdf8dc');
  const sheen = pal('#34401a', '#4c5e24', '#6c8434', '#90aa48', '#b6cc62', '#dcec88');
  const blot = pal('#0c1006', '#141a0a', '#1c240e', '#283314', '#36441c', '#465626');
  const finM = pal('#141a0a', '#1f2810', '#2e3a18', '#425222', '#5a6c2e', '#76883e');
  const finR = pal('#3a4418', '#56622a', '#76843a', '#98a64e', '#b8c466', '#d4de86');
  const trunk = pal('#42200f', '#6a3424', '#92503c', '#b67058', '#d49478', '#eebca2');
  const eye = { x: 0.752, y: -0.05, r: 0.026, iris: hex('#e89a28') };
  return {
    x0: 0, x1: 1, ink: hex('#0e1206'), eye,
    parts: [
      fin({ ...tail(0.19, 0.034, 0.124, 0.08, 12, 0.02), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(top, 0.26, 0.45, softH(0.08, 0.7), -1, 0.3, 9), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(top, 0.44, 0.67, spiny(0.09, 7), -1, 0.22, 0, 7), ramp: finM, rayRamp: finR, z: 4, spines: true, alpha: 190, minPx: 0.5 }),
      fin({ ...dorsal(bot, 0.24, 0.39, softH(0.064, 0.7), 1, 0.4, 7), ramp: finM, rayRamp: finR, z: 4 }),
      fin({ ...fan([0.6, 0.112], [0.66, 0.106], [[0.585, 0.15], [0.56, 0.168], [0.6, 0.172], [0.64, 0.15]], 5), ramp: finM, rayRamp: finR, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.34, zl: 0.68, sheen, sheenV: [0.3, 0.4], gill: 0.705, pre: 0.045,
        mouth: [0.84, 0.014, 0.08, 0.014], hints: 3, lat: [0.3, 0.46, 0.05], spec: 0.7,
        mark: (p, b) => {
          if (b.head) {
            // dark stripes fanning back from the eye over the cheek and gill cover
            for (const [ex, ey] of [[0.69, -0.02], [0.705, 0.03]] as Pt[]) {
              const [d, s] = segDist(p.x, p.y, [eye.x, eye.y], [ex, ey]);
              if (s > 0.25 && d * p.S < Math.max(0.6, 0.012 * p.S)) return toneD(blot, b.t, p);
            }
            return null;
          }
          // the bass's midlateral band: a chain of dark blotches joined at their waists, and soft
          // saddles over the back
          const k = frac(b.u * 6.2 + 0.2), cx = Math.abs(k - 0.5) * 2;
          const lv = 0.5 + Math.sin(b.u * 5) * 0.03 + (fbm(p.x * 9, 2, 3) - 0.5) * 0.08;
          const w = 0.05 + (1 - cx) * 0.1 + (fbm(p.x * 14, b.v * 3, 5) - 0.5) * 0.06;
          if (b.u > 0.03 && Math.abs(b.v - lv) < w) return toneD(blot, b.t + 1, p);
          if (b.v < 0.3 && b.u > 0.08 && Math.abs(frac(b.u * 4.4 + 0.45) - 0.5) < 0.13 + (fbm(p.x * 12, 0, 8) - 0.5) * 0.12) return toneD(blot, b.t + 2.1, p);
          return null;
        },
      }),
      fin({ ...fan([0.722, 0.024], [0.72, 0.064], [[0.66, 0.0], [0.6, 0.024], [0.582, 0.046], [0.606, 0.07], [0.67, 0.078]], 8), ramp: finM, rayRamp: finR, z: 14, ink: true, alpha: 180, t: 2.4 }),
      // the trunk: a hugely stretched upper lip, wrinkled and pitted with taste pores, curling down to a fleshy disc
      tube({
        pts: [[0.8, -0.036], [0.87, -0.036], [0.935, -0.018], [0.974, 0.022], [0.99, 0.066], [0.978, 0.1]], r: [0.036, 0.03, 0.026, 0.024, 0.023, 0.022], ramp: trunk, z: 13, ink: true, t: 2.2, rings: 11,
      }),
      disc({
        x: 0.966, y: 0.114, rx: 0.032, ry: 0.027, ramp: pal('#7a3030', '#ac5048', '#d47a68', '#eea28c', '#fcc8b4', '#ffe6da'), z: 14, ink: true, t: 2.4,
        mark: (p, nx, ny, t) => (Math.hypot(nx + 0.15, ny - 0.2) < 0.36 ? tone(trunk, 0) : null),
      }),
    ],
  };
}

function lanternCod(): FishArt {
  const top: Pt[] = [[0.15, -0.03], [0.22, -0.045], [0.35, -0.08], [0.5, -0.113], [0.64, -0.13], [0.76, -0.132], [0.86, -0.11], [0.93, -0.07], [0.97, -0.022]];
  const bot: Pt[] = [[0.15, 0.03], [0.22, 0.04], [0.35, 0.066], [0.5, 0.09], [0.64, 0.106], [0.76, 0.116], [0.86, 0.102], [0.93, 0.068], [0.97, 0.022]];
  const back = pal('#03071a', '#060b1e', '#0b142e', '#111f42', '#1a2c58', '#243e70');
  const side = pal('#111d3c', '#1a2a50', '#253b68', '#334f84', '#45689e', '#5e84b8');
  const belly = pal('#4e6076', '#72869c', '#9aacc0', '#bfcedc', '#dde8f0', '#f6fafd');
  const sheen = pal('#16344e', '#1e4a68', '#286484', '#3680a0', '#4ea0bc', '#74c0d8');
  const mott = pal('#040817', '#070d22', '#0b1530', '#101d40', '#182a54', '#223a6a');
  const finM = pal('#060d24', '#0b1636', '#12224c', '#1c3264', '#28467e', '#3a5e98');
  const finR = pal('#203458', '#2e4672', '#40608e', '#567caa', '#7298c4', '#98b8dc');
  const lure = pal('#147080', '#24a0b0', '#4cd2dc', '#8cf0f2', '#cafeff', '#ffffff');
  return {
    x0: 0, x1: 1, ink: hex('#050a18'),
    eye: { x: 0.866, y: -0.046, r: 0.038, iris: hex('#62dcae') },
    parts: [
      fin({ ...tail(0.17, 0.03, 0.094, 0.02, 11, 0.015), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      // three dorsals and two anals, like all cod
      fin({ ...dorsal(top, 0.61, 0.77, softH(0.082, 0.6), -1, 0.3, 8), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(top, 0.42, 0.59, softH(0.064, 0.7), -1, 0.3, 8), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(top, 0.23, 0.4, softH(0.056, 0.7), -1, 0.3, 7), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(bot, 0.42, 0.58, softH(0.056, 0.7), 1, 0.3, 7), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(bot, 0.23, 0.39, softH(0.05, 0.7), 1, 0.3, 6), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...fan([0.82, 0.104], [0.85, 0.1], [[0.79, 0.14], [0.765, 0.162], [0.8, 0.166]], 3), ramp: finM, rayRamp: finR, z: 3 }),
      body({
        top, bot, back, side, belly, zb: 0.42, zl: 0.7, sheen, sheenV: [0.4, 0.5], gill: 0.8, pre: 0.05, mouth: [0.968, 0.032, 0.08, 0.012],
        hints: 3, lat: [0.26, 0.5, 0.13], spec: 0.55,
        mark: (p, b) => {
          // the cod's pale arching lateral line stands out on the dark flank
          if (b.lat) return tone(side, b.t + 0.9);
          // a mottled, finely spotted back fading over the flank
          if (b.v < 0.66 && !b.head) {
            const s = spotP(p, p.x, p.y, 34, 0.5, 0.011, 7, 5);
            if (s > 0) return toneD(mott, b.t - 0.3 + s * 0.6, p);
            if (fbm(p.x * 14, b.v * 4, 2) > 0.6 - b.v * 0.2) return toneD(mott, b.t + 0.7, p);
          }
          if (b.head && b.v < 0.45 && spotP(p, p.x, p.y, 50, 0.6, 0.008, 9) > 0) return toneD(mott, b.t, p);
          return null;
        },
      }),
      fin({ ...fan([0.79, 0.04], [0.79, 0.076], [[0.72, 0.02], [0.68, 0.04], [0.672, 0.066], [0.7, 0.092]], 7), ramp: finM, rayRamp: finR, z: 14, ink: true, alpha: 185, t: 2.4 }),
      // the chin lure: the barbel grown long, carrying a pouch of glowing bacteria
      tube({ pts: [[0.925, 0.075], [0.948, 0.13], [0.99, 0.176], [1.03, 0.19]], r: [0.011, 0.009, 0.008, 0.008], ramp: pal('#1c2a48', '#2a3c60', '#3c547c', '#54709a', '#7490b8', '#98b2d2'), z: 13, minPx: 0.5, rings: 6 }),
      {
        ...disc({
          x: 1.054, y: 0.196, rx: 0.036, ramp: lure, z: 14, t: 2.8, light: 0.8, ink: true,
          mark: (p, nx, ny, t) => {
            const r = Math.hypot(nx, ny);
            if (r > 0.78) return tone(lure, 1.4 + (ny < 0 ? 0.6 : 0));
            if (r < 0.34) return tone(lure, 5);
            // bacteria colonies glowing through the skin of the pouch
            if (hash(p.px, p.py, 23) < 0.22) return tone(lure, 4.6);
            return toneD(lure, t + 0.6 - r, p);
          },
        }),
        halo: hex('#8af8ff'),
      },
    ],
  };
}

function gurnard(): FishArt {
  const top: Pt[] = [[0.16, -0.03], [0.28, -0.048], [0.42, -0.072], [0.56, -0.096], [0.7, -0.118], [0.8, -0.128], [0.88, -0.112], [0.93, -0.078], [0.962, -0.03]];
  const bot: Pt[] = [[0.16, 0.03], [0.28, 0.04], [0.42, 0.054], [0.56, 0.068], [0.7, 0.08], [0.8, 0.086], [0.88, 0.084], [0.93, 0.07], [0.962, 0.034]];
  const back = pal('#280504', '#420a08', '#60140e', '#802216', '#a03220', '#bc482c');
  const side = pal('#62140c', '#862214', '#aa341c', '#c84c28', '#e06a3a', '#f48e56');
  const belly = pal('#925640', '#b87a5e', '#d69c7e', '#ecbea0', '#f8dac0', '#fff2e4');
  const bone = pal('#4a120c', '#701e14', '#963220', '#b84c30', '#d46e48', '#ec9a72');
  const finM = pal('#300606', '#4a0e0c', '#6a1812', '#8c261a', '#ae3a26', '#cc5638');
  const finR = pal('#7a2a18', '#a03e24', '#c45a36', '#e07c4e', '#f4a070', '#ffc8a0');
  const wing = pal('#04191c', '#082c30', '#0e4444', '#16605c', '#228078', '#36a298');
  const wingR = pal('#1e5a60', '#2c7a7e', '#469a9a', '#6abab4', '#9ad8cc', '#ccf4ea');
  const legs = pal('#5e200f', '#88321e', '#b04c30', '#d06e4a', '#ea946a', '#ffc29a');
  return {
    x0: 0, x1: 1, ink: hex('#200404'),
    eye: { x: 0.855, y: -0.066, r: 0.027, iris: hex('#f4d040') },
    parts: [
      fin({ ...tail(0.18, 0.028, 0.096, 0.18, 11), ramp: finM, rayRamp: finR, z: 4, t: 2.2 }),
      fin({ ...dorsal(top, 0.62, 0.79, spiny(0.1, 6), -1, 0.2, 0, 6), ramp: finM, rayRamp: finR, z: 4, spines: true, alpha: 195, minPx: 0.5 }),
      fin({ ...dorsal(top, 0.3, 0.6, softH(0.052, 0.5), -1, 0.3, 12), ramp: finM, rayRamp: finR, z: 4 }),
      fin({ ...dorsal(bot, 0.3, 0.57, softH(0.046, 0.5), 1, 0.3, 11), ramp: finM, rayRamp: finR, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.7, gill: 0.8, pre: 0.045, mouth: [0.958, 0.024, 0.055, 0.01],
        hints: 3, lat: [0.3, 0.5, 0.04], spec: 0.6,
        mark: (p, b) => {
          // the armoured head: bony plates with dark sutures and pitted, granular surfaces
          if (p.x > 0.78 && (b.head || p.x > 0.8)) {
            const c = cells(p.x, p.y * 1.2, 22, 5);
            if ((c.d2 - c.d1) * (p.S / 22) < 0.55 && p.S > 30) return tone(bone, b.t - 0.8);
            const tt = b.t + (c.id - 0.5) * 0.6 - c.d1 * 0.5 + 0.8;
            return toneD(bone, tt, p);
          }
          // the lateral line of spiny bony scales
          if (b.lat) return frac((p.x * p.S) / 3) < 0.34 && b.Hpx > 8 ? tone(bone, b.t + 1.6) : null;
          // dark saddles over the back
          const k = frac(b.u * 4.2 + 0.1);
          if (b.v < 0.38 + fbm(p.x * 20, 1, 4) * 0.14 && k > 0.12 && k < 0.42 && b.u > 0.08) return toneD(back, b.t - 0.9, p);
          return null;
        },
      }),
      // a backward spine on the gill cover
      fin({ pts: [[0.815, -0.064], [0.76, -0.052], [0.815, -0.044]], rays: [[[0.815, -0.054], [0.76, -0.052]]], ramp: bone, rayRamp: bone, z: 15, t: 3.4, alpha: 255, spines: true, edge: null, minPx: 0.5 }),
      // the great wings: fan pectorals, teal with blue ocelli and an electric edge
      fin({
        ...fan([0.77, 0.0], [0.765, 0.05], [[0.68, -0.036], [0.56, -0.03], [0.46, 0.0], [0.415, 0.05], [0.44, 0.11], [0.52, 0.146], [0.62, 0.136], [0.7, 0.1]], 12),
        ramp: wing, rayRamp: wingR, z: 14, ink: true, t: 2, grad: 1.2, alpha: 230, edge: hex('#7cf0ff'),
        mark: (p, f) => {
          if (f.ray) return null;
          const s = spotP(p, p.x, p.y, 30, 0.5, 0.012, 11);
          if (s > 0 && f.a > 0.25) return s > 0.45 && p.S > 34 ? hex('#7ab4ff') : hex('#2a40b0');
          if (f.a > 0.86) return tone(wingR, 2.4);
          return null;
        },
      }),
      // six walking fingers (three on this side): free, jointed rays under the chin, toes forward
      ...[0, 1, 2].map(k => tube({
        pts: [[0.785 + k * 0.058, 0.074], [0.762 + k * 0.064, 0.138], [0.784 + k * 0.064, 0.184], [0.816 + k * 0.064, 0.19]],
        r: [0.012, 0.011, 0.01, 0.009], ramp: legs, z: 9 - k * 0.1, t: 2.4, ink: true, minPx: 0.5, rings: 6,
      })),
    ],
  };
}

function mirrorDory(): FishArt {
  const top: Pt[] = [[0.15, -0.03], [0.22, -0.08], [0.32, -0.17], [0.44, -0.235], [0.56, -0.255], [0.68, -0.236], [0.78, -0.19], [0.87, -0.112], [0.93, -0.05], [0.955, -0.01]];
  const bot: Pt[] = [[0.15, 0.03], [0.22, 0.078], [0.32, 0.16], [0.44, 0.215], [0.56, 0.232], [0.68, 0.21], [0.78, 0.16], [0.87, 0.1], [0.93, 0.058], [0.955, 0.02]];
  // chrome: the flank mirrors the bright water above the horizon line and the dark sea below it
  const sky = pal('#3a5878', '#5a80a4', '#82a8c8', '#acd0e8', '#d4ecfa', '#ffffff');
  const sea = pal('#08101a', '#101c2a', '#1a2a3c', '#283c52', '#3c546a', '#566e86');
  const finM = pal('#1a222c', '#29323e', '#3c4652', '#525e6c', '#6e7a88', '#949eaa');
  const finR = pal('#46525e', '#5e6a78', '#7a8694', '#9aa4b0', '#bcc4ce', '#e2e8ee');
  const bone = pal('#2c3440', '#46505e', '#66727e', '#8c96a2', '#b6bec8', '#e4e8ee');
  return {
    x0: 0, x1: 1, ink: hex('#080c14'),
    eye: { x: 0.815, y: -0.085, r: 0.032, iris: hex('#ecca5a') },
    parts: [
      fin({ ...tail(0.17, 0.03, 0.09, 0.0, 10, 0.03), ramp: finM, rayRamp: finR, z: 4, alpha: 190 }),
      // long dorsal spines trailing filaments (a dory), a low soft dorsal behind
      fin({ ...dorsal(top, 0.5, 0.79, spiny(0.17, 5, s => Math.pow(1 - s * 0.55, 1.2) * Math.min(1, s * 6), 0.72), -1, 0.55, 0, 5), ramp: finM, rayRamp: finR, z: 4, spines: true, alpha: 175, minPx: 0.5 }),
      fin({ ...dorsal(top, 0.24, 0.5, softH(0.05, 0.6), -1, 0.3, 11), ramp: finM, rayRamp: finR, z: 4, alpha: 190 }),
      fin({ ...dorsal(bot, 0.22, 0.47, softH(0.05, 0.6), 1, 0.3, 11), ramp: finM, rayRamp: finR, z: 4, alpha: 190 }),
      fin({ ...fan([0.7, 0.19], [0.745, 0.176], [[0.66, 0.27], [0.645, 0.3], [0.672, 0.305]], 3), ramp: finM, rayRamp: finR, z: 4 }),
      body({
        top, bot, back: sky, side: sky, belly: sea, zb: 0.3, zl: 0.56, gill: 0.78, bow: 0.12, pre: 0.05, mouth: [0.955, 0.0, 0.085, -0.03], light: 0.2, spec: 0,
        mark: (p, b) => {
          // the thumbprint: a dark false eye with a gold ring
          const d = Math.hypot(p.x - 0.56, p.y + 0.01) * p.S, R0 = 0.05 * p.S;
          if (d < R0) return d < R0 * 0.45 && p.S > 30 ? hex('#141a24') : hex('#0a0c12');
          if (d < R0 + Math.max(1, 0.012 * p.S)) return hex('#e8d890');
          // bony bucklers along the dorsal and ventral edges
          const ed = Math.min(b.v, 1 - b.v) * b.Hpx;
          if (ed < 1.6 && b.u > 0.15 && b.u < 0.8 && b.Hpx > 10) return tone(bone, frac((p.x * p.S) / 3) < 0.34 ? 1 : 3.6 - b.v * 1.5);
          if (b.head && b.c === tone(b.ramp, 0)) return null;
          // crinkled guanine mirror: facets tilted a little each way, so the reflection jumps between them
          const c = cells(p.x * 0.8, p.y, 16, 13);
          const tilt = (c.id - 0.5) * 0.16;
          const hz = 0.52 + (b.u - 0.5) * 0.12 + tilt;
          if (c.d2 - c.d1 < 0.06 && c.id > 0.6 && p.S > 24 && b.v < hz) return tone(sky, 5);
          if (b.v < hz - 0.05) {
            const tt = 1.3 + (b.v / hz) * 2.6 + (b.lam - 0.53) * 0.8 + c.id * 0.6;
            return toneD(sky, b.spec > 0.975 ? 5 : tt, p, 0.6);
          }
          if (b.v < hz + 0.02) return tone(sky, 4.4);
          return toneD(sea, 0.9 + ((b.v - hz) / (1 - hz)) * 3 + c.id * 0.7 + (b.head ? 0.4 : 0), p, 0.6);
        },
      }),
      fin({ ...fan([0.76, 0.02], [0.76, 0.052], [[0.69, 0.0], [0.65, 0.032], [0.69, 0.07]], 5), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.4, alpha: 170 }),
    ],
  };
}

function hammerSnapper(): FishArt {
  const top: Pt[] = [[0.17, -0.034], [0.26, -0.068], [0.38, -0.128], [0.5, -0.166], [0.62, -0.18], [0.7, -0.176], [0.78, -0.156], [0.86, -0.118], [0.92, -0.07], [0.95, -0.02]];
  const bot: Pt[] = [[0.17, 0.034], [0.26, 0.06], [0.38, 0.1], [0.5, 0.124], [0.62, 0.13], [0.72, 0.12], [0.82, 0.094], [0.9, 0.06], [0.95, 0.018]];
  const back = pal('#360818', '#541228', '#781e3a', '#9a3050', '#b84864', '#d0647a');
  const side = pal('#842c40', '#a84452', '#c66064', '#de807c', '#f0a49c', '#fcc8c0');
  const belly = pal('#a87478', '#ca9898', '#e6b8b2', '#f6d6ce', '#fdeae4', '#fff8f4');
  const finM = pal('#400a18', '#621424', '#882234', '#ac3848', '#cc5862', '#e47e84');
  const finR = pal('#8a3a46', '#ac5462', '#ca747c', '#e2969a', '#f4bab8', '#ffdeda');
  const brow = pal('#5a2a2e', '#8a5250', '#b47c72', '#d6a492', '#eecab4', '#fff0e2');
  // the hammer: a bony ridge with a flat striking face, overhanging the eye
  const browTop: Pt[] = [[0.64, -0.18], [0.72, -0.202], [0.8, -0.222], [0.87, -0.222], [0.925, -0.204], [0.962, -0.178], [0.99, -0.146]];
  const browBot: Pt[] = [[0.64, -0.18], [0.72, -0.168], [0.8, -0.138], [0.87, -0.108], [0.925, -0.088], [0.962, -0.078], [0.99, -0.082]];
  const under = curve(browBot);
  return {
    x0: 0, x1: 1, ink: hex('#20050d'),
    eye: { x: 0.842, y: -0.05, r: 0.025, iris: hex('#f0c040') },
    parts: [
      fin({ ...tail(0.19, 0.032, 0.15, 0.62, 13), ramp: finM, rayRamp: finR, z: 4, t: 2.4, edge: hex('#5a0e20') }),
      fin({ ...dorsal(top, 0.36, 0.73, spiny(0.08, 10), -1, 0.25, 0, 10), ramp: finM, rayRamp: finR, z: 4, spines: true, alpha: 200, minPx: 0.5 }),
      fin({ ...dorsal(bot, 0.25, 0.4, softH(0.06, 0.6), 1, 0.4, 8), ramp: finM, rayRamp: finR, z: 4 }),
      fin({ ...fan([0.62, 0.126], [0.68, 0.12], [[0.6, 0.17], [0.575, 0.186], [0.62, 0.188]], 4), ramp: finM, rayRamp: finR, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.34, zl: 0.7, gill: 0.78, pre: 0.05, mouth: [0.95, 0.022, 0.06, 0.012],
        hints: 3, lat: [0.24, 0.42, 0.07], spec: 0.75,
        mark: (p, b) => {
          // the brow's shadow on the head below it
          if (p.x > 0.74) { const d = (p.y - under(Math.min(1, p.x))) * p.S; if (d >= 0 && d < 1.6) return toneD(b.ramp, b.t - 1.5, p); }
          // electric-blue spots, one to a scale, over the upper flank
          if (!b.head && b.v < 0.62 && b.u > 0.06) { const sp = spotP(p, p.x, p.y, 34, 0.42, 0.009, 3); if (sp > 0) return sp > 0.55 && p.S > 40 ? hex('#c8f4ff') : hex('#3cbcec'); }
          return null;
        },
      }),
      fin({ ...fan([0.74, 0.03], [0.74, 0.062], [[0.66, 0.008], [0.6, 0.03], [0.56, 0.05], [0.62, 0.068]], 7), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.4, alpha: 185 }),
      body({
        top: browTop, bot: browBot, back: brow, side: brow, belly: brow, zb: 0.4, zl: 0.85, z: 15, ink: false, light: 1.1, spec: 0.9,
        mark: (p, b) => {
          // polished bone: growth lines parallel to the striking face, chips and scuffs, a lit crown
          const face = (0.99 - p.x) * p.S;
          if (face < 1.5 && b.Hpx > 4) return toneD(brow, 3.6 + (b.v < 0.5 ? 0.6 : -0.4), p);
          if (b.v > 0.82) return tone(brow, b.t - 1.4);
          if (p.S > 30 && frac(face / 3.2 + b.v * 0.6) < 0.22 && b.v > 0.2) return tone(brow, b.t - 0.9);
          return null;
        },
      }),
      // two little canines
      disc({ x: 0.955, y: 0.028, rx: 0.008, ry: 0.012, ramp: pal('#a8a090', '#c8c0b0', '#e8e0d0', '#fffaf0'), z: 16, t: 2, iconOnly: true }),
    ],
  };
}

function bubblePuffer(): FishArt {
  const back = pal('#3a2404', '#5e4008', '#86600e', '#ac8418', '#cea426', '#eac444');
  const side = pal('#846008', '#aa8410', '#cca41e', '#e6c034', '#f6d65a', '#ffec96');
  const belly = pal('#a89c80', '#c6bca2', '#e0d8c2', '#f0eade', '#faf8f0', '#ffffff');
  const spotR = pal('#1e1202', '#2e1c04', '#3e2806', '#523808', '#684a0c', '#806010');
  const finM = pal('#523a0a', '#765614', '#9c7620', '#c09830', '#deb848', '#f4d66c');
  const finR = pal('#8a6a1c', '#ae8c2c', '#cead40', '#e8c85a', '#f8e080', '#fff4b4');
  const prick = pal('#3a2808', '#6a5020', '#a08a5c', '#d6c8a2', '#f2ead4', '#ffffff');
  const top: Pt[] = [[0.2, -0.05], [0.26, -0.13], [0.34, -0.2], [0.46, -0.25], [0.58, -0.262], [0.7, -0.24], [0.8, -0.19], [0.88, -0.12], [0.925, -0.05], [0.94, 0.0]];
  const bot: Pt[] = [[0.2, 0.05], [0.26, 0.12], [0.34, 0.19], [0.46, 0.235], [0.58, 0.25], [0.7, 0.232], [0.8, 0.186], [0.88, 0.12], [0.925, 0.06], [0.94, 0.012]];
  return {
    x0: 0, x1: 1, ink: hex('#221604'),
    eye: { x: 0.8, y: -0.1, r: 0.05, iris: hex('#58c8a0'), ring: hex('#9a7a1c') },
    parts: [
      fin({ ...fan([0.23, -0.05], [0.23, 0.05], [[0.15, -0.1], [0.08, -0.118], [0.035, -0.08], [0.018, 0.0], [0.035, 0.08], [0.08, 0.118], [0.15, 0.1]], 9, [[0.08, -0.118], [0.035, -0.08], [0.018, 0.0], [0.035, 0.08], [0.08, 0.118]]), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      fin({ ...fan([0.26, -0.13], [0.33, -0.2], [[0.23, -0.2], [0.2, -0.245], [0.25, -0.262], [0.3, -0.24]], 6), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      fin({ ...fan([0.26, 0.12], [0.33, 0.19], [[0.23, 0.19], [0.2, 0.235], [0.25, 0.252], [0.3, 0.23]], 6), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      prickles(top, 0.28, 0.9, 18, -1, 0.042, prick),
      prickles(bot, 0.28, 0.9, 18, 1, 0.042, prick),
      body({
        top, bot, back, side, belly, zb: 0.42, zl: 0.64, light: 1.1, spec: 1,
        mark: (p, b) => {
          // a small gill opening in front of the pectoral
          if (Math.abs((p.x - 0.735 + (b.v - 0.5) * (b.v - 0.5) * 0.3) * p.S) < 0.6 && b.v > 0.36 && b.v < 0.6) return tone(spotR, 0);
          // prickles folded into the skin: a lit tip over a shadow, on a jittered lattice
          if (b.Hpx > 12 && b.u > 0.25 && b.u < 0.88 && b.zone === 2) {
            const s = spotP(p, p.x, p.y, 30, 0.6, 0.0075, 17, 5);
            if (s > 0) return tone(b.zone === 2 ? prick : spotR, b.zone === 2 ? (s > 0.5 ? 2 : 3) : s > 0.5 ? 4 : 2);
          }
          // leopard spots, big on the back and shrinking down the flank
          if (b.v < 0.66) {
            const s = spotP(p, p.x, p.y, 20, 0.85, 0.022 - b.v * 0.016, 21);
            if (s > 0) return toneD(spotR, b.t + (s > 0.6 ? -0.4 : 0.5), p);
          }
          // the skin stretched taut: faint fold lines curving round the belly
          if (b.zone === 2 && b.Hpx > 14 && Math.abs(frac(b.v * 9 + p.x * 3) - 0.5) < 0.05) return tone(belly, b.t - 0.8);
          return null;
        },
      }),
      fin({ ...fan([0.74, 0.0], [0.74, 0.05], [[0.68, -0.03], [0.64, 0.0], [0.625, 0.03], [0.65, 0.07]], 6), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.6, alpha: 190 }),
      // the parrot beak: fused tooth plates with a seam down the middle
      disc({
        x: 0.945, y: 0.02, rx: 0.026, ry: 0.03, ramp: pal('#6e6658', '#9e9684', '#c8c0ac', '#e6e0d0', '#f8f4ea', '#ffffff'), z: 15, t: 2.6, ink: true,
        mark: (p, nx, ny, t) => (Math.abs(ny) * 0.03 * p.S < 0.55 && nx > -0.6 ? tone(pal('#3a3428'), 0) : null),
      }),
    ],
    // the icon floats a few bubbles by its beak
    iconPad: 3.5,
    iconPost: b => {
      const bub = (cx: number, cy: number, r: number) => {
        const R = Math.ceil(r);
        for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
          const d = Math.hypot(x, y);
          if (b.opaque(cx + x, cy + y)) continue;
          if (d <= r + 0.5 && d > r - 0.6) b.set(cx + x, cy + y, hex('#3a8ab8'));
          else if (d <= r - 0.6) b.set(cx + x, cy + y, withAlpha(hex('#c8f0ff'), 150));
        }
        if (r >= 2) b.set(cx - 1, cy - 1, hex('#ffffff'));
      };
      const k = b.w / 32, q = (n: number) => Math.round(n * k);
      bub(q(28), q(4), 2.4 * k); bub(q(24), q(1.2), 1.3 * k); bub(q(30), q(10), 1.3 * k);
    },
  };
}

function ribbonEel(): FishArt {
  const top: Pt[] = [[0.03, -0.01], [0.1, -0.022], [0.3, -0.034], [0.6, -0.04], [0.84, -0.04], [0.935, -0.034], [0.975, -0.014]];
  const bot: Pt[] = [[0.03, 0.01], [0.1, 0.02], [0.3, 0.03], [0.6, 0.034], [0.84, 0.034], [0.935, 0.028], [0.975, 0.01]];
  const silver = pal('#383c54', '#5a6078', '#808aa2', '#aab2c6', '#d2d8e4', '#f6f8fc');
  const cyan = pal('#2e5266', '#40728a', '#5a96aa', '#80bcc8', '#acdce2', '#dcf8fa');
  const rose = pal('#4e3250', '#6e4870', '#94648e', '#b886b0', '#d8acd0', '#f4d4ec');
  const finM = pal('#3e060e', '#680a18', '#961424', '#c22432', '#e44040', '#ff7464');
  const finR = pal('#a0141e', '#c8242c', '#e8403a', '#ff6450', '#ff9070', '#ffc0a0');
  return {
    x0: 0, x1: 1, ink: hex('#140c1a'), iconWave: 1.1, iconRot: -Math.PI / 4,
    eye: { x: 0.948, y: -0.008, r: 0.013, iris: hex('#e8e0a0') },
    parts: [
      fin({ ...fan([0.05, -0.008], [0.05, 0.008], [[0.0, -0.03], [-0.012, 0.0], [0.0, 0.03]], 3), ramp: finM, rayRamp: finR, z: 4 }),
      // the endless red dorsal, rippling from the head to the tail tip
      fin({ ...dorsal(top, 0.06, 0.88, s => 0.03 * (0.82 + 0.18 * Math.sin(s * 22)) * Math.min(1, s * 12, (1 - s) * 20), -1, 0.1, 48), ramp: finM, rayRamp: finR, z: 4, t: 2, grad: 0.3, alpha: 200 }),
      body({
        top, bot, back: silver, side: silver, belly: silver, zb: 0.3, zl: 0.75, light: 0.8, spec: 0.8,
        mark: (p, b) => {
          // a scaleless iridescent ribbon: oblique cyan and rose bands, wavy grey streaks and black dots
          const k = frac(b.u * 26 + b.v * 0.8);
          let r = silver;
          if (b.v > 0.18 && b.v < 0.82) { if (k < 0.16) r = cyan; else if (k > 0.5 && k < 0.62) r = rose; }
          if (b.v > 0.15 && b.v < 0.85 && Math.abs(frac(b.u * 60 + Math.sin(b.v * 7 + b.u * 40) * 0.25) - 0.5) < 0.07 && p.S > 60) return toneD(silver, b.t - 1.2, p);
          if (spotP(p, p.x, p.y, 70, 0.22, 0.006, 5, 5) > 0 && b.v > 0.2 && b.v < 0.8) return tone(silver, 1);
          // tubercles: tiny bright bumps in rows
          return toneD(r, b.t, p);
        },
      }),
      // the crest: long red plumes on the head, webbed at the base, and the paddle-tipped pelvic oars
      fin({ ...fan([0.9, -0.03], [0.945, -0.03], [[0.85, -0.1], [0.874, -0.13], [0.9, -0.14], [0.92, -0.12]], 4), ramp: finM, rayRamp: finR, z: 3, alpha: 130, t: 2.6 }),
      ...[0, 1, 2, 3].map(k => tube({
        pts: [[0.9 + k * 0.014, -0.03], [0.875 + k * 0.012, -0.075 - k * 0.018], [0.85 + k * 0.012, -0.1 - k * 0.028]],
        r: [0.007, 0.006, 0.009], ramp: finR, z: 3, t: 2, minPx: 0.5,
      })),
      tube({ pts: [[0.9, 0.026], [0.86, 0.08], [0.8, 0.12]], r: [0.005, 0.004, 0.012], ramp: finR, z: 3, t: 1.8, minPx: 0.5 }),
    ],
  };
}

function glassMaomao(): FishArt {
  const top: Pt[] = [[0.19, -0.034], [0.28, -0.068], [0.4, -0.118], [0.54, -0.14], [0.68, -0.13], [0.8, -0.1], [0.9, -0.06], [0.96, -0.018]];
  const bot: Pt[] = [[0.19, 0.034], [0.28, 0.064], [0.4, 0.108], [0.54, 0.128], [0.68, 0.118], [0.8, 0.09], [0.9, 0.05], [0.96, 0.014]];
  const glass = pal('#163c74', '#2a5a98', '#4880be', '#72a8dc', '#a6ccf0', '#dcf2ff');
  const organs = pal('#0a1a52', '#122c82', '#1c44b0', '#3062d6', '#5686ee', '#88aeff');
  const finM = pal('#0e2c78', '#1a48a8', '#3470dc', '#64a0f4', '#a4ccff', '#d8eeff');
  const bone = hex('#f2faff'), boneDim = withAlpha(hex('#d8ecfc'), 190);
  const spine = curve([[0.2, 0.0], [0.4, -0.02], [0.6, -0.026], [0.8, -0.02], [0.86, -0.016]]);
  const top_ = curve(top), bot_ = curve(bot);
  return {
    x0: 0, x1: 1, ink: hex('#081640'),
    eye: { x: 0.868, y: -0.03, r: 0.032, iris: hex('#4ac8ff') },
    parts: [
      fin({ ...tail(0.21, 0.03, 0.16, 0.66, 13), ramp: finM, rayRamp: finM, z: 4, t: 2.2, alpha: 120 }),
      fin({ ...dorsal(top, 0.36, 0.72, softH(0.07, 0.6), -1, 0.4, 12), ramp: finM, rayRamp: finM, z: 4, t: 2.2, alpha: 120 }),
      fin({ ...dorsal(bot, 0.3, 0.52, softH(0.062, 0.6), 1, 0.4, 9), ramp: finM, rayRamp: finM, z: 4, t: 2.2, alpha: 120 }),
      body({
        top, bot, back: glass, side: glass, belly: glass, zb: 0.3, zl: 0.7, gill: 0.8, light: 0.5, spec: 0,
        mark: (p, b) => {
          // see-through: a glassy rim, a clear middle, and what shows inside it: spine, ribs, gut, gills
          const edge = 1.3 / Math.max(1, (bot_(p.x) - top_(p.x)) * p.S);
          if (b.v < edge || b.v > 1 - edge) return toneD(glass, b.t + 0.8, p);
          const sy = spine(p.x), big = p.S > 30, nv = Math.min(40, p.S / 3), thr = Math.min(0.45, (1.05 * nv) / p.S);
          if (!Number.isNaN(sy)) {
            const dy = (p.y - sy) * p.S;
            // the vertebral column, vertebra by vertebra
            if (Math.abs(dy) < (p.S > 60 ? 1 : 0.6)) return frac((p.x - 0.2) * nv) < 0.3 && p.S > 45 ? boneDim : bone;
            // neural spines above and haemal spines below, raked back; ribs arching round the gut
            const xs = p.x + (p.y - sy) * (dy < 0 ? 0.7 : 0.45);
            if (big && frac((xs - 0.2) * nv) < thr && xs > 0.24 && xs < 0.84) {
              const gut = xs > 0.44 && xs < 0.74;
              if (dy < 0 && b.v > 0.1) return boneDim;
              if (dy > 0 && b.v < (gut ? 0.92 : 0.84)) return gut ? bone : boneDim;
            }
          }
          // gills glowing pink through the gill cover
          if (b.head && p.x < 0.84 && b.v > 0.4 && b.v < 0.86 && frac((p.x - 0.8) * 120) < 0.5) return withAlpha(hex('#f08aa0'), 170);
          // the blue gut, and a silver swim bladder above it
          const g = Math.hypot((p.x - 0.64) / 0.09, (p.y - 0.045) / 0.05);
          if (g < 1 + (fbm(p.x * 60, p.y * 60, 3) - 0.5) * 0.3) return toneD(organs, 2.6 - (p.y - 0.045) * 30 + (g > 0.8 ? -1 : 0), p);
          const sb = Math.hypot((p.x - 0.55) / 0.11, (p.y + 0.002) / 0.022);
          if (sb < 1) return sb < 0.5 && p.y < 0 ? withAlpha(hex('#ffffff'), 235) : withAlpha(hex('#c4d4e4'), 215);
          if (Math.hypot((p.x - 0.84) / 0.05, (p.y + 0.01) / 0.05) < 1) return withAlpha(tone(glass, 1), 190);
          // a streak of sky caught on the upper flank, faint chevrons of muscle
          if (Math.abs(b.v - 0.2) * b.Hpx < 0.5 && b.u > 0.2 && b.u < 0.7 && hash(p.px >> 1, 1, 5) < 0.8) return withAlpha(hex('#ffffff'), 200);
          if (p.S > 60 && !b.head && Math.abs(frac((p.x + Math.abs(p.y - (sy || 0)) * 0.9) * nv * 0.5) - 0.5) < thr * 0.6) return withAlpha(tone(glass, 3), 120);
          return withAlpha(tone(glass, 2.2 + (b.v - 0.5) * 0.8), 78);
        },
      }),
      fin({ ...fan([0.78, 0.016], [0.78, 0.044], [[0.71, 0.0], [0.67, 0.03], [0.71, 0.06]], 5), ramp: finM, rayRamp: finM, z: 14, ink: true, t: 2.4, alpha: 120 }),
    ],
  };
}

function kahawai(): FishArt {
  const top: Pt[] = [[0.19, -0.028], [0.3, -0.052], [0.45, -0.076], [0.6, -0.086], [0.74, -0.082], [0.86, -0.064], [0.93, -0.04], [0.975, -0.01]];
  const bot: Pt[] = [[0.19, 0.028], [0.3, 0.048], [0.45, 0.066], [0.6, 0.072], [0.74, 0.068], [0.86, 0.054], [0.93, 0.034], [0.975, 0.01]];
  const back = pal('#051816', '#092624', '#103830', '#184c42', '#226256', '#2e7c6a');
  const side = pal('#3a5450', '#56746e', '#78968e', '#9eb8b0', '#c4dad2', '#e8f6f0');
  const belly = pal('#869694', '#aab8b6', '#c8d4d2', '#e2eae8', '#f4f8f8', '#ffffff');
  const sheen = pal('#344e26', '#4a6c32', '#668c40', '#88ac52', '#acca6c', '#d2e892');
  const spotR = pal('#020a0a', '#041210', '#081c18', '#0e2820', '#16362c', '#1e4436');
  const sail = pal('#08113a', '#0e1c5a', '#16297e', '#203ea2', '#3258c4', '#507ce0');
  const sailR = pal('#1a2c74', '#26409a', '#365abe', '#4c78da', '#709cf0', '#a0c4ff');
  const finM = pal('#0c1618', '#152628', '#21383a', '#304e50', '#46686a', '#628886');
  const finR = pal('#2e4a4a', '#426464', '#5a8080', '#789e9c', '#9cbebc', '#c4dede');
  return {
    x0: 0, x1: 1, ink: hex('#04100e'),
    eye: { x: 0.9, y: -0.022, r: 0.023, iris: hex('#ecd070') },
    parts: [
      fin({ ...tail(0.21, 0.026, 0.17, 0.7, 13), ramp: finM, rayRamp: finR, z: 4, t: 2 }),
      // the spinnaker: a tall sail fin, raised to steer and to herd baitfish
      fin({
        ...fan([0.35, -0.066], [0.79, -0.07], [[0.38, -0.14], [0.44, -0.24], [0.52, -0.3], [0.6, -0.31], [0.68, -0.28], [0.74, -0.2], [0.78, -0.12]], 13),
        ramp: sail, rayRamp: sailR, z: 4, t: 1.8, grad: 1.3, alpha: 225, edge: hex('#0a1640'),
        mark: (p, f) => {
          if (f.ray) return null;
          const s = spotP(p, p.x, p.y, 30, 0.6, 0.009, 31);
          return s > 0 && f.a > 0.2 ? (s > 0.5 && p.S > 34 ? hex('#cce4ff') : hex('#7ab0ff')) : null;
        },
      }),
      fin({ ...dorsal(bot, 0.3, 0.43, softH(0.046, 0.6), 1, 0.4, 7), ramp: finM, rayRamp: finR, z: 4 }),
      fin({ ...fan([0.74, 0.064], [0.78, 0.058], [[0.7, 0.09], [0.69, 0.104], [0.72, 0.1]], 3), ramp: finM, rayRamp: finR, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.66, sheen, sheenV: [0.38, 0.5], gill: 0.84, pre: 0.045, mouth: [0.975, 0.008, 0.06, 0.008],
        hints: 3, lat: [0.3, 0.48, 0.04], spec: 0.75,
        mark: (p, b) => {
          // the kahawai's dark spots and dashes over the back and upper flank
          if (b.v < 0.5 && b.u > 0.05) {
            const s = spotP(p, p.x * 0.75, p.y, 34, 0.7, 0.0085, 27);
            if (s > 0) return toneD(spotR, b.t + 0.5, p);
          }
          return null;
        },
      }),
      fin({ ...fan([0.8, 0.022], [0.8, 0.046], [[0.73, 0.008], [0.69, 0.03], [0.72, 0.052]], 5), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.6, alpha: 185 }),
    ],
  };
}

function sunwheelOpah(): FishArt {
  const top: Pt[] = [[0.16, -0.034], [0.24, -0.1], [0.34, -0.198], [0.46, -0.258], [0.58, -0.278], [0.7, -0.258], [0.8, -0.2], [0.88, -0.122], [0.93, -0.054], [0.945, 0.0]];
  const bot: Pt[] = [[0.16, 0.034], [0.24, 0.088], [0.34, 0.168], [0.46, 0.218], [0.58, 0.234], [0.7, 0.214], [0.8, 0.166], [0.88, 0.1], [0.93, 0.052], [0.945, 0.012]];
  const back = pal('#200620', '#361032', '#4e1c48', '#682c60', '#84427a', '#a05c94');
  const side = pal('#723456', '#944c6e', '#b46888', '#ce88a2', '#e4aabe', '#f4ccd8');
  const belly = pal('#a28692', '#c0a4b0', '#dac2ca', '#ecdae0', '#f8eef2', '#fffafc');
  const sheen = pal('#28366a', '#3a4e8a', '#5068a6', '#6a88c2', '#90aada', '#b8d0f0');
  const finM = pal('#3a040e', '#5e0a16', '#880f20', '#b01c2a', '#d43238', '#f05650');
  const finR = pal('#8a1420', '#b8242c', '#dc3c3c', '#f86050', '#ff8c70', '#ffbea0');
  const gold = pal('#664008', '#986812', '#c49222', '#e6b63a', '#f8d462', '#fff098');
  const eye = { x: 0.855, y: -0.056, r: 0.038, iris: hex('#f8d060'), ring: hex('#e8b030') };
  return {
    x0: 0, x1: 1, ink: hex('#1c0412'), eye,
    parts: [
      fin({ ...tail(0.18, 0.032, 0.18, 0.72, 13), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      // a tall sickle dorsal up front, running back into a low crest
      fin({
        ...fan([0.7, -0.254], [0.26, -0.13], [[0.66, -0.36], [0.6, -0.44], [0.57, -0.42], [0.56, -0.34], [0.5, -0.28], [0.42, -0.25], [0.3, -0.19], [0.24, -0.12]], 14, [[0.6, -0.44], [0.57, -0.42], [0.56, -0.34], [0.5, -0.28], [0.42, -0.25], [0.3, -0.19], [0.24, -0.12]]),
        ramp: finM, rayRamp: finR, z: 4, t: 2.4,
      }),
      fin({ ...dorsal(bot, 0.24, 0.52, softH(0.04, 0.5), 1, 0.3, 12), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      fin({ ...fan([0.66, 0.2], [0.71, 0.196], [[0.62, 0.27], [0.6, 0.3], [0.64, 0.31]], 4), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
      body({
        top, bot, back, side, belly, zb: 0.34, zl: 0.66, sheen, sheenV: [0.16, 0.32], gill: 0.8, pre: 0.05, mouth: [0.945, 0.004, 0.05, 0.01],
        hints: 3, lat: [0.18, 0.5, 0.16], spec: 0.7,
        mark: (p, b) => {
          // crimson jaws
          if (p.x > 0.915 && Math.abs(p.y - 0.006) < 0.03) return toneD(finM, b.t + 0.4, p);
          // the sunburst: gold rays fanning back from the eye
          const a = Math.atan2(p.y - eye.y, p.x - eye.x), d = Math.hypot(p.x - eye.x, p.y - eye.y);
          if (d > 0.046 && d < 0.17 - Math.abs(Math.sin(a * 3)) * 0.03 && Math.abs(Math.sin(a * 6)) < 0.3 && b.u > 0.6) return tone(gold, 4.4 - d * 12);
          // silver-white spots spread evenly over the flank
          if (b.u < 0.82 && !b.lat) {
            const s = spotP(p, p.x, p.y, 24, 0.8, 0.011, 41, 6);
            if (s > 0) return tone(belly, s > 0.5 ? 5 : 4);
          }
          return null;
        },
      }),
      // the sun-wheel: a round crimson pectoral with curved spokes round a gold hub
      disc({
        x: 0.66, y: 0.03, rx: 0.082, ramp: finM, z: 14, ink: true, t: 2.4, light: 0.6,
        mark: (p, nx, ny, t) => {
          const r = Math.hypot(nx, ny), a = Math.atan2(ny, nx) - r * 0.7, R = 0.082 * p.S;
          if (r < 0.28) return toneD(gold, 3.4 + (-nx - ny) * 2.2, p);
          if (r < 0.36) return tone(gold, 1);
          if (r > 0.86) return tone(finM, t + 0.6);
          const k = Math.abs(frac((a / (Math.PI * 2)) * 11) - 0.5) * 2;
          if ((1 - k) * (Math.PI * 2 / 11) * r * R * 0.5 < 0.55) return tone(finR, t + 1.4);
          return withAlpha(toneD(finM, t + (r - 0.5) * -1.2, p, 0.5), 225);
        },
      }),
    ],
  };
}

function snoutLouse(): FishArt {
  // seen from above: head (+x) with big dark eyes, seven plated segments, a tail fan, hooked legs
  const shell = pal('#4a3022', '#745038', '#9c7456', '#c09a78', '#dcbc9a', '#f4dcc0');
  const legs = pal('#4a2a1c', '#74462e', '#9c6a4a', '#c08e6a', '#dcb28c', '#f0d2b0');
  const top: Pt[] = [[0.08, -0.07], [0.18, -0.13], [0.34, -0.17], [0.52, -0.18], [0.7, -0.16], [0.84, -0.11], [0.93, -0.05], [0.96, 0.0]];
  const bot: Pt[] = [[0.08, 0.07], [0.18, 0.13], [0.34, 0.17], [0.52, 0.18], [0.7, 0.16], [0.84, 0.11], [0.93, 0.05], [0.96, 0.0]];
  const legParts: Part[] = [];
  for (let k = 0; k < 7; k++) for (const s of [-1, 1]) {
    const x = 0.3 + k * 0.085;
    legParts.push(tube({ pts: [[x, s * 0.12], [x + 0.02, s * 0.22], [x + 0.06, s * 0.25], [x + 0.075, s * 0.232]], r: [0.016, 0.013, 0.01, 0.008], ramp: legs, z: 3, t: 2.2, minPx: 0.5 }));
  }
  return {
    x0: 0, x1: 1, ink: hex('#20120a'),
    eye: { x: 0.9, y: -0.06, r: 0.03, iris: hex('#101010') },
    parts: [
      ...legParts,
      fin({ ...fan([0.13, -0.07], [0.13, 0.07], [[0.04, -0.12], [-0.02, -0.06], [-0.03, 0.0], [-0.02, 0.06], [0.04, 0.12]], 5), ramp: shell, rayRamp: shell, z: 4, t: 2.6, alpha: 255, edge: null }),
      body({
        top, bot, back: shell, side: shell, belly: shell, zb: 0.2, zl: 0.9, light: 1, spec: 0.7,
        mark: (p, b) => {
          // seven armoured plates, each overlapping the next: a dark suture, a lit bulge, pitted chitin
          const k = ((b.u - 0.24) / 0.62) * 7, kf = frac(k);
          const plate = b.u > 0.24 && b.u < 0.86;
          if (plate && kf < 0.14 && b.Hpx > 3) return tone(shell, b.t - 1.8);
          if (plate && kf > 0.5 && kf < 0.75 && b.v > 0.22 && b.v < 0.78) return toneD(shell, b.t + 0.9, p);
          // the side plates (coxae) set off from the back
          if (b.Hpx > 10 && (Math.abs(b.v - 0.17) * b.Hpx < 0.5 || Math.abs(b.v - 0.83) * b.Hpx < 0.5) && b.u > 0.24 && b.u < 0.86) return tone(shell, b.t - 1.2);
          // the short pleon segments ahead of the tail fan
          if (b.u < 0.24 && b.u > 0.08 && frac(b.u * 34) < 0.2) return tone(shell, b.t - 1.4);
          // a pale ridge down the middle
          if (Math.abs(b.v - 0.5) * b.Hpx < 0.5 && b.Hpx > 8) return tone(shell, b.t + 0.7);
          return null;
        },
      }),
      tube({ pts: [[0.95, -0.03], [1.02, -0.08], [1.06, -0.1]], r: [0.012, 0.01, 0.008], ramp: legs, z: 3, minPx: 0.5, rings: 4 }),
      tube({ pts: [[0.95, 0.03], [1.02, 0.08], [1.06, 0.1]], r: [0.012, 0.01, 0.008], ramp: legs, z: 3, minPx: 0.5, rings: 4 }),
      disc({ x: 0.895, y: 0.06, rx: 0.03, ramp: pal('#060404', '#140e0e', '#2a2222', '#463a3a', '#6a5c5c', '#9a8c8c'), z: 16, t: 1, mark: (p, nx, ny) => (hash(p.px, p.py, 3) < 0.25 && Math.hypot(nx, ny) < 0.8 ? tone(pal('#3a3030'), 0) : null) }),
    ],
  };
}

const ART_FNS: Record<string, () => FishArt> = {
  snoutbass: snoutBass,
  lanterncod: lanternCod,
  sixfinger: gurnard,
  mirrordory: mirrorDory,
  hammersnapper: hammerSnapper,
  bubblepuffer: bubblePuffer,
  ribboneel: ribbonEel,
  glassmaomao: glassMaomao,
  spinnaker: kahawai,
  sunwheel: sunwheelOpah,
  snoutlouse: snoutLouse,
};
const artCache = new Map<string, FishArt>();
function art(id: string): FishArt {
  let a = artCache.get(id);
  if (!a) { a = (ART_FNS[id] ?? snoutBass)(); a.parts.sort((p, q) => p.z - q.z); artCache.set(id, a); }
  return a;
}
export const FISH_ART_IDS = () => Object.keys(ART_FNS).filter(k => k !== 'snoutlouse');

// ------------------------------------------------------------------ the rasteriser
interface View {
  /** pixels per fish unit */
  S: number;
  /** head direction on screen, radians (0 = right, -PI/4 = up-right) */
  rot: number;
  /** pixel position of fish-local (0, 0) */
  ox: number; oy: number;
  /** body bend: tail swing (swim), an arch (flop) and a whole-body S-wave (eels) */
  swing?: number; arch?: number; wave?: number;
  detail: number;
  /** world-scale: skip iconOnly ornaments */
  world?: boolean;
}
const LIGHT: [number, number, number] = (() => { const l = [-0.5, -0.72, 0.55]; const n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n] as [number, number, number]; })();

/** bend offset (fish units, belly-ward) at local x: tail swing and a whole-body arch */
function bendAt(v: View, x: number, a: FishArt) {
  const span = a.x1 - a.x0, u = (x - a.x0) / span;
  return (v.swing ?? 0) * Math.pow(Math.max(0, 0.62 - u) / 0.62, 2) * span * 0.18 + (v.arch ?? 0) * (Math.pow(u - 0.52, 2) - 0.08) * span * 1.5
    + (v.wave ?? 0) * Math.sin((u - 0.08) * Math.PI * 2) * span * 0.08;
}

interface Raster { buf: PixelBuffer; part: Int16Array }
/** a pixel context for a view: the light turned into the fish's frame */
function pxFor(v: View): Px {
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  const L: [number, number, number] = [LIGHT[0] * cs + LIGHT[1] * sn, -LIGHT[0] * sn + LIGHT[1] * cs, LIGHT[2]];
  const h = [L[0], L[1], L[2] + 1], hn = Math.hypot(h[0], h[1], h[2]);
  return { x: 0, y: 0, px: 0, py: 0, S: v.S, L, H: [h[0] / hn, h[1] / hn, h[2] / hn], ax: cs / v.S, ay: -sn / v.S, bx: sn / v.S, by: cs / v.S, detail: v.detail };
}
/** shade one output pixel: the top part that paints there, with translucent parts laid over the ones below */
function shadeAt(a: FishArt, v: View, pp: Px, px: number, py: number, mask: boolean, fx = 0.5, fy = 0.5): [C, number] {
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  const dx = px + fx - v.ox, dy = py + fy - v.oy;
  const x = (dx * cs + dy * sn) / v.S;
  const y = (-dx * sn + dy * cs) / v.S + bendAt(v, x, a);
  const P = a.parts;
  let c: C = 0, top = -1;
  for (let i = P.length - 1; i >= 0; i--) {
    const q = P[i];
    if (mask && q.noShadow) continue;
    if (v.world && q.iconOnly) continue;
    if (!q.hit(x, y, v.S)) continue;
    if (mask) return [0xffffffff, i];
    pp.x = x; pp.y = y; pp.px = px; pp.py = py;
    const ci = q.paint(pp);
    if (!ci) continue;
    if (top < 0) { c = ci; top = i; } else c = over(c, ci);
    if (c >>> 24 === 255) break;
  }
  return [c, top];
}
function raster(a: FishArt, w: number, h: number, v: View, mask = false): Raster {
  const buf = new PixelBuffer(w, h);
  const part = new Int16Array(w * h).fill(-1);
  const pp = pxFor(v);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const [c, top] = shadeAt(a, v, pp, px, py, mask);
    if (top < 0 || !c) continue;
    buf.data[py * w + px] = c;
    part[py * w + px] = top;
  }
  return { buf, part };
}

/** ink: the outline around the silhouette, and a line where an inked part lies over another part */
function inkUp(r: Raster, a: FishArt, inner = true) {
  const { buf, part } = r, w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!(src[i] >>> 24)) {
      // the outline takes a darker hue of the colour it wraps, and breaks lighter where the light
      // from the top-left grazes the silhouette (the shape lies only below / right of this pixel)
      const lo = op(x, y + 1), ri = op(x + 1, y), up = op(x, y - 1), le = op(x - 1, y);
      if (!(lo || ri || up || le)) continue;
      const k = lo ? i + w : ri ? i + 1 : up ? i - w : i - 1;
      const lit = (lo || ri) && !up && !le;
      d[i] = lmix(a.ink, withAlpha(src[k], 255), lit ? 0.42 : 0.2);
      continue;
    }
    if (!inner) continue;
    const pi = part[i], q = a.parts[pi];
    if (!q?.ink) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const pj = part[ny * w + nx];
      if (pj >= 0 && pj !== pi && a.parts[pj].z < q.z) { d[i] = lmix(a.ink, withAlpha(src[i], 255), 0.38); break; }
    }
  }
}

/** drop lone pixels that stick out of the silhouette (they read as noise at small sizes) */
function despeck(r: Raster, a: FishArt) {
  const { buf, part } = r, w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!(src[i] >>> 24)) continue;
    if (a.parts[part[i]]?.minPx) continue;
    const n = (op(x - 1, y) ? 1 : 0) + (op(x + 1, y) ? 1 : 0) + (op(x, y - 1) ? 1 : 0) + (op(x, y + 1) ? 1 : 0);
    if (n <= 1) { d[i] = 0; part[i] = -1; }
  }
}

/** soft glow around glowing parts (icons): translucent pixels in the empty space next to them */
function haloUp(r: Raster, a: FishArt) {
  const { buf, part } = r, w = buf.w, h = buf.h;
  const src = buf.data.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x] >>> 24) continue;
    let best = 9, col = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const pi = part[Y * w + X];
      const q = pi >= 0 ? a.parts[pi] : null;
      if (!q?.halo) continue;
      const d = Math.hypot(i, j);
      if (d < best) { best = d; col = q.halo; }
    }
    if (col && best <= 2.3) buf.data[y * w + x] = withAlpha(col, best < 1.5 ? 150 : 70);
  }
}

/** 3x3 block majority of a coverage mask: opaque when at least 4 of 9 samples are, keeping the
 *  commonest part and one of its samples (the middle sample counts double so features stay centred) */
function downsample(hi: Raster, w: number, h: number): Raster & { sub: Uint8Array } {
  const buf = new PixelBuffer(w, h), part = new Int16Array(w * h).fill(-1), sub = new Uint8Array(w * h);
  const W = hi.buf.w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const count = new Map<number, number>();
    let n = 0, bestN = 0, bp = -1, bs = 4;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const k = (y * 3 + j) * W + x * 3 + i, q = hi.part[k];
      if (q < 0) continue;
      n++;
      const wgt = (i === 1 && j === 1 ? 2 : 1) + (count.get(q) ?? 0);
      count.set(q, wgt);
      if (wgt > bestN) { bestN = wgt; bp = q; bs = j * 3 + i; }
    }
    if (n >= 4) { buf.data[y * w + x] = 0xffffffff; part[y * w + x] = bp; sub[y * w + x] = bs; }
  }
  return { buf, part, sub };
}
/** small sprites: keep the 3x silhouette but paint each pixel at its own centre (or, on the edge, at
 *  one of its covered samples), so zones and marks stay crisp */
function repaint(r: Raster & { sub: Uint8Array }, a: FishArt, v: View) {
  const { buf, part, sub } = r, pp = pxFor(v);
  for (let py = 0; py < buf.h; py++) for (let px = 0; px < buf.w; px++) {
    const i = py * buf.w + px;
    if (part[i] < 0) continue;
    let [c, top] = shadeAt(a, v, pp, px, py, false);
    if (top < 0 || !c) [c, top] = shadeAt(a, v, pp, px, py, false, ((sub[i] % 3) + 0.5) / 3, (Math.floor(sub[i] / 3) + 0.5) / 3);
    if (top >= 0 && c) { buf.data[i] = c; part[i] = top; } else { buf.data[i] = 0; part[i] = -1; }
  }
}

/** local -> pixel */
function toPx(v: View, a: FishArt, x: number, y: number): Pt {
  const yb = y - bendAt(v, x, a);
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  return [v.ox + (x * cs - yb * sn) * v.S, v.oy + (x * sn + yb * cs) * v.S];
}

/** the eye, placed by hand so it always reads wet: socket, iris (dark under the lid, bright where the
 *  lens gathers light), pupil and a sharp glint, scaled down to 2x2 and 2 px forms on small sprites */
function drawEye(r: Raster, a: FishArt, v: View, boost = 1) {
  const b = r.buf, e = a.eye;
  const [ex, ey] = toPx(v, a, e.x, e.y);
  // big round eyes, as a naturalist draws them
  const rp = e.r * v.S * boost * 1.2;
  const put = (x: number, y: number, c: C) => { if (b.opaque(x, y)) b.set(x, y, c); };
  const pupil = hex('#07050a'), white = hex('#ffffff');
  const irisLo = lmix(e.iris, white, 0.3), irisHi = lmix(e.iris, a.ink, 0.45);
  if (rp < 0.7) { put(Math.floor(ex), Math.floor(ey), pupil); return; }
  if (rp < 1.2) {
    // 2 px: iris behind, pupil in front (toward the snout)
    const x = Math.floor(ex), y = Math.floor(ey);
    const fx = Math.cos(v.rot) > 0 ? 1 : -1;
    put(x, y, pupil); put(x - fx, y, e.iris);
    return;
  }
  if (rp < 1.85) {
    // 2x2: a white catch-light on a dark pupil, the iris showing below
    const x = Math.floor(ex - 0.5), y = Math.floor(ey - 0.5);
    put(x, y, white); put(x + 1, y, pupil); put(x, y + 1, irisLo); put(x + 1, y + 1, pupil);
    return;
  }
  const fx = Math.cos(v.rot) >= 0 ? 1 : -1;
  for (let y = Math.floor(ey - rp - 1); y <= Math.ceil(ey + rp + 1); y++) for (let x = Math.floor(ex - rp - 1); x <= Math.ceil(ex + rp + 1); x++) {
    const X = x + 0.5 - ex, Y = y + 0.5 - ey, d = Math.hypot(X, Y);
    if (d > rp) continue;
    if (d > rp - 0.9) { put(x, y, Y > rp * 0.45 ? lmix(e.ring ?? e.iris, white, 0.25) : e.ring ?? lmix(a.ink, e.iris, 0.25)); continue; }
    if (Math.hypot(X - fx * rp * 0.08, Y) < rp * 0.5) { put(x, y, pupil); continue; }
    const k = Y / rp;
    put(x, y, k < -0.3 ? irisHi : k > 0.25 ? irisLo : e.iris);
  }
  const gx = Math.floor(ex - rp * 0.38), gy = Math.floor(ey - rp * 0.38);
  put(gx, gy, white);
  if (rp >= 3) put(gx + 1, gy, white);
  put(Math.floor(ex + rp * 0.3), Math.floor(ey + rp * 0.32), lmix(white, e.iris, 0.4));
}

/** fit a fish into a w x h box at rotation rot (returns the view) */
function fit(a: FishArt, w: number, h: number, rot: number, pad: number, detail: number, extra: Partial<View> = {}): View {
  const probe: View = { S: 1, rot: 0, ox: 0, oy: 0, detail, ...extra };
  const pts = a.parts.flatMap(p => p.bounds).map(([x, y]) => [x, y - bendAt(probe, x, a)] as Pt);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    const X = x * cs - y * sn, Y = x * sn + y * cs;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  const S = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
  return { S, rot, ox: w / 2 - ((x0 + x1) / 2) * S, oy: h / 2 - ((y0 + y1) / 2) * S, detail, ...extra };
}

// ------------------------------------------------------------------ public renders
const cache = new Map<string, PixelBuffer>();
const cached = (k: string, f: () => PixelBuffer) => { let b = cache.get(k); if (!b) { b = f(); cache.set(k, b); } return b; };

/** icon (default 32x32), head up-right on the diagonal */
export function fishIcon(id: string, size = 32): PixelBuffer {
  return cached(`icon:${id}:${size}`, () => {
    const a = art(id);
    const v = fit(a, size, size, a.iconRot ?? -Math.PI / 4, a.iconPad ?? 1.5, 1, { swing: a.iconSwing ?? 0, arch: a.iconArch ?? 0, wave: a.iconWave ?? 0 });
    const r = raster(a, size, size, v);
    despeck(r, a);
    // icons are read up close: the eye is drawn a touch large so its glint always shows
    drawEye(r, a, v, Math.max(1, 1.3 / Math.max(1e-6, a.eye.r * v.S)));
    inkUp(r, a);
    haloUp(r, a);
    a.iconPost?.(r.buf);
    return r.buf;
  });
}

/** side view at world scale: len px from tail to snout, head right. swing/arch bend the body (flop frames). */
export function fishSide(id: string, len: number, o: { swing?: number; arch?: number; detail?: number } = {}): PixelBuffer {
  const L = Math.max(4, Math.round(len));
  return cached(`side:${id}:${L}:${o.swing ?? 0}:${o.arch ?? 0}:${o.detail ?? -1}`, () => {
    const a = art(id);
    const S = L / (a.x1 - a.x0);
    const probe: View = { S: 1, rot: 0, ox: 0, oy: 0, detail: 0, swing: o.swing, arch: o.arch };
    const pts = a.parts.filter(p => !(p.iconOnly && L < 40)).flatMap(p => p.bounds).map(([x, y]) => [x, y - bendAt(probe, x, a)] as Pt);
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const w = Math.ceil((x1 - x0) * S) + 4, h = Math.ceil((y1 - y0) * S) + 4;
    const v: View = { S, rot: 0, ox: 2 - x0 * S, oy: 2 - y0 * S, swing: o.swing, arch: o.arch, detail: o.detail ?? (L >= 48 ? 1 : L >= 26 ? 0.5 : 0.1), world: L < 40 };
    // small sprites: find the silhouette at 3x (each 3x3 block's majority), so thin tails and fins
    // survive as whole pixels instead of breaking up into specks, then paint every pixel at its centre
    let r: Raster;
    if (L < 24) {
      const lo = downsample(raster(a, w * 3, h * 3, { ...v, S: S * 3, ox: v.ox * 3, oy: v.oy * 3, detail: 0.1 }, true), w, h);
      repaint(lo, a, v);
      r = lo;
    } else r = raster(a, w, h, v);
    if (L >= 24 && L < 48) despeck(r, a);
    drawEye(r, a, v);
    inkUp(r, a, L >= 20);
    return r.buf.trim(0).buf;
  });
}

/** tiny side view for the tank in the hold */
export function fishTank(id: string): PixelBuffer {
  return fishSide(id, TANK_LEN[id] ?? 9, { detail: 0 });
}
const TANK_LEN: Record<string, number> = { ribboneel: 15, bubblepuffer: 8, sunwheel: 11, mirrordory: 9, glassmaomao: 9, snoutbass: 10 };

/** white silhouette (soft 2x2-supersampled edge) for the underwater shadow; head right */
export function fishShadow(id: string, len: number, swing = 0, arch = 0): PixelBuffer {
  const L = Math.max(4, Math.round(len));
  const sw = Math.round(swing * 10) / 10, ar = Math.round(arch * 10) / 10;
  return cached(`shadow:${id}:${L}:${sw}:${ar}`, () => {
    const a = art(id);
    const S = L / (a.x1 - a.x0);
    const probe: View = { S: 1, rot: 0, ox: 0, oy: 0, detail: 0, swing: sw, arch: ar };
    const pts = a.parts.filter(p => !p.noShadow && !p.iconOnly).flatMap(p => p.bounds).map(([x, y]) => [x, y - bendAt(probe, x, a)] as Pt);
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const w = Math.ceil((x1 - x0) * S) + 4, h = Math.ceil((y1 - y0) * S) + 4;
    // 2x supersampled mask, box-filtered down: soft edges like a real shadow
    const v: View = { S: S * 2, rot: 0, ox: (2 - x0 * S) * 2, oy: (2 - y0 * S) * 2, swing: sw, arch: ar, detail: 0, world: true };
    const hi = raster(a, w * 2, h * 2, v, true).buf;
    const out = new PixelBuffer(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (hi.data[(y * 2 + j) * w * 2 + x * 2 + i] >>> 24) n++;
      if (n) out.data[y * w + x] = rgba(255, 255, 255, n === 4 ? 255 : n === 3 ? 200 : n === 2 ? 130 : 70);
    }
    return out;
  });
}

/** the snout louse: icon and a side sprite (seen from above either way) */
export const louseIcon = (size = 24) => fishIcon('snoutlouse', size);
export const louseSide = (len: number) => fishSide('snoutlouse', len);

/** pixel canvas of a buffer, scaled by an integer (DOM: banner, field guide) */
export function canvasOf(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  return buf.toCanvas(scale);
}

/** where a fish-local point (x, y) lands in fishSide(id, len) (px from its top-left, unbent) */
export function sidePoint(id: string, len: number, x: number, y: number): Pt {
  const a = art(id);
  const L = Math.max(4, Math.round(len));
  const S = L / (a.x1 - a.x0);
  const pts = a.parts.filter(p => !(p.iconOnly && L < 40)).flatMap(p => p.bounds);
  let y0 = Infinity, x0 = Infinity;
  for (const [px, py] of pts) { y0 = Math.min(y0, py); x0 = Math.min(x0, px); }
  // fishSide pads by 2 px and then trims the transparent border (the outline sits 1 px outside)
  return [(x - x0) * S + 1, (y - y0) * S + 1];
}

/** where a hand holds a side-view fish sprite (facing right) by the tail: the narrowest column in
 *  the tail third (the wrist of the tail, just ahead of the fin), at the middle of the body there */
export function gripOf(h: { w: number; h: number; px?: Uint32Array; data?: Uint32Array }): Pt {
  const px = h.px ?? h.data!;
  let best = -1, bh = Infinity, by = h.h / 2;
  for (let x = Math.floor(h.w * 0.1); x <= Math.ceil(h.w * 0.36); x++) {
    let t = -1, b = -1;
    for (let y = 0; y < h.h; y++) if (px[y * h.w + x] >>> 24) { if (t < 0) t = y; b = y; }
    if (t < 0) continue;
    if (b - t < bh) { bh = b - t; best = x; by = (t + b) / 2; }
  }
  return [best < 0 ? Math.round(h.w * 0.2) : best, Math.round(by)];
}
