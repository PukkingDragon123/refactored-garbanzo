// V12 Te Rua Pōuri, the dark. The cave is truly dark: everything is drawn, and then a sheet of black
// is laid over the view with holes in it where there is light. The holes are dithered, never smooth:
// each light makes a clear core, a ring of half dark and a scatter of black pixels into the rim
// (ordered 4x4 dithering), so the pool of Mori's storm lantern has a hard pixel edge that crawls a
// little as the flame flickers. Glowworms, ghost fungi and crystals open small faint pools of their
// own (and their glowing pixels are drawn on top, after the light). The sheet is one small texture,
// rebuilt each frame for the part of the cave on screen.
//
// Mori's lantern: bright (a wide pool), shuttered (a small one: crouch and keep still, or press L)
// or hung on the pole by the lake (his own pool goes, the pole's comes).

import type { Renderer, Frame } from '../../../gfx/renderer';
import { frameOf, packColor } from '../../../gfx/renderer';
import type { Texture } from '../../../gfx/gl';
import type { Stage } from '../../../world/stage';
import { game } from '../../game';
import { local } from '../../assets';
import { PixelBuffer } from '../../../art/pixel';
import { hex } from '../../../art/color';

export interface CaveLight {
  x: number; y: number;
  /** radius (world px) */
  r: number;
  /** strength: 1 opens a clear core, about 0.5 only a half-dark pool */
  k: number;
  on?: boolean;
  /** a slow flicker 0..1 */
  flick?: number;
}

const DARK = 0xff000000 >>> 0;
const HALF = (148 << 24) >>> 0;
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** the black sheet over the cave (on the gameplay plane, over everything on it) */
export class Darkness {
  z = 96;
  lights: CaveLight[] = [];
  /** extra lights this frame (moving ones: the lantern, the pole, the Gulper's glow) */
  dyn: () => CaveLight[] = () => [];
  /** the mouth: daylight from the glowworm cave reaching in from the west edge */
  twilight: { x0: number; x1: number; y0: number; y1: number; k: number } | null = null;
  enabled = true;
  private tex: Texture | null = null;
  private fr: Frame | null = null;
  private tw = 0;
  private th = 0;
  private px: Uint32Array = new Uint32Array(0);
  private lv: Float32Array = new Float32Array(0);
  private t = 0;

  update(dt: number) { this.t += dt; }

  draw(r: Renderer, _st: Stage) {
    if (!this.enabled) return;
    const x0 = Math.floor(r.wx(0)) - 2, x1 = Math.ceil(r.wx(r.VW)) + 2;
    const y0 = Math.floor(r.wy(0)) - 2, y1 = Math.ceil(r.wy(r.VH)) + 2;
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0 || w > 2400 || h > 1600) return;
    if (!this.tex || w > this.tw || h > this.th) {
      this.tw = Math.max(w, this.tw); this.th = Math.max(h, this.th);
      this.tex = r.texture(this.tw, this.th, null, true);
      this.px = new Uint32Array(this.tw * this.th);
      this.lv = new Float32Array(this.tw * this.th);
    }
    const W = this.tw, lv = this.lv, px = this.px;
    lv.fill(0, 0, W * h);
    const add = (L: CaveLight) => {
      if (L.on === false || L.k <= 0 || L.r <= 0) return;
      const R = L.r * (1 + (L.flick ? Math.sin(this.t * 11 + L.x) * 0.02 * L.flick + Math.sin(this.t * 23.7 + L.y) * 0.012 * L.flick : 0));
      const ax = Math.max(x0, Math.floor(L.x - R)), bx = Math.min(x0 + w - 1, Math.ceil(L.x + R));
      const ay = Math.max(y0, Math.floor(L.y - R)), by = Math.min(y0 + h - 1, Math.ceil(L.y + R));
      if (ax > bx || ay > by) return;
      const R2 = R * R;
      for (let y = ay; y <= by; y++) {
        const dy = y + 0.5 - L.y, row = (y - y0) * W - x0;
        for (let x = ax; x <= bx; x++) {
          const dx = x + 0.5 - L.x, d2 = dx * dx + dy * dy;
          if (d2 >= R2) continue;
          const v = L.k * (1 - d2 / R2);
          if (v > lv[row + x]) lv[row + x] = v;
        }
      }
    };
    for (const L of this.lights) if (L.x > x0 - L.r && L.x < x1 + L.r && L.y > y0 - L.r && L.y < y1 + L.r) add(L);
    for (const L of this.dyn()) add(L);
    // the mouth's daylight: a long soft wedge from the west edge, stepped and dithered like the rest
    const tw = this.twilight;
    if (tw && tw.k > 0 && x0 < tw.x1 && y0 < tw.y1 && y1 > tw.y0) {
      for (let y = Math.max(y0, tw.y0); y < Math.min(y1, tw.y1); y++) {
        const row = (y - y0) * W - x0;
        for (let x = Math.max(x0, tw.x0); x < Math.min(x1, tw.x1); x++) {
          const v = tw.k * (1 - (x - tw.x0) / (tw.x1 - tw.x0));
          if (v > lv[row + x]) lv[row + x] = v;
        }
      }
    }
    // quantise: clear, half dark, dark, with the steps dithered
    for (let y = 0; y < h; y++) {
      const wy = y + y0, brow = (wy & 3) * 4, row = y * W;
      for (let x = 0; x < w; x++) {
        const v = lv[row + x], th = B4[brow + ((x + x0) & 3)];
        px[row + x] = v > 0.5 + th * 0.28 ? 0 : v > 0.14 + th * 0.22 ? HALF : DARK;
      }
    }
    this.tex.subImage(0, 0, W, h, new Uint8Array(px.buffer, 0, W * h * 4));
    if (!this.fr || this.fr.tex !== this.tex) this.fr = frameOf(this.tex, 0, 0);
    const fr = { ...this.fr, u1: w / this.tw, v1: h / this.th, w, h };
    r.draw(fr, x0, y0, 1, 1, 0, packColor(1, 1, 1, 1));
  }
}

