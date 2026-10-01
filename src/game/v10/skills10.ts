// V10 skill tree: Data Analysis, Camera, Research, Field Skills, bought with Research Points.
// The tree is plain data (SKILL_TREE10, BRANCHES10) for the MoriOS skill-tree UI; what is owned lives
// in the 'skills10' save bucket. Gameplay never reads the tree directly: it reads the fx10 getters,
// which turn the owned skills into numbers (the base values are what an untrained Mori gets).

import { game } from '../game';
import { bucket } from './store';
import { perks, hasSkill } from '../skills';

export type Branch10 = 'data' | 'camera' | 'research' | 'field';
export interface Skill10 {
  id: string;
  branch: Branch10;
  name: string;
  /** Research Points */
  cost: number;
  /** all of these must be owned first */
  req: string[];
  /** row in the branch, 1 = the root */
  tier: number;
  desc: string;
  /** short effect line for the node */
  effect: string;
  /** column in the branch (-1, 0, 1), for laying the tree out */
  lane?: number;
  /** icon name for skillIconURL() (a skill glyph or an item id) */
  icon?: string;
}

export const BRANCHES10: { id: Branch10; name: string; color: string; blurb: string; icon: string }[] = [
  { id: 'data', name: 'Data Analysis', color: '#9b7ce0', icon: 'chart', blurb: 'Squeeze more out of every discovery: deeper research sheets, the links between species, more RP from the agency.' },
  { id: 'camera', name: 'Camera', color: '#f4b43c', icon: 'lens', blurb: 'A steadier grip, faster film, longer lenses. Research photos come quicker and cleaner.' },
  { id: 'research', name: 'Research', color: '#3fbca6', icon: 'photoid', blurb: 'Identify animals from worse photos, tag them automatically, analyse samples faster, know your forage.' },
  { id: 'field', name: 'Field Skills', color: '#8db34a', icon: 'boot', blurb: 'Go further on the same energy: lighter steps, a bigger pack, easier climbs and swims, an iron stomach.' },
];

