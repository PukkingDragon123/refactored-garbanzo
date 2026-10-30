// V7 small acts: reactions, idle fidgets and the V12 moments with Mori's own things (his stomach
// growling, turning to show his gear when he's inspected, the note paper in and out of his pocket).
//
// Every one of these starts and ends on the character's own stance (the first frame of their idle,
// whoever they are: Jenna's clasped hands, Joshu's fists on his hips, an NPC's own way of standing)
// and lays the act over it as a blend in 3D (Pose.mix), so it eases in and out of whatever the arms
// were doing, and the Actor can drop it over the idle at any moment.
//
// Timing follows anticipation → action → recovery: a little move the other way first (a dip before
// a hop, a lean in before recoiling), a quick action, a hold, and a slower settle; the head leads,
// the hands follow a beat behind.

import type { Build, Pose, ArmP, P2 } from '../people-rig';
import { ANIMS7, POSES7, at7, wHead, wHang, bump, smooth, K, breath } from './anims7';
import { YAW } from './body';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpP = (p: P2, q: P2, u: number): P2 => [mix(p[0], q[0], u), mix(p[1], q[1], u)];
/** 0 → 1 over [a, a + w] */
const up = (t: number, a: number, w: number) => smooth((t - a) / w);

/** the character's own stance: every act starts and ends on it */
const rest = (b: Build, id: string) => at7(id, 'idle', b, 0);
/** the act over the stance, u of the way in (a 3D blend) */
const over = (r: Pose, g: Pose, u: number): Pose => (u <= 0.002 ? r : { ...r, mix: { a: r, p: g, u: Math.min(1, u) } });
/** the stance with some things changed; hands the stance holds somewhere (IK) move with the hips */
function act(r: Pose, o: Partial<Pose>, f: Record<string, number> = {}): Pose {
  const g: Pose = { ...r, ...o, flags: { ...(r.flags ?? {}), ...f } };
  const dx = g.hip[0] - r.hip[0], dy = g.hip[1] - r.hip[1];
  if (dx || dy) {
    if (!o.fa && r.fa.ik) g.fa = { ...r.fa, ik: [r.fa.ik[0] + dx, r.fa.ik[1] + dy] };
    if (!o.ba && r.ba.ik) g.ba = { ...r.ba, ik: [r.ba.ik[0] + dx, r.ba.ik[1] + dy] };
  }
  return g;
}
/** a hand to a world-space spot near the body (px from the yawed neck top), shaped */
const hand = (b: Build, p: Pose, dx: number, dy: number, h: ArmP['hand'], o: Partial<ArmP> = {}): ArmP => ({ ik: wHead(b, p, dx, dy), hand: h, ...o });

// ------------------------------------------------------------------ reactions

/**
 * A happy hop (react 'jump'; the Actor's hop physics lifts the sprite after the dip): a quick crouch
 * with the arms swung back, then up with the fists punched up and the legs tucking, a squash as he
 * lands and a settle. 0.7 s; the Actor waits out the dip (0.09 s) before the hop.
 */
