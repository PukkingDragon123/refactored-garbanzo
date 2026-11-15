// V12 The Bearer in the world: its Body (the painted frames of src/art/v12/feud/bearer.ts) and its mind on
// top of the wildlife brain (wild/animal.ts) and the predator framework (v11/predators-core.ts: nerve,
// stuns, the sling, Aroha's defence). On its own it roams with its nose low, sniffs, digs, sleeps on its
// cache. The feud director (./director.ts) gives it tasks (go and steal that kill, fight the boa,
// cache the carcass); the boss fight drives it through bearerScript() (./director.ts).
//
// Mori: it is dangerous close up. Seen inside ~200 px it rears and roars (the warning: back off); keep
// coming and it charges, stops short and swipes: a long, readable wind-up (the claw goes up over the
// shoulder), then a scything blow that reaches ~110 px. Jump it, back off out of reach, or hide. A hit
// knocks Mori flat (wilds.ts hitMori). Pebbles and Aroha's grenades cost it nerve; at 0 it backs off.
//
// Acts (a.act): idle wander sniff dig eat sleep goto drag cache rear (the claw display) windup swipe
// charge roar pin flinch stunned retreat smash brawl (squared up to the boa; the director moves it) cine.
// (Not 'threat' / 'fight': the generic brain treats those names specially.)

import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import type { FieldScene } from '../../scenes/field';
import { Animal, Body, SPECIALS, HOOKS } from '../../wild/animal';
import type { Box } from '../../wild/world';
import { BODY_MAKERS, drawEmote } from '../../wild/bodies';
import { bearerFrame, BEARER_ANIMS, BearerFrame, BEARER_HIT, bearerWarmStep } from '../../../art/v12/feud/bearer';
import { local, A } from '../../assets';
import { rand, clamp } from '../../../core/math';
import { registerPredator, predState, emitPred } from '../../v11/predators-core';
import { sfx11 } from '../../v11/predators-sfx';
import { hitMori, moriHidden } from '../wilds';
import { floatText } from '../../../ui/v12/float';
import { BEARER_ID } from './species';
import { dustBurst, dirtBurst, slam, furBurst } from './fx';
import type { Cache } from './fx';

const T = BEARER_ID;
export const bearerDur = (n: string) => { const i = BEARER_ANIMS[n]; return i ? i.frames / i.fps : 0.5; };

// ------------------------------------------------------------------ the mind the director and the script share
export interface BearerMind {
  /** the feud director's current task for it (null: its own business) */
  task: string | null;
  /** the rival it is squaring up to */
  foe: Animal | null;
  /** a carcass it is after / dragging / eating */
  carcass: Animal | null;
  /** its cache and its den (world x) */
  cache: Cache | null;
  den: number;
  /** a walk target for goto / drag */
  tx: number;
  /** how much fight is left in it this encounter (the director's tally, not hit points) */
  will: number;
  /** warned Mori this encounter (the rear-up comes before any charge) */
  warned: number;
  /** after a swipe at Mori: seconds before it rushes again */
  cool: number;
}
const MINDS = new WeakMap<Animal, BearerMind>();
export function bearerMind(a: Animal): BearerMind {
  let m = MINDS.get(a);
  if (!m) { m = { task: null, foe: null, carcass: null, cache: null, den: a.x, tx: a.x, will: 3, warned: 0, cool: 0 }; MINDS.set(a, m); }
  return m;
}

/** the claw lands (AI or script): who it was swung at is the listener's business */
export type BlowFn = (a: Animal, x: number, y: number, kind: 'swipe' | 'smash' | 'pin') => void;
const blowFns = new Set<BlowFn>();
export function onBearerBlow(fn: BlowFn): () => void { blowFns.add(fn); return () => blowFns.delete(fn); }
export function bearerBlow(a: Animal, kind: 'swipe' | 'smash' | 'pin') { blow(a, kind); }
function blow(a: Animal, kind: 'swipe' | 'smash' | 'pin') {
  const b = a.body as BearerBody;
  const [x, y] = b.clawTip(a);
  for (const fn of [...blowFns]) { try { fn(a, x, y, kind); } catch (e) { console.error(e); } }
}

