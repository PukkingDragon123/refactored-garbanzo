// V11: things on the ground. What doesn't fit in the Backpack (a gift with no room for it, the pack
// spilling over after it was rearranged) and what Mori drops comes out as a little heap at his feet in
// the world. Walk up and pick it up (E), or open the pack: a heap close by lies on the ground next to
// the open bag on the Backpack screen, ready to be dragged in. Heaps stay where they are until Mori
// leaves the place (then they are left behind).

import { game } from '../game';
import { ITEMS } from '../items';
import type { Stack } from '../inventory';
import { add, onOverflow } from '../inventory';
import { local } from '../assets';
import { itemIcon } from '../../art/itemicons';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import type { Frame } from '../../gfx/renderer';
import type { Atlas } from '../../gfx/atlas';
import type { Interactable } from '../../world/npc';
import { audio } from '../../core/audio';

export interface Pile {
  x: number;
  y: number;
  stacks: Stack[];
  /** the scene it lies in */
  scene: unknown;
  /** seconds since it landed (the tumble) */
  t: number;
  /** where it fell from (pack height) */
  y0: number;
}

interface SceneLike {
  player?: { x: number; y: number; body?: { react(k: string): void } };
  main?: { add(d: unknown): void };
  interact?: Interactable[];
  st?: { terrain?: { groundY?(x: number): number } };
  cutscene?: boolean;
}

const piles: Pile[] = [];
const hooked = new WeakSet<object>();

/** heaps lying in the current scene */
export function groundPiles(): Pile[] {
  const sc = game.scene;
  for (let i = piles.length - 1; i >= 0; i--) if (piles[i].scene !== sc || !piles[i].stacks.length) piles.splice(i, 1);
  return piles.slice();
}

/** the heap nearest Mori (within r px), if any */
export function pileNear(r = 70): Pile | null {
  const p = (game.scene as unknown as SceneLike | null)?.player;
  if (!p) return null;
  let best: Pile | null = null, bd = r;
  for (const q of groundPiles()) { const d = Math.abs(q.x - p.x); if (d <= bd) { bd = d; best = q; } }
  return best;
}

/** put stacks on the ground by Mori (merging into a heap that's already there); null without a world */
export function dropOnGround(stacks: Stack[], o: { x?: number; quiet?: boolean } = {}): Pile | null {
  const sc = game.scene as unknown as SceneLike | null;
  const p = sc?.player;
  const list = stacks.filter(s => s.n > 0 && ITEMS[s.id]).map(s => ({ id: s.id, n: s.n }));
  if (!sc || !p || !list.length) return null;
  hook(sc);
  const near = pileNear(26);
  let pile = near;
  if (pile) { for (const s of list) merge(pile.stacks, s); pile.t = 0; pile.y0 = pile.y - 22; }
  else {
    const x = o.x ?? p.x + 10 * ((piles.length % 2) ? -1 : 1);
    pile = { x, y: p.y, stacks: [], scene: sc, t: 0, y0: p.y - 22 };
    for (const s of list) merge(pile.stacks, s);
    piles.push(pile);
  }
  if (!o.quiet) audio.play('rustle', { vol: 0.35, pitch: 1.3 });
  return pile;
}

function merge(into: Stack[], s: Stack) {
  const max = Math.max(1, ITEMS[s.id]?.stack ?? 1);
  let left = s.n;
  for (const t of into) {
    if (t.id !== s.id || t.n >= max) continue;
    const k = Math.min(left, max - t.n);
    t.n += k; left -= k;
    if (!left) return;
  }
  while (left > 0) { const k = Math.min(max, left); into.push({ id: s.id, n: k }); left -= k; }
}

/** a stack taken off a heap (the Backpack screen dragged it in) */
export function takeFromPile(pile: Pile, s: Stack) {
  const i = pile.stacks.indexOf(s);
  if (i >= 0) pile.stacks.splice(i, 1);
}

