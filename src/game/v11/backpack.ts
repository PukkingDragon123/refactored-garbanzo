// V11 Backpack: a tile grid laid over the inventory.
//
// game.save.inv stays the list of stacks (inventory.add / remove / count work exactly as before);
// each stack also remembers where it sits in the pack (Stack.p: compartment, cell, rotation), so the
// layout rides along in the save with no extra bookkeeping. New stacks drop onto the lowest free spot
// that takes their footprint (src/game/v11/footprints.ts, rotated if that is what fits); a stack that
// has no room is refused (inventory.add returns less, fits() says no). Stacks removed from the list
// simply vanish from the grid. Stacks that lost their spot (the pack changed, an old save, a module
// that pushed onto the list directly) are put back when the pack is next looked at (reconcile), and
// whatever still has no room spills out onto the ground (the Backpack screen shows it there).
//
// The pack grows with the upgrades at Jenna's bench (src/game/v10/campgear.ts 'pack': the flax straps
// let it take one more row, the kelp-leather side pockets add two 2x2 pouches, the driftwood frame
// makes the main compartment wider and deeper) and with the Packing skills (a pocket inside the lid).
// Tools never take grid room: they ride in their own loops, sheaths and pockets (TOOL_SLOTS).
//
// The same engine (Container) runs the camp stash chest (src/game/v11/stash.ts).

import { game } from '../game';
import { ITEMS } from '../items';
import type { ItemKind } from '../items';
import { setPackModel } from '../inventory';
import type { Stack, Place } from '../inventory';
import { hasSkill } from '../skills';
import { fx10 } from '../v10/skills10';
import { footprint, cells, cellCount } from './footprints';
import type * as GearMod from '../v10/campgear';

export type { Place };
export interface Area { id: string; cols: number; rows: number }

// campgear imports the inventory, so it comes in lazily (no import cycle at load time)
let gearMod: typeof GearMod | null = null;
void import('../v10/campgear').then(m => { gearMod = m; }).catch(() => {});

/** the pack's compartments right now */
export function packAreas(): Area[] {
  const lv = gearMod?.gearLevel('pack') ?? 0;
  const legacy = (hasSkill('pack1') ? 1 : 0) + (hasSkill('pack2') ? 1 : 0);
  const cols = lv >= 3 ? 7 : 6;
  const rows = Math.min(7, 4 + (lv >= 1 ? 1 : 0) + (lv >= 3 ? 1 : 0) + legacy);
  const out: Area[] = [{ id: 'main', cols, rows }];
  if (lv >= 2) out.push({ id: 'sideL', cols: 2, rows: 2 }, { id: 'sideR', cols: 2, rows: 2 });
  let lid = 0;
  try { lid = Math.min(cols, Math.round(fx10.packSlots())); } catch { lid = 0; }
  if (lid > 0) out.push({ id: 'lid', cols: lid, rows: 1 });
  return out;
}

// ---------------------------------------------------------------- the placement engine

const dims = (id: string, r: 0 | 1): [number, number] => { const f = footprint(id); return r ? [f.h, f.w] : [f.w, f.h]; };
/** the cells a stack of `id` fills at (x, y) with rotation r */
export function stackCells(id: string, r: 0 | 1, x = 0, y = 0): [number, number][] {
  return cells(footprint(id), !!r).map(([cx, cy]) => [cx + x, cy + y] as [number, number]);
}
export const stackDims = dims;

/** which stack (index + 1) fills each cell of each area; 0 = free */
export type Occ = Map<string, Int32Array>;

const SORT: ItemKind[] = ['food', 'lure', 'tool', 'material', 'plant', 'fungus', 'insect', 'animal', 'shell', 'key'];

export class Container {
  constructor(readonly areas: () => Area[], readonly list: () => Stack[]) {}

  area(id: string): Area | undefined { return this.areas().find(a => a.id === id); }
  totalCells(): number { return this.areas().reduce((a, r) => a + r.cols * r.rows, 0); }

