// V5 sprite tones. Every material is a 6-step hue-shifted ramp [outline, deep, shadow, base, light,
// highlight]: shadows slide toward cool violet, lights toward warm gold, the way hand-shaded pixel
// art is coloured. Shading picks clean bands from a light term so clusters stay readable.

import { C, hex, rgbToHsl, hslToRgb, R, G, B, mix, rgba } from '../color';

export type Ramp = [C, C, C, C, C, C];

const wrap = (h: number) => ((h % 1) + 1) % 1;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
function toward(h: number, target: number, k: number) {
  let d = target - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return wrap(h + d * k);
}

export interface RampOpts {
  /** hue the shadows slide toward (0..1): violet by default, red for skin */
  cool?: number;
  /** hue the lights slide toward */
  warm?: number;
  /** shadow depth multiplier */
  depth?: number;
  /** highlight lift multiplier */
  lift?: number;
  /** saturation multiplier for the whole ramp */
  sat?: number;
  /** how far the hue shifts (1 = default) */
  shift?: number;
}

export function ramp(base: string, o: RampOpts = {}): Ramp {
  const c = hex(base);
  const [h, s0, l] = rgbToHsl(R(c), G(c), B(c));
  const s = s0 * (o.sat ?? 1);
  const cool = o.cool ?? 0.72, warm = o.warm ?? 0.11, d = o.depth ?? 1, up = o.lift ?? 1, sh = o.shift ?? 1;
  const mk = (nl: number, hk: number, target: number, ds: number) => hslToRgb(toward(h, target, hk * sh), clamp01(s * ds), clamp01(nl));
  const deep = mk(l * (1 - 0.46 * d), 0.16, cool, 1.08);
  const shadow = mk(l * (1 - 0.24 * d), 0.08, cool, 1.05);
  const base5 = hslToRgb(h, s, l);
  const light = mk(l + (1 - l) * 0.2 * up, 0.05, warm, 0.94);
  const hi = mk(l + (1 - l) * 0.42 * up, 0.1, warm, 0.8);
  const outline = mix(mk(Math.min(0.13, l * 0.3), 0.2, cool, 0.7), INK, 0.45);
  return [outline, deep, shadow, base5, light, hi];
}

/** near-black ink for outlines */
export const INK = rgba(18, 11, 16);

/**
 * Pick a tone from a ramp. l is the light term (-1..1, from light3), bias darkens (far limbs) or
 * lifts. `hi` allows the highlight step (glossy things: hair, leather, metal).
 */
export function tn(r: Ramp, l: number, bias = 0, hi = false): C {
  const v = l + bias;
  if (hi && v > 0.7) return r[5];
  return v > 0.3 ? r[4] : v > -0.18 ? r[3] : v > -0.58 ? r[2] : r[1];
}

/** outline colour next to a pixel: near-black carrying a little of the neighbour's hue */
export function outlineOf(c: C): C {
  const [h, s, l] = rgbToHsl(R(c), G(c), B(c));
  return mix(hslToRgb(h, s * 0.6, Math.min(0.16, l * 0.3)), INK, 0.55);
}

/** cool dark targets for contact lines and cast shadows (RGB mixing keeps them muted) */
const LINE_INK = rgba(34, 22, 40);
const AO_INK = rgba(52, 36, 64);

/** interior contact line (a part's edge over another part): the local colour pushed toward ink */
export function lineOf(c: C, k: number): C {
  return mix(c, LINE_INK, Math.min(0.72, k * 1.25));
}

/** soft cast shadow on the pixel beneath an overlapping part */
export function aoOf(c: C, k: number): C {
  return mix(c, AO_INK, Math.min(0.6, k * 1.1));
}

export { hex, mix };
export type { C };
