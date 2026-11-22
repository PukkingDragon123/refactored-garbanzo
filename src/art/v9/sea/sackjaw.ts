// Sackjaw Gull: the stern's resident thief. A pale-grey gull with black wingtips and white mirrors,
// a heavy yellow bill whose cutting edges are serrated like a bread knife (for gripping slippery
// fish) and hooked at the tip, a red gape spot, a mean pale eye in a red ring, and a stretchy
// orange throat sack: slack and wrinkled when resting, bulging with stolen food, or blown up like a
// balloon to shout down rivals on the rail.
//
// Painted on the Relief layer through the seabird contour kit: the body, neck and flat-crowned
// gull head are one lofted contour; the bill is a contour (deep at the gonys, hooked, the cutting
// edges toothed); the sack is its own skin contour hanging from the jaw to the throat, wrinkled
// slack or stretched shiny with veins; spread wings are one contour each with fingered black tips;
// the folded wing lies on the flank in feather tracts with the white tertial crescent and the black
// primaries' white spots crossed over the tail; webbed yellow feet.
//
// Flight anims anchor on the body centre, standing anims on the feet, 'swim' on the waterline.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh, fr } from '../../beasts-core';
import { hex } from '../../color';
import { View3, WingShape, WingPose } from './seabird';
import { Relief, LM, Sp, Tx, spline, fringe, loft, loftOutline, loftAt, Station, HeadF, wingFrame, wing, WingLook, WingPx, fan, fanAt, feathers, FT, foldOutline, foldTex, foldMap3, FoldLook, pxLeg, PxLegLook, v3add, v3norm } from './seabird-kit';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
const ANIMS: Record<string, AnimDef> = {
  idle: A(4, 3),
  fly: A(6, 11),
  glide: A(2, 3),
  hover: A(4, 9),
  beg: A(4, 8),
  swoop: A(2, 6),
  grab: A(3, 9, false),
  carry: A(6, 10),
  display: A(4, 6),
  call: A(2, 4),
  swim: A(2, 2),
  land: A(3, 8, false),
};
const AIR = ['fly', 'glide', 'hover', 'beg', 'swoop', 'grab', 'carry', 'land'];

const EYE: EyeSpec = { r: 0.6, iris: hex('#f2e27a'), lash: hex('#2a2426'), ring: hex('#d8433a') };

