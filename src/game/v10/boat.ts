// V10 boat: the Kittiwake's little clinker tender, the *Kitten*, and the multi-day job of making her
// seaworthy again at the camp boatyard. The Kittiwake herself is beyond saving, but her tender was
// torn off the stern crane by the wave and thrown up the beach east of the wreck: holed, upside down,
// but whole. Aroha's people built ocean-going waka; with her know-how the Kitten becomes a hybrid:
// planked and gum-sealed hull, an outrigger float (ama) on two booms (iako), the outboard Jenna
// rescues from the engine room, and a woven harakeke crab-claw sail.
//
// Stages (boatStage()):
//   0 wreck      the tender is still buried in the sand by the wreck
//   1 hull       dug out and dragged to the boatyard (holed, propped on chocks)
//   2 patched    new planks lashed in and sealed with kauri gum (it cures overnight)
//   3 outrigger  the ama float lashed on its booms
//   4 motor      Jenna's rebuilt outboard on the transom
//   5 rigged     mast, the woven sail and a pair of oars
//   6 launched   she floats: boat travel unlocked (flag 'v10:boat')
//
// Everything here is plain state + rules (no scene code): the camp side lives in boatyard.ts, the
// quests in boatquests.ts. State is the 'boat' bucket of game.save.v10 (see store.ts).

import { game } from '../game';
import { bucket } from './store';
import { dayNumber } from './day';
import { count, remove } from '../inventory';
import { defineItem, ITEMS } from '../items';

export const BOAT_NAME = 'Kitten';
export const BOAT_FLAG = 'v10:boat';

export type BoatStageId = 'wreck' | 'hull' | 'patched' | 'outrigger' | 'motor' | 'rigged' | 'launched';
export const BOAT_STAGES: BoatStageId[] = ['wreck', 'hull', 'patched', 'outrigger', 'motor', 'rigged', 'launched'];

/** seconds of island play that also count as "overnight" (a long afternoon in the sun) when no night passes */
export const CURE_FALLBACK = 480;

export interface BoatSave {
  stage: number;
  /** materials handed in, keyed `${job}:${item}` */
  given: Record<string, number>;
  /** things found / carried home: tender, outboard, fuel, log */
  found: Record<string, boolean>;
  motorFixed: boolean;
  /** the gum went on: day and play time */
  cureDay: number;
  cureT: number;
  /** Aroha started weaving the sail */
  sailDay: number;
  sailT: number;
  /** seconds of island play (the boatyard counts it) */
  playT: number;
  /** salvage spot -> day it was last taken */
  salvage: Record<string, number>;
  /** one-off lines and beats */
  seen: Record<string, boolean>;
  /** finished boat trips */
  trips: number;
}

export const boatSave = () => bucket<BoatSave>('boat', () => ({
  stage: 0, given: {}, found: {}, motorFixed: false, cureDay: 0, cureT: 0, sailDay: 0, sailT: 0, playT: 0, salvage: {}, seen: {}, trips: 0,
}));

// ------------------------------------------------------------------ items found on the water
defineItem({ id: 'v10_fish', name: 'Fresh fish', kind: 'food', stack: 6, desc: 'Caught off the Kitten. Joshu grills it on a flat stone with kawakawa leaves.', where: 'Fishing from the boat', eat: 'energy', energy: 25, weight: 1 });
defineItem({ id: 'v10_pumice', name: 'Pumice', kind: 'material', stack: 10, desc: 'A lump of volcanic froth so full of bubbles it floats.', where: 'Motu Ahi', weight: 0.1,
  lab: { rp: 6, time: 2, text: 'Gas-blown lava that cooled before the bubbles could escape. This one is fresh: the islet erupted not long ago.' } });
defineItem({ id: 'v10_obsidian', name: 'Obsidian flake', kind: 'material', stack: 10, desc: 'Black volcanic glass with an edge sharper than your knife.', where: 'Motu Ahi', weight: 0.2,
  lab: { rp: 8, time: 3, text: 'Lava that cooled too fast to crystallise. Aroha says her tūpuna traded it from island to island for blades.' } });
