// Chunk the pug as a companion. Two free-roam behaviours, plus the story's own control:
//  wander  (the ship, the island camp) he lives his own life: pootles about sniffing, sits, flops,
//          naps, visits his food bowl and his bed, and now and then trots over to see what Mori is up
//          to. When it's calm he changes deck "his own way" (trots to a ladder, vanishes, turns up at the
//          other end a moment later); in rough weather he stays on the deck he's on.
//  follow  (the island walks) waddles after Mori, gets distracted, fills every quiet moment with
//          something goofy. He can't climb ladders, so when Mori changes level he turns up shortly after.
//  stay / script  the story has him (placed, posed, walked by hand).
// `release()` hands him back to whichever free-roam behaviour this scene uses (`free`).

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
  /** wander: the scene is busy (a cutscene): he doesn't start anything new */
  busy?(): boolean;
}

/** somewhere Chunk likes to be: his bowl, his bed, a sunny spot */
export interface Haunt { x: number; y: number; anim: string; dur: [number, number]; expr?: string; face?: 1 | -1; w?: number }
/** a way to another deck from here (ladder foot at x, coming out at `to`) */
export interface Hop { x: number; to: [number, number] }

export type BuddyMode = 'follow' | 'wander' | 'stay' | 'script';

const GOOFY: { anim: string; w: number; expr?: string; emote?: string; cold?: boolean }[] = [
  { anim: 'sniff', w: 3 }, { anim: 'sit', w: 3 }, { anim: 'scratch', w: 2 }, { anim: 'yawn', w: 1.5, expr: 'tired' },
  { anim: 'wiggle', w: 1.5, expr: 'happy' }, { anim: 'spin', w: 1.2, expr: 'excited' }, { anim: 'roll', w: 1, expr: 'happy' },
  { anim: 'flop', w: 1, expr: 'derp' }, { anim: 'sneeze', w: 1, expr: 'surprised' }, { anim: 'tilt', w: 1.5, expr: 'thinking' },
  { anim: 'beg', w: 1, expr: 'excited', emote: 'heart' }, { anim: 'lie', w: 2 }, { anim: 'shake', w: 0.8 },
  { anim: 'shiver', w: 2.5, expr: 'sad', cold: true },
];
/** looping poses held for a while (seconds) */
const HOLD: Record<string, number> = { sit: 5, lie: 6, shiver: 2.5, tilt: 1.8, beg: 1.6 };

export class ChunkBuddy {
  mode: BuddyMode = 'follow';
  /** the free-roam behaviour `release()` returns him to */
  free: 'follow' | 'wander' = 'follow';
  /** outdoors in the wind: shivers a lot */
  cold = false;
  /** wander: x-range to roam (default: the level span at his height) */
  wanderSpan: (() => [number, number]) | null = null;
  /** wander: favourite spots (only the ones on his current level are used) */
  haunts: (() => Haunt[]) | null = null;
  /** wander: a ladder hop from where he is, or null when changing deck isn't safe right now */
  hop: ((a: Actor) => Hop | null) | null = null;
  private idleT = 3 + rand.next() * 3;
  private busyT = 0;
  private lostT = 0;
  private barkT = 8;
  /** wander: what to do when the current walk ends */
  private arrive: (() => void) | null = null;
  /** wander: mid ladder-hop (fading out at the foot, then in at the other end) */
  private hopping: { t: number; to: [number, number] } | null = null;
  /** wander: last time he went to see Mori (game seconds of wandering) */
  private sinceVisit = 0;
  /** fading in after turning up (come) */
  private fading = false;
  /** gap to keep behind Mori */
  gap = 24;

  constructor(readonly a: Actor, readonly host: BuddyHost) {
    a.idleAnim = 'idle';
    a.walkAnim = 'walk';
  }

  /** stop whatever goofy thing he's doing */
  reset() {
    this.busyT = 0;
    this.arrive = null;
    if (this.hopping) { this.hopping = null; this.a.alpha = 1; }
    this.a.idleAnim = 'idle';
    if (!this.a.walking) this.a.setAnim('idle');
  }

  /** the story is done with him: back to his free-roam behaviour */
  release() {
    this.mode = this.free;
    this.reset();
    this.idleT = 1.5 + rand.next() * 2;
  }

