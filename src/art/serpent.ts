// Procedural spine-creature renderer: every serpent of Zealandia (and the Ironjaw crocodile) is a
// chain of spine points rasterised each frame into a DynamicSprite with patterning, cylinder
// shading, stepping legs, fins, gill fronds and an articulated head.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix, withAlpha } from './color';
import { OUTLINE } from './palettes';
import { bayer, clamp } from '../core/math';

export type Pattern = 'bands' | 'diamonds' | 'stripe' | 'blotch' | 'plain' | 'rings' | 'speckle';
export type HeadKind = 'viper' | 'slim' | 'blunt' | 'croc' | 'leviathan' | 'raptor';

export interface SerpentLook {
  length: number;
  radius: number;
  /** thickness profile peak position (0 head .. 1 tail) */
  thickAt?: number;
  tailTaper?: number;
  dorsal: C[];     // ramp dark->light for back
  belly: C;
  pattern: Pattern;
  patternCol: C;
  patternCol2?: C;
  period?: number;
  head: HeadKind;
  headLen?: number;
  eye?: C;
  legs?: { at: number; len: number; col: C[] }[];
  scutes?: boolean;
  dorsalFin?: { from: number; to: number; h: number; col: C };
  gills?: C;
  pectoral?: C;
  lure?: C;
  flat?: number; // gliding: 0 normal, 1 fully flattened
  iridescent?: boolean;
}

export interface SerpentState {
  pts: [number, number][]; // spine points world coords, [0] = head
  facing: number;          // +1 faces right, -1 left
  jaw: number;             // 0 closed .. 1 wide open
  tongue: number;          // 0..1 extension
  legPhase: number;
  legLift: number;
  grounded: boolean;
  groundY: (x: number) => number;
  flatten: number;
  swell?: { at: number; k: number }; // digestion bulge
  blink?: boolean;
  submerge?: number; // y level below which pixels are faded (water)
}

type V = [number, number];

function sample(pts: V[], step: number) {
  const out: { p: V; t: V; s: number }[] = [];
  let acc = 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let seg = 1, segStart = 0;
  for (let s = 0; s <= total; s += step) {
    while (seg < pts.length - 1 && segStart + Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]) < s) {
      segStart += Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]);
      seg++;
    }
    const a = pts[seg - 1], b = pts[seg];
    const L = Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]));
    const k = clamp((s - segStart) / L, 0, 1);
    // tangent from head toward tail
    out.push({ p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], s: s / Math.max(1, total) });
    acc = s;
  }
  void acc;
  return { list: out, total };
}

export class SerpentPainter {
  constructor(readonly look: SerpentLook) {}

  radiusAt(u: number) {
    const L = this.look;
    const peak = L.thickAt ?? 0.3;
    const neck = u < 0.05 ? 0.78 + u * 2 : 1;
    let r: number;
    if (u < peak) r = 0.72 + 0.28 * Math.sin((u / peak) * Math.PI * 0.5);
    else r = 1 - Math.pow((u - peak) / (1 - peak), L.tailTaper ?? 1.3) * 0.92;
    return Math.max(0.6, L.radius * r * neck);
  }

