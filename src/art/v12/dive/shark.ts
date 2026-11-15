// V12 Te Moana Rimurimu: the Glasseye Whaler (Carcharhinus vitreus, invented), the bronze whaler shark
// of the drop-off and the blue, painted with the dive's fish kit (./fishkit.ts) in the user's reference
// fish style.
//
// Anatomy, from the snout back: a rounded, pointed snout scored with old pale scars (one deep notch on
// the tip), the nostril slit under it, the glass eye (a pale silvery iris round a pin-prick pupil, the
// "glasseye"), the mouth slung under the head (the lower jaw hinges open on a row of narrow serrated
// teeth; the third eyelid rolls up white when it bites), five gill slits in a curving row with the lit
// back edge of each flap, the long falcate pectorals hung under the last slits, the tall falcate first
// dorsal (an old nick torn out of its trailing edge), the pelvics, the small second dorsal and anal
// fins, and the heterocercal tail with its long upper lobe and the terminal lobe notched under its tip.
// The skin is a countershaded bronze: a dark olive-bronze back with a copper sheen, a bronze-grey flank
// with the ridge of the swimming muscle catching the light along it, a white belly whose edge pushes a
// pale tongue forward along the flank over the pelvics, dusky fin tips, a faint lateral line, and the
// healed crescent of tooth marks from some old fight behind the gills.
//
// Anims (anchor: the body's middle on the axis, facing right): idle, swim (patrol), fast, turn (the body
// foreshortens and the far pectoral shows; play it forward, flip, play it back), hunch (the warning: back
// humped, snout up, pectorals pressed straight down, a stiff exaggerated swim), charge, veer (a hard
// pull-away, pectorals flared), bite (jaws open, the eye rolls white, the head shakes).

import { hex } from '../../color';
import { pal, tone, body, fin, blob, fan, pose, smooth, segDist, inPoly, fishDef } from './fishkit';
import type { FishArt, FishPose, Pt, Part } from './fishkit';
import type { AnimDef } from '../../beasts-core';

const TAU = Math.PI * 2;

