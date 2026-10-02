// V11 contract: illustrated item artwork. Each item gets a painted picture sized to its Backpack
// footprint (ITEM_CELL px per grid cell at 1x). The item-art module registers the painters; the
// Backpack, cooking, crafting and blueprint papers draw with itemArtURL / itemArtCanvas and fall back
// to the old 16 px icons when an item has no artwork yet.
import { registerFootprint } from '../../game/v11/footprints';
import type { Footprint } from '../../game/v11/footprints';

export const ITEM_CELL = 24;
type Painter = () => HTMLCanvasElement;
const painters: Record<string, Painter> = {};
const cache = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

export function registerItemArt(id: string, paint: Painter, fp?: Footprint): void {
  painters[id] = paint;
  if (fp) registerFootprint(id, fp);
}
export function hasItemArt(id: string): boolean { return !!painters[id]; }
/** the painted artwork at 1x (cached), or null */
export function itemArtCanvas(id: string): HTMLCanvasElement | null {
  const p = painters[id];
  if (!p) return null;
  let c = cache.get(id);
  if (!c) { c = p(); cache.set(id, c); }
  return c;
}
/** a data URL of the artwork scaled by whole pixels (nearest), or null */
export function itemArtURL(id: string, scale = 2): string | null {
  const key = id + '@' + scale;
  const hit = urls.get(key);
  if (hit) return hit;
  const c = itemArtCanvas(id);
  if (!c) return null;
  const o = document.createElement('canvas');
  o.width = c.width * scale; o.height = c.height * scale;
  const g = o.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, o.width, o.height);
  const u = o.toDataURL();
  urls.set(key, u);
  return u;
}
