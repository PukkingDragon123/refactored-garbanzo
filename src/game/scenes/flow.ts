// Scene flow: where the game goes next. Dynamic imports keep scenes decoupled.

import { game } from '../game';
import type { TimeOfDay } from '../../world/timeofday';
import type { SiteId } from '../species';
import type { FieldSite } from './field';

const NEXT_TIME: Record<TimeOfDay, TimeOfDay> = { dawn: 'day', day: 'dusk', dusk: 'night', night: 'night' };

/** Back to the beach camp. fromTrip advances the time of day. */
export async function goCamp(fromTrip = false) {
  const s = game.save;
  if (fromTrip) s.campTime = NEXT_TIME[s.campTime] ?? 'dusk';
  game.persist();
  const { CampScene } = await import('./camp2');
  game.go(() => new CampScene());
}

export async function goTent(night = game.save.campTime === 'night') {
  const { TentScene } = await import('./tent');
  game.go(() => new TentScene(night), [0.02, 0.02, 0.03], 3, 'iris');
}

export async function goField(site: SiteId, tod: TimeOfDay) {
  const { SITES2 } = await import('../sites2');
  // (the V10 sites too, so ?scene=site&site=glowforest etc. open them for checking)
  const def = SITES2[site] ?? ((await import('../sites10')).SITES10[site] as unknown as FieldSite | undefined);
  if (!def) return;
  const { FieldScene } = await import('./field');
  game.go(() => new FieldScene(def, tod));
}

export async function goPrologue() {
  const { BoatScene } = await import('./boat');
  game.go(() => new BoatScene());
}

export async function goTitle() {
  const { TitleScene } = await import('./title');
  game.go(() => new TitleScene(), undefined, undefined, 'page');
}

/** V4: the Kittiwake (Day 1 at sea) */
export async function goShip4() {
  const { ShipScene4 } = await import('../v4/ship');
  const { attachShipStory } = await import('../v4/shipstory');
  game.go(() => attachShipStory(new ShipScene4()), [0.02, 0.02, 0.03], 1.2);
}

/** V4: washed ashore. First-person wake-up on the beach, then the island. */
export async function goBeachWake() {
  const { BeachWakeScene } = await import('../v4/wake');
  game.go(() => new BeachWakeScene(), [0, 0, 0], 0.8);
}

/** V4: pick up the story wherever the save left it */
export async function continueV4() {
  const f = game.save.flags;
  if (!f['v4']) { const { newSave } = await import('../save'); game.save = newSave(); game.save.flags['v4'] = true; game.persist(); return goShip4(); }
  if (!f['v4:bridge']) return goShip4();
  if (!f['v4:beachWoke']) return goBeachWake();
  const { goIsland } = await import('../v4/islandflow');
  return goIsland();
}
