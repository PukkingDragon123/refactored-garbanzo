/**
 * Realistic 3D arms and hands for close-ups and minigames.
 *
 * A small real-time WebGL2 renderer (its own transparent canvas laid over the scene) for sculpted,
 * skinned forearms and hands: palm, thenar and hypothenar pads, knuckles, five digits with three
 * phalanges each (the thumb with its metacarpal), nails, wrist bones, tendons and veins, creases and
 * knuckle wrinkles, lit with a soft key / fill / rim rig, a subsurface tint, specular on nails and
 * knuckles, a soft shadow map and contact shadows. Per character: Mori (rolled jacket sleeve, a watch),
 * Jenna (smaller hands, grease, a hoodie cuff), Joshu (huge weathered hands, the anchor tattoo, a
 * shoved-up knit sleeve), Aroha (taniko bands); winter / storm outfits put gloves and parka sleeves on.
 *
 * QUICK START (anything with a 2D layout: a close-up's 320x180 buffer, a UI widget's art grid...)
 *
 *   import { mountHands3d } from '../art/v11/hands3d';
 *   const hands = mountHands3d(container, { who: 'mori', side: 'right', grid: [320, 180], scale: 3.4, fitTo: canvas });
 *   const r = hands.right!;
 *   r.shoulderAt(330, 260, 60)                 // where the arm comes from (grid x, y, depth toward you)
 *    .reachTo(200, 90, 20, { with: 'grip', fingers: [-1, 0.2, 0], palm: [0, 1, 0] })
 *    .grip(1.4);                                // a power grip round a 1.4 cm handle
 *   // each frame of your loop (or pass auto: true and it runs itself):
 *   hands.frame(dt);
 *   // when done
 *   hands.destroy();
 *
 * For the v6 close-ups (src/ui/v6/closeup.ts) use closeupHands(cu, opts): it sizes the canvas over the
 * close-up's pixel canvas (same zoom-in), slots it under the speech bubbles, uses the 320x180 grid and
 * cleans up when the close-up closes.
 *
 * COORDINATES. Every position is in the layout grid: x right, y down (grid pixels), z = depth toward
 * the viewer in grid pixels (0 is the plane the 2D art sits on). Directions use the same axes.
 * `scale` is grid pixels per centimetre of hand (a man's hand is ~19 cm long). The camera is a gentle
 * perspective (fov option) whose z = 0 plane maps exactly onto the grid, so a hand at z = 0 lands
 * exactly where the 2D layout says.
 *
 * CONTROLLER (mountHands3d / closeupHands)
 *   left, right            the two hands (null if not mounted); add({ who, side }) adds more (any cast)
 *   setPose(name, blend)   both hands; frame(dt) update + render; update(dt) / render() separately
 *   setLights(preset | rig, tint?)   'studio' 'galley' 'engine' 'beach' 'sunset' 'campfire' 'dusk' 'night' 'overcast' 'ui'
 *   plane(z, opacity, ao)  a contact-shadow catcher at grid depth z (the hands' shadow falls on the scene)
 *   occlude(id, a, b, r)   a depth-only capsule for an object drawn in 2D (fingers behind it are hidden)
 *   at(x, y, z) / toGrid(world)    grid <-> world (cm) helpers
 *   ready: Promise<void>   resolves when the meshes are built (they are built off the main thread
 *                          when possible; until then nothing is drawn). destroy()
 *
 * HAND
 *   setPose(name, blend = 1, { r, force })   blend 0..1 toward the named pose (springs make it smooth):
 *       relaxed open flat spread fist grip pinch point press cup pour pullCord crank knot tap wave hook hold thumbsUp
 *   mixPoses([[name, w], ...])               several at once
 *   reachTo(x, y, z, { with, fingers, palm, follow, pole })   IK: put 'wrist' | 'palm' | 'grip' |
 *       'index' | 'middle' | 'thumb' | 'pinch' | 'knuckles' at the point, the fingers pointing along
 *       `fingers` with the palm facing `palm`; the arm follows (two-bone IK from the shoulder)
 *   aim(fingers, palm)                       just the orientation
 *   grip(r_cm, force?)                       power grip round a cylinder of radius r (fingers close
 *       until each phalanx touches it)
 *   hold({ a, b, r }, { occlude })           wrap round a handle drawn in the scene: axis a -> b (grid
 *       points), radius r in grid px; the hand's grip lands on it and the fingers wrap it
 *   release()                                let go
 *   pinchAt(x, y, z) / pinch()               thumb and index pads meet (at a point, or wherever)
 *   setJoint(dof, deg) / clearJoints()       per-joint overrides: 'wflex' 'wdev' 'twist' 'cup' 'tflex'
 *       'tabd' 'troll' 'tmcp' 'tip' and 'index.mcp' 'index.spread' 'index.pip' 'index.dip' (middle, ring, little)
 *   curl(finger, amount)                     0 straight .. 1 fully curled ('thumb' 'index' 'middle' 'ring' 'little')
 *   shoulderAt(x, y, z)                      where the arm comes from (soft: it leans in if out of reach)
 *   snap()                                   jump to the targets this frame (no easing)
 *   tip(which)                               where a fingertip is, in grid coordinates
 *   visible, life (0..1 idle tremor and breathing), follow (how fast the wrist chases its target)
 */

