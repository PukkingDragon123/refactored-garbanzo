// Glass Crab: a thumbnail ghost crab of the wet sand whose shell is as clear as sea glass. You can
// see the red heart beating, the orange liver lobes, the feathery gills and the gut through it; on
// wet sand it all but vanishes, and only the organs seem to float there. Eyes on long stalks it folds
// flat into grooves when it burrows; males wave one oversized glassy claw at each other.
//
// Drawn from the front (it scuttles sideways along the beach), anchored on the ground under the body.
// Anims: idle, scuttle, feed, wave, alert, burrow, peek. The shell is made translucent in post() so
// the sand shows through; legs, stalks and claws are fine overlay strokes with no outline.

import { Sk, V2, rmp, SpeciesDef, TAU, hh } from '../../beasts-core';
import { PixelBuffer } from '../../pixel';
import { hex, A as alphaOf } from '../../color';

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
    case 'burrow': p.sink = [0, 1.5, 3, 4.5, 6, 7.5][f]; p.sand = f > 0 && f < 5 ? 1 : 0; p.sandPh = f / 5; p.legPh = t * 2; p.eyeUp = Math.max(0, 0.6 - f * 0.15); break;
    case 'peek': p.sink = 5.5; p.eyeUp = 1; p.eyeSw = f ? 0.6 : -0.6; p.clawL = p.clawR = 0; break;
  }
  return p;
}

