// V12 Te Rua Pōuri, the two salamanders of the dark water, sculpted in 2.5D (src/art/sculpt.ts) into
// the beast sketch (shared shading, part edges and outline with every other animal).
//
// The Blind Salamander (an olm, Proteus): a long eel of a body on four tiny limbs, three fingers in front
// and two toes behind; a long head ending in a flat, squared spade of a snout; no eyes, only two specks
// under the skin; three feathery scarlet gill tufts each side, behind the head. The skin is pale
// pink-white and so thin the animal is half see-through: the costal grooves ring the trunk, the gut
// shows as a warm shadow, the blood vessels as faint threads; the tail is short and flat with a clear
// fin above and below. Anims: idle (the gills breathing), swim, walk (on the pool bed), rest, flee, snap.
//
// The Ghost Gulper (a giant salamander, Andrias, grown huge in the dark): see the second half.

import { Sk, V2, rmp, TAU, hh, ik2 } from '../../beasts-core';
import type { SpeciesDef } from '../../beasts-core';
import { hex } from '../../color';
import type { C } from '../../color';
import { noise2 } from '../../../core/math';
import { Lay, Tx, shape, axis, axisOutline, limbOutline, fringe, densify, spline, cell, CELL, cl, ss, gs, frc, rotP } from '../../sculpt';
import type { Keys } from '../../sculpt';

// ================================================================== the Blind Salamander
const SANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  swim: { frames: 6, fps: 8, loop: true },
  walk: { frames: 4, fps: 5, loop: true },
  rest: { frames: 2, fps: 1, loop: true },
  flee: { frames: 4, fps: 14, loop: true },
  snap: { frames: 3, fps: 10, loop: false },
};

const SC = {
  gillD: hex('#a8202e'), gill: hex('#e03a4a'), gillL: hex('#ff7a86'), gillT: hex('#ffb4ba'),
  eye: hex('#b88e8c'), eyeL: hex('#d8b0aa'), nos: hex('#8a5a5c'), lip: hex('#a87072'), mouth: hex('#6e2a34'),
  toeL: hex('#fae4dc'),
};

