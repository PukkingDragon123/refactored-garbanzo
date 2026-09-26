// Shared helpers for the V2 HTML UIs (laptop, backpack, crafting, photo review):
// sfx wrapper, one-time CSS injection, count-ups, a tiny pixel font, crisp pixel-art panel backgrounds,
// and fallback crew badges for portraits that aren't drawn yet.

import { audio } from '../core/audio';
import { game } from '../game/game';
import { PixelBuffer } from '../art/pixel';
import { C, hex, withAlpha } from '../art/color';
import { uiIconURL } from '../art/itemicons';
import { el } from './ui';

/** Play a sound by name; tolerant of names the audio engine doesn't know yet. */
export const sfx = (n: string, o?: { vol?: number; pitch?: number }) => {
  try { (audio.play as (n: any, o?: any) => void)(n, o); } catch { /* ignore */ }
};

const injected = new Set<string>();
/** Inject a <style> block once per id. */
export function css(id: string, text: string) {
  if (injected.has(id)) return;
  injected.add(id);
  const s = el('style', '', text);
  s.dataset.ui = id;
  document.head.appendChild(s);
}

export const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, reduced() ? Math.min(ms, 30) : ms));
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Animate a number in an element from a to b. */
export function countUp(e: HTMLElement, a: number, b: number, ms = 700, fmt: (n: number) => string = n => String(n), tick?: (n: number) => void) {
  if (reduced() || ms <= 0 || a === b) { e.textContent = fmt(b); tick?.(b); return Promise.resolve(); }
  return new Promise<void>(res => {
    const t0 = performance.now();
    let last = a;
    const f = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const k = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (b - a) * k);
      if (v !== last) { last = v; tick?.(v); }
      e.textContent = fmt(v);
      if (t < 1 && e.isConnected) requestAnimationFrame(f);
      else { e.textContent = fmt(b); res(); }
    };
    requestAnimationFrame(f);
  });
}

/** Row of pixel stars. */
export function starsHTML(n: number, max = 5, cls = 'k-stars') {
  let h = `<span class="${cls}">`;
  for (let i = 0; i < max; i++) h += `<img src="${uiIconURL(i < n ? 'star' : 'star0', 2)}" alt="${i < n ? '★' : '☆'}">`;
  return h + '</span>';
}
export const rpIcon = (cls = 'k-rp') => `<img class="${cls}" src="${uiIconURL('rp', 2)}" alt="RP">`;

/** Integer art-pixel scale for UI pixel frames, derived from the UI font size (3 at 1280x720, 2 at 960x540). */
export function uiPx(): number {
  const root = document.getElementById('ui') ?? document.body;
  const fs = parseFloat(getComputedStyle(root).fontSize) || 14;
  return Math.max(2, Math.round(fs / 5.2));
}

/**
 * Crisp pixel-art background for an element: a canvas behind its content, repainted at art resolution
 * (element size / px) whenever the element or any watched child resizes. Returns a disposer with .repaint().
 */
export function pixelBackdrop(host: HTMLElement, paint: (b: PixelBuffer, w: number, h: number) => void, px = uiPx(), watch: HTMLElement[] = []): (() => void) & { repaint: () => void } {
  const cv = document.createElement('canvas');
  cv.className = 'k-backdrop';
  host.prepend(cv);
  host.style.setProperty('--px', px + 'px');
  let key = '';
  const draw = (force = false) => {
    const r = host.getBoundingClientRect();
    const w = Math.max(8, Math.round(r.width / px)), h = Math.max(8, Math.round(r.height / px));
    const k = w + 'x' + h + watch.map(e => { const q = e.getBoundingClientRect(); return `|${Math.round(q.left - r.left)},${Math.round(q.top - r.top)},${Math.round(q.width)},${Math.round(q.height)}`; }).join('');
    if (k === key && !force) return;
    key = k;
    const b = new PixelBuffer(w, h);
    paint(b, w, h);
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), w, h), 0, 0);
  };
  let ro: ResizeObserver | null = null;
  try { ro = new ResizeObserver(() => draw()); ro.observe(host); for (const e of watch) ro.observe(e); } catch { /* old browser */ }
  requestAnimationFrame(() => draw());
  draw();
  const dispose = (() => { ro?.disconnect(); cv.remove(); }) as (() => void) & { repaint: () => void };
  dispose.repaint = () => draw(true);
  return dispose;
}

