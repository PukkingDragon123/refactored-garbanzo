// V11 NPCs: tiny shared helpers (story flags, counters, the day) for the NPC modules.
import { game } from '../../game';
import { dayNumber } from '../../v10/day';

export const F = (k: string) => !!game.save.flags[k];
export const setF = (k: string, v = true) => { game.save.flags[k] = v; game.persist(); };
export const V = (k: string) => game.save.vars[k] ?? 0;
export const setV = (k: string, n: number) => { game.save.vars[k] = n; game.persist(); };
export const day = () => dayNumber();
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
/** the camp day loop has started (Day 2 or later) */
export const loopOn = () => !!game.save.flags['v4:day1'] || !!game.save.flags['v10'];

/** when each group of people is around */
export const AROUND = {
  /** back from the far side of the island, camped in the ruins of their station */
  rangers: () => loopOn() && day() >= 3,
  marge: () => loopOn() && day() >= 2,
  helix: () => loopOn(),
  hunters: () => loopOn(),
};
