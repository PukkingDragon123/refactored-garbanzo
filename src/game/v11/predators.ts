// V11 contract: predators and combat. The predators module owns the real implementation (the
// Cerebral Tiger, predator AI, the player's slingshot, Aroha's companion combat and the forest
// ambush cinematic); story modules only call these.
//
//   tigerAmbush({ scene, x, dir })   the forest ambush cinematic (resolves when the scene has control again)
//   hasSlingshot()                   Mori can defend himself (the slingshot is on the tool belt)
//   attachPredators(scene)           predators, the slingshot and Aroha's combat AI in a field scene
//                                    (FieldScene.enter already does it for every field scene)
//   spawnCerebralTiger(scene, x)     a tiger lurking in a mud wallow at x (adds the wallow)
//   addMudWallow(scene, x, w?)       a wallow (tigers lurk in it, bubbles, the eruption)
//   warmPredators()                  paint the tiger's frames now (call while a scene builds)
//   ambushRunning()                  the cinematic is playing: scene follower code keeps its hands off
// More predators: ./predators-core (registerPredator, onPredator, deter, knockDown).
// The heavy modules load on first use.
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
export async function tigerAmbush(o: AmbushOpts): Promise<void> {
  const m = await import('./predators-ambush');
  return m.tigerAmbush(o);
}
/** the player can defend himself once he has crafted the slingshot */
export function hasSlingshot(): boolean { return game.save.tools.includes('slingshot'); }

/** predators, Mori's slingshot and Aroha's combat AI in a field scene (idempotent) */
export async function attachPredators(scene: unknown): Promise<void> {
  (await import('./predators-scene')).attachPredators(scene as never);
}
/** a Cerebral Tiger lurking in a mud wallow at x (lurk: false = prowling) */
export async function spawnCerebralTiger(scene: unknown, x: number, o: { lurk?: boolean; facing?: 1 | -1 } = {}): Promise<unknown> {
  await attachPredators(scene);
  return (await import('./predators-tiger')).spawnTiger(scene as never, x, o);
}
/** a mud wallow on the forest floor at x */
export async function addMudWallow(scene: unknown, x: number, w = 130): Promise<void> {
  (await import('./predators-tiger')).addMudWallow(scene as never, x, w);
}
/** paint the tiger's frames now (about a second; call while a scene builds) */
export async function warmPredators(): Promise<void> {
  (await import('./predators-tiger')).warmTiger();
}
/** is the ambush cinematic playing? */
export async function ambushRunning(): Promise<boolean> {
  return (await import('./predators-ambush')).ambushRunning();
}
