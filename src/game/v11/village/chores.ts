// V11 Te Kāinga: things to do and taste. Chores with the villagers (each takes a few seconds of
// work with Mori's own hands and earns their affinity; most pay something once a day): split
// firewood and carry it to the hāngī, fetch water for Nanny Huia, strip flax with Whaea Mere, dig
// kūmara with Tamati, feed the pigs and collect eggs with Manu, pull in the eel traps with Rāwiri,
// take a turn with Uncle Hēmi's adze on the waka, and Ani's dare: catch Captain the rooster.
// Food to taste or pack: rēwena on the bench, smoked tuna off the rack, the hāngī once it is lifted.

import type { Interactable } from '../../../world/npc';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { give } from '../../inventory';
import { ITEMS } from '../../items';
import { eatFood } from '../../v10/forage10';
import { addAffinity } from '../social';
import { setCarry, carryOf } from '../carry';
import type { VCtx } from './ctx';
import { say, bark, sleep, actorOf } from './ctx';
import { X } from './layout';
import { vf, setVf } from './lore';
import { questStatus } from '../../quests';
import { A } from '../../assets';
import { holdV } from './people';

const today = () => game.save.day;
const onceToday = (k: string) => { const key = 'v11v:day:' + k; if (game.save.vars[key] === today()) return false; game.save.vars[key] = today(); return true; };
const icon = (id: string) => `<b>${ITEMS[id]?.name ?? id}</b>`;

/** fly an item into the pack from a world point */
function fly(c: VCtx, id: string, n: number, x: number, y: number) {
  const got = give(id, n);
  const [cx, cy] = c.f.css(x, y - 18);
  if (got > 0) c.f.hud?.flyItem(id, got, ITEMS[id]?.name ?? id, cx, cy);
  audio.play('collectPop' as 'ui', { vol: 0.6 });
}

/** work with the hands for a while (Mori's clip), with a sound every so often */
async function work(c: VCtx, anim: string, secs: number, sfx: string, every = 0.5, pitch = 1): Promise<boolean> {
  let t = 0;
  return c.f.player.doWork(anim, secs, () => {
    t -= 1 / 60;
    if (t <= 0) { t = every; audio.play(sfx as 'ui', { vol: 0.4, pitch: pitch * (0.9 + rand.next() * 0.2) }); }
  });
}
function chips(c: VCtx, x: number, y: number, col: [number, number, number], n = 8) {
  const lp = c.f.main.particles;
  for (let i = 0; i < n; i++) lp.spawn({ frame: A.dot2, x, y, vx: rand.range(-40, 40), vy: rand.range(-80, -30), ay: 240, life: 0.7, color: col, alpha: 1, alpha1: 0.4, floorY: c.ground(x) });
}

/** a food someone hands Mori: eat it now, or pack it */
export async function tasteOrPack(c: VCtx, id: string, who: string, line: string) {
  const k = await say(c.f, [{ who, text: line, expr: 'happy' }, { who: 'mori', text: `(${ITEMS[id]?.name ?? id})`, style: 'think', choices: ['Eat it now', 'Pack it for the road'] }]);
  if (k === 0) {
    give(id, 1);
    const r = eatFood(id);
    if (r.ok) {
      addAffinity(who, 2, 'ate their food');
      await sleep(600);
      await say(c.f, [{ who: 'mori', text: rand.pick(['Oh. Oh, that’s good.', 'Mmf. Mm! Sorry. Mm.', 'I could live here. I could actually live here.', 'This is the best thing I’ve eaten on this island. Don’t tell Joshu.']), expr: 'happy' }]);
      if (rand.next() < 0.6) bark(who, rand.pick(['Ka pai! Eat, eat.', 'See? Too thin. Have more.', 'Ha! Look at his face.']), { expr: 'laugh' });
    }
  } else {
    fly(c, id, 1, c.f.player.x, c.f.player.y);
    game.ui.toast(`Packed ${icon(id)}.`, 'FOOD', 'teal', 2200);
  }
}