function reactHop(b: Build, t: number, id: string, big = true): Pose {
  const k = K(b), r = rest(b, id);
  const A = big ? 1 : 0.55;
  const dip = bump(t, 0, big ? 0.17 : 0.14, 0.07), air = bump(t, big ? 0.12 : 0.1, big ? 0.8 : 0.6, 0.1), land = bump(t, big ? 0.76 : 0.56, big ? 0.97 : 0.86, 0.07);
  const g = act(r, {
    hip: [r.hip[0] + 0.4 * k * dip, r.hip[1] - (dip * 1.8 + land * 1.5) * k * A],
    lean: r.lean + 0.14 * dip - 0.05 * air + 0.1 * land,
    sq: 1 - (dip + land) * 0.05 * A + air * 0.03,
    hd: [0.3 * k * dip - 0.2 * k * air, -0.4 * k * dip + 0.3 * k * air],
    // the legs tuck up a little under him in the air
    fl: { f: [r.fl.f[0] + 0.6 * k * air, r.fl.f[1] + air * 1.5 * k * A], fa: -0.4 * air },
    bl: { f: [r.bl.f[0] - 0.4 * k * air, r.bl.f[1] + air * 2 * k * A], fa: -0.5 * air },
    sway: 0.4 + 0.8 * air,
  }, { hair: air > 0.4 ? 1 : 0, aoN: 0.8 * air, aoF: 0.8 * air });
  // arms swing from the shoulder (an arc, not a slide): back for the dip, up through the hop (fists
  // punched up for a big one, to the chest for a bounce), down and out for the landing
  const sw = up(t, big ? 0.13 : 0.1, big ? 0.16 : 0.12) * (1 - up(t, big ? 0.66 : 0.5, 0.16));
  const top = big ? 2.75 : 1.2, el = big ? 0.35 : 1.5;
  g.fa = { a: mix(-0.55 * dip + 0.4 * land, top, sw), e: mix(0.3, el, sw), hand: sw > 0.5 ? 'fist' : 'open', palm: 'fwd', flex: -0.3 * dip };
  g.ba = { a: mix(-0.45 * dip + 0.3 * land, top - 0.25, sw), e: mix(0.3, el + 0.1, sw), hand: sw > 0.5 ? 'fist' : 'open', palm: 'fwd' };
  if (sw > 0.3) g.front = ['armF'];
  return over(r, g, up(t, 0, 0.06) * (1 - up(t, 0.86, 0.14)));
}

/** recoiling (react 'recoil'): a tiny lean in, then a jolt back with the hands up to guard, a beat
 *  held, a slower recovery */
function reactRecoil(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const ant = bump(t, 0, 0.14, 0.06), jolt = up(t, 0.1, 0.1) * (1 - up(t, 0.5, 0.45));
  const g = act(r, {
    hip: [r.hip[0] - 1.3 * k * jolt + 0.3 * k * ant, r.hip[1] - 0.7 * k * jolt],
    lean: r.lean + 0.06 * ant - 0.2 * jolt,
    hd: [-0.6 * k * jolt + 0.2 * k * ant, -0.35 * k * jolt],
    sway: 0.4 + 0.6 * jolt,
  }, { wN: 1, wF: 1, zN: 2.8 * k, zF: -1.8 * k });
  g.fa = hand(b, g, 5.6, -9.4, 'open', { palm: 'fwd', flex: -0.5, spread: 1.3 });
  g.ba = hand(b, g, 4.2, -10.6, 'claw', { palm: 'fwd', flex: -0.4 });
  g.front = ['armF'];
  return over(r, g, up(t, 0.06, 0.1) * (1 - up(t, 0.6, 0.4)));
}

/** a nod (react 'nod'): the head dips, comes up, and dips again smaller */
function reactNod(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const n = bump(t, 0.04, 0.4, 0.14) + 0.55 * bump(t, 0.42, 0.78, 0.13);
  return act(r, { hd: [(r.hd?.[0] ?? 0) + 0.35 * k * n, (r.hd?.[1] ?? 0) - 0.95 * k * n], lean: r.lean + 0.03 * n, look: n > 0.5 ? 'down' : r.look });
}

/** cringing (react 'shrink'): the shoulders come up round the ears, the head sinks, the knees give and
 *  the fists pull in to the chest; it lets go slowly */
function reactCringe(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const c = up(t, 0, 0.14) * (1 - up(t, 0.55, 0.45));
  const g = act(r, { hip: [r.hip[0] - 0.4 * k, r.hip[1] - 0.9 * k], lean: r.lean + 0.1, hd: [0.1 * k, -1.2 * k], sq: 0.97, look: 'down' }, { wN: 1, wF: 1, zN: 2.4 * k, zF: -0.6 * k, roll: 0 });
  g.fa = hand(b, g, 3.8, -11.6, 'fist', { palm: 'in' });
  g.ba = hand(b, g, 3, -12.4, 'fist', { palm: 'in' });
  g.front = ['armF'];
  return over(r, g, c);
}

