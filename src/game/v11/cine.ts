// V11 in-scene cinematics: story beats happen inside the scene you're in. The camera eases in on the
// characters, the lens racks focus onto them (the renderer's depth of field reads each layer's
// parallax), letterbox bars slide in, time can slow down, and punch-ins snap closer with a radial
// zoom blur. Fast camera moves smear on their own (the renderer's motion blur), so a whip pan is just
// a quick move.
//
// How it runs: a camera director (registered with the Stage) moves the camera of the stage being
// rendered, on real time (slow motion never slows a camera move; pausing stops it), and a frame hook
// eases the renderer's cinematic FX (game.r.cine) toward what the running beats ask for. Nothing here
// keeps running once a beat is over: the everyday lens (gentle depth of field on the extreme
// foreground and background layers, bloom) belongs to the renderer.
//
// Contract (other modules call these; signatures stay):
//   cineTo(stage, shot)        ease onto a shot and hold it there, until cineRelease
//   cineRelease(stage, secs)   hand the camera back to the scene (eases into its own follow camera)
//   cineBars(on)               letterbox bars
//   cineSlowmo(k)              slow motion (1 = normal), ramped
//   cineState                  what is running ({ focus } is the plane in focus, or null)
// Extras: cineShake, cinePunch (zoom-blur punch-in), cineFocusOn (rack focus to an actor, optionally
// framing / tracking it), cineLook (look far through the binoculars: a smooth zoom of the scene with
// a long lens and a handheld sway), cineBlackout (losing consciousness).
import { game } from '../game';
import type { Stage } from '../../world/stage';
import { setCamDirector } from '../../world/stage';
import type { Renderer } from '../../gfx/renderer';
import { restCineFx } from '../../gfx/renderer';

export type CineEase = 'smooth' | 'out' | 'whip' | 'punch' | 'linear';

export interface CineShot {
  /** world point to centre on */
  x: number;
  y: number;
  /** camera zoom (1 = normal) */
  zoom: number;
  /** seconds to get there (default 0.8) */
  secs?: number;
  /** depth of field: the parallax of the plane to keep sharp. 1 = the gameplay plane the cast stands
   *  on (the default when omitted), < 1 further away (0.5: halfway to the horizon), > 1 in front of
   *  it (1.25: the front layer). null = no cinematic depth of field (the everyday lens only). An actor
   *  stands on parallax actor.p. */
  focus?: number | null;
  /** 'smooth' ease in-out (default), 'out' fast start that settles, 'whip' a quick whip pan (motion
   *  blur), 'punch' a snap zoom-in with a radial zoom blur, 'linear' */
  ease?: CineEase;
  /** depth of field strength in the shot: 1 = cinematic (default), 1.5 = long lens, 0.5 = gentle */
  dof?: number;
  /** handheld sway 0..1 while the shot is held (default 0) */
  sway?: number;
}

/** something the lens can focus on and the camera can frame: an Actor, a creature, a prop */
export interface CineSubject {
  x: number;
  y: number;
  /** parallax of its layer (default 1) */
  p?: number;
  /** its height in world px (frames the middle of it; default 40) */
  height?: number;
}

/** what is running (read-only for other modules, except focus, which may be set to rack focus) */
export const cineState = {
  /** the plane in focus for the cinematic depth of field (a parallax, 1 = gameplay plane), or null */
  focus: null as number | null,
  /** cinematic depth of field strength while focus is set */
  dof: 1,
  /** a cineTo shot is moving or held */
  shot: false,
  /** looking far (cineLook / the lookout binoculars) */
  look: false,
  bars: false,
  /** the slow motion asked for (1 = normal) */
  slowmo: 1,
};

