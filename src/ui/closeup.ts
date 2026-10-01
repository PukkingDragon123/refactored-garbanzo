// Visual-novel cut-ins: for the expressive lines (shouts, shock, fear, joy, tears, or when a script
// asks) a slanted band opens across the screen and the speaker's HD pixel bust comes in on it.
// Everything is drawn into one low-res canvas at the bust's own pixel scale (panel art, effects and
// bust share one crisp pixel grid). No speed lines, focus lines or radial line bursts for anyone.
// Each character has a look:
//  - Jenna, 'anime': her pink kawaii panel, kept clean: a soft dithered pink wash that is palest in a
//    glow behind her head, a handful of sakura petals tumbling through the band, a few twinkles round
//    her hair, and a gentle entrance (she rises into the band and dissolves in on the pixel grid,
//    with a little lift on each new line). Lilac, slower petals and no twinkles when scared or sad.
//  - Mori, Joshu, Aroha, 'clean': a calm panel in their own colours, a subtle gradient and no
//    particles. Big moments (shouts, shock, anger) add a short shake, an impact frame and one white
//    flash; scared adds a cold vignette and a shiver.
//  - Chunk, 'plain': a deliberately bland flat card. Hard cut in, no rim, no shadow, a slow deadpan
//    zoom, and one comic beat: a sweat drop sliding down, or a flat "boof." caption.
// The bust breathes, lip-syncs and breaks out of the band's top edge. A name plate rides under it
// and the line's bubble docks beside it. The cut-in only ever draws in this band, mid-screen: it is
// never used as a small profile picture (the HUD and the portrait box keep the normal portraits).

import { el } from './ui';
import { renderAnimePortraitHD } from '../art/anime/portraits';
import { outfitOf } from '../art/v7/wardrobe';

type BustId = string;
type PExpr = string;
type Mood = 'burst' | 'cold' | 'happy' | 'sad' | 'cool' | 'calm';
type Look = 'anime' | 'clean' | 'plain';
const lookOf = (id: string): Look => { const b = ALIAS[id] ?? id; return b === 'jenna' ? 'anime' : b === 'chunk' ? 'plain' : 'clean'; };
const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };
const CAST = ['mori', 'jenna', 'joshu', 'aroha', 'chunk'];

/** band height in canvas pixels (the bust is 120 tall and pops out of the top edge) */
const BH = 132;
const POP = 10;

const CSS = `
.cu { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
.cu .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 35% 58%, rgba(8,4,12,0.15) 20%, rgba(8,4,12,0.6) 100%); opacity: 0; transition: opacity 0.2s; }
.cu.on .dim { opacity: 1; }
.cu.cold .dim { background: radial-gradient(ellipse at 35% 58%, rgba(6,10,30,0.25) 15%, rgba(4,6,22,0.78) 100%); }
.cu canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; }
.cu .np { position: absolute; left: 0; top: 0; transform-origin: 0 50%; opacity: 0; transition: opacity 0.12s; }
.cu .np.on { opacity: 1; }
.cu .np div { font-family: 'Jersey 10', 'Silkscreen', 'Pixelify Sans', monospace; font-weight: 700; font-size: var(--nps, 18px); letter-spacing: 0.14em; line-height: 1;
  color: #fff; background: #0c0a0c; padding: 0.32em 1em 0.26em 1.1em; transform: skewX(-14deg); white-space: nowrap;
  box-shadow: inset 0.4em 0 0 var(--c1, #3fbca6), 0.28em 0.28em 0 var(--c1, #3fbca6), 0.28em 0.28em 0 2px #0c0a0c; animation: cuNp 0.32s cubic-bezier(.2,1.6,.4,1) both 0.12s; }
.cu .np span { display: inline-block; transform: skewX(14deg); }
@keyframes cuNp { from { transform: skewX(-14deg) translateX(-140%); } }
.cu .np.out div { animation: cuNpOut 0.14s ease-in both; }
@keyframes cuNpOut { to { transform: skewX(-14deg) translateX(-160%); } }
.cu .fl { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.cu.flash .fl { animation: cuFlash 0.22s ease-out; }
@keyframes cuFlash { from { opacity: 0.6; } to { opacity: 0; } }
.cu.anime .dim { background: radial-gradient(ellipse at 35% 58%, rgba(40,8,32,0.1) 25%, rgba(36,8,30,0.5) 100%); }
.cu.anime.cold .dim { background: radial-gradient(ellipse at 35% 58%, rgba(20,12,44,0.2) 20%, rgba(14,8,36,0.66) 100%); }
.cu.anime .fl { background: #fff4fa; }
.cu.anime.flash .fl { animation: cuFlashSoft 0.3s ease-out; }
@keyframes cuFlashSoft { from { opacity: 0.45; } to { opacity: 0; } }
.cu.anime .np div { color: #fff; background: #d0488e; box-shadow: inset 0.4em 0 0 #ffd0e6, 0.28em 0.28em 0 #ffd0e6, 0.28em 0.28em 0 2px #6a1a4a; animation: cuNpRise 0.42s cubic-bezier(.25,1.45,.45,1) both 0.16s; }
.cu.anime .np span::after { content: ' ♥'; color: #ffd0e6; }
@keyframes cuNpRise { 0% { transform: skewX(-14deg) translateY(70%) scale(0.86); opacity: 0; } 40% { opacity: 1; } }
.cu.anime .np.out div { animation: cuNpOut 0.14s ease-in both; }
.cu.plain .dim { background: rgba(10,8,6,0.22); }
.cu.plain .np div { color: #2a2420; background: #f4eee0; transform: none; letter-spacing: 0.06em; box-shadow: 0 0 0 2px #2a2420; animation: none; }
.cu.plain .np span { transform: none; }
.cu.plain .np.out div { animation: none; opacity: 0; }
.cu .bf { position: absolute; left: 0; top: 0; font-family: 'Jersey 10', 'Pixelify Sans', monospace; font-size: var(--nps, 18px); line-height: 1; color: #2a2420; background: #fffdf6;
  padding: 0.2em 0.5em 0.15em; box-shadow: 0 0 0 2px #2a2420; opacity: 0; white-space: nowrap; }
.cu .bf.on { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .cu .np div, .cu.anime .np div { animation: none; } }
`;

