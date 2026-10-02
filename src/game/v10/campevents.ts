// V10 special story events at camp, by day and progress. The camp runs at most one per slot a day
// (see day.ts CampEvent): 'wake' right after the morning wake-up, 'morning' after breakfast, 'return'
// after coming home, 'dinner' round the fire after the meal, 'night' before bed.
//
//  day2Plan        (wake, Day 2)  Aroha is back from the ranger hut: the storm took its roof and its
//                  radio, the supply boat is weeks off. Joshu: then this camp is home. The loop begins.
//  agencyContact   (return, Day 2+) Jenna patches the laptop into the salvaged radio... and someone
//                  answers: the agency's field office. Research Points explained; agency requests start.
//  translatorDemo  (morning, Day 3+) Jenna's translator, live, on Aroha. It does not go well.
//  arohaFamily     (dinner, Day 3+) Aroha's whānau, inland past the ranges; nobody has heard from them
//                  since the storm. "Find the village" goes on the board.
//  joshuStories    (dinner, Day 3+) how Joshu really hurt his knee (a shark, a seal, a shark dressed as a
//                  seal) and the Kittiwake's tender: "she'll float again" (the boat repair's hook)
//  chunkHeist      (morning, Day 3+) Chunk steals Joshu's last sausage; a chase round camp ends at his
//                  bed, and his hoard of everybody's missing things
//  stormNight      (night, Day 4+) a storm blows in during the night talk; everyone dives for cover. The
//                  next morning the tarp has leaked and the beach is covered in treasure.
//  villageFound    (return) Mori found the village: Aroha's reaction
//  villageVisitor  (wake, the morning after) a conch from the forest: Aroha's koro, too shy of the dog to
//                  come into camp, has sent a kete of kai and a gift for Mori
//  jennaKite       (morning, close friends with Jenna) her secret project: the Chunkcopter
//
// radioOffice(): calling the field office on the radio once the agency is on the line.

import { game } from '../game';
import { audio } from '../../core/audio';
import { A } from '../assets';
import { groundY } from '../../art/island4/layout';
import { rand } from '../../core/math';
import { wait } from '../v4/islestory';
import { add } from '../inventory';
import { ITEMS } from '../items';
import type { BubbleLine } from '../../ui/bubbles';
import { discoveries } from './regions';
import { CAMP_EVENTS, addCampEvent, dayState, dayNumber, bond, addBond } from './day';
import type { Slot, CampEvent } from './day';
import type { CampDay } from './campday';
import { C10 } from './campcrew';
import { REQUESTS, reqState, acceptReq, pendingThanks, markThanked } from './campquests';
import { setCarry } from '../v11/carry';

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };
const ran = (id: string) => dayState().events[id] !== undefined;
const ranOn = (id: string) => dayState().events[id];

/** run the day's event for a slot, if there is one; true when something played */
export async function runSlot(slot: Slot, cd: CampDay): Promise<boolean> {
  const d = dayState(), day = dayNumber();
  const key = 'slot:' + slot;
  if (d.events[key] === day) return false;
  const ev = CAMP_EVENTS.filter(e => e.slot === slot && (e.once === false || !ran(e.id)) && safe(e)).sort((a, b) => (b.prio ?? 0) - (a.prio ?? 0))[0];
  if (!ev) return false;
  d.events[key] = day;
  d.events[ev.id] = day;
  game.save.flags['v10:ev:' + ev.id] = true;
  game.persist();
  try {
    await ev.run({ st: cd.st, camp: cd, day });
  } catch (e) {
    console.error('[campevents]', ev.id, e);
  } finally {
    cd.release();
    cd.st.chunkFollow();
  }
  return true;
}
function safe(e: CampEvent) { try { return e.when(); } catch { return false; } }

const cdOf = (ctx: { camp: unknown }) => ctx.camp as CampDay;

// ---------------------------------------------------------------- the speakers that aren't on stage
/** the field office on the radio (a bubble over Jenna's radio corner) */
function agencySpeaker(cd: CampDay) {
  const s = cd.s;
  game.ui.bubbles.register('agency', {
    name: 'Field office', voice: 0.85, color: '#3fbca6',
    anchor: () => { const p = s.css(C10.elec + 6, groundY(C10.elec) - 34); return p; },
  });
}
/** Jenna's translator (the TRANSLATE.EXE phone bubble over her head) */
function phoneSpeaker(cd: CampDay) {
  const j = cd.s.jenna;
  game.ui.bubbles.register('phone', {
    name: 'Translator', voice: 1.6, color: '#13262b',
    anchor: () => { const a = j.cssAnchor(); return a ? [a[0] + 26, a[1] - 6] : null; },
  });
}
const radio = (text: string, expr = 'neutral'): BubbleLine => ({ who: 'agency', text: `<i>*kssht*</i> ${text}`, expr });

