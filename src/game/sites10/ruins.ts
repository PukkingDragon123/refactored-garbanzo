// V10: Te Pā Tawhito, the Old Pā. Across a vine bridge from the canopy, the ridge is stepped into
// stone-faced terraces: an ancient pā of Aroha's tūpuna, abandoned long ago and swallowed by the
// forest. Toppled carved pou, the storage pits (their edges crumble), a hearth, palisade stumps and,
// in the inner court, a great carving of a taniwha coiled round a hole in the earth: photograph it,
// make a rubbing, never take. From the top terrace a collapsed stair drops into the dark (with rope,
// the way down to the place the carving shows).
// A wāhi tapu: nothing here is collected except what fell and a rubbing in a notebook.

import type { Site10 } from './kit';
import { arrive10, boulder, propAt, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, bigFrame, clamp } from './kit';
import { groundStrip, mainLayer, skyAndRidge, jungleWalls, trees, undergrowth, hideBush, frontFoliage, shafts } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { plant } from '../../art/jungle-plants';
import { findArt } from '../v10/finds';
import { rumour, addNote } from '../v10/regions';
import { paintTerraceWall, paintRuaPit, paintHearth, paintCollapsedStair } from '../../art/pa';
import { bearerStatue, striderStatue, fallenSerpent, ruinStump, brokenRelief } from '../../art/v12/statues';
import { A } from '../assets';
import { rand } from '../../core/math';

const W = 2300, G = 278;
/** terraces: each step up a stone stair 40 px wide and 22 px high */
const STEPS: [number, number][] = [[220, 260], [720, 760], [1460, 1500]];
export const ruinsGround = (x: number) => {
  let y = G + Math.sin(x * 0.01) * 1.5;
  for (const [a, b] of STEPS) {
    if (x >= b) y -= 22;
    else if (x > a) { const t = (x - a) / (b - a); y -= 22 * (Math.floor(t * 4) / 4 + (t * 4 % 1 > 0.6 ? (t * 4 % 1 - 0.6) / 0.4 / 4 : 0)); }
  }
  return y;
};