  /** on Mori's level (and not mid-hop)? */
  withMori() {
    const a = this.a, p = this.host.player;
    return Math.abs(a.y - p.y) < 12 && p.state !== 'climb' && !this.hopping;
  }

  /**
   * call him over (the story wants him by Mori): walks over if he's on Mori's deck, otherwise turns up
   * from the far side of Mori's deck. Leaves him in 'stay' mode; resolves when he's there.
   */
  come(x = this.host.player.x + this.host.player.facing * 20, speed = 70): Promise<void> {
    const a = this.a, p = this.host.player;
    this.mode = 'stay';
    this.reset();
    if (!this.withMori() || a.alpha < 0.5) {
      const span = this.host.levelSpan?.(p.y) ?? [p.x - 200, p.x + 200];
      const side = x >= p.x ? 1 : -1;
      a.x = Math.max(span[0] + 8, Math.min(span[1] - 8, p.x + side * 80));
      a.y = this.host.terrain.surfaceBelow(a.x, p.y - 10, 2)?.y ?? p.y;
      a.alpha = 0;
    }
    if (a.alpha < 1) { a.alpha = Math.max(a.alpha, 0.01); this.fading = true; }
    return a.walkTo(x, speed, speed > 85 ? 'run' : 'walk').then(() => { a.faceTo(p.x); });
  }

  private pick() {
    const list = GOOFY.filter(g => !g.cold || this.cold);
    let tot = 0;
    for (const g of list) tot += g.w * (g.cold && this.cold ? 2.5 : 1);
    let r = rand.next() * tot;
    for (const g of list) { r -= g.w * (g.cold && this.cold ? 2.5 : 1); if (r <= 0) return g; }
    return list[0];
  }

  /** one goofy thing on the spot */
  private goofy(faceMori: boolean) {
    const a = this.a;
    if (faceMori) a.faceTo(this.host.player.x);
    const g = this.pick();
    if (g.expr) a.setExpr(g.expr, 1.6);
    if (g.emote) a.showEmote(g.emote, 1.4);
    if (HOLD[g.anim]) { a.idleAnim = g.anim; a.setAnim(g.anim); this.busyT = HOLD[g.anim]; }
    else a.play(g.anim, 'idle').catch(() => {});
    if (g.anim === 'sneeze') setTimeout(() => audio.play('callGrunt', { vol: 0.35, pitch: 1.9 }), 300);
  }

  /** the odd happy boof */
  private boof(dt: number) {
    this.barkT -= dt;
    if (this.barkT > 0) return;
    this.barkT = 14 + rand.next() * 18;
    const p = this.host.player, a = this.a;
    const near = Math.abs(a.x - p.x) < 160 && Math.abs(a.y - p.y) < 40;
    if (near && !game.ui.bubbles.active && a.alpha > 0.5 && rand.next() < 0.5) {
      a.play('bark', a.idleAnim).catch(() => {});
      audio.play('callBark', { vol: 0.3, pitch: 0.78 });
      game.ui.bubbles.bark('chunk', rand.pick(['Boof.', 'Snrk.', 'Hff!', 'Wuf?', 'Snorf.']), { expr: 'happy' });
    }
  }