/** trembling (react 'tremble', looped while it lasts): hunched, hands up at the chin, shaking */
function reactTremble(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const sh = Math.sin(TAU * 3 * t), sh2 = Math.sin(TAU * 3 * t + 1.7);
  const g = act(r, { hip: [r.hip[0] - 0.6 * k + sh * 0.3 * k, r.hip[1] - 0.8 * k], lean: r.lean - 0.06, hd: [-0.2 * k + sh2 * 0.15 * k, -0.7 * k] }, { wN: 1, wF: 1, zN: 2.2 * k, zF: -1 * k });
  g.fa = hand(b, g, 4.4 + sh * 0.3, -7.2 + sh2 * 0.3, 'claw', { palm: 'fwd' });
  g.ba = hand(b, g, 3.4 - sh * 0.3, -8 - sh2 * 0.3, 'claw', { palm: 'fwd' });
  g.front = ['armF'];
  return over(r, g, 1);
}

// ------------------------------------------------------------------ idle fidgets

/** shifting the weight onto the other leg: the free knee softens, the heel comes up, a breath out */
function idleShift(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const w = bump(t, 0.04, 0.96, 0.3), sigh = bump(t, 0.35, 0.75, 0.15);
  return act(r, {
    hip: [r.hip[0] + 0.9 * k * w, r.hip[1] - 0.25 * k * w - 0.2 * k * sigh],
    lean: r.lean + 0.02 * w,
    hd: [(r.hd?.[0] ?? 0) + 0.15 * k * w, (r.hd?.[1] ?? 0) - 0.35 * k * sigh],
    fl: { f: [r.fl.f[0] + 0.5 * k * w, r.fl.f[1] + 0.7 * k * w], fa: (r.fl.fa ?? 0) - 0.4 * w },
    sq: (r.sq ?? 1) - 0.015 * sigh,
  }, { sx: (r.flags?.sx ?? 0) - 1.1 * k * w });
}

/** a glance back over the shoulder: the shoulders turn a little, the head looks round, and back */
function idleLook(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const w = bump(t, 0.08, 0.86, 0.18);
  const p = act(r, { hd: [(r.hd?.[0] ?? 0) - 0.3 * k * w, (r.hd?.[1] ?? 0) + 0.1 * k * w] }, { yaw: YAW + 0.3 * w, lyaw: YAW * 0.5 });
  if (w > 0.55) p.look = 'away';
  return p;
}

/** rubbing the back of the neck: the near hand up behind the head, small circles, the head tipped */
function fidgetNeck(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.05, 0.95, 0.22), rub = Math.sin(TAU * 3 * t), rub2 = Math.cos(TAU * 3 * t);
  const g = act(r, { hd: [(r.hd?.[0] ?? 0) + 0.35 * k, (r.hd?.[1] ?? 0) - 0.5 * k], lean: r.lean + 0.03, look: 'down' }, { wN: 1, zN: 2.4 * k });
  g.fa = hand(b, g, -2.6 + rub * 0.5, 1 + rub2 * 0.4, 'flat', { palm: 'in', flex: 0.2 });
  return over(r, g, e);
}

/** (Mori) a tug on the strap across his chest, settling it, a glance down at it */
function fidgetStrap(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.05, 0.92, 0.2), tug = bump(t, 0.36, 0.62, 0.08);
  const g = act(r, { lean: r.lean + 0.02, look: t > 0.2 && t < 0.62 ? 'down' : 'fwd', hd: [(r.hd?.[0] ?? 0) + 0.15 * k, (r.hd?.[1] ?? 0) - 0.25 * k * tug] }, { wN: 1, zN: 1.2 * k, roll: 0.05 * tug });
  g.fa = hand(b, g, 1.8, -7.2 - 1.6 * tug, 'pinch', { palm: 'in' });
  return over(r, g, e);
}

