// V9 shore birds on one contour bird rig (the seabird contour kit, src/art/v9/sea/seabird-kit.ts):
// the body, neck and head are ONE lofted contour through the rump, back, breast, the curve of the
// neck, the occiput, crown and forehead; the bill, the folded wing, the tail feathers and the
// spread wings are each their own contour, lit on the Relief layer; the legs and feet are placed
// pixel by pixel. Each species has its own anatomy:
//
//  Swashrunner      a tiny sand-pale plover on long orange legs with a black necklace and mask, a
//                   short black bill with a swollen touch-tip, and huge lobed "snowshoe" toes (a long
//                   sole with a scalloped flap at every joint) that keep it from sinking in wet sand.
//  Pied Shellwrench a stocky black-and-white wrack-line wader whose long orange bill is crossed at the
//                   tip like a pair of pliers (the upper tip hooks down over the lower, the lower bends
//                   up past it): it jams the tips into a mussel's gape and twists. Orange carpal spurs
//                   on the wrists for hammering limpets and fighting rivals; a red eye in an orange ring.
//  Twinfan          a bush flycatcher whose tail is split into two separate fans, upper and lower, dark
//                   with white tips and edges, that it flares alternately to flush insects out of the
//                   undergrowth. Rufous breast, white brow and throat, rictal bristles round its bill.
//
// Ground anims are anchored under the feet, air anims on the body centre.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, gait, fr, hh, lerp2 } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import type { WingPose } from '../../beasts-bird';
import { hex } from '../../color';
import type { PixelBuffer } from '../../pixel';
import { View3, WingShape } from '../sea/seabird';
import {
  Relief, LM, Sp, Tx, spline, fringe, loft, loftOutline, loftAt, Station, HeadF, wingFrame, wing, WingLook as KWingLook, WingPx,
  fan, fanAt, FanOut, feathers, FT, foldOutline, foldTex, foldMap, FoldLook, pxLeg, PxLegLook, B3, clamp,
} from '../sea/seabird-kit';

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
  leg: PxLegLook; hipX: number;
  tail: { L: number; n: number; spread: number };
  wing: { shape: WingShape; look: KWingLook; foldExt: number };
  eye: EyeSpec;
  cols: Cols;
  flap: number;
  /** how far the dark plumage ramps rise toward white (black birds stay black) */
  light?: number;
  /** lifts the belly tones so white underparts read white even in the body shadow */
  bellyBias?: number;
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
    const K = [[1.5, 0.8], [-2, 1.1], [-5, 0.45]][f];
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
    backF: sk.m(rmp(c.cov ?? c.back, { n: 6, dark: 0.6, light: lt }), { edge: 1 }),
    belly: sk.m(rmp(c.belly, { n: 6, dark: 0.42, at: 4, cool: L.id === 'twinfan' ? 0.02 : 0.4, warm: L.id === 'twinfan' ? 0.35 : 0.25 }), { edge: 1, bias: L.bellyBias ?? 0 }),
    head: sk.m(rmp(c.head, { n: 6, dark: 0.6, light: lt }), { edge: 1 }),
    wing: sk.m(rmp(c.wing, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    cov: sk.m(rmp(c.cov ?? c.wing, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    prim: sk.m(rmp(c.prim, { n: 6, dark: 0.6, light: Math.min(0.4, lt) }), { edge: 2 }),
    under: sk.m(rmp(c.belly, { n: 5, dark: 0.5 }), { edge: 1, bias: -0.06 + (L.bellyBias ?? 0) * 0.5 }),
    tail: sk.m(rmp(c.tail ?? c.back, { n: 6, dark: 0.6, light: lt }), { edge: 2 }),
    tailW: sk.m(rmp('#f4f2ec', { n: 4, dark: 0.35, at: 2 }), { edge: 2 }),
    bill: sk.m(rmp(c.bill, { n: 6, dark: 0.5, light: 0.45 }), { spec: 0.2 }),
    tip: sk.m(rmp(c.billTip ?? c.bill, { n: 5, dark: 0.5 }), { spec: 0.4 }),
    leg: sk.m(rmp(c.leg, { n: 5, dark: 0.45, cool: 0.08 }), { edge: 1 }),
    web: sk.m(rmp(c.web ?? c.leg, { n: 4, dark: 0.45, light: 0.4 }), { edge: 0 }),
    claw: sk.m(rmp(c.claw ?? '#2a2622', { n: 4, dark: 0.5 })),
    mark: sk.m(rmp(c.mark, { n: 5, dark: 0.55, light: 0.3 }), { edge: 1 }),
    mark2: sk.m(rmp(c.mark2 ?? c.belly, { n: 5, dark: 0.4, at: 3 }), { edge: 1 }),
    mouth: sk.m(rmp('#6a2230', { n: 3, dark: 0.4 }), { edge: 0 }),
    gape: sk.m(rmp('#2a1a18', { n: 3, dark: 0.4 }), { edge: 0 }),
    shell: sk.m(rmp('#2e3450', { n: 5, dark: 0.55, light: 0.45 }), { spec: 0.6 }),
    nacre: sk.m(rmp('#c8d2e4', { n: 4, dark: 0.4 }), { spec: 0.6 }),
    flesh: sk.m(rmp('#f08a4a', { n: 4, dark: 0.45 }), { spec: 0.3 }),
    bug: sk.m(rmp('#8a7658', { n: 4, dark: 0.5 }), { edge: 0 }),
    spurM: sk.m(rmp('#f08a2a', { n: 4, dark: 0.45, light: 0.4 }), { spec: 0.3 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, BILL: 3, JAW: 4, TAIL: 7, TAIL2: 6, FOLD: 8, WING: 9, SPUR: 11, PREY: 14, HEAD: 2 };

// ------------------------------------------------------------------ plumage
/** per-species plumage of the body + head loft: f station index, dors, lat, head-local hx/hy */
function plumage(L: Look, M: M, f: number, nb: number, dors: number, lat: number, hx: number, hy: number, along: number, px = 1): number {
  const head = f >= nb;
  switch (L.id) {
    case 'swashrunner':
      if (head) {
        // sandy crown, white forehead and throat; the black mask runs back through the eye
        if (hy < -L.hry * 0.45 && hx < L.hrx * 0.15) return M.head;
        // a black band over the white forehead (big heads only), the mask through the eye: a single
        // pixel row on a small head so the white brow and throat still frame it
        if (px > 3 && hy < -L.hry * 0.48 && hy > -L.hry * 0.8 && hx >= L.hrx * 0.15 && hx < L.hrx * 0.55) return M.mark;
        if (Math.abs(hy + L.hry * 0.2) < Math.max(0.55 / px * L.hry, L.hry * 0.3) && hx < L.hrx * 0.35 && hx > -L.hrx * 0.8 && lat > 0.1) return M.mark;
        return M.belly;
      }
      // a bold black necklace round the base of the neck, white below, sand above
      if (f > nb - 2.2 && f < nb - 1.15 && dors < 0.7) return M.mark;
      return dors > 0.12 ? M.back : M.belly;
    case 'shellwrench':
      // jet black above and on the head and breast, clean white below and behind
      if (!head && f < nb - 2.2 && dors < -0.05 + along * 0) return M.belly;
      return head ? M.head : M.back;
    default:
      // twinfan: a white eyebrow, a white throat spot under a black band, rufous breast, sooty back
      if (head) {
        if (hy < -L.hry * 0.15 && hy > -L.hry * 0.62 && hx > -L.hrx * 0.55 && lat > 0.15) return M.mark2;
        if (hy > L.hry * 0.5 && hx > -L.hrx * 0.1) return M.mark2;
        if (hy > L.hry * 0.18 && hx > -L.hrx * 0.4) return M.mark;
        return M.head;
      }
      if (dors < 0.5 - (f < 1.2 ? 0.5 : 0)) return M.belly;
      return M.back;
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
  const V0 = new View3(0, 0, 0, [0, 0], 1);
  const up2 = (a: number): V3 => [Math.sin(a), Math.cos(a), 0]; // body-space up of a screen frame rotated by a
  const BP3 = (x: number, y: number): V3 => B3(B.p(x, y));

  // --- neck and head frames
  const nb2 = B.p(rx * 0.62, -ry * 0.28);
  const nl = L.neckL * P.nl * k;
  const hp2: V2 = [nb2[0] + Math.cos(P.na) * nl, nb2[1] + Math.sin(P.na) * nl];
  const back = Math.cos(P.ha) < -0.3;
  const hf: V3 = [Math.cos(P.ha), -Math.sin(P.ha), 0], hu: V3 = up2(P.ha);
  const H = new HeadF(V0, B3(hp2), hf, hu);

  // --- legs (far first), placed pixel by pixel
  const hip = B.p(L.hipX, ry * 0.45);
  const legM = { tib: L.id === 'twinfan' ? M.back : L.id === 'shellwrench' ? M.belly : M.belly, leg: M.leg, toe: M.leg, web: M.web, claw: M.claw };
  const drawLeg = (near: boolean) => {
    const z = near ? 6 : -6, lt = near ? 0 : -0.2;
    const fa0 = S(P.feet[0]), fb0 = S(P.feet[1]);
    const standClose = !P.air && P.tuck <= 0 && Math.abs(fa0[0] - fb0[0]) < (L.leg.thick ? 4.6 : 3.5) && fa0[1] > -0.6 && fb0[1] > -0.6;
    const h: V2 = [hip[0] + (standClose ? 0.3 : near ? 0.3 : -0.7) * k, hip[1]];
    if (P.air || P.tuck > 0) {
      if (P.tuck >= 1) return;
      const bk = B.p(-rx * 0.9, ry * 0.95);
      pxLeg(sk, h, [bk[0] + (near ? 0.8 : -0.8) * k, bk[1] + (1 - P.tuck) * 3 * k], L.leg, legM, z, k, { ta: Math.PI * 0.75, curl: L.perch ? 0.5 : 0, light: lt });
      return;
    }
    if (!near && P.lift1) {
      // resting on one leg: the other is drawn up into the belly feathers
      return;
    }
    // feet closer than a few pixels are drawn one behind the other (the far one a pixel back), so
    // two thin legs never fill in with outline between them
    const fa = S(P.feet[0]), fb = S(P.feet[1]);
    const close = Math.abs(fa[0] - fb[0]) < (L.leg.thick ? 4.6 : 3.5) && fa[1] > -0.6 && fb[1] > -0.6;
    let foot = near ? fa : fb;
    if (close && !near) return; // hidden behind the near leg
    if (close) foot = [h[0] + 0.6 - L.hipX * k * 0.3, 0];
    foot = [Math.round(foot[0] + L.hipX * k * 0.3) + 0.5, Math.min(-0.5, foot[1] - 0.5)];
    const lifted = foot[1] < -1;
    if (L.perch) pxLeg(sk, h, [foot[0], -0.5], L.leg, legM, z, k, { ta: 0, curl: 0.9, light: lt });
    else pxLeg(sk, h, foot, L.leg, legM, z, k, { ta: lifted ? 0.7 : 0, ground: lifted ? undefined : 0, light: lt, vert: close });
  };
  drawLeg(false);

  // --- far spread wing
  const flying = P.wing !== 'fold';
  const VW = new View3(0.38, -P.ba, 0.42, b, k);
  const kw = (w: WingPose) => ({ elev: w.th, hand: w.hand, flex: w.fold, sweep: w.sweep - 0.12 });
  const wf = wingFill(L, M);
  if (flying) {
    const R = Relief.full(sk);
    wing(R, VW, wingFrame(L.wing.shape, kw((P.wing as [WingPose, WingPose])[1]), -1), L.wing.look, wf, { id: ID.WING, lt: -0.1 });
    sk.np();
    R.emit({ drop: 1, seam: 0.5, seamDark: 0.2, bias: -0.05 });
  }

  const BR = Relief.full(sk);
  // --- tail (the twinfan's is two fans, upper and lower)
  const rump = B.p(-rx * 0.82, -ry * 0.05);
  const tA = B.ang(Math.PI + 0.15 + P.tailA + (P.air ? 0 : Math.min(0, P.ba) * 0.7));
  if (L.id === 'twinfan') twinFans(BR, M, L, rump, tA, P, k);
  else {
    const dir: V3 = [Math.cos(tA), -Math.sin(tA), 0];
    // a closed tail seen from the side: feathers fanned in the horizontal plane (+ a little toward us)
    const F = fan(V0, B3(rump), dir, [0, -0.25, 1], L.tail.n, L.tail.spread * P.tailSp, t => L.tail.L * k * (1 - Math.abs(t - 0.5) * 0.25), { minW: 1.1 * k, notch: 0.08, base: 0.9 * k, point: 0.5 });
    BR.region(spline(F.poly, 0.4), { z: -2, R: 0.8, H: 0.8, id: ID.TAIL, tex: (p, o) => {
      const q = fanAt(F, p.x, p.y);
      o.m = L.id === 'shellwrench' && q.u < 0.45 ? M.mark2 : q.i === 0 || q.i === L.tail.n - 1 ? M.cov : M.tail;
      if (L.id === 'swashrunner' && q.u > 0.8) o.m = M.tailW;
      if (q.edge < 0.3) o.z -= 0.3;
    } });
  }

  // --- body + neck + head: one contour through anatomical landmarks (rump, back, the nape, the
  // occiput, crown and forehead, the chin, the throat, breast, belly and vent)
  const bu = up2(P.ba);
  const bodyR: [number, number, number, number][] = [[-0.98, 0.26, 0.2, 0.4], [-0.66, 0.72, 0.64, 0.8], [-0.12, 0.98, 1.0, 1.0], [0.4, 0.9, 0.96, 0.92], [0.72, 0.62, 0.78, 0.75]];
  const bst: Station[] = bodyR.map(([x, ru, rl, rw]) => ({ c: BP3(rx * x, ry * (0.05 - (ru - rl) * 0.5)), up: bu, ru: ru * ry * k, rl: rl * ry * k, rw: rw * ry * k }));
  const Lb = loft(V0, bst);
  const nr0 = L.neckR0 * k, nr1 = L.neckR1 * k;
  // the pattern helper spine: body, neck, head centre, forehead, bill base
  const hst: Station[] = back ? bst : [
    ...bst.slice(0, 4),
    { c: B3(nb2), up: up2(P.na), ru: nr0, rl: nr0, rw: nr0 },
    { c: B3(lerp2(nb2, hp2, 0.5)), up: up2(P.na), ru: (nr0 + nr1) / 2, rl: (nr0 + nr1) / 2, rw: (nr0 + nr1) / 2 },
    { c: B3(hp2), up: hu, ru: L.hry * k, rl: L.hry * k * 0.85, rw: L.hry * k * 0.9 },
    { c: H.p(L.hrx * 0.55 * k, 0), up: hu, ru: L.hry * k * 0.75, rl: L.hry * k * 0.6, rw: L.hry * k * 0.7 },
    { c: H.p(L.hrx * 0.92 * k, 0.05 * k), up: hu, ru: L.hry * k * 0.42, rl: L.hry * k * 0.42, rw: L.hry * k * 0.4 },
  ];
  const nb = back ? 99 : 5.5;
  const Lf = loft(V0, hst);
  let outlineLM: LM[];
  if (back) outlineLM = loftOutline(Lb, { head: 1 * k, tail: 0.5 * k });
  else {
    const nB = bst.length;
    const tp = (i: number): LM => [Lb.s[i][0] + Lb.N[i][0] * Lb.top[i], Lb.s[i][1] + Lb.N[i][1] * Lb.top[i], 0];
    const bt = (i: number): LM => [Lb.s[i][0] - Lb.N[i][0] * Lb.bot[i], Lb.s[i][1] - Lb.N[i][1] * Lb.bot[i], 0];
    const inBody = (q: LM) => { const dx = q[0] - b[0], dy = q[1] - b[1], c = Math.cos(-P.ba), sn = Math.sin(-P.ba); const u = (dx * c - dy * sn) / (rx * k), v = (dx * sn + dy * c) / (ry * k); return u * u + v * v < 0.8; };
    const inHead = (q: LM) => { const [hx, hy] = H.local(q[0], q[1]); return (hx / (L.hrx * k)) ** 2 + (hy / (L.hry * k)) ** 2 < 0.75; };
    const T0: V2 = [-Lb.N[0][1], Lb.N[0][0]];
    outlineLM = [[Lb.s[0][0] - T0[0] * 0.5 * k + Lb.N[0][0] * (Lb.top[0] - Lb.bot[0]) / 2, Lb.s[0][1] - T0[1] * 0.5 * k + Lb.N[0][1] * (Lb.top[0] - Lb.bot[0]) / 2, 0.2]];
    for (let i = 0; i < nB - 1; i++) outlineLM.push(tp(i));
    // the nape and the throat: either side of the neck's centre line
    const nd: V2 = [hp2[0] - nb2[0], hp2[1] - nb2[1]], ndl = Math.hypot(nd[0], nd[1]) || 1;
    const nL: V2 = [nd[1] / ndl, -nd[0] / ndl];
    const neckPt = (t: number, sgn: number): LM => { const r = nr0 + (nr1 - nr0) * t; const c = lerp2(nb2, hp2, t); return [c[0] + nL[0] * r * sgn, c[1] + nL[1] * r * sgn, 0]; };
    for (const t of [0.1, 0.45, 0.8]) { const q = neckPt(t, 1); if (!inBody(q) && !inHead(q)) outlineLM.push(q); }
    const hs = (x: number, y: number, sh = 0): LM => H.s(x * L.hrx * k, y * L.hry * k, 0, sh);
    const flat = L.id === 'shellwrench';
    outlineLM.push(hs(-0.95, -0.02), hs(-0.68, flat ? -0.8 : -0.7), hs(-0.1, flat ? -0.96 : -1.0), hs(0.5, flat ? -0.74 : -0.86), hs(0.88, -0.4, 0.2), hs(0.88, 0.4, 0.2), hs(0.55, 0.8), hs(-0.05, 0.94), hs(-0.6, 0.74));
    for (const t of [0.8, 0.45, 0.1]) { const q = neckPt(t, -1); if (!inBody(q) && !inHead(q)) outlineLM.push(q); }
    for (let i = nB - 2; i >= 0; i--) outlineLM.push(bt(i));
  }
  let zc = 0;
  const outline = spline(outlineLM, 0.45);
  const poly = fringe(outline, 2 * k, 51, (_x, _y, nx, ny) => (P.ruffle > 0 && ny > -0.5 ? [0.9 * k, 0.4] : ny > 0.65 ? [0.5 * k, 0.5] : null));
  BR.region(poly, {
    zAt: () => zc, R: ry * 0.9 * k, H: ry * 0.9 * k, id: ID.BODY,
    tex: (p: Sp, o: Tx) => {
      const h = loftAt(Lf, p.x, p.y);
      zc = h.z;
      const seg = Math.min(Lf.n - 2, Math.floor(h.f));
      const ang = Math.atan2(Lf.s[seg][1] - Lf.s[seg + 1][1], Lf.s[seg][0] - Lf.s[seg + 1][0]);
      o.z += feathers(p.x, p.y, ang, 1.8 * k, 1.3 * k, 53) * (0.35 + P.ruffle * 0.3);
      const [hx, hy] = h.f >= nb - 0.5 ? H.local(p.x, p.y) : [0, 0];
      o.m = plumage(L, M, h.f, nb, h.dors, h.lat, hx / k, hy / k, h.along, L.hry * k);
      if (FT.edge === 1 && o.m === M.back) o.m = M.backF;
    },
  });
  const brc = B.p(rx * 0.45, ry * 0.35); BR.bump(brc[0], brc[1], rx * 0.5 * k, ry * 0.5 * k, 0.5, 0, ID.BODY);
  if (back) {
    // the head resting on the back, bill tucked into the scapulars
    const hc = B.p(rx * 0.55, -ry * 0.75);
    const Hr = new HeadF(V0, B3(hc), [-0.9, 0.2, 0], [0.2, 0.9, 0]);
    const lm: LM[] = [Hr.s(-L.hrx * 0.9, 0), Hr.s(-L.hrx * 0.4, -L.hry * 0.95), Hr.s(L.hrx * 0.6, -L.hry * 0.8), Hr.s(L.hrx * 0.95, 0.2), Hr.s(0, L.hry * 0.8)];
    BR.region(spline(lm.map(q => [q[0] * 1, q[1] * 1, 0] as LM).map((q, i) => [q[0], q[1], i === 3 ? 0.3 : 0] as LM), 0.4), { z: ry * k, R: L.hry * 0.8 * k, H: L.hry * k, id: ID.HEAD, tex: (p, o) => {
      const [hx, hy] = Hr.local(p.x, p.y);
      o.m = plumage(L, M, 99, 0, hy < 0 ? 0.6 : -0.3, 1, -hx / k, hy / k, 0);
    } });
  }

  // --- folded wing (+ the shellwrench's orange carpal spur at the wrist)
  if (!flying) {
    const ext = L.wing.foldExt * k;
    const len = rx * 1.62 * k + ext, dep = ry * (L.id === 'twinfan' ? 0.8 : 1.02) * k;
    const c = B.p(rx * (L.id === 'twinfan' ? 0.3 : 0.5), -ry * (L.id === 'twinfan' ? 0.62 : 0.48) - P.lift * 0.8);
    const a = B.ang(Math.PI + 0.06 - P.lift * 0.3 + P.droop * 0.2);
    const FL: FoldLook = { len: 1, dep: 1, tert: L.id === 'twinfan' ? 0.62 : 0.55, nP: 5, cov: 0.38, gc: 0.58 };
    const fm = foldMapBack(c, a, len, dep, P.droop * 0.5);
    BR.region(spline(foldOutline(fm.map, FL), 0.4), { z: ry * 0.85 * k, R: 1 * k, H: 1.3 * k, id: ID.FOLD, tex: foldTex(FL, fm.inv, (f, o) => foldFill(L, M, f.zone, f.u, f.v, f.edge, f.fi, o)) });
    if (L.id === 'shellwrench') {
      const w = fm.map(0.02, 0.38);
      const tip: V2 = [w[0] + 1.6 * k, w[1] - 0.6 * k - P.spur * 1.4];
      BR.region(spline([[w[0] - 0.6, w[1] - 0.8, 0], [tip[0], tip[1], 0.9], [w[0] + 0.2, w[1] + 1, 0]], 0.3), { z: ry * k + 3, R: 0.5, H: 0.6, id: ID.SPUR, tex: M.spurM });
    }
  }

  // --- bill
  const tipPt = back ? H.s2(0, 0) : drawBill(BR, M, L, H, P, k);
  BR.shadow(ID.FOLD, 0.5, 1, 0.1, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.3, seam: 0.55, seamDark: 0.24, ao: 0.05, aoR: 2 });
  if (L.id === 'shellwrench' && !back) crossTips(sk, M, L, H, P, k);

  // --- eye
  let eyeC: V2;
  if (back) {
    eyeC = B.p(rx * 0.5, -ry * 0.75);
    eyeC = drawEye(sk, eyeC[0], eyeC[1], { ...L.eye, r: juv ? Math.max(0.5, L.eye.r * 0.8) : L.eye.r }, P.eye ?? eyeSt);
  } else {
    const ep = H.s2(L.hrx * 0.22 * k, -L.hry * 0.22 * k, L.hry * k);
    eyeC = drawEye(sk, ep[0], ep[1], { ...L.eye, r: juv ? Math.max(0.5, L.eye.r * 0.8) : L.eye.r }, P.eye ?? eyeSt);
    if (L.id === 'shellwrench' && (P.eye ?? eyeSt) !== 'closed') {
      // the orange orbital ring
      const x = Math.floor(eyeC[0] - 0.5), y = Math.floor(eyeC[1] - 0.5), ring = hex('#f08a2a');
      sk.overPaint(x - 1, y, ring); sk.overPaint(x - 1, y + 1, ring); sk.overPaint(x, y + 2, ring); sk.overPaint(x + 1, y + 2, ring);
    }
    if (L.id === 'swashrunner' && (P.eye ?? eyeSt) !== 'closed') {
      // the yellow orbital ring that makes the eye show inside the black mask
      const x = Math.floor(eyeC[0]), y = Math.floor(eyeC[1]);
      sk.overPaint(x + 1, y, hex('#f2c84a'));
      if (L.hry * k > 3) sk.overPaint(x - 1, y, hex('#f2c84a'));
    }
    if (L.id === 'twinfan') {
      // rictal bristles round the gape
      const q = H.s2(L.hrx * 0.95 * k, L.hry * 0.25 * k), c = hex('#2a2420');
      sk.over(q[0] + 1, q[1] - 1, c); sk.over(q[0] + 1, q[1] + 1, c); sk.over(q[0] + 2, q[1] + 0, c);
    }
  }

  // --- near leg + near wing
  drawLeg(true);
  if (flying) {
    const R = Relief.full(sk);
    wing(R, VW, wingFrame(L.wing.shape, kw((P.wing as [WingPose, WingPose])[0]), 1), L.wing.look, wf, { id: ID.WING });
    sk.np();
    R.emit({ drop: 1, seam: 0.5, seamDark: 0.2 });
  }

  // --- things in the bill
  if (P.prey) drawPrey(sk, M, P, tipPt, H, k);
  const top = H.s2(0, -L.hry * k - 2);
  return { head: [top[0], top[1] - 2 * k], eye: eyeC };
}

/** a wing-local map pointing back along the body from the carpal c (axis angle a, screen) */
function foldMapBack(c: V2, a: number, len: number, dep: number, droop: number) {
  const ca = Math.cos(a), sa = Math.sin(a);
  // u runs along (ca, sa) (backward), v runs across, downward on screen
  let nx = -sa, ny = ca;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const map = (u: number, v: number): V2 => {
    const y = v * dep + droop * u * u * dep;
    return [c[0] + ca * u * len + nx * y, c[1] + sa * u * len + ny * y];
  };
  const inv = (x: number, y: number): V2 => {
    const dx = x - c[0], dy = y - c[1];
    const det = ca * ny - sa * nx || 1e-6;
    const ul = (dx * ny - dy * nx) / det, yl = (ca * dy - sa * dx) / det;
    const u = ul / len;
    return [u, (yl - droop * u * u * dep) / dep];
  };
  return { map, inv };
}

function foldFill(L: Look, M: M, zone: string, u: number, v: number, edge: number, fi: number, o: Tx) {
  switch (L.id) {
    case 'swashrunner':
      // sandy feathers, each with a pale fringe and a dark centre (scaly), dark primaries
      if (zone === 'pri') { o.m = edge < 0.3 ? M.wing : M.prim; return; }
      if (zone === 'les') { o.m = edge < 0.35 ? M.belly : M.cov; return; }
      if (zone === 'gc') { o.m = v > 0.5 ? M.belly : M.wing; return; }
      o.m = edge < 0.3 ? M.cov : M.wing;
      if (zone === 'ter' && fi % 2) o.t -= 0.05;
      return;
    case 'shellwrench':
      // black with the broad white wing bar of the greater coverts' tips and secondaries' bases
      if (zone === 'pri') { o.m = M.prim; if (edge < 0.3) o.t += 0.08; return; }
      if (zone === 'gc' && v > 0.48) { o.m = M.mark2; return; }
      if (zone === 'sec' && v > 0.66 && u < 0.45) { o.m = M.mark2; return; }
      o.m = zone === 'les' ? M.cov : M.wing;
      if (edge < 0.3) o.t += 0.06;
      return;
    default:
      // twinfan: dusky brown with rufous-edged coverts and tertials, dark primaries
      if (zone === 'pri') { o.m = M.prim; return; }
      if (zone === 'gc') { o.m = v > 0.5 ? M.cov : M.wing; return; }
      o.m = edge < 0.3 ? M.cov : M.wing;
  }
}

function wingFill(L: Look, M: M) {
  const nr = L.wing.look.rows.length;
  return (w: WingPx, o: Tx) => {
    switch (L.id) {
      case 'swashrunner':
        // sandy coverts, dark flight feathers with a long white wing stripe through their bases
        if (w.top) {
          if (w.zone < nr) { o.m = w.fu > 0.8 ? M.belly : M.cov; return; }
          o.m = w.fu < 0.32 && w.c > 0.2 ? M.belly : w.edge < 0.3 ? M.wing : M.prim;
          return;
        }
        o.m = w.zone < nr ? M.under : w.fu > 0.6 ? M.prim : M.under;
        return;
      case 'shellwrench':
        // black with a white bar the length of the wing (the bases of the flight feathers)
        if (w.top) {
          if (w.zone < nr) { o.m = w.zone === nr - 1 && w.fu > 0.7 ? M.mark2 : M.cov; return; }
          o.m = w.fu < 0.45 && w.s < 0.82 ? M.mark2 : M.prim;
          if (w.edge < 0.3 && o.m === M.prim) o.t += 0.06;
          return;
        }
        o.m = w.zone < nr ? M.mark2 : w.fu > 0.55 ? M.prim : M.mark2;
        return;
      default:
        // twinfan: dusky wings with buff covert tips, rounded fingered hand
        if (w.top) {
          if (w.zone < nr) { o.m = w.fu > 0.8 ? M.cov : M.wing; return; }
          o.m = w.edge < 0.3 ? M.wing : M.prim;
          return;
        }
        o.m = w.zone < nr ? M.belly : M.wing;
    }
  };
}

/** The bill of each species, a contour in the head frame; returns the working tip. */
function drawBill(R: Relief, M: M, L: Look, H: HeadF, P: BP, k: number): V2 {
  const open = P.open;
  const bx = L.hrx * 0.86 * k; // bill base (head-local x)
  const z0 = L.hry * k + 2;
  if (L.id === 'shellwrench') {
    // long, slim and flattened like a chisel; the tips cross like pliers (twist flexes the cross)
    const len = 8.4 * k, tw = P.twist * 0.35 * k;
    const oa = open * 0.3, co = Math.cos(oa), so = Math.sin(oa);
    const J = (x: number, y: number, sh = 0): LM => { const dx = x - bx, dy = y; return H.s(bx + dx * co - dy * so, dx * so + dy * co, 0, sh); };
    // lower mandible (its crossed tip is placed pixel by pixel after the lighting, see crossTips)
    R.region(spline([J(bx - 0.2, 0.15), J(bx + len * 0.55, 0.3), J(bx + len * 0.97, 0.35, 0.5), J(bx + len * 0.97, 0.95 * k, 0.5), J(bx + len * 0.5, 1.0 * k), J(bx - 0.2, 1.1 * k)], 0.3), { z: z0, R: 0.5, H: 0.5, id: ID.JAW, tex: (p, o) => {
      const [hx] = H.local(p.x, p.y);
      o.m = hx > bx + len * 0.86 ? M.tip : M.bill;
    } });
    if (open > 0.3) R.region(spline([H.s(bx, 0.2), H.s(bx + len * 0.6, 0.15), J(bx + len * 0.6, 0.4), J(bx, 0.4)], 0.3), { z: z0 - 0.3, R: 0.3, H: 0.2, id: ID.JAW, tex: M.mouth });
    // upper mandible: deeper at the base, flattened like a chisel
    R.region(spline([H.s(bx - 0.3, -1.1 * k), H.s(bx + len * 0.5, -0.75 * k), H.s(bx + len, -0.6 * k, 0.5), H.s(bx + len, 0.3, 0.5), H.s(bx + len * 0.5, 0.3), H.s(bx - 0.2, 0.3)], 0.3), { z: z0 + 0.5, R: 0.6, H: 0.7, id: ID.BILL, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = hx > bx + len * 0.88 ? M.tip : M.bill;
      // the nostril groove along the base
      if (hx < bx + len * 0.4 && Math.abs(hy + 0.35 * k) < 0.25) o.z -= 0.4;
    } });
    void tw;
    return H.s2(bx + len * 0.98, 0.4 * k);
  }
  if (L.id === 'swashrunner') {
    // short black bill with a slightly swollen, touch-sensitive tip
    const len = 2.3 * k;
    const lo = open * 0.4;
    R.region(spline([H.s(bx - 0.2, -0.75 * k), H.s(bx + len * 0.45, -0.45 * k), H.s(bx + len * 0.85, -0.5 * k), H.s(bx + len * 1.02, 0.05 * k, 0.6), H.s(bx + len * 0.85, 0.5 * k + lo), H.s(bx + len * 0.45, 0.4 * k + lo * 0.6), H.s(bx - 0.2, 0.7 * k)], 0.3), { z: z0, R: 0.5, H: 0.5, id: ID.BILL, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = M.bill;
      if (open > 0.2 && hy > 0.05 && hx < bx + len * 0.8) o.m = M.mouth;
    } });
    return H.s2(bx + len, 0.1 * k);
  }
  // twinfan: a tiny, broad-based flycatcher bill, the lower mandible dropping open to snap insects
  const len = 1.9 * k;
  const lo = open * 1.1 * k;
  R.region(spline([H.s(bx - 0.4, -0.8 * k), H.s(bx + len * 0.6, -0.45 * k), H.s(bx + len, 0.05 * k, 0.7), H.s(bx + len * 0.55, 0.3 * k), H.s(bx - 0.3, 0.45 * k)], 0.3), { z: z0 + 0.4, R: 0.4, H: 0.4, id: ID.BILL, tex: M.bill });
  R.region(spline([H.s(bx - 0.3, 0.45 * k), H.s(bx + len * 0.85, 0.35 * k + lo * 0.8, 0.6), H.s(bx + len * 0.4, 0.8 * k + lo * 0.6), H.s(bx - 0.3, 0.85 * k)], 0.3), { z: z0, R: 0.4, H: 0.3, id: ID.JAW, tex: open > 0.3 ? M.mouth : M.bill });
  return H.s2(bx + len, 0.2 * k);
}

/**
 * The Shellwrench's crossed tips, placed pixel by pixel: the upper mandible's tip hooks down past the
 * lower, the lower's tip bends up past the upper (an X at the end of the bill); twisting flexes it.
 */
function crossTips(sk: Sk, M: M, L: Look, H: HeadF, P: BP, k: number) {
  const bx = L.hrx * 0.86 * k, len = 8.4 * k, tw = P.twist * 0.4 * k;
  const oa = P.open * 0.3;
  const zU = 40, zL = 39;
  const u0 = H.s2(bx + len * 0.97, -0.2 * k), u1 = H.s2(bx + len + 1.2 * k, 1.5 * k + tw);
  const lj = (x: number, y: number) => { const dx = x - bx; return H.s2(bx + dx * Math.cos(oa) - y * Math.sin(oa), dx * Math.sin(oa) + y * Math.cos(oa)); };
  const l0 = lj(bx + len * 0.95, 0.7 * k), l1 = lj(bx + len + 1.1 * k, -0.95 * k - tw);
  sk.line(l0[0], l0[1], l1[0], l1[1], M.tip, 0.5, zL);
  sk.line(u0[0], u0[1], u1[0], u1[1], M.tip, 0.72, zU);
}

/** Twinfan: two separate fans on a split tail, upper and lower, flared independently. */
function twinFans(R: Relief, M: M, L: Look, rump: V2, tA: number, P: BP, k: number) {
  const V0 = new View3(0, 0, 0, [0, 0], 1);
  // each fan lies in the plane of the screen: dark feathers with crisp white tips; an open fan shows
  // a white outer edge
  const one = (a: number, spread: number, z: number, outer: 'up' | 'down', id: number) => {
    const n = 4;
    const dir: V3 = [Math.cos(a), -Math.sin(a), 0], lat: V3 = [Math.sin(a), Math.cos(a), 0];
    const F: FanOut = fan(V0, B3(rump), dir, lat, n, 0.14 + spread * 0.95, t => L.tail.L * k * (0.95 + spread * 0.15) * (1 - Math.abs(t - 0.5) * 0.12), { minW: 1.2 * k, notch: 0.12, base: 0.7 * k, point: 0.35 });
    R.region(spline(F.poly, 0.35), { z, R: 0.7, H: 0.8, id, tex: (p, o) => {
      const q = fanAt(F, p.x, p.y);
      o.m = M.tail;
      if (q.u > 0.74) o.m = M.tailW;
      // screen: a larger angle points a backward feather further down; outer edge by fan
      const edgeI = outer === 'up' ? 0 : n - 1;
      if (q.i === edgeI && spread > 0.3 && q.u > 0.25) o.m = M.tailW;
      if (q.edge < 0.28) o.z -= 0.35;
    } });
  };
  one(tA - 0.06 - P.fanL * 0.5, P.fanL, -2.4, 'down', ID.TAIL2);
  one(tA + 0.06 + P.fanU * 0.55, P.fanU, -1.6, 'up', ID.TAIL);
}

function drawPrey(sk: Sk, M: M, P: BP, tip: V2, H: HeadF, k: number) {
  const R = Relief.full(sk);
  const hang = (cx: number, cy: number, rx: number, ry: number, a: number): LM[] => {
    // a mussel: one blunt end, one pointed (a hand-shaped outline, not an ellipse)
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts: [number, number, number][] = [[-1, 0, 0.2], [-0.7, -0.75, 0], [0.1, -0.95, 0], [0.75, -0.55, 0], [1, 0.05, 0.5], [0.6, 0.6, 0], [-0.2, 0.85, 0], [-0.8, 0.55, 0]];
    return pts.map(([x, y, s]) => [cx + (x * rx * ca - y * ry * sa), cy + (x * rx * sa + y * ry * ca), s] as LM);
  };
  if (P.prey === 'mussel') {
    // a blue-black mussel clamped in the crossed tips, turning as the head twists
    const c: V2 = [tip[0] + 0.6 * k, tip[1] + 1.8 * k];
    const a = Math.atan2(H.fwd[1] * -1, H.fwd[0]) + 1.2 + P.twist * 0.35;
    R.region(spline(hang(c[0], c[1], 2.3 * k, 1.3 * k, a), 0.35), { z: 12, R: 0.8, H: 1, id: ID.PREY, tex: (p, o) => {
      const d = (p.x - c[0]) * Math.cos(a) + (p.y - c[1]) * Math.sin(a);
      o.m = M.shell;
      if (fr(d * 0.9) < 0.2) o.z -= 0.3; // growth rings
    } });
  } else if (P.prey === 'musselOpen') {
    const c: V2 = [tip[0] + 0.6 * k, tip[1] + 1.4 * k];
    R.region(spline(hang(c[0] - 1, c[1], 1.9 * k, 1 * k, 0.6), 0.35), { z: 12, R: 0.6, H: 0.8, id: ID.PREY, tex: M.shell });
    R.region(spline(hang(c[0] + 1, c[1] + 0.4, 1.9 * k, 1 * k, 1.9), 0.35), { z: 12, R: 0.6, H: 0.8, id: ID.PREY + 1, tex: (p, o) => { o.m = M.nacre; if (Math.hypot(p.x - c[0] - 1, p.y - c[1] - 0.4) < 0.9 * k) o.m = M.flesh; } });
  } else if (P.prey === 'hopper' || P.prey === 'moth') {
    const m = P.prey === 'moth';
    R.region(spline([[tip[0] - 0.4, tip[1] - 0.2, 0], [tip[0] + 1.2 * k, tip[1] - (m ? 1.2 : 0.4) * k, 0.6], [tip[0] + 1.4 * k, tip[1] + 0.4, 0], [tip[0] + 0.2, tip[1] + 0.8 * k, 0.6]], 0.3), { z: 12, R: 0.4, H: 0.4, id: ID.PREY, tex: M.bug });
  }
  sk.np();
  R.emit({ drop: 1, seam: 0.5, seamDark: 0.2 });
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
const seg = (len: number, sweep: number, flex: number, shrink: number, dih = 0.05) => ({ len, sweep, dih, flex, shrink });

export const SWASHRUNNER = makeBird({
  look: {
    id: 'swashrunner', name: 'Swashrunner', len: 12, height: 12,
    rx: 3.8, ry: 3.1, stance: -0.22, neckL: 1.3, neckR0: 2.2, neckR1: 1.9, hrx: 2.6, hry: 2.45,
    leg: { tib: 2.8, tar: 4.0, toe: 3.5, foot: 'lobe', hallux: 1 }, hipX: -0.4,
    tail: { L: 2.8, n: 5, spread: 0.3 },
    wing: {
      shape: { sh: [1.1, 1.1, 1.4], segs: [seg(2.5, -0.1, -0.6, 0.2), seg(3.0, 0.3, 0.9, 0.25), seg(6.0, -0.5, -0.9, 0.4, 0.02)], chord: [3.1, 3.3, 2.6, 0.4], spar: 0.5 },
      look: { wrist: 2, nS: 5, scallop: 0.1, nP: 6, slot: 0.18, fingers: 2, rows: [0.3], spar: 0.55, minW: 1, point: 0.8, reach: 0.4 },
      foldExt: 1.6,
    },
    eye: { r: 0.6, iris: hex('#141012'), lash: hex('#141012') },
    cols: { back: '#b8a88c', belly: '#f6f4ee', head: '#b0a084', wing: '#8a7a62', prim: '#4a4038', cov: '#c4b496', tail: '#5a4e42', bill: '#1e1a1c', leg: '#eca040', web: '#f6c878', mark: '#1e1a1c' },
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
    rx: 5.6, ry: 3.7, stance: -0.3, neckL: 2.0, neckR0: 2.5, neckR1: 2.2, hrx: 3.0, hry: 2.7,
    leg: { tib: 3.8, tar: 4.4, toe: 3, foot: 'plain', thick: true, hallux: 0 }, hipX: -0.6,
    tail: { L: 3.6, n: 6, spread: 0.3 },
    wing: {
      shape: { sh: [1.6, 1.3, 1.8], segs: [seg(3.4, -0.1, -0.6, 0.2), seg(4.6, 0.28, 0.9, 0.25), seg(8.2, -0.4, -0.9, 0.4, 0.02)], chord: [4.4, 4.6, 3.8, 0.6], spar: 0.6 },
      look: { wrist: 2, nS: 7, scallop: 0.08, nP: 7, slot: 0.22, fingers: 3, rows: [0.18, 0.36], spar: 0.7, minW: 1.1, point: 0.75, reach: 0.4 },
      foldExt: 2.6,
    },
    eye: { r: 1, iris: hex('#e02a1e'), lash: hex('#140c0c'), ring: hex('#f08a2a') },
    cols: { back: '#1e1c22', belly: '#f4f2ec', head: '#18161c', wing: '#24222a', prim: '#141216', cov: '#2c2a32', tail: '#1a181e', bill: '#f0581e', billTip: '#f6c040', leg: '#e89a9a', mark: '#1e1c22', mark2: '#f4f2ec' },
    flap: 0.95, light: 0.22, bellyBias: 0.4,
  },
  anims: { idle: A(4, 2.5), walk: A(6, 8), run: A(6, 14), probe: A(4, 7), pry: A(6, 6), eat: A(4, 7), pipe: A(4, 8), alert: A(2, 3), call: A(2, 5), rest: A(2, 1.2), takeoff: A(3, 10, false), fly: A(6, 11), glide: A(2, 2), land: A(3, 8, false) },
  ground: { w: 44, h: 36, ox: 18, oy: 31 },
  flight: { w: 64, h: 50, ox: 32, oy: 25 },
  airAnims: ['fly', 'glide', 'land'],
});

export const TWINFAN = makeBird({
  look: {
    id: 'twinfan', name: 'Twinfan', len: 15, height: 11,
    rx: 3.6, ry: 3, stance: -0.95, neckL: 0.7, neckR0: 2.3, neckR1: 2.1, hrx: 2.5, hry: 2.35,
    leg: { tib: 1.6, tar: 2, toe: 1.8, foot: 'perch', hallux: 1.6 }, hipX: -0.2,
    tail: { L: 8.5, n: 4, spread: 0.2 },
    wing: {
      shape: { sh: [1.1, 1.1, 1.4], segs: [seg(2.4, -0.05, -0.6, 0.2), seg(3.1, 0.3, 0.9, 0.25), seg(5, -0.25, -0.9, 0.4, 0.02)], chord: [3.4, 3.6, 3.4, 1.4], spar: 0.5 },
      look: { wrist: 2, nS: 5, scallop: 0.1, nP: 6, slot: 0.4, fingers: 4, rows: [0.32], spar: 0.55, minW: 1, point: 0.45, reach: 0.9 },
      foldExt: 1,
    },
    eye: { r: 0.8, iris: hex('#141012'), lash: hex('#141012') },
    cols: { back: '#4a3c32', belly: '#ec9e5a', head: '#3a3029', wing: '#3e3229', prim: '#221c18', cov: '#6a5848', tail: '#1e1814', bill: '#1a1616', leg: '#3a3230', mark: '#16120f', mark2: '#fbf8f2' },
    flap: 1.15, perch: true, bellyBias: 0.15, light: 0.32,
  },
  anims: { idle: A(4, 4), hop: A(4, 10), fan: A(4, 8), call: A(2, 6), alert: A(2, 3), fly: A(4, 18), glide: A(2, 3), hawk: A(4, 14), land: A(3, 10, false) },
  ground: { w: 40, h: 36, ox: 19, oy: 26 },
  flight: { w: 48, h: 44, ox: 24, oy: 22 },
  airAnims: ['fly', 'glide', 'hawk', 'land'],
});
void hh; void clamp; void foldMap;

/**
 * A bush twig for the twinfan to perch on (anchored at the perch point, the twig's top middle):
 * a mossy stem sprouting from the left with a few small leaves.
 */
export function paintTwig(seed: number): { buf: PixelBuffer; ax: number; ay: number; root: [number, number] } {
  const sk = new Sk(30, 14, 15, 3);
  const bark = sk.m(rmp('#5a4632', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 });
  const moss = sk.m(rmp('#6a7a32', { n: 4, dark: 0.5 }), { edge: 0 });
  const leaf = sk.m(rmp('#4e7a34', { n: 5, dark: 0.55, light: 0.4 }), { edge: 1 });
  sk.np();
  const pts: V2[] = [[-15, 3 + hh(seed, 1, 2) * 3], [-6, 1.2], [6, 0.6], [11, 0.4 - hh(seed, 2, 2)]];
  sk.tube(pts, t => 1.2 - t * 0.6, (p) => (p.v < -0.4 && hh(Math.floor(p.x), seed, 3) < 0.4 ? moss : bark), { z: 0 });
  for (let i = 0; i < 4; i++) {
    const x = -10 + i * 6 + hh(i, seed, 4) * 3, up = i % 2 ? -1 : 1;
    const a = up < 0 ? -0.9 - hh(i, seed, 5) * 0.6 : 0.7 + hh(i, seed, 6) * 0.6;
    sk.np();
    sk.blade(x, 1, x + Math.cos(a) * 4, 1 + Math.sin(a) * 4, s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * 1.3 + 0.2, leaf, { z0: 2, z1: 2 });
  }
  // root: where the twig's thick end meets the sapling it grows from (relative to the anchor)
  return { buf: sk.resolve(), ax: 15, ay: 3, root: [-14, pts[0][1] - 0.5] };
}
