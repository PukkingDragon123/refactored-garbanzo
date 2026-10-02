// V11 predators: the Cerebral Tiger in the world. Its Body (the painted frames of src/art/v11/tiger.ts,
// dry or dripping wet, cropped at the mud line when it lies in a wallow, shedding drips and clods),
// the mud wallows it lives in, and its behaviour on top of the wildlife brain (wild/animal.ts):
//
//   lurk      under a wallow: only the dome, the eye turrets, the sealed ears and the nostrils out
//             (photographable: "lurking"); now and then it slides right under (bubbles only)
//   wallow    lolling half-sunk in the mud, eyes shut ("wallowing")
//   prowl     a heavy, rolling walk between wallows at dawn and dusk ("prowling")
//   stalk     low and slow toward its target ("stalking")
//   emerge    the wallow bulges and erupts: the ambush
//   charge    a short, crushing rush ("charging"); then a pounce or a swipe
//   roar      when a rush fails or it is defied ("roaring"); everything small in earshot bolts
//   flinch / stunned   pebbles, pepper and crackers
//   retreat   nerve gone: it backs off snarling, then goes home to the mud and sinks out of sight
//   shake     shaking off the mud ("shaking")
//
// Targets: Mori, and the companions (it fancies Chunk). Reaching one means a knock-down
// (predators-core.ts knockDown). Hunts Bonefaces, Shieldbacks and Quillhogs too.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { FieldScene } from '../scenes/field';
import { Animal, Body, SPECIALS, HOOKS, catchPrey } from '../wild/animal';
import type { Box, POI } from '../wild/world';
import { BODY_MAKERS, drawEmote } from '../wild/bodies';
import { tigerFrame, TIGER_ANIMS, TigerFrame } from '../../art/v11/tiger';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix } from '../../art/color';
import { local, A } from '../assets';
import { game } from '../game';
import { rand, clamp } from '../../core/math';
import {
  registerPredator, predState, PredState, isPredator, targetPos, emitPred, knockDown, Target11,
} from './predators-core';
import { sfx11 } from './predators-sfx';
import { fx11Frames } from './predators-fx';
import { TIGER_ID } from './species-tiger';

const T = TIGER_ID;
export const animDur = (n: string) => { const i = TIGER_ANIMS[n]; return i ? i.frames / i.fps : 0.5; };

// ------------------------------------------------------------------ warming (paint the strips ahead of time)
const ALL = Object.keys(TIGER_ANIMS);
let warmQ: string[] | null = null;
/** paint every strip now (blocking: call while a scene builds) */
export function warmTiger() { for (const a of ALL) tigerFrame(a, 0); warmQ = []; }
/** paint the strips one per call (call every frame or so until it returns true) */
export function warmTigerStep(): boolean {
  if (!warmQ) warmQ = ALL.slice();
  const a = warmQ.shift();
  if (a) tigerFrame(a, 0);
  return warmQ.length === 0;
}

// ------------------------------------------------------------------ the body
const SPEED: Record<string, number> = { prowl: 32, stalk: 16, charge: 131, retreat: 23 };

let frOwner: unknown = null;
const atlasFr = new Map<string, Frame>();
function frameOf(tf: TigerFrame, key: string, wet: boolean): Frame {
  if (frOwner !== local) { atlasFr.clear(); frOwner = local; }
  const k = key + (wet ? '|w' : '|d');
  let f = atlasFr.get(k);
  if (!f) { f = local.add('v11:tg:' + k, wet ? tf.wet : tf.dry, tf.ax, tf.ay); atlasFr.set(k, f); }
  return f;
}

export class TigerBody implements Body {
  private t = 0;
  cur = 'idle';
  /** 0 dry .. 1 sheeted in wet mud */
  wet = 0;
  /** px of the sprite hidden under the mud surface (lying in a wallow) */
  sink = 0;
  private sinkTo = 0;
  private last: TigerFrame | null = null;
  private dripT = 0;
  constructor(readonly a: Animal) {}

  get frameIndex(): number {
    const info = TIGER_ANIMS[this.cur];
    const n = Math.floor(this.t * info.fps);
    return info.loop ? n % info.frames : Math.min(info.frames - 1, n);
  }
  /** a one-shot anim has played through */
  get done() { const i = TIGER_ANIMS[this.cur]; return !i.loop && this.t >= i.frames / i.fps; }
  /** restart the current anim (one-shots) */
  restart() { this.t = 0; }

