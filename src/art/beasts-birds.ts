// V2 birds: one parametric bird body (egg body, neck chain, head, beak, IK legs, fanned tail,
// layered folded wing, 3D spread wings) driven by per-species looks and a shared pose library.
// Gale Hawk, Crag Auk, Torrent Dipper, Thunder Stork, Monarch and Nutcracker are all built from it.

import { Sk, V2, V3, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, gait, qbez, fr, hh } from './beasts-core';
import { Frame2 } from './beasts-rig';
import { spreadWing, foldedWing, birdLeg, tailFan, scallop, WingLook, WingPose, BirdLegLook } from './beasts-bird';
import { hex } from './color';

// ------------------------------------------------------------------ look
interface BirdCols {
  back: string; belly: string; head: string; neck?: string; wing: string; prim: string; cov?: string; tail?: string;
  beak: string; beakTip?: string; leg: string; claw?: string; throat?: string; crest?: string; mask?: string; cere?: string; web?: string;
}
interface BirdLook {
  name: string; len: number; height: number;
  rx: number; ry: number;            // body radii
  stance: number;                     // resting body pitch (- = upright)
  neckL: number; neckR0: number; neckR1: number; neckS: number; // neck length / radii / S-curve
  hrx: number; hry: number;           // head radii
  beak: { len: number; d: number; hook: number; curve: number; lower?: number };
  leg: BirdLegLook; hipX: number;      // hip offset along body (px, - = toward tail)
  tail: { L: number; hw: number; n: number; spread: number; pointed?: number; cock?: number };
  wing: Omit<WingLook, 'fill'> & { foldExt: number };
  eye: EyeSpec;
  cols: BirdCols;
  crest?: { n: number; len: number };
  bareNeck?: boolean;                 // monarch: pale skin neck with a feather ruff
  bars?: boolean;                     // barred underparts (hawk)
  spots?: boolean;                    // pale spots (nutcracker)
  scaleLegs?: boolean;                // armoured leg scales (stork)
  throatFlare?: boolean;              // throat patch that inflates in display (auk)
  eyelid?: boolean;                   // white eyelid flash (dipper)
  mask?: boolean;                     // coloured face mask (stork)
  flap: number;                       // flap amplitude (0.6 heavy soarers .. 1.1 small birds)
}

// ------------------------------------------------------------------ pose
interface BP {
  air: boolean;
  b: V2; ba: number;                  // body centre (anchor-relative) and pitch
  na: number; nl: number; nc: number; // neck angle (world), length mult, curvature
  ha: number; open: number;           // head angle (world), beak open 0..1
  feet: [V2, V2];                     // foot targets near/far (ground)
  tuck: number; grip: number; reach: number; // flight: tuck 1 = folded under; reach = talons forward
  wing: 'fold' | [WingPose, WingPose];
  droop: number; lift: number;        // folded-wing droop / lift (display, shrug)
  tailA: number; tailSp: number;
  crest: number; throat: number; lid: boolean;
  sink: number;                       // water line (local y), Infinity = none
  prey?: 'snake' | 'fish' | 'seed' | 'meat';
  preyA?: number;
  ruffle: number;                     // fluffed feathers (sleep)
  eye?: BeastEye;
}

function stand(L: BirdLook): BP {
  const legH = (L.leg.tib + L.leg.tar) * 0.78;
  return {
    air: false, b: [0, -(legH + L.ry * 0.72)], ba: L.stance,
    na: -1.2, nl: 1, nc: L.neckS, ha: 0.05, open: 0,
    feet: [[1.2, 0], [-1.6, 0]], tuck: 0, grip: 0, reach: 0,
    wing: 'fold', droop: 0, lift: 0, tailA: 0, tailSp: 1, crest: 0, throat: 0, lid: false, sink: Infinity, ruffle: 0,
  };
}

/** Flap pose at phase t (0 = top of the upstroke). */
function flapPose(t: number, amp: number, spread = 1): WingPose {
  const c = Math.cos(t * TAU);
  const up = t > 0.5; // recovery stroke: wing partly folded
  return {
    th: (0.25 + 0.85 * c) * amp,
    hand: (-0.35 * Math.sin(t * TAU) + (up ? 0.25 : -0.05)) * amp,
    fold: up ? 0.5 * Math.sin((t - 0.5) * 2 * Math.PI) : 0,
    sweep: 0.12 + (up ? -0.15 : 0.05),
    spread,
  };
}
const both = (w: WingPose): [WingPose, WingPose] => [w, { ...w }];

type PoseFn = (L: BirdLook, f: number, n: number) => BP;

