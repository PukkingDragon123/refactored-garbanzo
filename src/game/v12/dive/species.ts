// V12 Te Moana Rimurimu, the kelp-forest dive's life: the animals in the water and their minds. The scene
// (./scene.ts) fills DIVE_CTX and calls installDiveLife(f) once; everything here meets the rest of the
// dive only through DIVE_CTX (./ctx.ts): the spearable fish register a Spearable, the sharks a Charger,
// and they listen to DIVE_CTX.onCatch. Field-guide entries, items and art registration: ./lifeguide.ts.
//
//   Glasseye Whaler (x2, around spots.sharkPatrol: the drop-off and the blue)
//     patrol -> a fish taken within ~900 px (or Mori carrying catch into its water) -> investigate ->
//     circle (a wide horizontal orbit round Mori, passing in front of and behind him, turning at each
//     end) -> the hunch (the tell: back humped, pectorals down; threatening = true) -> charge
//     (threatening = true) -> a hit bumps Mori (hitMori, never lethal) and steals the last catch, it
//     makes off with the fish in its jaws; a miss veers off and comes round again (twice at most).
//     repel() (the speargun's bang-head shot): it veers off hard and ignores him for ~20 s. It never
//     swims into thick kelp (kelpAt > 0.5): Mori in the kelp is out of reach, and it gives up after a
//     few seconds. Only one shark presses an attack at a time.
//     Photo: patrolling, circling, warning (the hunch), charging, stealing, veering.
//   Corvex Seals (a pod of 3, spots.sealPlay, the kelp shallows)
//     play: swooping loops through the open water between the groves, glides and swim strokes, now and
//     then a barrel roll (with a corkscrew of bubbles); one comes to look at Mori: it blows bubbles at
//     him face on, then copies him (it swims where he swims; when he stops it hangs upright, head
//     cocked); a fish taken near the pod, or a long mimic beside a diver with catch, and one darts in,
//     snatches a fish out of the catch and swims off with it in its beak.
//     Photo: swimming, barrelroll, bubbles, mimicking, stealing.
//   Hāpuku (spots.groperCave): deep in its cave until Mori keeps still nearby: after ~4 s it peers out,
//     after ~8 s it comes to the mouth and hangs there (gaping now and then). Move fast or crowd it and
//     it backs into the dark. Photo: hiding, peering, guarding, gaping.
//   Kingfish school (7, spots.kingfish): a loose school looping through the reef's mid-water; spook ->
//     the school darts off together. Spearable ('kingfish_fillet'). Photo: schooling, darting, cruising.
//   Blue cod (4, spots.cod): propped on the reef by the boulders, hopping to new perches; a still diver
//     brings one over to look. Spearable ('blue_cod'). Photo: resting, curious, swimming.
//   Ocean sunfish (spots.sunfish) with 3 crimson cleanerfish pecking at it. Photo: drifting, cleaned,
//     turning; cleaners: cleaning, swimming.
//   Eagle ray (spots.ray): flies and glides over the sand channel, stops to dig. Photo: flying, gliding,
//     feeding, turning.
//
// Frames are rendered once (src/art/v12/dive/*, the seal's swim anims) into the scene atlas, a few each
// update in the background, the pod's at install.

import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { drawTrail, type TrailOpts } from '../../../gfx/trails';
import type { Drawable } from '../../../world/stage';
import type { Animal } from '../../wild/animal';
import type { SpeciesDef } from '../../../art/beasts-core';
import { local, A } from '../../assets';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { clamp, rand } from '../../../core/math';
import { renderBeastRaw } from '../../../art/beasts';
import { GLASSEYE, SHARK_LEN } from '../../../art/v12/dive/shark';
import { HAPUKU, KINGFISH, BLUECOD, SUNFISH, CLEANER, diveFishHeld } from '../../../art/v12/dive/bigfish';
import { EAGLERAY } from '../../../art/v12/dive/ray';
import { CORVEXSEAL, SEAL_SWIM_ANIMS } from '../../../art/v9/shore/seal';
import { DIVE_CTX, KELP_ZONES } from './ctx';
import type { Spearable, Charger } from './ctx';
import { SHARK_ID, HAPUKU_ID, KING_ID, COD_ID, SUN_ID, CLEAN_ID, RAY_ID, SEAL_ID, KING_ITEM, COD_ITEM } from './lifeguide';
import { hitMori } from '../wilds';
import { floatText } from '../../../ui/v12/float';
import type { FloatStyle } from '../../../ui/v12/float';
import { ITEMS } from '../../items';
import { ReefFish } from '../../sites10/oceanreef';
import { cineFocusOn, cineRelease } from '../../v11/cine';

type V2 = [number, number];
const TAU = Math.PI * 2;
const DEFS: Record<string, SpeciesDef> = {
  [SHARK_ID]: GLASSEYE, [HAPUKU_ID]: HAPUKU, [KING_ID]: KINGFISH, [COD_ID]: BLUECOD, [SUN_ID]: SUNFISH, [CLEAN_ID]: CLEANER, [RAY_ID]: EAGLERAY, [SEAL_ID]: CORVEXSEAL,
};

// ==================================================================== frames
interface DF { fr: Frame; w: number; h: number; ax: number; ay: number; pts: V2[]; head: V2 }
const cache = new Map<string, DF>();
let owner: unknown = null;
function dframe(id: string, anim: string, f: number): DF {
  if (owner !== local) { cache.clear(); owner = local; warmQ.length = 0; }
  const key = `${id}|${anim}|${f}`;
  let c = cache.get(key);
  if (c) return c;
  const def = DEFS[id];
  const raw = renderBeastRaw(id as never, anim, f, def.eyeFor?.(anim, f) ?? 'open');
  const t = raw.buf.trim(1);
  const b = t.buf, ax = raw.ox - t.ox, ay = raw.oy - t.oy;
  const pts: V2[] = [];
  const st = Math.max(2, Math.floor(Math.min(b.w, b.h) / 5));
  for (let y = 1; y < b.h; y += st) for (let x = 1; x < b.w; x += st) if (b.data[y * b.w + x] >>> 24 > 100) pts.push([x - ax, y - ay]);
  if (!pts.length) pts.push([0, 0]);
  c = { fr: local.add('dive:' + key, b, ax, ay), w: b.w, h: b.h, ax, ay, pts, head: [raw.head[0] - raw.ox, raw.head[1] - raw.oy] };
  cache.set(key, c);
  return c;
}
const warmQ: [string, string, number][] = [];
let warmTick = 0;
function queueWarm(id: string, anims?: string[]) {
  const def = DEFS[id];
  for (const a of anims ?? Object.keys(def.anims)) for (let i = 0; i < def.anims[a].frames; i++) warmQ.push([id, a, i]);
}
/** render one queued frame every few updates (a frame of the big animals takes 10-40 ms), so the
 *  background warming never stalls two updates running */
function warmStep() {
  if (++warmTick % 4) return;
  while (warmQ.length) {
    const [id, a, i] = warmQ.shift()!;
    if (!cache.has(`${id}|${a}|${i}`)) { dframe(id, a, i); return; }
  }
}
const cached = (id: string, anim: string, f: number) => cache.get(`${id}|${anim}|${f}`) ?? null;
let heldFr: { owner: unknown; fr: Frame } | null = null;
/** a kingfish crosswise in a shark's jaws */
function heldFish(): Frame {
  if (heldFr?.owner === local) return heldFr.fr;
  const h = diveFishHeld(KING_ID, 34, 0.45, 0.55);
  heldFr = { owner: local, fr: local.add('dive:held', h.buf, h.ax, h.ay) };
  return heldFr.fr;
}

