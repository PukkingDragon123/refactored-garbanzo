// V9 island collectibles and harvestables: shells, sea glass, kelp, flint, clay, coastal plants,
// berries, pipi and the island insects.

import { Pen, RAMP, H, rp, hash, alpha, tone, IconSet, Pt } from './pen';
import { frame, ring, halo, sparkle, curve, bez } from './parts';

export const ISLAND: IconSet = {};

const GOLD = rp('#3e1a06', '#7a3a0c', '#b86a16', '#e8a030', '#fad26a', '#fff6cc');
const NACRE = rp('#4a3a4a', '#7a6a7e', '#aa9cae', '#d4cad4', '#f0eaf0', '#ffffff');

// ================================================================ shells
ISLAND.shell_sunwhorl = {
  draw: p => {
    // a golden turban shell: stacked whorls spiralling to a point, pearly mouth at the lower left
    const f = frame(8.4, 17.6, 19.6, 3); // aperture -> apex
    const whorl = p.maskFn((x, y) => {
      const [u, v] = f.loc(x, y);
      const t = u / f.len;
      if (t < -0.36 || t > 1) return false;
      const w = t < 0 ? 8.2 * Math.sqrt(1 - (t / 0.36) ** 2) : 8.2 * (1 - t) ** 0.95 + 0.4;
      return Math.abs(v) <= w;
    });
    p.puff(whorl, GOLD, { r: 4.5, spec: 0.95 });
    // spiral sutures and fine growth ridges
    p.fill(whorl, (x, y) => {
      const [u, v] = f.loc(x, y);
      const k = u + v * 0.42;
      const s = (((k / 3.1) % 1) + 1) % 1;
      if (u > -1 && s < 0.2) return GOLD[1];
      if (u > -1 && s < 0.36) return tone(p.get(x, y), 0.3);
      return (x * 2 + y) % 4 === 0 && u > 0 ? tone(p.get(x, y), -0.15) : -1;
    });
    // the pearly aperture
    const [ax, ay] = f.at(-0.6, 2.6);
    const ap = p.maskEllipse(ax, ay, 3.4, 4.2, 0.5);
    p.fill(ap, (x, y) => { const d = Math.hypot(x + 0.5 - ax, y + 0.5 - ay); return d < 1.8 ? H('#6a3a1a') : d < 2.9 ? NACRE[4] : NACRE[3]; });
    p.px(Math.floor(ax) - 1, Math.floor(ay) - 2, H('#ffffff'));
  },
  post: p => { sparkle(p, 20, 7, '#fff6cc'); },
};

ISLAND.shell_fan = {
  draw: p => {
    const Pk = RAMP.pink;
    // a deeply ribbed pink scallop: ribs fanning from the hinge, scalloped rim, two little ears
    const hx = 12, hy = 20.6;
    const fan = p.maskFn((x, y) => {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
      const a = Math.atan2(dx, -dy);
      const r = Math.hypot(dx, dy);
      if (Math.abs(a) > 0.98) return false;
      const edge = 15.6 - Math.abs(Math.sin(a * 6)) * 1.1 - a * a * 2.2;
      return r <= edge && r > 1;
    });
    p.fill(fan, (x, y) => {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
      const a = Math.atan2(dx, -dy);
      const r = Math.hypot(dx, dy);
      const rib = Math.cos(a * 12);
      const lit = -dx * 0.05 - dy * 0.02;
      let i = 2.6 + rib * 1.2 + lit + (r > 12 ? 0.5 : 0);
      if (Math.floor(r / 3.2) % 2 === 1 && rib < 0.2) i -= 0.6;
      return Pk[Math.max(0, Math.min(4, Math.round(i)))];
    });
    p.slab(p.maskPoly([6.5, 21.5, 9, 18, 12, 20, 12, 22.5]), Pk, 3);
    p.slab(p.maskPoly([17.5, 21.5, 15, 18, 12, 20, 12, 22.5]), Pk, 2);
    p.pts([[8, 7], [9, 6]], H('#fff6f0'));
  },
};

