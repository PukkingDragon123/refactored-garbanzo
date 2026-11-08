// V12 the raid's handle on Matikuku Nui: a small adapter over the creature (src/game/v12/feud) so the
// fight in ./fight.ts can script it: walk it, play an act and wait for it to end, read its nerve and
// whether it sleeps.

import type { FieldScene } from '../../scenes/field';

export type BearerAct = 'idle' | 'walk' | 'threat' | 'swipe' | 'smash' | 'roar' | 'charge' | 'flinch' | 'stunned' | 'sleep' | 'retreat' | 'pin';

export interface BearerCtl {
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  faceTo(x: number): void;
  /** its nerve left, 0..1 */
  nerve(): number;
  /** tranquillised to sleep */
  asleep(): boolean;
  /** flinching, stunned, tangled or netted: not acting on its own will */
  stunned(): boolean;
  /** play an act for about `secs` (or its natural length); resolves when it ends */
  act(name: BearerAct, secs?: number): Promise<void>;
  /** walk or run toward x at `speed` px/s; resolves true on arrival, false if interrupted */
  moveTo(x: number, speed: number): Promise<boolean>;
  remove(): void;
}

/** spawn the Bearer at x, under the raid's control (null if the creature module is missing) */
export async function makeBearer(_f: FieldScene, _x: number): Promise<BearerCtl | null> {
  return null;
}
