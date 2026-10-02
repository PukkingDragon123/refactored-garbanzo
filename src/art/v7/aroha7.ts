// V7 Aroha: the island's young ranger (22), a Māori woman of the iwi who look after this place. Built to
// read apart from Jenna at a glance and to move like the fastest person on the beach.
//
//  silhouette  thick dark wavy hair pulled up into a big high bun, tied off with a flax tie, loose waves
//              falling at the temples and the nape; an athletic build (broader shoulders, strong legs,
//              a narrow waist), light on her feet
//  face        a defined jaw and high cheekbones, a firm chin, a broader nose, almond eyes with the outer
//              corner lifted, strong dark brows that do half the talking, a one-sided smirk
//  clothes     practical bush gear, not a costume: a fitted dark bush-green tank with a tāniko band
//              (red, black, white) across the chest, a pounamu hei matau on a flax cord, a woven
//              harakeke belt with her kete of stones on the hip and the slingshot tucked in at the back,
//              a red-and-black checked bush shirt knotted round her waist, canvas shorts with rolled
//              cuffs, paraerae (woven flax sandals) tied round the ankles, a leather bracer on the bow
//              arm and a tāniko band on the draw wrist
//  moves       alert and quick: an athletic stance on soft knees, a hand cocked on her hip, a stone
//              flipped and caught while she waits; a springy walk on the balls of her feet; a low,
//              driving sprint
//
// The rig picks this up through cast.ts / head.ts (AROHA7, AROHA_HEAD) and her own clips (registerOwn7).

import { hex, mix } from '../color';
import type { C } from '../color';
import { cel, Ramp6, Scene3D, V3, Hit, vadd, vsc, vsub, vnorm } from './raster';
import type { Char7, Part, J3 } from './body';
import type { HeadDef7, HeadExpr7, FaceMark } from './head';
import type { Build, Pose } from '../people-rig';
import { stand } from '../anime/anims';
import { registerOwn7, gait, gaitDist } from './anims7';
import type { Gait } from './anims7';
import { R6, PAL, GG, tEll, tLimb } from './gear';

const TAU = Math.PI * 2;
const L = (p: Part) => p.hit.l;
/** far limbs sit in the body's shadow */
const lb = (p: Part) => (p.near ? 0 : -0.28);
const frac = (v: number) => v - Math.floor(v);
const smooth = (u: number) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
/** 0 → 1 → 0 over [a, b] with eased ramps of width w */
const bump = (t: number, a: number, b: number, w: number) => smooth((t - a) / w) * (1 - smooth((t - (b - w)) / w));

// ------------------------------------------------------------------ palettes

/** warm brown skin with a red undertone */
export const AROHA_SKIN = R6('#2a140c', '#5a3020', '#7c482e', '#a0663e', '#bd8255', '#d79e70');
const HAIR = R6('#050203', '#110907', '#1d110c', '#2b1912', '#44281c', '#68412c');
export const AR = {
  /** the bush-green tank */
  top: R6('#070c0a', '#121e18', '#1d3026', '#2a4434', '#385a44', '#4c745a'),
  /** canvas shorts */
  shorts: R6('#141208', '#2b2716', '#433d26', '#5c5436', '#746a46', '#8e835a'),
  /** the checked bush shirt knotted round her waist */
  check: R6('#240604', '#4e100c', '#7a1c14', '#9c2a1e', '#bc3e2c', '#d85a44'),
  checkK: R6('#040303', '#0c0909', '#161011', '#20181a', '#2c2224', '#3a2e30'),
  flax: PAL.flax,
  leather: PAL.leather,
  wood: PAL.wood,
  pounamu: R6('#04120a', '#0a2a1a', '#14492e', '#217048', '#3a9864', '#86d2a4'),
  cord: R6('#120a06', '#26160c', '#3a2414', '#4e321c', '#644228', '#7c5636'),
};
const CREAM = R6('#5a5040', '#8a8068', '#b8ae92', '#efe4cc', '#fff6e0', '#ffffff');
export const TANIKO = { red: hex('#b4302a'), black: hex('#1c1216'), white: hex('#efe2c6') };

