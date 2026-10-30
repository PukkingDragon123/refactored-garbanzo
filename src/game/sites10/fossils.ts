// V10: Te Toka Iwi, the Bone Cliffs. The gorge above Thunder Falls cuts through banded rock that is
// tens of millions of years old, and the walls are full of bones: a whole ancient serpent lies along
// the cliff, legs and all. The gorge floor is scree that slides under running feet; ropes go up to a
// bone terrace and on to a high ledge where rocks come down, and at its far end a cleft drops into a
// dark valley that glows (the way deeper, to the Glowing Forest).

import type { Site10 } from './kit';
import { climbSpot, arrive10, boulder, propAt, bump, sprite, Rng, hex, PAL, bayer, fbm2, game, layerSpan, bigFrame, clamp } from './kit';
import { groundStrip, mainLayer, skyAndRidge, undergrowth, hideBush, frontFoliage, trees } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { findArt } from '../v10/finds';
import { A } from '../assets';
import { paintStrataCliff, paintLedgeBed } from '../../art/strata';
import { paintDigSite } from '../../art/digsite';
import type { Sprite } from '../../art/jungle-core';
import { rand } from '../../core/math';
import type { FieldScene } from '../scenes/field';

const W = 2300, G = 290, TERRACE = 206, HIGH = 138;
export const fossilGround = (x: number) => G + Math.sin(x * 0.011) * 3 + Math.sin(x * 0.043) * 1.5 - bump(x, 430, 930, 44) - bump(x, 1700, 2250, 16);

/** banded rock: grey, cream, rust and ash, the stripes of a very long time */
const BAND: C[] = [hex('#3c3430'), hex('#5a4a40'), hex('#7a6252'), hex('#9a7c62'), hex('#b8987a'), hex('#d0b494'), hex('#e2cca8')];
const STRATA: C[] = [hex('#a8583a'), hex('#d8c8a0'), hex('#6a6a6a'), hex('#c89a6a'), hex('#e8dcc0'), hex('#8a5a42')];

/** hand-drawn bone pieces: 3 lit bone, 2 bone, 1 shaded bone, 0 dark bone, k dark hollow (socket, nostril) */
const VERT = ['..32...', '...21..', '..3221.', '.332210', '3322210', '3222110', '.21110.', '..0.0..'];
const VERT_TAIL = ['.3.', '321', '210', '.0.'];
const SKULL = [
  '........33332222..................',
  '.....3333222222222211.............',
  '...33322222222222222221111........',
  '..3322222kkkk22222222222221111....',
  '.332222kkkkkkk2222222222222222111.',
  '.32222kkkkkkkk22221122222222k22210',
  '322222kkkkkkk222211122222222222210',
  '3222222kkkk222221110222222222211..',
  '2221111111111111111111111111111100',
  '213030303030303030303030303030300.',
  '22222222222222222222222211110.....',
  '.2222211111111111111111110........',
  '..11100000000000000000000.........',
];

