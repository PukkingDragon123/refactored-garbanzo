// V12 the weapon belt's projectiles and effects (one per scene, on the gameplay layer just under the
// predators' own fx): the bolas whirling through the air and wrapping round legs, the flare's streak,
// its blinding flash and the flare burning on the ground (a real light that keeps predators off), a
// string of bear bangers going off across a spot, the net unfurling and dropping over a predator, the
// tranquilliser darts (they stay stuck in the hide for a while), the cone of bear spray.
//
// Every sprite is painted here pixel by pixel (scene-local atlas). The predators' state ticker runs here
// too: drowse wearing off, the doze (the 'sleep' pose, Zzz, a snore), the bolas and the net holding,
// the net slowing a big one, the burning flare's no-go ring. What a weapon does to a predator's state
// is in DETER_FX below (predators-core.ts calls it from deter()).

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { Interactable } from '../../world/npc';
import type { FieldScene } from '../scenes/field';
import type { Animal } from '../wild/animal';
import { SPECIALS } from '../wild/animal';
import type { ActFn } from '../wild/animal';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { rand, clamp } from '../../core/math';
import { game } from '../game';
import { deter, deterArea, isPredator, shootTargets, emitPred, predState, PREDATORS, DETER_FX } from '../v11/predators-core';
import type { PredState, PredatorDef } from '../v11/predators-core';
import { fx11Frames } from '../v11/predators-fx';
import { sfxArm } from './arsenal-sfx';
import { addAmmo, ammo, ammoMax, WEAPON_BY_ID } from './arsenal';
import type { WeaponId } from './arsenal';

// ================================================================== what each weapon does to a predator
/** darts it takes to fall asleep (the Bearer needs five) */
const DROWSE_AT: Record<string, number> = { bearer: 5 };
export function drowseAt(a: Animal): number {
  const d = PREDATORS[a.species];
  return d?.drowseAt ?? DROWSE_AT[a.species] ?? (d ? (d.tier >= 3 ? 4 : d.tier + 1) : 3);
}
/** a net only slows a big one (huge things, or anything wider than a big cat) */
export function isBig(a: Animal): boolean {
  const d = PREDATORS[a.species];
  if (d?.size) return d.size === 'big';
  if (a.species === 'bearer') return true;
  const b = a.body?.bounds(a);
  return !!b && b.x1 - b.x0 > 150;
}
function fallAsleep(a: Animal, st: PredState, d: PredatorDef) {
  st.asleep = 14 + d.tier * 3;
  st.drowse = 0;
  st.stun = Math.max(st.stun, st.asleep);
  st.target = null;
  emitPred('asleep', { a, kind: 'dart', x: a.x });
}
DETER_FX.bolas = (a, st, d, power) => {
  const t = d.stunTime * 2.4 * power + 1.4;
  st.tangle = Math.max(st.tangle, t);
  st.stun = Math.max(st.stun, t);
  emitPred('tangle', { a, kind: 'bolas', power, x: a.x });
};
DETER_FX.flare = (_a, st, d, power) => {
  st.stun = Math.max(st.stun, d.stunTime * power);
  st.blind = Math.max(st.blind, 2.4 * power);
};
DETER_FX.banger = (_a, st, d, power) => { st.stun = Math.max(st.stun, d.stunTime * 0.3 * power); };
DETER_FX.net = (a, st, _d, power) => {
  const big = isBig(a);
  if (big) { st.slow = Math.max(st.slow, 7 * power); st.stun = Math.max(st.stun, 0.5); }
  else { st.netted = Math.max(st.netted, 5 * power); st.stun = Math.max(st.stun, st.netted); }
  emitPred('netted', { a, kind: 'net', power: big ? 0.5 : 1, x: a.x });
};
DETER_FX.dart = (a, st, d, power) => {
  if (st.asleep > 0) return;
  st.drowse += power;
  st.stun = Math.max(st.stun, 0.12);
  const at = drowseAt(a);
  emitPred('drowse', { a, kind: 'dart', power: Math.min(1, st.drowse / at), x: a.x });
  if (st.drowse >= at - 1e-3) fallAsleep(a, st, d);
};
DETER_FX.spray = (_a, st, d, power) => {
  st.blind = Math.max(st.blind, 5 * power);
  st.stun = Math.max(st.stun, d.stunTime * 0.9 * power);
};

/** a dozing predator lies down: its own stunned act runs (it stays put), the pose is 'sleep' */
const wrapped = new WeakSet<ActFn>();
function sleepPose(species: string) {
  const sp = SPECIALS[species];
  const f = sp?.stunned;
  if (!sp || !f || wrapped.has(f)) return;
  const w: ActFn = (a, dt) => {
    const r = f(a, dt);
    if (predState(a).asleep > 0) { a.anim = 'sleep'; a.emote = null; a.vx = 0; }
    return r;
  };
  wrapped.add(w);
  sp.stunned = w;
}

