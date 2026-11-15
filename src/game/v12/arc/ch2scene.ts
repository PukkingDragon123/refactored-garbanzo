// V12 Te Ara Matatū, chapter 2: Te Pakitara Iwi, the Fossil Wall. At Te Toka Iwi, the Bone Cliffs
// (loc 'fossils'), where the rubbing's hardest-pressed eye pointed.
//
//   1. arrive        the title; the rubbing laid against the cliff: the eye is a skull
//   2. the skull     four pieces of a giant skull lie in the gorge, each showing a curve of bone in
//                    disturbed earth: the snout on the bone terrace, the jaw out on the high ledge (under
//                    the falling rocks), the crest on the gorge floor by the river. Dig each one out (the
//                    close-up dig). Flags arc:ch2:dug1..3.
//   3. the race      three dug: Dr Celeste Varga of Helix walks into the gorge. She's been following them.
//                    The last piece, the eye, is up on the scree, and she sets off for it. A RACE: she
//                    walks there, then kneels and digs; the watch counts down to her lifting it. Get
//                    there first (arc:ch2:beatVarga) and dig it yourself, or watch her lift it.
//   4. the scree     SET PIECE, either way: the dig undercuts the scree and the whole slope lets go. A
//                    boulder the size of a car bounds down after Mori with stones raining ahead of it
//                    (each with a tell). Sprint to the big rock at the bottom of the scree: the boulder
//                    is faster than a walk, sprinting burns stamina, and winded means it catches him
//                    (knocked flat, then again from the top, a little easier). Slow motion as it smashes
//                    into the big rock behind him (arc:ch2:escaped).
//   5. the skull     laid out on the gorge floor from its four pieces (Varga, shaken, hands hers over if
//                    she won it): a taniwha skull with a mineral glowing green in its eye socket, the
//                    same light as the valley below the cleft. Te Ngahere Kānapanapa (arc:ch2:done).

import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import type { Actor } from '../../../world/actor';
import type { Interactable } from '../../../world/npc';
import type { TripRun } from '../../v10/field10';
import { packColor } from '../../../gfx/renderer';
import { Prop, Custom } from '../../../world/props';
import { sprite } from '../../sites2/common';
import { fossilGround } from '../../sites10/fossils';
import { rumour, addNote } from '../../v10/regions';
import { hitMori } from '../wilds';
import { isWinded } from '../stamina';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { floatSky, floatCaption } from '../../../ui/v12/float';
import { give, count, remove } from '../../inventory';
import { boneTip, rock, giantSkull } from '../../../art/v12/arc/props1';
import { F, setF, active, say, aroha, by, sleep, lateTick, hints, drawDust } from './kit1';
import './items1';

// ------------------------------------------------------------------ where (fossils world x; the terrace and the high ledge as the site builds them)
const TERRACE = 206, HIGH = 138;
const DIGS = [
  { id: 1, x: 1090, y: TERRACE, name: 'the snout' },
  { id: 2, x: 1990, y: HIGH, name: 'the jaw' },
  { id: 3, x: 330, y: 0, name: 'the crest' },
];
const LAST_X = 690, VARGA_X0 = 60, SAFE_X = 175, SKULL_X = 250;
const VARGA_WALK = 36, VARGA_DIG = 16;
const floorAt = (f: FieldScene, x: number, yHint: number) => (yHint ? f.st.terrain.surfaceBelow(x, yHint - 14, 0)?.y ?? yHint : fossilGround(x));

const shown = () => active('arc_ch2') || F('arc:ch2:done');

interface Ch2 {
  busy: boolean;
  race: Race | null;
  chase: Chase | null;
  varga: Actor | null;
  lastProp: Prop | null;
  lastDug: Frame | null;
  skull: Prop | null;
}

