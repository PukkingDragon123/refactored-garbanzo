// V4 island: the dognapping. Mori and Joshu are back from the bush when Jenna screams: a young woman has
// snatched Chunk off the sand beside her and is trying to make off with him, but he is far too heavy
// (and far too asleep). Caught between Jenna and the two men running up the beach, she drops him, has
// her slingshot out and drawn before anyone can blink, and pops a glowing firestone into the sand at
// Mori's feet. Then the standoff, right there on the beach: the camera closes in on the group, and
// Mori and Joshu talk her down together (their answers are little paper cards over their heads; her
// slingshot drawing tighter, the firestone glowing hotter in the pouch, is the clock). Meet Aroha:
// this island is a sanctuary, her whānau are its rangers, and one loose dog could wipe out every nest on
// the beach. She stays to help make camp.
//
// runStandoff(st) is the entry point (islecamp.ts, or the Day 1 return from the bush): it stages the
// scene itself (after a quick fade), so it starts cleanly from wherever everyone was.

import { game } from '../game';
import { audio } from '../../core/audio';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { A } from '../assets';
import { rand, clamp } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import type { Actor } from '../../world/actor';
import type { IsleStory } from './islestory';
import { wait } from './islestory';
import { CAMP } from './islecamp';
import type { NegRound, NegAnswer } from '../../ui/v6/standoff';
import { cineTo, cineRelease, cineBars } from '../v11/cine';
import { choiceCards } from '../../ui/v11/choicecards';

export { holdSteady, lashingKnot } from '../../ui/v6/camp';

/** an answer, and who of the two says it (Mori or Joshu; they talk her down together) */
export interface BeachAnswer extends NegAnswer { who?: 'mori' | 'joshu' }
export interface BeachRound extends NegRound { answers: BeachAnswer[] }

