// V9 east cliffs: the headland that runs from the seal rocks past the sea cave to the hidden cove, as
// one long face on the island's back layer. Columnar basalt in blocky prisms (lit left faces, shaded
// right faces, joint cracks, broken column heads), stepped lava ledges with overhang shadows, seeps
// streaking the face dark and mossy, guano below the nesting ledges with the birds sitting in rows,
// lichen on the dry upper face, a wave-cut notch along the foot; a crown of bush with pōhutukawa in
// flower; craggy stepped ends so no straight edge ever shows; and the sea cave's mouth cut as an
// irregular opening onto the tunnel's wet back wall (flowstone curtains, alcoves, moss under the
// skylights).

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';

const HX = new Map<string, C>();
/** hex colour, parsed once (the painters call this per pixel) */
const H = (s: string): C => { let c = HX.get(s); if (c === undefined) HX.set(s, (c = hex(s))); return c; };
const FACE = ['#141316', '#1d1b1f', '#27242a', '#322e33', '#3f3a3e', '#4d4748', '#5d5654', '#6f6762', '#857b72', '#9c9084'].map(H);
const CAVE = ['#0c0b0e', '#131116', '#1a181d', '#221f25', '#2c292e', '#39373a', '#4a4a48'].map(H);
const BUSH = ['#12200f', '#1b3014', '#26421a', '#335620', '#436c27', '#58842f', '#709c3a'].map(H);
const pick = (r: C[], v: number) => r[clamp(Math.floor(v), 0, r.length - 1)];

export interface EastCliffOpts {
  /** x (buffer px) where the craggy left end has fully risen */
  left: number;
  /** x where the right end starts to fall away into the bush */
  right: number;
  /** the cave mouth [x0, x1] and its height */
  cave?: [number, number];
  arch?: number;
  /** skylight columns inside the cave (buffer x) for moss and light streaks */
  skylights?: number[];
}

export interface EastCliff {
  buf: PixelBuffer;
  /** the face's top (y in buffer px) at x, for placing things on it */
  top(x: number): number;
  /** nesting ledges: [x0, x1, y] in buffer px (animated birds use them) */
  ledges: [number, number, number][];
}

