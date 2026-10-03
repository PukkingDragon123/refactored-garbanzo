// V11: Ngā Puke Kōhatu, the Rocky Hills, above the bush line north-east of Thunder Falls (atlas id
// 'hills'). A V10 site (the expedition runtime, the map, finds, events and the predators attach as in
// every field site) with its own big-sky dressing: snow ranges fading into the haze behind rank after
// rank of golden tussock hills, granite tors you can scramble up, a scree slope that slides underfoot,
// the tarn, a greywacke bluff with an overhang (the hunters' camp, left empty: HILLS_SPOTS.huntersCamp
// is the anchor other modules use), the ridge top with its long view, mist pouring over the crest,
// wind streaks and gusts that bend the tussock flat. Geometry: src/game/v11/hills/layout.ts; art:
// src/art/v11/hills/*; effects: src/game/v11/hills/fx.ts; its wildlife: src/game/v11/species-hills.ts.

import type { Site10 } from './kit';
import { sprite, Rng, propAt } from './kit';
import { arrive10 } from './kit';
import type { FieldScene } from '../scenes/field';
import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { audio } from '../../core/audio';
import type { Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { layerSpan, addSky, addClouds } from '../../world/scenery';
import { PixelBuffer } from '../../art/pixel';
import * as Lsc from '../../art/landscape';
import { hex, mix } from '../../art/color';
import type { Sprite } from '../../art/jungle-core';
import type { Interactable } from '../../world/npc';
import { clamp, rand } from '../../core/math';
import { HP } from '../../art/v11/hills/kit';
import { paintTor, paintBoulder, paintScreeStone, paintBluff } from '../../art/v11/hills/rocks';
import type { TorArt } from '../../art/v11/hills/rocks';
import { paintTussock, paintSpaniard, paintDaisy, paintHebe, paintWindTree, paintCushion } from '../../art/v11/hills/plants';
import { paintFireRing, paintLeanTo, paintDryingRack, paintWoodpile } from '../../art/v11/hills/camp';
import { paintHillBand, paintHillsGround } from '../../art/v11/hills/land';
import { fgPlant, soften } from '../../art/v11/forest/fg';
import { GroundCover } from '../v11/forest/fx';
import type { Mover } from '../v11/forest/fx';
import { HILLS, HSPOT, TORS, BLUFF, SCREE, TARN, hgroundY, hzoneAt, hzoneName, screeAt, persp, tarnAt } from '../v11/hills/layout';
import { Gusts, WindStreaks, SeedDrift, MistBank, RidgePour, CloudShadows, TarnGlints } from '../v11/hills/fx';
import { findArt } from '../v10/finds';
import '../v11/hills/items';

const W = HILLS.W;
const G = { y: hgroundY };

/** a screen-y (at the west end's camera height) to a far layer's world y */
const fy = (p: number, sy: number) => sy + 60 * p;

/**
 * Named anchors for other modules. The hunters' camp under the overhang is left empty for the
 * hunters (another module adds them via onFieldEnter when the location is 'hills'): stand them by
 * the fire ring, sit them in the lean-to, hang the day's meat on the rack. All world coordinates on
 * the gameplay plane (y = the walk line there).
 */
export const HILLS_SPOTS = {
  enter: { x: HSPOT.enter, y: hgroundY(HSPOT.enter) },
  huntersCamp: {
    x: HSPOT.fire, y: hgroundY(HSPOT.fire),
    fire: { x: HSPOT.fire, y: hgroundY(HSPOT.fire) },
    leanTo: { x: HSPOT.leanTo, y: hgroundY(HSPOT.leanTo) },
    rack: { x: HSPOT.rack, y: hgroundY(HSPOT.rack) },
    /** where people stand / sit around the fire (world x) */
    seats: [HSPOT.fire - 34, HSPOT.fire + 30, HSPOT.leanTo + 4],
    /** the shelter's mouth (world x range) */
    shelter: [BLUFF.mouthX, BLUFF.mouthX + BLUFF.mouthW] as [number, number],
  },
  tarn: { x: HSPOT.tarn, y: hgroundY(HSPOT.tarn) },
  torTop: { x: HSPOT.torTop, y: 0 },
  lookout: { x: HSPOT.lookout, y: hgroundY(HSPOT.lookout) },
  gorge: { x: HSPOT.gorge, y: hgroundY(HSPOT.gorge) },
};

/** add a wide buffer to a layer as <= 2048 px props (top-left at x, y) */
function addWide(layer: Layer, buf: PixelBuffer, x: number, y: number, z = 0, tint?: number) {
  const CH = 2048;
  for (let cx = 0; cx < buf.w; cx += CH) {
    const w = Math.min(CH, buf.w - cx);
    let sub = buf;
    if (buf.w > CH) {
      sub = new PixelBuffer(w, buf.h);
      for (let yy = 0; yy < buf.h; yy++) sub.data.set(buf.data.subarray(yy * buf.w + cx, yy * buf.w + cx + w), yy * w);
    }
    layer.add(new Prop({ ...bigFrame(game.r, sub), ax: 0, ay: 0 }, x + cx, y, z, { tint }));
  }
}
function frameOf(key: string, gen: () => Sprite): Frame & { sprite: Sprite } {
  const c = sprite('hl:' + key, gen)!;
  return Object.assign(c.f, { sprite: c.s });
}

// ------------------------------------------------------------------ the camp fire (unlit until someone lights it)
let campFire: { on: boolean } | null = null;
/** light (or put out) the hunters' fire in the current hills scene (for the hunters' module) */
export function setHuntersFire(on: boolean) { if (campFire) campFire.on = on; }

function build(f: FieldScene) {
  const st = f.st, r = game.r;
  const rng = new Rng(7070);
  st.minX = 0; st.maxX = W; st.minY = HILLS.minY; st.maxY = HILLS.maxY;
  const fog = hex('#a9bccb');

  // ---------------------------------------------------------------- sky and the far ranges
  addSky(st, r, { glowK: 0.5 });
  addClouds(st, r, 0.03, -10, 90, 10, 71, 0.08);
  const range = (name: string, p: number, sy: number, o: Partial<Lsc.RidgeOpts> & { seed: number; amp: number; freq: number }, fogK: number, cols: [string, string, string]) => {
    const span = layerSpan(st, p, 60);
    const h = 230;
    const buf = Lsc.paintRidge(span.w, h, {
      base: h - 20, sharp: 0.7, body: hex(cols[0]), lit: hex(cols[1]), shadow: hex(cols[2]), fogTo: fog, fogStart: 120, gullies: 1.4, ...o,
    } as Lsc.RidgeOpts);
    const lay = st.addLayer(name, p, fogK, 0.05, 0, p);
    lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, fy(p, sy) - h + 20));
    return lay;
  };
  // the snow ranges far away, then the nearer grey-blue ones
  range('alps', 0.045, 196, { seed: 81, amp: 150, freq: 0.006, snow: hex('#eef3f8'), snowLine: 92 }, 0.55, ['#6f8296', '#92a6ba', '#56687e']);
  range('range2', 0.09, 208, { seed: 82, amp: 92, freq: 0.0085, snow: hex('#e2e9f0'), snowLine: 150 }, 0.42, ['#5e7286', '#7e93a6', '#485a6e']);
  // mist lying in the far valleys
  const valleyMist = st.addLayer('vmist', 0.11, 0.35, 0, 0, 0.11);
  valleyMist.add(new MistBank(0, fy(0.11, 186), 3, 0.5, 0, 13, 760, 80, '#e6edf2'));
  // the tussock ranges, rank after rank
  const band = (name: string, p: number, sy: number, o: { seed: number; amp: number; freq: number; k: number; haze: number; bush?: number; rock?: number; rise?: number; red?: number }, fogK: number) => {
    const span = layerSpan(st, p, 60);
    const H = 230;
    const base = 120;
    const rise = o.rise ?? 0;
    const buf = paintHillBand({ W: span.w, H, seed: o.seed, base, amp: o.amp, freq: o.freq, k: o.k, fog, haze: o.haze, bush: o.bush, rock: o.rock, red: o.red,
      rise: rise ? (x => rise * clamp((span.x0 + x) / p / W - 0.3, 0, 1)) : undefined });
    const lay = st.addLayer(name, p, fogK, 0.25 + o.k * 0.3, 0, p);
    addWide(lay, buf, span.x0, fy(p, sy) - base);
    return lay;
  };
  band('hills4', 0.16, 204, { seed: 91, amp: 58, freq: 0.006, k: 0.1, haze: 0.3, bush: 0.6, rock: 0.3, red: 0.15 }, 0.2);
  const h3 = band('hills3', 0.26, 216, { seed: 92, amp: 64, freq: 0.0055, k: 0.35, haze: 0.18, bush: 0.75, rock: 0.5, red: 0.2 }, 0.13);
  h3.add(new MistBank(5, fy(0.26, 186), 7, 0.3, 0, 17, 700, 90, '#e8eef2', x => 0.5 + 0.5 * clamp(x / (W * 0.26) - 0.2)));
  const h2 = band('hills2', 0.42, 230, { seed: 93, amp: 62, freq: 0.0048, k: 0.6, haze: 0.08, bush: 0.5, rock: 0.7, rise: 40, red: 0.3 }, 0.06);
  h2.add(new MistBank(5, fy(0.42, 200), 12, 0.2, 0, 19, 640, 90, '#eef2f4', x => clamp(x / (W * 0.42) - 0.25) * 1.4));
  band('hills1', 0.62, 244, { seed: 94, amp: 56, freq: 0.0042, k: 0.9, haze: 0.03, bush: 0.25, rock: 0.85, rise: 70, red: 0.3 }, 0.03);

  // ---------------------------------------------------------------- the near-back: the slope behind the walk line
  const pb = 0.84;
  const back = st.addLayer('back', pb, 0.03, 0.55, 0, pb);
  {
    // tors, boulders and wind-bent trees just behind the walk line (parallax-placed by world x)
    const bx = (x: number) => x * pb;
    const by = (x: number) => hgroundY(x) - 16 * (1 - pb) * 0 - (1 - pb) * 60;
    for (let x = 60; x < W + 200; x += rng.range(140, 260)) {
      const z = hzoneAt(x), k = rng.next();
      if (z === 'bush' && k < 0.6) {
        const v = rng.int(0, 2);
        const fr = frameOf(`bt:${v}`, () => paintWindTree(300 + v, 70 + v * 14, 90 + v * 16));
        back.add(new Prop(fr, bx(x), by(x) + 4, rng.next(), { sway: 0.12, tint: packColor(0.82, 0.86, 0.88, 1) }));
      } else if (k < 0.45) {
        const v = rng.int(0, 3);
        const fr = frameOf(`btor:${v}`, () => paintTor(400 + v, 70 + v * 18, 60 + v * 22, { moss: 0.2 }));
        back.add(new Prop(fr, bx(x), by(x) + 6, rng.next(), { tint: packColor(0.84, 0.87, 0.9, 1) }));
      } else {
        const v = rng.int(0, 3);
        const fr = frameOf(`bbo:${v}`, () => paintBoulder(420 + v, 30 + v * 10, 20 + v * 7));
        back.add(new Prop(fr, bx(x), by(x) + 4, rng.next(), { tint: packColor(0.84, 0.87, 0.9, 1) }));
      }
    }
    // a dense band of tussock along the slope's foot
    for (let x = 0; x < W + 200; x += rng.range(10, 22)) {
      const v = rng.int(0, 3), red = hzoneAt(x) === 'tors' ? rng.chance(0.3) : rng.chance(0.15);
      const fr = frameOf(`btu:${v}:${red ? 1 : 0}`, () => paintTussock(500 + v, 30 + v * 4, { red }));
      back.add(new Prop(fr, bx(x), by(x) + 6 + rng.range(0, 4), 2 + rng.next(), { sway: 0.7, flip: rng.chance(0.5), tint: packColor(0.86, 0.88, 0.9, 1) }));
    }
  }

  // ---------------------------------------------------------------- the gameplay plane
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  // the ground plane, with the tarn drawn again as reflective water
  const CH = 850;
  for (let x0 = 0; x0 < W; x0 += CH) {
    const w = Math.min(CH, W - x0);
    const ch = paintHillsGround(x0, w);
    const base = bigFrame(r, ch.base), wat = bigFrame(r, ch.water);
    const hasWater = x0 + w > TARN.x - TARN.rx && x0 < TARN.x + TARN.rx;
    main.add(new Custom(-10, rr => {
      if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
      rr.draw(base, x0, ch.y0);
      if (hasWater) { rr.water(0.7, 0.9, 0.7); rr.draw(wat, x0, ch.y0); rr.water(0); }
    }));
  }
  main.add(new TarnGlints());
  main.add(new CloudShadows());
  // the bluff and its overhang
  {
    const bw = BLUFF.x1 - BLUFF.x0;
    const gyMax = Math.max(...Array.from({ length: 40 }, (_, i) => hgroundY(BLUFF.x0 + (i / 39) * bw)));
    const bl = paintBluff(bw, BLUFF.h, 7300, { x: BLUFF.mouthX - BLUFF.x0, w: BLUFF.mouthW, h: BLUFF.mouthH });
    main.add(new Prop({ ...bigFrame(r, bl.buf), ax: 0, ay: bl.buf.h - 1 }, BLUFF.x0, gyMax + 3, -9));
    // cliff birds nest on its ledges
    for (const x of [2420, 2480, 2830, 2890, 2940]) f.pois.push({ kind: 'nest', x, y: gyMax - rng.range(120, 220) });
  }
  // the tors: the great tor can be scrambled up
  const torArt: TorArt[] = [];
  TORS.forEach(([x, w, h], i) => {
    const t = paintTor(600 + i * 7, w, h, { rows: i === 0 ? 3 : undefined, moss: 0.35 });
    torArt.push(t);
    const c = sprite(`hl:tor:${i}`, () => t);
    const gy = hgroundY(x);
    if (c) main.add(new Prop(c.f, x, gy + 6, -6));
    f.pois.push({ kind: 'rock', x, y: gy - h + 8 }, { kind: 'perch', x: x + 4, y: gy - h + 4 }, { kind: 'sun', x: x - w * 0.6, y: gy });
  });
  // the scramble up the great tor and the platform on its top
  {
    const [tx, , th] = TORS[0];
    const t = torArt[0];
    const gy = hgroundY(tx) + 6;
    const ox = tx - t.ax, oy = gy - t.ay;
    let minC = 1e9;
    for (let i = 0; i < t.crest.length; i++) if (t.crest[i] >= 0) minC = Math.min(minC, t.crest[i]);
    const pts: [number, number][] = [];
    for (let i = 0; i < t.crest.length; i += 3) if (t.crest[i] >= 0 && t.crest[i] < minC + 12) pts.push([ox + i, oy + t.crest[i] + 2]);
    if (pts.length >= 2) {
      const top = pts.map(p => p[1]);
      const ty = Math.min(...top) + 2;
      const plat: [number, number][] = [[pts[0][0] - 10, ty + 1], ...pts.map(([x, y]) => [x, Math.min(y, ty + 4)] as [number, number]), [pts[pts.length - 1][0] + 4, ty + 3]];
      st.terrain.addPlatform(plat, 'rock' as never);
      const cx = pts[0][0] - 6;
      st.terrain.addClimb(cx, ty, hgroundY(cx), 'vine');
      const ld = { x: cx, y0: ty, y1: hgroundY(cx) };
      HILLS_SPOTS.torTop.y = ty;
      (f.interact as Interactable[]).push({ x: cx, y: hgroundY(cx), w: 14, h: 18, label: 'Scramble up the tor <span style="opacity:.75">(hard going)</span>', standX: cx, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - hgroundY(cx)) < 12, action: () => f.climbLadder(ld, -1) });
      (f.interact as Interactable[]).push({ x: cx, y: ty, w: 14, h: 18, label: 'Climb back down', standX: cx, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - ty) < 12, action: () => f.climbLadder(ld, 1) });
      // hand- and footholds: a few lighter scuffs up the face
      main.add(new Custom(-5.9, rr => { for (let y = ty + 6; y < hgroundY(cx) - 4; y += 9) rr.rect(cx - 2 + ((y / 9) % 2) * 3, y, 2, 1, packColor(0.75, 0.72, 0.66, 0.6)); }));
      (HILLS_CLIMB as { x: number }).x = cx;
    }
    void th;
  }
  // boulders, big and small; the scree's loose stones
  for (const [x, w, h] of [[300, 46, 30], [700, 60, 36], [1080, 40, 26], [1660, 70, 44], [1990, 54, 34], [2290, 80, 50], [2500, 44, 30], [3040, 58, 36], [3370, 40, 28]] as const) {
    const c = propAt(f, `hl:b:${x}`, () => paintBoulder(x, w, h, { moss: hzoneAt(x) === 'bush' ? 0.7 : 0.25 }), x, hgroundY(x) + 5, -4);
    if (c) f.pois.push({ kind: 'rock', x, y: hgroundY(x) - h + 6 });
  }
  for (let x = SCREE.x0 - 30; x < SCREE.x1 + 30; x += rng.range(14, 40)) {
    const v = rng.int(0, 5), dd = rng.chance(0.5) ? rng.range(-2, 1) : rng.range(3, 12);
    propAt(f, `hl:sc:${v}`, () => paintScreeStone(800 + v, 5 + v * 1.4, 3 + (v % 3)), x, hgroundY(x) + dd, dd > 2 ? 59 : -1);
  }
  // the hunters' camp under the overhang (empty)
  {
    const cx = HSPOT.fire;
    propAt(f, 'hl:rack', () => paintDryingRack(901), HSPOT.rack, hgroundY(HSPOT.rack) - 2, -5.5);
    propAt(f, 'hl:leanto', () => paintLeanTo(902), HSPOT.leanTo, hgroundY(HSPOT.leanTo) - 3, -5.6);
    propAt(f, 'hl:wood', () => paintWoodpile(903), HSPOT.leanTo + 46, hgroundY(HSPOT.leanTo + 46) - 2, -5.4);
    propAt(f, 'hl:fire', () => paintFireRing(904), cx, hgroundY(cx) + 2, -2.5);
    campFire = { on: false };
    const cf = campFire;
    main.add(new Custom(-2.4, (rr, s) => {
      if (!cf.on) return;
      const gy = hgroundY(cx);
      const k = 0.8 + 0.2 * Math.sin(s.time * 13) * Math.sin(s.time * 7.3);
      rr.light(cx, gy - 14, 150, 1, 0.62, 0.3, 0.9 * k, 0.12);
      rr.fxDraw(A.glow, cx, gy - 6, 1.4, 1.1, 0, packColor(1, 0.55, 0.2, 1), 0.7 * k);
      for (let i = 0; i < 5; i++) rr.fxDraw(A.soft, cx - 6 + i * 3, gy - 4 - Math.abs(Math.sin(s.time * 9 + i)) * 7, 0.35, 0.7, 0, packColor(1, 0.75 - i * 0.08, 0.3, 1), 0.8);
    }, dt => {
      if (!cf.on) return;
      if (rand.chance(dt * 5)) main.particles.spawn({ frame: A.soft, x: cx + rand.range(-3, 3), y: hgroundY(cx) - 10, vx: f.st.wind * 6, vy: rand.range(-22, -12), life: rand.range(2, 3.5), color: [0.6, 0.6, 0.62], alpha: 0.3, alpha1: 0, size: 0.4, size1: 1.6 });
      if (rand.chance(dt * 3)) main.glowParticles.spawn({ frame: A.dot, x: cx + rand.range(-4, 4), y: hgroundY(cx) - 8, vx: rand.range(-8, 8) + f.st.wind * 10, vy: rand.range(-50, -25), life: rand.range(0.8, 1.6), color: [1, 0.6, 0.2], alpha: 1, alpha1: 0, glow: true, intensity: 2 });
    }));
    f.pois.push({ kind: 'den', x: cx + 40, y: hgroundY(cx + 40) });
  }
  // wind-bent beech at the bush line (on the walk line, behind)
  for (const [x, v] of [[60, 0], [250, 1], [430, 2], [600, 1]] as const) {
    const fr = frameOf(`wt:${v}`, () => paintWindTree(320 + v, 90 + v * 16, 120 + v * 20));
    main.add(new Prop(fr, x, hgroundY(x) + 4, -6.5, { sway: 0.1 }));
    f.pois.push({ kind: 'trunk', x, y: hgroundY(x), y1: hgroundY(x) - 80 }, { kind: 'branch', x: x + 30, y: hgroundY(x) - 70 });
  }

  // ---- the ground cover: tussock that bends away as you push through it, spaniard, daisies, hebe
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? a.facing * 40 : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const backCover = new GroundCover(-2.4, movers, () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx }));
  const frontCover = new GroundCover(58, movers, () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx }));
  main.add(backCover);
  main.add(frontCover);
  const tus = (red: boolean, size: number) => { const v = rng.int(0, 3); const s = Math.round(size / 4) * 4; return frameOf(`tu:${v}:${s}:${red ? 1 : 0}`, () => paintTussock(1000 + v * 7 + s, s, { red })); };
  const spn = (size: number) => { const v = rng.int(0, 2); const s = Math.round(size / 4) * 4; return frameOf(`sp:${v}:${s}`, () => paintSpaniard(1100 + v * 5 + s, s)); };
  const dsy = () => { const v = rng.int(0, 2); return frameOf(`ds:${v}`, () => paintDaisy(1200 + v, 16 + v * 3)); };
  const heb = () => { const v = rng.int(0, 2); return frameOf(`hb:${v}`, () => paintHebe(1300 + v, 30 + v * 8, 18 + v * 5)); };
  const cush = () => { const v = rng.int(0, 2); return frameOf(`cu:${v}`, () => paintCushion(1400 + v, 16 + v * 6)); };
  const near = (x: number, r: number) => Math.abs(x - HSPOT.fire) < 70 + r || Math.abs(x - HSPOT.leanTo) < 50 + r || Math.abs(x - HSPOT.rack) < 40 + r || Math.abs(x - (HILLS_CLIMB.x || -999)) < 18 + r;
  for (let x = 20; x < W - 10; x += rng.range(9, 20)) {
    const z = hzoneAt(x);
    if (near(x, 0)) continue;
    const dense = z === 'basin' ? 1.2 : z === 'scree' ? 0.35 : z === 'tors' ? 0.8 : z === 'bluff' ? 0.5 : z === 'ridge' ? 0.7 : 0.8;
    if (rng.next() > dense * 0.8) continue;
    const k = rng.next();
    const fr = z === 'bush' && k < 0.3 ? heb() : k < 0.12 ? spn(rng.range(22, 34)) : k < 0.2 ? dsy() : tus(rng.chance(z === 'tors' || z === 'ridge' ? 0.35 : 0.15), z === 'ridge' ? rng.range(18, 28) : rng.range(26, 42));
    backCover.add(fr, x, hgroundY(x) + 1, rng.chance(0.5));
  }
  for (let x = 20; x < W - 10; x += rng.range(20, 44)) {
    const z = hzoneAt(x);
    if (z === 'scree' && rng.chance(0.75)) continue;
    if (near(x, 10)) continue;
    const k = rng.next();
    const fr = k < 0.2 ? cush() : k < 0.32 ? dsy() : tus(rng.chance(0.2), rng.range(16, 24));
    frontCover.add(fr, x + rng.range(-4, 4), hgroundY(x) + rng.range(4, 9), rng.chance(0.5));
  }
  // hide spots: the thickest tussock
  for (const x of [380, 760, 1010, 1900, 2260, 3080]) {
    const s = sprite(`hl:hide:${x % 3}`, () => paintTussock(1500 + (x % 3), 48, { red: x % 2 === 0 }));
    const y = hgroundY(x) + 3;
    if (s) {
      main.add(new Prop(s.f, x, y, 66, { sway: 0.8 }));
      f.occluders.push({ mask: s.s.buf, x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x, y, w: 18 });
    HIDES.push({ x, w: 30, y, cover: 0.8 });
  }
  // the ground in front of the walk line, in depth: tussock, boulders, spaniard, daisies, stones
  const stones = [0, 1, 2, 3].map(i => frameOf(`fst:${i}`, () => paintScreeStone(1600 + i, 8 + i * 3, 5 + i * 2)));
  const bould = [0, 1].map(i => frameOf(`fbo:${i}`, () => paintBoulder(1610 + i, 34 + i * 18, 22 + i * 10)));
  for (let x = 30; x < W; x += rng.range(18, 40)) {
    const dd = rng.range(14, 160);
    const P = persp(dd);
    if (tarnAt(x, dd) > -0.15) continue;
    const z = hzoneAt(x), k = rng.next();
    const fr = z === 'scree' ? (k < 0.7 ? stones[rng.int(0, 3)] : k < 0.85 ? bould[0] : tus(false, 26))
      : k < 0.46 ? tus(rng.chance(0.25), rng.range(26, 46)) : k < 0.54 ? spn(rng.range(24, 34)) : k < 0.58 ? dsy() : k < 0.68 ? bould[rng.int(0, 1)] : k < 0.82 ? stones[rng.int(0, 3)] : z === 'bush' ? heb() : cush();
    const sc = 0.9 + (P - 1) * 0.22;
    main.add(new Prop(fr, x, hgroundY(x) + dd, 60 + dd * 0.02, { sway: k < 0.6 ? 0.6 : 0, flip: rng.chance(0.5), sx: sc, sy: sc }));
  }

  // ---- POIs for the wildlife
  for (const x of [560, 600, 640, 1020]) f.pois.push({ kind: 'burrow', x, y: hgroundY(x) });
  for (const x of [700, 900, 1700, 2200, 3100]) f.pois.push({ kind: 'leaves', x, y: hgroundY(x), amount: 30 });
  for (const x of [520, 980, 1880, 3020]) f.pois.push({ kind: 'flower', x, y: hgroundY(x) - 14 });
  for (const x of [820, 1500, 2400]) f.pois.push({ kind: 'soft', x, y: hgroundY(x) });
  for (const x of [1300, 3150]) f.pois.push({ kind: 'carrion', x, y: hgroundY(x), amount: 30 });
  f.pois.push({ kind: 'water', x: TARN.x, y: hgroundY(TARN.x), y1: hgroundY(TARN.x) + 10, w: TARN.rx * 0.6 });
  for (const x of [700, 1900, 2700, 3200]) f.sunspots.push({ x, w: 260 });

  // ---- light, air and wind
  const gust = new Gusts(0.65);
  main.add(gust);
  main.add(new SeedDrift(main, gust));
  main.add(new RidgePour(-7, 3000, 3420));
  GUST.k = 0; GUST.ref = gust;

  // ---------------------------------------------------------------- in front of the camera
  const pf = 1.3;
  const front = st.addLayer('front', pf, 0, 0.45, 0, pf);
  const dark = hex('#2a2418');
  for (let x = 160; x < W + 300; x += rng.range(170, 320)) {
    if (Math.abs(x - HSPOT.fire) < 160 || Math.abs(x - TORS[0][0]) < 120) continue;
    const k = rng.next(), v = rng.int(0, 2);
    const fr = k < 0.6 ? frameOf(`ftu:${v}`, () => soften(paintTussock(1700 + v, 86 + v * 12, { red: v === 1 }), 1, dark, 0.5))
      : k < 0.85 ? frameOf(`fsp:${v}`, () => soften(paintSpaniard(1710 + v, 70 + v * 8, { spike: false }), 1, dark, 0.5))
        : frameOf(`fbo:${v}`, () => soften(paintBoulder(1720 + v, 120 + v * 30, 60 + v * 14), 2, dark, 0.6));
    const X = x * pf, y = (hgroundY(x) + 150) + rng.range(4, 18), flip = rng.chance(0.5);
    front.add(new Prop(fr, X, y, rng.next(), { sway: k < 0.85 ? 0.5 : 0, flip }));
    f.occluders.push({ mask: fr.sprite.buf, x: X, y, ax: fr.sprite.ax, ay: fr.sprite.ay, sx: flip ? -1 : 1, sy: 1, p: pf, z: 0 });
  }
  const front2 = st.addLayer('front2', 1.65, 0, 0.3, 0, 1.65);
  for (let x = 500; x < W + 300; x += rng.range(700, 1200)) {
    if (Math.abs(x - HSPOT.fire) < 260) continue;
    const v = rng.int(0, 1);
    const fr = frameOf(`fn:${v}`, () => soften(paintTussock(1800 + v, 120, { red: v === 1 }), 3, dark, 0.75));
    front2.add(new Prop(fr, x * 1.65, hgroundY(x) + 190, 0, { sway: 0.4, flip: rng.chance(0.5) }));
  }
  // wind streaks fly across in front of everything
  const air = st.addLayer('wind', 1.08, 0, 0, 0.4, 1.08);
  air.add(new WindStreaks(gust));
  void fgPlant;

  // ---------------------------------------------------------------- terrain
  const pts: [number, number][] = [];
  for (let x = 0; x <= W; x += 6) pts.push([x, hgroundY(x)]);
  st.terrain.addGround(pts, 'ground');
  void mix; void HP;
}

