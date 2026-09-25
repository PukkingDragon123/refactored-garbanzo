// Procedural "paper doll" character renderer for the expedition crew.
// Characters are drawn facing right in a chunky 3/4 view with big heads (Dave-the-Diver-like),
// from a spec (body build, palette, outfit, hair, accessories) and a pose (animation state).

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix } from './color';
import { PAL, OUTLINE } from './palettes';
import { bayer, clamp } from '../core/math';

export type HairStyle = 'bald' | 'short' | 'bun' | 'curly' | 'bob' | 'messy' | 'none';
export type Hat = 'bucket' | 'bandana' | 'beanie' | 'scarf' | 'captain' | 'none';

export interface CharSpec {
  id: string;
  name: string;
  skin: C[];
  hair: C[];
  hairStyle: HairStyle;
  legLen: number;
  bodyH: number;
  bodyW: number;
  headR: number;
  top: C[];
  top2?: C[];
  bottom: C[];
  shoes: C[];
  hat: Hat;
  hatCol?: C[];
  glasses?: 'round' | 'half' | 'goggles' | 'none';
  beard?: 'full' | 'moustache' | 'stubble' | 'none';
  beardCol?: C[];
  parkaWaist?: boolean;
  vest?: C[];
  apron?: C[];
  overalls?: boolean;
  scarf?: C[];
  coat?: boolean;
  headphones?: boolean;
  cameraStrap?: boolean;
  backpack?: C[];
  toolbelt?: boolean;
  freckles?: boolean;
  shorts?: boolean;
  item?: 'clipboard' | 'ladle' | 'wrench' | 'mug' | 'none';
  eye?: C;
}

export interface Pose {
  bob: number;
  footF: [number, number];
  footB: [number, number];
  armF: number;
  armB: number;
  lean: number;
  crouch: number;
  eyes: 'open' | 'closed' | 'wide' | 'happy' | 'squint';
  mouth: 'closed' | 'open' | 'smile' | 'o' | 'grin';
  camera: 'hang' | 'raised' | 'none';
  headDY: number;
  itemUp?: boolean;
}

export const basePose = (): Pose => ({
  bob: 0, footF: [1, 0], footB: [-1, 0], armF: 0.15, armB: -0.1, lean: 0, crouch: 0,
  eyes: 'open', mouth: 'closed', camera: 'hang', headDY: 0,
});

const O = OUTLINE;
const r5 = (c: C[], i: number) => c[clamp(i, 0, c.length - 1)];

/** Canvas size needed for a spec. */
export function charSize(s: CharSpec) {
  const w = Math.max(s.bodyW + 20, s.headR * 2 + 16);
  const h = s.legLen + s.bodyH + s.headR * 2 + 12;
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

function limb(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, w: number, c: C, c2: C) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let k = 0; k < w; k++) b.set(x + k - (w >> 1), y, k === 0 ? c : c2);
  }
}