import { HandRenderer, LightRig, DrawHand, FrameSpec, Capsule, layoutCamera } from './render';
import { HandAnim, PoseName, PoseParams, digitCapsules } from './anim';
import { handAsset, HandAsset } from './mesh';
import { lookFor, Look, Who, lookKey } from './looks';
import { requestAsset } from './build';
import { Rig, D, fdof, NB, skinDQ, B, FINGERS, LIMITS, makeRig } from './rig';
import { V3, Q, M4, m4, qlook, qrot, qbasis, qmul, qnorm, qconj, vcross, vnorm, vadd, vscale, vsub, DEG, clamp } from './math3';
import { outfitOf } from '../../v7/wardrobe';

export type { PoseName, PoseParams } from './anim';
export type { Who } from './looks';
export type Side = 'left' | 'right';
export type Vec = [number, number, number];

// ------------------------------------------------------------------ light presets (linear colours)
const lin = (h: string, k = 1): V3 => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(c => Math.pow(c, 2.2) * k) as V3; };
export const LIGHTS: Record<string, LightRig> = {
  studio: { key: { dir: [-0.55, 0.62, 0.62], col: lin('#fff4ea', 2.0) }, fill: { dir: [0.75, -0.05, 0.55], col: lin('#c8d8ff', 0.55) }, rim: { dir: [0.45, 0.4, -0.8], col: lin('#ffffff', 2.2) }, sky: lin('#c8ccd4', 0.42), ground: lin('#8a8078', 0.24), exposure: 1.0, soft: 2.6 },
  // the porthole up on the left, warm tiles, the wooden counter bouncing amber light up
  galley: { key: { dir: [-0.7, 0.55, 0.45], col: lin('#fff1dc', 2.5) }, fill: { dir: [0.6, -0.5, 0.6], col: lin('#e8a868', 0.6) }, rim: { dir: [0.35, 0.55, -0.75], col: lin('#ffe6c4', 1.5) }, sky: lin('#d8d2c4', 0.38), ground: lin('#a06a40', 0.32), exposure: 1.0, soft: 2.8 },
  // a caged bulb up to the left, grimy teal murk all round
  engine: { key: { dir: [-0.55, 0.7, 0.45], col: lin('#ffc888', 2.6) }, fill: { dir: [0.7, -0.2, 0.6], col: lin('#4a8a84', 0.5) }, rim: { dir: [0.5, 0.5, -0.7], col: lin('#ffb060', 1.4) }, sky: lin('#3e5a58', 0.4), ground: lin('#3a2a1c', 0.3), exposure: 1.0, soft: 2.2 },
  // bright beach day: sun high on the left, blue sky fill, warm sand bounce
  beach: { key: { dir: [-0.5, 0.75, 0.45], col: lin('#fff6e4', 3.0) }, fill: { dir: [0.5, 0.2, 0.8], col: lin('#9cc4ec', 0.75) }, rim: { dir: [0.4, 0.5, -0.75], col: lin('#ffffff', 1.4) }, sky: lin('#a8c8e8', 0.55), ground: lin('#d8b884', 0.42), exposure: 1.0, soft: 2.4 },
  // low sun behind and to the left: a hot rim, purple-pink shadows
  sunset: { key: { dir: [-0.75, 0.25, 0.25], col: lin('#ffb070', 2.4) }, fill: { dir: [0.6, 0.1, 0.8], col: lin('#9a78b8', 0.6) }, rim: { dir: [-0.35, 0.3, -0.9], col: lin('#ffc890', 3.2) }, sky: lin('#a48ac0', 0.4), ground: lin('#c08868', 0.3), exposure: 1.0, soft: 2.6 },
  // the campfire low on the left, the dusk sky rimming from the upper right
  campfire: { key: { dir: [-0.78, -0.12, 0.6], col: lin('#ff9a50', 2.8) }, fill: { dir: [0.6, 0.4, 0.7], col: lin('#7058a0', 0.4) }, rim: { dir: [0.7, 0.55, -0.45], col: lin('#f0a0c0', 2.0) }, sky: lin('#5a4878', 0.32), ground: lin('#6a3428', 0.3), exposure: 1.05, soft: 2.2 },
  dusk: { key: { dir: [-0.6, 0.45, 0.55], col: lin('#ffd2a8', 1.8) }, fill: { dir: [0.7, 0.1, 0.6], col: lin('#8070b0', 0.5) }, rim: { dir: [0.5, 0.45, -0.75], col: lin('#ffb0c8', 1.8) }, sky: lin('#7a6a9a', 0.35), ground: lin('#704a50', 0.25), exposure: 1.0, soft: 2.4 },
  night: { key: { dir: [-0.4, 0.7, 0.55], col: lin('#a8c0ff', 1.1) }, fill: { dir: [0.7, -0.3, 0.6], col: lin('#ff9a5a', 0.5) }, rim: { dir: [0.4, 0.4, -0.8], col: lin('#c0d0ff', 1.2) }, sky: lin('#28324a', 0.4), ground: lin('#1a1418', 0.25), exposure: 1.15, soft: 2.4 },
  overcast: { key: { dir: [-0.3, 0.85, 0.45], col: lin('#e8eef4', 1.8) }, fill: { dir: [0.6, 0.2, 0.75], col: lin('#c0ccd8', 0.8) }, rim: { dir: [0.3, 0.5, -0.8], col: lin('#e0e8f0', 1.0) }, sky: lin('#b8c4d0', 0.55), ground: lin('#7a7468', 0.35), exposure: 1.0, soft: 3.2 },
  ui: { key: { dir: [-0.5, 0.65, 0.6], col: lin('#fff0dc', 2.6) }, fill: { dir: [0.7, -0.1, 0.6], col: lin('#d0b090', 0.6) }, rim: { dir: [0.4, 0.5, -0.75], col: lin('#ffe0b0', 1.6) }, sky: lin('#c8b8a0', 0.4), ground: lin('#6a4a30', 0.3), exposure: 1.0, soft: 2.4 },
};