// ==================================================================== shared helpers
const C = () => DIVE_CTX;
/** Mori's middle (the swim pose lies along his feet line) */
const moriAt = (f: FieldScene): V2 => [f.player.x, f.player.y - 28];
const inWater = (f: FieldScene) => f.player.y > C().surfaceY + 12;
const moriSpeed = (f: FieldScene) => Math.hypot(f.player.vx, f.player.vy);
const kelp = (x: number, y: number) => C().kelpAt(x, y);
const floorY = (x: number) => C().floorAt(x);
function bubbles(f: FieldScene, x: number, y: number, n: number, spread = 3) {
  for (let i = 0; i < n; i++) {
    f.main.particles.spawn({ frame: A.dot2, x: x + rand.range(-spread, spread), y: y + rand.range(-2, 2), vx: rand.range(-5, 5), vy: rand.range(-46, -26), life: rand.range(1.4, 2.6), color: [0.85, 0.97, 1], alpha: 0.85, alpha1: 0.15, wobble: 4, wobbleF: 2.4, floorY: C().surfaceY + 2, onFloor: 'die' });
  }
}
function sandPuff(f: FieldScene, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) f.main.particles.spawn({ frame: A.dot2, x: x + rand.range(-8, 8), y: y - 1, vx: rand.range(-26, 26), vy: rand.range(-22, -6), drag: 1.6, ay: 6, life: rand.range(1.2, 2.2), color: [0.82, 0.76, 0.6], alpha: 0.75, alpha1: 0 });
}
/** a line Mori says the first time (once per save) */
let lastLine = -99;
function firstLine(f: FieldScene, flag: string, text: string, style: FloatStyle = 'say') {
  const k = 'dive:said:' + flag;
  if (game.save.flags[k]) return;
  // one at a time: a line that would talk over the last waits for the next chance
  if (f.time - lastLine < 7 && f.time >= lastLine) return;
  lastLine = f.time;
  game.save.flags[k] = true;
  game.persist();
  void floatText({ text, style, ms: 3200 });
  void f;
}

// ==================================================================== the base of every dive animal
/** afterimages: a cruise never trails, a dart or a charge (the shark's is 205 px/s) does; blue-green wash */
const DIVE_TRAIL: TrailOpts = { min: 120, full: 200, tint: 0xa8e0e8 };
abstract class DiveBeast implements Drawable {
  z = 40; p = 1; py = 1;
  vx = 0; vy = 0; facing: 1 | -1 = 1;
  dead = false; gone = false; hidden = 0; noticed = false; juvenile = false;
  speed = 0; act = 'swim'; anger = 0; fear = 0; aw = 0; threat: unknown = null;
  medium = 'water' as const; scale = 1; habit = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  mem: Record<string, number> = {};
  behavior: string | null = null;
  anim = 'idle'; animT = 0; rot = 0; tint = packColor(1, 1, 1, 1);
  /** the turn: 0 none, else seconds into it (the art's turn anim forward, flip, back) */
  turnT = 0; turnTo: 1 | -1 = 1;
  body: { bounds: (a: DiveBeast) => { x0: number; y0: number; x1: number; y1: number }; points: (a: DiveBeast) => V2[]; head: (a: DiveBeast) => V2; update: () => void; draw: () => void };
  constructor(readonly species: string, readonly f: FieldScene, public x: number, public y: number) {
    this.body = { bounds: a => a.box(), points: a => a.pts(), head: a => a.headAt(), update: () => {}, draw: () => {} };
  }
  showEmote(): void {}
  get def() { return DEFS[this.species]; }
  setAnim(a: string) { if (a !== this.anim) { this.anim = a; this.animT = 0; } }
  /** the frame index the anim is on */
  fi(): number {
    const A0 = this.def.anims[this.anim] ?? this.def.anims.idle;
    const n = A0.frames, k = Math.floor(this.animT * A0.fps);
    return A0.loop ? k % n : Math.min(n - 1, k);
  }
  animDone() { const A0 = this.def.anims[this.anim]; return !A0.loop && this.animT * A0.fps >= A0.frames; }
  cur(): DF {
    if (this.turnT > 0 && this.def.anims.turn) {
      const n = this.def.anims.turn.frames, half = this.turnHalf();
      const k = this.turnT < half ? this.turnT / half : 2 - this.turnT / half;
      return dframe(this.species, 'turn', Math.max(0, Math.min(n - 1, Math.floor(k * n))));
    }
    return dframe(this.species, this.anim, this.fi());
  }
  turnHalf() { return 0.32; }
  /** start turning to face d (the turn anim, if the species has one, else a plain flip) */
  face(d: 1 | -1) {
    if (d === this.facing || this.turnT > 0) return;
    if (!this.def.anims.turn) { this.facing = d; return; }
    this.turnT = 1e-3; this.turnTo = d;
  }
  tickTurn(dt: number) {
    if (this.turnT <= 0) return;
    const half = this.turnHalf();
    const was = this.turnT;
    this.turnT += dt;
    if (was < half && this.turnT >= half) this.facing = this.turnTo;
    if (this.turnT >= half * 2) this.turnT = 0;
  }
  /** the frame on screen now (painted on first use); the camera, the spear and the bounds read
   *  lastF, so an animal far off screen never forces a paint */
  lastF: DF | null = null;
  near(): DF {
    if (this.turnT > 0 && this.def.anims.turn) return this.lastF ?? this.cur();
    return cached(this.species, this.anim, this.fi()) ?? this.lastF ?? this.cur();
  }
  box() {
    const d = this.near();
    const x0 = this.facing > 0 ? this.x - d.ax : this.x - (d.w - d.ax);
    return { x0, x1: x0 + d.w, y0: this.y - d.ay, y1: this.y - d.ay + d.h };
  }
  pts(): V2[] { const d = this.near(); return d.pts.map(([x, y]) => [this.x + x * this.facing, this.y + y] as V2); }
  headAt(): V2 { const d = this.near(); return [this.x + d.head[0] * this.facing, this.y + d.head[1]]; }
  photoInfo() {
    return { species: this.species, behavior: this.hidden > 0.85 ? null : this.behavior, box: this.box(), pts: this.pts(), speed: this.speed, facing: this.facing, noticed: this.noticed, juvenile: false, p: 1, hidden: this.hidden };
  }
  /** steer the velocity toward (tx, ty) at speed sp, with acceleration acc */
  steer(tx: number, ty: number, sp: number, acc: number, dt: number) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.min(sp, d * 1.6);
    this.vx += clamp((dx / d) * want - this.vx, -acc * dt, acc * dt);
    this.vy += clamp((dy / d) * want - this.vy, -acc * dt, acc * dt);
    return d;
  }
  /** move by the velocity, kept between the surface and the floor (pad px off each) */
  move(dt: number, padTop = 20, padBot = 14) {
    this.x = clamp(this.x + this.vx * dt, 20, KELP_ZONES.W - 20);
    this.y += this.vy * dt;
    const top = C().surfaceY + padTop, bot = floorY(this.x) - padBot;
    if (this.y < top) { this.y = top; if (this.vy < 0) this.vy *= 0.3; }
    if (this.y > bot) { this.y = bot; if (this.vy > 0) this.vy *= 0.3; }
    this.speed = Math.hypot(this.vx, this.vy);
  }
  /** turn to face the way it's swimming */
  faceVel(min = 6) { if (Math.abs(this.vx) > min) this.face(this.vx > 0 ? 1 : -1); }
  abstract think(dt: number): void;
  update(dt: number) {
    if (this.gone) return;
    this.think(dt);
    this.tickTurn(dt);
    this.animT += dt;
  }
  draw(r: Renderer) {
    if (this.gone) return;
    if (this.x < r.visibleX0(220) || this.x > r.visibleX1(220)) return;
    const d = this.cur();
    this.lastF = d;
    // a charge, a seal's dart or a bolting fish leaves afterimages (src/gfx/trails.ts)
    drawTrail(r, this, this.x, this.y, () => r.draw(d.fr, Math.round(this.x), Math.round(this.y), this.facing, 1, this.rot * this.facing, this.tint), DIVE_TRAIL);
    this.post?.(r);
  }
  post?(r: Renderer): void;
  /** pitch the sprite along its course (radians, nose down +), eased */
  pitchTo(k: number, max: number, dt: number) {
    const want = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 12) * k, -max, max);
    this.rot += (want - this.rot) * Math.min(1, dt * 4);
  }
}
const asAnimal = (b: DiveBeast) => b as unknown as Animal;

