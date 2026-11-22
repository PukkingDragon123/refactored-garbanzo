// V12 Te Ara Matatū (the path of the watchers), chapter 1: Ngā Kanohi o te Pā, the Ruins' Eyes.
// At the Old Pā (loc 'ruins'), after the night of the claw. Koro has told Mori the stone watchers point to
// five old places; the first is here.
//
//   1. arrive        the chapter's title in the sky; Aroha remembers Koro's words: "the watchers open
//                    their eyes when the sun looks with them"
//   2. the eyes      three carved standing stones stand by the old watchers, each with a koru round a
//                    pāua eye. A sliver of sun (through a gap the carvers left) slides across each face
//                    as the day goes and lands IN the eye for about an hour: the morning stone on the
//                    low terrace (~9:15), the noon stone by the great carving (~12:25), the afternoon
//                    stone on the top terrace (~15:25). Photograph each one with the light in its eye.
//                    Sit by a stone to wait for the sun (the day moves on). Flags arc:ch1:eye1..3.
//   3. the gaze      all three photographed: the camera follows the three gaze lines to one place on the
//                    top terrace: a whare sealed into the bank, its lintel holding three empty sockets,
//                    which light up (arc:ch1:gaze). Heave the door stone (a QTE): it grinds down into its
//                    slot (arc:ch1:open).
//   4. inside        the painted rafters: Mori makes a charcoal rubbing of the kōwhaiwhai (the key item
//                    arc_rubbing; arc:ch1:rubbing). Then the floor moves.
//   5. the cave-in   SET PIECE. The terrace collapses behind him: a wall of falling stone and dust
//                    chases him back along the terraces to the bearer stone (x 760); rocks drop ahead
//                    with a tell (dust trickling, a shadow growing on the ground); a hit knocks him down
//                    and costs time. The front is faster than a walk: he has to sprint, and if he burns
//                    his stamina out he's winded and it catches him (then: again, from the door, a little
//                    easier each time). The watch counts down; slow motion as it starts and as he dives
//                    clear (arc:ch1:escaped).
//   6. the rubbing   unrolled in the light with Aroha: five eyes, one pressed hard: Te Toka Iwi, the
//                    Bone Cliffs (rumour, map note; arc:ch1:done).

import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { Prop, Custom } from '../../../world/props';
import { sprite } from '../../sites2/common';
import { ruinsGround } from '../../sites10/ruins';
import { currentExpedition, passTime } from '../../v10/expedition';
import { rumour, addNote } from '../../v10/regions';
import { hourNow } from '../trails';
import { hourWords } from '../clock';
import { hitMori } from '../wilds';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { floatSky, floatCaption } from '../../../ui/v12/float';
import { give } from '../../inventory';
import { ITEMS } from '../../items';
import { carvedStone, sunFleck, whare, whareDoor, rock, rubbleHeap, WHARE } from '../../../art/v12/arc/props1';
import { F, setF, active, say, aroha, sleep, onShot, inShot, lateTick, hints, drawDust } from './kit1';
import './items1';

// ------------------------------------------------------------------ where things are (ruins world x)
const STONES = [
  { id: 1, x: 470, h: 9.25, seed: 11, name: 'the morning stone' },
  { id: 2, x: 1228, h: 12.4, seed: 12, name: 'the noon stone' },
  { id: 3, x: 1790, h: 15.4, seed: 13, name: 'the afternoon stone' },
];
const WHARE_X = 1930, SAFE_X = 760;
/** hours either side of a stone's moment that the light is in its eye */
const WIN = 0.6;
const gy = (x: number) => ruinsGround(x);

/** the hour here (without an expedition clock, a local one the waiting moves on) */
let localWait = 0;
const hour = (f: FieldScene) => (currentExpedition() ? hourNow(f) : 11.5 + localWait);
const aligned = (f: FieldScene, s: typeof STONES[number]) => Math.abs(hour(f) - s.h) < WIN;

