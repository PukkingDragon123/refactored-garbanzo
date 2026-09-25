import type { Creature, Ctx } from '../wildlife/creature';
import type { HideSpot } from '../../world/player';
import type { Shaft } from './kit';
import type { TimeOfDay } from '../../world/timeofday';
import type { Ambience, Music } from '../../core/audio';
import type { Stage } from '../../world/stage';
import type { ExpeditionScene } from '../scenes/expedition';

export interface SpawnRule {
  species: string;
  n: number;
  make: (ctx: Ctx, i: number) => Creature;
  times?: TimeOfDay[];
  respawn?: number;
  when?: () => boolean;
}

export interface ClueSpot { id: string; x: number; y: number }

export interface SiteContent {
  hides: HideSpot[];
  clues: ClueSpot[];
  spawns: SpawnRule[];
  shafts?: Shaft[];
  jeepX: number;
  spawnX: number;
  waterY: number | null;
  camY: number;
  followY?: boolean;
  ambience: Ambience;
  music: Music;
  underwater?: boolean;
  noJeep?: boolean;
  exitLabel?: string;
  minY?: number;
  maxY?: number;
  lurePlaceY?: (x: number) => number;
  onEnter?: (sc: ExpeditionScene) => void | Promise<void>;
  onUpdate?: (sc: ExpeditionScene, dt: number) => void;
  onClue?: (sc: ExpeditionScene, id: string) => void | Promise<void>;
  onShot?: (sc: ExpeditionScene) => void | Promise<void>;
}

export type SiteBuilder = (st: Stage, sc: ExpeditionScene) => SiteContent;
