// Building-material icons: canvas, poles, rope, flax fibre, firewood, stones, planks, scrap, resin,
// copper wire, the captain's pipe, mussels and the battery pack.

import { Pen, RAMP, H, rp, hash, alpha, tone, IconSet, Ramp } from './pen';
import { frame, ring, halo, sparkle, wisp, grain } from './parts';

export const MATERIALS: IconSet = {};

MATERIALS.canvas = {
  draw: p => {
    const K = RAMP.khaki;
    const f = frame(5.5, 17, 20, 5.5);
    // rolled canvas: a cylinder with a woven texture, two leather straps with buckles
    const roll = p.tube([f.at(0, 0), f.at(f.len, 0)], 4.6, K, { cap: 'flat', tex: (x, y) => ((x + y * 2) % 4 === 0 ? -0.6 : 0) });
    for (const u0 of [4.2, 12.2]) {
      p.fill(roll, (x, y) => {
        const [u, v] = f.loc(x, y);
        if (Math.abs(u - u0) > 0.9) return -1;
        return v < -1.5 ? RAMP.wood[4] : v < 1.8 ? RAMP.wood[3] : RAMP.wood[1];
      });
      const [bx, by] = f.at(u0, -2.3);
      p.px(bx, by, RAMP.brass[4]);
    }
    // spiral end of the roll
    const [ex, ey] = f.at(0, 0);
    const ang = Math.atan2(f.uy, f.ux);
    const end = p.maskEllipse(ex, ey, 2.4, 4.6, ang);
    p.fill(end, (x, y) => {
      const [u, v] = f.loc(x, y);
      const r = Math.hypot(u / 2.4, v / 4.6);
      const a = Math.atan2(v, u) / (Math.PI * 2);
      const s = Math.floor(r * 3.2 + a + 8) % 2;
      if (r < 0.2) return K[0];
      return s ? K[1] : r > 0.8 ? K[3] : K[2];
    });
  },
};

MATERIALS.poles = {
  draw: p => {
    const Cr = RAMP.chrome;
    const pole = (pts: [number, number][]) => {
      const m = p.tube(pts, 0.95, Cr, { cap: 'flat' });
      // shock-corded joints + rubber tips
      let total = 0;
      const segs: number[] = [0];
      for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(total); }
      const pt = (d: number): [number, number] => {
        let i = 1;
        while (i < pts.length - 1 && segs[i] < d) i++;
        const k = (d - segs[i - 1]) / (segs[i] - segs[i - 1]);
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      };
      for (const d of [total * 0.36, total * 0.72]) p.tube([pt(d - 0.7), pt(d + 0.7)], 1.2, RAMP.iron, { cap: 'flat', lift: 1 });
      p.tube([pt(0), pt(1.4)], 1.15, RAMP.rubber, { cap: 'flat', lift: 1 });
      p.tube([pt(total - 1.4), pt(total)], 1.15, RAMP.rubber, { cap: 'flat', lift: 1 });
      return m;
    };
    pole([[4.2, 21.5], [21.2, 4.5]]);
    pole([[1.6, 18.6], [18.6, 1.6]]);
    pole([[7.2, 22.4], [15.6, 14.8], [22.6, 9.6]]);
  },
};

MATERIALS.rope = {
  draw: p => {
    const Rr = rp('#2c1a0c', '#56361a', '#86602e', '#b28a4a', '#d8b674', '#f2dca4');
    const loop = (cx: number, cy: number, rx: number, ry: number, r: number, a0 = 0, a1 = Math.PI * 2) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 28; i++) { const a = a0 + (a1 - a0) * i / 28; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      return p.tube(pts, r, Rr, { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : (x - y + 30) % 6 === 0 ? 0.6 : 0) });
    };
    // coil seen from above: outer loop, middle, inner, with the hole in the centre
    loop(11.5, 12, 9.4, 7.2, 1.75);
    const mid = loop(11.5, 11.4, 6.2, 4.6, 1.7);
    p.drop(mid, -0.3);
    const inn = loop(11.5, 10.9, 3.2, 2.3, 1.55);
    p.drop(inn, -0.3);
    p.px(11, 10, RAMP.fur[0]); p.px(12, 10, RAMP.fur[0]); p.px(11, 11, RAMP.fur[1]);
    // loose end with a frayed tip
    const tail = p.tube([[18.8, 16.4], [20.6, 19.4], [21.8, 22.2]], 1.6, Rr, { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : 0) });
    p.drop(tail, -0.2, -1, -1);
    p.pts([[20, 23], [22, 23]], Rr[4]);
  },
};

