// V9 fish art: the ten invented species that bite off the Kittiwake's stern (see ../../ui/v4/fishing.ts
// FISH and the field guide in ../../game/v9/species-fish.ts) and the snout louse that lives in a
// snout bass's trunk. Every fish is one shape description in fish-local units (x runs from the tail
// tip at 0 to the snout at ~1, y points to the belly) made of parts: the body (a dorsal and a ventral
// profile), fins (polygons with rays), tubes (trunk, barbel, finger rays) and discs (bulbs, the
// sun-wheel), each with its own material. One rasteriser renders it at any size and angle:
//
//   fishIcon(id)                 32x32 icon on the diagonal, head up-right, like an inventory sheet
//   fishSide(id, len, o)         side view at world scale (len px from tail to snout, head right),
//                                with flop / swim bends, for Mori's hands and the catch photo
//   fishTank(id)                 tiny side view for the hold tank
//   fishShadow(id, len, swing)   white silhouette with a soft edge, tinted and drawn translucent
//                                under the water as the fish's shadow
//   louseIcon() / louseSide(len) the snout louse
//
// Look (after a classic pixel fish sheet): albedo first, light second. Strong counter-shading in
// hand-picked 5-tone ramps (dark back, mid flank, a bright belly band right up to the ventral edge),
// dark fins with lighter rays, markings in chunky 2x2 clusters, a crisp tinted ink outline, and a
// hand-placed eye with a coloured iris and a highlight. The key light (top-left of the screen) is
// rotated into the fish's frame, so an icon on the diagonal is lit like a side view.

import { PixelBuffer } from '../pixel';
import { C, hex, rgba, withAlpha } from '../color';
import { lmix } from '../beasts-core';

type Pt = [number, number];
type Ramp = C[];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const frac = (v: number) => v - Math.floor(v);
const hash = (x: number, y: number, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s + 1, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** a ramp from hex strings, dark -> light */
const pal = (...h: string[]): Ramp => h.map(x => hex(x));
/** pick a tone (0 = darkest) */
const tone = (r: Ramp, t: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
/** chunky 2x2 cluster noise in output pixels */
const cell = (p: Px, seed: number, k = 2) => hash(Math.floor(p.px / k), Math.floor(p.py / k), seed);

// ------------------------------------------------------------------ geometry helpers
/** monotone cubic through points sorted by x (Fritsch-Carlson); NaN outside the range */
function curve(pts: Pt[]): (x: number) => number {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    if (x < xs[0] || x > xs[n - 1]) return NaN;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
function inPoly(p: Pt[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist(x: number, y: number, a: Pt, b: Pt): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp01(((x - a[0]) * dx + (y - a[1]) * dy) / l2);
  return [Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t), t];
}
function polyEdgeDist(p: Pt[], x: number, y: number) {
  let m = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) m = Math.min(m, segDist(x, y, p[j], p[i])[0]);
  return m;
}

// ------------------------------------------------------------------ the shape language
/** what a part hands its painter for one pixel */
export interface Px {
  /** fish-local position */
  x: number; y: number;
  /** pixel position in the output (for texture patterns) */
  px: number; py: number;
  /** pixels per fish unit */
  S: number;
  /** key light in the fish's frame (x forward, y belly-ward, z toward the viewer) */
  L: [number, number, number];
  /** big renders get scales, rays and glints; tiny ones stay flat */
  detail: number;
}
interface Part {
  z: number;
  /** ink line where this part lies over a lower part */
  ink?: boolean;
  /** minimum rendered half-thickness in px (thin barbels and rays never vanish) */
  minPx?: number;
  hit(x: number, y: number, S: number): boolean;
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
  /** icon extras drawn after the ink (bubbles, sparkles): [x, y] in icon px -> colour */
  iconPost?: (b: PixelBuffer) => void;
}

/** light a surface normal: -1..1 */
const lit = (p: Px, nx: number, ny: number) => {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return nx * p.L[0] + ny * p.L[1] + nz * p.L[2];
};

interface BodyOpt {
  top: Pt[]; bot: Pt[];
  /** zone colours: back / flank / belly ramps and where they meet (0 = dorsal edge, 1 = ventral edge) */
  back: Ramp; side: Ramp; belly: Ramp;
  zb?: number; zl?: number;
  /** how much the key light moves the tones (albedo dominates) */
  light?: number;
  /** extra per-pixel paint on top of the zones: return a colour, or null to keep */
  mark?: (p: Px, u: number, v: number, t: number) => C | null;
  /** gill cover line at this x (0 = none) */
  gill?: number;
  /** mouth line: [x, y, length] */
  mouth?: [number, number, number];
  /** scale texture on big renders 0..1 */
  scales?: number;
  z?: number;
  ink?: boolean;
}
function body(o: BodyOpt): Part {
  const top = curve(o.top), bot = curve(o.bot);
  const x0 = Math.max(o.top[0][0], o.bot[0][0]), x1 = Math.min(o.top[o.top.length - 1][0], o.bot[o.bot.length - 1][0]);
  const zb0 = o.zb ?? 0.36, zl0 = o.zl ?? 0.68;
  return {
    z: o.z ?? 10, ink: o.ink ?? true,
    bounds: [...o.top, ...o.bot],
    hit(x, y) {
      if (x < x0 || x > x1) return false;
      return y >= top(x) && y <= bot(x);
    },
    paint(p) {
      const T = top(p.x), Bt = bot(p.x);
      const v = (p.y - T) / Math.max(1e-6, Bt - T);
      const u = (p.x - x0) / (x1 - x0);
      // a rounded solid: across it the normal swings from the back to the belly, and it turns
      // forward over the head and back over the tail stock
      const ny = (v * 2 - 1) * 0.9;
      const nx = u > 0.84 ? (u - 0.84) / 0.16 * 0.55 : u < 0.1 ? -(0.1 - u) / 0.1 * 0.3 : 0;
      const l = lit(p, nx, ny);
      const zb = zb0 + Math.sin(p.x * 29) * 0.025, zl = zl0 + Math.sin(p.x * 21 + 1) * 0.025;
      let zone: Ramp, t: number;
      if (v < zb) { zone = o.back; t = 1.2 + (v / zb) * 0.8; }
      else if (v < zl) { zone = o.side; t = 2 + ((v - zb) / (zl - zb)) * 0.7; }
      else { zone = o.belly; t = v > 0.92 ? 2.3 : v > zl + 0.07 ? 3.6 : 3; }
      t += l * (o.light ?? 0.5);
      // scale rows: a soft diagonal lattice on the flank of big renders
      if (p.detail > 0.7 && (o.scales ?? 0.5) > 0 && v > 0.14 && v < zl && u > 0.12 && u < 0.8) {
        const s = Math.max(2.4, p.S * 0.03);
        const d1 = frac((p.x + p.y) * p.S / s / 1.41), d2 = frac((p.x - p.y) * p.S / s / 1.41);
        if (Math.min(d1, d2) < 0.2) t -= 0.5 * (o.scales ?? 0.5);
      }
      let c = tone(zone, t);
      // gill cover: a dark crescent with a lit rim behind it
      if (o.gill && v > 0.14 && v < 0.9 && p.detail > 0.2) {
        const gx = o.gill - Math.pow(v - 0.5, 2) * 0.07;
        const d = (p.x - gx) * p.S;
        if (d > -0.5 && d < 0.55) c = tone(zone, t - 1.5);
        else if (d >= 0.55 && d < 1.55 && p.detail > 0.6) c = tone(zone, t + 0.7);
      }
      if (o.mouth) {
        const [mx, my, ml] = o.mouth;
        if (Math.abs(p.y - my) * p.S < 0.55 && p.x > mx - ml) c = tone(o.back, 0);
      }
      return o.mark?.(p, u, v, t) ?? c;
    },
  };
}

interface FinOpt {
  pts: Pt[];
  ramp: Ramp;
  /** where the rays converge (the fin's root) */
  root?: Pt;
  rays?: number;
  z?: number;
  /** base tone */
  t?: number;
  ink?: boolean;
  mark?: (p: Px, t: number) => C | null;
  /** colour of the free edge (1px) on big renders */
  edge?: C;
  iconOnly?: boolean;
}
function fin(o: FinOpt): Part {
  const pts = o.pts;
  const root = o.root ?? pts[0];
  let cx = 0, cy = 0;
  for (const q of pts) { cx += q[0]; cy += q[1]; }
  cx /= pts.length; cy /= pts.length;
  const a0 = Math.atan2(cy - root[1], cx - root[0]);
  return {
    z: o.z ?? 5, ink: o.ink, bounds: pts, iconOnly: o.iconOnly,
    hit: (x, y) => inPoly(pts, x, y),
    paint(p) {
      let t = o.t ?? 1.2;
      const dr = Math.hypot(p.x - root[0], p.y - root[1]) * p.S;
      // rays fan out from the root: lighter spines on a dark membrane
      if (o.rays && p.detail > 0.2 && dr > 1.2) {
        const a = Math.atan2(p.y - root[1], p.x - root[0]) - a0;
        const k = frac(a * o.rays / 1.6 + 0.5);
        if (k < 0.34) t += 1.2;
      }
      if (o.edge !== undefined && p.detail > 0.6 && polyEdgeDist(pts, p.x, p.y) * p.S < 1 && dr > 2) return o.edge;
      t += p.L[2] * 0.2;
      return o.mark?.(p, t) ?? tone(o.ramp, t);
    },
  };
}

interface TubeOpt { pts: Pt[]; r: number[]; ramp: Ramp; z?: number; t?: number; ink?: boolean; minPx?: number; mark?: (p: Px, s: number, t: number) => C | null }
/** a thick polyline (trunk, barbel, finger rays): radius per point, shaded as a round tube */
function tube(o: TubeOpt): Part {
  const { pts, r } = o;
  let tot = 0;
  const segL: number[] = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segL.push(l); tot += l; }
  const near = (x: number, y: number, S: number): [number, number, number, number] | null => {
    let best: [number, number, number, number] | null = null;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [d, t] = segDist(x, y, pts[i - 1], pts[i]);
      const rr = Math.max(r[i - 1] + (r[i] - r[i - 1]) * t, (o.minPx ?? 0.5) / S);
      if (d <= rr && (!best || d / rr < best[0])) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
        const side = ((x - pts[i - 1][0]) * dy - (y - pts[i - 1][1]) * dx) < 0 ? -1 : 1;
        best = [d / rr, side, (acc + segL[i - 1] * t) / tot, i - 1];
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
      const [d, side, s, i] = n;
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], dl = Math.hypot(dx, dy) || 1;
      const nx = (dy / dl) * side * d, ny = (-dx / dl) * side * d;
      const t = (o.t ?? 2) + lit(p, -nx * 0.95, -ny * 0.95) * 1.4;
      return o.mark?.(p, s, t) ?? tone(o.ramp, t);
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
      const t = (o.t ?? 2) + lit(p, nx * 0.9, ny * 0.9) * (o.light ?? 1.6);
      return o.mark?.(p, nx, ny, t) ?? tone(o.ramp, t);
    },
  };
}