export function build(f: FieldScene, r: TripRun | null) {
  const S: Ch2 = { busy: false, race: null, chase: null, varga: null, lastProp: null, lastDug: null, skull: null };
  // ---------------------------------------------------------------- the dig sites
  for (const d of [...DIGS, { id: 4, x: LAST_X, y: 0, name: 'the eye' }]) {
    const tip = sprite(`arc2:bone:${d.id}`, () => boneTip(d.id * 7)), dug = sprite(`arc2:dug:${d.id}`, () => boneTip(d.id * 7, true));
    if (!tip || !dug) continue;
    const y = floorAt(f, d.x, d.y) + 2;
    const done = () => F('arc:ch2:dug' + d.id);
    const pr = new Prop(done() ? dug.f : tip.f, d.x, y, -1.4, { foliage: false });
    if (d.id === 4) { S.lastProp = pr; S.lastDug = dug.f; pr.hidden = !(F('arc:ch2:dug1') && F('arc:ch2:dug2') && F('arc:ch2:dug3')) && !F('arc:ch2:race'); }
    f.main.add(pr);
    (f.interact as Interactable[]).push({
      x: d.x, y: y - 8, w: 16, h: 18, standX: d.x - 18,
      get label() { return d.id === 4 ? 'Dig out the last piece' : `Dig out the bone (${d.name})`; },
      enabled: () => !S.busy && !done() && active('arc_ch2') && F('arc:ch2:arrived') && (d.id < 4 || ((!!S.race?.moriWon || F('arc:ch2:beatVarga')) && !F('arc:ch2:race'))),
      action: async () => {
        if (S.busy) return;
        S.busy = true;
        try {
          const Q = await import('../qte');
          const res = await Q.qte({ kind: 'hold', label: 'EASE IT OUT...', difficulty: d.id === 4 ? 0.55 : 0.45, f, x: d.x, y: y - 30, pose: 'kneel', closeup: { scene: 'dig', buried: 'fossil', item: 'arc_bone' } });
          if (!res.ok) { await say('Careful... it\'s cracked. Slowly, Mori. It\'s been here longer than anything.', 'think', 2600); return; }
          give('arc_bone', 1);
          setF('arc:ch2:dug' + d.id);
          pr.frame = dug.f;
          audio.play('discover', { vol: 0.5 });
          const [cx, cy] = f.css(d.x, y - 10);
          f.hud?.flyItem('arc_bone', 1, 'Skull fragment', cx, cy);
          if (d.id === 4) { setF('arc:ch2:race'); S.race?.end(); await say('Got it! The eye socket. It\'s... warm?', 'happy', 2400); void startChase(f, S, r, 0); return; }
          const n = DIGS.filter(q => F('arc:ch2:dug' + q.id)).length;
          await say(n === 1 ? `${d.name[0].toUpperCase()}${d.name.slice(1)}. Teeth like tent pegs.` : n === 2 ? 'Two pieces. They fit. They actually FIT.' : 'Three... but the eye\'s missing. It must have rolled down the scree.', 'happy', 2800);
          if (n === 3 && !F('arc:ch2:race')) setTimeout(() => void startRace(f, S), 1800);
        } finally { S.busy = false; }
      },
    } as never);
  }
  // ---------------------------------------------------------------- the skull, once laid out
  const sk = sprite('arc2:skull', () => giantSkull(5));
  if (sk) {
    const y = fossilGround(SKULL_X) + 2;
    S.skull = new Prop(sk.f, SKULL_X, y, -1.3, { foliage: false });
    S.skull.hidden = !F('arc:ch2:done');
    f.main.add(S.skull);
    if (sk.g) {
      const g = sk.g;
      f.main.add(new Custom(-1.25, (rr, st) => {
        if (S.skull?.hidden) return;
        const k = 0.7 + 0.3 * Math.sin(st.time * 1.6);
        rr.emissive(1); rr.draw(g, SKULL_X, y, 1, 1, 0, packColor(1, 1, 1, k)); rr.emissive();
        rr.light(SKULL_X + 11, y - 16, 34, 0.4, 1, 0.8, 0.6 * k, 0.2);
      }));
    }
  }
  // ---------------------------------------------------------------- hints, ticking
  const hint = hints(f, [
    { id: 'arc:ch2:h:1', x: DIGS[0].x, text: 'Bone, showing in the dirt. Big bone.' },
    { id: 'arc:ch2:h:2', x: DIGS[1].x, text: 'Out here, under the falling rocks. Of course it is.' },
    { id: 'arc:ch2:h:3', x: DIGS[2].x, text: 'Something curved in the gravel by the river. That\'s not a stone.' },
  ]);
  f.main.add(new Custom(0, () => {}, dt => {
    if (game.scene !== (f as never)) return;
    if (active('arc_ch2') && F('arc:ch2:arrived')) hint(dt);
    S.race?.tick(dt);
    S.chase?.tick(dt);
  }));
  const ex = f.exit.bind(f);
  f.exit = () => { S.race?.end(); S.chase?.dispose(); ex(); };
  if (active('arc_ch2') && !F('arc:ch2:arrived')) void arrive(f);
  else if (active('arc_ch2') && F('arc:ch2:dug1') && F('arc:ch2:dug2') && F('arc:ch2:dug3') && !F('arc:ch2:race') && !F('arc:ch2:beatVarga')) setTimeout(() => void startRace(f, S), 3000);
  else if (active('arc_ch2') && F('arc:ch2:race') && !F('arc:ch2:escaped')) setTimeout(() => { void say('The scree\'s still settling up there. Careful.', 'think', 2400); }, 2500);
  else if (active('arc_ch2') && F('arc:ch2:escaped') && !F('arc:ch2:done')) setTimeout(() => void payoff(f, S), 2500);
  // (a scree that let go stays let go: the chase can be rerun from the top of it)
  if (active('arc_ch2') && F('arc:ch2:race') && !F('arc:ch2:escaped')) {
    (f.interact as Interactable[]).push({
      x: LAST_X, y: fossilGround(LAST_X) - 10, w: 18, h: 20, standX: LAST_X - 20, label: 'Pick a way down the loose scree',
      enabled: () => !S.chase && !F('arc:ch2:escaped'), action: () => { void startChase(f, S, r, 0); },
    } as never);
  }
}