  /**
   * Rasterise into buf. (ox, oy) is the world position of the buffer's top-left.
   */
  paint(buf: PixelBuffer, st: SerpentState, ox: number, oy: number, time: number) {
    const L = this.look;
    buf.clear();
    const pts = st.pts.map(p => [p[0] - ox, p[1] - oy] as V);
    const { list, total } = sample(pts, 0.5);
    const fdir = st.facing;
    const flat = clamp(st.flatten + (L.flat ?? 0) * 0);
    const period = L.period ?? Math.max(6, L.radius * 2.6);
    const D = L.dorsal;
    const legs = L.legs ?? [];

    // legs: far side first
    const legPos = (at: number) => list[Math.min(list.length - 1, Math.floor(at * (list.length - 1)))];
    const drawLeg = (leg: { at: number; len: number; col: C[] }, far: boolean, idx: number) => {
      const smp = legPos(leg.at);
      if (!smp) return;
      const [px, py] = smp.p;
      const r = this.radiusAt(leg.at);
      const hipX = px, hipY = py + r * 0.3;
      const phase = st.legPhase + idx * Math.PI + (far ? Math.PI : 0);
      const stride = leg.len * 0.55;
      let fx = hipX - fdir * Math.sin(phase) * stride * (st.legLift > 0 ? 1 : 0.15);
      const gy = st.grounded ? st.groundY(fx + ox) - oy : hipY + leg.len;
      let fy = Math.min(gy, hipY + leg.len * 1.1) - Math.max(0, Math.cos(phase)) * leg.len * 0.45 * st.legLift;
      if (!st.grounded) {
        fx = hipX - fdir * leg.len * 0.4;
        fy = hipY + leg.len * 0.6;
      }
      // knee IK (knee bends forward for front legs)
      const dx = fx - hipX, dy = fy - hipY;
      const d = Math.min(Math.hypot(dx, dy), leg.len * 0.98);
      const a = Math.atan2(dy, dx);
      const l1 = leg.len * 0.5;
      const bend = Math.acos(clamp(d / (2 * l1), -1, 1)) * fdir * (leg.at < 0.45 ? -1 : 1);
      const kx = hipX + Math.cos(a - bend) * l1, ky = hipY + Math.sin(a - bend) * l1;
      const c1 = far ? leg.col[1] : leg.col[3], c2 = far ? leg.col[0] : leg.col[2];
      const th = Math.max(1, r * 0.4);
      buf.thickLine(hipX, hipY, kx, ky, th, c1);
      buf.thickLine(kx, ky, fx, fy, Math.max(0.7, th * 0.7), c2);
      // toes
      buf.set(fx + fdir, fy, c2);
      buf.set(fx + fdir * 2, fy, c2);
      buf.set(fx - fdir, fy, c2);
    };
    legs.forEach((lg, i) => drawLeg(lg, true, i));

    // dorsal fin (behind body)
    if (L.dorsalFin) {
      const F = L.dorsalFin;
      for (const smp of list) {
        if (smp.s < F.from || smp.s > F.to) continue;
        const r = this.radiusAt(smp.s);
        const dn: V = [-smp.t[1] * fdir, smp.t[0] * fdir];
        const env = Math.sin(((smp.s - F.from) / (F.to - F.from)) * Math.PI);
        const wave = Math.sin(smp.s * total * 0.25 - time * 6) * 0.25 + 0.85;
        const h = F.h * env * wave;
        for (let k = 0; k < h; k += 0.5) {
          const q: V = [smp.p[0] + dn[0] * (r + k), smp.p[1] + dn[1] * (r + k)];
          const ray = Math.floor(smp.s * total) % 4 === 0;
          buf.set(q[0], q[1], ray ? shade(F.col, -0.25) : k > h - 1.2 ? shade(F.col, 0.3) : withAlpha(F.col, 230));
        }
      }
    }

    // body sweep tail -> head so the head end is on top
    for (let i = list.length - 1; i >= 0; i--) {
      const smp = list[i];
      const u = smp.s;
      let r = this.radiusAt(u);
      if (st.swell) {
        const d = Math.abs(u - st.swell.at);
        if (d < 0.08) r *= 1 + st.swell.k * Math.cos((d / 0.08) * Math.PI * 0.5);
      }
      const rr = r * (1 - flat * 0.45);
      const dn: V = [-smp.t[1] * fdir, smp.t[0] * fdir]; // dorsal normal
      const sArc = u * total;
      for (let k = -rr; k <= rr; k += 0.5) {
        const v = k / rr; // +1 dorsal edge
        const x = smp.p[0] + dn[0] * k, y = smp.p[1] + dn[1] * k;
        const xi = Math.floor(x), yi = Math.floor(y);
        let light = v * 0.55 + 0.1 - flat * 0.1;
        light += (bayer(xi, yi) - 0.5) * 0.3;
        let c: C;
        if (v < -0.45 + flat * 0.2) c = v < -0.8 ? shade(L.belly, -0.3) : ((Math.floor(sArc) & 1) ? L.belly : shade(L.belly, -0.08));
        else {
          c = D[clamp(Math.round((light * 0.5 + 0.5) * (D.length - 1)), 0, D.length - 1)];
          const pc = this.patternAt(sArc, v, period, u, xi, yi);
          if (pc === 1) c = light > 0.3 ? shade(L.patternCol, 0.15) : L.patternCol;
          else if (pc === 2 && L.patternCol2) c = L.patternCol2;
          if (L.iridescent && v > 0.5 && ((Math.floor(sArc * 0.5) + Math.floor(time * 2)) % 7 === 0)) c = mix(c, hex('#a8f0ff'), 0.6);
        }
        if (L.scutes && v > 0.82 && Math.floor(sArc) % 3 === 0) {
          buf.set(x + dn[0] * 1.2, y + dn[1] * 1.2, D[1]);
        }
        buf.set(x, y, c);
      }
    }

    // near-side legs
    legs.forEach((lg, i) => drawLeg(lg, false, i));

    // gills & pectoral fins behind the head
    const h0 = list[0];
    if (!h0) return;
    const ht: V = [-h0.t[0], -h0.t[1]]; // forward direction (toward snout)
    const hd: V = [-h0.t[1] * fdir, h0.t[0] * fdir];
    const hr = this.look.radius * (this.look.head === 'slim' ? 1.05 : 0.95);
    if (L.pectoral) {
      const smp = list[Math.min(list.length - 1, Math.floor(list.length * 0.08))];
      const wave = Math.sin(time * 4) * 0.4;
      for (let k = 0; k < hr * 2.2; k += 0.5) {
        for (let w = -1; w <= 1; w += 0.5) {
          const a = 2.4 + wave;
          const dirx = Math.cos(a) * smp.t[0] * -1 + Math.sin(a) * hd[0] * -1;
          const diry = Math.cos(a) * smp.t[1] * -1 + Math.sin(a) * hd[1] * -1;
          buf.set(smp.p[0] + dirx * k + smp.t[0] * w * 2, smp.p[1] + diry * k + smp.t[1] * w * 2 + k * 0.2, (Math.floor(k) % 3 === 0) ? shade(L.pectoral, -0.3) : L.pectoral);
        }
      }
    }
    if (L.gills) {
      const smp = list[Math.min(list.length - 1, Math.floor(list.length * 0.03))];
      for (let g = 0; g < 3; g++) {
        const ang = -0.6 - g * 0.55 + Math.sin(time * 3 + g) * 0.15;
        const len = hr * (1.6 - g * 0.2);
        for (let k = 0; k < len; k += 0.5) {
          const dir: V = [smp.t[0] * Math.cos(ang) + hd[0] * -Math.sin(ang), smp.t[1] * Math.cos(ang) + hd[1] * -Math.sin(ang)];
          const px = smp.p[0] + hd[0] * hr * 0.7 + dir[0] * k, py = smp.p[1] + hd[1] * hr * 0.7 + dir[1] * k;
          buf.set(px, py, L.gills);
          if (Math.floor(k) % 2 === 0) {
            buf.set(px + dir[1], py - dir[0], shade(L.gills, 0.25));
            buf.set(px - dir[1], py + dir[0], shade(L.gills, -0.2));
          }
        }
      }
    }

    this.paintHead(buf, h0.p, ht, hd, hr, st, time);
    buf.outline(OUTLINE);

    // lure glow tip handled by caller; draw bright tip pixels
    if (L.lure) {
      const tip = list[list.length - 1];
      buf.disc(tip.p[0], tip.p[1], 1.6, L.lure);
    }
    if (st.submerge !== undefined) {
      const wy = Math.floor(st.submerge - oy);
      for (let y = Math.max(0, wy); y < buf.h; y++)
        for (let x = 0; x < buf.w; x++) {
          const c = buf.data[y * buf.w + x];
          if (c >>> 24) buf.data[y * buf.w + x] = y === wy ? shade(c, 0.35) : withAlpha(mix(c, hex('#1d4a55'), 0.55), y - wy < 3 ? 150 : 70);
        }
    }
  }

