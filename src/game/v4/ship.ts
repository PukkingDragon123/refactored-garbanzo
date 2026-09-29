// V4: the Kittiwake. A big side-view dollhouse boat: lower deck (engine room, hold, lab, Jenna's and
// Mori's cabins, forepeak), the deckhouse (galley, mess, captain's cabin), the bridge and the open
// decks. Walls fade away as you step inside a level. Interiors are dim: warm hanging bulbs, cool
// window light, screens and the fish tank glow, reflections on the varnished floor, dark corners.
// The story beats (breakfast, rounds, laptop, engine, deck, fishing, the storm) live in shipstory.ts.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { FieldScene, FieldSite } from '../scenes/field';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, rand } from '../../core/math';
import { Ocean, BAND_P, applySeaEnv, updater, Weather } from '../../world/ocean';
import { Sky, Rain, RAIN_P } from '../../world/ocean-sky';
import { paintShip4, S4, LAMPS, WINDOWS, SPOTS, LADDERS, roomAt, ShipSprite, Ship4Art } from '../../art/ship4';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { Actor } from '../../world/actor';
import { ChunkBuddy } from './buddy';
import type { Interactable } from '../../world/npc';
import type { Env } from '../../gfx/renderer';

export const PIVOT: [number, number] = [820, S4.WATER];

export type ShipPhase = 'morning' | 'engine' | 'deck' | 'storm' | 'wave';

interface Slider { fr: Frame; x: number; y: number; v: number; x0: number; x1: number; rot: number; hitT: number }

export class ShipScene4 extends FieldScene {
  phase: ShipPhase = 'morning';
  weather = new Weather();
  ocean!: Ocean;
  sky!: Sky;
  art!: Ship4Art;
  rot = 0;
  bob = 0;
  /** extra scripted roll (impact jolts, the giant wave) */
  jolt = 0;
  private joltV = 0;
  hullA = 1;
  houseA = 1;
  bridgeA = 1;
  /** 0 outside .. 1 inside (drives the dim ambient) */
  inside = 0;
  /** storm light flicker (0..1 multiplier for interior lamps) */
  flick = 1;
  private flickT = 0;
  /** lamps off entirely (blackout moments) */
  power = 1;
  chunk!: Actor;
  buddy!: ChunkBuddy;
  jenna!: Actor;
  joshu!: Actor;
  private fr: Record<string, Frame> = {};
  private tankFish: { x: number; y: number; vx: number; k: number; t: number }[] = [];
  private bubbles: { x: number; y: number; v: number }[] = [];
  sliders: Slider[] = [];
  private flagFr: Frame[] = [];
  engineOn = true;
  /** fishing line + bobber (world space, drawn outside the rocking transform) */
  bobber: { x: number; y: number; dip: number; fly: number } | null = null;
  /** Mori is carrying Chunk in his arms */
  carrying = false;
  /** called every frame by the story module */
  story: { update(dt: number): void; enter(): Promise<void> } | null = null;

  constructor() {
    let me: ShipScene4 | null = null;
    const art = paintShip4({});
    const site: FieldSite = {
      id: 'boat', name: 'The Kittiwake', width: 1640, camY: 210, followY: true, minY: -140, maxY: 470,
      spawnX: SPOTS.moriBed[0], exitX: 0, waterY: S4.WATER, ambience: 'boatCalm', music: 'voyage', ground: 'wood',
      noGuide: true, noExit: true, spawns: [], build: () => me!.buildShip(),
    };
    super(site, 'day');
    me = this;
    this.art = art;
    this.allowPack = false;
  }

  hudOpts() {
    const sub = this.phase === 'storm' || this.phase === 'wave' ? 'Day 1 · The storm' : 'Day 1 at sea';
    return {
      place: 'The Kittiwake', sub,
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">W</span><span class="key">S</span> ladders · <span class="key">E</span> interact · <span class="key">Q</span> camera · <span class="key">Shift</span> run',
    };
  }

