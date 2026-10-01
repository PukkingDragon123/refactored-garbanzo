// V9 shore birds on one compact bird rig (egg body, neck, head frame, IK legs, fanned tail, layered
// folded wing, 3D spread wings from beasts-bird), each with its own anatomy hooks:
//
//  Swashrunner      a tiny sand-pale plover on stilts with a black necklace and mask and huge lobed
//                   "snowshoe" toes that keep it from sinking into the wet sand as it chases waves.
//  Pied Shellwrench a stocky black-and-white wrack-line wader whose orange bill is crossed at the tip
//                   like a pair of pliers: it jams the tips into a mussel's gape and twists. Orange
//                   carpal spurs on the wrists for hammering limpets and fighting rivals.
//  Twinfan          a bush flycatcher whose tail is split into two separate fans, upper and lower,
//                   that it flares alternately to flush insects out of the undergrowth.
//
// Ground anims are anchored under the feet, air anims on the body centre.

import { Sk, V2, V3, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, gait, qbez, fr, hh, lerp2 } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { spreadWing, foldedWing, birdLeg, tailFan, scallop, WingLook, WingPose, BirdLegLook } from '../../beasts-bird';
import { hex } from '../../color';

// ------------------------------------------------------------------ look
interface Cols {
  back: string; belly: string; head: string; wing: string; prim: string; cov?: string; tail?: string;
  bill: string; billTip?: string; leg: string; web?: string; mark: string; mark2?: string; claw?: string;
}
interface Look {
  id: 'swashrunner' | 'shellwrench' | 'twinfan';
  name: string; len: number; height: number;
  rx: number; ry: number; stance: number;
  neckL: number; neckR0: number; neckR1: number;
  hrx: number; hry: number;
  leg: BirdLegLook; hipX: number;
  tail: { L: number; hw: number; n: number; spread: number };
  wing: Omit<WingLook, 'fill'> & { foldExt: number };
  eye: EyeSpec;
  cols: Cols;
  flap: number;
  /** how far the dark plumage ramps rise toward white (black birds stay black) */
  light?: number;
  /** lifts the belly tones so white underparts read white even in the body shadow */
  bellyBias?: number;
  /** sleek plumage: faint scallops, no ragged tufts */
  sleek?: boolean;
  /** a percher: ground anims are anchored on the twig it grips, nothing is clipped below the feet */
  perch?: boolean;
}

// ------------------------------------------------------------------ pose
interface BP {
  air: boolean;
  b: V2; ba: number;                  // body centre (anchor-relative) and pitch
  na: number; nl: number;             // neck angle (world), length multiplier
  ha: number; open: number;           // head angle (world), bill gape 0..1
  twist: number;                      // shellwrench: bill twist (-1..1) while prying
  feet: [V2, V2];                     // foot targets near/far (ground)
  lift1: number;                      // resting on one leg: far foot tucked up (0..1)
  tuck: number;                       // legs tucked in flight
  wing: 'fold' | [WingPose, WingPose];
  droop: number; lift: number;        // folded-wing droop / shrug
  tailA: number; tailSp: number;
  fanU: number; fanL: number;         // twinfan: upper / lower fan spread 0..1
  ruffle: number;
  prey?: 'mussel' | 'musselOpen' | 'hopper' | 'moth' | 'shell';
  spur: number;                       // shellwrench: carpal spurs raised (display)
  eye?: BeastEye;
}

function stand(L: Look): BP {
  const legH = (L.leg.tib + L.leg.tar) * 0.8;
  return {
    air: false, b: [0, -(legH + L.ry * 0.72)], ba: L.stance,
    na: -1.25, nl: 1, ha: 0.05, open: 0, twist: 0,
    feet: [[1, 0], [-1.4, 0]], lift1: 0, tuck: 0,
    wing: 'fold', droop: 0, lift: 0, tailA: 0, tailSp: 1, fanU: 0.15, fanL: 0.15, ruffle: 0, spur: 0,
  };
}
function flapPose(t: number, amp: number, spread = 1): WingPose {
  const c = Math.cos(t * TAU);
  const up = t > 0.5;
  return { th: (0.25 + 0.85 * c) * amp, hand: (-0.35 * Math.sin(t * TAU) + (up ? 0.25 : -0.05)) * amp, fold: up ? 0.5 * Math.sin((t - 0.5) * 2 * Math.PI) : 0, sweep: 0.12 + (up ? -0.15 : 0.05), spread };
}
const both = (w: WingPose): [WingPose, WingPose] => [w, { ...w }];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];

