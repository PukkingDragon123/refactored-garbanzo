// V11 predators, the framework: which animals are predators and how they take a beating.
//
// A predator is an ordinary wildlife Animal (wild/animal.ts: perception, feelings, acts, the photo
// system) whose species is registered here with registerPredator(). Each one keeps a little combat
// state (nerve, stun, blindness, its current target, the encounter phase). Deterrents (slingshot
// pebbles, Aroha's grenades, smoke, pepper, noise) go through deter() / deterArea(): they cost the
// predator nerve, can stun it, and once its nerve is gone it breaks off and retreats (the species
// decides how: the Cerebral Tiger backs into its mud). There are no hit points anywhere: when a
// predator reaches someone, knockDown() costs Mori a big chunk of energy (v10/energy.ts; at 0 the
// blackout fires), makes him drop what he carries (or something from the pack, left lying where he
// fell) and scares the party. Everything that happens is broadcast (onPredator) for the companion
// AI, the HUD and the story.
//
// Register another predator: registerPredator({ species, ... }) plus its acts (wild/animal.ts
// SPECIALS) and, if it needs one, a Body (wild/bodies.ts BODY_MAKERS); the scene controller
// (predators-scene.ts) picks it up from scene.animals automatically.

import type { Animal } from '../wild/animal';
import type { FieldScene } from '../scenes/field';
import type { Actor } from '../../world/actor';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { game } from '../game';
import { spend, onExpedition } from '../v10/energy';
import { carryOf, setCarry } from './carry';
import { ITEMS } from '../items';
import { add, remove } from '../inventory';
import { itemIcon } from '../../art/itemicons';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { sfx11 } from './predators-sfx';
import { SPECIES_BY_ID } from '../species';
import { rand } from '../../core/math';
import { hasAnim7 } from '../../art/v7/anim-contract';

/** the first of these V7 cast anims that exists (the combat set is being added: fall back gracefully) */
export function anim7(...names: string[]): string {
  for (const n of names) if (hasAnim7(n)) return n;
  return names[names.length - 1];
}

// ------------------------------------------------------------------ registry
export type DeterKind = 'pebble' | 'grenade' | 'smoke' | 'pepper' | 'flash' | 'noise' | 'shout';

export interface PredatorDef {
  species: string;
  /** 1 a nuisance .. 3 apex: scales the knock-down */
  tier: 1 | 2 | 3;
  /** energy a knock-down costs Mori */
  knockEnergy: number;
  /** deterrence it takes before it gives up (a pebble is 1, a headshot 1.6, a grenade 2.5) */
  nerve: number;
  /** seconds a solid hit stuns it (pebbles stun for part of it) */
  stunTime: number;
  /** after it gives up: seconds before it will hunt again */
  restTime: number;
  /** a deterrent landed (play a flinch, a roar...) */
  onHit?(a: Animal, kind: DeterKind, power: number, s: FieldScene): void;
  /** it has had enough: break off and retreat */
  onBreak?(a: Animal, s: FieldScene): void;
  /** what Aroha shouts while it's on the attack (one at random) */
  advice?: string[];
}

export const PREDATORS: Record<string, PredatorDef> = {};
export function registerPredator(d: PredatorDef): PredatorDef { PREDATORS[d.species] = d; return d; }
export const isPredator = (a: Animal | null | undefined): boolean => !!a && !!PREDATORS[a.species] && !a.dead && !a.gone;

// ------------------------------------------------------------------ per-animal combat state
export type PredPhase = 'idle' | 'lurk' | 'stalk' | 'charge' | 'attack' | 'stunned' | 'retreat';
export type Target11 = { kind: 'player' } | { kind: 'actor'; a: Actor };

