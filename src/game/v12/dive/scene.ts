// V12 Te Moana Rimurimu, the kelp-forest dive: a FieldScene underwater stage off the anchored Kitten
// (modelled on the Glass Reef snorkel, sites10/oceanreef.ts), 4800 px wide in four zones (./layout.ts):
// the kelp shallows, the boulder reef, the drop-off and the blue.
//
// The beauty layer: the water is graded by depth and zone (warm green over the kelp, teal over the
// reef, deep blue past the drop-off), the light comes down in shafts through the gaps in the canopy
// and plays over the floor as caustics, the surface is seen from below (a Snell's window of sky over
// Mori, a mirror of the water around it, the Kitten's hull and her anchor line at the entry), marine
// snow and plankton drift, Mori's regulator breathes out bubbles that wobble up to the surface, schools
// of little fish turn in the water, and parallax bands of far kelp and reef stand back in the haze.
// The kelp, bull kelp and seagrass are Strands (world/foliage.ts, the 'kelp' kind): they move with
// the surge and part around Mori and anything else that swims through them.
//
// The scene fills DIVE_CTX on enter (./ctx.ts), then the dive's life (./species.ts) and the air tank
// (./air.ts) start; on leave the air stops, the catch goes into the pack and the context is cleared.
// The ladder on the Kitten's transom surfaces back to the boat stop.

import type { Env, Frame, Renderer } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { bigFrame, DynamicSprite } from '../../../gfx/atlas';
import { game } from '../../game';
import { A, local } from '../../assets';
import { FieldScene, FieldSite } from '../../scenes/field';
import type { Drawable, Layer, Stage } from '../../../world/stage';
import { Custom, Prop } from '../../../world/props';
import { Strand } from '../../../world/foliage';
import { layerSpan } from '../../../world/scenery';
import { audio } from '../../../core/audio';
import { Rng, clamp, rand } from '../../../core/math';
import { REF_Y as REF } from '../../../gfx/renderer';
import { hex, mix, rgba } from '../../../art/color';
import { PixelBuffer } from '../../../art/pixel';
import type { Sprite } from '../../../art/jungle-core';
import * as K from '../../../art/v10/boat10';
import { discover, findLocation } from '../../v10/regions';
import type { BubbleLine } from '../../../ui/bubbles';
import { DIVE_CTX, KELP_LOC, KELP_ZONES, clearDive } from './ctx';
import { installDiveLife } from './species';
import { bankCatches, startAir, stopAir } from './air';
import {
  ANCHOR_X, BOAT_LEN, BOAT_X, BOULDERS, BOT, GROVES, LADDER, PPM, SURF, W, ZOOM, baseY, depthAt, floorAt, giantAt, groveAt, kelpAt, layerSurface, spots, waterRGB, zoneAt,
} from './layout';
import type { RGB } from './layout';
import { giantKelp, bullKelp, stalkedKelp, seagrass } from '../../../art/v12/dive/kelp';
import { paintFloor, waterStrip, toC } from '../../../art/v12/dive/seabed';
import { paintBand } from '../../../art/v12/dive/backdrop';
import * as PR from '../../../art/v12/dive/props';
import type { SchoolKind } from '../../../art/v12/dive/props';

const lerp3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/** the sky through Snell's window (bright to blue), its rim and the fringes either side */
const SKY = [hex('#e6f8f2'), hex('#c4ebe6'), hex('#a2dad8'), hex('#84c6c8'), hex('#6cb2b6')];
const RIM = hex('#fbffff'), RIM_W = hex('#ffe9b8'), RIM_C = hex('#9fe0f4');

/** scene-local sprite cache (cleared with the local atlas on every scene change) */
const cache = new Map<string, { f: Frame; s: Sprite }>();
let cacheOwner: unknown = null;
function spr(key: string, gen: () => Sprite): { f: Frame; s: Sprite } {
  if (cacheOwner !== local) { cache.clear(); cacheOwner = local; }
  let c = cache.get(key);
  if (!c) {
    const s = gen();
    c = { f: local.add('dive:' + key, s.buf, s.ax, s.ay), s };
    cache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------ the schools
interface Fish { x: number; y: number; vx: number; vy: number; ox: number; oy: number; ph: number; flash: number; dir: 1 | -1 }
/** a school of little fish (scenery): they hold a loose formation round a centre that wanders its patch
 *  of water, turn together, scatter from Mori (and anything that charges) and close up again */
class School implements Drawable {
  z: number;
  fish: Fish[] = [];
  cx: number; cy: number;
  private t = rand.next() * 50;
  private frames: Frame[];
  constructor(readonly s: KelpDiveScene, kind: SchoolKind, n: number, readonly box: [number, number, number, number], z: number, readonly layerP = 1, readonly speed = 1) {
    this.z = z;
    const fr = PR.schoolFish(kind);
    this.frames = fr.map((b, i) => local.add(`dive:fish:${kind}:${i}`, b, Math.floor(b.w / 2), 1));
    const rng = new Rng(n * 31 + z);
    this.cx = rng.range(box[0], box[1]);
    this.cy = rng.range(box[2], box[3]);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next());
      this.fish.push({ x: this.cx + Math.cos(a) * d * 40, y: this.cy + Math.sin(a) * d * 16, vx: 0, vy: 0, ox: Math.cos(a) * d * 46, oy: Math.sin(a) * d * 17, ph: rng.range(0, 6), flash: 0, dir: 1 });
    }
  }
  update(dt: number) {
    this.t += dt;
    const [x0, x1, y0, y1] = this.box;
    const t = this.t;
    // the centre wanders its patch (slowly, in long loops)
    const tx = (x0 + x1) / 2 + Math.sin(t * 0.045 * this.speed) * (x1 - x0) * 0.45;
    const ty = (y0 + y1) / 2 + Math.sin(t * 0.11 * this.speed + 1.3) * (y1 - y0) * 0.45;
    this.cx += (tx - this.cx) * Math.min(1, dt * 0.25);
    this.cy += (ty - this.cy) * Math.min(1, dt * 0.25);
    const p = this.s.player, main = this.layerP === 1;
    const threats: [number, number, number][] = [];
    if (main && p) threats.push([p.x, p.y - 8, Math.hypot(p.vx, p.vy) > 45 ? 70 : 46]);
    if (main) for (const c of DIVE_CTX.chargers) threats.push([c.x, c.y, 110]);
    const rot = t * 0.15;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (const f of this.fish) {
      // the formation slowly turns over (the school rolls), each fish loosely in its place
      const fx = this.cx + f.ox * cr - f.oy * sr * 0.4, fy = this.cy + f.oy * cr + f.ox * sr * 0.25;
      let ax = (fx - f.x) * 1.1 + Math.sin(t * 1.3 + f.ph) * 10, ay = (fy - f.y) * 1.4 + Math.sin(t * 0.9 + f.ph) * 5;
      for (const [hx, hy, R] of threats) {
        const dx = f.x - hx, dy = f.y - hy, d = Math.hypot(dx, dy);
        if (d < R) { const k = (1 - d / R) * 900 / (d + 4); ax += dx * k; ay += dy * k; }
      }
      f.vx = clamp(f.vx + ax * dt, -70, 70);
      f.vy = clamp(f.vy + ay * dt, -45, 45);
      f.vx *= 0.985; f.vy *= 0.96;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (main) f.y = Math.min(f.y, floorAt(f.x) - 6);
      f.y = Math.max(f.y, SURF + 6);
      const nd = f.vx > 2 ? 1 : f.vx < -2 ? -1 : f.dir;
      // a turn flashes the flank (the light catches it)
      if (nd !== f.dir) { f.dir = nd; f.flash = 0.22; }
      f.flash = Math.max(0, f.flash - dt);
    }
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    if (this.cx + 120 < x0 || this.cx - 120 > x1) return;
    const t = this.t;
    for (const f of this.fish) {
      if (f.x < x0 || f.x > x1) continue;
      const fi = f.flash > 0 || Math.sin(t * 2.2 + f.ph * 3) > 0.97 ? 2 : Math.floor(t * 7 + f.ph) % 2;
      r.draw(this.frames[fi], Math.round(f.x), Math.round(f.y), f.dir, 1);
    }
  }
}