// ------------------------------------------------------------------ warming
let warmed = false;
/** paint one frame of the next strip (call every frame while a Bearer is about; true when all done) */
export function warmBearerStep(): boolean {
  if (warmed) return true;
  warmed = bearerWarmStep();
  return warmed;
}

// ------------------------------------------------------------------ the body
const SPEED: Record<string, number> = { walk: 24, drag: 16, charge: 150, retreat: 22 };
const ALIAS: Record<string, string> = { wander: 'walk', prowl: 'walk', run: 'charge', attack: 'charge', fight: 'threat', rear: 'threat', brawl: 'threat', rest: 'idle', alert: 'sniff', steal: 'drag', cache: 'dig' };

let frOwner: unknown = null;
const atlasFr = new Map<string, Frame>();
function atlasFrame(bf: BearerFrame, key: string): Frame {
  if (frOwner !== local) { atlasFr.clear(); frOwner = local; }
  let f = atlasFr.get(key);
  if (!f) { f = local.add('v12:bearer:' + key, bf.buf, bf.ax, bf.ay); atlasFr.set(key, f); }
  return f;
}

export class BearerBody implements Body {
  t = 0;
  cur = 'idle';
  /** a frame pinned from outside (cutscenes): -1 = play the anim */
  pin = -1;
  private last: BearerFrame | null = null;
  private lastIdx = -1;
  constructor(readonly a: Animal) {}

  get frameIndex(): number {
    if (this.pin >= 0) return Math.min(this.pin, BEARER_ANIMS[this.cur].frames - 1);
    const info = BEARER_ANIMS[this.cur];
    const n = Math.floor(this.t * info.fps);
    return info.loop ? n % info.frames : Math.min(info.frames - 1, n);
  }
  /** a one-shot anim has played through */
  get done() { const i = BEARER_ANIMS[this.cur]; return !i.loop && this.t >= i.frames / i.fps; }
  restart() { this.t = 0; }

  update(dt: number, a: Animal) {
    const name = BEARER_ANIMS[a.anim] ? a.anim : ALIAS[a.anim] ?? 'idle';
    if (name !== this.cur) { this.cur = name; this.t = 0; this.pin = -1; }
    const sp = SPEED[name];
    this.t += sp ? dt * clamp(Math.abs(a.vx) / sp, 0.3, 1.8) : dt;
    // footfalls: dust where the fists and feet come down
    const i = this.frameIndex;
    if (i !== this.lastIdx) {
      this.lastIdx = i;
      const s = a.host as unknown as FieldScene;
      if (s.main && a.hidden < 0.5) {
        if ((name === 'walk' || name === 'drag') && (i === 2 || i === 7)) dustBurst(s, a.x + a.facing * 40, a.y, -a.facing, 1);
        if (name === 'charge' && (i === 1 || i === 5)) { dustBurst(s, a.x + a.facing * rand.range(-40, 40), a.y, -a.facing, 3, true); s.st.shake(1.2, 0.15); }
        if (name === 'dig' && i % 3 === 1) { const [cx] = this.clawTip(a); dirtBurst(s, cx, a.y, -a.facing, 3); }
      }
    }
  }

  frame(a: Animal): BearerFrame {
    const f = bearerFrame(this.cur, this.frameIndex, this.eye(a));
    this.last = f;
    return f;
  }
  private eye(a: Animal): 'open' | 'alert' | 'angry' | 'closed' {
    const c = this.cur;
    if (c === 'sleep' || c === 'stunned' || (c === 'flinch' && this.frameIndex < 2)) return 'closed';
    if (c === 'threat' || c === 'windup' || c === 'swipe' || c === 'pin' || c === 'charge' || c === 'roar' || c === 'retreat' || c === 'smash' || c === 'flinch') return 'angry';
    if (c === 'sniff') return 'alert';
    return a.eye === 'angry' ? 'angry' : a.eye === 'closed' ? 'closed' : 'open';
  }

