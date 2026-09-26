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
  seed?: number;
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
  M_X2 = 16, M_LEG = 17, M_EYE = 18, M_CLAW = 19, M_SHEEN = 20;

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
}
const HEADS: Record<HeadKind, HeadSpec> = {
  viper: {
    w: 1.28, len: 2.25, kt: [-0.24, 0, 0.18, 0.42, 0.64, 0.82, 0.93, 1],
    top: [0.62, 0.86, 0.98, 1, 0.9, 0.7, 0.52, 0.28], bot: [-0.62, -0.95, -1, -0.86, -0.66, -0.5, -0.36, -0.14],
    mo: [-0.32, -0.36, -0.36, -0.32, -0.27, -0.21, -0.15, -0.07],
    hinge: 0.06, jaw: 1.1, eyeT: 0.58, eyeU: 0.4, eyeR: 0.3, brow: 1, nos: [0.9, 0.4], pupil: 'slit', teeth: 'fangs', topW: 1, labials: true,
  },
  raptor: {
    w: 1.18, len: 2.5, kt: [-0.2, 0, 0.2, 0.45, 0.7, 0.88, 1],
    top: [0.6, 0.84, 0.95, 0.9, 0.72, 0.54, 0.3], bot: [-0.6, -0.95, -0.98, -0.8, -0.6, -0.42, -0.14],
    mo: [-0.26, -0.3, -0.3, -0.26, -0.2, -0.14, -0.06],
    hinge: 0.05, jaw: 1.0, eyeT: 0.54, eyeU: 0.42, eyeR: 0.29, brow: 0.9, nos: [0.9, 0.42], pupil: 'slit', teeth: 'fangs', topW: 0.95, labials: true,
  },
  slim: {
    w: 1.12, len: 2.5, kt: [-0.26, 0, 0.3, 0.58, 0.84, 1],
    top: [0.72, 0.88, 0.92, 0.8, 0.56, 0.3], bot: [-0.72, -0.88, -0.82, -0.62, -0.42, -0.15],
    mo: [-0.3, -0.32, -0.28, -0.22, -0.15, -0.05],
    hinge: 0.1, jaw: 0.9, eyeT: 0.56, eyeU: 0.28, eyeR: 0.4, brow: 0.35, nos: [0.9, 0.35], pupil: 'round', teeth: 'needle', topW: 0.85, labials: true,
  },
  blunt: {
    w: 1.06, len: 2.2, kt: [-0.22, 0, 0.25, 0.55, 0.8, 0.93, 1],
    top: [0.78, 0.92, 0.96, 0.87, 0.68, 0.5, 0.28], bot: [-0.78, -0.95, -0.92, -0.76, -0.58, -0.42, -0.14],
    mo: [-0.32, -0.34, -0.32, -0.28, -0.22, -0.15, -0.05],
    hinge: 0.08, jaw: 0.95, eyeT: 0.56, eyeU: 0.36, eyeR: 0.3, brow: 0.6, nos: [0.9, 0.4], pupil: 'round', teeth: 'needle', topW: 0.95, labials: true,
  },
  croc: {
    w: 0.86, len: 4.7, kt: [-0.1, 0, 0.1, 0.19, 0.3, 0.5, 0.74, 0.88, 0.95, 1],
    top: [0.86, 0.94, 1.02, 1.02, 0.78, 0.62, 0.54, 0.56, 0.54, 0.34], bot: [-0.9, -1.02, -1.04, -0.96, -0.84, -0.62, -0.5, -0.44, -0.38, -0.24],
    mo: [-0.16, -0.16, -0.17, -0.18, -0.16, -0.1, -0.06, -0.04, -0.02, 0.02],
    hinge: 0.03, jaw: 0.8, eyeT: 0.16, eyeU: 0.72, eyeR: 0.2, brow: 1.2, nos: [0.95, 0.5], pupil: 'slit', teeth: 'croc', topW: 0.8, labials: false,
  },
  leviathan: {
    w: 0.96, len: 2.3, kt: [-0.16, 0, 0.3, 0.6, 0.85, 1],
    top: [0.9, 1, 0.96, 0.8, 0.6, 0.34], bot: [-0.9, -1, -0.95, -0.78, -0.56, -0.26],
    mo: [-0.14, -0.2, -0.18, -0.12, -0.06, 0.0],
    hinge: 0.14, jaw: 0.75, eyeT: 0.62, eyeU: 0.34, eyeR: 0.2, brow: 0.5, nos: [0.93, 0.35], pupil: 'round', teeth: 'needle', topW: 0.9, labials: false,
  },
  eel: {
    w: 1.02, len: 2.3, kt: [-0.24, 0, 0.3, 0.6, 0.85, 1],
    top: [0.8, 0.9, 0.9, 0.78, 0.56, 0.3], bot: [-0.8, -0.9, -0.85, -0.66, -0.45, -0.18],
    mo: [-0.3, -0.32, -0.28, -0.22, -0.14, -0.05],
    hinge: 0.1, jaw: 0.8, eyeT: 0.6, eyeU: 0.5, eyeR: 0.24, brow: 0.2, nos: [0.9, 0.62], pupil: 'round', teeth: 'needle', topW: 0.9, labials: true,
  },
  gecko: {
    w: 1.25, len: 2.4, kt: [-0.2, 0, 0.3, 0.6, 0.85, 1],
    top: [0.72, 0.9, 0.94, 0.76, 0.52, 0.26], bot: [-0.7, -0.86, -0.82, -0.62, -0.42, -0.18],
    mo: [-0.2, -0.22, -0.22, -0.2, -0.13, -0.05],
    hinge: 0.05, jaw: 0.7, eyeT: 0.46, eyeU: 0.26, eyeR: 0.44, brow: 0.4, nos: [0.92, 0.3], pupil: 'slit', teeth: 'none', topW: 0.9, labials: false,
  },
  salamander: {
    w: 1.05, len: 1.9, kt: [-0.2, 0, 0.3, 0.6, 0.85, 1],
    top: [0.72, 0.86, 0.92, 0.82, 0.64, 0.34], bot: [-0.72, -0.9, -0.86, -0.72, -0.52, -0.24],
    mo: [-0.06, -0.1, -0.17, -0.18, -0.13, -0.05],
    hinge: 0.02, jaw: 0.6, eyeT: 0.55, eyeU: 0.62, eyeR: 0.26, brow: 0.1, nos: [0.93, 0.45], pupil: 'round', teeth: 'none', topW: 1.1, labials: false,
  },
};