// ==================================================================== the Glasseye Whaler
type SharkSt = 'patrol' | 'investigate' | 'circle' | 'hunch' | 'charge' | 'bite' | 'steal' | 'veer' | 'cool';
let engaged: Shark | null = null;
class Shark extends DiveBeast implements Charger {
  st: SharkSt = 'patrol';
  stT = 0;
  threatening = false;
  cool = 0;
  passes = 0;
  lost = 0;
  wp: V2;
  orbitA = 0; orbitDir: 1 | -1 = 1; orbitR = 170;
  chargeTo: V2 = [0, 0];
  carry = 0;
  interest: V2 | null = null;
  constructor(f: FieldScene, x: number, y: number, readonly range: [number, number], readonly shy: number) {
    super(SHARK_ID, f, x, y);
    this.eco.attacksPlayer = 1;
    this.eco.aggro = 0.6;
    this.wp = this.pickWp();
    this.setAnim('swim');
  }
  turnHalf() { return this.st === 'charge' ? 0.18 : 0.3; }
  private pickWp(): V2 {
    const x = rand.range(this.range[0], this.range[1]);
    const top = C().surfaceY + 110, bot = floorY(x) - 40;
    return [x, rand.range(top, Math.max(top + 10, bot))];
  }
  private go(st: SharkSt) { this.st = st; this.stT = 0; }
  /** a speared fish struggling within earshot */
  hear(x: number, y: number) {
    if (this.cool > 0 || this.st !== 'patrol') return;
    // the thrashing of a speared fish carries a long way: the nearer shark comes up onto the reef for it
    if (Math.hypot(x - this.x, y - this.y) > 1500 * (1 - this.shy * 0.5)) return;
    if (engaged && engaged !== this) return;
    this.interest = [x, y];
    this.go('investigate');
  }
  repel(fromX: number, _fromY: number): void {
    if (this.st === 'cool' && this.cool > 15) return;
    this.cool = 20;
    this.threatening = false;
    this.vx = Math.sign(this.x - fromX || this.facing) * 170;
    this.vy = -60;
    this.go('veer');
    this.setAnim('veer');
    audio.play('whoosh', { vol: 0.5 });
    bubbles(this.f, this.x, this.y, 8, 10);
    if (engaged === this) engaged = null;
  }
  /** move, but never into thick kelp (it slides along the edge instead) */
  private swimMove(dt: number) {
    const x0 = this.x, y0 = this.y;
    this.move(dt, 34, 30);
    const head = this.x + this.facing * SHARK_LEN * 0.4;
    if (kelp(head, this.y) > 0.5 || kelp(this.x, this.y) > 0.5) {
      // back out: try the vertical move alone, then the horizontal, else hold position
      if (kelp(x0 + this.facing * SHARK_LEN * 0.4, this.y) <= 0.5 && kelp(x0, this.y) <= 0.5) this.x = x0;
      else if (kelp(head, y0) <= 0.5 && kelp(this.x, y0) <= 0.5) this.y = y0;
      else { this.x = x0; this.y = y0; }
      this.vx *= 0.5; this.vy *= 0.5;
    }
  }
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f);
    this.stT += dt;
    this.cool = Math.max(0, this.cool - dt);
    const dM = Math.hypot(mx - this.x, my - this.y);
    const hidden = kelp(mx, my) > 0.5 || !inWater(f);
    this.threatening = this.st === 'hunch' || this.st === 'charge';
    this.anger = this.st === 'circle' ? 0.5 : this.threatening ? 1 : 0;
    this.act = this.st === 'hunch' ? 'threat' : this.st === 'charge' ? 'attack' : 'swim';
    if (dM < 520 && inWater(f)) firstLine(f, 'shark', 'Shark. A big one... and that pale eye. Stay calm. Stay near the kelp.', 'whisper');
    switch (this.st) {
      case 'patrol': case 'cool': {
        this.behavior = 'patrolling';
        this.setAnim('swim');
        if (this.st === 'cool' && this.cool <= 0) this.go('patrol');
        if (this.steer(this.wp[0], this.wp[1], 34, 26, dt) < 40) this.wp = this.pickWp();
        // it smells catch on a diver swimming through its water
        if (this.st === 'patrol' && this.cool <= 0 && C().catches.length && dM < 420 && !hidden && (!engaged || engaged === this) && this.stT > 3) { this.interest = [mx, my]; this.go('investigate'); }
        break;
      }
      case 'investigate': {
        this.behavior = 'patrolling';
        this.setAnim('swim');
        const [tx, ty] = this.interest ?? [mx, my];
        this.steer(tx, ty, 62, 40, dt);
        // he is in the kelp: it noses along the edge a while, then loses interest
        if (hidden && dM < 400) { this.lost += dt; if (this.lost > 5) { this.giveUp(8); break; } } else this.lost = 0;
        if (dM < 300 && !hidden) { engaged = this; this.orbitA = Math.atan2((this.y - my) / 0.25, this.x - mx); this.orbitDir = rand.chance(0.5) ? 1 : -1; this.orbitR = 190; this.go('circle'); }
        else if (this.stT > 30 || (Math.hypot(tx - this.x, ty - this.y) < 60 && dM > 500)) { this.go('cool'); this.cool = 6; this.interest = null; }
        // closing in on where the fish was taken, it homes on the diver once it's near
        if (this.interest && dM < 600 && !hidden) this.interest = [mx, my];
        break;
      }
      case 'circle': {
        // a wide horizontal orbit round him: in front of him on one half, behind him on the other
        this.behavior = 'circling';
        this.setAnim('swim');
        this.orbitA += this.orbitDir * dt * 0.62;
        this.orbitR = Math.max(110, this.orbitR - dt * 9);
        const tx = mx + Math.cos(this.orbitA) * this.orbitR, ty = my - 6 + Math.sin(this.orbitA) * 20;
        this.steer(tx, ty, 70, 60, dt);
        const front = Math.sin(this.orbitA) > 0;
        const z = front ? 60 : 40;
        if (z !== this.z) { this.z = z; f.main.markDirty(); }
        if (hidden) {
          this.lost += dt;
          if (this.lost > 4.5) { this.giveUp(10); break; }
        } else this.lost = 0;
        if (!hidden && this.stT > 5 + this.passes * 1.5 && dM < 260 && Math.abs(this.y - my) < 70) { this.go('hunch'); this.setAnim('hunch'); audio.play('alert', { vol: 0.25 }); }
        break;
      }
      case 'hunch': {
        // the tell: it stops side-on to him, humps its back, jams its pectorals down, swims stiffly
        this.behavior = 'warning';
        this.setAnim('hunch');
        this.vx *= Math.max(0, 1 - dt * 3); this.vy *= Math.max(0, 1 - dt * 3);
        this.face(mx > this.x ? 1 : -1);
        if (this.z !== 60) { this.z = 60; f.main.markDirty(); }
        if (this.stT > 0.7) firstLine(f, 'hunch', 'It\'s hunching... back up, fins down. That\'s a warning. Get into the kelp!', 'scared');
        if (hidden) { this.lost += dt; if (this.lost > 1.2) { this.giveUp(10); break; } }
        // (the tell holds a good two seconds once it is square on to him)
        if (this.turnT > 0) this.stT = Math.min(this.stT, 0.2);
        if (this.stT > 2.1 && this.turnT <= 0) {
          // charge where he will be
          const p = f.player;
          this.chargeTo = [mx + p.vx * 0.5, my + p.vy * 0.5];
          this.face(this.chargeTo[0] > this.x ? 1 : -1);
          this.go('charge');
          this.setAnim('charge');
          audio.play('whoosh', { vol: 0.6 });
        }
        break;
      }
      case 'charge': {
        this.behavior = 'charging';
        this.setAnim('charge');
        const [tx, ty] = this.chargeTo;
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
        const sp = 205;
        this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 5);
        this.vy += ((dy / d) * sp * 0.8 - this.vy) * Math.min(1, dt * 5);
        if (Math.abs(this.vx) > 20) this.facing = this.vx > 0 ? 1 : -1;
        const [hx, hy] = [this.x + this.facing * SHARK_LEN * 0.42, this.y];
        const dHit = Math.hypot(hx - mx, hy - my);
        if (dHit < 34 && !hidden && inWater(f) && f.player.hurtT <= 0.4) { this.hit(); break; }
        if (hidden && dM < 120) { this.giveUp(12); break; }
        if (this.stT > 1.7 || (d < 30)) { this.passes++; this.go('veer'); this.setAnim('veer'); }
        break;
      }
      case 'bite': {
        this.behavior = this.carry ? 'stealing' : 'charging';
        this.setAnim('bite');
        this.vx *= Math.max(0, 1 - dt * 2); this.vy *= Math.max(0, 1 - dt * 2);
        if (this.animDone()) { this.go(this.carry ? 'steal' : 'veer'); this.setAnim(this.carry ? 'fast' : 'veer'); }
        break;
      }
      case 'steal': {
        // off with the fish, fast, away from him, then a slow patrol far off
        this.behavior = 'stealing';
        this.setAnim('fast');
        const away = this.x > mx ? 1 : -1;
        this.steer(this.x + away * 300, Math.min(floorY(this.x) - 60, this.y + 30), 130, 80, dt);
        if (this.stT > 3.5) { this.carry = 0; this.giveUp(25); }
        break;
      }
      case 'veer': {
        this.behavior = 'veering';
        if (this.animDone() || this.anim !== 'veer') this.setAnim('swim');
        this.vx *= Math.max(0, 1 - dt * 0.8); this.vy *= Math.max(0, 1 - dt * 1.2);
        if (this.stT > 1.4) {
          if (this.cool > 0) { this.go('cool'); this.wp = this.pickWp(); if (engaged === this) engaged = null; }
          else if (this.passes >= 2 || hidden) this.giveUp(15);
          else { this.orbitR = 220; this.orbitA = Math.atan2((this.y - my) / 0.25, this.x - mx); this.go('circle'); }
        }
        break;
      }
    }
    if (this.st !== 'charge' && this.st !== 'bite') this.faceVel(8);
    this.swimMove(dt);
    if (this.st === 'patrol' || this.st === 'cool') {
      // patrols keep to their stretch of water
      if (this.x < this.range[0] - 200) this.wp = [this.range[0] + 100, this.wp[1]];
      if (this.x > this.range[1] + 200) this.wp = [this.range[1] - 100, this.wp[1]];
      if (this.z !== 40) { this.z = 40; this.f.main.markDirty(); }
    }
    this.pitchTo(0.7, 0.45, dt);
  }
  private giveUp(cool: number) {
    this.cool = cool; this.threatening = false; this.passes = 0; this.lost = 0; this.interest = null;
    this.wp = this.pickWp();
    this.go('cool');
    if (engaged === this) engaged = null;
  }
  private hit() {
    const f = this.f;
    hitMori(f, this.x, { sev: 1 });
    const cs = C().catches;
    const stolen = cs.length ? cs.pop()! : null;
    this.carry = stolen ? 1 : 0;
    this.go('bite');
    this.setAnim('bite');
    this.vx *= 0.3; this.vy *= 0.3;
    bubbles(f, this.x + this.facing * 50, this.y, 10, 12);
    if (stolen) {
      const name = ITEMS[stolen]?.name?.toLowerCase() ?? 'fish';
      setTimeout(() => { void floatText({ text: `It took my ${name}!`, style: 'scared', ms: 2400 }); }, 1300);
    }
    if (engaged === this) engaged = null;
  }
  post(r: Renderer) {
    if (!this.carry || (this.st !== 'steal' && !(this.st === 'bite' && this.fi() >= 3))) return;
    const [hx, hy] = this.headAt();
    r.draw(heldFish(), Math.round(hx - this.facing * 10), Math.round(hy + 10), this.facing, 1, this.rot * this.facing);
  }
}

