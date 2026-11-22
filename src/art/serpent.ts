// Procedural spine-creature renderer (V2).
//
// Every serpent of Zealandia (plus the Ironjaw crocodile, the Bark gecko and the Pteramander) is a
// chain of spine points, head first, that the game simulates and this painter rasterises every
// frame into a DynamicSprite buffer.
//
// Pipeline
//  1. The spine is smoothed (Catmull-Rom) and resampled at a fixed arc-length step.
//  2. The body (and long fins) are rasterised as triangle strips into a small G-buffer: every pixel
//     gets body coordinates s (arc length from the head, px) and v (-1 belly edge .. +1 back edge).
//  3. A shading pass turns (s, v) into colour: cylinder lighting from a top-left key light, a rim
//     light on the underside, species patterns that follow the body (bands, saddles, mottling ...),
//     a scale lattice with per-scale highlight and dark edge, belly scutes, osteoderms, moss, scars,
//     photophores. Where the body crosses itself a dark contact line keeps coils readable.
//  4. Limbs (two/three-bone IK with planted stepping, digits, claws, toe pads), fins with rays and
//     translucent membranes, gill fronds with filaments, crests, dewlaps and patagia go around it.
//  5. The head is drawn in head space: hinged lower jaw, teeth or fangs, forked tongue, labial
//     scales, brows/horns and an eye with open / alert / angry / closed states.
//  6. A selective, tinted exterior outline, then the water cut-off.
//
// Glow (emissive parts: the lure-viper's tail lure, the leviathan's photophores)
//  - paint(buf, st, ox, oy, time, emissive) — pass a second PixelBuffer of the same size and it is
//    cleared and receives ONLY the glowing pixels (already scaled by st.glow). Upload it to a second
//    DynamicSprite and draw it at the same position with r.emissive(1) ... r.emissive() so it stays
//    bright at night; the main buffer holds the same parts in their unlit daytime colours.
//  - glowPoints(st) returns world-space [x, y, r, g, b, k] emitters (colour 0..1, k = strength 0..1)
//    for r.light(...) / r.fxDraw(A.glow, ...).
//
// Determinism: no Math.random(); all variation comes from hash2/noise/Rng with per-look seeds.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix, rgba } from './color';
import { OUTLINE } from './palettes';
import { clamp, hash2, noise1, noise2, Rng, smoothstep } from '../core/math';

// ================================================================== public types
export type Pattern =
  | 'bands' | 'diamonds' | 'stripe' | 'blotch' | 'plain' | 'rings' | 'speckle'
  | 'saddles' | 'mottle' | 'bark' | 'countershade' | 'zigzag' | 'flank' | 'ribbon' | 'croc' | 'skin';
export type HeadKind = 'viper' | 'slim' | 'blunt' | 'croc' | 'leviathan' | 'raptor' | 'gecko' | 'salamander' | 'eel';
export type EyeState = 'open' | 'alert' | 'angry' | 'closed';
export type ScaleKind = 'smooth' | 'keeled' | 'bead' | 'skin' | 'osteoderm' | 'none';
/** A glowing spot in world coordinates: position, colour (0..1 floats) and relative strength k (0..1). */
export type GlowPoint = [x: number, y: number, r: number, g: number, b: number, k: number];

export interface LegSpec {
  /** hip position along the body, 0 head .. 1 tail */
  at: number;
  /** leg length in px (hip to sole, straightened) */
  len: number;
  /** colour ramp dark -> light (resampled; the first leg's ramp is used for all legs) */
  col: C[];
  /** front legs bend the elbow back, hind legs the knee forward (default: at < 0.45 is front) */
  kind?: 'front' | 'hind';
  /** visible digits (default 3 side view, 5 from above) */
  digits?: number;
  /** claw colour */
  claw?: C;
  /** adhesive toe pads (gecko) */
  pads?: boolean;
  /** thigh radius relative to the body radius at the hip (default 0.42) */
  thick?: number;
  /** stride in px (default ~len); stepping is planted for the game's legPhase rate of 0.22 rad/px */
  stride?: number;
  /** three-bone runner's leg: thigh, shin, long metatarsus, toes (sprint viper) */
  digitigrade?: boolean;
  /** sprawling limb (lizards, crocodilians): the upper bone points out toward the viewer, so the side view
   *  shows a foreshortened muscle mass, then the lower leg down to a flat foot (0..1, default 0) */
  sprawl?: number;
  /** webbing between the toes (crocodilian hind feet) */
  web?: boolean;
  /** muscle bulk of the thigh / upper arm (x radius, default 0.25) */
  bulk?: number;
}

export interface FinSpec {
  from: number;
  to: number;
  /** height in px */
  h: number;
  col: C;
  /** ray spacing in px (default 4) */
  rays?: number;
}

export interface SerpentLook {
  length: number;
  radius: number;
  /** thickness profile peak position (0 head .. 1 tail) — used when `profile` is absent */
  thickAt?: number;
  tailTaper?: number;
  dorsal: C[];     // ramp dark->light for back
  belly: C;
  pattern: Pattern;
  patternCol: C;
  patternCol2?: C;
  period?: number;
  head: HeadKind;
  headLen?: number;
  eye?: C;
  legs?: LegSpec[];
  scutes?: boolean;
  dorsalFin?: FinSpec;
  /** external gill fronds colour */
  gills?: C;
  pectoral?: C;
  /** tail-tip lure colour (emissive) */
  lure?: C;
  flat?: number; // gliding: 0 normal, 1 fully flattened
  iridescent?: boolean;

  // ---------------------------------------------------------------- V2 (all optional)
  /** radius knots [u0, k0, u1, k1, ...] (k x radius, smooth-interpolated); overrides thickAt/tailTaper */
  profile?: number[];
  /** head half-height relative to `radius` (default per head kind) */
  headW?: number;
  /** body scale lattice: kind, scale length in px along the body, rows across the visible half */
  scale?: { kind?: ScaleKind; len?: number; rows?: number };
  /** ventral scute length in px (draws transverse plates in the belly band) */
  bellyScute?: number;
  /** keeled (ridged) belly scutes — the crag viper climbs with them */
  keeledBelly?: boolean;
  /** how far up the side view the belly colour reaches (0..1 of the height, default 0.28) */
  bellyW?: number;
  /** chin / lip / throat colour (default belly) */
  throat?: C;
  pupil?: 'slit' | 'round';
  eyeSize?: number;
  /** brow ridge strength multiplier */
  brow?: number;
  /** supraocular hornlets, px */
  horns?: number;
  /** heat-sensing pits along the upper lip */
  pits?: boolean;
  /** mouth-line curve: + curls up at the corner (smile), - down */
  smile?: number;
  mouthCol?: C;
  tongueCol?: C;
  teeth?: 'fangs' | 'croc' | 'needle' | 'none';
  headMark?: 'postocular' | 'mask' | 'none';
  /** iridescent sheen colours, shadow -> highlight */
  sheen?: C[];
  /** gliders: max body roll (rad) toward the viewer as `flatten` rises (shows the wide ribbon) */
  glideRoll?: number;
  /** gliders: extra width when fully flattened (x radius) */
  glideWiden?: number;
  /** neck crest / hood raised by SerpentState.crest */
  crest?: { col: C; col2: C; h: number };
  /** throat fan flared by SerpentState.dewlap */
  dewlap?: { col: C; col2: C; size: number };
  /** skin flaps between front and hind legs, spread by `flatten` */
  patagia?: { col: C; col2?: C };
  /** glide pose (flatten > 0.5) is drawn from above with limbs and flaps spread */
  glideTop?: boolean;
  /** crocodilian armour: plate rows on the upper half, plate length px, tail crest height px */
  osteoderms?: { rows: number; len: number; crest?: number };
  /** algae / moss on the back: ramp dark -> light and default coverage 0..1 */
  moss?: { col: C[]; amount: number };
  /** number of healed scars */
  scars?: number;
  /** glowing flank spots (emissive) */
  photophores?: C;
  ventralFin?: FinSpec;
  /** gill frond length (x radius, default 1.7) */
  gillLen?: number;
  /** paddle tail: extra tail height (x radius) */
  paddle?: number;
  /** fraction of the body that is the lure bulb (default 0.07) */
  lureLen?: number;
  /** base wetness 0..1 (glossy highlight) */
  wet?: number;
  /** nostrils on top of the snout */
  nostrilTop?: boolean;
  /** V12 plumage (the feathered boa): a fringe down the spine, a ruff behind the head raised by
   *  SerpentState.crest, a crest on the crown. Absent: the serpent is painted exactly as before. */
  feathers?: FeatherSpec;
  seed?: number;

  // ---------------------------------------------------------------- V13 anatomy (all optional)
  /** body cross-section (side view): superellipse exponents of the belly half (high = flat belly with a
   *  ventrolateral angle) and the back half (low = a roof up to the vertebral ridge), depth = how wide
   *  the body is toward the viewer (x half-height), ridge = vertebral ridge strength. Default per head. */
  section?: { bot?: number; top?: number; depth?: number; ridge?: number };
  /** outline: keeled-scale serration on the back (px), belly sag (fraction), muscle-band relief 0..1 */
  edge?: { serr?: number; sag?: number; muscle?: number; gloss?: number };
  /** the lower flank's own colour (a crocodile's yellow-olive sides, a boa's paler lateral band) */
  flank?: C;
}

/** V12 plumage: feathers hand-shaped pixel by pixel (vane, shaft, barbs, splits, an iridescent sheen) */
export interface FeatherSpec {
  /** feathers along the spine from..to (0 head .. 1 tail): length x radius, spacing x radius */
  fringe?: { from: number; to: number; len: number; every?: number };
  /** the ruff behind the head: feathers in the fan and their length x radius */
  ruff?: { n: number; len: number };
  /** the crest on the crown: feathers and their length x radius */
  crest?: { n: number; len: number };
  /** vane colours dark -> light (the ruff and the crest) */
  vane: C[];
  /** the spine fringe's own vane colours (default: vane) */
  fringeVane?: C[];
  /** shaft */
  rachis: C;
  /** the dark tips */
  tip?: C;
  /** the ruff's display colours, inner and middle bands (shown when it is raised) */
  flash?: C;
  flash2?: C;
  /** iridescent sheen colours, shadow -> highlight */
  sheen?: C[];
  /** dark bars across the fringe feathers */
  barred?: boolean;
}

export interface SerpentState {
  pts: [number, number][]; // spine points world coords, [0] = head
  facing: number;          // +1 faces right, -1 left
  jaw: number;             // 0 closed .. 1 wide open
  tongue: number;          // 0..1 extension
  legPhase: number;
  legLift: number;
  grounded: boolean;
  groundY: (x: number) => number;
  flatten: number;
  swell?: { at: number; k: number }; // digestion bulge
  blink?: boolean;
  submerge?: number; // y level below which pixels are faded (water)

  // ---------------------------------------------------------------- V2 (all optional)
  /** eye expression: alert = wide, angry = narrowed under a lowered brow, closed = lid */
  eye?: EyeState;
  /** gecko throat fan 0..1 */
  dewlap?: number;
  /** sprint viper neck crest / hood 0..1 */
  crest?: number;
  /** wet sheen 0..1 (after swimming) */
  wet?: number;
  /** moss coverage override 0..1 */
  mossy?: number;
  /** clinging to a surface that faces the camera (trunk, cliff): drawn from above, legs splayed */
  vertical?: boolean;
  /** strider: dig with the forelegs 0..1 */
  dig?: number;
  /** crocodile lunge 0..1 (legs thrust back, head up) */
  lunge?: number;
  /** emissive strength 0..1 (lure / photophores) — default 1 */
  glow?: number;
  /** stepping amount 0..1; default legLift with automatic settling when legPhase stops changing */
  gait?: number;
  /** head pitch in radians (+ = nose up) */
  headTilt?: number;
  /** level of detail override: 0 flat, 1 scales, 2 full */
  detail?: number;
}

// ================================================================== constants & helpers
type V = [number, number];

const NR = 8; // ramp length per material
const LX = -0.49, LY = -0.686, LZ = 0.539; // key light: top-left, toward the viewer
// the form light used on the body and head: steeper, so the back and crown planes separate clearly
// from the flank and cheek (a pixel artist's top light) while the limbs keep the softer key
const FX = -0.4, FY = -0.82, FZ = 0.41;
const GX = -0.238, GY = -0.488, GZ = 0.839; // its half vector: the gloss on smooth scales
const L2X = -0.581, L2Y = -0.814; // in-plane light direction
const HX = -0.28, HY = -0.39, HZ = 0.877; // half vector (light + view) for wet speculars
const HALF_PI = Math.PI / 2;
const INV_HALF_PI = 2 / Math.PI;
const LUTN = 128;
const ASIN = new Float32Array(LUTN + 1);
const SQRT1 = new Float32Array(LUTN + 1);
for (let i = 0; i <= LUTN; i++) {
  const v = (i / LUTN) * 2 - 1;
  ASIN[i] = Math.asin(v);
  SQRT1[i] = Math.sqrt(Math.max(0, 1 - v * v));
}

// material ids (each owns NR ramp entries)
const M_BASE = 0, M_PAT = 1, M_PAT2 = 2, M_BELLY = 3, M_THROAT = 4, M_MOSS = 5, M_SCAR = 6, M_LURE = 7,
  M_PHOTO = 8, M_SKIN = 9, M_FIN = 10, M_FIN2 = 11, M_GILL = 12, M_MOUTH = 13, M_TOOTH = 14, M_X1 = 15,
  M_X2 = 16, M_LEG = 17, M_EYE = 18, M_CLAW = 19, M_SHEEN = 20, M_FLANK = 26;

// pattern ids
const P_PLAIN = 0, P_BANDS = 1, P_DIAMONDS = 2, P_STRIPE = 3, P_BLOTCH = 4, P_RINGS = 5, P_SPECKLE = 6,
  P_SADDLES = 7, P_MOTTLE = 8, P_BARK = 9, P_COUNTER = 10, P_ZIGZAG = 11, P_FLANK = 12, P_RIBBON = 13,
  P_CROC = 14, P_SKIN = 15;
const PATTERN_IDS: Record<Pattern, number> = {
  plain: P_PLAIN, bands: P_BANDS, diamonds: P_DIAMONDS, stripe: P_STRIPE, blotch: P_BLOTCH, rings: P_RINGS,
  speckle: P_SPECKLE, saddles: P_SADDLES, mottle: P_MOTTLE, bark: P_BARK, countershade: P_COUNTER,
  zigzag: P_ZIGZAG, flank: P_FLANK, ribbon: P_RIBBON, croc: P_CROC, skin: P_SKIN,
};
const S_NONE = 0, S_SMOOTH = 1, S_KEELED = 2, S_BEAD = 3, S_SKIN = 4, S_OSTEO = 5;
const SCALE_IDS: Record<ScaleKind, number> = { none: S_NONE, smooth: S_SMOOTH, keeled: S_KEELED, bead: S_BEAD, skin: S_SKIN, osteoderm: S_OSTEO };

const mod = (a: number, m: number) => a - Math.floor(a / m) * m;
/** a sine table for the per-pixel relief (index = phase * SINK, masked) */
const SINN = 1024, SINK = SINN / (Math.PI * 2);
const SINL = new Float32Array(SINN);
/** cos(phi) for phi in [-pi/2, pi/2] */
const COSN = 256, COSK = COSN / Math.PI;
const COSL = new Float32Array(COSN + 1);
for (let i = 0; i <= COSN; i++) COSL[i] = Math.cos(-HALF_PI + (i / COSN) * Math.PI);
for (let i = 0; i < SINN; i++) SINL[i] = Math.sin((i / SINN) * Math.PI * 2);

/** resample a hand-picked ramp to n entries */
function resampleRamp(cols: C[], n = NR): C[] {
  const out: C[] = [];
  if (cols.length === 1) return around(cols[0]);
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * (cols.length - 1);
    const a = Math.floor(f), b = Math.min(cols.length - 1, a + 1);
    out.push(mix(cols[a], cols[b], f - a));
  }
  return out;
}
/** hue-shifted ramp around a base colour (cool saturated shadows, warm highlights); base at `mid` */
function around(base: C, lo = -0.62, hi = 0.42, mid = 4, n = NR): C[] {
  const out: C[] = [];
  for (let i = 0; i < n; i++) {
    const t = i < mid ? lo * (1 - i / mid) : i === mid ? 0 : hi * ((i - mid) / (n - 1 - mid));
    out.push(t === 0 ? base : shade(base, t));
  }
  return out;
}

const OR = OUTLINE & 255, OG = (OUTLINE >>> 8) & 255, OB = (OUTLINE >>> 16) & 255;
/** opaque mix toward the (cool, near-black) outline colour */
function tint(c: C, k: number): C {
  const u = 1 - k;
  return rgba((c & 255) * u + OR * k, ((c >>> 8) & 255) * u + OG * k, ((c >>> 16) & 255) * u + OB * k, 255);
}
/** alpha-over of c (alpha a 0..255) onto d, result opaque when d is opaque */
function over(d: C, c: C, a: number): C {
  const da = d >>> 24;
  if (da === 0) return ((c & 0x00ffffff) | (a << 24)) >>> 0;
  const t = a / 255, u = 1 - t;
  return rgba((c & 255) * t + (d & 255) * u, ((c >>> 8) & 255) * t + ((d >>> 8) & 255) * u, ((c >>> 16) & 255) * t + ((d >>> 16) & 255) * u, Math.max(da, a));
}

// ---------------------------------------------------------------- head kinds
interface HeadSpec {
  /** half-height at the jowls, x body radius */
  w: number;
  /** head length, x half-height */
  len: number;
  /** profile knots in t = f / headLen (first knot < 0 = behind the head point) */
  kt: number[];
  top: number[];
  bot: number[];
  mo: number[];
  hinge: number;
  jaw: number;
  eyeT: number;
  eyeU: number;
  eyeR: number;
  brow: number;
  nos: V;
  pupil: 'slit' | 'round';
  teeth: 'fangs' | 'croc' | 'needle' | 'none';
  /** top-view half-width, x half-height */
  topW: number;
  labials: boolean;
  /** a muscle / gland bulge (venom glands, jaw adductors, parotoids): t, u (x hh), radius (x hh), strength */
  jowl: number[];
  /** head cross-section exponents (crown half, jaw half): high = flat cheek meeting the crown at a canthus */
  sx: number[];
}
const HEADS: Record<HeadKind, HeadSpec> = {
  // pit viper: deep jowls over the venom glands, a flat crown under a shelf of supraoculars, a short
  // snout dropping off the canthus, a long mouth line that turns down at the corner
  viper: {
    w: 1.28, len: 2.25, kt: [-0.26, -0.06, 0.1, 0.28, 0.46, 0.62, 0.76, 0.87, 0.95, 1],
    top: [0.56, 0.8, 0.9, 0.93, 0.94, 0.92, 0.82, 0.66, 0.5, 0.3], bot: [-0.6, -0.97, -1.05, -0.98, -0.82, -0.66, -0.52, -0.4, -0.28, -0.12],
    mo: [-0.46, -0.54, -0.5, -0.42, -0.35, -0.29, -0.23, -0.17, -0.11, -0.04],
    hinge: 0.04, jaw: 1.1, eyeT: 0.6, eyeU: 0.4, eyeR: 0.29, brow: 1, nos: [0.9, 0.42], pupil: 'slit', teeth: 'fangs', topW: 1, labials: true,
    jowl: [0.18, -0.18, 0.46, 1.1], sx: [3.4, 2.2],
  },
  // the sprint viper's longer raptorial head
  raptor: {
    w: 1.18, len: 2.5, kt: [-0.22, -0.04, 0.14, 0.34, 0.52, 0.68, 0.82, 0.92, 1],
    top: [0.58, 0.8, 0.9, 0.9, 0.86, 0.75, 0.6, 0.46, 0.26], bot: [-0.6, -0.95, -1.0, -0.86, -0.7, -0.56, -0.44, -0.32, -0.12],
    mo: [-0.3, -0.37, -0.37, -0.32, -0.26, -0.2, -0.15, -0.1, -0.04],
    hinge: 0.05, jaw: 1.0, eyeT: 0.55, eyeU: 0.42, eyeR: 0.28, brow: 0.9, nos: [0.9, 0.42], pupil: 'slit', teeth: 'fangs', topW: 0.95, labials: true,
    jowl: [0.16, -0.12, 0.42, 0.9], sx: [3.2, 2.4],
  },
  // tree snake: a long pointed snout, a big eye with a sighting groove in front of it
  slim: {
    w: 1.12, len: 2.6, kt: [-0.26, 0, 0.2, 0.42, 0.62, 0.8, 0.92, 1],
    top: [0.7, 0.86, 0.9, 0.86, 0.72, 0.52, 0.36, 0.2], bot: [-0.7, -0.88, -0.86, -0.7, -0.52, -0.36, -0.24, -0.1],
    mo: [-0.3, -0.33, -0.3, -0.24, -0.17, -0.11, -0.06, -0.02],
    hinge: 0.1, jaw: 0.9, eyeT: 0.5, eyeU: 0.3, eyeR: 0.42, brow: 0.35, nos: [0.9, 0.32], pupil: 'round', teeth: 'needle', topW: 0.85, labials: true,
    jowl: [0.14, -0.08, 0.4, 0.4], sx: [3.0, 2.4],
  },
  // boa: a long flat-topped head, small eyes under heavy brows, a squared snout, pitted lips
  blunt: {
    w: 1.06, len: 2.6, kt: [-0.22, -0.02, 0.16, 0.36, 0.56, 0.74, 0.86, 0.95, 1],
    top: [0.72, 0.85, 0.89, 0.88, 0.86, 0.8, 0.71, 0.56, 0.32], bot: [-0.76, -0.95, -0.93, -0.82, -0.69, -0.58, -0.49, -0.38, -0.17],
    mo: [-0.36, -0.42, -0.4, -0.35, -0.29, -0.23, -0.18, -0.12, -0.04],
    hinge: 0.08, jaw: 0.95, eyeT: 0.6, eyeU: 0.4, eyeR: 0.27, brow: 0.6, nos: [0.91, 0.42], pupil: 'round', teeth: 'needle', topW: 0.95, labials: true,
    jowl: [0.16, -0.1, 0.46, 0.8], sx: [3.6, 2.2],
  },
  // crocodile: skull table, raised orbits, a long armoured snout with a nasal boss, festooned jaw line,
  // the mandible's deep back end under the jaw muscles
  croc: {
    w: 0.86, len: 4.7, kt: [-0.08, 0, 0.06, 0.12, 0.18, 0.24, 0.31, 0.42, 0.58, 0.74, 0.85, 0.915, 0.96, 1],
    top: [0.8, 0.84, 0.86, 1.02, 1.08, 0.9, 0.64, 0.56, 0.5, 0.46, 0.46, 0.56, 0.5, 0.3],
    bot: [-0.98, -1.1, -1.12, -1.02, -0.88, -0.76, -0.66, -0.56, -0.48, -0.44, -0.42, -0.4, -0.34, -0.2],
    mo: [0.1, 0.08, 0.0, -0.08, -0.13, -0.15, -0.15, -0.13, -0.18, -0.12, -0.17, -0.06, -0.15, -0.08],
    hinge: 0.03, jaw: 0.8, eyeT: 0.16, eyeU: 0.78, eyeR: 0.2, brow: 1.2, nos: [0.93, 0.5], pupil: 'slit', teeth: 'croc', topW: 0.8, labials: false,
    jowl: [0.04, -0.62, 0.42, 1.1], sx: [4.2, 2.6],
  },
  // marine serpent: a broad flat head, a deep gape running back past the eye, a lower jaw that juts
  leviathan: {
    w: 0.9, len: 2.75, kt: [-0.16, 0, 0.16, 0.36, 0.54, 0.64, 0.72, 0.82, 0.92, 0.97, 1],
    top: [0.86, 0.95, 0.94, 0.86, 0.8, 0.84, 0.74, 0.6, 0.52, 0.42, 0.24], bot: [-0.9, -1.02, -1.0, -0.9, -0.78, -0.7, -0.64, -0.58, -0.52, -0.44, -0.26],
    mo: [-0.06, -0.14, -0.18, -0.17, -0.15, -0.13, -0.1, -0.06, -0.02, 0.02, 0.0],
    hinge: 0.1, jaw: 0.75, eyeT: 0.62, eyeU: 0.42, eyeR: 0.15, brow: 1.2, nos: [0.92, 0.36], pupil: 'round', teeth: 'needle', topW: 0.9, labials: false,
    jowl: [0.2, -0.45, 0.5, 0.9], sx: [3.2, 2.6],
  },

  // water snake: a flattened head, eyes and nostrils high on top
  eel: {
    w: 1.02, len: 2.3, kt: [-0.24, 0, 0.26, 0.52, 0.76, 0.9, 1],
    top: [0.78, 0.86, 0.84, 0.76, 0.6, 0.44, 0.24], bot: [-0.8, -0.92, -0.86, -0.7, -0.52, -0.36, -0.14],
    mo: [-0.32, -0.34, -0.3, -0.23, -0.15, -0.09, -0.03],
    hinge: 0.1, jaw: 0.8, eyeT: 0.62, eyeU: 0.54, eyeR: 0.24, brow: 0.2, nos: [0.9, 0.62], pupil: 'round', teeth: 'needle', topW: 0.9, labials: true,
    jowl: [0.14, -0.1, 0.4, 0.5], sx: [3.8, 2.4],
  },
  // gecko: a broad triangular head, the huge lidless eye, the ear opening behind the mouth corner
  gecko: {
    w: 1.25, len: 2.4, kt: [-0.22, 0, 0.18, 0.4, 0.62, 0.8, 0.92, 1],
    top: [0.66, 0.86, 0.94, 0.92, 0.76, 0.58, 0.42, 0.2], bot: [-0.64, -0.86, -0.86, -0.74, -0.58, -0.44, -0.32, -0.14],
    mo: [-0.18, -0.22, -0.24, -0.22, -0.17, -0.12, -0.07, -0.02],
    hinge: 0.05, jaw: 0.7, eyeT: 0.5, eyeU: 0.26, eyeR: 0.46, brow: 0.4, nos: [0.93, 0.3], pupil: 'slit', teeth: 'none', topW: 0.9, labials: false,
    jowl: [0.1, -0.2, 0.42, 0.7], sx: [3.0, 2.6],
  },
  // salamander: a broad flat head, a wide mouth curving back, small eyes high up, parotoid bulges
  salamander: {
    w: 1.05, len: 1.95, kt: [-0.2, 0, 0.2, 0.45, 0.68, 0.86, 0.96, 1],
    top: [0.72, 0.82, 0.88, 0.85, 0.74, 0.6, 0.44, 0.26], bot: [-0.76, -0.92, -0.9, -0.8, -0.66, -0.5, -0.34, -0.16],
    mo: [-0.06, -0.1, -0.16, -0.18, -0.15, -0.1, -0.06, -0.02],
    hinge: 0.02, jaw: 0.6, eyeT: 0.58, eyeU: 0.56, eyeR: 0.25, brow: 0.1, nos: [0.94, 0.42], pupil: 'round', teeth: 'none', topW: 1.1, labials: false,
    jowl: [0.08, 0.42, 0.44, 0.9], sx: [2.8, 2.6],
  },
};

