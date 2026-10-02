// V10: Te Toka Iwi, the Bone Cliffs. The gorge above Thunder Falls cuts through banded rock that is
// tens of millions of years old, and the walls are full of bones: a whole ancient serpent lies along
// the cliff, legs and all. The gorge floor is scree that slides under running feet; ropes go up to a
// bone terrace and on to a high ledge where rocks come down, and at its far end a cleft drops into a
// dark valley that glows (the way deeper, to the Glowing Forest).

import type { Site10 } from './kit';
import { climbSpot, ledge, arrive10, boulder, propAt, bump, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, layerSpan, bigFrame, clamp, wallLayer } from './kit';
import { groundStrip, mainLayer, skyAndRidge, undergrowth, hideBush, frontFoliage, trees } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { findArt } from '../v10/finds';
import { A } from '../assets';

const W = 2300, G = 290, TERRACE = 206, HIGH = 138;
export const fossilGround = (x: number) => G + Math.sin(x * 0.011) * 3 + Math.sin(x * 0.043) * 1.5 - bump(x, 430, 930, 44) - bump(x, 1700, 2250, 16);

/** banded rock: grey, cream, rust and ash, the stripes of a very long time */
const BAND: C[] = [hex('#3c3430'), hex('#5a4a40'), hex('#7a6252'), hex('#9a7c62'), hex('#b8987a'), hex('#d0b494'), hex('#e2cca8')];
const STRATA: C[] = [hex('#a8583a'), hex('#d8c8a0'), hex('#6a6a6a'), hex('#c89a6a'), hex('#e8dcc0'), hex('#8a5a42')];

/** the great skeleton in the cliff: a legged serpent's spine, ribs, skull and fangs, set in darker matrix */
function skeleton(): { buf: PixelBuffer; ax: number; ay: number } {
  const w = 470, h = 120;
  const b = new PixelBuffer(w, h);
  const bone = [hex('#8a7a5a'), hex('#b8a47a'), hex('#d8c8a0'), hex('#efe2c0')], mat = hex('#2e2620');
  const spine = (t: number): [number, number] => [20 + t * 400, 62 + Math.sin(t * 7.2) * 18 + Math.sin(t * 2.1) * 8];
  // the dark matrix around the bones (where the rock was dug back)
  for (let i = 0; i <= 200; i++) { const [x, y] = spine(i / 200); b.ellipse(x, y, 12, 22, mat); }
  // ribs
  for (let i = 4; i < 70; i++) {
    const t = i / 80, [x, y] = spine(t), [x2, y2] = spine(t + 0.004);
    const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
    const len = 18 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.9) + 4;
    for (const side of [1, -1]) for (let k = 0; k < len; k++) {
      const c = k / len;
      b.set(x + (nx / nl) * k * side + c * c * 4, y + (ny / nl) * k * side + c * 3, bone[k < 2 ? 3 : 1 + (k % 2)]);
    }
  }
  // vertebrae
  for (let i = 0; i <= 64; i++) { const [x, y] = spine(i / 64); b.ellipse(x, y, 3.2, 4.2, bone[2]); b.set(x - 1, y - 2, bone[3]); b.set(x + 1, y + 2, bone[0]); }
  // four legs
  for (const t of [0.22, 0.3, 0.62, 0.7]) {
    const [x, y] = spine(t);
    let px = x, py = y + 4;
    for (let k = 0; k < 26; k++) { px += 0.25; py += 1; b.set(px, py, bone[2]); b.set(px + 1, py, bone[1]); }
    for (let k = 0; k < 10; k++) { b.set(px + k, py + (k % 3 === 0 ? 1 : 0), bone[2]); }
  }
  // the skull: long, with a row of fangs
  const [sx, sy] = spine(1);
  b.ellipse(sx + 18, sy - 2, 22, 11, mat);
  b.ellipse(sx + 16, sy - 3, 19, 8, bone[2]);
  b.ellipse(sx + 10, sy - 5, 4, 3, mat);
  for (let k = 0; k < 9; k++) { const fx = sx + 4 + k * 3.6; for (let j = 0; j < 4 + (k % 3); j++) b.set(fx, sy + 4 + j, j > 2 ? bone[3] : bone[2]); }
  b.outline(hex('#1a1410'));
  return { buf: b, ax: 0, ay: h - 1 };
}

