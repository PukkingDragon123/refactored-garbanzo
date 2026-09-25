// Birds and mammals of Zealandia (pre-rendered pose frames) and the serpent looks.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix } from './color';
import { PAL, OUTLINE } from './palettes';
import { bayer, clamp } from '../core/math';
import type { SerpentLook } from './serpent';

const r = (...h: string[]) => h.map(x => hex(x));

// ------------------------------------------------------------------ serpents
export const SERPENT_LOOKS: Record<string, SerpentLook> = {
  strider: {
    length: 46, radius: 3.6, thickAt: 0.35, dorsal: r('#2b3a1c', '#3f5626', '#58722f', '#77903c', '#9aad52'),
    belly: hex('#d8c68a'), pattern: 'bands', patternCol: hex('#2a2414'), period: 7, head: 'blunt', eye: hex('#f2c14e'),
    legs: [{ at: 0.22, len: 7, col: r('#2b3a1c', '#3f5626', '#58722f', '#77903c') }, { at: 0.55, len: 7, col: r('#2b3a1c', '#3f5626', '#58722f', '#77903c') }],
  },
  sprinter: {
    length: 64, radius: 4.6, thickAt: 0.25, tailTaper: 1.1, dorsal: r('#3a1d14', '#5c2c1a', '#86401f', '#b35a26', '#d98138'),
    belly: hex('#efd9a8'), pattern: 'stripe', patternCol: hex('#241210'), patternCol2: hex('#f0b050'), head: 'raptor', eye: hex('#ffe066'),
    legs: [{ at: 0.3, len: 14, col: r('#2a140e', '#4a2416', '#6d361e', '#93502a') }],
  },
  skyribbon: {
    length: 60, radius: 2.4, thickAt: 0.3, dorsal: r('#0f3a2a', '#16603e', '#1f8a4f', '#39b35e', '#7fdc7a'),
    belly: hex('#e8f59a'), pattern: 'rings', patternCol: hex('#0c2a28'), patternCol2: hex('#f6d34a'), period: 9, head: 'slim', eye: hex('#ff9a3c'), iridescent: true,
  },
  lurevip: {
    length: 52, radius: 3.4, thickAt: 0.4, tailTaper: 1.6, dorsal: r('#1d1430', '#2d1f4a', '#44306a', '#5e4690', '#8068b8'),
    belly: hex('#c9b8e6'), pattern: 'diamonds', patternCol: hex('#120c20'), patternCol2: hex('#8ef0e0'), period: 10, head: 'viper', eye: hex('#b8ff9a'), lure: hex('#dfffe0'),
  },
  titan: {
    length: 480, radius: 15, thickAt: 0.4, tailTaper: 1.4, dorsal: r('#1b1d10', '#2c3016', '#43461f', '#5c5e2a', '#787a38', '#9a9a4c'),
    belly: hex('#c6b98a'), pattern: 'blotch', patternCol: hex('#1a1508'), patternCol2: hex('#b3a25c'), period: 26, head: 'blunt', eye: hex('#e8c040'),
  },
  leviathan: {
    length: 720, radius: 17, thickAt: 0.25, tailTaper: 1.1, dorsal: r('#081a26', '#0d2c40', '#14415c', '#1d5a78', '#2f7896', '#5fa8b8'),
    belly: hex('#bfe0d6'), pattern: 'speckle', patternCol: hex('#8ff0e0'), head: 'leviathan', eye: hex('#dfffb0'),
    dorsalFin: { from: 0.06, to: 0.95, h: 11, col: hex('#3fa0a8') }, gills: hex('#e86a8a'), pectoral: hex('#3fa0a8'),
  },
  mudribbon: {
    length: 70, radius: 3.2, thickAt: 0.35, dorsal: r('#1c160e', '#2e2416', '#46371f', '#5f4c2b', '#7c663a'),
    belly: hex('#e0c890'), pattern: 'bands', patternCol: hex('#f0e0b0'), period: 8, head: 'slim', eye: hex('#ffcf40'),
  },
  cragviper: {
    length: 50, radius: 3.4, thickAt: 0.35, dorsal: r('#2a2a2e', '#40404a', '#5c5c66', '#7c7c86', '#a0a0a8'),
    belly: hex('#d8d0c0'), pattern: 'diamonds', patternCol: hex('#1a1a20'), patternCol2: hex('#c05040'), period: 8, head: 'viper', eye: hex('#ff5040'),
  },
  ironjaw: {
    length: 120, radius: 8.5, thickAt: 0.3, tailTaper: 1.0, dorsal: r('#12160e', '#1f2616', '#2e391f', '#415029', '#566836', '#708545'),
    belly: hex('#c8c09a'), pattern: 'bands', patternCol: hex('#161a0e'), period: 12, head: 'croc', headLen: 30, eye: hex('#e8d040'), scutes: true,
    legs: [{ at: 0.12, len: 9, col: r('#12160e', '#1f2616', '#2e391f', '#415029') }, { at: 0.42, len: 10, col: r('#12160e', '#1f2616', '#2e391f', '#415029') }],
  },
};

