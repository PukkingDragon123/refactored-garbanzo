// V10: Te Ana Wai, the Sea Grotto. A flooded cave system under the headland, reached by swimming
// through the back of the glowworm cave's pool. A vault whose roof is a sky of glowworms, a cold
// black lake to swim across, a rope up a chimney to a gallery where something was lost long ago, a
// twilight hall under a skylight, a tidal passage, and the sump that breathes with the sea: the way
// on, a breath-hold dive out into the deep.

import type { FieldScene } from '../scenes/field';
import type { Site10, Swim10 } from './kit';
import { swimWater, SWIM_DEPTH, dim, climbSpot, ledge, glowField, arrive10, boulder, propAt, bump, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, layerSpan, bigFrame, clamp } from './kit';
import { groundStrip, mainLayer, shafts, hideBush } from '../sites2/common';
import { Custom, Prop } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { findArt } from '../v10/finds';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';
import { A } from '../assets';

const W = 2400, G = 290;
const LAKE: Swim10 = { x0: 724, x1: 1004, top: G + 6, bottom: G + 90, cold: true, col: [0.04, 0.12, 0.16] };
const TIDE: Swim10 = { x0: 1844, x1: 2104, top: G + 4, bottom: G + 70, col: [0.05, 0.16, 0.2] };
const GALLERY = G - 108;
/** a slope down into deep water: the walk line meets the swimmer's line */
const dip = (x: number, s: Swim10, y: number) => {
  const line = s.top + SWIM_DEPTH;
  if (x >= s.x0 && x <= s.x1) return line;
  const d = x < s.x0 ? s.x0 - x : x - s.x1;
  return d < 26 ? y + (line - y) * (1 - d / 26) : y;
};
export const grottoGround = (x: number) => {
  let y = G + Math.sin(x * 0.013) * 3 + Math.sin(x * 0.051) * 1.5;
  y -= bump(x, 240, 640, 8);
  y += bump(x, 1160, 1490, 5);
  y -= bump(x, 1500, 1800, 9);
  y = dip(x, LAKE, y);
  y = dip(x, TIDE, y);
  return y;
};

const ROCK = PAL.stone, ROCKW = PAL.stoneWarm;
/** a band of cave rock: the roof (stalactites below a ragged edge) or the floor rubble (mounds above) */
function caveBand(w: number, h: number, seed: number, ramp: C[], side: 'top' | 'bottom', depth = 46): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  for (let x = 0; x < w; x++) {
    const e = depth * (0.55 + fbm2(x * 0.012, 0.3, 3, seed) * 0.9) + Math.sin(x * 0.05 + seed) * 4;
    for (let y = 0; y < h; y++) {
      const inside = side === 'top' ? y < e : y > h - e;
      if (!inside) continue;
      const edge = side === 'top' ? e - y : y - (h - e);
      const n = fbm2(x * 0.04, y * 0.06, 3, seed + 1);
      const l = (n - 0.5) * 1.2 + (bayer(x, y) - 0.5) * 0.4 + (edge < 3 ? 0.35 : 0) + (side === 'top' ? -y / h : 0) * 0.4;
      b.set(x, y, ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1)]);
    }
  }
  if (side === 'top') for (let i = 0; i < w / 10; i++) {
    const x = rng.range(0, w), e = depth * (0.55 + fbm2(x * 0.012, 0.3, 3, seed) * 0.9), len = rng.range(5, 28), r0 = rng.range(1.2, 4);
    for (let y = 0; y < len; y++) { const r = r0 * (1 - y / len); for (let dx = -r; dx <= r; dx++) b.set(x + dx, e - 2 + y, ramp[clamp(Math.round(3 + (dx < 0 ? 1 : -1) + (1 - y / len)), 0, ramp.length - 1)]); }
  }
  return b;
}
function bandLayer(f: FieldScene, name: string, p: number, fog: number, y: number, h: number, seed: number, ramp: C[], side: 'top' | 'bottom', depth: number, tint?: number) {
  const st = f.st, r = game.r;
  const span = layerSpan(st, p, 80);
  const tw = Math.min(1024, span.w);
  const fr = bigFrame(r, caveBand(tw, h, seed, ramp, side, depth));
  const lay = st.hasLayer(name) ? st.layer(name) : st.addLayer(name, p, fog, 0.4, 0);
  for (let x = 0; x < span.w; x += tw) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, span.x0 + x, y, 0, { tint }));
}