export function paintEastCliff(w: number, h: number, seed: number, o: EastCliffOpts): EastCliff {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  // ---- silhouette: a high ragged crest, craggy steps down at both ends
  const crest = (x: number) => h * 0.1 + (fbm1(x / 110, 4, seed) - 0.5) * h * 0.16 + (noise1(x / 13, seed + 1) - 0.5) * 6;
  const endK = (x: number) => {
    // 0 on the beach .. 1 at full height; stepped by blocky noise so the ends are crags, not ramps
    const a = smoothstep(o.left - 240, o.left, x + (noise1(x / 18, seed + 2) - 0.5) * 50);
    const z = 1 - smoothstep(o.right, o.right + 230, x + (noise1(x / 20, seed + 3) - 0.5) * 60);
    const k = Math.min(a, z);
    // crags: short steps with sloping treads, never one tall wall
    const st = Math.round(k * 16) / 16;
    return st * 0.55 + k * 0.45;
  };
  const tops = new Float32Array(w);
  for (let x = 0; x < w; x++) tops[x] = h - (h - crest(x)) * endK(x) - (noise1(x / 5, seed + 4) - 0.5) * 3;
  // ---- column layout: prisms 8..17 px wide, each its own tone and head height
  const colOf = new Int16Array(w), colU = new Float32Array(w), colW: number[] = [], colT: number[] = [];
  for (let x = 0, k = 0; x < w; k++) {
    const cw = rng.int(8, 17);
    colW.push(cw); colT.push(rng.range(-0.7, 0.7));
    for (let i = 0; i < cw && x < w; i++, x++) { colOf[x] = k; colU[x] = i / cw; }
  }
  // lava ledges: stepped bands across the face (y as a fraction of h, with x wobble)
  const ledgeY = [0.3, 0.48, 0.63, 0.78].map(f => f * h + rng.range(-8, 8));
  const ledgeAt = (x: number, j: number) => ledgeY[j] + (fbm1(x / 60, 2, seed + 10 + j) - 0.5) * 22;
  const ledges: [number, number, number][] = [];
  const cave = o.cave;
  const ah = o.arch ?? h * 0.55;
  // the cave mouth's top edge (height above the foot) at x: a flattened arch with rock teeth
  const mouthH = (x: number) => {
    if (!cave || x < cave[0] || x > cave[1]) return 0;
    const u = (x - cave[0]) / (cave[1] - cave[0]);
    const arch = Math.pow(Math.max(0, 1 - (u * 2 - 1) ** 2), 0.42);
    const tooth = Math.max(0, noise1(x / 4.5, seed + 20) - 0.68) * 90 * (noise1(x / 30, seed + 21) > 0.45 ? 1 : 0.3);
    return Math.max(0, arch * ah * (1 + (fbm1(x / 40, 3, seed + 22) - 0.5) * 0.3) - tooth);
  };
  for (let x = 0; x < w; x++) {
    const top = tops[x];
    const k = colOf[x], u = colU[x], cw = colW[k], ct = colT[k];
    const mh = mouthH(x);
    // each column's own broken head: some columns stand proud of the crest
    const head = top + (hash2(k, 1, seed) < 0.3 ? -hash2(k, 2, seed) * 5 : hash2(k, 3, seed) * 4);
    for (let y = Math.max(0, Math.floor(Math.min(top, head))); y < h; y++) {
      const d = y - top;
      const fromFoot = h - y;
      let c: C;
      // ---------------- the cave: the tunnel's back wall seen through the mouth
      if (fromFoot < mh) {
        const inner = mh - fromFoot;
        const flow = Math.abs(Math.sin(x * 0.31 + fbm2(x / 16, y / 50, 2, seed + 30) * 4));
        let v = 2.2 + (fbm2(x / 18, y / 12, 3, seed + 31) - 0.5) * 2.2 - smoothstep(0, 22, inner) * 0.3 * 0 + (flow < 0.18 ? 1.2 : 0);
        // darker up in the roof, alcoves where the wall recedes
        v -= clamp((fromFoot / Math.max(1, mh)) * 1.4 - 0.3) * 1.2;
        if (fbm2(x / 26, y / 14, 2, seed + 32) > 0.62) v -= 1.1;
        let cc = pick(CAVE, v + (bayer(x, y) - 0.5) * 0.7);
        // moss and a wet gleam under the skylights, and the drip line of the roof
        for (const sx of o.skylights ?? []) {
          const dx = Math.abs(x - sx);
          if (dx < 22 && noise2(x / 3, y / 3, seed + 33) > 0.5 - (1 - dx / 22) * 0.2) cc = mix(cc, H('#2c4a26'), (1 - dx / 22) * 0.7);
        }
        if (noise2(x / 1.6, y / 9, seed + 34) > 0.82) cc = mix(cc, H('#5a6468'), 0.35);
        // the rim of the mouth: its lit lip and the shadow just inside it
        if (inner < 2.5) cc = pick(FACE, 6 - inner);
        else if (inner < 7) cc = shade(cc, -0.35);
        b.data[y * w + x] = cc;
        continue;
      }
      // ---------------- the face
      // ledges: a lit shelf top, the shadow under its overhang, the columns stepping back below it
      let ledge = 0, shadow = 0, jl = -1;
      for (let j = 0; j < ledgeY.length; j++) {
        const ly = ledgeAt(x, j);
        const q = y - ly;
        if (q >= 0 && q < 2) { ledge = 1; jl = j; }
        else if (q >= 2 && q < 7 + noise1(x / 9, seed + j) * 4) shadow = 1 - (q - 2) / 10;
      }
      const joint = u < 1 / cw * 1.01;
      let v = 4.6 + ct * 1.8 + (u < 0.2 ? 1.6 : u < 0.35 ? 0.6 : u > 0.78 ? -1.3 : 0) + (fbm2(x / 7, y / 14, 2, seed + 40) - 0.5) * 1.1;
      v -= smoothstep(h * 0.55, h, y) * 1.2; // the lower face is in the beach's shade
      // horizontal breaks in each column
      const brk = Math.abs(Math.sin(y * 0.11 + k * 1.7 + noise1(y / 30, k + seed) * 2));
      if (brk < 0.035) v -= 1.6;
      else if (brk < 0.09 && Math.sin(y * 0.11 + k * 1.7) > 0) v += 0.8;
      if (joint) v -= 2.2;
      if (shadow) v -= 2.6 * shadow;
      if (ledge) v = 8 - (y - ledgeAt(x, jl)) * 1.5;
      c = pick(FACE, v + (bayer(x, y) - 0.5) * 0.45);
      // seeps: dark wet streaks running down from the ledges, green at their feet
      const seep = noise1(x / 7, seed + 50);
      if (seep > 0.78 && d > 8) {
        const k2 = (seep - 0.78) * 4.5;
        c = mix(c, H('#141418'), k2 * 0.6);
        if (y > h * 0.7 && noise2(x / 2, y / 3, seed + 51) > 0.5) c = mix(c, H('#2e4a24'), 0.6);
      }
      // guano: white streaks below the nesting ledges
      if (jl < 0) for (let j = 1; j < ledgeY.length; j++) {
        const ly = ledgeAt(x, j);
        const q = y - ly;
        // only under the colonies (a slow noise picks them), in irregular runs of uneven length
        const col = noise1(x / 40, seed + 62 + j);
        const len = 6 + noise1(x / 2.3, seed + 63 + j) * 18 * col;
        if (col > 0.58 && q > 1 && q < len && noise1(x / 2.2, seed + 60 + j) > 0.55 && hash2(x, j, seed + 61) < 0.9 - q / len) c = mix(c, H('#d4d0c4'), 0.7 - q / (len * 1.6));
      }
      // lichen on the dry upper face
      if (y < h * 0.45 && noise2(x / 3, y / 2.5, seed + 70) > 0.84) c = mix(c, noise2(x, y, seed + 71) > 0.5 ? H('#b89a44') : H('#8a9a58'), 0.4);
      // the wave-cut notch and the wet, weedy foot
      if (fromFoot < 22 + noise1(x / 20, seed + 80) * 8) {
        c = shade(c, -0.3);
        if (fromFoot < 8) c = noise2(x / 2, y / 2, seed + 81) > 0.55 ? H('#2a3a1e') : H('#1a1a1c');
        if (fromFoot > 12 && fromFoot < 15 && hash2(x, y, seed + 82) < 0.35) c = H('#b8b0a0');
      }
      // the crest: bush, flax and pōhutukawa spilling over the top
      const bushD = 7 + noise1(x / 9, seed + 90) * 12;
      if (d < bushD || y < head + 1) {
        const g = noise2(x / 3.5, y / 3, seed + 91);
        c = pick(BUSH, 1.5 + g * 4.5 - d * 0.12 + (bayer(x, y) - 0.5));
        if (hash2(x, y, seed + 92) < 0.035 && noise1(x / 40, seed + 93) > 0.5) c = H('#c8342a');
        if (d < 1) c = BUSH[6];
      }
      b.data[y * w + x] = c;
    }
    // bush tufts poking above the crest
    const tuft = Math.round(noise1(x * 0.8, seed + 95) * 4 + noise1(x / 6, seed + 96) * 3);
    for (let i = 1; i <= tuft; i++) { const yy = Math.round(top) - i; if (yy >= 0) b.data[yy * w + x] = BUSH[Math.min(6, 2 + i)]; }
  }
  // nesting ledges (the lower three), for the birds: spans where the face is present
  for (let j = 1; j < ledgeY.length; j++) {
    for (let x0 = 20; x0 < w - 40; x0 += rng.int(60, 140)) {
      const x1 = x0 + rng.int(18, 46);
      if (mouthH(x0) > 0 || mouthH(x1) > 0 || endK(x0) < 0.95 || endK(x1) < 0.95) continue;
      const y = ledgeAt((x0 + x1) / 2, j);
      ledges.push([x0, x1, y]);
      // the birds already sitting there: little pale shapes in a row
      for (let x = x0; x < x1; x += rng.int(3, 5)) {
        const yy = Math.round(ledgeAt(x, j));
        b.set(x, yy - 1, H('#eeeae0')); b.set(x, yy - 2, H('#f8f6f0')); b.set(x + 1, yy - 1, H('#c8c4b8'));
        if (rng.chance(0.3)) b.set(x, yy - 3, H('#2a2a2e'));
      }
    }
  }
  return { buf: b, top: (x: number) => tops[clamp(Math.round(x), 0, w - 1)], ledges };
}