// ------------------------------------------------------------------ birds
export interface BirdSpec {
  body: C[]; belly: C; head: C[]; wing: C[]; beak: C; legs: C;
  len: number; h: number; beakLen: number; hook?: boolean; crest?: C; tail: number; legLen: number;
  span: number; mask?: C; eye?: C; throat?: C; webbed?: boolean;
}
export interface BirdPose { wing: number; open: number; step: number; headDown: number; fly: boolean; swim: boolean; beak: number; legsUp?: boolean }

export const BIRDS: Record<string, BirdSpec> = {
  galehawk: {
    body: r('#1e1a22', '#34283a', '#4e3a52', '#6c4f6a', '#8c6a84'), belly: hex('#e8dcc8'), head: r('#2a2230', '#433447', '#5e4a60', '#7a6378'),
    wing: r('#141018', '#2a2030', '#43344a', '#5f4c66', '#8a7490', '#c6b0c8'), beak: hex('#f2c14e'), legs: hex('#f2c14e'),
    len: 22, h: 11, beakLen: 4, hook: true, tail: 9, legLen: 4, span: 30, mask: hex('#101014'), eye: hex('#ff9a2e'), crest: hex('#d35a3a'),
  },
  cragauk: {
    body: r('#101418', '#1c2228', '#2a323a', '#3c4650', '#56626c'), belly: hex('#f4f2ea'), head: r('#101418', '#1c2228', '#2a323a', '#3c4650'),
    wing: r('#0c1014', '#161c22', '#222a32', '#343e48', '#4c5864', '#6c7884'), beak: hex('#e8603c'), legs: hex('#e8703c'),
    len: 14, h: 10, beakLen: 4, tail: 3, legLen: 3, span: 20, throat: hex('#f2c14e'), eye: hex('#101010'), webbed: true,
  },
  torrentdipper: {
    body: r('#101c24', '#182c38', '#224050', '#305a6c', '#467a8c'), belly: hex('#dfe8e4'), head: r('#18222a', '#243440', '#344a58', '#4a6474'),
    wing: r('#0c161c', '#14242e', '#1e3442', '#2c4a5c', '#406478', '#6a90a0'), beak: hex('#2a2a2a'), legs: hex('#c09060'),
    len: 12, h: 9, beakLen: 3, tail: 4, legLen: 4, span: 16, throat: hex('#f4f4ee'), eye: hex('#101010'),
  },
  snakestork: {
    body: r('#3a3a3a', '#6a6a66', '#9a9a92', '#c8c6bc', '#ecebe4'), belly: hex('#f4f2ea'), head: r('#1a1414', '#2e2222', '#4a3434', '#6a4c4c'),
    wing: r('#101010', '#1e1e1e', '#2e2e2e', '#484848', '#8a8a86', '#d0d0c8'), beak: hex('#d8b030'), legs: hex('#d86040'),
    len: 20, h: 14, beakLen: 12, tail: 5, legLen: 16, span: 34, crest: hex('#2e2222'), eye: hex('#f2e040'), throat: hex('#d04040'),
  },
};

