// Tool icons (the tool belt): camera, knife, jars, net, trowel, tweezers, gloves, hammer, headlamp,
// phone, ghillie cape, binoculars.

import { Pen, RAMP, H, rp, hash, alpha, IconSet } from './pen';
import { frame, lens, ring, halo, grain } from './parts';

export const TOOLS: IconSet = {};

TOOLS.camera = {
  draw: p => {
    const I = RAMP.iron, Cr = RAMP.chrome;
    // black leatherette body with a rubber grip bulge on the left
    p.slab(p.maskBox(1, 8, 22, 12, 2), I, 2, { tex: (x, y) => ((x * 5 + y * 3) % 7 === 0 ? -1 : 0) });
    p.slab(p.maskBox(1, 9, 5, 11, 2), RAMP.rubber, 3, { tex: (x, y) => ((x + y * 2) % 4 === 0 ? -1 : 0) });
    // silver top plate, viewfinder hump, dials
    p.slab(p.maskPoly([6.5, 8, 8, 2, 14, 2, 15.5, 8]), Cr, 3);
    p.slab(p.maskBox(1, 6, 22, 3, 1), Cr, 3);
    p.slab(p.maskBox(9, 3, 4, 2), I, 1, { bevel: false });
    p.px(9, 3, I[4]);
    p.slab(p.maskBox(2, 4, 4, 2), Cr, 2, { tex: x => (x % 2 ? 1 : 0) });
    p.slab(p.maskBox(17, 4, 3, 2), RAMP.red, 3);
    p.px(17, 4, RAMP.red[5]);
    // lens: ridged rubber focus ring, silver bezel, glass
    const fr = ring(p, 13.5, 14, 5.4, 7.1, I, { lift: 1 });
    p.fill(fr, (x, y) => ((Math.round(Math.atan2(y + 0.5 - 14, x + 0.5 - 13.5) * 6) & 1) ? -1 : I[1]));
    ring(p, 13.5, 14, 4.2, 5.4, Cr);
    lens(p, 13.5, 14, 4.2);
    p.px(21, 10, RAMP.red[3]);
  },
};

TOOLS.knife = {
  draw: p => {
    const f = frame(3, 21, 21.5, 2.5);
    const S = RAMP.steel;
    // blade: straight spine (lit), curved belly toward the tip
    const blade = p.maskFn((x, y) => {
      const [u, v] = f.loc(x, y);
      if (u < 9.4 || u > f.len) return false;
      const t = (u - 9.4) / (f.len - 9.4);
      const spine = -1.7 + (t > 0.72 ? (t - 0.72) / 0.28 * 1.7 : 0);
      const edge = 2.3 - Math.pow(t, 2.2) * 2.3;
      return v >= spine && v <= edge;
    });
    p.slab(blade, S, 3, { hi: 1, lo: -1 });
    p.fill(blade, (x, y) => {
      const [u, v] = f.loc(x, y);
      const t = (u - 9.4) / (f.len - 9.4);
      const edge = 2.3 - Math.pow(t, 2.2) * 2.3;
      if (v > edge - 1.05) return S[5];
      if (v > edge - 1.9) return S[2];
      if (v < -1.1) return S[4];
      return -1;
    });
    // bolster + red scales with two rivets
    p.tube([f.at(0.8, 0), f.at(8.6, 0)], 2.3, RAMP.red, { cap: 'flat', flat: 0.25 });
    p.tube([f.at(8.3, 0), f.at(10, 0)], 2.35, RAMP.chrome, { cap: 'flat' });
    for (const u of [3.4, 6.6]) { const [x, y] = f.at(u, -0.3); p.px(x, y, RAMP.chrome[4]); p.px(x + 1, y + 1, RAMP.red[1]); }
    const [hx, hy] = f.at(1.6, 0.2);
    p.px(hx, hy, RAMP.red[0]);
  },
};