ISLAND.shell_cone = {
  draw: p => {
    const Cn = rp('#4a2410', '#8a4a1e', '#c47c38', '#e8aa62', '#f8d49a', '#fff4dc');
    const Tg = rp('#140806', '#2e120a', '#4a1e10', '#6a2e18', '#8a4220', '#a85a2c');
    // a cone shell lying diagonally: low spire at the shoulder, tapering to the base, tiger bands
    const f = frame(20.6, 3.4, 4, 20); // spire -> tip
    const cone = p.maskFn((x, y) => {
      const [u, v] = f.loc(x, y);
      const t = u / f.len;
      if (t < 0 || t > 1) return false;
      const w = t < 0.16 ? 1.6 + t / 0.16 * 5.4 : 7 * (1 - (t - 0.16) / 0.84) ** 1.05 + 0.5;
      return Math.abs(v) <= w;
    });
    p.puff(cone, Cn, { r: 4, spec: 0.93 });
    p.fill(cone, (x, y) => {
      const [u, v] = f.loc(x, y);
      const band = Math.sin(u * 1.25 + Math.sin(v * 1.6) * 1.2);
      if (u < 3.4 && u > 2.4) return Cn[4];
      if (band > 0.2 && u > 3.2) return Tg[Math.max(0, Math.min(5, Cn.indexOf(p.get(x, y)) - 1))] ?? Tg[2];
      return -1;
    });
    const [sx, sy] = f.at(0.8, 0);
    p.px(sx, sy, Cn[5]);
  },
};

ISLAND.shell_opal = {
  draw: p => {
    // an ear-shaped paua shell seen from inside: blue-green fire, dark rim, a row of breathing holes
    const f = frame(4, 18, 20, 5);
    const ear = p.maskFn((x, y) => {
      const [u, v] = f.loc(x, y);
      const t = u / f.len;
      if (t < -0.05 || t > 1.08) return false;
      const w = Math.sin(Math.PI * Math.min(1, (t + 0.05) / 1.13)) ** 0.6 * 7.6;
      return v >= -w * 0.85 && v <= w;
    });
    p.fill(ear, (x, y) => {
      const [u, v] = f.loc(x, y);
      const t = u / f.len;
      const w = Math.sin(Math.PI * Math.min(1, (t + 0.05) / 1.13)) ** 0.6 * 7.6;
      if (v < -w * 0.85 + 1.3 || v > w - 1.2) return v < 0 ? H('#3a3440') : H('#1e1a24');
      const sw = Math.sin(u * 0.9 + v * 0.7) + Math.sin(u * 0.4 - v * 1.1) * 0.8;
      const cols = [H('#1a3a6a'), H('#1e6a8a'), H('#22a08e'), H('#5ad0a8'), H('#9a7ad8'), H('#c8f0ff')];
      return cols[Math.max(0, Math.min(5, Math.round(2.4 + sw * 1.4 - v * 0.08 - (u - 8) * 0.04)))];
    });
    for (const u of [4.5, 7.5, 10.5, 13.5]) { const [x, y] = f.at(u, -5.2 - Math.sin(u / 16 * Math.PI) * 0.8); p.px(x, y, H('#0c0a10')); }
    p.pts([[9, 11], [10, 10], [15, 8]], H('#ffffff'));
  },
  post: p => { sparkle(p, 17, 6, '#c8fff8'); },
};

