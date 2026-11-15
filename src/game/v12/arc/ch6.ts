// V12 Te Ara Matatū, chapter 6: Ngā Kaipāhua, the plunderers (out to Motu Ahi by boat).
//
// The fourth eye was looking north-east, over the sea, at the smoking islet. Joshu takes the Kitten
// out, and the sky turns on them half way: a squall line, rain sideways, lightning, and a rogue wave
// over the bow (hold on). On Motu Ahi the fifth watcher stands below the colony cliff, and its eye is
// gone: not blown out, not drowned. Stolen. There are drag marks to the vent cracks and an egg shell
// beside them. At dusk the robber crabs come up out of the cracks in waves for the colony's eggs, and
// Mori keeps watch over the nests until the last of them, the big old one carrying something green
// that glints, runs for it and drops what it carries.
//
// The defence is a phase machine like the night of the claw (src/game/v12/raid/fight.ts):
//   intro -> wave 1 (2) -> lull -> wave 2 (3) -> lull -> wave 3 (4, the eye-carrier last) -> won | lost
// Each crab sneaks to a nest, grabs an egg and carries it back to the cracks. It tells first: walk up
// on it and it rears with its claws up (the threat) and will pinch. Deter it, sending it running and
// dropping its egg, by rushing it (running at it), by the noise of a sprint close by, or by the camera's
// flash; or by any weapon on the belt. Win without firing a thing: arc:ch6:unarmed.
//
// Flags: arc:ch6:sail, arc:ch6:storm, arc:ch6:watcher, arc:ch6:defended, arc:ch6:unarmed,
// arc:ch6:armed (a weapon was used in the defence), arc:ch6:eye, arc:ch6:done.

