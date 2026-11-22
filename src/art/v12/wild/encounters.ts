// V12 the wild's encounters, the props (user: "in the wild more props and wildlife that's actually cool
// and unique you can interact with"). Each one is painted cluster by cluster: irregular silhouettes,
// form shading lit from the top left, texture, cracks and highlights (the scene side, the interactions
// and the animals: src/game/v12/wild/encounters.ts).
//   rottenLog    a big fallen trunk gone soft: bark peeling in strips off spongy orange wood, the oval
//                exit holes of huhu beetles, moss cushions, bracket fungi, a fern growing out of it;
//                rolled over, its underside: black and wet, white fungal threads, soil clinging
//   logBed       the dark wet hollow it lay in: flattened yellow grass at the edge, fungal threads,
//                slaters, worm tunnels (the huhu grubs are their own little sprites, to be taken)
//   hollowTree   an old rimu: scaly red-brown bark, a buttressed foot, moss and an epiphyte clump in a
//                fork, a knot hollow with a thick rolled lip; the lip again on its own, to sit in front
//                of whoever lives in it
//   overhang     a mossy rock bank with an undercut, dripping recess where glow-worms hang their lines;
//                its glow: the lights and the beaded threads under them
//   eelPool      a deep hole in the creek bed: an undercut fern bank (the eel's lair), dark water deep in
//                the middle, pebbles at the edges; the surface over it, see-through
//   geoField     a geothermal patch: white sinter crust, orange and green algae mats, a sulphur stain,
//                grey mud pots in their rings, and a clear turquoise hot pool

import { PixelBuffer } from '../../pixel';
import { hex, mix } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp } from '../../../core/math';

