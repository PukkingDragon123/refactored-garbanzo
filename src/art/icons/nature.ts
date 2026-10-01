// Nature icons: plants, fungi, insects and the animal samples.

import { Pen, RAMP, H, rp, hash, alpha, tone, IconSet, Pt } from './pen';
import { frame, ring, halo, sparkle, wisp, curve, bez } from './parts';

export const NATURE: IconSet = {};
/** position + unit tangent at arc fraction t along a polyline */
function along(pts: Pt[], t: number): { x: number; y: number; tx: number; ty: number } {
  let total = 0;
  const seg = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(total); }
  const d = t * total;
  let i = 1;
  while (i < pts.length - 1 && seg[i] < d) i++;
  const k = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]);
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
  const l = Math.hypot(bx - ax, by - ay) || 1;
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, tx: (bx - ax) / l, ty: (by - ay) / l };
}

// ================================================================ plants
NATURE.fernfrond = {
  draw: p => {
    const c = curve(bez([3, 22], [4.6, 6], [21.6, 2.8], 40));
    const width = (t: number) => Math.pow(1 - t, 0.55) * 5.6 * Math.min(1, (t - 0.1) / 0.14) + 0.4;
    const inside = (x: number, y: number) => {
      const { t, u, v } = c.loc(x, y);
      if (t < 0.1 || t > 1) return false;
      const w = width(t);
      if (Math.abs(v) > w) return false;
      const k = (((u - Math.abs(v) * 0.85) % 2.4) + 2.4) % 2.4;
      return !(Math.abs(v) > 0.8 && k < 0.85);
    };
    const m = p.maskFn(inside);
    // pinnae: glossy green on the outer side, silver undersides on the inner side
    p.fill(m, (x, y) => {
      const { t, u, v } = c.loc(x, y);
      const k = (((u - Math.abs(v) * 0.85) % 2.4) + 2.4) % 2.4;
      const Rm = v < 0 ? RAMP.leaf : RAMP.silver;
      let i = k < 1.35 ? 4 : k > 1.95 ? 2 : 3;
      if (Math.abs(v) / width(t) > 0.75 && v < 0) i += 1;
      if (v > 0 && Math.abs(v) / width(t) > 0.75) i -= 1;
      return Rm[Math.max(1, Math.min(5, i))];
    });
    for (let i = 0; i <= 70; i++) { const q = c.at(i / 70); p.px(q.x, q.y, i < 10 ? RAMP.wood[3] : i < 16 ? RAMP.olive[3] : RAMP.leaf[2]); }
  },
};

NATURE.flaxleaf = {
  draw: p => {
    const F = rp('#0e2219', '#183a26', '#265a30', '#3a7c38', '#5e9e44', '#9ccc68');
    const blade = (pts: Pt[], w: number) => {
      const m = p.tube(pts, t => w * Math.sqrt(1 - t) + 0.35, F, { flat: 0.35, spec: 1 });
      // central fold catches the light; the margins go rusty red toward the tip
      p.fill(m, (x, y) => {
        let best = 9, bt = 0;
        for (let i = 0; i < pts.length; i++) { const d = Math.hypot(x + 0.5 - pts[i][0], y + 0.5 - pts[i][1]); if (d < best) { best = d; bt = i / (pts.length - 1); } }
        if (best < 0.45 && bt > 0.08) return F[5];
        const edge = !p.at(m, x - 1, y) || !p.at(m, x + 1, y) || !p.at(m, x, y - 1) || !p.at(m, x, y + 1);
        if (edge && bt > 0.45) return bt > 0.8 ? RAMP.red[3] : RAMP.orange[1];
        return -1;
      });
      return m;
    };
    blade(bez([11, 21.5], [4, 13], [2.2, 3.4], 20), 1.9);
    blade(bez([12, 21.5], [20.5, 14], [21.6, 3.6], 20), 1.9);
    blade(bez([11.6, 21], [11, 10], [13.6, 2.6], 20), 2.1);
    p.tube([[9.4, 20.8], [14.4, 20.8]], 1.3, RAMP.red, { cap: 'flat' });
  },
};

NATURE.kawakawa = {
  draw: p => {
    const K = rp('#0a2018', '#123a26', '#1d5c30', '#2c8036', '#4ea440', '#98d066');
    const cx = 12.4, cy = 11.2, s = 8.6;
    const hl = (x: number, y: number) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      return { u: (dx - dy) * 0.7071, v: (dx + dy) * 0.7071 };
    };
    // a heart-shaped leaf: lobes at the stem (bottom-left), tip up-right
    const leaf = p.maskFn((x, y) => {
      const { u, v } = hl(x, y);
      const X = v / s, Y = -u / s + 0.12;
      const a = X * X + Y * Y - 1;
      return a * a * a - X * X * Y * Y * Y <= 0;
    });
    p.puff(leaf, K, { r: 4, spec: 0.97 });
    p.fill(leaf, (x, y) => {
      const { u, v } = hl(x, y);
      if (Math.abs(v) < 0.55 && u > -7) return K[5];
      const vein = Math.abs((((u * 0.95 + Math.abs(v) * 0.85) % 3.4) + 3.4) % 3.4 - 1.7) < 0.42 && Math.abs(v) < 6.4 && Math.abs(v) > 1;
      if (vein) return v < 0 ? K[4] : K[3];
      return v > 0 ? tone(p.get(x, y), -0.2) : -1;
    });
    // the insect holes the best leaves have
    for (const [hx, hy, w, h] of [[8, 9, 2, 2], [14, 15, 2, 1], [16, 8, 1, 2], [10, 15, 1, 1], [13, 5, 1, 1], [18, 12, 1, 1]] as number[][]) for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.clear(hx + xx, hy + yy);
    p.tube([[5.4, 18.2], [1.8, 21.8]], 0.8, RAMP.olive);
  },
};

