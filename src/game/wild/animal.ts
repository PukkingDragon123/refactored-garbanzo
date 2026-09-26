// Animal: the V2 wildlife brain.
// Every animal perceives the player (sight cone, light, cover, noise), other animals (predators,
// prey, rivals, family) and sounds (alarm calls, songs, shutter clicks, splashes). It keeps
// feelings (fear, anger, curiosity, hunger, energy) that decay and habituate over time, turns
// them into a mood, and picks behaviours with utility scores and hysteresis. Species differ only
// through their ecology entry (ecology.ts) and optional special behaviours (specials.ts).

import type { Renderer } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import type { Surface } from '../../world/terrain';
import { Terrain } from '../../world/terrain';
import { SPECIES_BY_ID, Species } from '../species';
import { ECO, Eco, Medium, fears, hunts, IdleAct } from './ecology';
import type { Box, Lure, PhotoInfo, POI, Sound, WildHost } from './world';
import { clamp, rand } from '../../core/math';

export type Mood = 'calm' | 'curious' | 'alert' | 'afraid' | 'aggressive' | 'playful' | 'sleepy';
export type EyeState = 'open' | 'alert' | 'angry' | 'scared' | 'closed';

export interface Target {
  kind: 'player' | 'animal' | 'lure' | 'poi' | 'point';
  x: number;
  y: number;
  a?: Animal;
  lure?: Lure;
  poi?: POI;
}

/** Rendering side of an animal (pose frames, spine painter...). */
export interface Body {
  update(dt: number, a: Animal): void;
  draw(r: Renderer, a: Animal): void;
  bounds(a: Animal): Box;
  head(a: Animal): [number, number];
  /** silhouette sample points in world space */
  points(a: Animal): [number, number][];
}

export class Herd {
  members: Animal[] = [];
  leader: Animal | null = null;
  constructor(readonly species: string) {}
  add(a: Animal) {
    this.members.push(a);
    a.herd = this;
    if (!this.leader && !a.juvenile) this.leader = a;
  }
  alive() {
    return this.members.filter(m => !m.dead && !m.gone);
  }
  centre(): number {
    const m = this.alive();
    return m.length ? m.reduce((s, a) => s + a.x, 0) / m.length : 0;
  }
}

export type ActFn = (a: Animal, dt: number) => boolean | void;
/** Generic behaviours; species specials (specials.ts) override per species. */
export const ACTS: Record<string, ActFn> = {};
export const SPECIALS: Record<string, Record<string, ActFn>> = {};
/** species hooks: choose a defense/attack, per-frame extras */
export const HOOKS: Record<string, { onThreat?: (a: Animal) => boolean; tick?: (a: Animal, dt: number) => void; decide?: (a: Animal) => boolean }> = {};

let UID = 0;

export class Animal implements Drawable {
  z = 30;
  readonly uid = ++UID;
  readonly sp: Species;
  readonly eco: Eco;
  host!: WildHost;
  body!: Body;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing = 1;
  medium: Medium;
  surf: Surface | null = null;
  /** current trunk / perch */
  poi: POI | null = null;
  home: [number, number];
  juvenile = false;
  herd: Herd | null = null;
  /** parallax plane (1 = gameplay) */
  p = 1;
  scale = 1;

  // ---------------------------------------------------------------- mind
  /** awareness of the player 0..1.2 */
  aw = 0;
  noticed = false;
  /** habituation to the player's presence 0..1 */
  habit = 0;
  fear = 0;
  anger = 0;
  curio = 0;
  hunger = rand.range(0.1, 0.5);
  energy = rand.range(0.6, 1);
  mood: Mood = 'calm';
  eye: EyeState = 'open';
  act = 'idle';
  actT = 0;
  actDur = 3;
  /** act-local scratch data */
  mem: Record<string, number> = {};
  goal: Target | null = null;
  threat: Target | null = null;
  prey: Animal | null = null;
  lure: Lure | null = null;
  private thinkT = rand.range(0.1, 0.6);
  private scanT = rand.range(0, 0.4);
  private lastHeard = 0;
  private emoteCd = 0;
  emote: { kind: string; t: number; dur: number } | null = null;
  /** pose name requested by the current behaviour (the body resolves fallbacks) */
  anim = 'idle';
  /** ms-free speed estimate for motion blur */
  speed = 0;
  private px = 0;
  private py = 0;
  dead = false;
  /** removed quietly (left the area, went underground for good) */
  gone = false;
  /** 0..1 hidden fraction (burrowed, behind trunk, submerged) */
  hidden = 0;
  alpha = 1;
  /** jaw / mouth open 0..1 (bodies use it) */
  jaw = 0;
  /** carried prey species (galehawk) */
  carrying: string | null = null;
  /** is being eaten / constricted */
  held = false;

  constructor(readonly species: string, x: number, y: number, o: { juvenile?: boolean; medium?: Medium; home?: [number, number] } = {}) {
    this.sp = SPECIES_BY_ID[species];
    this.eco = ECO[species];
    this.x = this.px = x;
    this.y = this.py = y;
    this.juvenile = !!o.juvenile;
    this.medium = o.medium ?? this.eco?.medium ?? 'ground';
    this.home = o.home ?? [x - 160, x + 160];
    this.facing = rand.next() < 0.5 ? -1 : 1;
    if (this.juvenile) this.scale = 0.6;
  }

  get night() {
    return this.host.tod === 'night';
  }
  get awake() {
    return this.act !== 'sleep';
  }
  get busy() {
    return this.act === 'flee' || this.act === 'attack' || this.act === 'hide' || this.act === 'fight' || this.act === 'carry';
  }

  // ================================================================ perception
  headPos(): [number, number] {
    return this.body ? this.body.head(this) : [this.x, this.y - 10];
  }

