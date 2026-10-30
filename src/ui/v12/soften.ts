// V12 menus over a live scene: the world softens behind the floating words. The renderer's lens
// racks out of focus, the colour drains a little, the exposure drops and the edges close in (the
// cinematic post FX, src/gfx/renderer.ts CineFx). It eases on real time, so it works while the game
// is paused (the cinematic camera's own easing stops then); when it lets go, the cinematic camera
// eases the FX back to wherever its beats want them.
//
//   softenScene(true)   ease in (calls nest: each true needs a false)
//   softenScene(false)  ease out

import { game } from '../../game/game';

let want = 0;
let k = 0;
let hooked = false;
let last = 0;

function hook() {
  if (hooked) return;
  hooked = true;
  last = performance.now();
  // after the cinematic camera's hook (registered when it loads), so these win
  game.frameHooks.push(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = want > 0 ? 1 : 0;
    if (k === target && k === 0) return;
    k += (target - k) * (1 - Math.exp(-dt * (target > k ? 9 : 7)));
    if (Math.abs(k - target) < 0.004) k = target;
    const fx = game.r.cine;
    // ease the curve so it settles softly
    const e = k * k * (3 - 2 * k);
    fx.defocus = Math.max(fx.defocus, 3.4 * e);
    fx.desat = Math.max(fx.desat, 0.38 * e);
    fx.exposure = Math.min(fx.exposure, -0.62 * e);
    fx.vignette = Math.max(fx.vignette, 0.6 * e);
  });
}

export function softenScene(on: boolean) {
  hook();
  want = Math.max(0, want + (on ? 1 : -1));
}

/** 0..1: how soft the scene is right now */
export const sceneSoftness = () => k;