defineItem({ id: 'v10_sulphur', name: 'Sulphur crust', kind: 'material', stack: 10, desc: 'Lemon-yellow crystals scraped from a steaming vent. Smells like a thousand rotten eggs.', where: 'Motu Ahi vents (knife)', weight: 0.2,
  lab: { rp: 10, time: 3, text: 'Native sulphur, deposited where volcanic gas cools at the vent. Bacteria in the hot crust live on it: no sunlight needed.' } });
defineItem({ id: 'v10_down', name: 'Colony down', kind: 'animal', stack: 8, desc: 'A wisp of grey down from the nesting ledges.', where: 'Under the Motu Ahi colony', weight: 0.01,
  lab: { rp: 12, time: 4, text: 'Chick down, warm and water-shy. The colony lays where the ground is warm: the volcano does half the brooding.', species: 'cragauk' } });
defineItem({ id: 'v10_coral', name: 'Coral fragment', kind: 'animal', stack: 6, desc: 'A broken twig of reef coral, pink at the tips.', where: 'The reef (dive)', weight: 0.2,
  lab: { rp: 12, time: 4, text: 'Living polyps over a limestone skeleton, with algae inside every polyp feeding it sugar. A whole reef is built on that partnership.' } });
defineItem({ id: 'v10_kelpholdfast', name: 'Kelp holdfast', kind: 'plant', stack: 6, desc: 'The root-like grip of a giant kelp, full of tiny crabs and brittle stars.', where: 'The far coast', weight: 0.4,
  lab: { rp: 10, time: 3, text: 'Not a root at all: it only holds on. Inside it, a hundred animals live in a space the size of a fist.' } });

// ------------------------------------------------------------------ stage
export const boatStage = () => boatSave().stage;
export const boatStageName = (): BoatStageId => BOAT_STAGES[Math.max(0, Math.min(BOAT_STAGES.length - 1, boatStage()))];
/** she floats: boat travel is open */
export const boatReady = () => !!game.save.flags[BOAT_FLAG] || boatStage() >= 6;
/** the boat is somewhere the player can see it at camp (dug out, not away on a trip) */
export const boatAtCamp = () => boatStage() >= 1 && !away;
let away = false;
/** the trip scene marks the Kitten as away from the boatyard while she is out */
export function setBoatAway(on: boolean) { away = on; }
export const boatIsAway = () => away;

type StageFn = (stage: number, prev: number) => void;
const stageFns: StageFn[] = [];
/** hook: called whenever the boat reaches a new stage (the camp module can react, e.g. dialogue) */
export function onBoatStage(fn: StageFn) { stageFns.push(fn); }
export function setBoatStage(n: number) {
  const s = boatSave();
  if (n <= s.stage) return;
  const prev = s.stage;
  s.stage = n;
  if (n >= 6) game.save.flags[BOAT_FLAG] = true;
  game.persist();
  for (const f of stageFns) { try { f(n, prev); } catch (e) { console.error(e); } }
}

// ------------------------------------------------------------------ jobs (what each step needs)
export type JobId = 'patch' | 'ama' | 'sail' | 'rig';
export interface BoatJob { id: JobId; at: number; title: string; needs: [string, number][] }
export const BOAT_JOBS: Record<JobId, BoatJob> = {
  patch: { id: 'patch', at: 1, title: 'Patch the hull', needs: [['plank', 4], ['resin', 2], ['flaxleaf', 3]] },
  ama: { id: 'ama', at: 2, title: 'Lash on the outrigger', needs: [['wood', 4], ['flaxleaf', 3]] },
  sail: { id: 'sail', at: 4, title: 'Weave the sail', needs: [['flaxleaf', 6]] },
  rig: { id: 'rig', at: 4, title: 'Rig the mast and oars', needs: [['wood', 2], ['plank', 2]] },
};

