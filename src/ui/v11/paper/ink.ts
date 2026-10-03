// Physical UI kit: ink and pencil, drawn by hand. Rough SVG paths that wobble like a real pen line
// (lines, boxes, circles, arrows, underlines, ticks, crosses, scribbles, tally marks), an inline-SVG
// builder that can "draw itself" on (stroke-dash animation), and the shared SVG filters (pencil grain,
// ink bleed) that make strokes look like graphite and wet ink rather than vectors.
//
// All coordinates are in the SVG's own viewBox units; every path is deterministic for its seed.

import { rng } from './rng';

export interface RoughOpts {
  /** wobble amount in units (default 1.2) */
  rough?: number;
  /** curvature of long strokes (default 1) */
  bow?: number;
  seed?: number;
  /** draw the stroke twice, slightly apart, like a quick pen pass (default true) */
  double?: boolean;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** a hand-drawn straight line (a gently bowed cubic with jittered ends), as path data */
export function roughLine(x1: number, y1: number, x2: number, y2: number, o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 97 + Math.round(x1 * 7 + y1 * 13 + x2 * 17 + y2 * 19));
  const rough = o.rough ?? 1.2, bow = o.bow ?? 1;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const pass = (k: number) => {
    const j = () => (R() - 0.5) * rough * 2 * k;
    const b = (R() - 0.5) * Math.min(len * 0.04, 6) * bow * k;
    const ax = x1 + j(), ay = y1 + j(), bx = x2 + j(), by = y2 + j();
    const c1x = x1 + (x2 - x1) * 0.3 + nx * b + j() * 0.6, c1y = y1 + (y2 - y1) * 0.3 + ny * b + j() * 0.6;
    const c2x = x1 + (x2 - x1) * 0.7 + nx * b * 0.8 + j() * 0.6, c2y = y1 + (y2 - y1) * 0.7 + ny * b * 0.8 + j() * 0.6;
    return `M${f1(ax)} ${f1(ay)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(bx)} ${f1(by)}`;
  };
  return o.double === false ? pass(1) : pass(1) + pass(0.7);
}

/** a hand-drawn rectangle: four rough lines that overshoot the corners a little */
export function roughRect(x: number, y: number, w: number, h: number, o: RoughOpts = {}): string {
  const s = o.seed ?? 1, ov = Math.min(3, Math.min(w, h) * 0.08);
  const one = { ...o, double: o.double ?? false };
  return roughLine(x - ov * 0.5, y, x + w + ov, y + 0.4, { ...one, seed: s })
    + roughLine(x + w, y - ov * 0.5, x + w - 0.3, y + h + ov, { ...one, seed: s + 1 })
    + roughLine(x + w + ov * 0.5, y + h, x - ov, y + h - 0.4, { ...one, seed: s + 2 })
    + roughLine(x, y + h + ov * 0.5, x + 0.3, y - ov, { ...one, seed: s + 3 });
}

/** a hand-drawn ellipse that doesn't quite close (the pen overlaps where it started) */
export function roughEllipse(cx: number, cy: number, rx: number, ry: number, o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 131 + Math.round(cx + cy * 3));
  const rough = o.rough ?? 1.2;
  const pass = (k: number, a0: number) => {
    const n = 18, over = 0.12 + R() * 0.18;
    let d = '';
    const tilt = (R() - 0.5) * 0.08;
    for (let i = 0; i <= n; i++) {
      const t = a0 + (i / n) * (Math.PI * 2 * (1 + over));
      const wob = 1 + (R() - 0.5) * 0.06 * rough * k + Math.sin(t * 2 + a0) * 0.02;
      const x = cx + Math.cos(t + tilt) * rx * wob, y = cy + Math.sin(t + tilt) * ry * wob;
      d += i === 0 ? `M${f1(x)} ${f1(y)}` : `L${f1(x)} ${f1(y)}`;
    }
    return d;
  };
  const a0 = -Math.PI * 0.6 + R() * 0.5;
  return o.double === false ? pass(1, a0) : pass(1, a0) + pass(0.6, a0 + 0.4);
}

