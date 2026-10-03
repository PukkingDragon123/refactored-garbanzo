// Packing for the day (the trail sign at camp). V11: this is the Backpack itself, opened beside the
// camp stash chest (src/ui/v11/backpack.ts mode 'prep'): move things between the pack and the chest,
// take Joshu's packed lunch off the chest lid, hear the crew's last word, and "Set off" at the trail
// sign opens the region map (src/ui/v10/regionmap.ts, the map module's) or, without it, Mori heads out
// along the home island on foot.

import { game } from '../../game/game';
import { uiIconURL } from '../../art/itemicons';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { openBackpack11 } from '../v11/backpack';
import { dayState, dayNumber, leaveCamp } from '../../game/v10/day';
import { currentExpedition } from '../../game/v10/expedition';
import type { CampDay } from '../../game/v10/campday';
import { rand } from '../../core/math';
import { lunchFor } from '../../game/v11/cooking';

/** the map module's region map, if it is in the build (no hard dependency: it may not exist yet) */
const MAP = import.meta.glob('./regionmap.ts');
type MapMod = { openRegionMap?: (...a: unknown[]) => unknown };

const TIPS: [string, string][] = [
  ['Joshu', 'Pack food, lad. You won’t find a galley out there.'],
  ['Aroha', 'Heavy pack, short day. Light pack, long day. Choose.'],
  ['Jenna', 'Did you charge the camera? I charged the camera. You’re welcome.'],
  ['Joshu', 'Back before dark. I mean it.'],
  ['Aroha', 'If your legs start shaking, turn round. The island will still be there tomorrow.'],
  ['Jenna', 'Bring me back something shiny! Or squishy! Or both!'],
];

export async function openPackPrep(cd: CampDay) {
  const d = dayState(), day = dayNumber();
  const tip = (): [string, string] => {
    const food = game.save.inv.some(s => ITEMS[s.id]?.kind === 'food');
    if (!food) return ['Joshu', 'No food in that pack? Take the lunch, lad.'];
    if (!game.save.tools.includes('headlamp') && rand.chance(0.3)) return ['Aroha', 'No headlamp. Be home before the dark is.'];
    return TIPS[(day + rand.int(0, 2)) % TIPS.length];
  };
  const r = await openBackpack11({
    mode: 'prep',
    prep: {
      lunch: () => ((d.events['lunch'] ?? 0) === day ? null : lunchFor(d.larder > 0, game.save.quests['r_tea'] === 'done' && count('tea') < 1)),
      tookLunch: () => { if ((d.events['lunch'] ?? 0) !== day) { d.events['lunch'] = day; if (d.larder > 0) d.larder--; game.persist(); } },
      tip,
    },
  });
  if (r === 'go') await setOff(cd);
}

/** off on the day's expedition: the region map, or (without it) the home island on foot */
async function setOff(cd: CampDay) {
  const load = MAP['./regionmap.ts'];
  let m: MapMod | null = null;
  if (load) { try { m = (await load()) as MapMod; } catch (e) { console.warn('[camppack] region map', e); } }
  if (m?.openRegionMap) {
    const scene = cd.s;
    game.paused = true;
    let to: unknown = null;
    try { to = await Promise.resolve(m.openRegionMap({ here: { loc: 'camp', x: cd.s.player.x } })); } finally { game.paused = false; }
    if (typeof to === 'string' && to && to !== 'camp') {
      const { departFromCamp } = await import('../../game/v10/field10');
      await departFromCamp(to);
    }
    // it counts as leaving once an expedition is under way (or the camp scene is gone)
    for (let i = 0; i < 30; i++) {
      if (currentExpedition() || game.scene !== scene) { leaveCamp(currentExpedition()); return; }
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }
  // no map in this build: explore the home island on foot
  leaveCamp('home');
  cd.s.bark('joshu', rand.pick(['Off you go! Back before dark!', 'Fair winds, Doc!', 'Mind the seal!']), { expr: 'happy' });
  game.ui.toast('Off you go: east past the palm grove and the stream, or west past the wreck. Come back into camp when you’re done for the day.', 'EXPEDITION', 'teal', 6000);
  void uiIconURL;
}
