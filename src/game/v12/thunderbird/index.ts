// V12 The Thunderbird and the harder wilds: boot. Registers the quest, its blueprints and camp scenes
// (./quest), and hooks every field scene as it opens: the Thunderbird's signs (./signs), Aroha as a
// hunting companion and the storm encounter on the ridge (./hunt, loaded on first use), and the
// hostile wildlife (../wilds).

import './quest';
import { placeSigns } from './signs';

let booted = false;
export async function bootThunderbird() {
  if (booted) return;
  booted = true;
  const { onLocEnter } = await import('../../v10/field10');
  onLocEnter(async (f, loc) => {
    placeSigns(f, loc);
    (await import('../wilds')).attachWilds(f, loc);
    (await import('./hunt')).attachHunt(f, loc);
  });
}
