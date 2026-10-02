// V11 contract: carrying real objects. Characters visibly hold the actual thing (a plank on the
// shoulder, a pot in both hands, Chunk in the arms, water in cupped hands dripping between the
// fingers) instead of a generic pose. The hands/carry module owns the drawing and the poses; story
// code only says what someone is carrying.
//
// How it works: setCarry(actor, kind) remaps the actor's everyday clips (idle, walk, run, talk...) to
// the carry clips for that kind ('carryWalk~plank', src/art/v7/anims-hands.ts), and the body renderer
// draws the object in the hands (src/art/v7/held.ts), so it follows the hands every frame and bobs
// with the walk. Heavy loads walk the player slower (carrySpeedK). Water in cupped hands drips: drops
// fall from between the fingers, splash on the ground and leave wet spots, and the water level drops
// (the clip variant follows it: 'cupWalk~4' → 'cupWalk~1'), until the hands are empty. Chunk is his
// own actor: with `rider`, he is drawn between the carrier's body and near arm, in the carrier's arms.
import type { Actor } from '../../world/actor';
import { actorExt } from '../../world/actor';
import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { A } from '../assets';

export type CarryKind =
  | 'water' | 'plank' | 'planks' | 'log' | 'firewood' | 'stone' | 'pot' | 'pan' | 'bucket' | 'chunk'
  | 'crate' | 'fish' | 'bundle' | 'flax' | 'rope' | 'lantern' | 'camera' | 'shell' | 'fruit' | 'outboard'
  | (string & {});

export interface CarryOpts {
  /** water left in cupped hands, a bucket or a pot (0..1, default full) */
  level?: number;
  /** how many: planks (1..3), sticks of firewood (1..6) */
  count?: number;
  /** the carried actor (Chunk): drawn in the carrier's arms and kept there every frame */
  rider?: Actor | null;
  /** how fast water runs out (1 = about 25 s walking, a minute standing still) */
  leak?: number;
  /** play the heft as the weight comes on (default true for heavy loads) */
  heft?: boolean;
}

interface Drop { x: number; y: number; vx: number; vy: number; floor: number; t: number; kind: 0 | 1 | 2 }
interface Held {
  kind: CarryKind;
  level: number;
  count: number;
  leak: number;
  rider: Actor | null;
  /** the rider's seat relative to the carrier (facing right), kept for frames without one */
  seat: [number, number];
  drops: Drop[];
  dripT: number;
  lastX: number;
  /** the weight coming on (s): the knees give, then the carry clips */
  heft: number;
}

const held = new WeakMap<Actor, Held>();
type CarryFn = (a: Actor, what: CarryKind | null) => void;
const fns: CarryFn[] = [];

/** how heavy each load is (0..1): heavier walks shorter and slower, leans back */
const WEIGHT: Record<string, number> = {
  water: 0.05, plank: 0.3, planks: 0.55, log: 0.7, firewood: 0.38, wood: 0.38, sticks: 0.38, stone: 0.78, rock: 0.78, pot: 0.36, pan: 0.1,
  bucket: 0.46, chunk: 0.42, crate: 0.62, fish: 0.08, bundle: 0.3, flax: 0.12, rope: 0.22, lantern: 0.05, camera: 0.04, shell: 0, fruit: 0,
  outboard: 0.95, shoulders: 0.9, driftwood: 0.7,
};
const ALIAS: Record<string, string> = { wood: 'firewood', sticks: 'firewood', rock: 'stone', driftwood: 'log', boards: 'planks', board: 'plank', pug: 'chunk', motor: 'outboard', person: 'shoulders' };
const kindOf = (k: string) => ALIAS[k] ?? k;
/** clips that stand still (they hold the load) and clips that walk (carry it along) */
const STILL = new Set(['idle', 'talk', 'brace', 'crouch', 'jump', 'fall', 'land', 'carryIdle', 'cupIdle', 'carryPupIdle', 'think', 'nod', 'walkStop', 'runStop']);
const MOVING = new Set(['walk', 'run', 'crouchWalk', 'slip', 'limp', 'sneak', 'carry', 'carryWalk', 'cupWalk', 'carryHeavy', 'carryPup', 'carryPupRun']);
const base = (anim: string) => { const i = anim.indexOf('~'); return i < 0 ? anim : anim.slice(0, i); };

let installed = false;
/** the Actor hooks go in with the first carry (after every module has loaded) */
function install() {
  if (installed) return;
  installed = true;
  actorExt.mapAnim = mapAnim;
  actorExt.update = update;
  actorExt.drawHeld = drawHeld;
  actorExt.drawOver = drawOver;
}

