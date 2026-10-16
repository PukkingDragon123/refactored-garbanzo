// V10 field gear (the camera body, the backpack, boots, snorkel and wetsuit, the headlamp and Jenna's
// translator). Since V11 every upgrade step is a blueprint (src/game/v11/bpdata.ts, BlueprintDef.chain):
// it is researched or earned, then crafted at Jenna's bench from the blueprint sheet. A chain's level
// is the number of its steps built, in order.
//
// Gameplay reads the effects through `gearFx` (base values without upgrades are the neutral ones), the
// same way it reads fx10; the two stack (multiply / add). Old saves: levels bought at the bench before
// V11 are moved over once (the matching blueprints granted and built).

import { game } from '../game';
import { bucket } from './store';
import { dayState, dayNumber } from './day';
import { BLUEPRINTS, bpSave, isActive } from '../v11/blueprints';
import { CHAIN_STEPS } from '../v11/bpdata';

export type GearId = 'camera' | 'pack' | 'boots' | 'wetsuit' | 'headlamp' | 'translator';

export interface GearStep {
  /** the blueprint behind this step */
  bp: string;
  name: string;
  desc: string;
  /** one line: what it does in play */
  effect: string;
  rp: number;
  items: [string, number][];
  /** Jenna's line when she hands it over */
  jenna: string;
}
export interface GearDef { id: GearId; name: string; icon: string; base: string; readonly steps: GearStep[] }

const step = (id: string): GearStep => {
  const b = BLUEPRINTS[id];
  return { bp: id, name: b?.name ?? id, desc: b?.desc ?? '', effect: b?.effect ?? '', rp: b?.rp ?? 0, items: b?.needs ?? [], jenna: b?.line ?? 'Done!' };
};
const def = (id: GearId, name: string, icon: string, base: string): GearDef => ({ id, name, icon, base, get steps() { return CHAIN_STEPS(id).map(step); } });

export const GEAR: GearDef[] = [
  def('camera', 'Camera body', 'camera', 'A battered mirrorless camera that survived a shipwreck in a dry bag.'),
  def('pack', 'Backpack', 'pack', 'Mori’s old field pack. One strap is held on with hope.'),
  def('boots', 'Boots', 'boot', 'Sneakers. Wet sneakers. Sandy, wet sneakers.'),
  def('wetsuit', 'Snorkel & wetsuit', 'eye', 'Nothing. Swimming in your field clothes, like a soggy hero.'),
  def('headlamp', 'Headlamp', 'headlamp', 'Your headlamp. It flickers if you nod.'),
  def('translator', 'Translator', 'translator', 'The phone’s offline translator app. It “mostly works”.'),
];
export const GEAR_BY_ID: Record<GearId, GearDef> = Object.fromEntries(GEAR.map(g => [g.id, g])) as Record<GearId, GearDef>;

/** the pre-V11 bench levels (read once, for the migration) */
interface GearState { lv: Partial<Record<GearId, number>> }
const gs = () => bucket<GearState>('gear', () => ({ lv: {} }));

const migrated = new WeakSet<object>();
function migrateGear() {
  const sv = game.save as unknown as object;
  if (!sv || migrated.has(sv)) return;
  migrated.add(sv);
  const old = gs().lv;
  const bp = bpSave();
  let any = false;
  for (const g of GEAR) {
    const n = old[g.id] ?? 0;
    CHAIN_STEPS(g.id).slice(0, n).forEach(id => {
      if (!bp.owned[id]) { bp.owned[id] = { from: 'bench', t: Date.now(), seen: true }; any = true; }
      if (!bp.made[id]) { bp.made[id] = 1; any = true; }
    });
  }
  if (any) game.persist();
}

/** current level of a piece of gear (0 = as found): its chain's steps built, in order */
export function gearLevel(id: GearId): number {
  migrateGear();
  let n = 0;
  for (const s of CHAIN_STEPS(id)) { if (!isActive(s)) break; n++; }
  return n;
}
export function nextStep(id: GearId): GearStep | null { const s = CHAIN_STEPS(id)[gearLevel(id)]; return s ? step(s) : null; }

/** the translator's level (0 none .. 3): the story event sets 1, the blueprints raise it */
export const translatorLevel = () => game.save.vars['v10:translator'] ?? 0;

/** the day's meal buff (a hearty breakfast) */
function mealBuff(id: string): boolean {
  const b = dayState().buff;
  return !!b && b.day === dayNumber() && b.id === id;
}

/** what gameplay reads (neutral without upgrades); stack with fx10 */
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
  /** multiplier on the headlamp's beam (the storm lantern adds to it) */
  lampRange: (): number => ([1, 1.6, 1.6][gearLevel('headlamp')] ?? 1) * (isActive('storm_lantern') ? 1.3 : 1),
  /** multiplier on energy spent with the lamp on (after dark, in caves) */
  nightEnergyMult: (): number => ([1, 1, 0.85][gearLevel('headlamp')] ?? 1) * (isActive('storm_lantern') ? 0.85 : 1),
  /** translator level 0..3 (also game.save.vars['v10:translator']) */
  translator: (): number => translatorLevel(),
  /** a hearty breakfast today: +1 bonus for the systems module to show */
  wellFed: (): boolean => mealBuff('hearty'),
};