// ------------------------------------------------------------------ options
export interface Hands3dOptions {
  who?: Who;
  side?: Side | 'both';
  /** the layout grid the coordinates refer to (default: the container's CSS size in px) */
  grid?: [number, number];
  /** lay the canvas exactly over this element (default: fill the container) */
  fitTo?: HTMLElement;
  /** grid px per cm of hand (default: a hand ~a third of the grid's height) */
  scale?: number;
  /** vertical field of view in degrees (default 30: gentle perspective) */
  fov?: number;
  lights?: string | LightRig;
  /** 0 = smooth, at screen resolution; n >= 1 = render at n x the grid and scale up pixelated */
  pixel?: number;
  /** ink outline width in grid px (0 off), and its colour */
  outline?: number;
  ink?: string;
  /** palette steps per channel with ordered dither (0 off) */
  quant?: number;
  /** outfit for the gloves and sleeves (default: what the wardrobe says) */
  outfit?: string;
  gloves?: boolean;
  /** run an own requestAnimationFrame loop (default false: call frame(dt) from your loop) */
  auto?: boolean;
  /** colour multiplier and saturation applied to the hands' albedo (match a scene's grade) */
  tint?: [number, number, number];
  saturation?: number;
  /** where the canvas goes among the container's children (default: appended) */
  before?: Node | null;
}

const FINGER_NAMES = ['index', 'middle', 'ring', 'little'];
function dofIndex(name: string | number): number {
  if (typeof name === 'number') return name;
  const flat: Record<string, number> = { wflex: D.wflex, wdev: D.wdev, twist: D.twist, cup: D.cup, tflex: D.tflex, tabd: D.tabd, troll: D.troll, tmcp: D.tmcp, tip: D.tip };
  if (name in flat) return flat[name];
  const [f, j] = name.split('.');
  const k = FINGER_NAMES.indexOf(f === 'pinky' ? 'little' : f);
  const ji = ['mcp', 'spread', 'pip', 'dip'].indexOf(j);
  if (k < 0 || ji < 0) throw new Error('hands3d: unknown joint ' + name);
  return fdof(k, ji as 0 | 1 | 2 | 3);
}

// ------------------------------------------------------------------ one hand
export class Hand {
  readonly anim: HandAnim;
  visible = true;
  /** set while the mesh is still being built */
  asset: HandAsset | null = null;
  readonly look: Look;
  readonly dq = new Float32Array(NB * 8);
  readonly model: M4;
  private holdCap: Capsule | null = null;

  constructor(readonly ctl: HandsController, readonly who: Who, readonly side: Side, look: Look, rig: Rig) {
    this.look = look;
    this.anim = new HandAnim(rig);
    this.model = m4();
    if (side === 'left') this.model[0] = -1;
    // a sensible default: the arm comes up from below on its side, the hand relaxed in front
    const [W, H] = ctl.grid;
    this.shoulderAt(side === 'right' ? W * 0.82 : W * 0.18, H * 1.55, 70);
    this.reachTo(side === 'right' ? W * 0.62 : W * 0.38, H * 0.55, 20, { fingers: [side === 'right' ? -0.3 : 0.3, -1, 0], palm: [0, 0.2, -1] });
    this.anim.snap();
  }

