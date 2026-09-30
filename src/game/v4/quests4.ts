// V4 story quests: Day 1 aboard the Kittiwake, the storm, the island and making camp.

import type { QuestDef } from '../quests';
import { game } from '../game';

const f = (k: string) => () => !!game.save.flags[k];
const v = (k: string) => game.save.vars[k] ?? 0;
const n = (k: string, max: number) => (): [number, number] => [Math.min(max, v(k)), max];

export const V4_QUESTS: QuestDef[] = [
  {
    id: 'v4morning', title: 'Rise and Shine', giver: 'story', main: true, chapter: 1,
    desc: 'Another morning aboard the Kittiwake. Breakfast first, then the rounds, then the report nobody else is going to write.',
    steps: [
      { text: 'Make instant noodles in the galley', done: f('v4:noodles'), hint: 'The galley is right next door to the bunk room, below deck.' },
      { text: 'Eat breakfast at the mess table', done: f('v4:ate') },
      { text: 'Do the morning rounds', done: () => v('v4:rounds') >= 4, progress: n('v4:rounds', 4), hint: 'Feed the fish in the hold, check the engine gauges, say morning to Jenna at her bench in the engine room and to Joshu up in the wheelhouse.' },
      { text: 'Write the morning report on your laptop', done: f('v4:report'), hint: 'Your laptop is on your bunk.' },
    ],
    next: 'v4engine',
  },
  {
    id: 'v4engine', title: 'Engine Trouble', giver: 'jenna', main: true, chapter: 1,
    desc: 'Jenna is yelling from the engine room and the engine has gone very quiet.',
    steps: [
      { text: 'Run to the engine room', done: f('v4:engineArrive') },
      { text: 'Fix the engine with Jenna', done: f('v4:engineFixed') },
    ],
    next: 'v4deck',
  },
  {
    id: 'v4deck', title: 'A Day at Sea', giver: 'joshu', main: true, chapter: 1,
    desc: 'The engine is purring again. Joshu says take the afternoon: photograph whatever is out there and catch something for dinner.',
    steps: [
      { text: 'Photograph wildlife from the deck', done: () => v('v4:photoSpecies') >= 3, progress: n('v4:photoSpecies', 3), hint: 'Q raises the camera. Seabirds circle the mast; watch the water off the bow.' },
      { text: 'Catch a fish at the stern', done: () => v('v4:fishCaught') >= 1, hint: 'The rods are at the stern rail.' },
      { text: 'Study your catch in the hold tank, or give it to Joshu to cook', done: f('v4:fishUsed') },
    ],
    next: 'v4storm',
  },
  {
    id: 'v4storm', title: 'Something Big', giver: 'story', main: true, chapter: 1,
    desc: 'Something massive hit the hull. The sky went black in minutes. And Chunk is nowhere to be seen.',
    steps: [
      { text: 'Find Chunk!', done: f('v4:chunkFound'), hint: 'He hates thunder. He hides somewhere small and dark.' },
      { text: 'Get Chunk up to the wheelhouse', done: f('v4:bridge') },
    ],
  },
  {
    id: 'v4shore', title: 'Washed Ashore', giver: 'story', main: true, chapter: 2,
    desc: 'Sand. Sun. The Kittiwake broken on the rocks. Where is everyone?',
    steps: [
      { text: 'Wake Jenna', done: f('v4:jennaAwake'), hint: 'That was pink hair down the beach, to the east.' },
      { text: 'Search the wreck for Chunk', done: f('v4:chunkWreck'), hint: 'Climb in through the hole in the hull. If Chunk is anywhere, he is near food.' },
      { text: 'Split up to search for Joshu', done: f('v4:split') },
    ],
    next: 'v4joshu',
  },
  {
    id: 'v4joshu', title: 'Where is Joshu?', giver: 'jenna', main: true, chapter: 2,
    desc: 'Jenna is searching the wreck. You and Chunk take the shoreline east.',
    steps: [
      { text: 'Follow Joshu’s tracks along the shore', done: f('v4:sealDone'), hint: 'Big boot prints, dragging the left foot. Head east.' },
      { text: 'Look for signs of Joshu', done: f('v4:shoes'), hint: 'Through the sea cave and into the cove.' },
      { text: 'Follow the trail into the bush', done: f('v4:joshuFound') },
      { text: 'Wake Joshu', done: f('v4:joshuAwake'), hint: 'Check on him, then cold creek water. Chunk also has his methods.' },
    ],
    next: 'v4return',
  },
  {
    id: 'v4return', title: 'The Long Walk Back', giver: 'joshu', main: true, chapter: 2,
    desc: 'Joshu is bruised but upright, and he will not stop teaching. Gather what you need on the way back to the wreck.',
    steps: [
      { text: 'Collect driftwood above the tide line', done: () => v('v4:wood') >= 3, progress: n('v4:wood', 3) },
      { text: 'Gather harakeke (flax) or kawakawa', done: () => v('v4:plants') >= 2, progress: n('v4:plants', 2) },
      { text: 'Find food: mussels and pipi', done: () => v('v4:food') >= 2, progress: n('v4:food', 2) },
      { text: 'Find a useful stone', done: () => v('v4:minerals') >= 1, progress: n('v4:minerals', 1) },
      { text: 'Photograph island wildlife', done: () => v('v4:islePhotos') >= 2, progress: n('v4:islePhotos', 2), hint: 'Q raises the camera. Crabs, shorebirds, skinks, the seal...' },
      { text: 'Get back to the wreck', done: f('v4:back') },
    ],
    next: 'v4aroha',
  },
  {
    id: 'v4aroha', title: 'The Dognapper', giver: 'story', main: true, chapter: 2,
    desc: 'Jenna is screaming. Someone is trying to carry Chunk away.',
    steps: [
      { text: 'Talk her down', done: f('v4:arohaJoined') },
    ],
    next: 'v4camp',
  },
  {
    id: 'v4camp', title: 'Day One', giver: 'aroha', main: true, chapter: 3,
    desc: 'Four castaways and a pug. Before dark: shelter, fire, food and somewhere warm for Chunk.',
    steps: [
      { text: 'Build the camp together', done: () => v('v4:campJobs') >= 6, progress: n('v4:campJobs', 6), hint: 'Firewood, supplies from the salvage pile, the tent, your research table, the drying rack, and a bed for Chunk.' },
      { text: 'Have dinner around the fire', done: f('v4:dinner') },
      { text: 'Tidy up and get some sleep', done: f('v4:day1'), hint: 'Your sleeping bag is by the fire.' },
    ],
  },
];