const R = (...h: string[]): C[] => h.map(v => hex(v));
const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
/** a ramp pick with an ordered dither between its steps */
const dp = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.85);
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
/** smooth value noise */
function vn(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h01(xi, yi, s), b = h01(xi + 1, yi, s), c = h01(xi, yi + 1, s), d = h01(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Cellular (Worley) noise on a jittered grid of cell size sx x sy: the nearest feature point, its
 * distance f1 and the second-nearest f2 (f2 - f1 small = the crack between two cells), a cell id
 * and the feature point itself. Irregular flakes of bark and blocks of rock, never a brick grid.
 */
function worley(x: number, y: number, sx: number, sy: number, s: number) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let f1 = 1e9, f2 = 1e9, id = 0, fx = 0, fy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = (cx + 0.15 + h01(cx, cy, s) * 0.7) * sx, py = (cy + 0.15 + h01(cx, cy, s + 1) * 0.7) * sy;
    const d = Math.hypot((x - px) / sx, (y - py) / sy);
    if (d < f1) { f2 = f1; f1 = d; id = h01(cx, cy, s + 2); fx = px; fy = py; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id, fx, fy };
}

const INK = hex('#120a06');
export const WP = {
  bark: R('#140c08', '#24160e', '#3a2416', '#54361f', '#6e4a2c', '#8a603c'),
  rimu: R('#1a0a06', '#34160c', '#521f10', '#723016', '#8e4422', '#a85c34'),
  barkGrey: R('#1e1c18', '#34302a', '#4c463c', '#665e52', '#82786a', '#a09486'),
  rot: R('#2a1206', '#4e260e', '#764018', '#9a5e26', '#bc7e3a', '#d8a058'),
  wet: R('#0a0806', '#16110c', '#221a12', '#30241a', '#403022', '#52402c'),
  moss: R('#0e1a08', '#1c300e', '#2e4a14', '#46681c', '#64882a', '#86a83c'),
  mossY: R('#2a3008', '#46500e', '#667018', '#8a9426', '#aab43a', '#c8cc5a'),
  fern: R('#0a1806', '#14280c', '#204012', '#30581a', '#447224', '#5e9030'),
  fungus: R('#5a3a1a', '#8a5a2a', '#b8823a', '#d8a85a', '#ecc88a', '#f8e4b8'),
  soil: R('#0c0806', '#18100a', '#24180e', '#322216', '#44301e', '#5a4028'),
  grass: R('#3a3414', '#5a4e1e', '#7a6a2c', '#9a8840', '#b8a65a', '#d4c47a'),
  stone: R('#18181a', '#2a2a2c', '#3e3e40', '#545454', '#6c6a68', '#888480'),
  rock: R('#141612', '#22261e', '#32382a', '#444c38', '#5a6248', '#727a5c'),
  water: R('#020a0c', '#041418', '#082226', '#0e3236', '#18464a', '#2a6066'),
  sinter: R('#5a5446', '#8a8270', '#b4ac96', '#d4ccb4', '#e8e2ce', '#f8f4e6'),
  mud: R('#1e1a16', '#2e2822', '#423a32', '#585046', '#706658', '#8a806e'),
  hot: R('#0a3438', '#0e5258', '#147478', '#2a9a98', '#58c0b4', '#9ae0d0'),
  algaeO: R('#4a1a06', '#7a300c', '#a84a14', '#cc6a20', '#e48a32', '#f2aa4a'),
  algaeG: R('#1a3008', '#2e4a0e', '#486a16', '#6a8c22'),
  sulphur: R('#6a5a10', '#9a8418', '#c8ac28', '#e6cc44', '#f6e46a'),
  grub: R('#6a5440', '#a08868', '#d0bc98', '#ece0c4', '#fff6e2'),
  grubHead: R('#2a1206', '#5a2a0e', '#8a4a1a'),
  glow: R('#0a3a3a', '#2a8a86', '#6adcd0', '#c8fff4'),
};

// ------------------------------------------------------------------ the rotten log

/**
 * A fallen trunk lying along the ground (L long, D thick). `rolled`: turned over, the wet underside up.
 * Anchor: the middle of its bottom edge.
 */
export function rottenLog(seed: number, L = 80, D = 18, rolled = false): Sprite {
  const W = L + 16, H = D + 18;
  const b = new PixelBuffer(W, H);
  const rng = new Rng(seed * 7 + (rolled ? 3 : 0));
  const x0 = 8, x1 = x0 + L, base = H - 2;
  // the silhouette: the top edge sags and bulges along it (knots, a broken branch stub), the broken
  // end at the right splinters, the cut end at the left is a ring
  const topAt = (x: number) => base - D + Math.round(vn(x * 0.09, 0.5, seed) * 3 - 1.2 + (Math.abs(x - (x0 + L * 0.62)) < 4 ? -2 : 0));
  const rEnd = (y: number) => x1 - Math.round(h01(0, y, seed + 5) * 5 + (y % 3 === 0 ? 2 : 0));
  const endR = D / 2;
  for (let x = x0; x <= x1 + 1; x++) {
    const top = topAt(x);
    for (let y = top; y <= base; y++) {
      if (x > rEnd(y)) continue;
      const v = (y - top) / Math.max(1, base - top); // 0 top .. 1 underside
      // the round of the trunk: lit on top, deep under it
      let l = 3.6 - v * 2.6 + (v < 0.12 ? 0.6 : 0) - (v > 0.88 ? 0.8 : 0);
      let ramp = WP.bark;
      if (!rolled) {
        // the bark furrows run along the trunk; where the bark has fallen away the wood is soft and orange
        const furrow = Math.sin(y * 1.9 + vn(x * 0.15, y * 0.3, seed) * 3) > 0.55;
        const bare = vn(x * 0.06, y * 0.22, seed + 11) > 0.62 && v > 0.15 && v < 0.85;
        if (bare) {
          ramp = WP.rot;
          l += 0.4 - (h01(x, y, seed) > 0.9 ? 1.2 : 0);
          // the oval exit holes of huhu beetles, dark, a lit lip under each
          const hx = Math.floor(x / 6), hy = Math.floor(y / 5);
          if (h01(hx, hy, seed + 3) > 0.7 && (x % 6 === 2 || x % 6 === 3) && y % 5 === 2) { b.set(x, y, WP.rot[0]); continue; }
          if (h01(hx, hy, seed + 3) > 0.7 && (x % 6 === 2 || x % 6 === 3) && y % 5 === 3) l += 0.45;
        } else {
          if (furrow) l -= 1.1;
          if (h01(x, y, seed + 1) > 0.94) ramp = WP.barkGrey;
        }
      } else {
        // the underside, turned up: black and wet, soil caked on, the wood rotted to fibre
        ramp = v < 0.6 ? WP.wet : WP.bark;
        l = 3.4 - v * 2.2 + (Math.sin(x * 0.7 + y * 2.1) > 0.7 ? -0.8 : 0);
      }
      b.set(x, y, dp(ramp, l, x, y));
    }
  }
  // the cut end: an ellipse of rings, rotted out at the heart
  const ecx = x0 + 1, ecy = base - endR;
  for (let y = -endR; y <= endR; y++) for (let x = -4; x <= 3; x++) {
    const d = Math.hypot(x / 4, y / endR);
    if (d > 1) continue;
    const ring = Math.floor(d * 6);
    const c = d < 0.32 ? WP.rot[0] : d > 0.86 ? WP.bark[1] : dp(rolled ? WP.wet : WP.rot, 3.2 - (ring % 2) * 0.8 - y / endR * 0.6, ecx + x, ecy + y);
    b.set(ecx + x, Math.round(ecy + y), c);
  }
  if (!rolled) {
    // moss cushions along the top, lit on their tops, a darker underside where they overhang
    for (let x = x0 + 3; x < x1 - 4; x++) {
      const m = vn(x * 0.13, 1, seed + 7);
      if (m < 0.45) continue;
      const hgt = Math.round((m - 0.45) * 9);
      const top = topAt(x);
      for (let k = -hgt; k <= 1; k++) {
        const y = top + k;
        const yellow = vn(x * 0.3, 2, seed + 9) > 0.66;
        b.set(x, y, dp(yellow ? WP.mossY : WP.moss, 2.4 - k * 0.5 + (k === -hgt ? 1.3 : 0) + (h01(x, y, seed) > 0.85 ? 0.8 : 0), x, y));
      }
      if (h01(x, 7, seed) > 0.8) b.set(x, top - hgt - 1, WP.mossY[5]);
    }
    // bracket fungi on the side: little shelves, cream on top, ochre gills under
    for (let i = 0; i < 3; i++) {
      const fx = x0 + 14 + Math.round(rng.next() * (L - 30)), fy = base - Math.round(D * (0.35 + rng.next() * 0.25));
      const fw = 4 + Math.round(rng.next() * 3);
      for (let k = 0; k < fw; k++) { b.set(fx + k, fy, WP.fungus[k === 0 ? 3 : 5]); b.set(fx + k, fy + 1, WP.fungus[2]); }
      b.set(fx + 1, fy - 1, WP.fungus[4]); b.set(fx + fw - 1, fy + 1, WP.fungus[1]);
    }
    // a young fern growing out of the top
    const ferx = x0 + Math.round(L * 0.3), fery = topAt(ferx) - 1;
    for (const [ang, len] of [[-2.2, 9], [-1.6, 11], [-1.0, 9], [-2.6, 6], [-0.6, 6]] as [number, number][]) {
      for (let t = 0; t < len; t++) {
        const X = Math.round(ferx + Math.cos(ang) * t + (t * t) * 0.02 * Math.sign(Math.cos(ang))), Y = Math.round(fery + Math.sin(ang) * t + t * t * 0.03);
        b.set(X, Y, WP.fern[t < 2 ? 2 : 4]);
        if (t > 2 && t % 2 === 0) { b.set(X - 1, Y + 1, WP.fern[3]); b.set(X + 1, Y + 1, WP.fern[5]); }
      }
    }
    // the broken branch stub
    const sx = x0 + Math.round(L * 0.62), sy = topAt(sx);
    for (let k = 0; k < 4; k++) { b.set(sx - 1, sy - k, WP.bark[3]); b.set(sx, sy - k, WP.bark[4]); b.set(sx + 1, sy - k, WP.bark[2]); }
    b.set(sx, sy - 4, WP.rot[4]);
  } else {
    // white fungal threads across the wet wood, and soil crumbs clinging
    for (let i = 0; i < 14; i++) {
      let x = x0 + 4 + Math.round(rng.next() * (L - 8)), y = base - D + 3 + Math.round(rng.next() * (D * 0.4));
      for (let k = 0; k < 4; k++) { if (b.get(x, y)) b.set(x, y, k % 2 ? hex('#8a8678') : hex('#b4ae9c')); x += rng.next() < 0.5 ? 1 : -1; y += rng.next() < 0.4 ? 1 : 0; }
    }
    for (let i = 0; i < 20; i++) { const x = x0 + Math.round(rng.next() * L), y = base - D + 2 + Math.round(rng.next() * 6); if (b.get(x, y)) b.set(x, y, WP.soil[3 + (i % 2)]); }
  }
  b.outline(INK);
  return { buf: b, ax: Math.round(x0 + L / 2), ay: base };
}

/** the hollow where the log lay (W wide): wet black soil, flattened yellow grass, fungal threads, slaters */
export function logBed(seed: number, W = 84): Sprite {
  const H = 12, b = new PixelBuffer(W, H), rng = new Rng(seed * 3 + 1);
  const cx = W / 2, base = H - 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - cx) / (W / 2), ny = (y - (base - 4)) / 5;
    const d = nx * nx + ny * ny * 1.4 + (vn(x * 0.2, y * 0.4, seed) - 0.5) * 0.25;
    if (d > 1) continue;
    if (d > 0.78) { b.set(x, y, dp(WP.grass, 3.2 - (h01(x, y, seed) > 0.6 ? 1 : 0), x, y)); continue; }
    b.set(x, y, dp(WP.soil, 2.6 - d * 1.2 + (y < 4 ? -0.6 : 0) + (h01(x, y, seed + 1) > 0.9 ? 1.2 : 0), x, y));
  }
  // pale fungal threads, worm tunnels
  for (let i = 0; i < 9; i++) {
    let x = Math.round(cx - W * 0.35 + rng.next() * W * 0.7), y = 4 + Math.round(rng.next() * 5);
    for (let k = 0; k < 6; k++) { if (b.get(x, y)) b.set(x, y, k % 3 ? hex('#cfcab8') : hex('#ebe6d4')); x += rng.next() < 0.6 ? 1 : -1; if (rng.next() < 0.3) y += rng.next() < 0.5 ? 1 : -1; }
  }
  for (let i = 0; i < 4; i++) { const x = Math.round(cx - W * 0.3 + rng.next() * W * 0.6), y = 5 + Math.round(rng.next() * 4); b.set(x, y, WP.soil[0]); b.set(x + 1, y, WP.soil[0]); }
  // slaters: grey segmented ovals
  for (let i = 0; i < 3; i++) {
    const x = Math.round(cx - W * 0.25 + rng.next() * W * 0.5), y = 5 + Math.round(rng.next() * 4);
    b.set(x, y, hex('#6a6a70')); b.set(x + 1, y, hex('#8a8a92')); b.set(x + 2, y, hex('#6a6a70')); b.set(x + 1, y - 1, hex('#a8a8b0'));
  }
  return { buf: b, ax: Math.round(cx), ay: base };
}

