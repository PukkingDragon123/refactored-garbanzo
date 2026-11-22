// Glass Crab: a thumbnail ghost crab of the wet sand whose shell is as clear as sea glass. You can
// see the red heart beating, the orange liver lobes, the feathery gills and the gut through it; on
// wet sand it all but vanishes, and only the organs seem to float there. Eyes on long stalks it folds
// flat into grooves when it burrows; males wave one oversized glassy claw at each other.
//
// Drawn from the front and a little above (it scuttles sideways along the beach), anchored on the
// ground under the body. The carapace is one contour through a ghost crab's landmarks (the arched
// back margin, the sharp anterolateral corners, the frontal margin with its two orbits, the sides
// drawing in to the mouth frame), lit as glass with a hard specular rim, the frontal ridge raised;
// through it the organs are hand-placed: the heart over the gut, the branching hepatopancreas lobes,
// the feathery gills along each side and the stomach, with the square plates of the third
// maxillipeds closing the mouth. Each walking leg is jointed (merus up to a high knee, carpus and
// propodus down, a pointed dactyl) with a pink band at each joint; the chelipeds fold in front of the
// face, the male's right claw a swollen glassy palm with red-tipped fingers; the eyes are long dark
// corneas on stalks with a pale style. The shell and legs are made translucent in post().
//
// Anims: idle, scuttle, feed, wave, alert, burrow, peek.

import { Sk, V2, rmp, SpeciesDef, TAU, hh } from '../../beasts-core';
import { PixelBuffer } from '../../pixel';
import { hex, A as alphaOf } from '../../color';
import { Field } from '../wild/contour';
import type { LP } from '../wild/contour';
import { spline } from '../wild/contour';
import { paintMap, dotLine } from './shore-kit';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
export const CRAB_ANIMS = { idle: A(4, 3), scuttle: A(4, 16), feed: A(4, 6), wave: A(4, 5), alert: A(2, 4), burrow: A(6, 10, false), peek: A(2, 2) };

interface P {
  by: number;          // shell height above the sand
  sink: number;        // sunk into the sand (px)
  legPh: number;       // scuttle phase (0 = standing)
  eyeUp: number;       // eyestalks raised 0..1
  eyeSw: number;       // eyestalk sway
  clawL: number; clawR: number; // claw raise 0 (folded under the face) .. 1 (up high)
  openR: number;       // big claw gape
  sand: number; sandPh: number;
  beat: number;        // heart beat (bigger heart)
}

function pose(anim: string, f: number, n: number): P {
  const t = f / n;
  const p: P = { by: 2, sink: 0, legPh: 0, eyeUp: 0.85, eyeSw: 0, clawL: 0.15, clawR: 0.2, openR: 0.2, sand: 0, sandPh: 0, beat: f % 2 };
  switch (anim) {
    case 'idle': p.eyeSw = [0, 0.5, 0, -0.5][f]; p.eyeUp = f === 2 ? 1 : 0.85; p.clawL = f === 1 ? 0.3 : 0.15; break;
    case 'scuttle': p.legPh = t; p.by = 2.2 + (f % 2) * 0.5; p.eyeUp = 0.6; p.clawL = p.clawR = 0.25; break;
    case 'feed': p.clawL = [0.55, 0.05, 0.55, 0.05][f]; p.clawR = [0.05, 0.5, 0.05, 0.5][f]; p.by = 1.6; p.eyeUp = 0.75; break;
    case 'wave': p.clawR = [0.5, 1, 1.2, 0.8][f]; p.openR = [0.2, 0.6, 1, 0.4][f]; p.eyeUp = 1; p.by = 2.4; break;
    case 'alert': p.clawL = p.clawR = 1; p.openR = 1; p.eyeUp = 1; p.by = 2.6; p.eyeSw = f ? 0.3 : -0.3; break;
    case 'burrow': p.sink = [0, 1.5, 3, 4.5, 6, 7.5][f] * 1.25; p.sand = f > 0 && f < 5 ? 1 : 0; p.sandPh = f / 5; p.legPh = t * 2; p.eyeUp = Math.max(0, 0.6 - f * 0.15); break;
    case 'peek': p.sink = 7; p.eyeUp = 1; p.eyeSw = f ? 0.6 : -0.6; p.clawL = p.clawR = 0; break;
  }
  return p;
}

