// V12 NPCs: Hank "Big Hank" Mulvaney (54), the dealer at the end of Te Huarahi, the market lane.
//
// Fat, sweaty, jokey and shady, from Dayton, Ohio: an aloha shirt, a trucker cap, aviators even at
// night, an unlit cigar. Whispers "psst", winks, says the stock "fell off a boat", asks no questions.
// He's there from Day 3 of the camp loop, always at his tarp stall (he sleeps in his chair at night).
//
// The heart of him comes out slowly (his talk tiers and story beats): everything he makes goes into an
// account in his daughter Lily's name back in Ohio. He missed most of her childhood chasing deals; her
// mum raised her; Lily (11) doesn't know the money is from him. He keeps a creased photo of her in his
// wallet and a framed one on a crate; she's mad about snakes.
//
// The shop is a barter (there is no money on the island except research, and Hank takes that as
// "agency vouchers: they spend in Auckland"): the weapon belt (src/game/v12/arsenal.ts) and its ammo for
// things Mori collects in the world. The wares float beside him (src/ui/v12/wares.ts).
//
//   q_lily   A picture for Lily: a good photograph of a giant feathered boa (plumeboa), uploaded and
//            identified (or the v4:photo:plumeboa flag), brought to him. He gets choked up: free ammo
//            forever, and the dart rifle (or whatever Mori hasn't got) on the house.

import { game } from '../../game';
import type { BubbleLine } from '../../../ui/bubbles';
import { definePerson, defineTalk, tier, memo, setMemo, hasMet, addAffinity, PEOPLE } from '../social';
import type { TalkLine } from '../social';
import { QUESTS, QUEST_BY_ID, questStatus } from '../../quests';
import type { QuestDef, Giver } from '../../quests';
import { count, remove } from '../../inventory';
import { ITEMS } from '../../items';
import { NPC_QUESTS, NPC_QUEST_BY_ID } from './quests';
import type { NpcQuest } from './quests';
import { F, setF, day } from './state';
import type { MenuOpt, TalkHost } from './types';
import { L } from './types';
import { WEAPONS, WEAPON_BY_ID, ownsWeapon, ammo, ammoMax, setAmmo, giveWeapon, freeAmmo } from '../../v12/arsenal';
import type { WeaponId } from '../../v12/arsenal';

// ================================================================== who he is
definePerson({
  id: 'hank', name: 'Hank', group: 'trader', adult: true, age: 54, taken: true,
  role: 'Trader (of sorts), the end of Te Huarahi', color: '#c02a20', home: 'village', where: 'His tarp stall at the end of Te Huarahi, the market lane',
  blurb: 'Big Hank Mulvaney, from Dayton, Ohio. Sells things that fell off a boat. Asks no questions and answers fewer. Keeps a photo of his daughter Lily on a crate.',
  loves: ['shedskin', 'scale', 'vil_hangi', 'dish_boilup', 'stew'], likes: ['kind:food', 'resin', 'driftglass', 'kind:shell', 'v10_fish', 'fos_tooth'], dislikes: ['kawakawa', 'tea', 'vil_tea', 'moss'], hates: ['dropping', 'bug_hornet'],
  giftLines: {
    love: ['Is that... a real shed skin? Lily is gonna FLIP. You know what, this one\'s going in the mail. Thanks, kid.', 'Oh, now we\'re talking. Hank eats tonight. Hank eats like a KING tonight.'],
    like: ['Hey, I can move this. Thanks, pal. No questions where you got it, and I won\'t ask.', 'Nice. Nice! Goes straight on the shelf. I\'ll get you a shelf.'],
    neutral: ['Huh. A {item}. Well, everything\'s worth something to somebody.'],
    dislike: ['Kid. I\'m from Ohio. That\'s a lawn clipping.', 'Tea? Do I look like I drink tea? Don\'t answer that.'],
    hate: ['Whoa, whoa, WHOA. Get that away from my merchandise.'],
  },
});

