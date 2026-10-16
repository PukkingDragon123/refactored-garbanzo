// V11: optional light romance. Only adults, only people marked romanceable (Jenna 24, Aroha 22, Teo
// 27, Sunny 29), never pushy: Mori is the one who asks, every step ends on his choice between going
// on and "you're a really good friend" (which closes the subject kindly, for good unless he reopens
// it), and there is only ever one partner. The steps, when they're close enough (social.ts
// canGrowCloser):
//   1  a walk together (along the water, wherever they are)
//   2  a shared meal (Mori brings the food: a dish from the fire, or whatever's in the pack)
//   3  the confession: "I'd like us to be together" or "you matter to me, as a friend"
// After that: walks as dates (once a day), and a gentle way back to friendship if he wants it. The
// crew react kindly at dinner (campvisits.ts). The village festival reads partner() for its dance.

import { game } from '../../game';
import { ITEMS } from '../../items';
import { remove } from '../../inventory';
import { addAffinity, advanceRomance, stayFriends, reopenRomance, canGrowCloser, romanceStage, partner, isFriendsOnly, romanceable, tier, hasMet, memo, setMemo } from '../social';
import { day, sleep } from './state';
import type { MenuOpt, TalkHost, Line } from './types';
import { L } from './types';
import { clamp } from '../../../core/math';

