// V9 small island life, drawn with the beast sketch core (all face right; anchors noted per kind):
//  - amber snail, healthy or carrying the puppeteer fluke (one eye stalk swollen into a fat banded,
//    throbbing tube that birds mistake for a caterpillar); anchor = foot on the surface
//  - tin-can hermit: a hermit crab living in Kittiwake rubbish (a dog-food tin, a bottle cap, a jar
//    lid), walking or withdrawn; anchor = ground
//  - periscope sand eel: a slender eel standing out of its hole in the wet sand; anchor = the hole
//  - wrack pile (kelp, sea lettuce, a feather) and the tiny sand hoppers that live under it
//  - leaf-veil mantis: a mantis whose thorax and legs are flattened into leaves; anchor = its twig
//  - lantern moth: pale moth with two glow spots; anchor = body centre
//  - mudskip goby: a perching goby with a blue-and-orange sail fin; anchor = ground
//  - jewel beetle: metallic green-gold; anchor = body centre

import { PixelBuffer } from '../../pixel';
import { Sk, rmp, hh, SpeciesDef, V2 } from '../../beasts-core';
import { hex } from '../../color';
import type { Sprite } from './rocks';
import { Field, strip, spline } from './contour';
import type { LP } from './contour';

const cut = (sk: Sk, rim = 0.12, outline = true): Sprite => {
  const b = sk.resolve({ rim, bounce: 0.06, outline });
  const t = b.trim(1);
  return { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
};

// ------------------------------------------------------------------ amber snail (+ puppeteer fluke)
// Painted from real land-snail anatomy on organic contours (./contour): a coiled shell built from a
// logarithmic spiral (each whorl a rounded tube, the sutures sunk between them, spiral chocolate bands
// that keep to their whorl, fine growth lines and two dark growth pauses across them, a glossy amber
// periostracum and a pale thickened lip round the aperture), the mantle collar bulging at the lip, and
// the head-foot: a long muscular foot with a pale pedal fringe along the sole, its skin netted into
// tubercles by fine grooves, two dark grooves running back from the eye stalks, the long upper
// tentacles (ommatophores) with their eyes at the swollen tips, the short lower tentacles and the
// lip. The fluke's snail has one eye stalk swollen into the parasite's broodsac: a fat, glistening
// tube ringed green, white and dark that throbs as the rings crawl up it.
/** the shell's spiral: centre, outer radius at the aperture, growth per turn (k units) */
const SH_B = Math.log(2.05) / (Math.PI * 2);
const SH_TH = 1.05; // screen angle of the aperture (down and forward)
const SH_SQ = 0.9;  // the coil seen a little from the side

/** f: crawl phase 0..3; pulse: fluke throb 0..3; withdrawn: tucked in the shell */
export function drawSnail(sk: Sk, f: number, infected: boolean, pulse: number, withdrawn: boolean, k = 1) {
  const big = k >= 2;
  const tiny = k < 1.5;
  const M = {
    shell: sk.m(rmp('#bc7020', { n: 8, dark: 0.72, light: 0.42, warm: 0.5, cool: 0.35, sat: 0.4 }), { edge: 1 }),
    shellL: sk.m(rmp('#d89848', { n: 7, dark: 0.62, light: 0.42, warm: 0.5 }), { edge: 1 }),
    band: sk.m(rmp('#4a1e0e', { n: 6, dark: 0.6, light: 0.45, warm: 0.3 }), { edge: 1 }),
    lip: sk.m(rmp('#f0dcb4', { n: 6, dark: 0.45, light: 0.4 }), { edge: 1 }),
    body: sk.m(rmp('#8e8270', { n: 7, dark: 0.62, light: 0.45, cool: 0.35 }), { edge: 1 }),
    bodyD: sk.m(rmp('#5e5448', { n: 6, dark: 0.55, light: 0.4, cool: 0.3 }), { edge: 1 }),
    sole: sk.m(rmp('#c4b8a2', { n: 6, dark: 0.5, light: 0.4 }), { edge: 1 }),
    mantle: sk.m(rmp('#a89a80', { n: 6, dark: 0.55, light: 0.45 }), { edge: 1 }),
    eye: sk.m(rmp('#1a1614', { n: 3, dark: 0.4, light: 0.6 }), { edge: 0, noRim: true }),
    g1: sk.m(rmp('#4aa83a', { n: 6, dark: 0.6, light: 0.5, warm: 0.3 }), { edge: 1 }),
    g2: sk.m(rmp('#eef0b8', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    g3: sk.m(rmp('#1e4a1a', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
  };
  const st = withdrawn ? 0 : [0, 0.6, 1, 0.5][f % 4];
  const K = (x: number, y: number): V2 => [x * k, y * k];

  // ---------------------------------------------------------------- the head-foot
  if (!withdrawn) {
    const s = st;
    // the foot is one contour: the tail, the hidden back under the shell, the neck rising to the head,
    // the snout and lip, the chin, then the sole with its pedal waves running back to the tail
    const wave = (x: number) => (big ? Math.max(0, Math.sin(x * 1.3 - f * 1.6)) * 0.12 : 0);
    const L: LP[] = [
      [-5.7 - s * 0.15, -0.28], [-4.7, -0.95], [-3.2, -1.38], [-1.0, -1.75], [1.6, -1.85],
      [3.2 + s * 0.5, -2.15], [4.5 + s, -2.75], [5.45 + s, -3.0], [6.3 + s, -2.55], [6.62 + s, -1.6],
      [6.35 + s, -0.75], [5.4 + s, -0.12], [3.6, wave(3.6)], [1.2, wave(1.2)], [-1.6, wave(-1.6)], [-4.2, -0.04],
    ];
    const C = spline(L.map(q => [q[0] * k, q[1] * k] as LP), true, tiny ? 3 : 6);
    sk.np();
    const F = new Field(sk, [C], { round: 1.1 * k, dome: 0.4 * k });
    // dorsal grooves from the tentacles back along the neck
    const gr = [spline([K(5.0 + s, -2.85), K(3.9 + s * 0.6, -2.45), K(2.6, -2.0)], false, 4), spline([K(5.5 + s, -2.6), K(4.4 + s * 0.6, -2.2), K(3.0, -1.75)], false, 4)];
    if (!tiny) for (const g of gr) F.groove(g, Math.max(0.45, 0.1 * k), -0.3 * k);
    // the sole's pedal groove
    if (!tiny) F.groove(spline([K(-4.4, -0.42), K(0, -0.45), K(4.6 + s, -0.48), K(5.6 + s, -0.4)], false, 5), Math.max(0.45, 0.09 * k), -0.25 * k);
    // tubercles: a net of fine grooves (cells elongated along the foot, leaning forward)
    if (big) F.add((x, y) => {
      const u = x * 0.55 + y * 0.35, v = y * 0.95 - x * 0.12;
      const cs = 1.15;
      const gu = Math.floor(u / cs), gv = Math.floor(v / (cs * 0.8));
      let best = 9, sec = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cu = (gu + i + 0.5 + (hh(gu + i, gv + j, 81) - 0.5) * 0.7) * cs, cv = (gv + j + 0.5 + (hh(gv + j, gu + i, 82) - 0.5) * 0.7) * cs * 0.8;
        const d = Math.hypot(u - cu, (v - cv) * 1.2);
        if (d < best) { sec = best; best = d; } else if (d < sec) sec = d;
      }
      return sec - best < 0.22 ? -0.22 : (sec - best) * 0.12;
    });
    const solY = -0.5 * k;
    F.emit((p) => {
      // the pale pedal fringe along the sole, finely striated
      if (p.y > solY) { if (big && Math.floor(p.x) % 2 === 0) p.l -= 0.08; return M.sole; }
      // the head and the dorsal stripe darker, the flanks translucent grey-amber
      if (p.y < -2.0 * k && p.x > 3.6 * k) return p.nz > 0.85 ? M.body : M.bodyD;
      if (big && hh(p.x * 0.8, p.y * 0.8, 85) < 0.06) p.l += 0.15;
      return M.body;
    }, { z: 0, spec: big ? 0.65 : 0.3, specPow: 16 });

    // tentacles: the upper pair carry the eyes at their tips, the lower pair are short feelers
    const hx = 5.4 + s, hy = -2.95;
    const tent = (path: V2[], w0: number, w1: number, z: number, bias: number, eye: boolean) => {
      sk.np();
      const P2 = spline(path.map(q => [q[0] * k, q[1] * k] as LP), false, 4);
      if (tiny) {
        for (let i = 1; i < P2.length; i++) sk.line(P2[i - 1][0], P2[i - 1][1], P2[i][0], P2[i][1], M.body, 0.5 + bias, z, false);
      } else {
        const c = strip(P2, t => (w0 + (w1 - w0) * t + (eye && t > 0.85 ? 0.12 : 0)) * k, t => (w0 + (w1 - w0) * t + (eye && t > 0.85 ? 0.12 : 0)) * k, { capA: 0.5, capB: 1 });
        const T = new Field(sk, [c], { round: 0.3 * k, dome: 0.05 * k });
        if (big) T.add((x, y) => (Math.sin((x * 0.5 - y * 1.6) * 2.2) > 0.85 ? -0.12 : 0));
        T.emit((p) => (p.nz < 0.6 ? M.bodyD : M.body), { z, bias, spec: 0.6 });
      }
      if (eye) {
        const e = P2[P2.length - 1];
        const d = P2[P2.length - 3] ?? P2[0];
        const ex = e[0] - (e[0] - d[0]) * 0.15, ey = e[1] - (e[1] - d[1]) * 0.15;
        sk.over(Math.floor(ex), Math.floor(ey), hex('#141010'));
        if (big) { sk.over(Math.floor(ex) + 1, Math.floor(ey), hex('#2a2420')); sk.over(Math.floor(ex), Math.floor(ey) - 1, hex('#e8e0d0', 200)); }
      }
    };
    // the far upper tentacle, then the near one (or the fluke's broodsac)
    tent([[hx - 0.3, hy + 0.1], [hx + 0.1, hy - 1.8], [hx + 0.55, hy - 3.4]], 0.24, 0.17, -2 * k, -0.2, true);
    tent([[hx + 0.75, hy + 1.3], [hx + 1.35, hy + 1.55], [hx + 1.8, hy + 1.95]], 0.2, 0.12, 2 * k, 0, false);
    if (infected) {
      // the broodsac: a fat glistening tube that has swallowed the eye stalk, ringed, its rings crawling
      const ph = pulse * 0.25;
      const sw = 1 + [0, 0.12, 0.22, 0.1][pulse % 4];
      const path = spline([K(hx + 0.1, hy + 0.2), K(hx + 0.9, hy - 1.6), K(hx + 1.7, hy - 3.6), K(hx + 1.9, hy - 5.3)], false, 6);
      const w = (t: number) => {
        const body = t < 0.12 ? 0.3 + t * 3 : Math.min(1.05, 0.62 + Math.sin(Math.min(1, (t - 0.08) / 0.9) * Math.PI) * 0.5);
        const ring = big ? 1 - 0.13 * Math.max(0, Math.cos((t * 3.4 - ph) * Math.PI * 2)) ** 6 : 1;
        return body * ring * (t > 0.2 ? sw : 1) * k;
      };
      sk.np();
      const SF = new Field(sk, [strip(path, w, w, { capA: 0.6, capB: 1 })], { round: 0.7 * k, dome: 0.3 * k });
      const pl = path.length;
      SF.emit((p) => {
        // where along the sac: nearest path point
        let bi = 0, bd = Infinity;
        for (let i = 0; i < pl; i += 2) { const d = (p.x - path[i][0]) ** 2 + (p.y - path[i][1]) ** 2; if (d < bd) { bd = d; bi = i; } }
        const t = bi / (pl - 1);
        if (t < 0.14) return M.body;
        // the bands: dark green rings, bright green, then a white band, crawling up with the pulse
        const q = ((t * 3.4 - ph + 0.5) % 1 + 1) % 1;
        if (t > 0.88) { if (big && hh(p.x, p.y, 91) < 0.35) return M.g3; return M.g1; }
        if (q < 0.2) return M.g3;
        if (q < 0.45) { if (big && hh(p.x * 1.2, p.y * 1.2, 92) < 0.14) return M.g3; return M.g1; }
        if (q < 0.8) { if (big && hh(p.x * 1.3, p.y * 1.3, 93) < 0.08) return M.g1; return M.g2; }
        return M.g1;
      }, { z: 3 * k, spec: 1.1, specPow: 14 });
      // its dark tip spot, where the snail's own eye used to be
      const e = path[path.length - 1];
      sk.over(Math.floor(e[0] + 0.3 * k), Math.floor(e[1] - 0.2 * k), hex('#0e1a0c'));
    } else {
      tent([[hx + 0.2, hy + 0.15], [hx + 0.75, hy - 1.75], [hx + 1.25, hy - 3.55]], 0.27, 0.19, 3 * k, 0, true);
    }
    tent([[hx + 0.8, hy + 1.45], [hx + 1.45, hy + 1.75], [hx + 1.95, hy + 2.25]], 0.22, 0.13, 3.2 * k, 0, false);
  }

  // ---------------------------------------------------------------- the shell
  // a logarithmic spiral seen a little from the side: the coil's apex is pulled up and back (Dv), so
  // the whorls crowd into a low spire at the top-back and open into the broad body whorl at the front
  const cx = -0.4 * k, cy = (withdrawn ? -3.55 : -4.5) * k, R = 4.2 * k;
  const Dx = -0.26, Dy = -0.4;
  const pol = (r: number, th: number): V2 => [cx + R * Dx + r * (Math.cos(th) - Dx), cy + R * Dy + r * (Math.sin(th) * SH_SQ - Dy)];
  const outline: V2[] = [];
  const N = tiny ? 40 : 96;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; outline.push(pol(R * Math.exp(-SH_B * a), SH_TH + a)); }
  const rIn = R * Math.exp(-SH_B * Math.PI * 2);
  for (let i = 1; i < 10; i++) { const t = i / 10; outline.push(pol(rIn + (R - rIn) * t, SH_TH - 0.16 * Math.sin(t * Math.PI) - 0.02)); }
  // spiral coordinates of a point: which whorl (j), how far across it (f: 0 inner suture .. 1 outer
  // edge), the whorl's width in px, and the spiral angle back from the aperture (a)
  const spiral = (x: number, y: number) => {
    const wx = x - cx - R * Dx, wy = y - cy - R * Dy;
    const ang = Math.atan2(wy, wx);
    let th = ang;
    for (let it = 0; it < 7; it++) {
      const gx = Math.cos(th) - Dx, gy = Math.sin(th) * SH_SQ - Dy;
      let d = ang - Math.atan2(gy, gx);
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      th += d * 0.9;
    }
    const gl = Math.hypot(Math.cos(th) - Dx, Math.sin(th) * SH_SQ - Dy);
    const r = Math.max(1e-3, Math.hypot(wx, wy) / gl);
    let a = th - SH_TH;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const turns = (Math.log(R / r) / SH_B - a) / (Math.PI * 2);
    const j = Math.floor(turns);
    const f = 1 - (turns - j);
    const ew = R * Math.exp(-SH_B * (a + Math.PI * 2 * Math.max(0, j))) * (1 - Math.exp(-SH_B * Math.PI * 2)) * gl;
    return { a, j, f, r, ew };
  };
  sk.np();
  const S = new Field(sk, [outline], {
    hf: (x, y, d) => {
      const { j, f: fw, r, ew } = spiral(x, y);
      if (j < 0) return Math.min(d, 1.2 * k) * 0.8 + R * 0.05; // the lip / aperture zone
      // each whorl a rounded tube, fuller toward its outer side; the spire raised toward the apex
      let h = ew * 0.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, fw * 0.9 + 0.06))), 0.55);
      h += (1 - r / R) * R * 0.3;
      return h;
    },
  });
  // growth lines across the whorls (about every 2.5 px, following the spiral angle) and one growth
  // pause, as relief so each line catches the light on one side
  if (!tiny) S.add((x, y) => {
    const { a, j, r, ew } = spiral(x, y);
    if (j < 0 || ew < 4) return 0;
    const lines = (a * r) / (big ? 2.4 : 2.0) + Math.sin(a * 3 + j) * 0.4;
    let o = (lines % 1) < 0.34 ? -0.1 * k : 0;
    if (big && j === 0 && Math.abs(a - 3.2) < 0.05) o -= 0.25 * k;
    return o;
  });
  S.emit((p) => {
    const { a, j, f: fw, ew } = spiral(p.x, p.y);
    // the thickened pale lip, flaring a little past the body whorl
    if (j < 0) return M.lip;
    // the suture: a dark seam where each whorl laps over the one inside it
    const px = fw * ew; // px from the inner suture
    if (px < (tiny ? 0.7 : 0.85)) { p.l -= 0.3; return M.band; }
    // spiral chocolate bands that keep to their whorl: a broad one below the periphery, a fine one above
    const wob = big ? Math.sin(a * 5 + j) * 0.03 : 0;
    const bw = Math.max(tiny ? 0.5 : 0.75, ew * 0.11);
    if (Math.abs((fw - 0.64 - wob) * ew) < bw && ew > 3.4) { if (big && hh(p.x * 0.6, p.y * 0.6, 95) < 0.1) p.l += 0.12; return M.band; }
    if (big && Math.abs((fw - 0.33 - wob) * ew) < 0.5 && ew > 6) return M.band;
    // translucent amber, paler toward the young lip and on the worn apex
    if (j >= 2 && ew > 2.5) return M.shellL;
    if (j === 0 && a > Math.PI * 1.6 && ew > 4) return M.shellL;
    if (big && hh(p.x * 0.5, p.y * 0.5, 96) < 0.08) p.l += 0.08;
    return M.shell;
  }, { z: 4 * k, zk: 0.7, spec: big ? 1.0 : 0.6, specPow: 22 });
  // the mantle collar: a fleshy roll where the body leaves the shell, along the shell's lower margin
  if (!withdrawn && !tiny) {
    const path: V2[] = [];
    for (let i = 0; i <= 8; i++) {
      const th = 0.75 + (i / 8) * 1.3;
      const aa = ((th - SH_TH) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      path.push(pol(R * Math.exp(-SH_B * aa) * 0.97, th));
    }
    sk.np();
    const c = strip(path, t => (0.5 - Math.abs(t - 0.4) * 0.4) * k, t => (0.42 - Math.abs(t - 0.4) * 0.3) * k, { capA: 1, capB: 1 });
    new Field(sk, [c], { round: 0.4 * k, dome: 0.15 * k }).emit((p) => {
      if (big && hh(p.x, p.y, 97) < 0.18) p.l -= 0.14;
      return M.mantle;
    }, { z: 2 * k, spec: 0.5 });
  }
}

