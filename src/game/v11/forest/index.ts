// V11 Te Wao Nui: going into the forest and coming back out. On Day 1 it is part of the story (the
// search for Joshu: Mori walks in up the stream from the beach, and out again); from Day 2 it is the
// first expedition location ('forest' in the atlas), reached on foot from the stream mouth or by the
// Region Map's fast travel, with the expedition clock setting the time of day.

import { game } from '../../game';
import { tagScene, expeditionHour, currentExpedition } from '../../v10/expedition';
import { TRAILHEAD_X } from './layout';

export { TRAILHEAD_X };

/** the island day clock (0 morning .. 4 night) for an expedition hour */
export function clockForHour(h: number): number {
  const keys: [number, number][] = [[5.5, 0], [7.5, 0.05], [12, 1], [16.5, 2], [18.75, 3], [20.5, 4]];
  if (h <= keys[0][0]) return 4;
  for (let i = 1; i < keys.length; i++) if (h <= keys[i][0]) { const [a, ta] = keys[i - 1], [b, tb] = keys[i]; return ta + ((h - a) / (b - a)) * (tb - ta); }
  return 4;
}

let going = false;
/** load the forest with Mori at x (default: walking in at the west end) */
export async function goForest(o: { x?: number } = {}): Promise<void> {
  if (going) return;
  going = true;
  try {
    const F = game.save.flags, V = game.save.vars;
    const day1 = !F['v4:day1'];
    const dayT = day1 ? (V['v11:dayT'] ?? 0.6) : clockForHour(currentExpedition() ? expeditionHour() : 9);
    const [{ ForestScene }, { buildForest }, story] = await Promise.all([import('./scene'), import('./build'), import('./story')]);
    await game.go(() => {
      const f = new ForestScene({ x: o.x, dayT, day1, build: buildForest });
      // (on Day 1 the expedition runtime stays out of it: no map, no expedition clock, no events)
      if (!day1) tagScene(f, 'forest');
      story.attachForestStory(f);
      return f;
    }, [0.02, 0.03, 0.03], 1.6);
  } finally {
    going = false;
  }
}

/** the island scene at the trailhead (Day 1: back down the stream to the beach) */
export async function backToBeach(): Promise<void> {
  game.save.vars['v9:px'] = TRAILHEAD_X - 8;
  game.persist();
  const { goIsland } = await import('../../v4/islandflow');
  await goIsland();
}