export const ROUNDS: BeachRound[] = [
  {
    say: 'STAY BACK! Who are you? What are you doing on this island?!', expr: 'angry', time: 6,
    answers: [
      { who: 'mori', t: 'We’re castaways. Our boat broke up on the reef in the storm last night.', trust: 26, nerves: -12, reply: '...The storm. I saw a ship’s lights go out on the reef. That was you?', rexpr: 'surprised' },
      { who: 'joshu', t: 'Easy, easy. Nobody here wants trouble. The sea dumped us here, that’s all.', trust: 14, nerves: -8, reply: 'The sea dumped you. With a DOG.', rexpr: 'grumpy' },
      { who: 'mori', t: 'Whoa, whoa! Put the rock down, lady!', trust: 0, nerves: 22, reply: 'Don’t “lady” me. And don’t come any closer.', rexpr: 'angry' },
    ],
  },
  {
    say: 'And the DOG. You brought a dog onto this island?', expr: 'angry', time: 6,
    answers: [
      { who: 'mori', t: 'That’s Chunk. He washed up with us. He’s... honestly, not much of a hunter.', trust: 22, nerves: -10, reply: '(she glances at Chunk, asleep on his back in the sand) ...I can see that.', rexpr: 'thinking' },
      { who: 'joshu', t: 'Relax, it’s just a dog.', trust: -5, nerves: 24, reply: 'JUST a dog? Do you know what one dog does to a kiwi burrow?', rexpr: 'angry' },
      { who: 'mori', t: 'Chunk! Attack!', trust: -8, nerves: 30, reply: '(Chunk does not move. At all.) ...Is that supposed to scare me?', rexpr: 'shocked' },
    ],
  },
  {
    say: 'This island is a sanctuary. There are nests all along this beach. One loose dog could wipe out a whole colony.', expr: 'serious', time: 7,
    answers: [
      { who: 'mori', t: 'Then he stays on a lead, in camp, every minute. You have my word.', trust: 26, nerves: -14, reply: '...Every minute. Day and night.', rexpr: 'serious' },
      { who: 'joshu', t: 'We didn’t exactly choose to wash up here, you know.', trust: 6, nerves: 8, reply: 'I know you didn’t. That doesn’t make the dog less of a problem.', rexpr: 'grumpy' },
      { who: 'mori', t: 'What nests? I didn’t see any nests.', trust: -4, nerves: 16, reply: 'That’s the point. They’re HIDDEN. From things like him.', rexpr: 'angry' },
    ],
  },
  {
    say: 'What’s in your pockets? Slowly.', expr: 'serious', time: 5,
    answers: [
      { who: 'mori', t: '(Show her, slowly) A camera and a notebook. I’m a naturalist. I’m here for the birds, not to hurt them.', trust: 24, nerves: -14, reply: 'A research badge... You’re an actual scientist. Huh.', rexpr: 'surprised' },
      { who: 'joshu', t: '(Turns out his pockets) A pocketknife, a busted watch and a ship’s biscuit. You can have the biscuit.', trust: 12, nerves: -8, reply: '...Keep your biscuit.', rexpr: 'teasing' },
      { who: 'mori', t: '(Reach into your pocket, quickly)', trust: -10, nerves: 32, reply: 'SLOWLY, I said!', rexpr: 'shocked' },
    ],
  },
  {
    say: '...The big one. Is he hurt?', expr: 'worried', time: 6,
    answers: [
      { who: 'joshu', t: 'Turned my ankle on your reef, and a bump on the head. I’ll live.', trust: 18, nerves: -10, reply: 'Keep the weight off it. I have bandages.', rexpr: 'worried' },
      { who: 'joshu', t: 'I’ve had worse from my daughter’s cooking.', trust: 16, nerves: -16, reply: '(the corner of her mouth twitches) ...Don’t make me laugh. I’m trying to be scary.', rexpr: 'laugh' },
      { who: 'mori', t: 'Why do you care?', trust: -4, nerves: 14, reply: 'Because I’m not a monster. Unlike some dogs.', rexpr: 'angry' },
    ],
  },
];
export const EXTRA: BeachRound[] = [
  {
    say: '...Fine. Ask me something. Anything. But no sudden moves.', expr: 'neutral', time: 7,
    answers: [
      { who: 'mori', t: 'Can I ask your name?', trust: 22, nerves: -10, reply: '...Aroha.', rexpr: 'neutral' },
      { who: 'joshu', t: 'Do you live out here? On your own?', trust: 18, nerves: -6, reply: 'My whānau are the rangers here. I keep watch over the nests for the season.', rexpr: 'serious' },
      { who: 'mori', t: 'Is that stone... glowing?', trust: 14, nerves: -2, reply: 'Kōhatu ahi. Firestone. It pops like a firecracker. Scares off stoats. And strangers.', rexpr: 'smug' },
    ],
  },
  {
    say: 'What happened to your ship?', expr: 'thinking', time: 7,
    answers: [
      { who: 'mori', t: 'Something huge hit the hull in the storm. Then one wave took the whole ship.', trust: 18, nerves: -8, reply: 'The storm was the worst I’ve ever seen. You’re lucky. All of you.', rexpr: 'worried' },
      { who: 'joshu', t: 'A wave. Biggest I’ve seen in forty years at sea. Rolled her clean over.', trust: 16, nerves: -8, reply: 'Forty years. And the sea still nearly had you.', rexpr: 'serious' },
      { who: 'mori', t: 'We were chasing vanebills. It got out of hand.', trust: 12, nerves: -4, reply: '...You’re very strange.', rexpr: 'teasing' },
    ],
  },
  {
    say: 'Your pounamu... no, sorry. That’s MY pounamu. Why are you staring at it?', expr: 'surprised', time: 6,
    answers: [
      { who: 'mori', t: 'It’s beautiful. Greenstone, right? It suits you.', trust: 18, nerves: -8, reply: '...It was my kuia’s. My grandmother’s. Thank you.', rexpr: 'happy' },
      { who: 'joshu', t: 'Fine bit of carving, that. A fish hook?', trust: 16, nerves: -6, reply: 'Hei matau. For safe travel over water. ...Didn’t work for you lot, did it.', rexpr: 'teasing' },
      { who: 'mori', t: 'I wasn’t staring! I was... birdwatching. At your neck.', trust: 10, nerves: 0, reply: 'That is somehow worse.', rexpr: 'teasing' },
    ],
  },
];

