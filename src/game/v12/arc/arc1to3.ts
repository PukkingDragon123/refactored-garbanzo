// V12 Te Ara Matatū (the path of the watchers), chapters 1 to 3: one place to install them and to find
// their quests and their new animal.
//
//   ARC_CH1 'arc_ch1'  The Ruins' Eyes            (loc 'ruins')       ./ch1.ts, scene ./ch1scene.ts
//   ARC_CH2 'arc_ch2'  The Fossil Wall            (loc 'fossils')     ./ch2.ts, scene ./ch2scene.ts
//   ARC_CH3 'arc_ch3'  The Glow Forest at Night   (loc 'glowforest')  ./ch3.ts, scene ./ch3scene.ts
//   chained arc_ch1 -> arc_ch2 -> arc_ch3 -> arc_ch4
//   GLOW_SPECIES       the Mokotūrama, the lantern gecko (./species1.ts; art src/art/v12/arc/glow.ts)

import { installCh1 } from './ch1';
import { installCh2 } from './ch2';
import { installCh3 } from './ch3';

export { ARC_CH1 } from './ch1';
export { ARC_CH2 } from './ch2';
export { ARC_CH3 } from './ch3';

/** hook chapters 1 to 3 into their places (idempotent) */
export function installArc1to3() {
  installCh1();
  installCh2();
  installCh3();
}
