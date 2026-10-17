// V11 NPCs at camp: story events for the camp's day slots (day.ts addCampEvent) that bring the new
// people into the crew's life:
//   n_rangersBack   (morning, Day 3+)  Aroha: the rangers are back at Te Puni station, go and say hello
//   n_tipeneFirst   (morning, Day 4+)  a carver walks into camp to look at the Kittiwake's teak wheel
//   n_ngaioFirst    (morning, Day 5+)  a weaver comes for the wreck's rope and nets
//   n_radioFix      (return / morning) Jenna fixes the station radio on her bench
//   n_rosieChunk    (morning)          Rosie comes down with Hine to meet Chunk; her badge for Mori
//   n_helixNews     (return)           the crew hear about the Helix camp
//   n_margeNews     (dinner)           a naturalist has lived in the grove for eleven years?!
//   n_partnerNews   (dinner)           the crew react, kindly, to whoever Mori is with now
// Crew chats also get "give a gift" and the romance options (camptalk.ts addTalkExtra).

import { game } from '../../game';
import { audio } from '../../../core/audio';
import { groundY } from '../../../art/island4/layout';
import { addCampEvent, dayNumber } from '../../v10/day';
import type { CampCtx, Crew } from '../../v10/day';
import type { CampDay } from '../../v10/campday';
import { C10 } from '../../v10/campcrew';
import { addTalkExtra } from '../../v10/camptalk';
import { count, remove, give } from '../../inventory';
import { addNote } from '../../v10/regions';
import { addAffinity, meet, hasMet, partner, partnerSince, memo, setMemo } from '../social';
import { registerNpcArt } from '../../../art/v11/npcs/register';
import { giftOpt } from './talk';
import { romanceMenu } from './romance';
import { addVisitor, SPOTS } from './spawn';
import { F, setF, V, setV, sleep } from './state';
import type { Line } from './types';
import { L } from './types';

const cdOf = (ctx: CampCtx) => ctx.camp as CampDay;
const ranDay = (k: string) => V('n:ev:' + k);

// ---------------------------------------------------------------- the rangers are back
addCampEvent({
  id: 'n_rangersBack', slot: 'morning', prio: 6, when: () => dayNumber() >= 3 && !hasMet('hine'),
  run: async ctx => {
    const cd = cdOf(ctx);
    await cd.st.say(L([
      ['aroha', 'News. The rangers are back. Hine and Doug, from the station, and their girl. They were on the far side of the island when the storm hit.', 'happy'],
      ['aroha', 'Their roof is in the creek. They are fine. Hine is furious. Go and say hello, up the bush track past the cove.', 'teasing'],
      ['jenna', 'Rangers! Grown-ups with a RADIO! Okay, a broken radio. But a radio!', 'excited'],
    ]));
    addNote({ id: 'note:station', loc: 'isle-track', x: SPOTS.station, text: 'Te Puni ranger station: Hine, Doug and Rosie are back.' });
  },
});

// ---------------------------------------------------------------- the craftspeople's first visits
async function arrive(ctx: CampCtx, id: 'tipene' | 'ngaio', lines: Line[]) {
  const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
  registerNpcArt();
  setF(id === 'tipene' ? 'n:tipeneMet' : 'n:ngaioMet');
  setV(id === 'tipene' ? 'n:tipeneFirst' : 'n:ngaioFirst', dayNumber());
  const from = id === 'tipene' ? 2700 : 1180;
  const a = addVisitor(s, id, from);
  if (!a) return;
  await st.cut(async () => {
    cd.hold();
    const to = id === 'tipene' ? SPOTS.tipene + 30 : SPOTS.ngaio - 24;
    p.x = to + (id === 'tipene' ? -46 : 46); p.y = groundY(p.x); p.facing = id === 'tipene' ? 1 : -1;
    cd.frame(to, groundY(to) - 36, 1.4);
    await Promise.race([a.walkTo(to, 36), sleep(7000)]);
    a.faceTo(p.x);
    meet(id);
    await st.say(L(lines));
  });
}
addCampEvent({
  id: 'n_tipeneFirst', slot: 'morning', prio: 4, when: () => dayNumber() >= 4 && !F('n:tipeneMet'),
  run: ctx => arrive(ctx, 'tipene', [
    ['tipene', 'Kia ora koutou. Don’t get up. I walked down from up the coast to see a ship I heard was broken on your rocks.', 'happy'],
    ['joshu', 'The Kittiwake. She’s mostly scrap now, I’m afraid.', 'sad'],
    ['tipene', 'Mostly. But her wheel is teak, and teak remembers the sea. I’m Tīpene. I carve. I’ll come by now and then, if you’ll have me.', 'happy'],
    ['aroha', 'Matua Tīpene carved the prow of my koro’s waka. Be polite, Mori. He’s very important.', 'serious'],
    ['tipene', 'I’m very old. That’s not the same thing.', 'laugh'],
  ]),
});
addCampEvent({
  id: 'n_ngaioFirst', slot: 'morning', prio: 4, when: () => dayNumber() >= 5 && !F('n:ngaioMet') && F('n:tipeneMet'),
  run: ctx => arrive(ctx, 'ngaio', [
    ['ngaio', 'Is THAT the shipwreck? With all the rope? Hi! Sorry! Ngaio. I weave. Tīpene said you had nets. He undersold it.', 'excited'],
    ['jenna', 'You want our... rope? Our junk rope?', 'surprised'],
    ['ngaio', 'Nothing is junk. Everything is a kete waiting to happen. Can I come back? I’m coming back.', 'happy'],
  ]),
});