NATURE.ratabloom = {
  draw: p => {
    // leaves behind
    p.ball(6.2, 18, 4.6, 2.1, RAMP.leaf, { ang: 0.55, spec: 1 });
    p.ball(17.2, 18.4, 4.6, 2.1, RAMP.leaf, { ang: -0.6, spec: 1 });
    // a pom-pom of scarlet stamens tipped with gold anthers
    const cx = 11.8, cy = 10.2;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + hash(i, 2, 3) * 0.15;
      const len = 7.2 + hash(i, 5, 3) * 2.2;
      for (let k = 2; k <= len; k++) {
        const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k * 0.94;
        const lit = Math.cos(a + Math.PI * 0.75) > 0.3;
        p.px(x, y, k >= len - 0.8 ? RAMP.yellow[lit ? 5 : 4] : k < 4 ? RAMP.red[2] : RAMP.red[lit ? 4 : i % 2 ? 3 : 2]);
      }
    }
    p.ball(cx, cy, 2.6, 2.4, RAMP.red, { lift: -1 });
    p.px(cx - 1, cy - 1, RAMP.red[4]);
  },
  post: p => {
    sparkle(p, 12, 21, '#fff6d0');
  },
};

NATURE.pitcher = {
  draw: p => {
    const rows = [
      '..........LLLLL.........',
      '........LLLLLLLLL.......',
      '.........LLLLLLLL.......',
      '..........LLLL..........',
      '......rrrrrrrrrrr.......',
      '.....rkkkkkkkkkkkr......',
      '......rrrrrrrrrrr.......',
      '.......gggggggggg.......',
      '........gggggggg........',
      '........ggggggggg.......',
      '.......ggggggggggg......',
      '......ggggggggggggg.....',
      '......gggggggggggggg....',
      '.....ggggggggggggggg....',
      '.....ggggggggggggggg....',
      '.....ggggggggggggggg....',
      '.....ggggggggggggggg....',
      '......ggggggggggggg.....',
      '.......ggggggggggg......',
      '.........ggggggg........',
    ];
    const G = rp('#12301a', '#1f5024', '#357a2a', '#58a232', '#8ccc48', '#d4f08a');
    const body = p.maskMap(rows, 'g', 0, 1);
    p.puff(body, G, { r: 4.5, spec: 0.96 });
    // red veins and blotches
    p.fill(body, (x, y) => {
      const n = hash(x >> 1, y >> 1, 4);
      if ((x * 2 + y) % 7 === 0 && y > 9) return RAMP.red[2];
      return n > 0.8 && y > 10 ? RAMP.red[x < 11 ? 3 : 2] : -1;
    });
    const lip = p.maskMap(rows, 'r', 0, 1);
    p.slab(lip, RAMP.red, 3, { tex: x => (x % 2 ? 1 : -1) });
    p.fill(p.maskMap(rows, 'k', 0, 1), (x) => (x < 9 ? H('#1a0a0a') : H('#2a1410')));
    p.puff(p.maskMap(rows, 'L', 0, 1), G, { r: 2, lift: 0.4 });
    p.pts([[10, 2], [13, 2], [11, 3]], RAMP.red[2]);
    // curling tendril
    p.tube([[10, 20.5], [7, 21.5], [3.8, 20.2], [3.4, 17.6], [5.2, 17]], 0.6, G, { spec: 1 });
  },
};

NATURE.moonfruit = {
  draw: p => {
    p.ball(11.6, 13.6, 7.6, 7.3, RAMP.moon, { spec: 0.955, lift: 0.3 });
    p.fill(p.maskEllipse(11.6, 13.6, 7.6, 7.3), (x, y) => (Math.abs(x + 0.5 - (11.6 + (y - 13.6) * 0.18)) < 0.5 && y > 8 && y < 19 ? RAMP.moon[2] : -1));
    p.tube([[12, 6.8], [12.8, 3.6]], 0.75, RAMP.wood);
    p.ball(17, 4.2, 4.1, 1.8, RAMP.leaf, { ang: -0.35, spec: 1 });
    p.line(13, 5, 19, 3, RAMP.leaf[4]);
  },
  post: p => {
    halo(p, 11.6, 13.6, 11, '#fff8c4', 70);
    sparkle(p, 3, 7, '#fffbe0');
    sparkle(p, 20, 18, '#fffbe0');
  },
};

NATURE.moss = {
  draw: p => {
    p.ball(12, 18, 10, 4.2, RAMP.stone, { spec: 1, tex: (x, y) => (hash(x, y, 2) > 0.85 ? -1 : 0) });
    const M = rp('#15260e', '#284214', '#446a1e', '#6a9428', '#9cbe3c', '#d2e870');
    const cush = Pen.or(p.maskEllipse(7.5, 14.4, 5, 3.6), p.maskEllipse(13, 12.6, 6, 4.4), p.maskEllipse(18, 14.8, 4.4, 3.2));
    p.puff(cush, M, { r: 3.6, spec: 1, tex: (x, y) => (hash(x, y, 7) > 0.78 ? -1 : hash(x, y, 8) > 0.86 ? 1 : 0) });
    // spore capsules on fine stalks
    for (const [x, y, h] of [[7, 11, 4], [11, 8, 5], [15, 9, 4], [18, 12, 3]] as [number, number, number][]) {
      for (let k = 1; k <= h; k++) p.px(x, y - k, RAMP.olive[3]);
      p.px(x, y - h - 1, RAMP.orange[2]); p.px(x, y - h - 2, RAMP.orange[3]);
    }
  },
};