import type { QuestDef } from '../../quests';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Animal } from '../../wild/animal';
import { Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { cineTo, cineRelease, cineBars, cineShake, cineSlowmo } from '../../v11/cine';
import { addShootTarget, onPredator } from '../../v11/predators-core';
import { WEAPON_IDS, ammo } from '../arsenal';
import type { WeaponId } from '../arsenal';
import { hitMori } from '../wilds';
import { floatSky, floatText } from '../../../ui/v12/float';
import { watcherStatue, seabirdNest } from '../../../art/v12/arc/props4';
import { groundIsle } from '../../../art/v10/isle10';
import { THIEF_ID, spawnArc, arcHold, arcWait, arcGo } from './species4';
import { F, setF, qs, say, line, talk, hints, addProp, sleep, live, onAnyShot } from './common4';

const f6 = (k: string) => () => F(k);

export const ARC_CH6: QuestDef = {
  id: 'arc_ch6', title: 'The Plunderers', giver: 'story', main: true, chapter: 6,
  desc: 'The fourth eye looked north-east, over the water, at Motu Ahi. The fifth watcher is out there with the birds. Joshu says the weather looks "fine. Probably."',
  steps: [
    { text: 'Take the Kitten out to Motu Ahi', done: f6('arc:ch6:sail'), hint: 'At the boatyard: take the Kitten out, and pick Motu Ahi.' },
    { text: 'Ride out the storm', done: f6('arc:ch6:storm'), hint: 'Hold on when the big one comes over the bow.' },
    { text: 'Find the watcher below the colony cliff', done: f6('arc:ch6:watcher') },
    { text: 'Guard the nests from the egg thieves at dusk', done: f6('arc:ch6:defended'), hint: 'Rush them, make noise, or flash them with the camera. They tell before they pinch: claws up.' },
    { text: 'Take back the watcher\'s eye', done: f6('arc:ch6:done') },
  ],
  reward: { rp: 50, text: 'The fifth eye, taken back from the plunderers.' },
  next: 'arc_ch7',
};

const active6 = () => qs('arc_ch6') === 'active';

// ================================================================== the storm crossing (the boat trip scene)
interface BoatLike { plan: { id: string }; dist: number; len: number; phase: string; weather: { storm: number; wind: number }; ocean?: { spray(x: number, y: number, a: number, vx?: number, vy?: number): void }; joshu?: unknown; aroha?: unknown }
function installStorm(f: FieldScene) {
  const b = f as unknown as BoatLike;
  if (!active6() || b.plan?.id !== 'motuahi') return;
  setF('arc:ch6:sail');
  if (F('arc:ch6:storm')) return;
  let k = 0, stage = 0, boltT = 3, wave = false;
  const drops: { x: number; y: number; v: number }[] = [];
  const rr0 = new Custom(70, (rr, st) => {
    if (k <= 0.01) return;
    // rain driven sideways across the whole view (hard pixel streaks, three tones)
    const cx = st.cam.x, cy = st.cam.y, hw = game.r.VW / 2 / st.cam.zoom + 20, hh = game.r.VH / 2 / st.cam.zoom + 20;
    while (drops.length < 160) drops.push({ x: rand.range(-hw, hw), y: rand.range(-hh, hh), v: rand.range(0.7, 1.2) });
    for (let i = 0; i < drops.length * k; i++) {
      const d = drops[i], x = Math.round(cx + d.x), y = Math.round(cy + d.y);
      const c = i % 3 === 0 ? packColor(0.85, 0.9, 0.95, 0.55) : packColor(0.6, 0.7, 0.8, 0.4);
      rr.rect(x, y, 1, 1, c); rr.rect(x - 1, y - 2, 1, 2, c); if (d.v > 1) rr.rect(x - 2, y - 4, 1, 2, c);
    }
  }, dt => {
    if (!live(f)) return;
    const fr = b.len ? b.dist / b.len : 0;
    const p = f.player;
    const want = fr < 0.12 ? 0 : fr < 0.75 ? 1 : 0.15;
    k += clamp(want - k, -dt * 0.15, dt * 0.2);
    b.weather.storm = Math.max(0.1, k);
    b.weather.wind = -1 - k;
    audio.setStorm(k * 0.85);
    const hw = game.r.VW / 2, hh = game.r.VH / 2;
    for (const d of drops) { d.x -= 90 * d.v * dt; d.y += 260 * d.v * dt; if (d.y > hh + 20) { d.y -= hh * 2 + 40; } if (d.x < -hw - 20) d.x += hw * 2 + 40; }
    if (k > 0.5) {
      boltT -= dt;
      if (boltT <= 0) { boltT = rand.range(2.5, 6); game.r.post.flash = Math.max(game.r.post.flash, 0.35 + rand.next() * 0.3); setTimeout(() => audio.play(rand.chance(0.5) ? 'thunderClose' : 'thunder', { vol: 0.7 }), rand.range(100, 700)); }
    }
    if (stage === 0 && fr > 0.14) {
      stage = 1;
      void talk(f, [
        { who: 'joshu', text: 'That sky wasn\'t on the forecast.', expr: 'serious' },
        { who: 'aroha', text: 'Joshu. JOSHU. That\'s a squall line.', expr: 'worried' },
        { who: 'joshu', text: 'Everyone hold onto something that\'s bolted down. Chunk, that means you.', expr: 'serious' },
      ]);
      audio.setMusic('storm');
    }
    if (stage === 1 && fr > 0.5 && !wave && !f.cutscene) { wave = true; stage = 2; void rogueWave(f, b); }
    if (stage === 2 && fr > 0.78) {
      stage = 3;
      setF('arc:ch6:storm');
      audio.setStorm(0);
      void talk(f, [
        { who: 'mori', text: 'Is it... is it over? Am I alive? Is Chunk alive?', expr: 'worried' },
        { who: 'joshu', text: 'All alive. One of us is wetter than he\'s ever been.', expr: 'happy' },
        { who: 'aroha', text: 'Look. Motu Ahi. Smoking like Koro after a hāngī.', expr: 'happy' },
      ]);
      void floatSky('THE PLUNDERERS', 'Motu Ahi', 'TE ARA MATATŪ · VI', 3000);
    }
    void p;
  });
  f.main.add(rr0);
}

async function rogueWave(f: FieldScene, b: BoatLike) {
  const p = f.player;
  f.cutscene = true;
  try {
    void line(f, 'joshu', 'BIG ONE! OFF THE BOW! HOLD ON!', 'shout', 1800);
    cineBars(true);
    await cineTo(f.st, { x: p.x + 60, y: p.y - 40, zoom: 1.35, secs: 0.7, ease: 'out' });
    audio.play('waveCrash', { vol: 0.9, pitch: 0.7 });
    cineSlowmo(0.3, 0.2);
    cineShake(6, 1.2);
    for (let i = 0; i < 6; i++) b.ocean?.spray(p.x + 40 + i * 12, p.y - 10, 0.9, -40, -3);
    const Q = await import('../qte');
    cineSlowmo(1, 0.2);
    const r = await Q.qte({ kind: 'hold', label: 'HOLD ON!', difficulty: 0.5, f, pose: 'brace' });
    game.r.post.flash = Math.max(game.r.post.flash, 0.5);
    audio.play('splashBig', { vol: 0.9 });
    cineShake(8, 0.8);
    await cineRelease(f.st, 0.6);
    cineBars(false);
    if (!r.ok) {
      f.cutscene = false;
      hitMori(f, p.x + 50, { sev: 2, what: 'the wave' });
      await sleep(1600);
      void line(f, 'aroha', 'MORI! ...he\'s okay. He\'s okay! He\'s just very, very flat.', 'shout', 2400);
    } else {
      void say('Ha! HA! Holding! I\'m holding! ...I can\'t feel my fingers.', 'shout', 2400);
    }
  } finally { f.cutscene = false; cineSlowmo(1); }
}

// ================================================================== Motu Ahi: the watcher and the defence
const WATCH_X = 1420;
const NESTS = [905, 968, 1032, 1104, 1180, 1258];
const CRACKS = [1520, 1590, 1655];
const LOSE_AT = 5;

interface Thief { a: Animal; nest: number; state: 'sneak' | 'threat' | 'grab' | 'carry' | 'flee' | 'gone'; t: number; egg: boolean; eye: boolean; off: () => void }
interface Ch6 {
  phase: 'idle' | 'intro' | 'wave' | 'lull' | 'won' | 'lost';
  wave: number; eggs: number[]; lost: number; thieves: Thief[]; armed: boolean; snap: Record<string, number>;
  eye: { x: number; y: number } | null; busy: boolean; pinchT: number;
}

function installIsle(f: FieldScene) {
  const st = qs('arc_ch6');
  if (st === 'hidden') return;
  const s: Ch6 = { phase: 'idle', wave: 0, eggs: NESTS.map(() => 2), lost: 0, thieves: [], armed: false, snap: {}, eye: null, busy: false, pinchT: 0 };
  // the watcher, its socket empty; drag marks to the cracks
  addProp(f, 'arc6:watcher', () => watcherStatue(61, {}), WATCH_X, groundIsle(WATCH_X) + 3, -2.4);
  const nests = NESTS.map((x, i) => [0, 1, 2].map(n => addProp(f, `arc6:nest:${i}:${n}`, () => seabirdNest(13 + i, n), x, groundIsle(x) + 2, -1.3)));
  const showNests = () => nests.forEach((ns, i) => ns.forEach((pr, n) => { if (pr) pr.hidden = n !== clamp(s.eggs[i], 0, 2); }));
  showNests();
  f.main.add(new Custom(-1.4, rr => {
    // the drag marks in the ash from the watcher's foot to the cracks, and the dropped eye
    for (let x = WATCH_X + 10; x < CRACKS[0]; x += 3) rr.rect(x, Math.round(groundIsle(x)) + 1, 2, 1, packColor(0.18, 0.16, 0.16, 0.7));
    if (s.eye) {
      const g = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      rr.rect(Math.round(s.eye.x) - 1, Math.round(s.eye.y) - 2, 3, 3, packColor(0.15, 0.45, 0.48, 1));
      rr.rect(Math.round(s.eye.x), Math.round(s.eye.y) - 2, 1, 1, packColor(0.7 * g + 0.3, 1, 0.95, 1));
    }
  }));
  if (active6()) {
    // landing after the storm (or arriving by a later boat)
    setF('arc:ch6:sail'); setF('arc:ch6:storm');
  }
  const tickHints = hints(f, [
    ['c6watch', WATCH_X, 'A watcher. Out here, below all those birds. And something\'s dragged at its foot.'],
    ['c6cracks', CRACKS[1], 'The cracks are warm. Something\'s been dragging things down there. Eggshell.'],
  ]);
  const I = f.interact as Interactable[];
  I.push({
    x: WATCH_X + 6, y: groundIsle(WATCH_X) - 30, w: 22, h: 30, standX: WATCH_X - 30,
    label: 'Look at the watcher',
    enabled: () => active6() && !F('arc:ch6:watcher') && !s.busy,
    quest: () => active6() && !F('arc:ch6:watcher'),
    action: async () => {
      s.busy = true;
      try {
        await talk(f, [
          { who: 'mori', text: 'The fifth watcher. The eye\'s gone. But not blown out, not drowned: the socket\'s been scratched. Like... pincers.', expr: 'thinking' },
          { who: 'mori', text: 'Drag marks. All the way to those cracks. And eggshell. Lots of eggshell.', expr: 'worried' },
          ...(f.guide ? [{ who: 'aroha', text: 'Kaipāhua. Nan told me. The plunderer crabs. They come up at dusk for the eggs, and they take anything that shines.', expr: 'serious' }] : []),
          ...(f.guide ? [{ who: 'aroha', text: 'If you want that eye, you\'ll have to wait for them. And mind the birds\' eggs while you\'re at it.', expr: 'serious' }] : []),
        ]);
        setF('arc:ch6:watcher');
      } finally { s.busy = false; }
    },
  });
  I.push({
    x: NESTS[3], y: groundIsle(NESTS[3]) - 12, w: 30, h: 18, standX: NESTS[3] + 34,
    get label() { return s.phase === 'lost' ? 'Keep watch over the nests again' : 'Keep watch over the nests at dusk'; },
    enabled: () => active6() && F('arc:ch6:watcher') && !F('arc:ch6:defended') && (s.phase === 'idle' || s.phase === 'lost') && !s.busy,
    quest: () => active6() && F('arc:ch6:watcher') && !F('arc:ch6:defended') && (s.phase === 'idle' || s.phase === 'lost'),
    action: () => { void runDefence(f, s, showNests); },
  });
  I.push({
    get x() { return s.eye?.x ?? -9999; }, get y() { return s.eye?.y ?? 0; }, w: 12, h: 12,
    label: 'Pick up the watcher\'s eye',
    enabled: () => !!s.eye && !s.busy,
    quest: () => !!s.eye,
    action: async () => {
      s.busy = true;
      try {
        await f.player.doWork('kneel', 0.7, () => {});
        s.eye = null;
        audio.play('collectPop' as never, { vol: 0.6 });
        setF('arc:ch6:eye');
        await talk(f, [
          { who: 'mori', text: 'Five. The fifth eye. Scratched, a bit nibbled, but... five.', expr: 'happy' },
          ...(f.guide ? [{ who: 'aroha', text: 'And not one egg cracked by your hand. Nan would like you.', expr: 'happy' }] : []),
          { who: 'mori', text: '(he holds it up to the watcher\'s socket; through it, far off over the sea, the island\'s middle, where the steam rises out of the ground)', expr: 'thinking' },
          { who: 'mori', text: 'They\'re all looking at the same place. All five. Te Korokoro. The throat.', expr: 'serious' },
        ]);
        setF('arc:ch6:done');
        void floatSky('THE FIFTH EYE', 'All five watchers look to the throat', 'TE ARA MATATŪ · VI', 3200);
      } finally { s.busy = false; }
    },
  });
  // the flash: a photo with a crab in it sends it running
  onAnyShot(f, ph => {
    if (s.phase !== 'wave' && s.phase !== 'won') return;
    const inFrame = ph.subjects.some(x => x.species === THIEF_ID && x.inFrame > 0.25);
    for (const t of s.thieves) if (t.state !== 'gone' && t.state !== 'flee' && Math.abs(t.a.x - f.player.x) < 190 && (inFrame || Math.abs(t.a.x - f.player.x) < 70)) scare(f, s, t, 'flash');
  });
  const offPred = onPredator((ev, info) => { if (ev === 'fired' && info.who !== 'aroha' && (s.phase === 'wave' || s.phase === 'lull')) s.armed = true; });
  f.main.add(new Custom(0, () => {}, dt => {
    if (!live(f)) { offPred(); return; }
    tickHints();
    if (s.phase === 'idle' || s.phase === 'lost') return;
    // any ammo spent during the defence counts as armed (the sling included)
    if (s.phase !== 'won') for (const id of WEAPON_IDS) if (ammo(id as WeaponId) < (s.snap[id] ?? 0)) s.armed = true;
    for (const id of WEAPON_IDS) s.snap[id] = ammo(id as WeaponId);
    s.pinchT -= dt;
    for (const t of s.thieves) tickThief(f, s, t, dt, showNests);
  }));
}

function scare(f: FieldScene, s: Ch6, t: Thief, why: 'rush' | 'noise' | 'flash' | 'weapon') {
  if (t.state === 'flee' || t.state === 'gone') return;
  if (why === 'weapon') s.armed = true;
  const dropEgg = t.egg;
  t.egg = false;
  if (dropEgg) {
    // the egg drops into the down and rolls home: the parents will see to it
    s.eggs[t.nest] = Math.min(2, s.eggs[t.nest] + 1);
  }
  if (t.eye) { t.eye = false; s.eye = { x: t.a.x, y: groundIsle(t.a.x) }; void say('It dropped something! Green... shining... THE EYE!', 'shout', 2200); }
  t.state = 'flee';
  t.a.showEmote('exclaim', 0.8, true);
  f.sfx('callClick', t.a.x, 0.4, 1.4);
  void arcWait(t.a, 'flinch', 'flinch', 0.3).then(() => arcGo(t.a, 'flee', 'flee', CRACKS[t.nest % CRACKS.length] + 30, null, 92)).then(() => { t.state = 'gone'; t.a.gone = true; t.off(); });
  if (why === 'flash' && !F('arc:ch6:flashTip')) { setF('arc:ch6:flashTip'); void say('The flash! They HATE the flash!', 'happy', 1800); }
}

function tickThief(f: FieldScene, s: Ch6, t: Thief, dt: number, showNests: () => void) {
  if (t.state === 'gone' || t.state === 'flee') return;
  const p = f.player, a = t.a, d = Math.abs(p.x - a.x);
  const pr = p as unknown as { running?: boolean };
  // noise: a sprint close by; a rush: running straight at it
  if (pr.running && d < 56) { scare(f, s, t, 'rush'); return; }
  if (t.state === 'threat') {
    t.t -= dt;
    if (d < 16 && s.pinchT <= 0 && t.t < 0.7) { s.pinchT = 2.5; hitMori(f, a.x, { sev: 1, what: 'the crab' }); void say('OW! It PINCHED me! ...rude.', 'scared', 1600); }
    if (d < 13) { scare(f, s, t, 'rush'); return; }
    if (t.t <= 0) { t.state = t.egg ? 'carry' : 'sneak'; goOn(f, s, t, showNests); }
    return;
  }
  // walking up on it: it tells (claws up), and pinches if you keep coming
  if (d < 34 && (t.state === 'sneak' || t.state === 'carry')) {
    t.state = 'threat'; t.t = 1.4;
    a.facing = p.x < a.x ? -1 : 1;
    arcHold(a, 'threat', 'threat');
    f.sfx('callClick', a.x, 0.35, 0.9);
  }
}

/** a crab's run: out of the crack, to its nest, the egg, back */
function goOn(f: FieldScene, s: Ch6, t: Thief, showNests: () => void) {
  const nx = NESTS[t.nest];
  if (t.state === 'sneak') {
    void arcGo(t.a, 'sneak', 'sneak', nx + 8, null, 24).then(async () => {
      if (t.state !== 'sneak') return;
      t.state = 'grab';
      t.a.facing = -1;
      await arcWait(t.a, 'grab', 'grab', 1.1);
      if (t.state !== 'grab') return;
      if (s.eggs[t.nest] > 0) { s.eggs[t.nest]--; t.egg = true; showNests(); f.sfx('callClick', nx, 0.3, 1.8); }
      t.state = 'carry';
      goOn(f, s, t, showNests);
    });
  } else if (t.state === 'carry') {
    const cx = CRACKS[t.nest % CRACKS.length];
    void arcGo(t.a, 'carry', t.egg ? 'carry' : 'walk', cx, null, 30).then(() => {
      if (t.state !== 'carry') return;
      if (t.egg) { s.lost++; void floatText({ text: `An egg gone (${s.lost}/${LOSE_AT})`, style: 'sad', ms: 1600 }); }
      if (t.eye) {
        t.eye = false;
        void say('No no no, the eye went down the crack with it!', 'scared', 2000);
        // it comes back up for another look while the eye is still down there
        setTimeout(() => { if (live(f) && !s.eye && !F('arc:ch6:eye') && (s.phase === 'won' || s.phase === 'wave')) spawnThief(f, s, 1, true, showNests); }, 5000);
      }
      t.state = 'gone'; t.a.gone = true; t.off();
    });
  }
}

function spawnThief(f: FieldScene, s: Ch6, i: number, eye: boolean, showNests: () => void) {
  const cx = CRACKS[i % CRACKS.length] + rand.range(-6, 6);
  const nest = (s.wave * 2 + i * 3 + rand.int(0, 2)) % NESTS.length;
  const a = spawnArc(f, THIEF_ID, cx, groundIsle(cx), { facing: -1, act: 'hide', anim: 'hide' });
  (a as unknown as { z: number }).z = 34;
  const t: Thief = { a, nest, state: 'sneak', t: 0, egg: false, eye, off: () => {} };
  t.off = addShootTarget({ get x() { return a.x; }, get y() { return a.y - 8; }, r: 10, hit: () => scare(f, s, t, s.phase === 'won' ? 'rush' : 'weapon'), alive: () => t.state !== 'gone' && !a.gone } as never);
  s.thieves.push(t);
  void arcWait(a, 'hide', 'hide', 0.6 + i * 0.2).then(() => goOn(f, s, t, showNests));
  return t;
}

async function runDefence(f: FieldScene, s: Ch6, showNests: () => void) {
  if (s.phase !== 'idle' && s.phase !== 'lost') return;
  s.phase = 'intro';
  s.wave = 0; s.lost = 0; s.armed = false; s.eggs = NESTS.map(() => 2); showNests();
  for (const id of WEAPON_IDS) s.snap[id] = ammo(id as WeaponId);
  for (const t of s.thieves) { t.a.gone = true; t.off(); }
  s.thieves = [];
  f.cutscene = true;
  try {
    cineBars(true);
    await cineTo(f.st, { x: CRACKS[1] - 40, y: groundIsle(CRACKS[1]) - 30, zoom: 1.5, secs: 1, ease: 'smooth' });
    await talk(f, [
      { who: 'mori', text: '(the light goes orange; the colony gets louder and louder; and the cracks... click)', expr: 'worried' },
      { who: 'mori', text: 'Something\'s coming up. Lots of somethings.', expr: 'scared' },
    ]);
    await cineRelease(f.st, 0.8);
    cineBars(false);
    if (!F('arc:ch6:defTip')) { setF('arc:ch6:defTip'); void line(f, 'aroha', 'Rush them! Make noise! Flash them with the camera! They put their claws up first: that means you\'re close enough to get pinched.', 'shout', 4200); }
  } finally { f.cutscene = false; }
  audio.setDanger(0.5);
  audio.setMusic('tension');
  const waves = [2, 3, 4];
  for (let w = 0; w < waves.length; w++) {
    if (!live(f)) return;
    s.wave = w;
    s.phase = 'wave';
    void floatText({ text: `WAVE ${w + 1}`, style: 'shout', ms: 1400 });
    for (let i = 0; i < waves[w]; i++) {
      spawnThief(f, s, i, w === waves.length - 1 && i === waves[w] - 1 && !F('arc:ch6:eye'), showNests);
      await sleep(w === 2 ? 900 : 1500);
    }
    // the wave plays out
    while (live(f) && s.thieves.some(t => t.state !== 'gone' && t.state !== 'flee')) {
      if (s.lost >= LOSE_AT) break;
      await sleep(200);
    }
    if (s.lost >= LOSE_AT) break;
    if (w < waves.length - 1) {
      s.phase = 'lull';
      void say(rand.pick(['Is that all of them? ...it is NOT all of them.', 'Breathe. Count the eggs. Here they come again.']), 'think', 2200);
      await sleep(3200);
    }
  }
  audio.setDanger(0);
  if (s.lost >= LOSE_AT) {
    s.phase = 'lost';
    for (const t of s.thieves) if (t.state !== 'gone') { t.state = 'flee'; void arcGo(t.a, 'flee', 'flee', CRACKS[0] + 40, null, 80).then(() => { t.a.gone = true; t.off(); }); }
    await talk(f, [
      { who: 'mori', text: 'They got too many. The birds are going frantic...', expr: 'sad' },
      ...(f.guide ? [{ who: 'aroha', text: 'They\'ll settle. The crabs will be back up when the light changes again. Catch your breath and we watch again.', expr: 'serious' }] : []),
    ]);
    return;
  }
  s.phase = 'won';
  setF('arc:ch6:defended');
  if (!s.armed) setF('arc:ch6:unarmed'); else setF('arc:ch6:armed');
  cineSlowmo(1);
  await talk(f, [
    { who: 'mori', text: s.armed ? 'That\'s the last of them. The nests are safe.' : 'That\'s the last of them. And I didn\'t throw one stone. Not ONE.', expr: 'happy' },
    ...(f.guide ? [{ who: 'aroha', text: s.armed ? 'Not bad, kaitiaki. Not bad at all.' : 'With your bare hands and a camera. You\'re a strange man, Mori.', expr: 'laugh' }] : []),
  ]);
  if (!s.eye && !F('arc:ch6:eye')) {
    // the eye-carrier made it down: it comes back up for one more look
    const t = spawnThief(f, s, 1, true, showNests);
    void say('There! The big one! It\'s got the eye in its claw!', 'shout', 2000);
    void t;
  }
}

/** the chapter's scene content */
export function enterCh6(f: FieldScene, loc: string | null) {
  try {
    const any = f as unknown as { plan?: { id: string }; cfg?: { loc?: string } };
    if (any.plan && any.plan.id === 'motuahi') installStorm(f);
    else if (loc === 'motuahi' || any.cfg?.loc === 'motuahi') installIsle(f);
  } catch (e) { console.warn('[arc6] install', e); }
}
void cineShake;
