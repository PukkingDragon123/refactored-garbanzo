// V11 hand-lettering: item names written on the specimen tags in Mori's marker, as pixel art. The text
// is set in a handwriting face (Caveat, from Google Fonts), rasterised small and snapped to whole
// pixels (no anti-aliasing) with a little ink bleed, so it reads as hand-placed pixels next to the
// rest of the art. Without the font (offline) it falls back to the UI's pixel face.

const FAMILY = 'Caveat';
const FALLBACK = "'Jersey 15', 'Pixelify Sans', monospace";
let loading: Promise<boolean> | null = null;
let ready = false, settled = false;
const waiting: (() => void)[] = [];

/** fetch the handwriting face once; resolves true when it can be used */
export function ensureHandFont(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      if (!document.querySelector('link[data-hand11]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap';
        l.dataset.hand11 = '1';
        document.head.appendChild(l);
      }
      const t = new Promise<boolean>(r => setTimeout(() => r(false), 2500));
      const f = (async () => { for (let i = 0; i < 25; i++) { try { const fs = await document.fonts.load(`700 20px ${FAMILY}`); if (fs.length) return true; } catch { /* */ } await new Promise(r => setTimeout(r, 120)); } return false; })();
      ready = await Promise.race([f, t]);
    } catch { ready = false; }
    settled = true;
    for (const w of waiting.splice(0)) { try { w(); } catch (e) { console.error(e); } }
    return ready;
  })();
  return loading;
}
/** call fn once the face is in (or given up on) */
export function onHandFont(fn: () => void) { if (settled) fn(); else waiting.push(fn); }
export const handReady = () => ready;

const cache = new Map<string, HTMLCanvasElement>();

export interface HandOpts {
  /** cap height-ish size in art pixels */
  px?: number;
  color?: string;
  /** a darker edge for weight */
  bleed?: string;
  /** wrap / shrink to this width (art px) */
  maxW?: number;
  /** slight upward slant, radians */
  tilt?: number;
}

/** the text hand-lettered as pixel art (1 canvas pixel per art pixel) */
export function handLetter(text: string, o: HandOpts = {}): HTMLCanvasElement {
  const px = o.px ?? 15, color = o.color ?? '#2a2414', bleed = o.bleed ?? '#5a4a2a', maxW = o.maxW ?? 200, tilt = o.tilt ?? -0.03;
  const key = [text, px, color, bleed, maxW, tilt, ready ? 1 : 0].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const font = ready ? `700 ${px * 1.45}px ${FAMILY}` : `${Math.round(px * 1.05)}px ${FALLBACK}`;
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = font;
  // wrap into at most two lines, shrinking if it still doesn't fit
  const words = text.split(/\s+/);
  let lines = [text];
  if (m.measureText(text).width > maxW && words.length > 1) {
    let best = 1;
    let bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const w = Math.max(m.measureText(a).width, m.measureText(b).width);
      if (w < bestW) { bestW = w; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const widest = Math.max(...lines.map(l => m.measureText(l).width));
  const k = widest > maxW ? maxW / widest : 1;
  const lh = Math.round(px * (ready ? 1.25 : 1.15) * k);
  const W = Math.ceil(Math.min(maxW, widest * k)) + 6, Hh = Math.ceil(lh * lines.length + px * 0.6) + 4;
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.font = ready ? `700 ${px * 1.45 * k}px ${FAMILY}` : `${Math.round(px * 1.05 * k)}px ${FALLBACK}`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff';
  g.save();
  g.translate(2, 0);
  g.rotate(tilt);
  lines.forEach((l, i) => g.fillText(l, 0, Math.round(lh * (i + 1) - lh * 0.12 + 1) + (i ? 0 : Math.abs(tilt) * W)));
  g.restore();
  // snap to whole pixels: solid ink where the coverage is high, bleed on the right / lower edges
  const id = g.getImageData(0, 0, W, Hh), d = id.data;
  const ink = hexRGB(color), bl = hexRGB(bleed);
  const on = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) on[i] = d[i * 4 + 3] > 118 ? 1 : 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4;
    if (on[i]) { d[p] = ink[0]; d[p + 1] = ink[1]; d[p + 2] = ink[2]; d[p + 3] = 255; continue; }
    const nb = (x > 0 && on[i - 1]) || (y > 0 && on[i - W]);
    if (nb && d[p + 3] > 40) { d[p] = bl[0]; d[p + 1] = bl[1]; d[p + 2] = bl[2]; d[p + 3] = 255; }
    else d[p + 3] = 0;
  }
  g.putImageData(id, 0, 0);
  cache.set(key, c);
  return c;
}

function hexRGB(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