// ================================================================ fungi
NATURE.glowcap = {
  draw: p => {
    const Gl = RAMP.glow;
    const stem = rp('#3a6a64', '#6aa49a', '#9cd2c4', '#c8f0e4', '#e8fff8', '#ffffff');
    // small one behind
    p.tube([[17.2, 20.8], [17.4, 15.4]], 1.1, stem, { cap: 'flat' });
    p.ball(17.4, 15.4, 3.8, 3, Gl, { clip: (x, y) => y + 0.5 <= 15.6, lift: 0.4 });
    p.rect(14, 15, 7, 1, Gl[1]);
    // big one
    p.tube([[9.6, 21.4], [10, 11.8]], 1.8, stem, { cap: 'flat' });
    p.ball(10, 11.4, 7.8, 6.4, Gl, { clip: (x, y) => y + 0.5 <= 11.8, lift: 0.4 });
    p.rect(3, 11, 14, 1, Gl[1]);
    p.pts([[4, 11], [15, 11], [16, 11]], Gl[0]);
    for (let x = 5; x <= 14; x += 2) p.px(x, 12, Gl[2]);
    // pale spots
    p.pts([[7, 7], [8, 6], [11, 5], [13, 8], [6, 9], [16, 13]], stem[4]);
    p.pts([[7, 6], [11, 4]], H('#ffffff'));
    // moss at the foot
    p.ball(12, 21.4, 6.8, 1.6, RAMP.leaf, { spec: 1 });
  },
  post: p => {
    halo(p, 10, 9, 11.5, '#6ff0e0', 70);
    sparkle(p, 20, 6, '#b8fff0');
    sparkle(p, 3, 16, '#b8fff0');
  },
};

NATURE.bracket = {
  draw: p => {
    const barkR = rp('#140a06', '#28150c', '#3e2414', '#58361e', '#744a28', '#946434');
    p.slab(p.maskBox(1, 1, 5, 22, 1), barkR, 2, { tex: (x, y) => ((y + x * 3) % 4 === 0 ? -1 : hash(x, y, 3) > 0.8 ? 1 : 0) });
    const Br = rp('#2a1408', '#522a10', '#80461a', '#ac6a28', '#d4983e', '#f2cc72');
    const shelf = (cy: number, r: number, seed: number) => {
      // a woody half-disc seen from a little above: banded top, pale growing rim, dark underside
      const top = p.maskFn((x, y) => { const dx = x + 0.5 - 5, dy = (y + 0.5 - cy) / (r * 0.5); return dx >= 0 && dx * dx / (r * r) + dy * dy <= 1 && y + 0.5 <= cy + 0.4; });
      const rim = p.maskFn((x, y) => { const dx = x + 0.5 - 5, dy = (y + 0.5 - cy - 1.4) / (r * 0.5); return dx >= 0 && dx * dx / (r * r) + dy * dy <= 1 && y + 0.5 > cy - 0.2 && y + 0.5 <= cy + 1.9; });
      p.fill(rim, (x, y) => (y + 0.5 > cy + 1.2 ? Br[1] : H('#efe0bc')));
      p.fill(top, (x, y) => {
        const dx = x + 0.5 - 5, dy = (y + 0.5 - cy) / (r * 0.5);
        const d = Math.sqrt(dx * dx / (r * r) + dy * dy);
        if (d > 0.9) return H('#e6d2a4');
        const band = Math.floor(d * 5 + hash(Math.floor(dx / 2), seed, 1) * 0.35) % 2;
        return Br[Math.min(4, (band ? 2 : 3) + (dy < -0.35 ? 1 : 0))];
      });
      p.drop(Pen.or(top, rim), -0.45, 0, 1);
    };
    shelf(7, 11.6, 1);
    shelf(12.4, 10.4, 2);
    shelf(18.2, 8.4, 3);
  },
};

NATURE.inkcap = {
  draw: p => {
    const V = RAMP.violet;
    p.tube([[11.8, 22], [12, 11]], 1.5, RAMP.cream, { cap: 'flat' });
    p.ball(12, 9.6, 6.2, 8.2, V, { clip: (x, y) => y + 0.5 <= 13.6 && y >= 1.2, spec: 0.97 });
    // fine vertical striations
    p.fill(p.maskEllipse(12, 9.6, 6.2, 8.2), (x, y) => (y >= 3 && y <= 13 && x % 2 === 0 && x > 7 && x < 17 && hash(x, y >> 1, 3) > 0.35 ? tone(p.get(x, y), -0.18) : -1));
    // the rim melting into ink
    for (let x = 6; x <= 17; x++) {
      const n = Math.floor(hash(x, 4, 9) * 3.2);
      for (let k = 0; k < n; k++) p.px(x, 14 + k, k === n - 1 ? V[0] : V[1]);
      p.px(x, 13, V[1]);
    }
    p.ball(12, 22.3, 5, 1.1, rp('#0e0618', '#1c0c30', '#2c1648', '#442466', '#5e3486', '#8e62b8'), { spec: 1, lift: -0.4 });
  },
  post: p => {
    p.blend(8, 19, H('#43287a', 220));
    p.blend(15, 18, H('#43287a', 200));
    p.blend(15, 19, H('#43287a', 120));
  },
};

