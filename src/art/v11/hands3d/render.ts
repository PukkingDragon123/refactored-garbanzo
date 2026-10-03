// The WebGL2 side: one small transparent canvas with its own context. Per frame: a key-light shadow
// map of every hand (and held-object occluders), the hands into a multisampled buffer (occluders
// first, depth only, so fingers can wrap behind a handle drawn in 2D), an optional contact-shadow
// plane behind them, then a composite to the canvas (premultiplied, with an optional ink outline and
// palette quantization for sitting in a pixel-art scene).

import { SKIN_VS, SKIN_FS, DEPTH_VS, DEPTH_FS, CAP_VS, PLANE_VS, PLANE_FS, POST_VS, POST_FS, NCAP, NB_GL } from './shaders';
import type { MeshData } from './mesh';
import { M4, V3, m4mul, m4persp, m4lookAt, m4ortho, vnorm, vcross, vsub, vscale, vadd } from './math3';

export interface LightRig {
  /** directions point from the surface toward the light (world: x right, y up, z toward the viewer) */
  key: { dir: V3; col: V3 };
  fill: { dir: V3; col: V3 };
  rim: { dir: V3; col: V3 };
  sky: V3;
  ground: V3;
  exposure: number;
  /** shadow softness in shadow-map texels */
  soft: number;
}

export interface DrawHand {
  mesh: MeshData;
  /** a key for the GPU buffers */
  key: string;
  dq: Float32Array;
  model: M4;
  mirror: boolean;
  uniforms: (gl: WebGL2RenderingContext, loc: (n: string) => WebGLUniformLocation | null) => void;
  visible: boolean;
}
export interface Capsule { a: V3; b: V3; r: number; tag: number }
export interface FrameSpec {
  hands: DrawHand[];
  view: M4;
  proj: M4;
  camPos: V3;
  lights: LightRig;
  /** capsules for AO (digits, palm, held things) */
  caps: Capsule[];
  /** depth-only occluders (held objects drawn in 2D) */
  occluders: Capsule[];
  /** the shadow-catcher plane at depth z (cm), covering rect */
  plane: { z: number; rect: [number, number, number, number]; opacity: number; ao: number; col: V3 } | null;
  /** bounding sphere of what casts shadows */
  bounds: { c: V3; r: number };
  outline: number;
  ink: V3;
  quant: number;
  time: number;
}

type Prog = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };

export class HandRenderer {
  readonly gl: WebGL2RenderingContext;
  private progs: Record<string, Prog> = {};
  private vaos = new Map<string, { vao: WebGLVertexArrayObject; n: number; bufs: WebGLBuffer[] }>();
  private shadowFbo: WebGLFramebuffer | null = null;
  private shadowTex: WebGLTexture | null = null;
  private shadowSize = 1024;
  private msFbo: WebGLFramebuffer | null = null;
  private msColor: WebGLRenderbuffer | null = null;
  private msDepth: WebGLRenderbuffer | null = null;
  private resFbo: WebGLFramebuffer | null = null;
  private resTex: WebGLTexture | null = null;
  private w = 0;
  private h = 0;
  private samples = 4;
  private capVao: { vao: WebGLVertexArrayObject; n: number } | null = null;
  private planeVao: WebGLVertexArrayObject | null = null;
  private postVao: WebGLVertexArrayObject | null = null;
  lost = false;