ISLAND.shell_trycop = {
  draw: p => {
    const Tc = rp('#34080a', '#6c1612', '#aa3018', '#dc5a2a', '#f68e52', '#ffc894');
    // a whole shed crab claw: bulky palm, fixed finger and a hinged dactyl, round pale spots
    const rows = [
      '....................dd..',
      '..................dddd..',
      '................ddddd...',
      '...............dddd.....',
      '..............dddd......',
      '.......pppppppddd.......',
      '.....ppppppppppd........',
      '....pppppppppppp........',
      '...ppppppppppppppp......',
      '...pppppppppppppppff....',
      '...ppppppppppppppfffff..',
      '...pppppppppppppp...fff.',
      '....ppppppppppppp.......',
      '....ppppppppppppp.......',
      '.....ppppppppppp........',
      '......ppppppppp.........',
      '.......aaaaaaa..........',
      '......aaaaaaa...........',
      '.....aaaaaa.............',
      '....aaaaa...............',
      '...aaaa.................',
    ];
    const oy = 1;
    const spot = (m: Uint8Array) => {
      for (const [sx, sy] of [[6, 9], [10, 8], [14, 10], [8, 13], [12, 13], [16, 13], [10, 16]] as Pt[]) {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (p.at(m, sx + dx, sy + dy)) p.px(sx + dx, sy + dy, dx + dy === 0 ? RAMP.cream[5] : RAMP.cream[3]);
      }
    };
    const d = p.maskMap(rows, 'd', 0, oy);
    p.puff(d, Tc, { r: 2, spec: 0.94, lift: 0.3 });
    const fx = p.maskMap(rows, 'f', 0, oy);
    p.puff(fx, Tc, { r: 1.6, spec: 0.94 });
    const a = p.maskMap(rows, 'a', 0, oy);
    p.puff(a, Tc, { r: 2, spec: 0.95, lift: -0.3 });
    p.seam(a, Tc[1], 1);
    const pm = p.maskMap(rows, 'p', 0, oy);
    p.puff(pm, Tc, { r: 4, spec: 0.93 });
    spot(pm);
    p.pts([[21, 1], [21, 2], [22, 12]], RAMP.iron[3]);
    p.pts([[6, 10], [7, 9]], Tc[5]);
  },
};

// ================================================================ beach materials
ISLAND.driftglass = {
  draw: p => {
    const frost = (x: number, y: number) => (hash(x, y, 9) > 0.7 ? 1 : 0);
    const pebble = (cx: number, cy: number, rx: number, ry: number, ang: number, ramp: number[]) => {
      const m = p.ball(cx, cy, rx, ry, ramp, { ang, spec: 0.97, tex: frost, flat: 0.25 });
      p.fill(m, (x, y) => alpha(p.get(x, y), 225));
      return m;
    };
    pebble(8.6, 14.8, 6.4, 4.6, -0.3, rp('#0e2e1c', '#1c5234', '#2e7c4c', '#56a872', '#96d4a6', '#e4fff0'));
    p.drop(pebble(16.2, 9.4, 5, 3.8, 0.4, rp('#12303a', '#205462', '#36808c', '#62b0b6', '#a4e0e0', '#f0ffff')), -0.25, -1, 1);
    p.drop(pebble(16.8, 17.6, 3.6, 2.8, 0.1, rp('#4a4640', '#7a766c', '#aaa89c', '#d4d4c8', '#eeeee6', '#ffffff')), -0.25, -1, -1);
  },
};

ISLAND.kelp = {
  draw: p => {
    const Kp = RAMP.kelp;
    // a leathery ribbon with a ruffled edge, doubling back, a float bladder at the stipe
    const c = curve(bez([3.6, 20.4], [30, 18], [4, 3.4], 36));
    const rib = p.maskFn((x, y) => { const { t, v } = c.loc(x, y); if (t < 0 || t > 1) return false; const w = 2.1 + Math.sin(t * 34) * 0.55 + Math.sin(t * Math.PI) * 0.9; return Math.abs(v) <= w; });
    p.puff(rib, Kp, { r: 2.2, spec: 0.96 });
    p.fill(rib, (x, y) => { const { t, v } = c.loc(x, y); return Math.abs(v) < 0.45 ? Kp[4] : Math.sin(t * 34) > 0.6 && Math.abs(v) > 1.4 ? tone(p.get(x, y), -0.3) : -1; });
    p.ball(3.8, 20, 2.6, 2.4, rp('#1e1a08', '#3e3612', '#645a22', '#8c8034', '#b8aa52', '#e4dc98'), { spec: 0.9, lift: 0.4 });
    p.tube([[3, 21.4], [1.8, 22.2]], 0.6, Kp);
  },
};