TOOLS.jar = {
  draw: p => {
    const G = RAMP.glass;
    const body = p.maskBox(4, 8, 16, 14, 3);
    p.fill(body, (x, y) => {
      const t = (x - 4) / 15;
      if (t > 0.86 || y > 19) return alpha(G[1], 200);
      return alpha(t < 0.2 ? G[4] : t < 0.62 ? G[3] : G[2], 120);
    });
    // a fern sprig and a beetle inside
    p.tube([[10.5, 20.5], [11, 16], [12.6, 12.2]], 0.55, RAMP.leaf, { spec: 1 });
    p.ball(9.2, 15.4, 1.9, 1.1, RAMP.lime, { ang: -0.5, spec: 1 });
    p.ball(14.2, 13.4, 1.8, 1.0, RAMP.lime, { ang: 0.6, spec: 1 });
    p.ball(10.2, 18.6, 1.7, 1.0, RAMP.leaf, { ang: -0.3, spec: 1 });
    p.ball(15, 17.6, 1.6, 1.25, RAMP.violet, { spec: 0.9 });
    p.pts([[13, 17], [13, 19], [16, 19], [17, 17]], RAMP.violet[0]);
    // glass highlights and rim
    for (let y = 10; y <= 18; y++) p.px(6, y, alpha(G[5], 235));
    for (let y = 11; y <= 15; y++) p.px(7, y, alpha(G[4], 190));
    for (let y = 10; y <= 19; y++) p.px(17, y, alpha(G[4], 170));
    p.px(17, 10, alpha(G[5], 230));
    for (let x = 6; x <= 17; x++) p.px(x, 21, alpha(G[2], 230));
    for (let x = 6; x <= 17; x++) p.px(x, 8, alpha(G[4], 210));
    // ribbed screw lid
    const lid = p.maskBox(5, 3, 14, 5, 1);
    p.slab(lid, RAMP.brass, 3, { tex: x => (x % 2 ? 0 : -1), hi: 1, lo: -1 });
    for (let x = 6; x <= 17; x++) p.px(x, 3, RAMP.brass[5 - (x % 2)]);
    for (let x = 5; x <= 18; x++) p.px(x, 7, RAMP.brass[1]);
  },
};

TOOLS.net = {
  draw: p => {
    // mesh bag hanging from the hoop
    const hx = 15, hy = 8.5;
    const bag = Pen.or(p.maskEllipse(hx, hy, 6.2, 6.2), p.maskEllipse(17.5, 12.5, 5, 6.5, -0.6));
    p.fill(bag, (x, y) => {
      const line = (x + y) % 3 === 0 || (x - y + 30) % 3 === 0;
      const far = Math.hypot(x + 0.5 - hx, y + 0.5 - hy) > 6.3;
      if (line) return far ? H('#a8b0b0') : (x + y < 22 ? H('#f2f4ee') : H('#c9d0ce'));
      return far ? H('#5a6462', 160) : H('#e8ecea', 70);
    });
    // handle with a cord grip
    p.tube([[2.5, 21.5], [10.4, 13.6]], 1.25, RAMP.pale, { tex: grain(0.7, -0.7, 3) });
    p.tube([[2.2, 21.8], [5.2, 18.8]], 1.45, RAMP.olive, { tex: (x, y) => ((x + y) % 2 ? -1 : 0) });
    // steel hoop
    ring(p, hx, hy, 5.6, 6.8, RAMP.chrome);
  },
};

