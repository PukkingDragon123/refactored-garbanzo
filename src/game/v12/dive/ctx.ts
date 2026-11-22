// V12 Te Moana Rimurimu, the kelp-forest dive: the shared context that joins its parts.
// The scene (./scene.ts) fills it on enter and clears it on leave; the dive life (./species.ts) registers
// its spearable fish and its sharks here; the gear (./air.ts, the harpoon in ../arsenal*.ts) reads it.
// No part imports another directly: everything meets in DIVE_CTX.

import type { FieldScene } from '../../scenes/field';

/** a fish the harpoon can take (a clean catch: it is reeled back on the line into the pack) */
export interface Spearable {
  x: number;
  y: number;
  /** hit radius in world px */
  r: number;
  species: string;
  /** false once taken or gone */
  alive: boolean;
  /** world px per second, for the harpoon's lead */
  vx: number;
  vy: number;
  /** taken by the spear: return the food item id it becomes (or null if it slipped off) and leave the world */
  take(): string | null;
  /** a spear or a struggle nearby: dart away */
  spook(fromX: number, fromY: number): void;
}

/** a shark (or anything that charges Mori underwater) */
export interface Charger {
  x: number;
  y: number;
  species: string;
  /** winding up or charging Mori right now (the bang-head shot only counts then, or very close) */
  threatening: boolean;
  /** hit by the bang-head shot / blocked by kelp: veer off and lose interest for a while */
  repel(fromX: number, fromY: number): void;
}

export interface DiveCtx {
  scene: FieldScene | null;
  /** world y of the water surface, and of the floor at x */
  surfaceY: number;
  floorAt(x: number): number;
  /** metres of depth at world y (the watch's dive face reads it) */
  depthAt(y: number): number;
  /** 0..1 how thick the kelp is at a point (sharks avoid it; Mori hides in it) */
  kelpAt(x: number, y: number): number;
  /** the boat's boarding ladder (air refills here; climbing it surfaces) */
  ladder: { x: number; y: number };
  spearables: Spearable[];
  chargers: Charger[];
  /** food items taken on this dive (dropped in part on an emergency ascent; sharks steal from it) */
  catches: string[];
  /** called whenever a fish is taken (sharks and seals react to the struggle) */
  onCatch: ((species: string, x: number, y: number) => void)[];
  /**
   * named places the scene lays out for the life to use (world coords; the floor or mid-water there):
   * sealPlay, kingfish, cod, ray, groperCave, sunfish, sharkPatrol, crayHoles
   */
  spots: Record<string, { x: number; y: number }>;
}

/** the dive's zones along x (the scene is laid out on them; the life spawns by them) */
export const KELP_ZONES = { W: 4800, shallows: [0, 1400], reef: [1400, 2800], dropoff: [2800, 3800], blue: [3800, 4800] } as const;

const noFloor = () => 0;
export const DIVE_CTX: DiveCtx = {
  scene: null, surfaceY: 0, floorAt: noFloor, depthAt: () => 0, kelpAt: () => 0,
  ladder: { x: 0, y: 0 }, spearables: [], chargers: [], catches: [], onCatch: [], spots: {},
};

/** is Mori on the kelp dive right now */
export const diving = () => !!DIVE_CTX.scene;

/** the scene calls this on leave */
export function clearDive() {
  DIVE_CTX.scene = null;
  DIVE_CTX.spearables.length = 0;
  DIVE_CTX.chargers.length = 0;
  DIVE_CTX.onCatch.length = 0;
  DIVE_CTX.floorAt = noFloor;
  DIVE_CTX.depthAt = () => 0;
  DIVE_CTX.kelpAt = () => 0;
  DIVE_CTX.spots = {};
}

/** the location id of the dive (onLocEnter, the atlas, dev jumps) */
export const KELP_LOC = 'kelpforest';