// ---------------------------------------------------------------- tiny pixel font (3x5, a few wide glyphs)
const GLYPH: Record<string, string[]> = {
  A: ['.1.', '1.1', '111', '1.1', '1.1'], B: ['11.', '1.1', '11.', '1.1', '11.'], C: ['.11', '1..', '1..', '1..', '.11'],
  D: ['11.', '1.1', '1.1', '1.1', '11.'], E: ['111', '1..', '11.', '1..', '111'], F: ['111', '1..', '11.', '1..', '1..'],
  G: ['.11', '1..', '1.1', '1.1', '.11'], H: ['1.1', '1.1', '111', '1.1', '1.1'], I: ['111', '.1.', '.1.', '.1.', '111'],
  J: ['..1', '..1', '..1', '1.1', '.1.'], K: ['1.1', '1.1', '11.', '1.1', '1.1'], L: ['1..', '1..', '1..', '1..', '111'],
  M: ['1...1', '11.11', '1.1.1', '1...1', '1...1'], N: ['1..1', '11.1', '1.11', '1..1', '1..1'], O: ['.1.', '1.1', '1.1', '1.1', '.1.'],
  P: ['11.', '1.1', '11.', '1..', '1..'], Q: ['.1.', '1.1', '1.1', '11.', '.11'], R: ['11.', '1.1', '11.', '1.1', '1.1'],
  S: ['.11', '1..', '.1.', '..1', '11.'], T: ['111', '.1.', '.1.', '.1.', '.1.'], U: ['1.1', '1.1', '1.1', '1.1', '111'],
  V: ['1.1', '1.1', '1.1', '1.1', '.1.'], W: ['1...1', '1...1', '1.1.1', '11.11', '1...1'], X: ['1.1', '1.1', '.1.', '1.1', '1.1'],
  Y: ['1.1', '1.1', '.1.', '.1.', '.1.'], Z: ['111', '..1', '.1.', '1..', '111'],
  '0': ['111', '1.1', '1.1', '1.1', '111'], '1': ['.1.', '11.', '.1.', '.1.', '111'], '2': ['11.', '..1', '.1.', '1..', '111'],
  '3': ['11.', '..1', '.1.', '..1', '11.'], '4': ['1.1', '1.1', '111', '..1', '..1'], '5': ['111', '1..', '11.', '..1', '11.'],
  '6': ['.11', '1..', '11.', '1.1', '.1.'], '7': ['111', '..1', '.1.', '.1.', '.1.'], '8': ['.1.', '1.1', '.1.', '1.1', '.1.'],
  '9': ['.1.', '1.1', '.11', '..1', '11.'], '.': ['.', '.', '.', '.', '1'], "'": ['1', '1', '.', '.', '.'], '!': ['1', '1', '1', '.', '1'],
  '?': ['11.', '..1', '.1.', '...', '.1.'], '-': ['...', '...', '111', '...', '...'], ':': ['.', '1', '.', '1', '.'],
  '/': ['..1', '..1', '.1.', '1..', '1..'], '+': ['...', '.1.', '111', '.1.', '...'], '%': ['1.1', '..1', '.1.', '1..', '1.1'],
  '—': ['.....', '.....', '11111', '.....', '.....'], '♥': ['.1.1.', '11111', '11111', '.111.', '..1..'],
  '✓': ['....1', '...11', '1.11.', '111..', '.1...'], '&': ['.1.', '1.1', '.11', '1.1', '.11'], ' ': ['..', '..', '..', '..', '..'],
};
const MACRON: Record<string, string> = { 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U' };

export function textWidth(t: string) {
  let w = 0;
  for (const ch of t.toUpperCase()) w += ((GLYPH[MACRON[ch] ?? ch] ?? GLYPH['?'])[0].length) + 1;
  return Math.max(0, w - 1);
}
/** Draw pixel text; y is the cap-top row (macrons draw 2 rows above). */
export function drawText(b: PixelBuffer, t: string, x: number, y: number, c: C, shadow?: C) {
  let cx = x;
  for (const raw of t.toUpperCase()) {
    const base = MACRON[raw] ?? raw;
    const g = GLYPH[base] ?? GLYPH['?'];
    const w = g[0].length;
    for (let r = 0; r < 5; r++) for (let k = 0; k < w; k++) if (g[r][k] === '1') {
      if (shadow !== undefined) b.set(cx + k + 1, y + r + 1, shadow);
      b.set(cx + k, y + r, c);
    }
    if (MACRON[raw]) for (let k = 0; k < w; k++) b.set(cx + k, y - 2, c);
    cx += w + 1;
  }
  return cx - x - 1;
}

// ---------------------------------------------------------------- pixel painting helpers
export const H = (s: string, a = 255) => hex(s, a);
/** Cheap deterministic hash noise 0..1. */
export const noise = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
/** Woven fabric fill (canvas, flax) with a subtle 2-tone twill and speckle. */
export function fabric(b: PixelBuffer, x0: number, y0: number, w: number, h: number, c1: C, c2: C, c3: C, seed = 1) {
  b.rectFn(x0, y0, w, h, (x, y) => {
    const n = noise(x, y, seed);
    if (n > 0.965) return c3;
    return ((x + y * 2) % 4 === 0) ? c2 : c1;
  });
}
/** Dashed stitching line. */
export function stitch(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: C, on = 2, off = 2) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) if (i % (on + off) < on) b.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
}
export function frameRect(b: PixelBuffer, x: number, y: number, w: number, h: number, c: C) {
  b.rect(x, y, w, 1, c); b.rect(x, y + h - 1, w, 1, c); b.rect(x, y, 1, h, c); b.rect(x + w - 1, y, 1, h, c);
}
/** Rounded (chamfered) filled rect. */
export function chamfer(b: PixelBuffer, x: number, y: number, w: number, h: number, c: C, r = 2) {
  b.rectFn(x, y, w, h, (px, py) => {
    const dx = Math.min(px - x, x + w - 1 - px), dy = Math.min(py - y, y + h - 1 - py);
    return dx + dy < r ? -1 : c;
  });
}
export function rivet(b: PixelBuffer, x: number, y: number, c1: C, c2: C) {
  b.set(x, y, c1); b.set(x + 1, y, c2); b.set(x, y + 1, c2); b.set(x + 1, y + 1, withAlpha(c2, 255));
}
/** Nearest-neighbour rotate a buffer (for slightly tilted stickers). */
export function rotateNN(src: PixelBuffer, ang: number): PixelBuffer {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const w = Math.ceil(Math.abs(src.w * ca) + Math.abs(src.h * sa)) + 2;
  const h = Math.ceil(Math.abs(src.w * sa) + Math.abs(src.h * ca)) + 2;
  const out = new PixelBuffer(w, h);
  const cx = src.w / 2, cy = src.h / 2, ox = w / 2, oy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
    const sx = Math.floor(dx * ca + dy * sa + cx), sy = Math.floor(-dx * sa + dy * ca + cy);
    if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) out.data[y * w + x] = src.data[sy * src.w + sx];
  }
  return out;
}
/** Put a buffer into a <canvas> (1 canvas pixel per art pixel). */
export function bufCanvas(b: PixelBuffer, cls = ''): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = b.w; cv.height = b.h;
  if (cls) cv.className = cls;
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  return cv;
}

