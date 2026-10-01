// V10 boat trip: the Kitten under way across open water, side view. Joshu at the tiller, Mori on
// the middle thwart with his camera, Aroha in the bow with Chunk; the hull rides the swell (heave and
// pitch from the sea under her), the woven crab-claw sail fills and luffs, the outboard putters, the
// bow throws spray and a wake of foam streams aft, wind lines race past, the sea bands scroll by,
// the home island sinks astern and the destination climbs out of the sea ahead. The V9 open-ocean
// animals live around her (boatlife.ts) and the plan cues the big moments: the moonfin pod on the bow
// wave, kitefish bursting out, a scythewing flock, gulls, the vanebill swooping past, and the
// Reefback surfacing right off the bow (the boat eases off so you can photograph it).
//
// At the far end (sites10/ocean.ts TripPlan.stop):
//   fish    motor off on the Shelf: "Fish off the stern" (goFishing with this scene as its host)
//   reef    anchored on Glass Reef: "Snorkel over the reef" (the dive), "Head home"
//   land    run her up the beach at Motu Ahi / the far coast (their FieldSites)
//   maiden  once round the bay on Launch Day, then home
// Coming home is returnToCamp('boat') (ocean.ts sailHome).
//
// Controls: A / D shuffle along the boat, Q camera, Shift opens the throttle (faster, louder: the
// animals give the boat a wider berth), E interact.

import type { Renderer, Frame, Env } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { FieldScene, FieldSite } from '../scenes/field';
import { Custom } from '../../world/props';
import type { Actor } from '../../world/actor';
import type { Interactable } from '../../world/npc';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, lerp, rand, smoothstep } from '../../core/math';
import { Ocean, BAND_P, applySeaEnv, updater, Weather } from '../../world/ocean';
import { Sky } from '../../world/ocean-sky';
import { PixelBuffer } from '../../art/pixel';
import { gripOf } from '../../art/v9/fish';
import * as K from '../../art/v10/boat10';
import { paintHorizonBufs } from '../../art/v10/horizon10';
import { startBoatLife, SeaLife, SEA_IDS } from './boatlife';
import { add } from '../inventory';
import { ITEMS } from '../items';
import { spend } from './energy';
import { discover, findLocation } from './regions';
import type { TripPlan, TripState, TripEventKind } from '../sites10/ocean';
import type { BubbleLine } from '../../ui/bubbles';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** mean sea level on the boat plane */
export const WATER = 206;
/** the boat is drawn a little larger than the cast's pixels (as on the camp's dry sand), so three
 *  adults and a pug fit in her like they would in a real 3.4 m tender */
const BS = 1.2;
/** boat-local origin in world space */
const BX = 430, BY = WATER - K.KWL * BS;
const PIV: [number, number] = [BX + K.KPIV[0] * BS, WATER];
const bx = (x: number) => BX + x * BS, by = (y: number) => BY + y * BS;
/** inside the boat: the floorboards (below the waterline, as in any dinghy), and the seats */
const FLOOR = by(30.5);
const SEATS = { joshu: bx(20), mori: bx(54), jenna: bx(36), aroha: bx(91), chunk: bx(106) };
const CRUISE = 30, FULL = 64, DRIFT = 5;

interface Foam { x: number; life: number; max: number; w: number }
interface Streak { x: number; y: number; len: number; v: number; life: number; max: number }

export class BoatTripScene extends FieldScene {
  weather = new Weather();
  ocean!: Ocean;
  sky!: Sky;
  life!: SeaLife;
  horizon!: { home: Frame; ahead: Frame | null; glow: Frame | null; crater: [number, number] };
  /** boat motion */
  rot = 0;
  bob = 0;
  private rotV = 0;
  /** distance sailed (px) and the trip's length */
  dist = 0;
  len: number;
  speed = CRUISE;
  motor = true;
  /** the boat has eased off for something worth photographing (seconds left) */
  easeT = 0;
  phase: 'sail' | 'arrive' | 'stop' | 'leave' = 'sail';
  joshu!: Actor;
  aroha!: Actor;
  chunk!: Actor;
  jenna: Actor | null = null;
  private fr: Record<string, Frame> = {};
  private sailFr: Frame[][] = [];
  private motorFr: Frame[] = [];
  private foam: Foam[] = [];
  private streaks: Streak[] = [];
  private evI = 0;
  private sitT = 0;
  private sprayT = 0;
  private bowPrev = 0;
  private barkT = 8;
  private progEl: HTMLElement | null = null;
  private fishing = false;
  /** fishing view hooks (FishingHost) */
  fishDraw: ((r: Renderer) => void) | null = null;
  held: { w: number; h: number; px: Uint32Array; grip?: [number, number] } | null = null;
  heldMode: 'chest' | 'overhead' = 'chest';
  heldBox: [number, number, number, number] | null = null;
  private heldXf: { gx: number; gy: number; f: number; rot: number; ax: number; ay: number } | null = null;
  private heldFrames = new WeakMap<object, Frame>();
  private heldN = 0;

  constructor(readonly plan: TripPlan, readonly trip: TripState) {
    let me: BoatTripScene | null = null;
    const site: FieldSite = {
      id: 'boat', name: plan.name, width: 1000, camY: 150, followY: false, minY: -120, maxY: 330,
      spawnX: SEATS.mori, exitX: 0, waterY: WATER, ambience: 'ocean', music: plan.stop === 'maiden' ? 'castaway' : 'voyage', ground: 'wood',
      noGuide: true, noExit: true, spawns: [], build: () => me!.buildTrip(),
      onEnter: () => me!.onEnter(),
    };
    super(site, 'day');
    me = this;
    this.len = plan.dur * CRUISE;
    this.allowPack = true;
    if (trip.phase === 'stop') { this.phase = 'stop'; this.dist = this.len; }
  }

