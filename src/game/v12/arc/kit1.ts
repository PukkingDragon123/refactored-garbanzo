// V12 Te Ara Matatū, chapters 1 to 3: what the three chapter files share (flags, lines, the photo test,
// a tick that runs after the field scene's own danger music, the hint lines).

import type { FieldScene } from '../../scenes/field';
import type { RawPhoto } from '../../photos';
import { game } from '../../game';
import { floatText } from '../../../ui/v12/float';
import type { FloatStyle } from '../../../ui/v12/float';
import { questStatus } from '../../quests';

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
