// V11 contract: how much room an item takes in the Backpack's tile grid. Item artwork registers its
// real shape (src/art/v11/itemart.ts registerItemArt(id, painter, footprint)); anything without art
// falls back to a default by kind. Masks are rows of '#' (filled) and '.' (empty).
import { ITEMS } from '../items';

export interface Footprint { w: number; h: number; mask?: string[] }
const REG: Record<string, Footprint> = {};
export function registerFootprint(id: string, fp: Footprint): void { REG[id] = fp; }

export function footprint(id: string): Footprint {
  const r = REG[id];
  if (r) return r;
  const d = ITEMS[id];
  switch (d?.kind) {
    case 'tool': return { w: 1, h: 2 };
    case 'material': return /plank|log|branch|pole|stick|drift/i.test(id + (d?.name ?? '')) ? { w: 1, h: 3 } : { w: 1, h: 1 };
    default: return { w: 1, h: 1 };
  }
}
/** cells a footprint fills (honouring the mask), for grid fitting */
export function cells(fp: Footprint, rot = false): [number, number][] {
  const out: [number, number][] = [];
  const w = rot ? fp.h : fp.w, h = rot ? fp.w : fp.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = rot ? y : x, sy = rot ? w - 1 - x : y;
    if (!fp.mask || fp.mask[sy]?.[sx] === '#') out.push([x, y]);
  }
  return out;
}
