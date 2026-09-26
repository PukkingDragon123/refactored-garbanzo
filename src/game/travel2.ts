// Travel: open Aroha's 3D island map, pick a site and a time, watch her lead the way, then go.

import { game } from './game';
import { openMap3D, MapSite, MapTime } from '../ui/map3d';
import type { SiteId } from './species';
import { SPECIES } from './species';
import { AROHA_TRAVEL } from './script';
import { portraitURL } from '../world/actor';
import { goField } from './scenes/flow';
import { audio } from '../core/audio';
import type { TimeOfDay } from '../world/timeofday';

const SITE_INFO: Record<SiteId | 'camp', { name: string; desc: string; pos: [number, number] }> = {
  camp: { name: 'Camp Kittiwake', desc: 'Our camp on the west beach, beside the wreck.', pos: [0.12, 0.6] },
  fernwood: { name: 'Fernwood Floor', desc: 'Lowland forest of giant tree ferns and kauri. Striders, delvers, bonefaces, and a lot of things you can’t see.', pos: [0.28, 0.52] },
  canopy: { name: 'Emerald Canopy', desc: 'The old forest on the plateau. Rope bridges between trees where the snakes fly.', pos: [0.42, 0.35] },
  falls: { name: 'Thunder Falls', desc: 'Where the awa drops off the plateau. Auks nest in the cliffs; dippers walk under the water.', pos: [0.58, 0.2] },
  mangrove: { name: 'Blackwater Mangroves', desc: 'The river delta in the south. Dark water, ironjaws, and something bigger.', pos: [0.55, 0.85] },
  coast: { name: 'Serpent Coast', desc: 'The reef and rocky coast in the east. Clear water, and a fin.', pos: [0.88, 0.5] },
};

let spriteURL: ((species: string) => string) | null = null;
/** the game provides a species icon renderer (small pixel portraits) */
export function setSpeciesIcon(fn: (species: string) => string) {
  spriteURL = fn;
}

export async function openTravelMap() {
  const s = game.save;
  const sites: MapSite[] = (['camp', 'fernwood', 'canopy', 'falls', 'mangrove', 'coast'] as const).map(id => ({
    id, name: SITE_INFO[id].name, desc: SITE_INFO[id].desc, pos: SITE_INFO[id].pos,
    unlocked: id === 'camp' || s.sites.includes(id as SiteId),
    fauna: id === 'camp' ? [] : SPECIES.filter(sp => sp.sites.includes(id as SiteId)).map(sp => ({ name: s.seen[sp.id] ? sp.name : '???', icon: spriteURL?.(sp.id) ?? '', known: !!s.seen[sp.id] })),
  }));
  const lamp = s.tools.includes('headlamp');
  const times: MapTime[] = [
    { id: 'dawn', label: 'Dawn' },
    { id: 'day', label: 'Midday' },
    { id: 'dusk', label: 'Golden hour' },
    { id: 'night', label: 'Night', locked: lamp ? undefined : 'You need a headlamp (Pip can make one).' },
  ];
  const res = await openMap3D({
    sites, from: 'camp', times,
    guidePortrait: portraitURL('aroha', 'happy', 3),
    guideLines: (_from, to) => AROHA_TRAVEL[to] ?? ['This way.'],
    onSfx: n => audio.play(n),
  });
  if (!res || res.site === 'camp') return false;
  if (res.site === 'coast' && !s.flags['divegear']) {
    game.ui.toast('You need dive gear for the Serpent Coast.', 'MAP', 'coral');
    return false;
  }
  await goField(res.site as SiteId, res.tod as TimeOfDay);
  return true;
}