  /** occupancy of the placed stacks (skipping `skip`); stacks whose place is gone, out of bounds or
   *  overlapping an earlier one come back in `bad` */
  occ(skip?: Stack | Stack[]): { occ: Occ; bad: Stack[] } {
    const areas = this.areas(), occ: Occ = new Map(), bad: Stack[] = [];
    for (const a of areas) occ.set(a.id, new Int32Array(a.cols * a.rows));
    const skipSet = new Set(Array.isArray(skip) ? skip : skip ? [skip] : []);
    const list = this.list();
    list.forEach((s, i) => {
      if (skipSet.has(s)) return;
      const p = s.p;
      if (!p) { bad.push(s); return; }
      const a = areas.find(q => q.id === p.a), g = occ.get(p.a);
      if (!a || !g || !ITEMS[s.id]) { bad.push(s); return; }
      const cs = stackCells(s.id, p.r, p.x, p.y);
      if (cs.some(([x, y]) => x < 0 || y < 0 || x >= a.cols || y >= a.rows || g[y * a.cols + x] !== 0)) { bad.push(s); return; }
      for (const [x, y] of cs) g[y * a.cols + x] = i + 1;
    });
    return { occ, bad };
  }

  /** would a stack of `id` fit at this place (given an occupancy)? */
  fitsAt(occ: Occ, id: string, p: Place): boolean {
    const a = this.area(p.a), g = occ.get(p.a);
    if (!a || !g) return false;
    for (const [x, y] of stackCells(id, p.r, p.x, p.y)) if (x < 0 || y < 0 || x >= a.cols || y >= a.rows || g[y * a.cols + x] !== 0) return false;
    return true;
  }

  /** the stack indexes (+1) in the way of a place */
  blockers(occ: Occ, id: string, p: Place): number[] {
    const a = this.area(p.a), g = occ.get(p.a);
    if (!a || !g) return [];
    const out = new Set<number>();
    for (const [x, y] of stackCells(id, p.r, p.x, p.y)) if (x >= 0 && y >= 0 && x < a.cols && y < a.rows && g[y * a.cols + x]) out.add(g[y * a.cols + x]);
    return [...out];
  }

  mark(occ: Occ, id: string, p: Place, v: number) {
    const a = this.area(p.a), g = occ.get(p.a);
    if (!a || !g) return;
    for (const [x, y] of stackCells(id, p.r, p.x, p.y)) g[y * a.cols + x] = v;
  }

  /** the lowest free spot for `id` (things settle to the bottom of a bag), main compartment first,
   *  unrotated first; `prefer` puts some areas first */
  findSpot(occ: Occ, id: string, prefer: string[] = []): Place | null {
    const areas = this.areas().slice().sort((a, b) => rank(a.id, prefer) - rank(b.id, prefer));
    const fp = footprint(id);
    const rots: (0 | 1)[] = fp.w === fp.h && !fp.mask ? [0] : [0, 1];
    for (const a of areas) {
      for (const r of rots) {
        const [w, h] = dims(id, r);
        if (w > a.cols || h > a.rows) continue;
        for (let y = a.rows - h; y >= 0; y--) for (let x = 0; x <= a.cols - w; x++) {
          const p: Place = { a: a.id, x, y, r };
          if (this.fitsAt(occ, id, p)) return p;
        }
      }
    }
    return null;
  }

  /** give a new stack a place; false = no room (the stack is left unplaced) */
  place(s: Stack, prefer?: string[]): boolean {
    const { occ } = this.occ(s);
    const p = this.findSpot(occ, s.id, prefer);
    if (!p) return false;
    s.p = p;
    return true;
  }

  /** is there room for k more stacks of id? */
  room(id: string, k: number): boolean {
    if (k <= 0) return true;
    const { occ } = this.occ();
    for (let i = 0; i < k; i++) {
      const p = this.findSpot(occ, id);
      if (!p) return false;
      this.mark(occ, id, p, -1);
    }
    return true;
  }

  free(): number {
    const { occ } = this.occ();
    let n = 0;
    for (const g of occ.values()) for (const v of g) if (!v) n++;
    return n;
  }

  /** 0..1 of the grid's cells in use */
  fill(): number { const t = this.totalCells(); return t ? 1 - this.free() / t : 1; }