/**
 * A tāniko pattern: rows of red and black triangles (niho taniwha) between thin white rules.
 * u runs along the band (any scale, ~1 per tooth), v across it 0..1.
 */
export function taniko(u: number, v: number): C {
  if (v < 0.16 || v > 0.84) return TANIKO.white;
  const f = frac(u), w = (v - 0.16) / 0.68;
  // a row of triangles: black teeth pointing up into red
  const tooth = Math.abs(f - 0.5) * 2;
  return tooth < 1 - w ? TANIKO.black : TANIKO.red;
}

// ------------------------------------------------------------------ the body

const SK = AROHA_SKIN;
/** shoulder straps of the tank (lateral position at the top of the torso) */
const STRAP_Z = 2.6;

export const AROHA7: Char7 = {
  id: 'aroha',
  // an athlete's frame: shoulders broader than Jenna's, a narrow waist, long strong legs
  build: { hipH: 26.8, thigh: 12.7, shin: 12.4, ankleH: 2.1, torso: 18, neck: 1.35, shY: 2.3, shF: 0, shB: 0, upArm: 9.1, foreArm: 8.3, legF: 0, legB: 0 },
  shW: 5.0, hipW: 2.75, chest: [3.25, 4.25], waist: [2.4, 3.0], pelvis: [2.95, 3.6],
  armR: [1.85, 1.55, 1.22], legR: [2.4, 1.8, 1.32], neckR: 1.4, hand: 1.0,
  skin: SK, ink: hex('#120806'),
  torso(p) {
    const l = L(p);
    // the hei matau on its flax cord, over the sternum
    const pd = pendant(p);
    if (pd !== undefined) return pd;
    // bare shoulders and neck; the tank's straps over them
    if (p.hh > 0.82) {
      if (Math.abs(Math.abs(p.z) - STRAP_Z) < 0.72 && (p.f > -1.2 || p.hh < 0.93)) return cel(AR.top, l, 0.04);
      return cel(SK, l);
    }
    // a scoop neckline at the front
    if (p.f > 0.9 && p.hh > 0.72 + (Math.abs(p.z) / 2.4) ** 2 * 0.1 && Math.abs(p.z) < 2.0) return cel(SK, l, -0.04);
    // the tāniko band across the chest
    if (p.hh > 0.555 && p.hh < 0.705 && p.f > -2.6) return taniko(Math.atan2(p.z, p.f) * 3.2 + 20, (p.hh - 0.555) / 0.15);
    // the woven harakeke belt: a diagonal plait
    if (p.hh > 0.055 && p.hh < 0.165) return cel(AR.flax, l, frac((p.hit.x + p.hit.y * 0.5) / 2) < 0.5 ? 0.12 : -0.14);
    if (p.hh <= 0.055) return cel(AR.shorts, l);
    // a seam down the side, a darker hem above the belt
    if (p.hh < 0.2) return cel(AR.top, l, -0.22);
    return cel(AR.top, l);
  },
  upperArm(p) { return cel(SK, L(p), lb(p)); },
  foreArm(p) {
    const l = L(p);
    // the draw (near) wrist: a tāniko band; the bow (far) forearm: a laced leather bracer
    if (p.near && p.t > 0.8 && p.t < 0.95) return taniko(p.hit.q[1] * 1.6 + 20, (p.t - 0.8) / 0.15);
    if (!p.near && p.t > 0.42 && p.t < 0.92) {
      if (p.t < 0.47 || p.t > 0.87) return cel(AR.leather, l, lb(p) - 0.3);
      const lace = Math.abs(frac(p.t * 7) - 0.5) < 0.16 && Math.abs(Math.sin(p.hit.q[1])) < 0.5;
      return lace ? cel(AR.flax, l, lb(p)) : cel(AR.leather, l, lb(p) + 0.05);
    }
    return cel(SK, l, lb(p));
  },
  hands(p) { return cel(SK, L(p), lb(p) + 0.08); },
  thigh(p) {
    const l = L(p);
    // canvas shorts to mid thigh, the cuffs rolled once
    if (p.t < 0.34) return cel(AR.shorts, l, lb(p));
    if (p.t < 0.44) return cel(AR.shorts, l, lb(p) + (p.t > 0.4 ? -0.32 : 0.12));
    return cel(SK, l, lb(p));
  },
  shin(p) {
    const l = L(p);
    // the paraerae ties crossing round the ankle
    if (p.t > 0.84) {
      const x = (p.hit.q[1] / Math.PI) * 3 + p.t * 9;
      return Math.abs(frac(x) - 0.5) < 0.2 || Math.abs(frac(x - p.t * 18) - 0.5) < 0.2 ? cel(AR.flax, l, lb(p)) : cel(SK, l, lb(p));
    }
    return cel(SK, l, lb(p));
  },
  shoe(p) {
    const l = L(p);
    // paraerae: a plaited flax sole, a strap over the toes and one over the instep
    if (p.hit.q[1] < -0.3) return cel(AR.flax, l, lb(p) - 0.2);
    const q = p.hit.q[0];
    if (Math.abs(q - 0.45) < 0.16 || Math.abs(q + 0.15) < 0.16) return cel(AR.flax, l, lb(p) + 0.1);
    return cel(SK, l, lb(p) + 0.05);
  },
  extras(s, J, P, ch) { arohaGear(s, J, P, ch, true); },
};