/** where everyone stands for the dognapping, by the salvage pile (a function: islecamp.ts imports this
 *  module, so CAMP isn't there yet while it loads) */
const spots = () => ({ jenna: CAMP.salvage - 36, aroha: CAMP.salvage + 34, mori: CAMP.salvage + 122, joshu: CAMP.salvage + 160 });

export async function runStandoff(st: IsleStory) {
  const s = st.s, p = s.player, c = s.chunk, j = s.jenna, jo = s.joshu, ar = s.aroha;
  const AT = spots();
  await st.cut(async () => {
    s.hud?.show(false);
    s.buddy.mode = 'script';
    st.joshuF.on = false;
    st.jennaF.on = false;
    // a quick cut to the salvage pile, wherever everyone was: Jenna by the sand, the stranger staggering
    // off with an extremely heavy pug, Mori and Joshu pelting up the beach
    if (game.r.post.fade < 0.98) await st.fadeOut(3.4);
    st.hide(c);
    st.place(ar, AT.aroha, 1, 'carryHeavy');
    ar.walkAnim = 'carryHeavy';
    ar.fidget = false;
    st.place(j, AT.jenna, 1, 'point');
    st.place(c, ar.x, 1, 'carried');
    c.terrain = null;
    const carry = new Custom(47, () => {
      if (c.anim !== 'carried') return;
      const h = ar.handPos();
      c.x = h ? h[0] : ar.x + ar.facing * 8;
      c.y = h ? h[1] + 10 : ar.y - 22;
      c.facing = ar.facing;
    });
    s.main.add(carry);
    p.x = AT.mori + 110; p.y = groundY(p.x); p.facing = -1;
    st.place(jo, AT.joshu + 120, -1, 'injured');
    const cam = s.st.cam;
    cam.locked = true;
    cam.x = (AT.jenna + AT.joshu) / 2 + 20; cam.y = groundY(cam.x) - 40; cam.zoom = 1.5;
    void st.fadeIn(2.6);
    // they run in; she staggers a few steps toward the bush... straight into their path
    void p.walkTo(AT.mori, 120);
    void jo.walkTo(AT.joshu, 62, 'limp');
    void ar.walkTo(ar.x + 14, 12, 'carryHeavy');
    await st.say([
      { who: 'jenna', text: 'PUT HIM DOWN! He’s a baby! He’s a big heavy baby!', expr: 'angry', style: 'shout', close: false },
      { who: 'aroha', text: 'Hnnngh... what... do they... FEED you?!', expr: 'angry', close: false },
      { who: 'chunk', text: 'Hnnk. *completely limp*', expr: 'derp', close: false },
    ]);
    if (p.state === 'script') { p.x = AT.mori; p.y = groundY(p.x); }
    p.facing = -1;
    jo.stopWalk(); jo.x = AT.joshu; jo.faceTo(ar.x); jo.setAnim('injured');
    ar.stopWalk();
    ar.faceTo(p.x);
    await st.say([{ who: 'mori', text: 'Hey! HEY! That’s our dog!', expr: 'shocked', close: false, auto: 700 }]);
    // boxed in: she drops him (flop), and her slingshot is out and drawn before anyone can blink
    s.main.remove(carry);
    c.terrain = s.st.terrain;
    c.y = groundY(c.x);
    c.setAnim('flop');
    audio.play('land', { vol: 0.4, pitch: 1.4 });
    ar.idleAnim = 'slingAim';
    ar.setAnim('slingAim');
    audio.play('rope', { vol: 0.5, pitch: 1.7 });
    audio.play('whoosh', { vol: 0.35, pitch: 1.9 });
    await wait(450);
    c.setAnim('bellyUp');
    c.setExpr('sleep');
    st.pose('scared');
    await st.say([
      { who: 'aroha', text: 'Kāti! STOP! Not one more step!', expr: 'angry', style: 'shout', close: false },
      { who: 'mori', text: 'Whoa, whoa! We’re not...', expr: 'scared', close: false, auto: 600 },
    ]);
    // the warning shot into the sand at Mori's feet; she's reloaded and drawn again before it lands
    await shoot(st, ar, p.x - 12, () => { p.body.react('jump'); p.body.setExpr('shocked', 2); j.setExpr('shocked', 2); });
    ar.idleAnim = 'slingAim';
    ar.setAnim('slingAim');
    await st.say([
      { who: 'mori', text: 'WHAT WAS THAT?! Did the rock just EXPLODE?!', expr: 'shocked', style: 'shout', close: false },
      { who: 'joshu', text: 'Easy! Easy now. Nobody’s grabbing anything. Let’s all just breathe.', expr: 'serious', close: false },
    ]);
    await negotiateOnBeach(st);
    // she lowers the slingshot, tucks it back in her belt
    ar.idleAnim = 'armsCrossed';
    ar.holdFrame = null;
    ar.setAnim('armsCrossed');
    ar.fidget = true;
    st.pose('idle');
    await st.say([
      { who: 'aroha', text: '...Aroha. My name is Aroha.', expr: 'neutral' },
      { who: 'aroha', text: 'This island is a sanctuary. Kororā, tōrea, kiwi... birds that nest on the ground, because nothing here ever hunted them.', expr: 'serious' },
      { who: 'aroha', text: 'My whānau have looked after it for four generations. I saw a strange dog by the wreck and I thought, that’s it. One dog, and it’s over.', expr: 'sad' },
      { who: 'mori', text: 'You were protecting them. I... honestly? I’d have done the same.', expr: 'serious' },
      { who: 'aroha', text: '(looking at Chunk, who is snoring on his back with his tongue out) ...He is the least dangerous animal I have ever seen.', expr: 'teasing' },
      { who: 'jenna', text: 'He’s a MENACE. To snacks. Exclusively to snacks.', expr: 'smug' },
      { who: 'aroha', text: 'Sorry about the firestone. It only makes a noise. Mostly.', expr: 'grumpy' },
      { who: 'mori', text: 'Mostly?', expr: 'worried' },
      { who: 'joshu', text: 'Well, Aroha. We’re Joshu, Jenna and Mori. And the heavy one’s Chunk. We’ve had a long, strange day.', expr: 'happy' },
      { who: 'aroha', text: 'It’ll be dark in an hour. You won’t make it to the ranger hut tonight, not on that ankle.', expr: 'thinking' },
      { who: 'aroha', text: 'I’ll help you make camp here. Tomorrow I’ll go to the hut and radio for help.', expr: 'neutral' },
      { who: 'aroha', text: 'But the dog sleeps on a lead. Right next to one of you. All night.', expr: 'serious' },
      { who: 'mori', text: 'Next to me. He always sleeps next to me anyway. Usually ON me.', expr: 'happy' },
      { who: 'aroha', text: '...Deal.', expr: 'happy' },
    ]);
    c.setAnim('getUp');
    c.setExpr('happy', 2);
    await wait(700);
    c.walkTo(ar.x + ar.facing * 14, 60);
    await wait(700);
    c.faceTo(ar.x);
    c.play('wiggle', 'idle').catch(() => {});
    await st.say([
      { who: 'chunk', text: 'Boof!', expr: 'happy' },
      { who: 'aroha', text: '...Kia ora, Chunk.', expr: 'happy' },
    ]);
    ar.idleAnim = 'idle';
    ar.setAnim('idle');
    cam.locked = false;
    st.set('v4:arohaJoined');
    s.hud?.show(true);
    st.camp.campMode();
    game.ui.toast('Make camp before dark. Everyone has a job: find yours around the camp.', 'CAMP', 'teal', 5600);
  });
}

