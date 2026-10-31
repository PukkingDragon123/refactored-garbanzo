// V11 woods: the Te Wao Nui dressing (src/game/v11/forest/build.ts) as a toolkit, so the older forest
// places (Fernwood Floor, the Emerald Canopy, Thunder Falls) are built from the same parts and read as
// one continuous great forest: the luminous misty backdrop, ranks of far giants fading into the haze
// with mist pooled between them and the canopy carried on overhead, the near-back hedge, giants on the
// walk line whose trunks run out of the frame, tree ferns and nīkau, the 2.5D forest floor in
// perspective (src/art/v11/woods/floor.ts), ground cover that bends as you push through it, floor props
// in depth, god rays, drifting spores and leaves, dappled shade on everyone, and the blurred foreground
// framing the view top and bottom. The light is the island's sky keys under the canopy, the same as
// in Te Wao Nui; the camera sits low and close like there (zoom 1.25, following the ground).
//
// A woods site is an ordinary FieldSite (V10 runtime, finds, routes, events, predators all attach):
// build() calls buildWoods(f, cfg), and onUpdate calls the returned runtime's update.

import type { Env } from '../../../gfx/renderer';
import { packColor, WHITE } from '../../../gfx/renderer';
import type { Frame } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { game } from '../../game';
import type { FieldScene } from '../../scenes/field';
import type { Layer } from '../../../world/stage';
import { Prop, Custom } from '../../../world/props';
import { layerSpan } from '../../../world/scenery';
import { PixelBuffer } from '../../../art/pixel';
import { hex } from '../../../art/color';
import type { C } from '../../../art/color';
import type { Sprite } from '../../../art/jungle-core';
import { sprite } from '../../sites2/common';
import { tree, canopyClump } from '../../../art/jungle-trees';
import { canopyCeiling } from '../../../art/jungle-bg';
import { plant, fungus, deadwood } from '../../../art/jungle-plants';
import type { PlantKind } from '../../../art/jungle-plants';
import { paintMossMound } from '../../../art/v9/eastart';
import { Rng, clamp, damp, rand } from '../../../core/math';
import { audio } from '../../../core/audio';
import { layerY } from '../../v4/island';
import { DayClock, envAt, lightKAt } from '../../v4/islefx';
import { FP } from '../../../art/v11/forest/kit';
import { paintColonnade, paintBackdrop } from '../../../art/v11/forest/far';
import { paintGiant } from '../../../art/v11/forest/trees';
import type { GiantKind } from '../../../art/v11/forest/trees';
import { fgPlant, fgFernSpray, fgTrunk, fgVines, soften } from '../../../art/v11/forest/fg';
import { ForestMist, GroundCover } from '../forest/fx';
import type { Mover } from '../forest/fx';
import { paintWoodsFloor, wpersp, poolAt } from '../../../art/v11/woods/floor';
import type { WoodsFloor } from '../../../art/v11/woods/floor';
import { WoodsRays, WoodsAir, WoodsShade, WoodsWater } from './fx';

export const WOODS_ZOOM = 1.25;
/** screen y (at the base zoom) of a far layer's ground line, converging toward eye level with distance */
export const farGroundScreenY = (p: number) => 125 + (222.5 - 125) * p;
const farY = (p: number) => layerY(p, farGroundScreenY(p), WOODS_ZOOM);