const shown = () => F('arc:ch1:arrived') || active('arc_ch1') || F('arc:ch1:done');

// ------------------------------------------------------------------ per visit
interface Ch1 {
  busy: boolean;
  doorT: number;
  /** the gaze cutscene's lines: 0..1 drawn */
  gazeK: number;
  run: CaveIn | null;
  whareProp: Prop | null;
  heapProp: Prop | null;
  fleck: Frame | null;
  told: Set<string>;
}

export function build(f: FieldScene) {
  const S: Ch1 = { busy: false, doorT: F('arc:ch1:open') ? 1 : 0, gazeK: F('arc:ch1:gaze') ? 1 : 0, run: null, whareProp: null, heapProp: null, fleck: null, told: new Set() };
  const fl = sprite('arc1:fleck', () => sunFleck());
  S.fleck = fl?.f ?? null;
  // ---------------------------------------------------------------- the three carved stones
  for (const s of STONES) {
    const c = sprite(`arc1:stone:${s.id}`, () => carvedStone(s.seed));
    if (!c) continue;
    const y = gy(s.x) + 2;
    f.main.add(new Prop(c.f, s.x, y, 1.7, { foliage: false }));
    const eye = (c.s as ReturnType<typeof carvedStone>).eye;
    const ex = s.x + eye[0], ey = y + eye[1];
    f.main.add(new Custom(1.75, (r, st) => {
      const done = F('arc:ch1:eye' + s.id);
      const h = hour(f), off = h - s.h;
      // the sliver of sun across the face, if the sun is up and on this side of it
      if (h > 7 && h < 17.6 && Math.abs(off) < 1.25 && S.fleck) {
        const fx = Math.round(ex + off * 9), fy = Math.round(ey + off * 2.5);
        const on = Math.abs(off) < WIN;
        r.emissive(1);
        r.draw(S.fleck, fx, fy, 1, 1, 0, packColor(1, 1, 1, on ? 1 : 0.75));
        r.emissive();
        r.light(fx, fy, on ? 30 : 18, 1, 0.82, 0.5, on ? 0.9 : 0.4, 0.2);
        if (on) r.fxDraw(A.spark, ex + 0.5, ey, 0.5 + 0.25 * Math.sin(st.time * 6), 0.5 + 0.25 * Math.sin(st.time * 6), st.time, packColor(1, 0.95, 0.8, 1), 1.2);
      }
      // a photographed eye keeps a little of its shine
      if (done) r.light(ex, ey, 14, 0.5, 0.9, 1, 0.35 + 0.1 * Math.sin(st.time * 2 + s.id), 0.2);
    }));
    (f.interact as import('../../../world/npc').Interactable[]).push({
      x: s.x, y: y - 24, w: 16, h: 26, standX: s.x - 22,
      get label() { return F('arc:ch1:eye' + s.id) ? 'Look at the carved stone' : aligned(f, s) ? 'Look at the light in its eye' : 'Sit by the stone and wait for the sun'; },
      enabled: () => !S.busy && shown(),
      action: () => stoneAction(f, S, s),
    } as never);
  }
  // ---------------------------------------------------------------- the whare (or what's left of it)
  const wy = gy(WHARE_X) + 2;
  const wS = sprite('arc1:whare', () => whare(3)), wO = sprite('arc1:whareOpen', () => whare(3, true)), door = sprite('arc1:door', () => whareDoor(3));
  const heap = sprite('arc1:heap', () => rubbleHeap(9, 150, 64));
  if (wS && wO && door) {
    S.whareProp = new Prop(F('arc:ch1:open') ? wO.f : wS.f, WHARE_X, wy, 1.6, { foliage: false });
    f.main.add(S.whareProp);
    // the door slab: sinks into its slot as it opens (only the part above the threshold drawn)
    f.main.add(new Custom(1.62, r => {
      if (F('arc:ch1:collapsed') || S.doorT >= 1) return;
      const fr = door.f, k = S.doorT, keep = Math.max(1, Math.round(fr.h * (1 - k)));
      const tw = fr.tex.w, th = fr.tex.h, u0 = fr.u0 * tw, v0 = fr.v0 * th;
      const sub: Frame = { ...fr, u1: (u0 + fr.w) / tw, v1: (v0 + keep) / th, h: keep, ay: keep };
      r.draw(sub, WHARE_X + (k > 0 && k < 1 ? rand.range(-0.6, 0.6) : 0), wy - 1, 1, 1, 0, packColor(1, 1, 1, 1));
    }, dt => {
      if (S.doorT > 0 && S.doorT < 1) {
        S.doorT = Math.min(1, S.doorT + dt / 1.8);
        if (rand.chance(dt * 30)) f.main.particles.spawn({ frame: A.dot2, x: WHARE_X + rand.range(-11, 11), y: wy - 2, vx: rand.range(-20, 20), vy: rand.range(-30, -8), ay: 80, life: 0.9, color: [0.55, 0.48, 0.4], alpha: 0.8, alpha1: 0, floorY: wy });
        if (S.doorT >= 1 && S.whareProp) { S.whareProp.frame = wO.f; audio.play('land', { vol: 0.6, pitch: 0.5 }); }
      }
    }));
    // the three sockets over the door, lit once the gaze has found them
    f.main.add(new Custom(1.64, (r, st) => {
      if (F('arc:ch1:collapsed') || S.gazeK <= 0) return;
      for (const [i, sx] of WHARE.sockets.entries()) {
        const k = clamp(S.gazeK * 3 - i);
        if (k <= 0) continue;
        const x = WHARE_X + sx, y = wy - 2 + WHARE.socketY;
        r.emissive(1);
        r.rect(x - 1, y - 1, 2, 2, packColor(0.75, 1, 0.95, k * (0.75 + 0.2 * Math.sin(st.time * 3 + i))));
        r.emissive();
        r.light(x, y, 16, 0.5, 1, 0.9, 0.6 * k, 0.2);
      }
      // the gaze lines: light running from each eye to its socket, pixel by pixel
      if (S.gazeK < 1 && S.gazeK > 0) {
        for (const [i, s] of STONES.entries()) {
          const c = sprite(`arc1:stone:${s.id}`, () => carvedStone(s.seed));
          if (!c) continue;
          const eye = (c.s as ReturnType<typeof carvedStone>).eye;
          const ax = s.x + eye[0], ay = gy(s.x) + 2 + eye[1], bx = WHARE_X + WHARE.sockets[i], by = wy - 2 + WHARE.socketY;
          const n = Math.ceil(Math.abs(bx - ax) / 3), head = Math.floor(n * clamp(S.gazeK * 1.4 - i * 0.12));
          for (let k = Math.max(0, head - 26); k < head; k++) {
            const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 30;
            r.emissive(1);
            r.rect(Math.round(x), Math.round(y), 1, 1, packColor(1, 0.9, 0.6, 0.35 + 0.65 * ((k - head + 26) / 26)));
            r.emissive();
          }
        }
      }
    }));
    if (heap) {
      S.heapProp = new Prop(heap.f, WHARE_X + 4, wy + 4, 1.66, { foliage: false });
      S.heapProp.hidden = !F('arc:ch1:collapsed');
      f.main.add(S.heapProp);
      if (F('arc:ch1:collapsed') && S.whareProp) S.whareProp.hidden = true;
    }
    (f.interact as import('../../../world/npc').Interactable[]).push({
      x: WHARE_X, y: wy - 16, w: 16, h: 30, standX: WHARE_X - 18,
      get label() { return F('arc:ch1:open') ? 'Go inside the whare' : F('arc:ch1:gaze') ? 'Heave the door stone' : 'Look at the sealed door'; },
      enabled: () => !S.busy && !S.run && shown() && !F('arc:ch1:collapsed'),
      action: () => doorAction(f, S),
    } as never);
  }
  // ---------------------------------------------------------------- the photos
  onShot(f, ph => {
    void ph;
    if (!active('arc_ch1')) return;
    for (const s of STONES) {
      if (F('arc:ch1:eye' + s.id)) continue;
      const y = gy(s.x) + 2;
      const q = inShot(f, s.x - 14, y - 48, s.x + 14, y);
      if (q.inFrame < 0.6 || q.size < 0.1) continue;
      if (!aligned(f, s)) {
        if (!S.told.has('shade' + s.id)) { S.told.add('shade' + s.id); void say('The eye\'s in shadow. The light has to be IN it, Koro said...', 'think', 2800); }
        continue;
      }
      setF('arc:ch1:eye' + s.id);
      audio.play('discover', { vol: 0.5, pitch: 1.1 });
      const n = STONES.filter(t => F('arc:ch1:eye' + t.id)).length;
      setTimeout(() => void say(n === 1 ? 'Got it! The pāua lit up like it was looking right back at me.' : n === 2 ? 'Two eyes open. One to go.' : 'Three. All three are open...', 'happy', 2800), 500);
      if (n === 3) setTimeout(() => void gaze(f, S), 3300);
    }
  });
  // ---------------------------------------------------------------- arriving, the hints
  const hint = hints(f, [
    { id: 'arc:ch1:h:stone1', x: STONES[0].x, text: 'A carved stone. A koru round a pāua eye... and a patch of sun moving across it.' },
    { id: 'arc:ch1:h:stone2', x: STONES[1].x, text: 'Another eye. Where the light falls depends on the time of day. It\'s a clock!' },
    { id: 'arc:ch1:h:stone3', x: STONES[2].x, text: 'The third one faces the afternoon. Late light.' },
    { id: 'arc:ch1:h:whare', x: WHARE_X, text: 'A whare. Built INTO the bank. And the door\'s been sealed with clay.', when: () => F('arc:ch1:arrived') },
  ]);
  f.main.add(new Custom(0, () => {}, dt => { if (game.scene === (f as never) && active('arc_ch1') && F('arc:ch1:arrived') && !S.run) hint(dt); S.run?.tick(dt); }));
  const ex = f.exit.bind(f);
  f.exit = () => { S.run?.dispose(); ex(); };
  if (active('arc_ch1') && !F('arc:ch1:arrived')) void arrive(f);
  else if (active('arc_ch1') && F('arc:ch1:escaped') && !F('arc:ch1:done')) setTimeout(() => void payoff(f, S), 2500);
}