// ---------------------------------------------------------------- Day 2: the plan
addCampEvent({
  id: 'day2Plan', slot: 'wake', prio: 10, when: () => dayNumber() === 2,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    await st.cut(async () => {
      cd.hold();
      st.place(s.aroha, C10.sign + 120, -1, 'idle');
      st.place(s.joshu, C10.fire + 22, -1, 'sipTea');
      st.place(s.jenna, C10.seats.jenna, 1, 'yawn');
      p.x = C10.fire - 40; p.y = groundY(p.x); p.facing = 1;
      cd.frame(C10.fire + 40, groundY(C10.fire) - 36, 1.4);
      await st.say([{ who: 'jenna', text: 'Aroha’s back! Where did you GO? It’s barely light!', expr: 'surprised' }]);
      await Promise.race([s.aroha.walkTo(C10.fire + 50, 70), wait(5000)]);
      s.aroha.faceTo(p.x);
      await st.say([
        { who: 'aroha', text: 'The ranger hut. I went before dawn, to radio for help.', expr: 'serious' },
        { who: 'aroha', text: 'The storm took the roof. The radio mast is in a tree. The radio is in a different tree.', expr: 'sad' },
        { who: 'joshu', text: 'And the supply boat?', expr: 'thinking' },
        { who: 'aroha', text: 'End of the month. Weeks. If the weather lets it come at all.', expr: 'neutral' },
        { who: 'jenna', text: 'So we’re... stuck. On an island nobody’s ever mapped. With no wifi.', expr: 'shocked' },
        { who: 'joshu', text: 'Stuck? We’ve got a beach, a fire, fresh water, fish in the sea and a smoker I haven’t built yet.', expr: 'happy' },
        { who: 'joshu', text: 'I’ve had worse berths. Most of them were the Kittiwake.', expr: 'teasing' },
        { who: 'joshu', text: 'Here’s how it goes. This camp is home. Every morning we eat, we plan, and we go about our work.', expr: 'serious' },
        { who: 'joshu', text: 'Jenna fixes whatever the sea broke. I fix the tender, and my ankle. Aroha shows us how this island works.', expr: 'neutral' },
        { who: 'joshu', text: 'And you, Doc, you do what you came all this way to do. Go out there, see things, write them down.', expr: 'happy' },
        { who: 'mori', text: 'Every day? An expedition every day?', expr: 'excited', emote: 'sparkle' },
        { who: 'aroha', text: 'Every day you come BACK. Before dark. You don’t know this island yet. It knows you even less.', expr: 'serious' },
        { who: 'joshu', text: 'Take food. Watch your legs. When you’re tired, you turn round. Deal?', expr: 'serious', choices: ['Deal.', 'Deal. And I’ll bring back something amazing.'] },
      ]);
      await st.say([{ who: 'jenna', text: 'And photos! Bring back PHOTOS! I have a board for requests now. It’s made of a door.', expr: 'excited' }]);
      setF('v10:loopIntro');
    });
  },
});

