// V11 Aunty Hana's lessons: hearing the hue kiri for the first time (she plays Te Awa on her bench,
// the band of kids clapping along), making Mori his own from a shed skin he brought from the reeds,
// the lessons themselves (the rhythm game: src/ui/v11/rhythm.ts), and the serpent dance practice on
// the marae with the kids (the dance game in its gentle form: src/ui/v11/dance.ts).

import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { count, remove, give } from '../../inventory';
import { addAffinity } from '../social';
import { addBond } from '../../v10/day';
import { grantBlueprint, BLUEPRINTS } from '../blueprints';
import { completeQuest, questStatus } from '../../quests';
import { cineTo, cineRelease, cineBars } from '../cine';
import { KiriSynth } from '../../../ui/v11/rhythm-audio';
import { SONG_BY_ID, bestStars } from '../../../ui/v11/rhythm-songs';
import type { VCtx } from './ctx';
import { say, bark, sleep, actorOf } from './ctx';
import { X } from './layout';
import { vf, setVf, startVillageQuest } from './lore';
import { holdV } from './people';

/** play a song's opening bars in the world (Hana on her bench) */
async function playBars(songId: string, bars: number) {
  const s = SONG_BY_ID[songId];
  const synth = new KiriSynth();
  const t0 = synth.now();
  if (t0 === null) { await sleep(bars * 8 * (60 / s.bpm / 2) * 1000); return; }
  const e8 = 60 / s.bpm / 2, mel = s.bars.slice(0, bars).join('');
  synth.droneOn(s.root);
  for (let k = 0; k < mel.length; k++) {
    const at = t0 + 0.2 + k * e8, ch = mel[k];
    const g = s.groove[k % 8];
    if (g) synth.pahu(at, g === 2 ? 0.8 : 0.5);
    if (ch >= '1' && ch <= '9') synth.pluck(s.root + s.scale[+ch - 1], at, 0.5, 0.8);
  }
  await sleep((mel.length * e8 + 0.6) * 1000);
  synth.stop();
}

export async function listenToHana(c: VCtx) {
  const f = c.f;
  const ng = actorOf(c, 'hana');
  c.hold = true;
  try {
    holdV(c, 'hana', true);
    if (ng) { await ng.walkTo(X.hanaBench, 40); ng.facing = -1; ng.setAnim('strumSit'); }
    await say(f, [
      { who: 'mori', text: 'Kia ora, Aunty. What is that? I’ve never seen an instrument like it.', expr: 'thinking' },
      { who: 'hana', text: 'The hue kiri. A gourd, a neck of mataī, and a skin from the river. Listen.', expr: 'happy' },
    ]);
    cineBars(true);
    await cineTo(f.st, { x: X.hanaBench, y: c.ground(X.hanaBench) - 34, zoom: 2, secs: 1.4 });
    audio.setMusic('none');
    for (const id of ['pipi', 'ani', 'mikaere']) { const k = actorOf(c, id); if (k) { holdV(c, id, true); void k.walkTo(X.hanaBench - 40 - rand.range(0, 30), 70, 'run').then(() => { k.facing = 1; k.setAnim('sitGround'); }); } }
    await playBars('awa', 4);
    await say(f, [
      { who: 'mori', text: 'It sounds like a string and a drum at the same time.', expr: 'surprised' },
      { who: 'hana', text: 'Because it is. The string sings, the skin answers. The skin is a gift from Hinerua: the serpents moult and the river brings them to us. Nobody is harmed for a hue kiri.', expr: 'serious' },
      { who: 'hana', text: 'You want to learn? Bring me a skin from the reeds by the landing and I will make you your own.', expr: 'teasing' },
    ]);
    addAffinity('hana', 4, 'listened');
  } finally {
    await cineRelease(f.st, 0.8);
    cineBars(false);
    audio.setMusic('aroha');
    for (const id of ['hana', 'pipi', 'ani', 'mikaere']) holdV(c, id, false);
    c.hold = false;
  }
}

export async function makeHueKiri(c: VCtx) {
  const f = c.f;
  remove('vil_kiri', 1);
  setVf('kiriGiven');
  await say(f, [
    { who: 'hana', text: 'A good one! Thin, no tears. She was a big serpent, this one.', expr: 'happy' },
    { who: 'hana', text: 'Sit. This takes a while. Soak the skin, stretch it, lash it, let it dry by the fire.', expr: 'neutral' },
  ]);
  const ng = actorOf(c, 'hana');
  ng?.setAnim('craft');
  await game.fadeTo(1, 2.4);
  f.player.x = X.hanaBench - 30; f.player.y = c.ground(f.player.x); f.player.facing = 1; f.snapCamera();
  audio.play('rope', { vol: 0.4 });
  await sleep(900);
  audio.play('craft', { vol: 0.4 });
  await sleep(700);
  await game.fadeTo(0, 1.8);
  ng?.setAnim('strumSit');
  give('vil_huekiri', 1);
  if (BLUEPRINTS.huekiri) grantBlueprint('huekiri', 'quest:hana');
  addAffinity('hana', 8, 'made the hue kiri');
  addBond('aroha', 3);
  game.ui.toast('Aunty Hana made you a <b>hue kiri</b>.', 'GIFT', 'teal', 3600);
  await say(f, [
    { who: 'hana', text: 'There. Yours. Tap the skin... hear that? She says hello.', expr: 'happy' },
    { who: 'mori', text: 'Aunty... thank you. I don’t know what to say.', expr: 'happy' },
    { who: 'hana', text: 'Say nothing. Play. First lesson now, Te Awa, while your hands are still excited.', expr: 'teasing' },
  ]);
  await lesson(c, 'awa');
}