  private perceivePlayer(dt: number) {
    const p = this.host.player, e = this.eco;
    const [hx, hy] = this.headPos();
    const dx = p.x - hx, dy = p.eyeY - hy;
    const d = Math.hypot(dx, dy * 1.25);
    const looking = Math.sign(dx) === this.facing || this.medium === 'air' || e.loco === 'swimmer' ? 1 : 0.4;
    const nightK = this.night && !e.nocturnal ? 0.55 : 1;
    const lightK = 0.55 + 0.45 * this.host.lightAt(p.x, p.eyeY);
    const moveK = 0.55 + Math.min(1, Math.abs(p.vx) / 55) * 0.75;
    const sleepK = this.act === 'sleep' ? 0.12 : this.act === 'rest' ? 0.6 : 1;
    const underwater = !!p.underwater !== (this.medium === 'water');
    const R = e.sight * p.visibility * looking * nightK * lightK * moveK * sleepK * (underwater ? 0.4 : 1);
    const H = 150 * e.hear * p.noise * (this.act === 'sleep' ? 0.6 : 1);
    let gain = 0;
    if (d < R) gain += Math.pow(1 - d / R, 1.2) * 1.6;
    if (d < H) gain += (1 - d / H) * 2.1;
    gain *= 0.45 + e.alert * 0.75;
    gain *= 1 - this.habit * 0.75;
    if (gain > 0.001) this.aw = Math.min(1.2, this.aw + gain * dt);
    else this.aw = Math.max(0, this.aw - dt * (0.08 + (1 - e.alert) * 0.1));
    // habituation: a quiet, still observer at a respectful distance becomes part of the scenery
    const still = Math.abs(p.vx) < 6 && p.noise < 0.2;
    if (this.noticed && still && d > e.flightDist * 1.1) this.habit = Math.min(1, this.habit + dt * (0.03 + e.curious * 0.05 + (1 - e.alert) * 0.02));
    else if (!still && d < e.flightDist * 1.6) this.habit = Math.max(0, this.habit - dt * 0.35);
    if (!this.noticed && this.aw >= 1) {
      this.noticed = true;
      this.onNotice();
    } else if (this.noticed && this.aw < 0.25) this.noticed = false;
    // threat & curiosity from the player
    let pThreat = 0;
    if (this.noticed && e.flightDist > 0) {
      const approach = Math.sign(-dx) === Math.sign(p.vx) || Math.abs(p.vx) < 5 ? 1 : 1.35;
      const k = (1.3 - e.bold * 0.55) * (1 - this.habit * 0.8) * (p.state === 'hide' ? 0.35 : 1) * (this.juvenile ? 1.2 : 1);
      pThreat = clamp((e.flightDist * 1.6 - d) / (e.flightDist * 1.6)) * approach * k * (0.6 + 0.4 * (3 / (2 + e.size)));
      if (p.noise > 0.8 && d < 120) pThreat = Math.max(pThreat, 0.5 * (1 - e.bold));
    }
    if (pThreat > 0.05 && (!this.threat || this.threat.kind === 'player' || pThreat > this.fear)) {
      this.threat = { kind: 'player', x: p.x, y: p.y };
    }
    this.raiseFear(pThreat, dt);
    // curiosity toward a calm observer
    if (this.noticed && pThreat < 0.2 && e.curious > 0.3) this.curio = Math.min(1, this.curio + dt * e.curious * 0.12 * (still ? 1.5 : 0.5));
    // anger at an intruder that won't back off
    if (e.aggro > 0.2 && this.noticed && d < e.flightDist * 1.2 + 20 && this.act !== 'flee') this.anger = Math.min(1, this.anger + dt * e.aggro * (1 - this.habit) * 0.9);
  }

  private raiseFear(target: number, dt: number) {
    if (target > this.fear) this.fear = Math.min(1, this.fear + (target - this.fear) * Math.min(1, dt * 6));
  }

  private scanAnimals() {
    const e = this.eco;
    let worst = 0, wt: Animal | null = null, bestPrey: Animal | null = null, bp = Infinity;
    for (const o of this.host.animals) {
      if (o === this || o.dead || o.gone || o.hidden > 0.8) continue;
      const d = Math.hypot(o.x - this.x, (o.y - this.y) * 1.2);
      if (d > e.sight * 1.2) continue;
      if (fears(this.species, o.species) && !(o.juvenile && !this.juvenile)) {
        const hostile = o.act === 'hunt' || o.act === 'attack' || o.act === 'chase' || o.act === 'prowl' || o.act === 'dive' || o.act === 'stalk';
        const t = clamp(1 - d / (e.sight * 0.9)) * (hostile ? 1.3 : 0.75) * (1.2 - e.bold * 0.5);
        if (t > worst) { worst = t; wt = o; }
      }
      if (hunts(this.species, o.species) && d < bp && !o.held) {
        bp = d;
        bestPrey = o;
      }
    }
    if (wt && worst > 0.1) {
      this.threat = { kind: 'animal', x: wt.x, y: wt.y, a: wt };
      this.fear = Math.max(this.fear, Math.min(1, worst));
      if (!this.noticedAnimal.has(wt.uid)) {
        this.noticedAnimal.add(wt.uid);
        if (worst > 0.45 && e.calls.alarm) this.call('alarm');
      }
    }
    this.prey = bestPrey;
  }
  private noticedAnimal = new Set<number>();

  /** Hear sounds emitted since the last scan. */
  private listen() {
    const e = this.eco;
    for (const s of this.host.sounds) {
      if (s.t <= this.lastHeard || s.src === this) continue;
      const d = Math.hypot(s.x - this.x, s.y - this.y);
      if (d > s.radius * e.hear) continue;
      const same = s.species === this.species;
      switch (s.kind) {
        case 'alarm':
          if (same || (e.size <= 2 && !hunts(this.species, s.species ?? ''))) {
            const k = same ? 0.45 + e.social * 0.4 : 0.3 + (1 - e.bold) * 0.2;
            this.fear = Math.max(this.fear, k);
            this.aw = Math.max(this.aw, 0.6);
            this.face(s.x);
            // relay the alarm through the group (with a little delay)
            if (same && e.social > 0.6 && !this.mem.relayed && e.calls.alarm) {
              this.mem.relayed = 1;
              this.mem.relayT = 0.2 + rand.next() * 0.5;
            }
            if (!same) this.showEmote('question', 1);
          }
          break;
        case 'contact':
        case 'song':
          if (same && this.awake && !this.busy && rand.next() < 0.4 + e.social * 0.4) this.mem.replyT = 0.5 + rand.next() * 1.5;
          if (same && this.herd && Math.abs(s.x - this.x) > 120 && !this.busy) this.goal = { kind: 'point', x: s.x + rand.range(-30, 30), y: s.y };
          break;
        case 'threat':
        case 'roar':
          if (!same && (fears(this.species, s.species ?? '') || e.size <= 2)) this.fear = Math.max(this.fear, 0.5 * (1.2 - e.bold));
          break;
        case 'shutter':
        case 'noise':
          this.aw = Math.min(1.2, this.aw + (1 - d / (s.radius * e.hear)) * 0.35 * (0.4 + e.alert));
          if (e.curious > 0.5 && this.fear < 0.3) this.curio = Math.min(1, this.curio + 0.15);
          if (d < 70 && e.bold < 0.4) this.fear = Math.max(this.fear, 0.35);
          this.face(s.x);
          break;
        case 'splash':
          if ((this.eco.prey?.length || this.eco.food.includes('fish')) && this.medium === 'water' && this.fear < 0.3)
            this.goal = { kind: 'point', x: s.x, y: this.y };
          break;
        case 'fight':
          if (e.curious > 0.5 && this.fear < 0.3 && !this.busy) this.goal = { kind: 'point', x: s.x, y: s.y };
          break;
        case 'rustle':
          this.aw = Math.min(1.2, this.aw + 0.15 * e.alert);
          break;
      }
    }
    this.lastHeard = this.host.time;
  }

