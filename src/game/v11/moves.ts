// V11: playing a combat / agility move on an Actor with its travel. The clips (src/art/v7/combat7.ts)
// animate in place; this moves the Actor along the move's root motion in step with the clip (a back
// flip carries her back 40 px, a dash strike 60 px forward), fires the move's moments (the shot
// leaving the pouch, the kick landing, touching down), and can leave a fading after-image trail.
//
//   await performMove(aroha, 'dashStrike', { onHit: () => tiger.stagger() });
//   await performMove(aroha, 'slingRelease', { onRelease: () => spawnStone(aroha.handPos()) });
//
// Clip names: anim-contract.ts COMBAT_ANIMS. Anyone can play them; Aroha's are faster and bigger.

import type { Actor } from '../../world/actor';
import { animInfo } from '../../world/actor';
import { game } from '../game';
import { COMBAT_MOVES7, rootMotion7 } from '../../art/v7/combat7';

export interface MoveOpts {
  /** travel direction relative to facing (default 1); -1 runs the move's travel the other way */
  dir?: 1 | -1;
  /** the clip to go to afterwards (default the actor's idle clip) */
  then?: string;
  /** the shot / throw leaves the hand */
  onRelease?: () => void;
  /** the strike lands */
  onHit?: () => void;
  /** feet leave the ground / touch down */
  onAir?: () => void;
  onLand?: () => void;
  /** world x limits the travel is clamped to (walls, the edge of a ledge) */
  minX?: number;
  maxX?: number;
}

/** play a move and travel with it; resolves when the clip is done */
export function performMove(a: Actor, anim: string, o: MoveOpts = {}): Promise<void> {
  const info = animInfo(anim, a.id);
  const dur = info.frames / info.fps;
  const mv = COMBAT_MOVES7[anim];
  const x0 = a.x, f = a.facing * (o.dir ?? 1);
  const fired = new Set<string>();
  const ev: [keyof typeof EVK, (() => void) | undefined][] = [['release', o.onRelease], ['hit', o.onHit], ['air', o.onAir], ['land', o.onLand]];
  const done = a.play(anim, o.then ?? a.idleAnim);
  let t = 0, last = performance.now(), live = true;
  void done.then(() => { live = false; });
  return new Promise(res => {
    const step = (now: number) => {
      const dt = game.paused ? 0 : Math.min(0.05, (now - last) / 1000) * game.slowmo;
      last = now;
      t = Math.min(dur, t + dt);
      const k = dur > 0 ? t / dur : 1;
      if (mv) {
        let x = x0 + f * rootMotion7(a.id, anim, k);
        if (o.minX !== undefined) x = Math.max(o.minX, x);
        if (o.maxX !== undefined) x = Math.min(o.maxX, x);
        a.x = x;
        for (const [key, fn] of ev) {
          const at = mv[key];
          if (fn && at !== undefined && k >= at && !fired.has(key)) { fired.add(key); try { fn(); } catch (e) { console.error(e); } }
        }
      }
      if (live && t < dur) requestAnimationFrame(step);
      else { for (const [key, fn] of ev) if (fn && mv?.[key] !== undefined && !fired.has(key)) fn(); void done.then(() => res()); }
    };
    requestAnimationFrame(step);
  });
}
const EVK = { release: 1, hit: 1, air: 1, land: 1 };

/** how far a move carries a character (world px toward facing; negative = backward) */
export function moveReach(id: string, anim: string): number { return rootMotion7(id, anim, 1); }