/** the hei matau: a small greenstone hook on a flax cord at the sternum (torso material) */
function pendant(p: Part): C | undefined {
  if (p.f < 2.0) return undefined;
  // the cord: two lines from the sides of the neck down to the hook
  const cy = 0.92 - Math.abs(p.z) * 0.07;
  if (p.hh > 0.74 && Math.abs(p.hh - cy) < 0.022 && Math.abs(p.z) < 1.9) return cel(AR.cord, L(p), 0);
  // the hook: a green curl just under the cord's low point
  const x = p.z, y = (p.hh - 0.765) * 18;
  if (Math.abs(x) < 0.85 && y > -1.6 && y < 0.6) {
    const ring = Math.abs(Math.hypot(x * 1.2, y + 0.4) - 0.7) < 0.42;
    if (ring || (x > 0.2 && y > -0.2)) return cel(AR.pounamu, L(p), 0.3, true);
  }
  return undefined;
}

/**
 * Her kit, on any outfit: the kete of stones on the near hip, its flax strap, the slingshot tucked
 * into the back of the belt (unless it's in her hand: pose flag `sl`), the bush shirt's knotted sleeves
 * at the front (casual only).
 */
export function arohaGear(s: Scene3D, J: J3, P: Pose, c: Char7, knot = false) {
  const T = c.build.torso, fl = P.flags ?? {};
  // the kete: a small woven flax bag on the near hip, a plaited flap
  tEll(s, J, [T * 0.03, 0.8, c.hipW + 1.9], [1.25, 2.1, 1.3], GG.bag, h => {
    const w = ((Math.floor(h.x) + Math.floor(h.y)) & 1) === 0;
    if (h.q[1] > 0.55) return cel(AR.flax, h.l, -0.3);
    return cel(AR.flax, h.l, w ? 0.14 : -0.1);
  });
  // its handle loop up to the belt
  tLimb(s, J, [T * 0.03 + 1.9, 0.9, c.hipW + 1.4], [T * 0.12, 0.4, c.hipW + 0.6], 0.32, 0.3, GG.strap, h => cel(AR.flax, h.l, 0.05));
  if (!fl.sl) {
    // the slingshot tucked into the back of the belt: the handle down, the fork up behind her
    const base: V3 = [T * 0.13, -c.waist[0] - 0.55, -0.4];
    const wood = (h: Hit) => cel(AR.wood, h.l, 0.06);
    tLimb(s, J, [base[0] - 2.2, base[1] + 0.1, base[2]], base, 0.42, 0.42, GG.tool, wood);
    tLimb(s, J, base, [base[0] + 1.6, base[1] - 0.15, base[2]], 0.44, 0.4, GG.tool, wood);
    for (const z of [-1, 1]) tLimb(s, J, [base[0] + 1.6, base[1] - 0.15, base[2]], [base[0] + 3.6, base[1] - 0.5, base[2] + z * 1.15], 0.36, 0.3, GG.tool, wood);
    // the band, wound round the fork
    tLimb(s, J, [base[0] + 3.4, base[1] - 0.45, base[2] - 1.05], [base[0] + 3.4, base[1] - 0.45, base[2] + 1.05], 0.3, 0.3, GG.tool, h => cel(R6('#200806', '#3a100c', '#561c14', '#6e2a1e', '#8a3a2a', '#a64e38'), h.l, 0));
  }
  if (knot) {
    // the checked bush shirt knotted round her waist: the body of it hangs down behind her hips (and
    // swings out behind when she moves), the sleeves wrap round to a knot at the front, cuffs hanging
    const chk = (h: Hit) => {
      // red flannel with a black check: dark stripes one way, darker red the other, black where they cross
      const lx = (h.x % 3) === 0, ly = (h.y % 3) === 0;
      return lx && ly ? cel(AR.checkK, h.l, 0.1) : lx ? cel(AR.checkK, h.l, 0.55) : ly ? cel(AR.check, h.l, -0.4) : cel(AR.check, h.l, 0.12);
    };
    const sw = Math.max(0, Math.min(1.6, P.sway ?? 0)) * 0.32, ca = Math.cos(sw), sa = Math.sin(sw);
    const H = 4.6, top = J.T(T * 0.06, -c.pelvis[0] - 0.55, 0);
    const up = vnorm(vadd(vsc(J.up, ca), vsc(J.fwd, sa))), fw = vnorm(vsub(vsc(J.fwd, ca), vsc(J.up, sa)));
    s.ellipsoid(vadd(top, vsc(up, -H)), vsc(fw, 0.95), vsc(up, H), vsc(J.lat, c.hipW + 2.3), GG.roll, h => (h.q[1] < -0.86 ? cel(AR.check, h.l, -0.35) : chk(h)));
    const kn: V3 = [T * 0.13, c.waist[0] + 0.45, 1.5];
    // the sleeves wrap from the back round each hip to the knot
    for (const z of [1, -1]) {
      const back: V3 = [T * 0.11, -c.waist[0] - 0.3, z * (c.waist[1] + 0.3)], side: V3 = [T * 0.12, 0.7, z * (c.pelvis[1] + 0.7)];
      tLimb(s, J, back, side, 0.7, 0.7, GG.clip, chk);
      tLimb(s, J, side, [kn[0], kn[1] - 0.2, kn[2] + z * 0.35], 0.7, 0.64, GG.clip, chk);
    }
    tEll(s, J, kn, [0.85, 0.85, 0.95], GG.clip, chk);
    // the cuffs hanging from the knot down the near hip
    tLimb(s, J, [kn[0] - 0.4, kn[1] - 0.1, kn[2] + 0.2], [kn[0] - 3.6, kn[1] - 0.2, kn[2] + 1.2], 0.6, 0.5, GG.clip, chk);
    tLimb(s, J, [kn[0] - 0.4, kn[1] + 0.1, kn[2] - 0.3], [kn[0] - 3.0, kn[1] + 0.3, kn[2] - 0.2], 0.58, 0.48, GG.clip, chk);
  }
}