ISLAND.flint = {
  draw: p => {
    const Fl = rp('#07080c', '#12151c', '#20242e', '#343a46', '#56606e', '#a8b4c4');
    const Cx = rp('#5a5446', '#8a8474', '#b4ae9c', '#d4d0c0', '#ece8dc', '#ffffff');
    // a knobbly nodule: chalky white rind, split open on a glossy black face with ripples
    const nod = Pen.or(p.maskEllipse(11.6, 12.8, 9, 7.4, -0.3), p.maskEllipse(17.4, 7.2, 3.4, 3, 0), p.maskEllipse(5.6, 16.8, 3.2, 3.4, 0));
    p.puff(nod, Cx, { r: 3.6, spec: 1, tex: (x, y) => (hash(x, y, 4) > 0.8 ? -1 : 0) });
    const face = p.maskPoly([6, 8.4, 15.4, 4.8, 19.6, 11, 14.6, 19.4, 7.6, 17.6]);
    const fm = Pen.and(face, nod);
    p.fill(fm, (x, y) => {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9);
      const ripple = Math.floor(d / 2.3) % 2;
      const lit = x + y < 22 ? 1 : 0;
      return Fl[1 + ripple + lit + (d < 3 ? 1 : 0)];
    });
    p.pts([[9, 8], [10, 8], [9, 9]], Fl[5]);
  },
  post: p => {
    sparkle(p, 20, 17, '#fff0a0', true);
    p.blend(22, 20, H('#ffb040', 200)); p.blend(21, 21, H('#ffd070', 160));
  },
};

ISLAND.clay = {
  draw: p => {
    const Cl = RAMP.clay;
    // a slick lump of cold grey river clay, thumb-pressed, glistening wet
    const lump = Pen.or(p.maskEllipse(12, 14.4, 9.6, 6.6), p.maskEllipse(10, 9.4, 6, 4.4, -0.3));
    p.puff(lump, Cl, { r: 4.4, spec: 0.92, k: 1.1 });
    // thumb print
    p.fill(p.maskEllipse(14, 12.6, 3, 2.2, 0.4), (x, y) => { const d = Math.hypot(x + 0.5 - 14, y + 0.5 - 12.6); return d < 1 ? Cl[1] : Math.floor(d * 1.8) % 2 ? Cl[2] : Cl[4]; });
    p.pts([[6, 8], [7, 8], [5, 13]], H('#f4f6f8'));
    p.px(12, 21, Cl[2]); p.px(13, 22, Cl[1]);
  },
};

// ================================================================ coastal plants
ISLAND.plant_seaholly = {
  draw: p => {
    const Sh = rp('#12202e', '#23384e', '#3a5a74', '#5e84a0', '#90b4c8', '#d4ecf4');
    // spiny blue-silver leaves
    const leaf = (pts: Pt[], w: number) => {
      const c = curve(pts);
      const m = p.maskFn((x, y) => {
        const { t, u, v } = c.loc(x, y);
        if (t < 0 || t > 1) return false;
        const ww = w * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.3;
        const tooth = ((u % 2.6) + 2.6) % 2.6 < 1 ? 1.2 : 0;
        return Math.abs(v) <= ww + tooth * (t > 0.15 ? 1 : 0);
      });
      p.puff(m, Sh, { r: 2, spec: 0.97 });
      p.fill(m, (x, y) => (Math.abs(c.loc(x, y).v) < 0.45 ? Sh[5] : -1));
    };
    leaf(bez([11, 21], [3, 18], [2, 10], 18), 2.6);
    leaf(bez([13, 21], [21, 18], [22, 11], 18), 2.6);
    leaf(bez([12, 21], [9, 14], [7, 8], 16), 2.2);
    // thistle-like flower head with a spiky collar
    for (let i = 0; i < 10; i++) { const a = -Math.PI * 0.95 + i / 9 * Math.PI * 0.9; for (let k = 3; k <= 6.6; k++) p.px(14 + Math.cos(a) * k, 9 + Math.sin(a) * k * 0.6 + 2.4, k > 5.5 ? Sh[5] : Sh[3]); }
    const hd = p.ball(14, 7, 3.4, 4.2, rp('#1a1848', '#2c2c7a', '#4448aa', '#6a72d0', '#a2acec', '#e4e8ff'), { spec: 0.97 });
    p.fill(hd, (x, y) => ((x + y) % 2 === 0 ? tone(p.get(x, y), -0.22) : -1));
    p.tube([[12.4, 20.8], [14, 11]], 0.7, Sh);
  },
};

