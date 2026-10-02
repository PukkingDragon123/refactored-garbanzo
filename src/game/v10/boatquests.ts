// V10 quests: making the Kittiwake's tender seaworthy (see boat.ts for the rules, boatyard.ts for the
// camp side). Five short chapters, each started by the one before: The Kitten (dig her out and patch
// the hull), Waka Ama (Aroha's outrigger), The Outboard (Jenna rebuilds the motor), Sail and Oars
// (a woven harakeke sail, a mast and oars) and Launch Day.

import type { QuestDef } from '../quests';
import { boatStage, boatSave, found, haveFor, hullCured, sailReady, sailWeaving, BOAT_JOBS, JobId } from './boat';

const need = (job: JobId, item: string) => BOAT_JOBS[job].needs.find(n => n[0] === item)?.[1] ?? 0;
/** a material step: done once enough is handed in or carried (or the job is past) */
const mat = (job: JobId, item: string, doneAt: number, text: string, hint: string) => ({
  text, hint,
  done: () => boatStage() >= doneAt || haveFor(job, item) >= need(job, item),
  progress: (): [number, number] => [boatStage() >= doneAt ? need(job, item) : haveFor(job, item), need(job, item)],
});

export const BOAT_QUESTS: QuestDef[] = [
  {
    id: 'v10kitten', title: 'The Kitten', giver: 'joshu', main: true,
    desc: 'The Kittiwake will never sail again. But her tender, the Kitten, was torn off the stern crane by the wave, and Joshu swears she was built to outlive him.',
    steps: [
      { text: 'Look for the Kittiwake’s tender', done: () => found('tender') || boatStage() >= 1, hint: 'Joshu saw her go over the wreck. Search the beach east of the torn bow.' },
      { text: 'Dig her out and haul her to the boatyard', done: () => boatStage() >= 1, hint: 'She is upside down in the sand past the wreck. The boatyard is on the dry sand between the wreck and camp.' },
      mat('patch', 'plank', 2, 'Salvage planks from the wreck', 'Loose planking in the wreck’s galley, on the torn bow and washed up along the beach.'),
      mat('patch', 'resin', 2, 'Collect kauri gum on the bush track', 'The big kauri up the bush track bleed golden gum. Cut it free with your knife.'),
      mat('patch', 'flaxleaf', 2, 'Cut harakeke (flax) for the lashings', 'Flax grows by the stream. Cut the outer leaves with your knife.'),
      { text: 'Patch the hull with Aroha', done: () => boatStage() >= 2, hint: 'Hand the materials over at the Kitten.' },
      { text: 'Let the gum cure overnight', done: () => hullCured(), hint: 'Kauri gum needs a night to set hard (or a very long afternoon in the sun).' },
    ],
    reward: { rp: 40, text: 'The Kitten has a watertight hull again.' },
    next: 'v10ama',
  },
  {
    id: 'v10ama', title: 'Waka Ama', giver: 'aroha', main: true,
    desc: 'Aroha: “That little boat will roll over in the first big swell. My people crossed oceans on canoes with a float on one side. We give her an ama.”',
    steps: [
      { text: 'Bring back a straight log for the float', done: () => found('log'), hint: 'Aroha saw a long, straight tōtara log washed up in the hidden cove, past the sea cave.' },
      mat('ama', 'wood', 3, 'Collect driftwood for the booms', 'Bleached driftwood lies all along the beach.'),
      mat('ama', 'flaxleaf', 3, 'Cut more harakeke for the lashings', 'Flax grows by the stream.'),
      { text: 'Lash on the outrigger with Aroha', done: () => boatStage() >= 3, hint: 'At the Kitten.' },
    ],
    reward: { rp: 40, text: 'Float, booms and lashings: the Kitten is a waka ama now.' },
    next: 'v10motor',
  },
  {
    id: 'v10motor', title: 'The Outboard', giver: 'jenna', main: true,
    desc: 'Jenna: “The Kitten had an outboard! It lived in the engine room, because SOMEONE didn’t trust it on the crane in bad weather. Dad.”',
    steps: [
      { text: 'Find the Kitten’s outboard in the wreck', done: () => found('outboard'), hint: 'Jenna’s workbench in the engine room, at the stern end of the wreck. Climb in through the hole in the hull.' },
      { text: 'Find fuel for it', done: () => found('fuel'), hint: 'Two-stroke mix in a red jerry can. Jenna kept it in the engine room locker.' },
      { text: 'Fix the outboard with Jenna', done: () => boatSave().motorFixed || boatStage() >= 4, hint: 'Jenna is waiting at the Kitten.' },
      { text: 'Mount it on the transom', done: () => boatStage() >= 4, hint: 'At the Kitten.' },
    ],
    reward: { rp: 50, text: 'Putt-putt-putt. The outboard lives.' },
    next: 'v10sail',
  },
  {
    id: 'v10sail', title: 'Sail and Oars', giver: 'aroha', main: true,
    desc: 'Motors run out of fuel. Wind doesn’t. Aroha will weave a sail the way her nan taught her, if someone fetches the harakeke.',
    steps: [
      { text: 'Bring Aroha harakeke for the sail', done: () => sailWeaving() || boatStage() >= 5, progress: () => [sailWeaving() || boatStage() >= 5 ? 6 : haveFor('sail', 'flaxleaf'), 6], hint: 'Six long flax leaves. Hand them over at the Kitten.' },
      { text: 'Let Aroha weave the sail overnight', done: () => sailReady(), hint: 'Weaving takes a night (or a long afternoon). Go exploring.' },
      mat('rig', 'wood', 5, 'Find driftwood for a mast and boom', 'Two straight lengths of driftwood.'),
      mat('rig', 'plank', 5, 'Salvage planks for a pair of oars', 'More loose planking from the wreck.'),
      { text: 'Rig the Kitten', done: () => boatStage() >= 5, hint: 'At the Kitten.' },
    ],
    reward: { rp: 40, text: 'Mast stepped, sail bent on, oars in the boat.' },
    next: 'v10launch',
  },
  {
    id: 'v10launch', title: 'Launch Day', giver: 'story', main: true,
    desc: 'Everyone down to the water. Jenna has made a flag.',
    steps: [
      { text: 'Launch the Kitten', done: () => boatStage() >= 6, hint: 'At the Kitten, at the boatyard.' },
    ],
    reward: { rp: 100, text: 'She floats! The Region Map now shows places across the water.' },
  },
];