type V3 = { x: number; y: number; zoom: number };
interface Move {
  st: Stage;
  phase: 'move' | 'hold' | 'release';
  from: V3;
  to: V3;
  /** the stage's own follow camera, run on a shadow copy during a release */
  nat: V3;
  t: number;
  dur: number;
  ease: CineEase;
  res: (() => void) | null;
  track: { s: CineSubject; zoom: number } | null;
  sway: number;
  /** the frame the director last ran it (a stage that stopped rendering gets its promises resolved) */
  seen: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const EASE: Record<CineEase, (t: number) => number> = {
  smooth: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  whip: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  punch: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  linear: t => t,
};

let move: Move | null = null;
/** binocular / long-lens looks running (nested calls stack) */
let looks: { sway: number; dof: number }[] = [];
/** a subject the lens follows (cineFocusOn) */
let subject: { s: CineSubject; dof: number } | null = null;
/** punch-ins: a radial zoom blur and a zoom kick that decay */
const punches: { t: number; dur: number; blur: number; zoom: number; x: number | null; y: number | null; hold: boolean; ca: number }[] = [];
/** slow-motion ramp */
let slow: { from: number; to: number; t: number; dur: number } | null = null;
/** losing consciousness 0..1 */
let blackoutK = 0, blackoutT = 0;
let lastScene: unknown = null;
let swayT = 0, swayK = 0;
/** frames ticked (the watchdog counts frames, so a frozen world never times a shot out) */
let frameN = 0;

// ---------------------------------------------------------------- shots
function settle(m: Move | null) {
  const r = m?.res;
  if (m) m.res = null;
  r?.();
}

/** the camera centre the stage would clamp a shot to (so a move never eases toward an unreachable point) */
function clampShot(st: Stage, s: V3): V3 {
  const r = game.r;
  const z = Math.max(0.05, s.zoom);
  const halfW = r.VW / 2 / z, halfH = r.VH / 2 / z;
  let x = s.x, y = s.y;
  if (st.maxX - st.minX > halfW * 2) x = Math.min(Math.max(x, st.minX + halfW), st.maxX - halfW);
  else x = (st.minX + st.maxX) / 2;
  if (st.maxY - st.minY > halfH * 2) y = Math.min(Math.max(y, st.minY + halfH), st.maxY - halfH);
  else y = st.maxY - halfH;
  return { x, y, zoom: z };
}

function startMove(stage: Stage, to: V3, secs: number, ease: CineEase, extra: Partial<Move> = {}): Promise<void> {
  ensureRunning();
  const c = stage.cam;
  settle(move);
  c.locked = true;
  const from = { x: c.x, y: c.y, zoom: c.zoom };
  const dest = clampShot(stage, to);
  return new Promise<void>(res => {
    move = { st: stage, phase: 'move', from, to: dest, nat: { ...from }, t: 0, dur: Math.max(0, secs), ease, res, track: null, sway: 0, seen: frameN, ...extra };
    cineState.shot = true;
    if (ease === 'punch') punchFx({ blur: 0.7, zoom: 0, secs: Math.max(0.35, secs * 1.2), x: dest.x, y: dest.y, ca: 0.003 });
    if (secs <= 0) direct(stage, 0, game.r);
  });
}

/** ease the camera onto a shot and hold it there (until cineRelease) */
export async function cineTo(stage: Stage, shot: CineShot): Promise<void> {
  if (shot.focus !== null) {
    cineState.focus = shot.focus ?? 1;
    cineState.dof = shot.dof ?? 1;
  } else cineState.focus = null;
  const secs = shot.secs ?? 0.8;
  await startMove(stage, { x: shot.x, y: shot.y, zoom: shot.zoom }, secs, shot.ease ?? 'smooth', { sway: shot.sway ?? 0 });
}

/** hand the camera back to the scene (eases back to the follow target) */
export async function cineRelease(stage: Stage, secs = 0.6): Promise<void> {
  ensureRunning();
  const c = stage.cam;
  settle(move);
  cineState.focus = null;
  cineState.shot = false;
  subject = null;
  for (const p of punches) p.hold = false;
  const from = { x: c.x, y: c.y, zoom: c.zoom };
  await new Promise<void>(res => {
    move = { st: stage, phase: 'release', from, to: from, nat: { ...from }, t: 0, dur: Math.max(0, secs), ease: 'smooth', res, track: null, sway: 0, seen: frameN };
    if (secs <= 0) direct(stage, 0, game.r);
  });
}

/** letterbox bars for story beats */
export function cineBars(on: boolean): void {
  cineState.bars = on;
  game.ui?.letterbox(on);
}

/** slow motion (1 = normal), ramped over `secs` of real time */
export function cineSlowmo(k: number, secs = 0.25): void {
  ensureRunning();
  const to = Math.max(0.02, Math.min(4, k));
  cineState.slowmo = to;
  if (secs <= 0) { slow = null; game.slowmo = to; return; }
  slow = { from: game.slowmo, to, t: 0, dur: secs };
}

/** a camera shake with a little lens kick (chromatic fringe, a hair of zoom) */
export function cineShake(amount = 6, secs = 0.45, stage: Stage | null = currentStage()): void {
  ensureRunning();
  stage?.shake(amount, secs);
  punchFx({ blur: Math.min(0.35, amount * 0.025), zoom: Math.min(0.04, amount * 0.003), secs: Math.max(0.2, secs * 0.8), x: null, y: null, ca: Math.min(0.006, amount * 0.0006) });
}

export interface PunchOpts {
  /** how much closer, as a fraction of the zoom (default 0.12) */
  zoom?: number;
  /** radial zoom blur 0..1 (default 0.8) */
  blur?: number;
  /** seconds for the kick to settle (default 0.5) */
  secs?: number;
  /** world point to punch toward (stays sharp at the blur's centre; default the view centre) */
  x?: number;
  y?: number;
  /** keep the extra zoom until cineRelease (default false: it springs back) */
  hold?: boolean;
  stage?: Stage;
}
/** a punch-in: the view snaps closer toward a point with a radial zoom blur, then settles */
export function cinePunch(o: PunchOpts = {}): Promise<void> {
  ensureRunning();
  const secs = o.secs ?? 0.5;
  punchFx({ blur: o.blur ?? 0.8, zoom: o.zoom ?? 0.12, secs, x: o.x ?? null, y: o.y ?? null, hold: !!o.hold, ca: 0.004 });
  return wait(secs * 1000);
}

export interface FocusOpts {
  /** depth of field strength (default 1) */
  dof?: number;
  /** also move the camera to frame the subject at this zoom */
  zoom?: number;
  /** seconds for the camera move (default 0.8) */
  secs?: number;
  /** keep the subject framed while it moves (needs zoom) */
  track?: boolean;
  ease?: CineEase;
  stage?: Stage;
}
/** rack focus onto a subject (an actor); with `zoom`, frame it too (and follow it with `track`).
 *  null racks focus back to the shot (or to the everyday lens). Resolves when focus and camera are there. */
export async function cineFocusOn(s: CineSubject | null, o: FocusOpts = {}): Promise<void> {
  ensureRunning();
  if (!s) {
    subject = null;
    if (move?.track) move.track = null;
    await wait(350);
    return;
  }
  subject = { s, dof: o.dof ?? 1 };
  const stage = o.stage ?? currentStage();
  if (o.zoom !== undefined && stage) {
    const h = s.height ?? 40;
    const p = startMove(stage, { x: s.x, y: s.y - h * 0.55, zoom: o.zoom }, o.secs ?? 0.8, o.ease ?? 'smooth', { track: o.track ? { s, zoom: o.zoom } : null });
    cineState.focus = s.p ?? 1;
    cineState.dof = o.dof ?? 1;
    await p;
    return;
  }
  await wait(450);
}

export interface LookOpts {
  /** handheld sway 0..1 (default 1) */
  sway?: number;
  /** depth of field (default 1.45: a long lens) */
  dof?: number;
  /** seconds to ease back to the scene's camera afterwards (default 1.1; 0 = leave the camera to the caller) */
  release?: number;
}
/**
 * Look far (the lookout binoculars): while fn runs, the normal scene is seen through a long lens: a
 * shallow depth of field on the gameplay plane, a subtle handheld sway, zoom blur on every push-in
 * (fn moves the camera as it likes, e.g. with the story's pan). Afterwards the camera eases back.
 */
export async function cineLook<T>(stage: Stage, fn: () => Promise<T>, o: LookOpts = {}): Promise<T> {
  ensureRunning();
  const me = { sway: o.sway ?? 1, dof: o.dof ?? 1.45 };
  looks.push(me);
  cineState.look = true;
  try {
    return await fn();
  } finally {
    looks = looks.filter(l => l !== me);
    cineState.look = looks.length > 0;
    if ((o.release ?? 1.1) > 0) await cineRelease(stage, o.release ?? 1.1);
  }
}

/** losing consciousness: the image swims out of focus, the edges close in and it goes dark. Resolves
 *  when it is black (the caller then holds or fades; cineBlackout(0) clears it). */
export function cineBlackout(secs = 0.7): Promise<void> {
  ensureRunning();
  if (secs <= 0) { blackoutK = 0; blackoutT = 0; return Promise.resolve(); }
  blackoutT = secs;
  return wait(secs * 1000);
}

// ---------------------------------------------------------------- per frame
function wait(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}
function currentStage(): Stage | null {
  return (game.scene as unknown as { st?: Stage } | null)?.st ?? null;
}
function punchFx(p: { blur: number; zoom: number; secs: number; x: number | null; y: number | null; hold?: boolean; ca: number }) {
  punches.push({ t: 0, dur: Math.max(0.05, p.secs), blur: p.blur, zoom: p.zoom, x: p.x, y: p.y, hold: !!p.hold, ca: p.ca });
  if (punches.length > 6) punches.shift();
}
/** a punch's envelope: a fast attack, then it settles (held punches keep their zoom) */
function punchEnv(p: (typeof punches)[number]) {
  const a = 0.07;
  const up = clamp01(p.t / a);
  const down = 1 - clamp01((p.t - a) / Math.max(0.01, p.dur - a));
  const blur = up * down * down;
  const zoom = p.hold ? EASE.out(up) : up * (down * down * (3 - 2 * down));
  return { blur, zoom };
}

/** the camera director: runs inside Stage.updateCamera for each stage being rendered */
function direct(st: Stage, dt: number, r: Renderer) {
  const c = st.cam;
  const rdt = game.rdt;
  const m = move;
  if (m && m.st === st) {
    m.seen = frameN;
    if (m.phase === 'move') {
      m.t += rdt;
      const k = m.dur <= 0 ? 1 : clamp01(m.t / m.dur);
      const e = EASE[m.ease](k);
      c.locked = true;
      c.x = lerp(m.from.x, m.to.x, e);
      c.y = lerp(m.from.y, m.to.y, e);
      // zoom in log space: a steady push-in, not one that rushes at the start
      c.zoom = m.from.zoom * Math.pow(m.to.zoom / Math.max(1e-3, m.from.zoom), e);
      if (k >= 1) {
        m.phase = 'hold';
        settle(m);
      }
    } else if (m.phase === 'hold') {
      if (!c.locked) {
        // the scene took its camera back (its cutscene ended): the shot is over
        move = null;
        cineState.shot = false;
        if (!subject) cineState.focus = null;
      } else if (m.track) {
        const h = m.track.s.height ?? 40;
        const to = clampShot(st, { x: m.track.s.x, y: m.track.s.y - h * 0.55, zoom: m.track.zoom });
        const k = 1 - Math.exp(-rdt * 4);
        c.x += (to.x - c.x) * k;
        c.y += (to.y - c.y) * k;
        c.zoom += (to.zoom - c.zoom) * k;
      }
    } else {
      m.t += rdt;
      const k = m.dur <= 0 ? 1 : clamp01(m.t / m.dur);
      const e = EASE.smooth(k);
      c.locked = false;
      // the stage's own follow camera, on a shadow copy, so the hand-off at the end is seamless
      const n = m.nat;
      n.zoom += (c.tzoom - n.zoom) * (1 - Math.exp(-c.zoomLerp * dt));
      n.x += (c.tx - n.x) * (1 - Math.exp(-c.follow * dt));
      n.y += (c.ty - n.y) * (1 - Math.exp(-c.follow * dt));
      c.x = lerp(m.from.x, n.x, e);
      c.y = lerp(m.from.y, n.y, e);
      c.zoom = m.from.zoom * Math.pow(n.zoom / Math.max(1e-3, m.from.zoom), e);
      if (k >= 1) {
        move = null;
        settle(m);
      }
    }
  }
}

/** handheld sway and punch-ins, on the rendered view only (after the stage has set it) */
function directView(st: Stage, _dt: number, r: Renderer) {
  const m = move, v = r.view, rdt = game.rdt;
  const want = Math.max(lookSway(), m && m.st === st && m.phase !== 'release' ? m.sway : 0);
  swayK += (want - swayK) * (1 - Math.exp(-rdt * 3));
  const sway = swayK, t = swayT;
  if (sway > 0.001) {
    // a hand holding a long lens: slow drift, a breathing bob and a little tremor (world px, so the
    // screen sway grows with the zoom like a real one)
    v.x += sway * (Math.sin(t * 1.31) * 1.1 + Math.sin(t * 2.87 + 1.2) * 0.55 + Math.sin(t * 6.3 + 2.1) * 0.12 + Math.sin(t * 0.37) * 1.4);
    v.y += sway * (Math.cos(t * 1.13) * 0.8 + Math.sin(t * 3.71 + 0.4) * 0.35 + Math.sin(t * 0.29 + 1) * 0.9);
  }
  for (const p of punches) {
    const mz = 1 + p.zoom * punchEnv(p).zoom;
    if (mz <= 1) continue;
    if (p.x !== null && p.y !== null) {
      // keep the punch's point where it is on screen while the view closes in on it
      v.x += (p.x - v.x) * (1 - 1 / mz);
      v.y += (p.y - v.y) * (1 - 1 / mz);
    }
    v.zoom *= mz;
  }
}
function lookSway() {
  let s = 0;
  for (const l of looks) s = Math.max(s, l.sway);
  return s;
}

/** the frame hook: eases the renderer's cinematic FX toward what the running beats ask for */
function tick(rdt: number) {
  const r = game.r;
  if (!r) return;
  // a new scene starts clean (a beat that never released its shot does not follow it in)
  frameN++;
  if (game.scene !== lastScene) {
    lastScene = game.scene;
    if (move) { settle(move); move = null; }
    looks = [];
    subject = null;
    punches.length = 0;
    blackoutK = 0;
    blackoutT = 0;
    swayK = 0;
    cineState.focus = null;
    cineState.shot = cineState.look = false;
    Object.assign(r.cine, restCineFx());
  }
  // a stage that stopped rendering (while the game still draws frames) never strands a promise
  if (move && frameN - move.seen > 40) { settle(move); move = null; cineState.shot = false; }
  if (rdt <= 0) return;
  swayT += rdt;
  const fx = r.cine;
  const k = (rate: number) => 1 - Math.exp(-rdt * rate);
  // ---- targets
  let focus = 1, dof = 0, defocus = 0, vignette = 0, bloom = 0, desat = 0, exposure = 0, dolly = 1, motion = 1;
  if (cineState.focus !== null) { focus = cineState.focus; dof = Math.max(dof, cineState.dof); }
  if (subject) { focus = subject.s.p ?? 1; dof = Math.max(dof, subject.dof); }
  for (const l of looks) {
    dof = Math.max(dof, l.dof);
    dolly = Math.max(dolly, 3.2);
    motion = Math.max(motion, 1.3);
    vignette = Math.max(vignette, 0.12);
    bloom = Math.max(bloom, 0.08);
  }
  if (move && move.phase === 'move' && move.ease === 'whip') motion = Math.max(motion, 1.8);
  // the close-up cut-ins: rack focus off the scene behind the band
  const cu = (game.ui as unknown as { bubbles?: { cu?: { active?: boolean } } } | undefined)?.bubbles?.cu;
  if (cu?.active) defocus = Math.max(defocus, 2.2);
  // slow motion reads heavier: the edges close in a touch, the colour drains a little
  const sk = clamp01(1 - game.slowmo);
  vignette += sk * 0.22;
  desat += sk * 0.14;
  // losing consciousness
  if (blackoutT > 0) blackoutK = Math.min(1, blackoutK + rdt / blackoutT);
  if (blackoutK > 0) {
    const b = blackoutK;
    defocus = Math.max(defocus, 9 * b);
    vignette += 2.6 * b * b;
    desat += 0.6 * b;
    exposure -= 2.5 * b * b * b;
  }
  // ---- ease (the renderer racks from the gameplay plane to fx.focus as fx.dof comes in)
  if (fx.dof < 0.04) fx.focus = focus;
  else fx.focus += (focus - fx.focus) * k(5);
  fx.dof += (dof - fx.dof) * k(dof > fx.dof ? 4 : 3);
  if (Math.abs(fx.dof - dof) < 0.002) fx.dof = dof;
  fx.defocus += (defocus - fx.defocus) * k(blackoutK > 0 ? 30 : 9);
  if (fx.defocus < 0.02 && defocus === 0) fx.defocus = 0;
  fx.vignette += (vignette - fx.vignette) * k(blackoutK > 0 ? 30 : 4);
  fx.bloom += (bloom - fx.bloom) * k(4);
  fx.desat += (desat - fx.desat) * k(blackoutK > 0 ? 30 : 4);
  fx.exposure += (exposure - fx.exposure) * k(blackoutK > 0 ? 40 : 6);
  fx.dolly += (dolly - fx.dolly) * k(4);
  fx.motion = motion;
  // ---- punches
  let zb = 0, ca = 0, zx = fx.zoomX, zy = fx.zoomY, best = 0;
  for (let i = punches.length - 1; i >= 0; i--) {
    const p = punches[i];
    p.t += rdt;
    const env = punchEnv(p);
    const b = p.blur * env.blur;
    zb += b;
    ca += p.ca * env.blur;
    if (b > best) {
      best = b;
      if (p.x !== null && p.y !== null) { zx = clamp01(r.projectX(p.x, 1) / r.VW); zy = clamp01(r.projectY(p.y, 1) / r.VH); }
      else { zx = 0.5; zy = 0.5; }
    }
    if (p.t >= p.dur && !p.hold) punches.splice(i, 1);
  }
  fx.zoomBlur = Math.min(1, zb);
  fx.zoomX = zx;
  fx.zoomY = zy;
  fx.ca = ca;
  // ---- slow motion ramp
  if (slow) {
    slow.t += rdt;
    const e = EASE.smooth(clamp01(slow.t / slow.dur));
    game.slowmo = lerp(slow.from, slow.to, e);
    if (slow.t >= slow.dur) { game.slowmo = slow.to; slow = null; }
  }
}

let running = false;
function ensureRunning() {
  if (running) return;
  running = true;
  setCamDirector({ move: direct, view: directView });
  game.frameHooks.push(tick);
}
// the director is wanted as soon as anything imports this module (the binoculars, a story beat)
ensureRunning();
