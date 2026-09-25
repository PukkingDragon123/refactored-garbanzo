// Open-sea stages for the title screen and the opening voyage: antarctic night, storm, dawn reveal.

import { game } from '../game';
import { Stage } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { addSky, addClouds, addFarImage, layerSpan } from '../../world/scenery';
import { local, props, chars, A } from '../assets';
import { bigFrame } from '../../gfx/atlas';
import { packColor } from '../../gfx/renderer';
import type { Renderer } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import * as L from '../../art/landscape';
import * as F from '../../art/flora';
import { hex, mix, shade } from '../../art/color';
import { PAL } from '../../art/palettes';
import { timePreset, TimeOfDay } from '../../world/timeofday';
import { Rng, rand, bayer, clamp, fbm2 } from '../../core/math';
import { SerpentPainter, followSpine, makeSpine } from '../../art/serpent';
import { SERPENT_LOOKS } from '../../art/fauna';
import { DynamicSprite } from '../../gfx/atlas';

export type SeaMode = 'antarctic' | 'storm' | 'dawn' | 'title';
export const SEA_Y = 206;

function paintIceberg(seed: number, w: number, h: number) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const pts: number[] = [0, h];
  const n = rng.int(4, 7);
  for (let i = 0; i <= n; i++) pts.push((i / n) * w + rng.range(-w * 0.05, w * 0.05), h - rng.range(h * 0.4, h) * Math.sin((i / n) * Math.PI * 0.9 + 0.15));
  pts.push(w, h);
  b.polyFn(pts, (x, y) => {
    const facet = Math.floor((x + y * 0.6) / (w / 5)) % 2;
    const l = (facet ? 0.2 : -0.15) + (1 - y / h) * 0.3 + (bayer(x, y) - 0.5) * 0.2;
    return l > 0.25 ? hex('#f4fbff') : l > 0 ? hex('#cfe6f4') : l > -0.2 ? hex('#9fc6e0') : hex('#6f9ec2');
  });
  return b;
}

export interface SeaStage {
  st: Stage;
  ship: { x: number; y: number; rock: number; heave: number; visible: boolean; crew: boolean };
  lightning: number;
  fin: { active: boolean; x: number; t: number };
  glider: { active: boolean; t: number };
}