/** her everyday clothes from Day 2 on (the 'ship' wardrobe slot): a deep teal tank with a koru, the same kit */
export function arohaDayBody(b: Char7): Char7 {
  const teal = R6('#040e10', '#0a1e22', '#123238', '#1c4a50', '#2a6268', '#3e8086');
  const koru = (z: number, hh: number) => {
    const x = z + 0.5, y = (hh - 0.5) * 18;
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    return r < 2.3 && Math.abs(frac((r - a * 0.36) / 1.15) - 0.5) < 0.17;
  };
  return {
    ...b,
    torso(p) {
      const l = L(p);
      const pd = pendant(p);
      if (pd !== undefined) return pd;
      if (p.hh > 0.82) {
        if (Math.abs(Math.abs(p.z) - STRAP_Z) < 0.72 && (p.f > -1.2 || p.hh < 0.93)) return cel(teal, l, 0.04);
        return cel(SK, l);
      }
      if (p.f > 0.9 && p.hh > 0.72 + (Math.abs(p.z) / 2.4) ** 2 * 0.1 && Math.abs(p.z) < 2.0) return cel(SK, l, -0.04);
      if (p.hh > 0.055 && p.hh < 0.165) return cel(AR.flax, l, frac((p.hit.x + p.hit.y * 0.5) / 2) < 0.5 ? 0.12 : -0.14);
      if (p.hh <= 0.055) return cel(AR.shorts, l);
      if (p.f > 1.4 && koru(p.z, p.hh)) return cel(CREAM, l, 0.1);
      // a thin tāniko trim at the hem
      if (p.hh < 0.21) return taniko(Math.atan2(p.z, p.f) * 3.2 + 20, (p.hh - 0.165) / 0.045);
      return cel(teal, l);
    },
    skirt: undefined,
    extras(s, J, P, ch) { arohaGear(s, J, P, ch, false); },
  };
}