export interface PredState {
  nerve: number;
  stun: number;
  /** smoke in its eyes: it can't see its target (seconds) */
  blind: number;
  /** after breaking off: seconds before it hunts again */
  rest: number;
  target: Target11 | null;
  hits: number;
  sinceHit: number;
  phase: PredPhase;
  /** the story drives it (tigerAmbush): the AI keeps its hands off */
  script: boolean;
  /** knock-downs this encounter */
  downs: number;
}
const STATE = new WeakMap<Animal, PredState>();
export function predState(a: Animal): PredState {
  let s = STATE.get(a);
  if (!s) {
    s = { nerve: PREDATORS[a.species]?.nerve ?? 4, stun: 0, blind: 0, rest: 0, target: null, hits: 0, sinceHit: 99, phase: 'idle', script: false, downs: 0 };
    STATE.set(a, s);
  }
  return s;
}
/** world position of a target */
export function targetPos(s: FieldScene, t: Target11): [number, number] {
  if (t.kind === 'player') return [s.player.x, s.player.y];
  return [t.a.x, t.a.y];
}
export const targetName = (t: Target11) => (t.kind === 'player' ? 'mori' : t.a.id);

// ------------------------------------------------------------------ events
export type PredEvent = 'notice' | 'stalk' | 'charge' | 'attack' | 'knockdown' | 'hit' | 'stun' | 'break' | 'retreat' | 'submerge' | 'plinked' | 'shout' | 'ambush' | 'ambushEnd';
export interface PredInfo { a?: Animal | null; who?: string; kind?: DeterKind; power?: number; x?: number; head?: boolean }
type PredFn = (ev: PredEvent, info: PredInfo) => void;
const listeners: PredFn[] = [];
/** listen to everything predators do (returns an unsubscribe) */
export function onPredator(fn: PredFn): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}
export function emitPred(ev: PredEvent, info: PredInfo = {}) {
  for (const f of listeners.slice()) { try { f(ev, info); } catch (e) { console.error(e); } }
}

// ------------------------------------------------------------------ deterrence
const COST: Record<DeterKind, number> = { pebble: 1, grenade: 2.5, smoke: 1.2, pepper: 2, flash: 1.6, noise: 0.5, shout: 0.45 };

/**
 * A deterrent lands on a predator. power ~1 (a headshot 1.6, a point-blank grenade 1.5). Costs it
 * nerve, can stun it; when the nerve is gone it breaks off (PredatorDef.onBreak).
 */
export function deter(s: FieldScene, a: Animal, kind: DeterKind, power = 1, o: { x?: number; head?: boolean } = {}) {
  const d = PREDATORS[a.species];
  if (!d || a.dead || a.gone) return;
  const st = predState(a);
  st.nerve -= COST[kind] * power;
  st.hits++;
  st.sinceHit = 0;
  if (kind === 'pebble') st.stun = Math.max(st.stun, d.stunTime * 0.35 * power);
  else if (kind === 'grenade' || kind === 'flash') st.stun = Math.max(st.stun, d.stunTime * power);
  else if (kind === 'pepper') st.stun = Math.max(st.stun, d.stunTime * 0.6 * power);
  if (kind === 'smoke' || kind === 'pepper') st.blind = Math.max(st.blind, 3.5 * power);
  // it now knows exactly who is shooting at it
  a.aw = Math.max(a.aw, 1);
  emitPred('hit', { a, kind, power, x: o.x, head: o.head });
  d.onHit?.(a, kind, power, s);
  if (st.stun > 0.6) emitPred('stun', { a, kind });
  if (st.nerve <= 0 && st.phase !== 'retreat') {
    st.phase = 'retreat';
    st.rest = d.restTime;
    st.target = null;
    emitPred('break', { a });
    d.onBreak?.(a, s);
  }
}

/** a deterrent covering an area (grenade bursts, clouds, shouts): every predator inside it, scaled by distance */
export function deterArea(s: FieldScene, x: number, y: number, r: number, kind: DeterKind, power = 1) {
  for (const a of s.animals) {
    if (!isPredator(a)) continue;
    const b = a.body?.bounds(a);
    const cx = b ? (b.x0 + b.x1) / 2 : a.x, cy = b ? (b.y0 + b.y1) / 2 : a.y - 20;
    const hw = b ? (b.x1 - b.x0) / 2 : 20;
    const d = Math.max(0, Math.abs(cx - x) - hw * 0.6) + Math.abs(cy - y) * 0.4;
    if (d > r) continue;
    deter(s, a, kind, power * (1 - (d / r) * 0.5), { x });
  }
  // everyone else in earshot gets a fright too
  s.sounds.push({ x, y, kind: kind === 'shout' ? 'noise' : 'fight', src: null, species: null, radius: kind === 'flash' || kind === 'grenade' ? 420 : 240, t: s.time + 0.0001 });
}