const G: Record<string, PoseFn> = {
  idle(L, f) {
    const p = stand(L);
    p.b[1] += f === 2 ? 0.4 : 0;
    p.ha = [0.05, 0.05, -0.2, 0.25][f];
    p.na = -1.2 + (f === 3 ? 0.15 : 0);
    p.tailA = f === 1 ? -0.08 : 0;
    return p;
  },
  walk(L, f, n) {
    const p = stand(L);
    const t = f / n, st = (L.leg.tib + L.leg.tar) * 0.55;
    p.feet = [add([0, 0], gait(t, 0.55, st, st * 0.35)), add([0, 0], gait(t + 0.5, 0.55, st, st * 0.35))];
    p.b = [p.b[0] + Math.sin(t * TAU * 2) * 0.3, p.b[1] + Math.abs(Math.sin(t * TAU)) * -0.8];
    // head bobbing: hold then thrust (pigeon style)
    const hb = fr(t * 2);
    p.nl = hb < 0.5 ? 0.9 : 1.08;
    p.na = -1.1 + (hb < 0.5 ? -0.08 : 0.12);
    p.tailA = Math.sin(t * TAU * 2) * 0.05;
    return p;
  },
  stalk(L, f, n) {
    // slow, crouched, neck drawn back ready to strike, one foot lifted high
    const p = stand(L);
    const t = f / n, st = (L.leg.tib + L.leg.tar) * 0.5;
    p.feet = [gait(t, 0.7, st, st * 0.7), gait(t + 0.5, 0.7, st, st * 0.7)];
    p.b[1] += 1;
    p.ba = L.stance + 0.15;
    p.na = -0.75; p.nl = 0.72; p.nc = L.neckS * 1.6;
    p.ha = 0.45;
    return p;
  },
  hop(L, f) {
    const p = stand(L);
    const h = [0, -3, -4, -1.5][f] * (L.leg.tib + L.leg.tar) * 0.12;
    p.b = [p.b[0] + [0, 1, 2, 3][f] * 0.5, p.b[1] + h + (f === 0 ? 1 : 0)];
    const lift = h;
    p.feet = [[1 + f * 0.5, lift * 0.6], [-1 + f * 0.5, lift * 0.6]];
    p.tailA = f === 1 ? -0.3 : f === 3 ? 0.15 : 0;
    p.droop = f === 1 || f === 2 ? 0.4 : 0;
    return p;
  },
  run(L, f, n) {
    const p = G.walk(L, f, n);
    p.ba = L.stance + 0.2; p.na = -0.8; p.droop = 0.6; p.lift = 0.4;
    return p;
  },
  alert(L, f) {
    const p = stand(L);
    p.b[1] -= 1;
    p.ba = L.stance - 0.12;
    p.na = -1.45; p.nl = 1.12;
    p.ha = f ? -0.12 : 0.1;
    p.crest = 1;
    p.tailA = -0.1;
    p.eye = 'alert';
    return p;
  },
  call(L, f) {
    const p = stand(L);
    p.na = -1.35 - (f ? 0.2 : 0); p.nl = 1.1;
    p.ha = f ? -0.55 : -0.25;
    p.open = f ? 1 : 0.5;
    p.throat = f ? 1 : 0.5;
    p.crest = 1;
    return p;
  },
  preen(L, f) {
    const p = stand(L);
    // head swung back into the wing, then the tail, then a shake
    const HS = [[2.4, 0.7, 2.6], [2.2, 0.55, 2.2], [1.9, 0.5, 1.4], [-1.5, 1.05, -0.2]];
    p.na = -HS[f][0]; p.nl = HS[f][1]; p.ha = HS[f][2];
    p.lift = f === 0 ? 0.5 : 0;
    p.tailSp = f === 2 ? 1.5 : 1;
    p.ruffle = f === 3 ? 1 : 0;
    p.open = f === 3 ? 0 : 0.3;
    return p;
  },
  eat(L, f) {
    const p = stand(L);
    p.ba = L.stance + 0.35;
    p.na = -0.2 + [0.9, 1.2, 0.9, 0.6][f]; p.nl = 1.05;
    p.ha = 0.9 + [0, 0.3, 0, -0.2][f];
    p.open = f === 1 ? 0.8 : f === 3 ? 0.4 : 0;
    p.tailA = -0.2;
    return p;
  },
  sleep(L, f) {
    const p = stand(L);
    p.b[1] += L.leg.tar * 0.5;
    p.feet = [[0.5, 0], [-0.5, 0]];
    p.na = -2.4; p.nl = 0.5; p.ha = 2.8;
    p.ruffle = 1 + f * 0.15;
    p.eye = 'closed';
    return p;
  },
  display(L, f) {
    // wings half raised, crest and throat up, head thrown back
    const p = stand(L);
    p.ba = L.stance - 0.25;
    p.na = -1.6; p.nl = 1.1;
    p.ha = f % 2 ? -0.9 : -0.5;
    p.open = f % 2 ? 1 : 0.2;
    p.lift = 1; p.droop = 0.3;
    p.crest = 1; p.throat = 1;
    p.tailSp = 1.6; p.tailA = -0.35;
    return p;
  },
  swim(L, f, n) {
    const p = stand(L);
    const t = f / n;
    p.b = [0, -L.ry * 0.35 + Math.sin(t * TAU) * 0.3];
    p.ba = 0.05;
    p.feet = [[-L.rx * 0.2 + Math.sin(t * TAU) * 2, -L.ry * 0.2], [-L.rx * 0.5 - Math.sin(t * TAU) * 2, -L.ry * 0.3]];
    p.na = -1.25; p.ha = 0.1;
    p.sink = -0.5;
    p.tailA = -0.2;
    return p;
  },
  dive(L, f, n) {
    // under the surface: body level, wings half open rowing, whole bird below the water line
    const t = f / n;
    const p = stand(L);
    p.b = [0, L.ry * 1.2];
    p.ba = 0.35;
    p.na = -0.2; p.nl = 0.8; p.ha = 0.35;
    p.feet = [[-L.rx * 0.6, L.ry * 1.3], [-L.rx * 0.8, L.ry * 1.4]];
    p.wing = both({ th: 0.2 + Math.cos(t * TAU) * 0.4, hand: -0.4, fold: 0.5, sweep: -0.3 });
    p.tuck = 1;
    return p;
  },
  bob(L, f) {
    const p = stand(L);
    // dipper bob: whole body dips on flexed legs, eyelid flashes white
    const d = [0, 1.6, 2.4, 0.8][f];
    p.b[1] += d;
    p.feet = [[1, 0], [-1, 0]];
    p.tailA = -0.35 + d * 0.08;
    p.lid = f === 2;
    p.ha = 0.1 - d * 0.05;
    return p;
  },
  strike(L, f) {
    // spear strike into the water / ground
    const p = stand(L);
    const K = [[-0.7, 0.62, 0.4, 0], [0.55, 1.35, 1.25, 0.3], [0.9, 1.5, 1.5, 0.6], [0.2, 1.05, 0.7, 0.2]][f];
    p.ba = L.stance + K[3];
    p.na = K[0]; p.nl = K[1]; p.ha = K[2];
    p.open = f === 2 ? 0.6 : 0;
    p.droop = f === 1 || f === 2 ? 0.5 : 0;
    p.tailA = -0.3 * K[3];
    return p;
  },
  clatter(L, f) {
    const p = G.display(L, f, 4);
    p.na = -1.9; p.ha = -1.3 + (f % 2) * 0.1;
    p.open = f % 2 ? 0.7 : 0;
    return p;
  },
  crack(L, f) {
    // big beak working a seed held in the bill
    const p = stand(L);
    p.ba = L.stance + 0.15;
    p.na = -1.0; p.ha = [0.35, 0.2, 0.45, 0.3][f];
    p.open = [0.2, 0.9, 0, 0.5][f];
    p.prey = 'seed';
    p.b[1] += f === 2 ? 0.4 : 0;
    return p;
  },
  feed(L, f) {
    // monarch tearing at a carcass: head down, wings mantled
    const p = G.eat(L, f, 4);
    p.lift = 0.6; p.droop = 0.8;
    p.ha = 1.2 + [0, 0.25, 0.1, -0.15][f];
    p.prey = f === 1 || f === 2 ? 'meat' : undefined;
    return p;
  },
};

