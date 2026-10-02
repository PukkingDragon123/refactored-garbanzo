// V10 coming home to camp (day.ts arriveAtCamp -> playArrival -> CampDay.arrive -> arrival):
//
//  walk      golden hour: Mori trudges in along the beach from the trail, Chunk wakes up and comes
//            barrelling over, the crew greets him and asks about the trip
//  blackout  dusk: Aroha staggers into camp with Mori slung over her shoulders like a sack of kūmara,
//            everyone panics, she drops him by the fire and flops onto a log, Chunk licks his face,
//            and Jenna... has a marker. An hour later Mori comes round, groggy, to a lecture, a lot of
//            badly hidden giggling, and a moustache he doesn't know about yet. Aroha couldn't carry the
//            pack too: some of the day's haul stayed on the ridge.
//  boat      the tender grinds onto the sand; Mori jumps down into the shallows and wades up the beach
//
// Then the evening at camp: a nudge to upload the day's photos, and the day's "return" event.
// collapse() is the moment energy runs out, wherever Mori is.

import { game } from '../game';
import { audio } from '../../core/audio';
import { A } from '../assets';
import { Actor } from '../../world/actor';
import { Custom } from '../../world/props';
import { groundY } from '../../art/island4/layout';
import { rand } from '../../core/math';
import { wait } from '../v4/islestory';
import { ITEMS } from '../items';
import { restore } from './energy';
import { dayState, dayNumber, setPhase, addBond, _hooks } from './day';
import type { ArriveHow } from './day';
import { activeCamp, campReady } from './campday';
import type { CampDay } from './campday';
import { C10 } from './campcrew';
import { runSlot } from './campevents';
import { location, discoveries } from './regions';
import { SPECIES_BY_ID } from '../species';

/** day.ts entry: make sure the camp is up, then play the arrival */
export async function playArrival(how: ArriveHow) {
  let cd = activeCamp();
  if (!cd) {
    const sc = game.scene as unknown as { story?: { camp?: unknown } } | null;
    if (!sc?.story?.camp) { const { goIsland } = await import('../v4/islandflow'); await goIsland(); }
    cd = await campReady(25000);
  }
  if (!cd) { const d = dayState(); d.arrive = null; setPhase('evening'); game.persist(); return; }
  await cd.arrive(how);
}

/** energy hit zero: Mori keels over where he stands, and the world goes dark */
export async function collapse() {
  const s = game.scene as unknown as { cutscene?: boolean; player?: { poseOverride: string | null; vx: number; body: { setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void } }; st?: { shake(a: number, t: number): void }; hud?: { show(on: boolean): void } | null } | null;
  const p = s?.player;
  if (s) s.cutscene = true;
  try {
    s?.hud?.show(false);
    if (p) { p.vx = 0; p.body.setExpr('tired'); p.body.showEmote('sweat', 2); }
    audio.play('emoteSweat' as never, { vol: 0.5 });
    await game.ui.bubbles.say([{ who: 'mori', text: rand.pick(['I just... need to sit down... for a...', 'Legs... why are there... four of them...', 'So... tired... is that a... pillow rock...']), expr: 'tired', close: false, auto: 1300 }]).catch(() => 0);
    if (p) p.poseOverride = 'fallBack';
    await wait(500);
    audio.play('land', { vol: 0.7, pitch: 0.7 });
    s?.st?.shake(2, 0.3);
    if (p) p.poseOverride = 'unconscious';
    await game.fadeTo(1, 0.5);
    await game.ui.showCaption('<i>Everything goes dark...</i>', 1800);
  } finally {
    if (s) s.cutscene = false;
  }
}