async function arrive(f: FieldScene) {
  await sleep(2600);
  if (game.scene !== (f as never)) return;
  await floatSky('The Ruins\' Eyes', 'Ngā Kanohi o te Pā', 'Te Ara Matatū · Chapter 1', 3600);
  setF('arc:ch1:arrived');
  await aroha(f, 'Koro said it like a riddle: the watchers open their eyes when the sun looks with them.', 'say', 3600);
  await sleep(600);
  await say('So we look where they\'re looking. And we bring the sun.', 'happy', 2800);
  const h = hour(f);
  const next = STONES.find(s => s.h + WIN > h);
  setTimeout(() => void aroha(f, next ? `There are carved stones by the watchers. Watch the light on them, Mori.` : 'The sun\'s too low today. Come back in the morning.', 'whisper', 3200), 1200);
}

async function stoneAction(f: FieldScene, S: Ch1, s: typeof STONES[number]) {
  if (S.busy) return;
  S.busy = true;
  const p = f.player;
  try {
    if (F('arc:ch1:eye' + s.id)) { await say('The pāua still holds a little of the sun.', 'think', 2400); return; }
    if (aligned(f, s)) { await say('The light\'s right in its eye. Camera. CAMERA, Mori.', 'happy', 2600); return; }
    const h = hour(f);
    if (h > s.h) { await say(`The light\'s already gone past its eye. ${s.id === 1 ? 'Morning stone: come back in the morning.' : 'Tomorrow, earlier.'}`, 'think', 3000); return; }
    const wait = Math.max(0.1, s.h - 0.2 - h);
    if (wait > 6) { await say('That\'s hours off. I\'d be sitting here all day.', 'think', 2600); return; }
    f.cutscene = true;
    p.poseOverride = 'sitGround';
    await sleep(600);
    await game.fadeTo(1, 1.4);
    if (currentExpedition()) passTime(wait); else localWait += wait;
    void floatCaption(`${hourWords(hour(f))}. The light creeps across the stone.`, 2400);
    await sleep(1400);
    await game.fadeTo(0, 1.4);
    if (p.poseOverride === 'sitGround') p.poseOverride = null;
    await say('There. It\'s sliding into the eye...', 'whisper', 2400);
  } finally { f.cutscene = false; S.busy = false; if (p.poseOverride === 'sitGround') p.poseOverride = null; }
}

