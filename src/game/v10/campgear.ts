// V10 field gear, upgraded at Jenna's tech bench at camp with materials from the island and the
// expeditions plus Research Points: the camera body, the backpack, boots, snorkel and wetsuit, the
// headlamp and Jenna's translator. Some upgrades need skills from the laptop's skill tree (any skill
// in the right branch counts) or something from the story.
//
// Gameplay reads the effects through `gearFx` (base values without upgrades are the neutral ones), the
// same way it reads the skill tree's fx10; the two stack (multiply / add).

import { game } from '../game';
import { bucket } from './store';
import { count, remove } from '../inventory';
import { SKILL_TREE10, owned10 } from './skills10';
import type { Branch10 } from './skills10';
import { dayState, dayNumber, bond } from './day';

export type GearId = 'camera' | 'pack' | 'boots' | 'wetsuit' | 'headlamp' | 'translator';

export interface GearNeed {
  /** owned skills in this branch of the skill tree */
  branch?: Branch10;
  n?: number;
  /** a story flag, with the text explaining it */
  flag?: string;
  why?: string;
  /** a crew bond */
  bond?: ['jenna' | 'joshu' | 'aroha', number];
}
export interface GearStep {
  name: string;
  desc: string;
  /** one line: what it does in play */
  effect: string;
  rp: number;
  items: [string, number][];
  needs?: GearNeed;
  /** Jenna's line when she hands it over */
  jenna: string;
}
export interface GearDef { id: GearId; name: string; icon: string; base: string; steps: GearStep[] }

