// V12 Te Moana Rimurimu, the little things on the floor and in the water, each placed pixel by pixel:
// kina (sea urchins) bristling with spines, pāua clamped to the rock with the nacre glinting at the
// lip, reef stars on the boulder faces, cobbles crusted pink, finger sponges, the Kitten's anchor
// half dug into the sand with its chain, her boarding ladder, the tiny fish the schools are made of,
// and the bubbles.

import { PixelBuffer } from '../../pixel';
import { C, hex, mix, shade } from '../../color';
import { Rng, clamp, noise1 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { outlineSel } from '../../jungle-core';
import { CORAL, ROCK } from './seabed';

const r = (...h: string[]) => h.map(x => hex(x));
const at = (rp: C[], i: number) => rp[i <= 0 ? 0 : i >= rp.length - 1 ? rp.length - 1 : Math.round(i)];
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const haze = (b: PixelBuffer, water: C | undefined, k: number) => {
  if (!water || k <= 0) return b;
  const d = b.data;
  for (let i = 0; i < d.length; i++) if (d[i] >>> 24) d[i] = mix(d[i], water, k);
  return b;
};

// ------------------------------------------------------------------ kina
const KINA = r('#0e0a12', '#1c1324', '#2c1d36', '#3e2a4a', '#54395e', '#6c4c74', '#86688a');
const KINA_SPINE = r('#140c18', '#24162a', '#3a2440', '#5a3e4e', '#8a7a5a');
/** a kina: a low dome bristling with green-black spines, every spine its own line */
export function kina(seed: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 31 + 1);
  const W = 15, H = 10, cx = 7, base = H - 1;
  const b = new PixelBuffer(W, H);
  const rx = rng.range(2.6, 3.2), ry = rng.range(2, 2.5);
  // the spines behind first, then the test, then the spines in front
  const spines = Array.from({ length: 17 }, (_, i) => {
    const a = Math.PI + (i / 16) * Math.PI + rng.range(-0.1, 0.1);
    return { a, len: rng.range(3, 4.6), front: i % 2 === 0 };
  });
  const spine = (s: { a: number; len: number }, tone: number) => {
    const x0 = cx + 0.5 + Math.cos(s.a) * rx * 0.8, y0 = base - 0.5 + Math.sin(s.a) * ry * 0.8;
    for (let t = 0; t <= s.len; t += 0.5) {
      const x = x0 + Math.cos(s.a) * t, y = y0 + Math.sin(s.a) * t;
      b.set(x, y, at(KINA_SPINE, tone + (t > s.len - 1 ? 1 : 0) + (Math.cos(s.a) < 0 ? 0.5 : -0.3)));
    }
  };
  for (const s of spines) if (!s.front) spine(s, 1);
  for (let y = Math.floor(base - ry); y <= base; y++) for (let x = Math.floor(cx - rx); x <= cx + rx + 1; x++) {
    const nx = (x + 0.5 - cx - 0.5) / rx, ny = (y + 0.5 - base) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const l = -nx * 0.6 - ny * 0.9;
    b.set(x, y, at(KINA, 2.6 + l * 2.2 + (h01(x, y, seed) < 0.25 ? -1 : 0)));
  }
  for (const s of spines) if (s.front) spine(s, 2.4);
  // a glint on the crown
  b.set(cx, base - Math.round(ry), KINA[6]);
  return { buf: haze(b, water, hz), ax: cx, ay: base };
}

// ------------------------------------------------------------------ pāua
const PAUA = r('#1a1a12', '#2c2c1e', '#40402a', '#56563a', '#6e6c4a', '#88845c');
const NACRE = r('#2a6a8a', '#3aa0b0', '#5ad0c0', '#8a7ad0', '#c0f0e0');
/** a pāua clamped to the rock: a low ear-shaped shell with growth ridges, its row of holes, the black
 *  foot's fringe below and the nacre's blue-green fire showing at the lip */
