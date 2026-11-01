// V12 Te Rua Pōuri, the animals of the deep dark cave, sculpted with the beast sketch (shared shading,
// edge lines and rim light with every other animal).
//
// The Blind Salamander: an olm of the stream pools. A long eel of a body, pale pink and nearly
// see-through (the blood shows in faint veins, the gut a shadow inside), a flat spade of a snout with
// no eyes at all (only a faint smudge under the skin where they used to be), three feathery scarlet
// gill tufts each side of the head, and four tiny limbs, three fingers in front, two toes behind.
// Anims: idle (the gills breathing), swim, walk (on the pool bed), rest, flee, snap.
//
// The Ghost Gulper: a giant salamander four times Mori's length, pale as a drowned moon and nearly
// translucent (the spine and the gut show through as shadows; blood-pink in the gills and the mouth),
// skin hanging in wrinkled folds down the flanks, a flat broad head with two pinprick milky eyes on
// top, frilled gill stalks behind the head, short stout legs with splayed toes and a long paddle tail
// with a fin above and below. The mouth runs right across the front of the head: it gapes open into
// a pink cavern lined with tiny teeth, bigger than Mori standing up. Anims: lurk, swim, rise, gape (the
// jaw dropping), gapeHold (held wide, the throat pulsing), gulp (the lunge and the snap), sink.
//
// The Cave Wētā: a humpbacked amber cricket, banded brown, no wings, antennae three times its length
// always feeling the air, huge spiny drumstick hind legs. Anims: idle, walk, jump, windup (the crouch
// before it leaps: the tell), feed.
//
// The Cave Harvestman: a seed of a body slung between eight hair-thin legs, knees high; bobs its body
// up and down in a blur when disturbed. Anims: idle, walk, bob.
//
// The Cave Centipede: forty legs, a flat amber body banded dark, long feelers, and the curved venom
// claws under the head. Anims: idle, walk, rear (the threat), strike.

import { Sk, V2, rmp, TAU, hh, ik2 } from '../../beasts-core';
import type { Px, SpeciesDef } from '../../beasts-core';
import { hex } from '../../color';
import { noise2 } from '../../../core/math';

const rotAbout = (p: V2, c: V2, a: number): V2 => {
  const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
};

