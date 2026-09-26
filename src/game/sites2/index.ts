// V2 expedition sites: Fernwood Floor, Emerald Canopy, Thunder Falls, Blackwater Mangroves and the
// Serpent Coast (with a dive into the deep). Dense layered jungle, real photo occluders, water,
// cliffs, nests and trunks for the wildlife, resource nodes, animal signs to find and hide spots.

import { game } from '../game';
import type { FieldScene, FieldSite, SpawnV2 } from '../scenes/field';
import type { SiteId } from '../species';
import { CLUE_BY_ID } from '../species';
import { addClue } from '../research';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { Prop, Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { A } from '../assets';
import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, shade } from '../../art/color';
import { PAL } from '../../art/palettes';
import * as SA from '../../art/sitesart';
import * as FL from '../../art/flora';
import { Rng, bayer, clamp, fbm2, rand } from '../../core/math';
import { audio } from '../../core/audio';
import { plant, deadwood } from '../../art/jungle-plants';
import {
  sprite, mainLayer, skyAndRidge, jungleWalls, ceiling, trees, undergrowth, frontFoliage, hideBush, shafts, groundStrip, node, Ground,
} from './common';

// ------------------------------------------------------------------ shared helpers
type Interact = { x: number; y: number; w: number; h: number; label: string; standX?: number; enabled?: () => boolean; action: () => void };
const pushI = (f: FieldScene, it: Interact) => (f.interact as unknown as Interact[]).push(it);

/** A flat water body (reflective surface) that animals and the player can wade / swim in. */
function water(f: FieldScene, x0: number, x1: number, top: number, bottom: number, col: [number, number, number], strength = 0.8, z = -2) {
  f.st.terrain.water.push([x0, x1, top, bottom]);
  f.main.add(new Custom(z, (rr, s) => {
    rr.water(strength, 1.2, 0.8);
    rr.rect(x0, top, x1 - x0, bottom - top, packColor(col[0], col[1], col[2], 1));
    rr.water(0);
    // surface glints
    for (let i = 0; i < (x1 - x0) / 40; i++) {
      const gx = x0 + ((i * 53.7) % (x1 - x0)), a = Math.max(0, Math.sin(s.time * 1.7 + i * 2.1));
      rr.fxDraw(A.dot2, gx, top + 1, 1.4, 0.4, 0, packColor(1, 1, 0.95, 1), a * 0.6);
    }
  }));
  f.pois.push({ kind: 'water', x: (x0 + x1) / 2, y: top, y1: bottom, w: (x1 - x0) / 2 });
}

/** Art for animal signs that aren't resource nodes. */
function clueArt(icon: string): { buf: PixelBuffer; ax: number; ay: number } {
  const rng = new Rng(icon.length * 31);
  let b: PixelBuffer;
  switch (icon) {
    case 'bigskin': {
      // a colossal shed skin draped over the rocks like a tarp
      b = new PixelBuffer(150, 30);
      for (let x = 0; x < 150; x++) {
        const top = 12 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.23) * 2;
        const th = 6 + Math.sin(x * 0.05) * 3;
        for (let y = Math.floor(top); y < top + th && y < 30; y++) {
          const sc = ((x >> 2) + (y >> 1)) % 3 === 0;
          b.set(x, y, sc ? hex('#c8c0a0') : bayer(x, y) < 0.3 ? hex('#f0ead0') : hex('#e0d8b8'));
        }
      }
      b.outline(hex('#3a3428'));
      return { buf: b, ax: 75, ay: 29 };
    }
    case 'nest': {
      b = new PixelBuffer(22, 12);
      b.ellipseFn(11, 7, 10, 5, (x, y) => (fbm2(x * 0.4, y * 0.4, 2, 3) > 0.5 ? PAL.moss[4] : PAL.moss[2]));
      b.ellipse(11, 5, 6, 2, PAL.moss[0]);
      b.ellipse(9, 5, 1.5, 1, hex('#e8e0d0')); b.ellipse(13, 5, 1.5, 1, hex('#d8d0c0'));
      b.outline(hex('#141a10'));
      return { buf: b, ax: 11, ay: 11 };
    }
    case 'tracks': {
      b = new PixelBuffer(60, 6);
      for (let i = 0; i < 5; i++) {
        const x = 4 + i * 12, y = 2 + (i % 2);
        for (const [dx, dy] of [[0, 0], [-2, -1], [2, -1], [0, 1]]) b.set(x + dx, y + dy, hex('#2a1c10'));
      }
      return { buf: b, ax: 30, ay: 5 };
    }
    case 'bones': {
      b = new PixelBuffer(24, 8);
      for (let i = 0; i < 9; i++) { const x = 2 + i * 2.2, y = 4 + rng.range(-1, 1); b.set(x, y, hex('#e8e0c8')); b.set(x + 1, y, hex('#c8c0a8')); b.set(x, y - 1, hex('#f4ecd8')); }
      b.ellipse(19, 4, 2.5, 1.6, hex('#e8e0c8'));
      b.outline(hex('#2a2418'));
      return { buf: b, ax: 12, ay: 7 };
    }
    case 'egg': {
      // frog spawn on a hanging leaf
      b = new PixelBuffer(18, 12);
      b.ellipse(9, 7, 8, 3, PAL.fern[4]);
      for (let i = 0; i < 9; i++) { const x = 4 + (i % 5) * 2.2, y = 5 + Math.floor(i / 5) * 2; b.set(x, y, hex('#dff0e8')); b.set(x + 1, y, hex('#304018')); }
      b.outline(hex('#102010'));
      return { buf: b, ax: 9, ay: 11 };
    }
    case 'burrow': {
      b = new PixelBuffer(30, 10);
      b.ellipseFn(15, 8, 14, 5, (x, y) => (bayer(x, y) < 0.3 ? PAL.soil[5] : PAL.soil[4]));
      b.ellipse(15, 8, 5, 2.5, PAL.soil[0]);
      b.outline(hex('#140c08'));
      return { buf: b, ax: 15, ay: 9 };
    }
    case 'shells': {
      b = new PixelBuffer(20, 6);
      for (let i = 0; i < 6; i++) { const x = 2 + i * 3, y = 3 + (i % 2); b.ellipse(x, y, 1.3, 1, i % 2 ? hex('#8a6a3a') : hex('#c8a060')); }
      b.outline(hex('#2a1c10'));
      return { buf: b, ax: 10, ay: 5 };
    }
    case 'skin': {
      b = new PixelBuffer(40, 20);
      for (let i = 0; i < 36; i++) { const x = 2 + i, y = 10 + Math.sin(i * 0.4) * 6; const c = [hex('#e8a0e0'), hex('#a0e0f0'), hex('#f0e0a0')][i % 3]; b.set(x, y, c); b.set(x, y + 1, shade(c, -0.2)); }
      return { buf: b, ax: 20, ay: 19 };
    }
    case 'feather': {
      b = new PixelBuffer(40, 12);
      for (let i = 0; i < 34; i++) { b.set(3 + i, 8 - i * 0.12, hex('#1a1614')); for (let k = 1; k < 4 - i / 14; k++) { b.set(3 + i, 8 - i * 0.12 - k, hex('#3a302c')); b.set(3 + i, 8 - i * 0.12 + k * 0.6, hex('#2a2220')); } }
      b.outline(hex('#0a0806'));
      return { buf: b, ax: 20, ay: 11 };
    }
    default: {
      b = new PixelBuffer(10, 10);
      b.ellipse(5, 7, 4, 2, PAL.stone[4]);
      return { buf: b, ax: 5, ay: 9 };
    }
  }
}

