// The deferred-ish 2.5D sprite renderer.
//
// World space is measured in "art pixels". A View looks at the p=1 gameplay plane; every draw
// happens on a parallax layer (p < 1 is further away, p > 1 is in front of the gameplay plane).
// Layers are zoomed by zoom^p so camera zooms feel like a dolly through real depth.

import { GL, Program, Target, Texture } from './gl';
import * as S from './shaders';

export interface Frame {
  tex: Texture;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
  /** anchor in texels from the frame's top-left */
  ax: number;
  ay: number;
}

export type RGB = [number, number, number];

export interface Env {
  ambientTop: RGB;
  ambientBottom: RGB;
  fogTop: RGB;
  fogBottom: RGB;
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  saturation: number;
  contrast: number;
  lift: RGB;
  gamma: RGB;
  gain: RGB;
  vignette: number;
  grain: number;
  /** world-space y of the reflection axis on the p=1 plane, or null for no water */
  waterAxis: number | null;
  waterTint: RGB;
}

export const defaultEnv = (): Env => ({
  ambientTop: [1, 1, 1],
  ambientBottom: [1, 1, 1],
  fogTop: [0.7, 0.8, 0.9],
  fogBottom: [0.7, 0.8, 0.9],
  exposure: 1,
  bloom: 0.6,
  bloomThreshold: 0.85,
  saturation: 1,
  contrast: 1,
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  vignette: 0.35,
  grain: 0.025,
  waterAxis: null,
  waterTint: [0.8, 0.9, 1],
});

export interface View {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export interface PostState {
  fade: number;
  fadeColor: RGB;
  flash: number;
  ca: number;
  /** the photo viewfinder's own depth of field (focus is a layer depth, 0.5 = the gameplay plane);
   *  while on it replaces the everyday / cinematic lens below */
  dof: boolean;
  focus: number;
  dofStrength: number;
}

/**
 * Cinematic post FX, eased each frame by the cinematic camera (src/game/v11/cine.ts). Everything
 * rests at the values below; the everyday lens (a gentle depth of field on the extreme layers, bloom)
 * needs none of it.
 */
export interface CineFx {
  /** parallax of the plane kept sharp (1 = the gameplay plane, < 1 further away, > 1 nearer) */
  focus: number;
  /** cinematic depth of field: 0 = the everyday lens, 1 = a cinematic shot, ~1.5 = long telephoto */
  dof: number;
  /** blur everything by at least this many art px (rack focus away for a cut-in, losing consciousness) */
  defocus: number;
  /** radial zoom blur 0..1 and its centre in view fractions (the subject there stays sharp) */
  zoomBlur: number;
  zoomX: number;
  zoomY: number;
  /** gain of the automatic motion blur on fast camera moves and of the zoom's dolly blur */
  motion: number;
  dolly: number;
  /** added on top of the scene's own grading */
  vignette: number;
  bloom: number;
  desat: number;
  exposure: number;
  ca: number;
}

export const restCineFx = (): CineFx => ({
  focus: 1, dof: 0, defocus: 0, zoomBlur: 0, zoomX: 0.5, zoomY: 0.5, motion: 1, dolly: 1,
  vignette: 0, bloom: 0, desat: 0, exposure: 0, ca: 0,
});

/** Graphics quality presets (Settings > Graphics). */
export type GfxLevel = 'low' | 'medium' | 'high';
export interface GfxConf {
  /** depth of field buffer size relative to the art resolution, and its blur reach in its texels */
  dofScale: number;
  dofReach: number;
  /** the gentle everyday depth of field on the extreme foreground / background layers */
  baseDof: boolean;
  bloomLevels: number;
  /** taps of the automatic motion blur (0 = none) and of explicit zoom-blur punches */
  motionTaps: number;
  zoomTaps: number;
  /** render resolution factor */
  res: number;
}
export const GFX: Record<GfxLevel, GfxConf> = {
  high: { dofScale: 1, dofReach: 12, baseDof: true, bloomLevels: 6, motionTaps: 12, zoomTaps: 12, res: 1 },
  medium: { dofScale: 0.5, dofReach: 7, baseDof: true, bloomLevels: 5, motionTaps: 8, zoomTaps: 8, res: 1 },
  low: { dofScale: 0.5, dofReach: 5, baseDof: false, bloomLevels: 4, motionTaps: 0, zoomTaps: 6, res: 0.8 },
};

// The lens: blur (art px) per unit of parallax away from the focus plane, in front / behind, outside
// a dead zone around it. Parallax is inverse distance, so this is a real lens's circle of confusion.
// Everyday: only the extreme layers soften (the playfield and the layers near it stay pixel-sharp).
const LENS_BASE = { dzNear: 0.12, dzFar: 0.6, near: 8, far: 3 };
const LENS_CINE = { dzNear: 0.03, dzFar: 0.03, near: 18, far: 5.5 };
/** motion blur: exposure time, and the screen speed (art px/s) below which nothing smears */
const SHUTTER = 1 / 90;
const MOTION_V0 = 450;
const DOLLY_V0 = 0.4;

export const packColor = (r: number, g: number, b: number, a = 1) =>
  (((a * 255) & 255) << 24 | ((b * 255) & 255) << 16 | ((g * 255) & 255) << 8 | ((r * 255) & 255)) >>> 0;

export const hexColor = (hex: number, a = 1) =>
  packColor(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a);

export const WHITE = 0xffffffff;

/** Camera rest height: layers of any parallax line up when the camera y equals this. */
export const REF_Y = 180;
const BYTES_PER_VERT = 28;
const FLOATS_PER_VERT = 7;
const QUAD_CAP = 16000;

interface Seg {
  tex: Texture | null;
  mode: number;
  start: number;
  n: number;
}

class QuadBatch {
  readonly buf: ArrayBuffer;
  readonly f32: Float32Array;
  readonly u32: Uint32Array;
  count = 0;
  segs: Seg[] = [];
  private cur: Seg | null = null;