export function paua(seed: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 17 + 7);
  const W = 12, H = 7, base = H - 1;
  const b = new PixelBuffer(W, H);
  const L = rng.range(8.5, 10), x0 = 1;
  for (let i = 0; i < L; i++) {
    const t = i / (L - 1);
    // ear-shaped: high toward the spire end (left), long and low to the right
    const h = 1.5 + 3 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8) * (1 - t * 0.3);
    for (let k = 0; k < h; k++) {
      const y = base - 1 - k;
      const ridge = Math.sin(t * 9 + k * 0.6) > 0.6;
      let c = at(PAUA, 2.6 + (k / h) * 2 - t * 0.8 + (ridge ? 0.8 : 0));
      if (k === Math.floor(h) - 1 && t > 0.2 && t < 0.9 && i % 2 === 0) c = PAUA[0];
      b.set(x0 + i, y, c);
    }
    // the nacre at the lip, the foot below
    b.set(x0 + i, base - 1, at(NACRE, (i + seed) % 5));
    b.set(x0 + i, base, i % 3 === 0 ? hex('#0a0a0a') : hex('#1a1a18'));
  }
  return { buf: haze(b, water, hz), ax: W / 2, ay: base };
}

// ------------------------------------------------------------------ sea stars (on the boulder faces)
const STAR = [r('#5a1608', '#8a2a10', '#b8461a', '#dc6a2a', '#f09048', '#fab878'), r('#3a1040', '#5a1c5e', '#7c2e7e', '#9e48a0', '#c070c0', '#e0a0dc'), r('#5a2a08', '#8a4a10', '#b8701a', '#dc9a2a', '#f0c048', '#fadc88')];
/** a reef star seen face-on on a rock face: five fat arms, curling a little, studded with bumps */
export function seaStar(seed: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 13 + 3);
  const S = 13, c = 6;
  const b = new PixelBuffer(S, S);
  const rp = STAR[seed % STAR.length];
  const rot = rng.range(0, Math.PI * 2);
  const arms = Array.from({ length: 5 }, (_, i) => ({ a: rot + (i / 5) * Math.PI * 2 + rng.range(-0.12, 0.12), len: rng.range(4.6, 6), curl: rng.range(-0.3, 0.3) }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c - 0.5, dy = y + 0.5 - c - 0.5;
    const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let inside = d < 1.9;
    let lt = 0;
    for (const arm of arms) {
      let da = a - arm.a - arm.curl * (d / arm.len);
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const wdt = 1.6 * (1 - d / (arm.len + 0.6)) + 0.45;
      if (d < arm.len && Math.abs(da) * d < wdt) { inside = true; lt = -Math.sin(arm.a) * 0.6 - Math.cos(arm.a) * 0.3; }
    }
    if (!inside) continue;
    let tone = 3 + lt - (d > 4 ? 0.6 : 0) + (h01(x, y, seed) < 0.3 ? 1 : 0);
    if (d < 1.2) tone += 0.6;
    b.set(x, y, at(rp, tone));
  }
  outlineSel(b, 0.5, 0.2);
  return { buf: haze(b, water, hz), ax: c, ay: c };
}