/** the three gaze lines run to the whare: the sockets light */
async function gaze(f: FieldScene, S: Ch1) {
  if (F('arc:ch1:gaze') || game.scene !== (f as never)) return;
  const cine = await import('../../v11/cine');
  f.cutscene = true;
  f.cam?.raise(false);
  cine.cineBars(true);
  try {
    await cine.cineTo(f.st, { x: WHARE_X - 260, y: gy(WHARE_X) - 70, zoom: 0.8, secs: 1.8 });
    S.gazeK = 0.001;
    audio.play('whoosh', { vol: 0.4, pitch: 0.6 });
    const t0 = performance.now();
    await new Promise<void>(res => {
      const step = () => { S.gazeK = Math.min(1, (performance.now() - t0) / 3200); if (S.gazeK >= 1) res(); else requestAnimationFrame(step); };
      step();
    });
    await cine.cineTo(f.st, { x: WHARE_X, y: gy(WHARE_X) - 40, zoom: 1.35, secs: 1.4 });
    audio.play('discover', { vol: 0.6, pitch: 0.8 });
    await say('They all look at the same place. Up there. On the top terrace.', 'whisper', 3000);
    await aroha(f, 'A whare. Dug into the bank and sealed. Nobody has opened that since before my koro\'s koro.', 'whisper', 3600);
    setF('arc:ch1:gaze');
  } finally {
    await cine.cineRelease(f.st, 1.2);
    cine.cineBars(false);
    f.cutscene = false;
  }
}