TOOLS.trowel = {
  draw: p => {
    const f = frame(3, 21, 21.8, 2.2);
    const S = RAMP.steel;
    const blade = p.maskFn((x, y) => {
      const [u, v] = f.loc(x, y);
      if (u < 10.4 || u > f.len) return false;
      const t = (u - 10.4) / (f.len - 10.4);
      const w = t < 0.22 ? 2.6 + (t / 0.22) * 2.4 : 5 * Math.pow(1 - (t - 0.22) / 0.78, 0.85) + 0.2;
      return Math.abs(v) <= w;
    });
    p.slab(blade, S, 3);
    p.fill(blade, (x, y) => {
      const [u, v] = f.loc(x, y);
      if (v > -0.8 && v <= 0) return S[5];
      if (v > 0 && v < 0.9) return S[1];
      if (u > f.len - 1.2) return -1;
      if (v < -3.4) return -1;
      return v < 0 ? S[4] : S[2];
    });
    // soil on the tip
    for (const [u, v] of [[18.8, 1.2], [19.8, 0.4], [18.2, 2.3], [20.8, 1.1], [19.6, -1.3]] as [number, number][]) { const [x, y] = f.at(u, v); p.paint(x, y, RAMP.fur[1]); }
    const [sx, sy] = f.at(19.6, -0.2); p.paint(sx, sy, RAMP.fur[3]);
    // neck, ferrule, handle
    p.tube([f.at(8.4, 0), f.at(11.2, 0)], 1, S);
    p.tube([f.at(6.8, 0), f.at(8.8, 0)], 2, RAMP.brass, { cap: 'flat' });
    p.tube([f.at(0.4, 0), f.at(7, 0)], 1.95, RAMP.wood, { tex: grain(f.ux, f.uy, 5) });
    const [hx, hy] = f.at(1.9, 0);
    p.px(hx, hy, RAMP.wood[0]);
  },
};

TOOLS.tweezers = {
  draw: p => {
    const S = RAMP.chrome;
    // two springy arms joined at the back, pinching at the tips
    p.tube([[20.5, 2.8], [11.5, 8.2], [4.6, 17.6]], 0.85, S, { cap: 'flat' });
    p.tube([[21.2, 3.6], [15.6, 12.2], [5.8, 18.7]], 0.85, S, { cap: 'flat' });
    p.tube([[20.2, 2.6], [21.6, 4.2]], 1.3, S);
    // grip ridges
    for (const [x, y] of [[12, 8], [11, 9], [15, 12], [14, 13]] as [number, number][]) p.px(x, y, S[1]);
    // a plucked feather held in the tips
    p.tube([[5.4, 18.4], [1.6, 21.8]], t => 1.35 - t * 0.5, RAMP.cream, { spec: 1 });
    p.pts([[3, 20], [2, 21]], RAMP.cream[1]);
  },
};

TOOLS.gloves = {
  draw: p => {
    const N = RAMP.nitrile;
    const palm = p.maskBox(6, 9, 11, 9, 2);
    p.puff(palm, N, { r: 3 });
    const fingers: [number, number, number, number, number][] = [[7.6, 10, 7.4, 3.8, 1.45], [10.6, 10, 10.6, 2.4, 1.5], [13.6, 10, 13.8, 3, 1.45], [16.2, 11, 16.8, 5.4, 1.3]];
    for (const [x0, y0, x1, y1, r] of fingers) { const m = p.tube([[x0, y0], [x1, y1]], r, N); p.seam(m, N[1], 12); }
    const th = p.tube([[7, 15], [3.4, 10.4]], 1.55, N);
    p.seam(th, N[1], 8);
    // rolled cuff
    p.tube([[6.8, 19.3], [16.2, 19.3]], 1.7, N, { lift: 1 });
    p.px(8, 18, N[5]); p.px(9, 18, N[5]);
  },
};

TOOLS.hammer = {
  draw: p => {
    const f = frame(3.2, 21.4, 13.6, 11);
    p.tube([f.at(0, 0), f.at(f.len + 2.5, 0)], 1.4, RAMP.pale, { tex: grain(f.ux, f.uy, 7) });
    p.tube([f.at(0.1, 0), f.at(5.6, 0)], 1.85, RAMP.red, { cap: 'flat', tex: (x, y) => ((x - y) % 3 === 0 ? -1 : 0) });
    // head across the handle end: striking face up-left, claw down-right curling back
    const c = f.at(f.len + 2.6, 0);
    const h = frame(c[0] - f.nx * 7, c[1] - f.ny * 7, c[0] + f.nx * 7, c[1] + f.ny * 7);
    const block = p.maskFn((x, y) => { const [u, v] = h.loc(x, y); return u >= 1.4 && u <= 8.6 && Math.abs(v) <= 2.6; });
    p.slab(block, RAMP.steel, 3);
    p.fill(block, (x, y) => { const [u, v] = h.loc(x, y); return v < -1.3 ? RAMP.steel[4] : v > 1.4 ? RAMP.steel[2] : u < 2.6 ? RAMP.steel[4] : -1; });
    const face = p.maskFn((x, y) => { const [u, v] = h.loc(x, y); return u >= 0.4 && u < 1.8 && Math.abs(v) <= 3.1; });
    p.slab(face, RAMP.chrome, 4);
    const claw: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const u = 8.2 + i * 0.95; claw.push(h.at(u, ((u - 8.2) ** 2) * 0.1)); }
    p.tube(claw, t => 2.3 - t * 1.6, RAMP.steel);
    const [gx, gy] = h.at(12.4, 0.9);
    p.clear(gx, gy);
    const [gx2, gy2] = h.at(11.6, 0.4);
    p.clear(gx2, gy2);
  },
};

