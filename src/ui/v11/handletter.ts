// V11 hand-lettering: item names written on the specimen tags in Mori's marker, as pixel art. The
// text is drawn from the paper kit's bitmap handwriting (src/ui/v11/paper/pxfont.ts): every pixel is
// placed, nothing is rasterised from a smooth font, a little ink bleed gives it weight, and a slight
// upward slant is done by stepping whole columns. It needs no font loading, so ensureHandFont()
// resolves straight away (the API is kept for its callers).

import { Art, col } from './paper/px';
import { drawText, textWidth, installPixelFonts } from './paper/pxfont';

/** (the hand is drawn in code: always ready) resolves true */
export function ensureHandFont(): Promise<boolean> {
  void installPixelFonts();
  return Promise.resolve(true);
}
/** call fn once the face is in (it always is) */
export function onHandFont(fn: () => void) { try { fn(); } catch (e) { console.error(e); } }
export const handReady = () => true;

const cache = new Map<string, HTMLCanvasElement>();

export interface HandOpts {
  /** cap height-ish size in art pixels (11 and up writes at double size) */
  px?: number;
  color?: string;
  /** a darker edge for weight */
  bleed?: string;
  /** wrap / shrink to this width (art px) */
  maxW?: number;
  /** slight upward slant, radians */
  tilt?: number;
}

/** the text hand-lettered as pixel art (1 canvas pixel per art pixel) */
export function handLetter(text: string, o: HandOpts = {}): HTMLCanvasElement {
  const px = o.px ?? 15, color = o.color ?? '#2a2414', bleed = o.bleed ?? '#5a4a2a', maxW = o.maxW ?? 200, tilt = o.tilt ?? -0.03;
  const key = [text, px, color, bleed, maxW, tilt].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  let k = px >= 11 ? 2 : 1;
  const bold = px >= 14;
  // wrap into at most two lines (balanced), dropping to the small size if it still doesn't fit
  const lay = (scale: number) => {
    const words = text.split(/\s+/);
    let lines = [text];
    if (textWidth(text, { scale, bold }) > maxW && words.length > 1) {
      let best = 1, bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const w = Math.max(textWidth(words.slice(0, i).join(' '), { scale, bold }), textWidth(words.slice(i).join(' '), { scale, bold }));
        if (w < bestW) { bestW = w; best = i; }
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    return lines;
  };
  let lines = lay(k);
  if (k > 1 && Math.max(...lines.map(l => textWidth(l, { scale: k, bold }))) > maxW) { k = 1; lines = lay(1); }
  const widest = Math.max(...lines.map(l => textWidth(l, { scale: k, bold })));
  const lh = 11 * k;
  const slant = Math.abs(tilt) * widest;
  const W = Math.ceil(widest) + 4, H = Math.ceil(lh * lines.length + slant) + 4;
  const a = new Art(W, H);
  const ink = col(color), bl = col(bleed);
  lines.forEach((l, i) => drawText(a, l, 1, Math.round(1 + slant + 8 * k + lh * i), ink, { scale: k, bold }));
  // the slant: shift whole columns up by tilt (pixel steps, nothing resampled)
  const out = new Art(W, H);
  for (let x = 0; x < W; x++) {
    const dy = Math.round(x * tilt);
    for (let y = 0; y < H; y++) { const c = a.get(x, y); if (c >>> 24) out.put(x, y + dy, c); }
  }
  // bleed: a darker pixel to the right and below the strokes, where there is none
  const src = out.d.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x] >>> 24) continue;
    const l = x > 0 && (src[y * W + x - 1] >>> 24) > 0, u = y > 0 && (src[(y - 1) * W + x] >>> 24) > 0;
    if (l && u) out.put(x, y, bl);
  }
  const c = out.canvas();
  cache.set(key, c);
  return c;
}
