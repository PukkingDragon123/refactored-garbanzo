// Thin WebGL2 helpers: programs, textures and multi-attachment render targets.

export type GL = WebGL2RenderingContext;

function compile(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`Shader compile error:\n${log}\n${numbered}`);
  }
  return s;
}

export class Program {
  readonly prog: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(readonly gl: GL, vs: string, fs: string, readonly name = 'program') {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`Program link error (${name}): ${gl.getProgramInfoLog(p)}`);
    }
    this.prog = p;
  }
  use() {
    this.gl.useProgram(this.prog);
    return this;
  }
  loc(name: string) {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.prog, name);
      this.locs.set(name, l);
    }
    return l;
  }
  i(name: string, v: number) {
    this.gl.uniform1i(this.loc(name), v);
    return this;
  }
  f(name: string, v: number) {
    this.gl.uniform1f(this.loc(name), v);
    return this;
  }
  v2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(name), x, y);
    return this;
  }
  v3(name: string, v: ArrayLike<number>) {
    this.gl.uniform3f(this.loc(name), v[0], v[1], v[2]);
    return this;
  }
  v4(name: string, x: number, y: number, z: number, w: number) {
    this.gl.uniform4f(this.loc(name), x, y, z, w);
    return this;
  }
}

export interface TexOpts {
  internal?: number;
  format?: number;
  type?: number;
  filter?: number;
  wrap?: number;
  premultiply?: boolean;
}

let texIdCounter = 1;

export class Texture {
  readonly tex: WebGLTexture;
  readonly id = texIdCounter++;
  w: number;
  h: number;
  private o: Required<TexOpts>;

  constructor(readonly gl: GL, w: number, h: number, opts: TexOpts = {}, data: ArrayBufferView | null = null) {
    this.w = w;
    this.h = h;
    this.o = {
      internal: opts.internal ?? gl.RGBA8,
      format: opts.format ?? gl.RGBA,
      type: opts.type ?? gl.UNSIGNED_BYTE,
      filter: opts.filter ?? gl.LINEAR,
      wrap: opts.wrap ?? gl.CLAMP_TO_EDGE,
      premultiply: opts.premultiply ?? true,
    };
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.o.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.o.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.o.wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.o.wrap);
    this.alloc(data);
  }

  private alloc(data: ArrayBufferView | null) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.o.premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.o.internal, this.w, this.h, 0, this.o.format, this.o.type, data);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  /** Upload RGBA8 pixels (Uint8Array/Uint8ClampedArray) into a sub-rectangle. */
  subImage(x: number, y: number, w: number, h: number, pixels: ArrayBufferView) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.o.premultiply);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, this.o.format, this.o.type, pixels);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
    this.alloc(null);
  }

  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
  }

  dispose() {
    this.gl.deleteTexture(this.tex);
  }
}

export interface AttachmentSpec {
  internal: number;
  format: number;
  type: number;
  filter?: number;
}

export class Target {
  readonly fbo: WebGLFramebuffer;
  readonly tex: Texture[] = [];
  w: number;
  h: number;

  constructor(readonly gl: GL, w: number, h: number, specs: AttachmentSpec[]) {
    this.w = w;
    this.h = h;
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    specs.forEach((s, i) => {
      const t = new Texture(gl, w, h, { internal: s.internal, format: s.format, type: s.type, filter: s.filter ?? gl.LINEAR, premultiply: false });
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0);
      this.tex.push(t);
    });
    gl.drawBuffers(specs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incomplete: 0x' + status.toString(16));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    for (const t of this.tex) t.resize(w, h);
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
  }
}