// ------------------------------------------------------------------ the standoff, on the beach

const CARD_COL: Record<string, string> = { mori: '#4a6a2a', joshu: '#2c4a7a' };
/** her slingshot clip (slingStandoff): frame 0 lowered .. 20 at full draw */
const DRAW_FRAMES = 20;
const shuffle = <T>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; };

/**
 * Talking Aroha down where they stand: the camera eases in to frame the group, the letterbox bars come
 * in, and each round Mori's and Joshu's possible answers appear over their heads. TRUST lowers her
 * slingshot answer by answer until it hangs at her side; NERVES (and every second of silence) draw it
 * back tighter, the firestone glowing hotter in the pouch. Silence or a bad answer winds her up; at 100
 * nerves she fires a warning shot and you start over. Same rounds and rules as the old close-up.
 */
export async function negotiateOnBeach(st: IsleStory, rounds: BeachRound[] = ROUNDS, extra: BeachRound[] = EXTRA): Promise<void> {
  const s = st.s, p = s.player, jo = s.joshu, ar = s.aroha, j = s.jenna;
  const stage = s.st;
  // frame the group: Jenna and Chunk behind her, Aroha, the two men facing her
  const xs = [ar.x, p.x, jo.x, j.visible ? j.x : ar.x];
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const zoom = clamp(game.r.VW / (x1 - x0 + 150), 1.7, 2.5);
  cineBars(true);
  await cineTo(stage, { x: (x0 + x1) / 2 + 4, y: groundY((x0 + x1) / 2) - 30, zoom, secs: 1.1 });
  let trust = 0, nerves = 55;
  // her draw: `want` follows trust and nerves, `hes` the hesitation of the moment
  let k = 1, want = 1, hes = 0, glow = 0, shake = 0, t = 0, holding = true;
  ar.fidget = false;
  ar.idleAnim = 'slingStandoff';
  ar.setAnim('slingStandoff');
  st.pose('placate');
  jo.idleAnim = 'placate';
  jo.setAnim('placate');
  if (j.visible) j.setExpr('worried');
  const target = () => clamp(0.95 - (trust / 100) * 0.9 + Math.max(0, nerves - 55) / 180, 0.02, 1);
  const tick = new Custom(52, rr => {
    // the clock, in her hand: the firestone in the pouch glows hotter the longer you leave it
    const h = ar.handPos();
    if (!h || glow < 0.02) return;
    const f = ar.facing, gx = h[0] + f * 2.4, gy = h[1] + 0.5;
    const fl = 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 7);
    rr.light(gx, gy, 18 + glow * 26, 1, 0.55, 0.22, (0.25 + glow * 1.1) * fl, 0.15);
    rr.fxDraw(A.glow, gx, gy, 0.05 + glow * 0.07, 0.05 + glow * 0.07, 0, packColor(1, 0.62, 0.26, 1), (0.5 + glow * 1.6) * fl);
    if (glow > 0.55 && Math.random() < glow * 0.25) s.main.glowParticles.spawn({ frame: A.dot, x: gx, y: gy - 1, vx: rand.range(-12, 12), vy: rand.range(-40, -16), ay: 30, life: rand.range(0.3, 0.6), color: [1, 0.8, 0.4], color1: [1, 0.3, 0.1], alpha: 1, alpha1: 0, glow: true, intensity: 2 });
  }, dt => {
    t += dt;
    want = clamp(target() + hes * 0.35, 0, 1);
    k += (want - k) * Math.min(1, dt * (want > k ? 7 : 2.4));
    shake = Math.max(0, shake - dt);
    // a breath in the draw, and a tremble when she's wound up
    const nv = clamp(nerves / 100, 0, 1);
    const breath = Math.sin(t * 2.1) * 0.6 + (nv > 0.7 ? Math.sin(t * 23) * 0.6 : 0);
    if (holding) ar.holdFrame = clamp(Math.round(k * DRAW_FRAMES + breath * k), 0, DRAW_FRAMES);
    glow += ((nv * 0.4 + hes * 0.8) * k - glow) * Math.min(1, dt * 3);
  });
  s.main.add(tick);
  const anchorOf = (who: string): (() => [number, number] | null) => () => (who === 'joshu' ? jo : p.body).cssAnchor();
  const all = [...rounds];
  let i = 0, won = false, first = true;
  try {
    while (!won) {
      const r = i < all.length ? all[i] : extra[(i - all.length) % extra.length];
      i++;
      ar.setExpr(r.expr);
      await st.say([{ who: 'aroha', text: r.say, expr: r.expr, close: false, auto: 650, style: r.expr === 'angry' && nerves > 80 ? 'shout' : undefined }]);
      if (first) { first = false; game.ui.toast('Answer before she loses her nerve: <span class="key">1</span><span class="key">2</span><span class="key">3</span> or tap a card. Calm and honest.', 'TALK HER DOWN', 'teal', 4200); }
      const opts = shuffle(r.answers);
      let cr = 0;
      const pick = await choiceCards(opts.map(a => {
        const who = a.who ?? 'mori';
        return { text: a.t, who, name: who === 'joshu' ? 'Joshu' : 'Mori', color: CARD_COL[who], anchor: anchorOf(who) };
      }), {
        timeout: r.time,
        tick: (tt, kk) => {
          // hesitation: she draws back tighter, the rubber creaks
          hes = Math.pow(kk, 1.3);
          cr -= 1 / 60;
          if (cr <= 0 && kk > 0.3) { cr = 0.5 - kk * 0.32; audio.play('woodCreak', { vol: 0.08 + kk * 0.22, pitch: 1.6 + kk * 0.7 }); }
          if (kk > 0.75 && Math.floor(tt * 4) !== Math.floor((tt - 1 / 60) * 4)) ar.react('tremble');
        },
      });
      hes = 0;
      if (pick === null) {
        nerves += 20;
        audio.play('wrong', { vol: 0.35 });
        ar.react('shake');
        await st.say([{ who: 'aroha', text: 'Say something! Why aren’t you saying anything?!', expr: 'angry', close: false, auto: 700 }]);
      } else {
        const a = opts[pick], who = a.who ?? 'mori';
        await st.say([{ who, text: a.t, expr: a.trust >= 15 ? 'serious' : a.nerves > 15 ? 'scared' : 'neutral', close: false, auto: 550 }]);
        trust += a.trust;
        nerves += a.nerves;
        audio.play(a.trust >= 15 ? 'fact' : a.nerves > 15 ? 'wrong' : 'ui', { vol: 0.35 });
        // her reaction, there in the scene
        if (a.nerves > 15) { ar.react('recoil'); shake = 0.4; }
        else if (a.trust >= 15) ar.react('shrink');
        await st.say([{ who: 'aroha', text: a.reply, expr: a.rexpr, close: false, auto: 900 }]);
        ar.setExpr(a.rexpr);
      }
      if (nerves >= 100) {
        // her nerve snaps: POP, into the sand at their feet
        holding = false;
        await shoot(st, ar, (p.x + jo.x) / 2, () => { p.body.react('jump'); jo.react('jump'); });
        ar.idleAnim = 'slingStandoff';
        ar.setAnim('slingStandoff');
        k = 1;
        holding = true;
        await st.say([{ who: 'aroha', text: 'That was a WARNING. The next one isn’t going in the sand.', expr: 'angry', close: false }]);
        game.ui.toast('She’s rattled. Start again, and keep calm.', 'TALK HER DOWN', 'teal', 2800);
        trust = 0; nerves = 55; i = 0;
        continue;
      }
      if (trust >= 100) won = true;
    }
    // she lowers it all the way: the slingshot hangs at her side
    trust = 130; nerves = 0;
    ar.setExpr('neutral');
    await st.say([{ who: 'aroha', text: '...', expr: 'neutral', close: false, auto: 900 }]);
    await wait(600);
  } finally {
    s.main.remove(tick);
    // (held lowered until the story moves her on)
    ar.holdFrame = 0;
    st.pose(null);
    jo.idleAnim = 'injured';
    jo.setAnim('injured');
    cineBars(false);
    // ease back out to a medium shot of the group for the rest of the scene
    await cineTo(stage, { x: (x0 + x1) / 2, y: groundY((x0 + x1) / 2) - 38, zoom: 1.55, secs: 0.9 });
  }
}