async function arrive(f: FieldScene) {
  await sleep(2600);
  if (game.scene !== (f as never)) return;
  await floatSky('The Fossil Wall', 'Te Pakitara Iwi', 'Te Ara Matatū · Chapter 2', 3600);
  setF('arc:ch2:arrived');
  await say('Hold the rubbing up against the cliff... the eye on it isn\'t an eye. It\'s an eye SOCKET.', 'happy', 3200);
  await aroha(f, 'A skull. In pieces, all through the gorge. The rock\'s been giving it back a bit at a time.', 'say', 3400);
}

// ------------------------------------------------------------------ the race to the last piece

class Race {
  t = 0;
  phase: 'walk' | 'dig' | 'done' = 'walk';
  dig = 0;
  moriWon = false;
  private watch: { set(t: number): void; close(): void } | null = null;
  private dustT = 0;
  /** where she kneels to dig, and the whole race's length (her walk and her dig) */
  readonly stand: number;
  readonly total: number;
  constructor(readonly f: FieldScene, readonly S: Ch2, readonly v: Actor) {
    this.stand = LAST_X + (v.x > LAST_X ? 16 : -16);
    this.total = Math.abs(v.x - this.stand) / VARGA_WALK + VARGA_DIG;
    void import('../../../ui/v12/watch').then(W => {
      if (this.phase === 'done') return;
      this.watch = W.showWatch({ mode: 'countdown', manual: true, secs: Math.round(this.total), size: 26, anchor: () => { const [x, y] = this.f.css(this.v.x, this.v.y - 78); return [x, y]; } });
      this.watch.set(1);
    });
    void v.walkTo(this.stand, VARGA_WALK, 'walk');
  }
  tick(dt: number) {
    if (this.phase === 'done') return;
    const f = this.f, p = f.player, v = this.v;
    this.t += dt;
    const left = this.phase === 'walk' ? (Math.abs(v.x - this.stand) / VARGA_WALK + VARGA_DIG) : VARGA_DIG * (1 - this.dig);
    this.watch?.set(clamp(left / this.total));
    // Mori gets there first: the race is his
    if (Math.abs(p.x - LAST_X) < 22 && Math.abs(p.y - fossilGround(LAST_X)) < 22) { this.win(); return; }
    if (this.phase === 'walk' && !v.walking) {
      this.phase = 'dig';
      v.faceTo(LAST_X);
      v.setAnim('kneelWork');
      void by(f, 'celeste', 'Thank you for the map, Mori. Helix appreciates it.', 'say', 2600);
    }
    if (this.phase === 'dig') {
      this.dig += dt / VARGA_DIG;
      this.dustT -= dt;
      if (this.dustT <= 0) { this.dustT = 0.3; audio.play('dig', { vol: 0.25 }); for (let i = 0; i < 4; i++) f.main.particles.spawn({ frame: A.dot2, x: LAST_X + rand.range(-6, 6), y: fossilGround(LAST_X) - 2, vx: rand.range(-30, 30), vy: rand.range(-50, -20), ay: 200, life: 0.6, color: [0.62, 0.5, 0.4], alpha: 0.9, alpha1: 0.3, floorY: fossilGround(LAST_X) + 1 }); }
      if (this.dig >= 1) this.lose();
    }
  }
  private win() {
    this.moriWon = true;
    setF('arc:ch2:beatVarga');
    this.phase = 'done';
    this.watch?.close();
    this.v.stopWalk();
    this.v.setAnim('idle');
    this.v.faceTo(this.f.player.x);
    audio.play('star', { vol: 0.5 });
    game.save.rp += 40; game.save.totalRp += 40; game.persist();
    void (async () => {
      await say('MINE. Mine mine mine. Sorry. But mine.', 'happy', 2200);
      await by(this.f, 'celeste', 'Fine. Dig, then. Let\'s see if your hands are as quick as your feet.', 'say', 2800);
    })();
  }
  private lose() {
    this.phase = 'done';
    this.watch?.close();
    this.v.setAnim('idle');
    setF('arc:ch2:race');
    setF('arc:ch2:dug4');
    if (this.S.lastProp && this.S.lastDug) this.S.lastProp.frame = this.S.lastDug;
    void (async () => {
      await by(this.f, 'celeste', 'There. The orbit. Beautiful. Too slow, Mori.', 'say', 2400);
      await sleep(400);
      audio.play('rustle', { vol: 0.8, pitch: 0.5 });
      await by(this.f, 'celeste', '...why is the ground moving?', 'scared', 1600);
      void startChase(this.f, this.S, null, 0);
    })();
  }
  end() { this.phase = 'done'; this.watch?.close(); }
}

