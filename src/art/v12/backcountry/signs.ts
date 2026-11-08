// V12 Te Tuawhenua, the story props: the signs the two big animals leave on the land, and the things
// that make the open country a place, painted pixel by pixel (never stacked primitives):
//   clawScore        the Bearer's marks on a trunk: one great hooked gouge and three lesser ones raked
//                    down the bark, pale wood inside, shadow on the upper lip, splinters curling out
//                    and torn bark hanging, beads of fresh sap
//   paintPlume       a feathered boa's plume lying in the grass (or caught upright): bronze-green
//                    vanes with a teal sheen, a cream rachis, a pale bar near the tip, down at the quill
//   paintSkinLog     a fallen log with a shed boa skin draped over it: papery, translucent, scale rows
//                    with the feather pits, wrinkled, torn at the edges, the eye caps at the head end
//   paintBonePile    a kill site: a serpent's picked-clean spine and ribs and its flat skull with the
//                    recurved teeth (or a beast's skull and long bones), plumes scattered, a dark stain
//   paintWallow      the boa's wallow: a coil of crushed fern pressed into the ground, a few plumes
//   paintDenMouth    the Bearer's den (its arch and overhang are cut into the gorge wall): the scraped
//                    bed of crushed fern and raked earth, fur, bones pushed aside, rubble, hanging roots
//   paintCache       its food cache: a raked mound of earth and fern over a kill, a feathered tail out
//   paintTrailCairn  a cairn of flat river stones marking the track, a quartz stone on top
//   paintGravelBar   a hump of river cobbles and sand on the flats, a stranded twig
//   paintLog         driftwood bleached silver, or a charred log from the fire
//   paintGorgeWall   the claw gorge's back wall: a face broken into lit and shadowed facets, tilted
//                    bedding, long fractures, moss and tussock on the ledges, seepage streaks, lichen
//                    colonies, the den's low arch with its overhang and claw scratches, the ledge
//   paintCrag        a tall crag for the foreground (softened by the caller): the gorge's near side
// Lit from the upper left; a dark ink edge on the lower right. Anchors: bottom centre unless noted.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { Rng, bayer, clamp, fbm1, hash2, noise1, noise2 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { outlineSel, trimSprite } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { FP } from '../../v11/forest/kit';
import { HP } from '../../v11/hills/kit';
import { paintStepLog } from '../swamp/props';
import { TP, pick, hp, dz, vor, VO } from './kit';

const set = (b: PixelBuffer, x: number, y: number, c: C) => { if (c) b.set(Math.floor(x), Math.floor(y), c); };
const opaque = (b: PixelBuffer, x: number, y: number) => (b.get(Math.floor(x), Math.floor(y)) >>> 24) > 0;
const FRESH = TP.kpaper;
const SAP = [hex('#7a4a10'), hex('#b8781c'), hex('#e8b040')];

// ---------------------------------------------------------------- the claw marks
/**
 * Rake the Bearer's claw marks down a trunk painted in `b` along its centre line `stem` (bottom first).
 * The gouges start well above Mori's head (it stands up to mark) and rake down and a little sideways;
 * the inner one is the great hooked claw: twice as wide, deeper, ending in a hook.
 */
export function clawScore(b: PixelBuffer, stem: P[], gy: number, h: number, seed: number, bark: C[]) {
  const rng = new Rng(seed * 97 + 31);
  const xAt = (y: number) => {
    for (let i = 1; i < stem.length; i++) if (stem[i][1] <= y) { const [ax, ay] = stem[i - 1], [bx, by] = stem[i]; const t = (y - ay) / (by - ay || 1); return ax + (bx - ax) * t; }
    return stem[stem.length - 1][0];
  };
  const top = gy - Math.min(h * 0.6, rng.range(86, 104)), bot = gy - Math.min(h * 0.3, rng.range(36, 48));
  const charred = bark === TP.char;
  for (let g = 0; g < 4; g++) {
    const big = g === 1;
    const off = (g - 1.4) * 4.6 + rng.range(-0.4, 0.4);
    const y0 = top + rng.range(0, 8) + (big ? -4 : 0), y1 = bot + rng.range(-8, 4) + (big ? 6 : 0);
    const hw = big ? 1.4 : 0.55;
    for (let y = y0; y <= y1; y += 0.5) {
      const t = (y - y0) / (y1 - y0);
      // raked down and across, the hook curling at the end of the big one
      const hook = big && t > 0.82 ? (t - 0.82) * 22 : 0;
      const cx = xAt(y) + off + t * 3.4 + hook;
      const w = hw * (t < 0.1 ? t / 0.1 : t > 0.9 && !big ? (1 - t) / 0.1 : 1);
      for (let u = -w - 0.5; u <= w + 0.5; u += 0.5) {
        const x = cx + u;
        if (!opaque(b, x, y)) continue;
        // upper-left lip in shadow, the far wall lit, raw wood between with its grain
        const e = u / Math.max(0.6, w);
        let c: C;
        if (e < -0.6) c = pick(charred ? TP.char : bark, 0);
        else if (e > 0.7) c = pick(FRESH, 5);
        else c = pick(FRESH, (big ? 2.4 : 3) + (e + 1) * 0.9 + (hash2(Math.floor(x), Math.floor(y / 2), seed) < 0.2 ? -1 : 0) + dz(x, y, 0.5));
        set(b, x, y, c);
      }
      // splinters curling out of the far edge
      if (hash2(Math.floor(y), g, seed + 5) < (big ? 0.12 : 0.06)) {
        const L = 2 + Math.floor(hash2(Math.floor(y), g, seed + 6) * 4);
        for (let j = 1; j <= L; j++) set(b, cx + w + j * 0.8, y + j * 0.6, pick(FRESH, 4 - j * 0.4));
      }
    }
    // torn bark hanging off the bottom of the gouge
    const ty = y1 + 1, tx = xAt(ty) + off + 3.4 + (big ? 3.5 : 0);
    const L = rng.int(3, big ? 8 : 5);
    for (let j = 0; j < L; j++) set(b, tx + (j > L / 2 ? 1 : 0), ty + j, pick(charred ? TP.charSheen : bark, (charred ? 1 : 4) + (j & 1)));
  }
  // beads of fresh sap weeping from the big gouge
  if (!charred) for (let k = 0; k < 4; k++) {
    const y = top + rng.range(10, (bot - top) * 0.8), x = xAt(y) - 1.4 * 3.6 + 3.6 + ((y - top) / (bot - top)) * 3.4 + 2.4;
    if (!opaque(b, x, y)) continue;
    set(b, x, y, SAP[1]); set(b, x, y + 1, SAP[0]); set(b, x - 1, y, SAP[2]);
  }
}

