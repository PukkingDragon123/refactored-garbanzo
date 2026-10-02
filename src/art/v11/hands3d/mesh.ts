// Turning the sculpt into a skinned mesh: surface nets over a narrow band of the distance field (a
// coarse pass finds where the surface is, only those cells are refined), vertices snapped onto the
// surface with field normals, then a bake per vertex: skin weights, anatomical coordinates, ambient
// occlusion and thickness from the field, vein masks and the material. Built once per character and
// side, cached for the session.

import { Sdf, normalAt, prune } from './sdf';
import { Rig, makeRig, NB } from './rig';
import { V3 } from './math3';
import { MAT, PartSpec, Skinner, top4, skinSdf, sleeveSdf, accessorySdfs, gloveSdf } from './body';
import { Look, lookKey } from './looks';

export interface MeshData {
  /** bind-space positions and normals (cm) */
  pos: Float32Array;
  nrm: Float32Array;
  bones: Uint8Array;
  wts: Float32Array;
  /** s, dorsal, lateral, region */
  det: Float32Array;
  /** ao, vein, thickness, material */
  bake: Float32Array;
  idx: Uint32Array;
  nv: number;
  ni: number;
  /** milliseconds it took */
  ms: number;
}

interface Raw { pos: number[]; nrm: number[]; idx: number[] }

/** pruned copies of a field per cubic tile (see prune): exact near the surface, much cheaper */
export class Tiles {
  private map = new Map<number, Sdf | null>();
  constructor(readonly f: Sdf, readonly size: number, readonly reach: number) {}
  at(x: number, y: number, z: number): Sdf | null {
    const T = this.size, i = Math.floor(x / T), j = Math.floor(y / T), k = Math.floor(z / T);
    const key = ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
    let t = this.map.get(key);
    if (t === undefined) {
      t = prune(this.f, (i + 0.5) * T, (j + 0.5) * T, (k + 0.5) * T, T * 0.87, this.reach);
      this.map.set(key, t);
    }
    return t;
  }
  eval(x: number, y: number, z: number): number {
    const t = this.at(x, y, z);
    return t ? t.eval(x, y, z) : 1e3;
  }
}