// ==================================================================== Corvex Seals
type SealSt = 'play' | 'roll' | 'bubble' | 'mimic' | 'steal' | 'carry';
class Seal extends DiveBeast {
  st: SealSt = 'play';
  stT = 0;
  wp: V2;
  curious = rand.range(4, 12);
  snatch = 0;
  constructor(f: FieldScene, x: number, y: number, readonly home: [number, number], readonly pod: Seal[]) {
    super(SEAL_ID, f, x, y);
    this.wp = this.pickWp();
    this.setAnim('glide');
    this.z = 36;
  }
  private pickWp(): V2 {
    const x = rand.range(this.home[0], this.home[1]);
    const top = C().surfaceY + 34, bot = floorY(x) - 60;
    return [x, rand.range(top, Math.max(top + 10, Math.min(bot, top + 200)))];
  }
  private go(st: SealSt) { this.st = st; this.stT = 0; }
  /** a fish taken nearby: a chance this one comes for it */
  hear(x: number, y: number) {
    if (this.st === 'steal' || this.st === 'carry' || this.snatch > 0) return;
    if (Math.hypot(x - this.x, y - this.y) > 520) return;
    if (this.pod.some(s => s !== this && (s.st === 'steal' || s.st === 'carry'))) return;
    if (rand.chance(0.6)) this.go('steal');
  }
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f), p = f.player;
    this.stT += dt;
    this.snatch = Math.max(0, this.snatch - dt);
    const dM = Math.hypot(mx - this.x, my - this.y);
    if (dM < 420 && inWater(f)) firstLine(f, 'seals', 'Seals! The same ones from the beach? On land they\'re boulders. Down here they FLY.', 'happy');
    // nobody bothers a seal near the kelp shallows: the pod keeps clear of a charging shark
    switch (this.st) {
      case 'play': {
        this.behavior = 'swimming';
        const d = this.steer(this.wp[0], this.wp[1], 88, 70, dt);
        this.setAnim(this.speed > 60 ? 'swim' : 'glide');
        if (d < 50) {
          this.wp = this.pickWp();
          if (rand.chance(0.32)) { this.go('roll'); this.setAnim('roll'); bubbles(f, this.x, this.y - 10, 4, 18); }
        }
        this.curious -= dt;
        if (this.curious <= 0 && inWater(f) && dM < 380 && !this.pod.some(s => s !== this && (s.st === 'bubble' || s.st === 'mimic'))) this.go('bubble');
        break;
      }
      case 'roll': {
        // the barrel roll: it corkscrews on along its line, a spiral of bubbles behind
        this.behavior = 'barrelroll';
        this.setAnim('roll');
        this.steer(this.x + this.facing * 120, this.y - 8, 95, 90, dt);
        if (Math.floor(this.animT * 10) !== Math.floor((this.animT - dt) * 10)) bubbles(f, this.x - this.facing * 50, this.y + Math.sin(this.animT * 12) * 16, 1, 3);
        if (this.animT > 0.8 * (this.mem.rolls ?? 1)) {
          this.mem.rolls = 1;
          this.go('play');
          if (rand.chance(0.3)) { this.mem.rolls = 2; this.go('roll'); }
        }
        break;
      }
      case 'bubble': {
        // up close and face on, it lets a string of bubbles go at him
        this.behavior = this.stT > 1.2 ? 'bubbles' : 'swimming';
        const side = this.x > mx ? 1 : -1;
        const d = this.steer(mx + side * 105, my - 10, 80, 90, dt);
        if (d < 30 || this.stT > 3) {
          this.setAnim('bubble');
          this.vx *= 0.9; this.vy *= 0.9;
          this.face(mx > this.x ? 1 : -1);
          if (Math.floor(this.animT * 4) !== Math.floor((this.animT - dt) * 4)) { const [hx, hy] = this.headAt(); bubbles(f, hx + this.facing * 26, hy + 14, 3, 2); if (rand.chance(0.4)) audio.play('bubble', { vol: 0.3 }); }
        } else this.setAnim('swim');
        if (this.stT > 5.5) this.go(inWater(f) && dM < 300 ? 'mimic' : 'play');
        if (!inWater(f) || dM > 520) { this.go('play'); this.curious = rand.range(10, 18); }
        break;
      }
      case 'mimic': {
        // it copies him: keeps its place beside him and swims as he swims; when he stops, it hangs
        // upright, head cocked, waiting for his next move
        this.behavior = 'mimicking';
        const side = this.mem.side ?? (this.mem.side = this.x > mx ? 1 : -1);
        const ms = moriSpeed(f);
        const tx = mx + side * 120, ty = my - 6;
        if (ms > 14) {
          // match his velocity, then close the gap
          this.vx += (p.vx * 1.05 + (tx - this.x) * 0.8 - this.vx) * Math.min(1, dt * 3);
          this.vy += (p.vy * 1.05 + (ty - this.y) * 0.8 - this.vy) * Math.min(1, dt * 3);
          this.setAnim(ms > 45 ? 'swim' : 'glide');
          if (Math.abs(p.vx) > 10) this.face(p.vx > 0 ? 1 : -1);
        } else {
          this.steer(tx, ty, 30, 60, dt);
          this.setAnim('hang');
          this.face(mx > this.x ? 1 : -1);
        }
        firstLine(f, 'mimic', 'Is it... copying me? I go up, it goes up. I stop, it stops. Cheeky.', 'laugh');
        // a diver with fish in his bag is very interesting: now and then it snatches one
        if (C().catches.length && this.stT > 6 && rand.chance(dt * 0.06)) this.go('steal');
        if (this.stT > 14 || !inWater(f) || dM > 480) { this.go('play'); this.curious = rand.range(14, 26); delete this.mem.side; }
        break;
      }
      case 'steal': {
        // the snatch: straight at his catch bag, beak open, and away
        this.behavior = 'stealing';
        const d = this.steer(mx, my, 150, 220, dt);
        this.face(mx > this.x ? 1 : -1);
        this.setAnim(d < 110 ? 'grab' : 'swim');
        if (d < 60 || this.stT > 4) {
          const cs = C().catches;
          if (cs.length && d < 70 && inWater(f)) {
            const got = cs.pop()!;
            const name = ITEMS[got]?.name?.toLowerCase() ?? 'fish';
            audio.play('netSwish', { vol: 0.5 });
            bubbles(f, mx, my, 8, 10);
            void floatText({ text: `Hey! That's my ${name}!`, style: 'shout', ms: 2200 });
            this.go('carry');
          } else { this.go('play'); this.curious = rand.range(8, 14); }
          this.snatch = 20;
        }
        break;
      }
      case 'carry': {
        // off with it, delighted: a swooping run and a roll, then it's gone down the hatch
        this.behavior = 'stealing';
        this.setAnim('carry');
        const away = this.x > mx ? 1 : -1;
        this.steer(this.x + away * 200, this.y - 20, 110, 90, dt);
        if (this.stT > 4.5) { this.go('roll'); this.setAnim('roll'); this.curious = rand.range(16, 30); }
        break;
      }
    }
    if (this.st !== 'bubble' && this.st !== 'mimic' && this.st !== 'steal') this.faceVel(10);
    // keep to the shallows (a long way past them it heads home)
    if (this.st === 'play' && (this.x < this.home[0] - 150 || this.x > this.home[1] + 150)) this.wp = this.pickWp();
    this.move(dt, 26, 40);
    const near = Math.hypot(this.x - mx, this.y - my) < 160;
    const z = near && (this.st === 'mimic' || this.st === 'bubble') ? 56 : 36;
    if (z !== this.z) { this.z = z; f.main.markDirty(); }
    if (this.anim === 'hang') this.rot += (0 - this.rot) * Math.min(1, dt * 4);
    else this.pitchTo(0.8, 0.6, dt);
  }
}