// ---------------------------------------------------------------- the agency on the radio
addCampEvent({
  id: 'agencyContact', slot: 'return', prio: 8, when: () => dayNumber() >= 2 && !F('v10:agency'),
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    agencySpeaker(cd);
    await st.cut(async () => {
      cd.hold();
      st.place(s.jenna, C10.elec + 18, -1, 'wrench');
      st.place(s.joshu, C10.elec + 64, -1, 'idle');
      st.place(s.aroha, C10.elec + 88, -1, 'armsCrossed');
      p.x = C10.elec + 40; p.y = groundY(p.x); p.facing = -1;
      cd.frame(C10.elec + 30, groundY(C10.elec) - 34, 1.7);
      await st.say([
        { who: 'jenna', text: 'Mori! MORI! Get over here! I wired the laptop into the old radio from the wreck!', expr: 'excited', style: 'shout' },
        { who: 'jenna', text: 'The laptop does the clever bits, the radio does the loud bits, and Brenda the battery does the... battery bits.', expr: 'smug' },
        { who: 'joshu', text: 'Does it work?', expr: 'thinking' },
        { who: 'jenna', text: 'Define “work”.', expr: 'teasing' },
      ]);
      for (let i = 0; i < 4; i++) { audio.play('scanBeep', { vol: 0.15, pitch: 0.6 + i * 0.2 }); await wait(240); }
      audio.play('gust', { vol: 0.2, pitch: 2 });
      await st.say([
        { who: 'jenna', text: 'Mayday, mayday, this is the Kittiwake... well, half the Kittiwake... does anyone read? Over.', expr: 'serious' },
        radio('...ssshhhh...', 'neutral'),
        { who: 'jenna', text: '...Anyone? Over?', expr: 'sad' },
      ]);
      await wait(900);
      audio.play('alert', { vol: 0.4 });
      await st.say([
        radio('...wake, Kittiwake, this is the Halcyon Agency field office. We read you. Faintly. Is that Dr. Mori’s expedition?', 'neutral'),
        { who: 'mori', text: 'That’s me! That’s us! We’re alive! All of us, and the dog!', expr: 'excited', react: 'jump' },
        radio('Thank goodness. This is Dr. Ines Marlow, field coordinator. We lost your beacon in the storm four days ago.', 'neutral'),
        radio('Rescue can’t reach you yet. Nothing flies through that weather band. But you’re standing on the biggest unmapped landmass on Earth.', 'neutral'),
        radio('So. While you wait: the agency would very much like you to work.', 'neutral'),
        { who: 'jenna', text: 'Is she... is she giving us HOMEWORK? On a DESERT ISLAND?', expr: 'shocked' },
        radio('Every species you document, every finding you upload from that laptop, comes through to us. We log it and pay out Research Points.', 'neutral'),
        radio('Points buy you the agency’s support: field skills on the laptop, parts for your gear, supply drops when the weather clears.', 'neutral'),
        radio('We’ll send requests too. Things the office needs. Check them on your camp board.', 'neutral'),
        { who: 'mori', text: 'Research Points. For research. On Zealandia.', expr: 'excited', emote: 'sparkle' },
        { who: 'joshu', text: 'Look at his face. You’ve just given the boy the best day of his life, Doctor.', expr: 'laugh' },
        radio('Glad to hear it. Field office out. Stay safe, Kittiwake.', 'happy'),
      ]);
      setF('v10:agency');
      setF('v10:radio');
      for (const r of REQUESTS) if (r.giver === 'agency' && reqState(r) === 'open') { acceptReq(r.id); break; }
    });
    game.ui.toast('The field office is on the radio. Uploads earn <b>Research Points</b>: spend them on the laptop’s <b>skill tree</b> and on gear at <b>Jenna’s bench</b>. The agency’s requests go up on the <b>camp board</b>.', 'AGENCY', 'teal', 9000);
  },
});

const OFFICE_NEWS: string[] = [
  'Weather for tomorrow: fair in the morning, showers on the ranges after noon. Don’t get caught up high.',
  'Our botanist wants to know if anything there is purple. She didn’t say why. Just keep it in mind.',
  'The board went through your uploads last night. There was applause. Someone cried. It might have been me.',
  'A reminder that energy is a finite resource. Mine, and yours. Eat something.',
  'Weather for tomorrow: southerly, cold, clear. Good light for photographs.',
  'We still can’t get anything through that weather band. You’re on your own a while longer. Make it count.',
  'Geology says the rocks on your island are older than they have any right to be. Bring back anything strange.',
];
/** calling the field office on the radio */
export async function radioOffice(cd: CampDay) {
  const st = cd.st, s = cd.s, p = cd.p, d = dayState();
  agencySpeaker(cd);
  await st.cut(async () => {
    p.facing = -1;
    st.pose('kneel');
    audio.play('scanBeep', { vol: 0.15, pitch: 0.8 });
    await st.say([{ who: 'mori', text: 'Field office, field office, this is Kittiwake. Over.', expr: 'neutral' }]);
    // completed requests
    for (const r of pendingThanks('agency')) {
      markThanked(r);
      await st.say([radio(r.thanks, 'happy')]);
    }
    const k = d.talks['office'] ?? 0;
    d.talks['office'] = k + 1;
    const bank = game.save.rp;
    await st.say([
      radio(`Marlow here. ${OFFICE_NEWS[k % OFFICE_NEWS.length]}`, 'neutral'),
      radio(bank > 0 ? `You have ${bank} Research Points banked. Spend them on the laptop’s skill tree, or have your engineer fit some gear.` : 'Your Research Points account is empty. Upload something remarkable.', 'neutral'),
    ]);
    const open = REQUESTS.filter(r => r.giver === 'agency' && reqState(r) === 'open');
    if (open.length) {
      const r = open[0];
      const c = await st.say([radio(r.ask, 'neutral'), { who: 'mori', text: `${r.title}. I’ll take it.`, expr: 'determined', choices: ['Copy that, I’ll do it.', 'Not right now.'] }]);
      if (c === 0) acceptReq(r.id);
    }
    await st.say([radio('Field office out.', 'neutral')]);
    st.pose(null);
    s.hud?.refresh(true);
  });
}