/** (Jenna) tucking her hair behind her ear: from the temple, back over the ear, a little head tilt */
function fidgetHair(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.04, 0.9, 0.22), sweep = up(t, 0.3, 0.3);
  const g = act(r, { hd: [(r.hd?.[0] ?? 0) - 0.25 * k * sweep, (r.hd?.[1] ?? 0) + 0.1 * k] }, { wN: 1, zN: 3.8 * k });
  g.fa = hand(b, g, mix(-0.8, -4.6, sweep), mix(8.2, 5.4, sweep), 'flat', { palm: 'in', flex: -0.2 });
  g.front = ['armF'];
  return over(r, g, e);
}

/** (Jenna) up on her toes and down, twice, hands still clasped */
function fidgetHeels(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.02, 0.98, 0.1), l = Math.pow(Math.abs(Math.sin(TAU * t)), 1.4) * e;
  return act(r, {
    hip: [r.hip[0] + 0.2 * k * l, r.hip[1] + 1 * k * l],
    fl: { f: [r.fl.f[0], r.fl.f[1] + 1 * k * l], fa: -0.55 * l },
    bl: { f: [r.bl.f[0], r.bl.f[1] + 1 * k * l], fa: -0.55 * l },
    hd: [(r.hd?.[0] ?? 0), (r.hd?.[1] ?? 0) + 0.1 * k * l],
  });
}

/** (Joshu) stroking his beard, chin up, considering */
function fidgetBeard(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.04, 0.94, 0.18), s = 0.5 - 0.5 * Math.cos(TAU * 2 * clamp01((t - 0.18) / 0.66));
  const g = act(r, { hd: [(r.hd?.[0] ?? 0) - 0.2 * k, (r.hd?.[1] ?? 0) + 0.25 * k], look: 'up' }, { wN: 1, zN: 1.2 * k });
  g.fa = hand(b, g, 2.6, mix(0.8, -4.6, s), s > 0.5 ? 'relax' : 'pinch', { palm: 'in' });
  g.front = ['armF'];
  return over(r, g, e);
}

/** (Joshu) two satisfied pats on the belly, chest out */
function fidgetBelly(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.04, 0.94, 0.16), pat = Math.max(0, Math.sin(TAU * 2 * clamp01((t - 0.2) / 0.6)));
  const g = act(r, { lean: r.lean - 0.05, hd: [(r.hd?.[0] ?? 0) - 0.15 * k, (r.hd?.[1] ?? 0) + 0.15 * k] }, { wN: 1, zN: 3.4 * k });
  g.fa = hand(b, g, 6.4 - 0.6 * pat, -15.4 + 0.9 * pat, 'flat', { palm: 'in' });
  return over(r, g, e);
}

/** (Aroha) loosening her neck and shoulders: the head tips one way and the other, a shoulder roll */
function fidgetShoulder(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const e = bump(t, 0.04, 0.96, 0.15), s = Math.sin(TAU * 2 * t) * e;
  return act(r, { hd: [(r.hd?.[0] ?? 0) + 0.45 * k * s, (r.hd?.[1] ?? 0) - 0.3 * k * Math.abs(s)], look: Math.abs(s) > 0.6 ? 'up' : r.look }, { roll: 0.07 * s });
}

// ------------------------------------------------------------------ V12: Mori's moments

/**
 * His stomach growls (V12 hunger): it lurches (a quick hunch in), both hands go to his belly and he
 * looks down at it, rubbing; then, embarrassed, a glance out at whoever heard (the viewer) with a hand
 * scratching the back of his head, and he lets it go.
 */