interface RomanceBook {
  walk: Line[];
  walkYes: Line[];
  walkFriends: Line[];
  meal: Line[];
  mealYes: Line[];
  mealFriends: Line[];
  confess: Line[];
  together: Line[];
  asFriends: Line[];
  date: Line[][];
  backToFriends: Line[];
  reopen: Line[];
}
const R: Record<string, RomanceBook> = {
  jenna: {
    walk: [['jenna', 'A walk? Like a WALK walk? ...Okay. Yes. Let me just put down this soldering iron. Carefully. So I don’t set the beach on fire.', 'surprised'],
      ['jenna', 'You know what I like about out here? Nobody’s looking at a screen. Not even me. Okay, not even me for five minutes.', 'happy'],
      ['jenna', 'The water does this thing at the edge, see? Where it goes all silver. I could watch it for ages.', 'happy']],
    walkYes: [['jenna', 'Again sometime? ...Yeah. I’d really like that.', 'happy']],
    walkFriends: [['jenna', 'Best friends. Obviously. You and me and a soldering iron against the world.', 'happy']],
    meal: [['jenna', 'You brought dinner? For us? Nobody brings me dinner. Dad brings me “eat something or you’ll fall over”.', 'surprised'], ['jenna', 'This is nice. This is really nice. You’re really nice. That’s the review.', 'happy']],
    mealYes: [['jenna', 'Same time tomorrow? I mean. Not tomorrow. Whenever. I’m not being weird. I’m being very normal.', 'teasing']],
    mealFriends: [['jenna', 'Friends who eat together stay together. That’s a law. I just made it.', 'happy']],
    confess: [['jenna', 'You’ve got your serious face on. You never do the serious face. Is it the battery? Is Brenda okay?', 'worried']],
    together: [['jenna', '...Oh. OH. Me too. I mean. Yes. I’ve been trying to fix a way to say that for weeks and I had no idea which wire to cut.', 'happy'], ['jenna', 'Dad is going to be SO weird about this. I don’t care. Come here.', 'laugh']],
    asFriends: [['jenna', 'You matter to me too. Like, a lot. Friends. The good kind. The kind that steals your snacks.', 'happy']],
    date: [[['jenna', 'Another walk? With me? Every time you ask it’s like getting a new gadget.', 'happy'], ['jenna', 'Don’t tell Dad I said that. He thinks gadgets are my true love.', 'teasing']],
      [['jenna', 'I made you something. It’s a little light that goes on when you’re back at camp. So I know. It’s not creepy, it’s romantic engineering.', 'smug']]],
    backToFriends: [['jenna', 'Okay. Okay. I get it. Thank you for telling me. We’re still us, right? Best friends, Brenda and everything.', 'sad'], ['jenna', '...Yeah. We are. Go on, before I make it weird.', 'happy']],
    reopen: [['jenna', 'You want to... try again? Walks and everything? ...I’d like that. I’d really like that.', 'happy']],
  },
  aroha: {
    walk: [['aroha', 'A walk? You mean, not looking for anything? No camera?', 'surprised'], ['mori', 'Maybe a little camera.', 'teasing'],
      ['aroha', 'Mm. Come on then. Quietly. Heel last.', 'teasing'],
      ['aroha', 'My nan used to walk the beach every evening. She said the sea tells you what kind of day tomorrow will be.', 'thinking'],
      ['mori', 'What’s it saying?', 'neutral'], ['aroha', 'That you walk too loud.', 'laugh']],
    walkYes: [['aroha', 'Again, then. Ka pai. I’d like that.', 'happy']],
    walkFriends: [['aroha', 'E hoa. Friend. That’s a good word. It means more than you think.', 'happy']],
    meal: [['aroha', 'You cooked? For me? ...You did it right, too. Who taught you? Never mind, I know. Me.', 'smug'],
      ['aroha', 'Koro says the best thing you can give someone is kai you made with your own hands. He’d like you more than he says.', 'happy']],
    mealYes: [['aroha', 'Next time I cook. And you’ll eat it, even the huhu grubs.', 'teasing']],
    mealFriends: [['aroha', 'Sharing kai makes whānau. Friends who eat together. That’s us.', 'happy']],
    confess: [['aroha', 'You’ve been quiet all day. Not bush-quiet. Thinking-quiet. Kōrero mai. Tell me.', 'serious']],
    together: [['aroha', '...', 'surprised'], ['aroha', 'You walk too loud, and you talk to crabs, and you look at this island like it’s the best thing you’ve ever seen.', 'happy'],
      ['aroha', 'I’d like that too, Mori. Us.', 'happy'], ['aroha', 'Koro will want to meet you properly. He’ll make you sit and eat for three hours. Be ready.', 'laugh']],
    asFriends: [['aroha', 'You matter to me too. You and your loud boots. Friends.', 'happy']],
    date: [[['aroha', 'Walk with me to the point. There’s a ruru that calls from the rocks at night. I want you to hear it.', 'happy']],
      [['aroha', 'I told my cousins about you. They want to know if you can climb. I said no. They laughed for a very long time.', 'teasing']]],
    backToFriends: [['aroha', 'Mm. Okay. I hear you. Thank you for saying it straight. That’s how it should be said.', 'serious'], ['aroha', 'Nothing changes on the track. You still walk too loud and I still look after you.', 'happy']],
    reopen: [['aroha', 'You want to try again. ...Okay. Slowly, though. Like stalking a kererū.', 'happy']],
  },
  teo: {
    walk: [['teo', 'A walk? With me? Now? Yes. Yes! Let me just... where are my... I’m wearing them. I’m wearing my boots. Okay.', 'surprised'],
      ['teo', 'Back home the sun goes down at three in the winter. Here it just... takes its time. Like it likes the view.', 'happy'],
      ['teo', 'Sorry. I talk too much when I’m nervous. I’m always nervous. You know that.', 'worried']],
    walkYes: [['teo', 'Again? Really? Okay. Yes. I’m going to bake about this. A lot.', 'happy']],
    walkFriends: [['teo', 'Friends. Yeah. You’re the best one I’ve got here. Barry the crab is a distant second.', 'happy']],
    meal: [['teo', 'You brought FOOD. Real food. Not from a packet. I might cry. I’m not going to cry. I’m a little bit crying.', 'happy'],
      ['teo', 'This is the nicest dinner I’ve had in... ever, actually. And I’ve had my mum’s buns.', 'happy']],
    mealYes: [['teo', 'Next time I cook. Skillet bread. It’s the only thing I can make, so prepare to be amazed, once.', 'laugh']],
    mealFriends: [['teo', 'Friend dinners. Best kind. I’ll bring the bread.', 'happy']],
    confess: [['teo', 'Is everything okay? You look like Dr Varga before a budget meeting.', 'worried']],
    together: [['teo', 'You... me? Really? Me with the boots?', 'surprised'], ['teo', 'I like you so much it’s been really hard to put things in tubes. Yes. Yes, I’d like that. A lot.', 'happy'],
      ['teo', 'Dr Varga is going to say “I knew it” in that voice. I don’t even care.', 'laugh']],
    asFriends: [['teo', 'You matter to me too. Like, a lot. Okay. Friends. Good friends. I’m really glad you told me.', 'happy']],
    date: [[['teo', 'I brought bread. For the walk. In case we get lost. We won’t get lost. But bread.', 'happy']],
      [['teo', 'I told my mum about you on the radio relay. She said “finally”. I don’t know what she means. I know what she means.', 'laugh']]],
    backToFriends: [['teo', 'Oh. Okay. That’s... okay. Thank you for telling me straight. I’d rather know.', 'sad'], ['teo', 'Still friends? I’ll still save you the last bread. Half the last bread.', 'happy']],
    reopen: [['teo', 'You want to try again? Me? Okay. Okay! I’m going to try very hard to be normal about it.', 'happy']],
  },
  sunny: {
    walk: [['sunny', 'A WALK? Mori! Are you asking me out on a walk? ...Yeah, all right. Lead on, big shot.', 'surprised'],
      ['sunny', 'You know what my mum says? Walk with someone for an hour and you know if you’ll like them for a year.', 'happy'],
      ['sunny', 'So far, so good. Don’t trip. You’ll ruin it.', 'teasing']],
    walkYes: [['sunny', 'Again? Yeah. Yeah, I’d like that. Don’t tell Rua. He’ll make a face. Well. More face.', 'laugh']],
    walkFriends: [['sunny', 'Friends! Choice. Best mate in the lowlands. That’s a title. You’ve earned it.', 'happy']],
    meal: [['sunny', 'You cooked? For ME? The best cook in the hills? That’s brave, bro. That’s really brave.', 'surprised'],
      ['sunny', '...Okay this is actually good. Don’t look at me like that. It’s GOOD. I’m allowed to say good.', 'happy']],
    mealYes: [['sunny', 'Next time, my mum’s boil-up. Proper. And then you’ll know what you’re in for.', 'happy']],
    mealFriends: [['sunny', 'Mates who eat together. Best kind. Next one’s on me.', 'happy']],
    confess: [['sunny', 'You’re doing a face. You’re doing a big face. Whatever it is, just say it, Mori. I don’t bite. Much.', 'teasing']],
    together: [['sunny', '...Huh. Well. Okay. I wasn’t expecting... yeah I was. I was totally expecting that.', 'laugh'], ['sunny', 'Yes. Course yes. You and me.', 'happy'],
      ['sunny', 'I’m telling Mum. She’s going to ask if you can dance. You can learn.', 'teasing']],
    asFriends: [['sunny', 'You matter too, Mori. Friends. Faleolo-promise friends. Those are forever.', 'happy']],
    date: [[['sunny', 'Walk? Only if I get to pick the spot. There’s a rock up here where you can see three valleys at once.', 'happy']],
      [['sunny', 'I taught Rua a dance step. He hated it. He did it twice. That’s love, Mori. That’s what love looks like on Rua.', 'laugh']]],
    backToFriends: [['sunny', 'Yeah? Okay. No, I get it. Thanks for saying it to my face. That’s respect.', 'serious'], ['sunny', 'Still my best mate in the lowlands. Don’t you dare go quiet on me.', 'happy']],
    reopen: [['sunny', 'You want to try again? HA. Okay. But I’m picking the walks this time.', 'happy']],
  },
};