// ------------------------------------------------------------------ cobbles, crusted
/** a cobble on the sand: an irregular hand-shaped silhouette, faceted light, a pink crust on its crown */
export function cobble(seed: number, w: number, h: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 7 + 11);
  const W = Math.ceil(w + 2), H = Math.ceil(h + 3), base = H - 1;
  const b = new PixelBuffer(W, H);
  // knots across the top, flat facets between
  const kn: [number, number][] = [[0, 0], [rng.range(0.04, 0.1), rng.range(0.45, 0.75)], [rng.range(0.22, 0.34), rng.range(0.8, 1)], [rng.range(0.42, 0.55), rng.range(0.7, 0.92)], [rng.range(0.62, 0.74), rng.range(0.9, 1)], [rng.range(0.9, 0.96), rng.range(0.35, 0.7)], [1, 0]];
  const top = (t: number) => { let j = 1; while (j < kn.length - 1 && kn[j][0] < t) j++; const [a, ha] = kn[j - 1], [e, he] = kn[j]; const s = (t - a) / Math.max(1e-6, e - a); return { h: ha + (he - ha) * s, sl: (he - ha) / Math.max(1e-6, e - a) }; };
  const crust = rng.chance(0.65);
  for (let x = 0; x < W - 1; x++) {
    const t = (x + 0.5) / (W - 1);
    const tp = top(t);
    const ht = tp.h * h;
    for (let k = 0; k < ht; k++) {
      const y = base - k;
      const e = ht - k;
      let f = 4.4 - (1 - k / ht) * 2 + clamp(tp.sl * 0.2, -1, 1) * 1.2 - t * 0.8;
      if (e < 1.5) f = 7 + clamp(tp.sl * 0.2, -1, 1);
      else if (e < 3) f += 0.8;
      if (h01(x >> 1, y, seed) < 0.18) f -= 0.8;
      let c = at(ROCK, f);
      if (crust && e < 2.5 && noise1(x * 0.4, seed) > 0.35) c = at(CORAL, 5 - (e > 1.5 ? 2 : 0));
      b.set(x, y, c);
    }
  }
  outlineSel(b, 0.45);
  return { buf: haze(b, water, hz), ax: Math.floor(W / 2), ay: base };
}

// ------------------------------------------------------------------ finger sponges
const SPONGES = [r('#5a2410', '#9a4a1a', '#d06a26', '#f09a40', '#fcc070'), r('#5a4a10', '#9a8020', '#d0b030', '#f0d84a', '#fcf08a'), r('#2a1440', '#4a2468', '#6e3a90', '#9458b4', '#c080d8')];
/** a clump of finger sponges: rounded tubes of different heights, each with its dark osculum on top */
export function sponge(seed: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 23 + 5);
  const rp = SPONGES[seed % SPONGES.length];
  const W = 12, H = 14, base = H - 1;
  const b = new PixelBuffer(W, H);
  const n = rng.int(2, 4);
  const fingers = Array.from({ length: n }, (_, i) => ({ x: 2 + i * (8 / Math.max(1, n - 1)) + rng.range(-0.8, 0.8), h: rng.range(5, 12), lean: rng.range(-0.25, 0.25), w: rng.range(1.2, 1.8) }));
  fingers.sort((a, b2) => b2.h - a.h);
  for (const f of fingers) {
    for (let k = 0; k < f.h; k++) {
      const cx = f.x + f.lean * k;
      for (let v = -f.w; v <= f.w; v += 0.5) {
        const nx = v / f.w;
        let tone = 2.4 - nx * 1.2 + (k > f.h - 2 ? 0.8 : 0) + (h01(Math.round(cx + v), k, seed) < 0.2 ? -0.7 : 0);
        if (k > f.h - 1.5 && Math.abs(nx) < 0.45) tone = 0.4;
        b.set(cx + v, base - k, at(rp, tone));
      }
    }
  }
  outlineSel(b, 0.5);
  return { buf: haze(b, water, hz), ax: W / 2, ay: base };
}

// ------------------------------------------------------------------ the Kitten's anchor
const IRON = r('#141414', '#222220', '#33312c', '#46423a', '#5c574a', '#757060', '#8e8876');
const RUST = r('#2a140a', '#4a2410', '#6e3a18', '#8e5226');
/** a plough anchor half dug into the sand: its shank up at an angle, the crown in the sand, a few chain
 *  links to where the line is shackled on; rust bloom and a pink crust starting on the fluke */
