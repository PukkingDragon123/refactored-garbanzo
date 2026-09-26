// Backpack inventory (stacked slots) and tool belt.

import { game } from './game';
import { ITEMS, isTool } from './items';
import { hasSkill } from './skills';

export interface Stack { id: string; n: number }

export function capacity() {
  return 12 + (hasSkill('pack1') ? 6 : 0) + (hasSkill('pack2') ? 6 : 0);
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
    if (!game.save.tools.includes(id)) game.save.tools.push(id);
    return 1;
  }
  let left = n;
  for (const s of game.save.inv) {
    if (s.id !== id || s.n >= d.stack) continue;
    const k = Math.min(left, d.stack - s.n);
    s.n += k;
    left -= k;
    if (!left) return n;
  }
  while (left > 0 && game.save.inv.length < capacity()) {
    const k = Math.min(left, d.stack);
    game.save.inv.push({ id, n: k });
    left -= k;
  }
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
  return true;
}

export function freeSlots() {
  return capacity() - game.save.inv.length;
}

/** Can n more of id fit? */
export function fits(id: string, n = 1) {
  const d = ITEMS[id];
  if (!d) return false;
  if (d.kind === 'tool') return true;
  let room = 0;
  for (const s of game.save.inv) if (s.id === id) room += d.stack - s.n;
  room += freeSlots() * d.stack;
  return room >= n;
}
