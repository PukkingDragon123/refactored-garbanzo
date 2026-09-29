// V4 island flow: which island scene to open for the current save.
import { game } from '../game';
export async function goIsland() {
  const { IslandScene4 } = await import('./island');
  const { attachIsleStory, dayTimeForSave } = await import('./islestory');
  game.go(() => attachIsleStory(new IslandScene4(dayTimeForSave())), [0, 0, 0], 1.2);
}
