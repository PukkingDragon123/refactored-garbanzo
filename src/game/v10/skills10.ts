// V10 skill tree: Data Analysis, Camera, Research, Field Skills, bought with Research Points.
// (Contract stub: the systems module fills in the tree; the effect getters are what gameplay reads.)

export type Branch10 = 'data' | 'camera' | 'research' | 'field';
export interface Skill10 { id: string; branch: Branch10; name: string; cost: number; req: string[]; tier: number; desc: string; effect: string }
export const SKILL_TREE10: Skill10[] = [];
export function owned10(id: string): boolean { void id; return false; }
export function buy10(id: string): boolean { void id; return false; }

/** what gameplay reads (base values without upgrades) */
export const fx10 = {
  /** seconds the camera must be held steady to capture a research photo */
  captureHold: (): number => 5,
  /** seconds a photo takes to develop before the next research photo */
  developTime: (): number => 20,
  /** multiplier on all energy costs */
  energyMult: (): number => 1,
  /** extra pack capacity in kg */
  packBonus: (): number => 0,
  /** 0..1 bonus to identifying subjects (blur/size tolerance) */
  idBonus: (): number => 0,
  /** how many research sheet sections a new upload reveals (data analysis depth) */
  infoDepth: (): number => 2,
  /** RP multiplier from the agency */
  rpMult: (): number => 1,
};
