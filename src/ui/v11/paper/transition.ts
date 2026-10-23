// Physical UI kit: scene transitions. Instead of a plain fade, the world is covered by
//   'ink'   : blots of ink bleeding out across the page (and clearing from new blots on the way in)
//   'page'  : a journal page sweeping across like a page being turned, captioned with where you're going
//   'iris'  : a hand-inked iris closing on Mori (and opening on him in the next scene)
//   'dissolve': the renderer's own dithered fade (cutscene fades keep using it)
//
// It runs on a canvas between the WebGL canvas and the DOM UI, driven by the same fade value as the
// renderer's fade (game.r.post.fade), so every existing fadeTo / go call works unchanged: game.go
// picks a style (setNextTransition overrides it once), the overlay draws while that fade runs, and
// the renderer's dissolve is switched off for its duration. Everything is pixel art: ink and iris
// are threshold fields at a quarter of the screen resolution with dithered (never soft) edges, and
// the page is painted at the UI's art resolution with a stepped edge, a dithered curl and shadow,
// ruled lines and the destination written in Mori's pixel hand.

import { fbm, rng, hash2 } from './rng';
import { paperTileArt } from './textures';
import { Art, PX, col, dith, bayer, mixC } from './px';
import { drawText, textWidth } from './pxfont';
import { rasterStrokes, underline } from './ink';

export type TransitionStyle = 'dissolve' | 'ink' | 'page' | 'iris';
export interface TransitionOpts {
  /** caption on the page wipe ('Fernwood Floor') */
  title?: string;
  sub?: string;
  /** screen point (0..1) the iris / first ink blot centres on (default: Mori, else the centre) */
  focus?: [number, number];
}

let nextOne: { style: TransitionStyle; o: TransitionOpts } | null = null;
/** the next scene change (game.go) uses this style once */
export function setNextTransition(style: TransitionStyle, o: TransitionOpts = {}) { nextOne = { style, o }; }
/** the default style for scene changes without an override */
export let defaultTransition: TransitionStyle = 'ink';
export function setDefaultTransition(s: TransitionStyle) { defaultTransition = s; }

let cv: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let style: TransitionStyle = 'dissolve';
let opts: TransitionOpts = {};
let last = 0;
let phase: 'idle' | 'cover' | 'reveal' = 'idle';
let field: Float32Array | null = null;
let fw = 0, fh = 0;
let img: ImageData | null = null;
let seed = 1;
/** a function the scene can give for where Mori is on screen (0..1) */
let focusFn: (() => [number, number] | null) | null = null;
export function setTransitionFocus(fn: (() => [number, number] | null) | null) { focusFn = fn; }

/** called by game.go: pick the style for the fade that is about to run */
export function beginTransition(o?: { style?: TransitionStyle } & TransitionOpts) {
  const pick = nextOne ?? { style: o?.style ?? defaultTransition, o: o ?? {} };
  nextOne = null;
  // never switch styles halfway through a fade
  if (phase !== 'idle') return;
  style = pick.style;
  opts = pick.o;
  if (style !== 'dissolve') ensureCanvas();
}

function ensureCanvas() {
  if (cv) return;
  const ui = document.getElementById('ui');
  if (!ui?.parentElement) return;
  cv = document.createElement('canvas');
  cv.className = 'pp-trans';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;image-rendering:pixelated';
  ui.parentElement.insertBefore(cv, ui);
  g = cv.getContext('2d');
}

const focusNow = (): [number, number] => opts.focus ?? focusFn?.() ?? [0.5, 0.55];

/**
 * Every frame from the game loop with the fade value. Draws the overlay when a non-dissolve
 * transition is running and returns the fade the renderer should still apply itself (0 while the
 * overlay covers for it).
 */