  // ================================================================ feelings -> mood
  private updateFeelings(dt: number) {
    const e = this.eco;
    this.fear = Math.max(0, this.fear - dt * (0.05 + e.bold * 0.1) * (this.act === 'hide' || this.act === 'burrow' ? 1.6 : 1));
    this.anger = Math.max(0, this.anger - dt * 0.07);
    this.curio = Math.max(0, this.curio - dt * 0.03);
    const eating = this.act === 'eat' || this.act === 'feed' || this.act === 'browse' || this.act === 'crack' || this.act === 'fish' || this.act === 'raid';
    this.hunger = clamp(this.hunger + dt * (eating ? -0.08 : 0.0035));
    const resting = this.act === 'sleep' || this.act === 'rest' || this.act === 'bask' || this.act === 'hang' || this.act === 'coil';
    this.energy = clamp(this.energy + dt * (resting ? 0.03 : this.act === 'flee' || this.act === 'chase' ? -0.02 : -0.003));
    if (this.threat?.a && (this.threat.a.dead || this.threat.a.gone)) this.threat = null;
    if (this.fear < 0.08 && this.anger < 0.1) this.threat = null;
    if (this.threat?.kind === 'player') { this.threat.x = this.host.player.x; this.threat.y = this.host.player.y; }
    else if (this.threat?.a) { this.threat.x = this.threat.a.x; this.threat.y = this.threat.a.y; }
    const prev = this.mood;
    this.mood =
      this.act === 'sleep' ? 'sleepy'
        : this.fear > 0.45 ? 'afraid'
          : this.anger > 0.45 ? 'aggressive'
            : this.act === 'play' ? 'playful'
              : this.aw > 0.35 && !this.noticed ? 'alert'
                : this.curio > 0.45 ? 'curious'
                  : this.energy < 0.2 ? 'sleepy' : 'calm';
    this.eye = this.act === 'sleep' ? 'closed' : this.mood === 'afraid' ? 'scared' : this.mood === 'aggressive' ? 'angry' : this.mood === 'alert' || this.act === 'alert' || this.act === 'freeze' || this.act === 'sentinel' ? 'alert' : 'open';
    if (prev !== this.mood) this.onMood(prev);
  }

  private onMood(prev: Mood) {
    if (this.mood === 'aggressive') this.showEmote('anger', 1.4);
    else if (this.mood === 'curious' && prev !== 'alert') this.showEmote('question', 1.3);
    else if (this.mood === 'playful') this.showEmote('music', 1.2);
    else if (this.mood === 'calm' && prev === 'afraid' && rand.next() < 0.4) this.showEmote('sweat', 1);
  }

  private onNotice() {
    const e = this.eco;
    const p = this.host.player;
    this.face(p.x);
    if (e.aggro > 0.5) this.showEmote('anger', 1.3, true);
    else if (e.curious > 0.6 && e.bold > 0.4) this.showEmote('question', 1.4, true);
    else this.showEmote('exclaim', 1.1, true);
  }

  showEmote(kind: string, dur = 1.4, force = false) {
    if (!force && this.emoteCd > 0) return;
    this.emote = { kind, t: 0, dur };
    this.emoteCd = 2.2;
  }

  /** vocalise: plays a call, shows a note, and tells the neighbourhood */
  call(kind: 'contact' | 'alarm' | 'threat' | 'song') {
    const c = this.eco.calls[kind] ?? (kind === 'song' ? this.eco.calls.contact : undefined);
    if (!c) return;
    const pitch = (this.juvenile ? 1.35 : 1) * (0.9 + rand.next() * 0.2) * (3 / (2 + this.eco.size));
    this.host.sfx(c, this.x, kind === 'alarm' ? 0.55 : 0.4, pitch);
    this.host.sounds.push({ x: this.x, y: this.y, kind: kind === 'song' ? 'song' : kind, src: this, species: this.species, radius: kind === 'alarm' ? 320 : 240, t: this.host.time + 0.0001 });
    if (kind === 'alarm') this.showEmote('alarm', 1, true);
    else if (kind === 'song' || kind === 'contact') this.showEmote('music', 1.1);
    this.jaw = 1;
  }

  // ================================================================ deciding
  setAct(act: string, dur?: number) {
    if (this.act !== act) {
      this.act = act;
      this.actT = 0;
      this.mem = { relayed: this.mem.relayed ?? 0, relayT: this.mem.relayT ?? 0 };
    }
    this.actDur = dur ?? rand.range(3, 7);
  }

