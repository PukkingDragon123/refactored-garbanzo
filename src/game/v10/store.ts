// V10: per-subsystem persistent state. Each module owns one key of game.save.v10 and creates its
// bucket on first use, so old saves need no migration and modules never collide in save.ts.

import { game } from '../game';

export function bucket<T extends object>(key: string, init: () => T): T {
  const s = game.save as unknown as { v10?: Record<string, unknown> };
  if (!s.v10) s.v10 = {};
  if (!s.v10[key]) s.v10[key] = init();
  return s.v10[key] as T;
}
