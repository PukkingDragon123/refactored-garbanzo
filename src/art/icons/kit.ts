// Crafted lures and food icons.

import { Pen, RAMP, H, rp, hash, alpha, tone, IconSet, Pt } from './pen';
import { frame, ring, lens, halo, sparkle, wisp, curve, bez } from './parts';

export const KIT: IconSet = {};

const TERRA = rp('#34120a', '#662610', '#9a421c', '#c4662e', '#e6955a', '#fcc890');
const ENAMEL = rp('#0c1a3c', '#16306c', '#2450a0', '#3c78c8', '#7cb0e6', '#d0ecff');
const WHITE = rp('#5a5e6a', '#8e949c', '#bcc2c6', '#e0e4e4', '#f6f8f4', '#ffffff');

// ================================================================ lures
KIT.fruitlure = {
  draw: p => {
    // mashed moonfruit wrapped in a big leaf, tied with twine
    const f = frame(4, 20, 20, 5);
    const par = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < 0 || t > 1) return false; const w = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7 * 7; return Math.abs(v) <= w; });
    p.puff(par, RAMP.leaf, { r: 4, spec: 0.97 });
    p.fill(par, (x, y) => {
      const [u, v] = f.loc(x, y);
      if (Math.abs(v) < 0.5 && u > 2) return RAMP.leaf[5];
      const vein = Math.abs((((u * 0.9 + Math.abs(v) * 0.8) % 3.4) + 3.4) % 3.4 - 1.7) < 0.4 && Math.abs(v) > 1 && Math.abs(v) < 5.5;
      return vein ? RAMP.leaf[v < 0 ? 4 : 3] : v > 0 ? tone(p.get(x, y), -0.18) : -1;
    });
    // the pale mash squeezing out of the fold
    const mash = p.ball(7.6, 10.4, 3.6, 2.6, RAMP.moon, { ang: -0.6, spec: 0.93, lift: 0.4 });
    p.drop(mash, -0.3);
    // twine
    for (const u0 of [7.2, 13.4]) p.fill(par, (x, y) => (Math.abs(f.loc(x, y)[0] - u0) < 0.55 ? (f.loc(x, y)[1] < 0 ? RAMP.khaki[4] : RAMP.khaki[2]) : -1));
    const [kx, ky] = f.at(13.4, -6.6);
    p.pts([[kx, ky], [kx - 1, ky - 1], [kx + 1, ky - 1]], RAMP.khaki[4]);
  },
};

KIT.grublure = {
  draw: p => {
    // terracotta pot: belly, band, rim and a dark mouth full of grubs
    p.ball(12, 15.4, 8.2, 7, TERRA, { clip: (x, y) => y >= 9, spec: 0.97 });
    p.fill(p.maskBox(4, 14, 16, 2), (x, y) => (p.has(x, y) ? (x % 3 === 0 ? TERRA[4] : TERRA[1]) : -1));
    const rim = p.maskEllipse(12, 8.8, 7.6, 2.4);
    p.fill(rim, (x, y) => (Math.hypot((x + 0.5 - 12) / 7.6, (y + 0.5 - 8.8) / 2.4) > 0.66 ? (y + 0.5 < 8.8 ? TERRA[4] : TERRA[3]) : H('#1c0c06')));
    const Cr = rp('#6a5234', '#a88c60', '#d2ba8a', '#ecdcb0', '#fbf2d6', '#ffffff');
    const grub = (pts: Pt[]) => {
      const m = p.tube(pts, t => 1.5 - t * 0.35, Cr, { spec: 0.95 });
      const c = curve(pts);
      p.fill(m, (x, y) => (Math.round(c.loc(x, y).u) % 2 === 0 ? Cr[2] : -1));
      const [hx, hy] = pts[pts.length - 1];
      p.ball(hx, hy, 1.2, 1.2, RAMP.orange, { lift: -0.5 });
    };
    grub([[9, 9.6], [8, 6], [6, 4.2], [4.2, 4.8]]);
    grub([[13.4, 9.4], [14.6, 5.4], [17.2, 3.6], [19, 5.2]]);
    grub([[11.4, 9.4], [11.4, 6.2], [12.2, 3.4]]);
  },
};