// ==================================================================== Hāpuku
type GrSt = 'hidden' | 'peer' | 'out' | 'retreat';
class Groper extends DiveBeast {
  st: GrSt = 'hidden';
  still = 0;
  spook = 0;
  gulpT = rand.range(5, 9);
  out: 1 | -1;
  constructor(f: FieldScene, readonly cave: V2) {
    super(HAPUKU_ID, f, cave[0], cave[1]);
    // the cave faces the more open side (deeper floor)
    this.out = floorY(cave[0] + 90) > floorY(cave[0] - 90) ? 1 : -1;
    this.facing = this.out;
    this.x = this.inX();
    this.setAnim('idle');
    this.z = 32;
  }
  private inX() { return this.cave[0] - this.out * 34; }
  private peerX() { return this.cave[0] - this.out * 8; }
  private outX() { return this.cave[0] + this.out * 18; }
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f);
    const dM = Math.hypot(mx - this.cave[0], my - this.cave[1]);
    const ms = moriSpeed(f);
    this.spook = Math.max(0, this.spook - dt);
    // patience: Mori near the cave and keeping still
    if (inWater(f) && dM < 280 && dM > 60 && ms < 14 && !f.player.running) this.still += dt;
    else if (ms > 30 || dM < 60) { if (this.st !== 'hidden' && (ms > 30 && dM < 260 || dM < 60)) { this.st = 'retreat'; this.spook = 5; } this.still = 0; }
    else this.still = Math.max(0, this.still - dt * 2);
    if (dM < 420 && inWater(f)) firstLine(f, 'groper', 'Something huge in that cave... two eyes in the dark. If I keep really still, maybe it comes out.', 'whisper');
    let tx = this.inX();
    switch (this.st) {
      case 'hidden':
        this.behavior = 'hiding'; this.hidden = 0.9; this.setAnim('idle');
        if (this.still > 4 && this.spook <= 0) this.st = 'peer';
        break;
      case 'peer':
        this.behavior = 'peering'; this.hidden = 0.45; tx = this.peerX(); this.setAnim('idle');
        if (this.still > 8) this.st = 'out';
        break;
      case 'out':
        this.behavior = 'guarding'; this.hidden = 0.05; tx = this.outX();
        this.gulpT -= dt;
        if (this.gulpT <= 0 && this.anim !== 'gulp') { this.setAnim('gulp'); this.gulpT = rand.range(6, 11); }
        if (this.anim === 'gulp') { this.behavior = 'gaping'; if (this.animDone()) this.setAnim('idle'); }
        firstLine(f, 'groperout', 'There you are. Hāpuku. Old as the reef. Don\'t move, Mori. Don\'t. Move.', 'whisper');
        break;
      case 'retreat':
        this.behavior = 'swimming'; this.hidden = 0.3; this.setAnim('back');
        if (Math.abs(this.x - this.inX()) < 3) this.st = 'hidden';
        break;
    }
    const sp = this.st === 'retreat' ? 40 : 9;
    this.x += clamp(tx - this.x, -sp * dt, sp * dt);
    this.y += (this.cave[1] + Math.sin(this.animT * 0.8) * 1.5 - this.y) * Math.min(1, dt * 2);
    this.facing = this.out;
    this.speed = this.st === 'retreat' ? 40 : 3;
    // the dark of the cave on it
    const k = clamp((this.x - this.inX()) / (this.outX() - this.inX()));
    const l = 0.3 + 0.7 * k;
    this.tint = packColor(l, l, l * 1.04, 1);
  }
}