  hudOpts() {
    return {
      place: this.plan.name, sub: this.subLine(),
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">Q</span> camera · <span class="key">Shift</span> full throttle · <span class="key">E</span> interact',
    };
  }
  private subLine() {
    if (this.phase === 'stop') return this.plan.stop === 'fish' ? 'Fishing on the Shelf' : this.plan.stop === 'reef' ? 'At anchor over the reef' : 'Arrived';
    return `Under way · ${Math.round(clamp(this.dist / this.len) * 100)}%`;
  }

  // ---------------------------------------------------------------- building
  buildTrip() {
    const st = this.st, r = game.r;
    st.minX = 0; st.maxX = 1000;
    st.envHook = (env, dt) => this.env(env, dt);
    const w = this.weather;
    w.storm = 0.1; w.wind = 1; w.cruise = this.phase === 'stop' ? DRIFT : CRUISE; w.sunX = 0.3; w.sunY = 0.2;
    this.ocean = new Ocean({ y: WATER, horizon: WATER - 120, seed: 23 + this.plan.id.length, weather: w });
    this.ocean.reflect = 0.3;
    this.sky = new Sky({ weather: w, horizon: this.ocean.horizon, horizonP: BAND_P.horizon, seed: 9 });
    this.sky.birds = true;
    st.addScreenLayer('sky').add(this.sky);
    // islands on the horizon (behind the horizon band, so the sea laps their feet)
    const hb = paintHorizonBufs(this.plan.ahead);
    const hf = (k: string, h: { buf: PixelBuffer; ax: number; ay: number } | null) => (h ? local.add('v10h:' + k, h.buf, h.ax, h.ay) : null);
    this.horizon = { home: hf('home', hb.home)!, ahead: hf('ahead', hb.ahead), glow: hf('glow', hb.glow), crater: hb.crater };
    const isl = st.addLayer('isles', BAND_P.horizon, 0.12, 0.4, 0, BAND_P.horizon);
    isl.add(new Custom(0, (rr, s) => this.drawIsles(rr, s.time)));
    for (const b of ['horizon', 'far', 'mid'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0, b === 'mid' ? 0.85 : BAND_P[b]).add(this.ocean.band(b));
    // the reef shows through the clear water on Glass Reef
    if (this.plan.stop === 'reef') st.layer('sea-mid').add(new Custom(5, rr => this.drawReefTint(rr)));
    // the boat plane: hull, crew, sail, motor, all rocking together
    const main = st.addLayer('main', 1, 0, 1, 0);
    main.xf = [PIV[0], PIV[1], 0, 0, 0];
    this.main = main;
    this.makeFrames();
    main.add(new Custom(10, rr => this.drawBoatBack(rr)));
    main.add(new Custom(12, (rr, s) => this.drawSail(rr, s.time)));
    main.add(new Custom(60, (rr, s) => this.drawBoatFront(rr, s.time)));
    main.add(new Custom(95, rr => this.drawHeld(rr)));
    // the sea in front of the hull; foam and the wake ride it; fishing draws over it
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0, 1).add(this.ocean.band('near'));
    st.layer('sea-near').add(new Custom(40, rr => this.drawWake(rr)));
    st.layer('sea-near').add(new Custom(41, rr => this.drawAma(rr)));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0, 1).add(this.ocean.band('front'));
    st.addLayer('sea-fish', 1, 0, 0, 0, 1).add(new Custom(0, rr => this.fishDraw?.(rr)));
    st.addLayer('wind', 1, 0, 0, 0.4, 1).add(new Custom(0, rr => this.drawWind(rr)));
    st.layer('sea-horizon').add(updater(dt => { this.weather.update(dt); this.ocean.update(dt); }));
    // the floorboards
    st.terrain.addGround([[bx(8), FLOOR], [bx(K.KL - 10), FLOOR]], 'bridge' as never);
    // the crew
    const crew = (id: string, x: number, f = 1) => { const a = this.addActor(id, x, FLOOR, f, main); a.terrain = null; a.z = 40; a.idleAnim = 'sit'; a.setAnim('sit'); a.fidget = true; return a; };
    this.joshu = crew('joshu', SEATS.joshu);
    this.aroha = crew('aroha', SEATS.aroha);
    this.chunk = crew('chunk', SEATS.chunk);
    this.chunk.z = 41;
    if (this.plan.stop === 'maiden') this.jenna = crew('jenna', SEATS.jenna);
    void r;
  }

  private makeFrames() {
    const L = (k: string, s: K.Spr) => (this.fr[k] = local.add('v10t:' + k, s.buf, s.ax, s.ay));
    L('back', K.kittenHull(6, 'back'));
    L('front', K.kittenHull(6, 'front', false));
    L('ama', K.amaRig());
    L('furled', K.sailRig('furled'));
    for (let i = 0; i < 3; i++) this.motorFr.push(local.add('v10t:motor' + i, K.outboard('down', i).buf, K.outboard('down', i).ax, K.outboard('down', i).ay));
    const fills = [0.3, 0.65, 1];
    this.sailFr = fills.map((f, fi) => [0, 1, 2, 3].map(k => { const s = K.sailRig('set', f, k); return local.add(`v10t:sail${fi}:${k}`, s.buf, s.ax, s.ay); }));
  }

  /** everything that needs the player and the camera (runs before the first frame) */
  private setup() {
    const p = this.player;
    p.minX = bx(34); p.maxX = bx(78);
    p.noRun = true;
    p.ground = 'wood';
    p.speedK = 0.6;
    p.x = SEATS.mori; p.y = FLOOR; p.facing = 1;
    p.poseOverride = 'sit';
    this.st.cam.tzoom = this.st.cam.zoom = 1.85;
    this.snapCamera();
    audio.setAmbience('ocean');
    if (this.phase !== 'stop') { audio.setEngine(0.32); this.progressBar(true); }
    else this.motor = false;
    this.life = startBoatLife(this);
    this.life.reefback.onSurface = close => { if (close) void this.reefbackMoment(); };
    // photos: each sea species once, and the discovery for the map
    const prev = this.cam.onShot;
    this.cam.onShot = ph => {
      prev?.(ph);
      const seen = new Set(ph.subjects.filter(x => x.inFrame > 0.4 && x.visible > 0.4).map(x => x.species));
      for (const sp of seen) {
        if (!(SEA_IDS as string[]).includes(sp)) continue;
        const fl = 'v10:photo:' + sp;
        if (game.save.flags[fl]) continue;
        game.save.flags[fl] = true;
        game.save.flags['v4:photo:' + sp] = true;
        discover({ id: 'species:' + sp, kind: 'species', name: sp, loc: this.plan.id, note: 'Photographed from the Kitten' });
        audio.play('discover', { vol: 0.5 });
      }
      game.persist();
    };
    this.addInteractables();
    if (this.phase === 'stop') this.atStop();
  }
  /** the scene is built: set up, then the departure lines */
  private async onEnter() {
    this.setup();
    if (this.phase === 'stop') return;
    spend(4, 'boat trip');
    await wait(900);
    if (this.plan.stop === 'maiden') await game.ui.titleCard('Launch Day', 'The Kitten', 'Maiden voyage', 2200);
    else await game.ui.titleCard('By boat', this.plan.name, this.plan.sub, 2200);
    await this.crewSay(this.plan.depart);
  }

  // ---------------------------------------------------------------- interactables
  private addInteractables() {
    const p = () => this.player;
    const it = (o: Partial<Interactable> & { x: number; label: string; action: () => void | Promise<void> }) => {
      const i = o as Interactable;
      i.y = FLOOR; i.w = i.w ?? 14; i.h = i.h ?? 30;
      this.interact.push(i);
    };
    it({ x: bx(34), label: 'Fish off the stern', w: 40, enabled: () => this.phase === 'stop' && this.plan.stop === 'fish' && !this.fishing, action: () => this.fish() });
    it({ x: bx(70), label: 'Snorkel over the reef', w: 40, enabled: () => this.phase === 'stop' && this.plan.stop === 'reef', action: () => this.dive() });
    it({ x: SEATS.joshu + 6, label: 'Tell Joshu to head home', w: 16, enabled: () => this.phase === 'stop' && (this.plan.stop === 'fish' || this.plan.stop === 'reef'), action: () => this.headHome() });
    it({ x: SEATS.aroha, label: 'Talk to Aroha', w: 12, enabled: () => !this.fishing && !this.cutscene, action: () => this.chat('aroha') });
    it({ x: SEATS.chunk, label: 'Scratch Chunk’s ears', w: 10, enabled: () => !this.fishing && !this.cutscene, action: () => this.pet() });
    void p;
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    const p = this.player, inp = game.input;
    // throttle: Shift opens it up; the boat eases off for wildlife moments and at the stop
    const free = !this.cutscene && !game.ui.blocking;
    const full = free && inp.down('run') && this.phase === 'sail' && this.easeT <= 0;
    const want = this.phase === 'stop' ? 0 : this.phase === 'arrive' ? 8 : this.easeT > 0 ? DRIFT + 2 : full ? FULL : CRUISE;
    this.speed = damp(this.speed, want, this.easeT > 0 ? 1.2 : 0.7, dt);
    this.easeT = Math.max(0, this.easeT - dt);
    this.weather.cruise = Math.max(DRIFT * (this.phase === 'stop' ? 0.4 : 1), this.speed);
    if (this.motor) audio.setEngine(0.18 + clamp(this.speed / FULL) * 0.5);
    if (this.phase === 'sail' && this.life) {
      this.dist += this.speed * dt;
      // the plan's moments
      const f = this.dist / this.len;
      while (this.evI < this.plan.events.length && f >= this.plan.events[this.evI].at) this.event(this.plan.events[this.evI++].kind);
      if (f >= 1) void this.arrive();
      this.updateProgress();
    }
    // ride the swell: heave with the sea under the pivot, pitch with its slope across the hull
    const hb = this.ocean.heightAt(bx(6)), hf = this.ocean.heightAt(bx(K.KL - 6)), hm = this.ocean.heightAt(PIV[0]);
    const targetRot = Math.atan2(hf - hb, (K.KL - 12) * BS) * 0.85;
    for (let n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n, i = 0; i < n; i++) {
      this.rotV += ((targetRot - this.rot) * 30 - this.rotV * 7) * h;
      this.rot += this.rotV * h;
    }
    this.rot = clamp(Number.isFinite(this.rot) ? this.rot : 0, -0.22, 0.22);
    this.bob = damp(this.bob, clamp(hm - WATER, -16, 16) * 0.9, 6, dt);
    if (this.main.xf) { this.main.xf[2] = this.rot; this.main.xf[4] = this.bob; }
    // bow spray when she noses into a wave at speed
    const bowY = hf;
    this.sprayT -= dt;
    if (this.phase !== 'stop' && bowY < this.bowPrev - 0.5 && this.sprayT <= 0 && this.speed > 14) {
      this.sprayT = rand.range(0.5, 1.4);
      const [wx, wy] = this.boatToWorld(K.KL - 2, K.KWL - 2);
      this.ocean.spray(wx + 2, wy, clamp(this.speed / FULL) * 0.45 + 0.05, 30, -1.4);
      if (this.speed > 50 && rand.chance(0.3)) { this.chunk.play('shake', 'sit').catch(() => {}); }
    }
    this.bowPrev = bowY;
    // the wake: foam peeling off the transom and the bow wave, drifting aft
    if (this.speed > 3 && rand.chance(dt * (10 + this.speed * 0.6))) {
      const [tx] = this.boatToWorld(0, K.KWL);
      this.foam.push({ x: tx - rand.range(0, 8), life: 0, max: rand.range(4, 9), w: rand.range(2, 6) });
    }
    for (let i = this.foam.length - 1; i >= 0; i--) { const q = this.foam[i]; q.life += dt; q.x -= this.weather.cruise * dt; q.w += dt * 0.6; if (q.life > q.max) this.foam.splice(i, 1); }
    // wind lines
    if (rand.chance(dt * 6)) {
      const c = this.st.cam;
      this.streaks.push({ x: c.x + 220 + rand.range(0, 160), y: c.y + rand.range(-90, 50), len: rand.range(10, 34), v: 110 + this.speed * 2 + rand.range(0, 80), life: 0, max: rand.range(0.6, 1.2) });
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) { const q = this.streaks[i]; q.life += dt; q.x -= q.v * dt; if (q.life > q.max) this.streaks.splice(i, 1); }
    // Mori sits when he isn't doing anything
    if (!this.fishing && !this.cutscene) {
      const idle = !this.cam.active && Math.abs(p.vx) < 2 && p.state === 'normal';
      this.sitT = idle ? this.sitT + dt : 0;
      if (this.sitT > 1.2) p.poseOverride = 'sit';
      else if (p.poseOverride === 'sit' && !idle) p.poseOverride = null;
    }
    // ambient crew life: a look at the sea now and then, a bark
    this.barkT -= dt;
    if (this.barkT <= 0 && free && !game.ui.bubbles.active && this.phase === 'sail') { this.barkT = rand.range(16, 28); this.ambientBark(); }
    super.update(dt);
    const ho = this.subLine();
    if (this.hud && ho !== this.lastSub) { this.lastSub = ho; this.hud.setPlace(this.plan.name, ho); }
  }
  private lastSub = '';

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }

  exit() {
    audio.setEngine(0);
    this.progressBar(false);
    super.exit();
  }

  private env(env: Env, dt: number) {
    void dt;
    applySeaEnv(env, this.weather);
    // a little warmer the further the day has gone
    const t = this.trip.clockT + clamp(this.dist / this.len) * 0.35;
    const g = smoothstep(1.6, 2.8, t);
    env.ambientTop = [env.ambientTop[0] * (1 + g * 0.12), env.ambientTop[1] * (1 + g * 0.02), env.ambientTop[2] * (1 - g * 0.1)];
  }

  // ---------------------------------------------------------------- boat space
  /** boat-local point -> world (the rocking transform) */
  boatToWorld(x: number, y: number): [number, number] { return this.shipToWorld(bx(x), by(y)); }
  /** boat plane (world, unrotated) -> world: the same transform the main layer draws with */
  shipToWorld(x: number, y: number): [number, number] {
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const dx = x - PIV[0], dy = y - PIV[1];
    return [PIV[0] + dx * c - dy * sn, PIV[1] + this.bob + dx * sn + dy * c];
  }
  seaY(x: number) { return this.ocean ? this.ocean.heightAt(x) : WATER; }

  // ---------------------------------------------------------------- LifeHost
  eye() { const p = this.player; const [x, y] = this.shipToWorld(p.x, p.y - p.height + 7); return { x, y, vx: p.vx }; }
  boat() {
    const [sx] = this.boatToWorld(0, K.KWL), [bx] = this.boatToWorld(K.KL, K.KWL);
    return {
      stern: sx, bow: bx, gunwale: this.boatToWorld(K.KL / 2, K.sheerY(K.KL / 2))[1],
      perches: [this.boatToWorld(2, K.sheerY(2) - 1), this.boatToWorld(K.KL - 3, K.sheerY(K.KL - 3) - 1), this.boatToWorld(K.MAST_X, -66)] as [number, number][],
    };
  }
  get bobber() { return this.fishing ? (window as unknown as { __fishView?: { bobber: { x: number; y: number } | null } }).__fishView?.bobber ?? null : null; }
  moving() { return this.speed > 12; }

  // ---------------------------------------------------------------- FishingHost
  rodTip(): [number, number] {
    const p = this.player;
    const h = p.body.handPos() ?? [p.x, p.y - 30];
    const a = 0.55, L = 17;
    return this.shipToWorld(h[0] + Math.cos(a) * L * p.facing, h[1] - Math.sin(a) * L);
  }
  setFishDraw(fn: ((r: Renderer) => void) | null) { this.fishDraw = fn; }
  setHeld(spr: { w: number; h: number; px: Uint32Array; grip?: [number, number] } | null, mode: 'chest' | 'overhead' = 'chest') { this.held = spr; this.heldMode = mode; }
  hullLine(): [number, number][] {
    const out: [number, number][] = [];
    for (let x = 0; x <= K.KL; x += 6) out.push(this.boatToWorld(x, K.keelY(x)));
    return out;
  }
  drawHullUnder(r: Renderer, color: number) {
    const f = this.fr.front;
    if (!f) return;
    r.pushTransform(PIV[0], PIV[1], this.rot, 0, this.bob);
    const y0 = f.ay + K.KWL + 1;
    if (y0 < f.h) r.drawSub(f, 0, y0, f.w, f.h - y0, BX - f.ax * BS, BY + (y0 - f.ay) * BS, BS, BS, color);
    r.popTransform();
  }
  cruise() { return this.weather.cruise; }
  gear() {
    if (!this.motor) return null as unknown as { prop: [number, number]; stern: [number, number]; keel: [number, number][] };
    const keel: [number, number][] = [];
    for (let x = 10; x < K.KL - 10; x += 12) keel.push(this.boatToWorld(x, K.keelY(x)));
    return { prop: this.boatToWorld(-8, K.KWL + 13), stern: this.boatToWorld(0, K.KWL), keel };
  }

  // ---------------------------------------------------------------- drawing
  private drawBoatBack(r: Renderer) {
    r.draw(this.fr.back, BX, BY, BS, BS);
  }
  private drawSail(r: Renderer, t: number) {
    if (this.phase === 'stop') { r.draw(this.fr.furled, BX, BY, BS, BS); return; }
    const fill = this.speed > 22 ? 2 : this.speed > 9 ? 1 : 0;
    const k = Math.floor(t * (fill === 2 ? 5 : 9)) % 4;
    r.draw(this.sailFr[fill][k], BX, BY, BS, BS);
  }
  private drawBoatFront(r: Renderer, t: number) {
    r.draw(this.fr.front, BX, BY, BS, BS);
    const mf = this.motor ? Math.floor(t * 24) % 3 : 0;
    r.draw(this.motorFr[mf], BX, BY, BS, BS);
    // the tiller: from the outboard's grip to Joshu's hand
    const jh = this.joshu.handPos();
    if (jh && this.joshu.anim === 'sit') {
      const gx = bx(16), gy = by(K.sheerY(0) - 8);
      const n = Math.ceil(Math.hypot(jh[0] - gx, jh[1] - gy));
      for (let i = 0; i <= n; i++) { const u = i / n; r.rect(Math.round(gx + (jh[0] - gx) * u), Math.round(gy + (jh[1] - gy) * u), 1, 1, packColor(0.15, 0.13, 0.17, 1)); }
    }
  }
  /** the ama rides in the water alongside: drawn over the near sea band, its wet half showing
   *  through the surface as a dark shape, the dry top in full colour */
  private drawAma(r: Renderer) {
    const f = this.fr.ama;
    r.pushTransform(PIV[0], PIV[1], this.rot, 0, this.bob);
    // rows of the sprite above the waterline at the float (boat-local y = cut)
    const [ax, ay] = this.boatToWorld((K.AMA.x0 + K.AMA.x1) / 2, K.AMA.cy);
    const surf = this.seaY(ax);
    const cut = clamp(K.AMA.cy + (surf - ay) / BS, K.AMA.cy - K.AMA.r - 1, K.AMA.cy + K.AMA.r + 1);
    const row = Math.round(f.ay + cut);
    r.draw(f, BX, BY, BS, BS, 0, packColor(0.42, 0.62, 0.66, 0.62));
    if (row > 0) r.drawSub(f, 0, 0, f.w, Math.min(f.h, row), BX - f.ax * BS, BY - f.ay * BS, BS, BS);
    r.popTransform();
    // a lick of foam where it cuts the surface
    if (this.speed > 4) for (let i = 0; i < 8; i++) {
      const [fx] = this.boatToWorld(K.AMA.x1 - 2 - i * 2, K.AMA.cy);
      r.rect(Math.round(fx), Math.round(this.seaY(fx) - 1), 2, 1, packColor(1, 1, 1, 0.75 - i * 0.08));
    }
  }
  /** foam on the water: the wake astern and the bow wave */
  private drawWake(r: Renderer) {
    for (const q of this.foam) {
      const a = (1 - q.life / q.max) * 0.8;
      const y = this.seaY(q.x) + 1;
      for (let i = 0; i < q.w; i++) if ((i + Math.floor(q.x)) % 3 !== 1) r.rect(Math.round(q.x + i - q.w / 2), Math.round(y + ((i * 7) % 3)), 1, 1, packColor(0.95, 1, 1, a));
    }
    if (this.speed > 6) {
      // the moustache at the stem
      const [bx] = this.boatToWorld(K.KL, K.KWL);
      const k = clamp(this.speed / FULL);
      for (let i = 0; i < 10; i++) {
        const x = bx - 2 - i * 1.6, y = this.seaY(x) - (1 - i / 10) * 3 * k - 1;
        r.rect(Math.round(x), Math.round(y), 2, 1, packColor(1, 1, 1, 0.9 - i * 0.07));
      }
    }
  }
  private drawWind(r: Renderer) {
    for (const q of this.streaks) {
      const a = Math.sin((q.life / q.max) * Math.PI) * 0.35;
      r.rect(Math.round(q.x), Math.round(q.y), Math.round(q.len), 1, packColor(1, 1, 1, a));
    }
  }
  /** the destination rising out of the sea ahead; home sinking astern */
  private drawIsles(r: Renderer, t: number) {
    const f = clamp(this.dist / this.len);
    const p = BAND_P.horizon, cx = this.st.cam.x * p;
    const hy = this.ocean.horizon + 1;
    const z = r.layerZoom;
    const half = r.VW / 2 / z;
    const H = this.horizon;
    // home: big on the left at the start, shrinking and sliding out of view
    if (this.plan.ahead !== 'home') {
      const k = lerp(1, 0.35, smoothstep(0, 0.6, f));
      const x = cx - half * 0.55 - f * half * 0.9;
      if (f < 0.75) r.draw(H.home, x, hy, k, k, 0, packColor(1, 1, 1, 1 - smoothstep(0.5, 0.75, f)));
    } else {
      // the maiden voyage keeps the bay in view: home slides across behind the boat and back
      const x = cx - half * 0.2 + Math.sin(f * Math.PI) * half * 0.5;
      r.draw(H.home, x, hy, 0.8, 0.8);
    }
    if (H.ahead) {
      const k = lerp(0.32, 1.35, smoothstep(0.15, 1, f));
      const x = cx + half * lerp(0.92, 0.16, smoothstep(0, 1, f));
      r.draw(H.ahead, x, hy, k, k);
      if (H.glow) { r.emissive(0.8); r.draw(H.glow, x, hy, k, k); r.emissive(); }
      // Motu Ahi breathes: a plume off the crater, birds wheeling over the cliffs
      if (this.plan.ahead === 'islet') {
        const tx = x + H.crater[0] * k, ty = hy - H.crater[1] * k;
        for (let i = 0; i < 9; i++) {
          const u = ((t * 0.05 + i / 9) % 1);
          const px = tx + u * 60 * k + Math.sin(u * 7 + i) * 4 * k, py = ty - u * 70 * k;
          r.draw(A.soft, px, py, (0.5 + u * 2.2) * k, (0.4 + u * 1.6) * k, 0, packColor(0.92, 0.92, 0.94, (1 - u) * 0.55));
        }
        for (let i = 0; i < 14; i++) {
          const a = t * (0.6 + (i % 4) * 0.15) + i * 1.7;
          const bx = x + (Math.cos(a) * 30 - 40 + (i % 5) * 12) * k, by = hy - (24 + Math.sin(a * 1.3) * 8 + (i % 3) * 6) * k;
          r.rect(Math.round(bx), Math.round(by), 1, 1, packColor(0.95, 0.95, 0.9, 0.9));
        }
      }
      if (this.plan.ahead === 'reef') {
        for (let i = 0; i < 12; i++) {
          const ph = Math.sin(t * 1.2 + i * 1.3);
          if (ph < 0.2) continue;
          r.rect(Math.round(x - 70 * k + i * 12 * k), Math.round(hy - 1 - ph * 2), Math.max(1, Math.round(5 * k)), 1, packColor(1, 1, 1, ph));
        }
      }
    }
  }
  /** Glass Reef: turquoise shallows and coral heads under the surface around the anchored boat */
  private drawReefTint(r: Renderer) {
    const k = this.phase === 'stop' ? 1 : smoothstep(0.75, 1, this.dist / this.len);
    if (k <= 0.01) return;
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    const top = this.ocean.bandSurfaceY('mid', (x0 + x1) / 2) + 3;
    r.rect(x0, top, x1 - x0, 60, packColor(0.3, 0.85, 0.8, 0.22 * k));
    for (let x = Math.floor(x0 / 18) * 18; x < x1; x += 18) {
      const h = 2 + ((x * 7) % 5);
      r.rect(x + ((x * 13) % 7), top + 5 + ((x * 3) % 6), 6, h, packColor(0.85, 0.45, 0.55, 0.25 * k));
    }
  }

  /** the catch held up in Mori's hand (from the fishing view): same as the Kittiwake's */
  private drawHeld(r: Renderer) {
    const h = this.held;
    this.heldBox = null; this.heldXf = null;
    if (!h) return;
    const p = this.player;
    const hand = p.body.handPos();
    if (!hand) return;
    const fr = this.heldFrame(h);
    const f = p.facing >= 0 ? 1 : -1;
    const gx = Math.round(hand[0] + f * 0.5), gy = Math.round(hand[1] - 1.5);
    const L = fr.w - fr.ax, avail = p.y - 3 - gy;
    let a = Math.PI / 2;
    if (L > avail) a = Math.asin(Math.max(0.35, Math.min(1, avail / L)));
    a += Math.sin(this.time * 2.3) * 0.03;
    const rot = f * a;
    r.draw(fr, gx, gy, f, 1, rot);
    this.heldXf = { gx, gy, f, rot, ax: fr.ax, ay: fr.ay };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[0, 0], [fr.w, 0], [fr.w, fr.h], [0, fr.h]]) {
      const [wx, wy] = this.heldPoint(u, v)!;
      x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
    }
    this.heldBox = [x0, y0, x1, y1];
  }
  heldPoint(u: number, v: number): [number, number] | null {
    const X = this.heldXf;
    if (!X) return null;
    const c = Math.cos(X.rot), sn = Math.sin(X.rot);
    const lx = (u - X.ax) * X.f, ly = v - X.ay;
    return this.shipToWorld(X.gx + lx * c - ly * sn, X.gy + lx * sn + ly * c);
  }
  private heldFrame(h: { w: number; h: number; px: Uint32Array; grip?: [number, number] }): Frame {
    let fr = this.heldFrames.get(h);
    if (fr) return fr;
    const b = new PixelBuffer(h.w, h.h);
    b.data.set(h.px);
    const [gx, gy] = h.grip ?? gripOf(h);
    fr = local.add('v10t:held:' + this.heldN++, b, gx + 0.5, gy + 0.5);
    this.heldFrames.set(h, fr);
    return fr;
  }

  // ---------------------------------------------------------------- the trip's moments
  private event(kind: TripEventKind) {
    this.life.cue(kind);
    const lines: Record<TripEventKind, [string, string, string][]> = {
      pod: [['aroha', 'Ka pai, look! Porpoises, on the bow wave!', 'excited'], ['mori', 'Moonfins! They’re riding the pressure wave off the stem!', 'excited']],
      kites: [['joshu', 'Flying fish off the bow! Hold on to your hat.', 'happy'], ['mori', 'Kitefish! Gliding on their fins!', 'excited']],
      reefback: [],
      flock: [['aroha', 'Tītī, slicing the waves. My koro said they carry the wind on their wings.', 'happy'], ['mori', 'Scythewings! The whole flock turned at once!', 'excited']],
      gulls: [['joshu', 'And here come the freeloaders.', 'teasing'], ['mori', 'Sackjaws. They’ve smelled the bait bucket.', 'thinking']],
      vanebill: [['aroha', 'Toroa. The wanderer. It came to see who we are.', 'serious'], ['mori', 'The vanebill, swooping right past us! Camera, camera, CAMERA!', 'excited']],
    };
    const l = lines[kind];
    if (l.length && !game.ui.bubbles.active) { const [who, text, expr] = rand.pick(l); this.bark(who, text, { expr }); }
  }
  /** the Reefback rises close off the bow: ease off and look */
  private async reefbackMoment() {
    if (this.phase !== 'sail') return;
    this.easeT = 26;
    audio.setEngine(0.15);
    await wait(1200);
    if (game.ui.bubbles.active) return;
    this.bark('aroha', rand.pick(['Off the bow. Something big is coming up. Slow, Joshu, slow...', 'Tohorā... no. Bigger. Look at its back. There is a reef growing on it!']), { expr: 'shocked' } as never);
    setTimeout(() => this.bark('mori', 'A REEFBACK. Right next to us. Camera up. Breathe, Mori. Breathe.', { expr: 'excited' } as never), 4200);
    if (!game.save.flags['v10:reefbackClose']) { game.save.flags['v10:reefbackClose'] = true; discover({ id: 'landmark:reefback:' + this.plan.id, kind: 'landmark', name: 'A Reefback surfacing beside the Kitten', loc: this.plan.id }); }
  }
  private lastBark = -99;
  /** one ambient line at a time (two barks at once pile their bubbles on top of each other) */
  bark(who: string, text: string, o: { expr?: string; emote?: string } = {}) {
    if (this.time - this.lastBark < 3.2) return;
    this.lastBark = this.time;
    super.bark(who, text, o);
  }
  private ambientBark() {
    const pool: [string, string, string][] = [
      ['joshu', 'Steady as she goes.', 'neutral'], ['joshu', 'Feel her lift on the swell? She likes this.', 'happy'],
      ['aroha', 'The wind is behind us. Tangaroa is in a good mood today.', 'happy'], ['aroha', 'Watch the water, not the sky. The sea tells you what is under it.', 'serious'],
      ['mori', 'Every wave out here could be hiding something nobody has ever seen.', 'excited'], ['chunk', '*sniffs the sea breeze, ears flapping*', 'happy'],
    ];
    if (this.jenna) pool.push(['jenna', 'The outboard is purring. I made it purr. I am the cat whisperer.', 'smug']);
    const [who, text, expr] = rand.pick(pool);
    this.bark(who, text, { expr });
  }
  private async crewSay(lines: [string, string, string][]) {
    await this.say(lines.map(([who, text, expr]) => ({ who, text, expr } as BubbleLine)));
  }

  // ---------------------------------------------------------------- arriving
  private async arrive() {
    if (this.phase !== 'sail') return;
    this.phase = 'arrive';
    this.progressBar(false);
    findLocation(this.plan.id);
    discover({ id: 'location:' + this.plan.id, kind: 'location', name: this.plan.name, loc: this.plan.id, note: 'Reached by boat' });
    const stop = this.plan.stop;
    this.cutscene = true;
    try {
      await this.crewSay(this.plan.arrive);
      if (stop === 'land') {
        await game.fadeTo(1, 1.6);
        audio.setEngine(0);
        const { goStop } = await import('../sites10/ocean');
        await goStop(this.plan.id);
        return;
      }
      if (stop === 'maiden') {
        await wait(600);
        await game.fadeTo(1, 1.4);
        audio.setEngine(0);
        const { sailHome } = await import('../sites10/ocean');
        await sailHome();
        return;
      }
      // fishing grounds / the reef: motor off, sail down
      this.atStop();
      this.trip.phase = 'stop';
    } finally { this.cutscene = false; }
  }
  private atStop() {
    this.phase = 'stop';
    this.motor = false;
    audio.setEngine(0);
    audio.play('splash', { vol: 0.4, pitch: 0.8 });
    if (this.plan.stop === 'fish') {
      this.life.cue('gulls');
      game.ui.toast('Fish off the stern, photograph whatever comes to look, and tell Joshu when to head home.', 'BOAT', 'teal', 5000);
    } else game.ui.toast('Snorkel over the reef with your camera, or tell Joshu to head home.', 'BOAT', 'teal', 5000);
  }

  // ---------------------------------------------------------------- at the stop
  private async fish() {
    if (this.fishing) return;
    this.fishing = true;
    const p = this.player, jo = this.joshu;
    try {
      // swap seats: Joshu forward, Mori to the stern
      jo.x = SEATS.mori + 8; jo.facing = -1;
      p.poseOverride = null;
      p.x = bx(26); p.facing = -1;
      this.cutscene = true;
      const { goFishing } = await import('../../ui/v4/fishing');
      spend(3, 'fishing');
      const c = await goFishing(this as never);
      this.cutscene = false;
      if (c) {
        const got = add('v10_fish', 1);
        if (got) game.ui.toast(`+1 <b>${ITEMS['v10_fish'].name}</b> (${c.fish.name}, ${c.len} cm) in Joshu’s bucket`, 'FISHING', 'teal', 3000);
        discover({ id: 'species:' + c.fish.id, kind: 'species', name: c.fish.name, loc: this.plan.id, note: `Caught on the Shelf, ${c.len} cm` });
        this.bark('joshu', rand.pick(['That’s dinner sorted. Nice work, lad.', 'A beauty! Into the bucket with her.', 'Ha! Your koro would be proud, Aroha says. I say I am.']), { expr: 'happy' });
      }
    } finally {
      this.cutscene = false;
      this.fishing = false;
      jo.x = SEATS.joshu; jo.facing = 1;
      p.x = SEATS.mori; p.facing = 1;
      p.poseOverride = null;
    }
  }
  private async dive() {
    await this.say([
      { who: 'aroha', text: 'Stay over the sand where you can. Don’t touch the coral, it cuts, and it is alive.', expr: 'serious' } as BubbleLine,
      { who: 'mori', text: 'Mask, snorkel, camera in its housing. See you in a bit!', expr: 'excited' } as BubbleLine,
    ]);
    audio.play('splashBig', { vol: 0.6 });
    const { goStop } = await import('../sites10/ocean');
    await goStop(this.plan.id);
  }
  private async headHome() {
    const ch = await this.say([{ who: 'joshu', text: 'Head home, then?', expr: 'neutral', choices: ['Head home', 'Not yet'] } as BubbleLine]);
    if (ch !== 0) return;
    this.cutscene = true;
    this.motor = true;
    audio.setEngine(0.4);
    await this.say([{ who: 'joshu', text: 'Right. Hold on to something.', expr: 'happy' } as BubbleLine]);
    await game.fadeTo(1, 1.4);
    audio.setEngine(0);
    const { sailHome } = await import('../sites10/ocean');
    await sailHome();
  }
  private async chat(who: 'aroha') {
    const lines = this.phase === 'stop' && this.plan.stop === 'fish'
      ? [['My koro said: give the first fish back to Tangaroa. Then he always caught the second.', 'serious'], ['Look at the colour of the water. Dark blue is deep. The fish like the edge.', 'neutral']]
      : [['Out here my tūpuna read the swells like a map. Each island bends them its own way.', 'serious'], ['You keep looking at the birds. Good. The birds always know where the land is.', 'happy'], ['Your Kitten sails well for a little boat. The ama keeps her honest.', 'teasing']];
    const [text, expr] = rand.pick(lines);
    await this.say([{ who, text, expr } as BubbleLine]);
  }
  private async pet() {
    const p = this.player;
    p.poseOverride = 'kneel';
    this.chunk.play('wiggle', 'sit').catch(() => {});
    audio.play('emoteHeart' as never, { vol: 0.4 });
    this.chunk.showEmote('heart', 1.4);
    await wait(900);
    p.poseOverride = null;
  }

  // ---------------------------------------------------------------- the route bar
  private progressBar(on: boolean) {
    if (!on) { this.progEl?.remove(); this.progEl = null; return; }
    if (this.progEl) return;
    const el = document.createElement('div');
    el.className = 'bt-route';
    el.innerHTML = `<style>
      .bt-route { position: absolute; left: 50%; top: max(44px, 7.5vh); transform: translateX(-50%); width: min(46vw, 420px); height: 22px; pointer-events: none; z-index: 6;
        font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 1px 0 #000; font-size: 13px; }
      .bt-route .ln { position: absolute; left: 6%; right: 6%; top: 10px; height: 0; border-top: 2px dashed rgba(255,255,255,0.7); }
      .bt-route .a, .bt-route .b { position: absolute; top: 2px; } .bt-route .a { left: 0; } .bt-route .b { right: 0; }
      .bt-route .k { position: absolute; top: 3px; width: 16px; height: 12px; margin-left: -8px; background: #e876a8; border: 2px solid #1a1014; border-radius: 0 0 6px 6px; }
    </style><div class="ln"></div><span class="a">Camp</span><span class="b">${this.plan.name}</span><div class="k"></div>`;
    game.ui.sceneLayer.appendChild(el);
    this.progEl = el;
  }
  private updateProgress() {
    const k = this.progEl?.querySelector('.k') as HTMLElement | null;
    if (k) k.style.left = `${6 + clamp(this.dist / this.len) * 88}%`;
  }
}