// ------------------------------------------------------------------ chores
export async function flaxChore(c: VCtx) {
  const f = c.f, mere = actorOf(c, 'mere');
  await say(f, [{ who: 'mere', text: 'Strip it like this: thumbnail along the leaf, and pull. The fibre comes out shining. Don’t cut yourself, I’m not sewing you up.', expr: 'teasing' }]);
  f.player.body.faceTo(mere?.x ?? f.player.x + 10);
  const ok = await work(c, 'craft', 3.2, 'rustle', 0.45, 1.3);
  if (!ok) return;
  addAffinity('mere', 3, 'stripped flax');
  if (onceToday('flax')) {
    fly(c, 'rope', 1, f.player.x, f.player.y);
    await say(f, [{ who: 'mere', text: 'Not bad for a scientist. Here, a cord from yesterday’s fibre. Rope you can trust.', expr: 'happy' }]);
  } else await say(f, [{ who: 'mere', text: rand.pick(['Faster. My grandmother did this in her sleep. Literally, she slept and did this.', 'Good. Your hands are learning.']), expr: 'teasing' }]);
}

export async function digChore(c: VCtx) {
  const f = c.f;
  await say(f, [{ who: 'tamati', text: 'Gently. Feel for them with your fingers, don’t stab. They bruise like peaches.', expr: 'neutral' }]);
  const ok = await work(c, 'kneelWork', 3.4, 'dig', 0.55);
  if (!ok) return;
  addAffinity('tamati', 4, 'dug kūmara');
  if (onceToday('dig')) {
    fly(c, 'vil_kumara', 2, f.player.x + f.player.facing * 10, f.player.y);
    await say(f, [{ who: 'tamati', text: 'Look at that one! Take two. Nanny will roast them for you if you ask nicely.', expr: 'happy' }]);
  } else await say(f, [{ who: 'tamati', text: 'Ka pai. You’d make a gardener yet.', expr: 'happy' }]);
}

export async function feedPigs(c: VCtx) {
  const f = c.f;
  const trough = X.pen[1] - 18;
  await f.player.walkTo(trough - 12, 70);
  f.player.facing = 1;
  // the pigs come running to the trough
  for (const a of c.live?.list ?? []) if (a.kind === 'pig') { a.tx = trough + rand.range(-14, 4); a.anim = 'walk'; a.speed = 30; a.left = 6; }
  f.sfx('callGrunt', trough, 0.5, 1.5);
  const ok = await work(c, 'pour', 2.6, 'callGrunt', 0.6, 1.6);
  if (!ok) return;
  addAffinity('manu', 4, 'fed the pigs');
  await say(f, [{ who: 'manu', text: rand.pick(['See the big one shoving? That’s Kuini. She’s the boss of everything.', 'You fed them, so now they think you’re their mum. Sorry.']), expr: 'laugh' }]);
}

export async function eggChore(c: VCtx) {
  const f = c.f;
  await f.player.walkTo(X.coop - 14, 70);
  f.player.facing = 1;
  const ok = await work(c, 'kneelWork', 2.4, 'rustle', 0.5, 1.5);
  if (!ok) return;
  addAffinity('manu', 3, 'collected eggs');
  if (onceToday('eggs')) {
    fly(c, 'vil_egg', 1, f.player.x, f.player.y);
    await say(f, [{ who: 'manu', text: 'Nanny boils them in the morning pot. Take those, they’re done. The rooster saw you, by the way. He’ll remember.', expr: 'teasing' }]);
  } else await say(f, [{ who: 'manu', text: 'All gone today. The hens are on strike.', expr: 'neutral' }]);
}

export async function hinakiChore(c: VCtx) {
  const f = c.f;
  await f.player.walkTo(X.hinaki - 14, 70);
  f.player.facing = 1;
  const ok = await work(c, 'kneelWork', 3, 'splash', 0.7, 1.2);
  if (!ok) return;
  f.splash(X.hinaki, c.ground(X.hinaki) + 2, 0.6);
  addAffinity('rawiri', 4, 'eel traps');
  if (onceToday('hinaki')) {
    fly(c, 'vil_tuna', 1, f.player.x, f.player.y);
    fly(c, 'v10_fish', 1, f.player.x + 8, f.player.y);
    await say(f, [{ who: 'rawiri', text: 'Two in the trap! These fresh ones need a day on the rack. Take a smoked one, and the fish. Bro, you’re a natural.', expr: 'happy' }]);
  } else await say(f, [{ who: 'rawiri', text: 'Empty. The eels know it’s you. Tomorrow.', expr: 'teasing' }]);
}