// ---------------------------------------------------------------- the feathered boa
/** one of the boa's plumes. upright: caught standing in the grass (else lying on the ground) */
export function paintPlume(seed: number, len: number, upright = false): Sprite {
  const rng = new Rng(seed * 53 + 7);
  const W = len + 8, H = upright ? len + 6 : Math.round(len * 0.4) + 8;
  const b = new PixelBuffer(W, H);
  // the rachis: a gentle curve; lying flat it runs along x (foreshortened vanes), upright it rises
  const pts: P[] = [];
  const ang = upright ? -Math.PI / 2 + rng.range(-0.35, 0.35) : rng.range(-0.18, 0.1);
  const bend = rng.range(-0.012, 0.012) * (upright ? 1 : 0.6);
  let x = upright ? W / 2 - Math.cos(ang) * len * 0.5 : 3, y = upright ? H - 2 : H - 4;
  let a = ang;
  for (let i = 0; i <= len; i++) { pts.push([x, y]); x += Math.cos(a); y += Math.sin(a); a += bend * (upright ? -1 : 1); }
  const vane = upright ? 3.2 : 1.6;
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    const [px, py] = pts[i];
    const j = Math.min(pts.length - 1, i + 1), k = Math.max(0, i - 1);
    const ta = Math.atan2(pts[j][1] - pts[k][1], pts[j][0] - pts[k][0]);
    const nx = -Math.sin(ta), ny = Math.cos(ta);
    // the vane: widest a third of the way up, tapering to the tip; split into barbs here and there
    const wv = vane * (t < 0.12 ? t / 0.12 : 1 - Math.pow(Math.max(0, t - 0.35) / 0.65, 1.6) * 0.85);
    const notch = hash2(i, 1, seed) < 0.1 && t > 0.2 && t < 0.9;
    for (const side of [-1, 1]) for (let s = 0.5; s <= wv; s += 0.5) {
      if (notch && side > 0 && s > wv * 0.4) continue;
      const qx = px + nx * s * side + (upright ? 0 : -s * 0.3), qy = py + ny * s * side;
      const lit = side < 0 ? 1 : -0.6;
      let c: C;
      if (t < 0.12) c = pick(TP.silver, 7 + lit + (hash2(Math.floor(qx), Math.floor(qy), seed) < 0.4 ? 1 : 0));            // the down
      else if (t > 0.78 && t < 0.86) c = pick(TP.plumeBar, 2.6 + lit);                                                          // the pale bar
      else {
        c = pick(TP.plume, 4.6 + lit * 1.6 - (s > wv - 0.6 ? 1 : 0) + (t > 0.86 ? -1 : 0) + dz(qx, qy, 0.6));
        // the teal sheen: a band of iridescence across the vane, shifting with the barbs
        if (Math.abs(Math.sin(t * 9 + s * 0.8 + seed)) > 0.82 && lit > 0) c = pick(TP.sheen, 2 + (s < wv * 0.5 ? 1 : 0));
      }
      set(b, qx, qy, c);
    }
    set(b, px, py, pick(TP.plumeBar, t < 0.12 ? 2 : 3.6 - t * 1.4));
  }
  outlineSel(b, 0.45);
  const base = pts[0];
  return trimSprite({ buf: b, ax: upright ? Math.round(base[0]) : Math.round(W / 2), ay: upright ? Math.round(base[1]) + 1 : H - 2 });
}

/** a fallen log with a shed feathered-boa skin draped over it; the anchor is the log's foot middle */
export function paintSkinLog(seed: number, len: number): Sprite {
  const rng = new Rng(seed * 37 + 3);
  const dia = Math.round(len * 0.13 + 10);
  const L = paintStepLog(seed, len, dia);
  const PAD = 10;
  const b = new PixelBuffer(L.buf.w + PAD * 2, L.buf.h + PAD * 2);
  b.blit(L.buf, PAD, PAD);
  const top = (x: number) => PAD + L.ay + L.top(x) ;
  const footY = PAD + L.buf.h - 3;
  // the skin's path: up out of the ferns on one side, over the log in a loose loop, trailing off the
  // far side to the ground (a long flattened papery tube)
  const path: P[] = [];
  const x0 = PAD + L.ax + len * rng.range(0.1, 0.2), x1 = PAD + L.ax + len * rng.range(0.78, 0.92);
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 - 8 + (x1 - x0 + 16) * t;
    const over = Math.sin(Math.min(1, t * 1.25) * Math.PI);
    const lx = clamp(x - PAD - L.ax, 2, len - 2);
    const y = (top(lx) - 1) * over + footY * (1 - over) + Math.sin(t * 13 + seed) * 1.6 * over;
    path.push([x, y]);
  }
  for (let i = 0; i < path.length; i++) {
    const t = i / (path.length - 1);
    const [px, py] = path[i];
    const j = Math.min(path.length - 1, i + 1), k = Math.max(0, i - 1);
    const ta = Math.atan2(path[j][1] - path[k][1], path[j][0] - path[k][0]);
    const nx = -Math.sin(ta), ny = Math.cos(ta);
    // flattened: wider at the body, a narrow tail; the head end at t=1 with its eye caps
    const hw = (t < 0.15 ? 1 + t * 22 : 4.3 + Math.sin(t * 5) * 0.5) * (t > 0.93 ? 1 + (t - 0.93) * 5 : 1);
    const wr = Math.floor(t * 70 + noise1(t * 20, seed) * 2);
    for (let s = -hw; s <= hw; s += 0.5) {
      const qx = px + nx * s, qy = py + ny * s;
      // ragged torn edges
      if (Math.abs(s) > hw - 1 && hash2(Math.floor(qx), Math.floor(qy), seed + 1) < 0.35) continue;
      // scale rows: a diamond lattice; each scale with a tiny feather pit at its centre
      const u = t * len * 0.8, v = s;
      const du = ((u + v) % 3 + 3) % 3, dv = ((u - v) % 3 + 3) % 3;
      const edge = du < 0.6 || dv < 0.6;
      const pit = Math.abs(du - 1.5) < 0.4 && Math.abs(dv - 1.5) < 0.4;
      const lit = -s / hw * 0.8 + (s < 0 ? 0.6 : 0);
      let c = pick(TP.skin, 5 + lit + (edge ? -1.2 : 0) + (pit ? -2 : 0) + (wr % 7 === 0 ? -1.4 : 0) + dz(qx, qy, 0.5));
      // translucent: the log shows through the thinnest parts
      const under = b.get(Math.floor(qx), Math.floor(qy));
      if (under >>> 24 && !edge && !pit && hash2(Math.floor(qx), Math.floor(qy), seed + 2) < 0.3) c = mix(c, under, 0.35);
      set(b, qx, qy, c);
    }
    // a few downy feathers still stuck in the pits along the back
    if (hash2(i, 3, seed) < 0.06 && t > 0.2 && t < 0.9) for (let q = 0; q < 3; q++) set(b, px - nx * (hw + q * 0.6) - q * 0.4, py - ny * (hw + q * 0.6) - q * 0.3, pick(TP.plume, 5 - q + (q === 2 ? 2 : 0)));
  }
  // the head end: the clear eye caps, the jaw lines
  const [hx, hy] = path[path.length - 3];
  set(b, hx - 1, hy - 3, pick(TP.skin, 7)); set(b, hx, hy - 3, pick(TP.skin, 6)); set(b, hx - 1, hy - 2, pick(TP.skin, 3));
  set(b, hx + 2, hy + 1, pick(TP.skin, 2)); set(b, hx + 3, hy + 1, pick(TP.skin, 2)); set(b, hx + 4, hy, pick(TP.skin, 3));
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(PAD + L.ax + len / 2), ay: footY + 2 });
}

