// V10 Jenna's tech bench, since V11 the camp workbench where blueprints are crafted: it opens the
// blueprint folio on the drafting table (src/ui/v11/blueprints/folio.ts) at the bench, so the CRAFT
// stamp works and research can be sent off. Whatever was made plays a little scene of Jenna at work
// afterwards (sparks, hammering, "Done!" and her line from the sheet).

import { game } from '../../game/game';
import { sfx, wait } from '../laptop-kit';
import { esc } from './campkit';
import type { CampDay } from '../../game/v10/campday';
import { C10 } from '../../game/v10/campcrew';
import { groundY } from '../../art/island4/layout';
import { addBond } from '../../game/v10/day';
import { rand } from '../../core/math';
import { A } from '../../game/assets';
import { BLUEPRINTS } from '../../game/v11/blueprints';

export async function openBench(cd: CampDay) {
  const { openFolio } = await import('../v11/blueprints/folio');
  const r = await openFolio({ at: 'bench' });
  const last = r.crafted[r.crafted.length - 1];
  if (last) await upgradeScene(cd, last, r.crafted.length);
  cd.s.hud?.refresh(true);
}

/** Jenna at work on what was just made */
async function upgradeScene(cd: CampDay, id: string, n: number) {
  const st = cd.st, s = cd.s, j = s.jenna;
  const d = BLUEPRINTS[id];
  if (!d || !j) return;
  await st.cut(async () => {
    cd.hold('jenna');
    st.place(j, C10.bench + 22, -1, 'wrench');
    const p = s.player;
    p.facing = 1;
    const sx = C10.bench + 12, sy = groundY(C10.bench) - 22;
    for (let i = 0; i < 6; i++) {
      j.setAnim(i % 2 ? 'hammer' : 'wrench');
      sfx(i % 2 ? 'hammer' : 'scanBeep', { vol: 0.3, pitch: 1.2 + rand.next() * 0.6 });
      for (let k = 0; k < 4; k++) s.main.glowParticles.spawn({ frame: A.dot, x: sx, y: sy, vx: rand.range(-40, 40), vy: rand.range(-60, -20), ay: 180, life: 0.4, color: [1, 0.85, 0.45], alpha: 1, alpha1: 0, glow: true, intensity: 2.5 });
      await wait(380);
    }
    j.setAnim('idle');
    j.faceTo(p.x);
    sfx('skillUnlock');
    await st.say([
      // (the speech bubbles want HTML: a bare & would never end)
      { who: 'jenna', text: n > 1 ? `Done! ${esc(d.name)}, and ${n - 1} more.` : `Done! ${esc(d.name)}.`, expr: 'excited', react: 'bounce' },
      { who: 'jenna', text: esc(d.line ?? 'Built to last. Probably. Mostly.'), expr: 'smug' },
    ]);
    addBond('jenna', 3);
  });
  cd.release('jenna');
  game.ui.toast(`Made: <b>${esc(d.name)}</b>. ${esc(d.effect ?? '')}`, 'BLUEPRINT', 'teal', 5000);
}