export function drawBird(s: BirdSpec, p: BirdPose): PixelBuffer {
  const W = Math.ceil(s.span * 1.2 + s.len + s.beakLen + 10), H = Math.ceil(s.h + s.legLen + s.span * 0.9 + 8);
  const b = new PixelBuffer(W, H);
  const cx = Math.floor(W / 2) - 2, ground = H - 1;
  const bodyY = p.fly ? H * 0.55 : p.swim ? ground - s.h * 0.3 : ground - s.legLen - s.h * 0.5;
  const tilt = p.fly ? 0 : p.headDown * 0.35;
  // legs
  if (!p.fly && !p.swim) {
    for (const [i, off] of [[0, -2], [1, 2]] as [number, number][]) {
      const ph = Math.sin(p.step * Math.PI * 2 + i * Math.PI);
      const fx = cx + off + ph * 3, fy = ground;
      const kx = cx + off * 0.5 + ph * 1.5 + 1, ky = bodyY + s.h * 0.35 + (fy - bodyY - s.h * 0.35) * 0.5;
      const c = i === 0 ? shade(s.legs, -0.3) : s.legs;
      b.line(cx + off * 0.5, bodyY + s.h * 0.3, kx, ky, c);
      b.line(kx, ky, fx, fy - Math.max(0, ph) * 2, c);
      b.set(fx + 1, fy - Math.max(0, ph) * 2, c);
      b.set(fx + 2, fy - Math.max(0, ph) * 2, c);
      if (s.webbed) b.set(fx - 1, fy, c);
    }
  } else if (p.fly && !p.legsUp) {
    b.line(cx - s.len * 0.2, bodyY + s.h * 0.3, cx - s.len * 0.45, bodyY + s.h * 0.45, s.legs);
  }
  // far wing (when flying)
  const wingDraw = (far: boolean) => {
    const W2 = s.wing;
    if (!p.fly && p.open < 0.1) return;
    const bx0 = cx + s.len * 0.12, by0 = bodyY - s.h * 0.25;
    const span = s.span * (p.fly ? 0.62 : 0.3 + 0.35 * p.open) * (far ? 0.82 : 1);
    const lift = p.fly ? p.wing : 0.7 + p.open * 0.3;
    const tipX = bx0 - span * 0.35 - (1 - Math.abs(lift)) * span * 0.35 + (far ? 2 : 0);
    const tipY = by0 - lift * span * 0.8 + (far ? 1 : 0);
    const chord = s.h * 0.85;
    const pts = [bx0 + 2, by0, tipX, tipY, tipX - 3, tipY + (lift > 0 ? 2 : -2), bx0 - chord, by0 + 2];
    b.polyFn(pts, (x, y) => {
      // shading by distance along the wing & feather rows
      const t = Math.hypot(x - bx0, y - by0) / Math.max(1, span);
      const row = (Math.floor(x) + Math.floor(y)) % 3 === 0;
      let i = far ? 1 : 3;
      if (t > 0.65) i -= 1;
      if (row) i -= 1;
      if (y < by0 && x > bx0 - 3) i += 1;
      return W2[clamp(i, 0, W2.length - 1)];
    });
    // primary feather fingers at the tip
    for (let k = 0; k < 3; k++) b.set(tipX - 1 - k * 1.5, tipY + (lift > 0 ? 1 : -1) * (1 + k), W2[far ? 0 : 1]);
  };
  if (p.fly) wingDraw(true);
  // tail
  const tailY = bodyY - s.h * 0.05 + tilt * 3;
  for (let k = 0; k < s.tail; k += 0.5) {
    const spread = 1 + k * 0.25;
    for (let w = -spread; w <= spread; w += 0.5) b.set(cx - s.len * 0.42 - k, tailY + w * 0.5 + k * (p.fly ? 0 : 0.35), k > s.tail - 2 ? s.wing[1] : s.wing[3]);
  }
  // body
  b.ellipseFn(cx, bodyY, s.len * 0.5, s.h * 0.5, (x, y, nx, ny) => {
    let l = -ny * 0.6 - nx * 0.2 + (bayer(x, y) - 0.5) * 0.3;
    if (ny > 0.2 && nx > -0.5) return mix(s.belly, shade(s.belly, -0.25), clamp(ny - 0.2));
    return s.body[clamp(Math.round((l * 0.5 + 0.5) * (s.body.length - 1)), 0, s.body.length - 1)];
  });
  // folded wing on the side (perched)
  if (!p.fly) {
    b.ellipseFn(cx - 2, bodyY - 1, s.len * 0.38, s.h * 0.34, (x, y, nx, ny) => {
      const W2 = s.wing;
      if (nx < -0.6 && Math.floor(y) % 2 === 0) return W2[1];
      return W2[clamp(Math.round(((-ny * 0.5 + 0.5) * 3) + 1), 1, 4)];
    });
    if (p.open > 0.1) wingDraw(false);
  }
  // head & neck
  const neckLen = s.len * (s.legLen > 10 ? 0.35 : 0.12);
  const hx = cx + s.len * 0.42 + neckLen * 0.4, hy = bodyY - s.h * 0.45 - neckLen * (1 - p.headDown) + p.headDown * s.h * 0.6;
  if (neckLen > 2) b.thickLine(cx + s.len * 0.3, bodyY - s.h * 0.2, hx, hy, s.h * 0.16, s.body[3]);
  const hr = s.h * 0.34;
  b.ellipseFn(hx, hy, hr * 1.1, hr, (x, y, nx, ny) => s.head[clamp(Math.round(((-ny * 0.6 - nx * 0.2) * 0.5 + 0.5) * (s.head.length - 1) + (bayer(x, y) - 0.5) * 0.6), 0, s.head.length - 1)]);
  if (s.throat) b.ellipse(hx + hr * 0.2, hy + hr * 0.6, hr * 0.6, hr * 0.4, s.throat);
  if (s.crest) for (let k = 0; k < 4; k++) b.set(hx - hr * 0.8 - k, hy - hr * 0.7 - k * 0.6, s.crest);
  // beak
  const bx = hx + hr * 0.9, by = hy + (p.headDown > 0.5 ? 1 : 0);
  for (let k = 0; k < s.beakLen; k++) {
    const t = k / s.beakLen;
    b.set(bx + k, by - p.beak * t * 1.5, s.beak);
    if (t < 0.7) b.set(bx + k, by + 1 + p.beak * t * 1.5, shade(s.beak, -0.25));
    if (s.hook && k === s.beakLen - 1) b.set(bx + k, by + 1, s.beak);
  }
  // eye
  if (s.mask) {
    b.set(hx + hr * 0.2, hy - 1, s.mask);
    b.set(hx + hr * 0.6, hy - 1, s.mask);
  }
  b.set(hx + hr * 0.4, hy - 1, s.eye ?? hex('#101010'));
  b.set(hx + hr * 0.4, hy - 2, hex('#f4f0e8'));
  if (p.fly) wingDraw(false);
  if (p.swim) {
    // water line hides the lower body: fade bottom rows
    for (let y = Math.floor(bodyY + s.h * 0.25); y < H; y++) for (let x = 0; x < W; x++) b.data[y * W + x] = 0;
  }
  b.outline(OUTLINE);
  return b;
}