export async function adzeChore(c: VCtx) {
  const f = c.f;
  await f.player.walkTo(X.wakaBuild - 30, 70);
  f.player.facing = 1;
  await say(f, [{ who: 'hemi', text: 'Short strokes. Let the weight of it do the work. If you take your foot off, I’m not carving you a new one.', expr: 'teasing' }]);
  const ok = await work(c, 'chop', 3.4, 'hammer', 0.42, 0.8);
  if (!ok) return;
  chips(c, X.wakaBuild - 16, c.ground(X.wakaBuild) - 18, [0.85, 0.7, 0.5]);
  addAffinity('hemi', 4, 'adze work');
  await say(f, [{ who: 'hemi', text: rand.pick(['Hm. Not terrible. I’ll fix it tomorrow.', 'Good. You took off a whole... hair. Of wood. Ka pai.', 'Again tomorrow. And the day after. That is how a waka gets made.']), expr: 'happy' }]);
}

// ------------------------------------------------------------------ the festival firewood: split it, carry it to the hāngī
export async function splitWood(c: VCtx) {
  const f = c.f;
  if (carryOf(f.player.body)) return;
  f.player.facing = 1;
  const ok = await work(c, 'chop', 2.8, 'hammer', 0.5, 0.75);
  if (!ok) return;
  chips(c, X.woodpile + 14, c.ground(X.woodpile) - 8, [0.8, 0.62, 0.42]);
  setCarry(f.player.body, 'firewood', { count: 5 });
  game.ui.toast('An armful of split wood. Carry it to the hāngī.', 'CHORE', 'teal', 2600);
}
export async function dropWood(c: VCtx) {
  const f = c.f;
  setCarry(f.player.body, null);
  audio.play('woodCreak', { vol: 0.5 });
  addAffinity('huia', 4, 'firewood');
  const n = (game.save.vars['v11v:woodTrips'] ?? 0) + 1;
  game.save.vars['v11v:woodTrips'] = n;
  if (questStatus('v11_festival') === 'active' && !vf('prep:wood')) {
    if (n >= 2) { setVf('prep:wood'); await say(f, [{ who: 'huia', text: 'That’s enough to cook a whale. Ka pai, boy. Go and wash, you smell like a tree.', expr: 'happy' }]); }
    else await say(f, [{ who: 'huia', text: 'One more like that.', expr: 'neutral' }]);
  } else bark('huia', 'Ka pai! The fire says thank you.', { expr: 'happy' });
}
export async function fetchWater(c: VCtx) {
  const f = c.f;
  if (carryOf(f.player.body)) return;
  await f.player.walkTo(X.jetty[1] - 6, 70);
  f.player.facing = -1;
  await f.player.doWork('kneel', 1.2);
  f.splash(X.jetty[1] - 14, c.ground(X.jetty[1] - 14), 0.4);
  setCarry(f.player.body, 'bucket', { level: 1, leak: 0.2 });
  game.ui.toast('A bucket of river water. Nanny Huia needs it at the cooking fire.', 'CHORE', 'teal', 2600);
}
export async function dropWater(c: VCtx) {
  setCarry(c.f.player.body, null);
  audio.play('splash', { vol: 0.3, pitch: 1.4 });
  addAffinity('huia', 3, 'water');
  bark('huia', rand.pick(['Ka pai! Now the pot can boil.', 'Good boy. Most of it even made it here.']), { expr: 'happy' });
}

