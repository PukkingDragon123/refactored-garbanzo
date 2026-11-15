// V12 Te Ara Matatū, chapter 5: Te Wheke Kōhatu, the stone-den octopus of the Deep (Enteroctopus
// lithophilus), sculpted with the beast sketch (shared shading, edge lines and rim light).
//
// A giant octopus, its arms longer than Mori is tall: a heavy, wrinkled, warty mantle in brick red, a
// big gold eye with a dark bar pupil under a twisted horn of skin (the supra-ocular papilla), the white
// funnel under it, and eight thick tapering arms, each lined with a double row of pale cream suckers,
// joined at their roots by a deep web. Its skin is never still: chromatophores make dark mottled
// clouds over the brick, the warts lift and flatten, and when it is cornered it goes ghost-pale with
// a dark ring round the eye and its arms flung wide (the deimatic display).
//
// Anims (anchor: the eye's middle, facing right = the eye's side; a jetting octopus goes mantle first,
// and the art turns it so that mantle-first is also +x): idle (hovering, arms curling slowly), crawl
// (walking on its arm tips over the bed), jet (mantle forward, arms streamed behind, pulsing), display
// (pale, arms spread, the eye ringed dark), grab (two arms shooting forward, suckers out), ink (a jet
// and a cloud of dark ink thrown behind), den (squeezed into its den: the eye up over coiled arms, the
// mantle tucked back into the dark), flash (a dark wave of colour passing over it, the "passing cloud").

import { Sk, V2, rmp, SpeciesDef, TAU, sm, hh, chain } from '../../beasts-core';
import type { Px, BeastEye, AnimDef } from '../../beasts-core';
import { hex } from '../../color';
import { clamp } from '../../../core/math';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const WHEKE_ANIMS: Record<string, AnimDef> = {
  idle: A(6, 4),
  crawl: A(6, 6),
  jet: A(4, 7),
  display: A(4, 5),
  grab: A(5, 9, false),
  ink: A(5, 9, false),
  den: A(4, 2),
  flash: A(6, 8),
  swim: A(4, 7),
};

interface Arm {
  /** heading at the root (radians, screen space) and the curl along it (total turn) */
  ang: number; curl: number;
  /** a wave running down it: amplitude, phase */
  wa: number; wp: number;
  /** length factor; near (in front of the body) or far (behind, darker) */
  len: number; near: boolean;
  /** which side the suckers are on (+1: left of travel) */
  suck: 1 | -1;
}
interface OP {
  /** mantle axis angle from the head (where it points), how long and how full */
  mAng: number; mLen: number; mFull: number;
  arms: Arm[];
  /** 0 brick, 1 ghost pale */
  pale: number;
  /** the passing cloud: position of the dark band along the body (-1 off) */
  cloud: number;
  /** dark ring round the eye */
  ring: number;
  ink: number;
  /** tucked in its den: the far half fades into the dark */
  den: number;
  /** horn up (0 flat .. 1 raised) and warts raised */
  horn: number; warts: number;
  eyeK: number;
}

const ARM_L = 46;
function arms8(base: number, spread: number, curl: number, o: { ph?: number; wa?: number; len?: number } = {}): Arm[] {
  // four far arms behind the body, four near ones in front; fanned round `base`
  const out: Arm[] = [];
  for (let i = 0; i < 8; i++) {
    const near = i % 2 === 0;
    const k = (i - 3.5) / 3.5;
    out.push({
      ang: base + k * spread * (near ? 0.8 : 1) + (hh(i, 9, 17) - 0.5) * spread * 0.25,
      curl: curl * (0.55 + 0.9 * hh(i, 3, 11)) * (k < 0 ? 1 : 1.15),
      wa: o.wa ?? 0.5, wp: (o.ph ?? 0) + i * 0.8,
      len: (o.len ?? 1) * (0.86 + 0.24 * hh(i, 5, 13)),
      near, suck: k < 0 ? -1 : 1,
    });
  }
  return out;
}

