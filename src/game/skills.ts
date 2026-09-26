// Research skill tree: spend research points (RP) on camera, fieldcraft, survival and lab upgrades.

import { game } from './game';

export type Branch = 'camera' | 'field' | 'survival' | 'lab';

export interface SkillDef {
  id: string;
  name: string;
  branch: Branch;
  cost: number;
  /** all of these must be owned first */
  req: string[];
  desc: string;
  /** short effect summary shown on the node */
  effect: string;
  /** layout inside the branch column: tier (row, 0 = root) and lane (-1, 0, 1) */
  tier: number;
  lane: number;
  /** icon hint for the UI */
  icon: string;
}

export const BRANCHES: { id: Branch; name: string; color: string; blurb: string }[] = [
  { id: 'camera', name: 'Camera', color: '#f4b43c', blurb: 'Lenses, focus and stabilisation. Better photos, fewer ruined shots.' },
  { id: 'field', name: 'Fieldcraft', color: '#3fbca6', blurb: 'Stealth, lures and traps. Get close without being noticed.' },
  { id: 'survival', name: 'Survival', color: '#8db34a', blurb: 'Tools, backpack space and faster collecting.' },
  { id: 'lab', name: 'Lab', color: '#9b7ce0', blurb: 'Microscopes, sequencing and software. More research from every sample.' },
];

