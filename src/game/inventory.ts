// Backpack inventory (stacked items) and tool belt.
//
// V11: the stacks are laid out on the Backpack's tile grid (src/game/v11/backpack.ts registers the
// grid as the pack model): each stack remembers its place (Stack.p), a new stack needs a free spot
// for its footprint, and the API here (count / has / add / remove / fits) works exactly as before.
// Until the grid module is in, the old rule applies (a fixed number of pockets).

import { game } from './game';
import { ITEMS, isTool } from './items';
import { hasSkill } from './skills';
import { fx10 } from './v10/skills10';

/** V11: where a stack sits in the Backpack grid: compartment, top-left cell, rotated 90 degrees */
export interface Place { a: string; x: number; y: number; r: 0 | 1 }
export interface Stack { id: string; n: number; p?: Place }

/** V11: the Backpack grid (src/game/v11/backpack.ts) */
export interface PackModel {
  /** give a new stack a place in the pack; false = no room for it */
  place(s: Stack): boolean;
  /** is there room for k more stacks of id? */
  room(id: string, k: number): boolean;
  /** grid cells in all / free */
  cells(): number;
  free(): number;
}
let model: PackModel | null = null;
export function setPackModel(m: PackModel | null) { model = m; }

export function capacity() {
  if (model) return model.cells();
  // (V10 Field Skills add pockets too; the backpack has room for 24)
  return Math.min(24, 12 + (hasSkill('pack1') ? 6 : 0) + (hasSkill('pack2') ? 6 : 0) + fx10.packSlots());
}

export function stacks(): Stack[] {
  return game.save.inv;
}

export function count(id: string) {
  if (isTool(id)) return game.save.tools.includes(id) ? 1 : 0;
  return game.save.inv.filter(s => s.id === id).reduce((a, s) => a + s.n, 0);
}

export function has(id: string, n = 1) {
  return count(id) >= n;
}

export function hasTool(id: string) {
  return game.save.tools.includes(id);
}

/** Add items; returns how many fit. */
export function add(id: string, n = 1): number {
  const d = ITEMS[id];
  if (!d) return 0;
  if (d.kind === 'tool') {
    if (!game.save.tools.includes(id)) { game.save.tools.push(id); changed(); }
    return 1;
  }
  let left = n;
  for (const s of game.save.inv) {
    if (s.id !== id || s.n >= d.stack) continue;
    const k = Math.min(left, d.stack - s.n);
    s.n += k;
    left -= k;
    if (!left) { changed(); return n; }
  }
  while (left > 0) {
    const s: Stack = { id, n: Math.min(left, d.stack) };
    if (model) { if (!model.place(s)) break; }
    else if (game.save.inv.length >= capacity()) break;
    game.save.inv.push(s);
    left -= s.n;
  }
  if (left < n) changed();
  return n - left;
}

export function remove(id: string, n = 1): boolean {
  if (count(id) < n) return false;
  let left = n;
  const inv = game.save.inv;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    if (inv[i].id !== id) continue;
    const k = Math.min(left, inv[i].n);
    inv[i].n -= k;
    left -= k;
    if (inv[i].n <= 0) inv.splice(i, 1);
  }
  changed();
  return true;
}

/** free room: grid cells with the V11 pack, pockets before it */
export function freeSlots() {
  if (model) return model.free();
  return capacity() - game.save.inv.length;
}

/** Can n more of id fit? */
export function fits(id: string, n = 1) {
  const d = ITEMS[id];
  if (!d) return false;
  if (d.kind === 'tool') return true;
  let room = 0;
  for (const s of game.save.inv) if (s.id === id) room += Math.max(0, d.stack - s.n);
  if (room >= n) return true;
  const need = Math.ceil((n - room) / Math.max(1, d.stack));
  if (model) return model.room(id, need);
  return freeSlots() >= need;
}

// ---------------------------------------------------------------- V11: gifts and spills

type OverflowFn = (id: string, n: number) => void;
const overflowFns: OverflowFn[] = [];
/** whatever give() could not fit (the Backpack drops it on the ground beside Mori); returns an unsubscribe */
export function onOverflow(fn: OverflowFn): () => void {
  overflowFns.push(fn);
  return () => { const i = overflowFns.indexOf(fn); if (i >= 0) overflowFns.splice(i, 1); };
}
/** Add a gift, a reward, a haul: what doesn't fit in the pack falls on the ground beside Mori
 *  (instead of vanishing). Returns how many went into the pack. */
export function give(id: string, n = 1): number {
  const got = add(id, n);
  if (got < n && ITEMS[id]) for (const f of overflowFns.slice()) { try { f(id, n - got); } catch (e) { console.error(e); } }
  return got;
}

type ChangeFn = () => void;
const changeFns: ChangeFn[] = [];
/** the pack's contents changed through add / remove (the Backpack screen redraws); returns an unsubscribe */
export function onInvChange(fn: ChangeFn): () => void {
  changeFns.push(fn);
  return () => { const i = changeFns.indexOf(fn); if (i >= 0) changeFns.splice(i, 1); };
}
function changed() { for (const f of changeFns.slice()) { try { f(); } catch (e) { console.error(e); } } }

// the grid model registers itself (lazily: it imports this module)
void import('./v11/backpack').catch(e => console.warn('[inventory] backpack grid', e));
