// V11 Te Wao Nui art kit: the forest's palette ramps (cool teal shadows, warm moss-gold highlights,
// misty blue-green air), wrapped pixel writes for tileable strips, a premultiplied blur for the
// out-of-focus foreground, and small shared painters.

import { PixelBuffer } from '../../pixel';
import { C, hex, mix, rgba, R, G, B, A } from '../../color';
import { clamp } from '../../../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));

/** forest ramps, dark -> light */
export const FP = {
  /** the misty air between the giants (sunlit haze .. deep shade) */
  air: r('#16302e', '#1f403b', '#2b5249', '#3a6658', '#4d7b68', '#64907a', '#7ea58d', '#9cbba2', '#bdd1b8', '#dce6cf'),
  /** kauri bark: grey, smooth, hammered with flakes */
  kauri: r('#141819', '#1d2324', '#272e2e', '#323a39', '#3f4845', '#4e5852', '#606a61', '#757e71', '#8d9483', '#a8ad99', '#c4c7b2'),
  /** podocarp bark (rimu, tōtara, kahikatea): red-brown, stringy */
  podo: r('#160e0b', '#22150f', '#2f1d15', '#3e271b', '#4f3222', '#623f2b', '#764e36', '#8b5f43', '#a37453', '#bb8c68'),
  /** rātā: dark, gnarled, grey-brown */
  rata: r('#120f0d', '#1c1714', '#28201b', '#352b24', '#43372e', '#53453a', '#655648', '#7a6858', '#917d6b'),
  moss: r('#0f1a0b', '#17270f', '#213814', '#2d4b18', '#3a601c', '#4a7520', '#5d8b27', '#73a131', '#8fb83f', '#b1cf5c', '#d4e486'),
  /** sunlit moss / backlit leaves */
  lime: r('#24380f', '#345012', '#476a16', '#5e861c', '#78a324', '#94bd33', '#b2d34c', '#cfe46f', '#e8f29e'),
  fern: r('#08170f', '#0d2416', '#14361e', '#1c4b26', '#25622e', '#317a36', '#40933d', '#56ab47', '#73c157', '#9ad46f', '#c6e695'),
  /** canopy leaves seen from below (dark, cool) */
  canopy: r('#061113', '#0a1b1c', '#0f2725', '#15352e', '#1c4436', '#25553e', '#2f6745', '#3d7a4b', '#538f52', '#71a65b'),
  soil: r('#0d0907', '#160f0b', '#20160f', '#2b1d14', '#37261a', '#453020', '#553b27', '#67482f', '#7a5739'),
  litter: r('#2b1a0d', '#432812', '#5d3816', '#78491c', '#925c24', '#aa712f', '#c08a42', '#d3a55d'),
  mud: r('#0e0a08', '#17110d', '#211912', '#2c2118', '#382a1e', '#453325', '#543e2d', '#644a36'),
  water: r('#0f2a2c', '#143536', '#1a4242', '#22514e', '#2d605a', '#3b7168', '#4e8478', '#669889', '#84ae9e', '#a8c6b6'),
  stone: r('#15181a', '#1e2224', '#282d2f', '#333a3b', '#404848', '#4f5856', '#616a66', '#767e78', '#8d948b', '#a8ad9f'),
  lichen: r('#47554b', '#66766a', '#879686', '#a8b5a1', '#c8d2bc', '#e2e8d5'),
  red: r('#3a0a0a', '#5c0f10', '#841816', '#ab231c', '#cf3424', '#ea4f30', '#fb7547', '#ffa071'),
};

/** set a pixel with horizontal wrap (tileable strips) */
export function ws(buf: PixelBuffer, x: number, y: number, c: C) {
  const yy = Math.floor(y);
  if (yy < 0 || yy >= buf.h) return;
  const w = buf.w;
  const xx = ((Math.floor(x) % w) + w) % w;
  buf.data[yy * w + xx] = c;
}
/** read a pixel with horizontal wrap */
export function wg(buf: PixelBuffer, x: number, y: number): C {
  const yy = Math.floor(y);
  if (yy < 0 || yy >= buf.h) return 0;
  const w = buf.w;
  return buf.data[yy * w + (((Math.floor(x) % w) + w) % w)];
}

export const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];

/** mix a whole ramp toward a colour */
export const hazeRamp = (rp: C[], fog: C, k: number) => rp.map(c => mix(c, fog, k));

/**
 * Soft-focus blur (premultiplied, separable box passes: radius r, n passes ~ gaussian) so the
 * out-of-focus foreground has no hard sprite edges; `wrap` for tileable strips.
 */
export function blurBuf(src: PixelBuffer, rad: number, passes = 2, wrap = false): PixelBuffer {
  const w = src.w, h = src.h, n = w * h;
  const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n), pa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = src.data[i], a = A(c) / 255;
    pa[i] = a; pr[i] = R(c) * a; pg[i] = G(c) * a; pb[i] = B(c) * a;
  }
  const tr = new Float32Array(n), tg = new Float32Array(n), tb = new Float32Array(n), ta = new Float32Array(n);
  const k = 1 / (2 * rad + 1);
  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let i = -rad; i <= rad; i++) {
        const x = wrap ? ((i % w) + w) % w : clamp(i, 0, w - 1);
        sr += pr[row + x]; sg += pg[row + x]; sb += pb[row + x]; sa += pa[row + x];
      }
      for (let x = 0; x < w; x++) {
        tr[row + x] = sr * k; tg[row + x] = sg * k; tb[row + x] = sb * k; ta[row + x] = sa * k;
        const xo = wrap ? (((x - rad) % w) + w) % w : clamp(x - rad, 0, w - 1);
        const xi = wrap ? (x + rad + 1) % w : clamp(x + rad + 1, 0, w - 1);
        sr += pr[row + xi] - pr[row + xo]; sg += pg[row + xi] - pg[row + xo]; sb += pb[row + xi] - pb[row + xo]; sa += pa[row + xi] - pa[row + xo];
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let i = -rad; i <= rad; i++) {
        const y = clamp(i, 0, h - 1);
        sr += tr[y * w + x]; sg += tg[y * w + x]; sb += tb[y * w + x]; sa += ta[y * w + x];
      }
      for (let y = 0; y < h; y++) {
        const i0 = y * w + x;
        pr[i0] = sr * k; pg[i0] = sg * k; pb[i0] = sb * k; pa[i0] = sa * k;
        const yo = clamp(y - rad, 0, h - 1), yi = clamp(y + rad + 1, 0, h - 1);
        sr += tr[yi * w + x] - tr[yo * w + x]; sg += tg[yi * w + x] - tg[yo * w + x]; sb += tb[yi * w + x] - tb[yo * w + x]; sa += ta[yi * w + x] - ta[yo * w + x];
      }
    }
  }
  const out = new PixelBuffer(w, h);
  for (let i = 0; i < n; i++) {
    const a = pa[i];
    if (a < 0.02) continue;
    out.data[i] = rgba(pr[i] / a, pg[i] / a, pb[i] / a, Math.min(255, a * 255));
  }
  return out;
}

/** darken / cool a buffer toward a silhouette colour (the out-of-focus foreground) */
export function silhouette(buf: PixelBuffer, to: C, k: number, keepLight = 0.25) {
  const d = buf.data;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if (!(c >>> 24)) continue;
    const l = (R(c) * 0.3 + G(c) * 0.59 + B(c) * 0.11) / 255;
    const m = mix(c, to, k * (1 - l * keepLight));
    d[i] = ((m & 0x00ffffff) | (c & 0xff000000)) >>> 0;
  }
}