ISLAND.plant_saltfern = {
  draw: p => {
    const Sf = rp('#0e2426', '#184044', '#26645e', '#3a8a78', '#6ab49a', '#b0e0c8');
    const c = curve(bez([3, 22], [6, 6], [21.6, 3.4], 40));
    const width = (t: number) => Math.pow(1 - t, 0.55) * 5.2 * Math.min(1, (t - 0.1) / 0.14) + 0.4;
    const m = p.maskFn((x, y) => {
      const { t, u, v } = c.loc(x, y);
      if (t < 0.1 || t > 1) return false;
      if (Math.abs(v) > width(t)) return false;
      const k = (((u - Math.abs(v) * 0.85) % 2.6) + 2.6) % 2.6;
      return !(Math.abs(v) > 0.8 && k < 0.95);
    });
    p.fill(m, (x, y) => {
      const { u, v } = c.loc(x, y);
      const k = (((u - Math.abs(v) * 0.85) % 2.6) + 2.6) % 2.6;
      return Sf[(k < 1.5 ? 4 : k > 2.1 ? 2 : 3) + (v < 0 ? 0 : -1)];
    });
    // salt crystals crusting the fronds
    for (let i = 0; i < 16; i++) { const x = Math.floor(4 + hash(i, 1, 5) * 17), y = Math.floor(3 + hash(i, 2, 5) * 17); if (p.at(m, x, y)) p.px(x, y, i % 3 ? H('#f4fcff') : H('#c8e4ec')); }
    for (let i = 0; i <= 70; i++) { const q = c.at(i / 70); p.px(q.x, q.y, i < 10 ? RAMP.wood[3] : Sf[1]); }
  },
  post: p => { sparkle(p, 9, 6, '#ffffff'); sparkle(p, 19, 11, '#ffffff'); },
};

ISLAND.plant_glowmoss = {
  draw: p => {
    p.ball(12, 17.4, 10.4, 5, rp('#08090e', '#12151e', '#1e222e', '#2c3240', '#40485a', '#606a7c'), { spec: 1, tex: (x, y) => (hash(x, y, 2) > 0.85 ? -1 : 0) });
    const Gm = rp('#2a4a0c', '#4a7a10', '#78b01c', '#a8e030', '#d8ff70', '#f8ffd0');
    const cush = Pen.or(p.maskEllipse(7, 13.4, 5.2, 3.6), p.maskEllipse(13, 11.4, 6.2, 4.6), p.maskEllipse(18.4, 13.6, 4.2, 3.2));
    p.puff(cush, Gm, { r: 3.4, lift: 0.6, spec: 1, tex: (x, y) => (hash(x, y, 7) > 0.76 ? -1 : hash(x, y, 8) > 0.86 ? 1 : 0) });
    p.pts([[9, 9], [13, 7], [16, 9], [6, 11]], Gm[5]);
  },
  post: p => {
    halo(p, 12.4, 12, 12, '#c8ff60', 80);
    sparkle(p, 4, 6, '#e8ffb0');
    sparkle(p, 21, 7, '#e8ffb0');
  },
};

ISLAND.plant_dunelily = {
  draw: p => {
    const Bu = rp('#4a3620', '#80623e', '#b0906a', '#d6bc94', '#eedcbc', '#fff6e4');
    // roots
    for (const [dx, len] of [[-3, 4], [-1, 5], [1, 5], [3, 4], [0, 4]] as number[][]) for (let k = 0; k < len; k++) p.px(11.5 + dx + (dx * k) / 5, 19 + k * 0.8, Bu[k > len - 2 ? 3 : 2]);
    // papery layered bulb
    const m = p.ball(11.6, 14.4, 6.8, 6.4, Bu, { spec: 0.96 });
    p.fill(m, (x, y) => { const s = Math.abs(x + 0.5 - 11.6 - (y - 14) * 0.05); return (Math.floor(s / 2.4) % 2 === 1 && y < 19) ? tone(p.get(x, y), -0.16) : -1; });
    p.fill(p.maskEllipse(9.2, 12.6, 1.6, 3.2, 0.25), (x, y) => (p.has(x, y) ? Bu[5] : -1));
    // neck and green shoots
    p.tube([[11.6, 8.6], [11.4, 6.6]], 1.4, Bu, { cap: 'flat' });
    p.tube([[11, 7.2], [8, 1.4]], t => 1.1 - t * 0.6, RAMP.lime, { spec: 1 });
    p.tube([[12.2, 7.2], [16, 2]], t => 1.1 - t * 0.6, RAMP.leaf, { spec: 1, lift: 0.4 });
  },
};