/**
 * For the dev panel / console (zl.standoff): the beach standoff on its own, on the island scene that's
 * up: Aroha squares up to Mori and Joshu where Mori stands, then everything goes back to how it was.
 */
export async function standoffOnly(st: IsleStory) {
  const s = st.s, p = s.player, ar = s.aroha, jo = s.joshu;
  const keep = [ar, jo].map(a => ({ a, x: a.x, y: a.y, f: a.facing, vis: a.visible, idle: a.idleAnim, anim: a.anim }));
  await st.cut(async () => {
    s.hud?.show(false);
    st.joshuF.on = false;
    p.facing = -1;
    st.place(ar, p.x - 86, 1, 'slingAim');
    st.place(jo, p.x + 36, -1, 'injured');
    await wait(500);
    await negotiateOnBeach(st);
    await cineRelease(s.st, 0.6);
  });
  for (const k of keep) { k.a.x = k.x; k.a.y = k.y; k.a.facing = k.f; k.a.visible = k.vis; k.a.idleAnim = k.idle; k.a.holdFrame = null; k.a.setAnim(k.anim); k.a.fidget = true; }
}

/** her shot: the release, a glowing arc off the fork, a pop of sparks and sand where it lands, the
 *  quick reload, and she's drawn again (back to her idle clip) */
