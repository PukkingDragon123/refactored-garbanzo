// V2 people: held items and props attached to poses.
// PropP.t chooses the attachment: undefined/0 = absolute ground position, 1 = front hand,
// 2 = back hand, 3 = between both hands. (x, y) is an offset in ground space, a an angle
// (ground space, 0 = forward, + = up).

import { PropP, P2, tone, rampOf, at } from './people-rig';
import { Ctx } from './people-parts';

const R = {
  wood: rampOf('#2a170c', '#4a2c16', '#6d4424', '#8f5d33', '#b07b46', '#cf9c62'),
  darkWood: rampOf('#1c100a', '#35200f', '#50311a', '#6b4526', '#875c35'),
  steel: rampOf('#1c2126', '#2f373e', '#4a555c', '#6d7a80', '#9aa6a8', '#d4dcda'),
  glass: rampOf('#1e3440', '#35586a', '#5c8698', '#9cc4cf', '#dcf2f4'),
  canvas: rampOf('#3d3524', '#5f5338', '#83744f', '#a79668', '#c9b98a'),
  paper: rampOf('#6a5d45', '#958566', '#bfae88', '#e0d2ae', '#f6ecd0'),
  leather: rampOf('#24140c', '#3e2414', '#5c371f', '#7d4d2c', '#a0673c'),
  plastic: rampOf('#131618', '#23282b', '#363d41', '#4e585c', '#6f7b7e'),
  red: rampOf('#3a0e10', '#6a1a18', '#9a2a22', '#c4402e', '#e2653f'),
  bone: rampOf('#6e6250', '#9a8c72', '#c2b495', '#e2d6b8', '#f6eed8'),
  stew: rampOf('#4a220e', '#7a3a14', '#a8561c', '#cf7a2c'),
  rope: rampOf('#3b2f1d', '#5a4a2e', '#7a6641', '#9a8456', '#b8a270'),
  net: rampOf('#8a8a7a', '#b8b8a4', '#e0e0cc'),
  green: rampOf('#16301f', '#24492f', '#356440', '#4c8252'),
};