export interface WoodsCfg {
  W: number;
  /** camera bounds */
  minY: number;
  maxY: number;
  /** the floor painter's settings (the walk line, streams, pools, moss) */
  floor: WoodsFloor;
  /** canopy cover overhead, 0..1 */
  canopy: (x: number) => number;
  /** giants on the walk line: x, kind, trunk width */
  giants: [number, GiantKind, number][];
  /** share of tree ferns among the smaller trees (by x), and the nīkau share */
  ferns?: (x: number) => number;
  /** sunbeam gaps: x, width, strength */
  rays: [number, number, number][];
  /** x positions the foreground must not cover (story spots, clues, routes) */
  keep: number[];
  /** x positions to leave clear of trees on the walk line (climbs, the falls...) */
  clear?: [number, number][];
  /** hide spots in the thickest crown ferns */
  hides: number[];
  /** colossal trunks passing in front of the camera */
  frontTrunks: number[];
  /** haze colour and the backdrop's colours */
  fog?: C;
  backdrop?: { top: C; mid: C; low: C; ghost: C };
  seed: number;
  /** the tall ground cover kinds (default: ferns), the low ones */
  tall?: PlantKind[];
  low?: PlantKind[];
  /** an extra dressing pass on the gameplay plane (site specifics), after the floor */
  dress?: (f: FieldScene, w: WoodsRuntime) => void;
  /** how much the backdrop opens to sky (canopy gaps on a plateau: 0 closed forest .. 1 open) */
  open?: number;
  /** x ranges with no foliage hanging into the top of the frame (where the camera climbs high) */
  hangSkip?: [number, number][];
}

export interface WoodsRuntime {
  clock: DayClock;
  /** V12 big regions: where this stretch starts in the region's world x (0 for a scene of its own) */
  ox: number;
  cfg: WoodsCfg;
  main: Layer;
  shade: WoodsShade | null;
  covers: GroundCover[];
  rng: Rng;
  /** a cached sprite frame (with its sprite) */
  frameOf(key: string, gen: () => Sprite): Frame & { sprite: Sprite };
  update(f: FieldScene, dt: number): void;
  enter(f: FieldScene): void;
  /** the stretch's hide spots (a region scene hands them to the player itself) */
  hides: { x: number; w: number; y: number; cover: number }[];
}

/** the island clock key for the scene's time of day (the expedition hour when there is one) */
export function clockForTod(tod: string, hour?: number): number {
  if (hour !== undefined && Number.isFinite(hour)) {
    const keys: [number, number][] = [[5.5, 0], [7.5, 0.05], [12, 1], [16.5, 2], [18.75, 3], [20.5, 4]];
    const h = ((hour % 24) + 24) % 24;
    if (h <= keys[0][0]) return 4;
    for (let i = 1; i < keys.length; i++) if (h <= keys[i][0]) { const [a, ta] = keys[i - 1], [b, tb] = keys[i]; return ta + ((h - a) / (b - a)) * (tb - ta); }
    return 4;
  }
  return tod === 'dawn' ? 0.15 : tod === 'day' ? 1.1 : tod === 'dusk' ? 2.8 : 3.9;
}

