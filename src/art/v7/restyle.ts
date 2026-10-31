// V7 anime-realistic proportions, applied to every cast member (the core four, the NPCs and the
// villagers) from their own builds, so the clips (all parameterised by the build) follow:
//  - longer legs and a slightly longer torso and neck: a slender young-adult figure instead of a chibi
//  - arms long enough to reach mid-thigh, limbs a touch slimmer
//  - heads drawn at HEAD_SCALE7 of their volumes (head.ts): about six heads tall, a little large
//    for readability at game scale
// Children keep rounder proportions (a smaller stretch, larger heads).

import type { Build } from '../people-rig';
import type { Char7 } from './body';
import { CAST7 } from './cast';
import { HEAD_SCALE7 } from './head';
import { isFem7 } from './face7';

const memo = new WeakMap<Char7, Char7>();
const isChild = (b: Build) => b.hipH < 21;

/** a character's restyled body (memoised; restyling a restyled body returns it unchanged) */
export function restyle7(ch: Char7): Char7 {
  const hit = memo.get(ch);
  if (hit) return hit;
  const b = ch.build, kid = isChild(b);
  // grown men (user: "men more manly"): broader shoulders and chest, a thicker neck, full-weight arms
  // and legs, a sturdier stretch; women and children keep the slender build
  const man = !kid && !isFem7(ch.id);
  const L = kid ? 1.05 : man ? 1.08 : 1.12, T = kid ? 1 : 1.04, A = kid ? 1.03 : 1.07;
  const build: Build = {
    ...b,
    hipH: (b.hipH - b.ankleH) * L + b.ankleH,
    thigh: b.thigh * L,
    shin: b.shin * L,
    torso: b.torso * T,
    neck: b.neck + (kid ? 0.2 : 0.6),
    upArm: b.upArm * A,
    foreArm: b.foreArm * A,
  };
  const r: Char7 = {
    ...ch,
    build,
    shW: ch.shW * (man ? 1.12 : 1),
    chest: man ? [ch.chest[0] * 1.08, ch.chest[1] * 1.1] : ch.chest,
    waist: man ? [ch.waist[0] * 1.04, ch.waist[1] * 1.05] : ch.waist,
    neckR: ch.neckR * (man ? 1.15 : 1),
    armR: ch.armR.map(v => v * (man ? 1.06 : 0.95)) as Char7['armR'],
    legR: ch.legR.map(v => v * (man ? 1.02 : 0.96)) as Char7['legR'],
    skirt: ch.skirt ? { ...ch.skirt, len: ch.skirt.len * (1 + (L - 1) * 0.6) } : undefined,
  };
  memo.set(ch, r);
  memo.set(r, r);
  return r;
}

/** how large a character's head is drawn (fraction of its volumes) */
export function headScale7(id: string): number {
  const ch = CAST7[id];
  return ch && isChild(ch.build) ? 0.9 : HEAD_SCALE7;
}