// ================================================================ berries + pipi
const berries = (p: Pen, pts: [number, number, number][], ramp: number[], o: { bloom?: boolean; clear?: boolean } = {}) => {
  for (const [x, y, r] of pts) {
    const m = p.ball(x, y, r, r, ramp, { spec: o.bloom ? 1 : 0.9, lift: 0.2 });
    if (o.bloom) p.fill(m, (xx, yy) => (hash(xx, yy, 3) > 0.62 ? tone(p.get(xx, yy), 0.28) : -1));
    p.drop(m, -0.3, 1, 1);
    p.px(Math.floor(x + r * 0.35), Math.floor(y + r * 0.45), tone(ramp[1], -0.2));
  }
};

ISLAND.berry_ember = {
  draw: p => {
    const Em = rp('#2e0610', '#680e1c', '#aa1a24', '#e03a30', '#ff7a5a', '#ffe4d0');
    p.ball(6.4, 6.2, 4.6, 2.2, RAMP.leaf, { ang: -0.6, spec: 1 });
    p.ball(16.8, 4.8, 4.4, 2, RAMP.leaf, { ang: 0.5, spec: 1, lift: 0.3 });
    for (const [x0, y0, x1, y1] of [[11, 4, 7.4, 12], [11, 4, 12.6, 11], [11, 4, 17.6, 12], [11, 4, 10.4, 16.6]] as number[][]) p.line(x0, y0, x1, y1, RAMP.olive[2]);
    berries(p, [[7.4, 13.4, 3.4], [16.8, 13.8, 3.3], [12.4, 12.4, 3.5], [10.4, 18.4, 3.4], [15.4, 19, 2.8]], Em);
    // tiny bite marks
    p.pts([[18, 13], [18, 15]], Em[1]);
  },
};

ISLAND.berry_dusk = {
  draw: p => {
    const Dk = rp('#140a22', '#2a1640', '#46285e', '#664482', '#9072aa', '#c8b4dc');
    // a pine-like sprig
    for (let i = 0; i < 9; i++) { const x = 4 + i * 1.6, y = 4 + i * 0.8; p.line(x, y, x - 1.8, y + 3, i % 2 ? RAMP.leaf[3] : RAMP.leaf[2]); p.line(x, y, x + 1.6, y - 2.6, RAMP.leaf[4]); }
    p.line(3, 3, 17, 10, RAMP.wood[3]);
    // dusty bloom-covered berries
    berries(p, [[9.2, 14, 3.5], [15.4, 14.4, 3.4], [12, 19.2, 3.3], [18.2, 19.4, 2.6], [6.4, 19.2, 2.6]], Dk, { bloom: true });
  },
};

ISLAND.berry_gold = {
  draw: p => {
    const Gd = rp('#4a2406', '#8a4c0a', '#c88414', '#f0b82c', '#ffe070', '#fffbe0');
    // a drooping cluster of tart little currants on a thread-thin stem
    const stem = bez([4, 3], [12, 2], [14, 14], 20);
    for (const [x, y] of stem) p.px(x, y, RAMP.olive[2]);
    p.ball(5.6, 6.6, 3.6, 1.8, RAMP.leaf, { ang: 0.9, spec: 1 });
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) { const t = 0.35 + i / 8 * 0.65; const [x, y] = stem[Math.round(t * 20)]; pts.push([x + (i % 2 ? 2.6 : -2.4) * (0.4 + t * 0.6), y + 1.2 + (i % 3) * 0.4, 2 - t * 0.35]); }
    pts.push([14, 16.4, 2.2], [11.4, 18.6, 2], [16.4, 19, 1.9]);
    berries(p, pts, Gd);
    for (const [x, y] of pts) p.px(Math.floor(x - 0.6), Math.floor(y - 0.6), Gd[5]);
  },
};