/** add a wide buffer to a layer as <= 2048 px props (top-left at x, y) */
export function addWide(layer: Layer, buf: PixelBuffer, x: number, y: number, z = 0, tint?: number) {
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

/**
 * The far forest: the luminous misty backdrop, then five ranks of giants fading into the haze with mist
 * pooled along their floors and the canopy carried on overhead. `shift` moves every rank down (world px:
 * the canopy walkway looks across at the crowns, the floor far below).
 */
export function woodsFar(f: FieldScene, clock: DayClock, o: { seed: number; fog: C; backdrop?: { top: C; mid: C; low: C; ghost: C }; open?: number; shift?: number; skip?: string[] }) {
  const st = f.st, FOG = o.fog, sh = o.shift ?? 0;
  // ---------------------------------------------------------------- the backdrop: luminous mist
  {
    const p = 0.05, lay = st.addLayer('fbg', p, 0.35, 0, 0, p);
    const span = layerSpan(st, p, 80);
    const y0 = -260, gy = farY(p);
    const H = Math.round(gy + 140 - y0);
    const buf = paintBackdrop(1024, H, Math.round(gy - y0 - 40), o.seed % 7 + 3, o.backdrop ?? { top: hex('#244a42'), mid: hex('#a8c8b4'), low: hex('#5f8a76'), ghost: hex('#7aa08e') });
    const fr = bigFrame(game.r, buf);
    for (let x = span.x0; x < span.x0 + span.w; x += 1024) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, y0 + sh * p));
  }
  // ---------------------------------------------------------------- the far giants, rank after rank
  const canopyLayer = (p: number, seed: number, y: number) => {
    const lay = st.addLayer('ceil' + seed, p, 0.03 + (1 - p) * 0.25, 0.25, 0, p);
    const span = layerSpan(st, p, 60);
    const buf = canopyCeiling(seed, 1024, 200, 300);
    const fr = bigFrame(game.r, buf);
    for (let x = span.x0; x < span.x0 + span.w; x += buf.w) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, y + sh - (buf.h - 200), 0, { tint: packColor(0.78 + p * 0.2, 0.84 + p * 0.14, 0.82 + p * 0.16, 1) }));
  };
  const far = (name: string, p: number, fog: number, k: number, seed: number, haze: number, tile: number | null, mist: number, ceiling?: { p: number; seed: number; y: number }) => {
    const lay = st.addLayer(name, p, fog, 0.15 + k * 0.25, 0, p);
    if (o.skip?.includes(name)) return lay;
    const span = layerSpan(st, p, 60);
    const gy = farY(p) + sh;
    const yTop = Math.round(-40 - 120 * p);
    const gl = Math.round(gy - yTop), H = gl + Math.round(46 + 50 * p);
    const W = tile ?? span.w;
    const buf = paintColonnade({ W, H, gl, seed, k, fog: FOG, haze, density: o.open ? 1 + o.open * 0.6 : 1 });
    if (tile) { const fr = bigFrame(game.r, buf); for (let x = span.x0; x < span.x0 + span.w; x += W) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, yTop)); }
    else addWide(lay, buf, span.x0, yTop);
    if (mist > 0) lay.add(new ForestMist(10, gy - 46 - k * 20, 2 + k * 3, clock, mist, seed + 3, 640, 70 + Math.round(k * 30)));
    if (ceiling && !o.skip?.includes('ceil')) canopyLayer(ceiling.p, ceiling.seed, ceiling.y);
    return lay;
  };
  const s0 = o.seed * 7;
  far('far0', 0.13, 0.5, 0, s0 + 21, 0.5, 1180, 0.5);
  far('far1', 0.24, 0.4, 0.22, s0 + 22, 0.4, 1560, 0.45, o.open && o.open > 0.6 ? undefined : { p: 0.3, seed: s0 + 31, y: -26 });
  far('far2', 0.38, 0.3, 0.45, s0 + 23, 0.28, null, 0.4);
  far('far3', 0.54, 0.2, 0.7, s0 + 24, 0.17, null, 0.32);
  far('far4', 0.72, 0.1, 0.95, s0 + 25, 0.08, null, 0.25, { p: 0.78, seed: s0 + 32, y: -60 });

}

/** the blurred foreground framing the view: fern sprays and big leaves rising from the bottom, fronds,
 *  vines and canopy hanging into the top, colossal trunks passing close, huge soft leaves in the corners */