/** a smooth hand-drawn curve through points (Catmull-Rom), with a little jitter */
export function roughCurve(pts: [number, number][], o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 211);
  const rough = o.rough ?? 0.8;
  const p = pts.map(([x, y]) => [x + (R() - 0.5) * rough, y + (R() - 0.5) * rough] as [number, number]);
  if (p.length < 2) return '';
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

/**
 * A hand-drawn arrow from (x1,y1) to (x2,y2), curving by `bend` (fraction of its length, + = left),
 * with a two-stroke head. Returns [shaft, head] path data.
 */
export function roughArrow(x1: number, y1: number, x2: number, y2: number, bend = 0.15, o: RoughOpts = {}): [string, string] {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const mx = (x1 + x2) / 2 + nx * len * bend, my = (y1 + y2) / 2 + ny * len * bend;
  const shaft = roughCurve([[x1, y1], [mx, my], [x2, y2]], { ...o, rough: o.rough ?? 0.6 });
  // the head follows the curve's end tangent
  const tx = x2 - mx, ty = y2 - my, tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl, uy = ty / tl, hs = Math.min(10, len * 0.28);
  const a = 0.5;
  const hx1 = x2 - (ux * Math.cos(a) - uy * Math.sin(a)) * hs, hy1 = y2 - (uy * Math.cos(a) + ux * Math.sin(a)) * hs;
  const hx2 = x2 - (ux * Math.cos(-a) - uy * Math.sin(-a)) * hs, hy2 = y2 - (uy * Math.cos(-a) + ux * Math.sin(-a)) * hs;
  const head = roughLine(hx1, hy1, x2, y2, { ...o, double: false, rough: 0.5 }) + roughLine(x2, y2, hx2, hy2, { ...o, double: false, rough: 0.5, seed: (o.seed ?? 1) + 5 });
  return [shaft, head];
}

/** a quick wavy underline `w` long */
export function underline(w: number, o: RoughOpts & { waves?: number } = {}): string {
  const R = rng((o.seed ?? 1) * 59);
  const n = Math.max(3, Math.round(w / 18));
  const amp = 0.9 + (o.rough ?? 1) * 0.6;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w, 3 + Math.sin(i * 1.7 + R() * 2) * amp * (o.waves ?? 1) + (i / n) * (R() - 0.3) * 2]);
  return roughCurve(pts, { ...o, rough: 0.4 });
}

/** an ink tick (check mark) in a size x size box */
export function tick(size = 20, seed = 1): string {
  const R = rng(seed * 71);
  const s = size;
  return roughCurve([[s * 0.12, s * (0.52 + R() * 0.06)], [s * 0.3, s * 0.68], [s * (0.42 + R() * 0.04), s * 0.86], [s * 0.62, s * 0.5], [s * (0.9 + R() * 0.12), s * (0.06 + R() * 0.06)]], { seed, rough: 0.6 });
}
/** an ink cross */
export function cross(size = 20, seed = 1): string {
  const s = size;
  return roughLine(s * 0.15, s * 0.15, s * 0.85, s * 0.85, { seed, double: false, rough: 0.8 }) + roughLine(s * 0.85, s * 0.12, s * 0.15, s * 0.88, { seed: seed + 3, double: false, rough: 0.8 });
}
/** a zigzag scribble over a w x h area (crossing out, shading in, "redacted") */
export function scribble(w: number, h: number, seed = 1, rows = 0): string {
  const R = rng(seed * 43);
  const n = rows || Math.max(3, Math.round(w / 7));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w + (R() - 0.5) * 2, i % 2 ? h * (0.8 + R() * 0.2) : h * (R() * 0.2)]);
  return roughCurve(pts, { seed, rough: 0.5 });
}
/** a strike-through line w long (slightly rising, like crossing a line out with one pen stroke) */
export function strike(w: number, seed = 1): string {
  const R = rng(seed * 13);
  return roughCurve([[-2, 2 + R() * 2], [w * 0.4, 1 + R() * 2], [w + 2, R() * 2]], { seed, rough: 0.5 });
}
/** tally marks for n (groups of five with a diagonal), drawn in a box of h height */
export function tally(n: number, h = 16, seed = 1): { d: string; w: number } {
  const R = rng(seed * 29);
  let d = '';
  let x = 2;
  for (let i = 0; i < n; i++) {
    const inGroup = i % 5;
    if (inGroup === 4) {
      d += roughLine(x - 4 * 4.5 - 1, h * 0.75, x + 1, h * 0.25, { seed: seed + i, double: false, rough: 0.6 });
      x += 6;
      continue;
    }
    d += roughLine(x + (R() - 0.5), h * 0.08, x + (R() - 0.5) * 1.5, h * 0.92, { seed: seed + i, double: false, rough: 0.5 });
    x += 4.5;
  }
  return { d, w: x + 2 };
}