// ---------------------------------------------------------------- the kill sites
/** a little bone: a shaft with knuckled ends (seen from above-side) */
function bone(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r: number, seed: number) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const knob = t < 0.12 || t > 0.88 ? 1 : 0;
    const rr = r + knob * 0.8;
    for (let v = -rr; v <= rr; v += 0.5) {
      const lit = -v / rr;
      set(b, x + (y1 - y0) / L * v * -1, y + (x1 - x0) / L * v, pick(TP.bone, 5 + lit * 1.6 + (hash2(Math.floor(x), Math.floor(y), seed) < 0.1 ? -1 : 0)));
    }
  }
}
/** a kill site. kind: 'serpent' (a boa's spine, ribs and skull) or 'beast' (a big skull and long bones) */
export function paintBonePile(seed: number, w: number, kind: 'serpent' | 'beast'): Sprite {
  const rng = new Rng(seed * 29 + 13);
  const W = w + 20, H = Math.round(w * 0.36) + 22;
  const b = new PixelBuffer(W, H);
  const gy = H - 4;
  // the stain: trampled earth and old blood, ragged
  for (let x = 4; x < W - 4; x++) {
    const u = (x - W / 2) / (w * 0.55);
    const r = 1 - u * u;
    if (r <= 0) continue;
    const hh = Math.round(r * 4 + noise1(x / 5, seed) * 2);
    for (let j = -1; j < hh; j++) if (hash2(x, j, seed) < 0.85) set(b, x, gy + 2 - j, j < 1 && hash2(x, 3, seed) < 0.4 ? pick(TP.blood, 1 + hash2(x, j, seed + 1) * 2) : pick(TP.earth, 2 + j * 0.6 + dz(x, j)));
  }
  if (kind === 'serpent') {
    // the spine: a chain of vertebrae lying in a loose S along the ground, ribs arcing up in pairs
    const n = Math.round(w / 3.4);
    const sx0 = 10, span = w - 4;
    const spine: P[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      spine.push([sx0 + span * t, gy - 2 - Math.sin(t * Math.PI * 1.6 + seed) * 2.6 - (t > 0.85 ? (t - 0.85) * 12 : 0)]);
    }
    spine.forEach(([x, y], i) => {
      const t = i / (n - 1);
      // a rib pair: picked clean, curving up and over; some broken off, some missing
      if (t > 0.08 && t < 0.86 && hash2(i, 1, seed) < 0.82) {
        const rh = (5 + Math.sin(t * Math.PI) * 9) * rng.range(0.75, 1.05);
        const broken = hash2(i, 2, seed) < 0.25 ? rng.range(0.4, 0.75) : 1;
        for (const side of [-1, 1]) {
          const lean = side * 0.9 + 0.6;
          const m = Math.round(rh * 2 * broken);
          for (let j = 0; j < m; j++) {
            const q = j / (rh * 2);
            const rx = x + lean * Math.sin(q * 2.2) * 3.2 + q * 1.4, ry = y - 1 - Math.sin(q * 1.9) * rh;
            set(b, rx, ry, pick(TP.bone, (side < 0 ? 6.4 : 4.6) - q * 1.2 + (j === m - 1 && broken < 1 ? -2 : 0)));
          }
        }
      }
      // the vertebra itself: a knuckle with a spine on top
      set(b, x - 1, y, pick(TP.bone, 5)); set(b, x, y, pick(TP.bone, 6)); set(b, x + 1, y, pick(TP.bone, 4));
      set(b, x - 1, y + 1, pick(TP.bone, 3)); set(b, x, y + 1, pick(TP.bone, 4)); set(b, x + 1, y + 1, pick(TP.bone, 2));
      set(b, x, y - 1, pick(TP.bone, 7)); if (i % 2 === 0) set(b, x + 1, y - 2, pick(TP.bone, 6));
    });
    // the skull at the head end: flat and broad, the eye socket, the jaw lying apart with its recurved teeth
    const [hx, hy] = spine[n - 1];
    const sk = Math.round(w * 0.1 + 5);
    for (let i = 0; i < sk * 2; i++) for (let j = 0; j < sk; j++) {
      const u = i / (sk * 2), v = j / sk;
      const shape = Math.sin(u * Math.PI * 0.9 + 0.2) * (1 - v * 0.5);
      if (v > shape) continue;
      const c = pick(TP.bone, 6.4 - v * 3 - u * 0.8 + dz(i, j, 0.6));
      set(b, hx + 2 + i, hy + 1 - j, c);
    }
    set(b, hx + 2 + Math.round(sk * 0.7), hy - Math.round(sk * 0.45), pick(TP.bone, 0)); set(b, hx + 3 + Math.round(sk * 0.7), hy - Math.round(sk * 0.45), pick(TP.bone, 1));
    for (let i = 0; i < sk * 2; i++) {
      const jx = hx + 6 + i, jy = gy + 1 - Math.round(Math.sin((i / (sk * 2)) * Math.PI) * 1.5);
      set(b, jx, jy, pick(TP.bone, 4.6));
      if (i % 3 === 1) set(b, jx, jy - 1, pick(TP.bone, 7));
    }
    // scattered plumes from the kill
    for (let k = 0; k < rng.int(2, 4); k++) {
      const px = rng.range(6, W - 10), py = gy + rng.range(-1, 2), L = rng.int(6, 10);
      for (let i = 0; i < L; i++) { set(b, px + i, py - i * 0.15, pick(TP.plume, 5 - (i > L - 3 ? 1 : 0))); set(b, px + i, py + 1 - i * 0.15, pick(TP.plume, 3)); }
      set(b, px + L - 2, py - L * 0.15, pick(TP.plumeBar, 3));
    }
  } else {
    // a big beast's skull with a bony face plate, a long bone or two, a scatter of ribs
    const sx = W * 0.62, sy = gy - 2, R = Math.round(w * 0.12 + 6);
    for (let i = -R; i <= R + 4; i++) for (let j = 0; j <= R; j++) {
      const u = i / R, v = j / R;
      const prof = Math.sqrt(Math.max(0, 1 - (u * 0.85) ** 2)) * (u > 0.6 ? 0.7 : 1);
      if (v > prof) continue;
      let c = pick(TP.bone, 6 - v * 2.4 - (u > 0 ? 0.6 : 0) + dz(i, j, 0.6));
      // the face plate: ridged, a band of rougher bone across the brow
      if (u < -0.1 && u > -0.7 && v > 0.45) c = pick(TP.bone, 4.4 + (hash2(i, j, seed) < 0.3 ? 1 : 0) + (j % 2 ? 0.6 : -0.4));
      set(b, sx + i, sy - j, c);
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(b, sx + Math.round(R * 0.25) + i, sy - Math.round(R * 0.55) + j, pick(TP.bone, j === 0 ? 1 : 0));
    for (let i = 0; i < 4; i++) set(b, sx + R + 2 + i, sy - 1 + (i & 1), pick(TP.bone, 6));
    bone(b, 8, gy - 2, W * 0.42, gy - 4, 1, seed);
    bone(b, W * 0.2, gy, W * 0.5, gy - 1, 0.8, seed + 1);
    for (let k = 0; k < 5; k++) {
      const x = 10 + k * 5 + rng.range(-1, 1), rh = rng.range(5, 9);
      for (let j = 0; j < rh * 2; j++) { const q = j / (rh * 2); set(b, x + Math.sin(q * 2.4) * 4, gy - 1 - Math.sin(q * 2) * rh, pick(TP.bone, 6 - q * 2)); }
    }
  }
  // a tuft of grass growing through the bones
  for (let k = 0; k < 6; k++) {
    const x = rng.range(4, W - 4), L = rng.int(3, 7);
    for (let j = 0; j < L; j++) set(b, x + (j > L / 2 ? 1 : 0), gy + 2 - j, pick(HP.tussock, 4 + j * 0.5));
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(W / 2), ay: gy + 2 });
}