export function woodsFront(f: FieldScene, c: { W: number; G: (x: number) => number; keep: number[]; hangSkip?: [number, number][]; frontTrunks: number[]; rise?: number; hang?: number }, frameOf: (key: string, gen: () => Sprite) => Frame & { sprite: Sprite }, rng: Rng) {
  const st = f.st, G = c.G;
  // ---------------------------------------------------------------- in front of the camera
  const pf = 1.32;
  const front = st.addLayer('front', pf, 0, 0.45, 0, pf);
  const dark = FP.canopy[0];
  // (the foreground framing's rows, at the base camera height over the local ground)
  const occ = (s: Sprite, x: number, y: number, flip: boolean, p: number) => f.occluders.push({ mask: s.buf, x, y, ax: s.ax, ay: s.ay, sx: flip ? -1 : 1, sy: 1, p, z: 0 });
  const yAt = (p: number, sy: number, x: number) => layerY(p, sy, WOODS_ZOOM) + (G(x) - 214) * p;
  const rise = c.rise ?? 1, hang = c.hang ?? 1;
  for (let x = 120; x < c.W + 300; x += rng.range(160, 300) / rise) {
    const k = rng.next(), v = rng.int(0, 2);
    if (c.keep.some(q => Math.abs(q - x) < 150)) continue;
    const fr = k < 0.45 ? frameOf(`fs:${v}`, () => fgFernSpray(1500 + v, 76 + v * 14, false, 1, dark, 0.62))
      : k < 0.7 ? frameOf(`fl:${v}`, () => fgPlant('leaves', 1510 + v, 92 + v * 12, 1, dark, 0.66))
        : k < 0.88 ? frameOf(`ff:${v}`, () => fgPlant('fronds', 1520 + v, 100, 1, dark, 0.64))
          : frameOf(`fm:${v}`, () => fgPlant('monstera', 1530 + v, 90, 1, dark, 0.66));
    const X = x * pf, flip = rng.chance(0.5), y = yAt(pf, 372, x) + 6 + rng.range(4, 22);
    front.add(new Prop(fr, X, y, rng.next(), { sway: 0.45, flip }));
    occ(fr.sprite, X, y, flip, pf);
  }
  for (let x = 60; x < c.W + 300; x += rng.range(140, 260) / hang) {
    const k = rng.next(), v = rng.int(0, 2);
    if ((c.hangSkip ?? []).some(([a, b]) => x > a && x < b)) continue;
    const fr = k < 0.4 ? frameOf(`fh:${v}`, () => fgFernSpray(1540 + v, 66 + v * 10, true, 1, dark, 0.6))
      : k < 0.7 ? frameOf(`fv:${v}`, () => fgVines(1550 + v, 80, 70 + v * 20, 1, dark, 0.6))
        : frameOf(`fc:${v}`, () => soften(canopyClump(1560 + v, 200, 70, { above: 260 }), 1, dark, 0.58));
    const X = x * pf, flip = rng.chance(0.5), yT = yAt(pf, -6, x), y = k < 0.7 ? yT - 14 + rng.range(-8, 4) : yT + 10 + rng.range(-8, 8);
    front.add(new Prop(fr, X, y, 2 + rng.next(), { sway: 0.25, flip }));
  }
  for (const x of c.frontTrunks) {
    const fr = frameOf(`ft:${x}`, () => fgTrunk(x % 2 ? 'kauri' : 'rimu', x, 96, 560, 2, dark, 0.8));
    const X = x * pf, y = yAt(pf, 372, x) + 36;
    front.add(new Prop(fr, X, y, 4));
    occ(fr.sprite, X, y, false, pf);
  }
  const pn = 1.7;
  const near = st.addLayer('front2', pn, 0, 0.3, 0, pn);
  for (let x = 400; x < c.W + 300; x += rng.range(620, 1100)) {
    const v = rng.int(0, 1);
    if (c.keep.some(q => Math.abs(q - x) < 200)) continue;
    const fr = frameOf(`fn:${v}`, () => fgPlant(v ? 'fronds' : 'leaves', 1570 + v, 96, 3, dark, 0.86));
    near.add(new Prop(fr, x * pn, yAt(pn, 380, x) + 34, 0, { sway: 0.3, flip: rng.chance(0.5) }));
  }

}

/** the light under the canopy: the island's sky keys for the clock, cooled and greened by the cover
 *  overhead, mist-grey fog, a touch more saturation and bloom (the same as Te Wao Nui) */