export function transitionFrame(fade: number, color: [number, number, number]): number {
  if (style === 'dissolve' || !cv || !g) { phase = 'idle'; return fade; }
  if (fade <= 0.0005) {
    // back to clear: the transition is over, cutscene fades go back to the dissolve
    if (phase !== 'idle') { cv.style.display = 'none'; phase = 'idle'; style = 'dissolve'; field = null; }
    last = 0;
    return 0;
  }
  if (phase === 'idle' || (phase === 'reveal' && fade > last + 1e-4)) startPhase('cover');
  else if (phase === 'cover' && fade < last - 1e-4) startPhase('reveal');
  last = fade;
  cv.style.display = '';
  if (style === 'page') drawPage(fade, color);
  else drawField(fade, color);
  return 0;
}

function startPhase(p: 'cover' | 'reveal') {
  phase = p;
  seed = (seed * 1103515245 + 12345) >>> 0;
  if (!cv) return;
  const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
  if (style === 'page') {
    cv.width = Math.max(32, Math.round(W / PX)); cv.height = Math.max(24, Math.round(H / PX));
    cv.style.imageRendering = 'pixelated';
    sheet = null;
    return;
  }
  // ink and iris: a threshold field at a quarter resolution
  fw = Math.max(32, Math.round(W / 4)); fh = Math.max(24, Math.round(H / 4));
  cv.width = fw; cv.height = fh;
  cv.style.imageRendering = 'pixelated';
  img = g!.createImageData(fw, fh);
  field = style === 'iris' ? irisField() : inkField();
}

function inkField(): Float32Array {
  const F = new Float32Array(fw * fh);
  const R = rng(seed);
  const [fx, fy] = focusNow();
  const n = 5 + Math.floor(R() * 4);
  const blots: { x: number; y: number; r: number; drip: number }[] = [];
  for (let i = 0; i < n; i++) {
    const near = i === 0;
    blots.push({
      x: (near ? fx + (R() - 0.5) * 0.08 : R()) * fw,
      y: (near ? fy + (R() - 0.5) * 0.08 : R() * 0.9) * fh,
      r: (near ? 0.55 : 0.28 + R() * 0.4) * Math.hypot(fw, fh) * 0.5,
      drip: R() < 0.55 ? 0.6 + R() * 0.8 : 0,
    });
  }
  let mn = Infinity, mx = -Infinity;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    let v = Infinity;
    for (const b of blots) {
      let d = Math.hypot(x - b.x, (y - b.y) * 1.1) / b.r;
      // ink runs downhill: a thin drip below some blots
      if (b.drip && y > b.y) {
        const col = Math.abs(x - b.x - Math.sin(y * 0.15 + b.x) * 2) / (b.r * 0.06);
        if (col < 1) d = Math.min(d, (y - b.y) / (b.r * (1.6 + b.drip)) + col * 0.25);
      }
      if (d < v) v = d;
    }
    v += (fbm(x / 7, y / 7, seed & 1023, 3) - 0.5) * 0.42 + (hash2(x, y, seed) - 0.5) * 0.05;
    F[y * fw + x] = v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const k = 1 / Math.max(1e-6, mx - mn);
  for (let i = 0; i < F.length; i++) F[i] = (F[i] - mn) * k;
  return F;
}

function irisField(): Float32Array {
  const F = new Float32Array(fw * fh);
  const [fx, fy] = focusNow();
  const cx = fx * fw, cy = fy * fh;
  const far = Math.max(Math.hypot(cx, cy), Math.hypot(fw - cx, cy), Math.hypot(cx, fh - cy), Math.hypot(fw - cx, fh - cy));
  const ph = (seed % 628) / 100;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const dx = x - cx, dy = y - cy;
    const a = Math.atan2(dy, dx);
    // a hand-cut iris: the edge wobbles a little round the circle
    const wob = 1 + Math.sin(a * 5 + ph) * 0.025 + Math.sin(a * 11 - ph * 2) * 0.012;
    F[y * fw + x] = Math.hypot(dx, dy) / (far * wob);
  }
  return F;
}

function inkColor(c: [number, number, number]): [number, number, number] {
  const s = c[0] + c[1] + c[2];
  // a black fade becomes blue-black ink; coloured fades (the reef's blue-green) keep their colour
  if (s < 0.2) return [18, 15, 30];
  return [c[0] * 255, c[1] * 255, c[2] * 255];
}

