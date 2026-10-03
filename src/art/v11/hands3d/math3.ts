// Small 3D math for the hand renderer: vectors, quaternions (x, y, z, w), rigid transforms, dual
// quaternions for skinning and column-major 4x4 matrices for the GPU. Plain arrays, no classes.

export type V3 = [number, number, number];
export type Q = [number, number, number, number];
/** a rigid transform: rotation q then translation t */
export interface Xf { q: Q; t: V3 }

export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
/** a + b * s */
export const vmadd = (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const vdist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const vnorm = (a: V3): V3 => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vlerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** the component of v perpendicular to unit n */
export const vperp = (v: V3, n: V3): V3 => vmadd(v, n, -vdot(v, n));

export const qid = (): Q => [0, 0, 0, 1];
export function qaxis(axis: V3, ang: number): Q {
  const a = vnorm(axis), s = Math.sin(ang / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)];
}
export function qmul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export const qconj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];
export function qnorm(q: Q): Q {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** rotate v by unit quaternion q */
export function qrot(q: Q, v: V3): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export function qslerp(a: Q, b: Q, t: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb: Q = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) return qnorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th), ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return [a[0] * ka + bb[0] * kb, a[1] * ka + bb[1] * kb, a[2] * ka + bb[2] * kb, a[3] * ka + bb[3] * kb];
}
/** the shortest rotation taking unit a onto unit b */
export function qfromTo(a: V3, b: V3): Q {
  const d = vdot(a, b);
  if (d < -0.99999) {
    const ax = Math.abs(a[0]) < 0.9 ? vcross([1, 0, 0], a) : vcross([0, 1, 0], a);
    return qaxis(ax, Math.PI);
  }
  const c = vcross(a, b);
  return qnorm([c[0], c[1], c[2], 1 + d]);
}
/** quaternion from an orthonormal basis (the columns: where the local x, y, z axes point) */
export function qbasis(x: V3, y: V3, z: V3): Q {
  const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q: Q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return qnorm(q);
}
/** a frame whose +y is `y` and whose +z is as close to `zHint` as possible */
export function qlook(y: V3, zHint: V3): Q {
  const Y = vnorm(y);
  let Z = vperp(zHint, Y);
  if (vlen(Z) < 1e-6) Z = vperp(Math.abs(Y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], Y);
  Z = vnorm(Z);
  return qbasis(vcross(Y, Z), Y, Z);
}
/** decompose q into swing (about an axis perpendicular to `axis`) * twist (about `axis`); returns the twist angle */
export function qtwistAngle(q: Q, axis: V3): number {
  const p = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2];
  return 2 * Math.atan2(p, q[3]);
}

export const xid = (): Xf => ({ q: qid(), t: [0, 0, 0] });
/** a ∘ b (apply b, then a) */
export const xmul = (a: Xf, b: Xf): Xf => ({ q: qnorm(qmul(a.q, b.q)), t: vadd(a.t, qrot(a.q, b.t)) });
export const xinv = (a: Xf): Xf => { const qi = qconj(a.q); return { q: qi, t: vscale(qrot(qi, a.t), -1) }; };
export const xapply = (a: Xf, p: V3): V3 => vadd(a.t, qrot(a.q, p));

/** a rigid transform as a dual quaternion (real, dual) packed in 8 floats at out[o..o+7] */
export function xToDQ(x: Xf, out: Float32Array, o: number) {
  const [qx, qy, qz, qw] = x.q, [tx, ty, tz] = x.t;
  out[o] = qx; out[o + 1] = qy; out[o + 2] = qz; out[o + 3] = qw;
  // dual = 0.5 * t * q
  out[o + 4] = 0.5 * (tx * qw + ty * qz - tz * qy);
  out[o + 5] = 0.5 * (-tx * qz + ty * qw + tz * qx);
  out[o + 6] = 0.5 * (tx * qy - ty * qx + tz * qw);
  out[o + 7] = -0.5 * (tx * qx + ty * qy + tz * qz);
}

// ------------------------------------------------------------------ 4x4 (column-major, for GL)
export type M4 = Float32Array;
export const m4 = (): M4 => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
export function m4mul(a: M4, b: M4, out: M4 = new Float32Array(16)): M4 {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
export function m4persp(fovy: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
  return m;
}
export function m4ortho(l: number, r: number, b: number, t: number, n: number, f: number): M4 {
  const m = new Float32Array(16);
  m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1;
  return m;
}
/** view matrix: camera at eye looking at target */
export function m4lookAt(eye: V3, target: V3, up: V3): M4 {
  const z = vnorm(vsub(eye, target)), x = vnorm(vcross(up, z)), y = vcross(z, x), m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -vdot(x, eye); m[13] = -vdot(y, eye); m[14] = -vdot(z, eye); m[15] = 1;
  return m;
}
export function m4apply(m: M4, p: V3): [number, number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
  ];
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const DEG = Math.PI / 180;
