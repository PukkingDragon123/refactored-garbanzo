// V12 The Claw and the Plume: the feud director, and the API the rest of the game uses.
//
// The Bearer (Matikuku Nui, species 'bearer': ./bearer.ts, art src/art/v12/feud/bearer.ts) and the Giant
// Feathered Boa (Huruhuru, 'plumeboa': ./plumeboa.ts, art src/art/serpent.ts + src/art/fauna.ts) keep a
// running feud over meat. While Mori is anywhere near, the director stages it, one encounter at a time:
//
//   ambush   the boa lies in wait in the arena; a grazer wanders into reach; the strike, the coils,
//            the squeeze. If nothing comes, the boa swallows it.
//   steal    the Bearer smells the kill and comes, nose low. Threat displays from both: it rears with
//            the claw spread and roars, the boa throws up its ruff and hisses. Then the fight: claw
//            swipes against strikes and bites, dust, torn fur and shaken-out feathers. The loser backs
//            off. A winning Bearer may pin the boa's head under the claw before it lets it go, then
//            drags the carcass to its cache and buries it; a winning boa swallows its kill.
//   raid     the Bearer sleeps by its cache; the boa slides in, noses the earth away and drags the
//            carcass off. Sometimes the Bearer wakes...
// Outcomes are rolled each time. Both animals watch Mori: the Bearer warns, then charges and swipes if
// he comes close (telegraphed: jump it, back off, or hide); the boa strikes if he steps on it.
//
// ------------------------------------------------------------------ API
//   attachFeud(f, { den, cache, arena: [x0, x1], kills: [x...], ground }): FeudHandle
//        Runs the feud in a field scene. den: where the Bearer sleeps; cache: its food cache (a mound
//        is drawn there); arena: where the fights happen; kills: where the boa lies in ambush;
//        ground(x): the walk line's y. Spawns both animals if the scene has none. Idempotent per scene.
//   FeudHandle: bearer, boa, cache, phase, start(kind), spawnPrey(x?, species?), pause(on), paused,
//        onEvent(fn), dispose().  start('ambush' | 'fight' | 'raid' | 'sleep' | 'quiet')
//   spawnBearer(f, x, { facing?, act?, home? }): Animal       spawnPlumeboa(f, x, { facing?, act?, home? }): Animal
//   bearerScript(a): BearerScript   (the boss fight / cutscenes; the AI keeps its hands off until release())
//        .walkTo(x, { run?, speed? })   walk (or charge) to x; resolves on arrival
//        .act(name, { secs? })          'idle' 'walk' 'sniff' 'dig' 'eat' 'threat' 'windup' 'swipe' 'pin'
//                                       'charge' 'roar' 'flinch' 'stunned' 'sleep' 'retreat' 'smash' 'drag';
//                                       one-shots resolve when played (swipe and smash fire onBlow at the
//                                       hit frame), loops after `secs` (default 2)
//        .facing (get / set)   .clawTip()   .head()   .onBlow(fn) -> unsubscribe
//        .frameOf(anim, i) -> { frame: atlas Frame (anchor = ground), art: BearerFrame (buffer + anchors) }
//        .release()            hand it back to its own brain
//   onBearerBlow(fn) (./bearer.ts): every swipe / smash / pin that lands, AI or scripted
//   Quest flags (./quest.ts): this module sets feud:witness, feud:photo:constrict, feud:photo:bearer,
//        feud:photo:fight from what Mori sees and photographs.

import type { FieldScene } from '../../scenes/field';
import type { Drawable } from '../../../world/stage';
import type { Frame } from '../../../gfx/renderer';
import type { RawPhoto } from '../../photos';
import { judgeSubject } from '../../photos';
import { Animal } from '../../wild/animal';
import { makeBody } from '../../wild/bodies';
import { game } from '../../game';
import { local } from '../../assets';
import { rand } from '../../../core/math';
import { floatText } from '../../../ui/v12/float';
import { predState, restore, isPredator } from '../../v11/predators-core';
import { bearerFrame, BEARER_ANIMS, BEARER_HIT, BearerFrame } from '../../../art/v12/feud/bearer';
import { BEARER_ID, PLUMEBOA_ID, FEUD_PREY } from './species';
import { BearerBody, bearerBody, bearerMind, bearerDur, warmBearerStep, onBearerBlow, bearerBlow, CINE, SWIPE_REACH } from './bearer';
import { PlumeBody, boaBody, boaMind, grab } from './plumeboa';
import { Cache, furBurst, featherBurst, dustBurst, slam } from './fx';