function drawField(fade: number, color: [number, number, number]) {
  if (!field || !img || !g) return;
  const P = img.data;
  const [r, gg, b] = inkColor(color);
  const iris = style === 'iris';
  // the threshold: cover = everything under t; reveal clears from the low end of a new field
  const t = fade * 1.06;
  const edge = iris ? 0.012 : 0.035;
  for (let i = 0, n = field.length; i < n; i++) {
    const v = field[i];
    let a = 0, dark = 1;
    const x = i % fw, y = (i / fw) | 0;
    if (iris) {
      // covered outside the circle (radius 1 - fade); an inked rim on the edge, a dithered fringe
      const rr = 1 - fade * 1.02;
      if (v > rr) { a = 1; dark = v < rr + edge * 1.6 ? 0.55 : 1; }
      else if (v > rr - edge) { a = 1; dark = 0.45; }
      else if (v > rr - edge * 2.2 && dith(x, y, 0.5)) { a = 1; dark = 0.45; }
    } else if (phase === 'cover') {
      if (v < t) { a = 1; dark = t - v < edge ? 0.62 : 1; }
      else if (v < t + 0.025 && dith(x, y, (1 - (v - t) / 0.025) * (hash2(i, 0, seed) > 0.5 ? 0.9 : 0.4))) a = 1;
    } else {
      const u = 1 - t;
      if (v > u) { a = 1; dark = v - u < edge ? 0.62 : 1; }
      else if (v > u - 0.025 && dith(x, y, (1 - (u - v) / 0.025) * (hash2(i, 1, seed) > 0.5 ? 0.9 : 0.4))) a = 1;
    }
    const j = i * 4;
    // dark here means the wet edge: pigment pools darker at the rim of a blot
    P[j] = r * dark; P[j + 1] = gg * dark; P[j + 2] = b * dark; P[j + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
}

/** the journal page that sweeps across, painted once per phase at art resolution */
let sheet: HTMLCanvasElement | null = null;
function paintSheetCanvas(W: number, H: number): HTMLCanvasElement {
  const a = new Art(W, H);
  const tile = paperTileArt('journal');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a.put(x, y, tile.d[(y % 128) * 128 + (x % 128)]);
  // ruled lines and a red margin, like Mori's journal
  const lh = Math.max(9, Math.round(H / 26));
  const rule = col('#5078aa'), marg = col('#c0463a');
  for (let y = lh * 3; y < H; y += lh) for (let x = 0; x < W; x++) if (dith(x, y, 0.45)) a.put(x, y, mixC(a.get(x, y), rule, 0.35));
  const mx = Math.round(W * 0.1);
  for (let y = 0; y < H; y++) a.put(mx, y, mixC(a.get(mx, y), marg, 0.4));
  // the caption: where we're going, in Mori's hand
  if (opts.title) {
    const ink = col('#2a2440'), pencil = col('#5c574e');
    const t1 = textWidth(opts.title);
    const k = Math.max(2, Math.min(7, Math.floor(Math.min((W * 0.7) / Math.max(1, t1), H / 7 / 9))));
    const tw = textWidth(opts.title, { scale: k });
    const by = Math.round(H * 0.46 + 3.5 * k);
    drawText(a, opts.title, Math.round(W / 2 - tw / 2), by, ink, { scale: k });
    let uy = by + 2 * k + 2;
    if (opts.sub) {
      const k2 = Math.max(1, Math.round(k * 0.45));
      const sw = textWidth(opts.sub, { scale: k2 });
      drawText(a, opts.sub, Math.round(W / 2 - sw / 2), by + 11 * k2 + 2 * k, pencil, { scale: k2 });
      uy = by + 11 * k2 + 2 * k + 3 * k2;
    }
    // a hand-drawn red underline
    const uw = Math.min(W * 0.62, tw + 4 * k);
    const ua = new Art(Math.round(uw), Math.max(4, k + 3));
    rasterStrokes(ua, 100, 6, [{ d: underline(100, { seed: opts.title.length }), c: '#a8321e', w: 1.6 + k * 0.4 }], true);
    a.blit(ua, Math.round(W / 2 - uw / 2), Math.round(uy));
  }
  return a.canvas();
}

const PAT = new Map<string, CanvasPattern | null>();
function pat(gx: CanvasRenderingContext2D, rgba: string, cov: number): CanvasPattern | null {
  const lv = Math.max(1, Math.min(16, Math.round(cov * 16)));
  const k = rgba + lv;
  let p = PAT.get(k);
  if (p === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = rgba;
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (lv / 16 > bayer(xx, yy)) x.fillRect(xx, yy, 1, 1);
    p = gx.createPattern(c, 'repeat');
    PAT.set(k, p);
  }
  return p;
}

function drawPage(fade: number, color: [number, number, number]) {
  if (!g || !cv) return;
  void color;
  const W = cv.width, H = cv.height;
  if (!sheet) sheet = paintSheetCanvas(W, H);
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  const e = fade < 1 ? fade * fade * (3 - 2 * fade) : 1;
  // the sheet's moving edge leans (the top corner leads); it moves in whole art pixels
  const curl = Math.round(W * 0.06), skew = Math.round(W * 0.05);
  const span = W + skew * 2 + curl;
  const cover = phase === 'cover';
  const lead = cover ? Math.round(W + skew + curl - e * span) : Math.round(-skew - curl + e * span);
  const edgeAt = (y: number) => Math.round(lead + (cover ? -skew : skew) * (1 - (2 * y) / H));
  const sh1 = pat(g, 'rgba(10,6,2,0.55)', 0.5), sh2 = pat(g, 'rgba(10,6,2,0.55)', 0.25);
  const hi = pat(g, 'rgba(255,251,236,0.9)', 0.55), lo = pat(g, 'rgba(60,40,15,0.85)', 0.4);
  const cw1 = Math.max(1, Math.round(curl * 0.3)), cw2 = Math.max(1, Math.round(curl * 0.35));
  for (let y = 0; y < H; y++) {
    const ex = edgeAt(y);
    if (cover) {
      // the sheet from the edge rightwards; its shadow on the scene to the left; the curl at the edge
      const x0 = Math.max(0, ex);
      if (x0 < W) g.drawImage(sheet, x0, y, W - x0, 1, x0, y, W - x0, 1);
      if (sh1) { g.fillStyle = sh1; g.fillRect(ex - 4, y, 4, 1); }
      if (sh2) { g.fillStyle = sh2; g.fillRect(ex - 9, y, 5, 1); }
      if (hi) { g.fillStyle = hi; g.fillRect(ex + 1, y, cw1, 1); }
      if (lo) { g.fillStyle = lo; g.fillRect(ex + 1 + cw1, y, cw2, 1); }
      g.fillStyle = 'rgba(40,24,6,0.7)'; g.fillRect(ex, y, 1, 1);
    } else {
      // the reveal: the sheet's right edge sweeps off to the left
      const x1 = Math.min(W, ex);
      if (x1 > 0) g.drawImage(sheet, 0, y, x1, 1, 0, y, x1, 1);
      if (sh1) { g.fillStyle = sh1; g.fillRect(ex, y, 4, 1); }
      if (sh2) { g.fillStyle = sh2; g.fillRect(ex + 4, y, 5, 1); }
      if (hi) { g.fillStyle = hi; g.fillRect(ex - 1 - cw1, y, cw1, 1); }
      if (lo) { g.fillStyle = lo; g.fillRect(ex - 1 - cw1 - cw2, y, cw2, 1); }
      g.fillStyle = 'rgba(40,24,6,0.7)'; g.fillRect(ex - 1, y, 1, 1);
    }
  }
}

/** the overlay's current style (for tests / the dev panel) */
export const transitionState = () => ({ style, phase });