KIT.fishbait = {
  draw: p => {
    const Fs = rp('#141e2e', '#2a3c52', '#4c6480', '#7c96ae', '#b4c8d6', '#f0f8fc');
    // tail piece
    const tail = p.maskPoly([14, 17, 22.5, 13.5, 21, 18.5, 22.5, 22.5]);
    p.puff(tail, Fs, { r: 2 });
    p.fill(tail, (x, y) => ((x + y) % 2 === 0 && x > 16 ? Fs[2] : -1));
    // the head end: silver, a big eye, gill cover, pink cut face with the backbone
    const f = frame(15, 14, 3, 5);
    const head = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); const t = u / f.len; if (t < 0 || t > 1) return false; const w = (t < 0.2 ? 5 : 5 * (1 - ((t - 0.2) / 0.8) ** 1.8)) + 0.4; return Math.abs(v) <= w; });
    p.puff(head, Fs, { r: 3.5, spec: 0.93 });
    p.fill(head, (x, y) => { const [u, v] = f.loc(x, y); return v > 2.2 && u > 2 ? Fs[4] : -1; });
    const [gx, gy] = f.at(6.2, 0);
    for (let k = -4; k <= 3; k++) { const [x, y] = [gx + f.nx * k + f.ux * Math.abs(k) * 0.25, gy + f.ny * k + f.uy * Math.abs(k) * 0.25]; if (p.has(x, y)) p.px(x, y, Fs[1]); }
    const [ex, ey] = f.at(9.6, -1.2);
    p.ball(ex, ey, 1.7, 1.7, rp('#040406', '#0c0c10', '#18181e', '#28282e', '#3a3a42', '#ffffff'), { spec: 0.8 });
    p.px(ex - 1, ey - 1, H('#ffffff'));
    const cut = p.maskFn((x, y) => { const [u, v] = f.loc(x, y); return u >= -0.6 && u < 1.2 && Math.abs(v) <= 5; });
    p.fill(cut, (x, y) => { const [, v] = f.loc(x, y); return Math.abs(v) < 0.9 ? H('#f4ece0') : v < 0 ? RAMP.pink[3] : RAMP.pink[2]; });
  },
  post: p => {
    wisp(p, 5, 20, 5, '#b8d070', 170);
    wisp(p, 9, 21, 4, '#b8d070', 140, -1);
  },
};

KIT.scentlure = {
  draw: p => {
    const G = RAMP.glass;
    // round-bottomed flask of musk: dark liquid, glassy highlights, cork and a tied cord
    const bulb = p.maskDisc(12, 15.2, 6.8);
    p.fill(bulb, (x, y) => {
      const dx = x + 0.5 - 12, dy = y + 0.5 - 15.2, d = Math.hypot(dx, dy) / 6.8;
      if (y + 0.5 > 12.6) {
        const Mk = rp('#12060e', '#2a0e24', '#44183c', '#62245a', '#8a3a7c', '#c070a8');
        return Mk[Math.max(0, Math.min(4, Math.round(3 - (dx + dy) / 6 - d * 1.2)))];
      }
      return alpha(d > 0.8 ? G[2] : G[4], 150);
    });
    p.rect(8, 12, 9, 1, RAMP.violet[4]);
    p.fill(p.maskBox(10, 5, 5, 4), (x) => alpha(x < 11 ? G[4] : G[2], 170));
    p.slab(p.maskBox(9, 1, 7, 5, 1), RAMP.pale, 3, { tex: (x, y) => (hash(x, y, 3) > 0.7 ? -1 : 0) });
    p.rect(9, 6, 7, 1, RAMP.khaki[4]); p.rect(9, 7, 7, 1, RAMP.khaki[2]);
    p.px(16, 7, RAMP.khaki[3]); p.px(17, 8, RAMP.khaki[3]); p.px(17, 9, RAMP.khaki[4]);
    // glass glints
    p.pts([[8, 13], [7, 14], [7, 15], [11, 6], [11, 7]], H('#ffffff', 235));
    p.px(16, 18, H('#e8c0f0'));
  },
  post: p => {
    wisp(p, 4, 12, 5, '#c890e8', 160);
    wisp(p, 20, 11, 5, '#c890e8', 140, -1);
  },
};

