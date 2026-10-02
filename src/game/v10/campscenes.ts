// V10 camp scenes: the rhythm of a day at camp.
//
//  wakeUp           morning in Mori's tarp tent: dawn light, a different wake-up each day (Chunk asleep
//                   on his face, Joshu frying fish, Aroha poking him with a stick, Jenna's pot-and-spoon
//                   alarm, a bird on the ridge line, rain through the tarp, Jenna's doodle on his face
//                   after a blackout), up, a stretch, and the day's title card
//  breakfast        round the fire: Joshu's menu of the day, chatter, Chunk begging; energy and a
//                   "well fed" buff for the expedition
//  dinner           dusk to night: everyone sits round the fire, Joshu serves (with Mori's fish if he
//                   caught any), and Mori shares the day's photos while the crew comments; then the
//                   day's story event
//  sitByFire        a moment on the log bench
//  restUntilEvening lie low in the tent and skip the day
//  goToSleep        a night talk round the embers (sometimes), lights out, Mori crawls into his tent,
//                   Chunk squeezes in, the day's summary card, the next morning

import { game } from '../game';
import { audio } from '../../core/audio';
import { A } from '../assets';
import { groundY } from '../../art/island4/layout';
import { rand } from '../../core/math';
import { wait } from '../v4/islestory';
import type { BubbleLine } from '../../ui/bubbles';
import { SPECIES_BY_ID } from '../species';
import { discoveries } from './regions';
import { restore, maxEnergy } from './energy';
import { dayState, dayNumber, setPhase, startNextDay, addBond, CREW } from './day';
import type { CampDay } from './campday';
import { C10 } from './campcrew';
import { runSlot } from './campevents';
import { startDayQuest } from './campquests';

const F = (k: string) => !!game.save.flags[k];

// ---------------------------------------------------------------- the morning
type Wake = 'chunk' | 'smell' | 'aroha' | 'jenna' | 'birds' | 'rain' | 'doodle';
function pickWake(cd: CampDay): Wake {
  const d = cd.d, day = cd.day;
  if (d.doodle && d.doodle === day - 1) return 'doodle';
  if (F('v10:stormNight') && (d.events['stormNight'] ?? 0) === day - 1) return 'rain';
  if (day === 2) return 'chunk';
  const pool: Wake[] = (['chunk', 'smell', 'aroha', 'jenna', 'birds'] as Wake[]).filter(w => w !== d.lastWake);
  // Chunk is the most likely culprit
  return rand.chance(0.35) && d.lastWake !== 'chunk' ? 'chunk' : rand.pick(pool);
}

const TITLES: [string, string][] = [
  ['Camp Kittiwake', 'Four castaways, one pug, and a whole island to get to know.'],
  ['A New Routine', 'Breakfast. Plans. Adventure. Dinner. Repeat.'],
  ['Into the Green', 'The forest is louder than the sea this morning.'],
  ['Small Wonders', 'Somewhere out there, something nobody has ever seen.'],
  ['Weather Permitting', 'Joshu says rain. The sky says otherwise. Place your bets.'],
  ['Far Horizons', 'The map is a little less empty every day.'],
  ['Kaitiaki', 'Guardians of a place: that’s what Aroha calls them now.'],
];

