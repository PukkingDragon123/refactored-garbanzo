// Quillhog (Echinomys nocturnus): a nocturnal, fruit-eating porcupine built like a crested porcupine.
//
// Painted on the Relief layer (beasts-relief.ts) from one contour per mass through anatomical landmarks:
// a low, hunched body, highest over the rump, in coarse, grizzled black-brown fur with a greyer belly
// and long guard hairs breaking the lower outline; a small blunt head with a white face mask round big
// dark night eyes, a pink nose, small round ears and long whiskers; short plantigrade legs with dark
// claws. Over it lies the armament, every spine placed one by one: a crest of long, thin, flexible
// spines from the crown down the nape; a cape of long, banded quills (white root, black, a white band,
// black, a long white tip) lying back over the shoulders and rump and trailing past the tail; shorter
// quills down the flank; and on the stubby tail a cluster of hollow white rattle quills, open at their
// ends, that buzz when it shakes them. Raised, the crest and the cape fan up into a great white-tipped
// halo that breaks the whole outline; rattling, every spine trembles.
// Threat: it turns its quilled rump toward the danger and glares back over its shoulder.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, ik2, lerp2 } from './beasts-core';
import { Frame2, whiskers } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { localOf, clamp01, claw } from './beasts-mam-kit';
import { hex } from './color';

