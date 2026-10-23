// V11 hand-lettering: item names written on the specimen tags in Mori's marker, as pixel art. The
// letters come from the bitmap marker script in ../pxfont (slanted print-script, heavy downstrokes, a
// little bounce on the baseline), drawn 1 canvas pixel per art pixel so they scale by whole pixels with
// the art around them. No web font is involved, so it is the same online and off.

import { pxTextCanvas, pxMeasure } from '../pxfont';
import type { PxFontId } from '../pxfont';

/** (kept for callers: the hand is a bitmap font, always ready) */
export function ensureHandFont(): Promise<boolean> { return Promise.resolve(true); }
/** call fn once the face is in (immediately: nothing to load) */
export function onHandFont(fn: () => void) { void fn; }
export const handReady = () => true;

const cache = new Map<string, HTMLCanvasElement>();

export interface HandOpts {
  /** roughly how big (art px): 10 and up is the marker script, smaller is the bold print hand */
  px?: number;
  color?: string;
  /** the heavy side of the strokes (dark ink), or, for light ink, the dark edge round it */
  bleed?: string;
  /** wrap / fit to this width (art px) */
  maxW?: number;
  /** (ignored: the script has its own slant) */
  tilt?: number;
}

const lum = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };

/** the text hand-lettered as pixel art (1 canvas pixel per art pixel) */
export function handLetter(text: string, o: HandOpts = {}): HTMLCanvasElement {
  const px = o.px ?? 15, color = o.color ?? '#2a2414', maxW = o.maxW ?? 200;
  const bleed = o.bleed ?? (lum(color) > 140 ? '#3a2a14' : '#4a3a20');
  const key = [text, px, color, bleed, maxW].join('|');
  const hit = cache.get(key);
  if (hit) return copy(hit);
  // light ink (on a dark scene): an outline in the dark colour; dark ink (on paper): heavy strokes
  const light = lum(color) > 140 && lum(bleed) < lum(color);
  let font: PxFontId = px >= 10 ? 'script' : 'bold';
  // too long for two lines of script: the print hand
  if (font === 'script') {
    const words = text.split(/\s+/);
    const longest = Math.max(...words.map(w => pxMeasure(w, 'script')));
    if (longest > maxW - 4 || pxMeasure(text, 'script') > (maxW - 4) * 2) font = 'bold';
  }
  const c = pxTextCanvas(text, {
    font, color, maxW, maxLines: 2, align: 'center',
    bleed: light ? undefined : bleed,
    outline: light ? bleed : null,
    shadow: light ? bleed : null,
    lineH: font === 'script' ? 11 : 9,
  });
  c.style.width = ''; c.style.height = '';
  cache.set(key, c);
  return copy(c);
}

/** a fresh canvas with the same pixels (one sprite may be shown in several places) */
function copy(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.className = src.className;
  c.style.imageRendering = 'pixelated';
  c.getContext('2d')?.drawImage(src, 0, 0);
  return c;
}
