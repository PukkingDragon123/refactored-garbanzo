// Birds and mammals of Zealandia (pre-rendered pose frames) and the serpent looks.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix } from './color';
import { PAL, OUTLINE } from './palettes';
import { bayer, clamp } from '../core/math';
import type { SerpentLook } from './serpent';

const r = (...h: string[]) => h.map(x => hex(x));

// ------------------------------------------------------------------ serpents
// V2 looks for the spine renderer (src/art/serpent.ts). `length` is the spine length the game
// simulates; the head is drawn in front of pts[0], so total length ~= length + head length.
// Sizes follow docs/V2-DESIGN.md (view is 360 px tall; humans ~65 px).
const OLIVE_LEG = r('#1c1f14', '#2c3019', '#40431f', '#585827', '#726e32', '#8e8742', '#aea35a');
const CROC_LEG = r('#0c0f09', '#151a0f', '#1f2615', '#2a331b', '#364222', '#44522a', '#566634', '#6c7c40');
const GECKO = r('#171413', '#241f1c', '#332c27', '#443b34', '#574c42', '#6c5f52', '#857765', '#a0927c');
const NEWT = r('#2a1208', '#40200e', '#5a3014', '#76421a', '#945622', '#b06c2c', '#cc883c', '#e4a656');

export const SERPENT_LOOKS: Record<string, SerpentLook> = {
  // Strider Serpent (~70 px): four jointed legs with clawed digits, ambles over leaf litter, digs grubs.
  strider: {
    length: 60, radius: 4, profile: [0, 0.7, 0.06, 0.8, 0.22, 1, 0.5, 0.95, 0.72, 0.55, 1, 0.14],
    dorsal: r('#1c1f14', '#2c3019', '#40431f', '#585827', '#726e32', '#8e8742', '#aea35a', '#cdc07e'),
    belly: hex('#dccb96'), throat: hex('#ebdcae'), pattern: 'bands', patternCol: hex('#2b2415'), period: 8,
    head: 'blunt', eye: hex('#f0b83a'), pupil: 'round', brow: 0.7, smile: 0.25,
    scale: { kind: 'smooth', len: 2.4, rows: 6 }, bellyScute: 2.2,
    legs: [
      { at: 0.2, len: 10, col: OLIVE_LEG, kind: 'front', digits: 3, claw: hex('#e6dcc0'), thick: 0.42 },
      { at: 0.5, len: 11, col: OLIVE_LEG, kind: 'hind', digits: 3, claw: hex('#e6dcc0'), thick: 0.46 },
    ],
  },
  // Sprint Viper (~90 px): bipedal runner with a stiff counterweight tail; raises a neck crest to threaten.
  sprinter: {
    length: 76, radius: 5, profile: [0, 0.6, 0.08, 0.66, 0.2, 0.92, 0.3, 1, 0.42, 0.8, 0.7, 0.4, 1, 0.1],
    dorsal: r('#0b090e', '#141118', '#1d1822', '#28212d', '#352b39', '#463946', '#5b4b58'),
    belly: hex('#e8d6b4'), throat: hex('#f3e7cd'), pattern: 'flank', patternCol: hex('#130b0e'), patternCol2: hex('#b8322a'), period: 11,
    head: 'raptor', eye: hex('#ffd23a'), pupil: 'slit', pits: true, brow: 1.1, teeth: 'fangs',
    scale: { kind: 'smooth', len: 2.8, rows: 7 }, bellyScute: 2.6,
    crest: { col: hex('#d8402c'), col2: hex('#140c10'), h: 12 },
    legs: [{ at: 0.28, len: 21, col: r('#0b090e', '#141118', '#1d1822', '#28212d', '#352b39', '#463946', '#5b4b58'), kind: 'hind', digitigrade: true, thick: 0.72, digits: 3, claw: hex('#e8e0cc') }],
  },
  // Skyribbon Glider (~90 px): iridescent canopy snake; flattens into a wide ribbon to glide (flatten 0..1).
  skyribbon: {
    length: 84, radius: 2.6, thickAt: 0.3,
    dorsal: r('#0c2a22', '#12402e', '#1a5a3a', '#257846', '#389650', '#58b25c', '#8ccc6a'),
    sheen: [hex('#155f3b'), hex('#1a8a6a'), hex('#2a7cb0'), hex('#5a58c8'), hex('#9a5ad0')], iridescent: true,
    belly: hex('#d8ec8c'), throat: hex('#eef6b0'), pattern: 'ribbon', patternCol: hex('#0a1c1c'), patternCol2: hex('#f0dc58'), period: 9,
    head: 'slim', eye: hex('#ff9a3c'), pupil: 'round', scale: { kind: 'smooth', len: 2.2, rows: 5 }, bellyScute: 2.5,
    glideRoll: 1.15, glideWiden: 0.9, flat: 1,
  },
  // Lantern Lure-Viper (~100 px): dark mottled ambush viper; the glowing tail-tip lure is emissive.
  lurevip: {
    length: 90, radius: 3.8, profile: [0, 0.5, 0.06, 0.68, 0.35, 1, 0.62, 0.85, 0.82, 0.4, 0.93, 0.2, 1, 0.14],
    dorsal: r('#120e12', '#1c161a', '#282024', '#362c2c', '#463a36', '#584a42', '#6c5c50'),
    belly: hex('#8e8478'), throat: hex('#b4a896'), pattern: 'mottle', patternCol: hex('#0a080c'), patternCol2: hex('#6e7a5c'), period: 12,
    head: 'viper', eye: hex('#c8ff8a'), pupil: 'slit', horns: 2.5, headMark: 'postocular', brow: 1.2,
    scale: { kind: 'keeled', len: 2.4, rows: 6 }, bellyScute: 2.4, lure: hex('#cfffe8'), lureLen: 0.075,
  },
  // Titan Constrictor (~600 px, r 14): apex predator; saddles, heavy brows, cold eye, scars, digestion bulge.
  titan: {
    length: 560, radius: 14, profile: [0, 0.6, 0.05, 0.72, 0.18, 0.92, 0.45, 1, 0.7, 0.85, 0.88, 0.45, 1, 0.1],
    dorsal: r('#141a0e', '#1e2714', '#2a361a', '#384620', '#485828', '#5c6c32', '#76843e', '#949e52'),
    belly: hex('#d4c890'), throat: hex('#e0d4a0'), pattern: 'saddles', patternCol: hex('#0e120a'), patternCol2: hex('#b0a868'), period: 34,
    head: 'blunt', eye: hex('#c8a830'), pupil: 'slit', eyeSize: 0.62, brow: 2.4, headMark: 'postocular', smile: -0.35,
    scale: { kind: 'smooth', len: 4.2, rows: 12 }, bellyScute: 5, scars: 5,
  },
  // Finned Leviathan (~900 px, r 24): undulating dorsal fin, rayed pectorals, crimson gill fronds, photophores.
  leviathan: {
    length: 850, radius: 24, profile: [0, 0.78, 0.07, 0.95, 0.25, 1, 0.6, 0.82, 0.86, 0.45, 1, 0.1],
    dorsal: r('#0a1420', '#10202e', '#182e3e', '#223e50', '#2e5064', '#3e6478', '#56808e', '#7aa0a8'),
    belly: hex('#d4e4e0'), throat: hex('#e0ece6'), pattern: 'countershade', patternCol: hex('#0a1620'), patternCol2: hex('#8aa8b0'),
    head: 'leviathan', eye: hex('#e8f0a0'), pupil: 'round', mouthCol: hex('#9a3a56'),
    scale: { kind: 'smooth', len: 5, rows: 14 },
    dorsalFin: { from: 0.05, to: 1, h: 20, col: hex('#3a7890'), rays: 6 },
    ventralFin: { from: 0.58, to: 1, h: 13, col: hex('#3a7890'), rays: 6 },
    gills: hex('#d8384e'), gillLen: 1.8, pectoral: hex('#4a8aa0'), photophores: hex('#8ff8e8'),
  },
  // Mudribbon (~120 px): eel-like mangrove water snake with a paddle tail and nostrils on top.
  mudribbon: {
    length: 112, radius: 3.4, thickAt: 0.35,
    dorsal: r('#16100a', '#241a10', '#342616', '#46341e', '#5a4426', '#705630', '#8a6c3e'),
    belly: hex('#d8c07a'), throat: hex('#e4d098'), pattern: 'rings', patternCol: hex('#e0b83a'), patternCol2: hex('#1a1208'), period: 11,
    head: 'eel', eye: hex('#e8c040'), pupil: 'round', eyeSize: 0.8, nostrilTop: true,
    scale: { kind: 'smooth', len: 2.3, rows: 6 }, paddle: 0.9, wet: 0.6,
  },
  // Crag Viper (~80 px): cliff-climbing egg thief; rough keeled scales, heavy supraoculars, narrow snout.
  cragviper: {
    length: 70, radius: 3.6, thickAt: 0.35,
    dorsal: r('#18191c', '#25272b', '#34373c', '#464a4f', '#5a5e62', '#727578', '#8e908e'),
    belly: hex('#c8c0b0'), throat: hex('#d8d0c0'), pattern: 'zigzag', patternCol: hex('#1a1414'), patternCol2: hex('#a4502c'), period: 9,
    head: 'viper', headLen: 12, headW: 1.15, eye: hex('#ff6a3a'), pupil: 'slit', brow: 2, headMark: 'postocular',
    scale: { kind: 'keeled', len: 2.5, rows: 6 }, bellyScute: 2.4, keeledBelly: true,
  },
  // Ironjaw Crocodile (~220 px): osteoderm armour, mossy back, interlocking teeth, sprawling clawed legs.
  ironjaw: {
    length: 180, radius: 10, profile: [0, 0.7, 0.07, 0.86, 0.18, 1, 0.42, 0.96, 0.55, 0.66, 0.78, 0.36, 1, 0.1],
    dorsal: r('#0e110a', '#171c10', '#212816', '#2c351c', '#394423', '#48552c', '#5a6836', '#707e44'),
    belly: hex('#c8c098'), throat: hex('#d8d0a8'), pattern: 'croc', patternCol: hex('#0c0e08'), patternCol2: hex('#7a7a48'), period: 14,
    head: 'croc', headLen: 40, eye: hex('#d8c030'), pupil: 'slit', brow: 1.2, mouthCol: hex('#dcae9a'), teeth: 'croc',
    scutes: true, osteoderms: { rows: 5, len: 5, crest: 3.2 },
    moss: { col: r('#1a2a10', '#27401a', '#365a1f', '#4a7426', '#608e30', '#7aa63c', '#9cc04e', '#c0d870'), amount: 0.55 },
    legs: [
      { at: 0.1, len: 16, col: CROC_LEG, kind: 'front', digits: 4, claw: hex('#2e2a1e'), thick: 0.4 },
      { at: 0.44, len: 18, col: CROC_LEG, kind: 'hind', digits: 4, claw: hex('#2e2a1e'), thick: 0.46 },
    ],
  },
  // Bark Gecko (~30 px): clings to trunks (SerpentState.vertical), toe pads, violet dewlap (dewlap 0..1).
  barkgecko: {
    length: 25, radius: 2.4, profile: [0, 0.6, 0.08, 0.85, 0.25, 1, 0.42, 0.88, 0.55, 0.55, 0.8, 0.3, 1, 0.1],
    dorsal: GECKO, belly: hex('#c8b8a0'), throat: hex('#d8c8b0'), pattern: 'bark', patternCol: hex('#161210'), patternCol2: hex('#9aa088'), period: 5,
    head: 'gecko', eye: hex('#c8a878'), pupil: 'slit', scale: { kind: 'bead', len: 1.6, rows: 5 },
    dewlap: { col: hex('#8a4ac8'), col2: hex('#f0d8f8'), size: 7 },
    legs: [
      { at: 0.16, len: 6, col: GECKO, kind: 'front', digits: 5, pads: true, thick: 0.5 },
      { at: 0.42, len: 7, col: GECKO, kind: 'hind', digits: 5, pads: true, thick: 0.55 },
    ],
  },
  // Pteramander (~40 px): gliding salamander; skin flaps between the limbs spread with `flatten`.
  pteramander: {
    length: 33, radius: 3.2, profile: [0, 0.75, 0.1, 0.9, 0.3, 1, 0.5, 0.9, 0.6, 0.6, 0.8, 0.35, 1, 0.1],
    dorsal: NEWT, belly: hex('#f0dcb4'), throat: hex('#f4e4c4'), pattern: 'skin', patternCol: hex('#3a1a0c'), patternCol2: hex('#f0c890'),
    head: 'salamander', eye: hex('#d8a040'), pupil: 'round', smile: 1, scale: { kind: 'skin' }, wet: 0.5,
    patagia: { col: hex('#d88a44'), col2: hex('#a45a28') }, glideTop: true,
    legs: [
      { at: 0.14, len: 8, col: NEWT, kind: 'front', digits: 4, claw: hex('#e8b070'), thick: 0.4 },
      { at: 0.42, len: 8.5, col: NEWT, kind: 'hind', digits: 5, claw: hex('#e8b070'), thick: 0.45 },
    ],
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