// ------------------------------------------------------------------ tin-can hermit
export type HermitHome = 'can' | 'cap' | 'jar';
export function drawHermit(sk: Sk, home: HermitHome, f: number, withdrawn: boolean) {
  const tin = sk.m(rmp('#a8b0b4', { n: 5, dark: 0.55, light: 0.55 }), { edge: 1 });
  const label = sk.m(rmp('#c8301e', { n: 4, dark: 0.55, light: 0.35 }), { edge: 1 });
  const labelY = sk.m(rmp('#f0c030', { n: 3, dark: 0.45, light: 0.35 }), { edge: 1 });
  const rust = sk.m(rmp('#8a4a22', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const cap = sk.m(rmp('#2a7ac8', { n: 4, dark: 0.55, light: 0.45 }), { edge: 1 });
  const glass = sk.m(rmp('#bfe0d0', { n: 3, dark: 0.3, light: 0.5 }), { edge: 1, k: 0.6 });
  const crab = sk.m(rmp('#e07a4a', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const dark = sk.m(rmp('#141014', { n: 2 }), { edge: 0, noRim: true });
  const big = home === 'can';
  // the "shell": the can lies on its side with the open end facing forward (right)
  sk.np();
  if (home === 'can') {
    sk.ell(-2.5, -4.2, 5.4, 3.9, (p) => (p.u > 0.8 ? tin : Math.abs(p.v) < 0.45 ? (p.u > -0.1 && p.u < 0.35 ? labelY : label) : p.u < -0.85 ? rust : tin), { z: 0, rz: 3, flat: 0.6 });
    sk.np();
    sk.ell(2.6, -4.2, 1.3, 3.6, (p) => (Math.hypot(p.u, p.v) < 0.62 ? dark : tin), { z: 2, rz: 0.8 });
  } else if (home === 'cap') {
    sk.ell(-0.6, -2.4, 3.2, 2.3, (p) => (Math.abs(((p.u + 1) * 5) % 1 - 0.5) > 0.38 ? tin : cap), { z: 0, rz: 2 });
  } else {
    sk.ell(-1.6, -3.4, 4.2, 3.2, (p) => (p.v < -0.6 ? tin : glass), { z: 0, rz: 2.6 });
    sk.np();
    sk.ell(1.2, -2, 2, 1.4, crab, { z: 1 });
  }
  if (withdrawn) {
    // a claw plugging the doorway, an eye stalk peeking
    sk.np();
    sk.ell(big ? 2.8 : 1.6, big ? -3.2 : -1.6, 1.2, 1.4, crab, { z: 4 });
    sk.over(big ? 3 : 2, big ? -5 : -3, hex('#101010'));
    return;
  }
  const ox = big ? 3 : 1.6, oy = big ? -2.6 : -1.4;
  // legs walking out of the doorway, big right claw, eye stalks
  for (let i = 0; i < 3; i++) {
    const ph = (f + i * 1.3) % 4;
    const lx = ox + 0.5 + i * 1.6 + (ph < 2 ? ph * 0.5 : (4 - ph) * 0.5), ly = 0;
    sk.np();
    sk.tube([[ox + i * 0.6, oy + 0.6], [lx - 0.6, oy - 1.4 + (ph < 2 ? -0.6 : 0)], [lx, ly]], 0.45, crab, { z: 3 + i * 0.1 });
  }
  sk.np();
  sk.ell(ox + 2.8, oy - 1.2, 1.6, 1.15, crab, { z: 5, rot: -0.3 });
  sk.np();
  sk.tube([[ox + 0.8, oy - 1.6], [ox + 1.3, oy - 4]], 0.32, crab, { z: 5 });
  sk.over(Math.floor(ox + 1.3), Math.floor(oy - 4.4), hex('#101010'));
  sk.np();
  sk.tube([[ox + 1.5, oy - 1.4], [ox + 2.6, oy - 3.6]], 0.3, crab, { z: 5 });
  sk.over(Math.floor(ox + 2.7), Math.floor(oy - 4), hex('#101010'));
}

// ------------------------------------------------------------------ periscope sand eel
/** h: 0..1 how far out of the hole; sway: -1..1; mouth: 0/1 (snapping plankton) */
export function drawEel(sk: Sk, h: number, sway: number, mouth: number) {
  const skin = sk.m(rmp('#d8d0b0', { n: 4, dark: 0.55, light: 0.45 }), { edge: 1 });
  const spot = sk.m(rmp('#3a3a2a', { n: 3, dark: 0.5 }), { edge: 1 });
  const L = 2 + h * 11;
  const pts: V2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 2.2) * sway * 2.2 * t, -t * L]); }
  sk.np();
  sk.tube(pts, t => 0.85 - t * 0.12, (p) => (((p.t * L) % 2.6) < 0.8 ? spot : skin), { z: 0 });
  const tip = pts[pts.length - 1];
  sk.np();
  sk.ell(tip[0] + 0.6, tip[1] - 0.2, 1.1, 0.9, skin, { z: 1 });
  sk.over(Math.floor(tip[0] + 0.6), Math.floor(tip[1] - 0.8), hex('#101010'));
  if (mouth) sk.over(Math.floor(tip[0] + 1.8), Math.floor(tip[1]), hex('#401818'));
}