  draw(r: Renderer, a: Animal) {
    if (a.hidden >= 0.98) return;
    const f = this.frame(a);
    const fr = atlasFrame(f, `${this.cur}|${this.frameIndex}|${this.eye(a)}`);
    const s = a.host as unknown as FieldScene;
    if (Math.abs(a.y - s.st.terrain.groundY(a.x)) < 8) {
      r.beginShadows();
      r.draw(A.shadow, a.x + a.facing * 6, a.y, Math.max(1, (f.buf.w * 0.8) / 34), 1, 0, packColor(0, 0, 0, 0.42 * a.alpha));
      r.endShadows();
    }
    r.draw(fr, a.x, a.y, a.facing, 1, 0, packColor(1, 1, 1, a.alpha));
    const [hx, hy] = this.head(a);
    drawEmote(r, a, hx, hy - 8);
  }

  bounds(a: Animal): Box {
    const f = this.last ?? this.frame(a);
    const l = -f.ax, rr = f.buf.w - f.ax;
    const x0 = a.facing > 0 ? a.x + l : a.x - rr, x1 = a.facing > 0 ? a.x + rr : a.x - l;
    return { x0, y0: a.y - f.ay, x1, y1: a.y + (f.buf.h - f.ay) };
  }
  // (the current frame, not the last one drawn: the blows are timed in update, before the draw)
  head(a: Animal): [number, number] { const f = this.frame(a); return [a.x + f.head[0] * a.facing, a.y + f.head[1]]; }
  mouth(a: Animal): [number, number] { const f = this.frame(a); return [a.x + f.mouth[0] * a.facing, a.y + f.mouth[1]]; }
  clawTip(a: Animal): [number, number] { const f = this.frame(a); return [a.x + f.clawTip[0] * a.facing, a.y + f.clawTip[1]]; }
  points(a: Animal): [number, number][] {
    const f = this.last ?? this.frame(a);
    return f.pts.map(([x, y]) => [a.x + x * a.facing, a.y + y] as [number, number]);
  }
}
BODY_MAKERS[T] = a => new BearerBody(a);
export const bearerBody = (a: Animal) => a.body as BearerBody;

// ------------------------------------------------------------------ the mind
const host = (a: Animal) => a.host as unknown as FieldScene;
const isScript = (a: Animal) => predState(a).script;
const busyAct = new Set(['rear', 'windup', 'swipe', 'roar', 'flinch', 'stunned', 'smash', 'pin', 'cine', 'charge']);

/** how far ahead the swipe reaches (px) */
export const SWIPE_REACH = 112;