  get rig() { return this.anim.rig; }
  /** idle tremor and breathing (0..1) */
  get life() { return this.anim.life; }
  set life(v: number) { this.anim.life = v; }
  /** how quickly the wrist chases its target (rad/s; larger is snappier) */
  get follow() { return this.anim.follow; }
  set follow(v: number) { this.anim.follow = v; }

  // ---- conversions into this hand's solver space (a left hand solves mirrored)
  private toSolver(p: V3): V3 { return this.side === 'left' ? [-p[0], p[1], p[2]] : p; }
  private dirToSolver(g: Vec): V3 { const w: V3 = [g[0], -g[1], g[2]]; return this.toSolver(vnorm(w)); }
  private fromSolver(p: V3): V3 { return this.side === 'left' ? [-p[0], p[1], p[2]] : p; }

  shoulderAt(x: number, y: number, z = 0) { this.anim.shoulder = this.toSolver(this.ctl.at(x, y, z)); return this; }

  setPose(name: PoseName, blend = 1, o: PoseParams = {}) {
    blend = clamp(blend, 0, 1);
    this.anim.layers = blend >= 1 ? [{ name, w: 1, o }] : [{ name: 'relaxed', w: 1 - blend, o: {} }, { name, w: blend, o }];
    if (o.r) this.anim.gripR = o.r;
    return this;
  }
  mixPoses(list: [PoseName, number, PoseParams?][]) {
    this.anim.layers = list.map(([name, w, o]) => ({ name, w, o: o ?? {} }));
    return this;
  }
  /** orientation only: where the fingers point and the palm faces (grid directions) */
  aim(fingers: Vec, palm: Vec) {
    const Y = this.dirToSolver(fingers), P = this.dirToSolver(palm);
    this.anim.handQT = qlook(Y, vscale(P, -1));
    return this;
  }
  reachTo(x: number, y: number, z = 0, o: { with?: HandAnim['effector']; fingers?: Vec; palm?: Vec; follow?: number; pole?: Vec } = {}) {
    if (o.fingers && o.palm) this.aim(o.fingers, o.palm);
    else if (o.fingers) this.aim(o.fingers, [0, 1, 0]);
    if (o.with) this.anim.effector = o.with;
    if (o.follow !== undefined) { if (o.follow <= 0) this.anim.snap(); else this.anim.follow = o.follow; }
    if (o.pole) this.anim.pole = this.dirToSolver(o.pole);
    this.anim.wristT = this.toSolver(this.ctl.at(x, y, z));
    return this;
  }
  grip(r = 1.6, force = 0.5) {
    this.anim.gripR = r;
    this.anim.squeeze = force;
    return this.setPose('grip', 1, { r, force });
  }
  /** wrap round a handle drawn in the scene: axis from a to b (grid points), radius in grid px */
  hold(h: { a: Vec; b: Vec; r: number } | null, o: { occlude?: boolean; force?: number; approach?: Vec; follow?: number } = {}) {
    if (!h) return this.release();
    const a = this.toSolver(this.ctl.at(h.a[0], h.a[1], h.a[2])), b = this.toSolver(this.ctl.at(h.b[0], h.b[1], h.b[2]));
    const r = h.r / this.ctl.scale;
    this.anim.handle = { a, b, r };
    this.anim.gripR = r;
    this.anim.effector = 'grip';
    // orient the hand: the palm's grip line along the handle (a = index side, b = little-finger side),
    // the back of the hand toward where the arm comes from (or `approach`)
    const mid = vscale(vadd(a, b), 0.5);
    const U = vnorm(vsub(b, a));
    let ap = o.approach ? this.dirToSolver(o.approach) : vnorm(vsub(this.anim.shoulder, mid));
    ap = vnorm(vsub(ap, vscale(U, ap[0] * U[0] + ap[1] * U[1] + ap[2] * U[2])));
    const uh = vnorm([1, -0.36, 0]);
    const W = qbasis(U, vscale(ap, 1), vcross(U, ap));
    const nh: V3 = [0, 0, 1];
    const Hb = qbasis(uh, nh, vcross(uh, nh));
    this.anim.handQT = qnorm(qmul(W, qconj(Hb)));
    this.anim.wristT = mid;
    if (o.follow !== undefined) { if (o.follow <= 0) this.anim.snap(); else this.anim.follow = o.follow; }
    if (o.force !== undefined) this.anim.squeeze = o.force;
    if (this.anim.layers.length !== 1 || (this.anim.layers[0].name !== 'grip' && this.anim.layers[0].name !== 'pour' && this.anim.layers[0].name !== 'crank')) this.setPose('grip', 1, { r, force: o.force });
    this.holdCap = o.occlude === false ? null : { a: this.ctl.at(h.a[0], h.a[1], h.a[2]), b: this.ctl.at(h.b[0], h.b[1], h.b[2]), r: r * 0.9, tag: 9 };
    return this;
  }
  release() {
    this.anim.handle = null;
    this.holdCap = null;
    if (this.anim.effector === 'grip') this.anim.effector = 'palm';
    return this.setPose('relaxed');
  }
  pinch(blend = 1) { this.anim.pinchAt = null; return this.setPose('pinch', blend); }
  pinchAt(x: number, y: number, z = 0) {
    this.setPose('pinch');
    this.anim.effector = 'pinch';
    return this.reachTo(x, y, z);
  }
  setJoint(dof: string | number, deg: number) { this.anim.overrides.set(dofIndex(dof), deg * DEG); return this; }
  clearJoints() { this.anim.overrides.clear(); return this; }
  /** curl one digit: 0 straight .. 1 fully curled */
  curl(finger: string | number, amount: number) {
    const k = typeof finger === 'number' ? finger - 1 : finger === 'thumb' ? -1 : FINGER_NAMES.indexOf(finger === 'pinky' ? 'little' : finger);
    const a = clamp(amount, 0, 1);
    if (k < 0) {
      this.anim.overrides.set(D.tflex, (8 + a * 36) * DEG); this.anim.overrides.set(D.tmcp, (6 + a * 50) * DEG); this.anim.overrides.set(D.tip, (4 + a * 70) * DEG);
    } else {
      this.anim.overrides.set(fdof(k, 0), (2 + a * 88) * DEG); this.anim.overrides.set(fdof(k, 2), (4 + a * 100) * DEG); this.anim.overrides.set(fdof(k, 3), (2 + a * 64) * DEG);
    }
    return this;
  }
  snap() { this.anim.snap(); return this; }
  /** where a fingertip (or the wrist / palm / grip point) is, in grid coordinates */
  tip(which: HandAnim['effector'] = 'index'): [number, number] {
    const old = this.anim.effector;
    this.anim.effector = which;
    const off = this.anim.effectorOffset();
    this.anim.effector = old;
    const w = this.fromSolver(this.anim.handPoint(off));
    return this.ctl.toGrid(w);
  }
  /** occluder for the held handle (world) */
  get occluder() { return this.holdCap; }

