// V12 wild birds of the high country (the species, their minds and their API: src/game/v12/wild/birds.ts).
//
// The Kea (Nestor notabilis), the alpine parrot: a stocky olive-green parrot, every contour feather tipped
// black so the whole bird looks scaled, with a bronze sheen on the back and wing coverts; blue-green outer
// webs on the primaries; a long, narrow, strongly hooked grey-black upper bill far overhanging the lower;
// a dark eye in a pale bare ring; grey zygodactyl feet (two toes forward, two back). Under the wings and
// on the rump it is blazing orange-scarlet: hidden at rest, flashed the moment it lifts its wings.
// Anims: idle (head tilts, a preen), alert (head cocked, peering), walk / hop (bouncy two-footed hops),
// peck (tugging at something with the bill), eat (the same, gentler), call (bill open: "keee-aa"), fly (flapping, the orange
// underwings on every upstroke), glide, flash (wings thrown up on the spot), carry (flying off with a stolen
// pouch), play (rolling on its back, feet kicking, tumbling upright again), toy (fiddling with the pouch:
// held up in one foot, nibbled, juggled on its back), sleep.
//
// The Ruru (Ninox novaeseelandiae), the morepork: a small, dark chocolate owl, the breast streaked and
// blotched buff and white, white spots on the wing coverts and scapulars, a barred tail; a dark facial disc
// with pale "eyebrows" meeting over the small dark hooked bill; big round yellow eyes; yellow feet.
// It sits with its body side-on and its face turned to you. In its tree hollow (anims roost, peek,
// headturn, blink, call) only the head and shoulders are drawn: the anchor is the hollow's lip, which the
// scene paints in front. Out of the hollow (perch, fly, pounce, sleep) the full bird stands on its feet.
// Anims: roost (eyes shut to slits), peek (eyes wide, staring), headturn (the head swung right round to
// look back over its shoulder and back again), blink, call ("more-pork": the throat puffs, the bill opens,
// two beats), perch, fly (broad, soft, silent wings), pounce (dropping on prey, talons thrown forward),
// sleep.
//
// How they are painted (on the relief layer, beasts-relief.ts, with ./wildbird-kit.ts): never balls and
// tubes. Each mass is one continuous contour through anatomical landmarks that follow the pose: the kea's
// body and tail in one (breast, belly, vent, the square tail with its black band, rump, mantle), its head
// and neck in another (crown, forehead, the face, chin and throat flowing into the breast), the long
// hooked bill as two mandibles of its own; the folded wing a third contour from the bend to the primary
// tips over the tail, its tracts in steps (scaled bronze coverts, black-tipped secondaries, blue-edged
// primaries). The ruru: broad shoulders tapering into a short barred tail, the big flat-crowned head set
// straight on them (its shadow across the breast), the folded wing with its white scapular spots, the
// face in hand-placed pixels. Spread wings are one contour each (wildbird-kit cwing): leading edge, the
// fingertips, the scalloped trailing edge, the covert rows and flight feathers inside.
//
// All anchors are at the feet (or the hollow's lip): the flight frames too, so a bird lands without a jump.

import { Sk, V2, rmp, SpeciesDef, BeastEye, TAU, hh, ik2 } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import type { WingPose } from '../../beasts-bird';
import { Relief, spline } from '../../beasts-relief';
import type { LM } from '../../beasts-relief';
import { cwing, cell2 } from './wildbird-kit';
import type { CWingLook, WFill } from './wildbird-kit';
import { hex } from '../../color';
import type { C } from '../../color';

const fr = (v: number) => v - Math.floor(v);
/** the juggled pouch: tossed up off the feet, caught */
const f3 = (f: number) => (f === 4 ? 12.4 : 10.2);
/** body-local coordinates of a screen point in frame F */
function inv(F: Frame2, x: number, y: number): V2 {
  const dx = x - F.o[0], dy = y - F.o[1];
  const c = Math.cos(F.a), s = Math.sin(F.a);
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  return [lx / (F.k * F.mx), ly / F.k];
}

// ================================================================== the Kea
const KANIMS = {
  idle: { frames: 6, fps: 2.6, loop: true },
  alert: { frames: 2, fps: 2.5, loop: true },
  walk: { frames: 4, fps: 9, loop: true },
  hop: { frames: 4, fps: 7, loop: true },
  peck: { frames: 4, fps: 7, loop: true },
  eat: { frames: 4, fps: 5, loop: true },
  call: { frames: 4, fps: 5, loop: true },
  fly: { frames: 6, fps: 10, loop: true },
  glide: { frames: 2, fps: 2, loop: true },
  flash: { frames: 4, fps: 6, loop: true },
  carry: { frames: 6, fps: 10, loop: true },
  play: { frames: 6, fps: 5, loop: true },
  toy: { frames: 6, fps: 4, loop: true },
  sleep: { frames: 2, fps: 0.8, loop: true },
};
const KFLY = new Set(['fly', 'glide', 'carry']);

interface KP {
  b: V2; ba: number;
  /** on its back: the body frame is mirrored top to bottom */
  flip: boolean;
  /** neck: world angle and length from the neck base; head: world angle of the bill's axis */
  na: number; nl: number; ha: number;
  open: number;
  /** head cocked (the face rolled up toward the viewer: the eye shows more, the crown less) */
  cock: number;
  tailA: number; tailL: number;
  wing: 'fold' | [WingPose, WingPose];
  /** folded wings lifted off the back (the rump and the orange underwing show) */
  lift: number;
  /** foot targets (near, far): ground points, 'tuck' (flight) or kicking up (on its back, body-local) */
  feet: [V2, V2] | 'tuck';
  /** a foot raised and gripping (toy): body-local target for the near foot */
  grab?: V2;
  /** the stolen pouch: 1 in the bill, 2 held in the near foot, 3 juggled above the feet */
  item: number;
  ruffle: number;
  eye?: BeastEye;
}

function kstand(): KP {
  return {
    b: [-1.4, -5.6], ba: -0.55, flip: false,
    na: -1.22, nl: 3.2, ha: 0.12, open: 0, cock: 0,
    tailA: 2.62, tailL: 6.6,
    wing: 'fold', lift: 0, feet: [[1.3, 0], [-0.2, 0]], item: 0, ruffle: 0,
  };
}
function kflap(t: number): WingPose {
  const c = Math.cos(t * TAU);
  const up = t > 0.5;
  return { th: 0.2 + 0.95 * c, hand: -0.35 * Math.sin(t * TAU) + (up ? 0.3 : -0.05), fold: up ? 0.45 * Math.sin((t - 0.5) * TAU) : 0, sweep: 0.12 + (up ? -0.12 : 0.05), spread: 1 };
}
function kair(): KP {
  const p = kstand();
  p.b = [0, -4.2]; p.ba = 0.08;
  p.na = -0.35; p.nl = 2.4; p.ha = 0.22;
  p.tailA = Math.PI + 0.04; p.tailL = 6.4;
  p.feet = 'tuck';
  return p;
}