export const SKILLS: SkillDef[] = [
  // ------------------------------------------------------------ camera
  { id: 'card1', name: 'Spare memory card', branch: 'camera', cost: 25, req: [], tier: 0, lane: 0, icon: 'card', effect: '+8 shots per trip',
    desc: 'Pip found a spare memory card in the wreck. Mostly dry.' },
  { id: 'lens1', name: 'Telephoto I', branch: 'camera', cost: 40, req: ['card1'], tier: 1, lane: -1, icon: 'lens', effect: 'Zoom ×3.2',
    desc: 'A salvaged 300 mm lens. Frame shy animals from further away.' },
  { id: 'af1', name: 'Fast autofocus', branch: 'camera', cost: 40, req: ['card1'], tier: 1, lane: 1, icon: 'af', effect: 'Focus 40% faster',
    desc: 'Firmware tweak from Pip. Locks focus before the moment is gone.' },
  { id: 'stab1', name: 'Stabiliser', branch: 'camera', cost: 50, req: ['lens1'], tier: 2, lane: -1, icon: 'stab', effect: 'Hand shake −40%',
    desc: 'In-body stabilisation. Sharper shots when you are out of breath.' },
  { id: 'af2', name: 'Tracking AF', branch: 'camera', cost: 80, req: ['af1'], tier: 2, lane: 1, icon: 'af2', effect: 'Focus follows animals',
    desc: 'Focus stays locked on a moving animal and ignores leaves in front of it.' },
  { id: 'video', name: 'Video mode', branch: 'camera', cost: 60, req: ['af1'], tier: 2, lane: 0, icon: 'video', effect: 'Record video (V)',
    desc: 'Record behaviour as video. Some facts can only be proven on film.' },
  { id: 'lens2', name: 'Telephoto II', branch: 'camera', cost: 90, req: ['stab1'], tier: 3, lane: -1, icon: 'lens2', effect: 'Zoom ×4.4',
    desc: 'A big white lens. Heavy, but you can count whiskers from across a clearing.' },
  { id: 'shutter', name: 'Fast shutter', branch: 'camera', cost: 70, req: ['stab1', 'af2'], tier: 3, lane: 1, icon: 'shutter', effect: 'Motion blur −50%',
    desc: 'Freeze a striking viper mid-air.' },
  { id: 'card2', name: 'Big memory card', branch: 'camera', cost: 60, req: ['video'], tier: 3, lane: 0, icon: 'card', effect: '+12 shots per trip',
    desc: 'Room for a whole morning of mistakes.' },
  { id: 'night', name: 'Low-light sensor', branch: 'camera', cost: 110, req: ['lens2', 'shutter'], tier: 4, lane: 0, icon: 'night', effect: 'Clean night photos',
    desc: 'Night shots without flash. Nocturnal animals stay calm.' },

  // ------------------------------------------------------------ fieldcraft
  { id: 'quiet1', name: 'Soft steps', branch: 'field', cost: 30, req: [], tier: 0, lane: 0, icon: 'boot', effect: 'Noise −30%',
    desc: 'Aroha’s lesson: heel first, weight slow, never step on what you can’t see.' },
  { id: 'lurecraft', name: 'Lure craft', branch: 'field', cost: 25, req: ['quiet1'], tier: 1, lane: -1, icon: 'lure', effect: 'Grub pots & fish bait',
    desc: 'New workbench recipes for serpents, insect-eaters and water birds.' },
  { id: 'ghillie', name: 'Ghillie cape', branch: 'field', cost: 60, req: ['quiet1'], tier: 1, lane: 1, icon: 'ghillie', effect: 'Recipe: ghillie cape',
    desc: 'Weave a cape of fern fronds. Animals notice you much later.' },
  { id: 'caller', name: 'Reed caller', branch: 'field', cost: 40, req: ['lurecraft'], tier: 2, lane: -1, icon: 'caller', effect: 'Recipe: bird caller',
    desc: 'A reed whistle that makes curious birds come and look.' },
  { id: 'advlures', name: 'Scent & glow lures', branch: 'field', cost: 60, req: ['lurecraft'], tier: 2, lane: 0, icon: 'glow', effect: 'Musk & glow lures',
    desc: 'Predators follow musk; night hunters follow light.' },
  { id: 'still', name: 'Stillness', branch: 'field', cost: 50, req: ['ghillie'], tier: 2, lane: 1, icon: 'eye', effect: 'Hidden longer when still',
    desc: 'Crouched and motionless, you become part of the forest.' },
  { id: 'traps', name: 'Camera traps', branch: 'field', cost: 90, req: ['advlures'], tier: 3, lane: 0, icon: 'trap', effect: 'Recipe: camera trap',
    desc: 'Motion-triggered cameras that shoot while you wait somewhere safer.' },
  { id: 'read', name: 'Read the land', branch: 'field', cost: 70, req: ['still', 'caller'], tier: 3, lane: 1, icon: 'track', effect: 'See tracks & signs',
    desc: 'Aroha teaches you to read tracks. Nearby animal signs are highlighted.' },

  // ------------------------------------------------------------ survival
  { id: 'pack1', name: 'Bigger backpack', branch: 'survival', cost: 30, req: [], tier: 0, lane: 0, icon: 'pack', effect: '+6 slots',
    desc: 'Lou sewed extra pockets onto your pack.' },
  { id: 'net', name: 'Bug net', branch: 'survival', cost: 25, req: ['pack1'], tier: 1, lane: -1, icon: 'net', effect: 'Recipe: bug net',
    desc: 'Flax mesh on a driftwood hoop. For moths and dragonflies.' },
  { id: 'forage1', name: 'Quick hands', branch: 'survival', cost: 40, req: ['pack1'], tier: 1, lane: 1, icon: 'hand', effect: 'Collect 35% faster',
    desc: 'You stop fumbling with jars.' },
  { id: 'pack2', name: 'Expedition pack', branch: 'survival', cost: 80, req: ['net', 'forage1'], tier: 2, lane: 0, icon: 'pack2', effect: '+6 slots',
    desc: 'Pip rigged a frame pack from the Kittiwake’s aluminium.' },
  { id: 'forage2', name: 'Keen eye', branch: 'survival', cost: 70, req: ['forage1'], tier: 2, lane: 1, icon: 'eye2', effect: '50% chance of +1 item',
    desc: 'Where there is one glowcap, there are usually more.' },
  { id: 'hardy', name: 'Hardy', branch: 'survival', cost: 60, req: ['pack2'], tier: 3, lane: 0, icon: 'heart', effect: 'Faster recovery if attacked',
    desc: 'You have been chased by enough snakes to stop panicking.' },

  // ------------------------------------------------------------ lab
  { id: 'micro1', name: 'Field microscope', branch: 'lab', cost: 40, req: [], tier: 0, lane: 0, icon: 'micro', effect: '+25% RP from samples',
    desc: 'Pip built it from a broken camera lens and a torch.' },
  { id: 'fastlab', name: 'Batch analysis', branch: 'lab', cost: 50, req: ['micro1'], tier: 1, lane: -1, icon: 'clock', effect: 'Analysis 50% faster',
    desc: 'A script that runs the boring parts for you.' },
  { id: 'photoid', name: 'Photo ID software', branch: 'lab', cost: 70, req: ['micro1'], tier: 1, lane: 1, icon: 'photoid', effect: 'Identify blurrier animals',
    desc: 'Pattern-matching software that can identify an animal from a blurry shot.' },
  { id: 'micro2', name: 'Pocket sequencer', branch: 'lab', cost: 100, req: ['fastlab'], tier: 2, lane: -1, icon: 'dna', effect: '+25% RP from samples',
    desc: 'Sequence DNA from a hair. This changes everything.' },
  { id: 'stats', name: 'Behaviour stats', branch: 'lab', cost: 80, req: ['photoid'], tier: 2, lane: 1, icon: 'chart', effect: '+1 star for behaviour shots',
    desc: 'Photos that show behaviour are worth more to science.' },
  { id: 'grant', name: 'Grant proposal', branch: 'lab', cost: 140, req: ['micro2', 'stats'], tier: 3, lane: 0, icon: 'grant', effect: '+15% RP from everything',
    desc: 'If we ever get home, someone is going to fund this.' },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map(s => [s.id, s]));