  update(dt: number, a: Animal) {
    const name = TIGER_ANIMS[a.anim] ? a.anim : a.anim === 'walk' || a.anim === 'wander' ? 'prowl' : a.anim === 'run' || a.anim === 'attack' ? 'charge' : 'idle';
    if (name !== this.cur) { this.cur = name; this.t = 0; }
    const sp = SPEED[name];
    this.t += sp ? dt * clamp(Math.abs(a.vx) / sp, 0.25, 1.8) : dt;
    // in the mud it is wet; out of it the mud slowly dries to a crust
    const mudAct = a.act === 'lurk' || a.act === 'wallow' || a.act === 'emerge' || a.act === 'submerge';
    this.wet = mudAct ? 1 : Math.max(0, this.wet - dt / 45);
    this.sinkTo = a.act === 'wallow' ? 15 : 0;
    this.sink += (this.sinkTo - this.sink) * Math.min(1, dt * 3);
    // dripping, and clods kicked up at the gallop
    const s = a.host as unknown as FieldScene;
    const f = this.last;
    if (f && s.main && this.wet > 0.25 && a.hidden < 0.5 && !mudAct) {
      this.dripT -= dt * this.wet * (Math.abs(a.vx) > 40 ? 22 : 9);
      while (this.dripT < 0) {
        this.dripT += 1;
        const pts = f.pts.filter(q => q[1] > -34);
        const q = pts[Math.floor(rand.next() * pts.length)];
        if (!q) break;
        s.main.particles.spawn({ frame: fx11Frames().drop, x: a.x + q[0] * a.facing, y: a.y + q[1], vx: a.vx * 0.4, vy: rand.range(0, 20), ay: 380, life: 0.8, alpha: 1, alpha1: 0.6, floorY: a.y + 1, onFloor: 'die' });
      }
    }
    if (name === 'charge' && s.main && Math.abs(a.vx) > 60 && rand.next() < dt * 26) {
      const fr = fx11Frames();
      s.main.particles.spawn({ frame: fr.clod[Math.floor(rand.next() * 3)], x: a.x - a.facing * rand.range(10, 40), y: a.y - 2, vx: -a.facing * rand.range(40, 130), vy: rand.range(-140, -60), ay: 420, life: 1, vrot: rand.range(-12, 12), alpha: 1, alpha1: 1, floorY: a.y + 2, onFloor: 'stop' });
    }
  }

  private frame(a: Animal): TigerFrame {
    const eye = a.eye === 'scared' ? 'alert' : a.eye;
    const f = tigerFrame(this.cur, this.frameIndex, this.eyeFor(a, eye));
    this.last = f;
    return f;
  }
  /** the painter's own eyes for anims that need them (closed in the stun etc.), else the brain's mood */
  private eyeFor(a: Animal, eye: string): 'open' | 'alert' | 'angry' | 'scared' | 'closed' {
    if (this.cur === 'stunned' || this.cur === 'sleep' || (this.cur === 'flinch' && this.frameIndex < 2)) return 'closed';
    if (this.cur === 'charge' || this.cur === 'pounce' || this.cur === 'swipe' || this.cur === 'roar' || this.cur === 'stalk' || this.cur === 'emerge') return 'angry';
    if (this.cur === 'wallow' && a.act === 'wallow') return 'closed';
    return eye as 'open';
  }

  draw(r: Renderer, a: Animal) {
    if (a.hidden >= 0.98) return;
    const f = this.frame(a);
    const key = `${this.cur}|${this.frameIndex}|${this.eyeFor(a, a.eye === 'scared' ? 'alert' : a.eye)}`;
    const fr = frameOf(f, key, this.wet > 0.5);
    const col = packColor(1, 1, 1, a.alpha);
    const s = a.host as unknown as FieldScene;
    const ground = Math.abs(a.y - s.st.terrain.groundY(a.x)) < 6;
    const inMud = this.cur === 'wallow' || this.cur === 'emerge' || this.cur === 'submerge';
    if (!inMud && ground && this.sink < 1) {
      r.beginShadows();
      r.draw(A.shadow, a.x, a.y, Math.max(1, fr.w / 34), 0.9, 0, packColor(0, 0, 0, 0.4 * a.alpha));
      r.endShadows();
    }
    const sink = Math.round(this.sink);
    if (sink > 0) {
      // lying in the mud: only what is above the surface
      const keep = Math.max(1, fr.h - (fr.h - fr.ay) - sink);
      const tex = fr.tex, tw = tex.w, th = tex.h;
      const u0 = fr.u0 * tw, v0 = fr.v0 * th;
      const sub: Frame = { tex, u0: u0 / tw, v0: v0 / th, u1: (u0 + fr.w) / tw, v1: (v0 + keep) / th, w: fr.w, h: keep, ax: fr.ax, ay: keep };
      r.draw(sub, a.x, a.y, a.facing, 1, 0, col);
    } else r.draw(fr, a.x, a.y, a.facing, 1, 0, col);
    const [hx, hy] = this.head(a);
    drawEmote(r, a, hx, hy - 6);
  }

