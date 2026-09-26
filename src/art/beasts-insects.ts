// Small ecosystem insects (ambient life, prey and catchable samples), drawn with the beast sketch
// so they share the shading and outline style. All face right; anchor = body centre.

import { PixelBuffer } from './pixel';
import { Sk, V2, rmp } from './beasts-core';
import { hex, withAlpha } from './color';

export const INSECT_INFO: Record<string, { frames: number; fps: number; glow?: [number, number, number] }> = {
  lanternbeetle: { frames: 2, fps: 10, glow: [0.55, 1, 0.6] },
  skymoth: { frames: 4, fps: 10 },
  dragonfly: { frames: 2, fps: 24 },
  weta: { frames: 2, fps: 3 },
  mantis: { frames: 2, fps: 2 },
  cicada: { frames: 2, fps: 12 },
  bee: { frames: 2, fps: 24 },
  butterfly: { frames: 4, fps: 8 },
  ant: { frames: 2, fps: 8 },
  firefly: { frames: 2, fps: 6, glow: [1, 0.9, 0.4] },
};

type Draw = (sk: Sk, f: number) => void;

const wing = (sk: Sk, base: V2, a: number, L: number, w: number, m: number, z: number) => {
  sk.np();
  sk.blade(base[0], base[1], base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L, s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * w + 0.3, m, { z0: z, z1: z });
};
const legs = (sk: Sk, x0: number, n: number, dx: number, len: number, m: number, f: number) => {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx, sw = (f + i) % 2 ? 0.6 : -0.6;
    sk.line(x, 0.5, x + sw - 0.4, len, m, 0.3, -1, true);
  }
};