// ------------------------------------------------------------------ the scene
export interface DiveStart { x?: number; y?: number }

export class KelpDiveScene extends FieldScene {
  private hull: Frame | null = null;
  private ladderF: Frame | null = null;
  private anchorF: Frame | null = null;
  private surfaceSpr: DynamicSprite | null = null;
  private strips: Frame[] = [];
  private snowT = 0;
  private reachK = 0;
  private schools: School[] = [];
  private rays: { x: number; w: number; len: number; a: number; k: number; col: [number, number, number]; ph: number }[] = [];
  private winX = 0;
  private banked = false;
  private start: DiveStart;

  constructor(o: DiveStart = {}) {
    let me: KelpDiveScene | null = null;
    const site: FieldSite = {
      id: KELP_LOC as never, name: 'Te Moana Rimurimu', width: W, camY: 120, followY: true, minY: SURF - 34, maxY: BOT - 140,
      spawnX: o.x ?? LADDER.x + 30, exitX: 0, waterY: SURF, underwater: true, ambience: 'underwater', music: 'wonder', ground: 'sand',
      noGuide: true, noExit: true,
      // the island's sea serpent cruises the blue, out past the drop-off
      spawns: [{ species: 'leviathan', n: [1, 1], x: [KELP_ZONES.blue[0] + 100, KELP_ZONES.blue[1] - 200], medium: 'water', y: 430, chance: 1 }],
      build: () => me!.buildDive(),
    };
    super(site, 'day');
    me = this;
    this.start = o;
    this.allowPack = true;
  }

  hudOpts() {
    return {
      place: 'Te Moana Rimurimu', sub: 'Diving the kelp forest',
      keys: '<span class="key">WASD</span> swim · <span class="key">Q</span> camera · <span class="key">E</span> interact · <span class="key">Tab</span> pack',
    };
  }

  // ---------------------------------------------------------------- building
  async build() {
    await super.build();
    // in the water by the ladder (or where a jump put him) before the first frame
    const p = this.player;
    p.x = this.start.x ?? LADDER.x + 26;
    p.y = this.start.y ?? Math.min(floorAt(p.x) - 30, SURF + 50);
    p.facing = 1;
    this.winX = p.x;
    this.camY = Math.min(p.y - 6, floorAt(p.x) - 84);
  }

  buildDive() {
    const st = this.st, r = game.r;
    st.minX = 0; st.maxX = W; st.minY = SURF - 34; st.maxY = BOT - 140;
    st.envHook = env => this.grade(env);
    // the current: a slow surge as the swells pass overhead, a steady drift toward the open sea
    st.wind = 0.35;
    st.windField.water = 1;
    st.windField.dir = 1;
    st.windField.speed = 60;
    this.buildWater();
    this.buildBands();
    const main = st.addLayer('main', 1, 0, 1, 0);
    this.main = main;
    this.buildFloor(main);
    this.buildKelp(main);
    this.buildDecor(main);
    this.buildLight(main);
    this.buildBoat(main);
    this.buildSchools(main);
    this.buildFront();
    // the terrain: the floor line, the whole stage is water
    const pts: [number, number][] = [];
    for (let x = 0; x <= W; x += 4) pts.push([x, floorAt(x)]);
    st.terrain.addGround(pts, 'ground');
    st.terrain.water.push([-100, W + 100, SURF, BOT + 40]);
    // the ladder surfaces back to the boat
    this.interact.push({ x: LADDER.x, y: LADDER.bot + 8, w: 22, h: 34, label: 'Climb the ladder', action: () => this.surface() });
    void r;
  }

  /** the water behind everything: graded strips for each zone, slid by depth, crossfaded by zone */
  private buildWater() {
    const r = game.r;
    const rows = Math.ceil((BOT - SURF + 120) * ZOOM);
    const mPerRow = 1 / (ZOOM * PPM);
    this.strips = [0, 1, 2, 3].map(z => bigFrame(r, wideStrip(waterStrip(z, rows, mPerRow))));
    const lay = this.st.addScreenLayer('water', 0.5);
    lay.add(new Custom(0, (rr, s) => {
      const z = zoneAt(s.cam.x);
      const i = Math.min(2, Math.floor(z)), k = z - i;
      const top = s.cam.y - rr.VH / 2 / s.cam.zoom;
      const sy = Math.max(0, (top - SURF) * s.cam.zoom * 0.82);
      const strip = (f: Frame, a: number) => {
        if (a <= 0.01) return;
        const col = packColor(1, 1, 1, a);
        for (let x = 0; x < rr.VW; x += f.w) rr.drawSub(f, 0, Math.min(f.h - rr.VH - 1, sy), f.w, rr.VH + 1, x, 0, 1, 1, col);
      };
      strip(this.strips[i], 1);
      strip(this.strips[i + 1], Math.round(k * 8) / 8);
    }));
  }