  bounds(a: Animal): Box {
    const f = this.last ?? this.frame(a);
    const l = -f.ax, rr = f.dry.w - f.ax;
    const x0 = a.facing > 0 ? a.x + l : a.x - rr, x1 = a.facing > 0 ? a.x + rr : a.x - l;
    return { x0, y0: a.y - f.ay + this.sink * 0, x1, y1: a.y + (f.dry.h - f.ay) - this.sink };
  }
  head(a: Animal): [number, number] {
    const f = this.last ?? this.frame(a);
    return [a.x + f.head[0] * a.facing, a.y + f.head[1] + this.sink];
  }
  /** the mouth (for the roar's breath and the name card) */
  mouth(a: Animal): [number, number] {
    const f = this.last ?? this.frame(a);
    return [a.x + f.mouth[0] * a.facing, a.y + f.mouth[1] + this.sink];
  }
  points(a: Animal): [number, number][] {
    const f = this.last ?? this.frame(a);
    const out: [number, number][] = [];
    for (const [x, y] of f.pts) if (y < -this.sink) out.push([a.x + x * a.facing, a.y + y + this.sink]);
    return out.length ? out : [[a.x, a.y - 4]];
  }
}
BODY_MAKERS[T] = a => new TigerBody(a);
export const tigerBody = (a: Animal) => a.body as TigerBody;

// ------------------------------------------------------------------ mud wallows
let wallowOwner: unknown = null;
const wallowFr = new Map<number, Frame>();
function wallowFrame(w: number): Frame {
  if (wallowOwner !== local) { wallowFr.clear(); wallowOwner = local; }
  const W = Math.round(w);
  let f = wallowFr.get(W);
  if (f) return f;
  const h = 12;
  const b = new PixelBuffer(W + 16, h);
  const cx = (W + 16) / 2;
  const mudD = hex('#2a1d14'), mudM = hex('#3a2a1c'), mudL = hex('#54402a'), sheen = hex('#8c7a64'), rimD = hex('#5a4630'), rimL = hex('#7a6244');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < b.w; x++) {
      const u = (x + 0.5 - cx) / (W / 2 + 7), v = (y + 0.5 - 4) / 7.5;
      const d = u * u + v * v;
      if (d > 1) continue;
      const inner = (x + 0.5 - cx) ** 2 / ((W / 2) ** 2) + ((y + 0.5 - 3.6) / 5) ** 2;
      let c: number;
      if (inner < 1) {
        // the glossy surface: dark, with a band of sky sheen and broken highlights
        c = y < 2 ? mudL : y < 4 ? mudM : mudD;
        if (y === 1 && ((x * 7) % 11 < 6)) c = sheen;
        if (y === 2 && ((x * 13) % 17 < 3)) c = mudL;
      } else {
        // the churned, trampled rim with paw prints
        c = ((x * 5 + y * 3) % 7 < 3) ? rimL : rimD;
        if (y > 5 && (x % 13 === 4 || x % 13 === 5) && y % 3 === 0) c = mudD;
      }
      b.set(x, y, c);
    }
  b.outline(mix(hex('#1a120c'), hex('#3a2a1c'), 0.3));
  f = local.add('v11:wallow:' + W, b, b.w / 2, 4);
  wallowFr.set(W, f);
  return f;
}

