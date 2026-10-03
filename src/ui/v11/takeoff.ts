// V11: Mori swings his pack off before the Backpack screen opens (and back on after). In the world the
// cast's 'backpackOff' / 'backpackOn' clips play when the sprite module has them (src/art/v7/anim-
// contract.ts); without them he crouches to it. The camera pushes in on him while he does, then the
// world freezes behind the screen (game.covered): the last frame is grabbed once, small, and shown
// blown up, dimmed and soft (a cheap depth of field that costs nothing per frame), and the HUD is
// put away.

import { game } from '../../game/game';
import { hasAnim7 } from '../../art/v7/anim-contract';
import { animInfo } from '../../world/actor';
import { audio } from '../../core/audio';
import { reduced } from '../laptop-kit';

interface Cam { x: number; y: number; zoom: number; tx: number; ty: number; tzoom: number; locked: boolean }
interface SceneLike {
  player?: { x: number; y: number; vx: number; poseOverride: string | null; id?: string };
  st?: { cam: Cam };
  cutscene?: boolean;
}

const clipMs = (anim: string) => { const i = animInfo(anim, 'mori'); return Math.max(250, Math.min(1600, (i.frames / Math.max(1, i.fps)) * 1000)); };

function tweenCam(c: Cam, to: { x: number; y: number; zoom: number }, ms: number): Promise<void> {
  const from = { x: c.x, y: c.y, zoom: c.zoom };
  const t0 = performance.now();
  return new Promise(res => {
    const f = () => {
      const t = Math.max(0, Math.min(1, (performance.now() - t0) / Math.max(1, ms)));
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      c.x = c.tx = from.x + (to.x - from.x) * k;
      c.y = c.ty = from.y + (to.y - from.y) * k;
      c.zoom = c.tzoom = from.zoom + (to.zoom - from.zoom) * k;
      if (t < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
}

/** grab the next rendered frame, small (blown back up it's soft), dimmed */
function snapshot(): Promise<HTMLCanvasElement | null> {
  return new Promise(res => {
    const t = setTimeout(() => res(null), 900);
    const prev = game.afterRender;
    game.afterRender = () => {
      try { prev?.(); } catch (e) { console.error(e); }
      clearTimeout(t);
      try {
        const src = game.r.canvas;
        const c = document.createElement('canvas');
        c.width = Math.max(2, Math.round(src.width / 7)); c.height = Math.max(2, Math.round(src.height / 7));
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, c.width, c.height);
        g.fillStyle = 'rgba(14, 10, 4, 0.22)';
        g.fillRect(0, 0, c.width, c.height);
        res(c);
      } catch { res(null); }
    };
  });
}

export interface PackOff {
  /** the frozen world, soft and dim, to put behind the screen (null if it couldn't be grabbed) */
  backdrop: HTMLCanvasElement | null;
  /** put the pack back on (the world part of closing) */
  putOn: () => Promise<void>;
}

/** the world part of opening the pack */
export async function packOff(o: { anim?: boolean } = {}): Promise<PackOff> {
  const sc = game.scene as unknown as SceneLike | null;
  const p = sc?.player, cam = sc?.st?.cam;
  const play = o.anim !== false && !!p && !!cam && !sc?.cutscene;
  let was: { locked: boolean; x: number; y: number; zoom: number } | null = null;
  if (play && p && cam) {
    p.vx = 0;
    was = { locked: cam.locked, x: cam.x, y: cam.y, zoom: cam.zoom };
    const real = hasAnim7('backpackOff');
    const ms = reduced() ? 60 : real ? clipMs('backpackOff') : 380;
    p.poseOverride = real ? 'backpackOff' : 'kneel';
    audio.play('rustle', { vol: 0.45, pitch: 0.9 });
    setTimeout(() => audio.play('zipper', { vol: 0.35, pitch: 0.85 }), ms * 0.45);
    cam.locked = true;
    await tweenCam(cam, { x: p.x, y: p.y - 22, zoom: Math.min(4, cam.zoom * 1.28) }, ms);
  }
  // while the pack is open he kneels by it, rummaging (the frozen frame keeps that pose)
  if (play && p && hasAnim7('backpackOpen')) p.poseOverride = 'backpackOpen';
  // freeze the world behind the screen and put the HUD away
  const backdrop = game.scene ? await snapshot() : null;
  game.covered++;
  const hud = [game.ui.sceneLayer, game.ui.prompts, game.ui.hud];
  for (const h of hud) { h.style.transition = 'opacity 0.25s'; h.style.opacity = '0'; }
  return {
    backdrop,
    putOn: async () => {
      game.covered = Math.max(0, game.covered - 1);
      for (const h of hud) h.style.opacity = '';
      if (play && p && cam && was) {
        const real = hasAnim7('backpackOn');
        const ms = reduced() ? 60 : real ? clipMs('backpackOn') : 300;
        p.poseOverride = real ? 'backpackOn' : 'kneel';
        audio.play('rustle', { vol: 0.4, pitch: 1.05 });
        await tweenCam(cam, { x: p.x, y: was.y, zoom: was.zoom }, ms);
        p.poseOverride = null;
        cam.locked = was.locked;
      }
    },
  };
}
