// Shared wildlife types: points of interest, lures, sounds and the host interface the site scene implements.

import type { Stage, Layer } from '../../world/stage';
import type { Terrain } from '../../world/terrain';
import type { TimeOfDay } from '../../world/timeofday';
import type { Food } from './ecology';
import type { Animal } from './animal';

/** Points of interest animals use: perches, trunks, burrows, food, water, sun patches, cover... */
export interface POI {
  kind: 'perch' | 'branch' | 'trunk' | 'burrow' | 'cover' | 'sun' | 'soft' | 'fruit' | 'flower' | 'leaves' | 'water' | 'shallows' | 'bank' | 'nest' | 'rock' | 'mud' | 'carrion' | 'den';
  x: number;
  y: number;
  /** trunks: top y; cover: half width; water: bottom y */
  y1?: number;
  w?: number;
  /** remaining food (fruit/flowers/eggs/carrion) */
  amount?: number;
  /** animals currently using it */
  users?: number;
  /** parallax plane (1 = gameplay) */
  p?: number;
}

export interface Lure {
  kind: string;
  x: number;
  y: number;
  life: number;
  eaten: number;
  claimed: Animal | null;
  /** foods it smells like */
  food: Food[];
  /** smell radius in px */
  scent: number;
  /** also glows (attracts insects and their hunters at night) */
  glow?: boolean;
  /** bird caller: attracts curious birds */
  call?: boolean;
}

export type SoundKind = 'alarm' | 'contact' | 'threat' | 'song' | 'noise' | 'shutter' | 'splash' | 'roar' | 'rustle' | 'fight';

export interface Sound {
  x: number;
  y: number;
  kind: SoundKind;
  src: Animal | null;
  species: string | null;
  /** audible radius in px */
  radius: number;
  t: number;
}

export interface PlayerLike {
  x: number;
  y: number;
  vx: number;
  eyeY: number;
  /** 0..1: how visible (crouching, hiding, ghillie) */
  visibility: number;
  /** 0..1: how much noise the player is making */
  noise: number;
  camera: boolean;
  state: string;
  underwater?: boolean;
}

/** Implemented by the expedition/camp scene hosting the wildlife. */
export interface WildHost {
  st: Stage;
  main: Layer;
  terrain: Terrain;
  player: PlayerLike;
  animals: Animal[];
  lures: Lure[];
  pois: POI[];
  tod: TimeOfDay;
  sounds: Sound[];
  minX: number;
  maxX: number;
  /** y of the water surface if the site has open water */
  waterY: number | null;
  time: number;
  /** a dangerous animal reached the player */
  caught(a: Animal, severity: number): void;
  splash(x: number, y: number, k?: number): void;
  /** light level 0..1 at a point (sun patches, lamps, night) */
  lightAt(x: number, y: number): number;
  /** insect prey near a point, for insectivores; returns true if one was caught */
  catchInsect?(x: number, y: number, r: number): boolean;
  /** play a positional sound effect */
  sfx(name: string, x: number, vol?: number, pitch?: number): void;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** What the camera needs to know about an animal at the moment of capture. */
export interface PhotoInfo {
  species: string;
  behavior: string | null;
  box: Box;
  /** silhouette sample points in world space (for occlusion tests) */
  pts: [number, number][];
  /** px/s */
  speed: number;
  /** 0..1 how much of the face/head is towards the camera */
  facing: number;
  noticed: boolean;
  juvenile: boolean;
  /** parallax plane */
  p: number;
  /** partially submerged / burrowed fraction hidden (0..1) */
  hidden: number;
}