// fin builders that follow the body outline
/** a fin standing on a profile between x0 and x1: h(s) is its height at s = 0..1; rake leans it back */
function finOn(prof: Pt[], x0: number, x1: number, h: (s: number) => number, dir: -1 | 1, rake = 0.35, n = 16): Pt[] {
  const f = curve(prof);
  const base: Pt[] = [], edge: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, x = x0 + (x1 - x0) * s, y = f(x);
    base.push([x, y - dir * 0.012]);
    edge.push([x - Math.abs(h(s)) * rake, y + dir * Math.abs(h(s))]);
  }
  return [...base, ...edge.reverse()];
}
/** spiny edge: tall spines with dips between */
const spiny = (hmax: number, n: number, shape: (s: number) => number = s => Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.7)) =>
  (s: number) => hmax * shape(s) * (0.58 + 0.42 * Math.abs(Math.cos(s * n * Math.PI)));
const softH = (hmax: number, p = 1) => (s: number) => hmax * Math.pow(Math.sin(Math.PI * s), p);
/** a forked tail from the peduncle at x = xp (half-height hp) to lobe tips at x = 0, y = +-span; fork = notch depth 0..1 */
function tailFin(xp: number, hp: number, span: number, fork: number): Pt[] {
  const n = xp * fork * 0.85;
  return [[xp + 0.02, -hp], [xp * 0.5, -span * 0.68], [0, -span], [n * 0.45, -span * 0.42], [n, 0], [n * 0.45, span * 0.42], [0, span], [xp * 0.5, span * 0.68], [xp + 0.02, hp]];
}