// ---------------------------------------------------------------- cross-sections
// A snake is not a tube: its body is a loaf, a flat belly of wide ventral scutes meeting the flank at a
// ventrolateral angle, the flanks rising to a back that roofs up to the vertebral ridge. A viper's is a
// rounded triangle, a boa's a heavy loaf, a tree snake's tall with keeled belly edges, an eel's laterally
// compressed, a crocodile's a broad armoured box. Each is a superellipse per half (side view: y = up
// the flank, z = toward the viewer); the shading reads its normals from a LUT.
interface SecSpec { bot: number; top: number; depth: number; ridge: number }
const SECTIONS: Record<HeadKind, SecSpec> = {
  viper: { bot: 4.2, top: 1.75, depth: 1.05, ridge: 0.7 },
  raptor: { bot: 3.6, top: 2.2, depth: 0.95, ridge: 0.45 },
  slim: { bot: 5, top: 1.8, depth: 0.85, ridge: 0.5 },
  blunt: { bot: 3.4, top: 2.15, depth: 1.12, ridge: 0.35 },
  eel: { bot: 2.3, top: 2.4, depth: 0.7, ridge: 0.2 },
  leviathan: { bot: 2.5, top: 2.5, depth: 0.72, ridge: 0.1 },
  croc: { bot: 4.6, top: 3.6, depth: 1.4, ridge: 0 },
  gecko: { bot: 3.6, top: 3.0, depth: 1.45, ridge: 0.3 },
  salamander: { bot: 3.2, top: 2.6, depth: 1.3, ridge: 0.45 },
};

// scratch outputs of the pattern function (avoid per-pixel allocation)
let _mat = 0, _off = 0, _str = 0, _v = 0, _hw = 1;

interface LegPose {
  hx: number; hy: number; kx: number; ky: number; ax: number; ay: number; fx: number; fy: number;
  dx: number; dy: number; lift: number; far: boolean; front: boolean; side: number;
  r0: number; r1: number; r2: number; r3: number; spec: LegSpec; drawn: boolean; top: boolean;
  /** how far a sprawling limb is folded out toward the viewer (0 flat in the picture .. 1) */
  fore: number;
}

/** head plate centres (head fraction a, height fraction b above the lip) around an eye at eyeT */
const PLATES = new Map<number, number[]>();
function HEAD_PLATES(E: number): number[] {
  const hit = PLATES.get(E);
  if (hit) return hit;
  const lo = E + (0.9 - E) * 0.45;
  const out = [
    0.985, 0.42,           // rostral
    0.9, 0.5,              // nasal (the nostril sits in it)
    lo, 0.55,              // loreal
    E + 0.12, 0.6,         // preocular
    E - 0.1, 0.68, E - 0.1, 0.36, // postoculars
    E, 0.98,               // supraocular
    0.9, 0.96, lo + 0.02, 0.98, // internasal, prefrontal
    E - 0.24, 1.02, E - 0.5, 0.98, // parietals
    E - 0.26, 0.6, E - 0.44, 0.56, E - 0.4, 0.82, E - 0.62, 0.66, // temporals
    E + 0.03, 0.2, E - 0.2, 0.18, // the labial row's upper neighbours
  ];
  PLATES.set(E, out);
  return out;
}

// ================================================================== the painter
export class SerpentPainter {
  /** Level of detail: 0 flat colour + pattern, 1 + scales, 2 full (default). SerpentState.detail overrides. */
  detail = 2;

  private readonly R: Uint32Array;
  private readonly nSheen: number;
  private readonly hs: HeadSpec;
  private readonly hh: number;
  private readonly hl: number;
  private readonly period: number;
  private readonly phiB: number;
  private readonly patId: number;
  private readonly scaleId: number;
  private readonly scaleLen: number;
  private readonly scaleRows: number;
  private readonly scars: number[] = [];
  private readonly seed: number;
  private readonly poses: LegPose[] = [];
  // cross-section LUT (side view): normal along the body normal, toward the viewer, and the angular
  // body coordinate phi, all indexed like ASIN by v
  private readonly SN = new Float32Array(LUTN + 1);
  private readonly SZ = new Float32Array(LUTN + 1);
  private readonly SP = new Float32Array(LUTN + 1);
  // the head's own cross-section LUT (flat cheeks, crown plane, rounded jaw)
  private readonly HN = new Float32Array(LUTN + 1);
  /** phi bin -> v index (inverse of SP) */
  private readonly PINV = new Int16Array(LUTN + 1);
  /** where the tail begins behind the vent (the belly steps in), 2 = none */
  private readonly ventU: number;
  private readonly HZ = new Float32Array(LUTN + 1);
  /** v of the ventrolateral angle and of the vertebral ridge line */
  private readonly vKeel: number;
  private readonly vRidge: number;
  private readonly serr: number;
  private readonly sag: number;
  private readonly muscle: number;
  private readonly gloss: number;
  /** where the tail starts (behind the hind legs), 0..1 */
  private readonly tailU: number;
  /** the costal-groove span (an amphibian's flank between its legs) */
  private readonly cg0: number;
  private readonly cg1: number;

  // per-paint spine samples
  private n = 0;
  private total = 0;
  private ds = 1;
  private fEff = 1;
  private roll = 0;
  private topView = false;
  private flatK = 0;
  private cap = 0;
  private PX = new Float32Array(0);
  private PY = new Float32Array(0);
  private TX = new Float32Array(0);
  private TY = new Float32Array(0);
  private NX = new Float32Array(0);
  private NY = new Float32Array(0);
  private WW = new Float32Array(0);
  private SWK = new Float32Array(0); // swell amount 0..1 per sample
  private FH = new Float32Array(0);  // fin height per sample (scratch)
  private WU = new Float32Array(0);  // contour: back edge distance from the spine
  private WD = new Float32Array(0);  // contour: belly edge distance from the spine
  private KK = new Float32Array(0);  // signed curvature (+ = bending toward the back)
  private MPH = new Float32Array(0); // muscle-block phase per sample
  private hLT = new Float32Array(0); // head profile LUTs (reused)
  private hLB = new Float32Array(0);
  private hLM = new Float32Array(0);
  private FNZ = new Float32Array(0); // fold jitter per sample
  private SCK = new Uint8Array(0);   // 1 where a scar can be
  private OVL = new Uint8Array(0);   // 1 where a coil can lie on the body
  private gHead = new Int32Array(0);
  private gNext = new Int32Array(0);
  private cum = new Float32Array(0);

  // G-buffer
  private gw = 0;
  private gh = 0;
  private gS = new Float32Array(0);
  private gV = new Float32Array(0);
  private gM = new Uint8Array(0);
  private bx0 = 0; private by0 = 0; private bx1 = -1; private by1 = -1;   // body raster bbox
  private px0 = 0; private py0 = 0; private px1 = -1; private py1 = -1;   // previous G region

  // stepping memory (each creature owns its painter)
  private lastPhase = NaN;
  private lastTime = NaN;
  private stillT = 0;
  private gaitK = 1;

  // V12 plumage ramps (null for serpents without feathers)
  private readonly FV: C[] | null = null;
  private readonly FV0: C[] | null = null;
  private readonly FS: C[][] = [];
  private readonly FX: { rach: C; rachD: C; tip: C; tipL: C; fl: C[]; fl2: C[] } | null = null;

  // outline scratch
  private olI = new Int32Array(1024);
  private olC = new Uint32Array(1024);