TOOLS.headlamp = {
  draw: p => {
    const O = rp('#15180c', '#262c14', '#3c4520', '#56612c', '#7a843c', '#a6ae5a');
    // elastic head band looping back behind the lamp (seen from above-front)
    const band = Pen.sub(p.maskEllipse(12, 9.5, 11, 6.6), p.maskEllipse(12, 9.2, 8.2, 4.3));
    p.fill(band, (x, y) => {
      const front = y + 0.5 > 9.5;
      const dx = (x + 0.5 - 12) / 11, dy = (y + 0.5 - 9.5) / 6.6;
      const stripe = Math.abs(Math.hypot(dx, dy) - 0.84) < 0.06;
      if (!front) return stripe ? O[2] : O[1];
      return stripe ? O[5] : x < 12 ? O[4] : O[3];
    });
    // lamp housing on the front of the band, chrome reflector, glowing lens
    p.puff(p.maskBox(6, 10, 12, 11, 3), rp('#1e1a14', '#3a2e1c', '#5e4624', '#8a6630', '#b88e3e', '#e2c070'), { r: 3 });
    ring(p, 12, 15.5, 3, 4.4, RAMP.chrome);
    p.fill(p.maskDisc(12, 15.5, 3), (x, y) => {
      const d = Math.hypot(x + 0.5 - 11.2, y + 0.5 - 14.7);
      return d < 1.3 ? H('#ffffff') : d < 2.4 ? H('#fff4b4') : H('#f4c848');
    });
    p.px(16, 11, RAMP.red[3]); p.px(16, 12, RAMP.red[1]);
  },
  post: p => {
    halo(p, 12, 15.5, 8.5, '#fff2a8', 110);
  },
};

TOOLS.translator = {
  draw: p => {
    const I = RAMP.iron;
    p.slab(p.maskBox(6, 1, 12, 22, 2), I, 2, { hi: 2, lo: -1 });
    // screen with two speech bubbles (the translator app)
    p.fill(p.maskBox(7, 3, 10, 17), (x, y) => (y < 5 ? H('#0f1830') : (x + y) % 7 === 0 ? H('#1c2e60') : H('#172652')));
    p.slab(p.maskBox(8, 5, 7, 4, 1), RAMP.teal, 4, { hi: 1, lo: -1 });
    p.pts([[9, 9], [10, 9]], RAMP.teal[3]);
    p.rect(9, 6, 4, 1, RAMP.teal[1]); p.rect(9, 7, 3, 1, RAMP.teal[2]);
    p.slab(p.maskBox(10, 11, 6, 4, 1), RAMP.amber, 4, { hi: 1, lo: -1 });
    p.pts([[14, 15], [15, 15]], RAMP.amber[3]);
    p.rect(11, 12, 4, 1, RAMP.amber[1]); p.rect(11, 13, 2, 1, RAMP.amber[2]);
    // status bar: low battery
    p.rect(14, 3, 2, 1, RAMP.red[3]); p.px(16, 3, RAMP.red[1]);
    // cracked glass
    const crack: [number, number][] = [[16, 4], [15, 5], [15, 6], [14, 7], [13, 8], [13, 9], [12, 10], [12, 11], [11, 12], [10, 13], [10, 14], [9, 15], [9, 16], [8, 17]];
    for (const [x, y] of crack) p.px(x, y, H('#d8f0ff'));
    p.pts([[14, 9], [15, 10], [11, 15], [12, 16]], H('#8ab0d8'));
    // camera + home bar
    p.px(11, 2, I[0]); p.px(12, 2, I[5]);
    p.rect(10, 21, 4, 1, I[5]);
    p.rect(7, 19, 10, 1, H('#172652'));
  },
};