export function installWoodsEnv(f: FieldScene, clock: DayClock, canopy: (x: number) => number, B: (x: number) => number, o: { open?: number } = {}) {
  const st = f.st, c = { canopy };
  const envWoods = (env: Env) => {
    const e = envAt(clock.t);
    Object.assign(env, e);
    const p = f.player;
    const cov = c.canopy(p ? p.x : 0);
    const k = 0.18 + cov * 0.16;
    const g = (a: [number, number, number], m: [number, number, number], s: number): [number, number, number] => [a[0] * (1 - s) + m[0] * s, a[1] * (1 - s) + m[1] * s, a[2] * (1 - s) + m[2] * s];
    env.ambientTop = g([...e.ambientTop], [e.ambientTop[0] * 0.78, e.ambientTop[1] * 0.94, e.ambientTop[2] * 0.84], k + 0.15);
    env.ambientBottom = g([...e.ambientBottom], [e.ambientBottom[0] * 0.72, e.ambientBottom[1] * 0.88, e.ambientBottom[2] * 0.8], k + 0.2);
    const night = clock.night;
    const mist: [number, number, number] = [0.56 - night * 0.42, 0.68 - night * 0.5, 0.62 - night * 0.42];
    env.fogTop = g([...e.fogTop], mist, 0.65);
    env.fogBottom = g([...e.fogBottom], [mist[0] * 1.08, mist[1] * 1.08, mist[2] * 1.02], 0.7);
    env.saturation *= 1.1;
    env.exposure *= 1.08;
    env.bloom += 0.08 + clock.morning * 0.1;
    env.vignette += 0.12;
    env.waterAxis = Math.round(B(p ? p.x : 0)) - 1;
    st.preset.lightK = lightKAt(clock.t) * 1.15 + 0.08;
  };
  st.envHook = env => { envWoods(env); if (o.open) { env.exposure *= 1 + o.open * 0.06; env.bloom += o.open * 0.05; } };
}

/** the woods camera: close (zoom 1.25) and low, following the ground and the climbs */
export function woodsCamera(fs: FieldScene, G: (x: number) => number, dt: number) {
  const p = fs.player, cam = fs.st.cam;
  if (!p || cam.locked || fs.cam.active) return;
  cam.tzoom = damp(cam.tzoom, WOODS_ZOOM, 3, dt);
  cam.ty = Math.min(p.y, G(p.x)) - 34;
}

/**
 * V12 big regions: build a woods place as one stretch of a longer region scene (src/game/v12/region.ts),
 * starting at world x `ox`. The region scene owns the far forest, the near-back hedge, the foreground
 * framing, the light, the shade, the air and the camera (src/game/v11/forest/build.ts and scene.ts), so a
 * stretch only lays its gameplay plane (the floor, the giants, the trees, the cover, the floor props, the
 * sun rays and the water) at its offset, on the region's clock.
 */
export interface WoodsSeg {
  ox: number;
  clock: DayClock;
  main: Layer;
  /** local x where the floor's terrain is cut into separate pieces (a bridge's ends over a gully) */
  cuts?: number[];
}