  private patternAt(s: number, v: number, period: number, u: number, x: number, y: number): number {
    const L = this.look;
    if (u < 0.04) return 0;
    const m = ((s % period) + period) % period;
    switch (L.pattern) {
      case 'bands': return m < period * 0.35 && v > -0.3 ? 1 : 0;
      case 'rings': return m < period * 0.3 ? 1 : m < period * 0.4 && L.patternCol2 ? 2 : 0;
      case 'diamonds': {
        const d = Math.abs(m - period / 2) / (period / 2) + Math.abs(v - 0.35) * 1.4;
        return d < 0.55 ? 1 : d < 0.72 && L.patternCol2 ? 2 : 0;
      }
      case 'stripe': return Math.abs(v - 0.1) < 0.18 ? 1 : v > 0.75 && L.patternCol2 ? 2 : 0;
      case 'blotch': {
        const cell = Math.floor(s / period);
        const off = ((cell * 7919) % 13) / 13;
        const d = Math.hypot((m - period * (0.3 + off * 0.4)) / (period * 0.32), (v - 0.25) / 0.55);
        return d < 0.75 ? 1 : d < 1 && L.patternCol2 ? 2 : 0;
      }
      case 'speckle': return ((x * 31 + y * 17) % 11 === 0) ? 1 : 0;
      default: return 0;
    }
  }

