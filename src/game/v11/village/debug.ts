// V11 Te Kāinga debug helpers (zl.village() in the console returns this module):
//   (await zl.village()).rhythm('awa', 'normal')   the hue kiri lesson (unlocks what it needs)
//   (await zl.village()).dance()                   the serpent dance with the partner
//   (await zl.village()).stage('festival')         set the quest flags up to a point: 'start',
//                                                  'story', 'kiri', 'festival' (ready for the night)
//   (await zl.village()).story() / offering() / blessing() / festival()   run a beat in the village
//   (await zl.village()).ctx()                     the village of the scene being played

import { game } from '../../game';
import { give, count } from '../../inventory';
import { startQuest, questStatus } from '../../quests';
import { villageCtx } from './scene';
import { setVf, registerVillageQuests } from './lore';

export const ctx = () => villageCtx();

/** load the village at a time of day (Mori at x) */
export async function go(tod: 'dawn' | 'day' | 'dusk' | 'night' = 'day', x = 1000) {
  const { FieldScene } = await import('../../scenes/field');
  const { VILLAGE } = await import('../../sites10/village');
  const ex = await import('../../v10/expedition');
  await game.go(() => { const s = new FieldScene({ ...VILLAGE, spawnX: x } as never, tod); ex.tagScene(s, 'village'); return s; });
  for (let i = 0; i < 200 && !villageCtx(); i++) await new Promise(r => setTimeout(r, 50));
  return 'ok';
}
/** the dance practice with Aunty Hana (in the village) */
export async function practice() {
  const c = villageCtx();
  if (!c) return 'not in the village';
  const L = await import('./lessons');
  c.f.cutscene = true;
  try { await L.dancePractice(c); } finally { c.f.cutscene = false; }
  return 'ok';
}

export function stage(to: 'start' | 'story' | 'kiri' | 'festival' | 'done') {
  registerVillageQuests();
  const order = ['start', 'story', 'kiri', 'festival', 'done'];
  const k = order.indexOf(to);
  game.save.flags['v10:villageMet'] = true;
  game.save.flags['aroha:met'] = true;
  if (questStatus('v11_hinerua') === 'hidden') startQuest('v11_hinerua', true);
  if (k >= 1) { setVf('askPou'); setVf('story'); setVf('heardHana'); if (questStatus('v11_festival') === 'hidden') startQuest('v11_festival', true); if (questStatus('v11_huekiri') === 'hidden') startQuest('v11_huekiri', true); }
  if (k >= 2) { setVf('skinFound'); setVf('kiriGiven'); if (!count('vil_huekiri')) give('vil_huekiri', 1); }
  if (k >= 3) { setVf('prep:wood'); setVf('prep:kai'); setVf('prep:dance'); setVf('song:awa'); }
  if (k >= 4) { setVf('offering'); game.save.flags['v10:koroBlessing'] = true; setVf('festival'); }
  game.persist();
  return to;
}

export async function rhythm(song = 'awa', diff: 'easy' | 'normal' | 'hard' = 'normal', direct = true) {
  setVf('kiriGiven');
  const { runHueKiri } = await import('../../../ui/v11/rhythm');
  return runHueKiri({ song: direct ? song : undefined, diff, music: 'aroha' });
}
export async function dance(diff: 'practice' | 'festival' = 'festival') {
  const { runDance } = await import('../../../ui/v11/dance');
  const { festivalPartnerChoice } = await import('./festival');
  return runDance({ partner: festivalPartnerChoice(), mode: diff });
}
const withCtx = async (fn: (m: typeof import('./ritual'), c: NonNullable<ReturnType<typeof villageCtx>>) => Promise<void>) => {
  const c = villageCtx();
  if (!c) return 'not in the village';
  const m = await import('./ritual');
  c.f.cutscene = true;
  try { await fn(m, c); } finally { c.f.cutscene = false; }
  return 'ok';
};
export const story = () => withCtx((m, c) => m.storyByFire(c));
export const offering = () => withCtx((m, c) => m.offering(c));
export const blessing = () => withCtx((m, c) => m.blessing(c));
/** set everything up for the festival and load the village after dark: the night plays */
export async function festival() {
  stage('festival');
  return go('night', 1300);
}