  update(dt: number) {
    if (this.fading) { this.a.alpha = Math.min(1, this.a.alpha + dt * 3); if (this.a.alpha >= 1) this.fading = false; }
    if (this.mode === 'wander') return this.wander(dt);
    if (this.mode !== 'follow') return;
    const a = this.a, p = this.host.player;
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
      this.goofy(true);
    }
    this.boof(dt);
  }

  // ---------------------------------------------------------------- wander
  private span(): [number, number] {
    if (this.wanderSpan) return this.wanderSpan();
    return this.host.levelSpan?.(this.a.y) ?? [this.a.x - 150, this.a.x + 150];
  }

  private wander(dt: number) {
    const a = this.a, p = this.host.player;
    this.sinceVisit += dt;
    // a ladder hop: fade out at the foot, reappear at the other end
    const h = this.hopping;
    if (h) {
      h.t += dt;
      a.alpha = h.t < 0.35 ? Math.max(0, 1 - h.t / 0.35) : 0;
      if (h.t >= 2.2) {
        a.x = h.to[0]; a.y = h.to[1];
        this.hopping = null;
        a.alpha = 0.01;
        const [lo, hi] = this.span();
        const to = Math.max(lo + 4, Math.min(hi - 4, a.x + rand.pick([-1, 1]) * rand.range(18, 40)));
        void a.walkTo(to, 34, 'walk');
        if (rand.next() < 0.4) a.showEmote('sweat', 1.2);
      }
      return;
    }
    if (a.alpha < 1) a.alpha = Math.min(1, a.alpha + dt * 3);
    if (this.host.busy?.()) { this.arrive = null; return; }
    // keep inside the roaming range (a scene change of floor, a story placement)
    const [lo, hi] = this.span();
    if (!a.walking && (a.x < lo - 2 || a.x > hi + 2)) { void a.walkTo(Math.max(lo + 6, Math.min(hi - 6, a.x)), 40, 'walk'); return; }
    if (a.walking) return;
    if (this.arrive) { const f = this.arrive; this.arrive = null; f(); return; }
    if (this.busyT > 0) {
      this.busyT -= dt;
      if (this.busyT <= 0) this.reset();
      this.boof(dt);
      return;
    }
    this.idleT -= dt;
    this.boof(dt);
    if (this.idleT > 0 || game.ui.bubbles.active) return;
    this.idleT = 2.5 + rand.next() * 4;
    const near = Math.abs(a.y - p.y) < 12 && p.state !== 'climb';
    const r = rand.next();
    // go and see what Mori's doing (more likely the longer it's been)
    if (near && r < 0.12 + Math.min(0.3, this.sinceVisit / 200) && Math.abs(p.x - a.x) < 260) {
      this.sinceVisit = 0;
      const side = a.x < p.x ? -1 : 1;
      const to = Math.max(lo + 4, Math.min(hi - 4, p.x + side * rand.range(14, 22)));
      void a.walkTo(to, Math.abs(to - a.x) > 90 ? 70 : 44, Math.abs(to - a.x) > 90 ? 'run' : 'walk');
      this.arrive = () => {
        a.faceTo(p.x);
        const k = rand.next();
        if (k < 0.35) { a.idleAnim = 'sit'; a.setAnim('sit'); this.busyT = 4 + rand.next() * 4; }
        else if (k < 0.6) { a.idleAnim = 'beg'; a.setAnim('beg'); a.showEmote('heart', 1.4); this.busyT = 2.2; }
        else if (k < 0.8) { a.play('wiggle', 'idle').catch(() => {}); a.setExpr('happy', 2); }
        else { a.idleAnim = 'lie'; a.setAnim('lie'); this.busyT = 6 + rand.next() * 5; }
      };
      return;
    }
    // a favourite spot on this level
    const spots = (this.haunts?.() ?? []).filter(s => Math.abs(s.y - a.y) < 12 && s.x > lo - 2 && s.x < hi + 2);
    if (spots.length && r < 0.42) {
      let tot = 0;
      for (const s of spots) tot += s.w ?? 1;
      let k = rand.next() * tot;
      const s = spots.find(q => (k -= q.w ?? 1) <= 0) ?? spots[0];
      void a.walkTo(s.x, Math.abs(s.x - a.x) > 120 ? 60 : 36, Math.abs(s.x - a.x) > 120 ? 'run' : 'walk');
      this.arrive = () => {
        if (s.face) a.facing = s.face;
        a.idleAnim = s.anim; a.setAnim(s.anim);
        if (s.expr) a.setExpr(s.expr, s.dur[1]);
        this.busyT = rand.range(s.dur[0], s.dur[1]);
      };
      return;
    }
    // another deck (only when it's calm: the host decides)
    if (r < 0.5 && this.hop) {
      const hp = this.hop(a);
      if (hp) {
        void a.walkTo(hp.x, 40, 'walk');
        this.arrive = () => { this.hopping = { t: 0, to: hp.to }; };
        return;
      }
    }
    // pootle about, nose down
    if (r < 0.8) {
      const dist = rand.range(30, 130) * rand.pick([-1, 1]);
      let to = a.x + dist;
      if (to < lo + 4 || to > hi - 4) to = a.x - dist;
      to = Math.max(lo + 4, Math.min(hi - 4, to));
      const sniff = rand.next() < 0.45;
      void a.walkTo(to, sniff ? 16 : 30, sniff ? 'sniff' : 'walk');
      this.arrive = () => { if (rand.next() < 0.5) this.goofy(false); };
      return;
    }
    this.goofy(near && Math.abs(p.x - a.x) < 120);
  }
}