export const SKILL_TREE10: Skill10[] = [
  // ------------------------------------------------------------ camera
  { id: 'cam_grip', branch: 'camera', tier: 1, lane: 0, cost: 40, req: [], icon: 'hand', name: 'Steady Grip', effect: 'Capture hold 5 s → 4 s',
    desc: 'Elbows in, weight on both feet, breathe out. The steadiness ring fills a second sooner.' },
  { id: 'cam_film', branch: 'camera', tier: 2, lane: -1, cost: 70, req: ['cam_grip'], icon: 'card', name: 'Film Satchel', effect: '+8 shots per trip',
    desc: 'A waxed canvas satchel of spare film cartridges, dry even in the rain.' },
  { id: 'cam_dev1', branch: 'camera', tier: 2, lane: 1, cost: 80, req: ['cam_grip'], icon: 'clock', name: 'Warm Developer', effect: 'Developing 20 s → 12 s',
    desc: 'Keep the developer warm in an inside pocket and the prints come up much faster.' },
  { id: 'cam_zoom', branch: 'camera', tier: 3, lane: -1, cost: 130, req: ['cam_film'], icon: 'lens', name: 'Telephoto Lens', effect: 'Zoom ×3.4 · +4 shots',
    desc: 'A long lens from the Kittiwake’s locker. Frame shy animals from much further away.' },
  { id: 'cam_stab', branch: 'camera', tier: 3, lane: 0, cost: 150, req: ['cam_film', 'cam_dev1'], icon: 'stab', name: 'Stabiliser', effect: 'Shake −40% · hold 3 s · track slowly',
    desc: 'In-body stabilisation. Hands shake less, the hold drops to 3 s, and slow panning after an animal keeps the ring filling.' },
  { id: 'cam_video', branch: 'camera', tier: 3, lane: 1, cost: 110, req: ['cam_dev1'], icon: 'video', name: 'Video Mode', effect: 'Record clips (V)',
    desc: 'Record behaviour as video. Some findings can only be proven on film.' },
  { id: 'cam_instant', branch: 'camera', tier: 4, lane: 0, cost: 280, req: ['cam_stab'], icon: 'shutter', name: 'Instant Film', effect: 'Developing → 5 s · hold → 2 s',
    desc: 'Fast instant stock and a hair trigger: the shot is in, dry and in your pocket while the animal is still there.' },

  // ------------------------------------------------------------ data analysis
  { id: 'data_notes', branch: 'data', tier: 1, lane: 0, cost: 40, req: [], icon: 'chart', name: 'Field Notes', effect: 'Research sheets: 3 sections per upload',
    desc: 'Proper notes with every photo: date, place, weather, behaviour. Each upload fills in more of a research sheet.' },
  { id: 'data_web', branch: 'data', tier: 2, lane: -1, cost: 80, req: ['data_notes'], icon: 'track', name: 'Food-Web Mapping', effect: 'Reveal ecosystem links',
    desc: 'Who eats whom, who pollinates what, who lives in whose burrow. Uploads draw the links between species.' },
  { id: 'data_grant', branch: 'data', tier: 2, lane: 1, cost: 90, req: ['data_notes'], icon: 'grant', name: 'Grant Writing', effect: '+15% RP from the agency',
    desc: 'Same data, better story. The agency pays more for research that reads well.' },
  { id: 'data_ethology', branch: 'data', tier: 3, lane: -1, cost: 150, req: ['data_web'], icon: 'eye', name: 'Behaviour Statistics', effect: 'Sheets: 4 sections · behaviour shots +1★',
    desc: 'Count it, time it, chart it. Behaviour photos are worth a star more and sheets open further.' },
  { id: 'data_survey', branch: 'data', tier: 3, lane: 1, cost: 140, req: ['data_grant'], icon: 'eye2', name: 'Survey Methods', effect: 'Discoveries +50% RP',
    desc: 'Transects, grid references, proper site records. Places, ruins, fossils and samples are worth half as much again.' },
  { id: 'data_model', branch: 'data', tier: 4, lane: 0, cost: 300, req: ['data_ethology', 'data_survey'], icon: 'af2', name: 'Ecosystem Model', effect: 'Whole sheets at once · +15% RP',
    desc: 'Everything you have recorded in one model of the island. A new upload reveals its whole research sheet.' },

  // ------------------------------------------------------------ research
  { id: 'res_eye', branch: 'research', tier: 1, lane: 0, cost: 40, req: [], icon: 'photoid', name: 'Keen Eye', effect: 'Identify blurrier, smaller animals',
    desc: 'You know the shapes now. A slightly soft, small or half-hidden animal can still be identified.' },
  { id: 'res_tag', branch: 'research', tier: 2, lane: -1, cost: 80, req: ['res_eye'], icon: 'af', name: 'Auto-Tag', effect: 'Uploads tag animals automatically',
    desc: 'A little script that boxes and names every identifiable animal in an upload for you.' },
  { id: 'res_assay', branch: 'research', tier: 2, lane: 1, cost: 70, req: ['res_eye'], icon: 'clock', name: 'Quick Assay', effect: 'Sample analysis 40% faster',
    desc: 'Pre-mixed reagents and a routine. Samples go through the laptop much faster.' },
  { id: 'res_match', branch: 'research', tier: 3, lane: -1, cost: 160, req: ['res_tag'], icon: 'lens2', name: 'Pattern Matching', effect: 'Identify from much worse photos',
    desc: 'Spot patterns, scale rows and wing bars match even on a blurry, tiny or mostly hidden animal.' },
  { id: 'res_botany', branch: 'research', tier: 3, lane: 1, cost: 120, req: ['res_assay'], icon: 'kawakawa', name: 'Field Botany', effect: 'Know safe plants & berries on sight',
    desc: 'Leaf shape, smell, the bite marks of other animals. You can tell safe forage from poisonous without the lab (mushrooms still need it).' },
  { id: 'res_lab', branch: 'research', tier: 4, lane: 0, cost: 260, req: ['res_match', 'res_botany'], icon: 'dna', name: 'Pocket Sequencer', effect: 'Analysis 2× faster · samples +25% RP',
    desc: 'Sequence DNA from a scrap of tissue. Faster analysis, more from every sample, and mushrooms identified too.' },

  // ------------------------------------------------------------ field skills
  { id: 'fld_legs', branch: 'field', tier: 1, lane: 0, cost: 40, req: [], icon: 'boot', name: 'Trail Legs', effect: 'Energy costs −15%',
    desc: 'Days of walking have hardened you. Everything you do out there costs less energy.' },
  { id: 'fld_pack', branch: 'field', tier: 2, lane: -1, cost: 70, req: ['fld_legs'], icon: 'pack', name: 'Packing Tricks', effect: '+4 kg capacity · +3 pockets',
    desc: 'Heavy things low and close to your back, straps cinched. The pack carries more before it drags.' },
  { id: 'fld_climb', branch: 'field', tier: 2, lane: 1, cost: 80, req: ['fld_legs'], icon: 'hand', name: 'Climber’s Grip', effect: 'Climbing & swimming −35% energy',
    desc: 'Use your legs, not your arms. Ladders, ropes, cliffs and water cost a lot less.' },
  { id: 'fld_sprint', branch: 'field', tier: 3, lane: -1, cost: 120, req: ['fld_pack'], icon: 'track', name: 'Second Wind', effect: 'Sprinting −40% energy, 8% faster',
    desc: 'Long easy strides when you run. Sprinting gets cheaper and a little quicker.' },
  { id: 'fld_gut', branch: 'field', tier: 3, lane: 1, cost: 120, req: ['fld_climb'], icon: 'berry_dusk', name: 'Iron Stomach', effect: 'Poison −50% · food +20% energy',
    desc: 'Your stomach has seen things. Bad forage makes you ill half as often and half as badly, and food goes further.' },
  { id: 'fld_frame', branch: 'field', tier: 4, lane: 0, cost: 240, req: ['fld_sprint', 'fld_gut'], icon: 'pack2', name: 'Expedition Frame', effect: '+8 kg · +3 pockets · +20 max energy',
    desc: 'A proper frame pack and the fitness to carry it: much more capacity, heavy loads slow you less, and a deeper tank.' },
];

