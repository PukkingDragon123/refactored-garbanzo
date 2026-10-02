// V11 contract: in-scene cinematics. Story beats happen inside the scene you're in: the camera
// eases in on the characters (with depth of field / bloom from the render FX module), letterbox bars
// slide in, time can slow down. The render FX module owns the real implementation; this stub works
// with the plain stage camera so other modules can use it right away.
import { game } from '../game';
import type { Stage } from '../../world/stage';

export interface CineShot {
  /** world point to centre on */
  x: number;
  y: number;
  /** camera zoom (1 = normal) */
  zoom: number;
  /** seconds to get there (default 0.8) */
  secs?: number;
  /** depth of field focus: the layer depth / parallax to keep sharp (null = off) */
  focus?: number | null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(stage: Stage, to: { x: number; y: number; zoom: number }, secs: number): Promise<void> {
  const c = stage.cam;
  const from = { x: c.x, y: c.y, zoom: c.zoom };
  return new Promise(res => {
    const t0 = performance.now();
    const step = () => {
      const k = secs <= 0 ? 1 : Math.min(1, (performance.now() - t0) / (secs * 1000));
      const e = ease(k);
      c.x = from.x + (to.x - from.x) * e;
      c.y = from.y + (to.y - from.y) * e;
      c.zoom = from.zoom + (to.zoom - from.zoom) * e;
      if (k < 1) requestAnimationFrame(step); else res();
    };
    step();
  });
}

/** ease the camera onto a shot and hold it there (until cineRelease) */
export async function cineTo(stage: Stage, shot: CineShot): Promise<void> {
  stage.cam.locked = true;
  cineState.focus = shot.focus ?? null;
  await tween(stage, shot, shot.secs ?? 0.8);
}
/** hand the camera back to the scene (eases back to the follow target) */
export async function cineRelease(stage: Stage, secs = 0.6): Promise<void> {
  const c = stage.cam;
  await tween(stage, { x: c.tx, y: c.ty, zoom: c.tzoom }, secs);
  c.locked = false;
  cineState.focus = null;
}
/** letterbox bars for story beats */
export function cineBars(on: boolean): void {
  let el = document.getElementById('cine-bars');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cine-bars';
    el.innerHTML = '<i></i><i></i>';
    const st = document.createElement('style');
    st.textContent = '#cine-bars{position:fixed;inset:0;pointer-events:none;z-index:30}#cine-bars i{position:absolute;left:0;right:0;height:0;background:#000;transition:height .5s ease}#cine-bars i:first-child{top:0}#cine-bars i:last-child{bottom:0}#cine-bars.on i{height:9vh}';
    document.head.appendChild(st);
    document.body.appendChild(el);
  }
  el.classList.toggle('on', on);
}
/** slow motion (1 = normal) */
export function cineSlowmo(k: number): void { game.slowmo = k; }
/** what the render FX module reads */
export const cineState = { focus: null as number | null };