// ---------------------------------------------------------------- crew badges (fallback portraits)
const FACE: Record<string, { skin: string; hair: string; extra: (b: PixelBuffer) => void; bg: string }> = {
  rowan: { skin: '#c98e68', hair: '#2a1a14', bg: '#2c4b80', extra: b => {
    for (const [x, y] of [[4, 3], [5, 2], [7, 2], [9, 2], [10, 3], [11, 4], [3, 5], [6, 1], [8, 1]] as number[][]) b.set(x, y, H('#2a1a14'));
    b.rect(7, 0, 2, 2, H('#2a1a14'));
    for (const x of [4, 9]) { b.rect(x, 7, 3, 1, H('#10131a')); b.rect(x, 9, 3, 1, H('#10131a')); b.set(x, 8, H('#10131a')); b.set(x + 2, 8, H('#10131a')); }
    b.set(7, 8, H('#10131a'));
    b.rect(3, 14, 10, 2, H('#23325e'));
  } },
  crowe: { skin: '#e4b287', hair: '#f4f5ef', bg: '#6f1a1d', extra: b => {
    b.rect(3, 1, 10, 4, H('#c9432f')); b.rect(3, 4, 10, 1, H('#942522')); b.rect(7, 0, 2, 1, H('#c9432f'));
    b.rect(3, 9, 10, 5, H('#f4f5ef')); b.rect(4, 13, 8, 2, H('#dadfe0')); b.rect(6, 9, 4, 1, H('#dadfe0'));
    b.set(5, 7, H('#10131a')); b.set(10, 7, H('#10131a')); b.rect(10, 11, 4, 1, H('#6a4f37'));
  } },
  aroha: { skin: '#915d44', hair: '#1a1210', bg: '#13604a', extra: b => {
    b.rect(5, 0, 6, 3, H('#1a1210')); b.set(11, 0, H('#e8d8b8')); b.set(12, 0, H('#b8382b'));
    b.rect(3, 3, 2, 7, H('#1a1210')); b.rect(11, 3, 2, 7, H('#1a1210'));
    b.set(6, 7, H('#10131a')); b.set(9, 7, H('#10131a'));
    b.set(7, 12, H('#3a2218')); b.set(8, 12, H('#3a2218'));
    b.rect(3, 14, 10, 2, H('#c9a878')); b.set(8, 14, H('#3fb88a'));
  } },
  lou: { skin: '#b0795a', hair: '#e8614a', bg: '#b58218', extra: b => {
    b.rect(3, 1, 10, 4, H('#e8614a')); b.set(4, 2, H('#f4f5ef')); b.set(8, 2, H('#f4f5ef')); b.set(11, 3, H('#f4f5ef'));
    b.set(6, 7, H('#10131a')); b.set(9, 7, H('#10131a')); b.rect(6, 10, 4, 1, H('#6f1a1d'));
    b.rect(3, 14, 10, 2, H('#f4f5ef'));
  } },
  pip: { skin: '#e4b287', hair: '#3a2a20', bg: '#ad4c1f', extra: b => {
    b.rect(4, 2, 8, 3, H('#3a2a20'));
    b.rect(3, 3, 10, 2, H('#525c63')); b.disc(5.5, 3.5, 1.3, H('#8ff0dc')); b.disc(10.5, 3.5, 1.3, H('#8ff0dc'));
    b.set(6, 8, H('#10131a')); b.set(9, 8, H('#10131a')); b.set(10, 10, H('#3a3a3a'));
    b.rect(3, 14, 10, 2, H('#e88838'));
  } },
};