TOOLS.ghillie = {
  draw: p => {
    const cape = p.maskPoly([11.5, 0.5, 15, 2, 16.6, 5.5, 17.2, 9, 20.5, 14.5, 22.5, 21, 1, 21, 3, 14.5, 6.4, 9, 7, 5.5, 8.2, 2]);
    p.puff(cape, RAMP.leaf, { r: 5, lift: -0.2 });
    // hanging fern and flax strands
    const cols = [RAMP.lime[3], RAMP.olive[3], RAMP.leaf[4], RAMP.leaf[2], RAMP.olive[4], RAMP.lime[2]];
    for (let i = 0; i < 46; i++) {
      const x = 2 + hash(i, 1, 7) * 20, y = 4 + hash(i, 2, 7) * 17;
      if (!p.has(x, y)) continue;
      const len = 2 + Math.floor(hash(i, 3, 7) * 3.5), lean = x < 11.5 ? -0.35 : 0.35;
      const c = cols[i % cols.length];
      for (let k = 0; k < len; k++) p.px(x + lean * k, y + k, x < 8 && y < 14 ? RAMP.lime[4] : c);
    }
    // ragged hem
    for (let x = 2; x <= 21; x++) {
      const n = Math.floor(hash(x, 9, 3) * 3);
      for (let k = 0; k < n; k++) p.px(x, 21 + k, k === n - 1 ? RAMP.olive[2] : RAMP.leaf[2]);
    }
    // the hood opening
    p.ball(12, 6.8, 2.5, 3, rp('#050806', '#0a120e', '#101c16', '#172a1e', '#20382a', '#20382a'), { spec: 1, lift: -1 });
  },
};

TOOLS.binoculars = {
  draw: p => {
    const Lb = rp('#1a0e09', '#2c180f', '#462a18', '#623e22', '#86562e', '#ac7846');
    for (const side of [-1, 1]) {
      const cx = 12 + side * 5.6;
      // leather-wrapped barrel, black eyepiece with a brass ring on top, objective below
      p.tube([[cx - side * 0.4, 6.5], [cx, 17]], 4.1, Lb, { cap: 'flat', tex: (x, y) => ((x * 7 + y * 3) % 5 === 0 ? -1 : 0) });
      p.tube([[cx - side * 0.7, 2.8], [cx - side * 0.5, 6.5]], 2.5, RAMP.rubber, { cap: 'flat' });
      ring(p, cx - side * 0.5, 6.4, 2.4, 4.2, RAMP.brass, { ry: 0.5 });
      ring(p, cx, 17.8, 2.9, 4.6, RAMP.brass, { ry: 0.72 });
      const g = p.maskEllipse(cx, 17.8, 3, 2.15);
      p.fill(g, (x, y) => { const d = Math.hypot((x + 0.5 - cx) / 3, (y + 0.5 - 17.8) / 2.15); return d < 0.5 ? H('#0c1030') : H('#1c2a60'); });
      p.px(Math.floor(cx - 1.4), 17, H('#9cc8f4')); p.px(Math.floor(cx - 0.4), 17, H('#ffffff'));
    }
    // hinge bridge and ridged focus wheel
    p.tube([[8.6, 9.5], [15.4, 9.5]], 1.5, RAMP.brass);
    p.tube([[12, 6.4], [12, 12.4]], 1.8, RAMP.brass, { cap: 'flat', tex: (x, y) => (y % 2 ? -1 : 0) });
  },
};