export function drawProp(x: Ctx, p: PropP) {
  const { c, J } = x;
  const base: P2 = p.t === 1 ? J.wrF : p.t === 2 ? J.wrB : p.t === 3 ? [(J.wrF[0] + J.wrB[0]) / 2, (J.wrF[1] + J.wrB[1]) / 2] : [0, 0];
  const o: P2 = [base[0] + p.x, base[1] + p.y];
  const a = p.a ?? 0;
  const s = p.s ?? 1;
  const dir = (len: number, ang = a): P2 => [o[0] + Math.cos(ang) * len * s, o[1] + Math.sin(ang) * len * s];
  const off = (q: P2, len: number, ang: number): P2 => [q[0] + Math.cos(ang) * len * s, q[1] + Math.sin(ang) * len * s];
  const B = (q: P2): P2 => c.B(q);
  const stick = (q0: P2, q1: P2, r0: number, r1: number, ramp: typeof R.wood, bias = 0) =>
    c.limb(B(q0), B(q1), r0 * s, r1 * s, sm => tone(ramp, sm.l, bias, 1.1));
  const merge = (line = 0.35, ao = 0.2) => c.merge({ line, ao });
  switch (p.kind) {
    case 'knife': {
      stick(o, dir(2.5), 0.9, 0.9, R.darkWood);
      stick(dir(2.5), dir(7), 0.8, 0.35, R.steel, 0.3);
      merge();
      break;
    }
    case 'trowel': {
      stick(off(o, 3, a + Math.PI), o, 0.9, 0.9, R.wood);
      const t0 = dir(0.5), t1 = dir(6.5);
      const n: P2 = [-Math.sin(a) * 2 * s, Math.cos(a) * 2 * s];
      const pts = [B([t0[0] + n[0], t0[1] + n[1]]), B([t0[0] - n[0], t0[1] - n[1]]), B(t1)];
      c.poly(pts.flat(), sm => tone(R.steel, sm.l + 0.2, 0.1));
      merge();
      break;
    }
    case 'net': {
      const end = dir(17);
      stick(off(o, 3, a + Math.PI), end, 0.7, 0.6, R.wood);
      merge(0.3, 0.1);
      const hoop = off(end, 4.5, a);
      const hb = B(hoop);
      c.blob(hb[0], hb[1], 5 * s, 4 * s, sm => {
        const r = Math.hypot(sm.u, sm.v);
        if (r > 0.8) return at(R.darkWood, 2);
        return ((Math.floor((sm.u + 1) * 5) + Math.floor((sm.v + 1) * 5)) % 2 === 0) ? at(R.net, 1) : -1;
      }, -a);
      merge(0.2, 0);
      break;
    }
    case 'tweezers': {
      stick(o, dir(6), 0.45, 0.3, R.steel, 0.4);
      merge(0.2, 0.05);
      break;
    }
    case 'magnifier': {
      stick(o, dir(4), 0.8, 0.8, R.darkWood);
      const g = B(dir(7));
      c.blob(g[0], g[1], 3 * s, 3 * s, sm => (Math.hypot(sm.u, sm.v) > 0.72 ? tone(R.steel, sm.l, 0.2) : tone(R.glass, sm.l + 0.4, 0.2)));
      merge(0.3, 0.1);
      break;
    }
    case 'jar': {
      const q = B([o[0] + 1, o[1] + 3]);
      c.limb([q[0], q[1] - 3], [q[0], q[1] + 3], 3 * s, 3 * s, sm => (sm.v > 0.5 ? at(R.glass, 4) : tone(R.glass, sm.l + 0.2, 0.25)), false, false);
      merge(0.3, 0.1);
      break;
    }
    case 'lid': {
      const q = B(o);
      c.rect(q[0] - 3, q[1] - 1, 6, 2, at(R.steel, 3));
      merge(0.3, 0);
      break;
    }
    case 'hammer': {
      const head = dir(8);
      stick(o, head, 0.8, 0.8, R.wood);
      merge(0.3, 0.1);
      const n: P2 = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
      stick([head[0] - n[0] * 2.4, head[1] - n[1] * 2.4], [head[0] + n[0] * 2.4, head[1] + n[1] * 2.4], 1.6, 1.3, R.steel, 0.1);
      merge();
      break;
    }
    case 'peg': {
      stick(o, [o[0], o[1] + 4], 0.8, 0.8, R.wood, 0.2);
      merge(0.3, 0.1);
      break;
    }
    case 'crate': {
      const q = B([o[0] + 3, o[1] - 1]);
      const w = 17 * s, h = 12 * s;
      c.rect(q[0] - w / 2, q[1] - h / 2, w, h, at(R.wood, 3));
      for (let yy = 0; yy < h; yy += 4) c.rect(q[0] - w / 2, q[1] - h / 2 + yy, w, 1, at(R.wood, 1));
      c.rect(q[0] - w / 2, q[1] - h / 2, 2, h, at(R.wood, 4));
      c.rect(q[0] + w / 2 - 2, q[1] - h / 2, 2, h, at(R.wood, 2));
      c.rect(q[0] - w / 2, q[1] - h / 2, w, 1, at(R.wood, 5));
      merge(0.4, 0.3);
      break;
    }
    case 'cameraUp': {
      const q = B([o[0] + 1, o[1] + 1]);
      c.rect(q[0] - 4, q[1] - 3, 7, 5, at(R.plastic, 2));
      c.rect(q[0] - 4, q[1] - 3, 7, 1, at(R.plastic, 4));
      c.rect(q[0] - 2, q[1] - 4, 3, 1, at(R.plastic, 3));
      c.limb([q[0] + 3, q[1] - 0.5], [q[0] + 7, q[1] - 0.5], 2.2, 2.2, sm => (sm.u > 0.85 ? at(R.glass, 2) : tone(R.plastic, sm.l, 0.2)), false, false);
      merge(0.4, 0.25);
      break;
    }
    case 'notebook': {
      const q = B(o);
      c.rect(q[0] - 1, q[1] - 5, 7, 6, at(R.paper, 4));
      c.rect(q[0] - 1, q[1] - 5, 1, 6, at(R.leather, 3));
      for (let i = 0; i < 3; i++) c.rect(q[0] + 1, q[1] - 4 + i * 2, 4, 1, at(R.paper, 2));
      merge(0.3, 0.2);
      break;
    }
    case 'pen': {
      stick(o, dir(4.5), 0.45, 0.35, R.red);
      merge(0.2, 0.05);
      break;
    }
    case 'phone': {
      const q = B(o);
      c.rect(q[0] - 1, q[1] - 6, 4, 7, at(R.plastic, 1));
      c.rect(q[0], q[1] - 5, 2, 5, at(R.glass, 3));
      merge(0.3, 0.15);
      break;
    }
    case 'map': {
      const q = B([o[0] + 1, o[1] + 2]);
      const w = 15 * s, h = 10 * s;
      c.rect(q[0] - w / 2, q[1] - h / 2, w, h, at(R.paper, 3));
      c.rect(q[0] - w / 2, q[1] - h / 2, w, 1, at(R.paper, 4));
      c.rect(q[0] - 1, q[1] - h / 2, 1, h, at(R.paper, 1));
      c.px(q[0] - 4, q[1] - 1, at(R.red, 3));
      c.px(q[0] + 3, q[1] + 1, at(R.green, 2));
      c.px(q[0] + 4, q[1] + 1, at(R.green, 2));
      merge(0.35, 0.2);
      break;
    }
    case 'taiaha':
    case 'taiahaBack': {
      let q0: P2, q1: P2;
      if (p.kind === 'taiahaBack') { const h = J.hip, n = J.neckTop, u = J.up, f = J.fwd; q0 = [h[0] + f[0] * 7 - u[0] * 12, h[1] + f[1] * 7 - u[1] * 12]; q1 = [n[0] - f[0] * 13 + u[0] * 8, n[1] - f[1] * 13 + u[1] * 8]; }
      else if (p.t === 3) { const len = 34; q0 = off(o, len * 0.45, a + Math.PI); q1 = off(o, len * 1.0, a); }
      else { q0 = o; q1 = dir(76); }
      // shaft
      stick(q0, q1, 1.05, 0.85, R.darkWood, 0.1);
      merge(0.35, 0.15);
      // broad blade (rau) at the base end
      const bd: P2 = [q1[0] - q0[0], q1[1] - q0[1]];
      const L = Math.hypot(bd[0], bd[1]) || 1;
      const u: P2 = [bd[0] / L, bd[1] / L];
      const n: P2 = [-u[1], u[0]];
      const b0: P2 = [q0[0] + u[0] * 2, q0[1] + u[1] * 2];
      const b1: P2 = [q0[0] + u[0] * 11, q0[1] + u[1] * 11];
      c.poly([B([b0[0] + n[0] * 1.8, b0[1] + n[1] * 1.8]), B([b1[0] + n[0] * 1.1, b1[1] + n[1] * 1.1]), B([b1[0] - n[0] * 1.1, b1[1] - n[1] * 1.1]), B([b0[0] - n[0] * 1.8, b0[1] - n[1] * 1.8])].flat(), sm => tone(R.wood, sm.l + 0.2, 0.1));
      merge(0.3, 0.1);
      // carved head (upoko) and red tuft (awe) near the top
      const h0: P2 = [q1[0] - u[0] * 3, q1[1] - u[1] * 3];
      stick(h0, q1, 1.4, 0.9, R.wood, 0.25);
      merge(0.35, 0.1);
      const tuft: P2 = [q1[0] - u[0] * 7, q1[1] - u[1] * 7];
      const tb = B(tuft);
      c.blob(tb[0], tb[1], 1.9, 2.6, sm => tone(R.red, sm.l, 0.1));
      const fb = B([tuft[0] - u[0] * 2.5 + n[0] * 1.5, tuft[1] - u[1] * 2.5 + n[1] * 1.5]);
      c.blob(fb[0], fb[1], 1.2, 2, sm => tone(R.bone, sm.l, 0.2));
      merge(0.3, 0.1);
      break;
    }
    case 'firestick': {
      stick(o, dir(11), 0.7, 0.6, R.wood);
      merge(0.3, 0.1);
      const q = B(o);
      c.rect(q[0] - 4, q[1] - 1, 8, 2, at(R.darkWood, 2));
      merge(0.3, 0.1);
      break;
    }
    case 'ladle': {
      const bowl = dir(9);
      stick(o, bowl, 0.6, 0.6, R.steel, 0.2);
      merge(0.25, 0.1);
      const qb = B(bowl);
      c.blob(qb[0], qb[1], 2.2 * s, 1.6 * s, sm => tone(R.steel, sm.l + 0.1, 0.1));
      merge(0.3, 0.1);
      break;
    }
    case 'bowl': {
      const q = B([o[0] + 1, o[1] + 1.5]);
      c.blob(q[0], q[1], 4.5 * s, 2.6 * s, sm => (sm.v < -0.3 ? at(R.stew, 2 + (sm.u > 0 ? 1 : 0)) : tone(R.canvas, sm.l, 0.2)));
      merge(0.35, 0.2);
      c.px(q[0] - 1, q[1] - 5, at(R.paper, 4));
      c.px(q[0] + 1, q[1] - 7, at(R.paper, 3));
      merge(0, 0);
      break;
    }
    case 'spoon': {
      stick(o, dir(4.5), 0.45, 0.8, R.steel, 0.3);
      merge(0.2, 0.05);
      break;
    }
    case 'wrench': {
      const e = dir(7.5);
      stick(o, e, 0.75, 0.75, R.steel, 0.15);
      merge(0.3, 0.1);
      const qe = B(e);
      c.blob(qe[0], qe[1], 1.8, 1.8, sm => (Math.hypot(sm.u - 0.4, sm.v) < 0.45 ? -1 : tone(R.steel, sm.l, 0.2)));
      merge(0.3, 0.1);
      break;
    }
    case 'gadget': {
      const q = B(o);
      c.rect(q[0] - 3, q[1] - 4, 7, 4, at(R.plastic, 2));
      c.rect(q[0] - 3, q[1] - 4, 7, 1, at(R.plastic, 4));
      c.px(q[0] + 2, q[1] - 3, at(R.red, 4));
      c.line(q[0] - 2, q[1] - 5, q[0] - 3, q[1] - 9, at(R.steel, 3));
      merge(0.35, 0.2);
      break;
    }
    case 'rope': {
      const e = dir(34);
      stick(o, e, 0.7, 0.7, R.rope);
      merge(0.25, 0.05);
      break;
    }
  }
}