  constructor(readonly cap: number) {
    this.buf = new ArrayBuffer(cap * 4 * BYTES_PER_VERT);
    this.f32 = new Float32Array(this.buf);
    this.u32 = new Uint32Array(this.buf);
  }
  reset() {
    this.count = 0;
    this.segs.length = 0;
    this.cur = null;
  }
  get full() {
    return this.count >= this.cap;
  }
  /** Returns base float index for the new quad's 4 vertices. */
  alloc(tex: Texture | null, mode: number): number {
    let s = this.cur;
    if (!s || s.tex !== tex || s.mode !== mode) {
      s = { tex, mode, start: this.count, n: 0 };
      this.segs.push(s);
      this.cur = s;
    }
    s.n++;
    return this.count++ * 4 * FLOATS_PER_VERT;
  }
}

interface LayerState {
  p: number;
  py: number;
  z: number;
  ox: number;
  oy: number;
  aux: number;
  fog: number;
  emissive: number;
  receive: number;
  depth: number;
}

export class Renderer {
  readonly gl: GL;
  readonly hdrFormat: { internal: number; format: number; type: number };
  /** Art-pixel view size (VW x VH) */
  VW = 640;
  VH = 360;
  W = 1;
  H = 1;
  scale = 1;
  time = 0;

  env: Env = defaultEnv();
  view: View = { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
  post: PostState = { fade: 0, fadeColor: [0, 0, 0], flash: 0, ca: 0, dof: false, focus: 0.5, dofStrength: 3 };
  /** cinematic post FX (see CineFx) */
  cine: CineFx = restCineFx();
  /** graphics quality preset and the player's grain / vignette options */
  gfxLevel: GfxLevel = 'high';
  gfx: GfxConf = GFX.high;
  grainOn = true;
  vignetteOn = true;
  /** this frame is a parallax-layered scene (Stage.render sets it): the depth of field reads its layers */
  layered = false;
  /** nearest / farthest parallax drawn this frame (sizes the depth of field's reach) */
  private pMin = Infinity;
  private pMax = -Infinity;
  /** what the last frame's post pipeline ran (debug overlay / tests) */
  readonly stats = { dof: false, motion: false, coc: 0, blur: 0 };

  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private ibo: WebGLBuffer;
  private emptyVao: WebGLVertexArrayObject;

  private pScene: Program;
  private pLight: Program;
  private pFx: Program;
  private pComposite: Program;
  private pDofPre: Program;
  private pDofBlur: Program;
  private pVel: Program;
  private pDofTile: Program;
  private pDofDilate: Program;
  private pBloomPre: Program;
  private pBloomDown: Program;
  private pBloomUp: Program;
  private pFinal: Program;
  private pBlit: Program;

  private rtScene!: Target;
  private rtLight!: Target;
  private rtHdr!: Target;
  /** the motion-blurred scene (allocated the first time anything moves fast enough to smear) */
  private rtHdr2: Target | null = null;
  private rtFx!: Target;
  private rtDofA!: Target;
  private rtDofB!: Target;
  /** widest circle of confusion per 16x16 tile of the DOF buffer, and dilated by a tile */
  private rtTile!: Target;
  private rtTileD!: Target;
  private bloom: Target[] = [];
  /** camera velocity on screen (art px/s on the gameplay plane) and zoom rate (1/s), smoothed */
  private vel = { x: 0, y: 0, z: 0, px: NaN, py: NaN, pz: NaN };
  private rdt = 0;

  private scene = new QuadBatch(QUAD_CAP);
  private lights = new QuadBatch(4096);
  private fx = new QuadBatch(8192);
  private L: LayerState = { p: 1, py: 1, z: 1, ox: 0, oy: 0, aux: 0, fog: 0, emissive: 0, receive: 1, depth: 0.5 };
  private mat = 0;
  readonly white: Frame;
  private shadowMode = 0;
  quality = 1;
  /** world-space rigid transform applied before layer projection (boat decks, swinging props) */
  private M: [number, number, number, number, number, number] | null = null;
  private MR = 0;
  private mStack: { M: [number, number, number, number, number, number] | null; R: number }[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    const floatOk = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.hdrFormat = floatOk
      ? { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }
      : { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };

    this.pScene = new Program(gl, S.SPRITE_VS, S.SCENE_FS, 'scene');
    this.pLight = new Program(gl, S.SPRITE_VS, S.LIGHT_FS, 'light');
    this.pFx = new Program(gl, S.SPRITE_VS, S.FX_FS, 'fx');
    this.pComposite = new Program(gl, S.FULL_VS, S.COMPOSITE_FS, 'composite');
    this.pDofPre = new Program(gl, S.FULL_VS, S.DOF_PRE_FS, 'dofPre');
    this.pDofBlur = new Program(gl, S.FULL_VS, S.DOF_BLUR_FS, 'dofBlur');
    this.pVel = new Program(gl, S.FULL_VS, S.VELBLUR_FS, 'velocity');
    this.pDofTile = new Program(gl, S.FULL_VS, S.DOF_TILE_FS, 'dofTile');
    this.pDofDilate = new Program(gl, S.FULL_VS, S.DOF_DILATE_FS, 'dofDilate');
    this.pBloomPre = new Program(gl, S.FULL_VS, S.BLOOM_PRE_FS, 'bloomPre');
    this.pBloomDown = new Program(gl, S.FULL_VS, S.BLOOM_DOWN_FS, 'bloomDown');
    this.pBloomUp = new Program(gl, S.FULL_VS, S.BLOOM_UP_FS, 'bloomUp');
    this.pFinal = new Program(gl, S.FULL_VS, S.FINAL_FS, 'final');
    this.pBlit = new Program(gl, S.FULL_VS, S.BLIT_FS, 'blit');

    // vertex layout
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_CAP * 4 * BYTES_PER_VERT, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, BYTES_PER_VERT, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, BYTES_PER_VERT, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, BYTES_PER_VERT, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, BYTES_PER_VERT, 20);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, BYTES_PER_VERT, 24);
    this.ibo = gl.createBuffer()!;
    const idx = new Uint16Array(QUAD_CAP * 6);
    for (let q = 0, v = 0; q < QUAD_CAP; q++, v += 4) {
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray()!;

    // 4x4 white texture for rects (AA sampler needs a texel neighbourhood)
    const wpx = new Uint8Array(4 * 4 * 4).fill(255);
    const wt = new Texture(gl, 4, 4, { filter: gl.NEAREST }, wpx);
    this.white = { tex: wt, u0: 0.375, v0: 0.375, u1: 0.625, v1: 0.625, w: 1, h: 1, ax: 0, ay: 0 };

    this.allocTargets(2, 2);
  }