// ================================================================== what he talks about
type T = [string, string, string?, string?];
const lines = (c: T[]): TalkLine[] => c.map(([who, text, expr, style]) => ({ who, text, expr: expr ?? 'neutral', ...(style ? { style } : {}) }) as TalkLine);
const night = () => (game.scene as unknown as { tod?: string } | null)?.tod === 'night';
const done = (q: string) => questStatus(q) === 'done';
const said = (k: string) => memo('hank', 's:' + k) > 0;
/** the photo of the feathered boa: uploaded and identified, or the photo flag */
export const lilyPhoto = () => !!game.save.research?.['plumeboa'] || !!game.save.flags['v4:photo:plumeboa'];

const INTRO: T[] = [
  ['hank', 'Psst. Hey. HEY. Camera guy. Over here. Under the tarp.', 'smug', 'whisper'],
  ['mori', '...Hello?', 'surprised'],
  ['hank', 'Hank Mulvaney. Big Hank, to my friends, which is everybody. Dayton, Ohio, born and sweated.', 'happy'],
  ['mori', 'Mori. What are you doing all the way out here?', 'thinking'],
  ['hank', 'Commerce, my friend. Import, export. Mostly import. A few crates fell off a boat and I happened to be standing where they landed.', 'teasing'],
  ['hank', 'No questions. That\'s the house rule.', 'smug', 'whisper'],
  ['hank', 'Things bite out there. You want something that makes \'em think twice, you see Hank. I take trade. I take your agency vouchers. I take pity, on a slow day.', 'smug'],
];
const TIERS: T[][][] = [
  [
    [['hank', 'Hot enough for ya? I been sweating since nineteen eighty-six.', 'tired'], ['mori', 'You could take the cap off.', 'teasing'], ['hank', 'And let the sun see my head? Pal. Nobody needs to see that.', 'laugh']],
    [['hank', 'Rule one at Hank\'s: everything\'s genuine. Rule two: don\'t ask what it\'s a genuine one OF.', 'smug']],
    [['hank', 'The bangers came from a licensed marine supplier.', 'teasing', 'whisper'], ['mori', 'Did they?', 'thinking'], ['hank', 'They came off a boat. Boats are marine. Licensed is a state of mind.', 'smug']],
  ],
  [
    [['hank', 'Back home I sold used cars. Ninety-two Buicks. You know what that teaches a man? Everything floats if you wax it.', 'happy']],
    [['hank', 'The shades stay on. Even at night. It\'s a professional thing. Also I had a thing with a mirror once.', 'teasing']],
    [['hank', 'Your Aroha don\'t like me much. That\'s okay. Her uncle bought a cooler off me and he likes me fine.', 'smug'], ['hank', 'Don\'t tell her about the cooler.', 'worried', 'whisper']],
  ],
  [
    [['hank', 'Ohio\'s got snow, you know. Real snow. Lily builds a snowman every winter and calls it Fat Hank.', 'happy'], ['hank', 'She don\'t know it\'s after me. It\'s after me.', 'smug']],
    [['hank', 'You do good work, kid. Pictures of animals so folks back home give a darn about \'em. That\'s a real job. Mine\'s more of a... situation.', 'thinking']],
  ],
  [
    [['hank', 'If anything ever happens to me out here, you tell Lily her old man was a pretty good guy. Lie a little. Tell her I was taller.', 'serious'], ['mori', 'I\'ll tell her you were enormous.', 'teasing'], ['hank', 'That\'s my boy.', 'laugh']],
    [['hank', 'Lily asked her mom if she could be a wildlife photographer. A WILDLIFE PHOTOGRAPHER. Now where\'d she get an idea like that?', 'excited']],
  ],
];
const STORY: { key: string; when: () => boolean; c: T[] }[] = [
  { key: 'photo', when: () => day() > memo('hank', 'intro'), c: [
    ['mori', 'Who\'s in the little photo on the crate?', 'thinking'],
    ['hank', 'Huh? Oh. That. That\'s, uh. Inventory.', 'worried'],
    ['hank', '...That\'s my kid. Lily. She\'s eleven. Don\'t touch the frame, it\'s real gold.', 'serious'],
    ['hank', 'Real gold paint.', 'teasing', 'whisper'],
  ] },
  { key: 'snakes', when: () => said('photo') && tier('hank') >= 1, c: [
    ['hank', 'Lily\'s nuts about snakes. Eleven years old, wants a python for Christmas. Her mom says over her dead body.', 'laugh'],
    ['hank', 'I say, that can be arranged. Then I say, KIDDING. Kidding.', 'teasing'],
    ['hank', 'You ever see a really big snake out there, camera guy? A feathered one? The lane folks say there\'s a boa up the backcountry with feathers on it like a rooster.', 'thinking'],
  ] },
  { key: 'account', when: () => said('snakes') && tier('hank') >= 2, c: [
    ['hank', 'You wanna know where the money goes? Everybody figures Big Hank\'s got a yacht someplace.', 'smug'],
    ['hank', 'There\'s an account. Bank in Dayton. Lily\'s name on it. College, braces, a car that ain\'t a death trap. Whatever she wants.', 'serious'],
    ['mori', 'Does she know it\'s from you?', 'thinking'],
    ['hank', 'Nah. Her mom tells her it\'s from a "family trust". I\'m the family trust. Heh. A trust. Me.', 'sad'],
    ['hank', 'Keep that one under your cap, huh?', 'serious', 'whisper'],
  ] },
  { key: 'missed', when: () => said('account') && tier('hank') >= 3, c: [
    ['hank', 'I missed most of it, you know. First steps. First day of school. The recital where she was a carrot. Always one more deal. One more boat.', 'sad'],
    ['hank', 'Her mom raised her right. Better than I would\'ve. I just... pay for stuff. It\'s the one thing I\'m good at.', 'sad'],
    ['mori', 'That\'s not nothing, Hank.', 'happy'],
    ['hank', 'Yeah. Yeah, okay. Don\'t get mushy on me, I\'m sweating enough.', 'laugh'],
  ] },
  { key: 'afterLily', when: () => done('q_lily') && day() > memo('hank', 'lilyDay'), c: [
    ['hank', 'Lily wrote back. Well, her mom forwarded it. Four pages. About the snake. FOUR PAGES, Mori.', 'excited'],
    ['hank', 'She asked who took the picture. I said a friend of mine. A real one.', 'happy'],
    ['hank', 'She signed it "love, Lily". To the guy who sent it. To me. Heh.', 'sad'],
    ['hank', 'Gotta... gotta go check the cooler. Something in my eye. Sweat. It\'s sweat.', 'laugh'],
  ] },
];
defineTalk('hank', () => {
  if (!memo('hank', 'intro')) { setMemo('hank', 'intro', day()); return lines(INTRO); }
  for (const s of STORY) {
    if (said(s.key)) continue;
    let ok = false;
    try { ok = s.when(); } catch { ok = false; }
    if (ok) { setMemo('hank', 's:' + s.key, day()); return lines(s.c); }
  }
  const n = memo('hank', 'n');
  setMemo('hank', 'n', n + 1);
  const t = tier('hank');
  const pool = TIERS[Math.min(t, TIERS.length - 1)].length && (n % 4 !== 3 || t === 0) ? TIERS[Math.min(t, TIERS.length - 1)] : TIERS[Math.max(0, t - 1)];
  return lines(pool[n % pool.length]);
});
// woken up in his chair at night (newest provider first: this one asks first)
defineTalk('hank', () => {
  if (!night() || !memo('hank', 'intro')) return null;
  return lines([
    ['hank', 'Zzz... hrrk... no, officer, those are... decorative...', 'sleep'],
    ['hank', 'Wha? Huh? Oh. Camera guy. It\'s the middle of the night, pal. Shop\'s open, Hank\'s not.', 'tired'],
    ['hank', '...Okay. Hank\'s open. Whaddaya need?', 'smug', 'whisper'],
  ]);
});

