// V12 Te Ara Matatū, chapter 5: Te Kanohi Toremi, the drowned eye (the Sea Grotto, the Deep, the
// Serpent Coast). Wetsuit-gated.
//
// The third watcher looked to the sea. Through the grotto and down the sump, Mori finds the fourth
// watcher drowned on the floor of the Deep, and under it a den of piled boulders. In the doorway, among
// shells and bones and a bottle, the watcher's carved eye: and behind the doorway, an eye looking
// back. Te Wheke Kōhatu. He photographs it (it has a temper: the colour clouds, the ghost display),
// takes the eye, and it comes after him. The chase: out along the floor of the Deep toward the light
// under the Serpent Coast, the octopus jetting in bursts, grabbing (kick free), inking. Breath is
// stamina: it runs down under water (slowly, with the wetsuit), and runs out into a blind scramble
// for the surface. Make it all the way without surfacing and arc:ch5:noSurface is set.
// The twist at the end of the chase: it does not want him. It wants something shiny. A trade.
//
// Flags: arc:ch5:grotto, arc:ch5:sump, arc:ch5:watcher, arc:ch5:photo, arc:ch5:take, arc:ch5:chased,
// arc:ch5:surfaced (the chase broke the surface), arc:ch5:noSurface, arc:ch5:eye, arc:ch5:done.