/** Jenna's kawaii palettes per mood: [light, mid, dark, accent] */
const KAWAII: Record<Mood, string[]> = {
  happy: ['#ffd4e6', '#f48cbc', '#8a3470', '#fff3f9'],
  calm: ['#ffd2e5', '#f096c2', '#7e2e66', '#fff1f8'],
  cool: ['#ffcae0', '#ea82b4', '#6e2458', '#fff0f7'],
  burst: ['#ffc0da', '#ec6aa2', '#5a1040', '#fff6fb'],
  cold: ['#ddd2f6', '#9a86d2', '#2a1c52', '#f6f0ff'],
  sad: ['#e4d2ec', '#aa8cc2', '#33224a', '#fcf4ff'],
};
const hmix = (a: string, b: string, t: number) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0');
};
/** the panel palette for a look and mood */
function paletteOf(look: Look, id: string, mood: Mood): string[] {
  if (look === 'plain') return ['#e2d4b0', '#e2d4b0', '#5a4a34', '#fffaf0'];
  if (look === 'anime') return KAWAII[mood];
  const c = COLORS[id] ?? COLORS.mori;
  // calm panels stay in the character's colours; fear cools them, sadness greys them
  if (mood === 'cold') return [hmix(c[0], '#5a6aa8', 0.55), hmix(c[1], '#262c66', 0.55), hmix(c[2], '#070818', 0.5), '#d8e2ff'];
  if (mood === 'sad') return [hmix(c[0], '#8a96a4', 0.5), hmix(c[1], '#3e4a5a', 0.5), hmix(c[2], '#101820', 0.4), c[3]];
  return c;
}

/** per-cast panel colours: [light, mid, dark, accent] */
const COLORS: Record<string, string[]> = {
  mori: ['#8cc46a', '#3f7a3a', '#10241a', '#e6ff9a'],
  jenna: ['#f08ac0', '#a8467e', '#2a0c26', '#ffe1f0'],
  joshu: ['#6c9ad8', '#2f4f86', '#0a1226', '#d4e6ff'],
  aroha: ['#e8a860', '#9a6230', '#2a1408', '#ffe6b4'],
  chunk: ['#f0904c', '#c04a26', '#2a0e08', '#ffe0a8'],
};

function moodOf(expr: string, style?: string): Mood {
  if (['happy', 'laugh', 'excited', 'wow', 'teasing', 'eat'].includes(expr)) return 'happy';
  if (style === 'shout' || ['angry', 'shocked', 'surprised'].includes(expr)) return 'burst';
  if (['scared', 'worried'].includes(expr)) return 'cold';
  if (['sad', 'cry', 'tired', 'injured'].includes(expr)) return 'sad';
  if (['determined', 'serious', 'smug', 'grumpy'].includes(expr)) return 'cool';
  return 'calm';
}