  /** far bands of reef and kelp on parallax layers, pulled into the water's colour */
  private buildBands() {
    const r = game.r, st = this.st;
    const bands: { p: number; py: number; haze: number; fog: number; seed: number; kelp: boolean; lift: number }[] = [
      { p: 0.16, py: 0.4, haze: 0.42, fog: 0.62, seed: 11, kelp: true, lift: 4 },
      { p: 0.34, py: 0.56, haze: 0.3, fog: 0.46, seed: 23, kelp: true, lift: 3 },
    ];
    for (const B of bands) {
      // (the far bands take most of their haze from the grade's fog, so they match the water wherever
      //  the camera is; their own paint only carries a little)
      const lay = st.addLayer('band' + B.seed, B.p, B.fog, 0.25, 0, B.py);
      const span = layerSpan(st, B.p, 80);
      for (let x = 0; x < span.w; x += 1600) {
        const w = Math.min(1600, span.w - x);
        const band = paintBand({ p: B.p, py: B.py, x0: span.x0 + x, w, haze: B.haze, seed: B.seed, kelp: B.kelp, lift: B.lift });
        const f = bigFrame(r, band.buf);
        lay.add(new Prop({ ...f, ax: 0, ay: 0 }, band.x0, band.y0));
      }
      // marine snow drifting at this distance
      lay.add(new Custom(1, () => {}, (dt, s) => {
        if (!rand.chance(dt * 3)) return;
        const cx = s.cam.x * B.p, cy = 180 + (s.cam.y - 180) * B.py;
        lay.particles.spawn({ frame: A.dot, x: cx + rand.range(-320, 320), y: cy + rand.range(-180, 160), vx: rand.range(1, 4), vy: rand.range(1, 3), life: rand.range(8, 14), color: [0.8, 0.9, 0.88], alpha: 0.35, alpha1: 0, fadeIn: 0.3, wobble: 2, wobbleF: 0.4 });
      }));
    }
    // the near band: reef and sand, with whole stands of swaying kelp standing on it
    const p = 0.62, py = 0.76;
    const mid = st.addLayer('mid', p, 0.24, 0.45, 0, py);
    const span = layerSpan(st, p, 80);
    for (let x = 0; x < span.w; x += 1600) {
      const w = Math.min(1600, span.w - x);
      const band = paintBand({ p, py, x0: span.x0 + x, w, haze: 0.2, seed: 37, lift: 2 });
      mid.add(new Prop({ ...bigFrame(r, band.buf), ax: 0, ay: 0 }, band.x0, band.y0, -5));
    }
    const ly = (wy: number) => 180 + (wy - 180) * py;
    const rng = new Rng(77);
    for (let lx = span.x0 + 10; lx < span.x0 + span.w; lx += rng.range(16, 34)) {
      const wx = lx / p;
      if (wx < 60 || wx > 3100) continue;
      const fy = ly(floorAt(wx)) - 2;
      const water = toC(waterRGB(zoneAt(wx), 6 + zoneAt(wx) * 4));
      if (wx < 1460) {
        // the forest carries on behind the stage's groves, thinning out over the sand
        const dens = 0.35 + groveAt(wx) * 0.6 + (rng.next() - 0.5) * 0.3;
        if (rng.next() > dens) continue;
        const Hk = Math.max(30, Math.round((fy - layerSurface(p, py)) / 6) * 6);
        const v = rng.int(0, 3);
        const s = spr(`mk:${Hk}:${v}`, () => giantKelp(900 + v * 13 + Hk, Hk, { lean: 0.5, haze: 0.16, water }));
        mid.add(new Strand(s.f, lx, fy + 2, rng.next(), 9 * py, rng.chance(0.5) ? 1 : -1, 0xffffffff, 1.6, false));
      } else if (rng.chance(0.55)) {
        const v = rng.int(0, 3), h = rng.int(30, 44);
        const s = spr(`me:${h}:${v}`, () => stalkedKelp(950 + v * 7 + h, h, { lean: 0.5, haze: 0.16, water }));
        mid.add(new Strand(s.f, lx, fy + 2, rng.next(), 3, rng.chance(0.5) ? 1 : -1, 0xffffffff, 0.5, false));
      }
    }
    // a far school turning in the blue on the near band
    this.schools.push(mid.add(new School(this, 'far', 46, [3700 * p, 4600 * p, ly(220), ly(420)], 2, p, 0.6)));
    this.schools.push(mid.add(new School(this, 'far', 30, [2000 * p, 2900 * p, ly(120), ly(260)], 2, p, 0.6)));
  }

  /** the floor, painted in chunks; caustics play over it */
  private buildFloor(main: Layer) {
    const r = game.r;
    const step = 800;
    for (let x0 = 0; x0 < W; x0 += step) {
      const w = Math.min(step, W - x0);
      // deep enough below the floor line to fill the view wherever the camera can look from
      let deep = 0;
      for (let x = x0 - 300; x < x0 + w + 300; x += 20) deep = Math.max(deep, floorAt(clamp(x, 0, W)));
      const ch = paintFloor(x0, w, Math.min(BOT + 40, deep + 180));
      const f = bigFrame(r, ch.buf);
      main.add(new Custom(-10, rr => { if (x0 + w >= rr.visibleX0(4) && x0 <= rr.visibleX1(4)) rr.draw(f, x0, ch.y0); }));
    }
    // caustics: two nets drifting across each other, strong in the shallows, gone by the deep floor
    main.add(new Custom(-9, (rr, s) => {
      const t = s.time;
      const a = rr.visibleX0(70), b = rr.visibleX1(70);
      for (let x = Math.floor(a / 80) * 80; x < b; x += 80) {
        const fy = floorAt(x + 40);
        const d = depthAt(fy);
        const k = clamp(1.15 - d / 22);
        if (k <= 0.02) continue;
        const col = packColor(0.85, 1, 0.9, 1);
        rr.lightTex(A.caustics, x + 40 + Math.sin(t * 0.5 + x * 0.01) * 10, fy - 8, 0.85, 0.32, 0, col, 1.1 * k);
        rr.lightTex(A.caustics, x + 10 - Math.sin(t * 0.37 + x * 0.02) * 14, fy - 4, 0.7, 0.26, 0.4, col, 0.7 * k);
        // and on across the floor plane toward the viewer, the net stretching as it comes closer
        rr.lightTex(A.caustics, x + 30 + Math.sin(t * 0.42 + x * 0.013) * 12, fy + 24, 1.1, 0.34, 0, col, 0.5 * k);
        rr.lightTex(A.caustics, x - 6 - Math.sin(t * 0.31 + x * 0.017) * 16, fy + 50, 1.4, 0.4, 0.3, col, 0.4 * k);
      }
    }));
  }

