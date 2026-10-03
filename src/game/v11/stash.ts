// V11 camp stash: the old sea chest by the supply crates at camp. Whatever Mori doesn't want to haul
// round the island waits in here (its own tile grid, the same engine as the Backpack). At camp the
// Backpack screen opens with the chest beside it (the trail sign's "prepare for the day" and the
// chest itself); cooking at camp can use what is in it too.

import { game } from '../game';
import { ITEMS } from '../items';
import type { Stack } from '../inventory';
import { bucket } from '../v10/store';
import { Container } from './backpack';
import type { Area } from './backpack';

interface StashState { inv: Stack[] }
const S = () => bucket<StashState>('stash11', () => ({ inv: [] }));

export const STASH_AREAS: Area[] = [{ id: 'chest', cols: 8, rows: 5 }];
export const STASH = new Container(() => STASH_AREAS, () => S().inv);

export const stashStacks = (): Stack[] => S().inv;
export function stashCount(id: string): number { return S().inv.filter(s => s.id === id).reduce((a, s) => a + s.n, 0); }

/** put n of id in the chest (topping up stacks first); returns how many fit */
export function stashAdd(id: string, n = 1): number {
  const d = ITEMS[id];
  if (!d || d.kind === 'tool') return 0;
  const inv = S().inv;
  let left = n;
  for (const s of inv) {
    if (s.id !== id || s.n >= d.stack) continue;
    const k = Math.min(left, d.stack - s.n);
    s.n += k; left -= k;
    if (!left) break;
  }
  while (left > 0) {
    const s: Stack = { id, n: Math.min(left, d.stack) };
    if (!STASH.place(s)) break;
    inv.push(s);
    left -= s.n;
  }
  if (left < n) game.persist();
  return n - left;
}

/** take n of id out of the chest; false if there isn't that many */
export function stashRemove(id: string, n = 1): boolean {
  if (stashCount(id) < n) return false;
  const inv = S().inv;
  let left = n;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    if (inv[i].id !== id) continue;
    const k = Math.min(left, inv[i].n);
    inv[i].n -= k; left -= k;
    if (inv[i].n <= 0) inv.splice(i, 1);
  }
  game.persist();
  return true;
}