export const GROTTO: Site10 = {
  id: 'grotto', loc: 'grotto', name: 'Sea Grotto', width: W, camY: 196, spawnX: 90, exitX: 34, waterY: G + 6,
  ambience: 'coast', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G0 = { y: grottoGround };
    dim(f, 0.62, [0.55, 0.78, 1], { bloom: 0.5, vignette: 0.5, fog: [0.03, 0.06, 0.09] });
    // the far cave: a dark wall all the way up
    const far = st.addLayer('far', 0.25, 0.55, 0.2, 0);
    const span = layerSpan(st, 0.25, 60);
    const wall = new PixelBuffer(Math.min(1024, span.w), 480);
    for (let y = 0; y < 480; y++) for (let x = 0; x < wall.w; x++) {
      const n = fbm2(x * 0.02, y * 0.03, 4, 5);
      wall.set(x, y, mix(hex('#0c141a'), hex('#1c2a32'), clamp(n * 1.2 - 0.2 + (bayer(x, y) - 0.5) * 0.15)));
    }
    for (let x = 0; x < span.w; x += wall.w) far.add(new Prop({ ...bigFrame(r, wall), ax: 0, ay: 0 }, span.x0 + x, -120, 0));
    // the roof and the rubble at two depths
    bandLayer(f, 'roof2', 0.5, 0.3, -70, 170, 21, ROCK, 'top', 60, packColor(0.55, 0.62, 0.7, 1));
    bandLayer(f, 'floor2', 0.5, 0.3, 200, 220, 22, ROCK, 'bottom', 90, packColor(0.5, 0.58, 0.66, 1));
    bandLayer(f, 'roof1', 0.78, 0.12, -40, 140, 23, ROCKW, 'top', 50, packColor(0.7, 0.72, 0.76, 1));
    // the glowworm sky on the far roof
    const sky = st.addLayer('glowsky', 0.5, 0, 0, 1);
    sky.add(new Custom(0, (rr, s2) => {
      for (let i = 0; i < 240; i++) {
        const x = 40 + ((i * 97.13) % 1300), y = -30 + ((i * 41.7) % 70) + Math.sin(i) * 6;
        const k = 0.45 + 0.55 * Math.sin(s2.time * 1.1 + i * 2.3);
        rr.fxDraw(A.dot, x, y, 0.6, 0.6, 0, packColor(0.45, 1, 0.85, 1), 1.2 * k);
      }
    }));
    const main = mainLayer(f);
    groundStrip(f, W, G0, [ROCKW[6], ROCKW[5], ROCK[4], ROCK[3]], ROCK[1], 31, 130);
    // the water: the cold lake and the tidal passage
    swimWater(f, LAKE);
    swimWater(f, TIDE);
    // the sump pool at the far end (the way on is the dive): it breathes with the tide
    f.main.add(new Custom(-3, (rr, s2) => {
      rr.water(0.85, 1.4, 0.6);
      rr.rect(2190, G + 3, 210, 60, packColor(0.03, 0.1, 0.14, 1));
      rr.water(0);
      const k = 0.5 + 0.5 * Math.sin(s2.time * 0.5);
      rr.fxDraw(A.soft, 2300, G + 5, 3, 0.4, 0, packColor(0.6, 0.9, 1, 1), 0.25 + 0.25 * k);
      rr.light(2300, G - 10, 120, 0.4, 0.75, 0.9, 0.5 * k, 0.1);
    }));
    // the roof over the gameplay plane, stalactites dripping
    const roof = caveBand(Math.min(1024, W), 120, 41, ROCK, 'top', 44);
    const rf = bigFrame(r, roof);
    for (let x = 0; x < W; x += roof.w) main.add(new Prop({ ...rf, ax: 0, ay: 0 }, x, -26 + (x === 0 ? 0 : 8), -12, { tint: packColor(0.62, 0.66, 0.72, 1) }));
    // boulders and columns (some are trunks for the climbers)
    const rng = new Rng(77);
    for (const [x, w, h] of [[200, 60, 36], [560, 44, 28], [690, 70, 30], [1060, 50, 40], [1530, 80, 44], [1790, 60, 34], [2160, 70, 40]] as const) {
      propAt(f, `gr:b:${x}`, () => boulder(x, w, h, ROCKW, { moss: 0.05 }), x, grottoGround(x) + 4, -4, { tint: packColor(0.7, 0.74, 0.8, 1) });
    }
    for (const x of [380, 1260, 1960]) {
      propAt(f, `gr:col:${x}`, () => boulder(x + 3, 30, 230, ROCK, {}), x, grottoGround(x) + 6, -7, { tint: packColor(0.52, 0.58, 0.66, 1) });
      f.pois.push({ kind: 'trunk', x, y: grottoGround(x), y1: grottoGround(x) - 200 });
      f.pois.push({ kind: 'branch', x: x + 12, y: grottoGround(x) - 120 });
    }
    // the chimney up to the gallery, the gallery itself, and the rope back down
    ledge(f, 1136, 1500, GALLERY, ROCKW, 51, 14);
    climbSpot(f, 1150, GALLERY, grottoGround(1150), 'rope', 'Climb the rope up the chimney', 'Climb back down');
    climbSpot(f, 1488, GALLERY, grottoGround(1488), 'rope', 'Climb the rope up to the gallery', 'Climb down the rope');
    // glowworms: the vault's roof, and threads hanging under the gallery
    glowField(f, 160, 700, -10, 70, 260, [0.45, 1, 0.85], 61, { lights: 6, size: 0.8, z: -11, radius: 110 });
    glowField(f, 1140, 1500, GALLERY + 16, GALLERY + 40, 50, [0.45, 1, 0.85], 62, { lights: 2, size: 0.7 });
    glowField(f, 1850, 2150, -6, 50, 90, [0.45, 1, 0.85], 63, { lights: 3, size: 0.8, z: -11 });
    // the skylight in the twilight hall
    shafts(f, main, [{ x: 1640, w: 46, a: 0.08 }], [0.85, 0.95, 1], -40, 330, 1.2);
    // hide in the rocks
    for (const x of [520, 1700]) hideBush(f, x, G0, x, 0.7);
    // drips from the roof, and their sound
    let dripT = 1;
    main.add(new Custom(0, () => {}, dt => {
      dripT -= dt;
      if (dripT > 0) return;
      dripT = rand.range(0.4, 1.4);
      const x = f.player.x + rand.range(-260, 260);
      main.particles.spawn({ frame: A.dot2, x, y: 30, vx: 0, vy: 40, ay: 380, life: 2, color: [0.75, 0.9, 1], alpha: 0.8, alpha1: 0.6, floorY: grottoGround(x), onFloor: 'die' });
      if (rand.chance(0.35)) f.sfx('drip', x, 0.35, rand.range(0.8, 1.3));
    }));
    void rng;
  },
  spawns: [
    { species: 'hunterbat', n: [2, 4], x: [200, 2200], poi: 'branch', medium: 'trunk', chance: 1 },
    { species: 'mossfrog', n: [2, 4], x: [1520, 1800], herd: true, chance: 0.9 },
    { species: 'pteramander', n: [1, 2], x: [300, 2100], poi: 'trunk', medium: 'trunk', chance: 0.7 },
    { species: 'mudribbon', n: [1, 1], x: [1860, 2090], medium: 'water', chance: 0.6 },
  ],
  insects: [
    { kind: 'firefly', x: [1500, 1800], y: [200, 280], n: 6 },
  ],
  onEnter: f => {
    void arrive10(f, 'Sea Grotto', 'Te Ana Wai', 'Te Ana Wai, the cave of water. Breathe slow: the air down here is very old.');
    audio.play('splashBig' as never, { vol: 0.4 });
  },
  v10: {
    swims: [LAKE, TIDE],
    hardClimbs: [{ x: 1150, rate: 2.5 }, { x: 1488, rate: 2.5 }],
    hazards: [{ x0: 640, x1: 724, kind: 'slip', dmg: 3, warn: 'Wet rock by the water. Walk, don’t run.' }],
    points: [
      { id: 'eco:gr:vault', kind: 'ecosystem', name: 'The glowworm vault', x: 430, y: 60, photo: { w: 420, h: 80 }, note: 'A roof of glowworms like a night sky. They fish with sticky threads for midges.' },
      { id: 'lm:gr:ochre', kind: 'artifact', name: 'Ochre serpent drawing', x: 600, photo: { w: 60, h: 50, dy: 22 }, note: 'Red ochre on the wall: a serpent with legs. Very, very old.',
        art: () => ochreArt(), z: -3.5,
        look: { verb: 'Look at the marks on the wall', lines: () => [
          { who: 'mori', text: 'Red paint on the rock... it’s a drawing. A serpent with four legs. Someone drew a strider down here.', expr: 'surprised' },
          ...(game.save.flags['v4:arohaJoined'] ? [{ who: 'aroha', text: 'My tūpuna drew this. Photograph it, Mori, but don’t touch. Our hands have oil on them; theirs had stories.', expr: 'serious' }] : []),
        ] } },
      { id: 'pt:gr:water', kind: 'sample', name: 'Cave lake water', x: 700, art: () => findArt.sampleSpot('#3a6a7a'), take: { item: 'smp_cavewater', verb: 'Fill a sample jar from the lake', tools: ['jar'], time: 1.6, line: 'Brackish. Fresh water floating on top of the sea.' } },
      { id: 'taonga_toggle', kind: 'artifact', name: 'Pounamu toggle in a crevice', x: 1390, y: GALLERY, art: () => findArt.glint('#3aa06c'), note: 'A greenstone toggle, lost in the gallery long ago.',
        take: { item: 'taonga_toggle', verb: 'Reach into the crevice', time: 2.4, line: 'Something green... a carved stone. Greenstone. It’s beautiful.', aroha: 'Pounamu. Someone wore that close to their heart. We take it home to my koro: he will know whose family it belongs to.' } },
      { id: 'pt:gr:lichen', kind: 'plant', name: 'Cave lichen', x: 1600, art: () => findArt.plant('#a8b4a0', 10), take: { item: 'plt_cavelichen', verb: 'Scrape a little lichen', tools: ['knife'], time: 1.6 } },
      { id: 'pt:gr:lime', kind: 'sample', name: 'Grotto limestone', x: 1730, art: () => findArt.dig('#c8c0a8'), take: { item: 'smp_limestone', verb: 'Chip a rock sample', tools: ['trowel'], time: 1.8 } },
      { id: 'fos_shell', kind: 'fossil', name: 'Fossil scallop', x: 1812, art: () => findArt.glint('#d8d0b8'), take: { item: 'fos_shell', verb: 'Prise out the fossil shell', tools: ['knife'], time: 2.2, line: 'A shell. In the rock. This whole cave was a seabed once.' } },
      { id: 'cave:gr:sump', kind: 'cave', name: 'The breathing sump', x: 2250, photo: { w: 120, h: 50 }, note: 'The water rises and sinks with the tide: the sump opens to the sea.' },
    ],
  },
};

/** a red ochre drawing of a legged serpent on the cave wall */
function ochreArt() {
  const b = new PixelBuffer(46, 30);
  const red = hex('#a8402a'), red2 = hex('#c8603a');
  for (let i = 0; i < 34; i++) { const x = 4 + i, y = 14 + Math.sin(i * 0.35) * 5; b.set(x, y, red); b.set(x, y + 1, i % 3 ? red : red2); }
  for (const lx of [10, 16, 26, 32]) { const y = 14 + Math.sin((lx - 4) * 0.35) * 5; for (let k = 1; k < 6; k++) b.set(lx + (k > 3 ? 1 : 0), y + 1 + k, red); }
  b.ellipse(40, 12, 3, 2, red); b.set(42, 11, hex('#1a0e08'));
  for (let i = 0; i < 4; i++) b.set(43 + i, 13 + (i % 2), red2);
  for (let i = 0; i < 6; i++) b.set(2 + i * 7, 26 + (i % 2), red2);
  return { buf: b, ax: 23, ay: 29 };
}
