// V6 close-up minigames: the camera cuts in to a full-screen, native-resolution pixel-art shot of the
// action (hands, cup, kettle, engine...), with no panel, title or buttons. A faint hint line fades
// in and out at the bottom, and the result lands as a big anime-style word with a burst. Scenes draw
// into a 32-bit pixel buffer with a few blending helpers, so the art stays crisp at any size.

import { game } from '../../game/game';
import { el } from '../ui';
import { guardInput } from '../../core/input';

export const CW = 320, CH = 180;

const CSS = `
.cu-wrap { position: absolute; inset: 0; z-index: 34; background: #07060a; overflow: hidden; display: flex; align-items: center; justify-content: center;
  animation: cuIn 0.45s ease-out both; }
@keyframes cuIn { from { opacity: 0; } }
.cu-wrap.out { animation: cuOut 0.4s ease-in both; }
@keyframes cuOut { to { opacity: 0; } }
.cu-wrap canvas { image-rendering: pixelated; image-rendering: crisp-edges; animation: cuZoom 0.9s cubic-bezier(.2,.8,.3,1) both; }
@keyframes cuZoom { from { transform: scale(1.35); filter: blur(6px) brightness(0.4); } to { transform: scale(1); filter: none; } }
.cu-hint { position: absolute; left: 0; right: 0; bottom: 6%; text-align: center; font-family: 'Pixelify Sans', monospace; font-size: clamp(14px, 2.2vw, 22px);
  color: rgba(255, 246, 228, 0.92); text-shadow: 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.6); letter-spacing: 0.04em; opacity: 0; transition: opacity 0.6s; pointer-events: none; }
.cu-hint.on { opacity: 1; }
.cu-hint .key { margin: 0 0.25em !important; }
.cu-res { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) rotate(-5deg); font-family: 'Silkscreen', monospace; font-weight: 700;
  font-size: clamp(34px, 8vw, 96px); letter-spacing: 0.06em; color: #fff7d8; pointer-events: none; white-space: nowrap;
  text-shadow: 5px 5px 0 #c8341e, -2px -2px 0 #3a1408, 2px -2px 0 #3a1408, -2px 2px 0 #3a1408, 0 0 30px rgba(255,200,90,0.6); animation: cuRes 1.9s steps(12) both; }
.cu-res.bad { color: #e8f2ff; text-shadow: 5px 5px 0 #2a4a8a, -2px -2px 0 #0a1428, 2px -2px 0 #0a1428, -2px 2px 0 #0a1428; }
.cu-res small { display: block; font-size: 0.32em; letter-spacing: 0.1em; text-align: center; margin-top: 0.2em; color: #ffe6b0; text-shadow: 2px 2px 0 #3a1408; }
@keyframes cuRes { 0% { opacity: 0; transform: translate(-50%, -50%) rotate(-5deg) scale(2.2); } 12% { opacity: 1; transform: translate(-50%, -50%) rotate(-5deg) scale(1); }
  85% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-5deg) scale(1.08); } }
.cu-burst { position: absolute; left: 50%; top: 42%; width: 140vmax; height: 140vmax; margin: -70vmax 0 0 -70vmax; pointer-events: none;
  background: repeating-conic-gradient(rgba(255,240,200,0.16) 0 4deg, transparent 4deg 12deg); animation: cuBurst 1.9s ease-out both; }
.cu-burst.bad { background: repeating-conic-gradient(rgba(200,220,255,0.1) 0 4deg, transparent 4deg 12deg); }
@keyframes cuBurst { from { opacity: 0; transform: scale(0.4) rotate(0deg); } 15% { opacity: 1; } to { opacity: 0; transform: scale(1.1) rotate(25deg); } }
.cu-flash { position: absolute; inset: 0; background: #fff; pointer-events: none; animation: cuFlash 0.35s ease-out both; }
@keyframes cuFlash { from { opacity: 0.8; } to { opacity: 0; } }
`;
let styled = false;