// ------------------------------------------------------------------ the species
function snoutBass(): FishArt {
  const top: Pt[] = [[0.17, -0.034], [0.25, -0.05], [0.35, -0.098], [0.46, -0.134], [0.57, -0.146], [0.66, -0.134], [0.74, -0.106], [0.8, -0.07], [0.835, -0.028]];
  const bot: Pt[] = [[0.17, 0.034], [0.25, 0.046], [0.35, 0.072], [0.46, 0.1], [0.57, 0.112], [0.66, 0.104], [0.74, 0.082], [0.8, 0.054], [0.835, 0.014]];
  const back = pal('#1a2210', '#28341a', '#3a4a20', '#52622a', '#6c7c36');
  const side = pal('#3e4418', '#5a6224', '#7c8232', '#9ea242', '#bebc5a');
  const belly = pal('#8a7a44', '#b6a262', '#d8c684', '#eee0a4', '#fcf4cc');
  const fins = pal('#161c0c', '#252e14', '#39441e', '#56602c', '#76803c');
  const trunk = pal('#5a2c20', '#8e4c3c', '#b87060', '#d89480', '#f2bca4');
  const blot = pal('#141a0a', '#1e2810', '#2c3816');
  return {
    x0: 0, x1: 1, ink: hex('#12170a'),
    eye: { x: 0.752, y: -0.05, r: 0.026, iris: hex('#e89a28') },
    parts: [
      fin({ pts: [[0.19, -0.032], [0.1, -0.1], [0.035, -0.122], [0.0, -0.098], [0.04, -0.03], [0.05, 0.0], [0.04, 0.03], [0.0, 0.098], [0.035, 0.122], [0.1, 0.1], [0.19, 0.032]], root: [0.2, 0], rays: 7, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.25, 0.45, softH(0.078, 0.7), -1, 0.3), root: [0.35, -0.08], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.44, 0.67, spiny(0.086, 5.5), -1, 0.25), root: [0.55, -0.1], rays: 7, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.24, 0.39, softH(0.06, 0.7), 1, 0.4), root: [0.31, 0.06], rays: 4, ramp: fins, z: 4 }),
      fin({ pts: [[0.6, 0.1], [0.555, 0.158], [0.6, 0.162], [0.665, 0.1]], root: [0.63, 0.1], rays: 3, ramp: fins, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.36, zl: 0.7, gill: 0.705, mouth: [0.835, 0.016, 0.05], scales: 0.5,
        // a row of dark blotches along the flank (the bass's lateral band), bars on the back
        mark: (p, u, v, t) => {
          const k = frac(u * 5.6 + 0.15), cx = Math.abs(k - 0.5) * 2;
          const band = 0.52 + Math.sin(u * 8) * 0.03;
          if (u > 0.06 && u < 0.84 && Math.abs(v - band) < 0.13 * (1.15 - cx * 0.7) && cell(p, 5) < 0.85) return tone(blot, t - 0.6);
          if (v < 0.3 && cx < 0.28 && u > 0.1 && u < 0.78 && cell(p, 9) < 0.7) return tone(blot, t - 0.4);
          if (v > 0.2 && v < 0.62 && cell(p, 3) < 0.12) return tone(side, t + 1);
          return null;
        },
      }),
      fin({ pts: [[0.72, 0.024], [0.64, 0.0], [0.585, 0.032], [0.61, 0.064], [0.7, 0.056]], root: [0.72, 0.04], rays: 4, ramp: pal('#2a3014', '#3e4a1e', '#5a6a2a', '#7a8a3a', '#9aa84e'), z: 14, ink: true }),
      // the trunk: a long, flexible rooting snout curling down to a fleshy disc
      tube({
        pts: [[0.8, -0.036], [0.87, -0.036], [0.935, -0.018], [0.974, 0.022], [0.99, 0.066], [0.978, 0.1]], r: [0.036, 0.03, 0.026, 0.024, 0.023, 0.022], ramp: trunk, z: 13, ink: true,
        // wrinkle rings along the trunk
        mark: (p, s, t) => (p.detail > 0.4 && s > 0.1 && s < 0.88 && frac(s * 9) < 0.2 ? tone(trunk, t - 1) : null),
      }),
      disc({ x: 0.966, y: 0.114, rx: 0.032, ry: 0.027, ramp: pal('#8a3a38', '#c8645c', '#ec9a88', '#fcc4b0', '#ffe4d6'), z: 14, ink: true, t: 2.4 }),
    ],
  };
}

function lanternCod(): FishArt {
  const top: Pt[] = [[0.15, -0.03], [0.22, -0.045], [0.35, -0.08], [0.5, -0.113], [0.64, -0.13], [0.76, -0.13], [0.86, -0.108], [0.93, -0.068], [0.97, -0.022]];
  const bot: Pt[] = [[0.15, 0.03], [0.22, 0.04], [0.35, 0.066], [0.5, 0.09], [0.64, 0.106], [0.76, 0.114], [0.86, 0.1], [0.93, 0.066], [0.97, 0.022]];
  const back = pal('#0c1430', '#16244a', '#20345e', '#2c4676', '#3c5c90');
  const side = pal('#243c66', '#344e80', '#48669a', '#6082b2', '#80a2c8');
  const belly = pal('#6a7c90', '#8ea2b6', '#b6c8d6', '#d6e4ec', '#f2f8fa');
  const fins = pal('#0a1228', '#141f40', '#1f305a', '#2e4674', '#44628e');
  const mott = pal('#0a1024', '#101a36', '#182848');
  const lure = pal('#1e8a9a', '#3cc0cc', '#7af0f0', '#c0ffff', '#ffffff');
  return {
    x0: 0, x1: 1, ink: hex('#080d1c'),
    eye: { x: 0.868, y: -0.046, r: 0.034, iris: hex('#72e0b0') },
    parts: [
      fin({ pts: [[0.17, -0.028], [0.06, -0.092], [0.01, -0.086], [-0.012, -0.03], [-0.012, 0.03], [0.01, 0.086], [0.06, 0.092], [0.17, 0.028]], root: [0.17, 0], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.61, 0.77, softH(0.08, 0.6), -1, 0.3), root: [0.69, -0.12], rays: 5, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.42, 0.59, softH(0.062, 0.7), -1, 0.3), root: [0.5, -0.1], rays: 5, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.23, 0.4, softH(0.054, 0.7), -1, 0.3), root: [0.31, -0.06], rays: 4, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.42, 0.58, softH(0.054, 0.7), 1, 0.3), root: [0.5, 0.08], rays: 4, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.23, 0.39, softH(0.048, 0.7), 1, 0.3), root: [0.3, 0.05], rays: 3, ramp: fins, z: 4 }),
      fin({ pts: [[0.82, 0.1], [0.765, 0.158], [0.8, 0.164], [0.852, 0.104]], root: [0.83, 0.1], rays: 2, ramp: fins, z: 3 }),
      body({
        top, bot, back, side, belly, zb: 0.42, zl: 0.7, gill: 0.8, mouth: [0.968, 0.032, 0.075], scales: 0.3,
        mark: (p, u, v, t) => {
          // mottled back, a pale arching lateral line
          if (v < 0.55 && u < 0.84 && cell(p, 7) < 0.3) return tone(mott, t - 0.8);
          if (p.detail > 0.2 && Math.abs(v - (0.42 - Math.sin(u * 3) * 0.14)) < 0.045 && u > 0.08 && u < 0.8) return tone(side, t + 1.4);
          return null;
        },
      }),
      fin({ pts: [[0.785, 0.042], [0.69, 0.018], [0.66, 0.056], [0.7, 0.092], [0.785, 0.074]], root: [0.785, 0.058], rays: 4, ramp: pal('#122044', '#1e345e', '#2e4c7c', '#446a9a', '#6088b4'), z: 14, ink: true }),
      // the chin lure: a long barbel carrying a glowing bulb
      tube({ pts: [[0.925, 0.075], [0.948, 0.13], [0.99, 0.176], [1.03, 0.19]], r: [0.011, 0.009, 0.008, 0.008], ramp: pal('#2a3a5a', '#3e5278', '#56709a', '#7890b8', '#9ab0d0'), z: 13, minPx: 0.5 }),
      { ...disc({ x: 1.054, y: 0.196, rx: 0.036, ramp: lure, z: 14, t: 2.6, light: 1.2, ink: true }), halo: hex('#8af8ff') },
    ],
  };
}