/** a mud wallow on the forest floor: a POI 'mud' for the tiger (and the Bonefaces), bubbles, the bulge and the eruption */
export class MudWallow implements Drawable {
  z = 26;
  dead = false;
  /** 0..1: the surface heaving up (the ambush) */
  bulge = 0;
  private t = rand.next() * 10;
  private bubbles: { x: number; t: number; s: number }[] = [];
  readonly poi: POI;
  constructor(readonly s: FieldScene, readonly x: number, readonly y: number, readonly w = 130) {
    this.poi = { kind: 'mud', x, y, w: w / 2 };
    s.pois.push(this.poi);
  }
  /** a tiger is lurking under it: more bubbles */
  busy = 0;
  update(dt: number) {
    this.t += dt;
    const rate = 0.35 + this.busy * 1.4 + this.bulge * 5;
    if (rand.next() < dt * rate) {
      this.bubbles.push({ x: this.x + rand.range(-this.w * 0.42, this.w * 0.42) * (this.bulge > 0.1 ? 0.4 : 1), t: 0, s: rand.range(0.6, 1.2) + this.bulge });
      sfx11('glorp', { x: this.x, vol: 0.35 + this.bulge * 0.5, pitch: 0.8 + rand.next() * 0.5 });
    }
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter(b => b.t < 0.7);
  }
  /** the eruption: a fountain of mud clods and drops */
  erupt(x = this.x, k = 1) {
    const s = this.s, fr = fx11Frames();
    for (let i = 0; i < 60 * k; i++) {
      const big = i % 3 === 0;
      s.main.particles.spawn({
        frame: big ? fr.clod[i % 3] : fr.drop, x: x + rand.range(-30, 30), y: this.y - 2,
        vx: rand.range(-160, 160), vy: rand.range(-330, -90), ay: 520, life: rand.range(0.8, 1.5), vrot: big ? rand.range(-14, 14) : 0,
        size: big ? rand.range(1, 2.2) : 1, alpha: 1, alpha1: 1, floorY: this.y + 2, onFloor: 'stop',
      });
    }
    for (let i = 0; i < 10 * k; i++) s.main.particles.spawn({ frame: A.soft, x: x + rand.range(-26, 26), y: this.y - 6, vx: rand.range(-40, 40), vy: rand.range(-40, -10), life: 0.9, size: 0.9, size1: 1.6, color: [0.3, 0.22, 0.15], alpha: 0.6, alpha1: 0 });
    s.st.shake(5, 0.5);
    sfx11('mudBurst', { x });
  }
  draw(r: Renderer) {
    const f = wallowFrame(this.w);
    r.draw(f, this.x, this.y, 1, 1);
    // the bulge: a dome of mud heaving up, shiny on top
    if (this.bulge > 0.01) {
      const k = this.bulge;
      const h = 3 + k * 14, wv = 18 + k * 26;
      r.draw(A.blob, this.x, this.y + 1 - h * 0.5, wv / 8, h / 8, 0, packColor(0.2, 0.14, 0.1, 1));
      r.draw(A.blob, this.x - wv * 0.15, this.y - h * 0.8, wv / 24, h / 24, 0, packColor(0.52, 0.44, 0.36, 0.9));
    }
    for (const b of this.bubbles) {
      const k = b.t / 0.7;
      const rr = b.s * (0.18 + k * 0.25);
      r.draw(A.ring, b.x, this.y + 1 - (k < 0.6 ? k * 2 : 1.2), rr, rr * 0.7, 0, packColor(0.45, 0.36, 0.28, 1 - k));
    }
  }
}

/** the wallows in a scene */
export function wallowsOf(s: FieldScene): MudWallow[] {
  return s.main.items.filter((d): d is MudWallow => d instanceof MudWallow && !d.dead);
}
/** add a wallow (or return the one already there) */
export function addMudWallow(s: FieldScene, x: number, w = 130): MudWallow {
  const near = wallowsOf(s).find(m => Math.abs(m.x - x) < 60);
  if (near) return near;
  const y = s.st.terrain.groundY(x) + 1;
  return s.main.add(new MudWallow(s, x, y, w));
}
function nearestWallow(s: FieldScene, x: number, range = 900): MudWallow | null {
  let best: MudWallow | null = null, bd = range;
  for (const m of wallowsOf(s)) { const d = Math.abs(m.x - x); if (d < bd) { bd = d; best = m; } }
  return best;
}

/** put a tiger in the scene (lurking in a wallow at x by default) */
export function spawnTiger(s: FieldScene, x: number, o: { lurk?: boolean; facing?: 1 | -1; wallow?: boolean } = {}): Animal {
  if (o.wallow !== false && o.lurk !== false) addMudWallow(s, x);
  const a = new Animal(T, x, s.st.terrain.groundY(x) + (o.lurk !== false ? 1 : 0), { home: [x - 420, x + 420] });
  a.host = s;
  a.z = 45;
  a.facing = o.facing ?? (s.player.x > x ? 1 : -1);
  a.body = new TigerBody(a);
  s.animals.push(a);
  s.main.add(a);
  if (o.lurk !== false) { a.setAct('lurk', rand.range(25, 40)); a.mem.under = 1; a.anim = 'wallow'; }
  else a.setAct('prowl', 10);
  return a;
}

// ------------------------------------------------------------------ the mind
const host = (a: Animal) => a.host as unknown as FieldScene;