// ------------------------------------------------------------------ wrack pile and hoppers
export function wrackPile(seed: number): Sprite {
  const sk = new Sk(46, 14, 23, 11);
  const kelp = sk.m(rmp('#4a4a1e', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const kelp2 = sk.m(rmp('#6a5a24', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const lettuce = sk.m(rmp('#5a9a3a', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const feather = sk.m(rmp('#e8e4dc', { n: 3, dark: 0.3, light: 0.3 }), { edge: 1 });
  const shellM = sk.m(rmp('#d8b8a0', { n: 3, dark: 0.4, light: 0.3 }), { edge: 1 });
  for (let i = 0; i < 9; i++) {
    const x0 = (hh(i, seed, 1) - 0.5) * 34, len = 8 + hh(i, seed, 2) * 10, y = -1 - hh(i, seed, 3) * 4;
    sk.np();
    sk.tube([[x0, y], [x0 + len * 0.5, y - 1.5 + hh(i, seed, 4) * 2], [x0 + len, y + 0.5]], t => 1.1 - t * 0.4, i % 3 === 1 ? kelp2 : kelp, { z: i * 0.2 });
  }
  for (let i = 0; i < 3; i++) { sk.np(); sk.ell((hh(i, seed, 6) - 0.5) * 26, -2.5, 3, 1.6, lettuce, { z: 3, rz: 1 }); }
  sk.np();
  sk.blade(4, -3, 14, -5, s => Math.sin(s * Math.PI) * 1.2 + 0.2, feather, { z0: 4, z1: 4 });
  sk.np();
  sk.ell(-12, -1.6, 1.6, 1.2, shellM, { z: 4 });
  return cut(sk, 0.08);
}
export function hopper(f: number): Sprite {
  const sk = new Sk(8, 6, 4, 4);
  const m = sk.m(rmp('#c8b490', { n: 3, dark: 0.45, light: 0.4 }), { edge: 1 });
  sk.np();
  sk.ell(0, -1, 1.5, 0.9, m, { rot: f ? -0.5 : 0.2 });
  sk.line(-1, 0, f ? -2.5 : -1.8, f ? -1.6 : 0.8, m, 0.4, 1, true);
  return cut(sk, 0.1);
}

// ------------------------------------------------------------------ leaf-veil mantis
export function drawMantis(sk: Sk, f: number, strike: boolean) {
  const leaf = sk.m(rmp('#6aa83a', { n: 5, dark: 0.6, light: 0.4 }), { edge: 1 });
  const vein = sk.m(rmp('#3e6a22', { n: 3, dark: 0.5 }), { edge: 1 });
  const dry = sk.m(rmp('#a8843a', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const twig = sk.m(rmp('#5a3e26', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const eye = sk.m(rmp('#d8e870', { n: 3, dark: 0.4 }), { edge: 0 });
  sk.np();
  sk.tube([[-10, 1], [10, 1.5]], 0.7, twig, { z: -2 });
  const sway = [0, 0.5, 0, -0.5][f % 4];
  // the abdomen: a broad leaf with a midrib and a browned, ragged edge
  sk.np();
  sk.blade(-1 + sway * 0.4, -1.5, -9 + sway, -4.5, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.6 + 0.3, (p) => (Math.abs(p.v) < 0.16 ? vein : p.t > 0.86 || (Math.abs(p.v) > 0.82 && hh(p.x, p.y, 3) < 0.4) ? dry : leaf), { z0: 0, z1: 0, curl: 0.5 });
  // walking legs gripping the twig
  for (const x of [-2, 0.5]) sk.line(x, -1.2, x + 1, 1, leaf, 0.35, 1, true);
  // the thorax, flared into a second little leaf, rising to the head
  sk.np();
  sk.blade(0, -1.6, 3 + sway * 0.3, -7, s => Math.sin(s * Math.PI) * 1.4 + 0.4, (p) => (Math.abs(p.v) < 0.2 ? vein : leaf), { z0: 1, z1: 1 });
  sk.np();
  sk.ell(3.4 + sway * 0.3, -7.8, 1.2, 1, leaf, { z: 2 });
  sk.np();
  sk.ell(4.1 + sway * 0.3, -8.2, 0.55, 0.55, eye, { z: 3 });
  // raptorial forelegs: folded in prayer, or shot out to grab a fly
  sk.np();
  if (strike) sk.tube([[3, -5.5], [6.5, -6.5], [9.5, -5.8]], 0.5, leaf, { z: 4 });
  else sk.tube([[3, -5.5], [5, -3.8], [4.2, -5.6]], 0.55, leaf, { z: 4 });
}

// ------------------------------------------------------------------ lantern moth
export function drawMoth(sk: Sk, f: number) {
  const w1 = sk.m(rmp('#a8987a', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 });
  const w2 = sk.m(rmp('#5e4c3a', { n: 3, dark: 0.45 }), { edge: 1 });
  const spot = sk.m(rmp('#f8f0a0', { n: 3, dark: 0.15, light: 0.6 }), { edge: 0, noRim: true });
  const body = sk.m(rmp('#c8b890', { n: 3, dark: 0.5 }), { edge: 1 });
  const a = [-2.5, -1.6, -0.6, -1.6][f % 4];
  const wf = (p: { t: number; v: number; x: number; y: number }) => (Math.abs(p.t - 0.58) < 0.14 && Math.abs(p.v) < 0.4 ? spot : p.t > 0.82 || hh(p.x, p.y, 9) < 0.18 ? w2 : w1);
  sk.np(); sk.blade(0, -0.5, Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.7 + 0.3, wf, { z0: -2, z1: -2 });
  sk.np(); sk.ell(0, 0, 3, 1.25, body, { z: 0 });
  sk.np(); sk.blade(0, -0.5, Math.cos(a) * 6.6, Math.sin(a) * 6.6 + 1, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.9 + 0.3, wf, { z0: 3, z1: 3 });
  sk.over(3, -1, hex('#e8dcc0')); sk.over(4, -2, hex('#e8dcc0'));
}

// ------------------------------------------------------------------ mudskip goby
/** pose: 0 resting, 1 sail fin up (display), 2 mid-skip */
export function drawGoby(sk: Sk, pose: number, f: number) {
  const skin = sk.m(rmp('#8a8a5a', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const belly = sk.m(rmp('#d8d0a8', { n: 3, dark: 0.4 }), { edge: 1 });
  const fin = sk.m(rmp('#3a7ae0', { n: 4, dark: 0.5, light: 0.45 }), { edge: 1 });
  const finE = sk.m(rmp('#f08a2a', { n: 3, dark: 0.5, light: 0.4 }), { edge: 1 });
  const spot = sk.m(rmp('#2a5ac8', { n: 3, dark: 0.4 }), { edge: 1, noRim: true });
  const curl = pose === 2 ? 0.9 : 0;
  sk.np();
  sk.tube([[-5, -1.2 - curl * 2], [-2, -1.6 - curl], [1.5, -1.8], [4, -2]], t => 0.7 + Math.sin(t * Math.PI * 0.9) * 1, (p) => (p.v > 0.5 ? belly : hh(p.x * 2, p.y * 2, 4) < 0.12 ? spot : skin), { z: 0 });
  // pectoral "crutch" fins it walks on
  sk.np();
  sk.blade(1.5, -0.8, 2.6 + (f % 2) * 0.6, 0, s => (1 - s) * 0.8 + 0.3, skin, { z0: 2, z1: 2 });
  // the sail: up in display, folded otherwise
  sk.np();
  const fh = pose === 1 ? 4.5 : 1.3;
  sk.blade(-2.6, -2.6, 0.8, -2.8 - fh, s => (1 - s * 0.6) * 1.6 + 0.2, (p) => (p.t > 0.7 || Math.abs(p.v) > 0.82 ? finE : fin), { z0: -1, z1: -1, bend: 1 });
  // bulging eyes on top of the head
  sk.np();
  sk.ell(3.2, -3.4, 0.9, 0.9, skin, { z: 3 });
  sk.over(3, -4, hex('#101010')); sk.over(4, -4, hex('#e8e0b0'));
}

// ------------------------------------------------------------------ jewel beetle
export function drawBeetle(sk: Sk, f: number, flying: boolean) {
  const sh = sk.m(rmp('#2aa848', { n: 5, dark: 0.6, light: 0.5, warm: 0.5 }), { edge: 1 });
  const gold = sk.m(rmp('#e8c03a', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const leg = sk.m(rmp('#1a2a1a', { n: 2 }), { edge: 0 });
  if (flying) { const a = f ? -2.2 : -1.2; sk.np(); sk.blade(-0.5, -1.2, -0.5 + Math.cos(a) * 3.6, -1.2 + Math.sin(a) * 3.6, s => Math.sin(s * Math.PI) * 1 + 0.2, sk.m(rmp('#d8e0e8', { n: 2 }), { edge: 0, k: 0.3 }), { z0: -1, z1: -1 }); }
  sk.np();
  sk.ell(-0.4, -1, 2.3, 1.5, (p) => (p.u < -0.6 || (p.v < -0.3 && Math.abs(p.u) < 0.3) ? gold : sh), { z: 0, rz: 1.4 });
  sk.np();
  sk.ell(2, -1, 0.9, 0.85, sh, { z: 1 });
  if (!flying) for (let i = 0; i < 3; i++) sk.line(-1.2 + i * 1.1, 0, -1.6 + i * 1.1 + (f + i) % 2 * 0.6, 1, leg, 0.3, 2, true);
  sk.over(-1, -2, hex('#f8ffd0'));
}

// ------------------------------------------------------------------ frame bakes
type Painter = (sk: Sk) => void;
const cache = new Map<string, Sprite>();
export function bake(key: string, w: number, h: number, ox: number, oy: number, fn: Painter, rim = 0.12, outline = true): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const sk = new Sk(w, h, ox, oy);
  fn(sk);
  const s = cut(sk, rim, outline);
  cache.set(key, s);
  return s;
}

export const CRIT = {
  snail: (f: number, infected: boolean, pulse: number, withdrawn: boolean) => bake(`snail${f}${infected ? 1 : 0}${pulse}${withdrawn ? 1 : 0}`, 22, 18, 9, 14, sk => drawSnail(sk, f, infected, pulse, withdrawn)),
  hermit: (home: HermitHome, f: number, withdrawn: boolean) => bake(`hermit${home}${f}${withdrawn ? 1 : 0}`, 26, 16, 11, 13, sk => drawHermit(sk, home, f, withdrawn)),
  eel: (h: number, sway: number, mouth: number) => bake(`eel${h}${sway}${mouth}`, 14, 20, 6, 17, sk => drawEel(sk, h / 3, sway - 1, mouth)),
  mantis: (f: number, strike: boolean) => bake(`mantis${f}${strike ? 1 : 0}`, 26, 16, 13, 12, sk => drawMantis(sk, f, strike)),
  moth: (f: number) => bake(`moth${f}`, 20, 18, 10, 10, sk => drawMoth(sk, f)),
  goby: (pose: number, f: number) => bake(`goby${pose}${f}`, 18, 14, 9, 11, sk => drawGoby(sk, pose, f)),
  beetle: (f: number, flying: boolean) => bake(`beetle${f}${flying ? 1 : 0}`, 12, 10, 6, 6, sk => drawBeetle(sk, f, flying)),
};

// ------------------------------------------------------------------ field-guide portraits (registered beasts)
const one = (name: string, kind: SpeciesDef['kind'], len: number, height: number, w: number, h: number, ox: number, oy: number, fn: (sk: Sk, f: number) => void, frames = 1): SpeciesDef => ({
  name, kind, len, height, anims: { idle: { frames, fps: 3, loop: true } },
  canvas: () => ({ w, h, ox, oy }),
  draw(sk: Sk, _a: string, f: number) { fn(sk, f); return { head: [0, -4] as V2, eye: [0, -4] as V2 }; },
});
export const CRITTER_DEFS: Record<string, SpeciesDef> = {
  ambersnail: one('Amber Snail', 'mollusc', 12, 9, 50, 40, 22, 32, sk => drawSnail(sk, 2, false, 0, false, 3.1)),
  puppetfluke: one('Puppeteer Fluke', 'other', 12, 12, 50, 44, 22, 34, sk => drawSnail(sk, 2, true, 2, false, 3.0)),
  canhermit: one('Tin-can Hermit', 'crustacean', 14, 9, 30, 20, 13, 16, sk => drawHermit(sk, 'can', 1, false)),
  periscopeeel: one('Periscope Sand Eel', 'fish', 3, 14, 18, 22, 7, 19, sk => drawEel(sk, 1, 0.3, 1)),
  wrackhopper: one('Wrack Hopper', 'crustacean', 3, 2, 10, 8, 5, 5, sk => { const m = sk.m(rmp('#c8b490', { n: 3, dark: 0.45, light: 0.4 }), { edge: 1 }); sk.ell(0, -1, 2.2, 1.3, m, { rot: -0.3 }); sk.line(-1.5, 0, -3, -2, m, 0.4, 1, true); sk.line(1.5, -1.8, 3, -3, m, 0.4, 1, true); }),
  leafmantis: one('Leaf-veil Mantis', 'insect', 18, 10, 30, 18, 15, 13, sk => drawMantis(sk, 0, false)),
  lanternmoth: one('Lantern Moth', 'insect', 12, 10, 22, 20, 11, 11, sk => drawMoth(sk, 1)),
  skipgoby: one('Mudskip Goby', 'fish', 10, 7, 20, 16, 10, 12, sk => drawGoby(sk, 1, 0)),
  jewelbeetle: one('Jewel Beetle', 'insect', 5, 3, 14, 12, 7, 7, sk => drawBeetle(sk, 0, false)),
};

export type { PixelBuffer };