export function hasSkill(id: string) {
  return !!game.save.skills[id];
}

export function skillState(id: string): 'owned' | 'available' | 'locked' {
  if (hasSkill(id)) return 'owned';
  const s = SKILL_BY_ID[id];
  return s && s.req.every(hasSkill) ? 'available' : 'locked';
}

export function canUnlock(id: string): { ok: boolean; reason?: string } {
  const s = SKILL_BY_ID[id];
  if (!s) return { ok: false, reason: 'Unknown skill' };
  if (hasSkill(id)) return { ok: false, reason: 'Already learned' };
  const missing = s.req.filter(r => !hasSkill(r));
  if (missing.length) return { ok: false, reason: `Requires ${missing.map(m => SKILL_BY_ID[m]?.name ?? m).join(' & ')}` };
  if (game.save.rp < s.cost) return { ok: false, reason: `Needs ${s.cost} RP` };
  return { ok: true };
}

/** Spend RP on a skill; returns true on success. Grants any tool the skill directly provides. */
export function unlockSkill(id: string): boolean {
  if (!canUnlock(id).ok) return false;
  const s = SKILL_BY_ID[id];
  game.save.rp -= s.cost;
  game.save.skills[id] = true;
  game.persist();
  return true;
}

/** Derived gameplay values from the skill tree (and temporary food buffs). */
export const perks = {
  zoomMax: () => (hasSkill('lens2') ? 4.4 : hasSkill('lens1') ? 3.2 : 2.2),
  /** seconds to acquire AF lock */
  afTime: () => (hasSkill('af1') ? 0.33 : 0.55) * (hasSkill('af2') ? 0.6 : 1),
  /** tracking AF: focus sticks to the animal and ignores foreground */
  afTracking: () => hasSkill('af2'),
  /** hand-shake multiplier */
  shake: () => (hasSkill('stab1') ? 0.6 : 1) * (game.save.buff === 'steady' ? 0.6 : 1),
  /** motion-blur multiplier */
  motion: () => (hasSkill('shutter') ? 0.5 : 1),
  shots: () => 16 + (hasSkill('card1') ? 8 : 0) + (hasSkill('card2') ? 12 : 0),
  video: () => hasSkill('video'),
  nightClean: () => hasSkill('night'),
  noise: () => (hasSkill('quiet1') ? 0.7 : 1) * (game.save.buff === 'quiet' ? 0.75 : 1),
  visibility: () => (game.save.tools.includes('ghillie') ? 0.65 : 1),
  stillness: () => hasSkill('still'),
  collectTime: () => (hasSkill('forage1') ? 0.65 : 1),
  bonusItem: () => (hasSkill('forage2') ? 0.5 : 0),
  labRp: () => 1 + (hasSkill('micro1') ? 0.25 : 0) + (hasSkill('micro2') ? 0.25 : 0),
  labTime: () => (hasSkill('fastlab') ? 0.5 : 1),
  /** minimum visible fraction / sharpness needed to identify an animal in review */
  idVisible: () => (hasSkill('photoid') ? 0.35 : 0.45),
  idSharp: () => (hasSkill('photoid') ? 0.3 : 0.4),
  behaviourStar: () => hasSkill('stats'),
  rpMul: () => (hasSkill('grant') ? 1.15 : 1),
  tracks: () => hasSkill('read'),
  recover: () => (hasSkill('hardy') ? 2 : 1),
};