/** a lesson: the rhythm game, and what Hana makes of it */
export async function lesson(c: VCtx, song?: string) {
  const f = c.f;
  const { runHueKiri } = await import('../../../ui/v11/rhythm');
  holdV(c, 'hana', true);
  const r = await runHueKiri({ song, teacherName: 'Aunty Hana', music: 'aroha' });
  holdV(c, 'hana', false);
  if (!r) return;
  addAffinity('hana', 2 + r.stars * 2, 'a lesson');
  if (r.stars >= 1) setVf('song:' + r.song);
  if (r.song === 'awa' && r.stars >= 1 && questStatus('v11_huekiri') === 'active') {
    completeQuest('v11_huekiri');
    await say(f, [{ who: 'hana', text: 'Te Awa, played by a man with a camera. Koro won’t believe me. Come back and I’ll teach you the others.', expr: 'happy' }]);
  } else if (r.stars === 0) await say(f, [{ who: 'hana', text: rand.pick(['Again tomorrow. Your hands are learning even when your ears are crying.', 'The river took a few wrong turns there. Rivers do. Again.']), expr: 'teasing' }]);
  if (r.song === 'awa' && bestStars('awa') >= 2 && !vf('toldIa')) { setVf('toldIa'); bark('hana', 'Two stars! Now you can try Te Ia, the current.', { expr: 'excited' }); }
}

/** the serpent dance practice on the marae, with the kids */
export async function dancePractice(c: VCtx) {
  const f = c.f;
  const ng = actorOf(c, 'hana');
  c.hold = true;
  const kids = ['ani', 'pipi', 'mikaere'];
  try {
    await say(f, [{ who: 'hana', text: 'The serpent dance. I call four steps, you answer with the same four. Low like the river, then rise like her head. Come.', expr: 'happy' }]);
    holdV(c, 'hana', true);
    const spotM = X.marae[0] + 60, spotN = X.marae[0] + 96;
    if (ng) void ng.walkTo(spotN, 50);
    for (const [i, id] of kids.entries()) { const k = actorOf(c, id); if (k) { holdV(c, id, true); void k.walkTo(X.marae[1] - 10 + i * 18, 80, 'run').then(() => { k.facing = -1; k.setAnim('sitGround'); }); } }
    await f.player.walkTo(spotM, 60);
    f.player.facing = 1;
    while (ng?.walking) await sleep(80);
    if (ng) { ng.facing = -1; ng.setAnim('snakeDance'); }
    cineBars(true);
    await cineTo(f.st, { x: (spotM + spotN) / 2, y: c.ground(spotM) - 40, zoom: 1.9, secs: 1.2 });
    const { runDance } = await import('../../../ui/v11/dance');
    const p = f.player;
    p.poseOverride = 'snakeDance';
    const pose = (isP: boolean, d: number) => {
      const anim = d === 1 ? 'crouch' : d === 2 ? 'cheer' : 'snakeDance';
      if (isP) { if (d === 0) p.facing = -1; if (d === 3) p.facing = 1; p.poseOverride = anim; setTimeout(() => { if (p.poseOverride === anim) { p.poseOverride = 'snakeDance'; p.facing = 1; } }, 380); }
      else if (ng) { if (d === 0) ng.facing = -1; if (d === 3) ng.facing = 1; ng.setAnim(anim); setTimeout(() => { ng.setAnim('snakeDance'); ng.facing = -1; }, 380); }
    };
    const res = await runDance({
      mode: 'practice', partner: 'hana', partnerName: 'Hana', music: 'aroha',
      hooks: {
        call: d => pose(false, d),
        step: (d, j) => {
          if (j === 'perfect' || j === 'good') { pose(true, d); return; }
          p.poseOverride = 'slip';
          setTimeout(() => { if (p.poseOverride === 'slip') p.poseOverride = 'snakeDance'; }, 500);
          if (rand.next() < 0.5) { const k = rand.pick(kids); actorOf(c, k)?.play('laugh', 'sitGround').catch(() => {}); if (rand.next() < 0.5) bark(k, rand.pick(['Wrong way!', 'Ha! Like a goat!', 'Other foot, Mori!']), { expr: 'laugh' }); }
        },
        phrase: i => (i === 0 ? 'Low first...' : i === 2 ? 'Good, now rise!' : null),
      },
    });
    p.poseOverride = null;
    ng?.setAnim('idle');
    const ok = res.acc >= 0.45;
    if (ok) setVf('prep:dance');
    addAffinity('hana', ok ? 5 : 2, 'dance practice');
    for (const k of kids) addAffinity(k, 2, 'watched the dance practice');
    await say(f, [{ who: 'hana', text: res.rating === 'graceful' ? 'Ka pai! You have serpent in you somewhere.' : ok ? 'Good enough for the festival. Nobody will be looking at your feet anyway. Well. The kids will.' : 'Mm. Again. Low like the river, then rise. Again!', expr: ok ? 'happy' : 'teasing' }]);
  } finally {
    f.player.poseOverride = null;
    await cineRelease(f.st, 0.8);
    cineBars(false);
    for (const id of ['hana', ...kids]) holdV(c, id, false);
    c.hold = false;
  }
}
void count; void startVillageQuest;