// ================================================================ insects
NATURE.lanternbeetle = {
  draw: p => {
    const f = frame(18.5, 18.5, 5, 5); // tail (bottom-right) -> head (top-left)
    const El = rp('#070a16', '#0f1a34', '#1a2e58', '#284a84', '#4474b4', '#9cc8ec');
    // legs + antennae first
    for (const [u, s] of [[7, 1], [10, 1], [13, 1], [7, -1], [10, -1], [13, -1]] as Pt[]) {
      const [x0, y0] = f.at(u, s * 3.2), [x1, y1] = f.at(u + (u - 10) * 0.35 - 0.8, s * 6.2), [x2, y2] = f.at(u + (u - 10) * 0.7 - 2.2, s * 7);
      p.line(x0, y0, x1, y1, RAMP.iron[2]); p.line(x1, y1, x2, y2, RAMP.iron[1]);
    }
    for (const s of [-1, 1]) { const [x0, y0] = f.at(17, s * 1), [x1, y1] = f.at(19.5, s * 3.4); p.line(x0, y0, x1, y1, RAMP.iron[3]); }
    // glowing lantern at the tail
    const [lx, ly] = f.at(2.6, 0);
    p.ball(lx, ly, 3.4, 3.4, rp('#6a8a1a', '#a8c828', '#d8f050', '#f4ff90', '#fcffd0', '#ffffff'), { lift: 1.2, spec: 0.9 });
    // wing cases, pronotum, head
    const [ex, ey] = f.at(8.4, 0);
    const el = p.ball(ex, ey, 6.2, 4.6, El, { ang: Math.atan2(f.uy, f.ux), spec: 0.93, k: 1.15 });
    p.fill(el, (x, y) => (Math.abs(f.loc(x, y)[1]) < 0.5 ? El[0] : -1));
    const [px2, py2] = f.at(14.4, 0);
    p.ball(px2, py2, 2.4, 3.5, El, { ang: Math.atan2(f.uy, f.ux), spec: 0.9, lift: 0.4 });
    const [hx, hy] = f.at(17.2, 0);
    p.ball(hx, hy, 1.6, 2.1, RAMP.iron, { ang: Math.atan2(f.uy, f.ux), lift: 1 });
  },
  post: p => {
    halo(p, 19, 19, 7.5, '#d8ff70', 120);
  },
};

NATURE.weta = {
  draw: p => {
    const Wt = rp('#1a0a06', '#3c1a0c', '#662e12', '#94481a', '#c26c2a', '#e8a052');
    const rows = [
      '....................ss..',
      '...................fff..',
      '..................fffs..',
      '.................fffs...',
      '................ffff....',
      '...............ffff.....',
      '..............ffff......',
      '...........aaaaff.......',
      '.......ppppaaaaaaaa.....',
      '.....hhpppppaaaaaaaaa...',
      '...hhhhpppppaaaaaaaaaa..',
      '..hhhhhppppppaaaaaaaaa..',
      '..hhhhhppppppaaaaaaaaa..',
      '..hhhhhppppppaaaaaaaa...',
      '...hhhh.pppp.aaaaaaa....',
    ];
    const oy = 4;
    for (const pts of [[[5, 17], [3.6, 20], [2.8, 22.4]], [[9.5, 18], [8.6, 21], [6.4, 22.6]], [[13.5, 18], [14.4, 21], [16.6, 22.4]]] as Pt[][]) p.tube(pts, 0.6, Wt, { lift: 0.3 });
    p.puff(p.maskMap(rows, 'f', 0, oy), Wt, { r: 1.8, spec: 0.95, lift: 0.3 });
    p.tube([[21.4, 6], [22.4, 13], [21.4, 22.6]], 0.7, Wt, { lift: 0.5 });
    p.pts([[23, 9], [23, 13], [23, 17]], RAMP.cream[4]);
    p.fill(p.maskMap(rows, 's', 0, oy), RAMP.cream[4]);
    const a = p.maskMap(rows, 'a', 0, oy);
    p.puff(a, Wt, { r: 3, spec: 0.93, lift: 0.2 });
    p.fill(a, (x, y) => (x % 3 === 0 ? tone(p.get(x, y), -0.4) : -1));
    const pr = p.maskMap(rows, 'p', 0, oy);
    p.puff(pr, Wt, { r: 2.5, spec: 0.9, lift: 0.5 });
    p.seam(pr, Wt[1], 8);
    const hd = p.maskMap(rows, 'h', 0, oy);
    p.puff(hd, Wt, { r: 2.5, spec: 0.9, lift: 0.4 });
    p.seam(hd, Wt[1], 8);
    p.px(3, 15, H('#0c0604')); p.px(3, 14, H('#fff0d0'));
    // long pale antennae streaming back
    for (const [x, y] of bez([4, 13], [4, 4], [15, 1.2], 26)) p.px(x, y, RAMP.cream[2]);
    for (const [x, y] of bez([5.4, 13], [8, 6], [18, 4], 24)) p.px(x, y, RAMP.cream[3]);
  },
};