ISLAND.pipi = {
  draw: p => {
    const Pp = rp('#4a3c34', '#7e6a5c', '#b09c8a', '#d8c8b6', '#f0e6da', '#ffffff');
    const clam = (cx: number, cy: number, s: number, ang: number) => {
      // a smooth wedge-shaped clam: rounded front, pointed umbo on top
      const m = p.maskFn((x, y) => {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, ca = Math.cos(ang), sa = Math.sin(ang);
        const u = (dx * ca + dy * sa) / (7 * s), v = (-dx * sa + dy * ca) / (5 * s);
        const top = v < 0 ? 1 - Math.abs(u) * 0.35 : 1;
        return u * u + (v / top) ** 2 <= 1;
      });
      p.puff(m, Pp, { r: 3, spec: 0.92 });
      p.fill(m, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - (cy - 4 * s)); return Math.floor(d / 1.8) % 2 === 1 && d > 3 ? (hash(x, y, 2) > 0.5 ? H('#b8a4b8') : tone(p.get(x, y), -0.12)) : -1; });
      return m;
    };
    clam(8.6, 9.6, 0.95, -0.25);
    p.drop(clam(14.8, 15.4, 1.05, 0.2), -0.35, -1, -1);
  },
};

// ================================================================ island insects
ISLAND.bug_jewelbeetle = {
  draw: p => {
    const f = frame(12, 21.4, 12, 2.4); // tail -> head
    const Jw = rp('#061a10', '#0c3a1c', '#187224', '#44a82a', '#b8d840', '#fff4a0');
    for (const [u, s] of [[6.6, 1], [9.6, 1], [12.4, 1], [6.6, -1], [9.6, -1], [12.4, -1]] as Pt[]) {
      const [x0, y0] = f.at(u, s * 3.4), [x1, y1] = f.at(u + (u - 9.6) * 0.3, s * 6.4), [x2, y2] = f.at(u + (u - 9.6) * 0.8 - 1.6, s * 7.4);
      p.line(x0, y0, x1, y1, RAMP.iron[3]); p.line(x1, y1, x2, y2, RAMP.iron[2]);
    }
    for (const s of [-1, 1]) { const [x0, y0] = f.at(17, s * 1), [x1, y1] = f.at(19.6, s * 3.2); p.line(x0, y0, x1, y1, RAMP.iron[3]); }
    // iridescent wing cases: green shading to gold where the light hits
    const el = p.ball(12, 13.6, 5.6, 7.2, Jw, { spec: 0.92, k: 1.2 });
    p.fill(el, (x) => (x === 11 || x === 12 ? (p.get(x, 0), -1) : -1));
    p.line(12, 8, 12, 20, Jw[1]);
    p.ball(12, 6.2, 3.6, 2.4, Jw, { spec: 0.9, lift: -0.4 });
    p.ball(12, 3.4, 1.8, 1.4, RAMP.iron, { lift: 1 });
    p.pts([[9, 11], [10, 10], [9, 12]], H('#fffbd0'));
  },
};

ISLAND.bug_sandhopper = {
  draw: p => {
    const Sd = rp('#3a2e22', '#665440', '#94806a', '#bcaa92', '#dcd0bc', '#fffaf0');
    // a curled amphipod: arched segmented back, big black eye, antennae, spiny legs
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI * (1.05 - i / 20 * 1.1); pts.push([12 + Math.cos(a) * 7.4, 14 - Math.sin(a) * 6.2]); }
    for (let i = 3; i < 19; i += 2) { const [x, y] = pts[i]; p.line(x, y + 2, x + (i < 10 ? -1 : 1), y + 5, Sd[2]); }
    const m = p.tube(pts, t => 2.9 - Math.abs(t - 0.35) * 2.6, Sd, { spec: 0.94 });
    const c = curve(pts);
    p.fill(m, (x, y) => (Math.round(c.loc(x, y).u / 1.7) % 2 === 0 ? tone(p.get(x, y), -0.18) : -1));
    const [hx, hy] = pts[0];
    p.ball(hx + 0.4, hy - 0.8, 1.2, 1.2, rp('#000000', '#060606', '#101010', '#1a1a1a', '#262626', '#ffffff'), { spec: 0.8 });
    p.line(hx, hy - 2, hx - 1, hy - 8, Sd[3]); p.line(hx + 1, hy - 2, hx + 3, hy - 7, Sd[2]);
    const [tx, ty] = pts[20];
    p.line(tx, ty, tx + 2, ty + 3, Sd[3]); p.line(tx - 1, ty, tx, ty + 4, Sd[2]);
  },
};

