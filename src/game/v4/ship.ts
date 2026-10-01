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
import { paintShip4, S4, LAMPS, WINDOWS, SPOTS, LADDERS, roomAt, ShipSprite, Ship4Art, FLOORS, MOUNTS, TANK, PIVOT5, CUTLINE } from '../../art/ship5';
import { paintBoatParts } from '../../art/boat';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { fishTank, gripOf } from '../../art/v9/fish';
import type { Actor } from '../../world/actor';
import { ChunkBuddy } from './buddy';
import type { Interactable } from '../../world/npc';
import type { Env } from '../../gfx/renderer';

export const PIVOT: [number, number] = PIVOT5;
/** the mess table's bounding box in ship pixels (see makeTableFront) */
const TABLE_FRONT = { x: 288, y: 171, w: 44, h: 32 };
/** the hanging tablecloth flap during the storm (left of the pedestal and the chair) */
export const CLOTH = { x0: 289, x1: 306, top: 187, bottom: 199 };
/** where Chunk curls up under the mess table */
export const UNDER_TABLE: [number, number] = [298, 202];

export type ShipPhase = 'morning' | 'engine' | 'deck' | 'storm' | 'wave';

interface Slider { fr: Frame; x: number; y: number; v: number; x0: number; x1: number; rot: number; hitT: number; dy: number; probe: number }

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
  /** tank residents: Gerald (glass maomao), Captain Bubbles (bubble puffer), Tiny Tim and the shy one, plus your catches */
  private tankFish: { x: number; y: number; vx: number; k: string; t: number; shy?: boolean }[] = [];
  private bubbles: { x: number; y: number; v: number }[] = [];
  sliders: Slider[] = [];
  private flagFr: Frame[] = [];
  private partFr: Record<string, Frame[]> = {};
  engineOn = true;
  /** fishing line + bobber (world space, drawn outside the rocking transform) */
  bobber: { x: number; y: number; dip: number; fly: number } | null = null;
  /** fishing effects in world space (cast arc preview, ripples, splashes): packed ABGR pixels */
  fishFx: { x: number; y: number; c: number }[] | null = null;
  /** a caught fish held up in Mori's hands (ABGR sprite facing right): across the chest or over his head */
  held: { w: number; h: number; px: Uint32Array; grip?: [number, number] } | null = null;
  heldMode: 'chest' | 'overhead' = 'chest';
  /** the fishing minigame draws its world (underwater view, shadows, line, float) through this */
  fishDraw: ((r: Renderer) => void) | null = null;
  /** Mori is carrying Chunk in his arms */
  carrying = false;
  /** the storm: Chunk is hiding under the mess table behind the hanging cloth (shake rustles it, lift raises it) */
  underTable: { shake: number; lift: number } | null = null;
  /** called every frame by the story module */
  story: { update(dt: number): void; enter(): Promise<void> } | null = null;

  constructor() {
    let me: ShipScene4 | null = null;
    const art = paintShip4({});
    const site: FieldSite = {
      id: 'boat', name: 'The Kittiwake', width: S4.W, camY: 120, followY: true, minY: -120, maxY: 300,
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
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">W</span><span class="key">S</span> ladders · <span class="key">E</span> interact · <span class="key">Q</span> camera',
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
    st.minX = -240;
    st.maxX = S4.W + 240;
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
    main.add(new Custom(95, rr => this.drawHeld(rr)));
    // the sea in front of the hull, then rain
    // the near swell sits on the hull's plane vertically, so the waterline matches at any camera height
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0, 1).add(this.ocean.band('near'));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0, 1).add(this.ocean.band('front'));
    // fishing: the underwater cross-section, fish shadows, line and float, over the sea bands
    st.addLayer('sea-fish', 1, 0, 0, 0, 1).add(new Custom(0, rr => this.fishDraw?.(rr)));
    st.addLayer('rain-mid', RAIN_P.mid, 0, 0, 0, 1).add(new Rain(this.weather, 'mid', 2));
    st.addLayer('rain-near', RAIN_P.near, 0, 0, 0, 1).add(new Rain(this.weather, 'near', 3));
    st.layer('sea-horizon').add(updater(dt => { this.weather.update(dt); this.ocean.update(dt); }));
    st.layer('sea-near').add(new Custom(50, rr => this.drawLine(rr)));
    // walkable decks and ladders
    const T = st.terrain;
    T.addGround(FLOORS.lower, 'ground');
    T.addGround(FLOORS.deck, 'bridge');
    for (const L of LADDERS) T.addClimb(L.x, L.top, L.bottom, 'ladder');
    // ladders: click / tap to climb
    for (const L of LADDERS) {
      const nm = L.id === 'galley' ? 'the companionway' : L.id === 'fwd' ? 'the fore hatch' : 'the engine hatch';
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
    for (const [k, shy] of [['glassmaomao', false], ['bubblepuffer', false], ['spinnaker', false], ['sixfinger', true]] as [string, boolean][]) {
      this.tankFish.push({ x: TANK.x0 + rand.next() * (TANK.x1 - TANK.x0), y: shy ? TANK.y1 : TANK.y0 + rand.next() * (TANK.y1 - TANK.y0), vx: (rand.next() < 0.5 ? -1 : 1) * (shy ? 0.6 : 3 + rand.next() * 4), k, t: rand.next() * 10, shy });
    }
    for (const f of this.tankFish) this.tankFrame(f.k);
    for (let i = 0; i < 4; i++) this.bubbles.push({ x: TANK.bx + rand.next() * 3, y: TANK.y0 + rand.next() * (TANK.y1 - TANK.y0), v: 5 + rand.next() * 5 });
    const parts = paintBoatParts({});
    for (const k of ['wheel', 'radar', 'flag'] as const) this.partFr[k] = parts[k].map((sp, i) => local.add(`s5:${k}${i}`, sp.buf, sp.ax, sp.ay));
    this.makeSmallFrames();
    this.makeTableFront();
    // whoever sits down at the mess table sits BEHIND it: its cloth, pedestal and crockery drawn over them
    main.add(new Custom(52, rr => {
      const f = this.fr.tableFront;
      if (!f || this.hullA > 0.98) return;
      const seated = (a: { x: number; y: number; anim?: string } | undefined) => !!a && Math.abs(a.x - SPOTS.messSeat[0]) < 26 && a.y > S4.lower.ceil && /^(sit|eat)/.test(a.anim ?? '');
      if (!this.underTable && !seated(this.player as never) && !seated(this.jenna as never) && !seated(this.joshu as never)) return;
      rr.draw(f, TABLE_FRONT.x, TABLE_FRONT.y, 1, 1, 0, this.hullA > 0.02 ? packColor(1, 1, 1, 1 - this.hullA) : 0xffffffff);
    }));
    // the storm: the tablecloth slid half off the mess table and hangs to the floor, with Chunk behind it
    main.add(new Custom(53, (rr, s) => this.drawCloth(rr, s.time)));
  }

  /** the gingham flap hanging off the mess table (Chunk hides behind it): rows and colours from the painted drape */
  private drawCloth(r: Renderer, t: number) {
    const u = this.underTable;
    if (!u || this.hullA > 0.98) return;
    const src = this.art.lower.buf, a = 1 - this.hullA;
    const X0 = CLOTH.x0, X1 = CLOTH.x1, top = CLOTH.top;
    // hangs to just above the floor; lifting folds it up under the table edge
    const full = CLOTH.bottom - top;
    const len = Math.max(0, Math.round(full * (1 - u.lift)));
    const col = (x: number, y: number, k = 1) => {
      const c = src.get(x, y) >>> 0;
      return packColor(((c & 255) / 255) * k, (((c >> 8) & 255) / 255) * k, (((c >> 16) & 255) / 255) * k, a);
    };
    for (let x = X0; x <= X1; x++) {
      // a ragged hem that twitches when something behind it moves
      const hem = len + (len > 2 && u.shake > 0.05 && Math.sin(x * 1.7 + t * 23) * u.shake > 0.45 ? -1 : 0);
      for (let j = 0; j < hem; j++) {
        const deep = j / Math.max(1, full);
        const dx = u.shake > 0.01 ? Math.round(Math.sin(t * 26 + j * 0.8 + x * 0.15) * u.shake * deep * 1.6) : 0;
        // gingham rows repeat the drape's four check rows; the last two rows are the shaded hem
        const row = j >= hem - 2 ? 185 + (j - (hem - 2)) : 181 + (j % 4);
        const sx = Math.max(X0, Math.min(X1, x - dx));
        r.rect(x, top + j, 1, 1, col(sx, row, 0.82 - deep * 0.2));
      }
      // folded up: the doubled-over hem shows as a dark roll under the table edge
      if (u.lift > 0.5) r.rect(x, top, 1, 1, col(x, 186, 0.75));
    }
  }

  /** the mess table's front (gingham cloth, pedestal, foot, the mug and teapot) cut from the painted interior */
  private makeTableFront() {
    const src = this.art.lower.buf, T = TABLE_FRONT;
    const b = new PixelBuffer(T.w, T.h);
    const inTable = (x: number, y: number) =>
      (y >= 180 && y <= 186 && x >= 289 && x <= 330) || // cloth top and drape
      (y >= 187 && y <= 199 && x >= 308 && x <= 311) || // pedestal
      (y >= 199 && y <= 201 && x >= 302 && x <= 317) || // foot
      (y >= 175 && y <= 179 && x >= 292 && x <= 297) || // mug
      (y >= 172 && y <= 179 && x >= 323 && x <= 330); // teapot
    for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
      const wx = T.x + x, wy = T.y + y;
      if (!inTable(wx, wy)) continue;
      const c = src.get(wx, wy);
      if (c >>> 24) b.set(x, y, c);
    }
    this.fr.tableFront = local.add('s4:tableFront', b, 0, 0);
  }

  private makeSmallFrames() {
    const fish = (c1: string, c2: string) => {
      const b = new PixelBuffer(6, 3);
      const C1 = hex(c1), C2 = hex(c2);
      for (const [x, y, c] of [[1, 0, C1], [2, 0, C1], [3, 0, C1], [0, 1, C2], [1, 1, C1], [2, 1, C1], [3, 1, C1], [4, 1, C1], [5, 0, C2], [5, 2, C2], [1, 2, C2], [2, 2, C2], [3, 2, C2]] as [number, number, number][]) b.set(x, y, c);
      b.set(4, 1, hex('#101010'));
      return b;
    };
    void fish;
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
    env.ambientTop = mixv(env.ambientTop, [0.62 - storm * 0.3, 0.58 - storm * 0.28, 0.54 - storm * 0.22], k * 0.8);
    env.ambientBottom = mixv(env.ambientBottom, [0.5 - storm * 0.24, 0.46 - storm * 0.22, 0.44 - storm * 0.18], k * 0.8);
    env.vignette = Math.max(env.vignette, 0.3 + 0.16 * k);
    env.bloom = env.bloom + 0.25 * k;
    env.bloomThreshold = Math.min(env.bloomThreshold, 0.9 - 0.15 * k);
    env.saturation *= 1 - 0.06 * k;
    env.gain = mixv(env.gain, [1.05, 0.98, 0.92], k * 0.6);
  }

  private levelVis(room: string): number {
    if (room === 'deck') return 1;
    const lv = room === 'bridge' ? this.bridgeA : this.hullA;
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
        const floorY = lv ? (lv.level === 'bridge' ? S4.bridge.floor : lv.id === 'hold' ? S4.lower.floor - 6 : S4.lower.floor) : L.y + 60;
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
    r.light(424, 7, 30, 1, 1, 0.95, storm > 0.3 ? 2 : 0.4);
    r.light(276, 40, 70, 1, 0.82, 0.55, 0.3 + storm * 0.5);
  }

  private drawAnimated(r: Renderer, t: number) {
    // fish tank: fish and bubbles (only when the lower deck is open)
    if (this.hullA < 0.98) {
      const a = 1 - this.hullA;
      const col = packColor(1, 1, 1, a);
      for (const f of this.tankFish) r.draw(this.tankFrame(f.k), f.x, f.y, f.vx > 0 ? 1 : -1, 1, 0, col);
      r.emissive(0.8);
      for (const b of this.bubbles) r.draw(this.fr.dot, b.x, b.y, 1, 1, 0, col);
      r.emissive();
    }
    // the boat's moving parts: wheel, radar, the stern flag
    const storm = this.weather.storm;
    const w = this.partFr.wheel, rd = this.partFr.radar, fl = this.partFr.flag;
    if (w?.length) r.draw(w[Math.floor(Math.abs(this.rot) * 60 + t * (1 + storm * 6)) % w.length], MOUNTS.wheel[0], MOUNTS.wheel[1]);
    if (rd?.length) r.draw(rd[Math.floor(t * 4) % rd.length], MOUNTS.radar[0], MOUNTS.radar[1]);
    if (fl?.length) r.draw(fl[Math.floor(t * (6 + storm * 10)) % fl.length], MOUNTS.flag[0], MOUNTS.flag[1]);
    void this.flagFr;
  }

  private drawSliders(r: Renderer) {
    for (const s of this.sliders) r.draw(s.fr, s.x, s.y, 1, 1, s.rot);
  }

  /** add a loose object that slides around when the deck tilts (storm) */
  addSlider(buf: PixelBuffer, name: string, x: number, y: number, x0: number, x1: number) {
    const fr = local.add('s4sl:' + name, buf, buf.w / 2, buf.h - 1);
    // it rides the floor it was put on (the main deck has sheer: a fixed height would float or sink)
    const probe = y - 14, sf = this.st.terrain.surfaceBelow(x, probe, 0);
    this.sliders.push({ fr, x, y: sf ? sf.y : y, v: 0, x0, x1, rot: 0, hitT: 0, dy: 0, probe });
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
  setFx(px: { x: number; y: number; c: number }[] | null) {
    this.fishFx = px;
  }
  setHeld(spr: { w: number; h: number; px: Uint32Array; grip?: [number, number] } | null, mode: 'chest' | 'overhead' = 'chest') {
    this.held = spr;
    this.heldMode = mode;
  }
  setFishDraw(fn: ((r: Renderer) => void) | null) {
    this.fishDraw = fn;
  }
  /** the hull bottom in world space (the fishing view's water stops above it inside the hull) */
  hullLine(): [number, number][] {
    return CUTLINE.map(([x, y]) => this.shipToWorld(x, y));
  }
  /** the hull below the waterline (keel, rudder, propeller), tinted, for the fishing view's underwater cross-section */
  drawHullUnder(r: Renderer, color: number) {
    r.pushTransform(PIVOT[0], PIVOT[1], this.rot, 0, this.bob);
    // the hull side, and the near-side layer that carries the skeg, rudder and propeller aft
    for (const k of ['hull', 'deckFront'] as const) {
      const f = this.fr[k], a = this.art[k];
      if (!f || !a) continue;
      const y0 = S4.WATER + 1 - a.y;
      if (y0 >= f.h || y0 < 0) continue;
      r.drawSub(f, 0, y0, f.w, f.h - y0, a.x, a.y + y0, 1, 1, color);
    }
    r.popTransform();
  }
  /** boat speed through the water (px/s), for the fishing view's wake */
  cruise() { return this.weather.cruise; }
  private keelPts: [number, number][] | null = null;
  /** the running gear in world space: the propeller hub, where the stern meets the water, and points along the keel */
  gear(): { prop: [number, number]; stern: [number, number]; keel: [number, number][] } {
    if (!this.keelPts) {
      // the hull's lowest painted pixel, every 12 px from the skeg forward
      const a = this.art.hull, b = a.buf, pts: [number, number][] = [];
      for (let x = 70; x < 520; x += 12) {
        const bx = x - a.x;
        if (bx < 0 || bx >= b.w) continue;
        let y = -1;
        for (let yy = b.h - 1; yy >= 0; yy--) if (b.get(bx, yy) >>> 24) { y = yy; break; }
        if (y >= 0 && y + a.y > S4.WATER + 3) pts.push([x, y + a.y]);
      }
      this.keelPts = pts;
    }
    return { prop: this.shipToWorld(61, 216), stern: this.shipToWorld(50, S4.WATER), keel: this.keelPts.map(([x, y]) => this.shipToWorld(x, y)) };
  }
  private tankFrame(id: string): Frame {
    const k = 'tank:' + id;
    return this.fr[k] ??= local.add('s9:' + k, fishTank(id), Math.floor(fishTank(id).w / 2), Math.floor(fishTank(id).h / 2));
  }
  private drawLine(r: Renderer) {
    if (this.fishFx) for (const q of this.fishFx) r.rect(Math.round(q.x), Math.round(q.y), 1, 1, q.c);
    const b = this.bobber;
    if (!b) return;
    const [tx, ty] = this.rodTip();
    const by = b.y + (b.fly > 0 ? 0 : b.dip);
    const n = Math.max(8, Math.ceil(Math.hypot(b.x - tx, by - ty) / 2));
    const sag = b.fly > 0 ? 0 : Math.min(18, Math.abs(b.x - tx) * 0.12) * (b.dip > 5 ? 0.3 : 1);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = tx + (b.x - tx) * u, y = ty + (by - ty) * u + Math.sin(u * Math.PI) * sag;
      r.rect(Math.round(x), Math.round(y), 1, 1, packColor(0.92, 0.92, 0.95, 0.75));
    }
    // bobber: red cap, white float; the part under the surface shows only faintly through the water
    const X = Math.round(b.x) - 1, Y = Math.round(by) - 3, sy = Math.round(b.y) + 1;
    const row = (y: number, h: number, cr: number, cg: number, cb: number) => {
      for (let k = 0; k < h; k++) r.rect(X, Y + y + k, 3, 1, packColor(cr, cg, cb, b.fly > 0 || Y + y + k < sy ? 1 : 0.28));
    };
    row(0, 2, 0.85, 0.2, 0.18);
    row(2, 2, 0.95, 0.95, 0.92);
    if (b.fly <= 0) r.rect(X - 1, sy, 5, 1, packColor(1, 1, 1, 0.55));
  }
  /** the catch, held up in ONE of Mori's hands by the tail (head down, belly toward where he faces).
   *  The sprite is anchored at its grip point (the narrow wrist of the tail) and hung from the fist:
   *  plumb, or tilted out when it is too long to clear the deck. 'overhead' goes with the raised
   *  "I caught it!" arm (pose fishRaise), 'chest' with the shoulder-height show-off (pose fishHold). */
  private drawHeld(r: Renderer) {
    const h = this.held;
    this.heldBox = null;
    this.heldXf = null;
    if (!h) return;
    const p = this.player;
    const hand = p.body.handPos();
    if (!hand) return;
    const fr = this.heldFrame(h);
    const f = p.facing >= 0 ? 1 : -1;
    // the fist sits just past the wrist along the raised forearm
    const gx = Math.round(hand[0] + f * HELD_FIST[0]), gy = Math.round(hand[1] + HELD_FIST[1]);
    // hang plumb; tilt the head out (forward) when the fish would touch the deck
    const L = fr.w - fr.ax, avail = p.y - 3 - gy;
    let a = Math.PI / 2;
    if (L > avail) a = Math.asin(Math.max(0.35, Math.min(1, avail / L)));
    a += Math.sin(this.time * 2.3) * 0.03;
    const rot = f * a;
    r.draw(fr, gx, gy, f, 1, rot);
    this.heldXf = { gx, gy, f, rot, ax: fr.ax, ay: fr.ay };
    // where it ended up (ship-local corners → world AABB), for the catch photo
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[0, 0], [fr.w, 0], [fr.w, fr.h], [0, fr.h]]) {
      const [wx, wy] = this.heldPoint(u, v)!;
      x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
    }
    this.heldBox = [x0, y0, x1, y1];
  }
  /** world AABB of the held catch as last drawn */
  heldBox: [number, number, number, number] | null = null;
  private heldXf: { gx: number; gy: number; f: number; rot: number; ax: number; ay: number } | null = null;
  /** a point of the held sprite (sprite pixels, facing right) in world space, as last drawn */
  heldPoint(u: number, v: number): [number, number] | null {
    const X = this.heldXf;
    if (!X) return null;
    const c = Math.cos(X.rot), sn = Math.sin(X.rot);
    const lx = (u - X.ax) * X.f, ly = v - X.ay;
    return this.shipToWorld(X.gx + lx * c - ly * sn, X.gy + lx * sn + ly * c);
  }
  private heldFrames = new WeakMap<object, Frame>();
  private heldN = 0;
  private heldFrame(h: { w: number; h: number; px: Uint32Array; grip?: [number, number] }): Frame {
    let fr = this.heldFrames.get(h);
    if (fr) return fr;
    const b = new PixelBuffer(h.w, h.h);
    b.data.set(h.px);
    const [gx, gy] = h.grip ?? gripOf(h);
    fr = local.add('s4:held:' + this.heldN++, b, gx + 0.5, gy + 0.5);
    this.heldFrames.set(h, fr);
    return fr;
  }

  /** a new resident for the lab tank */
  addTankFish(id = 'snoutbass') {
    this.tankFish.push({ x: (TANK.x0 + TANK.x1) / 2, y: TANK.y0 + 4, vx: 5, k: id, t: 0 });
  }

  private placeSub = 'Day 1 at sea';
  /** where Mori's carrying hand sits relative to his feet (facing right) */
  private carryOff: [number, number] = [5, -24];
  /** keep Chunk in Mori's arms */
  private holdChunk() {
    const p = this.player, c = this.chunk;
    // on a ladder he is tucked under the near arm (the far hand climbs), which is the hand handPos gives
    let h = p.state === 'climb' && p.body.anim !== 'carryPupClimb' ? null : p.body.handPos();
    if (h) this.carryOff = [(h[0] - p.x) * p.facing, h[1] - p.y];
    else h = [p.x + this.carryOff[0] * p.facing, p.y + this.carryOff[1]];
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
    // the jolt spring, sub-stepped (one big step on a slow frame would overshoot and fling the boat about)
    for (let n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, i = 0; i < n; i++) {
      this.joltV += (-this.jolt * 26 - this.joltV * 5) * h;
      this.jolt += this.joltV * h;
    }
    this.rot = Math.sin(t * 0.55) * (0.006 + storm * 0.07) + Math.sin(t * 1.3 + 1) * (0.002 + storm * 0.03) + this.jolt;
    this.bob = this.ocean ? (this.ocean.heightAt(PIVOT[0]) - S4.WATER) * 0.35 : 0;
    if (!Number.isFinite(this.bob)) this.bob = 0;
    if (!Number.isFinite(this.rot)) { this.rot = 0; this.jolt = 0; this.joltV = 0; }
    // never roll her past ~20 degrees: further and the cutaway turns into a spinning top
    this.jolt = clamp(this.jolt, -0.25, 0.25);
    this.rot = clamp(this.rot, -0.36, 0.36);
    this.bob = clamp(this.bob, -30, 30);
    if (this.main.xf) { this.main.xf[2] = this.rot; this.main.xf[4] = this.bob; }
    this.ocean?.setMask(CUTLINE.map(([x, y]) => this.shipToWorld(x, y)));
    // the deck only slides you about while you're in control (not through dialogue and cutscenes)
    const held = this.cutscene || this.busyAction || p.state === 'script' || p.state === 'work';
    p.tilt = held ? 0 : this.rot * (storm > 0.2 ? 1.6 : 1);
    // cutaways
    const inLower = p.y > S4.lower.ceil + 2;
    const inHouse = p.y <= S4.house.floor + 2 && p.y > S4.house.ceil && p.x > S4.house.x0 - 2 && p.x < S4.house.x1 + 2;
    const onBridge = p.y <= S4.bridge.floor + 2 && p.y > S4.bridge.ceil && p.x > S4.bridge.x0 - 4 && p.x < S4.bridge.x1 + 2;
    this.hullA = damp(this.hullA, inLower ? 0 : 1, 9, dt);
    this.houseA = damp(this.houseA, inHouse ? 0 : 1, 9, dt);
    this.bridgeA = damp(this.bridgeA, onBridge ? 0 : 1, 9, dt);
    this.inside = damp(this.inside, inLower || inHouse || onBridge ? 1 : 0, 3.5, dt);
    // safety net: nobody drops out through the bottom of the boat (off the end of a floor, a bad stand spot)
    if (p.state !== 'climb' && p.y > S4.lower.floor + 14) {
      const f = FLOORS.lower;
      p.x = clamp(p.x, f[0][0] + 4, f[f.length - 1][0] - 4);
      p.y = this.st.terrain.surfaceBelow(p.x, S4.lower.ceil + 4)?.y ?? S4.lower.floor;
      p.vy = 0;
    }
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
      f.y += f.shy ? 0 : Math.sin(f.t * 1.7) * 3 * dt;
      if (f.x < TANK.x0 || f.x > TANK.x1) { f.vx = -f.vx; f.x = clamp(f.x, TANK.x0, TANK.x1); }
      f.y = clamp(f.y, TANK.y0, TANK.y1);
    }
    for (const b of this.bubbles) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.4) * 0.1; if (b.y < TANK.y0) { b.y = TANK.y1; b.x = TANK.bx + rand.next() * 3; } }
    // sliding objects
    for (const s of this.sliders) {
      s.v += Math.sin(this.rot) * 420 * dt;
      s.v *= 1 - dt * 1.4;
      s.x += s.v * dt;
      s.rot = this.rot * 0.6;
      s.hitT -= dt;
      const sf = this.st.terrain.surfaceBelow(clamp(s.x, s.x0, s.x1), s.probe, 0);
      if (sf && Math.abs(sf.y + s.dy - s.y) < 14) s.y = sf.y + s.dy;
      if (s.x < s.x0 || s.x > s.x1) {
        s.x = clamp(s.x, s.x0, s.x1);
        if (Math.abs(s.v) > 30 && s.hitT <= 0) { s.hitT = 0.4; if (this.hullA < 0.5 || this.houseA < 0.5 || Math.abs(s.y - p.y) < 20) audio.play('woodCreak', { vol: 0.3 }); }
        s.v = -s.v * 0.25;
      }
    }
    super.update(dt);
    // the HUD's place line follows the story ("Day 1 · The storm")
    const ho = this.hudOpts();
    if (ho.sub !== this.placeSub && this.hud) { this.placeSub = ho.sub; this.hud.setPlace(ho.place, ho.sub); }
    if (this.carrying) this.holdChunk();
    else this.buddy?.update(dt);
    this.story?.update(dt);
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }
}

/** fist centre relative to the wrist (handPos), facing right */
const HELD_FIST: [number, number] = [0.5, -1.5];
export { SPOTS, S4 };