/** a huhu grub: a fat cream C, segmented, a brown head (i varies the curl) */
export function huhuGrub(i: number): Sprite {
  const rows = i % 2
    ? ['.hh.....', 'hHgg....', '.gGGgg..', '..gGGGg.', '....gGg.', '.....gg.']
    : ['......hh', '....ggHh', '..ggGGg.', '.gGGGg..', '.gGg....', '.gg.....'];
  const b = new PixelBuffer(8, 6);
  rows.forEach((r, y) => { for (let x = 0; x < 8; x++) {
    const c = r[x];
    if (c === '.') continue;
    const seg = (x + y) % 2 === 0;
    b.set(x, y, c === 'h' ? WP.grubHead[1] : c === 'H' ? WP.grubHead[2] : c === 'G' ? WP.grub[seg ? 4 : 3] : WP.grub[seg ? 2 : 3]);
  } });
  b.outline(hex('#3a2a18'));
  return { buf: b, ax: 4, ay: 5 };
}

// ------------------------------------------------------------------ the old hollow tree

export const HOLLOW = { up: 54, w: 12, h: 11, perchUp: 34, perchLen: 18 };

/**
 * An old rimu running up out of frame: scaly red-brown bark, a flared buttressed foot, moss, an
 * epiphyte clump in the crook of a branch stub, a knot hollow HOLLOW.up above the ground.
 * Anchor: the middle of its foot.
 */