NATURE.skymoth = {
  draw: p => {
    const Or = rp('#3a1606', '#7a3410', '#b86018', '#e0922c', '#f6c060', '#fff0b8');
    const wing = (cx: number, cy: number, rx: number, ry: number, ang: number, eye: boolean) => {
      const m = p.ball(cx, cy, rx, ry, Or, { ang, spec: 1, flat: 0.4 });
      p.fill(m, (x, y) => {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        const d = Math.hypot(u, v);
        if (d > 0.84) return Or[1];
        if (eye) {
          const e = Math.hypot(u - 0.18, v);
          if (e < 0.18) return H('#fffbe8');
          if (e < 0.34) return H('#141018');
          if (e < 0.46) return RAMP.yellow[4];
        }
        return -1;
      });
      return m;
    };
    // hind wings, then forewings with eye-spots
    wing(7.6, 15.6, 5, 3.8, 0.7, false);
    wing(16.4, 15.6, 5, 3.8, -0.7, false);
    wing(6.6, 8.6, 6.4, 4.4, -0.45, true);
    wing(17.4, 8.6, 6.4, 4.4, 0.45 + Math.PI, true);
    // furry body
    p.tube([[12, 5.6], [12, 18.6]], t => (t < 0.3 ? 1.9 : 1.6 - (t - 0.3) * 0.9), rp('#1e0e08', '#3e2012', '#62381c', '#8a5428', '#b07a3c', '#d4a060'), { tex: (x, y) => (y % 2 ? -1 : 0) });
    p.line(11, 5, 8, 1, Or[2]); p.line(12, 5, 15, 1, Or[2]);
    p.pts([[8, 2], [9, 1], [15, 2], [14, 1]], Or[3]);
  },
};

NATURE.mantis = {
  draw: p => {
    const Gm = rp('#103018', '#1d5424', '#357e2c', '#5aa834', '#8ed04a', '#d4f490');
    const rows = [
      '........................',
      '.ee.ee..................',
      '.hhhhh..................',
      '..hhh...................',
      '..fhhf..................',
      '.ff.ttf.................',
      '.f...tt.................',
      '.ff...tt................',
      '..fff..tt...............',
      '....f...tt.......l......',
      '.........tt....ll.......',
      '.........taaaall........',
      '.......laaaaaaaa........',
      '......l.aaaaaaaaa.......',
      '.....l..aaaaaaaaaa......',
      '.....l...aaaaaaaaaa.....',
      '.........aaaaaaaaaaa....',
      '..........aaaaaaaaaall..',
      '..........laaaaaaaaa..l.',
      '.........l..aaaaaaaa....',
      '.........l...aaaaaaa....',
      '..............aaaaa.....',
      '................aaa.....',
    ];
    p.fill(p.maskMap(rows, 'l'), Gm[2]);
    const a = p.maskMap(rows, 'a');
    p.puff(a, Gm, { r: 3, spec: 1 });
    // midrib + side veins: it looks exactly like a leaflet
    p.fill(a, (x, y) => {
      const d = (x - 10) - (y - 11) * 0.72;
      if (Math.abs(d) < 0.6) return Gm[5];
      const side = ((((x + y) - 21) % 3) + 3) % 3 === 0;
      return side && Math.abs(d) < 3.5 ? (d < 0 ? Gm[4] : Gm[3]) : -1;
    });
    p.puff(p.maskMap(rows, 't'), Gm, { r: 1, lift: 0.3 });
    p.puff(p.maskMap(rows, 'f'), Gm, { r: 1, lift: 0.6 });
    p.puff(p.maskMap(rows, 'h'), Gm, { r: 1.5, lift: 0.3 });
    p.fill(p.maskMap(rows, 'e'), (x) => (x === 1 || x === 4 ? H('#f6f0a0') : H('#141a08')));
  },
};

NATURE.dragonfly = {
  draw: p => {
    const f = frame(2.4, 21.6, 18.6, 5.4); // tail -> head
    const wingM = (u: number, side: number, len: number, back: number) => {
      const [bx, by] = f.at(u, 0);
      const a = Math.atan2(f.uy, f.ux) + side * (Math.PI / 2 - back);
      const cx = bx + Math.cos(a) * len * 0.55, cy = by + Math.sin(a) * len * 0.55;
      const m = p.maskEllipse(cx, cy, len * 0.55, 1.6, a);
      p.fill(m, (x, y) => {
        const edge = !p.at(m, x, y - 1) || !p.at(m, x - 1, y) || !p.at(m, x + 1, y) || !p.at(m, x, y + 1);
        const tip = Math.hypot(x + 0.5 - (bx + Math.cos(a) * len * 0.95), y + 0.5 - (by + Math.sin(a) * len * 0.95)) < 1.2;
        if (tip) return H('#28283a');
        return edge ? H('#e8f6ff', 235) : (x + y) % 3 === 0 ? H('#cfe8f8', 190) : H('#b6d8f0', 120);
      });
    };
    wingM(12.2, 1, 9.6, 0.25); wingM(12.2, -1, 9.6, 0.25);
    wingM(14.4, 1, 9, -0.12); wingM(14.4, -1, 9, -0.12);
    // segmented metallic abdomen, thorax, big eyes
    const ab = p.tube([f.at(0, 0), f.at(12.4, 0)], t => 0.8 + t * 0.35, RAMP.blue, { spec: 0.95, lift: 0.5 });
    p.fill(ab, (x, y) => (Math.round(f.loc(x, y)[0]) % 3 === 0 ? RAMP.navy[1] : -1));
    p.ball(...f.at(14.2, 0), 2.2, 1.8, RAMP.teal, { ang: Math.atan2(f.uy, f.ux), spec: 0.93 });
    for (const s of [-1, 1]) p.ball(...f.at(17.2, s * 1.3), 1.6, 1.6, RAMP.teal, { spec: 0.9, lift: 1 });
  },
};