  /** depth of field buffer size: the art resolution (scaled by the quality preset), never above the canvas */
  private dofSize(w: number, h: number): [number, number] {
    const k = this.gfx.dofScale;
    return [Math.max(2, Math.min(w, Math.round(this.VW * k))), Math.max(2, Math.min(h, Math.round(this.VH * k)))];
  }

  private allocTargets(w: number, h: number) {
    const gl = this.gl;
    const rgba8 = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    const hdr = this.hdrFormat;
    const [dw, dh] = this.dofSize(w, h);
    if (!this.rtScene) {
      this.rtScene = new Target(gl, w, h, [rgba8, rgba8, rgba8]);
      this.rtLight = new Target(gl, Math.max(1, w >> 1), Math.max(1, h >> 1), [hdr]);
      this.rtHdr = new Target(gl, w, h, [hdr]);
      this.rtFx = new Target(gl, w, h, [hdr]);
      this.rtDofA = new Target(gl, dw, dh, [hdr]);
      this.rtDofB = new Target(gl, dw, dh, [hdr]);
      const tile = { ...rgba8, filter: gl.NEAREST };
      this.rtTile = new Target(gl, Math.ceil(dw / 16), Math.ceil(dh / 16), [tile]);
      this.rtTileD = new Target(gl, Math.ceil(dw / 16), Math.ceil(dh / 16), [tile]);
    } else {
      this.rtScene.resize(w, h);
      this.rtLight.resize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      this.rtHdr.resize(w, h);
      this.rtHdr2?.resize(w, h);
      this.rtFx.resize(w, h);
      this.rtDofA.resize(dw, dh);
      this.rtDofB.resize(dw, dh);
      this.rtTile.resize(Math.ceil(dw / 16), Math.ceil(dh / 16));
      this.rtTileD.resize(Math.ceil(dw / 16), Math.ceil(dh / 16));
    }
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6; i++) {
      bw = Math.max(1, bw);
      bh = Math.max(1, bh);
      if (!this.bloom[i]) this.bloom[i] = new Target(gl, bw, bh, [hdr]);
      else this.bloom[i].resize(bw, bh);
      bw >>= 1;
      bh >>= 1;
    }
  }

  private lastSize: [number, number, number] | null = null;
  /** Pick a graphics quality preset (and the grain / vignette options); resizes if the resolution changes. */
  setGfx(level: GfxLevel, grain = this.grainOn, vignette = this.vignetteOn) {
    const resChanged = GFX[level].res !== this.gfx.res, dofChanged = GFX[level].dofScale !== this.gfx.dofScale;
    this.gfxLevel = level;
    this.gfx = GFX[level];
    this.grainOn = grain;
    this.vignetteOn = vignette;
    if (resChanged && this.lastSize) this.resize(...this.lastSize);
    else if (dofChanged && this.rtScene) {
      const [dw, dh] = this.dofSize(this.W, this.H);
      this.rtDofA.resize(dw, dh);
      this.rtDofB.resize(dw, dh);
      this.rtTile.resize(Math.ceil(dw / 16), Math.ceil(dh / 16));
      this.rtTileD.resize(Math.ceil(dw / 16), Math.ceil(dh / 16));
    }
  }

  /** Resize the drawing buffer. cssW/cssH are the displayed size, dpr the device pixel ratio. */
  resize(cssW: number, cssH: number, dpr: number) {
    this.lastSize = [cssW, cssH, dpr];
    const aspect = cssW / cssH;
    this.VH = 360;
    this.VW = Math.round(Math.min(Math.max(this.VH * aspect, 540), 860));
    const maxPixels = 2560 * 1440 * this.quality * this.quality;
    const res = this.gfx.res;
    let pw = Math.round(cssW * dpr * res), ph = Math.round(cssH * dpr * res);
    const k = Math.sqrt(Math.min(1, maxPixels / (pw * ph)));
    pw = Math.max(2, Math.round(pw * k));
    ph = Math.max(2, Math.round(ph * k));
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.W = pw;
    this.H = ph;
    this.scale = ph / this.VH;
    this.allocTargets(pw, ph);
  }