function opose(anim: string, f: number, n: number): OP {
  const t = f / n, s = Math.sin(t * TAU), c = Math.cos(t * TAU);
  const p: OP = { mAng: -2.35, mLen: 26, mFull: 1, arms: [], pale: 0, cloud: -1, ring: 0, ink: 0, den: 0, horn: 0.5, warts: 0.5, eyeK: 1 };
  switch (anim) {
    case 'idle': case 'flash':
      p.mAng = -2.3 + s * 0.06; p.mFull = 1 + s * 0.05;
      p.arms = arms8(1.4, 0.95, 3.2, { ph: t * TAU, wa: 0.7 });
      p.arms.forEach((a, i) => { if (i === 1 || i === 6) { a.curl *= -0.6; } if (i === 0) { a.ang = 2.6; a.curl = 2.5; } });
      if (anim === 'flash') p.cloud = -0.3 + t * 1.7;
      break;
    case 'crawl': {
      p.mAng = -2.55 + s * 0.05; p.mFull = 1;
      p.arms = arms8(1.45, 0.95, 0.5, { ph: t * TAU * 1.0, wa: 0.35 });
      // arm tips planted and stepping: alternate arms swing forward
      p.arms.forEach((a, i) => { const ph = t * TAU + (i % 2) * Math.PI; a.ang += Math.sin(ph) * 0.22; a.curl = 0.5 + Math.max(0, Math.cos(ph)) * 0.9; });
      break;
    }
    case 'jet': case 'swim': {
      // mantle first (+x), the arms streaming out behind; the mantle squeezes (jet) and refills
      const pulse = anim === 'jet' ? [1.12, 0.86, 0.92, 1.05][f] : 1 + s * 0.05;
      p.mAng = 0.08; p.mLen = 28 * (2 - pulse) * 0.95; p.mFull = pulse;
      p.arms = arms8(Math.PI - 0.06, 0.07 + (pulse - 0.86) * 0.55, 0.15, { ph: t * TAU, wa: 0.55, len: 1.08 });
      p.arms.forEach((a, i) => { a.curl = (i - 3.5) * -0.09; });
      p.warts = 0.1; p.horn = 0.1;
      break;
    }
    case 'display':
      p.mAng = -2.0 + s * 0.04; p.mFull = 1.08;
      p.arms = arms8(1.2, 2.25, 0.9 + c * 0.15, { ph: t * TAU * 0.5, wa: 0.25, len: 1.02 });
      p.pale = 1; p.ring = 1; p.horn = 1; p.warts = 0.1;
      break;
    case 'grab': {
      const k = [0.2, 0.7, 1, 1, 0.6][f];
      p.mAng = -2.5 + k * 0.25;
      p.arms = arms8(1.3, 1.0, 1.4 - k * 0.6, { ph: f * 0.7, wa: 0.35 });
      // two near arms shoot forward at the target
      for (const i of [4, 6]) { const a = p.arms[i]; a.ang = 0.15 + (i - 5) * 0.08 - k * 0.1; a.curl = 0.25 * (1 - k) + (f === 4 ? 1.2 : 0); a.len = 1.05 + k * 0.35; a.wa = 0.1; }
      p.horn = 1; p.warts = 0.8;
      break;
    }
    case 'ink': {
      const pulse = [1.15, 0.8, 0.9, 1, 1.05][f];
      p.mAng = 0.1; p.mLen = 28 * (2 - pulse) * 0.95; p.mFull = pulse;
      p.arms = arms8(Math.PI - 0.06, 0.22, 0.1, { ph: f, wa: 0.3, len: 1.05 });
      p.ink = [0.25, 0.6, 0.9, 1.1, 1.25][f];
      p.pale = 0.35;
      break;
    }
    case 'den':
      p.mAng = -2.75 + s * 0.04; p.mLen = 22; p.mFull = 0.92 + s * 0.04;
      p.arms = arms8(1.6, 0.7, 4.4, { ph: t * TAU, wa: 0.25, len: 0.82 });
      p.den = 1; p.horn = 0.8; p.warts = 0.9;
      break;
  }
  return p;
}

const lerpC = (a: number, b: number, k: number) => a + (b - a) * k;

function odraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = WHEKE_ANIMS[anim]?.frames ?? 1;
  const P = opose(WHEKE_ANIMS[anim] ? anim : 'idle', frame, n);
  const k = juv ? 0.55 : 1;
  const pale = P.pale;
  const M = {
    skin: sk.m(rmp(pale > 0.6 ? '#d8c4b2' : pale > 0.2 ? '#b0604a' : '#93382a', { n: 6, dark: 0.55, light: 0.4, cool: 0.18, warm: 0.3 }), { edge: 1, k: 0.85 }),
    deep: sk.m(rmp(pale > 0.6 ? '#a88e80' : '#5e2019', { n: 5, dark: 0.5, light: 0.3, cool: 0.2, warm: 0.2 }), { edge: 1, k: 0.8 }),
    wart: sk.m(rmp(pale > 0.6 ? '#f2e6d6' : '#c8745a', { n: 4, dark: 0.35, light: 0.35, warm: 0.3 }), { edge: 0, k: 0.6 }),
    sucker: sk.m(rmp('#e8cdb4', { n: 4, dark: 0.35, light: 0.35, warm: 0.2, cool: 0.1 }), { edge: 0, k: 0.7, noRim: true }),
    web: sk.m(rmp(pale > 0.6 ? '#c4ab9a' : '#7a2c22', { n: 4, dark: 0.45, light: 0.3, cool: 0.2 }), { edge: 0, k: 0.6, noRim: true }),
    funnel: sk.m(rmp('#d8b8a4', { n: 4, dark: 0.4, light: 0.3, cool: 0.1 }), { edge: 1, k: 0.6 }),
    eye: sk.m(rmp('#c89a3a', { n: 4, dark: 0.45, light: 0.4, warm: 0.3 }), { edge: 0, k: 0.6, spec: 0.5 }),
  };
  const zFar = -8, zNear = 9;
  const H: V2 = [0, 0];
  const mdx = Math.cos(P.mAng), mdy = Math.sin(P.mAng);
  // the passing cloud: a darkening band moving along the body (0 at the arm tips' end .. 1 the mantle's)
  const cloud = (q: number) => (P.cloud < -0.5 ? 0 : Math.max(0, 1 - Math.abs(q - P.cloud) / 0.22) * 0.42);
  /** the skin: brick with chromatophore mottling and papillae; pale = ghosted */
  const skinTone = (p: Px, q: number, far: boolean) => {
    const mot = hh(p.x / 3, p.y / 3, 71) - 0.5, mot2 = hh(p.x / 2, p.y / 2, 73) - 0.5;
    p.l += mot * (0.16 - pale * 0.1) + mot2 * 0.06 - cloud(q);
    if (far) p.l -= 0.16;
    if (P.den) p.l -= sm((q - 0.55) / 0.4) * 0.35;
    const w = hh(p.x, p.y, 77);
    if (w > 0.9 - P.warts * 0.06 && p.nz > 0.55) { p.l += 0.2; return M.wart; }
    if (mot < -0.3 && pale < 0.5 && !far) return M.deep;
    return M.skin;
  };

  // ---------------------------------------------------------------- the arms
  const rootC: V2 = [H[0] - mdx * 5 * k, H[1] - mdy * 5 * k];
  const armPts: V2[][] = [];
  const drawArm = (a: Arm, idx: number, z0: number) => {
    const N = 18, L = ARM_L * a.len * k;
    const sp = P.mAng > -1 && P.mAng < 1 ? 0.25 : 0.55;
    const off: V2 = [Math.cos(a.ang + Math.PI / 2) * (idx - 3.5) * sp * k, Math.sin(a.ang + Math.PI / 2) * (idx - 3.5) * sp * k];
    const start: V2 = [rootC[0] + off[0] + Math.cos(a.ang) * 1.5, rootC[1] + off[1] + Math.sin(a.ang) * 1.5];
    // the curl gathers toward the tip (tips coil tighter), with a travelling wave
    const pts = chain(start, a.ang, N, i => L / N * (1 - i / N * 0.3), i => {
      const u = i / N;
      return (a.curl * u * u * u * 3.4) / N * (a.suck > 0 ? 1 : -1) + Math.sin(u * 5 - a.wp) * a.wa * 0.07;
    });
    armPts[idx] = pts;
    sk.np();
    const R = (t: number) => (3.9 * Math.pow(1 - t, 1.1) + 0.45) * k;
    sk.tube(pts, R, (p: Px) => {
      const t = p.t;
      // the suckers: a bead row on the inner edge (bigger toward the root), the rim catching light
      if (p.v * a.suck > 0.42 && t > 0.05) {
        const b = (t * L) / Math.max(1.4, 2.6 * (1 - t * 0.6));
        const fr = b - Math.floor(b);
        p.l += fr < 0.55 ? 0.12 : -0.18;
        if (!a.near) p.l -= 0.18;
        return M.sucker;
      }
      if (pale > 0.6 && Math.abs(p.v) > 0.78 && p.v * a.suck < 0) { p.l -= 0.35; return M.deep; }
      return skinTone(p, 0.5 - t * 0.5, !a.near);
    }, { z: t => z0 - t * 1.5 });
  };
  const far = P.arms.map((a, i) => [a, i] as const).filter(([a]) => !a.near);
  const near = P.arms.map((a, i) => [a, i] as const).filter(([a]) => a.near);
  for (const [a, i] of far) drawArm(a, i, zFar);

  // ---------------------------------------------------------------- the web between the arm roots
  {
    sk.np(true);
    const order = P.arms.map((a, i) => ({ a, i })).sort((x, y) => x.a.ang - y.a.ang);
    for (let j = 0; j + 1 < order.length; j++) {
      const A0 = armPts[order[j].i], A1 = armPts[order[j + 1].i];
      if (!A0 || !A1) continue;
      const d = Math.round(A0.length * (P.pale ? 0.32 : 0.24));
      const pts: number[] = [rootC[0], rootC[1]];
      for (let q = 1; q <= d; q++) pts.push(A0[q][0], A0[q][1]);
      // the web's free edge sags in a scallop between the two arms
      const e0 = A0[d], e1 = A1[d];
      const mid: V2 = [(e0[0] + e1[0]) / 2 - (e0[0] + e1[0] - 2 * rootC[0]) * 0.18, (e0[1] + e1[1]) / 2 - (e0[1] + e1[1] - 2 * rootC[1]) * 0.18];
      pts.push(mid[0], mid[1]);
      for (let q = d; q >= 1; q--) pts.push(A1[q][0], A1[q][1]);
      sk.poly(pts, (p: Px) => { p.l += (hh(p.x / 2, p.y / 2, 81) - 0.5) * 0.1 - 0.08 - cloud(0.45); if (P.den) p.l -= 0.1; return M.web; }, { z: -2, n: [0, -0.2, 1] });
    }
  }

  // ---------------------------------------------------------------- the mantle: a heavy wrinkled sac
  {
    sk.np();
    const N = 12, L = P.mLen * k;
    const base: V2 = [H[0] + mdx * 3 * k, H[1] + mdy * 3 * k];
    // it sags under its own weight away from the axis (gravity, not in the jet)
    const sag = P.mAng < -1 ? 0.025 : 0;
    const pts = chain(base, P.mAng, N, L / N, () => sag * (Math.cos(P.mAng) < 0 ? -1 : 1));
    const R = (t: number) => (t < 0.2 ? 6.2 + t * 14 : t < 0.7 ? 9 + Math.sin((t - 0.2) / 0.5 * Math.PI) * 0.6 : 9 * Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2)) + 0.6) * k * P.mFull;
    sk.tube(pts, R, (p: Px) => {
      // the wrinkles: soft folds ringing the sac
      const fold = Math.sin(p.t * 26 + hh(p.t * 9, 1, 3) * 2);
      p.l += fold * 0.05;
      return skinTone(p, 0.5 + p.t * 0.5, false);
    }, { z: 1, rz: 1.1 });
    // the mantle opening and the funnel (siphon) under the eye
    sk.np();
    const fd: V2 = [-mdx, -mdy];
    const perp: V2 = [-mdy, mdx];
    const sgn = perp[1] > 0 ? 1 : -1;
    const f0: V2 = [H[0] + perp[0] * sgn * 4.5 * k + mdx * 2, H[1] + perp[1] * sgn * 4.5 * k + mdy * 2];
    const f1: V2 = [f0[0] + mdx * 6 * k + perp[0] * sgn * 1.2, f0[1] + mdy * 6 * k + perp[1] * sgn * 1.2];
    sk.tube([f0, f1], t => (1.7 - t * 0.5) * k, M.funnel, { z: 5 });
    void fd;
  }

  // ---------------------------------------------------------------- the head and the eye
  const perpU: V2 = (() => { const q: V2 = [-mdy, mdx]; return q[1] < 0 ? q : [mdy, -mdx]; })();
  const E: V2 = [H[0] + perpU[0] * 1.5 * k, H[1] + perpU[1] * 1.5 * k];
  {
    sk.np();
    sk.ell(E[0], E[1], 5.4 * k, 4.8 * k, (p: Px) => skinTone(p, 0.55, false), { z: 6, rz: 3.5 });
  }
  // the horn of skin over the eye, twisted up and back
  if (P.horn > 0.05) {
    sk.np();
    const hb: V2 = [E[0] + mdx * 1.4 + perpU[0] * 3, E[1] + mdy * 1.4 + perpU[1] * 3];
    const ha = Math.atan2(perpU[1], perpU[0]) + (mdx < 0 ? 0.5 : -0.5) * (1 - P.horn * 0.4);
    const L = (2.2 + P.horn * 2.6) * k;
    sk.blade(hb[0], hb[1], hb[0] + Math.cos(ha) * L, hb[1] + Math.sin(ha) * L, s => (1.3 - s * 1.05) * k, (p: Px) => { p.l += 0.08; return pale > 0.6 ? M.wart : M.skin; }, { z0: 7, z1: 7.5, bend: 0.6 });
  }
  // eye: a gold iris with the dark bar pupil; the ring of the display
  {
    const ex = Math.round(E[0] + 0.4), ey = Math.round(E[1]);
    const ring = hex(P.ring ? '#1e0c0a' : '#3e1610');
    const gold = hex('#d8a43a'), gold2 = hex('#a47222'), bar = hex('#0c0606'), wet = hex('#fff6dc');
    // lids: a fleshy rim, darker in the display
    for (const [dx, dy] of [[-3, 0], [3, 0], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, -2], [0, -2], [1, -2], [-1, 2], [0, 2], [1, 2]] as const) sk.over(ex + dx, ey + dy, ring);
    if (P.ring) for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2], [-3, -1], [3, 1], [-3, 1], [3, -1]] as const) sk.over(ex + dx, ey + dy, hex('#2a1410'));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sk.over(ex + dx, ey + dy, dy > 0 ? gold2 : gold);
    sk.over(ex - 2, ey, gold2); sk.over(ex + 2, ey, gold2);
    // the pupil: a horizontal bar
    sk.over(ex - 1, ey, bar); sk.over(ex, ey, bar); sk.over(ex + 1, ey, bar);
    sk.over(ex - 1, ey - 1, wet);
    // the heavy brow fold over it
    for (let dx = -2; dx <= 2; dx++) sk.over(ex + dx, ey - 3, hex(P.ring ? '#3a2018' : '#5a1e16'));
  }
  for (const [a, i] of near) drawArm(a, i, zNear);

  // ---------------------------------------------------------------- the ink cloud
  if (P.ink > 0) {
    const cx = -mdx * 0 - 30 * k * P.ink, cy = 2;
    const R0 = (6 + P.ink * 14) * k;
    const c0 = hex('#160c14', 235), c1 = hex('#2a1826', 200), c2 = hex('#46303e', 150), c3 = hex('#5c4652', 90);
    for (let y = Math.floor(cy - R0); y <= Math.ceil(cy + R0); y++) for (let x = Math.floor(cx - R0 * 1.4); x <= Math.ceil(cx + R0 * 1.2); x++) {
      const dx = (x - cx) / (R0 * 1.3), dy = (y - cy) / R0;
      const n2 = hh(x / 4, y / 4, 91) * 0.55 + hh(x / 2, y / 2, 93) * 0.25 + hh(x, y, 95) * 0.2;
      const d = Math.hypot(dx, dy) - (n2 - 0.5) * 0.7;
      if (d > 1) continue;
      // curling plumes: denser in the core, broken lacy edges
      const col = d < 0.45 ? c0 : d < 0.7 ? c1 : d < 0.88 ? c2 : c3;
      if (d > 0.88 && hh(x, y, 97) < 0.5) continue;
      if (!sk.has(x, y)) sk.over(x, y, col);
    }
  }
  return { head: [E[0], E[1] - 6 * k] as V2, eye: E };
}

export const WHEKE: SpeciesDef = {
  name: 'Te Wheke Kōhatu', kind: 'mollusc', len: 90, height: 40,
  anims: WHEKE_ANIMS,
  canvas: () => ({ w: 180, h: 150, ox: 90, oy: 70 }),
  draw: odraw,
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(WHEKE_ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};
void clamp; void lerpC;