// ---------------------------------------------------------------- the translator
addCampEvent({
  id: 'translatorDemo', slot: 'morning', prio: 6, when: () => dayNumber() >= 3,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    phoneSpeaker(cd);
    await st.cut(async () => {
      cd.hold();
      st.place(s.jenna, C10.fire - 30, 1, 'idle');
      st.place(s.aroha, C10.fire + 26, -1, 'armsCrossed');
      st.place(s.joshu, C10.seats.joshu, -1, 'sit');
      p.x = C10.fire - 56; p.y = groundY(p.x); p.facing = 1;
      cd.frame(C10.fire - 4, groundY(C10.fire) - 36, 1.75);
      await st.say([
        { who: 'jenna', text: 'Ladies, gentlemen, Chunk. Behold: the translator. Version one.', expr: 'smug' },
        { who: 'jenna', text: 'The phone’s offline dictionary, plus every word Aroha said near the laptop for three days. Which is creepy, sorry. But it’s SCIENCE.', expr: 'happy' },
        { who: 'aroha', text: 'You recorded me?', expr: 'angry' },
        { who: 'jenna', text: 'Only the nice words! Go on, say something. Anything.', expr: 'excited' },
        { who: 'aroha', text: 'Mōrena. Kei te pēhea koutou? He pai te rangi i tēnei rā.', expr: 'neutral' },
      ]);
      audio.play('scanBeep', { vol: 0.2, pitch: 1.4 });
      await st.say([
        { who: 'phone', text: '“GOOD MORNING. HOW ARE YOU ALL? THE SKY IS A NICE POTATO TODAY.”', style: 'phone' },
        { who: 'jenna', text: '...Close! So close. Potato is a glitch. Again!', expr: 'worried' },
        { who: 'aroha', text: '(slowly) He kurī pai a Chunk.', expr: 'teasing' },
        { who: 'phone', text: '“CHUNK IS A VERY NOBLE CABBAGE.”', style: 'phone' },
        { who: 'mori', text: '...That’s not wrong.', expr: 'laugh' },
        { who: 'joshu', text: 'Ask it something useful. Ask it where the fish are.', expr: 'teasing' },
        { who: 'aroha', text: 'Kei hea ngā ika?', expr: 'neutral' },
        { who: 'phone', text: '“WHERE ARE MY TROUSERS?”', style: 'phone' },
      ]);
      for (const a of [s.joshu, s.aroha]) a.play('laugh', a.idleAnim).catch(() => {});
      await st.say([
        { who: 'joshu', text: 'HA! It’s got your number, lad!', expr: 'laugh' },
        { who: 'aroha', text: '...Okay. That was funny.', expr: 'laugh' },
        { who: 'jenna', text: 'It’s LEARNING. Every word you teach it, it gets smarter. Unlike Chunk.', expr: 'grumpy' },
        { who: 'aroha', text: 'Then I’ll teach it. Properly. Every night, by the fire. If it’s going to speak my language, it’ll speak it right.', expr: 'serious' },
        { who: 'jenna', text: 'Deal! Mori, it lives on your phone now. Bring it if you ever meet anyone out there.', expr: 'happy' },
      ]);
      game.save.vars['v10:translator'] = Math.max(game.save.vars['v10:translator'] ?? 0, 1);
      setF('v10:translator1');
      addBond('aroha', 4);
    });
    game.ui.toast('The <b>translator</b> works (mostly). Jenna can improve it at her bench as Aroha teaches it more.', 'GEAR', 'teal', 6000);
  },
});