// ---------------------------------------------------------------- inline SVG

export interface Stroke {
  d: string;
  /** stroke colour (default ink) */
  c?: string;
  /** stroke width in viewBox units */
  w?: number;
  fill?: string;
  /** 'pencil' grain or 'ink' bleed filter */
  tex?: 'pencil' | 'ink' | 'none';
  /** animate drawing on (seconds; 0 = drawn already) */
  draw?: number;
  delay?: number;
  opacity?: number;
}

export const INK = '#2a2440';
export const INK_BLUE = '#26408a';
export const INK_RED = '#a8321e';
export const PENCIL = '#5c574e';
export const INK_GREEN = '#2f6b3a';

/** an inline SVG of hand-drawn strokes; size in CSS (e.g. '100%' or '3em') */
export function svgInk(vw: number, vh: number, strokes: Stroke[], o: { cls?: string; w?: string; h?: string; style?: string; stretch?: boolean } = {}): string {
  ensureDefs();
  const body = strokes.map(s => {
    const anim = s.draw ? ` pathLength="1" class="pp-draw" style="animation-duration:${s.draw}s;animation-delay:${s.delay ?? 0}s"` : '';
    const filt = s.tex === 'pencil' ? ' filter="url(#pp-pencil)"' : s.tex === 'ink' ? ' filter="url(#pp-ink)"' : '';
    return `<path d="${s.d}" fill="${s.fill ?? 'none'}" stroke="${s.c ?? INK}" stroke-width="${s.w ?? 1.6}" stroke-linecap="round" stroke-linejoin="round"${s.opacity !== undefined ? ` opacity="${s.opacity}"` : ''}${filt}${anim}/>`;
  }).join('');
  const size = `${o.w ? ` width="${o.w}"` : ''}${o.h ? ` height="${o.h}"` : ''}`;
  return `<svg class="pp-svg ${o.cls ?? ''}" viewBox="0 0 ${vw} ${vh}"${size}${o.stretch ? ' preserveAspectRatio="none"' : ''}${o.style ? ` style="${o.style}"` : ''} aria-hidden="true">${body}</svg>`;
}

let defs = false;
/** the shared SVG filters: graphite grain for pencil strokes, a soft bleed for wet ink */
export function ensureDefs() {
  if (defs || typeof document === 'undefined') return;
  defs = true;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>
    <filter id="pp-pencil" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.25" result="holes"/>
      <feComposite in="SourceGraphic" in2="holes" operator="in" result="grain"/>
      <feDisplacementMap in="grain" in2="n" scale="0.9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="pp-ink" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="8" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="0.25" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="d"/></feMerge>
    </filter>
    <filter id="pp-rough-edge">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="2" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="pp-stamp" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="11" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.7" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in"/>
    </filter>
  </defs></svg>`;
  document.body.appendChild(d);
}