function tick(a: Animal, dt: number) {
  const s = host(a), st = predState(a), mind = bearerMind(a);
  // nerve replaces fear; a little anger while it's after Mori keeps the danger music up (below the
  // generic brain's own attack threshold)
  a.fear = 0; a.anger = st.target ? 0.4 : 0; a.curio = 0;
  st.stun = Math.max(0, st.stun - dt);
  st.blind = Math.max(0, st.blind - dt);
  st.rest = Math.max(0, st.rest - dt);
  st.sinceHit += dt;
  mind.cool = Math.max(0, mind.cool - dt);
  if (st.script) return;
  if (st.phase !== 'retreat' && st.sinceHit > 25) st.nerve = Math.min(st.nerve + dt * 0.06, 10);
  if (st.stun > 0.55 && a.act !== 'stunned' && a.act !== 'flinch') { a.setAct('stunned', st.stun); return; }
  if (st.phase === 'retreat') {
    if (a.act !== 'retreat' && a.act !== 'flinch' && a.act !== 'stunned') a.setAct('retreat', 6);
    return;
  }
  // ---- Mori
  const p = s.player;
  const d = Math.abs(p.x - a.x);
  const hidden = moriHidden(s) || st.blind > 0 || p.underwater;
  const fighting = mind.task === 'fight' || mind.task === 'pin';
  if (busyAct.has(a.act) || st.rest > 0) return;
  if (a.act === 'sleep') {
    // a heavy sleeper: only something right on top of it, or loud and near, wakes it
    if (!hidden && (d < 90 || (p.noise > 0.6 && d < 200))) {
      mind.task = null;
      a.face(p.x);
      a.setAct('roar', bearerDur('roar') + 0.1);
      void floatText({ text: 'HRRUUMMPH!', x: a.x, y: a.y - 90, style: 'shout', ms: 1000 });
    }
    return;
  }
  if (hidden) { if (st.target) { st.target = null; st.phase = 'idle'; a.showEmote('question', 1.2, true); } return; }
  const seen = a.aw > 0.5 || d < 130;
  if (!seen) return;
  const close = fighting ? 120 : 200;
  if (d > close) {
    if (st.target && d > 320) { st.target = null; st.phase = 'idle'; mind.warned = 0; }
    return;
  }
  // too close: first the warning, then the rush
  if (!mind.warned || (mind.warned < 2 && d > 150)) {
    mind.warned++;
    st.target = { kind: 'player' };
    st.phase = 'stalk';
    a.face(p.x);
    a.setAct('rear', 2.4);
    emitPred('notice', { a, who: 'mori' });
    return;
  }
  if (mind.cool > 0) return;
  st.target = { kind: 'player' };
  st.phase = 'charge';
  if (fighting) { mind.task = null; if (mind.foe) a.showEmote('anger', 1.2, true); }
  a.face(p.x);
  if (d < SWIPE_REACH - 10) a.setAct('windup', 0.85);
  else { a.setAct('charge', 3); emitPred('charge', { a, who: 'mori' }); }
}

HOOKS[T] = {
  tick,
  onThreat: () => true,
  // scripted, on a task, or after Mori: its own ideas wait
  decide: a => { const st = predState(a); return st.script || st.phase === 'retreat' || !!st.target || !!bearerMind(a).task; },
};

// ------------------------------------------------------------------ the acts
const S: Record<string, (a: Animal, dt: number) => boolean | void> = {};
SPECIALS[T] = S;

/** an act has run its course: on a director task it waits (in its fight stance, or idle) for the
 *  director's next move; on its own, the brain decides */
function next(a: Animal): boolean | void {
  const m = bearerMind(a);
  if (predState(a).script) return;
  if (m.task === 'fight') { a.setAct('brawl', 99); return; }
  if (m.task) { a.setAct('idle', 1); return; }
  return false;
}
/** squared up to the boa: the director moves it and picks its anims */
S.brawl = () => {};

S.idle = a => { a.vx = 0; a.anim = 'idle'; };
S.rest = a => { a.vx = 0; a.anim = a.actT > 3 ? 'sleep' : 'idle'; };
S.sleep = (a, dt) => {
  a.vx = 0;
  a.anim = 'sleep';
  if (a.actT > 1 && !a.emote && rand.next() < dt * 0.3) a.showEmote('zzz', 2.4);
};
S.alert = a => { a.vx = 0; a.anim = 'sniff'; };

S.wander = (a, dt) => {
  if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.blocked = 0; a.mem.pause = 0; }
  if (a.mem.pause > 0) { a.mem.pause -= dt; a.vx = 0; a.anim = 'sniff'; return; }
  a.anim = 'walk';
  if (a.groundTo(a.mem.tx, a.eco.walk, dt)) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.pause = rand.range(2, 4); }
};
S.prowl = S.wander;
S.sniff = (a, dt) => {
  a.vx = 0;
  a.anim = 'sniff';
  if (a.actT > 2 && a.mem.turned === undefined && rand.next() < dt * 0.4) { a.mem.turned = 1; a.facing = -a.facing as 1 | -1; }
  if (rand.next() < dt * 0.5) host(a).sfx('callGrunt', a.x, 0.25, 0.5);
};
S.dig = a => { a.vx = 0; a.anim = 'dig'; };

