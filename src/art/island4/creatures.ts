// V4 island creatures in the anime cast's clean sticker style (flat cel shading, dark outline):
// the Corvex Seal (a huge shaggy black seal with a crimson face and white markings) with sleeping,
// waking, roaring, galloping and exhausted poses, and the small shore life: glass crabs,
// swashrunners, tōrea, kelp skinks, kororā, the rock pool wheke and a pīwakawaka.

import { PixelBuffer } from '../pixel';
import { hex, mix, C } from '../color';
import { clamp, noise1, noise2 } from '../../core/math';

const OUT = hex('#140c10');

function outline(b: PixelBuffer, c: C = OUT) {
  const src = b.data.slice();
  const w = b.w, h = b.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x] >>> 24) continue;
    const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && (src[yy * w + xx] >>> 24) > 0 && src[yy * w + xx] !== c;
    if (n(x + 1, y) || n(x - 1, y) || n(x, y + 1) || n(x, y - 1)) b.data[y * w + x] = c;
  }
}

// ------------------------------------------------------------------ the Corvex Seal

export interface SealPose {
  /** body length multiplier (gallop bunches up) */
  len: number;
  /** back arch (+ up) */
  hump: number;
  /** neck lift 0 (resting) .. 1.2 (reared up) */
  head: number;
  /** 0 closed .. 1 roaring */
  mouth: number;
  /** front flipper swing -1 back .. 1 forward */
  front: number;
  /** chest lifted off the ground (rearing, galloping) */
  chest: number;
  breath: number;
  eye: 'open' | 'closed' | 'angry' | 'half';
  tongue?: boolean;
}
export const SEAL_POSES: Record<string, SealPose[]> = {
  sleep: [{ len: 1, hump: 0, head: -0.12, mouth: 0, front: 0, chest: 0, breath: 0, eye: 'closed' }, { len: 1, hump: 0.05, head: -0.1, mouth: 0.1, front: 0, chest: 0, breath: 1, eye: 'closed' }],
  wake: [{ len: 1, hump: 0.1, head: 0.35, mouth: 0, front: 0.2, chest: 0.1, breath: 0.5, eye: 'open' }],
  roar: [{ len: 0.96, hump: 0.3, head: 1.05, mouth: 1, front: 0.6, chest: 0.9, breath: 1, eye: 'angry' }, { len: 0.96, hump: 0.34, head: 1.1, mouth: 0.8, front: 0.5, chest: 0.95, breath: 0.8, eye: 'angry' }],
  gallop: [
    { len: 0.86, hump: 0.9, head: 0.55, mouth: 0.4, front: -0.6, chest: 0.35, breath: 0.5, eye: 'angry' },
    { len: 0.95, hump: 0.4, head: 0.45, mouth: 0.6, front: 0.2, chest: 0.6, breath: 0.6, eye: 'angry' },
    { len: 1.08, hump: -0.15, head: 0.35, mouth: 0.5, front: 0.9, chest: 0.25, breath: 0.5, eye: 'angry' },
    { len: 0.98, hump: 0.3, head: 0.42, mouth: 0.3, front: 0.3, chest: 0.05, breath: 0.4, eye: 'angry' },
  ],
  tired: [{ len: 1.04, hump: -0.1, head: -0.05, mouth: 0.45, front: 0.8, chest: 0, breath: 0, eye: 'half', tongue: true }, { len: 1.04, hump: -0.05, head: -0.02, mouth: 0.55, front: 0.8, chest: 0, breath: 1, eye: 'half', tongue: true }],
};

const FUR = [hex('#120e12'), hex('#1e181c'), hex('#2e2428'), hex('#44363a'), hex('#5e4c50')];
const RED = [hex('#5a1216'), hex('#8e1c22'), hex('#c02e2c'), hex('#e2544a')];
const WHT = [hex('#b8b0aa'), hex('#e0dcd6'), hex('#fbf8f4')];

export const SEAL_W = 170, SEAL_H = 110, SEAL_AX = 70, SEAL_AY = 104;