/** the great skeleton in the cliff: a legged serpent's spine, ribs, skull and fangs, set in a dug-back pocket of darker matrix */
export function skeleton(): { buf: PixelBuffer; ax: number; ay: number } {
  const w = 470, h = 120;
  const b = new PixelBuffer(w, h);
  const bone = [hex('#8a7a5a'), hex('#b8a47a'), hex('#d8c8a0'), hex('#efe2c0')];
  const mat = [hex('#1e1814'), hex('#2e2620'), hex('#3c3229'), hex('#4c4034')];
  const rng = new Rng(4711);
  const spineY = (x: number) => { const t = (x - 20) / 400; return 62 + Math.sin(t * 7.2) * 18 + Math.sin(t * 2.1) * 8; };
  const spine = (t: number): [number, number] => [20 + t * 400, spineY(20 + t * 400)];
  const stamp = (map: string[], x0: number, y0: number) => {
    map.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      b.set(x0 + i, y0 + j, ch === 'k' ? mat[0] : bone[+ch]);
    } });
  };
  // the dug-back pocket: chiselled in steps, an overhang shadow along the top, a lit ledge along the bottom
  let up = 14, dn = 15;
  const [skx, sky] = spine(1);
  for (let x = 8; x < Math.min(w, skx + 40); x++) {
    if (x % 4 === 0) { up = clamp(up + rng.int(-2, 2), 10, 19); dn = clamp(dn + rng.int(-2, 2), 11, 20); }
    const inSkull = x > skx - 8;
    const cy = inSkull ? sky : spineY(Math.min(x, skx));
    const y0 = Math.round(cy - (inSkull ? 13 : up)), y1 = Math.round(cy + (inSkull ? 12 : dn));
    for (let y = y0; y <= y1; y++) {
      const d = y - y0, e = y1 - y;
      b.set(x, y, d < 2 ? mat[0] : e < 1 ? mat[3] : e < 3 ? mat[2] : (x * 7 + y * 13) % 23 === 0 ? mat[2] : mat[1]);
    }
    // chisel marks on the pocket floor
    if (rng.chance(0.06)) for (let k = 0; k < 3; k++) b.set(x + k, y1 - 3 - k, mat[2]);
  }
  // ribs
  for (let i = 4; i < 70; i++) {
    const t = i / 80, [x, y] = spine(t), [x2, y2] = spine(t + 0.004);
    const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
    const len = 18 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.9) + 4;
    for (const side of [1, -1]) for (let k = 0; k < len; k++) {
      const c = k / len;
      b.set(x + (nx / nl) * k * side + c * c * 4, y + (ny / nl) * k * side + c * 3, bone[k < 2 ? 3 : side > 0 ? 1 + (k % 2) : 1]);
    }
  }
  // vertebrae, each one drawn, shrinking into the tail
  for (let x = 20; x < skx - 4; x += 6) {
    const y = Math.round(spineY(x)), tail = x < 70;
    stamp(tail ? VERT_TAIL : VERT, Math.round(x) - (tail ? 1 : 3), y - (tail ? 2 : 4));
  }
  // four legs: upper bone, joint, lower bone and splayed toes
  for (const t of [0.22, 0.3, 0.62, 0.7]) {
    const [x, y] = spine(t);
    let px = x, py = y + 4;
    for (let k = 0; k < 13; k++) { px += 0.35; py += 1; b.set(px, py, bone[2]); b.set(px + 1, py, bone[1]); b.set(px - 1, py, bone[3]); }
    b.set(px, py + 1, bone[3]); b.set(px + 1, py + 1, bone[2]);
    for (let k = 0; k < 12; k++) { px -= 0.1; py += 1; b.set(px, py, bone[2]); b.set(px + 1, py, bone[0]); }
    for (const [dx, dy] of [[1, 0], [2, 1], [3, 1], [4, 2], [-1, 1], [-2, 2]]) b.set(px + dx, py + dy, bone[dx > 2 ? 3 : 2]);
  }
  // the skull: long, low, eye socket and nostril, a row of fangs along the jaw
  stamp(SKULL, Math.round(skx) - 4, Math.round(sky) - 7);
  b.outline(hex('#1a1410'));
  return { buf: b, ax: 0, ay: h - 1 };
}

const GRASS: C[] = ['#1e2a14', '#2e3e1c', '#425624', '#58702e', '#6e8a38', '#88a446'].map(c => hex(c));

/** add a wide buffer to a layer as <= 2048 px props (top-left at x, y) */
function addWide(lay: { add: (d: Prop) => unknown }, buf: PixelBuffer, x: number, y: number, z = 0, tint?: number) {
  const CH = 2048;
  for (let cx = 0; cx < buf.w; cx += CH) {
    const w = Math.min(CH, buf.w - cx);
    let sub = buf;
    if (buf.w > CH) {
      sub = new PixelBuffer(w, buf.h);
      for (let yy = 0; yy < buf.h; yy++) sub.data.set(buf.data.subarray(yy * buf.w + cx, yy * buf.w + cx + w), yy * w);
    }
    lay.add(new Prop({ ...bigFrame(game.r, sub), ax: 0, ay: 0 }, x + cx, y, z, { tint }));
  }
}

