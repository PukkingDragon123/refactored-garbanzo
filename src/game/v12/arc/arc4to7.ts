// V12 Te Ara Matatū (the path of the watchers), chapters 4-7 and the finale: the installer.
//
//   arc_ch4  The Ground Breathes    Te Riu Wera ('geovalley'): the geyser field, the great eruption   ./ch4.ts
//   arc_ch5  The Drowned Eye        'grotto' -> 'deep' -> 'coast': the octopus's den and the chase     ./ch5.ts
//   arc_ch6  The Plunderers         the boat trip to 'motuahi' (the storm), the egg thieves' waves     ./ch6.ts
//   arc_ch7  Te Korokoro            'unknown': the gate, the Old One, three shots, Koro by the fire    ./ch7.ts
// The animals: ./species4.ts (WHEKE_SPECIES, THIEF_SPECIES, ANCIENT_SPECIES); the props and the art:
// src/art/v12/arc/.
//
// installArc4to7() hooks every chapter's scene content into the field scenes (onLocEnter); call it once.

import { onLocEnter } from '../../v10/field10';
import { enterCh4 } from './ch4';
import { enterCh5 } from './ch5';
import { enterCh6 } from './ch6';
import { enterCh7 } from './ch7';

export { ARC_CH4 } from './ch4';
export { ARC_CH5 } from './ch5';
export { ARC_CH6 } from './ch6';
export { ARC_CH7 } from './ch7';
export { WHEKE_SPECIES, THIEF_SPECIES, ANCIENT_SPECIES, WHEKE_ID, THIEF_ID, ANCIENT_ID } from './species4';

let installed = false;
export function installArc4to7(): void {
  if (installed) return;
  installed = true;
  onLocEnter((f, loc, r) => {
    enterCh4(f, loc, r);
    enterCh5(f, loc);
    enterCh6(f, loc);
    enterCh7(f, loc);
  });
}