export const SKILL10_BY_ID: Record<string, Skill10> = Object.fromEntries(SKILL_TREE10.map(s => [s.id, s]));
export const skill10 = (id: string): Skill10 | null => SKILL10_BY_ID[id] ?? null;
/** one branch's skills, root first */
export const branch10 = (b: Branch10): Skill10[] => SKILL_TREE10.filter(s => s.branch === b).sort((x, y) => x.tier - y.tier || (x.lane ?? 0) - (y.lane ?? 0));

/** owned skills: id -> the day it was learned */
const state = () => bucket('skills10', () => ({ owned: {} as Record<string, number> }));

export function owned10(id: string): boolean {
  // (testing: ?flags=v10:allSkills owns the whole tree)
  return !!state().owned[id] || !!game.save.flags['v10:allSkills'];
}

export function skillState10(id: string): 'owned' | 'available' | 'locked' {
  if (owned10(id)) return 'owned';
  const s = SKILL10_BY_ID[id];
  return s && s.req.every(owned10) ? 'available' : 'locked';
}

/** can it be bought right now? (reason is a short line for the UI) */
export function canBuy10(id: string): { ok: boolean; reason?: string } {
  const s = SKILL10_BY_ID[id];
  if (!s) return { ok: false, reason: 'Unknown skill' };
  if (owned10(id)) return { ok: false, reason: 'Already learned' };
  const missing = s.req.filter(r => !owned10(r));
  if (missing.length) return { ok: false, reason: `Requires ${missing.map(m => SKILL10_BY_ID[m]?.name ?? m).join(' & ')}` };
  if (game.save.rp < s.cost) return { ok: false, reason: `Needs ${s.cost} RP` };
  return { ok: true };
}

type Listener = (id: string) => void;
const listeners: Listener[] = [];
/** called after a skill is bought (HUD refreshes, camera stats...) */
export function onSkill10(fn: Listener) { listeners.push(fn); }

/** spend RP on a skill; true on success */
export function buy10(id: string): boolean {
  if (!canBuy10(id).ok) return false;
  const s = SKILL10_BY_ID[id];
  game.save.rp -= s.cost;
  state().owned[id] = game.save.day || 1;
  game.persist();
  for (const f of listeners) { try { f(id); } catch (e) { console.error(e); } }
  return true;
}

/** debug / tests: own every skill (or a list), free */
export function grantAll10(ids: string[] = SKILL_TREE10.map(s => s.id)) {
  for (const id of ids) if (SKILL10_BY_ID[id]) state().owned[id] = game.save.day || 1;
  game.persist();
  for (const id of ids) for (const f of listeners) { try { f(id); } catch (e) { console.error(e); } }
}