  private paintHead(buf: PixelBuffer, p: V, fwd: V, up: V, hr: number, st: SerpentState, time: number) {
    const L = this.look;
    const kind = L.head;
    const hl = L.headLen ?? hr * (kind === 'croc' ? 4.2 : kind === 'leviathan' ? 2.4 : kind === 'slim' ? 2.3 : 2.5);
    const jaw = st.jaw;
    const D = L.dorsal;
    const eyeC = L.eye ?? hex('#f2c14e');
    // bounding box
    const R = hl + hr * 2 + 4;
    const x0 = Math.floor(p[0] - R), x1 = Math.ceil(p[0] + R), y0 = Math.floor(p[1] - R), y1 = Math.ceil(p[1] + R);
    const hw = hr * (kind === 'blunt' ? 1.15 : kind === 'viper' || kind === 'raptor' ? 1.25 : kind === 'croc' ? 0.95 : 1.05);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5 - p[0], qy = y + 0.5 - p[1];
        const f = qx * fwd[0] + qy * fwd[1]; // forward
        const u = qx * up[0] + qy * up[1];   // up
        if (f < -hr * 0.6 || f > hl) continue;
        const t = clamp(f / hl, 0, 1);
        // head profile: wide at the back (jowls), tapering to snout
        let top = hw * (kind === 'croc' ? 1 - t * 0.45 : 1 - t * t * 0.55);
        let bot = -hw * (kind === 'croc' ? 0.8 - t * 0.35 : 0.85 - t * 0.4);
        const jawOpenAngle = jaw * (kind === 'croc' ? 0.35 : 0.55);
        // lower jaw rotates down from the hinge at f ~ 0.15hl
        const hinge = hl * 0.12;
        const inLower = u < 0 && f > hinge;
        let uu = u;
        if (inLower && jaw > 0) {
          uu = u + (f - hinge) * Math.tan(jawOpenAngle);
          if (uu > 0.2) continue;
        }
        const inUpper = u >= -0.2;
        let inside = false;
        if (inUpper && u <= top) inside = true;
        if (u < 0 && uu >= bot * (1 - jaw * 0.2)) inside = true;
        if (!inside) {
          // mouth interior between jaws
          if (jaw > 0.1 && u < 0 && f > hinge && u > bot - (f - hinge) * Math.tan(jawOpenAngle) && f < hl * 0.95) {
            buf.set(x, y, hex('#8a2c3a'));
            // fangs
            if ((kind === 'viper' || kind === 'raptor') && f > hl * 0.75 && f < hl * 0.85 && u > -1.5) buf.set(x, y, hex('#f4f0e8'));
            if (kind === 'croc' && Math.floor(f) % 3 === 0 && (u > -1.2 || Math.abs(uu) < 1)) buf.set(x, y, hex('#f4f0e8'));
          }
          continue;
        }
        let light = (u / Math.max(1, top)) * 0.6 + 0.15 + (bayer(x, y) - 0.5) * 0.3;
        let c = D[clamp(Math.round((light * 0.5 + 0.5) * (D.length - 1)), 0, D.length - 1)];
        if (u < -hw * 0.25) c = L.belly;
        // brow ridge / scales
        if (kind === 'croc' && u > top - 1.2 && Math.floor(f) % 3 === 0) c = D[1];
        if (kind === 'viper' && u > top - 1 && f < hl * 0.4) c = shade(c, -0.2);
        buf.set(x, y, c);
      }
    // eye
    const ef = hl * (kind === 'croc' ? 0.22 : 0.42), eu = hw * (kind === 'croc' ? 0.85 : 0.35);
    const ex = p[0] + fwd[0] * ef + up[0] * eu, ey = p[1] + fwd[1] * ef + up[1] * eu;
    if (st.blink) buf.set(ex, ey, shade(D[2], -0.3));
    else {
      buf.set(ex, ey, eyeC);
      buf.set(ex + fwd[0], ey + fwd[1], hex('#140c0a'));
      if (hr > 5) {
        buf.set(ex + up[0], ey + up[1], eyeC);
        buf.set(ex + fwd[0] + up[0], ey + fwd[1] + up[1], hex('#140c0a'));
        buf.set(ex - fwd[0], ey - fwd[1], eyeC);
      }
    }
    if (kind === 'croc') {
      // nostril bump
      const nx = p[0] + fwd[0] * hl * 0.95 + up[0] * hw * 0.55, ny = p[1] + fwd[1] * hl * 0.95 + up[1] * hw * 0.55;
      buf.set(nx, ny, D[1]);
    }
    // tongue
    if (st.tongue > 0.05 && kind !== 'croc' && kind !== 'leviathan') {
      const len = hr * 2.2 * st.tongue;
      const bx = p[0] + fwd[0] * hl, by = p[1] + fwd[1] * hl - up[1] * 0.5 - up[0] * 0;
      const wob = Math.sin(time * 40) * 0.6;
      for (let k = 0; k < len; k += 0.5) buf.set(bx + fwd[0] * k + up[0] * wob * (k / len), by + fwd[1] * k + up[1] * wob * (k / len), hex('#c7354a'));
      const tx = bx + fwd[0] * len, ty = by + fwd[1] * len;
      buf.set(tx + fwd[0] + up[0], ty + fwd[1] + up[1], hex('#c7354a'));
      buf.set(tx + fwd[0] - up[0], ty + fwd[1] - up[1], hex('#c7354a'));
    }
  }
}

/** Follow-the-leader spine update: head moves, body points trail at fixed spacing. */
export function followSpine(pts: [number, number][], spacing: number, stiff = 0) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (stiff > 0 && i > 1) {
      const pa = pts[i - 2];
      const ex = a[0] - pa[0], ey = a[1] - pa[1];
      const el = Math.hypot(ex, ey) || 1, d = Math.hypot(dx, dy) || 1;
      dx = dx * (1 - stiff) + (ex / el) * d * stiff;
      dy = dy * (1 - stiff) + (ey / el) * d * stiff;
    }
    const L = Math.hypot(dx, dy) || 1;
    b[0] = a[0] + (dx / L) * spacing;
    b[1] = a[1] + (dy / L) * spacing;
  }
}

/** Build a straight spine trailing behind the head. */
export function makeSpine(x: number, y: number, facing: number, length: number, spacing: number): [number, number][] {
  const n = Math.max(3, Math.ceil(length / spacing) + 1);
  return Array.from({ length: n }, (_, i) => [x - facing * i * spacing, y] as [number, number]);
}