export const GEAR: GearDef[] = [
  {
    id: 'camera', name: 'Camera body', icon: 'camera', base: 'A battered mirrorless camera that survived a shipwreck in a dry bag.',
    steps: [
      { name: 'Lens hood & sea-glass cleaning kit', desc: 'A hood cut from a bait tin and a polishing kit made from tumbled sea glass and kelp cloth.', effect: 'Research photos lock on half a second sooner; a little sharper in glare.', rp: 20, items: [['driftglass', 3], ['kelp', 1]], jenna: 'Hood: bait tin. Cloth: kelp. Smell: also kelp. You’re welcome.' },
      { name: 'Weather-sealed body', desc: 'Every seam packed with river clay and resin, the battery door finally shuts.', effect: 'Photos develop faster; rain and spray stop fogging the lens.', rp: 40, items: [['clay', 2], ['flint', 2]], needs: { branch: 'camera', n: 1 }, jenna: 'Sealed it up tight. You can drop it in a rock pool now. Please do not drop it in a rock pool.' },
      { name: 'Fast-shutter firmware', desc: 'Jenna rewrote the camera’s firmware on the laptop. It says JENNA OS when it boots.', effect: 'Locks on a full second sooner and keeps more of a moving animal sharp.', rp: 80, items: [['driftglass', 4], ['shell_opal', 1]], needs: { branch: 'camera', n: 2 }, jenna: 'If it says “hello, nature boy” when you switch it on, that is a feature.' },
    ],
  },
  {
    id: 'pack', name: 'Backpack', icon: 'pack', base: 'Mori’s old field pack. One strap is held on with hope.',
    steps: [
      { name: 'Flax-cord straps', desc: 'Aroha showed Jenna the lashing. New straps of twisted harakeke.', effect: '+3 kg comfortable load before it slows you down.', rp: 10, items: [['flaxleaf', 4], ['kelp', 2]], jenna: 'Straps by Aroha’s method. Over, under, around, pull tight. Do not tell her I needed three goes.' },
      { name: 'Kelp-leather side pockets', desc: 'Dried kelp, cured hard as leather, stitched on with feather-quill awls.', effect: '+6 kg comfortable load in all.', rp: 30, items: [['kelp', 6], ['feather', 2]], jenna: 'Side pockets! One is labelled SNACKS. The other is also labelled SNACKS.' },
      { name: 'Driftwood frame pack', desc: 'A bent driftwood frame that puts the weight on your hips.', effect: '+10 kg comfortable load in all.', rp: 60, items: [['wood', 4], ['flaxleaf', 3], ['stone', 2]], needs: { branch: 'field', n: 1 }, jenna: 'Your back will thank me. Your back will write me a poem.' },
    ],
  },
  {
    id: 'boots', name: 'Boots', icon: 'boot', base: 'Sneakers. Wet sneakers. Sandy, wet sneakers.',
    steps: [
      { name: 'Re-soled with kelp rubber', desc: 'Dried kelp, layered and glued with clay, under the worn-out soles.', effect: 'Walking costs 7% less energy.', rp: 15, items: [['kelp', 3], ['clay', 1]], jenna: 'Kelp soles. They squeak. You will learn to love the squeak.' },
      { name: 'Grip soles', desc: 'Flint chips pressed into the soles: they bite on wet rock.', effect: 'Climbing is faster and walking costs 14% less energy.', rp: 35, items: [['flint', 2], ['kelp', 3]], jenna: 'You could walk up a waterfall in these. Do not walk up a waterfall in these.' },
      { name: 'Trail boots', desc: 'Joshu’s spare deck boots, cut down and padded with feathers.', effect: 'Walking and climbing cost 20% less energy.', rp: 70, items: [['feather', 4], ['clay', 2]], needs: { branch: 'field', n: 1 }, jenna: 'Dad’s spare boots. He says if you get them wet he will know. He will know.' },
    ],
  },
  {
    id: 'wetsuit', name: 'Snorkel & wetsuit', icon: 'eye', base: 'Nothing. Swimming in your field clothes, like a soggy hero.',
    steps: [
      { name: 'Snorkel & mask', desc: 'A dive mask from the Kittiwake’s locker with a new sea-glass faceplate.', effect: 'Look underwater while swimming; swimming costs 15% less energy.', rp: 20, items: [['driftglass', 2], ['kelp', 2]], jenna: 'Mask, fixed. Snorkel, fixed. The snorkel tastes like Dad. I am so sorry.' },
      { name: 'Patched wetsuit', desc: 'A torn wetsuit from the wreck, patched with kelp and sealed with clay.', effect: 'Cold water is fine; swimming costs 30% less energy.', rp: 45, items: [['kelp', 6], ['clay', 2]], needs: { flag: 'v10:agency', why: 'Needs the agency’s patch kit (radio the field office first)' }, jenna: 'It has more patches than suit. It is a patchsuit. Wear it with pride.' },
      { name: 'Fins', desc: 'Two fanshell-stiffened fins cut from the tender’s rubber floor.', effect: 'Swim faster; swimming costs 40% less energy.', rp: 80, items: [['shell_fan', 3], ['kelp', 4]], needs: { branch: 'field', n: 2 }, jenna: 'Fins! You look like a very confused duck. A FAST confused duck.' },
    ],
  },
  {
    id: 'headlamp', name: 'Headlamp', icon: 'headlamp', base: 'Your headlamp. It flickers if you nod.',
    steps: [
      { name: 'Sea-glass lens', desc: 'A polished sea-glass lens that throws the beam twice as far.', effect: 'A brighter, longer beam in caves and after dark.', rp: 15, items: [['driftglass', 2]], jenna: 'Brighter beam. Do not look into it. I looked into it. I can see sounds now.' },
      { name: 'Solar battery', desc: 'A cell from the boat’s solar panel, charged at camp every day.', effect: 'The beam never flickers; night walks cost 15% less energy.', rp: 35, items: [['shell_opal', 1], ['flint', 2]], needs: { branch: 'research', n: 1 }, jenna: 'Solar battery. It charges on the panel while you eat breakfast. Eat a long breakfast.' },
    ],
  },
  {
    id: 'translator', name: 'Translator', icon: 'translator', base: 'The phone’s offline translator app. It “mostly works”.',
    steps: [
      { name: 'Phrasebook patch', desc: 'Aroha read a hundred words into the laptop; Jenna fed them to the app.', effect: 'Fewer mistranslations (translator level 2).', rp: 25, items: [['feather', 2]], needs: { flag: 'v10:translator1', why: 'Jenna has to finish building it first', bond: ['aroha', 20] }, jenna: 'It now knows “kia ora”, “kai” and “Chunk, no”. Very important words.' },
      { name: 'Te reo voice pack', desc: 'Hours of Aroha’s stories, recorded round the fire. The app finally listens.', effect: 'Hardly any mistranslations (translator level 3).', rp: 60, items: [['plant_saltfern', 1], ['driftglass', 2]], needs: { bond: ['aroha', 45], branch: 'research', n: 1 }, jenna: 'It translated Aroha’s joke and I laughed. A COMPUTER made me laugh at a JOKE. In ANOTHER LANGUAGE.' },
    ],
  },
];
export const GEAR_BY_ID: Record<GearId, GearDef> = Object.fromEntries(GEAR.map(g => [g.id, g])) as Record<GearId, GearDef>;

interface GearState { lv: Partial<Record<GearId, number>> }
const gs = () => bucket<GearState>('gear', () => ({ lv: {} }));

/** current level of a piece of gear (0 = as found) */
export function gearLevel(id: GearId): number { return gs().lv[id] ?? 0; }
export function nextStep(id: GearId): GearStep | null { return GEAR_BY_ID[id].steps[gearLevel(id)] ?? null; }