function kpose(anim: string, f: number, n: number): KP {
  const p = kstand();
  const t = f / n;
  switch (anim) {
    case 'idle': {
      // looking about, a head tilt, a slow preen into the shoulder
      const H = [[-1.22, 0.12, 0], [-1.25, 0.05, 0.9], [-1.15, 0.3, -0.5], [-1.22, 0.12, 0], [-2.3, 2.5, 0], [-2.2, 2.3, 0]];
      p.na = H[f][0]; p.ha = H[f][1]; p.cock = H[f][2];
      if (f >= 4) { p.nl = 2.4; p.ruffle = 0.4; p.lift = f === 5 ? 0.18 : 0; }
      p.b[1] += f === 2 ? 0.3 : 0;
      break;
    }
    case 'alert':
      p.b = [-1.2, -6.2]; p.ba = -0.75; p.na = -1.35; p.nl = 3.6; p.ha = f ? -0.05 : 0.15; p.cock = f ? 1 : 0.6; p.tailA = 2.5;
      p.eye = 'alert';
      break;
    case 'walk': case 'hop': {
      // two-footed bouncing hops: crouch, push off, airborne with the feet swung forward, land
      const big = anim === 'hop' ? 1.5 : 1;
      const up = [0, 2.2, 3.4, 0.8][f] * big, fwd = [0, 0.6, 1.2, 1.6][f] * big;
      p.b = [-1.4 + fwd, -5.6 + (f === 0 ? 1 : 0) - up];
      p.ba = [-0.4, -0.7, -0.55, -0.35][f];
      p.na = [-1.0, -1.3, -1.2, -1.05][f];
      p.ha = [0.3, 0.05, 0.1, 0.25][f];
      p.tailA = [2.75, 2.45, 2.6, 2.8][f];
      const lift = Math.max(0, up - 1.2);
      p.feet = [[1.3 + fwd + (f === 2 ? 0.8 : 0), -lift], [-0.2 + fwd + (f === 2 ? 0.8 : 0), -lift]];
      p.lift = f === 1 || f === 2 ? 0.15 : 0;
      break;
    }
    case 'peck': case 'eat': {
      // bill hooked over something at its feet, tugging back with the whole body (eating: gentler)
      const tug = [0, 1, 0.6, 1][f] * (anim === 'eat' ? 0.4 : 1);
      p.b = [-1.6 - tug * 1.2, -5 + tug * 0.2]; p.ba = -0.25 - tug * 0.25;
      p.na = 0.45 - tug * 0.25; p.nl = 3.4; p.ha = 1.15 - tug * 0.35;
      p.open = f === 0 ? 0.5 : 0.1;
      p.tailA = 2.9; p.feet = [[1.4, 0], [-0.6, 0]];
      break;
    }
    case 'call':
      p.ba = -0.7; p.b = [-1.4, -5.9];
      p.na = -1.45 + (f % 2) * 0.1; p.nl = 3.5; p.ha = f === 1 || f === 2 ? -0.75 : -0.4;
      p.open = [0.4, 1, 1, 0.5][f];
      p.lift = f === 1 || f === 2 ? 0.12 : 0;
      break;
    case 'flash': {
      // wings thrown up on the spot: the orange-scarlet underwings and rump blaze
      p.ba = -0.6; p.b = [-1.4, -5.8 - (f === 1 || f === 2 ? 0.4 : 0)];
      p.na = -1.3; p.ha = -0.1 + (f === 2 ? -0.3 : 0); p.open = f === 2 ? 0.7 : 0.2;
      const th = [0.9, 1.35, 1.45, 1.15][f];
      const w: WingPose = { th, hand: [0.4, 0.15, 0.05, 0.3][f], fold: [0.35, 0.1, 0.05, 0.2][f], sweep: -0.55, spread: 1.15 };
      p.wing = [w, { ...w, th: th - 0.08 }];
      p.tailA = 2.45;
      break;
    }
    case 'sleep':
      p.b = [-1.2, -5.0]; p.ba = -0.45; p.ruffle = 1 + f * 0.15;
      p.na = -2.0; p.nl = 1.6; p.ha = 2.9; p.eye = 'closed';
      p.feet = [[0.8, 0], [0.2, 0]];
      break;
    case 'play': {
      // the roll: lean back, flop onto its back and kick, a wing flopped out, roll back up
      if (f === 0) { p.ba = -1.15; p.b = [-2.2, -5.2]; p.na = -0.9; p.ha = -0.5; p.open = 0.6; p.tailA = 2.25; p.feet = [[2.4, -1.2], [0.6, 0]]; break; }
      if (f >= 1 && f <= 3) {
        p.flip = true; p.ba = [0.25, 0.1, 0.18][f - 1]; p.b = [0, -4.1];
        p.na = [-0.25, -0.15, -0.3][f - 1]; p.nl = 2.8; p.ha = [-0.6, -0.75, -0.5][f - 1]; p.open = [0.8, 0.3, 1][f - 1];
        p.tailA = Math.PI - 0.15; p.tailL = 6.8;
        const kick = [[[2.4, 7.4], [0, 7.8]], [[1.2, 8.2], [1.6, 7.0]], [[2.8, 7.0], [-0.6, 8.0]]][f - 1] as [V2, V2];
        p.feet = kick;
        p.lift = f === 2 ? 0.55 : 0.2;
        break;
      }
      if (f === 4) { p.ba = 0.9; p.b = [-0.6, -4.6]; p.na = -0.6; p.ha = 0.4; p.feet = [[2.2, -1], [-1.2, 0]]; p.tailA = 3.4; p.lift = 0.3; break; }
      p.ruffle = 0.8; p.na = -1.3; p.ha = 0.3; p.cock = 0.8; p.open = 0.3;
      break;
    }
    case 'toy': {
      // the pouch: nibbled on the ground, picked up, tossed, juggled on its back, carried proudly
      if (f === 0) { p.b = [-1.8, -4.9]; p.ba = -0.3; p.na = 0.35; p.nl = 3.3; p.ha = 1.1; p.open = 0.5; p.tailA = 2.9; p.item = 4; break; }
      if (f === 1) { p.ba = -0.6; p.na = -1.1; p.ha = 0.45; p.open = 0.2; p.item = 1; p.cock = 0.5; break; }
      if (f === 2) { p.ba = -0.8; p.b = [-1.6, -6.0]; p.na = -1.5; p.nl = 3.5; p.ha = -0.9; p.open = 1; p.item = 5; break; }
      if (f === 5) { p.ba = -0.6; p.na = -1.2; p.ha = 0.2; p.item = 1; p.cock = 0.9; break; }
      p.flip = true; p.ba = f === 3 ? 0.2 : 0.12; p.b = [0, -4.1];
      p.na = -0.2; p.nl = 2.8; p.ha = -0.7; p.open = f === 3 ? 0.6 : 0.2;
      p.tailA = Math.PI - 0.15; p.tailL = 6.8;
      p.feet = f === 3 ? [[2.4, 7.6], [0.6, 8.0]] : [[1.8, 8.2], [0.4, 7.4]];
      p.item = 3;
      break;
    }
    case 'fly': case 'carry': {
      const q = kair();
      q.wing = [kflap(t), kflap(t)];
      q.b[1] += Math.sin(t * TAU) * 0.8;
      q.item = anim === 'carry' ? 1 : 0;
      return q;
    }
    case 'glide': {
      const q = kair();
      q.wing = [{ th: 0.32 + f * 0.04, hand: -0.12, fold: 0.05, sweep: 0.08, spread: 1 }, { th: -0.2 + f * 0.04, hand: 0.05, fold: 0.05, sweep: 0.08, spread: 1 }];
      return q;
    }
  }
  return p;
}