export function buildSea(mode: SeaMode): SeaStage {
  const r = game.r;
  const tod: TimeOfDay = mode === 'antarctic' || mode === 'storm' ? 'night' : 'dawn';
  const st = new Stage(tod, { shade: 0 });
  st.minX = 0;
  st.maxX = 1400;
  st.waterY = SEA_Y;
  const S: SeaStage = { st, ship: { x: 700, y: SEA_Y + 4, rock: 0, heave: 0, visible: true, crew: true }, lightning: 0, fin: { active: false, x: 0, t: 0 }, glider: { active: false, t: 0 } };
  const e = st.preset.env;
  if (mode === 'antarctic') {
    st.preset.sky = [{ t: 0, c: hex('#020612') }, { t: 0.6, c: hex('#0a1a38') }, { t: 1, c: hex('#1e3a5c') }];
    e.ambientTop = [0.35, 0.45, 0.65];
    e.ambientBottom = [0.22, 0.3, 0.45];
    e.fogTop = [0.06, 0.12, 0.22];
    e.fogBottom = [0.14, 0.24, 0.34];
    e.waterTint = [0.6, 0.8, 1];
  } else if (mode === 'storm') {
    st.preset.sky = [{ t: 0, c: hex('#05070a') }, { t: 0.6, c: hex('#141a20') }, { t: 1, c: hex('#262e36') }];
    st.preset.stars = 0;
    st.preset.moon = false;
    st.preset.sunPos = [2, 2];
    e.ambientTop = [0.3, 0.33, 0.38];
    e.ambientBottom = [0.16, 0.18, 0.22];
    e.fogTop = [0.08, 0.1, 0.12];
    e.fogBottom = [0.12, 0.14, 0.17];
    e.saturation = 0.7;
    e.waterTint = [0.55, 0.6, 0.65];
  } else {
    st.preset = timePreset('dawn');
    st.preset.sunPos = [0.82, 0.62];
  }
  addSky(st, r);
  if (mode === 'antarctic') {
    const au = st.addLayer('aurora', 0.02, 0, 0, 1, 0.02);
    const span = layerSpan(st, 0.02, 60);
    const aurF = bigFrame(r, L.paintAurora(span.w, 120, 3));
    au.add(new Custom(0, (rr, s) => rr.fxDraw(aurF, span.x0, 0, 1, 1, 0, packColor(0.6, 1, 0.8, 1), 0.55 + Math.sin(s.time * 0.5) * 0.2, true)));
  }
  if (mode !== 'storm') addClouds(st, r, 0.03, 20, 110, 5, 71, 0.1);
  else {
    // heavy storm clouds
    const cl = st.addLayer('storm', 0.05, 0.1, 0, 0.5, 0.05);
    const span = layerSpan(st, 0.05, 200);
    const ramp = [hex('#07090c'), hex('#12161c'), hex('#1c222a'), hex('#2a323c')];
    const fr = Array.from({ length: 4 }, (_, i) => bigFrame(r, L.paintCloud(80 + i, 220, 60, ramp, -1, 0.8)));
    cl.add(new Custom(0, (rr, s) => {
      for (let i = 0; i < 9; i++) {
        const x = span.x0 + ((i * 190 + s.time * 30) % span.w);
        rr.draw(fr[i % 4], x - 110, -10 + (i % 3) * 40);
      }
    }));
  }
  if (mode === 'antarctic') {
    const ice = st.addLayer('ice', 0.25, 0.35, 0.2, 0, 0.25);
    const span = layerSpan(st, 0.25);
    const rng = new Rng(9);
    for (let x = span.x0; x < span.x0 + span.w; x += rng.range(80, 220)) {
      const w = rng.range(40, 120), h = rng.range(20, 60);
      ice.add(new Prop({ ...local.add('ice' + x, paintIceberg(rng.int(1, 999), w, h), w / 2, h) }, x, 202));
    }
    const ice2 = st.addLayer('ice2', 0.6, 0.12, 0.4, 0, 0.6);
    const sp2 = layerSpan(st, 0.6);
    for (let x = sp2.x0; x < sp2.x0 + sp2.w; x += rng.range(260, 500)) {
      const w = rng.range(70, 160), h = rng.range(40, 90);
      ice2.add(new Prop({ ...local.add('iceb' + x, paintIceberg(rng.int(1, 999), w, h), w / 2, h) }, x, 208));
    }
  }
  if (mode === 'dawn' || mode === 'title') {
    // the continent of Zealandia rising from the sea
    addFarImage(st, r, 'mtn', 0.06, 0.5, w => L.paintRidge(w, 170, { seed: 5, base: 168, amp: 120, freq: 0.006, body: hex('#58698c'), lit: hex('#8a8aac'), shadow: hex('#435070'), snow: hex('#f0eef4'), snowLine: 60, fogTo: hex('#b8a8c0'), fogStart: 110, peaks: [{ x: w * 0.55, h: 160, w: 120, cone: true }], sharp: 0.7 }), 40);
    addFarImage(st, r, 'coast', 0.14, 0.42, w => {
      const b = L.paintRidge(w, 140, { seed: 6, base: 138, amp: 70, freq: 0.01, body: hex('#34584c'), lit: hex('#4c7460'), shadow: hex('#284638'), fogTo: hex('#8fa89a'), fogStart: 110, sharp: 0.35, gullies: 0.5 });
      // waterfalls tumbling off the headland
      for (const fx of [w * 0.3, w * 0.64]) for (let y = 40; y < 130; y++) for (let k = 0; k < 3; k++) b.set(fx + k + Math.sin(y * 0.2) * 0.4, y, k === 1 ? hex('#f4ffff') : hex('#c8e4e8'));
      return b;
    }, 70);
    addFarImage(st, r, 'forest', 0.22, 0.3, w => L.paintTreeline(w, 120, { seed: 7, base: 100, amp: 26, ramp: ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'].map(h => hex(h)), rMin: 8, rMax: 16, fern: 0.8, emergent: 0.5, palms: 0.4 }), 100);
    const mist = st.addLayer('mist', 0.3, 0.2, 0, 0.4, 0.3);
    const ms = layerSpan(st, 0.3, 100);
    mist.add(new Prop({ ...bigFrame(r, L.paintMist(ms.w, 40, hex('#f4dcd0'), 4, 0.9)), ax: 0, ay: 0 }, ms.x0, 180));
  }
  // --- the sea itself (main plane)
  const main = st.addLayer('main', 1, 0, 1, 0);
  const deep = mode === 'dawn' || mode === 'title' ? [0.16, 0.24, 0.36] : mode === 'storm' ? [0.06, 0.08, 0.1] : [0.04, 0.1, 0.18];
  main.add(new Custom(-2, (rr, s) => {
    const amp = mode === 'storm' ? 7 : 1.5;
    rr.water(0.85, mode === 'storm' ? 3 : 1.4, 1);
    const x0 = Math.floor(rr.visibleX0(8) / 4) * 4, x1 = rr.visibleX1(8);
    for (let x = x0; x < x1; x += 4) {
      const y = SEA_Y + Math.sin(x * 0.02 + s.time * 1.4) * amp + Math.sin(x * 0.053 - s.time * 2.1) * amp * 0.5;
      rr.rect(x, y, 4, 120, packColor(deep[0], deep[1], deep[2], 1));
    }
    rr.water(0);
    // foam crests
    for (let x = x0; x < x1; x += 6) {
      const ph = Math.sin(x * 0.02 + s.time * 1.4);
      if (ph > (mode === 'storm' ? 0.3 : 0.85)) rr.fxDraw(A.dot2, x, SEA_Y + ph * amp - 1, 2, 0.6, 0, packColor(0.9, 0.95, 1, 1), 0.8, false);
    }
  }));
  // the ship with crew on deck
  const ship = props.shipBig;
  main.add(new Custom(10, (rr, s) => {
    const sh = S.ship;
    if (!sh.visible) return;
    const bob = Math.sin(s.time * 0.9) * (mode === 'storm' ? 6 : 1.2) + sh.heave;
    const rot = Math.sin(s.time * 0.7) * (mode === 'storm' ? 0.08 : 0.012) + sh.rock;
    rr.draw(ship, sh.x, sh.y + bob, 1, 1, rot);
    if (sh.crew) {
      const cap = chars.captain.idle[Math.floor(s.time * 2) % 4], otis = chars.otis.idle[Math.floor(s.time * 2.2) % 4];
      const deckY = sh.y + bob - 52;
      rr.draw(cap, sh.x - 30 + Math.sin(rot) * -52, deckY + Math.sin(rot) * -30, 1, 1, rot);
      rr.draw(otis, sh.x - 58 + Math.sin(rot) * -52, deckY + Math.sin(rot) * -58 + 1, -1, 1, rot);
    }
    // ship lights
    if (mode !== 'dawn' && mode !== 'title') {
      const lx = sh.x + 40, ly = sh.y + bob - 70;
      rr.light(lx, ly, 70, 1, 0.85, 0.6, 0.35);
      rr.fxDraw(A.glow, sh.x + 36, sh.y + bob - 104, 0.4, 0.4, 0, packColor(1, 0.9, 0.6, 1), 3);
      rr.fxDraw(A.glow, sh.x - 140, sh.y + bob - 70, 0.25, 0.25, 0, packColor(1, 0.2, 0.2, 1), 3);
    }
  }));
  // Finned Leviathan fin arcing through the water (dawn / title)
  const finLook = SERPENT_LOOKS.leviathan;
  const painter = new SerpentPainter({ ...finLook, length: 360, radius: 11, dorsalFin: { ...finLook.dorsalFin!, h: 9 } });
  const spr = new DynamicSprite(r, 480, 160, 0, 0);
  const pts = makeSpine(0, 0, 1, 360, 3);
  main.add(new Custom(8, (rr, s) => {
    const f = S.fin;
    if (!f.active) return;
    f.t += 1 / 60;
    const k = f.t / 9;
    if (k > 1) { f.active = false; return; }
    const hx = f.x + k * 700;
    pts[0][0] = hx;
    pts[0][1] = SEA_Y + 16 - Math.sin(k * Math.PI) * 26;
    followSpine(pts, 3, 0.2);
    for (let i = 1; i < pts.length; i++) pts[i][1] = SEA_Y + 18 - Math.sin(Math.max(0, k * Math.PI - i * 0.012)) * 24 + Math.sin(i * 0.05 + s.time) * 2;
    const ox = Math.floor(hx - 420), oy = SEA_Y - 60;
    painter.paint(spr.buf, { pts, facing: 1, jaw: 0, tongue: 0, legPhase: 0, legLift: 0, grounded: false, groundY: () => 999, flatten: 0, submerge: SEA_Y + 1 }, ox, oy, s.time);
    spr.upload();
    rr.draw(spr.frame, ox, oy);
  }));
  // Skyribbon gliding overhead
  const gl = new SerpentPainter(SERPENT_LOOKS.skyribbon);
  const gspr = new DynamicSprite(r, 160, 100, 0, 0);
  const gpts = makeSpine(0, 0, 1, 60, 1.5);
  main.add(new Custom(30, (rr, s) => {
    const g = S.glider;
    if (!g.active) return;
    g.t += 1 / 60;
    const k = g.t / 5;
    if (k > 1) { g.active = false; return; }
    const x = s.cam.x - 280 + k * 560, y = 60 + Math.sin(k * Math.PI) * 50;
    gpts[0][0] = x;
    gpts[0][1] = y;
    followSpine(gpts, 1.5, 0.1);
    for (let i = 2; i < gpts.length; i++) gpts[i][1] += Math.sin(s.time * 9 - i * 0.3) * 0.9;
    gl.paint(gspr.buf, { pts: gpts, facing: 1, jaw: 0, tongue: 0, legPhase: 0, legLift: 0, grounded: false, groundY: () => 999, flatten: 1 }, Math.floor(x - 110), Math.floor(y - 50), s.time);
    gspr.upload();
    rr.draw(gspr.frame, Math.floor(x - 110), Math.floor(y - 50));
  }));
  // weather particles
  main.add(new Custom(99, () => {}, (dt, s) => {
    if (mode === 'antarctic' && rand.chance(dt * 30)) main.particles.spawn({ frame: A.dot, x: s.cam.x + rand.range(-280, 300), y: s.cam.y - 150, vx: -12, vy: rand.range(18, 30), life: 9, wobble: 8, color: [0.9, 0.95, 1], alpha: 0.9, alpha1: 0.9, floorY: SEA_Y });
    if (mode === 'storm') for (let i = 0; i < 6; i++) if (rand.chance(dt * 40)) main.particles.spawn({ frame: A.drop, x: s.cam.x + rand.range(-300, 330), y: s.cam.y - 150, vx: -60, vy: 320, rot: 0.18, life: 1.2, color: [0.7, 0.75, 0.8], alpha: 0.7, alpha1: 0.7, floorY: SEA_Y });
    if (mode === 'dawn' && rand.chance(dt * 0.6)) main.particles.spawn({ frame: A.soft, x: s.cam.x + rand.range(-280, 280), y: SEA_Y - 6, vx: 4, life: 6, size: 1, size1: 2.4, color: [1, 0.9, 0.85], alpha: 0.25, alpha1: 0 });
  }));
  // lightning
  const bolts: { pts: [number, number][]; t: number }[] = [];
  main.add(new Custom(200, (rr: Renderer) => {
    for (const b of bolts) {
      const a = Math.max(0, 1 - b.t * 3);
      for (let i = 1; i < b.pts.length; i++) {
        const [x0, y0] = b.pts[i - 1], [x1, y1] = b.pts[i];
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let k = 0; k < n; k++) rr.fxDraw(A.dot, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 1.5, 1.5, 0, packColor(0.85, 0.9, 1, 1), 3 * a);
      }
    }
  }, (dt, s) => {
    for (const b of bolts) b.t += dt;
    while (bolts.length && bolts[0].t > 0.5) bolts.shift();
    if (S.lightning > 0) {
      const x = s.cam.x + rand.range(-200, 200);
      const pts: [number, number][] = [[x, -10]];
      let px = x, py = -10;
      while (py < SEA_Y - 20) { px += rand.range(-18, 18); py += rand.range(12, 26); pts.push([px, py]); }
      bolts.push({ pts, t: 0 });
      S.lightning = 0;
    }
  }));
  st.envHook = (env) => {
    const b = bolts.length ? Math.max(0, 1 - bolts[bolts.length - 1].t * 3) : 0;
    if (b > 0) {
      env.ambientTop = [env.ambientTop[0] + b * 0.9, env.ambientTop[1] + b * 0.9, env.ambientTop[2] + b * 1.1];
      env.ambientBottom = [env.ambientBottom[0] + b * 0.6, env.ambientBottom[1] + b * 0.6, env.ambientBottom[2] + b * 0.7];
      env.exposure = 1 + b * 0.25;
    }
  };
  void F; void PAL; void mix; void shade; void clamp; void fbm2;
  st.cam.x = st.cam.tx = 700;
  st.cam.y = st.cam.ty = 135;
  return S;
}