MATERIALS.flax = {
  draw: p => {
    const F = rp('#3a3214', '#6c5e2a', '#9c8a44', '#c8b464', '#e6d690', '#fbf2c4');
    // a hank of fibre: two fanned bunches tied in the middle
    const cx = 11.5, cy = 12;
    for (let i = 0; i < 17; i++) {
      const t = i / 16 - 0.5;
      for (const dir of [-1, 1]) {
        const a = -0.8 + t * 0.9 * (dir > 0 ? 1 : 1.1);
        const len = 10 + (i % 3) * 0.8 - Math.abs(t) * 2.5;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) {
          const s = k / 8;
          const spread = s * s * 3.2;
          pts.push([cx + dir * (Math.cos(a) * len * s + t * spread * 0.8), cy + dir * (Math.sin(a) * len * s + t * spread * 0.6) + (dir > 0 ? s * s * 1.2 : 0)]);
        }
        const c = F[[2, 3, 4, 3, 5, 2, 4][i % 7]];
        for (const [x, y] of pts) if (!(Math.abs(x - cx) < 1.6 && Math.abs(y - cy) < 1.6)) p.px(x, y, c);
      }
    }
    // the twisted tie
    p.tube([[cx - 2, cy + 2.4], [cx + 2.2, cy - 2.2]], 1.6, RAMP.wood, { cap: 'flat', tex: (x, y) => ((x + y) % 2 ? -1 : 0) });
  },
};

MATERIALS.wood = {
  draw: p => {
    const bark = rp('#150a06', '#2c150c', '#472413', '#65371c', '#86502a', '#a86c3a');
    const face = rp('#6a3c1a', '#a8692e', '#d6984a', '#f0c278', '#fde4a8', '#fff6d8');
    const log = (cx: number, cy: number, r: number, seed: number) => {
      // the log's bark running back (up-right), then the sawn face with growth rings
      p.ball(cx + 1.7, cy - 1.4, r, r, bark, { spec: 1, lift: -0.3, tex: (x, y) => ((x + y + seed) % 3 === 0 ? -1 : 0) });
      const m = p.maskDisc(cx, cy, r);
      p.fill(m, (x, y) => {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r;
        if (d > 0.8) return bark[dx + dy < 0 ? 4 : 2];
        if (d < 0.17) return face[0];
        const band = Math.floor(d * 3.1 + hash(Math.floor(Math.atan2(dy, dx) * 2), seed, 1) * 0.25) % 2;
        const lit = dx + dy < -r * 0.4 ? 1 : dx + dy > r * 0.5 ? -1 : 0;
        return face[Math.max(1, Math.min(4, (band ? 2 : 3) + lit))];
      });
      // a drying crack from the heart
      p.line(Math.floor(cx + 0.5), Math.floor(cy + 0.5), Math.floor(cx + r * 0.62), Math.floor(cy + r * 0.42), face[1]);
      return m;
    };
    log(11, 7.6, 4.5, 3);
    log(6, 16.4, 4.6, 5);
    log(15.8, 16.4, 4.6, 7);
  },
};