export function hollowTree(seed: number): Sprite {
  const W = 72, H = 240, b = new PixelBuffer(W, H), rng = new Rng(seed * 11 + 2);
  const cx = 36, base = H - 2, tw = 15; // half the trunk's width
  const halfAt = (y: number) => {
    const up = base - y;
    const flare = up < 26 ? (1 - up / 26) ** 2 * 13 : 0;
    return tw + flare + Math.sin(y * 0.05 + seed) * 0.8;
  };
  const lean = (y: number) => Math.round((base - y) * 0.025);
  for (let y = 0; y <= base; y++) {
    const hw = halfAt(y), c0 = cx + lean(y);
    for (let x = Math.floor(c0 - hw); x <= Math.ceil(c0 + hw); x++) {
      const u = (x - c0) / hw; // -1 left .. 1 right
      if (Math.abs(u) > 1) continue;
      // the round of the trunk lit from the left, the buttress roots as ridges near the foot
      let l = 3.3 - (u + 0.35) * 1.5 - Math.abs(u) ** 4 * 1.4;
      const up = base - y;
      if (up < 26) l += Math.sin(u * 7.5 + seed) > 0.6 ? 0.8 : Math.sin(u * 7.5 + seed) < -0.7 ? -0.9 : 0;
      // rimu bark: irregular flakes, longer than they are wide, each lit along its top and curling dark
      // at its lower lip, the cracks between them deep; some peeled away to the fresh red under them
      const wv = worley(x - c0 + 40, y, 6.5, 14, seed + 4);
      const crack = wv.f2 - wv.f1 < 0.14;
      const inFlake = (y - wv.fy) / 14; // -0.5 top .. 0.5 bottom of the flake
      const fresh = wv.id > 0.84;
      let ramp = fresh ? WP.rimu : wv.id < 0.22 ? WP.barkGrey : WP.bark;
      l += crack ? -1.5 : -inFlake * 1.3 + (inFlake < -0.32 ? 0.5 : 0) + (wv.id - 0.5) * 0.6 + (fresh ? 0.5 : 0);
      // moss on the left (the wet side) low down
      if (up < 70 && u < -0.35 && vn(x * 0.3, y * 0.15, seed + 8) > 0.5) { ramp = WP.moss; l = 3 - (u + 1) * 2 + (h01(x, y, seed) > 0.8 ? 1 : 0); }
      b.set(x, y, dp(ramp, l, x, y));
    }
  }
  // a branch stub high up with an epiphyte clump (astelia: long silver-green blades) in its crook
  const by = 56, bx = cx + lean(by) + tw;
  for (let k = 0; k < 12; k++) for (let j = -3; j <= 3; j++) { const X = bx + k, Y = by - Math.round(k * 0.4) + j; if (Math.abs(j) <= 3 - k / 5) b.set(X, Y, dp(WP.bark, 3 - j * 0.4, X, Y)); }
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI * (0.15 + rng.next() * 0.7), len = 8 + rng.next() * 9;
    for (let t = 0; t < len; t++) { const X = Math.round(bx + 2 + Math.cos(ang) * t), Y = Math.round(by - 4 + Math.sin(ang) * t + t * t * 0.025); b.set(X, Y, t > len - 2 ? hex('#b8c8a8') : i % 2 ? hex('#6a8a5a') : hex('#8aa47a')); }
  }
  // a low dead branch on the right: the ruru's perch at night (HOLLOW.perch)
  const py = base - HOLLOW.perchUp, px = cx + lean(py) + tw - 2;
  for (let k = 0; k < HOLLOW.perchLen; k++) {
    const r = 2.2 - k * 0.11, yc = py - k * 0.28;
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) { if (Math.abs(j) > r) continue; const X = px + k, Y = Math.round(yc + j); b.set(X, Y, dp(k > HOLLOW.perchLen - 4 ? WP.barkGrey : WP.bark, 3.4 - j * 0.6, X, Y)); }
  }
  // the hollow: a knot hole with a thick rolled lip of bark round it, dark and deep inside
  const hy = base - HOLLOW.up, hx = cx + lean(hy) - 2;
  for (let y = -HOLLOW.h; y <= 4; y++) for (let x = -HOLLOW.w; x <= HOLLOW.w; x++) {
    const d = Math.hypot(x / (HOLLOW.w * 0.62), (y + HOLLOW.h * 0.42) / (HOLLOW.h * 0.62));
    const X = hx + x, Y = hy + y;
    if (d < 0.78) b.set(X, Y, dp(WP.wet, 1.4 - d * 1.6 + (y < -HOLLOW.h * 0.6 ? 0.6 : 0), X, Y));
    else if (d < 1.12) b.set(X, Y, dp(WP.bark, 3.6 - (y + HOLLOW.h * 0.4) * 0.12 + (d < 0.9 ? -1.5 : 0.3) - x * 0.06, X, Y));
  }
  b.outline(INK);
  return { buf: b, ax: cx, ay: base };
}