/** the boa's wallow: a coil of crushed fern pressed into the gully floor (lies flat on the floor) */
export function paintWallow(seed: number, w: number): Sprite {
  const rng = new Rng(seed * 47 + 1);
  const H = Math.round(w * 0.24) + 6, W = w + 10;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x - cx) / (w / 2), v = (y - cy) / (H / 2 - 2);
    const an = Math.atan2(v, u);
    const rr = Math.sqrt(u * u + v * v) + (noise1(an * 2.2 + 9, seed) - 0.5) * 0.42 + (noise1(an * 7 + 3, seed + 1) - 0.5) * 0.16;
    if (rr > 1) continue;
    // fronds flattened in a spiral, following the boa's coils; a darker pressed core
    const ang = Math.atan2(v, u);
    const sp = Math.sin(ang * 1 + rr * 13 + seed);
    const frond = Math.abs(Math.sin(ang * 6 + rr * 9)) < 0.3;
    let c = rr < 0.35 ? pick(FP.mud, 3 + (sp > 0 ? 1 : 0) + dz(x, y)) : pick(rr > 0.75 && hash2(x, y, seed) < 0.3 ? TP.brackenDry : FP.fern, (sp > 0.2 ? 4.4 : 2.6) + (frond ? 1 : 0) - rr * 0.6 + dz(x, y, 0.6));
    if (rr > 0.35 && rr < 0.42) c = pick(FP.soil, 3);
    // bruised stems, the odd snapped one
    if (hash2(x, y, seed + 2) < 0.02) c = pick(FP.fern, 7);
    set(b, x, y, c);
  }
  // snapped stems still standing at the rim, plumes lost in the coil
  for (let k = 0; k < 9; k++) {
    const a = rng.range(0, Math.PI * 2), x = cx + Math.cos(a) * w * 0.5, y = cy + Math.sin(a) * (H / 2 - 2);
    const L = rng.int(3, 7);
    for (let j = 0; j < L; j++) set(b, x + (j > L - 3 ? (k & 1 ? 1 : -1) * (j - L + 3) : 0), y - j, pick(FP.fern, 4 + (j & 1)));
  }
  for (let k = 0; k < 3; k++) {
    const x = cx + rng.range(-w * 0.3, w * 0.3), y = cy + rng.range(-2, 2), L = rng.int(7, 11);
    for (let i = 0; i < L; i++) { set(b, x + i, y - i * 0.1, pick(TP.plume, 5 + (i < 2 ? 2 : 0))); set(b, x + i, y + 1 - i * 0.1, pick(TP.plume, 3)); }
    set(b, x + L - 2, y - L * 0.1, pick(TP.sheen, 3));
  }
  outlineSel(b, 0.3);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: Math.round(cy) });
}

// ---------------------------------------------------------------- the Bearer's den and its cache
/** the den's mouth dressing (the arch itself is cut into the gorge wall: paintGorgeWall's recess): the
 *  scraped bed of crushed fern and raked earth, tufts of dark fur, bones shoved to the sides, rubble
 *  fallen from the overhang, roots and fern hanging from the lip. w, h: the arch; anchor bottom centre */
export function paintDenMouth(seed: number, w: number, h: number): Sprite {
  const rng = new Rng(seed * 59 + 21);
  const W = w + 70, H = h + 10;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 4;
  const mw = w;
  // roots, strands and a fern frond hanging from the lip into the mouth
  for (let k = 0; k < 11; k++) {
    const u = rng.range(-0.42, 0.42), x = cx + u * mw;
    const y0 = gy - h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u) * 2, 2.4)), 0.5) + 2;
    const Lh = rng.int(4, 14), fern = k % 4 === 0;
    for (let j = 0; j < Lh; j++) set(b, x + Math.sin(j * 0.6 + k) * 0.8, y0 + j, fern ? pick(FP.fern, 4 + (j & 1)) : j === Lh - 1 ? pick(FP.moss, 4) : pick(TP.earth, 2 + (j & 1)));
  }
  // the scraped bed: crushed fern and raked earth heaped in the mouth
  for (let x = Math.round(cx - mw * 0.44); x < cx + mw * 0.44; x++) {
    const u = (x - cx) / (mw * 0.44);
    const hh = Math.round((1 - u * u) * 7 + noise1(x / 3, seed + 9) * 3);
    for (let j = 0; j < hh; j++) {
      const fern = hash2(x, j, seed + 10) < 0.55;
      set(b, x, gy - j, fern ? pick(j > hh - 3 ? TP.brackenDry : FP.fern, 2.4 + (j > hh - 3 ? 2 : 0) + (hash2(x, j, seed) < 0.2 ? 1 : 0)) : pick(TP.earth, 3 + j * 0.3 + dz(x, j)));
    }
  }
  // tufts of coarse dark fur caught in it
  for (let k = 0; k < 6; k++) {
    const x = cx + rng.range(-mw * 0.36, mw * 0.36), y = gy - rng.int(2, 6);
    for (let i = 0; i < 4; i++) set(b, x + i * 0.7, y - (i === 1 || i === 2 ? 1 : 0), i === 0 ? hex('#2a1a12') : i === 3 ? hex('#4a3020') : hex('#3a2418'));
  }
  // bones shoved aside: a long bone, a rib arc, a vertebra
  for (let k = 0; k < 4; k++) {
    const side = k % 2 ? 1 : -1;
    const x = cx + side * mw * rng.range(0.3, 0.5), y = gy - 1;
    if (k < 2) { const Lb = rng.int(7, 12); for (let i = 0; i < Lb; i++) set(b, x + i * side * 0.9, y - (i === 0 || i === Lb - 1 ? 1 : 0), pick(TP.bone, 6.4 - (i > Lb / 2 ? 1 : 0))); }
    else { const rh = rng.range(5, 8); for (let j = 0; j < rh * 2; j++) { const q = j / (rh * 2); set(b, x + Math.sin(q * 2.4) * 4 * side, y - Math.sin(q * 2) * rh, pick(TP.bone, 6.4 - q * 2)); } }
  }
  // rubble fallen from the overhang either side of the mouth
  for (let k = 0; k < 14; k++) {
    const side = k % 2 ? 1 : -1, x = cx + side * (mw / 2 + rng.range(-4, 26)), r = rng.range(2, 5.5);
    for (let j = -r; j <= 0.5; j++) for (let i = -r * 1.3; i <= r * 1.3; i++) {
      if ((i / (r * 1.3)) ** 2 + (j / r) ** 2 > 1 + (hash2(Math.floor(i), Math.floor(j), seed + k) - 0.5) * 0.5) continue;
      set(b, x + i, gy + 1 + j, pick(TP.rock, 5.4 - j * 0.7 - i * 0.25 + dz(x + i, j, 0.6) + (hash2(k, 1, seed) < 0.3 ? -1 : 0)));
    }
  }
  // raked earth spilling out of the mouth: the claw furrows
  for (let x = Math.round(cx - mw * 0.62); x < cx + mw * 0.62; x++) {
    const fur = Math.abs(Math.sin(x * 0.7)) < 0.3;
    set(b, x, gy + 1, pick(TP.earth, fur ? 1 : 4)); set(b, x, gy + 2, pick(TP.earth, fur ? 2 : 3));
  }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