MATERIALS.stone = {
  draw: p => {
    const blue = rp('#1b2230', '#2e3a4c', '#4a5a6c', '#6e8090', '#9aaab4', '#d6e0e2');
    const speck = (seed: number, c: number) => (x: number, y: number) => (hash(x, y, seed) > 0.86 ? c : 0);
    // a big flat grey pebble with a quartz band, a blue-grey one and a warm little one in front
    const a = p.ball(8.6, 13.6, 7.6, 5.2, RAMP.stone, { ang: -0.25, tex: speck(3, -1), spec: 0.99 });
    p.fill(a, (x, y) => {
      const d = (x + 0.5 - 8.6) * 0.55 + (y + 0.5 - 13.6) - 0.2;
      return Math.abs(d + (x > 9 ? 0.6 : 0)) < 0.75 ? (x < 8 ? H('#f2f2ea') : H('#cfd2cc')) : -1;
    });
    const b = p.ball(16.6, 8.8, 5, 3.9, blue, { ang: 0.4, tex: speck(5, 1), spec: 0.985 });
    p.drop(b, -0.3, -1, 1);
    const c = p.ball(15.2, 17.8, 4, 3, RAMP.brownstone, { ang: -0.1, tex: speck(9, -1), spec: 0.985 });
    p.drop(c, -0.3, -1, -1);
  },
};

MATERIALS.plank = {
  draw: p => {
    const blue = rp('#0c1430', '#16245a', '#233f86', '#3862a8', '#6a92c8', '#b4d0ec');
    const board = (ax: number, ay: number, bx: number, by: number, w: number, seed: number, broken: boolean, paint: boolean) => {
      const f = frame(ax, ay, bx, by);
      const m = p.maskFn((x, y) => {
        const [u, v] = f.loc(x, y);
        if (u < 0 || Math.abs(v) > w) return false;
        const end = broken ? f.len - 2 + Math.sin(v * 2.6 + seed) * 1.8 : f.len;
        return u <= end;
      });
      const grainTex = (x: number, y: number) => {
        const [u, v] = f.loc(x, y);
        const line = Math.round(v + hash(Math.floor(u / 4), seed, 3) * 0.8 - 0.4);
        const g = hash(Math.floor(u / 3), line, seed);
        return g > 0.62 ? -1 : g < 0.1 ? 1 : 0;
      };
      p.slab(m, RAMP.pale, 3, { tex: grainTex });
      if (paint) {
        // chipped hull paint over most of the board
        p.fill(m, (x, y) => {
          const [u, v] = f.loc(x, y);
          if (hash(Math.floor(u / 2), Math.floor(v + 3), seed + 9) > 0.8 || u > f.len - 3.5) return -1;
          const edgeT = !p.at(m, x, y - 1) || !p.at(m, x - 1, y), edgeB = !p.at(m, x, y + 1) || !p.at(m, x + 1, y);
          return blue[edgeT ? 4 : edgeB ? 2 : 3 + (grainTex(x, y) < 0 ? -1 : 0)];
        });
      }
      // nail heads
      const [x, y] = f.at(2.2, -w * 0.3);
      p.px(x, y, RAMP.steel[5]); p.px(x + 1, y + 1, RAMP.iron[1]);
      return m;
    };
    board(2.2, 16.2, 20.6, 4.2, 2.6, 1, true, true);
    const m2 = board(4.2, 21.4, 22.2, 10.4, 2.6, 4, false, false);
    p.drop(m2, -0.3, 1, -1);
  },
};

MATERIALS.scrap = {
  draw: p => {
    const S = RAMP.steel;
    const rust = (seed: number) => (x: number, y: number) => (hash(x >> 1, y >> 1, seed) > 0.74 ? -1.6 : 0);
    // bent L-bracket with bolt holes and rust
    const br = p.maskPoly([2, 5, 7, 3, 9, 8, 6.5, 9.5, 7.5, 15, 17, 13, 18, 18, 6, 20.5, 3.5, 18.5]);
    p.slab(br, S, 3, { tex: rust(4) });
    p.fill(br, (x, y) => (hash(x >> 1, y >> 1, 4) > 0.74 ? (hash(x, y, 2) > 0.5 ? RAMP.rust[3] : RAMP.rust[2]) : -1));
    for (const [x, y] of [[5, 7], [5, 13], [13, 17]] as [number, number][]) { p.px(x, y, RAMP.iron[0]); p.px(x + 1, y, RAMP.iron[1]); p.px(x, y - 1, S[5]); }
    // hex nut
    const nx = 17, ny = 6.6, nr = 4.4;
    const hexPts: number[] = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; hexPts.push(nx + Math.cos(a) * nr, ny + Math.sin(a) * nr); }
    const nut = p.maskPoly(hexPts);
    p.slab(nut, RAMP.chrome, 3, { hi: 1, lo: -2 });
    p.fill(nut, (x, y) => (x + 0.5 < nx - 1.5 && y + 0.5 < ny ? RAMP.chrome[4] : x + 0.5 > nx + 1.5 && y + 0.5 > ny - 1 ? RAMP.chrome[2] : -1));
    ring(p, nx, ny, 1.2, 2.3, RAMP.chrome, { lift: -1 });
    p.fill(p.maskDisc(nx, ny, 1.25), RAMP.iron[0]);
    p.drop(nut, -0.35, -1, 1);
  },
};