import type { QuestDef } from '../../quests';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Animal } from '../../wild/animal';
import { Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { gateOk } from '../gear';
import { stamina, STAMINA_ZL } from '../stamina';
import { cineTo, cineRelease, cineBars, cineShake, cineSlowmo } from '../../v11/cine';
import { floatSky, floatText } from '../../../ui/v12/float';
import { watcherStatue, denRock, DEN } from '../../../art/v12/arc/props4';
import { WHEKE_ID, spawnArc, arcHold, arcWait, arcGo, arcTask } from './species4';
import { F, setF, qs, say, line, talk, hints, addProp, sleep, live, onPhoto } from './common4';

const f5 = (k: string) => () => F(k);

export const ARC_CH5: QuestDef = {
  id: 'arc_ch5', title: 'The Drowned Eye', giver: 'story', main: true, chapter: 5,
  desc: 'The third watcher looks out to sea, at the headland over the Sea Grotto. Aroha says the old people sank a watcher on purpose, "to keep an eye on the deep". Hold your breath.',
  steps: [
    { text: 'Get a wetsuit for the long dive', done: () => gateOk('wetsuit') || F('arc:ch5:sump'), hint: 'Research and craft the wetsuit blueprint.' },
    { text: 'Swim through the Sea Grotto and dive the sump', done: f5('arc:ch5:sump'), hint: 'The sump at the far end of the grotto breathes with the tide. Fill your lungs first.' },
    { text: 'Find the drowned watcher on the floor of the Deep', done: f5('arc:ch5:watcher'), hint: 'Under the headland, not far from where the sump comes out.' },
    { text: 'Photograph whatever lives in the den under it', done: f5('arc:ch5:photo') },
    { text: 'Take the watcher\'s eye from the den\'s doorway', done: f5('arc:ch5:take'), hint: 'Catch your breath at the surface first. You will need all of it.' },
    { text: 'Get out to the light under the Serpent Coast', done: f5('arc:ch5:done'), hint: 'West along the floor of the Deep. Do not stop. Do not let it catch you.' },
  ],
  reward: { rp: 50, text: 'The fourth eye, out of the deep.' },
  next: 'arc_ch6',
};

const active5 = () => qs('arc_ch5') === 'active';
const WATCH_X = 1780, DEN_X = 1905;
const SURF = -44, TOP = -58;
/** the net breath cost a second under water during the chapter (a full tank lasts ~45 s with the wetsuit) */
const NET = 0.022;

interface Ch5 { w: Animal | null; chase: boolean; grabT: number; cool: number; burst: number; drown: boolean; busy: boolean; surfacedT: number; warned: boolean; caught: number; shells: { x: number; y: number }[] }

function installDeep(f: FieldScene) {
  const G = (x: number) => f.st.terrain.groundY(x);
  const s: Ch5 = { w: null, chase: false, grabT: 0, cool: 0, burst: 0, drown: false, busy: false, surfacedT: 0, warned: false, caught: 0, shells: [] };
  if (active5()) setF('arc:ch5:sump');
  if (active5() && !F('arc:ch5:title')) { setF('arc:ch5:title'); void floatSky('THE DROWNED EYE', 'Te Moana Hōhonu', 'TE ARA MATATŪ · V', 3000); }
  // the drowned watcher and the den under it
  addProp(f, 'arc5:watcher', () => watcherStatue(57, { drowned: true, facing: -1 }), WATCH_X, G(WATCH_X) + 4, -2.4);
  const den = denRock(83);
  addProp(f, 'arc5:den', () => den.back, DEN_X, G(DEN_X) + 3, -2.3);
  addProp(f, 'arc5:lip', () => den.lip, DEN_X, G(DEN_X) + 4, 30);
  const mouthX = DEN_X - DEN.w / 2 + DEN.w * DEN.mouthX, mouthY = G(DEN_X) + 3 - (DEN.h + 4) + (DEN.h + 4) * DEN.mouthY;
  // the doorway's collection: shells, a bone, a green bottle; and the carved eye (until taken)
  for (let i = 0; i < 7; i++) s.shells.push({ x: mouthX - 26 + i * 8 + rand.range(-2, 2), y: G(mouthX - 26 + i * 8) + 1 });
  f.main.add(new Custom(31, (rr, st) => {
    for (let i = 0; i < s.shells.length; i++) {
      const q = s.shells[i];
      const c = i === 3 ? packColor(0.25, 0.55, 0.3, 1) : i % 2 ? packColor(0.9, 0.84, 0.74, 1) : packColor(0.76, 0.6, 0.5, 1);
      rr.rect(Math.round(q.x), Math.round(q.y) - 2, i === 3 ? 2 : 3, i === 3 ? 4 : 2, c);
      rr.rect(Math.round(q.x), Math.round(q.y) - 2, 1, 1, packColor(1, 1, 0.95, 0.9));
    }
    if (!F('arc:ch5:take') && qs('arc_ch5') !== 'done') {
      const ex = Math.round(mouthX + 4), ey = Math.round(G(mouthX + 4) - 2), g = 0.6 + 0.4 * Math.sin(st.time * 3);
      rr.rect(ex - 1, ey - 1, 3, 3, packColor(0.15, 0.45, 0.48, 1));
      rr.rect(ex, ey - 1, 1, 1, packColor(0.7 * g + 0.3, 1, 0.95, 1));
    }
    // the trail of ink behind it in the chase (it fades)
  }));
  if (qs('arc_ch5') !== 'hidden') {
    s.w = spawnArc(f, WHEKE_ID, mouthX - 2, mouthY + 2, { facing: -1, act: 'den', anim: 'den' });
    (s.w as unknown as { z: number }).z = 29;
  }
  onPhoto(f, [WHEKE_ID], (sub, stars) => {
    if (!active5()) return;
    if (!F('arc:ch5:photo')) {
      setF('arc:ch5:photo');
      setTimeout(() => void say(sub.behavior === 'display' ? 'It went WHITE. On camera. Oh I am never sleeping again.' : stars >= 3 ? 'Got it. The eye, the horn, the arms. Te Wheke... it\'s HUGE.' : 'Got it. Sort of. It\'s HUGE.', 'happy', 2800), 500);
    }
  });
  const tickHints = hints(f, [
    ['c5watch', WATCH_X, 'A shape on the bottom. Carved. Weed streaming off it like hair. The drowned watcher.'],
    ['c5den', DEN_X - 40, 'Rocks piled up on purpose under it. A doorway. Something LIVES in there.'],
  ]);
  const I = f.interact as Interactable[];
  I.push({
    x: mouthX + 4, y: G(mouthX + 4) - 6, w: 14, h: 18, standX: mouthX - 18,
    label: 'Take the carved eye from the den\'s doorway',
    enabled: () => active5() && F('arc:ch5:watcher') && !F('arc:ch5:take') && !s.busy,
    quest: () => active5() && F('arc:ch5:photo') && !F('arc:ch5:take'),
    action: async () => {
      if (s.busy) return;
      s.busy = true;
      try { await takeEye(f, s, mouthX); } finally { s.busy = false; }
    },
  });

  // ---- per frame: breath, the den's temper, the chase
  f.main.add(new Custom(0, () => {}, dt => {
    if (!live(f) || !dt) return;
    tickHints();
    const p = f.player;
    const w = s.w;
    if (active5()) {
      if (!F('arc:ch5:watcher') && Math.abs(p.x - WATCH_X) < 90) {
        setF('arc:ch5:watcher');
        void talk(f, [
          { who: 'mori', text: '(bubbles) The fourth watcher. Lying on its side. Its eye is gone too.', expr: 'thinking' },
          { who: 'mori', text: '(bubbles) ...and something under it is looking at me.', expr: 'scared' },
        ]);
      }
      // breath: the swim drain is softened (the wetsuit, a held breath); the surface refills it
      if (p.y < TOP) p.y = TOP;
      if (p.y < SURF) {
        STAMINA_ZL.set(Math.min(STAMINA_ZL.max(), stamina() + 0.45 * dt));
        s.drown = false;
        if (s.chase && !F('arc:ch5:surfaced')) { setF('arc:ch5:surfaced'); void say('(gasp) AIR! ...okay. Okay. Back down.', 'say', 1800); }
      } else {
        STAMINA_ZL.set(Math.min(STAMINA_ZL.max(), stamina() + (0.07 - NET) * dt));
        if (stamina() < 0.25 && !s.warned) { s.warned = true; void say('(bubbles) Lungs... burning...', 'scared', 1800); }
        if (stamina() > 0.5) s.warned = false;
        if (stamina() <= 0.01 && !s.drown) {
          s.drown = true;
          void floatText({ text: 'AIR! AIR!', style: 'scared', ms: 1600 });
          f.st.shake(2, 0.4);
        }
      }
      // out of breath: a blind kick for the surface (the world goes dark at the edges)
      if (s.drown) { p.vy = -70; p.y -= 70 * dt; }
    }
    if (!w || w.gone) return;
    // at its den: it watches; come close and its colour clouds; crowd it and it goes ghost-white
    if (!s.chase && w.act !== 'cine') {
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (!F('arc:ch5:take')) {
        if (d < 46 && w.act !== 'display') { arcHold(w, 'display', 'display'); f.sfx('hiss', w.x, 0.3, 1.6); }
        else if (d >= 46 && d < 120 && w.act !== 'flash') arcHold(w, 'flash', 'flash');
        else if (d >= 140 && w.act !== 'den') arcHold(w, 'den', 'den');
        w.facing = p.x < w.x ? -1 : 1;
      }
    }
    if (!s.chase) return;
    // the chase
    s.cool -= dt;
    if (s.grabT > 0) return;
    const d = Math.hypot(p.x - w.x, p.y - w.y);
    if (d < 24 && s.cool <= 0) { void grabbed(f, s); return; }
    if (p.x < 150) { void chaseEnd(f, s); return; }
  }));
  return s;
}

/** the chase brain: bursts of jetting at Mori, coasting between, an ink cloud now and then */
async function chaseLoop(f: FieldScene, s: Ch5) {
  const w = s.w!;
  while (s.chase && live(f) && !w.gone) {
    if (s.grabT > 0) { await sleep(100); continue; }
    const p = f.player;
    const tx = p.x + (p.x < w.x ? 8 : -8), ty = clamp(p.y - 6, SURF + 6, f.st.terrain.groundY(p.x) - 8);
    // a burst: mantle first, straight at him
    const dir = tx < w.x ? -1 : 1;
    let t = 0;
    await arcTask(w, 'jet', 'jet', (a, dt) => {
      t += dt;
      const dx = f.player.x - a.x, dy = clamp(f.player.y - 6, SURF + 6, 400) - a.y, dd = Math.hypot(dx, dy) || 1;
      const sp = 74 - t * 18;
      a.x += dx / dd * sp * dt; a.y += dy / dd * sp * dt;
      a.facing = dx < 0 ? -1 : 1;
      if (rand.chance(dt * 8)) f.main.particles.spawn({ frame: A.dot2, x: a.x - a.facing * 20, y: a.y, vx: -a.facing * 20, vy: rand.range(-8, 8), life: 0.6, color: [0.8, 0.9, 1], alpha: 0.5, alpha1: 0, size: 0.6, size1: 1 });
      return t > 1.3 || !s.chase || s.grabT > 0;
    });
    void dir;
    if (!s.chase || s.grabT > 0) continue;
    // coast, arms trailing, reading where he went
    await arcGo(w, 'jet', 'swim', w.x + (f.player.x < w.x ? -24 : 24), w.y, 30);
    if (rand.chance(0.22)) { await arcWait(w, 'ink', 'ink', 0.55); f.sfx('splash', w.x, 0.2, 0.5); }
  }
}

async function takeEye(f: FieldScene, s: Ch5, mouthX: number) {
  const p = f.player, w = s.w;
  f.cutscene = true;
  try {
    await p.doWork('grab', 0.8, () => {});
    setF('arc:ch5:take');
    audio.play('collectPop' as never, { vol: 0.6 });
    void say('(bubbles) Got it. Sorry. Sorry! I need it more than you do. Probably.', 'say', 2000);
    await sleep(700);
    if (!w) return;
    cineBars(true);
    await cineTo(f.st, { x: mouthX, y: w.y - 10, zoom: 1.8, secs: 0.5, ease: 'punch' });
    await arcWait(w, 'display', 'display', 1.1);
    cineShake(4, 0.6);
    audio.setDanger(0.9);
    audio.setMusic('tension');
    void floatText({ text: 'IT\'S COMING OUT', style: 'shout', ms: 1200 });
    cineSlowmo(0.35, 0.1);
    await arcWait(w, 'ink', 'ink', 0.6);
    cineSlowmo(1, 0.3);
    await cineRelease(f.st, 0.5);
    cineBars(false);
    void line(f, 'mori', '(bubbles) SWIM. SWIM SWIM SWIM.', 'shout', 1600);
    s.chase = true;
    s.cool = 1.5;
    void chaseLoop(f, s);
  } finally { f.cutscene = false; }
}

async function grabbed(f: FieldScene, s: Ch5) {
  const p = f.player, w = s.w!;
  s.grabT = 1;
  s.caught++;
  arcHold(w, 'grab', 'grab');
  w.facing = p.x < w.x ? -1 : 1;
  cineShake(5, 0.5);
  audio.play('splash', { vol: 0.6, pitch: 0.6 });
  STAMINA_ZL.set(Math.max(0, stamina() - 0.12));
  void floatText({ text: s.caught === 1 ? 'IT\'S GOT MY LEG!' : 'NOT AGAIN!', style: 'scared', ms: 1400 });
  const hold = { x: p.x, y: p.y };
  const pin = new Custom(0, () => {}, () => { if (s.grabT > 0) { p.x = hold.x; p.y = hold.y; p.vx = p.vy = 0; } });
  f.main.add(pin);
  try {
    const Q = await import('../qte');
    const r = await Q.qte({ kind: 'mash', label: 'KICK FREE!', difficulty: 0.35 + s.caught * 0.05, count: 8, time: 3.2, f });
    if (!r.ok) { STAMINA_ZL.set(Math.max(0, stamina() - 0.12)); void say('(bubbles) Let GO! ...it let go. It\'s PLAYING with me.', 'scared', 1800); }
  } finally {
    f.main.remove(pin);
    s.grabT = 0;
    s.cool = 2.2;
    // it lets go, inks, and drops back to come again
    void arcWait(w, 'ink', 'ink', 0.55).then(() => arcGo(w, 'jet', 'swim', w.x + (w.x < p.x ? -30 : 30), w.y, 40));
    p.vx = (p.x < w.x ? -1 : 1) * 80;
  }
}

async function chaseEnd(f: FieldScene, s: Ch5) {
  if (!s.chase) return;
  s.chase = false;
  const p = f.player, w = s.w!;
  f.cutscene = true;
  setF('arc:ch5:chased');
  if (!F('arc:ch5:surfaced')) setF('arc:ch5:noSurface');
  try {
    cineBars(true);
    audio.setDanger(0.2);
    await arcGo(w, 'jet', 'swim', p.x + 34, p.y - 4, 50, { face: -1 });
    await cineTo(f.st, { x: p.x + 16, y: p.y - 14, zoom: 2, secs: 0.6, ease: 'smooth' });
    await arcWait(w, 'flash', 'flash', 1.2);
    await talk(f, [{ who: 'mori', text: '(bubbles) Okay. Okay. You win. Just... don\'t eat me.', expr: 'scared' }]);
    await arcWait(w, 'grab', 'grab', 0.8);
    audio.play('collectPop' as never, { vol: 0.5, pitch: 1.4 });
    await talk(f, [
      { who: 'mori', text: '(it plucks the brass lens cap clean off his camera, turns it over in its arm, and goes a pleased brick red)', expr: 'surprised' },
      { who: 'mori', text: '(bubbles) ...a TRADE? You chased me all this way for a TRADE?', expr: 'laugh' },
    ]);
    await arcGo(w, 'jet', 'jet', p.x + 220, p.y + 20, 70);
    w.gone = true;
    await cineRelease(f.st, 0.6);
    cineBars(false);
    audio.setDanger(0);
    void say(F('arc:ch5:noSurface') ? '(bubbles) Didn\'t breathe once. Not ONCE. Up. Light. Now.' : '(bubbles) Up. Light. Now.', 'happy', 2400);
  } finally { f.cutscene = false; }
}

function installGrotto(f: FieldScene) {
  if (!active5()) return;
  setF('arc:ch5:grotto');
  const t = hints(f, [
    ['c5grotto', 300, 'The grotto. Somewhere at the far end, the sump. And past it... the deep.'],
    ['c5sump', 2200, 'The water sucks in and out of that hole like breathing. Big breath. Biggest breath of my LIFE.'],
  ]);
  f.main.add(new Custom(0, () => {}, () => { if (live(f)) t(); }));
  if (!gateOk('wetsuit')) setTimeout(() => void say('That sump is long and the water\'s ice. I need a wetsuit before I try it.', 'think', 3000), 1500);
}

function installCoast(f: FieldScene) {
  if (!active5() || !F('arc:ch5:take') || F('arc:ch5:done')) return;
  if (!F('arc:ch5:chased')) setF('arc:ch5:chased');
  setTimeout(async () => {
    if (!live(f)) return;
    await talk(f, [
      { who: 'mori', text: '(gasping on the sand) Air. AIR. Sky. Sand. I love sand. I am going to marry this beach.', expr: 'happy' },
      { who: 'mori', text: '(the carved eye in his fist, wet, pāua-green, still cold from the deep) Four.', expr: 'thinking' },
    ]);
    setF('arc:ch5:eye');
    setF('arc:ch5:done');
    void floatSky('THE FOURTH EYE', F('arc:ch5:noSurface') ? 'Out of the deep on one breath' : 'Out of the deep', 'TE ARA MATATŪ · V', 3200);
  }, 1600);
}

export function enterCh5(f: FieldScene, loc: string | null) {
  try {
    if (loc === 'grotto') installGrotto(f);
    else if (loc === 'deep' && qs('arc_ch5') !== 'hidden') installDeep(f);
    else if (loc === 'coast' && !f.site.underwater) installCoast(f);
  } catch (e) { console.warn('[arc5] install', e); }
}
void cineSlowmo;