function gurnard(): FishArt {
  const top: Pt[] = [[0.16, -0.03], [0.28, -0.048], [0.42, -0.072], [0.56, -0.096], [0.7, -0.118], [0.8, -0.126], [0.88, -0.11], [0.93, -0.076], [0.962, -0.03]];
  const bot: Pt[] = [[0.16, 0.03], [0.28, 0.04], [0.42, 0.054], [0.56, 0.068], [0.7, 0.08], [0.8, 0.086], [0.88, 0.084], [0.93, 0.07], [0.962, 0.034]];
  const back = pal('#3a0a0a', '#5c1410', '#801e16', '#a4301e', '#c4462a');
  const side = pal('#7a1c14', '#a4301e', '#cc482e', '#e86a42', '#f89262');
  const belly = pal('#a86a50', '#d09474', '#ecbc98', '#f8dabe', '#fff0e2');
  const fins = pal('#3a0a0a', '#5a1410', '#842416', '#ac3a22', '#d05634');
  const wing = pal('#0a3036', '#104c52', '#16706e', '#22968e', '#52c8bc');
  const legs = pal('#7a2818', '#b0442c', '#dc6a48', '#f8946a', '#ffc49c');
  return {
    x0: 0, x1: 1, ink: hex('#240606'),
    eye: { x: 0.855, y: -0.066, r: 0.026, iris: hex('#f4d040') },
    parts: [
      fin({ pts: [[0.18, -0.028], [0.06, -0.094], [0.0, -0.094], [0.035, -0.02], [0.035, 0.02], [0.0, 0.094], [0.06, 0.094], [0.18, 0.028]], root: [0.18, 0], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.62, 0.79, spiny(0.1, 4.5), -1, 0.2), root: [0.7, -0.1], rays: 5, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.3, 0.6, softH(0.05, 0.5), -1, 0.3), root: [0.45, -0.06], rays: 7, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.3, 0.57, softH(0.045, 0.5), 1, 0.3), root: [0.44, 0.05], rays: 6, ramp: fins, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.7, gill: 0.8, mouth: [0.958, 0.024, 0.05], scales: 0.35,
        mark: (p, u, v, t) => {
          // bony plated head: a light rim over the brow; darker saddles on the back
          if (u > 0.8 && v < 0.3 && cell(p, 4) < 0.35) return tone(side, t + 1);
          if (v < 0.35 && frac(u * 4.5) < 0.3 && u < 0.8 && cell(p, 6) < 0.8) return tone(back, t - 0.9);
          return null;
        },
      }),
      // the great wing: a fan of a pectoral, teal with blue spots and an electric edge
      fin({
        pts: [[0.755, 0.004], [0.66, -0.032], [0.54, -0.026], [0.44, 0.012], [0.41, 0.06], [0.44, 0.112], [0.52, 0.14], [0.62, 0.13], [0.7, 0.098], [0.76, 0.048]],
        root: [0.76, 0.03], rays: 9, ramp: wing, z: 14, ink: true, t: 1.6, edge: hex('#8af4ff'),
        mark: (p, t) => {
          const d = Math.hypot(p.x - 0.76, p.y - 0.03);
          if (d > 0.3) return tone(pal('#3ab0c8', '#6ae0f0', '#a8faff'), 1);
          if (p.detail > 0.2 && cell(p, 11, 2) < 0.16 && d > 0.1) return hex('#2a3aa8');
          return null;
        },
      }),
      // six walking fingers (three on this side): jointed rays under the chin, toes forward
      ...[0, 1, 2].map(k => tube({
        pts: [[0.785 + k * 0.058, 0.074], [0.762 + k * 0.064, 0.138], [0.784 + k * 0.064, 0.184], [0.816 + k * 0.064, 0.19]],
        r: [0.012, 0.011, 0.01, 0.009], ramp: legs, z: 9 - k * 0.1, t: 2.2, ink: true, minPx: 0.5,
      })),
    ],
  };
}

function mirrorDory(): FishArt {
  const top: Pt[] = [[0.15, -0.03], [0.22, -0.08], [0.32, -0.17], [0.44, -0.235], [0.56, -0.255], [0.68, -0.236], [0.78, -0.19], [0.87, -0.112], [0.93, -0.05], [0.955, -0.01]];
  const bot: Pt[] = [[0.15, 0.03], [0.22, 0.078], [0.32, 0.16], [0.44, 0.215], [0.56, 0.232], [0.68, 0.21], [0.78, 0.16], [0.87, 0.1], [0.93, 0.058], [0.955, 0.02]];
  // chrome: the flank reflects the sky above the horizon line and the dark sea below it
  const sky = pal('#4a6a8a', '#7aa0c0', '#a8cce6', '#d8f0fc', '#ffffff');
  const sea = pal('#101824', '#1a2838', '#28384c', '#3e5266', '#5a7082');
  const fins = pal('#262e38', '#3c4652', '#56626e', '#76828e', '#a0aab4');
  return {
    x0: 0, x1: 1, ink: hex('#0a0e16'),
    eye: { x: 0.815, y: -0.085, r: 0.03, iris: hex('#ecca5a') },
    parts: [
      fin({ pts: [[0.17, -0.03], [0.07, -0.094], [0.01, -0.07], [-0.01, 0.0], [0.01, 0.07], [0.07, 0.094], [0.17, 0.03]], root: [0.17, 0], rays: 6, ramp: fins, z: 4 }),
      // long dorsal spines trailing filaments (dory), a low soft dorsal behind
      fin({ pts: finOn(top, 0.5, 0.79, spiny(0.16, 4, s => Math.pow(1 - s * 0.55, 1.2) * Math.min(1, s * 6)), -1, 0.55), root: [0.62, -0.2], rays: 5, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.24, 0.5, softH(0.05, 0.6), -1, 0.3), root: [0.37, -0.18], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.22, 0.47, softH(0.05, 0.6), 1, 0.3), root: [0.35, 0.17], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: [[0.7, 0.19], [0.645, 0.3], [0.672, 0.305], [0.745, 0.176]], root: [0.72, 0.19], rays: 2, ramp: fins, z: 4 }),
      body({
        top, bot, back: sky, side: sky, belly: sea, zb: 0.3, zl: 0.56, gill: 0.78, mouth: [0.955, 0.0, 0.06], scales: 0, light: 0.2,
        mark: (p, u, v, t) => {
          // the mirror: sky tones fading to a white horizon streak, then the dark sea, lightening to the belly
          const hz = 0.52 + (u - 0.5) * 0.12;
          let c: C;
          if (v < hz - 0.05) c = tone(sky, 1.2 + (v / hz) * 2.6 + t * 0.1 - 0.2);
          else if (v < hz + 0.02) c = tone(sky, 4);
          else c = tone(sea, 0.8 + ((v - hz) / (1 - hz)) * 3.2);
          // the thumbprint: a dark spot with a gold ring
          const d = Math.hypot(p.x - 0.56, p.y + 0.01) * p.S;
          const R0 = 0.05 * p.S;
          if (d < R0) return hex('#0c0e14');
          if (d < R0 + Math.max(1, 0.012 * p.S)) return hex('#e8d890');
          if (p.detail > 0.3 && v < hz - 0.1 && cell(p, 13) < 0.08) return tone(sky, 4);
          return c;
        },
      }),
      fin({ pts: [[0.76, 0.02], [0.68, 0.0], [0.65, 0.04], [0.69, 0.07], [0.76, 0.052]], root: [0.76, 0.036], rays: 3, ramp: fins, z: 14, ink: true, t: 2 }),
    ],
  };
}