async function startRace(f: FieldScene, S: Ch2) {
  if (S.race || F('arc:ch2:race') || F('arc:ch2:beatVarga') || game.scene !== (f as never)) return;
  (await import('../../../art/v11/npcs/register')).registerNpcArt();
  // she comes in from whichever end of the gorge is the far side of the scree from Mori
  const vx = f.player.x < LAST_X ? 1120 : VARGA_X0;
  const v = S.varga ?? f.addActor('celeste', vx, fossilGround(vx), vx > LAST_X ? -1 : 1);
  v.z = 44; v.visible = true;
  S.varga = v;
  if (S.lastProp) S.lastProp.hidden = false;
  audio.setMusic('tension');
  await by(f, 'celeste', 'Mori! Dr Celeste Varga, Helix Bioprospecting. You left a very clear trail.', 'say', 3000);
  await by(f, 'celeste', 'The last piece is up on the scree. I\'ll be taking it. Helix will be taking it.', 'say', 3000);
  await say('Oh, no you DON\'T.', 'shout', 1600);
  S.race = new Race(f, S, v);
}

// ------------------------------------------------------------------ the rockfall down the scree

class Chase {
  t = 0;
  bx: number;
  by = 0;
  bv = 0;
  spin = 0;
  ended = false;
  private falls: { x: number; t: number; done: boolean; spr: Frame | null }[] = [];
  private fallT = 1.4;
  private rocks: Frame[] = [];
  private boulder: Frame | null = null;
  private drawn: Custom;
  private unLate: (() => void) | null = null;
  private slip: { h: { x0: number; x1: number }; x0: number; x1: number } | null = null;
  constructor(readonly f: FieldScene, readonly S: Ch2, readonly run: TripRun | null, readonly fails: number) {
    this.bx = LAST_X + 170;
    for (let i = 0; i < 6; i++) { const s = sprite(`arc2:rock:${i}`, () => rock(60 + i, 5 + i * 1.8)); if (s) this.rocks.push(s.f); }
    this.boulder = sprite('arc2:boulder', () => rock(77, 28))?.f ?? null;
    this.drawn = new Custom(57, r => this.render(r));
    f.main.add(this.drawn);
    // (the loose scree that trips sprinters is all moving at once now: no slipping, just running)
    const hz = (run as unknown as { hazards?: { kind: string; x0: number; x1: number }[] } | null)?.hazards?.find(h => h.kind === 'slip');
    if (hz) { this.slip = { h: hz, x0: hz.x0, x1: hz.x1 }; hz.x0 = hz.x1 = -9999; }
    void this.start();
  }
  private async start() {
    const f = this.f, cine = await import('../../v11/cine');
    audio.setMusic('tension');
    audio.play('thunderClose', { vol: 0.8, pitch: 0.5 });
    cine.cineShake(8, 1.2);
    cine.cineSlowmo(0.3);
    if (f.guide) void aroha(f, 'THE WHOLE SLOPE! RUN, MORI!', 'shout', 1800);
    if (this.S.varga) { const v = this.S.varga; v.visible = true; void v.walkTo(80, 112, 'run'); }
    await sleep(1000);
    cine.cineSlowmo(1, 0.5);
    void say(this.fails ? 'Again. GO.' : 'Boulder. BOULDER!', 'scared', 1600);
    this.unLate = lateTick(f, () => {
      if (this.ended) return;
      audio.setDanger(0.9);
      audio.setHeartbeat(clamp(1 - (this.bx - f.player.x) / 260, 0.3, 1));
    });
  }
  tick(dt: number) {
    if (this.ended) return;
    const f = this.f, p = f.player;
    this.t += dt;
    // the boulder: bounding down the slope, picking up speed; faster than a walk, a hair slower than a sprint
    const top = Math.max(66, 92 - this.fails * 7);
    this.bv = this.t < 1 ? 0 : Math.min(top, this.bv + 70 * dt);
    this.bx -= this.bv * dt;
    const R = 13, hop = Math.abs(Math.sin(this.t * 3.1)) * (this.bv > 20 ? 6 : 0);
    this.by = fossilGround(this.bx) - R - hop;
    this.spin -= (this.bv * dt) / R;
    if (hop < 0.6 && this.bv > 20 && rand.chance(dt * 8)) { f.st.shake(1.6, 0.2); audio.play('land', { vol: 0.35, pitch: 0.5 }); for (let i = 0; i < 5; i++) f.main.particles.spawn({ frame: A.dot2, x: this.bx + rand.range(-8, 8), y: fossilGround(this.bx) - 1, vx: rand.range(-40, 40), vy: rand.range(-60, -20), ay: 260, life: 0.7, color: [0.62, 0.52, 0.42], alpha: 0.9, alpha1: 0.2, floorY: fossilGround(this.bx) + 1 }); }
    // stones raining ahead
    this.fallT -= dt;
    if (this.fallT <= 0 && this.t > 1.5) {
      this.fallT = rand.range(0.7, 1.2);
      const x = clamp(p.x - rand.range(30, 120), SAFE_X + 20, this.bx - 30);
      this.falls.push({ x, t: 0, done: false, spr: this.rocks[rand.int(0, this.rocks.length - 1)] ?? null });
    }
    for (const q of this.falls) {
      q.t += dt;
      if (q.t < 0.8 && rand.chance(dt * 18)) f.main.particles.spawn({ frame: A.dot2, x: q.x + rand.range(-3, 3), y: fossilGround(q.x) - 150, vx: rand.range(-4, 4), vy: rand.range(60, 110), ay: 300, life: 0.6, color: [0.7, 0.6, 0.48], alpha: 0.9, alpha1: 0.4, floorY: fossilGround(q.x) });
      if (q.t >= 1 && !q.done) {
        q.done = true;
        f.sfx('land', q.x, 0.7, 0.7);
        if (Math.abs(p.x - q.x) < 10 && p.y > fossilGround(q.x) - 30) hitMori(f, q.x + 5, { sev: 1 });
      }
    }
    this.falls = this.falls.filter(q => q.t < 1.3);
    if (isWinded() && this.bx - p.x < 140 && !this.f.cutscene && rand.chance(dt * 0.5)) void say('Can\'t... breathe...', 'scared', 1200);
    if (this.bx - R <= p.x + 3) { void this.caught(); return; }
    if (p.x <= SAFE_X) void this.clear();
  }
  private render(r: Renderer) {
    if (this.ended) return;
    for (const q of this.falls) {
      const k = Math.min(1, q.t), y = Math.round(fossilGround(q.x)), w = 2 + Math.round(k * 5);
      for (let i = -w; i <= w; i++) if ((i & 1) === 0 || k > 0.6) r.rect(Math.round(q.x) + i, y - 1, 1, 1, packColor(0.05, 0.03, 0.02, 0.3 + k * 0.4));
      if (q.t > 0.78 && q.t < 1 && q.spr) r.draw(q.spr, q.x, y - 3 - (1 - (q.t - 0.78) / 0.22) * 150, 1, 1, q.t * 8, packColor(1, 1, 1, 1));
    }
    if (this.boulder) r.draw(this.boulder, this.bx, this.by, 1, 1, this.spin, packColor(1, 1, 1, 1));
    // the slope coming down behind it: a billowing sheet of dust
    if (this.t > 1) drawDust(r, this.bx + 8, fossilGround, -1, this.t, { h: 70, w: 90, col: [0.58, 0.49, 0.4] });
  }
  private async caught() {
    if (this.ended) return;
    const f = this.f, p = f.player;
    this.stop();
    hitMori(f, this.bx + 8, { sev: 3 });
    await sleep(900);
    await game.fadeTo(1, 1.2);
    await floatCaption('The scree buries him to the chest. It takes Aroha and a long stick to dig him out. They climb back up and pick another line down.', 3400);
    p.x = LAST_X - 4; p.y = fossilGround(p.x); p.facing = -1; p.vx = 0; p.state = 'normal'; p.poseOverride = null;
    if (this.S.varga) { this.S.varga.x = LAST_X + 20; this.S.varga.y = fossilGround(LAST_X + 20); }
    await game.fadeTo(0, 1.6);
    if (game.scene !== (f as never)) return;
    this.S.chase = new Chase(f, this.S, this.run, this.fails + 1);
  }
  private async clear() {
    if (this.ended) return;
    const f = this.f, cine = await import('../../v11/cine');
    this.stop();
    cine.cineSlowmo(0.3);
    cine.cineShake(11, 1.2);
    audio.play('thunderClose', { vol: 0.9, pitch: 0.4 });
    for (let i = 0; i < 30; i++) f.main.particles.spawn({ frame: A.dot2, x: 150 + rand.range(-10, 30), y: fossilGround(150) - rand.range(4, 30), vx: rand.range(-80, 90), vy: rand.range(-120, -20), ay: 280, life: 1.2, color: [0.6, 0.52, 0.44], alpha: 1, alpha1: 0.2, floorY: fossilGround(150) + 2 });
    setF('arc:ch2:escaped');
    await sleep(900);
    cine.cineSlowmo(1, 0.6);
    await say('It hit the rock. It hit the ROCK and not me.', 'scared', 2400);
    setTimeout(() => void payoff(f, this.S), 1800);
  }
  private stop() {
    this.ended = true;
    this.unLate?.();
    audio.setHeartbeat(0);
    audio.setDanger(0);
    audio.setMusic((this.f.site as { music?: Parameters<typeof audio.setMusic>[0] }).music ?? 'wonder');
    this.drawn.fn = () => {};
    if (this.slip) { this.slip.h.x0 = this.slip.x0; this.slip.h.x1 = this.slip.x1; this.slip = null; }
  }
  dispose() { if (!this.ended) this.stop(); }
}