  // ---------------------------------------------------------------- layers
  /**
   * Select the parallax layer for subsequent draws.
   * p: horizontal parallax (1 = gameplay plane), py: vertical parallax.
   * fog: 0..1 atmospheric fog, receive: point-light receive, emissive: 0..1 (0.5 = unlit, 1 = glowing).
   */
  layer(p = 1, fog = 0, receive = 1, emissive = 0, py = p, depth = 1 / (1 + p)) {
    const L = this.L;
    const v = this.view;
    L.p = p;
    L.py = py;
    L.z = Math.pow(v.zoom, p);
    L.ox = this.VW / 2 - v.x * p * L.z + v.shakeX;
    L.oy = this.VH / 2 - REF_Y * L.z - (v.y - REF_Y) * py * L.z + v.shakeY;
    L.fog = fog;
    L.receive = receive;
    L.emissive = emissive;
    L.depth = depth;
    L.aux = packColor(fog, emissive, receive, Math.min(depth, 1));
    const pd = 1 / Math.max(depth, 0.02) - 1;
    if (pd < this.pMin) this.pMin = pd;
    if (pd > this.pMax) this.pMax = pd;
    return this;
  }
  /** Screen-space layer: coordinates are art pixels from the top-left of the view. */
  screen(fog = 0, receive = 0, emissive = 0.5, depth = 1) {
    const L = this.L;
    L.p = 0;
    L.py = 0;
    L.z = 1;
    L.ox = 0;
    L.oy = 0;
    L.fog = fog;
    L.receive = receive;
    L.emissive = emissive;
    L.depth = depth;
    L.aux = packColor(fog, emissive, receive, Math.min(depth, 1));
    const pd = 1 / Math.max(depth, 0.02) - 1;
    if (pd < this.pMin) this.pMin = pd;
    if (pd > this.pMax) this.pMax = pd;
    return this;
  }
  /** Temporarily override emissive for following draws (call with no args to restore layer value). */
  emissive(e?: number) {
    const L = this.L;
    L.aux = packColor(L.fog, e ?? L.emissive, L.receive, Math.min(L.depth, 1));
  }
  /** Water material for following scene draws: strength of reflection, ripple amount, glints. */
  water(strength = 0, ripple = 1, glint = 1) {
    this.mat = strength > 0 ? packColor(strength, Math.min(ripple / 4, 1), 0, 0) : 0;
    void glint;
  }

  /** world -> screen art px on the current layer */
  sx(x: number) {
    return x * this.L.z + this.L.ox;
  }
  sy(y: number) {
    return y * this.L.z + this.L.oy;
  }
  /** screen art px -> world on the current layer */
  wx(sx: number) {
    return (sx - this.L.ox) / this.L.z;
  }
  wy(sy: number) {
    return (sy - this.L.oy) / this.L.z;
  }
  get layerZoom() {
    return this.L.z;
  }
  /** Screen-space x of a world x on an arbitrary parallax layer (no state change). */
  projectX(x: number, p: number) {
    const z = Math.pow(this.view.zoom, p);
    return x * z + this.VW / 2 - this.view.x * p * z + this.view.shakeX;
  }
  projectY(y: number, p: number) {
    const z = Math.pow(this.view.zoom, p);
    return y * z + this.VH / 2 - REF_Y * z - (this.view.y - REF_Y) * p * z + this.view.shakeY;
  }
  /** World-space visible range on current layer (for culling) */
  visibleX0(margin = 0) {
    return this.wx(-margin);
  }
  visibleX1(margin = 0) {
    return this.wx(this.VW + margin);
  }