function hammerSnapper(): FishArt {
  const top: Pt[] = [[0.17, -0.034], [0.26, -0.068], [0.38, -0.128], [0.5, -0.166], [0.62, -0.178], [0.72, -0.17], [0.8, -0.15], [0.88, -0.11], [0.93, -0.064], [0.95, -0.02]];
  const bot: Pt[] = [[0.17, 0.034], [0.26, 0.06], [0.38, 0.1], [0.5, 0.124], [0.62, 0.13], [0.72, 0.12], [0.82, 0.094], [0.9, 0.06], [0.95, 0.018]];
  const back = pal('#4a0e22', '#721c34', '#983048', '#bc4a60', '#d86a7a');
  const side = pal('#9a3448', '#c0505e', '#dc6e7a', '#ee909a', '#f8b4ba');
  const belly = pal('#c08488', '#dea8a8', '#f4cac4', '#fce2da', '#fff4ee');
  const fins = pal('#4a0e1c', '#781c30', '#a43246', '#c84e60', '#e0747e');
  const brow = pal('#7a3a3a', '#b0645e', '#d8908a', '#f4bcb2', '#ffe4dc');
  return {
    x0: 0, x1: 1, ink: hex('#24060f'),
    eye: { x: 0.842, y: -0.05, r: 0.024, iris: hex('#f0c040') },
    parts: [
      fin({ pts: tailFin(0.19, 0.032, 0.15, 0.62), root: [0.2, 0], rays: 7, ramp: fins, z: 4 }),
      fin({ pts: finOn(top, 0.36, 0.73, spiny(0.078, 7), -1, 0.25), root: [0.55, -0.16], rays: 9, ramp: fins, z: 4 }),
      fin({ pts: finOn(bot, 0.25, 0.4, softH(0.058, 0.6), 1, 0.4), root: [0.32, 0.08], rays: 4, ramp: fins, z: 4 }),
      fin({ pts: [[0.62, 0.124], [0.575, 0.184], [0.62, 0.186], [0.68, 0.118]], root: [0.64, 0.12], rays: 3, ramp: fins, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.34, zl: 0.7, gill: 0.78, mouth: [0.95, 0.022, 0.055], scales: 0.5,
        mark: (p, u, v, t) => {
          // electric-blue spots scattered over the upper flank
          if (v < 0.6 && u < 0.86 && u > 0.08) {
            const h = cell(p, 17, 2);
            if (h < 0.1) return hex('#5ad4f4');
            if (h < 0.12 && p.detail > 0.3) return hex('#c8f4ff');
          }
          return null;
        },
      }),
      fin({ pts: [[0.74, 0.03], [0.62, 0.012], [0.56, 0.05], [0.64, 0.066], [0.74, 0.06]], root: [0.74, 0.045], rays: 4, ramp: fins, z: 14, ink: true, t: 1.8 }),
      // the hammer brow: a bony battering ridge over the eyes, polished by headbutting shells open
      body({
        top: [[0.72, -0.17], [0.78, -0.21], [0.86, -0.236], [0.94, -0.238], [1.0, -0.222]],
        bot: [[0.72, -0.17], [0.78, -0.13], [0.86, -0.096], [0.94, -0.086], [1.0, -0.098]],
        back: brow, side: brow, belly: brow, zb: 0.4, zl: 0.85, z: 15, scales: 0, light: 0.9,
        mark: (p, u, v, t) => (u > 0.93 ? tone(brow, t - 0.6) : v < 0.3 && u > 0.2 && u < 0.86 ? tone(brow, t + 1.2) : v > 0.82 ? tone(brow, t - 1.2) : null),
      }),
      // two little canines
      disc({ x: 0.955, y: 0.028, rx: 0.008, ry: 0.012, ramp: pal('#c8c0b0', '#e8e0d0', '#fffaf0'), z: 16, t: 2, iconOnly: true }),
    ],
  };
}

function bubblePuffer(): FishArt {
  const back = pal('#4a3006', '#76520c', '#a07a14', '#c49e24', '#e2be40');
  const side = pal('#9a7210', '#c29618', '#e4b82a', '#f6d24a', '#ffe886');
  const belly = pal('#c0b08a', '#dcd0b0', '#f0e8d0', '#faf6ea', '#ffffff');
  const fins = pal('#6a4a10', '#94701c', '#c09a2c', '#e0ba46', '#f6d66c');
  const top: Pt[] = [[0.2, -0.05], [0.26, -0.13], [0.34, -0.2], [0.46, -0.25], [0.58, -0.262], [0.7, -0.24], [0.8, -0.19], [0.88, -0.12], [0.925, -0.05], [0.94, 0.0]];
  const bot: Pt[] = [[0.2, 0.05], [0.26, 0.12], [0.34, 0.19], [0.46, 0.235], [0.58, 0.25], [0.7, 0.232], [0.8, 0.186], [0.88, 0.12], [0.925, 0.06], [0.94, 0.012]];
  return {
    x0: 0, x1: 1, ink: hex('#261804'),
    eye: { x: 0.8, y: -0.1, r: 0.05, iris: hex('#58c8a0') },
    parts: [
      fin({ pts: [[0.24, -0.05], [0.09, -0.12], [0.02, -0.1], [0.05, 0.0], [0.02, 0.1], [0.09, 0.12], [0.24, 0.05]], root: [0.24, 0], rays: 6, ramp: fins, z: 4 }),
      fin({ pts: [[0.27, -0.14], [0.2, -0.24], [0.25, -0.26], [0.34, -0.2]], root: [0.3, -0.17], rays: 3, ramp: fins, z: 4 }),
      fin({ pts: [[0.27, 0.13], [0.2, 0.23], [0.25, 0.25], [0.34, 0.19]], root: [0.3, 0.16], rays: 3, ramp: fins, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.66, mouth: [0.94, 0.02, 0.03], scales: 0, light: 0.7,
        mark: (p, u, v, t) => {
          // leopard spots on the back and flank, prickles over the belly
          if (v < 0.62 && cell(p, 21, 2) < 0.2) return tone(back, t - 1.6);
          if (v > 0.74 && p.detail > 0.2 && cell(p, 23, 1) < 0.06) return tone(belly, t - 1.4);
          return null;
        },
      }),
      fin({ pts: [[0.74, 0.02], [0.66, -0.03], [0.62, 0.02], [0.66, 0.07]], root: [0.74, 0.02], rays: 3, ramp: fins, z: 14, ink: true, t: 1.8 }),
      // a little parrot beak
      disc({ x: 0.945, y: 0.02, rx: 0.026, ry: 0.03, ramp: pal('#8a8070', '#c0b8a4', '#e8e2d2', '#fffaf0'), z: 15, t: 2, ink: true }),
    ],
    // the icon floats a few bubbles by its beak
    iconPad: 3.5,
    iconPost: b => {
      const bub = (cx: number, cy: number, r: number) => {
        for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
          const d = Math.hypot(x, y);
          if (b.opaque(cx + x, cy + y)) continue;
          if (d <= r + 0.5 && d > r - 0.6) b.set(cx + x, cy + y, hex('#3a8ab8'));
          else if (d <= r - 0.6) b.set(cx + x, cy + y, withAlpha(hex('#c8f0ff'), 150));
        }
        if (r >= 2) b.set(cx - 1, cy - 1, hex('#ffffff'));
      };
      bub(28, 4, 2.4); bub(24, 1, 1.3); bub(30, 10, 1.3);
    },
  };
}

