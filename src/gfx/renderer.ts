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
  dof: boolean;
  focus: number;
  dofStrength: number;
}

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

  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private ibo: WebGLBuffer;
  private emptyVao: WebGLVertexArrayObject;

  private pScene: Program;
  private pLight: Program;
  private pFx: Program;
  private pComposite: Program;
  private pDof: Program;
  private pBloomPre: Program;
  private pBloomDown: Program;
  private pBloomUp: Program;
  private pFinal: Program;
  private pBlit: Program;

  private rtScene!: Target;
  private rtLight!: Target;
  private rtHdr!: Target;
  private rtDof!: Target;
  private bloom: Target[] = [];

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
    this.pDof = new Program(gl, S.FULL_VS, S.DOF_FS, 'dof');
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

  private allocTargets(w: number, h: number) {
    const gl = this.gl;
    const rgba8 = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    const hdr = this.hdrFormat;
    if (!this.rtScene) {
      this.rtScene = new Target(gl, w, h, [rgba8, rgba8, rgba8]);
      this.rtLight = new Target(gl, Math.max(1, w >> 1), Math.max(1, h >> 1), [hdr]);
      this.rtHdr = new Target(gl, w, h, [hdr]);
      this.rtDof = new Target(gl, Math.max(1, w >> 1), Math.max(1, h >> 1), [hdr]);
    } else {
      this.rtScene.resize(w, h);
      this.rtLight.resize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      this.rtHdr.resize(w, h);
      this.rtDof.resize(Math.max(1, w >> 1), Math.max(1, h >> 1));
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

  /** Resize the drawing buffer. cssW/cssH are the displayed size, dpr the device pixel ratio. */
  resize(cssW: number, cssH: number, dpr: number) {
    const aspect = cssW / cssH;
    this.VH = 360;
    this.VW = Math.round(Math.min(Math.max(this.VH * aspect, 540), 860));
    const maxPixels = 2560 * 1440 * this.quality * this.quality;
    let pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
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
  begin(dt: number) {
    this.time += dt;
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

    // 4. fx
    if (this.fx.count) {
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
        }
        s.tex!.bind(0);
        p.v2('u_texSize', s.tex!.w, s.tex!.h);
        gl.drawElements(gl.TRIANGLES, s.n * 6, gl.UNSIGNED_SHORT, s.start * 12);
      }
      gl.disable(gl.BLEND);
    }

    const post = this.post;
    // 5. depth of field (half res)
    if (post.dof) {
      this.rtDof.bind();
      const d = this.pDof.use();
      this.rtHdr.tex[0].bind(0);
      this.rtScene.tex[2].bind(1);
      d.i('u_src', 0).i('u_aux', 1).f('u_focus', post.focus).f('u_strength', post.dofStrength);
      d.v2('u_px', 1 / this.rtDof.w, 1 / this.rtDof.h).f('u_maxR', Math.max(2, this.rtDof.h / 90));
      this.fullscreen();
    }

    // 6. bloom
    const bl = this.bloom;
    bl[0].bind();
    const bp = this.pBloomPre.use();
    this.rtHdr.tex[0].bind(0);
    bp.i('u_src', 0).v2('u_px', 1 / this.W, 1 / this.H).f('u_threshold', env.bloomThreshold).f('u_knee', 0.35);
    this.fullscreen();
    const bd = this.pBloomDown.use();
    bd.i('u_src', 0);
    for (let i = 1; i < bl.length; i++) {
      bl[i].bind();
      bl[i - 1].tex[0].bind(0);
      bd.v2('u_px', 1 / bl[i - 1].w, 1 / bl[i - 1].h);
      this.fullscreen();
    }
    const bu = this.pBloomUp.use();
    bu.i('u_src', 0).f('u_weight', 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bl.length - 2; i >= 0; i--) {
      bl[i].bind();
      bl[i + 1].tex[0].bind(0);
      bu.v2('u_px', 1 / bl[i + 1].w, 1 / bl[i + 1].h);
      this.fullscreen();
    }
    gl.disable(gl.BLEND);

    // 7. final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    const f = this.pFinal.use();
    this.rtHdr.tex[0].bind(0);
    bl[0].tex[0].bind(1);
    this.rtDof.tex[0].bind(2);
    this.rtScene.tex[2].bind(3);
    f.i('u_hdr', 0).i('u_bloom', 1).i('u_dof', 2).i('u_aux', 3);
    f.f('u_bloomStr', env.bloom).f('u_exposure', env.exposure).f('u_sat', env.saturation).f('u_contrast', env.contrast);
    f.f('u_vignette', env.vignette).f('u_grain', env.grain).f('u_time', this.time).f('u_ca', post.ca);
    f.f('u_fade', post.fade).f('u_flash', post.flash).f('u_dofOn', post.dof ? 1 : 0).f('u_focus', post.focus).f('u_dofStr', post.dofStrength);
    f.v3('u_lift', env.lift).v3('u_gamma', env.gamma).v3('u_gain', env.gain).v3('u_fadeColor', post.fadeColor);
    f.v2('u_viewArt', this.VW, this.VH).v2('u_res', this.W, this.H);
    this.fullscreen();
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