const D: Record<string, Draw> = {
  lanternbeetle(sk, f) {
    const shell = sk.m(rmp('#2a4a3a', { n: 5, dark: 0.6 }), { spec: 0.6 });
    const glow = sk.m(rmp('#b8ffb0', { n: 3, dark: 0.2, light: 0.7 }), { noRim: true, edge: 0 });
    const leg = sk.m(rmp('#1a2420', { n: 3 }));
    if (f) { wing(sk, [0, -1.5], -2.3, 4, 1.4, sk.m(rmp('#c8e0e0', { n: 3, dark: 0.2 }), { k: 0.4 }), -2); }
    sk.np(); sk.ell(-1.5, 0, 2.4, 1.6, glow, { z: 0 });
    sk.np(); sk.ell(0.6, -0.4, 2.2, 1.7, shell, { z: 1 });
    sk.np(); sk.ell(2.8, 0, 1, 0.9, shell, { z: 2 });
    legs(sk, -0.5, 3, 1.2, 1.8, leg, f);
  },
  skymoth(sk, f) {
    const w1 = sk.m(rmp('#a89878', { n: 5, dark: 0.55 })), w2 = sk.m(rmp('#6a5a48', { n: 4, dark: 0.5 }));
    const eye = sk.m(rmp('#5a88c8', { n: 3, dark: 0.4 }), { edge: 0 });
    const body = sk.m(rmp('#8a7658', { n: 4, dark: 0.55 }));
    const a = [-2.4, -1.7, -0.9, -1.7][f];
    const wf = (p: { t: number; v: number }) => (Math.abs(p.t - 0.55) < 0.12 && Math.abs(p.v) < 0.4 ? eye : p.t > 0.8 ? w2 : w1);
    sk.np(); sk.blade(0, -0.5, Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.6 + 0.3, wf, { z0: -2, z1: -2 });
    sk.np(); sk.ell(0, 0, 3, 1.2, body, { z: 0 });
    sk.np(); sk.blade(0, -0.5, Math.cos(a) * 6.5, Math.sin(a) * 6.5 + 1, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.8 + 0.3, wf, { z0: 3, z1: 3 });
    sk.over(3, -1, hex('#d8c8a0')); sk.over(4, -2, hex('#d8c8a0'));
  },
  dragonfly(sk, f) {
    const body = sk.m(rmp('#2ab0a0', { n: 5, dark: 0.55 }), { spec: 0.5 });
    const wm = sk.m(rmp('#dff4ff', { n: 3, dark: 0.15, light: 0.5 }), { k: 0.3, edge: 0 });
    const eye = sk.m(rmp('#3a6ad0', { n: 4, dark: 0.5 }), { spec: 0.6 });
    const up = f ? -0.5 : 0.35;
    for (const [x, s] of [[0.5, 1], [-1.5, 0.9]] as const) wing(sk, [x, -0.8], -Math.PI / 2 + up + (x < 0 ? -0.35 : 0.1), 6 * s, 1.1, wm, -1);
    sk.np(); sk.tube([[-9, 0.4], [-4, 0.2], [1, 0]], t => 0.55 + t * 0.6, (p) => (p.t * 8 % 1 < 0.2 ? body : body), { z: 0 });
    sk.np(); sk.ell(1.5, 0, 1.8, 1.3, body, { z: 1 });
    sk.np(); sk.ell(3.4, -0.3, 1.2, 1.2, eye, { z: 2 });
    for (const [x, s] of [[0.8, 1], [-1.2, 0.9]] as const) wing(sk, [x, -0.6], -Math.PI / 2 + up + 0.15 + (x < 0 ? -0.4 : 0), 6.5 * s, 1.2, wm, 4);
  },
  weta(sk, f) {
    const ch = sk.m(rmp('#7a4a2a', { n: 5, dark: 0.6 }), { spec: 0.4 }), bd = sk.m(rmp('#b07848', { n: 5, dark: 0.55 }));
    const leg = sk.m(rmp('#6a3e22', { n: 4 }));
    // big spiny hind legs
    sk.np(); sk.tube([[-2, -1], [-5, -4 + f * 0.5], [-8, 0]], 0.6, leg, { z: -2 });
    sk.np();
    for (let i = 0; i < 4; i++) sk.ell(-3.2 + i * 1.8, -0.3, 1.4, 1.5 - i * 0.05, (p) => (p.v < 0 ? ch : bd), { z: i * 0.2 });
    sk.np(); sk.ell(4, 0, 1.6, 1.4, ch, { z: 2 });
    sk.line(5, -1, 12, -5 - f, leg, 0.4, 3, true); sk.line(5, -1, 11, -2 + f, leg, 0.4, 3, true);
    legs(sk, -0.5, 3, 1.6, 2.2, leg, f);
    sk.np(); sk.tube([[-2, -0.5], [-5.5, -3.5 + f * 0.5], [-8.5, 0.5]], 0.75, leg, { z: 4 });
  },
  mantis(sk, f) {
    const g = sk.m(rmp('#6ab040', { n: 5, dark: 0.55 })), g2 = sk.m(rmp('#98d060', { n: 4, dark: 0.45 }));
    sk.np(); sk.ell(-3, 0, 4, 1.4, g, { z: 0, rot: -0.1 });
    sk.np(); sk.tube([[1, -0.3], [3, -3], [3.6, -5.5]], 0.7, g2, { z: 1 });
    sk.np(); sk.ell(4, -6.5, 1.3, 1.1, g2, { z: 2 });
    // raptorial forelegs, folded in prayer; frame 1 sways
    sk.np(); sk.tube([[3, -3.5], [5 + f * 0.3, -2], [4.2, -4.4]], 0.55, g2, { z: 3 });
    legs(sk, -4, 2, 2.2, 3, g, 0);
    sk.over(4.5, -7, hex('#203010'));
  },
  cicada(sk, f) {
    const b = sk.m(rmp('#4a5a3a', { n: 5, dark: 0.6 })), wm = sk.m(rmp('#e8f0e0', { n: 3, dark: 0.2 }), { k: 0.35, edge: 1 });
    sk.np(); sk.ell(0, 0, 3.2, 1.8, b, { z: 0 });
    sk.np(); sk.ell(3, -0.2, 1.3, 1.5, b, { z: 1 });
    sk.over(3.6, -1, hex('#c83020'));
    wing(sk, [1, -1], Math.PI - 0.2 - f * 0.08, 6, 1.4, wm, 3);
  },
  bee(sk, f) {
    const y = sk.m(rmp('#f0b820', { n: 4, dark: 0.5 })), k = sk.m(rmp('#2a2018', { n: 3 }));
    const wm = sk.m(rmp('#f4faff', { n: 3, dark: 0.1 }), { k: 0.3, edge: 0 });
    wing(sk, [0, -1], f ? -2.2 : -1.2, 3, 1, wm, -1);
    sk.np(); sk.ell(-0.6, 0, 2, 1.4, (p) => ((p.u + 1) * 2 % 1 < 0.45 ? k : y), { z: 0 });
    sk.np(); sk.ell(1.8, -0.2, 1, 1, k, { z: 1 });
    wing(sk, [0.2, -1], f ? -2 : -1, 3.2, 1, wm, 3);
  },
  butterfly(sk, f) {
    const wA = sk.m(rmp('#3a7ae0', { n: 5, dark: 0.55, light: 0.5 })), wB = sk.m(rmp('#141820', { n: 3 })), sp = sk.m(rmp('#f4f0e0', { n: 3, dark: 0.2 }), { edge: 0 });
    const body = sk.m(rmp('#20202a', { n: 3 }));
    const a = [-2.8, -2, -1.2, -2][f];
    const wf = (p: { t: number; v: number }) => (p.t > 0.78 ? (Math.abs(p.v) < 0.3 ? sp : wB) : wA);
    sk.np(); sk.blade(0, -0.4, Math.cos(a - 0.35) * 5.5, Math.sin(a - 0.35) * 5.5, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.6 + 0.4, wf, { z0: -2, z1: -2 });
    sk.np(); sk.ell(0, 0, 2.2, 0.8, body, { z: 0 });
    sk.np(); sk.blade(0, -0.4, Math.cos(a) * 6, Math.sin(a) * 6 + 0.5, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.9 + 0.4, wf, { z0: 3, z1: 3 });
    sk.np(); sk.blade(-0.5, 0.2, -2.5, 3.2 - f * 0.3, s => (1 - s) * 1.6 + 0.4, wA, { z0: 2.5, z1: 2.5 });
  },
  ant(sk, f) {
    const a = sk.m(rmp('#6a2a1a', { n: 4, dark: 0.55 }), { spec: 0.4 });
    sk.np(); sk.ell(-2, -0.8, 1.4, 1.1, a, { z: 0 });
    sk.np(); sk.ell(0, -0.8, 0.8, 0.6, a, { z: 1 });
    sk.np(); sk.ell(1.6, -1, 0.9, 0.8, a, { z: 2 });
    legs(sk, -0.8, 3, 0.8, 0.4, a, f);
  },
  firefly(sk, f) {
    const b = sk.m(rmp('#3a3228', { n: 3 })), g = sk.m(rmp('#fff0a0', { n: 3, dark: 0.15, light: 0.8 }), { noRim: true, edge: 0 });
    sk.np(); sk.ell(-0.8, 0, 1.3, 1, f ? g : sk.m(rmp('#a8a060', { n: 3 })), { z: 0 });
    sk.np(); sk.ell(0.9, -0.2, 1, 0.8, b, { z: 1 });
  },
};

function glowFor(buf: PixelBuffer, ax: number, ay: number, c: [number, number, number], r: number): PixelBuffer {
  const w = r * 2 + 1, g = new PixelBuffer(w, w);
  const col = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d > 1) continue;
      const a = Math.round((1 - d) * (1 - d) * 180);
      g.set(x, y, withAlpha((col[0] | (col[1] << 8) | (col[2] << 16)) >>> 0, a));
    }
  void buf; void ax; void ay;
  return g;
}

const cache = new Map<string, { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }>();
export function renderInsect(kind: string, frame: number): { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer } {
  const info = INSECT_INFO[kind];
  if (!info || !D[kind]) throw new Error('unknown insect ' + kind);
  const f = ((frame % info.frames) + info.frames) % info.frames;
  const key = kind + f;
  const hit = cache.get(key);
  if (hit) return hit;
  const sk = new Sk(32, 24, 16, 14);
  D[kind](sk, f);
  const full = sk.resolve();
  const t = full.trim(1);
  const out = { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy, glow: info.glow ? glowFor(t.buf, 0, 0, info.glow, 7) : undefined };
  cache.set(key, out);
  return out;
}