function ribbonEel(): FishArt {
  const top: Pt[] = [[0.03, -0.01], [0.1, -0.022], [0.3, -0.034], [0.6, -0.04], [0.84, -0.04], [0.935, -0.034], [0.975, -0.014]];
  const bot: Pt[] = [[0.03, 0.01], [0.1, 0.02], [0.3, 0.03], [0.6, 0.034], [0.84, 0.034], [0.935, 0.028], [0.975, 0.01]];
  const silver = pal('#3e4460', '#686f8c', '#949cb6', '#c2cadc', '#eef2fa');
  const fins = pal('#5a0a16', '#920e22', '#c82434', '#ee4448', '#ff8272');
  return {
    x0: 0, x1: 1, ink: hex('#160e1c'), iconWave: 1.1, iconRot: -Math.PI / 4,
    eye: { x: 0.948, y: -0.008, r: 0.012, iris: hex('#e8e0a0') },
    parts: [
      fin({ pts: [[0.05, -0.008], [0.0, -0.03], [-0.012, 0.0], [0.0, 0.03], [0.05, 0.008]], root: [0.05, 0], rays: 2, ramp: fins, z: 4 }),
      // the endless red dorsal, rippling along the whole back
      fin({ pts: finOn(top, 0.06, 0.88, s => 0.03 * (0.82 + 0.18 * Math.sin(s * 22)) * Math.min(1, s * 12, (1 - s) * 20), -1, 0.1, 60), root: [0.5, 0.2], rays: 24, ramp: fins, z: 4, t: 2 }),
      body({
        top, bot, back: silver, side: silver, belly: silver, zb: 0.3, zl: 0.75, scales: 0, light: 0.6,
        // iridescent streaks: cyan and rose bands slanting across the silver
        mark: (p, u, v, t) => {
          const k = frac(u * 26 + v * 0.8);
          if (v > 0.2 && v < 0.8 && k < 0.14) return hex('#8ae4ec');
          if (v > 0.2 && v < 0.8 && k > 0.5 && k < 0.6) return hex('#e8a8dc');
          return tone(silver, t);
        },
      }),
      // the crest: long red head plumes, and the paddle-tipped pelvic oars
      ...[0, 1, 2, 3].map(k => tube({
        pts: [[0.9 + k * 0.014, -0.03], [0.875 + k * 0.012, -0.075 - k * 0.018], [0.85 + k * 0.012, -0.1 - k * 0.028]],
        r: [0.007, 0.006, 0.009], ramp: fins, z: 3, t: 2.4, minPx: 0.5,
      })),
      tube({ pts: [[0.9, 0.026], [0.86, 0.08], [0.8, 0.12]], r: [0.005, 0.004, 0.012], ramp: fins, z: 3, t: 2.2, minPx: 0.5 }),
    ],
  };
}

function glassMaomao(): FishArt {
  const top: Pt[] = [[0.19, -0.034], [0.28, -0.068], [0.4, -0.118], [0.54, -0.14], [0.68, -0.13], [0.8, -0.1], [0.9, -0.06], [0.96, -0.018]];
  const bot: Pt[] = [[0.19, 0.034], [0.28, 0.064], [0.4, 0.108], [0.54, 0.128], [0.68, 0.118], [0.8, 0.09], [0.9, 0.05], [0.96, 0.014]];
  const glass = pal('#1c4886', '#3a6eae', '#68a0d4', '#a2ccf0', '#dcf2ff');
  const organs = pal('#0e2266', '#183894', '#2654c4', '#4878e4', '#7aa4ff');
  const fins = pal('#0e2c78', '#1a48a8', '#3470dc', '#64a0f4', '#a4ccff');
  const spine = curve([[0.2, 0.0], [0.4, -0.02], [0.6, -0.026], [0.8, -0.02], [0.86, -0.016]]);
  const top_ = curve(top), bot_ = curve(bot);
  const topF = (x: number) => top_(x), botF = (x: number) => bot_(x);
  return {
    x0: 0, x1: 1, ink: hex('#081640'),
    eye: { x: 0.868, y: -0.03, r: 0.03, iris: hex('#4ac8ff') },
    parts: [
      fin({ pts: tailFin(0.21, 0.03, 0.16, 0.66), root: [0.22, 0], rays: 7, ramp: fins, z: 4, t: 1.6 }),
      fin({ pts: finOn(top, 0.36, 0.72, softH(0.07, 0.6), -1, 0.4), root: [0.54, -0.12], rays: 7, ramp: fins, z: 4, t: 1.6 }),
      fin({ pts: finOn(bot, 0.3, 0.52, softH(0.062, 0.6), 1, 0.4), root: [0.41, 0.1], rays: 5, ramp: fins, z: 4, t: 1.6 }),
      body({
        top, bot, back: glass, side: glass, belly: glass, zb: 0.3, zl: 0.7, gill: 0.8, scales: 0, light: 0.5,
        mark: (p, u, v, t) => {
          // see-through: an opaque glassy rim, a clear middle that lets the world show through, the
          // spine and ribs, the blue gut and a bright streak of reflected sky
          const edge = 1.3 / Math.max(1, (botF(p.x) - topF(p.x)) * p.S);
          if (v < edge || v > 1 - edge) return tone(glass, t + 0.6);
          const sy = spine(p.x);
          if (!Number.isNaN(sy)) {
            if (Math.abs(p.y - sy) * p.S < 0.6) return hex('#f4fcff');
            const rib = frac((p.x - 0.2) * 20);
            if (p.detail > 0.2 && rib < Math.max(0.16, 0.7 / (p.S * 0.05)) && v > 0.14 && v < 0.84 && p.x < 0.74 && p.x > 0.26) return withAlpha(hex('#e8f8ff'), 210);
          }
          if (Math.hypot((p.x - 0.64) / 0.09, (p.y - 0.045) / 0.05) < 1) return tone(organs, 2 + (p.y < 0.04 ? 1 : 0));
          if (Math.hypot((p.x - 0.84) / 0.05, (p.y + 0.01) / 0.05) < 1) return withAlpha(tone(glass, 1), 200);
          if (v > 0.18 && v < 0.26 && u > 0.2 && u < 0.7) return withAlpha(hex('#ffffff'), 200);
          return withAlpha(tone(glass, 2.6 + (v - 0.5) * 0.6), 120);
        },
      }),
      fin({ pts: [[0.78, 0.02], [0.7, 0.0], [0.67, 0.04], [0.72, 0.06]], root: [0.78, 0.03], rays: 3, ramp: fins, z: 14, ink: true, t: 2 }),
    ],
  };
}