/** An inspectable animal sign that adds a Field Guide clue. */
function clueSpot(f: FieldScene, id: string, x: number, y: number, label: string, line?: string, o: { art?: boolean; z?: number; enabled?: () => boolean } = {}) {
  const def = CLUE_BY_ID[id];
  if (!def) return;
  if (o.art !== false) {
    const c = sprite(`clue:${def.icon}`, () => ({ ...clueArt(def.icon) }));
    if (c) f.main.add(new Prop(c.f, x, y + 1, o.z ?? 2));
  }
  // a soft glint while unfound (trained-eye perk shows it brighter)
  f.main.add(new Custom(60, (rr, s) => {
    if (game.save.clues[id]) return;
    const a = 0.35 + 0.35 * Math.sin(s.time * 3 + x);
    rr.fxDraw(A.spark, x + Math.sin(s.time) * 3, y - 6, 0.6, 0.6, s.time, packColor(1, 1, 0.8, 1), a);
  }));
  pushI(f, {
    x, y, w: 16, h: 16, label, standX: x - 14,
    enabled: () => !game.save.clues[id] && (o.enabled?.() ?? true),
    action: async () => {
      f.player.facing = x >= f.player.x ? 1 : -1;
      const ok = await f.player.doWork('kneel', 1.4, () => {});
      if (!ok) return;
      if (addClue(id)) {
        audio.play('discover');
        game.ui.toast(`Field Guide clue: <b>${def.name}</b>`, 'CLUE', 'teal', 4200);
        f.player.body.showEmote('idea', 1.4);
        if (line) f.bark('rowan', line, { expr: 'surprised' });
        game.persist();
        f.hud?.refresh();
      }
    },
  });
}

/** The first time you arrive somewhere: a title card and Aroha's whispered intro. */
async function arrive(f: FieldScene, name: string, sub: string, aroha: string) {
  const key = 'arrived:' + f.site.id;
  if (!game.save.flags[key]) {
    game.save.flags[key] = true;
    await game.ui.titleCard('Expedition', name, sub, 2600);
  }
  if (f.guide) setTimeout(() => f.bark('aroha', aroha, { expr: 'neutral' }), 1200);
}

const g0 = (fn: (x: number) => number): Ground => ({ y: fn });

/** Put a trunk POI (for climbers/gliders) with branches and a perch at its crown. */
function trunkPOI(f: FieldScene, x: number, gy: number, h: number, branches = 1) {
  f.pois.push({ kind: 'trunk', x, y: gy, y1: gy - h });
  for (let i = 0; i < branches; i++) f.pois.push({ kind: 'branch', x: x + (i % 2 ? -18 : 18), y: gy - h * (0.55 + i * 0.2) });
  f.pois.push({ kind: 'perch', x, y: gy - h - 6 });
}

// ================================================================== FERNWOOD FLOOR
const FW_W = 2600, FW_G = 288;
const fwGround = (x: number) => {
  let y = FW_G + Math.sin(x * 0.008) * 5 + Math.sin(x * 0.031) * 1.5;
  if (x > 1480 && x < 1660) y += Math.sin(((x - 1480) / 180) * Math.PI) * 14; // stream gully
  return y;
};

