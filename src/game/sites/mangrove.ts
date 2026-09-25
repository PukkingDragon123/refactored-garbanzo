// Blackwater Mangroves: black water channels, prop roots, mudbanks and something enormous.

import { game } from '../game';
import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { Prop, Custom } from '../../world/props';
import { addSky, addClouds, addFarImage, layerSpan } from '../../world/scenery';
import { scatter, aid, addGlowFungi } from './kit';
import { local, A } from '../assets';
import { bigFrame } from '../../gfx/atlas';
import * as F from '../../art/flora';
import * as L from '../../art/landscape';
import * as S from '../../art/sitesart';
import { PAL } from '../../art/palettes';
import { hex } from '../../art/color';
import { packColor } from '../../gfx/renderer';
import { timePreset } from '../../world/timeofday';
import { Rng, rand, lerp } from '../../core/math';
import { Ironjaw, Titan, Mudribbon } from '../wildlife/serpents';
import { SerpentStork } from '../wildlife/birds';
import { audio } from '../../core/audio';
import { setFlag } from '../story';

const W = 2400;
const WY = 238;
const BANKS: [number, number][] = [[0, 300], [520, 760], [1000, 1250], [1520, 1740], [1980, W]];

export function mangroveGround(x: number) {
  for (const [a, b] of BANKS) {
    if (x >= a && x <= b) {
      const e = Math.min(x - a, b - x);
      return 228 + Math.sin(x * 0.03) * 1.2 + Math.max(0, 14 - e) * 0.9;
    }
  }
  return 262; // channel bed
}