// ==================================================================== the kingfish school and the blue cod
class School {
  cx: number; cy: number; vx = 30; vy = 0;
  scare = 0;
  fish: Kingfish[] = [];
  t = 0;
  constructor(readonly f: FieldScene, readonly home: V2) { this.cx = home[0]; this.cy = home[1]; }
  update(dt: number) {
    this.t += dt;
    this.scare = Math.max(0, this.scare - dt);
    const [mx, my] = moriAt(this.f);
    // the centre loops through the reef's mid-water in a long lazy figure of eight
    const tx = this.home[0] + Math.sin(this.t * 0.11) * 320, ty = this.home[1] + Math.sin(this.t * 0.22) * 50;
    const sp = this.scare > 0 ? 150 : 34;
    if (this.scare <= 0) { this.vx += (clamp(tx - this.cx, -sp, sp) - this.vx) * Math.min(1, dt * 0.6); this.vy += (clamp(ty - this.cy, -sp * 0.4, sp * 0.4) - this.vy) * Math.min(1, dt * 0.6); }
    // a diver right in the school's path: it parts and swings away
    const d = Math.hypot(mx - this.cx, my - this.cy);
    if (d < 90 && this.scare <= 0) { this.vx += Math.sign(this.cx - mx || 1) * 40 * dt; this.vy += Math.sign(this.cy - my || 1) * 30 * dt; }
    this.cx += this.vx * dt; this.cy += this.vy * dt;
    this.cy = clamp(this.cy, C().surfaceY + 60, floorY(this.cx) - 40);
  }
  spook(fromX: number, fromY: number) {
    if (this.scare > 1) return;
    this.scare = 2.6;
    const a = Math.atan2(this.cy - fromY, this.cx - fromX);
    this.vx = Math.cos(a) * 150; this.vy = Math.sin(a) * 60;
    audio.play('whoosh', { vol: 0.3 });
  }
}
class Kingfish extends DiveBeast implements Spearable {
  r = 12;
  ox = rand.range(-70, 70); oy = rand.range(-26, 26); ph = rand.range(0, TAU);
  constructor(f: FieldScene, readonly school: School) {
    super(KING_ID, f, school.cx + rand.range(-60, 60), school.cy + rand.range(-20, 20));
    this.setAnim('swim');
    this.facing = rand.chance(0.5) ? 1 : -1;
    this.z = 38 + rand.next() * 4;
  }
  get alive() { return !this.gone; }
  take(): string | null {
    if (this.gone) return null;
    this.gone = true; this.dead = true;
    this.school.fish = this.school.fish.filter(k => k !== this);
    // (DIVE_CTX.onCatch is called by the harpoon once the catch is in: not here, or it fires twice)
    this.school.spook(this.x, this.y);
    respawnLater(this.f, () => spawnKingfish(this.f, this.school));
    return KING_ITEM;
  }
  spook(fromX: number, fromY: number) { this.school.spook(fromX, fromY); }
  think(dt: number) {
    const s = this.school, [mx, my] = moriAt(this.f);
    this.ph += dt * 0.7;
    const sc = s.scare > 0;
    const tx = s.cx + this.ox + Math.sin(this.ph) * 14, ty = s.cy + this.oy + Math.cos(this.ph * 1.3) * 6;
    this.steer(tx, ty, sc ? 170 : 60, sc ? 400 : 70, dt);
    // a diver too close: this one shies
    const d = Math.hypot(mx - this.x, my - this.y);
    if (d < 46) { this.vx += Math.sign(this.x - mx || 1) * 180 * dt; this.vy += Math.sign(this.y - my || 1) * 90 * dt; }
    this.faceVel(12);
    this.move(dt, 30, 24);
    this.setAnim(sc || this.speed > 90 ? 'fast' : 'swim');
    this.noticed = sc || d < 60;
    const near = s.fish.filter(k => Math.abs(k.x - this.x) < 120).length;
    this.behavior = sc ? 'darting' : near >= 3 ? 'schooling' : 'cruising';
    this.pitchTo(0.6, 0.5, dt);
  }
}
type CodSt = 'rest' | 'hop' | 'curious' | 'dart';
class Cod extends DiveBeast implements Spearable {
  r = 9;
  st: CodSt = 'rest';
  stT = 0;
  perch: V2;
  wait = rand.range(4, 10);
  constructor(f: FieldScene, x: number, readonly home: [number, number]) {
    super(COD_ID, f, x, floorY(x) - 5);
    this.perch = [x, floorY(x) - 5];
    this.setAnim('idle');
    this.facing = rand.chance(0.5) ? 1 : -1;
    this.z = 34;
  }
  get alive() { return !this.gone; }
  take(): string | null {
    if (this.gone) return null;
    this.gone = true; this.dead = true;
    // (DIVE_CTX.onCatch is called by the harpoon once the catch is in: not here, or it fires twice)
    respawnLater(this.f, () => spawnCod(this.f, this.home));
    return COD_ITEM;
  }
  spook(fromX: number, _fromY: number) {
    this.st = 'dart'; this.stT = 0;
    const x = clamp(this.x + Math.sign(this.x - fromX || 1) * rand.range(70, 120), this.home[0] - 60, this.home[1] + 60);
    this.perch = [x, floorY(x) - 5];
  }
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f);
    this.stT += dt;
    const d = Math.hypot(mx - this.x, my - this.y), ms = moriSpeed(f);
    if (d < 70 && ms > 60 && this.st !== 'dart') this.spook(mx, my);
    switch (this.st) {
      case 'rest':
        this.behavior = 'resting'; this.setAnim('idle');
        this.vx *= 0.8; this.vy *= 0.8;
        this.y += (this.perch[1] - this.y) * Math.min(1, dt * 3);
        this.wait -= dt;
        // a still diver close by: it comes to look
        if (inWater(f) && d < 170 && d > 40 && ms < 16 && this.stT > 2 && rand.chance(dt * 0.4)) { this.st = 'curious'; this.stT = 0; }
        else if (this.wait <= 0) { const x = clamp(this.x + rand.range(-90, 90), this.home[0], this.home[1]); this.perch = [x, floorY(x) - 5]; this.st = 'hop'; this.stT = 0; this.wait = rand.range(5, 12); }
        break;
      case 'hop': case 'dart': {
        this.behavior = 'swimming'; this.setAnim('swim');
        const dd = this.steer(this.perch[0], this.perch[1] - (this.stT < 0.5 ? 12 : 0), this.st === 'dart' ? 110 : 40, 160, dt);
        this.faceVel(4);
        if (dd < 4 || this.stT > 6) { this.st = 'rest'; this.stT = 0; }
        break;
      }
      case 'curious': {
        // hangs a little way in front of his mask, looking
        this.behavior = this.stT > 1 ? 'curious' : 'swimming';
        const side = this.x > mx ? 1 : -1;
        const dd = this.steer(mx + side * 40, my - 4, 30, 60, dt);
        this.setAnim(dd > 8 ? 'swim' : 'idle');
        this.face(mx > this.x ? 1 : -1);
        if (this.stT > rand.range(5, 9) || ms > 40 || d > 260) { this.st = 'hop'; this.stT = 0; const x = clamp(this.x + rand.range(-60, 60), this.home[0], this.home[1]); this.perch = [x, floorY(x) - 5]; }
        break;
      }
    }
    this.move(dt, 30, 3);
    this.noticed = this.st === 'curious' || this.st === 'dart';
    this.pitchTo(0.5, 0.4, dt);
  }
}
const RESPAWN: { f: FieldScene; t: number; fn: () => void }[] = [];
function respawnLater(f: FieldScene, fn: () => void) { RESPAWN.push({ f, t: rand.range(55, 80), fn }); }

