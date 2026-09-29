// Shared helpers for the V4 minigames: a blocking overlay on the modal layer, pixel canvases with
// crisp integer scaling, hold/press input that works for keyboard, mouse and touch, and a
// requestAnimationFrame loop that stops when the overlay closes.

import { game } from '../../game/game';
import { el } from '../ui';
import { guardInput } from '../../core/input';
import { audio } from '../../core/audio';

const CSS = `
.mg-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 30; background: rgba(8,6,10,0.42);
  animation: mgIn 0.18s ease-out both; font-family: 'Pixelify Sans', 'Silkscreen', monospace; color: #3a2614; -webkit-font-smoothing: none; }
@keyframes mgIn { from { opacity: 0; } }
.mg-wrap.out { animation: mgOut 0.16s ease-in both; }
@keyframes mgOut { to { opacity: 0; } }
.mg { position: relative; border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round;
  image-rendering: pixelated; filter: drop-shadow(0 6px 0 rgba(0,0,0,0.35)); padding: 0.4em 0.7em 0.6em; max-width: 96vw; max-height: 94vh; box-sizing: border-box;
  animation: mgPop 0.28s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes mgPop { from { transform: scale(0.85) translateY(10px); } }
.mg h3 { margin: 0 0 0.3em; text-align: center; font-family: 'Silkscreen', monospace; font-size: clamp(14px, 2vw, 20px); color: #fff; letter-spacing: 0.06em; text-transform: uppercase;
  text-shadow: 0 2px 0 #1f3a1c, 2px 0 0 #1f3a1c, -2px 0 0 #1f3a1c, 0 -2px 0 #1f3a1c; }
.mg .cv { display: block; margin: 0 auto; image-rendering: pixelated; image-rendering: crisp-edges; background: #1a1418; box-shadow: 0 0 0 3px #3a2614, inset 0 0 0 2px #000; }
.mg .hint { position: static; max-width: none; padding: 0; line-height: 1.4; text-align: center; font-size: clamp(12px, 1.6vw, 16px); margin-top: 0.45em; color: #5a4024; }
.mg .hint .key { margin: 0 0.25em !important; }
.mg .row { display: flex; gap: 0.6em; justify-content: center; margin-top: 0.5em; flex-wrap: wrap; }
.mg .say { display: flex; gap: 0.5em; align-items: center; margin: 0 0 0.5em; min-height: 3.2em; }
.mg .say canvas { width: 56px; height: 60px; image-rendering: pixelated; background: #f4e0b0; box-shadow: 0 0 0 2px #3a2614; flex: none; }
.mg .say .t { font-size: clamp(13px, 1.7vw, 17px); line-height: 1.3; }
.mg .say .t b { color: #b04a8a; }
.mg .res { text-align: center; font-family: 'Silkscreen', monospace; font-size: clamp(16px, 2.4vw, 24px); color: #2f6b2a; min-height: 1.3em; margin-top: 0.3em; }
.mg .res.bad { color: #a8382a; }
.mg .steps { display: flex; justify-content: center; gap: 6px; margin-bottom: 0.4em; }
.mg .steps i { width: 26px; height: 8px; background: #c8b48a; box-shadow: 0 0 0 2px #3a2614; }
.mg .steps i.on { background: #e8b840; }
.mg .steps i.done { background: #5aa447; }
`;
let styled = false;

export interface Mini {
  wrap: HTMLElement;
  box: HTMLElement;
  close(): void;
  closed: boolean;
}

export function openMini(cls: string, html: string): Mini {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const wrap = el('div', 'mg-wrap');
  const box = el('div', 'mg ' + cls, html);
  wrap.appendChild(box);
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  audio.play('uiOpen', { vol: 0.5 });
  const m: Mini = {
    wrap, box, closed: false,
    close() {
      if (m.closed) return;
      m.closed = true;
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 170);
      guardInput(300);
    },
  };
  return m;
}

/** A pixel canvas with integer CSS scaling that fits the viewport. */
export function pixelCanvas(parent: HTMLElement, w: number, h: number, maxScale = 5): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; fit(): void } {
  const cv = el('canvas', 'cv');
  cv.width = w;
  cv.height = h;
  parent.appendChild(cv);
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const fit = () => {
    const s = Math.max(1, Math.min(maxScale, Math.floor(Math.min((window.innerWidth * 0.86) / w, (window.innerHeight * 0.62) / h))));
    cv.style.width = w * s + 'px';
    cv.style.height = h * s + 'px';
  };
  fit();
  return { cv, g, fit };
}

/** Hold-to-act input: Space / E / mouse / touch. `down` is live, `hit` is true once per press. */
export class Hold {
  down = false;
  private hitQ = false;
  private kd = (e: KeyboardEvent) => { if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); if (!this.down) this.hitQ = true; this.down = true; } };
  private ku = (e: KeyboardEvent) => { if (['Space', 'KeyE', 'Enter'].includes(e.code)) { this.down = false; } };
  private pd = (e: PointerEvent) => { if ((e.target as HTMLElement).closest?.('button')) return; if (!this.down) this.hitQ = true; this.down = true; };
  private pu = () => { this.down = false; };
  constructor(readonly target: HTMLElement) {
    window.addEventListener('keydown', this.kd, true);
    window.addEventListener('keyup', this.ku, true);
    target.addEventListener('pointerdown', this.pd);
    window.addEventListener('pointerup', this.pu);
    window.addEventListener('pointercancel', this.pu);
  }
  hit() { const h = this.hitQ; this.hitQ = false; return h; }
  dispose() {
    window.removeEventListener('keydown', this.kd, true);
    window.removeEventListener('keyup', this.ku, true);
    this.target.removeEventListener('pointerdown', this.pd);
    window.removeEventListener('pointerup', this.pu);
    window.removeEventListener('pointercancel', this.pu);
  }
}

/** rAF loop with dt (seconds); return false from the callback to stop. */
export function loop(fn: (dt: number, t: number) => boolean | void): () => void {
  let last = performance.now(), t = 0, alive = true;
  const step = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (fn(dt, t) === false) { alive = false; return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => { alive = false; };
}

export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** draw a portrait (PixelBuffer from the people art) into a small canvas */
export function portraitCanvas(buf: { w: number; h: number; bytes: Uint8Array }): HTMLCanvasElement {
  const c = el('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const img = new ImageData(new Uint8ClampedArray(buf.bytes.buffer, buf.bytes.byteOffset, buf.bytes.byteLength).slice(), buf.w, buf.h);
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** simple pixel painter helpers on a 2D context */
export const px = {
  rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
  dot(g: CanvasRenderingContext2D, x: number, y: number, c: string) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
  ell(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number) => string | null)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const v = typeof c === 'string' ? c : c(nx, ny);
        if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); }
      }
  },
  text(g: CanvasRenderingContext2D, s: string, x: number, y: number, c: string, size = 8, align: CanvasTextAlign = 'left') {
    g.fillStyle = c;
    g.font = `${size}px 'Pixelify Sans', monospace`;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillText(s, Math.round(x), Math.round(y));
  },
};