export const birdPoses = {
  stand: (i: number): BirdPose => ({ wing: 0, open: 0, step: 0, headDown: i === 1 ? 0.15 : 0, fly: false, swim: false, beak: 0 }),
  walk: (i: number): BirdPose => ({ wing: 0, open: 0, step: i / 4, headDown: (i % 2) * 0.2, fly: false, swim: false, beak: 0 }),
  peck: (i: number): BirdPose => ({ wing: 0, open: 0, step: 0, headDown: i === 0 ? 0.6 : 1, fly: false, swim: false, beak: i === 1 ? 0.6 : 0 }),
  fly: (i: number): BirdPose => ({ wing: Math.sin((i / 6) * Math.PI * 2), open: 1, step: 0, headDown: 0, fly: true, swim: false, beak: 0 }),
  glide: (): BirdPose => ({ wing: -0.15, open: 1, step: 0, headDown: 0, fly: true, swim: false, beak: 0 }),
  dive: (): BirdPose => ({ wing: 0.9, open: 0.3, step: 0, headDown: 0, fly: true, swim: false, beak: 0, legsUp: true }),
  swim: (i: number): BirdPose => ({ wing: 0, open: 0, step: 0, headDown: i * 0.1, fly: false, swim: true, beak: 0 }),
  display: (i: number): BirdPose => ({ wing: 0, open: 0.6 + i * 0.4, step: 0, headDown: 0, fly: false, swim: false, beak: 0.8 }),
  call: (i: number): BirdPose => ({ wing: 0, open: 0, step: 0, headDown: -0.2, fly: false, swim: false, beak: i ? 1 : 0.3 }),
};