function growl(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const jolt = bump(t, 0, 0.18, 0.05), hold = up(t, 0.08, 0.1), sheep = up(t, 0.55, 0.1);
  const rub = Math.sin(TAU * 2.5 * t), rub2 = Math.cos(TAU * 2.5 * t);
  const g = act(r, {
    hip: [r.hip[0] - 0.3 * k * jolt, r.hip[1] - (0.6 * jolt + 0.3 * hold * (1 - sheep)) * k],
    lean: r.lean + 0.12 * jolt + 0.06 * hold * (1 - sheep) - 0.02 * sheep,
    hd: [0.3 * k * jolt - 0.25 * k * sheep, -0.5 * k * jolt - 0.3 * k * hold * (1 - sheep) - 0.25 * k * sheep],
    sq: 1 - 0.03 * jolt,
    look: sheep > 0.4 ? (t < 0.86 ? 'cam' : 'fwd') : hold > 0.3 ? 'down' : 'fwd',
  }, { wN: 1, wF: 1, zN: 3 * k, zF: mix(0.6, -2.2, sheep) * k, roll: 0.04 * sheep });
  // the near hand stays on his belly; the far one goes from his belly up behind his head (the elbow
  // up in front, the hand scratching out of sight behind it)
  g.fa = hand(b, g, 4.8 + rub * 0.4, -16 + rub2 * 0.4, 'flat', { palm: 'in' });
  const belly = hand(b, g, 3.6, -15.2 - rub * 0.3, 'flat', { palm: 'in' });
  const scratch = hand(b, g, -2.6 + Math.sin(TAU * 6 * t) * 0.4, 5.2, 'relax', { palm: 'in', flex: 0.3 });
  g.ba = { ...(sheep < 0.5 ? belly : scratch), ik: lerpP(belly.ik!, scratch.ik!, sheep) };
  g.front = ['armF'];
  return over(r, g, up(t, 0, 0.06) * (1 - up(t, 0.88, 0.12)));
}

/** the yaw he shows himself at when inspected: nearly square to the viewer, a hair toward his facing */
const INSPECT_YAW = 1.3;
/** standing for inspection: square to the viewer, feet apart, arms a little out from his sides so the
 *  camera on his chest, the pack straps and his pockets all show; `br` a breath (0..1) */
function inspectStance(b: Build, br = 0, sway = 0): Pose {
  const k = K(b);
  return {
    hip: [0.2 * k * sway, b.hipH - 0.4 - (1 - br) * 0.25],
    lean: 0.01 - br * 0.012,
    sq: 1 + br * 0.02,
    hd: [0, 0.15 * k * br],
    fa: { a: 0.04 + br * 0.03, e: 0.3, hand: 'relax', dev: -0.1 },
    ba: { a: 0.02 + br * 0.02, e: 0.28, hand: 'relax' },
    fl: { f: [0.2 * k, b.ankleH], fa: 0 },
    bl: { f: [0.6 * k, b.ankleH], fa: 0 },
    sway: 0.2,
    look: 'cam',
    flags: { yaw: INSPECT_YAW, lyaw: INSPECT_YAW * 0.85, aoN: 1.5, aoF: 1.5, sx: 0.3 * k * sway },
  };
}
/**
 * Turning to present himself (u 0 → 1, inspectFace; inspectBack plays it the other way): a small
 * counter-move first, then the body swings round square to the viewer a beat behind the head, the
 * feet stepping round under him, a little overshoot and settle; the arms open out from his sides.
 */
