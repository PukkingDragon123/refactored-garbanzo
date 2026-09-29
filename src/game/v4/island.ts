// V4: the island. One long side-view shoreline from the west rocks past the wreck of the Kittiwake,
// the landing beach (where camp goes up), the palm grove, the stream mouth, the seal rocks, a sea cave
// and a hidden cove, up a bush track into the forest. The sea is behind the walk line, the land in
// front of the camera, so the wet sand at the water's edge mirrors the cast. Time of day runs
// continuously from morning to night; the story lives in islestory.ts, the dressing in isleprops.ts.

import type { Renderer, Env, Frame } from '../../gfx/renderer';
import { packColor, WHITE } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { FieldScene, FieldSite } from '../scenes/field';
import { Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import type { Actor } from '../../world/actor';
import { audio } from '../../core/audio';
import { clamp, damp } from '../../core/math';
import { ISL, SPOT, WRECK, groundY, canopyAt, caveAt, zoneAt } from '../../art/island4/layout';
import { paintGroundChunk } from '../../art/island4/ground';
import { paintWreck, WreckArt } from '../../art/island4/wreck';
import { paintFarIslands } from '../../art/island4/scenery';
import { DayClock, envAt, lightKAt, IsleSky, CloudDeck, SeaStrip, Breakers, Swash, LeafShadows, GodRays, MistBank, BlowingSand, Glowworms } from './islefx';
import { ChunkBuddy } from './buddy';
import { dressIsland } from './isleprops';

export interface IsleHooks { enter(): Promise<void>; update(dt: number): void }

/** screen-matched layer y for a band that should sit at screen y `sy` when the camera is at y 180 */
export function layerY(p: number, sy: number, zoom = 1.25) {
  return 180 + (sy - 180) / Math.pow(zoom, p);
}

export class IslandScene4 extends FieldScene {
  clock = new DayClock();
  wreck!: WreckArt;
  chunk!: Actor;
  jenna!: Actor;
  joshu!: Actor;
  aroha!: Actor;
  buddy!: ChunkBuddy;
  breakers!: Breakers;
  swash!: Swash;
  leaf!: LeafShadows;
  /** 0 outside .. 1 inside the wreck */
  inside = 0;
  /** 0 .. 1 inside the sea cave */
  caveK = 0;
  hullA = 1;
  /** base zoom for the current place */
  zoomBase = 1.25;
  story: IsleHooks | null = null;
  /** called by the shore life when a species is photographed for the first time */
  onNewSpecies: ((sp: string) => void) | null = null;
  /** things only drawn in some phases (camp structures, footprints...) keyed by id */
  shown = new Set<string>();
  private fr: Record<string, Frame> = {};
  private flies = false;
  private placeKey = '';
  private leafT = 0;

  constructor(dayT = 0) {
    let me: IslandScene4 | null = null;
    const site: FieldSite = {
      id: 'coast', name: 'Kittiwake Beach', width: ISL.W, camY: 176, followY: true, minY: -140, maxY: 420,
      spawnX: SPOT.moriWake, exitX: 0, waterY: ISL.GY, ambience: 'beach', music: 'none', ground: 'sand',
      noGuide: true, noExit: true, spawns: [], build: () => me!.buildIsland(),
      insects: [
        { kind: 'butterfly', x: [2600, 3300], y: [120, 190], n: 6 },
        { kind: 'butterfly', x: [5950, 6800], y: [80, 150], n: 5 },
        { kind: 'dragonfly', x: [3700, 3870], y: [170, 205], n: 3 },
        { kind: 'dragonfly', x: [6520, 6600], y: [110, 145], n: 2 },
        { kind: 'bee', x: [3540, 4060], y: [180, 205], n: 4 },
      ],
    };
    super(site, dayT < 2.6 ? 'day' : dayT < 3.4 ? 'dusk' : 'night');
    me = this;
    this.clock.set(dayT);
    this.allowPack = false;
  }

  hudOpts() {
    const t = this.clock.t;
    const when = t < 0.7 ? 'Morning' : t < 1.5 ? 'Midday' : t < 2.2 ? 'Afternoon' : t < 2.75 ? 'Golden hour' : t < 3.4 ? 'Dusk' : 'Night';
    const x = this.player?.x ?? SPOT.moriWake;
    const z = zoneAt(x);
    const camp = !!game.save.flags['v4:arohaJoined'] && x > 1400 && x < 2560;
    const place = camp ? 'Camp' : z === 'wreck' ? 'The wreck' : z === 'forest' ? 'The bush track' : z === 'cave' ? 'Sea cave' : z === 'cove' ? 'Hidden cove' : z === 'seal' ? 'Seal rocks' : z === 'stream' ? 'Stream mouth' : z === 'grove' ? 'Palm grove' : z === 'rocks' ? 'West point' : z === 'cliffs' ? 'Under the cliffs' : 'Kittiwake Beach';
    return {
      place, sub: `Day 1 · ${when}`,
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">Shift</span> run · <span class="key">E</span> interact · <span class="key">Q</span> camera',
    };
  }

  // ---------------------------------------------------------------- building
  buildIsland() {
    const st = this.st, r = game.r;
    st.minX = 0;
    st.maxX = ISL.W;
    st.minY = -140;
    st.maxY = 420;
    st.waterY = ISL.GY;
    st.envHook = (env, dt) => this.env(env, dt);
    const clock = this.clock;
    // ---- sky, clouds, far islands
    st.addScreenLayer('sky', 0.5).add(new IsleSky(clock));
    const cf = st.addLayer('clouds-far', 0.015, 0, 0, 0.5, 0.01);
    cf.add(new CloudDeck(clock, cf, 31, 9, 6, 86, true, layerSpan(st, 0.015, 260)));
    const far = st.addLayer('far', 0.04, 0.3, 0, 0, 0.04);
    const fspan = layerSpan(st, 0.04, 60);
    const fi = bigFrame(r, paintFarIslands(fspan.w, 80, 3));
    far.add(new Custom(0, rr => rr.draw(fi, fspan.x0, layerY(0.04, 126) - 80)));
    const cn = st.addLayer('clouds-near', 0.05, 0.1, 0, 0.5, 0.05);
    cn.add(new CloudDeck(clock, cn, 57, 6, 70, 108, false, layerSpan(st, 0.05, 200)));
    // ---- the sea, far to near
    const band = (name: 'horizon' | 'far' | 'mid' | 'near', p: number, sy: number, speed: number, fog: number) => {
      const l = st.addLayer('sea-' + name, p, fog, 0.4, 0, p);
      l.add(new SeaStrip(name, layerY(p, sy), clock, speed));
      return l;
    };
    band('horizon', 0.06, 124, 1.2, 0.25);
    band('far', 0.2, 138, 2.4, 0.12);
    const mid = band('mid', 0.42, 158, 4, 0.05);
    mid.add(new MistBank(layerY(0.42, 140), 4, () => clamp(0.55 - clock.t * 0.6) + clock.night * 0.2, 11, 640, 40));
    const near = band('near', 0.72, 186, 7, 0);
    this.breakers = new Breakers(layerY(0.72, 192), layerY(0.72, 214));
    near.add(this.breakers);
    this.swash = new Swash();
    this.breakers.onBreak = () => setTimeout(() => this.swash.push(), 900);
    // ---- behind the beach: cliffs, the forest, the bow on the reef (see isleprops)
    const layers = { mid, near, back: st.addLayer('back', 0.9, 0, 0.8, 0, 0.9) };
    // ---- the gameplay plane
    const main = st.addLayer('main', 1, 0, 1, 0);
    this.main = main;
    this.addGround();
    this.addWreck();
    main.add(this.swash);
    this.leaf = new LeafShadows(clock);
    main.add(this.leaf);
    main.add(new GodRays(clock, main, [[2700, 3240], [5960, 6900]]));
    main.add(new BlowingSand(main));
    main.add(new Glowworms(5080, 5420, 66));
    // daylight into the sea cave: the two mouths and the skylights in the roof
    main.add(new Custom(185, rr => {
      const day = 1 - clock.night * 0.85;
      rr.light(5040, 170, 150, 1, 0.94, 0.84, 1.3 * day, 0.2);
      rr.light(5460, 170, 150, 1, 0.94, 0.84, 1.3 * day, 0.2);
      for (const [x, w] of [[5190, 26], [5330, 20]] as const) {
        rr.lightTex(A.shaft, x, 40, w / 48, 0.72, 0.1, packColor(1, 0.96, 0.86, 1), 2.2 * day);
        rr.fxDraw(A.shaft, x, 40, w / 48, 0.72, 0.1, packColor(1, 0.96, 0.86, 1), 0.28 * day * this.caveK);
      }
    }));
    const front = st.addLayer('front', 1.25, 0, 0.6, 0);
    dressIsland(this, { ...layers, main, front });
    // terrain
    const pts: [number, number][] = [];
    for (let x = 0; x <= ISL.W; x += 6) pts.push([x, groundY(x)]);
    st.terrain.addGround(pts, 'ground');
  }

  private addGround() {
    const r = game.r, main = this.main;
    const CH = 1150;
    for (let x0 = 0; x0 < ISL.W; x0 += CH) {
      const w = Math.min(CH, ISL.W - x0);
      const ch = paintGroundChunk(x0, w);
      const base = bigFrame(r, ch.base), wet = bigFrame(r, ch.wet);
      main.add(new Custom(-10, rr => {
        const vx0 = rr.visibleX0(4), vx1 = rr.visibleX1(4);
        if (x0 + w < vx0 || x0 > vx1) return;
        rr.draw(base, x0, ch.y0);
        rr.water(0.34, 0.7);
        rr.draw(wet, x0, ch.y0);
        rr.water(0);
      }));
    }
  }

  private addWreck() {
    const r = game.r, main = this.main;
    const w = paintWreck();
    this.wreck = w;
    const f = (k: 'back' | 'inner' | 'hull' | 'front' | 'wet') => (this.fr['w' + k] = bigFrame(r, w[k]));
    const back = f('back'), inner = f('inner'), hull = f('hull'), front = f('front'), wet = f('wet');
    main.add(new Custom(-7, rr => {
      rr.draw(back, w.x, w.y);
      const k = 0.7 + this.inside * 0.3;
      rr.draw(inner, w.x, w.y, 1, 1, 0, packColor(k, k, k, 1));
      rr.water(0.5, 0.5);
      rr.draw(wet, w.x, w.y);
      rr.water(0);
    }));
    main.add(new Custom(-6, rr => {
      if (this.hullA > 0.01) rr.draw(hull, w.x, w.y, 1, 1, 0, this.hullA < 1 ? packColor(1, 1, 1, this.hullA) : WHITE);
      rr.draw(front, w.x, w.y);
      // light through the holes: shafts inside, and a soft spill on the sand below the breach
      const day = 1 - this.clock.night;
      for (const [sx, sy, sw] of w.shafts) {
        rr.lightTex(A.shaft, sx, sy, sw / 48, 0.3, 0.12, packColor(1, 0.95, 0.82, 1), 1.4 * day);
        if (this.inside > 0.2) rr.fxDraw(A.shaft, sx, sy, sw / 48, 0.3, 0.12, packColor(1, 0.95, 0.82, 1), 0.3 * day * this.inside);
      }
    }));
    // the floor inside, and the way in through the breach
    this.st.terrain.addPlatform([[WRECK.x0 + 6, WRECK.floor], [WRECK.x0 + 836, WRECK.floor]], 'bridge');
    this.st.terrain.addClimb(WRECK.climbX, WRECK.floor, groundY(WRECK.climbX), 'rope');
  }

  /** is the player standing on the wreck's floor? */
  get inWreck() {
    const p = this.player;
    return p.x > WRECK.x0 && p.x < WRECK.x0 + 840 && p.y < ISL.GY - 10;
  }

  // ---------------------------------------------------------------- lighting
  private env(env: Env, dt: number) {
    void dt;
    const e = envAt(this.clock.t);
    Object.assign(env, e);
    env.ambientTop = [...e.ambientTop];
    env.ambientBottom = [...e.ambientBottom];
    env.fogTop = [...e.fogTop];
    env.fogBottom = [...e.fogBottom];
    const p = this.player;
    env.waterAxis = this.inWreck ? WRECK.floor + 1 : Math.round(groundY(p ? p.x : SPOT.moriWake)) - 1;
    // inside the wreck or the cave: dim, cool ambient so the light shafts and glowworms read
    const dim = Math.max(this.inside * 0.5, this.caveK * 0.5);
    if (dim > 0) {
      const k = 1 - dim;
      env.ambientTop = [env.ambientTop[0] * k, env.ambientTop[1] * k, env.ambientTop[2] * (k + dim * 0.1)];
      env.ambientBottom = [env.ambientBottom[0] * k, env.ambientBottom[1] * k, env.ambientBottom[2] * (k + dim * 0.12)];
      env.bloom += dim * 0.3;
      env.vignette += dim * 0.25;
    }
    this.st.preset.lightK = lightKAt(this.clock.t);
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    this.clock.update(dt);
    const t = this.clock.t;
    const tod = t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night';
    if (tod !== this.tod) {
      this.tod = tod;
      this.night = tod === 'night';
      this.insects.night = this.night;
      audio.setAmbience('beach', this.night);
    }
    const p = this.player;
    this.inside = damp(this.inside, this.inWreck ? 1 : 0, 5, dt);
    this.hullA = 1 - this.inside * 0.9;
    this.caveK = caveAt(p.x) * (p.y > ISL.GY - 40 ? 1 : 0);
    // camera: a little closer inside, and it follows the ground up the bush track
    const cam = this.st.cam;
    const zt = this.inside > 0.5 ? 1.42 : this.caveK > 0.5 ? 1.34 : this.zoomBase;
    if (!cam.locked) cam.tzoom = damp(cam.tzoom, zt, 3, dt);
    super.update(dt);
    if (!cam.locked && !this.cam.active) cam.ty = Math.min(p.y, groundY(p.x)) - (this.inside > 0.5 ? 28 : 34);
    // dappled light on everyone walking under the canopy
    const shade = (a: Actor) => {
      const s = this.leaf.sample(a.x, this.st.time);
      const k = 1 - s * 0.32 - this.inside * 0.05;
      a.tint = s > 0.01 ? packColor(k, k, k * 1.02, 1) : WHITE;
    };
    shade(p.body);
    for (const a of this.actors.values()) shade(a);
    // the place / time label follows you along the shore and through the day
    const ho = this.hudOpts();
    const key = ho.place + '|' + ho.sub;
    if (key !== this.placeKey) { this.placeKey = key; this.hud?.setPlace(ho.place, ho.sub); }
    // fireflies come out at dusk, around camp, in the grove and up the bush track
    if (!this.flies && t > 2.85) {
      this.flies = true;
      for (const [x0, x1, y0, y1, n] of [[1500, 2600, 130, 200, 16], [2600, 3300, 120, 195, 10], [5900, 6900, 60, 150, 20]] as const)
        for (let i = 0; i < n; i++) this.insects.spawn('firefly', x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), 1, 10);
    }
    // leaves drifting down under the canopy
    this.leafT -= dt;
    if (this.leafT <= 0) {
      this.leafT = 0.35;
      const x = this.st.cam.x + (Math.random() - 0.3) * 520;
      const c = canopyAt(x);
      if (c > 0.3 && Math.random() < c && A.leaves.length) {
        const gy = groundY(x);
        this.main.particles.spawn({ frame: A.leaves[Math.floor(Math.random() * A.leaves.length)], x, y: gy - 170 - Math.random() * 40, vx: 8 + this.st.wind * 14, vy: 16, ay: 0, life: 9, color: [0.8, 0.85, 0.6], alpha: 1, alpha1: 0.6, vrot: 2, flutter: 1, floorY: gy + 2, onFloor: 'stop' });
      }
    }
    this.buddy?.update(dt);
    this.story?.update(dt);
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }

  async enter() {
    await super.enter();
    this.st.cam.tzoom = this.st.cam.zoom = this.zoomBase;
    this.player.speedK = 0.9;
    this.player.ground = 'sand';
    audio.setAmbience('beach', this.night);
    await this.story?.enter();
  }
}