interface P {
  bx: number; by: number; tilt: number; br: number; squash: number;
  feet: [V2, V2, V2, V2];
  head: number; hdx: number; hdy: number; jaw: number; ear: number;
  quill: number;   // 0 flat .. 1 fully raised
  rattle: number;  // per-frame jitter seed (0 = none)
  tail: number;
  curl: number;    // sleep: curled up
  fruit: number;   // 0 none, else fruit size (eat)
  threat: boolean;
  scratch: number; // groom: hind foot scratching at the ear
}
const base = (): P => ({
  bx: 0, by: 0, tilt: 0, br: 0, squash: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
  head: 0, hdx: 0, hdy: 0, jaw: 0, ear: 0, quill: 0, rattle: 0, tail: 0, curl: 0, fruit: 0, threat: false, scratch: -1,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 12, loop: true },
  eat: { frames: 4, fps: 5, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 4, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  quills: { frames: 2, fps: 12, loop: true },
  threat: { frames: 2, fps: 12, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = 0.08 + (f === 2 ? 0.06 : 0);
      p.ear = f === 3 ? 1 : 0;
      p.quill = 0.05 + p.br * 0.05;
      break;
    case 'walk': {
      const st = 5, lift = 1.8, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.5;
      p.tilt = Math.sin(t * TAU) * 0.03;
      p.head = 0.14 + Math.sin(t * TAU * 2) * 0.04;
      p.quill = 0.08 + Math.max(0, Math.cos(t * TAU * 2)) * 0.05;
      p.tail = Math.sin(t * TAU) * 0.15;
      break;
    }
    case 'run': {
      const st = 8.5, lift = 3, duty = 0.42;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.1, duty, st, lift);
      p.feet[2] = gait(t + 0.5, duty, st, lift);
      p.feet[3] = gait(t + 0.6, duty, st, lift);
      p.by = -Math.abs(Math.sin(t * TAU)) * 1.6 + 0.5;
      p.tilt = Math.sin(t * TAU + 0.5) * 0.08;
      p.squash = Math.cos(t * TAU) * 0.06;
      p.head = 0.05;
      p.hdx = 0.6;
      p.quill = 0.02;
      p.ear = -1;
      break;
    }
    case 'eat':
      p.tilt = 0.08;
      p.head = 0.5 + (f % 2) * 0.08;
      p.hdx = 0.4;
      p.jaw = [0.2, 0.8, 0.3, 0.9][f];
      p.fruit = 1 - f * 0.08;
      p.feet[0] = [2, 0];
      p.quill = 0.04;
      break;
    case 'alert':
      p.by = -1;
      p.tilt = -0.08;
      p.head = -0.3;
      p.ear = 1;
      p.quill = 0.35 + f * 0.05;
      p.feet[0] = [0.5, 0];
      break;
    case 'sleep':
      p.curl = 1;
      p.br = f;
      p.quill = 0.1 + f * 0.04;
      break;
    case 'call':
      p.head = -0.4;
      p.jaw = f ? 1 : 0.5;
      p.by = -0.5;
      p.tilt = -0.05;
      p.quill = 0.18 + f * 0.05;
      p.ear = 0.5;
      break;
    case 'groom':
      p.tilt = -0.1;
      p.by = 0.4;
      p.head = 0.35;
      p.scratch = f;
      p.feet[3] = [1, 0];
      p.quill = 0.12;
      break;
    case 'quills':
      p.by = -0.6;
      p.tilt = 0.08;
      p.head = 0.35;
      p.quill = 1;
      p.rattle = f + 1;
      p.feet[0] = [1, 0];
      p.feet[2] = [-1, 0];
      p.ear = -1;
      break;
    case 'threat':
      p.threat = true;
      p.quill = 1;
      p.rattle = f + 1;
      p.by = -0.8 - f * 0.3;
      p.tilt = -0.12;
      p.tail = 0.9;
      p.feet[2] = [0, f ? -1.2 : 0];
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1.6, iris: hex('#2a1a14'), lash: hex('#2a201c'), dark: true, shine: hex('#fff4e0') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#4c3c32', { n: 7, dark: 0.62, light: 0.42, warm: 0.4, cool: 0.3 }), { edge: 1 }),
    furD: sk.m(rmp('#2e241f', { n: 6, dark: 0.58, light: 0.36, cool: 0.3 }), { edge: 1 }),
    grizzle: sk.m(rmp('#a08c76', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    belly: sk.m(rmp('#786a5e', { n: 6, dark: 0.55, light: 0.38 }), { edge: 1 }),
    mask: sk.m(rmp('#ede4d2', { n: 6, dark: 0.42, light: 0.35, at: 3 }), { edge: 1 }),
    nose: sk.m(rmp('#e4909a', { n: 5, dark: 0.45, light: 0.4 }), { edge: 0, spec: 1 }),
    claw: sk.m(rmp('#a89680', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    qL: sk.m(rmp('#efe4ca', { n: 6, dark: 0.45, light: 0.38, at: 3 }), { edge: 1 }),
    qD: sk.m(rmp('#221c1a', { n: 5, dark: 0.45, light: 0.42 }), { edge: 1 }),
    qM: sk.m(rmp('#8a7a6a', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    fruit: sk.m(rmp('#d2452e', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    fruitL: sk.m(rmp('#f0a040', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    leaf: sk.m(rmp('#4f8a3a', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    inner: sk.m(rmp('#b98482', { n: 5, dark: 0.5, light: 0.35 }), { edge: 0 }),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
    tooth: sk.m(rmp('#e8a040', { n: 4, dark: 0.4, at: 2 }), { edge: 0 }),
    pad: sk.m(rmp('#5a4640', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
  };
}
type M = ReturnType<typeof mats>;

const ID = { BODY: 1, HEAD: 2, LEG: 3, FOOT: 4, CLAW: 5, TAIL: 6, EAR: 7, MOUTH: 8, FRUIT: 9, LEAF: 10, Q: 20 };

/** banded quill colour along its length t (0 root .. 1 tip): white root, black, a white band, black, a long white tip */
const qBand = (M: M, t: number, crest: boolean, flank = false) => (crest
  ? (t < 0.5 ? M.qD : t < 0.62 ? M.qM : M.qL)
  : flank ? (t < 0.66 ? M.qD : t < 0.74 ? M.qM : M.qL)
  : (t < 0.4 ? M.qD : t < 0.52 ? M.qL : t < 0.74 ? M.qD : M.qL));

interface Quill { root: V2; ang: number; len: number; r: number; z: number; crest: boolean; flank?: boolean }

/** lay the spines in the relief (lowest first), each its own element so overlapping spines part with a seam */
function drawQuills(R: Relief, M: M, qs: Quill[]) {
  qs.sort((a, b) => a.z - b.z);
  const sk = R.sk;
  qs.forEach((q, i) => {
    // keep every tip inside the canvas
    let len = q.len;
    const ca = Math.cos(q.ang), sa = Math.sin(q.ang);
    const x0 = -sk.ox + 2, x1 = sk.w - sk.ox - 3, y0 = -sk.oy + 2;
    if (ca < -1e-3) len = Math.min(len, (q.root[0] - x0) / -ca);
    if (ca > 1e-3) len = Math.min(len, (x1 - q.root[0]) / ca);
    if (sa < -1e-3) len = Math.min(len, (q.root[1] - y0) / -sa);
    const tip: V2 = [q.root[0] + ca * len, q.root[1] + sa * len];
    R.cap(q.root, tip, q.r, q.r * 0.45, { za: q.z, zb: q.z + 1.6, rz: 0.8, id: ID.Q + (i % 200), tex: (p, o) => { o.m = qBand(M, p.t, q.crest, q.flank); if (p.v < -0.2) o.t += 0.08; } });
  });
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const mx = P.threat ? -1 : 1;
  const B = new Frame2([P.bx * k, (-8.8 + P.by) * k], P.tilt * mx, k, mx);
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const sq = 1 + P.squash, br = P.br * 0.3;
  const inv = (x: number, y: number): V2 => { const [a, b] = localOf(B.o, B.a, k)(x, y); return [a * mx, b]; };
  const gk = Math.max(0.8, k);

  // ---------------------------------------------------------------- coat
  const coat = (p: Sp, o: Tx) => {
    const [lx, ly] = inv(p.x, p.y);
    const ang = B.ang(Math.PI + 0.25 + (ly > 3 ? 0.9 : 0));
    o.z += strands(p.x, p.y, ang, 2.6 * gk, 1.2 * gk, 13) * 0.75;
    o.m = ly > 3.6 + Math.sin(lx * 0.5) * 0.6 ? M.belly : ly < -2 ? M.furD : M.fur;
    if (FS.tip > 0.8 && hh(FS.row, FS.seg, 15) < 0.22) o.m = M.grizzle;
  };

  // ---------------------------------------------------------------- legs
  const legJ = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const root = B.p(front ? 6.4 - (near ? 0 : 1) : -7 + (near ? 0 : 1), front ? 2.6 : 2.4);
    const off = P.feet[which];
    let foot: V2 = [((front ? 7.6 : -6.2) + (near ? 0 : front ? -1.2 : 1.2) + off[0]) * k * mx + P.bx * k, Math.min(0, off[1] * k)];
    let lifted = off[1] < -0.4;
    if (which === 2 && P.scratch >= 0) { const s = [0, 1, 0.4, 1][P.scratch]; foot = B.p(8.6 + s * 0.8, -1.4 - s * 1.2); lifted = true; }
    const end: V2 = front ? [foot[0] - 0.4 * k * mx, foot[1] - 1.6 * k] : [foot[0] - 1.6 * k * mx, foot[1] - 1.3 * k];
    const [j, e] = ik2(root, end, (front ? 3.6 : 4) * k, (front ? 3.6 : 3.8) * k, (front ? 1 : -1) * mx);
    return { root, j, e, foot, front, lifted };
  };
  type LJ = ReturnType<typeof legJ>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, e } = L, s = k * mx;
    const up: V2 = [root[0] - (j[0] - root[0]) * 0.5, root[1] - (j[1] - root[1]) * 0.5];
    if (L.front) return [
      along(up, root, 1, 2.6 * s), along(root, j, 0.3, 2.4 * s), along(root, j, 0.9, 1.8 * s),
      along(j, e, 0.3, 1.5 * s), along(j, e, 1, 1.2 * s), along(j, e, 1.1, -1.1 * s), along(j, e, 0.5, -1.3 * s),
      along(j, e, -0.12, -1.4 * s, 0.4), along(root, j, 0.5, -2.4 * s), along(up, root, 0.5, -2.4 * s),
    ];
    return [
      along(up, root, 1, 3.2 * s), along(root, j, 0.3, 3 * s), along(root, j, 1, 1.6 * s, 0.2),
      along(j, e, 0.4, 1.3 * s), along(j, e, 1, 1.1 * s), along(j, e, 1.12, -1 * s, 0.4), along(j, e, 0.5, -1.4 * s),
      along(root, j, 0.8, -2.2 * s), along(root, j, 0.3, -3.2 * s), along(up, root, 0.5, -3 * s),
    ];
  };
  const foot = (R: Relief, L: LJ, z0: number) => {
    const { e } = L, s = k;
    const tilt = L.lifted ? 0.6 : 0;
    const c = Math.cos(tilt * mx), sn = Math.sin(tilt * mx);
    const q = (x: number, y: number, sh = 0): LM => [e[0] + (x * mx * c - y * sn) * s, e[1] + (x * mx * sn + y * c) * s, sh];
    const len = L.front ? 2.2 : 3.2;
    R.region(spline([q(-1.2, -0.9), q(len * 0.6, -0.7), q(len, 0.4), q(len * 0.8, 1.4, 0.3), q(-1, 1.4, 0.3)], 0.4), { z: z0, R: 0.8, H: 1.1, id: ID.FOOT, tex: (p, o) => { o.m = M.furD; if (p.v > 0.7) o.m = M.pad; } });
    for (let i = 0; i < 3; i++) {
      const b = q(len - 0.3 - i * 0.25, 0.4 + i * 0.4);
      claw(R, [b[0], b[1]], (mx > 0 ? 0.5 : Math.PI - 0.5) + tilt * mx, (L.front ? 1.7 : 1.4) * s, 0.8 * s, 0.7 * mx, z0 + 0.8 + i * 0.1, ID.CLAW, M.claw);
    }
  };
  for (const w of [3, 1]) {
    const L = legJ(w);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 6, Math.min(...ol.map(q => q[1])) - 4, Math.max(...ol.map(q => q[0])) + 6, 1);
    R.region(spline(ol, 0.6), { z: -12, R: 1.4 * k, H: 1.8 * k, id: ID.LEG, tex: coat });
    foot(R, L, -10);
    sk.np();
    R.emit({ bias: -0.18, drop: 1.4, seam: 0.5, seamDark: 0.3 });
  }

  const BR = Relief.full(sk);
  // ---------------------------------------------------------------- the stubby tail and its rattle
  const tb = B.p(-12.2, 0.2);
  const tA = B.ang(Math.PI - 0.55 - P.tail * 1.1);
  const tTip: V2 = [tb[0] + Math.cos(tA) * 4 * k, tb[1] + Math.sin(tA) * 4 * k];
  BR.cap(tb, tTip, 2.3 * k, 1.4 * k, { z: 0, rz: 0.9, id: ID.TAIL, tex: coat });
  // ---------------------------------------------------------------- the body
  const torso: LM[] = [
    bp(-12, 3.4), bp(-13.6, -0.5), bp(-12.4 * sq, -5), bp(-8 * sq, -7.8 - br), bp(-2, -8.4 - br), bp(3.4, -7.2 - br), bp(7.6, -4.8),
    bp(10.2, -1.4), bp(10.4, 2.6), bp(7.6, 5.6), bp(2, 6.6 + br * 0.5), bp(-4, 6.6), bp(-8.4, 5.2), bp(-10.4, 5.6),
  ];
  const tor = fringe(spline(torso, 0.6), 1.5 * gk, 3, (_x, _y, nx, ny) => (ny > 0.3 ? [1.6 * k + 0.4, nx * mx < 0 ? 0.5 : -0.5] : null));
  BR.region(tor, { z: 0, R: 6 * k, H: 6 * k, id: ID.BODY, tex: coat, pow: 0.9 });
  // near legs, fused in at the shoulder and the hip
  for (const w of [2, 0]) {
    const L = legJ(w);
    const ax = L.root, ay = L.e, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    const lift = L.lifted && w === 2 && P.scratch >= 0 ? 6 : 0;
    BR.region(fringe(spline(legOutline(L), 0.6), 1.3, w + 5, (_x, _y, nx) => (nx * mx < -0.4 ? [0.9 * k, 0.5] : null)), {
      R: 1.6 * k, H: 2 * k, id: ID.LEG, blend: 1, tex: coat,
      zAt: (x, y) => { const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al); return 4 * k - Math.max(0, 1 - (t + 0.05) / 0.5) * 5 * k + lift; },
    });
    foot(BR, L, 6 * k + lift);
  }
  // form: shoulder and haunch masses, the flank fold
  { const c = B.p(5, 0), d = B.p(-8, -1); BR.bump(c[0], c[1], 4 * k, 5 * k, 1.2 * k, 0, ID.BODY); BR.bump(d[0], d[1], 5 * k, 5 * k, 1.5 * k, 0, ID.BODY); }

  // ---------------------------------------------------------------- head
  let headC: V2, eyeC: V2 = [0, 0];
  const H = B.sub(9.4 + P.hdx, 0.4 + P.hdy, P.head);
  const hp = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const hinv = (x: number, y: number): V2 => { const [a, b] = localOf(H.o, H.a, k)(x, y); return [a * mx, b]; };
  const hz = 4 * k;
  if (!P.threat) {
    const ja = P.jaw * 0.4;
    const jp = (x: number, y: number, sh = 0): LM => {
      const dx = x - 1, dy = y - 2.4, c = Math.cos(ja), s = Math.sin(ja);
      return hp(1 + dx * c - dy * s, 2.4 + dx * s + dy * c, sh);
    };
    const head: LM[] = [hp(-2.4, -3.6), hp(1.2, -4.6), hp(4.4, -3.9), hp(6.8, -2.2), hp(8.4, -0.6), hp(9.3, 0.9, 0.4), hp(8.8, 2.3), hp(7.6, 2.6), jp(7.2, 3.1), jp(4.4, 3.9), jp(1.4, 4.2), hp(-1.4, 3.4), hp(-3, 0.4)];
    const hd = fringe(spline(head, 0.5), 1.2, 9, (x, y, _nx, ny) => { const [hx] = hinv(x, y); return hx < 3.5 && ny > 0.3 ? [1 * k, -0.5 * mx] : null; });
    BR.region(hd, { z: hz, R: 2.6 * k, H: 3 * k, id: ID.HEAD, blend: 1, tex: (p, o) => {
      const [hx, hy] = hinv(p.x, p.y);
      o.z += strands(p.x, p.y, H.ang(Math.PI), 1.6, 1, 17) * 0.4;
      // the white mask over the muzzle and round the eyes, a blaze up the brow; dark crown and nape
      const mask = hx > 2 - hy * 0.25 && hy > -3.4 + Math.max(0, 3.2 - hx) * 0.5;
      o.m = mask ? M.mask : hy > 2.2 ? M.belly : M.furD;
      if (hx > 8.3 && hy > -0.2 && hy < 2) o.m = M.nose;
    } });
    if (P.jaw > 0.3) {
      const a = H.p(4.6, 2.6), b = H.p(8.4, 2.4), c = jp(7.4, 3.1);
      BR.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.4], [c[0], c[1], 0.4]], 0.4), { z: hz + 3 * k, R: 0.5, H: 0.3, id: ID.MOUTH, tex: M.mouth });
      const ti = H.p(8, 2.5);
      BR.region(spline([[ti[0] - 0.5, ti[1], 0], [ti[0] + 0.5, ti[1], 0], [ti[0], ti[1] + 1.4 * k, 0.6]], 0.3), { z: hz + 3.4 * k, R: 0.4, H: 0.5, id: ID.MOUTH + 1, tex: M.tooth });
    }
    { const c = H.p(3.6, -1.1); BR.bump(c[0], c[1], 2 * k, 1.6 * k, 0.7 * k, 0, ID.HEAD); }
    { const c = H.p(2, 2.2); BR.bump(c[0], c[1], 2.2 * k, 1.6 * k, 0.6 * k, 0, ID.HEAD); }
    // small round ears
    for (const near of [false, true]) {
      const eb = H.p(near ? -0.6 : 0.2, near ? -3 : -3.6);
      const ea = H.ang(-2.3 + P.ear * 0.3 - (near ? 0 : 0.3));
      const ca = Math.cos(ea), sa = Math.sin(ea), nx = -sa, ny = ca;
      const q = (t: number, w: number, sh = 0): LM => [eb[0] + (ca * t * 2.6 + nx * w * 1.4) * k, eb[1] + (sa * t * 2.6 + ny * w * 1.4) * k, sh];
      BR.region(spline([q(-0.2, -0.8), q(0.6, -1), q(1.05, 0, 0.2), q(0.6, 0.9), q(-0.2, 0.8)], 0.4), { z: hz + (near ? 3.5 : -1.5) * k, R: 0.7, H: 0.9, id: ID.EAR, tex: (p, o) => {
        o.m = M.furD;
        if (near && p.s > 0.7) { o.m = M.inner; o.z -= 0.4; }
      } });
    }
    headC = H.p(3.5, -1);
  } else {
    // glaring back over the shoulder: the face turned to the viewer, low behind the raised quills
    const fc = B.p(9.6, -0.6);
    const q = (x: number, y: number, sh = 0): LM => [fc[0] + x * k, fc[1] + y * k, sh];
    const face: LM[] = [q(-4.2, -1.4), q(-2.6, -4), q(0, -4.6), q(2.6, -4), q(4.2, -1.4), q(3.8, 1.8), q(1.6, 3.8), q(0, 4.2), q(-1.6, 3.8), q(-3.8, 1.8)];
    BR.region(fringe(spline(face, 0.5), 1.2, 4, (_x, _y, _nx, ny) => (ny < 0 ? [0.9 * k, 0.4] : null)), { z: 8 * k, R: 3 * k, H: 3.4 * k, id: ID.HEAD, tex: (p, o) => {
      const dx = (p.x - fc[0]) / k, dy = (p.y - fc[1]) / k;
      o.z += strands(p.x, p.y, -Math.PI / 2, 1.6, 1, 19) * 0.4;
      // the white mask: a blaze down the forehead widening over the muzzle and round both eyes
      o.m = (Math.abs(dx) < 1.1 && dy < 0) || dy > -0.4 || Math.hypot(Math.abs(dx) - 1.9, dy + 0.4) < 1.7 ? M.mask : M.furD;
      if (Math.abs(dx) < 1 && dy > 1.4 && dy < 2.8) o.m = M.nose;
    } });
    for (const sx of [-1, 1]) {
      const eb = q(sx * 3.2, -3.2);
      BR.region(spline([[eb[0] - 1.2 * k, eb[1] + 0.6 * k, 0], [eb[0] + sx * 0.6 * k, eb[1] - 1.8 * k, 0.3], [eb[0] + sx * 1.8 * k, eb[1] + 0.2 * k, 0], [eb[0] + 0.6 * k, eb[1] + 1.2 * k, 0]], 0.4), { z: 9 * k, R: 0.7, H: 0.9, id: ID.EAR, tex: M.furD });
    }
    headC = fc;
  }

  // ---------------------------------------------------------------- the armament
  const qs: Quill[] = [];
  const raise = P.quill;
  const jit = (a: number, b: number) => (P.rattle ? (hh(a, b, P.rattle * 7) - 0.5) * 0.4 : (hh(a, b, 3) - 0.5) * 0.08);
  const ctr = B.p(-2, 6);
  const fan = (root: V2) => Math.atan2(root[1] - ctr[1], root[0] - ctr[0]);
  const dirOf = (root: V2, flow: number, back: number) => {
    // relaxed: lying back along the body (flow, a body angle); raised: fanned out from the haunch, leaning back
    const fA = B.ang(flow);
    let rA = fan(root) - back * mx;
    let d = rA - fA;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    rA = fA + d;
    return fA + (rA - fA) * raise;
  };
  const topAt = (lx: number) => -8.4 + 0.042 * (lx + 2) * (lx + 2) * (lx > -2 ? 1.05 : 0.75);
  // the cape: rows of long banded quills from the shoulders to the rump, lying back past the tail
  for (let r = 0; r < 4; r++) {
    const cols = r < 2 ? 8 : 6;
    for (let c = 0; c < cols; c++) {
      const lx = 6.4 - ((c + (r % 2) * 0.5) / (cols - 0.5)) * 18.6;
      const ly = Math.max(topAt(lx), -9) + 0.7 + r * 2.1;
      if (ly > 2.6) continue;
      const root = B.p(lx, ly);
      const rumpK = clamp01((2 - lx) / 13);
      const len = ((r < 2 ? 10.5 : 7) + rumpK * 5 - r * 0.8 + hh(c, r, 9) * 2 + raise * (0.5 + rumpK * 1.5)) * k;
      const flow = Math.PI + 0.06 + r * 0.14 - rumpK * 0.04 + jit(c, r);
      qs.push({ root, ang: dirOf(root, flow, 0.3 + rumpK * 0.2) + jit(r, c) * 0.5, len, r: (r < 2 ? 0.85 : 0.72) * gk, z: 6 * k + r * 1.2 + (lx + 13) * 0.12 + (raise > 0.5 ? (r < 2 ? -2 : 0) : 0), crest: false, flank: r >= 2 });
    }
  }
  // the crest: long thin spines from the crown down the nape, swept back (forward and up when raised)
  if (!P.threat) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const root = lerp2(H.p(-0.4, -3.8) as V2, B.p(5.2, -6.6), t);
      const len = (7 + Math.sin(t * Math.PI) * 4 + hh(i, 31, 5) * 1.5 + raise * 2) * k;
      const up = clamp01((raise - 0.25) / 0.5);
      const a = B.ang(Math.PI + 0.42 - t * 0.2 + (-Math.PI / 2 - 0.3 + t * 0.55 - Math.PI - 0.42 + t * 0.2) * up) + jit(i, 32) + jit(i, 30);
      qs.push({ root, ang: a, len, r: 0.6 * gk, z: hz + 5 * k + i * 0.1, crest: true });
    }
  }
  // the rattle: hollow white quills on the tail, open-ended, fanned and shaken
  {
    const rl = (P.quill > 0.5 ? 4.6 : 3.6) * k;
    for (let i = 0; i < 6; i++) {
      const a = tA - 0.9 + i * 0.36 + jit(i, 40) * 1.4 + P.quill * (i - 2.5) * 0.12;
      const b = lerp2(tb, tTip, 0.35 + (i % 2) * 0.35);
      const tip: V2 = [b[0] + Math.cos(a) * rl, b[1] + Math.sin(a) * rl];
      BR.cap(b, tip, 0.95 * k, 0.85 * k, { za: 3 + i * 0.2, zb: 4 + i * 0.2, rz: 0.8, id: ID.Q + 200 + i, tex: (p, o) => { o.m = p.t > 0.86 ? M.qD : M.qL; if (p.t < 0.2) o.m = M.qM; } });
    }
  }
  drawQuills(BR, M, qs);
  // the fruit held in the mouth
  if (P.fruit > 0 && !P.threat) {
    const fp = H.p(9.6, 3.4);
    const r = 2.3 * P.fruit * k;
    const cy = Math.min(fp[1], -r);
    const fr2: LM[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; const rr = r * (1 + (hh(i, 1, 7) - 0.5) * 0.18) * (i === 6 ? 0.82 : 1); fr2.push([fp[0] + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92, 0]); }
    BR.region(spline(fr2, 0.4), { z: 14 * k, R: r * 0.9, H: r, id: ID.FRUIT, tex: (p, o) => { o.m = p.u > 0.6 && p.v > 0.45 ? M.fruitL : M.fruit; if (hh(Math.floor(p.x), Math.floor(p.y), 3) < 0.08) { o.m = M.fruitL; o.z += 0.3; } } });
    const st: V2 = [fp[0] + 0.4 * k, cy - r];
    BR.region(spline([[st[0], st[1] + 0.4, 0], [st[0] + 1.2 * k, st[1] - 1 * k, 0.2], [st[0] + 2.4 * k, st[1] - 1.4 * k, 0.6], [st[0] + 1.4 * k, st[1] - 0.2 * k, 0.2]], 0.4), { z: 15 * k, R: 0.5, H: 0.6, id: ID.LEAF, tex: M.leaf });
  }
  BR.shadow(ID.HEAD, 1 * k, 1.2 * k, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.08, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.4 * k, seam: 0.6, seamDark: 0.32, ao: 0.06, aoR: 2 });

  if (!P.threat) {
    const ec = H.p(3.7, -1.2);
    eyeC = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 1 : 1.6 }, eye);
    whiskers(sk, H.p(8, 1.6), mx, 5.5 * k, hex('#d8d2c4'), 3, 0.3, 0.15);
  } else {
    const fc = B.p(9.6, -0.6);
    const e2 = eye === 'open' ? 'angry' : eye;
    eyeC = drawEye(sk, fc[0] - 1.9 * k, fc[1] - 0.6 * k, { ...EYE, r: 1.2 }, e2);
    drawEye(sk, fc[0] + 1.9 * k, fc[1] - 0.6 * k, { ...EYE, r: 1.2 }, e2);
  }
  return { head: [headC[0], headC[1] - 3 * k] as V2, eye: eyeC };
}