export interface FeudSpots {
  /** where the Bearer sleeps (world x) */
  den: number;
  /** its food cache */
  cache: number;
  /** where the fights happen */
  arena: [number, number];
  /** where the boa lies in ambush */
  kills: number[];
  /** the walk line's y at x */
  ground: (x: number) => number;
}
export type FeudKind = 'ambush' | 'fight' | 'raid' | 'sleep' | 'quiet';
export type FeudPhase = 'quiet' | 'ambush' | 'kill' | 'scent' | 'standoff' | 'fight' | 'pin' | 'steal' | 'cache' | 'swallow' | 'raid' | 'chase' | 'sleep';
export type FeudEvent = 'phase' | 'kill' | 'fight' | 'blow' | 'bite' | 'pin' | 'win' | 'steal' | 'cache' | 'raid';
export interface FeudHandle {
  readonly f: FieldScene;
  readonly spots: FeudSpots;
  readonly bearer: Animal | null;
  readonly boa: Animal | null;
  readonly cache: Cache;
  readonly phase: FeudPhase;
  /** stage an encounter now (dev points; the boss fight sets the stage with these) */
  start(kind: FeudKind): void;
  /** a grazer for the boa (default: a torhopper, walking into the arena) */
  spawnPrey(x?: number, species?: string): Animal;
  /** stop staging encounters (the animals keep their own minds) */
  pause(on: boolean): void;
  readonly paused: boolean;
  /** what happens: ev 'win' carries who ('bearer' | 'boa') */
  onEvent(fn: (ev: FeudEvent, info: { who?: string; phase?: FeudPhase }) => void): () => void;
  dispose(): void;
}

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { if (!game.save.flags[k]) { game.save.flags[k] = true; game.persist(); } };

// ------------------------------------------------------------------ spawning
function addAnimal(f: FieldScene, species: string, x: number, o: { facing?: 1 | -1; act?: string; home?: [number, number]; dur?: number } = {}): Animal {
  const a = new Animal(species, x, f.st.terrain.groundY(x), { home: o.home ?? [x - 380, x + 380] });
  a.host = f;
  a.facing = o.facing ?? (f.player.x > x ? 1 : -1);
  a.body = makeBody(a);
  f.animals.push(a);
  f.main.add(a);
  if (o.act) a.setAct(o.act, o.dur ?? 12);
  runtime(f);
  return a;
}
/** put a Bearer in the scene at x */
export function spawnBearer(f: FieldScene, x: number, o: { facing?: 1 | -1; act?: string; home?: [number, number] } = {}): Animal {
  const a = addAnimal(f, BEARER_ID, x, { act: 'wander', ...o });
  a.z = 46;
  if (!(a.body instanceof BearerBody)) a.body = new BearerBody(a);
  bearerMind(a).den = x;
  return a;
}
/** put a Giant Feathered Boa in the scene with its head at x */
export function spawnPlumeboa(f: FieldScene, x: number, o: { facing?: 1 | -1; act?: string; home?: [number, number] } = {}): Animal {
  const a = addAnimal(f, PLUMEBOA_ID, x, { act: 'ambush', dur: 25, ...o });
  a.z = 44;
  if (!(a.body instanceof PlumeBody)) a.body = new PlumeBody(a);
  (a.body as PlumeBody).settle(a, 3);
  return a;
}

/** per scene: the Bearer's frames painted ahead of time, and the photos checked for the quest */
const RUNTIMES = new WeakMap<FieldScene, true>();
function runtime(f: FieldScene) {
  if (RUNTIMES.has(f)) return;
  RUNTIMES.set(f, true);
  const d: Drawable = {
    z: 0,
    update() { if (f.animals.some(a => a.species === BEARER_ID)) warmBearerStep(); },
    draw() {},
  };
  f.main.add(d);
  const hook = () => {
    if (!f.cam) { setTimeout(hook, 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); checkPhoto(f, ph); };
  };
  hook();
}

/** the quest's photo steps: the boa constricting, the Bearer, the two of them fighting */
function checkPhoto(f: FieldScene, ph: RawPhoto) {
  const ok = ph.subjects.filter(s => (s.species === BEARER_ID || s.species === PLUMEBOA_ID) && judgeSubject(s, ph).identified);
  if (!ok.length) return;
  const said: string[] = [];
  const both = ok.some(s => s.species === BEARER_ID) && ok.some(s => s.species === PLUMEBOA_ID);
  if (ok.some(s => s.species === PLUMEBOA_ID && s.behavior === 'constrict') && !F('feud:photo:constrict')) { setF('feud:photo:constrict'); said.push('The coils... I got the coils.'); }
  if (ok.some(s => s.species === BEARER_ID) && !F('feud:photo:bearer')) { setF('feud:photo:bearer'); said.push('Matikuku Nui. On the card. The claw and everything.'); }
  if (both && ok.some(s => s.behavior === 'fight' || s.behavior === 'clawdisplay' || s.behavior === 'ruff' || s.behavior === 'pin') && !F('feud:photo:fight')) { setF('feud:photo:fight'); said.push('Both of them in one frame. Nobody is going to believe this.'); }
  if (said.length) setTimeout(() => void floatText({ text: said[said.length - 1], style: 'happy', ms: 2800 }), 600);
  void f;
}