// ------------------------------------------------------------------ mammals
export interface MammalSpec {
  fur: C[]; belly: C; len: number; h: number; headR: number; snout: number; ear: number; earPointed?: boolean;
  legLen: number; tail: number; tailBushy?: number; eye?: C; nose?: C;
  armor?: C[]; quills?: C[]; membrane?: C; stripes?: C; mask?: C; claws?: boolean;
}
export interface MammalPose { step: number; run: boolean; ball: number; rear: number; dig: number; glide: number; quill: number; headDown: number; leap: number }

export const MAMMALS: Record<string, MammalSpec> = {
  shieldback: {
    fur: r('#2a2018', '#3e3024', '#564432', '#705a42', '#8c7456'), belly: hex('#c8b090'), len: 20, h: 11, headR: 4, snout: 5, ear: 1.5,
    legLen: 3, tail: 8, armor: r('#3a3228', '#5a4c3a', '#7c6a50', '#a08c6a', '#c4b08a'), claws: true, eye: hex('#101010'), nose: hex('#3a2020'),
  },
  quillhog: {
    fur: r('#1a1410', '#2c221a', '#403226', '#584634', '#725c46'), belly: hex('#b09a7a'), len: 16, h: 10, headR: 4, snout: 3, ear: 2,
    legLen: 3, tail: 3, quills: r('#1a1410', '#3c3026', '#e8e0cc', '#fff8e8'), eye: hex('#101010'), nose: hex('#e08080'), mask: hex('#f0e8d8'),
  },
  delver: {
    fur: r('#2a1e18', '#46322a', '#644a3c', '#846652', '#a8876c'), belly: hex('#d8b8a0'), len: 14, h: 8, headR: 4, snout: 3, ear: 0.5,
    legLen: 2, tail: 3, claws: true, eye: hex('#101010'), nose: hex('#f09090'),
  },
  sailglider: {
    fur: r('#2a2830', '#44404e', '#625c70', '#847c94', '#a8a0b8'), belly: hex('#f0e6dc'), len: 13, h: 7, headR: 4, snout: 2, ear: 3,
    legLen: 4, tail: 12, tailBushy: 2.5, membrane: hex('#8a7aa0'), eye: hex('#101010'), stripes: hex('#2a2430'),
  },
  flicker: {
    fur: r('#3a1a0c', '#5c2a12', '#86401a', '#b45e24', '#dc8438'), belly: hex('#f4e0c0'), len: 18, h: 7, headR: 3.5, snout: 3, ear: 2.4, earPointed: true,
    legLen: 5, tail: 16, tailBushy: 2.2, eye: hex('#101010'), mask: hex('#2a1a10'), stripes: hex('#2a140a'),
  },
};

