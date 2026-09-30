// V4 island: the dognapping. Back at the wreck, Jenna is screaming: a young woman is trying to carry
// Chunk off down the beach, but he is far too heavy (and far too asleep). She drops him, pulls a
// slingshot loaded with a glowing firestone and pops one into the sand at Mori's feet. Talk her down
// (timed negotiation) and meet Aroha: this island is a sanctuary, her family are its rangers, and one
// loose dog could wipe out every nest on the beach. She stays to help make camp.

import { game } from '../game';
import { audio } from '../../core/audio';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { A } from '../assets';
import { rand } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import type { IsleStory } from './islestory';
import { wait } from './islestory';
import { CAMP } from './islecamp';
import { runNegotiation, NegRound } from '../../ui/v6/standoff';

export { holdSteady, lashingKnot } from '../../ui/v6/camp';

export const ROUNDS: NegRound[] = [
  {
    say: 'STAY BACK! Who are you? What are you doing on this island?!', expr: 'angry', time: 6,
    answers: [
      { t: 'We’re castaways. Our boat broke up on the reef in the storm last night.', trust: 26, nerves: -12, reply: '...The storm. I saw a ship’s lights go out on the reef. That was you?', rexpr: 'surprised' },
      { t: 'Whoa, whoa! Put the rock down, lady!', trust: 0, nerves: 22, reply: 'Don’t “lady” me. And don’t come any closer.', rexpr: 'angry' },
      { t: 'Hi! I’m Mori! I like birds!', trust: 8, nerves: 6, reply: '...Okay? That is not what I asked you.', rexpr: 'grumpy' },
    ],
  },
  {
    say: 'And the DOG. You brought a dog onto this island?', expr: 'angry', time: 6,
    answers: [
      { t: 'That’s Chunk. He washed up with us. He’s... honestly, not much of a hunter.', trust: 22, nerves: -10, reply: '(she glances at Chunk, asleep on his back in the sand) ...I can see that.', rexpr: 'thinking' },
      { t: 'Relax, it’s just a dog.', trust: -5, nerves: 24, reply: 'JUST a dog? Do you know what one dog does to a kiwi burrow?', rexpr: 'angry' },
      { t: 'Chunk! Attack!', trust: -8, nerves: 30, reply: '(Chunk does not move. At all.) ...Is that supposed to scare me?', rexpr: 'shocked' },
    ],
  },
  {
    say: 'This island is a sanctuary. There are nests all along this beach. One loose dog could wipe out a whole colony.', expr: 'serious', time: 7,
    answers: [
      { t: 'Then he stays on a lead, in camp, every minute. You have my word.', trust: 26, nerves: -14, reply: '...Every minute. Day and night.', rexpr: 'serious' },
      { t: 'We didn’t exactly choose to wash up here.', trust: 6, nerves: 8, reply: 'I know you didn’t. That doesn’t make the dog less of a problem.', rexpr: 'grumpy' },
      { t: 'What nests? I didn’t see any nests.', trust: -4, nerves: 16, reply: 'That’s the point. They’re HIDDEN. From things like him.', rexpr: 'angry' },
    ],
  },
  {
    say: 'What’s in your pockets? Slowly.', expr: 'serious', time: 5,
    answers: [
      { t: '(Show her, slowly) A camera and a notebook. I’m a naturalist. I’m here for the birds, not to hurt them.', trust: 24, nerves: -14, reply: 'A research badge... You’re an actual scientist. Huh.', rexpr: 'surprised' },
      { t: '(Reach into your pocket, quickly)', trust: -10, nerves: 32, reply: 'SLOWLY, I said!', rexpr: 'shocked' },
      { t: 'Nothing! ...Mostly sand.', trust: 10, nerves: 0, reply: 'Mostly sand. Great.', rexpr: 'grumpy' },
    ],
  },
  {
    say: '...The big one. Is he hurt?', expr: 'worried', time: 6,
    answers: [
      { t: 'Joshu, our captain. Sprained ankle and a bump on the head. He’ll be okay.', trust: 18, nerves: -10, reply: 'He should keep the weight off it. I have bandages.', rexpr: 'worried' },
      { t: '(Joshu:) “I’ve had worse from my daughter’s cooking.”', trust: 16, nerves: -16, reply: '(the corner of her mouth twitches) ...Don’t make me laugh. I’m trying to be scary.', rexpr: 'laugh' },
      { t: 'Why do you care?', trust: -4, nerves: 14, reply: 'Because I’m not a monster. Unlike some dogs.', rexpr: 'angry' },
    ],
  },
];
export const EXTRA: NegRound[] = [
  {
    say: '...Fine. Ask me something. Anything. But no sudden moves.', expr: 'neutral', time: 7,
    answers: [
      { t: 'Can I ask your name?', trust: 22, nerves: -10, reply: '...Aroha.', rexpr: 'neutral' },
      { t: 'Do you live out here? All alone?', trust: 18, nerves: -6, reply: 'My whānau are the rangers here. I keep watch over the nests for the season.', rexpr: 'serious' },
      { t: 'Is that stone... glowing?', trust: 14, nerves: -2, reply: 'Kōhatu ahi. Firestone. It pops like a firecracker. Scares off stoats. And strangers.', rexpr: 'smug' },
    ],
  },
  {
    say: 'What happened to your ship?', expr: 'thinking', time: 7,
    answers: [
      { t: 'Something huge hit the hull in the storm. Then one wave took the whole ship.', trust: 18, nerves: -8, reply: 'The storm was the worst I’ve ever seen. You’re lucky. All of you.', rexpr: 'worried' },
      { t: 'We were chasing albatrosses. It got out of hand.', trust: 12, nerves: -4, reply: '...You’re very strange.', rexpr: 'teasing' },
      { t: 'Ask the reef.', trust: 2, nerves: 8, reply: 'Charming.', rexpr: 'grumpy' },
    ],
  },
  {
    say: 'Your pounamu... no, sorry. That’s my pounamu. Why are you staring at it?', expr: 'surprised', time: 6,
    answers: [
      { t: 'It’s beautiful. Greenstone, right? It suits you.', trust: 18, nerves: -8, reply: '...It was my kuia’s. My grandmother’s. Thank you.', rexpr: 'happy' },
      { t: 'I wasn’t staring! I was... birdwatching. At your neck.', trust: 10, nerves: 0, reply: 'That is somehow worse.', rexpr: 'teasing' },
      { t: 'Can I have it?', trust: -6, nerves: 18, reply: 'No!', rexpr: 'angry' },
    ],
  },
];

