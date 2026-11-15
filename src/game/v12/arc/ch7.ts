// V12 Te Ara Matatū, chapter 7, the finale: Te Korokoro, the throat of the island ('unknown').
//
// All five watchers look at the same place. Down in the throat, against the wall past the misty lake,
// stands a gate carved with two of the Old Ones, a slab between them with five sockets. Mori sets the
// five eyes, the slab sinks, warm air breathes out, and out of the dark, slowly, comes the thing every
// watcher was carved after: Te Ngārara Nui, a tuatara as long as a waka.
//
// It is not a fight. Mori survives it and photographs it, three behaviour shots in sequence:
//   1 the tell     it rises on straight legs, crest up and pale, throat swelling, the third eye
//                  gleaming: the warning it always gives (photograph it)
//   2 the strike   then the lunge, the jaws snapping where he stood (get clear, then get the shot: the
//                  world slows for the strike once he is hunting for it)
//   3 the retreat  its point made, it turns and walks back into the dark (one window, then it pauses at
//                  the threshold and comes out to try him again)
// Each shot must be good enough to count (2 stars); all three at 3 stars or better, every time, sets
// arc:ch7:perfect. Then the long look, the bow, the gate closing; and that night, Koro by a fire at the
// foot of the gate. The title in the sky, the credits floating up, arc:done, arc:ng.
//
// Flags: arc:ch7:arrive, arc:ch7:gate, arc:ch7:shot1, arc:ch7:shot2, arc:ch7:shot3, arc:ch7:perfect,
// arc:ch7:miss (a below-3-star behaviour shot was taken), arc:ch7:done, arc:done, arc:ng.