  /** put every stack that lost its place somewhere; returns what still has no room (left unplaced) */
  reconcile(): Stack[] {
    const { occ, bad } = this.occ();
    const out: Stack[] = [];
    for (const s of bad) {
      if (!ITEMS[s.id]) { s.p = undefined; out.push(s); continue; }
      // keep the old spot's area preference when the place just went bad
      const p = this.findSpot(occ, s.id, s.p ? [s.p.a] : []);
      if (!p) { s.p = undefined; out.push(s); continue; }
      s.p = p;
      this.mark(occ, s.id, p, this.list().indexOf(s) + 1);
    }
    return out;
  }

  /** Repack: top up part stacks of the same thing, then fit everything biggest-first from the bottom
   *  up. Returns what didn't fit (left unplaced, which only happens when the pack was over-full). */
  arrange(): Stack[] {
    const list = this.list();
    // merge part stacks (keep the first stack object of each id, so the screen can animate it)
    const byId = new Map<string, Stack[]>();
    for (const s of list) { const a = byId.get(s.id) ?? []; a.push(s); byId.set(s.id, a); }
    const keep: Stack[] = [];
    for (const [id, ss] of byId) {
      const max = Math.max(1, ITEMS[id]?.stack ?? 1);
      let total = ss.reduce((a, s) => a + s.n, 0);
      for (const s of ss) {
        if (total <= 0) break;
        s.n = Math.min(max, total);
        total -= s.n;
        keep.push(s);
      }
      while (total > 0) { const k = Math.min(max, total); keep.push({ id, n: k }); total -= k; }
    }
    list.length = 0;
    list.push(...keep);
    // biggest first, then by kind and name
    const order = keep.slice().sort((a, b) => cellCount(b.id) - cellCount(a.id) || bigSide(b.id) - bigSide(a.id)
      || SORT.indexOf(ITEMS[a.id]?.kind ?? 'material') - SORT.indexOf(ITEMS[b.id]?.kind ?? 'material') || (ITEMS[a.id]?.name ?? a.id).localeCompare(ITEMS[b.id]?.name ?? b.id));
    for (const s of order) s.p = undefined;
    const { occ } = this.occ(order);
    const out: Stack[] = [];
    for (const s of order) {
      const p = this.findSpot(occ, s.id);
      if (!p) { out.push(s); continue; }
      s.p = p;
      this.mark(occ, s.id, p, list.indexOf(s) + 1);
    }
    return out;
  }
}
const rank = (id: string, prefer: string[]) => { const i = prefer.indexOf(id); if (i >= 0) return i - 100; return id === 'main' ? 0 : id === 'lid' ? 3 : 1; };
const bigSide = (id: string) => { const f = footprint(id); return Math.max(f.w, f.h); };

/** Mori's pack */
export const PACK = new Container(packAreas, () => game.save.inv);

// the inventory asks the grid whether new stacks fit (see src/game/inventory.ts)
setPackModel({
  place: s => PACK.place(s),
  room: (id, k) => PACK.room(id, k),
  cells: () => PACK.totalCells(),
  free: () => PACK.free(),
});

// gifts with no room land on the ground (src/game/v11/ground.ts listens to inventory.give)
void import('./ground').catch(() => {});

/** 0..1 of the pack's grid in use (for the HUD) */
export const packFill = () => PACK.fill();

// ---------------------------------------------------------------- tool loops

/** where each tool rides on the pack (the Backpack screen paints a holder for each) */
export type ToolSlot = 'camera' | 'binoculars' | 'jar' | 'net' | 'knife' | 'sling' | 'trowel' | 'hammer' | 'phone' | 'lamp' | 'cape' | 'pouch';
export const TOOL_SLOTS: Record<string, ToolSlot> = {
  camera: 'camera', binoculars: 'binoculars', jar: 'jar', net: 'net', knife: 'knife', slingshot: 'sling', trowel: 'trowel',
  hammer: 'hammer', translator: 'phone', headlamp: 'lamp', ghillie: 'cape', tweezers: 'pouch', gloves: 'pouch',
};
/** tools without a holder of their own hang from the spare loops */
export function toolSlotOf(id: string): ToolSlot | null { return TOOL_SLOTS[id] ?? null; }