const HILLS_CLIMB = { x: 0 };
const HIDES: { x: number; w: number; y: number; cover: number }[] = [];
const GUST: { k: number; ref: Gusts | null } = { k: 0, ref: null };

// ------------------------------------------------------------------ per-frame: the scree, the wind, the HUD
let placeKey = '';
let screeT = 0, slideT = 0;
function update(f: FieldScene, dt: number) {
  const p = f.player;
  if (!p) return;
  // the scree slides underfoot: standing still you creep downhill, going up is slow, loose stones trickle
  const sc = screeAt(p.x);
  const onFloor = p.onGround && Math.abs(p.y - hgroundY(p.x)) < 4 && p.state === 'normal';
  if (onFloor && sc > 0.05 && !f.cutscene) {
    const up = p.vx > 4;
    p.wadeK = up ? 1 - sc * 0.35 : 1;
    const slide = (up ? 4 : Math.abs(p.vx) < 4 ? 14 : 8) * sc;
    p.x -= slide * dt;
    p.y = hgroundY(p.x);
    slideT -= dt;
    if (slideT <= 0) {
      slideT = up ? rand.range(0.18, 0.35) : rand.range(0.4, 0.8);
      for (let i = 0; i < (up ? 3 : 1); i++) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-5, 5), y: p.y - 1, vx: rand.range(-50, -15), vy: rand.range(-30, -5), ay: 300, life: rand.range(0.5, 1), color: [0.5, 0.52, 0.55], alpha: 1, alpha1: 0.7, floorY: hgroundY(p.x - 20) + 1, onFloor: 'bounce' });
      if (up || rand.chance(0.3)) audio.play('rustle', { vol: up ? 0.22 : 0.1, pitch: rand.range(1.3, 1.7) });
    }
    // climbing the scree is tiring
    if (up) {
      screeT += dt * sc * 0.6;
      if (screeT >= 1) { screeT -= 1; void import('../v10/energy').then(m => m.spend(1, 'scree')); }
    }
  } else if (p.wadeK < 1 && sc <= 0.05 && p.state !== 'swim' && p.ground !== 'water') p.wadeK = 1;
  // the place label follows the zones
  const [n, sub] = hzoneName(p.x);
  const key = n + '|' + sub;
  if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  // the camera: a touch wider up here, following the climb
  const cam = f.st.cam;
  if (!cam.locked && !f.cam.active) cam.tzoom = cam.tzoom + (0.94 - cam.tzoom) * Math.min(1, dt * 2);
}

