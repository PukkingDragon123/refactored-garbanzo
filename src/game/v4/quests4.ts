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
      { text: 'Grab your field kit from your bunk in the wreck', done: () => !!game.save.flags['v9:kit'] || !!game.save.flags['v4:chunkWreck'], hint: 'Climb in through the hole in the hull. It is pitch dark in there: your headlamp is in your bunk.' },
      { text: 'Search the wreck for Chunk', done: f('v4:chunkWreck'), hint: 'Something is crunching in the dark at the back of the hold. If Chunk is anywhere, he is near food.' },
      { text: 'Split up to search for Joshu', done: f('v4:split') },
    ],
    next: 'v4joshu',
  },
  {
    id: 'v4joshu', title: 'Where is Joshu?', giver: 'jenna', main: true, chapter: 2,
    desc: 'Jenna is searching the wreck. You and Chunk take the shoreline east.',
    steps: [
      { text: 'Follow Joshu’s tracks along the shore', done: f('v4:sealDone'), hint: 'Big boot prints, dragging the left foot. Head east (Chunk knows the way). The binoculars help from the stream mouth.' },
      { text: 'Look for signs of Joshu', done: f('v4:shoes'), hint: 'Through the sea cave and into the cove.' },
      { text: 'Follow the trail into the bush', done: f('v4:joshuFound'), hint: 'Bare footprints and scraps of navy cloth up the bush track. From the cove, the binoculars can see a long way up.' },
      { text: 'Wake Joshu', done: f('v4:joshuAwake'), hint: 'Check on him, then cold creek water. Chunk also has his methods.' },
    ],
    next: 'v4return',
  },
  {
    id: 'v4return', title: 'The Long Walk Back', giver: 'joshu', main: true, chapter: 2,
    desc: 'Joshu is bruised but upright, and he will not stop teaching. Gather what you need on the way back to the wreck.',
    steps: [
      { text: 'Collect driftwood above the tide line', done: () => v('v4:wood') >= 3, progress: n('v4:wood', 3), hint: 'Bleached branches along the sand. The gold marker shows the nearest one.' },
      { text: 'Gather harakeke (flax) or kawakawa', done: () => v('v4:plants') >= 2, progress: n('v4:plants', 2), hint: 'Flax by the stream (your knife), kawakawa in the grove and by the stream.' },
      { text: 'Find food: mussels and pipi', done: () => v('v4:food') >= 2, progress: n('v4:food', 2), hint: 'Mussels on the grove rocks; dig with your trowel where little breathing holes dot the wet sand.' },
      { text: 'Find a useful stone', done: () => v('v4:minerals') >= 1, progress: n('v4:minerals', 1), hint: 'Flint in the stream bed, a good flat stone, or that odd warm one in the grove.' },
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

  // ------------------------------------------------------------ V9 island side quests
  {
    id: 'v9jenna', title: 'Pics or It Didn’t Happen', giver: 'jenna', main: false,
    desc: 'Jenna wants photos of whatever is alive on this island. Specifically a glass crab, and specifically whatever is snoring down the beach.',
    steps: [
      { text: 'Photograph a glass crab', done: () => !!game.save.flags['v4:photo:glasscrab'] || !!game.save.flags['v9:shot:glasscrab'], hint: 'Tiny see-through crabs on the wet sand. Creep up (hold S) or they bolt into their burrows.' },
      { text: 'Photograph the big snoring thing', done: () => !!game.save.flags['v4:photo:corvexseal'] || !!game.save.flags['v9:shot:corvexseal'], hint: 'Down the beach, past the stream. Quietly.' },
    ],
    reward: { rp: 25, text: 'Jenna: “That’s not a seal. That’s a SOFA with TEETH.”' },
  },
  {
    id: 'v9shells', title: 'Beachcomber', giver: 'mori', main: false,
    desc: 'Every beach keeps a collection. This one has shells nobody has catalogued.',
    steps: [
      { text: 'Find 5 kinds of shell', done: () => shellKinds() >= 5, progress: () => [Math.min(5, shellKinds()), 5], hint: 'Sunwhorls half-buried on the sand, fanshells on the tide line, tiger cones dug from the wet sand (trowel), opal ears in rock pools, and a Trycop crab’s moult on the seal rocks.' },
    ],
    reward: { rp: 30, text: 'A complete shell collection, labelled in Jenna’s colour code.' },
  },
  {
    id: 'v9notes', title: 'Field Notes', giver: 'mori', main: false,
    desc: 'The laptop survived. Every animal on this island is a page nobody has written yet: photograph it, then upload that photo to research it.',
    steps: [
      { text: 'Photograph 6 island species', done: () => islePhotos() >= 6, progress: () => [Math.min(6, islePhotos()), 6], hint: 'Q raises the camera. Crabs, shorebirds, skinks, the seal, the glowworms in the cave...' },
      { text: 'Upload the photos to your laptop', done: () => isleUploads() >= 6, progress: () => [Math.min(6, isleUploads()), 6], hint: 'Open the laptop and upload each species’ photo to research it.' },
    ],
    reward: { rp: 60, text: 'Six new pages in the field guide. Probably the first ever written.' },
  },
];

/** kinds of shell found (forage.ts sets v9:found:<item> on the first find) */
const shellKinds = () => ['shell_sunwhorl', 'shell_fan', 'shell_cone', 'shell_opal', 'shell_trycop'].filter(id => game.save.flags['v9:found:' + id] || game.save.inv.some(s => s.id === id)).length;
/** species photographed on the island (first photos, see shorelife.ts) */
function islePhotos() { return Object.keys(game.save.flags).filter(k => k.startsWith('v4:photo:')).length; }
/** island species uploaded on the laptop (the research app marks them in save.seen, or with v9:upload:<id>) */
function isleUploads() {
  const f = game.save.flags, sp = Object.keys(f).filter(k => k.startsWith('v4:photo:')).map(k => k.slice(9));
  const extra = Object.keys(f).filter(k => k.startsWith('v9:upload:') && f[k]).map(k => k.slice(10));
  return new Set([...sp.filter(id => game.save.seen[id] || f['v9:upload:' + id]), ...extra]).size;
}