function kahawai(): FishArt {
  const top: Pt[] = [[0.19, -0.028], [0.3, -0.052], [0.45, -0.076], [0.6, -0.086], [0.74, -0.082], [0.86, -0.064], [0.93, -0.04], [0.975, -0.01]];
  const bot: Pt[] = [[0.19, 0.028], [0.3, 0.048], [0.45, 0.066], [0.6, 0.072], [0.74, 0.068], [0.86, 0.054], [0.93, 0.034], [0.975, 0.01]];
  const back = pal('#0a2222', '#123834', '#1c5048', '#286a60', '#388678');
  const side = pal('#4a6a64', '#6e8e86', '#94b2a8', '#bcd4cc', '#e2f0ea');
  const belly = pal('#98aaa6', '#bccac6', '#dae4e2', '#eef4f2', '#ffffff');
  const sail = pal('#0e1a44', '#18286a', '#223c92', '#3258b8', '#5680d8');
  const fins = pal('#122024', '#20363a', '#325050', '#4a6c6a', '#6a8e88');
  return {
    x0: 0, x1: 1, ink: hex('#061210'),
    eye: { x: 0.9, y: -0.022, r: 0.022, iris: hex('#ecd070') },
    parts: [
      fin({ pts: tailFin(0.21, 0.026, 0.17, 0.7), root: [0.22, 0], rays: 7, ramp: fins, z: 4 }),
      // the spinnaker: a tall sail fin, raised to steer and to herd baitfish
      fin({
        pts: [[0.35, -0.066], [0.38, -0.14], [0.44, -0.24], [0.52, -0.3], [0.6, -0.31], [0.68, -0.28], [0.74, -0.2], [0.78, -0.12], [0.79, -0.07]],
        root: [0.57, -0.07], rays: 9, ramp: sail, z: 4, t: 1.6, edge: hex('#1a2a60'),
        mark: (p, t) => (cell(p, 31, 2) < 0.14 && p.y < -0.12 ? hex('#8ac4ff') : tone(sail, t)),
      }),
      fin({ pts: finOn(bot, 0.3, 0.43, softH(0.046, 0.6), 1, 0.4), root: [0.36, 0.05], rays: 4, ramp: fins, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.66, gill: 0.84, mouth: [0.975, 0.008, 0.05], scales: 0.35,
        mark: (p, u, v, t) => (v < 0.45 && u < 0.86 && cell(p, 27, 2) < 0.22 ? tone(back, t - 1.4) : null),
      }),
      fin({ pts: [[0.8, 0.026], [0.72, 0.008], [0.69, 0.04], [0.8, 0.044]], root: [0.8, 0.034], rays: 3, ramp: fins, z: 14, ink: true, t: 2 }),
    ],
  };
}

function sunwheelOpah(): FishArt {
  const top: Pt[] = [[0.16, -0.034], [0.24, -0.1], [0.34, -0.198], [0.46, -0.258], [0.58, -0.278], [0.7, -0.258], [0.8, -0.2], [0.88, -0.122], [0.93, -0.054], [0.945, 0.0]];
  const bot: Pt[] = [[0.16, 0.034], [0.24, 0.088], [0.34, 0.168], [0.46, 0.218], [0.58, 0.234], [0.7, 0.214], [0.8, 0.166], [0.88, 0.1], [0.93, 0.052], [0.945, 0.012]];
  const back = pal('#300c28', '#4e183e', '#6e2a58', '#8e4274', '#ac5e92');
  const side = pal('#9a4866', '#be6482', '#da869e', '#eea6ba', '#f8c6d4');
  const belly = pal('#c09ca8', '#dcbcc6', '#f0d8de', '#faecf0', '#fffafc');
  const fins = pal('#520812', '#84121c', '#b41e26', '#da3036', '#f45a50');
  const gold = pal('#80520e', '#b8841c', '#e4b034', '#f8d25c', '#fff096');
  return {
    x0: 0, x1: 1, ink: hex('#200414'),
    eye: { x: 0.855, y: -0.056, r: 0.036, iris: hex('#f8d060'), ring: hex('#e8b030') },
    parts: [
      fin({ pts: tailFin(0.18, 0.032, 0.18, 0.72), root: [0.19, 0], rays: 7, ramp: fins, z: 4, t: 1.8 }),
      // a tall sickle dorsal up front, then a low crest running back
      fin({ pts: [[0.7, -0.254], [0.66, -0.36], [0.6, -0.44], [0.57, -0.42], [0.56, -0.34], [0.5, -0.28], [0.42, -0.25], [0.3, -0.19], [0.24, -0.12], [0.28, -0.13], [0.46, -0.24], [0.6, -0.26]], root: [0.62, -0.26], rays: 6, ramp: fins, z: 4, t: 1.8 }),
      fin({ pts: finOn(bot, 0.24, 0.52, softH(0.04, 0.5), 1, 0.3), root: [0.38, 0.19], rays: 6, ramp: fins, z: 4, t: 1.8 }),
      fin({ pts: [[0.66, 0.2], [0.6, 0.3], [0.64, 0.31], [0.71, 0.196]], root: [0.68, 0.2], rays: 3, ramp: fins, z: 4, t: 1.8 }),
      body({
        top, bot, back, side, belly, zb: 0.34, zl: 0.66, gill: 0.8, mouth: [0.945, 0.004, 0.04], scales: 0, light: 0.55,
        mark: (p, u, v, t) => {
          // gold sun-rays fanning back from the eye, silver-white spots over the flank
          const ex = 0.855, ey = -0.056;
          const a = Math.atan2(p.y - ey, p.x - ex), d = Math.hypot(p.x - ex, p.y - ey);
          if (d > 0.05 && d < 0.2 && Math.abs(Math.sin(a * 7)) < 0.16 && u > 0.6) return tone(gold, 3 - d * 6);
          if (u < 0.84 && cell(p, 41, 2) < 0.14) return tone(belly, 4);
          return null;
        },
      }),
      // the sun-wheel: a round crimson pectoral with radial spokes and a gold hub
      disc({
        x: 0.66, y: 0.03, rx: 0.08, ramp: fins, z: 14, ink: true, t: 2, light: 0.8,
        mark: (p, nx, ny, t) => {
          const r = Math.hypot(nx, ny), a = Math.atan2(ny, nx);
          if (r < 0.3) return tone(gold, 3 - r * 3);
          if (r > 0.82) return tone(fins, t + 1);
          return Math.abs(Math.sin(a * 5)) < 0.3 ? tone(gold, 2.4) : tone(fins, t);
        },
      }),
    ],
  };
}