// ---------------------------------------------------------------- Aroha's whānau
addCampEvent({
  id: 'arohaFamily', slot: 'dinner', prio: 7, when: () => (dayNumber() >= 3 && bond('aroha') >= 15) || dayNumber() >= 4,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st;
    await st.say([
      { who: 'mori', text: 'Aroha... your family. The ones who look after the island. Where are they?', expr: 'neutral' },
      { who: 'aroha', text: '...Inland. Past the ranges. A village, with gardens, and a whare with my great-grandfather carved on the door.', expr: 'neutral' },
      { who: 'aroha', text: 'I come down to the coast every summer. To count the birds, watch the beaches. Kaitiaki work.', expr: 'serious' },
      { who: 'aroha', text: 'The storm came from the inland side first. The hut radio was the only way to talk to them.', expr: 'sad' },
      { who: 'jenna', text: 'And now it’s in a tree.', expr: 'sad' },
      { who: 'aroha', text: 'And now it’s in a tree.', expr: 'sad' },
      { who: 'joshu', text: 'They’ll be all right, love. People who live in a place that long know how to ride out a blow.', expr: 'happy' },
      { who: 'aroha', text: 'I know. I know they will. I just... want to see the smoke from their fires. That’s all.', expr: 'sad' },
      { who: 'mori', text: 'Then I’ll look for it. Every time I go inland. Smoke, gardens, carvings. I promise.', expr: 'determined', choices: ['I promise.', 'We’ll find them together.'] },
      { who: 'aroha', text: '...Thank you, Mori.', expr: 'happy' },
    ]);
    addBond('aroha', 6);
    const r = REQUESTS.find(q => q.id === 'r_village');
    if (r && reqState(r) === 'open') acceptReq(r.id);
  },
});

addCampEvent({
  id: 'villageFound', slot: 'return', prio: 9, when: () => discoveries().some(d => d.kind === 'village'),
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    const v = discoveries().find(d => d.kind === 'village');
    await st.cut(async () => {
      cd.hold('aroha');
      st.place(s.aroha, p.x - 60, 1, 'idle');
      await Promise.race([s.aroha.walkTo(p.x - 26, 110, 'run'), wait(3000)]);
      s.aroha.faceTo(p.x);
      await st.say([
        { who: 'aroha', text: `Jenna says you found a village. ${v?.name ? v.name + '.' : ''} Inland. Is it true?`, expr: 'surprised' },
        { who: 'mori', text: 'Gardens on the terraces. Smoke from the cooking fires. Someone was singing.', expr: 'happy' },
        { who: 'aroha', text: '...', expr: 'sad', close: false, auto: 1200 },
        { who: 'aroha', text: 'They’re all right. They’re ALL RIGHT.', expr: 'happy', react: 'bounce' },
        { who: 'aroha', text: 'Mori, I... ngā mihi. Thank you. From me, and from all of them.', expr: 'happy' },
      ]);
      addBond('aroha', 10);
      setF('v10:villageKnown');
    });
  },
});

