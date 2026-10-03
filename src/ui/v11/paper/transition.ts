// Physical UI kit: scene transitions. Instead of a plain fade, the world is covered by
//   'ink'   : blots of ink bleeding out across the page (and clearing from new blots on the way in)
//   'page'  : a journal page sweeping across like a page being turned, captioned with where you're going
//   'iris'  : a hand-inked iris closing on Mori (and opening on him in the next scene)
//   'dissolve': the renderer's own dithered fade (cutscene fades keep using it)
//
// It runs on a canvas between the WebGL canvas and the DOM UI, driven by the same fade value as the
// renderer's fade (game.r.post.fade), so every existing fadeTo / go call works unchanged: game.go
// picks a style (setNextTransition overrides it once), the overlay draws while that fade runs, and
// the renderer's dissolve is switched off for its duration. Ink and iris draw at a quarter of the
// screen resolution and are scaled up crisp, so they match the pixel art.

import { fbm, rng, clamp01, hash2 } from './rng';
import { paperTileCanvas } from './textures';

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
    const k = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    cv.style.imageRendering = 'auto';
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
    if (iris) {
      // covered outside the circle (radius 1 - fade); an inked rim on the edge
      const rr = 1 - fade * 1.02;
      if (v > rr) { a = 1; dark = v < rr + edge * 1.6 ? 0.55 : 1; }
      else if (v > rr - edge) { a = 0.9; dark = 0.45; }
    } else if (phase === 'cover') {
      if (v < t) { a = 1; dark = t - v < edge ? 0.62 : 1; }
      else if (v < t + 0.025) a = clamp01(1 - (v - t) / 0.025) * (hash2(i, 0, seed) > 0.5 ? 0.85 : 0.3);
    } else {
      const u = 1 - t;
      if (v > u) { a = 1; dark = v - u < edge ? 0.62 : 1; }
      else if (v > u - 0.025) a = clamp01(1 - (u - v) / 0.025) * (hash2(i, 1, seed) > 0.5 ? 0.85 : 0.3);
    }
    const j = i * 4;
    // dark here means the wet edge: pigment pools darker at the rim of a blot
    P[j] = r * dark; P[j + 1] = gg * dark; P[j + 2] = b * dark; P[j + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
}

function drawPage(fade: number, color: [number, number, number]) {
  if (!g || !cv) return;
  void color;
  const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const e = fade < 1 ? fade * fade * (3 - 2 * fade) : 1;
  // the sheet's moving edge (tilted: the top corner leads), the curl width
  const curl = W * 0.07;
  const skew = W * 0.05;
  const span = W + skew * 2 + curl;
  // cover: the sheet's left edge sweeps in from the right; reveal: its right edge sweeps off to the left
  let x0: number, x1: number;
  if (phase === 'cover') { x0 = W + skew + curl - e * span; x1 = W + skew * 2 + curl; }
  else { x0 = -skew * 2 - curl; x1 = -skew - curl + e * span; }
  // the sheet: a polygon with the moving edge tilted
  g.save();
  g.beginPath();
  if (phase === 'cover') { g.moveTo(x0 - skew, 0); g.lineTo(x1, 0); g.lineTo(x1, H); g.lineTo(x0 + skew, H); }
  else { g.moveTo(x0, 0); g.lineTo(x1 + skew, 0); g.lineTo(x1 - skew, H); g.lineTo(x0, H); }
  g.closePath();
  // shadow cast on the scene by the lifted sheet
  g.shadowColor = 'rgba(10,6,2,0.45)';
  g.shadowBlur = W * 0.03;
  g.shadowOffsetX = phase === 'cover' ? -W * 0.012 : W * 0.012;
  const tile = paperTileCanvas('journal');
  const pat = g.createPattern(tile, 'repeat');
  g.fillStyle = pat ?? '#f1e5c8';
  g.fill();
  g.shadowColor = 'transparent';
  g.clip();
  // ruled lines and a margin, like Mori's journal
  const lh = Math.max(18, H / 26);
  g.fillStyle = 'rgba(80,120,170,0.18)';
  for (let y = lh * 3; y < H; y += lh) g.fillRect(0, Math.round(y), W, Math.max(1, H / 720));
  g.fillStyle = 'rgba(190,60,50,0.25)';
  g.fillRect(W * 0.1, 0, Math.max(1, W / 900), H);
  // the caption: where we're going
  if (opts.title && e > 0.35) {
    const a = clamp01((e - 0.35) / 0.3);
    g.globalAlpha = a;
    g.fillStyle = '#2a2440';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.round(Math.min(W / 11, H / 7));
    g.font = `600 ${fs}px Caveat, 'Segoe Print', cursive`;
    g.fillText(opts.title, W / 2, H * 0.46);
    if (opts.sub) { g.font = `500 ${Math.round(fs * 0.42)}px Caveat, 'Segoe Print', cursive`; g.fillStyle = '#5c574e'; g.fillText(opts.sub, W / 2, H * 0.46 + fs * 0.72); }
    // a hand-drawn underline
    const tw = Math.min(W * 0.6, g.measureText(opts.title).width + fs);
    g.strokeStyle = '#a8321e';
    g.lineWidth = Math.max(2, fs / 18);
    g.lineCap = 'round';
    g.beginPath();
    const uy = H * 0.46 + fs * (opts.sub ? 1.05 : 0.55);
    g.moveTo(W / 2 - tw / 2, uy + 3);
    g.quadraticCurveTo(W / 2, uy - 4, W / 2 + tw / 2, uy + 1);
    g.stroke();
    g.globalAlpha = 1;
  }
  // the curl along the moving (tilted) edge: a bright roll then shade, aligned with the edge
  const ex = phase === 'cover' ? x0 : x1;
  const len = Math.hypot(H, skew * 2);
  const ux = (phase === 'cover' ? H : -H) / len, uy = (phase === 'cover' ? -skew * 2 : -skew * 2) / len;
  const gr = g.createLinearGradient(ex, H / 2, ex + ux * curl, H / 2 + uy * curl);
  gr.addColorStop(0, 'rgba(60,40,15,0.35)');
  gr.addColorStop(0.18, 'rgba(255,250,235,0.55)');
  gr.addColorStop(0.45, 'rgba(255,250,235,0.12)');
  gr.addColorStop(1, 'rgba(60,40,15,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** the overlay's current style (for tests / the dev panel) */
export const transitionState = () => ({ style, phase });
