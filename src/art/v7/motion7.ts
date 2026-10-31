// V12 live motion (the player, user: "realistic animation, not janky, physics based"): small physical
// adjustments laid on top of whatever clip is playing, driven by the Actor's springs (src/world/
// livebody.ts) and drawn from fine, quantised steps so the frames stay cacheable:
//  - lean: the body tips into an acceleration and back against braking (the arms keep hanging plumb)
//  - dip: the knees bend and the hips sink and go back, the chest over the feet (a landing absorbed, the
//    crouch before a jump); the feet stay where they are and the knees take it
//  - slope: each foot is set on the ground under it (uphill foot higher, downhill lower), the hips drop
//    as far as the lower leg needs, the shoes tilt with the ground and the body leans into the hill
//  - arm: the arms swing on with their own inertia (forward when he brakes, back when he sets off)
//  - shift: standing, the weight drifts from foot to foot on a slow cycle of its own (not the breath's)
//  - air: in the air the pose follows the vertical speed: knees drawn up rising, tucked at the top,
//    legs reaching down for the ground as he falls, the arms out for balance

import type { Build, Pose, ArmP, LegP } from '../people-rig';
import { stand } from '../anime/anims';
import { K, LEG_K } from './anims7';

export interface Motion7 {
  /** extra lean (rad): + forward */
  lean?: number;
  /** knees bent, hips low: 0..1 */
  dip?: number;
  /** ground slope toward the facing (rise per px, + uphill) */
  slope?: number;
  /** both arms' extra swing forward (rad) */
  arm?: number;
  /** standing weight shift, -1 (on the far foot) .. 1 (on the near foot) */
  shift?: number;
  /** airborne: vertical speed, -1 rising fast .. 0 the top of the jump .. 1 falling fast */
  air?: number;
}

/** the steps each parameter is quantised to (each distinct step is a frame to render and cache) */
export const MOTION_STEP = { lean: 0.025, dip: 0.125, slope: 0.0625, arm: 0.06, shift: 0.5, air: 0.125 } as const;
const q = (v: number | undefined, s: number) => (v ? Math.round(v / s) * s : 0);
/** a motion snapped to its steps (zero fields dropped) */
export function quantMotion7(m: Motion7): Motion7 {
  const o: Motion7 = {};
  for (const k of Object.keys(MOTION_STEP) as (keyof Motion7)[]) {
    const v = q(m[k], MOTION_STEP[k]);
    if (v) o[k] = +v.toFixed(4);
  }
  if (m.air !== undefined) o.air = +q(m.air, MOTION_STEP.air).toFixed(4);
  return o;
}
export const motionKey7 = (m: Motion7) => `${m.lean ?? 0},${m.dip ?? 0},${m.slope ?? 0},${m.arm ?? 0},${m.shift ?? 0},${m.air ?? '-'}`;

const ik = (a: ArmP) => !!a.ik;
const swingArm = (a: ArmP, da: number, de = 0): ArmP => (ik(a) ? a : { ...a, a: (a.a ?? 0) + da, e: (a.e ?? 0) + de });

/** the airborne pose from the vertical speed (air -1 rising fast .. 1 falling fast) */
export function airPose7(b: Build, air: number): Pose {
  const k = K(b);
  const rise = Math.max(0, -air), fall = Math.max(0, air);
  // most tucked at the top of the jump, opening out on the way down
  const tuck = Math.max(0, 1 - fall * 1.25) * (0.55 + 0.45 * (1 - rise));
  const reach = Math.min(1, fall * 1.4);
  const p = stand(b, { hip: [0, b.hipH + 0.2 * k], lean: 0.1 * (1 - reach) + 0.04 });
  // the leading knee drawn up and forward, the trailing leg folded back under the hips; falling, both
  // straighten down toward the ground, the toes a little down
  // (reaching, the feet come down over the spots they'll stand on, so the landing never slides them)
  const lx = (air: number, st: number) => (air + (st - air) * reach) * k;
  p.fl = { f: [lx(1.3 + 1.9 * tuck, -2.2), b.ankleH + (5.6 * tuck + 0.6 * (1 - reach)) * k], fa: 0.15 * tuck - 0.3 * reach };
  p.bl = { f: [lx(-1.6 - 1.2 * tuck, 2.4), b.ankleH + (3.8 * tuck + 0.9 * (1 - reach)) * k], fa: -0.55 * tuck - 0.3 * reach };
  // the arms: swung forward and up out of the take-off, out to the sides for balance as he falls
  p.fa = { a: 0.55 + 0.75 * rise + 0.35 * tuck - 0.2 * reach, e: 0.55 - 0.2 * reach, hand: 'open', spread: 0.8 };
  p.ba = { a: 0.15 + 0.55 * rise + 0.25 * tuck + 0.25 * reach, e: 0.4, hand: 'open', spread: 0.8 };
  p.flags = { aoN: 0.8 + 1.6 * reach, aoF: 0.8 + 1.6 * reach };
  p.hd = [0.2 * k, -0.15 * k * rise];
  // the shirt tails and hair lift as he drops, trail as he rises
  p.sway = 0.6 + 0.5 * rise;
  p.bounce = 0.9 * fall - 0.4 * rise;
  return p;
}