/** the arrival cutscene in the camp scene */
export async function arrival(cd: CampDay, how: ArriveHow) {
  const st = cd.st, s = cd.s, d = cd.d, day = cd.day;
  d.arrive = how;
  game.persist();
  await st.cut(async () => {
    s.hud?.show(false);
    if (game.r.post.fade < 0.99) await game.fadeTo(1, 2.5);
    cd.hold();
    cd.inTent = false;
    s.player.poseOverride = null;
    for (const f of _hooks.arriveFns) { try { await f(how, day); } catch (e) { console.warn('[arrive] hook', e); } }
    if (how === 'blackout') await arriveBlackout(cd);
    else if (how === 'boat') await arriveBoat(cd);
    else await arriveWalk(cd);
  });
  d.arrive = null;
  d.lastArrive = how;
  d.lastArriveDay = day;
  setPhase('evening');
  game.persist();
  cd.release();
  st.chunkFollow();
  cd.mode('evening');
  const left = game.save.raw.filter(p => p.day === day).length;
  if (left > 0) {
    setTimeout(() => s.bark('jenna', rand.pick(['Upload your photos! I want to SEE!', 'Laptop! Photos! Now! Please!']), { expr: 'excited' }), 1600);
    game.ui.toast(`${left} photo${left > 1 ? 's' : ''} from today still on the camera: upload them on the <b>laptop</b> at your research table to research what you found.`, 'RESEARCH', 'teal', 6000);
  }
  await runSlot('return', cd);
}

// ---------------------------------------------------------------- on foot
async function arriveWalk(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, c = s.chunk, d = cd.d;
  s.clock.set(Math.max(s.clock.t, 2.62)); s.clock.target = 3.3; s.clock.rate = 0.002;
  cd.dress(false);
  cd.lights();
  st.place(s.jenna, C10.bench + 22, -1, 'typeFast');
  st.place(s.joshu, C10.cook - 22, 1, 'cook');
  st.place(s.aroha, C10.lean - 14, 1, 'sitGround');
  s.buddy.mode = 'script';
  st.place(c, C10.bed, 1, 'sleep');
  c.setExpr('sleep');
  p.x = C10.sign + 150; p.y = groundY(p.x); p.facing = -1; p.alpha = 1;
  cd.frame(C10.sign - 60, groundY(C10.sign) - 34, 1.35);
  await wait(300);
  void st.fadeIn(0.9);
  const walk = p.walkTo(C10.sign - 30, 50);
  await wait(1600);
  // Chunk hears him
  c.setExpr('surprised', 1.5);
  c.showEmote('exclaim', 1.2);
  c.setAnim('idle');
  audio.play('callBark', { vol: 0.4, pitch: 0.8 });
  await wait(500);
  c.walkTo(p.x - 18, 170, 'zoom');
  await st.pan(C10.sign - 120, groundY(C10.sign) - 34, 1.35, 1.4);
  await walk;
  p.facing = -1;
  await Promise.race([c.walkTo(p.x - 14, 170, 'zoom'), wait(1500)]);
  c.play('jump', 'wiggle').catch(() => {});
  p.body.react('recoil');
  audio.play('callBark', { vol: 0.5, pitch: 0.9 });
  const where = d.went ? location(d.went)?.name ?? null : null;
  const today = Object.entries(game.save.research).filter(([, e]) => e.day === cd.day).map(([id]) => SPECIES_BY_ID[id]?.name).filter(Boolean) as string[];
  const finds = discoveries().filter(f => f.day === cd.day);
  await st.say([
    { who: 'chunk', text: 'BOOF! BOOF BOOF! *wiggles his entire back half*', expr: 'excited', close: false },
    { who: 'mori', text: 'Hi, buddy! Yes! I missed you too! Ow. Claws.', expr: 'happy' },
  ]);
  s.jenna.walkTo(p.x - 40, 90, 'run');
  await wait(600);
  s.joshu.walkTo(p.x - 70, 34, 'limp');
  s.aroha.setAnim('idle');
  s.aroha.faceTo(p.x);
  await st.say([
    { who: 'jenna', text: rand.pick(['He’s BACK! The explorer returns!', 'Nature boy! You’re alive! Tell me everything!', 'You’re back! You smell like a forest! In a good way! Mostly!']), expr: 'excited', react: 'bounce' },
    { who: 'joshu', text: where ? `How was ${where}, lad?` : 'How was it out there, lad?', expr: 'happy' },
    { who: 'mori', text: finds.length ? `Amazing. I found ${finds[0].kind === 'location' ? finds[0].name : 'a ' + finds[0].kind}${finds.length > 1 ? `, and ${finds.length - 1} more thing${finds.length > 2 ? 's' : ''}` : ''}!` : today.length ? `I documented ${today.length > 1 ? today.length + ' species' : 'a ' + today[0]} today!` : rand.pick(['Long. Muddy. Wonderful.', 'My legs have opinions. But it was good.', 'I saw SO much. I photographed... some of it.']), expr: 'excited' },
    { who: 'aroha', text: rand.pick(['You came back before dark. Good.', 'Your boots are full of half the island.', 'Ka pai. Now eat something.']), expr: 'happy' },
  ]);
}

