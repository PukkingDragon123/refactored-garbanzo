// V10: Te Ngahere Kānapanapa, the Glowing Forest. A valley sunk under the plateau with a roof of
// leaves so thick it is always dusk down here, lit from below: glowcaps and lantern-caps, shelf fungi
// big enough to climb like stairs, moss that shines, spores drifting like snow, a pool lit from inside.
// Spore hollows puff clouds that make you cough (energy). Lure-vipers wave their lights in the dark.
// At the far end a warm wind blows in from somewhere steaming (the way deeper, to the Hot Valley).

import type { FieldScene } from '../scenes/field';
import type { Site10, Swim10 } from './kit';
import { swimWater, SWIM_DEPTH, dim, ledge, glowField, arrive10, boulder, pillar, propAt, bump, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, clamp } from './kit';
import { groundStrip, mainLayer, jungleWalls, ceiling, trees, undergrowth, hideBush, frontFoliage } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { plant } from '../../art/jungle-plants';
import { findArt } from '../v10/finds';
import { A } from '../assets';
import { rand } from '../../core/math';

const W = 2300, G = 288;
const POOL: Swim10 = { x0: 1130, x1: 1330, top: G + 4, bottom: G + 64, col: [0.05, 0.3, 0.32] };
const dip = (x: number, s: Swim10, y: number) => {
  const line = s.top + SWIM_DEPTH;
  if (x >= s.x0 && x <= s.x1) return line;
  const d = x < s.x0 ? s.x0 - x : x - s.x1;
  return d < 24 ? y + (line - y) * (1 - d / 24) : y;
};
export const glowGround = (x: number) => dip(x, POOL, G + Math.sin(x * 0.009) * 5 + Math.sin(x * 0.037) * 2 - bump(x, 1700, 2100, 12));

const CYAN: [number, number, number] = [0.35, 1, 0.85], VIOLET: [number, number, number] = [0.75, 0.5, 1], GOLD: [number, number, number] = [1, 0.85, 0.4];

/** a giant mushroom: a pale stem and a broad cap with glowing gills (the glow on its own layer) */
function giantShroom(seed: number, h: number, capW: number, col: [number, number, number]): { buf: PixelBuffer; glow: PixelBuffer; ax: number; ay: number } {
  const w = capW + 6, b = new PixelBuffer(w, h), g = new PixelBuffer(w, h);
  const cx = w / 2, capH = Math.round(capW * 0.32);
  const stem = [hex('#5a5a6a'), hex('#7a7a8a'), hex('#a0a0b0'), hex('#c4c4d0')];
  for (let y = capH - 2; y < h; y++) {
    const r = 3 + (y / h) * 4 + Math.sin(y * 0.3 + seed) * 0.6;
    for (let x = -r; x <= r; x++) b.set(cx + x, y, stem[clamp(Math.round((1 - (x + r) / (2 * r)) * 3 + (bayer(cx + x, y) - 0.5)), 0, 3)]);
  }
  const cap = [hex('#2a2440'), hex('#3c3458'), hex('#544a78'), hex('#6e6296')];
  for (let y = 0; y < capH; y++) {
    const half = (capW / 2) * Math.sqrt(1 - Math.pow(1 - y / capH, 2));
    for (let x = -half; x <= half; x++) b.set(cx + x, y, cap[clamp(Math.round((1 - y / capH) * 2 + (x < 0 ? 1 : 0) + (bayer(cx + x, y) - 0.5)), 0, 3)]);
  }
  // gills under the cap and spots on top glow
  const gc = hex('#' + col.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''));
  for (let x = -capW / 2 + 3; x < capW / 2 - 3; x++) { if (Math.floor(x) % 2 === 0) { g.set(cx + x, capH - 1, gc); g.set(cx + x, capH, mix(gc, hex('#ffffff'), 0.3)); } }
  const rng = new Rng(seed);
  for (let i = 0; i < capW / 6; i++) { const x = rng.range(-capW / 2.6, capW / 2.6), y = rng.range(2, capH - 4); g.set(cx + x, y, gc); }
  b.outline(hex('#0c0a14'));
  return { buf: b, glow: g, ax: Math.floor(cx), ay: h - 1 };
}

