// V10: Te Riu Wera, the Hot Valley. Out of the Glowing Forest the warm wind leads to a valley where
// the ground is cooking: boiling mud, steam vents that blow without warning (scalding), silica
// terraces in white, orange and green, sulfur crystals round the vents, and a turquoise hot spring
// where a tired explorer can soak once a day. Life here likes it hot: mats of microbes in rainbow
// bands, striders basking on warm rock. At the far end an old stone stair goes down into the steam:
// the way deeper, to the place nobody goes.

import type { FieldScene } from '../scenes/field';
import type { Site10, Swim10 } from './kit';
import { swimWater, SWIM_DEPTH, arrive10, boulder, propAt, bump, steam, sprite, Rng, hex, mix, PAL, bayer, fbm2, game, layerSpan, bigFrame, clamp } from './kit';
import { groundStrip, mainLayer, skyAndRidge, undergrowth, hideBush, frontFoliage } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import * as Lsc from '../../art/landscape';
import { deadwood, plant } from '../../art/jungle-plants';
import { findArt } from '../v10/finds';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';
import type { Interactable } from '../../world/npc';

const W = 2400, G = 286, UP = G - 58;
const SPRING: Swim10 = { x0: 1470, x1: 1610, top: UP + 4, bottom: UP + 40, col: [0.18, 0.62, 0.66] };
const MUD: [number, number][] = [[430, 520], [560, 620]];
const VENTS = [720, 1760, 1880, 2010];
const dip = (x: number, s: Swim10, y: number) => {
  const line = s.top + SWIM_DEPTH;
  if (x >= s.x0 && x <= s.x1) return line;
  const d = x < s.x0 ? s.x0 - x : x - s.x1;
  return d < 20 ? y + (line - y) * (1 - d / 20) : y;
};
/** the valley floor, then the silica terraces stepping up to the spring shelf, then down past the vents */
export const geoGround = (x: number) => {
  let y = G + Math.sin(x * 0.012) * 3;
  if (x > 880 && x < 1280) {
    // six sinter steps, each rising over its last few pixels
    const t = ((x - 880) / 400) * 6, i = Math.floor(t), fr = t - i;
    y = G - (58 / 6) * (i + (fr > 0.82 ? (fr - 0.82) / 0.18 : 0));
  }
  else if (x >= 1280 && x < 1700) y = UP + Math.sin(x * 0.02) * 1.5;
  else if (x >= 1700 && x < 2000) y = UP + ((x - 1700) / 300) * 40;
  else if (x >= 2000) y = UP + 40 + bump(x, 2100, 2300, -6);
  for (const [a, b] of MUD) if (x > a && x < b) y += 6;
  return dip(x, SPRING, y);
};

const SINTER: C[] = [hex('#b8a888'), hex('#d0c4a4'), hex('#e6dcc4'), hex('#f6f0e2')];
const OCHRE: C[] = [hex('#5a3420'), hex('#7a4a2a'), hex('#9a6436'), hex('#b8804a'), hex('#d09a62'), hex('#e4b884')];

/** silica terrace step faces: white sinter streaked with microbe bands (orange, green, rust) */
function terraceArt(): { buf: PixelBuffer; ax: number; ay: number } {
  const w = 420, h = 90, b = new PixelBuffer(w, h);
  const band = [hex('#e87a2a'), hex('#d8a030'), hex('#7aa040'), hex('#a8482a')];
  for (let x = 0; x < w; x++) {
    const t = x / w, top = Math.round(geoGround(880 + x) - G - 5 + h);
    for (let y = Math.max(0, top); y < h; y++) {
      const d = y - top;
      let c = SINTER[clamp(Math.round(3 - d * 0.05 + (bayer(x, y) - 0.5)), 0, 3)];
      if (d < 3) c = SINTER[3];
      const step = Math.floor(t * 6);
      if ((x + Math.floor(y * 0.3)) % 9 === 0 && d > 3) c = mix(c, band[step % 4], 0.6);
      if (d > 6 && d < 10) c = mix(c, band[(step + 1) % 4], 0.45);
      b.set(x, y, c);
    }
  }
  return { buf: b, ax: 0, ay: h - 1 };
}