// ================================================================== the Blind Salamander
const SANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  swim: { frames: 6, fps: 8, loop: true },
  walk: { frames: 4, fps: 5, loop: true },
  rest: { frames: 2, fps: 1, loop: true },
  flee: { frames: 4, fps: 14, loop: true },
  snap: { frames: 3, fps: 10, loop: false },
};
function sdraw(sk: Sk, anim: string, frame: number, _eye: unknown, juv: boolean) {
  const n = SANIMS[anim as keyof typeof SANIMS]?.frames ?? 1;
  const t = frame / n;
  const k = juv ? 0.75 : 1;
  const amp = anim === 'swim' ? 1.6 : anim === 'flee' ? 2.4 : anim === 'walk' ? 0.8 : anim === 'rest' ? 0.3 : 0.5;
  const ph = t * TAU;
  const gill = anim === 'idle' || anim === 'rest' ? Math.sin(ph) : Math.sin(ph * 2) * 0.5;
  const snap = anim === 'snap' ? [0.3, 1, 0.2][frame] : 0;
  const M = {
    skin: sk.m(rmp('#efc6c0', { n: 7, dark: 0.42, light: 0.55, warm: 0.3, cool: 0.2 }), { spec: 0.45, edge: 1 }),
    vein: sk.m(rmp('#d8888a', { n: 5, dark: 0.4, light: 0.4 }), { spec: 0.3, edge: 0 }),
    gut: sk.m(rmp('#c89a96', { n: 5, dark: 0.4, light: 0.3 }), { spec: 0.3, edge: 0 }),
    fin: sk.m(rmp('#f4dcd6', { n: 4, dark: 0.3, light: 0.5 }), { edge: 1 }),
    gill: sk.m(rmp('#e04454', { n: 5, dark: 0.4, light: 0.55 }), { spec: 0.5, edge: 0 }),
  };
  // the spine, snout to tail tip, rippling
  const N = 14;
  const spine: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    spine.push([(12 - u * 30) * k, (-2.6 + Math.sin(ph - u * 4.2) * amp * Math.pow(u, 1.2) - snap * (1 - u) * 1.2) * k]);
  }
  const rad = (u: number) => (u < 0.12 ? 1.1 + u * 9 : u < 0.5 ? 2.2 + Math.sin((u - 0.12) / 0.38 * Math.PI) * 0.3 : 2.2 * Math.pow(1 - (u - 0.5) / 0.5, 0.9) + 0.25) * k;
  const fill = (p: Px) => {
    // see-through: the gut a shadow, veins showing
    if (p.t > 0.25 && p.t < 0.55 && Math.abs(p.v) < 0.35) { p.l -= 0.06; return M.gut; }
    const vn = noise2(p.x * 0.9 + 40, p.y * 0.9 + 40, 3);
    if (vn > 0.5 && vn < 0.53) return M.vein;
    return M.skin;
  };
  // the far limbs
  const limb = (x: number, near: boolean, fingers: number) => {
    sk.np();
    const z = near ? 6 : -6, s = near ? 1 : -1;
    const step = anim === 'walk' ? Math.sin(ph + (near ? 0 : Math.PI) + x) * 1.2 : 0;
    const a: V2 = [x * k, -1.6 * k], b: V2 = [(x + 1.2 + step) * k, (0.2) * k];
    sk.tube([a, b], 0.45 * k, M.skin, { z, bias: near ? 0 : -0.15 });
    for (let i = 0; i < fingers; i++) sk.dot(b[0] + (i - 0.5) * 0.8 + 0.6, b[1] + 0.2, M.skin, 0.7, z + 0.2);
    void s;
  };
  limb(5, false, 3); limb(-7, false, 2);
  // the tail fin, a thin keel above and below the back half, tapering to the tip
  sk.np();
  const keel = (top: boolean) => {
    const pts: number[] = [];
    for (let i = 7; i <= N; i++) { const [x, y] = spine[i]; pts.push(x, y + (top ? -1 : 1) * (rad(i / N) - 0.4)); }
    for (let i = N; i >= 7; i--) {
      const [x, y] = spine[i], u = (i - 7) / (N - 7);
      pts.push(x, y + (top ? -1 : 1) * (rad(i / N) + Math.sin(u * Math.PI * 0.92) * (top ? 2 : 1.4) * k));
    }
    sk.poly(pts, M.fin, { z: 1 });
  };
  keel(true); keel(false);
  // the body
  sk.np();
  sk.tube(spine, i => rad(i), fill, { z: 2 });
  // the snout: flat, spade-shaped, a slight lip line
  sk.np();
  const [sx, sy] = spine[0];
  sk.ell(sx - 1.2 * k, sy + 0.3 * k, 2.6 * k, 1.3 * k, M.skin, { z: 4, rot: snap * -0.3 });
  sk.over(sx + 0.6 * k, sy + 1.1 * k, hex('#b0787a'));
  sk.over(sx - 0.6 * k, sy + 1.2 * k, hex('#b0787a'));
  if (snap > 0.5) { sk.over(sx + 1.4 * k, sy + 1.4 * k, hex('#8a3a40')); sk.over(sx + 0.6 * k, sy + 1.8 * k, hex('#8a3a40')); }
  // where the eyes were: a faint smudge under the skin
  sk.over(sx - 2.4 * k, sy - 0.8 * k, hex('#d6a6a2'));
  // the gills: three feathery scarlet tufts, breathing
  const gx = spine[2][0], gy = spine[2][1];
  for (let i = 0; i < 3; i++) {
    sk.np();
    const ang = -2.1 + i * 0.42 + gill * 0.12;
    const L = (2.6 + (i === 1 ? 0.8 : 0)) * k;
    const tip: V2 = [gx - 0.6 + Math.cos(ang) * L, gy - 0.8 + Math.sin(ang) * L];
    sk.tube([[gx - 0.4, gy - 0.8], tip], 0.4 * k, M.gill, { z: 5 });
    for (let q = 1; q <= 3; q++) {
      const fx = gx - 0.4 + (tip[0] - gx) * q / 3.2, fy = gy - 0.8 + (tip[1] - gy) * q / 3.2;
      sk.over(fx - 1, fy, hex(q % 2 ? '#ff7c88' : '#f04c5c'));
      sk.over(fx + 1, fy - 0.5, hex('#ffb0b8'));
    }
  }
  limb(4, true, 3); limb(-8, true, 2);
  return { head: [sx, sy - 3 * k] as V2, eye: [sx - 2.4 * k, sy - 0.8 * k] as V2 };
}
export const BLINDSAL: SpeciesDef = {
  name: 'Blind Salamander', kind: 'amphibian', len: 30, height: 6,
  anims: SANIMS,
  canvas: () => ({ w: 48, h: 22, ox: 26, oy: 14 }),
  draw: sdraw as SpeciesDef['draw'],
  eyeFor: () => 'closed',
};