const STONE: C[] = [hex('#3a3a36'), hex('#54544c'), hex('#6e6c62'), hex('#8a887a'), hex('#a6a492'), hex('#c2bea8')];
const WOOD: C[] = [hex('#2a140c'), hex('#4a2414'), hex('#6a3420'), hex('#8a462a'), hex('#a85a34')];
const hash = (a: number, b: number) => ((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1 + 1) % 1;

/** a retaining wall of fitted stones, mossy along the top (painted in src/art/pa.ts) */
function stoneWall(w: number, h: number, seed: number) {
  return paintTerraceWall(w, h, seed);
}
export const RUINS: Site10 = {
  id: 'ruins', loc: 'ruins', name: 'The Old Pā', width: W, camY: 170, spawnX: 80, exitX: 30, waterY: null,
  ambience: 'canopy', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G0 = { y: ruinsGround };
    const rng = new Rng(707);
    skyAndRidge(f, { seed: 51, base: 210 });
    jungleWalls(f, G - 30, [{ p: 0.18, fog: 0.5, depth: 0, seed: 311, lift: -30 }, { p: 0.34, fog: 0.35, depth: 1, seed: 312 }, { p: 0.5, fog: 0.22, depth: 2, seed: 313 }]);
    const mid = st.addLayer('mid', 0.8, 0.08, 0.5, 0);
    trees(f, mid, 0, W / 0.8 + 200, [110, 190], ['rata', 'kauri', 'treefern', 'fig'], { y: x => ruinsGround(x / 0.8) }, 321, { variants: 3 });
    // ruined walls in the mid ground
    for (let x = 100; x < W * 0.8; x += rng.range(160, 280)) {
      const c = sprite(`pa:midwall:${Math.floor(x) % 4}`, () => stoneWall(rng.int(50, 110), rng.int(18, 34), Math.floor(x)));
      if (c) mid.add(new Prop(c.f, x, ruinsGround(x / 0.8) + 2, 1, { tint: packColor(0.72, 0.74, 0.7, 1) }));
    }
    const main = mainLayer(f);
    for (const x of [600, 1180, 1880]) trees(f, main, x, x + 1, [10, 10], ['rata'], G0, x, { variants: 1, z: -7, p: 1 });
    for (const x of [600, 1180, 1880]) { f.pois.push({ kind: 'trunk', x, y: ruinsGround(x), y1: ruinsGround(x) - 170 }); f.pois.push({ kind: 'branch', x: x + 18, y: ruinsGround(x) - 100 }, { kind: 'perch', x, y: ruinsGround(x) - 176 }); }
    groundStrip(f, W, G0, [PAL.moss[5], PAL.moss[4], PAL.soil[5], PAL.soil[4]], PAL.soil[1], 61, 130);
    // the vine bridge we came over, its last span tied off at the edge
    main.add(new Custom(-1, (rr, s2) => {
      for (let x = 0; x < 120; x += 2) { const sag = Math.sin((x / 120) * Math.PI) * 6; rr.rect(x, G - 26 + sag + Math.sin(s2.time + x * 0.1) * 0.6, 2, 1, packColor(0.4, 0.5, 0.25, 1)); rr.rect(x, G - 2 + sag * 0.3, 2, 2, packColor(0.45, 0.32, 0.2, 1)); }
    }));
    // the terrace faces: stone walls under each step, and the stairs
    for (const [a] of STEPS) {
      const c = sprite(`pa:face:${a}`, () => stoneWall(40, 30, a));
      if (c) main.add(new Prop(c.f, a, ruinsGround(a) + 6, -4));
      for (let k = 0; k < 4; k++) { const sx = a + k * 10; const c2 = sprite(`pa:step:${k}`, () => boulder(k + 31, 14, 6, STONE, { moss: 0.3 })); if (c2) main.add(new Prop(c2.f, sx + 6, ruinsGround(sx + 8) + 3, -3)); }
    }
    // palisade stumps along the upper terrace, the hearth, the storage pits
    for (let x = 1540; x < 2200; x += rng.range(22, 40)) { const hh = rng.int(10, 24); const c = sprite(`pa:stake:${hh}:${Math.round(x) % 3}`, () => ruinStump(hh * 3 + (Math.round(x) % 3), hh)); if (c) main.add(new Prop(c.f, x, ruinsGround(x) + 2, -2, { tint: packColor(0.8, 0.74, 0.68, 1) })); }
    for (const x of [900, 960, 1020]) propAt(f, `pa:rua:${x}`, () => paintRuaPit(30, x), x, ruinsGround(x) + 1, -1.5);
    propAt(f, 'pa:hearth', () => paintHearth(5), 1120, ruinsGround(1120) + 2, -1.5);
    // the old carvings, going back to the forest (src/art/v12/statues.ts): Matikuku Nui rearing with its
    // claw snapped off at its feet, a forest serpent coiled on a stump, a serpent toppled and broken in two
    propAt(f, 'pa:pou1', () => bearerStatue(31), 820, ruinsGround(820) + 3, -2.5, { tint: packColor(0.92, 0.9, 0.86, 1) });
    propAt(f, 'pa:pou2', () => striderStatue(41), 1660, ruinsGround(1660) + 3, -2.5, { tint: packColor(0.92, 0.88, 0.84, 1) });
    propAt(f, 'pa:pou3', () => fallenSerpent(51), 1040, ruinsGround(1040) + 3, -1.5);
    // the great carving: a cracked slab, a corner fallen
    propAt(f, 'pa:carving', () => brokenRelief(61), 1320, ruinsGround(1320) + 3, -3);
    // the collapsed stair at the top end: broken steps going down into the dark
    {
      const x0 = 2200, y0 = ruinsGround(x0);
      const cs = sprite('pa:downstair', () => ({ buf: paintCollapsedStair(84, 62, 9), ax: 0, ay: 0 } as never));
      if (cs) main.add(new Prop(cs.f, x0 + 8, y0, -2));
    }
    // leaves spinning down through the light
    main.add(new Custom(30, () => {}, dt => {
      if (!rand.chance(dt * 1.6)) return;
      const x = f.st.cam.x + rand.range(-320, 320);
      main.particles.spawn({ frame: A.dot2, x, y: ruinsGround(x) - rand.range(150, 230), vx: rand.range(-4, 6) + f.st.wind * 6, vy: rand.range(8, 16), life: rand.range(8, 12), color: rand.chance(0.5) ? [0.62, 0.5, 0.22] : [0.42, 0.55, 0.22], alpha: 1, alpha1: 0.8, wobble: 10, wobbleF: 1.2, size: 0.8, floorY: ruinsGround(x) + 2 });
    }));
    // pā vines with red flowers on the walls, ferns, hide spots, light through the trees
    for (const x of [470, 640, 1250, 1720]) propAt(f, `pa:vine:${x % 3}`, () => { const s = plant('flowers', 700 + (x % 3), 26); s.buf.map(c => (c >>> 24 ? (((c & 255) > (c >> 8 & 255)) ? hex('#c8302a') : c) : c)); return s; }, x, ruinsGround(x) + 2, 1.2);
    undergrowth(f, main, 0, W, 0.9, G0, 341, { plants: ['fern', 'crownfern', 'kiokio', 'moss', 'astelia', 'flax', 'kawakawa', 'grass'], fungi: ['bracket', 'coral'], wood: ['rock', 'roots', 'litter', 'stump'] });
    for (const x of [380, 1400, 2000]) hideBush(f, x, G0, x, 0.8);
    shafts(f, main, [{ x: 520, w: 50, a: 0.16 }, { x: 1300, w: 70, a: 0.12 }, { x: 1980, w: 50, a: 0.18 }], [1, 0.94, 0.75], -50, 360, 0.9);
    frontFoliage(f, 260, W, [180, 300], ['fronds', 'flax', 'grass'], 1.35, G + 112, 351);
    frontFoliage(f, 260, W, [300, 500], ['vines', 'branch'], 1.35, -40, 352, { hang: true });
    for (const x of [300, 1240, 2080]) f.pois.push({ kind: 'rock', x, y: ruinsGround(x) - 4 }, { kind: 'fruit', x: x + 30, y: ruinsGround(x + 30), amount: 15 });
    void bigFrame; void r;
  },
  spawns: [
    { species: 'cragviper', n: [1, 2], x: [700, 2100], poi: 'rock', times: ['day', 'dusk'], chance: 0.8 },
    { species: 'barkgecko', n: [2, 3], x: [500, 2000], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'skyribbon', n: [1, 2], x: [500, 2000], poi: 'branch', medium: 'trunk', times: ['dawn', 'day'], chance: 0.8 },
    { species: 'galehawk', n: [1, 1], x: [200, 2200], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'flicker', n: [1, 1], x: [400, 2100], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'nutcracker', n: [3, 5], x: [1150, 1350], herd: true, times: ['dawn', 'day'], chance: 0.8 },
    { species: 'sailglider', n: [1, 2], x: [500, 2000], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night', 'dawn'], chance: 0.8 },
  ],
  insects: [
    { kind: 'butterfly', x: [100, 2200], y: [170, 250], n: 6, times: ['day', 'dawn'] },
    { kind: 'bee', x: [400, 1800], y: [200, 260], n: 4, times: ['day'] },
    { kind: 'firefly', x: [0, W], y: [150, 270], n: 18, times: ['dusk', 'night'] },
  ],
  onEnter: f => arrive10(f, 'The Old Pā', 'Te Pā Tawhito', 'This was a pā of my tūpuna, long before my koro’s koro. It is tapu, Mori. We look, we photograph. We take nothing.'),
  v10: {
    hazards: [{ x0: 880, x1: 1040, kind: 'slip', dmg: 3, warn: 'The old storage pits. Their edges crumble: walk around, not over.' }],
    points: [
      { id: 'ruin:pa:terraces', kind: 'ruin', name: 'The stone terraces', x: 480, photo: { w: 300, h: 80, dy: -10 }, note: 'Stone-faced terraces climb the ridge: a pā, centuries old.' },
      { id: 'ruin:pa:pou', kind: 'ruin', name: 'The stone beast', x: 820, photo: { w: 80, h: 112 }, note: 'A great beast carved in stone, up on its hind legs, one arm raised. Its claw lies broken in the moss.',
        look: { verb: 'Look at the stone beast', lines: () => [
          { who: 'mori', text: 'It’s rearing up... and that arm used to end in something huge. There, in the moss: a claw as long as my leg.', expr: 'surprised' },
          { who: 'aroha', text: 'Matikuku Nui. The old people carved what they feared, so nobody forgot to respect it. Don’t lean on it.', expr: 'serious' },
        ] } },
      { id: 'ruin:pa:rua', kind: 'ruin', name: 'Storage pits', x: 960, note: 'Rua: pits where kūmara were stored through the winter.',
        look: { verb: 'Look into the pits', lines: () => [{ who: 'mori', text: 'Neat rectangular pits. Storage? A whole village’s winter food could go in these.', expr: 'thinking' }, { who: 'aroha', text: 'Rua kūmara. My aunty still stores kūmara like this.', expr: 'happy' }] } },
      { id: 'ruin:pa:carving', kind: 'ruin', name: 'The great carving', x: 1320, photo: { w: 124, h: 96 }, note: 'A taniwha coiled round a hole in the earth: the carvers knew a place nobody goes.',
        take: { item: 'art_glyphrub', verb: 'Make a charcoal rubbing in your notebook', time: 3, line: 'A legged serpent... coiled around a spiral going down. Down into what?', aroha: 'A rubbing takes nothing from the stone. My koro will want to see it. He doesn’t like what it shows.' },
        after: () => { rumour('unknown'); addNote({ id: 'note:carving', loc: 'ruins', x: 1320, text: 'The carving points south-east: a hole in the earth. "Te Korokoro"?' }); } },
      { id: 'pt:pa:vine', kind: 'plant', name: 'Pā vine flower', x: 640, art: () => findArt.plant('#c8302a', 14), take: { item: 'plt_pavine', verb: 'Pick a vine flower', time: 1.2 } },
      { id: 'pt:pa:fern', kind: 'fossil', name: 'Fern-print stone', x: 1760, art: () => findArt.glint('#9a9078'), note: 'A wall stone that fell long ago, with a fossil fern in it.',
        take: { item: 'fos_leaf', verb: 'Pick up the fallen stone with the fern print', time: 2, line: 'A fern in the stone. The builders picked a pretty rock.', aroha: 'That one fell from the wall long ago. It’s rock, not a carving. You can take it.' } },
      { id: 'lm:pa:lookout', kind: 'landmark', name: 'The top terrace', x: 2060, photo: { w: 260, h: 140, dy: 60 }, note: 'From the top: the whole interior, and far to the south-east a dark hollow in the land.',
        look: { verb: 'Look out over the land', lines: () => [{ who: 'mori', text: 'You can see everything from up here. The falls... the steam over there... and that. A hole in the land. A big one.', expr: 'surprised' }] },
        after: () => rumour('unknown') },
    ],
  },
};
void hex;
