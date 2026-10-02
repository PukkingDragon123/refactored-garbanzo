// V10 expedition body: energy, backpack weight and the blackout.
//
// Energy (0..maxEnergy) lives in the 'energy' save bucket. It drains only on expeditions (never at camp
// or aboard the ship): a trickle standing still, more walking, wading and working, a lot sprinting and
// climbing, most of all swimming, all multiplied by the pack's encumbrance and fx10.energyMult(). A
// heavy pack also slows Mori down (Player.loadK), and far over capacity he can't sprint. Food from the
// backpack restores it (see forage10.ts); unidentified forage can make him ill (ailments below). It
// refills at the start of each day. When it hits 0 on an expedition the blackout fires once (the
// camp module plays the carry-home; without one a simple fallback keeps the game going).
//
// Other modules only call the exported functions; the scenes call tickBody() once per frame.

import { game } from '../game';
import { ITEMS } from '../items';
import type { ItemKind } from '../items';
import { bucket } from './store';
import { fx10 } from './skills10';
import { audio } from '../../core/audio';
import type * as ExpMod from './expedition';
import type * as DayMod from './day';
import type * as GearMod from './campgear';
import type * as RegMod from './regions';
import type { Player } from '../../world/player';
import type { Stage } from '../../world/stage';

// ---------------------------------------------------------------- state

export type AilmentKind = 'stomach' | 'dizzy';
export interface Ailment {
  kind: AilmentKind;
  /** seconds so far / total */
  t: number;
  dur: number;
  /** stomach: total energy drained over dur; dizzy: strength 0..1 */
  k: number;
  /** what caused it (item id) */
  src?: string;
  /** next gurgle / stagger (seconds, on t's clock) */
  next?: number;
}

interface BodyState {
  e: number;
  /** day key of the last refill (see dayKey) */
  day: string;
  /** the blackout fired since the last refill / restore */
  out: boolean;
  ail: Ailment[];
}

// The expedition and day modules import this one, so this one loads them lazily (no import cycle:
// expedition.ts may well pull in scenes). Until they are in, there is no expedition and no day change.
// (Function declarations and `var`s below for the same reason: callers may reach in while this loads.)
var expMod: typeof ExpMod | null = null; // eslint-disable-line no-var
var dayMod: typeof DayMod | null = null; // eslint-disable-line no-var
var regMod: typeof RegMod | null = null; // eslint-disable-line no-var
void import('./expedition').then(m => { expMod = m; });
void import('./day').then(m => { dayMod = m; });
var gearMod: typeof GearMod | null = null; // eslint-disable-line no-var
void import('./campgear').then(m => { gearMod = m; });
void import('./regions').then(m => { regMod = m; });

function S(): BodyState { return bucket<BodyState>('energy', () => ({ e: 100, day: '', out: false, ail: [] })); }
function clamp(v: number, a = 0, b = 1) { return v < a ? a : v > b ? b : v; }
function dayKey() { return dayMod ? `${dayMod.dayNumber()}:${game.save.day}` : ''; }
/** lowest low-energy warning already barked (reset by refill) */
var warned = 0; // eslint-disable-line no-var

/** a new day since the last refill? refill (the day module can also call refill() itself) */
function sync(b: BodyState) {
  const k = dayKey();
  if (!k || b.day === k) return;
  if (b.day) refill();
  else b.day = k;
}

// ---------------------------------------------------------------- energy

export function maxEnergy(): number { return 100 + fx10.maxEnergyBonus(); }

/** current energy 0..maxEnergy() */
export function energy(): number {
  const b = S();
  sync(b);
  return clamp(b.e, 0, maxEnergy());
}

/** energy as a fraction of the maximum */
export function energyFrac() { return energy() / maxEnergy(); }

