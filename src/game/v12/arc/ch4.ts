// V12 Te Ara Matatū, chapter 4: Te Whenua Manawa, the ground breathes (Te Riu Wera, the Hot Valley).
//
// The third watcher stands at the edge of the geyser field above the old stair, its eye socket empty
// and scorched. The eye was blown out of it into the throat of Te Puia Nui, the great geyser at the
// field's far end. Mori crosses the field on its rhythm (each geyser tells before it blows: it
// gurgles, puffs steam, the water rises boiling in its throat and the ground trembles; then a column
// of scalding water), reaches into the great geyser's throat, and the valley answers: the great
// eruption throws the stone into the sky. He catches it up (a hold: it is HOT), and the whole field
// wakes behind him as he runs back across it. Set into the watcher, the eye looks out to sea.
//
// Flags: arc:ch4:arrive, arc:ch4:watcher, arc:ch4:crossed, arc:ch4:stone, arc:ch4:escaped,
// arc:ch4:eye, arc:ch4:done. Scene: loc 'geovalley' (src/game/sites10/geovalley.ts).

import type { QuestDef } from '../../quests';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { TripRun } from '../../v10/field10';
import { Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { A } from '../../assets';
import { geoGround } from '../../sites10/geovalley';
import { cineTo, cineRelease, cineBars, cineSlowmo, cineShake, cineLook } from '../../v11/cine';
import { hitMori } from '../wilds';
import { floatSky, floatText } from '../../../ui/v12/float';
import { watcherStatue, sinterCone } from '../../../art/v12/arc/props4';
import { F, setF, qs, say, line, talk, hints, addProp, sleep, live } from './common4';

const f4 = (k: string) => () => F(k);

export const ARC_CH4: QuestDef = {
  id: 'arc_ch4', title: 'The Ground Breathes', giver: 'story', main: true, chapter: 4,
  desc: 'The watchers point south, to Te Riu Wera, where the ground cooks. Koro says the third watcher stands where "the earth breathes out". Its eye has gone.',
  steps: [
    { text: 'Follow the watchers to Te Riu Wera, the Hot Valley', done: f4('arc:ch4:arrive'), hint: 'The Hot Valley lies past the Glowing Forest. Trail boots for the hot ground.' },
    { text: 'Find the watcher at the edge of the geyser field', done: f4('arc:ch4:watcher'), hint: 'Past the silica terraces and the spring, where the vents are.' },
    { text: 'Cross the geyser field to Te Puia Nui, the great geyser', done: f4('arc:ch4:crossed'), hint: 'Each geyser tells before it blows: a gurgle, steam, the ground shaking. Go just after one blows.' },
    { text: 'Take the watcher\'s eye from the great geyser\'s throat', done: f4('arc:ch4:stone') },
    { text: 'Get back across the field before it all blows', done: f4('arc:ch4:escaped'), hint: 'Run. Watch the steam. Do not stop on a cone.' },
    { text: 'Set the eye back in the watcher', done: f4('arc:ch4:done') },
  ],
  reward: { rp: 40, text: 'The third watcher looks to the sea.' },
  next: 'arc_ch5',
};

// ------------------------------------------------------------------ the field
const WATCHER_X = 1690;
const GEYSERS = [1756, 1822, 1886, 1950, 2016, 2080];
const GREAT_X = 2170;
const PERIOD = 5.4, TELL = 1.5, BLOW = 1.7;

interface Geyser { x: number; t: number; period: number; off: number; big: boolean; hit: number; puff: number }
interface Ch4 { g: Geyser[]; mode: 'calm' | 'field' | 'wake'; stone: { x: number; y: number; vx: number; vy: number; t: number } | null; busy: boolean; eyeLit: number }

const active4 = () => qs('arc_ch4') === 'active';

/** a geyser's state now: 'rest' | 'tell' (0..1 through it) | 'blow' (0..1) */
function phaseOf(g: Geyser): ['rest' | 'tell' | 'blow', number] {
  const t = ((g.t + g.off) % g.period + g.period) % g.period;
  const tellAt = g.period - BLOW - TELL;
  if (t < tellAt) return ['rest', t / tellAt];
  if (t < g.period - BLOW) return ['tell', (t - tellAt) / TELL];
  return ['blow', (t - (g.period - BLOW)) / BLOW];
}

const WHITE = packColor(0.97, 0.98, 1, 1), FOAM = packColor(0.86, 0.93, 0.97, 1), SHADE = packColor(0.6, 0.72, 0.8, 1), DEEP = packColor(0.42, 0.55, 0.66, 1);
const DROP = packColor(0.8, 0.9, 0.96, 0.9);

/** a column of boiling water: ragged, lit on the left, shadowed on the right, droplets thrown off */
function drawColumn(rr: import('../../../gfx/renderer').Renderer, x: number, base: number, h: number, w: number, time: number, k: number) {
  for (let y = 0; y < h; y++) {
    const yy = base - y;
    const n = Math.sin(y * 0.45 - time * 22) * 1.2 + Math.sin(y * 0.17 + time * 9) * 1.4;
    const ww = Math.max(1, Math.round(w * (0.6 + 0.4 * (y / Math.max(1, h))) + n));
    const x0 = Math.round(x - ww / 2 + Math.sin(y * 0.09 + time * 3) * 1.5);
    rr.rect(x0, yy, 1, 1, FOAM);
    rr.rect(x0 + 1, yy, Math.max(1, ww - 3), 1, WHITE);
    rr.rect(x0 + ww - 2, yy, 1, 1, SHADE);
    rr.rect(x0 + ww - 1, yy, 1, 1, DEEP);
  }
  // the crown: water breaking over and falling back
  for (let i = 0; i < 18 * k; i++) {
    const a = (i * 2.399 + time * 2) % (Math.PI * 2), r = 4 + ((i * 37) % 9) + Math.sin(time * 7 + i) * 2;
    rr.rect(Math.round(x + Math.cos(a) * r * 1.4), Math.round(base - h + Math.sin(a) * r * 0.6 + ((time * 40 + i * 7) % 18)), 1, 1, i % 3 ? FOAM : WHITE);
  }
  for (let i = 0; i < 10 * k; i++) {
    const s = (time * 1.7 + i * 0.37) % 1, side = i % 2 ? 1 : -1;
    rr.rect(Math.round(x + side * (4 + s * (10 + i))), Math.round(base - h * (1 - s * s) + s * 10), 1, 1, DROP);
  }
}

function buildField(f: FieldScene, s: Ch4) {
  for (const x of GEYSERS) addProp(f, `arc4:cone:${x}`, () => sinterCone(x), x, geoGround(x) + 3, -1.2);
  addProp(f, 'arc4:cone:great', () => { const c = sinterCone(77); return c; }, GREAT_X, geoGround(GREAT_X) + 3, -1.2);
  addProp(f, 'arc4:cone:great2', () => sinterCone(79), GREAT_X + 14, geoGround(GREAT_X + 14) + 4, -1.25);
  const statue = addProp(f, 'arc4:watcher', () => watcherStatue(43, {}), WATCHER_X, geoGround(WATCHER_X) + 3, -2.5);
  const statueLit = addProp(f, 'arc4:watcherLit', () => watcherStatue(43, { socket: true }), WATCHER_X, geoGround(WATCHER_X) + 3, -2.49);
  if (statueLit) statueLit.hidden = !F('arc:ch4:done');
  if (statue) statue.hidden = F('arc:ch4:done');
  s.g = GEYSERS.map((x, i) => ({ x, t: 0, period: PERIOD, off: i * 0.62, big: false, hit: 0, puff: 0 }));
  s.g.push({ x: GREAT_X, t: 0, period: 11, off: 3, big: true, hit: 0, puff: 0 });

  // ---- the eruptions: drawn in front of the cones, behind the front foliage
  f.main.add(new Custom(20, (rr, st) => {
    if (s.mode === 'calm') return;
    for (const g of s.g) {
      const [ph, k] = phaseOf(g);
      const gy = geoGround(g.x) - 3;
      if (ph === 'tell') {
        // the water rising boiling in the throat: bubbles popping at the mouth, higher as it comes
        for (let i = 0; i < 4 + k * 6; i++) {
          const bx = g.x + Math.round(Math.sin(st.time * 13 + i * 2.1) * 2), by = gy - 1 - Math.round(((st.time * 8 + i * 0.7) % 1) * (2 + k * 5));
          rr.rect(bx, by, 1, 1, i % 2 ? FOAM : WHITE);
        }
      } else if (ph === 'blow') {
        const up = k < 0.18 ? k / 0.18 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
        const H = (g.big ? 140 : 84) * (0.25 + 0.75 * up);
        drawColumn(rr, g.x, gy, Math.round(H), g.big ? 12 : 7, st.time, g.big ? 1.6 : 1);
      }
    }
    // the eye stone flying (a pāua glint turning over)
    if (s.stone) {
      const q = s.stone, fl = Math.floor(q.t * 12) % 2;
      rr.rect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, packColor(0.16, 0.5, 0.52, 1));
      rr.rect(Math.round(q.x) - (fl ? 1 : 0), Math.round(q.y) - 1, 1, 1, packColor(0.85, 1, 0.95, 1));
    }
    // the set eye's sightline toward the sea, while it burns
    if (s.eyeLit > 0) {
      const ex = WATCHER_X + 30, ey = geoGround(WATCHER_X) - 48;
      for (let d = 0; d < 360 * Math.min(1, s.eyeLit); d += 3) {
        const a = Math.max(0, 1 - d / 360) * Math.min(1, s.eyeLit) * (0.5 + 0.5 * Math.sin(st.time * 6 - d * 0.08));
        rr.rect(Math.round(ex - d * 0.92), Math.round(ey - d * 0.38), 1, 1, packColor(0.6, 1, 0.9, a));
      }
    }
  }, dt => {
    if (s.mode === 'calm') return;
    const p = f.player;
    for (const g of s.g) {
      g.t += dt;
      g.hit -= dt;
      const [ph, k] = phaseOf(g);
      const gy = geoGround(g.x);
      if (ph === 'tell') {
        // steam puffs, a gurgle, a tremble when Mori is close
        g.puff -= dt;
        if (g.puff <= 0) {
          g.puff = 0.22 - k * 0.12;
          f.main.particles.spawn({ frame: A.soft, x: g.x + rand.range(-3, 3), y: gy - 6, vx: rand.range(-4, 4), vy: rand.range(-30, -16) * (0.6 + k), life: rand.range(0.8, 1.4), color: [0.95, 0.96, 0.97], alpha: 0.5, alpha1: 0, size: 0.6, size1: 2.2 });
          if (rand.chance(0.35)) f.sfx('bubble', g.x, 0.25 + k * 0.2, 0.7 + k * 0.6);
        }
        if (Math.abs(p.x - g.x) < 70 && k > 0.5 && rand.chance(dt * 4)) f.st.shake(0.6 + (g.big ? 1.2 : 0), 0.15);
      } else if (ph === 'blow') {
        if (k < dt / BLOW + 0.001) { f.sfx('hiss', g.x, g.big ? 0.8 : 0.5, g.big ? 0.5 : 0.8); f.sfx('splashBig', g.x, 0.35, 1.3); }
        if (rand.chance(dt * 6)) f.main.particles.spawn({ frame: A.soft, x: g.x + rand.range(-6, 6), y: gy - rand.range(40, 90), vx: rand.range(-10, 10), vy: rand.range(-20, -6), life: rand.range(1.2, 2.2), color: [0.96, 0.97, 0.98], alpha: 0.55, alpha1: 0, size: 1.2, size1: 4 });
        // the hazard: standing on it, or walking into it, while it blows
        const up = k > 0.08 && k < 0.85;
        if (up && g.hit <= 0 && Math.abs(p.x - g.x) < (g.big ? 16 : 10) && p.y > gy - 90 && !f.cutscene) {
          g.hit = 1.2;
          hitMori(f, g.x, { sev: 2, what: 'the geyser' });
          void floatText({ text: rand.pick(['HOT HOT HOT!', 'AAGH! Scalded!', 'Ow! Steam! STEAM!']), style: 'scared', ms: 1600 });
        }
      }
    }
    if (s.stone) {
      const q = s.stone;
      q.t += dt; q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const gy = geoGround(q.x) - 3;
      if (q.y >= gy && q.vy > 0) { q.y = gy; q.vx *= 0.4; q.vy = -q.vy * 0.25; if (Math.abs(q.vy) < 12) q.vy = 0; }
    }
    if (s.eyeLit > 0) s.eyeLit = Math.min(2, s.eyeLit + dt * 0.6);
  }));
  return { statue, statueLit };
}