const lead = (id: string) => (id === 'jenna' || id === 'aroha' || id === 'joshu' ? 'Walk with me for a bit?' : 'Want to go for a walk?');

/** a short stroll side by side, wherever they are */
async function stroll(h: TalkHost, dist = 90) {
  const f = h.f, a = h.a;
  if (!f || !a) return;
  const p = f.player;
  const dir: 1 | -1 = p.x + dist < (f.st.maxX ?? 1e9) - 60 ? 1 : -1;
  const tx = clamp(p.x + dir * dist, (f.st.minX ?? 0) + 40, (f.st.maxX ?? 1e9) - 40);
  a.stopWalk();
  await Promise.race([Promise.all([p.walkTo(tx, 34), a.walkTo(tx + dir * 18, 36)]), sleep(5000)]);
  a.faceTo(p.x);
  p.facing = a.x > p.x ? 1 : -1;
}
/** the food Mori brings to a meal: a cooked dish if there is one, else any food */
function mealFood(): string | null {
  const inv = game.save.inv.filter(s => s.n > 0 && ITEMS[s.id]?.kind === 'food');
  return (inv.find(s => s.id.startsWith('dish_')) ?? inv[0])?.id ?? null;
}

async function withCut<T>(h: TalkHost, fn: () => Promise<T>): Promise<T> {
  const f = h.f;
  const was = f?.cutscene ?? false;
  if (f) f.cutscene = true;
  try { return await fn(); } finally { if (f) f.cutscene = was; }
}

