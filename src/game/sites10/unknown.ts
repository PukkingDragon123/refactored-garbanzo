// V10: Te Korokoro, the Throat (the map shows "???" until Mori stands in it). A vast sinkhole in the
// heart of the land: sheer walls, light falling from far above through the mist, tree ferns three
// times taller than any in Fernwood, a cold misty lake (something huge lives in it), a field of
// enormous bones, a wall of glowing crystal, and a nest with an egg that is still warm. A carved
// marker of the old people stands at the far end, where a rope comes down from the old pā.

import type { Site10, Swim10 } from './kit';
import { swimWater, SWIM_DEPTH, dim, arrive10, boulder, pillar, propAt, bump, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, clamp, wallLayer, glowField } from './kit';
import { groundStrip, mainLayer, shafts, undergrowth, hideBush, frontFoliage } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { tree } from '../../art/jungle-trees';
import { findArt } from '../v10/finds';
import { A } from '../assets';
import { rand } from '../../core/math';
import { addNote } from '../v10/regions';

const W = 2400, G = 292;
const LAKE: Swim10 = { x0: 770, x1: 1240, top: G + 6, bottom: G + 90, cold: true, col: [0.07, 0.16, 0.18] };
const dip = (x: number, s: Swim10, y: number) => {
  const line = s.top + SWIM_DEPTH;
  if (x >= s.x0 && x <= s.x1) return line;
  const d = x < s.x0 ? s.x0 - x : x - s.x1;
  return d < 28 ? y + (line - y) * (1 - d / 28) : y;
};
export const throatGround = (x: number) => dip(x, LAKE, G + Math.sin(x * 0.011) * 4 - bump(x, 1720, 2080, 20) - bump(x, 0, 160, 10));

const WALL = [hex('#1e2224'), hex('#2c3234'), hex('#3c4446'), hex('#4e5858'), hex('#626e6c'), hex('#7a8682')];
const BONE = [hex('#7a6c52'), hex('#a8987a'), hex('#cfc2a0'), hex('#ece2c6')];

/** a giant bone (a rib or a femur) half sunk in the ground */
function bigBone(seed: number, len: number, curve: number) {
  const b = new PixelBuffer(len + 8, 60);
  for (let i = 0; i < len; i++) {
    const t = i / len, x = 4 + i, y = 54 - Math.sin(t * Math.PI) * curve;
    const r = 3 + (t < 0.08 || t > 0.92 ? 3 : 0);
    for (let k = -r; k <= r; k++) b.set(x, y + k, BONE[clamp(Math.round(2 - k / r + (bayer(x, y + k) - 0.5)), 0, 3)]);
  }
  b.outline(hex('#1a1410'));
  void seed;
  return { buf: b, ax: Math.floor((len + 8) / 2), ay: 59 };
}

/** the nest: a mound of woven branches and bones with one huge pale egg in it */
function nest() {
  const w = 130, h = 70, b = new PixelBuffer(w, h);
  const rng = new Rng(9);
  for (let i = 0; i < 420; i++) {
    const a = rng.range(0, Math.PI), r = rng.range(20, 62), x = 65 + Math.cos(a) * r, y = 66 - Math.sin(a) * r * 0.35;
    const ang = rng.range(-0.6, 0.6), len = rng.range(8, 20);
    for (let k = 0; k < len; k++) b.set(x + Math.cos(ang) * k, y + Math.sin(ang) * k, rng.chance(0.15) ? BONE[2] : [hex('#3a2a1c'), hex('#5a4028'), hex('#7a5a3a')][rng.int(0, 2)]);
  }
  b.ellipseFn(65, 34, 17, 23, (x, y, nx, ny) => {
    const l = -nx * 0.5 - ny * 0.6 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.5 + (bayer(x, y) - 0.5) * 0.25;
    const spot = fbm2(x * 0.3, y * 0.3, 2, 4) > 0.66;
    return spot ? hex('#8a7a8a') : [hex('#a8a0a0'), hex('#c8c0bc'), hex('#e2dcd4'), hex('#f6f2ec')][clamp(Math.round((l * 0.5 + 0.5) * 3), 0, 3)];
  });
  b.outline(hex('#140e0a'));
  return { buf: b, ax: 65, ay: h - 1 };
}

/** the carved marker stone of the old people */
function marker() {
  const w = 30, h = 80, b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const half = 11 - Math.max(0, 10 - y) * 0.6 + Math.sin(y * 0.3) * 0.5;
    for (let x = -half; x <= half; x++) {
      let c = WALL[clamp(Math.round(3 - x / half + (bayer(15 + x, y) - 0.5)), 1, 5)];
      if ((y % 16 > 10 && Math.abs(x) < half - 2) || (Math.abs(x) < 1 && y > 20)) c = WALL[0];
      b.set(15 + x, y, c);
    }
  }
  b.disc(15, 12, 2, hex('#6ab8a8'));
  b.outline(hex('#0c0c0c'));
  return { buf: b, ax: 15, ay: h - 1 };
}