/** surface nets of f over box at step h; yCut drops everything below it (an open end) */
export function polygonize(f: Sdf, box: number[], h: number, yCut = -1e9, inset = 0): Raw {
  const [x0, y0, z0, x1, y1, z1] = box;
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const C = 4;
  const cnx = Math.ceil((nx - 1) / C) + 1, cny = Math.ceil((ny - 1) / C) + 1, cnz = Math.ceil((nz - 1) / C) + 1;
  const tiles = new Tiles(f, C * h, 1.8);
  const ev = (x: number, y: number, z: number) => {
    const d = tiles.eval(x, y, z) + inset;
    return y < yCut ? Math.max(d, yCut - y) : d;
  };
  const cv = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++)
    cv[(k * cny + j) * cnx + i] = ev(x0 + i * C * h, y0 + j * C * h, z0 + k * C * h);
  const N = nx * ny * nz, sy = nx, sz = nx * ny;
  const fv = new Float32Array(N).fill(NaN);
  const thr = C * h * 0.87 * 1.45;
  for (let k = 0; k < cnz - 1; k++) for (let j = 0; j < cny - 1; j++) for (let i = 0; i < cnx - 1; i++) {
    const c = (k * cny + j) * cnx + i;
    let mn = 1e9, pos = false, neg = false;
    for (let q = 0; q < 8; q++) {
      const v = cv[c + (q & 1) + ((q >> 1) & 1) * cnx + (q >> 2) * cnx * cny];
      const a = Math.abs(v);
      if (a < mn) mn = a;
      if (v < 0) neg = true; else pos = true;
    }
    if (mn > thr && !(pos && neg)) continue;
    const ia = i * C, ja = j * C, ka = k * C, ib = Math.min(nx - 1, ia + C);
    for (let kk = ka; kk <= Math.min(nz - 1, ka + C); kk++) for (let jj = ja; jj <= Math.min(ny - 1, ja + C); jj++) {
      const row = kk * sz + jj * sy;
      for (let ii = ia; ii <= ib; ii++) {
        const n = row + ii;
        let d = fv[n];
        if (d !== d) { d = ev(x0 + ii * h, y0 + jj * h, z0 + kk * h); fv[n] = d; }
        // far from the surface: the next few nodes along the row can't be corners of a crossing cell
        const ad = Math.abs(d);
        if (ad > 2.4 * h) {
          const m = Math.floor((ad * 0.8 - 1.9 * h) / h);
          for (let q = 1; q <= m && ii + q <= ib; q++) {
            const nq = n + q;
            if (fv[nq] !== fv[nq]) fv[nq] = d > 0 ? ad * 0.8 - q * h : -(ad * 0.8 - q * h);
          }
          ii += Math.max(0, m - 1);
        }
      }
    }
  }
  // one vertex per cell that the surface crosses: the mean of its edge crossings, snapped onto the surface
  const vi = new Int32Array(N).fill(-1);
  const pos: number[] = [], nrm: number[] = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cval = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const n0 = k * sz + j * sy + i;
    let mask = 0, ok = true;
    for (let q = 0; q < 8; q++) {
      const v = fv[n0 + (q & 1) + ((q >> 1) & 1) * sy + (q >> 2) * sz];
      if (v !== v) { ok = false; break; }
      cval[q] = v;
      if (v < 0) mask |= 1 << q;
    }
    if (!ok || mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, cnt = 0;
    for (const [a, b] of E) {
      const va = cval[a], vb = cval[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      ax += (a & 1) + (((b & 1) - (a & 1)) * t);
      ay += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t);
      az += (a >> 2) + (((b >> 2) - (a >> 2)) * t);
      cnt++;
    }
    let px = x0 + (i + ax / cnt) * h, py = y0 + (j + ay / cnt) * h, pz = z0 + (k + az / cnt) * h;
    // snap: one Newton step along the field normal
    const nn = normalAt(tiles.at(px, py, pz) ?? f, px, py, pz, h * 0.35);
    const d = ev(px, py, pz);
    if (Math.abs(d) < h) { px -= nn[0] * d; py -= nn[1] * d; pz -= nn[2] * d; }
    vi[n0] = pos.length / 3;
    pos.push(px, py, pz);
    nrm.push(nn[0], nn[1], nn[2]);
  }
  // a quad across every grid edge the surface crosses
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tri(a, b, c); tri(a, c, d);
  };
  const tri = (a: number, b: number, c: number) => {
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const mx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], my = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], mz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    if (cx * mx + cy * my + cz * mz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const n = k * sz + j * sy + i, v = fv[n];
    if (v !== v) continue;
    const inside = v < 0;
    const vxp = fv[n + 1], vyp = fv[n + sy], vzp = fv[n + sz];
    if (vxp === vxp && (vxp < 0) !== inside) quad(vi[n - sy - sz], vi[n - sz], vi[n], vi[n - sy]);
    if (vyp === vyp && (vyp < 0) !== inside) quad(vi[n - 1 - sz], vi[n - sz], vi[n], vi[n - 1]);
    if (vzp === vzp && (vzp < 0) !== inside) quad(vi[n - 1 - sy], vi[n - sy], vi[n], vi[n - 1]);
  }
  return { pos, nrm, idx };
}

/** ambient occlusion from the field: how much the field closes in along the normal */
function aoAt(f: Sdf, p: number[], n: number[], s: number) {
  let occ = 0;
  const H = [0.22, 0.6, 1.25], W = [1, 0.62, 0.38];
  for (let i = 0; i < 3; i++) {
    const hh = H[i] * s;
    const d = f.eval(p[0] + n[0] * hh, p[1] + n[1] * hh, p[2] + n[2] * hh);
    occ += Math.max(0, hh - d) * W[i];
  }
  return Math.max(0, Math.min(1, 1 - occ * 1.3 / s));
}
/** roughly how thick the body is behind this point (cm): light shines through thin parts */
function thickAt(f: Sdf, p: number[], n: number[]) {
  let deep = 0;
  for (const t of [0.45, 0.95, 1.7]) deep = Math.max(deep, -f.eval(p[0] - n[0] * t, p[1] - n[1] * t, p[2] - n[2] * t));
  return deep * 2;
}