// ================================================================== the shop: weapons and ammo for things from the island
/** what each weapon costs (a full load comes with it), and a refill of its ammo; items are things Mori
 *  collects in the world (where: the item's own `where`), rp = research points as agency vouchers */
interface Price { items: [string, number][]; rp?: number }
export const PRICES: Record<Exclude<WeaponId, 'sling'>, { buy: Price; refill: Price; per: number; patter: string; refillPatter: string }> = {
  bolas: { buy: { items: [['rope', 3], ['driftglass', 2]] }, refill: { items: [['rope', 2]] }, per: 2,
    patter: 'Genuine Argentine bolas. Says so on the tag. I wrote the tag. Wraps up the legs of anything.',
    refillPatter: 'Two more bolas. Stones not included. Kidding, stones included.' },
  bangers: { buy: { items: [['wire', 2], ['shell_fan', 3]] }, refill: { items: [['driftglass', 2]] }, per: 2,
    patter: 'Bear bangers. Coast guard surplus. Very legit. Ish. Light, throw, run. In that order.',
    refillPatter: 'Two strings of bangers. Keep \'em dry and away from your face.' },
  spray: { buy: { items: [['kawakawa', 3], ['resin', 2]], rp: 10 }, refill: { items: [['kawakawa', 2]] }, per: 6,
    patter: 'Bear spray. Ten feet of pure regret. Point it AWAY from you. I cannot stress that enough.',
    refillPatter: 'A fresh can. Same regret, new can.' },
  flare: { buy: { items: [['resin', 2], ['feather', 2]], rp: 20 }, refill: { items: [['resin', 1]], rp: 5 }, per: 2,
    patter: 'Marine flare pistol. Blinds \'em, then burns on the ground half a minute. Lights up the night. Romantic.',
    refillPatter: 'Two flares. Don\'t shoot \'em at the thatch. Koro will murder me.' },
  net: { buy: { items: [['scrap', 2], ['rope', 4]], rp: 25 }, refill: { items: [['rope', 2], ['flax', 2]] }, per: 1,
    patter: 'Net launcher. Wildlife department, very official, very borrowed. Holds a little guy, slows a big one.',
    refillPatter: 'A new net, folded the way a professional folds it. That professional is me.' },
  tranq: { buy: { items: [['glowcap', 3], ['shedskin', 2], ['driftglass', 1]], rp: 40 }, refill: { items: [['glowcap', 1], ['feather', 1]] }, per: 5,
    patter: 'Dart rifle. Vet grade. A couple darts and they take a little nap. The big ones need a few more.',
    refillPatter: 'Five darts. Sweet dreams, whoever.' },
};
const ORDER: Exclude<WeaponId, 'sling'>[] = ['bolas', 'bangers', 'spray', 'flare', 'net', 'tranq'];
const priceOf = (p: Price): Price => (freeAmmo() ? { items: [] } : p);
function waresNow() {
  const out: import('../../../ui/v12/wares').Ware[] = [];
  for (const id of ORDER) {
    const w = WEAPON_BY_ID[id], P = PRICES[id];
    if (!ownsWeapon(id)) out.push({ key: 'buy:' + id, icon: w.icon, name: w.name, price: P.buy, patter: P.patter });
    else if (ammo(id) < ammoMax(id)) out.push({ key: 'ammo:' + id, icon: w.ammoIcon, name: `${w.unit[1]}`, note: `+${Math.min(P.per, ammoMax(id) - ammo(id))}`, price: priceOf(P.refill), patter: P.refillPatter });
  }
  return out;
}
const BOUGHT = ['Pleasure doing business.', 'You didn\'t get that from me.', 'Sold! To the nervous gentleman with the camera.', 'Use it in good health. Mostly your health.', 'No receipts. No refunds. No questions.'];
async function openWares(h: TalkHost) {
  const { openWares: open } = await import('../../../ui/v12/wares');
  const { worldToCss, moriAnchor } = await import('../../../ui/v12/float');
  const f = h.f, a = h.a;
  const greet: BubbleLine[] = [{ who: 'hank', text: freeAmmo() ? 'For Lily\'s favourite photographer? Ammo\'s on the house. Forever. I said it, it\'s binding.' : 'Step into my office. Everything here fell off a boat. Every single thing.', expr: 'smug', style: freeAmmo() ? undefined : 'whisper' }];
  if (!waresNow().length) {
    await h.say([{ who: 'hank', text: 'You cleaned me out, pal. Belt\'s full, pockets\'re full. Come back when you\'ve shot something.', expr: 'laugh' }]);
    return;
  }
  await h.say(greet);
  const mori = moriAnchor();
  await open({
    heading: 'Hank\'s wares: fell off a boat',
    wares: waresNow(),
    hank: () => (a ? worldToCss(a.x, a.y - 70) : null),
    mori: () => mori() ?? null,
    have: id => count(id),
    rp: () => game.save.rp ?? 0,
    onBuy: async ware => {
      const [kind, wid] = ware.key.split(':') as ['buy' | 'ammo', Exclude<WeaponId, 'sling'>];
      const P = kind === 'buy' ? PRICES[wid].buy : priceOf(PRICES[wid].refill);
      if (P.items.some(([id, n]) => count(id) < n) || (P.rp ?? 0) > (game.save.rp ?? 0)) return false;
      for (const [id, n] of P.items) remove(id, n);
      if (P.rp) game.save.rp = (game.save.rp ?? 0) - P.rp;
      if (kind === 'buy') giveWeapon(wid);
      else setAmmo(wid, ammo(wid) + PRICES[wid].per);
      addAffinity('hank', kind === 'buy' ? 3 : 1, 'trade');
      setF('n:hankTraded');
      game.persist();
      (f as unknown as { hud?: { refresh(force?: boolean): void } } | null)?.hud?.refresh(true);
      const text = kind === 'buy' ? BOUGHT[Math.floor(Math.random() * BOUGHT.length)] : freeAmmo() ? 'On the house. Say hi to the snake for me.' : 'There ya go. Topped up.';
      game.ui.bubbles.bark('hank', text, { expr: kind === 'buy' ? 'smug' : 'happy', emote: kind === 'buy' ? 'sparkle' : undefined } as never);
      a?.react('bounce');
      const next = waresNow();
      return next.length ? next : null;
    },
  });
  if (F('n:hankTraded') && !F('n:hankWink')) {
    setF('n:hankWink');
    await h.say([{ who: 'hank', text: 'And hey. You didn\'t get any of that from me.', expr: 'teasing', style: 'whisper', emote: 'heart' } as BubbleLine]);
  }
}
/** the conversation menu's extra entries for Hank (talk.ts adds them after the quest steps) */
export function hankMenu(id: string): MenuOpt[] {
  if (id !== 'hank') return [];
  return [{ label: night() ? 'Sorry to wake you. Can I see the wares?' : 'Let’s see the wares.', run: h => openWares(h) }];
}