export function anchor(): Sprite {
  const W = 34, H = 22, base = H - 1;
  const b = new PixelBuffer(W, H);
  const put = (x: number, y: number, c: number) => b.set(x, y, IRON[clamp(Math.round(c), 0, IRON.length - 1)]);
  // the crown and its stock: a bar across the bottom, lying on the sand
  for (let x = 2; x < 15; x++) { put(x, base - 2, 5); put(x, base - 1, 3); }
  put(1, base - 2, 4); put(15, base - 2, 4);
  // the two flukes: broad pointed blades from the crown, dug into the sand (the near one, then a
  // glimpse of the far one behind it)
  for (let i = 0; i < 9; i++) {
    const hgt = Math.round(5 - i * 0.45);
    for (let k = 0; k < hgt; k++) put(5 + i, base - 3 - k, 4.6 - k * 0.3 + (k === hgt - 1 ? 1.2 : 0) - i * 0.12);
  }
  for (let i = 0; i < 6; i++) put(3 + i, base - 4 - Math.round(i * 0.3), 2.2);
  // the shank, up out of the crown toward the boat
  for (let i = 0; i < 18; i++) {
    const x = 7 + i, y = base - 4 - i * 0.78;
    put(x, y, 5.6); put(x, y + 1, 3.2);
  }
  // the ring, the shackle, three links of chain
  const ex = 26, ey = base - 18;
  for (const [dx, dy, c] of [[0, -1, 5], [1, -1, 6], [-1, 0, 4], [2, 0, 5], [-1, 1, 3], [2, 1, 3], [0, 2, 2], [1, 2, 3]] as const) put(ex + dx, ey + dy, c);
  for (let l = 0; l < 3; l++) {
    const lx = ex + 3 + l * 2, ly = ey - 2 - l * 2;
    put(lx, ly, 5); put(lx + 1, ly, 3); put(lx, ly - 1, l % 2 ? 4 : 2);
  }
  // rust bloom on the flukes, a start of pink crust on the stock
  for (let i = 0; i < 10; i++) { const x = 5 + (i * 7) % 9, y = base - 3 - (i % 3); if (b.opaque(x, y)) b.set(x, y, RUST[1 + (i % 3)]); }
  b.set(4, base - 2, CORAL[4]); b.set(5, base - 2, CORAL[3]); b.set(11, base - 2, CORAL[2]);
  outlineSel(b, 0.6);
  return { buf: b, ax: 9, ay: base - 1 };
}

// ------------------------------------------------------------------ the boarding ladder
const TEAK = r('#1e140c', '#2e1f12', '#422e1a', '#5a4024', '#74542e', '#8e6a3a', '#a8824a');
/** her boarding ladder: two rails and five rungs, rope-lashed, weed starting on the lowest rungs */
export function ladder(len: number): Sprite {
  const W = 11, H = len, b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) {
    b.set(1, y, TEAK[4]); b.set(2, y, TEAK[2]);
    b.set(8, y, TEAK[4]); b.set(9, y, TEAK[2]);
  }
  for (let y = 6; y < H - 2; y += 9) {
    for (let x = 2; x <= 8; x++) { b.set(x, y, TEAK[x < 5 ? 5 : 4]); b.set(x, y + 1, TEAK[1]); }
    b.set(1, y, hex('#c8b48a')); b.set(9, y, hex('#a89470'));
  }
  // weed and a little growth on the bottom
  for (let x = 1; x < 10; x++) if ((x * 7) % 3 !== 0) b.set(x, H - 1, x % 2 ? hex('#4a6a2a') : hex('#365a22'));
  b.set(2, H - 3, hex('#5a7a32')); b.set(8, H - 4, hex('#5a7a32'));
  outlineSel(b, 0.55);
  return { buf: b, ax: 5, ay: 0 };
}

