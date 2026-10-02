// V11 Te Wao Nui, the scene: a FieldScene (camera, photos, wildlife, the pack, energy) as long as the
// forest, with its own continuous time of day (the island's clock carries in on Day 1, the expedition
// clock drives it after), lighting under the canopy, wading the fords and slogging through the mud,
// the dappled shade on everyone, the walk-out at the west end back down the stream to the beach, and
// the story hooks (story.ts). Built by build.ts.

import type { Env } from '../../../gfx/renderer';
import { packColor, WHITE } from '../../../gfx/renderer';
import { game } from '../../game';
import { FieldScene } from '../../scenes/field';
import type { FieldSite, SpawnV2, HideSpot } from '../../scenes/field';
import type { TimeOfDay } from '../../../world/timeofday';
import type { Actor } from '../../../world/actor';
import { audio } from '../../../core/audio';
import { clamp, damp, rand } from '../../../core/math';
import { DayClock, envAt, lightKAt } from '../../v4/islefx';
import { FOREST, FSPOT, fgroundY, fzoneName, mudAt, wetAt, canopyAt, baseY } from './layout';
import type { ForestShade, GroundCover } from './fx';
import { A } from '../../assets';

export interface ForestHooks { enter(): Promise<void>; update(dt: number): void; exit?(): void }