/**
 * The hollow's lower rim on its own, to draw in front of whoever lives in it: the tree's own pixels
 * just under the opening (so it is invisible except where it tucks the owl in). Same size and anchor
 * as the tree: place it where the tree is.
 */
export function hollowLip(seed: number): Sprite {
  const tree = hollowTree(seed), t = tree.buf;
  const b = new PixelBuffer(t.w, t.h);
  const base = tree.ay, cx = tree.ax;
  const hy = base - HOLLOW.up, hx = cx + Math.round(HOLLOW.up * 0.025) - 2;
  for (let y = hy - 2; y <= hy + 6; y++) for (let x = hx - HOLLOW.w - 1; x <= hx + HOLLOW.w + 1; x++) {
    const d = Math.hypot((x - hx) / (HOLLOW.w * 0.62), (y - hy + HOLLOW.h * 0.42) / (HOLLOW.h * 0.62));
    if (d < 0.8) continue;
    const c = t.get(x, y);
    if (c) b.set(x, y, c);
  }
  return { buf: b, ax: cx, ay: base };
}

// ------------------------------------------------------------------ the glow-worm overhang

export const OVERHANG = { w: 130, h: 78, recessY: 34, recessH: 22 };

/** a mossy rock bank with an undercut recess (anchor: the middle of its foot) */
export function overhang(seed: number): Sprite {
  const { w: W0, h: H0, recessY, recessH } = OVERHANG;
  const W = W0 + 10, H = H0 + 8, b = new PixelBuffer(W, H), rng = new Rng(seed * 5 + 9);
  const base = H - 2, x0 = 5, x1 = x0 + W0, mid = (x0 + x1) / 2;
  // the bank's outline: a lumpy crest, falling away at both ends in uneven shoulders
  const topAt = (x: number) => {
    const t = Math.abs(x - mid) / (W0 / 2);
    return base - H0 + Math.round(vn(x * 0.06, 0, seed) * 9 + vn(x * 0.2, 1, seed) * 3 + Math.max(0, t - 0.5) ** 1.5 * 150);
  };
  // the recess: a ragged cave mouth, flat-ish along its floor, the ceiling arched and overhanging
  const rcx = mid + 2, rcy = base - H0 + recessY + recessH * 0.55, rw = (x1 - x0) * 0.36, rh = recessH * 0.62;
  const inRecess = (x: number, y: number) => {
    const nx = (x - rcx) / rw, ny = (y - rcy) / rh;
    return nx * nx + ny * ny * (ny > 0 ? 2.6 : 1) + (vn(x * 0.25, y * 0.25, seed + 2) - 0.5) * 0.35 < 1;
  };
  const rTop = Math.round(rcy - rh), rBot = Math.round(rcy + rh * 0.62);
  for (let x = x0; x <= x1; x++) {
    const top = topAt(x);
    for (let y = top; y <= base; y++) {
      const v = (y - top) / Math.max(1, base - top);
      if (inRecess(x, y)) {
        // inside: deep wet shadow, lightening a little toward the mouth's edge
        let e = 0;
        for (let k = 1; k <= 6; k++) if (!inRecess(x, y - k) || !inRecess(x - k, y) || !inRecess(x + k, y)) { e = 7 - k; break; }
        b.set(x, y, dp(WP.wet, 0.6 + e * 0.32 + (h01(x, y, seed) > 0.94 ? 0.8 : 0), x, y));
        continue;
      }
      // the rock: irregular blocks, each lit on its upper left face, dark cracks between
      // (long, flat blocks along the bedding, as rock splits: not cobbles)
      const rv = worley(x, y + vn(x * 0.04, 3, seed) * 6, 30, 9, seed + 3);
      const crack = rv.f2 - rv.f1 < 0.07;
      const bedLine = (Math.round(y + vn(x * 0.04, 3, seed) * 6) % 9 === 0) && h01(Math.floor(x / 5), y, seed) > 0.3;
      let l = 3.2 - v * 1.3 - (x - x0) / W0 * 0.5 + (rv.id - 0.5) * 0.7 - ((y - rv.fy) / 9) * 1.1;
      if (crack) l -= 1.5;
      else if (bedLine) l -= 0.9;
      // the brow over the recess: lit, wet drips streaking down under it
      if (y > rBot && x > rcx - rw * 0.8 && x < rcx + rw * 0.8 && (x * 7 + seed) % 9 === 0) l -= 0.8;
      let ramp = WP.rock;
      if (vn(x * 0.11, y * 0.11, seed + 6) > 0.6 && v < 0.65) { ramp = WP.moss; l = 3.1 - v * 1.4 + (h01(x, y, seed) > 0.8 ? 1 : 0) - (crack ? 1 : 0); }
      b.set(x, y, dp(ramp, l, x, y));
    }
    // a moss cushion along the crest
    const top2 = topAt(x);
    if (vn(x * 0.2, 4, seed) > 0.32) for (let k = -2; k <= 0; k++) b.set(x, top2 + k, WP.moss[Math.max(2, 4 + (k === -2 ? 1 : 0) - (h01(x, k, seed) > 0.7 ? 1 : 0))]);
  }
  // kidney ferns and moss trailing over the mouth of the recess
  for (let i = 0; i < 9; i++) {
    const fx = Math.round(rcx - rw * 0.85 + rng.next() * rw * 1.7);
    let fy = rTop - 1;
    while (fy < rcy && !inRecess(fx, fy + 1)) fy++;
    const len = 4 + Math.round(rng.next() * 8);
    for (let t = 0; t < len; t++) { const X = fx + Math.round(Math.sin(t * 0.4 + i) * 1.2), Y = fy + t; b.set(X, Y, WP.fern[t % 3 === 0 ? 4 : 3]); if (t % 2) b.set(X + 1, Y, WP.fern[5]); }
  }
  // water drops beading on the ceiling
  for (let i = 0; i < 10; i++) { const x = Math.round(rcx - rw * 0.7 + rng.next() * rw * 1.4); let y = rTop; while (y < rcy && !inRecess(x, y)) y++; b.set(x, y, hex('#8ab8c0')); }
  b.outline(INK);
  // the glow: lights under the recess ceiling, each with its beaded fishing lines hanging under it
  const g = new PixelBuffer(W, H);
  for (let i = 0; i < 70; i++) {
    const x = Math.round(rcx - rw * 0.85 + rng.next() * rw * 1.7);
    let y = rTop;
    while (y < rBot && !inRecess(x, y)) y++;
    if (!inRecess(x, y)) continue;
    y += Math.round(rng.next() * 2);
    const bright = rng.next();
    g.set(x, y, bright > 0.7 ? WP.glow[3] : WP.glow[2]);
    if (bright > 0.5) { g.set(x - 1, y, WP.glow[1]); g.set(x + 1, y, WP.glow[1]); }
    const len = 3 + Math.round(rng.next() * (rBot - y - 2));
    for (let t = 2; t < len; t += 2) if (inRecess(x, y + t)) g.set(x, y + t, t % 4 === 0 ? WP.glow[1] : WP.glow[0]);
  }
  void recessH;
  return { buf: b, ax: Math.round(mid), ay: base, glow: g };
}