  /** Urgent or opportunistic behaviour changes; returns true if the act changed. */
  interrupts(): boolean {
    const e = this.eco;
    const hook = HOOKS[this.species];
    // 1. fear
    const fleeT = 0.5 - e.bold * 0.18;
    if (this.fear > fleeT && this.threat) {
      const defending = this.act === 'flee' || this.act === 'hide' || this.act === 'burrow' || this.act === 'ball' || this.act === 'dive' || this.act === 'mob' || (this.act === 'freeze' && this.fear < 0.7) || (this.act === 'threat' && this.anger > 0.3);
      if (defending) {
        // still scared: keep doing it
        if (this.actT > this.actDur - 0.1) this.actDur = this.actT + 1.5;
        return true;
      }
      if (hook?.onThreat?.(this)) return true;
      this.defend();
      return true;
    }
    // 2. anger -> threat display, then attack if the intruder keeps coming
    if (this.anger > 0.55 && this.threat?.kind === 'player' && (e.attacksPlayer ?? 0) > 0 && this.act !== 'threat' && this.act !== 'attack') {
      const d = Math.abs(this.host.player.x - this.x);
      if (this.anger > 0.85 && d < e.flightDist + 20 && rand.next() < (e.attacksPlayer ?? 0)) this.setAct('attack', 2.5);
      else this.setAct('threat', 2.5);
      return true;
    }
    if (this.busy || this.act === 'threat' || this.act === 'hunt' || this.act === 'lure-go' || this.act === 'investigate') return false;
    if (hook?.decide?.(this)) return true;
    // 3. hunting
    if (this.prey && this.hunger > 0.35 && (e.prey?.length ?? 0) && this.fear < 0.2) {
      this.setAct('hunt', 14);
      return true;
    }
    // 4. lures
    if (!this.lure && this.fear < 0.3) {
      let best: Lure | null = null, bd = Infinity;
      for (const l of this.host.lures) {
        if (l.life <= 0 || (l.claimed && l.claimed !== this)) continue;
        const likes = l.food.some(f => e.food.includes(f)) || (l.call && this.eco.loco === 'flier' && e.curious > 0.2) || (l.glow && (e.food.includes('insect') || this.species === 'sailglider'));
        if (!likes) continue;
        const d = Math.abs(l.x - this.x);
        if (d < l.scent * (0.6 + this.hunger) && d < bd) { bd = d; best = l; }
      }
      if (best) {
        this.lure = best;
        best.claimed = this;
        this.showEmote(e.food.length ? 'heart' : 'question', 1.2);
        this.setAct('lure-go', 30);
        return true;
      }
    }
    // 5. curiosity
    if (this.curio > 0.55 && this.noticed && this.fear < 0.2 && e.curious > 0.4) {
      this.setAct('investigate', rand.range(4, 8));
      return true;
    }
    // 6. family: stay near the herd
    if (this.herd && this.herd.leader && this.herd.leader !== this && !this.herd.leader.dead && this.act !== 'follow' && this.act !== 'play') {
      const lx = this.herd.leader.x;
      if (Math.abs(lx - this.x) > 90 + e.social * 30 && this.medium === this.herd.leader.medium) {
        this.goal = { kind: 'point', x: lx + rand.range(-30, 30), y: this.herd.leader.y };
        this.setAct('follow', 5);
        return true;
      }
    }
    return false;
  }

  /** Full decision when the current behaviour has run its course. */
  decide() {
    if (this.interrupts()) return;
    // sleep / rest outside the active period
    const active = this.activeNow();
    if (!active || this.energy < 0.15) {
      this.setAct(this.medium === 'air' ? 'perch' : 'sleep', rand.range(10, 25));
      return;
    }
    this.pickIdle();
  }

  activeNow() {
    const t = this.host.tod;
    const e = this.eco;
    if (e.nocturnal) return t === 'night' || t === 'dusk' || (t === 'dawn' && rand.next() < 0.6);
    return t !== 'night' || this.sp.times.includes('night');
  }

  private pickIdle() {
    const t = this.host.tod;
    const opts: IdleAct[] = this.eco.idle.filter(o => (!o.when || o.when.includes(t)) && (!o.poi || this.findPOI(o.poi)));
    if (this.juvenile && this.herd && this.herd.members.some(m => m !== this && m.juvenile)) opts.push({ act: 'play', w: 3 });
    if (!opts.length) { this.setAct('wander'); return; }
    let sum = 0;
    for (const o of opts) sum += o.w * (o.act === this.act ? 0.35 : 1);
    let r = rand.next() * sum;
    let pick = opts[0];
    for (const o of opts) {
      r -= o.w * (o.act === this.act ? 0.35 : 1);
      if (r <= 0) { pick = o; break; }
    }
    this.setAct(pick.act, pick.dur ? rand.range(pick.dur[0], pick.dur[1]) : rand.range(4, 9));
    if (pick.poi) {
      const poi = this.findPOI(pick.poi);
      if (poi) this.goal = { kind: 'poi', x: poi.x, y: poi.y, poi };
    }
  }

  /** choose how to react to danger */
  defend() {
    const e = this.eco;
    const d = e.defense;
    const t = this.threat!;
    const close = Math.abs(t.x - this.x) < e.flightDist * 0.9;
    if (d.includes('burrow')) { this.setAct('burrow', rand.range(6, 12)); return; }
    if (d.includes('ball') && close) { this.setAct('ball', rand.range(6, 12)); return; }
    if (d.includes('quills') && close) { this.setAct('threat', 3); return; }
    if (d.includes('crest') && close && this.anger > 0.2) { this.setAct('threat', 2.5); return; }
    if (d.includes('charge') && this.herd?.members.some(m => m.juvenile) && !this.juvenile && close && t.kind === 'player') { this.setAct('threat', 2); this.anger = Math.max(this.anger, 0.7); return; }
    if (d.includes('mob') && t.a && e.mobs?.includes(t.a.species)) { this.setAct('mob', 8); return; }
    if (d.includes('hide') && this.findPOI('cover', 140)) { this.setAct('hide', rand.range(6, 12)); return; }
    if (d.includes('freeze') && this.fear < 0.7 && !close) { this.setAct('freeze', rand.range(2, 4)); return; }
    if (d.includes('dive') && this.medium === 'water') { this.setAct('dive', 6); return; }
    this.setAct('flee', rand.range(4, 7));
  }