// ==================================================================== the ocean sunfish and its cleaners
class Sunfish extends DiveBeast {
  wp: V2;
  constructor(f: FieldScene, readonly home: V2) {
    super(SUN_ID, f, home[0], home[1]);
    this.wp = this.pick();
    this.setAnim('idle');
    this.z = 30;
  }
  turnHalf() { return 0.9; }
  private pick(): V2 { return [this.home[0] + rand.range(-170, 170), this.home[1] + rand.range(-50, 50)]; }
  cleaners: Cleaner[] = [];
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f);
    const d = this.steer(this.wp[0], this.wp[1], 10, 4, dt);
    if (d < 20) this.wp = this.pick();
    // shy of a diver rushing it: it turns away, slowly
    const dM = Math.hypot(mx - this.x, my - this.y);
    if (dM < 110 && moriSpeed(f) > 40) this.wp = [this.x + Math.sign(this.x - mx || 1) * 200, this.y];
    this.faceVel(5);
    this.move(dt, 90, 90);
    this.behavior = this.turnT > 0 ? 'turning' : this.cleaners.some(c => c.st === 'peck') ? 'cleaned' : 'drifting';
    if (dM < 520 && inWater(f)) firstLine(f, 'sunfish', 'What... is that? A fish that\'s all head. A sunfish! And little fish picking at it.', 'happy');
    this.rot = Math.sin(this.animT * 0.3) * 0.06;
  }
}
class Cleaner extends DiveBeast {
  st: 'swim' | 'peck' = 'swim';
  stT = 0;
  off: V2 = [0, 0];
  constructor(f: FieldScene, readonly host: Sunfish) {
    super(CLEAN_ID, f, host.x + rand.range(-40, 40), host.y + rand.range(-40, 40));
    this.pickOff();
    this.z = 31;
  }
  private pickOff() {
    // somewhere on the sunfish's flank, on its skin
    this.off = [rand.range(-30, 28), rand.range(-34, 34)];
  }
  think(dt: number) {
    this.stT += dt;
    const h = this.host;
    const tx = h.x + this.off[0] * h.facing, ty = h.y + this.off[1];
    if (this.st === 'swim') {
      this.behavior = 'swimming'; this.setAnim('swim');
      const d = this.steer(tx, ty, 40, 160, dt);
      this.faceVel(3);
      if (d < 8) { this.st = 'peck'; this.stT = 0; }
    } else {
      this.behavior = 'cleaning'; this.setAnim('peck');
      this.x += (tx - this.x) * Math.min(1, dt * 6); this.y += (ty - this.y) * Math.min(1, dt * 6);
      this.vx = h.vx; this.vy = h.vy;
      if (this.stT > rand.range(1.2, 2.8)) { this.st = 'swim'; this.pickOff(); }
    }
    this.x += this.vx * dt * (this.st === 'swim' ? 1 : 0); this.y += this.vy * dt * (this.st === 'swim' ? 1 : 0);
    this.speed = Math.hypot(this.vx, this.vy);
  }
}

// ==================================================================== the eagle ray
class Ray extends DiveBeast {
  st: 'fly' | 'glide' | 'feed' = 'glide';
  stT = 0;
  dur = rand.range(3, 5);
  constructor(f: FieldScene, readonly home: [number, number], readonly lift: number) {
    super(RAY_ID, f, (home[0] + home[1]) / 2, floorY((home[0] + home[1]) / 2) - lift);
    this.setAnim('glide');
    this.z = 33;
  }
  turnHalf() { return 0.45; }
  think(dt: number) {
    const f = this.f, [mx, my] = moriAt(f);
    this.stT += dt;
    if (this.stT > this.dur) {
      this.stT = 0;
      const r = rand.next();
      this.st = this.st === 'feed' ? 'fly' : r < 0.45 ? 'fly' : r < 0.75 ? 'glide' : 'feed';
      this.dur = this.st === 'feed' ? rand.range(3.5, 5.5) : rand.range(2.5, 5);
    }
    // a diver close and fast: it flies off along the channel
    const dM = Math.hypot(mx - this.x, my - this.y);
    if (dM < 90 && moriSpeed(f) > 35 && this.st === 'feed') { this.st = 'fly'; this.stT = 0; this.face(this.x > mx ? 1 : -1); }
    // turn at the ends of the channel
    if (this.x < this.home[0] && this.facing < 0) this.face(1);
    if (this.x > this.home[1] && this.facing > 0) this.face(-1);
    const sp = this.st === 'fly' ? 46 : this.st === 'glide' ? 30 : 0;
    const ty = floorY(this.x) - (this.st === 'feed' ? this.lift * 0.45 : this.lift);
    this.vx += (this.facing * sp - this.vx) * Math.min(1, dt * (this.st === 'feed' ? 2 : 0.8));
    this.vy += ((ty - this.y) * 1.2 - this.vy) * Math.min(1, dt * 1.5);
    this.move(dt, 40, 4);
    this.setAnim(this.turnT > 0 ? 'glide' : this.st === 'fly' ? 'swim' : this.st === 'glide' ? 'glide' : 'feed');
    this.behavior = this.turnT > 0 ? 'turning' : this.st === 'fly' ? 'flying' : this.st === 'glide' ? 'gliding' : 'feeding';
    if (this.st === 'feed' && Math.floor(this.stT * 3) !== Math.floor((this.stT - dt) * 3)) sandPuff(f, this.x + this.facing * 22, floorY(this.x + this.facing * 22), 5);
    this.rot += (0 - this.rot) * Math.min(1, dt * 3);
  }
}

// ==================================================================== spawning
function add<T extends DiveBeast>(f: FieldScene, b: T): T {
  f.main.add(b);
  f.animals.push(asAnimal(b));
  return b;
}
function spawnKingfish(f: FieldScene, s: School) {
  const k = add(f, new Kingfish(f, s));
  s.fish.push(k);
  C().spearables.push(k);
  return k;
}
function spawnCod(f: FieldScene, home: [number, number]) {
  const x = rand.range(home[0], home[1]);
  const c = add(f, new Cod(f, x, home));
  C().spearables.push(c);
  return c;
}

/** a little manager on the main layer: warms frames, ticks the school and the respawns, tidies the ctx */
class Life implements Drawable {
  z = -1;
  constructor(readonly f: FieldScene, readonly schools: School[]) {}
  update(dt: number) {
    if (C().scene !== this.f) return;
    warmStep();
    for (const s of this.schools) s.update(dt);
    // taken fish leave the spear list
    const sp = C().spearables;
    for (let i = sp.length - 1; i >= 0; i--) if (!sp[i].alive) sp.splice(i, 1);
    for (let i = RESPAWN.length - 1; i >= 0; i--) {
      const r = RESPAWN[i];
      if (r.f !== this.f) { RESPAWN.splice(i, 1); continue; }
      r.t -= dt;
      if (r.t <= 0) { RESPAWN.splice(i, 1); r.fn(); }
    }
  }
  draw(): void {}
}