async function doorAction(f: FieldScene, S: Ch1) {
  if (S.busy) return;
  S.busy = true;
  try {
    if (F('arc:ch1:open')) { await inside(f, S); return; }
    if (!F('arc:ch1:gaze')) {
      await say('Sealed with clay and a stone slab. Three empty sockets over the door... like eyes waiting to be opened.', 'think', 3400);
      return;
    }
    await aroha(f, 'Gently. It\'s been waiting a long time.', 'whisper', 2200);
    const Q = await import('../qte');
    const res = await Q.qte({ kind: 'mash', label: 'HEAVE!', difficulty: 0.5, count: 11, time: 5, f, x: WHARE_X, y: gy(WHARE_X) - 50, pose: 'pull' });
    if (!res.ok) { await say('Hnnngh... it moved. A hair. Again.', 'say', 2200); return; }
    S.doorT = 0.001;
    audio.play('woodCreak', { vol: 0.6, pitch: 0.4 });
    const cine = await import('../../v11/cine');
    cine.cineShake(3, 1.6);
    setF('arc:ch1:open');
    await sleep(2000);
    await say('It sank right into the ground. Like it was MADE to.', 'happy', 2600);
  } finally { S.busy = false; }
}

/** in through the door: the painted rafters, the rubbing, and then the floor moves */
async function inside(f: FieldScene, S: Ch1) {
  const p = f.player;
  f.cutscene = true;
  f.cam?.raise(false);
  try {
    await p.walkTo(WHARE_X, 40);
    await game.fadeTo(1, 1.6);
    p.alpha = 0;
    await floatCaption('Inside, it\'s dry and still. Every rafter is painted: red, black and white koru running into the dark.', 3200);
    if (!F('arc:ch1:rubbing')) {
      audio.play('pencil', { vol: 0.5 });
      await floatCaption('Mori holds the notebook to the rafter and rubs charcoal over it, slow and careful.', 2800);
      give('arc_rubbing', 1);
      setF('arc:ch1:rubbing');
      audio.play('collectPop', { vol: 0.6 });
      await floatCaption(`${ITEMS.arc_rubbing?.name ?? 'The rubbing'}: a running pattern... and in it, five eyes.`, 2800);
    }
    audio.play('thunderClose', { vol: 0.5, pitch: 0.5 });
    await floatCaption('Then the floor moves.', 1800);
  } finally {
    p.alpha = 1;
    p.x = WHARE_X - 6;
    p.y = gy(p.x);
    p.facing = -1;
    p.vx = 0;
  }
  await game.fadeTo(0, 2.4);
  f.cutscene = false;
  S.run?.dispose();
  S.run = new CaveIn(f, S, 0);
}