import type { QuestDef } from '../../quests';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Animal } from '../../wild/animal';
import type { Prop } from '../../../world/props';
import { Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { A } from '../../assets';
import { throatGround } from '../../sites10/unknown';
import { cineTo, cineRelease, cineBars, cineShake, cineSlowmo, cineFocusOn } from '../../v11/cine';
import { hitMori } from '../wilds';
import { floatSky, floatText, floatCaption } from '../../../ui/v12/float';
import { throatGate } from '../../../art/v12/arc/props4';
import { ANCIENT_ID, spawnArc, arcHold, arcWait, arcGo, arcTask } from './species4';
import { F, setF, qs, say, line, talk, hints, addProp, sleep, live, onPhoto, eyesHeld } from './common4';

const f7 = (k: string) => () => F(k);

export const ARC_CH7: QuestDef = {
  id: 'arc_ch7', title: 'Te Korokoro', giver: 'story', main: true, chapter: 7,
  desc: 'Five watchers, five eyes, and every one of them looking at the same place: the throat of the island, where warm air breathes out of the ground and nobody goes.',
  steps: [
    { text: 'Go down into Te Korokoro, where the watchers look', done: f7('arc:ch7:arrive'), hint: 'The old stair at the end of the Hot Valley goes down into the steam. Bring a lantern.' },
    { text: 'Set the five eyes in the gate', done: f7('arc:ch7:gate'), hint: 'Past the misty lake, against the far wall.' },
    { text: 'Photograph the Old One\'s warning', done: f7('arc:ch7:shot1'), hint: 'When it rises and its crest goes up. Keep your distance.' },
    { text: 'Photograph its strike', done: f7('arc:ch7:shot2'), hint: 'Get clear of the lunge, then shoot it. Side-on, the whole head.' },
    { text: 'Photograph it going back into the dark', done: f7('arc:ch7:shot3'), hint: 'Let it go. Shoot it as it goes.' },
    { text: 'Sit with Koro by the fire', done: f7('arc:ch7:done') },
  ],
  reward: { rp: 120, text: 'Te Ara Matatū: the path of the watchers, walked to its end.' },
};

const active7 = () => qs('arc_ch7') === 'active';
const GATE_X = 1590;
const G = (x: number) => throatGround(x);

interface Ch7 {
  old: Animal | null; gateShut: Prop | null; gateOpen: Prop | null; lit: Prop[];
  phase: 0 | 1 | 2 | 3 | 4; fighting: boolean; busy: boolean; hitsTaken: number;
  /** the shot the current act allows (the camera checks it) */
  want: 'tell' | 'strike' | 'retreat' | null;
  fire: number;
}

function stage(f: FieldScene, s: Ch7) {
  const shut = addProp(f, 'arc7:gate:5', () => throatGate(5, false), GATE_X, G(GATE_X) + 4, -3.2);
  const lit = [0, 1, 2, 3, 4].map(n => addProp(f, `arc7:gate:${n}`, () => throatGate(n, false), GATE_X, G(GATE_X) + 4, -3.19)).filter((p): p is Prop => !!p);
  const open = addProp(f, 'arc7:gate:open', () => throatGate(5, true), GATE_X, G(GATE_X) + 4, -3.18);
  s.gateShut = shut; s.gateOpen = open; s.lit = lit;
  const opened = F('arc:ch7:gate') && !F('arc:ch7:done');
  const closedLit = F('arc:ch7:done') || F('arc:done');
  lit.forEach((p, i) => { p.hidden = closedLit || opened || i !== 0; });
  if (shut) shut.hidden = !closedLit;
  if (open) open.hidden = !opened;
  // warm air breathing out of the open gate; the fire at the end
  f.main.add(new Custom(-3.1, (rr, st) => {
    if (s.fire > 0) drawFire(rr, GATE_X - 70, G(GATE_X - 70), st.time, s.fire);
  }, dt => {
    if (open && !open.hidden && rand.chance(dt * 4)) f.main.particles.spawn({ frame: A.soft, x: GATE_X + rand.range(-30, 30), y: G(GATE_X) - rand.range(10, 70), vx: rand.range(-6, 6), vy: rand.range(-14, -6), life: rand.range(2, 3.4), color: [0.95, 0.9, 0.85], alpha: 0.28, alpha1: 0, size: 1.4, size1: 4 });
    if (s.fire > 0 && rand.chance(dt * 6)) f.main.particles.spawn({ frame: A.dot2, x: GATE_X - 70 + rand.range(-4, 4), y: G(GATE_X - 70) - 10, vx: rand.range(-6, 6), vy: rand.range(-30, -14), life: rand.range(0.8, 1.6), color: [1, 0.7, 0.3], alpha: 0.9, alpha1: 0, size: 0.5, size1: 0.3 });
  }));
}

const FIRE = [packColor(0.42, 0.08, 0.04, 1), packColor(0.78, 0.22, 0.06, 1), packColor(0.98, 0.52, 0.12, 1), packColor(1, 0.8, 0.32, 1), packColor(1, 0.96, 0.75, 1)];
const LOG = [packColor(0.16, 0.1, 0.07, 1), packColor(0.3, 0.19, 0.11, 1), packColor(0.46, 0.3, 0.17, 1)];
/** a little fire of driftwood: crossed logs, glowing ends, flame tongues that lick and split */
function drawFire(rr: import('../../../gfx/renderer').Renderer, x: number, gy: number, t: number, k: number) {
  // the ground glow, dithered in rings
  for (let dy = -2; dy <= 2; dy++) for (let dx = -26; dx <= 26; dx++) {
    const d = Math.hypot(dx / 26, dy / 2.5);
    if (d < 1 && ((dx + dy) & 1) === 0) rr.rect(x + dx, gy + dy, 1, 1, packColor(1, 0.55, 0.2, (1 - d) * 0.35 * k));
  }
  // logs: two crossed, bark and the charred ends glowing
  for (let i = -9; i <= 9; i++) { rr.rect(x + i, gy - 2 + Math.round(i * 0.18), 1, 2, LOG[i % 3 === 0 ? 2 : 1]); rr.rect(x + i, gy - 1 - Math.round(i * 0.15), 1, 2, LOG[i % 4 === 0 ? 0 : 1]); }
  rr.rect(x - 9, gy - 2, 1, 1, FIRE[2]); rr.rect(x + 9, gy - 3, 1, 1, FIRE[1]);
  // flames: five tongues, each a column of tones that sways and splits at its tip
  for (let j = 0; j < 5; j++) {
    const fx = x - 6 + j * 3, h = Math.round((7 + 6 * Math.sin(j * 1.7) + 4 * Math.sin(t * (7 + j) + j * 2)) * k);
    for (let y = 0; y < h; y++) {
      const u = y / Math.max(1, h), sway = Math.round(Math.sin(t * 9 + j + y * 0.4) * u * 2);
      const w = u < 0.3 ? 3 : u < 0.7 ? 2 : 1;
      const tone = clamp(Math.round(4 - u * 4 + (j === 2 ? 0.5 : 0)), 0, 4);
      rr.rect(fx + sway - (w >> 1), gy - 3 - y, w, 1, FIRE[tone]);
    }
  }
}

function setGateLit(s: Ch7, n: number) {
  s.lit.forEach((p, i) => { p.hidden = i !== n; });
  if (s.gateShut) s.gateShut.hidden = n !== 5;
}

async function openGate(f: FieldScene, s: Ch7) {
  const p = f.player;
  f.cutscene = true;
  try {
    cineBars(true);
    await cineTo(f.st, { x: GATE_X, y: G(GATE_X) - 50, zoom: 1.5, secs: 1.2, ease: 'smooth' });
    await talk(f, [
      { who: 'mori', text: 'Two carved Old Ones. A stone between them. Five holes.', expr: 'thinking' },
      { who: 'mori', text: 'Okay. One... (he presses the first eye in; it clicks, and glows)', expr: 'neutral' },
    ]);
    for (let n = 1; n <= 5; n++) {
      setGateLit(s, n);
      audio.play('star', { vol: 0.5, pitch: 0.7 + n * 0.12 });
      await sleep(n === 5 ? 1000 : 600);
    }
    void say('...five.', 'whisper', 1600);
    await sleep(900);
    audio.setDanger(0.3);
    cineShake(5, 2.4);
    audio.play('roar', { vol: 0.35, pitch: 0.3 });
    await sleep(1400);
    s.lit.forEach(l => { l.hidden = true; });
    if (s.gateShut) s.gateShut.hidden = true;
    if (s.gateOpen) s.gateOpen.hidden = false;
    game.r.post.flash = 0.25;
    setF('arc:ch7:gate');
    p.vx = -60;
    await talk(f, [
      { who: 'mori', text: '(the slab sinks into the ground with a sound like a long breath, and warm air rolls out over him, smelling of stone and rain)', expr: 'surprised' },
      { who: 'mori', text: 'It\'s warm. It\'s... breathing out.', expr: 'scared', style: 'whisper' },
    ]);
    await sleep(800);
    // something in the dark
    s.old = spawnArc(f, ANCIENT_ID, GATE_X + 10, G(GATE_X + 10), { facing: -1, act: 'walk', anim: 'walk' });
    (s.old as unknown as { z: number }).z = -3;
    s.old.alpha = 0;
    const fade = new Custom(0, () => {}, dt => { if (s.old && s.old.alpha < 1) s.old.alpha = Math.min(1, s.old.alpha + dt * 0.4); });
    f.main.add(fade);
    await cineFocusOn({ x: GATE_X - 30, y: G(GATE_X), height: 60 }, { zoom: 1.6, secs: 1.6, dof: 1.3 });
    audio.setMusic('wonder');
    await arcGo(s.old, 'walk', 'walk', GATE_X - 50, null, 10);
    (s.old as unknown as { z: number }).z = 40;
    await arcWait(s.old, 'idle', 'idle', 1.6);
    await floatSky('TE NGĀRARA NUI', 'The Old One of the throat', 'TE ARA MATATŪ · VII', 3400);
    await talk(f, [
      { who: 'mori', text: '(very quietly) Oh.', expr: 'surprised', style: 'whisper' },
      { who: 'mori', text: 'It\'s a tuatara. It\'s a TUATARA. It\'s as long as a waka. The watchers... they\'re all carved after IT.', expr: 'excited', style: 'whisper' },
      { who: 'mori', text: 'Okay. Don\'t run. Don\'t fight. Camera up. Three pictures. Like Koro said: watch, and let it tell you.', expr: 'serious', style: 'whisper' },
    ]);
    await cineRelease(f.st, 1);
    cineBars(false);
  } finally { f.cutscene = false; }
}

/** where the head's strike reaches, from the anchor (facing) */
const REACH: [number, number] = [80, 172];

async function bossLoop(f: FieldScene, s: Ch7) {
  if (s.fighting || !s.old) return;
  s.fighting = true;
  const a = s.old;
  audio.setMusic('tension');
  audio.setDanger(0.6);
  try {
    while (live(f) && !F('arc:ch7:shot3') && !a.gone) {
      const p = f.player;
      if (!F('arc:ch7:shot2')) {
        // close in to striking distance, slow and deliberate; a deep croak now and then
        const want = p.x + (p.x < a.x ? 1 : -1) * 132;
        a.facing = p.x < a.x ? -1 : 1;
        if (Math.abs(want - a.x) > 12) await arcGo(a, 'walk', 'walk', clamp(want, GATE_X - 360, GATE_X + 120), null, 18, { face: a.facing as 1 | -1 });
        if (!live(f)) return;
        if (rand.chance(0.25)) { f.sfx('growl', a.x, 0.6, 0.35); await arcWait(a, 'call', 'call', 1.4); }
        // the tell: the warning, every time
        a.facing = f.player.x < a.x ? -1 : 1;
        s.want = 'tell';
        f.sfx('growl', a.x, 0.5, 0.25);
        cineShake(1.5, 0.6);
        if (!F('arc:ch7:tellTip')) { setF('arc:ch7:tellTip'); void say('Crest up... throat swelling... that\'s the WARNING. Shoot it! Then get clear!', 'scared', 2600); }
        await arcWait(a, 'tell', 'tell', F('arc:ch7:shot1') ? 1.4 : 2.6);
        if (!live(f)) return;
        // the strike
        s.want = F('arc:ch7:shot1') ? 'strike' : null;
        const slow = F('arc:ch7:shot1');
        if (slow) cineSlowmo(0.4, 0.1);
        audio.play('roar', { vol: 0.5, pitch: 0.45 });
        let t = 0, hit = false;
        const x0 = a.x;
        await arcTask(a, 'strike', 'strike', (_a, dt) => {
          t += dt;
          a.x = x0 + a.facing * 26 * clamp(t / 0.35) * (t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.4) : 1);
          a.y = G(a.x);
          const pl = f.player, dx = (pl.x - a.x) * a.facing;
          if (!hit && t > 0.2 && t < 0.5 && dx > REACH[0] && dx < REACH[1] && !f.cutscene) {
            hit = true;
            s.hitsTaken++;
            cineSlowmo(1, 0.05);
            hitMori(f, a.x + a.facing * 115, { sev: 2, what: 'the Old One' });
            cineShake(6, 0.5);
          }
          return t > 0.95;
        });
        if (slow) cineSlowmo(1, 0.3);
        s.want = null;
        if (hit && s.hitsTaken === 1) void line(f, 'mori', 'It held back. It could have... it HELD BACK.', 'scared', 2400);
        await arcWait(a, 'idle', 'idle', 1.4);
        if (!live(f)) return;
        await arcGo(a, 'walk', 'walk', a.x - a.facing * 30, null, 12, { face: a.facing as 1 | -1 });
        continue;
      }
      // the retreat: its point made, it turns and goes back into the dark
      await arcWait(a, 'idle', 'idle', 1.8);
      s.want = 'retreat';
      if (!F('arc:ch7:retreatTip')) { setF('arc:ch7:retreatTip'); void say('It\'s... going. It\'s done with me. Let it go. ...and SHOOT it going!', 'happy', 2600); }
      await arcGo(a, 'retreat', 'retreat', GATE_X + 4, null, 12);
      if (F('arc:ch7:shot3') || !live(f)) break;
      // missed it: at the threshold it looks back, and comes out to try him once more
      s.want = null;
      a.facing = -1;
      await arcWait(a, 'idle', 'idle', 2.2);
      void say('It\'s coming back out. ...one more go, then.', 'think', 2000);
      await arcGo(a, 'walk', 'walk', GATE_X - 120, null, 16, { face: -1 });
    }
  } finally { s.fighting = false; s.want = null; cineSlowmo(1); }
}