/** a steam vent: a crusted cone of rock with yellow sulfur round its mouth */
function ventArt(seed: number) {
  const s = boulder(seed, 30, 18, OCHRE, { moss: 0 });
  const b = s.buf;
  for (let x = 11; x < 19; x++) { b.set(x, 2, hex('#e8d040')); if (x % 2) b.set(x, 3, hex('#c8b030')); }
  b.rect(13, 0, 4, 2, hex('#1a1210'));
  return s;
}

export const GEOVALLEY: Site10 = {
  id: 'geovalley', loc: 'geovalley', name: 'The Hot Valley', width: W, camY: 172, spawnX: 80, exitX: 30, waterY: UP + 4,
  ambience: 'falls', music: 'tension', ground: 'grass',
  build(f) {
    const st = f.st, r = game.r, G0 = { y: geoGround };
    const rng = new Rng(909);
    skyAndRidge(f, { seed: 77, base: 210 });
    // warm, hazy light
    const prev = st.envHook;
    st.envHook = (env, dt) => {
      prev?.(env, dt);
      env.fogTop = mix3(env.fogTop, [0.92, 0.84, 0.72], 0.45);
      env.fogBottom = mix3(env.fogBottom, [0.96, 0.9, 0.8], 0.5);
      env.ambientTop = [env.ambientTop[0] * 1.04, env.ambientTop[1] * 0.98, env.ambientTop[2] * 0.9];
      env.bloom += 0.15;
    };
    // barren volcanic hills
    for (const [p, base, seed, fog] of [[0.12, 200, 3, 0.45], [0.3, 236, 4, 0.3]] as const) {
      const span = layerSpan(st, p);
      const buf = Lsc.paintRidge(span.w, 150, { seed, base: 150, amp: 60, freq: 0.012, body: OCHRE[2], lit: OCHRE[4], shadow: OCHRE[1], snow: OCHRE[5], snowLine: 0, fogTo: hex('#e8d4b8'), fogStart: 60, sharp: 0.4 });
      const l = st.addLayer('hills' + seed, p, fog, 0.3, 0);
      l.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, base - 150 + 40));
    }
    // steam plumes rising from far vents
    const plumes = st.addLayer('plumes', 0.3, 0.2, 0, 0);
    plumes.add(new Custom(0, () => {}, dt => {
      if (!rand.chance(dt * 3)) return;
      const x = rand.range(0, W * 0.3 + 300);
      plumes.particles.spawn({ frame: A.soft, x, y: 200, vx: rand.range(-2, 2) + 3, vy: rand.range(-14, -8), life: rand.range(6, 10), color: [0.95, 0.95, 0.96], alpha: 0.3, alpha1: 0, size: 1.4, size1: 4 });
    }));
    // dead trees and scrub in the mid ground
    const mid = st.addLayer('mid', 0.75, 0.1, 0.5, 0);
    for (let x = 30; x < W * 0.75 + 200; x += rng.range(70, 150)) {
      const dead = rng.chance(0.5);
      const c = sprite(`gv:mid:${dead ? 'd' : 's'}${rng.int(0, 2)}`, () => (dead ? deadwood('stump', rng.int(1, 999), 40) : plant('shrub', rng.int(1, 999), 36)));
      if (c) mid.add(new Prop(c.f, x, geoGround(x / 0.75) + 2, 0, { tint: dead ? packColor(0.7, 0.62, 0.55, 1) : packColor(0.72, 0.75, 0.55, 1) }));
    }
    const main = mainLayer(f);
    groundStrip(f, W, G0, [OCHRE[5], OCHRE[4], OCHRE[3], OCHRE[2]], OCHRE[0], 51, 130);
    // the silica terraces
    const ta = sprite('gv:terrace', terraceArt);
    if (ta) main.add(new Prop(ta.f, 880, G + 4, -2));
    // boiling mud: grey pools with bubbles that plop
    for (const [a, b] of MUD) {
      main.add(new Custom(-1.5, (rr, s2) => {
        rr.rect(a, G + 1, b - a, 10, packColor(0.42, 0.4, 0.38, 1));
        rr.rect(a + 2, G, b - a - 4, 2, packColor(0.55, 0.52, 0.48, 1));
        for (let i = 0; i < (b - a) / 10; i++) {
          const k = (s2.time * 0.7 + i * 0.37) % 1, x = a + 5 + ((i * 17.3) % (b - a - 10));
          rr.fxDraw(A.dot2, x, G + 1 - k * 3, 1.2 + k, 1.2 + k, 0, packColor(0.6, 0.58, 0.55, 1), 0.8 * (1 - k));
        }
      }, dt => { if (rand.chance(dt * 1.5)) f.sfx('bubble' as never, a + (b - a) / 2, 0.25, 0.5); }));
      steam(f, (a + b) / 2, G - 2, (b - a) / 2, 0.6);
    }
    // vents (they blow: the hazards below), the hot spring and its microbe mats
    for (const x of VENTS) { propAt(f, `gv:vent:${x}`, () => ventArt(x), x, geoGround(x) + 3, -1); steam(f, x, geoGround(x) - 14, 3, 0.8); }
    swimWater(f, SPRING);
    steam(f, (SPRING.x0 + SPRING.x1) / 2, SPRING.top - 2, 60, 1.2);
    main.add(new Custom(-2, rr => {
      const bands = [packColor(0.9, 0.45, 0.15, 1), packColor(0.85, 0.65, 0.2, 1), packColor(0.45, 0.62, 0.25, 1)];
      for (let i = 0; i < 3; i++) { rr.rect(SPRING.x0 - 22 + i * 6, geoGround(SPRING.x0 - 22) + 1 + i, 18 - i * 4, 2, bands[i]); rr.rect(SPRING.x1 + 4 + i * 4, geoGround(SPRING.x1 + 4) + 1 + i, 18 - i * 4, 2, bands[2 - i]); }
    }));
    // the old stair down into the steam
    const stair = new PixelBuffer(120, 70);
    for (let i = 0; i < 9; i++) for (let x = i * 12; x < 120; x++) for (let y = i * 7; y < i * 7 + 7; y++) stair.set(x, y, y === i * 7 ? hex('#c8b89a') : mix(hex('#8a7a62'), hex('#5a4c3c'), (y - i * 7) / 7 + (bayer(x, y) - 0.5) * 0.2));
    stair.outline(hex('#1a1410'));
    main.add(new Prop({ ...bigFrame(r, stair), ax: 0, ay: 0 }, 2270, geoGround(2270) - 2, -3));
    steam(f, 2340, geoGround(2340) + 10, 40, 1.6);
    for (const [x, w, h] of [[200, 60, 30], [800, 40, 22], [1350, 70, 34], [2150, 56, 30]] as const) propAt(f, `gv:b:${x}`, () => boulder(x, w, h, OCHRE, { moss: 0 }), x, geoGround(x) + 4, -3);
    for (const x of [300, 1300, 2100]) f.pois.push({ kind: 'sun', x, y: geoGround(x) }, { kind: 'rock', x: x + 20, y: geoGround(x + 20) - 6 });
    undergrowth(f, main, 0, 420, 0.5, G0, 61, { plants: ['grass', 'sedge', 'shrub'], wood: ['rock', 'stump'] });
    undergrowth(f, main, 640, 880, 0.5, G0, 62, { plants: ['grass', 'sedge'], wood: ['rock'] });
    for (const x of [340, 1700]) hideBush(f, x, G0, x, 0.7);
    frontFoliage(f, 260, W, [280, 460], ['grass', 'flax'], 1.35, G + 112, 71, { tint: packColor(0.55, 0.5, 0.4, 1) });
    // the hot spring: a soak, once a day
    (f.interact as Interactable[]).push({
      x: SPRING.x0 + 30, y: SPRING.top + SWIM_DEPTH, w: 30, h: 20, standX: SPRING.x0 + 30, label: 'Soak in the hot spring',
      enabled: () => game.save.vars['v10:soak'] !== game.save.day,
      action: () => soak(f),
    });
  },
  spawns: [
    { species: 'strider', n: [2, 3], x: [200, 2200], times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'shieldback', n: [1, 2], x: [200, 1300], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'galehawk', n: [1, 1], x: [200, 2200], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'monarch', n: [1, 1], x: [400, 2200], medium: 'air', times: ['dawn', 'day'], chance: 0.6 },
    { species: 'flicker', n: [1, 1], x: [600, 2000], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
    { species: 'quillhog', n: [1, 1], x: [200, 2000], times: ['dusk', 'night'], chance: 0.8 },
  ],
  insects: [
    { kind: 'dragonfly', x: [1400, 1700], y: [200, 240], n: 4, times: ['day', 'dusk'] },
    { kind: 'butterfly', x: [100, 900], y: [200, 270], n: 3, times: ['day'] },
  ],
  onEnter: f => arrive10(f, 'The Hot Valley', 'Te Riu Wera', 'Te Riu Wera. The ground here is alive, and it is cooking. Step where I step.'),
  v10: {
    swims: [SPRING],
    hazards: [
      { x0: 425, x1: 625, kind: 'mud', dmg: 1.5, warn: 'Boiling mud. Don’t fall in: it won’t give you back.' },
      { x0: 690, x1: 750, kind: 'scald', dmg: 8, period: 5 },
      { x0: 1730, x1: 2040, kind: 'scald', dmg: 8, period: 3.8, warn: 'The vents blow when they please. Listen for the hiss, then go.' },
    ],
    points: [
      { id: 'eco:gv:valley', kind: 'ecosystem', name: 'The Hot Valley', x: 600, photo: { w: 300, h: 160 }, note: 'Steam, boiling mud and rainbow microbes: an ecosystem cooked from below.' },
      { id: 'lm:gv:terraces', kind: 'landmark', name: 'Silica terraces', x: 1080, photo: { w: 400, h: 80 }, note: 'White sinter steps streaked orange and green by heat-loving microbes.' },
      { id: 'pt:gv:mat', kind: 'plant', name: 'Hot-spring mat', x: SPRING.x0 - 14, art: () => findArt.dig('#d8782a'), take: { item: 'plt_thermomat', verb: 'Peel a strip of the microbe mat', tools: ['knife'], time: 1.8, line: 'Warm and rubbery. It’s ALIVE. In near-boiling water.' } },
      { id: 'pt:gv:water', kind: 'sample', name: 'Hot spring water', x: SPRING.x1 + 14, art: () => findArt.sampleSpot('#4ac8c8'), take: { item: 'smp_hotwater', verb: 'Fill a jar from the spring (carefully)', tools: ['jar'], time: 1.8, line: 'Ow, ow, warm jar. Lid on. Got it.' } },
      { id: 'pt:gv:sulfur', kind: 'sample', name: 'Sulfur crystals', x: 1790, art: () => findArt.glint('#e8d040'), take: { item: 'smp_sulfur', verb: 'Scrape sulfur crystals off the vent', tools: ['knife'], time: 1.6, line: 'Smells like a thousand rotten eggs having a party.' } },
      { id: 'pt:gv:ash', kind: 'sample', name: 'Volcanic soil', x: 260, art: () => findArt.dig('#a8502a'), take: { item: 'smp_ash', verb: 'Take a soil sample', tools: ['trowel'], time: 1.8 } },
      { id: 'lm:gv:stair', kind: 'landmark', name: 'The old stone stair', x: 2320, photo: { w: 120, h: 70 }, note: 'Steps cut by people long ago, going down into the steam. Someone wanted to get down there.' },
    ],
  },
};

const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** a soak in the hot spring: energy back (once a day), and a moment of peace */
async function soak(f: FieldScene) {
  if (f.cutscene) return;
  f.cutscene = true;
  try {
    game.save.vars['v10:soak'] = game.save.day;
    audio.play('splash', { vol: 0.5 });
    await game.fadeTo(0.85, 2);
    const { restore } = await import('../v10/energy');
    restore(25);
    const { passTime } = await import('../v10/expedition');
    passTime(0.5);
    await new Promise(r => setTimeout(r, 900));
    await game.fadeTo(0, 1.6);
    const lines: { who: string; text: string; expr: string }[] = [{ who: 'mori', text: 'Ohhh. Okay. I’m never leaving. Tell the agency I live here now.', expr: 'happy' }];
    if (f.guide) lines.push({ who: 'aroha', text: 'Ten minutes. Then we go. The water here makes people sleepy, and sleepy people step in the wrong pool.', expr: 'teasing' });
    await f.say(lines as never);
    game.ui.toast('+25 energy. You feel warm right down to your boots.', 'SOAK', 'teal', 3000);
  } finally {
    f.cutscene = false;
  }
}
void fbm2; void hex;