/** who it's going after: Mori, or a companion (it fancies Chunk) */
function pickTarget(a: Animal, s: FieldScene, st: PredState): Target11 | null {
  if (st.blind > 0) return null;
  const p = s.player;
  let best: Target11 | null = null, bs = Infinity;
  const nightK = s.tod === 'night' ? 0.7 : 1;
  const reach = 250 * nightK;
  // Mori: seen (he's not hidden, or it's right on top of him) or heard
  if (!p.underwater) {
    const d = Math.abs(p.x - a.x);
    const seen = a.aw > 0.55 || (d < 90 && p.state !== 'hide');
    if (seen && d < reach * (p.state === 'hide' ? 0.3 : 1)) { bs = d; best = { kind: 'player' }; }
  }
  for (const [id, act] of s.actors) {
    if (!act.visible || act.alpha < 0.5) continue;
    const d = Math.abs(act.x - a.x);
    if (d > reach * 0.85) continue;
    const ahead = Math.sign(act.x - a.x) === a.facing || d < 100;
    if (!ahead) continue;
    const score = d - (id === 'chunk' ? 55 : id === 'aroha' ? -40 : 0);
    if (score < bs) { bs = score; best = { kind: 'actor', a: act }; }
  }
  return best;
}

/** HOOKS.tick: runs every frame before the brain thinks */
function tick(a: Animal, dt: number) {
  const s = host(a), st = predState(a);
  // nerve and stuns replace the generic fear/anger: keep the generic reactions out of it
  a.fear = 0; a.anger = 0; a.curio = 0;
  st.stun = Math.max(0, st.stun - dt);
  st.blind = Math.max(0, st.blind - dt);
  st.rest = Math.max(0, st.rest - dt);
  st.sinceHit += dt;
  if (st.script) return;
  // nerve slowly comes back once it has rested
  if (st.phase !== 'retreat' && st.sinceHit > 25) st.nerve = Math.min(st.nerve + dt * 0.05, 6);
  if (st.stun > 0.55 && a.act !== 'stunned' && a.act !== 'flinch' && a.act !== 'lurk' && a.act !== 'submerge' && a.act !== 'emerge') { a.setAct('stunned', st.stun); return; }
  if (st.phase === 'retreat') {
    if (a.act !== 'retreat' && a.act !== 'submerge' && a.act !== 'lurk' && a.act !== 'flinch' && a.act !== 'stunned') a.setAct('retreat', 3);
    return;
  }
  if (st.rest > 0) return;
  const busy = a.act === 'pounce' || a.act === 'swipe' || a.act === 'roar' || a.act === 'flinch' || a.act === 'stunned' || a.act === 'emerge' || a.act === 'submerge' || a.act === 'hunt' || a.act === 'eat';
  if (busy) return;
  const tgt = pickTarget(a, s, st);
  if (!tgt) {
    if (st.target && (a.act === 'stalk' || a.act === 'charge')) { st.target = null; st.phase = 'idle'; a.setAct('prowl', 8); }
    return;
  }
  const first = !st.target;
  st.target = tgt;
  const d = Math.abs(targetPos(s, tgt)[0] - a.x);
  if (a.act === 'lurk' || a.act === 'wallow') {
    if (d < 170 && (a.aw > 0.5 || d < 95)) { a.setAct('emerge', animDur('emerge') + 0.05); st.phase = 'charge'; emitPred('ambush', { a }); }
    return;
  }
  if (a.act === 'stalk') {
    if (d < 115 || a.actT > 10) { a.setAct('charge', 3.4); st.phase = 'charge'; emitPred('charge', { a, who: tgtName(tgt) }); }
    return;
  }
  if (a.act !== 'charge') {
    if (first) emitPred('notice', { a, who: tgtName(tgt) });
    if (d < 125) { a.setAct('charge', 3.4); st.phase = 'charge'; emitPred('charge', { a, who: tgtName(tgt) }); }
    else { a.setAct('stalk', 11); st.phase = 'stalk'; emitPred('stalk', { a, who: tgtName(tgt) }); }
  }
}
const tgtName = (t: Target11) => (t.kind === 'player' ? 'mori' : t.a.id);

HOOKS[T] = {
  tick,
  // never the generic flee / hide: deterrence and nerve run its defence
  onThreat: () => true,
  // scripted (the ambush) or mid-encounter: the brain's own ideas wait
  decide: a => { const st = predState(a); return st.script || st.phase === 'retreat' || !!st.target; },
};

// ------------------------------------------------------------------ the acts
const S: Record<string, (a: Animal, dt: number) => boolean | void> = {};
SPECIALS[T] = S;

const groundSpeed = (a: Animal, to: number, dt: number) => { a.vx += clamp(to - a.vx, -260 * dt, 260 * dt); };

