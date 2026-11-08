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
// All anchors are at the feet (or the hollow's lip): the flight frames too, so a bird lands without a jump.

import { Sk, V2, Px, rmp, SpeciesDef, BeastEye, TAU, hh, ik2, cbez } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { spreadWing, WingPose, WingLook } from '../../beasts-bird';
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

/**
 * Scaled plumage: a jittered, staggered field of overlapping feathers whose tips point back and down.
 * Returns 2 on a dark tip crescent, 1 just inside it (the lit sheen of the feather), 0 elsewhere.
 */
function featherTip(lx: number, ly: number, cw: number, ch: number, seed: number, w = 0.24): number {
  const gy = Math.floor(ly / ch);
  let d1 = 1e9, d2 = 1e9, c1x = 0, c1y = 0;
  for (let j = -1; j <= 1; j++) {
    const ry = gy + j;
    const off = (ry & 1) * 0.5;
    const gx = Math.floor(lx / cw - off);
    for (let i = -1; i <= 1; i++) {
      const rx = gx + i;
      const cx = (rx + off + 0.5 + (hh(rx + 50, ry + 50, seed) - 0.5) * 0.4) * cw;
      const cy = (ry + 0.5 + (hh(rx + 50, ry + 50, seed + 1) - 0.5) * 0.3) * ch;
      const d = Math.hypot((lx - cx) / cw, (ly - cy) / ch);
      if (d < d1) { d2 = d1; d1 = d; c1x = cx; c1y = cy; } else if (d < d2) d2 = d;
    }
  }
  const tip = (lx - c1x) * -0.5 / cw + (ly - c1y) * 0.86 / ch;
  if (d2 - d1 < w && tip > 0.02) return 2;
  if (d2 - d1 < w * 2.4 && tip > 0.1) return 1;
  return 0;
}