export const FOSSILS: Site10 = {
  id: 'fossils', loc: 'fossils', name: 'Bone Cliffs', width: W, camY: 176, spawnX: 80, exitX: 30, waterY: G + 8,
  ambience: 'falls', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G0 = { y: fossilGround };
    const rng = new Rng(404);
    skyAndRidge(f, { seed: 31, base: 200 });
    // the far wall of the gorge and a nearer one, banded
    wallLayer(f, 'gorgeFar', 0.22, 0.45, 40, 300, 41, BAND.map(c => mix(c, hex('#8aa0b8'), 0.35)), { strata: 0.22, tint: packColor(0.85, 0.88, 0.95, 1) });
    const near = st.addLayer('gorgeNear', 0.55, 0.15, 0.5, 0);
    const span = layerSpan(st, 0.55, 80);
    for (let x = span.x0, i = 0; x < span.x0 + span.w; x += 300, i++) {
      const c = sprite(`fo:crag:${i % 4}`, () => boulder(50 + i, 280, 230, BAND, { strata: STRATA, moss: 0.1 }));
      if (c) near.add(new Prop(c.f, x + rng.range(0, 80), G + 4, 0, { tint: packColor(0.78, 0.76, 0.78, 1) }));
    }
    const mid = st.addLayer('mid', 0.8, 0.06, 0.55, 0);
    trees(f, mid, 0, W / 0.8 + 200, [180, 320], ['rata', 'treefern', 'broadleaf'], { y: x => fossilGround(x / 0.8) }, 61, { variants: 2 });
    const main = mainLayer(f);
    // the cliff behind the terraces, banded, with the skeleton in it
    const cliff = new PixelBuffer(1500, 230);
    for (let y = 0; y < 230; y++) for (let x = 0; x < 1500; x++) {
      const edge = 6 + fbm2(x * 0.01, 0.2, 3, 7) * 24;
      if (y < edge) continue;
      const s = Math.floor((y + Math.sin(x * 0.012) * 9 + fbm2(x * 0.02, y * 0.02, 2, 3) * 8) / 7) % STRATA.length;
      const n = fbm2(x * 0.05, y * 0.08, 3, 11);
      cliff.set(x, y, mix(BAND[clamp(Math.round(n * 6 + (bayer(x, y) - 0.5)), 0, 6)], STRATA[s], 0.35));
    }
    main.add(new Prop({ ...bigFrame(r, cliff), ax: 0, ay: 0 }, 820, 40, -9, { tint: packColor(0.82, 0.8, 0.8, 1) }));
    const sk = sprite('fo:skeleton', skeleton);
    if (sk) main.add(new Prop(sk.f, 960, TERRACE - 6, -8.5));
    groundStrip(f, W, G0, [PAL.stoneWarm[6], PAL.stoneWarm[5], hex('#8a7058'), hex('#6e5a48')], PAL.stoneWarm[1], 23, 120);
    // the river along the gorge floor
    f.main.add(new Custom(-2, (rr, s2) => {
      rr.water(0.8, 1.6, 0.9);
      rr.rect(0, G + 8, W, 26, packColor(0.12, 0.28, 0.32, 1));
      rr.water(0);
      for (let i = 0; i < 40; i++) { const gx = (i * 61.7 + s2.time * 40) % W; rr.fxDraw(A.dot2, gx, G + 9, 1.6, 0.4, 0, packColor(1, 1, 1, 1), 0.4); }
    }));
    // the terrace and the high ledge, and the ropes up
    ledge(f, 900, 1500, TERRACE, BAND, 71, 14);
    ledge(f, 1420, 2290, HIGH, BAND, 72, 16);
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
      { id: 'fos_vertebra', kind: 'fossil', name: 'Loose vertebra', x: 1260, y: TERRACE, art: () => findArt.glint('#d8c8a0'),
        take: { item: 'fos_vertebra', verb: 'Lift the loose vertebra (heavy)', time: 3, line: 'Oof. It’s like carrying a bowling ball. A bowling ball that was ALIVE.', aroha: 'That one fell out of the cliff on its own. You can take it. The rest stays.' } },
      { id: 'fos_ammonite', kind: 'fossil', name: 'Ammonite in the scree', x: 760, art: () => findArt.glint('#c8b8a0'), take: { item: 'fos_ammonite', verb: 'Pick up the coiled stone', time: 1.6, line: 'An ammonite! This cliff used to be the bottom of the sea.' } },
      { id: 'fos_leaf', kind: 'fossil', name: 'Fern imprint', x: 1700, y: HIGH, art: () => findArt.glint('#9a9078'), take: { item: 'fos_leaf', verb: 'Split the slab', tools: ['trowel'], time: 2.4, line: 'A fern. Exactly like the ones in Fernwood. Fifty million years, and it hasn’t changed its outfit.' } },
      { id: 'pt:fo:scree', kind: 'sample', name: 'Banded rock', x: 600, art: () => findArt.dig('#a87a5a'), take: { item: 'smp_scree', verb: 'Take a rock sample', tools: ['trowel'], time: 1.8 } },
      { id: 'cave:fo:cleft', kind: 'cave', name: 'The cleft', x: 2230, y: HIGH, photo: { w: 80, h: 60 }, note: 'A crack in the gorge head. Cold air, and a faint green glow, come up out of it.' },
    ],
  },
};