/** a hard sandstone bed standing out of the cliff as a ledge (a one-way platform), same geometry as kit's ledge */
function bedLedge(f: FieldScene, x0: number, x1: number, y: number, seed: number, th: number) {
  f.st.terrain.addPlatform([[x0, y], [x1, y]], 'rock');
  const w = Math.round(x1 - x0) + 8;
  const c = sprite(`fo:ledge:${seed}:${w}`, () => ({ buf: paintLedgeBed(w, th, seed), ax: 0, ay: 1 } as Sprite));
  if (c) f.main.add(new Prop(c.f, x0 - 4, y, -3, { tint: packColor(0.86, 0.82, 0.8, 1) }));
}

/** stones in the river, sand falls off the ledges (x, y) */
const RIVER_STONES = [210, 470, 690, 1040, 1390, 1820, 2130];
const SAND_FALLS: [number, number][] = [[1010, TERRACE + 12], [1230, TERRACE + 12], [1450, TERRACE + 12], [1640, HIGH + 14], [1900, HIGH + 14], [2150, HIGH + 14], [1100, 56]];

export const FOSSILS: Site10 = {
  id: 'fossils', loc: 'fossils', name: 'Bone Cliffs', width: W, camY: 176, spawnX: 80, exitX: 30, waterY: G + 8,
  ambience: 'falls', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G0 = { y: fossilGround };
    const rng = new Rng(404);
    skyAndRidge(f, { seed: 31, base: 200 });
    // the far wall of the gorge and a nearer one, banded
    {
      // the far wall of the gorge: finer beds, hazed blue with distance, its rim stepping back bed by bed
      const fs = layerSpan(st, 0.22);
      const far = st.addLayer('gorgeFar', 0.22, 0.45, 0.35, 0);
      addWide(far, paintStrataCliff(fs.w, 300, 41, { top: 40, amp: 30, scale: 0.55, dip: 0.012, fold: 5, fog: hex('#8aa0b8'), haze: 0.16, grass: GRASS }), fs.x0, 40, 0, packColor(0.85, 0.88, 0.95, 1));
    }
    const near = st.addLayer('gorgeNear', 0.55, 0.15, 0.5, 0);
    const span = layerSpan(st, 0.55, 80);
    // the nearer wall: banded buttresses and stacks, their soft beds weathered back under the hard ones
    for (let x = span.x0, i = 0; x < span.x0 + span.w; x += 240 + rng.range(0, 120), i++) {
      const v = i % 4, bw = 200 + v * 40, bh = 210 + (v % 2) * 30;
      const c = sprite(`fo:butte:${v}`, () => ({ buf: paintStrataCliff(bw, bh, 50 + v, { top: 18 + v * 14, amp: 30, taperL: bw * (0.12 + (v % 3) * 0.05), taperR: bw * (0.18 - (v % 2) * 0.06), talus: 70 + v * 8, scale: 0.8, fossils: 0.3, grass: GRASS }), ax: Math.round(bw / 2), ay: bh - 1 } as Sprite));
      if (c) near.add(new Prop(c.f, x + rng.range(0, 60), G + 4, 0, { tint: packColor(0.8, 0.78, 0.8, 1) }));
    }
    const mid = st.addLayer('mid', 0.8, 0.06, 0.55, 0);
    trees(f, mid, 0, W / 0.8 + 200, [180, 320], ['rata', 'treefern', 'broadleaf'], { y: x => fossilGround(x / 0.8) }, 61, { variants: 2 });
    const main = mainLayer(f);
    // the cliff behind the terraces, banded, with the skeleton in it
    const cliff = paintStrataCliff(1500, 230, 7, { top: 24, amp: 20, taperL: 70, talus: 40, fossils: 0.9, dip: 0.018, fold: 6, grass: GRASS });
    // the cleft at the gorge head: a jagged black crack with a lit lip, a green glow far down in it
    {
      const cx = 2230 - 820, y0 = HIGH - 40 - 78, y1 = HIGH - 40;
      for (let y = Math.max(0, y0); y < y1; y++) {
        const t = (y - y0) / (y1 - y0), half = 1 + t * 6 + (fbm2(y * 0.2, 0.5, 2, 9) - 0.5) * 4, mid = cx + Math.sin(y * 0.15) * 2;
        for (let x = Math.floor(mid - half); x <= Math.ceil(mid + half); x++) {
          const e = Math.min(x - (mid - half), mid + half - x);
          cliff.set(x, y, e < 1 ? hex('#4a3a30') : t > 0.8 && e > 2 && bayer(x, y) < (t - 0.8) * 3 ? hex('#1e4a2a') : hex('#080706'));
        }
        cliff.set(Math.floor(mid - half) - 1, y, hex('#c8a07a'));
      }
    }
    main.add(new Prop({ ...bigFrame(r, cliff), ax: 0, ay: 0 }, 820, 40, -9, { tint: packColor(0.84, 0.8, 0.8, 1) }));
    main.add(new Custom(-8.9, rr => rr.light(2230, HIGH - 22, 70, 0.4, 1, 0.6, 0.35, 0.1)));
    const sk = sprite('fo:skeleton', skeleton);
    if (sk) main.add(new Prop(sk.f, 960, TERRACE - 6, -8.5));
    groundStrip(f, W, G0, [PAL.stoneWarm[6], PAL.stoneWarm[5], hex('#8a7058'), hex('#6e5a48')], PAL.stoneWarm[1], 23, 120);
    // the river along the gorge floor
    f.main.add(new Custom(-2, (rr, s2) => {
      rr.water(0.8, 1.6, 0.9);
      rr.rect(0, G + 8, W, 26, packColor(0.12, 0.28, 0.32, 1));
      rr.water(0);
      for (let i = 0; i < 40; i++) { const gx = (i * 61.7 + s2.time * 40) % W; rr.fxDraw(A.dot2, gx, G + 9, 1.6, 0.4, 0, packColor(1, 1, 1, 1), 0.4); }
      // ripples running downstream in rows, and foam curling round the stones
      const x0 = rr.visibleX0(20), x1 = rr.visibleX1(20);
      for (let row = 0; row < 4; row++) {
        const y = G + 12 + row * 5, sp = 34 + row * 9;
        for (let x = Math.floor(x0 / sp) * sp; x < x1; x += sp) {
          const gx = x + ((s2.time * (30 + row * 8) + row * 13) % sp), a = 0.18 + 0.14 * Math.sin(s2.time * 2 + x * 0.1 + row);
          rr.rect(Math.round(gx), y, 3 + (row & 1) * 2, 1, packColor(0.75, 0.9, 0.92, a));
        }
      }
      for (const sx of RIVER_STONES) {
        if (sx < x0 || sx > x1) continue;
        const k = Math.sin(s2.time * 5 + sx);
        rr.rect(sx + 6, G + 13, 2 + Math.round(k + 1), 1, packColor(0.92, 0.96, 0.95, 0.7));
        rr.rect(sx - 7, G + 14, 2, 1, packColor(0.92, 0.96, 0.95, 0.4 + 0.2 * k));
      }
    }));
    for (const sx of RIVER_STONES) propAt(f, `fo:rs:${sx % 3}`, () => boulder(sx % 3 + 60, 14 + (sx % 3) * 3, 7 + (sx % 2) * 2, BAND, { moss: 0.4 }), sx, G + 16, -1.9);
    // the terrace and the high ledge, and the ropes up
    bedLedge(f, 900, 1500, TERRACE, 71, 14);
    bedLedge(f, 1420, 2290, HIGH, 72, 16);
    // the dig on the bone terrace, beyond the loose vertebra
    propAt(f, 'fo:dig', () => paintDigSite(3), 1318, TERRACE, -2.6);
    // sand trickling off the ledges and the rim, and dust hanging in the light of the gorge
    f.main.add(new Custom(-2.8, () => {}, dt => {
      for (const [x, y] of SAND_FALLS) if (rand.chance(dt * 2.2)) f.main.particles.spawn({ frame: A.dot2, x: x + rand.range(-2, 2), y, vx: rand.range(-3, 3), vy: rand.range(4, 12), ay: 140, life: rand.range(0.9, 1.6), color: [0.82, 0.68, 0.5], alpha: 0.9, alpha1: 0.2, size: 0.6 });
      const cx = f.st.cam.x;
      if (rand.chance(dt * 3)) f.main.glowParticles.spawn({ frame: A.dot, x: cx + rand.range(-260, 260), y: rand.range(120, 280), vx: rand.range(2, 8) + f.st.wind * 3, vy: rand.range(-3, 3), life: rand.range(5, 9), color: [1, 0.9, 0.7], alpha: 0.35, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 0.4, wobble: 4, wobbleF: 0.8, size: 0.6 });
    }));
    climbSpot(f, 922, TERRACE, fossilGround(922), 'rope', 'Climb the rope to the bone terrace', 'Climb down to the gorge floor');
    climbSpot(f, 1470, HIGH, TERRACE, 'rope', 'Climb up to the high ledge', 'Climb down to the terrace');
    // cliff birds nest on the ledges
    for (const x of [1040, 1180, 1320, 1600, 1760, 1940, 2100]) f.pois.push({ kind: 'nest', x, y: x < 1450 ? TERRACE : HIGH });
    for (const x of [300, 640, 1650]) f.pois.push({ kind: 'rock', x, y: fossilGround(x) - 6 });
    for (const x of [180, 230]) f.pois.push({ kind: 'burrow', x, y: fossilGround(x) });
    // boulders and the scree
    for (const [x, w, h] of [[140, 50, 30], [380, 70, 40], [700, 40, 22], [1120, 60, 34], [1580, 46, 26], [2000, 80, 44]] as const) propAt(f, `fo:b:${x}`, () => boulder(x, w, h, BAND, { strata: STRATA, moss: 0.1 }), x, fossilGround(x) + 4, -3);
    for (let x = 450; x < 920; x += rng.range(10, 22)) propAt(f, `fo:sc:${Math.floor(x / 60) % 5}`, () => boulder(Math.floor(x / 60) % 5 + 9, 9, 6, BAND, {}), x, fossilGround(x) + 2, -1);
    undergrowth(f, main, 0, 420, 0.7, G0, 81, { plants: ['moss', 'sedge', 'grass', 'astelia', 'flax'], wood: ['rock', 'rock', 'roots'] });
    undergrowth(f, main, 940, 2280, 0.4, G0, 82, { plants: ['moss', 'grass', 'astelia'], wood: ['rock', 'litter'] });
    for (const x of [260, 1900]) hideBush(f, x, G0, x, 0.75);
    frontFoliage(f, 260, W, [260, 420], ['grass', 'flax', 'fronds'], 1.35, G + 110, 91);
    // dark banded rock in the near foreground, running out of the bottom of the frame
    const fg = st.addLayer('fgRock', 1.4, 0, 0.3, 0, 1.4);
    for (const [x, v] of [[120, 0], [980, 1], [1760, 0], [2300, 1]] as const) {
      const c = sprite(`fo:fgr:${v}`, () => ({ buf: paintStrataCliff(240 + v * 60, 150, 90 + v, { top: 26 + v * 10, amp: 24, taperL: 50, taperR: 60, talus: 50, scale: 1.3, grass: GRASS }), ax: 120 + v * 30, ay: 149 } as Sprite));
      if (c) fg.add(new Prop(c.f, x * 1.4, G + 175, 0, { tint: packColor(0.26, 0.22, 0.24, 1) }));
    }
  },
  spawns: [
    { species: 'cragauk', n: [4, 7], x: [1000, 2150], poi: 'nest', herd: true, juveniles: 0.3, chance: 1 },
    { species: 'cragviper', n: [1, 2], x: [1000, 2150], poi: 'nest', chance: 0.8 },
    { species: 'galehawk', n: [1, 1], x: [200, 2100], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'monarch', n: [1, 1], x: [400, 2000], medium: 'air', times: ['dawn', 'day'], chance: 0.5 },
    { species: 'delver', n: [2, 4], x: [160, 260], herd: true, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'shieldback', n: [1, 1], x: [100, 900], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
    { species: 'torrentdipper', n: [1, 1], x: [200, 700], poi: 'rock', times: ['dawn', 'day'], chance: 0.6 },
  ],
  insects: [
    { kind: 'butterfly', x: [100, 2200], y: [150, 260], n: 4, times: ['day', 'dawn'] },
    { kind: 'dragonfly', x: [0, 800], y: [260, 296], n: 4, times: ['day', 'dusk'] },
  ],
  onEnter: f => arrive10(f, 'Bone Cliffs', 'Te Toka Iwi', 'Te Toka Iwi. The rock of bones. My koro says the old taniwha came here to sleep, and the rock grew over them.'),
  v10: {
    hardClimbs: [{ x: 922, rate: 1 }, { x: 1470, rate: 1.2 }],
    hazards: [
      { x0: 460, x1: 900, kind: 'slip', dmg: 3, warn: 'Loose stones. If you run on the scree, it runs with you.' },
      { x0: 1560, x1: 1880, kind: 'rockfall', dmg: 7, period: 4.5, warn: 'Listen. Rocks come down from up there. Keep moving under the overhang.' },
    ],
    points: [
      { id: 'fos:fo:skeleton', kind: 'fossil', name: 'The great skeleton', x: 1180, y: TERRACE - 6, photo: { w: 470, h: 120 }, note: 'A whole serpent in the cliff, longer than a bus, with four legs.' },
      { id: 'lm:fo:strata', kind: 'landmark', name: 'The banded gorge', x: 640, photo: { w: 260, h: 200, dy: 40 }, note: 'Every stripe of rock is a flood or an eruption.' },
      { id: 'fos_vertebra', kind: 'fossil', name: 'Loose vertebra', x: 1260, y: TERRACE, art: () => findArt.fossil('vertebra'),
        take: { item: 'fos_vertebra', verb: 'Lift the loose vertebra (heavy)', time: 3, line: 'Oof. It’s like carrying a bowling ball. A bowling ball that was ALIVE.', aroha: 'That one fell out of the cliff on its own. You can take it. The rest stays.' } },
      { id: 'fos_ammonite', kind: 'fossil', name: 'Ammonite in the scree', x: 760, art: () => findArt.fossil('ammonite'), take: { item: 'fos_ammonite', verb: 'Pick up the coiled stone', time: 1.6, line: 'An ammonite! This cliff used to be the bottom of the sea.' } },
      { id: 'fos_leaf', kind: 'fossil', name: 'Fern imprint', x: 1700, y: HIGH, art: () => findArt.fossil('leaf'), take: { item: 'fos_leaf', verb: 'Split the slab', tools: ['trowel'], time: 2.4, line: 'A fern. Exactly like the ones in Fernwood. Fifty million years, and it hasn’t changed its outfit.' } },
      { id: 'pt:fo:scree', kind: 'sample', name: 'Banded rock', x: 600, art: () => findArt.dig('#a87a5a'), take: { item: 'smp_scree', verb: 'Take a rock sample', tools: ['trowel'], time: 1.8 } },
      { id: 'cave:fo:cleft', kind: 'cave', name: 'The cleft', x: 2230, y: HIGH, photo: { w: 80, h: 60 }, note: 'A crack in the gorge head. Cold air, and a faint green glow, come up out of it.' },
    ],
  },
};