// ================================================================== the Ghost Gulper
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
function gdraw(sk: Sk, anim: string, frame: number) {
  const n = GANIMS[anim as keyof typeof GANIMS]?.frames ?? 1;
  const P = gpose(anim, frame, n);
  const M = {
    skin: sk.m(rmp('#c6d2d8', { n: 9, dark: 0.6, light: 0.6, cool: 0.6, warm: 0.15 }), { spec: 0.4, edge: 1 }),
    belly: sk.m(rmp('#dcd0d0', { n: 7, dark: 0.5, light: 0.55, warm: 0.4 }), { spec: 0.3, edge: 1 }),
    fold: sk.m(rmp('#8e98aa', { n: 6, dark: 0.55, light: 0.4, cool: 0.5 }), { edge: 0 }),
    inner: sk.m(rmp('#a6a8bc', { n: 6, dark: 0.5, light: 0.35, cool: 0.4 }), { spec: 0.3, edge: 0 }),
    vein: sk.m(rmp('#c89aa8', { n: 5, dark: 0.45, light: 0.35 }), { spec: 0.3, edge: 0 }),
    fin: sk.m(rmp('#b4c4cc', { n: 6, dark: 0.45, light: 0.55, cool: 0.4 }), { spec: 0.25, edge: 1 }),
    ray: sk.m(rmp('#8a9cac', { n: 4, dark: 0.4 }), { edge: 0 }),
    gill: sk.m(rmp('#d46a7c', { n: 6, dark: 0.5, light: 0.55 }), { spec: 0.45, edge: 0 }),
    gillTip: sk.m(rmp('#f4a4b0', { n: 4, dark: 0.3, light: 0.5 }), { spec: 0.4, edge: 0 }),
    throat: sk.m(rmp('#6e2232', { n: 6, dark: 0.6, light: 0.45 }), { spec: 0.5, edge: 0 }),
    mouth: sk.m(rmp('#c45a6e', { n: 6, dark: 0.5, light: 0.45 }), { spec: 0.55, edge: 0 }),
    tongue: sk.m(rmp('#e894a2', { n: 5, dark: 0.4, light: 0.45 }), { spec: 0.6, edge: 1 }),
    stretch: sk.m(rmp('#e2b8bc', { n: 6, dark: 0.45, light: 0.5 }), { spec: 0.35, edge: 0 }),
    toe: sk.m(rmp('#d6dce0', { n: 5, dark: 0.45, light: 0.5 }), { edge: 1 }),
  };
  const BY = -30;
  const hip: V2 = [-34, BY];
  const tilt = (q: V2) => rotAbout(q, hip, P.ba);
  // skin: wrinkled, mottled faintly lavender, the spine and the gut shadows showing through
  const wrinkle = (p: Px, axisV: number) => {
    const cre = Math.sin(p.x * 0.85 + noise2(p.x / 9, p.y / 9, 3) * 5);
    if (cre > 0.88) p.l -= 0.08;
    else if (cre < -0.9) p.l += 0.04;
    const mot = noise2((p.x + 300) / 14, (p.y + 300) / 10, 5);
    if (mot > 0.66) p.l -= 0.05;
    void axisV;
  };
  const bodyFill = (p: Px) => {
    // the lateral skin fold: a wavering ridge down the flank, lit above, creased under
    const fv = 0.36 + Math.sin(p.x * 0.3) * 0.06 + Math.sin(p.x * 0.11) * 0.05;
    if (Math.abs(p.v - fv) < 0.05) return M.fold;
    if (p.v > fv && p.v < fv + 0.12) p.l += 0.08;
    if (p.v > fv + 0.15) { wrinkle(p, 1); return M.belly; }
    wrinkle(p, 0);
    // see-through: the spine a row of faint knuckles, the gut a darker cloud
    if (Math.abs(p.v + 0.12) < 0.05 && Math.floor(p.x / 4) % 2 === 0) { p.l -= 0.05; return M.inner; }
    if (p.v > -0.05 && p.v < 0.3 && noise2((p.x + 90) / 16, (p.y + 90) / 8, 7) > 0.6) { p.l -= 0.04; return M.inner; }
    const vn = noise2((p.x + 50) / 6, (p.y + 50) / 6, 9);
    if (vn > 0.495 && vn < 0.515) return M.vein;
    return M.skin;
  };
  // the tail: a long paddle, waving
  const tailPts: V2[] = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    tailPts.push(tilt([-34 - u * 128, BY + 2 + Math.sin(P.ph - u * 3.4) * P.tail * Math.pow(u, 1.4) - u * 3]));
  }
  const trad = (u: number) => 15 * Math.pow(1 - u, 0.85) + 1.5;
  // legs
  const leg = (x: number, near: boolean, front: boolean) => {
    sk.np();
    const z = near ? 26 : -16, bias = near ? 0 : -0.18;
    const sh = tilt([x, BY + 8]);
    const swing = anim === 'swim' ? Math.sin(P.ph + (front ? 0 : Math.PI) + (near ? 0 : 1)) * 6 : 0;
    const tuck = anim === 'swim' || anim === 'lurk' || anim === 'idle' ? 0.5 : 0;
    const foot: V2 = tilt([x + (front ? 8 : -6) + swing - tuck * (front ? 10 : -10), BY + 30 - tuck * 10]);
    const [knee] = ik2(sh, foot, 14, 14, front ? -1 : 1);
    const legFill = (p: Px) => { if (Math.sin(p.t * 16 + p.v) > 0.75) p.l -= 0.09; return M.skin; };
    sk.tube([sh, knee], t => 7 - t * 1.5, bodyFill, { z, bias });
    sk.tube([knee, foot], t => 5.5 - t * 1.5, legFill, { z: z + 1, bias });
    for (let i = 0; i < (front ? 4 : 5); i++) {
      const a = (front ? -0.5 : -0.9) + i * 0.38;
      const tip: V2 = [foot[0] + Math.cos(a) * 8 * (front ? 1 : -1) * -1 + (front ? 6 : -2), foot[1] + Math.abs(Math.sin(a)) * 2 + 1];
      sk.tube([foot, tip], t => 1.8 - t * 0.6, M.toe, { z: z + 2, bias });
      sk.ell(tip[0], tip[1], 1.5, 1.1, M.toe, { z: z + 3, bias });
    }
  };
  leg(28, false, true);
  leg(-30, false, false);
  // the fins along the tail, rayed
  sk.np();
  // the paddle: a fin above and below the tail, rising from the hips, tallest two thirds along,
  // rounding off at the tip, its edge frilled, faint rays through it
  const finH = (u: number, top: boolean) => (top ? 20 : 13) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.75) * Math.min(1, u * 4) + (Math.sin(u * 40) * 0.8);
  const finPts = (top: boolean): number[] => {
    const out: number[] = [];
    for (let i = 1; i <= 18; i++) { const u = i / 18, [x, y] = tailPts[i]; out.push(x, y + (top ? -1 : 1) * (trad(u) * 0.6)); }
    for (let i = 18; i >= 1; i--) { const u = i / 18, [x, y] = tailPts[i]; out.push(x - (top ? 1 : 0), y + (top ? -1 : 1) * (trad(u) * 0.6 + finH(u, top))); }
    return out;
  };
  sk.poly(finPts(true), (p: Px) => (noise2((p.x + 200) / 5, (p.y + 200) / 5, 13) > 0.7 ? M.ray : M.fin), { z: -3 });
  sk.poly(finPts(false), (p: Px) => (noise2((p.x + 200) / 5, (p.y + 200) / 5, 14) > 0.72 ? M.ray : M.fin), { z: -3 });
  for (let i = 2; i <= 17; i++) {
    const u = i / 18, [x, y] = tailPts[i];
    const a = trad(u) * 0.6, ht = finH(u, true), hb = finH(u, false);
    sk.overLine(x, y - a - 1, x - 3, y - a - ht * 0.85, hex('#9eb0bc'));
    sk.overLine(x, y + a + 1, x - 3, y + a + hb * 0.8, hex('#94a6b2'));
  }
  sk.np();
  sk.tube(tailPts, i => trad(i), bodyFill, { z: 0 });
  // the body: long, flat, heavy, hung with folds
  sk.np();
  const bc = tilt([4, BY - 1]);
  sk.ell(bc[0], bc[1], 50, 17, bodyFill, { rot: P.ba, rz: 16, z: 6 });
  sk.ell(...tilt([-26, BY]), 22, 15, bodyFill, { rot: P.ba, rz: 13, z: 5 });
  // a low wrinkled crest along the back, running on into the tail fin
  {
    sk.np();
    const cp: number[] = [];
    for (let x = -64; x <= 40; x += 2) { const q = tilt([x, BY - 14]); cp.push(q[0], q[1]); }
    for (let x = 40; x >= -64; x -= 2) { const q = tilt([x, BY - 17.5 - Math.abs(Math.sin(x * 0.45)) * 2 - (x < -20 ? (-20 - x) * 0.05 : 0)]); cp.push(q[0], q[1]); }
    sk.poly(cp, (p: Px) => { if (Math.sin(p.x * 1.4) > 0.6) p.l -= 0.1; return M.fin; }, { z: 5.5 });
  }
  // the head: flat and broad, pivoting at the neck; the lower jaw drops from the hinge
  const neck = tilt([44 + P.lunge, BY - 2]);
  const ha = P.ba + P.ha;
  const H = (q: V2): V2 => { const r = rotAbout([neck[0] + q[0], neck[1] + q[1]], neck, ha); return r; };
  const hinge = H([6, 5]);
  const jawA = P.jaw * 1.12, skullA = -P.jaw * 0.17;
  const U = (q: V2): V2 => rotAbout(H(q), hinge, skullA);
  const L = (q: V2): V2 => rotAbout(H(q), hinge, jawA);
  const headFill = (p: Px) => { wrinkle(p, 0); if (p.v > 0.55) { p.l += 0.03; return M.belly; } return M.skin; };
  // far gill frills
  const frill = (near: boolean) => {
    for (let i = 0; i < 3; i++) {
      sk.np();
      const z = near ? 30 : -8;
      const base = U([4 - i * 5, -6 + i * 3]);
      const ang = ha + skullA - 2.4 + i * 0.25 + P.gill * 0.1 * (i + 1);
      const len = 22 - i * 3;
      const pts: V2[] = [];
      for (let s = 0; s <= 6; s++) { const u = s / 6; pts.push([base[0] + Math.cos(ang + u * 0.6) * len * u, base[1] + Math.sin(ang + u * 0.6) * len * u + Math.sin(u * 5 + P.ph) * 1.2]); }
      sk.tube(pts, t => 2.6 - t * 1.6, M.gill, { z, bias: near ? 0 : -0.2 });
      // the feathery filaments both sides of each stalk
      for (let s = 1; s < pts.length; s++) {
        const [x, y] = pts[s], [x0, y0] = pts[s - 1];
        const dx = x - x0, dy = y - y0, l = Math.hypot(dx, dy) || 1, qx = -dy / l, qy = dx / l;
        for (let w = 2; w <= 4; w++) {
          sk.dot(x + qx * w, y + qy * w, w > 3 ? M.gillTip : M.gill, 0.65, z + 1, true);
          sk.dot(x - qx * w, y - qy * w, w > 3 ? M.gillTip : M.gill, 0.5, z + 1, true);
        }
      }
    }
  };
  frill(false);
  // the throat pouch: when it gapes the floor of the mouth balloons into a pleated bag (the megamouth)
  if (P.jaw > 0.2) {
    sk.np();
    const k2 = (P.jaw - 0.2) / 0.8;
    const pc = L([30, 10 + 9 * k2 + P.throat * 1.2]);
    sk.ell(pc[0], pc[1], 30 + 4 * k2, 6 + 12 * k2 + P.throat * 1.5, (p: Px) => {
      // the pleats run lengthwise down the pouch, pale skin stretched pink between them
      const pl = Math.sin((p.v * 7 + p.u * 0.6) * Math.PI);
      if (pl > 0.82) { p.l -= 0.14; return M.fold; }
      if (pl < -0.7) p.l += 0.06;
      return p.v > 0.2 ? M.stretch : M.belly;
    }, { rot: ha + jawA * 0.85, rz: 10, z: 7.8 });
  }
  // the lower jaw
  sk.np();
  const lj = L([38, 9]);
  sk.ell(lj[0], lj[1], 38, 7.5 - P.jaw * 2, headFill, { rot: ha + jawA, rz: 9, z: 8 });
  if (P.jaw > 0.04) {
    // the mouth: from the hinge out to both lips: a pink cavern going dark down the throat
    sk.np();
    const pts: number[] = [];
    const up: V2[] = [], lo: V2[] = [];
    // the roof of the mouth arches up, the floor sags into the pouch
    for (let i = 0; i <= 12; i++) { const u = i / 12, x = 8 + u * 66; up.push(U([x, 4.5 - Math.sin(u * Math.PI) * 4 * P.jaw])); lo.push(L([x, 3.5 + Math.sin(Math.min(1, u * 1.15) * Math.PI) * 9 * P.jaw])); }
    for (const q of up) pts.push(q[0], q[1]);
    // the front of the gape bows back toward the hinge: the far lips meeting round the snout
    {
      const a = up[up.length - 1], b = lo[lo.length - 1];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = hinge[0] - mx, dy = hinge[1] - my, dl = Math.hypot(dx, dy) || 1;
      const c: V2 = [mx + (dx / dl) * 14 * P.jaw, my + (dy / dl) * 14 * P.jaw];
      for (let i = 1; i < 6; i++) { const u = i / 6, w = 1 - u; pts.push(w * w * a[0] + 2 * w * u * c[0] + u * u * b[0], w * w * a[1] + 2 * w * u * c[1] + u * u * b[1]); }
    }
    for (let i = lo.length - 1; i >= 0; i--) pts.push(lo[i][0], lo[i][1]);
    const hx = hinge[0], hy = hinge[1];
    sk.poly(pts, (p: Px) => {
      const d = Math.hypot(p.x - hx, p.y - hy);
      // the gullet, going dark; then the wet pink of the mouth, blotched and glistening
      if (d < 14 + P.throat * 1.5) { p.l -= 0.3; return M.throat; }
      if (d < 24 && noise2(p.x / 4, p.y / 4, 11) > 0.55) { p.l -= 0.12; return M.throat; }
      const wet = noise2((p.x + 77) / 6, (p.y + 77) / 4, 12);
      if (wet > 0.7) p.l += 0.14;
      else if (wet < 0.3) p.l -= 0.08;
      // the palate's folds, short and running back toward the gullet
      const a = Math.atan2(p.y - hy, p.x - hx);
      if (d > 30 && d < 58 && Math.sin(a * 46) > 0.88 && p.y < hy + (p.x - hx) * Math.tan(ha + skullA + 0.25)) p.l -= 0.1;
      return M.mouth;
    }, { z: 7 });
    // the stretched skin at the back of the gape, creased like a bellows
    const sp: number[] = [];
    const sU = U([10, 5]), sL = L([10, 4]);
    sp.push(hinge[0], hinge[1], sU[0], sU[1], sL[0], sL[1]);
    sk.poly(sp, (p: Px) => { if (Math.sin((p.x + p.y) * 1.3) > 0.7) p.l -= 0.1; return M.stretch; }, { z: 7.5 });
    // the tongue: a fat pale lump on the floor of the mouth
    sk.np();
    const tg = L([34, 0.5]);
    sk.ell(tg[0], tg[1], 13, 4 + P.throat * 0.6, M.tongue, { rot: ha + jawA, rz: 5, z: 9 });
    // tiny teeth, a fringe along both jaws
    for (let i = 0; i < 22; i++) {
      const x = 14 + i * 3;
      const a = U([x, 4.6]), b = L([x, 3.4]);
      sk.over(a[0], a[1] + 1, hex(i % 3 ? '#f4efe6' : '#d8d0c4'));
      sk.over(b[0], b[1] - 1, hex(i % 3 ? '#efe8de' : '#cfc6b8'));
    }
  }
  // the skull: flat as a spade, the snout rounded, the lip a dark line round the front
  sk.np();
  const sc = U([36, -3]);
  sk.ell(sc[0], sc[1], 41, 11.5 + P.cheek * 2, headFill, { rot: ha + skullA - 0.03, rz: 12, z: 12 });
  const sn = U([66, -1]);
  sk.ell(sn[0], sn[1], 14, 8.5, headFill, { rot: ha + skullA + 0.12, rz: 9, z: 13 });
  if (P.cheek > 0.1) { sk.np(); const ck = L([30, 8]); sk.ell(ck[0], ck[1], 22, 6 + P.cheek * 6, headFill, { rot: ha, rz: 8, z: 14 }); }
  // the lip line and the ridges on top of the head
  for (let i = 0; i <= 40; i++) {
    const x = 6 + i * 1.85, q = U([x, 5 - Math.sin(i / 40 * Math.PI) * 1.4]);
    sk.over(q[0], q[1], hex('#4a4c5e'));
  }
  for (let i = 0; i < 9; i++) { const q = U([16 + i * 6, -11 - Math.sin(i * 1.3) * 0.8]); sk.over(q[0], q[1], hex('#9aa4b4')); }
  // two pinprick milky eyes on top, two nostrils at the front
  const ey = U([50, -10.5]);
  sk.over(ey[0], ey[1], hex('#e6ecf2')); sk.over(ey[0] + 1, ey[1], hex('#7c8698')); sk.over(ey[0], ey[1] + 1, hex('#5a6274'));
  const ns = U([75, -4]);
  sk.over(ns[0], ns[1], hex('#3a3c4a')); sk.over(ns[0] - 3, ns[1] - 1, hex('#3a3c4a'));
  frill(true);
  leg(30, true, true);
  leg(-28, true, false);
  // water streaming off the head and back as it comes up
  if (P.drip) for (let i = 0; i < 14; i++) {
    const x = -20 + hh(i, frame, 3) * 90, top = tilt([x, BY - 16]);
    for (let s = 0; s < 2 + hh(i, 2, 4) * 4; s++) sk.over(top[0] + (i % 2), top[1] + 2 + s * 2 + frame, hex(s === 0 ? '#e8f4fa' : '#9cc0d0'));
  }
  return { head: U([40, -16]), eye: ey };
}
export const GULPER: SpeciesDef = {
  name: 'Ghost Gulper', kind: 'amphibian', len: 290, height: 64,
  anims: GANIMS,
  canvas: () => ({ w: 360, h: 220, ox: 196, oy: 150 }),
  draw: gdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

// ================================================================== the Cave Wētā
const WANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  jump: { frames: 4, fps: 9, loop: false },
  windup: { frames: 2, fps: 6, loop: true },
  feed: { frames: 2, fps: 4, loop: true },
};
function wdraw(sk: Sk, anim: string, frame: number, _e: unknown, juv: boolean) {
  const k = juv ? 0.7 : 1;
  const t = frame / (WANIMS[anim as keyof typeof WANIMS]?.frames ?? 1), ph = t * TAU;
  const crouch = anim === 'windup' ? 1 : anim === 'jump' ? [1, 0, 0, 0.6][frame] : 0;
  const air = anim === 'jump' ? [0, 1, 1, 0][frame] : 0;
  const M = {
    amber: sk.m(rmp('#a8743a', { n: 6, dark: 0.6, light: 0.5, warm: 0.4 }), { spec: 0.45, edge: 1 }),
    band: sk.m(rmp('#4e2e16', { n: 5, dark: 0.55, light: 0.35 }), { spec: 0.4, edge: 1 }),
    pale: sk.m(rmp('#d8b07a', { n: 5, dark: 0.45, light: 0.5 }), { spec: 0.3, edge: 1 }),
    leg: sk.m(rmp('#8a5a2c', { n: 5, dark: 0.55, light: 0.45 }), { spec: 0.3, edge: 1 }),
  };
  const lift = air * 6 - crouch * 1.2;
  const by = (-4.2 + crouch * 1.5 - lift) * k;
  // the hind legs: the great drumstick femur up over the back, the long shin down behind
  const hind = (near: boolean) => {
    sk.np();
    const z = near ? 6 : -6, bias = near ? 0 : -0.2;
    const hip: V2 = [-3 * k, by + 0.5 * k];
    const knee: V2 = air ? [-9 * k, by - 1 * k] : [(-6 - crouch * 1.5) * k, by - (6 + crouch * 2) * k];
    const foot: V2 = air ? [-17 * k, by + 1 * k] : [(-12 + crouch * 2) * k, 0];
    sk.tube([hip, [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 - 0.6 * k], knee], u => (2.3 - u * 1.5) * k, (p: Px) => (p.t > 0.55 && p.t < 0.7 ? M.band : p.v < -0.3 ? M.pale : M.amber), { z, bias });
    sk.tube([knee, foot], u => (0.75 - u * 0.2) * k, M.leg, { z: z + 0.5, bias });
    // the spines down the shin
    for (let i = 1; i < 6; i++) { const q = [knee[0] + (foot[0] - knee[0]) * i / 6, knee[1] + (foot[1] - knee[1]) * i / 6]; sk.over(q[0] - 1, q[1] - 0.4, hex('#2a160a')); }
    sk.over(foot[0] - 1, foot[1], hex('#6a4220')); sk.over(foot[0] + 1, foot[1], hex('#6a4220'));
  };
  const small = (x: number, near: boolean, ph2: number) => {
    sk.np();
    const z = near ? 5 : -5;
    const step = anim === 'walk' ? Math.sin(ph + ph2) * 1.6 : 0;
    const a: V2 = [x * k, by + 1 * k], kn: V2 = [(x + 1.6 + step * 0.5) * k, by - 1.4 * k], f: V2 = air ? [(x + 3) * k, by + 3 * k] : [(x + 2.6 + step) * k, 0];
    sk.tube([a, kn], 0.55 * k, M.leg, { z });
    sk.tube([kn, f], 0.45 * k, M.leg, { z });
  };
  hind(false); small(1.5, false, 1); small(3.6, false, 2.5);
  // the body: a humped arch of banded segments, pale beneath
  for (let i = 0; i < 5; i++) {
    sk.np();
    const x = (-5 + i * 2.1) * k, y = by - (Math.sin((i + 0.5) / 5 * Math.PI) * 1.8) * k;
    sk.ell(x, y, 1.9 * k, (2.6 - i * 0.12) * k, (p: Px) => (p.v > 0.45 ? M.pale : p.u < -0.55 ? M.band : M.amber), { z: i * 0.3, rz: 2 * k });
  }
  // the head, tucked down, small dark eyes, the palps
  sk.np();
  const hx = 6.2 * k, hy = by + 0.2 * k;
  sk.ell(hx, hy, 1.9 * k, 2.1 * k, M.amber, { z: 2, rot: 0.4 });
  sk.over(hx + 0.4 * k, hy - 0.8 * k, hex('#140a04'));
  sk.over(hx + 1.2 * k, hy + 1.8 * k, hex('#6a4220'));
  // the antennae: three times the body, always feeling the air
  for (const [s, l] of [[0, 1], [1, 0.85]] as const) {
    const sway = anim === 'windup' ? 0.2 : Math.sin(ph + s * 1.7) * 0.25;
    const a0 = (anim === 'windup' ? -0.5 : -1.1) + s * 0.25 + sway;
    let x = hx + 1.4 * k, y = hy - 1.2 * k, a = a0;
    for (let i = 0; i < 30 * l * k; i++) {
      a += 0.035 + Math.sin(i * 0.2 + ph) * 0.01;
      x += Math.cos(a); y += Math.sin(a) * 0.9;
      sk.over(x, y, hex(i % 5 === 0 ? '#5a3a1e' : '#8a6038'));
    }
  }
  small(2.8, true, 0); small(0.6, true, 3);
  hind(true);
  return { head: [hx, hy - 3 * k] as V2, eye: [hx + 0.4 * k, hy - 0.8 * k] as V2 };
}
export const CAVEWETA: SpeciesDef = {
  name: 'Cave Wētā', kind: 'insect', len: 14, height: 7,
  anims: WANIMS,
  canvas: () => ({ w: 72, h: 44, ox: 28, oy: 34 }),
  draw: wdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

// ================================================================== the Cave Harvestman
const HANIMS = {
  idle: { frames: 2, fps: 1.5, loop: true },
  walk: { frames: 4, fps: 6, loop: true },
  bob: { frames: 4, fps: 16, loop: true },
};
function hdraw(sk: Sk, anim: string, frame: number) {
  const ph = (frame / (HANIMS[anim as keyof typeof HANIMS]?.frames ?? 1)) * TAU;
  const bob = anim === 'bob' ? Math.sin(ph) * 3 : anim === 'idle' ? frame * 0.5 : 0;
  const M = {
    body: sk.m(rmp('#8a6434', { n: 5, dark: 0.55, light: 0.5, warm: 0.4 }), { spec: 0.5, edge: 1 }),
    saddle: sk.m(rmp('#3e2410', { n: 4, dark: 0.5, light: 0.3 }), { spec: 0.5, edge: 1 }),
    leg: sk.m(rmp('#4a3018', { n: 4, dark: 0.5, light: 0.4 }), { edge: 0 }),
  };
  const by = -9 + bob;
  // eight legs: four each side, knees high, feet splayed far out
  const legs = (near: boolean) => {
    for (let i = 0; i < 4; i++) {
      sk.np();
      const z = near ? 4 : -4, l = near ? 0.55 : 0.32;
      const spread = [-18, -9, 8, 19][i] + (near ? 0 : (i < 2 ? 2 : -2));
      const step = anim === 'walk' ? Math.sin(ph + i * 1.6 + (near ? 0 : Math.PI)) * 2.5 : 0;
      const foot: V2 = [spread + step, 0], knee: V2 = [spread * 0.42 + step * 0.4, by - 9 - Math.abs(spread) * 0.12];
      const c = hex(near ? '#5a3c20' : '#3a2412');
      sk.overLine(0, by, knee[0], knee[1], c);
      sk.overLine(knee[0], knee[1], foot[0], foot[1], c);
      sk.over(knee[0], knee[1], hex(near ? '#c09a68' : '#8a6a42'));
      void z; void l;
    }
  };
  legs(false);
  sk.np();
  sk.ell(0, by, 2.8, 2.1, (p: Px) => (p.v < -0.1 && Math.abs(p.u) < 0.6 ? M.saddle : M.body), { z: 2, rz: 2 });
  sk.over(0.6, by - 2.4, hex('#1a0e06'));
  sk.over(1.6, by - 2.2, hex('#c8a070'));
  legs(true);
  return { head: [1, by - 4] as V2, eye: [0.6, by - 2.4] as V2 };
}
export const HARVESTMAN: SpeciesDef = {
  name: 'Cave Harvestman', kind: 'other', len: 6, height: 12,
  anims: HANIMS,
  canvas: () => ({ w: 56, h: 32, ox: 28, oy: 30 }),
  draw: hdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

// ================================================================== the Cave Centipede
const CANIMS = {
  idle: { frames: 2, fps: 2, loop: true },
  walk: { frames: 4, fps: 10, loop: true },
  rear: { frames: 3, fps: 6, loop: true },
  strike: { frames: 3, fps: 12, loop: false },
};
function cdraw(sk: Sk, anim: string, frame: number) {
  const ph = (frame / (CANIMS[anim as keyof typeof CANIMS]?.frames ?? 1)) * TAU;
  const rear = anim === 'rear' ? 1 : anim === 'strike' ? [1, 0.5, 0.2][frame] : 0;
  const lunge = anim === 'strike' ? [0, 5, 2][frame] : 0;
  const M = {
    body: sk.m(rmp('#c08a40', { n: 6, dark: 0.6, light: 0.5, warm: 0.5 }), { spec: 0.55, edge: 1 }),
    band: sk.m(rmp('#5a2e12', { n: 5, dark: 0.5, light: 0.35 }), { spec: 0.5, edge: 1 }),
    leg: sk.m(rmp('#e0b070', { n: 4, dark: 0.45, light: 0.45 }), { edge: 0 }),
    claw: sk.m(rmp('#2e140a', { n: 4, dark: 0.4, light: 0.5 }), { spec: 0.7, edge: 0 }),
  };
  const N = 18;
  const seg: V2[] = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    // head first (+x), the front third raised in the threat
    const raise = rear * Math.max(0, 1 - u * 3) * 12;
    seg.push([20 + lunge - u * 44, -2.4 - raise + Math.sin(ph * (anim === 'walk' ? 1 : 0.5) + u * 6) * 0.5]);
  }
  // legs: a pair per segment, in a wave down the body
  const legs = (near: boolean) => {
    sk.np();
    for (let i = 1; i < N - 1; i++) {
      const [x, y] = seg[i];
      const w = anim === 'walk' ? Math.sin(ph - i * 0.9) * 2 : 0;
      const up = y < -6;
      const fx = x + w + (near ? 0.5 : -0.5), fy = up ? y + 4 : 0;
      sk.overLine(x, y + 1.6, fx + (near ? 1.4 : -0.6), fy, hex(near ? '#e8b878' : '#8a6030'));
    }
  };
  legs(false);
  for (let i = N - 1; i >= 0; i--) {
    sk.np();
    const [x, y] = seg[i];
    const r = i === 0 ? 1.9 : 1.7 - (i > N - 4 ? (i - (N - 4)) * 0.3 : 0);
    sk.ell(x, y, 1.8, r, (p: Px) => (p.u < -0.5 ? M.band : M.body), { z: N - i, rz: 1.8 });
  }
  // the last legs trail long behind; the feelers out in front; the venom claws under the head
  const [tx, ty] = seg[N - 1];
  sk.overLine(tx - 1, ty, tx - 9, ty - 2, hex('#d8a868')); sk.overLine(tx - 1, ty + 1, tx - 8, ty + 2, hex('#a07038'));
  const [hx, hy] = seg[0];
  for (const s of [0, 1]) {
    let x = hx + 1, y = hy - 1, a = -0.5 - s * 0.3 + Math.sin(ph + s) * 0.15 - rear * 0.5;
    for (let i = 0; i < 16; i++) { a += 0.05; x += Math.cos(a); y += Math.sin(a) * 0.8; sk.over(x, y, hex(i % 4 === 0 ? '#7a4a20' : '#d8a060')); }
  }
  const open = rear * 1.2;
  sk.over(hx + 2, hy + 1, hex('#2e140a')); sk.over(hx + 3, hy + 1 + open, hex('#2e140a')); sk.over(hx + 3.5, hy + open * 0.5, hex('#c03a20'));
  sk.over(hx + 1.5, hy + 2, hex('#2e140a')); sk.over(hx + 2.5, hy + 2.5 + open, hex('#2e140a'));
  legs(true);
  void M.claw;
  return { head: [hx, hy - 3] as V2, eye: [hx + 0.5, hy - 0.8] as V2 };
}
export const CENTIPEDE: SpeciesDef = {
  name: 'Cave Centipede', kind: 'other', len: 46, height: 5,
  anims: CANIMS,
  canvas: () => ({ w: 80, h: 34, ox: 40, oy: 26 }),
  draw: cdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};
