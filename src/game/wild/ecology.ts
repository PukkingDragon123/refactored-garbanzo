// Ecology: how every species perceives, feels, eats, moves, groups and talks.
// The Animal brain (animal.ts) is generic; this table is what makes each species behave differently.

import type { TimeOfDay } from '../../world/timeofday';

export type Medium = 'ground' | 'air' | 'trunk' | 'water' | 'burrow';
export type Loco = 'walker' | 'serpent' | 'flier' | 'glider' | 'climber' | 'swimmer' | 'hopper';
export type Food = 'fruit' | 'nectar' | 'leaves' | 'roots' | 'grub' | 'insect' | 'fish' | 'eggs' | 'carrion' | 'seeds';
export type Defense = 'flee' | 'hide' | 'burrow' | 'ball' | 'quills' | 'crest' | 'clatter' | 'charge' | 'dewlap' | 'mob' | 'dive' | 'freeze' | 'strike';
export type Call = 'callChirp' | 'callTrill' | 'callHoot' | 'callScreech' | 'callHiss' | 'callRattle' | 'callGrunt' | 'callBark' | 'callSqueak' | 'callGrowl' | 'callHonk' | 'callCroak' | 'callClick' | 'callWhale' | 'callPurr';

/** a behaviour the animal does when nothing urgent is happening */
export interface IdleAct {
  act: string;
  w: number;
  /** only at these times */
  when?: TimeOfDay[];
  /** needs a point of interest of this kind nearby */
  poi?: string;
  /** seconds [min, max] */
  dur?: [number, number];
}

export interface Eco {
  loco: Loco;
  /** preferred starting medium */
  medium: Medium;
  /** px/s */
  walk: number;
  run: number;
  /** 0..1 temperament */
  bold: number;
  aggro: number;
  curious: number;
  social: number;
  alert: number;
  /** senses */
  sight: number;
  hear: number;
  nocturnal?: boolean;
  /** distance at which a noticed player becomes a threat */
  flightDist: number;
  /** eats */
  food: Food[];
  /** species it hunts */
  prey?: string[];
  /** species it is afraid of */
  fears?: string[];
  /** species it mobs or attacks on sight */
  mobs?: string[];
  /** rivals: same-species displays */
  rival?: boolean;
  defense: Defense[];
  /** will attack the player when cornered/close */
  attacksPlayer?: number;
  group: [number, number];
  /** juveniles appear in groups */
  young?: number;
  calls: { contact?: Call; alarm?: Call; threat?: Call; song?: Call; songWhen?: TimeOfDay[] };
  idle: IdleAct[];
  /** act -> Field Guide behaviour key (species.ts behaviors) */
  photo: Record<string, string>;
  /** size class for fear of the player: small animals fear more */
  size: number;
}

const ALL: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
const DAY: TimeOfDay[] = ['dawn', 'day', 'dusk'];

