// V4 held props, sized for the small anime cast. PropP.t: 0/undefined = absolute ground position,
// 1 = front hand, 2 = back hand, 3 = between the hands. (x, y) offset in ground px, a = angle
// (ground space, 0 = forward, + = up), s = scale.

import type { PropP, P2 } from '../people-rig';
import type { Ctx } from '../people-parts';
import { hex, C } from '../color';
import { tones } from '../portrait/kit';
import { flat } from './body';

const P = {
  wood: tones('#8a5a34'), dark: tones('#3a3440'), steel: tones('#8a96a0'), red: tones('#c8402e'), white: tones('#eeeae4'),
  green: tones('#4a7a44'), paper: tones('#f0e6cc'), orange: tones('#e8762a'), blue: tones('#3a78c0'), noodle: tones('#e8c060'),
  fish: tones('#8ab4c8'), glow: tones('#ffb040'), rubber: tones('#3a3030'), yellow: tones('#e8c040'), rope: tones('#b89a64'),
  canvas: tones('#b8a47a'), pink: tones('#f472b0'),
};

export function drawAnimeProp(x: Ctx, p: PropP) {
  const { c, J } = x;
  const base: P2 = p.t === 1 ? J.wrF : p.t === 2 ? J.wrB : p.t === 3 ? [(J.wrF[0] + J.wrB[0]) / 2, (J.wrF[1] + J.wrB[1]) / 2] : [0, 0];
  const o: P2 = [base[0] + p.x, base[1] + p.y];
  const a = p.a ?? 0;
  const s = p.s ?? 1;
  const dir = (len: number, ang = a, from = o): P2 => [from[0] + Math.cos(ang) * len * s, from[1] + Math.sin(ang) * len * s];
  const Bp = (q: P2): P2 => c.B(q);
  const stick = (q0: P2, q1: P2, r0: number, r1: number, pal: C[], l = 0) => c.limb(Bp(q0), Bp(q1), r0 * s, r1 * s, sm => flat(pal, sm.l + l));
  /** axis-aligned-in-prop-space box: (u along a, v perpendicular) from o */
  const box = (u0: number, u1: number, v0: number, v1: number, fn: (u: number, v: number) => C | -1) => {
    const f: P2 = [Math.cos(a), -Math.sin(a)], up: P2 = [Math.cos(a + Math.PI / 2), -Math.sin(a + Math.PI / 2)];
    c.frame(Bp(o), f, up, [u0 * s - 1, u1 * s + 1, v0 * s - 1, v1 * s + 1], (lx, ly) => {
      const u = lx / s, v = ly / s;
      if (u < u0 || u > u1 || v < v0 || v > v1) return -1;
      return fn(u, v);
    });
  };
  const merge = (line = 0.35) => c.merge({ line, ao: 0.15 });
  switch (p.kind) {
    case 'camera': {
      // compact camera held up to the eye: body, big lens forward, flash strap
      box(-2.5, 3, -2, 2.4, (u, v) => (v > 1.6 ? P.dark[3] : u > 1.4 && Math.abs(v) < 1.3 ? (Math.hypot(u - 2.2, v) < 0.8 ? hex('#8ae0ff') : P.dark[0]) : P.dark[u < -1.5 ? 1 : 2]));
      box(3, 4.6, -1.4, 1.4, (u, v) => (Math.abs(v) < 0.6 ? hex('#5ab8e0') : P.dark[1]));
      merge();
      break;
    }
    case 'rod': {
      const tip = dir(22);
      stick(dir(-3), o, 0.9, 0.8, P.rubber);
      stick(o, tip, 0.55, 0.35, P.wood, 0.3);
      const reel = Bp(dir(1.5, a - Math.PI / 2 + 0.2));
      c.blob(reel[0], reel[1], 1.4 * s, 1.4 * s, sm => flat(P.steel, sm.l));
      merge(0.25);
      break;
    }
    case 'laptop': {
      // open laptop on the lap: silver base, lid tilted back toward the user (we see its back
      // with a fat-pug sticker) and the screen glow spilling onto the base
      box(-4.4, 4.4, -0.7, 0.5, (u, v) => (v > 0 ? P.steel[3] : P.steel[1]));
      const hinge = dir(-4.2);
      const lid = 1.95;
      const f: P2 = [Math.cos(a + lid), Math.sin(a + lid)];
      const q0 = Bp(hinge), q1 = Bp([hinge[0] + f[0] * 7.6 * s, hinge[1] + f[1] * 7.6 * s]);
      c.limb(q0, q1, 0.9 * s, 0.9 * s, sm => (sm.u > 0.4 && sm.u < 0.62 && sm.v < 0.2 ? P.yellow[2] : P.steel[sm.v < 0 ? 3 : 2]));
      merge(0.3);
      const g = Bp(dir(-2.6, a, [hinge[0] + f[0] * 3 * s + 0.8, hinge[1] + f[1] * 3 * s]));
      c.px(g[0], g[1], hex('#aef0ff'));
      c.merge({ line: 0 });
      break;
    }
    case 'cup': {
      // instant noodle cup: white with a red band, lid peeled back
      box(-1.8, 1.8, 0, 4.2, (u, v) => (v > 3.6 ? P.noodle[2] : v > 2 && v < 3 ? P.red[2] : P.white[u > 1 ? 1 : 2]));
      merge();
      break;
    }
    case 'chopsticks': {
      stick(o, dir(6), 0.35, 0.3, P.wood, 0.4);
      stick(dir(0.8, a + 1.6), dir(6, a + 0.12), 0.35, 0.3, P.wood, 0.2);
      merge(0.15);
      break;
    }
    case 'noodles': {
      // a dangling bite of noodles from the chopsticks
      const e = dir(6);
      stick(e, [e[0] - 0.4, e[1] - 3.4], 0.5, 0.4, P.noodle, 0.3);
      merge(0.1);
      break;
    }
    case 'kettle': {
      box(-2.8, 2.8, 0, 4.4, (u, v) => (v > 3.8 ? P.dark[2] : P.steel[u > 1.6 ? 1 : v > 3 ? 3 : 2]));
      stick(dir(2.6, a + 0.1), dir(5.2, a + 0.5), 0.7, 0.5, P.steel);
      merge();
      break;
    }
    case 'wrench': {
      stick(o, dir(6), 0.7, 0.7, P.steel, 0.2);
      const h = Bp(dir(6.8));
      c.blob(h[0], h[1], 1.5 * s, 1.5 * s, sm => (Math.hypot(sm.u - 0.4, sm.v) < 0.45 ? -1 : flat(P.steel, sm.l + 0.2)));
      merge();
      break;
    }
    case 'hammer': {
      stick(dir(-1), dir(6), 0.6, 0.6, P.wood);
      const h0 = dir(6), f: P2 = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
      stick([h0[0] - f[0] * 2 * s, h0[1] - f[1] * 2 * s], [h0[0] + f[0] * 2.2 * s, h0[1] + f[1] * 2.2 * s], 1.3, 1.1, P.steel);
      merge();
      break;
    }
    case 'notebook': {
      box(-1, 4, -2.5, 2.5, (u, v) => (u < -0.3 ? P.green[1] : v > 2 ? P.green[2] : P.paper[u > 3 ? 1 : 2]));
      merge();
      break;
    }
    case 'pen': {
      stick(o, dir(4), 0.35, 0.3, P.blue, 0.3);
      merge(0.1);
      break;
    }
    case 'magnifier': {
      stick(o, dir(3.5), 0.6, 0.6, P.wood);
      const g = Bp(dir(5.6));
      c.blob(g[0], g[1], 2.2 * s, 2.2 * s, sm => (Math.hypot(sm.u, sm.v) > 0.66 ? flat(P.steel, sm.l + 0.2) : hex(sm.u < 0 && sm.v < 0 ? '#e8faff' : '#9cd4e4')));
      merge();
      break;
    }
    case 'slingshot': {
      // Y frame, the band pulled back when p.t2 (via p.s sign) - stone glows (explosive mineral)
      const top = dir(4);
      stick(o, top, 0.6, 0.6, P.wood);
      const l = dir(2.4, a + 0.6, top), r = dir(2.4, a - 0.6, top);
      stick(top, l, 0.5, 0.5, P.wood);
      stick(top, r, 0.5, 0.5, P.wood);
      merge(0.25);
      break;
    }
    case 'stone': {
      const q = Bp(o);
      c.blob(q[0], q[1], 1.2, 1.2, sm => (sm.u < 0 && sm.v < 0 ? hex('#fff0a0') : hex('#ff8a2a')));
      merge(0.1);
      break;
    }
    case 'crate': {
      box(-5, 5, -4, 4, (u, v) => (Math.abs(u) > 4.2 || Math.abs(v) > 3.2 ? P.wood[1] : Math.abs(u - v * 1.2) < 0.7 ? P.wood[1] : P.wood[v > 2 ? 3 : 2]));
      merge();
      break;
    }
    case 'log': {
      const q0 = Bp(dir(-6)), q1 = Bp(dir(6));
      c.limb(q0, q1, 2 * s, 2 * s, sm => (sm.u > 0.97 || sm.u < 0.03 ? P.canvas[3] : flat(P.wood, sm.l)));
      merge();
      break;
    }
    case 'sticks': {
      for (let i = -1; i <= 1; i++) stick(dir(-5, a + i * 0.12), dir(5, a - i * 0.1), 0.7, 0.6, P.wood, i * 0.2);
      merge();
      break;
    }
    case 'phone': case 'tablet': {
      const w = p.kind === 'tablet' ? 3 : 1.6;
      box(-w, w, -1.4, 1.4, (u, v) => (Math.abs(u) < w - 0.6 && Math.abs(v) < 0.8 ? hex('#7ae8f0') : P.dark[1]));
      merge();
      break;
    }
    case 'bowl': {
      box(-2.6, 2.6, -1.6, 0.4, (u, v) => (v > -0.2 ? P.noodle[2] : P.white[u > 1.4 ? 1 : 2]));
      merge();
      break;
    }
    case 'spoon': case 'ladle': {
      stick(o, dir(p.kind === 'ladle' ? 6 : 4), 0.4, 0.4, P.steel, 0.3);
      const e = Bp(dir(p.kind === 'ladle' ? 6.6 : 4.4));
      c.blob(e[0], e[1], 1.1 * s, 0.8 * s, sm => flat(P.steel, sm.l + 0.3));
      merge(0.15);
      break;
    }
    case 'fish': {
      // silvery fish held by the tail, hanging down
      const f0 = o, f1 = dir(7, -Math.PI / 2 + 0.1);
      c.limb(Bp(f0), Bp(f1), 0.8 * s, 1.6 * s, sm => (sm.u > 0.85 && sm.v > 0.2 ? hex('#141418') : flat(P.fish, sm.l + (sm.v < -0.3 ? 0.4 : 0))));
      merge(0.3);
      break;
    }
    case 'can': {
      box(-1.4, 1.4, 0, 3, (u, v) => (v > 2.5 || v < 0.4 ? P.steel[2] : P.red[u > 0.8 ? 1 : 2]));
      merge();
      break;
    }
    case 'flashlight': {
      stick(o, dir(4), 0.8, 1, P.dark);
      const e = Bp(dir(4.4));
      c.blob(e[0], e[1], 0.8, 1, () => hex('#fff4c0'));
      merge(0.2);
      break;
    }
    case 'lights': {
      // a coil of string lights
      const q = Bp(o);
      c.blob(q[0], q[1], 3 * s, 2.4 * s, sm => {
        const r = Math.hypot(sm.u, sm.v);
        if (r < 0.45) return -1;
        return (Math.floor((Math.atan2(sm.v, sm.u) + 3.2) * 2.2) % 3 === 0) ? hex('#ffd860') : P.dark[2];
      });
      merge(0.2);
      break;
    }
    case 'rope': {
      const q = Bp(o);
      c.blob(q[0], q[1], 3 * s, 2.4 * s, sm => (Math.hypot(sm.u, sm.v) < 0.4 ? -1 : flat(P.rope, sm.l + ((Math.floor(Math.atan2(sm.v, sm.u) * 3) % 2) ? 0.3 : -0.2))));
      merge(0.2);
      break;
    }
    case 'sack': {
      box(-4, 4, -4, 4.5, (u, v) => (v > 3.4 && Math.abs(u) < 1.2 ? P.rope[2] : P.canvas[u > 2.4 ? 1 : v > 2 ? 3 : 2]));
      merge();
      break;
    }
    case 'wheel': {
      // ship's wheel rim segment in front of the hands
      const q = Bp(o);
      c.blob(q[0], q[1], 6 * s, 6 * s, sm => {
        const r = Math.hypot(sm.u, sm.v);
        if (r > 0.82) return flat(P.wood, sm.l);
        if (r < 0.2) return P.steel[2];
        const ang = Math.atan2(sm.v, sm.u);
        return Math.abs(Math.sin(ang * 3)) < 0.18 ? P.wood[1] : -1;
      });
      merge(0.25);
      break;
    }
    case 'bottle': {
      box(-1, 1, 0, 4.6, (u, v) => (v > 3.6 ? P.red[2] : hex(u > 0.3 ? '#4a8a9a' : '#7ac0cc')));
      merge();
      break;
    }
    case 'plank': {
      stick(dir(-7), dir(7), 1.2, 1.2, P.wood);
      merge();
      break;
    }
    case 'sleepingBag': {
      // quilted sleeping bag from the feet to the shoulders, head left out
      const a0 = Bp([o[0] - 22 * s, o[1] - 0.4 * s]), a1 = Bp([o[0] + 11 * s, o[1] + 0.6 * s]);
      c.limb(a0, a1, 4 * s, 4.6 * s, sm => {
        const q = sm.u * 7;
        if (q - Math.floor(q) < 0.12) return P.orange[0];
        return flat(P.orange, sm.v < -0.2 ? 0.7 : sm.v > 0.5 ? -0.6 : 0.1);
      });
      merge(0.3);
      // soft pillow-y lining at the opening
      const lip = Bp([o[0] + 11.4 * s, o[1] + 0.8 * s]);
      c.blob(lip[0], lip[1], 1.6 * s, 4.4 * s, () => P.canvas[3]);
      merge(0.25);
      break;
    }
    case 'pinkBag': {
      box(-2.6, 2.6, -2.4, 2.8, (u, v) => (v > 2 ? P.pink[1] : P.pink[u > 1.4 ? 1 : 2]));
      merge();
      break;
    }
  }
}