// ------------------------------------------------------------------ the school fish
export type SchoolKind = 'sprat' | 'maomao' | 'koheru' | 'far';
const FISH: Record<SchoolKind, { back: C; body: C; belly: C; fin: C; eye: C; glint: C; len: number }> = {
  sprat: { back: hex('#3a5a68'), body: hex('#9ab8c0'), belly: hex('#d8e8e8'), fin: hex('#6a8a96'), eye: hex('#101820'), glint: hex('#ffffff'), len: 6 },
  maomao: { back: hex('#1e3a8a'), body: hex('#3a6ad8'), belly: hex('#8ab4f0'), fin: hex('#28489c'), eye: hex('#0a1020'), glint: hex('#c0e0ff'), len: 7 },
  koheru: { back: hex('#3a6a4a'), body: hex('#a8c0a0'), belly: hex('#e0ecd8'), fin: hex('#d8c050'), eye: hex('#101810'), glint: hex('#ffffff'), len: 7 },
  far: { back: hex('#163448'), body: hex('#25506a'), belly: hex('#3a6a84'), fin: hex('#1c4058'), eye: hex('#0a1a24'), glint: hex('#5a8aa4'), len: 5 },
};
/** two frames of a little school fish facing right (the tail flicks), and a third turned to flash */
export function schoolFish(kind: SchoolKind): PixelBuffer[] {
  const F = FISH[kind];
  const L = F.len;
  const frame = (flick: number, flash: boolean) => {
    const b = new PixelBuffer(L + 2, 4);
    // body: back row, flank row, belly row, tapering to the tail
    for (let x = 1; x < L; x++) {
      const t = x / L;
      if (t > 0.15) b.set(x, 0 + (x === L - 1 ? 1 : 0), flash ? F.glint : F.back);
      b.set(x, 1, flash ? F.belly : x === L - 2 ? F.glint : F.body);
      if (t > 0.2 && t < 0.85) b.set(x, 2, flash ? F.glint : F.belly);
    }
    b.set(L - 2, 1, F.eye);
    // the tail
    b.set(0, flick ? 0 : 1, F.fin); b.set(0, flick ? 2 : 2, F.fin); b.set(1, 1, F.fin);
    return b;
  };
  return [frame(0, false), frame(1, false), frame(0, true)];
}

// ------------------------------------------------------------------ bubbles
/** bubbles of a few sizes: a speck, a pair of pixels, a ring with a lit rim, a bigger wobbling one */
export function bubbles(): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  const hi = hex('#f4ffff'), mid = hex('#b8e8f0', 200), dim = hex('#7ac0d0', 140);
  { const b = new PixelBuffer(1, 1); b.set(0, 0, hi); out.push(b); }
  { const b = new PixelBuffer(2, 2); b.set(0, 0, hi); b.set(1, 0, mid); b.set(0, 1, mid); b.set(1, 1, dim); out.push(b); }
  for (const R of [1.6, 2.4]) {
    const S = Math.ceil(R * 2) + 1, b = new PixelBuffer(S, S), c = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > R + 0.3) continue;
      if (d > R - 0.75) b.set(x, y, x + y < S - 1 ? hi : mid);
      else b.set(x, y, hex('#9ad8e8', 50));
    }
    b.set(Math.floor(c - R * 0.4), Math.floor(c - R * 0.4), hi);
    out.push(b);
  }
  return out;
}
export { shade };

// ------------------------------------------------------------------ light
/** a shaft of light for underwater rays: alpha in four dithered steps across (bright core, fading
 *  edges) and fading down its length, so the ray is made of pixels, not a smooth smear */
export function shaftTex(w = 24, h = 192): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.abs((x + 0.5) / w - 0.5) * 2;
    const t = y / h;
    const across = Math.pow(Math.max(0, 1 - u), 1.4);
    const along = Math.pow(1 - t, 1.3) * Math.min(1, t * 10);
    const a = across * along;
    const th = (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    // four steps of alpha; between them the pattern decides
    const q = Math.floor(a * 4 + th);
    if (q <= 0) continue;
    b.set(x, y, (0xffffff | (Math.min(255, q * 64 - 1) << 24)) >>> 0);
  }
  return b;
}

// ------------------------------------------------------------------ the deep reef's life
const FAN = [r('#2a0808', '#4e1210', '#7a1e16', '#a8301c', '#d04a24', '#ec7034', '#fca05a'), r('#3a2a06', '#5e460c', '#8a6a14', '#b88e1e', '#dcb432', '#f2d45a', '#fcec96')];
/**
 * A sea fan (a gorgonian): a short trunk forking again and again into a flat lattice, the branches
 * thinning to twig tips studded with paler polyps, a few cross-links where branches touch. `dir` is the
 * way it grows: up off a ledge (-PI/2), or out from a wall (toward 0).
 */
