// V12 Te Pō o te Matikuku, the night of the claw (see ./quest.ts for the story and flags). bootRaid()
// registers the quest and hooks Te Kāinga: by day the stake piles and the barricades (./prep.ts), at
// dusk or after dark with the barricades up the Bearer comes (./fight.ts), and afterwards the claw marks
// stay on the gateway and Koro waits by the fire.

import type { FieldScene } from '../../scenes/field';
import { onLocEnter } from '../../v10/field10';
import { game } from '../../game';
import { bark } from '../../v11/village/ctx';
import { X } from '../../v11/village/layout';
import { villageGround } from '../../v11/village/scene';
import { questStatus } from '../../quests';
import { RAID_ID, registerRaid, maybeStartRaid, raidActive, builtN, BARRICADES, F, setF } from './quest';
import { placeBarricades, placeWait, placeScar } from './prep';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** reload the village after dark (the wait at the fire, the dev points) */
export async function villageAtNight(x = X.fire + 60) {
  const ex = await import('../../v10/expedition');
  if (ex.currentExpedition()) ex.setExpeditionHour(21);
  await (await import('../../v11/village/debug')).go('night', x);
}

async function enterVillage(f: FieldScene) {
  registerRaid();
  if (maybeStartRaid()) bark('koro', 'Matikuku Nui will come for the goats. Not tonight, maybe; soon. The stakes are cut. Lash them across the lane.', { expr: 'serious' });
  placeScar(f);
  if (!raidActive() && !F('raid:won')) return;
  const bars = placeBarricades(f);
  placeWait(f, () => villageAtNight());
  // after the fight: Koro by the fire
  if (F('raid:won') && !F('raid:report')) {
    f.interact.push({
      x: X.fire, y: villageGround(X.fire) - 12, w: 34, h: 30, label: 'Sit with Koro by the fire', standX: X.fire - 34,
      enabled: () => !F('raid:report'), quest: () => questStatus(RAID_ID) === 'active' && !F('raid:report'),
      action: async () => { if (f.cutscene) return; const m = await import('./fight'); await m.fireTalk(f); },
    });
  }
  if (F('raid:won') || F('raid:started')) return;
  const dark = f.tod === 'night' || f.tod === 'dusk';
  if (!dark) return;
  if (builtN() < BARRICADES) {
    await sleep(2500);
    bark('rawiri', 'It’s getting dark and the lane’s wide open! The stakes, Mori!', { expr: 'worried' });
    return;
  }
  // the barricades are up and the light is going: it comes
  const m = await import('./fight');
  await sleep(3500);
  if (game.scene !== f) return;
  await m.startRaid(f, bars);
}

let booted = false;
export function bootRaid() {
  if (booted) return;
  booted = true;
  registerRaid();
  onLocEnter((f, loc) => (loc === 'village' ? enterVillage(f) : undefined));
}

/** dev: stage the quest at a point ('prep' barricades to build, 'ready' all built, 'won' the aftermath) */
export function stageRaid(to: 'prep' | 'ready' | 'won') {
  registerRaid();
  setF('feud:raidSoon');
  for (const k of ['raid:started', 'raid:won', 'raid:asleep', 'raid:fled', 'raid:lost', 'raid:photo', 'raid:report']) delete game.save.flags[k];
  game.save.vars['raid:built'] = to === 'prep' ? 0 : BARRICADES;
  maybeStartRaid(true);
  if (to === 'won') { setF('raid:started'); setF('raid:won'); setF('raid:asleep'); }
  game.persist();
  return to;
}