export const given = (job: JobId, item: string) => boatSave().given[`${job}:${item}`] ?? 0;
/** handed in + carried, capped at the need */
export function haveFor(job: JobId, item: string): number {
  const need = BOAT_JOBS[job].needs.find(n => n[0] === item)?.[1] ?? 0;
  return Math.min(need, given(job, item) + count(item));
}
export const jobMaterialsDone = (job: JobId) => BOAT_JOBS[job].needs.every(([id, n]) => given(job, id) >= n);
/** what is still missing (after the hand-in), e.g. "2 Planks, 1 Kauri resin" */
export function jobMissing(job: JobId): string {
  const out: string[] = [];
  for (const [id, n] of BOAT_JOBS[job].needs) {
    const left = n - given(job, id);
    if (left > 0) out.push(`${left} ${ITEMS[id]?.name ?? id}`);
  }
  return out.join(', ');
}
/** short progress readout for prompts: "Planks 2/4 · Kauri resin 0/2" */
export function jobProgress(job: JobId): string {
  return BOAT_JOBS[job].needs.map(([id, n]) => `${ITEMS[id]?.name ?? id} ${Math.min(n, given(job, id))}/${n}`).join(' · ');
}
/** hand in whatever the backpack holds toward a job; returns [item, n] handed over */
export function handIn(job: JobId): [string, number][] {
  const s = boatSave();
  const out: [string, number][] = [];
  for (const [id, n] of BOAT_JOBS[job].needs) {
    const k = `${job}:${id}`;
    const left = n - (s.given[k] ?? 0);
    const can = Math.min(left, count(id));
    if (can <= 0) continue;
    remove(id, can);
    s.given[k] = (s.given[k] ?? 0) + can;
    out.push([id, can]);
  }
  if (out.length) game.persist();
  return out;
}

// ------------------------------------------------------------------ waits (overnight, or a long while)
const passed = (day: number, t: number) => day > 0 && (dayNumber() > day || boatSave().playT - t > CURE_FALLBACK);
/** the gum on the patched planks has set */
export const hullCured = () => boatStage() >= 3 || (boatStage() >= 2 && passed(boatSave().cureDay, boatSave().cureT));
export const sailWeaving = () => boatSave().sailDay > 0;
/** Aroha has finished weaving the sail */
export const sailReady = () => boatStage() >= 5 || (sailWeaving() && passed(boatSave().sailDay, boatSave().sailT));
export function startCure() { const s = boatSave(); s.cureDay = Math.max(1, dayNumber()); s.cureT = s.playT; game.persist(); }
export function startWeave() { const s = boatSave(); s.sailDay = Math.max(1, dayNumber()); s.sailT = s.playT; game.persist(); }

export const found = (k: 'tender' | 'outboard' | 'fuel' | 'log') => !!boatSave().found[k];
export function setFound(k: 'tender' | 'outboard' | 'fuel' | 'log') { boatSave().found[k] = true; game.persist(); }

/** the next thing to do on the boat, for prompts and the camp module (null once she has launched) */
export function nextBoatStep(): string | null {
  const st = boatStage();
  if (st === 0) return found('tender') ? 'Dig the Kitten out of the sand' : 'Find the Kittiwake’s tender';
  if (st === 1) return jobMaterialsDone('patch') ? 'Patch the hull' : `Patch the hull: ${jobMissing('patch')}`;
  if (st === 2) return !hullCured() ? 'Let the gum cure overnight' : !found('log') ? 'Find a log for the outrigger' : `Lash on the outrigger${jobMaterialsDone('ama') ? '' : ': ' + jobMissing('ama')}`;
  if (st === 3) return !found('outboard') ? 'Find the outboard in the wreck' : !found('fuel') ? 'Find fuel for the outboard' : !boatSave().motorFixed ? 'Fix the outboard with Jenna' : 'Mount the outboard';
  if (st === 4) return !sailWeaving() ? `Bring Aroha flax for the sail${jobMaterialsDone('sail') ? '' : ': ' + jobMissing('sail')}` : !sailReady() ? 'Aroha is weaving the sail' : `Rig the Kitten${jobMaterialsDone('rig') ? '' : ': ' + jobMissing('rig')}`;
  if (st === 5) return 'Launch the Kitten';
  return null;
}