  // ---------------------------------------------------------------- transforms
  /**
   * Rotate following draws by `rot` radians about world point (px, py), then translate by (tx, ty).
   * Nestable; always pair with popTransform().
   */
  pushTransform(px: number, py: number, rot: number, tx = 0, ty = 0) {
    this.mStack.push({ M: this.M, R: this.MR });
    const c = Math.cos(rot), s = Math.sin(rot);
    // local: p' = R (p - pivot) + pivot + t
    const la = c, lb = s, lc = -s, ld = c;
    const le = px + tx - (c * px - s * py), lf = py + ty - (s * px + c * py);
    const P = this.M;
    if (!P) this.M = [la, lb, lc, ld, le, lf];
    else {
      const [a, b, cc, d, e, f] = P;
      this.M = [a * la + cc * lb, b * la + d * lb, a * lc + cc * ld, b * lc + d * ld, a * le + cc * lf + e, b * le + d * lf + f];
    }
    this.MR += rot;
  }
  popTransform() {
    const t = this.mStack.pop();
    this.M = t ? t.M : null;
    this.MR = t ? t.R : 0;
  }
  /** Apply the current transform to a world point (for anchoring UI to transformed objects). */
  transformPoint(x: number, y: number): [number, number] {
    const M = this.M;
    return M ? [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]] : [x, y];
  }
  get transformRot() {
    return this.MR;
  }

  // ---------------------------------------------------------------- drawing
  private writeQuad(
    b: QuadBatch, tex: Texture | null, mode: number,
    x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
    u0: number, v0: number, u1: number, v1: number, color: number, aux: number, mat: number,
  ) {
    if (b.full) {
      if (b === this.scene) this.flushScene();
      else return;
    }
    const o = b.alloc(tex, mode);
    const f = b.f32, u = b.u32;
    f[o] = x0; f[o + 1] = y0; f[o + 2] = u0; f[o + 3] = v0; u[o + 4] = color; u[o + 5] = aux; u[o + 6] = mat;
    f[o + 7] = x1; f[o + 8] = y1; f[o + 9] = u1; f[o + 10] = v0; u[o + 11] = color; u[o + 12] = aux; u[o + 13] = mat;
    f[o + 14] = x2; f[o + 15] = y2; f[o + 16] = u1; f[o + 17] = v1; u[o + 18] = color; u[o + 19] = aux; u[o + 20] = mat;
    f[o + 21] = x3; f[o + 22] = y3; f[o + 23] = u0; f[o + 24] = v1; u[o + 25] = color; u[o + 26] = aux; u[o + 27] = mat;
  }

  private emit(
    target: QuadBatch, mode: number, fr: Frame, x: number, y: number, sx: number, sy: number, rot: number,
    color: number, aux: number, mat: number, cull = true,
  ) {
    const L = this.L;
    const z = L.z;
    const M = this.M;
    if (M) {
      const x0 = x;
      x = M[0] * x0 + M[2] * y + M[4];
      y = M[1] * x0 + M[3] * y + M[5];
      rot += this.MR;
    }
    const cx = x * z + L.ox, cy = y * z + L.oy;
    const kx = sx * z, ky = sy * z;
    const l = -fr.ax * kx, r = (fr.w - fr.ax) * kx;
    const t = -fr.ay * ky, btm = (fr.h - fr.ay) * ky;
    if (rot === 0) {
      const X0 = cx + l, X1 = cx + r, Y0 = cy + t, Y1 = cy + btm;
      if (cull) {
        const minX = Math.min(X0, X1), maxX = Math.max(X0, X1), minY = Math.min(Y0, Y1), maxY = Math.max(Y0, Y1);
        if (maxX < -2 || minX > this.VW + 2 || maxY < -2 || minY > this.VH + 2) return;
      }
      this.writeQuad(target, fr.tex, mode, X0, Y0, X1, Y0, X1, Y1, X0, Y1, fr.u0, fr.v0, fr.u1, fr.v1, color, aux, mat);
    } else {
      const c = Math.cos(rot), s = Math.sin(rot);
      const ax = cx + l * c - t * s, ay = cy + l * s + t * c;
      const bx = cx + r * c - t * s, by = cy + r * s + t * c;
      const qx = cx + r * c - btm * s, qy = cy + r * s + btm * c;
      const dx = cx + l * c - btm * s, dy = cy + l * s + btm * c;
      if (cull) {
        const minX = Math.min(ax, bx, qx, dx), maxX = Math.max(ax, bx, qx, dx);
        const minY = Math.min(ay, by, qy, dy), maxY = Math.max(ay, by, qy, dy);
        if (maxX < -2 || minX > this.VW + 2 || maxY < -2 || minY > this.VH + 2) return;
      }
      this.writeQuad(target, fr.tex, mode, ax, ay, bx, by, qx, qy, dx, dy, fr.u0, fr.v0, fr.u1, fr.v1, color, aux, mat);
    }
  }

  /** Draw a sprite frame into the scene (lit) pass. */
  draw(fr: Frame, x: number, y: number, sx = 1, sy = 1, rot = 0, color = WHITE) {
    this.emit(this.scene, this.shadowMode, fr, x, y, sx, sy, rot, color, this.L.aux, this.mat);
  }

  /** Draw with the top edge sheared horizontally by `sway` world px (wind-bent vegetation). */
  drawSway(fr: Frame, x: number, y: number, sx: number, sy: number, sway: number, color = WHITE) {
    if (this.M) {
      this.emit(this.scene, this.shadowMode, fr, x, y, sx, sy, 0, color, this.L.aux, this.mat);
      return;
    }
    const L = this.L;
    const z = L.z;
    const cx = x * z + L.ox, cy = y * z + L.oy;
    const kx = sx * z, ky = sy * z;
    const l = -fr.ax * kx, r = (fr.w - fr.ax) * kx;
    const t = -fr.ay * ky, btm = (fr.h - fr.ay) * ky;
    const X0 = cx + l, X1 = cx + r, Y0 = cy + t, Y1 = cy + btm;
    const minX = Math.min(X0, X1) - Math.abs(sway * z), maxX = Math.max(X0, X1) + Math.abs(sway * z);
    if (maxX < -2 || minX > this.VW + 2 || Math.max(Y0, Y1) < -2 || Math.min(Y0, Y1) > this.VH + 2) return;
    // shear proportional to distance above the anchor
    const hT = -t / Math.max(1e-3, btm - t), hB = -btm / Math.max(1e-3, btm - t);
    const sT = sway * z * hT, sB = sway * z * hB;
    this.writeQuad(this.scene, fr.tex, this.shadowMode, X0 + sT, Y0, X1 + sT, Y0, X1 + sB, Y1, X0 + sB, Y1, fr.u0, fr.v0, fr.u1, fr.v1, color, this.L.aux, this.mat);
  }

  /** Draw a sub-rectangle (in texels) of a frame, positioned by its own top-left. */
  drawSub(fr: Frame, srcX: number, srcY: number, w: number, h: number, x: number, y: number, sx = 1, sy = 1, color = WHITE) {
    const tw = fr.tex.w, th = fr.tex.h;
    const baseU = fr.u0 * tw, baseV = fr.v0 * th;
    const sub: Frame = {
      tex: fr.tex, u0: (baseU + srcX) / tw, v0: (baseV + srcY) / th, u1: (baseU + srcX + w) / tw, v1: (baseV + srcY + h) / th,
      w, h, ax: 0, ay: 0,
    };
    this.emit(this.scene, this.shadowMode, sub, x, y, sx, sy, 0, color, this.L.aux, this.mat);
  }

  /** Solid rectangle in world space of the current layer. */
  rect(x: number, y: number, w: number, h: number, color: number) {
    this.emit(this.scene, this.shadowMode, this.white, x, y, w, h, 0, color, this.L.aux, this.mat);
  }

  /** Shadow drawing: darkens albedo only. Call endShadows() when done. */
  beginShadows() {
    this.shadowMode = 1;
  }
  endShadows() {
    this.shadowMode = 0;
  }

  /** Point light on the current layer. radius in world units. */
  light(x: number, y: number, radius: number, r: number, g: number, b: number, intensity = 1, core = 0) {
    const L = this.L;
    if (this.M) [x, y] = this.transformPoint(x, y);
    const cx = x * L.z + L.ox, cy = y * L.z + L.oy, rr = radius * L.z;
    if (cx + rr < 0 || cx - rr > this.VW || cy + rr < 0 || cy - rr > this.VH) return;
    const color = packColor(Math.min(r, 1), Math.min(g, 1), Math.min(b, 1), 1);
    const aux = packColor(Math.min(intensity / 16, 1), Math.min(core, 1), 0, 0);
    this.writeQuad(this.lights, null, 0, cx - rr, cy - rr, cx + rr, cy - rr, cx + rr, cy + rr, cx - rr, cy + rr, -1, -1, 1, 1, color, aux, 0);
  }

  /** Textured light cookie (e.g. god-ray shafts, flashlight cones) on the current layer. */
  lightTex(fr: Frame, x: number, y: number, sx: number, sy: number, rot: number, color: number, intensity = 1) {
    const aux = packColor(Math.min(intensity / 16, 1), 0, 0, 0);
    this.emit(this.lights, 1, fr, x, y, sx, sy, rot, color, aux, 0);
  }

  /** FX sprite drawn after lighting. additive=true for glows. intensity can exceed 1 (HDR). */
  fxDraw(fr: Frame, x: number, y: number, sx = 1, sy = 1, rot = 0, color = WHITE, intensity = 1, additive = true) {
    if (this.L.p < 0.9) {
      // background glows go through the depth-ordered scene pass so nearer layers occlude them
      if (additive) {
        const k = Math.min(intensity, 4) * ((color >>> 24) / 255);
        const c = packColor(Math.min(1, (color & 255) / 255 * k), Math.min(1, ((color >>> 8) & 255) / 255 * k), Math.min(1, ((color >>> 16) & 255) / 255 * k), 1);
        this.emit(this.scene, 0, fr, x, y, sx, sy, rot, c, this.L.aux, 0xff000000);
      } else this.emit(this.scene, 0, fr, x, y, sx, sy, rot, color, this.L.aux, 0);
      return;
    }
    const aux = packColor(Math.min(intensity / 16, 1), this.L.fog, 0, 0);
    this.emit(this.fx, additive ? 0 : 1, fr, x, y, sx, sy, rot, color, aux, 0);
  }
  fxRect(x: number, y: number, w: number, h: number, color: number, intensity = 1, additive = false) {
    this.fxDraw(this.white, x, y, w, h, 0, color, intensity, additive);
  }

  // ---------------------------------------------------------------- frame
  /** dt: game time (slow motion, 0 when paused); rdt: real time since the last frame (0 when paused) */
  begin(dt: number, rdt = dt) {
    this.time += dt;
    this.rdt = rdt;
    this.layered = false;
    this.pMin = Infinity;
    this.pMax = -Infinity;
    this.scene.reset();
    this.lights.reset();
    this.fx.reset();
    this.M = null;
    this.MR = 0;
    this.mStack.length = 0;
    this.layer(1);
    this.mat = 0;
    this.shadowMode = 0;
  }

  private uploadBatch(b: QuadBatch) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.f32, 0, b.count * 4 * FLOATS_PER_VERT);
  }

  private sceneCleared = false;
  /** called before any batch reaches the GPU, so sprites created mid-frame are uploaded first */
  beforeFlush: (() => void) | null = null;

  private flushScene() {
    this.beforeFlush?.();
    const gl = this.gl;
    const b = this.scene;
    this.rtScene.bind();
    if (!this.sceneCleared) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.sceneCleared = true;
    }
    if (b.count === 0) return;
    gl.bindVertexArray(this.vao);
    this.uploadBatch(b);
    const p = this.pScene.use();
    p.v2('u_view', this.VW, this.VH).i('u_tex', 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    let shadow = -1;
    for (const s of b.segs) {
      if (s.mode !== shadow) {
        shadow = s.mode;
        p.f('u_shadow', shadow);
        gl.drawBuffers(shadow ? [gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE] : [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      }
      const t = s.tex!;
      t.bind(0);
      p.v2('u_texSize', t.w, t.h);
      gl.drawElements(gl.TRIANGLES, s.n * 6, gl.UNSIGNED_SHORT, s.start * 12);
    }
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    b.reset();
  }

  private fullscreen() {
    const gl = this.gl;
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  end() {
    const gl = this.gl;
    const env = this.env;
    // 1. scene
    this.flushScene();
    this.sceneCleared = false;

    // 2. lights
    this.rtLight.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.lights.count) {
      gl.bindVertexArray(this.vao);
      this.uploadBatch(this.lights);
      const p = this.pLight.use();
      p.v2('u_view', this.VW, this.VH).i('u_tex', 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (const s of this.lights.segs) {
        p.f('u_useTex', s.mode);
        if (s.tex) s.tex.bind(0);
        gl.drawElements(gl.TRIANGLES, s.n * 6, gl.UNSIGNED_SHORT, s.start * 12);
      }
    }

    // 3. composite
    gl.disable(gl.BLEND);
    this.rtHdr.bind();
    const c = this.pComposite.use();
    this.rtScene.tex[0].bind(0);
    this.rtScene.tex[1].bind(1);
    this.rtScene.tex[2].bind(2);
    this.rtLight.tex[0].bind(3);
    c.i('u_albedo', 0).i('u_aux', 1).i('u_mat', 2).i('u_light', 3);
    c.v3('u_ambTop', env.ambientTop).v3('u_ambBot', env.ambientBottom);
    c.v3('u_fogTop', env.fogTop).v3('u_fogBot', env.fogBottom);
    c.v3('u_waterTint', env.waterTint);
    if (env.waterAxis !== null) {
      c.f('u_hasWater', 1).f('u_waterAxis', this.projectY(env.waterAxis, 1) / this.VH);
    } else c.f('u_hasWater', 0);
    c.f('u_time', this.time).v2('u_viewArt', this.VW, this.VH);
    this.fullscreen();

    // 4. fx: their own premultiplied target, laid over the scene after depth of field
    const fxOn = this.fx.count > 0;
    if (fxOn) {
      this.rtFx.bind();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindVertexArray(this.vao);
      this.uploadBatch(this.fx);
      const p = this.pFx.use();
      p.v2('u_view', this.VW, this.VH).i('u_tex', 0);
      gl.enable(gl.BLEND);
      let mode = -1;
      for (const s of this.fx.segs) {
        if (s.mode !== mode) {
          mode = s.mode;
          if (mode === 0) gl.blendFunc(gl.ONE, gl.ONE);
          else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          p.f('u_add', mode === 0 ? 1 : 0);
        }
        s.tex!.bind(0);
        p.v2('u_texSize', s.tex!.w, s.tex!.h);
        gl.drawElements(gl.TRIANGLES, s.n * 6, gl.UNSIGNED_SHORT, s.start * 12);
      }
      gl.disable(gl.BLEND);
    }

    const post = this.post, cine = this.cine, q = this.gfx, st = this.stats;
    this.trackVelocity();
    let src = this.rtHdr;

    // 5. motion blur and zoom blur (only while something moves fast enough to smear)
    const mv = this.motionParams();
    st.motion = !!mv;
    st.blur = mv ? mv.len : 0;
    if (mv) {
      if (!this.rtHdr2) this.rtHdr2 = new Target(gl, this.W, this.H, [this.hdrFormat]);
      this.rtHdr2.bind();
      const v = this.pVel.use();
      this.rtHdr.tex[0].bind(0);
      this.rtScene.tex[2].bind(1);
      v.i('u_src', 0).i('u_mat', 1).v2('u_viewArt', this.VW, this.VH).v2('u_cam', mv.cx, mv.cy).f('u_zoom', Math.max(1e-3, this.view.zoom));
      v.f('u_dolly', mv.dolly).v3('u_radial', [cine.zoomX * this.VW, cine.zoomY * this.VH, mv.radial]).f('u_maxLen', 30).f('u_taps', mv.taps);
      this.fullscreen();
      src = this.rtHdr2;
    }

    // 6. depth of field at the art resolution: colour + circle of confusion, then the separable blur
    const lens = this.lens();
    st.dof = !!lens;
    st.coc = lens ? lens.peak : 0;
    const dofA = this.rtDofA, dofB = this.rtDofB;
    if (lens) {
      dofA.bind();
      const d = this.pDofPre.use();
      src.tex[0].bind(0);
      this.rtScene.tex[2].bind(1);
      d.i('u_src', 0).i('u_mat', 1).v2('u_px', 1 / dofA.w, 1 / dofA.h).f('u_toTex', dofA.h / this.VH);
      d.v4('u_lens', lens.focus, lens.dzNear, lens.dzFar, lens.near).v4('u_lens2', lens.far, lens.max, lens.defocus, post.dof ? 1 : 0);
      d.v3('u_legacy', [post.focus, post.dofStrength, 4]);
      this.fullscreen();
      // tiles: where nothing is out of focus the blur passes skip their gather
      this.rtTile.bind();
      this.pDofTile.use().i('u_src', 0);
      dofA.tex[0].bind(0);
      this.fullscreen();
      this.rtTileD.bind();
      this.pDofDilate.use().i('u_src', 0);
      this.rtTile.tex[0].bind(0);
      this.fullscreen();
      // the blur only reaches as far as this frame's widest circle of confusion
      const reach = Math.max(1, Math.min(q.dofReach, Math.ceil(lens.peak * dofA.h / this.VH + 0.5)));
      const b = this.pDofBlur.use();
      this.rtTileD.tex[0].bind(1);
      b.i('u_src', 0).i('u_tile', 1).f('u_R', reach);
      dofB.bind();
      dofA.tex[0].bind(0);
      b.v2('u_step', 1 / dofA.w, 0);
      this.fullscreen();
      dofA.bind();
      dofB.tex[0].bind(0);
      b.v2('u_step', 0, 1 / dofB.h);
      this.fullscreen();
    }

    // 7. bloom (from the scene with its fx; the quality preset trims the chain)
    const bl = this.bloom;
    const nb = Math.max(2, Math.min(bl.length, q.bloomLevels));
    bl[0].bind();
    const bp = this.pBloomPre.use();
    src.tex[0].bind(0);
    this.rtFx.tex[0].bind(1);
    bp.i('u_src', 0).i('u_fx', 1).f('u_fxOn', fxOn ? 1 : 0).v2('u_px', 1 / this.W, 1 / this.H).f('u_threshold', env.bloomThreshold).f('u_knee', 0.35);
    this.fullscreen();
    const bd = this.pBloomDown.use();
    bd.i('u_src', 0);
    for (let i = 1; i < nb; i++) {
      bl[i].bind();
      bl[i - 1].tex[0].bind(0);
      bd.v2('u_px', 1 / bl[i - 1].w, 1 / bl[i - 1].h);
      this.fullscreen();
    }
    const bu = this.pBloomUp.use();
    bu.i('u_src', 0).f('u_weight', 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = nb - 2; i >= 0; i--) {
      bl[i].bind();
      bl[i + 1].tex[0].bind(0);
      bu.v2('u_px', 1 / bl[i + 1].w, 1 / bl[i + 1].h);
      this.fullscreen();
    }
    gl.disable(gl.BLEND);

    // 8. final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    const f = this.pFinal.use();
    src.tex[0].bind(0);
    bl[0].tex[0].bind(1);
    dofA.tex[0].bind(2);
    this.rtFx.tex[0].bind(3);
    f.i('u_hdr', 0).i('u_bloom', 1).i('u_dof', 2).i('u_fx', 3);
    f.f('u_bloomStr', Math.max(0, env.bloom + cine.bloom)).f('u_exposure', env.exposure * Math.pow(2, cine.exposure));
    f.f('u_sat', env.saturation * (1 - Math.min(1, Math.max(0, cine.desat)))).f('u_contrast', env.contrast);
    f.f('u_vignette', Math.max(0, env.vignette * (this.vignetteOn ? 1 : 0.25) + cine.vignette)).f('u_grain', this.grainOn ? env.grain : 0);
    f.f('u_time', this.time).f('u_ca', Math.max(0, post.ca + cine.ca));
    f.f('u_fade', post.fade).f('u_flash', post.flash).f('u_dofOn', lens ? 1 : 0).f('u_dofArt', this.VH / dofA.h).f('u_fxOn', fxOn ? 1 : 0);
    f.v3('u_lift', env.lift).v3('u_gamma', env.gamma).v3('u_gain', env.gain).v3('u_fadeColor', post.fadeColor);
    f.v2('u_viewArt', this.VW, this.VH).v2('u_res', this.W, this.H);
    this.fullscreen();
  }

  /** the camera's screen velocity (gameplay plane, art px/s) and zoom rate, from the views of the last frames */
  private trackVelocity() {
    const v = this.view, m = this.vel, dt = this.rdt;
    if (!Number.isFinite(m.px)) { m.px = v.x; m.py = v.y; m.pz = v.zoom; return; }
    if (dt <= 0) return;
    const dx = (v.x - m.px) * v.zoom, dy = (v.y - m.py) * v.zoom;
    const dz = Math.log(Math.max(1e-4, v.zoom) / Math.max(1e-4, m.pz));
    m.px = v.x; m.py = v.y; m.pz = v.zoom;
    // a cut (scene change, snapped camera) never smears
    if (Math.hypot(dx, dy) > this.VW * 0.3 || Math.abs(dz) > 0.3) { m.x = m.y = m.z = 0; return; }
    const k = 1 - Math.exp(-dt / 0.035);
    m.x += (dx / dt - m.x) * k;
    m.y += (dy / dt - m.y) * k;
    m.z += (dz / dt - m.z) * k;
  }

  /** motion / zoom blur for this frame, or null when nothing would smear by more than a fraction of a pixel */
  private motionParams() {
    const c = this.cine, q = this.gfx, m = this.vel;
    let cx = 0, cy = 0, dolly = 0;
    const gain = Math.max(0, c.motion);
    if (q.motionTaps > 0 && gain > 0 && this.layered) {
      const sp = Math.hypot(m.x, m.y), v0 = MOTION_V0 / Math.max(gain, 0.25);
      if (sp > v0) {
        const k = ((sp - v0) / sp) * SHUTTER * gain;
        cx = m.x * k;
        cy = m.y * k;
      }
      const dg = Math.max(0, c.dolly) * gain, zr = Math.abs(m.z), z0 = DOLLY_V0 / Math.max(dg, 0.25);
      if (dg > 0 && zr > z0) dolly = Math.sign(m.z) * (zr - z0) * SHUTTER * dg;
    }
    const radial = c.zoomBlur > 0.002 && q.zoomTaps > 0 ? Math.min(1, c.zoomBlur) * 0.12 : 0;
    const len = Math.hypot(cx, cy) * 1.5 + Math.abs(dolly) * this.VW * 0.75 + radial * this.VW * 0.6;
    if (len < 0.6) return null;
    const most = Math.max(q.motionTaps, radial > 0 ? q.zoomTaps : 0, 4);
    return { cx, cy, dolly, radial, len, taps: Math.max(4, Math.min(most, Math.ceil(len / 1.5))) };
  }

  /** the lens for this frame, or null when nothing is out of focus */
  private lens() {
    const c = this.cine, q = this.gfx, post = this.post;
    const maxCoc = q.dofReach / q.dofScale;
    const defocus = Math.min(maxCoc, Math.max(0, c.defocus));
    const none = { focus: 1, dzNear: 0, dzFar: 0, near: 0, far: 0, max: maxCoc, defocus };
    if (post.dof) return { ...none, peak: 4 };
    if (!this.layered) return defocus > 0.05 ? { ...none, peak: defocus } : null;
    const a = Math.max(0, c.dof), b = q.baseDof ? 1 : 0;
    let dzNear: number, dzFar: number, near: number, far: number;
    if (a <= 1) {
      dzNear = LENS_BASE.dzNear + (LENS_CINE.dzNear - LENS_BASE.dzNear) * a;
      dzFar = LENS_BASE.dzFar + (LENS_CINE.dzFar - LENS_BASE.dzFar) * a;
      near = LENS_BASE.near * b * (1 - a) + LENS_CINE.near * a;
      far = LENS_BASE.far * b * (1 - a) + LENS_CINE.far * a;
    } else {
      dzNear = LENS_CINE.dzNear;
      dzFar = LENS_CINE.dzFar;
      near = LENS_CINE.near * a;
      far = LENS_CINE.far * a;
    }
    // closer framing, shallower focus (and a wide shot keeps more of the scene sharp)
    const zk = Math.min(1.8, Math.max(0.6, Math.sqrt(Math.max(0.01, this.view.zoom) / 1.25)));
    near *= zk;
    far *= zk;
    // the everyday lens focuses on the gameplay plane; a cinematic one racks to its own plane as it comes in
    const focus = Math.max(0, 1 + (c.focus - 1) * Math.min(1, a));
    // the widest blur on screen: the farthest and the nearest layer drawn this frame
    const pFar = Number.isFinite(this.pMin) ? Math.max(0, this.pMin) : 0, pNear = Number.isFinite(this.pMax) ? this.pMax : 1.5;
    const peak = Math.max(Math.max(0, focus - pFar - dzFar) * far, Math.max(0, pNear - focus - dzNear) * near, defocus);
    if (peak < 0.3) return null;
    return { focus, dzNear, dzFar, near, far, max: maxCoc, defocus, peak: Math.min(peak, maxCoc) };
  }

  /** Create a texture from RGBA pixels. */
  texture(w: number, h: number, pixels: ArrayBufferView | null, nearest = false) {
    const gl = this.gl;
    return new Texture(gl, w, h, { filter: nearest ? gl.NEAREST : gl.LINEAR }, pixels);
  }
}

/** Build a frame covering a whole texture. */
export function frameOf(tex: Texture, ax = 0, ay = 0, w = tex.w, h = tex.h): Frame {
  return { tex, u0: 0, v0: 0, u1: w / tex.w, v1: h / tex.h, w, h, ax, ay };
}
