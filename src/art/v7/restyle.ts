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

const memo = new WeakMap<Char7, Char7>();
const isChild = (b: Build) => b.hipH < 21;

/** a character's restyled body (memoised; restyling a restyled body returns it unchanged) */
export function restyle7(ch: Char7): Char7 {
  const hit = memo.get(ch);
  if (hit) return hit;
  const b = ch.build, kid = isChild(b);
  const L = kid ? 1.05 : 1.12, T = kid ? 1 : 1.04, A = kid ? 1.03 : 1.07;
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
    armR: ch.armR.map(v => v * 0.95) as Char7['armR'],
    legR: ch.legR.map(v => v * 0.96) as Char7['legR'],
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