  constructor(readonly canvas: HTMLCanvasElement, opts: { lowPower?: boolean } = {}) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: opts.lowPower ? 'low-power' : 'default' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    if (opts.lowPower) this.shadowSize = 512;
    this.progs.skin = this.program(SKIN_VS, SKIN_FS);
    this.progs.depth = this.program(DEPTH_VS, DEPTH_FS);
    this.progs.cap = this.program(CAP_VS, DEPTH_FS);
    this.progs.plane = this.program(PLANE_VS, PLANE_FS);
    this.progs.post = this.program(POST_VS, POST_FS);
    this.initShadow();
    this.initCapsule();
    this.planeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.planeVao);
    const pb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.postVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
  }

  private program(vs: string, fs: string): Prog {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
        console.error('[hands3d] shader error', log, '\n', lines.slice(0, 200));
        throw new Error('hands3d shader: ' + log);
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('hands3d link: ' + gl.getProgramInfoLog(p));
    return { p, u: new Map() };
  }
  private loc(pr: Prog, n: string) {
    let l = pr.u.get(n);
    if (l === undefined) { l = this.gl.getUniformLocation(pr.p, n); pr.u.set(n, l); }
    return l;
  }

  private initShadow() {
    const gl = this.gl, S = this.shadowSize;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, S, S);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private initCapsule() {
    // a unit capsule: y 0..1 is the tube, below 0 and above 1 the hemispheres (radius 1)
    const gl = this.gl, pos: number[] = [], idx: number[] = [];
    const seg = 16, rings = 6;
    const rows: number[][] = [];
    for (let r = 0; r <= rings; r++) { const a = -Math.PI / 2 + (r / rings) * (Math.PI / 2); rows.push([Math.cos(a), Math.sin(a)]); }
    const prof: [number, number][] = [];
    for (const [c, s] of rows) prof.push([c, s]);
    for (let r = rings; r >= 0; r--) prof.push([rows[r][0], 1 - rows[r][1]]);
    for (let i = 0; i < prof.length; i++) for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * prof[i][0], prof[i][1] < 0 || i < rings + 1 ? prof[i][1] : prof[i][1], Math.sin(a) * prof[i][0]);
    }
    for (let i = 0; i + 1 < prof.length; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.capVao = { vao, n: idx.length };
  }

  /** upload a mesh once per context */
  private meshVao(key: string, m: MeshData) {
    const hit = this.vaos.get(key);
    if (hit) return hit;
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const bufs: WebGLBuffer[] = [];
    const attr = (i: number, data: Float32Array | Uint8Array, size: number, int = false) => {
      const b = gl.createBuffer()!;
      bufs.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(i);
      if (int) gl.vertexAttribIPointer(i, size, gl.UNSIGNED_BYTE, 0, 0);
      else gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
    };
    attr(0, m.pos, 3); attr(1, m.nrm, 3); attr(2, m.bones, 4, true); attr(3, m.wts, 4); attr(4, m.det, 4); attr(5, m.bake, 4);
    const ib = gl.createBuffer()!;
    bufs.push(ib);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const v = { vao, n: m.ni, bufs };
    this.vaos.set(key, v);
    return v;
  }

  /** backbuffer size in pixels */
  resize(w: number, h: number) {
    w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    if (this.msFbo) { gl.deleteFramebuffer(this.msFbo); gl.deleteRenderbuffer(this.msColor); gl.deleteRenderbuffer(this.msDepth); gl.deleteFramebuffer(this.resFbo); gl.deleteTexture(this.resTex); }
    this.msFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    this.msColor = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msColor);
    this.msDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.msDepth);
    this.resTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.resTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.resFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.resTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private lightVP(f: FrameSpec): M4 {
    const { c, r } = f.bounds;
    const L = vnorm(f.lights.key.dir);
    const eye = vadd(c, vscale(L, r * 2.5));
    const up: V3 = Math.abs(L[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    const v = m4lookAt(eye, c, up);
    const p = m4ortho(-r, r, -r, r, r * 0.3, r * 4.8);
    return m4mul(p, v);
  }

  private setLights(pr: Prog, f: FrameSpec, lvp: M4) {
    const gl = this.gl, Lr = f.lights, l = (n: string) => this.loc(pr, n);
    gl.uniform3fv(l('uKeyDir'), vnorm(Lr.key.dir)); gl.uniform3fv(l('uKeyCol'), Lr.key.col);
    gl.uniform3fv(l('uFillDir'), vnorm(Lr.fill.dir)); gl.uniform3fv(l('uFillCol'), Lr.fill.col);
    gl.uniform3fv(l('uRimDir'), vnorm(Lr.rim.dir)); gl.uniform3fv(l('uRimCol'), Lr.rim.col);
    gl.uniform3fv(l('uSky'), Lr.sky); gl.uniform3fv(l('uGround'), Lr.ground);
    gl.uniform3fv(l('uCamPos'), f.camPos);
    gl.uniformMatrix4fv(l('uLightVP'), false, lvp);
    gl.uniform1f(l('uShadowTexel'), 1 / this.shadowSize);
    gl.uniform1f(l('uShadowSoft'), Lr.soft);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(l('uShadow'), 0);
    const A = new Float32Array(NCAP * 4), B = new Float32Array(NCAP * 4);
    const n = Math.min(NCAP, f.caps.length);
    for (let i = 0; i < n; i++) {
      const c = f.caps[i];
      A.set([c.a[0], c.a[1], c.a[2], c.r], i * 4); B.set([c.b[0], c.b[1], c.b[2], c.tag], i * 4);
    }
    gl.uniform4fv(l('uCapA'), A); gl.uniform4fv(l('uCapB'), B); gl.uniform1i(l('uNCap'), n);
  }

  private drawCaps(pr: Prog, vp: M4, caps: Capsule[]) {
    const gl = this.gl;
    if (!caps.length || !this.capVao) return;
    gl.useProgram(pr.p);
    gl.uniformMatrix4fv(this.loc(pr, 'uVP'), false, vp);
    gl.bindVertexArray(this.capVao.vao);
    for (const c of caps) {
      gl.uniform3fv(this.loc(pr, 'uA'), c.a); gl.uniform3fv(this.loc(pr, 'uB'), c.b); gl.uniform1f(this.loc(pr, 'uR'), c.r);
      gl.drawElements(gl.TRIANGLES, this.capVao.n, gl.UNSIGNED_SHORT, 0);
    }
  }

  render(f: FrameSpec) {
    if (this.lost) return;
    const gl = this.gl;
    const vis = f.hands.filter(h => h.visible);
    const lvp = this.lightVP(f);
    // ---------------------------------------------------------------- shadow map
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.6, 2.5);
    const dp = this.progs.depth;
    gl.useProgram(dp.p);
    gl.uniformMatrix4fv(this.loc(dp, 'uVP'), false, lvp);
    for (const h of vis) {
      const v = this.meshVao(h.key, h.mesh);
      gl.frontFace(h.mirror ? gl.CW : gl.CCW);
      gl.cullFace(gl.BACK);
      gl.uniform4fv(this.loc(dp, 'uDQ'), h.dq);
      gl.uniformMatrix4fv(this.loc(dp, 'uModel'), false, h.model);
      gl.bindVertexArray(v.vao);
      gl.drawElements(gl.TRIANGLES, v.n, gl.UNSIGNED_INT, 0);
    }
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    this.drawCaps(this.progs.cap, lvp, f.occluders);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // ---------------------------------------------------------------- main pass
    const vp = m4mul(f.proj, f.view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // held objects drawn in the 2D scene: depth only, so the fingers behind them are hidden
    if (f.occluders.length) {
      gl.colorMask(false, false, false, false);
      this.drawCaps(this.progs.cap, vp, f.occluders);
      gl.colorMask(true, true, true, true);
    }
    const sp = this.progs.skin;
    gl.useProgram(sp.p);
    gl.uniformMatrix4fv(this.loc(sp, 'uVP'), false, vp);
    gl.uniform1f(this.loc(sp, 'uExposure'), f.lights.exposure);
    gl.uniform1f(this.loc(sp, 'uTime'), f.time);
    this.setLights(sp, f, lvp);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    for (const h of vis) {
      const v = this.meshVao(h.key, h.mesh);
      gl.frontFace(h.mirror ? gl.CW : gl.CCW);
      gl.uniform4fv(this.loc(sp, 'uDQ'), h.dq);
      gl.uniformMatrix4fv(this.loc(sp, 'uModel'), false, h.model);
      gl.uniform1f(this.loc(sp, 'uMirror'), h.mirror ? -1 : 1);
      h.uniforms(gl, n => this.loc(sp, n));
      gl.bindVertexArray(v.vao);
      gl.drawElements(gl.TRIANGLES, v.n, gl.UNSIGNED_INT, 0);
    }
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    // the contact-shadow plane behind the hands (premultiplied darkening)
    if (f.plane && f.plane.opacity + f.plane.ao > 0) {
      const pp = this.progs.plane;
      gl.useProgram(pp.p);
      gl.uniformMatrix4fv(this.loc(pp, 'uVP'), false, vp);
      this.setLights(pp, f, lvp);
      gl.uniform4fv(this.loc(pp, 'uRect'), f.plane.rect);
      gl.uniform1f(this.loc(pp, 'uZ'), f.plane.z);
      gl.uniform1f(this.loc(pp, 'uOpacity'), f.plane.opacity);
      gl.uniform1f(this.loc(pp, 'uAOK'), f.plane.ao);
      gl.uniform3fv(this.loc(pp, 'uShadeCol'), f.plane.col);
      gl.enable(gl.BLEND);
      // under what is already drawn: dst over src
      gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
      gl.depthMask(false);
      gl.bindVertexArray(this.planeVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.disable(gl.DEPTH_TEST);
    // ---------------------------------------------------------------- resolve and composite
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resFbo);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const po = this.progs.post;
    gl.useProgram(po.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.resTex);
    gl.uniform1i(this.loc(po, 'uTex'), 0);
    gl.uniform2f(this.loc(po, 'uTexel'), 1 / this.w, 1 / this.h);
    gl.uniform1f(this.loc(po, 'uOutline'), f.outline);
    gl.uniform3fv(this.loc(po, 'uInk'), f.ink);
    gl.uniform1f(this.loc(po, 'uQuant'), f.quant);
    gl.bindVertexArray(this.postVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** drop a mesh's buffers (when a look changes) */
  forget(key: string) {
    const v = this.vaos.get(key);
    if (!v) return;
    for (const b of v.bufs) this.gl.deleteBuffer(b);
    this.gl.deleteVertexArray(v.vao);
    this.vaos.delete(key);
  }

  dispose() {
    for (const k of [...this.vaos.keys()]) this.forget(k);
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ }
  }
}

/** the perspective camera that maps the layout plane z = 0 exactly onto a w x h grid at ppc grid px per cm */
export function layoutCamera(w: number, h: number, ppc: number, fovDeg: number): { view: M4; proj: M4; eye: V3; D: number } {
  const halfH = h / 2 / ppc;
  const fov = (fovDeg * Math.PI) / 180;
  const D = halfH / Math.tan(fov / 2);
  const eye: V3 = [0, 0, D];
  const view = m4lookAt(eye, [0, 0, 0], [0, 1, 0]);
  const proj = m4persp(fov, w / h, D * 0.15, D * 4);
  return { view, proj, eye, D };
}

export const NBONES = NB_GL;
export { vcross, vsub };