export async function wakeUp(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, d = cd.d, day = cd.day, c = s.chunk;
  const v = pickWake(cd);
  d.woke = day;
  d.lastWake = v;
  setPhase('morning');
  game.persist();
  startDayQuest();
  await st.cut(async () => {
    s.hud?.show(false);
    game.r.post.fade = 1;
    s.clock.set(0.05); s.clock.target = 0.35; s.clock.rate = 0.004;
    cd.dress(false);
    cd.inTent = true;
    cd.lights();
    cd.camp.fire = v === 'smell' ? 0.8 : 0.35;
    // Mori asleep in his tent
    p.x = C10.tent + 4; p.y = groundY(p.x); p.facing = 1; p.vx = 0;
    st.pose('sleepBag');
    p.body.setExpr('sleep');
    // the camp waking up around him
    cd.hold();
    st.place(s.joshu, C10.cook - 22, 1, 'cook');
    st.place(s.aroha, C10.lean - 14, 1, 'sitGround');
    st.hide(s.jenna);
    s.buddy.mode = 'script';
    st.place(c, C10.tent + 26, -1, 'sleep');
    c.setExpr('sleep');
    cd.frame(C10.tent + 6, groundY(C10.tent) - 18, 2.25);
    audio.setMusic('none' as never);
    audio.setAmbience('beach', false);
    await wait(400);
    void st.fadeIn(0.9);
    await wait(1100);
    if (v === 'chunk') await wakeChunk(cd);
    else if (v === 'smell') await wakeSmell(cd);
    else if (v === 'aroha') await wakeAroha(cd);
    else if (v === 'jenna') await wakeJenna(cd);
    else if (v === 'birds') await wakeBirds(cd);
    else if (v === 'rain') await wakeRain(cd);
    else await wakeDoodle(cd);
    // up and at 'em
    st.pose('sitGround');
    p.body.setExpr('tired');
    await wait(500);
    st.pose(null);
    cd.inTent = false;
    cd.lights();
    await st.once('stretch');
    st.pose(null);
    p.body.setExpr('happy', 2);
    if (c.anim === 'sleep' || c.anim === 'lie') { c.setAnim('idle'); c.setExpr('neutral'); }
    const [ti, sub] = TITLES[(day - 2) % TITLES.length];
    audio.setMusic('build' as never);
    await st.pan(null, null);
    s.hud?.show(true);
    await game.ui.titleCard(`Day ${day}`, ti, sub, 2600);
  });
  // back to camp life
  cd.release();
  st.chunkFollow();
  if (s.jenna.visible === false) st.place(s.jenna, C10.bench + 22, -1, 'typeFast');
  cd.mode('morning');
  // the day's first event (Day 2's plan, a visitor, Chunk's heist...)
  await runSlot('wake', cd);
  if (day === 2) game.ui.toast('A day at camp: <b>breakfast</b> at the fire, talk to the crew, take <b>requests</b> from the camp board, upgrade gear at <b>Jenna’s bench</b>, then pack up at the <b>trail sign</b> and set off. Be back by evening.', 'CAMP', 'teal', 9000);
}

async function wakeChunk(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, c = s.chunk;
  // he's asleep ON Mori's face
  // (his rear end over Mori's face, which is a little past the head anchor of the lying pose)
  const [hx] = p.body.headTop();
  st.place(c, hx + 6 * p.facing, -1, 'sleep', groundY(hx) - 3);
  c.z = 53; s.main.markDirty();
  c.setExpr('sleep');
  await wait(500);
  audio.play('callGrunt', { vol: 0.3, pitch: 1.6 });
  await st.say([
    { who: 'chunk', text: 'Hnnnk... shnrrrk... hnnnnk...', expr: 'sleep', close: false, auto: 1500 },
    { who: 'mori', text: 'Mmmphf.', expr: 'tired', close: false, auto: 1000 },
    { who: 'mori', text: 'Mmf mmmf mmf mmmmf?', expr: 'tired', close: false },
    { who: 'mori', text: '...Chunk. Your butt. Is on my face.', expr: 'grumpy', close: false },
  ]);
  c.play('yawn', 'sleep').catch(() => {});
  await st.say([{ who: 'chunk', text: '*stretches luxuriously, all four paws, on Mori’s face*', expr: 'happy', close: false }]);
  // Mori sits up and Chunk slides off with a flump
  st.pose('sitGround');
  c.z = 46; s.main.markDirty();
  c.x = p.x + 18; c.y = groundY(c.x);
  c.play('roll', 'bellyUp').catch(() => {});
  audio.play('land', { vol: 0.25, pitch: 1.6 });
  await wait(700);
  await st.say([
    { who: 'chunk', text: '*lands belly-up, still asleep*', expr: 'sleep', close: false, auto: 1400 },
    { who: 'mori', text: 'Good morning to you too, buddy.', expr: 'happy' },
  ]);
}

async function wakeSmell(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p;
  for (let i = 0; i < 14; i++) s.main.particles.spawn({ frame: A.soft, x: C10.fire + rand.range(-6, 6), y: groundY(C10.fire) - 12, vx: rand.range(-18, -6), vy: -10, life: 3, color: [0.85, 0.8, 0.75], alpha: 0.28, alpha1: 0, size: 0.3, size1: 1.1 });
  audio.play('fireLight' as never, { vol: 0.3 });
  await st.say([
    { who: 'joshu', text: '♪ Oh the fish are in the pan, and the pan is on the fire... ♪', expr: 'happy', close: false, auto: 1800 },
    { who: 'mori', text: '*sniff* ...*sniff sniff*', expr: 'sleep', close: false, auto: 1100 },
  ]);
  p.body.setExpr('surprised', 1.5);
  p.body.react('jump');
  await st.say([
    { who: 'mori', text: 'FISH. Fried fish. Is that FRIED FISH?!', expr: 'excited', react: 'bounce' },
    { who: 'joshu', text: 'Ha! That got him. Works on Jenna too. Works on the dog. Works on everyone.', expr: 'laugh' },
  ]);
}