/** the cache: a raked-over mound of earth and fern, a feathered tail sticking out of it */
export function paintCache(seed: number, w: number): Sprite {
  const rng = new Rng(seed * 67 + 9);
  const H = Math.round(w * 0.42) + 10, W = w + 16;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 3;
  for (let x = 6; x < W - 6; x++) {
    const u = (x - cx) / (w / 2);
    if (Math.abs(u) > 1) continue;
    const hh = Math.round(Math.sqrt(1 - u * u) * w * 0.26 + Math.max(0, 1 - Math.abs(u + 0.35) * 3) * w * 0.1 + Math.max(0, 1 - Math.abs(u - 0.3) * 4) * w * 0.07 + (noise1(x / 5, seed) - 0.5) * 4);
    for (let j = 0; j < hh; j++) {
      const top = j > hh - 3;
      // claw-raked furrows across the mound
      const fur = Math.abs(Math.sin(x * 0.5 + j * 0.9)) < 0.25;
      let c = top && hash2(x, j, seed) < 0.5 ? pick(hash2(x, 1, seed) < 0.5 ? FP.fern : TP.brackenDry, 3 + (u < 0 ? 1 : 0)) : pick(TP.earth, 3.6 - u * 1.2 + (fur ? -1.4 : 0) + (j > hh * 0.6 ? 0.8 : 0) + dz(x, j, 0.6));
      if (hash2(x, j, seed + 2) < 0.06) c = pick(FP.litter, 3);
      set(b, x, gy - j, c);
    }
  }
  // the tail tip: scaled and feathered, coming out of the mound's foot
  const tx = cx + w * 0.32, ty = gy - 2;
  for (let i = 0; i < 16; i++) {
    const x = tx + i, y = ty + Math.sin(i * 0.4) * 1.4 - i * 0.18, r = 2.2 - i * 0.12;
    for (let v = -r; v <= r; v += 0.5) set(b, x, y + v, pick(TP.plume, 4.4 - v + (i % 3 === 0 ? -1 : 0)));
    if (i % 3 === 1) { set(b, x, y - r - 1, pick(TP.sheen, 2)); set(b, x + 1, y - r - 2, pick(TP.plume, 6)); }
  }
  // flies' bones: a rib sticking up out of the soil
  for (let k = 0; k < 2; k++) {
    const x = cx - w * 0.2 + k * 7, L = rng.int(6, 9);
    for (let j = 0; j < L; j++) set(b, x + Math.sin(j * 0.3) * 2, gy - w * 0.22 - j, pick(TP.bone, 6 - j * 0.3));
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- the track, the river
/** a cairn of flat, irregular river stones stacked off-true, a quartz stone on the top */
export function paintTrailCairn(seed: number, h: number): Sprite {
  const rng = new Rng(seed * 19 + 5);
  const W = Math.round(h * 1.3) + 10, H = h + 6;
  const b = new PixelBuffer(W, H);
  const cx = W / 2;
  let y = H - 2, w = h * 0.58, ox = cx;
  let k = 0;
  while (y > 6 && w > 3) {
    const sh = Math.max(3, Math.round(w * rng.range(0.3, 0.5)));
    ox += rng.range(-1.8, 1.8);
    const quartz = w < 6 || (k > 2 && rng.chance(0.15));
    const ramp = quartz ? TP.quartz : rng.chance(0.25) ? TP.rockWarm : TP.gravel;
    const tilt = rng.range(-0.12, 0.12), lw = rng.range(0.8, 1.15), rw = rng.range(0.8, 1.15);
    const chip = rng.int(0, sh * 2);
    for (let j = 0; j < sh; j++) {
      const v = j / sh;
      // each stone its own slab: flat-ish top and bottom, one end blunter than the other, a chip out of it
      const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v * 2 - 1), 2.6)), 0.4);
      const hl = w * lw * prof * (1 + (noise1(j * 0.9 + k * 9, seed) - 0.5) * 0.3);
      const hr = w * rw * prof * (1 + (noise1(j * 0.9 + k * 9 + 40, seed) - 0.5) * 0.3) - (j === chip % sh ? 2 : 0);
      const yy = y - j;
      for (let i = -Math.ceil(hl); i <= Math.ceil(hr); i++) {
        if (i < -hl || i > hr) continue;
        const sx = ox + i, sy2 = yy + i * tilt;
        const u = i < 0 ? i / hl : i / Math.max(1, hr);
        const l = -u * 0.8 - (v - 0.4) * 2.4 + (j === sh - 1 ? 1 : 0);
        let c = pick(ramp, (quartz ? 2 : 5) + l * (quartz ? 0.7 : 1.6) + dz(sx, sy2, 0.6));
        if (!quartz && hash2(Math.floor(sx), Math.floor(sy2), seed) < 0.05) c = pick(TP.lichenGold, 2 + (l > 0 ? 1 : 0));
        else if (!quartz && hash2(Math.floor(sx), Math.floor(sy2), seed + 1) < 0.05) c = pick(TP.lichen, 3);
        if (j === 0 && hash2(Math.floor(sx), 2, seed + k) < 0.3) c = pick(ramp, quartz ? 0 : 2);
        set(b, sx, sy2, c);
      }
    }
    // moss in the seam under each stone
    for (let i = -Math.round(w * 0.6); i < w * 0.6; i++) if (hash2(i, k, seed + 3) < 0.25) set(b, ox + i, y + 1 - (i > 0 ? 0 : 0), pick(FP.moss, 3 + (hash2(i, k, seed + 4) < 0.5 ? 1 : 0)));
    y -= sh - 1;
    w *= rng.range(0.68, 0.86);
    k++;
  }
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: H - 1 });
}