// ------------------------------------------------------------------ the head

const AROHA_HEAD: HeadDef7 = {
  skin: SK,
  hair: HAIR,
  ink: hex('#120806'),
  // a defined jaw and a firm chin under high cheekbones (see extras)
  skull: [[0.1, 7.95, 0], [4.7, 5.4, 4.15]],
  jaw: [[1.7, 4.25, 0], [3.4, 3.15, 3.05]],
  chin: [[3.75, 2.35, 0], [1.35, 1.2, 1.45]],
  nose: [[4.95, 5.75, 0], [0.88, 0.85, 0.74]],
  ear: [[-0.4, 6.3, 4.1], [0.9, 1.35, 0.6]],
  eye: [4.05, 6.95, 2.25],
  mouth: [4.45, 3.9, 0.3],
  eyeCol: '#110705', brow: '#0e0604', blush: '#c46450',
  // the hair slicked back off the face, close to the skull, up into the bun
  shell: [[-0.65, 8.7, 0], [5.15, 5.65, 4.72]],
  cut: q => q[0] > 0.3 && q[1] < 0.46,
  locks: [
    // swept back from the hairline over the crown toward the bun (ridges in the slicked-back hair)
    { a: [3.6, 12.3, 1.9], b: [-1.6, 13.4, 1.1], r0: 1.2, r1: 0.9 },
    { a: [3.8, 12.7, -0.2], b: [-1.5, 13.7, 0.0], r0: 1.25, r1: 0.95 },
    { a: [3.4, 12.1, -2.1], b: [-1.6, 13.3, -1.2], r0: 1.15, r1: 0.9 },
    // over the ears, back to the nape
    { a: [2.2, 10.8, 4.0], b: [-3.2, 9.4, 3.2], r0: 1.15, r1: 0.9 },
    { a: [2.2, 10.8, -4.0], b: [-3.2, 9.4, -3.2], r0: 1.15, r1: 0.9 },
    // loose waves at the temples, falling past the cheek to the jaw (kept under a hood)
    { a: [2.9, 11.3, 4.05], b: [3.35, 7.6, 4.75], r0: 0.85, r1: 0.62, sway: 0.25 },
    { a: [3.35, 7.6, 4.75], b: [2.7, 3.8, 4.55], r0: 0.62, r1: 0.3, sway: 0.5 },
    { a: [2.9, 11.3, -4.05], b: [3.3, 7.8, -4.7], r0: 0.85, r1: 0.62, sway: 0.25 },
    { a: [3.3, 7.8, -4.7], b: [2.6, 4.3, -4.45], r0: 0.62, r1: 0.3, sway: 0.5 },
    // wisps escaping at the nape
    { a: [-3.9, 7.6, 1.8], b: [-4.9, 3.4, 2.5], r0: 0.85, r1: 0.25, sway: 1 },
    { a: [-4.1, 7.8, -1.2], b: [-5.4, 4.0, -1.8], r0: 0.85, r1: 0.25, sway: 1 },
  ],
  browHidden: false,
  extras(s, W, o) {
    const hairM = (h: Hit) => cel(HAIR, h.l, h.n[1] > 0.35 && h.n[1] < 0.72 && h.l > 0.45 ? 0.45 : 0.05);
    const sw = o.hair ?? 0;
    // the bun: big and round, high on the crown and a little behind, the waves wound round it
    const bc: V3 = [-2.4 - sw * 0.3, 16.5, 0];
    s.ellipsoid(W(bc), W([3.4, 0, 0]), W([0, 3.05, 0]), W([0, 0, 3.3]), 3, h => {
      // spiralling strands round the bun, a sheen on its crown
      const a = Math.atan2(h.q[2], h.q[0]) + h.q[1] * 2.4;
      if (Math.abs(frac(a / 1.25) - 0.5) < 0.13) return cel(HAIR, h.l, -0.3);
      return cel(HAIR, h.l, h.q[1] > 0.25 && h.q[1] < 0.7 && h.l > 0.3 ? 0.5 : 0.05);
    });
    // the flax tie round its base
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI + (i / 16) * TAU;
      const p: V3 = [bc[0] + Math.cos(a) * 2.5, bc[1] - 2.2 - Math.cos(a) * 0.15, Math.sin(a) * 2.45];
      s.ellipsoid(W(p), W([0.66, 0, 0]), W([0, 0.62, 0]), W([0, 0, 0.66]), 9, h => cel(AR.flax, h.l, (i & 1) ? 0.25 : 0));
    }
    // a loose wave escaping the bun at the back, trailing when she moves fast
    s.limb(W([bc[0] - 2.5, bc[1] - 0.8, 1.2]), W([bc[0] - 4.6 - sw * 1.6, bc[1] - 3.4 + sw * 0.6, 2.0]), 0.75, 0.24, 3, hairM);
    s.limb(W([bc[0] - 2.7, bc[1] - 0.2, -1.0]), W([bc[0] - 4.4 - sw * 1.4, bc[1] - 3.9 + sw * 0.5, -1.7]), 0.7, 0.22, 3, hairM);
    // the hair gathered up the back of the head into the tie
    s.limb(W([-4.3, 10.6, 0]), W([bc[0] + 0.1, bc[1] - 2.4, 0]), 1.9, 1.3, 3, hairM);
    // high cheekbones: catch the light just under the eyes (the face group, so no line round them)
    for (const z of [-1, 1]) s.ellipsoid(W([2.85, 5.85, z * 2.85]), W([1.25, 0, 0]), W([0, 0.95, 0]), W([0, 0, 1.05]), 1, h => cel(SK, h.l, 0.3));
  },
  eyePaint: arohaEye,
  mouthPaint: arohaMouth,
};
export { AROHA_HEAD };

