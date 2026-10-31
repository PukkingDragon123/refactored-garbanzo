// Live body (the player, user: "realistic animation, not janky, super realistic, physics based").
// The Actor still runs the clips (anim names, transitions, laid-over gestures, the anim contract); for
// a live character this draws them continuously instead of from a few cached frames:
//  - every clip is drawn at fine phase steps (4 per frame for the distance-driven walk: ~50 a second
//    at his pace) from its continuous pose function, and any change of clip crossfades in 3D from the
//    pose that was on screen, so nothing snaps
//  - physics on top (motion7.ts), each a damped spring fed by how he actually moves: the lean into an
//    acceleration and back against braking, the knees absorbing a landing (deeper the further he
//    fell) and loading before a jump, the arms swinging on with their own inertia, the weight drifting
//    from foot to foot as he stands, the airborne pose from the vertical speed, the feet set on the
//    slope under them
//  - the walk's pace follows his speed (shorter, slower steps when he ambles: 'walk~0.5'), changed only
//    at mid-stance, where it moves neither the planted foot nor the swinging one
//  - planted feet: the walk advances by distance and the sprite is drawn where the body was at the
//    frame's own phase, so the foot on the ground stays on the same spot through the whole stance
// Frames are keyed by the quantised clip, phase and motion and kept in a bounded store (framepool.ts).

export interface LiveMotion { lean?: number; dip?: number; slope?: number; arm?: number; shift?: number; air?: number }
export interface LiveArtFrame { ax: number; ay: number; hy: number; k?: number; pts?: Record<string, [number, number]> }
export interface LiveArt<A> {
  renderLive(id: string, anim: string, frame: number, mo: LiveMotion, from?: { anim: string; frame: number; u: number; mo?: LiveMotion }): A;
  quantMotion7(m: LiveMotion): LiveMotion;
  motionKey7(m: LiveMotion): string;
}
/** where the frames go (the Actor: a bounded texture pool) */
export interface LiveStore<A, F> { get(key: string): F | undefined; put(key: string, art: A): F }
/** the clip to draw, as the Actor plays it */
export interface LiveClip {
  anim: string;
  /** continuous frame (fractional) */
  frame: number;
  frames: number;
  fps: number;
  loop: boolean;
  /** px per cycle for distance-driven clips */
  dist?: number;
  /** a held frame (ladder rungs, scripted holds): drawn as it is */
  hold?: boolean;
}

/** his own walking pace (px/s): pace 1 */
export const LIVE_WALK_SPEED = 60;
/** how long a change of clip crossfades (s); into a turn round, done before the half-way flip */
const BLEND = 0.15;
const BLEND_INTO: Record<string, number> = { turn: 0.07, jump: 0.2 };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const base = (a: string) => { const i = a.indexOf('~'); return i < 0 ? a : a.slice(0, i); };
/** clips that bring their own blend in and out (laid-over crossfades, the turn) */
const OWN_BLEND = new Set(['blend', 'climb', 'climbIdle', 'carryPupClimb']);

