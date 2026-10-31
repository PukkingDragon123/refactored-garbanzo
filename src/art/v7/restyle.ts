// V7 anime-realistic proportions, applied to every cast member (the core four, the NPCs and the
// villagers) from their own builds, so the clips (all parameterised by the build) follow:
//  - longer legs and a slightly longer torso and neck: a slender young-adult figure instead of a chibi
//  - arms long enough to reach mid-thigh, limbs a touch slimmer
//  - heads drawn at HEAD_SCALE_MAN7 / HEAD_SCALE_WOMAN7 of their volumes (head.ts): about six and a
//    half heads tall, the men's a touch smaller on their broader build
// Children keep rounder proportions (a smaller stretch, larger heads).

import type { Build } from '../people-rig';
import type { Char7 } from './body';
import { CAST7 } from './cast';
import { HEADS7, HEAD_SCALE_MAN7, HEAD_SCALE_WOMAN7 } from './head';
import { isFem7 } from './face7';

const memo = new WeakMap<Char7, Char7>();
const isChild = (b: Build) => b.hipH < 21;

/** a character's restyled body (memoised; restyling a restyled body returns it unchanged) */
export function restyle7(ch: Char7): Char7 {
  const hit = memo.get(ch);
  if (hit) return hit;
  const b = ch.build, kid = isChild(b);
  // Mori, the player (user: "more skinny and human ... not that skinny, just realistic"): an ordinary
  // fit young man rather than the other men's broad, heavy frame: real shoulders, a natural chest and
  // arms, legs with muscle on them, on longer limbs and a natural neck, about six and a half heads tall
  if (REAL7.has(ch.id)) return realBuild(ch);
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
    armR: ch.armR.map(v => v * (man ? 1.06 : kid ? 0.88 : 0.95)) as Char7['armR'],
    // children's hands in proportion to them (user: the kids' hands looked too big)
    hand: ch.hand * (kid ? 0.68 : 1),
    legR: ch.legR.map(v => v * (man ? 1.02 : 0.96)) as Char7['legR'],
    skirt: ch.skirt ? { ...ch.skirt, len: ch.skirt.len * (1 + (L - 1) * 0.6) } : undefined,
  };
  memo.set(ch, r);
  memo.set(r, r);
  return r;
}

/** the realistic, slim-to-average build (Mori) */
const REAL7 = new Set(['mori']);
function realBuild(ch: Char7): Char7 {
  const b = ch.build, L = 1.2;
  const build: Build = {
    ...b,
    hipH: (b.hipH - b.ankleH) * L + b.ankleH,
    thigh: b.thigh * L,
    shin: b.shin * L,
    torso: b.torso * 1.07,
    neck: b.neck + 1.1,
    // the shoulders sit a touch lower (a longer neck line, no hunch)
    shY: b.shY * 0.94,
    upArm: b.upArm * 1.08,
    foreArm: b.foreArm * 1.08,
  };
  const r: Char7 = {
    ...ch,
    build,
    // shoulders about two heads across, a chest with some depth, a waist that tapers a little
    shW: ch.shW * 1.04,
    chest: [ch.chest[0] * 1.0, ch.chest[1] * 1.0],
    waist: [ch.waist[0] * 0.96, ch.waist[1] * 0.95],
    pelvis: [ch.pelvis[0] * 0.98, ch.pelvis[1] * 0.98],
    neckR: ch.neckR * 1.02,
    // arms of a man who carries his own kit: upper arm with some bulk, tapering to the wrist
    armR: [ch.armR[0] * 0.98, ch.armR[1] * 0.95, ch.armR[2] * 0.94],
    // the thigh full, the calf shaped, a slimmer ankle
    legR: [ch.legR[0] * 1.0, ch.legR[1] * 0.98, ch.legR[2] * 0.94],
    skirt: ch.skirt ? { ...ch.skirt, len: ch.skirt.len * 1.06 } : undefined,
  };
  memo.set(ch, r);
  memo.set(r, r);
  return r;
}
/** Mori's head: a touch smaller than the other men's (realistic proportions), the face still reading
 *  at his density */
export const HEAD_SCALE_REAL7 = 0.74;

/** how large a character's head is drawn (fraction of its volumes) */
export function headScale7(id: string): number {
  const ch = CAST7[id];
  if (ch && isChild(ch.build)) return 0.9;
  if (REAL7.has(id)) return HEAD_SCALE_REAL7;
  return isFem7(id, HEADS7[id]) ? HEAD_SCALE_WOMAN7 : HEAD_SCALE_MAN7;
}