function inspectTurn(b: Build, u: number, id: string, back = false): Pose {
  const k = K(b), r = rest(b, id), s = inspectStance(b);
  const turnU = back ? smooth(u) : clamp01(-0.06 * Math.sin(Math.PI * clamp01(u / 0.2)) + up(u, 0.12, 0.6) + 0.07 * bump(u, 0.6, 1, 0.2));
  const yaw = YAW + (INSPECT_YAW - YAW) * turnU;
  // the feet: the far one steps across, then the near one squares up
  const sF = Math.sin(Math.PI * clamp01((u - 0.15) / 0.35)), sN = Math.sin(Math.PI * clamp01((u - 0.45) / 0.35));
  const fl = { f: lerpP(r.fl.f, s.fl.f, up(u, 0.45, 0.35)), fa: 0 } as Pose['fl'];
  fl.f = [fl.f[0], fl.f[1] + 1 * k * sN];
  const bl = { f: lerpP(r.bl.f, s.bl.f, up(u, 0.15, 0.35)), fa: 0 } as Pose['bl'];
  bl.f = [bl.f[0], bl.f[1] + 1 * k * sF];
  const hip: P2 = lerpP(r.hip, s.hip, turnU);
  const A: Pose = { ...r, hip, fl, bl, flags: { ...(r.flags ?? {}), yaw, lyaw: YAW * 0.5 + (INSPECT_YAW * 0.85 - YAW * 0.5) * turnU } };
  const B: Pose = { ...s, hip, fl, bl, flags: { ...(s.flags ?? {}), yaw, lyaw: A.flags!.lyaw } };
  const p: Pose = { ...A, mix: { a: A, p: B, u: clamp01(turnU) } };
  // the head leads: it looks out at the viewer before the body gets there
  p.look = (back ? u < 0.6 : u > 0.3) ? 'cam' : 'fwd';
  return p;
}

/** inspected, presenting the camera: both hands bring it off his chest a little toward the viewer */
function inspectCamera(b: Build, t: number): Pose {
  const k = K(b), br = breath(t);
  const p = inspectStance(b, br);
  const lift = 0.3 * Math.sin(TAU * t);
  p.fa = { ik: wHead(b, p, 3, -10.6 + lift), hand: 'grip', palm: 'in' };
  p.ba = { ik: wHead(b, p, 1.4, -10.2 + lift), hand: 'grip', palm: 'in' };
  p.flags = { ...p.flags, wN: 1, wF: 1, zN: 2.8 * k, zF: -1.6 * k };
  p.held = { kind: 'camera' };
  p.front = ['armF', 'armB'];
  return p;
}
/** inspected, showing the pack: a quarter turn back so it shows, thumbs hooked under the straps */
function inspectPack(b: Build, t: number): Pose {
  const k = K(b), br = breath(t);
  const p = inspectStance(b, br);
  // a little hitch of the shoulders, jostling the pack up
  const hitch = bump(t, 0.5, 0.8, 0.1);
  p.hd = [0, (p.hd?.[1] ?? 0) - 0.3 * k * hitch];
  p.flags = { ...p.flags, wN: 1, wF: 1, zN: 3 * k, zF: -2.8 * k };
  p.fa = { ik: wHead(b, p, 0.8, -6.8 + br * 0.3 + 0.6 * hitch), hand: 'hook', palm: 'in' };
  p.ba = { ik: wHead(b, p, 2.4, -7 + br * 0.3 + 0.6 * hitch), hand: 'hook', palm: 'in' };
  return p;
}
/** inspected, the note paper: a pat on the pocket it lives in */
function inspectNote(b: Build, t: number): Pose {
  const k = K(b), br = breath(t);
  const p = inspectStance(b, br);
  const pat = Math.max(0, Math.sin(TAU * 2 * t));
  p.fa = { ik: wHead(b, p, 3.4, -20 + pat * 0.8), hand: 'flat', palm: 'in' };
  p.flags = { ...p.flags, wN: 1, zN: 3.6 * k };
  return p;
}

/** the near hand's way from the pocket on his hip up to the chest, and the open notebook there */
const POCKET = [2.6, -20.8] as const, READ_N = [5, -11.6] as const, READ_F = [3.4, -12] as const;
/**
 * The note paper out of his pocket (u 0 → 1, pullNote; putNote plays it back): the near hand goes down
 * to the pocket on his hip, dips in and pinches the notebook out, brings it up to his chest, and the
 * far hand comes to open it; he looks down into it. Ends where noteRead starts.
 */