KIT.glowlure = {
  draw: p => {
    // a ball of kauri resin with glowcaps set inside it
    const m = p.ball(12, 12.6, 8, 7.8, RAMP.amber, { spec: 0.95, lift: 0.3 });
    const cap = (cx: number, cy: number, r: number) => {
      p.fill(p.maskBox(Math.round(cx - 0.5), Math.round(cy), 1, Math.round(r * 1.6)), H('#dafff4'));
      p.ball(cx, cy + 0.3, r, r * 0.8, RAMP.glow, { clip: (x, y) => y + 0.5 <= cy + 0.4, lift: 1.4, spec: 0.9 });
    };
    cap(9.4, 11.4, 2.6);
    cap(14, 13.6, 2);
    cap(11.8, 16.4, 1.6);
    p.pts([[6, 7], [7, 6]], H('#fffbe6'));
    void m;
  },
  post: p => {
    halo(p, 12, 12.6, 11.5, '#80f0d8', 80);
    sparkle(p, 20, 4, '#b8fff0');
  },
};

KIT.caller = {
  draw: p => {
    const Rd = rp('#2e2410', '#5a4a22', '#8a7640', '#b8a466', '#dcd092', '#f6f0c4');
    const f = frame(3.4, 18.4, 18.6, 6.6);
    // reed whistle: mouthpiece cut at an angle, finger holes, node rings, a cord loop
    const m = p.tube([f.at(0, 0), f.at(f.len, 0)], 2.3, Rd, { cap: 'flat', spec: 0.97 });
    p.fill(m, (x, y) => { const [u, v] = f.loc(x, y); if (u < 3.2 && v > u * 0.7 - 1.2) return -1; return Math.abs(u - 9.6) < 0.5 || Math.abs(u - 15.4) < 0.5 ? Rd[1] : -1; });
    { const [wx, wy] = f.at(3.8, -0.6); p.px(wx, wy, H('#1a1208')); p.px(wx + 1, wy, Rd[1]); }
    for (const u of [6.4, 11.8, 13.6]) { const [x, y] = f.at(u, -1); p.px(x, y, RAMP.briar[0]); p.px(x + 1, y + 1, Rd[3]); }
    const [ex, ey] = f.at(f.len, 0);
    ring(p, ex, ey, 0.9, 2.2, Rd, { lift: -1 });
    p.px(ex, ey, H('#1a1208'));
    for (const [x, y] of bez([4, 19.6], [2, 23], [7.6, 22.6], 10)) p.px(x, y, RAMP.red[3]);
    p.ball(7.8, 21.8, 1.2, 1.2, RAMP.jade, { spec: 0.9 });
  },
  post: p => {
    for (const r of [3.2, 5.6]) for (let a = -1.35; a <= 0.2; a += 0.14) p.blend(19.4 + Math.cos(a) * r, 5.8 + Math.sin(a) * r, H('#fff4c8', r < 4 ? 230 : 150));
  },
};

KIT.trap = {
  draw: p => {
    const Cm = rp('#141a0c', '#26301a', '#3c4826', '#566634', '#768848', '#a4b06a');
    // strap round the tree
    p.tube([[1.2, 12.4], [22.8, 12.4]], 1.2, RAMP.rubber, { cap: 'flat', lift: 1 });
    // camo box
    const box = p.maskBox(5, 2, 14, 20, 3);
    p.puff(box, Cm, { r: 3, spec: 1 });
    p.fill(box, (x, y) => { const n = hash(x >> 1, y >> 1, 7); return n > 0.72 ? tone(p.get(x, y), -0.3) : n < 0.16 ? tone(p.get(x, y), 0.25) : -1; });
    // lens, flash, IR sensor window, status LED
    ring(p, 12, 8.2, 2.8, 4.1, RAMP.iron, { lift: 1 });
    lens(p, 12, 8.2, 2.9);
    ring(p, 12, 15.6, 1.4, 2.4, RAMP.iron, { lift: 1 });
    p.fill(p.maskDisc(12, 15.6, 1.45), (x, y) => (x + y < 27 ? RAMP.red[4] : RAMP.red[2]));
    p.slab(p.maskBox(9, 19, 6, 2), WHITE, 3);
    p.px(16, 4, RAMP.red[4]);
  },
};

