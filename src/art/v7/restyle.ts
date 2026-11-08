// V7 proportions, applied to every cast member (the core four, the NPCs and the villagers) from their
// own builds, so the clips (all parameterised by the build) follow. Each build is first restyled for
// its type (Mori's ordinary fit build, the grown men's broader frame, the women's slender one), then
// set to the cast's proportions (`anat`, below: stylised like Dave the Diver's people, a readable head
// on a short thick neck, the joints where anatomy puts them). Children keep their rounder proportions.

import type { Build } from '../people-rig';
import type { Char7 } from './body';
import { CAST7 } from './cast';
import { HEADS7, HEAD_SCALE_MAN7, HEAD_SCALE_WOMAN7 } from './head';
import { isFem7 } from './face7';
import { TOON7 } from './raster';

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
  if (REAL7.has(ch.id)) return anat(realBuild(ch), ch);
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
  return anat(r, ch);
}

// ---------------------------------------------------------------- proportions
// The figure (user: "the body and face and neck looks uncanny, study how Dave the Diver makes it look
// good and normal"). Measured anatomy alone (7.4 heads, a long thin neck, a small face) reads as uncanny
// at sprite size: the eye finds a tiny face on a big realistic body. Dave the Diver's people are
// stylised the way good game sprites are: a larger head so the face reads, a short thick neck so the
// head sits on the shoulders, arms a touch short, every joint still where it belongs. So the head is
// 1/5.7 of the height for men and 1/5.55 for women, the visible neck short (0.024 H, women 0.03 H)
// and thick (its radius about a quarter of the head's height for men, a fifth for women), and the rest
// keeps the anatomical landmarks (user, before: "anatomically accurate"): the legs split thigh/shin/
// ankle as measured (0.463/0.463/0.074 of the leg; the knee halfway), the elbow at the waist, the wrist
// at the crotch. Each keeps their own stature, their own breadth where it is bigger (a broad man stays
// broad), and their own girths. Children keep their own rounder proportions.
const STYLE = {
  man: { heads: 5.7, neck: 0.024, torso: 0.3, upArm: 0.172, foreArm: 0.138, neckR: 0.26, shW: 0.1, hipW: 0.048 },
  woman: { heads: 5.55, neck: 0.03, torso: 0.288, upArm: 0.168, foreArm: 0.134, neckR: 0.21, shW: 0.0925, hipW: 0.052 },
};
const anatK = new Map<string, number>();
function anat(r: Char7, from: Char7): Char7 {
  const b = r.build;
  if (isChild(from.build)) { memo.set(from, r); memo.set(r, r); return r; }
  const hd = HEADS7[r.id] ?? HEADS7.mori;
  const top = hd.skull[0][1] + hd.skull[1][1];
  const chin = Math.min(hd.chin[0][1] - hd.chin[1][1], hd.jaw[0][1] - hd.jaw[1][1]);
  const raw = Math.max(1, top - chin);
  const fem = isFem7(r.id, HEADS7[r.id]);
  const S = fem ? STYLE.woman : STYLE.man;
  const kNow = REAL7.has(r.id) ? HEAD_SCALE_REAL7 : fem ? HEAD_SCALE_WOMAN7 : HEAD_SCALE_MAN7;
  const H = b.hipH + b.torso + b.neck + raw * kNow;
  const headH = H / S.heads;
  anatK.set(r.id, headH / raw);
  const torso = S.torso * H, neck = S.neck * H;
  const hipH = H - headH - neck - torso;
  // (the rig stands with a soft knee: the hip a touch under the straight-leg sum)
  const leg = hipH / 0.99;
  const build: Build = { ...b, ankleH: 0.074 * leg, shin: 0.463 * leg, thigh: 0.463 * leg, hipH, torso, neck, upArm: S.upArm * H, foreArm: S.foreArm * H };
  const out: Char7 = {
    ...r,
    build,
    shW: Math.max(r.shW, S.shW * H),
    hipW: Math.max(r.hipW, S.hipW * H),
    neckR: Math.max(r.neckR, S.neckR * headH),
    skirt: r.skirt ? { ...r.skirt, len: r.skirt.len * (build.hipH / Math.max(1, b.hipH)) } : undefined,
  };
  memo.set(from, out);
  memo.set(r, out);
  memo.set(out, out);
  return out;
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
  return r;
}
/** Mori's head: a touch smaller than the other men's (realistic proportions), the face still reading
 *  at his density */
export const HEAD_SCALE_REAL7 = TOON7 ? 0.94 : 0.74;
/** children's heads: rounder and larger still */
const HEAD_SCALE_KID7 = TOON7 ? 1.08 : 0.9;

/** how large a character's head is drawn (fraction of its volumes) */
export function headScale7(id: string): number {
  const ch = CAST7[id];
  if (ch && isChild(ch.build)) return HEAD_SCALE_KID7;
  // grown-ups: the proportion pass's head (1/5.7 of the height for men, 1/5.55 for women)
  if (ch) { restyle7(ch); const k = anatK.get(id); if (k) return k; }
  if (REAL7.has(id)) return HEAD_SCALE_REAL7;
  return isFem7(id, HEADS7[id]) ? HEAD_SCALE_WOMAN7 : HEAD_SCALE_MAN7;
}