  // ================================================================ points of interest
  findPOI(kind: string, range = 260): POI | null {
    let best: POI | null = null, bd = Infinity;
    for (const p of this.host.pois) {
      if (p.kind !== kind) continue;
      if (p.amount !== undefined && p.amount <= 0) continue;
      if ((p.users ?? 0) >= 2 && this.poi !== p) continue;
      const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y) * 0.5;
      if (d < range && d < bd && p.x > this.home[0] - 120 && p.x < this.home[1] + 120) { bd = d; best = p; }
    }
    return best;
  }

  // ================================================================ movement primitives
  face(x: number) {
    if (Math.abs(x - this.x) > 1) this.facing = x > this.x ? 1 : -1;
  }

  /** walk along the ground/platform. returns true on arrival, false otherwise ('blocked' sets mem.blocked) */
  groundTo(tx: number, speed: number, dt: number): boolean {
    const d = tx - this.x;
    if (Math.abs(d) < 2) { this.vx = 0; return true; }
    this.facing = Math.sign(d);
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    const nx = clamp(this.x + step, this.host.minX - 300, this.host.maxX + 300);
    const t = this.host.terrain;
    let ny: number | null = this.surf ? Terrain.yAt(this.surf, nx) : null;
    if (ny === null || Math.abs(ny - this.y) > 8) {
      const s = t.surfaceBelow(nx, this.y - 8, 0);
      if (s && Math.abs(s.y - this.y) < 10) { this.surf = s.s; ny = s.y; }
      else if (!this.surf) { ny = t.groundY(nx); }
      else { this.vx = 0; this.mem.blocked = 1; return true; }
    }
    this.vx = step / Math.max(dt, 1e-4);
    this.x = nx;
    this.y = ny;
    return false;
  }

  /** stick to the terrain at the current x (after spawning or landing) */
  settle() {
    const s = this.host.terrain.surfaceBelow(this.x, this.y - 12, 0);
    if (s) { this.y = s.y; this.surf = s.s; }
  }

  /** steer through the air toward a point; returns true when close */
  flyTo(tx: number, ty: number, speed: number, dt: number, accel = 220): boolean {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return true;
    const want = Math.min(speed, d * 2.2);
    const wx = (dx / d) * want, wy = (dy / d) * want;
    this.vx += clamp(wx - this.vx, -accel * dt, accel * dt);
    this.vy += clamp(wy - this.vy, -accel * dt, accel * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 4) this.facing = Math.sign(this.vx);
    return false;
  }

  /** move along a trunk to height ty */
  climbTo(ty: number, speed: number, dt: number): boolean {
    const d = ty - this.y;
    if (Math.abs(d) < 1.5) { this.vy = 0; return true; }
    this.vy = Math.sign(d) * Math.min(speed, Math.abs(d) / dt);
    this.y += this.vy * dt;
    if (this.poi?.kind === 'trunk') this.x += (this.poi.x - this.x) * Math.min(1, dt * 6);
    return false;
  }

  /** swim toward a point, staying inside the water */
  swimTo(tx: number, ty: number, speed: number, dt: number): boolean {
    const wy = this.host.waterY ?? this.y;
    const bottom = this.host.terrain.groundY(this.x) - 4;
    const cty = clamp(ty, wy + 2, Math.max(wy + 2, bottom));
    return this.flyTo(tx, cty, speed, dt, 140);
  }

  // ================================================================ per frame
  update(dt: number, st: Stage) {
    void st;
    if (!this.host || !this.eco) return;
    if (this.held) { this.body?.update(dt, this); return; }
    this.actT += dt;
    this.emoteCd -= dt;
    if (this.emote) { this.emote.t += dt; if (this.emote.t > this.emote.dur) this.emote = null; }
    this.jaw = Math.max(0, this.jaw - dt * 2.5);
    this.perceivePlayer(dt);
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.35 + rand.next() * 0.2;
      this.scanAnimals();
      this.listen();
    }
    this.updateFeelings(dt);
    // relayed alarm / call replies
    if (this.mem.relayT) {
      this.mem.relayT -= dt;
      if (this.mem.relayT <= 0) { this.mem.relayT = 0; this.call('alarm'); }
    }
    if (this.mem.replyT) {
      this.mem.replyT -= dt;
      if (this.mem.replyT <= 0) { this.mem.replyT = 0; if (!this.busy && this.awake) this.call(this.eco.calls.song ? 'song' : 'contact'); }
    }
    HOOKS[this.species]?.tick?.(this, dt);
    // thinking
    this.thinkT -= dt;
    if (this.actT > this.actDur) {
      this.thinkT = 0.35 + rand.next() * 0.35;
      this.decide();
    } else if (this.thinkT <= 0) {
      this.thinkT = 0.3 + rand.next() * 0.3;
      if (this.act === 'idle') this.decide();
      else this.interrupts();
    }
    // act
    const fn = SPECIALS[this.species]?.[this.act] ?? ACTS[this.act] ?? ACTS.idle;
    const res = fn(this, dt);
    if (res === false) { this.actDur = 0; this.thinkT = 0; }
    // speed estimate for motion blur
    const inst = Math.hypot(this.x - this.px, this.y - this.py) / Math.max(dt, 1e-4);
    this.speed += (inst - this.speed) * Math.min(1, dt * 10);
    this.px = this.x;
    this.py = this.y;
    // off the map: leave for good
    if (this.x < this.host.minX - 260 || this.x > this.host.maxX + 260 || this.y < -500) this.gone = true;
    this.body?.update(dt, this);
  }

  draw(r: Renderer) {
    if (this.gone || !this.body) return;
    this.body.draw(r, this);
  }

  // ================================================================ camera
  behaviorKey(): string | null {
    if (this.hidden > 0.85) return null;
    const k = this.eco.photo[this.act];
    if (k && this.sp.behaviors[k]) return k;
    // generic fallbacks by name
    if (this.sp.behaviors[this.act]) return this.act;
    return null;
  }

  photoInfo(): PhotoInfo {
    const b = this.body.bounds(this);
    const p = this.host.player;
    // side-on views show the head; fleeing directly away hides the face
    const away = this.act === 'flee' && Math.sign(this.x - p.x) === this.facing;
    return {
      species: this.species, behavior: this.behaviorKey(), box: b, pts: this.body.points(this), speed: this.speed,
      facing: away ? 0.3 : this.act === 'sleep' ? 0.7 : 1, noticed: this.noticed && (this.act === 'flee' || this.act === 'freeze' || this.act === 'alert'),
      juvenile: this.juvenile, p: this.p, hidden: this.hidden,
    };
  }
}

// ==================================================================== generic behaviours

const home = (a: Animal) => a.home[0] + rand.next() * (a.home[1] - a.home[0]);

ACTS.idle = a => {
  a.vx = 0;
  a.anim = 'idle';
  if (a.threat) a.face(a.threat.x);
};

ACTS.wander = (a, dt) => {
  if (a.medium === 'air') return ACTS.fly(a, dt);
  if (a.medium === 'water') return ACTS.swim(a, dt);
  if (a.medium === 'trunk') return ACTS.climb(a, dt);
  if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = home(a); a.mem.blocked = 0; a.mem.pause = 0; }
  if (a.mem.pause > 0) { a.mem.pause -= dt; a.anim = 'idle'; a.vx = 0; return; }
  a.anim = 'walk';
  if (a.groundTo(a.mem.tx, a.eco.walk * (a.juvenile ? 1.2 : 1), dt)) { a.mem.tx = home(a); a.mem.pause = rand.range(0.8, 3); }
};

ACTS.forage = (a, dt) => {
  // slow walk with frequent stops to sniff and nibble
  if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.x + rand.range(-60, 60); a.mem.blocked = 0; }
  if (a.mem.pause > 0) {
    a.mem.pause -= dt;
    a.anim = 'eat';
    a.vx = 0;
    if (a.hunger > 0) a.hunger = Math.max(0, a.hunger - dt * 0.04);
    return;
  }
  a.anim = 'walk';
  if (a.groundTo(clamp(a.mem.tx, a.home[0], a.home[1]), a.eco.walk * 0.6, dt) || rand.next() < dt * 0.3) {
    a.mem.pause = rand.range(1, 2.5);
    a.mem.tx = a.x + rand.range(-60, 60);
  }
};