/** a shelf fungus on a trunk: a half-disc bracket you can stand on, its rim glowing */
function shelf(seed: number, w: number, col: [number, number, number]) {
  const h = Math.round(w * 0.32), b = new PixelBuffer(w, h), g = new PixelBuffer(w, h);
  const ramp = [hex('#4a3a2a'), hex('#6a5038'), hex('#8a6a48'), hex('#a88a5a')];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / w, ny = y / h;
    if (ny > Math.sin(nx * Math.PI) * 1.05) continue;
    b.set(x, y, ramp[clamp(Math.round(3 - ny * 3 + (bayer(x, y) - 0.5) + (Math.sin(nx * 30 + seed) > 0.7 ? -1 : 0)), 0, 3)]);
    if (ny > Math.sin(nx * Math.PI) * 0.8) g.set(x, y, packHex(col));
  }
  b.outline(hex('#140c08'));
  return { buf: b, glow: g, ax: 0, ay: 1 };
}
const packHex = (c: [number, number, number]) => hex('#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''));

/** draw a sprite with its glow layer emissive, and a light */
function glowProp(f: FieldScene, key: string, gen: () => { buf: PixelBuffer; glow: PixelBuffer; ax: number; ay: number }, x: number, y: number, z: number, col: [number, number, number], light = 70) {
  const c = sprite(key, () => { const s = gen(); return { buf: s.buf, glow: s.glow, ax: s.ax, ay: s.ay } as never; });
  if (!c) return;
  f.main.add(new Prop(c.f, x, y, z));
  const gf = c.g;
  f.main.add(new Custom(z + 0.1, (rr, st) => {
    if (!gf) return;
    const k = 0.8 + 0.2 * Math.sin(st.time * 1.4 + x);
    rr.emissive(1);
    rr.draw(gf, x, y, 1, 1, 0, packColor(1, 1, 1, k));
    rr.emissive();
    rr.light(x, y - (c.s.buf.h * 0.6), light, col[0], col[1], col[2], 0.55 * k, 0.1);
  }));
  f.lights.push({ x, y: y - 30, r: light, k: 0.3 });
}

export const GLOWFOREST: Site10 = {
  id: 'glowforest', loc: 'glowforest', name: 'The Glowing Forest', width: W, camY: 186, spawnX: 80, exitX: 30, waterY: G + 4,
  ambience: 'forest', music: 'spooky', ground: 'leaves',
  build(f) {
    const st = f.st, G0 = { y: glowGround };
    const rng = new Rng(808);
    dim(f, 0.5, [0.55, 0.7, 1], { bloom: 0.7, vignette: 0.45, fog: [0.05, 0.08, 0.14] });
    ceiling(f, 0.3, -40, 17);
    jungleWalls(f, G, [
      { p: 0.18, fog: 0.6, depth: 0, seed: 211 }, { p: 0.34, fog: 0.45, depth: 1, seed: 212 }, { p: 0.52, fog: 0.3, depth: 2, seed: 213 },
    ]);
    const mid = st.addLayer('mid', 0.82, 0.12, 0.45, 0);
    trees(f, mid, 0, W / 0.82 + 200, [90, 160], ['fig', 'kauri', 'treefern', 'rata'], { y: x => glowGround(x / 0.82) }, 221, { variants: 3, tint: packColor(0.5, 0.55, 0.75, 1) });
    // glowing things far off in the dark, at two depths
    for (const [p, n, sd] of [[0.34, 160, 1], [0.52, 120, 2]] as const) {
      const lay = st.addLayer('glow' + sd, p, 0, 0, 1);
      const pts = Array.from({ length: n }, (_, i) => ({ x: ((i * 131.7) % (W * p + 600)) - 100, y: G - 4 - ((i * 37.3) % 60), c: i % 3 }));
      lay.add(new Custom(0, (rr, s2) => {
        for (const q of pts) { const k = 0.5 + 0.5 * Math.sin(s2.time + q.x); const c = q.c === 0 ? CYAN : q.c === 1 ? VIOLET : GOLD; rr.fxDraw(A.dot, q.x, q.y, 0.8, 0.8, 0, packColor(c[0], c[1], c[2], 1), 1.2 * k); }
      }));
    }
    const main = mainLayer(f);
    for (const x of [420, 980, 1500, 2080]) {
      trees(f, main, x, x + 1, [10, 10], ['kauri'], G0, x, { variants: 1, z: -6, p: 1, tint: packColor(0.6, 0.62, 0.8, 1) });
      f.pois.push({ kind: 'trunk', x, y: glowGround(x), y1: glowGround(x) - 180 });
      f.pois.push({ kind: 'branch', x: x + 18, y: glowGround(x) - 110 }, { kind: 'perch', x, y: glowGround(x) - 186 });
    }
    groundStrip(f, W, G0, [hex('#3a4a3a'), hex('#2e3e34'), PAL.soil[3], PAL.soil[2]], PAL.soil[0], 41, 120);
    swimWater(f, POOL);
    // the pool glows from inside
    main.add(new Custom(-2.5, (rr, s2) => {
      const k = 0.7 + 0.3 * Math.sin(s2.time * 0.8);
      rr.light((POOL.x0 + POOL.x1) / 2, POOL.top + 10, 180, CYAN[0], CYAN[1], CYAN[2], 0.9 * k, 0.15);
      rr.emissive(0.6);
      rr.rect(POOL.x0, POOL.top + 6, POOL.x1 - POOL.x0, 18, packColor(0.15, 0.6, 0.55, 0.35 * k));
      rr.emissive();
    }));
    // giant mushrooms and the shelf-fungus stair on the big fig
    for (const [x, h, cw, c] of [[260, 120, 70, CYAN], [700, 150, 90, VIOLET], [1460, 110, 64, CYAN], [1880, 170, 100, GOLD], [2180, 90, 54, VIOLET]] as const) {
      glowProp(f, `gf:gm:${x}`, () => giantShroom(x, h, cw, c as [number, number, number]), x, glowGround(x) + 3, -5, c as [number, number, number], 110);
    }
    const stair: [number, number][] = [[612, G - 20], [648, G - 40], [612, G - 60], [648, G - 80], [614, G - 100]];
    for (const [i, [x, y]] of stair.entries()) {
      f.st.terrain.addPlatform([[x, y], [x + 40, y]], 'branch');
      glowProp(f, `gf:sh:${i}`, () => shelf(i + 3, 46, i % 2 ? CYAN : GOLD), x - 3, y, -4, i % 2 ? CYAN : GOLD, 50);
    }
    propAt(f, 'gf:stairtrunk', () => pillar(9, 26, 170, [hex('#2a2018'), hex('#3a2c20'), hex('#4c3a2a'), hex('#5e4a36')]), 640, G + 4, -6);
    // glowing fungi on the floor (they glow by day as well: the sun never reaches down here)
    for (let x = 40; x < W; x += rng.range(26, 60)) {
      const glow = rng.chance(0.7);
      const c = rng.pick([CYAN, VIOLET, GOLD]);
      const s = sprite(`gf:sh${rng.int(0, 5)}:${glow ? 1 : 0}`, () => { const m = glowShrooms(rng.int(1, 999), c); return m as never; });
      if (!s) continue;
      const y = glowGround(x) + 2;
      main.add(new Prop(s.f, x, y, 2));
      if (s.g && glow) { const g = s.g; main.add(new Custom(2.1, (rr, s2) => { rr.emissive(1); rr.draw(g, x, y, 1, 1, 0, packColor(1, 1, 1, 0.7 + 0.3 * Math.sin(s2.time * 2 + x))); rr.emissive(); })); }
    }
    undergrowth(f, main, 0, W, 1.1, G0, 241, { plants: ['fern', 'crownfern', 'moss', 'kidneyfern', 'astelia', 'umbrellafern'], fungi: ['bracket', 'veil', 'coral', 'spiral'], wood: ['rottenlog', 'roots', 'stump', 'litter'] });
    // ghost ferns: pale, almost white
    for (const x of [340, 560, 1040, 1620, 1780, 2010]) propAt(f, `gf:ghost:${x % 3}`, () => { const s = plant('crownfern', 900 + (x % 3), 30); s.buf.map(c => (c >>> 24 ? mix(c, hex('#e8f4f0'), 0.65) : c)); return s; }, x, glowGround(x) + 2, 1.5);
    // spores drifting everywhere, and glowing moss on the roots
    glowField(f, 0, W, 120, 280, 220, CYAN, 251, { lights: 0, size: 0.55, drift: true, z: 40 });
    glowField(f, 0, W, 200, 285, 90, GOLD, 252, { lights: 0, size: 0.5, drift: true, z: 40 });
    for (const x of [500, 1400, 1950]) hideBush(f, x, G0, x, 0.8);
    frontFoliage(f, 260, W, [180, 300], ['fronds', 'leaves', 'monstera'], 1.35, G + 112, 261, { tint: packColor(0.25, 0.3, 0.42, 1) });
    frontFoliage(f, 260, W, [300, 480], ['vines', 'branch'], 1.35, -40, 262, { hang: true, tint: packColor(0.25, 0.3, 0.42, 1) });
    // fireflies the colour of the fungi
    let spT = 0;
    main.add(new Custom(0, () => {}, dt => {
      spT -= dt;
      if (spT > 0) return;
      spT = 0.25;
      const x = f.player.x + rand.range(-300, 300);
      main.glowParticles.spawn({ frame: A.dot, x, y: glowGround(x) - 2, vx: rand.range(-4, 4), vy: rand.range(-10, -4), life: rand.range(3, 6), color: [0.5, 1, 0.9], alpha: 0.9, alpha1: 0, glow: true, intensity: 1.5, wobble: 4, wobbleF: 1 });
    }));
  },
  spawns: [
    { species: 'lurevip', n: [2, 3], x: [300, 2100], poi: 'branch', medium: 'trunk', chance: 1 },
    { species: 'sailglider', n: [2, 3], x: [300, 2100], poi: 'trunk', medium: 'trunk', chance: 0.9 },
    { species: 'hunterbat', n: [1, 2], x: [300, 2100], poi: 'branch', medium: 'trunk', chance: 0.8 },
    { species: 'mossfrog', n: [3, 5], x: [1080, 1380], herd: true, chance: 1 },
    { species: 'pteramander', n: [1, 2], x: [200, 2100], poi: 'trunk', medium: 'trunk', chance: 0.7 },
    { species: 'quillhog', n: [1, 1], x: [1500, 2200], chance: 0.6 },
  ],
  insects: [
    { kind: 'firefly', x: [0, W], y: [160, 285], n: 34 },
    { kind: 'lanternbeetle', x: [200, 2100], y: [270, 286], n: 8 },
    { kind: 'skymoth', x: [200, 2100], y: [150, 260], n: 5 },
  ],
  onEnter: f => arrive10(f, 'The Glowing Forest', 'Te Ngahere Kānapanapa', 'Kānapanapa: it shines. Even the old stories only whisper about this place. Keep your voice down.'),
  v10: {
    dark: 0.8,
    swims: [POOL],
    hazards: [
      { x0: 860, x1: 1060, kind: 'spores', dmg: 5, period: 3.5, warn: 'See the puffballs? Hold your breath when they burst.' },
      { x0: 1560, x1: 1740, kind: 'spores', dmg: 5, period: 3 },
    ],
    points: [
      { id: 'eco:gf:forest', kind: 'ecosystem', name: 'The Glowing Forest', x: 700, photo: { w: 260, h: 160 }, note: 'Fungi light a valley the sun never reaches. Whole food chains run on their glow.' },
      { id: 'lm:gf:stair', kind: 'landmark', name: 'The fungus stair', x: 640, photo: { w: 80, h: 130 }, note: 'Shelf fungi like steps up a fig: strong enough to stand on.' },
      { id: 'pt:gf:cap', kind: 'plant', name: 'Lantern-cap', x: 634, y: G - 100, art: () => findArt.plant('#7affe0', 10), take: { item: 'plt_lanterncap', verb: 'Cut a lantern-cap from the top shelf', tools: ['knife'], time: 2, line: 'It’s still glowing in the jar. That will never get old.' } },
      { id: 'pt:gf:ghost', kind: 'plant', name: 'Ghost fern', x: 1040, art: () => findArt.plant('#e8f4f0', 16), take: { item: 'plt_ghostfern', verb: 'Take a ghost fern frond', tools: ['knife'], time: 1.6, line: 'No green at all. How does a fern live without light?' } },
      { id: 'eco:gf:pool', kind: 'ecosystem', name: 'The lit pool', x: 1230, photo: { w: 200, h: 40 }, note: 'A pool glowing from inside: bacteria living in the water itself.' },
      { id: 'pt:gf:soil', kind: 'sample', name: 'Glowing soil', x: 1820, art: () => findArt.dig('#2a3a3a'), take: { item: 'smp_soil', verb: 'Take a soil core', tools: ['trowel'], time: 1.8, line: 'The threads in this soil glow when I break them. The whole valley is wired.' } },
    ],
  },
};

/** a cluster of small mushrooms with a glow layer */
function glowShrooms(seed: number, col: [number, number, number]) {
  const rng = new Rng(seed);
  const W2 = 20, H2 = 14, b = new PixelBuffer(W2, H2), g = new PixelBuffer(W2, H2);
  const gc = packHex(col), stem = hex('#b8b8c8');
  for (let i = 0; i < rng.int(2, 4); i++) {
    const x = 4 + i * 4 + rng.range(-1, 1), hgt = rng.range(4, 10), cr = rng.range(2, 3.6);
    for (let y = H2 - 1; y > H2 - hgt; y--) b.set(x, y, stem);
    const cy = H2 - hgt;
    b.ellipseFn(x, cy, cr, cr * 0.6, (_x, _y, _nx, ny) => (ny > 0.3 ? -1 : ny < -0.3 ? hex('#5a5080') : hex('#3c3458')));
    for (let k = -cr + 1; k < cr - 1; k++) g.set(x + k, cy + 1, gc);
    g.set(x, cy - 1, mix(gc, hex('#ffffff'), 0.4));
  }
  b.outline(hex('#0c0a14'));
  return { buf: b, glow: g, ax: W2 / 2, ay: H2 - 1 };
}
void boulder; void ledge; void fbm2;