async function wakeAroha(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, a = s.aroha;
  st.place(a, C10.tent + 30, -1, 'kneel');
  await wait(400);
  await st.say([
    { who: 'aroha', text: 'Mori.', expr: 'neutral', close: false },
    { who: 'aroha', text: '...Mori.', expr: 'neutral', close: false },
  ]);
  p.body.react('shake');
  audio.play('rustle', { vol: 0.3, pitch: 1.5 });
  await st.say([
    { who: 'aroha', text: '*pokes him with a stick*', expr: 'teasing', close: false },
    { who: 'mori', text: 'Mmh... five more minutes...', expr: 'sleep', close: false },
    { who: 'aroha', text: 'You snore like a kekeno. A small one. With a cold.', expr: 'teasing' },
    { who: 'aroha', text: 'The tide’s out. The rock pools are full. You made me promise to wake you.', expr: 'neutral' },
  ]);
  p.body.react('jump');
  await st.say([{ who: 'mori', text: 'ROCK POOLS. I’m up! I’m up!', expr: 'excited', react: 'bounce' }]);
  a.walkTo(C10.lean - 14, 50).then(() => { a.facing = 1; a.idleAnim = 'sitGround'; a.setAnim('sitGround'); });
}

async function wakeJenna(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, j = s.jenna;
  st.place(j, C10.tent + 34, -1, 'hammer');
  for (let i = 0; i < 4; i++) { audio.play('hammer', { vol: 0.35, pitch: 1.9 + i * 0.1 }); await wait(160); }
  await st.say([{ who: 'jenna', text: 'GOOOOD MORNING, CAMP KITTIWAKE! It is a BEAUTIFUL day and I have made COFFEE!', expr: 'excited', style: 'shout', react: 'bounce' }]);
  p.body.react('jump');
  await st.say([
    { who: 'mori', text: '...We don’t have coffee.', expr: 'tired' },
    { who: 'jenna', text: 'I have made HOT BROWN WATER. With a bit of bark in it. It’s basically coffee.', expr: 'smug' },
    { who: 'mori', text: 'It’s basically tea, Jenna.', expr: 'tired' },
    { who: 'jenna', text: 'It’s basically AWAKE, is what it is. Up you get!', expr: 'happy' },
  ]);
  j.walkTo(C10.bench + 22, 70).then(() => { j.facing = -1; j.idleAnim = 'typeFast'; j.setAnim('typeFast'); });
}

async function wakeBirds(cd: CampDay) {
  const st = cd.st, p = cd.p;
  for (let i = 0; i < 3; i++) { audio.play('callTrill', { vol: 0.35, pitch: 1.3 + i * 0.12 }); await wait(420); }
  p.body.showEmote('music', 2);
  await st.say([
    { who: 'mori', text: '...', expr: 'sleep', close: false, auto: 900 },
    { who: 'mori', text: 'That call. Two notes, then a click, then a sort of... gargle.', expr: 'thinking', close: false },
    { who: 'mori', text: 'I don’t know that bird. I don’t know that bird!', expr: 'excited', react: 'bounce' },
  ]);
  audio.play('wingFlap', { vol: 0.4 });
  await st.say([{ who: 'mori', text: 'And it’s gone. Fine. I’ll find you later, mystery gargle bird.', expr: 'happy' }]);
}

async function wakeRain(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p;
  const [hx, hy] = p.body.headTop();
  for (let i = 0; i < 4; i++) {
    s.main.particles.spawn({ frame: A.dot, x: hx, y: hy - 14, vx: 0, vy: 30, ay: 300, life: 0.4, color: [0.7, 0.85, 1], alpha: 1, alpha1: 0.6, floorY: hy + 2 });
    audio.play('drip', { vol: 0.4 });
    await wait(650);
  }
  await st.say([
    { who: 'mori', text: '*drip* ...*drip*... *drip*...', expr: 'sleep', close: false, auto: 1200 },
    { who: 'mori', text: 'The tarp leaked. Of course the tarp leaked.', expr: 'grumpy' },
    { who: 'joshu', text: 'Morning, drowned rat! The storm’s blown out. Beach is covered in treasure.', expr: 'happy' },
  ]);
}