const faceCache = new Map<string, string>();
/** A small pixel badge for a quest giver; used when game.ui.portraitURL has no art yet. */
export function crewBadgeURL(who: string, scale = 4): string {
  const k = who + scale;
  const c = faceCache.get(k);
  if (c) return c;
  const b = new PixelBuffer(16, 16);
  const f = FACE[who];
  if (!f) {
    // story / unknown: a compass rose
    b.disc(8, 8, 7, H('#2c4b80')); b.disc(8, 8, 6, H('#f1e8d0'));
    b.poly([8, 2, 9.5, 8, 8, 14, 6.5, 8], H('#e8614a')); b.poly([8, 8, 9.5, 8, 8, 14, 6.5, 8], H('#3b3226'));
    b.poly([2, 8, 8, 6.8, 14, 8, 8, 9.2], H('#8a7a5a'));
    b.disc(8, 8, 1, H('#f4b43c'));
  } else {
    b.rect(0, 0, 16, 16, H(f.bg));
    b.rect(1, 1, 14, 14, withAlpha(H('#ffffff'), 30));
    b.ellipse(8, 8, 4.6, 5.2, H(f.skin));
    b.rect(4, 2, 8, 3, H(f.hair));
    f.extra(b);
  }
  const u = b.toDataURL(scale);
  faceCache.set(k, u);
  return u;
}
/** Portrait URL for a crew member, falling back to a pixel badge. */
export function portrait(who: string, expr: 'neutral' | 'happy' | 'wow' | 'talk' | 'worried' = 'neutral'): string {
  let u = '';
  try { u = game.ui?.portraitURL?.(who, expr) ?? ''; } catch { u = ''; }
  return u || crewBadgeURL(who);
}

// ---------------------------------------------------------------- keyboard scopes
/** Return true from a handler to consume the key (it then never reaches the game or lower UIs). */
export type KeyHandler = (e: KeyboardEvent) => boolean | void;
const keyStack: { h: KeyHandler; modal: boolean }[] = [];
let keyHooked = false;
/**
 * Push a keyboard scope. Scopes are asked top-down; a handler returning true consumes the key.
 * A modal scope (default) never lets keys fall through to scopes beneath it. Returns a pop function.
 */