type PoseFn = (L: Look, f: number, n: number) => BP;
const G: Record<string, PoseFn> = {
  idle(L, f) {
    const p = stand(L);
    p.b[1] += f === 2 ? 0.4 : 0;
    p.ha = [0.05, 0.05, -0.18, 0.25][f];
    p.na = -1.25 + (f === 3 ? 0.15 : 0);
    p.tailA = f === 1 ? -0.1 : 0;
    p.fanU = f === 1 ? 0.5 : 0.15; p.fanL = f === 3 ? 0.45 : 0.15;
    return p;
  },
  walk(L, f, n) {
    const p = stand(L);
    const t = f / n, st = (L.leg.tib + L.leg.tar) * 0.55;
    p.feet = [gait(t, 0.55, st, st * 0.35), gait(t + 0.5, 0.55, st, st * 0.35)];
    p.b = [p.b[0] + Math.sin(t * TAU * 2) * 0.3, p.b[1] - Math.abs(Math.sin(t * TAU)) * 0.8];
    const hb = fr(t * 2);
    p.nl = hb < 0.5 ? 0.9 : 1.08;
    p.na = -1.1 + (hb < 0.5 ? -0.08 : 0.12);
    p.tailA = Math.sin(t * TAU * 2) * 0.06;
    return p;
  },
  run(L, f, n) {
    // a blur of legs: long strides, body low and level, head pulled in
    const p = stand(L);
    const t = f / n, st = (L.leg.tib + L.leg.tar) * 0.95;
    p.feet = [gait(t, 0.42, st, st * 0.45), gait(t + 0.5, 0.42, st, st * 0.45)];
    p.b = [p.b[0] + 0.6, p.b[1] + 0.6 - Math.abs(Math.sin(t * TAU)) * 1.2];
    p.ba = L.stance + 0.28; p.na = -0.75; p.nl = 0.85; p.ha = 0.18;
    p.droop = 0.4; p.tailA = 0.1;
    return p;
  },
  feed(L, f) {
    // quick pecks at the sand
    const p = stand(L);
    const dn = [0.2, 1, 0.5, 1][f];
    p.ba = L.stance + 0.3 + dn * 0.2; p.na = -0.3 + dn * 1.35; p.nl = 1.05; p.ha = 0.7 + dn * 0.55;
    p.open = f === 1 ? 0.5 : 0;
    p.tailA = -0.2; p.feet = [[1.8, 0], [-1.4, 0]];
    if (f === 3) p.prey = 'hopper';
    return p;
  },
  probe(L, f) {
    // shellwrench: bill driven down into the sand to the base, stabbing
    const p = stand(L);
    const K = [[0.9, 1.05, 1.15], [1.5, 1.2, 1.75], [1.45, 1.15, 1.65], [1.1, 1.1, 1.35]][f];
    p.ba = L.stance + 0.55; p.na = -1.5 + K[0] * 1.2; p.nl = K[1]; p.ha = K[2];
    p.tailA = -0.3; p.feet = [[2, 0], [-1.6, 0]];
    return p;
  },
  pry(L, f) {
    // shellwrench: a mussel clamped in the crossed tips, the head twisting it open
    const p = stand(L);
    p.ba = L.stance + 0.4; p.na = -0.1; p.nl = 1; p.ha = 0.75 + [0, 0.18, -0.12, 0.2, -0.1, 0.05][f];
    p.twist = [0, 1, -1, 1, -1, 0][f];
    p.prey = f < 5 ? 'mussel' : 'musselOpen';
    p.feet = [[2.2, 0], [-1.2, 0]]; p.tailA = -0.25;
    return p;
  },
  eat(L, f) {
    const p = stand(L);
    p.ba = L.stance + 0.2; p.na = -0.9; p.ha = [0.4, -0.2, 0.3, -0.1][f]; p.open = [0.2, 0.7, 0.1, 0.5][f];
    p.prey = f < 2 ? 'musselOpen' : undefined;
    return p;
  },
  pipe(L, f) {
    // piping display: hunched and level, neck stretched forward, bill pointed down and open, calling
    const p = stand(L);
    p.ba = L.stance + 0.62; p.b[1] += 1; p.na = 0.25; p.nl = 1.12; p.ha = 1.0 + (f % 2) * 0.1;
    p.open = f % 2 ? 0.9 : 0.4; p.droop = 0.55; p.spur = 1; p.tailA = -0.5; p.tailSp = 1.4;
    const t = f / 4, st = (L.leg.tib + L.leg.tar) * 0.4;
    p.feet = [gait(t, 0.5, st, st * 0.3), gait(t + 0.5, 0.5, st, st * 0.3)];
    return p;
  },
  alert(L, f) {
    const p = stand(L);
    p.b[1] -= 1; p.ba = L.stance - 0.14; p.na = -1.5; p.nl = 1.15; p.ha = f ? -0.12 : 0.1;
    p.tailA = -0.12; p.eye = 'alert'; p.fanU = 0.4; p.fanL = 0.4;
    return p;
  },
  call(L, f) {
    const p = stand(L);
    p.na = -1.4 - (f ? 0.2 : 0); p.nl = 1.1; p.ha = f ? -0.55 : -0.25; p.open = f ? 1 : 0.5;
    p.fanU = f ? 0.7 : 0.3; p.fanL = f ? 0.6 : 0.3;
    return p;
  },
  rest(L, f) {
    // one-legged, fluffed up, bill tucked into the back
    const p = stand(L);
    p.b[1] += 0.5; p.feet = [[0, 0], [-0.4, 0]]; p.lift1 = 1;
    p.na = -2.3; p.nl = 0.55; p.ha = 2.7; p.ruffle = 1 + f * 0.15; p.eye = f ? 'closed' : 'open';
    return p;
  },
  takeoff(L, f) {
    const p = stand(L);
    const K = [[1.5, 0.8], [-2, 1.1], [-5, 0.9]][f];
    p.b[1] += K[0]; p.ba = L.stance + 0.25;
    p.wing = both({ th: K[1], hand: 0.3, fold: 0.1, sweep: -0.2, spread: 1.2 });
    p.feet = [[1.2, f === 2 ? -2 : 0], [-1, f === 2 ? -1.5 : 0]];
    p.na = -1.0; p.tailSp = 1.4;
    return p;
  },
  hop(L, f) {
    const p = stand(L);
    const h = [0, -3, -3.5, -1][f];
    p.b = [p.b[0] + f * 0.6, p.b[1] + h + (f === 0 ? 0.8 : 0)];
    p.feet = [[1 + f * 0.6, h * 0.55], [-1 + f * 0.6, h * 0.55]];
    p.tailA = f === 1 ? -0.3 : 0.15; p.fanU = f === 1 ? 0.6 : 0.2; p.fanL = f === 1 ? 0.5 : 0.2;
    return p;
  },
  fan(L, f) {
    // twinfan display: the two tail fans flare alternately while it pivots, wings drooped
    const p = stand(L);
    p.ba = L.stance + [0.15, -0.1, 0.2, -0.05][f];
    p.fanU = [1, 0.3, 0.9, 0.5][f]; p.fanL = [0.3, 1, 0.5, 0.95][f];
    p.tailA = [-0.35, 0.25, -0.3, 0.2][f];
    p.droop = 0.7; p.na = -1.3; p.ha = [0.1, -0.2, 0.2, -0.1][f];
    return p;
  },
};