/** start / stop carrying something (null = empty hands) */
export function setCarry(a: Actor, what: CarryKind | null, o: CarryOpts = {}): void {
  install();
  const prev = held.get(a);
  if (prev?.rider && prev.rider.carrier === a) prev.rider.carrier = null;
  if (what) {
    const kind = kindOf(what);
    const h: Held = {
      kind, level: Math.max(0, Math.min(1, o.level ?? 1)), count: o.count ?? (kind === 'planks' ? 3 : kind === 'firewood' ? 4 : 1),
      leak: o.leak ?? 1, rider: o.rider ?? null, seat: [5, -22], drops: prev?.drops ?? [], dripT: 0, lastX: a.x,
      heft: o.heft !== false && !a.walking && (WEIGHT[kind] ?? 0.3) > 0.35 && kind !== 'chunk' && kind !== 'shoulders' ? 0.42 : 0,
    };
    if (h.rider) h.rider.carrier = a;
    held.set(a, h);
  } else if (prev) {
    // let the last drops land
    if (prev.drops.length) orphans.push({ a, drops: prev.drops });
    held.delete(a);
  }
  // re-pick the clip now (an NPC standing still won't ask again)
  const cur = base(a.anim);
  const req = cur === 'carryIdle' || cur === 'cupIdle' || cur === 'carryPupIdle' || cur === 'carryHeft' ? 'idle' : MOVING.has(cur) ? (a.walking ? a.walkAnim : 'walk') : cur;
  if (STILL.has(req) || MOVING.has(req)) a.setAnim(req);
  for (const f of fns) f(a, what);
}
export function carryOf(a: Actor): CarryKind | null { return held.get(a)?.kind ?? null; }
export function onCarry(fn: CarryFn): void { fns.push(fn); }
/** water (or stew) left: 0..1 */
export function carryLevel(a: Actor): number { return held.get(a)?.level ?? 0; }
export function setCarryLevel(a: Actor, v: number) { const h = held.get(a); if (h) h.level = Math.max(0, Math.min(1, v)); }
/** walking speed multiplier for whatever the actor carries (the player's controller reads it) */
export function carrySpeedK(a: Actor): number {
  const h = held.get(a);
  if (!h) return 1;
  const w = WEIGHT[h.kind] ?? 0.3;
  return h.kind === 'water' ? 0.8 : 1 - 0.42 * w;
}

/** the clip variant for what's held: 'plank.2', 'firewood.5', 'pot.1' */
function variant(h: Held): string {
  switch (h.kind) {
    case 'plank': case 'planks': return `${h.kind}.${h.count}`;
    case 'firewood': return `firewood.${Math.max(1, Math.min(6, h.count))}`;
    case 'pot': case 'bucket': return `${h.kind}.${h.level > 0.05 ? 1 : 0}`;
    default: return h.kind;
  }
}
const waterLv = (h: Held) => Math.max(1, Math.min(4, Math.ceil(h.level * 4 - 0.001)));

const mapAnim = (a: Actor, anim: string): string => {
  const h = held.get(a);
  if (!h) return anim;
  const b = base(anim);
  const still = STILL.has(b), moving = MOVING.has(b);
  if (!still && !moving) return anim;
  if (h.heft > 0 && still) return `carryHeft~${h.kind}`;
  if (h.kind === 'chunk') return moving ? (b === 'run' || b === 'carryPupRun' ? 'carryPupRun' : 'carryPup') : 'carryPupIdle';
  if (h.kind === 'water') return `${moving ? 'cupWalk' : 'cupIdle'}~${waterLv(h)}`;
  return `${moving ? 'carryWalk' : 'carryIdle'}~${variant(h)}`;
};

// ------------------------------------------------------------------ upkeep: water, riders

const orphans: { a: Actor; drops: Drop[] }[] = [];
const DRIP_PTS = ['drip0', 'drip1', 'drip2', 'drip3'];