/** walk to the goal POI then run `then` behaviour there */
function atGoal(a: Animal, dt: number, speed = a.eco.walk): boolean {
  const g = a.goal;
  if (!g) return true;
  if (a.medium === 'air') {
    if (a.flyTo(g.x, g.y - 2, a.eco.run * 0.6, dt)) { a.medium = 'ground'; a.vx = a.vy = 0; a.y = g.y; a.settle(); return true; }
    a.anim = a.vy < -10 ? 'fly' : 'glide';
    return false;
  }
  if (a.medium === 'water') return a.swimTo(g.x, g.y, speed, dt);
  if (a.medium === 'trunk') return true;
  a.anim = 'walk';
  const arrived = a.groundTo(g.x, speed, dt);
  return arrived || !!a.mem.blocked;
}

const stayAt = (anim: string) => (a: Animal, dt: number) => {
  if (!a.mem.there) {
    if (!atGoal(a, dt)) return;
    a.mem.there = 1;
    if (a.goal?.poi) { a.poi = a.goal.poi; a.poi.users = (a.poi.users ?? 0) + 1; }
  }
  a.vx = 0;
  a.anim = anim;
  if (a.actT > a.actDur - 0.05 && a.poi) { a.poi.users = Math.max(0, (a.poi.users ?? 1) - 1); }
};

ACTS.eat = (a, dt) => {
  stayAt('eat')(a, dt);
  if (a.mem.there && a.goal?.poi?.amount !== undefined && rand.next() < dt * 0.1) a.goal.poi.amount = Math.max(0, a.goal.poi.amount - 1);
};
ACTS.dig = stayAt('dig');
ACTS.bask = (a, dt) => {
  stayAt('idle')(a, dt);
  if (a.mem.there && a.actT > 3) a.anim = 'sleep';
};
ACTS.rest = stayAt('idle');
ACTS.groom = stayAt('groom');
ACTS.browse = stayAt('browse');
ACTS.wallow = stayAt('wallow');
ACTS.crack = stayAt('crack');
ACTS.feed = stayAt('feed');
ACTS.sleep = (a, dt) => {
  if (a.medium === 'air') return ACTS.perch(a, dt);
  a.vx = 0;
  a.anim = 'sleep';
  if (a.actT > 1 && (a.emote === null) && rand.next() < dt * 0.25) a.showEmote('zzz', 2.2);
};
ACTS.scent = a => {
  a.vx = 0;
  a.anim = 'idle';
  a.jaw = 0.2;
  if (a.threat) a.face(a.threat.x);
};
ACTS.sit = a => { a.vx = 0; a.anim = 'idle'; };
ACTS.sentinel = a => {
  a.vx = 0;
  a.anim = 'alert';
  // scan both ways
  if (Math.floor(a.actT / 1.6) % 2 === 1 && a.mem.flip !== Math.floor(a.actT / 1.6)) { a.mem.flip = Math.floor(a.actT / 1.6); a.facing = -a.facing; }
};
ACTS.alert = a => {
  a.vx = 0;
  a.anim = 'alert';
  if (a.threat) a.face(a.threat.x);
};
ACTS.freeze = a => {
  a.vx = 0;
  a.vy = 0;
  a.anim = a.medium === 'air' ? 'glide' : 'alert';
  if (a.threat) a.face(a.threat.x);
};
ACTS.call = a => {
  a.vx = 0;
  a.anim = 'call';
  if (!a.mem.called) { a.mem.called = 1; a.call(a.eco.calls.song ? 'song' : 'contact'); }
  if (a.actT > 2.2) return false;
};
ACTS.display = a => {
  a.vx = 0;
  a.anim = 'display';
  if (!a.mem.called && a.eco.calls.contact) { a.mem.called = 1; a.call('contact'); }
  if (a.actT > 3) return false;
};

ACTS.follow = (a, dt) => {
  if (!a.goal) return false;
  if (a.medium === 'air') { if (a.flyTo(a.goal.x, a.goal.y - 30, a.eco.run * 0.5, dt)) return false; a.anim = 'fly'; return; }
  a.anim = 'walk';
  if (a.groundTo(a.goal.x, a.eco.walk * 1.4, dt) || a.mem.blocked) return false;
};

ACTS.flee = (a, dt) => {
  const t = a.threat;
  const e = a.eco;
  const dir = t ? Math.sign(a.x - t.x) || a.facing : a.facing;
  if (e.loco === 'flier' && a.medium !== 'air') {
    a.medium = 'air';
    a.vy = -80;
    a.vx = dir * 40;
    a.host.sfx('wingFlap', a.x, 0.5, 1 / (1 + e.size * 0.2));
  }
  if (a.medium === 'air') {
    a.anim = 'fly';
    a.flyTo(a.x + dir * 200, Math.min(a.y, a.host.terrain.groundY(a.x) - 140) - 40, e.run, dt, 300);
    return;
  }
  if (a.medium === 'water') {
    a.anim = 'swim';
    a.swimTo(a.x + dir * 200, a.y + 20, e.run, dt);
    return;
  }
  if (a.medium === 'trunk') {
    a.anim = 'climb';
    const top = a.poi?.y1 ?? a.y - 100;
    if (a.climbTo(top, e.run * 0.6, dt)) { a.hidden = Math.min(1, a.hidden + dt * 0.8); }
    return;
  }
  a.anim = 'run';
  a.groundTo(a.x + dir * 120, e.run * (a.juvenile ? 0.85 : 1), dt);
  if (a.mem.blocked) {
    // cornered: turn to face the threat
    a.mem.blocked = 0;
    a.anger = Math.max(a.anger, 0.5 * e.aggro + 0.2);
    a.setAct(e.defense.includes('crest') || e.defense.includes('quills') || e.defense.includes('strike') ? 'threat' : 'freeze', 2);
  }
  if (a.fear < 0.15 && a.actT > 1.5) return false;
};

ACTS.hide = (a, dt) => {
  const c = a.findPOI('cover', 200);
  if (!c) return ACTS.flee(a, dt);
  if (!a.mem.there) {
    a.anim = 'run';
    if (a.groundTo(c.x + rand.range(-4, 4), a.eco.run, dt) || a.mem.blocked) a.mem.there = 1;
    return;
  }
  a.vx = 0;
  a.anim = 'idle';
  a.hidden = Math.min(0.85, a.hidden + dt * 1.5);
  if (a.fear < 0.1 && a.actT > 4) { a.hidden = 0; return false; }
};