MATERIALS.resin = {
  draw: p => {
    const Am = RAMP.amber;
    // a glossy lump of kauri gum with a drip on top and a trapped gnat
    const m = Pen.or(p.maskEllipse(11.5, 14, 8.4, 6.8, -0.2), p.maskEllipse(9.5, 7.5, 3, 4.2, 0.35));
    p.puff(m, Am, { r: 4.5, spec: 0.94, lift: 0.3 });
    // inner glow + depth
    p.fill(m, (x, y) => {
      const d = Math.hypot(x + 0.5 - 12.5, (y + 0.5 - 15) * 1.2);
      return d < 2.4 ? Am[4] : -1;
    });
    p.pts([[13, 15], [14, 16]], Am[1]); p.px(12, 16, Am[2]); p.px(15, 15, Am[2]);
    // highlights
    p.pts([[6, 12], [6, 13], [7, 11]], H('#fffbe8'));
    p.px(8, 6, H('#fffbe8'));
    p.pts([[17, 18], [16, 19]], Am[4]);
  },
  post: p => {
    sparkle(p, 19, 7, '#fff6c8');
  },
};

MATERIALS.wire = {
  draw: p => {
    const Cu = RAMP.copper;
    // a coil of stripped copper wire, loops stacked along the diagonal, loose end trailing
    for (let i = 0; i < 4; i++) {
      const cx = 9.2 + i * 1.9, cy = 13.2 - i * 1.5;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 30; k++) { const a = k / 30 * Math.PI * 2; pts.push([cx + Math.cos(a) * 6.4, cy + Math.sin(a) * 4.8]); }
      const m = p.tube(pts, 0.8, Cu, { spec: 0.93 });
      if (i) p.drop(m, -0.25);
    }
    p.tube([[3.4, 15.8], [2.2, 19.8], [4.4, 21.8]], 0.8, Cu);
    p.px(4, 22, RAMP.chrome[4]); p.px(5, 22, RAMP.chrome[3]);
  },
  post: p => {
    sparkle(p, 19, 5, '#ffe8c0');
  },
};

MATERIALS.pipe = {
  draw: p => {
    const Br = RAMP.briar;
    // curved black stem with a silver band
    p.tube([[1.8, 9.4], [5, 11.4], [9.4, 12.8]], t => 0.95 + t * 0.4, RAMP.rubber, { lift: 1, spec: 0.95 });
    p.tube([[8.8, 12.8], [10.2, 13]], 1.5, RAMP.chrome, { cap: 'flat' });
    // briar shank and the round bowl
    p.tube([[10, 13.3], [14, 14.2]], 1.9, Br, { cap: 'flat', spec: 0.95 });
    p.ball(16.8, 12.6, 4.8, 6.2, Br, { spec: 0.95, clip: (x, y) => y >= 7 });
    // rim with ash and a glowing ember
    const rim = p.maskEllipse(16.8, 7.4, 4.3, 1.7);
    p.fill(rim, (x, y) => (Math.hypot((x + 0.5 - 16.8) / 4.3, (y + 0.5 - 7.4) / 1.7) > 0.7 ? Br[4] : RAMP.stone[1]));
    p.pts([[16, 7], [17, 7]], RAMP.orange[3]); p.px(18, 7, RAMP.red[3]);
    // the carved anchor
    p.map(['..a..', '.aaa.', '..a..', 'a.a.a', '.aaa.'], { a: Br[5] }, 15, 10);
    p.pts([[17, 11], [18, 13], [19, 14], [15, 14]], Br[1]);
  },
  post: p => {
    wisp(p, 17, 5, 5, '#e8ecf0', 150);
    wisp(p, 19, 4, 3, '#e8ecf0', 100, -1);
  },
};