export async function runStandoff(st: IsleStory) {
  const s = st.s, p = s.player, c = s.chunk, j = s.jenna, jo = s.joshu, ar = s.aroha;
  await st.cut(async () => {
    s.hud?.show(false);
    // Chunk smells food and bolts for the wreck
    s.buddy.mode = 'script';
    c.setAnim('sniff');
    await st.say([{ who: 'chunk', text: '*SNIFF* ...!!!', expr: 'surprised', close: false, auto: 900 }]);
    c.walkTo(CAMP.salvage, 190, 'zoom');
    await st.say([
      { who: 'mori', text: 'Chunk? CHUNK! Where are you...', expr: 'surprised' },
      { who: 'joshu', text: 'He smells Jenna’s biscuits. Or my biscuits. Which she stole.', expr: 'teasing' },
    ]);
    await wait(900);
    audio.play('emoteSurprise', { vol: 0.7 });
    await st.say([{ who: 'jenna', text: 'HEEEEELP! MORI! DAD! SOMEBODY’S STEALING CHUNK!!!', expr: 'scared', style: 'shout', close: false }]);
    // cut to the wreck: a stranger staggering off with an extremely heavy pug
    await st.fadeOut(2.4);
    st.hide(c);
    st.place(ar, CAMP.salvage + 60, -1, 'carryHeavy');
    ar.walkAnim = 'carryHeavy';
    st.place(j, CAMP.salvage - 40, 1, 'point');
    st.place(c, ar.x, -1, 'carried');
    c.terrain = null;
    const carry = new Custom(47, () => {
      if (c.anim !== 'carried') return;
      const h = ar.handPos();
      c.x = h ? h[0] : ar.x + ar.facing * 8;
      c.y = h ? h[1] + 10 : ar.y - 22;
      c.facing = ar.facing;
    });
    s.main.add(carry);
    p.x = CAMP.salvage + 200; p.y = groundY(p.x); p.facing = -1;
    st.place(jo, p.x + 40, -1, 'injured');
    st.joshuF.on = false;
    const cam = s.st.cam;
    cam.locked = true;
    cam.x = CAMP.salvage + 90; cam.y = groundY(cam.x) - 36; cam.zoom = 1.45;
    await st.fadeIn(2.4);
    ar.walkTo(ar.x - 30, 14, 'carryHeavy');
    await st.say([
      { who: 'aroha', text: 'Hnnngh... what... do they... FEED you?!', expr: 'angry' },
      { who: 'jenna', text: 'PUT HIM DOWN! He’s a baby! He’s a big heavy baby!', expr: 'angry', style: 'shout' },
      { who: 'chunk', text: 'Hnnk. *completely limp*', expr: 'derp', close: false },
    ]);
    ar.stopWalk();
    ar.play('tired', 'idle').catch(() => {});
    await wait(500);
    // she drops him: flop
    s.main.remove(carry);
    c.terrain = s.st.terrain;
    c.y = groundY(c.x);
    c.setAnim('flop');
    audio.play('land', { vol: 0.4, pitch: 1.4 });
    await wait(700);
    c.setAnim('bellyUp');
    c.setExpr('sleep');
    await st.say([{ who: 'chunk', text: '...', expr: 'sleep', close: false, auto: 900 }]);
    ar.faceTo(p.x);
    ar.setAnim('slingAim');
    ar.idleAnim = 'slingAim';
    audio.play('rope' as never, { vol: 0.5, pitch: 1.6 });
    await st.say([
      { who: 'aroha', text: 'Kāti! STOP! Not one more step!', expr: 'angry', style: 'shout' },
      { who: 'mori', text: 'Whoa, whoa! We’re not...', expr: 'scared' },
    ]);
    // warning shot into the sand at Mori's feet
    await warningShot(st, ar.x + ar.facing * 10, ar.y - 38, p.x - 10, groundY(p.x - 10));
    p.body.react('jump');
    p.body.setExpr('shocked', 2);
    await st.say([
      { who: 'mori', text: 'WHAT WAS THAT?! Did the rock just EXPLODE?!', expr: 'shocked', style: 'shout' },
      { who: 'joshu', text: 'Easy! Easy now, girl. Nobody’s grabbing anything. Let’s all just breathe.', expr: 'serious' },
    ]);
    await runNegotiation(ROUNDS, EXTRA);
    // she lowers the slingshot
    ar.setAnim('armsCrossed');
    ar.idleAnim = 'armsCrossed';
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
      { who: 'aroha', text: 'I’ll help you make camp here. Tomorrow I’ll take you to the hut; the supply boat comes at the end of the month, and it can take you home.', expr: 'neutral' },
      { who: 'aroha', text: 'But the dog sleeps on a lead. Right next to one of you. All night.', expr: 'serious' },
      { who: 'mori', text: 'Next to me. He always sleeps next to me anyway. Usually ON me.', expr: 'happy' },
      { who: 'aroha', text: '...Deal.', expr: 'happy' },
    ]);
    c.setAnim('getUp');
    c.setExpr('happy', 2);
    await wait(700);
    c.walkTo(ar.x + 12, 60);
    await wait(700);
    c.faceTo(ar.x);
    c.play('wiggle', 'idle').catch(() => {});
    await st.say([
      { who: 'chunk', text: 'Boof!', expr: 'happy' },
      { who: 'aroha', text: '...Kia ora, Chunk.', expr: 'happy' },
    ]);
    cam.locked = false;
    st.set('v4:arohaJoined');
    s.hud?.show(true);
    st.camp.campMode();
    game.ui.toast('Make camp before dark. Everyone has a job: find yours around the camp.', 'CAMP', 'teal', 5600);
  });
}