// ------------------------------------------------------------------ Ani's dare: catch the rooster
export async function roosterChase(c: VCtx) {
  const f = c.f;
  const r = c.live?.list.find(a => a.kind === 'rooster');
  if (!r) return;
  await say(f, [{ who: 'ani', text: 'Go! You’ve got until I count to twenty. One... two...', expr: 'excited' }]);
  const kids = ['ani', 'pipi', 'mikaere'].map(id => c.vill[id]).filter(Boolean);
  for (const k of kids) { holdV(c, k.id, true); void k.a.walkTo(r.x + rand.range(-80, 80), 90, 'run').then(() => k.a.setAnim('cheer')); }
  const home = r.home;
  r.home = [Math.max(home[0] - 120, X.whare2), Math.min(home[1] + 60, X.palisade[0] - 10)];
  let caught = false;
  const t0 = performance.now();
  f.cutscene = false;
  while (performance.now() - t0 < 20000 && game.scene === f) {
    await sleep(50);
    const d = r.x - f.player.x;
    if (Math.abs(d) < 70) {
      r.tx = Math.max(r.home[0], Math.min(r.home[1], r.x + Math.sign(d || 1) * 60));
      r.anim = Math.abs(d) < 30 ? 'flap' : 'walk';
      r.speed = Math.abs(d) < 30 ? 105 : 75;
      r.left = 1;
    }
    if (Math.abs(d) < 11 && Math.abs(f.player.vx) > 30) { caught = true; break; }
  }
  r.home = home;
  r.speed = 16;
  f.cutscene = true;
  if (caught) {
    f.player.body.react('jump');
    audio.play('wingFlap', { vol: 0.6 });
    audio.play('callTrill', { vol: 0.5, pitch: 0.6 });
    f.st.shake(2, 0.3);
    addAffinity('ani', 6, 'caught the rooster');
    addAffinity('pipi', 3, 'caught the rooster');
    for (const k of kids) k.a.setAnim('celebrate');
    await say(f, [
      { who: 'mori', text: 'GOT HIM! I got him! Ow. He’s pecking. He is pecking me. Okay, you’re free, you’re free.', expr: 'excited' },
      { who: 'ani', text: 'Nobody ever caught Captain! Pīpī, he’s a WIZARD.', expr: 'excited' },
    ]);
  } else {
    f.player.poseOverride = 'fallBack';
    audio.play('splash', { vol: 0.3, pitch: 0.6 });
    await sleep(900);
    f.player.poseOverride = null;
    for (const k of kids) k.a.setAnim('laugh');
    addAffinity('ani', 2, 'tried to catch the rooster');
    await say(f, [
      { who: 'ani', text: '...nineteen, TWENTY! Captain wins again!', expr: 'laugh' },
      { who: 'pipi', text: 'You fell over like a wobbly kūmara!', expr: 'laugh' },
    ]);
  }
  for (const k of kids) holdV(c, k.id, false);
}

