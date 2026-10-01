// Pixel-art icons for every item, skill and UI glyph.
//
// Icons are 24x24 (ICON_PX) pixel paintings: hue-shifted 6-tone ramps lit from the top-left, specular
// glints, and a hue-tinted selective outline (see src/art/icons/pen.ts). The tiny UI glyphs that are
// shown at text size (rp, lock, check, star, star0, question, battery, bolt) are 16x16.
// The art lives in src/art/icons/*; this module is the registry, cache and public API.

import { PixelBuffer } from './pixel';
import { IconDef, IconSet, renderIcon } from './icons/pen';
import { TOOLS } from './icons/tools';
import { MATERIALS } from './icons/materials';
import { NATURE } from './icons/nature';
import { KIT } from './icons/kit';
import { ISLAND } from './icons/island';
import { SKILLS, UI } from './icons/glyphs';

/** Canvas size of item and skill icons (the PixelBuffers itemIcon / skillIcon return). */
export const ICON_PX = 24;

const ICON: IconSet = { ...TOOLS, ...MATERIALS, ...NATURE, ...KIT, ...ISLAND };
const SKILL: IconSet = { ...SKILLS };
// icons shared with items
for (const k of ['ghillie', 'caller', 'trap', 'net']) SKILL[k] = ICON[k];
SKILL['glow'] = ICON['glowlure'];

// ---------------------------------------------------------------- rendering + caches
const bufCache = new Map<string, PixelBuffer>();
const urlCache = new Map<string, string>();
function cached(key: string, d: IconDef | undefined) {
  let b = bufCache.get(key);
  if (!b) { b = renderIcon(d ?? UI.question); bufCache.set(key, b); }
  return b;
}
/** Data URL of an icon. `scale` keeps its old meaning (a multiple of the old 16px icon, so scale 3 is
 *  ~48px): the art is enlarged by the nearest whole multiple of its own size (24px art: scale 1-2 ->
 *  24px, 3 -> 48px, 4-5 -> 72px). Every caller sizes its <img> in CSS with image-rendering: pixelated. */
function url(key: string, d: IconDef | undefined, scale: number) {
  const k = key + '@' + scale;
  let u = urlCache.get(k);
  if (!u) {
    const b = cached(key, d);
    const mult = Math.max(1, Math.round((scale * 16) / b.w));
    try { u = b.toDataURL(mult); } catch { u = ''; }
    urlCache.set(k, u);
  }
  return u;
}

/** 24x24 pixel icon for an item id (a '?' glyph for unknown ids). */
export function itemIcon(id: string): PixelBuffer {
  return cached('i:' + id, ICON[id]);
}
/** Cached data URL of an item icon (default scale 3 = 48px). */
export function itemIconURL(id: string, scale = 3): string {
  return url('i:' + id, ICON[id], scale);
}
/** Cached data URL of a skill icon, named in SKILLS[].icon. */
export function skillIconURL(icon: string, scale = 3): string {
  return url('s:' + icon, SKILL[icon] ?? ICON[icon], scale);
}
/** UI glyphs: rp, lock, check, star, star0, photos, tree, book, notes, readme, bin, clue, question, battery, bolt. */
export function uiIconURL(name: string, scale = 3): string {
  return url('u:' + name, UI[name] ?? SKILL[name] ?? ICON[name], scale);
}
export function uiIcon(name: string): PixelBuffer {
  return cached('u:' + name, UI[name] ?? SKILL[name] ?? ICON[name]);
}
export function skillIcon(icon: string): PixelBuffer {
  return cached('s:' + icon, SKILL[icon] ?? ICON[icon]);
}
/** Ids with a hand-made icon (for galleries / tests). */
export const ICON_IDS = { items: () => Object.keys(ICON), skills: () => Object.keys(SKILL), ui: () => Object.keys(UI) };