  /** the kelp: giant kelp in the shallows' groves, bull kelp on the pinnacle, stalked kelp on the reef, seagrass on the sand */
  private buildKelp(main: Layer) {
    const rng = new Rng(4242);
    // giant kelp: through the groves of the shallows (and a few on the reef's edge)
    for (const [a, b, dens] of GROVES) {
      if (!giantAt(a)) continue;
      for (let x = a + rng.range(0, 14); x < b; x += rng.range(18, 34) / dens) {
        const fy = floorAt(x);
        // (none on the bull-kelp pinnacle's crown)
        if (fy < baseY(x) - 2.6 * PPM) continue;
        const Hk = Math.ceil((fy + 3 - SURF) / 4) * 4;
        const v = rng.int(0, 2);
        const s = spr(`gk:${Hk}:${v}`, () => giantKelp(100 + v * 31 + Hk, Hk, { lean: 0.45 + rng.range(-0.2, 0.2) }));
        const front = rng.chance(0.38);
        main.add(new Strand(s.f, x, SURF - 1 + Hk - 1, front ? 56 + rng.next() : 20 + rng.next(), rng.range(13, 19), rng.chance(0.25) ? -1 : 1, 0xffffffff, rng.range(1.3, 2)));
      }
    }
    // bull kelp: rimurapa, on the pinnacle where it reaches up toward the surge
    for (let x = 620; x < 830; x += rng.range(16, 26)) {
      const fy = floorAt(x);
      if (fy > baseY(x) - 1.2 * PPM) continue;
      const v = rng.int(0, 3), len = rng.int(56, 80);
      const s = spr(`bk:${v}:${len}`, () => bullKelp(70 + v * 3 + len, len, { lean: 0.55 + rng.range(-0.3, 0.3) }));
      main.add(new Strand(s.f, x, fy + 2, rng.chance(0.4) ? 57 : 21, 9, 1, 0xffffffff, 0.7));
    }
    // stalked kelp: patches over the reef's boulders and the lip of the drop-off
    for (const [a, b, dens] of GROVES) {
      if (giantAt(a)) continue;
      for (let x = a; x < b; x += rng.range(7, 15) / dens) {
        const fy = floorAt(x);
        const v = rng.int(0, 4), h = rng.int(34, 54);
        const s = spr(`ek:${v}:${h}`, () => stalkedKelp(30 + v * 5 + h, h, { lean: 0.5 + rng.range(-0.4, 0.3) }));
        main.add(new Strand(s.f, x, fy + 2, rng.chance(0.35) ? 55 + rng.next() : 19 + rng.next(), 5, rng.chance(0.3) ? -1 : 1, 0xffffffff, 0.5));
      }
    }
    // lone stalked kelp on the boulder tops between the patches
    for (const [cx, hw, h] of BOULDERS) {
      if (cx < 1400 || cx > 3300 || h < 1.5) continue;
      for (let i = 0; i < 3; i++) {
        if (!rng.chance(0.6)) continue;
        const x = cx + rng.range(-hw * 0.5, hw * 0.5), fy = floorAt(x);
        const v = rng.int(0, 4), hh = rng.int(30, 46);
        const s = spr(`ek:${v}:${hh}`, () => stalkedKelp(30 + v * 5 + hh, hh, { lean: 0.5 }));
        main.add(new Strand(s.f, x, fy + 2, 19.5, 5, 1, 0xffffffff, 0.5));
      }
    }
    // seagrass: clumps on the sand under the Kitten with sand between, tufts in the sandy gaps; short
    // and long, some leaning, a few torn
    for (let x = 6; x < W; x += rng.range(8, 20)) {
      const meadow = x < 470 ? 0.75 * clamp(0.3 + Math.sin(x * 0.024) * 0.5 + Math.sin(x * 0.071) * 0.35) : x > 2390 && x < 2630 ? 0.4 : x < 1400 && groveAt(x) < 0.2 ? 0.2 : 0;
      if (!meadow || rng.next() > meadow) continue;
      if (floorAt(x) < baseY(x) - 3) continue;
      const v = rng.int(0, 7), h = rng.int(10, 34), n = rng.int(4, 13);
      const s = spr(`sg:${v}:${h}:${n}`, () => seagrass(10 + v * 7 + h, h, n, { lean: 0.15 + rng.range(-0.3, 0.4) }));
      main.add(new Strand(s.f, x, floorAt(x) + 2, 12 + rng.next(), h * 0.16, rng.chance(0.5) ? 1 : -1, 0xffffffff, 0.3));
    }
    this.buildPlane(main, rng);
  }

  /**
   * Things lying on the floor plane in front of the floor line: shells, cobbles, seagrass tufts, kina,
   * a holdfast, nearer (lower) ones bigger and drawn over the swimmers; they break the plane's edge
   */
  private buildPlane(main: Layer, rng: Rng) {
    for (let x = 10; x < W - 10; x += rng.range(9, 24)) {
      const fy = floorAt(x), by = baseY(x);
      const onRock = fy < by - 2;
      const pTop = onRock ? by + 2 : fy;
      const d = depthAt(pTop);
      const e = Math.round(Math.pow(rng.next(), 0.8) * 54) + 3;
      const y = pTop + e;
      const z = e > 16 ? 57 + e * 0.01 : -4 + e * 0.01;
      const near = e / 54;
      const k = rng.next();
      const zone = zoneAt(x);
      if (k < 0.3) {
        const v = rng.int(0, 8);
        const sh = spr(`shell:${v}`, () => PR.shell(v));
        main.add(new Prop(sh.f, x, y, z, { flip: rng.chance(0.5) }));
      } else if (k < 0.55) {
        const v = rng.int(0, 5), w = Math.round(6 + near * 16 + rng.range(0, 6));
        const c = spr(`rr:${v}:${w}`, () => PR.reefRock(v * 5 + w, w, w * rng.range(0.4, 0.62)));
        main.add(new Prop(c.f, x, y + 1, z, { flip: rng.chance(0.5) }));
      } else if (k < 0.78 && zone < 1.2 && d < 12) {
        const v = rng.int(0, 5), h = Math.round(8 + near * 18 + rng.range(0, 6)), n = rng.int(4, 10);
        const s = spr(`sg:${v}:${h}:${n}`, () => seagrass(60 + v * 7 + h, h, n, { lean: 0.2 }));
        main.add(new Strand(s.f, x, y + 1, z, h * 0.16, rng.chance(0.5) ? 1 : -1, 0xffffffff, 0.3));
      } else if (k < 0.88 && d < 16) {
        const v = rng.int(0, 3);
        const ki = spr(`ki:${v}`, () => PR.kina(v));
        main.add(new Prop(ki.f, x, y, z));
      }
    }
  }