export const HILLS_SITE: Site10 = {
  id: 'hills', loc: 'hills', name: 'Ngā Puke Kōhatu', width: W, camY: 240, followY: true, minY: HILLS.minY, maxY: HILLS.maxY,
  spawnX: HSPOT.enter, exitX: HSPOT.exit, waterY: null, ambience: 'canopy', music: 'wonder', ground: 'grass',
  build(f) { HIDES.length = 0; build(f); },
  onUpdate: update,
  spawns: [
    { species: 'torhopper', n: [3, 6], x: [1640, 2360], herd: true, juveniles: 0.35, poi: 'rock', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'torhopper', n: [2, 3], x: [2960, 3360], herd: true, juveniles: 0.3, times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'galehawk', n: [1, 2], x: [600, 3300], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'monarch', n: [1, 1], x: [1200, 3300], medium: 'air', times: ['day'], chance: 0.45 },
    { species: 'cragauk', n: [3, 5], x: [2400, 2960], poi: 'nest', herd: true, juveniles: 0.25, times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'cragviper', n: [1, 1], x: [2400, 2960], poi: 'nest', times: ['day', 'dusk'], chance: 0.5 },
    { species: 'delver', n: [3, 5], x: [540, 1040], herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.85 },
    { species: 'shieldback', n: [1, 2], x: [500, 1100], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
    { species: 'strider', n: [1, 1], x: [60, 600], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
    { species: 'quillhog', n: [1, 1], x: [60, 700], times: ['dusk', 'night'], chance: 0.7 },
    { species: 'hunterbat', n: [1, 2], x: [2380, 2960], poi: 'nest', medium: 'trunk', times: ['dusk', 'night'], chance: 0.6 },
  ],
  insects: [
    { kind: 'butterfly', x: [500, 1200], y: [240, 290], n: 5, times: ['day'] },
    { kind: 'butterfly', x: [1700, 3300], y: [150, 200], n: 3, times: ['day'] },
    { kind: 'bee', x: [500, 1100], y: [260, 296], n: 4, times: ['day'] },
    { kind: 'cicada', x: [300, 1100], y: [230, 290], n: 3, times: ['day'] },
    { kind: 'skymoth', x: [100, 2900], y: [160, 280], n: 4, times: ['dusk', 'night'] },
    { kind: 'weta', x: [2500, 2800], y: [196, 206], n: 3, times: ['dusk', 'night'] },
  ],
  onEnter: async f => {
    for (const h of HIDES) if (!f.player.hides.some(q => q.x === h.x)) f.player.hides.push(h);
    const c = f.st.cam;
    c.y = c.ty = f.player.y - 60;
    c.zoom = c.tzoom = 0.94;
    placeKey = '';
    audio.setAmbience('canopy', f.night);
    await arrive10(f, 'Ngā Puke Kōhatu', 'The Rocky Hills', 'Ngā Puke Kōhatu. Up here the wind never stops talking. Keep low on the ridge, and watch the scree: it moves when you do.');
  },
  v10: {
    hardClimbs: [{ x: TORS[0][0] - 60, rate: 1.4 }],
    hazards: [
      { x0: SCREE.x0 + 30, x1: SCREE.x1 - 30, kind: 'slip', dmg: 3, warn: 'Scree. Slow down, put your feet flat, and do not run on it. It runs with you.' },
      { x0: BLUFF.x0 + 30, x1: BLUFF.mouthX - 30, kind: 'rockfall', dmg: 6, period: 6, warn: 'The bluff drops stones when the wind gets into it. Under the overhang is safe.' },
    ],
    points: [
      { id: 'lm:hl:tor', kind: 'landmark', name: 'The great tor', x: TORS[0][0], photo: { w: TORS[0][1], h: TORS[0][2] }, note: 'A stack of granite blocks taller than a house, rounded like loaves by the weather.' },
      { id: 'lm:hl:tarn', kind: 'landmark', name: 'The tarn', x: TARN.x, photo: { w: 220, h: 60, dy: -50 }, note: 'A dark mountain pool in the tussock. The wind writes on it.' },
      { id: 'lm:hl:view', kind: 'landmark', name: 'The long view', x: HSPOT.lookout, photo: { w: 420, h: 160, dy: 40 }, note: 'From the ridge: the falls, the whole forest, the sea. And snow on mountains nobody has named.' },
      { id: 'cave:hl:shelter', kind: 'cave', name: 'The rock shelter', x: BLUFF.mouthX + BLUFF.mouthW / 2, photo: { w: BLUFF.mouthW, h: BLUFF.mouthH }, note: 'An overhang under the bluff: soot on the roof, a fire ring, a lean-to. Hunters use it.' },
      { id: 'smp_granite', kind: 'sample', name: 'Granite', x: 2240, art: () => findArt.glint('#c8b8a8'), take: { item: 'smp_granite', verb: 'Chip off a granite sample', tools: ['trowel'], time: 2, line: 'Pink feldspar, white quartz, black mica. This rock cooled slowly, miles underground.' } },
      { id: 'plt_daisy', kind: 'plant', name: 'Mountain daisy', x: 980, art: () => findArt.glint('#f4f4f0'), take: { item: 'plt_daisy', verb: 'Pick a mountain daisy', time: 1.4, line: 'Leaves like felt. Silver hairs, against the wind and the frost.', aroha: 'Tikumu. Only one, Mori. They grow slowly up here.' } },
      { id: 'plt_spaniard', kind: 'plant', name: 'Spaniard seed head', x: 1880, art: () => findArt.glint('#e0c060'), take: { item: 'plt_spaniard', verb: 'Carefully take a spaniard seed head', time: 2.2, line: 'Ow. OW. Every leaf ends in a needle. Got it. Ow.' } },
    ],
  },
};