function glasseye(): FishArt {
  const back = pal('#15130d', '#221e14', '#322b1b', '#463b24', '#5d4f2e', '#78663a');
  const side = pal('#2e2a1f', '#433d2b', '#5c5439', '#786e4b', '#978b5f', '#b9ac7c');
  const belly = pal('#7d817f', '#a3a7a4', '#c5c8c3', '#dfe1dc', '#eff0eb', '#fdfdf8');
  const sheen = pal('#3a2a1a', '#523b23', '#6e4f2d', '#8d683a', '#b0864c', '#d6ad6c');
  const finM = pal('#141109', '#1f1b11', '#2d2719', '#3e3522', '#53472d', '#6c5e3b');
  const finD = pal('#0b0a07', '#12100b', '#1a1710', '#242016', '#30291c', '#3d3524');
  const scar = pal('#5c5446', '#7e7462', '#a59a84', '#c7bca4', '#e2d8c2', '#f6eedc');
  const mouthR = pal('#1a0608', '#2e0c10', '#4a1418', '#6a2026', '#8e3236', '#b44a4a');
  const ink = hex('#0b0906');

  const top: Pt[] = [[0.24, -0.036], [0.3, -0.044], [0.36, -0.055], [0.44, -0.072], [0.52, -0.09], [0.6, -0.103], [0.67, -0.107], [0.74, -0.1], [0.8, -0.086], [0.86, -0.066], [0.91, -0.046], [0.95, -0.028], [0.978, -0.013], [0.994, -0.004], [1.0, 0.003]];
  const bot: Pt[] = [[0.24, 0.024], [0.32, 0.036], [0.42, 0.058], [0.52, 0.078], [0.6, 0.09], [0.68, 0.093], [0.75, 0.086], [0.81, 0.074], [0.85, 0.064], [0.875, 0.056], [0.905, 0.047], [0.935, 0.038], [0.962, 0.026], [0.985, 0.012], [1.0, 0.005]];
  // the five gill slits: x at the middle of each and its half-height (they shorten toward the back)
  const SL: [number, number][] = [[0.846, 0.03], [0.833, 0.033], [0.82, 0.035], [0.807, 0.035], [0.794, 0.032]];
  const slitX = (k: number, y: number) => SL[k][0] - Math.pow((y - 0.014) / SL[k][1], 2) * 0.006;
  // old bite scar: a crescent of tooth marks on the flank behind the gills
  const BITE: Pt[] = [];
  for (let i = 0; i < 8; i++) { const a = -0.8 + i * 0.22; BITE.push([0.7 + Math.cos(a) * 0.045, 0.004 + Math.sin(a) * 0.032]); }
  // snout scars: pale healed strokes (fights, the reef, boat hulls)
  const SCARS: [Pt, Pt][] = [[[0.938, -0.03], [0.958, -0.014]], [[0.958, -0.022], [0.972, -0.008]]];
  const pecPts: Pt[] = [[0.795, 0.04], [0.785, 0.075], [0.765, 0.105], [0.735, 0.135], [0.7, 0.158], [0.662, 0.174], [0.64, 0.18], [0.645, 0.17], [0.665, 0.15], [0.69, 0.12], [0.71, 0.092], [0.722, 0.072], [0.732, 0.062]];
  const pivot: Pt = [0.77, 0.055];
  // the mouth: hinged at its corner, the upper jaw line running forward under the snout
  const HX = 0.864, HY = 0.06, UA = Math.atan2(0.034 - HY, 0.957 - HX), JL = 0.097;
  let B!: ReturnType<typeof body>;
  const parts: Part[] = [];
  // the far pectoral (turns and the hunch): darker, behind the body
  parts.push(fin({
    ...fan([0.772, 0.04], [0.738, 0.054], pecPts.slice(2, 9).map(([x, y]) => [x + 0.012, y - 0.006] as Pt), 6),
    ramp: finD, z: 2, t: 2.2, grad: 0.6, alpha: 255, rayK: 0.3, ink: true,
    move: () => ({ cx: pivot[0], cy: pivot[1], a: -(pose().pec2 ?? pose().pec ?? 0) + 0.1, dy: -0.004 }),
    when: () => !!pose().far,
  }));
  // the tail: heterocercal, the long upper lobe with its terminal lobe and the notch under it
  parts.push(fin({
    pts: [[0.272, -0.036], [0.2, -0.05], [0.13, -0.076], [0.07, -0.106], [0.03, -0.131], [0.006, -0.149], [-0.002, -0.142], [0.01, -0.124], [0.03, -0.113], [0.044, -0.1], [0.062, -0.083], [0.09, -0.059], [0.122, -0.032], [0.15, -0.008], [0.132, 0.02], [0.108, 0.054], [0.088, 0.088], [0.104, 0.09], [0.146, 0.064], [0.196, 0.038], [0.24, 0.026], [0.272, 0.022]],
    rays: [[[0.26, -0.03], [0.02, -0.135]], [[0.25, -0.02], [0.06, -0.09]], [[0.24, -0.01], [0.13, -0.02]], [[0.24, 0.005], [0.13, 0.03]], [[0.24, 0.015], [0.095, 0.08]]],
    ramp: finM, z: 4, t: 2.3, grad: 0.9, alpha: 255, rayK: 0.35, ink: false,
    mark: (p, f) => {
      // dusky trailing edge and lobe tips
      const tipU = p.x < 0.06 && p.y < -0.09, tipL = p.y > 0.06;
      if ((tipU || tipL) && f.a > 0.7) return tone(finD, f.t - 0.6);
      return null;
    },
  }));
  // second dorsal and anal: small, low, the free rear tips trailing
  parts.push(fin({ pts: [[0.336, -0.044], [0.322, -0.062], [0.308, -0.072], [0.298, -0.072], [0.296, -0.062], [0.282, -0.046], [0.274, -0.043], [0.3, -0.04]], rays: [[[0.32, -0.044], [0.305, -0.07]]], ramp: finM, z: 4, t: 2.4, alpha: 255, rayK: 0.3 }));
  parts.push(fin({ pts: [[0.33, 0.034], [0.318, 0.05], [0.304, 0.06], [0.294, 0.06], [0.292, 0.05], [0.278, 0.036], [0.27, 0.032], [0.3, 0.03]], rays: [[[0.315, 0.035], [0.3, 0.058]]], ramp: finM, z: 4, t: 2.6, alpha: 255, rayK: 0.3 }));
  // pelvic fins
  parts.push(fin({ pts: [[0.488, 0.06], [0.47, 0.08], [0.448, 0.094], [0.432, 0.097], [0.434, 0.086], [0.44, 0.074], [0.43, 0.062], [0.46, 0.058]], rays: [[[0.47, 0.062], [0.44, 0.094]]], ramp: finM, z: 4, t: 2.6, alpha: 255, rayK: 0.3 }));
  // the first dorsal: tall and falcate, an old nick in its trailing edge
  parts.push(fin({
    pts: [[0.682, -0.088], [0.664, -0.118], [0.643, -0.15], [0.618, -0.18], [0.596, -0.198], [0.582, -0.205], [0.577, -0.198], [0.578, -0.182], [0.584, -0.166], [0.573, -0.158], [0.57, -0.14], [0.563, -0.118], [0.55, -0.1], [0.53, -0.088], [0.56, -0.084], [0.62, -0.088]],
    rays: [[[0.66, -0.09], [0.6, -0.195]], [[0.63, -0.09], [0.582, -0.19]], [[0.6, -0.09], [0.572, -0.15]], [[0.575, -0.09], [0.558, -0.112]]],
    ramp: finM, z: 4, t: 2.2, grad: 0.8, alpha: 255, rayK: 0.35,
    mark: (p, f) => {
      if (p.y < -0.18 && f.a > 0.75) return tone(finD, f.t - 0.4);
      // the lit leading edge
      if (f.s < 0.12 && f.a > 0.2 && f.d < 1.1) return tone(finM, f.t + 1.1);
      return null;
    },
  }));
  // inside the mouth (only while it gapes): the dark throat in the wedge between the jaws, the upper
  // teeth hanging from the jaw line
  parts.push({
    z: 9, ink: true, bounds: [[HX, HY - 0.04], [HX + JL, HY + 0.06]],
    when: () => (pose().gape ?? 0) > 0.04,
    hit(x, y) {
      const dx = x - HX, dy = y - HY, r = Math.hypot(dx, dy);
      if (r > JL || dx < -0.004) return false;
      const a = Math.atan2(dy, dx);
      return a >= UA - 0.02 && a <= UA + (pose().gape ?? 0) * 0.62;
    },
    paint(p) {
      const dx = p.x - HX, dy = p.y - HY, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const dpx = (a - UA) * r * p.S;
      if (r > 0.02 && r < JL - 0.004 && dpx < 2.6) {
        const k = ((r * p.S) / 2.3) % 1;
        if (dpx < 2.6 - Math.abs(k - 0.5) * 4.6) return dpx < 0.8 ? hex('#cfc6b0') : hex('#f4efe0');
      }
      return tone(mouthR, 1.2 + (1 - r / JL) * 1.4 - (a - UA) * 2);
    },
  });
  // the lower jaw: hinged at the corner of the mouth, teeth along its rim when open
  parts.push(blob({
    pts: [[0.862, 0.058], [0.895, 0.05], [0.925, 0.042], [0.95, 0.034], [0.958, 0.037], [0.95, 0.048], [0.928, 0.058], [0.9, 0.066], [0.875, 0.07], [0.856, 0.067]],
    ramp: belly, z: 11, t: 3.2, dome: 0.9, ink: true,
    move: () => { const g = pose().gape ?? 0; return g > 0 ? { cx: HX, cy: HY, a: g * 0.62 } : null; },
    mark: (p, t) => {
      const g = pose().gape ?? 0;
      const dTop = (p.y - (HY + (p.x - HX) * Math.tan(UA))) * p.S;
      if (g > 0.06 && p.x > 0.876 && dTop < 2.2 && dTop > -1) {
        const k = ((p.x * p.S) / 2.2 + 0.5) % 1;
        if (dTop < 2.2 - Math.abs(k - 0.5) * 4.4) return hex('#efe9d8');
      }
      // the chin is pale; its rim takes the head's bronze where it meets the snout
      return tone(belly, t - (p.y < 0.044 ? 0.8 : 0));
    },
  }));
  B = body({
    top, bot, back, side, belly, zb: 0.46, zl: 0.66, light: 1.05, spec: 0.75, headRound: 0.75, z: 10,
    lat: [0.36, 0.46, 0.05],
    mark: (p, b) => {
      const S = p.S;
      // gill slits: a thin dark cleft, the flap's lit back edge just behind it
      for (let k = 0; k < SL.length; k++) {
        const hy = SL[k][1];
        if (Math.abs(p.y - 0.014) > hy) continue;
        const d = (p.x - slitX(k, p.y)) * S;
        if (d > -0.45 && d < 0.5) return tone(back, Math.abs(p.y - 0.014) > hy * 0.75 ? 2 : 1);
        if (d >= 0.5 && d < 1.4) return tone(b.ramp, b.t + 0.7);
      }
      // the nostril: a dark slit under the snout
      if (Math.hypot((p.x - 0.97) * 0.6, p.y - 0.012) * S < 0.75) return tone(back, 0);
      // snout scars: healed strokes, a shade paler than the bronze, and the old notch at the tip
      if (p.x > 0.92) {
        for (const [a, c] of SCARS) {
          const [d, s] = segDist(p.x, p.y, a, c);
          if (s > 0 && s < 1 && d * S < 0.55) return tone(scar, 1.6);
          if (s > 0 && s < 1 && d * S < 1.3 && p.y > a[1] + (c[1] - a[1]) * s) return tone(b.ramp, b.t - 0.7);
        }
        if (Math.hypot(p.x - 0.993, p.y + 0.001) * S < 1.1) return tone(scar, 1);
      }
      // the old bite: a crescent of pale pocked tooth marks
      if (S > 60) for (const q of BITE) {
        const d = Math.hypot(p.x - q[0], p.y - q[1]) * S;
        if (d < 0.75) return tone(scar, 2.2 - b.zone * 0.3);
        if (d < 1.4 && p.y > q[1]) return tone(b.ramp, b.t - 0.6);
      }
      // the shadow the pectoral throws on the flank below it
      if (!pose().far && b.v > 0.5 && p.x < 0.8 && p.x > 0.62) {
        const a = -(pose().pec ?? 0), c = Math.cos(-a), s = Math.sin(-a);
        const ux = p.x - 0.008 - pivot[0], uy = p.y - 0.014 - pivot[1];
        if (inPoly(pecPts, pivot[0] + ux * c - uy * s, pivot[1] + ux * s + uy * c)) return tone(b.ramp, b.t - 1.2);
      }
      // the white belly pushes a pale tongue forward along the flank over the pelvics, with a soft
      // dusky seam between it and the bronze
      const tongueV = 0.66 - 0.1 * smooth(0.36, 0.48, b.u) * (1 - smooth(0.54, 0.66, b.u)) + Math.sin(p.x * 60) * 0.01;
      if (b.zone === 1 && b.v > tongueV) return tone(belly, b.t - 0.4);
      if (b.zone === 1 && b.v > tongueV - 0.05 && b.u < 0.8) return tone(b.ramp, b.t - 0.5);
      // under the head the pale chin meets the bronze in a soft wavy edge
      if (b.zone === 2 && p.x > 0.85 && b.v < 0.74) return tone(side, b.t + 0.4);
      return null;
    },
  });
  parts.push(B);
  // the near pectoral: falcate, hung from under the last gill slits, its leading edge lit
  parts.push(fin({
    ...fan([0.785, 0.038], [0.742, 0.052], pecPts.slice(1, 12), 7),
    pts: pecPts,
    ramp: finM, z: 14, t: 2.4, grad: 0.7, alpha: 255, rayK: 0.35, ink: true,
    move: () => ({ cx: pivot[0], cy: pivot[1], a: -(pose().pec ?? 0) }),
    mark: (p, f) => {
      if (f.a > 0.82 && p.x < 0.66) return tone(finD, f.t - 0.5);
      if (f.s < 0.15 && f.a > 0.12) return tone(finM, f.t + 1);
      return null;
    },
  }));
  return {
    x0: 0, x1: 1, ink, parts, sweepX: 0.62, sweepA: 0.85, head: [0.97, -0.01],
    eye: { x: 0.913, y: -0.024, r: 0.0135, iris: hex('#cfdcd8'), ring: hex('#56645f'), pupil: hex('#05080a'), pupilR: 0.34 },
  };
}

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const SHARK_ANIMS: Record<string, AnimDef> = {
  idle: A(6, 5), swim: A(8, 8), fast: A(6, 12), turn: A(4, 10, false), hunch: A(4, 5),
  charge: A(6, 13), veer: A(4, 9, false), bite: A(6, 11, false),
};
/** a hump along the body (u 0 tail .. 1 snout) peaking at c */
const hump = (u: number, c: number, w: number) => Math.exp(-(((u - c) / w) ** 2));
function sharkPose(anim: string, f: number, n: number): FishPose {
  const t = f / n, s = Math.sin(t * TAU), c = Math.cos(t * TAU);
  const wave = (amp: number) => (u: number) => amp * Math.sin((t - u * 0.7) * TAU) * (1 - u) * (1 - u);
  switch (anim) {
    case 'idle': return { sweep: s * 0.4, pec: 0.04 + c * 0.03, bend: wave(0.004) };
    case 'swim': return { sweep: s * 0.6, pec: 0.03 + c * 0.04, bend: wave(0.006) };
    case 'fast': return { sweep: s * 0.95, pec: -0.12, gape: 0.12, bend: wave(0.008) };
    case 'charge': return { sweep: s * 1, pec: -0.2, gape: 0.2 + 0.12 * Math.max(0, s), bend: u => wave(0.008)(u) - hump(u, 0.95, 0.12) * 0.01 };
    case 'turn': {
      const k = [0.84, 0.62, 0.44, 0.32][f];
      return { sx: k, sweep: [0.5, 0.85, 1, 1][f], far: f > 0, pec: 0.1 + f * 0.05, pec2: 0.25, bend: u => -hump(u, 0.5, 0.4) * 0.01 * f };
    }
    case 'hunch': {
      // the warning: back humped, snout pointed up, tail dropped, pectorals jammed straight down,
      // a stiff exaggerated swim (the sweep jerks)
      const sw = [0.45, -0.35, 0.5, -0.25][f];
      return {
        sweep: sw, far: true, pec: 0.62 + (f % 2) * 0.06, pec2: 0.62, gape: 0.12 + (f === 2 ? 0.1 : 0),
        bend: u => -hump(u, 0.56, 0.22) * 0.055 + smooth(0.4, 0, u) * 0.03 - smooth(0.78, 1, u) * 0.035 + Math.sin(f * 1.9) * 0.002,
      };
    }
    case 'veer': {
      // a hard pull-away: the body curls (ends up), the pectorals flare to brake and steer
      const k = [0.5, 1, 1, 0.6][f];
      return { sweep: [0.8, -0.9, 0.9, -0.6][f], pec: 0.45 * k, far: k > 0.7, pec2: 0.3, gape: 0.05, bend: u => -((u - 0.5) ** 2) * 0.22 * k };
    }
    case 'bite': {
      const g = [0.35, 0.85, 1, 0.45, 0.15, 0][f];
      return {
        gape: g, eye: f >= 1 && f <= 3 ? 'white' : 'open', sweep: [0.3, -0.5, 0.6, -0.6, 0.4, 0][f], pec: 0.15,
        rot: [0, -0.04, -0.06, 0.05, -0.03, 0][f], bend: u => -hump(u, 0.95, 0.12) * 0.012 * g,
      };
    }
  }
  return {};
}

export const SHARK_LEN = 150;
export const GLASSEYE = fishDef({
  name: 'Glasseye Whaler', len: SHARK_LEN, height: 34, art: glasseye, anims: SHARK_ANIMS, pose: sharkPose,
  w: 200, h: 120,
  eyeFor: anim => (anim === 'bite' ? 'closed' : anim === 'hunch' || anim === 'charge' ? 'angry' : 'open'),
});