const GLASS = '#d6eef0';
const GLASS_RAMP = rmp(GLASS, { n: 5, dark: 0.32, light: 0.75, cool: 0.25 });
const LEG_RAMP = rmp('#e8eee8', { n: 4, dark: 0.3, light: 0.6, cool: 0.15 });
function mats(sk: Sk) {
  return {
    glass: sk.m(GLASS_RAMP, { edge: 1 }),
    leg: sk.m(LEG_RAMP, { edge: 1 }),
    joint: sk.m(rmp('#ec8a86', { n: 3, dark: 0.35, light: 0.3 }), { edge: 1 }),
    heart: sk.m(rmp('#e02a38', { n: 4, dark: 0.35, light: 0.35 }), { edge: 0, noRim: true }),
    liver: sk.m(rmp('#f0942a', { n: 4, dark: 0.32, light: 0.3 }), { edge: 0, noRim: true }),
    gill: sk.m(rmp('#f2e6d6', { n: 3, dark: 0.22, light: 0.2 }), { edge: 0, noRim: true }),
    gut: sk.m(rmp('#7a4a38', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
    mxp: sk.m(rmp('#efe4d2', { n: 4, dark: 0.3, light: 0.3 }), { edge: 0, noRim: true }),
    palm: sk.m(GLASS_RAMP, { edge: 1 }),
    finger: sk.m(rmp('#d8343e', { n: 4, dark: 0.45, light: 0.35 }), { edge: 1 }),
    stalk: sk.m(rmp('#e6e2d6', { n: 3, dark: 0.3, light: 0.3 }), { edge: 1 }),
    cornea: sk.m(rmp('#1a1418', { n: 3, dark: 0.3, light: 0.45 }), { edge: 0 }),
  };
}

const SAND = hex('#c8ae80'), SAND2 = hex('#a88e62');
// overlay colours for the fine glassy legs (no outline, partly transparent)
const LEGC = hex('#f6f2ea', 215), LEGC2 = hex('#e2dcd2', 205), LEGS = hex('#8e8276', 130), KNEE = hex('#ee8a88', 235), DACT = hex('#d2c6b8', 220), DACTD = hex('#6e5a4e', 230);
const SHINE = hex('#ffffff'), STYLE = hex('#f4f0e6');

function draw(sk: Sk, anim: string, frame: number, juv: boolean) {
  const n = CRAB_ANIMS[anim as keyof typeof CRAB_ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = mats(sk);
  const k = juv ? 0.7 : 1;
  sk.clipY = 0;
  const HH = 5.6 * k;
  const by = -(P.by + 1.5) * k + P.sink;     // underside of the body
  const top = by - HH;                       // back margin
  const fy = top + 2.2 * k;                  // the frontal margin (top surface / front face)
  const X = (x: number) => x * k, Y = (y: number) => by + y * k;

  // ---------------------------------------------------------------- the carapace
  // landmarks: the arched back margin, the sharp anterolateral corners, the frontal margin's orbits,
  // the sides drawing in under the eyes to the mouth frame
  const c: LP[] = [
    [X(0), top - 0.4 * k], [X(3), top - 0.2 * k], [X(5), top + 0.7 * k], [X(5.9), fy - 0.3 * k, 1], [X(5.6), fy + 1.3 * k],
    [X(4.9), Y(-1.2)], [X(3.4), Y(0.2)], [X(-3.4), Y(0.2)], [X(-4.9), Y(-1.2)],
    [X(-5.6), fy + 1.3 * k], [X(-5.9), fy - 0.3 * k, 1], [X(-5), top + 0.7 * k], [X(-3), top - 0.2 * k],
  ];
  const F = new Field(sk, [spline(c, true, 5)], { round: 1.5, dome: 0.6 });
  // the frontal ridge between the top of the shell and its front face, dipping at the orbits
  F.groove([[X(-5.6), fy], [X(-2.6), fy + 0.5 * k], [X(0), fy - 0.1 * k], [X(2.6), fy + 0.5 * k], [X(5.6), fy]], 0.7, 0.9);
  sk.np();
  const shell = sk.pid;
  F.emit(p => {
    if (p.y > fy + 0.6) p.l -= 0.08; // the front face, shadowed under the ridge
    return M.glass;
  }, { z: 2, spec: 0.9, specPow: 5 });

  // ---------------------------------------------------------------- organs, seen through the glass
  // h heart, l liver lobes (branching hepatopancreas), g gills, u gut, m maxillipeds (mouth plates)
  const O: Record<string, [number, number]> = {
    h: [M.heart, 0.12], H: [M.heart, -0.1], l: [M.liver, 0.1], L: [M.liver, -0.12], g: [M.gill, 0.08], G: [M.gill, -0.16],
    u: [M.gut, 0.05], m: [M.mxp, 0.1], M: [M.mxp, -0.16],
  };
  const r0 = Math.round(top + 0.6);
  if (!juv) {
    paintMap(sk, -5, r0, [
      '...........',
      'g.lL...Ll.g',
      'Glll.u.llLG',
      'g.Ll.u.lL.g',
      'G..l...l..G',
      '...mmMmm...',
      '....mMm....',
    ], O, { part: shell });
    paintMap(sk, -1, r0, P.beat ? ['hhh', 'hHh', '.H.'] : ['.h.', 'hH.', '...'], O, { part: shell });
  } else {
    paintMap(sk, -3, r0, ['......', 'l.hh.l', 'L.Hu.L', '..mM..'], O, { part: shell });
  }
  // the orbits: two dark notches in the frontal margin where the eyestalks fold away
  for (const side of [-1, 1]) sk.paint(side * X(2.6) + 0.5, fy + 0.5, M.gut, -0.2, shell);

  // ---------------------------------------------------------------- walking legs
  // four a side, jointed, fine glassy strokes (no outline: they are as clear as the shell): a lit
  // upper edge over a shaded under side, a pink band at the knee, a darker pointed dactyl. They come
  // out from under the shell (the shell hides their roots); the rows alternate when it scuttles.
  const ov = (x: number, y: number, col: number) => { if (y < 0.5 && !sk.has(x, y)) sk.over(x, y, col); };
  const seg = (a: V2, b: V2, col: number, sh: number) => {
    const m = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= m; i++) {
      const x = a[0] + (b[0] - a[0]) * (i / m), y = a[1] + (b[1] - a[1]) * (i / m);
      if (sh) ov(x, y + 1, sh);
      ov(x, y, col);
    }
  };
  for (let i = 3; i >= 0; i--) for (const side of [-1, 1]) {
    const ph = P.legPh * TAU + i * 1.6 + (side > 0 ? Math.PI : 0);
    const lift = P.legPh ? Math.max(0, Math.sin(ph)) * 1.8 : 0;
    const swing = P.legPh ? Math.cos(ph) * 0.9 : 0;
    const hip: V2 = [side * X(4.2 - i * 0.2), Y(-2.6 + i * 0.6)];
    const knee: V2 = [side * X(6.8 + i * 1.6), Y(-5.6 + i * 1.3) - lift];
    const foot: V2 = [side * X(8.3 + i * 1.65 + swing * 0.8), Math.min(-0.5, -0.5 - lift * 0.6 + P.sink * 0.6)];
    const ank: V2 = [knee[0] + (foot[0] - knee[0]) * 0.7, knee[1] + (foot[1] - knee[1]) * 0.7];
    seg(hip, knee, LEGC, i < 2 ? LEGS : 0);
    seg(knee, ank, LEGC2, 0);
    seg(ank, foot, DACT, 0);
    ov(knee[0], knee[1], KNEE);
    ov(foot[0], foot[1], DACTD);
  }

  // ---------------------------------------------------------------- chelipeds
  for (const side of [-1, 1]) {
    const lift = side < 0 ? P.clawL : P.clawR;
    const big = side > 0 && !juv;
    const sh: V2 = [side * X(3.6), Y(-2)];
    const el: V2 = [side * X(6 + lift * 1.2), Y(-1.4) - lift * 2.6 * k];
    const hand: V2 = [side * X(2.6 + Math.min(1, lift) * 4 + (big ? 0.8 : 0)), Y(-0.8) - Math.min(1, lift) * (big ? 4.9 : 4.6) * k - (big ? 0.4 : 0)];
    const z = 6 + (side > 0 ? 0.5 : 0);
    sk.np();
    dotLine(sk, sh, el, M.leg, 0.55, z);
    dotLine(sk, el, hand, M.leg, 0.7, z);
    sk.dot(el[0], el[1], M.joint, 0.62, z + 0.1);
    // the palm: a swollen glass shell, pink muscle inside; the fingers point up and in
    const up = -Math.PI / 2 + side * (0.3 - lift * 0.2);
    const cu = Math.cos(up), su = Math.sin(up), cv = -su, sv = cu;
    const hp = (u: number, v: number, sharp = 0): LP => [hand[0] + cu * u + cv * v * side, hand[1] + su * u + sv * v * side, sharp];
    const sz = big ? 1 : 0.55;
    const palm: LP[] = [hp(-1.6 * sz, -1.2 * sz), hp(1.4 * sz, -1.6 * sz), hp(2.5 * sz, -0.6 * sz), hp(2.3 * sz, 1.3 * sz), hp(0.2 * sz, 1.7 * sz), hp(-1.7 * sz, 1 * sz)];
    sk.np();
    const PF = new Field(sk, [spline(palm, true, 4)], { round: 1.1, dome: big ? 0.8 : 0.3 });
    PF.emit(p => {
      const du = (p.x - hand[0]) * cu + (p.y - hand[1]) * su;
      if (big && Math.abs(du - 0.3) < 0.9 && p.d > 0.9) { p.l += 0.05; return M.joint; }
      return M.palm;
    }, { z: z + 1, spec: 0.9, specPow: 5 });
    const open = side > 0 ? P.openR : 0.3 + lift * 0.3;
    const fl = big ? 3.2 : 1.7;
    const base: V2 = [hand[0] + cu * 2 * sz, hand[1] + su * 2 * sz];
    // the fixed finger (pollex) on the inside, the movable dactyl on the outside
    for (const [dv, da, L, l0] of [[0.9 * sz, -0.1 - open * 0.45, fl, 0.62], [-0.9 * sz, 0.12 + open * 0.4, fl * 0.9, 0.42]] as [number, number, number, number][]) {
      const b0: V2 = [base[0] + cv * dv * side, base[1] + sv * dv * side];
      const a2 = up + da * side;
      const tip: V2 = [b0[0] + Math.cos(a2) * L, b0[1] + Math.sin(a2) * L];
      dotLine(sk, b0, tip, M.finger, (j, m) => l0 + (j / m) * 0.12, z + 1.5);
    }
  }

  // ---------------------------------------------------------------- eyestalks
  let eye: V2 = [0, top - 4];
  for (const side of [-1, 1]) {
    const b: V2 = [side * X(2.6), fy - 0.2 * k];
    const L = (0.8 + P.eyeUp * 4.6) * k;
    const a = -Math.PI / 2 + side * (0.1 + (1 - P.eyeUp) * 1.3) + P.eyeSw * 0.3;
    const e: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
    sk.np();
    dotLine(sk, b, e, M.stalk, (j, m) => 0.45 + (j / m) * 0.2, 9);
    // the long dark cornea wrapping the stalk's tip, a glint, and the pale style above it
    const ec: V2 = [e[0] - Math.cos(a) * 1, e[1] - Math.sin(a) * 1];
    sk.dot(ec[0], ec[1], M.cornea, 0.4, 10);
    sk.dot(e[0], e[1], M.cornea, 0.6, 10);
    if (!juv && P.eyeUp > 0.5) sk.dot(ec[0] + side, ec[1], M.cornea, 0.3, 10);
    sk.over(e[0], e[1], SHINE);
    if (P.eyeUp > 0.5 && !juv) sk.over(e[0] + Math.cos(a), e[1] + Math.sin(a), STYLE);
    if (side > 0) eye = e;
  }

  // ---------------------------------------------------------------- flicked sand while digging in
  if (P.sand) for (let i = 0; i < 9; i++) {
    const sd = i % 2 ? 1 : -1;
    const ph = (P.sandPh * 2 + i * 0.17) % 1;
    const x = sd * (4 + ph * 8), y = -1 - Math.sin(ph * Math.PI) * 5 - hh(i, 1, 2) * 1.5;
    if (y < 0.5) sk.over(x, y, hh(i, 3, 2) < 0.5 ? SAND : SAND2);
  }
  sk.clipY = Infinity;
  if (P.sink > 0) for (let x = -9; x <= 9; x++) if (hh(x, 2, 7) > 0.45) sk.over(x, -0.5, hex('#bca27a'));
  return { head: [0, top - 6 * k] as V2, eye };
}

/**
 * See-through glass: shell pixels keep ~55% opacity so the sand shows through (the brightest
 * specular tones stay more solid so the rim still catches the light), the legs a little more; the
 * dark outline next to them is softened too, so the crab doesn't wear a heavy black border.
 */
const glassA = new Map<number, number>();
GLASS_RAMP.forEach((c, i) => glassA.set(c, [180, 128, 116, 132, 220][i]));
LEG_RAMP.forEach((c, i) => { if (!glassA.has(c)) glassA.set(c, [200, 185, 195, 225][i]); });
function post(buf: PixelBuffer) {
  const d = buf.data, W = buf.w, H = buf.h;
  const src = d.slice();
  const isGlass = (i: number) => glassA.has(src[i]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = src[i];
    if (!alphaOf(c)) continue;
    const ga = glassA.get(c);
    if (ga !== undefined) { d[i] = ((c & 0x00ffffff) | (ga << 24)) >>> 0; continue; }
    // outline pixels (dark, not part of an organ) that border glass: half transparent
    const nb = (x > 0 && isGlass(i - 1)) || (x < W - 1 && isGlass(i + 1)) || (y > 0 && isGlass(i - W)) || (y < H - 1 && isGlass(i + W));
    const L = (c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255);
    if (nb && L < 200 && alphaOf(c) === 255) d[i] = ((c & 0x00ffffff) | (175 << 24)) >>> 0;
  }
}

export const GLASSCRAB: SpeciesDef & { post: typeof post } = {
  name: 'Glass Crab', kind: 'crustacean', len: 9, height: 6,
  anims: CRAB_ANIMS,
  canvas: () => ({ w: 30, h: 22, ox: 15, oy: 17 }),
  draw: (sk, anim, frame, _eye, juv) => draw(sk, anim, frame, juv),
  eyeFor: () => 'open',
  post,
};
