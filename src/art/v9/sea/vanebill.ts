// Fluting Vanebill: the great glider of the Kittiwake's seas. A white-bodied ocean wanderer with a
// sooty saddle and upperwings, a tall coral keel ("vane") swept back like a sail on its plated,
// hooked bill, paired tube nostrils that end in flute holes (they whistle as it turns into the
// wind) and wings with THREE locking joints (elbow, wrist and an extra knuckle), each marked by a
// horny hinge spur on the leading edge. On the water the wings fold into a Z-pack along the back.
//
// Painted on the Relief layer through the seabird contour kit: the body, neck and head are one
// lofted contour (heavy albatross chest, thick neck, steep forehead); the bill is a contour of
// horny plates (the culmen, the side plate, the hooked nail, the lower mandible) with grooves
// between them; the vane is a separate fin contour with growth ridges and a pale rim; each wing is
// one contour round a cranked three-joint leading edge, the long arm's scalloped secondaries and
// the narrow hand of primaries with slotted tips, covert tracts in rows.
//
// Flight anims face right with the body centre as anchor; 'bank' runs from underside (frame 0) to
// back (last frame) so the game can roll it through a soaring loop. Water anims anchor on the
// waterline under the body.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh, fr } from '../../beasts-core';
import { hex } from '../../color';
import { View3, WingShape, WingPose } from './seabird';
import { Relief, LM, Sp, Tx, spline, fringe, loft, loftOutline, loftAt, Station, HeadF, wingFrame, wing, WingLook, WingPx, WingFrame, fan, fanAt, feathers, FT, foldOutline, foldTex, foldMap3, FoldLook, leg, LegLook, clamp, v3add, v3mul, v3norm } from './seabird-kit';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const VANEBILL_BANK = 9;
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 2),
  glide: A(3, 3),
  bank: A(VANEBILL_BANK, 1),
  flap: A(6, 7),
  flute: A(2, 4),
  snatch: A(3, 7, false),
  land: A(3, 6, false),
  sit: A(4, 2),
  takeoff: A(6, 9),
  display: A(4, 4),
};
/** bank angle of each 'bank' frame (- underside .. + back) */
export const vanebillBankAngle = (f: number) => -1.05 + (f / (VANEBILL_BANK - 1)) * 2.1;

const EYE: EyeSpec = { r: 0.9, iris: hex('#2a1a14'), lash: hex('#2a2426'), ring: hex('#8fc4d4'), brow: hex('#4e4648') };