/** Sleeping: curled into a ball of quills, the white face tucked in at the front, a forepaw under the chin. */
function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const ry = (8 + P.br * 0.35) * k, rx = 9.6 * k;
  const c: V2 = [0, -ry];
  const BR = Relief.full(sk);
  const body: LM[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const flat = Math.sin(a) > 0 ? 0.92 : 1;
    body.push([c[0] + Math.cos(a) * rx * (1 + (hh(i, 2, 5) - 0.5) * 0.06), c[1] + Math.sin(a) * ry * flat, 0]);
  }
  BR.region(fringe(spline(body, 0.6), 1.4, 3, (_x, _y, _nx, ny) => (ny > 0.4 ? [1.2 * k, 0.5] : null)), { z: 0, R: 6 * k, H: 6 * k, id: ID.BODY, tex: (p, o) => {
    o.z += strands(p.x, p.y, Math.atan2(p.y - c[1], p.x - c[0]) + 1.4, 2.4, 1.2, 21) * 0.7;
    o.m = p.y > c[1] + ry * 0.4 ? M.belly : M.fur;
    if (FS.tip > 0.8 && hh(FS.row, FS.seg, 23) < 0.2) o.m = M.grizzle;
  } });
  // the quills: lying back round the whole curled back, from the brow over to the rump
  const qs: Quill[] = [];
  for (let r = 0; r < 4; r++) {
    const cols = 11 - r;
    for (let i = 0; i < cols; i++) {
      const a = -0.35 - ((i + (r % 2) * 0.5) / cols) * 2.6 - r * 0.05;
      const rr = 1 - r * 0.2;
      const root: V2 = [c[0] + Math.cos(a) * rx * rr * 0.92, c[1] + Math.sin(a) * ry * rr * 0.92];
      const lift = 0.35 + P.quill * 0.6;
      const ang = a - Math.PI / 2 + lift + (hh(i, r, 4) - 0.5) * 0.12;
      const len = (6.5 + Math.max(0, -Math.cos(a)) * 3 - r * 0.8 + hh(i, r, 6) * 1.4) * k;
      qs.push({ root, ang, len, r: 0.8 * k, z: 6 * k + r * 1.3 - i * 0.05, crest: false });
    }
  }
  drawQuills(BR, M, qs);
  // the tucked face and a forepaw
  const fc: V2 = [c[0] + rx * 0.55, c[1] + ry * 0.38];
  const face: LM[] = [[fc[0] - 3 * k, fc[1] - 1.6 * k, 0], [fc[0] + 0.4 * k, fc[1] - 2.8 * k, 0], [fc[0] + 3.4 * k, fc[1] - 0.6 * k, 0], [fc[0] + 3.6 * k, fc[1] + 1 * k, 0.4], [fc[0] + 0.6 * k, fc[1] + 2.6 * k, 0], [fc[0] - 2.6 * k, fc[1] + 1.8 * k, 0]];
  BR.region(spline(face, 0.5), { z: 14 * k, R: 2 * k, H: 2.4 * k, id: ID.HEAD, tex: (p, o) => { o.m = p.u > 0.82 && p.v > 0.35 && p.v < 0.75 ? M.nose : p.u > 0.25 ? M.mask : M.furD; } });
  {
    const pb: V2 = [fc[0] - 0.4 * k, -1.6 * k];
    BR.region(spline([[pb[0] - 1.6 * k, pb[1] - 0.8 * k, 0], [pb[0] + 1.6 * k, pb[1] - 0.8 * k, 0], [pb[0] + 2 * k, pb[1] + 1.4 * k, 0.3], [pb[0] - 1.6 * k, pb[1] + 1.4 * k, 0.3]], 0.4), { z: 16 * k, R: 0.8, H: 1, id: ID.FOOT, tex: M.furD });
    for (let i = 0; i < 3; i++) claw(BR, [pb[0] + (1.4 - i * 0.2) * k, pb[1] + (0.2 + i * 0.4) * k], 0.5, 1.5 * k, 0.8 * k, 0.7, 17 * k, ID.CLAW, M.claw);
  }
  sk.np();
  BR.emit({ drop: 1.4 * k, seam: 0.6, seamDark: 0.32, ao: 0.06, aoR: 2 });
  const e = drawEye(sk, fc[0] + 0.6 * k, fc[1] - 0.6 * k, { ...EYE, r: 1 }, eye);
  return { head: [fc[0], -ry * 2 - 2] as V2, eye: e };
}

export const QUILLHOG: SpeciesDef = {
  name: 'Quillhog', kind: 'mammal', len: 36, height: 22,
  anims: ANIMS,
  canvas: () => ({ w: 64, h: 50, ox: 30, oy: 40 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'threat' || anim === 'quills' ? 'angry' : 'open'),
};