// ------------------------------------------------------------------ the eel pool

export const POOL = { w: 156, h: 54, lair: 0.2 };

/**
 * A deep hole in the creek bed, seen from the bank above (anchor: the middle of its top edge, at the
 * ground line). Returns the bed (behind the eel) and the surface (over it, see-through).
 */
export function eelPool(seed: number): { bed: Sprite; surface: Sprite; bank: Sprite } {
  const { w: W0, h: H0 } = POOL;
  const W = W0 + 8, H = H0 + 8, cx = W / 2, top = 2;
  const bed = new PixelBuffer(W, H), surf = new PixelBuffer(W, H), bank = new PixelBuffer(W, H);
  const rng = new Rng(seed * 13 + 4);
  // the pool's outline: an irregular rounded shape, its far (top) edge undercut at the lair end
  const inside = (x: number, y: number) => {
    const nx = (x - cx) / (W0 / 2), ny = (y - top - H0 / 2) / (H0 / 2);
    return nx * nx + ny * ny * (1 + Math.max(0, nx) * 0.3) + (vn(x * 0.07, y * 0.1, seed) - 0.5) * 0.35 < 1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) {
      // a ring of gravel and wet stones round it
      // the bank: a band of wet gravel and stones on the near side, dark soil and moss on the far side
      const farSide = y < top + H0 * 0.45;
      const R0 = farSide ? 2 : 4;
      let near = 0;
      for (let k = 1; k <= R0 && !near; k++) if (inside(x + k, y) || inside(x - k, y) || inside(x, y + k) || inside(x, y - k)) near = k;
      if (near) {
        if (farSide) bank.set(x, y, near === 1 ? WP.soil[1] : dp(vn(x * 0.2, y, seed + 8) > 0.5 ? WP.moss : WP.soil, 3, x, y));
        else { const st = h01(x >> 1, y >> 1, seed); bank.set(x, y, dp(WP.stone, 2.4 + (st - 0.5) * 2.6 + (near === 1 ? -0.9 : 0) + ((x + y) % 4 === 0 ? 0.6 : 0), x, y)); }
      }
      continue;
    }
    // depth: the middle is deepest; the bottom shows pebbles at the shallow edges
    let edgeD = 99;
    for (let k = 1; k <= 10; k++) if (!inside(x + k, y) || !inside(x - k, y) || !inside(x, y + k) || !inside(x, y - k)) { edgeD = k; break; }
    const depth = Math.min(1, edgeD / 10);
    if (depth < 0.45 && h01(x >> 1, y >> 1, seed + 2) > 0.6) bed.set(x, y, dp(WP.stone, 3 - depth * 3, x, y));
    else bed.set(x, y, dp(WP.water, 3.4 - depth * 3.2 + (vn(x * 0.1, y * 0.2, seed + 5) - 0.5) * 0.8, x, y));
    // the surface: a see-through tint, deeper blue where it's deep, a light streak or two
    const a = Math.round(28 + depth * 60);
    const sc = dp(WP.water, 4.2 - depth * 1.4, x, y);
    surf.set(x, y, ((a << 24) | (sc & 0xffffff)) >>> 0);
    // glints of the sky on the water: short level dashes, scattered, more toward the far side
    if (depth > 0.25 && y % 3 === 0 && vn(x * 0.18, y * 0.7, seed + 6) > 0.74 - (1 - (y - top) / H0) * 0.08) surf.set(x, y, hex('#a8d0cc', 140));
  }
  // the undercut bank at the lair end: dark roots hanging into the water, ferns over the edge
  const lx = Math.round(W * POOL.lair);
  for (let i = 0; i < 9; i++) {
    const rx = lx - 10 + Math.round(rng.next() * 22), len = 4 + Math.round(rng.next() * 9);
    for (let t = 0; t < len; t++) bank.set(rx + Math.round(Math.sin(t * 0.5 + i) * 1.4), top + 2 + t, t > len - 2 ? WP.bark[4] : WP.bark[2]);
  }
  for (let x = 2; x < W - 2; x++) if (!inside(x, top + 2) && inside(x, top + 6)) for (let k = 0; k < 3; k++) bank.set(x, top + 2 + k, WP.soil[2 + (k === 0 ? 2 : 0)]);
  for (let i = 0; i < 6; i++) {
    const fx = Math.round(rng.next() * W), fy = top + 1;
    for (let t = 0; t < 9; t++) { const X = fx + Math.round(t * (i % 2 ? 0.8 : -0.8)), Y = fy + Math.round(t * 0.4 + t * t * 0.04); bank.set(X, Y, WP.fern[3 + (t % 2)]); }
  }
  bank.outline(INK);
  return { bed: { buf: bed, ax: Math.round(cx), ay: top }, surface: { buf: surf, ax: Math.round(cx), ay: top }, bank: { buf: bank, ax: Math.round(cx), ay: top } };
}