// ------------------------------------------------------------------ the cave-in

interface Fall { x: number; t: number; size: number; spr: Frame | null; done: boolean }
class CaveIn {
  t = 0;
  front: number;
  private fallT = 1.2;
  private falls: Fall[] = [];
  private lying: Prop[] = [];
  private shakeT = 0;
  private watch: { close(): void } | null = null;
  private late = false;
  private ended = false;
  private unLate: (() => void) | null = null;
  private draw: Custom;
  private rocks: Frame[] = [];
  private guide: FieldScene['guide'] = null;
  constructor(readonly f: FieldScene, readonly S: Ch1, readonly fails: number) {
    this.front = WHARE_X + 26;
    for (let i = 0; i < 8; i++) { const s = sprite(`arc1:rock:${i}`, () => rock(40 + i, 5 + i * 1.6)); if (s) this.rocks.push(s.f); }
    this.draw = new Custom(58, r => this.render(r));
    f.main.add(this.draw);
    void this.start();
  }
  private async start() {
    const f = this.f, cine = await import('../../v11/cine');
    audio.setMusic('tension');
    cine.cineShake(9, 1);
    cine.cineSlowmo(0.25);
    audio.play('thunderClose', { vol: 0.8, pitch: 0.6 });
    if (this.S.whareProp) this.S.whareProp.hidden = false;
    // Aroha: out ahead, shouting
    this.guide = f.guide;
    if (this.guide) { f.guide = null; void this.guide.a.walkTo(SAFE_X - 60, 125, 'run'); }
    void aroha(f, 'MORI! RUN!', 'shout', 1800);
    await sleep(900);
    cine.cineSlowmo(1, 0.4);
    if (this.fails === 0) void say('Run run run run RUN!', 'scared', 1800);
    else void floatCaption('Again. And this time, run.', 1800);
    const W = await import('../../../ui/v12/watch');
    if (!this.ended) this.watch = W.showWatch({ mode: 'countdown', secs: 24, anchor: 'mori', size: 26, onEnd: () => { this.late = true; } });
    this.unLate = lateTick(f, () => {
      if (this.ended) return;
      const gap = this.f.player.x - this.front;
      audio.setDanger(0.85);
      audio.setHeartbeat(clamp(1 - Math.abs(gap) / 220, 0.25, 1));
    });
  }
  tick(dt: number) {
    if (this.ended) return;
    const f = this.f, p = f.player;
    this.t += dt;
    // the front: picks up to a pace faster than a walk (a little slower after each failed run)
    const top = (66 - this.fails * 4) * (this.late ? 1.5 : 1);
    const v = this.t < 1 ? 0 : Math.min(top, 18 + (this.t - 1) * 30);
    this.front -= v * dt;
    // the shaking never stops
    this.shakeT -= dt;
    if (this.shakeT <= 0) { this.shakeT = 0.45; f.st.shake(1.4, 0.5); }
    // the debris left behind the front
    if (this.lying.length < 26 && rand.chance(dt * 6)) {
      const x = this.front + rand.range(10, 70), s = this.rocks[rand.int(0, this.rocks.length - 1)];
      if (s) { const pr = new Prop(s, x, gy(x) - 2, 56, { foliage: false, rot: rand.range(-1, 1) }); this.lying.push(pr); f.main.add(pr); }
    }
    // rocks dropping ahead of him (and onto where he's going)
    this.fallT -= dt;
    if (this.fallT <= 0 && this.t > 1.2) {
      this.fallT = rand.range(0.9, 1.4);
      const lead = rand.chance(0.3) ? -p.vx * 0.95 : -rand.range(60, 160);
      const x = clamp(p.x + lead, SAFE_X + 10, this.front - 20);
      this.falls.push({ x, t: 0, size: rand.int(2, 7), spr: this.rocks[rand.int(2, this.rocks.length - 1)] ?? null, done: false });
      f.sfx('rustle', x, 0.45, 0.6);
    }
    for (const q of this.falls) {
      q.t += dt;
      // the tell: grit trickling down onto the spot
      if (q.t < 0.85 && rand.chance(dt * 22)) f.main.particles.spawn({ frame: A.dot2, x: q.x + rand.range(-4, 4), y: gy(q.x) - 160, vx: rand.range(-4, 4), vy: rand.range(60, 110), ay: 300, life: 0.7, color: [0.62, 0.55, 0.45], alpha: 0.9, alpha1: 0.4, floorY: gy(q.x) });
      if (q.t >= 1.1 && !q.done) {
        q.done = true;
        f.sfx('land', q.x, 0.8, 0.6);
        f.st.shake(2.5, 0.25);
        for (let i = 0; i < 10; i++) f.main.particles.spawn({ frame: A.dot2, x: q.x + rand.range(-6, 6), y: gy(q.x) - 2, vx: rand.range(-70, 70), vy: rand.range(-90, -20), ay: 300, life: 0.8, color: [0.5, 0.45, 0.38], alpha: 1, alpha1: 0.2, floorY: gy(q.x) + 1 });
        if (Math.abs(p.x - q.x) < 10 && p.y > gy(q.x) - 30 && p.state !== 'stunned') hitMori(f, q.x + 6, { sev: 1 });
        if (q.spr && this.lying.length < 40) { const pr = new Prop(q.spr, q.x, gy(q.x) - 2, 55, { foliage: false, rot: rand.range(-1, 1) }); this.lying.push(pr); f.main.add(pr); }
      }
    }
    this.falls = this.falls.filter(q => q.t < 1.4);
    // caught, or clear
    if (p.x >= this.front - 6) { void this.caught(); return; }
    if (p.x <= SAFE_X) void this.clear();
  }
  private render(r: Renderer) {
    if (this.ended) return;
    const f = this.f, t = this.t;
    // the shadows growing under falling rocks: a dithered patch, wider and darker as the rock comes
    for (const q of this.falls) {
      if (q.t >= 1.1) continue;
      const k = q.t / 1.1, w = 2 + Math.round(k * 7), y = Math.round(gy(q.x));
      for (let i = -w; i <= w; i++) if (((i + Math.floor(t * 8)) & 1) === 0 || k > 0.6) r.rect(Math.round(q.x) + i, y - 1, 1, 1, packColor(0.05, 0.03, 0.02, 0.35 + k * 0.4));
      // the rock itself, falling the last stretch
      if (q.t > 0.85 && q.spr) { const u = (q.t - 0.85) / 0.25; r.draw(q.spr, q.x, gy(q.x) - 4 - (1 - u) * 170, 1, 1, t * 6, packColor(1, 1, 1, 1)); }
    }
    // the front: a curtain of falling stone in a billowing wall of dust (dithered, never soft)
    const x0 = Math.round(this.front), g0 = gy(this.front);
    drawDust(r, this.front + 4, gy, -1, t, { h: 180, w: 120 });
    for (let i = 0; i < 18; i++) {
      const s = this.rocks[i % this.rocks.length];
      if (!s) continue;
      const ph = (t * (0.9 + (i % 5) * 0.12) + i * 0.137) % 1;
      r.draw(s, x0 + 4 + ((i * 37) % 70), g0 - 200 + ph * 200, 1, 1, t * (2 + (i % 3)), packColor(1, 1, 1, 1));
    }
    void f;
  }
  private async caught() {
    if (this.ended) return;
    const f = this.f, p = f.player;
    this.stop();
    hitMori(f, this.front + 10, { sev: 3 });
    await sleep(900);
    await game.fadeTo(1, 1.2);
    await floatCaption('The dust closes over him. Aroha\'s hands find his collar and HAUL.', 2600);
    for (const pr of this.lying) pr.hidden = true;
    p.x = WHARE_X - 6; p.y = gy(p.x); p.facing = -1; p.vx = 0; p.state = 'normal'; p.poseOverride = null;
    await game.fadeTo(0, 1.6);
    if (game.scene !== (f as never)) return;
    this.S.run = new CaveIn(f, this.S, this.fails + 1);
  }
  private async clear() {
    if (this.ended) return;
    const f = this.f, cine = await import('../../v11/cine');
    this.stop();
    cine.cineSlowmo(0.3);
    cine.cineShake(10, 1.2);
    audio.play('thunderClose', { vol: 0.9, pitch: 0.45 });
    setF('arc:ch1:escaped');
    setF('arc:ch1:collapsed');
    if (this.S.whareProp) this.S.whareProp.hidden = true;
    if (this.S.heapProp) this.S.heapProp.hidden = false;
    await sleep(1000);
    cine.cineSlowmo(1, 0.6);
    await say('...is it... done? Is it DONE?', 'scared', 2200);
    setTimeout(() => void payoff(f, this.S), 2200);
  }
  private stop() {
    this.ended = true;
    this.watch?.close();
    this.watch = null;
    this.unLate?.();
    audio.setHeartbeat(0);
    audio.setDanger(0);
    audio.setMusic((this.f.site as { music?: Parameters<typeof audio.setMusic>[0] }).music ?? 'wonder');
    this.draw.fn = () => {};
    if (this.guide) { this.f.guide = this.guide; this.guide = null; }
  }
  dispose() {
    if (!this.ended) this.stop();
    void import('../../v11/cine').then(c => c.cineSlowmo(1, 0));
  }
}