/**
 * Almond eyes with the outer corner lifted (a lash flick up and out), strong three-pixel brows that
 * angle hard with the mood; a cocky expression cocks the far brow.
 */
function arohaEye(mark: FaceMark, x: number, y: number, inner: 1 | -1, far: boolean, eye: HeadExpr7['eye'], ex: HeadExpr7, d: HeadDef7) {
  const o = -inner as 1 | -1;
  const eyeC = hex(d.eyeCol), browC = hex(d.brow), lash = mix(eyeC, d.skin[1], 0.25);
  const lid = mix(d.skin[1], eyeC, 0.45);
  switch (eye) {
    case 'closed': mark(x, y, lid); mark(x + o, y, lid); break;
    case 'happy': mark(x, y - 1, eyeC); mark(x + o, y, lid); mark(x + inner, y, lid); break;
    case 'wide': mark(x, y, eyeC); mark(x, y - 1, eyeC); break;
    case 'sad': mark(x, y, eyeC); mark(x + o, y + 1, lid); break;
    case 'half': mark(x, y, eyeC); mark(x + o, y, lid); break;
    default:
      // the almond: the iris and the outer corner, lifted a touch in a glare
      mark(x, y, eyeC); mark(x + o, y - (eye === 'angry' ? 1 : 0), lash);
  }
  // brows: a strong, dark two-pixel stroke a row above the eye; angry adds a third pixel down to the
  // nose, worry lifts the inner end, surprise lifts it all; a cocky expression cocks the far brow
  const t = ex.browTilt, up = ex.brow > 1 ? 1 : 0;
  const cocky = far && ex.brow === 1 && ex.browTilt === -1 && ex.mouth === 'smile' ? 1 : 0;
  const by = y - 2 - up - cocky;
  if (t < 0) { mark(x + inner, by + 1, browC); mark(x, by, browC); mark(x + o, by - (cocky ? 0 : 0), mix(browC, d.skin[2], 0.3)); }
  else if (t > 0) { mark(x + inner, by - 1, browC); mark(x, by, browC); }
  else { mark(x + inner, by, browC); mark(x, by, browC); }
  if (ex.blush) mark(x, y + 2, mix(hex(d.blush), d.skin[3], 0.25));
}