async function walk(h: TalkHost) {
  const id = h.id, b = R[id];
  await withCut(h, async () => {
    await stroll(h);
    const ls = L(b.walk);
    ls[ls.length - 1] = { ...ls[ls.length - 1], choices: ['I’d like to do this again.', 'You’re a really good friend.'] };
    const c = await h.say(ls);
    if (c === 0) { advanceRomance(id); addAffinity(id, 4, 'walk'); h.a?.showEmote('heart', 1.6); await h.say(L(b.walkYes)); }
    else { stayFriends(id); addAffinity(id, 2, 'friends'); await h.say(L(b.walkFriends)); }
  });
}
async function meal(h: TalkHost) {
  const id = h.id, b = R[id];
  const food = mealFood();
  if (!food) { await h.say(L([['mori', '(I’d need something to eat first. Something from the fire, ideally.)', 'thinking']])); return; }
  await withCut(h, async () => {
    remove(food, 1);
    const p = h.f?.player, a = h.a;
    p?.body.setAnim('sitGround'); a?.setAnim('sitGround');
    await sleep(700);
    a?.play('eat', 'sitGround').catch(() => {});
    const ls = L([['mori', `I brought ${ITEMS[food]?.name.toLowerCase() ?? 'food'}. Enough for two.`, 'happy'], ...b.meal]);
    ls[ls.length - 1] = { ...ls[ls.length - 1], choices: ['This was perfect.', 'Thanks for being my friend.'] };
    const c = await h.say(ls);
    if (c === 0) { advanceRomance(id); addAffinity(id, 5, 'meal'); a?.showEmote('heart', 1.6); await h.say(L(b.mealYes)); }
    else { stayFriends(id); addAffinity(id, 3, 'friends'); await h.say(L(b.mealFriends)); }
    p?.body.setAnim('idle'); a?.setAnim(a.idleAnim);
  });
}
async function confess(h: TalkHost) {
  const id = h.id, b = R[id];
  await withCut(h, async () => {
    await stroll(h, 50);
    const ls = L([...b.confess, ['mori', 'There’s something I want to say. And whatever you say back is okay.', 'serious']]);
    ls[ls.length - 1] = { ...ls[ls.length - 1], choices: ['I’d like us to be together.', 'You matter to me. As a friend.'] };
    const c = await h.say(ls);
    if (c === 0) {
      advanceRomance(id);
      addAffinity(id, 8, 'together');
      h.a?.showEmote('heart', 2.2);
      h.f?.player.body.showEmote('heart', 2.2);
      await h.say(L(b.together));
      game.ui.toast(`You and <b>${id === 'jenna' ? 'Jenna' : id === 'aroha' ? 'Aroha' : id === 'teo' ? 'Teo' : 'Sunny'}</b> are together.`, 'TOGETHER', 'coral', 4200);
    } else { stayFriends(id); addAffinity(id, 4, 'friends'); await h.say(L(b.asFriends)); }
  });
}
async function date(h: TalkHost) {
  const id = h.id, b = R[id];
  await withCut(h, async () => {
    await stroll(h, 70);
    const n = memo(id, 'dates');
    setMemo(id, 'dates', n + 1);
    setMemo(id, 'dateDay', day());
    await h.say(L(b.date[n % b.date.length]));
    addAffinity(id, 2, 'date');
    h.a?.showEmote('heart', 1.4);
  });
}
async function talkAboutUs(h: TalkHost) {
  const id = h.id, b = R[id];
  const c = await h.say(L([['mori', 'Can we talk? About us.', 'serious']]).map((l, i, a) => (i === a.length - 1 ? { ...l, choices: ['I think we’re better as friends.', 'Never mind. I just wanted to see you.'] } : l)));
  if (c === 0) { stayFriends(id); await h.say(L(b.backToFriends)); }
  else { await h.say(L([[id, 'You’re sweet. Come here.', 'happy']])); h.a?.showEmote('heart', 1.4); }
}

/** the romance entries for someone's conversation menu (empty unless the moment is right) */
export function romanceMenu(id: string): MenuOpt[] {
  if (!romanceable(id) || !hasMet(id) || !R[id]) return [];
  const out: MenuOpt[] = [];
  const st = romanceStage(id);
  if (partner() === id) {
    if (memo(id, 'dateDay') !== day()) out.push({ label: lead(id), run: date });
    out.push({ label: 'Can we talk about us?', run: talkAboutUs });
    return out;
  }
  if (isFriendsOnly(id)) {
    // the subject is closed; Mori can reopen it himself once in a while, when they're close
    if (!partner() && tier(id) >= 2 && memo(id, 'reopenAsk') !== day()) out.push({ label: 'About us being friends...', run: async h => {
      setMemo(id, 'reopenAsk', day());
      const c = await h.say([{ who: 'mori', text: 'I said we were friends. Lately I’ve been wondering if I said the wrong thing.', expr: 'thinking', choices: ['Could we try again?', 'Never mind. Friends is good.'] }]);
      if (c === 0) { reopenRomance(id); await h.say(L(R[id].reopen)); } else await h.say(L([[id, 'Friends is good.', 'happy']]));
    } });
    return out;
  }
  if (!canGrowCloser(id)) return out;
  if (st === 0) out.push({ label: lead(id), run: walk });
  else if (st === 1) { if (mealFood()) out.push({ label: 'Share a meal with me?', run: meal }); }
  else if (st === 2) out.push({ label: 'There’s something I want to say.', run: confess });
  return out;
}