ISLAND.bug_lanternmoth = {
  draw: p => {
    const Pm = rp('#4a4238', '#7c7262', '#aca290', '#d4ccb8', '#eee8da', '#ffffff');
    const wing = (cx: number, cy: number, rx: number, ry: number, ang: number, spot: boolean) => {
      const m = p.ball(cx, cy, rx, ry, Pm, { ang, spec: 1, flat: 0.45 });
      p.fill(m, (x, y) => {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, ca = Math.cos(ang), sa = Math.sin(ang);
        const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        const d = Math.hypot(u, v);
        if (d > 0.86) return Pm[2];
        if (spot) { const e = Math.hypot(u - 0.2, v); if (e < 0.22) return H('#ffffff'); if (e < 0.42) return H('#8ff8e8'); if (e < 0.5) return H('#2aa898'); }
        return Math.abs(v) < 0.08 && d > 0.3 ? Pm[2] : -1;
      });
    };
    wing(7.8, 16, 4.6, 3.4, 0.75, false);
    wing(16.2, 16, 4.6, 3.4, -0.75, false);
    wing(6.6, 9, 6.2, 4.2, -0.45, true);
    wing(17.4, 9, 6.2, 4.2, 0.45 + Math.PI, true);
    p.tube([[12, 5.4], [12, 18.6]], t => (t < 0.3 ? 1.9 : 1.6 - (t - 0.3) * 0.9), Pm, { tex: (x, y) => (y % 2 ? -1 : 0), lift: -0.6 });
    p.line(11, 5, 8, 1, Pm[2]); p.line(12, 5, 15, 1, Pm[2]);
    p.pts([[8, 2], [9, 1], [15, 2], [14, 1]], Pm[3]);
  },
  post: p => {
    halo(p, 5.4, 9, 4.6, '#80fff0', 130);
    halo(p, 18.6, 9, 4.6, '#80fff0', 130);
  },
};

ISLAND.bug_hornet = {
  draw: p => {
    const f = frame(12, 22.4, 12, 1.6); // tail -> head
    // wings (crumpled a little) behind
    for (const s of [-1, 1]) {
      const m = p.maskEllipse(12 + s * 5.6, 9.8, 5.6, 2.2, s * 0.5);
      p.fill(m, (x, y) => ((x + y) % 3 === 0 ? H('#d4e4f0', 210) : H('#b0c8dc', 150)));
    }
    // striped abdomen: teal, violet, gold
    const ab = p.ball(12, 16.6, 4.2, 5.8, RAMP.teal, { spec: 0.93 });
    p.fill(ab, (x, y) => { const b = Math.floor((y - 11) / 2) % 3; const src = b === 0 ? RAMP.teal : b === 1 ? RAMP.violet : GOLD; const i = RAMP.teal.indexOf(p.get(x, y)); return src[Math.max(0, i)]; });
    p.px(12, 22, RAMP.iron[0]);
    // thorax and cross little head
    p.ball(12, 9.6, 3.2, 2.6, RAMP.iron, { lift: 1, spec: 0.92 });
    p.ball(12, 5.4, 3.4, 2.4, GOLD, { spec: 0.93 });
    p.pts([[9, 4], [10, 5], [14, 5], [15, 4]], RAMP.iron[0]);
    p.pts([[10, 6], [14, 6]], H('#1a0a10'));
    p.pts([[9, 2], [8, 1], [15, 2], [16, 1]], RAMP.iron[2]);
    // curled dead legs
    for (const s of [-1, 1]) for (const y of [9, 11]) { p.px(12 + s * 3.6, y, RAMP.iron[2]); p.px(12 + s * 4.4, y + 1, RAMP.iron[2]); p.px(12 + s * 4, y + 2, RAMP.iron[2]); }
  },
};