/** walk to bearerMind.tx (the director's errands); true when there */
S.goto = (a, dt) => {
  const m = bearerMind(a);
  a.hidden = 0;
  if (Math.abs(m.tx - a.x) < 6) { a.vx = 0; a.anim = 'sniff'; return next(a); }
  a.anim = a.mem.sniffing ? 'sniff' : 'walk';
  // stops now and then to test the air
  a.mem.st = (a.mem.st ?? rand.range(2, 4)) - dt;
  if (a.mem.st < 0) { a.mem.sniffing = a.mem.sniffing ? 0 : 1; a.mem.st = a.mem.sniffing ? rand.range(0.8, 1.4) : rand.range(2.5, 4.5); }
  if (a.mem.sniffing) { a.vx = 0; a.face(m.tx); return; }
  a.groundTo(m.tx, a.eco.walk * (a.mem.fast ? 1.6 : 1), dt);
  if (a.mem.blocked) { a.mem.blocked = 0; return next(a); }
};

/** drag the carcass in its jaws to bearerMind.tx */
S.drag = (a, dt) => {
  const m = bearerMind(a), c = m.carcass;
  if (!c || c.dead || c.gone) return next(a);
  a.anim = 'drag';
  const arrived = a.groundTo(m.tx, 15, dt);
  const [mx] = bearerBody(a).mouth(a);
  c.x += (mx + a.facing * 6 - c.x) * Math.min(1, dt * 8);
  c.y = host(a).st.terrain.groundY(c.x);
  c.facing = -a.facing as 1 | -1;
  if (rand.next() < dt * 3) dustBurst(host(a), c.x, c.y, -a.facing, 1);
  if (arrived || a.mem.blocked) { a.vx = 0; a.mem.blocked = 0; return next(a); }
};
S.steal = S.drag;

/** bury the carcass in its cache: dig a hollow, heap earth over the kill, then sleep on it */
S.cache = a => {
  const m = bearerMind(a), c = m.carcass, k = m.cache;
  a.vx = 0;
  a.anim = 'dig';
  if (k) k.open = a.actT < 2.5 ? 1 : 0;
  if (a.actT > 2.5 && c && !c.gone) {
    if (k) k.kill = c.species;
    c.gone = true;
    m.carcass = null;
  }
  if (a.actT > a.actDur) return next(a);
};

S.eat = a => {
  const m = bearerMind(a), c = m.carcass;
  a.vx = 0;
  a.anim = 'eat';
  if (c && !c.dead && !c.gone) a.face(c.x);
  if (rand.next() < 0.02) host(a).sfx('callGrunt', a.x, 0.3, 0.45);
};

/** the rear-up: on its hind legs, the claw spread high, a roar (photo: claw display) */
S.rear = a => {
  const s = host(a), st = predState(a);
  a.vx = 0;
  a.anim = 'threat';
  const foe = bearerMind(a).foe;
  if (st.target?.kind === 'player') a.face(s.player.x); else if (foe) a.face(foe.x);
  if (!a.mem.called && a.actT > 0.45) {
    a.mem.called = 1;
    sfx11('tigerRoar', { x: a.x, pitch: 0.72, vol: 1 });
    s.st.shake(2.5, 0.6);
    s.sounds.push({ x: a.x, y: a.y, kind: 'roar', src: a, species: T, radius: 480, t: s.time + 0.0001 });
    a.showEmote('anger', 1.4, true);
    if (st.target?.kind === 'player') void floatText({ text: 'GRRRAAAAWRR!', x: a.x, y: a.y - 200, style: 'shout', ms: 1300 });
  }
  if (a.actT >= a.actDur) {
    if (st.target?.kind === 'player') { a.setAct('sniff', 1.2); return; }
    return next(a);
  }
};

/** the tell: the claw goes up over the shoulder and trembles there */
S.windup = a => {
  const s = host(a), st = predState(a);
  a.vx = 0;
  a.anim = 'windup';
  if (st.target?.kind === 'player') a.face(s.player.x);
  else { const foe = bearerMind(a).foe; if (foe) a.face(foe.x); }
  if (!a.mem.huff) { a.mem.huff = 1; sfx11('tigerGrowl', { x: a.x, pitch: 0.7 }); a.showEmote('anger', 0.9, true); }
  if (a.actT >= a.actDur) { a.setAct('swipe', bearerDur('swipe') + 0.1); bearerBody(a).restart(); }
};