export function paintSeal(p: SealPose): PixelBuffer {
  const W = SEAL_W, H = SEAL_H, gy = SEAL_AY;
  const b = new PixelBuffer(W, H);
  const L = 104 * p.len;
  const x0 = SEAL_AX - 60;
  // spine: tail (u=0) to shoulders (u=1)
  const radius = (u: number) => {
    const r = u < 0.15 ? 5 + u / 0.15 * 7 : u < 0.55 ? 12 + (u - 0.15) / 0.4 * 9 : 21 - (u - 0.55) / 0.45 * 4;
    return r * (1 + p.breath * 0.035) * (p.len < 0.95 ? 1.06 : 1);
  };
  const spine = (u: number): [number, number] => {
    const x = x0 + u * L;
    const r = radius(u);
    const lift = p.chest * Math.pow(u, 2.2) * 26;
    const arch = p.hump * Math.sin(u * Math.PI) * 9;
    return [x, gy - r + 1 - lift - arch];
  };
  const N = 40;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) { const u = i / N; const [x, y] = spine(u); pts.push([x, y, radius(u)]); }
  // neck and head
  const [sx, sy] = spine(1);
  const na = -0.25 - p.head * 0.95; // angle up-right
  const neckLen = 16 + p.head * 8;
  const hx = sx + Math.cos(na) * neckLen + 6, hy = sy + Math.sin(na) * neckLen;
  for (let i = 1; i <= 10; i++) { const t = i / 10; pts.push([sx + (hx - sx) * t, sy + (hy - sy) * t, 16 - t * 4]); }
  const inBody = (x: number, y: number) => {
    let best = 1e9, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(x - pts[i][0], y - pts[i][1]) - pts[i][2];
      if (d < best) { best = d; bi = i; }
    }
    return [best, bi] as const;
  };
  // shaggy fur: the top contour gets a ragged fringe
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [d, bi] = inBody(x + 0.5, y + 0.5);
    const [cx, cy, r] = pts[bi];
    const ny = (y + 0.5 - cy) / r, nx = (x + 0.5 - cx) / r;
    const shag = ny < 0 ? (noise1(x / 2.2 + bi * 0.1, 7) - 0.3) * 3.2 * (-ny) : 0;
    if (d > shag || y > gy) continue;
    // cel shading, light from the upper left
    const l = -ny * 0.9 - nx * 0.25 + (noise2(x / 3, y / 2, 9) - 0.5) * 0.35;
    let c = l > 0.72 ? FUR[4] : l > 0.3 ? FUR[3] : l > -0.3 ? FUR[2] : l > -0.7 ? FUR[1] : FUR[0];
    // fur strands along the back and mane
    if (ny < -0.2 && (Math.floor(x * 0.7 + y * 0.35) % 5 === 0)) c = mix(c, FUR[4], 0.4);
    b.data[y * W + x] = c;
  }
  // white flank spots and the chest bib
  const wspot = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !(b.data[y * W + x] >>> 24)) continue;
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q < 1) b.data[y * W + x] = y < cy - ry * 0.3 ? WHT[2] : WHT[1];
    }
  };
  for (const [u, rr] of [[0.72, 2.4], [0.6, 2.1], [0.49, 1.8], [0.39, 1.5], [0.3, 1.2]] as const) {
    const [x, y] = spine(u);
    wspot(x, y - radius(u) * 0.38, rr * 1.5, rr);
  }
  // rear flippers splayed at the tail, front flipper under the chest
  const flipper = (px: number, py: number, ang: number, len: number, wid: number) => {
    for (let t = 0; t <= 1; t += 0.03) {
      const w = wid * (0.4 + t * 0.9);
      const cx = px + Math.cos(ang) * len * t, cy = py + Math.sin(ang) * len * t;
      for (let k = -w; k <= w; k += 0.5) {
        const x = Math.round(cx - Math.sin(ang) * k), y = Math.round(cy + Math.cos(ang) * k);
        if (x >= 0 && y >= 0 && x < W && y <= gy) b.data[y * W + x] = t > 0.85 ? FUR[1] : k < 0 ? FUR[3] : FUR[2];
      }
    }
  };
  const [tx, ty] = spine(0);
  flipper(tx + 2, ty + 2, Math.PI + 0.35, 14, 3.4);
  flipper(tx + 2, ty + 4, Math.PI - 0.15, 12, 3);
  const [fx, fy] = spine(0.86);
  flipper(fx + 4, fy + radius(0.86) * 0.5, 1.35 - p.front * 0.7, 18 + p.chest * 6, 3.6);
  // head: skull + snout with the crimson mask
  const hr = 15;
  const snX = hx + 6 + Math.cos(na * 0.4) * 11, snY = hy + 4 + Math.sin(na * 0.4) * 6;
  for (let y = Math.floor(hy - hr - 2); y <= hy + hr + 6; y++) for (let x = Math.floor(hx - hr - 2); x <= snX + 14; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H || y > gy) continue;
    const qh = ((x - hx) / hr) ** 2 + ((y - hy) / (hr * 0.88)) ** 2;
    const qs = ((x - snX) / 12) ** 2 + ((y - snY) / 8) ** 2;
    if (qh > 1 && qs > 1) continue;
    const l = -(y - hy) / hr * 0.8 - (x - hx) / hr * 0.1;
    let c = l > 0.5 ? FUR[4] : l > 0 ? FUR[3] : FUR[2];
    // the crimson face: everything forward of the ear line
    const face = qs < 1.3 || (x > hx - 3 + (y - hy) * 0.5 && qh < 1);
    if (face) c = l > 0.5 ? RED[3] : l > -0.05 ? RED[2] : l > -0.5 ? RED[1] : RED[0];
    b.data[y * W + x] = c;
  }
  // crescent white bib under the jaw
  for (let y = Math.floor(hy + 4); y <= hy + 20; y++) for (let x = Math.floor(hx - 10); x <= hx + 12; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H || !(b.data[y * W + x] >>> 24)) continue;
    const q1 = ((x - hx - 1) / 10) ** 2 + ((y - hy - 12) / 7) ** 2, q2 = ((x - hx - 1) / 9) ** 2 + ((y - hy - 8) / 6) ** 2;
    if (q1 < 1 && q2 > 1) b.data[y * W + x] = y < hy + 14 ? WHT[2] : WHT[1];
  }
  // white brow stripe, muzzle spots and whiskers
  const ex = Math.round(hx + 6), ey = Math.round(hy - 1);
  for (let k = -6; k <= 7; k++) {
    const x = ex + k, y = ey - 5 - Math.round(Math.abs(k) * 0.2) + (p.eye === 'angry' ? Math.round(k * 0.4) : 0);
    for (let t = 0; t < 2; t++) if (x >= 0 && x < W && y + t >= 0 && y + t < H) b.data[(y + t) * W + x] = t ? WHT[1] : WHT[2];
  }
  for (const [dx, dy] of [[4, 1], [6, 2], [3, 3], [7, 0], [5, 3]] as const) { const x = Math.round(snX + dx - 3), y = Math.round(snY + dy - 1); if (x < W && y < H) b.data[y * W + x] = WHT[1]; }
  // eye
  const eyeC = (x: number, y: number, c: C) => { if (x >= 0 && y >= 0 && x < W && y < H) b.data[y * W + x] = c; };
  if (p.eye === 'closed') { for (let k = -2; k <= 2; k++) eyeC(ex + k, ey + (Math.abs(k) === 2 ? 0 : 1), OUT); }
  else if (p.eye === 'half') { for (let k = -2; k <= 2; k++) eyeC(ex + k, ey, OUT); eyeC(ex, ey + 1, hex('#1a1016')); eyeC(ex + 1, ey + 1, hex('#1a1016')); }
  else {
    const angry = p.eye === 'angry';
    for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) < 4) eyeC(ex + dx, ey + dy, angry ? hex('#f0c83a') : hex('#1a1016'));
    eyeC(ex, ey, OUT); eyeC(ex + 1, ey, OUT); eyeC(ex, ey - 1, OUT); eyeC(ex + 1, ey - 1, OUT);
    eyeC(ex - 1, ey - 2, hex('#ffffff'));
    if (angry) for (let k = -2; k <= 2; k++) eyeC(ex + k, ey - 3, OUT);
  }
  // nose and mouth
  const nx0 = Math.round(snX + 10), ny0 = Math.round(snY - 3);
  eyeC(nx0, ny0, OUT); eyeC(nx0 + 1, ny0, OUT); eyeC(nx0, ny0 + 1, OUT);
  if (p.mouth > 0.05) {
    const open = Math.round(p.mouth * 9);
    for (let y = 0; y < open; y++) for (let x = -7 + Math.round(y * 0.4); x < 6; x++) {
      const X = Math.round(snX + x), Y = Math.round(snY + 3 + y);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      b.data[Y * W + X] = y === 0 || y === open - 1 ? OUT : y < open * 0.5 ? hex('#5a1a22') : hex('#c85a6a');
    }
    // fangs
    for (const fx2 of [-3, 3]) { eyeC(Math.round(snX + fx2), Math.round(snY + 4), WHT[2]); eyeC(Math.round(snX + fx2), Math.round(snY + 5), WHT[1]); eyeC(Math.round(snX + fx2 + 1), Math.round(snY + 3 + open - 2), WHT[2]); }
    if (p.tongue) for (let k = 0; k < 4; k++) { eyeC(Math.round(snX + 2 + k * 0.5), Math.round(snY + 3 + open + k), hex('#e87888')); eyeC(Math.round(snX + 3 + k * 0.5), Math.round(snY + 3 + open + k), hex('#c85a6a')); }
  } else for (let k = -6; k <= 5; k++) eyeC(Math.round(snX + k), Math.round(snY + 3), RED[0]);
  outline(b);
  // whiskers after the outline (thin, white, over the edge)
  for (const [a, len] of [[0.25, 12], [0.05, 13], [-0.15, 11]] as const) for (let k = 3; k < len; k++) eyeC(Math.round(snX + 4 + Math.cos(a) * k), Math.round(snY + 2 + Math.sin(a) * k), WHT[1]);
  return b;
}