/** a hump of river cobbles and sand (lies on the floor in front of the walk line) */
export function paintGravelBar(seed: number, w: number): Sprite {
  const rng = new Rng(seed * 23 + 3);
  const H = Math.round(w * 0.12) + 8, W = w + 6;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  for (let x = 0; x < W; x++) {
    const u = (x - cx) / (w / 2);
    if (Math.abs(u) > 1) continue;
    const hh = Math.round((1 - u * u) * (H - 4) + (noise1(x / 3, seed) - 0.5) * 2);
    for (let j = 0; j <= hh; j++) set(b, x, gy - j, pick(TP.sand, 3 + j * 0.4 - u * 0.6 + dz(x, j)));
  }
  // cobbles over it, the round ones lit on top
  for (let k = 0; k < w / 3; k++) {
    const x = cx + rng.range(-w * 0.46, w * 0.46), u = (x - cx) / (w / 2);
    const top = gy - (1 - u * u) * (H - 4);
    const r = rng.range(1.2, 2.8), y = top + rng.range(0, (gy - top) * 0.8) + r * 0.4;
    const ramp = rng.chance(0.08) ? TP.quartz : rng.chance(0.15) ? TP.rockWarm : TP.gravel;
    for (let j = -r; j <= r * 0.8; j++) for (let i = -r * 1.3; i <= r * 1.3; i++) {
      if ((i / (r * 1.3)) ** 2 + (j / r) ** 2 > 1) continue;
      set(b, x + i, y + j, pick(ramp, (ramp === TP.quartz ? 2 : 5.4) - j * 0.8 - i * 0.25 + dz(x + i, y + j, 0.5)));
    }
  }
  // a stranded twig
  if (rng.chance(0.6)) { const x = cx + rng.range(-w * 0.3, w * 0.1), L = rng.int(8, 16); for (let i = 0; i < L; i++) set(b, x + i, gy - 3 - i * 0.18, pick(TP.silver, 6 - (i & 1))); }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy });
}

/** a log on the ground: driftwood bleached silver with its root plate, or charred from the fire. Bent
 *  and tapering, its far end snapped into splinters, knots and long cracks along it, sunk a little */
export function paintLog(seed: number, len: number, kind: 'drift' | 'char'): Sprite {
  const rng = new Rng(seed * 41 + 9);
  const dia = Math.round(len * 0.11 + 6);
  const W = len + 24, H = dia + 30;
  const b = new PixelBuffer(W, H);
  const gy = H - 3;
  const ramp = kind === 'drift' ? TP.silver : TP.char;
  const bend = rng.range(-0.5, 0.5), kink = rng.range(0.3, 0.7);
  const midY = (x: number) => gy - dia / 2 + 1 - Math.sin((x / len) * Math.PI) * bend * dia * 0.5 - (x / len > kink ? (x / len - kink) * rng.range(0, 0) : 0) - Math.sin(x * 0.07 + seed) * 0.6;
  const rr = (x: number) => (dia / 2) * (1 - (x / len) * 0.38) * (1 + (noise1(x / 7, seed) - 0.5) * 0.22 + Math.exp(-(((x - len * 0.3) / 6) ** 2)) * 0.12);
  const knots = [rng.range(0.2, 0.4), rng.range(0.55, 0.8)].map(t => Math.round(t * len));
  for (let x = 0; x < len; x++) {
    const my = midY(x), r = rr(x);
    const end = len - 1 - x;
    // the snapped end: ragged, splintering into points
    const splin = end < 8 ? (hash2(Math.floor(x / 2), 1, seed) * 8 > end ? 1 : 0) : 0;
    for (let y = Math.round(my - r); y <= Math.round(my + r); y++) {
      const v = (y + 0.5 - my) / r;
      if (splin && Math.abs(v) < 0.8 && hash2(x, y, seed + 1) < 0.6) continue;
      const l = -v * 1.5 + Math.sqrt(Math.max(0, 1 - v * v)) * 0.4;
      let c: C;
      if (kind === 'drift') {
        // the grain: long cracks running along the log, opening up where it dried
        const crack = Math.abs(Math.sin(v * 4.2 + noise1(x / 14, seed + 1) * 2.4)) < 0.1 && noise1(x / 22, seed + 2) > 0.3;
        c = pick(ramp, 5.6 + l * 1.7 + (crack ? -2.2 : 0) + (noise1(x / 3 + v * 2, seed + 3) - 0.5) * 0.8 + dz(x, y, 0.5));
      } else {
        // char breaks into checked blocks with a silver sheen on their lit faces
        vor(x, y * 1.4, 4.2, 4.2, seed);
        c = VO.e < 0.9 ? pick(ramp, 0) : pick(ramp, 3.6 + l * 1.3 + (-VO.dx - VO.dy) * 1.2);
        if (VO.e > 1.4 && v < -0.2 && VO.dy < -0.1 && hash2(x, y, seed) < 0.4) c = pick(TP.charSheen, 1 + l);
      }
      // knots: a dark eye with rings round it
      for (const k of knots) { const d = Math.hypot((x - k) * 0.8, (y - my + r * 0.2) * 1.4); if (d < 3.2) c = d < 1.3 ? pick(ramp, 1) : pick(ramp, (kind === 'drift' ? 4 : 2) + (d > 2.4 ? 1.5 : 0)); }
      // the cut end at the root: rings
      if (x < 2) c = pick(kind === 'drift' ? TP.silver : TP.ember, (kind === 'drift' ? 7 : 2) + (Math.floor(Math.hypot(v * 3, 1) * 2) % 2 ? -1.5 : 0));
      if (splin) c = pick(kind === 'drift' ? TP.silver : TP.char, kind === 'drift' ? 7 + l : 2 + l);
      set(b, x + 12, y, c);
    }
  }
  // the root plate at the thick end: roots splayed out, a stone caught in them (driftwood)
  if (kind === 'drift') {
    for (let k = 0; k < 8; k++) {
      const a = Math.PI * (0.55 + (k / 7) * 0.95) + rng.range(-0.15, 0.15);
      const L = dia * rng.range(0.6, 1.5);
      let x = 12, y = midY(0);
      for (let j = 0; j < L; j++) {
        x += Math.cos(a + Math.sin(j * 0.4 + k) * 0.25) * 0.7; y += Math.sin(a + Math.sin(j * 0.4 + k) * 0.25);
        for (let w = 0; w < (j < L * 0.45 ? 2 : 1); w++) set(b, x + w, y, pick(TP.silver, 6.4 - w * 2 - (j / L) * 2));
      }
    }
    const sx = 8, sy = midY(0) + 2;
    for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) if ((i / 3.4) ** 2 + (j / 2.4) ** 2 < 1) set(b, sx + i, sy + j, pick(TP.gravel, 6 - j * 0.8 - i * 0.2));
  } else for (let i = 0; i < len; i += 2) if (hash2(i, 5, seed) < 0.4) set(b, i + 12, gy + 1, pick(TP.ash, 5 + hash2(i, 6, seed) * 3));
  // a broken branch stub, and the side bark peeling (driftwood) or a crust of ash on top (char)
  const bx = Math.round(len * rng.range(0.35, 0.6)), top = Math.round(midY(bx) - rr(bx));
  const ang = -Math.PI / 2 + rng.range(-0.6, 0.6);
  for (let j = 0; j < dia * 0.9; j++) for (let w = 0; w < 2; w++) set(b, bx + 12 + Math.cos(ang) * j + w, top + 1 + Math.sin(ang) * j, pick(ramp, (kind === 'drift' ? 6 : 3) + (w === 0 ? 1 : -1)));
  for (let x = 4; x < len - 6; x++) if (hash2(x >> 1, 7, seed) < 0.3) set(b, x + 12, Math.round(midY(x) - rr(x)), kind === 'drift' ? pick(TP.silver, 8) : pick(TP.ash, 6));
  // sunk into the ground: grit and grass over its foot
  for (let x = 0; x < len; x += 1) if (hash2(x, 9, seed) < 0.35) { const L = 1 + Math.floor(hash2(x, 10, seed) * 3); for (let j = 0; j < L; j++) set(b, x + 12, gy - j, kind === 'drift' ? pick(TP.sand, 4 + j) : pick(TP.ash, 3 + j)); }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: Math.round(W / 2), ay: gy + 1 });
}