NATURE.grub = {
  draw: p => {
    const Cr = rp('#6a5234', '#a88c60', '#d2ba8a', '#ecdcb0', '#fbf2d6', '#ffffff');
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI * (0.05 + i / 20 * 1.35); pts.push([12 + Math.cos(a) * 6.4, 11 + Math.sin(a) * 6.6]); }
    const m = p.tube(pts, t => 2.2 + Math.sin(Math.min(1, t * 1.1) * Math.PI) * 1.8, Cr, { spec: 0.96 });
    // segment creases
    p.fill(m, (x, y) => {
      const a = Math.atan2(y + 0.5 - 11, x + 0.5 - 12);
      const k = ((a / Math.PI - 0.05) / 1.35) * 20;
      return Math.abs(k - Math.round(k / 2) * 2) < 0.28 ? Cr[1] : -1;
    });
    // head with mandibles and little legs
    const [hx, hy] = pts[0];
    p.ball(hx - 0.2, hy - 0.4, 2.3, 2.1, RAMP.orange, { lift: -0.8, spec: 0.94 });
    p.pts([[hx + 1, hy + 1], [hx + 2, hy]], RAMP.iron[1]);
    for (const i of [2, 3, 4]) { const [x, y] = pts[i]; p.px(x - 2, y + 1, RAMP.orange[2]); }
  },
};

// ================================================================ animal samples
NATURE.furtuft = {
  draw: p => {
    // cool grey-brown burrower's fur (reads against the warm leather tiles)
    const Fu = rp('#1e1812', '#3c3026', '#5e4c3c', '#86705a', '#b09a82', '#dccab0');
    // a tuft snagged on a thorn and hanging down in a ragged tassel of wavy hairs
    const top = 6.4;
    const tuft = p.maskFn((x, y) => {
      const t = (y + 0.5 - top) / 15.6;
      if (t < 0 || t > 1) return false;
      const cx = 11.4 + Math.sin(t * 3.2) * 1.4 + t * 1.6;
      const w = 2.2 + t * 4.6 - (t > 0.8 ? (t - 0.8) * 8 : 0);
      if (Math.abs(x + 0.5 - cx) > w) return false;
      const strand = Math.floor((x + 0.5 - cx + 10) / 1.5);
      const len = 0.82 + hash(strand, 3, 5) * 0.2;
      return t <= len;
    });
    p.puff(tuft, Fu, { r: 3, lift: 0.3, spec: 1 });
    p.fill(tuft, (x, y) => {
      const t = (y + 0.5 - top) / 15.6;
      const cx = 11.4 + Math.sin(t * 3.2) * 1.4 + t * 1.6;
      const s = Math.floor((x + 0.5 - cx + 10) / 1.5);
      return s % 3 === 0 ? tone(p.get(x, y), -0.28) : s % 3 === 1 && y % 4 === 0 ? tone(p.get(x, y), 0.15) : -1;
    });
    // a few loose hairs drifting off
    for (const [x, y] of bez([16, 15], [19, 17], [21, 21], 8)) p.px(x, y, Fu[3]);
    for (const [x, y] of bez([7, 13], [4, 15], [3, 19], 8)) p.px(x, y, Fu[4]);
    // the thorny twig it hangs from
    const tw = p.tube([[2.2, 7.6], [21.4, 4.4]], t => 1.45 - t * 0.5, RAMP.briar, { spec: 1 });
    p.drop(tw, -0.35, 0, 1);
    for (const [x, y, dx, dy] of [[5, 7, -1, -2], [16, 5, 1, -2], [20, 4, 1, 2]] as number[][]) { p.px(x + dx * 0.5, y + dy * 0.5, RAMP.briar[3]); p.px(x + dx, y + dy, RAMP.briar[4]); }
  },
};

NATURE.feather = {
  draw: p => {
    const c = curve(bez([2.4, 21.8], [8.6, 12.4], [21.8, 2.2], 30));
    const Wh = rp('#4a4034', '#7c6e5c', '#a89a84', '#d6ccb6', '#f0eadc', '#ffffff');
    const Bn = rp('#1e120a', '#3a2414', '#5a3a20', '#7c5430', '#9e7244', '#c49a66');
    // a stiff flight feather: narrow leading vane, broad trailing vane, barred brown and white
    const vane = p.maskFn((x, y) => {
      const { t, v } = c.loc(x, y);
      const s = (t - 0.13) / 0.87;
      if (s < 0 || s > 1) return false;
      const w = Math.sin(Math.min(1, s * 1.35 + 0.12) * Math.PI * 0.5) * (1 - s ** 3);
      const split = s > 0.44 && s < 0.5 && v > 1.4;
      return !split && (v < 0 ? -v <= w * 2.4 + 0.4 : v <= w * 5 + 0.4);
    });
    p.fill(vane, (x, y) => {
      const { u, v } = c.loc(x, y);
      const bar = (((u - v * 0.65) / 2.5) % 2 + 2) % 2 < 1.15;
      const Rm = bar ? Bn : Wh;
      const lo = !p.at(vane, x + 1, y + 1) || !p.at(vane, x + 1, y) || !p.at(vane, x, y + 1);
      const barb = ((Math.round(u * 1.3 + v * 1.3) % 3) + 3) % 3 === 0;
      return Rm[lo ? 2 : v < 0 ? (barb ? 3 : 4) : barb ? 2 : 3];
    });
    for (let i = 0; i <= 60; i++) { const q = c.at(i / 60 * 0.97); p.px(q.x, q.y, i < 9 ? RAMP.cream[3] : RAMP.cream[5]); }
  },
};