/** the scene's time of day key for the V2 systems (insects, lamp, animals) */
export const todOf = (t: number): TimeOfDay => (t < 0.35 ? 'dawn' : t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night');

const day1 = () => !game.save.flags['v4:day1'];
const SPAWNS: SpawnV2[] = [
  // the stream flats and the giants
  { species: 'strider', n: [1, 2], x: [560, 1340], times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'delver', n: [3, 5], x: [960, 1120], herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 1 },
  { species: 'barkgecko', n: [2, 3], x: [300, 2300], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'shieldback', n: [1, 2], x: [1400, 2240], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
  { species: 'mossfrog', n: [3, 5], x: [700, 860], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
  { species: 'mossfrog', n: [3, 4], x: [3400, 3540], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
  // the wallows: a herd of bonefaces comes down to wallow (not on Day 1: no Aroha to warn Mori off)
  { species: 'boneface', n: [3, 5], x: [2350, 2860], herd: true, juveniles: 0.35, times: ['day', 'dusk'], chance: 0.8, when: () => !day1() },
  // the grove and the ridge
  { species: 'nutcracker', n: [3, 6], x: [4150, 4460], herd: true, times: ['dawn', 'day'], chance: 0.8 },
  { species: 'strider', n: [1, 2], x: [3800, 5400], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
  { species: 'shieldback', n: [1, 2], x: [4300, 5700], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  { species: 'flicker', n: [1, 1], x: [1200, 5000], times: ['dawn', 'day', 'dusk'], chance: 0.6, later: true },
  { species: 'quillhog', n: [1, 2], x: [3800, 5600], times: ['dusk', 'night'], chance: 0.9 },
  { species: 'hunterbat', n: [1, 2], x: [1400, 5000], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
  { species: 'sailglider', n: [1, 3], x: [3900, 5800], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night', 'dawn'], chance: 0.8 },
  { species: 'sprinter', n: [1, 1], x: [2600, 5600], times: ['dusk', 'night'], chance: 0.6, when: () => !day1() },
];

export class ForestScene extends FieldScene {
  clock = new DayClock();
  zoomBase = 1.25;
  story: ForestHooks | null = null;
  shade: ForestShade | null = null;
  covers: GroundCover[] = [];
  /** Day 1: the search for Joshu (no expedition, no map, Mori alone) */
  readonly day1: boolean;
  /** the walk-out at the west end is running */
  leaving = false;
  /** the scene's actors that push through the ground cover */
  pushers: Actor[] = [];
  /** hide spots laid out by the dressing (the player is created after it runs) */
  hidesPending: HideSpot[] = [];
  private placeKey = '';
  private flies = false;
  private exitT = 0;
  private stepMud = 0;

  constructor(o: { x?: number; dayT: number; day1: boolean; build: (s: ForestScene) => void }) {
    let me: ForestScene | null = null;
    const tod = todOf(o.dayT);
    const site: FieldSite = {
      id: 'forest' as never, name: 'Te Wao Nui', width: FOREST.W, camY: 176, followY: true, minY: FOREST.minY, maxY: FOREST.maxY,
      spawnX: o.x ?? FSPOT.enter, exitX: FSPOT.exit, waterY: null, ambience: 'forest', music: 'none', ground: 'leaves',
      noGuide: o.day1, noExit: true, spawns: SPAWNS, build: () => o.build(me!),
      insects: [
        { kind: 'butterfly', x: [80, 900], y: [120, 200], n: 6, times: ['day', 'dawn'] },
        { kind: 'dragonfly', x: [700, 860], y: [170, 214], n: 4, times: ['day', 'dusk'] },
        { kind: 'dragonfly', x: [3400, 3560], y: [210, 260], n: 3, times: ['day', 'dusk'] },
        { kind: 'bee', x: [3900, 4800], y: [150, 210], n: 4, times: ['day'] },
        { kind: 'cicada', x: [400, 5600], y: [80, 160], n: 4, times: ['day'] },
        { kind: 'skymoth', x: [400, 5600], y: [100, 200], n: 6, times: ['dusk', 'night'] },
        { kind: 'lanternbeetle', x: [1400, 5000], y: [200, 214], n: 6, times: ['night'] },
        { kind: 'weta', x: [1400, 3000], y: [205, 214], n: 2, times: ['dusk', 'night'] },
        { kind: 'ant', x: [300, 5600], y: [212, 214], n: 8 },
      ],
    };
    super(site, tod);
    me = this;
    this.day1 = o.day1;
    this.clock.set(o.dayT);
    this.allowPack = true;
  }

  hudOpts() {
    const t = this.clock.t;
    const when = t < 0.7 ? 'Morning' : t < 1.5 ? 'Midday' : t < 2.2 ? 'Afternoon' : t < 2.75 ? 'Golden hour' : t < 3.4 ? 'Dusk' : 'Night';
    const [n, sub] = fzoneName(this.player?.x ?? FSPOT.enter);
    return {
      place: n, sub: `${sub} · Day ${game.save.day || 1} · ${when}`,
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">Shift</span> run · <span class="key">E</span> interact · <span class="key">Q</span> camera · <span class="key">Tab</span> pack',
    };
  }

  /** forest light: the island's sky keys, cooled and greened under the canopy, mist-grey fog */
  envForest(env: Env) {
    const e = envAt(this.clock.t);
    Object.assign(env, e);
    const p = this.player;
    const cov = canopyAt(p ? p.x : FSPOT.enter);
    const k = 0.18 + cov * 0.16;
    const g = (c: [number, number, number], m: [number, number, number], s: number): [number, number, number] => [c[0] * (1 - s) + m[0] * s, c[1] * (1 - s) + m[1] * s, c[2] * (1 - s) + m[2] * s];
    env.ambientTop = g([...e.ambientTop], [e.ambientTop[0] * 0.78, e.ambientTop[1] * 0.94, e.ambientTop[2] * 0.84], k + 0.15);
    env.ambientBottom = g([...e.ambientBottom], [e.ambientBottom[0] * 0.72, e.ambientBottom[1] * 0.88, e.ambientBottom[2] * 0.8], k + 0.2);
    const night = this.clock.night;
    const mist: [number, number, number] = [0.56 - night * 0.42, 0.68 - night * 0.5, 0.62 - night * 0.42];
    env.fogTop = g([...e.fogTop], mist, 0.65);
    env.fogBottom = g([...e.fogBottom], [mist[0] * 1.08, mist[1] * 1.08, mist[2] * 1.02], 0.7);
    env.saturation *= 1.1;
    env.exposure *= 1.08;
    env.bloom += 0.08 + this.clock.morning * 0.1;
    env.vignette += 0.12;
    env.waterAxis = Math.round(baseY(p ? p.x : FSPOT.enter)) - 1;
    this.st.preset.lightK = lightKAt(this.clock.t) * 1.15 + 0.08;
  }

  update(dt: number) {
    this.clock.update(dt);
    const t = this.clock.t;
    const tod = todOf(t);
    if (tod !== this.tod) {
      this.tod = tod;
      this.night = tod === 'night';
      this.insects.night = this.night;
      audio.setAmbience('forest', this.night);
    }
    const p = this.player;
    // wading the fords, slogging through the mud
    const wet = wetAt(p.x), mud = mudAt(p.x);
    const onFloor = p.onGround && Math.abs(p.y - fgroundY(p.x)) < 4;
    if (onFloor && (wet > 0.2 || mud > 0.2)) {
      p.wadeK = mud > 0.2 ? 1 - mud * 0.42 : 1 - wet * 0.25;
      p.ground = wet > 0.2 ? 'water' : 'leaves';
      if (mud > 0.3 && Math.abs(p.vx) > 8) {
        this.stepMud -= dt * Math.abs(p.vx) / 40;
        if (this.stepMud <= 0) {
          this.stepMud = 0.55;
          audio.play('stepWater', { vol: 0.28, pitch: rand.range(0.45, 0.6) });
          for (let i = 0; i < 4; i++) this.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-4, 4), y: p.y - 1, vx: rand.range(-30, 30), vy: rand.range(-50, -20), ay: 260, life: 0.5, color: [0.22, 0.16, 0.1], alpha: 1, alpha1: 0.6, floorY: p.y + 1 });
        }
      }
    } else if (p.wadeK < 1 && p.state !== 'swim') { p.wadeK = 1; p.ground = 'leaves'; }
    // the camera: the base zoom, following the ground (down into the gully, up onto the fallen log)
    const cam = this.st.cam;
    if (!cam.locked) cam.tzoom = damp(cam.tzoom, this.zoomBase, 3, dt);
    super.update(dt);
    if (!cam.locked && !this.cam.active) cam.ty = Math.min(p.y, fgroundY(p.x)) - 34;
    // dappled shade on everyone
    const sh = this.shade;
    if (sh) {
      const tint = (a: Actor) => { const s = sh.sample(a.x, this.st.time); const k = 1 - s * 0.3; a.tint = s > 0.01 ? packColor(k, k, k * 1.02, 1) : WHITE; };
      tint(p.body);
      for (const a of this.actors.values()) tint(a);
    }
    // the place / time label
    const ho = this.hudOpts();
    const key = ho.place + '|' + ho.sub;
    if (key !== this.placeKey) { this.placeKey = key; this.hud?.setPlace(ho.place, ho.sub); }
    // fireflies come out at dusk along the stream and in the grove
    if (!this.flies && t > 2.85) {
      this.flies = true;
      for (const [x0, x1, y0, y1, n] of [[500, 1300, 120, 210, 18], [3200, 3800, 160, 250, 16], [3900, 5200, 90, 200, 22]] as const)
        for (let i = 0; i < n; i++) this.insects.spawn('firefly', x0 + rand.next() * (x1 - x0), y0 + rand.next() * (y1 - y0), 1, 10);
    }
    // the walk-out at the west end: hold left at the edge
    if (!this.cutscene && !game.ui.blocking && !this.leaving && p.state === 'normal' && p.x < FSPOT.exit + 10 && game.input.axisX() < 0) {
      this.exitT += dt;
      if (this.exitT > 0.35) { this.exitT = 0; void this.walkOut(); }
    } else this.exitT = 0;
    this.story?.update(dt);
  }

  /** set by the story module: what walking out at the west end does */
  onWalkOut: (() => Promise<void>) | null = null;
  async walkOut() {
    if (this.leaving || !this.onWalkOut) return;
    this.leaving = true;
    try { await this.onWalkOut(); } finally { this.leaving = false; }
  }

  async build() {
    await super.build();
    this.st.envHook = env => this.envForest(env);
    this.player.hides.push(...this.hidesPending);
  }

  async enter() {
    await super.enter();
    this.st.cam.tzoom = this.st.cam.zoom = this.zoomBase;
    this.player.speedK = 0.9;
    this.player.ground = 'leaves';
    audio.setAmbience('forest', this.night);
    audio.setMusic('none' as never);
    this.snapCamera();
    await this.story?.enter();
    (window as unknown as { __forestReady?: number }).__forestReady = Date.now();
  }

  snapCamera() {
    const c = this.st.cam, p = this.player;
    c.x = c.tx = p.x;
    c.y = c.ty = Math.min(p.y, fgroundY(p.x)) - 34;
  }

  exit() {
    this.story?.exit?.();
    super.exit();
  }
}

export { clamp };