  // ---------------------------------------------------------------- building
  private sprite(name: string, sp: ShipSprite | null, glow: false | true | 'sky' = false): Frame | null {
    if (!sp) return null;
    const b = glow === 'sky' ? sp.sky : glow ? sp.glow : sp.buf;
    if (!b) return null;
    return local.add('s4:' + name + (glow === 'sky' ? ':s' : glow ? ':g' : ''), b, 0, 0);
  }

  buildShip() {
    const st = this.st, r = game.r;
    st.minX = -300;
    st.maxX = 1940;
    st.envHook = (env, dt) => this.env(env, dt);
    this.ocean = new Ocean({ y: S4.WATER, horizon: S4.WATER - 120, seed: 11, weather: this.weather });
    this.sky = new Sky({ weather: this.weather, horizon: this.ocean.horizon, horizonP: BAND_P.horizon, seed: 7 });
    this.sky.birds = true;
    this.sky.onStrike = big => {
      audio.play(big ? 'thunderClose' : 'thunder', { vol: big ? 0.9 : 0.5 });
      if (big) r.post.flash = 0.45;
    };
    st.addScreenLayer('sky').add(this.sky);
    // distant bands barely move vertically (the horizon stays at eye level as you climb the decks)
    for (const b of ['horizon', 'far', 'mid'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0, b === 'mid' ? 0.85 : BAND_P[b]).add(this.ocean.band(b));
    st.addLayer('rain-far', RAIN_P.far, 0, 0, 0).add(new Rain(this.weather, 'far', 1));
    const main = st.addLayer('main', 1, 0, 1, 0);
    main.xf = [PIVOT[0], PIVOT[1], 0, 0, 0];
    this.main = main;
    const A4 = this.art;
    const F = (n: string, sp: ShipSprite | null, g: false | true | 'sky' = false) => { const f = this.sprite(n, sp, g); if (f) this.fr[n + (g === 'sky' ? 'S' : g ? 'G' : '')] = f; return f; };
    for (const k of ['deckBack', 'lower', 'house', 'bridge', 'hull', 'houseExt', 'bridgeExt', 'deckFront'] as const) { F(k, A4[k]); F(k, A4[k], true); F(k, A4[k], 'sky'); }
    const at = (k: keyof Ship4Art) => A4[k];
    const draw = (rr: Renderer, k: keyof Ship4Art, a = 1, glow: boolean | 'sky' = false, e = 1) => {
      const f = this.fr[k + (glow === 'sky' ? 'S' : glow ? 'G' : '')];
      if (!f || a <= 0.01) return;
      if (glow) rr.emissive(e);
      rr.draw(f, at(k).x, at(k).y, 1, 1, 0, a < 1 ? packColor(1, 1, 1, a) : 0xffffffff);
      if (glow) rr.emissive();
    };
    // behind everything on the boat plane: far bulwark, mast, deck gear; then the rooms
    main.add(new Custom(-10, rr => draw(rr, 'deckBack')));
    main.add(new Custom(-8, rr => {
      draw(rr, 'lower'); draw(rr, 'house'); draw(rr, 'bridge');
    }));
    main.add(new Custom(-7.9, (rr, s) => {
      const tw = 0.85 + 0.15 * Math.sin(s.time * 2.3);
      const k = this.power * this.flick;
      draw(rr, 'lower', (1 - this.hullA) * (0.35 + 0.65 * k) * tw, true, 1);
      draw(rr, 'house', (1 - this.houseA) * (0.35 + 0.65 * k), true, 1);
      draw(rr, 'bridge', (1 - this.bridgeA) * (0.35 + 0.65 * k), true, 1);
      // daylight in the window glass: bright on a fine day, grey in the storm, white on a lightning strike
      const day = Math.min(1.2, (1 - this.weather.storm * 0.85) * 0.8 + this.weather.lightning * 0.9);
      draw(rr, 'lower', (1 - this.hullA) * day, 'sky', 1);
      draw(rr, 'house', (1 - this.houseA) * day, 'sky', 1);
      draw(rr, 'bridge', (1 - this.bridgeA) * day, 'sky', 1);
    }));
    main.add(new Custom(-7, (rr, s) => this.drawAnimated(rr, s.time)));
    main.add(new Custom(20, rr => this.drawSliders(rr)));
    // exterior walls (fade when you step inside), window glow, the near rail
    main.add(new Custom(80, (rr, s) => {
      draw(rr, 'hull', this.hullA);
      draw(rr, 'houseExt', this.houseA);
      draw(rr, 'bridgeExt', this.bridgeA);
      const night = this.weather.storm * 0.8 + 0.25;
      const k = this.power * this.flick * night * (0.9 + 0.1 * Math.sin(s.time * 3));
      draw(rr, 'hull', this.hullA * k, true, 1);
      draw(rr, 'houseExt', this.houseA * k, true, 1);
      draw(rr, 'bridgeExt', this.bridgeA * k, true, 1);
    }));
    main.add(new Custom(90, rr => draw(rr, 'deckFront')));
    main.add(new Custom(100, (rr, s) => this.drawLights(rr, s.time)));
    // the sea in front of the hull, then rain
    // the near swell sits on the hull's plane vertically, so the waterline matches at any camera height
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0, 1).add(this.ocean.band('near'));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0, 1).add(this.ocean.band('front'));
    st.addLayer('rain-mid', RAIN_P.mid, 0, 0, 0, 1).add(new Rain(this.weather, 'mid', 2));
    st.addLayer('rain-near', RAIN_P.near, 0, 0, 0, 1).add(new Rain(this.weather, 'near', 3));
    st.layer('sea-horizon').add(updater(dt => { this.weather.update(dt); this.ocean.update(dt); }));
    st.layer('sea-near').add(new Custom(50, rr => this.drawLine(rr)));
    // walkable decks and ladders
    const T = st.terrain;
    T.addGround([[S4.lower.x0, S4.lower.floor], [S4.lower.x1, S4.lower.floor]], 'ground');
    T.addGround([[S4.main.x0, S4.main.y], [S4.main.x1, S4.main.y]], 'bridge');
    T.addGround([[S4.upper.x0, S4.upper.y], [S4.bridge.x1, S4.upper.y]], 'bridge');
    for (const L of LADDERS) T.addClimb(L.x, L.top, L.bottom, 'ladder');
    // ladders: click / tap to climb
    for (const L of LADDERS) {
      const nm = L.id === 'roof' ? 'the roof ladder' : L.id === 'bridge' ? 'the bridge ladder' : L.id === 'galley' ? 'the galley ladder' : 'the hatch';
      this.interact.push(
        { x: L.x, y: L.top, w: 10, h: 14, label: `Climb down ${nm}`, standX: L.x, enabled: () => Math.abs(this.player.y - L.top) < 6 && this.player.state === 'normal', action: () => this.climbLadder({ x: L.x, y0: L.top, y1: L.bottom }, 1) } as Interactable,
        { x: L.x, y: L.bottom, w: 10, h: 14, label: `Climb up ${nm}`, standX: L.x, enabled: () => Math.abs(this.player.y - L.bottom) < 6 && this.player.state === 'normal', action: () => this.climbLadder({ x: L.x, y0: L.top, y1: L.bottom }, -1) } as Interactable,
      );
    }
    // crew
    this.jenna = this.addActor('jenna', SPOTS.jennaDesk[0], SPOTS.jennaDesk[1], 1);
    this.jenna.idleAnim = 'typeFast';
    this.jenna.setAnim('typeFast');
    this.joshu = this.addActor('joshu', SPOTS.helm[0] - 14, SPOTS.helm[1], 1);
    this.joshu.idleAnim = 'steer';
    this.joshu.setAnim('steer');
    this.chunk = this.addActor('chunk', SPOTS.chunkBed[0], SPOTS.chunkBed[1], 1);
    this.chunk.z = 45;
    // tank life
    for (let i = 0; i < 5; i++) this.tankFish.push({ x: 660 + rand.next() * 50, y: 314 + rand.next() * 18, vx: (rand.next() < 0.5 ? -1 : 1) * (6 + rand.next() * 8), k: i % 3, t: rand.next() * 10 });
    for (let i = 0; i < 6; i++) this.bubbles.push({ x: 700 + rand.next() * 6, y: 310 + rand.next() * 28, v: 8 + rand.next() * 8 });
    this.makeSmallFrames();
  }

  private makeSmallFrames() {
    const fish = (c1: string, c2: string) => {
      const b = new PixelBuffer(6, 3);
      const C1 = hex(c1), C2 = hex(c2);
      for (const [x, y, c] of [[1, 0, C1], [2, 0, C1], [3, 0, C1], [0, 1, C2], [1, 1, C1], [2, 1, C1], [3, 1, C1], [4, 1, C1], [5, 0, C2], [5, 2, C2], [1, 2, C2], [2, 2, C2], [3, 2, C2]] as [number, number, number][]) b.set(x, y, c);
      b.set(4, 1, hex('#101010'));
      return b;
    };
    this.fr.fish0 = local.add('s4:fish0', fish('#ff8a30', '#c85a1a'), 3, 1);
    this.fr.fish1 = local.add('s4:fish1', fish('#5ab8ff', '#2a6ab8'), 3, 1);
    this.fr.fish2 = local.add('s4:fish2', fish('#ffe060', '#c8a020'), 3, 1);
    const dot = new PixelBuffer(1, 1);
    dot.set(0, 0, hex('#bfefff'));
    this.fr.dot = local.add('s4:dot', dot, 0, 0);
    // stern flag (4 wave frames)
    for (let f = 0; f < 4; f++) {
      const b = new PixelBuffer(16, 12);
      for (let x = 0; x < 16; x++) {
        const off = Math.round(Math.sin((x / 16) * Math.PI * 1.6 + f * 1.57) * (x / 16) * 2);
        for (let y = 0; y < 9; y++) {
          const Y = y + off + 1;
          if (Y < 0 || Y >= 12) continue;
          const c = x < 7 && y < 5 ? (y === 2 || x === 3 ? hex('#e8e8f0') : hex('#2a3a7a')) : hex('#1e2a6a');
          b.set(x, Y, (x + f) % 7 === 0 ? hex('#3a4a8a') : c);
        }
        if (x === 11 && off > -3) b.set(x, 4 + off, hex('#d83a3a'));
        if (x === 13) b.set(x, 6 + off, hex('#d83a3a'));
      }
      this.flagFr.push(local.add('s4:flag' + f, b, 0, 1));
    }
  }

  // ---------------------------------------------------------------- env & lights
  private env(env: Env, dt: number) {
    void dt;
    applySeaEnv(env, this.weather);
    const k = this.inside;
    const mixv = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const storm = this.weather.storm;
    env.ambientTop = mixv(env.ambientTop, [0.3 - storm * 0.08, 0.27 - storm * 0.07, 0.29 - storm * 0.05], k * 0.9);
    env.ambientBottom = mixv(env.ambientBottom, [0.22 - storm * 0.06, 0.2 - storm * 0.05, 0.22 - storm * 0.04], k * 0.9);
    env.vignette = Math.max(env.vignette, 0.4 + 0.22 * k);
    env.bloom = env.bloom + 0.25 * k;
    env.bloomThreshold = Math.min(env.bloomThreshold, 0.9 - 0.15 * k);
    env.saturation *= 1 - 0.06 * k;
    env.gain = mixv(env.gain, [1.05, 0.98, 0.92], k * 0.6);
  }

  private levelVis(room: string): number {
    if (room === 'deck') return 1;
    const lv = ['engine', 'hold', 'lab', 'jenna', 'mori', 'forepeak'].includes(room) ? this.hullA : room === 'bridge' ? this.bridgeA : this.houseA;
    return 1 - lv;
  }

  private drawLights(r: Renderer, time: number) {
    const storm = this.weather.storm;
    for (let i = 0; i < LAMPS.length; i++) {
      const L = LAMPS[i];
      const vis = this.levelVis(L.room);
      if (vis <= 0.02) continue;
      let k = L.k * vis;
      if (L.kind === 'bulb' || L.kind === 'fairy') k *= this.power * this.flick;
      if (L.flicker) k *= 1 + (Math.sin(time * 13.7 + i) * 0.5 + Math.sin(time * 7.1 + i * 2) * 0.35) * L.flicker * 0.4;
      if (L.kind === 'tank') k *= 0.85 + 0.15 * Math.sin(time * 1.3);
      if (L.kind === 'stove') k *= 0.8 + 0.2 * Math.sin(time * 9) * Math.sin(time * 5.3);
      if (L.kind === 'screen') k *= 0.9 + 0.1 * Math.sin(time * 17 + i);
      if (k <= 0.02) continue;
      r.light(L.x, L.y, L.r, L.c[0], L.c[1], L.c[2], k, 0.25);
      // warm pool reflected on the varnished floor under hanging bulbs
      if (L.kind === 'bulb' && L.room !== 'deck') {
        const lv = roomAt(L.x, L.y + 30);
        const floorY = lv ? (lv.level === 'lower' ? S4.lower.floor : lv.level === 'house' ? S4.house.floor : S4.bridge.floor) : L.y + 60;
        r.fxDraw(A.glow, L.x, floorY + 2, 0.9, 0.12, 0, packColor(L.c[0], L.c[1] * 0.9, L.c[2] * 0.8, 1), 0.45 * k);
        r.fxDraw(A.glow, L.x, L.y, 0.32, 0.32, 0, packColor(L.c[0], L.c[1], L.c[2], 1), 0.55 * k);
      }
    }
    // window light: cool shafts slanting into the rooms (daytime), grey and dim in the storm
    const day = 1 - storm * 0.75;
    for (const W of WINDOWS) {
      const vis = this.levelVis(W.room);
      if (vis <= 0.02) continue;
      const k = vis * day * (W.porthole ? 0.9 : 1.2);
      r.lightTex(A.cone, W.x, W.y, W.porthole ? 0.8 : 1.1, W.porthole ? 0.34 : 0.5, 1.05, packColor(0.62, 0.78, 1, 1), k);
      r.light(W.x, W.y, W.porthole ? 26 : 40, 0.55, 0.7, 0.95, 0.5 * k);
    }
    // deck lights: mast lamp and the wheelhouse glow outside
    r.light(1263, 31, 70, 1, 0.9, 0.62, 0.5 + storm * 0.8);
  }

  private drawAnimated(r: Renderer, t: number) {
    // fish tank: fish and bubbles (only when the lower deck is open)
    if (this.hullA < 0.98) {
      const a = 1 - this.hullA;
      const col = packColor(1, 1, 1, a);
      for (const f of this.tankFish) r.draw(this.fr['fish' + f.k], f.x, f.y, f.vx > 0 ? 1 : -1, 1, 0, col);
      r.emissive(0.8);
      for (const b of this.bubbles) r.draw(this.fr.dot, b.x, b.y, 1, 1, 0, col);
      r.emissive();
    }
    // radar sweep on the bridge console
    if (this.bridgeA < 0.98) {
      const a = t * 2.4;
      r.emissive(1);
      for (let i = 1; i <= 5; i++) r.draw(this.fr.dot, 1058 + Math.round(Math.cos(a) * i), 168 + Math.round(Math.sin(a) * i), 1, 1, 0, packColor(0.5, 1, 0.6, 1 - this.bridgeA));
      r.emissive();
    }
    // stern flag
    const fi = Math.floor(t * (6 + this.weather.storm * 10)) % this.flagFr.length;
    r.draw(this.flagFr[fi], 53, S4.main.y - 63);
  }

  private drawSliders(r: Renderer) {
    for (const s of this.sliders) r.draw(s.fr, s.x, s.y, 1, 1, s.rot);
  }

  /** add a loose object that slides around when the deck tilts (storm) */
  addSlider(buf: PixelBuffer, name: string, x: number, y: number, x0: number, x1: number) {
    const fr = local.add('s4sl:' + name, buf, buf.w / 2, buf.h - 1);
    this.sliders.push({ fr, x, y, v: 0, x0, x1, rot: 0, hitT: 0 });
  }

  /** ship-local point → world (applies the rocking transform) */
  shipToWorld(x: number, y: number): [number, number] {
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const dx = x - PIVOT[0], dy = y - PIVOT[1];
    return [PIVOT[0] + dx * c - dy * sn, PIVOT[1] + this.bob + dx * sn + dy * c];
  }
  seaY(x: number) {
    return this.ocean ? this.ocean.heightAt(x) : S4.WATER;
  }
  /** tip of the fishing rod (world) while Mori holds it out */
  rodTip(): [number, number] {
    const p = this.player;
    const h = p.body.handPos() ?? [p.x, p.y - 30];
    const a = 0.55, L = 17;
    return this.shipToWorld(h[0] + Math.cos(a) * L * p.facing, h[1] - Math.sin(a) * L);
  }
  setBobber(b: { x: number; y: number; dip: number; fly: number } | null) {
    this.bobber = b;
  }
  private drawLine(r: Renderer) {
    const b = this.bobber;
    if (!b) return;
    const [tx, ty] = this.rodTip();
    const by = b.y + (b.fly > 0 ? 0 : b.dip);
    const n = Math.max(8, Math.ceil(Math.hypot(b.x - tx, by - ty) / 2));
    const sag = b.fly > 0 ? 0 : Math.min(18, Math.abs(b.x - tx) * 0.12);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = tx + (b.x - tx) * u, y = ty + (by - ty) * u + Math.sin(u * Math.PI) * sag;
      r.rect(Math.round(x), Math.round(y), 1, 1, packColor(0.92, 0.92, 0.95, 0.75));
    }
    // bobber: red cap, white float
    const X = Math.round(b.x) - 1, Y = Math.round(by) - 3;
    r.rect(X, Y, 3, 2, packColor(0.85, 0.2, 0.18, 1));
    r.rect(X, Y + 2, 3, 2, packColor(0.95, 0.95, 0.92, 1));
    if (b.dip > 4) for (let i = 0; i < 3; i++) r.rect(X - 3 + i * 3, Y + 4, 2, 1, packColor(1, 1, 1, 0.8));
  }

  /** a new resident for the lab tank */
  addTankFish() {
    this.tankFish.push({ x: 686, y: 322, vx: 7, k: 2, t: 0 });
  }

  /** keep Chunk in Mori's arms */
  private holdChunk() {
    const p = this.player, c = this.chunk;
    const h = p.body.handPos();
    if (!h) return;
    c.terrain = null;
    c.x = h[0] - p.facing * 2;
    c.y = h[1] + 9;
    c.facing = p.facing;
    c.z = 55;
    if (c.anim !== 'carried') c.setAnim('carried');
  }

  // ---------------------------------------------------------------- frame
  /** which deck the player is on */
  level(y = this.player.y): 'lower' | 'main' | 'upper' {
    if (y > S4.lower.ceil) return 'lower';
    if (y > S4.upper.y + 4) return 'main';
    return 'upper';
  }
  levelSpan(y: number): [number, number] {
    const lv = this.level(y);
    return lv === 'lower' ? [S4.lower.x0 + 8, S4.lower.x1 - 8] : lv === 'main' ? [S4.main.x0 + 6, S4.main.x1 - 6] : [S4.upper.x0 + 6, S4.bridge.x1 - 6];
  }

  update(dt: number) {
    const p = this.player;
    // rolling: gentle swell at sea, violent in the storm, plus scripted jolts
    const storm = this.weather.storm;
    const t = this.time;
    this.joltV += (-this.jolt * 26 - this.joltV * 5) * dt;
    this.jolt += this.joltV * dt;
    this.rot = Math.sin(t * 0.55) * (0.006 + storm * 0.07) + Math.sin(t * 1.3 + 1) * (0.002 + storm * 0.03) + this.jolt;
    this.bob = this.ocean ? (this.ocean.heightAt(PIVOT[0]) - S4.WATER) * 0.35 : 0;
    if (!Number.isFinite(this.bob)) this.bob = 0;
    if (!Number.isFinite(this.rot)) { this.rot = 0; this.jolt = 0; this.joltV = 0; }
    this.bob = clamp(this.bob, -30, 30);
    if (this.main.xf) { this.main.xf[2] = this.rot; this.main.xf[4] = this.bob; }
    p.tilt = this.rot * (storm > 0.2 ? 1.6 : 1);
    // cutaways
    const inLower = p.y > S4.lower.ceil + 2;
    const inHouse = p.y <= S4.house.floor + 2 && p.y > S4.house.ceil && p.x > S4.house.x0 - 2 && p.x < S4.house.x1 + 2;
    const onBridge = p.y <= S4.bridge.floor + 2 && p.y > S4.bridge.ceil && p.x > S4.bridge.x0 - 4 && p.x < S4.bridge.x1 + 2;
    this.hullA = damp(this.hullA, inLower ? 0 : 1, 9, dt);
    this.houseA = damp(this.houseA, inHouse ? 0 : 1, 9, dt);
    this.bridgeA = damp(this.bridgeA, onBridge ? 0 : 1, 9, dt);
    this.inside = damp(this.inside, inLower || inHouse || onBridge ? 1 : 0, 3.5, dt);
    // per-level walking bounds
    if (p.state !== 'climb') {
      const [a, b] = this.levelSpan(p.y);
      p.minX = a; p.maxX = b;
    }
    // storm flicker
    if (storm > 0.3) {
      this.flickT -= dt;
      if (this.flickT <= 0) {
        this.flickT = rand.range(0.05, 0.4) / storm;
        this.flick = rand.next() < 0.18 * storm ? rand.range(0, 0.3) : 1;
      }
    } else this.flick = 1;
    // tank fish and bubbles
    for (const f of this.tankFish) {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += Math.sin(f.t * 1.7) * 3 * dt;
      if (f.x < 658 || f.x > 712) { f.vx = -f.vx; f.x = clamp(f.x, 658, 712); }
    }
    for (const b of this.bubbles) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.4) * 0.1; if (b.y < 310) { b.y = 338; b.x = 700 + rand.next() * 6; } }
    // sliding objects
    for (const s of this.sliders) {
      s.v += Math.sin(this.rot) * 420 * dt;
      s.v *= 1 - dt * 1.4;
      s.x += s.v * dt;
      s.rot = this.rot * 0.6;
      s.hitT -= dt;
      if (s.x < s.x0 || s.x > s.x1) {
        s.x = clamp(s.x, s.x0, s.x1);
        if (Math.abs(s.v) > 30 && s.hitT <= 0) { s.hitT = 0.4; if (this.hullA < 0.5 || this.houseA < 0.5 || Math.abs(s.y - p.y) < 20) audio.play('woodCreak', { vol: 0.3 }); }
        s.v = -s.v * 0.25;
      }
    }
    super.update(dt);
    if (this.carrying) this.holdChunk();
    else this.buddy?.update(dt);
    this.story?.update(dt);
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }
}

export { SPOTS, S4 };
