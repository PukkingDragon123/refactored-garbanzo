// V11 NPCs: a conversation. The person says what's on their mind (social.ts conversation(): tiered,
// story-aware), and the last line offers what Mori can do with them right now: hand something in or
// finish a quest step, take on a request, give a gift from the pack (the gift tray), the next romance
// step if the moment is right, or just say goodbye. The first chat of the day warms them up a little.
// The crew's camp chats get the same gift and romance options (camptalk.ts addTalkExtra).

import { game } from '../../game';
import type { BubbleLine } from '../../../ui/bubbles';
import { conversation, meet, hasMet, addAffinity, talkedToday, markTalked, giftable, giftedToday, giveGift, PEOPLE } from '../social';
import type { GiftReaction } from '../social';
import { questMenu, tagMenu } from './quests';
import { romanceMenu } from './romance';
import type { MenuOpt, TalkHost } from './types';

const EXPR: Record<GiftReaction, string> = { love: 'happy', like: 'happy', neutral: 'neutral', dislike: 'worried', hate: 'angry' };
const EMOTE: Partial<Record<GiftReaction, string>> = { love: 'heart', like: 'sparkle', hate: 'anger', dislike: 'sweat' };

/** the gift entry: open the tray, give, react */
export function giftOpt(id: string): MenuOpt | null {
  if (giftedToday(id) || !giftable().length || !PEOPLE[id]) return null;
  return {
    label: 'I brought you something.',
    run: async h => {
      const { pickGift } = await import('../../../ui/v11/social');
      const item = await pickGift(id);
      if (!item) { await h.say([{ who: id, text: id === 'chunk' ? '*sniffs your empty hand, betrayed*' : 'Oh. Okay. Another time, then.', expr: 'neutral' }]); return; }
      const r = giveGift(id, item);
      if (!r) return;
      if (EMOTE[r.reaction]) h.a?.showEmote(EMOTE[r.reaction]!, 1.6);
      if (r.reaction === 'love') h.a?.react('bounce');
      await h.say([{ who: id, text: r.line, expr: EXPR[r.reaction] }]);
      (game.scene as unknown as { hud?: { refresh(f?: boolean): void } } | null)?.hud?.refresh(true);
    },
  };
}

/** everything Mori could do with someone right now (quest steps first, goodbye is added by the caller) */
export function menuFor(id: string): MenuOpt[] {
  const out: MenuOpt[] = [];
  out.push(...questMenu(id), ...tagMenu(id));
  const g = giftOpt(id);
  if (g) out.push(g);
  out.push(...romanceMenu(id));
  return out;
}

/** a full conversation with one of the new people */
export async function converse(h: TalkHost): Promise<void> {
  const id = h.id;
  meet(id);
  const said = conversation(id) ?? [{ who: id, text: '...', expr: 'neutral' }];
  if (!talkedToday(id)) { markTalked(id); addAffinity(id, 2, 'chat'); }
  const lines: BubbleLine[] = said.map(l => ({ who: l.who, text: l.text, expr: l.expr ?? 'neutral' }));
  const menu = menuFor(id).slice(0, 4);
  if (menu.length) lines[lines.length - 1] = { ...lines[lines.length - 1], choices: [...menu.map(m => m.label), 'See you later.'] };
  const c = await h.say(lines);
  if (c >= 0 && c < menu.length) await menu[c].run(h);
}

void hasMet;