// ---------------------------------------------------------------- carried home
function stragglers(): string[] {
  // Aroha could carry Mori or his haul: about half of the day's materials stay on the ridge
  const inv = game.save.inv;
  const drop = inv.filter(st => { const k = ITEMS[st.id]?.kind; return k !== 'key' && k !== 'tool' && k !== 'food'; });
  const lost: string[] = [];
  for (let i = 0; i < Math.ceil(drop.length / 2); i++) {
    const stk = drop[drop.length - 1 - i];
    if (!stk) break;
    const ix = inv.indexOf(stk);
    if (ix >= 0) inv.splice(ix, 1);
    lost.push(`${ITEMS[stk.id]?.name ?? stk.id}${stk.n > 1 ? ' ×' + stk.n : ''}`);
  }
  return lost;
}

async function arriveBlackout(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, c = s.chunk, d = cd.d, a = s.aroha;
  const first = !d.blackouts;
  d.blackouts++;
  s.clock.set(3.12); s.clock.target = 3.4; s.clock.rate = 0.002;
  cd.dress(false);
  cd.lights();
  cd.camp.fire = 0.8;
  st.place(s.jenna, C10.fire - 26, 1, 'idle');
  st.place(s.joshu, C10.fire + 30, -1, 'idle');
  s.buddy.mode = 'script';
  st.place(c, C10.bed, 1, 'lie');
  // Mori is the sack over Aroha's shoulders: a stand-in actor in the unconscious pose, riding along
  p.x = C10.fire - 34; p.y = groundY(p.x); p.alpha = 0;
  let m = cd.carried;
  if (!m) {
    m = new Actor('mori', 0, 0, -1);
    m.layer = s.main; m.z = 45; m.shadow = false;
    s.main.add(m);
    cd.carried = m;
  }
  m.visible = true; m.alpha = 1; m.transitions = false;
  m.idleAnim = 'unconscious'; m.setAnim('unconscious');
  m.setExpr('sleep');
  let ride = true;
  const rider = s.main.add(new Custom(45.5, () => {}, () => {
    if (!ride) return;
    m!.facing = a.facing;
    m!.x = a.x - a.facing * 3;
    m!.y = a.y - 37 + (a.walking ? Math.abs(Math.sin(a.x * 0.12)) * 1.5 : 0);
  }));
  st.place(a, C10.sign + 120, -1, 'carryHeavy');
  a.walkAnim = 'carryHeavy';
  cd.frame(C10.fire + 160, groundY(C10.fire) - 40, 1.25);
  await wait(400);
  void st.fadeIn(0.7);
  audio.setMusic('none' as never);
  // the stagger in: a few steps, a stop to pant, a few more
  const stops = [C10.lean + 40, C10.rack + 10, C10.cook + 30];
  void st.pan(C10.fire + 60, groundY(C10.fire) - 40, 1.3, 4);
  for (let i = 0; i < stops.length; i++) {
    await Promise.race([a.walkTo(stops[i], 24, 'carryHeavy'), wait(9000)]);
    a.showEmote('sweat', 1.4);
    if (i === 0) await st.say([{ who: 'aroha', text: 'Hhh... hhh... hhh...', expr: 'tired', close: false, auto: 1100 }]);
    if (i === 1) {
      await st.say([
        { who: 'jenna', text: 'Is that... AROHA? What is she carrying? Is that a SEAL?', expr: 'surprised' },
        { who: 'joshu', text: 'That’s no seal. That’s... oh no. MORI!', expr: 'shocked', style: 'shout' },
      ]);
      s.jenna.walkTo(a.x - 30, 100, 'run');
      s.joshu.walkTo(a.x - 56, 40, 'limp');
    }
    await wait(350);
  }
  await Promise.race([a.walkTo(C10.fire + 26, 22, 'carryHeavy'), wait(5000)]);
  a.faceTo(C10.fire);
  await st.say([
    { who: 'jenna', text: 'Is he DEAD?! Aroha, is he DEAD?!', expr: 'scared', style: 'shout', react: 'jump' },
    { who: 'aroha', text: 'He’s... not... dead. He’s... HEAVY.', expr: 'tired' },
    { who: 'aroha', text: first ? 'He lay down. On the track. Said “just five minutes”. And started snoring.' : 'AGAIN. He did it AGAIN. On a hill. With his mouth open.', expr: 'angry' },
  ]);
  // the drop
  ride = false;
  (rider as { dead?: boolean }).dead = true;
  m.x = C10.fire - 22; m.y = groundY(m.x); m.facing = 1;
  audio.play('land', { vol: 0.8, pitch: 0.6 });
  s.st.shake(2.5, 0.3);
  for (let i = 0; i < 10; i++) s.main.particles.spawn({ frame: A.soft, x: m.x + rand.range(-16, 16), y: m.y - 2, vx: rand.range(-20, 20), vy: rand.range(-18, -6), life: 1, color: [0.85, 0.78, 0.6], alpha: 0.5, alpha1: 0, size: 0.3, size1: 0.8 });
  a.walkAnim = 'walk';
  st.place(a, C10.seats.aroha, -1, 'sit');
  a.setExpr('tired');
  await st.say([
    { who: 'mori', text: 'Zzzz... mmm... sixth-instar larvae... zzz...', expr: 'sleep', close: false, auto: 1600 },
    { who: 'aroha', text: '*flops onto the log* I carried him. All the way. From the ridge. ALL. THE. WAY.', expr: 'tired' },
    { who: 'joshu', text: 'He’s breathing. He’s just done in. Ran himself right down to empty, the daft lump.', expr: 'serious' },
  ]);
  // Chunk checks on him
  c.walkTo(m.x + 14, 90, 'run');
  await wait(800);
  c.faceTo(m.x);
  c.setAnim('beg');
  await st.say([{ who: 'chunk', text: '*SLURP SLURP SLURP* *licks his entire face*', expr: 'happy', close: false, auto: 1500 }]);
  c.setAnim('sit');
  // and Jenna has a marker
  st.place(s.jenna, m.x + 18, -1, 'idle');
  await st.say([
    { who: 'jenna', text: '...', expr: 'thinking', close: false, auto: 900 },
    { who: 'jenna', text: 'Nobody. Move.', expr: 'smug', close: false },
    { who: 'joshu', text: 'Jenna. Jenna, no.', expr: 'worried' },
    { who: 'jenna', text: '*uncaps a marker*', expr: 'smug', close: false },
  ]);
  s.jenna.setAnim('kneel');
  cd.frame(m.x + 4, groundY(m.x) - 14, 2.4);
  for (let i = 0; i < 5; i++) { audio.play('rope', { vol: 0.25, pitch: 2.4 + rand.next() * 0.4 }); await wait(260); }
  d.doodle = cd.day;
  game.persist();
  await st.say([
    { who: 'jenna', text: 'It’s for SCIENCE. It’s a... facial survey marker.', expr: 'laugh' },
    { who: 'aroha', text: '...Give him eyebrows too. One big one.', expr: 'teasing' },
    { who: 'joshu', text: '*sighs the sigh of a man with two kids now*', expr: 'tired', close: false },
  ]);
  // an hour later
  await st.fadeOut(1.4);
  s.clock.set(3.45); s.clock.target = 3.58; s.clock.rate = 0.002;
  cd.lights();
  m.visible = false;
  p.alpha = 1;
  p.x = C10.fire - 22; p.y = groundY(p.x); p.facing = 1;
  st.pose('lie');
  p.body.setExpr('sleep');
  st.place(s.jenna, C10.seats.jenna, 1, 'sit');
  st.place(s.joshu, C10.seats.joshu, -1, 'sit');
  st.place(c, p.x + 16, -1, 'lie');
  cd.frame(C10.fire - 10, groundY(C10.fire) - 26, 1.8);
  await wait(400);
  await game.ui.showCaption('<i>An hour later...</i>', 1400);
  await st.fadeIn(1);
  await st.say([{ who: 'mori', text: '...nngh.', expr: 'tired', close: false, auto: 900 }]);
  st.pose('sitGround');
  p.body.setExpr('tired');
  await wait(400);
  const lost = stragglers();
  await st.say([
    { who: 'mori', text: 'Where... how did I get back to camp? The last thing I remember is a really comfortable rock.', expr: 'tired' },
    { who: 'aroha', text: 'I carried you. From the ridge. On my back. Like a sack of kūmara.', expr: 'grumpy' },
    { who: 'mori', text: '...All of it?', expr: 'surprised' },
    { who: 'aroha', text: 'Every. Single. Step. You owe me. Forever.', expr: 'angry' },
    { who: 'joshu', text: 'You ran yourself dry, son. Eat when you’re hungry, rest when you’re tired, turn back BEFORE you’re empty.', expr: 'serious' },
    { who: 'jenna', text: '*biting her lip, staring very hard at the fire*', expr: 'laugh', close: false },
    { who: 'mori', text: 'Jenna? Why are you making that face?', expr: 'thinking' },
    { who: 'jenna', text: 'What face? This is my face. My normal, regular, nothing-happened face.', expr: 'smug' },
  ]);
  if (lost.length) await st.say([{ who: 'aroha', text: 'And your bag stayed on the ridge. I could carry you or your rocks. I picked you. Mostly.', expr: 'teasing' }]);
  if (first) await st.say([{ who: 'aroha', text: 'Next time you feel your legs going, you turn round. Promise me.', expr: 'serious', choices: ['I promise.', 'I promise. Thank you, Aroha.'] }]);
  addBond('aroha', 5);
  restore(25);
  st.pose(null);
  if (lost.length) game.ui.toast(`Left behind on the ridge: ${lost.join(', ')}.`, 'BLACKOUT', 'coral', 6000);
  game.ui.toast('Your energy ran out. Eat, rest and turn back before you’re empty. (Something is on your face.)', 'BLACKOUT', 'coral', 6000);
  game.persist();
}