async function startChase(f: FieldScene, S: Ch2, r: TripRun | null, fails: number) {
  if (S.chase && !S.chase.ended) return;
  const run = r ?? (await import('../../v10/field10')).run;
  S.chase = new Chase(f, S, run, fails);
}

// ------------------------------------------------------------------ the payoff: the skull laid out
let paying = false;
async function payoff(f: FieldScene, S: Ch2) {
  if (paying || F('arc:ch2:done') || game.scene !== (f as never)) return;
  paying = true;
  f.cutscene = true;
  try {
    const v = S.varga;
    if (v) {
      v.faceTo(f.player.x);
      if (!F('arc:ch2:beatVarga')) {
        await by(f, 'celeste', 'You... shoved me out of its way. Up there. You didn\'t have to.', 'say', 2800);
        await by(f, 'celeste', 'Take it. The orbit. Helix can have the photographs. Don\'t tell anyone I said that.', 'say', 3200);
        if (count('arc_bone') < 4) give('arc_bone', 4 - count('arc_bone'));
      } else {
        await by(f, 'celeste', 'Hmph. Fast AND lucky. Fine. I want a copy of every photo.', 'say', 2800);
      }
    }
    await game.fadeTo(1, 1.4);
    await floatCaption('On the gravel by the river they lay the four pieces out, edge to edge. They fit.', 3000);
    remove('arc_bone', count('arc_bone'));
    if (S.skull) S.skull.hidden = false;
    await game.fadeTo(0, 1.4);
    await say('A taniwha skull. Longer than I am tall. And look in the eye socket...', 'whisper', 3000);
    await aroha(f, 'It\'s glowing. That green... that\'s the light down the cleft. Te Ngahere Kānapanapa.', 'whisper', 3400);
    await aroha(f, 'It stays here with the rock it came from. We take the photographs, and we take the way.', 'say', 3200);
    if (v) { await by(f, 'celeste', 'The glowing forest. Of course it is. ...Be careful down there, Mori.', 'say', 2600); void v.walkTo(-40, 60).then(() => { v.visible = false; }); }
    rumour('glowforest');
    addNote({ id: 'note:arc:ch2', loc: 'fossils', x: SKULL_X, text: 'The taniwha skull, laid out by the river. A green mineral glows in its eye: the light of the valley below the cleft.' });
    setF('arc:ch2:done');
  } finally { f.cutscene = false; paying = false; }
}