export function seaFan(seed: number, h: number, dir = -Math.PI / 2, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 41 + 3);
  const rp = FAN[seed % FAN.length];
  const S = Math.ceil(h * 2.2) + 4;
  const b = new PixelBuffer(S, S);
  const ox = Math.round(S / 2 - Math.cos(dir) * h * 0.95), oy = Math.round(S / 2 - Math.sin(dir) * h * 0.95);
  const tips: [number, number][] = [];
  // the fan's outline: a sector about `dir`, ~110 degrees wide, its rim lumpy
  const rim = (a: number) => h * (0.78 + 0.22 * noise1(a * 2.2, seed)) * (1 - Math.pow(Math.abs(a) / 1.05, 4) * 0.35);
  const inside = (x: number, y: number) => {
    const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy);
    let a = Math.atan2(dy, dx) - dir;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) < 1.05 && d < rim(a);
  };
  // branches run out to the rim, sprouting side branches as they go, each finer than its parent
  const grow = (x: number, y: number, a: number, depth: number, tone: number) => {
    let n = 0;
    while (n < h * 1.4) {
      const nx = x + Math.cos(a), ny = y + Math.sin(a);
      if (!inside(nx, ny) && n > 1) break;
      x = nx; y = ny; n++;
      a += rng.range(-0.09, 0.09);
      b.set(x, y, at(rp, tone + (depth >= 2 ? 0.8 : 0)));
      if (depth === 0 && n < h * 0.5) b.set(x + 1, y, at(rp, tone - 1));
      if (depth < 2 && n > 3 && rng.chance(depth === 0 ? 0.16 : 0.1)) {
        const side = rng.chance(0.5) ? 1 : -1;
        grow(x, y, a + side * rng.range(0.4, 0.7), depth + 1, tone + 0.5);
      }
    }
    tips.push([x, y]);
  };
  const nMain = rng.int(4, 6);
  for (let i = 0; i < nMain; i++) grow(ox, oy, dir + ((i + 0.5) / nMain - 0.5) * 1.6 + rng.range(-0.08, 0.08), 0, 2);
  // polyps at the tips, cross-links between near tips
  for (const [x, y] of tips) { b.set(x, y, rp[6]); if (rng.chance(0.5)) b.set(x + 1, y, rp[5]); }
  for (let i = 0; i < tips.length; i++) for (let j = i + 1; j < tips.length; j++) {
    const [ax, ay] = tips[i], [bx, by] = tips[j];
    const d = Math.hypot(ax - bx, ay - by);
    if (d > 2 && d < 4 && rng.chance(0.2)) b.line(ax, ay, bx, by, rp[4]);
  }
  // the holdfast where it grips the rock
  b.set(ox, oy, rp[1]); b.set(ox - 1, oy, rp[1]); b.set(ox + 1, oy, rp[2]);
  return { buf: haze(b, water, hz), ax: ox, ay: oy };
}

const VASE = [r('#3a2a06', '#6a4c0e', '#9a7218', '#c89a26', '#e8c040', '#f6dc74'), r('#2a1236', '#4a1e5a', '#6e3080', '#9448a8', '#b870c8', '#d8a0e0'), r('#3a1606', '#6a2a0e', '#a04418', '#d0662a', '#ec9042', '#f8b870')];
/** a vase sponge: a hand-shaped cup flaring from a narrow foot to a thick rim, pitted with pores, its
 *  dark mouth showing at the top, lit from the left */