/** scale rows (wing coverts): staggered rows of rounded feathers; 2 on the dark lower edge of a feather */
function scaleRow(lx: number, ly: number, cw: number, ch: number): number {
  const r = Math.floor(ly / ch);
  const fx = lx / cw + (r & 1) * 0.5;
  const c = Math.floor(fx);
  const u = fx - c - 0.5, v = ly / ch - r;
  return v > 0.58 + u * u * 1.2 ? 2 : 0;
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
    olive: sk.m(rmp('#526026', { n: 6, dark: 0.55, light: 0.18, warm: 0.35, cool: 0.12 }), { edge: 1 }),
    breast: sk.m(rmp('#5e5b2a', { n: 6, dark: 0.55, light: 0.18, warm: 0.3, cool: 0.08 }), { edge: 1 }),
    head: sk.m(rmp('#5a5f30', { n: 6, dark: 0.55, light: 0.2, warm: 0.3, cool: 0.1 }), { edge: 1 }),
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
    bill: sk.m(rmp('#2c2c32', { n: 5, dark: 0.5, light: 0.22, cool: 0.3 }), { edge: 1, spec: 0.4 }),
    leg: sk.m(rmp('#6a6e76', { n: 5, dark: 0.52, light: 0.3, cool: 0.3 }), { edge: 1 }),
    claw: sk.m(rmp('#26262a', { n: 3, dark: 0.4 }), { edge: 0 }),
    mouth: sk.m(rmp('#3a1c20', { n: 3, dark: 0.4 }), { edge: 0 }),
    pouch: sk.m(rmp('#b09a62', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    strap: sk.m(rmp('#b0402a', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 }),
  };
}

const KEA_WING: Omit<WingLook, 'fill'> = { arm: 7.4, hand: 6.8, sec: 6.2, prim: 9.6, nS: 6, nP: 6, finger: 0.3, pw: 1.25, sw: 1.35, round: 0.55 };
const K_EYE: C = hex('#120c08'), K_RING = hex('#8a8670'), K_SHINE = hex('#d8d2bc');

function kdraw(sk: Sk, anim: string, frame: number, eyeSt: BeastEye, juv: boolean) {
  const n = KANIMS[anim as keyof typeof KANIMS]?.frames ?? 1;
  const P = kpose(anim, frame, n);
  const k = juv ? 0.82 : 1;
  const M = kmats(sk);
  const b: V2 = [P.b[0] * k, P.b[1] * k];
  const B = P.flip ? new Frame2(b, P.ba + Math.PI, k, -1) : new Frame2(b, P.ba, k, 1);
  const RX = 5.8, RY = 3.9 * (1 + P.ruffle * 0.08);
  const air = P.feet === 'tuck';
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
    // feathered thigh, bare grey tarsus
    sk.tube([h, knee], t => (1.5 - t * 0.4) * k, M.olive, { z, bias });
    sk.tube([knee, end], 0.62 * k, M.leg, { z: z + 0.3, bias });
    // zygodactyl foot: two toes forward, two back (curled shut in flight and when gripping)
    const curl = air || (near && P.grab) ? 1 : 0;
    // on its back: the toes splay and grasp at the air
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
  const farFoot = legs(false);
  void farFoot;
  if (P.wing !== 'fold') kspread(sk, M, b, P.wing[1], -1, k);

  // ------------------------------------------------ tail: blunt, olive above with a dark band, yellowish below
  sk.np();
  const root = B.p(-4.6, 0.3);
  const tA = P.tailA;
  const tEnd: V2 = [root[0] + Math.cos(tA) * P.tailL * k, Math.min(root[1] + Math.sin(tA) * P.tailL * k, air || P.flip ? 99 : -0.6)];
  const tdx = tEnd[0] - root[0], tdy = tEnd[1] - root[1], tl = Math.hypot(tdx, tdy) || 1;
  for (let i = 0; i < 3; i++) {
    const side = (i - 1) * (air ? 1.15 : 0.55);
    const nx = -tdy / tl, ny = tdx / tl;
    const e: V2 = [tEnd[0] + nx * side * k + (i === 1 ? tdx / tl * 0.4 : 0), tEnd[1] + ny * side * k + (i === 1 ? tdy / tl * 0.4 : 0)];
    sk.np();
    sk.blade(root[0], root[1], e[0], e[1], s => Math.max(0.5, (1.05 + s * 0.35) * k * (s > 0.9 ? 1 - (s - 0.9) * 4 : 1)), (q: Px) => {
      if (q.t > 0.86) return M.tailTip;
      if (q.t > 0.7) return M.band;
      return M.tail;
    }, { z0: -1 + (i === 1 ? 0.6 : 0), z1: -1 + (i === 1 ? 0.6 : 0), curl: 0.3 });
  }

  // ------------------------------------------------ body
  sk.np();
  sk.ell(b[0], b[1], RX * k, RY * k, (p: Px) => {
    const [lx, ly] = inv(B, p.x, p.y);
    // the breast and belly: a touch browner, every feather tipped dark in fine rows
    if (ly > 0.5 - lx * 0.4) return scaleRow(lx + 9, ly + 9.4, 2.2, 1.7) === 2 && lx > -3 ? M.tip : M.breast;
    return scaleRow(lx + 9, ly + 9, 2.4, 1.8) === 2 && ly > -1 ? M.tip : M.olive;
  }, { rot: B.a, rz: RY * k * 0.95 });
  // the rump: orange-scarlet, only showing when the wings come up
  if (P.lift > 0.1 || P.wing !== 'fold') {
    sk.np();
    const r = B.p(-3.6, -1.9);
    sk.ell(r[0], r[1], 2.2 * k, 1.3 * k, M.scarlet, { rot: B.a, z: RY * k + 0.6, rz: 1.2 });
  }

  // ------------------------------------------------ folded wing: scaled coverts, dark-tipped secondaries, dusky primaries over the tail
  if (P.wing === 'fold') {
    const W = B.sub(2.6, -1.9, -P.lift * (P.flip ? -1 : 1));
    const wz = RY * k + 1.2;
    // the underwing, peeping orange where the wing has come off the body
    if (P.lift > 0.1) {
      sk.np();
      const u = W.p(-3.4, 1.8);
      sk.ell(u[0], u[1], 3.6 * k, 1.6 * k, M.orange, { rot: W.a, z: wz - 0.4, rz: 1 });
    }
    const taper = (w: number, from: number) => (s: number) => Math.max(0.5, w * k * (s < from ? 1 : 1 - (s - from) / (1 - from) * 0.65));
    // primaries: the long dusky tips crossing the tail, a blue-green sheen on their outer edges
    for (let i = 0; i < 2; i++) {
      sk.np();
      const a0 = W.p(-3.6, 1.0 + i * 0.7), e = W.p(-12.0 + i * 1.0, 2.2 + i * 0.7);
      sk.blade(a0[0], a0[1], e[0], e[1], taper(1.2, 0.55), (q: Px) => (q.v < -0.45 && q.t < 0.7 ? M.blue : M.prim), { z0: wz + i * 0.2, z1: wz + i * 0.2, curl: 0.25 });
    }
    // secondaries and tertials, stepped, each with a black tip
    for (let i = 0; i < 3; i++) {
      sk.np();
      const a0 = W.p(-1.6 + i * 0.5, 1.4 + i * 0.45), e = W.p(-7.6 + i * 0.9, 2.5 + i * 0.45);
      sk.blade(a0[0], a0[1], e[0], e[1], taper(1.35, 0.7), (q: Px) => (q.t > 0.84 || (q.v > 0.6 && q.t > 0.5) ? M.tip : M.sec), { z0: wz + 0.8 + i * 0.2, z1: wz + 0.8 + i * 0.2, curl: 0.3 });
    }
    // the coverts: rows of olive scales, a bronze gleam where the light catches them
    sk.np();
    const cv = W.p(-1.9, 0.9);
    sk.ell(cv[0], cv[1], 4.3 * k, 2.3 * k, (q: Px) => {
      const [lx, ly] = inv(W, q.x, q.y);
      if (scaleRow(lx + 9, ly + 1.2, 2.4, 1.55) === 2) return M.tip;
      return q.l > 0.86 ? M.bronze : M.cov;
    }, { rot: W.a + 0.06, z: wz + 1.6, rz: 1.6 });
  }

  // ------------------------------------------------ neck and head
  const nb = B.p(3.9, -1.5);
  const hc: V2 = [nb[0] + Math.cos(P.na) * P.nl * k, nb[1] + Math.sin(P.na) * P.nl * k];
  sk.np();
  sk.tube([nb, hc], t => (2.5 - t * 0.3) * k * (1 + P.ruffle * 0.1), (p: Px) => {
    const [lx, ly] = inv(B, p.x, p.y);
    return scaleRow(lx + 9, ly + 9, 2.0, 1.5) === 2 && ly > -2.6 ? M.tip : M.olive;
  }, { z: RY * k * 0.6 });
  const H = P.flip ? new Frame2(hc, P.ha + Math.PI, k, -1) : new Frame2(hc, P.ha, k, 1);
  sk.np();
  const hrx = 3.0, hry = 2.7;
  sk.ell(hc[0], hc[1], hrx * k, hry * k, (p: Px) => {
    const [lx, ly] = inv(H, p.x, p.y);
    // the nape is scaled like the back; the face is plain
    if (lx < -1.4 && ly > -1.2 && scaleRow(lx + 9, ly + 9, 1.8, 1.4) === 2) return M.tip;
    return M.head;
  }, { rot: H.a, rz: hry * k, z: RY * k + 2.5 });
  const headPart = sk.pid;
  void headPart;

  // ------------------------------------------------ the bill: a long narrow hook far overhanging the short lower mandible
  const gape = P.open * 0.55;
  sk.np();
  const lo = [H.p(1.7, 0.9), H.p(2.4, 1.3 + gape * 1.6), H.p(3.0, 1.5 + gape * 2.4)];
  sk.tube(lo, t => (0.62 - t * 0.25) * k, M.bill, { z: RY * k + 5, bias: -0.1 });
  if (P.open > 0.25) {
    sk.np();
    const m0 = H.p(1.8, 0.7), m1 = H.p(2.9, 0.9 + gape * 1.6);
    sk.tube([m0, m1], 0.55 * k, M.mouth, { z: RY * k + 5.2 });
  }
  sk.np();
  const up = cbez(H.p(1.7, -0.9), H.p(4.0, -1.4 - gape * 0.4), H.p(5.2, 0.4 - gape * 0.6), H.p(4.2, 2.6 - gape * 1.2), 10);
  sk.tube(up, t => Math.max(0.4, (0.98 - t * 0.7) * k), (q: Px) => (q.t < 0.18 ? M.bill : M.bill), { z: RY * k + 5.5 });
  // the nostril in the cere
  const ns = H.p(2.0, -0.8);
  sk.over(Math.floor(ns[0]), Math.floor(ns[1]), hex('#1c1a1e'));

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
  if (P.wing !== 'fold') kspread(sk, M, b, P.wing[0], 1, k);
  const top = H.p(0, -hry - 1);
  return { head: [top[0], top[1] - 1] as V2, eye: ep };
}

type KM = ReturnType<typeof kmats>;
/** a spread kea wing: scaled olive coverts and blue-green primaries above; orange-scarlet coverts below */
function kspread(sk: Sk, M: KM, b: V2, w: WingPose, side: 1 | -1, k: number) {
  const W: WingLook = {
    ...KEA_WING,
    fill: (p, row, i, under) => {
      if (under) {
        // the underwing glows: lift it out of the body's shadow
        p.l += 0.16;
        if (row === 'L' || row === 'M') return M.scarlet;
        if (row === 'G') return M.orange;
        // flight feathers from below: the secondaries washed orange, the primaries dusky with two
        // orange-yellow bars, every tip dark
        if (p.t > 0.8) return M.underF;
        if (row === 'S') return p.t < 0.62 ? M.orange : M.bar;
        if ((p.t > 0.16 && p.t < 0.32) || (p.t > 0.46 && p.t < 0.6)) return M.bar;
        return M.underF;
      }
      if (row === 'P') return p.v < -0.3 && p.t < 0.8 ? M.blue : M.prim;
      if (row === 'S') return p.t > 0.86 ? M.tip : M.sec;
      if (p.t > 0.78) return M.tip;
      return row === 'L' && p.l > 0.7 ? M.bronze : M.cov;
    },
  };
  spreadWing(sk, b, [2.0 * k, 1.4 * k, side * 1.8 * k], W, w, side, k, side < 0 ? -0.16 : -0.18);
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
    back: sk.m(rmp('#422616', { n: 6, dark: 0.55, light: 0.2, warm: 0.3, cool: 0 }), { edge: 1 }),
    disc: sk.m(rmp('#3c2618', { n: 5, dark: 0.5, light: 0.2, cool: 0 }), { edge: 1 }),
    buff: sk.m(rmp('#c49c68', { n: 5, dark: 0.45, light: 0.25, warm: 0.35, cool: 0 }), { edge: 0 }),
    white: sk.m(rmp('#e4d8bc', { n: 4, dark: 0.3, light: 0.3, cool: 0 }), { edge: 0 }),
    wing: sk.m(rmp('#4a2b1a', { n: 6, dark: 0.55, light: 0.2, warm: 0.3, cool: 0 }), { edge: 2 }),
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
  spot: hex('#d8caa8'), throat: hex('#e2d6bc'),
};

/**
 * The face, pixel by pixel, for each way the head can look. Rows top to bottom from the head centre
 * row - 2; columns from the head centre column - 3. Keys: . leave the head as painted, D disc,
 * d disc shadow, W pale brow, w brow shadow, E an eye cell (painted by its state), B bill, b bill
 * highlight, r bristles beside the bill, s pale spot (crown and nape).
 */
const mirrorFace = (m: string[]) => m.map(r => r.split('').reverse().join(''));
const FACE_L3 = [
  '....s..',
  'ww.ww..',
  'EWEED..',
  'EBEEd..',
  'rbrd...',
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
    'DEEWEED',
    'DEEBEED',
    '.drbrd.',
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

  // ------------------------------------------------ tail: brown, crossed by narrow pale bars
  sk.np();
  const tr = B.p(-rx * 0.55, ry * 0.55);
  const tA = B.ang(P.tailA);
  const tl = (air ? 5.2 : 5.6) * k;
  const te: V2 = [tr[0] + Math.cos(tA) * tl, tr[1] + Math.sin(tA) * tl];
  sk.blade(tr[0], tr[1], te[0], te[1], s => Math.max(0.6, (1.2 + s * 0.4) * k * (s > 0.88 ? 1 - (s - 0.88) * 3 : 1)), (q: Px) => (fr(q.t * 3.2 + 0.1) < 0.24 && q.t > 0.25 ? M.bar : M.tail), { z0: -1.5, z1: -1.5, curl: 0.3 });

  // ------------------------------------------------ body: a chocolate back, the breast streaked buff and white
  sk.np();
  const bodyFill = (p: Px) => {
    const [lx, ly] = inv(B, p.x, p.y);
    return lx > -0.4 + ly * 0.12 ? M.brown : M.back;
  };
  // an owl's shape: broad shoulders as wide as the head, tapering to the belly
  sk.ell(b[0], b[1], rx * k, ry * k, bodyFill, { rot: B.a, rz: ry * k * 0.9 });
  const ch = B.p(0.2, -ry * 0.42);
  sk.ell(ch[0], ch[1], (rx + 0.55) * k, ry * 0.66 * k, bodyFill, { rot: B.a, rz: ry * k * 0.85 });
  const bodyPart = sk.pid;
  // the breast: short pale streaks in staggered rows (white up top, buff lower down), painted pixel by pixel
  for (let r = 0; r < 4; r++) {
    const ly = -2.0 + r * 1.6;
    for (let c = 0; c < 2; c++) {
      const lx = (r & 1 ? 0.4 : 1.3) + c * 1.9;
      if (hh(r, c, 77) < 0.2) continue;
      const q = B.p(lx, ly), q2 = B.p(lx, ly + 0.9);
      sk.paint(q[0], q[1], r < 1 ? M.white : M.buff, 0.05, bodyPart);
      if (r < 3 && hh(c, r, 78) > 0.45) sk.paint(q2[0], q2[1], M.buff, -0.05, bodyPart);
    }
  }

  // ------------------------------------------------ folded wing: dark brown, a line of white scapular spots, barred flight feathers
  if (P.wing === 'fold') {
    sk.np();
    const W = B.sub(-0.5, -ry * 0.72, 0);
    const a0 = W.p(0.3, 0), e0 = W.p(-1.7, ry * 1.8);
    sk.blade(a0[0], a0[1], e0[0], e0[1], s => Math.max(0.6, (s < 0.5 ? 1.7 + s * 0.8 : 2.1 - (s - 0.5) * 3.2) * k), (q: Px) => (q.t > 0.66 && fr(q.t * 4.6) < 0.22 ? M.bar : M.wing), { z0: ry * k + 1, z1: ry * k + 0.6, curl: 0.35, n: [-0.2, -0.3, 0.93] });
    const wp = sk.pid;
    // scapular spots down the front edge of the wing, and a few on the coverts
    for (const [x, y] of [[0.9, 1.0], [0.5, 2.9], [-1.0, 1.9]] as V2[]) {
      const q = W.p(x, y);
      sk.paint(q[0], q[1], M.white, 0.1, wp);
    }
  }

  // ------------------------------------------------ head: round, the face turned to look
  const nk = B.p(0.4, -ry * 0.85);
  const hc: V2 = [nk[0] + P.h[0] * k * 0 + (P.h[0] - 0.7) * k, b[1] + (P.h[1] - ry * 0.0) * k - ry * 0 * k];
  // (head centre: forward/up of the body centre; P.h is relative to the body centre)
  hc[0] = b[0] + P.h[0] * k; hc[1] = b[1] + P.h[1] * k;
  void nk;
  const hrx = 3.4 * (1 + P.ruffle * 0.04), hry = 2.9;
  // (soft: no dark collar line where the head sits into the shoulders)
  sk.np(true);
  sk.ell(hc[0], hc[1], hrx * k, hry * k, (q: Px) => {
    // throat puffing white under the bill as it calls
    if (P.puff > 0.2 && q.v > 0.45 && Math.abs(q.u) < 0.55 * P.puff) return M.white;
    return M.brown;
  }, { rot: P.roll, rz: hry * k, z: ry * k + 3 });
  if (P.puff > 0.2) {
    sk.np();
    sk.ell(hc[0] + 0.3, hc[1] + hry * k * 0.95, 1.4 * P.puff * k + 0.4, 1.0 * P.puff * k + 0.3, M.white, { z: ry * k + 4.5, rz: 1 });
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
const RURU_WING: Omit<WingLook, 'fill'> = { arm: 4.8, hand: 4.4, sec: 4.6, prim: 6.0, nS: 5, nP: 5, finger: 0.45, pw: 1.2, sw: 1.35, round: 0.9 };
/** broad, soft owl wings: brown barred buff above with white-spotted coverts; pale and barred below */
function rspread(sk: Sk, M: RM, b: V2, w: WingPose, side: 1 | -1, k: number) {
  const W: WingLook = {
    ...RURU_WING,
    fill: (p, row, i, under) => {
      if (under) {
        if (row === 'P' || row === 'S') return fr(p.t * 3.4 + i * 0.13) < 0.3 ? M.wing : M.under;
        return M.under;
      }
      if (row === 'P' || row === 'S') return fr(p.t * 3.6 + i * 0.11) < 0.26 && p.t > 0.15 ? M.bar : M.wing;
      return hh(i + 30, row.charCodeAt(0), 17) < 0.35 && p.t > 0.5 ? M.white : M.back;
    },
  };
  spreadWing(sk, b, [0.6 * k, 1.6 * k, side * 1.6 * k], W, w, side, k, side < 0 ? -0.16 : -0.04);
}

export const RURU: SpeciesDef = {
  name: 'Ruru', kind: 'bird', len: 13, height: 14,
  anims: RANIMS,
  canvas: (anim) => (RAIR.has(anim) ? { w: 56, h: 50, ox: 28, oy: 32 } : { w: 30, h: 30, ox: 14, oy: 22 }),
  draw: rdraw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'roost' ? 'closed' : anim === 'peek' || anim === 'pounce' ? 'alert' : anim === 'blink' && f === 4 ? 'closed' : 'open'),
};