function sdraw(sk: Sk, anim: string, frame: number, _eye: unknown, juv: boolean) {
  const n = SANIMS[anim as keyof typeof SANIMS]?.frames ?? 1;
  const t = frame / n, ph = t * TAU;
  const K = juv ? 0.75 : 1;
  const amp = anim === 'swim' ? 1.25 : anim === 'flee' ? 1.9 : anim === 'walk' ? 0.55 : anim === 'rest' ? 0.12 : 0.3;
  const breathe = anim === 'idle' || anim === 'rest' ? Math.sin(ph) : 0;
  const snap = anim === 'snap' ? [0.35, 1, 0.25][frame] : 0;
  const flee = anim === 'flee' ? 1 : 0;
  const onBed = anim === 'walk' || anim === 'rest';
  const M = {
    skin: sk.m(rmp('#f2c6b8', { n: 7, dark: 0.36, light: 0.62, warm: 0.3, cool: 0.04, sat: 0.7 }), { edge: 1 }),
    belly: sk.m(rmp('#f2bcae', { n: 6, dark: 0.34, light: 0.55, warm: 0.3, cool: 0.04, sat: 0.7 }), { edge: 1 }),
    gut: sk.m(rmp('#cc8a80', { n: 6, dark: 0.36, light: 0.4, cool: 0.08, sat: 0.6 }), { edge: 0 }),
    liver: sk.m(rmp('#b0646a', { n: 5, dark: 0.36, light: 0.4, cool: 0.1, sat: 0.5 }), { edge: 0 }),
    vein: sk.m(rmp('#e08486', { n: 5, dark: 0.36, light: 0.4, cool: 0.04, sat: 0.5 }), { edge: 0 }),
    bone: sk.m(rmp('#e0aaa0', { n: 5, dark: 0.36, light: 0.4, cool: 0.1, sat: 0.4 }), { edge: 0 }),
    heart: sk.m(rmp('#d0464e', { n: 5, dark: 0.4, light: 0.4 }), { edge: 0 }),
    fin: sk.m(rmp('#e6c2bc', { n: 5, dark: 0.3, light: 0.5, cool: 0.25 }), { edge: 0, k: 0.55 }),
    ray: sk.m(rmp('#d6a8a6', { n: 5, dark: 0.3, light: 0.4, cool: 0.25 }), { edge: 0, k: 0.55 }),
    snout: sk.m(rmp('#f6d2c4', { n: 7, dark: 0.36, light: 0.62, warm: 0.35, cool: 0.04, sat: 0.6 }), { edge: 1 }),
    pore: sk.m(rmp('#fff0e8', { n: 3, dark: 0.2, light: 0.4 }), { edge: 0, noRim: true }),
  };
  // the spine, tail tip to snout; a travelling wave runs head to tail
  const NS = 16;
  const by = (onBed ? -2.5 : -3.3) * K;
  const sp: V2[] = [];
  for (let i = 0; i <= NS; i++) {
    const u = i / NS; // 0 tail tip .. 1 snout
    const fromHead = 1 - u;
    const x = (-18.5 + u * 31) * K - snap * u * 1.6 * K;
    const wave = Math.sin(ph + fromHead * 4.6) * amp * Math.pow(fromHead, 1.3);
    const lift = snap * Math.pow(u, 3) * 1.6;
    sp.push([x, by + (wave - lift) * K]);
  }
  const AX = axis(sp), T = AX.total;
  // stations (px of arc from the tail tip)
  const sTail = 8 * K, sHip = 9.4 * K, sGill = T - 7.3 * K, sHead = T - 6.4 * K, sArm = T - 9 * K;
  // the outline: landmarks along the axis, head to tail over the back, tail to head under the belly
  const s = (f: number) => T - f * K;  // f = px back from the snout tip
  const fin = 1 - flee * 0.35;
  const top: [number, number][] = [
    [s(0.05), 0.55 * K], [s(0.5), 0.95 * K], [s(1.8), 1.15 * K], [s(3.6), 1.55 * K], [s(5.0), 2.0 * K], [s(6.0), 2.05 * K],
    [s(6.9), 1.8 * K], [s(8.2), 2.05 * K], [s(14), 2.25 * K], [s(20), 2.2 * K], [s(22.4), 2.1 * K],
    [5.6 * K, (2.6 + 0.6 * fin) * K], [3.4 * K, (1.9 + 0.55 * fin) * K], [1.4 * K, 1.0 * K], [-0.6 * K, 0.2 * K],
  ];
  const bot: [number, number][] = [
    [-0.6 * K, 0.1 * K], [1.6 * K, 0.75 * K], [3.6 * K, (1.45 + 0.4 * fin) * K], [6.0 * K, (2.0 + 0.35 * fin) * K], [s(22.4), 2.05 * K],
    [s(17), 2.4 * K], [s(12), 2.35 * K], [s(8.4), 2.05 * K], [s(6.8), 1.75 * K], [s(5.8), 1.85 * K], [s(4.2), 1.45 * K],
    [s(2.2), 1.0 * K], [s(0.5), 0.75 * K], [s(0.05), 0.35 * K],
  ];
  const outline = axisOutline(AX, top, bot, 4);
  // the core: how far the round body reaches above and below the axis at a station (beyond it is fin)
  const core = (S: number) => S < sTail ? (0.4 + (S / sTail) * 1.75) * K : 9;
  const tex = (x: number, y: number, d: number, o: Tx) => {
    const [S, D] = AX.proj(x, y);
    const u = S / K, back = (T - S) / K;
    o.m = M.skin;
    const cr = core(S);
    if (Math.abs(D) > cr) {
      // the fin: clear, with faint rays fanning back
      o.r = 0.6 * K;
      o.m = frc((u + D * 0.6) / 1.4) < 0.3 ? M.ray : M.fin;
      o.z = -0.6 * K; o.t = 0.05;
      return;
    }
    const v = D / (2.2 * K);
    if (back < 6.4) {
      // the head: the squared spade of the snout, paler; a row of pale sense pores along the side
      o.m = M.snout;
      o.z += 0.5 * K * gs(back - 4.6, 1.0) * gs(v + 0.1, 0.5);
      if (back > 1.2 && back < 5.2 && Math.abs(v + 0.05) < 0.14 && frc(back / 1.5) < 0.45) o.m = M.pore;
      if (back > 1.5 && Math.abs(D - 0.95 * K) < 0.3 * K) o.t -= 0.06;
      o.t -= 0.05 * v;
      return;
    }
    if (S > sTail && S < sGill) {
      // the costal grooves ringing the trunk, the backbone showing through as a row of knuckles
      const g = frc((u - 8) / 1.8);
      if (g < 0.32 && v > -0.6 && v < 0.85 && S < sArm) { o.z -= 0.25 * K; o.t -= 0.04; }
      if (Math.abs(D + 0.95 * K) < 0.42 * K && frc(u / 2) < 0.5 && S > sHip && S < sGill - 1) o.m = M.bone;
      // see-through: the gut a warm shadow low in the trunk, the liver darker at its front, the heart
      // a red beat behind the gills; threads of blood vessel down the flank
      const gs0 = sHip + 0.5 * K, gs1 = sArm - 0.5 * K;
      const gu = (S - gs0) / (gs1 - gs0);
      const gutTop = 0.1 + 0.3 * Math.pow(Math.abs(gu * 2 - 1), 3) + (noise2(u / 2.5, 3, 7) - 0.5) * 0.3;
      if (gu > 0 && gu < 1 && v > gutTop && v < 0.82) { o.m = gu > 0.72 ? M.liver : M.gut; }
      else if (v > 0.62) o.m = M.belly;
      if (g > 0.55 && g < 0.85 && v > -0.45 && v < gutTop - 0.1 && hh(Math.floor((u - 8) / 1.8), 1, 13) < 0.3) o.m = M.vein;
      if (S > sArm + 0.3 * K && S < sGill - 0.2 * K && v > 0.2 && v < 0.75) o.m = M.heart;
      // the shoulder and hip under the skin where the little legs join
      o.z += 0.45 * K * gs((S - sArm) / K, 1.1) * gs(v - 0.45, 0.35) + 0.4 * K * gs((S - sHip) / K, 1.1) * gs(v - 0.45, 0.35);
    } else if (S <= sTail) {
      if (Math.abs(D) < 0.4 * K && frc(u / 1.6) < 0.4) o.m = M.bone;
    }
    o.t -= 0.07 * v;
    void d;
  };
  // ---------------------------------------------------------------- the limbs: little arms and legs
  const limb = (fore: boolean, near: boolean) => {
    sk.np();
    const sAt = fore ? sArm : sHip;
    const root = AX.pt(sAt, 1.0 * K);
    const step = anim === 'walk' ? Math.sin(ph + (fore ? 0 : Math.PI) + (near ? 0 : Math.PI)) : 0;
    let foot: V2;
    if (flee) foot = [root[0] - 3.0 * K, root[1] + 0.8 * K];
    else if (onBed) foot = [root[0] + (fore ? 1.6 : 1.1) * K + step * 1.2 * K, -0.5 * K - Math.max(0, -step) * 0.8 * K];
    else foot = [root[0] + (fore ? 1.2 : 0.5) * K + breathe * 0.2, root[1] + 2.5 * K];
    const z = near ? 3 * K : -3 * K;
    const L = new Lay(sk, Math.min(root[0], foot[0]) - 4, Math.min(root[1], foot[1]) - 3, Math.max(root[0], foot[0]) + 4, Math.max(root[1], foot[1]) + 3);
    const el: V2 = [(root[0] + foot[0]) / 2 + (fore ? -0.5 : 0.5) * K, (root[1] + foot[1]) / 2];
    const ol = limbOutline([[root[0], root[1] - 1.2 * K], el, foot], [[0, 1.1 * K], [0.5, 0.6 * K], [1, 0.45 * K]], [[0, 1.1 * K], [0.5, 0.65 * K], [1, 0.45 * K]], [], 10);
    shape(L, ol, { R: 0.8 * K, z0: z, id: 1, tex: (_x, _y, _d, o) => { o.m = M.skin; o.t = near ? 0.06 : -0.1; } });
    L.emit({ drop: 1.0, bias: near ? 0.02 : -0.08 });
    // the fingers (three) and toes (two): single pixels splayed on the ground or the water
    const nT = fore ? 3 : 2;
    for (let i = 0; i < nT; i++) {
      const a = (flee ? Math.PI * 0.95 : 0.1) + (i - (nT - 1) / 2) * 0.6;
      sk.dot(foot[0] + Math.cos(a) * 1.3 * K, foot[1] + Math.sin(a) * 0.7 * K, M.snout, near ? 0.7 : 0.45, z + 0.3);
    }
  };
  // the gills: three feathery tufts fanning back from the neck (up, back, down), each a red stalk combed
  // with filaments, pale at the tips; they flutter as it breathes and lie flat when it flees
  const G = {
    d: sk.m([SC.gillD], { noRim: true, edge: 0 }), g: sk.m([SC.gill], { noRim: true, edge: 0 }),
    l: sk.m([SC.gillL], { noRim: true, edge: 0 }), t: sk.m([SC.gillT], { noRim: true, edge: 0 }),
  };
  const gills = (near: boolean) => {
    sk.np();
    const sweep = flee * 0.85 + snap * 0.3;
    const z = near ? 6 * K : -6 * K;
    // three plumes rising up and back from the gill slits on the side of the neck like a crown: each a
    // dark red stalk combed with filaments either side by turns, pink, pale at the tips
    for (let i = 0; i < 3; i++) {
      const base = AX.pt(sGill + (0.9 - i * 0.5) * K, (near ? -1.5 + i * 0.85 : -2.0 + i * 0.6) * K);
      const ang = -Math.PI / 2 - [0.42, 0.95, 1.45][i] - sweep * (0.9 - i * 0.25) + breathe * 0.1 * (1 - i * 0.5) - (near ? 0 : 0.2);
      const len = [5.6, 6.0, 4.8][i] * K * (1 - sweep * 0.15) * (near ? 1 : 0.8);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const steps = Math.max(2, Math.round(len));
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        const x = base[0] + dx * len * f, y = base[1] + dy * len * f;
        if (!near) { if (k > 0) sk.dot(x, y, f > 0.6 ? G.g : G.d, 0.5, z); continue; }
        sk.over(x, y, f < 0.3 ? SC.gillD : f < 0.85 ? SC.gill : SC.gillL);
        if (k > 0 && (k + i) % 2 === 0) {
          const side = (k / 2 + (breathe > 0.3 ? 1 : 0)) % 2 < 1 ? 1 : -1;
          sk.over(x - dy * side * 1.1, y + dx * side * 1.1, f > 0.6 ? SC.gillT : SC.gillL);
        }
      }
    }
  };
  limb(true, false); limb(false, false);
  gills(false);
  // the body: one outline, snout to tail tip, fin and all
  sk.np();
  {
    const L = new Lay(sk, -26, -14, 22, 8);
    shape(L, outline, { R: 2.1 * K, id: 1, tex });
    L.emit({ drop: 1.3 * K, contrast: 0.95, ao: 0.08, aoR: 2, spec: new Map([[M.skin, 0.16], [M.snout, 0.18], [M.belly, 0.1]]), specP: 14 });
  }
  // the mouth line, the nostril, the eye specks under the skin
  const tipQ = AX.at(T - 0.4 * K), hb = AX.at(sHead + 0.6 * K);
  const tip = tipQ.p;
  const ha = Math.atan2(tip[1] - hb.p[1], tip[0] - hb.p[0]);
  const H = (x: number, y: number): V2 => [tip[0] + (x * Math.cos(ha) - y * Math.sin(ha)) * K, tip[1] + (x * Math.sin(ha) + y * Math.cos(ha)) * K];
  const gape = snap * 1.6;
  for (let x = -5.6; x <= -0.4; x += 0.5) { const q = H(x, 0.75 + (x + 5.6) * 0.02); sk.overPaint(q[0], q[1], SC.lip); }
  if (gape > 0.5) {
    for (let x = -3.8; x <= 0.4; x += 0.5) { const q = H(x, 1.1); sk.over(q[0], q[1], SC.mouth); if (x > -2) sk.over(q[0], q[1] + gape * 0.7, SC.mouth); }
    const ch = H(0.4, 2.2 + gape * 0.3);
    sk.over(ch[0], ch[1], SC.lip);
  }
  { const q = H(-0.2, -0.35); sk.overPaint(q[0], q[1], SC.nos); }
  { const q = H(-3.4, -0.85); sk.overPaint(q[0], q[1], SC.eye); }
  limb(true, true); limb(false, true);
  gills(true);
  const e = H(-3.4, -0.85);
  return { head: [tip[0] - 2 * K, tip[1] - 3 * K] as V2, eye: e };
}
export const BLINDSAL: SpeciesDef = {
  name: 'Blind Salamander', kind: 'amphibian', len: 30, height: 6,
  anims: SANIMS,
  canvas: () => ({ w: 48, h: 22, ox: 26, oy: 14 }),
  draw: sdraw as SpeciesDef['draw'],
  eyeFor: () => 'closed',
};