/** fuller lips; her smile pulls up on one side (a smirk) */
function arohaMouth(mark: FaceMark, mx: number, my: number, mouth: HeadExpr7['mouth'], _ex: HeadExpr7, d: HeadDef7) {
  const lip = mix(d.skin[1], hex('#5e1a18'), 0.45), dark = hex('#3a0c10'), soft = mix(d.skin[2], hex('#7a3028'), 0.35);
  switch (mouth) {
    case 'smile': mark(mx, my, lip); mark(mx - 1, my, soft); mark(mx + 1, my - 1, lip); break;
    case 'frown': mark(mx, my, lip); mark(mx - 1, my + 1, lip); break;
    case 'open': case 'o': mark(mx, my, dark); mark(mx, my + 1, soft); break;
    case 'grit': mark(mx, my, dark); mark(mx - 1, my, dark); mark(mx + 1, my - 1, lip); break;
    case 'shout': mark(mx, my, dark); mark(mx, my + 1, dark); mark(mx - 1, my, dark); break;
    default: mark(mx, my, soft);
  }
}

// ------------------------------------------------------------------ her own idle, walk and run

const K = (b: Build) => b.torso / 15;

/**
 * Waiting, Aroha style: an athletic stance on soft knees, weight rolling between the feet, a hand cocked
 * on her hip and her eyes on the tree line; every few seconds she flips a stone up, glances up at it,
 * and snatches it out of the air (flags.ts: the stone's height over her hand).
 */