function air(L: BirdLook): BP {
  const p = stand(L);
  p.air = true; p.b = [0, 0]; p.ba = 0.05;
  p.na = -0.15; p.nl = 0.85; p.nc = L.neckS * 0.3; p.ha = 0.05;
  p.tuck = 1;
  return p;
}
const AIR: Record<string, PoseFn> = {
  fly(L, f, n) {
    const p = air(L);
    const t = f / n;
    p.wing = both(flapPose(t, L.flap));
    p.b = [0, Math.sin(t * TAU) * 1.2];
    p.tailA = Math.sin(t * TAU) * 0.08;
    return p;
  },
  glide(L, f) {
    const p = air(L);
    p.wing = [{ th: 0.3 + f * 0.05, hand: -0.1, fold: 0.05, sweep: 0.1, spread: 1 }, { th: -0.25 + f * 0.05, hand: 0.05, fold: 0.05, sweep: 0.1, spread: 1 }];
    p.tailSp = 1.2;
    return p;
  },
  soar(L, f) {
    const p = air(L);
    p.wing = [{ th: 0.35, hand: 0.1 + f * 0.04, fold: 0, sweep: 0.05, spread: 1.25 }, { th: -0.2, hand: 0.12 + f * 0.04, fold: 0, sweep: 0.05, spread: 1.25 }];
    p.tailSp = 1.6;
    p.ha = 0.15 + f * 0.1;
    return p;
  },
  dive(L, f) {
    // stoop: wings tucked into a teardrop, head forward, body pitched down
    const p = air(L);
    p.ba = 0.75;
    p.na = 0.55; p.nl = 0.7; p.ha = 0.8;
    p.wing = both({ th: 0.55, hand: -0.2 - f * 0.05, fold: 0.85, sweep: -0.55 });
    p.tailSp = 0.6;
    p.crest = 0;
    return p;
  },
  strike(L, f) {
    // talons thrown forward, wings braking high
    const p = air(L);
    p.ba = -0.55;
    p.na = -0.6; p.ha = 0.5;
    p.wing = both({ th: 1.1 - f * 0.1, hand: 0.3, fold: 0.1, sweep: -0.35, spread: 1.3 });
    p.tuck = 0; p.reach = 1; p.grip = f ? 1 : 0.2;
    p.tailSp = 1.8; p.tailA = 0.4;
    p.crest = 1;
    p.eye = 'angry';
    return p;
  },
  carry(L, f, n) {
    const p = AIR.fly(L, f, n);
    p.tuck = 0.4; p.grip = 1; p.prey = 'snake'; p.preyA = Math.sin((f / n) * TAU) * 0.3;
    return p;
  },
  land(L, f) {
    const p = air(L);
    p.ba = [-0.3, -0.55, -0.35][f];
    p.wing = both({ th: [0.9, 0.7, 0.4][f], hand: [0.4, 0.1, -0.4][f], fold: [0, 0.1, 0.5][f], sweep: -0.3, spread: 1.3 });
    p.tuck = 0; p.reach = [0.6, 1, 0.7][f];
    p.tailSp = 1.8; p.tailA = 0.35;
    return p;
  },
};

const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];

