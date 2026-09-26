// Scene flow: where the game goes next. Dynamic imports keep scenes decoupled.

import { game } from '../game';
import type { TimeOfDay } from '../../world/timeofday';
import type { SiteId } from '../species';

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
  game.go(() => new TentScene(night), [0.02, 0.02, 0.03], 3);
}

export async function goField(site: SiteId, tod: TimeOfDay) {
  const { SITES2 } = await import('../sites2');
  const def = SITES2[site];
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
  game.go(() => new TitleScene());
}