// ================================================================ food
KIT.ration = {
  draw: p => {
    const Bs = rp('#3e220e', '#6e4220', '#a06a36', '#c8944e', '#e6bc72', '#f8e0a4');
    // a square ship's biscuit: toasted edges, docking holes, a crack
    const side = p.maskBox(3, 5, 18, 17, 3);
    p.fill(side, Bs[1]);
    const top = p.maskBox(3, 3, 18, 17, 3);
    p.slab(top, Bs, 4, { hi: 1, lo: -1, tex: (x, y) => { const e = Math.min(x - 3, 20 - x, y - 3, 19 - y); return e < 2 ? -1 : hash(x, y, 3) > 0.9 ? -1 : 0; } });
    for (let y = 6; y <= 17; y += 3.6) for (let x = 6; x <= 18; x += 3.6) { p.px(x, y, Bs[1]); p.px(x + 1, y + 1, Bs[5]); }
    p.pts([[15, 4], [15, 5], [14, 6], [14, 7], [13, 8]], Bs[1]);
    p.px(22, 20, Bs[3]); p.px(1, 21, Bs[4]);
  },
};

KIT.stew = {
  draw: p => {
    // chipped blue enamel bowl
    p.ball(12, 13.4, 10, 8, ENAMEL, { clip: (x, y) => y >= 12, spec: 0.96 });
    p.fill(p.maskEllipse(12, 13.4, 10, 8), (x, y) => (y >= 12 && hash(x, y, 5) > 0.93 ? WHITE[4] : -1));
    p.fill(p.maskBox(14, 17, 3, 2), (x, y) => (p.has(x, y) ? RAMP.iron[1] : -1));
    // the stew: red-brown broth with chunks, rim of the bowl
    const rim = p.maskEllipse(12, 12, 10, 3.6);
    p.fill(rim, (x, y) => {
      const d = Math.hypot((x + 0.5 - 12) / 10, (y + 0.5 - 12) / 3.6);
      if (d > 0.82) return y + 0.5 < 12 ? ENAMEL[4] : ENAMEL[5];
      return (x + y) % 5 === 0 ? RAMP.red[2] : RAMP.red[3];
    });
    p.pts([[7, 11], [8, 11], [13, 12], [14, 12]], RAMP.orange[4]);
    p.pts([[7, 12], [14, 13]], RAMP.orange[2]);
    p.pts([[10, 10], [11, 10], [16, 11]], RAMP.cream[4]);
    p.pts([[9, 13], [17, 12], [12, 10]], RAMP.lime[4]);
    p.px(16, 10, RAMP.fur[2]); p.px(17, 10, RAMP.fur[3]);
    // a spoon sticking out
    p.tube([[14.6, 11], [20.4, 3.6]], 0.8, RAMP.chrome, { cap: 'flat' });
  },
  post: p => {
    wisp(p, 7, 8, 5, '#ffffff', 170);
    wisp(p, 11, 7, 6, '#ffffff', 150, -1);
    wisp(p, 16, 8, 4, '#ffffff', 120);
  },
};

KIT.tea = {
  draw: p => {
    // white enamel mug with a blue rim, a chip, and a kawakawa leaf floating in the tea
    const hm = Pen.sub(p.maskEllipse(18.4, 13.4, 3.8, 4.4), p.maskEllipse(18.4, 13.4, 2, 2.6));
    p.fill(hm, (x, y) => (y + 0.5 < 13.4 ? WHITE[3] : WHITE[2]));
    const body = p.tube([[10, 8], [10, 20]], 7, WHITE, { cap: 'flat', spec: 0.97 });
    p.fill(body, (x, y) => (y >= 19 ? ENAMEL[x < 10 ? 3 : 2] : -1));
    const top = p.maskEllipse(10, 8, 7, 2.4);
    p.fill(top, (x, y) => {
      const d = Math.hypot((x + 0.5 - 10) / 7, (y + 0.5 - 8) / 2.4);
      if (d > 0.78) return y + 0.5 < 8 ? ENAMEL[4] : ENAMEL[3];
      return y + 0.5 < 7.6 ? H('#5a6a1e') : H('#7a8a2a');
    });
    p.ball(10.6, 7.8, 2.6, 1.2, RAMP.leaf, { ang: -0.3, lift: 0.6, spec: 1 });
    p.px(11, 7, RAMP.leaf[5]);
    p.pts([[5, 13], [5, 14]], RAMP.iron[1]);
  },
  post: p => {
    wisp(p, 8, 5, 5, '#ffffff', 170);
    wisp(p, 12, 4, 4, '#ffffff', 140, -1);
  },
};