  constructor(readonly look: SerpentLook) {
    const L = look;
    this.seed = L.seed ?? ((L.length * 131 + L.radius * 977) | 0);
    this.hs = HEADS[L.head] ?? HEADS.blunt;
    this.hh = Math.max(1.6, L.radius * (L.headW ?? this.hs.w));
    this.hl = L.headLen ?? this.hh * this.hs.len;
    this.period = L.period ?? Math.max(6, L.radius * 2.6);
    const bw = clamp(L.bellyW ?? 0.28, 0, 0.9);
    this.phiB = Math.asin(-1 + 2 * bw);
    this.patId = PATTERN_IDS[L.pattern] ?? P_PLAIN;
    const sk = L.scale?.kind ?? (L.osteoderms ? 'osteoderm' : L.scutes ? 'osteoderm' : 'smooth');
    this.scaleId = SCALE_IDS[sk] ?? S_SMOOTH;
    this.scaleLen = L.scale?.len ?? Math.max(2.2, L.radius * 0.36);
    this.scaleRows = L.scale?.rows ?? clamp(Math.round(L.radius * 1.1), 4, 16);

    // ---- cross-section LUT
    {
      const d0 = SECTIONS[L.head] ?? SECTIONS.blunt;
      const S = { bot: L.section?.bot ?? d0.bot, top: L.section?.top ?? d0.top, depth: L.section?.depth ?? d0.depth, ridge: L.section?.ridge ?? d0.ridge };
      const zf = (y: number) => {
        const a = y < 0 ? -y : y, p = y < 0 ? S.bot : S.top;
        let z = S.depth * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, a), p)), 1 / p);
        // the vertebral ridge: the back roofs up to a crest just under the top edge
        if (y > 0.55) z += S.ridge * S.depth * 0.07 * Math.exp(-(((y - 0.86) / 0.07) ** 2));
        return z;
      };
      const arc = new Float32Array(LUTN + 1);
      let acc = 0, vk = -0.8, bestK = -1;
      for (let i = 0; i <= LUTN; i++) {
        const y = (i / LUTN) * 2 - 1;
        const h = 1 / LUTN;
        const ya = Math.max(-1, y - h), yb = Math.min(1, y + h);
        const dz = (zf(yb) - zf(ya)) / (yb - ya);
        const q = 1 / Math.sqrt(1 + dz * dz);
        this.SN[i] = -dz * q;
        this.SZ[i] = q;
        if (i > 0) acc += Math.hypot(2 / LUTN, zf(y) - zf(y - 2 / LUTN));
        arc[i] = acc;
        // the ventrolateral angle: where the belly half turns fastest
        if (y < -0.4 && y > -0.98) {
          const d2 = Math.abs(zf(Math.min(1, y + h)) - 2 * zf(y) + zf(Math.max(-1, y - h)));
          if (d2 > bestK) { bestK = d2; vk = y; }
        }
      }
      for (let i = 0; i <= LUTN; i++) {
        const pa = -HALF_PI + Math.PI * (arc[i] / Math.max(1e-6, acc));
        this.SP[i] = ASIN[i] * 0.45 + pa * 0.55;
      }
      this.vKeel = vk;
      for (let j = 0, i = 0; j <= LUTN; j++) {
        const target = -HALF_PI + (j / LUTN) * Math.PI;
        while (i < LUTN && this.SP[i] < target) i++;
        this.PINV[j] = i;
      }
      this.ventU = L.legs || L.head === 'leviathan' || L.head === 'croc' ? 2 : L.head === 'slim' ? 0.74 : L.head === 'blunt' ? 0.87 : L.head === 'eel' ? 0.8 : 0.83;
      const sx = this.hs.sx;
      const hz = (y: number) => {
        const a = y < 0 ? -y : y, p = y < 0 ? sx[1] : sx[0];
        return 0.95 * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, a), p)), 1 / p);
      };
      for (let i = 0; i <= LUTN; i++) {
        const y = (i / LUTN) * 2 - 1, h = 1 / LUTN;
        const ya = Math.max(-1, y - h), yb = Math.min(1, y + h);
        const dz = (hz(yb) - hz(ya)) / (yb - ya);
        const q = 1 / Math.sqrt(1 + dz * dz);
        this.HN[i] = -dz * q;
        this.HZ[i] = q;
      }
      this.vRidge = S.ridge > 0.05 ? 0.84 : 2;
      const E = L.edge;
      const sk2 = L.scale?.kind ?? 'smooth';
      this.serr = E?.serr ?? (sk2 === 'keeled' ? 0.6 : sk2 === 'bead' ? 0.3 : sk2 === 'smooth' ? 0.22 : 0);
      this.sag = E?.sag ?? 0.04;
      this.muscle = E?.muscle ?? (L.radius >= 8 ? 0.6 : L.radius >= 4.5 ? 0.3 : 0);
      this.tailU = L.legs && L.legs.length ? Math.max(...L.legs.map(g => g.at)) + 0.05 : 0.7;
      this.cg0 = L.legs && L.legs.length > 1 ? Math.min(...L.legs.map(g => g.at)) + 0.05 : 2;
      this.cg1 = L.legs && L.legs.length > 1 ? Math.max(...L.legs.map(g => g.at)) - 0.03 : 2;
      this.gloss = E?.gloss ?? (sk2 === 'smooth' ? 0.8 : sk2 === 'skin' ? 0.6 : sk2 === 'bead' ? 0.35 : 0.2);
    }

    // ---- material ramps
    const ramps: C[][] = [];
    const D = L.dorsal;
    const legCol = L.legs && L.legs.length ? L.legs[0].col : D;
    ramps[M_BASE] = resampleRamp(D);
    ramps[M_PAT] = around(L.patternCol, -0.55, 0.36);
    ramps[M_PAT2] = around(L.patternCol2 ?? shade(L.patternCol, 0.35), -0.55, 0.3);
    ramps[M_BELLY] = around(L.belly, -0.5, 0.22, 5);
    ramps[M_THROAT] = around(L.throat ?? L.belly, -0.5, 0.22, 5);
    ramps[M_MOSS] = L.moss ? resampleRamp(L.moss.col) : around(hex('#6d8435'));
    ramps[M_SCAR] = around(mix(L.belly, hex('#d9b8ae'), 0.45), -0.45, 0.2, 5);
    ramps[M_LURE] = around(L.lure ?? hex('#dfffe0'), -0.42, 0.2, 5);
    ramps[M_PHOTO] = around(L.photophores ?? hex('#8ff0e0'), -0.45, 0.3, 5);
    ramps[M_SKIN] = around(mix(L.belly, hex('#b88c8a'), 0.35), -0.5, 0.2, 5);
    ramps[M_FIN] = around(L.dorsalFin?.col ?? L.pectoral ?? D[Math.min(3, D.length - 1)], -0.6, 0.4);
    ramps[M_FIN2] = around(L.ventralFin?.col ?? L.pectoral ?? L.dorsalFin?.col ?? D[Math.min(3, D.length - 1)], -0.6, 0.4);
    ramps[M_GILL] = around(L.gills ?? hex('#e0506e'), -0.62, 0.4);
    ramps[M_MOUTH] = around(L.mouthCol ?? hex('#c24a64'), -0.62, 0.3);
    ramps[M_TOOTH] = around(hex('#efe8d2'), -0.5, 0.12, 5);
    ramps[M_X1] = around(L.crest?.col ?? L.dewlap?.col ?? L.patagia?.col ?? L.patternCol2 ?? L.patternCol, -0.6, 0.35);
    ramps[M_X2] = around(L.crest?.col2 ?? L.dewlap?.col2 ?? L.patagia?.col2 ?? L.patternCol, -0.6, 0.35);
    ramps[M_LEG] = resampleRamp(legCol);
    ramps[M_EYE] = around(L.eye ?? hex('#f2c14e'), -0.55, 0.3);
    ramps[M_CLAW] = around((L.legs && L.legs[0]?.claw) ?? hex('#e6dcc4'), -0.55, 0.12, 5);
    const sheen = L.sheen ?? (L.iridescent ? [hex('#1f8a4f'), hex('#1c8f96'), hex('#3a5fc8'), hex('#8a52d8')] : null);
    const nSheen = sheen ? 6 : 0;
    for (let i = 0; i < nSheen; i++) {
      const f = (i / (nSheen - 1)) * (sheen!.length - 1);
      const a = Math.floor(f), b = Math.min(sheen!.length - 1, a + 1);
      ramps[M_SHEEN + i] = around(mix(sheen![a], sheen![b], f - a), -0.62, 0.42);
    }
    this.nSheen = nSheen;
    ramps[M_FLANK] = L.flank ? around(L.flank, -0.55, 0.32, 4) : ramps[M_BASE];
    for (let m = 0; m < M_FLANK; m++) if (!ramps[m]) ramps[m] = ramps[M_BASE];
    this.R = new Uint32Array(ramps.length * NR);
    for (let m = 0; m < ramps.length; m++) for (let i = 0; i < NR; i++) this.R[m * NR + i] = ramps[m][i];

    // ---- V12 plumage
    if (L.feathers) {
      const F = L.feathers;
      this.FV = resampleRamp(F.vane);
      this.FV0 = F.fringeVane ? resampleRamp(F.fringeVane) : this.FV;
      if (F.sheen) for (const c of F.sheen) this.FS.push(around(c, -0.5, 0.45));
      const tip = F.tip ?? shade(F.vane[0], -0.3);
      this.FX = {
        rach: F.rachis, rachD: shade(F.rachis, -0.35), tip, tipL: shade(tip, 0.35),
        fl: around(F.flash ?? hex('#e0a830'), -0.5, 0.35), fl2: around(F.flash2 ?? F.flash ?? hex('#c03030'), -0.5, 0.35),
      };
    }

    // ---- scars: [u, phi, len(px), slope, count]
    if (L.scars) {
      const rng = new Rng(this.seed ^ 0x5ca7);
      for (let i = 0; i < L.scars; i++) {
        this.scars.push(rng.range(0.12, 0.85), rng.range(-0.3, 1.2), rng.range(L.radius * 0.6, L.radius * 1.4), rng.range(-1.3, 1.3), rng.chance(0.4) ? 3 : 1);
      }
    }
    // ---- leg pose pool
    const nl = (L.legs?.length ?? 0) * 2;
    for (let i = 0; i < nl; i++) {
      this.poses.push({ hx: 0, hy: 0, kx: 0, ky: 0, ax: 0, ay: 0, fx: 0, fy: 0, dx: 1, dy: 0, lift: 0, far: false, front: true, side: 1, r0: 1, r1: 1, r2: 1, r3: 1, spec: L.legs![i >> 1], drawn: false, top: false, fore: 0 });
    }
  }

  // ---------------------------------------------------------------- body profile
  /** Physical body radius at u (0 head .. 1 tail). The game uses it to rest the body on surfaces. */
  radiusAt(u: number) {
    const L = this.look;
    if (L.profile && L.profile.length >= 4) {
      const P = L.profile;
      if (u <= P[0]) return Math.max(0.6, L.radius * P[1]);
      for (let i = 2; i < P.length; i += 2) {
        if (u <= P[i]) {
          const t = (u - P[i - 2]) / Math.max(1e-6, P[i] - P[i - 2]);
          const e = t * t * (3 - 2 * t);
          return Math.max(0.6, L.radius * (P[i - 1] + (P[i + 1] - P[i - 1]) * e));
        }
      }
      return Math.max(0.6, L.radius * P[P.length - 1]);
    }
    const peak = L.thickAt ?? 0.3;
    const neck = u < 0.05 ? 0.78 + u * 2 : 1;
    let r: number;
    if (u < peak) r = 0.72 + 0.28 * Math.sin((u / peak) * Math.PI * 0.5);
    else r = 1 - Math.pow((u - peak) / (1 - peak), L.tailTaper ?? 1.3) * 0.92;
    return Math.max(0.6, L.radius * r * neck);
  }

  /** Recommended margin (px) around the spine's bounding box for the sprite buffer. */
  margin() {
    const L = this.look;
    let m = this.hl + this.hh + 4;
    if (L.legs) for (const g of L.legs) m = Math.max(m, g.len + L.radius + 6);
    if (L.dorsalFin) m = Math.max(m, L.dorsalFin.h + L.radius * 2 + 4);
    if (L.gills) m = Math.max(m, L.radius * (L.gillLen ?? 1.7) * 1.3 + 6);
    if (L.crest) m = Math.max(m, L.crest.h + L.radius + 4);
    if (L.dewlap) m = Math.max(m, L.dewlap.size + L.radius + 4);
    if (L.feathers) m = Math.max(m, Math.max(L.feathers.ruff?.len ?? 0, L.feathers.crest?.len ?? 0, L.feathers.fringe?.len ?? 0) * L.radius * 1.15 + L.radius + 6);
    return Math.ceil(m + L.radius);
  }

  // ---------------------------------------------------------------- main entry
  /**
   * Rasterise into buf. (ox, oy) is the world position of the buffer's top-left.
   * Optional `emissive` (same size as buf) is cleared and receives only glowing pixels.
   */
  paint(buf: PixelBuffer, st: SerpentState, ox: number, oy: number, time: number, emissive?: PixelBuffer) {
    const L = this.look;
    buf.clear();
    const em = emissive && emissive !== buf && emissive.w === buf.w && emissive.h === buf.h ? emissive : null;
    if (em) em.clear();
    if (!st.pts || st.pts.length === 0) return;
    const detail = st.detail ?? this.detail;
    this.ensureG(buf.w, buf.h);
    this.clearG();

    // ---- 1. spine
    this.ds = clamp(L.radius * 0.12, 0.75, 1.5);
    this.resample(st.pts, ox, oy, st.facing || 1);
    const flat = clamp(st.flatten || 0);
    const glideTop = !!L.glideTop && flat > 0.5;
    this.topView = !!st.vertical || glideTop;
    this.roll = this.topView ? HALF_PI : (L.glideRoll ?? 0) * flat;
    this.flatK = L.glideRoll ? flat : 0;
    this.widths(st, flat);

    // ---- 2. gait amount (auto-settle when the phase stops advancing)
    let gait: number;
    if (st.gait !== undefined) gait = clamp(st.gait);
    else {
      const dt = time - this.lastTime;
      if (!(dt > 0 && dt < 0.5) || Number.isNaN(this.lastPhase)) this.stillT = 0;
      else if (Math.abs(st.legPhase - this.lastPhase) < 1e-4) this.stillT += dt;
      else this.stillT = 0;
      const target = clamp(st.legLift) * (1 - smoothstep(0.12, 0.35, this.stillT));
      this.gaitK = dt > 0 && dt < 0.5 ? this.gaitK + (target - this.gaitK) * Math.min(1, dt * 7) : target;
      this.lastPhase = st.legPhase;
      this.lastTime = time;
      gait = this.gaitK;
    }
    if (L.legs && L.legs.length) this.poseLegs(st, ox, oy, time, gait, flat);

    // ---- 3. back layer
    if (this.topView) {
      if (L.patagia && glideTop) this.drawPatagia(buf, flat);
      this.drawLegs(buf, true, true);
    } else {
      this.drawLegs(buf, true, false);
      if (L.pectoral) this.drawPectoral(buf, time, true);
      if (L.gills) this.drawGills(buf, time, true);
      if (L.crest && (st.crest ?? 0) > 0.02) this.drawCrest(buf, clamp(st.crest ?? 0));
      if (L.feathers) this.drawPlumage(buf, st, time, 0);
    }

    // ---- 4. G-buffer: fins then body (body wins)
    if (!this.topView) {
      if (L.dorsalFin) this.rasterFin(L.dorsalFin, 1, time, 2);
      if (L.ventralFin) this.rasterFin(L.ventralFin, -1, time, 3);
    }
    this.rasterBody();

    // ---- 5. shade
    this.shade(buf, em, st, time, detail);

    // ---- 6. ornaments on the silhouette
    if (!this.topView) {
      if (L.osteoderms?.crest) this.drawCrestScutes(buf, st);
      if (L.patagia && !glideTop) this.drawFoldedPatagia(buf, flat);
      if (L.feathers) this.drawPlumage(buf, st, time, 1);
    }

    // ---- 7. front layer
    if (!this.topView) {
      this.drawLegs(buf, false, false);
      if (L.pectoral) this.drawPectoral(buf, time, false);
      if (L.gills) this.drawGills(buf, time, false);
    }
    if (L.dewlap && (st.dewlap ?? 0) > 0.02) this.drawDewlap(buf, st, clamp(st.dewlap ?? 0));
    this.drawHead(buf, st, time, detail);
    if (L.feathers && !this.topView) this.drawPlumage(buf, st, time, 2);

    // ---- 8. outline, then details that stay un-outlined
    this.outline(buf);
    if (st.tongue > 0.05) this.drawTongue(buf, st, time);

    // ---- 9. water
    if (st.submerge !== undefined) this.submerge(buf, em, st.submerge - oy);
  }

  // ================================================================ spine
  private grow(n: number) {
    if (n <= this.cap) return;
    const c = Math.max(n, Math.ceil(this.cap * 1.5), 64);
    this.cap = c;
    this.PX = new Float32Array(c); this.PY = new Float32Array(c);
    this.TX = new Float32Array(c); this.TY = new Float32Array(c);
    this.NX = new Float32Array(c); this.NY = new Float32Array(c);
    this.WW = new Float32Array(c); this.SWK = new Float32Array(c); this.FH = new Float32Array(c);
    this.WU = new Float32Array(c); this.WD = new Float32Array(c); this.KK = new Float32Array(c);
    this.MPH = new Float32Array(c); this.FNZ = new Float32Array(c);
  }

  private resample(pts: [number, number][], ox: number, oy: number, facing: number) {
    const N = pts.length;
    if (this.cum.length < N) this.cum = new Float32Array(Math.max(N, 64));
    const cum = this.cum;
    cum[0] = 0;
    for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const total = N > 1 ? cum[N - 1] : 0;
    const ds = this.ds;
    if (total < 0.5) {
      // degenerate spine: a stub pointing away from the facing
      this.grow(2);
      const x = pts[0][0] - ox, y = pts[0][1] - oy;
      this.PX[0] = x; this.PY[0] = y; this.PX[1] = x - facing; this.PY[1] = y;
      this.TX[0] = this.TX[1] = -facing; this.TY[0] = this.TY[1] = 0;
      this.n = 2; this.total = 1;
    } else {
      const n = Math.max(2, Math.ceil(total / ds) + 1);
      this.grow(n);
      const PX = this.PX, PY = this.PY, TX = this.TX, TY = this.TY;
      let j = 0;
      for (let k = 0; k < n; k++) {
        const s = k === n - 1 ? total : Math.min(total, k * ds);
        while (j < N - 2 && cum[j + 1] < s) j++;
        const segL = cum[j + 1] - cum[j];
        const t = segL > 1e-6 ? clamp((s - cum[j]) / segL) : 0;
        const p0 = pts[j > 0 ? j - 1 : 0], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2 < N ? j + 2 : N - 1];
        const t2 = t * t, t3 = t2 * t;
        const ax = -p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0], bx = 2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0], cx = -p0[0] + p2[0];
        const ay = -p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1], by = 2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1], cy = -p0[1] + p2[1];
        PX[k] = 0.5 * (2 * p1[0] + cx * t + bx * t2 + ax * t3) - ox;
        PY[k] = 0.5 * (2 * p1[1] + cy * t + by * t2 + ay * t3) - oy;
        let dx = 0.5 * (cx + 2 * bx * t + 3 * ax * t2), dy = 0.5 * (cy + 2 * by * t + 3 * ay * t2);
        let dl = Math.hypot(dx, dy);
        if (dl < 1e-5) { dx = p2[0] - p1[0]; dy = p2[1] - p1[1]; dl = Math.hypot(dx, dy) || 1; }
        TX[k] = dx / dl;
        TY[k] = dy / dl;
      }
      this.n = n;
      this.total = total;
    }
    // effective facing: trust st.facing unless it would put the back underneath at the head
    const n = this.n;
    const j = Math.min(n - 1, Math.max(1, Math.round(this.hh * 1.5 / this.ds)));
    let hx = this.PX[0] - this.PX[j], hy = this.PY[0] - this.PY[j];
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl; hy /= hl;
    let f = facing >= 0 ? 1 : -1;
    // dorsal normal at the head for this facing: (hy * f, -hx * f)
    if (-hx * f > 0.3) f = -f;
    this.fEff = f;
    for (let k = 0; k < n; k++) {
      this.NX[k] = -this.TY[k] * f;
      this.NY[k] = this.TX[k] * f;
    }
    // signed curvature, smoothed over a few px (+ = the spine turns toward the back: the back is the
    // inside of the bend and folds, the belly stretches)
    const KK = this.KK, TX = this.TX, TY = this.TY, NX = this.NX, NY = this.NY;
    const st = Math.max(1, Math.round(2.2 / this.ds));
    for (let k = 0; k < n; k++) {
      const a = k - st < 0 ? 0 : k - st, b = k + st > n - 1 ? n - 1 : k + st;
      if (b <= a) { KK[k] = 0; continue; }
      KK[k] = ((TX[b] - TX[a]) * NX[k] + (TY[b] - TY[a]) * NY[k]) / ((b - a) * this.ds);
    }
  }

  private widths(st: SerpentState, flat: number) {
    const L = this.look, n = this.n, total = this.total;
    const WW = this.WW, SWK = this.SWK;
    const sw = st.swell;
    const widen = 1 + (L.glideWiden ?? 0) * flat;
    const paddle = L.paddle ?? 0;
    const lureLen = L.lure ? (L.lureLen ?? 0.07) : 0;
    const patag = L.patagia && !this.topView ? flat * 0.35 : 0;
    for (let k = 0; k < n; k++) {
      const s = k === n - 1 ? total : k * this.ds;
      const u = s / total;
      let r = this.radiusAt(u);
      let swk = 0;
      if (sw && sw.k > 0) {
        const d = Math.abs(u - sw.at);
        const span = 0.08 * Math.max(1, 480 / Math.max(120, total)) * 0.9;
        if (d < span) {
          swk = Math.cos((d / span) * HALF_PI);
          swk *= swk;
          r *= 1 + sw.k * swk;
        }
      }
      if (paddle > 0 && u > 0.68) {
        const e = smoothstep(0.68, 0.9, u) * (1 - smoothstep(0.965, 1, u) * 0.85);
        r += L.radius * paddle * e;
      }
      if (lureLen > 0 && u > 1 - lureLen) {
        const t = (u - (1 - lureLen)) / lureLen; // 0..1 along the lure
        const seg = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 3.2);
        r = Math.max(r, L.radius * (0.34 + 0.2 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 0.07 * seg));
      }
      if (patag > 0 && u > 0.1 && u < 0.5) r *= 1 + patag * Math.sin(((u - 0.1) / 0.4) * Math.PI) * 0.4;
      WW[k] = r * widen;
      SWK[k] = swk;
    }
    // ---- the contour: not a swept tube. The belly sags and flattens onto the ground, the back carries a
    // serration of keeled scale tips, and on big bodies the epaxial muscle blocks ripple the topline.
    const WU = this.WU, WD = this.WD;
    const side = !this.topView && this.flatK < 0.5;
    const serr = side ? this.serr * (1 - this.flatK) : 0;
    const sag = side ? this.sag : 0;
    const SL = Math.max(1.6, this.scaleLen);
    const mus = side ? this.muscle : 0;
    const R0 = L.radius, mP = Math.max(5, R0 * 1.9);
    const sHead = this.hl * 0.25;
    const lureU = L.lure ? 1 - (L.lureLen ?? 0.07) : 2;
    for (let k = 0; k < n; k++) {
      const s = k === n - 1 ? total : k * this.ds;
      const u = s / total;
      const r = WW[k];
      let up = r * (1 - sag * 0.45), dn = r * (1 + sag);
      // the vent: behind the cloaca the tail's underside steps in
      if (side && u > this.ventU) { const e = Math.min(1, (u - this.ventU) / 0.012); dn *= 1 - 0.13 * e; }
      if (serr > 0 && s > sHead && u < lureU && r > 1.1) {
        // a keeled scale's free tip points to the tail: the edge rises along each scale, then drops
        const ph = s / SL + hash2(Math.floor(s / SL), 7, this.seed) * 0.25;
        const fr = ph - Math.floor(ph);
        up += serr * Math.min(1, r / 2.5) * (fr < 0.72 ? fr / 0.72 : (1 - fr) / 0.28) - serr * 0.4;
      }
      if (mus > 0 && u > 0.04 && u < 0.85) {
        const env = Math.sin(Math.min(1, (u - 0.04) / 0.81) * Math.PI);
        const m = Math.sin((s / mP) * Math.PI * 2 + noise1(s * 0.05, this.seed) * 2.5);
        up += m * R0 * 0.035 * mus * env;
        dn += Math.max(0, m) * R0 * 0.018 * mus * env;
      }
      WU[k] = up;
      WD[k] = dn;
      this.MPH[k] = ((s / Math.max(5, R0 * 1.7)) * Math.PI * 2 + noise1(s * 0.05, this.seed) * 2.5) * SINK;
      this.FNZ[k] = noise1(s * 0.21, this.seed + 5) - 0.5;
    }
  }

  /** per sample: 1 where a part of the body nearer the head (more than `gapS` px along) comes within
   *  touching distance, i.e. where a coil can lie on it; a spatial hash keeps it O(n) */
  private overlaps(gapS: number): Uint8Array {
    const n = this.n, PX = this.PX, PY = this.PY, WU = this.WU, WD = this.WD;
    if (this.OVL.length < this.cap) this.OVL = new Uint8Array(this.cap);
    const out = this.OVL;
    out.fill(0, 0, n);
    let wmax = 1, x0 = 1e9, y0 = 1e9;
    for (let k = 0; k < n; k++) {
      const w = Math.max(WU[k], WD[k]);
      if (w > wmax) wmax = w;
      if (PX[k] < x0) x0 = PX[k];
      if (PY[k] < y0) y0 = PY[k];
    }
    const cs = wmax * 2 + 2, gk = Math.max(1, Math.round(gapS / this.ds));
    const GW = 64;
    if (this.gHead.length < GW * GW) this.gHead = new Int32Array(GW * GW);
    if (this.gNext.length < this.cap) this.gNext = new Int32Array(this.cap);
    const head = this.gHead, next = this.gNext;
    head.fill(-1);
    const cell = (x: number, y: number) => ((Math.floor((x - x0) / cs) & (GW - 1)) * GW) + (Math.floor((y - y0) / cs) & (GW - 1));
    for (let k = 0; k < n; k++) { const c = cell(PX[k], PY[k]); next[k] = head[c]; head[c] = k; }
    const r2 = cs * cs;
    for (let k = gk; k < n; k++) {
      const cx = Math.floor((PX[k] - x0) / cs), cy = Math.floor((PY[k] - y0) / cs);
      let hit = 0;
      for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let j = head[(((cx + dx) & (GW - 1)) * GW) + ((cy + dy) & (GW - 1))]; j >= 0; j = next[j]) {
          if (j >= k - gk) continue;
          const ex = PX[j] - PX[k], ey = PY[j] - PY[k];
          if (ex * ex + ey * ey < r2) { hit = 1; break; }
        }
      }
      if (hit) { const a = Math.max(0, k - 2), b = Math.min(n - 1, k + 2); for (let q = a; q <= b; q++) out[q] = 1; }
    }
    return out;
  }

  private sampleAt(u: number) {
    return clamp(Math.round((u * this.total) / this.ds), 0, this.n - 1);
  }

  // ================================================================ G-buffer
  private ensureG(w: number, h: number) {
    if (w === this.gw && h === this.gh) return;
    this.gw = w;
    this.gh = h;
    this.gS = new Float32Array(w * h);
    this.gV = new Float32Array(w * h);
    this.gM = new Uint8Array(w * h);
    this.px0 = 0; this.py0 = 0; this.px1 = -1; this.py1 = -1;
  }
  private clearG() {
    const W = this.gw;
    for (let y = this.py0; y <= this.py1; y++) this.gM.fill(0, y * W + this.px0, y * W + this.px1 + 1);
    this.bx0 = this.gw; this.by0 = this.gh; this.bx1 = -1; this.by1 = -1;
  }

  /** Scanline triangle with linear (s, v) attributes into the G-buffer. */
  private tri(ax: number, ay: number, as: number, av: number, bx: number, by: number, bs: number, bv: number,
    cx: number, cy: number, cs: number, cv: number, part: number) {
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area > -1e-7 && area < 1e-7) return;
    const inv = 1 / area;
    const dsdx = ((bs - as) * (cy - ay) - (cs - as) * (by - ay)) * inv;
    const dsdy = ((cs - as) * (bx - ax) - (bs - as) * (cx - ax)) * inv;
    const dvdx = ((bv - av) * (cy - ay) - (cv - av) * (by - ay)) * inv;
    const dvdy = ((cv - av) * (bx - ax) - (bv - av) * (cx - ax)) * inv;
    const W = this.gw, H = this.gh;
    const ymin = Math.min(ay, by, cy), ymax = Math.max(ay, by, cy);
    const ya = Math.max(0, Math.ceil(ymin - 0.5)), yb = Math.min(H - 1, Math.floor(ymax - 0.5));
    if (ya > yb) return;
    const gS = this.gS, gV = this.gV, gM = this.gM;
    for (let y = ya; y <= yb; y++) {
      const yc = y + 0.5;
      let xl = 1e9, xr = -1e9;
      if ((ay <= yc && by >= yc) || (by <= yc && ay >= yc)) {
        const x = by !== ay ? ax + ((yc - ay) * (bx - ax)) / (by - ay) : Math.min(ax, bx);
        const x2 = by !== ay ? x : Math.max(ax, bx);
        if (x < xl) xl = x; if (x2 > xr) xr = x2;
      }
      if ((by <= yc && cy >= yc) || (cy <= yc && by >= yc)) {
        const x = cy !== by ? bx + ((yc - by) * (cx - bx)) / (cy - by) : Math.min(bx, cx);
        const x2 = cy !== by ? x : Math.max(bx, cx);
        if (x < xl) xl = x; if (x2 > xr) xr = x2;
      }
      if ((cy <= yc && ay >= yc) || (ay <= yc && cy >= yc)) {
        const x = ay !== cy ? cx + ((yc - cy) * (ax - cx)) / (ay - cy) : Math.min(cx, ax);
        const x2 = ay !== cy ? x : Math.max(cx, ax);
        if (x < xl) xl = x; if (x2 > xr) xr = x2;
      }
      const xa = Math.max(0, Math.ceil(xl - 0.5 - 1e-4)), xb = Math.min(W - 1, Math.floor(xr - 0.5 + 1e-4));
      if (xa > xb) continue;
      let sv = as + dsdx * (xa + 0.5 - ax) + dsdy * (yc - ay);
      let vv = av + dvdx * (xa + 0.5 - ax) + dvdy * (yc - ay);
      let idx = y * W + xa;
      for (let x = xa; x <= xb; x++, idx++) {
        gS[idx] = sv;
        gV[idx] = vv;
        gM[idx] = part;
        sv += dsdx;
        vv += dvdx;
      }
      if (xa < this.bx0) this.bx0 = xa;
      if (xb > this.bx1) this.bx1 = xb;
      if (y < this.by0) this.by0 = y;
      if (y > this.by1) this.by1 = y;
    }
  }

  private rasterBody() {
    const n = this.n, PX = this.PX, PY = this.PY, NX = this.NX, NY = this.NY, WU = this.WU, WD = this.WD, ds = this.ds;
    for (let k = n - 2; k >= 0; k--) {
      const k1 = k + 1;
      const s0 = k * ds, s1 = k1 === n - 1 ? this.total : k1 * ds;
      const u0 = WU[k], u1 = WU[k1], d0 = WD[k], d1 = WD[k1];
      const lx0 = PX[k] + NX[k] * u0, ly0 = PY[k] + NY[k] * u0, rx0 = PX[k] - NX[k] * d0, ry0 = PY[k] - NY[k] * d0;
      const lx1 = PX[k1] + NX[k1] * u1, ly1 = PY[k1] + NY[k1] * u1, rx1 = PX[k1] - NX[k1] * d1, ry1 = PY[k1] - NY[k1] * d1;
      this.tri(lx1, ly1, s1, 1, rx1, ry1, s1, -1, rx0, ry0, s0, -1, 1);
      this.tri(lx1, ly1, s1, 1, rx0, ry0, s0, -1, lx0, ly0, s0, 1, 1);
    }
    this.px0 = this.bx0; this.py0 = this.by0; this.px1 = this.bx1; this.py1 = this.by1;
  }

  /** Long membrane fin along the back (side +1) or belly (-1): v attribute = height fraction 0..1. */
  private rasterFin(F: FinSpec, side: number, time: number, part: number) {
    const n = this.n, PX = this.PX, PY = this.PY, NX = this.NX, NY = this.NY, TX = this.TX, TY = this.TY, WW = this.WW, ds = this.ds;
    const total = this.total;
    const k0 = this.sampleAt(F.from), k1 = this.sampleAt(Math.min(1, F.to));
    if (k1 - k0 < 2) return;
    const H = F.h * (this.look.radius / Math.max(1, this.look.radius));
    const FH = this.FH;
    const wl = Math.max(30, total * 0.07);
    let pbx = 0, pby = 0, ptx = 0, pty = 0, ps = 0;
    for (let k = k1; k >= k0; k--) {
      const s = k * ds;
      const u = (k - k0) / (k1 - k0);
      // envelope: quick rise, long plateau, taper into the tail tip
      const env = smoothstep(0, 0.12, u) * (F.to >= 0.99 ? 1 - smoothstep(0.82, 1, u) * 0.92 : 1 - smoothstep(0.75, 1, u));
      const ph = (s / wl) * Math.PI * 2 - time * 3.2 * side;
      const h = H * env * (0.78 + 0.22 * Math.sin(ph));
      FH[k] = h;
      const rake = 0.5 + 0.18 * Math.cos(ph);
      // direction: out of the body, raked toward the tail
      const dx = NX[k] * side * Math.cos(rake) + TX[k] * Math.sin(rake);
      const dy = NY[k] * side * Math.cos(rake) + TY[k] * Math.sin(rake);
      const w = WW[k] * 0.78;
      const bx = PX[k] + NX[k] * w * side, by = PY[k] + NY[k] * w * side;
      const tx = bx + dx * (h + WW[k] * 0.22), ty = by + dy * (h + WW[k] * 0.22);
      if (k < k1) {
        this.tri(pbx, pby, ps, 0, ptx, pty, ps, 1, tx, ty, s, 1, part);
        this.tri(pbx, pby, ps, 0, tx, ty, s, 1, bx, by, s, 0, part);
      }
      pbx = bx; pby = by; ptx = tx; pty = ty; ps = s;
    }
  }

  // ================================================================ shading
  private shade(buf: PixelBuffer, em: PixelBuffer | null, st: SerpentState, time: number, detail: number) {
    const x0 = this.bx0, x1 = this.bx1, y0 = this.by0, y1 = this.by1;
    if (x1 < x0) return;
    const L = this.look;
    const W = this.gw;
    const data = buf.data;
    const edata = em ? em.data : null;
    const gS = this.gS, gV = this.gV, gM = this.gM, R = this.R;
    const NX = this.NX, NY = this.NY, TX = this.TX, TY = this.TY, WW = this.WW, SWK = this.SWK;
    const invDs = 1 / this.ds, nm1 = this.n - 1, total = this.total;
    const roll = this.roll, top = this.topView;
    const flatN = 1 - this.flatK * 0.55;
    const wet = clamp(st.wet ?? L.wet ?? 0);
    const glow = clamp(st.glow ?? 1);
    const mossAmt = L.moss ? clamp(st.mossy ?? L.moss.amount) : 0;
    const coilT = Math.max(6, this.look.radius * 2.6);
    const OVL = this.overlaps(coilT);
    const lureU = L.lure ? 1 - (L.lureLen ?? 0.07) : 2;
    const sheenN = this.nSheen;
    const photo = !!L.photophores;
    const scars = this.scars.length > 0 && detail >= 2;
    const scaleOn = detail >= 1 && this.scaleId !== S_NONE;
    const hideS = this.hl * 0.1; // pattern starts behind the head
    const SL = this.scaleLen, SR = this.scaleRows;
    const latticeOn = scaleOn && (this.scaleId === S_SMOOTH || this.scaleId === S_KEELED || this.scaleId === S_BEAD);
    const WU = this.WU, WD = this.WD, KK = this.KK, SN = this.SN, SZ = this.SZ, SP = this.SP;
    const sec = !top && this.flatK < 0.02;
    const vK = this.vKeel, vR = this.vRidge;
    const mus = detail >= 2 && sec ? this.muscle : 0;
    const mPK = (0.85 / Math.max(5, L.radius * 1.7)) * Math.PI * 2 * SINK;
    const MPH = this.MPH, FNZ = this.FNZ;
    // samples a scar can reach (skips the scar loop everywhere else)
    if (this.SCK.length < this.n) this.SCK = new Uint8Array(this.cap);
    const SCK = this.SCK;
    SCK.fill(0, 0, this.n);
    if (scars) for (let i = 0; i < this.scars.length; i += 5) {
      const a = Math.max(0, Math.floor((this.scars[i] * total - 3) / this.ds)), b = Math.min(this.n - 1, Math.ceil((this.scars[i] * total + this.scars[i + 2] + 3) / this.ds));
      SCK.fill(1, a, b + 1);
    }
    const neckS = this.hh * 1.25;
    const bsc0 = L.bellyScute ?? 0;
    const foldP = Math.max(2.4, Math.min(L.radius * 0.55, this.scaleLen * 1.5));
    const relief = detail >= 1 && sec;
    const PINV = this.PINV;
    let cP = -1e9, cQ = -1e9, cM = 0, cO = 0;
    const perScale = sec && latticeOn && detail >= 1;
    const gloss = this.gloss;
    for (let y = y0; y <= y1; y++) {
      let idx = y * W + x0;
      for (let x = x0; x <= x1; x++, idx++) {
        const part = gM[idx];
        if (part === 0) continue;
        const s = gS[idx];
        let k = (s * invDs + 0.5) | 0;
        if (k > nm1) k = nm1; else if (k < 0) k = 0;
        if (part !== 1) {
          this.shadeFin(data, idx, part, s, gV[idx], k);
          continue;
        }
        let v = gV[idx];
        if (v > 1) v = 1; else if (v < -1) v = -1;
        const vi = ((v + 1) * (LUTN / 2) + 0.5) | 0;
        // lighting: the side view reads the body's cross-section (flat belly, flank, roofed back); top
        // views and the flattening glider keep the rolled round section
        let nN: number, nz: number, phi: number;
        if (sec) { nN = SN[vi]; nz = SZ[vi]; phi = SP[vi]; }
        else {
          nN = v * flatN;
          nz = flatN < 1 ? Math.sqrt(1 - nN * nN) : SQRT1[vi];
          phi = ASIN[vi] + roll;
          if (phi > HALF_PI) phi = Math.PI - phi;
        }
        const nxv = NX[k] * nN, nyv = NY[k] * nN;
        let lum = sec ? nxv * FX + nyv * FY + nz * FZ : nxv * LX + nyv * LY + nz * LZ;
        const u = s / total;
        if (perScale && phi >= this.phiB && s > hideS && u < lureU) {
          // each scale takes the light as one small plate: the shading steps scale by scale, so the
          // highlight along the back is a row of lit scales, not a stripe
          const la = s / SL, lb = ((phi + HALF_PI) * SR) / Math.PI;
          const pcI = Math.floor(la + lb), qcI = Math.floor(la - lb);
          let pj = ((((pcI - qcI) * 0.5) / SR) * LUTN + 0.5) | 0;
          if (pj < 0) pj = 0; else if (pj > LUTN) pj = LUTN;
          const vc = PINV[pj];
          const lc = (NX[k] * FX + NY[k] * FY) * SN[vc] + SZ[vc] * FZ;
          lum = lc * 0.68 + lum * 0.32;
        }
        const w = WW[k];
        const hw = (WU[k] + WD[k]) * 0.5;
        // ---- material + pattern
        if (u >= lureU) {
          _mat = M_LURE;
          const lt = (u - lureU) / (1 - lureU);
          const seg = mod(lt * 3.2 + 0.25, 1);
          _off = seg < 0.16 ? -1.6 : seg < 0.3 ? 0.6 : 0.2;
          if (edata && glow > 0 && seg >= 0.16) {
            const er = R[M_LURE * NR + Math.min(7, 5 + (seg < 0.3 ? 2 : 1))];
            edata[idx] = ((er & 0x00ffffff) | (Math.round(255 * glow) << 24)) >>> 0;
          }
        } else if (u > lureU - 0.14) {
          // the caudal lure: the tail pales and is ringed like a grub toward the glowing bulb
          const m = mod(s, Math.max(2, L.radius * 0.75));
          const t2 = (u - (lureU - 0.14)) / 0.14;
          if (m < 0.9) { _mat = M_PAT; _off = 0.6; } else { _mat = t2 > 0.35 ? M_THROAT : M_BELLY; _off = m < 1.8 ? 0.6 : -0.2; }
        } else if (s < hideS) {
          _mat = phi < this.phiB ? M_THROAT : M_BASE;
          _off = 0;
        } else if (latticeOn && phi >= this.phiB && SL >= 3 && (Math.PI / SR) * w * COSL[((phi + HALF_PI) * COSK + 0.5) | 0] >= 3) {
          // colour patterns are laid down scale by scale: sample the pattern at the centre of this
          // pixel's scale, so band and blotch edges step along the scale rows like a real snake's,
          // and give every scale its own slight tone
          const la = s / SL, lb = ((phi + HALF_PI) * SR) / Math.PI;
          const pcI = Math.floor(la + lb), qcI = Math.floor(la - lb);
          if (pcI === cP && qcI === cQ) { _mat = cM; _off = cO; }
          else {
            // one pattern sample per scale (cached across the scale's pixels in the scanline)
            const pc = pcI + 0.5, qc = qcI + 0.5;
            const sc = ((pc + qc) * 0.5) * SL, phc = ((pc - qc) * 0.5) * Math.PI / SR - HALF_PI;
            this.pattern(sc, phc, sc / total, w, k, x, y, time);
            _off += (hash2(pcI, qcI, this.seed) - 0.5) * 0.6;
            cP = pcI; cQ = qcI; cM = _mat; cO = _off;
          }
        } else {
          this.pattern(s, phi, u, w, k, x, y, time);
          // small bodies: still a faint tone per scale, so the hide never reads as flat
          if (latticeOn && phi >= this.phiB) _off += (hash2(Math.floor(s / SL + ((phi + HALF_PI) * SR) / Math.PI), Math.floor(s / SL - ((phi + HALF_PI) * SR) / Math.PI), this.seed) - 0.5) * 0.45;
        }
        // moss over the back
        if (mossAmt > 0 && phi > 0.05 && _mat !== M_BELLY) {
          const nm = noise2(s * 0.16, phi * 2.6, this.seed) * 0.75 + noise2(s * 0.45, phi * 7, this.seed + 7) * 0.25;
          const cover = nm + (phi - 0.55) * 0.55;
          if (cover > 1 - mossAmt * 0.95) {
            _mat = M_MOSS;
            const h = hash2(x >> 1, y, this.seed);
            _off = (h > 0.7 ? 1.2 : h < 0.25 ? -1.1 : 0) + (cover > 1.05 - mossAmt * 0.6 ? 0.6 : -0.3);
          }
        }
        // ---- anatomy relief: folds on the inside of a bend, stretched skin on the outside, the
        // ventrolateral angle, the vertebral ridge, oblique muscle blocks, the shadow under the jaw
        let rel = 0;
        _str = 0;
        if (relief && hw >= 2.2 && u < lureU) {
          const kc = KK[k] * hw * (v > 0 ? 1 : -1);
          const av0 = v < 0 ? -v : v;
          if (kc > 0.07 && s > neckS) {
            const e0 = av0 < 0.15 ? 0 : av0 > 0.75 ? 1 : (av0 - 0.15) / 0.6;
            const amt = Math.min(1, (kc - 0.07) * 6) * e0 * e0 * (3 - 2 * e0);
            const m = mod(s + FNZ[k] * foldP * 0.9 + v * hw * 0.35, foldP);
            if (m < 0.9) rel -= 1.5 * amt; else if (m < 1.9) rel += 0.55 * amt;
          } else if (kc < -0.07) _str = Math.min(1, (-kc - 0.07) * 4) * (av0 < 0.1 ? 0 : av0 > 0.7 ? 1 : (av0 - 0.1) / 0.6);
          const dk = (v - vK) * hw;
          if (hw >= 2.6 && dk > -0.55 && dk < 0.45 && s > neckS * 0.6) rel -= bsc0 > 0 && mod(s, bsc0) < 0.9 ? 1.3 : 0.6;
          else if (hw >= 3.5 && dk >= 0.45 && dk < 1.45) rel += 0.3;
          const dr = (v - vR) * hw;
          if (hw >= 2.6 && dr > -0.5 && dr < 0.5 && s > neckS * 0.5 && mod(s, SL) < SL * 0.6) rel += 0.85;
          if (mus > 0 && av0 < 0.8 && u > 0.04 && u < 0.88) {
            const mm = SINL[((MPH[k] - v * hw * mPK) | 0) & (SINN - 1)];
            rel += mm * 0.55 * mus * (1 - av0 * av0);
          }
          if (s < neckS && v < 0.35) rel -= (1 - s / neckS) * 1.4 * (0.35 - v);
        }
        // ---- scales
        _v = v; _hw = hw;
        let sc = 0;
        if (scaleOn && _mat !== M_MOSS && _mat !== M_LURE) sc = this.scaleTex(s, phi, w, k, SWK[k], detail, x, y);
        // ---- scars
        if (scars && SCK[k] && _mat !== M_BELLY) {
          const S = this.scars;
          for (let i = 0; i < S.length; i += 5) {
            const su = S[i] * total, len = S[i + 2];
            const ds0 = s - su;
            if (ds0 < -2 || ds0 > len + 2) continue;
            const py = (phi - S[i + 1]) * w; // px across
            const lines = S[i + 4];
            for (let q = 0; q < lines; q++) {
              const off = (q - (lines - 1) / 2) * 2.2;
              const d = py - (ds0 * S[i + 3] * 0.6 + off);
              if (ds0 >= 0 && ds0 <= len) {
                if (d > -0.55 && d < 0.55) { _mat = M_SCAR; _off = 0.6; sc = 0; }
                else if (d >= 0.55 && d < 1.4) { _off -= 1.2; }
              }
            }
          }
        }
        // ---- photophores (lateral line + belly row)
        if (photo && u > 0.09 && u < 0.96) {
          const R0 = Math.max(0.9, L.radius * 0.07);
          const sp1 = Math.max(10, L.radius * 0.62);
          const a1 = mod(s, sp1) - sp1 * 0.5, b1 = (phi + 0.1) * w;
          const sp2 = sp1 * 1.45;
          const a2 = mod(s + sp1 * 0.4, sp2) - sp2 * 0.5, b2 = (phi + 0.72) * w * 0.85;
          const d1 = a1 * a1 + b1 * b1, d2 = a2 * a2 + b2 * b2;
          const rr = R0 * R0;
          if (d1 < rr * 2.4 || d2 < rr * 2) {
            const core = d1 < rr || d2 < rr * 0.8;
            _mat = M_PHOTO;
            _off = core ? 2.4 : 0.4;
            sc = 0;
            if (edata && glow > 0) {
              const pulse = 0.55 + 0.45 * Math.sin(s * 0.035 - time * 2.2);
              const a = Math.round(255 * glow * (core ? 1 : 0.5) * pulse);
              if (a > 8) edata[idx] = ((R[M_PHOTO * NR + (core ? 7 : 5)] & 0x00ffffff) | (a << 24)) >>> 0;
            }
          }
        }
        // ---- light -> level
        let lvl = (0.5 + 0.5 * lum) * 7 - 1 + _off + sc + rel;
        if (_mat === M_BELLY || _mat === M_THROAT) lvl = sec ? lvl * 0.72 + 1.45 + _off * 0.45 : lvl * 0.55 + 2.6 + _off * 0.45;
        // rim light: underside / back edge facing away from the key light
        const av = v < 0 ? -v : v;
        if (av > 0.8) {
          const side = (v > 0 ? 1 : -1) * (NX[k] * L2X + NY[k] * L2Y);
          if (side < -0.25) lvl += (av - 0.8) * 9 * Math.min(1, -side);
        }
        // wet specular streak; smooth scales carry a glossy sheen band along the upper flank
        if (wet > 0) {
          const spec = nxv * HX + nyv * HY + nz * HZ;
          if (spec > 0.985 - wet * 0.03) lvl += 1.2 + wet * 1.3;
        }
        if (gloss > 0 && sec && _mat !== M_MOSS) {
          const sp2 = nxv * GX + nyv * GY + nz * GZ;
          if (sp2 > 0.975) lvl += gloss * 1.3; else if (sp2 > 0.94) lvl += gloss * 0.55;
        }
        // iridescent sheen replaces the base ramp
        let mat = _mat;
        if (sheenN && mat === M_BASE) {
          const hsh = clamp((0.5 + 0.5 * lum) * 1.15 - 0.25 + 0.3 * Math.sin(s * 0.09 - time * 1.4 + phi * 1.5), 0, 0.999);
          mat = M_SHEEN + ((hsh * sheenN) | 0);
        }
        let li = (lvl + 0.5) | 0;
        if (lvl < 0) li = 0; else if (li > 7) li = 7;
        let c = R[mat * NR + li];
        // coil contact line: a body part lying on top of this one (smaller s = nearer the head)
        if (s > coilT && OVL[k]) {
          const lim = s - coilT;
          if ((y > 0 && gM[idx - W] === 1 && gS[idx - W] < lim) || (x > 0 && gM[idx - 1] === 1 && gS[idx - 1] < lim) ||
            (x < W - 1 && gM[idx + 1] === 1 && gS[idx + 1] < lim) || (y < this.gh - 1 && gM[idx + W] === 1 && gS[idx + W] < lim)) c = tint(c, 0.72);
        }
        data[idx] = c;
      }
    }
    void TX; void TY;
  }

  private shadeFin(data: Uint32Array, idx: number, part: number, s: number, h: number, k: number) {
    const F = part === 2 ? this.look.dorsalFin! : this.look.ventralFin!;
    const mat = part === 2 ? M_FIN : M_FIN2;
    const R = this.R;
    const hpx = Math.max(1, this.FH[k] + this.WW[k] * 0.22);
    const sp = F.rays ?? 4;
    const rp = mod(s, sp);
    const hh = h < 0 ? 0 : h > 1 ? 1 : h;
    let c: C;
    if (hh > 1 - 1.1 / hpx) c = R[mat * NR + 6];
    else if (rp < 1) c = R[mat * NR + (hh > 0.7 ? 4 : 2)];
    else {
      const lv = 2.2 + hh * 3.2 + (rp < 1.8 ? -0.6 : 0);
      c = R[mat * NR + Math.min(7, Math.max(0, Math.round(lv)))];
      data[idx] = over(data[idx], c, 200);
      return;
    }
    data[idx] = c;
  }

  // ---------------------------------------------------------------- body patterns
  /** sets _mat / _off for body coordinates (s px, phi -pi/2 belly .. +pi/2 back) */
  private pattern(s: number, phi: number, u: number, w: number, k: number, x: number, y: number, time: number) {
    const L = this.look;
    const P = this.period;
    _mat = M_BASE;
    _off = 0;
    const q = phi * INV_HALF_PI;
    const seed = this.seed;
    // belly band with a scute-scalloped edge
    const bsc = L.bellyScute ?? 0;
    let pb = this.phiB;
    if (bsc > 0) pb += (mod(s, bsc) / bsc - 0.5) * 0.08;
    const isBelly = !this.topView && phi < pb;
    switch (this.patId) {
      case P_BANDS: {
        if (isBelly) { _mat = M_BELLY; return; }
        const wob = (noise1(s * 0.31, seed) - 0.5) * 2.4;
        const m = mod(s + wob - q * P * 0.1, P);
        const d = Math.abs(m - P * 0.5);
        const bw = P * (0.16 + 0.13 * (q + 1) * 0.5);
        if (d < bw) { _mat = M_PAT; if (d > bw - 1) _off = -0.6; }
        else if (d < bw + 1.1) _off = 0.7;
        return;
      }
      case P_RINGS: {
        const m = mod(s, P);
        if (m < P * 0.32) {
          _mat = M_PAT;
          if (isBelly) _off = -0.6;
          if (m < 1 && L.patternCol2) _mat = M_PAT2;
          return;
        }
        if (L.patternCol2 && m < P * 0.32 + 1) { _mat = M_PAT2; return; }
        if (isBelly) _mat = M_BELLY;
        return;
      }
      case P_DIAMONDS: {
        if (isBelly) { _mat = M_BELLY; return; }
        const m = mod(s, P);
        const d = Math.abs(m - P / 2) / (P / 2) + Math.abs(q - 0.55) * 1.3;
        if (d < 0.5) _mat = M_PAT;
        else if (d < 0.68 && L.patternCol2) _mat = M_PAT2;
        else if (q < 0.05 && Math.abs(mod(s + P * 0.5, P) - P / 2) < P * 0.14 && q > -0.3) _mat = M_PAT;
        return;
      }
      case P_STRIPE: {
        if (isBelly) { _mat = M_BELLY; return; }
        if (Math.abs(q - 0.1) < 0.18) _mat = M_PAT;
        else if (q > 0.75 && L.patternCol2) _mat = M_PAT2;
        return;
      }
      case P_BLOTCH: {
        if (isBelly) { _mat = M_BELLY; return; }
        const cell = Math.floor(s / P);
        const m = s - cell * P;
        const off = hash2(cell, 3, seed);
        const da = (m - P * (0.3 + off * 0.4)) / (P * 0.32), db = (q - 0.45) / 0.55;
        const d = Math.sqrt(da * da + db * db);
        if (d < 0.75) _mat = M_PAT; else if (d < 1 && L.patternCol2) _mat = M_PAT2;
        return;
      }
      case P_SPECKLE: {
        if (isBelly) { _mat = M_BELLY; return; }
        if (hash2(Math.floor(s / 2), Math.floor((phi + 2) * w / 2), seed) > 0.9) _mat = M_PAT;
        return;
      }
      case P_SADDLES: {
        // huge dorsal saddles, lateral ocelli with pale centres between them (titan)
        if (isBelly) {
          _mat = M_BELLY;
          // dark spots along the belly edge
          const m2 = mod(s + P * 0.25, P * 0.5) - P * 0.25;
          const e = (phi - pb) * w;
          if (e > -2.2 && m2 * m2 + e * e * 1.4 < P * P * 0.004 + 2.5) { _mat = M_PAT; _off = 0.4; }
          return;
        }
        const cell = Math.floor(s / P);
        const m = s - cell * P;
        const j = (hash2(cell, 1, seed) - 0.5) * P * 0.24;
        const sz = 0.82 + hash2(cell, 2, seed) * 0.34;
        const dm = (m - P * 0.5 - j) / (P * 0.3 * sz);
        const dq = (1 - q) / (0.62 * sz);
        const dd = dm * dm + dq * dq + (noise2(s * 0.2, q * 3, seed) - 0.5) * 0.35;
        if (dd < 1) { _mat = M_PAT; if (dd > 0.72) _off = -0.7; return; }
        // lateral ocelli between saddles
        const mo = mod(s + P * 0.5 + j * 0.5, P) - P * 0.5;
        const qo = q + 0.2;
        const od = (mo * mo) / (P * P * 0.017 * sz) + (qo * qo) / 0.045;
        if (od < 1) { _mat = od > 0.42 ? M_PAT : M_PAT2; if (od > 0.42) _off = 0.3; return; }
        if (dd < 1.3) _off = 0.45; // pale halo round the saddle
        return;
      }
      case P_MOTTLE: {
        if (isBelly) {
          _mat = M_BELLY;
          if (hash2(Math.floor(s / 2), Math.floor(phi * w / 2), seed) > 0.8) _off = -1.2;
          return;
        }
        const nm = noise2(s * 0.21, phi * w * 0.21, seed);
        const nm2 = noise2(s * 0.5, phi * w * 0.5, seed + 3);
        const v = nm * 0.72 + nm2 * 0.28;
        if (v < 0.36) { _mat = M_PAT; _off = v < 0.28 ? -0.5 : 0; }
        else if (v > 0.66 && nm2 > 0.62) { _mat = M_PAT2; _off = -0.2; }
        else if (q > 0.72 && mod(s, P) < P * 0.3) { _mat = M_PAT; }
        return;
      }
      case P_BARK: {
        // gecko: bark streaks, dark forward-pointing chevrons, pale lichen flecks
        if (isBelly) { _mat = M_BELLY; return; }
        const st = noise2(s * 0.12, phi * 5.5, seed);
        if (st < 0.3) _off = -0.6; else if (st > 0.72) _off = 0.5;
        // the tail ringed dark and pale
        if (u > this.tailU + 0.06) {
          const mt = mod(s, P * 0.9);
          if (mt < P * 0.32) { _mat = M_PAT; _off = 0.3; } else if (mt < P * 0.32 + 1) _off += 0.9;
          return;
        }
        // forward-pointing dark chevrons, pale-edged behind; a dark streak back from the eye
        const m = mod(s + (1 - q) * P * 0.45, P);
        if (q > 0.0 && m < 1.3) { _mat = M_PAT; _off = 0.2; }
        else if (q > 0.0 && m < 2.2) _off += 0.9;
        else if (q < -0.05 && q > -0.45 && u < 0.3) { _mat = M_PAT; _off = 0.5; }
        // lichen: small pale-green clusters
        const ci = Math.floor(s / 2), cj = Math.floor(phi * w / 2);
        if (hash2(ci, cj, seed + 5) > 0.88 && q > -0.3) { _mat = M_PAT2; _off = hash2(ci, cj, seed + 6) > 0.5 ? 0.4 : -0.3; }
        return;
      }
      case P_COUNTER: {
        // countershading with a dappled boundary, pale spots on the dark back (leviathan)
        const nb = noise1(s * 0.045, seed) * 0.22 + noise2(s * 0.14, q * 3, seed + 2) * 0.24;
        const qc = -0.28 + nb;
        if (q < qc) { _mat = M_BELLY; return; }
        if (q < qc + 0.1 && hash2(Math.floor(s / 2), Math.floor(q * 20), seed) > 0.4) { _mat = M_PAT2; _off = -0.4; return; }
        if (q > 0.2 && hash2(Math.floor(s / 3), Math.floor(q * w / 3), seed + 9) > 0.965) { _mat = M_PAT2; _off = 0.4; return; }
        if (q > 0.62) _off = -0.6;
        return;
      }
      case P_ZIGZAG: {
        // crag viper: rust zigzag with dark borders on granite grey, dark lateral spots
        if (isBelly) { _mat = M_BELLY; return; }
        const tri = Math.abs((mod(s, P) / P) * 2 - 1);
        const qz = 0.58 + (tri - 0.5) * 0.62;
        const d = Math.abs(q - qz);
        if (d < 0.17) { _mat = M_PAT2; if (d > 0.11) { _mat = M_PAT; _off = -0.3; } return; }
        const m = mod(s + P * 0.5, P) - P * 0.5;
        const e = (q + 0.05) * w;
        if (m * m + e * e < P * P * 0.02) { _mat = M_PAT; _off = 0.3; }
        return;
      }
      case P_FLANK: {
        // sprint viper: black back, red flanks with a jagged upper edge and black spots
        if (isBelly) { _mat = M_BELLY; return; }
        const tri = Math.abs((mod(s, P) / P) * 2 - 1);
        const edge = 0.3 + (tri - 0.5) * 0.34 + (noise1(s * 0.4, seed) - 0.5) * 0.08;
        if (q < edge) {
          _mat = M_PAT2;
          const m = mod(s + P * 0.5, P) - P * 0.5;
          const e = (q + 0.12) * w;
          if (m * m * 0.8 + e * e < 2.2 + w * 0.3) { _mat = M_PAT; }
          if (q > edge - 0.07) _off = -0.6;
        } else if (q < edge + 0.06) _off = 0.5;
        return;
      }
      case P_RIBBON: {
        // skyribbon: thin dark crossbars edged in pale yellow over the sheen
        const m = mod(s + Math.abs(q - 0.6) * P * 0.25, P);
        if (isBelly) { _mat = M_BELLY; if (m < 1) _off = -1; return; }
        if (m < 1.2) { _mat = M_PAT; return; }
        if (m < 2.1 && L.patternCol2) { _mat = M_PAT2; return; }
        if (q < 0.2 && q > -0.2 && L.patternCol2 && mod(s + P * 0.5, P) < 1.4) { _mat = M_PAT2; _off = -0.4; }
        return;
      }
      case P_CROC: {
        // crocodilian: bold dark crossbands on the tail, broken ones over the back, the flanks mottled
        // dark with paler scales between, a cream belly
        if (isBelly) { _mat = M_BELLY; return; }
        const tk = smoothstep(this.tailU - 0.06, this.tailU + 0.04, u);
        const cell = Math.floor(s / P);
        const m = mod(s + (noise1(s * 0.2, seed) - 0.5) * 3.2 - q * P * 0.18, P);
        if (tk > 0.5 ? m < P * 0.34 && q > -0.6 : m < P * 0.16 && q > 0.25 && hash2(cell, 1, seed) > 0.45) { _mat = M_PAT; if (m < 1) _off = -0.5; return; }
        const nm = noise2(s * 0.17, q * 3, seed);
        // the lower flank pales toward the belly, blotched dark
        if (q < 0.12 && L.flank) {
          const nb = noise2(s * 0.33, q * 5, seed + 4);
          if (nm < 0.3 || (nb < 0.22 && q > -0.4)) { _mat = M_PAT; _off = 0.9; }
          else { _mat = M_FLANK; _off = q > 0 ? -0.5 : 0; }
          return;
        }
        if (q < 0.3 && nm < 0.28) { _mat = M_PAT; _off = 0.5; }
        else if (nm > 0.7) _off = 0.45;
        return;
      }
      case P_SKIN: {
        // amphibian: darker back, pale spots and a scatter of pores; costal grooves ring the flank
        // between the legs
        if (isBelly) { _mat = M_BELLY; return; }
        if (u > this.cg0 && u < this.cg1 && q < 0.55) {
          const gp = Math.max(1.8, L.radius * 0.6);
          const m = mod(s, gp);
          if (m < 0.75) { _off = -1.3; return; }
          if (m < 1.5 && q > -0.2) _off = 0.5;
        }
        const cs = 3.2;
        const ci = Math.floor(s / cs), cj = Math.floor((phi + 2) * w / cs);
        const h = hash2(ci, cj, seed);
        if (h > 0.8) {
          const fx = s / cs - ci - 0.5, fy = (phi + 2) * w / cs - cj - 0.5;
          if (fx * fx + fy * fy < 0.12) { _mat = M_PAT2; return; }
        }
        if (q > 0.55) _off = -0.45;
        const nb = noise2(s * 0.18, q * 3, seed + 1);
        if (nb < 0.25 && q > 0) _mat = M_PAT;
        return;
      }
      default:
        if (isBelly) _mat = M_BELLY;
    }
    void k; void x; void y; void time;
  }

  // ---------------------------------------------------------------- scale texture
  /** returns a light-level offset for the scale / scute / armour texture at this body pixel */
  private scaleTex(s: number, phi: number, w: number, k: number, swk: number, detail: number, x: number, y: number): number {
    const L = this.look;
    const isBelly = !this.topView && phi < this.phiB;
    if (isBelly) {
      if (this.scaleId === S_OSTEO) {
        // a crocodile's belly: the square scales of the leather, in neat rows
        const g = Math.max(2, (L.osteoderms?.len ?? 5) * 0.5);
        const ga = mod(s, g), gb = mod((_v + 1) * _hw, g * 0.9);
        return ga < 0.8 || gb < 0.7 ? -1.1 : gb > g * 0.55 ? 0.3 : 0;
      }
      const sc = L.bellyScute ?? 0;
      if (sc <= 0) return 0;
      const m = mod(s, sc);
      const edgeW = sc > 3.5 ? 1 : 0.8;
      let o = 0;
      if (m < edgeW) o = -1.6;
      else if (m < edgeW + 1 && sc > 2.5) o = 0.7;
      if (L.keeledBelly && (phi - this.phiB) * w > -1.2 && m > edgeW) o += 0.9;
      if (swk > 0.2 && m < edgeW + swk * sc * 0.4) { _mat = M_SKIN; o = 0; }
      return o;
    }
    const id = this.scaleId;
    if (id === S_SKIN) return 0;
    const ci = ((phi + HALF_PI) * COSK + 0.5) | 0;
    const cosPhi = COSL[ci < 0 ? 0 : ci > COSN ? COSN : ci];
    if (id === S_OSTEO) {
      // crocodilian armour, laid out by height up the side (_v): square ventral scales below, then the
      // flank's oval scales set in wrinkled skin, then transverse rows of keeled osteoderms over the
      // back; the tail is ringed in rectangular scales
      const O = L.osteoderms;
      const len = O?.len ?? 5;
      const v = _v, hw = _hw;
      const tail = s > this.total * this.tailU;
      const yPx = (v + 1) * hw; // px up from the belly edge
      if (tail) {
        const a = s / (len * 0.8);
        const fa = (a - Math.floor(a)) * len * 0.8;
        const rowH = Math.max(2, hw * 0.42);
        const fb = yPx - Math.floor(yPx / rowH) * rowH;
        if (fa < 0.9) return -1.5;
        if (fb < 0.8) return -1;
        if (fb > rowH - 1 && fa > len * 0.3) return 0.7;
        return fa > len * 0.55 ? -0.3 : 0.2;
      }
      if (v > 0.2) {
        const rows = O?.rows ?? 5;
        const rowH = Math.max(1.8, (hw * 0.8 * 2) / rows * 0.9);
        const yb = (1 - v) * hw;
        const row = Math.floor(yb / rowH);
        const fb = yb - row * rowH;
        const a = s / len + (hash2(row, Math.floor(s / len), this.seed) - 0.5) * 0.08;
        const fa = (a - Math.floor(a)) * len;
        if (fa < 0.9 || fb < 0.85) return -1.7;
        // the keel down each plate's middle: lit crest, a shadow line under it
        if (detail >= 2 && fa > len * 0.25 && fa < len * 0.85) {
          const kc = rowH * 0.45;
          if (Math.abs(fb - kc) < 0.5) return 1.2;
          if (fb > kc + 0.5 && fb < kc + 1.4) return -0.6;
        }
        return fb < rowH * 0.4 ? 0.35 : -0.2;
      }
      if (v > -0.5) {
        // flank: oval scales in skin
        const a = s / (len * 0.55), b = yPx / 2.1;
        const rb = Math.floor(b);
        const fa = a + (rb & 1) * 0.5 - Math.floor(a + (rb & 1) * 0.5), fb = b - rb;
        const ex = fa - 0.5, ey = fb - 0.5;
        const d = ex * ex * 1.4 + ey * ey;
        if (d > 0.2) return -1.1;
        return ey < -0.05 ? 0.5 : 0;
      }
      return 0;
    }
    // diamond lattice in (s, phi)
    const SL = this.scaleLen, SR = this.scaleRows;
    const a = s / SL, b = ((phi + HALF_PI) * SR) / Math.PI;
    const p = a + b, qq = a - b;
    const fp = p - Math.floor(p), fq = qq - Math.floor(qq);
    const rowPx = (Math.PI / SR) * w * cosPhi; // on-screen scale height
    const small = rowPx < 2.2 || SL < 2.6;
    if (id === S_BEAD || small) {
      // readable granular texture for small bodies: one light bead + one dark notch per scale (on a tiny
      // lizard only along the back, where the light rakes across it)
      if (L.radius < 3 && phi < 0.45) return 0;
      const cx = fp - 0.5, cy = fq - 0.5;
      if (fp < 0.2 && fq < 0.2) return -1.1;
      if (id === S_KEELED && Math.abs(cx - cy) < 0.18) return 0.9;
      if (cx * cx + cy * cy < 0.035 && detail >= 2) {
        const lit = (cx + cy) * this.tlS(k) + (cx - cy) * this.nlS(k);
        return lit > 0 ? 0.9 : 0.35;
      }
      return 0;
    }
    // individual scales: dark gap line, lit dome side, shadowed far side; where the skin is stretched
    // (the swallowed meal, the outside of a bend) the scales part and the skin between them shows
    const gap = 0.1 + swk * 0.22 + _str * 0.14;
    if (fp < gap || fq < gap) {
      if (swk > 0.25 || _str > 0.45) { _mat = M_SKIN; return swk > 0.25 ? 0.2 : -0.4; }
      return -1.7;
    }
    const da = (fp + fq) * 0.5 - 0.5 - gap * 0.5; // along the body (lattice units)
    const db = (fp - fq) * 0.5;                    // across
    let lit = da * SL * this.tlS(k) + db * rowPx * this.nlS(k);
    lit /= Math.max(SL, rowPx) * 0.5;
    let o = lit > 0.28 ? 0.9 : lit < -0.3 ? -0.65 : 0;
    if (id === S_KEELED) {
      const kd = Math.abs(db);
      if (kd < 0.09) o = 1.2;
      else if (kd < 0.18 && db < 0) o = -0.9;
    }
    if (detail >= 2 && fp > 0.84 && fq > 0.84) o -= 0.5; // posterior tip overlap shadow
    void x; void y;
    return o;
  }
  private tlS(k: number) { return -(this.TX[k] * L2X + this.TY[k] * L2Y); }
  private nlS(k: number) { return this.NX[k] * L2X + this.NY[k] * L2Y; }

  // ================================================================ limbs
  private poseLegs(st: SerpentState, ox: number, oy: number, time: number, gait: number, flat: number) {
    const L = this.look;
    const specs = L.legs!;
    const f = this.fEff;
    const top = this.topView;
    const glide = top && !!L.glideTop && flat > 0.5;
    const dig = clamp(st.dig ?? 0);
    const lunge = clamp(st.lunge ?? 0);
    for (let li = 0; li < specs.length; li++) {
      const sp = specs[li];
      const k = this.sampleAt(sp.at);
      const px = this.PX[k], py = this.PY[k], nx = this.NX[k], ny = this.NY[k], tx = this.TX[k], ty = this.TY[k], w = this.WW[k];
      const front = sp.kind ? sp.kind === 'front' : sp.at < 0.45;
      const len = sp.len;
      const S = sp.stride ?? len * (sp.digitigrade ? 1.25 : 0.95);
      const duty = sp.digitigrade ? 0.46 : 0.62;
      const m = (duty * 2 * Math.PI) / (0.22 * Math.max(1, S));
      const thick = sp.thick ?? 0.42;
      const r0 = Math.max(0.7, w * thick);
      for (let side = 0; side < 2; side++) {
        const P = this.poses[li * 2 + side];
        P.spec = sp;
        P.front = front;
        P.drawn = true;
        P.top = top;
        const far = side === 1;
        P.far = far;
        P.side = far ? -1 : 1;
        P.r0 = r0; P.r1 = Math.max(0.6, r0 * 0.62); P.r2 = Math.max(0.55, r0 * 0.46); P.r3 = Math.max(0.5, r0 * 0.36);
        // gait phase: lateral-sequence walk for quadrupeds, alternating for bipeds
        const offC = sp.digitigrade ? (far ? 0.5 : 0) : (front ? 0.25 : 0) + (far ? 0.5 : 0);
        let c = (st.legPhase * m) / (2 * Math.PI) + offC;
        c -= Math.floor(c);
        let along: number, lift: number;
        if (c < duty) { along = S * (0.5 - c / duty); lift = 0; }
        else { const a = (c - duty) / (1 - duty); along = S * (-0.5 + a * a * (3 - 2 * a)); lift = Math.sin(a * Math.PI); }
        if (top) {
          // ---- seen from above: legs splay out of both flanks
          const sgn = far ? -1 : 1;
          const latx = nx * sgn, laty = ny * sgn;
          const fwx = -tx, fwy = -ty;
          const hx = px + latx * w * 0.62, hy = py + laty * w * 0.62;
          let tgx: number, tgy: number;
          if (glide) {
            const ext = len * 0.96;
            const fw = front ? 0.34 : -0.3;
            tgx = hx + latx * ext * 0.94 + fwx * ext * fw;
            tgy = hy + laty * ext * 0.94 + fwy * ext * fw;
            lift = 0;
          } else {
            const a2 = (along - (front ? 0 : 0)) * gait;
            const fw = (front ? 0.52 : -0.42) * len + a2 * 0.7;
            tgx = hx + latx * len * 0.66 + fwx * fw;
            tgy = hy + laty * len * 0.66 + fwy * fw;
            lift *= gait;
          }
          P.hx = hx; P.hy = hy;
          P.lift = lift;
          this.ikTop(P, tgx, tgy, latx, laty, fwx, fwy, len, glide);
          continue;
        }
        // ---- side view
        const hd = 0.28 + (sp.sprawl ?? 0) * (far ? 0 : 0.16);
        const hx = px - nx * w * hd + (far ? nx * 0.8 : 0);
        const hy = py - ny * w * hd + (far ? ny * 0.8 : 0);
        P.hx = hx; P.hy = hy;
        const rest = (front ? 0.14 : -0.1) * len + (far ? 0.16 * len : 0);
        const ax2 = rest * (1 - gait) + (along + rest * 0.4) * gait;
        lift *= gait;
        let fx: number, fy: number;
        if (!st.grounded) {
          // tucked along the flanks, toes trailing (swimming, climbing, gliding)
          fx = hx + tx * len * 0.72 - nx * len * 0.3;
          fy = hy + ty * len * 0.72 - ny * len * 0.3;
          lift = 0.3;
        } else {
          fx = hx + f * ax2;
          const gy = st.groundY(fx + ox) - oy;
          fy = Math.min(gy, hy + len * 1.02);
          if (gy - hy < len * 0.2) fy = hy + len * 0.2;
          fy -= lift * len * (sp.digitigrade ? 0.42 : 0.3);
          if (dig > 0 && front) {
            const ph = time * 13 + (far ? Math.PI : 0);
            const dx2 = hx + f * (len * 0.62 + Math.cos(ph) * len * 0.22);
            const dy2 = Math.min(gy, hy + len * 0.95) - Math.max(0, Math.sin(ph)) * len * 0.35;
            fx = fx + (dx2 - fx) * dig;
            fy = fy + (dy2 - fy) * dig;
            lift = Math.max(lift, dig * Math.max(0, Math.sin(ph)));
          }
          if (lunge > 0) {
            const bx = hx - f * len * 0.55 * (front ? 0.6 : 1), by = Math.min(gy, hy + len * 0.75);
            fx += (bx - fx) * lunge;
            fy += (by - fy) * lunge;
          }
        }
        P.lift = lift;
        this.ikSide(P, fx, fy, f, len, sp);
      }
    }
  }

  /** side-view IK: foot/toe contact at (fx, fy) */
  private ikSide(P: LegPose, fx: number, fy: number, f: number, len: number, sp: LegSpec) {
    let l1: number, l2: number, ax: number, ay: number;
    if (sp.digitigrade) {
      l1 = len * 0.38; l2 = len * 0.4;
      const l3 = len * 0.3;
      const g = 0.95 + P.lift * 0.85; // metatarsus angle from horizontal
      ax = fx - f * Math.cos(g) * l3;
      ay = fy - Math.sin(g) * l3;
      P.dx = f * Math.cos(P.lift * 0.9); P.dy = Math.sin(P.lift * 0.9);
    } else {
      const spw = sp.sprawl ?? 0;
      l1 = len * (0.47 - 0.17 * spw); l2 = len * (0.43 + 0.03 * spw);
      const foot = len * (0.2 + 0.06 * spw);
      const g = P.lift * 0.8 + 0.12;
      ax = fx - f * Math.cos(g) * foot;
      ay = fy - Math.sin(g) * foot;
      P.dx = f * Math.cos(P.lift * 0.7); P.dy = Math.sin(P.lift * 0.7);
    }
    // a sprawler folds its limb out toward the viewer rather than in the picture plane: the projected
    // bones shorten, the knee stays near the flank and the upper limb reads as a foreshortened mass
    P.fore = 0;
    const spw = sp.sprawl ?? 0;
    if (spw > 0) {
      const d0 = Math.hypot(ax - P.hx, ay - P.hy);
      const k = clamp(d0 / ((l1 + l2) * 0.86), 0.72, 1);
      const kk = 1 - (1 - k) * spw;
      l1 *= kk; l2 *= kk;
      P.fore = 1 - kk;
    }
    // two-bone IK hip -> ankle
    let dx = ax - P.hx, dy = ay - P.hy;
    let d = Math.hypot(dx, dy) || 1e-3;
    const dmax = (l1 + l2) * 0.995;
    if (d > dmax) {
      ax = P.hx + (dx / d) * dmax; ay = P.hy + (dy / d) * dmax;
      fx = ax + (fx - ax); fy = ay + (fy - ay);
      dx = ax - P.hx; dy = ay - P.hy; d = dmax;
    }
    const dmin = Math.abs(l1 - l2) + 0.05;
    if (d < dmin) d = dmin;
    const a = Math.atan2(dy, dx);
    const cb = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const b = Math.acos(cb);
    const k1x = P.hx + Math.cos(a + b) * l1, k1y = P.hy + Math.sin(a + b) * l1;
    const k2x = P.hx + Math.cos(a - b) * l1, k2y = P.hy + Math.sin(a - b) * l1;
    // elbows point back (front legs), knees forward (hind legs, runners)
    const want = P.front && !sp.digitigrade ? -f : f;
    const mx = (P.hx + ax) * 0.5;
    const pick1 = (k1x - mx) * want >= (k2x - mx) * want;
    P.kx = pick1 ? k1x : k2x; P.ky = pick1 ? k1y : k2y;
    P.ax = ax; P.ay = ay;
    P.fx = fx; P.fy = fy;
  }

  /** top-view IK: joints bulge away from the body */
  private ikTop(P: LegPose, tx: number, ty: number, latx: number, laty: number, fwx: number, fwy: number, len: number, glide: boolean) {
    const l1 = len * 0.45, l2 = len * 0.42, foot = len * 0.16;
    // foot direction: outward and forward (front) / backward (hind)
    const fw = P.front ? 0.75 : -0.75;
    let ddx = latx * 0.7 + fwx * fw, ddy = laty * 0.7 + fwy * fw;
    if (glide) { ddx = latx + fwx * fw * 0.25; ddy = laty + fwy * fw * 0.25; }
    const dl = Math.hypot(ddx, ddy) || 1;
    ddx /= dl; ddy /= dl;
    let ax = tx - ddx * foot, ay = ty - ddy * foot;
    let dx = ax - P.hx, dy = ay - P.hy;
    let d = Math.hypot(dx, dy) || 1e-3;
    const dmax = (l1 + l2) * 0.995;
    if (d > dmax) { ax = P.hx + (dx / d) * dmax; ay = P.hy + (dy / d) * dmax; dx = ax - P.hx; dy = ay - P.hy; d = dmax; }
    const a = Math.atan2(dy, dx);
    const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const k1x = P.hx + Math.cos(a + b) * l1, k1y = P.hy + Math.sin(a + b) * l1;
    const k2x = P.hx + Math.cos(a - b) * l1, k2y = P.hy + Math.sin(a - b) * l1;
    // joint away from the body axis, and backward for front legs (elbow) / forward for hind (knee)
    const sc1 = (k1x - P.hx) * latx + (k1y - P.hy) * laty + ((k1x - P.hx) * fwx + (k1y - P.hy) * fwy) * (P.front ? -0.6 : 0.6);
    const sc2 = (k2x - P.hx) * latx + (k2y - P.hy) * laty + ((k2x - P.hx) * fwx + (k2y - P.hy) * fwy) * (P.front ? -0.6 : 0.6);
    if (sc1 >= sc2) { P.kx = k1x; P.ky = k1y; } else { P.kx = k2x; P.ky = k2y; }
    P.ax = ax; P.ay = ay;
    P.fx = ax + ddx * foot; P.fy = ay + ddy * foot;
    P.dx = ddx; P.dy = ddy;
  }

  private drawLegs(buf: PixelBuffer, far: boolean, all: boolean) {
    for (const P of this.poses) {
      if (!P.drawn) continue;
      if (!all && P.far !== far) continue;
      this.drawLeg(buf, P);
    }
  }

  private drawLeg(buf: PixelBuffer, P: LegPose) {
    const sp = P.spec;
    const bias = P.far && !P.top ? -2.2 : 0;
    const border = !P.far && !P.top;
    const sprawl = sp.sprawl ?? 0;
    const bulk = (sp.bulk ?? 0.25) * (sp.digitigrade ? 1.6 : 1);
    // a limb is muscle on bone, not a capsule: the thigh / upper arm swells out of the body, narrows to
    // the knee, the calf / forearm bulges under it and tapers into the ankle; seen end-on, a sprawler's
    // upper limb is a short heavy mass
    const rA = P.r0 * (1.05 + sprawl * 0.12 + P.fore * 0.4), rB = P.r1 * (1 + sprawl * 0.08 + P.fore * 0.25);
    const bU = P.r0 * bulk * (1 + sprawl * 0.4), bL = P.r1 * bulk * 0.55;
    const scl = Math.max(1.5, Math.min(3.2, P.r0 * 0.7));
    if (border) {
      this.seg(buf, P.hx, P.hy, rA, P.kx, P.ky, rB, bU, 0.32, bias, 1, 0, 0.45);
      this.seg(buf, P.kx, P.ky, rB, P.ax, P.ay, P.r2, bL, 0.3, bias, 1, 0, 0);
      this.seg(buf, P.ax, P.ay, P.r2, P.fx, P.fy, P.r3, 0, 0.5, bias, 1, 0, 0);
    }
    // foot and toes, shin, then the thigh (its root lies over the body)
    this.seg(buf, P.ax, P.ay, P.r2, P.fx, P.fy, P.r3, 0, 0.5, bias, 0, scl * 0.7, 0);
    this.digits(buf, P);
    this.seg(buf, P.kx, P.ky, rB, P.ax, P.ay, P.r2, bL, 0.3, bias, 0, scl * 0.8, 0);
    this.seg(buf, P.hx, P.hy, rA, P.kx, P.ky, rB, bU, 0.32, bias, 0, scl, 0);
    // the crease at the knee / elbow on the inside of the bend
    if (!P.top && P.r1 >= 1.2) {
      const ux = P.hx - P.kx, uy = P.hy - P.ky, vx = P.ax - P.kx, vy = P.ay - P.ky;
      const ul = Math.hypot(ux, uy) || 1, vl = Math.hypot(vx, vy) || 1;
      let bx = ux / ul + vx / vl, by = uy / ul + vy / vl;
      const bl = Math.hypot(bx, by);
      if (bl > 0.2) {
        bx /= bl; by /= bl;
        const dk = tint(this.R[M_LEG * NR + Math.max(0, 1 + Math.round(bias))], 0.35);
        for (let q = 0.4; q < rB * 0.95; q += 0.5) buf.paint(P.kx + bx * q, P.ky + by * q, dk);
      }
    }
  }

  /**
   * One limb segment: a bone axis from a to b with a radius profile (linear ra -> rb plus a muscle bulge
   * peaking at `peak` along it), lit as a rounded form under the form light, with a lattice of small
   * scales (scl px, 0 = none). mode 0 = shaded fill, 1 = dark border ring over the body (past `from`).
   */
  private seg(buf: PixelBuffer, ax: number, ay: number, ra: number, bx: number, by: number, rb: number,
    bulge: number, peak: number, bias: number, mode: number, scl: number, from: number) {
    const R = this.R, data = buf.data, W = buf.w, H = buf.h;
    const rmax = Math.max(ra, rb) + bulge;
    const grow = mode === 1 ? 1 : 0;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - rmax - 1 - grow)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + rmax + 1 + grow));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - rmax - 1 - grow)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + rmax + 1 + grow));
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-6;
    const len = Math.sqrt(l2);
    const ex = dx / len, ey = dy / len;
    const dark = tint(R[M_LEG * NR + 1], 0.55);
    const iw = 1 / 0.3;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay;
        let t = (qx * dx + qy * dy) / l2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const pk = (t - peak) * iw;
        const pq = 1 - pk * pk * 0.5;
        const r = ra + (rb - ra) * t + (pq > 0 ? bulge * pq * pq : 0);
        const cx = qx - dx * t, cy = qy - dy * t;
        const d2 = cx * cx + cy * cy;
        const idx = y * W + x;
        if (mode === 1) {
          const rr = r + 1;
          if (d2 <= rr * rr && t >= from && (data[idx] >>> 24) !== 0) data[idx] = dark;
          continue;
        }
        if (d2 > r * r) continue;
        const nx = cx / r, ny = cy / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lum = nx * FX + ny * FY + nz * FZ;
        let lvl = (0.5 + 0.5 * lum) * 7 - 0.9 + bias;
        if (scl > 0 && r > 1.3) {
          // small scales in rows round the limb: a dark seam, a lit crown on the upper side
          const across = cx * -ey + cy * ex;
          const a = (t * len) / scl, b2 = across / (scl * 0.8) + 50;
          const row = Math.floor(b2);
          const fa = a + (row & 1) * 0.5 - Math.floor(a + (row & 1) * 0.5), fb = b2 - row;
          if (fa < 0.16 || fb < 0.18) lvl -= 0.7;
          else if (fb > 0.5 && fa > 0.3 && fa < 0.8 && ny < 0.3) lvl += 0.55;
        }
        let li = (lvl + 0.5) | 0;
        if (lvl < 0) li = 0; else if (li > 7) li = 7;
        data[idx] = R[M_LEG * NR + li];
      }
    }
  }

  private digits(buf: PixelBuffer, P: LegPose) {
    const sp = P.spec, R = this.R;
    const len = sp.len;
    const top = P.top;
    const nd = sp.digits ?? (top ? 5 : 3);
    const dl = Math.max(1.4, len * (top ? 0.2 : 0.22));
    const far = P.far && !top;
    const bias = far ? -2 : 0;
    const claw = R[M_CLAW * NR + (far ? 2 : 5)], clawD = R[M_CLAW * NR + (far ? 1 : 3)];
    const count = far ? Math.min(3, nd) : nd;
    const spread = top ? (P.lift > 0.5 ? 0.5 : 1.25) : 0.6;
    const thick = Math.max(0.5, P.r3 * 0.7);
    const tips: number[] = [];
    // toes: tapered, jointed, each with its claw (or adhesive pad), webbed at the base on a crocodilian
    for (let i = count - 1; i >= 0; i--) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      let dxv: number, dyv: number;
      if (top) {
        const ang = t * spread * 2;
        const c = Math.cos(ang), sn = Math.sin(ang);
        dxv = P.dx * c - P.dy * sn; dyv = P.dx * sn + P.dy * c;
      } else {
        // side view: toes fan from the ground line, the longest flat on the ground, the rest rising
        const lift = (t + 0.5) * spread;
        dxv = P.dx; dyv = P.dy - lift * 0.85;
      }
      const L2 = Math.hypot(dxv, dyv) || 1;
      dxv /= L2; dyv /= L2;
      const dlen = dl * (top ? 1 - Math.abs(t) * 0.35 : 1 - (t + 0.5) * 0.3) * (sp.pads ? 0.85 : 1);
      const steps = Math.max(2, Math.round(dlen * 2));
      let x = P.fx, y = P.fy;
      for (let j = 0; j <= steps; j++) {
        const f = j / steps;
        x = P.fx + dxv * f * dlen;
        y = P.fy + dyv * f * dlen;
        const w = thick * (1 - f * 0.55);
        const lit = (j & 3) === 2 ? 1 : 0; // the knuckles catch the light
        const c = R[M_LEG * NR + Math.max(0, Math.min(7, 3 + bias + (i === count - 1 ? 1 : 0) + lit))];
        buf.set(x, y, c);
        if (w > 0.8) buf.set(x - dyv * 0.7, y + dxv * 0.7, R[M_LEG * NR + Math.max(0, 1 + bias)]);
      }
      tips.push(x, y);
      if (sp.pads) {
        // the gecko's expanded toe pad with its lamellae
        const pc = R[M_LEG * NR + (far ? 3 : 6)], pd = R[M_LEG * NR + (far ? 1 : 3)];
        buf.set(x + dxv * 0.6, y + dyv * 0.6, pc);
        buf.set(x + dxv * 0.6 - dyv * 0.8, y + dyv * 0.6 + dxv * 0.8, pd);
        if (len > 5) buf.set(x + dxv * 1.3, y + dyv * 1.3, pc);
      } else if (sp.claw !== undefined || !top) {
        // claw: dark at the root, pale hooked tip curling down
        buf.set(x + dxv * 0.8, y + dyv * 0.8 + (top ? 0 : 0.2), clawD);
        buf.set(x + dxv * 1.6, y + dyv * 1.6 + (top ? 0 : 0.7), claw);
        if (len > 12) buf.set(x + dxv * 2.3, y + dyv * 2.3 + (top ? 0 : 1.3), claw);
      }
    }
    // webbing: a dark membrane between the toes' bases, its trailing edge scalloped
    if (sp.web && tips.length >= 4 && !top) {
      const mem = R[M_LEG * NR + Math.max(0, 2 + bias)];
      for (let i = 0; i + 3 < tips.length; i += 2) {
        const ax2 = P.fx + (tips[i] - P.fx) * 0.62, ay2 = P.fy + (tips[i + 1] - P.fy) * 0.62;
        const bx2 = P.fx + (tips[i + 2] - P.fx) * 0.62, by2 = P.fy + (tips[i + 3] - P.fy) * 0.62;
        const mx = (ax2 + bx2) * 0.5, my = (ay2 + by2) * 0.5;
        buf.polyFn([P.fx, P.fy, ax2, ay2, mx + (P.fx - mx) * 0.25, my + (P.fy - my) * 0.25, bx2, by2], (xx, yy) => {
          const d = buf.data[yy * buf.w + xx];
          return (d >>> 24) === 255 ? -1 : mem;
        });
      }
    }
  }

  // ================================================================ membranes & ornaments
  /** pteramander glide: skin flaps stretched between front and hind limbs, both sides */
  private drawPatagia(buf: PixelBuffer, flat: number) {
    const L = this.look;
    const specs = L.legs;
    if (!specs || specs.length < 2) return;
    let fi = -1, hi = -1;
    for (let i = 0; i < specs.length; i++) {
      const front = specs[i].kind ? specs[i].kind === 'front' : specs[i].at < 0.45;
      if (front && fi < 0) fi = i;
      if (!front && hi < 0) hi = i;
    }
    if (fi < 0 || hi < 0) return;
    const R = this.R;
    for (let side = 0; side < 2; side++) {
      const A = this.poses[fi * 2 + side], B = this.poses[hi * 2 + side];
      const kf = this.sampleAt(specs[fi].at), kh = this.sampleAt(specs[hi].at);
      const sgn = side === 1 ? -1 : 1;
      const pts: number[] = [];
      // along the flank from shoulder to hip
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const k = Math.round(kf + ((kh - kf) * i) / steps);
        pts.push(this.PX[k] + this.NX[k] * sgn * this.WW[k] * 0.5, this.PY[k] + this.NY[k] * sgn * this.WW[k] * 0.5);
      }
      // hind limb out to the ankle, scalloped trailing edge, front limb back in
      pts.push(B.kx, B.ky, B.ax, B.ay);
      const ex = (A.fx + B.ax) * 0.5, ey = (A.fy + B.ay) * 0.5;
      const mx = (this.PX[kf] + this.PX[kh]) * 0.5, my = (this.PY[kf] + this.PY[kh]) * 0.5;
      // scallop: pull the trailing edge midpoint toward the body
      const cx = ex + (mx - ex) * 0.28, cy = ey + (my - ey) * 0.28;
      pts.push(cx, cy, A.fx, A.fy, A.ax, A.ay, A.kx, A.ky);
      const col = R[M_X1 * NR + 4], col2 = R[M_X2 * NR + 3];
      const vein = R[M_X2 * NR + 2];
      buf.polyFn(pts, (x, y) => {
        const d = buf.data[y * buf.w + x];
        // veins radiating from the body
        const rx = x + 0.5 - mx, ry = y + 0.5 - my;
        const ang = Math.atan2(ry, rx);
        const vv = mod(ang * 7.5, 1);
        const c = vv < 0.14 ? vein : (Math.hypot(rx, ry) > this.look.radius * 3.2 ? col : col2);
        return over(d, c, vv < 0.14 ? 235 : 205);
      });
    }
    void flat;
  }

  /** side view: the patagium folded along the lower flank between the legs, a loose skin fold that
   *  hangs in shallow scallops between its supporting ribs, pale-rimmed; it drops as `flatten` rises */
  private drawFoldedPatagia(buf: PixelBuffer, flat: number) {
    const L = this.look;
    const specs = L.legs;
    if (!specs || specs.length < 2) return;
    const k0 = this.sampleAt(Math.min(specs[0].at, specs[1].at)), k1 = this.sampleAt(Math.max(specs[0].at, specs[1].at));
    const R = this.R;
    const drop = 0.8 + flat * 3;
    const rib = Math.max(2, L.radius * 0.8);
    for (let k = k0; k <= k1; k++) {
      const t = (k - k0) / Math.max(1, k1 - k0);
      const s = k * this.ds;
      const sc = mod(s, rib) / rib;
      const h = Math.sin(t * Math.PI) * drop * (0.75 + 0.25 * Math.sin(sc * Math.PI));
      const w = this.WD[k];
      const bx = this.PX[k] - this.NX[k] * w * 0.6, by = this.PY[k] - this.NY[k] * w * 0.6;
      const n = Math.ceil(w * 0.4 + h);
      for (let j = 0; j <= n; j++) {
        const x = bx - this.NX[k] * j, y = by - this.NY[k] * j;
        const edge = j >= n - 0.5;
        const vein = sc < 0.18;
        const c = edge ? R[M_X2 * NR + 5] : vein ? R[M_X2 * NR + 1] : R[M_X1 * NR + (j < n * 0.5 ? 2 : 4)];
        buf.set(x, y, c);
      }
    }
  }

  /** sprint viper threat crest: a fan of spines with a red membrane on the nape */
  private drawCrest(buf: PixelBuffer, amt: number) {
    const cr = this.look.crest!;
    const R = this.R;
    const hh = this.hh;
    const nsp = 6;
    const s0 = hh * 0.5, gap = Math.max(1.2, hh * 0.42);
    const bases: number[] = [], tips: number[] = [];
    for (let j = 0; j < nsp; j++) {
      const k = Math.min(this.n - 1, Math.round((s0 + j * gap) / this.ds));
      const t = j / (nsp - 1);
      const alpha = 0.18 + amt * (1.25 - t * 0.35); // angle from the tail-ward tangent
      const len = cr.h * (0.55 + 0.45 * Math.sin((t * 0.85 + 0.12) * Math.PI)) * (0.35 + 0.65 * amt);
      const dx = this.TX[k] * Math.cos(alpha) + this.NX[k] * Math.sin(alpha);
      const dy = this.TY[k] * Math.cos(alpha) + this.NY[k] * Math.sin(alpha);
      const w = this.WW[k] * 0.7;
      const bx = this.PX[k] + this.NX[k] * w, by = this.PY[k] + this.NY[k] * w;
      bases.push(bx, by);
      tips.push(bx + dx * len, by + dy * len);
    }
    // membrane
    const poly: number[] = [];
    for (let j = 0; j < nsp; j++) poly.push(tips[j * 2], tips[j * 2 + 1]);
    for (let j = nsp - 1; j >= 0; j--) poly.push(bases[j * 2], bases[j * 2 + 1]);
    const cx = (tips[4] + tips[6] + bases[4] + bases[6]) * 0.25, cy = (tips[5] + tips[7] + bases[5] + bases[7]) * 0.25;
    const er = Math.max(1, cr.h * 0.16 * amt);
    buf.polyFn(poly, (x, y) => {
      const ex = x + 0.5 - cx, ey = y + 0.5 - cy;
      const e2 = ex * ex + ey * ey;
      if (e2 < er * er * 0.45) return R[M_X2 * NR + 1];
      if (e2 < er * er) return R[M_TOOTH * NR + 6];
      return R[M_X1 * NR + (y + 0.5 < cy ? 5 : 3)];
    });
    // spines with dark tips
    for (let j = 0; j < nsp; j++) {
      const bx = bases[j * 2], by = bases[j * 2 + 1], tx = tips[j * 2], ty = tips[j * 2 + 1];
      const L2 = Math.hypot(tx - bx, ty - by);
      const steps = Math.ceil(L2 * 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        buf.set(bx + (tx - bx) * t, by + (ty - by) * t, t > 0.72 ? R[M_X2 * NR + 0] : R[M_X2 * NR + 2]);
      }
    }
  }

  /** crocodile: the nuchal shield behind the skull, paired keeled scutes down the back, then the tail's
   *  double saw-toothed crest (two rows, near row lit, far row in shadow) merging into one near the tip */
  private drawCrestScutes(buf: PixelBuffer, st: SerpentState) {
    const O = this.look.osteoderms!;
    const R = this.R;
    const len = O.len, H = O.crest ?? 0;
    const total = this.total;
    const moss = this.look.moss ? clamp(st.mossy ?? this.look.moss.amount) : 0;
    const sStart = this.hl * 0.12 + 2;
    const tail0 = this.look.legs && this.look.legs.length > 1 ? Math.max(...this.look.legs.map(l => l.at)) + 0.04 : 0.45;
    const WU = this.WU, TX = this.TX, TY = this.TY, NX = this.NX, NY = this.NY, PX = this.PX, PY = this.PY;
    const scute = (s: number, h: number, hb: number, lean: number, row: number) => {
      const k = Math.min(this.n - 1, Math.max(0, Math.round(s / this.ds)));
      const w = WU[k];
      const bx = PX[k] + NX[k] * (w - 0.7), by = PY[k] + NY[k] * (w - 0.7);
      const ax = bx + TX[k] * hb, ay = by + TY[k] * hb;     // toward the tail
      const cx = bx - TX[k] * hb, cy = by - TY[k] * hb;     // toward the head
      const tx = bx + NX[k] * h + TX[k] * h * lean, ty = by + NY[k] * h + TY[k] * h * lean;
      const mossy = moss > 0 && noise2(s * 0.16, HALF_PI * 2.6, this.seed) * 0.75 + 0.3 > 1.02 - moss;
      const M = mossy ? M_MOSS : M_BASE;
      const lit = R[M * NR + (row ? 3 : 6)], mid = R[M * NR + (row ? 2 : 4)], dk = R[M * NR + (row ? 1 : 2)];
      buf.polyFn([cx, cy, tx, ty, ax, ay], (x, y) => {
        // the lit face toward the head and the light, the keel's edge, the shaded face toward the tail
        const side = (x + 0.5 - tx) * TX[k] + (y + 0.5 - ty) * TY[k];
        const up = (x + 0.5 - bx) * NX[k] + (y + 0.5 - by) * NY[k];
        if (side < -0.5) return up > h * 0.55 ? lit : mid;
        return side < 0.5 ? mid : dk;
      });
    };
    // nuchal shield: a cluster of big bosses just behind the skull
    for (let i = 0; i < 3; i++) scute(sStart + i * len * 0.95, 1.6 + (i === 1 ? 0.6 : 0), len * 0.42, 0.1, 0);
    // dorsal scute keels (two rows read as alternating bumps), then the double crest of the tail
    const s0 = sStart + len * 3.4;
    for (let pass = 0; pass < 2; pass++) for (let s = s0 + (pass === 0 ? len * 0.5 : 0); s < total - 2; s += len) {
      const u = s / total;
      const tail = smoothstep(tail0 - 0.03, tail0 + 0.06, u);
      const single = smoothstep(0.78, 0.86, u);
      const far = pass === 0;
      if (far && single > 0.5) continue;
      let h = (0.75 + tail * H * (1 - smoothstep(0.84, 1, u) * 0.7)) * (far ? 0.82 : 1);
      if (!tail && far) h *= 0.8;
      if (h < 0.6) continue;
      scute(s + (far ? len * 0.12 : 0), h, Math.max(1.1, len * (tail > 0.5 ? 0.36 : 0.3)), tail * 0.3, far ? 1 : 0);
    }
  }

  // ================================================================ fins & gills
  /** pectoral fan: rays radiating from a root on the lower flank behind the gills */
  private drawPectoral(buf: PixelBuffer, time: number, far: boolean) {
    const L = this.look, R = this.R;
    const sRoot = this.hh * 2.3 + L.radius * 0.4;
    const k = Math.min(this.n - 1, Math.round(sRoot / this.ds));
    const w = this.WW[k];
    const nx = this.NX[k], ny = this.NY[k], tx = this.TX[k], ty = this.TY[k];
    const rootx = this.PX[k] - nx * w * 0.35 + (far ? -tx * 2 + nx * 1.5 : 0);
    const rooty = this.PY[k] - ny * w * 0.35 + (far ? -ty * 2 + ny * 1.5 : 0);
    const flen = L.radius * 1.35 * (far ? 0.85 : 1);
    const scull = Math.sin(time * 2.1 + (far ? 1.3 : 0)) * 0.22;
    // angles measured from the tail-ward tangent toward the belly
    const a0 = 0.25 + scull, a1 = 1.25 + scull * 0.6;
    const nr = 7;
    const pts: number[] = [rootx, rooty];
    const rays: number[] = [];
    for (let i = 0; i <= nr; i++) {
      const t = i / nr;
      const a = a0 + (a1 - a0) * t;
      const l = flen * (0.62 + 0.38 * Math.sin((0.15 + t * 0.8) * Math.PI));
      const dx = tx * Math.cos(a) - nx * Math.sin(a), dy = ty * Math.cos(a) - ny * Math.sin(a);
      pts.push(rootx + dx * l, rooty + dy * l);
      rays.push(dx, dy, l);
    }
    const bias = far ? -2 : 0;
    const mem = R[M_FIN2 * NR + Math.max(0, 4 + bias)], mem2 = R[M_FIN2 * NR + Math.max(0, 3 + bias)];
    buf.polyFn(pts, (x, y) => {
      const d = buf.data[y * buf.w + x];
      const rx = x + 0.5 - rootx, ry = y + 0.5 - rooty;
      const dist = Math.hypot(rx, ry);
      return over(d, dist > flen * 0.55 ? mem : mem2, 200);
    });
    // rays
    const rayc = R[M_FIN2 * NR + Math.max(0, 2 + bias)], tipc = R[M_FIN2 * NR + Math.max(0, 6 + bias)];
    for (let i = 0; i <= nr; i++) {
      const dx = rays[i * 3], dy = rays[i * 3 + 1], l = rays[i * 3 + 2];
      const steps = Math.ceil(l * 1.5);
      for (let j = 2; j <= steps; j++) {
        const t = j / steps;
        buf.set(rootx + dx * l * t, rooty + dy * l * t, t > 0.9 ? tipc : rayc);
      }
    }
    // fin base
    buf.disc(rootx, rooty, Math.max(1, L.radius * 0.12), R[M_FIN2 * NR + Math.max(0, 3 + bias)]);
  }

  /** external gill fronds (axolotl-like): three feathery stalks per side behind the head */
  private drawGills(buf: PixelBuffer, time: number, far: boolean) {
    const L = this.look, R = this.R;
    const r = L.radius;
    const gl = (L.gillLen ?? 1.7) * r;
    const bias = far ? -2 : 0;
    const stalkC = R[M_GILL * NR + Math.max(0, 2 + bias)];
    const filC = [R[M_GILL * NR + Math.max(0, 3 + bias)], R[M_GILL * NR + Math.max(0, 4 + bias)], R[M_GILL * NR + Math.max(0, 6 + bias)]];
    const baseAng = [1.05, 0.62, 0.2];
    const lens = [1, 0.9, 0.76];
    const dens = Math.max(1, r * 0.075);
    for (let j = 0; j < 3; j++) {
      const sRoot = this.hh * (0.1 + 0.34 * j) + 1;
      const k = Math.min(this.n - 1, Math.round(sRoot / this.ds));
      const w = this.WW[k];
      const nx = this.NX[k], ny = this.NY[k], tx = this.TX[k], ty = this.TY[k];
      const rootx = this.PX[k] + nx * w * (far ? 0.62 : 0.3), rooty = this.PY[k] + ny * w * (far ? 0.62 : 0.3);
      const sway = Math.sin(time * 1.3 + j * 1.1 + (far ? 0.7 : 0)) * 0.13;
      const a0 = baseAng[j] + sway + (far ? 0.12 : 0);
      const len = gl * lens[j] * (far ? 0.92 : 1);
      const bend = 0.55;
      let px = rootx, py = rooty;
      const steps = Math.ceil(len * 1.5);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = a0 - bend * t;
        const dx = tx * Math.cos(a) + nx * Math.sin(a), dy = ty * Math.cos(a) + ny * Math.sin(a);
        px += dx * (len / steps);
        py += dy * (len / steps);
        // stalk (thicker near the root on big animals)
        buf.set(px, py, stalkC);
        if (r > 12 && t < 0.55) buf.set(px - dx * 0.0 + (-dy) * 0.9, py + dx * 0.9, stalkC);
        // feathery filaments on both sides
        const fi = Math.floor((t * len) / dens);
        const pfi = Math.floor(((i - 1) / steps * len) / dens);
        if (t > 0.1 && fi !== pfi) {
          const fl = r * 0.3 * (1 - 0.6 * t) + 1;
          const flut = Math.sin(time * 3.1 + i * 0.7 + j) * 0.18;
          for (let sd = -1; sd <= 1; sd += 2) {
            const fa = sd * (1.15 - 0.35 * t) + flut;
            const fdx = dx * Math.cos(fa) - dy * Math.sin(fa), fdy = dx * Math.sin(fa) + dy * Math.cos(fa);
            const fs = Math.ceil(fl * 1.4);
            for (let q = 1; q <= fs; q++) {
              const tt = q / fs;
              buf.set(px + fdx * fl * tt, py + fdy * fl * tt, filC[tt < 0.4 ? 0 : tt < 0.8 ? 1 : 2]);
            }
          }
        }
      }
    }
  }

  /** gecko dewlap: violet throat fan */
  private drawDewlap(buf: PixelBuffer, st: SerpentState, amt: number) {
    const dw = this.look.dewlap!;
    const R = this.R;
    const { ox0, oy0, fx, fy, ux, uy } = this.headFrame(st);
    const hl = this.hl, hh = this.hh;
    const size = dw.size * (0.25 + 0.75 * amt);
    // centre under the throat, fan hanging down (toward -U), in top view out to the side
    const top = this.topView;
    const cf = hl * 0.1, cu = top ? -hh * 0.55 : -hh * 0.75;
    const cx = ox0 + fx * cf + ux * cu, cy = oy0 + fy * cf + uy * cu;
    const x0 = Math.floor(cx - size - 2), x1 = Math.ceil(cx + size + 2), y0 = Math.floor(cy - size - 2), y1 = Math.ceil(cy + size + 2);
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= buf.h) continue;
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= buf.w) continue;
        const qx = x + 0.5 - cx, qy = y + 0.5 - cy;
        const f = qx * fx + qy * fy, u = qx * ux + qy * uy;
        if (u > 0.3) continue;
        // fan spans from under the chin (forward) back to the chest
        const ang = Math.atan2(f, -u); // 0 = straight down, + toward the snout
        if (ang > 0.75 || ang < -1.35) continue;
        const d = Math.hypot(f, u);
        const lim = size * (0.72 + 0.28 * Math.cos((ang + 0.3) * 1.6));
        if (d > lim) continue;
        const rim = d > lim - 1.1;
        const vein = mod((ang + 1.35) * 5.2, 1) < 0.16 && d > 1.5;
        const c = rim ? R[M_X2 * NR + 6] : vein ? R[M_X1 * NR + 2] : R[M_X1 * NR + (d > lim * 0.55 ? 5 : 4)];
        buf.data[y * buf.w + x] = c;
      }
    }
  }

  // ================================================================ V12 plumage
  /**
   * The feathered boa's plumage. layer 0: the far side, painted before the body (the far half of the
   * ruff fans out behind the neck, the far fringe shows over the spine, both in shadow); layer 1: over
   * the body (the near fringe down the spine, the near half of the ruff lying over the neck); layer 2:
   * the crest on the crown, after the head. st.crest (0..1) raises the ruff into a full frill and
   * the crest up off the crown; at 0 they lie back sleek along the neck.
   */
  private drawPlumage(buf: PixelBuffer, st: SerpentState, time: number, layer: number) {
    const F = this.look.feathers!;
    const Rd = this.look.radius;
    const lift = clamp(st.crest ?? 0);
    const n = this.n, ds = this.ds, total = this.total, seed = this.seed;
    const PX = this.PX, PY = this.PY, NX = this.NX, NY = this.NY, TX = this.TX, TY = this.TY, WW = this.WW;
    const curlTo = (dx: number, dy: number, cx: number, cy: number): [number, number] => {
      const d = cx * dx + cy * dy;
      let x = cx - dx * d, y = cy - dy * d;
      const l = Math.hypot(x, y);
      if (l < 1e-3) { x = -dy; y = dx; } else { x /= l; y /= l; }
      return [x, y];
    };
    // ---- the fringe down the spine (tail first, so each feather lies over the one behind it)
    if (F.fringe && layer < 2) {
      const fr = F.fringe;
      const every = Math.max(2.5, (fr.every ?? 0.45) * Rd) * (layer === 0 ? 2 : 1);
      const s0 = Math.max(fr.from * total, this.hh * 2.6), s1 = fr.to * total;
      const cnt = Math.floor((s1 - s0) / every);
      for (let i = cnt; i >= 0; i--) {
        const sF = s0 + i * every + (layer === 0 ? every * 0.25 : 0);
        const k = Math.min(n - 1, Math.round(sF / ds));
        const u = (sF - s0) / Math.max(1, s1 - s0);
        const env = Math.min(1, 0.45 + u * 3) * (1 - smoothstep(0.7, 1, u) * 0.75);
        const h = hash2(i, layer, seed + 41);
        const len = fr.len * Rd * env * (0.8 + h * 0.4) * (layer === 0 ? 0.9 : 1) * (1 + lift * 0.15);
        if (len < 2) continue;
        const w = WW[k];
        const bx = PX[k] + NX[k] * w * 0.7, by = PY[k] + NY[k] * w * 0.7;
        const sway = Math.sin(time * 2.3 + sF * 0.045 + h * 3) * 0.08;
        const th = (layer === 0 ? 0.7 : 0.88) - lift * 0.42 + sway + (h - 0.5) * 0.2;
        const dx = NX[k] * Math.cos(th) + TX[k] * Math.sin(th), dy = NY[k] * Math.cos(th) + TY[k] * Math.sin(th);
        const [cx, cy] = curlTo(dx, dy, TX[k], TY[k]);
        this.feather(buf, bx, by, dx, dy, len, Math.max(1, len * 0.24), 0.16, cx, cy, layer === 0 ? 0.15 : 0.75, 0, seed + i * 7 + layer, time, 0);
      }
    }
    // ---- the ruff behind the head: a frill when raised, a sleek cowl when not
    if (F.ruff && layer < 2) {
      const rf = F.ruff;
      const nR = layer === 0 ? rf.n : Math.max(3, Math.round(rf.n * 0.55));
      const sA = this.hh * 0.8 + Rd * 0.15, sB = sA + Rd * 1.7;
      for (let j = 0; j < nR; j++) {
        const q = nR > 1 ? j / (nR - 1) : 0.5;
        const h = hash2(j, 11 + layer, seed);
        const sR = layer === 0 ? sA + (sB - sA) * (0.15 + h * 0.7) : sB - (sB - sA) * q;
        const k = Math.min(n - 1, Math.round(sR / ds));
        const w = WW[k];
        let th: number, across: number;
        if (layer === 0) { th = 1.3 + (q - 0.5) * 0.35 + (-0.8 + q * 3.2 - 1.3 - (q - 0.5) * 0.35) * lift; across = 0.8 - q * 1.6; }
        else { th = 1.25 + q * 0.15 + (0.05 + q * 1.25 - 1.25 - q * 0.15) * lift; across = 0.72 - q * 0.75; }
        th += Math.sin(time * 2.1 + j * 1.7) * 0.04 * (0.4 + lift);
        const bx = PX[k] + NX[k] * w * across, by = PY[k] + NY[k] * w * across;
        const dx = NX[k] * Math.cos(th) + TX[k] * Math.sin(th), dy = NY[k] * Math.cos(th) + TY[k] * Math.sin(th);
        const len = rf.len * Rd * (0.5 + 0.5 * lift) * (0.82 + h * 0.3) * (layer === 0 ? 1.06 : 0.9);
        const [cx, cy] = curlTo(dx, dy, TX[k], TY[k]);
        this.feather(buf, bx, by, dx, dy, len, len * (0.12 + 0.04 * lift), 0.1, cx, cy, layer === 0 ? 0.45 + lift * 0.15 : 0.9, 1, seed + 300 + j * 13 + layer, time, lift);
      }
    }
    // ---- the crest on the crown
    if (F.crest && layer === 2) {
      const cr = F.crest;
      const { ox0, oy0, fx, fy, ux, uy } = this.headFrame(st);
      for (let j = cr.n - 1; j >= 0; j--) {
        const q = cr.n > 1 ? j / (cr.n - 1) : 0;
        const bx = ox0 + fx * this.hl * (0.36 - q * 0.42) + ux * this.hh * 0.78;
        const by = oy0 + fy * this.hl * (0.36 - q * 0.42) + uy * this.hh * 0.78;
        const th = 1.38 + q * 0.1 + (0.2 + q * 0.5 - 1.38 - q * 0.1) * lift + Math.sin(time * 2.6 + j) * 0.05;
        const dx = ux * Math.cos(th) - fx * Math.sin(th), dy = uy * Math.cos(th) - fy * Math.sin(th);
        const len = cr.len * Rd * (1 - q * 0.3) * (0.55 + 0.45 * lift) * (0.9 + hash2(j, 5, seed) * 0.2);
        const [cx, cy] = curlTo(dx, dy, -fx, -fy);
        this.feather(buf, bx, by, dx, dy, len, Math.max(1, len * 0.15), 0.22, cx, cy, 0.9, 2, seed + 600 + j * 5, time, 0);
      }
    }
  }

  /**
   * One feather, placed pixel by pixel along a curving shaft: from (bx, by) heading (dx, dy), bowing
   * toward (cx, cy) by `curl` of its length. kind 0 fringe, 1 ruff, 2 crest; lit 0 (shadow) .. 1;
   * flash 0..1 shows the ruff's display bands.
   */
  private feather(buf: PixelBuffer, bx: number, by: number, dx: number, dy: number, len: number, wid: number, curl: number,
    cx: number, cy: number, lit: number, kind: number, seed: number, time: number, flash: number) {
    const W = buf.w, H = buf.h, d = buf.data;
    const steps = Math.ceil(len * 2.2);
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const ax = bx + dx * len * s + cx * curl * len * s * s, ay = by + dy * len * s + cy * curl * len * s * s;
      let tx = dx + cx * curl * 2 * s, ty = dy + cy * curl * 2 * s;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      // narrow at the quill, fullest past the middle, a rounded tip; the leading vane a little narrower
      const prof = s < 0.1 ? 0.22 + s * 3.2 : Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + s * 0.95)), 0.55);
      const wA = wid * prof * (kind === 1 ? 0.95 : 0.78), wB = wid * prof;
      const nA = Math.ceil(wA * 2), nB = Math.ceil(wB * 2);
      for (let j = -nA; j <= nB; j++) {
        const off = j * 0.5;
        const side = off < 0 ? -1 : 1;
        const v = off < 0 ? off / Math.max(0.5, wA) : off / Math.max(0.5, wB);
        if (v < -1 || v > 1) continue;
        const x = Math.floor(ax + nx * off), y = Math.floor(ay + ny * off);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const c = this.featherCol(s, v, side, len, wid, lit, kind, seed, time, flash);
        if (c !== -1) d[y * W + x] = c;
      }
    }
  }

  private featherCol(s: number, v: number, side: number, len: number, wid: number, lit: number, kind: number, seed: number, time: number, flash: number): number {
    const FV = kind === 0 ? this.FV0! : this.FV!, FX = this.FX!, FS = this.FS, F = this.look.feathers!;
    const av = v < 0 ? -v : v;
    const sp = s * len;
    // barbs: grooves raking toward the tip; here and there they have parted (a split in the vane)
    const ph = (sp * 0.8 - av * wid * 0.9) / 2.1;
    const bi = Math.floor(ph), band = ph - bi;
    if (av > 0.45 && band < 0.24 && hash2(bi, side + 3, seed) < 0.24) return -1;
    // a ragged edge
    if (av > 0.9 && s > 0.15 && hash2(Math.floor(sp), side + 7, seed) < 0.4) return -1;
    // the shaft
    if (av * wid < 0.55 && wid > 1.3 && s < 0.88) return s < 0.14 ? FX.rachD : FX.rach;
    let lvl = 1.6 + lit * 2.6 + (1 - av) * 1.3 + (side < 0 ? 0.55 : -0.35) - s * 0.5;
    if (band < 0.32) lvl -= 0.9;
    if (av > 0.78) lvl -= 0.9;
    const li = lvl < 0 ? 0 : lvl > 7 ? 7 : lvl | 0;
    // the ruff's display: a gold heart and a crimson band, shown as it rises
    if (kind === 1 && flash > 0.05) {
      if (s < 0.08 + 0.14 * flash) return FX.fl[Math.min(7, li + 1)];
      if (s < 0.13 + 0.17 * flash) return FX.fl2[li];
    }
    // dark tips; the ruff's carry a pale eye-spot
    const tipAt = kind === 1 ? 0.8 : kind === 2 ? 0.86 : 0.88;
    if (s > tipAt) {
      if (kind === 1 && av < 0.42 && s > tipAt + 0.04 && s < tipAt + 0.12) return FX.tipL;
      return FX.tip;
    }
    // bars across the fringe feathers
    if (kind === 0 && F.barred && sp % 4.4 < 1.4 && s > 0.2) return FV[Math.max(0, li - 2)];
    // iridescence: a sheen band that slides along the feather as it moves
    if (FS.length && kind > 0 && av > 0.12 && av < 0.86) {
      const ir = 0.5 + 0.5 * Math.sin(s * 4.2 + time * 1.6 + seed * 0.37 + v * 1.2);
      const i0 = 0.45;
      if (ir > i0) return FS[Math.min(FS.length - 1, Math.floor(((ir - i0) / (1 - i0)) * FS.length))][Math.min(7, li + 1)];
    }
    return FV[li];
  }

  // ================================================================ head
  private headFrame(st: SerpentState) {
    const n = this.n;
    const j = Math.min(n - 1, Math.max(1, Math.round(Math.max(2, this.hh * 0.9) / this.ds)));
    let fx = this.PX[0] - this.PX[j], fy = this.PY[0] - this.PY[j];
    const l = Math.hypot(fx, fy) || 1;
    fx /= l; fy /= l;
    const f = this.fEff;
    let ux = fy * f, uy = -fx * f;
    const tilt = st.headTilt ?? 0;
    if (tilt) {
      const c = Math.cos(tilt), s = Math.sin(tilt);
      const nfx = fx * c + ux * s, nfy = fy * c + uy * s;
      ux = ux * c - fx * s; uy = uy * c - fy * s;
      fx = nfx; fy = nfy;
    }
    return { ox0: this.PX[0], oy0: this.PY[0], fx, fy, ux, uy };
  }

  private drawHead(buf: PixelBuffer, st: SerpentState, time: number, detail: number) {
    const L = this.look, H = this.hs, R = this.R;
    const hh = this.hh, hl = this.hl;
    const { ox0, oy0, fx, fy, ux, uy } = this.headFrame(st);
    const top = this.topView;
    const back = -H.kt[0] * hl;
    const w0 = this.WW[0];
    const jaw = top ? 0 : clamp(st.jaw);
    const ja = jaw * H.jaw;
    const cj = Math.cos(ja), sj = Math.sin(ja);
    const smile = L.smile ?? 0;
    const browK = (L.brow ?? 1) * H.brow;
    const eyeState: EyeState = st.blink ? 'closed' : st.eye ?? 'open';
    // profile LUT (0.5 px steps)
    const nL = Math.ceil((back + hl) * 2) + 3;
    if (this.hLT.length < nL) { this.hLT = new Float32Array(nL + 16); this.hLB = new Float32Array(nL + 16); this.hLM = new Float32Array(nL + 16); }
    const LT = this.hLT, LB = this.hLB, LM = this.hLM;
    const kt = H.kt;
    for (let i = 0; i < nL; i++) {
      const f = i * 0.5 - back;
      const t = f / hl;
      let j = 0;
      while (j < kt.length - 2 && kt[j + 1] < t) j++;
      const a = clamp((t - kt[j]) / Math.max(1e-6, kt[j + 1] - kt[j]));
      const e = a * a * (3 - 2 * a);
      let tp = (H.top[j] + (H.top[j + 1] - H.top[j]) * e) * hh;
      let bt = (H.bot[j] + (H.bot[j + 1] - H.bot[j]) * e) * hh;
      let mo = (H.mo[j] + (H.mo[j + 1] - H.mo[j]) * e) * hh;
      // blend the back of the head into the neck
      if (t < 0) {
        const k = clamp(-t / Math.max(1e-6, -kt[0]));
        const ke = k * k;
        tp = tp + (w0 - tp) * ke;
        bt = bt + (-w0 - bt) * ke;
      }
      // brow bump over the eye
      const de = (t - H.eyeT) / 0.13;
      tp += browK * 0.15 * hh * Math.exp(-de * de);
      if (smile) mo += smile * 0.22 * hh * Math.max(0, 1 - Math.max(0, t) * 2.2) ** 2;
      if (t > 1) { tp = bt = mo = 0; }
      LT[i] = tp; LB[i] = bt; LM[i] = mo;
    }
    const lut = (f: number) => {
      let i = ((f + back) * 2 + 0.5) | 0;
      if (i < 0) i = 0; else if (i >= nL) i = nL - 1;
      return i;
    };
    const fh = H.hinge * hl;
    const uh = LM[lut(fh)];
    const eyeF = H.eyeT * hl, eyeU = H.eyeU * hh;
    const er = Math.max(1.4, hh * H.eyeR * (L.eyeSize ?? 1)) * (eyeState === 'alert' ? 1.15 : 1);
    // bounding box: the head's own box in head space (the open jaw swings down from the hinge), projected
    let uTop = -1e9, uBot = 1e9;
    for (let i = 0; i < nL; i++) { if (LT[i] > uTop) uTop = LT[i]; if (LB[i] < uBot) uBot = LB[i]; }
    uTop += 2; uBot -= 2 + (top ? Math.max(uTop, -uBot) : (hl - fh) * Math.sin(ja) * 1.05 + hh * 0.5 * jaw);
    if (top) uTop = Math.max(uTop, -uBot);
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const ff of [-back - 1, hl + 1]) for (const uu of [uTop, uBot]) {
      const xx = ox0 + fx * ff + ux * uu, yy = oy0 + fy * ff + uy * uu;
      if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
    }
    bx0 = Math.max(0, Math.floor(bx0)); bx1 = Math.min(buf.w - 1, Math.ceil(bx1));
    by0 = Math.max(0, Math.floor(by0)); by1 = Math.min(buf.h - 1, Math.ceil(by1));
    const data = buf.data, W = buf.w;
    const labSp = Math.max(2, hh * 0.55);
    const toothSp = Math.max(2, hl / 15);
    const teeth = L.teeth ?? H.teeth;
    const mark = L.headMark ?? 'none';
    const tipStart = 0.78;
    const glossy = clamp(st.wet ?? L.wet ?? 0);
    const HN = this.HN, HZ = this.HZ;
    const jF = H.jowl[0] * hl, jU = H.jowl[1] * hh, jR = Math.max(1.5, H.jowl[2] * hh), jA = H.jowl[3];
    const sockR = er + Math.max(1, hh * 0.22);
    const labH = H.labials ? Math.min(3.2, Math.max(1.1, hh * 0.21)) : 0;
    const pitsLab = !!L.pits && (L.head === 'blunt' || L.head === 'eel') && hh >= 4;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const qx = x + 0.5 - ox0, qy = y + 0.5 - oy0;
        const f = qx * fx + qy * fy;
        if (f < -back || f > hl + 0.5) continue;
        const u = qx * ux + qy * uy;
        const li = lut(f);
        const tp = LT[li], bt = LB[li], mo = LM[li];
        const t = f / hl;
        const idx = y * W + x;
        if (top) {
          // ---- from above: symmetric head, dorsal colours
          const hw = tp * H.topW;
          const au = u < 0 ? -u : u;
          if (au > hw || hw <= 0) continue;
          const v = u / hw;
          const vn = v * 0.9;
          const nz = Math.sqrt(Math.max(0, 1 - vn * vn));
          const tipk = smoothstep(tipStart, 1, t);
          const lum = (ux * vn * (1 - tipk * 0.5) + fx * tipk * 0.6) * LX + (uy * vn * (1 - tipk * 0.5) + fy * tipk * 0.6) * LY + nz * LZ;
          let lvl = (0.5 + 0.5 * lum) * 7 - 1;
          let mat = M_BASE;
          if (this.patId === P_BARK && au < hw * 0.35 && mod(f + au, hh * 1.3) < 1) mat = M_PAT;
          if (au > hw - 0.9) lvl -= 0.8;
          let li2 = (lvl + 0.5) | 0; if (lvl < 0) li2 = 0; else if (li2 > 7) li2 = 7;
          data[idx] = R[mat * NR + li2];
          continue;
        }
        // ---- side view
        let part = 0; // 1 upper, 2 lower, 3 mouth
        let pf = f, pu = u;
        let ptp = tp, pbt = bt, pmo = mo;
        if (f <= fh || jaw < 0.01) {
          // throat skin stretches as the jaw drops
          const drop = jaw > 0 ? (Math.sin(ja) * (fh - f + hl * 0.35)) * smoothstep(-back, fh, f) * 0.35 : 0;
          if (u <= tp && u >= bt - drop) part = u >= mo ? 1 : 2;
        } else {
          if (u >= mo && u <= tp) part = 1;
          else {
            const df = f - fh, du = u - uh;
            const f2 = fh + df * cj - du * sj, u2 = uh + df * sj + du * cj;
            if (f2 >= fh - 0.5 && f2 <= hl) {
              const l2 = lut(f2);
              if (u2 <= LM[l2] && u2 >= LB[l2]) { part = 2; pf = f2; pu = u2; ptp = LT[l2]; pbt = LB[l2]; pmo = LM[l2]; }
              else if (u < mo && u2 > LM[l2] && f < hl * 0.98) {
                part = 3;
                pf = f2; pu = u2; pmo = LM[l2];
              }
            }
          }
        }
        if (part === 0) continue;
        if (part === 3) {
          // mouth interior: gums near the lips, dark throat deep inside
          const dUp = mo - u;           // below the upper lip
          const dLo = pu - pmo;         // above the lower lip (jaw frame)
          const depth = Math.min(dUp, dLo);
          const tt = f / hl;
          let mi = depth < 1 ? 5 : depth < 2.2 ? 4 : tt < 0.35 ? 1 : 2;
          if (detail >= 1 && depth >= 2.2 && tt >= 0.3) {
            const span = dUp + dLo;
            if (dLo < span * 0.42 && tt < 0.86) {
              // the tongue lying in the floor of the mouth, a groove down its middle
              mi = Math.abs(dLo - span * 0.22) < 0.6 ? 2 : dLo < span * 0.12 ? 3 : 4;
            } else if (dUp < span * 0.5) {
              // the palate: transverse ridges (rugae), and the throat darkening toward the back
              mi = mod(f, Math.max(2.2, hh * 0.35)) < 0.9 ? 4 : 3;
              if (tt < 0.45) mi -= 1;
            } else mi = tt < 0.5 ? 1 : 2;
          }
          let c = R[M_MOUTH * NR + mi];
          // teeth
          if (teeth === 'fangs') {
            const fl = hh * 0.55 * smoothstep(0.08, 0.45, jaw);
            const ff = f + dUp * 0.4;
            if (dUp < fl && Math.abs(ff - hl * 0.84) < 0.75) c = R[M_TOOTH * NR + (dUp > fl * 0.7 ? 6 : 5)];
            if (dLo < 1.2 && mod(pf, 2.2) < 0.9 && pf > hl * 0.3) c = R[M_TOOTH * NR + 4];
          } else if (teeth === 'croc') {
            const up = mod(f - fh, toothSp);
            const ti = Math.floor((f - fh) / toothSp);
            const tl = 1.2 + (ti % 3 === 1 ? 1 : 0) + (ti === 3 || ti === 11 ? 1.2 : 0);
            if (dUp < tl * (1 - Math.abs(up - toothSp * 0.5) / (toothSp * 0.5) * 0.8) && Math.abs(up - toothSp * 0.5) < toothSp * 0.36) c = R[M_TOOTH * NR + (dUp < 0.8 ? 4 : 6)];
            const lo = mod(pf - fh + toothSp * 0.5, toothSp);
            const tj = Math.floor((pf - fh + toothSp * 0.5) / toothSp);
            const tl2 = 1.1 + (tj % 3 === 2 ? 0.9 : 0) + (tj === 12 ? 1.2 : 0);
            if (dLo < tl2 * (1 - Math.abs(lo - toothSp * 0.5) / (toothSp * 0.5) * 0.8) && Math.abs(lo - toothSp * 0.5) < toothSp * 0.36 && pf < hl * 0.97) c = R[M_TOOTH * NR + 5];
          } else if (teeth === 'needle') {
            if ((dUp < 1 && mod(f, 2) < 1 && f > hl * 0.3) || (dLo < 1 && mod(pf + 1, 2) < 1 && pf > hl * 0.3)) c = R[M_TOOTH * NR + 4];
          }
          data[idx] = c;
          continue;
        }
        // ---- form: the head's own cross-section (flat cheek, a crown plane meeting it at the canthus,
        // the jaw rounding under), the snout turning forward at the tip, a dome over the jaw muscles /
        // venom glands, the eye sitting in its socket under the brow
        const hv = (2 * pu - (ptp + pbt)) / Math.max(1, ptp - pbt);
        const v = hv < -1 ? -1 : hv > 1 ? 1 : hv;
        const hvi = ((v + 1) * (LUTN / 2) + 0.5) | 0;
        const tk = smoothstep(tipStart, 1.02, pf / hl);
        const hN = HN[hvi] * (1 - tk * 0.35), hZ = HZ[hvi];
        let gx = ux * hN + fx * tk * 0.8, gy = uy * hN + fy * tk * 0.8;
        // the jowl dome
        const jdf = pf - jF, jdu = pu - jU;
        const jd2 = (jdf * jdf + jdu * jdu) / (jR * jR);
        if (jd2 < 1 && jA > 0) {
          const k2 = (1 - jd2) * jA * 0.7 / jR;
          gx += (fx * jdf + ux * jdu) * k2; gy += (fy * jdf + uy * jdu) * k2;
        }
        // the eye socket: a shallow bowl round the eye
        const edf = pf - eyeF, edu = pu - eyeU;
        const ed2 = edf * edf + edu * edu;
        if (ed2 < sockR * sockR && ed2 > er * er) {
          const k3 = -0.55 / sockR;
          gx += (fx * edf + ux * edu) * k3; gy += (fy * edf + uy * edu) * k3;
        }
        const lum = gx * FX + gy * FY + hZ * FZ * (1 - tk * 0.25);
        let lvl = (0.5 + 0.5 * lum) * 7 - 1;
        let mat = M_BASE;
        const tt = pf / hl;
        if (part === 2) {
          mat = M_THROAT;
          lvl = lvl * 0.85 + 0.95;
          if (this.patId === P_CROC && pu > pmo - hh * 0.55) {
            // the iron jaw: the mandible's flank in rust-dark armour, a pale line along its lower edge
            mat = M_PAT2; lvl = (0.5 + 0.5 * lum) * 7 - 1.2;
            if (mod(pf * 0.5 + Math.floor((pmo - pu) / 1.6) * 0.5, 1) < 0.22 && pmo - pu > 0.9) lvl -= 1;
          }
          if (H.labials && pu > pmo - labH && mod(pf, labSp) < 0.9 && pf > fh) lvl -= 1.3;
          // the gular fold under a salamander's throat
          if (L.head === 'salamander' && Math.abs(pf - fh - hh * 0.35) < 0.6 && pu < pmo - 0.8) lvl -= 1.4;
        } else {
          if (labH > 0 && pu - pmo < labH && pf > fh) {
            // supralabials: a row of lip scales turned out to the light, each seam a dark notch, boas
            // with a heat pit in every scale toward the snout
            mat = M_THROAT;
            lvl = lvl * 0.6 + 2.3 + (pu - pmo > labH * 0.5 ? 0.5 : -0.2);
            const lm = mod(pf + labSp * 0.5, labSp);
            if (lm < 0.9) lvl -= 1.4;
            else if (pitsLab && tt > 0.42 && tt < 0.94 && lm > labSp * 0.45 && lm < labSp * 0.45 + 1 && pu - pmo > labH * 0.35) { mat = M_PAT; lvl = 0.6; }
          } else if (this.patId === P_COUNTER && v < -0.1) {
            mat = M_BELLY; lvl = lvl * 0.6 + 2.4;
          }
          // markings: a postocular stripe from the eye down to the jaw angle, edged pale above
          if (mark === 'postocular' && mat === M_BASE) {
            const lx = (pf - eyeF) / Math.max(1, eyeF - fh + hh * 0.4); // 0 at the eye .. -1 at the jaw angle
            if (lx < 0.15 && lx > -1.15) {
              const cu = eyeU - er * 0.2 + (lx < 0 ? lx : 0) * (eyeU - pmo - hh * 0.05);
              const half = Math.min(hh * 0.08 + 0.45, 1.25);
              const dd = pu - cu;
              if (dd > -half && dd < half) { mat = M_PAT; lvl -= dd > half - 1 ? -0.4 : 0.3; }
              else if (dd >= half && dd < half + 1.05 && hh >= 3.5) lvl += 1.1;
            }
          } else if (mark === 'mask' && mat === M_BASE && Math.abs(pu - eyeU) < er + 0.6 && pf > eyeF - hh * 1.2 && pf < eyeF + er * 1.6) mat = M_PAT;
          // crown plates on big heads
          if (detail >= 1 && hh >= 5.5 && mat === M_BASE && pu > ptp - hh * 0.55 && L.head !== 'croc') {
            const a = pf / (hh * 0.55), b = (ptp - pu) / (hh * 0.3);
            if (mod(a + Math.floor(b) * 0.5, 1) < 0.12 || mod(b, 1) < 0.14) lvl -= 1.1;
          }
          if (L.head === 'leviathan' && detail >= 1 && mat !== M_PAT) {
            // the lateral-line pores: rows of sensory pits along the jaw and under the eye
            const r1 = pmo + Math.max(2, hh * 0.12), r2 = eyeU - er - Math.max(2, hh * 0.14);
            if ((Math.abs(pu - r1) < 0.6 || (Math.abs(pu - r2) < 0.6 && pf < eyeF + er && pf > eyeF - hh)) && mod(pf, 3.2) < 1 && tt > 0.2 && tt < 0.92) lvl -= 1.6;
          }
          if (L.head === 'croc' && detail >= 1) {
            // skull table plates over the back, the snout's rough skin: rows of dark sensory pits along
            // the jaw, ridged skin on top, a pale band along the upper jaw's edge
            if (tt < 0.26 && pu > ptp - hh * 0.5) {
              const a = (pf + hl * 0.08) / (hh * 0.5), b = (ptp - pu) / (hh * 0.26);
              if (mod(a + (Math.floor(b) & 1) * 0.5, 1) < 0.16 || mod(b, 1) < 0.18) lvl -= 1.2;
              else if (mod(b, 1) > 0.7) lvl += 0.4;
            } else if (tt >= 0.26 && tt < 0.97) {
              const row = Math.floor((pu - pmo) / 1.7);
              const ph = mod(pf * 0.5 + row * 0.57, 1);
              if (pu - pmo > 0.9 && pu < ptp - 0.9 && row < 3 && ph < 0.24 && hash2(Math.floor(pf * 0.5), row, this.seed) > 0.3) lvl -= 1.1;
              if (pu > ptp - hh * 0.25 && mod(pf, 2.6) < 0.8) lvl -= 0.6;
              if (pu - pmo < 1.2) { lvl += 0.6; }
            }
          }
        }
        // form: the canthus (the edge where the crown turns down to the side) catches the light from the
        // eye to the snout; the cheek under the eye and behind the jaw angle falls into shadow
        if (part === 1 && detail >= 1 && hh >= 2.6 && mat === M_BASE) {
          const can = ptp - Math.max(1, hh * 0.22);
          if (Math.abs(pu - can) < Math.max(0.5, hh * 0.07) && pf > eyeF - er && tt < 0.96) lvl += 0.9;
          else if (pu < eyeU - er * 0.6 && pf < eyeF + er * 1.6) lvl -= 0.35;
          if (pf < fh + hh * 0.3 && pf > -back * 0.5 && pu < (eyeU + pmo) * 0.5) lvl -= 0.3; // the jaw angle's hollow
        }
        // head scalation (side view): plates on the upper head (rostral, nasal, loreal, pre- and
        // postoculars, the supraocular shield over the eye, internasals, prefrontal, parietals,
        // temporals), small granular scales on a boa's crown, infralabials, chin shields and gular
        // scales under the jaw. Each plate is a cell with a dark seam and a lit upper half.
        if (detail >= 1 && hh >= 2.6 && mat !== M_PAT) {
          const de2 = (pf - eyeF) ** 2 + (pu - eyeU) ** 2;
          if (part === 1 && de2 > (er + 0.9) ** 2) {
            const hgt = Math.max(1, ptp - pmo);
            const ub = (pu - pmo) / hgt;
            const lab = H.labials ? Math.max(1.1, hh * 0.24) : 0;
            if (pu - pmo >= lab && pf > -back * 0.3) {
              let d1 = 1e9, d2 = 1e9, su = 0;
              if (L.head === 'blunt' || L.head === 'leviathan' || L.head === 'salamander' || L.head === 'croc' || L.head === 'gecko') {
                // small scales on a jittered grid, larger over the eye (the supraocular) and at the snout
                const cs = Math.max(2.1, hh * (L.head === 'blunt' ? 0.3 : L.head === 'leviathan' ? 0.2 : 0.4));
                const gi = Math.floor(pf / cs), gj = Math.floor(pu / (cs * 0.85));
                for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) {
                  const cx = (gi + ii + 0.5 + (hash2(gi + ii, gj + jj, this.seed + 3) - 0.5) * 0.6) * cs;
                  const cy = (gj + jj + 0.5 + (hash2(gj + jj, gi + ii, this.seed + 4) - 0.5) * 0.6) * cs * 0.85;
                  const ddf = pf - cx, ddu = pu - cy;
                  const d = Math.sqrt(ddf * ddf + ddu * ddu);
                  if (d < d1) { d2 = d1; d1 = d; su = cy; } else if (d < d2) d2 = d;
                }
                const so = Math.hypot(pf - eyeF, (pu - (eyeU + er * 1.4)) * 1.4);
                if (so < er * 1.25) { d1 = so; d2 = er * 1.25 + 1; su = eyeU + er * 1.4; }
              } else {
                const E = H.eyeT;
                const seeds = HEAD_PLATES(E);
                for (let i = 0; i < seeds.length; i += 2) {
                  const sx = seeds[i] * hl, sy = pmo + seeds[i + 1] * hgt;
                  const ddf = pf - sx, ddu = (pu - sy) * 1.15;
                  const d = Math.sqrt(ddf * ddf + ddu * ddu);
                  if (d < d1) { d2 = d1; d1 = d; su = sy; } else if (d < d2) d2 = d;
                }
              }
              if (d2 - d1 < (hh >= 6 ? 0.9 : 0.65)) lvl -= hh >= 5 ? 1.0 : 0.75;
              else lvl += pu > su ? 0.35 : -0.12;
            }
            // the shadow under the supraocular's overhang, and its lit rim above
            const dfE = Math.abs(pf - eyeF);
            if (dfE < er * 1.35 && pu > eyeU + er * 0.85 && pu < eyeU + er * 0.85 + Math.max(1, hh * 0.12)) lvl -= 1.2;
          } else if (part === 2 && pf > fh) {
            // under the jaw: infralabials along the lip, then chin shields and rows of gular scales
            const depth = pmo - pu;
            const labD = Math.max(1.2, hh * 0.28);
            if (depth > labD) {
              const gs = Math.max(2, hh * 0.32);
              const ga = (pf + (Math.floor(depth / (gs * 0.8)) & 1) * gs * 0.5) / gs;
              const ca = mod(ga, 1), cb = mod(depth, gs * 0.8) / (gs * 0.8);
              if (ca * gs < 0.6 || cb * gs * 0.8 < 0.55) lvl -= 0.5;
              else lvl += cb < 0.5 ? 0.2 : -0.1;
            }
          }
        }
        // edges read as form: top edge catches light, mouth line dark
        if (part === 1 && pu - pmo < 0.75 && pf > fh * 0.5 && tt < 0.97) { mat = M_BASE; lvl = 0.3; }
        if (part === 2 && pmo - pu < 0.6 && jaw > 0.05 && pf > fh) lvl -= 1.5;
        if (glossy > 0 && v > 0.2 && v < 0.55 && tt > 0.2 && tt < 0.8) lvl += glossy * 1.5;
        let li3 = (lvl + 0.5) | 0; if (lvl < 0) li3 = 0; else if (li3 > 7) li3 = 7;
        data[idx] = R[mat * NR + li3];
      }
    }
    // ---- features
    const at = (f: number, u: number): V => [ox0 + fx * f + ux * u, oy0 + fy * f + uy * u];
    if (top) {
      // two eyes bulging at the sides, nostrils at the tip
      const hwE = LT[lut(eyeF)] * H.topW;
      for (const sgn of [1, -1]) {
        const [ex, ey] = at(eyeF, sgn * (hwE - er * 0.25));
        this.drawEye(buf, Math.floor(ex) + 0.5, Math.floor(ey) + 0.5, er * 0.9, fx, fy, sgn * ux, sgn * uy, eyeState, L.pupil ?? H.pupil, true);
        const [nx2, ny2] = at(hl * 0.9, sgn * LT[lut(hl * 0.9)] * H.topW * 0.45);
        buf.set(nx2, ny2, R[M_BASE * NR + 0]);
      }
      return;
    }
    // brow ridge highlight & horns
    if (browK > 0.25) {
      for (let f = eyeF - er * 1.6; f <= eyeF + er * 1.3; f += 0.5) {
        const tp = LT[lut(f)];
        const [bx, by] = at(f, tp - 0.6);
        buf.paint(bx, by, R[M_BASE * NR + 6]);
        if (browK > 0.9 && hh >= 4) {
          const [sx, sy] = at(f, tp - 1.6);
          buf.paint(sx, sy, R[M_BASE * NR + 5]);
        }
      }
    }
    if (L.horns) {
      const tp = LT[lut(eyeF)];
      const hlen = L.horns;
      for (let i = 0; i <= hlen * 2; i++) {
        const t = i / (hlen * 2);
        const [hx, hy] = at(eyeF - er * 0.3 - t * hlen * 0.55, tp - 0.3 + t * hlen);
        buf.set(hx, hy, R[M_BASE * NR + (t > 0.6 ? 6 : 4)]);
      }
    }
    // nostril: a dark opening in the nasal scale, its rim catching the light above and in front
    const nosU = L.nostrilTop ? LT[lut(hl * H.nos[0])] - 0.6 : H.nos[1] * hh;
    const [nx0, ny0] = at(hl * H.nos[0], nosU);
    if (hh >= 3.5) {
      const [rx, ry] = at(hl * H.nos[0] + 0.6, nosU + 0.9);
      buf.paint(rx, ry, R[M_BASE * NR + 6]);
    }
    buf.paint(nx0, ny0, R[M_BASE * NR + 0]);
    if (hh >= 6) {
      const [nx1, ny1] = at(hl * H.nos[0] - 1, nosU);
      buf.paint(nx1, ny1, R[M_BASE * NR + 0]);
    }
    if (L.pits) {
      if (L.head === 'viper' || L.head === 'raptor' || L.head === 'slim') {
        // the loreal pit: a deep dark pocket between nostril and eye, its upper rim lit
        const pf0 = (hl * H.nos[0] + eyeF + er) * 0.5, pu0 = (nosU + eyeU) * 0.5 - Math.max(0.6, hh * 0.18);
        const [px2, py2] = at(pf0, pu0);
        buf.paint(px2, py2, R[M_PAT * NR + 0]);
        if (hh >= 4.5) buf.paint(px2 - fx, py2 - fy, R[M_PAT * NR + 0]);
        const [qx, qy] = at(pf0, pu0 + 1);
        buf.paint(qx, qy, R[M_BASE * NR + 6]);
      } else if (hh < 4) {
        for (let i = 0; i < 4; i++) {
          const f = hl * (0.52 + i * 0.1);
          const [px2, py2] = at(f, LM[lut(f)] + Math.max(1.1, hh * 0.18));
          buf.paint(px2, py2, R[M_PAT * NR + 0]);
        }
      }
    }
    // croc: the ear lid behind the eye, the enlarged teeth showing along the closed jaws
    if (L.head === 'croc') {
      for (let i = 0; i < 4; i++) {
        const [ex, ey] = at(eyeF - er * 1.8 - i * 0.9, eyeU - er * 0.1 - i * 0.12);
        buf.paint(ex, ey, R[M_BASE * NR + 0]);
        const [ex2, ey2] = at(eyeF - er * 1.8 - i * 0.9, eyeU - er * 0.1 - i * 0.12 + 1);
        buf.paint(ex2, ey2, R[M_BASE * NR + 5]);
      }
      if (jaw < 0.12 && hh >= 4) this.crocTeeth(buf, at, LM, lut, hl, hh, fh);
    }
    // eye (open/alert/angry/closed)
    const [ex, ey] = at(eyeF, eyeU);
    this.drawEye(buf, Math.floor(ex) + 0.5, Math.floor(ey) + 0.5, er, fx, fy, ux, uy, eyeState, L.pupil ?? H.pupil, false);
    void time;
  }

  /** the crocodile's interlocking teeth, visible with the jaws shut: uppers hang over the lower lip, the
   *  lowers stand up into notches, the big fourth mandibular tooth at the snout's waist */
  private crocTeeth(buf: PixelBuffer, at: (f: number, u: number) => V, LM: Float32Array, lut: (f: number) => number,
    hl: number, hh: number, fh: number) {
    const R = this.R;
    const sp = Math.max(2, hl / 16);
    const lit = R[M_TOOTH * NR + 6], mid = R[M_TOOTH * NR + 4], dk = R[M_TOOTH * NR + 2];
    for (let f = fh + hl * 0.3, i = 0; f < hl * 0.97; f += sp, i++) {
      const mo = LM[lut(f)];
      const t = f / hl;
      const big = Math.abs(t - 0.6) < 0.035 || Math.abs(t - 0.88) < 0.03;
      const len = (big ? 2.2 : 1.2) * Math.min(1.4, hh / 7) + (i % 3 === 1 ? 0.5 : 0);
      if (i & 1) {
        // upper tooth hanging down past the lip
        for (let q = 0; q < len; q += 0.5) { const [x, y] = at(f, mo - 0.4 - q); buf.paint(x, y, q < 0.6 ? mid : lit); }
        const [x2, y2] = at(f - 0.6, mo - 0.6); buf.paint(x2, y2, dk);
      } else {
        // lower tooth standing up over the upper lip
        for (let q = 0; q < len; q += 0.5) { const [x, y] = at(f, mo + 0.4 + q); buf.paint(x, y, q < 0.6 ? mid : lit); }
      }
    }
  }

  /**
   * Eye in head space: iris ramp lit from below, slit or round pupil, rim, lid/brow line, highlight.
   * state: open (default), alert (wide, dilated, no lid), angry (narrowed under a slanted brow), closed.
   */
  private drawEye(buf: PixelBuffer, cx: number, cy: number, er: number, fx: number, fy: number, ux: number, uy: number,
    state: EyeState, pupil: 'slit' | 'round', topView: boolean) {
    const R = this.R;
    const data = buf.data, W = buf.w;
    const x0 = Math.floor(cx - er - 1.5), x1 = Math.ceil(cx + er + 1.5), y0 = Math.floor(cy - er - 1.5), y1 = Math.ceil(cy + er + 1.5);
    const dark = R[M_BASE * NR + 0];
    const lidC = R[M_BASE * NR + 2];
    const pupilC = hex('#0b0706');
    const big = er >= 2.2;
    for (let y = Math.max(0, y0); y <= Math.min(buf.h - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const ef = dx * fx + dy * fy, eu = dx * ux + dy * uy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const idx = y * W + x;
        if ((data[idx] >>> 24) === 0) continue;
        if (d > er + 0.75) continue;
        if (d > er) { data[idx] = tint(data[idx], 0.45); continue; } // socket
        let lid: number;
        let lidLow = -er * 1.2;
        if (state === 'alert') lid = er * 1.2;
        else if (state === 'angry') { lid = er * (0.12 - 0.55 * (ef / er)); lidLow = -er * 0.72; }
        else if (state === 'closed') lid = -er * 0.05;
        else lid = er * (topView ? 1.2 : 0.62);
        if (state === 'closed') {
          // lid skin with a dark closed-lid crease
          data[idx] = Math.abs(eu - lid) < 0.55 ? dark : eu > lid ? lidC : R[M_BASE * NR + 3];
          continue;
        }
        if (eu > lid) { data[idx] = eu - lid < 0.9 ? dark : lidC; continue; }
        if (eu < lidLow) { data[idx] = lidC; continue; }
        // iris: lighter toward the bottom (light passes through the lens), darker under the lid
        let lv = 4 + (-eu / er) * 1.8 - (lid - eu < 1 ? 1.4 : 0);
        if (d > er - 0.55 && big) lv -= 1.6;
        let c = R[M_EYE * NR + clamp(Math.round(lv), 0, 7)];
        // pupil
        const alert = state === 'alert';
        if (pupil === 'slit') {
          const pw = alert ? (big ? 1.1 : 0.9) : big ? 0.6 : 0.55;
          if (Math.abs(ef) < pw && Math.abs(eu) < er * 0.95) c = pupilC;
        } else if (d < er * (alert ? 0.62 : 0.46) + (big ? 0 : 0.2)) c = pupilC;
        data[idx] = c;
      }
    }
    // specular highlight top-left (screen space), unless covered by the lid
    if (state !== 'closed') {
      const hx = cx - er * 0.42, hy = cy - er * 0.42;
      const cover = state === 'angry' ? 0.3 : 0.62;
      const hu = (hx - cx) * ux + (hy - cy) * uy;
      if (hu < er * cover || state === 'alert') {
        buf.paint(hx, hy, hex('#fbf6ea'));
        if (big) buf.paint(hx + 1, hy, hex('#e8e2d6'));
        if (er >= 3) buf.paint(cx + er * 0.35, cy + er * 0.4, hex('#d8d4c8'));
      } else buf.paint(cx - er * 0.4, cy, hex('#e8e2d6'));
    }
  }

  /** forked tongue flicking from the snout */
  private drawTongue(buf: PixelBuffer, st: SerpentState, time: number) {
    const L = this.look;
    if (L.head === 'croc' || L.head === 'leviathan' || L.head === 'salamander' || L.head === 'gecko') return;
    const { ox0, oy0, fx, fy, ux, uy } = this.headFrame(st);
    const hl = this.hl, hh = this.hh;
    const col = L.tongueCol ?? hex('#c7354a');
    const dark = shadeCache(col);
    const len = Math.max(2, hh * 2.1 * clamp(st.tongue));
    const jawDrop = clamp(st.jaw) * this.hs.jaw * hl * 0.5;
    const bx = ox0 + fx * (hl - 0.5) + ux * (this.hs.mo[this.hs.mo.length - 1] * hh - 0.6 - jawDrop * 0.2);
    const by = oy0 + fy * (hl - 0.5) + uy * (this.hs.mo[this.hs.mo.length - 1] * hh - 0.6 - jawDrop * 0.2);
    const wob = Math.sin(time * 38) * 0.9;
    const fork = Math.max(1.5, len * 0.3);
    const stem = len - fork;
    const steps = Math.ceil(stem * 2);
    let x = bx, y = by;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bend = wob * t * t;
      x = bx + fx * stem * t + ux * (bend - t * 0.6);
      y = by + fy * stem * t + uy * (bend - t * 0.6);
      buf.set(x, y, col);
    }
    for (const sgn of [1, -1]) {
      const fs = Math.ceil(fork * 2);
      for (let i = 1; i <= fs; i++) {
        const t = i / fs;
        buf.set(x + fx * fork * t + ux * sgn * t * fork * 0.55 + ux * wob * 0.4 * t, y + fy * fork * t + uy * sgn * t * fork * 0.55 + uy * wob * 0.4 * t, t > 0.6 ? dark : col);
      }
    }
  }

  // ================================================================ post
  /** selective tinted outline: lighter on lit top edges, darkest under the body */
  private outline(buf: PixelBuffer) {
    const W = buf.w, H = buf.h, d = buf.data;
    const m = Math.ceil(this.margin() + 2);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let k = 0; k < this.n; k++) {
      const x = this.PX[k], y = this.PY[k];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.max(0, Math.floor(x0 - m)); x1 = Math.min(W - 1, Math.ceil(x1 + m));
    y0 = Math.max(0, Math.floor(y0 - m)); y1 = Math.min(H - 1, Math.ceil(y1 + m));
    let cnt = 0;
    for (let y = y0; y <= y1; y++) {
      let idx = y * W + x0;
      for (let x = x0; x <= x1; x++, idx++) {
        if ((d[idx] >>> 24) !== 0) continue;
        let c = -1;
        if (y + 1 < H && (d[idx + W] >>> 24) === 255) c = tint(d[idx + W], 0.62);
        else if (y > 0 && (d[idx - W] >>> 24) === 255) c = tint(d[idx - W], 0.84);
        else if (x > 0 && (d[idx - 1] >>> 24) === 255) c = tint(d[idx - 1], 0.74);
        else if (x + 1 < W && (d[idx + 1] >>> 24) === 255) c = tint(d[idx + 1], 0.74);
        if (c < 0) continue;
        if (cnt >= this.olI.length) {
          const ni = new Int32Array(this.olI.length * 2); ni.set(this.olI); this.olI = ni;
          const nc = new Uint32Array(this.olC.length * 2); nc.set(this.olC); this.olC = nc;
        }
        this.olI[cnt] = idx;
        this.olC[cnt] = c;
        cnt++;
      }
    }
    for (let i = 0; i < cnt; i++) d[this.olI[i]] = this.olC[i];
  }

  /** fade everything below the water line (world y), with a bright waterline row */
  private submerge(buf: PixelBuffer, em: PixelBuffer | null, wyLocal: number) {
    const wy = Math.floor(wyLocal);
    const W = buf.w, H = buf.h, d = buf.data;
    const water = hex('#1d4a55');
    for (let y = Math.max(0, wy); y < H; y++) {
      const depth = y - wy;
      const a = depth === 0 ? 255 : depth < 3 ? 150 : Math.max(55, 110 - depth * 3);
      const k = depth === 0 ? 0 : Math.min(0.75, 0.5 + depth * 0.012);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = d[i];
        if ((c >>> 24) === 0) continue;
        if (depth === 0) d[i] = mix(c, hex('#dff4f0'), 0.35);
        else {
          const m = mix(c, water, k);
          d[i] = ((m & 0x00ffffff) | (Math.min(a, c >>> 24) << 24)) >>> 0;
        }
        if (em) {
          const e = em.data[i];
          if (e >>> 24) em.data[i] = ((e & 0x00ffffff) | ((((e >>> 24) * (depth === 0 ? 1 : 0.6)) | 0) << 24)) >>> 0;
        }
      }
    }
  }

  // ================================================================ glow
  /**
   * World-space emitters for the game's lights: the lure-viper's tail lure and the leviathan's
   * photophores (every second one — enough for point lights / glow sprites). Colours are 0..1
   * floats, k is the relative strength (already multiplied by st.glow).
   */
  glowPoints(st: SerpentState, out: GlowPoint[] = []): GlowPoint[] {
    out.length = 0;
    const L = this.look;
    if (!L.lure && !L.photophores) return out;
    if (!st.pts || st.pts.length < 2) return out;
    const glow = clamp(st.glow ?? 1);
    if (glow <= 0) return out;
    this.ds = clamp(L.radius * 0.12, 0.75, 1.5);
    this.resample(st.pts, 0, 0, st.facing || 1);
    this.widths(st, clamp(st.flatten || 0));
    const total = this.total;
    if (L.lure) {
      const lu = 1 - (L.lureLen ?? 0.07) * 0.45;
      const k = this.sampleAt(lu);
      const c = L.lure;
      out.push([this.PX[k], this.PY[k], (c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255, glow]);
    }
    if (L.photophores) {
      const c = L.photophores;
      const r = (c & 255) / 255, g = ((c >>> 8) & 255) / 255, b = ((c >>> 16) & 255) / 255;
      const sp1 = Math.max(10, L.radius * 0.62) * 2;
      for (let s = sp1 * 0.25; s < total * 0.96; s += sp1) {
        if (s < total * 0.09) continue;
        const k = Math.min(this.n - 1, Math.round(s / this.ds));
        const v = Math.sin(-0.1);
        const pulse = 0.55 + 0.45 * Math.sin(s * 0.035);
        out.push([this.PX[k] + this.NX[k] * this.WW[k] * v, this.PY[k] + this.NY[k] * this.WW[k] * v, r, g, b, glow * 0.35 * pulse]);
      }
    }
    return out;
  }
}