const GLASS = '#dcf0f2';
const GLASS_RAMP = rmp(GLASS, { n: 5, dark: 0.3, light: 0.6, cool: 0.2 });
function mats(sk: Sk) {
  return {
    glass: sk.m(GLASS_RAMP, { spec: 0.7, edge: 1 }),
    heart: sk.m(rmp('#e8323e', { n: 3, dark: 0.35, light: 0.3 }), { edge: 0, noRim: true, spec: 0.4 }),
    liver: sk.m(rmp('#f09a2c', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
    gill: sk.m(rmp('#f6ece2', { n: 3, dark: 0.25 }), { edge: 0, noRim: true }),
    gut: sk.m(rmp('#7a5442', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
    sand: sk.m(rmp('#cdb487', { n: 3, dark: 0.35 }), { edge: 0, noRim: true }),
  };
}

// overlay colours for the fine glassy parts (no outline, partly transparent)
const LEGC = hex('#f4eee6', 185), KNEE = hex('#ec9290', 230), DACT = hex('#b4a292', 205);
const STALK = hex('#ece6de', 215), EYE_C = hex('#120c0e'), SHINE = hex('#f4fcff');
const CLAW = hex('#e6f4f6', 200), PALM = hex('#f6fcff', 230), TIP = hex('#d8343e'), TIPD = hex('#9a1e28');
const SAND = hex('#c8ae80'), SAND2 = hex('#a88e62');

function draw(sk: Sk, anim: string, frame: number, juv: boolean) {
  const n = CRAB_ANIMS[anim as keyof typeof CRAB_ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = mats(sk);
  const k = juv ? 0.7 : 1;
  sk.clipY = 0;
  const RX = 4.3 * k, RY = 2.6 * k;
  const cy = -(P.by + RY) + P.sink, cx = 0;
  const ov = (x: number, y: number, c: number) => { if (y < 0.5) sk.over(x, y, c); };
  const ovl = (a: V2, b: V2, c: number) => {
    const m = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= m; i++) ov(a[0] + (b[0] - a[0]) * (i / m), a[1] + (b[1] - a[1]) * (i / m), c);
  };
  // carapace: a clear glassy dome
  sk.np();
  sk.ell(cx, cy, RX, RY, M.glass, { rz: 2.4 * k, z: 2 });
  const shell = sk.pid;
  // the organs showing through (painted into the shell so they sit inside it)
  const org = (x: number, y: number, m: number) => sk.paint(cx + x * k, cy + y * k, m, 0, shell);
  org(-0.5, -0.4, M.heart); org(0.5, -0.4, M.heart); if (P.beat) { org(-0.5, 0.5, M.heart); org(0.5, 0.5, M.heart); }
  org(-2, -0.6, M.liver); org(-2.2, 0.4, M.liver); org(-1.4, 1.2, M.liver); org(2, -0.6, M.liver); org(2.2, 0.4, M.liver); org(1.4, 1.2, M.liver);
  org(-3.2, 0.4, M.gill); org(3.2, 0.4, M.gill);
  org(-0.5, 1.5, M.gut); org(0.5, 1.5, M.gut);
  // flicked sand while digging in
  if (P.sand) for (let i = 0; i < 7; i++) {
    const sd = i % 2 ? 1 : -1;
    const ph = (P.sandPh * 2 + i * 0.17) % 1;
    ov(sd * (3 + ph * 6), -1 - Math.sin(ph * Math.PI) * 4 - hh(i, 1, 2) * 1.5, hh(i, 3, 2) < 0.5 ? SAND : SAND2);
  }
  // walking legs: four a side, glassy, splayed out to the sand; rows alternate when scuttling
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const ph = P.legPh * TAU + i * 1.6 + (side > 0 ? Math.PI : 0);
    const lift = P.legPh ? Math.max(0, Math.sin(ph)) * 1.5 : 0;
    const hip: V2 = [cx + side * (RX - 0.5), cy + 0.4 + i * 0.35];
    const knee: V2 = [cx + side * (RX + 1.3 + i * 0.6), cy - 0.8 + i * 0.6 - lift];
    const foot: V2 = [cx + side * (RX + 2.2 + i * 1.05 + (P.legPh ? Math.cos(ph) * 0.8 : 0)), Math.min(-0.5, -lift * 0.5 + P.sink * 0.3)];
    ovl(hip, knee, LEGC); ovl(knee, foot, LEGC);
    ov(foot[0], foot[1], DACT); ov(knee[0], knee[1], KNEE);
  }
  // claws: slim glassy arms raised at the sides, red-tipped pincers; the male's right claw is huge
  for (const side of [-1, 1]) {
    const lift = side < 0 ? P.clawL : P.clawR;
    const big = side > 0 ? 1.45 : 1;
    // folded in front of the face at rest, raised up at the sides for waving and threats
    const sh: V2 = [cx + side * (RX - 1.8), cy + 1];
    const el: V2 = [cx + side * (RX + 0.6 + lift * 0.4), cy + 0.6 - lift * 2.6];
    const hand: V2 = [cx + side * (1.9 + lift * (RX - 1.6)), cy + 1.4 - lift * (5.2 + big)];
    ovl(sh, el, CLAW); ovl(el, hand, CLAW);
    const pr = big > 1 ? 1 : 0;
    for (let dy = -pr; dy <= pr; dy++) for (let dx = -pr; dx <= pr; dx++) ov(hand[0] + dx, hand[1] + dy, CLAW);
    ov(hand[0], hand[1], PALM);
    const open = side > 0 ? P.openR : 0.3 + lift * 0.3;
    const up = -Math.PI / 2 + side * 0.25;
    for (const [da, L] of [[-side * open * 0.6, 2.1], [side * (0.6 + open * 0.5), 1.6]] as V2[]) {
      const tp: V2 = [hand[0] + Math.cos(up + da) * L * big, hand[1] + Math.sin(up + da) * L * big];
      ovl([hand[0] + Math.cos(up + da) * 0.9, hand[1] + Math.sin(up + da) * 0.9], tp, TIP);
      ov(tp[0], tp[1], TIPD);
    }
  }
  // eyestalks: slender, folding down flat when it burrows; black eye-tips with a glint
  let eye: V2 = [cx, cy - 4];
  for (const side of [-1, 1]) {
    const b: V2 = [cx + side * 1.4 * k, cy - RY + 0.4];
    const L = (0.8 + P.eyeUp * 3.6) * k;
    const a = -Math.PI / 2 + side * (0.18 + (1 - P.eyeUp) * 1.15) + P.eyeSw * 0.35;
    const e: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
    ovl(b, e, STALK);
    ov(e[0], e[1], EYE_C); ov(e[0], e[1] - 1, EYE_C);
    ov(e[0] + side, e[1] - 1, SHINE);
    if (side > 0) eye = e;
  }
  sk.clipY = Infinity;
  if (P.sink > 0) for (let x = -7; x <= 7; x++) if (hh(x, 2, 7) > 0.45) sk.over(x, -0.5, hex('#bca27a'));
  return { head: [cx, cy - 7] as V2, eye };
}

/**
 * See-through glass: shell pixels keep ~57% opacity so the sand shows through; the dark outline
 * next to them is softened too, so the crab doesn't wear a heavy black border.
 */
const glassSet = new Set(GLASS_RAMP);
function post(buf: PixelBuffer) {
  const d = buf.data, W = buf.w, H = buf.h;
  const src = d.slice();
  const isGlass = (i: number) => glassSet.has(src[i]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = src[i];
    if (!alphaOf(c)) continue;
    if (isGlass(i)) { d[i] = ((c & 0x00ffffff) | (145 << 24)) >>> 0; continue; }
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