  /** flexion per digit for the shader: (mcp|cmc, pip|mcp, dip|ip) as 0..1 of a right angle */
  flexes(): Float32Array {
    const p = this.anim.pose, out = new Float32Array(20);
    const n = (v: number) => clamp(v / (Math.PI / 2), 0, 1.3);
    out[0] = n(p[D.tflex]); out[1] = n(p[D.tmcp]); out[2] = n(p[D.tip]);
    for (let k = 0; k < 4; k++) { out[(k + 1) * 4] = n(p[fdof(k, 0)]); out[(k + 1) * 4 + 1] = n(p[fdof(k, 2)]); out[(k + 1) * 4 + 2] = n(p[fdof(k, 3)]); }
    return out;
  }
}

// ------------------------------------------------------------------ the controller
let SERIAL = 0;
export class HandsController {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: HandRenderer | null;
  readonly hands: Hand[] = [];
  left: Hand | null = null;
  right: Hand | null = null;
  grid: [number, number];
  scale: number;
  fov: number;
  lights: LightRig;
  pixel: number;
  outline: number;
  ink: V3;
  quant: number;
  tint: [number, number, number, number];
  readonly ready: Promise<void>;
  private cam: ReturnType<typeof layoutCamera>;
  private planeSpec: { z: number; opacity: number; ao: number; col: V3 } | null = null;
  private occl = new Map<string, Capsule>();
  private raf = 0;
  private lastT = 0;
  private time = 0;
  private destroyed = false;
  private ro: ResizeObserver | null = null;
  private onResize = () => this.layout();
  readonly id = ++SERIAL;