// ================================================================== the Ghost Gulper
//
// A giant salamander (Andrias) grown huge in the black lake: a flat, wide head as long as a man, the
// mouth running right across its front; two pinprick milky eyes on top; paired warts over the skull and
// rows of sense pits (the lateral line) round the lips, over the eyes and down the flanks. Three frilled
// gill stalks each side behind the head, blood-pink. A long, flattened trunk hung along each flank with
// the thick, wrinkled lateral fold (it breathes through that loose skin as much as through its gills),
// the backbone showing through as a row of knuckles, the gut as a shadow. Stout, sprawling legs with
// flat splayed toes edged with skin, four in front, five behind. A paddle of a tail with a frilled fin
// above and below. The skin everywhere is wrinkled and pocked, pale as a drowned moon, faintly mottled
// lilac, pink veins showing through. When it gapes, the jaw drops and the pleated throat balloons into
// a pouch, the pink cavern of the mouth lined with tiny teeth.
const GANIMS = {
  idle: { frames: 4, fps: 1.2, loop: true },
  lurk: { frames: 4, fps: 1.2, loop: true },
  swim: { frames: 6, fps: 3.2, loop: true },
  rise: { frames: 4, fps: 3, loop: false },
  gape: { frames: 4, fps: 4, loop: false },
  gapeHold: { frames: 4, fps: 3, loop: true },
  gulp: { frames: 4, fps: 9, loop: false },
  sink: { frames: 4, fps: 3, loop: false },
};
interface GP { ph: number; tail: number; ba: number; ha: number; jaw: number; lunge: number; gill: number; throat: number; drip: number; cheek: number }
function gpose(anim: string, f: number, n: number): GP {
  const t = f / n;
  const p: GP = { ph: t * TAU, tail: 4, ba: 0, ha: 0, jaw: 0, lunge: 0, gill: Math.sin(t * TAU), throat: 0, drip: 0, cheek: 0 };
  switch (anim) {
    case 'swim': p.tail = 13; break;
    case 'rise': p.ba = [-0.04, -0.12, -0.2, -0.24][f]; p.ha = [-0.02, -0.08, -0.14, -0.16][f]; p.drip = 1; p.tail = 6; break;
    case 'gape': p.ba = -0.24; p.ha = -0.16; p.jaw = [0.25, 0.55, 0.85, 1][f]; p.drip = 1; break;
    case 'gapeHold': p.ba = -0.24; p.ha = -0.16; p.jaw = 1; p.throat = Math.sin(t * TAU); p.drip = 1; break;
    case 'gulp': p.ba = [-0.2, -0.1, -0.06, -0.08][f]; p.ha = [-0.1, 0.04, 0.06, 0.02][f]; p.jaw = [0.7, 0.05, 0, 0][f]; p.lunge = [8, 22, 18, 10][f]; p.cheek = [0, 1, 0.8, 0.4][f]; p.drip = 1; p.tail = 10; break;
    case 'sink': p.ba = [-0.12, -0.02, 0.06, 0.1][f]; p.ha = [-0.06, 0, 0.04, 0.06][f]; p.tail = 6; break;
  }
  return p;
}
const GC = {
  eyeW: hex('#eef2f6'), eyeM: hex('#b8c2d0'), eyeD: hex('#4a5266'), pit: hex('#5e6478'), pitL: hex('#eef0f4'),
  drip: hex('#e8f4fa'), drip2: hex('#9cc0d0'), tooth: hex('#f6f1e8'), tooth2: hex('#d4ccc0'),
};
function gdraw(sk: Sk, anim: string, frame: number) {
  const n = GANIMS[anim as keyof typeof GANIMS]?.frames ?? 1;
  const P = gpose(anim, frame, n);
  const M = {
    skin: sk.m(rmp('#c6cad6', { n: 9, dark: 0.58, light: 0.55, cool: 0.32, warm: 0.2, sat: 0.3 }), { edge: 1 }),
    mott: sk.m(rmp('#b0aec4', { n: 8, dark: 0.58, light: 0.5, cool: 0.32, warm: 0.2, sat: 0.3 }), { edge: 1 }),
    pale: sk.m(rmp('#dadfe4', { n: 8, dark: 0.6, light: 0.55, cool: 0.45, warm: 0.25 }), { edge: 1 }),
    belly: sk.m(rmp('#dccfcc', { n: 8, dark: 0.56, light: 0.5, warm: 0.35, cool: 0.25 }), { edge: 1 }),
    fold: sk.m(rmp('#b8b6c8', { n: 8, dark: 0.6, light: 0.5, cool: 0.32, sat: 0.3 }), { edge: 1 }),
    inner: sk.m(rmp('#9c9cb4', { n: 7, dark: 0.6, light: 0.4, cool: 0.45 }), { edge: 0 }),
    vein: sk.m(rmp('#c896a6', { n: 6, dark: 0.55, light: 0.4 }), { edge: 0 }),
    wart: sk.m(rmp('#d4d8e0', { n: 8, dark: 0.62, light: 0.6, cool: 0.4, warm: 0.3 }), { edge: 1 }),
    fin: sk.m(rmp('#a4b2c0', { n: 7, dark: 0.55, light: 0.45, cool: 0.45 }), { edge: 1, k: 0.7 }),
    ray: sk.m(rmp('#98a6b4', { n: 6, dark: 0.5, light: 0.4, cool: 0.45 }), { edge: 0 }),
    gill: sk.m(rmp('#cc6276', { n: 7, dark: 0.6, light: 0.5, sat: 0.3 }), { edge: 1 }),
    gillTip: sk.m(rmp('#f2a2ae', { n: 6, dark: 0.45, light: 0.5 }), { edge: 0 }),
    throat: sk.m(rmp('#5e1a2a', { n: 6, dark: 0.6, light: 0.5 }), { edge: 0 }),
    mouth: sk.m(rmp('#a84058', { n: 8, dark: 0.7, light: 0.45 }), { edge: 0 }),
    tongue: sk.m(rmp('#e08c9c', { n: 7, dark: 0.5, light: 0.45 }), { edge: 1 }),
    stretch: sk.m(rmp('#e0b4bc', { n: 7, dark: 0.55, light: 0.5 }), { edge: 0 }),
    toe: sk.m(rmp('#d0d6dc', { n: 7, dark: 0.6, light: 0.5, cool: 0.45 }), { edge: 1 }),
  };
  const spec = new Map<number, number>([[M.skin, 0.2], [M.mott, 0.18], [M.pale, 0.22], [M.belly, 0.14], [M.fold, 0.2], [M.wart, 0.3], [M.fin, 0.16], [M.gill, 0.25], [M.mouth, 0.35], [M.tongue, 0.4], [M.stretch, 0.3], [M.toe, 0.2]]);
  const BY = -30;
  const hip: V2 = [-34, BY];
  const tilt = (q: V2) => rotP(q, hip, P.ba);
  // ---------------------------------------------------------------- the axis: tail tip to the neck
  const TL = 128, TR = 64;
  const sp: V2[] = [];
  for (let i = 0; i <= 20; i++) {
    const u = 1 - i / 20; // 1 tail tip .. 0 hips
    sp.push(tilt([-34 - u * TL, BY + 2 + Math.sin(P.ph - u * 3.4) * P.tail * Math.pow(u, 1.4) - u * 3]));
  }
  for (let i = 1; i <= 10; i++) { const u = i / 10; sp.push(tilt([-34 + u * TR, BY - Math.sin(u * Math.PI) * 1.5 - u])); }
  for (let i = 1; i <= 4; i++) { const u = i / 4; sp.push(tilt([30 + u * (16 + P.lunge * 0.6), BY - 1 - u * 1.5])); }
  const AX = axis(sp), T = AX.total;
  const sHip = TL, sSh = TL + TR, sNeck = T;
  // the head frame: pivot at the neck, the skull and the jaw hinged behind the eye
  const neck = tilt([44 + P.lunge, BY - 2]);
  const ha = P.ba + P.ha;
  const H = (x: number, y: number): V2 => rotP([neck[0] + x, neck[1] + y], neck, ha);
  const HINGE: V2 = [8, 5];
  const skullA = -P.jaw * 0.17, jawA = P.jaw * 1.12;
  const U = (x: number, y: number): V2 => { const q = rotP([x, y], HINGE, skullA); return H(q[0], q[1]); };
  const Lw = (x: number, y: number): V2 => { const q = rotP([x, y], HINGE, jawA); return H(q[0], q[1]); };
  const hInv = (px: number, py: number): V2 => { const q = rotP([px, py], neck, -ha); return [q[0] - neck[0], q[1] - neck[1]]; };
  const uInv = (px: number, py: number): V2 => rotP(hInv(px, py), HINGE, -skullA);
  const lInv = (px: number, py: number): V2 => rotP(hInv(px, py), HINGE, -jawA);

  // ---------------------------------------------------------------- skin
  /** the wrinkled hide: a net of creases (warped cells), pores, warts, faint lilac mottling, pink veins */
  const skinTex = (x: number, y: number, o: Tx, dense = 1) => {
    const wx = x + (noise2(x / 9, y / 9, 3) - 0.5) * 6, wy = y + (noise2(x / 9 + 5, y / 9, 4) - 0.5) * 6;
    cell(wx, wy, 6.5 / dense, 4.2 / dense, 101);
    const gap = CELL.F2 - CELL.F1;
    o.z += (Math.pow(cl(gap * 2.4), 0.55) - 0.6) * 1.1;
    if (gap < 0.08) o.t -= 0.06;
    // fine wrinkles across the coarse ones
    const fw = noise2(x / 1.6, y / 3.4, 7);
    if (fw > 0.7) { o.z -= 0.25; o.t -= 0.03; }
    // warts, each lit on top
    cell(x, y, 9, 7, 103, 0.9);
    if (CELL.CI < 0.32 && CELL.F1 < 0.2) { o.z += 1.4 * (1 - CELL.F1 / 0.2); o.m = M.wart; o.t += (y - CELL.CY) < 0 ? 0.06 : -0.04; }
    const mot = noise2(x / 14 + 31, y / 9, 5) * 0.7 + noise2(x / 5, y / 4, 6) * 0.3;
    if (o.m === M.skin && mot > 0.56) o.m = M.mott;
    const vn = noise2((x + 50) / 7, (y + 50) / 7, 9);
    if (o.m === M.skin && Math.abs(vn - 0.5) < 0.012) o.m = M.vein;
  };
  /** a row of lateral-line pits along a curve: a dark dot with a pale rim below */
  const pitAt = (x: number, y: number, ax: number, per: number, seed: number) => frc(ax / per + hh(Math.floor(ax / per), 1, seed) * 0.15) < 0.22 && Math.abs(y) < 0.55;

  // ---------------------------------------------------------------- the tail, trunk and neck as one form
  // the outline, dorsal side from the neck back to the tail tip, ventral side from the tip forward
  const sAt = (u: number) => sHip * (1 - u);  // u: 0 hips .. 1 tail tip
  const finU = (u: number, top: boolean) => (top ? 13 : 9) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.7) * Math.min(1, u * 3.5);
  const coreU = (u: number) => 13 * Math.pow(1 - u, 0.85) + 1.2;
  const top: [number, number][] = [[sNeck + 4, 10], [sNeck - 6, 12.5], [sSh, 14.6], [sSh - 30, 15], [sHip + 8, 14.5]];
  for (let i = 0; i <= 12; i++) { const u = i / 12; top.push([sAt(u), coreU(u) * 0.95 + finU(u, true)]); }
  top.push([-1.5, 0.4]);
  const bot: [number, number][] = [[-1.5, -0.4]];
  for (let i = 12; i >= 0; i--) { const u = i / 12; bot.push([sAt(u), coreU(u) * 0.85 + finU(u, false)]); }
  bot.push([sHip + 10, 14], [sHip + 34, 16.5 + P.throat * 0.3], [sSh - 4, 15.5], [sNeck - 8, 13.5], [sNeck + 4, 12]);
  let bodyOl = axisOutline(AX, top, bot, 4);
  // the fin's edge frilled
  bodyOl = fringe(densify(bodyOl, 1.4), p => { const [S, D] = AX.proj(p[0], p[1]); return S < sHip - 6 && Math.abs(D) > coreU(1 - S / sHip) + 2 ? 1 : 0; }, 1.1, 6.5, 211, 0.6);
  const bodyTex = (x: number, y: number, d: number, o: Tx) => {
    const [S, D] = AX.proj(x, y);
    const u = cl(1 - S / sHip);
    const core = S < sHip ? coreU(u) : 99;
    o.m = M.skin;
    if (Math.abs(D) > core + 0.5) {
      // the fin: thin, clear, rayed, its edge frilled
      o.r = 1.4;
      o.m = frc((S + D * 0.45) / 7.5) < 0.14 && noise2(S / 6, D / 3, 15) > 0.42 ? M.ray : M.fin;
      o.z = -4 + noise2(x / 3, y / 3, 13) * 0.6;
      o.t = 0.04 * Math.sign(-D);
      return;
    }
    const hg = S < sHip ? core : S < sSh ? 15 : 13;
    const v = D / hg;
    // the big forms: the shoulders and hips under the skin, the barrel of the trunk, the tail's muscle
    o.z = (2.4 * gs((S - sSh + 4) / 9, 1) * gs(v - 0.2, 0.4) + 2.4 * gs((S - sHip - 4) / 9, 1) * gs(v - 0.2, 0.4)) - 0.8 * gs(v + 0.2, 0.25) * ss(sHip - 40, sHip, S) * (1 - ss(sSh, sSh + 10, S));
    skinTex(x, y, o);
    if (v > 0.55) { if (o.m === M.skin || o.m === M.mott) o.m = M.belly; o.t -= 0.04; }
    // see-through: the backbone a row of knuckles down the back, the gut a darker cloud low in the trunk
    if (S > sHip * 0.35 && S < sNeck - 6 && Math.abs(v + 0.5) < 0.1 && frc(S / 5.2) < 0.55) { o.m = M.inner; o.z += 0.5; }
    if (S > sHip + 6 && S < sSh - 6 && v > 0.05 && v < 0.5 && noise2(S / 16, v * 3, 7) > 0.55) { o.m = M.inner; o.t -= 0.05; }
    // sense pits in a row down the flank, above the fold
    if (S > sHip - 30 && S < sNeck && pitAt(S, D - (-3), S, 4.6, 5)) { o.m = M.inner; o.t -= 0.2; o.z -= 0.6; }
    // the light falls off down the flank
    o.t -= 0.07 * v;
    void d;
  };
  // ---------------------------------------------------------------- the legs: stout, sprawling, flat-toed
  const legG = (front: boolean, near: boolean) => {
    const s = front ? sSh - 8 : sHip + 6;
    const root = AX.pt(s, 6);
    const swing = anim === 'swim' ? Math.sin(P.ph + (front ? 0 : Math.PI) + (near ? 0 : 1)) * 6 : 0;
    const tuck = anim === 'swim' || anim === 'lurk' || anim === 'idle' ? 0.5 : 0;
    const foot: V2 = tilt([(front ? 30 + 8 : -34 - 6) + (near ? 2 : -3) + swing - tuck * (front ? 10 : -10), BY + 30 - tuck * 10]);
    const [knee] = ik2(root, foot, 15, 15, front ? 1 : -1);
    return { root, knee, foot, front, near };
  };
  const drawLeg = (L: Lay, g: ReturnType<typeof legG>, id: number, z0: number) => {
    const ch: V2[] = [AX.pt(g.front ? sSh - 8 : sHip + 6, -2), g.root, g.knee, g.foot];
    const A: Keys = g.front ? [[0, 10], [0.3, 8.6], [0.55, 7.2], [0.62, 7.4], [0.75, 5.6], [0.92, 3.6], [1, 3.4]] : [[0, 11], [0.3, 9.6], [0.55, 7.6], [0.62, 7.0], [0.78, 5.8], [0.92, 3.8], [1, 3.4]];
    const B: Keys = g.front ? [[0, 9], [0.3, 8], [0.55, 5.8], [0.7, 6.2], [0.9, 3.6], [1, 3.4]] : [[0, 10], [0.3, 9.4], [0.5, 7.4], [0.6, 6.0], [0.75, 5.4], [0.92, 3.6], [1, 3.4]];
    const ol = limbOutline(ch, A, B, [], 24);
    // the skin flap along the back edge of the forearm / shin: a ragged frill
    const fr2 = fringe(densify(spline(ol, true, 2), 1.3), p => { const d = Math.hypot(p[0] - g.knee[0], p[1] - g.knee[1]); return d < 14 && p[0] < g.knee[0] + 2 ? 0.8 : 0; }, 1.5, 3, 77 + id, -0.3);
    shape(L, fr2, {
      R: 7, id, blend: 3, z0: (x, y) => z0 + (g.near ? -10 + 10 * ss(g.root[1] - 4, g.root[1] + 6, y) : 0),
      tex: (x, y, d, o) => {
        o.m = M.skin;
        // the elbow / knee knob, the forearm's muscle, wrinkles ringing the wrist
        o.z = 1.6 * gs(Math.hypot(x - g.knee[0], y - g.knee[1]), 3);
        skinTex(x, y, o, 1.3);
        const dw = Math.hypot(x - g.foot[0], y - g.foot[1]);
        if (dw < 7 && frc(dw / 1.8) < 0.3) { o.t -= 0.06; o.z -= 0.4; }
        if (!g.near) o.t -= 0.03;
        void d;
      },
    });
    // the toes: flat, splayed in a fan, each edged with skin, a pale pad at the tip
    const nT = g.front ? 4 : 5;
    for (let i = 0; i < nT; i++) {
      const a = (g.front ? -0.5 : -0.75) + i * (g.front ? 0.5 : 0.42) + (g.near ? 0 : 0.15);
      const len = (g.front ? 9 : 10) - Math.abs(i - (nT - 1) / 2) * 1.4;
      const dir = g.front ? 1 : 1;
      const b: V2 = [g.foot[0] + dir * Math.cos(a) * 2.5, g.foot[1] - 1.5 + Math.sin(a) * 1.2];
      const tp: V2 = [b[0] + dir * Math.cos(a) * len, Math.min(g.foot[1] + 3, b[1] + Math.sin(a) * 2.2 + 1.5)];
      const tol = limbOutline([b, [(b[0] + tp[0]) / 2, (b[1] + tp[1]) / 2 - 0.6], tp], [[0, 2.2], [0.6, 2.0], [1, 1.7]], [[0, 2.0], [0.6, 1.8], [1, 1.6]], [[tp[0] + dir * 1.6, tp[1] + 0.2]], 8);
      shape(L, spline(tol, true, 2), {
        R: 1.6, id: id + 1 + i, z0: z0 + 11 + (g.near ? i * 2.6 : -i * 2.6),
        tex: (x, y, _d, o) => {
          o.m = M.toe;
          const dt = Math.hypot(x - tp[0], y - tp[1]);
          if (dt < 1.8) { o.m = M.pale; o.z += 0.5; }
          else if (frc(Math.hypot(x - b[0], y - b[1]) / 2.4) < 0.25) o.t -= 0.07;
        },
      });
    }
  };
  // ---------------------------------------------------------------- gill stalks: frilled, blood-pink
  const gills = (L: Lay, near: boolean, idBase: number) => {
    for (let i = 0; i < 3; i++) {
      const base = U(6 - i * 5, -7.5 + i * 3.6);
      const ang = ha + skullA - 1.95 - i * 0.45 + P.gill * 0.1 * (i + 1) + (near ? 0 : 0.18);
      const len = (23 - i * 3) * (near ? 1 : 0.85);
      const pts: V2[] = [];
      for (let s = 0; s <= 6; s++) { const u = s / 6; pts.push([base[0] + Math.cos(ang - u * 0.45) * len * u, base[1] + Math.sin(ang - u * 0.45) * len * u + Math.sin(u * 5 + P.ph) * 1.2]); }
      const ol0 = limbOutline(pts, [[0, 2.6], [0.5, 1.8], [1, 0.9]], [[0, 2.6], [0.5, 1.8], [1, 0.9]], [[pts[6][0] + Math.cos(ang - 0.45) * 1.5, pts[6][1] + Math.sin(ang - 0.45) * 1.5]], 14);
      // the filaments: a feathery comb both sides of the stalk
      const ol = fringe(densify(spline(ol0, true, 2), 0.7), () => 1, 3.4, 3.0, 300 + i + (near ? 0 : 10), 1.1);
      shape(L, ol, {
        R: 2, id: idBase + i, z0: near ? 30 : -12,
        tex: (x, y, d, o) => {
          let best = 1e9;
          for (const q of pts) best = Math.min(best, Math.hypot(x - q[0], y - q[1]));
          o.m = d < 1.4 && best > 3.2 ? M.gillTip : M.gill;
          if (best > 2.6 && frc(Math.atan2(y - base[1], x - base[0]) * 30) < 0.3) o.t -= 0.08;
          if (!near) o.t -= 0.1;
        },
      });
    }
  };

  // ---------------------------------------------------------------- the far side: legs and gills
  const lf = legG(true, false), lh = legG(false, false);
  // the layers only cover what they hold
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const q of bodyOl) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
  let hx0 = 1e9, hy0 = 1e9, hx1 = -1e9, hy1 = -1e9;
  for (const [x, y] of [[-30, -40], [80, -40], [80, 45], [-30, 45]] as const) for (const q of [U(x, y), Lw(x, y), H(x, y)]) { hx0 = Math.min(hx0, q[0]); hx1 = Math.max(hx1, q[0]); hy0 = Math.min(hy0, q[1]); hy1 = Math.max(hy1, q[1]); }
  {
    sk.np();
    const L = new Lay(sk, bx0 - 10, Math.min(by0, hy0) - 10, Math.max(bx1, hx1) + 10, by1 + 40);
    drawLeg(L, lf, 10, -16); drawLeg(L, lh, 30, -16);
    gills(L, false, 60);
    L.emit({ bias: -0.3, drop: 3, ao: 0.05, spec, specP: 14, contrast: 1.3 });
  }
  // ---------------------------------------------------------------- the body, the near legs, the fold
  sk.np();
  const LB = new Lay(sk, bx0 - 4, by0 - 4, bx1 + 4, by1 + 40);
  shape(LB, bodyOl, { R: 10, hs: 1.3, id: 1, blend: 4, tex: bodyTex });
  // the lateral fold: a thick, wrinkled ridge of loose skin along each flank, armpit to groin, its lower
  // edge hanging in scallops
  {
    const s0 = sHip + 2, s1 = sSh - 2;
    const topF: [number, number][] = [], botF: [number, number][] = [];
    for (let i = 0; i <= 14; i++) { const s = s1 - (s1 - s0) * (i / 14); topF.push([s, -(1.5 + Math.sin(i * 1.3) * 0.6)]); }
    for (let i = 14; i >= 0; i--) { const s = s1 - (s1 - s0) * (i / 14); const sag = Math.sin((i / 14) * Math.PI); botF.push([s, 6.5 + sag * 3.2]); }
    // (axisOutline takes the top as "px above"; the fold sits below the axis, so its top offsets are negative)
    let ol = axisOutline(AX, topF, botF, 3);
    ol = fringe(densify(ol, 1.2), p => { const [, D] = AX.proj(p[0], p[1]); return D > 5 ? 1 : 0; }, 2.2, 5.5, 91, 0.1);
    shape(LB, ol, {
      R: 3, id: 2, blend: 0, z0: 17,
      tex: (x, y, d, o) => {
        const [S, D] = AX.proj(x, y);
        o.m = M.fold;
        // vertical creases where the loose skin bunches
        const cr = frc((S + Math.sin(D * 0.6) * 2) / 5.5);
        o.z = cr < 0.25 ? -1.2 : 0.4 * Math.sin(cr * Math.PI);
        if (cr < 0.18) o.t -= 0.08;
        skinTex(x, y, o, 1.4);
        if (o.m === M.skin || o.m === M.mott) o.m = M.fold;
        void d;
      },
    });
  }
  const nf = legG(true, true), nh = legG(false, true);
  drawLeg(LB, nh, 80, 18); drawLeg(LB, nf, 100, 18);
  LB.emit({ bias: -0.12, drop: 3.2, ao: 0.07, aoR: 3, seam: 2, spec, specP: 14, contrast: 1.35 });

  // ---------------------------------------------------------------- the head
  sk.np();
  const LH = new Lay(sk, hx0, hy0, hx1, hy1);
  const EYE: V2 = [50, -11.2];
  const open = P.jaw > 0.04;
  // the skull's outline (head units): the flat crown, the eye's low bump, the broad rounded snout, the
  // upper lip running back to the corner of the mouth (far back under the gills)
  const upperK: [number, number][] = [
    [-4, -9], [6, -12.4], [22, -12.8], [38, -12.4], [47, -12.6], [50, -13.4], [53, -12.6], [62, -10.6], [69.5, -7], [74, -2.6],
    [75, 1.2], [73.2, 4.2], [64, 5.6], [44, 6.2], [24, 6.4], [10, 6.2],
  ];
  const closedK: [number, number][] = [[72.4, 6.2], [72, 9.2], [66, 12.4], [52, 14.4], [32, 15.4], [14, 15.6], [2, 14.4], [-4, 11]];
  const upperOl = spline((open ? [...upperK, [HINGE[0], HINGE[1]], [2, 8], [-4, 9]] : [...upperK, ...closedK]).map(([x, y]) => U(x, y)) as V2[], true, 4);
  const headTex = (hx: number, hy: number, d: number, o: Tx, jaw: boolean) => {
    o.m = M.skin;
    // the big forms: the flat crown, the eye's mound, the jaw muscles behind it, the broad snout
    const de = Math.hypot(hx - EYE[0], (hy - EYE[1]) * 1.3);
    o.z = (2.2 * gs(de, 3) + 2.4 * gs(hx - 22, 8) * gs(hy + 2, 5) + 1.5 * gs(hx - 66, 6) * gs(hy + 3, 5)) - (jaw ? 0 : 0.3 * gs(hy - 6.2, 0.6) * ss(10, 20, hx));
    skinTex(hx + 400, hy, o, 1.15);
    // paired warts over the crown, in two rows
    if (!jaw && hy < -5) {
      const ux = (hx - 6) / 6.5, ui = Math.floor(ux);
      const wy = ui % 2 ? -8.6 : -6.6;
      const dw = Math.hypot((frc(ux) - 0.5) * 6.5, hy - wy);
      if (ui >= 0 && ui < 8 && dw < 1.6) { o.m = M.wart; o.z += 1.4 * (1 - dw / 1.6); o.t += hy < wy ? 0.06 : -0.05; }
    }
    // the lateral-line pits: a row round the upper lip, one over the eye, one on the cheek; and on the jaw
    if (!jaw) {
      const lip = 6.2 - (hx > 64 ? (hx - 64) * 0.18 : 0);
      if (hx > 14 && hx < 70 && pitAt(hx, hy - (lip - 3.2), hx, 3.8, 21)) { o.m = M.inner; o.t -= 0.22; o.z -= 0.6; }
      if (hx > 30 && hx < 64 && pitAt(hx, hy - (-9.6 + (hx - 30) * 0.03), hx, 3.4, 22)) { o.m = M.inner; o.t -= 0.2; o.z -= 0.5; }
    } else if (hx > 14 && hx < 68 && pitAt(hx, hy - 9.6, hx, 3.6, 23)) { o.m = M.inner; o.t -= 0.2; o.z -= 0.5; }
    if (hy > 9 || jaw && hy > 10) { if (o.m === M.skin || o.m === M.mott) o.m = M.belly; }
    o.t -= 0.04 * cl((hy + 4) / 14, -0.5, 1);
    void d;
  };
  // the far gills are behind (drawn with the far legs); the throat pouch and the open mouth first
  if (P.jaw > 0.2) {
    // the throat pouch: the floor of the mouth ballooned into a pleated bag (the megamouth)
    const k2 = (P.jaw - 0.2) / 0.8;
    const sag = 9 + 13 * k2 + P.throat * 1.6;
    const pts: V2[] = [Lw(4, 14), Lw(20, 15.5 + sag * 0.5), Lw(40, 15.5 + sag), Lw(58, 14 + sag * 0.75), Lw(70, 11), Lw(66, 8), Lw(40, 8), H(-6, 10)];
    shape(LH, spline(pts, true, 4), {
      R: 10, id: 3, z0: 2,
      tex: (x, y, d, o) => {
        const [lx, ly] = lInv(x, y);
        // pleats running lengthways down the pouch, pale skin stretched pink between them
        const pl = frc((ly - 10) / (2.2 + k2 * 1.6) + Math.sin(lx * 0.08) * 0.3);
        o.m = pl < 0.22 ? M.fold : k2 > 0.4 && ly > 16 ? M.stretch : M.belly;
        o.z = pl < 0.22 ? -1.2 : 0.6 * Math.sin(pl * Math.PI);
        if (pl < 0.15) o.t -= 0.1;
        const vn = noise2(x / 6, y / 6, 19);
        if (Math.abs(vn - 0.5) < 0.015 && o.m !== M.fold) o.m = M.vein;
        void d;
      },
    });
  }
  if (open) {
    // the mouth: from the hinge out to both lips, a pink cavern going black down the gullet, the palate
    // ridged, a fat pale tongue on the floor; tiny teeth fringing both jaws
    const up: V2[] = [], lo: V2[] = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, x = HINGE[0] + u * 64; up.push(U(x, 5.6 - Math.sin(u * Math.PI) * 3 * P.jaw)); lo.push(Lw(x, 5 + Math.sin(Math.min(1, u * 1.15) * Math.PI) * 8 * P.jaw)); }
    const a = up[up.length - 1], b = lo[lo.length - 1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const hg = H(HINGE[0], HINGE[1]);
    const dx = hg[0] - mx, dy = hg[1] - my, dl = Math.hypot(dx, dy) || 1;
    const c: V2 = [mx + (dx / dl) * 12 * P.jaw, my + (dy / dl) * 12 * P.jaw];
    const mo = [...up, c, ...lo.reverse()];
    shape(LH, spline(mo, true, 2), {
      R: 8, id: 4, z0: 0,
      tex: (x, y, d, o) => {
        const dh = Math.hypot(x - hg[0], y - hg[1]);
        const gR = 17 + P.throat * 2;
        if (dh < gR) { o.m = M.throat; o.t -= 0.35 * (1 - dh / gR) + 0.08; return; }
        const [ux, uy] = uInv(x, y), [lx, ly] = lInv(x, y);
        o.m = M.mouth;
        // the fat tongue on the floor
        const tl = ((lx - 36) / 16) ** 2 + ((ly - 2.5) / (3.8 + P.throat * 0.4)) ** 2;
        if (tl < 1 && ly < 5.6) { o.m = M.tongue; o.z = 2 * Math.sqrt(1 - tl); if (Math.abs(ly - 1.6) < 0.4 && Math.abs(lx - 36) < 12) o.t -= 0.1; return; }
        // the palate's folds running back to the gullet
        const ang = Math.atan2(y - hg[1], x - hg[0]);
        if (uy < 6 && Math.sin(ang * 44) > 0.75 && dh > 22) { o.t -= 0.1; o.z = -0.6; }
        const wet = noise2((x + 77) / 6, (y + 77) / 4, 12);
        if (wet > 0.7) o.t += 0.12; else if (wet < 0.3) o.t -= 0.07;
        o.t -= 0.38 * cl(1 - (dh - gR) / 34);
        void ux; void d;
      },
    });
    // the lower jaw
    const jawK: [number, number][] = [[HINGE[0], HINGE[1] - 0.5], [24, 5.4], [44, 5.2], [64, 5.4], [72.4, 6.2], [72, 9.2], [66, 12.4], [52, 14.4], [32, 15.4], [14, 15.6], [2, 14.4], [-1, 9]];
    shape(LH, spline(jawK.map(([x, y]) => Lw(x, y)) as V2[], true, 4), {
      R: 5, hs: 1.3, id: 5, z0: 16, blend: 2,
      tex: (x, y, d, o) => { const [lx, ly] = lInv(x, y); headTex(lx, ly, d, o, true); if (ly < 6.4 && lx > 12) { o.m = M.stretch; o.t -= 0.06; } },
    });
  }
  shape(LH, upperOl, {
    R: 7, hs: 1.3, id: 6, z0: 12, blend: 2,
    tex: (x, y, d, o) => {
      const [ux, uy] = uInv(x, y);
      headTex(ux, uy, d, o, false);
      // the lip: a dark seam along the mouth when it is shut, the gum's edge when open
      const lip = ux > 64 ? 5.6 - (ux - 64) * 0.2 : 6.2;
      if (ux > 10 && Math.abs(uy - lip) < (open ? 0.9 : 0.42) && uy < 7.5) { o.m = open ? M.stretch : M.inner; o.t -= open ? 0.04 : 0.06; }
    },
  });
  if (P.cheek > 0.1) {
    // the cheeks puffed full of water after the snap
    const ck = Lw(36, 10);
    shape(LH, spline([[ck[0] - 26, ck[1] - 2], [ck[0], ck[1] - 6 - P.cheek * 2], [ck[0] + 24, ck[1] - 3], [ck[0] + 22, ck[1] + 4 + P.cheek * 4], [ck[0] - 4, ck[1] + 7 + P.cheek * 6], [ck[0] - 24, ck[1] + 4]], true, 4), {
      R: 8, id: 7, z0: 18, blend: 3, tex: (x, y, d, o) => { const [lx, ly] = lInv(x, y); headTex(lx, ly, d, o, true); },
    });
  }
  gills(LH, true, 20);
  LH.emit({ bias: -0.1, drop: 3, ao: 0.07, aoR: 3, seam: 2, spec, specP: 14, contrast: 1.35 });
  // tiny teeth along both jaws
  if (open) for (let i = 0; i < 19; i++) {
    // tiny teeth: little pale spikes along both jaws, pointing into the mouth
    const x = 17 + i * 3 + (i % 2) * 0.6;
    const a = U(x, 6.4), a2 = U(x, 7.6 + (i % 3 === 0 ? 0.8 : 0)), b = Lw(x, 5.0), b2 = Lw(x, 3.8 - (i % 3 === 1 ? 0.8 : 0));
    sk.over(a[0], a[1], GC.tooth); sk.over(a2[0], a2[1], i % 3 ? GC.tooth2 : GC.tooth);
    sk.over(b[0], b[1], GC.tooth); sk.over(b2[0], b2[1], i % 3 ? GC.tooth2 : GC.tooth);
  }
  // the eye: a pinprick, milky, set in its mound
  const ey = U(EYE[0], EYE[1]);
  sk.over(ey[0] - 1, ey[1], GC.eyeD); sk.over(ey[0], ey[1] - 1, GC.eyeD); sk.over(ey[0] + 1, ey[1] - 1, GC.eyeD); sk.over(ey[0] + 2, ey[1], GC.eyeD);
  sk.over(ey[0], ey[1], GC.eyeM); sk.over(ey[0] + 1, ey[1], GC.eyeW); sk.over(ey[0], ey[1] + 1, GC.eyeD); sk.over(ey[0] + 1, ey[1] + 1, GC.eyeM);
  // the nostrils at the front of the snout
  const ns = U(71.5, -4.6);
  sk.over(ns[0], ns[1], GC.pit); sk.over(ns[0] + 1, ns[1], GC.pit);
  // water streaming off the head and back as it comes up
  if (P.drip) for (let i = 0; i < 16; i++) {
    const x = -20 + hh(i, frame, 3) * 100, tp = tilt([x, BY - 16]);
    const len = 2 + Math.floor(hh(i, 2, 4) * 5);
    for (let s = 0; s < len; s++) sk.over(tp[0] + (i % 2), tp[1] + 2 + s * 2 + frame, s === 0 ? GC.drip : GC.drip2);
  }
  return { head: U(40, -18), eye: ey };
}
export const GULPER: SpeciesDef = {
  name: 'Ghost Gulper', kind: 'amphibian', len: 290, height: 64,
  anims: GANIMS,
  canvas: () => ({ w: 360, h: 220, ox: 196, oy: 150 }),
  draw: gdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};