function kmats(sk: Sk) {
  return {
    olive: sk.m(rmp('#5a6a28', { n: 6, dark: 0.55, light: 0.24, warm: 0.4, cool: 0.12 }), { edge: 1 }),
    breast: sk.m(rmp('#5e5b2a', { n: 6, dark: 0.55, light: 0.18, warm: 0.3, cool: 0.08 }), { edge: 1 }),
    head: sk.m(rmp('#6a6c30', { n: 6, dark: 0.55, light: 0.26, warm: 0.4, cool: 0.1 }), { edge: 1 }),
    tip: sk.m(rmp('#1e1d10', { n: 3, dark: 0.35, light: 0.22 }), { edge: 0 }),
    bronze: sk.m(rmp('#76702e', { n: 4, dark: 0.45, light: 0.15, warm: 0.4 }), { edge: 0 }),
    cov: sk.m(rmp('#5a6c2a', { n: 6, dark: 0.58, light: 0.26, warm: 0.45, cool: 0.12 }), { edge: 1 }),
    sec: sk.m(rmp('#44522a', { n: 6, dark: 0.62, light: 0.22, warm: 0.3 }), { edge: 2 }),
    prim: sk.m(rmp('#2e3824', { n: 5, dark: 0.6, light: 0.2, cool: 0.2 }), { edge: 2 }),
    blue: sk.m(rmp('#2b5c5c', { n: 5, dark: 0.55, light: 0.16, cool: 0.2 }), { edge: 1 }),
    orange: sk.m(rmp('#f0601a', { n: 6, dark: 0.3, light: 0.3, warm: 0.6, cool: 0, sat: 0 }), { edge: 1 }),
    scarlet: sk.m(rmp('#dc4016', { n: 6, dark: 0.32, light: 0.28, warm: 0.5, cool: 0, sat: 0 }), { edge: 1 }),
    underF: sk.m(rmp('#4a3e2e', { n: 5, dark: 0.55, light: 0.25 }), { edge: 1 }),
    bar: sk.m(rmp('#f08e22', { n: 5, dark: 0.34, light: 0.3, warm: 0.5, cool: 0, sat: 0 }), { edge: 0 }),
    tail: sk.m(rmp('#475424', { n: 6, dark: 0.6, light: 0.16, warm: 0.3, cool: 0.1 }), { edge: 2 }),
    tailTip: sk.m(rmp('#76782e', { n: 5, dark: 0.55, light: 0.22, warm: 0.4 }), { edge: 1 }),
    band: sk.m(rmp('#24261a', { n: 4, dark: 0.45, light: 0.22 }), { edge: 1 }),
    bill: sk.m(rmp('#46454e', { n: 5, dark: 0.6, light: 0.32, cool: 0.3 }), { edge: 1, spec: 0.4 }),
    leg: sk.m(rmp('#6a6e76', { n: 5, dark: 0.52, light: 0.3, cool: 0.3 }), { edge: 1 }),
    claw: sk.m(rmp('#26262a', { n: 3, dark: 0.4 }), { edge: 0 }),
    mouth: sk.m(rmp('#3a1c20', { n: 3, dark: 0.4 }), { edge: 0 }),
    pouch: sk.m(rmp('#b09a62', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    strap: sk.m(rmp('#b0402a', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 }),
  };
}

const K_EYE: C = hex('#120c08'), K_RING = hex('#8a8670'), K_SHINE = hex('#d8d2bc');

function kdraw(sk: Sk, anim: string, frame: number, eyeSt: BeastEye, juv: boolean) {
  const n = KANIMS[anim as keyof typeof KANIMS]?.frames ?? 1;
  const P = kpose(anim, frame, n);
  const k = juv ? 0.82 : 1;
  const M = kmats(sk);
  const b: V2 = [P.b[0] * k, P.b[1] * k];
  const B = P.flip ? new Frame2(b, P.ba + Math.PI, k, -1) : new Frame2(b, P.ba, k, 1);
  const RY = 3.9 * (1 + P.ruffle * 0.08), rf = 1 + P.ruffle * 0.1;
  const air = P.feet === 'tuck';
  const flying = P.wing !== 'fold';
  // ------------------------------------------------ far leg, far wing
  const hip = B.p(0.7, 2.7);
  const legs = (near: boolean) => {
    sk.np();
    const z = near ? 6 : -6, bias = near ? 0 : -0.16;
    const h: V2 = [hip[0] + (near ? 0.4 : -0.4) * k, hip[1]];
    let foot: V2;
    if (air) foot = B.p(-2.2 + (near ? 0.4 : -0.6), 4.6);
    else if (near && P.grab) foot = B.p(P.grab[0], P.grab[1]);
    else {
      const f = (P.feet as [V2, V2])[near ? 0 : 1];
      foot = P.flip ? B.p(f[0], f[1]) : [f[0] * k, f[1] * k];
    }
    const [knee, end] = ik2(h, foot, 2.3 * k, 2.2 * k, P.flip ? -1 : 1);
    // the feathered thigh (its own little contour, olive scaled like the flank), the bare grey tarsus
    const ta = Math.atan2(knee[1] - h[1], knee[0] - h[0]), tc = Math.cos(ta), ts = Math.sin(ta);
    const tp = (u: number, w: number): LM => [h[0] + tc * u - ts * w, h[1] + ts * u + tc * w, 0];
    const tl = Math.hypot(knee[0] - h[0], knee[1] - h[1]);
    const TR = new Relief(sk, Math.min(h[0], knee[0]) - 3, Math.min(h[1], knee[1]) - 3, Math.max(h[0], knee[0]) + 3, Math.max(h[1], knee[1]) + 3);
    TR.region(spline([tp(-0.6, -1.5 * k), tp(tl * 0.6, -1.2 * k), tp(tl + 0.3, -0.5 * k), tp(tl + 0.3, 0.6 * k), tp(tl * 0.5, 1.4 * k), tp(-0.6, 1.5 * k)], 0.4), {
      z, R: 1, H: 1.2, id: 1, tex: (p, o) => { o.m = M.olive; if (cell2(p.x, p.y, ta, 1.8, 1.5, 9) === 2) o.m = M.tip; },
    });
    TR.emit({ bias, drop: 1 });
    sk.np();
    sk.tube([knee, end], 0.6 * k, M.leg, { z: z + 0.3, bias });
    // zygodactyl foot: two toes forward, two back (curled shut in flight and when gripping)
    const curl = air || (near && P.grab) ? 1 : 0;
    const grasp = P.flip && !air;
    const fwdA = P.flip ? -0.15 : 0.05, backA = Math.PI - (P.flip ? -0.2 : 0.25);
    const toes: [number, number][] = curl ? [[0.9, 1.2], [1.4, 1.0], [Math.PI - 1.2, 0.9]]
      : grasp ? [[-0.6, 1.8], [-1.0, 1.4], [-2.5, 1.6], [-2.1, 1.2]]
      : [[fwdA, 2.0], [fwdA + 0.25, 1.6], [backA, 1.5], [backA - 0.3, 1.2]];
    for (const [a, L] of toes) {
      const tip: V2 = [end[0] + Math.cos(a) * L * k, end[1] + Math.sin(a) * L * k * (curl || grasp ? 1 : 0.25)];
      sk.tube([end, tip], 0.5 * k, M.leg, { z: z + 0.5, bias });
      if (!curl && !grasp) sk.dot(tip[0] + Math.cos(a) * 0.6, tip[1] + 0.3, M.claw, 0.3, z + 0.6);
    }
    return end;
  };
  legs(false);
  if (flying) kspread(sk, M, b, (P.wing as [WingPose, WingPose])[1], -1, k);

  // ------------------------------------------------ the body and tail: one contour, breast to tail tip to nape
  const root = B.p(-4.5, 0.2);
  const tA = P.tailA;
  const tEnd: V2 = [root[0] + Math.cos(tA) * P.tailL * k, Math.min(root[1] + Math.sin(tA) * P.tailL * k, air || P.flip ? 99 : -0.6)];
  const tdx = tEnd[0] - root[0], tdy = tEnd[1] - root[1], tl = Math.hypot(tdx, tdy) || 1;
  const tux = tdx / tl, tuy = tdy / tl;
  // the tail's belly side
  const bd = B.p(0, 1), b0 = B.p(0, 0);
  let tnx = -tuy, tny = tux;
  if (tnx * (bd[0] - b0[0]) + tny * (bd[1] - b0[1]) < 0) { tnx = -tnx; tny = -tny; }
  const T = (u: number, w: number, sh = 0): LM => [root[0] + tux * u + tnx * w * k, root[1] + tuy * u + tny * w * k, sh];
  const sp = (air ? 1.15 : 0.55);
  const bl = (x: number, y: number, sh = 0): LM => [...B.p(x, y * rf), sh] as LM;
  const body: LM[] = [
    bl(5.0, -1.0), bl(5.5, 0.9), bl(4.4, 2.9), bl(2.2, 3.9), bl(-0.5, 4.1), bl(-2.8, 3.3), bl(-4.3, 2.0),
    T(0.6, 1.4), T(tl * 0.7, 1.05 + sp * 0.4), T(tl - 0.4, 0.9 + sp * 0.5, 0.5), T(tl + 0.4, 0, 0.3), T(tl - 0.4, -0.9 - sp * 0.5, 0.5), T(tl * 0.6, -1.0 - sp * 0.3), T(0.4, -1.5),
    bl(-4.8, -1.6), bl(-3.2, -3.3), bl(-0.5, -3.9), bl(2.4, -3.6), bl(4.3, -2.5),
  ];
  const R = Relief.full(sk);
  const rumpShow = P.lift > 0.1 || flying;
  const BI = (x: number, y: number) => inv(B, x, y);
  R.region(spline(body, 0.4), {
    z: 0, R: 3 * k, H: 3.4 * k, id: 1, pow: 0.9,
    tex: (p, o) => {
      const su = (p.x - root[0]) * tux + (p.y - root[1]) * tuy;
      if (su > 0.6) {
        // the tail: olive, a black band near the end, a yellowish-olive tip; a dark seam down the middle
        const f = su / tl;
        const across = (p.x - root[0]) * tnx + (p.y - root[1]) * tny;
        o.m = f > 0.86 ? M.tailTip : f > 0.68 ? M.band : M.tail;
        if (Math.abs(across) < 0.35 && f < 0.68) o.t -= 0.1;
        return;
      }
      const [lx, ly] = BI(p.x, p.y);
      // the rump: orange-scarlet, showing when the wings come up
      if (rumpShow && lx < -2.4 && ly < -0.6 + (lx + 2.4) * -0.2) { o.m = M.scarlet; if (cell2(lx, ly, Math.PI, 2.2, 1.6, 5) === 2) o.t -= 0.12; return; }
      // breast and belly: a touch browner; every contour feather tipped black, so it all looks scaled
      const under = ly > 0.4 - lx * 0.35;
      const c = under ? cell2(lx, ly, Math.PI * 0.62, 2.6, 2, 11) : cell2(lx, ly, Math.PI * 0.95, 3, 2, 12);
      o.m = under ? M.breast : M.olive;
      if (c === 2) { o.m = M.tip; o.t -= 0.06; }
      else if (c === 1) o.t += 0.06;
    },
  });

  // ------------------------------------------------ the neck and head: one contour from the nape over the crown to the chin, into the body
  const nb = B.p(3.9, -1.5);
  const hc: V2 = [nb[0] + Math.cos(P.na) * P.nl * k, nb[1] + Math.sin(P.na) * P.nl * k];
  const H = P.flip ? new Frame2(hc, P.ha + Math.PI, k, -1) : new Frame2(hc, P.ha, k, 1);
  const hl = (x: number, y: number, sh = 0): LM => [...H.p(x, y), sh] as LM;
  {
    const ndx = hc[0] - nb[0], ndy = hc[1] - nb[1], nl2 = Math.hypot(ndx, ndy) || 1;
    let px = -ndy / nl2, py = ndx / nl2;
    const hd = H.p(0, 1), h0 = H.p(0, 0);
    if (px * (hd[0] - h0[0]) + py * (hd[1] - h0[1]) < 0) { px = -px; py = -py; }
    const nw = 2.5 * k * rf;
    const nbT = B.p(3.6, -0.6), nbN = B.p(3.0, -2.9);
    const head: LM[] = [
      hl(-0.7, -3.0), hl(1.1, -2.75), hl(2.05, -1.9, 0.3), hl(2.25, 0.3), hl(1.5, 2.0), hl(-0.2, 2.7),
      [nbT[0] + px * nw * 0.3, nbT[1] + py * nw * 0.3, 0], [nbN[0] - px * nw * 0.3, nbN[1] - py * nw * 0.3, 0],
      hl(-2.8, -0.6), hl(-2.5, -2.3),
    ];
    const HI = (x: number, y: number) => inv(H, x, y);
    R.region(spline(head, 0.4), {
      z: 1.2 * k, R: 2.2 * k, H: 2.8 * k, id: 2, blend: 1.4 * k,
      tex: (p, o) => {
        const [lx, ly] = HI(p.x, p.y);
        o.m = M.head;
        // the crown and nape finely scaled; the face plain, the lores a shade darker
        if (ly < -1.4 || lx < -1.3) { const c = cell2(lx, ly, Math.PI * 0.9, 2, 1.6, 21); if (c === 2) o.m = M.tip; else if (c === 1) o.t += 0.05; }
        else if (lx > 1.2 && ly < 1.2) o.t -= 0.1;
        else o.t += 0.06;
      },
    });
  }
  sk.np();
  R.emit({ drop: 1.4 * k, seam: 0.8, seamDark: 0.25, ao: 0.05, aoR: 2 });

  // ------------------------------------------------ the bill: a long, narrow hook far overhanging the short lower mandible
  {
    const gape = P.open * 0.55;
    const piv: V2 = [1.9, 0.9];
    const lowerL: [number, number, number][] = [[1.8, 0.7, 0], [3.0, 1.0, 0], [3.5, 1.6, 0.6], [2.5, 1.95, 0], [1.6, 1.7, 0]];
    const lw = lowerL.map(([x, y, s2]): LM => { const c = Math.cos(gape), s = Math.sin(gape), dx = x - piv[0], dy = y - piv[1]; return hl(piv[0] + dx * c - dy * s, piv[1] + dx * s + dy * c, s2); });
    const BR = new Relief(sk, hc[0] - 8 * k, hc[1] - 8 * k, hc[0] + 8 * k, hc[1] + 8 * k);
    if (P.open > 0.25) {
      const m: LM[] = [hl(1.9, 0.6), hl(3.6, 0.9), ...lw.slice(1, 3).reverse()];
      BR.region(spline(m, 0.3), { z: RY * k + 4.6, R: 0.5, H: 0.4, id: 3, tex: M.mouth });
    }
    BR.region(spline(lw, 0.3), { z: RY * k + 5, R: 0.7, H: 0.8, id: 4, tex: M.bill });
    const up: LM[] = [hl(1.6, -1.8), hl(3.4, -1.85 - gape * 0.3), hl(4.8, -1.15 - gape * 0.4), hl(5.5, 0.4 - gape * 0.5), hl(5.25, 2.2 - gape * 0.8), hl(4.45, 3.45 - gape * 1.0, 1),
      hl(4.25, 1.9 - gape * 0.7), hl(3.5, 0.75), hl(1.8, 0.45)];
    BR.region(spline(up, 0.3), { z: RY * k + 5.5, R: 0.9, H: 1.2, id: 5, tex: (p, o) => {
      o.m = M.bill;
      const [lx, ly] = inv(H, p.x, p.y);
      // the cere at the base, a dull grey band; a gleam along the culmen
      if (lx < 2.3) o.t -= 0.12;
      else if (ly < -1.2 && lx < 4.4) o.t += 0.1;
    } });
    sk.np();
    BR.emit({ drop: 1, seam: 0.5, seamDark: 0.3 });
    const ns = H.p(2.0, -1.1);
    sk.over(Math.floor(ns[0]), Math.floor(ns[1]), hex('#1c1a1e'));
  }

  // ------------------------------------------------ the folded wing: one contour from the bend to the primaries' tips over the tail
  if (P.wing === 'fold') {
    const W = B.sub(2.6, -1.9, -P.lift * (P.flip ? -1 : 1));
    const wz = RY * k + 1.2;
    // the orange underwing, peeping where the wing has come off the body
    if (P.lift > 0.1) {
      const UR = new Relief(sk, b[0] - 14, b[1] - 12, b[0] + 14, b[1] + 12);
      UR.region(spline([W.p(0, 1.2), W.p(-3, 2.6), W.p(-7, 3.0), W.p(-6.5, 1.6), W.p(-2, 0.6)].map(q => [...q, 0] as LM), 0.4), { z: wz - 0.6, R: 1, H: 1, id: 1, tex: M.orange });
      sk.np();
      UR.emit({ drop: 1 });
    }
    const wl = (x: number, y: number, sh = 0): LM => [...W.p(x, y), sh] as LM;
    const wing: LM[] = [wl(1.0, -0.2), wl(-0.6, -1.0), wl(-4.0, -0.7), wl(-7.6, 0.3), wl(-11.6, 2.0, 0.8), wl(-8.6, 2.9), wl(-5.0, 3.1), wl(-2.0, 2.6), wl(0.7, 1.4)];
    const WR = new Relief(sk, b[0] - 16, b[1] - 14, b[0] + 16, b[1] + 14);
    WR.region(spline(wing, 0.35), {
      z: wz, R: 1.2 * k, H: 1.4 * k, id: 1,
      tex: (p, o) => {
        const [lx, ly] = inv(W, p.x, p.y);
        if (lx < -7.0) {
          // primaries: dusky, stacked, a blue-green outer web along the top
          o.m = ly < 0.4 + (lx + 7) * -0.24 ? M.blue : M.prim;
          o.t -= 0.12;
          return;
        }
        if (lx < -3.2 || ly > 1.6) {
          // secondaries and tertials: stepped, each tipped black along the lower edge
          o.m = M.sec;
          const e = ((lx + 12) / 2) % 1;
          if (ly > 2.0 + (lx + 4) * -0.06 || (e < 0.22 && ly > 0.8)) o.m = M.tip;
          return;
        }
        // the coverts: rows of olive scales, a bronze gleam where the light catches them
        const c = cell2(lx, ly, Math.PI + 0.25, 2.5, 1.8, 31);
        o.m = c === 2 ? M.tip : c === 1 ? M.bronze : M.cov;
        o.t += 0.08;
      },
    });
    sk.np();
    WR.emit({ drop: 1.1, seam: 0.6, seamDark: 0.25 });
  }

  // ------------------------------------------------ the stolen pouch
  const pouch = (c: V2, rot: number) => {
    sk.np();
    sk.ell(c[0], c[1], 1.9 * k, 1.4 * k, M.pouch, { rot, z: RY * k + 7, rz: 1.2 });
    sk.np();
    const s0: V2 = [c[0] - 1.2 * k, c[1] + 0.6 * k];
    sk.tube([s0, [s0[0] - 1.2 * k, s0[1] + 1.4 * k], [s0[0] - 0.6 * k, s0[1] + 2.8 * k]], 0.42 * k, M.strap, { z: RY * k + 7.2 });
    sk.over(Math.floor(c[0]), Math.floor(c[1] - 0.6 * k), hex('#e6dcb2'));
  };
  if (P.item === 1) pouch(H.p(4.0, 2.9), H.a + 0.3);
  if (P.item === 2 && P.grab) pouch(B.p(P.grab[0] + 0.6, P.grab[1] - 1.6), B.a - 0.4);
  if (P.item === 3) pouch(B.p(1.4, f3(frame)), 0.5);
  if (P.item === 4) pouch([H.p(3.6, 2.6)[0] + 0.6 * k, -1.4 * k], 0.15);
  if (P.item === 5) pouch(H.p(1.6, -6.2), 1.2);

  // ------------------------------------------------ eye: dark, in a pale bare ring
  const est = P.eye ?? eyeSt;
  const ep = H.p(0.45 + P.cock * 0.2, -0.55 - P.cock * 0.15);
  const ex = Math.floor(ep[0]), ey = Math.floor(ep[1]);
  const o = (dx: number, dy: number, c: C) => sk.overPaint(ex + dx, ey + dy, c);
  if (est === 'closed') { o(-1, 0, K_RING); o(0, 0, hex('#262414')); o(1, 0, hex('#262414')); }
  else {
    // a beady dark eye: two pixels, the front one catching the light, in a thin pale ring behind and below
    o(-1, 0, K_RING); o(0, 1, K_RING);
    o(0, 0, K_EYE); o(1, 0, K_EYE);
    o(1, -1, est === 'alert' || est === 'scared' ? K_RING : est === 'angry' ? hex('#262414') : hex('#4a5028'));
    if (est !== 'angry') o(0, -1, est === 'alert' ? K_SHINE : hex('#3a4020'));
    sk.over(ex + 1, ey, est === 'angry' ? K_EYE : K_SHINE);
  }

  // ------------------------------------------------ near leg, near wing
  legs(true);
  if (flying) kspread(sk, M, b, (P.wing as [WingPose, WingPose])[0], 1, k);
  const top = H.p(0, -3.7);
  return { head: [top[0], top[1] - 1] as V2, eye: ep };
}

type KM = ReturnType<typeof kmats>;
const KEA_CW: CWingLook = { arm: 7.4, hand: 6.8, sec: 6.4, prim: 9.8, nS: 6, nP: 6, finger: 0.35, round: 0.55 };
/** a spread kea wing: scaled olive coverts and blue-green primaries above; orange-scarlet coverts below */
function kspread(sk: Sk, M: KM, b: V2, w: WingPose, side: 1 | -1, k: number) {
  const fill: WFill = (q, o) => {
    if (!q.top) {
      // the underwing glows: the lining orange-scarlet, the flight feathers dusky with orange-yellow bars
      o.t += 0.14;
      if (q.tract === 'L' || q.tract === 'M') o.m = M.scarlet;
      else if (q.tract === 'G') o.m = M.orange;
      else if (q.u > 0.84) o.m = M.underF;
      else if (q.tract === 'S') o.m = q.u < 0.62 ? M.orange : M.bar;
      else o.m = (q.u > 0.2 && q.u < 0.34) || (q.u > 0.48 && q.u < 0.62) ? M.bar : M.underF;
      if (q.seam) o.t -= 0.18;
      if (q.rowEdge) o.t -= 0.12;
      return;
    }
    if (q.tract === 'P') o.m = q.v < -0.25 && q.u < 0.82 ? M.blue : M.prim;
    else if (q.tract === 'S') o.m = q.u > 0.86 ? M.tip : M.sec;
    else o.m = q.rowEdge ? M.tip : q.tract === 'L' ? M.bronze : M.cov;
    if (q.seam) o.t -= 0.16;
  };
  cwing(sk, b, [2.0 * k, 1.4 * k, side * 1.8 * k], KEA_CW, w, side, k, fill, side > 0 ? 7 : -7, side < 0 ? -0.16 : -0.06);
}

export const KEA: SpeciesDef = {
  name: 'Kea', kind: 'bird', len: 21, height: 15,
  anims: KANIMS,
  canvas: (anim) => (KFLY.has(anim) || anim === 'flash' ? { w: 72, h: 62, ox: 36, oy: 40 } : { w: 46, h: 36, ox: 22, oy: 30 }),
  draw: kdraw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'idle' && f === 5 ? 'closed' : anim === 'alert' ? 'alert' : 'open'),
};

// ================================================================== the Ruru (morepork)
const RANIMS = {
  // in the hollow: head and shoulders over the lip (anchor = the lip)
  roost: { frames: 2, fps: 0.7, loop: true },
  peek: { frames: 2, fps: 1.2, loop: true },
  headturn: { frames: 8, fps: 4, loop: true },
  blink: { frames: 6, fps: 6, loop: true },
  call: { frames: 6, fps: 5, loop: true },
  snub: { frames: 4, fps: 5, loop: false },
  // out of it: the whole bird on its feet
  perch: { frames: 4, fps: 1.6, loop: true },
  idle: { frames: 4, fps: 1.6, loop: true },
  perchcall: { frames: 6, fps: 5, loop: true },
  fly: { frames: 6, fps: 8, loop: true },
  glide: { frames: 2, fps: 2, loop: true },
  pounce: { frames: 3, fps: 6, loop: false },
  sleep: { frames: 2, fps: 0.7, loop: true },
};
const RHOLLOW = new Set(['roost', 'peek', 'headturn', 'blink', 'call', 'snub']);
const RAIR = new Set(['fly', 'glide', 'pounce']);

type Yaw = 'F' | 'L3' | 'L' | 'K' | 'R3' | 'R';
type REye = 'open' | 'wide' | 'half' | 'slit' | 'closed';
interface RP {
  /** in the hollow: how far the bird sits below the lip (everything below y = 0 is clipped) */
  sink: number;
  b: V2; ba: number; ruffle: number;
  /** head centre relative to the body's neck point; which way the face looks; the head's roll */
  h: V2; yaw: Yaw; roll: number;
  eye: REye; gaze: number; brow: number;
  /** "more-pork": the throat puffed, the bill open */
  puff: number; open: number;
  wing: 'fold' | [WingPose, WingPose];
  feet: 'perch' | 'tuck' | 'reach';
  tailA: number;
}
function rbase(): RP {
  return { sink: 0, b: [-0.3, -3.8], ba: -0.12, ruffle: 0, h: [0.6, -4.4], yaw: 'F', roll: 0, eye: 'open', gaze: 1, brow: 0, puff: 0, open: 0, wing: 'fold', feet: 'perch', tailA: 1.95 };
}
function rflap(t: number): WingPose {
  const c = Math.cos(t * TAU);
  const up = t > 0.5;
  return { th: 0.18 + 0.8 * c, hand: -0.3 * Math.sin(t * TAU) + (up ? 0.25 : -0.05), fold: up ? 0.35 * Math.sin((t - 0.5) * TAU) : 0, sweep: 0.1 + (up ? -0.1 : 0.04), spread: 1.15 };
}
function rpose(anim: string, f: number, n: number): RP {
  const p = rbase();
  const t = f / n;
  const hollow = RHOLLOW.has(anim);
  // in the hollow: head and the tops of the shoulders over the lip
  if (hollow) p.sink = 2.3;
  switch (anim) {
    case 'roost': p.eye = 'slit'; p.ruffle = 0.4 + f * 0.15; p.sink += 0.7; p.h[1] += 0.3; break;
    case 'peek': p.eye = 'wide'; p.brow = 1; p.h[1] -= 0.4; p.roll = f ? 0.12 : 0; break;
    case 'headturn': {
      const Y: Yaw[] = ['F', 'L3', 'L', 'K', 'K', 'L', 'L3', 'R3'];
      p.yaw = Y[f]; p.gaze = p.yaw === 'L' || p.yaw === 'L3' ? -1 : 1;
      p.h[0] += p.yaw === 'K' ? -0.3 : 0;
      break;
    }
    case 'snub': p.yaw = (['L3', 'L', 'K', 'K'] as Yaw[])[f]; p.gaze = -1; p.eye = 'half'; break;
    case 'blink': p.eye = (['open', 'open', 'open', 'half', 'closed', 'half'] as REye[])[f]; break;
    case 'call': case 'perchcall': {
      // two beats: "more" (f1), "pork" (f3): the throat swells white, the bill parts, the head dips
      p.puff = [0, 1, 0.3, 1, 0.2, 0][f];
      p.open = [0, 1, 0, 0.8, 0, 0][f];
      p.h[1] += [0, 0.5, 0, 0.6, 0, 0][f];
      p.eye = f === 1 || f === 3 ? 'half' : 'open';
      if (anim === 'perchcall') p.sink = 0;
      break;
    }
    case 'perch': case 'idle':
      p.roll = [0, 0, 0.18, 0][f];
      p.eye = f === 1 ? 'half' : 'open';
      p.h[1] += f === 2 ? 0.3 : 0;
      break;
    case 'sleep': p.eye = 'closed'; p.ruffle = 0.8 + f * 0.15; p.h[1] += 0.8; break;
    case 'fly': case 'glide': {
      p.b = [0, -4.6]; p.ba = 1.25; p.h = [3.3, -1.3]; p.yaw = 'R3'; p.feet = 'tuck'; p.tailA = 1.75;
      p.wing = anim === 'fly' ? [rflap(t), rflap(t)] : [{ th: 0.32 + f * 0.04, hand: -0.08, fold: 0.04, sweep: 0.06, spread: 1.2 }, { th: -0.18 + f * 0.04, hand: 0.06, fold: 0.04, sweep: 0.06, spread: 1.2 }];
      if (anim === 'fly') p.b[1] += Math.sin(t * TAU) * 0.7;
      break;
    }
    case 'pounce': {
      // dropping onto prey: wings thrown up to brake, the feet swung forward, talons spread
      p.b = [-1.6, -6.0 + f * 0.3]; p.ba = [0.35, 0.15, -0.05][f]; p.h = [1.5, -3.6]; p.yaw = 'R3'; p.gaze = 1; p.eye = 'wide';
      p.feet = 'reach'; p.tailA = 2.3;
      const w: WingPose = { th: [1.15, 1.0, 0.55][f], hand: [0.35, 0.2, -0.3][f], fold: [0.05, 0.1, 0.35][f], sweep: -0.35, spread: 1.3 };
      p.wing = [w, { ...w, th: w.th - 0.06 }];
      break;
    }
  }
  return p;
}

function rmats(sk: Sk) {
  return {
    brown: sk.m(rmp('#53321d', { n: 6, dark: 0.55, light: 0.2, warm: 0.35, cool: 0 }), { edge: 1 }),
    breast: sk.m(rmp('#6c4628', { n: 6, dark: 0.55, light: 0.24, warm: 0.4, cool: 0 }), { edge: 1 }),
    back: sk.m(rmp('#422616', { n: 6, dark: 0.55, light: 0.2, warm: 0.3, cool: 0 }), { edge: 1 }),
    disc: sk.m(rmp('#3c2618', { n: 5, dark: 0.5, light: 0.2, cool: 0 }), { edge: 1 }),
    buff: sk.m(rmp('#c49c68', { n: 5, dark: 0.45, light: 0.25, warm: 0.35, cool: 0 }), { edge: 0 }),
    white: sk.m(rmp('#e4d8bc', { n: 4, dark: 0.3, light: 0.3, cool: 0 }), { edge: 0 }),
    wing: sk.m(rmp('#3e2414', { n: 6, dark: 0.55, light: 0.22, warm: 0.3, cool: 0 }), { edge: 2 }),
    bar: sk.m(rmp('#a07a50', { n: 5, dark: 0.45, light: 0.22, warm: 0.3, cool: 0 }), { edge: 0 }),
    under: sk.m(rmp('#94785a', { n: 5, dark: 0.45, light: 0.2, cool: 0, sat: 0 }), { edge: 1 }),
    tail: sk.m(rmp('#46291a', { n: 5, dark: 0.55, light: 0.2, cool: 0 }), { edge: 2 }),
    leg: sk.m(rmp('#bf9c6c', { n: 5, dark: 0.5, light: 0.3, cool: 0 }), { edge: 1 }),
    foot: sk.m(rmp('#e2b232', { n: 5, dark: 0.5, light: 0.35, warm: 0.5, cool: 0 }), { edge: 1 }),
    claw: sk.m(rmp('#2a2220', { n: 3, dark: 0.4, cool: 0 }), { edge: 0 }),
    bill: sk.m(rmp('#3a3434', { n: 4, dark: 0.5, light: 0.35, cool: 0 }), { edge: 1, spec: 0.3 }),
  };
}
const R_COL = {
  eye: hex('#f4c628'), eyeHi: hex('#fde98e'), eyeLo: hex('#c8901a'), pupil: hex('#120a06'),
  brow: hex('#e2d6ba'), browLo: hex('#c4ac84'), disc: hex('#3a2416'), discLo: hex('#2a180e'), bristle: hex('#94785a'),
  lid: hex('#5a3c26'), lash: hex('#22140c'), bill: hex('#3c3634'), billHi: hex('#7c746a'), mouth: hex('#4a1e1a'),
  spot: hex('#d8caa8'), throat: hex('#e2d6bc'), ruff: hex('#a2724a'),
};

/**
 * The face, pixel by pixel, for each way the head can look. Rows top to bottom from the head centre
 * row - 2; columns from the head centre column - 3. Keys: . leave the head as painted, D disc,
 * d disc shadow, W pale brow, w brow shadow, E an eye cell (painted by its state), B bill, b bill
 * highlight, r bristles beside the bill, s pale spot (crown and nape), f the pale rufous ruff framing the disc.
 */
const mirrorFace = (m: string[]) => m.map(r => r.split('').reverse().join(''));
const FACE_L3 = [
  '....s..',
  'ww.ww..',
  'EWEEDf.',
  'EBEEdf.',
  'rbrff..',
];
const FACE_L = [
  '.....s.',
  '.ww....',
  'dEED...',
  'dEED.s.',
  '.dd....',
];
const FACES: Record<Yaw, string[]> = {
  F: [
    '..s..s.',
    '.ww.ww.',
    'fEEWEEf',
    'fEEBEEf',
    '.frbrf.',
  ],
  L3: FACE_L3,
  L: FACE_L,
  K: [
    '.s..s..',
    '...s..s',
    '.s...s.',
    '...s...',
    '.......',
  ],
  R3: mirrorFace(FACE_L3),
  R: mirrorFace(FACE_L),
};

function rdraw(sk: Sk, anim: string, frame: number, eyeSt: BeastEye, juv: boolean) {
  const n = RANIMS[anim as keyof typeof RANIMS]?.frames ?? 1;
  const P = rpose(anim, frame, n);
  if (eyeSt === 'closed' && P.eye !== 'slit') P.eye = 'closed';
  if ((eyeSt === 'alert' || eyeSt === 'scared') && P.eye === 'open') P.eye = 'wide';
  const k = juv ? 0.8 : 1;
  const M = rmats(sk);
  const air = P.feet !== 'perch';
  if (P.sink > 0) sk.clipY = 0;
  const b: V2 = [P.b[0] * k, (P.b[1] + P.sink) * k];
  const B = new Frame2(b, P.ba, k, 1);
  const rx = 3.1 * (1 + P.ruffle * 0.08), ry = 3.6 * (1 + P.ruffle * 0.05);

  // ------------------------------------------------ feet: feathered legs, yellow toes over the branch / tucked / thrown forward
  const legs = (near: boolean) => {
    sk.np();
    const z = near ? 5 : -5, bias = near ? 0 : -0.16;
    const hip = B.p(near ? 0.6 : -0.6, ry * 0.75);
    let foot: V2;
    if (P.feet === 'perch') foot = [(near ? 0.7 : -0.7) * k, P.sink * k];
    else if (P.feet === 'tuck') foot = B.p(-1.0 + (near ? 0.3 : -0.3), ry + 1.2);
    else foot = B.p(rx + 1.0 + (near ? 0.4 : -0.6), ry + 1.0);
    sk.tube([hip, foot], t => (1.3 - t * 0.5) * k, M.leg, { z, bias });
    if (P.feet === 'tuck') return;
    // toes: two forward, one back (over the branch); spread wide and hooked when striking
    const spread = P.feet === 'reach';
    const T: [number, number][] = spread ? [[0.2, 1.8], [0.9, 1.6], [2.4, 1.4]] : [[0.05, 1.9], [0.45, 1.4], [Math.PI - 0.1, 1.2]];
    for (const [a, L] of T) {
      const aa = B.ang(0) * (spread ? 1 : 0) + a;
      const tip: V2 = [foot[0] + Math.cos(aa) * L * k, foot[1] + Math.sin(aa) * L * k * (spread ? 1 : 0.4)];
      sk.tube([foot, tip], 0.55 * k, M.foot, { z: z + 0.5, bias });
      sk.dot(tip[0] + Math.cos(aa + 0.9) * 0.7, tip[1] + Math.sin(aa + 0.9) * 0.7, M.claw, 0.3, z + 0.7);
    }
  };
  legs(false);
  if (P.wing !== 'fold') rspread(sk, M, b, P.wing[1], -1, k);

  // ------------------------------------------------ body and tail: one contour, broad shoulders, the round breast, the short barred tail
  const tr = B.p(-rx * 0.62, ry * 0.5);
  const tA = B.ang(P.tailA);
  const tl = (air ? 5.2 : 5.6) * k;
  const tux = Math.cos(tA), tuy = Math.sin(tA);
  // the tail's belly side
  const bdn = B.p(0, 1), bo = B.p(0, 0);
  let tnx = -tuy, tny = tux;
  if (tnx * (bdn[0] - bo[0]) + tny * (bdn[1] - bo[1]) < 0) { tnx = -tnx; tny = -tny; }
  const T = (u: number, w: number, sh = 0): LM => [tr[0] + tux * u + tnx * w * k, tr[1] + tuy * u + tny * w * k, sh];
  const bl = (x: number, y: number, sh = 0): LM => [...B.p(x * rx / 3.1, y * ry / 3.6), sh] as LM;
  const body: LM[] = [
    bl(1.4, -3.4), bl(2.9, -2.1), bl(3.45, 0), bl(3.0, 2.0), bl(1.9, 3.5), bl(0.3, 4.05), bl(-1.2, 3.7),
    T(0.8, 1.3), T(tl * 0.75, 1.3), T(tl, 0.6, 0.5), T(tl + 0.2, -0.3, 0.4), T(tl * 0.8, -1.3), T(0.2, -1.6),
    bl(-3.2, 0.9), bl(-3.3, -1.1), bl(-2.6, -3.0), bl(-0.8, -3.9), bl(0.6, -3.95),
  ];
  const R = Relief.full(sk);
  const BI = (x: number, y: number) => inv(B, x, y);
  const hc0: V2 = [b[0] + P.h[0] * k, b[1] + P.h[1] * k];
  R.region(spline(body, 0.35), {
    z: 0, R: 2.6 * k, H: 3.2 * k, id: 1, pow: 0.85,
    tex: (p, o) => {
      const su = (p.x - tr[0]) * tux + (p.y - tr[1]) * tuy;
      if (su > 1.0) {
        // the tail: brown, three narrow pale bars
        const f = su / tl;
        o.m = fr(f * 3.4 + 0.15) < 0.26 && f > 0.2 ? M.bar : M.tail;
        return;
      }
      const [lx, ly] = BI(p.x, p.y);
      if (lx > -0.5 + ly * 0.1) {
        // the breast: warm brown, streaked and blotched: white teardrops up top, buff lower down
        o.m = M.breast;
        // the shadow the big head casts across the top of the breast
        const hy = (p.x - hc0[0]) * 0, under = p.y - (hc0[1] + 2.6 * k) - hy;
        if (under > -0.6 && under < 1.2 && Math.abs(p.x - hc0[0]) < 3 * k) { o.t -= 0.2; return; }
        const row = Math.floor((ly + 4) / 2.1), col = Math.floor((lx + (row & 1) * 1.0) / 2.0);
        const fy = (ly + 4) / 2.1 - row, fx = (lx + (row & 1) * 1.0) / 2.0 - col;
        // each breast feather: a pale shaft streak widening to a teardrop at its tip, a dark edge below
        if (hh(row, col, 77) > 0.18 && Math.abs(fx - 0.5) < 0.22 + fy * 0.12 && fy > 0.2 && fy < 0.82) {
          o.m = ly < -1.4 ? M.white : M.buff;
          o.t += 0.04;
        } else if (fy > 0.86) o.t -= 0.1;
        return;
      }
      // the back: darker, unmarked but for the feather edges
      o.m = M.back;
      if (cell2(lx, ly, Math.PI * 0.6, 2.4, 1.8, 82) === 2) o.t -= 0.1;
    },
  });
  sk.np();
  R.emit({ drop: 1.2 * k, seam: 0.7, seamDark: 0.25, ao: 0.05, aoR: 2 });

  // ------------------------------------------------ folded wing: one contour, chocolate, white scapular spots, the flight feathers barred
  if (P.wing === 'fold') {
    const W = B.sub(-0.5, -ry * 0.72, 0);
    const wl = (x: number, y: number, sh = 0): LM => [...W.p(x, y), sh] as LM;
    const wing: LM[] = [wl(0.7, -0.3), wl(1.3, 1.6), wl(0.9, 4.0), wl(-1.1, 6.5, 0.8), wl(-2.3, 4.4), wl(-2.0, 1.2), wl(-0.8, -0.5)];
    const WR = new Relief(sk, b[0] - 10, b[1] - 10, b[0] + 10, b[1] + 10);
    WR.region(spline(wing, 0.3), {
      z: ry * k + 0.8, R: 1 * k, H: 1.3 * k, id: 1,
      tex: (p, o) => {
        const [lx, ly] = inv(W, p.x, p.y);
        o.m = M.wing;
        // the flight feathers' ends: narrow pale bars
        if (ly > 3.6 && fr(ly * 0.62) < 0.26) o.m = M.bar;
        // white spots down the scapulars at the front edge, buff ones on the coverts
        const spots: V2[] = [[0.8, 0.5], [0.7, 2.3], [-0.6, 1.5], [-1.1, 3.0]];
        spots.forEach(([sx, sy], q) => { if (Math.hypot(lx - sx, ly - sy) < 0.62) o.m = q < 2 ? M.white : M.buff; });
      },
    });
    sk.np();
    WR.emit({ drop: 1, seam: 0.6, seamDark: 0.25 });
  }

  // ------------------------------------------------ head: broad and flat-crowned, set straight on the shoulders, the face turned to look
  const hc: V2 = [b[0] + P.h[0] * k, b[1] + P.h[1] * k];
  const hrx = 3.4 * (1 + P.ruffle * 0.04), hry = 2.9;
  {
    const c = Math.cos(P.roll), sn = Math.sin(P.roll);
    const hp = (x: number, y: number, sh = 0): LM => { const X = x * hrx / 3.4 * k, Y = y * hry / 2.9 * k; return [hc[0] + X * c - Y * sn, hc[1] + X * sn + Y * c, sh]; };
    const head: LM[] = [hp(-3.1, -1.5), hp(-2.3, -2.65), hp(-0.8, -3.15), hp(0.8, -3.15), hp(2.3, -2.65), hp(3.1, -1.5), hp(3.5, 0.1), hp(3.2, 1.5), hp(2.2, 2.6), hp(0, 3.15), hp(-2.2, 2.6), hp(-3.2, 1.5), hp(-3.5, 0.1)];
    const HR = new Relief(sk, hc[0] - 6, hc[1] - 6, hc[0] + 6, hc[1] + 7);
    const side = P.yaw === 'K' ? 0 : P.yaw === 'F' ? 0 : P.yaw.startsWith('L') ? -1 : 1;
    HR.region(spline(head, 0.3), {
      z: ry * k + 3, R: 2.4 * k, H: 2.8 * k, id: 1,
      tex: (p, o) => {
        const dx = p.x - hc[0], dy = p.y - hc[1];
        const lx = (dx * c + dy * sn) / k, ly = (-dx * sn + dy * c) / k;
        o.m = M.brown;
        // throat puffing white under the bill as it calls
        if (P.puff > 0.2 && ly > 1.6 && Math.abs(lx - side * 0.8) < 1.8 * P.puff) { o.m = M.white; return; }
        // the ruff: a thin pale rufous rim framing the face from cheek to cheek under the chin
        if (P.yaw !== 'K' && p.s < 1.05 && ly > -0.6 && lx * (side || 1) > (side ? -1.6 : -9)) { o.m = M.bar; o.t += 0.26; return; }
        // the facial disc a shade darker and flatter; tiny pale spots over the crown and nape
        const discX = lx - side * 1.0;
        if (P.yaw !== 'K' && Math.hypot(discX / 3.0, (ly - 0.4) / 2.3) < 1) { o.m = M.disc; o.z -= 0.4; }
        else if (ly < -1.4 || P.yaw === 'K') { if (hh(Math.floor(lx * 1.1 + 9), Math.floor(ly * 1.2 + 9), 83) > 0.8) o.m = M.white; }
      },
    });
    if (P.puff > 0.2) HR.region(spline([hp(-1.4 + side, 2.4), hp(1.4 + side, 2.4), hp(1.1 * P.puff + side, 3.5 + P.puff * 0.6), hp(-1.1 * P.puff + side, 3.5 + P.puff * 0.6)], 0.3), { z: ry * k + 4.5, R: 0.8, H: 1, id: 2, tex: M.white });
    sk.np(true);
    HR.emit({ drop: 1.1, seam: 0.6, seamDark: 0.2 });
  }
  // the bill in profile sticks out past the head
  if (P.yaw === 'R' || P.yaw === 'L') {
    sk.np();
    const d = P.yaw === 'R' ? 1 : -1;
    const bb: V2 = [hc[0] + d * (hrx - 0.6) * k, hc[1] + 0.2 * k];
    sk.tube([bb, [bb[0] + d * 1.1 * k, bb[1] + 0.4 * k], [bb[0] + d * 0.9 * k, bb[1] + 1.4 * k]], t => (0.55 - t * 0.2) * k, M.bill, { z: ry * k + 7 });
    if (P.open > 0.3) sk.tube([[bb[0], bb[1] + 1.2 * k], [bb[0] + d * 0.9 * k, bb[1] + 1.9 * k]], 0.5 * k, M.bill, { z: ry * k + 6.8 });
  }
  rface(sk, hc, P);

  // ------------------------------------------------ near leg, near wing
  legs(true);
  if (P.wing !== 'fold') rspread(sk, M, b, P.wing[0], 1, k);
  sk.clipY = Infinity;
  return { head: [hc[0], hc[1] - hry * k - 1] as V2, eye: [hc[0], hc[1]] as V2 };
}

/** paint the face map onto the head (only over head pixels) */
function rface(sk: Sk, hc: V2, P: RP) {
  const map = FACES[P.yaw];
  const x0 = Math.floor(hc[0]) - 3, y0 = Math.floor(hc[1]) - 2 - (P.brow > 0 ? 0 : 0);
  const C = R_COL;
  // eye cells: collect each eye's cells to paint them by state
  const eyes: { x: number; y: number }[][] = [];
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++) {
      const ch = map[r][c];
      const x = x0 + c, y = y0 + r;
      if (ch === '.') continue;
      if (ch === 'E') {
        let e = eyes.find(g => g.some(q => Math.abs(q.x - x) <= 1 && Math.abs(q.y - y) <= 1));
        if (!e) { e = []; eyes.push(e); }
        e.push({ x, y });
        continue;
      }
      let col: C | 0 = 0;
      if (ch === 'D') col = C.disc;
      else if (ch === 'd') col = C.discLo;
      else if (ch === 'W') col = C.brow;
      else if (ch === 'w') col = C.browLo;
      else if (ch === 'B') col = C.bill;
      else if (ch === 'b') col = C.billHi;
      else if (ch === 'r') col = C.bristle;
      else if (ch === 's') col = C.spot;
      else if (ch === 'f') col = C.ruff;
      // staring: the outer ends of the brows lift a pixel
      const outerBrow = ch === 'w' && (c === 0 || c === map[r].length - 1 || map[r][c - 1] === '.' || (c > 0 && map[r][c - 1] !== 'w' && map[r][c + 1] === 'w' && c < 3) || (map[r][c + 1] === '.' && c > 3));
      if (col && P.brow > 0 && outerBrow) { sk.overPaint(x, y - 1, C.brow); col = C.disc; }
      if (col) sk.overPaint(x, y, col);
    }
  if (P.open > 0.3 && (P.yaw === 'F' || P.yaw === 'R3' || P.yaw === 'L3')) {
    // the bill parted: a dark gape below it
    for (let r = 0; r < map.length; r++) for (let c = 0; c < map[r].length; c++) if (map[r][c] === 'B' && r === map.length - 2) sk.overPaint(x0 + c, y0 + r + 1, C.mouth);
  }
  for (const e of eyes) {
    const xs = e.map(q => q.x), ys = e.map(q => q.y);
    const ex0 = Math.min(...xs), ex1 = Math.max(...xs), ey0 = Math.min(...ys), ey1 = Math.max(...ys);
    for (const q of e) {
      const top = q.y === ey0, outer = P.gaze > 0 ? q.x === ex1 : q.x === ex0;
      let col: C;
      switch (P.eye) {
        case 'closed': col = top ? C.lid : C.lash; break;
        case 'slit': col = top ? C.lid : (outer ? C.eyeLo : C.lash); break;
        case 'half': col = top ? C.lid : outer ? C.pupil : C.eye; break;
        case 'wide': col = top ? (outer ? C.eye : C.eyeHi) : outer ? C.pupil : C.eye; break;
        default: col = top ? (outer ? C.eyeLo : C.eye) : outer ? C.pupil : C.eye;
      }
      void ex1; void ey1;
      sk.overPaint(q.x, q.y, col);
    }
  }
}