const FERNWOOD: FieldSite = {
  id: 'fernwood', name: 'Fernwood Floor', width: FW_W, camY: 190, spawnX: 90, exitX: 30, waterY: FW_G + 10,
  ambience: 'forest', music: 'explore', ground: 'leaves',
  build(f) {
    const st = f.st, G = g0(fwGround);
    const rng = new Rng(101);
    ceiling(f, 0.3, -30, 3);
    jungleWalls(f, FW_G, [
      { p: 0.18, fog: 0.5, depth: 0, seed: 11 }, { p: 0.32, fog: 0.35, depth: 1, seed: 12 },
      { p: 0.5, fog: 0.2, depth: 2, seed: 13 }, { p: 0.68, fog: 0.1, depth: 3, seed: 14 },
    ]);
    const mid = st.addLayer('mid', 0.84, 0.06, 0.55, 0);
    trees(f, mid, 0, FW_W / 0.84 + 200, [70, 130], ['kauri', 'rata', 'treefern', 'nikau', 'fig'], G, 21, { variants: 3 });
    const main = mainLayer(f);
    // big trunks on the gameplay plane (climbers use them)
    for (const x of [340, 820, 1260, 1840, 2280]) {
      const kind = x % 3 ? 'kauri' : 'rata';
      trees(f, main, x, x + 1, [10, 10], [kind], G, x, { variants: 1, z: -6, p: 1 });
      trunkPOI(f, x, fwGround(x), 190, 2);
    }
    groundStrip(f, FW_W, G, [PAL.moss[5], PAL.moss[4], PAL.soil[5], PAL.soil[4]], PAL.soil[1], 7);
    // the stream in the gully
    water(f, 1490, 1650, FW_G + 10, FW_G + 24, [0.12, 0.26, 0.26], 0.8);
    f.pois.push({ kind: 'mud', x: 1470, y: fwGround(1470) }, { kind: 'bank', x: 1680, y: fwGround(1680) });
    undergrowth(f, main, 0, FW_W, 1.25, G, 31, {
      plants: ['fern', 'crownfern', 'kiokio', 'umbrellafern', 'kidneyfern', 'taro', 'moss', 'seedling', 'fiddlehead', 'astelia', 'flowers', 'lily'],
      fungi: ['glowcap', 'bracket', 'inkcap', 'bluecap', 'veil', 'lantern', 'coral', 'puffball'], wood: ['log', 'rottenlog', 'stump', 'roots', 'branch', 'litter'],
    });
    for (const x of [520, 1120, 1760, 2160]) f.pois.push({ kind: 'cover', ...hideBush(f, x, G, x), w: 18 } as never);
    shafts(f, main, [{ x: 260, w: 44, a: 0.18 }, { x: 980, w: 60, a: 0.22 }, { x: 1560, w: 50, a: 0.15 }, { x: 2100, w: 56, a: 0.2 }], [1, 0.92, 0.7], -40, 360, 0.9);
    // POIs
    for (const x of [600, 640, 690, 2380]) f.pois.push({ kind: 'burrow', x, y: fwGround(x) });
    for (const x of [450, 1180, 1980]) f.pois.push({ kind: 'soft', x, y: fwGround(x) });
    for (const x of [760, 1400, 2200]) f.pois.push({ kind: 'leaves', x, y: fwGround(x), amount: 30 });
    for (const x of [900, 2050]) f.pois.push({ kind: 'fruit', x, y: fwGround(x), amount: 20 });
    for (const x of [300, 1320, 1900]) f.pois.push({ kind: 'flower', x, y: fwGround(x) - 40 });
    f.pois.push({ kind: 'den', x: 2450, y: fwGround(2450) });
    // resources
    const N: [string, string, number][] = [
      ['flax1', 'flax', 180], ['fern1', 'treefern', 260], ['kawa1', 'kawakawa', 410], ['moon1', 'moonfruit', 900], ['moss1', 'mossrock', 1000],
      ['glow1', 'glowcap', 1080], ['brack1', 'bracket', 1300], ['ink1', 'inkcap', 1360], ['grub1', 'grublog', 580], ['grub2', 'grublog', 2120],
      ['beetle1', 'lanternbeetle', 1210], ['weta1', 'weta', 1720], ['moth1', 'skymoth', 1880], ['mantis1', 'mantis', 760], ['drag1', 'dragonfly', 1600],
      ['thorn1', 'thornfur', 1940], ['plate1', 'plate', 1450], ['quill1', 'quill', 2240], ['drop1', 'dropping', 2330], ['feath1', 'feather', 480],
      ['pitch1', 'pitcher', 1540], ['rata1', 'rata', 1790], ['snare1', 'snare', 700], ['snare2', 'snare', 1400], ['snare3', 'snare', 2300],
    ];
    for (const [k, kind, x] of N) node(f, k, kind, x);
    // animal signs
    clueSpot(f, 'grub-shells', 620, fwGround(620), 'Look at the dug-up soil', 'Chewed grub casings. Something with claws has been feasting here.');
    clueSpot(f, 'burrow', 660, fwGround(660), 'Examine the mound', 'A burrow… no, a whole network of them.');
    clueSpot(f, 'boneface-track', 1420, fwGround(1420), 'Examine the tracks', 'Three toes, and deep. Whatever made these is heavy.');
    frontFoliage(f, 0, FW_W, [150, 260], ['leaves', 'fronds', 'monstera', 'flax', 'grass'], 1.35, FW_G + 80, 41);
    frontFoliage(f, 0, FW_W, [300, 520], ['vines', 'branch'], 1.35, -40, 42, { hang: true });
    void rng;
  },
  spawns: [
    { species: 'boneface', n: [3, 6], x: [700, 1500], herd: true, juveniles: 0.35, times: ['dawn', 'day', 'dusk'], chance: 0.85 },
    { species: 'shieldback', n: [1, 2], x: [400, 2200], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'delver', n: [4, 6], x: [580, 720], herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'quillhog', n: [1, 2], x: [1800, 2500], times: ['dusk', 'night'], chance: 0.9 },
    { species: 'flicker', n: [1, 1], x: [1200, 2400], times: ['dawn', 'day', 'dusk'], chance: 0.6, later: true },
    { species: 'strider', n: [1, 2], x: [300, 2300], times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'sprinter', n: [1, 1], x: [900, 2300], times: ['dusk', 'night'], chance: 0.7 },
    { species: 'hunterbat', n: [1, 2], x: [300, 2300], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
    { species: 'mossfrog', n: [3, 5], x: [1440, 1720], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'barkgecko', n: [1, 3], x: [300, 2300], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'nutcracker', n: [3, 6], x: [850, 1100], herd: true, times: ['dawn', 'day'], chance: 0.7 },
  ],
  insects: [
    { kind: 'butterfly', x: [200, 2400], y: [200, 270], n: 6, times: ['day', 'dawn'] },
    { kind: 'dragonfly', x: [1480, 1680], y: [250, 290], n: 4, times: ['day', 'dusk'] },
    { kind: 'bee', x: [200, 2400], y: [220, 270], n: 5, times: ['day'] },
    { kind: 'skymoth', x: [200, 2400], y: [150, 260], n: 5, times: ['dusk', 'night'] },
    { kind: 'firefly', x: [0, FW_W], y: [180, 285], n: 26, times: ['dusk', 'night'] },
    { kind: 'lanternbeetle', x: [600, 2200], y: [240, 285], n: 6, times: ['night'] },
    { kind: 'ant', x: [300, 2300], y: [286, 288], n: 8 },
    { kind: 'cicada', x: [300, 2300], y: [150, 220], n: 3, times: ['day'] },
  ],
  onEnter: f => arrive(f, 'Fernwood Floor', 'Te Ngāhere', 'Kia tūpato: careful. Watch where the ferns are moving.'),
};

// ================================================================== EMERALD CANOPY
const CN_W = 2400, CN_G = 250;
// the walkway is a chain of colossal branches: gentle rises and dips
const cnGround = (x: number) => CN_G + Math.sin(x * 0.006) * 18 + Math.sin(x * 0.023) * 4 + Math.max(0, Math.sin(x * 0.0021 + 1)) * 10;

const CANOPY: FieldSite = {
  id: 'canopy', name: 'Emerald Canopy', width: CN_W, camY: 180, spawnX: 80, exitX: 30, waterY: null,
  ambience: 'canopy', music: 'wonder', ground: 'wood',
  build(f) {
    const st = f.st, G = g0(cnGround);
    const r = game.r;
    skyAndRidge(f, { seed: 21, base: 230 });
    jungleWalls(f, 330, [
      { p: 0.15, fog: 0.55, depth: 0, seed: 31, lift: -60 }, { p: 0.3, fog: 0.4, depth: 1, seed: 32, lift: 20 },
      { p: 0.46, fog: 0.3, depth: 1, seed: 33, lift: 60 },
    ]);
    // mist rising out of the void below
    const mist = st.addLayer('mist', 0.6, 0.1, 0.2, 0);
    const span = layerSpan(st, 0.6);
    const m = new PixelBuffer(Math.min(2048, span.w), 90);
    for (let y = 0; y < 90; y++) for (let x = 0; x < m.w; x++) if (fbm2(x * 0.01, y * 0.04, 3, 5) + y / 150 > 0.75 && bayer(x, y) < 0.8) m.set(x, y, hex('#c8dcd8', Math.round(clamp(y / 90) * 200 + 40)));
    for (let x = 0; x < span.w; x += m.w) mist.add(new Prop({ ...bigFrame(r, m), ax: 0, ay: 0 }, span.x0 + x, 300));
    const mid = st.addLayer('mid', 0.8, 0.08, 0.5, 0);
    trees(f, mid, 0, CN_W / 0.8 + 200, [140, 240], ['kauri', 'fig', 'rata'], g0(() => 520), 44, { variants: 3 });
    const main = mainLayer(f);
    // giant trunks rising through the walkway
    for (const x of [300, 760, 1180, 1620, 2060]) {
      trees(f, main, x, x + 1, [10, 10], ['kauri'], g0(() => cnGround(x) + 240), x, { variants: 1, z: -6, p: 1 });
      trunkPOI(f, x, cnGround(x), 200, 3);
    }
    // the branch walkway: bark on top, moss and epiphytes, dark underside, then the drop
    groundStrip(f, CN_W, G, [PAL.moss[5], PAL.moss[4], PAL.bark[5], PAL.bark[4]], PAL.bark[1], 9, 70);
    undergrowth(f, main, 0, CN_W, 0.8, G, 51, { plants: ['moss', 'astelia', 'kidneyfern', 'flowers', 'lanternpod', 'seedling', 'fern'], fungi: ['bracket', 'lantern', 'veil'], wood: ['branch', 'litter'] });
    // hanging moss curtains + canopy clumps overhead
    ceiling(f, 0.95, -60, 7);
    for (const x of [600, 1400, 1960]) f.pois.push({ kind: 'cover', ...hideBush(f, x, G, x), w: 18 } as never);
    shafts(f, main, [{ x: 420, w: 70, a: 0.1 }, { x: 1000, w: 60, a: 0.14 }, { x: 1500, w: 80, a: 0.1 }, { x: 2200, w: 60, a: 0.16 }], [1, 0.96, 0.78], -60, 380, 1.1);
    for (const x of [520, 980, 1760]) f.pois.push({ kind: 'fruit', x, y: cnGround(x), amount: 25 });
    for (const x of [340, 800, 1220, 1660, 2100]) f.pois.push({ kind: 'flower', x: x + 30, y: cnGround(x) - 80 });
    const N: [string, string, number][] = [
      ['moon1', 'moonfruit', 520], ['moon2', 'moonfruit', 1760], ['pitch1', 'pitcher', 640], ['moth1', 'skymoth', 880], ['moth2', 'skymoth', 1900],
      ['brack1', 'bracket', 1080], ['mantis1', 'mantis', 1300], ['rata1', 'rata', 1450], ['drop1', 'dropping', 1560], ['feath1', 'feather', 2000],
      ['beetle1', 'lanternbeetle', 1150], ['kawa1', 'kawakawa', 2250], ['moss1', 'mossrock', 400],
    ];
    for (const [k, kind, x] of N) node(f, k, kind, x);
    clueSpot(f, 'gecko-shed', 770, cnGround(770), 'Examine the bark', 'A shed skin, gecko-shaped. Toe pads and all.');
    clueSpot(f, 'shed-ribbon', 1640, cnGround(1640), 'Look at the snagged skin', 'Rainbow scales… a snake shed this up HERE?');
    clueSpot(f, 'cracked-seeds', 990, cnGround(990), 'Look at the seeds', 'Split clean in half. I couldn’t do that with a hammer.');
    frontFoliage(f, 0, CN_W, [180, 300], ['leaves', 'monstera', 'fronds'], 1.35, CN_G + 110, 61);
    frontFoliage(f, 0, CN_W, [260, 420], ['vines', 'branch', 'palm'], 1.35, -60, 62, { hang: true });
  },
  spawns: [
    { species: 'skyribbon', n: [2, 3], x: [250, 2150], poi: 'branch', medium: 'trunk', times: ['dawn', 'day'], chance: 1 },
    { species: 'lurevip', n: [1, 2], x: [250, 2150], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.9 },
    { species: 'galehawk', n: [1, 1], x: [300, 2200], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'sailglider', n: [2, 4], x: [250, 2150], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'flicker', n: [1, 2], x: [400, 2200], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'barkgecko', n: [2, 3], x: [250, 2150], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'nutcracker', n: [4, 7], x: [900, 1100], herd: true, times: ['dawn', 'day'], chance: 0.9 },
  ],
  insects: [
    { kind: 'butterfly', x: [200, 2200], y: [120, 230], n: 8, times: ['day', 'dawn'] },
    { kind: 'bee', x: [200, 2200], y: [150, 230], n: 6, times: ['day'] },
    { kind: 'skymoth', x: [200, 2200], y: [100, 230], n: 8, times: ['dusk', 'night'] },
    { kind: 'firefly', x: [0, CN_W], y: [120, 250], n: 22, times: ['dusk', 'night'] },
    { kind: 'cicada', x: [200, 2200], y: [100, 200], n: 4, times: ['day'] },
  ],
  onEnter: f => arrive(f, 'Emerald Canopy', 'Te Tāhuhu o te Ngāhere', 'Don’t look down, Doc. And watch the branches: the snakes fly here.'),
};

// ================================================================== THUNDER FALLS
const FA_W = 2100, FA_G = 286, POOL0 = 880, POOL1 = 1460, FALL0 = 1130, FALL1 = 1230, POOL_Y = 300;
const faGround = (x: number) => {
  if (x < POOL0 - 20) return FA_G + Math.sin(x * 0.01) * 3 + Math.sin(x * 0.037) * 1.2;
  if (x > POOL1 + 10) return FA_G - 6;
  return POOL_Y + 26; // pool bed
};
const FALLS: FieldSite = {
  id: 'falls', name: 'Thunder Falls', width: FA_W, camY: 180, spawnX: 80, exitX: 30, waterY: POOL_Y,
  ambience: 'falls', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G = g0(faGround);
    const rng = new Rng(303);
    skyAndRidge(f, { seed: 12, base: 220 });
    jungleWalls(f, FA_G, [{ p: 0.22, fog: 0.4, depth: 1, seed: 71 }, { p: 0.42, fog: 0.25, depth: 2, seed: 72 }]);
    const mid = st.addLayer('mid', 0.75, 0.08, 0.5, 0);
    trees(f, mid, 0, 900 / 0.75, [60, 110], ['treefern', 'nikau', 'rata'], G, 81, { variants: 3 });
    const main = mainLayer(f);
    // cliff massif with nesting ledges and the waterfall notch
    const cliffX = 1020, cliffW = FA_W - cliffX, cliffH = 340, cliffTop = -40;
    const ledges = [90, 140, 190];
    const cliff = SA.paintCliff(9, cliffW, cliffH, PAL.stoneWarm, ledges, true);
    for (let y = 0; y < cliffH; y++) for (let x = FALL0 - cliffX - 6; x < FALL1 - cliffX + 6; x++) if (cliff.opaque(x, y)) cliff.set(x, y, y > cliffH - 60 ? hex('#141010') : mix(hex('#2d2620'), hex('#1a1612'), y / cliffH));
    main.add(new Prop({ ...bigFrame(r, cliff), ax: 0, ay: 0 }, cliffX, cliffTop, -8));
    for (const ly of ledges) {
      const y = cliffTop + ly;
      for (const x of [1300, 1520, 1720, 1900]) if (x > FALL1 + 20 || x < FALL0 - 20) { f.pois.push({ kind: 'nest', x: x + (ly % 3) * 20, y }); }
      f.st.terrain.addPlatform([[1260, y], [FA_W, y]], 'rock' as never);
    }
    f.pois.push({ kind: 'perch', x: 1400, y: cliffTop + 10 }, { kind: 'perch', x: 1800, y: cliffTop + 14 });
    // the falls: 4 scrolling frames of the curtain, plus spray
    const tex = SA.paintFallsTex(FALL1 - FALL0, 96, 5);
    const H = POOL_Y - (cliffTop + 20);
    const frames = [0, 1, 2, 3].map(k => {
      const b = new PixelBuffer(tex.w, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < tex.w; x++) b.data[y * tex.w + x] = tex.data[(((y - k * 24) % 96 + 96) % 96) * tex.w + x];
      return bigFrame(r, b);
    });
    main.add(new Custom(30, (rr, s) => {
      const fr = frames[Math.floor(s.time * 14) % 4];
      rr.draw({ ...fr, ax: 0, ay: 0 }, FALL0, cliffTop + 20, 1, 1, 0, packColor(1, 1, 1, 0.9));
      for (let i = 0; i < 6; i++) rr.fxDraw(A.soft, FALL0 + 10 + i * 16, POOL_Y - 4 + Math.sin(s.time * 3 + i) * 2, 2.2, 1, 0, packColor(0.9, 0.97, 1, 1), 0.55);
      rr.light(FALL0 + 50, POOL_Y - 20, 140, 0.8, 0.95, 1, 0.5);
    }, dt => {
      if (rand.chance(dt * 30)) main.particles.spawn({ frame: A.dot2, x: rand.range(FALL0, FALL1), y: POOL_Y - 2, vx: rand.range(-50, 50), vy: rand.range(-70, -20), ay: 120, life: rand.range(0.6, 1.2), color: [0.9, 0.97, 1], alpha: 0.8, alpha1: 0 });
    }));
    // ground: shore, pool, ledge
    groundStrip(f, FA_W, G, [PAL.moss[5], PAL.moss[4], PAL.stoneWarm[5], PAL.stoneWarm[4]], PAL.stoneWarm[1], 10, 120);
    water(f, POOL0 - 20, POOL1 + 10, POOL_Y, POOL_Y + 30, [0.1, 0.26, 0.3], 0.85, 25);
    // stepping stones and the hidden ledge behind the curtain
    const stones: [number, number][] = [[930, POOL_Y + 2], [990, POOL_Y], [1050, POOL_Y + 2], [1105, POOL_Y - 2], [1180, POOL_Y - 4], [1255, POOL_Y - 2], [1320, POOL_Y], [1390, POOL_Y + 2]];
    for (const [x, y] of stones) {
      const o = FL.paintRock(rng.int(1, 999), 26, 13, PAL.stone, 0.5);
      const c = sprite(`fstone:${x}`, () => o);
      if (c) main.add(new Prop(c.f, x, y + 6, 26));
      f.st.terrain.addPlatform([[x - 11, y - 4], [x + 11, y - 4]], 'rock' as never);
      f.pois.push({ kind: 'rock', x, y: y - 4 });
    }
    undergrowth(f, main, 0, POOL0 - 40, 1.1, G, 91, { plants: ['fern', 'kidneyfern', 'moss', 'sedge', 'flax', 'astelia', 'umbrellafern'], fungi: ['bracket', 'glowcap'], wood: ['rock', 'rottenlog', 'roots'] });
    undergrowth(f, main, POOL1 + 20, FA_W, 0.7, G, 92, { plants: ['moss', 'sedge', 'grass', 'astelia'], wood: ['rock', 'rock', 'litter'] });
    for (const x of [300, 700]) f.pois.push({ kind: 'cover', ...hideBush(f, x, G, x), w: 18 } as never);
    for (const x of [200, 560, 840]) trunkPOI(f, x, faGround(x), 150, 1);
    trees(f, main, 200, 900, [320, 360], ['rata', 'treefern'], G, 95, { variants: 2, z: -6, p: 1 });
    for (const x of [420, 460]) f.pois.push({ kind: 'burrow', x, y: faGround(x) });
    f.pois.push({ kind: 'soft', x: 620, y: faGround(620) }, { kind: 'sun', x: 780, y: faGround(780) }, { kind: 'fruit', x: 520, y: faGround(520), amount: 15 });
    // carrion on the right ledge for the Monarch
    f.pois.push({ kind: 'carrion', x: 1820, y: faGround(1820), amount: 40 });
    const carc = sprite('carcass', () => {
      const b = new PixelBuffer(40, 14);
      b.ellipseFn(20, 9, 18, 5, (x, y) => (((x >> 1) + y) % 4 === 0 ? hex('#e8e0c8') : hex('#7a3a30')));
      for (let i = 0; i < 6; i++) b.rect(6 + i * 5, 3, 1, 5, hex('#e8e0c8'));
      b.outline(hex('#1a1010'));
      return { buf: b, ax: 20, ay: 13 };
    });
    if (carc) main.add(new Prop(carc.f, 1820, faGround(1820) + 1, 3));
    const N: [string, string, number][] = [
      ['fern1', 'treefern', 150], ['moss1', 'mossrock', 380], ['glow1', 'glowcap', 480], ['kawa1', 'kawakawa', 600], ['drag1', 'dragonfly', 860],
      ['egg1', 'eggshell', 1560], ['egg2', 'eggshell', 1700], ['feath1', 'feather', 1620], ['quill1', 'quill', 700], ['weta1', 'weta', 540],
      ['stones1', 'stones', 1500], ['drop1', 'dropping', 1960], ['flax1', 'flax', 250],
    ];
    for (const [k, kind, x] of N) node(f, k, kind, x);
    clueSpot(f, 'giant-skin', 640, faGround(640), 'Examine the… tarp?', 'That’s not a tarp. That’s a SKIN. It’s the size of a bus.');
    clueSpot(f, 'falls-nest', 1180, POOL_Y - 10, 'Look behind the curtain', 'A mossy nest, right behind the falling water. Clever.', { z: 29 });
    clueSpot(f, 'bat-roost', 560, faGround(560), 'Look at the litter under the branch', 'Wētā legs and frog bones. Something eats up there.');
    clueSpot(f, 'monarch-feather', 1880, faGround(1880), 'Pull out the feather', 'A feather longer than my arm. What on earth…');
    frontFoliage(f, 0, 900, [140, 240], ['fronds', 'flax', 'leaves', 'grass'], 1.35, FA_G + 80, 97);
    frontFoliage(f, 0, 900, [300, 500], ['vines', 'branch'], 1.35, -40, 98, { hang: true });
  },
  spawns: [
    { species: 'cragauk', n: [4, 7], x: [1280, 2000], poi: 'nest', herd: true, juveniles: 0.3, times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'torrentdipper', n: [1, 2], x: [920, 1400], poi: 'rock', times: ['dawn', 'day'], chance: 1 },
    { species: 'galehawk', n: [1, 1], x: [300, 2000], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'monarch', n: [1, 1], x: [900, 2000], medium: 'air', times: ['dawn', 'day'], chance: 0.8 },
    { species: 'cragviper', n: [1, 2], x: [1300, 2000], poi: 'nest', times: ['day', 'dusk'], chance: 0.8 },
    { species: 'strider', n: [1, 1], x: [200, 850], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'sprinter', n: [1, 1], x: [200, 850], times: ['dusk', 'night'], chance: 0.6 },
    { species: 'shieldback', n: [1, 1], x: [200, 850], times: ['dawn', 'day', 'dusk'], chance: 0.5 },
    { species: 'quillhog', n: [1, 1], x: [200, 850], times: ['dusk', 'night'], chance: 0.7 },
    { species: 'delver', n: [2, 4], x: [400, 480], herd: true, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'hunterbat', n: [1, 1], x: [200, 850], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
    { species: 'mossfrog', n: [2, 4], x: [780, 900], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'pteramander', n: [1, 2], x: [150, 900], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
  ],
  insects: [
    { kind: 'dragonfly', x: [850, 1450], y: [250, 295], n: 6, times: ['day', 'dawn', 'dusk'] },
    { kind: 'butterfly', x: [100, 850], y: [200, 270], n: 4, times: ['day'] },
    { kind: 'firefly', x: [0, 900], y: [180, 285], n: 14, times: ['dusk', 'night'] },
    { kind: 'skymoth', x: [100, 850], y: [150, 260], n: 4, times: ['night'] },
  ],
  onEnter: f => arrive(f, 'Thunder Falls', 'Te Wai Whatitiri', 'Hear it? The auks nest up the cliff. And… stay away from the big rocks by the pool.'),
};

// ================================================================== BLACKWATER MANGROVES
const MG_W = 2700, MG_WY = 300;
// mudbanks and shallows; a deep channel at 1300-1720 crossed by a fallen log
const BANKS: [number, number][] = [[0, 520], [700, 1180], [1860, 2300], [2460, MG_W]];
const mgGround = (x: number) => {
  for (const [a, b] of BANKS) if (x >= a && x <= b) return MG_WY - 8 + Math.sin(x * 0.02) * 2;
  if (x > 1300 && x < 1720) return MG_WY + 70;
  return MG_WY + 12; // wading shallows
};
const MANGROVE: FieldSite = {
  id: 'mangrove', name: 'Blackwater Mangroves', width: MG_W, camY: 186, spawnX: 80, exitX: 30, waterY: MG_WY,
  ambience: 'mangrove', music: 'tension', ground: 'sand',
  build(f) {
    const st = f.st, r = game.r, G = g0(mgGround);
    const rng = new Rng(505);
    skyAndRidge(f, { ridge: false, seed: 33 });
    jungleWalls(f, MG_WY, [{ p: 0.2, fog: 0.55, depth: 0, seed: 111 }, { p: 0.38, fog: 0.4, depth: 1, seed: 112 }]);
    // far mangrove stands
    const mid = st.addLayer('mid', 0.7, 0.18, 0.5, 0);
    for (let x = 0; x < MG_W * 0.7 + 200; x += rng.range(90, 150)) {
      const c = sprite(`mgf:${rng.int(0, 3)}`, () => FL.paintMangrove(rng.int(1, 999), 120, 150));
      if (c) mid.add(new Prop(c.f, x, MG_WY + 8, rng.next(), { sway: 0.2, tint: packColor(0.7, 0.75, 0.72, 1) }));
    }
    const main = mainLayer(f);
    // gameplay mangroves with climbable trunks
    for (const x of [260, 820, 1060, 1960, 2200, 2560]) {
      const c = sprite(`mg:${x % 4}`, () => FL.paintMangrove(x, 150, 190));
      if (c) main.add(new Prop(c.f, x, MG_WY + 6, -6, { sway: 0.15 }));
      trunkPOI(f, x, MG_WY - 10, 130, 2);
    }
    // mudbanks (walkable) with mud texture
    for (const [a, b] of BANKS) {
      const w = b - a, bank = SA.paintMudbank(w, 40, a);
      const c = sprite(`bank:${a}`, () => ({ buf: bank, ax: 0, ay: 0 }));
      if (c) main.add(new Prop(c.f, a, MG_WY - 10, -9));
      f.pois.push({ kind: 'bank', x: a + w / 2, y: MG_WY - 8, w: w / 2 }, { kind: 'mud', x: a + w * 0.3, y: MG_WY - 8 });
    }
    const pts: [number, number][] = [];
    for (let x = 0; x <= MG_W; x += 6) pts.push([x, mgGround(x)]);
    st.terrain.addGround(pts, 'ground');
    // the fallen log across the deep channel
    const log = FL.paintLog(7, 470, 7);
    const lc = sprite('mglog', () => log);
    if (lc) main.add(new Prop(lc.f, 1510, MG_WY - 2, 20));
    st.terrain.addPlatform([[1280, MG_WY - 8], [1740, MG_WY - 8]], 'branch' as never);
    water(f, 0, MG_W, MG_WY, MG_WY + 80, [0.07, 0.11, 0.09], 0.8, 24);
    for (const [a, b] of [[520, 700], [1180, 1300], [1720, 1860], [2300, 2460]]) f.pois.push({ kind: 'shallows', x: (a + b) / 2, y: MG_WY + 4, w: (b - a) / 2 });
    // reeds + roots
    for (let x = 0; x < MG_W; x += rng.range(20, 50)) {
      const c = sprite(`reed:${rng.int(0, 3)}`, () => { const o = SA.paintReeds(rng.int(1, 999), 30, 40); return o as never; });
      if (c) main.add(new Prop(c.f, x, MG_WY + 4, 27, { sway: 1.2 }));
    }
    undergrowth(f, main, 0, 520, 0.8, G, 121, { plants: ['sedge', 'taro', 'lily', 'grass', 'pitcher'], wood: ['roots', 'rottenlog'] });
    undergrowth(f, main, 700, 1180, 0.8, G, 122, { plants: ['sedge', 'taro', 'lily', 'pitcher'], wood: ['roots'] });
    undergrowth(f, main, 1860, MG_W, 0.8, G, 123, { plants: ['sedge', 'taro', 'lily', 'grass'], wood: ['roots', 'litter'] });
    for (const x of [400, 950, 2100]) f.pois.push({ kind: 'cover', ...hideBush(f, x, G, x), w: 18 } as never);
    const N: [string, string, number][] = [
      ['pitch1', 'pitcher', 180], ['drag1', 'dragonfly', 600], ['drag2', 'dragonfly', 1800], ['bone1', 'bone', 1100], ['plate1', 'plate', 2000],
      ['shells1', 'shells', 780], ['beetle1', 'lanternbeetle', 900], ['skin1', 'shedskin', 2380], ['moth1', 'skymoth', 2150], ['sea1', 'seaweed', 460],
    ];
    for (const [k, kind, x] of N) node(f, k, kind, x);
    clueSpot(f, 'croc-scute', 1960, mgGround(1960), 'Pick up the bony plate', 'Etched by stomach acid. Something swallowed a crocodile plate… and spat it out.');
    clueSpot(f, 'frog-spawn', 830, mgGround(830), 'Look at the hanging leaf', 'Frog spawn, hung over the water where the fish can’t reach.');
    frontFoliage(f, 0, MG_W, [180, 300], ['grass', 'flax', 'fronds'], 1.35, MG_WY + 90, 131, { tint: packColor(0.45, 0.5, 0.48, 1) });
    frontFoliage(f, 0, MG_W, [300, 500], ['vines', 'branch'], 1.35, -40, 132, { hang: true });
  },
  spawns: [
    { species: 'titan', n: [1, 1], x: [1320, 1700], medium: 'water', times: ['dawn', 'day', 'dusk', 'night'], chance: 1 },
    { species: 'ironjaw', n: [1, 2], x: [700, 2300], poi: 'bank', times: ['dawn', 'day', 'dusk', 'night'], chance: 0.9 },
    { species: 'mudribbon', n: [2, 3], x: [500, 2400], medium: 'water', times: ['day', 'dusk', 'night'], chance: 1 },
    { species: 'snakestork', n: [1, 2], x: [520, 2460], poi: 'shallows', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'mossfrog', n: [3, 5], x: [700, 1180], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'pteramander', n: [2, 3], x: [200, 2600], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night'], chance: 1 },
  ],
  insects: [
    { kind: 'dragonfly', x: [0, MG_W], y: [250, 298], n: 10, times: ['day', 'dawn', 'dusk'] },
    { kind: 'firefly', x: [0, MG_W], y: [180, 295], n: 30, times: ['dusk', 'night'] },
    { kind: 'skymoth', x: [0, MG_W], y: [150, 280], n: 5, times: ['night'] },
  ],
  onEnter: f => arrive(f, 'Blackwater Mangroves', 'Te Wai Pango', 'Stay on the mud, Doc. Never, ever stand still in the water.'),
};

// ================================================================== SERPENT COAST (+ the deep)
const CO_W = 2400, CO_G = 282, SEA_X = 1700, SEA_Y = 300;
const coGround = (x: number) => {
  if (x < SEA_X) return CO_G + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.05) * 2 + (x > SEA_X - 200 ? (x - (SEA_X - 200)) * 0.08 : 0);
  return SEA_Y + 40 + (x - SEA_X) * 0.15;
};
const COAST: FieldSite = {
  id: 'coast', name: 'Serpent Coast', width: CO_W, camY: 182, spawnX: 80, exitX: 30, waterY: SEA_Y,
  ambience: 'coast', music: 'wonder', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G = g0(coGround);
    const rng = new Rng(707);
    skyAndRidge(f, { seed: 44, base: 230 });
    // the open sea to the horizon
    const seaL = st.addLayer('sea', 0.12, 0.3, 0.1, 0);
    const span = layerSpan(st, 0.12);
    const sea = new PixelBuffer(span.w, 120);
    for (let y = 0; y < 120; y++) for (let x = 0; x < span.w; x++) sea.data[y * span.w + x] = mix(hex('#6aa8c0'), hex('#1a4a66'), clamp(y / 90)) + 0 * bayer(x, y);
    seaL.add(new Prop({ ...bigFrame(r, sea), ax: 0, ay: 0 }, span.x0, 230));
    const main = mainLayer(f);
    // sea cliffs on the left
    const cliff = SA.paintCliff(19, 420, 300, PAL.stone, [80, 150], false);
    main.add(new Prop({ ...bigFrame(r, cliff), ax: 0, ay: 0 }, -120, CO_G - 300, -9));
    f.pois.push({ kind: 'perch', x: 200, y: CO_G - 220 }, { kind: 'perch', x: 120, y: CO_G - 150 });
    groundStrip(f, SEA_X + 300, G, [PAL.sand[5], PAL.sand[4], PAL.stone[5], PAL.stone[4]], PAL.stone[1], 13, 120);
    water(f, SEA_X - 180, CO_W, SEA_Y, SEA_Y + 90, [0.08, 0.2, 0.28], 0.9, 24);
    // breaking waves
    main.add(new Custom(26, (rr, s) => {
      for (let i = 0; i < 8; i++) {
        const k = (s.time * 0.25 + i / 8) % 1;
        const x = SEA_X + 600 - k * 780;
        rr.fxDraw(A.soft, x, SEA_Y - 1, 3, 0.5, 0, packColor(1, 1, 1, 1), Math.sin(k * Math.PI) * 0.6);
      }
    }));
    // tide pools and rocks
    for (let i = 0; i < 9; i++) {
      const x = 300 + i * 150 + rng.range(-30, 30);
      const c = sprite(`crock:${i % 4}`, () => deadwood('rock', 60 + i, rng.range(26, 48)));
      if (c) main.add(new Prop(c.f, x, coGround(x) + 3, -1));
      f.pois.push({ kind: 'rock', x, y: coGround(x) - 10 });
    }
    for (let x = 60; x < SEA_X - 100; x += rng.range(30, 70)) {
      const c = sprite(`cg:${rng.int(0, 3)}`, () => (rng.chance(0.5) ? plant('grass', rng.int(1, 999), 18) : plant('flax', rng.int(1, 999), 30)));
      if (c) main.add(new Prop(c.f, x, coGround(x) + 2, 1, { sway: 1.6 }));
    }
    f.pois.push({ kind: 'carrion', x: 1300, y: coGround(1300), amount: 50 });
    const carc = sprite('whalebone', () => {
      const b = new PixelBuffer(90, 30);
      for (let i = 0; i < 8; i++) for (let y = 0; y < 22 - Math.abs(i - 4) * 2; y++) b.set(10 + i * 9 + Math.sin(y * 0.2) * 2, 28 - y, hex('#e8e0c8'));
      b.rect(4, 26, 84, 3, hex('#d8d0b8'));
      b.outline(hex('#2a2418'));
      return { buf: b, ax: 45, ay: 29 };
    });
    if (carc) main.add(new Prop(carc.f, 1300, coGround(1300) + 1, 2));
    for (const x of [500, 1000]) f.pois.push({ kind: 'cover', ...hideBush(f, x, G, x), w: 18 } as never);
    const N: [string, string, number][] = [
      ['shells1', 'shells', 380], ['shells2', 'shells', 900], ['stones1', 'stones', 640], ['drift1', 'driftwood', 1120], ['drift2', 'driftwood', 1450],
      ['sea1', 'seaweed', 1560], ['sea2', 'seaweed', 760], ['feath1', 'feather', 1250], ['flax1', 'flax', 200],
    ];
    for (const [k, kind, x] of N) node(f, k, kind, x);
    // diving (needs Pip's patched dive suit)
    pushI(f, {
      x: SEA_X - 60, y: coGround(SEA_X - 60), w: 20, h: 26, label: 'Dive into the deep', standX: SEA_X - 70,
      enabled: () => !!game.save.flags['divegear'],
      action: async () => {
        await f.say([{ who: 'rowan', text: 'Suit sealed. Air tank… mostly full. Here goes nothing.', expr: 'worried' } as never]);
        audio.play('splashBig' as never);
        const { FieldScene } = await import('../scenes/field');
        game.go(() => new FieldScene(COAST_DEEP, f.tod));
      },
    });
    pushI(f, {
      x: SEA_X - 60, y: coGround(SEA_X - 60), w: 20, h: 26, label: 'Look out to sea', standX: SEA_X - 70,
      enabled: () => !game.save.flags['divegear'],
      action: () => f.bark('rowan', 'That fin from the storm is out there somewhere. I’d need dive gear to get close.', { expr: 'thinking' }),
    });
    frontFoliage(f, 0, SEA_X, [220, 360], ['grass', 'flax'], 1.35, CO_G + 90, 141);
  },
  spawns: [
    { species: 'monarch', n: [1, 2], x: [300, 2200], medium: 'air', times: ['dawn', 'day'], chance: 1 },
    { species: 'leviathan', n: [1, 1], x: [1900, 2350], medium: 'water', times: ['dawn', 'day', 'dusk', 'night'], chance: 0.6 },
    { species: 'galehawk', n: [1, 1], x: [100, 1600], medium: 'air', times: ['day'], chance: 0.3 },
  ],
  insects: [
    { kind: 'butterfly', x: [100, 1500], y: [220, 270], n: 3, times: ['day'] },
    { kind: 'firefly', x: [0, 1500], y: [200, 280], n: 8, times: ['dusk', 'night'] },
  ],
  onEnter: f => arrive(f, 'Serpent Coast', 'Te Tai Nakahi', 'My tūpuna called this coast after the thing that lives beyond the reef. Keep your eyes on the water.'),
};

const DP_W = 2200, DP_FLOOR = 330;
const dpGround = (x: number) => DP_FLOOR + Math.sin(x * 0.01) * 10 + Math.sin(x * 0.041) * 3;
const COAST_DEEP: FieldSite = {
  id: 'coast', name: 'Serpent Coast · The Deep', width: DP_W, camY: 200, followY: true, minY: -40, maxY: 380, spawnX: 80, exitX: 40, waterY: -60,
  underwater: true, ambience: 'underwater', music: 'wonder', ground: 'sand',
  build(f) {
    const st = f.st, r = game.r, G = g0(dpGround);
    // blue gradient + god rays from the surface
    const bgL = st.addLayer('deepbg', 0.05, 0, 0, 0);
    const span = layerSpan(st, 0.05, 200);
    const bg = new PixelBuffer(Math.min(1024, span.w), 480);
    for (let y = 0; y < 480; y++) for (let x = 0; x < bg.w; x++) bg.set(x, y, mix(hex('#3a8ab0'), hex('#061a2a'), clamp(y / 420) + (bayer(x, y) - 0.5) * 0.05));
    for (let x = 0; x < span.w; x += bg.w) bgL.add(new Prop({ ...bigFrame(r, bg), ax: 0, ay: 0 }, span.x0 + x, -100));
    const kelpL = st.addLayer('kelpfar', 0.55, 0.3, 0.3, 0);
    const rng = new Rng(909);
    for (let x = 0; x < DP_W * 0.55 + 200; x += rng.range(30, 70)) {
      const c = sprite(`kelp:${rng.int(0, 4)}`, () => SA.paintKelp(rng.int(1, 999), rng.range(120, 220)) as never);
      if (c) kelpL.add(new Prop(c.f, x, DP_FLOOR + 10, rng.next(), { sway: 1.2, tint: packColor(0.5, 0.65, 0.75, 1) }));
    }
    const main = mainLayer(f);
    groundStrip(f, DP_W, G, [PAL.sand[5], PAL.sand[4], PAL.sand[3], PAL.sand[2]], PAL.sand[0], 17, 80);
    st.terrain.water.push([0, DP_W, -60, 420]);
    for (let x = 60; x < DP_W; x += rng.range(40, 90)) {
      const c = sprite(`kelpn:${rng.int(0, 4)}`, () => SA.paintKelp(rng.int(1, 999), rng.range(80, 180)) as never);
      if (c) main.add(new Prop(c.f, x, dpGround(x) + 4, -2, { sway: 1.4 }));
      if (rng.chance(0.3)) { const s = sprite(`sponge:${rng.int(0, 2)}`, () => SA.paintSponge(rng.int(1, 99)) as never); if (s) main.add(new Prop(s.f, x + 14, dpGround(x) + 3, 1)); }
    }
    shafts(f, main, [{ x: 300, w: 80, a: 0.08 }, { x: 900, w: 90, a: 0.12 }, { x: 1600, w: 70, a: 0.1 }], [0.7, 0.9, 1], -60, 420, 0.8);
    node(f, 'dshell1', 'shells', 700);
    node(f, 'dshell2', 'shells', 1500);
    // swim back up
    pushI(f, {
      x: 60, y: dpGround(60) - 30, w: 30, h: 60, label: 'Swim back to the surface', standX: 70,
      action: async () => {
        const { FieldScene } = await import('../scenes/field');
        game.go(() => new FieldScene(COAST, f.tod));
      },
    });
  },
  spawns: [
    { species: 'leviathan', n: [1, 1], x: [900, 2000], medium: 'water', y: 200, chance: 1 },
  ],
  onEnter: f => { f.bark('rowan', 'So quiet down here… just my own breathing.', { expr: 'worried' }); },
};

export const SITES2: Record<SiteId, FieldSite> = { fernwood: FERNWOOD, canopy: CANOPY, falls: FALLS, mangrove: MANGROVE, coast: COAST };
export { COAST_DEEP };
export type { SpawnV2 };
const _unused: C | undefined = undefined; void _unused; void shade;