ACTS.investigate = (a, dt) => {
  const p = a.host.player;
  const want = a.eco.flightDist * 1.25 + 14;
  const d = p.x - a.x;
  a.face(p.x);
  if (Math.abs(d) > want + 4 && a.medium === 'ground') {
    a.anim = 'walk';
    a.groundTo(p.x - Math.sign(d) * want, a.eco.walk * 0.55, dt);
  } else {
    a.vx = 0;
    a.anim = a.eco.photo.scent ? 'idle' : 'alert';
    if (a.species === 'strider') a.act === 'investigate' && (a.jaw = 0.15);
  }
  a.curio = Math.max(0, a.curio - dt * 0.05);
  if (a.curio < 0.2) return false;
};

ACTS.play = (a, dt) => {
  // juveniles chase each other in little bursts, bouncing
  const mates = a.herd?.members.filter(m => m !== a && m.juvenile && !m.dead) ?? [];
  const m = mates[0];
  if (!m) return false;
  if (a.mem.tx === undefined || rand.next() < dt * 0.8) a.mem.tx = m.x + rand.range(-26, 26);
  a.anim = Math.abs(a.mem.tx - a.x) > 6 ? 'run' : 'play';
  a.groundTo(a.mem.tx, a.eco.walk * 2.4, dt);
  if (rand.next() < dt * 0.25) a.showEmote(rand.next() < 0.5 ? 'music' : 'heart', 1);
};

ACTS.threat = a => {
  const t = a.threat;
  a.vx = 0;
  if (t) a.face(t.x);
  a.anim = 'threat';
  a.jaw = 0.7;
  if (!a.mem.called) {
    a.mem.called = 1;
    if (a.eco.calls.threat) a.call('threat');
    a.showEmote('anger', 1.5, true);
  }
  if (a.actT > a.actDur) {
    const d = t ? Math.abs(t.x - a.x) : 999;
    if (d < a.eco.flightDist * 0.8 && a.anger > 0.5 && (a.eco.attacksPlayer ?? 0) > 0 && t?.kind === 'player') a.setAct('attack', 2.5);
    else return false;
  }
};

ACTS.attack = (a, dt) => {
  const t = a.threat;
  if (!t) return false;
  const p = a.host.player;
  a.face(t.x);
  a.anim = 'attack';
  a.jaw = 1;
  if (a.medium === 'water') a.swimTo(t.x, a.host.waterY ?? t.y, a.eco.run, dt);
  else if (a.medium === 'air') a.flyTo(t.x, t.y - 10, a.eco.run, dt, 400);
  else a.groundTo(t.x, a.eco.run, dt);
  if (t.kind === 'player' && Math.abs(p.x - a.x) < 16 && Math.abs(p.y - a.y) < 30) {
    a.host.caught(a, a.eco.size >= 5 ? 3 : a.eco.size >= 3 ? 2 : 1);
    a.anger = 0;
    a.fear = 0;
    a.habit = 0;
    a.setAct('rest', 3);
    return false;
  }
  if (a.actT > 2.5 || a.mem.blocked) { a.anger *= 0.4; return false; }
};

ACTS.hunt = (a, dt) => {
  const prey = a.prey;
  if (!prey || prey.dead || prey.gone || prey.hidden > 0.8) return false;
  const d = prey.x - a.x;
  const e = a.eco;
  if (a.medium === 'air') {
    // circle above, then dive
    if (Math.abs(d) < 40 && a.y < prey.y - 30) { a.setAct('dive', 3); return; }
    a.anim = 'glide';
    a.flyTo(prey.x - Math.sign(d) * 30, prey.y - 110, e.run * 0.5, dt);
    return;
  }
  if (a.medium === 'water') {
    a.anim = 'swim';
    if (a.swimTo(prey.x, prey.y, e.run * (Math.abs(d) < 60 ? 1 : 0.5), dt)) catchPrey(a, prey);
    return;
  }
  // stalk slowly, then sprint
  const stalking = Math.abs(d) > 60;
  a.anim = stalking ? 'walk' : 'run';
  a.act = 'hunt';
  a.groundTo(prey.x, stalking ? e.walk * 0.7 : e.run, dt);
  if (!stalking && prey.act !== 'flee' && prey.fear < 0.5) prey.fear = Math.max(prey.fear, 0.6);
  if (Math.abs(prey.x - a.x) < 10 && Math.abs(prey.y - a.y) < 14) catchPrey(a, prey);
  if (a.actT > 14 || a.mem.blocked) return false;
};

/** predator gets its meal: prey disappears (eaten), predator rests */
export function catchPrey(a: Animal, prey: Animal) {
  if (prey.held) return;
  a.host.sounds.push({ x: prey.x, y: prey.y, kind: 'fight', src: a, species: a.species, radius: 260, t: a.host.time + 0.0001 });
  prey.dead = true;
  a.hunger = 0;
  a.jaw = 1;
  a.showEmote('heart', 1.2, true);
  a.host.sfx(a.eco.calls.threat ?? 'hiss', a.x, 0.5);
  a.setAct(a.species === 'galehawk' ? 'carry' : 'eat', a.species === 'galehawk' ? 6 : 6);
  if (a.species === 'galehawk') a.carrying = prey.species;
}

ACTS['lure-go'] = (a, dt) => {
  const l = a.lure;
  if (!l || l.life <= 0) { a.lure = null; return false; }
  const e = a.eco;
  if (a.medium === 'air') {
    if (a.flyTo(l.x + a.facing * -6, l.y - 4, e.run * 0.5, dt)) { a.medium = 'ground'; a.vx = a.vy = 0; a.settle(); }
    a.anim = 'fly';
    return;
  }
  if (a.medium === 'trunk') {
    // come down to the ground to reach it
    const base = a.poi?.y ?? a.y;
    a.anim = 'climb';
    if (a.climbTo(base, e.walk, dt)) { a.medium = 'ground'; a.settle(); }
    return;
  }
  const d = l.x - a.x;
  if (Math.abs(d) > 10) {
    a.anim = 'walk';
    a.groundTo(l.x - Math.sign(d) * 8, e.walk * (1 + a.hunger), dt);
    if (a.mem.blocked) { l.claimed = null; a.lure = null; return false; }
    return;
  }
  a.vx = 0;
  a.face(l.x);
  a.anim = 'eat';
  l.eaten += dt;
  a.hunger = Math.max(0, a.hunger - dt * 0.05);
  if (l.eaten > 14) { l.life = 0; a.lure = null; a.showEmote('heart', 1.2); return false; }
};