function pullNote(b: Build, u: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const reach = up(u, 0, 0.26), dip = bump(u, 0.22, 0.38, 0.06), lift = up(u, 0.34, 0.3), open = up(u, 0.6, 0.3);
  const g = act(r, {
    lean: r.lean + 0.04 * reach * (1 - lift) + 0.05 * lift,
    hd: [(r.hd?.[0] ?? 0) + 0.25 * k * lift, (r.hd?.[1] ?? 0) - 0.35 * k * lift],
    look: u > 0.12 ? 'down' : 'fwd',
  }, { wN: 1, wF: 1, zN: mix(3.4, 2.2, lift) * k, zF: -0.8 * k });
  const pk: P2 = [POCKET[0], POCKET[1] - 0.8 * dip];
  g.fa = hand(b, g, mix(pk[0], READ_N[0], lift), mix(pk[1], READ_N[1], lift), u > 0.26 ? 'pinch' : 'flat', { palm: lift > 0.5 ? 'up' : 'in' });
  // the far hand only comes up to help open the book
  const join = up(u, 0.5, 0.3);
  g.ba = { ik: lerpP(wHang(b, g, 0.4), wHead(b, g, READ_F[0], READ_F[1]), join), hand: join > 0.5 ? 'pinch' : 'relax', palm: join > 0.5 ? 'up' : 'in' };
  if (u > 0.27) g.held = { kind: 'note', v: open };
  g.front = ['armF'];
  return over(r, g, up(u, 0, 0.14));
}
/** reading the note paper: held open at his chest, eyes running down the page, a page turned now and then */
function noteRead(b: Build, t: number, id: string): Pose {
  const k = K(b), r = rest(b, id);
  const br = breath(t), flick = bump(t, 0.62, 0.78, 0.05);
  const g = act(r, {
    lean: r.lean + 0.05,
    hd: [(r.hd?.[0] ?? 0) + 0.25 * k + 0.12 * k * Math.sin(TAU * 3 * t), (r.hd?.[1] ?? 0) - 0.35 * k + 0.1 * k * br],
    look: 'down',
  }, { wN: 1, wF: 1, zN: 2.2 * k, zF: -0.8 * k });
  g.fa = hand(b, g, READ_N[0], READ_N[1] + br * 0.2, 'pinch', { palm: 'up' });
  g.ba = hand(b, g, READ_F[0] + 0.5 * flick, READ_F[1] + br * 0.2 + 0.5 * flick, 'pinch', { palm: 'up', flex: -0.3 * flick });
  g.held = { kind: 'note', v: 1 };
  g.front = ['armF'];
  return g;
}

// ------------------------------------------------------------------ registration

Object.assign(ANIMS7, {
  // reactions (the Actor lays them over the stance: react('jump' | 'bounce' | 'recoil' | 'nod' | ...))
  reactHop: { frames: 14, fps: 20, loop: false },
  reactBounce: { frames: 10, fps: 20, loop: false },
  reactRecoil: { frames: 11, fps: 18, loop: false },
  reactNod: { frames: 8, fps: 16, loop: false },
  reactCringe: { frames: 12, fps: 16, loop: false },
  reactTremble: { frames: 6, fps: 18, loop: true },
  // idle fidgets (the Actor picks from IDLE_VARIETY now and then while someone stands about)
  idleShift: { frames: 24, fps: 10, loop: false },
  idleLook: { frames: 22, fps: 10, loop: false },
  fidgetNeck: { frames: 20, fps: 10, loop: false },
  fidgetStrap: { frames: 18, fps: 10, loop: false },
  fidgetHair: { frames: 18, fps: 10, loop: false },
  fidgetHeels: { frames: 20, fps: 10, loop: false },
  fidgetBeard: { frames: 22, fps: 10, loop: false },
  fidgetBelly: { frames: 16, fps: 10, loop: false },
  fidgetShoulder: { frames: 22, fps: 10, loop: false },
  // V12 (anim-contract.ts): hunger, inspecting Mori, the note paper
  growl: { frames: 27, fps: 15, loop: false },
  inspectFace: { frames: 11, fps: 20, loop: false },
  inspect: { frames: 24, fps: 6, loop: true },
  inspectBack: { frames: 10, fps: 20, loop: false },
  inspectCamera: { frames: 12, fps: 6, loop: true },
  inspectPack: { frames: 12, fps: 6, loop: true },
  inspectNote: { frames: 12, fps: 6, loop: true },
  pullNote: { frames: 18, fps: 15, loop: false },
  putNote: { frames: 16, fps: 15, loop: false },
  noteRead: { frames: 18, fps: 6, loop: true },
});