async function eruptionSet(f: FieldScene, s: Ch4) {
  const p = f.player;
  f.cutscene = true;
  try {
    await p.doWork('kneel', 1.1, () => {});
    await say('It\'s down there. I can SEE it. Glinting at the bottom of the... why is it getting closer?', 'scared', 2600);
    audio.setDanger(0.7);
    cineBars(true);
    const great = s.g[s.g.length - 1];
    // the great geyser: straight into its tell, the ground heaving
    great.t = 0; great.off = great.period - BLOW - TELL;
    cineShake(4, 1.2);
    void line(f, 'aroha', 'MORI! GET BACK! It\'s BREATHING IN!', 'shout', 2000);
    p.poseOverride = 'scared';
    await cineTo(f.st, { x: GREAT_X - 20, y: geoGround(GREAT_X) - 50, zoom: 1.7, secs: 0.6, ease: 'out' });
    await sleep(1100);
    p.poseOverride = null;
    p.vx = -150; p.vy = -110; p.onGround = false;
    cineShake(9, 1.4);
    cineSlowmo(0.22, 0.15);
    audio.play('hiss' as never, { vol: 0.9, pitch: 0.4 });
    // the stone thrown up out of the column
    s.stone = { x: GREAT_X, y: geoGround(GREAT_X) - 20, vx: -30, vy: -150, t: 0 };
    await cineTo(f.st, { x: GREAT_X - 30, y: geoGround(GREAT_X) - 110, zoom: 1.35, secs: 0.9, ease: 'smooth' });
    void say('The EYE!', 'shout', 1400);
    await sleep(900);
    cineSlowmo(1, 0.6);
    await sleep(900);
    await cineRelease(f.st, 0.8);
    cineBars(false);
    // the field wakes: every geyser faster, out of step
    s.mode = 'wake';
    for (const g of s.g) if (!g.big) { g.period = rand.range(3.1, 3.9); g.off = rand.range(0, 3); }
    audio.setDanger(1);
    audio.setMusic('tension');
    void floatSky('TE WHENUA MANAWA', 'The ground breathes', '', 2600, { soft: true });
  } finally { f.cutscene = false; p.poseOverride = null; }
}