ACTS.fly = (a, dt) => {
  if (a.medium !== 'air') {
    a.medium = 'air';
    a.vy = -60;
    a.host.sfx('wingFlap', a.x, 0.35);
  }
  if (a.mem.tx === undefined) {
    a.mem.tx = home(a);
    a.mem.ty = a.host.terrain.groundY(a.mem.tx) - rand.range(60, 160);
  }
  a.anim = a.vy < -15 || Math.floor(a.actT * 2) % 3 === 0 ? 'fly' : 'glide';
  if (a.flyTo(a.mem.tx, a.mem.ty, a.eco.run * 0.55, dt)) {
    a.mem.tx = home(a);
    a.mem.ty = a.host.terrain.groundY(a.mem.tx) - rand.range(60, 160);
  }
};

ACTS.soar = (a, dt) => {
  if (a.medium !== 'air') return ACTS.fly(a, dt);
  // lazy figure-eights on thermals
  const cx = (a.home[0] + a.home[1]) / 2, span = (a.home[1] - a.home[0]) / 2;
  const t = a.actT * 0.25 + a.uid;
  const tx = cx + Math.sin(t) * span, ty = a.host.terrain.groundY(cx) - 190 + Math.sin(t * 2) * 30;
  a.flyTo(tx, ty, a.eco.run * 0.45, dt, 90);
  a.anim = a.vy < -20 ? 'fly' : 'soar';
};

ACTS.perch = (a, dt) => {
  const pr = a.goal?.poi?.kind === 'perch' ? a.goal.poi : a.findPOI('perch', 500);
  if (!pr) return ACTS.soar(a, dt);
  if (!a.mem.there) {
    if (a.medium !== 'air') { a.medium = 'air'; a.vy = -60; }
    a.anim = 'fly';
    if (a.flyTo(pr.x, pr.y, a.eco.run * 0.5, dt)) {
      a.mem.there = 1;
      a.x = pr.x;
      a.y = pr.y;
      a.vx = a.vy = 0;
      a.medium = 'ground';
      a.poi = pr;
    }
    return;
  }
  a.anim = a.act === 'preen' || (a.actT % 7 > 5) ? 'preen' : 'idle';
  if (a.act === 'sleep') a.anim = 'sleep';
};
ACTS.preen = ACTS.perch;

ACTS.swim = (a, dt) => {
  if (a.medium !== 'water') return ACTS.wander(a, dt);
  if (a.mem.tx === undefined) { a.mem.tx = home(a); a.mem.ty = (a.host.waterY ?? a.y) + rand.range(4, 40); }
  a.anim = 'swim';
  if (a.swimTo(a.mem.tx, a.mem.ty, a.eco.walk, dt)) { a.mem.tx = home(a); a.mem.ty = (a.host.waterY ?? a.y) + rand.range(4, 40); }
};

ACTS.dive = (a, dt) => {
  if (a.medium === 'air') {
    // stoop onto prey
    const prey = a.prey;
    a.anim = 'dive';
    const tx = prey ? prey.x : a.x + a.facing * 40, ty = prey ? prey.y - 4 : a.host.terrain.groundY(a.x);
    a.flyTo(tx, ty, a.eco.run * 1.6, dt, 700);
    if (prey && Math.hypot(prey.x - a.x, prey.y - a.y) < 12) catchPrey(a, prey);
    else if (a.y >= a.host.terrain.groundY(a.x) - 6 || a.actT > 3) { a.vy = -120; a.setAct('fly', 3); }
    return;
  }
  // water: go deep and wait
  a.anim = 'swim';
  a.swimTo(a.x + a.facing * 30, (a.host.waterY ?? a.y) + 60, a.eco.run, dt);
  a.hidden = Math.min(0.7, a.hidden + dt * 0.5);
  if (a.actT > a.actDur) { a.hidden = 0; return false; }
};

ACTS.carry = (a, dt) => {
  a.anim = 'carry';
  if (a.medium !== 'air') { a.medium = 'air'; a.vy = -80; }
  a.flyTo(a.x + a.facing * 200, a.host.terrain.groundY(a.x) - 220, a.eco.run * 0.5, dt);
  if (a.actT > a.actDur) { a.carrying = null; return false; }
};

ACTS.climb = (a, dt) => {
  const tr = a.poi?.kind === 'trunk' ? a.poi : a.findPOI('trunk', 300);
  if (!tr) return ACTS.wander(a, dt);
  if (a.medium !== 'trunk') {
    a.anim = 'walk';
    if (a.groundTo(tr.x, a.eco.walk, dt) || a.mem.blocked) { a.medium = 'trunk'; a.poi = tr; }
    return;
  }
  a.poi = tr;
  if (a.mem.ty === undefined) a.mem.ty = rand.range(tr.y1 ?? tr.y - 100, tr.y - 20);
  a.anim = 'climb';
  if (a.climbTo(a.mem.ty, a.eco.walk * 0.7, dt)) { a.mem.ty = undefined as unknown as number; a.anim = 'idle'; if (rand.next() < 0.5) return false; }
};
ACTS.cling = a => {
  a.vx = a.vy = 0;
  a.anim = a.medium === 'trunk' ? 'cling' : 'idle';
};

ACTS.glide = (a, dt) => {
  // climb high on the current trunk, then launch at a distant trunk and glide down to it
  if (a.medium !== 'trunk' && a.medium !== 'air') return ACTS.climb(a, dt);
  if (a.medium === 'trunk') {
    const top = a.poi?.y1 ?? a.y - 80;
    a.anim = 'climb';
    if (!a.climbTo(top + 10, a.eco.walk, dt)) return;
    const dest = a.host.pois.filter(p => p.kind === 'trunk' && p !== a.poi && Math.abs(p.x - a.x) > 80 && Math.abs(p.x - a.x) < 320);
    if (!dest.length) return false;
    const tr = dest[Math.floor(rand.next() * dest.length)];
    a.mem.gx = tr.x;
    a.mem.gy = Math.max(tr.y1 ?? tr.y - 120, a.y + 40);
    a.mem.gi = a.host.pois.indexOf(tr);
    a.medium = 'air';
    a.vx = Math.sign(tr.x - a.x) * 40;
    a.vy = 10;
    return;
  }
  a.anim = 'glide';
  if (a.flyTo(a.mem.gx, a.mem.gy, a.eco.run, dt, 120)) {
    a.medium = 'trunk';
    a.poi = a.host.pois[a.mem.gi] ?? null;
    a.vx = a.vy = 0;
    return false;
  }
};