// scratch outputs of the pattern function (avoid per-pixel allocation)
let _mat = 0, _off = 0;

interface LegPose {
  hx: number; hy: number; kx: number; ky: number; ax: number; ay: number; fx: number; fy: number;
  dx: number; dy: number; lift: number; far: boolean; front: boolean; side: number;
  r0: number; r1: number; r2: number; r3: number; spec: LegSpec; drawn: boolean; top: boolean;
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
    this.R = new Uint32Array(ramps.length * NR);
    for (let m = 0; m < ramps.length; m++) for (let i = 0; i < NR; i++) this.R[m * NR + i] = ramps[m][i];

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
      this.poses.push({ hx: 0, hy: 0, kx: 0, ky: 0, ax: 0, ay: 0, fx: 0, fy: 0, dx: 1, dy: 0, lift: 0, far: false, front: true, side: 1, r0: 1, r1: 1, r2: 1, r3: 1, spec: L.legs![i >> 1], drawn: false, top: false });
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
    }

    // ---- 7. front layer
    if (!this.topView) {
      this.drawLegs(buf, false, false);
      if (L.pectoral) this.drawPectoral(buf, time, false);
      if (L.gills) this.drawGills(buf, time, false);
    }
    if (L.dewlap && (st.dewlap ?? 0) > 0.02) this.drawDewlap(buf, st, clamp(st.dewlap ?? 0));
    this.drawHead(buf, st, time, detail);

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
    const n = this.n, PX = this.PX, PY = this.PY, NX = this.NX, NY = this.NY, WW = this.WW, ds = this.ds;
    for (let k = n - 2; k >= 0; k--) {
      const k1 = k + 1;
      const s0 = k * ds, s1 = k1 === n - 1 ? this.total : k1 * ds;
      const w0 = WW[k], w1 = WW[k1];
      const lx0 = PX[k] + NX[k] * w0, ly0 = PY[k] + NY[k] * w0, rx0 = PX[k] - NX[k] * w0, ry0 = PY[k] - NY[k] * w0;
      const lx1 = PX[k1] + NX[k1] * w1, ly1 = PY[k1] + NY[k1] * w1, rx1 = PX[k1] - NX[k1] * w1, ry1 = PY[k1] - NY[k1] * w1;
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
    const lureU = L.lure ? 1 - (L.lureLen ?? 0.07) : 2;
    const sheenN = this.nSheen;
    const photo = !!L.photophores;
    const scars = this.scars.length > 0 && detail >= 2;
    const scaleOn = detail >= 1 && this.scaleId !== S_NONE;
    const hideS = this.hl * 0.1; // pattern starts behind the head
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
        // lighting
        const vn = v * flatN;
        const nz = flatN < 1 ? Math.sqrt(1 - vn * vn) : SQRT1[vi];
        const nxv = NX[k] * vn, nyv = NY[k] * vn;
        let lum = nxv * LX + nyv * LY + nz * LZ;
        let phi = ASIN[vi] + roll;
        if (phi > HALF_PI) phi = Math.PI - phi;
        const u = s / total;
        const w = WW[k];
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
        } else if (s < hideS) {
          _mat = phi < this.phiB ? M_THROAT : M_BASE;
          _off = 0;
        } else {
          this.pattern(s, phi, u, w, k, x, y, time);
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
        // ---- scales
        let sc = 0;
        if (scaleOn && _mat !== M_MOSS && _mat !== M_LURE) sc = this.scaleTex(s, phi, w, k, SWK[k], detail, x, y);
        // ---- scars
        if (scars && _mat !== M_BELLY) {
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
        let lvl = (0.5 + 0.5 * lum) * 7 - 1 + _off + sc;
        if (_mat === M_BELLY || _mat === M_THROAT) lvl = lvl * 0.55 + 2.6 + _off * 0.45;
        // rim light: underside / back edge facing away from the key light
        const av = v < 0 ? -v : v;
        if (av > 0.8) {
          const side = (v > 0 ? 1 : -1) * (NX[k] * L2X + NY[k] * L2Y);
          if (side < -0.25) lvl += (av - 0.8) * 9 * Math.min(1, -side);
        }
        // wet specular streak
        if (wet > 0) {
          const spec = nxv * HX + nyv * HY + nz * HZ;
          if (spec > 0.985 - wet * 0.03) lvl += 1.2 + wet * 1.3;
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
        if (s > coilT) {
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
        const d = Math.hypot((m - P * (0.3 + off * 0.4)) / (P * 0.32), (q - 0.45) / 0.55);
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
        if (st < 0.34) _off = -0.9; else if (st > 0.7) _off = 0.6;
        const m = mod(s + (1 - q) * P * 0.45, P);
        if (q > 0.05 && m < 1.3) { _mat = M_PAT; _off = 0; }
        else if (q > 0.05 && m < 2.1) _off += 0.8;
        if (hash2(Math.floor(s / 1.5), Math.floor(phi * w / 1.5), seed + 5) > 0.93) { _mat = M_PAT2; _off = 0; }
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
        if (isBelly) { _mat = M_BELLY; return; }
        if (u > 0.4) {
          const m = mod(s + (noise1(s * 0.2, seed) - 0.5) * 3, P);
          if (m < P * 0.32 && q > -0.5) { _mat = M_PAT; if (m < 1) _off = -0.5; return; }
        }
        const nm = noise2(s * 0.13, q * 2.5, seed);
        if (q < 0.3 && nm < 0.3) _mat = M_PAT;
        else if (nm > 0.74) _off = 0.5;
        return;
      }
      case P_SKIN: {
        // amphibian: darker back, pale spots and a scatter of pores
        if (isBelly) { _mat = M_BELLY; return; }
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
    const cosPhi = Math.cos(phi);
    if (id === S_OSTEO) {
      const O = L.osteoderms;
      const rows = O?.rows ?? 5, len = O?.len ?? 5;
      const p0 = -0.35;
      if (phi < p0) {
        // small flank scales below the armour
        const a = s / (len * 0.55), b = (phi + HALF_PI) * w / 2.2;
        const fa = a - Math.floor(a + (Math.floor(b) & 1) * 0.5), fb = b - Math.floor(b);
        return fa < 0.28 || fb < 0.3 ? -0.9 : 0;
      }
      const rh = (HALF_PI - p0) / rows;
      const b = (phi - p0) / rh;
      const row = Math.floor(b);
      const fb = b - row;
      const a = s / len + (row & 1) * 0.5 * (row < rows - 2 ? 1 : 0);
      const fa = a - Math.floor(a);
      const rowPx = rh * w * cosPhi + 0.4;
      const bpx = fb * rowPx;
      const apx = fa * len;
      if (apx < 1 || bpx < 0.9) return -1.7;
      if (bpx > rowPx - 1.05) return 0.9;
      // central keel along the plate
      if (detail >= 2 && Math.abs(apx - len * 0.55) < len * 0.3 && Math.abs(bpx - rowPx * 0.55) < 0.6) return 1.1;
      return bpx < rowPx * 0.4 ? -0.35 : 0.15;
    }
    // diamond lattice in (s, phi)
    const SL = this.scaleLen, SR = this.scaleRows;
    const a = s / SL, b = ((phi + HALF_PI) * SR) / Math.PI;
    const p = a + b, qq = a - b;
    const fp = p - Math.floor(p), fq = qq - Math.floor(qq);
    const rowPx = (Math.PI / SR) * w * cosPhi; // on-screen scale height
    const small = rowPx < 2.2 || SL < 2.6;
    if (id === S_BEAD || small) {
      // readable granular texture for small bodies: one light bead + one dark notch per scale
      const cx = fp - 0.5, cy = fq - 0.5;
      if (fp < 0.2 && fq < 0.2) return -1.1;
      if (id === S_KEELED && Math.abs(cx - cy) < 0.18) return 0.9;
      if (cx * cx + cy * cy < 0.035 && detail >= 2) {
        const lit = (cx + cy) * this.tlS(k) + (cx - cy) * this.nlS(k);
        return lit > 0 ? 0.9 : 0.35;
      }
      return 0;
    }
    // individual scales: dark gap line, lit dome side, shadowed far side
    const gap = 0.1 + swk * 0.22;
    if (fp < gap || fq < gap) {
      if (swk > 0.25) { _mat = M_SKIN; return 0.2; }
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
        const hx = px - nx * w * 0.28 + (far ? nx * 0.8 - tx * f * 0.0 : 0);
        const hy = py - ny * w * 0.28 + (far ? ny * 0.8 : 0);
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
      l1 = len * 0.47; l2 = len * 0.43;
      const foot = len * 0.2;
      const g = P.lift * 0.8 + 0.12;
      ax = fx - f * Math.cos(g) * foot;
      ay = fy - Math.sin(g) * foot;
      P.dx = f * Math.cos(P.lift * 0.7); P.dy = Math.sin(P.lift * 0.7);
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
    const ring = P.r0 > 2.2 ? 2.6 : 0;
    // borders first (so the joints stay clean), then fills
    if (border) {
      this.limb(buf, P.hx, P.hy, P.r0, P.kx, P.ky, P.r1, bias, 1, ring, 0.5);
      this.limb(buf, P.kx, P.ky, P.r1, P.ax, P.ay, P.r2, bias, 1, ring, 0);
      this.limb(buf, P.ax, P.ay, P.r2, P.fx, P.fy, P.r3, bias, 1, 0, 0);
    }
    this.limb(buf, P.hx, P.hy, P.r0, P.kx, P.ky, P.r1, bias, 0, ring, 0);
    this.limb(buf, P.kx, P.ky, P.r1, P.ax, P.ay, P.r2, bias, 0, ring, 0);
    this.limb(buf, P.ax, P.ay, P.r2, P.fx, P.fy, P.r3, bias, 0, 0, 0);
    this.digits(buf, P);
    void sp;
  }

  /**
   * Tapered capsule with cylinder lighting from the leg ramp.
   * mode 0 = shaded fill, 1 = dark border ring (only drawn past `from` along the segment)
   */
  private limb(buf: PixelBuffer, ax: number, ay: number, ar: number, bx: number, by: number, br: number,
    bias: number, mode: number, ring: number, from: number) {
    const R = this.R, data = buf.data, W = buf.w, H = buf.h;
    const grow = mode === 1 ? 1 : 0;
    const x0 = Math.max(0, Math.floor(Math.min(ax - ar, bx - br) - 1 - grow)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax + ar, bx + br) + 1 + grow));
    const y0 = Math.max(0, Math.floor(Math.min(ay - ar, by - br) - 1 - grow)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay + ar, by + br) + 1 + grow));
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-6;
    const len = Math.sqrt(l2);
    const dark = tint(R[M_LEG * NR + 1], 0.55);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay;
        let t = (qx * dx + qy * dy) / l2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const r = ar + (br - ar) * t;
        const cx = qx - dx * t, cy = qy - dy * t;
        const d2 = cx * cx + cy * cy;
        const idx = y * W + x;
        if (mode === 1) {
          const rb = r + 1;
          if (d2 <= rb * rb && t >= from && (data[idx] >>> 24) !== 0) data[idx] = dark;
          continue;
        }
        if (d2 > r * r) continue;
        const nx = cx / r, ny = cy / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lum = nx * LX + ny * LY + nz * LZ;
        let lvl = (0.5 + 0.5 * lum) * 7 - 0.8 + bias;
        if (ring > 0 && mod(t * len, ring) < 0.9 && r > 1.4) lvl -= 1.1;
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
    const dl = Math.max(1.4, len * (top ? 0.2 : 0.2));
    const far = P.far && !top;
    const base = far ? 1 : 3;
    const claw = R[M_CLAW * NR + (far ? 2 : 5)];
    const pad = sp.pads ? R[M_LEG * NR + (far ? 3 : 6)] : 0;
    const count = far ? Math.min(2, nd) : nd;
    const spread = top ? (P.lift > 0.5 ? 0.5 : 1.25) : 0.55;
    for (let i = count - 1; i >= 0; i--) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      let dxv: number, dyv: number;
      if (top) {
        const ang = t * spread * 2;
        const c = Math.cos(ang), sn = Math.sin(ang);
        dxv = P.dx * c - P.dy * sn; dyv = P.dx * sn + P.dy * c;
      } else {
        // side view: toes fan upward from the ground line, the longest one flat on the ground
        const lift = (t + 0.5) * spread;
        dxv = P.dx; dyv = P.dy - lift * 0.9;
      }
      const L2 = Math.hypot(dxv, dyv) || 1;
      dxv /= L2; dyv /= L2;
      const dlen = dl * (top ? 1 - Math.abs(t) * 0.35 : 1 - (t + 0.5) * 0.35);
      const col = R[M_LEG * NR + base + (i === 0 ? 0 : 1)];
      let x = P.fx, y = P.fy;
      const steps = Math.max(1, Math.round(dlen * 2));
      for (let j = 1; j <= steps; j++) {
        x = P.fx + dxv * (j / steps) * dlen;
        y = P.fy + dyv * (j / steps) * dlen;
        buf.set(x, y, col);
      }
      if (pad) buf.set(x + dxv * 0.6, y + dyv * 0.6, pad);
      else if (sp.claw !== undefined || !top) {
        // claw hooks down/forward
        buf.set(x + dxv, y + dyv + (top ? 0 : 0.6), claw);
        if (len > 12) buf.set(x + dxv * 1.8, y + dyv * 1.8 + (top ? 0 : 1.2), claw);
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

  /** side view: patagium folded along the flank between the legs (partly spread with flatten) */
  private drawFoldedPatagia(buf: PixelBuffer, flat: number) {
    const L = this.look;
    const specs = L.legs;
    if (!specs || specs.length < 2) return;
    const k0 = this.sampleAt(Math.min(specs[0].at, specs[1].at)), k1 = this.sampleAt(Math.max(specs[0].at, specs[1].at));
    const R = this.R;
    const drop = 0.6 + flat * 3;
    for (let k = k0; k <= k1; k++) {
      const t = (k - k0) / Math.max(1, k1 - k0);
      const h = Math.sin(t * Math.PI) * drop;
      const w = this.WW[k];
      const bx = this.PX[k] - this.NX[k] * w * 0.72, by = this.PY[k] - this.NY[k] * w * 0.72;
      for (let j = 0; j <= Math.ceil(w * 0.3 + h); j++) {
        const x = bx - this.NX[k] * j, y = by - this.NY[k] * j;
        const edge = j >= Math.ceil(w * 0.3 + h) - 0.5;
        buf.set(x, y, R[(edge ? M_X2 : M_X1) * NR + (edge ? 2 : 3 + (j & 1 ? 0 : 1))]);
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

  /** crocodile: raised dorsal scutes, a double saw-toothed crest on the tail */
  private drawCrestScutes(buf: PixelBuffer, st: SerpentState) {
    const O = this.look.osteoderms!;
    const R = this.R;
    const len = O.len, H = O.crest ?? 0;
    const total = this.total;
    const moss = this.look.moss ? clamp(st.mossy ?? this.look.moss.amount) : 0;
    const sStart = this.hl * 0.15 + 3;
    for (let s = sStart + len * 0.5; s < total - 2; s += len) {
      const u = s / total;
      const k = Math.min(this.n - 1, Math.round(s / this.ds));
      const tail = smoothstep(0.38, 0.5, u);
      const h = (0.9 + tail * H * (1 - smoothstep(0.75, 1, u) * 0.75)) * (u < 0.06 ? 0.4 : 1);
      if (h < 0.6) continue;
      const w = this.WW[k];
      const bx = this.PX[k] + this.NX[k] * (w - 0.6), by = this.PY[k] + this.NY[k] * (w - 0.6);
      const hb = Math.max(1.2, len * 0.42);
      const ax = bx + this.TX[k] * hb * 0.8, ay = by + this.TY[k] * hb * 0.8;   // toward tail
      const cx = bx - this.TX[k] * hb * 0.8, cy = by - this.TY[k] * hb * 0.8;   // toward head
      const tx = bx + this.NX[k] * h + this.TX[k] * h * 0.35, ty = by + this.NY[k] * h + this.TY[k] * h * 0.35;
      const mossy = moss > 0 && noise2(s * 0.16, HALF_PI * 2.6, this.seed) * 0.75 + 0.3 > 1.02 - moss;
      const lit = R[(mossy ? M_MOSS : M_BASE) * NR + 5], dk = R[(mossy ? M_MOSS : M_BASE) * NR + 2];
      buf.polyFn([cx, cy, tx, ty, ax, ay], (x, y) => {
        // lit face toward the head/top, dark face toward the tail
        const side = (x + 0.5 - tx) * this.TX[k] + (y + 0.5 - ty) * this.TY[k];
        return side < 0 ? lit : dk;
      });
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
    const LT = new Float32Array(nL), LB = new Float32Array(nL), LM = new Float32Array(nL);
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
      tp += browK * 0.1 * hh * Math.exp(-de * de);
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
    // bounding box
    const Rb = Math.max(hl, back) + hh * 2 + 4;
    const bx0 = Math.max(0, Math.floor(ox0 - Rb)), bx1 = Math.min(buf.w - 1, Math.ceil(ox0 + Rb));
    const by0 = Math.max(0, Math.floor(oy0 - Rb)), by1 = Math.min(buf.h - 1, Math.ceil(oy0 + Rb));
    const data = buf.data, W = buf.w;
    const labSp = Math.max(2, hh * 0.55);
    const toothSp = Math.max(2, hl / 15);
    const teeth = L.teeth ?? H.teeth;
    const mark = L.headMark ?? 'none';
    const tipStart = 0.78;
    const glossy = clamp(st.wet ?? L.wet ?? 0);
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
          let c = R[M_MOUTH * NR + (depth < 1 ? 5 : depth < 2.2 ? 4 : tt < 0.35 ? 1 : 2)];
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
        // lighting on a rounded head
        const hv = (2 * pu - (ptp + pbt)) / Math.max(1, ptp - pbt);
        const v = hv < -1 ? -1 : hv > 1 ? 1 : hv;
        const tk = smoothstep(tipStart, 1.02, pf / hl);
        const nzz = Math.sqrt(Math.max(0.02, 1 - v * v * (1 - tk * 0.4)));
        const nfx = fx * tk * 0.75, nfy = fy * tk * 0.75;
        const lum = (ux * v + nfx) * LX + (uy * v + nfy) * LY + nzz * LZ * (1 - tk * 0.25);
        let lvl = (0.5 + 0.5 * lum) * 7 - 1;
        let mat = M_BASE;
        const tt = pf / hl;
        if (part === 2) {
          mat = M_THROAT;
          lvl = lvl * 0.55 + 2.6;
          if (this.patId === P_CROC || this.patId === P_COUNTER) { if (pu > pmo - hh * 0.35 && this.patId === P_CROC) { mat = M_BASE; lvl = (0.5 + 0.5 * lum) * 7 - 1.4; } }
          if (H.labials && pu > pmo - Math.max(1.2, hh * 0.28) && mod(pf, labSp) < 0.9 && pf > fh) lvl -= 1.3;
        } else {
          const labH = H.labials ? Math.max(1.1, hh * 0.24) : 0;
          if (pu - pmo < labH && pf > fh) {
            mat = M_THROAT;
            lvl = lvl * 0.55 + 2.8;
            if (mod(pf + labSp * 0.5, labSp) < 0.9) lvl -= 1.3;
          } else if (this.patId === P_COUNTER && v < -0.1) {
            mat = M_BELLY; lvl = lvl * 0.6 + 2.4;
          }
          // markings
          if (mark === 'postocular' && mat === M_BASE) {
            const lx = (pf - eyeF) / Math.max(1, eyeF - fh + hh * 0.4); // 0 at the eye .. -1 at the jaw angle
            if (lx < 0.1 && lx > -1.15) {
              const cu = eyeU + (lx < 0 ? lx : 0) * (eyeU - pmo - hh * 0.1);
              if (Math.abs(pu - cu) < hh * 0.16 + 0.4) { mat = M_PAT; lvl -= 0.3; }
            }
          } else if (mark === 'mask' && mat === M_BASE && Math.abs(pu - eyeU) < er + 0.6 && pf > eyeF - hh * 1.2 && pf < eyeF + er * 1.6) mat = M_PAT;
          // crown plates on big heads
          if (detail >= 1 && hh >= 5.5 && mat === M_BASE && pu > ptp - hh * 0.55) {
            const a = pf / (hh * 0.55), b = (ptp - pu) / (hh * 0.3);
            if (mod(a + Math.floor(b) * 0.5, 1) < 0.12 || mod(b, 1) < 0.14) lvl -= 1.1;
          }
          // snout sensory pits / scale texture on the croc
          if (this.patId === P_CROC && tt > 0.35 && hash2(x, y, this.seed) > 0.86) lvl -= 0.9;
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
    // nostril
    const nosU = L.nostrilTop ? LT[lut(hl * H.nos[0])] - 0.6 : H.nos[1] * hh;
    const [nx0, ny0] = at(hl * H.nos[0], nosU);
    buf.paint(nx0, ny0, R[M_BASE * NR + 0]);
    if (hh >= 6) {
      const [nx1, ny1] = at(hl * H.nos[0] - 1, nosU);
      buf.paint(nx1, ny1, R[M_BASE * NR + 0]);
    }
    // heat pits along the upper lip
    if (L.pits) {
      for (let i = 0; i < 4; i++) {
        const f = hl * (0.52 + i * 0.1);
        const [px2, py2] = at(f, LM[lut(f)] + Math.max(1.1, hh * 0.18));
        buf.paint(px2, py2, R[M_PAT * NR + 0]);
      }
    }
    // croc: nuchal scutes behind the head, ear slit
    if (L.head === 'croc') {
      const [ex, ey] = at(eyeF - er * 2.6, eyeU - er * 0.2);
      buf.paint(ex, ey, R[M_BASE * NR + 0]);
      buf.paint(ex - fx, ey - fy, R[M_BASE * NR + 0]);
    }
    // eye (open/alert/angry/closed)
    const [ex, ey] = at(eyeF, eyeU);
    this.drawEye(buf, Math.floor(ex) + 0.5, Math.floor(ey) + 0.5, er, fx, fy, ux, uy, eyeState, L.pupil ?? H.pupil, false);
    void time;
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
    if (L.head === 'croc' || L.head === 'leviathan' || L.head === 'salamander') return;
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
