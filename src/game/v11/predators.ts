// V11 contract: predators and combat. The predators module owns the real implementation (the
// Cerebral Tiger, predator AI, the player's slingshot, Aroha's companion combat and the forest
// ambush cinematic); story modules only call these.
import { game } from '../game';

export interface AmbushOpts {
  /** the scene the group is in (an island / field scene) */
  scene: unknown;
  /** world x where it happens (the tiger bursts out ahead of the group) */
  x: number;
  /** which side it comes from */
  dir?: 1 | -1;
}
/** the Cerebral Tiger ambush in the forest: a stylish, fast introduction to forest predators; Aroha
 *  answers with her slingshot and improvised grenades. Resolves when the scene has control again. */
export async function tigerAmbush(_o: AmbushOpts): Promise<void> { /* the predators module replaces this */ }
/** the player can defend himself once he has crafted the slingshot */
export function hasSlingshot(): boolean { return game.save.tools.includes('slingshot'); }