/** a damped spring toward a target (semi-implicit Euler, sub-stepped for stability) */
class Spring {
  x = 0;
  v = 0;
  constructor(public w: number, public z: number) {}
  step(target: number, dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (this.w * this.w * (target - this.x) - 2 * this.z * this.w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}

export class LiveBody<A extends LiveArtFrame, F> {
  /** the lean into acceleration (rad) */
  readonly lean = new Spring(10, 0.8);
  /** the arms' own swing (rad): a loose pendulum */
  readonly arm = new Spring(6.5, 0.32);
  /** knees bent 0..1: landings and jump wind-ups */
  readonly dip = new Spring(15, 0.62);
  /** the head riding on the neck (world px): follows through a hard landing */
  private head = new Spring(20, 0.7);
  private headInit = false;
  private dipHold = 0;
  private dipTarget = 0;
  /** the walk's pace (fraction of his own), latched at mid-stance */
  pace = 0.375;
  private paceTarget = 0.375;
  private vs = 0;
  private as = 0;
  private px = NaN;
  private t = 0;
  private motion: LiveMotion = {};
  /** the last frame drawn and its clip and quantised frame */
  frame: F | null = null;
  key = '';
  private last: { anim: string; qf: number; mo: LiveMotion } | null = null;
  private blend: { anim: string; frame: number; mo: LiveMotion; t: number; dur: number } | null = null;
  /** world px to draw the sprite ahead of (+) the Actor's x along its facing (the walk's frame phase) */
  dx = 0;
  /** renders allowed this tick (a burst of new poses never stalls a frame: the last one holds) */
  budget = 2;
  /** the next clip change is seamless (a transition clip that starts or ends where the last one was) */
  seamless = false;
  /** stats */
  renders = 0;

  constructor(readonly art: LiveArt<A>, readonly store: LiveStore<A, F>) {}

  /** the walk clip at the current pace ('walk~0.625') */
  walkClip() { return 'walk~' + this.pace; }

  /**
   * Physics for one tick: s.x his position, s.facing, s.air the vertical speed while airborne (null on
   * the ground), s.slope the ground's rise per px toward the facing, s.standing standing about.
   */
  step(dt: number, s: { x: number; facing: number; air: number | null; slope: number; standing: boolean }) {
    if (dt <= 0) return;
    this.t += dt;
    const v = Number.isFinite(this.px) ? (s.x - this.px) / dt : 0;
    this.px = s.x;
    // velocity and acceleration, lightly smoothed (frame-time jitter would otherwise twitch the lean)
    const v0 = this.vs;
    this.vs += (clamp(v, -400, 400) - this.vs) * Math.min(1, dt * 18);
    this.as += ((this.vs - v0) / dt - this.as) * Math.min(1, dt * 10);
    const af = this.as * s.facing;
    const ground = s.air === null;
    // the lean: into an acceleration, back against braking (none in the air)
    this.lean.step(ground ? clamp(af * 0.00045, -0.11, 0.13) : 0, dt);
    // the arms swing on with their own inertia (forward as he brakes, back as he sets off)
    this.arm.step(ground ? clamp(-af * 0.0009, -0.2, 0.22) : 0, dt);
    // the knees: a wind-up held for its moment, landings kicked in as a velocity
    if (this.dipHold > 0) { this.dipHold -= dt; if (this.dipHold <= 0) this.dipTarget = 0; }
    this.dip.step(this.dipTarget, dt);
    if (this.dip.x < 0) { this.dip.x = 0; this.dip.v = Math.max(0, this.dip.v); }
    if (this.dip.x > 1) { this.dip.x = 1; this.dip.v = Math.min(0, this.dip.v); }
    // the pace the speed asks for (applied by latch() at mid-stance)
    this.paceTarget = clamp(Math.round((Math.abs(this.vs) / LIVE_WALK_SPEED) * 8) / 8, 0.375, 1.25);
    // standing: the weight drifts from foot to foot on its own slow, uneven cycle
    const shift = s.standing ? Math.sin((this.t / 9.3) * Math.PI * 2) * 0.7 + Math.sin((this.t / 3.7) * Math.PI * 2 + 1.3) * 0.3 : 0;
    this.motion = this.art.quantMotion7({
      lean: this.lean.x,
      arm: this.arm.x,
      dip: this.dip.x,
      slope: ground ? clamp(s.slope, -0.5, 0.5) : 0,
      shift,
      air: ground ? undefined : clamp(s.air! / 150, -1, 1),
    });
    if (this.blend) this.blend.t += dt;
  }

  /** knees loaded before a jump (k 0..1, for `secs`) */
  windUp(k: number, secs: number) { this.dipTarget = k; this.dipHold = secs; }
  /** a landing at vertical speed vy (px/s): absorbed in the knees, deeper the harder it was */
  landed(vy: number) {
    const peak = clamp((vy - 40) / 240, 0.1, 0.85);
    this.dip.v += peak * this.dip.w / 0.49;
    this.dipTarget = 0;
  }

  /**
   * The walk's pace may change now: walking, only as the stride passes mid-stance (0.3 or 0.8 of the
   * cycle, between the phases a last tick and b this tick), and by at most a quarter at a time (he
   * speeds up with short quick steps that lengthen); not walking, whenever (`busy`: never while a
   * transition such as setting off is under way). True when it changed.
   */
  latch(walking: boolean, busy: boolean, a: number, b: number): boolean {
    if (this.pace === this.paceTarget || busy) return false;
    const cross = (m: number) => (a <= b ? a < m && b >= m : a < m || b >= m);
    if (!walking) { this.pace = this.paceTarget; return true; }
    if (!cross(0.3) && !cross(0.8)) return false;
    this.pace = this.pace + clamp(this.paceTarget - this.pace, -0.25, 0.25);
    return true;
  }

  /** what to draw for a clip this tick (renders it if it's new and the budget allows) */
  /** the sub-frame of a clip on screen now (undefined if something else is) */
  shownAt(anim: string): number | undefined { return this.last && this.last.anim === anim ? this.last.qf : undefined; }

  pick(id: string, c: LiveClip): F | null {
    const dd = !!c.dist && !c.hold;
    const sub = dd ? 4 : c.fps <= 8 ? 2 : clamp(Math.round(48 / c.fps), 1, 4);
    const qf = c.hold ? Math.round(c.frame) : Math.floor(c.frame * sub + 1e-6) / sub;
    // a new clip: crossfade from the pose on screen (unless it bridges itself)
    if (this.last && base(this.last.anim) !== base(c.anim)) {
      const own = OWN_BLEND.has(base(c.anim)) || OWN_BLEND.has(base(this.last.anim)) || c.hold;
      this.blend = this.seamless || own ? null : { anim: this.last.anim, frame: this.last.qf, mo: this.last.mo, t: 0, dur: BLEND_INTO[base(c.anim)] ?? BLEND };
    }
    this.seamless = false;
    let u = 1;
    if (this.blend) {
      u = Math.round(smooth(this.blend.t / this.blend.dur) * 10) / 10;
      if (u >= 1) this.blend = null;
    }
    const mo = this.motion;
    const bl = this.blend;
    const key = `${id}|${c.anim}@${qf}|${this.art.motionKey7(mo)}${bl ? `|${bl.anim}@${bl.frame}/${this.art.motionKey7(bl.mo)}:${u.toFixed(3)}` : ''}`;
    let f = this.store.get(key);
    if (!f && (this.budget > 0 || !this.frame)) {
      this.budget--;
      this.renders++;
      f = this.store.put(key, this.art.renderLive(id, c.anim, qf, mo, bl ? { anim: bl.anim, frame: bl.frame, u, mo: bl.mo } : undefined));
    }
    if (f) { this.frame = f; this.key = key; this.last = { anim: c.anim, qf, mo }; }
    // the walk's frame phase: draw the body where it was at the drawn frame, so the planted foot holds
    // still between steps instead of being carried along by the sub-step remainder
    this.dx = 0;
    if (dd && this.last && this.last.anim === c.anim) {
      let d = c.frame - this.last.qf;
      if (c.loop) { d = ((d % c.frames) + c.frames) % c.frames; if (d > c.frames / 2) d -= c.frames; }
      this.dx = -d * (c.dist! / c.frames);
    }
    return this.frame;
  }

  /**
   * The head's follow-through: it rides the neck on a stiff spring, so a hard landing leaves it a
   * pixel behind for a moment. Returns the offset (world px), whole buffer pixels only.
   */
  headLag(neckY: number, k: number, dt: number): number {
    if (!this.headInit || Math.abs(this.head.x - neckY) > 12) { this.head.x = neckY; this.head.v = 0; this.headInit = true; }
    this.head.step(neckY, dt);
    return clamp(Math.round((this.head.x - neckY) * k), -1, 1) / k;
  }
}