S.idle = a => { a.vx = 0; a.anim = 'idle'; a.hidden = 0; };
S.rest = a => { a.vx = 0; a.anim = a.actT > 2 ? 'sleep' : 'idle'; a.hidden = 0; };
S.sleep = S.rest;
S.alert = a => { a.vx = 0; a.anim = 'alert'; };

S.prowl = (a, dt) => {
  a.hidden = 0;
  if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.blocked = 0; a.mem.pause = 0; }
  if (a.mem.pause > 0) { a.mem.pause -= dt; a.vx = 0; a.anim = a.mem.pause > 1.2 ? 'alert' : 'idle'; return; }
  a.anim = 'prowl';
  if (a.groundTo(a.mem.tx, a.eco.walk, dt)) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.pause = rand.range(1.5, 4); }
};
S.wander = S.prowl;

/** walk to the nearest wallow; true once there */
function toWallow(a: Animal, dt: number, speed: number): MudWallow | null | true {
  const s = host(a);
  const w = nearestWallow(s, a.x);
  if (!w) return null;
  if (Math.abs(w.x - a.x) > 6) { a.anim = speed > 30 ? 'prowl' : 'prowl'; a.groundTo(w.x, speed, dt); return w; }
  a.x = w.x; a.y = w.y; a.vx = 0;
  return true;
}

S.lurk = (a, dt) => {
  a.vx = 0;
  if (!a.mem.under) {
    const r = toWallow(a, dt, a.eco.walk * 1.4);
    if (r === null) { a.setAct('prowl', 10); return; }
    if (r !== true) { a.hidden = 0; return; }
    a.setAct('submerge', animDur('submerge'));
    return;
  }
  const w = nearestWallow(host(a), a.x);
  if (w) { w.busy = 1; a.y = w.y; }
  // eyes and nostrils above the mud, now and then right under
  a.anim = 'wallow';
  a.mem.dip = (a.mem.dip ?? rand.range(8, 16)) - dt;
  if (a.mem.dip < 0) {
    a.hidden = 0.99;
    if (a.mem.dip < -rand.range(2.5, 4)) a.mem.dip = rand.range(8, 16);
  } else a.hidden = 0;
};

S.wallow = (a, dt) => {
  if (!a.mem.there) {
    const r = toWallow(a, dt, a.eco.walk);
    if (r === null) { a.setAct('rest', 6); return; }
    if (r !== true) return;
    a.mem.there = 1;
  }
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'sleep';
  const w = nearestWallow(host(a), a.x);
  if (w) w.busy = 0.4;
  if (a.actT > a.actDur - 0.1) a.mem.shakeAfter = 1;
};

S.submerge = (a) => {
  a.vx = 0;
  a.anim = 'submerge';
  a.hidden = 0;
  const w = nearestWallow(host(a), a.x);
  if (w) a.y = w.y;
  if (a.actT >= animDur('submerge')) {
    emitPred('submerge', { a });
    a.setAct('lurk', rand.range(30, 50));
    a.mem.under = 1;
    a.mem.dip = rand.range(4, 8);
    const st = predState(a);
    if (st.phase === 'retreat') { st.phase = 'lurk'; st.nerve = Math.max(st.nerve, 2); }
  }
};

S.emerge = (a) => {
  const s = host(a);
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'emerge';
  if (!a.mem.boom) {
    a.mem.boom = 1;
    const w = nearestWallow(s, a.x);
    w?.erupt(a.x + a.facing * 20);
    sfx11('tigerRoar', { x: a.x, delay: 0.12 });
    s.sounds.push({ x: a.x, y: a.y, kind: 'roar', src: a, species: T, radius: 460, t: s.time + 0.0001 });
  }
  const st = predState(a);
  if (st.target) a.face(targetPos(s, st.target)[0]);
  if (a.actT >= animDur('emerge')) {
    a.mem.under = 0;
    if (st.script) return;
    if (st.target) { a.setAct('charge', 3.4); st.phase = 'charge'; emitPred('charge', { a, who: tgtName(st.target) }); }
    else a.setAct('shake', 1.2);
  }
};

S.stalk = (a, dt) => {
  const s = host(a), st = predState(a);
  a.hidden = 0;
  if (!st.target) return false;
  const [tx] = targetPos(s, st.target);
  a.face(tx);
  a.anim = 'stalk';
  if (Math.abs(tx - a.x) > 40) a.groundTo(tx, 16, dt);
  else a.vx = 0;
};