export function vaseSponge(seed: number, h: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 19 + 7);
  const rp = VASE[seed % VASE.length];
  const W = Math.ceil(h * 0.9) + 4, H = Math.ceil(h) + 2, base = H - 1, cx = W / 2;
  const b = new PixelBuffer(W, H);
  const lean = rng.range(-0.15, 0.15);
  const flare = rng.range(0.32, 0.44);
  const rimH = Math.max(2, Math.round(h * 0.12));
  for (let k = 0; k < h; k++) {
    const t = k / h;
    // a narrow foot, a belly, a slight waist under a flared, uneven lip
    const prof = 0.09 + flare * Math.pow(Math.sin(Math.PI * 0.5 * Math.min(1, t * 1.15)), 0.75) - 0.05 * Math.sin(Math.PI * clamp((t - 0.55) / 0.35)) + 0.06 * Math.pow(clamp((t - 0.82) / 0.18), 2);
    const hw = h * prof * (1 + (noise1(k * 0.5, seed) - 0.5) * 0.12);
    const mx = cx + lean * k;
    const top = k >= h - rimH;
    for (let x = Math.floor(mx - hw); x <= mx + hw; x++) {
      const u = (x + 0.5 - mx) / hw;
      let tone = 3.2 - u * 1.5 - (1 - t) * 0.7;
      // pores: little pits in rows
      if (h01(x, base - k, seed) < 0.1 && Math.abs(u) < 0.75 && !top) tone -= 1.7;
      if (Math.abs(u) > 0.84) tone -= 0.9;
      // the lip: thick and lit, the dark inside of the cup showing over it
      if (top) tone = Math.abs(u) < 0.7 && k < h - 1 ? 0.5 + (k === h - rimH ? 0.6 : 0) : 4.4 - u;
      b.set(x, base - k, at(rp, tone));
    }
  }
  outlineSel(b, 0.5);
  return { buf: haze(b, water, hz), ax: Math.round(cx), ay: base };
}

/** a clump of sea whips: long thin stems swaying up from one foot, each with a pale tip */
export function seaWhips(seed: number, h: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 7 + 29);
  const rp = FAN[(seed + 1) % FAN.length];
  const W = Math.ceil(h * 0.9) + 4, H = Math.ceil(h) + 2, base = H - 1, cx = Math.round(W / 2);
  const b = new PixelBuffer(W, H);
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    let x = cx + rng.range(-1.5, 1.5), y = base, a = -Math.PI / 2 + rng.range(-0.5, 0.5);
    const L = h * rng.range(0.55, 1), bend = rng.range(-0.8, 0.8);
    for (let s = 0; s < L; s += 0.5) {
      b.set(x, y, at(rp, 3 + (s / L) * 2.4 + (Math.cos(a) > 0 ? -0.5 : 0.3)));
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
      a += bend / L * 0.5;
    }
    b.set(x, y, rp[6]);
  }
  return { buf: haze(b, water, hz), ax: cx, ay: base };
}

// ------------------------------------------------------------------ shells and reef rocks
const SHELL = [r('#5a4c3a', '#8a7a62', '#b8a888', '#e0d4bc', '#f6f0e2'), r('#4a2a2a', '#7a4a3e', '#a86e5a', '#d29a82', '#f0c8b0'), r('#2a2a2e', '#4a4a52', '#76767e', '#a8a8ae', '#d8d8dc')];
/** a shell on the sand: a ribbed cockle (fan of ribs), a turban snail (a whorled cone), or a broken valve */
export function shell(seed: number): Sprite {
  const rng = new Rng(seed * 11 + 5);
  const rp = SHELL[seed % SHELL.length];
  const kind = seed % 3;
  const b = new PixelBuffer(7, 5);
  if (kind === 0) {
    // cockle: a low fan, ribs radiating from the hinge
    for (let x = 0; x < 6; x++) {
      const hgt = Math.round(3 * Math.sin(Math.PI * (x + 0.5) / 6));
      for (let k = 0; k < hgt; k++) b.set(x, 4 - k, at(rp, 2 + (x % 2 ? 1 : 0) + (k === hgt - 1 ? 1 : 0) - x * 0.15));
    }
    b.set(2, 4 - 2, rp[4]);
  } else if (kind === 1) {
    // turban: a whorled cone, the aperture dark
    const rows = [[1, 4], [1, 4], [2, 4], [2, 3]];
    rows.forEach(([a, e], k) => { for (let x = a; x <= e; x++) b.set(x, 4 - k, at(rp, 1.6 + (x === a ? 1.6 : 0) + ((x + k) % 2 ? 0.6 : 0))); });
    b.set(4, 4, rp[0]); b.set(2, 1, rp[4]);
  } else {
    // a broken valve lying cupped up, its pale inside showing
    for (let x = 0; x < 5; x++) b.set(x, 4, at(rp, 2 - (x === 4 ? 1 : 0)));
    for (let x = 1; x < 4; x++) b.set(x, 3, rp[4]);
    b.set(rng.int(1, 3), 3, rp[3]);
  }
  return { buf: b, ax: 3, ay: 4 };
}

