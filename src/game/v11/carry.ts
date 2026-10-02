// V11 contract: carrying real objects. Characters visibly hold the actual thing (a plank on the
// shoulder, a pot in both hands, Chunk in the arms, water in cupped hands dripping between the
// fingers) instead of a generic pose. The hands/carry module owns the drawing and the poses; story
// code only says what someone is carrying.
import type { Actor } from '../../world/actor';

export type CarryKind =
  | 'water' | 'plank' | 'planks' | 'log' | 'firewood' | 'stone' | 'pot' | 'pan' | 'bucket' | 'chunk'
  | 'crate' | 'fish' | 'bundle' | 'flax' | 'rope' | 'lantern' | 'camera' | 'shell' | 'fruit' | 'outboard'
  | (string & {});

const held = new WeakMap<Actor, CarryKind>();
type CarryFn = (a: Actor, what: CarryKind | null) => void;
const fns: CarryFn[] = [];

/** start / stop carrying something (null = empty hands) */
export function setCarry(a: Actor, what: CarryKind | null): void {
  if (what) held.set(a, what); else held.delete(a);
  for (const f of fns) f(a, what);
}
export function carryOf(a: Actor): CarryKind | null { return held.get(a) ?? null; }
export function onCarry(fn: CarryFn): void { fns.push(fn); }