function mats(sk: Sk) {
  return {
    white: sk.m(rmp('#f1eee6', { n: 7, dark: 0.36, light: 0.6, at: 4, cool: 0.5 }), { edge: 1 }),
    whiteF: sk.m(rmp('#dcd6cc', { n: 6, dark: 0.4, light: 0.4, cool: 0.5 }), { edge: 1 }),
    saddle: sk.m(rmp('#8c847e', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    saddleF: sk.m(rmp('#b0a69c', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1 }),
    brow: sk.m(rmp('#6e6666', { n: 5, dark: 0.5 }), { edge: 1 }),
    wing: sk.m(rmp('#342c2b', { n: 6, dark: 0.6, light: 0.36 }), { edge: 2, bias: -0.16 }),
    cov: sk.m(rmp('#5a4e47', { n: 6, dark: 0.58, light: 0.4 }), { edge: 2, bias: -0.14 }),
    covF: sk.m(rmp('#8a7c70', { n: 6, dark: 0.55, light: 0.4 }), { edge: 2, bias: -0.1 }),
    mirror: sk.m(rmp('#c4b8aa', { n: 5, dark: 0.45, light: 0.35 }), { edge: 1 }),
    shaft: sk.m(rmp('#a89a8c', { n: 4, dark: 0.45 }), { edge: 0 }),
    lining: sk.m(rmp('#f5f2eb', { n: 5, dark: 0.3, at: 3, cool: 0.5 }), { edge: 1, bias: 0.28 }),
    under: sk.m(rmp('#cfc9c1', { n: 5, dark: 0.4 }), { edge: 1, bias: 0.2 }),
    margin: sk.m(rmp('#342e2e', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1 }),
    tip: sk.m(rmp('#211d1e', { n: 5, dark: 0.5, light: 0.32 }), { edge: 1 }),
    spur: sk.m(rmp('#eadbb8', { n: 5, dark: 0.5, light: 0.4 }), { edge: 0, spec: 0.3 }),
    tailT: sk.m(rmp('#7a736e', { n: 5, dark: 0.55 }), { edge: 1 }),
    tailTip: sk.m(rmp('#2c2728', { n: 4, dark: 0.5 }), { edge: 1 }),
    bill: sk.m(rmp('#e8d8a6', { n: 6, dark: 0.5, light: 0.5, warm: 0.4 }), { spec: 0.45, edge: 1 }),
    billD: sk.m(rmp('#b09a78', { n: 5, dark: 0.5, light: 0.4 }), { spec: 0.3, edge: 1 }),
    hook: sk.m(rmp('#5e6474', { n: 5, dark: 0.5, light: 0.5 }), { spec: 0.5 }),
    gape: sk.m(rmp('#4a3c3a', { n: 4, dark: 0.4, light: 0.3 }), { edge: 0 }),
    keel: sk.m(rmp('#ea7a40', { n: 6, dark: 0.5, light: 0.45, warm: 0.4 }), { spec: 0.35, edge: 1 }),
    keelD: sk.m(rmp('#b8482e', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    keelRim: sk.m(rmp('#f6dc86', { n: 4, dark: 0.35 }), { edge: 0 }),
    tube: sk.m(rmp('#c9bfb4', { n: 5, dark: 0.5, light: 0.4 }), { spec: 0.35 }),
    hole: sk.m(rmp('#3a2020', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    mouth: sk.m(rmp('#b0546a', { n: 4, dark: 0.45 }), { edge: 0 }),
    foot: sk.m(rmp('#d9b6c4', { n: 5, dark: 0.45 }), { edge: 1 }),
    web: sk.m(rmp('#c89aac', { n: 5, dark: 0.45 }), { edge: 1 }),
    claw: sk.m(rmp('#5a4a4e', { n: 4, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, HEAD: 2, BILL: 3, JAW: 4, KEEL: 5, TUBE: 6, TAIL: 7, FOLD: 8, WING: 9, SPUR: 11, LEG: 20 };

// wing: humerus, forearm, the extra "vane-hand" segment and the pointed primaries
const WING: WingShape = {
  sh: [2.2, 1.4, 2.4],
  segs: [
    { len: 7.5, sweep: -0.2, dih: 0.06, flex: -0.55, shrink: 0.15 },
    { len: 10.5, sweep: 0.2, dih: 0.1, flex: 0.95, shrink: 0.2 },
    { len: 9.5, sweep: -0.1, dih: 0.03, flex: -1.1, shrink: 0.3 },
    { len: 10, sweep: -0.42, dih: -0.03, flex: 0.5, shrink: 0.35 },
  ],
  chord: [6.8, 7.2, 6.2, 4.6, 0.6],
  spar: 0.75,
};
const WL: WingLook = { wrist: 2, nS: 13, scallop: 0.07, nP: 8, slot: 0.35, fingers: 3, rows: [0.1, 0.24, 0.4], spar: 0.95, minW: 1.4, point: 0.75, reach: 0.6 };
const LEG: LegLook = { tib: 3.2, tar: 3.4, rTib: 0.9, rTar: 0.62, toe: 3.6, foot: 'web', claw: 0.4, feath: 0.6 };

interface Pose {
  sit: boolean;
  bank: number; pitch: number; yaw: number;
  wings: [WingPose, WingPose];
  neck: number;     // head raised (+) / lowered (-) px
  headA: number;    // bill angle (+ down)
  open: number;     // bill open 0..1
  tail: number;     // tail cock (+ up)
  fan: number;      // tail spread
  feet: 'tuck' | 'brake' | 'run' | 'none';
  run: number;      // takeoff foot phase
  bob: number;
  sky: number;      // sky-pointing display: folded wings lifted (0..1)
  eye?: BeastEye;
}
const W0 = (elev: number, hand = 0, flex = 0, sweep = 0): WingPose => ({ elev, hand, flex, sweep });
const base = (): Pose => ({
  sit: false, bank: -0.3, pitch: 0.02, yaw: 0.34,
  wings: [W0(0.04), W0(0.04)], neck: 0, headA: 0.06, open: 0, tail: 0, fan: 1,
  feet: 'tuck', run: 0, bob: 0, sky: 0,
});

/** heavy flap at phase t (0 = top of the upstroke) */
function flap(t: number, amp = 1): [WingPose, WingPose] {
  const c = Math.cos(t * TAU);
  const up = t > 0.5;
  const w = W0((0.12 + 0.62 * c) * amp, (-0.3 * Math.sin(t * TAU) + (up ? 0.2 : -0.06)) * amp, up ? 0.55 * Math.sin((t - 0.5) * TAU) : 0.02, up ? -0.1 : 0.04);
  return [w, { ...w }];
}

function pose(anim: string, f: number, n: number): Pose {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
    case 'glide':
      // the three joints locked into a shallow crank: elbow forward, knuckle back
      p.bank = -0.42 + (anim === 'idle' ? 0 : [0, 0.05, -0.04][f]);
      p.wings = [W0(0.05 + (f === 1 ? 0.03 : 0), f === 2 ? -0.04 : 0.02, 0.22), W0(0.05, f === 1 ? 0.04 : 0, 0.22)];
      p.fan = 1.1;
      break;
    case 'bank':
      p.bank = vanebillBankAngle(f);
      p.wings = [W0(0.04, 0.02, 0.05), W0(0.06, 0.02, 0.05)];
      p.fan = 1.2;
      p.tail = p.bank * 0.1;
      break;
    case 'flap':
      p.bank = -0.28;
      p.wings = flap(t, 1);
      p.pitch = 0.05 + Math.sin(t * TAU) * 0.03;
      p.fan = 1.15;
      break;
    case 'flute':
      // gliding into the wind with the bill slightly open: the tube nostrils whistle
      p.bank = -0.36;
      p.wings = [W0(0.1, 0.06, 0.12), W0(0.1, 0.06, 0.12)];
      p.open = f ? 0.55 : 0.3;
      p.headA = -0.14;
      p.neck = 0.5;
      break;
    case 'snatch':
      // wings raised back, head and bill thrown down at something on the surface
      p.bank = -0.18;
      p.pitch = [-0.1, -0.28, -0.12][f];
      p.wings = [W0([0.75, 0.95, 0.6][f], 0.25, 0.35, -0.2), W0([0.75, 0.95, 0.6][f], 0.25, 0.35, -0.2)];
      p.neck = [-1, -2.4, -1.4][f];
      p.headA = [0.6, 1.05, 0.7][f];
      p.open = [0.4, 1, 0.2][f];
      p.feet = 'brake';
      p.fan = 1.5; p.tail = -0.2;
      break;
    case 'land':
      p.bank = -0.2;
      p.pitch = [0.28, 0.45, 0.35][f];
      p.wings = [0, 1].map(() => W0([0.5, 0.85, 1.1][f], [0.2, 0.3, -0.2][f], [0.2, 0.35, 0.7][f], -0.25)) as [WingPose, WingPose];
      p.feet = 'brake';
      p.fan = 1.7; p.tail = 0.25;
      break;
    case 'takeoff':
      // pattering across the swell: huge flaps, feet slapping the water
      p.bank = -0.22;
      p.pitch = 0.18;
      p.wings = flap(t, 1.15);
      p.feet = 'run';
      p.run = t;
      p.fan = 1.4; p.tail = 0.15;
      break;
    case 'sit':
      p.sit = true;
      p.bank = 0; p.yaw = 0.2; p.pitch = 0.04;
      p.bob = Math.sin(t * TAU) * 0.5;
      p.headA = [0.08, 0.02, -0.06, 0.04][f];
      p.neck = [0, 0.3, 0.5, 0.2][f];
      p.tail = 0.35;
      p.feet = 'none';
      break;
    case 'display':
      // sky-pointing: bill to the sky, the Z-folded wings lifted to show off the joints, fluting
      p.sit = true;
      p.bank = 0; p.yaw = 0.2; p.pitch = 0.12;
      p.sky = [0.6, 1, 1, 0.8][f];
      p.neck = 2.2; p.headA = -1.25 + [0.15, 0, -0.08, 0.05][f];
      p.open = [0, 0.4, 0.8, 0.3][f];
      p.tail = 0.55; p.fan = 1.5;
      p.feet = 'none';
      break;
  }
  return p;
}

// ------------------------------------------------------------------ wings
function wingFill(M: M) {
  return (w: WingPx, o: Tx) => {
    const nr = WL.rows.length;
    if (w.top) {
      if (w.zone < nr) {
        // covert tracts: dusky brown rows, each with a paler fringe along its trailing border
        o.m = w.zone === 0 ? M.wing : w.fu > 0.8 && w.edge > 0.2 ? M.covF : M.cov;
        return;
      }
      if (w.hand) {
        // the vane-hand: a pale knuckle mirror, then the black primaries with pale shafts
        if (w.s > 0.6 && w.s < 0.73 && w.fu < 0.62) { o.m = w.edge < 0.3 ? M.covF : M.mirror; return; }
        o.m = w.edge < 0.25 ? M.tip : w.edge > 0.88 && w.fu < 0.7 ? M.shaft : M.wing;
        if (w.fu > 0.7) o.m = M.tip;
        return;
      }
      o.m = w.edge < 0.3 ? M.tip : M.wing;
      if (w.fu > 0.85) o.t -= 0.05;
      return;
    }
    // underwing: white lining, a black leading-edge band (broad on the hand), a dark trailing
    // edge and tip, the flight feathers grey with dark shafts
    if (w.c < 0.1 + (w.hand ? 0.12 : 0.02)) { o.m = M.margin; return; }
    if (w.hand && (w.s > 0.82 || w.zone === nr && w.fu > 0.55)) { o.m = w.edge < 0.25 ? M.margin : M.tip; return; }
    if (w.zone === nr) {
      o.m = w.fu > 0.72 ? M.margin : w.edge < 0.25 ? M.under : M.lining;
      if (w.hand) o.m = w.edge < 0.3 ? M.margin : M.under;
      return;
    }
    o.m = w.zone === nr - 1 && w.edge < 0.3 ? M.under : M.lining;
  };
}

/** the horny hinge spurs on the leading edge at the elbow, wrist and knuckle */
function spurs(R: Relief, V: View3, M: M, F: WingFrame) {
  for (const i of [1, 2, 3]) {
    const a = F.le[i], fwd = v3mul(F.cd[i], -1);
    const along = v3norm([F.le[i + 1][0] - F.le[i - 1][0], F.le[i + 1][1] - F.le[i - 1][1], F.le[i + 1][2] - F.le[i - 1][2]]);
    const L = i === 1 ? 1.5 : 2.1;
    const tip = v3add(v3add(a, v3mul(fwd, L)), v3mul(along, L * 0.45));
    const b0 = v3add(a, v3mul(along, -0.9)), b1 = v3add(a, v3mul(along, 0.9));
    const S = (q: V3, sh = 0): LM => { const s = V.s(q); return [s[0], s[1], sh]; };
    const z = V.s(a)[2] + 0.8;
    R.region(spline([S(b0), S(v3add(a, v3mul(fwd, 0.5))), S(tip, 0.9), S(b1)], 0.3), { z, R: 0.6, H: 0.6, id: ID.SPUR, tex: (p, o) => {
      o.m = M.spur;
      const d = Math.hypot(p.x - V.s(a)[0], p.y - V.s(a)[1]);
      if (d < 0.9) o.t -= 0.12;
    } });
  }
}

// ------------------------------------------------------------------ body, head, bill
type Loft2 = ReturnType<typeof loft>;
interface Built { H: HeadF; Lf: Loft2 }

function bodyStations(P: Pose, sit: boolean): { st: Station[]; hc: V3; hf: V3; hu: V3 } {
  const nk = P.neck;
  const hc: V3 = sit ? [8.4, 4.4 + nk, 0] : [8.8, 1.3 + nk, 0];
  const ha = P.headA;
  const hf: V3 = [Math.cos(ha), -Math.sin(ha), 0], hu: V3 = [Math.sin(ha), Math.cos(ha), 0];
  const up: V3 = [0, 1, 0];
  const nu = v3norm(v3add(up, hu));
  const H = (x: number, y: number): V3 => [hc[0] + hf[0] * x + hu[0] * y, hc[1] + hf[1] * x + hu[1] * y, 0];
  const st: Station[] = [
    { c: [-8.8, 0.5, 0], up, ru: 1.4, rl: 1.0, rw: 1.6 },
    { c: [-6.4, 0.3, 0], up, ru: 2.6, rl: 2.2, rw: 2.9 },
    { c: [-2.6, 0, 0], up, ru: 3.4, rl: 3.7, rw: 3.9 },
    { c: [1.4, 0.15, 0], up, ru: 3.3, rl: 4.0, rw: 3.8 },
    { c: [4.4, 0.55 + (nk + (sit ? 1.4 : 0)) * 0.28, 0], up, ru: 2.6, rl: 3.5, rw: 3.0 },
    { c: [6.0, 0.95 + (nk + (sit ? 1.4 : 0)) * 0.62, 0], up: nu, ru: 2.0, rl: 2.6, rw: 2.3 },
    { c: H(-2.3, 0.15), up: hu, ru: 2.45, rl: 2.5, rw: 2.4 },
    { c: H(-0.6, 0), up: hu, ru: 3.25, rl: 2.6, rw: 2.6 },
    { c: H(1.2, -0.05), up: hu, ru: 2.9, rl: 2.15, rw: 2.1 },
    { c: H(2.5, 0.1), up: hu, ru: 1.65, rl: 1.55, rw: 1.3 },
  ];
  return { st, hc, hf, hu };
}

function drawBody(R: Relief, V: View3, M: M, P: Pose, sit: boolean, zb = 0): Built {
  const { st, hc, hf, hu } = bodyStations(P, sit);
  const Lf = loft(V, st);
  const H = new HeadF(V, hc, hf, hu);
  const head0 = st.length - 4;
  const outline = loftOutline(Lf, { head: 0.4, tail: 0.8 });
  const poly = fringe(spline(outline, 0.5), 2.4, 31, (_x, _y, nx, ny) => (ny > 0.55 ? [0.7, 0.5] : nx < -0.6 ? [0.6, 0] : null));
  R.region(poly, {
    zAt: () => LHz + zb, R: 3.4, H: 3.6, id: ID.BODY,
    tex: (p: Sp, o: Tx) => {
      const h = loftAt(Lf, p.x, p.y);
      LHz = h.z;
      const seg = Math.min(Lf.n - 2, Math.floor(h.f));
      const ang = Math.atan2(Lf.s[seg][1] - Lf.s[seg + 1][1], Lf.s[seg][0] - Lf.s[seg + 1][0]);
      o.z += feathers(p.x, p.y, ang, 2.3, 1.7, 11) * 0.55;
      const fringeE = FT.edge;
      o.m = M.white;
      // the sooty saddle across the back between the wings, frayed at its edge
      const sad = 0.48 + (h.f > 3 ? (h.f - 3) * 0.35 : 0) + (FT.col & 1) * 0.06;
      if (h.f < 4.6 && h.dors > sad) o.m = fringeE === 0.5 ? M.saddleF : M.saddle;
      else if (fringeE === 1 && h.dors > -0.2) o.m = M.whiteF;
      if (h.f >= head0 - 0.4) {
        // the dusky brow smudge over and behind the eye: the stern look
        const [hx, hy] = H.local(p.x, p.y);
        if (h.lat > 0.15 && hy < -0.25 && hy > -2.1 + hx * 0.15 && hx < 1.2 && hx > -2.8) o.m = M.brow;
      }
      if (h.v < -0.6) o.t -= 0.03;
    },
  });
  // the keeled breast and the shoulder
  const br = V.s([2, -2, 2]); R.bump(br[0], br[1], 4, 3, 0.9, 0, ID.BODY);
  const ne = V.s([5, 1.4 + P.neck * 0.4, 2]); R.bump(ne[0], ne[1], 2.2, 2, -0.5, 0, ID.BODY);
  return { H, Lf };
}
let LHz = 0;

function drawBill(R: Relief, H: HeadF, M: M, P: Pose) {
  const open = P.open;
  const z0 = H.zOf(4, 0, 0);
  // lower mandible: hinged at the gape, drops with the gape
  const oa = open * 0.32, co = Math.cos(oa), so = Math.sin(oa);
  const J = (x: number, y: number, sh = 0): LM => { const dx = x - 2.3, dy = y - 0.6; return H.s(2.3 + dx * co - dy * so, 0.6 + dx * so + dy * co, 0, sh); };
  R.region(spline([J(2.2, 0.75), J(6, 0.8), J(9.3, 0.85), J(10.3, 1.1, 0.8), J(9.8, 1.6, 0.3), J(6.6, 2.0, 0.3), J(3.6, 2.2), J(2.0, 1.9)], 0.4), {
    z: z0 + 1.2, R: 0.7, H: 0.9, id: ID.JAW, tex: (p, o) => {
      const [hx] = H.local(p.x, p.y);
      const [, hy] = H.local(p.x, p.y);
      o.m = hx > 9.3 ? M.hook : hx < 3.2 ? M.billD : M.bill;
      if (fr(hx * 0.9) < 0.12 && hx < 9) o.z -= 0.25;
      if (hy < 0.85 + open * (hx - 2.3) * 0.33) o.m = M.gape;
    },
  });
  if (open > 0.2) {
    R.region(spline([H.s(2.4, 0.6), H.s(9, 0.5), J(9, 0.7), J(3, 0.75)], 0.4), { z: z0 + 1.0, R: 0.4, H: 0.2, id: ID.HEAD, tex: M.mouth });
  }
  // upper mandible: plated, a groove along the side plate, a deep dark hooked nail
  R.region(spline([H.s(1.9, -1.6), H.s(4.6, -1.4), H.s(7.6, -1.05), H.s(9.7, -0.75), H.s(10.9, 0.0), H.s(11.2, 1.55, 0.9), H.s(10.4, 1.0, 0.4), H.s(9.4, 0.45), H.s(6, 0.35), H.s(2.6, 0.62), H.s(1.8, 0.2)], 0.4), {
    z: z0 + 1.6, R: 0.9, H: 1.3, id: ID.BILL, tex: (p, o) => {
      const [hx, hy] = H.local(p.x, p.y);
      o.m = hx > 9.45 ? M.hook : hx < 2.8 ? M.billD : M.bill;
      // the side plate's groove (latericorn) and the nail's groove
      if (Math.abs(hy - (-0.35 + hx * 0.03)) < 0.28 && hx > 3.4 && hx < 9.3) { o.z -= 0.5; o.m = M.billD; }
      if (Math.abs(hx - 9.45) < 0.3) { o.z -= 0.45; o.m = M.billD; }
      // the cutting edge: a dark line along the commissure
      if (hy > 0.05 + (hx > 9.4 ? (hx - 9.4) * 0.5 : 0) && hx < 10.4) o.m = M.gape;
    },
  });
}

/** the vane: a coral keel swept back like a sail on the culmen, with growth ridges and a pale rim */
function drawKeel(R: Relief, H: HeadF, M: M) {
  const K: LM[] = [H.s(3.6, -1.4), H.s(3.25, -3.2), H.s(2.85, -5.3), H.s(2.7, -7.0, 0.85), H.s(3.75, -6.1), H.s(5.0, -4.3), H.s(6.3, -2.6), H.s(7.7, -1.3, 0.4)];
  const zk = H.zOf(4, -2, 0) + 2.2;
  const lead = [H.s2(2.7, -7.0), H.s2(3.75, -6.1), H.s2(5.0, -4.3), H.s2(6.3, -2.6), H.s2(7.7, -1.3)];
  const root = H.s2(4.8, -1.1);
  R.region(spline(K, 0.35), { z: zk, R: 0.8, H: 0.7, id: ID.KEEL, tex: (p, o) => {
    // bony growth ridges fanning up from the root, a pale rim on the leading edge
    const a = Math.atan2(p.y - root[1], p.x - root[0]);
    const r = Math.hypot(p.x - root[0], p.y - root[1]);
    o.m = M.keel;
    if (fr(a * 3.2) < 0.22) { o.z -= 0.4; o.m = M.keelD; }
    if (r < 1.6) o.m = M.keelD;
    let dl = Infinity;
    for (let i = 1; i < lead.length; i++) {
      const s = lead[i - 1], e = lead[i], ex = e[0] - s[0], ey = e[1] - s[1], LL = ex * ex + ey * ey || 1;
      let k = ((p.x - s[0]) * ex + (p.y - s[1]) * ey) / LL; k = k < 0 ? 0 : k > 1 ? 1 : k;
      dl = Math.min(dl, Math.hypot(p.x - s[0] - ex * k, p.y - s[1] - ey * k));
    }
    if (dl < 0.8) { o.m = M.keelRim; o.z += 0.3; }
  } });
  // paired tube nostrils at the keel's foot, ending in dark flute holes
  if (H.facing(0)) {
    const t0 = H.s2(2.4, -1.0, 0.7), t1 = H.s2(5.0, -1.15, 0.7);
    R.tube([t0, t1], t => 0.72 - t * 0.12, { z: H.zOf(3.5, -1, 1.2) + 2.4, id: ID.TUBE, tex: (p, o) => { o.m = p.t > 0.86 ? M.hole : M.tube; if (fr(p.s / 1.2) < 0.25) o.z -= 0.2; } });
  }
}

/** the short wedge of a tail in the horizontal plane */
function drawTail(R: Relief, V: View3, M: M, P: Pose, root: V3, zb = 0) {
  const ct = Math.cos(P.tail), stl = Math.sin(P.tail);
  const back: V3 = [-ct, -stl, 0];
  const F = fan(V, root, back, [0, 0, 1], 9, 0.95 * P.fan, t => 6 * P.fan ** 0.25 * (1 - Math.abs(t - 0.5) * 0.55), { minW: 1.3, notch: 0.1, base: 1.4, point: 0.55 });
  const z = V.s(root)[2] - 1 + zb;
  R.region(spline(F.poly, 0.4), { z, R: 1, H: 1.2, id: ID.TAIL, tex: (p, o) => {
    const q = fanAt(F, p.x, p.y);
    o.m = q.u > 0.74 ? M.tailTip : V.faces([0, 1, 0]) ? M.tailT : M.white;
    if (q.edge < 0.3) o.z -= 0.35;
  } });
}

function drawFoot(R: Relief, V: View3, M: M, P: Pose, side: 1 | -1) {
  const hip = V.s([-3.2, -1.4, side * 1.4]);
  let toe: V3;
  if (P.feet === 'tuck') toe = [-11.6, -0.6, side * 1.2];
  else if (P.feet === 'brake') toe = [2.2, -8.2, side * 2.6];
  else {
    const ph = P.run + (side > 0 ? 0 : 0.5);
    toe = [-2 + Math.cos(ph * TAU) * 4, -8.6 + Math.max(0, Math.sin(ph * TAU)) * 2.5, side * 2];
  }
  const f = V.s(toe);
  const ta = P.feet === 'tuck' ? Math.atan2(V.s([-12.5, -0.6, 0])[1] - V.s([-10, -0.6, 0])[1], V.s([-12.5, -0.6, 0])[0] - V.s([-10, -0.6, 0])[0]) : P.feet === 'brake' ? 0.5 : 0.9 - Math.sin((P.run + (side > 0 ? 0 : 0.5)) * TAU) * 0.6;
  leg(R, [hip[0], hip[1]], [f[0], f[1]], LEG, { tib: M.white, leg: M.foot, toe: M.foot, web: M.web, claw: M.claw }, (hip[2] + f[2]) / 2, 1, { ta, spread: P.feet === 'tuck' ? 0.3 : 1, bend: P.feet === 'tuck' ? -1 : 1 }, ID.LEG);
}

function drawFlight(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  // far wing and its spurs
  {
    const R = Relief.full(sk);
    const F = wingFrame(WING, P.wings[1], -1);
    wing(R, V, F, WL, wf, { id: ID.WING, lt: -0.08 });
    spurs(R, V, M, F);
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5, seamDark: 0.22, bias: -0.16 });
  }
  // feet: tucked with the toes just past the tail (a tubenose trait, only seen from below), thrown forward to brake, or running
  const feet = P.feet !== 'none' && (P.feet !== 'tuck' || P.bank < -0.45);
  const BR = Relief.full(sk);
  if (feet) drawFoot(BR, V, M, P, -1);
  drawTail(BR, V, M, P, [-7.6, 0.4, 0]);
  const { H } = drawBody(BR, V, M, P, false);
  drawBill(BR, H, M, P);
  drawKeel(BR, H, M);
  if (feet) drawFoot(BR, V, M, P, 1);
  BR.shadow(ID.KEEL, 0.6, 0.9, 0.08, ID.BILL, 1);
  sk.np();
  BR.emit({ drop: 1.5, seam: 0.6, seamDark: 0.26, ao: 0.05, aoR: 2 });
  const ep = eyeOf(sk, H, P.eye ?? eye);
  // near wing
  {
    const R = Relief.full(sk);
    const F = wingFrame(WING, P.wings[0], 1);
    wing(R, V, F, WL, wf, { id: ID.WING });
    spurs(R, V, M, F);
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5, seamDark: 0.22, bias: -0.1 });
  }
  return { head: V.s2([H.c[0], H.c[1] + 6, 0]), eye: ep };
}

// ------------------------------------------------------------------ on the water
const FOLD: FoldLook = { len: 1, dep: 1, tert: 0.5, nP: 6, cov: 0.4, gc: 0.58 };

/** the Z-folded wing: the arm along the flank, the vane-hand folded back over it, spurs at the hinges */
function foldPack(R: Relief, V: View3, M: M, side: 1 | -1, P: Pose) {
  const lift = P.sky;
  const z = side * 3.2;
  const c: V3 = [4.4, 2.9 + lift * 1.2, z];
  const ax = v3norm([-1, 0.06 + lift * 0.38, 0]);
  const dnv: V3 = [-ax[1], ax[0], 0];
  const F = foldMap3(V, c, ax, dnv, 17.5, 4.4, 0.1);
  const zz = V.s(c)[2] + (side > 0 ? 1 : -1);
  R.region(spline(foldOutline(F.map, FOLD), 0.4), { z: zz, R: 1.4, H: 1.6, id: ID.FOLD + (side > 0 ? 0 : 20), tex: foldTex(FOLD, F.inv, (f, o) => {
    if (f.zone === 'les') o.m = f.edge < 0.3 ? M.wing : M.cov;
    else if (f.zone === 'gc') o.m = f.edge < 0.3 ? M.wing : f.v > FOLD.gc - 0.1 ? M.covF : M.cov;
    else if (f.zone === 'ter') o.m = f.u > 0.36 && f.u < 0.46 && f.v < 0.5 ? M.mirror : f.edge < 0.3 ? M.tip : M.wing;
    else if (f.zone === 'sec') o.m = f.edge < 0.3 ? M.tip : M.wing;
    else o.m = f.edge < 0.3 ? M.wing : M.tip;
  }) });
  if (side > 0) {
    // hinge spurs at the wrist (front of the pack) and at the knuckle fold on top
    for (const [u, v, L, a] of [[0.0, 0.42, 1.8, Math.PI * 1.02], [0.47, 0.1, 1.6, -Math.PI * 0.62 - lift * 0.4]] as [number, number, number, number][]) {
      const b = F.map(u, v);
      const tip: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
      const pa = Math.atan2(tip[1] - b[1], tip[0] - b[0]) + Math.PI / 2;
      R.region(spline([[b[0] + Math.cos(pa) * 0.9, b[1] + Math.sin(pa) * 0.9, 0], [tip[0], tip[1], 0.9], [b[0] - Math.cos(pa) * 0.9, b[1] - Math.sin(pa) * 0.9, 0]], 0.3), { z: zz + 2.5, R: 0.5, H: 0.6, id: ID.SPUR, tex: M.spur });
    }
  }
}

function drawWater(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  // anchor = waterline under the body; the hull floats half sunk
  const V = new View3(0, P.pitch, P.yaw, [0, -3.6 + P.bob], 1);
  sk.clipY = 0.6;
  const BR = Relief.full(sk);
  // the tail cocked up out of the water
  drawTail(BR, V, M, { ...P, tail: P.tail }, [-7.2, 0.9, 0]);
  foldPack(BR, V, M, -1, P);
  const { H } = drawBody(BR, V, M, P, true);
  drawBill(BR, H, M, P);
  drawKeel(BR, H, M);
  foldPack(BR, V, M, 1, P);
  BR.shadow(ID.FOLD, 0.6, 1.2, 0.1, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.5, seam: 0.6, seamDark: 0.26, ao: 0.05, aoR: 2 });
  const ep = eyeOf(sk, H, P.eye ?? eye);
  // wake ripples round the waterline
  sk.clipY = Infinity;
  for (let x = -12; x <= 12; x++) if (hh(x, 3, 11) > 0.35) sk.over(x, 0, hex('#dff1f6'));
  sk.over(-13, 1, hex('#bfe0ea')); sk.over(13, 1, hex('#bfe0ea'));
  return { head: V.s2([H.c[0], H.c[1] + 6, 0]), eye: ep };
}

/** the eye with a thin pale-blue ring crescent below and behind it, inside the dusky brow */
function eyeOf(sk: Sk, H: HeadF, st: BeastEye): V2 {
  let ep: V2 = H.s2(0.35, -0.55, 2.1);
  if (!H.facing(0.05)) return ep;
  ep = drawEye(sk, ep[0], ep[1], EYE, st);
  if (st !== 'closed') {
    const X = Math.floor(ep[0] - 1), Y = Math.floor(ep[1] - 1);
    const ring = hex('#a8d0dc');
    sk.overPaint(X - 1, Y + 1, ring); sk.overPaint(X, Y + 2, ring); sk.overPaint(X + 1, Y + 2, ring);
  }
  return ep;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye): { head: V2; eye: V2 } {
  const n = ANIMS[anim]?.frames ?? 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  return P.sit ? drawWater(sk, M, P, eye) : drawFlight(sk, M, P, eye);
}

const AIR = ['idle', 'glide', 'bank', 'flap', 'flute', 'snatch', 'land', 'takeoff'];
export const VANEBILL: SpeciesDef = {
  name: 'Fluting Vanebill', kind: 'bird', len: 24, height: 14,
  anims: ANIMS,
  canvas: (anim) => (AIR.includes(anim) ? { w: 104, h: 84, ox: 52, oy: 42 } : { w: 48, h: 40, ox: 24, oy: 30 }),
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim) => (anim === 'snatch' ? 'angry' : anim === 'display' ? 'alert' : 'open'),
  anchor: Object.fromEntries(AIR.map(a => [a, 'centre'])) as Record<string, 'centre'>,
};
void clamp;