const tongueDark = new Map<number, C>();
function shadeCache(c: C): C {
  let d = tongueDark.get(c);
  if (d === undefined) { d = shade(c, -0.35); tongueDark.set(c, d); }
  return d;
}

/** Uniformly scale a look (length, radius, head, legs, fins) — handy for icons and distant copies. */
export function scaleLook(look: SerpentLook, k: number): SerpentLook {
  const s = (v: number | undefined) => (v === undefined ? undefined : v * k);
  return {
    ...look,
    length: look.length * k,
    radius: look.radius * k,
    headLen: s(look.headLen),
    period: s(look.period),
    legs: look.legs?.map(l => ({ ...l, len: l.len * k, stride: s(l.stride) })),
    dorsalFin: look.dorsalFin ? { ...look.dorsalFin, h: look.dorsalFin.h * k, rays: s(look.dorsalFin.rays) } : undefined,
    ventralFin: look.ventralFin ? { ...look.ventralFin, h: look.ventralFin.h * k, rays: s(look.ventralFin.rays) } : undefined,
    crest: look.crest ? { ...look.crest, h: look.crest.h * k } : undefined,
    dewlap: look.dewlap ? { ...look.dewlap, size: look.dewlap.size * k } : undefined,
    osteoderms: look.osteoderms ? { ...look.osteoderms, len: Math.max(2.5, look.osteoderms.len * k), crest: s(look.osteoderms.crest) } : undefined,
    scale: look.scale ? { ...look.scale, len: s(look.scale.len) } : undefined,
    bellyScute: s(look.bellyScute),
    horns: s(look.horns),
  };
}

/** Follow-the-leader spine update: head moves, body points trail at fixed spacing. */
export function followSpine(pts: [number, number][], spacing: number, stiff = 0) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (stiff > 0 && i > 1) {
      const pa = pts[i - 2];
      const ex = a[0] - pa[0], ey = a[1] - pa[1];
      const el = Math.hypot(ex, ey) || 1, d = Math.hypot(dx, dy) || 1;
      dx = dx * (1 - stiff) + (ex / el) * d * stiff;
      dy = dy * (1 - stiff) + (ey / el) * d * stiff;
    }
    const L = Math.hypot(dx, dy) || 1;
    b[0] = a[0] + (dx / L) * spacing;
    b[1] = a[1] + (dy / L) * spacing;
  }
}

/** Build a straight spine trailing behind the head. */
export function makeSpine(x: number, y: number, facing: number, length: number, spacing: number): [number, number][] {
  const n = Math.max(3, Math.ceil(length / spacing) + 1);
  return Array.from({ length: n }, (_, i) => [x - facing * i * spacing, y] as [number, number]);
}