export function pushKeys(h: KeyHandler, modal = true): () => void {
  if (!keyHooked) {
    keyHooked = true;
    window.addEventListener('keydown', e => {
      for (let i = keyStack.length - 1; i >= 0; i--) {
        const sc = keyStack[i];
        let used: boolean | void = false;
        try { used = sc.h(e); } catch (err) { console.error(err); }
        if (used === true) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (sc.modal) return;
      }
    }, true);
  }
  const entry = { h, modal };
  keyStack.push(entry);
  return () => { const i = keyStack.lastIndexOf(entry); if (i >= 0) keyStack.splice(i, 1); };
}

/** A small confirm pop-over inside a container; resolves with the chosen button index (or -1). */
export function confirmPop(host: HTMLElement, html: string, buttons: { label: string; cls?: string }[]): Promise<number> {
  css('k-confirm', `
.k-confirm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(4,10,9,0.55); z-index: 50; animation: kFade 0.15s ease-out; }
.k-confirm .box { background: var(--paper); color: var(--pencil); padding: 1em 1.2em; max-width: 26em; box-shadow: 0 0 0 3px #3b3226, 0 8px 0 rgba(0,0,0,0.35); animation: kPop 0.22s cubic-bezier(.2,1.6,.4,1); text-align: center; }
.k-confirm .msg { font-family: var(--body); font-size: 1em; line-height: 1.4; margin-bottom: 0.8em; }
.k-confirm .msg b { font-family: var(--pix); }
.k-confirm .row { display: flex; gap: 0.5em; justify-content: center; flex-wrap: wrap; }
.k-confirm .btn.ghost { color: var(--pencil); box-shadow: inset 0 0 0 2px #b8a47e; }
@keyframes kFade { from { opacity: 0; } }
@keyframes kPop { from { transform: scale(0.8); opacity: 0; } }
`);
  return new Promise(res => {
    const wrap = el('div', 'k-confirm interactive');
    const box = wrap.appendChild(el('div', 'box', `<div class="msg">${html}</div>`));
    const row = box.appendChild(el('div', 'row'));
    let pop = () => {};
    const done = (i: number) => { wrap.remove(); pop(); res(i); };
    buttons.forEach((b, i) => {
      const bt = row.appendChild(el('button', 'btn ' + (b.cls ?? ''), b.label));
      bt.onclick = e => { e.stopPropagation(); sfx(i === buttons.length - 1 ? 'uiBack' : 'ui'); done(i); };
    });
    pop = pushKeys(e => {
      if (e.code === 'Escape') { sfx('uiBack'); done(-1); return true; }
      if (e.code === 'Tab' || e.code === 'KeyI' || e.code.startsWith('Arrow')) return true;
    });
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) { e.stopPropagation(); done(-1); } });
    host.appendChild(wrap);
    (row.querySelector('button') as HTMLButtonElement | null)?.focus();
  });
}

/** Basic shared CSS for kit widgets. */
css('k-base', `
.k-ui, .k-ui * { font-variant-ligatures: none; }
.k-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; pointer-events: none; z-index: 0; }
.k-stars { display: inline-flex; gap: 1px; vertical-align: middle; }
.k-stars img { width: 1.1em; height: 1.1em; image-rendering: pixelated; }
.k-rp { width: 1.15em; height: 1.15em; image-rendering: pixelated; vertical-align: -0.2em; }
.k-pix { image-rendering: pixelated; }
`);

// ---------------------------------------------------------------- laptop app contract
export type LaptopAppId = 'home' | 'samples' | 'photos' | 'skills' | 'guide' | 'quests';
/** What the laptop shell gives each app. */
export interface AppCtx {
  /** switch to another app (optionally with an argument such as a species id or 'clues') */
  open: (app: LaptopAppId, arg?: string) => void;
  /** refresh desktop badges and the taskbar (call after RP / inventory changes) */
  refresh: () => void;
  /** fly a "+N RP" chip from an element to the taskbar RP counter */
  rpFly: (from: HTMLElement | null, amount: number) => void;
  /** the OS screen element (for overlays) */
  screen: HTMLElement;
}
export type AppMount = (host: HTMLElement, ctx: AppCtx, arg?: string) => (() => void) | void;