function air(L: Look): BP {
  const p = stand(L);
  p.air = true; p.b = [0, 0]; p.ba = 0.05; p.na = -0.15; p.nl = 0.85; p.ha = 0.05; p.tuck = 1;
  return p;
}
const AIR: Record<string, PoseFn> = {
  fly(L, f, n) {
    const p = air(L);
    const t = f / n;
    p.wing = both(flapPose(t, L.flap));
    p.b = [0, Math.sin(t * TAU) * 1];
    p.tailA = Math.sin(t * TAU) * 0.08; p.fanU = 0.35; p.fanL = 0.35;
    return p;
  },
  glide(L, f) {
    const p = air(L);
    p.wing = [{ th: 0.3 + f * 0.05, hand: -0.1, fold: 0.05, sweep: 0.1, spread: 1 }, { th: -0.25 + f * 0.05, hand: 0.05, fold: 0.05, sweep: 0.1, spread: 1 }];
    p.tailSp = 1.2; p.fanU = 0.5; p.fanL = 0.5;
    return p;
  },
  hawk(L, f, n) {
    // twinfan snapping an insect on the wing: fans flared as air brakes, bill wide
    const p = air(L);
    const t = f / n;
    p.wing = both(flapPose(t, L.flap * 1.1, 1.2));
    p.ba = -0.25; p.na = -0.5; p.ha = -0.1; p.open = f === 1 || f === 2 ? 1 : 0.2;
    p.fanU = 1; p.fanL = 1; p.tailA = 0.3;
    if (f === 3) p.prey = 'moth';
    return p;
  },
  land(L, f) {
    const p = air(L);
    p.ba = [-0.3, -0.55, -0.35][f];
    p.wing = both({ th: [0.9, 0.7, 0.4][f], hand: [0.4, 0.1, -0.4][f], fold: [0, 0.1, 0.5][f], sweep: -0.3, spread: 1.3 });
    p.tuck = 0.3; p.tailSp = 1.8; p.tailA = 0.35; p.fanU = 1; p.fanL = 0.8;
    return p;
  },
};