type SpendFn = (n: number, why: string) => void;
/** listeners live on hoisted functions so modules in an import cycle can register while this one loads */
function spendFns(): SpendFn[] { const f = spendFns as unknown as { l?: SpendFn[] }; return (f.l ??= []); }
/** called on every spend (HUD flashes, tests); returns an unsubscribe */
export function onSpend(fn: SpendFn): () => void {
  spendFns().push(fn);
  return () => { const l = spendFns(), i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
}

/** spend raw energy (poison, hazards...); reaching 0 on an expedition fires the blackout once (away
 *  from an expedition it never drops below 5: camp is safe) */
export function spend(n: number, why = ''): void {
  if (!(n > 0)) return;
  const b = S();
  sync(b);
  const cur = Math.min(maxEnergy(), b.e);
  const exp = onExpedition();
  b.e = Math.max(exp ? 0 : Math.min(cur, 5), cur - n);
  for (const f of spendFns()) f(n, why);
  if (b.e <= 0 && !b.out && exp) {
    b.out = true;
    game.persist();
    fireBlackout();
  }
}

/** spend energy for physical effort (a cliff, a river crossing...): scaled by Field Skills
 *  (fx10.energyMult), the pack's weight and the route's difficulty */
export function effort(n: number, why = ''): void {
  spend(n * fx10.energyMult() * (gearMod?.gearFx.energyMult() ?? 1) * loadCostK() * routeK(), why);
}

export function restore(n: number): void {
  if (!(n > 0)) return;
  const b = S();
  sync(b);
  b.e = Math.min(maxEnergy(), b.e + n);
  if (b.e > 0) b.out = false;
}

/** refill at the start of each day (sleep): full energy, ailments slept off */
export function refill(): void {
  const b = S();
  b.e = maxEnergy();
  b.out = false;
  b.ail = [];
  b.day = dayKey() || b.day;
  warned = 0;
}

/** has the blackout fired (and energy not been restored since)? */
export function blackedOut() { return S().out; }

// ---------------------------------------------------------------- weight

/** kg per unit by kind, for items without an explicit weight */
const KIND_KG: Record<ItemKind, number> = {
  tool: 0.4, material: 0.5, plant: 0.05, fungus: 0.08, insect: 0.03, animal: 0.03, lure: 0.3, food: 0.2, key: 0.1, shell: 0.05,
};
/** explicit weights for things that are clearly heavier or lighter than their kind */
const KG: Record<string, number> = {
  // tools on the belt
  camera: 1.1, knife: 0.15, jar: 0.6, net: 0.4, trowel: 0.4, tweezers: 0.05, gloves: 0.1, hammer: 0.8, headlamp: 0.15,
  translator: 0.2, ghillie: 1.2, binoculars: 0.8,
  // salvage and building materials
  canvas: 3.5, poles: 0.7, rope: 0.5, flax: 0.05, wood: 0.6, stone: 0.8, plank: 1.4, scrap: 0.9, resin: 0.15, wire: 0.2,
  battery: 2, driftglass: 0.05, kelp: 0.1, flint: 0.35, clay: 0.8,
  // heavy or bulky finds
  pitcher: 0.25, moonfruit: 0.3, plant_dunelily: 0.2, flaxleaf: 0.08, bracket: 0.4, weta: 0.06, bone: 0.3, plate: 0.25,
  eggshell: 0.02, shell_trycop: 0.25, shell_cone: 0.08, trap: 1.4, caller: 0.1,
  // food
  ration: 0.15, stew: 0.7, tea: 0.35, mussel: 0.08, pipi: 0.04, berry_ember: 0.02, berry_dusk: 0.02, berry_gold: 0.02,
};

// published on the item defs too, so anything reading ItemDef.weight sees them (items other modules
// define later bring their own weight, or fall back to their kind's)
for (const [id, kg] of Object.entries(KG)) if (ITEMS[id] && ITEMS[id].weight === undefined) ITEMS[id].weight = kg;

/** carried weight of one unit, kg (ItemDef.weight wins, then the table above, then the kind default) */
export function weightOf(id: string): number {
  const d = ITEMS[id];
  if (!d) return 0;
  return d.weight ?? KG[id] ?? KIND_KG[d.kind] ?? 0.2;
}

/** carried weight in kg (backpack + tool belt) */
export function packWeight(): number {
  let w = 0;
  for (const s of game.save.inv) w += weightOf(s.id) * s.n;
  for (const t of game.save.tools) w += weightOf(t);
  return Math.round(w * 100) / 100;
}
/** the pack's comfortable capacity, kg */
export function packCapacity(): number { return 12 + fx10.packBonus() + (gearMod?.gearFx.packBonus() ?? 0); }
/** 0..1+ : carried weight over capacity */
export function encumbrance(): number { return packWeight() / Math.max(1, packCapacity()); }

/** energy cost multiplier for a load: free up to half the capacity, 1.35x when full, steep above */
export function loadCostK(enc = encumbrance()): number {
  if (enc <= 0.5) return 1;
  if (enc <= 1) return 1 + (enc - 0.5) * 0.7;
  return Math.min(3.5, 1.35 + (enc - 1) * 2.4);
}
/** movement speed multiplier for a load: a little slower when full, a lot slower above capacity */
export function loadSpeedK(enc = encumbrance()): number {
  let k: number;
  if (enc <= 0.6) k = 1;
  else if (enc <= 1) k = 1 - (enc - 0.6) * 0.3;
  else k = Math.max(0.35, 0.88 - (enc - 1) * 1.1);
  return 1 - (1 - k) * (1 - fx10.loadTolerance());
}
/** too heavy to run */
export const tooHeavyToRun = (enc = encumbrance()) => enc > 1.35 + fx10.loadTolerance() * 0.3;

// ---------------------------------------------------------------- where we are

type SiteLike = { id?: string; noExit?: boolean };
/**
 * Out on an expedition (energy drains, the body HUD shows)? The expedition module's current
 * expedition; V2 expedition sites (they have a way back to camp) count even when entered directly.
 * Never aboard the ship. Flag v10:testExp makes any field scene count (testing).
 */
export function onExpedition(): boolean {
  const site = (game.scene as unknown as { site?: SiteLike } | null)?.site;
  if (site?.id === 'boat') return false;
  if (expMod?.currentExpedition()) return true;
  if (!site) return false;
  if (game.save.flags['v10:testExp']) return true;
  return !site.noExit;
}

/** rough country costs more: the current location's difficulty (1..5) adds up to a third to effort */
export function routeK(): number {
  const id = expMod?.currentExpedition();
  const d = id ? regMod?.location(id)?.difficulty ?? 1 : 1;
  return 1 + (Math.max(1, Math.min(5, d)) - 1) * 0.08;
}

// ---------------------------------------------------------------- the blackout

type BlackoutFn = () => void;
function blackoutFns(): BlackoutFn[] { const f = blackoutFns as unknown as { l?: BlackoutFn[] }; return (f.l ??= []); }
/** called once when energy hits 0 during an expedition (the camp module plays the carry-home); returns an unsubscribe */
export function onBlackout(fn: BlackoutFn): () => void {
  blackoutFns().push(fn);
  return () => { const l = blackoutFns(), i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
}
/** run the blackout listeners (or, with none, a simple fallback: Mori drops and comes to later) */
export function fireBlackout() {
  const l = blackoutFns();
  if (!l.length) { void fallbackBlackout(); return; }
  for (const f of l) { try { f(); } catch (e) { console.error(e); } }
}

let fallbackBusy = false;
/** nobody listens for the blackout: Mori drops, the expedition tries to take him home, else he comes to where he fell */
async function fallbackBlackout() {
  if (fallbackBusy) return;
  fallbackBusy = true;
  const sc = game.scene as unknown as FieldLike | null;
  const p = sc?.player;
  try {
    if (sc) { sc.cutscene = true; sc.cam?.raise?.(false); }
    if (p) { p.vx = 0; p.poseOverride = 'lie'; }
    game.ui.bubbles.bark(p?.id ?? 'mori', '...everything’s... going grey...', { expr: 'tired' } as never);
    await new Promise(r => setTimeout(r, 1400));
    game.r.post.fadeColor = [0, 0, 0];
    await game.fadeTo(1, 0.7);
    const before = game.scene;
    try { const m = expMod ?? await import('./expedition'); await m.returnToCamp('blackout'); } catch (e) { console.error(e); }
    for (let i = 0; i < 25 && game.scene === before; i++) await new Promise(r => setTimeout(r, 100));
    if (game.scene === before) {
      restore(maxEnergy() * 0.3);
      if (p) p.poseOverride = null;
      if (sc) sc.cutscene = false;
      await game.fadeTo(0, 0.8);
      game.ui.toast('You blacked out from exhaustion and came to a while later, aching all over. <b>Eat something</b> or head back to camp.', 'BLACKOUT', 'coral', 5600);
    }
  } finally {
    fallbackBusy = false;
  }
}

// ---------------------------------------------------------------- ailments (bad forage)

/** start an ailment (forage10.ts rolls them); a second one of the same kind stacks onto the first */
export function addAilment(kind: AilmentKind, dur: number, k: number, src?: string) {
  const b = S();
  const cur = b.ail.find(a => a.kind === kind);
  if (cur) { cur.dur = Math.max(cur.dur - cur.t, dur) + cur.t; cur.k = kind === 'dizzy' ? Math.min(1, Math.max(cur.k, k) + 0.15) : cur.k + k; return; }
  b.ail.push({ kind, t: 0, dur, k, src, next: kind === 'stomach' ? 4 : 6 });
  game.persist();
}
export const ailments = (): readonly Ailment[] => S().ail;
export const hasAilment = (kind: AilmentKind) => S().ail.some(a => a.kind === kind);
/** how dizzy Mori is right now, 0..1 */
export function dizziness(): number {
  const a = S().ail.find(x => x.kind === 'dizzy');
  if (!a) return 0;
  return clamp(a.t / 2.5) * clamp((a.dur - a.t) / 6) * a.k;
}

// ---------------------------------------------------------------- the per-frame tick

/** what tickBody needs from a scene (FieldScene and its subclasses fit) */
export interface FieldLike {
  player: Player;
  st: Stage;
  cutscene: boolean;
  cam?: { active: boolean; raise?: (on: boolean) => void };
  hud?: { refresh(force?: boolean): void } | null;
  site?: SiteLike;
}

/** energy per second for each activity (before skills and the load) */
const COST = { idle: 0.035, walk: 0.19, work: 0.16, sprint: 0.6, hang: 0.25, climb: 0.8, swim: 1.0, jump: 0.5, uphill: 0.012 };
/** quick-eat hotkey */
export const EAT_KEY = 'KeyH';

let lastP: Player | null = null;
let lastX = 0, lastY = 0, wasGround = true;
let overWarned = false;
let breathT = 0, persistT = 30;
let heartOn = false, caOn = false;
let pending: { text: string; expr?: string; emote?: string; t: number } | null = null;
let activity = 'idle';
/** the activity tickBody saw last frame ('idle' | 'walk' | 'sprint' | 'climb' | 'swim' | 'work'...) */
export const currentActivity = () => activity;

/** low-energy level for warnings: 0 above 25% .. 1 at 0 */
export function lowness(): number {
  return clamp((0.25 - energyFrac()) / 0.25);
}

function bark(s: FieldLike, text: string, expr?: string, emote?: string) {
  if (game.ui.bubbles.active || game.ui.blocking || s.cutscene) { pending = { text, expr, emote, t: 8 }; return; }
  game.ui.bubbles.bark(s.player.id, text, { expr, emote } as never);
}

const LOW_LINES: [number, string, string, string?][] = [
  [0.5, 'Getting peckish. I should eat something soon.', 'thinking'],
  [0.25, 'I’m running on fumes. Eat something, or head back to camp.', 'tired', 'sweat'],
  [0.1, 'Legs... like jelly. If I don’t eat or turn back now, I’m going to drop.', 'tired', 'sweat'],
];
const STOMACH_MID = ['Urgh... my stomach is staging a protest.', 'Note to self: analyse it BEFORE eating it.', 'Gurgle. That was my stomach. It hates me.'];
const DIZZY_MID = ['Whoa... the trees are doing a little dance.', 'Is the ground... breathing? Grounds don’t breathe.', 'Okay. Walking in a straight line is harder than it looks.'];

/**
 * Once per frame from an expedition scene's update (after the camera): energy drain from what the
 * player is doing, the load on his speed, ailments, low-energy warnings, the quick-eat key.
 */
export function tickBody(dt: number, s: FieldLike) {
  const p = s.player;
  if (!p) return;
  const b = S();
  sync(b);
  if (p !== lastP) { lastP = p; lastX = p.x; lastY = p.y; wasGround = p.onGround; warned = 0; overWarned = false; }
  const exp = onExpedition();
  const enc = encumbrance();
  const fr = energyFrac();
  // ---- the load on his legs (and exhaustion)
  if (exp) {
    p.loadK = loadSpeedK(enc) * (fr < 0.1 ? 0.85 : 1) * (b.out ? 0.5 : 1) * (p.running ? fx10.sprintSpeed() : 1);
    p.noSprint = tooHeavyToRun(enc) || energy() < 3 || b.out;
  } else { p.loadK = 1; p.noSprint = false; }
  // ---- quick-eat
  if (!s.cutscene && !game.ui.blocking && game.input.keyHit(EAT_KEY)) void import('./forage10').then(m => m.quickEat());
  // ---- drain
  const live = exp && !s.cutscene && !game.ui.blocking && !game.ui.bubbles.active && dt > 0;
  const ddt = Math.max(dt, 1e-4);
  const vx = Math.abs(p.x - lastX) / ddt, vy = Math.abs(p.y - lastY) / ddt, up = Math.max(0, lastY - p.y);
  if (live) {
    let rate = COST.idle;
    activity = 'idle';
    const gf = gearMod?.gearFx;
    if (p.underwater || p.anim === 'swim') { rate = COST.swim * fx10.swimMult() * (gf?.swimEnergyMult() ?? 1) * (vx + vy > 50 ? 1.2 : 0.8); activity = 'swim'; }
    else if (p.state === 'climb') { rate = (vy > 4 ? COST.climb : COST.hang) * fx10.climbMult() * (gf?.climbEnergyMult() ?? 1); activity = 'climb'; }
    else if (p.state === 'work') { rate = COST.work; activity = 'work'; }
    else if (p.onGround && vx > 8 && vx < 600) {
      if (p.running && vx > 80 * p.speedK) { rate = COST.sprint * fx10.sprintMult(); activity = 'sprint'; }
      else { rate = COST.walk; activity = 'walk'; }
      if (p.ground === 'water' || p.wadeK < 0.95) { rate *= 1.7; activity += '+wade'; }
    }
    let cost = rate * dt;
    if (p.onGround && p.state === 'normal' && up > 0 && up < 30) cost += up * COST.uphill;
    if (wasGround && !p.onGround && p.vy < -80 && p.state === 'normal') cost += COST.jump;
    const walkish = activity === 'walk' || activity.startsWith('sprint') || activity.startsWith('walk');
    spend(cost * fx10.energyMult() * (walkish ? gf?.energyMult() ?? 1 : 1) * loadCostK(enc) * routeK(), activity);
  }
  lastX = p.x; lastY = p.y; wasGround = p.onGround;
  // ---- ailments (they run at camp too: a stomach ache doesn't care where you are)
  if (dt > 0 && !s.cutscene) updateAilments(dt, s);
  applyDizzy(s, exp);
  // ---- warnings
  if (exp && live) warnings(dt, s, enc);
  else stopWarnings();
  if (pending) {
    pending.t -= dt;
    if (pending.t <= 0) pending = null;
    else if (!game.ui.bubbles.active && !game.ui.blocking && !s.cutscene) { const q = pending; pending = null; bark(s, q.text, q.expr, q.emote); }
  }
  // ---- now and then the bucket rides along with a save
  if (exp && (persistT -= dt) <= 0) { persistT = 30; game.persist(); }
}

function updateAilments(dt: number, s: FieldLike) {
  const b = S();
  if (!b.ail.length) return;
  const p = s.player;
  for (const a of b.ail) {
    a.t += dt;
    if (a.kind === 'stomach') {
      spend((a.k / a.dur) * dt, 'stomach');
      if (a.t >= (a.next ?? 0)) {
        a.next = a.t + 6 + Math.random() * 7;
        audio.play('tummy', { vol: 0.55, pitch: 0.9 + Math.random() * 0.2 });
        p.body.react('shrink');
        p.body.setExpr('sad', 1.6);
        if (Math.random() < 0.45) bark(s, STOMACH_MID[Math.floor(Math.random() * STOMACH_MID.length)], 'sad', 'sweat');
      }
    } else {
      if (a.t >= (a.next ?? 0)) {
        a.next = a.t + 8 + Math.random() * 8;
        p.body.react('shake');
        if (Math.random() < 0.5) bark(s, DIZZY_MID[Math.floor(Math.random() * DIZZY_MID.length)], 'surprised', 'question');
      }
    }
  }
  const done = b.ail.filter(a => a.t >= a.dur);
  if (!done.length) return;
  b.ail = b.ail.filter(a => a.t < a.dur);
  for (const a of done) bark(s, a.kind === 'dizzy' ? 'Okay. Okay. The world’s holding still again.' : 'Phew. I think my stomach has forgiven me. Mostly.', 'neutral');
  game.persist();
}

/** dizziness: wobbly controls (Player.dizzy), a swaying view and a little colour fringing */
function applyDizzy(s: FieldLike, exp: boolean) {
  void exp;
  const k = dizziness();
  const p = s.player;
  p.dizzy = s.cutscene ? 0 : k;
  const post = game.r.post;
  const base = s.cam?.active ? 0.0022 : 0;
  if (k > 0.01) {
    const t = game.time;
    const c = s.st.cam;
    c.ox = (c.ox ?? 0) + (Math.sin(t * 1.1) * 5 + Math.sin(t * 2.3) * 2) * k;
    c.oy = (c.oy ?? 0) + (Math.sin(t * 0.8 + 1) * 3) * k;
    post.ca = base + k * (0.008 + Math.sin(t * 1.7) * 0.004);
    caOn = true;
  } else if (caOn) { post.ca = base; caOn = false; }
}

function warnings(dt: number, s: FieldLike, enc: number) {
  const fr = energyFrac();
  const p = s.player;
  // barks at 50 / 25 / 10 %; re-armed once he's eaten back above them
  for (let i = 0; i < LOW_LINES.length; i++) {
    const [at, line, expr, emote] = LOW_LINES[i];
    if (fr <= at && warned <= i) { warned = i + 1; bark(s, line, expr, emote); break; }
  }
  if (warned > 0 && fr > LOW_LINES[warned - 1][0] + 0.08) warned--;
  if (!overWarned && enc > 1.02) { overWarned = true; bark(s, 'Oof. This pack weighs a ton. I should drop something.', 'tired', 'sweat'); }
  if (overWarned && enc < 0.9) overWarned = false;
  // heavy breathing and a heartbeat when worn out; a tired face
  const low = lowness();
  if (low > 0) {
    breathT -= dt;
    if (breathT <= 0) {
      breathT = 3.4 - low * 1.6 + Math.random() * 0.6;
      audio.play('breath', { vol: 0.25 + low * 0.55, pitch: 0.95 + Math.random() * 0.1 });
    }
    const body = p.body;
    if (body.expr === body.baseExpr || body.expr === 'tired') body.setExpr('tired', 0.6);
  }
  const heart = fr < 0.12 ? 0.25 + (0.12 - fr) / 0.12 * 0.55 : 0;
  if (heart > 0) { audio.setHeartbeat(heart); heartOn = true; }
  else if (heartOn) { audio.setHeartbeat(0); heartOn = false; }
}

function stopWarnings() {
  if (heartOn) { audio.setHeartbeat(0); heartOn = false; }
}

/** a scene with tickBody is going away: undo what the body touched */
export function bodyExit(s?: FieldLike) {
  stopWarnings();
  if (caOn) { game.r.post.ca = 0; caOn = false; }
  if (s?.player) { s.player.dizzy = 0; s.player.loadK = 1; s.player.noSprint = false; }
  lastP = null;
  pending = null;
}