addCampEvent({
  id: 'villageVisitor', slot: 'wake', prio: 9, when: () => F('v10:villageKnown') && (ranOn('villageFound') ?? 999) < dayNumber(),
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p, a = s.aroha;
    await st.cut(async () => {
      cd.hold('aroha');
      st.place(a, C10.lean - 14, 1, 'sitGround');
      cd.frame(C10.lean + 80, groundY(C10.lean) - 40, 1.25);
      // a conch, from the forest
      for (let i = 0; i < 2; i++) { audio.play('callHonk', { vol: 0.5, pitch: 0.45 }); await wait(1100); }
      a.setAnim('idle');
      a.react('jump');
      await st.say([
        { who: 'aroha', text: 'That’s... that’s a pūtātara. That’s KORO’S pūtātara!', expr: 'surprised', style: 'shout' },
      ]);
      a.walkTo(2760, 120, 'run').then(() => { a.visible = false; });
      await wait(1800);
      await st.say([
        { who: 'jenna', text: 'Who’s Koro? What’s a pūtātara? Why is everyone running?', expr: 'shocked' },
        { who: 'joshu', text: 'Her grandfather, I’d wager. And a shell trumpet. Let the girl go, love.', expr: 'happy' },
      ]);
      await st.fadeOut(1);
      await wait(600);
      st.place(a, 2620, -1, 'idle');
      // Koro's kai, bundled up and slung over her shoulder
      setCarry(a, 'bundle');
      p.x = C10.board + 40; p.y = groundY(p.x); p.facing = 1;
      cd.frame(2480, groundY(2480) - 40, 1.35);
      await st.fadeIn(1);
      await Promise.race([a.walkTo(p.x + 30, 50), wait(6000)]);
      setCarry(a, null);
      a.faceTo(p.x);
      a.setAnim('idle');
      await st.say([
        { who: 'aroha', text: 'Koro came down from the village when he heard there were strangers on the coast.', expr: 'happy' },
        { who: 'aroha', text: 'He won’t come into camp. He’s shy of the dog. He says the last dog he met ate his hat.', expr: 'teasing' },
        { who: 'chunk', text: '*looks deeply innocent*', expr: 'derp', close: false },
        { who: 'aroha', text: 'He sent kai. Goldcurrants from the high gardens, dune lilies, tea. And this. For you.', expr: 'happy' },
        { who: 'mori', text: 'A greenstone pendant? Aroha, I can’t...', expr: 'surprised' },
        { who: 'aroha', text: 'You can. He says thank you for looking for us. He says you have the eyes of a kererū: you notice everything and you eat too much.', expr: 'laugh' },
        { who: 'mori', text: 'Tell him thank you. Tell him... I’ll look after it.', expr: 'happy' },
      ]);
      for (const [id, n] of [['berry_gold', 4], ['plant_dunelily', 2], ['tea', 1]] as [string, number][]) add(id, n);
      setF('v10:pounamu');
      addBond('aroha', 8);
    });
    game.ui.toast('Gifts from the village: goldcurrants, dune lilies, kawakawa tea, and a <b>greenstone pendant</b> for Mori.', 'VILLAGE', 'teal', 6000);
  },
});

// ---------------------------------------------------------------- Joshu's stories
addCampEvent({
  id: 'joshuStories', slot: 'dinner', prio: 5, when: () => dayNumber() >= 3,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s;
    await st.say([
      { who: 'jenna', text: 'Dad, tell them how you did your knee. The real version.', expr: 'teasing' },
      { who: 'joshu', text: 'The real version. Right. Picture it: the Bass Strait, 1998, seas like houses.', expr: 'serious' },
      { who: 'joshu', text: 'I’m out on the bow, hauling the anchor by hand, when up comes a shark the size of a bus...', expr: 'serious' },
      { who: 'jenna', text: 'Last time it was a seal.', expr: 'teasing' },
      { who: 'joshu', text: '...It was a shark. Dressed as a seal.', expr: 'serious' },
      { who: 'aroha', text: 'Why was the shark dressed as a seal?', expr: 'thinking' },
      { who: 'joshu', text: 'To get close to me, obviously. And it would have, too, if I hadn’t kicked it square on the nose.', expr: 'happy' },
      { who: 'jenna', text: 'He slipped on a fish. On the deck. In the harbour. Mum told me.', expr: 'laugh' },
      { who: 'joshu', text: 'A shark-fish. Dressed as a seal.', expr: 'laugh' },
    ]);
    s.joshu.play('bellyLaugh', 'sit').catch(() => {});
    s.jenna.play('laugh', 'sit').catch(() => {});
    await st.say([
      { who: 'joshu', text: 'Seriously, though. I’ve been looking at the Kittiwake’s tender, washed up on the rocks past the wreck.', expr: 'serious' },
      { who: 'joshu', text: 'Hull’s cracked, outboard’s full of sand. But she’s a good little boat. Give me parts and time and she’ll float again.', expr: 'determined' },
      { who: 'mori', text: 'A boat? We could reach the other islands. The south coast. Anywhere.', expr: 'excited' },
      { who: 'joshu', text: 'That we could, son. That we could.', expr: 'happy' },
    ]);
    setF('v10:boatTalk');
    addBond('joshu', 6);
  },
});