  constructor(readonly container: HTMLElement, readonly opts: Hands3dOptions = {}) {
    const fit = opts.fitTo ?? container;
    const r = fit.getBoundingClientRect();
    this.grid = opts.grid ?? [Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))];
    this.scale = opts.scale ?? this.grid[1] / 50;
    this.fov = opts.fov ?? 30;
    this.pixel = opts.pixel ?? 0;
    this.outline = opts.outline ?? 0;
    this.ink = lin(opts.ink ?? '#1a1014');
    this.quant = opts.quant ?? 0;
    const tn = opts.tint ?? [1, 1, 1];
    this.tint = [tn[0], tn[1], tn[2], opts.saturation ?? 1];
    this.lights = typeof opts.lights === 'object' ? opts.lights : LIGHTS[opts.lights ?? 'studio'] ?? LIGHTS.studio;
    this.cam = layoutCamera(this.grid[0], this.grid[1], this.scale, this.fov);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hands3d';
    this.canvas.style.cssText = 'position:absolute;pointer-events:none;display:block;';
    if (opts.before !== undefined) container.insertBefore(this.canvas, opts.before);
    else container.appendChild(this.canvas);
    let renderer: HandRenderer | null = null;
    try { renderer = new HandRenderer(this.canvas, { lowPower: matchMedia?.('(pointer: coarse)').matches }); }
    catch (e) { console.warn('[hands3d] no WebGL2 for the hands:', e); }
    this.renderer = renderer;
    this.layout();
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(this.onResize); this.ro.observe(fit); }
    const pend: Promise<void>[] = [];
    const sides: Side[] = opts.side === 'both' ? ['left', 'right'] : [opts.side ?? 'right'];
    for (const sd of sides) pend.push(this.add({ who: opts.who ?? 'mori', side: sd }).then(() => undefined));
    this.ready = Promise.all(pend).then(() => undefined);
    if (opts.auto) {
      const step = (t: number) => {
        if (this.destroyed) return;
        if (!this.canvas.isConnected) { this.destroy(); return; }
        const dt = this.lastT ? Math.min(0.05, (t - this.lastT) / 1000) : 1 / 60;
        this.lastT = t;
        this.frame(dt);
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
  }

  /** add a hand (any of the cast, either side); resolves once its mesh is ready */
  async add(o: { who: Who; side: Side; outfit?: string; gloves?: boolean }): Promise<Hand> {
    const outfit = o.outfit ?? this.opts.outfit ?? (() => { try { return outfitOf(o.who); } catch { return 'casual'; } })();
    const look = lookFor(o.who, outfit, o.gloves ?? this.opts.gloves);
    const rigOnly = makeRig(look.build);
    const h = new Hand(this, o.who, o.side, look, rigOnly);
    this.hands.push(h);
    if (o.side === 'left' && !this.left) this.left = h;
    if (o.side === 'right' && !this.right) this.right = h;
    h.asset = await requestAsset(look, o.side);
    return h;
  }
  get(side: Side, who?: Who) { return this.hands.find(h => h.side === side && (!who || h.who === who)) ?? null; }

  setPose(name: PoseName, blend = 1, o?: PoseParams) { for (const h of this.hands) h.setPose(name, blend, o); return this; }
  setLights(l: string | LightRig, tint?: [number, number, number], saturation?: number) {
    this.lights = typeof l === 'string' ? LIGHTS[l] ?? this.lights : l;
    if (tint) this.tint = [tint[0], tint[1], tint[2], saturation ?? this.tint[3]];
    return this;
  }
  /** scale the key light (a flickering bulb, a fire) without changing the rig */
  keyGain = 1;
  /** a contact-shadow catcher at grid depth z: the shadow (opacity) and the soft occlusion under the hands (ao) */
  plane(z: number | null, opacity = 0.45, ao = 0.35, col = '#000000') {
    this.planeSpec = z === null ? null : { z: z / this.scale, opacity, ao, col: lin(col) };
    return this;
  }
  /** a depth-only capsule for something drawn in 2D in front of / around the hands (grid points, radius in grid px); null removes */
  occlude(id: string, a: Vec | null, b?: Vec, r = 4) {
    if (!a || !b) { this.occl.delete(id); return this; }
    this.occl.set(id, { a: this.at(a[0], a[1], a[2]), b: this.at(b[0], b[1], b[2]), r: r / this.scale, tag: 9 });
    return this;
  }

  /** grid point (x right, y down, z toward the viewer, grid px) → world (cm), perspective-correct */
  at(x: number, y: number, z = 0): V3 {
    const Z = z / this.scale, k = (this.cam.D - Z) / this.cam.D;
    return [((x - this.grid[0] / 2) / this.scale) * k, (-(y - this.grid[1] / 2) / this.scale) * k, Z];
  }
  /** world (cm) → grid point */
  toGrid(w: V3): [number, number] {
    const k = this.cam.D / (this.cam.D - w[2]);
    return [w[0] * k * this.scale + this.grid[0] / 2, -w[1] * k * this.scale + this.grid[1] / 2];
  }
  /** change the grid scale / fov (e.g. a camera move) */
  setView(o: { scale?: number; fov?: number; grid?: [number, number] }) {
    if (o.scale) this.scale = o.scale;
    if (o.fov) this.fov = o.fov;
    if (o.grid) this.grid = o.grid;
    this.cam = layoutCamera(this.grid[0], this.grid[1], this.scale, this.fov);
    this.layout();
  }

  /** match the canvas to the element it overlays */
  layout() {
    if (this.destroyed) return;
    const fit = this.opts.fitTo ?? this.container;
    const cr = this.container.getBoundingClientRect();
    // the close-up canvas is sized by style (it can overflow the screen); fall back to its box
    const w = parseFloat(fit.style.width) || fit.getBoundingClientRect().width || cr.width;
    const h = parseFloat(fit.style.height) || fit.getBoundingClientRect().height || cr.height;
    const st = this.canvas.style;
    if (fit === this.container) { st.left = '0px'; st.top = '0px'; }
    else {
      // centred like a flex item, or wherever the element sits
      const fr = fit.getBoundingClientRect();
      const anim = getComputedStyle(fit).transform;
      const centred = anim && anim !== 'none';
      st.left = (centred ? (cr.width - w) / 2 : fr.left - cr.left) + 'px';
      st.top = (centred ? (cr.height - h) / 2 : fr.top - cr.top) + 'px';
    }
    st.width = w + 'px'; st.height = h + 'px';
    st.imageRendering = this.pixel >= 1 ? 'pixelated' : 'auto';
    if (!this.renderer) return;
    let bw: number, bh: number;
    if (this.pixel >= 1) { bw = this.grid[0] * this.pixel; bh = this.grid[1] * this.pixel; }
    else {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      bw = w * dpr; bh = h * dpr;
      const cap = matchMedia?.('(pointer: coarse)').matches ? 1.1e6 : 2.4e6;
      if (bw * bh > cap) { const k = Math.sqrt(cap / (bw * bh)); bw *= k; bh *= k; }
    }
    this.renderer.resize(bw, bh);
  }

  update(dt: number) {
    this.time += dt;
    for (const h of this.hands) h.anim.update(dt);
  }

  render() {
    const R = this.renderer;
    if (!R || this.destroyed) return;
    const draws: DrawHand[] = [];
    const caps: Capsule[] = [];
    let cx = 0, cy = 0, cz = 0, n = 0;
    const pts: V3[] = [];
    for (const h of this.hands) {
      if (!h.asset || !h.visible) continue;
      skinDQ(h.rig, h.anim.world, h.dq);
      const look = h.look, rig = h.rig;
      const flex = h.flexes();
      const mir = h.side === 'left';
      const m = (p: V3): V3 => (mir ? [-p[0], p[1], p[2]] : p);
      for (const c of digitCapsules(rig, h.anim.world)) caps.push({ a: m(c.a), b: m(c.b), r: c.r, tag: c.tag });
      const w = h.anim.world;
      for (const i of [B.fore, B.hand, B.m3, B.th2, B.p3, B.i3]) pts.push(m(w[i].t));
      pts.push(m(vadd(w[B.fore].t, qrot(w[B.fore].q, [0, -6, 0]))));
      draws.push({
        mesh: h.asset.mesh, key: lookKey(look, h.side), dq: h.dq, model: h.model, mirror: mir, visible: true,
        uniforms: (gl, loc) => setLookUniforms(gl, loc, look, rig, flex, this.tint),
      });
      if (h.occluder) caps.push(h.occluder);
    }
    for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; n++; }
    if (!draws.length) { R.gl.clearColor(0, 0, 0, 0); R.gl.bindFramebuffer(R.gl.FRAMEBUFFER, null); R.gl.clear(R.gl.COLOR_BUFFER_BIT); return; }
    const c: V3 = [cx / n, cy / n, cz / n];
    let rad = 8;
    for (const p of pts) rad = Math.max(rad, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) + 9);
    const occluders = [...this.occl.values(), ...this.hands.map(h => h.occluder).filter((x): x is Capsule => !!x && true)];
    for (const o of this.occl.values()) caps.push(o);
    const L = this.lights;
    const lights: LightRig = this.keyGain === 1 ? L : { ...L, key: { dir: L.key.dir, col: vscale(L.key.col, this.keyGain) as V3 } };
    const halfW = this.grid[0] / 2 / this.scale, halfH = this.grid[1] / 2 / this.scale;
    const spec: FrameSpec = {
      hands: draws, view: this.cam.view, proj: this.cam.proj, camPos: this.cam.eye, lights, caps, occluders,
      plane: this.planeSpec ? { z: this.planeSpec.z, rect: [-halfW * 1.6, -halfH * 1.6, halfW * 1.6, halfH * 1.6], opacity: this.planeSpec.opacity, ao: this.planeSpec.ao, col: this.planeSpec.col } : null,
      bounds: { c, r: rad }, outline: this.outline * (this.pixel >= 1 ? this.pixel : (this.canvas.width / this.grid[0])), ink: this.ink, quant: this.quant, time: this.time,
    };
    R.render(spec);
  }

  /** every hand's mesh is built and the GPU is there: draw the 3D hands (otherwise keep 2D ones) */
  get ready3d() { return !this.destroyed && !!this.renderer && !this.renderer.lost && this.hands.length > 0 && this.hands.every(h => !!h.asset); }
  /** update and draw */
  frame(dt: number) {
    if (this.destroyed) return;
    if (!this.canvas.isConnected) { this.destroy(); return; }
    this.update(dt);
    this.render();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.ro?.disconnect();
    this.renderer?.dispose();
    this.canvas.remove();
  }
  get alive() { return !this.destroyed; }
}