S.charge = (a, dt) => {
  const s = host(a), st = predState(a);
  a.hidden = 0;
  if (!st.target) return false;
  const [tx, ty] = targetPos(s, st.target);
  const dx = tx - a.x;
  if (a.actT < 0.05) { a.mem.v = 30; a.mem.dir = Math.sign(dx) || a.facing; }
  const dir = a.mem.dir;
  a.facing = dir;
  a.anim = 'charge';
  // heavy: it takes a moment to get going and can't turn on the spot
  a.mem.v = Math.min(a.eco.run, a.mem.v + 280 * dt);
  const before = a.x;
  a.groundTo(a.x + dir * 40, a.mem.v, dt);
  a.vx = (a.x - before) / Math.max(dt, 1e-4);
  const ahead = dx * dir;
  if (Math.abs(ty - a.y) < 30) {
    if (ahead > 26 && ahead < 74 && a.actT > 0.5 && rand.next() < 0.55 && !a.mem.noPounce) { a.setAct('pounce', animDur('pounce') + 0.1); return; }
    if (ahead > -6 && ahead < 40) { a.setAct('swipe', animDur('swipe') + 0.05); return; }
  }
  // overshot, or the rush ran out: stop and roar
  if (ahead < -30 || a.actT > 3.2 || a.mem.blocked) { a.mem.blocked = 0; a.setAct('roar', animDur('roar')); }
};

/** has the strike connected with whoever it is after? */
function strike(a: Animal, range: number) {
  const s = host(a), st = predState(a);
  if (!st.target) return;
  const [tx, ty] = targetPos(s, st.target);
  const ahead = (tx - a.x) * a.facing;
  if (ahead > -10 && ahead < range && Math.abs(ty - a.y) < 34) {
    const t = st.target;
    knockDown(s, a, t);
    st.target = null;
    // made its point: a roar over the fallen, then a breather before the next rush
    st.rest = st.downs >= 2 ? 40 : 3.5;
    if (st.downs >= 2) { st.phase = 'retreat'; emitPred('retreat', { a }); }
  }
}

S.pounce = (a, dt) => {
  a.hidden = 0;
  a.anim = 'pounce';
  const k = a.actT / animDur('pounce');
  // the leap carries it forward (the anim lifts it)
  if (k > 0.15 && k < 0.72) a.groundTo(a.x + a.facing * 40, 115, dt);
  else a.vx = 0;
  if (k > 0.66 && !a.mem.hit) { a.mem.hit = 1; host(a).st.shake(3, 0.25); sfx11('thud', { x: a.x, vol: 0.7 }); strike(a, 36); }
  if (a.actT >= animDur('pounce')) a.setAct('roar', animDur('roar'));
};

S.swipe = a => {
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'swipe';
  if (a.actT > 0.28 && !a.mem.hit) { a.mem.hit = 1; sfx11('chuff', { x: a.x, pitch: 0.8 }); strike(a, 46); }
  if (a.actT >= animDur('swipe')) {
    const st = predState(a);
    if (st.target) a.setAct('charge', 2.4); else a.setAct('roar', animDur('roar'));
  }
};

S.roar = a => {
  const s = host(a);
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'roar';
  if (!a.mem.called && a.actT > 0.15) {
    a.mem.called = 1;
    sfx11('tigerRoar', { x: a.x });
    s.st.shake(2.5, 0.8);
    s.sounds.push({ x: a.x, y: a.y, kind: 'roar', src: a, species: T, radius: 420, t: s.time + 0.0001 });
    a.showEmote('anger', 1.2, true);
  }
  if (a.actT >= animDur('roar') + 0.2) {
    const st = predState(a);
    if (st.target && st.phase !== 'retreat') a.setAct('stalk', 6); else a.setAct('prowl', 8);
  }
};

S.flinch = a => {
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'flinch';
  if (a.actT >= animDur('flinch') + 0.05) {
    const st = predState(a);
    if (st.stun > 0.55) a.setAct('stunned', st.stun);
    else if (st.phase === 'retreat') a.setAct('retreat', 3);
    else if (st.target) a.setAct(a.mem.resume === 1 ? 'charge' : 'stalk', a.mem.resume === 1 ? 2.6 : 6);
    else a.setAct('roar', animDur('roar'));
  }
};

S.stunned = a => {
  const st = predState(a);
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'stunned';
  if (!a.mem.stars) { a.mem.stars = 1; a.showEmote('star', Math.max(1.2, st.stun), true); }
  if (st.stun <= 0 && a.actT > 0.6) {
    if (st.phase === 'retreat') a.setAct('retreat', 3);
    else { a.setAct('shake', 1.15); }
  }
};