  /** cobbles, kina, pāua, reef stars, sponges, the anchor */
  private buildDecor(main: Layer) {
    const rng = new Rng(777);
    const bush = (key: string, gen: () => Sprite, x: number, y: number, z: number, flip = false) => {
      const s = spr(key, gen);
      main.add(new Prop(s.f, x, y, z, { flip }));
    };
    for (let x = 30; x < W - 20; x += rng.range(20, 60)) {
      const fy = floorAt(x), rock = fy < baseY(x) - 3;
      const d = depthAt(fy);
      const k = rng.next();
      if (!rock) {
        // on the sand: cobbles with a pink crust, a kina wandering out, a pāua on a cobble
        if (k < 0.45) {
          const v = rng.int(0, 5), w = rng.int(7, 16);
          bush(`cb:${v}:${w}`, () => PR.cobble(v * 3 + w, w, w * rng.range(0.45, 0.7)), x, fy + 2, -4 + rng.next(), rng.chance(0.5));
          if (rng.chance(0.25) && d < 16) bush(`pa:${v % 3}`, () => PR.paua(v % 3), x + rng.range(-2, 2), fy - w * 0.4, -3.5);
        } else if (k < 0.62 && d < 18) bush(`ki:${rng.int(0, 3)}`, () => PR.kina(rng.int(0, 3)), x, fy + 1, -3.8);
      } else {
        // on the rock: kina in the crevices, pāua clamped on, reef stars on the faces, sponges deeper
        if (k < 0.3 && d < 18) bush(`ki:${rng.int(0, 3)}`, () => PR.kina(rng.int(0, 3)), x, fy + 1, -3.8);
        else if (k < 0.45 && d < 16) bush(`pa:${rng.int(0, 2)}`, () => PR.paua(rng.int(0, 2)), x, fy + 1, -3.7);
        else if (k < 0.62) {
          const v = rng.int(0, 5);
          bush(`ss:${v}`, () => PR.seaStar(v), x, fy + rng.range(6, 14), -3.6);
        } else if (k < 0.8 && d > 10) bush(`sp:${rng.int(0, 5)}`, () => PR.sponge(rng.int(0, 5)), x, fy + 2, -3.5);
      }
    }
    // the deep reef's life: sea fans, vase sponges and sea whips on the boulders below ~12 m, and out of
    // the drop-off's walls
    for (const [cx, hw, h] of BOULDERS) {
      if (cx < 1700) continue;
      const n = Math.round(hw / 26) + (h > 3 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = cx + rng.range(-hw * 0.7, hw * 0.7), fy = floorAt(x), d = depthAt(fy);
        // (only where it can stand: a flattish spot on the rock)
        if (d < 11 || fy > baseY(x) - 4 || Math.abs(floorAt(x + 3) - floorAt(x - 3)) > 3.5) continue;
        const k = rng.next();
        if (k < 0.45 && d > 14) {
          const v = rng.int(0, 5), fh = rng.int(16, 30);
          const s = spr(`fan:${v}:${fh}`, () => PR.seaFan(v, fh));
          main.add(new Strand(s.f, x, fy + 2, -3.2 + rng.next() * 0.1, 1.4, rng.chance(0.5) ? 1 : -1, 0xffffffff, 0.5, false));
        } else if (k < 0.75) {
          const v = rng.int(0, 5), vh = rng.int(12, 22);
          bush(`vase:${v}:${vh}`, () => PR.vaseSponge(v, vh), x, fy + 2, -3.3);
        } else {
          const v = rng.int(0, 4), wh = rng.int(18, 32);
          const s = spr(`whip:${v}:${wh}`, () => PR.seaWhips(v, wh));
          main.add(new Strand(s.f, x, fy + 2, -3.25, 3, 1, 0xffffffff, 0.6, false));
        }
      }
    }
    for (const [a, b] of [[3060, 3125], [3320, 3400]] as const) {
      const faceAt = (y: number) => { let x = a - 12; while (x < b + 12 && floorAt(x) < y) x++; return x; };
      const yTop = floorAt(a - 6), yBot = floorAt(b + 6);
      for (let y = yTop + 10; y < yBot - 6; y += rng.range(14, 24)) {
        const x = faceAt(y) - 1;
        const v = rng.int(0, 5), fh = rng.int(12, 22);
        if (rng.chance(0.7)) bush(`wfan:${v}:${fh}`, () => PR.seaFan(v + 10, fh, -0.55 + rng.range(-0.2, 0.2)), x, y, -3.1);
        else bush(`wvase:${v}`, () => PR.vaseSponge(v + 3, 10), x + 2, y, -3.1);
      }
    }
    // the Kitten's anchor, dug into the sand
    const an = spr('anchor', () => PR.anchor());
    this.anchorF = an.f;
    main.add(new Prop(an.f, ANCHOR_X, floorAt(ANCHOR_X) + 2, -2));
  }