/** a reset between encounters (the ambush ends, the predator has rested) */
export function restore(a: Animal) {
  const st = predState(a), d = PREDATORS[a.species];
  st.nerve = d?.nerve ?? 4;
  st.hits = 0;
  st.downs = 0;
  st.stun = 0;
  st.blind = 0;
  if (st.phase === 'retreat') st.phase = 'idle';
}

// ------------------------------------------------------------------ knock-downs

/** something on the ground that was dropped: walk up and press E to pick it up */
class Dropped implements Drawable {
  z = 22;
  dead = false;
  private t = 0;
  private fr: Frame | null = null;
  private vy = -90;
  private oy = -26;
  private it: unknown = null;
  constructor(readonly s: FieldScene, public x: number, public y: number, readonly what: { item?: string; carry?: string }, readonly label: string) {
    const icon = what.item ? itemIcon(what.item) : null;
    if (icon) this.fr = local.add(`v11:drop:${what.item}:${Math.random()}`, icon, icon.w / 2, icon.h);
    const it = {
      x, y, w: 10, h: 10, label: `Pick up ${label}`, standX: x - 10,
      action: () => this.take(),
      enabled: () => !this.dead,
    };
    s.interact.push(it as never);
    this.it = it;
  }
  take() {
    if (this.dead) return;
    if (this.what.item) {
      const got = add(this.what.item, 1);
      if (!got) { audio.play('wrong', { vol: 0.5 }); game.ui.toast('No room in the backpack.', 'PACK', 'coral'); return; }
    }
    if (this.what.carry) setCarry(this.s.player.body, this.what.carry);
    this.dead = true;
    const i = this.s.interact.indexOf(this.it as never);
    if (i >= 0) this.s.interact.splice(i, 1);
    audio.play('collectPop' as never, { vol: 0.5 });
    this.s.player.body.react('bounce');
    this.s.hud?.refresh();
    game.persist();
  }
  update(dt: number) {
    this.t += dt;
    if (this.oy < 0 || this.vy < 0) {
      this.vy += 420 * dt;
      this.oy = Math.min(0, this.oy + this.vy * dt);
      if (this.oy >= 0 && this.vy > 60) { this.vy = -this.vy * 0.3; this.oy = -0.01; }
    }
  }
  draw(r: Renderer) {
    if (this.dead) return;
    const y = this.y + this.oy;
    if (this.fr) r.draw(this.fr, this.x, y + 1, 0.55, 0.55, Math.sin(this.t * 0.7) * 0.05);
    else r.draw(A.blob, this.x, y - 2, 0.5, 0.35, 0, packColor(0.75, 0.6, 0.4, 1));
    const k = Math.max(0, Math.sin(this.t * 2.2));
    r.fxDraw(A.spark, this.x + 3, y - 9, 0.7, 0.7, this.t, packColor(1, 0.95, 0.7, 1), 1.4 * k);
  }
}

/** what Mori is likely to fumble when he goes down: what he carries, else something from the pack */
function dropSomething(s: FieldScene, x: number, y: number): string | null {
  const p = s.player;
  const c = carryOf(p.body);
  if (c) {
    setCarry(p.body, null);
    s.main.add(new Dropped(s, x, y, { carry: c }, `the ${c}`));
    return `the ${c}`;
  }
  const inv = game.save.inv.filter(st => { const d = ITEMS[st.id]; return d && d.kind !== 'key' && d.kind !== 'tool'; });
  if (!inv.length) return null;
  const st = inv[Math.floor(rand.next() * inv.length)];
  const d = ITEMS[st.id];
  if (!remove(st.id, 1)) return null;
  s.main.add(new Dropped(s, x, y, { item: st.id }, `the ${d.name.toLowerCase()}`));
  return `${/^[aeiou]/i.test(d.name) ? 'an' : 'a'} ${d.name.toLowerCase()}`;
}