function distPolyline(p: number[], line: V3[]) {
  let best = 1e9;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz || 1)));
    const d = Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t);
    if (d < best) best = d;
  }
  return best;
}

export interface HandAsset { rig: Rig; mesh: MeshData; look: Look }
/** build timings (ms) by phase, for tuning */
export const PROFILE: Record<string, number> = {};
const prof = (k: string, t0: number) => { PROFILE[k] = (PROFILE[k] ?? 0) + performance.now() - t0; };
const CACHE = new Map<string, HandAsset>();

/** build (or fetch) the mesh for a look and a side */
export function handAsset(look: Look, side: 'left' | 'right'): HandAsset {
  const key = lookKey(look, side);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const a = buildAssetUncached(look, side);
  CACHE.set(key, a);
  return a;
}
/** keep a mesh built elsewhere (the worker) */
export function adoptAsset(look: Look, side: 'left' | 'right', rig: Rig, mesh: MeshData): HandAsset {
  const a = { rig, mesh, look };
  CACHE.set(lookKey(look, side), a);
  return a;
}

/** sculpt, polygonize and bake (no caching) */
export function buildAssetUncached(look: Look, side: 'left' | 'right'): HandAsset {
  const t0 = performance.now();
  const rig = makeRig(look.build);
  const b = rig.build, s = b.size, A = b.arm, LF = rig.foreLen, LU = rig.upperLen;
  const skin = skinSdf(rig, look);
  const sl = sleeveSdf(rig, look);
  const parts: PartSpec[] = [];
  const handTop = 21 * s * b.fingers;
  const wx = 9.5 * Math.max(s * b.breadth, A * 0.85), wz = 6.2 * Math.max(s, A * 0.9);
  if (look.gloves) {
    const gl = gloveSdf(rig, skin, look);
    parts.push({ name: 'glove', sdf: gl.glove, mat: MAT.glove, h: 0.2 * s, box: [-wx, -3.2 * s, -wz, wx, handTop + 0.6, wz], yCut: -2.6 * s });
    parts.push({ name: 'gcuff', sdf: gl.cuff, mat: MAT.gcuff, h: 0.22 * s, box: [-wx, -8 * s, -wz, wx, -0.6 * s, wz] });
  } else {
    // the hand and wrist finely, the rest of the bare arm coarser (a hair inside, so the fine mesh wins where they overlap)
    const cut = Math.max(sl.skinFrom, -LF - LU + 4);
    parts.push({ name: 'hand', sdf: skin.sdf, mat: MAT.skin, h: 0.18 * s, box: [-wx, Math.max(cut, -6.5 * s), -wz, wx, handTop, wz], yCut: Math.max(cut, -6.5 * s) + 0.01 });
    if (cut < -5.5 * s) parts.push({ name: 'arm', sdf: skin.sdf, mat: MAT.skin, h: 0.3, box: [-wx * 1.05, cut - 0.3, -wz * 1.15, wx * 1.05, -5.0 * s, wz * 1.15], yCut: cut, inset: 0.035 });
  }
  for (const p of sl.parts) parts.push({ name: 'sleeve', sdf: p.sdf, mat: p.mat, h: p.mat === MAT.sleeve ? 0.36 : 0.24, box: [-7.5 * A - 2.5, -LF - LU, -7 * A - 2.5, 7.5 * A + 2.5, 2, 7 * A + 2.5] });
  for (const a of accessorySdfs(rig, look, side)) parts.push({ name: 'acc', sdf: a.sdf, mat: a.mat, h: a.h * s, box: [-4.6 * s, -4.5 * s, -3.6 * s, 4.6 * s, 0.4 * s, 4.2 * s] });

  const skinner = new Skinner(rig);
  const raws: { r: Raw; part: PartSpec }[] = [];
  let nv = 0, ni = 0;
  for (const part of parts) {
    // the coarse sleeve boxes are big: tighten to the part's own bounds
    part.sdf.bounds();
    const bx = part.box.slice();
    const r = part.sdf.cr + 0.5;
    bx[0] = Math.max(bx[0], part.sdf.cx - r); bx[3] = Math.min(bx[3], part.sdf.cx + r);
    bx[1] = Math.max(bx[1], part.sdf.cy - r); bx[4] = Math.min(bx[4], part.sdf.cy + r);
    bx[2] = Math.max(bx[2], part.sdf.cz - r); bx[5] = Math.min(bx[5], part.sdf.cz + r);
    const tp = performance.now();
    const raw = polygonize(part.sdf, bx, part.h, part.yCut ?? -1e9, part.inset ?? 0);
    prof('poly:' + part.name, tp);
    raws.push({ r: raw, part });
    nv += raw.pos.length / 3; ni += raw.idx.length;
  }
  const mesh: MeshData = {
    pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3), bones: new Uint8Array(nv * 4), wts: new Float32Array(nv * 4),
    det: new Float32Array(nv * 4), bake: new Float32Array(nv * 4), idx: new Uint32Array(ni), nv, ni, ms: 0,
  };
  const w = new Float32Array(NB), det = [0, 0, 0, 0];
  let vo = 0, io = 0;
  for (const { r, part } of raws) {
    const n = r.pos.length / 3;
    const aoT = new Tiles(part.sdf, 1.0, 3.2);
    const sleeveT = sl.parts.map(sp => new Tiles(sp.sdf, 1.5, 1.5));
    for (let v = 0; v < n; v++) {
      const p = [r.pos[v * 3], r.pos[v * 3 + 1], r.pos[v * 3 + 2]], nn = [r.nrm[v * 3], r.nrm[v * 3 + 1], r.nrm[v * 3 + 2]];
      const o = vo + v;
      mesh.pos.set(p, o * 3); mesh.nrm.set(nn, o * 3);
      skinner.weigh(p as V3, w, det);
      if (part.mat === MAT.metal || part.mat === MAT.glass || part.mat === MAT.strap) {
        // the watch rides the end of the forearm, not the hand
        w.fill(0); w[1] = 1;
      }
      top4(w, mesh.bones, mesh.wts, o * 4);
      const aoF = aoT.at(p[0], p[1], p[2]) ?? part.sdf;
      let ao = aoAt(aoF, p, nn, s);
      // the skin darkens into the cuffs and under bands
      let vein = 0;
      if (part.mat === MAT.skin) {
        for (const line of skin.veins) vein = Math.max(vein, 1 - Math.min(1, Math.max(0, (distPolyline(p, line) - 0.07 * s) / (0.26 * s))));
        for (const st of sleeveT) ao *= 0.35 + 0.65 * Math.min(1, Math.max(0, st.eval(p[0], p[1], p[2]) / (0.9 * s)));
      }
      const thick = part.mat === MAT.skin || part.mat === MAT.glove ? thickAt(aoF, p, nn) : 3;
      if (part.mat !== MAT.skin && part.mat !== MAT.glove) {
        // fabric and bands: around-the-arm coordinates for knit ribs, quilting, taniko
        det[0] = p[1]; det[1] = Math.atan2(p[2], p[0]); det[2] = 0; det[3] = 7;
      }
      mesh.det.set(det, o * 4);
      mesh.bake[o * 4] = ao; mesh.bake[o * 4 + 1] = vein; mesh.bake[o * 4 + 2] = thick; mesh.bake[o * 4 + 3] = part.mat;
    }
    for (let i = 0; i < r.idx.length; i++) mesh.idx[io + i] = r.idx[i] + vo;
    vo += n; io += r.idx.length;
  }
  mesh.ms = performance.now() - t0;
  return { rig, mesh, look };
}

export const cachedAsset = (look: Look, side: 'left' | 'right') => CACHE.get(lookKey(look, side)) ?? null;
