// V4 island flow: which island scene to open for the current save.
import { game } from '../game';
export async function goIsland() {
  // Day 1, still out in the forest looking for Joshu: that's where the save picks up
  const f = game.save.flags;
  if (f['v11:inForest'] && !f['v4:day1']) {
    const { goForest } = await import('../v11/forest');
    return goForest({ x: game.save.vars['v11:fx'] });
  }
  const { IslandScene4 } = await import('./island');
  const { attachIsleStory, dayTimeForSave } = await import('./islestory');
  game.go(() => attachIsleStory(new IslandScene4(dayTimeForSave())), [0, 0, 0], 1.2);
}