// ------------------------------------------------------------------ Mori's storm lantern
export type LampMode = 'bright' | 'dim' | 'pole';
export const LAMP = { mode: 'bright' as LampMode, R: 104, dimR: 40, k: 1, auto: false };
export const lampR = () => (LAMP.mode === 'bright' ? LAMP.R : LAMP.mode === 'dim' ? LAMP.dimR : 0);
export const lampBright = () => LAMP.mode === 'bright';

/** the lantern itself: a brass storm lantern, its glass chimney, the flame (big, or shuttered small) */
let lanternFr: { open: Frame; shut: Frame; owner: unknown } | null = null;
export function lanternFrames(): { open: Frame; shut: Frame } {
  if (!lanternFr || lanternFr.owner !== local) {
    const paint = (shut: boolean) => {
      const b = new PixelBuffer(9, 14);
      const brass = ['#3a2408', '#6a4818', '#a07a30', '#d8b060'].map(c => hex(c));
      // bail handle, cap, chimney glass, the shutter, the tank
      for (const [x, y] of [[3, 0], [4, 0], [5, 0], [2, 1], [6, 1]] as const) b.set(x, y, brass[2]);
      for (let x = 2; x <= 6; x++) b.set(x, 2, brass[x < 4 ? 3 : 1]);
      for (let x = 1; x <= 7; x++) b.set(x, 3, brass[x < 3 ? 3 : 2]);
      for (let y = 4; y <= 9; y++) for (let x = 2; x <= 6; x++) {
        const edge = x === 2 || x === 6;
        b.set(x, y, edge ? brass[1] : shut && y < 8 ? hex('#2a1c10') : hex(y > 7 ? '#ffd890' : '#fff4c8'));
      }
      if (!shut) { b.set(4, 6, hex('#ffffff')); b.set(4, 7, hex('#ffe070')); b.set(3, 8, hex('#ff9a30')); b.set(5, 8, hex('#ff9a30')); }
      else { b.set(4, 8, hex('#ff8a20')); for (let x = 3; x <= 5; x++) b.set(x, 5, brass[2]); }
      for (let y = 10; y <= 12; y++) for (let x = 1; x <= 7; x++) b.set(x, y, brass[clamp3(2 - (x > 5 ? 1 : 0) + (y === 10 ? 1 : 0))]);
      b.set(4, 13, brass[0]);
      b.outline(hex('#140c04'));
      return b;
    };
    lanternFr = { open: local.add('dc:lantern', paint(false), 5, 1), shut: local.add('dc:lanternShut', paint(true), 5, 1), owner: local };
  }
  return lanternFr;
}
const clamp3 = (v: number) => Math.max(0, Math.min(3, v));

/** the warm light of the lantern and its little glowing pixels (after the dark is laid) */
export function drawLanternGlow(r: Renderer, x: number, y: number, mode: LampMode | 'pole', t: number) {
  const f = 0.92 + Math.sin(t * 13) * 0.05 + Math.sin(t * 29) * 0.03;
  const big = mode !== 'dim';
  r.light(x, y + 6, big ? 230 : 90, 1, 0.78, 0.5, (big ? 1.05 : 0.55) * f, 0.05);
  r.fxRect(x - 1, y + 5, 3, 3, packColor(1, 0.86, 0.5, 1), big ? 1.6 * f : 0.8, true);
  r.fxRect(x, y + 6, 1, 1, packColor(1, 1, 0.9, 1), 2.2 * f, true);
  void game;
}
