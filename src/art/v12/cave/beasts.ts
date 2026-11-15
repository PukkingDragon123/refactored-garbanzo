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

// ================================================================== the Blind Salamander and the Ghost Gulper
// (sculpted from one continuous outline each, with their wrinkled, see-through skin: ./salamanders.ts)
export { BLINDSAL, GULPER } from './salamanders';

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