// ---------------------------------------------------------------- Chunk's heist
addCampEvent({
  id: 'chunkHeist', slot: 'morning', prio: 3, when: () => dayNumber() >= 4 || (dayNumber() >= 3 && rand.chance(0.5)),
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p, c = s.chunk, jo = s.joshu;
    await st.cut(async () => {
      cd.hold();
      s.buddy.mode = 'script';
      st.place(jo, C10.cook - 22, 1, 'cook');
      st.place(s.jenna, C10.seats.jenna, 1, 'sit');
      st.place(s.aroha, C10.seats.aroha, -1, 'sit');
      st.place(c, C10.cook - 60, 1, 'sit');
      p.x = C10.fire + 8; p.y = groundY(p.x); p.facing = 1;
      cd.frame(C10.cook - 30, groundY(C10.cook) - 36, 1.6);
      await st.say([
        { who: 'joshu', text: 'Right. The last sausage from the Kittiwake’s freezer. Saved it for a special occasion.', expr: 'happy' },
        { who: 'joshu', text: 'And the occasion is: I want a sausage.', expr: 'happy' },
      ]);
      jo.play('grab', 'idle').catch(() => {});
      await wait(500);
      c.walkTo(jo.x - 6, 140, 'run');
      await wait(450);
      c.play('jump', 'idle').catch(() => {});
      audio.play('munch', { vol: 0.5 });
      jo.react('recoil');
      await st.say([
        { who: 'chunk', text: '*snatches the sausage clean out of his hand*', expr: 'excited', close: false, auto: 1200 },
        { who: 'joshu', text: 'OI!!! YOU LITTLE...!', expr: 'angry', style: 'shout', react: 'jump' },
      ]);
      // the chase: round the fire, round the tent, round the board
      c.walkTo(C10.tent - 40, 190, 'zoom');
      s.jenna.walkTo(C10.tent - 10, 110, 'run');
      s.aroha.walkTo(C10.fire - 30, 110, 'run');
      void p.walkTo(C10.tent + 40, 110);
      void st.pan(C10.tent + 30, groundY(C10.tent) - 36, 1.25, 1.4);
      await st.say([{ who: 'jenna', text: 'CHUNK! DROP IT! DROP THE SAUSAGE!', expr: 'angry', style: 'shout' }]);
      await wait(400);
      c.walkTo(C10.board + 20, 190, 'zoom');
      s.jenna.walkTo(C10.board - 20, 120, 'run');
      void st.pan(C10.board - 60, groundY(C10.board) - 36, 1.25, 1.6);
      await st.say([{ who: 'aroha', text: 'He’s going round! Cut him off! LEFT! YOUR OTHER LEFT!', expr: 'shocked', style: 'shout' }]);
      s.aroha.walkTo(C10.rack, 120, 'run');
      await wait(600);
      // and home to his bed, where everything everybody ever lost turns up
      c.walkTo(C10.bed, 190, 'zoom');
      void st.pan(C10.bed + 10, groundY(C10.bed) - 30, 1.7, 1.4);
      await wait(1500);
      c.stopWalk(); c.x = C10.bed; c.facing = -1;
      c.setAnim('lie');
      for (const [a, x] of [[s.jenna, C10.bed - 30], [s.aroha, C10.bed + 34]] as const) { a.stopWalk(); st.place(a, x, x < C10.bed ? 1 : -1, 'idle'); }
      p.x = C10.bed - 54; p.y = groundY(p.x); p.facing = 1;
      await st.say([
        { who: 'mori', text: 'Chunk. What is... under you?', expr: 'thinking' },
        { who: 'jenna', text: 'My screwdriver! And my OTHER screwdriver! And three socks. Whose socks are these?', expr: 'shocked' },
        { who: 'aroha', text: 'That is MY sandal. I have been hopping round this camp for two days.', expr: 'angry' },
        { who: 'mori', text: 'My lens cap! I thought the sea took it!', expr: 'surprised' },
        { who: 'chunk', text: '*lies on his hoard like a tiny dragon, sausage in his mouth*', expr: 'happy', close: false },
      ]);
      jo.stopWalk();
      st.place(jo, C10.bed + 56, -1, 'idle');
      await st.say([
        { who: 'joshu', text: '*puffing* ...Keep it. Keep the sausage. I never wanted it anyway.', expr: 'tired' },
        { who: 'chunk', text: '*the sausage is gone. It was always going to be gone.*', expr: 'derp', close: false },
      ]);
      c.play('proud', 'idle').catch(() => {});
      addBond('jenna', 2); addBond('aroha', 2); addBond('joshu', 2);
    });
  },
});