export function buildWoods(f: FieldScene, c: WoodsCfg, hour?: number, seg?: WoodsSeg): WoodsRuntime {
  const st = f.st;
  const FOG = c.fog ?? hex('#86ad9f');
  const rng = new Rng(c.seed);
  const clock = seg?.clock ?? new DayClock();
  if (!seg) clock.set(clockForTod(f.tod, hour));
  if (!seg) { st.minX = 0; st.maxX = c.W; st.minY = c.minY; st.maxY = c.maxY; }
  // (local x along the stretch -> world x; the floor functions take local x)
  const O = seg?.ox ?? 0;
  const G = c.floor.ground, B = c.floor.base;
  const inside = (x: number) => x >= O && x <= O + c.W;
  const GW = (x: number) => G(x - O), BW = (x: number) => B(x - O);
  const frameOf = (key: string, gen: () => Sprite) => { const s = sprite(`wd${c.seed}:` + key, gen)!; return Object.assign(s.f, { sprite: s.s }); };

  if (!seg) woodsFar(f, clock, { seed: c.seed, fog: FOG, backdrop: c.backdrop, open: c.open });

  // ---------------------------------------------------------------- the near-back: the hedge behind the walk line
  const pb = 0.88;
  const fernK = c.ferns ?? (() => 0.62);
  if (!seg) {
    const back = st.addLayer('back', pb, 0.04, 0.6, 0, pb);
    const gy = farY(pb);
    const span = layerSpan(st, pb, 60);
    const bx = (x: number) => x * pb;
    for (let x = 60; x < c.W + 300; x += rng.range(230, 420)) {
      const kind = (['kauri', 'rimu', 'kahikatea', 'rata'] as GiantKind[])[rng.int(0, 3)];
      const w = rng.range(44, 82);
      const H = Math.round(gy + 170);
      const fr = frameOf(`bg:${kind}:${Math.round(w / 6)}:${rng.int(0, 2)}`, () => paintGiant(kind, 300 + Math.round(w), w, H, { epiphytes: 0.8, fadeTop: 90 }));
      back.add(new Prop(fr, bx(x), gy + 3, -2 + rng.next(), { flip: rng.chance(0.5), tint: packColor(0.84, 0.9, 0.88, 1) }));
    }
    for (let x = 20; x < c.W + 200; x += rng.range(55, 130)) {
      const k = rng.next(), fk = fernK(x);
      const kind = k < fk ? 'treefern' : k < fk + (1 - fk) * 0.5 ? 'nikau' : 'broadleaf';
      const h = kind === 'treefern' ? rng.range(110, 200) : kind === 'nikau' ? rng.range(150, 230) : rng.range(200, 300);
      const v = rng.int(0, 3);
      const fr = frameOf(`bt:${kind}:${v}:${Math.round(h / 20)}`, () => tree(kind as 'treefern', 700 + v * 17 + Math.round(h), h));
      back.add(new Prop(fr, bx(x), gy + 2, 0 + rng.next(), { sway: kind === 'broadleaf' ? 0.15 : 0.6, flip: rng.chance(0.5), tint: packColor(0.8, 0.88, 0.86, 1) }));
    }
    const yTop = Math.round(gy - 120);
    const hb = paintColonnade({ W: span.w, H: 200, gl: 120, seed: c.seed * 7 + 41, k: 1.15, fog: FOG, haze: 0.03, parts: { trunks: false, ferns: false, canopy: false, mist: false }, under: 1.5 });
    addWide(back, hb, span.x0, yTop, 5);
  }

  // ---------------------------------------------------------------- the gameplay plane
  const main = seg?.main ?? st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  const CH = 1000;
  for (let x0 = 0; x0 < c.W; x0 += CH) {
    const w = Math.min(CH, c.W - x0);
    const ch = paintWoodsFloor(c.floor, x0, w);
    const base = bigFrame(game.r, ch.base), wat = bigFrame(game.r, ch.water);
    const X0 = x0 + O;
    main.add(new Custom(-10, rr => {
      if (X0 + w < rr.visibleX0(4) || X0 > rr.visibleX1(4)) return;
      rr.draw(base, X0, ch.y0);
      rr.water(0.42, 0.8);
      rr.draw(wat, X0, ch.y0);
      rr.water(0);
    }));
  }
  const clear = (x: number, r: number) => (c.clear ?? []).some(([a, b]) => x > a - r && x < b + r);
  // giants on the walk line, their trunks running up out of the frame
  for (const [x, kind, w] of c.giants) {
    const gy = G(x);
    const H = Math.round(gy - c.minY + 60);
    const fr = frameOf(`giant:${x}`, () => paintGiant(kind, x + c.seed, w, H, { epiphytes: 1.2, vines: 1.2 }));
    main.add(new Prop(fr, x + O, gy + 4, -6.5));
    f.pois.push({ kind: 'trunk', x: x + O, y: gy, y1: gy - 220 }, { kind: 'branch', x: x + O + w * 0.4, y: gy - rng.range(90, 160) }, { kind: 'perch', x: x + O - w * 0.3, y: gy - rng.range(120, 200) });
  }
  // tree ferns, nīkau and shrubs crowding between the giants
  const busy = (x: number, r: number) => c.giants.some(([gx, , w]) => Math.abs(gx - x) < w * 0.7 + r) || clear(x, r) || c.floor.channels.some(ch => Math.abs(ch.x - x) < 50);
  for (let x = 110; x < c.W - 40; x += rng.range(60, 140)) {
    if (busy(x, 30)) continue;
    const k = rng.next(), fk = fernK(x);
    const kind = k < fk ? 'treefern' : k < fk + (1 - fk) * 0.55 ? 'nikau' : 'broadleaf';
    const h = kind === 'treefern' ? rng.range(120, 230) : kind === 'nikau' ? rng.range(170, 250) : rng.range(240, 330);
    const v = rng.int(0, 3);
    const fr = frameOf(`mt:${kind}:${v}:${Math.round(h / 20)}`, () => tree(kind as 'treefern', 800 + v * 13 + Math.round(h), h));
    main.add(new Prop(fr, x + O, G(x) + 2, -5.6 + rng.next() * 0.3, { sway: kind === 'broadleaf' ? 0.15 : 0.7, flip: rng.chance(0.5) }));
    if (kind === 'treefern') f.pois.push({ kind: 'trunk', x: x + O, y: G(x), y1: G(x) - h * 0.7 });
  }
  const rt: WoodsRuntime = { clock, ox: O, cfg: c, main, shade: null, covers: [], rng, frameOf, update: () => {}, enter: () => {}, hides: [] };
  c.dress?.(f, rt);

  // ---- ground cover: behind the walk line, and in front of it (over the feet)
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? a.facing * 40 : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const me = () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx });
  const backCover = new GroundCover(-2.4, movers, me);
  const frontCover = new GroundCover(58, movers, me);
  rt.covers.push(backCover, frontCover);
  main.add(backCover);
  main.add(frontCover);
  const tuft = (kinds: PlantKind[], sizes: [number, number]) => {
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const v = rng.int(0, 3);
    const s = Math.round(rng.range(sizes[0], sizes[1]) / 4) * 4;
    return frameOf(`tuft:${kind}:${v}:${s}`, () => plant(kind, 1200 + v * 7 + s, s));
  };
  const wet = (x: number) => c.floor.channels.some(ch => Math.abs(x - ch.x) < 34);
  const tall = c.tall ?? ['fern', 'crownfern', 'kiokio', 'umbrellafern', 'kiokio', 'fern', 'astelia'];
  const low = c.low ?? ['kidneyfern', 'moss', 'seedling', 'fiddlehead', 'sedge', 'fern', 'crownfern'];
  for (let x = 30; x < c.W - 10; x += rng.range(9, 20)) {
    if (wet(x) || clear(x, 0)) continue;
    if (rng.next() > 0.85) continue;
    backCover.add(tuft(tall, [22, 44]), x + O, G(x) + 1, rng.chance(0.5));
  }
  for (let x = 20; x < c.W - 10; x += rng.range(18, 40)) {
    if (wet(x) || clear(x, 0)) continue;
    frontCover.add(tuft(low, [12, 24]), x + O + rng.range(-4, 4), G(x) + rng.range(4, 9), rng.chance(0.5));
  }
  // hide spots in the thickest crown ferns
  const hides = rt.hides;
  for (const x of c.hides) {
    const s = sprite(`wd${c.seed}:hide:${x % 3}`, () => plant('crownfern', 1300 + (x % 3), 44));
    const y = G(x) + 3, X = x + O;
    if (s) {
      main.add(new Prop(s.f, X, y, 66, { sway: 0.6 }));
      f.occluders.push({ mask: s.s.buf, x: X, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x: X, y, w: 18 });
    hides.push({ x: X, w: 30, y, cover: 0.8 });
  }
  // the floor in front of the walk line: moss mounds, logs, stumps, ferns and fungi, in depth
  const mounds = [0, 1, 2].map(i => frameOf(`mound${i}`, () => paintMossMound(1400 + i, 22 + i * 14)));
  const logs = [0, 1].map(i => frameOf(`flog${i}`, () => deadwood(i ? 'log' : 'rottenlog', 1410 + i, 50 + i * 16)));
  const stump = frameOf('stump', () => deadwood('stump', 1420, 34));
  const roots = frameOf('roots', () => deadwood('roots', 1421, 30));
  const fungi = [0, 1, 2].map(i => frameOf(`fun${i}`, () => fungus((['bracket', 'inkcap', 'veil'] as const)[i], 1430 + i, 16)));
  for (let x = 40; x < c.W; x += rng.range(24, 50)) {
    const dd = rng.range(16, 160);
    if (c.floor.channels.some(ch => { const [cx, hw] = ch.at(dd); return Math.abs(x - cx) < hw + 28 * wpersp(dd); })) continue;
    if ((c.floor.pools ?? []).some(p => poolAt(p, x, dd) > -0.25)) continue;
    const k = rng.next();
    const fr = k < 0.32 ? tuft(tall, [26, 44]) : k < 0.55 ? mounds[rng.int(0, 2)] : k < 0.66 ? logs[rng.int(0, 1)] : k < 0.72 ? stump : k < 0.8 ? roots : k < 0.88 ? fungi[rng.int(0, 2)] : tuft(low, [14, 22]);
    main.add(new Prop(fr, x + O, B(x) + dd, 60 + dd * 0.02, { sway: k < 0.32 || k > 0.88 ? 0.5 : 0, flip: rng.chance(0.5), sx: rng.chance(0.5) ? -1 : 1 }));
  }
  // ---- light, air and water (in a region the region's shade and air run along the whole walk)
  const chW = c.floor.channels.map(ch => ({ ...ch, x: ch.x + O, at: (dd: number): [number, number] => { const [cx, hw] = ch.at(dd); return [cx + O, hw]; } }));
  const canW = (x: number) => (inside(x) ? c.canopy(x - O) : 0);
  const shade = new WoodsShade(clock, canW, GW);
  rt.shade = shade;
  if (!seg) main.add(shade);
  main.add(new WoodsWater(chW, BW));
  main.add(new WoodsRays(clock, main, c.rays.map(([x, w, k]) => [x + O, w, k] as [number, number, number]), GW));
  if (!seg) main.add(new WoodsAir(main, clock, c.canopy, G));
  for (const [x, w] of c.rays) f.sunspots.push({ x: x + O - 40, w });

  if (!seg) woodsFront(f, { W: c.W, G, keep: c.keep, hangSkip: c.hangSkip, frontTrunks: c.frontTrunks }, frameOf, rng);

  // ---------------------------------------------------------------- terrain
  // (a region stretch can cut its floor into pieces, for a bridge over a gully: ../forest/region.ts)
  const cuts = seg?.cuts ?? [];
  const pts: [number, number][] = [];
  for (let x = 0; x <= c.W; x += 6) {
    const cut = cuts.find(q => q > x - 6 && q <= x);
    if (cut !== undefined && cut > 0 && pts.length) {
      pts.push([cut + O, G(cut)]);
      st.terrain.addGround(pts.splice(0), 'ground');
      pts.push([cut + O, G(cut)]);
    }
    pts.push([x + O, G(x)]);
  }
  if (pts.length > 1) st.terrain.addGround(pts, 'ground');
  if (seg) return rt;

  // ---------------------------------------------------------------- the light under the canopy, the camera
  installWoodsEnv(f, clock, c.canopy, B);
  rt.enter = (fs: FieldScene) => {
    void inside;
    for (const h of hides) if (!fs.player.hides.some(q => q.x === h.x)) fs.player.hides.push(h);
    const cam = fs.st.cam;
    cam.zoom = cam.tzoom = WOODS_ZOOM;
    cam.y = cam.ty = Math.min(fs.player.y, G(fs.player.x)) - 34;
  };
  rt.update = (fs: FieldScene, dt: number) => {
    const p = fs.player;
    if (!p) return;
    woodsCamera(fs, G, dt);
    // dappled shade on everyone
    const tint = (a: { x: number; tint: number }) => { const s = shade.sample(a.x, fs.st.time); const kk = 1 - s * 0.3; a.tint = s > 0.01 ? packColor(kk, kk, kk * 1.02, 1) : WHITE; };
    tint(p.body as unknown as { x: number; tint: number });
    for (const a of fs.actors.values()) tint(a as unknown as { x: number; tint: number });
    // wading the streams
    const inWater = c.floor.channels.some(ch => Math.abs(p.x - ch.x) < ch.at(0)[1] * 0.9);
    const onFloor = p.onGround && Math.abs(p.y - G(p.x)) < 4;
    if (onFloor && inWater) { p.wadeK = 0.78; p.ground = 'water'; }
    else if (p.ground === 'water' && p.state !== 'swim') { p.wadeK = 1; p.ground = fs.site.ground ?? 'leaves'; }
    void rand; void audio; void clamp;
  };
  return rt;
}

