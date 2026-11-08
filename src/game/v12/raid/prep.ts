// V12 the night of the claw, by day: Te Kāinga gets ready. Three piles of cut stakes wait where the
// market lane narrows between the gateway and the goats; Mori lashes each into a barricade (a short
// lashing QTE). Built barricades stand from then on (save var raid:built) and the fight knocks them
// down one state at a time (sound, cracked, smashed). With all three up, Koro's fire offers to wait
// there for dark.

import type { FieldScene } from '../../scenes/field';
import { Prop } from '../../../world/props';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { sprite } from '../../sites2/common';
import { villageGround } from '../../v11/village/scene';
import { X } from '../../v11/village/layout';
import { bark } from '../../v11/village/ctx';
import { qte } from '../qte';
import { passHours } from '../hunger';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { barricade, stakePile, clawScar } from '../../../art/v12/raid/art';
import { BARRICADES, builtN, raidActive, setV, V, F } from './quest';

/** where the lane narrows: east (first hit) to west (the last stand before the goats) */
export const BAR_X = [3460, 3080, 2700];

export interface Barricade {
  i: number;
  x: number;
  /** 0 sound, 1 cracked, 2 smashed (-1 not built yet) */
  state: -1 | 0 | 1 | 2;
  prop: Prop | null;
  pile: Prop | null;
}

const key = (i: number, s: number) => `raid:bar:${i}:${s}`;
function frameFor(i: number, s: 0 | 1 | 2) { return sprite(key(i, s), () => barricade(11 + i * 5, s))?.f ?? null; }

/** set a barricade's look (and keep it in the save for built ones) */
export function setBarricade(f: FieldScene, b: Barricade, s: 0 | 1 | 2) {
  b.state = s;
  const fr = frameFor(b.i, s);
  if (!fr) return;
  if (!b.prop) { b.prop = new Prop(fr, b.x, villageGround(b.x) + 3, -0.4, { foliage: false }); f.main.add(b.prop); }
  else b.prop.frame = fr;
  if (b.pile) b.pile.hidden = true;
}

/** lay the stake piles / barricades in the lane (called when the village is entered during the quest) */
export function placeBarricades(f: FieldScene): Barricade[] {
  const out: Barricade[] = [];
  const built = builtN();
  BAR_X.forEach((x, i) => {
    const b: Barricade = { i, x, state: -1, prop: null, pile: null };
    out.push(b);
    if (i < built) { setBarricade(f, b, F('raid:won') ? 2 : 0); return; }
    if (F('raid:started')) return;
    const pf = sprite(`raid:pile:${i}`, () => stakePile(21 + i));
    if (pf) { b.pile = new Prop(pf.f, x + 4, villageGround(x) + 3, -0.45, { foliage: false }); f.main.add(b.pile); }
    f.interact.push({
      x, y: villageGround(x) - 14, w: 26, h: 30, label: 'Lash the stakes into a barricade', standX: x - 24,
      enabled: () => raidActive() && b.state < 0 && !F('raid:started') && builtN() === i,
      quest: () => raidActive() && b.state < 0 && builtN() === i,
      action: () => lash(f, b),
    });
  });
  return out;
}

async function lash(f: FieldScene, b: Barricade) {
  if (f.cutscene) return;
  const r = await qte({ kind: 'seq', f, x: b.x, y: villageGround(b.x) - 60, label: 'LASH IT!', difficulty: 0.32 + b.i * 0.08, count: 4 + b.i, time: 6, pose: 'hammer' });
  if (!r.ok) {
    audio.play('wrong', { vol: 0.35 });
    void floatText({ text: 'The lashing slips. Again, tighter.', style: 'think', ms: 2000 });
    return;
  }
  audio.play('thud' as never, { vol: 0.5 });
  setBarricade(f, b, 0);
  const n = Math.max(V('raid:built'), b.i + 1);
  setV('raid:built', n);
  passHours(0.5, 'work');
  const cheer = [['rawiri', 'Ka pai! That one will hold a bull.'], ['tamati', 'Tighter than my nan’s bun. Next one!'], ['manu', 'Last one. Now it has to get through three of those.']][b.i] ?? ['rawiri', 'Ka pai!'];
  bark(cheer[0], cheer[1], { expr: 'happy' });
  if (n >= BARRICADES) floatNotice('All three barricades are up. Wait for dark at the fire, or see Big Hank first.', 3600, { tag: 'THE NIGHT OF THE CLAW', accent: '#ffd27a' });
}

/** the fire on the marae: wait there for dark (once the barricades are up) */
export function placeWait(f: FieldScene, goNight: () => Promise<void>) {
  const x = X.fire;
  f.interact.push({
    x, y: villageGround(x) - 10, w: 30, h: 26, label: 'Sit by the fire and wait for dark', standX: x - 30,
    enabled: () => raidActive() && builtN() >= BARRICADES && !F('raid:started') && f.tod !== 'night',
    quest: () => raidActive() && builtN() >= BARRICADES && !F('raid:started') && f.tod !== 'night',
    action: async () => {
      if (f.cutscene) return;
      f.cutscene = true;
      bark('koro', 'Sit, e hoa. It comes when the cooking smoke is cold.', { expr: 'serious' });
      passHours(4, 'rest');
      await new Promise(r => setTimeout(r, 1800));
      f.cutscene = false;
      await goNight();
    },
  });
}

/** after the raid: the claw marks stay on the gateway's post */
export function placeScar(f: FieldScene) {
  if (!F('raid:won')) return;
  const s = sprite('raid:scar', () => clawScar(9));
  if (s) f.main.add(new Prop(s.f, X.gate - 22, villageGround(X.gate) - 26, -3.9, { foliage: false }));
}

export const builtAll = () => builtN() >= BARRICADES;
export { game };