const o = owned10;

/** what gameplay reads (base values without upgrades) */
export const fx10 = {
  // ---------------------------------------------------------------- camera
  /** seconds the camera must be held steady to capture a research photo */
  captureHold: (): number => (o('cam_instant') ? 2 : o('cam_stab') ? 3 : o('cam_grip') ? 4 : 5),
  /** seconds a photo takes to develop before the next research photo */
  developTime: (): number => (o('cam_instant') ? 5 : o('cam_dev1') ? 12 : 20),
  /** longest zoom (the old V2 lenses still count) */
  zoomMax: (): number => Math.max(perks.zoomMax(), o('cam_zoom') ? 3.4 : 2.2),
  /** hand-shake multiplier (stabiliser) */
  shake: (): number => (o('cam_stab') ? 0.6 : 1),
  /** slow panning after an animal keeps the steadiness ring filling */
  tracking: (): boolean => o('cam_stab'),
  /** extra film per trip */
  film: (): number => (o('cam_film') ? 8 : 0) + (o('cam_zoom') ? 4 : 0),
  /** video recording (the old V2 skill counts too) */
  video: (): boolean => o('cam_video') || hasSkill('video'),

  // ---------------------------------------------------------------- data analysis
  /** how many research sheet sections a new upload reveals (data analysis depth) */
  infoDepth: (): number => (o('data_model') ? 5 : o('data_ethology') ? 4 : o('data_notes') ? 3 : 2),
  /** RP multiplier from the agency */
  rpMult: (): number => (o('data_grant') ? 1.15 : 1) * (o('data_model') ? 1.15 : 1),
  /** uploads reveal the links between species (food web, habitat) */
  ecoLinks: (): boolean => o('data_web'),
  /** behaviour photos rate one star higher */
  behaviourStar: (): boolean => o('data_ethology') || perks.behaviourStar(),
  /** RP multiplier for discoveries (places, ruins, fossils, samples) */
  discoveryMult: (): number => (o('data_survey') ? 1.5 : 1),

  // ---------------------------------------------------------------- research
  /** 0..1 bonus to identifying subjects (blur/size tolerance) */
  idBonus: (): number => (o('res_match') ? 0.55 : o('res_eye') ? 0.25 : 0),
  /** uploads tag identifiable animals automatically */
  autoTag: (): boolean => o('res_tag'),
  /** multiplier on sample analysis time */
  sampleTime: (): number => (o('res_assay') ? 0.6 : 1) * (o('res_lab') ? 0.5 : 1),
  /** multiplier on the RP a sample analysis gives */
  sampleRp: (): number => (o('res_lab') ? 1.25 : 1),
  /** risky plants and berries are known safe / poisonous on sight */
  botany: (): boolean => o('res_botany'),
  /** ... and mushrooms too */
  mycology: (): boolean => o('res_lab'),

  // ---------------------------------------------------------------- field skills
  /** multiplier on all energy costs */
  energyMult: (): number => (o('fld_legs') ? 0.85 : 1),
  /** extra pack capacity in kg */
  packBonus: (): number => (o('fld_pack') ? 4 : 0) + (o('fld_frame') ? 8 : 0),
  /** extra backpack pockets (slots) */
  packSlots: (): number => (o('fld_pack') ? 3 : 0) + (o('fld_frame') ? 3 : 0),
  /** 0..1: how much less a heavy pack slows you down */
  loadTolerance: (): number => (o('fld_frame') ? 0.3 : 0),
  /** extra maximum energy */
  maxEnergyBonus: (): number => (o('fld_frame') ? 20 : 0),
  /** multipliers on the energy cost of climbing, swimming and sprinting */
  climbMult: (): number => (o('fld_climb') ? 0.65 : 1),
  swimMult: (): number => (o('fld_climb') ? 0.65 : 1),
  sprintMult: (): number => (o('fld_sprint') ? 0.6 : 1),
  /** sprint speed multiplier */
  sprintSpeed: (): number => (o('fld_sprint') ? 1.08 : 1),
  /** 0..1: bad forage makes you ill this much less often and less badly */
  poisonResist: (): number => (o('fld_gut') ? 0.5 : 0),
  /** multiplier on the energy food restores */
  foodMult: (): number => (o('fld_gut') ? 1.2 : 1),
};