export function drawMammal(s: MammalSpec, p: MammalPose): PixelBuffer {
  const W = Math.ceil(s.len * 2.6 + s.tail + 12), H = Math.ceil(s.h * 2.4 + s.legLen + 10);
  const b = new PixelBuffer(W, H);
  const cx = Math.floor(W / 2), ground = H - 1;
  const F = s.fur;
  if (p.ball > 0.5) {
    // curled into an armoured ball
    const R = s.h * 0.75;
    b.ellipseFn(cx, ground - R, R, R, (x, y, nx, ny) => {
      const A = s.armor ?? F;
      const ring = Math.floor((Math.atan2(ny, nx) + 3.2) * 2.2) % 2 === 0;
      let l = -nx * 0.4 - ny * 0.6 + (bayer(x, y) - 0.5) * 0.3;
      let c = A[clamp(Math.round((l * 0.5 + 0.5) * (A.length - 1)), 0, A.length - 1)];
      if (ring) c = shade(c, -0.18);
      return c;
    });
    b.outline(OUTLINE);
    return b;
  }
  const legBase = ground - s.legLen - p.leap * 6;
  const bodyY = legBase - s.h * 0.45 - p.rear * 3;
  const tiltBack = p.rear * 0.6 - p.dig * 0.3;
  const glide = p.glide;
  // tail
  const tx0 = cx - s.len * 0.45, ty0 = bodyY - s.h * 0.1;
  for (let k = 0; k < s.tail; k += 0.5) {
    const t = k / s.tail;
    const x = tx0 - k, y = ty0 + (glide > 0.5 ? 0 : -Math.sin(t * 2.2) * s.tail * 0.35 + t * t * 3);
    const rr = s.tailBushy ? s.tailBushy * (0.6 + Math.sin(t * Math.PI) * 0.6) : 1;
    b.disc(x, y, rr, t > 0.8 && s.tailBushy ? F[4] : s.stripes && Math.floor(k / 3) % 2 === 0 ? s.stripes : F[2]);
  }
  // legs (far first)
  const legs = [[s.len * 0.3, 1], [-s.len * 0.3, 1], [s.len * 0.3, 0], [-s.len * 0.3, 0]] as const;
  legs.forEach(([ox, far], i) => {
    const ph = Math.sin(p.step * Math.PI * 2 + (i % 2) * Math.PI + (far ? Math.PI * 0.5 : 0));
    const hipX = cx + ox, hipY = bodyY + s.h * 0.3;
    let fx = hipX + ph * (p.run ? 4 : 2.5), fy = ground - Math.max(0, -ph) * 2 - p.leap * 4;
    if (glide > 0.5) {
      fx = hipX + Math.sign(ox) * s.len * 0.45;
      fy = hipY + 1;
    }
    if (p.dig > 0.5 && ox > 0) {
      fx = hipX + 3 + ph * 2;
      fy = ground - 1;
    }
    const c = far ? F[1] : F[3];
    b.thickLine(hipX, hipY, fx, fy, Math.max(0.8, s.legLen * 0.25), c);
    b.set(fx + 1, fy, far ? F[0] : F[2]);
    if (s.claws) b.set(fx + 2, fy, hex('#e8e0d0'));
  });
  // gliding membrane
  if (glide > 0.5 && s.membrane) {
    b.polyFn([cx - s.len * 0.75, bodyY + s.h * 0.4, cx + s.len * 0.75, bodyY + s.h * 0.4, cx + s.len * 0.5, bodyY - s.h * 0.2, cx - s.len * 0.5, bodyY - s.h * 0.2], (x, y) => (Math.floor(x) % 5 === 0 ? shade(s.membrane!, -0.2) : y > bodyY + s.h * 0.2 ? shade(s.membrane!, 0.15) : s.membrane!));
  }
  // body
  b.ellipseFn(cx, bodyY, s.len * 0.55, s.h * 0.5, (x, y, nx, ny) => {
    let l = -ny * 0.6 - nx * 0.25 + (bayer(x, y) - 0.5) * 0.35;
    if (ny > 0.35) return s.belly;
    let c = F[clamp(Math.round((l * 0.5 + 0.5) * (F.length - 1)), 0, F.length - 1)];
    if (s.stripes && !s.armor && Math.floor((nx + 1) * 5) % 2 === 0 && ny < 0) c = mix(c, s.stripes, 0.5);
    return c;
  });
  // armour bands
  if (s.armor) {
    const A = s.armor;
    b.ellipseFn(cx - 1, bodyY - 1, s.len * 0.56, s.h * 0.52, (x, y, nx, ny) => {
      if (ny > 0.3) return -1;
      const band = Math.floor((x - cx + 50) / 3) % 2;
      let l = -ny * 0.7 - nx * 0.2 + (bayer(x, y) - 0.5) * 0.3;
      const c = A[clamp(Math.round((l * 0.5 + 0.5) * (A.length - 1)), 0, A.length - 1)];
      return band ? shade(c, -0.2) : c;
    });
  }
  // quills
  if (s.quills) {
    const Q = s.quills;
    const up = p.quill;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const a = Math.PI + t * Math.PI; // across the back
      const bx = cx + Math.cos(a) * s.len * 0.5, by = bodyY + Math.sin(a) * s.h * 0.45;
      const len = 4 + up * 5 + (i % 3);
      const dir = a - (1 - up) * 0.9 + (i % 2) * 0.1;
      for (let k = 0; k < len; k += 0.5) b.set(bx + Math.cos(dir) * k * (1 - up * 0.3) - (1 - up) * k * 0.5, by + Math.sin(dir) * k, k > len - 2 ? Q[3] : k > len * 0.5 ? Q[2] : Q[1]);
    }
  }
  // head
  const hx = cx + s.len * 0.55 + p.rear * 1, hy = bodyY - s.h * 0.2 + p.headDown * s.h * 0.4 - p.rear * 3 + tiltBack;
  b.ellipseFn(hx, hy, s.headR * 1.1, s.headR, (x, y, nx, ny) => F[clamp(Math.round(((-ny * 0.6 - nx * 0.2) * 0.5 + 0.5) * (F.length - 1) + (bayer(x, y) - 0.5) * 0.5), 0, F.length - 1)]);
  // snout
  b.ellipseFn(hx + s.headR * 0.8 + s.snout * 0.4, hy + s.headR * 0.3, s.snout * 0.6 + 0.5, s.headR * 0.5, (_x, _y, _nx, ny) => (ny > 0.2 ? s.belly : F[3]));
  b.set(hx + s.headR * 0.8 + s.snout, hy + s.headR * 0.2, s.nose ?? hex('#1a1010'));
  if (s.mask) {
    b.set(hx + 1, hy - 1, s.mask);
    b.set(hx + 2, hy, s.mask);
    b.set(hx, hy, s.mask);
  }
  // ear
  if (s.ear > 0.8) {
    const ex = hx - s.headR * 0.3, ey = hy - s.headR * 0.8;
    if (s.earPointed) for (let k = 0; k < s.ear + 1; k++) { b.set(ex, ey - k, F[4]); b.set(ex + 1, ey - k + 1, F[2]); }
    else b.disc(ex, ey - s.ear * 0.3, s.ear * 0.7, F[4]);
    b.set(ex, ey, shade(F[4], -0.3));
  }
  // eye
  b.set(hx + s.headR * 0.45, hy - 1, s.eye ?? hex('#101010'));
  if (s.headR >= 4) b.set(hx + s.headR * 0.45, hy - 2, s.eye ?? hex('#101010'));
  b.set(hx + s.headR * 0.45 + 1, hy - 2, hex('#f4f0e8'));
  b.outline(OUTLINE);
  return b;
}

const MP = (o: Partial<MammalPose>): MammalPose => ({ step: 0, run: false, ball: 0, rear: 0, dig: 0, glide: 0, quill: 0, headDown: 0, leap: 0, ...o });
export const mammalPoses = {
  stand: (i: number) => MP({ headDown: i ? 0.1 : 0 }),
  walk: (i: number) => MP({ step: i / 4 }),
  run: (i: number) => MP({ step: i / 4, run: true, leap: i % 2 ? 0.2 : 0 }),
  eat: (i: number) => MP({ headDown: i ? 1 : 0.8 }),
  ball: () => MP({ ball: 1 }),
  rear: (i: number) => MP({ rear: i ? 1 : 0.8 }),
  dig: (i: number) => MP({ dig: 1, step: i / 2, headDown: 0.6 }),
  glide: () => MP({ glide: 1 }),
  quill: (i: number) => MP({ quill: i ? 1 : 0.85 }),
  leap: () => MP({ leap: 1, step: 0.25, run: true }),
};

export { PAL };
