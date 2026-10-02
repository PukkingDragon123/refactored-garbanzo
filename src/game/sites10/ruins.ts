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

/** a retaining wall of fitted stones, mossy along the top */
function stoneWall(w: number, h: number, seed: number) {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  let y = 0;
  while (y < h) {
    const rh = rng.int(5, 9);
    let x = -rng.int(0, 8);
    while (x < w) {
      const sw = rng.int(8, 18), tone = rng.int(1, 4);
      for (let yy = y; yy < Math.min(h, y + rh - 1); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + sw - 1); xx++) {
        const edge = yy === y || xx === x;
        b.set(xx, yy, edge ? STONE[tone + 1] : STONE[clamp(tone + Math.round(bayer(xx, yy) - 0.5), 0, 5)]);
      }
      x += sw;
    }
    y += rh;
  }
  for (let x = 0; x < w; x++) for (let k = 0; k < 2 + Math.round(fbm2(x * 0.1, seed, 2, seed) * 3); k++) b.set(x, k, mix(PAL.moss[3], PAL.moss[5], rng.next()));
  b.outline(hex('#141410'));
  return { buf: b, ax: 0, ay: h - 1 };
}

/** a carved pou: a post of red-brown wood with spirals and a manaia face, standing (tilted) or fallen */
function pou(seed: number, h: number, fallen: boolean) {
  const w = 16, b = new PixelBuffer(fallen ? h + 4 : w + 4, fallen ? w + 4 : h + 4);
  const rng = new Rng(seed);
  for (let t = 0; t < h; t++) for (let s = 0; s < w; s++) {
    const band = Math.floor(t / 14), inBand = t % 14;
    let c = WOOD[clamp(Math.round(2 + (s < 4 ? 1 : s > 11 ? -1 : 0) + (bayer(s, t) - 0.5)), 0, 4)];
    // spirals (koru) and notches in each band, an eye of pāua shell in the face band
    const cx = 8, cy = 7, dx = s - cx, dy = inBand - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (band % 2 === 0 && r < 6 && Math.abs(((r - a * 0.9) % 2.2 + 2.2) % 2.2) < 0.7) c = WOOD[0];
    if (band % 2 === 1 && (s + inBand) % 4 === 0) c = WOOD[0];
    if (band === 1 && Math.hypot(dx + 2, dy) < 1.6) c = hex('#6ab8a8');
    if (rng.next() < 0.03) c = mix(c, PAL.moss[3], 0.6);
    if (fallen) b.set(t + 2, s + 2, c); else b.set(s + 2, h - 1 - t + 2, c);
  }
  b.outline(hex('#140806'));
  return fallen ? { buf: b, ax: Math.floor(h / 2), ay: w + 3 } : { buf: b, ax: 10, ay: h + 3 };
}