// ================================================================== A picture for Lily
const LILY: NpcQuest = {
  id: 'q_lily', giver: 'hank', title: 'A picture for Lily',
  desc: 'Hank’s daughter Lily is eleven, lives in Ohio and is mad about snakes. He wants one really good photograph of the giant feathered boa to mail her: uploaded and identified at the laptop, so it’s the real thing.',
  unlock: () => hasMet('hank') && said('snakes'),
  ask: [
    ['hank', 'Okay. Okay. Business proposition. Not a business proposition. A... favour.', 'worried'],
    ['hank', 'That feathered snake. The boa. My kid would lose her mind. She\'d tell the whole sixth grade.', 'serious'],
    ['hank', 'Get me a real good picture of it. One I can mail to Lily. I\'ll make it worth your while. Hank pays his debts.', 'determined'],
  ],
  yes: [['hank', 'You\'re a prince. A PRINCE. Don\'t get eaten. I mean that. Lily\'d never forgive me.', 'happy']],
  steps: [
    { text: 'Photograph a giant feathered boa and identify it at the laptop', done: () => lilyPhoto() || F('q_lily:given'), hint: 'The lane folk say the feathered boas hunt up the backcountry, past the crossroads at the end of Te Huarahi. Upload the photo at the laptop to identify it.' },
    { text: 'Bring Lily’s picture to Hank', done: () => F('q_lily:given'), hint: 'His stall at the end of Te Huarahi.' },
  ],
  reward: { rp: 40, text: 'A picture for Lily, in the mail to Ohio.' },
  actions: () => (lilyPhoto() && !F('q_lily:given') ? [{ label: 'I got your snake. Lily\'s picture.', quest: true, run: async h => {
    setF('q_lily:given');
    setMemo('hank', 'lilyDay', day());
    await h.say(L([
      ['mori', 'Here. Feathers and all. It came right up to the lens.', 'happy'],
      ['hank', 'Lemme see. Lemme see lemme see...', 'excited'],
      ['hank', '...', 'surprised'],
      ['hank', 'Oh, she\'s gonna... oh, kid. Look at the feathers. Look at the EYE on it.', 'wow'],
      ['hank', 'Sorry. Sun\'s in my eyes. Through the sunglasses. It\'s a very strong sun.', 'sad'],
      ['hank', 'I\'m gonna mail this tomorrow. Real mail. A stamp and everything. From "a friend who takes pictures".', 'happy'],
    ]));
    // the reward: free ammo forever, and something for the belt on the house
    setF('v12:hankFree');
    const gift = (['tranq', 'net', 'flare', 'spray', 'bangers', 'bolas'] as WeaponId[]).find(id => !ownsWeapon(id));
    if (gift) giveWeapon(gift);
    else for (const w of WEAPONS) if (w.id !== 'sling' && ownsWeapon(w.id)) setAmmo(w.id, ammoMax(w.id));
    addAffinity('hank', 20, 'quest');
    await h.say(L([
      ['hank', 'Listen. From now on, ammo\'s on the house. Forever. Don\'t argue, I\'m a businessman, I know a bad deal when I make one.', 'serious'],
      gift ? ['hank', `And take the ${WEAPON_BY_ID[gift].name.toLowerCase()}. No, take it. It's yours. Lily would want you to have it. She doesn't know you. She'd want it anyway.`, 'happy'] : ['hank', 'And fill your belt up. Everything. Go on.', 'happy'],
    ]));
    (h.f as unknown as { hud?: { refresh(force?: boolean): void } } | null)?.hud?.refresh(true);
  } }] : []),
};
if (!NPC_QUEST_BY_ID[LILY.id]) { NPC_QUESTS.push(LILY); NPC_QUEST_BY_ID[LILY.id] = LILY; }
// (the quest book: registered here too, in case the NPC module registered its list before this loaded)
if (!QUEST_BY_ID[LILY.id]) {
  const q: QuestDef = { id: LILY.id, title: LILY.title, giver: LILY.giver as Giver, main: false, desc: LILY.desc, steps: LILY.steps, reward: { rp: LILY.reward.rp, text: LILY.reward.text } };
  QUESTS.push(q);
  QUEST_BY_ID[q.id] = q;
}
/** dev points (src/debug/devpoints.ts): with Hank in the scene, walk Mori up to him and run a talk,
 *  the wares, or the photo hand-over ('talk' | 'wares' | 'lily') */
export async function hankDebug(what: 'talk' | 'wares' | 'lily'): Promise<string> {
  const { SPAWNED } = await import('./spawn');
  const f = game.scene as unknown as import('../../scenes/field').FieldScene | null;
  let a = SPAWNED.get('hank') ?? null;
  for (let i = 0; i < 60 && (!a || !f?.actors?.get?.('hank')); i++) { await new Promise(r => setTimeout(r, 100)); a = SPAWNED.get('hank') ?? null; }
  if (!f || !a) return 'no Hank here';
  const p = f.player;
  p.x = a.x - 34; p.y = f.st.terrain.groundY(p.x); p.facing = 1;
  f.snapCamera();
  await new Promise(r => setTimeout(r, 600));
  const h: TalkHost = { id: 'hank', say: l => f.say(l), f, a };
  a.faceTo(p.x);
  f.cutscene = true;
  try {
    if (what === 'wares') await openWares(h);
    else if (what === 'lily') { const run = LILY.actions?.('hank')[0]; if (run) await run.run(h); }
    else await (await import('./talk')).converse(h);
  } finally { f.cutscene = false; }
  return 'ok';
}
void ITEMS; void PEOPLE; void count;