/** pick a heap up: everything that fits goes in the pack; returns what is still lying there */
export function pickUp(pile: Pile): Stack[] {
  for (const s of pile.stacks.slice()) {
    const got = add(s.id, s.n);
    s.n -= got;
    if (s.n <= 0) takeFromPile(pile, s);
  }
  game.persist();
  return pile.stacks;
}

// ---------------------------------------------------------------- in the world

const frameCache = new WeakMap<Atlas, Map<string, Frame>>();
function frameOf(id: string): Frame | null {
  const at = local as Atlas | undefined;
  if (!at) return null;
  let m = frameCache.get(at);
  if (!m) { m = new Map(); frameCache.set(at, m); }
  let f = m.get(id);
  if (!f) { try { const b = itemIcon(id); f = at.add('v11:gnd:' + id, b, b.w / 2, b.h - 3); m.set(id, f); } catch { return null; } }
  return f;
}

/** the scene draws its heaps and offers to pick each one up */
function hook(sc: SceneLike) {
  if (hooked.has(sc as object)) return;
  hooked.add(sc as object);
  sc.main?.add(new Custom(46, rr => {
    for (const q of piles) {
      if (q.scene !== sc || !q.stacks.length) continue;
      // the heap tumbles out of the pack, lands and bounces once
      const t = q.t, fall = 0.3;
      const yy = t < fall ? q.y0 + (q.y - q.y0) * (t / fall) * (t / fall)
        : q.y - Math.abs(Math.sin(((t - fall) / 0.22) * Math.PI)) * 3 * Math.max(0, 1 - (t - fall) / 0.44);
      const bounce = t < fall ? 1 - t / fall : 0;
      rr.beginShadows();
      rr.rect(q.x - 12, q.y - 1, 24, 2, packColor(0, 0, 0, 0.28));
      rr.endShadows();
      const n = Math.min(4, q.stacks.length);
      for (let i = 0; i < n; i++) {
        const f = frameOf(q.stacks[i].id);
        if (!f) continue;
        const ox = (i - (n - 1) / 2) * 8 + (i % 2 ? 1 : -1), oy = i % 2 ? -3 : 0;
        rr.draw(f, q.x + ox, yy + oy, 0.72, 0.72, (i % 2 ? 0.35 : -0.25) * (1 - bounce));
      }
    }
  }, dt => { for (const q of piles) if (q.scene === sc) q.t += dt; }));
  // one interactable per scene that follows the nearest heap
  const self: Interactable = {
    get x() { return pileNear(400)?.x ?? -99999; },
    get y() { return pileNear(400)?.y ?? -99999; },
    w: 10, h: 10,
    get label() {
      const q = pileNear(400);
      if (!q) return '';
      const s = q.stacks[0];
      return q.stacks.length === 1 && s ? `Pick up ${ITEMS[s.id]?.name ?? s.id}${s.n > 1 ? ' ×' + s.n : ''}` : `Pick up ${q.stacks.length} things`;
    },
    enabled: () => !!pileNear(400) && !sc.cutscene,
    action: async () => {
      const q = pileNear(400);
      if (!q) return;
      const left = pickUp(q);
      audio.play('collectPop' as never, { vol: 0.5 });
      sc.player?.body?.react('bounce');
      (game.scene as unknown as { hud?: { refresh(f?: boolean): void } | null })?.hud?.refresh(true);
      // whatever didn't fit: open the pack with the heap beside it, to make room
      if (left.length) {
        const { openBackpack11 } = await import('../../ui/v11/backpack');
        await openBackpack11({ mode: 'pack' });
      }
    },
  };
  sc.interact?.push(self);
}

// gifts that don't fit (inventory.give) land on the ground by Mori
onOverflow((id, n) => {
  const pile = dropOnGround([{ id, n }]);
  if (pile) game.ui.toast(`No room in the pack: <b>${ITEMS[id]?.name ?? id}</b>${n > 1 ? ' ×' + n : ''} is on the ground.`, 'PACK', 'coral', 3400);
});