MATERIALS.mussel = {
  draw: p => {
    const N = RAMP.navy;
    const rows = [
      '.................aaa....',
      '...............aaaaaa...',
      '.............aaaaaaaaa..',
      '............aaaaaaaaaa..',
      '...........aaaaaaaaaaa..',
      '..........aaaaaaaaaaa...',
      '.........aaaaaaaaaaa....',
      '........aaaaaaaaaaa.....',
      '.......aaaaaaaaaaa......',
      '......aaaaaaaaaa........',
      '.....aaaaaaaaa..........',
      '....aaaaaaaa............',
      '....aaaaaa......bbbb....',
      '...aaaaa.....bbbbbbbb...',
      '...aaa.....bbbbbbbbbbb..',
      '.........bbbbbbbbbbbbb..',
      '.......bbbbbbbbbbbbbbb..',
      '.....bbbbbbbbbbbbbbbbb..',
      '....bbbbbbbbbbbbbbbbb...',
      '.....bbbbbbbbbbbbbbb....',
      '.......bbbbbbbbbbbb.....',
    ];
    const bands = (m: Uint8Array, ux: number, uy: number, step: number) => p.fill(m, (x, y) => {
      const d = Math.hypot(x + 0.5 - ux, y + 0.5 - uy);
      const c = p.get(x, y);
      return Math.floor(d / step) % 2 === 1 && d > step * 1.5 && c !== N[5] ? tone(c, 0.12) : -1;
    });
    const a = p.maskMap(rows, 'a', 0, 1);
    p.puff(a, N, { r: 3.4, spec: 0.9, k: 1.25 });
    bands(a, 3.5, 15.5, 4.2);
    const b = p.maskMap(rows, 'b', 0, 1);
    p.puff(b, N, { r: 3, spec: 0.9, k: 1.25 });
    bands(b, 4.5, 19.5, 3.8);
    // pearly violet lips along the gape, a dark seam where the front shell overlaps
    p.fill(a, (x, y) => (!p.at(a, x + 1, y + 1) && !p.at(a, x + 1, y) && x + y > 18 ? H('#6a5cb4') : -1));
    p.fill(b, (x, y) => (!p.at(b, x, y + 1) && x > 6 ? H('#5a4ca4') : -1));
    p.seam(b, N[0], 1 | 4);
  },
};

MATERIALS.battery = {
  draw: p => {
    const Bd = rp('#0e1410', '#18221b', '#243428', '#344a38', '#4e6a50', '#7a9a78');
    // sealed box in 3/4 view: front, top and side faces
    p.slab(p.maskPoly([2, 8, 18, 8, 18, 21, 2, 21]), Bd, 3);
    p.slab(p.maskPoly([2, 8, 6, 4, 22, 4, 18, 8]), Bd, 4, { lo: 0 });
    p.slab(p.maskPoly([18, 8, 22, 4, 22, 17, 18, 21]), Bd, 1, { hi: 1 });
    // terminals
    p.tube([[7.5, 6.4], [7.5, 3.6]], 1.4, RAMP.red, { cap: 'flat', lift: 0.5 });
    p.fill(p.maskEllipse(7.5, 3.6, 1.45, 0.7), RAMP.red[4]);
    p.tube([[16, 6.4], [16, 3.6]], 1.4, RAMP.rubber, { cap: 'flat', lift: 1 });
    p.fill(p.maskEllipse(16, 3.6, 1.45, 0.7), RAMP.rubber[4]);
    // label with a bolt
    p.slab(p.maskBox(3, 11, 14, 7), RAMP.yellow, 3, { hi: 1, lo: -1 });
    p.map(['...kk', '..kk.', '.kkkk', '..kk.', '.kk..'], { k: RAMP.iron[1] }, 7, 12);
    p.pts([[13, 13], [12, 14], [13, 14], [14, 14], [13, 15]], RAMP.red[2]);
  },
};