function idle(b: Build, t: number): Pose {
  const k = K(b);
  const br = Math.sin(TAU * t * 2), sh = Math.sin(TAU * t + 0.6);
  const p = stand(b);
  // the toss: dip, flick up, the stone in the air, the catch (the hand gives with it), back to the hip
  const toss = bump(t, 0.5, 0.86, 0.07);
  const flick = bump(t, 0.56, 0.64, 0.03), catchK = bump(t, 0.7, 0.78, 0.025);
  const fl = t > 0.6 && t < 0.72 ? Math.sin(Math.PI * (t - 0.6) / 0.12) : 0;
  p.hip = [0.55 * k * sh, b.hipH - 0.9 * k - Math.max(0, -br) * 0.3 * k - catchK * 0.35 * k];
  p.lean = 0.05 + br * 0.01 + toss * 0.03;
  p.sq = 1 + br * 0.016;
  // feet apart and ready, the back heel just off the ground
  p.fl = { f: [-2.9 * k, b.ankleH + 0.3 * k * Math.max(0, sh)], fa: -0.12 * Math.max(0, sh) };
  p.bl = { f: [2.9 * k, b.ankleH], fa: 0.04 };
  const hip = p.hip;
  // the near hand on her hip (elbow out), or out in front for the toss
  const onHip: [number, number] = [hip[0] + 0.5 * k, hip[1] + 2.4 * k];
  const tossAt: [number, number] = [hip[0] + 4.6 * k, hip[1] + 5.6 * k + flick * 1.6 * k - catchK * 1.4 * k];
  const u = smooth(toss * 1.25);
  p.fa = { ik: [onHip[0] + (tossAt[0] - onHip[0]) * u, onHip[1] + (tossAt[1] - onHip[1]) * u], hand: toss > 0.4 ? (flick > 0.3 ? 'open' : 'grip') : 'fist' };
  // the far arm loose, a little sway
  p.ba = { a: -0.06 + sh * 0.04, e: 0.32 + br * 0.04, hand: 'relax' };
  p.flags = { aoN: 2.5 * (1 - u), sx: 0.55 * k * sh, ts: toss > 0.35 ? fl * 9 * k : -1 };
  // eyes on the tree line; a glance up at the stone at the top of its flight; a cocky tilt after the catch
  p.look = fl > 0.45 ? 'up' : 'fwd';
  p.hd = [0.25 * k + catchK * 0.3 * k, -0.15 * k * catchK];
  p.sway = 0.25 + 0.15 * br;
  return p;
}

/** a light, springy walk on the balls of her feet: quick, a forward lean, compact arm swing */
const WALK_G = (b: Build): Gait => ({ stride: b.thigh * 1.42, stance: 0.55, lift: 2.7 * K(b), bob: 0.95 * K(b), lean: 0.07, swing: 0.3, elbow: 0.48, elbowSwing: 0.32, drop: 0.6 * K(b), kick: 0.7, flight: 0, hand: 'relax', sway: 0.3 * K(b), roll: 0.025, armOut: 0.5 });
/** the sprint: low and driving, long strides, knife hands pumping, a big flight phase */
const RUN_G = (b: Build): Gait => ({ stride: b.thigh * 2.55, stance: 0.3, lift: 7.2 * K(b), bob: 1.25 * K(b), lean: 0.38, swing: 0.92, elbow: 1.6, elbowSwing: 0.24, drop: 1.7 * K(b), kick: 1.25, flight: 1.5 * K(b), hand: 'flat', sway: 0.12 * K(b), armOut: 0.35 });

function walk(b: Build, t: number): Pose {
  const p = gait(b, t, WALK_G(b));
  // up on her toes through the push-off
  p.fl.fa = (p.fl.fa ?? 0) - 0.12;
  p.bl.fa = (p.bl.fa ?? 0) - 0.12;
  p.hd = [(p.hd?.[0] ?? 0) + 0.2 * K(b), p.hd?.[1] ?? 0];
  return p;
}
function run(b: Build, t: number): Pose {
  const p = gait(b, t, RUN_G(b));
  p.flags = { ...(p.flags ?? {}), hair: 2 };
  p.hd = [(p.hd?.[0] ?? 0) + 0.5 * K(b), (p.hd?.[1] ?? 0) - 0.3 * K(b)];
  return p;
}

registerOwn7('aroha', 'idle', { info: { frames: 32, fps: 10, loop: true }, pose: idle });
registerOwn7('aroha', 'walk', { info: { frames: 12, fps: 16, loop: true }, pose: walk, dist: b => gaitDist(WALK_G(b)) });
registerOwn7('aroha', 'run', { info: { frames: 12, fps: 18, loop: true }, pose: run, dist: b => gaitDist(RUN_G(b)) });