function mats(sk: Sk) {
  return {
    white: sk.m(rmp('#f3f1ec', { n: 7, dark: 0.36, light: 0.6, at: 4, cool: 0.5 }), { edge: 1 }),
    whiteF: sk.m(rmp('#dcdcda', { n: 6, dark: 0.4, light: 0.4, cool: 0.5 }), { edge: 1 }),
    mantle: sk.m(rmp('#8e9cab', { n: 6, dark: 0.5, light: 0.42, cool: 0.4 }), { edge: 1 }),
    wing: sk.m(rmp('#8896a6', { n: 6, dark: 0.52, light: 0.45 }), { edge: 2 }),
    cov: sk.m(rmp('#9eabb8', { n: 6, dark: 0.5, light: 0.5 }), { edge: 2 }),
    trail: sk.m(rmp('#f0f0ee', { n: 5, dark: 0.32 }), { edge: 1 }),
    tip: sk.m(rmp('#1f1c20', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    mirror: sk.m(rmp('#f5f4f0', { n: 4, dark: 0.25 }), { edge: 0 }),
    lining: sk.m(rmp('#f4f3ef', { n: 5, dark: 0.3, at: 3, cool: 0.5 }), { edge: 1, bias: 0.16 }),
    under: sk.m(rmp('#d4d9de', { n: 5, dark: 0.35 }), { edge: 1, bias: 0.1 }),
    bill: sk.m(rmp('#f0c83c', { n: 6, dark: 0.45, light: 0.5, warm: 0.4 }), { spec: 0.45, edge: 1 }),
    hook: sk.m(rmp('#d89a2a', { n: 5, dark: 0.45 }), { spec: 0.45 }),
    gonys: sk.m(rmp('#d8342c', { n: 4, dark: 0.45 }), { edge: 0 }),
    tooth: sk.m(rmp('#fff4c8', { n: 3, dark: 0.25 }), { edge: 0, noRim: true }),
    gape: sk.m(rmp('#7a4a2a', { n: 4, dark: 0.45 }), { edge: 0 }),
    pouch: sk.m(rmp('#f08a5a', { n: 6, dark: 0.45, light: 0.55 }), { spec: 0.55, edge: 1 }),
    pouchD: sk.m(rmp('#c85a44', { n: 5, dark: 0.45 }), { edge: 1 }),
    vein: sk.m(rmp('#b8404a', { n: 4, dark: 0.4 }), { edge: 0 }),
    mouth: sk.m(rmp('#b8324a', { n: 4, dark: 0.45 }), { edge: 0 }),
    leg: sk.m(rmp('#f0b43a', { n: 5, dark: 0.5 }), { edge: 1 }),
    web: sk.m(rmp('#e89a30', { n: 5, dark: 0.45 }), { edge: 1 }),
    claw: sk.m(rmp('#3a3030', { n: 3, dark: 0.4 })),
    fish: sk.m(rmp('#9ab8c8', { n: 5, dark: 0.5, light: 0.6 }), { spec: 0.6 }),
    fishD: sk.m(rmp('#4a6a88', { n: 4, dark: 0.5 }), { edge: 1 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, BILL: 3, JAW: 4, SACK: 5, FISH: 6, TAIL: 7, FOLD: 8, WING: 9, LEG: 20 };

const WING: WingShape = {
  sh: [1, 0.9, 1.5],
  segs: [
    { len: 4.6, sweep: -0.1, dih: 0.06, flex: -0.6, shrink: 0.2 },
    { len: 5.0, sweep: 0.26, dih: 0.1, flex: 0.9, shrink: 0.25 },
    { len: 7.6, sweep: -0.4, dih: 0.02, flex: -0.9, shrink: 0.4 },
  ],
  chord: [4.4, 4.6, 3.6, 1.0],
  spar: 0.55,
};
const WL: WingLook = { wrist: 2, nS: 7, scallop: 0.07, nP: 7, slot: 0.3, fingers: 3, rows: [0.14, 0.34], spar: 0.7, minW: 1.2, point: 0.6, reach: 0.5 };
const LEG: PxLegLook = { tib: 2.6, tar: 3.0, toe: 3, foot: 'web', hallux: 1 };

interface Pose {
  mode: 'air' | 'stand' | 'swim';
  bank: number; pitch: number; yaw: number;
  wings: [WingPose, WingPose];
  headA: number; neck: number; open: number;
  /** throat sack: 0 slack .. 1 bulging with food .. 2 blown up (display) */
  sack: number;
  fish: boolean;
  tail: number; fan: number;
  legs: 'tuck' | 'dangle' | 'grab';
  lift: number;   // folded wings lifted (display)
  eye?: BeastEye;
}
const W0 = (elev: number, hand = 0, flex = 0, sweep = 0): WingPose => ({ elev, hand, flex, sweep });
const base = (): Pose => ({
  mode: 'air', bank: 0.38, pitch: 0.04, yaw: 0.32, wings: [W0(0.1), W0(0.1)], headA: 0.08, neck: 0, open: 0,
  sack: 0, fish: false, tail: 0, fan: 1, legs: 'tuck', lift: 0,
});
function flap(t: number, amp = 1): [WingPose, WingPose] {
  const c = Math.cos(t * TAU), up = t > 0.5;
  const w = W0((0.2 + 0.75 * c) * amp, (-0.4 * Math.sin(t * TAU) + (up ? 0.3 : -0.08)) * amp, up ? 0.65 * Math.sin((t - 0.5) * TAU) : 0.02, up ? -0.15 : 0.05);
  return [w, { ...w }];
}

function pose(anim: string, f: number, n: number): Pose {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'fly':
      p.wings = flap(t);
      p.pitch = 0.04 + Math.sin(t * TAU) * 0.04;
      break;
    case 'carry':
      p.wings = flap(t);
      p.sack = 1; p.fish = true; p.headA = 0.18;
      break;
    case 'glide':
      p.bank = 0.5 + f * 0.06;
      p.wings = [W0(0.12, -0.12, 0.18), W0(0.12, -0.12, 0.18)];
      break;
    case 'hover':
    case 'beg': {
      // hanging on the wind over the stern: wings in a V with flickering hands, tail fanned, legs down
      p.pitch = 0.32;
      p.bank = 0.28;
      const fl = Math.sin(t * TAU);
      p.wings = [W0(0.55 + fl * 0.22, -0.35 + fl * 0.35, 0.28, -0.1), W0(0.55 + fl * 0.22, -0.35 + fl * 0.35, 0.28, -0.1)];
      p.fan = 1.8; p.tail = -0.3 + fl * 0.1;
      p.legs = 'dangle';
      p.headA = 0.35;
      if (anim === 'beg') { p.open = [0.3, 1, 0.9, 0.5][f]; p.sack = 0.6 + (f % 2) * 0.2; p.headA = [0.2, -0.05, 0, 0.15][f]; }
      break;
    }
    case 'swoop':
      p.pitch = -0.42;
      p.wings = [W0(0.35 + f * 0.1, -0.2, 0.7, -0.35), W0(0.35 + f * 0.1, -0.2, 0.7, -0.35)];
      p.fan = 0.8;
      p.headA = 0.2;
      break;
    case 'grab':
      // braking hard over the prize: wings high, bill and feet thrust down
      p.pitch = [0.25, 0.1, 0.35][f];
      p.wings = [0, 1].map(() => W0([1.0, 1.2, 0.8][f], 0.3, 0.3, -0.25)) as [WingPose, WingPose];
      p.legs = 'grab';
      p.headA = [0.9, 1.25, 0.8][f];
      p.open = [0.6, 1, 0.2][f];
      p.fan = 2; p.tail = -0.35;
      break;
    case 'land':
      p.pitch = [0.35, 0.55, 0.5][f];
      p.wings = [0, 1].map(() => W0([0.7, 1.05, 1.25][f], [0.2, 0.3, -0.1][f], [0.2, 0.3, 0.6][f], -0.2)) as [WingPose, WingPose];
      p.legs = 'grab';
      p.fan = 2; p.tail = -0.25;
      break;
    case 'idle':
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = [0.1, 0.1, 0.14, 0.08][f];
      p.headA = [0.08, 0.08, -0.12, 0.2][f];
      p.neck = [0, 0.1, 0.4, -0.2][f];
      break;
    case 'display':
      // the sack blown up like a balloon, wings lifted, head thrown up: "this rail is MINE"
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = 0.32;
      p.sack = 2 - (f === 0 ? 0.6 : 0) - (f === 3 ? 0.3 : 0);
      p.headA = -0.35 - (f % 2) * 0.15;
      p.neck = 0.9;
      p.open = f === 1 || f === 2 ? 0.8 : 0.2;
      p.lift = 0.8 + (f % 2) * 0.2;
      p.eye = 'angry';
      break;
    case 'call':
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = f ? -0.1 : 0.05;
      p.headA = f ? 0.45 : 0.2; p.neck = f ? 0.4 : 0.2;
      p.open = f ? 1 : 0.4; p.sack = 0.35;
      break;
    case 'swim':
      p.mode = 'swim';
      p.bank = 0; p.yaw = 0.24; p.pitch = 0.06;
      p.headA = f ? 0.12 : 0.02; p.neck = f ? 0.2 : 0;
      break;
  }
  return p;
}

// ------------------------------------------------------------------ wings
function wingFill(M: M) {
  return (w: WingPx, o: Tx) => {
    const nr = WL.rows.length;
    // the black hand with white mirrors at the tips of the outer two primaries
    const black = w.hand && w.s > 0.64 + w.c * 0.05;
    if (w.top) {
      if (black && (w.zone === nr || w.s > 0.86)) {
        o.m = w.zone === nr && w.fu > 0.66 && w.fu < 0.86 && w.fi >= WL.nP - 2 && w.edge > 0.3 ? M.mirror : w.zone === nr && w.edge < 0.25 ? M.wing : M.tip;
        if (w.fu > 0.94 && w.fi === WL.nP - 1) o.m = M.mirror;
        return;
      }
      if (w.zone < nr) { o.m = w.fu > 0.82 && w.edge > 0.2 ? M.trail : M.cov; if (w.zone === 0) o.m = M.cov; return; }
      // flight feathers: grey with a clean white trailing edge on the arm
      o.m = !w.hand && w.fu > 0.78 ? M.trail : w.edge < 0.25 ? M.mantle : M.wing;
      return;
    }
    if (black && (w.zone === nr || w.s > 0.88)) { o.m = w.fu > 0.66 && w.fu < 0.86 && w.fi >= WL.nP - 2 ? M.mirror : M.tip; return; }
    if (w.zone === nr) { o.m = w.edge < 0.25 ? M.under : w.fu > 0.75 ? M.trail : M.under; return; }
    o.m = M.lining;
  };
}

// ------------------------------------------------------------------ body, head, bill, sack
function bodyLoft(V: View3, P: Pose, hc: V3) {
  const nk = P.neck;
  const ha = P.headA;
  const hf: V3 = [Math.cos(ha), -Math.sin(ha), 0], hu: V3 = [Math.sin(ha), Math.cos(ha), 0];
  const up: V3 = [0, 1, 0], nu = v3norm(v3add(up, hu));
  const Hp = (x: number, y: number): V3 => [hc[0] + hf[0] * x + hu[0] * y, hc[1] + hf[1] * x + hu[1] * y, 0];
  const ny = hc[1] - 1.1;
  const st: Station[] = [
    { c: [-5.4, 0.55, 0], up, ru: 0.9, rl: 0.8, rw: 1.2 },
    { c: [-3.8, 0.35, 0], up, ru: 1.8, rl: 1.6, rw: 2.1 },
    { c: [-1.4, 0, 0], up, ru: 2.25, rl: 2.6, rw: 2.6 },
    { c: [1.0, 0.15, 0], up, ru: 2.2, rl: 2.75, rw: 2.5 },
    { c: [2.5, 0.5 + ny * 0.3, 0], up, ru: 1.85, rl: 2.4, rw: 2.0 },
    { c: [hc[0] - 1.6, hc[1] - 0.5 - nk * 0.2, 0], up: nu, ru: 1.45, rl: 1.85, rw: 1.6 },
    { c: Hp(-1.4, 0.1), up: hu, ru: 1.7, rl: 1.75, rw: 1.65 },
    { c: Hp(-0.2, 0), up: hu, ru: 2.0, rl: 1.85, rw: 1.75 },
    { c: Hp(0.9, 0.05), up: hu, ru: 1.75, rl: 1.45, rw: 1.4 },
    { c: Hp(1.5, 0.15), up: hu, ru: 1.1, rl: 1.1, rw: 0.95 },
  ];
  return { Lf: loft(V, st), H: new HeadF(V, hc, hf, hu), head0: st.length - 4 };
}

function drawBody(R: Relief, V: View3, M: M, P: Pose, hc: V3) {
  const { Lf, H, head0 } = bodyLoft(V, P, hc);
  let zc = 0;
  const poly = fringe(spline(loftOutline(Lf, { head: 0.3, tail: 0.5 }), 0.5), 2.2, 41, (_x, _y, nx, ny) => (ny > 0.6 ? [0.6, 0.5] : nx < -0.7 ? [0.5, 0] : null));
  R.region(poly, {
    zAt: () => zc, R: 2.4, H: 2.4, id: ID.BODY,
    tex: (p: Sp, o: Tx) => {
      const h = loftAt(Lf, p.x, p.y);
      zc = h.z;
      const seg = Math.min(Lf.n - 2, Math.floor(h.f));
      const ang = Math.atan2(Lf.s[seg][1] - Lf.s[seg + 1][1], Lf.s[seg][0] - Lf.s[seg + 1][0]);
      o.z += feathers(p.x, p.y, ang, 1.9, 1.4, 41) * 0.45;
      o.m = M.white;
      // the pale grey mantle across the back
      if (h.f < head0 - 1 && h.dors > 0.42 + Math.max(0, h.f - 3) * 0.4) o.m = M.mantle;
      else if (FT.edge === 1 && h.dors > 0) o.m = M.whiteF;
      // a faint grey smudge behind the eye (winter streaking)
      if (h.f >= head0 - 0.3) {
        const [hx, hy] = H.local(p.x, p.y);
        if (h.lat > 0.3 && hx < -0.3 && hx > -1.8 && hy > -1.2 && hy < 0.3 && (Math.floor(p.x * 1.7 + p.y) & 1)) o.m = M.whiteF;
      }
    },
  });
  const br = V.s([1.4, -1.4, 1.6]); R.bump(br[0], br[1], 2.6, 2.2, 0.6, 0, ID.BODY);
  return H;
}

function drawBill(R: Relief, H: HeadF, M: M, P: Pose) {
  const open = P.open;
  const z0 = H.zOf(3, 0, 0) + 1;
  const oa = open * 0.42, co = Math.cos(oa), so = Math.sin(oa);
  const J = (x: number, y: number, sh = 0): LM => { const dx = x - 1.4, dy = y - 0.45; return H.s(1.4 + dx * co - dy * so, 0.45 + dx * so + dy * co, 0, sh); };
  const Jl = (px: number, py: number): V2 => { const [hx, hy] = H.local(px, py); const dx = hx - 1.4, dy = hy - 0.45; return [1.4 + dx * co + dy * so, 0.45 - dx * so + dy * co]; };
  // lower mandible: the angled gonys with its red spot, toothed along the edge
  R.region(spline([J(1.3, 0.45), J(3.2, 0.5), J(4.9, 0.55, 0.6), J(4.6, 0.95), J(3.9, 1.35, 0.5), J(2.6, 1.3), J(1.4, 1.2)], 0.35), {
    z: z0, R: 0.6, H: 0.7, id: ID.JAW, tex: (p, o) => {
      const [jx, jy] = Jl(p.x, p.y);
      o.m = jx > 3.6 && jx < 4.3 && jy > 0.85 ? M.gonys : M.bill;
      if (jy < 0.75 && jx > 1.8 && jx < 4.6) o.m = open > 0.25 ? (fr(jx * 1.25) < 0.5 ? M.tooth : M.gape) : M.hook;
    },
  });
  if (open > 0.25) R.region(spline([H.s(1.4, 0.4), H.s(4.6, 0.3), J(4.5, 0.6), J(1.6, 0.6)], 0.35), { z: z0 - 0.2, R: 0.4, H: 0.2, id: ID.JAW, tex: M.mouth });
  // upper mandible: heavy, a slight swelling over the nostril, the tip a hooked nail; toothed edge
  R.region(spline([H.s(1.2, -1.05), H.s(2.6, -0.95), H.s(4.0, -0.75), H.s(5.0, -0.35), H.s(5.45, 0.25), H.s(5.4, 0.95, 0.9), H.s(4.95, 0.55, 0.3), H.s(3.4, 0.4), H.s(1.4, 0.5)], 0.35), {
    z: z0 + 0.4, R: 0.7, H: 1, id: ID.BILL, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = hx > 4.7 ? M.hook : M.bill;
      if (hy > 0.15 && hx < 4.9) o.m = open > 0.25 ? (fr(hx * 1.25 + 0.5) < 0.5 ? M.tooth : M.gape) : M.hook;
      if (Math.abs(hx - 2.3) < 0.4 && Math.abs(hy + 0.35) < 0.3) { o.z -= 0.5; o.t -= 0.08; } // the slit nostril
    },
  });
}

/** the throat sack: slack wrinkled skin, a bulging bag of stolen food, or a balloon */
function drawSack(R: Relief, H: HeadF, M: M, P: Pose) {
  const s = P.sack;
  const z0 = H.zOf(1.5, 1.5, 0) + 0.9;
  if (s < 0.05) {
    // slack: a wrinkled fold of orange skin under the jaw
    R.region(spline([H.s(1.3, 1.05), H.s(3.0, 1.3), H.s(2.4, 1.8), H.s(0.8, 2.0), H.s(-0.2, 1.6)], 0.35), { z: z0 + 0.3, R: 0.5, H: 0.6, id: ID.SACK, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = fr(hx * 1.1 + hy * 0.6) < 0.35 ? M.pouchD : M.pouch;
    } });
    return;
  }
  // the sack hangs from the gonys back to the throat; it sags lowest under the middle
  const rx = 1.5 + s * 1.15, ry = 1.0 + s * 1.15;
  const cx = 1.6 + s * 0.35, cy = 1.25 + ry * 0.8;
  const lm: LM[] = [H.s(3.9, 1.2), H.s(cx + rx * 0.98, cy - ry * 0.25)];
  for (let i = 1; i <= 7; i++) {
    const a = (i / 8) * Math.PI;
    lm.push(H.s(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * (1 + Math.sin(a) * 0.12)));
  }
  lm.push(H.s(cx - rx * 0.9, cy - ry * 0.45), H.s(-0.3, 1.5), H.s(1.2, 1.05));
  const blown = s > 1.2;
  R.region(spline(lm, 0.35), { z: z0, R: Math.min(rx, ry) * 0.9, H: Math.min(rx, ry) * 1.1, id: ID.SACK, tex: (p, o) => {
    const [hx, hy] = H.local(p.x, p.y);
    o.m = M.pouch;
    if (blown) {
      // stretched thin: branching veins over a shiny skin
      const v = Math.sin((hx - cx) * 2.2 + Math.sin((hy - cy) * 3.1) * 0.9);
      if (Math.abs(v) < 0.12 && (hy - cy) > -ry * 0.6) o.m = M.vein;
    } else if (fr((hx - cx) * 0.9 + Math.abs(hy - cy) * 0.7) < 0.22) { o.m = M.pouchD; o.z -= 0.3; }
    if (hy < 1.5 && hx < 1.2) o.m = M.pouchD;
  } });
  if (P.fish) {
    // a fish tail sticking out of the full bill
    R.region(spline([H.s(4.3, 0.55), H.s(6.2, 0.4), H.s(7.0, -0.5, 0.9), H.s(6.7, 0.65), H.s(7.2, 1.8, 0.9), H.s(6.1, 1.0), H.s(4.3, 1.05)], 0.35), { z: H.zOf(5, 0.6, 0) + 2.5, R: 0.5, H: 0.6, id: ID.FISH, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = hy < 0.55 || hx > 6.2 ? M.fishD : M.fish;
    } });
  }
}

function drawTail(R: Relief, V: View3, M: M, P: Pose, root: V3) {
  const ct = Math.cos(P.tail), st = Math.sin(P.tail);
  const F = fan(V, root, [-ct, -st, 0], [0, 0, 1], 8, 0.55 * P.fan, () => 4.2, { minW: 1.1, notch: 0.06, base: 1, point: 0.35 });
  R.region(spline(F.poly, 0.4), { z: V.s(root)[2] - 1.2, R: 0.8, H: 0.9, id: ID.TAIL, tex: (p, o) => {
    const q = fanAt(F, p.x, p.y);
    o.m = M.white;
    if (q.edge < 0.3) { o.z -= 0.3; o.m = M.whiteF; }
  } });
}

const FOLD: FoldLook = { len: 1, dep: 1, tert: 0.56, nP: 5, cov: 0.36, gc: 0.56 };
function foldWing(R: Relief, V: View3, M: M, side: 1 | -1, lift: number) {
  const c: V3 = [2.6, 1.55 + lift * 1.1, side * 2.2];
  const ax = v3norm([-1, 0.04 + lift * 0.32, 0]);
  const F = foldMap3(V, c, ax, [-ax[1], ax[0], 0], 10.6, 2.7, 0.15);
  R.region(spline(foldOutline(F.map, FOLD), 0.4), { z: V.s(c)[2] + side * 0.6, R: 1, H: 1.2, id: ID.FOLD + (side > 0 ? 0 : 30), tex: foldTex(FOLD, F.inv, (f, o) => {
    if (f.zone === 'les') o.m = f.edge < 0.3 ? M.wing : M.cov;
    else if (f.zone === 'gc') o.m = f.edge < 0.3 ? M.wing : M.cov;
    else if (f.zone === 'ter') o.m = f.u > FOLD.tert - 0.1 || f.v > 0.66 ? M.trail : f.edge < 0.3 ? M.mantle : M.wing;
    else if (f.zone === 'sec') o.m = f.v > 0.8 ? M.trail : f.edge < 0.3 ? M.mantle : M.wing;
    else o.m = f.u > 0.82 && fr(f.u * FOLD.nP * 1.5) > 0.6 && f.v > 0.3 ? M.mirror : M.tip;
  }) });
}

function drawLegs(sk: Sk, V: View3, M: M, P: Pose, side: 1 | -1, stand: boolean) {
  const mats = { tib: M.white, leg: M.leg, toe: M.leg, web: M.web, claw: M.claw };
  const hip = V.s([-0.4, -1.5, side * 0.8]);
  const z = side > 0 ? 1.2 : -1.6, lt = side > 0 ? 0 : -0.12;
  if (stand) {
    const foot: V2 = [Math.round(V.s([-0.4, 0, 0])[0] + (side > 0 ? 1.5 : -1.8)) + 0.5, -0.5];
    pxLeg(sk, [hip[0], hip[1]], foot, LEG, mats, z, 1, { ta: 0, ground: 0, light: lt });
    return;
  }
  if (P.legs === 'tuck') return;
  const toe = P.legs === 'grab' ? V.s([2.6, -6, side * 1.3]) : V.s([-2.2, -5, side * 1.1]);
  pxLeg(sk, [hip[0], hip[1]], [toe[0], toe[1]], { ...LEG, toe: 2.2 }, mats, z, 1, { ta: P.legs === 'grab' ? 0.5 : 1.25, spread: P.legs === 'grab' ? 1 : 0.6, bend: 1, light: lt });
}

function eyeOf(sk: Sk, H: HeadF, st: BeastEye): V2 {
  let ep: V2 = H.s2(0.35, -0.45, 1.6);
  if (!H.facing(0.05)) return ep;
  ep = drawEye(sk, ep[0], ep[1], EYE, st);
  // the red orbital ring: a pixel behind and below the pale eye
  if (st !== 'closed') { const x = Math.floor(ep[0]), y = Math.floor(ep[1]); sk.overPaint(x - 1, y, EYE.ring!); }
  return ep;
}

// ------------------------------------------------------------------ flight
function drawAir(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  { const R = Relief.full(sk); wing(R, V, wingFrame(WING, P.wings[1], -1), WL, wf, { id: ID.WING, lt: -0.08 }); sk.np(); R.emit({ drop: 1.1, seam: 0.5, seamDark: 0.2, bias: -0.04 }); }
  const BR = Relief.full(sk);
  drawLegs(sk, V, M, P, -1, false);
  drawTail(BR, V, M, P, [-4.4, 0.4, 0]);
  const H = drawBody(BR, V, M, P, [5, 1.1 + P.neck, 0]);
  drawSack(BR, H, M, P);
  drawBill(BR, H, M, P);
  drawLegs(sk, V, M, P, 1, false);
  sk.np();
  BR.emit({ drop: 1.4, seam: 0.55, seamDark: 0.25, ao: 0.05, aoR: 2 });
  const ep = eyeOf(sk, H, P.eye ?? eye);
  { const R = Relief.full(sk); wing(R, V, wingFrame(WING, P.wings[0], 1), WL, wf, { id: ID.WING }); sk.np(); R.emit({ drop: 1.1, seam: 0.5, seamDark: 0.2 }); }
  return { head: V.s2([H.c[0], H.c[1] + 4, 0]), eye: ep };
}

// ------------------------------------------------------------------ standing / swimming
function drawStand(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const swim = P.mode === 'swim';
  const legH = (LEG.tib + LEG.tar) * 0.8;
  const V = new View3(0, P.pitch, P.yaw, [0, swim ? -2.4 : -(legH + 2.0)], 1);
  if (swim) sk.clipY = 0.5;
  const BR = Relief.full(sk);
  if (!swim) drawLegs(sk, V, M, P, -1, true);
  drawTail(BR, V, M, { ...P, tail: P.tail + 0.25 }, [-4.2, 0.6, 0]);
  foldWing(BR, V, M, -1, P.lift);
  const H = drawBody(BR, V, M, P, [4.4, 2.2 + P.neck, 0]);
  drawSack(BR, H, M, P);
  drawBill(BR, H, M, P);
  foldWing(BR, V, M, 1, P.lift);
  if (!swim) drawLegs(sk, V, M, P, 1, true);
  BR.shadow(ID.FOLD, 0.5, 1, 0.1, ID.BODY, 1);
  BR.shadow(ID.SACK, 0.4, 0.8, 0.1, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.4, seam: 0.55, seamDark: 0.25, ao: 0.05, aoR: 2 });
  const ep = eyeOf(sk, H, P.eye ?? eye);
  if (swim) {
    sk.clipY = Infinity;
    for (let x = -7; x <= 7; x++) if (hh(x, 5, 3) > 0.35) sk.over(x, 0, hex('#dff1f6'));
  }
  return { head: V.s2([H.c[0], H.c[1] + 4, 0]), eye: ep };
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
  const n = ANIMS[anim]?.frames ?? 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  return P.mode === 'air' ? drawAir(sk, M, P, eye) : drawStand(sk, M, P, eye);
}

export const SACKJAW: SpeciesDef = {
  name: 'Sackjaw Gull', kind: 'bird', len: 13, height: 12,
  anims: ANIMS,
  canvas: (anim) => (AIR.includes(anim) ? { w: 56, h: 52, ox: 28, oy: 26 } : { w: 30, h: 28, ox: 14, oy: 22 }),
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim) => (anim === 'display' || anim === 'grab' ? 'angry' : 'open'),
  anchor: Object.fromEntries(AIR.map(a => [a, 'centre'])) as Record<string, 'centre'>,
};