S.swipe = a => {
  const s = host(a), st = predState(a);
  a.vx = 0;
  a.anim = 'swipe';
  const b = bearerBody(a);
  if (!a.mem.hit && b.frameIndex >= BEARER_HIT.swipe) {
    a.mem.hit = 1;
    sfx11('chuff', { x: a.x, pitch: 0.55, vol: 1 });
    const [cx] = b.clawTip(a);
    dustBurst(s, cx, a.y, a.facing, 3);
    blow(a, 'swipe');
    if (st.target?.kind === 'player' && !st.script) {
      const p = s.player, gy = s.st.terrain.groundY(p.x);
      const ahead = (p.x - a.x) * a.facing;
      const jumped = p.y < gy - 18;
      if (ahead > -20 && ahead < SWIPE_REACH && !jumped && !moriHidden(s)) {
        hitMori(s, a.x, { sev: 3, drop: true, what: 'bearer' });
        emitPred('knockdown', { a, who: 'mori' });
        st.downs++;
      } else if (ahead > -20 && ahead < SWIPE_REACH + 60) void floatText({ text: jumped ? 'Over it!' : 'Too close... too close!', style: 'scared', ms: 1300 });
    }
  }
  if (a.actT >= bearerDur('swipe') + 0.05) {
    const m = bearerMind(a);
    if (st.script) return;
    if (st.target?.kind === 'player') {
      // made its point: it stands its ground and blows, then thinks about it
      m.cool = st.downs >= 2 ? 30 : 5;
      st.rest = 1.2;
      a.setAct('roar', bearerDur('roar'));
      if (st.downs >= 2) { st.phase = 'retreat'; st.target = null; emitPred('retreat', { a }); }
      return;
    }
    return next(a);
  }
};

S.charge = (a, dt) => {
  const s = host(a), st = predState(a);
  if (!st.target) return false;
  const p = s.player;
  const dx = p.x - a.x;
  if (a.actT < 0.05) { a.mem.v = 40; a.mem.dir = Math.sign(dx) || a.facing; }
  const dir = a.mem.dir;
  a.facing = dir;
  a.anim = 'charge';
  a.mem.v = Math.min(a.eco.run, a.mem.v + 260 * dt);
  a.groundTo(a.x + dir * 40, a.mem.v, dt);
  const ahead = dx * dir;
  if (ahead > 0 && ahead < SWIPE_REACH - 20) { a.setAct('windup', 0.55); return; }
  if (ahead < -40 || a.actT > 2.8 || a.mem.blocked || moriHidden(s)) { a.mem.blocked = 0; a.setAct('roar', bearerDur('roar')); }
};

S.roar = a => {
  const s = host(a);
  a.vx = 0;
  a.anim = 'roar';
  if (!a.mem.called && a.actT > 0.2) {
    a.mem.called = 1;
    sfx11('tigerRoar', { x: a.x, pitch: 0.68 });
    s.st.shake(2.2, 0.7);
    s.sounds.push({ x: a.x, y: a.y, kind: 'roar', src: a, species: T, radius: 460, t: s.time + 0.0001 });
  }
  if (a.actT >= a.actDur + 0.2) {
    const st = predState(a);
    if (st.target && st.phase !== 'retreat') { st.rest = 0.5; a.setAct('sniff', 1.5); return; }
    return next(a);
  }
};

S.pin = a => {
  a.vx = 0;
  a.anim = 'pin';
  if (!a.mem.p && a.actT > 0.25) { a.mem.p = 1; blow(a, 'pin'); slam(host(a), bearerBody(a).clawTip(a)[0], 0.6); }
  if (a.actT >= a.actDur) return next(a);
};

S.smash = a => {
  const s = host(a);
  a.vx = 0;
  a.anim = 'smash';
  const b = bearerBody(a);
  if (!a.mem.hit && b.frameIndex >= BEARER_HIT.smash) {
    a.mem.hit = 1;
    const [cx] = b.clawTip(a);
    slam(s, cx, 1.4);
    sfx11('thud', { x: cx, vol: 1, pitch: 0.6 });
    blow(a, 'smash');
  }
  if (a.actT >= bearerDur('smash') + 0.1) return false;
};