async function wakeDoodle(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, d = cd.d;
  await st.say([{ who: 'mori', text: 'Ugh. My head. Everything aches. Why does my face feel... tight?', expr: 'tired' }]);
  st.pose('sitGround');
  cd.inTent = false;
  cd.lights();
  st.place(s.jenna, C10.tent + 40, -1, 'idle');
  st.place(s.aroha, C10.tent + 58, -1, 'armsCrossed');
  await st.say([
    { who: 'jenna', text: '*snrrk*', expr: 'laugh', close: false, auto: 900 },
    { who: 'aroha', text: '*looks at the sky very hard*', expr: 'teasing', close: false },
    { who: 'mori', text: 'What. What is it. What’s on my face?', expr: 'worried' },
  ]);
  st.pose(null);
  p.x = C10.tent - 16; p.facing = -1;
  st.pose('kneel');
  audio.play('splash', { vol: 0.3, pitch: 1.4 });
  await st.say([
    { who: 'mori', text: '*peers into the puddle at the tent door*', expr: 'neutral', close: false },
    { who: 'mori', text: 'JENNA!!! IS THAT A MOUSTACHE?! IN MARKER?!', expr: 'shocked', style: 'shout', react: 'jump' },
    { who: 'jenna', text: 'It’s washable! ...Probably washable. The packet said “mostly washable”.', expr: 'laugh' },
  ]);
  for (let i = 0; i < 3; i++) { audio.play('splash', { vol: 0.3, pitch: 1.2 + i * 0.1 }); await wait(350); }
  d.doodle = 0;
  game.persist();
  st.pose(null);
  p.facing = 1;
  await st.say([{ who: 'mori', text: 'Mostly washable. I look like a disappointed walrus.', expr: 'grumpy' }, { who: 'aroha', text: 'An improvement.', expr: 'teasing' }]);
  s.jenna.walkTo(C10.bench + 22, 70).then(() => { s.jenna.facing = -1; s.jenna.idleAnim = 'typeFast'; s.jenna.setAnim('typeFast'); });
  s.aroha.walkTo(C10.lean - 14, 60).then(() => { s.aroha.facing = 1; s.aroha.idleAnim = 'sitGround'; s.aroha.setAnim('sitGround'); });
}

// ---------------------------------------------------------------- meals
const BREAKFASTS: [string, string][] = [
  ['Pipi porridge. Pipi, oats from the galley, and a pinch of salt off the rocks.', 'happy'],
  ['Smoked fish and goldcurrants. Breakfast of champions. Wet, sandy champions.', 'happy'],
  ['Dune lily fritters. Aroha’s recipe. Don’t ask what holds them together.', 'teasing'],
  ['Ship biscuits, softened in kawakawa tea. A sailor’s breakfast.', 'neutral'],
  ['Mussel omelette. No eggs. It’s mostly mussels. It’s a mussel.', 'teasing'],
];
const BREAKFAST_CHAT: BubbleLine[][] = [
  [{ who: 'jenna', text: 'So where are you going today, nature boy? Somewhere with ancient wifi?', expr: 'teasing' }, { who: 'mori', text: 'Somewhere with ancient ANIMALS.', expr: 'excited' }],
  [{ who: 'aroha', text: 'Take water. Take food. Tell us where you’re going.', expr: 'serious' }, { who: 'joshu', text: 'What she said.', expr: 'neutral' }],
  [{ who: 'joshu', text: 'Eat up. A hungry naturalist is a clumsy naturalist.', expr: 'neutral' }, { who: 'mori', text: 'Is that an old sailor’s saying?', expr: 'thinking' }, { who: 'joshu', text: 'It is now.', expr: 'teasing' }],
  [{ who: 'jenna', text: 'Chunk is staring at my plate. Chunk, I can FEEL you staring.', expr: 'grumpy' }, { who: 'chunk', text: '*stares harder*', expr: 'excited', close: false }],
  [{ who: 'aroha', text: 'The wind’s from the south. It’ll be cold up high. Wear something warm.', expr: 'neutral' }, { who: 'mori', text: 'You can tell from the wind?', expr: 'surprised' }, { who: 'aroha', text: 'I can tell from the goosebumps.', expr: 'teasing' }],
];