// ---------------------------------------------------------------- by boat
async function arriveBoat(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, c = s.chunk;
  s.clock.set(Math.max(s.clock.t, 2.6)); s.clock.target = 3.3; s.clock.rate = 0.002;
  cd.dress(false);
  cd.lights();
  st.place(s.jenna, C10.bench + 22, -1, 'typeFast');
  st.place(s.joshu, C10.fire + 30, -1, 'sipTea');
  st.place(s.aroha, C10.lean - 14, 1, 'sitGround');
  s.buddy.mode = 'script';
  st.place(c, C10.fire - 18, 1, 'lie');
  const x = C10.rack + 70;
  p.x = x; p.y = groundY(x) - 14; p.facing = -1; p.alpha = 1;
  st.pose('jump');
  cd.frame(x - 40, groundY(x) - 36, 1.4);
  await wait(300);
  void st.fadeIn(0.8);
  audio.play('woodCreak', { vol: 0.5, pitch: 0.7 });
  audio.play('splash', { vol: 0.4 });
  await wait(700);
  p.y = groundY(x);
  st.pose('land');
  audio.play('splash', { vol: 0.6 });
  for (let i = 0; i < 12; i++) s.main.particles.spawn({ frame: A.dot, x: x + rand.range(-8, 8), y: groundY(x) - 2, vx: rand.range(-40, 40), vy: rand.range(-80, -30), ay: 260, life: 0.7, color: [0.75, 0.9, 1], alpha: 1, alpha1: 0, floorY: groundY(x) + 2 });
  await wait(400);
  st.pose(null);
  const walk = p.walkTo(C10.rack + 20, 50);
  c.walkTo(C10.rack + 6, 160, 'zoom');
  await walk;
  c.play('wiggle', 'idle').catch(() => {});
  await st.say([
    { who: 'jenna', text: 'Ahoy, Captain Nature Boy!', expr: 'excited', style: 'shout' },
    { who: 'joshu', text: 'She brought you home in one piece? Good girl. The boat, I mean.', expr: 'happy' },
    { who: 'mori', text: 'Wet boots, full camera. Best kind of day.', expr: 'happy' },
  ]);
}
void dayNumber;