export function drawCharacter(s: CharSpec, p: Pose): PixelBuffer {
  const { w, h } = charSize(s);
  const b = new PixelBuffer(w, h);
  const cx = Math.floor(w / 2);
  const ground = h - 1;
  const crouch = p.crouch;
  const legLen = Math.max(2, Math.round(s.legLen * (1 - crouch * 0.55)));
  const hipY = ground - legLen + Math.round(p.bob);
  const bodyH = Math.round(s.bodyH * (1 - crouch * 0.12));
  const bodyTop = hipY - bodyH;
  const lean = p.lean + crouch * 2;
  const bw = s.bodyW;
  const S = s.skin, T = s.top, Bt = s.bottom, Sh = s.shoes;

  // ---------------- backpack (behind everything)
  if (s.backpack) {
    const bx = cx - bw / 2 - 3 + lean * 0.5, by = bodyTop + 3;
    b.shadedEllipse(bx + 2, by + bodyH * 0.35, 4.5, bodyH * 0.42, s.backpack.slice(1, 6), -0.5, -0.6, true);
    // bedroll on top
    b.shadedEllipse(bx + 2, by - 1, 5, 2.4, PAL.canvasOrange.slice(2, 7));
  }

  // ---------------- back arm
  const shoulderY = bodyTop + 4;
  const armLen = Math.round(bodyH * 0.62) + 1;
  const drawArm = (front: boolean) => {
    const ang = front ? p.armF : p.armB;
    const sx = cx + lean + (front ? bw * 0.18 : -bw * 0.3);
    const ex = sx + Math.sin(ang) * armLen, ey = shoulderY + Math.cos(ang) * armLen;
    const sleeve = s.coat ? r5(T, front ? 4 : 2) : r5(s.top2 ?? T, front ? 4 : 2);
    const sleeveEnd = s.coat ? 0.85 : 0.45;
    const mx = sx + (ex - sx) * sleeveEnd, my = shoulderY + (ey - shoulderY) * sleeveEnd;
    limb(b, sx, shoulderY, mx, my, 3, shade(sleeve, 0.1), sleeve);
    limb(b, mx, my, ex, ey, 2, r5(S, front ? 5 : 3), r5(S, front ? 4 : 2));
    b.set(ex, ey + 1, r5(S, front ? 4 : 2));
    b.set(ex + 1, ey, r5(S, front ? 5 : 3));
    return [ex, ey];
  };
  if (p.camera !== 'raised') drawArm(false);

  // ---------------- legs
  const drawLeg = (front: boolean) => {
    const f = front ? p.footF : p.footB;
    const hx = cx + lean * 0.3 + (front ? 2 : -2);
    const fx = hx + f[0], fy = ground - f[1];
    const col = r5(Bt, front ? 4 : 2), col2 = r5(Bt, front ? 3 : 1);
    const knee = s.shorts ? 0.45 : 1;
    const kx = hx + (fx - hx) * knee, ky = hipY + (fy - 2 - hipY) * knee;
    limb(b, hx, hipY, kx, ky, 3, col, col2);
    if (s.shorts) limb(b, kx, ky, fx, fy - 2, 2, r5(S, front ? 4 : 2), r5(S, front ? 3 : 1));
    // boot
    const sc = r5(Sh, front ? 4 : 2), sc2 = r5(Sh, front ? 2 : 1);
    b.rect(fx - 1, fy - 2, 4, 2, sc);
    b.rect(fx - 1, fy - 0, 5, 1, sc2);
    b.set(fx + 3, fy - 1, sc);
  };
  drawLeg(false);
  drawLeg(true);

  // ---------------- body / torso
  const bcx = cx + lean, bcy = bodyTop + bodyH / 2;
  const topRamp = s.coat ? T : T;
  b.ellipseFn(bcx, bcy + 1, bw / 2, bodyH / 2 + 1, (x, y, nx, ny) => {
    if (y > hipY + 1) return -1;
    let l = -nx * 0.55 - ny * 0.35 + (bayer(x, y) - 0.5) * 0.3;
    return r5(topRamp, Math.round((l * 0.5 + 0.5) * 5) + 1);
  });
  // lower torso: trousers/overalls/coat skirt
  const beltY = hipY - Math.max(2, Math.round(bodyH * 0.18));
  if (!s.coat) {
    for (let y = beltY; y <= hipY + 1; y++)
      for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) {
        if (!b.opaque(x, y)) continue;
        const nx = (x - bcx) / (bw / 2);
        b.set(x, y, r5(Bt, nx < -0.3 ? 5 : nx > 0.4 ? 2 : 4));
      }
    // belt
    for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) if (b.opaque(x, beltY)) b.set(x, beltY, PAL.bark[2]);
    b.set(bcx + 1, beltY, PAL.yellow[5]);
  } else {
    // long coat hem flares below the hips
    for (let y = hipY - 2; y < hipY + Math.round(s.legLen * 0.55); y++) {
      const t = (y - hipY + 2) / (s.legLen * 0.55);
      const half = bw / 2 + t * 1.5;
      for (let x = Math.floor(bcx - half); x <= bcx + half; x++) {
        const nx = (x - bcx) / half;
        if (Math.abs(nx) < 0.12 && y > hipY) continue; // vent
        b.set(x, y, r5(T, nx < -0.3 ? 5 : nx > 0.4 ? 2 : 3));
      }
    }
    // coat lapel line & buttons
    for (let y = bodyTop + 3; y < hipY; y++) b.paint(bcx + 2, y, r5(T, 1));
    for (let y = bodyTop + 6; y < hipY; y += 4) b.paint(bcx + 3, y, PAL.metal[5]);
  }
  if (s.overalls) {
    // bib and straps
    const ov = Bt;
    for (let y = bodyTop + 5; y < beltY; y++)
      for (let x = Math.floor(bcx - bw * 0.3); x <= bcx + bw * 0.3; x++) b.paint(x, y, r5(ov, (x - bcx) < -1 ? 5 : 4));
    for (let y = bodyTop + 1; y < bodyTop + 6; y++) {
      b.paint(bcx - bw * 0.3, y, r5(ov, 4));
      b.paint(bcx + bw * 0.3 - 1, y, r5(ov, 3));
    }
    b.paint(bcx - bw * 0.3, bodyTop + 5, PAL.yellow[5]);
    b.rect(bcx - 1, bodyTop + 8, 3, 2, r5(ov, 2));
    // oil stains
    b.paint(bcx - 3, beltY + 2, hex('#1a1d24'));
    b.paint(bcx + 4, bodyTop + 10, hex('#1a1d24'));
  }
  if (s.vest) {
    const V = s.vest;
    for (let y = bodyTop + 1; y < beltY; y++)
      for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) {
        const nx = (x - bcx) / (bw / 2);
        if (!b.opaque(x, y)) continue;
        if (nx > -0.05 && nx < 0.25 && y < bodyTop + bodyH * 0.55) continue; // open front shows shirt
        b.set(x, y, r5(V, nx < -0.4 ? 5 : nx > 0.5 ? 2 : 4));
      }
    // pockets
    for (const px of [bcx - bw * 0.32, bcx + bw * 0.28]) {
      b.paint(px, bodyTop + bodyH * 0.55, r5(V, 2));
      b.paint(px + 1, bodyTop + bodyH * 0.55, r5(V, 2));
      b.paint(px + 2, bodyTop + bodyH * 0.55, r5(V, 2));
      b.paint(px + 1, bodyTop + bodyH * 0.55 + 1, r5(V, 6));
    }
  }
  if (s.apron) {
    const A = s.apron;
    for (let y = bodyTop + 5; y < hipY + 3; y++)
      for (let x = Math.floor(bcx - bw * 0.36); x <= bcx + bw * 0.38; x++) {
        if (y < hipY && !b.opaque(x, y)) continue;
        b.set(x, y, r5(A, (x - bcx) < -2 ? 5 : 4));
      }
    b.rect(bcx - 2, beltY + 1, 5, 3, r5(A, 3));
    for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) if (b.opaque(x, beltY - 1)) b.set(x, beltY - 1, r5(A, 2));
  }
  if (s.parkaWaist) {
    // Antarctic parka tied around the waist, sleeves knotted in front
    const P = PAL.canvasOrange;
    for (let y = beltY - 1; y <= hipY + 2; y++)
      for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) {
        const nx = (x - bcx) / (bw / 2);
        if (Math.abs(nx) > 1 || !b.opaque(x, Math.min(y, hipY))) continue;
        if (y > beltY + 2 && nx > -0.45) continue;
        b.set(x, y, r5(P, nx < -0.4 ? 6 : nx > 0.5 ? 3 : 5));
      }
    // fur trim row
    for (let x = Math.floor(bcx - bw / 2 - 1); x <= bcx + bw / 2 + 1; x++) if ((x & 1) === 0) b.set(x, beltY - 1, PAL.white[6]);
    // knot
    b.shadedEllipse(bcx + bw * 0.3, beltY + 2, 2.4, 2, P.slice(3, 7));
    b.set(bcx + bw * 0.3 + 1, beltY + 5, P[4]);
    b.set(bcx + bw * 0.3 + 2, beltY + 6, P[3]);
  }
  if (s.toolbelt) {
    for (let x = Math.floor(bcx - bw / 2); x <= bcx + bw / 2; x++) if (b.opaque(x, beltY)) b.set(x, beltY, PAL.bark[4]);
    b.rect(bcx - bw / 2, beltY + 1, 3, 3, PAL.bark[3]);
    b.rect(bcx + 2, beltY + 1, 2, 4, PAL.metal[5]);
    b.set(bcx + bw / 2 - 2, beltY + 1, PAL.glowCyan[5]);
  }
  if (s.scarf) {
    const Sc = s.scarf;
    for (let x = Math.floor(bcx - bw * 0.4); x <= bcx + bw * 0.45; x++) {
      b.set(x, bodyTop, r5(Sc, 4));
      b.set(x, bodyTop + 1, r5(Sc, 3));
    }
    for (let y = bodyTop + 1; y < bodyTop + 8; y++) b.set(bcx - bw * 0.35 + (y - bodyTop) * 0.2, y, r5(Sc, y % 2 ? 4 : 3));
  }

  // camera hanging on the chest
  if (s.cameraStrap) {
    for (let y = bodyTop; y < bodyTop + bodyH * 0.55; y++) {
      const t = (y - bodyTop) / (bodyH * 0.55);
      b.set(bcx - bw * 0.35 + t * bw * 0.7, y, PAL.bark[1]);
    }
    if (p.camera === 'hang') {
      const camY = Math.round(bodyTop + bodyH * 0.5);
      const camX = Math.round(bcx + bw * 0.1);
      b.rect(camX - 3, camY, 7, 5, PAL.metal[2]);
      b.rect(camX - 3, camY, 7, 1, PAL.metal[4]);
      b.rect(camX + 3, camY + 1, 3, 3, PAL.metal[1]);
      b.set(camX + 4, camY + 2, hex('#4c6f86'));
      b.set(camX - 2, camY + 1, PAL.red[6]);
    }
  }

  // ---------------- head
  const headR = s.headR;
  const hcx = bcx + 1 + Math.round(lean * 0.4);
  const hcy = bodyTop - headR + 3 + p.headDY;
  // ears / hair back
  if (s.hairStyle === 'bun') {
    b.shadedEllipse(hcx - headR * 0.55, hcy - headR * 0.75, headR * 0.45, headR * 0.42, s.hair.slice(1, 6));
  }
  if (s.hairStyle === 'curly' || s.hat === 'scarf') {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      b.shadedEllipse(hcx - 1 + Math.cos(a) * headR * 0.95, hcy - 1 + Math.sin(a) * headR * 0.9, headR * 0.35, headR * 0.35, s.hair.slice(1, 6));
    }
  }
  b.ellipseFn(hcx, hcy, headR, headR * 0.95, (x, y, nx, ny) => {
    let l = -nx * 0.35 - ny * 0.45 + (nx > 0.55 ? -0.25 : 0) + (bayer(x, y) - 0.5) * 0.2;
    return r5(S, Math.round((l * 0.5 + 0.5) * 4) + 2);
  });
  // ear
  b.set(hcx - headR * 0.35, hcy + 1, r5(S, 3));
  b.set(hcx - headR * 0.35, hcy + 2, r5(S, 2));
  // face (facing right): eyes near the right side
  const ex1 = Math.round(hcx + headR * 0.12), ex2 = Math.round(hcx + headR * 0.62);
  const ey = Math.round(hcy + (s.hat === 'none' && s.hairStyle === 'bald' ? 0 : 1));
  const eyeC = s.eye ?? hex('#1d1512');
  const drawEye = (x: number) => {
    switch (p.eyes) {
      case 'closed':
        b.set(x - 1, ey + 1, r5(S, 1));
        b.set(x, ey + 1, r5(S, 1));
        break;
      case 'happy':
        b.set(x - 1, ey + 1, eyeC);
        b.set(x, ey, eyeC);
        b.set(x + 1, ey + 1, eyeC);
        break;
      case 'wide':
        b.set(x, ey - 1, eyeC);
        b.set(x, ey, eyeC);
        b.set(x, ey + 1, eyeC);
        b.set(x - 1, ey, hex('#f4f0e8'));
        break;
      case 'squint':
        b.set(x - 1, ey, eyeC);
        b.set(x, ey, eyeC);
        break;
      default:
        b.set(x, ey, eyeC);
        b.set(x, ey + 1, eyeC);
    }
  };
  drawEye(ex1);
  drawEye(ex2);
  // nose
  b.set(hcx + headR * 0.95, ey + 2, r5(S, 3));
  b.set(hcx + headR * 0.95 - 1, ey + 3, r5(S, 2));
  // mouth
  const my = ey + 5, mx = Math.round(hcx + headR * 0.45);
  const mouthC = hex('#5a2a22');
  switch (p.mouth) {
    case 'open': b.rect(mx - 1, my, 3, 2, mouthC); break;
    case 'o': b.rect(mx, my - 1, 2, 3, mouthC); break;
    case 'smile': b.set(mx - 1, my - 1, mouthC); b.rect(mx, my, 2, 1, mouthC); b.set(mx + 2, my - 1, mouthC); break;
    case 'grin': b.rect(mx - 1, my, 4, 2, mouthC); b.rect(mx, my, 2, 1, hex('#f4f0e8')); break;
    default: b.rect(mx, my, 2, 1, mouthC);
  }
  if (s.freckles) {
    b.set(ex1 + 1, ey + 3, r5(S, 3));
    b.set(ex2 + 1, ey + 3, r5(S, 3));
    b.set(ex1 + 3, ey + 2, r5(S, 3));
  }
  // beard
  if (s.beard && s.beard !== 'none') {
    const Bd = s.beardCol ?? s.hair;
    if (s.beard === 'full') {
      b.ellipseFn(hcx + 1, hcy + headR * 0.72, headR * 0.9, headR * 0.45, (x, y, nx, ny) => {
        if (ny < -0.25) return -1;
        if (nx > 0.2 && nx < 0.62 && ny < 0.15 && ny > -0.25) return -1; // mouth gap
        return r5(Bd, nx < -0.3 ? 4 : (x + y) % 3 === 0 ? 2 : 3);
      });
      b.rect(mx - 1, my - 1, 4, 1, r5(Bd, 3));
    } else if (s.beard === 'moustache') {
      b.rect(mx - 2, my - 1, 5, 1, r5(Bd, 3));
      b.set(mx - 2, my, r5(Bd, 2));
    } else {
      for (let x = hcx - 2; x < hcx + headR; x++) for (let y = my - 1; y < hcy + headR; y++) if ((x + y) % 2 === 0) b.paint(x, y, shade(r5(S, 3), -0.15));
    }
  }
  // glasses
  if (s.glasses === 'round') {
    const rim = hex('#2a2320');
    for (const gx of [ex1, ex2]) {
      b.set(gx - 1, ey - 1, rim); b.set(gx + 1, ey - 1, rim); b.set(gx - 1, ey + 2, rim); b.set(gx + 1, ey + 2, rim);
      b.set(gx - 2, ey, rim); b.set(gx - 2, ey + 1, rim); b.set(gx + 2, ey, rim); b.set(gx + 2, ey + 1, rim);
      b.set(gx + 1, ey, hex('#e8f6fa'));
      b.set(gx - 1, ey, hex('#bcd6de'));
    }
    b.set(ex1 + 2, ey, rim);
    b.set(ex1 + 3, ey, rim);
  } else if (s.glasses === 'half') {
    for (const gx of [ex1, ex2]) {
      b.set(gx - 1, ey + 2, O); b.set(gx, ey + 2, O); b.set(gx + 1, ey + 2, O);
      b.set(gx - 1, ey + 1, hex('#9fb8c0')); b.set(gx + 1, ey + 1, hex('#9fb8c0'));
    }
    // chain
    for (let x = hcx - headR * 0.3; x < ex1; x++) b.set(x, ey + 3 + (ex1 - x) * 0.3, PAL.yellow[5]);
  }
  // hair / hats
  const H = s.hair;
  const hairCap = (depth: number) => {
    b.ellipseFn(hcx - 1, hcy - 1, headR + 0.6, headR * 0.95 + 0.6, (x, y, nx, ny) => {
      if (ny > depth - Math.max(0, nx) * 0.9) return -1;
      if (nx > 0.35 && ny > -0.45) return -1; // forehead/face kept clear
      let l = -nx * 0.3 - ny * 0.5 + (bayer(x, y) - 0.5) * 0.3;
      return r5(H, Math.round((l * 0.5 + 0.5) * 4) + 1);
    });
  };
  switch (s.hairStyle) {
    case 'short': hairCap(-0.1); break;
    case 'messy':
      hairCap(0.0);
      for (let i = 0; i < 6; i++) b.set(hcx - headR * 0.6 + i * 2, hcy - headR - 1 - (i % 2), r5(H, 3));
      break;
    case 'bun':
      hairCap(-0.2);
      // pencil through the bun
      b.line(hcx - headR * 1.1, hcy - headR * 1.2, hcx - headR * 0.1, hcy - headR * 0.5, PAL.yellow[5]);
      b.set(hcx - headR * 1.1, hcy - headR * 1.2, PAL.flowerPink[4]);
      // silver streak
      for (let i = 0; i < 4; i++) b.set(hcx - 2 + i, hcy - headR + 1, PAL.white[5]);
      break;
    case 'curly': hairCap(0.1); break;
    case 'bob':
      hairCap(0.35);
      for (let y = hcy - 2; y < hcy + headR * 0.6; y++) {
        b.set(hcx - headR + 0.5, y, r5(H, 3));
        b.set(hcx - headR + 1.5, y, r5(H, 2));
      }
      break;
    default:
  }
  switch (s.hat) {
    case 'bucket': {
      const Hc = s.hatCol ?? PAL.canvas;
      b.ellipseFn(hcx - 1, hcy - headR * 0.55, headR * 0.92, headR * 0.62, (x, y, nx, ny) => (ny > 0.25 ? -1 : r5(Hc, nx < -0.2 ? 5 : nx > 0.5 ? 2 : 4)));
      // brim
      for (let x = Math.floor(hcx - headR - 3); x <= hcx + headR + 3; x++) {
        b.set(x, hcy - headR * 0.35, r5(Hc, 3));
        b.set(x, hcy - headR * 0.35 + 1, r5(Hc, 1));
      }
      // band
      for (let x = Math.floor(hcx - headR * 0.9); x < hcx + headR * 0.85; x++) b.set(x, hcy - headR * 0.5, r5(PAL.bark, 3));
      break;
    }
    case 'bandana': {
      const Hc = s.hatCol ?? PAL.red;
      b.ellipseFn(hcx - 1, hcy - 1, headR + 0.6, headR * 0.95 + 0.6, (x, y, nx, ny) => (ny > -0.35 ? -1 : r5(Hc, nx < -0.2 ? 5 : 3 + ((x + y) % 4 === 0 ? 2 : 0))));
      b.set(hcx - headR - 1, hcy - 2, r5(Hc, 4));
      b.set(hcx - headR - 2, hcy - 1, r5(Hc, 3));
      b.set(hcx - headR - 2, hcy, r5(Hc, 4));
      break;
    }
    case 'beanie': {
      const Hc = s.hatCol ?? PAL.blue;
      b.ellipseFn(hcx - 1, hcy - headR * 0.35, headR + 0.5, headR * 0.8, (x, y, nx, ny) => (ny > -0.05 ? -1 : r5(Hc, (x % 2 === 0 ? 1 : 0) + (nx < 0 ? 4 : 3))));
      for (let x = Math.floor(hcx - headR - 0.5); x <= hcx + headR - 0.5; x++) b.set(x, hcy - headR * 0.35, r5(Hc, 2));
      b.disc(hcx - 2, hcy - headR * 1.15, 1.6, r5(Hc, 5));
      break;
    }
    case 'scarf': {
      const Hc = s.hatCol ?? PAL.yellow;
      b.ellipseFn(hcx - 1, hcy - headR * 0.4, headR + 1.4, headR * 0.85, (x, y, nx, ny) => (ny > 0.0 ? -1 : (x + y) % 5 < 2 ? r5(PAL.canvasOrange, 5) : r5(Hc, nx < 0 ? 5 : 4)));
      b.shadedEllipse(hcx - headR * 0.2, hcy - headR * 1.25, 3, 2.2, Hc.slice(2, 7));
      break;
    }
    case 'captain': {
      const Hc = s.hatCol ?? PAL.blue;
      b.ellipseFn(hcx - 1, hcy - headR * 0.62, headR * 0.95, headR * 0.5, (_x, _y, nx, ny) => (ny > 0.35 ? -1 : r5(Hc, nx < 0 ? 4 : 3)));
      for (let x = Math.floor(hcx - headR * 0.8); x <= hcx + headR * 0.8; x++) b.set(x, hcy - headR * 0.9, PAL.white[6]);
      for (let x = Math.floor(hcx); x <= hcx + headR + 1; x++) b.set(x, hcy - headR * 0.35, PAL.metal[1]);
      b.set(hcx + 1, hcy - headR * 0.6, PAL.yellow[6]);
      break;
    }
    default:
  }
  if (s.glasses === 'goggles') {
    // goggles pushed up on the forehead
    const gy = Math.round(hcy - headR * 0.45);
    for (let x = Math.floor(hcx - headR); x <= hcx + headR; x++) b.set(x, gy, PAL.bark[2]);
    for (const gx of [hcx + 1, hcx + headR * 0.7]) {
      b.disc(gx, gy, 2.2, PAL.metal[2]);
      b.disc(gx, gy, 1.3, hex('#7fd6e0'));
      b.set(gx - 1, gy - 1, hex('#e8fbff'));
    }
  }
  if (s.headphones) {
    for (let x = Math.floor(bcx - 3); x <= bcx + 4; x++) b.set(x, bodyTop + 3 - Math.abs(x - bcx) * 0.3, PAL.metal[2]);
    b.shadedEllipse(bcx - 4, bodyTop + 2, 2, 2.2, PAL.metal.slice(1, 6));
    b.shadedEllipse(bcx + 4, bodyTop + 3, 2, 2.2, PAL.metal.slice(1, 6));
  }

  // ---------------- front arm & held items
  if (p.camera === 'raised') {
    // both hands up holding the camera to the eye
    const camX = Math.round(hcx + headR * 0.75), camY = Math.round(ey);
    const sx = cx + lean + bw * 0.1;
    limb(b, sx - bw * 0.3, shoulderY, camX - 3, camY + 4, 3, r5(T, 2), r5(T, 1));
    limb(b, sx, shoulderY, camX - 1, camY + 5, 3, r5(T, 4), r5(T, 3));
    b.rect(camX - 3, camY - 2, 8, 6, PAL.metal[2]);
    b.rect(camX - 3, camY - 2, 8, 1, PAL.metal[4]);
    b.rect(camX + 5, camY - 1, 4, 4, PAL.metal[1]);
    b.rect(camX + 9, camY - 1, 1, 4, PAL.metal[3]);
    b.set(camX + 7, camY, hex('#6fa0c0'));
    b.set(camX - 1, camY - 3, PAL.metal[3]);
    b.set(camX, camY - 3, PAL.red[6]);
    b.set(camX - 2, camY + 3, r5(S, 4));
    b.set(camX + 4, camY + 4, r5(S, 5));
  } else {
    const [hx, hy] = drawArm(true);
    if (s.item === 'clipboard') {
      b.rect(hx - 1, hy - 5, 5, 7, PAL.bark[5]);
      b.rect(hx, hy - 4, 3, 5, PAL.white[6]);
      b.set(hx + 1, hy - 5, PAL.metal[5]);
    } else if (s.item === 'ladle') {
      b.line(hx, hy, hx + 3, hy - 9, PAL.metal[5]);
      b.rect(hx + 2, hy - 11, 3, 2, PAL.metal[4]);
    } else if (s.item === 'wrench') {
      b.line(hx, hy, hx + 1, hy + 7, PAL.metal[5]);
      b.rect(hx, hy + 7, 3, 2, PAL.metal[5]);
    } else if (s.item === 'mug') {
      b.rect(hx, hy - 3, 3, 3, PAL.white[6]);
      b.set(hx + 3, hy - 2, PAL.white[5]);
    }
  }

  b.outline(O);
  return b;
}