// ------------------------------------------------------------------ pixel helpers (ABGR)
const rgb = (r: number, g: number, b: number) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
const hx = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(n >> 16, (n >> 8) & 255, n & 255); };
const R = (c: number) => c & 255, G = (c: number) => (c >>> 8) & 255, B = (c: number) => (c >>> 16) & 255;
const mix = (a: number, b: number, t: number) => { const u = 1 - t; return rgb(R(a) * u + R(b) * t, G(a) * u + G(b) * t, B(a) * u + B(b) * t); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hash = (x: number, y = 0, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
/** ease out with a small, soft overshoot */
const easeOutSoft = (p: number) => { const c = 1.15; p = clamp01(p) - 1; return 1 + (c + 1) * p * p * p + c * p * p; };
const easeOutCubic = (p: number) => 1 - (1 - clamp01(p)) ** 3;
const easeInCubic = (p: number) => clamp01(p) ** 3;

/** a ramp of colours, picked with ordered dithering across each step (pixel-art gradient) */
function grad(stops: number[], steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(f));
    out.push(mix(stops[k], stops[k + 1], f - k));
  }
  return out;
}
const pick = (r: number[], t: number, x: number, y: number) => {
  const f = clamp01(t) * (r.length - 1) * 0.9999, i = Math.floor(f);
  return f - i > dith(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i];
};

/** a sakura petal tumbling through four frames (L petal, W its lit tip, D the deeper base), and Chunk's sweat drop (k ink, b blue, w white) */
const PETALS = [['.LWL.', 'LLLLL', '.DLL.'], ['..LW', '.LLL', 'DLL.'], ['.LW', 'DL.'], ['DL..', '.LLL', '..LW']];
const DROP = ['..k..', '.kbk.', '.kbk.', 'kbbbk', 'kwbbk', 'kwbbk', 'kbbbk', '.kkk.'];

// ------------------------------------------------------------------ bust frames
interface Frame { w: number; h: number; px: Uint32Array; rim: Uint8Array; top: number }
const cache = new Map<string, Frame>();
function frame(id: BustId, expr: PExpr, talk: 0 | 1 | 2, blink: boolean): Frame {
  // busts dress from the wardrobe, so the cache is per outfit
  const key = `${id}@${outfitOf(ALIAS[id] ?? id)}|${expr}|${talk}|${blink ? 1 : 0}`;
  let f = cache.get(key);
  if (!f) {
    const buf = renderAnimePortraitHD(ALIAS[id] ?? id, expr, talk, blink);
    const w = buf.w, h = buf.h, px = new Uint32Array(buf.data);
    // a 1px rim just outside the silhouette (4-neighbour), for the crisp light outline
    const rim = new Uint8Array(w * h);
    let top = h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (px[i] >>> 24 > 127) { if (y < top) top = y; continue; }
      if ((x > 0 && px[i - 1] >>> 24 > 127) || (x < w - 1 && px[i + 1] >>> 24 > 127) || (y > 0 && px[i - w] >>> 24 > 127) || (y < h - 1 && px[i + w] >>> 24 > 127)) rim[i] = 1;
    }
    f = { w, h, px, rim, top };
    if (cache.size > 300) cache.clear();
    cache.set(key, f);
  }
  return f;
}

export const isCastId = (id: string): id is BustId => CAST.includes(ALIAS[id] ?? id);

export class CloseUps {
  readonly root: HTMLElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img: ImageData | null = null;
  private buf = new Uint32Array(0);
  private np: HTMLElement;
  private who: BustId | null = null;
  /** the bust still on screen (kept through the exit animation) */
  private shown: BustId | null = null;
  private expr: PExpr = 'neutral';
  private style = '';
  private mood: Mood = 'calm';
  private look: Look = 'clean';
  private bf: HTMLElement;
  private pal: number[] = [];
  private col: number[] = [];
  /** time since the cut-in opened, since the current line started, and into the exit (-1: not leaving) */
  private t = 0;
  private lineT = 0;
  private outT = -1;
  private blinkT = 2;
  private talking: () => boolean = () => false;
  private loud = false;
  private impact = 0;
  /** canvas size in its own pixels and the CSS scale */
  private cw = 0;
  private ch = 0;
  private s = 2;
  private bandY = 0;
  private bustX = 0;
  private bustY = 0;