NATURE.scale = {
  draw: p => {
    const Sc = rp('#161a0e', '#2a321c', '#46502e', '#687646', '#92a066', '#c6d29a');
    // one big keeled scale, pointing up: a rounded shield with a raised keel and a pale translucent rim
    const f = frame(12, 22, 12, 1.4);
    const m = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < 0 || t > 1) return false; const w = (t < 0.42 ? Math.sqrt(1 - ((0.42 - t) / 0.42) ** 2) : ((1 - t) / 0.58) ** 0.72) * 8.4; return Math.abs(v) <= w; });
    p.puff(m, Sc, { r: 3.6, spec: 1, tex: (x, y) => (hash(x, y, 5) > 0.84 ? -1 : 0) });
    p.fill(m, (x, y) => {
      const [u, v] = f.loc(x, y);
      const t = u / f.len;
      const w = (t < 0.42 ? Math.sqrt(Math.max(0, 1 - ((0.42 - t) / 0.42) ** 2)) : ((1 - t) / 0.58) ** 0.72) * 8.4;
      if (Math.abs(v) > w - 1.1) return alpha(RAMP.cream[v < 0 ? 4 : 3], 200);
      if (u > 2 && u < f.len - 2.5) { if (v > -0.8 && v <= 0.2) return Sc[5]; if (v > 0.2 && v < 1.2) return Sc[1]; }
      // iridescent sheen of a fresh shed
      if (v < -2 && v > -4 && t > 0.25 && t < 0.6) return (x + y) % 2 ? H('#8ab4a0') : H('#a8a0c8');
      return -1;
    });
  },
};

NATURE.shedskin = {
  draw: p => {
    const Sk = rp('#5e5646', '#8e836a', '#bcb194', '#e0d8bc', '#f4f0e0', '#ffffff');
    const pts: Pt[] = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([3.6 + t * 18, 10.6 + Math.sin(t * Math.PI * 1.6 + 0.35) * 6.2 - t * 0.6]); }
    const m = p.tube(pts, t => (t < 0.1 ? 2.6 + t * 6 : 3.2 - t * 1.9 + Math.sin(t * 40) * 0.35), Sk, { spec: 1, flat: 0.35, lift: 0.4 });
    // papery skin with a crisp diamond scale lattice, crumpled here and there
    p.fill(m, (x, y) => ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0 ? tone(p.get(x, y), -0.32) : hash(x, y, 4) > 0.9 ? Sk[5] : -1));
    // the torn tail end
    p.clear(21, 17); p.clear(22, 16); p.clear(22, 17);
  },
};

NATURE.dropping = {
  draw: p => {
    const Po = RAMP.poo;
    const a = p.ball(11.6, 17.2, 7.8, 3.8, Po, { spec: 0.94, lift: 0.3 });
    const b = p.ball(12.4, 12.4, 5.4, 3.2, Po, { spec: 0.93, lift: 0.3 });
    p.drop(b, -0.3, 0, 1);
    const c = p.ball(12.8, 8.6, 3, 2.2, Po, { spec: 0.93, lift: 0.4 });
    p.drop(c, -0.3, 0, 1);
    p.px(14, 6, Po[3]); p.px(14, 5, Po[4]);
    // undigested bits: serpent scales and a broken fang
    p.pts([[6, 17], [7, 16], [16, 13], [17, 18]], H('#a8b48c'));
    p.pts([[8, 12], [9, 13], [9, 14]], H('#f4f0e2')); p.px(9, 15, H('#c8c0a8'));
    void a;
  },
  post: p => {
    wisp(p, 4, 12, 5, '#a8c868', 150);
    wisp(p, 20, 11, 4, '#a8c868', 130, -1);
    // a fly
    p.blend(19, 4, H('#141618', 240)); p.blend(18, 3, H('#dfefff', 170)); p.blend(20, 3, H('#dfefff', 170));
  },
};

NATURE.quill = {
  draw: p => {
    const f = frame(2.4, 21.6, 21.8, 2.2);
    const Bk = rp('#050506', '#0e0e12', '#1c1a1e', '#2e2a2e', '#4a4448', '#8a8288');
    const Cm = rp('#5a4a30', '#8c7a58', '#bcaa84', '#e2d4ae', '#f6eed2', '#ffffff');
    const m = p.tube([f.at(0, 0), f.at(f.len, 0)], t => (t < 0.08 ? 0.9 + t * 8 : 1.6 * (1 - ((t - 0.08) / 0.92) ** 1.4) + 0.25), Cm, { spec: 0.96 });
    p.fill(m, (x, y) => {
      const u = f.loc(x, y)[0] / f.len;
      if (u < 0.12 || u > 0.93) return u > 0.93 ? Bk[3] : -1;
      const band = Math.floor((u - 0.12) * 7.5) % 2 === 0;
      if (!band) return -1;
      const c = p.get(x, y);
      return Bk[Math.max(0, Cm.indexOf(c) - 1)] ?? Bk[2];
    });
    // backward barbs near the tip
    for (const u of [0.8, 0.86]) { const [x, y] = f.at(u * f.len, 1.3); p.px(x, y, Bk[4]); }
  },
};