// ---------------------------------------------------------------- Jenna fixes the station radio
async function radioFix(ctx: CampCtx) {
  const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p;
  await st.cut(async () => {
    cd.hold('jenna');
    st.place(s.jenna, C10.bench + 6, -1, 'wrench');
    p.x = C10.bench - 30; p.y = groundY(p.x); p.facing = 1;
    cd.frame(C10.bench, groundY(C10.bench) - 34, 1.6);
    await st.say(L([
      ['jenna', 'Is that a RADIO? A real one? Give. Give it. Gimme.', 'excited'],
      ['jenna', 'Cracked board, wet battery, the aerial’s snapped... and someone wrapped it in about a mile of tape. A ranger did this. I can tell.', 'thinking'],
    ]));
    audio.play('scanBeep' as never, { vol: 0.5 });
    await sleep(1400);
    s.jenna.play('celebrate', 'idle').catch(() => {});
    await st.say(L([
      ['jenna', '*kssht* ...THERE. It talks. It’s alive. Tell Hine she owes me one battery and a lifetime of gratitude.', 'smug'],
    ]));
    remove('q_radio', 1);
    give('q_radio_fixed', 1);
    setF('q_roof:fixed');
    addAffinity('jenna', 3, 'radio');
  });
  game.ui.toast('Jenna fixed the <b>station radio</b>. Take it back to Hine.', 'QUEST', 'teal', 3800);
}
const radioDue = () => count('q_radio') > 0 && !F('q_roof:fixed');
addCampEvent({ id: 'n_radioFix', slot: 'return', prio: 7, once: false, when: radioDue, run: radioFix });
addCampEvent({ id: 'n_radioFixAM', slot: 'morning', prio: 7, once: false, when: radioDue, run: radioFix });

// ---------------------------------------------------------------- Rosie meets Chunk
addCampEvent({
  id: 'n_rosieChunk', slot: 'morning', prio: 8, when: () => F('q_junior:given') && !F('q_junior:chunk') && dayNumber() > V('q_junior:day'),
  run: async ctx => {
    const cd = cdOf(ctx), st = cd.st, s = cd.s, p = cd.p, c = s.chunk;
    registerNpcArt();
    const rosie = s.addActor('rosie', 2640, groundY(2640), -1);
    rosie.z = 44;
    const hine = s.addActor('hine', 2690, groundY(2690), -1);
    hine.z = 44;
    await st.cut(async () => {
      cd.hold();
      s.buddy.mode = 'script';
      st.place(c, C10.fire + 60, 1, 'sit');
      p.x = C10.fire + 20; p.y = groundY(p.x); p.facing = 1;
      cd.frame(C10.fire + 90, groundY(C10.fire) - 36, 1.4);
      void hine.walkTo(C10.fire + 150, 40);
      await Promise.race([rosie.walkTo(C10.fire + 80, 80, 'run'), sleep(5000)]);
      rosie.faceTo(c.x);
      await st.say(L([['rosie', 'Is that him? Is that CHUNK? Oh my gosh. Oh my GOSH. He’s so round!', 'excited']]));
      c.play('jump', 'sit').catch(() => {});
      rosie.setAnim('pet');
      await st.say([
        { who: 'chunk', text: '*rolls over, offers belly, abandons all dignity*', expr: 'happy', close: false },
        { who: 'rosie', text: 'He LIKES me. Mum! He likes me! We’re best friends! It’s official!', expr: 'excited' },
        { who: 'hine', text: 'Ten minutes, Rosie. Then home. Thank you for putting up with her, Mori.', expr: 'happy' },
      ]);
      rosie.setAnim('idle');
      rosie.faceTo(p.x);
      await st.say(L([
        ['rosie', 'This is for you. Because you did my mission. You’re a Junior Ranger now. Honorary. That means you’re allowed.', 'serious'],
        ['mori', '“J.R. MORI. HONORY.” I’ll wear it every day.', 'happy'],
        ['rosie', 'You HAVE to. That’s the rule.', 'smug'],
      ]));
      give('q_badge', 1);
      setF('q_junior:chunk');
      addAffinity('rosie', 15, 'quest');
      addAffinity('hine', 4, 'quest');
      await Promise.race([Promise.all([rosie.walkTo(2700, 60), hine.walkTo(2720, 40)]), sleep(6000)]);
      rosie.visible = false; hine.visible = false;
    });
    game.ui.toast('Rosie made you an honorary <b>Junior Ranger</b>.', 'FRIEND', 'teal', 4200);
  },
});