// ------------------------------------------------------------------ the geothermal patch

export const GEO = { w: 170, h: 40, pool: [0.62, 0.3, 0.2, 0.32] as [number, number, number, number], pots: [[0.18, 0.55], [0.34, 0.75], [0.42, 0.4]] as [number, number][] };

/** white sinter, algae mats, sulphur, mud pots and the hot pool (anchor: the middle of its top edge) */
export function geoField(seed: number): Sprite {
  const { w: W0, h: H0 } = GEO;
  const W = W0 + 6, H = H0 + 6, b = new PixelBuffer(W, H), rng = new Rng(seed * 17 + 1);
  const cx = W / 2, top = 2;
  const [pcx, pcy, prx, pry] = GEO.pool;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - cx) / (W0 / 2), ny = (y - top - H0 / 2) / (H0 / 2);
    // a ragged edge that crumbles into the ground: crust breaking up into flakes, nothing pasted on
    const e = nx * nx * 0.9 + ny * ny + (vn(x * 0.08, y * 0.15, seed) - 0.5) * 0.5;
    if (e > 1.12) continue;
    if (e > 0.9) { if (h01(x, y, seed + 11) < (e - 0.9) * 5) continue; b.set(x, y, dp(WP.sinter, 2.2 + (h01(x, y, seed) - 0.5) * 2, x, y)); continue; }
    // the hot pool: clear turquoise, deeper toward its middle, a pale sinter rim
    const px = (x / W - pcx) / prx, py = ((y - top) / H0 - pcy) / pry;
    const pd = Math.hypot(px, py) + (vn(x * 0.2, y * 0.3, seed + 3) - 0.5) * 0.12;
    if (pd < 1) { b.set(x, y, dp(WP.hot, 4.4 - (1 - pd) * 3.6 + (h01(x, y, seed) > 0.95 ? 1 : 0), x, y)); continue; }
    if (pd < 1.18) { b.set(x, y, dp(WP.sinter, 4.6 - (pd - 1) * 6, x, y)); continue; }
    // the mud pots: grey mud in concentric rings, a crusted lip
    let pot = false;
    for (const [mx, my] of GEO.pots) {
      const d = Math.hypot((x / W - mx) / 0.07, ((y - top) / H0 - my) / 0.22) + (vn(x * 0.3, y * 0.3, seed + 4) - 0.5) * 0.15;
      // soft grey mud, one faint ring where the last bubble spread, a dark wet edge and a lit crusted lip
      if (d < 1) { b.set(x, y, dp(WP.mud, 3.4 - d * 0.9 + (Math.abs(d - 0.55) < 0.06 ? -0.7 : 0) - (d > 0.85 ? 1 : 0) - (y - top) / H0 * 0.4, x, y)); pot = true; break; }
      if (d < 1.22) { b.set(x, y, dp(WP.sinter, 2.4 + (d - 1) * 6 - (y < (my * H0 + top) ? 0.6 : 0), x, y)); pot = true; break; }
    }
    if (pot) continue;
    // the sinter and its mats: orange algae in the warm runoff, green further off, a sulphur stain
    // the runoff from the pool fans out across the crust in thin channels: orange mats where it is
    // warm (near the pool), green where it cools, a little sulphur yellow round the vents
    const fromPool = Math.hypot((x / W - pcx) / 0.5, ((y - top) / H0 - pcy) / 1.2);
    const chan = Math.abs(Math.sin((Math.atan2((y - top) / H0 - pcy, x / W - pcx) * 9) + vn(x * 0.12, y * 0.12, seed + 7) * 3));
    const sul = vn(x * 0.16, y * 0.16, seed + 9);
    let c: C;
    if (sul > 0.8 && fromPool > 0.55) c = dp(WP.sulphur, 2.2 + (sul - 0.8) * 8, x, y);
    else if (chan < 0.22 && fromPool < 0.75) c = dp(WP.algaeO, 2.6 - fromPool * 1.6 + (h01(x, y, seed) > 0.85 ? 0.8 : 0), x, y);
    else if (chan < 0.16 && fromPool < 1.1) c = dp(WP.algaeG, 2.4, x, y);
    else c = dp(WP.sinter, 3.7 - Math.abs(ny) * 1.1 + (h01(x >> 1, y >> 1, seed + 1) > 0.85 ? -0.8 : 0), x, y);
    b.set(x, y, c);
  }
  // cracks in the crust
  for (let i = 0; i < 8; i++) {
    let x = Math.round(rng.next() * W), y = top + Math.round(rng.next() * H0);
    for (let k = 0; k < 7; k++) { if (b.get(x, y)) b.set(x, y, WP.sinter[1]); x += rng.next() < 0.5 ? 1 : -1; y += rng.next() < 0.5 ? 1 : 0; }
  }
  return { buf: b, ax: Math.round(cx), ay: top };
}

/** a drift of leaf litter with a fern frond over it: cover for something small (anchor: bottom middle) */
export function litter(seed: number): Sprite {
  const W = 24, H = 9, b = new PixelBuffer(W, H), rng = new Rng(seed * 19 + 3);
  const LEAF = [WP.rot, WP.bark, WP.grass];
  for (let i = 0; i < 26; i++) {
    const x = 2 + Math.round(rng.next() * (W - 5)), y = H - 2 - Math.round(rng.next() * (3 - Math.abs(x - W / 2) / W * 4));
    const R = LEAF[i % 3];
    b.set(x, y, R[3]); b.set(x + 1, y, R[2]); if (rng.next() < 0.5) b.set(x, y - 1, R[4]);
  }
  for (let t = 0; t < 12; t++) { const X = 4 + t, Y = H - 3 - Math.round(Math.sin(t / 11 * Math.PI) * 5); b.set(X, Y, WP.fern[4]); if (t % 2) { b.set(X, Y - 1, WP.fern[5]); b.set(X, Y + 1, WP.fern[3]); } }
  b.outline(INK);
  return { buf: b, ax: W / 2, ay: H - 1 };
}