// ------------------------------------------------------------------ materials
function mats(sk: Sk, L: BirdLook) {
  const c = L.cols;
  return {
    back: sk.m(rmp(c.back, { n: 6, dark: 0.62 }), { edge: 1 }),
    belly: sk.m(rmp(c.belly, { n: 5, dark: 0.5, at: 3 }), { edge: 1 }),
    head: sk.m(rmp(c.head, { n: 6, dark: 0.6 }), { edge: 1 }),
    neck: sk.m(rmp(c.neck ?? c.head, { n: 5, dark: 0.55 }), { edge: 1 }),
    wing: sk.m(rmp(c.wing, { n: 6, dark: 0.62 }), { edge: 2 }),
    cov: sk.m(rmp(c.cov ?? c.wing, { n: 6, dark: 0.6 }), { edge: 2 }),
    prim: sk.m(rmp(c.prim, { n: 6, dark: 0.62, light: 0.4 }), { edge: 2 }),
    under: sk.m(rmp(c.belly, { n: 5, dark: 0.55 }), { edge: 1, bias: -0.06 }),
    tail: sk.m(rmp(c.tail ?? c.back, { n: 6, dark: 0.62 }), { edge: 2 }),
    beak: sk.m(rmp(c.beak, { n: 5, dark: 0.5 }), { spec: 0.4 }),
    tip: sk.m(rmp(c.beakTip ?? c.beak, { n: 5, dark: 0.55 }), { spec: 0.4 }),
    cere: sk.m(rmp(c.cere ?? c.beak, { n: 4, dark: 0.5 })),
    leg: sk.m(rmp(c.leg, { n: 5, dark: 0.55 }), { edge: 1 }),
    scale: sk.m(rmp(c.leg, { n: 5, dark: 0.3, light: 0.6 }), { edge: 1 }),
    claw: sk.m(rmp(c.claw ?? '#2a2622', { n: 4, dark: 0.5 })),
    web: sk.m(rmp(c.web ?? c.leg, { n: 4, dark: 0.55 }), { edge: 0 }),
    throat: sk.m(rmp(c.throat ?? c.belly, { n: 5, dark: 0.5 }), { edge: 1 }),
    crest: sk.m(rmp(c.crest ?? c.head, { n: 5, dark: 0.6 }), { edge: 2 }),
    mask: sk.m(rmp(c.mask ?? c.head, { n: 5, dark: 0.55 }), { edge: 1 }),
    mouth: sk.m(rmp('#5a1c26', { n: 3, dark: 0.4 }), { edge: 0 }),
    snake: sk.m(rmp('#6f8a3c', { n: 5, dark: 0.6 }), { edge: 1 }),
    snakeB: sk.m(rmp('#e0c96a', { n: 4, dark: 0.5 }), { edge: 1 }),
    fish: sk.m(rmp('#b8c8cc', { n: 5, dark: 0.55, light: 0.6 }), { spec: 0.5 }),
    seed: sk.m(rmp('#7a5a34', { n: 4, dark: 0.5 })),
    meat: sk.m(rmp('#9a3a34', { n: 4, dark: 0.55 })),
    water: sk.m(rmp('#bfe6f0', { n: 3, dark: 0.3 }), { noRim: true, edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

// ------------------------------------------------------------------ draw
function drawBird(sk: Sk, L: BirdLook, P: BP, eyeSt: BeastEye, juv: boolean): { head: V2; eye: V2 } {
  const M = mats(sk, L);
  const k = juv ? 0.7 : 1;
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const b = S(P.b);
  if (P.sink !== Infinity) sk.clipY = P.sink;
  const B = new Frame2(b, P.ba, k);
  const rx = L.rx * (1 + P.ruffle * 0.1), ry = L.ry * (1 + P.ruffle * 0.16);
  const ruff = P.ruffle;
  const fillW = (row: string, under: boolean) => (under ? (row === 'P' ? M.prim : row === 'S' ? M.wing : M.under) : row === 'P' ? M.prim : row === 'S' ? M.wing : M.cov);
  const WL: WingLook = { ...L.wing, fill: (p: Px, row, i, under) => {
    if (L.bars && under && (row === 'P' || row === 'S') && fr(p.t * 5 + i * 0.3) < 0.28) p.l -= 0.16;
    if (!under && row === 'P' && p.t > 0.7) p.l -= 0.05;
    return fillW(row, under);
  } };
  const bodyZ = (): number => ry * k * 0.9 + 0.8;

  // --- far leg
  const hip = B.p(L.hipX, ry * 0.45);
  const legFill = { tib: M.back, tar: (p: Px) => (L.scaleLegs && fr(p.t * 6) < 0.3 ? M.scale : M.leg), toe: M.leg, claw: M.claw, web: M.web };
  const drawLeg = (near: boolean) => {
    sk.np();
    const z = near ? 3 : -3, bias = near ? 0 : -0.14;
    const h: V2 = [hip[0] + (near ? 0.5 : -0.5) * k, hip[1]];
    let foot: V2;
    if (P.air || P.tuck > 0) {
      // tucked back under the tail, or thrown forward for a strike
      const tuck = P.tuck;
      const back: V2 = B.p(-rx * 0.9, ry * 0.9);
      const fwd: V2 = B.p(rx * 1.2, ry * 1.6);
      const t2 = P.reach;
      foot = [back[0] + (fwd[0] - back[0]) * t2 + (near ? 1 : -1) * k, back[1] + (fwd[1] - back[1]) * t2 + (1 - tuck) * 3 * k];
      if (!P.air) foot = add(S(near ? P.feet[0] : P.feet[1]), [0, 0]);
      birdLeg(sk, h, foot, L.leg, k, legFill, z, bias, P.grip, tuck * (1 - P.reach));
    } else {
      foot = S(near ? P.feet[0] : P.feet[1]);
      foot = [foot[0] + L.hipX * k * 0.3, foot[1]];
      birdLeg(sk, h, foot, L.leg, k, legFill, z, bias, P.grip, 0);
    }
  };
  drawLeg(false);

  // --- far spread wing
  const sh3 = (side: 1 | -1): V3 => [rx * 0.3 * k, ry * 0.35 * k, side * ry * 0.45 * k];
  if (P.wing !== 'fold') spreadWing(sk, b, sh3(-1), WL, P.wing[1], -1, k, -0.14);

  // --- tail
  const rump = B.p(-rx * 0.82, -ry * 0.05);
  const tA = B.ang(Math.PI + 0.15 + P.tailA - (L.tail.cock ?? 0) + (P.air ? 0 : Math.min(0, P.ba) * 0.7));
  tailFan(sk, rump, tA, L.tail.L * k, L.tail.hw, L.tail.n, L.tail.spread * P.tailSp, (p, i) => {
    if (L.bars && fr(p.t * 4) < 0.25) p.l -= 0.14;
    if (i === Math.floor(L.tail.n / 2)) p.l += 0.03;
    return M.tail;
  }, -1, k, 0, L.tail.pointed ?? 0);

  // --- body
  sk.np();
  sk.ell(b[0], b[1], rx * k, ry * k, (p) => {
    p.l += scallop(p.x, p.y, 3 * k, 2.2 * k, 3) * (0.6 + ruff * 0.5);
    const belly = p.v > 0.1 - p.u * 0.25;
    if (belly) {
      if (L.bars && fr(p.y / (1.6 * k)) < 0.35 && p.v > 0.3) p.l -= 0.2;
      return M.belly;
    }
    if (L.spots && hh(p.x * 0.7, p.y * 0.7, 9) < 0.14) return M.belly;
    return M.back;
  }, { rot: P.ba, rz: ry * k * 0.9 });
  const bodyPart = sk.pid;
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny > 0.3 ? [-0.3, 1] as V2 : nx < -0.6 ? [-1, 0.3] as V2 : null), { every: juv ? 2 : 3, len: 1 });

  // --- folded wing (on the body side) — or a mantle when lifted
  if (P.wing === 'fold') foldedWing(sk, B, rx * k, ry * k, WL, bodyZ, { ext: L.wing.foldExt, droop: P.droop, lift: P.lift, nP: 4, nS: 4 });

  // --- neck
  const nb = B.p(rx * 0.62, -ry * 0.28);
  const nl = L.neckL * P.nl * k;
  const hp: V2 = [nb[0] + Math.cos(P.na) * nl, nb[1] + Math.sin(P.na) * nl];
  // S-curve control point: sideways from the neck line
  const perp: V2 = [-Math.sin(P.na), Math.cos(P.na)];
  const ctrl: V2 = [(nb[0] + hp[0]) / 2 + perp[0] * P.nc * nl * 0.5, (nb[1] + hp[1]) / 2 + perp[1] * P.nc * nl * 0.5];
  if (nl > 0.8) {
    sk.np();
    const pts = qbez(nb, ctrl, hp, 8);
    sk.tube(pts, t => (L.neckR0 + (L.neckR1 - L.neckR0) * t) * k * (1 + ruff * 0.2), (p) => {
      if (L.bareNeck) return p.t < 0.22 ? M.back : M.neck;
      if (L.throatFlare && p.v > 0.1 && p.t > 0.4) return M.throat;
      return p.v > 0.35 ? M.belly : M.neck;
    }, { z: 1.5 });
    if (L.bareNeck) {
      // feather ruff around the neck base
      sk.np();
      for (let i = 0; i < 7; i++) {
        const a = -1.4 + i * 0.45;
        const q = [nb[0] + Math.cos(a) * L.neckR0 * 1.3 * k, nb[1] + Math.sin(a) * L.neckR0 * 1.1 * k];
        sk.ell(q[0], q[1], L.neckR0 * 0.9 * k, L.neckR0 * 0.7 * k, M.belly, { z: 3 + i * 0.1, rot: a });
      }
      sk.tufts(sk.pid, () => [0, 1] as V2, { every: 2, len: 1 });
    }
  }

  // --- head
  const H = new Frame2(hp, P.ha, k);
  sk.np();
  const hc = H.p(0, 0);
  const throatK = L.throatFlare ? P.throat : 0;
  sk.ell(hc[0], hc[1], L.hrx * k, L.hry * k, (p) => {
    if (L.mask && p.v < 0.1 && p.v > -0.55 && p.u > -0.2) return M.mask;
    if (p.v > 0.45 - throatK * 0.3) return L.throatFlare ? M.throat : L.bareNeck ? M.neck : M.belly;
    return M.head;
  }, { rot: P.ha, rz: L.hry * k * 0.95, z: 3 });
  if (throatK > 0.2) {
    const tp = H.p(-L.hrx * 0.1, L.hry * 0.9);
    sk.ell(tp[0], tp[1], L.hrx * 0.8 * k, L.hry * (0.45 + throatK * 0.35) * k, M.throat, { z: 3.5, rot: P.ha });
  }
  // crest feathers
  if (L.crest) {
    sk.np();
    for (let i = 0; i < L.crest.n; i++) {
      const bx = -L.hrx * (0.1 + i * 0.3), by = -L.hry * 0.75;
      const a = -Math.PI + 0.35 + i * 0.15 - P.crest * 0.6;
      const base = H.p(bx, by), tip = [base[0] + Math.cos(H.ang(a)) * L.crest.len * k * (1 - i * 0.15), base[1] + Math.sin(H.ang(a)) * L.crest.len * k * (1 - i * 0.15)];
      sk.blade(base[0], base[1], tip[0], tip[1], s => (1 - s) * 0.9 * k + 0.3, M.crest, { z0: 4, z1: 4 - i * 0.2 });
    }
  }
  // beak: upper mandible bowed down, optional hook; lower mandible opens
  const bk = L.beak;
  const bb = H.p(L.hrx * 0.72, L.hry * 0.05);
  const openA = P.open * 0.45;
  sk.np();
  if (bk.hook > 0) {
    // cere
    const ce = H.p(L.hrx * 0.78, -L.hry * 0.12);
    sk.ell(ce[0], ce[1], bk.d * 0.55 * k, bk.d * 0.5 * k, M.cere, { z: 5 });
  }
  const ua = P.ha - openA * 0.3 + bk.curve * 0.5;
  const bt: V2 = [bb[0] + Math.cos(ua) * bk.len * k, bb[1] + Math.sin(ua) * bk.len * k];
  sk.blade(bb[0], bb[1] - bk.d * 0.25 * k, bt[0], bt[1], s => Math.max(0.35, bk.d * k * 0.55 * (1 - Math.pow(s, 1.4))), (p) => (p.t > 0.72 ? M.tip : M.beak), { z0: 5.5, z1: 5.5, bend: -bk.curve * bk.len * 0.12 * k, curl: 0.5 });
  if (bk.hook > 0) {
    const ha = ua + 1.5;
    const he: V2 = [bt[0] + Math.cos(ha) * bk.hook * k - Math.cos(ua) * 0.4 * k, bt[1] + Math.sin(ha) * bk.hook * k];
    sk.blade(bt[0] - Math.cos(ua) * 0.8 * k, bt[1] - Math.sin(ua) * 0.8 * k, he[0], he[1], s => (1 - s) * 0.7 * k + 0.25, M.tip, { z0: 5.6, z1: 5.6 });
  }
  const la = P.ha + openA + bk.curve * 0.3;
  const ll = bk.len * (bk.lower ?? 0.9) * k;
  const lb = H.p(L.hrx * 0.62, L.hry * 0.3);
  const lt: V2 = [lb[0] + Math.cos(la) * ll, lb[1] + Math.sin(la) * ll];
  sk.np();
  sk.blade(lb[0], lb[1], lt[0], lt[1], s => Math.max(0.3, bk.d * k * 0.38 * (1 - s)), M.beak, { z0: 5.2, z1: 5.2, curl: 0.4, bias: -0.08 });
  if (P.open > 0.3) sk.line(lb[0], lb[1] - 0.3, (lt[0] + bt[0]) / 2 - Math.cos(P.ha) * ll * 0.4, (lt[1] + bt[1]) / 2, M.mouth, 0.2, 6, true);
  // held food
  if (P.prey === 'seed' || P.prey === 'meat' || P.prey === 'fish') {
    sk.np();
    const q: V2 = [(bt[0] * 0.6 + lt[0] * 0.4), (bt[1] * 0.6 + lt[1] * 0.4) + 0.4 * k];
    if (P.prey === 'fish') sk.ell(q[0], q[1] + 0.5 * k, 3 * k, 1.1 * k, M.fish, { z: 7, rot: P.ha + 1.3 });
    else sk.ell(q[0], q[1], (P.prey === 'meat' ? 1.8 : 1.2) * k, (P.prey === 'meat' ? 1.2 : 1) * k, P.prey === 'meat' ? M.meat : M.seed, { z: 7 });
  }
  // eye
  const ep = H.p(L.hrx * 0.25, -L.hry * 0.2);
  const est = P.eye ?? eyeSt;
  let eyeC: V2;
  if (P.lid && L.eyelid) {
    sk.over(Math.floor(ep[0]), Math.floor(ep[1]), hex('#f4f4f0'));
    sk.over(Math.floor(ep[0]) - 1, Math.floor(ep[1]), hex('#f4f4f0'));
    eyeC = ep;
  } else eyeC = drawEye(sk, ep[0], ep[1], { ...L.eye, r: juv ? Math.max(0.5, L.eye.r * 0.8) : L.eye.r }, est);

  // --- near leg + near wing
  drawLeg(true);
  if (P.wing !== 'fold') spreadWing(sk, b, sh3(1), WL, P.wing[0], 1, k, 0);

  // carried snake hanging from the talons
  if (P.prey === 'snake') {
    sk.np();
    const g = B.p(-rx * 0.2, ry * 1.4);
    const pts: V2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([g[0] - t * 14 * k + Math.sin(t * 7 + (P.preyA ?? 0) * 4) * 2 * k, g[1] + t * 7 * k + Math.sin(t * 5) * 2 * k]);
    }
    sk.tube(pts, t => (1.3 - t * 0.8) * k, (p) => (p.v > 0.4 ? M.snakeB : M.snake), { z: 6 });
  }
  // water line ripple
  if (P.sink !== Infinity) {
    sk.clipY = Infinity;
    const y = P.sink + 0.5;
    for (let x = -rx * 1.3; x < rx * 1.6; x += 1) if (hh(x, 1, 4) > 0.3) sk.over(b[0] + x * k, y, hex('#d8f2f8'));
  }
  const top = H.p(0, -L.hry - 2);
  return { head: [top[0], top[1] - 2 * k], eye: eyeC };
}

// ------------------------------------------------------------------ species factory
interface BirdOpts {
  look: BirdLook;
  anims: Record<string, AnimDef>;
  ground: { w: number; h: number; ox: number; oy: number };
  flight: { w: number; h: number; ox: number; oy: number };
  airAnims: string[];
  eyeFor?: (anim: string, frame: number) => BeastEye;
}
function makeBird(o: BirdOpts): SpeciesDef {
  const isAir = (a: string) => o.airAnims.includes(a);
  const anchor: Record<string, 'ground' | 'centre' | 'grip'> = {};
  for (const a of o.airAnims) anchor[a] = 'centre';
  if (o.anims.dive && !isAir('dive')) anchor.dive = 'ground';
  return {
    name: o.look.name, kind: 'bird', len: o.look.len, height: o.look.height,
    anims: o.anims,
    anchor,
    canvas: (anim, juv) => {
      const c = isAir(anim) ? o.flight : o.ground;
      return juv ? { w: Math.ceil(c.w * 0.75), h: Math.ceil(c.h * 0.75), ox: Math.round(c.ox * 0.75), oy: Math.round(c.oy * 0.75) } : c;
    },
    draw(sk, anim, frame, eye, juv) {
      const n = o.anims[anim]?.frames ?? 1;
      const fn = (isAir(anim) ? AIR[anim] : G[anim]) ?? G.idle;
      const P = fn(o.look, frame, n);
      return drawBird(sk, o.look, P, eye, juv);
    },
    eyeFor: o.eyeFor ?? ((anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : 'open')),
  };
}

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
const BASE = { idle: A(4, 3), walk: A(6, 9), alert: A(2, 3), call: A(2, 5), preen: A(4, 5), eat: A(4, 7), sleep: A(2, 1.5), fly: A(6, 11), glide: A(2, 2) };

// ------------------------------------------------------------------ species
export const GALEHAWK = makeBird({
  look: {
    name: 'Gale Hawk', len: 30, height: 26,
    rx: 7.5, ry: 5.2, stance: -0.75, neckL: 3, neckR0: 3.6, neckR1: 3, neckS: 0.1,
    hrx: 3.6, hry: 3.2, beak: { len: 3.4, d: 2.8, hook: 1.8, curve: 0.5, lower: 0.6 },
    leg: { tib: 4.6, tar: 4.2, rT: 2.2, rt: 0.9, toe: 2.6, talon: 1.3 }, hipX: -1,
    tail: { L: 10, hw: 1.5, n: 7, spread: 0.35 },
    wing: { arm: 13, hand: 12, sec: 8, prim: 14, nS: 7, nP: 6, finger: 0.7, pw: 1.5, sw: 1.7, round: 0.5, foldExt: 5 },
    eye: { r: 1.1, iris: hex('#f0b020'), lash: hex('#2a1c14'), brow: hex('#3a2818'), ring: hex('#f2d060') },
    cols: { back: '#6a4a30', belly: '#e8d8b8', head: '#5a3e2a', neck: '#7a5838', wing: '#5e4028', prim: '#2e2420', cov: '#7a5a3a', tail: '#8a6440', beak: '#3a3a44', beakTip: '#1e1e26', cere: '#f0c030', leg: '#f0c030', crest: '#3a2a1e', mask: '#2e241e' },
    crest: { n: 3, len: 4 }, bars: true, flap: 0.85,
  },
  anims: { ...BASE, soar: A(2, 1.5), dive: A(2, 6), strike: A(2, 6, false), carry: A(6, 10), land: A(3, 8, false), threat: A(2, 5) },
  ground: { w: 60, h: 50, ox: 26, oy: 44 },
  flight: { w: 100, h: 90, ox: 50, oy: 45 },
  airAnims: ['fly', 'glide', 'soar', 'dive', 'strike', 'carry', 'land'],
  eyeFor: (a) => (a === 'sleep' ? 'closed' : a === 'strike' || a === 'dive' || a === 'threat' ? 'angry' : a === 'alert' ? 'alert' : 'open'),
});
G.threat = (L, f) => { const p = G.display(L, f, 4); p.open = 1; p.eye = 'angry'; return p; };

export const CRAGAUK = makeBird({
  look: {
    name: 'Crag Auk', len: 16, height: 16,
    rx: 5, ry: 4, stance: -1.05, neckL: 1.4, neckR0: 2.8, neckR1: 2.4, neckS: 0,
    hrx: 2.7, hry: 2.4, beak: { len: 3, d: 2.2, hook: 0, curve: 0.25, lower: 0.9 },
    leg: { tib: 2, tar: 1.8, rT: 1.3, rt: 0.8, toe: 2.2, talon: 0.5, web: true }, hipX: -2.5,
    tail: { L: 3, hw: 1, n: 5, spread: 0.3 },
    wing: { arm: 6, hand: 6, sec: 3.5, prim: 6, nS: 5, nP: 5, finger: 0, pw: 1, sw: 1.1, round: 0.2, foldExt: 1 },
    eye: { r: 0.9, iris: hex('#2a1810'), lash: hex('#101014'), ring: hex('#f0e6d0') },
    cols: { back: '#23252e', belly: '#f2f0ea', head: '#1c1e26', wing: '#262832', prim: '#16161c', beak: '#2a2a30', beakTip: '#e8a020', leg: '#e87830', web: '#e06a28', throat: '#f0b830' },
    throatFlare: true, flap: 1.1,
  },
  anims: { ...BASE, fly: A(4, 14), display: A(4, 6), swim: A(4, 5), dive: A(4, 8), hop: A(4, 8) },
  ground: { w: 34, h: 30, ox: 15, oy: 26 },
  flight: { w: 50, h: 40, ox: 25, oy: 20 },
  airAnims: ['fly', 'glide'],
});

export const TORRENTDIPPER = makeBird({
  look: {
    name: 'Torrent Dipper', len: 12, height: 10,
    rx: 4, ry: 3.3, stance: -0.3, neckL: 1, neckR0: 2.4, neckR1: 2.1, neckS: 0,
    hrx: 2.2, hry: 2, beak: { len: 1.7, d: 1.1, hook: 0, curve: 0.1 },
    leg: { tib: 2, tar: 2.4, rT: 1, rt: 0.5, toe: 1.6, talon: 0.4 }, hipX: -0.5,
    tail: { L: 2.6, hw: 0.9, n: 5, spread: 0.3, cock: 0.9 },
    wing: { arm: 4, hand: 4, sec: 2.6, prim: 4, nS: 4, nP: 4, finger: 0, pw: 0.8, sw: 0.9, round: 0.6, foldExt: 0.5 },
    eye: { r: 0.6, iris: hex('#1a1210'), lash: hex('#f4f4f0') },
    cols: { back: '#4a5a6e', belly: '#6a5040', head: '#3e4a5c', wing: '#44546a', prim: '#2c3644', beak: '#1e1e22', leg: '#9aa0a8', throat: '#f2f0ea' },
    throatFlare: true, eyelid: true, flap: 1.1,
  },
  anims: { ...BASE, fly: A(4, 16), bob: A(4, 8), swim: A(4, 5), dive: A(4, 7), hop: A(4, 8) },
  ground: { w: 28, h: 24, ox: 12, oy: 20 },
  flight: { w: 36, h: 30, ox: 18, oy: 15 },
  airAnims: ['fly', 'glide'],
});

export const SNAKESTORK = makeBird({
  look: {
    name: 'Thunder Stork', len: 40, height: 58,
    rx: 10, ry: 6.5, stance: -0.2, neckL: 13, neckR0: 3.2, neckR1: 2.2, neckS: 0.45,
    hrx: 3.4, hry: 2.8, beak: { len: 13, d: 3.2, hook: 0, curve: -0.05, lower: 0.95 },
    leg: { tib: 13, tar: 15, rT: 2, rt: 1.1, toe: 4, talon: 0.6 }, hipX: 0,
    tail: { L: 6, hw: 1.6, n: 5, spread: 0.3 },
    wing: { arm: 20, hand: 18, sec: 11, prim: 17, nS: 8, nP: 7, finger: 0.85, pw: 1.8, sw: 2, round: 0.6, foldExt: 4 },
    eye: { r: 1, iris: hex('#e8d040'), lash: hex('#141418'), ring: hex('#c83a2a') },
    cols: { back: '#8e949c', belly: '#dfe2e4', head: '#2a2c34', neck: '#e8eaec', wing: '#9aa0a8', prim: '#1a1c22', cov: '#b8bcc2', tail: '#2a2c32', beak: '#b8342a', beakTip: '#e8c8a0', leg: '#4a4a52', claw: '#1e1e22', mask: '#c83a2a' },
    scaleLegs: true, mask: true, flap: 0.7,
  },
  anims: { ...BASE, stalk: A(6, 5), strike: A(4, 10, false), clatter: A(4, 12), display: A(4, 6), fly: A(6, 7) },
  ground: { w: 90, h: 90, ox: 36, oy: 80 },
  flight: { w: 150, h: 110, ox: 75, oy: 55 },
  airAnims: ['fly', 'glide'],
});

export const MONARCH = makeBird({
  look: {
    name: 'Monarch', len: 70, height: 60,
    rx: 16, ry: 10, stance: -0.55, neckL: 8, neckR0: 4.5, neckR1: 2.8, neckS: 0.35,
    hrx: 4.8, hry: 4, beak: { len: 5.5, d: 4.2, hook: 2.6, curve: 0.45, lower: 0.6 },
    leg: { tib: 9, tar: 8, rT: 3.6, rt: 1.6, toe: 4.5, talon: 1.4 }, hipX: -2,
    tail: { L: 14, hw: 2.4, n: 9, spread: 0.45 },
    wing: { arm: 40, hand: 38, sec: 18, prim: 30, nS: 10, nP: 7, finger: 1, pw: 2.6, sw: 3, round: 0.7, foldExt: 10 },
    eye: { r: 1.3, iris: hex('#b83020'), lash: hex('#1e1414'), brow: hex('#6a4a40') },
    cols: { back: '#3a2e2c', belly: '#e8e0d0', head: '#e0b0a0', neck: '#d8a898', wing: '#322826', prim: '#1a1616', cov: '#4a3a34', tail: '#2a2220', beak: '#d8c8a8', beakTip: '#6a5a4a', cere: '#c86a50', leg: '#9a8a80', claw: '#2a2420' },
    bareNeck: true, flap: 0.55,
  },
  anims: { idle: A(4, 2), walk: A(6, 6), alert: A(2, 3), preen: A(4, 4), sleep: A(2, 1.5), feed: A(4, 5), eat: A(4, 5), fly: A(6, 5), glide: A(2, 1.5), soar: A(2, 1), land: A(3, 5, false) },
  ground: { w: 150, h: 110, ox: 60, oy: 100 },
  flight: { w: 260, h: 170, ox: 130, oy: 85 },
  airAnims: ['fly', 'glide', 'soar', 'land'],
});

export const NUTCRACKER = makeBird({
  look: {
    name: 'Nutcracker', len: 12, height: 11,
    rx: 4.4, ry: 3.8, stance: -0.45, neckL: 1, neckR0: 2.8, neckR1: 2.6, neckS: 0,
    hrx: 2.9, hry: 2.7, beak: { len: 2.6, d: 3.2, hook: 0.6, curve: 0.55, lower: 0.8 },
    leg: { tib: 1.8, tar: 2, rT: 1.1, rt: 0.55, toe: 1.6, talon: 0.5 }, hipX: -0.5,
    tail: { L: 4, hw: 1, n: 5, spread: 0.35 },
    wing: { arm: 5, hand: 5, sec: 3, prim: 4.6, nS: 4, nP: 5, finger: 0.2, pw: 0.9, sw: 1, round: 0.6, foldExt: 1 },
    eye: { r: 0.8, iris: hex('#2a1810'), lash: hex('#1a1210'), ring: hex('#f0e8d0') },
    cols: { back: '#6e5236', belly: '#e8d8b0', head: '#4a3624', wing: '#3e2e22', prim: '#221a16', cov: '#56402c', tail: '#2a201a', beak: '#8a9098', beakTip: '#3a3e44', leg: '#5a4a40', crest: '#3a2a1e' },
    spots: true, flap: 1.1,
  },
  anims: { ...BASE, fly: A(4, 16), hop: A(4, 9), crack: A(4, 8) },
  ground: { w: 30, h: 26, ox: 13, oy: 22 },
  flight: { w: 40, h: 32, ox: 20, oy: 16 },
  airAnims: ['fly', 'glide'],
});
