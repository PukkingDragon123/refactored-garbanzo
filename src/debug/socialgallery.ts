// ?gallery=social : the pixel-art people UI with a made-up week of friendships (nothing is saved):
// the people book (crew page and an NPC page), the gift tray and a quest note, at whole-pixel scale.
// &scale=3, &who=teo picks the person shown on the right page.
import { game } from '../game/game';
import { newSave } from '../game/save';
import { add } from '../game/inventory';

export async function runSocialGallery() {
  const q = new URLSearchParams(location.search);
  const k = Number(q.get('scale') ?? 2);
  game.save = newSave();
  (game as unknown as { persist: () => void }).persist = () => {};
  game.save.day = 7;
  game.save.flags['v4:day1'] = true;
  const S = await import('../game/v11/social');
  await import('../game/v11/npcs/people');
  const Q = await import('../game/v11/npcs/quests');
  Q.registerNpcQuests();
  const { startQuest } = await import('../game/quests');
  const UI = await import('../ui/v11/social');
  for (const [id, a] of [['hine', 38], ['doug', 52], ['rosie', 64], ['teo', 61], ['celeste', 18], ['marge', 30], ['sunny', 47], ['rua', 12], ['tipene', 22], ['ngaio', 26]] as [string, number][]) { S.meet(id); S.addAffinity(id, a); }
  S.addAffinity('jenna', 30); S.addAffinity('aroha', 52);
  for (const [id, n] of [['tea', 2], ['feather', 3], ['shell_fan', 2], ['berry_gold', 5], ['wood', 4], ['rope', 2], ['flaxleaf', 6], ['dish_porridge', 1], ['kawakawa', 3], ['driftglass', 2], ['v10_fish', 1], ['grub', 2], ['q_page', 2], ['moss', 1]] as [string, number][]) add(id, n);
  S.giveGift('teo', 'berry_gold');
  S.revealTaste('teo', 'bug_hornet');
  S.revealTaste('teo', 'dish_porridge');
  S.advanceRomance('teo');
  startQuest('q_home', true);
  startQuest('q_roof', true);
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#2a2a30;display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start';
  const show = (c: HTMLCanvasElement) => { c.style.width = c.width * k + 'px'; c.style.height = c.height * k + 'px'; c.style.imageRendering = 'pixelated'; document.body.appendChild(c); };
  const who = q.get('who') ?? 'teo';
  for (const sel of [who, 'jenna']) { const s = UI.peopleScreen(sel); s.redraw(); show(s.cv); }
  const g = UI.giftScreen(who, () => {}); g.redraw(); show(g.cv);
  const n = UI.noteScreen('q_roof'); if (n) { n.redraw(); show(n.cv); }
}