// ------------------------------------------------------------------ the objects
/** the interactables that belong to things (not people) */
export function placeChores(c: VCtx) {
  const f = c.f;
  const it = (o: Interactable) => (f.interact as Interactable[]).push(o);
  const run = (fn: () => Promise<void>) => async () => {
    if (f.cutscene || c.hold) return;
    f.cutscene = true;
    try { await fn(); } catch (e) { console.error(e); } finally { f.cutscene = false; f.hud?.refresh(); }
  };
  const gy = (x: number) => c.ground(x);
  // the woodpile and the hāngī
  it({ x: X.woodpile, y: gy(X.woodpile), w: 18, h: 16, label: 'Split firewood', standX: X.woodpile - 16, enabled: () => !carryOf(f.player.body),
    quest: () => questStatus('v11_festival') === 'active' && !vf('prep:wood') && !carryOf(f.player.body), action: run(() => splitWood(c)) });
  it({ x: X.hangi, y: gy(X.hangi), w: 22, h: 14, label: 'Stack the firewood by the hāngī', standX: X.hangi + 24, enabled: () => carryOf(f.player.body) === 'firewood',
    quest: () => carryOf(f.player.body) === 'firewood', action: run(() => dropWood(c)) });
  it({ x: X.hangi, y: gy(X.hangi), w: 22, h: 14, get label() { return c.night || c.tod === 'dusk' ? 'Taste the hāngī' : 'Look at the hāngī'; }, standX: X.hangi + 24, enabled: () => !carryOf(f.player.body),
    action: run(async () => {
      if (c.night || c.tod === 'dusk') {
        if (!onceToday('hangi')) { await say(f, [{ who: 'huia', text: 'You’ve had a whole parcel already! ...Fine. Just a kūmara.', expr: 'teasing' }]); give('vil_kumara', 1); return; }
        await tasteOrPack(c, 'vil_hangi', 'huia', 'Straight out of the ground. Smell that. Careful, it’s hot.');
      } else await say(f, [{ who: 'huia', text: 'Don’t you touch it! It’s been down since dawn. It comes up when the sun goes down, not a minute before.', expr: 'angry' }]);
    }) });
  // water for Nanny Huia's pot
  it({ x: X.gourds, y: gy(X.gourds), w: 14, h: 12, label: 'Fetch water for Nanny Huia', standX: X.gourds - 10, enabled: () => !carryOf(f.player.body), action: run(() => fetchWater(c)) });
  it({ x: X.cookFire, y: gy(X.cookFire), w: 16, h: 18, label: 'Pour the water into the pot', standX: X.cookFire - 18, enabled: () => carryOf(f.player.body) === 'bucket', quest: () => carryOf(f.player.body) === 'bucket', action: run(() => dropWater(c)) });
  // food: rēwena on the bench, smoked tuna off the rack, a kūmara from the kete
  it({ x: X.foodBench, y: gy(X.foodBench), w: 16, h: 14, label: 'Try the rēwena', standX: X.foodBench - 16, enabled: () => !carryOf(f.player.body),
    action: run(async () => {
      if (!onceToday('rewena')) { await say(f, [{ who: 'mori', text: 'Better leave some for everyone else.', style: 'think' }]); return; }
      await tasteOrPack(c, 'vil_rewena', 'huia', 'Rēwena. Potato bread. The bug in it is older than Koro. Have a slice.');
    }) });
  it({ x: X.smokeRack, y: gy(X.smokeRack), w: 22, h: 18, label: 'Try the smoked tuna', standX: X.smokeRack - 20, enabled: () => !carryOf(f.player.body),
    action: run(async () => {
      if (!onceToday('tuna')) { await say(f, [{ who: 'rawiri', text: 'Oi! One a day, bro, or there’s none for the festival.', expr: 'teasing' }]); return; }
      await tasteOrPack(c, 'vil_tuna', 'rawiri', 'Smoked tuna. Mānuka smoke, two days on the rack. Go on.');
    }) });
  it({ x: X.kumaraKete, y: gy(X.kumaraKete), w: 14, h: 12, label: 'Ask for a kūmara', standX: X.kumaraKete - 14, enabled: () => !carryOf(f.player.body),
    action: run(async () => {
      if (!onceToday('kumara')) { await say(f, [{ who: 'tamati', text: 'Those are for the pātaka! You had one already.', expr: 'grumpy' }]); return; }
      await tasteOrPack(c, 'vil_kumara', 'tamati', 'Help yourself. Roasted this morning in the embers.');
    }) });
  // the toys: kick the ball back to the kids
  it({ x: X.whare1 + 70, y: gy(X.whare1 + 70), w: 10, h: 8, label: 'Kick the ball to the kids', standX: X.whare1 + 58,
    action: run(async () => {
      f.player.body.react('jump');
      audio.play('jump', { vol: 0.3, pitch: 1.4 });
      const k = rand.pick(['pipi', 'ani', 'mikaere']);
      const a = actorOf(c, k);
      if (a) { a.faceTo(f.player.x); a.setAnim('cheer'); }
      bark(k, rand.pick(['Again! Again!', 'Ha! You kick like Koro!', 'Goal! ...that wasn’t a goal. There’s no goal.']), { expr: 'laugh' });
      addAffinity(k, 1, 'ball');
    }) });
  // the dogs: a pat
  for (const a of c.live?.list ?? []) if (a.kind === 'dog') c.live!.interact(a, 'Pat the dog', run(async () => {
    a.anim = 'wag'; a.left = 4;
    f.player.body.play('pet', 'idle').catch(() => {});
    f.sfx('callBark', a.x, 0.2, 1.6);
    await sleep(1400);
    if (rand.next() < 0.4) bark('manu', rand.pick(['That’s Moko. She likes you.', 'Don’t let him lick you, he ate something.']), { expr: 'laugh' });
  }));
}
void sleep;