Object.assign(POSES7, {
  reactHop: (b: Build, t: number, id: string) => reactHop(b, t, id),
  reactBounce: (b: Build, t: number, id: string) => reactHop(b, t, id, false),
  reactRecoil: (b: Build, t: number, id: string) => reactRecoil(b, t, id),
  reactNod: (b: Build, t: number, id: string) => reactNod(b, t, id),
  reactCringe: (b: Build, t: number, id: string) => reactCringe(b, t, id),
  reactTremble: (b: Build, t: number, id: string) => reactTremble(b, t, id),
  idleShift: (b: Build, t: number, id: string) => idleShift(b, t, id),
  idleLook: (b: Build, t: number, id: string) => idleLook(b, t, id),
  fidgetNeck: (b: Build, t: number, id: string) => fidgetNeck(b, t, id),
  fidgetStrap: (b: Build, t: number, id: string) => fidgetStrap(b, t, id),
  fidgetHair: (b: Build, t: number, id: string) => fidgetHair(b, t, id),
  fidgetHeels: (b: Build, t: number, id: string) => fidgetHeels(b, t, id),
  fidgetBeard: (b: Build, t: number, id: string) => fidgetBeard(b, t, id),
  fidgetBelly: (b: Build, t: number, id: string) => fidgetBelly(b, t, id),
  fidgetShoulder: (b: Build, t: number, id: string) => fidgetShoulder(b, t, id),
  growl: (b: Build, t: number, id: string) => growl(b, t, id),
  inspectFace: (b: Build, t: number, id: string) => inspectTurn(b, t, id),
  inspect: (b: Build, t: number) => { const p = inspectStance(b, breath(t), Math.sin(TAU * t)); return p; },
  inspectBack: (b: Build, t: number, id: string) => inspectTurn(b, 1 - t, id, true),
  inspectCamera: (b: Build, t: number) => inspectCamera(b, t),
  inspectPack: (b: Build, t: number) => inspectPack(b, t),
  inspectNote: (b: Build, t: number) => inspectNote(b, t),
  pullNote: (b: Build, t: number, id: string) => pullNote(b, t, id),
  putNote: (b: Build, t: number, id: string) => pullNote(b, 1 - t, id),
  noteRead: (b: Build, t: number, id: string) => noteRead(b, t, id),
});

/** the fidgets each of the cast drops into now and then while standing about (others: the first row) */
export const IDLE_VARIETY: Record<string, string[]> = {
  // (others have their own idles and habits: just the weight shift and a glance round)
  default: ['idleShift', 'idleLook'],
  mori: ['idleShift', 'idleLook', 'fidgetStrap', 'fidgetNeck'],
  jenna: ['idleShift', 'idleLook', 'fidgetHair', 'fidgetHeels'],
  joshu: ['idleShift', 'fidgetBeard', 'fidgetBelly', 'idleLook'],
  aroha: ['idleLook', 'fidgetShoulder', 'idleShift'],
};