const update = (a: Actor, dt: number): void => {
  for (let i = orphans.length - 1; i >= 0; i--) if (orphans[i].a === a) { stepDrops(orphans[i].drops, dt); if (!orphans[i].drops.length) orphans.splice(i, 1); }
  const h = held.get(a);
  if (!h) return;
  const moved = Math.abs(a.x - h.lastX);
  h.lastX = a.x;
  if (h.heft > 0) {
    h.heft -= dt;
    if (h.heft <= 0 || moved > 0.3) { h.heft = 0; if (base(a.anim) === 'carryHeft') a.setAnim(a.walking ? a.walkAnim : 'idle'); }
  }
  if (h.kind === 'water') {
    const walking = moved > 0.05 * 60 * dt;
    // water seeps out between the fingers: faster on the move, a trickle standing still
    if (h.level > 0) h.level = Math.max(0, h.level - dt * h.leak * (walking ? 0.04 : 0.016));
    const want = a.mapped(a.walking || walking ? 'walk' : 'idle');
    if (base(a.anim) === base(want) && a.anim !== want) a.setAnim(walking ? 'walk' : 'idle');
    // drips: a steady patter while there's water, faster walking
    h.dripT -= dt * (h.level > 0 ? (walking ? 5.5 : 2.2) * (0.35 + h.level) : 0);
    if (h.dripT <= 0 && h.level > 0) {
      h.dripT += 0.25 + Math.random() * 0.5;
      const p = a.point(DRIP_PTS[Math.floor(Math.random() * DRIP_PTS.length)]) ?? a.point('drip0');
      if (p) h.drops.push({ x: p[0] + (Math.random() - 0.5), y: p[1], vx: (Math.random() - 0.5) * 6 + (walking ? a.facing * 4 : 0), vy: 4 + Math.random() * 8, floor: a.y + 1 + Math.random() * 1.5, t: 0, kind: 0 });
    }
    if (h.level <= 0 && !h.drops.length) { setCarry(a, null); return; }
  } else if (h.kind === 'bucket' && h.level > 0 && moved > 0.5 && Math.random() < dt * 1.2) {
    const p = a.point('drip0');
    if (p) h.drops.push({ x: p[0], y: p[1], vx: a.facing * 6, vy: 2, floor: a.y + 1.5, t: 0, kind: 0 });
  }
  stepDrops(h.drops, dt);
  // the rider sits in the arms: where this frame's seat is (or the last one known)
  const r = h.rider;
  if (r && r.carrier === a) {
    const seat = a.point('pup') ?? a.handPos();
    if (seat) h.seat = [(seat[0] - a.x) * a.facing, seat[1] - a.y];
    r.terrain = null;
    r.facing = a.facing;
    r.x = a.x + a.facing * (h.seat[0] - 1);
    r.y = a.y + h.seat[1] + 8;
    if (r.anim !== 'carried') r.setAnim('carried');
  }
};

function stepDrops(ds: Drop[], dt: number) {
  for (let i = ds.length - 1; i >= 0; i--) {
    const d = ds[i];
    d.t += dt;
    if (d.kind === 0) {
      d.vy += 300 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y >= d.floor) {
        // splash: two little droplets kick up, a ring, a wet spot
        d.kind = 1; d.t = 0; d.y = d.floor;
        ds.push({ x: d.x, y: d.floor - 0.5, vx: -14 - Math.random() * 8, vy: -26 - Math.random() * 10, floor: d.floor, t: 0, kind: 2 });
        ds.push({ x: d.x, y: d.floor - 0.5, vx: 14 + Math.random() * 8, vy: -22 - Math.random() * 10, floor: d.floor, t: 0, kind: 2 });
      }
    } else if (d.kind === 2) {
      d.vy += 300 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y >= d.floor || d.t > 0.4) { ds[i] = ds[ds.length - 1]; ds.pop(); }
    } else if (d.t > 1.8) { ds[i] = ds[ds.length - 1]; ds.pop(); }
  }
}

// ------------------------------------------------------------------ drawing

const WATER = packColor(0.62, 0.86, 1, 0.92), WATER_HI = packColor(0.92, 0.98, 1, 1), WET = packColor(0.05, 0.08, 0.12, 0.3);

/** Chunk (or whoever rides) between the carrier's head and the near arm, so the arm wraps round him */
const drawHeld = (a: Actor, r: Renderer): void => {
  const h = held.get(a);
  if (h?.rider && h.rider.carrier === a) h.rider.drawRider(r);
};

const drawOver = (a: Actor, r: Renderer): void => {
  const h = held.get(a);
  const ds = h?.drops ?? orphans.find(o => o.a === a)?.drops;
  if (ds?.length) drawDrops(r, ds);
  if (h?.kind === 'lantern') {
    const g = a.point('glow');
    if (g) {
      const fl = 0.9 + 0.1 * Math.sin(performance.now() * 0.013) * Math.sin(performance.now() * 0.0047);
      r.light(g[0], g[1], 64, 1, 0.78, 0.45, 0.85 * fl, 0.2);
      r.fxDraw(A.glow, g[0], g[1], 0.09, 0.09, 0, packColor(1, 0.75, 0.4, 1), 0.7 * fl);
    }
  }
};

function drawDrops(r: Renderer, ds: Drop[]) {
  for (const d of ds) {
    const x = Math.round(d.x), y = Math.round(d.y);
    if (d.kind === 0) {
      // a falling drop: a bright head with a short streak above it
      r.emissive(0.35);
      r.rect(x, y, 1, 1, WATER_HI);
      if (d.vy > 30) r.rect(x, y - 1, 1, 1, WATER);
      r.emissive();
    } else if (d.kind === 2) {
      r.rect(x, y, 1, 1, WATER);
    } else {
      // the ring spreading on the ground, then a dark wet spot fading
      const u = d.t;
      if (u < 0.22) { const w = 1 + Math.round(u * 14); r.rect(x - w, y, w * 2 + 1, 1, packColor(0.7, 0.9, 1, 0.75 * (1 - u / 0.22))); }
      r.rect(x - 1, y, 3, 1, packColor(0.05, 0.08, 0.12, 0.3 * Math.min(1, (1.8 - u) / 0.8)));
    }
  }
  void WET;
}