NATURE.bone = {
  draw: p => {
    const Bo = RAMP.bone;
    const rows = [
      '..........ss............',
      '.........ssss...........',
      '.........ssss...........',
      '.........ssss...........',
      '........ssssss..........',
      '...zz..ssssssss..zz.....',
      '..zzzzaaaaaaaaaazzzz....',
      '.zzzzzaaaaaaaaaazzzzz...',
      '.zzzzzzaaa..aaazzzzzz...',
      '..zzz.aaa....aaa.zzz....',
      '.....aaa......aaa.......',
      '.....ccccccccccccc......',
      '....ccccccccccccccc.....',
      '...ccccccccccccccccc....',
      '...ccccccccccccccccc....',
      '...ccccccccccccccccc....',
      '...ccccccccccccccccc....',
      '....ccccccccccccccc.....',
      '.....ccccccccccccc......',
    ];
    const ox = 1, oy = 2;
    p.puff(p.maskMap(rows, 's', ox, oy), Bo, { r: 2, spec: 1 });
    p.puff(p.maskMap(rows, 'z', ox, oy), Bo, { r: 2, spec: 1, lift: -0.3 });
    p.puff(p.maskMap(rows, 'a', ox, oy), Bo, { r: 1.6, spec: 1 });
    const c = p.maskMap(rows, 'c', ox, oy);
    p.puff(c, Bo, { r: 4.5, spec: 0.98 });
    // articular face of the centrum, a crushing crack and fang punctures
    p.fill(p.maskEllipse(11.5 + ox, 15.2 + oy, 5.2, 2.8), (x, y) => (Math.hypot((x + 0.5 - 12.5) / 5.2, (y + 0.5 - 17.2) / 2.8) > 0.72 ? Bo[2] : -1));
    p.line(8, 14, 11, 18, Bo[1]); p.line(11, 18, 12, 20, Bo[0]);
    p.pts([[16, 15], [18, 17], [6, 10]], RAMP.brownstone[0]);
  },
};

NATURE.eggshell = {
  draw: p => {
    const Eg = rp('#5a4630', '#94795a', '#c4ab84', '#e6d4ae', '#f8f0d8', '#fffcf2');
    const zig = (x: number) => 9.5 + [0, -2, 1, -1.5, 1.5, -1, 0.5, -2][x % 8];
    const shell = p.maskFn((x, y) => Math.hypot((x + 0.5 - 10.5) / 7.6, (y + 0.5 - 12.6) / 8.6) <= 1 && y + 0.5 >= zig(x));
    p.puff(shell, Eg, { r: 5, spec: 0.97 });
    // the inside of the shell seen through the broken top
    const inner = p.maskFn((x, y) => Math.hypot((x + 0.5 - 10.8) / 5.6, (y + 0.5 - zig(x) - 1.6) / 1.9) <= 1 && p.has(x, y));
    p.fill(inner, (x, y) => (x < 10 ? Eg[2] : Eg[3]));
    // gold speckles
    for (let i = 0; i < 16; i++) { const x = 4 + hash(i, 1, 2) * 14, y = 12 + hash(i, 2, 2) * 8; if (p.at(shell, Math.floor(x), Math.floor(y)) && !p.at(inner, Math.floor(x), Math.floor(y))) p.px(x, y, i % 3 ? RAMP.yellow[3] : RAMP.yellow[2]); }
    // a loose fragment
    const fr = p.maskPoly([17, 3, 22, 4, 21.5, 8, 17.5, 7.5]);
    p.puff(fr, Eg, { r: 2 });
    p.px(19, 5, RAMP.yellow[3]);
  },
};

NATURE.plate = {
  draw: p => {
    const Pl = rp('#3a2c1e', '#6a543a', '#9a8260', '#c4ae86', '#e2d2ae', '#faf2da');
    const pts: number[] = [];
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 7; const r = 9.4 + (i % 2) * 0.8; pts.push(12 + Math.cos(a) * r, 12 + Math.sin(a) * r * 0.92); }
    const m = p.maskPoly(pts);
    p.puff(m, Pl, { r: 5, spec: 1, tex: (x, y) => (hash(x, y, 3) > 0.82 ? -1 : 0) });
    // raised keel boss + pits
    p.ball(12, 12, 3.4, 3, Pl, { lift: 0.6, spec: 0.96 });
    for (let i = 0; i < 14; i++) { const x = 4 + hash(i, 5, 1) * 16, y = 4 + hash(i, 6, 1) * 16; if (p.at(m, Math.floor(x), Math.floor(y)) && Math.hypot(x - 12, y - 12) > 4) p.px(x, y, Pl[1]); }
    // fang scratches that failed to pierce it
    p.line(5, 9, 9, 6, RAMP.brownstone[0]); p.line(6, 10, 10, 7, Pl[4]);
    p.line(14, 18, 18, 14, RAMP.brownstone[0]); p.line(15, 18, 18, 15, Pl[4]);
  },
};