async function grabStone(f: FieldScene, s: Ch4) {
  const q = s.stone;
  if (!q) return;
  const Q = await import('../qte');
  const r = await Q.qte({ kind: 'hold', label: 'HOT! HOLD IT!', difficulty: 0.45, f, x: q.x, y: q.y - 36, pose: 'kneel' });
  if (!r.ok) { void say('OW! OW! Hot rock, hot rock! ...Wrap it in my shirt. Again.', 'scared', 2200); return; }
  s.stone = null;
  setF('arc:ch4:stone');
  audio.play('collectPop' as never, { vol: 0.6 });
  void say('Got it! Got it got it got it. Now RUN.', 'shout', 2000);
  f.hud?.refresh();
}

async function setEye(f: FieldScene, s: Ch4, art: { statue: { hidden: boolean } | null; statueLit: { hidden: boolean } | null }) {
  f.cutscene = true;
  const p = f.player;
  try {
    cineBars(true);
    await p.doWork('grab', 0.9, () => {});
    if (art.statue) art.statue.hidden = true;
    if (art.statueLit) art.statueLit.hidden = false;
    audio.play('discover' as never, { vol: 0.7 });
    await sleep(500);
    s.eyeLit = 0.01;
    await talk(f, [
      { who: 'mori', text: 'It fits. It clicked. Like it was waiting.', expr: 'excited' },
      ...(f.guide ? [{ who: 'aroha', text: 'Look where it\'s looking. Not at the sky. Down the valley... out past the hills.', expr: 'serious' }] : []),
    ]);
    await cineLook(f.st, async () => {
      await cineTo(f.st, { x: WATCHER_X - 300, y: geoGround(WATCHER_X) - 160, zoom: 0.8, secs: 2.4, ease: 'smooth', dof: 1.4 });
      await sleep(1200);
    }, { release: 1.2 });
    await talk(f, [
      { who: 'mori', text: 'The sea. It\'s looking at the headland. The grotto. Under the water.', expr: 'thinking' },
      ...(f.guide ? [{ who: 'aroha', text: 'Koro says the old people sank one of them on purpose. To watch the deep.', expr: 'serious', style: 'whisper' }] : []),
      { who: 'mori', text: '(the stone loosens in the socket and drops into his hand, still warm)', expr: 'surprised' },
      { who: 'mori', text: 'Huh. It doesn\'t want to stay. ...Okay. You\'re coming with me, then.', expr: 'happy' },
    ]);
    if (art.statue) art.statue.hidden = false;
    if (art.statueLit) art.statueLit.hidden = true;
    s.eyeLit = 0;
    setF('arc:ch4:eye');
    setF('arc:ch4:done');
    await floatSky('THE THIRD EYE', 'It looks to the sea', 'TE ARA MATATŪ · IV', 3000);
  } finally { cineBars(false); f.cutscene = false; }
}