/** a motion laid on a pose (blends included: each side is adjusted before they are mixed) */
export function applyMotion7(b: Build, p: Pose, m: Motion7): Pose {
  if (p.mix) {
    const mm = p.mix;
    const base = applyMotion7(b, { ...p, mix: undefined }, m);
    return { ...base, mix: { a: mm.a ? applyMotion7(b, mm.a, m) : undefined, p: applyMotion7(b, mm.p, m), u: mm.u } };
  }
  if (!m.lean && !m.dip && !m.slope && !m.arm && !m.shift) return p;
  const k = K(b);
  let hip = p.hip, lean = p.lean, fa = p.fa, ba = p.ba, fl = p.fl, bl = p.bl, hd = p.hd ?? [0, 0];
  let sway = p.sway ?? 0;
  const flags = { ...(p.flags ?? {}) };
  if (m.shift) {
    // the weight over one foot: the hips slide across onto it, the shoulders tilt the other way, and
    // the free leg's heel comes up a hair as its knee softens
    const s = m.shift;
    flags.sx = (flags.sx ?? 0) + s * 0.55 * k;
    flags.roll = (flags.roll ?? 0) - s * 0.025;
    hip = [hip[0], hip[1] - Math.abs(s) * 0.12 * k];
    const free = (L: LegP, w: number): LegP => (w > 0 ? { ...L, f: [L.f[0], L.f[1] + w * 0.35 * k], fa: (L.fa ?? 0) - w * 0.22 } : L);
    fl = free(fl, -s);
    bl = free(bl, s);
  }
  if (m.slope) {
    // each foot on the ground under it, the shoes along it; the hips as low as the lower leg needs
    const s = m.slope, tilt = Math.atan(s);
    const set = (L: LegP): [LegP, number] => {
      const dy = s * L.f[0] * LEG_K;
      const planted = L.f[1] - b.ankleH < 0.8 * k;
      return [{ ...L, f: [L.f[0], L.f[1] + dy], fa: (L.fa ?? 0) + (planted ? tilt : tilt * 0.5) }, dy];
    };
    const [n, dn] = set(fl), [f, df] = set(bl);
    fl = n; bl = f;
    hip = [hip[0], hip[1] + Math.min(0, dn, df) * 0.7 + Math.max(0, Math.min(dn, df)) * 0.5];
    lean += s * 0.3;
  }
  if (m.dip) {
    // knees bend, the hips sink and go back, the chest comes forward over the feet, the arms forward
    const d = m.dip;
    hip = [hip[0] - 0.45 * k * d, hip[1] - (b.hipH - b.ankleH) * 0.2 * d];
    lean += 0.24 * d;
    hd = [hd[0] + 0.2 * k * d, hd[1] - 0.25 * k * d];
    fa = swingArm(fa, 0.32 * d, 0.3 * d);
    ba = swingArm(ba, 0.26 * d, 0.3 * d);
    sway += 0.4 * d;
  }
  if (m.lean) {
    lean += m.lean;
    // the shirt tails trail an acceleration, swing forward on a stop
    sway += m.lean * 5;
  }
  if (m.arm) { fa = swingArm(fa, m.arm, Math.max(0, m.arm) * 0.4); ba = swingArm(ba, m.arm * 0.85, Math.max(0, m.arm) * 0.35); }
  return { ...p, hip, lean, fa, ba, fl, bl, hd, sway, flags, sq: (p.sq ?? 1) * (1 - 0.025 * (m.dip ?? 0)) };
}