// ================================================================== sprites (scene-local atlas)
interface FrArm {
  bolas: Frame[]; bolasLie: Frame; stone: Frame; flare: Frame[]; stick: Frame; flame: Frame[]; banger: Frame[]; pop: Frame[];
  dart: Frame; dartL: Frame; z: Frame[]; ember: Frame; paper: Frame[]; knot: Frame;
}
let owner: unknown = null;
let FR: FrArm | null = null;
type Px = [number, number, string];
function buf(w: number, h: number, px: Px[]): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (const [x, y, c] of px) b.set(x, y, hex(c));
  return b;
}
function rows(r: string[], pal: Record<string, string>): PixelBuffer {
  const b = new PixelBuffer(r[0].length, r.length);
  r.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) b.set(x, y, hex(pal[ch])); }));
  return b;
}
/** a little stone in leather netting: 3x3 with a diamond of light */
function stoneAt(b: PixelBuffer, cx: number, cy: number) {
  const c = (x: number, y: number, h: string) => b.set(Math.round(cx + x), Math.round(cy + y), hex(h));
  c(-1, -1, '#4a3a28'); c(0, -1, '#e8dcc0'); c(1, -1, '#a8946e');
  c(-1, 0, '#d0c09a'); c(0, 0, '#9a8662'); c(1, 0, '#5e4a32');
  c(-1, 1, '#7a6444'); c(0, 1, '#4a3420'); c(1, 1, '#2e2014');
}
/** a 1px line, Bresenham */
function bline(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: string, skip = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, i = 0;
  const col = hex(c);
  for (;;) {
    if (i++ >= skip) b.set(x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function armFrames(): FrArm {
  if (FR && owner === local) return FR;
  owner = local;
  const add = (n: string, b: PixelBuffer, ax = b.w / 2, ay = b.h / 2) => local.add('v12arm:' + n, b, ax, ay);
  // the bolas in flight: eight frames of a third of a turn (three stones, so that's a whole cycle), the
  // cords from the knot, faint dithered arcs behind each stone
  const bolas: Frame[] = [];
  for (let f = 0; f < 8; f++) {
    const b = new PixelBuffer(17, 17);
    const base = (f / 8) * (Math.PI * 2 / 3);
    for (let i = 0; i < 3; i++) {
      const a = base + (i * Math.PI * 2) / 3;
      const sx = 8 + Math.cos(a) * 5.6, sy = 8 + Math.sin(a) * 5.6;
      for (let k = 1; k <= 4; k++) {
        const aa = a - k * 0.2;
        if ((k + f) % 2) continue;
        b.set(Math.round(8 + Math.cos(aa) * 5.6), Math.round(8 + Math.sin(aa) * 5.6), hex(k < 3 ? '#c8bca0' : '#8a7e64'));
      }
      bline(b, 8, 8, sx, sy, i === 0 ? '#e0c890' : '#b89a62');
      stoneAt(b, sx, sy);
    }
    b.set(8, 8, hex('#6a4a22')); b.set(9, 8, hex('#8a6a3a')); b.set(8, 9, hex('#4a3216'));
    bolas.push(add('bolas' + f, b));
  }
  // lying on the ground: three stones, slack cords between them
  const lie = new PixelBuffer(17, 6);
  bline(lie, 3, 4, 8, 2, '#b89a62'); bline(lie, 8, 2, 13, 4, '#a08a58'); bline(lie, 8, 2, 8, 4, '#c8b080');
  stoneAt(lie, 2, 4); stoneAt(lie, 14, 4); stoneAt(lie, 8, 4);
  lie.set(8, 1, hex('#6a4a22'));
  const stone = new PixelBuffer(3, 3); stoneAt(stone, 1, 1);
  const knot = buf(2, 2, [[0, 0, '#8a6a3a'], [1, 0, '#c8a868'], [0, 1, '#4a3216'], [1, 1, '#6a4a22']]);
  // the flare in flight: a white-hot ball with a ragged orange-red rim, two frames of flicker
  const flare = [
    rows(['..r..', '.oyo.', 'rywyo', '.oyo.', '..r..'], { r: '#d8301e', o: '#ff7a2a', y: '#fff0a0', w: '#ffffff' }),
    rows(['.r.r.', 'roooo', '.ywyo', 'ooyor', '..r..'], { r: '#d8301e', o: '#ff7a2a', y: '#fff0a0', w: '#ffffff' }),
  ].map((b, i) => add('flare' + i, b));
  // the spent flare lying on the ground: a red paper tube, a white cap, the burning end to the right
  const stick = rows([
    '.hhhhhhh..',
    'pdddddddcw',
    'kbbbbbbbby',
    '.kkkkkkkk.',
  ], { h: '#ff8a6a', d: '#d8301e', b: '#8a1410', k: '#4a0806', p: '#f0ece0', c: '#ffcc60', w: '#ffffff', y: '#ff9a3a' });
  // its flame: three hand-drawn frames, a white core, licking up and leaning
  const flame = [
    ['...r...', '..ro...', '..oyr..', '.ryyo..', '.oywyo.', 'royyyo.', '.oyyo..', '..oo...'],
    ['..r....', '...or..', '..oyo..', '.oyyo..', '.oywyor', '.oyyyo.', '.royo..', '..oo...'],
    ['....r..', '...ro..', '..ryo..', '..oyyo.', '.oywyo.', '.oyyyor', '..oyo..', '...o...'],
  ].map((r, i) => add('flame' + i, rows(r, { r: '#c8281a', o: '#ff6a24', y: '#ffd860', w: '#ffffff' }), 3.5, 8));
  // a string of bangers tumbling: two frames
  const banger = [
    rows(['s........', '.f.......', '..rr.....', '..Rrf.rr.', '....rRf..', '.......Rr'], { s: '#fff6a0', f: '#c8a060', r: '#e0281a', R: '#8a1410' }),
    rows(['.......s.', '......f..', '.rr.frr..', '.Rr..Rr..', '...f.....', '..rr.....', '..Rr.....'], { s: '#fff6a0', f: '#c8a060', r: '#e0281a', R: '#8a1410' }),
  ].map((b, i) => add('banger' + i, b));
  // a banger going off: a ragged star, then its broken ring
  const pop = [
    rows(['.....y.....', '..y..y..y..', '...y.w.y...', '....wWw....', '.y.wWWWw.y.', 'yywWWWWWwyy', '.y.wWWWw.y.', '....wWw....', '...y.w.y...', '..y..y..y..', '.....y.....'],
      { y: '#ff9a2a', w: '#fff0a0', W: '#ffffff' }),
    rows(['....o.o....', '.o.......o.', '...........', 'o..y...y..o', '....y.y....', '...........', '....y.y....', 'o..y...y..o', '...........', '.o.......o.', '....o.o....'],
      { o: '#c84a1a', y: '#ffb040' }),
  ].map((b, i) => add('pop' + i, b));
  // the tranquilliser dart (pointing right): a yellow tuft, a steel barrel, a needle
  const dart = add('dart', rows(['yy.....', 'yYsssSn', 'yy.....'], { y: '#f0d040', Y: '#b88a10', s: '#9aa6ae', S: '#e8eef2', n: '#ffffff' }), 3.5, 1.5);
  const dartL = add('dartL', rows(['.....yy', 'nSsssYy', '.....yy'], { y: '#f0d040', Y: '#b88a10', s: '#9aa6ae', S: '#e8eef2', n: '#ffffff' }), 3.5, 1.5);
  // Zzz: three sizes of a pixel Z, white with an ink ring
  const z = [
    ['kkkk', 'kwwk', 'k.wk', 'kwwk', 'kkkk'],
    ['kkkkk', 'kwwwk', 'kk.wk', 'k.wkk', 'kwwwk', 'kkkkk'],
    ['kkkkkk', 'kwwwwk', 'kkk.wk', 'k..wkk', 'k.wkk.', 'kwwwwk', 'kkkkkk'],
  ].map((r, i) => {
    const b = rows(r, { k: '#1a1420', w: '#f4f0ff' });
    // the ink ring only where it touches the white (a hand-placed outline, not a box)
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (r[y][x] !== 'k') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r[y + dy]?.[x + dx] === 'w');
      if (!near) b.set(x, y, 0);
    }
    return add('z' + i, b);
  });
  const ember = add('ember', buf(1, 1, [[0, 0, '#ffffff']]), 0.5, 0.5);
  const paper = ['#e0281a', '#f0ece0', '#8a1410'].map((c, i) => add('paper' + i, buf(2, 1, [[0, 0, c], [1, 0, i === 1 ? '#c8c0b0' : c]]), 1, 0.5));
  FR = { bolas, bolasLie: add('bolasLie', lie, 8.5, 5), stone: add('stone', stone), flare, stick: add('stick', stick, 5, 3), flame, banger, pop, dart, dartL, z, ember, paper, knot: add('knot', knot) };
  return FR;
}

// ================================================================== the things in the air and on the ground
interface Throw { x: number; y: number; vx: number; vy: number; t: number; owner: string; dead: boolean; spin: number }
interface Wrap { a: Animal; t: number; seed: number }
interface Burning { x: number; y: number; t: number; life: number; tick: number; dir: number }
interface Pop { x: number; y: number; t: number }
interface Fuse { x: number; y: number; t: number; n: number; next: number; owner: string }
interface NetFly extends Throw { open: number }
interface Drape { a: Animal; t: number; big: boolean; off: number }
interface Stuck { a: Animal; dx: number; dy: number; t: number; dir: number }
interface Cone { x: number; y: number; dir: number; t: number; hit: Set<Animal>; owner: string; power: number; tg?: boolean }
interface Lying { kind: 'bolas' | 'net'; x: number; y: number; it: Interactable; dead: boolean; t: number }

const G_THROW = 380, G_NET = 300, G_FLARE = 140, G_DART = 70;

export class ArsenalFx implements Drawable {
  z = 95;
  bolas: Throw[] = [];
  wraps: Wrap[] = [];
  flares: Throw[] = [];
  burning: Burning[] = [];
  bangers: Throw[] = [];
  fuses: Fuse[] = [];
  pops: Pop[] = [];
  nets: NetFly[] = [];
  drapes: Drape[] = [];
  darts: Throw[] = [];
  stuck: Stuck[] = [];
  cones: Cone[] = [];
  lying: Lying[] = [];
  /** a good hit (the belt's hit-stop and the camera kick) */
  onHit: ((a: Animal, kind: WeaponId) => void) | null = null;
  private t = 0;
  private lastX = new WeakMap<Animal, number>();
  private wasAsleep = new WeakSet<Animal>();
  private snoreT = new WeakMap<Animal, number>();
  constructor(readonly s: FieldScene) {}
  private get fr() { return armFrames(); }

  // ---------------------------------------------------------------- launching
  throwBolas(x: number, y: number, vx: number, vy: number, owner = 'mori') {
    this.bolas.push({ x, y, vx, vy, t: 0, owner, dead: false, spin: 0 });
    sfxArm('whirl', { x, vol: 1.1, pitch: 1.2 });
    emitPred('fired', { who: owner, kind: 'bolas', x });
  }
  fireFlare(x: number, y: number, vx: number, vy: number, owner = 'mori') {
    this.flares.push({ x, y, vx, vy, t: 0, owner, dead: false, spin: 0 });
    sfxArm('flareShot', { x });
    // the muzzle flash: a hard white star, a burst of sparks, a puff of smoke
    this.s.main.glowParticles.spawn({ frame: this.fr.pop[0], x, y, life: 0.07, size: 0.6, size1: 0.8, color: [1, 0.9, 0.7], glow: true, intensity: 1.6, alpha: 1, alpha1: 0 });
    for (let i = 0; i < 10; i++) this.s.main.glowParticles.spawn({ frame: A.dot, x, y, vx: vx * 0.25 + rand.range(-60, 60), vy: vy * 0.25 + rand.range(-60, 30), ay: 200, life: rand.range(0.15, 0.4), color: [1, 0.7, 0.35], glow: true, intensity: 2.4, alpha: 1, alpha1: 0 });
    this.smoke(x, y, 2, 0.5);
    emitPred('fired', { who: owner, kind: 'flare', x });
  }
  throwBangers(x: number, y: number, vx: number, vy: number, owner = 'mori') {
    this.bangers.push({ x, y, vx, vy, t: 0, owner, dead: false, spin: 0 });
    audio.play('fizz' as never, { vol: 0.3 });
    emitPred('fired', { who: owner, kind: 'banger', x });
  }
  fireNet(x: number, y: number, vx: number, vy: number, owner = 'mori') {
    this.nets.push({ x, y, vx, vy, t: 0, owner, dead: false, spin: 0, open: 0 });
    sfxArm('netShot', { x });
    this.smoke(x, y, 3, 0.35);
    emitPred('fired', { who: owner, kind: 'net', x });
  }
  fireDart(x: number, y: number, vx: number, vy: number, owner = 'mori') {
    this.darts.push({ x, y, vx, vy, t: 0, owner, dead: false, spin: 0 });
    sfxArm('tranqShot', { x });
    this.s.main.particles.spawn({ frame: A.dot, x, y, vx: vx * 0.04, vy: -6, life: 0.4, size: 1, color: [0.9, 0.92, 0.95], alpha: 0.6, alpha1: 0 });
    emitPred('fired', { who: owner, kind: 'dart', x });
  }
  /** one burst of bear spray from (x, y) toward dir (power ~1) */
  spray(x: number, y: number, dir: 1 | -1, owner = 'mori', power = 1) {
    this.cones.push({ x, y, dir, t: 0, hit: new Set(), owner, power });
    sfxArm('spray', { x });
    emitPred('fired', { who: owner, kind: 'spray', x });
  }

  // ---------------------------------------------------------------- hits
  private groundAt(x: number, y: number) {
    const s2 = this.s.st.terrain.surfaceBelow(x, y - 6, 0);
    return s2 ? s2.y : this.s.st.terrain.groundY(x);
  }
  /** the animal at a world point (its silhouette, not just its box): sx shrinks the box at the sides,
   *  top / bot the share cut off above / below */
  private animalAt(x: number, y: number, o: { sx?: number; top?: number; bot?: number; solid?: boolean } = {}): Animal | null {
    for (const a of this.s.animals) {
      if (a.dead || a.gone || a.hidden > 0.9 || !a.body) continue;
      const b = a.body.bounds(a);
      const w = b.x1 - b.x0, h = b.y1 - b.y0, sx = o.sx ?? 0.12;
      if (x < b.x0 + w * sx || x > b.x1 - w * sx || y < b.y0 + h * (o.top ?? 0.08) || y > b.y1 - h * (o.bot ?? 0.02)) continue;
      if (o.solid !== false) {
        const pts = a.body.points(a);
        if (pts.length >= 3 && !pts.some(([px, py]) => Math.abs(px - x) < 8 && Math.abs(py - y) < 8)) continue;
      }
      return a;
    }
    return null;
  }
  /** a harmless animal caught by something: a fright, it bolts */
  private fright(a: Animal, x: number, y: number, vx: number, owner: string) {
    a.fear = Math.max(a.fear, 0.95);
    a.aw = Math.max(a.aw, 1);
    a.threat = { kind: 'point', x: x - Math.sign(vx || 1) * 60, y };
    a.showEmote('alarm', 1, true);
    emitPred('plinked', { a, who: owner });
  }
  private target(x: number, y: number, pad = 0) {
    for (const t of shootTargets()) if (Math.hypot(t.x - x, t.y - y) <= t.r + pad) return t;
    return null;
  }
  private kick(a: Animal, kind: WeaponId) { this.onHit?.(a, kind); }

  // ---------------------------------------------------------------- update
  update(dt: number) {
    this.t += dt;
    if (dt <= 0) return;
    const s = this.s;
    // ------------------------------------------------ the bolas
    for (const b of this.bolas) {
      if (b.dead) continue;
      b.t += dt; b.spin += dt * 22;
      if (Math.floor(b.spin / 4) !== Math.floor((b.spin - dt * 22) / 4)) sfxArm('whirl', { x: b.x, vol: 0.5, pitch: 1.4 });
      for (let i = 0; i < 3 && !b.dead; i++) {
        const h = dt / 3;
        b.vy += G_THROW * h; b.x += b.vx * h; b.y += b.vy * h;
        // it wraps whatever it meets at leg height (the lower body counts best)
        const a = this.animalAt(b.x, b.y, { sx: 0.1, top: 0.25, solid: false });
        if (a) {
          b.dead = true;
          if (isPredator(a)) {
            deter(s, a, 'bolas', 1, { x: b.x });
            this.wraps.push({ a, t: 0, seed: rand.next() * 10 });
            sfxArm('wrap', { x: b.x });
            this.kick(a, 'bolas');
          } else { this.fright(a, b.x, b.y, b.vx, b.owner); this.drop('bolas', b.x, this.groundAt(b.x, b.y)); }
          break;
        }
        const tg = this.target(b.x, b.y, 4);
        if (tg) { b.dead = true; tg.hit(1, b.x, b.y); sfxArm('wrap', { x: b.x, vol: 0.5 }); this.drop('bolas', b.x, this.groundAt(b.x, b.y)); break; }
        const gy = this.groundAt(b.x, b.y);
        if (b.vy > 0 && b.y >= gy) { b.dead = true; sfxArm('wrap', { x: b.x, vol: 0.4, pitch: 0.8 }); this.dust(b.x, gy, 5); this.drop('bolas', b.x, gy); break; }
      }
      if (b.t > 5 || b.y > 3000) b.dead = true;
    }
    this.bolas = this.bolas.filter(b => !b.dead);
    // ------------------------------------------------ the flare in flight
    for (const f of this.flares) {
      if (f.dead) continue;
      f.t += dt;
      // a fizzing trail of sparks and smoke
      if (rand.next() < dt * 60) s.main.glowParticles.spawn({ frame: A.dot, x: f.x, y: f.y, vx: rand.range(-30, 30), vy: rand.range(-30, 30), ay: 120, life: rand.range(0.2, 0.5), color: [1, rand.range(0.4, 0.8), 0.3], glow: true, intensity: 2.2, alpha: 1, alpha1: 0 });
      if (rand.next() < dt * 18) this.smoke(f.x, f.y, 1, 0.3);
      for (let i = 0; i < 3 && !f.dead; i++) {
        const h = dt / 3;
        f.vy += G_FLARE * h; f.x += f.vx * h; f.y += f.vy * h;
        const a = this.animalAt(f.x, f.y, { sx: 0.1 });
        if (a) {
          f.dead = true;
          if (isPredator(a)) { deter(s, a, 'flare', 1.2, { x: f.x }); this.kick(a, 'flare'); }
          else this.fright(a, f.x, f.y, f.vx, f.owner);
          this.flash(f.x, f.y, 1);
          this.light(f.x - Math.sign(f.vx) * 6, this.groundAt(f.x, f.y), -Math.sign(f.vx || 1));
          break;
        }
        const tg = this.target(f.x, f.y, 3);
        if (tg) { f.dead = true; tg.hit(1.2, f.x, f.y); this.flash(f.x, f.y, 0.7); this.light(f.x, this.groundAt(f.x, f.y), 1); break; }
        const gy = this.groundAt(f.x, f.y);
        if (f.vy > 0 && f.y >= gy) { f.dead = true; this.flash(f.x, gy - 4, 0.75); this.light(f.x, gy, Math.sign(f.vx || 1)); break; }
      }
      if (f.t > 6 || f.y > 3000) f.dead = true;
    }
    this.flares = this.flares.filter(f => !f.dead);
    // ------------------------------------------------ burning flares: light, smoke, a ring nothing wants to cross
    for (const b of this.burning) {
      b.t += dt;
      b.tick -= dt;
      const k = this.burnK(b);
      if (rand.next() < dt * 30 * k) s.main.glowParticles.spawn({ frame: A.dot, x: b.x + b.dir * 4, y: b.y - 3, vx: rand.range(-40, 40), vy: rand.range(-90, -20), ay: 160, life: rand.range(0.2, 0.5), color: [1, rand.range(0.5, 0.9), 0.4], glow: true, intensity: 2, alpha: 1, alpha1: 0, floorY: b.y });
      if (rand.next() < dt * 4 * k) this.smoke(b.x + b.dir * 4, b.y - 8, 1, 0.42, true);
      if (b.tick <= 0) {
        b.tick = 0.8;
        sfxArm('flareBurn', { x: b.x, vol: 0.6 * k });
        if (k > 0.2) for (const a of s.animals) {
          if (!isPredator(a)) continue;
          const st = predState(a);
          if (st.asleep > 0 || st.script) continue;
          if (Math.abs(a.x - b.x) < 78) deter(s, a, 'fire', 0.5, { x: b.x });
        }
      }
      // the no-go ring: a predator (awake, not scripted) is pushed back out of it
      if (k > 0.2) for (const a of s.animals) {
        if (!isPredator(a)) continue;
        const st = predState(a);
        if (st.asleep > 0 || st.script) continue;
        const d = a.x - b.x, R = 62;
        if (Math.abs(d) < R) { const push = Math.sign(d || a.facing) * (R - Math.abs(d)); a.x += clamp(push, -140 * dt, 140 * dt); }
      }
    }
    this.burning = this.burning.filter(b => b.t < b.life);
    // ------------------------------------------------ bear bangers: the string lands, the fuse runs, then a long run of bangs
    for (const g of this.bangers) {
      if (g.dead) continue;
      g.t += dt; g.spin += dt * 12;
      g.vy += G_THROW * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      if (rand.next() < dt * 40) s.main.glowParticles.spawn({ frame: A.dot, x: g.x - 3, y: g.y - 3, vx: rand.range(-20, 20), vy: rand.range(-40, -10), ay: 60, life: 0.25, color: [1, 0.85, 0.4], glow: true, intensity: 2.4, alpha: 1, alpha1: 0 });
      const gy = this.groundAt(g.x, g.y);
      const hitA = this.animalAt(g.x, g.y, { sx: 0.15, solid: false });
      if ((g.vy > 0 && g.y >= gy) || hitA || g.t > 3) {
        g.dead = true;
        const tg = this.target(g.x, g.y, 30);
        if (tg) tg.hit(1, g.x, g.y);
        this.fuses.push({ x: g.x, y: Math.min(g.y, gy), t: 0, n: 9, next: 0.45, owner: g.owner });
      }
    }
    this.bangers = this.bangers.filter(g => !g.dead);
    for (const f of this.fuses) {
      f.t += dt;
      if (rand.next() < dt * 30) s.main.glowParticles.spawn({ frame: A.dot, x: f.x, y: f.y - 2, vx: rand.range(-30, 30), vy: rand.range(-50, -10), ay: 100, life: 0.25, color: [1, 0.85, 0.4], glow: true, intensity: 2.2, alpha: 1, alpha1: 0 });
      if (f.t >= f.next && f.n > 0) {
        f.n--;
        f.next = f.t + rand.range(0.11, 0.26);
        const px = f.x + rand.range(-38, 38), gy = this.groundAt(px, f.y);
        const py = gy - rand.range(2, 14);
        this.pops.push({ x: px, y: py, t: 0 });
        sfxArm('bangerPop', { x: px, pitch: rand.range(0.85, 1.2) });
        s.st.shake(1.1, 0.12);
        for (let i = 0; i < 7; i++) s.main.particles.spawn({ frame: this.fr.paper[i % 3], x: px, y: py, vx: rand.range(-70, 70), vy: rand.range(-120, -30), ay: 260, life: rand.range(0.7, 1.4), vrot: rand.range(-12, 12), alpha: 1, alpha1: 0.4, floorY: gy, onFloor: 'stop' });
        for (let i = 0; i < 6; i++) s.main.glowParticles.spawn({ frame: A.dot, x: px, y: py, vx: rand.range(-110, 110), vy: rand.range(-120, 20), ay: 300, life: rand.range(0.12, 0.3), color: [1, 0.8, 0.4], glow: true, intensity: 2.6, alpha: 1, alpha1: 0 });
        this.smoke(px, py, 1, 0.45);
        deterArea(s, px, py - 8, 56, 'banger', 0.6);
        for (const a of s.animals) if (!isPredator(a) && !a.dead && Math.abs(a.x - px) < 120) this.fright(a, px, py, a.x - px, f.owner);
      }
    }
    this.fuses = this.fuses.filter(f => f.n > 0 || f.t < f.next);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < 0.22);
    // ------------------------------------------------ the net
    for (const n of this.nets) {
      if (n.dead) continue;
      n.t += dt;
      n.open = Math.min(1, n.open + dt / 0.28);
      for (let i = 0; i < 3 && !n.dead; i++) {
        const h = dt / 3;
        n.vy += G_NET * h; n.x += n.vx * h; n.y += n.vy * h;
        const w = 4 + n.open * 18;
        let a = this.animalAt(n.x, n.y, { sx: 0, top: 0, solid: false });
        if (!a) for (const dx of [-w, w]) { a = this.animalAt(n.x + dx * 0.8, n.y, { sx: 0, top: 0, solid: false }); if (a) break; }
        if (a) {
          n.dead = true;
          sfxArm('netSnap', { x: n.x });
          if (isPredator(a)) { deter(s, a, 'net', 1, { x: n.x }); this.drapes.push({ a, t: 0, big: isBig(a), off: rand.next() * 6 }); this.kick(a, 'net'); }
          else { this.fright(a, n.x, n.y, n.vx, n.owner); this.drop('net', n.x, this.groundAt(n.x, n.y)); }
          break;
        }
        const tg = this.target(n.x, n.y, w * 0.7);
        if (tg) { n.dead = true; tg.hit(1, n.x, n.y); sfxArm('netSnap', { x: n.x, vol: 0.6 }); this.drop('net', n.x, this.groundAt(n.x, n.y)); break; }
        const gy = this.groundAt(n.x, n.y);
        if (n.vy > 0 && n.y >= gy) { n.dead = true; sfxArm('netSnap', { x: n.x, vol: 0.5, pitch: 0.8 }); this.dust(n.x, gy, 8); this.drop('net', n.x, gy); break; }
      }
      if (n.t > 5) n.dead = true;
    }
    this.nets = this.nets.filter(n => !n.dead);
    // ------------------------------------------------ darts
    for (const d of this.darts) {
      if (d.dead) continue;
      d.t += dt;
      for (let i = 0; i < 4 && !d.dead; i++) {
        const h = dt / 4;
        d.vy += G_DART * h; d.x += d.vx * h; d.y += d.vy * h;
        const a = this.animalAt(d.x, d.y);
        if (a) {
          d.dead = true;
          sfxArm('dartHit', { x: d.x });
          const dir = Math.sign(d.vx) || 1;
          this.stuck.push({ a, dx: (d.x - a.x) * (a.facing || 1), dy: d.y - a.y, t: 0, dir: dir * (a.facing || 1) });
          if (isPredator(a)) { deter(s, a, 'dart', 1, { x: d.x }); this.kick(a, 'tranq'); }
          else this.fright(a, d.x, d.y, d.vx, d.owner);
          break;
        }
        const tg = this.target(d.x, d.y);
        if (tg) { d.dead = true; tg.hit(0.6, d.x, d.y); sfxArm('dartHit', { x: d.x, vol: 0.6 }); break; }
        const gy = this.groundAt(d.x, d.y);
        if (d.y >= gy) { d.dead = true; this.dust(d.x, gy, 2); break; }
      }
      if (d.t > 3) d.dead = true;
    }
    this.darts = this.darts.filter(d => !d.dead);
    for (const k of this.stuck) k.t += dt;
    this.stuck = this.stuck.filter(k => k.t < 9 && !k.a.gone && !k.a.dead);
    // ------------------------------------------------ bear spray: a short cone of pepper fog
    for (const c of this.cones) {
      c.t += dt;
      const fr = fx11Frames();
      for (let n = c.t < 0.5 ? Math.floor(dt * 70 + rand.next()) : 0; n > 0; n--) {
        const sp = rand.range(150, 260);
        const ang = rand.range(-0.22, 0.22);
        s.main.particles.spawn({ frame: fr.pepper[Math.floor(rand.next() * fr.pepper.length)], x: c.x, y: c.y, vx: c.dir * sp * Math.cos(ang) + s.st.wind * 20, vy: sp * Math.sin(ang) - 8, drag: 2.6, life: rand.range(0.6, 1.1), size: 0.25, size1: rand.range(0.7, 1.1), color: [1, 0.9, 0.82], alpha: 0.9, alpha1: 0 });
        if (rand.next() < 0.5) s.main.particles.spawn({ frame: A.dot, x: c.x, y: c.y, vx: c.dir * sp * 1.1, vy: rand.range(-30, 30), drag: 3, life: 0.5, color: [1, 0.55, 0.25], alpha: 1, alpha1: 0 });
      }
      // (anything the slingshot could knock down, in the cone's reach, gets a faceful too)
      if (!c.tg) { c.tg = true; for (const tg of shootTargets()) { const dx = (tg.x - c.x) * c.dir; if (dx > -4 && dx < 92 && Math.abs(tg.y - c.y) < 12 + dx * 0.42) tg.hit(0.5, tg.x, tg.y); } }
      if (c.t < 0.4) for (const a of s.animals) {
        if (c.hit.has(a) || a.dead || a.gone || !a.body) continue;
        const b = a.body.bounds(a);
        const near = c.dir > 0 ? b.x0 - c.x : c.x - b.x1;
        if (near > 92 || (c.dir > 0 ? b.x1 < c.x : b.x0 > c.x)) continue;
        const reach = Math.max(0, near);
        const half = 10 + reach * 0.42;
        if (b.y1 < c.y - half - 10 || b.y0 > c.y + half + 10) continue;
        c.hit.add(a);
        if (isPredator(a)) { deter(s, a, 'spray', c.power * clamp(1.7 - reach / 60, 0.5, 1.7), { x: c.x + c.dir * reach }); this.kick(a, 'spray'); }
        else this.fright(a, c.x, c.y, c.dir, c.owner);
      }
    }
    this.cones = this.cones.filter(c => c.t < 1.1);
    // ------------------------------------------------ the predators' state: drowse, sleep, holds
    this.tickPredators(dt);
    // ------------------------------------------------ things on the ground
    for (const l of this.lying) l.t += dt;
  }

  private tickPredators(dt: number) {
    const s = this.s;
    for (const a of s.animals) {
      if (!PREDATORS[a.species] || a.dead) continue;
      sleepPose(a.species);
      const st = predState(a), d = PREDATORS[a.species];
      // drowse wears off once the darts stop coming
      if (st.drowse > 0 && st.sinceHit > 8 && st.asleep <= 0) st.drowse = Math.max(0, st.drowse - dt * 0.09);
      if (st.asleep > 0) {
        this.wasAsleep.add(a);
        st.asleep = Math.max(0, st.asleep - dt);
        st.stun = Math.max(st.stun, st.asleep);
        a.vx = 0;
        const n = (this.snoreT.get(a) ?? 1.5) - dt;
        this.snoreT.set(a, n <= 0 ? rand.range(2.6, 3.4) : n);
        if (n <= 0) sfxArm('snore', { x: a.x, pitch: d.tier >= 3 ? 0.8 : 1.1 });
      } else if (this.wasAsleep.has(a)) {
        // awake, groggy: it has had enough of this place
        this.wasAsleep.delete(a);
        emitPred('wake', { a, x: a.x });
        if (st.phase !== 'retreat' && !st.script) {
          st.phase = 'retreat';
          st.rest = d.restTime;
          st.target = null;
          st.nerve = Math.min(st.nerve, 0);
          emitPred('break', { a });
          d.onBreak?.(a, s);
        }
      }
      if (st.tangle > 0) { st.tangle = Math.max(0, st.tangle - dt); st.stun = Math.max(st.stun, st.tangle); }
      if (st.netted > 0) { st.netted = Math.max(0, st.netted - dt); st.stun = Math.max(st.stun, st.netted); }
      if (st.slow > 0) st.slow = Math.max(0, st.slow - dt);
      // a net on a big one: every step it takes is a third of a step
      const lx = this.lastX.get(a);
      if (st.slow > 0 && lx !== undefined && st.asleep <= 0 && !st.script) a.x = lx + (a.x - lx) * 0.33;
      this.lastX.set(a, a.x);
    }
    // the bolas lets go when the tangle is over (it falls where it was); so does the net
    for (const w of this.wraps) {
      w.t += dt;
      const st = predState(w.a);
      if (st.tangle <= 0 || w.a.gone || w.a.dead) { this.drop('bolas', w.a.x, this.groundAt(w.a.x, w.a.y)); w.t = -1; }
    }
    this.wraps = this.wraps.filter(w => w.t >= 0);
    for (const n of this.drapes) {
      n.t += dt;
      const st = predState(n.a);
      if ((n.big ? st.slow : st.netted) <= 0 || n.a.gone || n.a.dead) { this.drop('net', n.a.x, this.groundAt(n.a.x, n.a.y)); n.t = -1; }
    }
    this.drapes = this.drapes.filter(n => n.t >= 0);
  }

  // ---------------------------------------------------------------- bits
  private burnK(b: Burning) { const left = b.life - b.t; return left < 4 ? clamp(left / 4) * (0.6 + 0.4 * Math.sin(this.t * 31)) : 1; }
  /** a flare lands and burns: a light, smoke, the no-go ring */
  private light(x: number, gy: number, dir: number) {
    this.burning.push({ x, y: gy, t: 0, life: 24, tick: 0.3, dir: dir >= 0 ? 1 : -1 });
    if (this.burning.length > 4) this.burning.shift();
  }
  /** the flash: blinding for everything close, and a white-out on screen if Mori looks into it */
  flash(x: number, y: number, k: number) {
    const s = this.s;
    s.main.glowParticles.spawn({ frame: this.fr.pop[0], x, y, life: 0.16, size: 1.4 * k, size1: 2.2 * k, color: [1, 0.95, 0.9], glow: true, intensity: 2.2, alpha: 1, alpha1: 0 });
    s.main.glowParticles.spawn({ frame: this.fr.pop[1], x, y, life: 0.28, size: 2 * k, size1: 3.2 * k, color: [1, 0.6, 0.4], glow: true, intensity: 1.6, alpha: 1, alpha1: 0 });
    for (let i = 0; i < 20 * k; i++) s.main.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-160, 160), vy: rand.range(-180, 40), ay: 260, life: rand.range(0.25, 0.6), color: [1, rand.range(0.4, 0.85), 0.35], glow: true, intensity: 2.6, alpha: 1, alpha1: 0, lightR: 14 });
    if (Math.abs(s.player.x - x) < 140) game.r.post.flash = Math.max(game.r.post.flash, 0.35 * k);
    s.st.shake(1.6 * k, 0.2);
    deterArea(s, x, y, 54 * k, 'flare', 0.8 * k);
  }
  private smoke(x: number, y: number, n: number, a: number, slow = false) {
    const fr = fx11Frames();
    for (let i = 0; i < n; i++) this.s.main.particles.spawn({ frame: fr.puff[Math.floor(rand.next() * 3)], x: x + rand.range(-2, 2), y, vx: rand.range(-8, 8) + this.s.st.wind * (slow ? 14 : 6), vy: rand.range(slow ? -22 : -14, slow ? -12 : -4), drag: 0.6, life: rand.range(slow ? 2.4 : 0.9, slow ? 3.6 : 1.6), size: 0.18, size1: slow ? 0.9 : 0.55, color: [1, 1, 1], alpha: a, alpha1: 0 });
  }
  private dust(x: number, gy: number, n: number) {
    for (let i = 0; i < n; i++) this.s.main.particles.spawn({ frame: A.dot2, x, y: gy - 1, vx: rand.range(-40, 40), vy: rand.range(-60, -15), ay: 220, life: 0.45, color: [0.55, 0.45, 0.33], alpha: 0.9, alpha1: 0, floorY: gy });
  }
  /** a spent bolas or net on the ground: walk up and press E to take it back */
  private drop(kind: 'bolas' | 'net', x: number, y: number) {
    const s = this.s;
    const l: Lying = { kind, x, y, dead: false, t: 0, it: null as unknown as Interactable };
    const it: Interactable = {
      x, y, w: kind === 'net' ? 26 : 14, h: 10, standX: x - 12,
      label: kind === 'net' ? 'Gather up the net' : 'Pick up the bolas',
      enabled: () => !l.dead,
      action: () => {
        if (l.dead) return;
        const id: WeaponId = kind === 'net' ? 'net' : 'bolas';
        if (ammo(id) >= ammoMax(id)) { game.ui.bubbles.bark(s.player.id, `No room for another ${WEAPON_BY_ID[id].unit[0]}.`, { expr: 'thinking' } as never); return; }
        l.dead = true;
        addAmmo(id, 1);
        const i = s.interact.indexOf(it);
        if (i >= 0) s.interact.splice(i, 1);
        audio.play('collectPop' as never, { vol: 0.5 });
        s.player.body.react('bounce');
        game.persist();
      },
    } as Interactable;
    l.it = it;
    s.interact.push(it);
    this.lying.push(l);
    if (this.lying.length > 8) { const o = this.lying.shift()!; o.dead = true; const i = s.interact.indexOf(o.it); if (i >= 0) s.interact.splice(i, 1); }
  }

  // ---------------------------------------------------------------- draw
  draw(r: Renderer) {
    const fr = this.fr, s = this.s;
    // the burning flares on the ground: the stick, the flame, the light (it lights the night)
    for (const b of this.burning) {
      const k = this.burnK(b);
      const flick = 0.85 + 0.15 * Math.sin(this.t * 23 + b.x) + 0.08 * Math.sin(this.t * 57);
      r.draw(fr.stick, b.x, b.y - 1, b.dir, 1);
      if (k > 0.05) {
        const fx = b.x + b.dir * 5;
        r.emissive(1);
        r.draw(fr.flame[Math.floor(this.t * 14 + b.x) % 3], fx, b.y - 2, b.dir * (0.8 + k * 0.3), 0.7 + k * 0.5 * flick);
        r.emissive();
        r.light(fx, b.y - 8, 110 * k * flick + 20, 1, 0.4, 0.32, 1.15 * k * flick, 0.25);
        r.light(fx, b.y - 4, 26, 1, 0.8, 0.6, 0.9 * k, 0.6);
      }
    }
    // stones and nets lying where they fell
    for (const l of this.lying) {
      if (l.dead) continue;
      if (l.kind === 'bolas') r.draw(fr.bolasLie, l.x, l.y + 1);
      else this.meshFlat(r, l.x, l.y, 26);
    }
    // the bolas wrapped round a predator's legs
    for (const w of this.wraps) this.drawWrap(r, w);
    // nets over predators
    for (const n of this.drapes) this.drawDrape(r, n);
    // darts stuck in hides
    for (const k of this.stuck) {
      const ax = k.a.x + k.dx * (k.a.facing || 1), ay = k.a.y + k.dy;
      r.draw(k.dir * (k.a.facing || 1) > 0 ? fr.dart : fr.dartL, ax - Math.sign(k.dir * (k.a.facing || 1)) * 2, ay);
    }
    // Zzz over sleepers
    for (const a of s.animals) {
      if (!PREDATORS[a.species] || a.dead) continue;
      const st = predState(a);
      if (st.asleep <= 0) continue;
      const [hx, hy] = a.body.head(a);
      for (let i = 0; i < 3; i++) {
        const u = (this.t * 0.45 + i / 3) % 1;
        const zx = hx + a.facing * (4 + u * 10) + Math.sin(u * 6 + i) * 2, zy = hy - 6 - u * 22;
        r.emissive(0.6);
        r.draw(fr.z[Math.min(2, Math.floor(u * 3))], Math.round(zx), Math.round(zy), 1, 1, 0, packColor(1, 1, 1, clamp(Math.min(u * 5, (1 - u) * 3))));
        r.emissive();
      }
    }
    // things in the air
    for (const b of this.bolas) r.draw(fr.bolas[Math.floor(b.spin) % 8], Math.round(b.x), Math.round(b.y));
    for (const f of this.flares) {
      r.emissive(1);
      r.draw(fr.flare[Math.floor(this.t * 20) % 2], Math.round(f.x), Math.round(f.y));
      r.emissive();
      r.light(f.x, f.y, 56, 1, 0.45, 0.32, 1.2, 0.4);
    }
    for (const g of this.bangers) r.draw(fr.banger[Math.floor(g.spin) % 2], Math.round(g.x), Math.round(g.y), Math.sign(g.vx) || 1, 1);
    for (const f of this.fuses) {
      if (f.n <= 0) continue;
      r.draw(fr.banger[0], f.x, f.y - 2, 1, 1);
      r.light(f.x, f.y - 3, 22, 1, 0.75, 0.4, 0.6);
    }
    for (const p of this.pops) {
      r.emissive(1);
      r.draw(fr.pop[p.t < 0.08 ? 0 : 1], Math.round(p.x), Math.round(p.y), 1, 1);
      r.emissive();
      r.light(p.x, p.y, 70 * (1 - p.t / 0.22), 1, 0.8, 0.55, 1.8 * (1 - p.t / 0.22));
    }
    for (const n of this.nets) this.meshFly(r, n);
    // the spray's fan of pepper fog: dithered specks streaming out of the nozzle and spreading
    for (const c of this.cones) {
      const grow = Math.min(1, c.t * 3), fade = c.t < 0.5 ? 1 : Math.max(0, 1 - (c.t - 0.5) / 0.6);
      for (let k = 0; k < 90; k++) {
        const h1 = frac(Math.sin(k * 12.9898 + c.x) * 43758.5), h2 = frac(Math.sin(k * 78.233 + c.y) * 12345.67), h3 = frac(Math.sin(k * 3.7 + c.t) * 999.1);
        if (h3 > fade) continue;
        const d = (0.15 + h1 * 0.85) * 88 * grow + c.t * 14;
        const x = c.x + c.dir * d + this.s.st.wind * c.t * 10, y = c.y + (h2 - 0.5) * (8 + d * 0.84) - c.t * 6 * h1;
        const col = h1 < 0.3 ? packColor(1, 0.72, 0.4, 1) : h1 < 0.7 ? packColor(0.94, 0.48, 0.22, 1) : packColor(0.72, 0.28, 0.14, 1);
        const sz = d < 30 && h2 > 0.5 ? 2 : 1;
        r.rect(Math.round(x), Math.round(y), sz, sz, col);
      }
    }
    for (const d of this.darts) r.draw(d.vx >= 0 ? fr.dart : fr.dartL, Math.round(d.x), Math.round(d.y));
  }

  /** one world pixel (crisp) */
  private px(r: Renderer, x: number, y: number, c: number) { r.rect(Math.round(x), Math.round(y), 1, 1, c); }
  /** a cord of world pixels from a to b, sagging in the middle */
  private cord(r: Renderer, x0: number, y0: number, x1: number, y1: number, c: number, sag = 0) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    let lx = 1e9, ly = 1e9;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * sag);
      if (x === lx && y === ly) continue;
      lx = x; ly = y;
      r.rect(x, y, 1, 1, c);
    }
  }
  private drawWrap(r: Renderer, w: Wrap) {
    const a = w.a, b = a.body.bounds(a), fr = this.fr;
    const W = b.x1 - b.x0, H = b.y1 - b.y0;
    const x0 = b.x0 + W * 0.22, x1 = b.x1 - W * 0.22;
    const yb = b.y1 - H * 0.18, yt = b.y1 - H * 0.42;
    const cA = packColor(0.85, 0.72, 0.48, 1), cB = packColor(0.55, 0.42, 0.24, 1);
    const jig = Math.sin(this.t * 16 + w.seed) * (predState(a).stun > 0.5 ? 1 : 0);
    // three turns of cord round the legs, crossing
    for (let i = 0; i < 3; i++) {
      const y0 = yt + (yb - yt) * (i / 2), y1 = yt + (yb - yt) * ((i + 1) % 3 / 2);
      this.cord(r, x0 + jig, y0, x1 + jig, y1, i % 2 ? cB : cA, 1.5);
    }
    // the stones dangling, swinging a little
    for (let i = 0; i < 3; i++) {
      const sx = x0 + (x1 - x0) * (0.15 + i * 0.35) + jig, sy = yb + 3 + Math.sin(this.t * 5 + i * 2 + w.seed) * 1.5;
      this.cord(r, sx, yb, sx, sy, cB);
      r.draw(fr.stone, Math.round(sx), Math.round(sy));
    }
    r.draw(fr.knot, Math.round((x0 + x1) / 2 + jig), Math.round(yt));
  }
  /** the net over a predator: a mesh from its back down past its belly, the weights at the hem */
  private drawDrape(r: Renderer, n: Drape) {
    const a = n.a, b = a.body.bounds(a);
    const st = predState(a);
    const W = b.x1 - b.x0, H = b.y1 - b.y0;
    const struggle = (n.big ? st.slow : st.netted) > 0 ? Math.sin(this.t * (n.big ? 6 : 14) + n.off) * (n.big ? 1 : 2) : 0;
    const x0 = b.x0 + W * 0.06 + struggle, x1 = b.x1 - W * 0.06 + struggle;
    // the net hugs the animal's back (its silhouette) and hangs to below its belly
    const pts = a.body.points(a);
    const topAt = (x: number) => {
      let t = Infinity;
      for (const [px, py] of pts) if (Math.abs(px - x) < 7 && py < t) t = py;
      return Number.isFinite(t) ? t - 1 : b.y0 + H * (n.big ? 0.3 : 0.12);
    };
    const bot = b.y1 - 2;
    const cA = packColor(0.8, 0.76, 0.6, 1), cB = packColor(0.56, 0.52, 0.4, 1), knot = packColor(0.92, 0.9, 0.76, 1);
    const cols = Math.max(3, Math.round((x1 - x0) / 8)), rws = Math.max(2, Math.round((bot - b.y0) / 8));
    // a diamond lattice: odd rows shifted half a mesh, every node a little off true
    const P = (i: number, j: number): [number, number] => {
      const u = Math.max(0, Math.min(1, (i + (j & 1) * 0.5) / cols)), v = j / rws;
      const x = x0 + (x1 - x0) * u;
      const tp = topAt(x);
      const jx = (Math.sin(i * 12.9 + j * 7.1 + n.off) * 0.8), jy = Math.sin(i * 5.3 + j * 3.7 + n.off) * 0.7;
      return [x + jx, tp + (bot - tp) * v + jy + Math.sin(Math.PI * u) * v * 1.5];
    };
    for (let j = 0; j < rws; j++) for (let i = 0; i <= cols; i++) {
      const [ax, ay] = P(i, j);
      const d = j & 1 ? 1 : 0;
      for (const ni of [i - 1 + d, i + d]) { if (ni < 0 || ni > cols) continue; const [bx, by] = P(ni, j + 1); this.cord(r, ax, ay, bx, by, (i + j) % 2 ? cA : cB, 0.5); }
      this.px(r, ax, ay, knot);
    }
    const wt = packColor(0.32, 0.34, 0.38, 1);
    for (let i = 0; i <= cols; i += Math.max(1, Math.floor(cols / 3))) { const [wx, wy] = P(i, rws); r.rect(Math.round(wx) - 1, Math.round(wy), 2, 2, wt); }
  }
  /** the net in flight: a bundle that unfurls into a square of mesh, four weights at the corners */
  private meshFly(r: Renderer, n: NetFly) {
    const w = 3 + n.open * 18, h = 2 + n.open * 9;
    const cA = packColor(0.88, 0.86, 0.7, 1), cB = packColor(0.62, 0.6, 0.46, 1);
    const sag = n.open * 3;
    const dir = Math.sign(n.vx) || 1;
    const c = (u: number, v: number): [number, number] => [n.x + (u - 0.5) * w * 2 * (0.7 + 0.3 * v) - dir * v * 3, n.y + (v - 0.5) * h * 2 + Math.sin(Math.PI * u) * sag * (1 - v)];
    const N = Math.max(2, Math.round(n.open * 5));
    for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) { const [ax, ay] = c(i / N, j / N), [bx, by] = c((i + 1) / N, j / N); this.cord(r, ax, ay, bx, by, j % 2 ? cB : cA); }
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { const [ax, ay] = c(i / N, j / N), [bx, by] = c(i / N, (j + 1) / N); this.cord(r, ax, ay, bx, by, i % 2 ? cA : cB); }
    const wt = packColor(0.3, 0.32, 0.36, 1);
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const [x, y] = c(u, v); r.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, wt); }
  }
  /** a net lying on the ground: a low heap of mesh */
  private meshFlat(r: Renderer, x: number, y: number, w: number) {
    const cA = packColor(0.82, 0.8, 0.64, 1), cB = packColor(0.55, 0.53, 0.4, 1);
    for (let i = 0; i < w; i++) {
      const hgt = Math.round(Math.sin((i / w) * Math.PI) * 3);
      for (let k = 0; k <= hgt; k++) if ((i + k) % 2 === 0) this.px(r, x - w / 2 + i, y - k, k === hgt ? cA : cB);
    }
    const wt = packColor(0.3, 0.32, 0.36, 1);
    r.rect(Math.round(x - w / 2) - 1, Math.round(y) - 1, 2, 2, wt); r.rect(Math.round(x + w / 2) - 1, Math.round(y) - 1, 2, 2, wt);
  }

  get busy() { return this.bolas.length + this.flares.length + this.bangers.length + this.nets.length + this.darts.length > 0; }

  dispose() {
    for (const l of this.lying) { const i = this.s.interact.indexOf(l.it); if (i >= 0) this.s.interact.splice(i, 1); }
    this.lying = [];
  }
}
void hex;
function frac(v: number) { return v - Math.floor(v); }
