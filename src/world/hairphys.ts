// Hair physics for long locks (Jenna's twin tails; any head with `dyn` locks opts in, see hairDyn7 in
// src/art/v7/head.ts). One damped spring per actor carries the hair's tip after the head:
//  - the tip has inertia, so it lags when she sets off, swings past when she stops and bounces a
//    little on every step of the walk (the head bobs, the tails follow a beat later);
//  - air drag trails it behind her on the move (further at a jog), and the scene wind plus a slow,
//    gusting breeze sway it while she stands;
//  - in a jump it floats up while she falls, slams down on the landing and bounces back past rest;
//  - a turn round leaves it on the old side for a moment (it flips over and settles) with a flick up.
// The renderer only sees the state quantised (swing 7 steps, lift 5) with hysteresis, so the head
// cache stays bounded and the hair never flickers between two neighbouring frames.

/** spring tuning: natural frequency (Hz), damping ratio, air drag (1/s) */
export interface HairSpec { hz?: number; damp?: number; drag?: number }

/** quantised swing (trailing behind: -1 flicked forward .. 2 streaming back) and lift (-1 slammed down .. 1 floating) */
export const HAIR_SWING = { step: 0.5, lo: -1, hi: 2 };
export const HAIR_LIFT = { step: 0.5, lo: -1, hi: 1 };

/** world px of tip travel per unit of swing / lift */
const PX_SWING = 1.0, PX_LIFT = 2.0;

const quant = (v: number, cur: number, q: { step: number; lo: number; hi: number }) => {
  v = Math.max(q.lo, Math.min(q.hi, v));
  // hysteresis: only move to a new step once well past the half-way mark
  return Math.abs(v - cur) > q.step * 0.75 ? Math.round(v / q.step) * q.step : cur;
};

export class HairPhys {
  /** the tip (world px) and its velocity */
  private tx = NaN;
  private ty = 0;
  private vx = 0;
  private vy = 0;
  /** the head anchor last update */
  private ax = 0;
  private ay = 0;
  private face = 0;
  /** its own clock for the breeze (offset per actor, so two heads never sway in step) */
  private t = Math.random() * 10;
  /** quantised, for the renderer (head facing: + trails behind her, + lifts) */
  swing = 0;
  lift = 0;

  constructor(readonly spec: HairSpec = {}) {}

  /**
   * One step. `hx, hy`: the head anchor (world px, y down); `facing`: the way the head is drawn;
   * `wind`: the scene wind (+ blows toward +x); `bias`: the pose's own trailing (0..2, e.g. a sprint).
   */
  update(dt: number, hx: number, hy: number, facing: number, o: { wind?: number; bias?: number } = {}) {
    if (!(dt > 0)) return;
    this.t += dt;
    if (!Number.isFinite(this.tx) || Math.hypot(hx - this.ax, hy - this.ay) > 40) {
      // first sight, or a teleport (a cut, a scene change): start at rest
      this.tx = hx; this.ty = hy; this.vx = this.vy = 0;
      this.ax = hx; this.ay = hy; this.face = facing;
      this.swing = this.lift = 0;
      return;
    }
    const w = 2 * Math.PI * (this.spec.hz ?? 1.7), kk = w * w, c = 2 * (this.spec.damp ?? 0.25) * w, drag = this.spec.drag ?? 3.0;
    // a turn round: the tails are still on the old side (now in front of her) and get flung up a touch
    if (facing !== this.face && this.face !== 0) {
      this.tx += facing * 1.2 * PX_SWING;
      this.ty -= 1.0;
      this.vy -= 6;
    }
    this.face = facing;
    // the breeze: the scene wind with slow gusts (it never quite stops), as an acceleration on the tip
    const t = this.t;
    const gust = Math.sin(t * 1.1) * (0.55 + 0.45 * Math.sin(t * 0.37 + 1.3)) + Math.sin(t * 2.3 + 0.7) * 0.25;
    const windA = (o.wind ?? 0.6) * 30 + gust * 36;
    // sub-step at 60 Hz, the anchor moving at a constant velocity through the frame (each force taken
    // where the anchor is at the start of its sub-step, so the trailing distance doesn't shrink by a
    // frame's worth of travel)
    const n = Math.max(1, Math.round(dt * 60)), h = dt / n;
    const avx = (hx - this.ax) / dt, avy = (hy - this.ay) / dt;
    for (let i = 0; i < n; i++) {
      const px = this.ax + (hx - this.ax) * (i / n), py = this.ay + (hy - this.ay) * (i / n);
      const fx = kk * (px - this.tx) + c * (avx - this.vx) + drag * (0 - this.vx) + windA;
      const fy = kk * (py - this.ty) + c * (avy - this.vy) - drag * 0.6 * this.vy;
      this.vx += fx * h; this.vy += fy * h;
      this.tx += this.vx * h; this.ty += this.vy * h;
    }
    this.ax = hx; this.ay = hy;
    // the tip's offset from rest, in the head's terms (behind her +, up +)
    const ux = this.tx - hx, uy = this.ty - hy;
    this.swing = quant(-ux * facing / PX_SWING + (o.bias ?? 0) * 0.35, this.swing, HAIR_SWING);
    this.lift = quant(-uy / PX_LIFT, this.lift, HAIR_LIFT);
  }
}
