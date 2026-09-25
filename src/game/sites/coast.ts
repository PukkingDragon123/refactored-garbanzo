// Serpent Coast: a dive into the kelp forests where the Finned Leviathan hunts.

import { game } from '../game';
import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { Prop, Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { scatter, aid, addShafts, Shaft } from './kit';
import { local, props, A } from '../assets';
import { bigFrame } from '../../gfx/atlas';
import { PixelBuffer } from '../../art/pixel';
import * as S from '../../art/sitesart';
import * as F from '../../art/flora';
import { PAL } from '../../art/palettes';
import { hex, mix, shade } from '../../art/color';
import { packColor } from '../../gfx/renderer';
import { timePreset } from '../../world/timeofday';
import { Rng, rand, bayer, clamp, fbm1, fbm2, lerp } from '../../core/math';
import { Leviathan } from '../wildlife/serpents';
import { audio } from '../../core/audio';
import { setFlag } from '../story';

const W = 2400;
const SURF = 40;

export function seabed(x: number) {
  return 360 + Math.sin(x * 0.004) * 30 + fbm1(x * 0.01, 3, 7) * 40 - (x < 200 ? (200 - x) * 0.5 : 0);
}

interface Fish { x: number; y: number; vx: number; vy: number; ph: number; ox: number; oy: number }

export function buildCoast(st: Stage, sc: ExpeditionScene): SiteContent {
  const r = game.r;
  const tod = st.tod;
  st.preset = timePreset(tod, { shade: 0 });
  const e = st.preset.env;
  const night = tod === 'night';
  // underwater grading: deep blue ambience and fog
  const k = night ? 0.35 : tod === 'day' ? 1 : 0.75;
  e.ambientTop = [0.55 * k + 0.1, 0.85 * k + 0.12, 1.0 * k + 0.2];
  e.ambientBottom = [0.12 * k + 0.05, 0.3 * k + 0.08, 0.45 * k + 0.12];
  e.fogTop = [0.18 * k, 0.5 * k + 0.05, 0.62 * k + 0.08];
  e.fogBottom = [0.02, 0.1 * k + 0.03, 0.18 * k + 0.06];
  e.bloom = 0.7;
  e.bloomThreshold = 0.75;
  e.saturation = 1.1;
  e.vignette = 0.6;
  st.preset.lightK = night ? 1.2 : 0.8;
  st.minX = 0;
  st.maxX = W;
  st.minY = -40;
  st.maxY = 460;
  const rng = new Rng(505);
  // water column gradient (screen)
  const sky = st.addScreenLayer('water', 0.5);
  const grad = new PixelBuffer(64, 300);
  const top = hex(night ? '#0d2a40' : '#4fb0c8'), mid = hex(night ? '#061828' : '#1a6a8a'), bot = hex(night ? '#020810' : '#082a40');
  for (let y = 0; y < 300; y++) for (let x = 0; x < 64; x++) {
    const t = y / 299;
    const q = Math.floor(t * 20 + bayer(x, y) - 0.5) / 20;
    grad.data[y * 64 + x] = q < 0.5 ? mix(top, mid, clamp(q * 2)) : mix(mid, bot, clamp((q - 0.5) * 2));
  }
  const gradF = bigFrame(r, grad);
  const skyStrip = new PixelBuffer(64, 60);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 64; x++) skyStrip.data[y * 64 + x] = mix(st.preset.sky[0].c, st.preset.sky[st.preset.sky.length - 1].c, y / 59);
  const skyF = bigFrame(r, skyStrip);
  sky.add(new Custom(0, (rr, s) => {
    // map world depth to gradient position so it darkens as you dive
    const d = clamp((s.cam.y - 100) / 360, 0, 1);
    rr.drawSub(gradF, 0, d * 30, 64, 270, 0, 0, rr.VW / 64 + 0.1, 1);
    const surfY = rr.projectY(SURF, 1);
    if (surfY > 0) rr.draw(skyF, 0, surfY - 60, rr.VW / 64 + 0.1, 1);
  }));
  // distant rock silhouettes
  const far = st.addLayer('far', 0.3, 0.55, 0.1, 0, 0.3);
  const fsp = layerSpan(st, 0.3);
  const rock = new PixelBuffer(fsp.w, 300);
  for (let x = 0; x < fsp.w; x++) {
    const h = 150 + fbm1(x * 0.008, 4, 3) * 140;
    for (let y = Math.floor(300 - h); y < 300; y++) rock.data[y * fsp.w + x] = (bayer(x, y) < 0.15 ? hex('#1e4a5a') : hex('#173c4a'));
  }
  far.add(new Prop({ ...bigFrame(r, rock), ax: 0, ay: 0 }, fsp.x0, 150));
  // mid kelp forest
  const kelpL = st.addLayer('kelp', 0.6, 0.3, 0.4, 0, 0.6);
  const ks = layerSpan(st, 0.6, 80);
  scatter(kelpL, ks.x0, ks.x0 + ks.w, [18, 45], 71, () => 400, g => S.paintKelp(g.int(1, 999), g.int(160, 280)), 2.5);

  const main = st.addLayer('main', 1, 0, 1, 0);
  // seabed
  const bedBuf = new PixelBuffer(W, 160);
  for (let x = 0; x < W; x++) {
    const t0 = Math.round(seabed(x) - 330);
    for (let y = Math.max(0, t0); y < 160; y++) {
      const d = (y - t0) / 40;
      let c = PAL.sand[clamp(Math.round(5 - d * 3 + (fbm2(x * 0.1, y * 0.2, 2, 3) - 0.5) * 2 + (bayer(x, y) - 0.5)), 0, 6)];
      c = mix(c, hex('#2a5a66'), 0.35);
      bedBuf.data[y * W + x] = c;
    }
  }
  for (let cx = 0; cx < W; cx += 1024) {
    const w = Math.min(1024, W - cx);
    const piece = new PixelBuffer(w, 160);
    for (let y = 0; y < 160; y++) piece.data.set(bedBuf.data.subarray(y * W + cx, y * W + cx + w), y * w);
    main.add(new Prop({ ...bigFrame(r, piece), ax: 0, ay: 0 }, cx, 330, -3));
  }
  st.terrain.addGround(Array.from({ length: W / 8 + 1 }, (_, i) => [i * 8, seabed(i * 8)] as [number, number]));
  // rocks, sponges, near kelp
  scatter(main, 60, W, [40, 90], 72, seabed, g => (g.chance(0.4) ? F.paintRock(g.int(1, 999), g.int(24, 50), g.int(16, 30), PAL.stone, 0.3) : g.chance(0.6) ? S.paintSponge(g.int(1, 999)) : S.paintKelp(g.int(1, 999), g.int(100, 200))), 1.5, -1);
  // the dive boat on the surface (exit)
  main.add(new Custom(5, (rr, s) => {
    const bob = Math.sin(s.time * 1.1) * 1;
    rr.draw(props.rowboat, 90, SURF + 1 + bob, 1.4, 1.4, Math.sin(s.time) * 0.03);
  }));
  // surface line
  main.add(new Custom(90, (rr, s) => {
    for (let x = Math.floor(rr.visibleX0(4) / 4) * 4; x < rr.visibleX1(4); x += 4) {
      const y = SURF + Math.sin(x * 0.05 + s.time * 2) * 1.5;
      rr.fxDraw(A.dot2, x, y, 2, 0.6, 0, packColor(0.85, 1, 1, 1), 0.9, false);
    }
  }));
  // caustics on the seabed & light shafts from the surface
  if (!night) {
    const shafts: Shaft[] = Array.from({ length: 16 }, (_, i) => ({ x: i * 160 + rng.range(0, 80), w: rng.range(40, 80), a: 0.12, phase: i * 1.3 }));
    addShafts(st, main, shafts, [0.7, 1, 1], SURF, 380, tod === 'day' ? 1 : 0.6);
    main.add(new Custom(1, (rr, s) => {
      for (let x = Math.floor(rr.visibleX0(64) / 128) * 128; x < rr.visibleX1(64); x += 128) {
        const y = seabed(x + 64) - 14;
        rr.lightTex(A.caustics, x + 64 + Math.sin(s.time * 0.7 + x) * 6, y, 1.1, 0.35, 0, packColor(0.6, 1, 1, 1), 0.9 + Math.sin(s.time * 1.3 + x) * 0.2);
      }
    }));
  }
  // bioluminescent plankton at night
  main.add(new Custom(99, () => {}, (dt, s) => {
    if (rand.chance(dt * 4)) main.particles.spawn({ frame: A.bubble, x: s.cam.x + rand.range(-240, 240), y: s.cam.y + 150, vy: -rand.range(15, 30), life: 8, size: rand.range(0.3, 0.7), wobble: 5, color: [0.8, 1, 1], alpha: 0.7, alpha1: 0.3 });
    if (night && rand.chance(dt * 8)) main.glowParticles.spawn({ frame: A.dot, x: s.cam.x + rand.range(-260, 260), y: s.cam.y + rand.range(-130, 130), life: rand.range(3, 6), color: [0.4, 1, 0.9], alpha: 1, alpha1: 0, fadeIn: 0.4, glow: true, intensity: 3, wobble: 6 });
    if (!night && rand.chance(dt * 3)) main.particles.spawn({ frame: A.dot, x: s.cam.x + rand.range(-260, 260), y: s.cam.y + rand.range(-130, 130), life: 6, vx: rand.range(-2, 2), color: [0.8, 0.95, 0.9], alpha: 0.6, alpha1: 0, fadeIn: 0.3, wobble: 4 });
  }));
  // glassfin shoals (ambient boids)
  const shoal: Fish[] = Array.from({ length: 80 }, () => { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()); return { x: 900 + rng.range(-80, 80), y: 200 + rng.range(-30, 30), vx: rng.range(-20, 20), vy: 0, ph: rng.range(0, 6), ox: Math.cos(a) * d * 60, oy: Math.sin(a) * d * 26 }; });
  let shoalCx = 900, shoalCy = 200;
  main.add(new Custom(25, (rr, s) => {
    for (const f of shoal) {
      const dir = f.vx >= 0 ? 1 : -1;
      const sh = Math.sin(s.time * 3 + f.ph) > 0.7;
      rr.rect(f.x - dir * 2, f.y, 4, 1, sh ? packColor(0.95, 1, 1, 1) : packColor(0.6, 0.85, 0.9, 1));
      rr.rect(f.x - dir * 3, f.y - 0.5, 1, 2, packColor(0.5, 0.75, 0.85, 1));
    }
  }, (dt, s) => {
    const lev = sc.creatures.find(c => c.id === 'leviathan');
    shoalCx = lerp(shoalCx, 900 + Math.sin(s.time * 0.05) * 600, dt * 0.2);
    shoalCy = lerp(shoalCy, 200 + Math.sin(s.time * 0.13) * 60, dt * 0.2);
    for (const f of shoal) {
      let ax = (shoalCx + f.ox - f.x) * 0.9 + Math.sin(s.time * 1.3 + f.ph) * 14, ay = (shoalCy + f.oy + Math.sin(s.time * 0.8 + f.ph) * 6 - f.y) * 1.2;
      const p = sc.player;
      const dp = Math.hypot(f.x - p.x, f.y - (p.y - 10));
      if (dp < 50) { ax += (f.x - p.x) * 8; ay += (f.y - p.y) * 8; }
      if (lev) { const d = Math.hypot(f.x - lev.x, f.y - lev.y); if (d < 90) { ax += (f.x - lev.x) * 10; ay += (f.y - lev.y) * 10; } }
      f.vx = clamp(f.vx + ax * dt, -60, 60);
      f.vy = clamp(f.vy + ay * dt, -40, 40);
      f.vx *= 0.98;
      f.vy *= 0.96;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
  }));
  // foreground kelp
  const fg = st.addLayer('fg', 1.3, 0, 0.7, 0, 1.3);
  const fs = layerSpan(st, 1.3, 120);
  scatter(fg, fs.x0, fs.x0 + fs.w, [60, 150], 73, () => 520, g => S.paintKelp(g.int(1, 999), g.int(200, 320)), 3);
  void shade;
  const hides = [300, 700, 1150, 1600, 2050].map(x => ({ x, w: 40, y: seabed(x), cover: 0.7 }));
  return {
    hides,
    clues: [],
    spawns: [{ species: 'leviathan', n: 1, make: () => new Leviathan(1400, 240, -1) }],
    jeepX: 100,
    spawnX: 160,
    waterY: SURF,
    camY: 150,
    followY: true,
    underwater: true,
    noJeep: true,
    exitLabel: 'Climb back into the boat',
    ambience: 'underwater',
    music: 'wonder',
    onUpdate: (s) => leviathanReveal(s),
  };
}

async function leviathanReveal(sc: ExpeditionScene) {
  if (game.save.flags.levScene || sc.cutscene) return;
  const lev = sc.creatures.find(c => c.id === 'leviathan');
  if (!lev || Math.abs(lev.x - sc.player.x) > 260) return;
  setFlag('levScene');
  sc.cutscene = true;
  game.ui.letterbox(true);
  audio.setMusic('wonder');
  sc.st.shake(1.5, 1.5);
  await game.ui.say([
    { who: 'otis', text: '...', expr: 'wow' },
    { who: 'otis', text: 'It’s the length of a *ship*. Those red fronds behind its head — they’re gills. It breathes the water.', expr: 'wow' },
    { who: 'otis', text: 'Steady, Otis. Slow and calm. Get close, get the gills in frame.', expr: 'neutral' },
  ]);
  game.ui.letterbox(false);
  sc.cutscene = false;
  void aid;
}