// ------------------------------------------------------------------ materials
function mats(sk: Sk, L: Look) {
  const c = L.cols;
  const lt = L.light ?? 0.5;
  return {
    back: sk.m(rmp(c.back, { n: 6, dark: 0.6, light: lt }), { edge: 1 }),
    belly: sk.m(rmp(c.belly, { n: 5, dark: 0.42, at: 3, cool: 0.12 }), { edge: 1, bias: L.bellyBias ?? 0 }),
    head: sk.m(rmp(c.head, { n: 6, dark: 0.6, light: lt }), { edge: 1 }),
    wing: sk.m(rmp(c.wing, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    cov: sk.m(rmp(c.cov ?? c.wing, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    prim: sk.m(rmp(c.prim, { n: 6, dark: 0.6, light: Math.min(0.4, lt) }), { edge: 2 }),
    under: sk.m(rmp(c.belly, { n: 5, dark: 0.5 }), { edge: 1, bias: -0.06 + (L.bellyBias ?? 0) * 0.5 }),
    tail: sk.m(rmp(c.tail ?? c.back, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    tailW: sk.m(rmp('#f4f2ec', { n: 4, dark: 0.35, at: 2 }), { edge: 2 }),
    bill: sk.m(rmp(c.bill, { n: 5, dark: 0.5, light: 0.45 }), { spec: 0.45 }),
    tip: sk.m(rmp(c.billTip ?? c.bill, { n: 5, dark: 0.5 }), { spec: 0.4 }),
    leg: sk.m(rmp(c.leg, { n: 5, dark: 0.5 }), { edge: 1 }),
    web: sk.m(rmp(c.web ?? c.leg, { n: 4, dark: 0.45, light: 0.4 }), { edge: 0 }),
    claw: sk.m(rmp(c.claw ?? '#2a2622', { n: 4, dark: 0.5 })),
    mark: sk.m(rmp(c.mark, { n: 5, dark: 0.55 }), { edge: 1 }),
    mark2: sk.m(rmp(c.mark2 ?? c.belly, { n: 4, dark: 0.4, at: 2 }), { edge: 1 }),
    mouth: sk.m(rmp('#6a2230', { n: 3, dark: 0.4 }), { edge: 0 }),
    shell: sk.m(rmp('#2e3450', { n: 5, dark: 0.55, light: 0.45 }), { spec: 0.6 }),
    nacre: sk.m(rmp('#c8d2e4', { n: 4, dark: 0.4 }), { spec: 0.6 }),
    flesh: sk.m(rmp('#f08a4a', { n: 4, dark: 0.45 }), { spec: 0.3 }),
    bug: sk.m(rmp('#8a7658', { n: 4, dark: 0.5 }), { edge: 0 }),
    spurM: sk.m(rmp('#f08a2a', { n: 4, dark: 0.45 }), { spec: 0.3 }),
  };
}
type M = ReturnType<typeof mats>;

// ------------------------------------------------------------------ plumage
/** per-species body pattern (u,v body-ellipse coords: u fwd, v down) */
function bodyPat(L: Look, M: M, p: Px): number {
  const belly = p.v > 0.12 - p.u * 0.3;
  switch (L.id) {
    case 'swashrunner':
      // a bold black necklace across the breast, white below, sand above
      if (p.u > 0.45 && p.v > -0.5 && p.v < 0.35) return M.mark;
      return belly ? M.belly : M.back;
    case 'shellwrench':
      // jet black above and on the breast, clean white below
      if (belly && p.u < 0.45) return M.belly;
      return M.back;
    default:
      // twinfan: warm buff belly, sooty back, a paler rump
      if (belly) return M.belly;
      if (p.u < -0.62 && p.v > -0.4) return M.cov;
      return M.back;
  }
}
function headPat(L: Look, M: M, p: Px): number {
  switch (L.id) {
    case 'swashrunner':
      // sandy crown, white forehead, cheeks and throat; the black eye-stripe runs back from the eye
      if (p.v < -0.45) return M.head;
      if (p.v > -0.2 && p.v < 0.22 && p.u < 0.05 && p.u > -0.75) return M.mark;
      return M.belly;
    case 'shellwrench':
      return M.head;
    default:
      // twinfan: white eyebrow and a white throat spot below a black band
      if (p.v < -0.3 && p.v > -0.62 && p.u > -0.4) return M.mark2;
      if (p.v > 0.5 && p.u > 0) return M.mark2;
      if (p.v > 0.25 && p.u > -0.2) return M.mark;
      return M.head;
  }
}

// ------------------------------------------------------------------ draw
function drawBird(sk: Sk, L: Look, P: BP, eyeSt: BeastEye, juv: boolean): { head: V2; eye: V2 } {
  const M = mats(sk, L);
  const k = juv ? 0.75 : 1;
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const b = S(P.b);
  if (!P.air && !L.perch) sk.clipY = 0;
  const B = new Frame2(b, P.ba, k);
  const rx = L.rx * (1 + P.ruffle * 0.1), ry = L.ry * (1 + P.ruffle * 0.16);
  const WL: WingLook = { ...L.wing, fill: (p, row, _i, under) => {
    if (L.id === 'shellwrench' && (row === 'S' || (row === 'P' && _i < 3)) && p.t < 0.55) return M.mark2; // pied wing bar
    if (L.id === 'swashrunner' && row === 'G') return M.belly; // pale wing stripe
    return under ? (row === 'P' ? M.prim : row === 'S' ? M.wing : M.under) : row === 'P' ? M.prim : row === 'S' ? M.wing : M.cov;
  } };

  // --- legs (far first)
  const hip = B.p(L.hipX, ry * 0.45);
  // bare legs below the belly feathers (the thigh would pick up a crimson shadow tone otherwise)
  const legFill = { tib: L.id === 'twinfan' ? M.back : M.leg, tar: () => M.leg, toe: M.leg, claw: M.claw, web: M.web };
  const drawLeg = (near: boolean) => {
    sk.np();
    const z = near ? 3 : -3, bias = near ? 0 : -0.15;
    const h: V2 = [hip[0] + (near ? 0.4 : -0.4) * k, hip[1]];
    if (P.air || P.tuck > 0) {
      const back = B.p(-rx * 0.9, ry * 0.95);
      birdLeg(sk, h, [back[0] + (near ? 0.8 : -0.8) * k, back[1] + (1 - P.tuck) * 3 * k], L.leg, k, legFill, z, bias, 0, P.tuck);
      return;
    }
    if (!near && P.lift1) {
      // resting on one leg: the other is drawn up into the belly feathers
      const up = B.p(L.hipX - 0.5, ry * 0.95);
      birdLeg(sk, h, up, { ...L.leg, tar: L.leg.tar * 0.5 }, k, legFill, z, bias, 1, 1);
      return;
    }
    let foot = S(near ? P.feet[0] : P.feet[1]);
    foot = [foot[0] + L.hipX * k * 0.3, foot[1]];
    // perching birds grip the twig at the anchor with curled toes
    birdLeg(sk, h, foot, L.leg, k, legFill, z, bias, L.perch ? 1 : 0, 0);
  };
  drawLeg(false);

  // --- far spread wing
  const sh3 = (side: 1 | -1): V3 => [rx * 0.3 * k, ry * 0.35 * k, side * ry * 0.45 * k];
  if (P.wing !== 'fold') spreadWing(sk, b, sh3(-1), WL, P.wing[1], -1, k, -0.14);

  // --- tail (the twinfan's is two fans, upper and lower)
  const rump = B.p(-rx * 0.82, -ry * 0.05);
  const tA = B.ang(Math.PI + 0.15 + P.tailA + (P.air ? 0 : Math.min(0, P.ba) * 0.7));
  if (L.id === 'twinfan') twinFans(sk, M, L, rump, tA, P, k);
  else tailFan(sk, rump, tA, L.tail.L * k, L.tail.hw, L.tail.n, L.tail.spread * P.tailSp, (p, i) => {
    if (L.id === 'shellwrench' && p.t < 0.45) return M.mark2; // white rump band
    return i === 0 || i === L.tail.n - 1 ? M.cov : M.tail;
  }, -1, k, 0, 0.3);

  // --- body
  sk.np();
  sk.ell(b[0], b[1], rx * k, ry * k, (p) => {
    p.l += scallop(p.x, p.y, 2.6 * k, 2 * k, 3) * (L.sleek ? 0.25 : 0.5 + P.ruffle * 0.5);
    return bodyPat(L, M, p);
  }, { rot: P.ba, rz: ry * k * 0.9 });
  const bodyPart = sk.pid;
  if (!L.sleek || P.ruffle) sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny > 0.3 ? [-0.3, 1] as V2 : nx < -0.6 ? [-1, 0.3] as V2 : null), { every: juv ? 2 : 3, len: 1 });

  // --- folded wing (+ the shellwrench's orange carpal spur at the wrist)
  if (P.wing === 'fold') {
    foldedWing(sk, B, rx * k, ry * k, WL, () => ry * k * 0.9 + 0.8, { ext: L.wing.foldExt, droop: P.droop, lift: P.lift, nP: 4, nS: 3 });
    if (L.id === 'shellwrench') {
      sk.np();
      const w = B.p(rx * 0.42, -ry * 0.2 - P.spur * 0.6);
      sk.ell(w[0], w[1], 0.9 * k + P.spur * 0.2, 0.8 * k + P.spur * 0.2, M.spurM, { z: 12 });
    }
  }

  // --- neck
  const nb = B.p(rx * 0.62, -ry * 0.28);
  const nl = L.neckL * P.nl * k;
  const hp: V2 = [nb[0] + Math.cos(P.na) * nl, nb[1] + Math.sin(P.na) * nl];
  if (nl > 0.6) {
    sk.np();
    sk.tube(qbez(nb, lerp2(nb, hp, 0.5), hp, 6), t => (L.neckR0 + (L.neckR1 - L.neckR0) * t) * k, (p) => {
      if (L.id === 'swashrunner') return p.v > 0.2 ? M.belly : M.back;
      if (L.id === 'twinfan') return p.v > 0.3 ? M.mark : M.head;
      return M.head;
    }, { z: 1.5 });
  }

  // --- head
  const H = new Frame2(hp, P.ha, k);
  sk.np();
  const hc = H.p(0, 0);
  sk.ell(hc[0], hc[1], L.hrx * k, L.hry * k, (p) => headPat(L, M, p), { rot: P.ha, rz: L.hry * k * 0.95, z: 3 });
  // bill
  const tipPt = drawBill(sk, M, L, H, P, k);
  // eye (red with an orange ring for the shellwrench)
  const ep = H.p(L.hrx * 0.25, -L.hry * 0.2);
  const eyeC = drawEye(sk, ep[0], ep[1], { ...L.eye, r: juv ? Math.max(0.5, L.eye.r * 0.8) : L.eye.r }, P.eye ?? eyeSt);
  // twinfan rictal bristles
  if (L.id === 'twinfan') { const q = H.p(L.hrx * 0.8, L.hry * 0.1); sk.over(q[0] + 1, q[1] - 1, hex('#2a2420')); sk.over(q[0] + 1, q[1] + 1, hex('#2a2420')); }

  // --- near leg + near wing
  drawLeg(true);
  if (P.wing !== 'fold') spreadWing(sk, b, sh3(1), WL, P.wing[0], 1, k, 0);

  // --- things in the bill
  if (P.prey) drawPrey(sk, M, P, tipPt, H, k);
  const top = H.p(0, -L.hry - 2);
  return { head: [top[0], top[1] - 2 * k], eye: eyeC };
}

/** The bill of each species; returns the working tip. */
function drawBill(sk: Sk, M: M, L: Look, H: Frame2, P: BP, k: number): V2 {
  const openA = P.open * 0.45;
  if (L.id === 'shellwrench') {
    // long and slim like a chisel, the mandible tips crossed like pliers; twisting flexes the cross
    const len = 8.4 * k, base = H.p(L.hrx * 0.72, L.hry * 0.05);
    const ua = P.ha + 0.05 - openA * 0.3;
    const la = P.ha + 0.05 + openA;
    const ut: V2 = [base[0] + Math.cos(ua) * len, base[1] + Math.sin(ua) * len];
    const lb: V2 = [base[0] - 0.3, base[1] + 0.9 * k];
    const lt: V2 = [lb[0] + Math.cos(la) * len * 0.96, lb[1] + Math.sin(la) * len * 0.96];
    // lower mandible: the tip bends UP across the upper one
    sk.np();
    const lhook: V2 = [lt[0] + Math.cos(la - 1.1 - P.twist * 0.35) * 1.8 * k, lt[1] + Math.sin(la - 1.1 - P.twist * 0.35) * 1.8 * k];
    sk.blade(lb[0], lb[1], lt[0], lt[1], s => Math.max(0.3, 0.55 * k * (1 - s * 0.4)), M.bill, { z0: 5.2, z1: 5.2, bias: -0.1 });
    sk.line(lt[0], lt[1], lhook[0], lhook[1], M.tip, 0.5, 5.3);
    // upper mandible: deeper at the base, the tip bends DOWN across the lower one
    sk.np();
    const uhook: V2 = [ut[0] + Math.cos(ua + 1.15 + P.twist * 0.35) * 1.7 * k, ut[1] + Math.sin(ua + 1.15 + P.twist * 0.35) * 1.7 * k];
    sk.blade(base[0], base[1] - 0.2, ut[0], ut[1], s => Math.max(0.35, 0.85 * k * (1 - Math.pow(s, 1.3) * 0.6)), (p) => (p.t > 0.82 ? M.tip : M.bill), { z0: 5.6, z1: 5.6, curl: 0.5 });
    sk.line(ut[0], ut[1], uhook[0], uhook[1], M.tip, 0.6, 5.7);
    if (P.open > 0.3) sk.line(base[0], base[1] + 0.5, (ut[0] + lt[0]) / 2 - Math.cos(P.ha) * 2, (ut[1] + lt[1]) / 2, M.mouth, 0.2, 6, true);
    return lerp2(uhook, lhook, 0.5);
  }
  if (L.id === 'swashrunner') {
    // short black bill with a slightly swollen, touch-sensitive tip
    const len = 2.6 * k, base = H.p(L.hrx * 0.75, L.hry * 0.08);
    const ua = P.ha + 0.1 - openA * 0.3;
    const tip: V2 = [base[0] + Math.cos(ua) * len, base[1] + Math.sin(ua) * len];
    sk.np();
    sk.blade(base[0], base[1] - 0.2, tip[0], tip[1], s => Math.max(0.4, 0.75 * k * (1 - s * 0.5) + (s > 0.8 ? 0.2 : 0)), M.bill, { z0: 5.5, z1: 5.5 });
    if (P.open > 0.2) { const la = P.ha + 0.1 + openA; sk.line(base[0], base[1] + 0.6, base[0] + Math.cos(la) * len * 0.9, base[1] + 0.6 + Math.sin(la) * len * 0.9, M.bill, 0.3, 5.4); }
    return tip;
  }
  // twinfan: tiny broad-based flycatcher bill
  const len = 1.8 * k, base = H.p(L.hrx * 0.78, L.hry * 0.12);
  const ua = P.ha + 0.05 - openA * 0.5, la = P.ha + 0.2 + openA * 1.2;
  const ut: V2 = [base[0] + Math.cos(ua) * len, base[1] + Math.sin(ua) * len];
  sk.np();
  sk.blade(base[0], base[1] - 0.3, ut[0], ut[1], s => Math.max(0.35, 0.8 * (1 - s)), M.bill, { z0: 5.5, z1: 5.5 });
  if (P.open > 0.2) sk.line(base[0], base[1] + 0.5, base[0] + Math.cos(la) * len, base[1] + 0.5 + Math.sin(la) * len, M.bill, 0.3, 5.4);
  return ut;
}

/** Twinfan: two separate fans on a split tail, upper and lower, flared independently. */
function twinFans(sk: Sk, M: M, L: Look, rump: V2, tA: number, P: BP, k: number) {
  // each fan: dark feathers with crisp white tips; open fans show a white outer edge
  const fan = (a: number, spread: number, z: number, outer: 'up' | 'down') => {
    const n = 4;
    tailFan(sk, rump, a, L.tail.L * k * (0.95 + spread * 0.15), L.tail.hw, n, 0.08 + spread * 0.7, (p, i) => {
      if (p.t > 0.84) return M.tailW;
      // (screen angles: a larger angle points a backward feather further up)
      const edge = outer === 'up' ? i === n - 1 : i === 0;
      if (edge && spread > 0.4 && p.t > 0.3) return M.tailW;
      return M.tail;
    }, z, k, 0, 0.15);
  };
  fan(tA - 0.06 - P.fanL * 0.5, P.fanL, -1.2, 'down');
  fan(tA + 0.06 + P.fanU * 0.55, P.fanU, -0.6, 'up');
}

function drawPrey(sk: Sk, M: M, P: BP, tip: V2, H: Frame2, k: number) {
  sk.np();
  if (P.prey === 'mussel') {
    // a blue-black mussel clamped in the crossed tips, turning as the head twists
    const c: V2 = [tip[0] + 0.6 * k, tip[1] + 1.6 * k];
    sk.ell(c[0], c[1], 2.2 * k, 1.3 * k, (p) => (p.v < -0.6 ? M.nacre : M.shell), { rot: H.a + 1.2 + P.twist * 0.35, z: 7 });
  } else if (P.prey === 'musselOpen') {
    const c: V2 = [tip[0] + 0.6 * k, tip[1] + 1.4 * k];
    sk.ell(c[0] - 1, c[1], 1.8 * k, 1 * k, M.shell, { rot: H.a + 0.6, z: 7 });
    sk.ell(c[0] + 1, c[1] + 0.4, 1.8 * k, 1 * k, M.shell, { rot: H.a + 1.9, z: 7 });
    sk.ell(c[0], c[1] - 0.2, 1.1 * k, 0.8 * k, M.flesh, { z: 8 });
  } else if (P.prey === 'hopper' || P.prey === 'moth') {
    sk.ell(tip[0] + 0.5, tip[1] + 0.3, 0.9 * k, 0.6 * k, M.bug, { z: 8 });
  }
}

// ------------------------------------------------------------------ species
interface BirdOpts { look: Look; anims: Record<string, AnimDef>; ground: { w: number; h: number; ox: number; oy: number }; flight: { w: number; h: number; ox: number; oy: number }; airAnims: string[] }
function makeBird(o: BirdOpts): SpeciesDef {
  const isAir = (a: string) => o.airAnims.includes(a);
  const anchor: Record<string, 'ground' | 'centre' | 'grip'> = {};
  for (const a of Object.keys(o.anims)) anchor[a] = o.look.perch ? 'grip' : 'ground';
  for (const a of o.airAnims) anchor[a] = 'centre';
  return {
    name: o.look.name, kind: 'bird', len: o.look.len, height: o.look.height,
    anims: o.anims, anchor,
    canvas: (anim, juv) => {
      const c = isAir(anim) ? o.flight : o.ground;
      return juv ? { w: Math.ceil(c.w * 0.8), h: Math.ceil(c.h * 0.8), ox: Math.round(c.ox * 0.8), oy: Math.round(c.oy * 0.8) } : c;
    },
    draw(sk, anim, frame, eye, juv) {
      const n = o.anims[anim]?.frames ?? 1;
      const fn = (isAir(anim) ? AIR[anim] : G[anim]) ?? G.idle;
      return drawBird(sk, o.look, fn(o.look, frame, n), eye, juv);
    },
    eyeFor: (anim) => (anim === 'rest' ? 'open' : anim === 'alert' ? 'alert' : 'open'),
  };
}
const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });

export const SWASHRUNNER = makeBird({
  look: {
    id: 'swashrunner', name: 'Swashrunner', len: 12, height: 12,
    rx: 3.8, ry: 3.1, stance: -0.22, neckL: 0.8, neckR0: 2.3, neckR1: 2, hrx: 2.2, hry: 2,
    leg: { tib: 2.6, tar: 3.8, rT: 0.9, rt: 0.45, toe: 2.4, talon: 0.3 }, hipX: -0.4,
    tail: { L: 2.8, hw: 0.9, n: 5, spread: 0.3 },
    wing: { arm: 5, hand: 5, sec: 3, prim: 5, nS: 4, nP: 5, finger: 0, pw: 0.8, sw: 1, round: 0.2, foldExt: 1.4 },
    eye: { r: 0.6, iris: hex('#141012'), lash: hex('#141012') },
    cols: { back: '#b8a88c', belly: '#f6f4ee', head: '#b0a084', wing: '#a89878', prim: '#4a4038', cov: '#c4b496', tail: '#5a4e42', bill: '#1e1a1c', leg: '#eca040', web: '#f4c070', mark: '#1e1a1c' },
    flap: 1.1, bellyBias: 0.3,
  },
  anims: { idle: A(4, 3), walk: A(6, 10), run: A(6, 18), feed: A(4, 10), alert: A(2, 3), call: A(2, 6), rest: A(2, 1.2), takeoff: A(3, 12, false), fly: A(4, 16), glide: A(2, 3), land: A(3, 10, false) },
  ground: { w: 30, h: 28, ox: 13, oy: 24 },
  flight: { w: 40, h: 34, ox: 20, oy: 17 },
  airAnims: ['fly', 'glide', 'land'],
});

export const SHELLWRENCH = makeBird({
  look: {
    id: 'shellwrench', name: 'Pied Shellwrench', len: 18, height: 17,
    rx: 5.6, ry: 3.7, stance: -0.3, neckL: 2.2, neckR0: 2.7, neckR1: 2.3, hrx: 2.7, hry: 2.4,
    leg: { tib: 3.8, tar: 4.4, rT: 1.3, rt: 0.55, toe: 2.4, talon: 0.4 }, hipX: -0.6,
    tail: { L: 3.6, hw: 1.1, n: 5, spread: 0.3 },
    wing: { arm: 8, hand: 7.5, sec: 4.5, prim: 8, nS: 5, nP: 6, finger: 0.1, pw: 1.2, sw: 1.4, round: 0.25, foldExt: 2.6 },
    eye: { r: 1, iris: hex('#e02a1e'), lash: hex('#140c0c'), ring: hex('#f08a2a') },
    cols: { back: '#1e1c22', belly: '#f4f2ec', head: '#18161c', wing: '#24222a', prim: '#141216', cov: '#2c2a32', tail: '#1a181e', bill: '#f0581e', billTip: '#f6c040', leg: '#e89a9a', mark: '#1e1c22', mark2: '#f4f2ec' },
    flap: 0.95, light: 0.26, bellyBias: 0.22, sleek: true,
  },
  anims: { idle: A(4, 2.5), walk: A(6, 8), run: A(6, 14), probe: A(4, 7), pry: A(6, 6), eat: A(4, 7), pipe: A(4, 8), alert: A(2, 3), call: A(2, 5), rest: A(2, 1.2), takeoff: A(3, 10, false), fly: A(6, 11), glide: A(2, 2), land: A(3, 8, false) },
  ground: { w: 44, h: 36, ox: 18, oy: 31 },
  flight: { w: 64, h: 50, ox: 32, oy: 25 },
  airAnims: ['fly', 'glide', 'land'],
});

export const TWINFAN = makeBird({
  look: {
    id: 'twinfan', name: 'Twinfan', len: 12, height: 9,
    rx: 2.9, ry: 2.5, stance: -0.95, neckL: 0.6, neckR0: 1.9, neckR1: 1.7, hrx: 2, hry: 1.9,
    leg: { tib: 1.4, tar: 1.8, rT: 0.8, rt: 0.45, toe: 1.4, talon: 0.4 }, hipX: -0.2,
    tail: { L: 6.5, hw: 0.8, n: 4, spread: 0.2 },
    wing: { arm: 4.5, hand: 4.5, sec: 2.6, prim: 4.2, nS: 4, nP: 5, finger: 0.2, pw: 0.8, sw: 0.9, round: 0.6, foldExt: 0.8 },
    eye: { r: 0.7, iris: hex('#141012'), lash: hex('#141012') },
    cols: { back: '#5a4c40', belly: '#e0b680', head: '#4a3e34', wing: '#4e4238', prim: '#2a2420', cov: '#7a6a58', tail: '#241e1a', bill: '#1e1a1a', leg: '#3a3230', mark: '#1e1a1a', mark2: '#f4f0e8' },
    flap: 1.15, sleek: true, perch: true, bellyBias: 0.12,
  },
  anims: { idle: A(4, 4), hop: A(4, 10), fan: A(4, 8), call: A(2, 6), alert: A(2, 3), fly: A(4, 18), glide: A(2, 3), hawk: A(4, 14), land: A(3, 10, false) },
  ground: { w: 34, h: 30, ox: 16, oy: 22 },
  flight: { w: 40, h: 36, ox: 20, oy: 18 },
  airAnims: ['fly', 'glide', 'hawk', 'land'],
});
void hh;