// ---------------------------------------------------------------- a storm night
addCampEvent({
  id: 'stormNight', slot: 'night', prio: 4, when: () => dayNumber() >= 4,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    cd.seatAll();
    cd.frame(C10.fire, groundY(C10.fire) - 34, 1.4);
    await st.say([
      { who: 'aroha', text: 'Listen. The bush has gone quiet.', expr: 'serious' },
      { who: 'joshu', text: 'Glass is dropping. I can feel it in my knee. Storm’s coming in off the sea.', expr: 'worried' },
    ]);
    let raining = true;
    const rain = async () => {
      while (raining) {
        const cam = s.st.cam;
        for (let i = 0; i < 18; i++) s.main.particles.spawn({ frame: A.dot, x: cam.x + rand.range(-340, 340), y: cam.y - 200, vx: -40, vy: 330, life: 1.3, color: [0.7, 0.8, 0.95], alpha: 0.7, alpha1: 0.3, floorY: groundY(cam.x) + rand.range(0, 30) });
        await wait(70);
      }
    };
    void rain();
    audio.play('thunder', { vol: 0.6 });
    audio.play('gust', { vol: 0.5 });
    game.r.post.flash = 0.35;
    s.st.shake(1.5, 0.4);
    for (let i = 10; i >= 4; i--) { cd.camp.fire = i / 10; await wait(60); }
    await st.say([
      { who: 'jenna', text: 'It’s RAINING. It’s raining SIDEWAYS. How is it raining sideways?!', expr: 'shocked', style: 'shout' },
      { who: 'joshu', text: 'Everybody in! Jenna, the battery! Aroha, in the tent with us, that lean-to won’t hold!', expr: 'serious', style: 'shout' },
      { who: 'aroha', text: 'My lean-to will hold! ...Probably. ...Fine!', expr: 'grumpy' },
    ]);
    for (const a of [s.jenna, s.joshu, s.aroha]) { a.walkTo(1720, a.id === 'joshu' ? 60 : 110, a.id === 'joshu' ? 'limp' : 'run').then(() => { a.visible = false; }); }
    st.pose(null);
    void p.walkTo(C10.tent + 4, 110);
    s.buddy.mode = 'script';
    s.chunk.walkTo(C10.tent + 16, 150, 'zoom');
    audio.play('thunderClose', { vol: 0.8 });
    game.r.post.flash = 0.5;
    await wait(2200);
    await st.say([
      { who: 'mori', text: 'Chunk! In! In in in!', expr: 'scared' },
      { who: 'chunk', text: '*already in, already under the sleeping bag, already trembling*', expr: 'scared', close: false },
    ]);
    raining = false;
    setF('v10:stormNight');
    // the beach in the morning
    for (const [id, n] of [['wood', 3], ['driftglass', 2], ['kelp', 2]] as [string, number][]) add(id, n);
    game.ui.toast(`The storm washes treasure up the beach overnight: ${[['wood', 3], ['driftglass', 2], ['kelp', 2]].map(([id, n]) => `${ITEMS[id as string]?.name} ×${n}`).join(', ')}.`, 'STORM', 'teal', 6000);
  },
});

// ---------------------------------------------------------------- Jenna's secret project
addCampEvent({
  id: 'jennaKite', slot: 'morning', prio: 2, when: () => bond('jenna') >= 40,
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
    await st.cut(async () => {
      cd.hold('jenna');
      st.place(s.jenna, C10.bench + 22, -1, 'idle');
      p.x = C10.bench - 20; p.y = groundY(p.x); p.facing = 1;
      cd.frame(C10.bench, groundY(C10.bench) - 36, 1.8);
      await st.say([
        { who: 'jenna', text: 'Mori. Come here. Close the... there’s no door. Pretend there’s a door. Close it.', expr: 'serious' },
        { who: 'jenna', text: 'I’ve been working on something. In secret. For you. Behold...', expr: 'smug' },
        { who: 'jenna', text: 'THE CHUNKCOPTER. A kite, with the old dashcam from the wheelhouse taped underneath.', expr: 'excited', react: 'bounce' },
        { who: 'mori', text: 'Why is it called the Chunkcopter?', expr: 'thinking' },
        { who: 'jenna', text: 'Because I tested it with Chunk’s chew toy as a payload, obviously. It flew! For four seconds.', expr: 'happy' },
        { who: 'jenna', text: 'One day you’ll photograph the whole canopy from above. Birds’ nests. Bird butts. Everything.', expr: 'excited' },
        { who: 'mori', text: 'Jenna. That’s... that’s genuinely brilliant. Thank you.', expr: 'happy' },
        { who: 'jenna', text: 'I know. You’re welcome. Don’t make it weird. ...Okay, one hug. ONE.', expr: 'happy' },
      ]);
      setF('v10:kiteCam');
      addBond('jenna', 6);
    });
  },
});

void dayState;