/** owned skills in a branch of the skill tree (works with whatever skills the tree defines) */
export function branchOwned(b: Branch10): number { return SKILL_TREE10.filter(s => s.branch === b && owned10(s.id)).length; }
/** the tree has no skills in this branch (yet): a skill requirement can't be met, so it is waived */
const branchEmpty = (b: Branch10) => !SKILL_TREE10.some(s => s.branch === b);

/** what still stands in the way of an upgrade (empty = can buy) */
export function blockers(id: GearId): string[] {
  const st = nextStep(id);
  if (!st) return ['Fully upgraded'];
  const out: string[] = [];
  const n = st.needs;
  if (n?.flag && !game.save.flags[n.flag]) out.push(n.why ?? 'Not yet');
  if (n?.bond && bond(n.bond[0]) < n.bond[1]) out.push(`Needs a closer friendship with ${n.bond[0] === 'aroha' ? 'Aroha' : n.bond[0] === 'joshu' ? 'Joshu' : 'Jenna'}`);
  if (n?.branch && !branchEmpty(n.branch) && branchOwned(n.branch) < (n.n ?? 1)) out.push(`Needs ${n.n ?? 1} ${BRANCH_NAME[n.branch]} skill${(n.n ?? 1) > 1 ? 's' : ''} (laptop skill tree)`);
  if (game.save.rp < st.rp) out.push(`Needs ${st.rp} RP`);
  for (const [it, k] of st.items) if (count(it) < k) out.push('materials');
  return [...new Set(out)];
}
export const BRANCH_NAME: Record<Branch10, string> = { data: 'Data Analysis', camera: 'Camera', research: 'Research', field: 'Field' };

/** pay for and fit the next upgrade; returns the step bought */
export function buyGear(id: GearId): GearStep | null {
  const st = nextStep(id);
  if (!st || blockers(id).length) return null;
  game.save.rp -= st.rp;
  for (const [it, k] of st.items) remove(it, k);
  gs().lv[id] = gearLevel(id) + 1;
  if (id === 'translator') game.save.vars['v10:translator'] = Math.max(game.save.vars['v10:translator'] ?? 0, gearLevel(id) + 1);
  game.save.flags[`v10:gear:${id}:${gearLevel(id)}`] = true;
  game.persist();
  return st;
}

/** the translator's level (0 none .. 3): the story event sets 1, the bench raises it */
export const translatorLevel = () => game.save.vars['v10:translator'] ?? 0;

/** the day's meal buff (a hearty breakfast) */
function mealBuff(id: string): boolean {
  const b = dayState().buff;
  return !!b && b.day === dayNumber() && b.id === id;
}

/** what gameplay reads (neutral without upgrades); stack with fx10 from the skill tree */
export const gearFx = {
  /** seconds off the research-photo hold (subtract from fx10.captureHold) */
  captureHoldCut: (): number => [0, 0.5, 0.5, 1][gearLevel('camera')] ?? 0,
  /** multiplier on the photo develop time */
  developMult: (): number => [1, 1, 0.8, 0.7][gearLevel('camera')] ?? 1,
  /** 0..1 extra identification tolerance */
  idBonus: (): number => [0, 0.03, 0.05, 0.1][gearLevel('camera')] ?? 0,
  /** extra comfortable pack load in kg */
  packBonus: (): number => [0, 3, 6, 10][gearLevel('pack')] ?? 0,
  /** multiplier on walking / running energy (boots and the day's breakfast) */
  energyMult: (): number => ([1, 0.93, 0.86, 0.8][gearLevel('boots')] ?? 1) * (mealBuff('hearty') ? 0.9 : 1),
  /** multiplier on climbing speed */
  climbSpeed: (): number => [1, 1, 1.3, 1.4][gearLevel('boots')] ?? 1,
  /** multiplier on climbing energy */
  climbEnergyMult: (): number => [1, 1, 0.9, 0.8][gearLevel('boots')] ?? 1,
  /** 0 nothing, 1 snorkel (can look underwater), 2 wetsuit (cold water), 3 fins */
  swim: (): number => gearLevel('wetsuit'),
  /** multiplier on swimming energy */
  swimEnergyMult: (): number => [1, 0.85, 0.7, 0.6][gearLevel('wetsuit')] ?? 1,
  /** multiplier on the headlamp's beam */
  lampRange: (): number => [1, 1.6, 1.6][gearLevel('headlamp')] ?? 1,
  /** multiplier on energy spent after dark */
  nightEnergyMult: (): number => [1, 1, 0.85][gearLevel('headlamp')] ?? 1,
  /** translator level 0..3 (also game.save.vars['v10:translator']) */
  translator: (): number => translatorLevel(),
  /** a hearty breakfast today: +1 bonus for the systems module to show */
  wellFed: (): boolean => mealBuff('hearty'),
};