// ------------------------------------------------------------------ crew specs
export const CREW: Record<string, CharSpec> = {
  otis: {
    id: 'otis', name: 'Otis Finch', skin: PAL.skin3, hair: PAL.bark, hairStyle: 'short',
    legLen: 7, bodyH: 16, bodyW: 16, headR: 7,
    top: [hex('#3a3527'), hex('#5c5540'), hex('#857c5d'), hex('#b0a67e'), hex('#d6cda3'), hex('#ece5c2'), hex('#f7f2dc')],
    bottom: [hex('#2f2a1c'), hex('#4a4230'), hex('#6b6046'), hex('#8e8160'), hex('#ada07c'), hex('#c8bc98')],
    shoes: PAL.bark, hat: 'bucket', hatCol: PAL.canvas, glasses: 'round', beard: 'full', beardCol: PAL.bark,
    parkaWaist: true, vest: PAL.olive, cameraStrap: true, backpack: PAL.olive, shorts: true,
  },
  imogen: {
    id: 'imogen', name: 'Dr. Imogen Vance', skin: PAL.skin1, hair: [hex('#0f0e12'), hex('#1b1a20'), hex('#2a2830'), hex('#3c3a44'), hex('#595863'), hex('#8a8a94')],
    hairStyle: 'bun', legLen: 12, bodyH: 18, bodyW: 11, headR: 6,
    top: [hex('#2a2616'), hex('#443d24'), hex('#655a35'), hex('#877a4a'), hex('#a69861'), hex('#c4b67d'), hex('#ddd09b')],
    bottom: PAL.bark, shoes: [hex('#140c08'), hex('#22150e'), hex('#352216'), hex('#4b3120'), hex('#62412b')],
    hat: 'none', glasses: 'half', scarf: PAL.glowCyan.slice(0).map(c => shade(c, -0.35)), coat: true, freckles: true, item: 'clipboard',
  },
  bolt: {
    id: 'bolt', name: 'Bolt Okonkwo', skin: PAL.skin2, hair: [hex('#0b0908'), hex('#15110e'), hex('#221b16'), hex('#30261f'), hex('#40342a')],
    hairStyle: 'bald', legLen: 10, bodyH: 23, bodyW: 22, headR: 7,
    top: [hex('#3a3a36'), hex('#5a5a54'), hex('#7d7c74'), hex('#a09e94'), hex('#c2bfb3'), hex('#dcd9cd'), hex('#efece2')],
    bottom: PAL.blue, shoes: PAL.bark, hat: 'bandana', hatCol: PAL.red, beard: 'full',
    beardCol: [hex('#0b0908'), hex('#15110e'), hex('#221b16'), hex('#30261f'), hex('#40342a')], overalls: true, item: 'wrench',
  },
  pip: {
    id: 'pip', name: 'Pip Nakamura', skin: PAL.skin1, hair: [hex('#0c2b2d'), hex('#12474a'), hex('#176a68'), hex('#1e8f86'), hex('#3cb7a6'), hex('#79dcc6')],
    hairStyle: 'bob', legLen: 6, bodyH: 11, bodyW: 11, headR: 7,
    top: PAL.yellow, bottom: [hex('#1d1b2b'), hex('#2c2a42'), hex('#3d3a5c'), hex('#524e78'), hex('#6c6896'), hex('#8b87b3')],
    shoes: [hex('#3b0f1a'), hex('#6a1a2c'), hex('#a02a3e'), hex('#d24a55'), hex('#f07a7a')], hat: 'none', glasses: 'goggles', toolbelt: true,
    backpack: PAL.metal,
  },
  lou: {
    id: 'lou', name: 'Mama Lou Delacroix', skin: PAL.skin2, hair: [hex('#1a1614'), hex('#2e2724'), hex('#4a403b'), hex('#6e6560'), hex('#9a918b')],
    hairStyle: 'curly', legLen: 6, bodyH: 17, bodyW: 19, headR: 7,
    top: PAL.red, bottom: [hex('#2b1d14'), hex('#43301f'), hex('#5e452c'), hex('#7a5b3a'), hex('#96734b')],
    shoes: PAL.bark, hat: 'scarf', hatCol: PAL.yellow, apron: PAL.white, item: 'ladle',
  },
  sid: {
    id: 'sid', name: 'Sid "Static" Ortega', skin: PAL.skin3, hair: [hex('#0b0a0c'), hex('#171519'), hex('#242127'), hex('#342f38'), hex('#4a4450')],
    hairStyle: 'messy', legLen: 11, bodyH: 14, bodyW: 10, headR: 6,
    top: PAL.flowerViolet, bottom: [hex('#16181c'), hex('#23262c'), hex('#32363e'), hex('#454a54'), hex('#5d636e')],
    shoes: PAL.white, hat: 'beanie', hatCol: PAL.canvasOrange, headphones: true, beard: 'stubble',
  },
  captain: {
    id: 'captain', name: 'Captain Sol Brannigan', skin: PAL.skin1, hair: PAL.white, hairStyle: 'short',
    legLen: 9, bodyH: 19, bodyW: 18, headR: 7,
    top: PAL.yellow, bottom: PAL.blue, shoes: PAL.metal, hat: 'captain', hatCol: PAL.blue, beard: 'full', beardCol: PAL.white,
    coat: true, item: 'mug',
  },
};

/** Standard animation sets rendered for every crew member. */
export function walkPose(t: number, speed = 1): Pose {
  const p = basePose();
  const s = Math.sin(t * Math.PI * 2);
  const c = Math.cos(t * Math.PI * 2);
  p.footF = [Math.round(s * 3 * speed), Math.max(0, Math.round(c * 2 * speed))];
  p.footB = [Math.round(-s * 3 * speed), Math.max(0, Math.round(-c * 2 * speed))];
  p.armF = -s * 0.6 * speed;
  p.armB = s * 0.6 * speed;
  p.bob = -Math.abs(c) * 1.2 * speed + 0.5;
  p.lean = speed > 1.2 ? 2 : 1;
  return p;
}

export function idlePose(t: number): Pose {
  const p = basePose();
  p.bob = Math.sin(t * Math.PI * 2) > 0.3 ? -1 : 0;
  p.armF = 0.12 + Math.sin(t * Math.PI * 2) * 0.05;
  return p;
}

export { mix };