export function buildMangrove(st: Stage, sc: ExpeditionScene): SiteContent {
  const r = game.r;
  const tod = st.tod;
  st.preset = timePreset(tod, { shade: 0.45, haze: [0.52, 0.6, 0.48], hazeK: 0.5 });
  st.minX = 0;
  st.maxX = W;
  st.waterY = WY;
  const rng = new Rng(404);
  addSky(st, r);
  addClouds(st, r, 0.03, 20, 110, 6, 51);
  addFarImage(st, r, 'far', 0.12, 0.6, w => L.paintTreeline(w, 150, { seed: 61, base: 140, amp: 16, ramp: ['#3c5446', '#46604e', '#526c58', '#5f7a62'].map(h => hex(h)), rMin: 10, rMax: 18, fern: 0.1, emergent: 0.2, palms: 0.3 }), 70);
  // far mangrove silhouettes standing in water
  const mfar = st.addLayer('mfar', 0.35, 0.4, 0.1);
  const ms = layerSpan(st, 0.35);
  scatter(mfar, ms.x0, ms.x0 + ms.w, [60, 120], 62, () => 234, g => F.paintMangrove(g.int(1, 999), g.int(70, 110), g.int(80, 120)), 0.4);
  mfar.add(new Custom(-1, rr => rr.rect(ms.x0, 228, ms.w, 40, packColor(0.16, 0.22, 0.2, 1))));
  const mist = st.addLayer('mist', 0.5, 0.15, 0, 0.3);
  const mst = layerSpan(st, 0.5, 100);
  mist.add(new Prop({ ...bigFrame(r, L.paintMist(mst.w, 50, hex('#c8d6c4'), 21, 0.9)), ax: 0, ay: 0 }, mst.x0, 190));
  const mmid = st.addLayer('mmid', 0.65, 0.18, 0.4);
  const mms = layerSpan(st, 0.65);
  scatter(mmid, mms.x0, mms.x0 + mms.w, [70, 140], 63, () => 238, g => F.paintMangrove(g.int(1, 999), g.int(90, 130), g.int(110, 150)), 0.6);

  const main = st.addLayer('main', 1, 0, 1, 0);
  // black water everywhere
  main.add(new Custom(-4, rr => {
    rr.water(0.8, 1.1, 0.7);
    rr.rect(-50, WY, W + 100, 60, packColor(0.07, 0.11, 0.09, 1));
    rr.water(0);
  }));
  // mudbanks
  for (const [a, b] of BANKS) {
    const w = b - a;
    const buf = S.paintMudbank(w, 50, a);
    for (let x = 0; x < w; x++) {
      const top = Math.round(mangroveGround(a + x) - 222);
      for (let y = 0; y < top; y++) buf.data[y * w + x] = 0;
      if (top >= 0 && top < 50) buf.set(x, top, PAL.moss[3]);
    }
    main.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, a, 222, -2));
    st.terrain.addGround(Array.from({ length: Math.ceil(w / 6) + 1 }, (_, i) => [a + Math.min(w, i * 6), mangroveGround(a + Math.min(w, i * 6))] as [number, number]));
  }
  // shallow channel bed as walkable (wading) ground below the surface
  for (let i = 0; i < BANKS.length - 1; i++) {
    const a = BANKS[i][1], b = BANKS[i + 1][0];
    st.terrain.addPlatform([[a, 236], [a + 20, 222], [b - 20, 222], [b, 236]], 'bridge');
    main.add(new Custom(15, (rr, s) => {
      // rickety boardwalk
      for (let x = a + 4; x < b - 4; x += 5) {
        const y = x < a + 20 ? lerp(236, 222, (x - a) / 20) : x > b - 20 ? lerp(222, 236, (x - (b - 20)) / 20) : 222 + Math.sin(x * 0.7) * 0.4;
        const miss = (x * 13) % 47 === 0;
        if (!miss) {
          rr.rect(x, y, 4, 2, packColor(0.36, 0.27, 0.17, 1));
          rr.rect(x, y + 2, 4, 1, packColor(0.2, 0.14, 0.08, 1));
        }
        if (x % 30 < 5) rr.rect(x, y + 3, 2, 14, packColor(0.24, 0.17, 0.1, 1));
      }
      void s;
    }));
  }
  // mangrove trees on banks & roots
  scatter(main, 30, W, [90, 170], 64, x => Math.min(mangroveGround(x), WY), g => F.paintMangrove(g.int(1, 999), g.int(100, 140), g.int(130, 170)), 0.5, -5);
  // hanging moss curtains (foreground-ish)
  const mossL = st.addLayer('moss', 1.15, 0, 0.7);
  const msp = layerSpan(st, 1.15, 120);
  scatter(mossL, msp.x0, msp.x0 + msp.w, [60, 140], 65, () => -10, g => S.paintHangingMoss(g.int(1, 999), g.int(20, 40), g.int(50, 110)), 0.4);
  // reeds = hides
  const hides = [240, 700, 1180, 1690, 2060].map(x => ({ x, w: 40, y: mangroveGround(x), cover: 0.9 }));
  for (const h of hides) {
    const o = S.paintReeds(rng.int(1, 999), 40, 40);
    main.add(new Prop(local.add(aid('reed'), o.buf, o.ax, o.ay), h.x, h.y + 2, 70, { sway: 1.2 }));
  }
  scatter(main, 20, W, [80, 160], 66, x => Math.min(mangroveGround(x), WY), g => S.paintReeds(g.int(1, 999), g.int(16, 26), g.int(20, 30)), 1, 65);
  addGlowFungi(main, [[560, mangroveGround(560)], [1100, mangroveGround(1100)], [1600, mangroveGround(1600)], [2100, mangroveGround(2100)]], tod === 'night');
  main.add(new Custom(99, () => {}, (dt, s) => {
    if ((tod !== 'day') && rand.chance(dt * 4)) main.glowParticles.spawn({ frame: A.dot2, x: s.cam.x + rand.range(-260, 260), y: rand.range(130, 230), life: rand.range(4, 8), color: [0.8, 1, 0.4], alpha: 1, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 2.8, wobble: 14, wobbleF: 1.4, lightR: 14 });
    if (rand.chance(dt * 1.2)) main.particles.spawn({ frame: A.ring, x: s.cam.x + rand.range(-240, 240), y: WY + rand.range(0, 12), life: 1.6, size: 0.2, size1: 1.2, color: [0.6, 0.7, 0.6], alpha: 0.5, alpha1: 0 });
  }));
  const fg = st.addLayer('fg', 1.35, 0, 0.8);
  const fs = layerSpan(st, 1.35, 150);
  scatter(fg, fs.x0, fs.x0 + fs.w, [60, 140], 67, () => 300, g => (g.chance(0.6) ? S.paintReeds(g.int(1, 999), 30, 60) : F.paintBigLeaf(g.int(1, 999), 70, PAL.leafOlive)), 1.8);

  const titanOn = game.save.chapter >= 4;
  const storkPerches: { x: number; y: number }[] = [];
  return {
    hides,
    clues: [{ id: 'croc-scute', x: 1120, y: mangroveGround(1120) }, { id: 'vertebrae', x: 1640, y: mangroveGround(1640) }],
    spawns: [
      { species: 'ironjaw', n: 2, respawn: 60, make: (_c, i) => { const x = [880, 1880][i % 2]; return new Ironjaw(x, WY + 3, [760, 1740][i % 2] - 30); } },
      { species: 'mudribbon', n: 2, times: ['day', 'dusk', 'night'], respawn: 30, make: (_c, i) => { const x = [400, 1400][i % 2]; return new Mudribbon(x, WY, rand.sign()); } },
      { species: 'snakestork', n: 2, times: ['dawn', 'day', 'dusk'], respawn: 45, make: (_c, i) => new SerpentStork([600, 1600][i % 2], WY + 4, storkPerches) },
      { species: 'titan', n: 1, when: () => titanOn, make: () => new Titan(1420, WY + 6, -1) },
    ],
    jeepX: 90,
    spawnX: 170,
    waterY: WY,
    camY: 135,
    ambience: 'mangrove',
    music: 'explore',
    onUpdate: (s) => titanEncounter(s),
  };
  void sc;
}

