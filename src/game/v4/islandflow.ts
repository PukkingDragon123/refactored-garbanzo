// V4 island flow: which island scene to open for the current save.
import { game } from '../game';
export async function goIsland() {
  const { IslandScene } = await import('./island');
  game.go(() => new IslandScene());
}