// ------------------------------------------------------------------ the scripting API (boss fight, cutscenes)
export type BearerAct = 'idle' | 'walk' | 'sniff' | 'dig' | 'eat' | 'threat' | 'windup' | 'swipe' | 'pin' | 'charge' | 'roar' | 'flinch' | 'stunned' | 'sleep' | 'retreat' | 'smash' | 'drag';
export interface BearerScript {
  readonly a: Animal;
  facing: 1 | -1;
  walkTo(x: number, o?: { run?: boolean; speed?: number }): Promise<void>;
  act(name: BearerAct, o?: { secs?: number }): Promise<void>;
  clawTip(): [number, number];
  head(): [number, number];
  onBlow(fn: (x: number, y: number, kind: 'swipe' | 'smash' | 'pin') => void): () => void;
  frameOf(anim: string, i: number): { frame: Frame; art: BearerFrame };
  release(): void;
}
let scriptFrOwner: unknown = null;
const scriptFr = new Map<string, Frame>();
/** take a Bearer over for a cutscene / the boss fight (its AI waits until release()) */
export function bearerScript(a: Animal): BearerScript {
  const st = predState(a);
  st.script = true;
  st.target = null;
  bearerMind(a).task = null;
  a.setAct('cine', 1e9);
  a.anim = 'idle';
  let task: { tick: (dt: number) => boolean; done: () => void } | null = null;
  const run = (tick: (dt: number) => boolean) => new Promise<void>(res => {
    if (task) task.done();
    task = { tick, done: res };
  });
  CINE.set(a, dt => {
    if (!task) return;
    if (task.tick(dt)) { const t = task; task = null; t.done(); }
  });
  const body = () => a.body as BearerBody;
  return {
    a,
    get facing() { return (a.facing >= 0 ? 1 : -1) as 1 | -1; },
    set facing(v: 1 | -1) { a.facing = v; },
    walkTo(x, o = {}) {
      return run(dt => {
        a.anim = o.run ? 'charge' : 'walk';
        const sp = o.speed ?? (o.run ? a.eco.run : a.eco.walk * 1.4);
        if (a.groundTo(x, sp, dt) || a.mem.blocked) { a.vx = 0; a.mem.blocked = 0; a.anim = 'idle'; return true; }
        return false;
      });
    },
    act(name, o = {}) {
      const info = BEARER_ANIMS[name] ?? BEARER_ANIMS.idle;
      a.anim = name;
      body().restart();
      body().cur = name;
      let t = 0, fired = false;
      return run(dt => {
        t += dt;
        a.anim = name;
        a.vx = 0;
        const hit = BEARER_HIT[name];
        if (hit !== undefined && !fired && body().frameIndex >= hit) {
          fired = true;
          const f = a.host as unknown as FieldScene;
          const [cx] = body().clawTip(a);
          if (name === 'smash') slam(f, cx, 1.4); else dustBurst(f, cx, a.y, a.facing, 3);
          bearerBlow(a, name === 'smash' ? 'smash' : 'swipe');
        }
        if (name === 'retreat') a.groundTo(a.x - a.facing * 30, 20, dt);
        return info.loop ? t >= (o.secs ?? 2) : t >= info.frames / info.fps + (o.secs ?? 0);
      });
    },
    clawTip: () => body().clawTip(a),
    head: () => body().head(a),
    onBlow: fn => onBearerBlow((b, x, y, kind) => { if (b === a) fn(x, y, kind); }),
    frameOf(anim, i) {
      if (scriptFrOwner !== local) { scriptFr.clear(); scriptFrOwner = local; }
      const art = bearerFrame(anim, i);
      const key = anim + '|' + i;
      let frame = scriptFr.get(key);
      if (!frame) { frame = local.add('v12:bearer:script:' + key, art.buf, art.ax, art.ay); scriptFr.set(key, frame); }
      return { frame, art };
    },
    release() {
      if (task) { const t = task; task = null; t.done(); }
      CINE.delete(a);
      st.script = false;
      restore(a);
      a.setAct('wander', 6);
    },
  };
}

// ------------------------------------------------------------------ the director
const HANDLES = new WeakMap<FieldScene, Director>();

/** run the feud in a field scene (idempotent: the same scene gets the same handle) */
export function attachFeud(f: FieldScene, s: FeudSpots): FeudHandle {
  const old = HANDLES.get(f);
  if (old && !old.dead) return old;
  const d = new Director(f, s);
  HANDLES.set(f, d);
  f.main.add(d);
  const ex = f.exit.bind(f);
  f.exit = () => { d.dispose(); ex(); };
  return d;
}
export const feudOf = (f: FieldScene): FeudHandle | null => { const d = HANDLES.get(f); return d && !d.dead ? d : null; };

class Director implements FeudHandle, Drawable {
  z = 0;
  dead = false;
  phase: FeudPhase = 'quiet';
  paused = false;
  readonly cache: Cache;
  private t = 0;
  /** seconds in this phase */
  private pt = 0;
  private cool = 6;
  private prey: Animal | null = null;
  private carcass: Animal | null = null;
  private fns = new Set<(ev: FeudEvent, info: { who?: string; phase?: FeudPhase }) => void>();
  private offBlow: () => void;
  private round = 0;
  private roundT = 0;
  private outcome: 'bearer' | 'boa' | null = null;
  private watching = 0;
  private raidSide = 1;
  private forceBearer = false;
  private chaseAt = 0;