function install(f: FieldScene, r: TripRun | null) {
  const st = qs('arc_ch4');
  if (st === 'hidden') return;
  // this chapter's geysers replace the valley's random vent bursts there
  const hz = (r as unknown as { hazards?: { x0: number }[] } | null)?.hazards;
  if (Array.isArray(hz)) for (let i = hz.length - 1; i >= 0; i--) if (hz[i].x0 >= 1700) hz.splice(i, 1);
  const s: Ch4 = { g: [], mode: 'field', stone: null, busy: false, eyeLit: 0 };
  // left mid-escape: he got out (the stone is in his pack)
  if (F('arc:ch4:stone') && !F('arc:ch4:escaped')) setF('arc:ch4:escaped');
  const art = buildField(f, s);
  if (st === 'active') {
    setF('arc:ch4:arrive');
    if (!F('arc:ch4:title')) { setF('arc:ch4:title'); void floatSky('THE GROUND BREATHES', 'Te Riu Wera', 'TE ARA MATATŪ · IV', 3200); }
  }
  const tickHints = hints(f, [
    ['c4field', 1740, 'Those cones... they\'re all breathing. In. Out. Like they\'re asleep.'],
    ['c4great', GREAT_X - 60, 'That one\'s huge. And it hasn\'t blown once. That\'s... worse, actually.'],
  ]);
  const I = f.interact as Interactable[];
  I.push({
    x: WATCHER_X + 6, y: geoGround(WATCHER_X) - 30, w: 22, h: 30, standX: WATCHER_X - 30,
    get label() { return F('arc:ch4:stone') && !F('arc:ch4:done') ? 'Set the eye in the watcher' : 'Look at the watcher'; },
    enabled: () => active4() && !s.busy,
    quest: () => active4() && (!F('arc:ch4:watcher') || (F('arc:ch4:escaped') && !F('arc:ch4:done'))),
    action: async () => {
      if (s.busy) return;
      s.busy = true;
      try {
        if (F('arc:ch4:stone')) { if (F('arc:ch4:escaped')) await setEye(f, s, art); return; }
        if (!F('arc:ch4:watcher')) {
          await talk(f, [
            { who: 'mori', text: 'The third watcher. Same carving: the crest, the smile. But the eye socket\'s empty. And BLACK. Scorched.', expr: 'thinking' },
            { who: 'mori', text: 'Something blew it out. Something... that way.', expr: 'worried' },
            ...(f.guide ? [{ who: 'aroha', text: 'Te Puia Nui. The big one at the end. Koro says it swallows what it likes and gives it back when it likes.', expr: 'serious' }] : []),
            ...(f.guide ? [{ who: 'aroha', text: 'Watch them. Each one tells you before it blows. Steam, a gurgle, the ground shivers. Go right AFTER one goes.', expr: 'serious' }] : [{ who: 'mori', text: 'Okay. Watch them. They puff before they blow. Go right after.', expr: 'thinking' }]),
          ]);
          setF('arc:ch4:watcher');
          s.mode = 'field';
        } else void say('It\'s waiting for its eye. Across the field.', 'think', 2200);
      } finally { s.busy = false; }
    },
  });
  I.push({
    x: GREAT_X, y: geoGround(GREAT_X) - 10, w: 16, h: 18, standX: GREAT_X - 18,
    label: 'Reach into the great geyser\'s throat',
    enabled: () => active4() && F('arc:ch4:watcher') && !F('arc:ch4:stone') && !s.stone && !s.busy && s.mode !== 'wake',
    quest: () => active4() && F('arc:ch4:crossed') && !F('arc:ch4:stone') && !s.stone,
    action: async () => { if (s.busy) return; s.busy = true; try { await eruptionSet(f, s); } finally { s.busy = false; } },
  });
  I.push({
    get x() { return s.stone?.x ?? -9999; }, get y() { return s.stone?.y ?? 0; }, w: 12, h: 12,
    label: 'Grab the hot eye stone',
    enabled: () => !!s.stone && Math.abs(s.stone.vy) < 1 && !s.busy,
    quest: () => !!s.stone,
    action: async () => { if (s.busy) return; s.busy = true; try { await grabStone(f, s); } finally { s.busy = false; } },
  });
  // ---- per frame: progress by where Mori is
  f.main.add(new Custom(0, () => {}, () => {
    if (!live(f)) return;
    tickHints();
    if (!active4()) return;
    const p = f.player;
    if (F('arc:ch4:watcher') && !F('arc:ch4:crossed') && p.x > GREAT_X - 40) { setF('arc:ch4:crossed'); void say('Made it. Every hair on my arms is steamed straight.', 'happy', 2400); }
    if (F('arc:ch4:stone') && !F('arc:ch4:escaped') && p.x < WATCHER_X + 20) {
      setF('arc:ch4:escaped');
      s.mode = 'field';
      for (const g of s.g) if (!g.big) g.period = PERIOD;
      audio.setDanger(0);
      void say('Out. OUT. I\'m out. (He looks down: the stone is glowing faintly in his hands.)', 'happy', 2800);
      void line(f, 'aroha', 'You absolute egg. ...That was amazing.', 'laugh', 2600);
    }
  }));
  void clamp;
}

/** the chapter's scene content (the arc's installer calls it from onLocEnter) */
export function enterCh4(f: FieldScene, loc: string | null, r: TripRun | null) {
  if (loc !== 'geovalley') return;
  try { install(f, r); } catch (e) { console.warn('[arc4] install', e); }
}
void game;