async function ending(f: FieldScene, s: Ch7) {
  const a = s.old, p = f.player;
  f.cutscene = true;
  audio.setDanger(0);
  try {
    cineBars(true);
    if (a) {
      // the long look, and the bow
      a.facing = -1;
      await arcWait(a, 'idle', 'idle', 0.6);
      await cineTo(f.st, { x: (a.x + p.x) / 2, y: G(a.x) - 40, zoom: 1.6, secs: 1.4, ease: 'smooth', dof: 1.2 });
      audio.setMusic('wonder');
      await arcWait(a, 'tell', 'tell', 1.2);
      await talk(f, [{ who: 'mori', text: '(it looks at him a long time; the pale scale on its crown catches the light from above, and its old dark eye does not blink)', expr: 'surprised' }]);
      arcHold(a, 'bask', 'bask');
      await sleep(1600);
      await talk(f, [
        { who: 'mori', text: '(it lowers its head to the stone. He does not know why he does it, but he bows back.)', expr: 'serious' },
        { who: 'mori', text: 'Ka kite anō. See you again, old one.', expr: 'happy', style: 'whisper' },
      ]);
      await arcGo(a, 'retreat', 'retreat', GATE_X + 30, null, 10);
      const fade = new Custom(0, () => {}, dt => { a.alpha = Math.max(0, a.alpha - dt * 0.5); if (a.alpha <= 0) a.gone = true; });
      f.main.add(fade);
      await sleep(2000);
    }
    // the gate breathes in, and closes
    cineShake(3, 1.8);
    audio.play('roar', { vol: 0.25, pitch: 0.25 });
    await sleep(1200);
    if (s.gateOpen) s.gateOpen.hidden = true;
    if (s.gateShut) s.gateShut.hidden = false;
    await cineRelease(f.st, 1);
    await game.fadeTo(1, 2.2);
    // that night
    s.fire = 1;
    const fx = GATE_X - 70;
    p.x = fx - 22; p.y = G(p.x); p.facing = 1; p.vx = 0;
    p.poseOverride = 'sitGround';
    const koro = f.addActor('koro', fx + 20, G(fx + 20), -1);
    koro.idleAnim = 'sit'; koro.setAnim('sit');
    let aro = f.guide ? null : f.addActor('aroha', fx + 2, G(fx + 2) + 1, -1);
    if (aro) { aro.idleAnim = 'sit'; aro.setAnim('sit'); }
    audio.play('fireLight', { vol: 0.5 });
    await cineTo(f.st, { x: fx, y: G(fx) - 30, zoom: 1.7, secs: 0, ease: 'smooth' });
    void floatCaption('That night, at the foot of the gate.', 2600);
    await game.fadeTo(0, 2.4);
    audio.setMusic('aroha');
    await talk(f, [
      { who: 'koro', text: 'So. You met him.', expr: 'neutral' },
      { who: 'mori', text: 'You KNEW? Koro. You knew the whole time?', expr: 'surprised' },
      { who: 'koro', text: 'My koro took me to the top of the stair when I was eight. We sat. We did not go down. Some things you are told about, and some things you are shown.', expr: 'serious' },
      { who: 'koro', text: 'The watchers were never pointing at treasure, e tama. They say: here lives the old one. Walk softly. Look, and let it be.', expr: 'serious' },
      { who: 'mori', text: 'I didn\'t take anything. Just three pictures. And I didn\'t even scream. Much.', expr: 'happy' },
      { who: 'aroha', text: 'He screamed a bit.', expr: 'laugh' },
      { who: 'koro', text: '(he laughs, a long low laugh, and puts another stick on the fire)', expr: 'happy' },
      { who: 'koro', text: 'Seven generations, nobody has seen him and come back up to tell it. You did. And you gave back the eyes. That is what a kaitiaki does.', expr: 'serious' },
      { who: 'mori', text: 'Kaitiaki. ...a guardian. Me?', expr: 'surprised', style: 'whisper' },
      { who: 'koro', text: 'You. Now eat. You look like a drowned weta.', expr: 'happy' },
    ]);
    setF('arc:ch7:done');
    setF('arc:done');
    setF('arc:ng');
    game.persist();
    await floatSky('TE ARA MATATŪ', 'The path of the watchers', 'THE END', 4200);
    const credits = [
      'Te Ara Matatū · the path of the watchers',
      'Mori · photographer, kaitiaki',
      'Aroha · who knew the way',
      'Koro Wiremu · who knew all along',
      'Te Wheke Kōhatu · who wanted a lens cap',
      'The Kaipāhua · who wanted everything',
      'Te Ngārara Nui · who let him look',
      'and the watchers, who are still watching',
    ];
    for (const c of credits) { await floatCaption(c, 2600); await sleep(250); }
    void floatText({ text: 'New Game+ unlocked: the watchers remember you.', style: 'notice', ms: 4200 });
    f.hud?.refresh(true);
    void aro;
  } finally {
    cineBars(false);
    f.cutscene = false;
    p.poseOverride = null;
    void cineRelease(f.st, 1.2);
  }
}

