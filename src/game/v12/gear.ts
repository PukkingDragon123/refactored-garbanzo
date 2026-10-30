// V12 hard-won progress: the gear that opens the trails. Research (photos uploaded at the laptop earn
// the points) unlocks a blueprint, Jenna's bench crafts it from things you gathered, and the piece
// of gear opens a way that was shut: rope for a cliff, a snorkel for the pool, grip soles for the
// scree, a lantern for the dark, a wetsuit for the cold sump... The trails module asks gateOk();
// the signposts paint the missing gear on the shut ways; the loop's daily goal points at the next one.

import { game } from '../game';
import '../v11/bpdata';
import { BLUEPRINTS, defineBlueprint, hasBlueprint, isActive } from '../v11/blueprints';
import type { BlueprintDef } from '../v11/blueprints';
import type { GearIcon } from './signpost';

export type GateId = 'staff' | 'snorkel' | 'grip' | 'gloves' | 'rope' | 'lantern' | 'boots' | 'wetsuit' | 'blessing';
export interface Gate {
  /** the blueprint that opens it (none: a story flag) */
  bp?: string;
  flag?: string;
  /** what Mori says when he can't go on */
  why: string;
  /** the gear in a few words ("a climbing rope") */
  gear: string;
  icon: GearIcon;
}

export const GATES: Record<GateId, Gate> = {
  staff: { bp: 'walking_staff', gear: 'a walking staff', icon: 'staff', why: 'The mud in there swallows legs whole. I need a staff to test the ground first.' },
  snorkel: { bp: 'snorkel', gear: 'a snorkel and mask', icon: 'mask', why: 'Swim under THAT rock, in the dark, eyes shut? Not without a snorkel and mask.' },
  grip: { bp: 'grip_soles', gear: 'grip soles', icon: 'boot', why: 'Loose scree all the way up. In these soles I’d slide straight back down. I need grip soles.' },
  gloves: { bp: 'climbing_gloves', gear: 'grip gloves', icon: 'glove', why: 'The kauri bark is smooth as glass. I’d need grip gloves to climb that.' },
  rope: { bp: 'climbing_rope', gear: 'a climbing rope', icon: 'rope', why: 'Straight down. Nope. Not without a proper climbing rope. Joshu knows knots.' },
  lantern: { bp: 'storm_lantern', gear: 'a storm lantern', icon: 'lantern', why: 'It’s pitch black down there. I’m not going in without a lantern.' },
  boots: { bp: 'trail_boots', gear: 'trail boots', icon: 'boot', why: 'The ground is HOT. These soles would melt. I need proper trail boots.' },
  wetsuit: { bp: 'wetsuit', gear: 'a wetsuit', icon: 'fin', why: 'That water is freezing, and the sump is long. Not without a wetsuit.' },
  blessing: { flag: 'v10:koroBlessing', gear: 'Koro’s blessing', icon: 'koru', why: 'Aroha shakes her head. Not without Koro’s blessing. Not that way.' },
};

/** is this way open? */
export function gateOk(id: GateId | undefined): boolean {
  if (!id) return true;
  const g = GATES[id];
  if (g.flag) return !!game.save.flags[g.flag];
  return !!g.bp && isActive(g.bp);
}
/** what's still missing for a gate: 'research' (no blueprint yet), 'craft' (the sheet, not the gear), or null */
export function gateNeed(id: GateId): 'research' | 'craft' | 'story' | null {
  if (gateOk(id)) return null;
  const g = GATES[id];
  if (g.flag) return 'story';
  return hasBlueprint(g.bp!) ? 'craft' : 'research';
}

// ---------------------------------------------------------------- the blueprints say what they open
const OPENS: Record<string, string> = {
  walking_staff: 'Opens the trail up the stream into the Blackwater Mangroves',
  snorkel: 'Opens the swim through the back of the glowworm pool to the Sea Grotto',
  grip_soles: 'Opens the scree trails up onto the Rocky Hills',
  climbing_gloves: 'Opens the climb up the giant kauri into the Emerald Canopy',
  storm_lantern: 'Opens the dark ways: down into the Glowing Forest and the stair into Te Korokoro',
  trail_boots: 'Opens the hot ground of the Hot Valley',
  wetsuit: 'Opens the long cold dive through the grotto sump to the Deep',
};

let patched = false;
/** (idempotent) the gear blueprints describe the trail they open; the climbing rope sheet exists */
export function registerTrailGear() {
  if (patched) return;
  patched = true;
  for (const [id, line] of Object.entries(OPENS)) {
    const d = BLUEPRINTS[id];
    if (d) d.effect = line + (d.effect && !/energy/i.test(d.effect) ? `; ${d.effect.charAt(0).toLowerCase()}${d.effect.slice(1)}` : '');
  }
  defineBlueprint({
    id: 'climbing_rope', name: 'Climbing rope', kind: 'equipment', by: 'joshu', source: 'research', rp: 50, hours: 12,
    desc: 'Three lengths of flax rope laid up into one thick line, whipped at both ends, with a bowline already tied and a sailor’s coil. Takes a man’s weight. Probably two.',
    effect: 'Opens the cliff ways: the gorge above the falls, down off the ridge, and the collapsed stair at the old pā',
    needs: [['rope', 3], ['flax', 4]],
    notes: ['bowline: the rabbit comes out of the hole', 'NEVER a granny knot', 'coil it clockwise'],
    line: 'Dad tied this one himself. He says if it breaks I can have my money back.',
  } as BlueprintDef);
}
registerTrailGear();