/** the leviathan in the blue: the first sighting (a held breath, a long look) and the sharks giving it room */
class Serpentwatch implements Drawable {
  z = -1;
  private seen = false;
  private gave = new Map<Shark, number>();
  constructor(readonly f: FieldScene, readonly sharks: Shark[]) {}
  update(dt: number) {
    if (C().scene !== this.f) return;
    const lev = this.f.animals.find(a => a.species === 'leviathan' && !a.gone && !a.dead);
    if (!lev) return;
    for (const s of this.sharks) {
      const t = (this.gave.get(s) ?? 0) - dt;
      this.gave.set(s, t);
      if (t <= 0 && Math.hypot(s.x - lev.x, s.y - lev.y) < 300) { s.repel(lev.x, lev.y); this.gave.set(s, 6); }
    }
    const p = this.f.player;
    if (this.seen || game.save.flags['dive:serpentSeen'] || this.f.cutscene || Math.hypot(lev.x - p.x, lev.y - p.y) > 450) return;
    this.seen = true;
    game.save.flags['dive:serpentSeen'] = true;
    void (async () => {
      audio.play('roar', { vol: 0.25, pitch: 0.35 });
      void floatText({ text: '(bubbles) ...that is not a shark. That is NOT a shark.', style: 'whisper', ms: 3200 });
      await cineFocusOn({ x: lev.x, y: lev.y, height: 70 } as never, { zoom: 1.2, secs: 1.4, dof: 1.2 });
      await new Promise(r => setTimeout(r, 2200));
      await cineFocusOn(null);
      await cineRelease(this.f.st, 1);
      void floatText({ text: 'The Finned Leviathan. Out here. Camera. CAMERA.', style: 'scared', ms: 2600 });
    })();
  }
  draw(): void {}
}

// ==================================================================== dev / story hooks
const ofScene = <T extends DiveBeast>(f: FieldScene, k: new (...a: never[]) => T) => f.animals.filter(a => (a as unknown) instanceof k) as unknown as T[];
/** dev jumps and set pieces: the nearest shark comes for Mori now (it circles, warns, charges) */
export function provokeShark(f: FieldScene): void {
  const [mx, my] = moriAt(f);
  const s = ofScene(f, Shark).sort((a, b) => Math.abs(a.x - mx) - Math.abs(b.x - mx))[0];
  if (!s) return;
  s.cool = 0; engaged = null;
  s.interest = [mx, my];
  s.st = 'investigate'; s.stT = 0;
}
/** dev jumps: the hāpuku has been coaxed out to its cave mouth */
export function coaxGroper(f: FieldScene): void {
  for (const g of ofScene(f, Groper)) { g.still = 12; g.spook = 0; g.st = 'out'; }
}

/** spawn the dive's animals into the scene (called by the scene once DIVE_CTX is filled) */
export function installDiveLife(f: FieldScene): void {
  const S = C().spots;
  const at = (k: string, dx: number, dy: number): V2 => [S[k]?.x ?? dx, S[k]?.y ?? dy];
  engaged = null;
  RESPAWN.length = 0;
  lastLine = -99;
  // (dev and headless checks reach the context from the console)
  (globalThis as { __diveCtx?: unknown }).__diveCtx = DIVE_CTX;
  // ---- the seal pod in the kelp shallows (their frames first: they meet Mori at the start)
  const [sx, sy] = at('sealPlay', 690, 70);
  const pod: Seal[] = [];
  const home: [number, number] = [Math.max(160, sx - 420), Math.min(KELP_ZONES.shallows[1] + 100, sx + 520)];
  for (let i = 0; i < 3; i++) pod.push(add(f, new Seal(f, sx + rand.range(-200, 200), sy + rand.range(-20, 60), home, pod)));
  for (const a of ['glide', 'swim']) for (let i = 0; i < CORVEXSEAL.anims[a].frames; i++) dframe(SEAL_ID, a, i);
  // ---- the reef: the kingfish school, the blue cod, the eagle ray
  const [kx, ky] = at('kingfish', 2060, 200);
  const school = new School(f, [kx, ky]);
  for (let i = 0; i < 7; i++) spawnKingfish(f, school);
  const [cx] = at('cod', 1760, 280);
  const codHome: [number, number] = [cx - 160, cx + 160];
  for (let i = 0; i < 4; i++) spawnCod(f, codHome);
  const [rx, ry] = at('ray', 2510, 280);
  add(f, new Ray(f, [rx - 170, rx + 150], Math.max(12, floorY(rx) - ry)));
  // ---- the drop-off and the blue: two sharks, the groper, the sunfish and its cleaners
  const [qx, py] = at('sharkPatrol', 3640, 420);
  const px0 = qx;
  const sharks = [
    add(f, new Shark(f, px0 - 300, py, [Math.max(KELP_ZONES.dropoff[0] - 60, px0 - 800), px0 + 150], 0)),
    add(f, new Shark(f, px0 + 700, py + 60, [px0 + 200, KELP_ZONES.W - 120], 0.5)),
  ];
  for (const s of sharks) C().chargers.push(s);
  const [gx, gy] = at('groperCave', 4262, 600);
  add(f, new Groper(f, [gx, gy]));
  const [ux, uy] = at('sunfish', 4520, 290);
  const sun = add(f, new Sunfish(f, [ux, uy]));
  for (let i = 0; i < 3; i++) sun.cleaners.push(add(f, new Cleaner(f, sun)));
  // ---- the struggle of a taken fish carries: sharks and seals come
  C().onCatch.push((_sp, x, y) => {
    for (const s of sharks) s.hear(x, y);
    for (const s of pod) s.hear(x, y);
  });
  // ---- the island's own fish (the ones Mori knows from the line), swimming free by habitat
  const fl = (x: number) => C().floorAt(x), SY = C().surfaceY;
  const reef = (sp: string, len: number, n: number, x0: number, x1: number, top: number, above: number, cruise: number, mode: 'swim' | 'bottom' | 'hover' = 'swim') => {
    const y0 = SY + top, y1 = Math.max(y0 + 8, fl((x0 + x1) / 2) - above);
    for (let i = 0; i < n; i++) {
      const fish = new ReefFish(sp, len, [x0, x1], [y0, y1], cruise * rand.range(0.85, 1.15), f, mode, fl);
      f.main.add(fish);
      f.animals.push(fish as unknown as Animal);
    }
  };
  const Z = KELP_ZONES;
  reef('glassmaomao', 16, 14, 220, 1300, 30, 70, 22);
  reef('bubblepuffer', 18, 3, 140, 700, 24, 90, 8, 'hover');
  reef('snoutbass', 32, 3, 500, 1350, 60, 0, 12, 'bottom');
  reef('hammersnapper', 44, 3, Z.reef[0] + 100, Z.reef[1] - 100, 80, 50, 18);
  reef('sixfinger', 26, 3, Z.reef[0] + 60, Z.reef[1] - 60, 100, 0, 8, 'bottom');
  reef('spinnaker', 36, 4, Z.reef[0], Z.dropoff[0] + 200, 40, 120, 30);
  reef('mirrordory', 24, 3, Z.dropoff[0] + 100, Z.dropoff[1], 160, 120, 14, 'hover');
  reef('ribboneel', 56, 2, Z.dropoff[0] + 200, Z.blue[0] + 300, 220, 90, 10);
  reef('lanterncod', 30, 2, gx - 120, gx + 140, 330, 26, 6, 'hover');
  reef('sunwheel', 48, 2, Z.blue[0] + 100, Z.blue[1] - 120, 200, 260, 12);
  f.main.add(new Life(f, [school]));
  f.main.add(new Serpentwatch(f, sharks));
  // ---- everything else warms in the background, the animals nearest Mori first
  const px = f.player.x;
  const order: [string, number][] = [[SEAL_ID, sx], [KING_ID, kx], [COD_ID, cx], [RAY_ID, rx], [SHARK_ID, px0], [HAPUKU_ID, gx], [SUN_ID, ux], [CLEAN_ID, ux + 1]];
  order.sort((a, b) => Math.abs(a[1] - px) - Math.abs(b[1] - px));
  for (const [id] of order) queueWarm(id, id === SEAL_ID ? SEAL_SWIM_ANIMS : undefined);
  // every animal has a frame to measure by before it is first drawn
  for (const a of f.animals) { const b = a as unknown as DiveBeast; if (b instanceof DiveBeast && !b.lastF) b.lastF = dframe(b.species, Object.keys(b.def.anims)[0] === 'idle' ? 'idle' : b.anim, 0); }
}