S.flinch = a => {
  a.vx = 0;
  a.anim = 'flinch';
  if (!a.mem.fur) { a.mem.fur = 1; const [hx, hy] = bearerBody(a).head(a); furBurst(host(a), hx, hy + 20, -a.facing, 5); }
  if (a.actT >= bearerDur('flinch') + 0.05) {
    const st = predState(a);
    if (st.script) return;
    if (st.stun > 0.55) a.setAct('stunned', st.stun);
    else if (st.phase === 'retreat') a.setAct('retreat', 6);
    else if (st.target) a.setAct('roar', bearerDur('roar'));
    else return next(a);
  }
};

S.stunned = a => {
  const st = predState(a);
  a.vx = 0;
  a.anim = 'stunned';
  if (!a.mem.stars) { a.mem.stars = 1; a.showEmote('star', Math.max(1.2, st.stun), true); }
  if (st.script) return;
  if (st.stun <= 0 && a.actT > 0.8) {
    if (st.phase === 'retreat') a.setAct('retreat', 6);
    else return next(a);
  }
};

S.retreat = (a, dt) => {
  const s = host(a), st = predState(a), m = bearerMind(a);
  const p = s.player;
  const from = m.foe && !m.foe.gone ? m.foe.x : p.x;
  if (a.actT < 2.2) {
    a.face(from);
    a.anim = 'retreat';
    a.groundTo(a.x - Math.sign(from - a.x || 1) * 30, 22, dt);
    if (!a.mem.growl) { a.mem.growl = 1; sfx11('tigerGrowl', { x: a.x, pitch: 0.65 }); emitPred('retreat', { a }); }
    return;
  }
  // then off home to the den, not looking back
  a.anim = 'walk';
  const home = m.den;
  const away = Math.abs(home - a.x) > 30 ? home : a.x - Math.sign(from - a.x || 1) * 200;
  if (a.groundTo(away, a.eco.walk * 1.5, dt) || a.actT > 20) {
    if (st.phase === 'retreat') { st.phase = 'idle'; st.target = null; }
    m.task = null;
    return false;
  }
};

/** the story / the boss fight drives it (bearerScript, ./director.ts): its task runs here, every frame */
export const CINE = new WeakMap<Animal, (dt: number) => void>();
S.cine = (a, dt) => { a.vx = 0; CINE.get(a)?.(dt); };

// ------------------------------------------------------------------ the predator definition
registerPredator({
  species: T, tier: 3, knockEnergy: 35, nerve: 10, stunTime: 1.1, restTime: 70,
  onHit(a, kind) {
    const st = predState(a);
    if (st.script) return;
    if (kind === 'noise' || kind === 'shout') {
      // shouted at: it rears and roars right back (a warning that costs it a little nerve)
      if (a.act !== 'rear' && a.act !== 'swipe' && a.act !== 'windup' && a.act !== 'sleep') a.setAct('rear', 2);
      return;
    }
    if (a.act === 'swipe' || a.act === 'smash' || a.act === 'rear') { furBurst(host(a), a.x + a.facing * 30, a.y - 70, -a.facing, 3); return; }
    a.setAct('flinch', bearerDur('flinch') + 0.05);
    bearerBody(a)?.restart();
    sfx11('tigerGrowl', { x: a.x, vol: 0.7, pitch: 0.9 });
  },
  onBreak(a) {
    if (predState(a).script) return;
    const m = bearerMind(a);
    m.task = null;
    if (a.act !== 'stunned') a.setAct('retreat', 6);
  },
  advice: [
    'Back off, Mori! Out of reach of that claw!',
    'When the claw goes up, JUMP or GET BACK!',
    'Don’t get between it and the kill!',
    'Sting it on the nose! Then back away!',
    'It’s warning you! Listen to it!',
  ],
});
