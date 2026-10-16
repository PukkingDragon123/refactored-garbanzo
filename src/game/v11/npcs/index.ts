// V11 NPCs: boot. Registers the people (social registry + talk), their quests, recipes, blueprints
// and items, the camp events, the crew chat extras, and the scene spawner (field10 onLocEnter); K
// opens the people book. Debug: zl.social (see NPC_ZL).

import { game } from '../../game';
import './people';
import { registerNpcQuests } from './quests';
import './campvisits';
import { spawnFor, SPOTS } from './spawn';
import * as SOC from '../social';
import { startQuest } from '../../quests';
import { give } from '../../inventory';
import { registerNpcArt } from '../../../art/v11/npcs/register';

let booted = false;
export async function bootNpcs() {
  if (booted) return;
  booted = true;
  registerNpcArt();
  registerNpcQuests();
  const { onLocEnter } = await import('../../v10/field10');
  onLocEnter(spawnFor);
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyK' || e.repeat) return;
    const sc = game.scene as unknown as { cutscene?: boolean; player?: unknown } | null;
    if (!sc?.player || sc.cutscene || game.ui.blocking) return;
    void import('../../../ui/v11/social').then(m => { if (!m.peopleOpen()) void m.openPeople(); });
  });
}

/** zl.social: poke the relationships from the console */
export const NPC_ZL = {
  people: () => SOC.relationships({ includeUnmet: true }).map(p => `${p.id} ${p.affinity} ${p.tierName}${p.partner ? ' (partner)' : ''}`),
  book: async (id?: string) => (await import('../../../ui/v11/social')).openPeople(id),
  gift: async (id: string) => (await import('../../../ui/v11/social')).pickGift(id),
  note: async (q: string) => (await import('../../../ui/v11/social')).questNote(q),
  meet: (id: string, aff = 0) => { SOC.meet(id); if (aff) SOC.addAffinity(id, aff, 'debug'); return SOC.affinity(id); },
  aff: (id: string, n: number) => { SOC.addAffinity(id, n, 'debug'); return SOC.affinity(id); },
  quest: (id: string) => startQuest(id),
  give: (id: string, n = 1) => give(id, n),
  partner: () => SOC.partner(),
  advance: (id: string) => SOC.advanceRomance(id),
  /** home-shore x of the NPC places (camp-scene teleports) */
  spots: SPOTS,
};