// ---------------------------------------------------------------- the crew hear about the neighbours
addCampEvent({
  id: 'n_helixNews', slot: 'return', prio: 5, when: () => F('n:helix:met'),
  run: async ctx => {
    await cdOf(ctx).st.say(L([
      ['mori', 'The boot prints. I found them. A Helix team, bioprospectors, camped on the Serpent Coast. Two of them.', 'serious'],
      ['joshu', 'Prospectors. Out here. They’ll strip this place like a fishing ground if nobody watches them.', 'grumpy'],
      ['aroha', 'Kaitiaki watch. That’s what we do. Them too, now.', 'serious'],
      ['jenna', 'Do they have a satellite phone? A charger? Snacks? I’m asking for science.', 'excited'],
      ['mori', 'The tall one bakes. The doctor doesn’t sleep. I think... they’re not villains. I think they’re just far from home.', 'thinking'],
    ]));
  },
});
addCampEvent({
  id: 'n_margeNews', slot: 'dinner', prio: 4, when: () => hasMet('marge'),
  run: async ctx => {
    await cdOf(ctx).st.say(L([
      ['mori', 'There’s a woman living in the palm grove. A naturalist. She’s been here eleven years. By choice.', 'excited'],
      ['joshu', 'Eleven years? On her own? Blimey. Does she want for anything? Fish? A hand with the roof?', 'surprised'],
      ['mori', 'Tea. She really, really wants tea.', 'laugh'],
      ['aroha', 'Marge. My cousins call her the beetle lady. She gave me a pencil when I was eight. I still have it.', 'happy'],
    ]));
  },
});

// ---------------------------------------------------------------- the crew react to a partner
const PARTNER_LINES: Record<string, Line[]> = {
  jenna: [
    ['joshu', 'So. You and my daughter.', 'serious'],
    ['mori', '...Yes, sir.', 'worried'],
    ['joshu', 'Don’t “sir” me, son. Look at her. She hasn’t stopped humming since lunch.', 'happy'],
    ['joshu', 'Be good to each other. That’s all I ask. ...And if you’re not, I’ve got a very big boat and a very small island.', 'teasing'],
    ['jenna', 'DAD.', 'angry'],
    ['aroha', 'Ka pai. About time. Everybody could see it from the reef.', 'teasing'],
  ],
  aroha: [
    ['jenna', 'So when were you two going to TELL us? I saw you on the beach! I have eyes! I have binoculars!', 'excited'],
    ['aroha', 'We are telling you. Now. Eat your fish.', 'teasing'],
    ['joshu', 'Good on you both. You look after each other out there. You already do, mind.', 'happy'],
    ['aroha', 'Koro will want to meet him properly. He’ll make Mori eat for three hours.', 'laugh'],
    ['mori', 'I can do three hours.', 'determined'],
  ],
  teo: [
    ['jenna', 'You’re seeing the RIVAL TEAM’S tech guy? Mori. MORI. That’s so dramatic. I love it.', 'excited'],
    ['joshu', 'The big lad with the boots? Seems a decent sort. Bring him to dinner. We’ll see what he makes of my stew.', 'happy'],
    ['aroha', 'He bakes, I hear. Then he can stay.', 'teasing'],
  ],
  sunny: [
    ['jenna', 'The hunter? The one who can knock a can off a log at fifty paces? Mori, you have TASTE.', 'excited'],
    ['aroha', 'Sunny Faleolo. She’s good people. Loud, but good.', 'happy'],
    ['joshu', 'Ask her what she puts in that boil-up. For the camp’s sake.', 'teasing'],
  ],
};
addCampEvent({
  id: 'n_partnerNews', slot: 'dinner', prio: 14, once: false,
  when: () => !!partner() && memo('mori', 'toldCrew:' + partner()) !== partnerSince() && dayNumber() >= partnerSince(),
  run: async ctx => {
    const pid = partner();
    if (!pid) return;
    setMemo('mori', 'toldCrew:' + pid, partnerSince());
    const lines = PARTNER_LINES[pid];
    if (lines) await cdOf(ctx).st.say(L(lines));
    for (const c of ['jenna', 'joshu', 'aroha'] as Crew[]) if (c !== pid) addAffinity(c, 2, 'happy for you');
  },
});

// ---------------------------------------------------------------- gifts and walks with the crew
addTalkExtra((who, h) => {
  const host = { id: who as string, say: h.say, f: game.scene as never, a: (game.scene as unknown as { actor?(id: string): unknown }).actor?.(who) as never };
  const out: { label: string; run: () => Promise<void> }[] = [];
  // the crew member stays put (their camp routine is held) while it plays
  const held = (fn: () => Promise<void>) => async () => {
    const { activeCamp } = await import('../../v10/campday');
    const cd = activeCamp();
    cd?.hold(who);
    try { await fn(); } finally { cd?.release(who); }
  };
  const g = giftOpt(who);
  if (g) out.push({ label: g.label, run: held(() => g.run(host)) });
  for (const m of romanceMenu(who)) out.push({ label: m.label, run: held(() => m.run(host)) });
  return out;
});

void ranDay;