/**
 * A reef rock for the foreground and the floor plane: a hand-shaped outline from knots (steep shoulders,
 * flattish facets, an undercut foot), each facet lit by its slope, a lit lip along the top, a crack or
 * two, a pink coralline skin on the crown in patches, turf strands breaking the top edge.
 */
export function reefRock(seed: number, w: number, h: number, water?: C, hz = 0): Sprite {
  const rng = new Rng(seed * 53 + 17);
  const W = Math.ceil(w + 2), H = Math.ceil(h + 5), base = H - 1;
  const b = new PixelBuffer(W, H);
  const n = rng.int(6, 9);
  const kn: [number, number][] = [[0, 0]];
  for (let i = 1; i < n; i++) {
    const u = i / n + rng.range(-0.25, 0.25) / n;
    const edge = Math.min(u, 1 - u);
    kn.push([u, clamp((edge < 0.12 ? 0.35 + edge * 3 : 0.72 + rng.range(-0.18, 0.28)), 0.2, 1)]);
  }
  kn.push([1, 0]);
  const top = (t: number) => { let j = 1; while (j < kn.length - 1 && kn[j][0] < t) j++; const [a, ha] = kn[j - 1], [e, he] = kn[j]; const q = (t - a) / Math.max(1e-6, e - a); return { h: ha + (he - ha) * q, sl: (he - ha) / Math.max(1e-6, e - a) }; };
  const crustSeed = rng.int(1, 999);
  for (let x = 0; x < W - 1; x++) {
    const t = (x + 0.5) / (W - 1);
    const tp = top(t);
    const ht = tp.h * h;
    // the foot is undercut a little at the ends
    const foot = t < 0.08 || t > 0.92 ? 1 : 0;
    for (let k = foot; k < ht; k++) {
      const y = base - k, e = ht - k;
      let f = 4.4 - (1 - k / ht) * 1.8 + clamp(tp.sl * 0.15, -1, 1) * 1.3 - t * 0.9 + (noise1(x * 0.3 + k * 0.2, seed) - 0.5) * 1.2;
      if (e < 1.5) f = 7.2 + clamp(tp.sl * 0.15, -1, 1);
      else if (e < 3.5) f += 1;
      if (Math.abs(noise1(x * 0.12 + k * 0.05, seed + 3) - 0.5) < 0.02 && e > 3) f -= 2.4;
      let c = at(ROCK, f);
      if (e < 3 && noise1(x * 0.25, crustSeed) > 0.45) c = at(CORAL, e < 1.5 ? 5 : 3);
      b.set(x, y, c);
    }
    // turf strands off the top
    if (h01(x, 1, seed) < 0.45) {
      const sh = 1 + Math.floor(h01(x, 2, seed) * 3);
      for (let k = 1; k <= sh; k++) b.set(x, base - Math.ceil(ht) - k + 1, at(r('#2c3412', '#3a4418', '#55601e', '#727c2a', '#8e9638'), 4 - (sh - k)));
    }
  }
  outlineSel(b, 0.45);
  return { buf: haze(b, water, hz), ax: Math.floor(W / 2), ay: base };
}
