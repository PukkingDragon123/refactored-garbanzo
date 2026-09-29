// Chunk the pug as a companion: waddles after Mori, gets distracted, and fills every quiet moment
// with something goofy (sniffing, flopping, tail chasing, begging, sneezing, rolling over, zoomies).
// He can't climb ladders, so when Mori changes deck he "finds another way" and turns up shortly after.

import type { Actor } from '../../world/actor';
import type { Player } from '../../world/player';
import type { Terrain } from '../../world/terrain';
import { rand } from '../../core/math';
import { audio } from '../../core/audio';
import { game } from '../game';

export interface BuddyHost {
  player: Player;
  terrain: Terrain;
  /** walkable x-range of the level at height y (for placing Chunk when he catches up) */
  levelSpan?(y: number): [number, number];
}

const GOOFY: { anim: string; w: number; expr?: string; emote?: string; cold?: boolean }[] = [
  { anim: 'sniff', w: 3 }, { anim: 'sit', w: 3 }, { anim: 'scratch', w: 2 }, { anim: 'yawn', w: 1.5, expr: 'tired' },
  { anim: 'wiggle', w: 1.5, expr: 'happy' }, { anim: 'spin', w: 1.2, expr: 'excited' }, { anim: 'roll', w: 1, expr: 'happy' },
  { anim: 'flop', w: 1, expr: 'derp' }, { anim: 'sneeze', w: 1, expr: 'surprised' }, { anim: 'tilt', w: 1.5, expr: 'thinking' },
  { anim: 'beg', w: 1, expr: 'excited', emote: 'heart' }, { anim: 'lie', w: 2 }, { anim: 'shake', w: 0.8 },
  { anim: 'shiver', w: 2.5, expr: 'sad', cold: true },
];

export class ChunkBuddy {
  mode: 'follow' | 'stay' | 'script' = 'follow';
  /** outdoors in the wind: shivers a lot */
  cold = false;
  private idleT = 3 + rand.next() * 3;
  private busyT = 0;
  private lostT = 0;
  private barkT = 8;
  /** gap to keep behind Mori */
  gap = 24;

  constructor(readonly a: Actor, readonly host: BuddyHost) {
    a.idleAnim = 'idle';
    a.walkAnim = 'walk';
  }

  /** stop whatever goofy thing he's doing */
  reset() {
    this.busyT = 0;
    this.a.idleAnim = 'idle';
    if (!this.a.walking) this.a.setAnim('idle');
  }

  private pick() {
    const list = GOOFY.filter(g => !g.cold || this.cold);
    let tot = 0;
    for (const g of list) tot += g.w * (g.cold && this.cold ? 2.5 : 1);
    let r = rand.next() * tot;
    for (const g of list) { r -= g.w * (g.cold && this.cold ? 2.5 : 1); if (r <= 0) return g; }
    return list[0];
  }

  update(dt: number) {
    const a = this.a, p = this.host.player;
    if (this.mode !== 'follow') return;
    const sameLevel = Math.abs(a.y - p.y) < 12 && p.state !== 'climb';
    if (!sameLevel) {
      // lost Mori (ladder): after a moment, trot in from somewhere near him on his level
      this.lostT += dt;
      if (p.state !== 'climb' && this.lostT > 1.2) {
        this.lostT = 0;
        const span = this.host.levelSpan?.(p.y) ?? [p.x - 200, p.x + 200];
        const side = p.x - span[0] > span[1] - p.x ? -1 : 1;
        a.x = Math.max(span[0] + 8, Math.min(span[1] - 8, p.x + side * 70));
        a.y = this.host.terrain.surfaceBelow(a.x, p.y - 10, 2)?.y ?? p.y;
        a.alpha = 0;
        a.walkTo(p.x - p.facing * this.gap, 70, 'run');
        if (rand.next() < 0.5) a.showEmote('sweat', 1.2);
      }
      return;
    }
    this.lostT = 0;
    if (a.alpha < 1) a.alpha = Math.min(1, a.alpha + dt * 3);
    const want = p.x - p.facing * this.gap;
    const d = want - a.x;
    const far = Math.abs(d);
    if (far > 70 || (far > 26 && Math.abs(p.vx) < 5 && !a.walking)) {
      if (this.busyT > 0) this.reset();
      const run = far > 110 || Math.abs(p.vx) > 90;
      a.walkAnim = run ? 'run' : 'walk';
      if (!a.walking || far > 40) a.walkTo(want, run ? 120 : Math.max(46, Math.abs(p.vx) * 0.95), a.walkAnim);
      this.idleT = 2 + rand.next() * 3;
      return;
    }
    if (a.walking) return;
    if (this.busyT > 0) {
      this.busyT -= dt;
      if (this.busyT <= 0) this.reset();
      return;
    }
    a.faceTo(p.x);
    this.idleT -= dt;
    if (this.idleT <= 0 && !game.ui.bubbles.active) {
      this.idleT = 4 + rand.next() * 6;
      const g = this.pick();
      if (g.expr) a.setExpr(g.expr, 1.6);
      if (g.emote) a.showEmote(g.emote, 1.4);
      const info = { sit: 5, lie: 6, shiver: 2.5, tilt: 1.8, beg: 1.6 } as Record<string, number>;
      if (info[g.anim]) { a.idleAnim = g.anim; a.setAnim(g.anim); this.busyT = info[g.anim]; }
      else a.play(g.anim, 'idle').catch(() => {});
      if (g.anim === 'sneeze') setTimeout(() => audio.play('callGrunt', { vol: 0.35, pitch: 1.9 }), 300);
    }
    // the odd happy boof
    this.barkT -= dt;
    if (this.barkT <= 0) {
      this.barkT = 14 + rand.next() * 18;
      if (!game.ui.bubbles.active && rand.next() < 0.5) {
        a.play('bark', 'idle').catch(() => {});
        audio.play('callBark', { vol: 0.3, pitch: 0.78 });
        game.ui.bubbles.bark('chunk', rand.pick(['Boof.', 'Snrk.', 'Hff!', 'Wuf?', 'Snorf.']), { expr: 'happy' });
      }
    }
  }
}