// ------------------------------------------------------------------ the payoff: reading the rubbing
let paying = false;
async function payoff(f: FieldScene, S: Ch1) {
  if (paying || F('arc:ch1:done') || game.scene !== (f as never)) return;
  paying = true;
  void S;
  f.cutscene = true;
  try {
    await aroha(f, 'You\'re alive. You\'re ALIVE, you egg. The whole terrace...', 'shout', 2600);
    await say('I got it, though. Look.', 'happy', 2000);
    audio.play('paperSlide', { vol: 0.5 });
    await floatCaption('The rubbing, smoothed flat on a warm stone: a running koru, and in it five eyes, joined by paths.', 3400);
    await aroha(f, 'That\'s the island. Those are the old places. And this one... somebody pressed so hard the charcoal broke.', 'whisper', 3600);
    await say('It\'s right where the gorge is. Above the falls. The Bone Cliffs!', 'happy', 2800);
    await aroha(f, 'Te Toka Iwi. Koro says the old taniwha went there to sleep. Next, then.', 'say', 3000);
    rumour('fossils');
    addNote({ id: 'note:arc:ch1', loc: 'ruins', x: WHARE_X, text: 'The whare\'s rubbing: five eyes. The one pressed hardest is Te Toka Iwi, the Bone Cliffs.' });
    setF('arc:ch1:done');
  } finally { f.cutscene = false; paying = false; }
}

