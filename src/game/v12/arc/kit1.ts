// V12 Te Ara Matatū, chapters 1 to 3: what the three chapter files share (flags, lines, the photo test,
// a tick that runs after the field scene's own danger music, the hint lines).

import type { FieldScene } from '../../scenes/field';
import type { RawPhoto } from '../../photos';
import { game } from '../../game';
import { floatText } from '../../../ui/v12/float';
import type { FloatStyle } from '../../../ui/v12/float';
import { questStatus } from '../../quests';
import { packColor } from '../../../gfx/renderer';

export const F = (k: string) => !!game.save.flags[k];
export const setF = (k: string) => { if (!game.save.flags[k]) { game.save.flags[k] = true; game.persist(); } };
export const V = (k: string) => game.save.vars[k] ?? 0;
export const setV = (k: string, v: number) => { game.save.vars[k] = v; game.persist(); };
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const active = (id: string) => questStatus(id) === 'active';

/** a line floating by Mori (or at a world point) */
export function say(text: string, style: FloatStyle = 'say', ms = 2800, at?: { x: number; y: number }) {
  return floatText({ text, style, ms, ...(at ?? {}) });
}
/** a line from Aroha, floating by her (when she is here) */
export function aroha(f: FieldScene, text: string, style: FloatStyle = 'say', ms = 3000) {
  const a = f.guide?.a ?? f.actors.get('aroha');
  if (a && a.visible) return floatText({ actor: a, text, style, ms });
  return Promise.resolve();
}
/** a line from someone standing in the scene (an Actor in f.actors) */
export function by(f: FieldScene, who: string, text: string, style: FloatStyle = 'say', ms = 3000) {
  const a = f.actors.get(who);
  if (a && a.visible) return floatText({ actor: a, text, style, ms });
  return floatText({ text, style, ms });
}

/** chain a handler onto the scene's camera (waits for the camera if it isn't up yet) */
export function onShot(f: FieldScene, fn: (ph: RawPhoto) => void) {
  const hook = () => {
    if (game.scene !== (f as never)) return;
    if (!f.cam) { setTimeout(hook, 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); try { fn(ph); } catch (e) { console.warn('[arc] photo', e); } };
  };
  hook();
}

/** how well a world box (on the gameplay plane) sits in the photo just taken: the fraction of it in the
 *  frame, and its height as a fraction of the frame's */
export function inShot(f: FieldScene, x0: number, y0: number, x1: number, y1: number): { inFrame: number; size: number } {
  const r = game.r, Fr = f.cam.frameScreen();
  const fw = Fr.x1 - Fr.x0, fh = Fr.y1 - Fr.y0;
  const sx0 = r.projectX(x0, 1), sx1 = r.projectX(x1, 1), sy0 = r.projectY(y0, 1), sy1 = r.projectY(y1, 1);
  const ix = Math.max(0, Math.min(sx1, Fr.x1) - Math.max(sx0, Fr.x0)), iy = Math.max(0, Math.min(sy1, Fr.y1) - Math.max(sy0, Fr.y0));
  const area = Math.max(1, (sx1 - sx0) * (sy1 - sy0));
  return { inFrame: (ix * iy) / area, size: Math.max(0, (sy1 - sy0) / Math.max(1, fh), (sx1 - sx0) / Math.max(1, fw) * 0.6) };
}

/**
 * A tick that runs after the field scene's own update (which sets the danger music from its animals
 * every frame): the set pieces drive audio.setDanger / setHeartbeat from here. Per scene; returns a
 * remover.
 */