S.shake = a => {
  const s = host(a);
  a.vx = 0;
  a.hidden = 0;
  a.anim = 'shake';
  // a spray of mud off the coat
  const b = tigerBody(a);
  if (b && b.wet > 0.2 && rand.next() < 0.6) {
    const fr = fx11Frames();
    s.main.particles.spawn({ frame: rand.next() < 0.4 ? fr.clod[Math.floor(rand.next() * 3)] : fr.drop, x: a.x + rand.range(-40, 40), y: a.y - rand.range(20, 46), vx: rand.range(-150, 150), vy: rand.range(-160, -40), ay: 420, life: 0.9, vrot: rand.range(-10, 10), alpha: 1, alpha1: 0.8, floorY: a.y + 2, onFloor: 'stop' });
  }
  if (a.actT > 0.2 && b) b.wet = Math.max(0.3, b.wet - 0.01);
  if (a.actT >= a.actDur) return false;
};

S.retreat = (a, dt) => {
  const s = host(a), st = predState(a);
  a.hidden = 0;
  // back off snarling, facing the party; then turn for home
  const px = s.player.x;
  if (a.actT < 2.4) {
    a.face(px);
    a.anim = 'retreat';
    const away = -Math.sign(px - a.x) || -a.facing;
    const before = a.x;
    a.groundTo(a.x + away * 30, 24, dt);
    a.vx = (a.x - before) / Math.max(dt, 1e-4);
    if (!a.mem.growl) { a.mem.growl = 1; sfx11('tigerGrowl', { x: a.x }); emitPred('retreat', { a }); }
    return;
  }
  const r = toWallow(a, dt, 46);
  if (r === true) { a.setAct('submerge', animDur('submerge')); return; }
  if (r === null) {
    // no mud nearby: off into the forest
    a.anim = 'prowl';
    const away = -Math.sign(px - a.x) || -a.facing;
    a.groundTo(a.x + away * 60, 46, dt);
    if (Math.abs(a.x - px) > 600) { a.gone = true; }
  }
  if (a.actT > 30) { st.phase = 'idle'; return false; }
};

S.hunt = (a, dt) => {
  // big prey (Bonefaces, Shieldbacks, Quillhogs): stalk close, rush, take it
  const prey = a.prey;
  if (!prey || prey.dead || prey.gone || prey.hidden > 0.8 || predState(a).target) return false;
  const d = prey.x - a.x;
  a.face(prey.x);
  if (Math.abs(d) > 110) { a.anim = 'stalk'; a.groundTo(prey.x, 16, dt); }
  else { a.anim = 'charge'; a.groundTo(prey.x, a.eco.run * 0.9, dt); if (prey.fear < 0.6) prey.fear = 0.9; }
  if (Math.abs(prey.x - a.x) < 20) { catchPrey(a, prey); sfx11('tigerGrowl', { x: a.x }); }
  if (a.actT > 16 || a.mem.blocked) return false;
};

S.eat = a => { a.vx = 0; a.anim = 'eat'; a.hidden = 0; };
/** the story drives it (tigerAmbush): position, anim and visibility are set from outside */
S.cine = a => { a.vx = 0; };

// ------------------------------------------------------------------ the predator definition
registerPredator({
  species: T, tier: 3, knockEnergy: 30, nerve: 6, stunTime: 1.6, restTime: 60,
  onHit(a, kind) {
    const st = predState(a);
    const b = tigerBody(a);
    if (st.script) return;
    if (a.act === 'lurk' || a.act === 'submerge' || a.act === 'emerge' || a.act === 'pounce') return;
    if (kind === 'pepper') sfx11('sneeze', { x: a.x, delay: 0.25 });
    if (kind === 'noise' || kind === 'shout') {
      // defied: it roars back (and hesitates)
      if (a.act === 'stalk' || a.act === 'charge') a.setAct('roar', animDur('roar'));
      return;
    }
    a.mem.resume = a.act === 'charge' ? 1 : 0;
    a.setAct('flinch', animDur('flinch') + 0.05);
    b?.restart();
    sfx11('tigerGrowl', { x: a.x, vol: 0.6, pitch: 1.2 });
  },
  onBreak(a) {
    if (predState(a).script) return;
    if (a.act !== 'stunned') a.setAct('retreat', 3);
  },
  advice: [
    'Stand tall, Mori! Make yourself BIG!',
    'Don’t run! Running tells it you’re food!',
    'Hit it on the brow! It hates the brow!',
    'Back up slowly! Eyes on it!',
    'Shout! Make some noise!',
  ],
});

/** is this animal a tiger in the mud right now? */
export const inMud = (a: Animal) => a.act === 'lurk' || a.act === 'wallow' || a.act === 'submerge';
export { isPredator };
void game;