  constructor(readonly f: FieldScene, readonly spots: FeudSpots) {
    this.cache = f.main.add(new Cache(f, spots.cache));
    if (!f.animals.some(a => a.species === BEARER_ID && !a.gone)) spawnBearer(f, spots.den, { act: 'sleep', home: [Math.min(spots.den, spots.arena[0]) - 80, Math.max(spots.den, spots.arena[1])] });
    if (!f.animals.some(a => a.species === PLUMEBOA_ID && !a.gone)) spawnPlumeboa(f, spots.kills[0] ?? (spots.arena[0] + spots.arena[1]) / 2, { home: [spots.arena[0] - 200, spots.arena[1] + 200] });
    const b = this.bearer;
    if (b) { const m = bearerMind(b); m.den = spots.den; m.cache = this.cache; b.setAct('sleep', 30); }
    runtime(f);
    // the claw lands: on the boa, if it was in reach
    this.offBlow = onBearerBlow((a, x, y, kind) => {
      if (a !== this.bearer || this.dead) return;
      const boa = this.boa;
      if (!boa || kind === 'smash') return;
      const [hx, hy] = boaBody(boa).head();
      // anywhere along the claw, root to tip, within reach of the boa's head and neck
      const bf = bearerBody(a).frame(a);
      const bx0 = a.x + bf.clawBase[0] * a.facing, by0 = a.y + bf.clawBase[1];
      let dmin = Infinity;
      for (let k = 0; k <= 8; k++) { const t = k / 8; dmin = Math.min(dmin, Math.hypot(bx0 + (x - bx0) * t - hx, by0 + (y - by0) * t - (hy + 10))); }
      const near = dmin < 46;
      if (near && (this.phase === 'fight' || this.phase === 'pin')) {
        const m = boaMind(boa);
        m.will -= kind === 'pin' ? 2 : 1.25;
        featherBurst(f, hx, hy, Math.sign(hx - a.x) || 1, kind === 'pin' ? 12 : 8);
        if (kind !== 'pin') boa.setAct('flinch', 0.6);
        this.emit('blow');
      }
    });
  }

  get bearer(): Animal | null { return this.f.animals.find(a => a.species === BEARER_ID && !a.dead && !a.gone) ?? null; }
  get boa(): Animal | null { return this.f.animals.find(a => a.species === PLUMEBOA_ID && !a.dead && !a.gone) ?? null; }

  onEvent(fn: (ev: FeudEvent, info: { who?: string; phase?: FeudPhase }) => void) { this.fns.add(fn); return () => { this.fns.delete(fn); }; }
  private emit(ev: FeudEvent, info: { who?: string } = {}) { for (const fn of [...this.fns]) { try { fn(ev, { ...info, phase: this.phase }); } catch (e) { console.error(e); } } }
  private go(p: FeudPhase) { this.phase = p; this.pt = 0; this.emit('phase'); }
  pause(on: boolean) { this.paused = on; }

  spawnPrey(x?: number, species = 'torhopper'): Animal {
    const s = this.spots;
    const px = x ?? s.arena[1] + 120;
    const a = new Animal(FEUD_PREY.includes(species) ? species : 'torhopper', px, this.f.st.terrain.groundY(px), { home: [s.arena[0], s.arena[1]] });
    a.host = this.f;
    a.facing = -1;
    a.body = makeBody(a);
    this.f.animals.push(a);
    this.f.main.add(a);
    a.setAct('wander', 30);
    this.prey = a;
    return a;
  }