// ------------------------------------------------------------------ small shore life

function sprite(w: number, h: number, draw: (set: (x: number, y: number, c: string) => void) => void, outlined = true) {
  const b = new PixelBuffer(w + 2, h + 2);
  draw((x, y, c) => { x = Math.round(x) + 1; y = Math.round(y) + 1; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.data[y * b.w + x] = hex(c); });
  if (outlined) outline(b);
  return b;
}

export function glassCrab(f: number) {
  return sprite(11, 7, s => {
    for (let y = 2; y < 6; y++) for (let x = 2; x < 9; x++) if (((x - 5.5) / 3.6) ** 2 + ((y - 4) / 2.1) ** 2 < 1) s(x, y, y < 4 ? '#f4ecdc' : '#d8ccb8');
    s(4, 1, '#1a1014'); s(7, 1, '#1a1014'); s(4, 2, '#e8dcc8'); s(7, 2, '#e8dcc8');
    // glass claws raised or down
    const up = f === 2 ? -1 : 0;
    s(1, 3 + up, '#cfe8f4'); s(0, 2 + up, '#e8f6ff'); s(10, 3 + up, '#cfe8f4'); s(10, 2 + up, '#e8f6ff');
    for (let i = 0; i < 3; i++) { s(2 + i * 1.2, 6 + ((f + i) % 2) * 0 , '#b8a88e'); s(8 - i * 1.2, 6, '#b8a88e'); }
    if (f === 1) { s(1, 6, '#b8a88e'); s(9, 6, '#b8a88e'); }
  });
}

