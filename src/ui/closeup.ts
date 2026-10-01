// Anime / visual-novel cut-ins: for dramatic lines (shouts, shock, anger, or when a script asks) a
// slanted band slashes open across the screen and the speaker's HD pixel bust punches in on it.
// Everything is drawn into one low-res canvas at the bust's own pixel scale (so the panel art, the
// effects and the bust share one crisp pixel grid): a dithered gradient, a screentone fade, and a
// mood layer picked from the expression (focus-line burst + shake for shouts and shock, a cold
// vignette, gloom lines and a shiver when scared, sparkles when happy, rain when sad, drifting speed
// lines otherwise). The bust gets a light rim and a drop shadow, breathes, lip-syncs, and breaks out
// of the band's top edge. A slanted name plate rides under it and the line's bubble docks beside it.

import { el } from './ui';
import { renderAnimePortraitHD } from '../art/anime/portraits';
import { outfitOf } from '../art/v7/wardrobe';

type BustId = string;
type PExpr = string;
type Mood = 'burst' | 'cold' | 'happy' | 'sad' | 'cool' | 'calm';
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
@media (prefers-reduced-motion: reduce) { .cu .np div { animation: none; } }
`;

/** per-cast panel colours: [light, mid, dark, accent] */
const COLORS: Record<string, string[]> = {
  mori: ['#8cc46a', '#3f7a3a', '#10241a', '#e6ff9a'],
  jenna: ['#f08ac0', '#a8467e', '#2a0c26', '#ffe1f0'],
  joshu: ['#6c9ad8', '#2f4f86', '#0a1226', '#d4e6ff'],
  aroha: ['#e8a860', '#9a6230', '#2a1408', '#ffe6b4'],
  chunk: ['#f0904c', '#c04a26', '#2a0e08', '#ffe0a8'],
};
const MOODS: Record<Exclude<Mood, 'cool' | 'calm'>, string[]> = {
  burst: ['#ff7a3c', '#c8241e', '#2a060c', '#fff1c8'],
  cold: ['#5a6ab0', '#262c66', '#070818', '#b8c8ff'],
  happy: ['#ffe48a', '#ff8ab4', '#8a3a7a', '#fffaf0'],
  sad: ['#7a96b4', '#3a506e', '#101a2a', '#cfe0f0'],
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
const easeOutBack = (p: number) => { const c = 1.9; p = clamp01(p) - 1; return 1 + (c + 1) * p * p * p + c * p * p; };
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
    this.root.innerHTML = `<div class="dim"></div><canvas></canvas><div class="np"><div><span></span></div></div><div class="fl"></div>`;
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
    const loud = o.style === 'shout' || e === 'shocked' || e === 'angry';
    this.who = id;
    this.shown = id;
    this.expr = e;
    this.style = o.style ?? '';
    this.talking = o.talking;
    this.loud = loud;
    this.mood = mood;
    const cc = COLORS[ALIAS[id] ?? id] ?? COLORS.mori;
    const mc = mood === 'cool' || mood === 'calm' ? cc : MOODS[mood];
    this.pal = mc.map(hx);
    this.col = grad([mc[0], mc[1], mc[2]].map(hx), 9);
    this.root.style.setProperty('--c1', cc[0]);
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
    // impact frames + a flash on loud entrances (and when a running cut-in gets louder)
    if (loud && (!again || o.style === 'shout')) {
      this.impact = 0.16;
      this.root.classList.remove('flash'); void this.root.offsetWidth; this.root.classList.add('flash');
    }
    this.root.classList.add('on');
    this.layout();
  }

  hide() {
    if (!this.who) return;
    this.who = null;
    this.outT = 0;
    this.np.classList.add('out');
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
    const { buf, cw, ch, t, pal, col, mood } = this;
    const id = this.shown!;
    buf.fill(0);
    const leaving = this.outT >= 0;
    // ---- open / close: a slash line wipes across, the band snaps open from it with an overshoot
    const wipe = easeOutCubic(t / 0.1);
    let open = easeOutBack((t - 0.05) / 0.24);
    if (leaving) open *= 1 - easeInCubic(this.outT / 0.2);
    // ---- shake: a hard decaying kick on loud lines, a fine shiver when scared
    let sx = 0, sy = 0;
    const tick = Math.floor(t * 30);
    if (this.loud) {
      const a = Math.max(this.style === 'shout' ? 1 : 0, 5 * (1 - this.lineT / 0.45));
      if (a > 0.5) { sx = Math.round((hash(tick, 1) - 0.5) * 2 * a); sy = Math.round((hash(tick, 2) - 0.5) * 1.4 * a); }
    } else if (mood === 'cold' && tick % 2 === 0) sx = hash(tick, 3) < 0.5 ? -1 : 1;
    const by0 = this.bandY + sy;
    const mid = by0 + BH / 2;
    const slant = 0.05; // the band rises to the right
    const half = (BH / 2) * open;
    const impact = this.impact > 0 && this.impact < 0.12;
    // the focus point (the bust's face), for bursts and the vignette
    const fx = this.bustX + 56 + sx, fy = this.bustY + 44 + sy;
    const tk = Math.floor(t * 12); // effects animate on 12s, like hand-drawn frames
    const light = pal[0], dark = pal[2], accent = pal[3];
    const ink = hx('#0c0a0c');

    // ---- back layer: a wider accent band at a steeper angle, peeking out above and below
    if (open > 0.02) for (let x = 0; x < cw; x++) {
      const c = mid - (x - cw * 0.3) * (slant + 0.025);
      const h2 = half + 6 * open;
      const y0 = Math.max(0, Math.round(c - h2)), y1 = Math.min(ch - 1, Math.round(c + h2));
      const back = mix(pal[1], dark, 0.35);
      for (let y = y0; y <= y1; y++) buf[y * cw + x] = y === y0 || y === y1 ? ink : (x + y + Math.floor(t * 24)) % 6 < 3 ? back : mix(back, dark, 0.5);
    }

    // ---- main band
    for (let x = 0; x < cw; x++) {
      const c = mid - (x - cw * 0.3) * slant;
      const top = Math.round(c - half), bot = Math.round(c + half);
      if (bot - top < 1) continue;
      for (let y = Math.max(0, top); y <= Math.min(ch - 1, bot); y++) {
        const i = y * cw + x;
        // edges: a dark rim, then a bright cream stripe
        const et = y - top, eb = bot - y;
        if (et < 1 || eb < 1) { buf[i] = ink; continue; }
        if (et < 3 || eb < 3) { buf[i] = accent; continue; }
        if (impact) { buf[i] = mood === 'burst' ? hx('#fff4e0') : hx('#ffffff'); continue; }
        const v = (y - top) / Math.max(1, bot - top); // 0 top .. 1 bottom
        const dx = (x - fx) / cw, dy = (y - fy) / BH;
        // gradient: lit behind the face, darker toward the right and the bottom
        let g = 0.12 + v * 0.55 + Math.max(0, dx) * 0.55 + Math.hypot(dx * 1.4, dy * 0.6) * 0.2;
        if (mood === 'cold') g += Math.hypot(dx * 2, dy) * 0.35;
        // a soft dithered spotlight behind the head frames the bust
        const sp = Math.hypot((x - fx) / 62, (y - fy + 6) / 52);
        if (sp < 1) g -= (1 - sp) * 0.45;
        let p = pick(col, g, x, y);
        if (sp < 1 && sp > 0.93 && mood !== 'cold') p = mix(p, accent, 0.35);
        // screentone: halftone dots growing toward the lower right
        const tone = clamp01(v * 0.9 + dx * 1.2 - 0.25);
        if (tone > 0.05) {
          const cx = x % 5, cy = (y + (Math.floor(x / 5) & 1) * 2) % 5;
          const r = tone * 2.4;
          if ((cx - 2) ** 2 + (cy - 2) ** 2 < r * r) p = mix(p, dark, 0.55);
        }
        buf[i] = p;
      }
    }

    if (open > 0.3 && !impact) this.moodLayer(fx, fy, mid, half, slant, tk, sx);

    // ---- the bust: shadow, light rim, pixels; head breaks out of the band's top edge
    const talk = this.talking() ? ([0, 1, 2, 1] as const)[Math.floor(this.lineT * 11) % 4] : 0;
    const blink = this.blinkT < 0.12;
    const f = frame(id, this.expr, talk, blink);
    const enter = easeOutBack((t - 0.07) / 0.32);
    const exitP = leaving ? easeInCubic(this.outT / 0.2) : 0;
    let ox = Math.round(-(1 - enter) * 90 - exitP * 120) + sx;
    // breathing bob (1px), plus a tiny hop on open mouth frames
    let oy = Math.round(Math.sin(t * 2.4) * 0.8 + 0.2) + (talk === 2 ? -1 : 0) + sy;
    // scale punch on entry and on each loud line (nearest-neighbour, back to exactly 1:1)
    const punch = Math.max(0, 1 - t / 0.28) * 0.14 + (this.loud ? Math.max(0, 1 - this.lineT / 0.18) * 0.08 : 0);
    const sc = 1 + punch;
    const squash = 1 - Math.sin(clamp01(t / 0.3) * Math.PI) * 0.05;
    const scx = sc / squash, scy = sc * squash;
    const fw = Math.round(f.w * scx), fh = Math.round(f.h * scy);
    ox += Math.round((f.w - fw) / 2);
    oy += f.h - fh;
    const bx = this.bustX + ox, byy = this.bustY + oy;
    // clip: inside the band, plus the pop-out above it while open
    const clipTop = (x: number) => Math.round(mid - (x - cw * 0.3) * slant - half - POP * open * 1.6);
    const clipBot = (x: number) => Math.round(mid - (x - cw * 0.3) * slant + half) - 1;
    const shadow = mix(dark, ink, 0.5), rimC = impact ? ink : accent;
    for (let pass = 0; pass < 3; pass++) {
      const dx0 = pass === 0 ? 4 : 0, dy0 = pass === 0 ? 2 : 0;
      // the last row repeats down to the band's lower edge, so the chest never ends in mid-air
      for (let y = 0; y < fh + 24; y++) {
        const syy = y < fh ? Math.min(f.h - 1, Math.floor(y / scy)) : f.h - 3;
        for (let x = 0; x < fw; x++) {
          const X = bx + x + dx0, Y = byy + y + dy0;
          if (X < 0 || X >= cw || Y < 0 || Y >= ch || Y < clipTop(X) || Y > clipBot(X)) continue;
          const sxx = Math.min(f.w - 1, Math.floor(x / scx)), si = syy * f.w + sxx;
          const v = f.px[si];
          if (pass === 0) { if (v >>> 24 > 127) buf[Y * cw + X] = shadow; }
          else if (pass === 1) { if (f.rim[si]) buf[Y * cw + X] = rimC; }
          else if (v >>> 24 > 127) buf[Y * cw + X] = impact ? (mood === 'burst' ? hx('#c8241e') : ink) : v;
        }
      }
    }
    // anime gloom when scared: a blue pall and vertical lines fall over the upper face
    if (mood === 'cold' && open > 0.5 && !impact) {
      const y0 = f.top + 14, y1 = 70, pall = hx('#2a2a78'), line = hx('#141040');
      for (let fy2 = y0; fy2 < y1; fy2++) {
        const k = 1 - (fy2 - y0) / (y1 - y0);
        for (let fx2 = 18; fx2 < f.w - 18; fx2++) {
          if (f.px[fy2 * f.w + fx2] >>> 24 < 128) continue;
          const X = bx + fx2, Y = byy + fy2;
          if (X < 0 || X >= cw || Y < 0 || Y >= ch || Y < clipTop(X)) continue;
          const i = Y * cw + X;
          const len = 0.25 + hash(fx2 >> 2, 4) * 0.6 + Math.sin(t * 3 + (fx2 >> 2)) * 0.05;
          const ln = (fx2 & 3) === 0 && k > 1 - len;
          buf[i] = mix(buf[i], ln ? line : pall, ln ? 0.75 : k * 0.5);
        }
      }
    }
    // happy sparkles also twinkle in front of the bust
    if (mood === 'happy' && open > 0.5 && !impact) for (let k = 0; k < 4; k++) {
      const ph = (t * 0.9 + hash(k, 21)) % 1;
      this.star(bx + 10 + Math.round(hash(k, 22, Math.floor(t * 0.9 + hash(k, 21))) * 96), byy + 10 + Math.round(hash(k, 23, Math.floor(t * 0.9 + hash(k, 21))) * 60), Math.sin(ph * Math.PI) * 3.2, hx('#ffffff'));
    }
    this.g.putImageData(this.img!, 0, 0);
    // name plate under the bust, riding the band's lower edge
    const nx = (this.bustX - 4 + Math.round(-exitP * 120)) * this.s;
    const ny = (mid - (this.bustX - cw * 0.3) * slant + half - 6) * this.s;
    this.np.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
  }

  /** 4-point twinkle star */
  private star(x: number, y: number, r: number, c: number) {
    const { buf, cw, ch } = this;
    const n = Math.round(r);
    if (n < 1) return;
    const put = (X: number, Y: number, k: number) => { if (X >= 0 && Y >= 0 && X < cw && Y < ch) buf[Y * cw + X] = k; };
    for (let d = -n; d <= n; d++) { put(x + d, y, c); put(x, y + d, c); }
    if (n >= 2) { put(x - 1, y - 1, c); put(x + 1, y - 1, c); put(x - 1, y + 1, c); put(x + 1, y + 1, c); }
  }

  private moodLayer(fx: number, fy: number, mid: number, half: number, slant: number, tk: number, sx: number) {
    const { buf, cw, ch, pal, mood, t } = this;
    const inBand = (x: number, y: number) => { const c = mid - (x - cw * 0.3) * slant; return y > c - half + 3 && y < c + half - 3; };
    const light = pal[0], accent = pal[3];
    const x0 = 0, x1 = cw;
    const yA = Math.max(0, Math.round(mid - half - cw * slant)), yB = Math.min(ch - 1, Math.round(mid + half + cw * slant));
    if (mood === 'burst') {
      // focus lines converging on the face; the set is redrawn on 12s
      const N = 120;
      for (let y = yA; y <= yB; y++) for (let x = x0; x < x1; x++) {
        if (!inBand(x, y)) continue;
        const dx = x - fx, dy = (y - fy) * 1.6, r = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 0.5) * N;
        const k = Math.floor(a), fr = a - k;
        const w = 0.18 + hash(k, 5, tk) * 0.32;
        const inner = 34 + hash(k, 6, tk) * 60;
        if (r > inner && Math.abs(fr - 0.5) < w * Math.min(1, (r - inner) / 40)) {
          const i = y * cw + x;
          buf[i] = hash(k, 7, tk) < 0.3 ? accent : mix(buf[i], light, 0.75);
        }
      }
    } else if (mood === 'happy') {
      // soft bokeh dots drifting up, and twinkles all over the band
      for (let k = 0; k < 16; k++) {
        const bxp = Math.round(hash(k, 11) * cw + Math.sin(t * 0.6 + k) * 6);
        const byp = Math.round(mid + half - ((t * (8 + hash(k, 12) * 10) + hash(k, 13) * 200) % (half * 2 + 20)));
        const r = 3 + Math.round(hash(k, 14) * 5);
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const X = bxp + x, Y = byp + y;
          if (X < 0 || Y < 0 || X >= cw || Y >= ch || !inBand(X, Y)) continue;
          const d = (x * x + y * y) / (r * r);
          if (d > 1 || dith(X, Y) < 0.55) continue;
          const i = Y * cw + X;
          buf[i] = mix(buf[i], accent, d > 0.7 ? 0.6 : 0.3);
        }
      }
      for (let k = 0; k < 14; k++) {
        const cyc = Math.floor(t * 0.8 + hash(k, 15));
        const ph = (t * 0.8 + hash(k, 15)) % 1;
        const X = Math.round(hash(k, 16, cyc) * cw), Y = Math.round(mid + (hash(k, 17, cyc) - 0.5) * half * 1.7);
        if (inBand(X, Y)) this.star(X, Y, Math.sin(ph * Math.PI) * (2 + hash(k, 18) * 2.5), hash(k, 19) < 0.5 ? accent : hx('#ffffff'));
      }
    } else if (mood === 'sad') {
      // slanted rain, darker at the top
      for (let k = 0; k < 90; k++) {
        const sp = 140 + hash(k, 31) * 80, len = 6 + Math.round(hash(k, 32) * 8);
        const span = half * 2 + 40;
        const yy = ((t * sp + hash(k, 33) * span) % span) + mid - half - 20;
        const xx = Math.round(hash(k, 34) * (cw + 40) - yy * 0.25);
        for (let j = 0; j < len; j++) {
          const X = Math.round(xx + (yy + j) * 0.25) - 10, Y = Math.round(yy + j);
          if (X < 0 || Y < 0 || X >= cw || Y >= ch || !inBand(X, Y)) continue;
          const i = Y * cw + X;
          buf[i] = mix(buf[i], accent, 0.25 + j / len * 0.35);
        }
      }
    } else if (mood === 'cold') {
      // a cold vignette closing in, and wavering vertical lines
      for (let y = yA; y <= yB; y++) for (let x = x0; x < x1; x++) {
        if (!inBand(x, y)) continue;
        const d = Math.hypot((x - fx) / (cw * 0.55), (y - fy) / (half * 1.4));
        const i = y * cw + x;
        if (d > 0.75 && dith(x, y) < (d - 0.75) * 1.3) buf[i] = mix(buf[i], hx('#04040c'), 0.7);
        else if ((x + Math.round(Math.sin(y * 0.2 + t * 4) * 1.5)) % 7 === 0 && d > 0.35) buf[i] = mix(buf[i], accent, 0.18);
      }
    } else {
      // speed lines streaming left past the bust (fast and bright for determined lines)
      const fast = mood === 'cool';
      const n = fast ? 34 : 18;
      for (let k = 0; k < n; k++) {
        const Y0 = Math.round(mid + (hash(k, 41) - 0.5) * half * 1.9);
        const len = (fast ? 30 : 18) + Math.round(hash(k, 42) * (fast ? 70 : 40));
        const sp = (fast ? 420 : 110) + hash(k, 43) * 120;
        const span = cw + len * 2;
        const X0 = Math.round(cw + len - ((t * sp + hash(k, 44) * span) % span));
        for (let j = 0; j < len; j++) {
          const X = X0 + j, Y = Y0 - Math.round((X - cw * 0.3) * slant) + Math.round((Y0 - mid) * 0) ;
          if (X < 0 || Y < 0 || X >= cw || Y >= ch || !inBand(X, Y)) continue;
          const i = Y * cw + X;
          buf[i] = mix(buf[i], j < 2 ? hx('#ffffff') : light, (fast ? 0.7 : 0.4) * (1 - j / len));
        }
      }
    }
    void sx;
  }
}