async function titanEncounter(sc: ExpeditionScene) {
  if (game.save.flags.titanScene || sc.cutscene) return;
  if (game.save.chapter < 4 || sc.player.x < 1050) return;
  const titan = sc.creatures.find(c => c.id === 'titan') as Titan | undefined;
  if (!titan) return;
  setFlag('titanScene');
  sc.cutscene = true;
  titan.scripted = true;
  const p = sc.player;
  p.control = false;
  game.ui.letterbox(true);
  audio.setMusic('tension');
  sc.st.cam.locked = true;
  const cam = sc.st.cam;
  const from = cam.x;
  // pan to the channel as the water starts to move
  for (let t = 0; t < 1; t += 1 / 90) {
    cam.x = lerp(from, 1380, t * t * (3 - 2 * t));
    await new Promise(r => setTimeout(r, 16));
  }
  await game.ui.say([{ who: 'otis', text: 'The water’s... moving. By itself.', expr: 'worried' }]);
  sc.st.shake(2, 1.2);
  audio.play('hiss', { vol: 1, pitch: 0.4 });
  // the Titan rises
  titan.submergeY = undefined;
  for (let t = 0; t < 1; t += 1 / 100) {
    titan.moveHead(1380 - t * 20, lerp(244, 170, t * t));
    titan.jaw = t > 0.7 ? 0.5 : 0;
    await new Promise(r => setTimeout(r, 16));
  }
  audio.play('roar', { vol: 1 });
  sc.st.shake(5, 1);
  await game.ui.say([
    { who: 'otis', text: 'Oh. Oh no. That’s the skin. That’s the *owner of the skin.*', expr: 'wow' },
    { who: 'otis', text: 'Okay. Okay. It hasn’t seen me. Get to the reeds. *Hide*, and get the shot.', expr: 'worried' },
  ]);
  titan.submergeY = 246;
  titan.scripted = false;
  titan.setState('swim', 'swimming');
  titan.tx = 1250;
  cam.locked = false;
  game.ui.letterbox(false);
  p.control = true;
  sc.cutscene = false;
  game.ui.toast('Hide in the reeds (S) and photograph the Titan Constrictor!', 'DANGER', 'coral', 6000);
}