export function swashrunner(f: number) {
  return sprite(12, 11, s => {
    for (let y = 2; y < 8; y++) for (let x = 2; x < 10; x++) if (((x - 5.5) / 4) ** 2 + ((y - 5) / 2.6) ** 2 < 1) s(x, y, y < 5 ? '#a8906e' : '#f4f0e8');
    for (let y = 1; y < 5; y++) for (let x = 7; x < 11; x++) if (((x - 8.6) / 2) ** 2 + ((y - 2.8) / 1.8) ** 2 < 1) s(x, y, y < 2 ? '#a8906e' : '#f4f0e8');
    s(8, 4, '#1a1014'); s(9, 4, '#1a1014'); s(7, 5, '#1a1014'); // neck band
    s(9, 2, '#1a1014'); s(11, 3, '#2a2226');
    s(1, 4, '#8a7458'); s(0, 4, '#8a7458');
    const legs = f === 1 ? [[4, 9], [7, 8]] : f === 2 ? [[5, 9], [6, 9]] : [[4, 8], [7, 9]];
    for (const [lx, ly] of legs) { s(lx, 8, '#e8904a'); s(lx, ly, '#e8904a'); }
    if (f === 2) { s(10, 5, '#2a2226'); s(11, 6, '#2a2226'); }
  });
}

export function torea(f: number) {
  return sprite(17, 15, s => {
    for (let y = 3; y < 10; y++) for (let x = 2; x < 12; x++) if (((x - 6.5) / 5) ** 2 + ((y - 6.5) / 3.2) ** 2 < 1) s(x, y, y < 5 ? '#3a3238' : '#241e24');
    for (let y = 1; y < 6; y++) for (let x = 9; x < 14; x++) if (((x - 11.2) / 2.3) ** 2 + ((y - 3.2) / 2.2) ** 2 < 1) s(x, y, '#2a2428');
    s(12, 3, '#e84a2a'); s(12, 2, '#ffd24a');
    const probe = f === 2;
    for (let k = 0; k < 5; k++) s(13 + k * (probe ? 0.6 : 1), 3 + k * (probe ? 1 : 0.2), '#f07a2a');
    s(1, 6, '#241e24'); s(0, 7, '#241e24');
    const legs = f === 1 ? [[5, 13], [8, 12]] : [[5, 12], [8, 13]];
    for (const [lx, ly] of legs) for (let y = 10; y <= ly; y++) s(lx, y, '#e8a0a0');
  });
}