function snoutLouse(): FishArt {
  // seen from above: head (+x) with big dark eyes, seven plated segments, a tail fan, hooked legs
  const shell = pal('#5a3a2a', '#8e6448', '#bc9070', '#dcb896', '#f4dcc0');
  const legs = pal('#5a3424', '#86563a', '#b07e5a', '#d0a47e');
  const top: Pt[] = [[0.08, -0.07], [0.18, -0.13], [0.34, -0.17], [0.52, -0.18], [0.7, -0.16], [0.84, -0.11], [0.93, -0.05], [0.96, 0.0]];
  const bot: Pt[] = [[0.08, 0.07], [0.18, 0.13], [0.34, 0.17], [0.52, 0.18], [0.7, 0.16], [0.84, 0.11], [0.93, 0.05], [0.96, 0.0]];
  const legParts: Part[] = [];
  for (let k = 0; k < 7; k++) for (const s of [-1, 1]) {
    const x = 0.3 + k * 0.085;
    legParts.push(tube({ pts: [[x, s * 0.12], [x + 0.02, s * 0.22], [x + 0.06, s * 0.25]], r: [0.016, 0.013, 0.01], ramp: legs, z: 3, t: 1.6, minPx: 0.5 }));
  }
  return {
    x0: 0, x1: 1, ink: hex('#24140c'),
    eye: { x: 0.9, y: -0.06, r: 0.03, iris: hex('#101010') },
    parts: [
      ...legParts,
      fin({ pts: [[0.12, -0.08], [0.02, -0.12], [-0.02, 0.0], [0.02, 0.12], [0.12, 0.08]], root: [0.12, 0], rays: 4, ramp: shell, z: 4, t: 2 }),
      body({
        top, bot, back: shell, side: shell, belly: shell, zb: 0.2, zl: 0.9, scales: 0, light: 0.9,
        mark: (p, u, v, t) => {
          // plated segments: a dark suture line and a lit ridge on each plate
          const k = frac(u * 8.2);
          if (u > 0.12 && u < 0.86 && k < 0.14) return tone(shell, t - 1.6);
          if (k > 0.2 && k < 0.34 && v > 0.2 && v < 0.8) return tone(shell, t + 0.8);
          return null;
        },
      }),
      tube({ pts: [[0.95, -0.03], [1.02, -0.08], [1.06, -0.1]], r: [0.012, 0.01, 0.008], ramp: legs, z: 3, minPx: 0.5 }),
      tube({ pts: [[0.95, 0.03], [1.02, 0.08], [1.06, 0.1]], r: [0.012, 0.01, 0.008], ramp: legs, z: 3, minPx: 0.5 }),
      disc({ x: 0.895, y: 0.06, rx: 0.03, ramp: pal('#0a0808', '#1a1414', '#3a3030'), z: 16, t: 1 }),
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
function raster(a: FishArt, w: number, h: number, v: View, mask = false): Raster {
  const buf = new PixelBuffer(w, h);
  const part = new Int16Array(w * h).fill(-1);
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  // light in the fish's frame: screen light projected on the local axes (x = head dir, y = belly dir)
  const L: [number, number, number] = [LIGHT[0] * cs + LIGHT[1] * sn, -LIGHT[0] * sn + LIGHT[1] * cs, LIGHT[2]];
  const P = a.parts;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const dx = px + 0.5 - v.ox, dy = py + 0.5 - v.oy;
    const x = (dx * cs + dy * sn) / v.S;
    let y = (-dx * sn + dy * cs) / v.S;
    y += bendAt(v, x, a);
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      if (mask && q.noShadow) continue;
      if (v.world && q.iconOnly) continue;
      if (!q.hit(x, y, v.S)) continue;
      const c = mask ? 0xffffffff : q.paint({ x, y, px, py, S: v.S, L, detail: v.detail });
      if (!c) continue;
      buf.data[py * w + px] = c;
      part[py * w + px] = i;
      break;
    }
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
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) d[i] = a.ink;
      continue;
    }
    if (!inner) continue;
    const pi = part[i], q = a.parts[pi];
    if (!q?.ink) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const pj = part[ny * w + nx];
      if (pj >= 0 && pj !== pi && a.parts[pj].z < q.z) { d[i] = lmix(a.ink, src[i], 0.3); break; }
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

/** 3x3 block majority: opaque when at least 4 of 9 samples are, coloured by the commonest colour */
function downsample(hi: Raster, a: FishArt, w: number, h: number): Raster {
  const buf = new PixelBuffer(w, h), part = new Int16Array(w * h).fill(-1);
  const W = hi.buf.w;
  void a;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const count = new Map<number, number>();
    let n = 0, best = 0, bestN = 0, bp = -1;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const k = (y * 3 + j) * W + x * 3 + i;
      const c = hi.buf.data[k];
      if (!(c >>> 24)) continue;
      n++;
      // the middle sample counts double so features stay centred
      const wgt = (i === 1 && j === 1 ? 2 : 1) + (count.get(c) ?? 0);
      count.set(c, wgt);
      if (wgt > bestN) { bestN = wgt; best = c; bp = hi.part[k]; }
    }
    if (n >= 4) { buf.data[y * w + x] = best; part[y * w + x] = bp; }
  }
  return { buf, part };
}

/** local -> pixel */
function toPx(v: View, a: FishArt, x: number, y: number): Pt {
  const yb = y - bendAt(v, x, a);
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  return [v.ox + (x * cs - yb * sn) * v.S, v.oy + (x * sn + yb * cs) * v.S];
}

/** the eye, placed by hand so it always reads: pupil, iris, highlight */
function drawEye(r: Raster, a: FishArt, v: View) {
  const b = r.buf, e = a.eye;
  const [ex, ey] = toPx(v, a, e.x, e.y);
  const rp = e.r * v.S;
  const put = (x: number, y: number, c: C) => { if (b.opaque(x, y)) b.set(x, y, c); };
  const pupil = hex('#0a0608'), white = hex('#ffffff');
  if (rp < 0.75) { put(Math.floor(ex), Math.floor(ey), pupil); return; }
  if (rp < 1.35) {
    // 2 px: iris behind, pupil in front (toward the snout)
    const x = Math.floor(ex), y = Math.floor(ey);
    const fx = Math.cos(v.rot) > 0 ? 1 : -1;
    put(x, y, pupil); put(x - fx, y, e.iris);
    return;
  }
  if (rp < 2.1) {
    // 2x2: iris, pupil, and a highlight
    const x = Math.floor(ex - 0.5), y = Math.floor(ey - 0.5);
    put(x, y, white); put(x + 1, y, e.iris); put(x, y + 1, e.iris); put(x + 1, y + 1, pupil);
    return;
  }
  for (let y = Math.floor(ey - rp - 1); y <= Math.ceil(ey + rp + 1); y++) for (let x = Math.floor(ex - rp - 1); x <= Math.ceil(ex + rp + 1); x++) {
    const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey);
    if (d > rp) continue;
    if (d > rp - 0.9) put(x, y, e.ring ?? lmix(a.ink, e.iris, 0.3));
    else if (d < rp * 0.5) put(x, y, pupil);
    else put(x, y, lmix(e.iris, pupil, clamp01((y + 0.5 - ey) / rp * 0.5 + 0.15)));
  }
  put(Math.floor(ex - rp * 0.35), Math.floor(ey - rp * 0.35), white);
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
    drawEye(r, a, v);
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
    // small sprites: paint at 3x and keep each 3x3 block's dominant colour, so thin tails and fins
    // survive as whole pixels instead of breaking up into specks
    const r = L < 24 ? downsample(raster(a, w * 3, h * 3, { ...v, S: S * 3, ox: v.ox * 3, oy: v.oy * 3, detail: 0.1 }), a, w, h) : raster(a, w, h, v);
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