/** the great carving: a stone panel with a legged taniwha coiled around a spiral hole */
function carving() {
  const w = 110, h = 86, b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (edge < 2 && bayer(x, y) < 0.4) continue;
    const n = fbm2(x * 0.08, y * 0.08, 3, 5);
    b.set(x, y, STONE[clamp(Math.round(2 + n * 2.4 + (bayer(x, y) - 0.5) * 0.6), 0, 5)]);
  }
  const groove = STONE[0], lip = STONE[5];
  const cx = 55, cy = 46;
  // the spiral hole in the middle
  for (let a = 0; a < Math.PI * 7; a += 0.03) { const r = 2 + a * 1.2; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8; b.set(x, y, groove); b.set(x + 1, y + 1, lip); }
  b.disc(cx, cy, 3, hex('#0c0a08'));
  // the taniwha: a body coiled around it, four legs, a head with a long jaw
  for (let a = 0; a < Math.PI * 1.75; a += 0.02) {
    const r = 33, x = cx + Math.cos(a + 0.6) * r, y = cy + Math.sin(a + 0.6) * r * 0.78;
    for (let k = -2; k <= 2; k++) b.set(x, y + k, k === -2 || k === 2 ? groove : (Math.floor(a * 30) % 3 === 0 ? STONE[1] : STONE[3]));
  }
  for (const a of [1.2, 2.2, 3.5, 4.6]) {
    const x = cx + Math.cos(a + 0.6) * 33, y = cy + Math.sin(a + 0.6) * 33 * 0.78;
    for (let k = 0; k < 7; k++) b.set(x + Math.cos(a + 0.6) * k, y + Math.sin(a + 0.6) * k * 0.78, groove);
  }
  const hx = cx + Math.cos(0.6) * 33, hy = cy + Math.sin(0.6) * 33 * 0.78;
  b.ellipse(hx + 6, hy - 2, 7, 4, STONE[3]);
  for (let k = 0; k < 12; k++) b.set(hx + 2 + k, hy - 2 + (k > 6 ? 1 : 0), groove);
  b.disc(hx + 5, hy - 4, 1.4, hex('#6ab8a8'));
  b.outline(hex('#141410'));
  return { buf: b, ax: Math.floor(w / 2), ay: h - 1 };
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
    for (let x = 1540; x < 2200; x += rng.range(22, 40)) { const hh = rng.int(10, 24); const c = sprite(`pa:stake:${hh}`, () => pou(hh, hh, false)); if (c) main.add(new Prop(c.f, x, ruinsGround(x) + 2, -2, { tint: packColor(0.7, 0.62, 0.55, 1) })); }
    main.add(new Custom(-1.5, rr => {
      for (const x of [900, 960, 1020]) { const y = ruinsGround(x); rr.rect(x - 14, y, 28, 5, packColor(0.06, 0.05, 0.04, 1)); rr.rect(x - 14, y, 28, 1, packColor(0.35, 0.28, 0.2, 1)); }
      const hx = 1120, hy = ruinsGround(hx);
      for (let i = 0; i < 7; i++) rr.rect(hx - 14 + i * 4, hy - 2 - (i % 2), 4, 3, packColor(0.42, 0.42, 0.38, 1));
    }));
    // pou: two still standing (leaning), one fallen across the court
    propAt(f, 'pa:pou1', () => pou(11, 90, false), 820, ruinsGround(820) + 3, -2.5, { tint: packColor(0.9, 0.85, 0.82, 1) });
    propAt(f, 'pa:pou2', () => pou(12, 64, false), 1660, ruinsGround(1660) + 3, -2.5, { tint: packColor(0.9, 0.85, 0.82, 1) });
    propAt(f, 'pa:pou3', () => pou(13, 96, true), 1040, ruinsGround(1040) + 3, -1.5);
    // the great carving
    propAt(f, 'pa:carving', carving, 1320, ruinsGround(1320) + 3, -3);
    // the collapsed stair at the top end: broken steps going down into the dark
    main.add(new Custom(-2, rr => {
      const x0 = 2200, y0 = ruinsGround(x0);
      rr.rect(x0 + 10, y0 + 1, 80, 60, packColor(0.04, 0.035, 0.03, 1));
      for (let i = 0; i < 5; i++) rr.rect(x0 + 14 + i * 9, y0 + 3 + i * 7, 10, 3, packColor(0.42, 0.41, 0.37, 1));
    }));
    // pā vines with red flowers on the walls, ferns, hide spots, light through the trees
    for (const x of [470, 640, 1250, 1720]) propAt(f, `pa:vine:${x % 3}`, () => { const s = plant('flowers', 700 + (x % 3), 26); s.buf.map(c => (c >>> 24 ? (((c & 255) > (c >> 8 & 255)) ? hex('#c8302a') : c) : c)); return s; }, x, ruinsGround(x) + 2, 1.2);
    undergrowth(f, main, 0, W, 0.9, G0, 341, { plants: ['fern', 'crownfern', 'kiokio', 'moss', 'astelia', 'flax', 'kawakawa', 'grass'], fungi: ['bracket', 'coral'], wood: ['rock', 'roots', 'litter', 'stump'] });
    for (const x of [380, 1400, 2000]) hideBush(f, x, G0, x, 0.8);
    shafts(f, main, [{ x: 520, w: 50, a: 0.16 }, { x: 1300, w: 70, a: 0.12 }, { x: 1980, w: 50, a: 0.18 }], [1, 0.94, 0.75], -50, 360, 0.9);
    frontFoliage(f, 260, W, [180, 300], ['fronds', 'leaves', 'flax'], 1.35, G + 112, 351);
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
      { id: 'ruin:pa:pou', kind: 'ruin', name: 'Carved pou', x: 820, photo: { w: 30, h: 96 }, note: 'Carved posts, red with old kōkōwai, spirals and a manaia face. Still standing, just.',
        look: { verb: 'Look at the carved post', lines: () => [
          { who: 'mori', text: 'Spirals... a face with a shell eye. Whoever carved this had all the time in the world.', expr: 'surprised' },
          { who: 'aroha', text: 'Pou. They hold up the stories. This one is somebody’s ancestor, standing guard. Don’t lean on him.', expr: 'serious' },
        ] } },
      { id: 'ruin:pa:rua', kind: 'ruin', name: 'Storage pits', x: 960, note: 'Rua: pits where kūmara were stored through the winter.',
        look: { verb: 'Look into the pits', lines: () => [{ who: 'mori', text: 'Neat rectangular pits. Storage? A whole village’s winter food could go in these.', expr: 'thinking' }, { who: 'aroha', text: 'Rua kūmara. My aunty still stores kūmara like this.', expr: 'happy' }] } },
      { id: 'ruin:pa:carving', kind: 'ruin', name: 'The great carving', x: 1320, photo: { w: 110, h: 86 }, note: 'A taniwha coiled round a hole in the earth: the carvers knew a place nobody goes.',
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