/** the firestone: a glowing arc, then a pop of sparks and sand */
async function warningShot(st: IsleStory, x0: number, y0: number, x1: number, y1: number) {
  const s = st.s;
  audio.play('whoosh' as never, { vol: 0.6, pitch: 1.4 });
  let t = 0;
  const dur = 0.45;
  const shot = new Custom(60, rr => {
    const k = Math.min(1, t / dur);
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 16;
    rr.fxDraw(A.glow, x, y, 0.12, 0.12, 0, packColor(1, 0.6, 0.2, 1), 3);
    rr.fxDraw(A.dot2, x, y, 1.4, 1.4, 0, packColor(1, 0.85, 0.4, 1), 3);
  }, dt => { t += dt; });
  s.main.add(shot);
  await wait(dur * 1000);
  s.main.remove(shot);
  audio.play('shipCrash' as never, { vol: 0.3, pitch: 2.4 });
  audio.play('fireLight' as never, { vol: 0.8, pitch: 1.4 });
  s.st.shake(4, 0.35);
  game.r.post.flash = 0.45;
  const m = s.main;
  for (let i = 0; i < 26; i++) m.glowParticles.spawn({ frame: A.dot, x: x1, y: y1 - 2, vx: rand.range(-90, 90), vy: rand.range(-140, -40), ay: 260, life: rand.range(0.3, 0.8), color: [1, 0.75, 0.3], color1: [1, 0.3, 0.1], alpha: 1, alpha1: 0, glow: true, intensity: 3, floorY: y1 + 2 });
  for (let i = 0; i < 18; i++) m.particles.spawn({ frame: A.dot2, x: x1, y: y1 - 1, vx: rand.range(-70, 70), vy: rand.range(-110, -30), ay: 300, life: rand.range(0.5, 1), color: [0.9, 0.8, 0.6], alpha: 1, alpha1: 0, floorY: y1 + 3 });
  for (let i = 0; i < 6; i++) m.particles.spawn({ frame: A.soft, x: x1 + rand.range(-6, 6), y: y1 - 6, vx: rand.range(-10, 10), vy: rand.range(-20, -8), life: 1.6, color: [0.6, 0.58, 0.55], alpha: 0.5, alpha1: 0, size: 0.4, size1: 1.2 });
  await wait(400);
}