  /** stage an encounter now */
  start(kind: FeudKind) {
    const b = this.bearer, boa = this.boa, s = this.spots;
    this.round = 0; this.outcome = null; this.cool = 0; this.chaseAt = 0;
    if (b) { const m = bearerMind(b); m.task = null; m.foe = null; m.will = 3 + rand.next() * 1.6; restore(b); predState(b).target = null; }
    if (boa) { const m = boaMind(boa); m.task = null; m.foe = null; m.will = 2.5 + rand.next() * 2; restore(boa); predState(boa).target = null; }
    if (kind === 'quiet') { this.go('quiet'); this.cool = 20; return; }
    if (kind === 'sleep') {
      if (b) { b.x = s.den; b.y = this.f.st.terrain.groundY(s.den); b.setAct('sleep', 60); bearerMind(b).task = 'sleep'; }
      this.go('sleep');
      return;
    }
    if (kind === 'ambush') {
      // the boa lies with its head toward where the grazers come from (away from Mori), its coils behind
      const kx = s.kills[Math.floor(rand.next() * s.kills.length)] ?? (s.arena[0] + s.arena[1]) / 2;
      const side = (Math.sign(kx - this.f.player.x) || 1) as 1 | -1;
      if (boa) { boa.x = kx; boa.y = this.f.st.terrain.groundY(kx); boa.facing = side; boa.setAct('ambush', 60); boaMind(boa).task = null; (boa.body as PlumeBody).settle(boa, 2); }
      if (!this.prey || this.prey.dead || this.prey.gone || this.prey.held) {
        const pr = this.spawnPrey(kx + side * 280);
        pr.home = side > 0 ? [kx, kx + 300] : [kx - 300, kx];
        pr.facing = (-side) as 1 | -1;
      }
      // the Bearer sleeps it off at its den meanwhile (until the smell of a kill reaches it)
      if (b) { if (b.act !== 'sleep') { b.x = s.den; b.y = this.f.st.terrain.groundY(s.den); } b.setAct('sleep', 60); bearerMind(b).task = 'sleep'; }
      this.go('ambush');
      return;
    }
    if (kind === 'fight') {
      // a fresh kill in the arena in the boa's coils, and the Bearer already on its way
      const kx = (s.arena[0] + s.arena[1]) / 2;
      const c = this.spawnPrey(kx, 'torhopper');
      const side = Math.sign(s.den - kx) || -1;
      if (boa) {
        boa.x = kx - side * 30; boa.y = this.f.st.terrain.groundY(boa.x); boa.facing = (side || 1) as 1 | -1;
        boaMind(boa).task = 'guard';
        grab(boa, c);
        (boa.body as PlumeBody).settle(boa, 2.5);
      }
      if (b) { b.x = kx + side * 330; b.y = this.f.st.terrain.groundY(b.x); b.facing = (-side || 1) as 1 | -1; b.setAct('idle', 1); }
      this.carcass = c;
      this.forceBearer = true;
      this.go('kill');
      this.pt = 2.6;
      return;
    }
    if (kind === 'raid') {
      this.cache.kill = this.cache.kill ?? 'torhopper';
      if (b) { b.x = s.den; b.y = this.f.st.terrain.groundY(s.den); b.setAct('sleep', 80); bearerMind(b).task = 'sleep'; }
      // the boa comes in from the far side of the cache from Mori, and makes off that way again
      this.raidSide = Math.sign(s.cache - this.f.player.x) || 1;
      if (boa) {
        const bx = s.cache + this.raidSide * 520;
        boa.x = bx; boa.y = this.f.st.terrain.groundY(bx); boa.facing = (-this.raidSide || 1) as 1 | -1;
        boa.setAct('ambush', 2);
        (boa.body as PlumeBody).settle(boa, 2);
      }
      this.go('raid');
    }
  }