export interface WallOpts {
  /** the wall's foot (world y) and its top edge (world y; above the frame in the narrows) at local x */
  base: (x: number) => number;
  top: (x: number) => number;
  seed: number;
  /** dark recesses cut in at the foot (the den) */
  recess: { x: number; w: number; h: number }[];
  /** a shelf jutting out of the face (the ledge over the den) */
  shelf: { x0: number; x1: number; y: (x: number) => number } | null;
}
/** the gorge's back wall over local x 0..len; returns the buffer and the world y of its top row */
export function paintGorgeWall(len: number, o: WallOpts): { buf: PixelBuffer; y0: number } {
  let y0 = 1e9, y1 = -1e9;
  for (let x = 0; x < len; x++) { y0 = Math.min(y0, o.top(x)); y1 = Math.max(y1, o.base(x)); }
  y0 = Math.floor(y0) - 8; y1 = Math.ceil(y1) + 2;
  const H = y1 - y0;
  const b = new PixelBuffer(len, H);
  const s = o.seed;
  // facets: the face broken into angular planes (each lit by its own tilt), dark cracks where they
  // meet; big ones low down, smaller and more shattered up high
  const F = { nx: 0, ny: 0, e: 9, id: 0 };
  const facet = (x: number, y: number, sx: number, sy: number) => {
    const gx = Math.floor(x / sx), gq = Math.floor(y / sy);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const qx = gx + i, qy = gq + j;
      const px = (qx + 0.1 + hash2(qx, qy, s + 3) * 0.8) * sx, py = (qy + 0.1 + hash2(qx, qy, s + 4) * 0.8) * sy;
      const dx = x - px, dy = (y - py) * (sx / sy);
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; id = hash2(qx, qy, s + 5); } else if (d < d2) d2 = d;
    }
    F.id = id; F.e = Math.sqrt(d2) - Math.sqrt(d1);
    F.nx = (hash2(Math.floor(id * 9973), 1, s) - 0.5) * 2; F.ny = (hash2(Math.floor(id * 9973), 2, s) - 0.62) * 2;
  };
  for (let x = 0; x < len; x++) {
    const top = o.top(x), base = o.base(x);
    const rib = noise1(x / 46, s + 1) * 0.7 + noise1(x / 13, s + 2) * 0.3;      // buttresses and gullies
    const ribL = (rib - 0.5) * 2.2;
    const warm = noise1(x / 160, s + 3) > 0.6;
    const streak = hash2(x >> 1, 1, s) < 0.03 ? 0.6 + hash2(x >> 1, 2, s) * 0.4 : 0;
    const frac = fbm1(x / 70, 2, s + 6);
    for (let yy = Math.floor(top); yy < base; yy++) {
      const y = yy - y0;
      const fromTop = yy - top, h = base - top;
      // the den: a low, lopsided arch cut into the foot of the wall, a slab of the face jutting out over it
      let cut = false, lipK = 0;
      for (const r of o.recess) {
        const ry = base - yy, t = ry / r.h;
        const off = (noise1(yy / 11, s + 2) - 0.5) * 8 + t * 6;
        const hw = t <= 1.04 ? (r.w / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, t), 2.4)), 0.5) * (1 + (noise1(yy / 6, s + 1) - 0.5) * 0.24) + (t < 0.2 ? (0.2 - t) * 18 : 0) : -1;
        const e = hw > 0 ? Math.abs(x - r.x - off) / hw : 9;
        if (e < 1) {
          const k = e > 0.86 ? 1.8 : 0.25 + (1 - t) * 0.45 + (e > 0.68 ? 0.5 : 0);
          set(b, x, y, pick(TP.rock, k + dz(x, yy, 0.5)));
          cut = true;
          break;
        }
        // the overhang's lip: over the arch and a little past it, lit along its top, dark underneath
        const over = Math.abs(x - r.x) < r.w * 0.62 + (noise1(x / 7, s + 3) - 0.5) * 10;
        const arch = base - r.h * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x - r.x) / (r.w * 0.62)), 2)), 0.42);
        if (over && yy < arch && yy > arch - 9) lipK = yy > arch - 4 ? -2.6 : yy > arch - 6 ? 0.6 : yy > arch - 7 ? 1.8 : 0.4;
        // claw scratches either side of the mouth: pale grooves raked down the rock
        const sx = Math.abs(x - r.x) - r.w / 2 - 3;
        if (sx > 0 && sx < 14 && ry > r.h * 0.2 && ry < r.h * 0.95 && (Math.floor(sx + ry * 0.25) % 3 === 0) && noise1(ry / 9 + sx, s + 4) > 0.3) lipK = sx % 2 ? 2.6 : -1.6;
      }
      if (cut) continue;
      const low = h - fromTop < 70;
      facet(x, yy, low ? 46 : 32, low ? 30 : 21);
      // bedding: the face's tilted strata, hard beds standing proud with a lit lip and a shadow under
      const sy = yy + x * 0.11 + fbm1(x * 0.008, 2, s + 4) * 12;
      const bed = Math.floor(sy / 8), bv = sy - bed * 8;
      const hard = hash2(bed, 4, s) < 0.45 && noise1(x / 50 + bed * 3.1, s + 7) > 0.36;
      let l = F.nx * -0.7 + F.ny * -0.55 + ribL;
      // only some of the facets' meetings are open cracks (a cliff, not a dry-stone wall)
      const crack = noise1(x / 9 + yy / 13, s + 31) > 0.48;
      if (F.e < 1.1 && crack) l -= 2.4;
      else if (F.e < 2.2 && crack) l += F.ny < 0 ? 0.8 : -0.5;
      if (hard && bv < 1) l += 1.4;
      else if (hard && bv > 6.6) l -= 1.6;
      else if (!hard && bv > 4 && bv < 6) l -= 0.4;
      // long wavy fractures running down the face
      if (Math.abs(Math.sin(x * 0.045 + frac * 5 + fbm1(yy / 40, 2, s + 8) * 1.6)) < 0.025) l -= 2;
      l -= (fromTop / Math.max(60, h)) * 1.5;                  // down in the gorge, in its own shadow
      if (fromTop < 2) l += 1.8;
      l += lipK;
      let c = pick(warm ? TP.rockWarm : TP.rock, 6 + l + (F.id - 0.5) * 0.5 + dz(x, yy, 0.6));
      // seepage streaks down the face, black and wet
      if (streak && noise1(yy / 30, x) < streak) c = shade(c, -0.3);
      // lichen on the lit faces, moss on the facets that face up and low down
      // (lichen in little colonies, not a sprinkle)
      const colony = noise1(x / 7 + yy / 5.3, s + 30) > 0.62;
      if (colony && l > 0.4 && hp(x, yy, s + 10) < 0.18) c = mix(c, pick(TP.lichenGold, 1.5 + hp(x, yy, s + 11) * 2), 0.55);
      else if (colony && hp(x, yy, s + 12) < 0.14) c = mix(c, pick(TP.lichen, 2.5), 0.45);
      if ((F.ny < -0.55 && F.e > 1.1 && F.e < 2.4 && hash2(x, yy, s + 14) < 0.7) || (h - fromTop < 12 && hash2(x >> 1, yy >> 1, s + 15) < 0.4)) c = pick(FP.moss, 2.6 + (F.e < 1.8 ? 1.4 : 0) + dz(x, yy));
      set(b, x, y, c);
      // tussock and little ferns on the up-facing facet edges
      if (F.ny < -0.6 && F.e > 1.1 && F.e < 1.6 && hash2(x, yy, s + 16) < 0.05) {
        const Lt = 2 + Math.floor(hash2(x, yy, s + 17) * 6), fern = hash2(x, yy, s + 18) < 0.35;
        for (let j = 1; j <= Lt; j++) set(b, x + (j > Lt / 2 ? (hash2(x, j, s) < 0.5 ? 1 : -1) : 0), y - j, fern ? pick(FP.fern, 4 + (j & 1)) : pick(HP.tussock, 4 + j * 0.5));
      }
    }
    // the top edge: tussock hanging over the rim
    if (top > y0 + 2 && hash2(x, 19, s) < 0.4) { const Lt = 1 + Math.floor(hash2(x, 20, s) * 5); for (let j = 1; j <= Lt; j++) set(b, x, top - y0 - j, pick(HP.tussock, 4 + j * 0.6)); }
  }
  // the shelf: a slab jutting out of the face, ragged underneath, lit on top, a shadow beneath
  if (o.shelf) {
    const sh = o.shelf;
    for (let x = Math.max(0, Math.floor(sh.x0) - 10); x < Math.min(len, sh.x1 + 10); x++) {
      const ys = Math.round(sh.y(x) - y0);
      const end = Math.min(x - sh.x0 + 10, sh.x1 + 10 - x);
      const th = Math.max(0, Math.round(10 + noise1(x / 5, s + 21) * 7 + (hash2(x >> 2, 1, s) < 0.25 ? 4 : 0)) - (end < 14 ? Math.round((14 - end) * 1.1) : 0));
      if (th <= 0) continue;
      const lip = end > 6 ? 0 : 6 - end;
      for (let j = lip; j < th; j++) {
        const t = j / th;
        let k = j === lip ? 8.4 : j === lip + 1 ? 7 : 5.4 - t * 3 + (hash2(x, j, s + 22) < 0.15 ? -1.2 : 0);
        if (Math.abs(Math.sin(x * 0.3 + j * 0.7 + noise1(x / 9, s) * 4)) < 0.08 && j > lip + 1) k -= 1.6;
        set(b, x, ys + j, pick(TP.rockWarm, k + dz(x, ys + j, 0.6)));
      }
      // the shadow on the face beneath it, dithered off
      for (let j = th; j < th + 9; j++) { const c = b.get(x, ys + j); if (c >>> 24 && hash2(x, j, s + 23) < 1 - (j - th) / 9) set(b, x, ys + j, shade(c, -0.32)); }
      // tussock, a fern and loose stones along its top; roots hanging from under it
      if (hash2(x, 22, s) < 0.16) { const Lt = 2 + Math.floor(hash2(x, 23, s) * 4); for (let j = 1; j <= Lt; j++) set(b, x, ys + lip - j, pick(HP.tussock, 4 + j * 0.6)); }
      else if (hash2(x, 24, s) < 0.05) { set(b, x, ys + lip - 1, pick(TP.rock, 7)); set(b, x + 1, ys + lip - 1, pick(TP.rock, 5)); }
      if (hash2(x, 25, s) < 0.05) { const Lr = 3 + Math.floor(hash2(x, 26, s) * 7); for (let j = 0; j < Lr; j++) set(b, x + Math.round(Math.sin(j * 0.7) * 0.6), ys + th + j, pick(TP.earth, 2 + (j & 1))); }
    }
  }
  return { buf: b, y0 };
}

