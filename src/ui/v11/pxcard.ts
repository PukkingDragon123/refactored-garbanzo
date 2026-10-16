// V11 pixel-art cards for the village: a woven flax banner with a tāniko border and lines in the Kiri
// bitmap font, painted into a small canvas shown at an integer scale (title cards for the festival,
// the festival's results). Dismissed with a key, a click, or after `ms`.

import { game } from '../../game/game';
import { el } from '../ui';
import { guardInput } from '../../core/input';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';
import { drawPx, pxWidth, pxWrap } from './pxfont';

export interface CardLine { text: string; col?: string; scale?: number; gap?: number }
export interface CardOpts { title: string; sub?: string; lines?: CardLine[]; ms?: number; width?: number; wait?: boolean; at?: 'center' | 'top' }

const INK = hex('#0c0810'), OCHRE = hex('#9a2a1a'), CREAM = hex('#f0e2c0'), GOLD = hex('#f8d060');
const FLAX = [hex('#2e2410'), hex('#4e3e1a'), hex('#725c26'), hex('#9a7e36')];

export function showCard(o: CardOpts): Promise<void> {
  const W = o.width ?? 200;
  const body: { s: string; c: C; sc: number; gap: number }[] = [];
  for (const l of o.lines ?? []) for (const s of pxWrap(l.text, W - 20, l.scale ?? 1)) body.push({ s, c: hex(l.col ?? '#f0e2c0'), sc: l.scale ?? 1, gap: l.gap ?? 0 });
  const H = 14 + 22 + (o.sub ? 12 : 0) + body.reduce((h, l) => h + 10 * l.sc + l.gap, 0) + 10;
  const b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = x < 5 || x >= W - 5, by = y < 5 || y >= H - 5;
    let c: C;
    if (bx || by) { const k = Math.floor((x + y) / 3) % 3; c = (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? INK : k === 0 ? INK : k === 1 ? OCHRE : CREAM; }
    else { const w = ((Math.floor(x / 3) + Math.floor(y / 3)) & 1) ? (x % 3 ? 2 : 1) : (y % 3 ? 1 : 0); c = FLAX[w]; }
    b.set(x, y, c);
  }
  let y = 12;
  drawPx(b, o.title, Math.round(W / 2 - pxWidth(o.title, 2) / 2), y, GOLD, { scale: 2, outline: INK });
  y += 22;
  if (o.sub) { drawPx(b, o.sub, Math.round(W / 2 - pxWidth(o.sub) / 2), y, CREAM, { outline: INK }); y += 12; }
  for (const l of body) { y += l.gap; drawPx(b, l.s, Math.round(W / 2 - pxWidth(l.s, l.sc) / 2), y, l.c, { scale: l.sc, outline: INK }); y += 10 * l.sc; }

  const cv = el('canvas') as HTMLCanvasElement;
  cv.width = W; cv.height = H;
  cv.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), W, H), 0, 0);
  const wrap = el('div', 'pxcard11');
  wrap.appendChild(cv);
  const fit = () => {
    const s = Math.max(1, Math.min(5, Math.floor(Math.min(window.innerWidth * 0.7 / W, window.innerHeight * 0.7 / H))));
    Object.assign(cv.style, { width: W * s + 'px', height: H * s + 'px', imageRendering: 'pixelated', display: 'block' });
    Object.assign(wrap.style, { position: 'absolute', zIndex: '36', left: Math.round((window.innerWidth - W * s) / 2) + 'px', top: Math.round(o.at === 'top' ? window.innerHeight * 0.08 : (window.innerHeight - H * s) / 2) + 'px', pointerEvents: o.wait ? 'auto' : 'none' });
  };
  fit();
  window.addEventListener('resize', fit);
  game.ui.modalLayer.appendChild(wrap);
  // a stepped wipe in (no blur, no fade: rows of the card appear in steps)
  cv.style.clipPath = 'inset(50% 0 50% 0)';
  let k = 0;
  const step = setInterval(() => { k = Math.min(4, k + 1); const p = (4 - k) * 12.5; cv.style.clipPath = `inset(${p}% 0 ${p}% 0)`; if (k >= 4) { clearInterval(step); cv.style.clipPath = ''; } }, 45);
  return new Promise(res => {
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
      wrap.remove();
      if (o.wait) guardInput(250);
      res();
    };
    const onKey = (e: KeyboardEvent) => { if (!o.wait) return; if (['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(); } };
    if (o.wait) { window.addEventListener('keydown', onKey, true); wrap.addEventListener('pointerdown', close); }
    setTimeout(close, o.ms ?? (o.wait ? 60000 : 3200));
  });
}