type RM = ReturnType<typeof rmats>;
const RURU_CW: CWingLook = { arm: 4.8, hand: 4.4, sec: 4.8, prim: 6.2, nS: 5, nP: 5, finger: 0.5, round: 0.9 };
/** broad, soft owl wings: brown barred buff above with white-spotted coverts; pale and barred below */
function rspread(sk: Sk, M: RM, b: V2, w: WingPose, side: 1 | -1, k: number) {
  const fill: WFill = (q, o) => {
    if (!q.top) {
      // below: pale buff-grey, the flight feathers crossed by dark bars, a dark patch at the wrist
      o.t += 0.1;
      if (q.tract === 'P' || q.tract === 'S') o.m = fr(q.u * 3.4 + q.i * 0.13) < 0.3 ? M.wing : M.under;
      else o.m = q.tract === 'L' && q.i >= 5 ? M.wing : M.under;
      if (q.seam) o.t -= 0.15;
      return;
    }
    if (q.tract === 'P' || q.tract === 'S') o.m = fr(q.u * 3.6 + q.i * 0.11) < 0.26 && q.u > 0.15 ? M.bar : M.wing;
    else o.m = hh(q.i + 30, q.tract.charCodeAt(0), 17) < 0.4 && q.u > 0 && Math.abs(q.v) < 0.5 ? M.white : M.back;
    if (q.seam || q.rowEdge) o.t -= 0.14;
  };
  cwing(sk, b, [0.6 * k, 1.6 * k, side * 1.6 * k], RURU_CW, w, side, k, fill, side > 0 ? 6 : -6, side < 0 ? -0.16 : -0.04);
}

export const RURU: SpeciesDef = {
  name: 'Ruru', kind: 'bird', len: 13, height: 14,
  anims: RANIMS,
  canvas: (anim) => (RAIR.has(anim) ? { w: 56, h: 50, ox: 28, oy: 32 } : { w: 30, h: 30, ox: 14, oy: 22 }),
  draw: rdraw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'roost' ? 'closed' : anim === 'peek' || anim === 'pounce' ? 'alert' : anim === 'blink' && f === 4 ? 'closed' : 'open'),
};