export const UNKNOWN: Site10 = {
  id: 'unknown', loc: 'unknown', name: 'Te Korokoro', width: W, camY: 180, spawnX: 80, exitX: 30, waterY: G + 6,
  ambience: 'jungle', music: 'spooky', ground: 'leaves',
  build(f) {
    const st = f.st, G0 = { y: throatGround };
    const rng = new Rng(1313);
    dim(f, 0.35, [0.8, 0.95, 0.92], { bloom: 0.5, vignette: 0.45, fog: [0.42, 0.5, 0.5] });
    // the walls of the sinkhole, far and near, and a ring of sky high above
    wallLayer(f, 'throatFar', 0.15, 0.6, -160, 520, 91, WALL, { moss: 0.25, strata: 0.08, tint: packColor(0.7, 0.8, 0.8, 1) });
    wallLayer(f, 'throatMid', 0.4, 0.4, -120, 300, 92, WALL, { moss: 0.35, tint: packColor(0.65, 0.75, 0.72, 1) });
    const mist = st.addLayer('mist', 0.55, 0.1, 0, 0);
    mist.add(new Custom(0, () => {}, dt => {
      if (!rand.chance(dt * 2.5)) return;
      mist.particles.spawn({ frame: A.soft, x: rand.range(-200, W * 0.55 + 300), y: rand.range(200, 290), vx: rand.range(2, 6), vy: rand.range(-2, 1), life: rand.range(8, 14), color: [0.85, 0.92, 0.92], alpha: 0.22, alpha1: 0, fadeIn: 0.3, size: 2.5, size1: 5 });
    }));
    // giant tree ferns
    const mid = st.addLayer('mid', 0.82, 0.12, 0.5, 0);
    for (let x = 40; x < W * 0.82 + 200; x += rng.range(90, 170)) {
      const c = sprite(`th:fern:${rng.int(0, 2)}`, () => tree('treefern', 900 + rng.int(0, 2), 380));
      if (c) mid.add(new Prop(c.f, x, throatGround(x / 0.82) + 4, 0, { sway: 0.6, tint: packColor(0.62, 0.72, 0.68, 1) }));
    }
    const main = mainLayer(f);
    for (const x of [300, 560, 1400, 2160]) {
      const c = sprite(`th:fernM:${x % 2}`, () => tree('treefern', 950 + (x % 2), 420));
      if (c) main.add(new Prop(c.f, x, throatGround(x) + 3, -6, { sway: 0.5 }));
      f.pois.push({ kind: 'trunk', x, y: throatGround(x), y1: throatGround(x) - 260 }, { kind: 'perch', x, y: throatGround(x) - 300 });
    }
    groundStrip(f, W, G0, [PAL.moss[4], PAL.moss[3], PAL.soil[4], PAL.soil[3]], PAL.soil[0], 71, 120);
    swimWater(f, LAKE);
    // light falling from the rim far above
    shafts(f, main, [{ x: 460, w: 70, a: 0.06 }, { x: 1000, w: 110, a: 0.05 }, { x: 1620, w: 80, a: 0.07 }, { x: 2050, w: 60, a: 0.05 }], [0.9, 1, 0.95], -120, 440, 1.1);
    // the bone field
    for (const [x, len, cv] of [[1300, 90, 40], [1360, 120, 52], [1450, 80, 30], [1540, 140, 46], [1620, 70, 20]] as const) propAt(f, `th:bone:${x}`, () => bigBone(x, len, cv), x, throatGround(x) + 8, -2);
    // the crystal wall
    propAt(f, 'th:crystalrock', () => pillar(7, 60, 120, WALL), 1660, throatGround(1660) + 4, -5);
    glowField(f, 1640, 1690, throatGround(1660) - 110, throatGround(1660) - 10, 40, [0.5, 1, 0.7], 1331, { lights: 2, size: 1.1 });
    // the nest and its egg
    propAt(f, 'th:nest', nest, 1900, throatGround(1900) + 6, -1);
    main.add(new Custom(-0.5, (rr, s2) => { const k = 0.5 + 0.5 * Math.sin(s2.time * 0.6); rr.light(1900, throatGround(1900) - 36, 70, 1, 0.75, 0.6, 0.25 + 0.2 * k, 0.1); }));
    // the marker stone, and the rope that comes down from the old pā
    propAt(f, 'th:marker', marker, 2200, throatGround(2200) + 3, -2);
    main.add(new Custom(-1, (rr, s2) => { for (let y = -140; y < throatGround(2290); y += 2) rr.rect(2290 + Math.sin(s2.time * 0.7) * (y + 140) * 0.004 - 1, y, 2, 2, packColor(0.66, 0.52, 0.32, 1)); }));
    for (const [x, w, h] of [[120, 60, 34], [700, 50, 28], [1270, 70, 40], [2060, 60, 30]] as const) propAt(f, `th:b:${x}`, () => boulder(x, w, h, WALL, { moss: 0.4 }), x, throatGround(x) + 4, -3);
    undergrowth(f, main, 0, 760, 1.1, G0, 1341, { plants: ['fern', 'crownfern', 'umbrellafern', 'moss', 'kidneyfern', 'fiddlehead'], fungi: ['veil', 'bracket'], wood: ['rottenlog', 'roots', 'litter'] });
    undergrowth(f, main, 1250, W, 0.8, G0, 1342, { plants: ['fern', 'moss', 'astelia', 'fiddlehead'], wood: ['rock', 'roots'] });
    for (const x of [640, 1760]) hideBush(f, x, G0, x, 0.8);
    frontFoliage(f, 260, W, [180, 300], ['fronds', 'leaves'], 1.35, G + 112, 1351, { tint: packColor(0.35, 0.42, 0.4, 1) });
    for (const x of [1350, 1550]) f.pois.push({ kind: 'carrion', x, y: throatGround(x), amount: 20 });
  },
  spawns: [
    { species: 'titan', n: [1, 1], x: [820, 1200], medium: 'water', chance: 1 },
    { species: 'galehawk', n: [1, 2], x: [200, 2200], medium: 'air', chance: 0.8 },
    { species: 'sailglider', n: [1, 2], x: [200, 2200], poi: 'trunk', medium: 'trunk', chance: 0.8 },
    { species: 'mossfrog', n: [3, 5], x: [700, 1300], herd: true, chance: 1 },
    { species: 'monarch', n: [1, 1], x: [1200, 2200], medium: 'air', chance: 0.6 },
    { species: 'boneface', n: [2, 4], x: [200, 700], herd: true, juveniles: 0.3, chance: 0.7 },
  ],
  insects: [
    { kind: 'dragonfly', x: [760, 1260], y: [250, 296], n: 6 },
    { kind: 'skymoth', x: [100, 2300], y: [140, 260], n: 6 },
    { kind: 'firefly', x: [0, W], y: [180, 280], n: 16, times: ['dusk', 'night'] },
  ],
  onEnter: f => arrive10(f, 'Te Korokoro', 'The Throat', 'Te Korokoro... my koro said it was only a story. We should not be here, Mori. Be quick, and be quiet.'),
  v10: {
    dark: 0.4,
    swims: [LAKE],
    points: [
      { id: 'eco:th:sinkhole', kind: 'ecosystem', name: 'Te Korokoro', x: 500, photo: { w: 320, h: 220, dy: 40 }, note: 'A sinkhole with its own world at the bottom: a refuge of a much older forest.' },
      { id: 'pt:th:spores', kind: 'plant', name: 'Giant tree fern', x: 560, art: () => findArt.plant('#5a7a3a', 18), take: { item: 'plt_throatfern', verb: 'Shake spores from a giant frond', time: 1.8, line: 'Three times taller than the ferns in Fernwood. This species should be extinct.' } },
      { id: 'fos:th:bones', kind: 'fossil', name: 'The bone field', x: 1450, photo: { w: 340, h: 60 }, note: 'Ribs as tall as a door. Not fossils: these bones are recent.' },
      { id: 'fos_tooth', kind: 'fossil', name: 'A fang in the bones', x: 1500, art: () => findArt.glint('#2a2420'), take: { item: 'fos_tooth', verb: 'Pull the fang out of the earth', time: 2.2, line: 'A tooth as long as my hand. Venom groove. Bigger than the Titan’s.', aroha: 'Put it in your pack and don’t make a sound. Whatever lost that tooth may want it back.' } },
      { id: 'pt:th:crystal', kind: 'sample', name: 'Throat crystal', x: 1660, art: () => findArt.glint('#7affb0'), take: { item: 'smp_crystal', verb: 'Chip a crystal off the wall', tools: ['trowel'], time: 2.2, line: 'It glows when I cover it with my hand. Same bacteria as the Glowing Forest?' } },
      { id: 'eco:th:egg', kind: 'ecosystem', name: 'The great egg', x: 1900, photo: { w: 120, h: 60 }, note: 'An egg as big as Chunk, in a nest of branches and bones. It is warm.',
        look: { verb: 'Touch the egg (gently)', lines: () => [
          { who: 'mori', text: 'It’s... warm. Something is alive in there. Something BIG laid this.', expr: 'shocked' },
          { who: 'aroha', text: 'Mori. Hands off. Now. We go home and we tell my koro. Tonight.', expr: 'scared' },
        ] },
        after: () => { game.save.flags['v10:egg'] = true; addNote({ id: 'note:egg', loc: 'unknown', x: 1900, text: 'A warm egg. Something huge nests here.' }); } },
      { id: 'ruin:th:marker', kind: 'ruin', name: 'The marker stone', x: 2200, photo: { w: 30, h: 80 }, note: 'A carved stone of the old people, the same spiral as the pā carving: "go no further".' },
    ],
  },
};
void mix;