const LATE = new WeakMap<FieldScene, ((dt: number) => void)[]>();
const WRAPPED = new WeakSet<object>();
export function lateTick(f: FieldScene, fn: (dt: number) => void): () => void {
  let l = LATE.get(f);
  if (!l) { l = []; LATE.set(f, l); }
  l.push(fn);
  const site = f.site as unknown as { onUpdate?: (f: FieldScene, dt: number) => void };
  if (!WRAPPED.has(site)) {
    WRAPPED.add(site);
    const prev = site.onUpdate;
    site.onUpdate = (s: FieldScene, dt: number) => {
      prev?.(s, dt);
      for (const g of (LATE.get(s) ?? []).slice()) { try { g(dt); } catch (e) { console.warn('[arc] late', e); } }
    };
  }
  return () => { const a = LATE.get(f); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
}

/** first-visit thoughts: the first time Mori comes within `r` of x, a line (once ever, by flag) */
export function hints(f: FieldScene, list: { id: string; x: number; r?: number; text: string; when?: () => boolean; style?: FloatStyle }[]) {
  const done = new Set<string>();
  return (dt: number) => {
    void dt;
    if (f.cutscene || game.ui.blocking) return;
    const p = f.player;
    for (const h of list) {
      if (done.has(h.id) || F(h.id)) continue;
      if (h.when && !h.when()) continue;
      if (Math.abs(p.x - h.x) < (h.r ?? 140)) { done.add(h.id); setF(h.id); void say(h.text, h.style ?? 'think', 3200); break; }
    }
  };
}

/** a scene-local timer list ticked by a Custom (the chapters' scripted beats) */
export class Beats {
  private list: { t: number; fn: () => void }[] = [];
  at(secs: number, fn: () => void) { this.list.push({ t: secs, fn }); }
  tick(dt: number) {
    for (const b of this.list) b.t -= dt;
    const due = this.list.filter(b => b.t <= 0);
    this.list = this.list.filter(b => b.t > 0);
    for (const b of due) b.fn();
  }
  clear() { this.list = []; }
}

/**
 * A billowing wall of dust (a collapse front), pixel-quantised and dithered, never a box: its leading
 * edge boils in and out, its top heaves up in lumps, it is lit on its upper left. `dir` is the way it is
 * moving (-1 left): the mass lies behind the front. Cells of 2 px.
 */
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const hn = (x: number, y: number) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const vn1 = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hn(xi, yi), b = hn(xi + 1, yi), c = hn(xi, yi + 1), d = hn(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
export function drawDust(r: import('../../../gfx/renderer').Renderer, front: number, ground: (x: number) => number, dir: number, t: number, o: { h?: number; w?: number; col?: [number, number, number] } = {}) {
  const H = o.h ?? 170, Wd = o.w ?? 110, c = o.col ?? [0.42, 0.37, 0.31];
  const tones = [0.72, 0.86, 1, 1.16].map(k => packColor0(c[0] * k, c[1] * k, c[2] * k));
  const inside = (dx: number, h: number) => {
    // dx: px behind the front; h: px above the ground
    const top = Math.min(H, 34 + dx * 1.4 + (vn1(dx * 0.05 + t * 0.4, 3.1) - 0.5) * 50);
    const edge = (vn1(h * 0.06 + t * 1.2, t * 0.3) - 0.5) * 22 + (vn1(h * 0.15 - t * 2, 7) - 0.5) * 8;
    return dx - edge + Math.min(0, (top - h) * 1.2) + (vn1(dx * 0.08 - t * 0.5, h * 0.08 + t * 0.7) - 0.5) * 16;
  };
  for (let cx = -14; cx < Wd / 2; cx++) {
    const dx = cx * 2, wx = Math.round(front - dir * dx), g = ground(wx);
    for (let cy = 0; cy < H / 2; cy++) {
      const h = cy * 2, v = inside(dx, h);
      if (v <= -2) continue;
      const th = B4[((cy & 3) << 2) | (cx & 3)];
      if (v < 6 && th > (v + 2) / 8) continue;
      let k = v > 26 ? 1 : v > 10 ? 2 : 1;
      if (inside(dx, h + 4) <= 0) k = 3;
      else if (inside(dx - 4, h) <= 0) k = Math.max(k, 2);
      if (v > 40 && th < 0.4) k = 0;
      r.rect(wx - (dir > 0 ? 1 : 0), Math.round(g - h - 2), 2, 2, tones[k]);
    }
  }
}
const packColor0 = (r: number, g: number, b: number) => packColor(Math.min(1, r), Math.min(1, g), Math.min(1, b), 1);
