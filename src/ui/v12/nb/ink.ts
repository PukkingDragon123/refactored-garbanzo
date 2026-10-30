// V12 notebook: what Mori draws on the pages. Strokes are snapped to the page's pixel grid and kept
// as compact strings in the save (one per page id): a tool letter, the first point in two base-64
// digits per coordinate, then one digit per coordinate for each step (steps longer than 31 px are cut
// into shorter ones). Strokes are simplified (Ramer-Douglas-Peucker, half a pixel) when the pen
// lifts. A page's drawing is replayed into a byte layer (0 nothing, 1 pencil, 2 ink); the eraser
// clears a 5 x 5 square.

export type Tool = 'pencil' | 'pen' | 'eraser';
export interface InkStroke { tool: Tool; pts: number[] }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IDX = new Map([...B64].map((c, i) => [c, i]));
const TOOL_CH: Record<Tool, string> = { pencil: 'p', pen: 'i', eraser: 'e' };
const CH_TOOL: Record<string, Tool> = { p: 'pencil', i: 'pen', e: 'eraser' };
/** the most strokes a page keeps (the oldest are flattened away beyond this) */
export const MAX_STROKES = 600;

const d2 = (v: number) => B64[(v >> 6) & 63] + B64[v & 63];

export function encodeStroke(s: InkStroke): string {
  const p = s.pts;
  if (p.length < 2) return '';
  let out = TOOL_CH[s.tool] + d2(clampC(p[0])) + d2(clampC(p[1]));
  let x = clampC(p[0]), y = clampC(p[1]);
  for (let i = 2; i + 1 < p.length; i += 2) {
    const tx = clampC(p[i]), ty = clampC(p[i + 1]);
    if (tx === x && ty === y) continue;
    // cut long steps into ones that fit a digit (-31..31)
    const x0 = x, y0 = y, n = Math.max(1, Math.ceil(Math.max(Math.abs(tx - x0), Math.abs(ty - y0)) / 31));
    for (let k = 1; k <= n; k++) {
      const nx = x0 + Math.round(((tx - x0) * k) / n), ny = y0 + Math.round(((ty - y0) * k) / n);
      out += B64[nx - x + 31] + B64[ny - y + 31];
      x = nx; y = ny;
    }
  }
  return out;
}
const clampC = (v: number) => Math.max(0, Math.min(4095, Math.round(v)));

export function decodeStrokes(str: string | undefined): InkStroke[] {
  if (!str) return [];
  const out: InkStroke[] = [];
  for (const part of str.split(',')) {
    const tool = CH_TOOL[part[0]];
    if (!tool || part.length < 5) continue;
    const g = (i: number) => IDX.get(part[i]) ?? 0;
    let x = (g(1) << 6) | g(2), y = (g(3) << 6) | g(4);
    const pts = [x, y];
    for (let i = 5; i + 1 < part.length; i += 2) { x += g(i) - 31; y += g(i + 1) - 31; pts.push(x, y); }
    if (pts.length === 2) pts.push(x, y);
    out.push({ tool, pts });
  }
  return out;
}
export const encodeStrokes = (l: InkStroke[]) => l.map(encodeStroke).filter(Boolean).join(',');

/** drop points that sit within eps of the line through their neighbours */
export function simplify(pts: number[], eps = 0.5): number[] {
  const n = pts.length / 2;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i * 2 + 1]) - (ax - pts[i * 2]) * (by - ay)) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** the pixels of a polyline (Bresenham) */
export function linePixels(pts: number[], plot: (x: number, y: number) => void) {
  if (pts.length < 4) { if (pts.length >= 2) plot(Math.round(pts[0]), Math.round(pts[1])); return; }
  for (let i = 0; i + 3 < pts.length; i += 2) {
    let x0 = Math.round(pts[i]), y0 = Math.round(pts[i + 1]);
    const x1 = Math.round(pts[i + 2]), y1 = Math.round(pts[i + 3]);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

/** replay one stroke into a page layer (w x h bytes) */
export function rasterStroke(layer: Uint8Array, w: number, h: number, s: InkStroke) {
  const v = s.tool === 'pen' ? 2 : 1;
  linePixels(s.pts, (x, y) => {
    if (s.tool === 'eraser') {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < w && Y < h) layer[Y * w + X] = 0; }
      return;
    }
    if (x >= 0 && y >= 0 && x < w && y < h) layer[y * w + x] = v;
  });
}

export function layerOf(str: string | undefined, w: number, h: number): Uint8Array {
  const l = new Uint8Array(w * h);
  for (const s of decodeStrokes(str)) rasterStroke(l, w, h, s);
  return l;
}