const OOF = ['Oof!', 'Ow ow ow...', 'Nope. Nope nope nope.', 'I am not food! I am NOT food!', 'Ugh... everything hurts.'];
const KID: Record<string, string[]> = {
  jenna: ['AAAH! Get it off, get it off!', 'I’m fine! I’m fine! I’m not fine!'],
  joshu: ['Oi! Not the face!', 'That’s it, I’m going back to the boat.'],
  chunk: ['Yip! YIP!', 'Awoooo!'],
};

/**
 * A predator has reached someone. Mori: knocked flat, a big chunk of energy gone (the blackout if it
 * hits 0), he drops something, a moment on the ground. A companion: bowled over and running for it
 * (Aroha always rolls clear).
 */
export function knockDown(s: FieldScene, a: Animal, t: Target11) {
  const d = PREDATORS[a.species];
  const st = predState(a);
  st.downs++;
  const dir = Math.sign((t.kind === 'player' ? s.player.x : t.a.x) - a.x) || a.facing;
  s.st.shake(4 + (d?.tier ?? 2), 0.5);
  sfx11('thud', { x: a.x });
  if (t.kind === 'player') {
    const p = s.player;
    game.r.post.flash = Math.max(game.r.post.flash, 0.4);
    p.cancelWork();
    s.cam?.raise(false);
    p.hurtT = 1.6;
    p.state = 'stunned';
    p.vx = dir * 170;
    p.vy = -120;
    p.onGround = false;
    p.body.react('jump');
    p.body.setExpr('scared', 3.5);
    p.body.showEmote('star', 1.8);
    const fall = 'fallBack';
    p.poseOverride = fall;
    setTimeout(() => { if (p.poseOverride === fall) p.poseOverride = 'sitShock'; }, 520);
    setTimeout(() => { if (p.poseOverride === 'sitShock' || p.poseOverride === fall) p.poseOverride = null; if (p.state === 'stunned') p.state = 'normal'; }, 1500);
    const cost = d?.knockEnergy ?? 25;
    const exp = onExpedition();
    if (exp) spend(cost, 'predator');
    const lost = dropSomething(s, p.x + dir * 14, p.y);
    const name = SPECIES_BY_ID[a.species]?.name ?? 'predator';
    game.ui.toast(`The ${name} knocked you flat!${exp ? ` <b>-${cost} energy.</b>` : ''}${lost ? ` You dropped ${lost}.` : ''}`, 'DANGER', 'coral', 4200);
    game.ui.bubbles.bark(p.id, OOF[Math.floor(rand.next() * OOF.length)], { expr: 'scared', emote: 'sweat' } as never);
    emitPred('knockdown', { a, who: 'mori' });
    return;
  }
  const act = t.a;
  if (act.id === 'aroha') { act.play(anim7('roll', 'dodge', 'crouch'), act.idleAnim).catch(() => {}); return; }
  act.react('jump');
  act.showEmote('shock', 1.6);
  act.setExpr('scared', 3);
  if (act.id === 'chunk') act.play('trip', 'hide').catch(() => {});
  else act.play('fallBack', 'scared').catch(() => {});
  setTimeout(() => { act.walkTo(act.x + dir * 70, 120, act.id === 'chunk' ? 'run' : 'run').catch(() => {}); }, 650);
  const lines = KID[act.id];
  if (lines) game.ui.bubbles.bark(act.id, lines[Math.floor(rand.next() * lines.length)], { style: 'shout', expr: 'scared' } as never);
  emitPred('knockdown', { a, who: act.id });
}

// ------------------------------------------------------------------ things to shoot at (fruit, cans, targets)
export interface ShootTarget {
  x: number;
  y: number;
  /** hit radius */
  r: number;
  /** a pebble hit it (power 0..1.6) */
  hit(power: number, x: number, y: number): void;
  /** false once it's gone */
  alive?(): boolean;
}
const TARGETS = new Set<ShootTarget>();
/** register something the slingshot can hit (returns a remover) */
export function addShootTarget(t: ShootTarget): () => void {
  TARGETS.add(t);
  return () => TARGETS.delete(t);
}
export function shootTargets(): ShootTarget[] {
  for (const t of TARGETS) if (t.alive && !t.alive()) TARGETS.delete(t);
  return [...TARGETS];
}
export function clearShootTargets() { TARGETS.clear(); }