/** a tall crag for the foreground (the near side of the gorge), running out of the top of the frame */
export function paintCrag(seed: number, w: number, h: number): Sprite {
  const rng = new Rng(seed * 31 + 7);
  const W = w + 20, H = h + 4;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const lean = rng.range(-0.15, 0.15);
  for (let y = 0; y <= gy; y++) {
    const t = (gy - y) / h;
    const half = (w / 2) * (1 - t * 0.35) + (fbm1(y / 18, 3, seed) - 0.5) * w * 0.35;
    const c0 = cx + lean * (gy - y) * 0.3 + (noise1(y / 30, seed + 1) - 0.5) * w * 0.2;
    const xl = c0 - half - (noise1(y / 7, seed + 2) - 0.5) * 5, xr = c0 + half + (noise1(y / 7, seed + 3) - 0.5) * 5;
    for (let x = Math.floor(xl); x <= xr; x++) {
      const u = (x - c0) / Math.max(1, half);
      const sy = y + x * 0.2, bv = ((sy % 8) + 8) % 8;
      const l = -u * 1.6 + (bv < 1 ? 1 : bv > 6 ? -1.2 : 0) + (x - xl < 2 ? 1.4 : 0);
      set(b, x, y, pick(TP.rock, 5 + l + (noise2(x / 5, y / 5, seed) - 0.5) * 1.4 + (bayer(x, y) - 0.5) * 0.6));
    }
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}