/** per-hand uniforms: the look's colours and the digit lengths / flexion the shader needs */
function setLookUniforms(gl: WebGL2RenderingContext, loc: (n: string) => WebGLUniformLocation | null, look: Look, rig: Rig, flex: Float32Array, tint: [number, number, number, number]) {
  const c3 = (n: string, h: string, k = 1) => gl.uniform3fv(loc(n), lin(h, k));
  const sk = look.skin;
  c3('uSkin', sk.base); c3('uPalm', sk.palm); c3('uFlush', sk.flush); c3('uSss', sk.sss); c3('uNail', sk.nail); c3('uVein', sk.vein); c3('uHair', look.hair[1]);
  c3('uCloth0', look.cloth[0]); c3('uCloth1', look.cloth[1]); c3('uCloth2', look.cloth[2]); c3('uCuff', look.cuff);
  const g = look.gloves;
  c3('uGlove0', g?.col[0] ?? '#202020'); c3('uGlove1', g?.col[1] ?? '#404040'); c3('uGlove2', g?.col[2] ?? '#606060'); c3('uGCuff', g?.cuff ?? '#303030');
  gl.uniform1f(loc('uRough'), sk.rough);
  gl.uniform1f(loc('uHairK'), look.hair[0]);
  gl.uniform1f(loc('uWeather'), look.weathered);
  gl.uniform1f(loc('uGrease'), look.grease);
  gl.uniform1f(loc('uFreckle'), look.freckles);
  gl.uniform1f(loc('uTattoo'), look.tattoo ? 1 : 0);
  gl.uniform1f(loc('uBony'), rig.build.bony);
  gl.uniform1f(loc('uSize'), rig.build.size);
  gl.uniform1f(loc('uForeLen'), rig.foreLen);
  gl.uniform1i(loc('uSleeve'), ({ rolled: 0, hoodie: 1, pushed: 2, parka: 3, oilskin: 4, none: 0 } as Record<string, number>)[look.sleeve] ?? 0);
  gl.uniform1i(loc('uGloveKind'), g ? ({ knit: 0, leather: 1, rubber: 2 } as Record<string, number>)[g.kind] : 0);
  gl.uniform4fv(loc('uTint'), tint);
  gl.uniform1i(loc('uDebug'), HANDS3D.debug);
  // digit lengths: thumb (metacarpal, proximal, distal, tip radius), then the fingers (proximal, middle, distal, tip radius)
  const L = new Float32Array(20);
  L.set([rig.len[B.th0], rig.len[B.th1], rig.len[B.th2], rig.rad[B.th2][1]], 0);
  for (let k = 0; k < 4; k++) { const ch = FINGERS[k]; L.set([rig.len[ch[0]], rig.len[ch[1]], rig.len[ch[2]], rig.rad[ch[2]][1]], (k + 1) * 4); }
  gl.uniform4fv(loc('uLen'), L);
  gl.uniform4fv(loc('uFlex'), flex);
}