async function shoot(st: IsleStory, ar: Actor, tx: number, onHit?: () => void) {
  const then = ar.idleAnim;
  ar.holdFrame = null;
  const rel = ar.play('slingRelease', 'slingReady');
  // (the stone leaves the pouch a beat into the clip)
  await wait(60);
  const h = ar.handPos();
  const x0 = (h ? h[0] : ar.x) + ar.facing * 14, y0 = (h ? h[1] : ar.y - 46) - 1;
  await warningShot(st, x0, y0, tx, groundY(tx));
  onHit?.();
  await rel;
  await ar.play('slingDraw', then);
  ar.setAnim(then);
  if (then === 'slingStandoff') ar.holdFrame = DRAW_FRAMES;
}

/** the firestone: a glowing arc, then a pop of sparks and sand */
async function warningShot(st: IsleStory, x0: number, y0: number, x1: number, y1: number) {
  const s = st.s;
  audio.play('whoosh', { vol: 0.6, pitch: 1.4 });
  let t = 0;
  const dur = 0.32;
  const shot = new Custom(60, rr => {
    const k = Math.min(1, t / dur);
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10;
    rr.fxDraw(A.glow, x, y, 0.12, 0.12, 0, packColor(1, 0.6, 0.2, 1), 3);
    rr.fxDraw(A.dot2, x, y, 1.4, 1.4, 0, packColor(1, 0.85, 0.4, 1), 3);
    for (let q = 1; q <= 3; q++) {
      const kq = Math.max(0, k - q * 0.06), xq = x0 + (x1 - x0) * kq, yq = y0 + (y1 - y0) * kq - Math.sin(kq * Math.PI) * 10;
      rr.fxDraw(A.dot, xq, yq, 1, 1, 0, packColor(1, 0.5, 0.15, 1), 2 - q * 0.5);
    }
  }, dt => { t += dt; });
  s.main.add(shot);
  await wait(dur * 1000);
  s.main.remove(shot);
  audio.play('shipCrash', { vol: 0.3, pitch: 2.4 });
  audio.play('fireLight', { vol: 0.8, pitch: 1.4 });
  s.st.shake(4, 0.35);
  game.r.post.flash = 0.45;
  const m = s.main;
  for (let i = 0; i < 26; i++) m.glowParticles.spawn({ frame: A.dot, x: x1, y: y1 - 2, vx: rand.range(-90, 90), vy: rand.range(-140, -40), ay: 260, life: rand.range(0.3, 0.8), color: [1, 0.75, 0.3], color1: [1, 0.3, 0.1], alpha: 1, alpha1: 0, glow: true, intensity: 3, floorY: y1 + 2 });
  for (let i = 0; i < 18; i++) m.particles.spawn({ frame: A.dot2, x: x1, y: y1 - 1, vx: rand.range(-70, 70), vy: rand.range(-110, -30), ay: 300, life: rand.range(0.5, 1), color: [0.9, 0.8, 0.6], alpha: 1, alpha1: 0, floorY: y1 + 3 });
  for (let i = 0; i < 6; i++) m.particles.spawn({ frame: A.soft, x: x1 + rand.range(-6, 6), y: y1 - 6, vx: rand.range(-10, 10), vy: rand.range(-20, -8), life: 1.6, color: [0.6, 0.58, 0.55], alpha: 0.5, alpha1: 0, size: 0.4, size1: 1.2 });
  await wait(300);
}
