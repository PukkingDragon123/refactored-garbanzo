// V12: small floating words in the bitmap fonts, each letter its own little canvas so it can move on
// its own: letters pop in one after another, a hovered word waves, a refused one shakes, and words
// lift away letter by letter when they go. Used for the labels on Mori when he is inspected and for
// everything written in the Backpack scene (item names, notes, the action words).
//
// Every offset is a whole pixel of the element's own space: put a word inside a stage scaled by
// whole device pixels (the Backpack) or inside wordLayer(k) (scaled by k), and it stays crisp.

import { pxTextCanvas, pxMeasure } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { css } from '../laptop-kit';

export type WordAnim = 'pop' | 'wave' | 'shake' | 'still';
export interface WordOpts {
  font?: PxFontId;
  color?: string;
  outline?: string | null;
  shadow?: string | null;
  /** how it moves once in (default pop: in, then still) */
  anim?: WordAnim;
  /** ms before the first letter */
  delay?: number;
  /** ms between letters popping in (default 26) */
  step?: number;
}
export type Word = HTMLElement & { wW: number; wH: number };

css('pw12', `
.pw12 { position: absolute; left: 0; top: 0; white-space: nowrap; pointer-events: none; }
.pw12 > canvas { position: absolute; top: 0; image-rendering: pixelated; display: block;
  animation: pw12In 0.3s steps(3) both; animation-delay: calc(var(--i) * var(--st) + var(--d)); }
.pw12.wave > canvas { animation: pw12In 0.3s steps(3) both, pw12Wave 0.84s steps(1) infinite;
  animation-delay: calc(var(--i) * var(--st) + var(--d)), calc(var(--i) * 70ms + var(--d) + 300ms); }
.pw12.shake > canvas { animation: pw12In 0.3s steps(3) both, pw12Shake 0.16s steps(1) infinite;
  animation-delay: calc(var(--i) * var(--st) + var(--d)), calc(var(--i) * 30ms); }
.pw12.still > canvas { animation: none; }
.pw12.out > canvas { animation: pw12Out 0.24s steps(3) both; animation-delay: calc(var(--i) * 16ms); }
@keyframes pw12In { 0% { transform: translateY(3px); opacity: 0; } 34% { transform: translateY(-2px); opacity: 1; } 67% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes pw12Wave { 0% { transform: translateY(0); } 18% { transform: translateY(-1px); } 36% { transform: translateY(0); } }
@keyframes pw12Shake { 0% { transform: translate(0, 0); } 25% { transform: translate(1px, 0); } 50% { transform: translate(0, -1px); } 75% { transform: translate(-1px, 0); } }
@keyframes pw12Out { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-4px); opacity: 0; } }
.pw12L { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; }
`);

const gapOf = new Map<string, number>();
function gap(font: PxFontId): number {
  let g = gapOf.get(font);
  if (g === undefined) { g = pxMeasure('AA', font) - 2 * pxMeasure('A', font); gapOf.set(font, g); }
  return g;
}

/** a floating word (or short line); its size in art px is on .wW / .wH */
export function pxWord(text: string, o: WordOpts = {}): Word {
  const font = o.font ?? 'bold';
  const e = document.createElement('div') as unknown as Word;
  e.className = 'pw12' + (o.anim && o.anim !== 'pop' ? ' ' + o.anim : '');
  e.style.setProperty('--st', (o.step ?? 26) + 'ms');
  e.style.setProperty('--d', (o.delay ?? 0) + 'ms');
  const ring = o.outline === null ? 0 : 1;
  const chars = [...text];
  let h = 0, i = 0, w = 0;
  const g = gap(font);
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    const x = k === 0 ? 0 : pxMeasure(chars.slice(0, k).join(''), font) + g;
    if (ch.trim()) {
      const c = pxTextCanvas(ch, { font, color: o.color ?? '#fff6dc', outline: o.outline === undefined ? '#1a0e06' : o.outline, shadow: o.shadow ?? null });
      c.style.left = x - ring + 'px';
      c.style.setProperty('--i', String(i++));
      e.appendChild(c);
      h = Math.max(h, c.height);
      w = Math.max(w, x - ring + c.width);
    }
  }
  e.wW = w; e.wH = h;
  e.style.width = w + 'px'; e.style.height = h + 'px';
  return e;
}

/** switch how a word moves (wave on hover, shake when refused) */
export function wordAnim(e: HTMLElement, a: WordAnim) {
  e.classList.remove('wave', 'shake', 'still');
  if (a !== 'pop') e.classList.add(a);
}

/** lift the word away letter by letter, then remove it */
export function wordOut(e: HTMLElement): Promise<void> {
  if (!e.isConnected) return Promise.resolve();
  e.classList.remove('wave', 'shake', 'still');
  e.classList.add('out');
  const n = e.childElementCount;
  return new Promise(r => setTimeout(() => { e.remove(); r(); }, 240 + n * 16));
}

/** a layer for words outside a pixel stage, scaled by k (whole device pixels per art pixel) */
export function wordLayer(k: number): HTMLElement {
  const l = document.createElement('div');
  l.className = 'pw12L';
  l.style.transform = `scale(${k})`;
  return l;
}

/** CSS px per art px for floating words over the world: whole device pixels, about 1/240 of the view height */
export function wordScale(): number {
  const dpr = window.devicePixelRatio || 1;
  const want = Math.max(1.5, Math.min(4, window.innerHeight / 230));
  return Math.max(1, Math.round(want * dpr)) / dpr;
}