/** mount hands into any container (see the top of this file) */
export function mountHands3d(container: HTMLElement, opts: Hands3dOptions = {}): HandsController {
  return new HandsController(container, opts);
}

/** the v6 close-ups: lay the hands over the close-up's 320x180 pixel canvas */
export function closeupHands(cu: { wrap: HTMLElement; cv: HTMLCanvasElement; closed: boolean }, opts: Hands3dOptions = {}): HandsController {
  const ctl = new HandsController(cu.wrap, { grid: [cu.cv.width, cu.cv.height], fitTo: cu.cv, before: cu.cv.nextSibling, scale: 3.2, pixel: HANDS3D.pixel ?? 4, outline: 0, ...opts, ...(HANDS3D.pixel !== null ? { pixel: HANDS3D.pixel } : {}) });
  return ctl;
}

/** start building a character's meshes in the background (so a close-up opening later has them ready) */
export function prewarmHands3d(who: Who | Who[], sides: Side[] = ['right', 'left'], outfit?: string) {
  for (const w of Array.isArray(who) ? who : [who]) for (const s of sides) {
    const o = outfit ?? (() => { try { return outfitOf(w); } catch { return 'casual'; } })();
    void requestAsset(lookFor(w, o), s);
  }
}

/** global switch: false brings back the classic 2D pixel hands in the minigames */
export const HANDS3D = {
  enabled: true,
  /** shading debug: 0 off, 1 clay, 2 regions, 3 AO, 4 normals */
  debug: 0,
  /** force the close-ups' render scale (null: each close-up's own choice; ?h3dpx=2 sets it) */
  pixel: (() => { try { const v = new URLSearchParams(location.search).get('h3dpx'); return v === null ? null : +v; } catch { return null; } })() as number | null,
};

export { handAsset, LIMITS };
export type { LightRig } from './render';
export type { Q };
export const _internals = { vsub };