function install(f: FieldScene) {
  const st = qs('arc_ch7');
  if (st === 'hidden' && !F('arc:done')) return;
  const s: Ch7 = { old: null, gateShut: null, gateOpen: null, lit: [], phase: 0, fighting: false, busy: false, hitsTaken: 0, want: null, fire: 0 };
  stage(f, s);
  if (active7()) {
    setF('arc:ch7:arrive');
    if (!F('arc:ch7:title')) { setF('arc:ch7:title'); void floatSky('TE KOROKORO', 'The throat of the island', 'TE ARA MATATŪ · VII', 3400); }
  }
  // after the end, the Old One is sometimes out at its gate on warm stone (photographable, basking)
  if (F('arc:done') && rand.chance(0.6)) s.old = spawnArc(f, ANCIENT_ID, GATE_X - 30, G(GATE_X - 30), { facing: -1, act: 'bask', anim: 'bask' });
  const tickHints = hints(f, [
    ['c7gate', GATE_X - 120, 'A gate. In the rock. With the same carving as every watcher. And five holes.'],
    ['c7lake', 900, 'The lake\'s steaming. Something big has been in and out of it: the mud\'s all slid.'],
  ]);
  // the photos: the behaviour in sequence, judged
  onPhoto(f, [ANCIENT_ID], (sub, stars) => {
    if (!active7() || !s.old) return;
    const need = !F('arc:ch7:shot1') ? 'tell' : !F('arc:ch7:shot2') ? 'strike' : !F('arc:ch7:shot3') ? 'retreat' : null;
    if (!need || sub.behavior !== need) {
      if (need && sub.behavior && !F('arc:ch7:wrongTip')) { setF('arc:ch7:wrongTip'); setTimeout(() => void say(`Good... but not the ${need === 'tell' ? 'warning' : need}. Wait for it.`, 'think', 2200), 400); }
      return;
    }
    if (stars < 3) setF('arc:ch7:miss');
    if (stars < 2) { setTimeout(() => void say('Blurry. Again. I can do this.', 'think', 1800), 400); return; }
    const n = need === 'tell' ? 1 : need === 'strike' ? 2 : 3;
    setF(`arc:ch7:shot${n}`);
    audio.play('star', { vol: 0.6, pitch: 1 + n * 0.1 });
    setTimeout(() => void floatText({ text: n === 1 ? 'The warning. Got it.' : n === 2 ? 'THE STRIKE. GOT IT. ...I\'m alive. Got it.' : 'Going home. Got it.', style: 'happy', ms: 2400 }), 300);
    if (n === 3) {
      if (!F('arc:ch7:miss')) setF('arc:ch7:perfect');
      setTimeout(() => { if (live(f)) void ending(f, s); }, 900);
    }
  });
  const I = f.interact as Interactable[];
  I.push({
    x: GATE_X, y: G(GATE_X) - 40, w: 30, h: 40, standX: GATE_X - 44,
    get label() { return eyesHeld() >= 5 ? 'Set the five eyes in the gate' : 'Look at the gate'; },
    enabled: () => active7() && !F('arc:ch7:gate') && !s.busy,
    quest: () => active7() && !F('arc:ch7:gate'),
    action: async () => {
      if (s.busy) return;
      s.busy = true;
      try {
        if (eyesHeld() < 5) { void say(`Five sockets. I have ${eyesHeld()} eye${eyesHeld() === 1 ? '' : 's'}. Not yet.`, 'think', 2400); return; }
        await openGate(f, s);
        void bossLoop(f, s);
      } finally { s.busy = false; }
    },
  });
  f.main.add(new Custom(0, () => {}, () => {
    if (!live(f)) return;
    tickHints();
    // came back with the gate open and the shots not done: it waits in the dark
    // (not while the gate is opening: the flag is set before openGate brings the Old One out itself)
    if (active7() && F('arc:ch7:gate') && !F('arc:ch7:shot3') && !s.old && !s.busy && !f.cutscene && Math.abs(f.player.x - GATE_X) < 260) {
      s.old = spawnArc(f, ANCIENT_ID, GATE_X - 40, G(GATE_X - 40), { facing: -1, act: 'idle', anim: 'idle' });
      void bossLoop(f, s);
    }
  }));
}

/** the chapter's scene content */
export function enterCh7(f: FieldScene, loc: string | null) {
  if (loc !== 'unknown') return;
  try { install(f); } catch (e) { console.warn('[arc7] install', e); }
}
void arcHold;