  /** shafts of sunlight through the gaps in the canopy, long faint rays out over the blue */
  private buildLight(main: Layer) {
    const shaftF = local.add('dive:shaft', PR.shaftTex(), 12, 0);
    type Ray = { x: number; w: number; len: number; a: number; k: number; col: [number, number, number]; ph: number };
    const rays: Ray[] = this.rays;
    const add = (xs: number[], w: [number, number], len: number, k: number, col: [number, number, number]) => {
      const rng = new Rng(xs.length * 7 + len);
      for (const x of xs) rays.push({ x, w: rng.range(w[0], w[1]), len: len * rng.range(0.85, 1.15), a: -0.16 + rng.range(-0.03, 0.03), k: k * rng.range(0.75, 1.1), col, ph: rng.range(0, 6) });
    };
    // through the gaps in the canopy over the shallows, warm; cooler and longer over the reef; long faint
    // rays reaching down into the blue
    add([290, 372, 452, 690, 724, 1060, 1110, 1400, 1572], [14, 30], 240, 0.75, [1, 0.95, 0.74]);
    add([1820, 1880, 2140, 2470, 2530, 2780], [24, 44], 320, 0.55, [0.88, 1, 0.96]);
    add([3000, 3080, 3330, 3700, 3790, 4080, 4180, 4450, 4520, 4700], [30, 64], 900, 0.5, [0.72, 0.9, 1]);
    main.add(new Custom(200, (rr, s) => {
      const x0 = rr.visibleX0(140), x1 = rr.visibleX1(140);
      for (const r0 of rays) {
        if (r0.x < x0 || r0.x > x1) continue;
        // the rays breathe with the surface: brighter and dimmer as the ripples focus the light
        const k = r0.k * (0.62 + 0.38 * Math.sin(s.time * 0.55 + r0.ph) * Math.sin(s.time * 0.23 + r0.ph * 2));
        const sw = r0.w / 24 * (1 + Math.sin(s.time * 0.4 + r0.ph) * 0.12);
        const c = packColor(r0.col[0], r0.col[1], r0.col[2], 1);
        rr.fxDraw(shaftF, r0.x + s.windField.surgeAt(r0.x) * 3, SURF, sw, r0.len / 192, r0.a, c, 0.55 * k);
        rr.lightTex(A.shaft, r0.x, SURF, r0.w / 48, r0.len / 256, r0.a, c, 0.8 * k);
      }
    }, dt => {
      // plankton motes glinting in the beams
      for (const r0 of rays) {
        if (!rand.chance(dt * 2 * r0.k)) continue;
        const t = rand.next(), y = SURF + t * r0.len * 0.9;
        const x = r0.x - Math.sin(r0.a) * (y - SURF) + rand.range(-r0.w * 0.35, r0.w * 0.35);
        main.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-1.5, 2.5), vy: rand.range(-1, 1.5), life: rand.range(3, 6), color: [1, 0.97, 0.85], alpha: 0.85, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1.4, wobble: 3, wobbleF: 0.7 });
      }
    }));
    for (const r0 of rays) this.sunspots.push({ x: r0.x - Math.sin(r0.a) * (floorAt(r0.x) - SURF), w: r0.w * 0.8 });
  }

  /** the Kitten overhead at the entry: her hull, the ama, the ladder off the transom, the anchor line */
  private buildBoat(main: Layer) {
    const r = game.r;
    const k = K.kittenHull(6, 'all');
    this.hull = bigFrame(r, k.buf, k.ax, k.ay);
    const ld = spr('ladder', () => PR.ladder(LADDER.bot - LADDER.top));
    this.ladderF = ld.f;
    this.surfaceSpr = new DynamicSprite(r, 760, 48, 0, 40);
    // the anchor line: from the bow fairlead down to the anchor's shackle, sagging and swaying
    main.add(new Custom(60, (rr, s) => {
      const bx = BOAT_X + BOAT_LEN - 6, by = SURF + 6 + Math.sin(s.time * 0.9) * 1.2;
      const ax = ANCHOR_X + 13, ay = floorAt(ANCHOR_X) - 16;
      if (Math.max(bx, ax) < rr.visibleX0(4) || Math.min(bx, ax) > rr.visibleX1(4)) return;
      const len = Math.hypot(ax - bx, ay - by), n = Math.ceil(len);
      const rope1 = packColor(0.78, 0.68, 0.5, 1), rope2 = packColor(0.5, 0.42, 0.3, 1), dark = packColor(0.2, 0.16, 0.12, 1);
      const lit = packColor(1, 0.95, 0.78, 1), lit2 = packColor(0.92, 0.84, 0.62, 1);
      // a glint runs down the line every few seconds; the rays light it where they cross it
      const glint = ((s.time * 0.35) % 1.6) / 1.6;
      let px = -999, py = -999;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        // the line bellies out with the surge, more in the middle, the lower part lagging
        const sw = s.windField.surgeAt(bx + 80, t * 1.4) * 7;
        const x = Math.round(bx + (ax - bx) * t + Math.sin(t * Math.PI) * (sw + 6)), y = Math.round(by + (ay - by) * t + Math.sin(t * Math.PI) * 10);
        if (x === px && y === py) continue;
        px = x; py = y;
        let inRay = false;
        for (const r0 of this.rays) if (Math.abs(x - (r0.x - Math.sin(r0.a) * (y - SURF))) < r0.w * 0.35) { inRay = true; break; }
        const twist = (i >> 1) % 2;
        rr.rect(x, y, 1, 1, inRay ? (twist ? lit : lit2) : Math.abs(t - glint) < 0.012 ? lit : twist ? rope1 : rope2);
        rr.rect(x + 1, y, 1, 1, inRay && twist ? rope1 : dark);
      }
    }));
    // the hull and the ladder, the surface over everything
    main.add(new Custom(150, (rr, s) => this.drawSurface(rr, s)));
  }

  /** the schools of little fish (scenery) */
  private buildSchools(main: Layer) {
    const add = (k: SchoolKind, n: number, box: [number, number, number, number], z: number) => this.schools.push(main.add(new School(this, k, n, box, z)));
    add('sprat', 54, [260, 1300, SURF + 40, SURF + 140], 24);
    add('sprat', 36, [700, 1400, SURF + 30, SURF + 110], 54);
    add('maomao', 40, [1500, 2700, SURF + 150, SURF + 230], 25);
    add('koheru', 48, [2900, 3800, SURF + 220, SURF + 380], 26);
  }

  /**
   * Dark kelp right in front of the lens (out of focus) now and then, and rocks rising across the bottom.
   *
   * This layer has no floor of its own, so nothing on it may ever show a foot: everything is grounded
   * below the bottom of the frame for the deepest the camera can sit while it is in view (the camera
   * keeps the floor 84 px under its centre, and the floor changes a lot across one front prop's reach:
   * the pinnacle, the boulders, the drop-off). From any higher camera the foot only sinks further out of
   * the frame. The giant kelp's crown is set on the surface for that same camera, so from higher up it
   * trails a few px under the surface line instead of poking up through it.
   */
  private buildFront() {
    const st = this.st;
    const p = 1.32, py = 1.12;
    const fg = st.addLayer('front', p, 0, 0.4, 0, py);
    const VW = game.r.VW, VH = game.r.VH;
    const zf = Math.pow(ZOOM, p), half = VH / 2 / ZOOM;
    /** the lowest the camera's centre goes with Mori at x (it trails the floor by 84 px, inside the stage) */
    const camLow = (x: number) => clamp(floorAt(clamp(x, 0, W)) - 84, st.minY + half, st.maxY - half);
    /** the deepest camera from which a front prop at layer x (half-width hw) can be seen */
    const deepest = (lx: number, hw: number) => {
      const reach = VW / 2 / zf + hw + 24;
      let m = -1e9;
      for (let vx = (lx - reach) / p; vx <= (lx + reach) / p; vx += 8) m = Math.max(m, camLow(vx));
      return m;
    };
    /** the layer y that sits `below` art px under the frame's bottom edge, with the camera at vy */
    const underFrame = (vy: number, below = 14) => REF + (vy - REF) * py + (VH / 2 + below) / zf;
    /** the layer y that sits on the stage's surface line, with the camera at vy */
    const onSurface = (vy: number) => REF + (vy - REF) * py + (SURF - vy) * ZOOM / zf;
    const rng = new Rng(99);
    const span = layerSpan(st, p, 120);
    const tint = packColor(0.42, 0.46, 0.4, 1);
    // (sparse: one in front of the lens every couple of screens, never a wall of it)
    for (let lx = span.x0 + 140; lx < span.x0 + span.w; lx += rng.range(420, 760)) {
      const wx = lx / p;
      if (wx < 500 || wx > 3050) continue;
      const giant = wx < 1450;
      const vy = deepest(lx, 30);
      const foot = underFrame(vy);
      if (giant) {
        const top = onSurface(vy);
        const Hk = Math.ceil((foot - top) / 8) * 8;
        const v = rng.int(0, 1);
        const s = spr(`fk:${Hk}:${v}`, () => giantKelp(700 + v * 9 + Hk, Hk, { lean: 0.5 }));
        fg.add(new Strand(s.f, lx, top - 1 + Hk - 1, rng.next(), 20, rng.chance(0.5) ? 1 : -1, tint, 1.8, false));
      } else {
        // stalked kelp: only its blades come up into the bottom of the frame
        const v = rng.int(0, 2), h = rng.int(60, 80);
        const s = spr(`fe:${h}:${v}`, () => stalkedKelp(990 + v + h, h, { lean: 0.5 }));
        fg.add(new Strand(s.f, lx, foot, rng.next(), 7, 1, tint, 0.5, false));
      }
    }
    // rocks right in front, rising from below the frame across the bottom of the floor, crusted and
    // tufted, with seagrass on them
    const tintR = packColor(0.5, 0.55, 0.5, 1);
    for (let lx = span.x0 + 60; lx < span.x0 + span.w; lx += rng.range(150, 330)) {
      const wx = lx / p;
      if (wx < 40 || wx > 4700) continue;
      const w = rng.int(50, 110), h = rng.int(18, 34);
      const v = rng.int(0, 7);
      const c = spr(`fr:${v}:${w}:${h}`, () => PR.reefRock(300 + v * 7 + w, w, h));
      // (its foot a little further under the frame than the kelp's: a rock shows its top only)
      const base = underFrame(deepest(lx, w / 2), 6 + h * 0.3 * zf);
      fg.add(new Prop(c.f, lx, base, 2 + rng.next(), { flip: rng.chance(0.5), tint: tintR }));
      if (wx < 2900 && rng.chance(0.7)) {
        const sh = rng.int(16, 30);
        const sg = spr(`fsg:${sh}`, () => seagrass(77 + sh, sh, 10, { lean: 0.3 }));
        // (its foot well inside the rock's top: the crown's lowest facet is about half the rock's height)
        fg.add(new Strand(sg.f, lx + rng.range(-w * 0.3, w * 0.3), base - h * 0.5, 3, sh * 0.18, 1, tintR, 0.3, false));
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  /** the depth grade: the water's colour around the view, the light dimming and cooling with depth */
  private grade(env: Env) {
    const st = this.st;
    const z = zoneAt(st.cam.x);
    const half = game.r.VH / 2 / st.cam.zoom;
    const dTop = depthAt(st.cam.y - half), dBot = depthAt(st.cam.y + half), d = depthAt(st.cam.y);
    env.fogTop = waterRGB(z, dTop);
    env.fogBottom = waterRGB(z, dBot);
    const tint = lerp3(lerp3([0.97, 1.0, 0.84], [0.86, 1.02, 1.04], clamp(z)), [0.72, 0.9, 1.12], clamp((z - 1) / 2));
    const k = 1 - clamp(d / 34) * 0.4;
    env.ambientTop = mul3(tint, k * 1.04);
    env.ambientBottom = mul3(tint, k * 0.86);
    env.saturation = 1.08 - z * 0.03;
    env.exposure = (env.exposure ?? 1) * (1 + clamp((d - 12) / 18) * 0.22);
    env.contrast = 1.04;
    env.bloom = Math.max(env.bloom, 0.4);
    env.bloomThreshold = 0.78;
    env.vignette = Math.max(env.vignette, 0.32 + clamp(d / 30) * 0.25);
    env.waterAxis = null;
  }

  /**
   * The surface from below: a band over the water line, painted each frame in quantised steps. It is a
   * rippling mirror right across: dark water reflected up away from the line, a net of ripple crests
   * catching the light. Over Mori the light comes through (Snell's window): the same ripples brighten
   * there into bands of pale sky, broken and wavy at their edges, never a shape of their own, and
   * brightest where the sun is. Dithered between the steps.
   */
  private drawSurface(rr: Renderer, s: Stage) {
    const sy = rr.sy(SURF);
    if (sy < -60 || sy > rr.VH + 60) return;
    const ds = this.surfaceSpr!, b = ds.buf;
    const x0 = Math.floor(rr.visibleX0(8)), t = s.time;
    const p = this.player;
    // the light follows Mori (eased): the window's reach from his depth, the sun off to the light's side
    this.winX += (p.x - this.winX) * 0.06;
    const hw = clamp((p.y - SURF) * 1.05, 60, 300);
    const sunX = this.winX - hw * 0.3;
    const z = zoneAt(s.cam.x);
    const mirror = waterRGB(z, 2.5), deep = waterRGB(z, 9);
    const P = [toC(deep), toC(lerp3(mirror, deep, 0.5)), toC(mirror), mix(toC(mirror), SKY[3], 0.45), SKY[3], SKY[2], SKY[1], SKY[0], RIM];
    const top = 40, WH = 30;
    b.clear(0);
    for (let i = 0; i < b.w; i++) {
      const x = x0 + i;
      const wv = Math.round(Math.sin(x * 0.045 + t * 1.3) * 1.3 + Math.sin(x * 0.11 - t * 2.1) * 0.7);
      const line = top + wv;
      const dx = (x - this.winX) / hw, ds2 = (x - sunX) / (hw * 0.42);
      for (let y = 6; y <= line; y++) {
        const up = line - y;
        const v = up / WH;
        // the window's light (no edge of its own: the ripples make it)
        const win = 1 - dx * dx - v * v * 0.7;
        const sun = Math.max(0, 1 - ds2 * ds2 - (up / 14) * (up / 14));
        // the ripple net: crests meeting in cells that drift and swell
        const rp = Math.sin(x * 0.085 + 1.7 * Math.sin(up * 0.33 + t * 0.9 + x * 0.012)) * Math.sin(up * 0.52 - t * 1.25 + 0.9 * Math.sin(x * 0.047 - t * 0.5));
        let L = 2.4 - v * 2.2 + Math.max(0, win) * 4.2 + sun * 2.4 + rp * (0.7 + 1.1 * clamp(win + 0.3));
        L += ((i + y) & 1 ? 0.28 : -0.28) + (((i >> 1) + y) & 1 ? 0.1 : -0.1);
        b.data[y * b.w + i] = P[clamp(Math.round(L), 0, P.length - 1)];
      }
      // the water line: a meniscus, bright under the light, a glint row of the mirror elsewhere
      const lit = 1 - dx * dx;
      b.data[line * b.w + i] = lit > 0.15 ? RIM : Math.sin(x * 0.3 + t * 2) > 0.6 ? P[4] : P[3];
      if (line + 1 < b.h) b.data[(line + 1) * b.w + i] = lit > 0.3 ? P[5] : P[2];
    }
    ds.upload();
    rr.emissive(0.5);
    rr.draw(ds.frame, x0, SURF);
    rr.emissive();
    rr.fxDraw(A.glow, sunX, SURF - 6, 1.4, 0.5, 0, packColor(1, 0.97, 0.85, 1), 0.2);
    // the Kitten: dark against the light (her topsides above the line, the hull and ama below it)
    const hf = this.hull;
    if (hf && BOAT_X + BOAT_LEN + 40 > rr.visibleX0(8) && BOAT_X - 40 < rr.visibleX1(8)) {
      const row = Math.round(hf.ay + K.KWL);
      const bob = Math.round(Math.sin(t * 0.9) * 1.2);
      const oy = SURF - K.KWL - hf.ay + bob;
      rr.emissive(0.5);
      rr.drawSub(hf, 0, 0, hf.w, row, BOAT_X - hf.ax, oy, 1, 1, packColor(0.1, 0.16, 0.17, 0.55));
      rr.drawSub(hf, 0, row, hf.w, hf.h - row, BOAT_X - hf.ax, oy + row, 1, 1, packColor(0.16, 0.24, 0.24, 1));
      if (this.ladderF) {
        const lf = this.ladderF, cut = clamp(SURF - (LADDER.top + bob), 0, lf.h);
        rr.drawSub(lf, 0, 0, lf.w, cut, LADDER.x - lf.ax, LADDER.top + bob, 1, 1, packColor(0.1, 0.16, 0.17, 0.55));
        rr.emissive();
        rr.drawSub(lf, 0, cut, lf.w, lf.h - cut, LADDER.x - lf.ax, LADDER.top + bob + cut, 1, 1, packColor(0.62, 0.7, 0.66, 1));
      } else rr.emissive();
      // light spilling round the hull's edges
      rr.fxDraw(A.glow, BOAT_X + BOAT_LEN / 2, SURF + 6, 3.2, 0.5, 0, packColor(0.8, 0.95, 1, 1), 0.16);
    }
  }

  update(dt: number) {
    super.update(dt);
    const p = this.player;
    // (the swimmers the scene itself knows of part the kelp too: sharks and spearable fish that aren't
    //  in the animal list)
    const fo = this.st.foliage;
    for (const c of DIVE_CTX.chargers) if (!this.animals.includes(c as never)) fo.add(c, 18, 26, dt, true);
    for (const f of DIVE_CTX.spearables) if (f.alive && !this.animals.includes(f as never)) fo.add(f, 9, 16, dt, true);
    // the camera keeps the floor in the lower part of the view near the bottom
    if (!this.st.cam.locked && !this.cam.active) this.st.cam.ty = Math.min(p.y - 6, floorAt(p.x) - 84);
    // below the surface
    if (p.y < SURF + 14) { p.y = SURF + 14; if (p.vy < 0) p.vy = 0; }
    this.drift(dt);
    // the map fills in as Mori explores
    const k = Math.floor(clamp(p.x / W) * 10);
    if (k > this.reachK) { this.reachK = k; void import('../../v10/regions').then(m => m.revealMap(KELP_LOC, 0, k / 10)).catch(() => {}); }
  }

  /** marine snow and plankton: thicker the deeper Mori goes, drifting with the current */
  private drift(dt: number) {
    const st = this.st;
    const d = depthAt(st.cam.y);
    this.snowT += dt * (5 + d * 0.5);
    const half = game.r.VW / 2 / st.cam.zoom + 30, hh = game.r.VH / 2 / st.cam.zoom + 30;
    while (this.snowT > 1) {
      this.snowT -= 1;
      const x = st.cam.x + rand.range(-half, half), y = st.cam.y + rand.range(-hh, hh);
      if (y < SURF + 4 || y > floorAt(x)) continue;
      const big = rand.chance(0.18);
      this.main.particles.spawn({ frame: big ? A.dot2 : A.dot, x, y, vx: st.windField.surgeAt(x) * 5 + 2, vy: rand.range(1.5, 4), life: rand.range(7, 12), color: d > 18 ? [0.75, 0.85, 0.95] : [0.86, 0.92, 0.84], alpha: big ? 0.4 : 0.6, alpha1: 0, fadeIn: 0.25, wobble: 2.5, wobbleF: 0.5, size: big ? 0.5 : 1 });
    }
  }

  // ---------------------------------------------------------------- enter / leave
  async enter() {
    await super.enter();
    (this.cam as unknown as { site: string }).site = 'Te Moana Rimurimu';
    const p = this.player;
    this.st.cam.tzoom = this.st.cam.zoom = ZOOM;
    this.st.cam.x = this.st.cam.tx = p.x;
    this.st.cam.y = this.st.cam.ty = Math.min(p.y - 6, floorAt(p.x) - 84);
    audio.setAmbience('underwater');
    // the context the dive's parts meet in
    DIVE_CTX.scene = this;
    DIVE_CTX.surfaceY = SURF;
    DIVE_CTX.floorAt = floorAt;
    DIVE_CTX.depthAt = depthAt;
    DIVE_CTX.kelpAt = kelpAt;
    DIVE_CTX.ladder = { x: LADDER.x, y: LADDER.bot };
    DIVE_CTX.spots = spots();
    DIVE_CTX.catches.length = 0;
    try { installDiveLife(this); } catch (e) { console.error('[dive] life', e); }
    try { startAir(this); } catch (e) { console.error('[dive] air', e); }
    findLocation(KELP_LOC);
    const first = !game.save.flags['v12:kelpDived'];
    game.save.flags['v12:kelpDived'] = true;
    discover({ id: 'ecosystem:' + KELP_LOC, kind: 'ecosystem', name: 'Te Moana Rimurimu', loc: KELP_LOC, note: 'Dived from the Kitten with the air tank' });
    game.persist();
    if (this.start.x !== undefined) return;
    if (first) await game.ui.titleCard('Dive', 'Te Moana Rimurimu', 'The kelp forest', 2200);
    await this.say([{ who: 'mori', text: first ? 'Breathe slow. In... out. Oh. OH. It’s a forest. A gold forest, all the way up to the light.' : 'Back down the anchor line. Hello, kelp.', expr: 'excited' } as BubbleLine]);
  }

  /** the ladder: up out of the water, the catch into the pack, back aboard at the stop */
  private async surface() {
    if (this.cutscene) return;
    this.cutscene = true;
    this.bankOnce();
    audio.play('splash', { vol: 0.6 });
    await game.fadeTo(1, 0.8);
    const { goBoatTrip } = await import('../../sites10/ocean');
    await goBoatTrip(KELP_LOC, { phase: 'stop' });
  }

  /** the catch goes into the pack once, when the dive ends (air.ts flies each item in and says so) */
  private bankOnce() {
    if (this.banked) return;
    this.banked = true;
    try { bankCatches(this); } catch (e) { console.error('[dive] catch', e); }
  }

  exit() {
    this.bankOnce();
    try { stopAir(); } catch (e) { console.error('[dive] air', e); }
    clearDive();
    this.surfaceSpr?.dispose();
    this.surfaceSpr = null;
    super.exit();
  }
}

/** a strip 16 px wide made 64 wide (fewer quads across the screen) */
function wideStrip(b: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(64, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < 64; x++) out.data[y * 64 + x] = b.data[y * b.w + (x % b.w)];
  return out;
}

/** the kelp dive (from the anchored Kitten at the kelp-forest stop) */
export async function goKelpDive(clockT: number, o: DiveStart = {}) {
  void clockT;
  game.go(() => new KelpDiveScene(o), [0.06, 0.16, 0.13], 0.9);
}

export { KELP_ZONES };