export interface Closeup {
  wrap: HTMLElement;
  cv: HTMLCanvasElement;
  /** the frame buffer (ABGR little-endian, like ImageData) */
  buf: Uint32Array;
  closed: boolean;
  present(): void;
  hint(html: string, ms?: number): void;
  result(word: string, sub?: string, bad?: boolean): Promise<void>;
  flash(): void;
  close(): Promise<void>;
}

export function openCloseup(): Closeup {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const wrap = el('div', 'cu-wrap');
  const cv = el('canvas') as HTMLCanvasElement;
  cv.width = CW; cv.height = CH;
  wrap.appendChild(cv);
  const hintEl = el('div', 'cu-hint');
  wrap.appendChild(hintEl);
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(CW, CH);
  const buf = new Uint32Array(img.data.buffer);
  const fit = () => {
    // cover the whole screen (crop the edges rather than letterbox)
    const s = Math.max(window.innerWidth / CW, window.innerHeight / CH);
    cv.style.width = Math.ceil(CW * s) + 'px';
    cv.style.height = Math.ceil(CH * s) + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  let hintT: ReturnType<typeof setTimeout> | null = null;
  const c: Closeup = {
    wrap, cv, buf, closed: false,
    present() { g.putImageData(img, 0, 0); },
    hint(html, ms = 3200) {
      hintEl.innerHTML = html;
      hintEl.classList.add('on');
      if (hintT) clearTimeout(hintT);
      hintT = setTimeout(() => hintEl.classList.remove('on'), ms);
    },
    result(word, sub, bad) {
      const b = el('div', 'cu-burst' + (bad ? ' bad' : ''));
      const r = el('div', 'cu-res' + (bad ? ' bad' : ''), word + (sub ? `<small>${sub}</small>` : ''));
      wrap.append(b, r);
      return new Promise(res => setTimeout(() => { b.remove(); r.remove(); res(); }, 1900));
    },
    flash() { const f = el('div', 'cu-flash'); wrap.appendChild(f); setTimeout(() => f.remove(), 360); },
    close() {
      if (c.closed) return Promise.resolve();
      c.closed = true;
      window.removeEventListener('resize', fit);
      wrap.classList.add('out');
      return new Promise(res => setTimeout(() => {
        wrap.remove();
        game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
        guardInput(300);
        res();
      }, 400));
    },
  };
  return c;
}

// ------------------------------------------------------------------ pixel helpers (ABGR)

export const rgb = (r: number, g: number, b: number) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
export const hx = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(n >> 16, (n >> 8) & 255, n & 255); };
export const R = (c: number) => c & 255, G = (c: number) => (c >>> 8) & 255, B = (c: number) => (c >>> 16) & 255;
export function mixc(a: number, b: number, t: number) {
  const u = 1 - t;
  return rgb(R(a) * u + R(b) * t, G(a) * u + G(b) * t, B(a) * u + B(b) * t);
}
export function put(buf: Uint32Array, x: number, y: number, c: number) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  buf[y * CW + x] = c;
}
export function blend(buf: Uint32Array, x: number, y: number, c: number, a: number) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= CW || y >= CH || a <= 0) return;
  const i = y * CW + x;
  buf[i] = a >= 1 ? c : mixc(buf[i], c, a);
}
export function add(buf: Uint32Array, x: number, y: number, r: number, g: number, b: number) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const i = y * CW + x, v = buf[i];
  buf[i] = rgb(Math.min(255, R(v) + r), Math.min(255, G(v) + g), Math.min(255, B(v) + b));
}
/** ordered-dither threshold 0..1 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dith = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** pick from a ramp with ordered dithering between steps (pixel-art gradients) */
export function ramp(r: number[], t: number, x: number, y: number) {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1);
  const i = Math.floor(f);
  // dither only across a narrow band at each step so flat areas stay clean
  return f - i > 0.3 + dith(x, y) * 0.4 ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
export const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
