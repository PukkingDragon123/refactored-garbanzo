// Mori's 3D hands for the cooking minigame (src/ui/v11/cooking.ts). That module exposes
// registerCookHands(factory): the factory is mounted over the cooking stage (320 x 180 logical) and told
// what the hands are doing and where, in stage coordinates. We register at import time; the glob import
// finds cooking.ts when it is in the build and does nothing when it isn't, so this compiles either way.

import { mountHands3d, HANDS3D, HandsController } from './index';

type CookAct = 'idle' | 'chop' | 'stir' | 'fan' | 'turn' | 'add' | 'serve';
interface CookHands { act(a: CookAct, x: number, y: number): void; dispose(): void }
type CookHandsFactory = (host: HTMLElement, o: { width: number; height: number; method?: string }) => CookHands | null;

export const cookHandsFactory: CookHandsFactory = (host, o) => {
  if (!HANDS3D.enabled) return null;
  const W = o.width || 320, H = o.height || 180;
  let ctl: HandsController;
  try {
    ctl = mountHands3d(host, { who: 'mori', side: 'both', grid: [W, H], scale: 2.6, lights: 'galley', pixel: 3, outline: 0.7, quant: 24, fov: 30 });
  } catch (e) { console.warn('[hands3d] cooking hands unavailable', e); return null; }
  ctl.plane(-25, 0.25, 0.25, '#2a1a10');
  const R = ctl.right!, L = ctl.left!;
  R.shoulderAt(W * 0.86, H * 1.55, 90);
  L.shoulderAt(W * 0.14, H * 1.55, 90);
  let act: CookAct = 'idle', ax = W / 2, ay = H * 0.6, t = 0, last = 0, raf = 0, dead = false;

  const pose = () => {
    const sx = Math.sin(t * 2.2), cx = Math.cos(t * 2.2);
    // the resting hands sit low on either side
    const restL = () => L.release().setPose('relaxed').reachTo(W * 0.22, H * 0.86, 10, { with: 'palm', fingers: [0.5, -0.6, -0.5], palm: [0.2, 0.6, -0.8], follow: 10 });
    const restR = () => R.release().setPose('relaxed').reachTo(W * 0.78, H * 0.86, 10, { with: 'palm', fingers: [-0.5, -0.6, -0.5], palm: [-0.2, 0.6, -0.8], follow: 10 });
    switch (act) {
      case 'chop': {
        // knife hand rocks up and down; the other hand holds the food flat, fingertips tucked
        const up = Math.max(0, Math.sin(t * 9)) * 9;
        R.clearJoints().grip(1.0, 0.8).reachTo(ax + 14, ay - 6 - up, 14, { with: 'grip', fingers: [-0.9, 0.1, -0.3], palm: [0, 1, 0.2], follow: 30 });
        L.release().setPose('hook', 0.6).reachTo(ax - 26, ay + 2, 8, { with: 'palm', fingers: [0.75, 0.3, -0.5], palm: [0.1, 1, -0.3], follow: 14 });
        break;
      }
      case 'stir': {
        // a spoon handle held upright, circling the pot
        const px = ax + cx * 14, py = ay + sx * 5;
        R.clearJoints().hold({ a: [px, py - 26, 12], b: [px, py - 12, 12], r: 1.6 }, { follow: 0, approach: [0.6, -0.2, 0.75], occlude: false });
        restL();
        break;
      }
      case 'fan': {
        R.clearJoints().setPose('wave').reachTo(ax, ay - 30, 20, { with: 'palm', fingers: [0, -1, 0.2], palm: [0, 0.3, -1], follow: 12 });
        restL();
        break;
      }
      case 'turn': {
        // turning a piece over between finger and thumb
        R.release().setPose('pinch').setJoint('twist', Math.sin(t * 3) * 40).reachTo(ax, ay - 2, 10, { with: 'pinch', fingers: [-0.4, 0.6, -0.7], palm: [-0.4, 0.3, -0.85], follow: 20 });
        restL();
        break;
      }
      case 'add': {
        // a pinch of something, rubbed between the fingers over the pot
        R.release().setPose('pinch').setJoint('index.pip', 40 + sx * 12).reachTo(ax, ay - 22 + sx, 16, { with: 'pinch', fingers: [-0.3, 0.7, -0.6], palm: [-0.2, 0.4, -0.9], follow: 14 });
        restL();
        break;
      }
      case 'serve': {
        // both hands carry the bowl, palms up
        L.release().setPose('cup').reachTo(ax - 18, ay + 6, 10, { with: 'palm', fingers: [0.7, 0, -0.6], palm: [0, -1, 0.1], follow: 10 });
        R.release().setPose('cup').reachTo(ax + 18, ay + 6, 10, { with: 'palm', fingers: [-0.7, 0, -0.6], palm: [0, -1, 0.1], follow: 10 });
        break;
      }
      default:
        restL();
        restR();
    }
  };
  const step = (now: number) => {
    if (dead) return;
    if (!ctl.alive) { dead = true; return; }
    const dt = last ? Math.max(0, Math.min(0.05, (now - last) / 1000)) : 1 / 60;
    last = now;
    t += dt;
    pose();
    ctl.frame(dt);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return {
    act(a, x, y) {
      if (a !== act) { R.clearJoints(); L.clearJoints(); }
      act = a; ax = x; ay = y;
    },
    dispose() { dead = true; cancelAnimationFrame(raf); ctl.destroy(); },
  };
};

// register with the cooking minigame if it is part of this build
const mods = import.meta.glob('../../../ui/v11/cooking.ts');
for (const k of Object.keys(mods)) {
  void mods[k]().then(m => {
    const reg = (m as { registerCookHands?: (f: CookHandsFactory) => void }).registerCookHands;
    reg?.(cookHandsFactory);
  }).catch(e => console.warn('[hands3d] cooking hook', e));
}