export function skink(f: number) {
  return sprite(16, 5, s => {
    for (let x = 2; x < 12; x++) { const w = x < 4 ? 1 : x > 9 ? 1 : 2; for (let y = 2; y < 2 + w; y++) s(x, y, y === 2 ? '#c8864a' : '#8a5a2e'); }
    for (let x = 12; x < 16; x++) s(x, 2 + (x > 13 ? 1 : 0), '#a86a38');
    for (let x = 0; x < 2; x++) s(x, 2, '#8a5a2e');
    for (let x = 3; x < 11; x += 2) s(x, 2, '#e8b86a');
    s(1, 2, '#1a1014');
    const k = f % 2;
    s(4 + k, 4, '#6a4424'); s(9 - k, 4, '#6a4424');
  });
}

export function korora(f: number) {
  return sprite(10, 13, s => {
    for (let y = 1; y < 12; y++) for (let x = 1; x < 9; x++) {
      const q = ((x - 4.5) / 3.6) ** 2 + ((y - 7) / 5.4) ** 2;
      if (q < 1) s(x, y, x > 4.5 + (y < 5 ? -1 : 0) ? '#f4f2ec' : '#4a6a9a');
    }
    for (let y = 0; y < 4; y++) for (let x = 3; x < 8; x++) if (((x - 5) / 2.4) ** 2 + ((y - 2) / 2) ** 2 < 1) s(x, y, '#4a6a9a');
    s(6, 1, '#1a1014'); s(8, 2, '#2a2226'); s(9, 2, '#2a2226');
    const lean = f === 1 ? 1 : 0;
    s(2 - lean, 6, '#3a5a8a'); s(1 - lean, 7, '#3a5a8a');
    s(3 + lean, 12, '#e8a0a0'); s(6 - lean, 12, '#e8a0a0');
  });
}

export function wheke(f: number) {
  return sprite(14, 9, s => {
    // head peeking over the pool rim, one arm curling out
    for (let y = 1; y < 8; y++) for (let x = 3; x < 11; x++) if (((x - 7) / 4) ** 2 + ((y - 5) / 3.4) ** 2 < 1) s(x, y, y < 4 ? '#d8703a' : '#b04a2a');
    s(6, 4, '#f4e0c0'); s(6, 5, '#1a1014'); s(9, 4, '#f4e0c0'); s(9, 5, '#1a1014');
    const arm = f === 1 ? [[2, 6], [1, 5], [1, 4], [2, 3]] : [[2, 7], [1, 7], [0, 6], [0, 5]];
    for (const [x, y] of arm) s(x, y, '#c85a2e');
    s(12, 7, '#c85a2e'); s(13, 6, '#c85a2e');
  });
}

export function fantail(f: number) {
  return sprite(12, 9, s => {
    for (let y = 2; y < 7; y++) for (let x = 4; x < 9; x++) if (((x - 6.4) / 2.6) ** 2 + ((y - 4.4) / 2.2) ** 2 < 1) s(x, y, y < 4 ? '#6a5a48' : '#d8b890');
    s(8, 3, '#1a1014'); s(9, 4, '#2a2226'); s(7, 2, '#f4f0e8');
    // the fanned tail
    const spread = f === 1 ? 3 : 1.5;
    for (let k = -2; k <= 2; k++) for (let t = 0; t < 4; t++) s(3 - t, 5 + k * t * spread * 0.18, t === 3 ? '#f4f0e8' : '#5a4a3a');
    s(6, 7, '#3a2e26');
  });
}

export const CRITTER_FRAMES: Record<string, () => PixelBuffer[]> = {
  glasscrab: () => [glassCrab(0), glassCrab(1), glassCrab(2)],
  swashrunner: () => [swashrunner(0), swashrunner(1), swashrunner(2)],
  torea: () => [torea(0), torea(1), torea(2)],
  kelpskink: () => [skink(0), skink(1)],
  korora: () => [korora(0), korora(1)],
  wheke: () => [wheke(0), wheke(1)],
  piwakawaka: () => [fantail(0), fantail(1)],
};

export { clamp };