  constructor(parent: HTMLElement) {
    document.head.appendChild(el('style', '', CSS));
    this.root = parent.appendChild(el('div', 'cu'));
    this.root.innerHTML = `<div class="dim"></div><canvas></canvas><div class="np"><div><span></span></div></div><div class="bf"></div><div class="fl"></div>`;
    this.bf = this.root.querySelector('.bf') as HTMLElement;
    this.cv = this.root.querySelector('canvas') as HTMLCanvasElement;
    this.g = this.cv.getContext('2d')!;
    this.np = this.root.querySelector('.np') as HTMLElement;
    let last = performance.now();
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
    };
    requestAnimationFrame(tick);
  }

  get active() { return this.who !== null; }

  show(id: BustId, expr: string, o: { name: string; style?: string; talking: () => boolean }) {
    const e = (expr || 'neutral') as PExpr;
    const again = this.who === id && this.outT < 0;
    const mood = moodOf(e, o.style);
    const look = lookOf(id);
    // Chunk stays deadpan: no impact frames, no shake
    const loud = look !== 'plain' && (o.style === 'shout' || e === 'shocked' || e === 'angry');
    this.who = id;
    this.shown = id;
    this.expr = e;
    this.style = o.style ?? '';
    this.talking = o.talking;
    this.loud = loud;
    this.mood = mood;
    this.look = look;
    const cc = COLORS[ALIAS[id] ?? id] ?? COLORS.mori;
    const mc = paletteOf(look, ALIAS[id] ?? id, mood);
    this.pal = mc.map(hx);
    // Jenna's wash runs from near-white through her pinks and stops short of the dark (soft, airy);
    // the calm panels use their full light-to-dark ramp
    this.col = look === 'anime' ? grad([mc[3], mc[0], mc[1], hmix(mc[1], mc[2], 0.3)].map(hx), 12) : grad([mc[0], mc[1], mc[2]].map(hx), 9);
    this.root.style.setProperty('--c1', cc[0]);
    this.root.classList.toggle('anime', look === 'anime');
    this.root.classList.toggle('plain', look === 'plain');
    // Chunk's one comic beat: a flat caption when he is excited or loud, otherwise a sweat drop
    this.bf.textContent = look === 'plain' && (mood === 'happy' || mood === 'burst' || o.style === 'shout') ? (mood === 'burst' || o.style === 'shout' ? 'BOOF.' : 'boof.') : '';
    this.bf.classList.remove('on');
    (this.np.querySelector('span') as HTMLElement).textContent = o.name.toUpperCase();
    this.root.classList.toggle('cold', mood === 'cold');
    this.lineT = 0;
    if (!again) {
      this.t = 0;
      this.outT = -1;
      this.np.classList.remove('out', 'on');
      void this.np.offsetWidth;
      this.np.classList.add('on');
    }
    // a short punch on loud entrances (and when a running cut-in gets louder): a flash, and on the
    // calm panels one impact frame
    if (loud && (!again || o.style === 'shout')) {
      this.impact = 0.16;
      this.root.classList.remove('flash'); void this.root.offsetWidth; this.root.classList.add('flash');
    }
    // Jenna never gets the impact frame (it reads as a glitch on her soft panel)
    if (look === 'anime') this.impact = 0;
    this.root.classList.add('on');
    this.layout();
  }

  hide() {
    if (!this.who) return;
    this.who = null;
    this.outT = 0;
    this.np.classList.add('out');
    this.bf.classList.remove('on');
    this.root.classList.remove('on', 'flash');
  }

  /** CSS position for the line's bubble: docked to the right of the bust, level with its mouth */
  anchor(): [number, number] {
    const off = this.cv.offsetLeft;
    return [off + (this.bustX + 104) * this.s, this.cv.offsetTop + (this.bustY + 66) * this.s];
  }

  private layout() {
    const pr = this.root.getBoundingClientRect();
    const W = Math.max(1, pr.width), H = Math.max(1, pr.height);
    // the band takes about half the height; snap the scale to halves so the pixels stay even-ish
    let s = (H * 0.5) / (BH + POP);
    s = s >= 2 ? Math.round(s * 2) / 2 : Math.max(1, s);
    const cw = Math.ceil(W / s), ch = Math.ceil(H / s);
    if (cw !== this.cw || ch !== this.ch || !this.img) {
      this.cw = cw; this.ch = ch;
      this.cv.width = cw; this.cv.height = ch;
      this.img = this.g.createImageData(cw, ch);
      this.buf = new Uint32Array(this.img.data.buffer);
    }
    this.s = s;
    this.cv.style.width = `${cw * s}px`;
    this.cv.style.height = `${ch * s}px`;
    this.bandY = Math.round(ch * 0.56 - BH / 2 + POP / 2);
    // the bust stands left of centre, leaving the right side of the band for the bubble
    this.bustX = Math.round(Math.max(6, Math.min(cw * 0.16, cw * 0.5 - 150)));
    this.bustY = this.bandY - 4;
    this.root.style.setProperty('--nps', `${Math.max(12, Math.round(7 * s))}px`);
  }

  update(dt: number) {
    if (!this.shown) return;
    this.t += dt;
    this.lineT += dt;
    this.impact -= dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.05) this.blinkT = 2.5 + Math.random() * 3;
    if (this.outT >= 0) {
      this.outT += dt;
      if (this.outT > 0.24) {
        this.shown = null;
        this.g.clearRect(0, 0, this.cw, this.ch);
        this.np.classList.remove('on', 'out');
        return;
      }
    }
    this.layout();
    this.draw();
  }

  // ---------------------------------------------------------------- drawing
  private draw() {
    const { buf, cw, ch, t, pal, col, mood, look } = this;
    const anime = look === 'anime', plain = look === 'plain';
    const id = this.shown!;
    buf.fill(0);
    const leaving = this.outT >= 0;
    // ---- open / close: Jenna's band opens with a soft settle, the calm panels ease open, Chunk's
    // card just cuts in and out
    let open = plain ? (t > 0.03 ? 1 : 0) : anime ? easeOutSoft((t - 0.03) / 0.34) : easeOutCubic((t - 0.03) / 0.22);
    if (leaving) open *= plain ? (this.outT > 0.05 ? 0 : 1) : 1 - easeInCubic(this.outT / 0.2);
    // ---- shake: a short decaying kick on loud lines (just a nudge for Jenna), a fine shiver when a
    // calm panel is scared
    let sx = 0, sy = 0;
    const tick = Math.floor(t * 30);
    if (this.loud) {
      const a = anime ? 2.4 * (1 - this.lineT / 0.26) : Math.max(this.style === 'shout' ? 0.6 : 0, 3.5 * (1 - this.lineT / 0.32));
      if (a > 0.5) { sx = Math.round((hash(tick, 1) - 0.5) * 2 * a); sy = Math.round((hash(tick, 2) - 0.5) * 1.4 * a); }
    } else if (mood === 'cold' && !plain && !anime && tick % 2 === 0) sx = hash(tick, 3) < 0.5 ? -1 : 1;
    const by0 = this.bandY + sy;
    const mid = by0 + BH / 2;
    const slant = plain ? 0.02 : 0.05; // the band rises to the right
    const half = (BH / 2) * open;
    const impact = this.impact > 0 && this.impact < 0.12;
    // the face, for the glow behind the head and the vignette
    const fx = this.bustX + 56 + sx, fy = this.bustY + 44 + sy;
    const dark = pal[2], accent = pal[3];
    const ink = hx(plain ? '#2a2420' : '#0c0a0c');
    // Jenna's band is edged in deep plum rather than black
    const edge = anime ? mix(dark, ink, 0.35) : ink;

    // ---- back layer: a wider flat band at a steeper angle, peeking out above and below (Chunk: none)
    if (open > 0.02 && !plain) {
      const back = anime ? mix(pal[0], pal[1], 0.55) : mix(pal[1], dark, 0.35);
      const lip = anime ? mix(pal[0], accent, 0.5) : mix(pal[1], dark, 0.55);
      for (let x = 0; x < cw; x++) {
        const c = mid - (x - cw * 0.3) * (slant + 0.025);
        const h2 = half + 6 * open;
        const y0 = Math.max(0, Math.round(c - h2)), y1 = Math.min(ch - 1, Math.round(c + h2));
        for (let y = y0; y <= y1; y++) buf[y * cw + x] = y === y0 || y === y1 ? edge : y - y0 < 2 || y1 - y < 2 ? lip : back;
      }
    }

    // ---- main band
    for (let x = 0; x < cw; x++) {
      const c = mid - (x - cw * 0.3) * slant;
      const top = Math.round(c - half), bot = Math.round(c + half);
      if (bot - top < 1) continue;
      for (let y = Math.max(0, top); y <= Math.min(ch - 1, bot); y++) {
        const i = y * cw + x;
        // edges: a dark rim, then a bright cream stripe (Chunk's card: just the rim)
        const et = y - top, eb = bot - y;
        if (et < 1 || eb < 1) { buf[i] = edge; continue; }
        if (plain) { buf[i] = pal[0]; continue; }
        if (et < 3 || eb < 3) { buf[i] = accent; continue; }
        if (impact) { buf[i] = hx('#ffffff'); continue; }
        const v = (y - top) / Math.max(1, bot - top); // 0 top .. 1 bottom
        const dx = (x - fx) / cw, dy = (y - fy) / BH;
        let g: number;
        if (anime) {
          // a soft pink wash: palest in a wide glow behind her head, deepening gently to the lower right
          g = 0.14 + v * 0.4 + Math.max(0, dx) * 0.55;
          const sp = Math.hypot((x - fx) / 80, (y - fy + 4) / 62);
          if (sp < 1) g -= (1 - sp) * (1 - sp) * 0.8;
          if (mood === 'cold') g += Math.hypot(dx * 2, dy) * 0.18;
        } else {
          // lit behind the face, darker toward the right and the bottom
          g = 0.18 + v * 0.38 + Math.max(0, dx) * 0.4 + Math.hypot(dx * 1.4, dy * 0.6) * 0.12;
          if (mood === 'cold') g += Math.hypot(dx * 2, dy) * 0.3;
          // a soft dithered spotlight behind the head frames the bust
          const sp = Math.hypot((x - fx) / 62, (y - fy + 6) / 52);
          if (sp < 1) g -= (1 - sp) * (mood === 'happy' ? 0.42 : 0.3);
        }
        buf[i] = pick(col, g, x, y);
      }
    }

    // a cold vignette closing in when scared (dithered, no lines)
    if (mood === 'cold' && open > 0.3 && !impact && !plain) this.vignette(fx, fy, mid, half, slant, anime ? hx('#2a1c52') : hx('#04040c'), anime ? 0.4 : 0.5);
    // Jenna: petals drifting behind her
    if (anime && open > 0.3) this.petals(mid, half, slant, false);

    // ---- the bust: shadow, light rim, pixels; head breaks out of the band's top edge
    const talk = this.talking() ? ([0, 1, 2, 1] as const)[Math.floor(this.lineT * 11) % 4] : 0;
    const blink = this.blinkT < 0.12;
    const f = frame(id, this.expr, talk, blink);
    const exitP = leaving ? easeInCubic(this.outT / 0.2) : 0;
    let ox: number, oy: number, scx: number, scy: number;
    /** 0..1: how much of the bust has dissolved in (Jenna appears on the pixel grid, and fades out the same way) */
    let solid = 1;
    if (anime) {
      // gentle: rises into the band with a soft settle while dissolving in, a small lift on each new
      // line, and on the way out she dissolves and sinks a little
      const enter = clamp01((t - 0.05) / 0.4);
      const lift = this.t - this.lineT > 0.3 ? Math.sin(clamp01(this.lineT / 0.24) * Math.PI) * 2 : 0;
      ox = sx;
      oy = Math.round((1 - easeOutSoft(enter)) * 22 + exitP * 10 - lift + Math.sin(t * 2.4) * 0.8 + 0.2) + (talk === 2 ? -1 : 0) + sy;
      scx = scy = 1;
      solid = Math.min(clamp01((t - 0.04) / 0.24), 1 - exitP);
    } else if (plain) {
      // deadpan: no entrance at all, then a slow, creeping zoom
      ox = 0; oy = 0;
      scx = scy = 1 + Math.min(this.t, 6) * 0.012;
    } else {
      // calm: a smooth slide in from the left, a small punch only on loud lines
      const enter = easeOutCubic((t - 0.05) / 0.3);
      ox = Math.round(-(1 - enter) * 70 - exitP * 120) + sx;
      oy = Math.round(Math.sin(t * 2.2) * 0.6 + 0.2) + (talk === 2 ? -1 : 0) + sy;
      scx = scy = 1 + (this.loud ? Math.max(0, 1 - this.lineT / 0.18) * 0.06 : 0);
    }
    const fw = Math.round(f.w * scx), fh = Math.round(f.h * scy);
    ox += Math.round((f.w - fw) / 2);
    oy += f.h - fh;
    const bx = this.bustX + ox, byy = this.bustY + oy;
    // clip: inside the band, plus the pop-out above it while open
    const clipTop = (x: number) => Math.round(mid - (x - cw * 0.3) * slant - half - POP * open * 1.6);
    const clipBot = (x: number) => Math.round(mid - (x - cw * 0.3) * slant + half) - 1;
    const shadow = anime ? mix(pal[1], dark, 0.4) : mix(dark, ink, 0.5), rimC = impact ? ink : accent;
    for (let pass = plain ? 2 : 0; pass < 3; pass++) {
      const dx0 = pass === 0 ? 4 : 0, dy0 = pass === 0 ? 2 : 0;
      // the last row repeats down to the band's lower edge, so the chest never ends in mid-air
      for (let y = 0; y < fh + 24; y++) {
        const syy = y < fh ? Math.min(f.h - 1, Math.floor(y / scy)) : f.h - 3;
        for (let x = 0; x < fw; x++) {
          const X = bx + x + dx0, Y = byy + y + dy0;
          if (X < 0 || X >= cw || Y < 0 || Y >= ch || Y < clipTop(X) || Y > clipBot(X)) continue;
          if (solid < 1 && dith(X, Y) >= solid) continue;
          const sxx = Math.min(f.w - 1, Math.floor(x / scx)), si = syy * f.w + sxx;
          const v = f.px[si];
          if (pass === 0) { if (v >>> 24 > 127) buf[Y * cw + X] = shadow; }
          else if (pass === 1) { if (f.rim[si]) buf[Y * cw + X] = rimC; }
          else if (v >>> 24 > 127) buf[Y * cw + X] = impact ? ink : v;
        }
      }
    }
    // a faint cold pall over the upper face when scared
    if (mood === 'cold' && open > 0.5 && !impact && !plain) {
      const y0 = f.top + 14, y1 = 70, pall = hx(anime ? '#3a2c7c' : '#2a2a78');
      for (let fy2 = y0; fy2 < y1; fy2++) {
        const k = 1 - (fy2 - y0) / (y1 - y0);
        for (let fx2 = 18; fx2 < f.w - 18; fx2++) {
          if (f.px[fy2 * f.w + fx2] >>> 24 < 128) continue;
          const X = bx + fx2, Y = byy + fy2;
          if (X < 0 || X >= cw || Y < 0 || Y >= ch || Y < clipTop(X)) continue;
          if (solid < 1 && dith(X, Y) >= solid) continue;
          const i = Y * cw + X;
          buf[i] = mix(buf[i], pall, k * (anime ? 0.18 : 0.22));
        }
      }
    }
    if (anime && open > 0.5) {
      // a couple of nearer petals in front of her, and a few twinkles round her hair on bright moods
      this.petals(mid, half, slant, true);
      if (solid > 0.9 && (mood === 'happy' || mood === 'calm' || mood === 'cool')) this.twinkles(bx, byy + f.top);
    }
    if (plain && open > 0.5 && !this.bf.textContent) {
      // Chunk's sweat drop: appears after a beat, then slides slowly down beside his head
      const beat = this.lineT - 0.35;
      if (beat > 0) this.sprite(DROP, bx + Math.round(f.w * 0.8), byy + f.top + 6 + Math.min(12, Math.floor(beat * 5)), 2, { k: ink, b: hx('#8ccff4'), w: hx('#ffffff') });
    }
    this.g.putImageData(this.img!, 0, 0);
    // name plate under the bust, riding the band's lower edge
    const nx = (this.bustX - 4 + Math.round(anime ? 0 : -exitP * 120)) * this.s;
    const ny = (mid - (this.bustX - cw * 0.3) * slant + half - 6) * this.s;
    this.np.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
    if (plain && this.bf.textContent) {
      // the flat "boof." caption, a beat after the line starts
      this.bf.classList.toggle('on', open > 0.5 && this.lineT > 0.4 && !leaving);
      this.bf.style.transform = `translate(${Math.round((bx + f.w * 0.82) * this.s)}px, ${Math.round((byy + f.top + 4) * this.s)}px)`;
    }
  }

  /** a tiny string sprite ('.' and ' ' are clear; other chars index the colour map) at an integer scale */
  private sprite(rows: string[], x: number, y: number, k: number, cols: Record<string, number>, inside?: (X: number, Y: number) => boolean) {
    const { buf, cw, ch } = this;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const col = cols[rows[r][c]];
      if (col === undefined) continue;
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
        const X = x + c * k + b, Y = y + r * k + a;
        if (X < 0 || Y < 0 || X >= cw || Y >= ch || (inside && !inside(X, Y))) continue;
        buf[Y * cw + X] = col;
      }
    }
  }

  /** Jenna's sakura: a few petals tumbling down through the band on a light breeze (kept inside the
   *  band, never across the rest of the screen); fewer, slower and lilac when she is scared or sad */
  private petals(mid: number, half: number, slant: number, front: boolean) {
    const { cw, t, mood } = this;
    const low = mood === 'sad' || mood === 'cold';
    const n = front ? (low ? 1 : 2) : low ? 4 : 7;
    // pale petals with a deeper base, so they read against the pink wash
    const C = low ? { L: hx('#f4eeff'), W: hx('#ffffff'), D: hx('#9c86cc') } : { L: hx('#fff0f6'), W: hx('#ffffff'), D: hx('#e2639a') };
    const inBand = (X: number, Y: number) => { const c = mid - (X - cw * 0.3) * slant; return Y > c - half + 3 && Y < c + half - 3; };
    // the cycle runs over the full band height, so the petals don't jump while the band opens
    const span = BH + 14, wrap = cw + 40;
    for (let k = 0; k < n; k++) {
      const seed = k + (front ? 40 : 0);
      const fall = (low ? 5 : 8) + hash(seed, 51) * (low ? 3 : 6);
      const u = t * fall + hash(seed, 52) * span;
      const cyc = Math.floor(u / span), yr = u - cyc * span;
      // drifting down and to the left, swaying a little
      const x = (((hash(seed, 53, cyc) * wrap - yr * 0.7 + Math.sin(t * (0.6 + hash(seed, 54) * 0.5) + k * 1.7) * 5) % wrap) + wrap) % wrap - 20;
      const y = mid - (x - cw * 0.3) * slant - span / 2 + yr;
      const fr = PETALS[Math.floor((t * (0.8 + hash(seed, 55) * 0.6) + hash(seed, 56)) * 4) & 3];
      this.sprite(fr, Math.round(x), Math.round(y), front ? 2 : 1, C, inBand);
    }
  }

  /** a few soft twinkles round her hair (never over the face): each lights up, glints and goes out */
  private twinkles(bx: number, top: number) {
    // spots relative to the bust's top-left and the top of the head: beside the hair and just above it
    const spots: [number, number][] = [[10, 16], [16, 2], [98, 8], [104, 26], [6, 36], [92, -6]];
    for (let k = 0; k < 3; k++) {
      const P = 2 + hash(k, 31) * 1.1, u = (this.t + hash(k, 32) * P) / P;
      const cyc = Math.floor(u), ph = u - cyc;
      if (ph > 0.45) continue;
      const s = spots[Math.floor(hash(k, 33, cyc) * spots.length)];
      const x = bx + s[0] + Math.round((hash(k, 34, cyc) - 0.5) * 8), y = top + s[1] + Math.round((hash(k, 35, cyc) - 0.5) * 8);
      this.twinkle(x, y, Math.sin((ph / 0.45) * Math.PI) * 3);
    }
  }
  private twinkle(x: number, y: number, r: number) {
    const { buf, cw, ch } = this;
    const put = (X: number, Y: number, c: number) => { if (X >= 0 && Y >= 0 && X < cw && Y < ch) buf[Y * cw + X] = c; };
    if (r < 0.5) return;
    const n = Math.round(r), core = hx('#ffffff'), arm = hx('#ffd8ea');
    put(x, y, core);
    for (let d = 1; d <= n; d++) {
      const c = d < n ? core : arm;
      put(x + d, y, c); put(x - d, y, c); put(x, y + d, c); put(x, y - d, c);
    }
    // a soft glint between the arms at full size
    if (n >= 2) { put(x - 1, y - 1, arm); put(x + 1, y - 1, arm); put(x - 1, y + 1, arm); put(x + 1, y + 1, arm); }
  }

  /** dithered vignette darkening the band toward its ends (fear) */
  private vignette(fx: number, fy: number, mid: number, half: number, slant: number, c: number, k: number) {
    const { buf, cw, ch } = this;
    const yA = Math.max(0, Math.round(mid - half - cw * slant)), yB = Math.min(ch - 1, Math.round(mid + half + cw * slant));
    for (let y = yA; y <= yB; y++) for (let x = 0; x < cw; x++) {
      const cc = mid - (x - cw * 0.3) * slant;
      if (y <= cc - half + 3 || y >= cc + half - 3) continue;
      const d = Math.hypot((x - fx) / (cw * 0.55), (y - fy) / (half * 1.4));
      if (d > 0.75 && dith(x, y) < (d - 0.75) * 0.9) { const i = y * cw + x; buf[i] = mix(buf[i], c, k); }
    }
  }
}
