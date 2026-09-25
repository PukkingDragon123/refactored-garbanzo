// Packed-colour helpers for the software pixel painter.
// Colours are 0xAABBGGRR (little-endian RGBA byte order) so they can be written straight into
// a Uint32Array view of RGBA8 pixel data.

export type C = number;

export const rgba = (r: number, g: number, b: number, a = 255): C =>
  ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;

/** '#rrggbb' or 0xrrggbb -> packed */
export function hex(h: string | number, a = 255): C {
  const n = typeof h === 'number' ? h : parseInt(h.replace('#', ''), 16);
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

export const R = (c: C) => c & 255;
export const G = (c: C) => (c >>> 8) & 255;
export const B = (c: C) => (c >>> 16) & 255;
export const A = (c: C) => c >>> 24;

export const withAlpha = (c: C, a: number): C => ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0;

export function mix(a: C, b: C, t: number): C {
  const u = 1 - t;
  return rgba(R(a) * u + R(b) * t, G(a) * u + G(b) * t, B(a) * u + B(b) * t, A(a) * u + A(b) * t);
}

/** multiply rgb by k (keeps alpha) */
export function scale(c: C, k: number): C {
  return rgba(Math.min(255, R(c) * k), Math.min(255, G(c) * k), Math.min(255, B(c) * k), A(c));
}

export function toFloat(c: C): [number, number, number] {
  return [R(c) / 255, G(c) / 255, B(c) / 255];
}
export const hexf = (h: string | number): [number, number, number] => toFloat(hex(h));

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number, a = 255): C {
  h = ((h % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) {
    const v = l * 255;
    return rgba(v, v, v, a);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgba(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255, a);
}

/**
 * Hue-shifted shade: positive amt lightens toward warm highlights, negative darkens toward
 * cool shadows - the classic pixel-art ramp trick.
 */
export function shade(c: C, amt: number): C {
  const [h, s, l] = rgbToHsl(R(c), G(c), B(c));
  const warm = 0.12, cool = 0.62;
  const target = amt > 0 ? warm : cool;
  let dh = target - h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const k = Math.min(Math.abs(amt), 1);
  const nh = h + dh * 0.12 * k;
  const ns = s * (amt > 0 ? 1 - 0.15 * k : 1 + 0.1 * k);
  const nl = l + amt * (amt > 0 ? (1 - l) * 0.9 : l * 0.9);
  return hslToRgb(nh, ns, nl, A(c));
}

/** Build an n-step ramp around a base colour from darkest to lightest. */
export function ramp(base: C, n = 5, spread = 0.7): C[] {
  const out: C[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    out.push(shade(base, t * spread));
  }
  return out;
}

export const TRANSPARENT = 0;