  update(dt: number) {
    if (this.dead) return;
    const f = this.f, p = f.player, s = this.spots;
    this.t += dt; this.pt += dt;
    const b = this.bearer, boa = this.boa;
    const mid = (s.arena[0] + s.arena[1]) / 2;
    const near = Math.abs(p.x - mid) < 1300;
    // Mori is watching: a fight in view counts as witnessed
    if ((this.phase === 'fight' || this.phase === 'pin' || this.phase === 'standoff') && b && boa) {
      const r = game.r;
      const sx = r.projectX((b.x + boa.x) / 2, 1);
      if (sx > 0 && sx < r.VW && Math.abs(p.x - b.x) < 900) { this.watching += dt; if (this.watching > 2.5) setF('feud:witness'); }
    }
    if (!b && !boa) return;
    switch (this.phase) {
      case 'quiet': case 'sleep': {
        if (this.paused || !near) return;
        this.cool -= dt;
        if (this.cool > 0) return;
        // the next encounter: a raid on a full cache, else a fresh hunt
        this.cool = 25 + rand.next() * 20;
        if (this.cache.kill && b && boa && rand.chance(0.5)) this.start('raid');
        else if (boa) this.start('ambush');
        return;
      }
      case 'ambush': {
        if (!boa) { this.go('quiet'); return; }
        const pr = this.prey;
        if (!pr || pr.dead || pr.gone) { this.prey = null; if (this.pt > 3) this.spawnPrey(); return; }
        // nudge the grazer along toward the boa's spot now and then
        if (!pr.held && (pr.act === 'wander' || pr.act === 'forage') && rand.next() < dt * 0.25) pr.mem.tx = boa.x + boa.facing * rand.range(10, 70);
        if (pr.held && boa.act === 'constrict') { this.carcass = pr; this.prey = null; this.emit('kill'); this.go('kill'); }
        if (this.pt > 90) { this.go('quiet'); this.cool = 10; }
        return;
      }
      case 'kill': {
        if (!boa) { this.go('quiet'); return; }
        // the smell carries: most times the Bearer comes
        if (this.pt > 3 && !this.outcome) {
          this.outcome = (this.forceBearer || rand.chance(0.82)) && b ? 'bearer' : 'boa';
          this.forceBearer = false;
          if (this.outcome === 'bearer' && b) {
            const m = bearerMind(b);
            const c = this.carcass ?? boaMind(boa).victim;
            m.task = 'scent'; m.foe = boa; m.carcass = c;
            boaMind(boa).task = 'guard';
            const side = Math.sign(b.x - (c?.x ?? boa.x)) || -1;
            m.tx = (c?.x ?? boa.x) + side * 150;
            b.setAct('goto', 40);
            b.mem = { fast: 1 };
            void floatText({ text: '*sniff* ...*SNIFF*', x: b.x, y: b.y - 120, style: 'whisper', ms: 1400 });
            this.go('scent');
          } else { boaMind(boa).task = null; this.go('swallow'); }
        }
        return;
      }
      case 'scent': {
        if (!b || !boa) { this.go('quiet'); return; }
        const m = bearerMind(b);
        if (b.act !== 'goto' && Math.abs(b.x - m.tx) > 20 && !predState(b).target && b.act !== 'roar' && b.act !== 'rear') { b.setAct('goto', 30); b.mem = { fast: 1 }; }
        if (Math.abs(b.x - m.tx) < 30 || this.pt > 40) {
          // face off: the boa leaves its kill and rears, the Bearer goes up on its hind legs
          const bm = boaMind(boa);
          if (bm.victim) { bm.carcass = bm.victim; bm.victim = null; bm.carcass.act = 'carcass'; }
          bm.task = 'fight'; bm.foe = b;
          m.task = 'fight'; m.foe = boa;
          b.face(boa.x); boa.face(b.x);
          b.setAct('rear', 2.6);
          boa.setAct('ruff', 3.2);
          this.emit('fight');
          this.go('standoff');
        }
        return;
      }
      case 'standoff': {
        if (!b || !boa) { this.go('quiet'); return; }
        if (this.pt > 3.2) { this.round = 0; this.roundT = 0.6; boa.setAct('brawl', 99); this.go('fight'); }
        return;
      }
      case 'fight': this.fight(dt); return;
      case 'pin': {
        if (!b || !boa) { this.go('quiet'); return; }
        const bb = boaBody(boa);
        // the boa's head under the claw; it thrashes; then it tears free and goes
        const [cx, cy] = bearerBody(b).clawTip(b);
        bb.aim = [cx + b.facing * 4, Math.max(cy, this.f.st.terrain.groundY(cx) - 14)];
        bb.aimK = 8;
        if (rand.next() < dt * 4) featherBurst(f, cx, cy - 6, b.facing, 2);
        if (this.pt > 3.4) {
          bb.aim = null;
          b.setAct('roar', bearerDur('roar'));
          this.boaLoses();
        }
        return;
      }
      case 'steal': {
        if (!b) { this.go('quiet'); return; }
        const m = bearerMind(b);
        const c = m.carcass;
        if (!c || c.dead || c.gone) { this.go('quiet'); return; }
        if (b.act !== 'drag' && b.act !== 'roar' && !predState(b).target) {
          if (Math.abs(b.x - s.cache) < 30) {
            m.task = 'cache';
            b.face(s.cache + (s.den - s.cache || 1));
            b.setAct('cache', 5);
            this.emit('cache');
            this.go('cache');
          } else { m.tx = s.cache; b.mem = {}; b.setAct('drag', 40); }
        }
        return;
      }
      case 'cache': {
        if (!b) { this.go('quiet'); return; }
        if (b.act !== 'cache') {
          const m = bearerMind(b);
          m.task = 'sleep';
          b.setAct('sleep', 50);
          this.go('sleep');
          this.cool = 30;
        }
        return;
      }
      case 'swallow': {
        if (!boa) { this.go('quiet'); return; }
        const m = boaMind(boa);
        if (boa.act === 'digest' || (!m.victim && !m.carcass && boa.act !== 'swallow' && boa.act !== 'constrict')) { m.task = null; this.go('quiet'); this.cool = 40; return; }
        if (boa.act !== 'swallow' && boa.act !== 'constrict' && m.carcass) boa.setAct('swallow', 7);
        return;
      }
      case 'raid': this.raid(dt); return;
      case 'chase': {
        if (!b || !boa) { this.go('quiet'); return; }
        const m = bearerMind(b);
        // the Bearer runs the thief down; if it catches up, they fight over it
        b.anim = 'walk';
        if (b.act !== 'goto') { m.tx = boa.x; b.mem = { fast: 1 }; b.setAct('goto', 20); }
        m.tx = boaBody(boa).head()[0] - (boa.facing) * 40;
        if (Math.abs(b.x - boa.x) < 170) {
          const bm = boaMind(boa);
          bm.task = 'fight'; bm.foe = b; m.task = 'fight'; m.foe = boa;
          boa.face(b.x); b.face(boa.x);
          b.setAct('rear', 2.4); boa.setAct('ruff', 3);
          this.go('standoff');
        }
        if (this.pt > 20) { this.go('quiet'); this.cool = 20; }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- the fight
  private fight(dt: number) {
    const b = this.bearer, boa = this.boa, f = this.f;
    if (!b || !boa) { this.go('quiet'); return; }
    const bm = bearerMind(b), om = boaMind(boa);
    // the Bearer turned on Mori, or one of them was driven off: the fight's over
    if (predState(b).target || predState(b).phase === 'retreat') { this.boaLoses(); return; }
    if (predState(boa).phase === 'retreat' || boa.act === 'retreat') { this.bearerWins(); return; }
    const busy = (a: Animal) => a.act === 'windup' || a.act === 'swipe' || a.act === 'strike' || a.act === 'flinch' || a.act === 'roar' || a.act === 'rear' || a.act === 'ruff' || a.act === 'goto' || a.act === 'pin';
    // between moves they keep squared up: the Bearer shuffles in to claw reach of the boa's head
    const [hx] = boaBody(boa).head();
    const want = hx - (Math.sign(hx - b.x) || 1) * (SWIPE_REACH * 0.72);
    const inReach = Math.abs(b.x - want) < 22;
    if (!busy(b)) {
      b.face(hx);
      if (Math.abs(b.x - want) > 10) { b.anim = 'walk'; b.groundTo(want, 40, dt); b.face(hx); }
      else { b.vx = 0; b.anim = 'threat'; }
    }
    if (boa.act !== 'brawl' && !busy(boa)) boa.setAct('brawl', 99);
    // results of the last exchange
    if (om.bites > 0) {
      om.bites = 0;
      bm.will -= 1;
      const [sx, sy] = [b.x + b.facing * 34, b.y - 78];
      furBurst(f, sx, sy, -b.facing, 9);
      dustBurst(f, b.x, b.y, -b.facing, 3);
      b.setAct('flinch', bearerDur('flinch') + 0.05);
      bearerBody(b).restart();
      f.sfx('callGrowl', b.x, 0.7, 0.6);
      this.emit('bite');
    }
    if (bm.will <= 0) { this.boaWins(); return; }
    if (om.will <= 0) {
      if (rand.chance(0.6)) {
        // the claw comes down on the boa's neck
        b.face(hx);
        b.setAct('pin', 3.6);
        bm.task = 'pin';
        boa.setAct('brawl', 99);
        boaBody(boa).ruffTo = 0.2;
        this.emit('pin');
        void floatText({ text: 'KRRRUNCH', x: hx, y: b.y - 40, style: 'shout', ms: 900 });
        this.go('pin');
      } else this.boaLoses();
      return;
    }
    // the next move
    this.roundT -= dt;
    if (this.roundT > 0 || busy(b) || boa.act === 'strike' || boa.act === 'flinch') return;
    this.round++;
    this.roundT = 0.9 + rand.next() * 0.9;
    const r = rand.next();
    if (r < 0.5 && inReach) {
      // the claw: a wind-up, then the scything blow at the boa's head
      b.face(hx);
      b.setAct('windup', 0.5 + rand.next() * 0.3);
    } else if (r < 0.9) {
      // the boa strikes at the Bearer's shoulder
      om.aim = [b.x + b.facing * 36, b.y - 74];
      om.aimKind = 'foe';
      boa.setAct('strike', 1.3);
      boa.mem = {};
    } else {
      // posturing: a roar, the ruff shaken out
      b.setAct('roar', bearerDur('roar'));
      boaBody(boa).ruffTo = 1;
      featherBurst(f, hx, boa.y - 50, -boa.facing, 3);
    }
    if (this.round > 14) { if (bm.will >= om.will) this.boaLoses(); else this.boaWins(); }
  }

  /** the boa gives up the kill and goes; the Bearer takes it */
  private boaLoses() {
    const b = this.bearer, boa = this.boa;
    if (boa) {
      const om = boaMind(boa);
      if (om.victim) { om.carcass = om.victim; om.victim = null; }
      const c = om.carcass ?? this.carcass;
      om.carcass = null; om.task = null; om.foe = b;
      boaBody(boa).ruffTo = 0;
      boa.setAct('retreat', 8);
      if (c) this.carcass = c;
    }
    this.bearerWins();
  }
  private bearerWins() {
    const b = this.bearer;
    this.emit('win', { who: 'bearer' });
    if (!b) { this.go('quiet'); return; }
    const m = bearerMind(b);
    m.foe = null;
    m.carcass = this.carcass && !this.carcass.dead && !this.carcass.gone ? this.carcass : null;
    if (!m.carcass) { m.task = null; this.go('quiet'); this.cool = 25; return; }
    m.task = 'steal';
    this.emit('steal', { who: 'bearer' });
    void floatText({ text: 'It’s taking the kill...', style: 'whisper', ms: 2000 });
    this.go('steal');
  }
  /** the Bearer backs off; the boa keeps (or gets back) the kill and swallows it */
  private boaWins() {
    const b = this.bearer, boa = this.boa;
    this.emit('win', { who: 'boa' });
    if (b) {
      const m = bearerMind(b);
      m.task = null; m.foe = boa; m.carcass = null;
      b.setAct('retreat', 8);
    }
    if (boa) {
      const om = boaMind(boa);
      om.task = 'swallow'; om.foe = null; om.carcass = this.carcass;
      boaBody(boa).ruffTo = 0;
      if (this.carcass) boa.setAct('swallow', 7); else boa.setAct('ambush', 20);
    }
    this.go('swallow');
  }

  // ---------------------------------------------------------------- the raid
  private raid(dt: number) {
    const b = this.bearer, boa = this.boa, s = this.spots, f = this.f;
    if (!boa) { this.go('quiet'); return; }
    const om = boaMind(boa);
    const sub = (boa.mem.raid ?? 0) | 0;
    void dt;
    if (!om.carcass) {
      // slide in to the cache
      if (boa.act !== 'goto' && boa.act !== 'strike' && sub === 0) { om.task = 'raid'; om.tx = s.cache + Math.sign(boa.x - s.cache || 1) * 20; boa.mem = { raid: 0 }; boa.setAct('goto', 40); }
      if (Math.abs(boaBody(boa).head()[0] - s.cache) < 40 || (boa.act !== 'goto' && this.pt > 4)) {
        // nose the earth away: the kill comes out
        this.cache.open = 1;
        const sp = this.cache.kill ?? 'torhopper';
        this.cache.kill = null;
        const c = new Animal(FEUD_PREY.includes(sp) ? sp : 'torhopper', s.cache, f.st.terrain.groundY(s.cache), { home: [s.cache - 50, s.cache + 50] });
        c.host = f; c.body = makeBody(c); c.held = true; c.anim = 'sleep'; c.eye = 'closed'; c.act = 'carcass'; c.facing = -boa.facing as 1 | -1;
        f.animals.push(c); f.main.add(c);
        this.carcass = c;
        om.carcass = c;
        dustBurst(f, s.cache, f.st.terrain.groundY(s.cache), boa.facing, 4);
        om.tx = s.cache + this.raidSide * 560;
        boa.face(om.tx);
        boa.mem = { raid: 1 };
        boa.setAct('drag', 40);
        this.emit('raid');
        this.pt = 0;
      }
      return;
    }
    // dragging it off: does the Bearer wake?
    if (b && b.act === 'sleep' && this.pt > 2.5 && !boa.mem.rolled) {
      boa.mem.rolled = 1;
      if (rand.chance(0.55)) {
        const m = bearerMind(b);
        m.task = 'chase'; m.foe = boa;
        b.setAct('roar', bearerDur('roar'));
        void floatText({ text: 'GRRAAWR?!', x: b.x, y: b.y - 90, style: 'shout', ms: 1200 });
        this.chaseAt = this.t + 1.5;
      }
    }
    if (this.chaseAt && this.t > this.chaseAt) { this.chaseAt = 0; this.go('chase'); return; }
    if (boa.act !== 'drag' && this.phase === 'raid') {
      // got away with it: it swallows the meal out of the Bearer's reach
      om.task = null;
      if (om.carcass && !om.carcass.dead) boa.setAct('swallow', 7);
      this.go('swallow');
    }
  }

  draw() {}
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.offBlow();
    this.fns.clear();
    this.cache.dead = true;
  }
}

// ------------------------------------------------------------------ console / dev helpers
const scene = () => { const s = game.scene as unknown as FieldScene; return s && s.animals && s.player ? s : null; };
/** run the feud round Mori in the current field scene (the arena just ahead of him) */
export async function feudHere(o: { prey?: string } = {}): Promise<FeudHandle | null> {
  const f = scene();
  if (!f) return null;
  const x = f.player.x, dir = f.player.facing >= 0 ? 1 : -1;
  const mid = x + dir * 330;
  const h = attachFeud(f, { den: mid + dir * 260, cache: mid + dir * 200, arena: [mid - 120, mid + 120], kills: [mid], ground: xx => f.st.terrain.groundY(xx) });
  if (o.prey) h.spawnPrey(undefined, o.prey);
  return h;
}
export function feudState() {
  const f = scene();
  if (!f) return null;
  const h = feudOf(f);
  const sum = (a: Animal | null) => a ? { x: Math.round(a.x), act: a.act, anim: a.anim, hidden: a.hidden, nerve: +predState(a).nerve.toFixed(2), phase: predState(a).phase } : null;
  return {
    phase: h?.phase ?? null, mori: Math.round(f.player.x),
    bearer: sum(h?.bearer ?? null), boa: sum(h?.boa ?? null),
    bearerWill: h?.bearer ? +bearerMind(h.bearer).will.toFixed(2) : null, boaWill: h?.boa ? +boaMind(h.boa).will.toFixed(2) : null,
    cache: h ? { kill: h.cache.kill, open: h.cache.open } : null,
    prey: f.animals.filter(a => FEUD_PREY.includes(a.species)).map(a => ({ sp: a.species, x: Math.round(a.x), act: a.act, held: a.held })),
    flags: Object.keys(game.save.flags).filter(k => k.startsWith('feud:')),
  };
}
void isPredator;