export async function breakfast(cd: CampDay) {
  const st = cd.st, s = cd.s, d = cd.d, day = cd.day, c = s.chunk;
  await st.cut(async () => {
    s.hud?.show(false);
    await st.fadeOut(1.6);
    cd.seatAll();
    cd.potOn = true;
    cd.camp.fire = 0.9;
    s.buddy.mode = 'script';
    st.place(c, C10.fire - 14, 1, 'beg');
    cd.frame(C10.fire, groundY(C10.fire) - 30, 1.7);
    await wait(250);
    await st.fadeIn(1.4);
    const menu = BREAKFASTS[(day - 2) % BREAKFASTS.length];
    const fish = d.larder > 0;
    await st.say([{ who: 'joshu', text: fish ? `Smoked fish from your catch, lad, with ${menu[0].charAt(0).toLowerCase() + menu[0].slice(1)}` : menu[0], expr: menu[1] }]);
    if (fish) d.larder--;
    for (const a of [s.jenna, s.joshu, s.aroha]) a.setAnim('eat');
    st.pose('eat');
    audio.play('munch', { vol: 0.4 });
    await st.say(BREAKFAST_CHAT[(day - 2 + rand.int(0, 1)) % BREAKFAST_CHAT.length]);
    // a little plan for the day: the requests waiting
    const { REQUESTS, reqState } = await import('./campquests');
    const active = REQUESTS.filter(r => reqState(r) === 'active' || reqState(r) === 'ready');
    if (active.length) await st.say([{ who: 'mori', text: `Today’s list: ${active.slice(0, 2).map(r => r.title.toLowerCase()).join(', and ')}${active.length > 2 ? ', and the rest' : ''}.`, expr: 'determined' }]);
    else await st.say([{ who: 'mori', text: 'Right. Board first, then the trail.', expr: 'determined' }]);
    for (const a of [s.jenna, s.joshu, s.aroha]) a.setAnim('sit');
    st.pose('sit');
    restore(30);
    d.meals.breakfast = day;
    d.buff = { id: 'hearty', day };
    for (const who of CREW) addBond(who, 1);
    game.persist();
    game.ui.toast('Breakfast: <b>+30 energy</b>. Well fed: walking costs <b>10% less</b> today.', 'CAMP', 'teal', 4200);
    await wait(400);
    cd.potOn = false;
    cd.camp.fire = 0.45;
    st.pose(null);
  });
  cd.release();
  st.chunkFollow();
  await runSlot('morning', cd);
}

/** the evening meal and the day's photos round the fire */
export async function dinner(cd: CampDay) {
  const st = cd.st, s = cd.s, d = cd.d, day = cd.day, c = s.chunk;
  await st.cut(async () => {
    s.hud?.show(false);
    await st.fadeOut(1.2);
    s.clock.set(Math.max(s.clock.t, 3.62)); s.clock.target = 3.85; s.clock.rate = 0.003;
    cd.dress(true);
    setPhase('night');
    cd.lights();
    cd.camp.fire = 1;
    cd.potOn = true;
    cd.seatAll();
    s.buddy.mode = 'script';
    st.place(c, C10.fire - 16, 1, 'beg');
    cd.frame(C10.fire, groundY(C10.fire) - 34, 1.6);
    audio.setMusic('camp' as never);
    await wait(300);
    await st.fadeIn(0.9);
    const fish = d.larder > 0;
    const caught = d.fishDay === day ? d.fishN : 0;
    await st.say([{ who: 'joshu', text: caught ? `Grub’s up! Fish stew, with the ${caught > 1 ? caught + ' fish' : 'fish'} Mori caught this morning.` : fish ? 'Grub’s up! Smoked fish stew. The smoker’s earning its keep.' : rand.pick(['Grub’s up! Mussels, pipi, and a mystery root Aroha swears is food.', 'Grub’s up! Pipi chowder. Again. You’ll love it. Again.']), expr: 'happy', style: 'shout' }]);
    if (fish && !caught) d.larder--;
    for (const a of [s.jenna, s.joshu, s.aroha]) a.setAnim('eat');
    st.pose('eat');
    audio.play('munch', { vol: 0.4 });
    await wait(600);
    // the day's photos
    await shareFinds(cd);
    for (const a of [s.jenna, s.joshu, s.aroha]) a.setAnim('sit');
    st.pose('sit');
    restore(maxEnergy());
    d.meals.dinner = day;
    for (const who of CREW) addBond(who, 2);
    game.persist();
    cd.potOn = false;
    // the day's story event, round the fire
    await runSlot('dinner', cd);
    st.pose(null);
    st.pose('sit');
  });
  // after dinner everyone stays round the fire until Mori turns in
  st.pose(null);
  cd.release();
  st.chunkFollow();
  cd.mode('night');
  game.ui.toast('When you’re ready, crawl into your <b>tent</b> to end the day.', 'CAMP', 'teal', 4200);
}