export const ECO: Record<string, Eco> = {
  // ================================================================ SERPENTS
  strider: {
    loco: 'serpent', medium: 'ground', walk: 22, run: 70, bold: 0.55, aggro: 0.1, curious: 0.75, social: 0.2, alert: 0.6,
    sight: 150, hear: 1, flightDist: 60, food: ['grub', 'insect'], fears: ['galehawk', 'flicker', 'sprinter'], defense: ['flee', 'freeze'],
    group: [1, 2], calls: { alarm: 'callHiss' }, size: 2,
    idle: [
      { act: 'forage', w: 3, dur: [4, 9] }, { act: 'dig', w: 2, poi: 'soft', dur: [3, 6] }, { act: 'bask', w: 2, when: ['dawn', 'day'], poi: 'sun', dur: [6, 12] },
      { act: 'scent', w: 1.5, dur: [2, 4] }, { act: 'wander', w: 2 },
    ],
    photo: { forage: 'foraging', wander: 'foraging', dig: 'digging', bask: 'basking', scent: 'scenting', investigate: 'scenting' },
  },
  sprinter: {
    loco: 'serpent', medium: 'ground', walk: 30, run: 150, bold: 0.9, aggro: 0.8, curious: 0.3, social: 0, alert: 0.8,
    sight: 190, hear: 1.2, nocturnal: true, flightDist: 40, food: [], prey: ['delver', 'quillhog', 'strider', 'mossfrog'], fears: ['flicker'],
    defense: ['crest', 'strike'], attacksPlayer: 0.7, group: [1, 1], calls: { threat: 'callHiss' }, size: 3,
    idle: [{ act: 'wander', w: 2 }, { act: 'rest', w: 1.5, dur: [5, 10] }, { act: 'scent', w: 1, dur: [2, 4] }, { act: 'prowl', w: 2, dur: [5, 10] }],
    photo: { hunt: 'hunting', chase: 'running', flee: 'running', prowl: 'hunting', threat: 'threat', rest: 'resting', attack: 'running' },
  },
  skyribbon: {
    loco: 'glider', medium: 'trunk', walk: 16, run: 40, bold: 0.35, aggro: 0.1, curious: 0.3, social: 0.1, alert: 0.7,
    sight: 170, hear: 0.8, flightDist: 70, food: ['insect'], fears: ['galehawk', 'flicker'], defense: ['flee', 'freeze'],
    group: [1, 2], calls: {}, size: 2,
    idle: [{ act: 'coil', w: 3, poi: 'branch', dur: [6, 14] }, { act: 'hunt', w: 2 }, { act: 'glide', w: 2 }, { act: 'climb', w: 1 }],
    photo: { glide: 'gliding', coil: 'coiled', rest: 'coiled', hunt: 'hunting', eat: 'hunting' },
  },
  lurevip: {
    loco: 'serpent', medium: 'trunk', walk: 12, run: 60, bold: 0.8, aggro: 0.5, curious: 0.1, social: 0, alert: 0.4,
    sight: 120, hear: 0.6, nocturnal: true, flightDist: 30, food: [], prey: ['sailglider', 'mossfrog'], defense: ['strike', 'freeze'],
    attacksPlayer: 0.3, group: [1, 1], calls: { threat: 'callHiss' }, size: 3,
    idle: [{ act: 'lure', w: 5, poi: 'branch', dur: [10, 20] }, { act: 'coil', w: 2, dur: [6, 12] }],
    photo: { lure: 'luring', attack: 'striking', coil: 'coiled', rest: 'coiled', eat: 'striking' },
  },
  titan: {
    loco: 'serpent', medium: 'water', walk: 14, run: 55, bold: 1, aggro: 0.9, curious: 0.2, social: 0, alert: 0.5,
    sight: 240, hear: 1, flightDist: 0, food: [], prey: ['ironjaw', 'boneface', 'snakestork'], defense: ['strike'], attacksPlayer: 1,
    group: [1, 1], calls: { threat: 'callHiss' }, size: 6,
    idle: [{ act: 'ambush', w: 3, dur: [12, 25] }, { act: 'swim', w: 2 }, { act: 'rest', w: 1, dur: [10, 20] }],
    photo: { ambush: 'ambush', swim: 'swimming', hunt: 'hunting', attack: 'hunting', constrict: 'hunting', digest: 'digesting', rest: 'digesting' },
  },
  leviathan: {
    loco: 'swimmer', medium: 'water', walk: 30, run: 80, bold: 0.9, aggro: 0.1, curious: 0.8, social: 0, alert: 0.5,
    sight: 300, hear: 1, flightDist: 0, food: ['fish'], defense: ['dive'], group: [1, 1], calls: { contact: 'callWhale', song: 'callWhale', songWhen: ALL }, size: 7,
    idle: [{ act: 'swim', w: 3 }, { act: 'surface', w: 1.5, dur: [4, 7] }, { act: 'hunt', w: 1.5 }, { act: 'call', w: 0.6 }],
    photo: { swim: 'breathing', surface: 'surfacing', hunt: 'hunting', investigate: 'breathing', call: 'breathing' },
  },
  mudribbon: {
    loco: 'serpent', medium: 'water', walk: 20, run: 70, bold: 0.4, aggro: 0.2, curious: 0.4, social: 0.5, alert: 0.6,
    sight: 140, hear: 0.9, flightDist: 60, food: ['fish'], fears: ['snakestork', 'ironjaw', 'titan'], defense: ['flee', 'dive'],
    group: [1, 3], calls: {}, size: 2,
    idle: [{ act: 'swim', w: 3 }, { act: 'fish', w: 2, dur: [4, 8] }, { act: 'bask', w: 1, when: ['day'], poi: 'bank', dur: [5, 10] }],
    photo: { swim: 'swimming', fish: 'fishing', hunt: 'fishing', eat: 'fishing', flee: 'swimming' },
  },
  cragviper: {
    loco: 'serpent', medium: 'ground', walk: 16, run: 60, bold: 0.7, aggro: 0.5, curious: 0.2, social: 0, alert: 0.7,
    sight: 160, hear: 1, flightDist: 45, food: ['eggs'], fears: ['galehawk', 'flicker'], defense: ['strike', 'flee'], attacksPlayer: 0.35,
    group: [1, 1], calls: { threat: 'callHiss' }, size: 2,
    idle: [{ act: 'climb', w: 2 }, { act: 'raid', w: 2, poi: 'nest' }, { act: 'bask', w: 2, when: ['day', 'dusk'], poi: 'sun', dur: [6, 12] }, { act: 'wander', w: 1 }],
    photo: { climb: 'climbing', raid: 'raiding', eat: 'raiding', bask: 'basking', wander: 'climbing' },
  },
  // ================================================================ REPTILES & AMPHIBIANS
  ironjaw: {
    loco: 'walker', medium: 'water', walk: 14, run: 90, bold: 0.95, aggro: 0.9, curious: 0.2, social: 0.1, alert: 0.6,
    sight: 200, hear: 1, flightDist: 0, food: ['fish'], prey: ['snakestork', 'mudribbon', 'boneface'], fears: ['titan'], defense: ['strike'],
    attacksPlayer: 0.9, group: [1, 2], calls: { threat: 'callGrowl' }, size: 5,
    idle: [{ act: 'lurk', w: 3, dur: [10, 20] }, { act: 'bask', w: 2, when: ['day', 'dawn'], poi: 'bank', dur: [10, 20] }, { act: 'swim', w: 2 }],
    photo: { bask: 'basking', lurk: 'lurking', swim: 'swimming', attack: 'lunging', hunt: 'lurking' },
  },
  barkgecko: {
    loco: 'climber', medium: 'trunk', walk: 20, run: 80, bold: 0.4, aggro: 0.3, curious: 0.4, social: 0.3, alert: 0.7,
    sight: 120, hear: 0.8, flightDist: 45, food: ['insect'], fears: ['galehawk', 'skyribbon', 'flicker'], rival: true, defense: ['flee', 'dewlap', 'freeze'],
    group: [1, 3], calls: { contact: 'callClick', alarm: 'callClick' }, size: 1,
    idle: [{ act: 'cling', w: 3, dur: [4, 10] }, { act: 'hunt', w: 2 }, { act: 'climb', w: 2 }, { act: 'display', w: 1 }],
    photo: { display: 'display', threat: 'display', hunt: 'hunting', eat: 'hunting', cling: 'clinging', climb: 'clinging' },
  },
  pteramander: {
    loco: 'glider', medium: 'trunk', walk: 14, run: 40, bold: 0.3, aggro: 0, curious: 0.5, social: 0.4, alert: 0.6,
    sight: 120, hear: 0.8, flightDist: 55, food: ['insect'], fears: ['mudribbon', 'snakestork', 'hunterbat'], defense: ['flee', 'freeze'],
    group: [1, 3], calls: { contact: 'callSqueak' }, size: 1,
    idle: [{ act: 'cling', w: 2, dur: [4, 9] }, { act: 'glide', w: 3 }, { act: 'climb', w: 2 }, { act: 'hunt', w: 1 }],
    photo: { glide: 'gliding', climb: 'climbing', cling: 'climbing', hunt: 'hunting', eat: 'hunting' },
  },
  mossfrog: {
    loco: 'hopper', medium: 'ground', walk: 10, run: 60, bold: 0.3, aggro: 0, curious: 0.2, social: 0.6, alert: 0.6,
    sight: 100, hear: 1, nocturnal: true, flightDist: 40, food: ['insect'], fears: ['hunterbat', 'snakestork', 'sprinter'], defense: ['hide', 'freeze'],
    group: [2, 4], calls: { contact: 'callCroak', song: 'callCroak', songWhen: ['dusk', 'night'] }, size: 1,
    idle: [{ act: 'sit', w: 3, dur: [4, 9] }, { act: 'call', w: 2, when: ['dusk', 'night'] }, { act: 'hunt', w: 2 }, { act: 'hop', w: 1 }],
    photo: { call: 'calling', hunt: 'hunting', eat: 'hunting', hide: 'hiding', sit: 'hiding' },
  },
  // ================================================================ BIRDS
  galehawk: {
    loco: 'flier', medium: 'air', walk: 20, run: 160, bold: 0.7, aggro: 0.3, curious: 0.2, social: 0, alert: 0.9,
    sight: 320, hear: 0.8, flightDist: 90, food: [], prey: ['skyribbon', 'strider', 'delver', 'barkgecko'], defense: ['flee'],
    group: [1, 1], calls: { contact: 'callScreech', alarm: 'callScreech' }, size: 3,
    idle: [{ act: 'soar', w: 3, dur: [8, 16] }, { act: 'perch', w: 2, poi: 'perch', dur: [6, 14] }, { act: 'hunt', w: 2 }, { act: 'preen', w: 1, dur: [3, 6] }],
    photo: { soar: 'soaring', fly: 'soaring', dive: 'diving', attack: 'diving', carry: 'carrying', perch: 'perched', preen: 'perched', rest: 'perched' },
  },
  cragauk: {
    loco: 'flier', medium: 'ground', walk: 14, run: 110, bold: 0.45, aggro: 0.3, curious: 0.3, social: 0.9, alert: 0.7,
    sight: 180, hear: 1, flightDist: 60, food: ['fish'], fears: ['galehawk'], mobs: ['cragviper'], defense: ['flee', 'mob'],
    group: [3, 6], calls: { contact: 'callTrill', alarm: 'callTrill', song: 'callTrill', songWhen: ['dawn'] }, size: 1,
    idle: [{ act: 'nest', w: 3, poi: 'nest', dur: [6, 14] }, { act: 'fish', w: 2, poi: 'water' }, { act: 'display', w: 1, dur: [2, 4] }, { act: 'fly', w: 1 }],
    photo: { nest: 'nesting', fish: 'diving', dive: 'diving', display: 'display', fly: 'flying', flee: 'flying', mob: 'flying' },
  },
  torrentdipper: {
    loco: 'flier', medium: 'ground', walk: 18, run: 120, bold: 0.4, aggro: 0, curious: 0.3, social: 0.3, alert: 0.7,
    sight: 150, hear: 0.7, flightDist: 55, food: ['insect', 'grub'], fears: ['galehawk'], defense: ['flee', 'dive'],
    group: [1, 2], calls: { contact: 'callChirp', alarm: 'callChirp', song: 'callChirp', songWhen: ['dawn', 'day'] }, size: 1,
    idle: [{ act: 'bob', w: 3, poi: 'rock', dur: [3, 7] }, { act: 'fish', w: 3, poi: 'water' }, { act: 'fly', w: 1 }],
    photo: { bob: 'bobbing', fish: 'diving', dive: 'diving', swim: 'diving', fly: 'flying', flee: 'flying' },
  },
  snakestork: {
    loco: 'flier', medium: 'ground', walk: 12, run: 100, bold: 0.7, aggro: 0.5, curious: 0.2, social: 0.3, alert: 0.7,
    sight: 220, hear: 0.9, flightDist: 80, food: ['fish'], prey: ['mudribbon', 'mossfrog'], fears: ['ironjaw', 'titan'], rival: true,
    defense: ['clatter', 'flee'], group: [1, 2], calls: { contact: 'callHonk', threat: 'callHonk' }, size: 4,
    idle: [{ act: 'stalk', w: 3, poi: 'shallows', dur: [8, 16] }, { act: 'rest', w: 1, dur: [5, 10] }, { act: 'display', w: 0.6 }, { act: 'preen', w: 1, dur: [3, 6] }],
    photo: { stalk: 'stalking', hunt: 'stalking', attack: 'catching', eat: 'catching', display: 'display', threat: 'display', fly: 'flying', flee: 'flying' },
  },
  monarch: {
    loco: 'flier', medium: 'air', walk: 12, run: 90, bold: 0.8, aggro: 0.2, curious: 0.4, social: 0.2, alert: 0.6,
    sight: 400, hear: 0.6, flightDist: 110, food: ['carrion'], defense: ['flee'], group: [1, 2], calls: { contact: 'callScreech' }, size: 5,
    idle: [{ act: 'soar', w: 4, dur: [12, 24] }, { act: 'feed', w: 1, poi: 'carrion', dur: [8, 14] }, { act: 'perch', w: 1, poi: 'perch', dur: [6, 12] }],
    photo: { soar: 'soaring', fly: 'soaring', feed: 'feeding', eat: 'feeding', perch: 'soaring' },
  },
  nutcracker: {
    loco: 'flier', medium: 'ground', walk: 16, run: 110, bold: 0.35, aggro: 0.1, curious: 0.5, social: 1, alert: 0.8,
    sight: 180, hear: 1, flightDist: 60, food: ['fruit', 'seeds'], fears: ['galehawk', 'skyribbon', 'lurevip', 'sprinter'], defense: ['flee'],
    group: [3, 7], calls: { contact: 'callChirp', alarm: 'callBark', song: 'callTrill', songWhen: ['dawn', 'day'] }, size: 1,
    idle: [{ act: 'forage', w: 3, dur: [4, 8] }, { act: 'crack', w: 2, poi: 'fruit', dur: [3, 6] }, { act: 'sentinel', w: 1, dur: [4, 8] }, { act: 'hop', w: 1 }],
    photo: { crack: 'cracking', eat: 'cracking', forage: 'flocking', sentinel: 'sentinel', alert: 'sentinel', fly: 'flocking', flee: 'flocking', hop: 'flocking' },
  },
  // ================================================================ MAMMALS
  shieldback: {
    loco: 'walker', medium: 'ground', walk: 12, run: 40, bold: 0.5, aggro: 0, curious: 0.4, social: 0.3, alert: 0.4,
    sight: 90, hear: 1.1, flightDist: 45, food: ['insect', 'grub'], fears: ['sprinter', 'titan'], defense: ['ball'],
    group: [1, 2], young: 0.3, calls: { contact: 'callGrunt' }, size: 2,
    idle: [{ act: 'forage', w: 3, dur: [5, 10] }, { act: 'dig', w: 2, poi: 'soft', dur: [3, 6] }, { act: 'rest', w: 1, dur: [4, 8] }, { act: 'wander', w: 1 }],
    photo: { forage: 'foraging', dig: 'digging', ball: 'rolled', hide: 'rolled', wander: 'foraging', eat: 'foraging' },
  },
  quillhog: {
    loco: 'walker', medium: 'ground', walk: 14, run: 45, bold: 0.6, aggro: 0.4, curious: 0.4, social: 0.3, alert: 0.5,
    sight: 90, hear: 1, nocturnal: true, flightDist: 40, food: ['fruit'], fears: ['sprinter'], defense: ['quills'], attacksPlayer: 0.2,
    group: [1, 2], young: 0.25, calls: { threat: 'callRattle', contact: 'callGrunt' }, size: 2,
    idle: [{ act: 'forage', w: 3, dur: [5, 10] }, { act: 'eat', w: 2, poi: 'fruit', dur: [4, 8] }, { act: 'groom', w: 1, dur: [3, 5] }, { act: 'wander', w: 1 }],
    photo: { forage: 'foraging', eat: 'eating', threat: 'quills', wander: 'foraging' },
  },
  delver: {
    loco: 'walker', medium: 'ground', walk: 16, run: 70, bold: 0.2, aggro: 0, curious: 0.5, social: 1, alert: 0.9,
    sight: 160, hear: 1.2, flightDist: 80, food: ['roots'], fears: ['sprinter', 'galehawk', 'strider', 'hunterbat'], defense: ['burrow'],
    group: [3, 6], young: 0.35, calls: { contact: 'callSqueak', alarm: 'callBark' }, size: 1,
    idle: [{ act: 'eat', w: 3, dur: [3, 7] }, { act: 'dig', w: 2, dur: [3, 6] }, { act: 'sentinel', w: 2, dur: [5, 10] }, { act: 'play', w: 1 }, { act: 'groom', w: 1, dur: [3, 5] }],
    photo: { sentinel: 'peeking', alert: 'peeking', dig: 'digging', eat: 'eating', peek: 'peeking' },
  },
  sailglider: {
    loco: 'glider', medium: 'trunk', walk: 16, run: 50, bold: 0.35, aggro: 0, curious: 0.6, social: 0.8, alert: 0.6,
    sight: 140, hear: 1, nocturnal: true, flightDist: 60, food: ['nectar', 'fruit'], fears: ['lurevip', 'galehawk', 'hunterbat'], defense: ['flee', 'freeze'],
    group: [2, 4], young: 0.2, calls: { contact: 'callSqueak', alarm: 'callSqueak' }, size: 1,
    idle: [{ act: 'feed', w: 3, poi: 'flower', dur: [4, 9] }, { act: 'glide', w: 3 }, { act: 'groom', w: 1.5, dur: [3, 6] }, { act: 'climb', w: 1 }],
    photo: { glide: 'gliding', feed: 'feeding', eat: 'feeding', groom: 'grooming' },
  },
  flicker: {
    loco: 'walker', medium: 'ground', walk: 30, run: 170, bold: 0.9, aggro: 0.7, curious: 0.7, social: 0.2, alert: 0.9,
    sight: 200, hear: 1.2, flightDist: 70, food: [], prey: ['strider', 'cragviper', 'skyribbon', 'barkgecko', 'mudribbon'], defense: ['flee'],
    group: [1, 2], calls: { contact: 'callChirp', threat: 'callGrowl' }, size: 2,
    idle: [{ act: 'prowl', w: 3, dur: [4, 8] }, { act: 'sentinel', w: 1.5, dur: [2, 4] }, { act: 'leap', w: 1.5 }, { act: 'wander', w: 1 }],
    photo: { prowl: 'alert', sentinel: 'alert', alert: 'alert', leap: 'leaping', flee: 'leaping', fight: 'fighting', attack: 'fighting', hunt: 'alert' },
  },
  boneface: {
    loco: 'walker', medium: 'ground', walk: 10, run: 70, bold: 0.7, aggro: 0.5, curious: 0.3, social: 0.9, alert: 0.5,
    sight: 140, hear: 1, flightDist: 70, food: ['leaves', 'fruit'], fears: ['titan', 'ironjaw'], defense: ['charge', 'flee'], attacksPlayer: 0.6,
    group: [2, 4], young: 0.5, calls: { contact: 'callGrunt', alarm: 'callBark', threat: 'callGrowl' }, size: 5,
    idle: [{ act: 'browse', w: 3, poi: 'leaves', dur: [6, 12] }, { act: 'wander', w: 2 }, { act: 'wallow', w: 1, poi: 'mud', dur: [6, 10] }, { act: 'play', w: 1 }, { act: 'rest', w: 1, dur: [5, 10] }],
    photo: { browse: 'browsing', eat: 'browsing', charge: 'charging', attack: 'charging', threat: 'charging', play: 'playing', wallow: 'wallowing' },
  },
  hunterbat: {
    loco: 'flier', medium: 'trunk', walk: 12, run: 120, bold: 0.6, aggro: 0.4, curious: 0.5, social: 0.2, alert: 0.7,
    sight: 160, hear: 1.6, nocturnal: true, flightDist: 60, food: ['insect'], prey: ['mossfrog', 'delver', 'pteramander'], defense: ['flee'],
    group: [1, 2], calls: { contact: 'callClick', threat: 'callScreech' }, size: 2,
    idle: [{ act: 'hang', w: 2, poi: 'branch', dur: [6, 12] }, { act: 'hunt', w: 3 }, { act: 'fly', w: 2 }],
    photo: { hang: 'hanging', rest: 'hanging', hunt: 'hunting', attack: 'hunting', eat: 'hunting', fly: 'flying', flee: 'flying' },
  },
};

export const SPECIES_TIMES_ALL = ALL;
export const SPECIES_TIMES_DAY = DAY;

/** Is `a` a predator of `b`? */
export function hunts(a: string, b: string) {
  return !!ECO[a]?.prey?.includes(b);
}
/** Does `a` fear `b`? */
export function fears(a: string, b: string) {
  return !!ECO[a]?.fears?.includes(b) || hunts(b, a);
}