/** Mori shows the day's best photos; the crew comments on each */
async function shareFinds(cd: CampDay) {
  const st = cd.st, day = cd.day;
  const ups = game.save.uploads.filter(u => u.day === day);
  const raw = game.save.raw.filter(p => p.day === day);
  type Pic = { img: string; species: string | null; stars: number };
  const pics: Pic[] = [
    ...ups.map(u => { const sb = [...u.subjects].sort((a, b) => +b.ok - +a.ok || b.stars - a.stars)[0]; return { img: u.img, species: sb?.ok ? sb.species : null, stars: sb?.stars ?? 0 }; }),
    ...raw.map(p => { const sb = p.subjects[0]; return { img: p.img, species: sb?.species ?? null, stars: 0 }; }),
  ];
  // the best few, one per species
  const seen = new Set<string>();
  const best = pics.sort((a, b) => b.stars - a.stars).filter(p => { const k = p.species ?? p.img.slice(-40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
  const finds = discoveries().filter(f => f.day === day);
  if (!best.length && !finds.length) {
    await st.say([
      { who: 'jenna', text: 'So? What did you see today? Show us! ...You didn’t take ANY photos?', expr: 'shocked' },
      { who: 'mori', text: 'Some days you just look.', expr: 'happy' },
      { who: 'aroha', text: 'That’s the best kind of day.', expr: 'happy' },
    ]);
    return;
  }
  await st.say([
    { who: 'jenna', text: 'Okay, okay. Slideshow time! Show us what you found!', expr: 'excited' },
    { who: 'mori', text: 'Right. Gather round. Nobody touch the screen. Chunk.', expr: 'happy' },
  ]);
  if (best.length) {
    const { showPhotos } = await import('../../ui/v10/campcards');
    await showPhotos(best.map(p => ({ img: p.img, cap: p.species ? SPECIES_BY_ID[p.species]?.name ?? 'Something new' : 'Something blurry' })), async (i) => {
      const pic = best[i];
      const name = pic.species ? SPECIES_BY_ID[pic.species]?.name ?? 'that' : null;
      const who = (['jenna', 'joshu', 'aroha'] as const)[i % 3];
      const lines: Record<string, string[]> = {
        jenna: name ? [`The ${name}! Look at it! LOOK AT IT.`, `Okay, the ${name} is my new favourite. Sorry, Chunk.`, `That ${name} looks like it has OPINIONS.`] : ['Is that... a thumb?', 'Very artistic. Very... motion blur.'],
        joshu: name ? [`A ${name}. Sharp as a tack, that.`, `Well I never. A ${name}. Forty years at sea and I never saw one.`] : ['Hold the camera still, son. Like a rope in a gale.'],
        aroha: name ? [`The ${name}. You got close without scaring it. Ka pai.`, `${name}. My koro would want a copy of that one.`] : ['Mm. It ran away. They do that.'],
      };
      await st.say([{ who, text: rand.pick(lines[who]), expr: name ? 'happy' : 'teasing' }]);
    });
  }
  for (const f of finds.slice(0, 2)) {
    await st.say([
      { who: 'mori', text: `And I found ${f.kind === 'village' ? 'the village' : f.name}. ${f.note ?? ''}`.trim(), expr: 'excited' },
      { who: f.kind === 'village' || f.kind === 'ruin' ? 'aroha' : 'joshu', text: f.kind === 'village' ? '...You did?' : 'Well done, son. Mark it on the map.', expr: f.kind === 'village' ? 'surprised' : 'happy' },
    ]);
  }
  await st.say([{ who: 'joshu', text: rand.pick(['Good day’s work, Doc.', 'The agency’s getting its money’s worth out of you.', 'You’ll need a bigger laptop at this rate.']), expr: 'happy' }]);
}

export async function sitByFire(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p;
  await st.cut(async () => {
    p.x = C10.seats.mori; p.y = groundY(p.x); p.facing = 1;
    st.pose('sit');
    await wait(1400);
    const near = (['jenna', 'joshu', 'aroha'] as const).filter(w => s.actor(w).visible && Math.abs(s.actor(w).x - p.x) < 140);
    if (near.length) {
      const who = rand.pick(near);
      const pool: Record<string, string[]> = {
        jenna: ['You know what this fire needs? A USB port.', 'Sit with me. Tell me something nerdy.'],
        joshu: ['Rest your legs, lad. The island’ll wait five minutes.', 'Nothing like a fire to think by.'],
        aroha: ['Listen to it. The driftwood sings when it burns.', 'Rest. Then go.'],
      };
      await st.say([{ who, text: rand.pick(pool[who]), expr: 'happy' }]);
    } else await st.say([{ who: 'mori', text: rand.pick(['Ahh. Warm.', 'Five minutes. Then science.']), expr: 'happy' }]);
    restore(5);
    st.pose(null);
  });
}

export async function restUntilEvening(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p;
  const ch = await st.say([{ who: 'mori', text: 'Lie low in the tent until evening? The whole day goes by.', expr: 'thinking', choices: ['Have a lazy day', 'No, there’s too much to see'] }]);
  if (ch !== 0) return;
  await st.cut(async () => {
    s.hud?.show(false);
    p.x = C10.tent + 4; p.facing = 1;
    st.pose('kneel');
    await wait(500);
    await st.fadeOut(1.2);
    st.pose(null);
    s.clock.set(2.75);
    setPhase('evening');
    restore(40);
    cd.mode('evening');
    p.x = C10.tent + 22; p.y = groundY(p.x);
    s.snapCamera();
    await wait(400);
    await st.fadeIn(1);
    await st.say([{ who: 'joshu', text: 'Sleeping Beauty awakes! Feel better, Doc?', expr: 'teasing' }, { who: 'mori', text: 'Like a new naturalist.', expr: 'happy' }]);
  });
}

// ---------------------------------------------------------------- the night
const NIGHT_TALKS: BubbleLine[][] = [
  [
    { who: 'aroha', text: 'See those? The little cluster, low over the sea. Matariki.', expr: 'happy' },
    { who: 'jenna', text: 'They’re so pretty. Are they a constellation?', expr: 'thinking' },
    { who: 'aroha', text: 'A family. A mother and her children. When they rise in winter, it’s the new year.', expr: 'serious' },
    { who: 'mori', text: 'A new year in the middle of winter.', expr: 'thinking' },
    { who: 'aroha', text: 'The right time for it. Everything rests. Then it all starts again.', expr: 'happy' },
  ],
  [
    { who: 'jenna', text: 'Do you miss home, Mori?', expr: 'neutral' },
    { who: 'mori', text: '...My mum’s cooking. My bed. The internet. A bit.', expr: 'thinking' },
    { who: 'jenna', text: 'A BIT?!', expr: 'shocked' },
    { who: 'mori', text: 'This is better. Don’t tell my mum.', expr: 'happy' },
    { who: 'joshu', text: 'Your secret’s safe with us, son. Until we get a signal.', expr: 'teasing' },
  ],
  [
    { who: 'joshu', text: '♪ Oh, the Kittiwake was a fine old tub, with a hold full of fish and a galley of grub... ♪', expr: 'happy' },
    { who: 'jenna', text: 'Dad. DAD. Not the Kittiwake song.', expr: 'grumpy' },
    { who: 'joshu', text: '♪ ...and the captain was handsome, and clever, and tall... ♪', expr: 'laugh' },
    { who: 'aroha', text: '...Is he singing about himself?', expr: 'teasing' },
    { who: 'jenna', text: 'There are FORTY verses. All of them about himself.', expr: 'laugh' },
  ],
  [
    { who: 'chunk', text: 'HNNNNNNK. SHNRRRRK. HNNNNNNNNNK.', expr: 'sleep', close: false },
    { who: 'aroha', text: 'How. How is something so small so LOUD.', expr: 'shocked' },
    { who: 'mori', text: 'He has a very powerful soul.', expr: 'happy' },
    { who: 'jenna', text: 'He has very powerful sinuses.', expr: 'laugh' },
  ],
  [
    { who: 'jenna', text: 'Okay. Ghost story. Once, on a dark and stormy night, a ship ran aground...', expr: 'serious' },
    { who: 'jenna', text: '...and deep in the engine room, in the fuse box, something moved. Something with... CLAWS.', expr: 'scared' },
    { who: 'mori', text: '...Is it Kevin.', expr: 'neutral' },
    { who: 'jenna', text: 'IT WAS KEVIN.', expr: 'shocked', style: 'shout' },
    { who: 'joshu', text: 'Terrifying. I’ll never sleep again.', expr: 'teasing' },
  ],
  [
    { who: 'joshu', text: 'I just want to say something. While the fire’s going.', expr: 'neutral' },
    { who: 'joshu', text: 'We lost the Kittiwake. But I look round this fire and I don’t feel like I lost much.', expr: 'happy' },
    { who: 'jenna', text: 'Daaaad. You’re going to make me cry into my tea.', expr: 'sad' },
    { who: 'aroha', text: '...It’s good tea. Cry into it if you want.', expr: 'happy' },
  ],
  [
    { who: 'mori', text: 'Aroha, what do you call the little glowing things in the rock pools?', expr: 'thinking' },
    { who: 'aroha', text: 'My koro calls them the sea’s eyes. My cousin calls them “glowy bits”.', expr: 'teasing' },
    { who: 'mori', text: 'I’m going with sea’s eyes.', expr: 'happy' },
    { who: 'jenna', text: 'I’m going with glowy bits.', expr: 'happy' },
  ],
];

export async function nightTalk(cd: CampDay) {
  const st = cd.st, s = cd.s, d = cd.d;
  cd.seatAll();
  cd.camp.fire = 0.75;
  cd.frame(C10.fire, groundY(C10.fire) - 32, 1.55);
  const k = (d.talks['night'] ?? 0);
  d.talks['night'] = k + 1;
  const talk = NIGHT_TALKS[k % NIGHT_TALKS.length];
  if (talk[0].who === 'chunk') { s.buddy.mode = 'script'; st.place(s.chunk, C10.fire - 18, 1, 'sleep'); s.chunk.setExpr('sleep'); }
  await st.say(talk);
}

export async function goToSleep(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, c = s.chunk, cam = s.st.cam;
  let toNext = false;
  await st.cut(async () => {
    s.hud?.show(false);
    // a story event tonight, or (most nights) a talk round the embers
    const ran = await runSlot('night', cd);
    if (!ran && (cd.day === 2 || rand.chance(0.6))) await nightTalk(cd);
    // lights out
    cd.hold();
    cd.frame(1990, groundY(1990) - 50, 1.12);
    await st.say([{ who: 'aroha', text: 'Pō mārie, everyone.', expr: 'happy', close: false, auto: 1300 }]);
    s.aroha.walkTo(C10.lean, 50).then(() => s.aroha.setAnim('lieDown'));
    s.jenna.walkTo(C10.pole0 + 8, 70).then(() => s.jenna.setAnim('wrench'));
    await wait(1300);
    for (let i = cd.camp.bulbs.length - 1; i >= 0; i--) { cd.camp.bulbs[i].on = false; audio.play('ui', { vol: 0.06, pitch: 2.2 }); await wait(110); }
    s.jenna.walkTo(C10.tent - 66, 50).then(() => { s.jenna.visible = false; });
    s.joshu.walkTo(C10.fire + 16, 34, 'limp');
    await wait(1200);
    s.joshu.faceTo(C10.fire);
    s.joshu.setAnim('kneel');
    for (let i = 10; i >= 3; i--) { cd.camp.fire = i / 10; await wait(120); }
    s.joshu.setAnim('idle');
    await st.say([{ who: 'joshu', text: rand.pick(['Night, son.', 'Sleep well, Doc. Big day tomorrow.', 'Night, lad. Good work today.']), expr: 'happy', close: false, auto: 1500 }]);
    s.joshu.walkTo(C10.tent - 70, 30, 'limp').then(() => { s.joshu.visible = false; });
    cd.camp.lanternOn = false;
    // Mori crawls into his tent
    st.pose(null);
    p.x = C10.tent + 4; p.y = groundY(p.x); p.facing = 1;
    st.pose('kneel');
    await wait(500);
    cd.inTent = true;
    st.pose('sleepBag');
    p.body.setExpr('tired');
    cam.x = C10.tent + 8; cam.y = groundY(C10.tent) - 18;
    cd.front(false);
    for (let i = 0; i < 30; i++) { cam.zoom = 1.12 + (i / 30) * 1.0; await wait(30); }
    // and Chunk squeezes in
    s.buddy.mode = 'script';
    st.place(c, C10.tent + 30, -1, 'idle');
    await c.play('circle', 'idle');
    c.walkTo(C10.tent + 16, 30);
    await wait(600);
    c.play('lieDown', 'sleep').catch(() => {});
    c.setExpr('sleep');
    await st.say([
      { who: 'mori', text: rand.pick(['Night, buddy.', 'Goodnight, Chunk. Goodnight, island.', 'Big day tomorrow, buddy.']), expr: 'sleep', close: false, auto: 1600 },
      { who: 'chunk', text: 'Hnnnk... shnrrrk...', expr: 'sleep', close: false, auto: 1600 },
    ]);
    p.body.setExpr('sleep');
    await game.fadeTo(1, 0.4);
    const { dayCard } = await import('../../ui/v10/campcards');
    await dayCard(cd.day);
    toNext = true;
  });
  if (!toNext) return;
  await startNextDay();
  const { goIsland } = await import('../v4/islandflow');
  await goIsland();
}
void dayState; void dayNumber;
