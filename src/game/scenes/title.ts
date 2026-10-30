// The title: a cinematic of the Kittiwake under way across the open sea toward the misty island at
// golden hour, with Mori at the bow and Chunk beside him in the wind. No UI: the game's name is a
// cloud formation in the sky (titlecloud.ts) and the options are floating words in the air ahead of
// the bow (src/ui/v12/floatmenu.ts).
//
//   - opening: tight on Mori at the bow, the lens on him; the camera cranes back and up, the name
//     gathers in the sky out of wind-blown puffs, then the options drift in
//   - idle: a slow handheld drift; the boat pitches on the swell, the bow wave curls and flings
//     spray, the wake trails astern, gulls kite in the head wind over the bow
//   - Settings: the camera drops to the deck beside Mori and Chunk (the sea and sky rack out of
//     focus) and the settings float beside them; Credits: it tilts up into the sky
//   - Continue / New expedition: the words blow away and the camera pushes on toward the island
//
// The boat is the ship scene's art (src/art/ship5) at full size; the sea, sky and under-way effects
// are the ship scene's too (src/world/ocean, ocean-sky, src/game/v4/underway).

import type { Frame, Renderer } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { packColor } from '../../gfx/renderer';
import { Stage } from '../../world/stage';
import type { Layer } from '../../world/stage';
import { Custom } from '../../world/props';
import { local } from '../assets';
import { Ocean, BAND_P, applySeaEnv, updater, Weather } from '../../world/ocean';
import { Sky } from '../../world/ocean-sky';
import { glowSprite, softBar } from '../../art/ocean';
import { paintFarIsles } from '../../art/archipelago';
import { paintShip4, S4, FLOORS, CUTLINE, MOUNTS, PIVOT5 } from '../../art/ship5';
import type { Ship4Art } from '../../art/ship5';
import { paintBoatParts, deckY } from '../../art/boat';
import { Actor } from '../../world/actor';
import { renderAny } from '../../art/beasts';
import { registerAnim7, POSES7 } from '../../art/v7/anims7';
import { Underway } from '../v4/underway';
import type { ShipScene4 } from '../v4/ship';
import { cineState } from '../v11/cine';
import { bayer, clamp, damp } from '../../core/math';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { audio } from '../../core/audio';
import { hasSave, newSave, clearSave } from '../save';
import { continueV4, goShip4 } from './flow';
import { CloudTitle } from './titlecloud';
import { FloatMenu, textLines } from '../../ui/v12/floatmenu';
import type { FloatPage } from '../../ui/v12/floatmenu';
import { settingsPage, creditsPage } from '../../ui/v12/settingsmenu';

export { openSettings } from '../../ui/v12/settingsmenu';

const PIVOT = PIVOT5;
/** Mori and Chunk at the bow (boat-local x) */
const MORI_X = 494, CHUNK_X = 515;

type ShotName = 'intro' | 'menu' | 'settings' | 'credits' | 'depart';
interface Shot { x: number; y: number; zoom: number; focus: number | null; dof: number }

// Mori in the wind at the bow: his idle, with the hair streaming and the jacket hem trailing in the
// gusts (the clip registers once, the first time the title runs)
let clipped = false;
function registerWindClip() {
  if (clipped) return;
  clipped = true;
  registerAnim7('titleWind', { frames: 12, fps: 4, loop: true }, (b, t, id) => {
    const p = POSES7.idle(b, t, id);
    const gust = 0.5 + 0.5 * Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI * 4 + 1);
    p.sway = (p.sway ?? 0) + 0.9 + gust * 1.1;
    p.flags = { ...(p.flags ?? {}), hair: gust > 0.5 ? 2 : 1 };
    return p;
  });
}

interface Gull { x: number; y: number; vx: number; vy: number; hx: number; hy: number; ph: number; mode: 'kite' | 'leave'; t: number; s: number }

export class TitleScene implements Scene {
  st!: Stage;
  weather = new Weather();
  ocean!: Ocean;
  sky!: Sky;
  underway!: Underway;
  t = 0;
  root!: HTMLElement;
  private art!: Ship4Art;
  private fr: Record<string, Frame> = {};
  private parts: Record<string, Frame[]> = {};
  private main!: Layer;
  rot = 0;
  bob = 0;
  private mori!: Actor;
  private chunk!: Actor;
  private cloud!: CloudTitle;
  private cloudSmall!: CloudTitle;
  private cloudT0 = 3.2;
  private menu: FloatMenu | null = null;
  private caption: FloatMenu | null = null;
  private shotName: ShotName = 'intro';
  private shotFrom: Shot | null = null;
  private shotT = 0;
  private shotDur = 1;
  private skipped = false;
  private leaving = false;
  private puffs: { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number; life: number }[] = [];
  private gulls: Gull[] = [];
  private gullFr: Record<string, Frame[]> = {};
  private nextChunk = 6;
  private nextLook = 9;
  private onKey = (e: KeyboardEvent) => { if (!this.skipped && !e.repeat) this.skip(); };
  private onPointer = () => { audio.unlock(); if (!this.skipped) this.skip(); };

  enter() {
    registerWindClip();
    const st = this.st = new Stage('day', { shade: 0 });
    st.minX = -4000; st.maxX = 8000; st.minY = -3000; st.maxY = 3000;
    const w = this.weather;
    // a fair evening with a working sea: a little chop, a steady head wind, the sun low on the right
    w.storm = 0.1; w.wind = -1; w.sunX = 0.9; w.sunY = 0.32;
    st.envHook = env => {
      applySeaEnv(env, w);
      // golden hour: warm highlights, violet shadows, a lot of bloom off the water
      env.gain = [env.gain[0] * 1.1, env.gain[1] * 0.95, env.gain[2] * 0.84];
      env.lift = [env.lift[0] + 0.015, env.lift[1] - 0.004, env.lift[2] + 0.04];
      env.exposure *= 0.95;
      env.saturation *= 1.1;
      env.contrast *= 1.08;
      env.vignette = Math.max(env.vignette, 0.55);
      env.bloom = Math.max(env.bloom, 0.7);
      env.bloomThreshold = Math.min(env.bloomThreshold, 0.82);
    };
    this.ocean = new Ocean({ y: S4.WATER, horizon: S4.WATER - 26, seed: 9, weather: w });
    this.sky = new Sky({ weather: w, horizon: this.ocean.horizon, horizonP: BAND_P.horizon, seed: 12 });
    this.sky.birds = true;
    this.sky.auto = false;
    st.addScreenLayer('sky').add(this.sky);

    // the name in the sky
    this.cloud = new CloudTitle('ZEALANDIA', { cell: 7, seed: 5, delay: 0.2, spread: 2.8 });
    this.cloudSmall = new CloudTitle('PROJECT', { cell: 2.6, puff: 0.8, seed: 9, gap: 1.5, cirrus: true, delay: 2.4, spread: 1.4, wisps: 0.4 });
    const glow = paintGoldenSky();
    this.skyGlow = local.add('t4:skyglow', glow, 0, glow.h);
    st.addScreenLayer('title', 0.5).add(new Custom(0, rr => this.drawTitle(rr)));

    // the misty island ahead, its volcano breathing smoke
    const far = paintFarIsles(960, 120, 7);
    const fFar = local.add('t4:far', far.buf, 0, far.buf.h), fFarG = local.add('t4:farg', far.glow, 0, far.glow.h);
    const puffF = local.add('t4:puff', glowSprite(32, 1.6), 16, 16);
    const barF = local.add('t4:bar', softBar(64, 10), 32, 5);
    const PF = 0.035;
    st.addLayer('isles-far', PF, 0, 0.35, 0).add(new Custom(0, rr => {
      const by = rr.wy(rr.projectY(this.ocean.horizon, BAND_P.horizon) + 2);
      const fx = rr.wx(rr.VW * 0.66) - far.buf.w * 0.62;
      rr.draw(fFar, fx, by);
      rr.emissive(1);
      rr.draw(fFarG, fx, by, 1, 1, 0, packColor(1, 1, 1, 0.55 + 0.2 * Math.sin(this.t * 1.7)));
      rr.emissive();
      const [cx, cy] = far.crater!;
      for (const p of this.puffs) {
        const k = p.t / p.life;
        const a = p.a * Math.sin(Math.PI * Math.min(1, k * 1.2));
        rr.draw(puffF, fx + cx + p.x, by - far.buf.h + cy + p.y, p.r * 1.7, p.r * 1.4, 0, packColor(0.86 + k * 0.1, 0.7 + k * 0.14, 0.72 + k * 0.1, a * 0.7));
      }
      // sea mist lying along the island's foot, drifting
      for (let i = 0; i < 6; i++) {
        const mx = fx + 160 + ((this.t * (3 + i * 1.3) + i * 170) % 760);
        rr.draw(barF, mx, by - 2 - (i % 3) * 4, 5 + (i % 3) * 2, 1.4 + (i % 2) * 0.6, 0, packColor(1, 0.84, 0.82, 0.22));
      }
      rr.draw(barF, fx + 590, by - 3, 16, 1.6, 0, packColor(1, 0.86, 0.84, 0.3));
    }, dt => {
      if (Math.random() < dt * 4) this.puffs.push({ x: (Math.random() - 0.5) * 8, y: 0, vx: -6 - Math.random() * 4, vy: -2 - Math.random() * 1.4, r: 0.5, a: 0.45 + Math.random() * 0.25, t: 0, life: 9 + Math.random() * 5 });
      for (const p of this.puffs) { p.t += dt; p.x += p.vx * dt * (1 + p.t * 0.25); p.y += p.vy * dt; p.vy *= 1 - dt * 0.15; p.r += dt * 0.22; }
      this.puffs = this.puffs.filter(p => p.t < p.life);
    }));

    // the sea, back to front (the distant bands barely move vertically)
    for (const b of ['horizon', 'far', 'mid'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0, b === 'mid' ? 0.85 : BAND_P[b]).add(this.ocean.band(b));
    // under way: the ship scene's bow wave, wake and wind lines (it only needs the boat's pose)
    const host = {
      weather: w, ocean: this.ocean, engineOn: true, fishDraw: null, hullA: 1, bridgeA: 1,
      shipToWorld: (x: number, y: number) => this.shipToWorld(x, y),
    };
    this.underway = new Underway(host as unknown as ShipScene4);
    st.addLayer('wind-far', 0.7, 0, 0, 0.2, 0.85).add(new Custom(0, rr => this.underway.drawWind(rr, 'far')));
    // gulls hanging in the head wind behind the boat plane
    st.addLayer('gulls', 0.92, 0, 0.8, 0, 0.95).add(new Custom(0, rr => this.drawGulls(rr), dt => this.updateGulls(dt)));

    // the Kittiwake at full size, rocking on the swell
    this.art = paintShip4({});
    const A4 = this.art;
    for (const k of ['house', 'hull', 'bridgeExt', 'deckFront'] as const) {
      const sp = A4[k];
      this.fr[k] = local.add('t4:' + k, sp.buf, 0, 0);
      if (sp.glow) this.fr[k + 'G'] = local.add('t4:' + k + 'G', sp.glow, 0, 0);
    }
    const bp = paintBoatParts({});
    for (const k of ['radar', 'flag'] as const) this.parts[k] = bp[k].map((sp, i) => local.add(`t4:${k}${i}`, sp.buf, sp.ax, sp.ay));
    const main = this.main = st.addLayer('main', 1, 0, 1, 0);
    main.xf = [PIVOT[0], PIVOT[1], 0, 0, 0];
    const draw = (rr: Renderer, k: string, a = 1, glow = false) => {
      const f = this.fr[k];
      if (!f) return;
      if (glow) rr.emissive(1);
      rr.draw(f, 0, 0, 1, 1, 0, a < 1 ? packColor(1, 1, 1, a) : 0xffffffff);
      if (glow) rr.emissive();
    };
    main.add(new Custom(-8, rr => draw(rr, 'house')));
    main.add(new Custom(-7, rr => {
      const rd = this.parts.radar, fl = this.parts.flag;
      if (rd?.length) rr.draw(rd[Math.floor(this.t * 4) % rd.length], MOUNTS.radar[0], MOUNTS.radar[1]);
      if (fl?.length) rr.draw(fl[Math.floor(this.t * 8) % fl.length], MOUNTS.flag[0], MOUNTS.flag[1]);
    }));
    main.add(new Custom(81, rr => {
      draw(rr, 'hull'); draw(rr, 'bridgeExt');
      // the windows warm with the cabin lamps as the light goes
      draw(rr, 'hullG', 0.35, true); draw(rr, 'bridgeExtG', 0.35, true);
    }));
    main.add(new Custom(90, rr => draw(rr, 'deckFront')));
    main.add(new Custom(100, rr => {
      rr.light(424, 7, 26, 1, 0.95, 0.85, 0.35);
      rr.light(276, 40, 70, 1, 0.8, 0.5, 0.35);
      // the low sun catching Mori and Chunk from ahead
      rr.light(MORI_X + 40, 40, 90, 1, 0.78, 0.5, 0.45);
    }));
    st.terrain.addGround(FLOORS.deck, 'bridge');
    // Mori at the bow looking ahead, Chunk sitting up beside him like a figurehead
    const mori = this.mori = new Actor('mori', MORI_X, Math.round(deckY(MORI_X)), 1);
    mori.terrain = st.terrain;
    mori.layer = main;
    mori.idleAnim = 'titleWind';
    mori.setAnim('titleWind');
    mori.z = 40;
    const chunk = this.chunk = new Actor('chunk', CHUNK_X, Math.round(deckY(CHUNK_X)), 1);
    chunk.terrain = st.terrain;
    chunk.layer = main;
    chunk.idleAnim = 'sit';
    chunk.setAnim('sit');
    chunk.z = 45;
    main.add(mori);
    main.add(chunk);

    // the near sea in front of the hull, the bow wave and wake on it, the wind lines over the deck
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0, 1).add(this.ocean.band('near'));
    st.layer('sea-near').add(new Custom(10, rr => this.underway.drawNear(rr)));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0, 1).add(this.ocean.band('front'));
    st.addLayer('wind-near', 1.1, 0, 0, 0.2, 1).add(new Custom(0, rr => this.underway.drawWind(rr, 'near')));
    st.layer('sea-horizon').add(updater(dt => { w.update(dt); this.ocean.update(dt); }));

    // camera: tight on Mori at the bow
    const s0 = this.shot('intro');
    Object.assign(st.cam, { x: s0.x, y: s0.y, zoom: s0.zoom, tx: s0.x, ty: s0.y, tzoom: s0.zoom, locked: true });
    this.shotFrom = { ...s0 };
    this.shotT = 0; this.shotDur = 0.01;

    // the overlay root (the floating words live in it; cleared with the scene)
    this.root = document.createElement('div');
    this.root.className = 't4';
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
    this.root.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('keydown', this.onKey);
    game.ui.sceneLayer.appendChild(this.root);
    audio.setAmbience('ocean');
    audio.setMusic('title');
    // warm the gull frames
    for (const [anim, n] of [['hover', 4], ['glide', 2], ['fly', 6]] as const) {
      this.gullFr[anim] = [];
      for (let i = 0; i < n; i++) {
        const o = renderAny('sackjaw', anim, i);
        this.gullFr[anim].push(local.add(`t4:gull.${anim}.${i}`, o.buf, o.ax, o.ay));
      }
    }
    for (let i = 0; i < 3; i++) this.gulls.push(this.newGull(i));
  }

  // ---------------------------------------------------------------- the boat

  shipToWorld(x: number, y: number): [number, number] {
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const dx = x - PIVOT[0], dy = y - PIVOT[1];
    return [PIVOT[0] + dx * c - dy * sn, PIVOT[1] + this.bob + dx * sn + dy * c];
  }

  // ---------------------------------------------------------------- camera

  private deck() { return deckY(MORI_X); }
  /** a named camera shot for the current view size */
  private shot(n: ShotName): Shot {
    const VW = game.r.VW, VH = game.r.VH;
    const deck = this.deck();
    switch (n) {
      case 'intro': return { x: MORI_X + 14, y: deck - 44, zoom: 2.2, focus: 1, dof: 1.1 };
      // wide: the bow a little right of centre, the open sea ahead for the words, the sky for the name
      case 'menu': return { x: MORI_X + 30 - VW * 0.1, y: deck - VH * 0.15, zoom: 1, focus: null, dof: 0 };
      // down on the deck beside them: they sit on the left third, the settings float on the right
      case 'settings': { const z = 1.6; return { x: MORI_X + (VW * 0.16) / z, y: deck - (VH * 0.2) / z, zoom: z, focus: 1, dof: 0.9 }; }
      // up into the sky
      case 'credits': return { x: MORI_X - VW * 0.12, y: deck - VH * 0.15 - 170, zoom: 1, focus: null, dof: 0 };
      // pushing on toward the island
      case 'depart': return { x: MORI_X + 120, y: deck - VH * 0.12, zoom: 1.35, focus: 0.3, dof: 0.6 };
    }
  }
  private go(n: ShotName, secs: number) {
    const c = this.st.cam;
    this.shotFrom = { x: c.x, y: c.y, zoom: c.zoom, focus: this.shot(this.shotName).focus, dof: this.shot(this.shotName).dof };
    this.shotName = n;
    this.shotT = 0;
    this.shotDur = Math.max(0.01, secs);
  }
  private direct(dt: number) {
    const c = this.st.cam, to = this.shot(this.shotName), from = this.shotFrom ?? to;
    this.shotT += dt;
    const k = clamp(this.shotT / this.shotDur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const T = this.t;
    // a slow handheld drift, a breath of zoom, and a little of the boat's heave
    const sx = Math.sin(T * 0.11) * 5 + Math.sin(T * 0.067 + 1) * 3;
    const sy = Math.sin(T * 0.13 + 2) * 2.5 + this.bob * 0.3;
    const zb = 1 + Math.sin(T * 0.05) * 0.012;
    c.locked = true;
    c.x = from.x + (to.x - from.x) * e + sx;
    c.y = from.y + (to.y - from.y) * e + sy;
    c.zoom = from.zoom * Math.pow(to.zoom / from.zoom, e) * zb;
    // the lens: on Mori close in, everything sharp wide
    const dof = (from.dof ?? 0) + ((to.dof ?? 0) - (from.dof ?? 0)) * e;
    const focus = to.focus ?? from.focus;
    if (focus !== null && dof > 0.02) { cineState.focus = focus; cineState.dof = dof; } else cineState.focus = null;
  }

  // ---------------------------------------------------------------- the name in the sky

  /** where the name hangs on screen (it rides a little parallax as the camera moves) */
  private titleXY(r: Renderer): [number, number] {
    const m = this.shot('menu');
    const v = r.view;
    const x = r.VW / 2 - this.cloud.w / 2 + 8 - (v.x - m.x) * 0.08;
    const y = Math.max(6, r.VH * 0.05) - (v.y - m.y) * 0.4 + (v.zoom - 1) * -30;
    return [x, y];
  }
  private skyGlow!: Frame;
  private drawTitle(r: Renderer) {
    // the golden-hour sky: deep blue overhead through violet and rose to gold at the horizon
    const hy = Math.round(r.projectY(this.ocean.horizon, BAND_P.horizon)) + 4;
    const g = this.skyGlow;
    for (let x = 0; x < r.VW; x += g.w) r.draw(g, x, hy);
    if (hy - g.h > 0) r.rect(0, 0, r.VW, hy - g.h + 1, packColor(0.17, 0.2, 0.42, 0.62));
    if (this.t < this.cloudT0) return;
    const [x, y] = this.titleXY(r);
    // the word stays crisp (it sits on the focus plane for the lens) unless the camera is on the deck
    const near = this.shotName === 'settings' ? 1 : 0.5;
    r.screen(0, 0, 0.5, near);
    this.cloudSmall.draw(r, x + 30, y - 9);
    this.cloud.draw(r, x, y + 4);
    r.screen(0, 0, 0.5, 1);
  }

  // ---------------------------------------------------------------- gulls

  private newGull(i: number): Gull {
    const hx = MORI_X - 40 + i * 50 + Math.random() * 30, hy = 4 - i * 9 - Math.random() * 12;
    return { x: hx + 300 + i * 80, y: hy - 30, vx: -40, vy: 0, hx, hy, ph: Math.random() * 6, mode: 'kite', t: 0, s: 1 };
  }
  private updateGulls(dt: number) {
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      g.t += dt;
      if (g.mode === 'kite') {
        // hanging in the head wind: holding station over the bow, slipping and correcting
        const tx = g.hx + Math.sin(this.t * 0.4 + g.ph) * 18, ty = g.hy + Math.sin(this.t * 0.7 + g.ph * 2) * 7 + this.bob * 0.5;
        g.vx = damp(g.vx, (tx - g.x) * 0.9, 1.4, dt);
        g.vy = damp(g.vy, (ty - g.y) * 0.9, 1.4, dt);
        if (g.t > 14 + g.ph * 3 && Math.random() < dt * 0.08) { g.mode = 'leave'; g.t = 0; }
      } else {
        // peel off astern on the wind
        g.vx = damp(g.vx, -90, 0.8, dt);
        g.vy = damp(g.vy, 10 + Math.sin(g.t * 2) * 12, 1, dt);
        if (g.t > 8) this.gulls[i] = this.newGull(i);
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
  }
  private drawGulls(r: Renderer) {
    for (const g of this.gulls) {
      const leaving = g.mode === 'leave';
      const anim = leaving ? (Math.sin(g.t * 1.3 + g.ph) > 0 ? 'glide' : 'fly') : Math.sin(this.t * 0.5 + g.ph) > 0.4 ? 'glide' : 'hover';
      const fr = this.gullFr[anim];
      if (!fr?.length) continue;
      const f = fr[Math.floor(this.t * (anim === 'glide' ? 3 : 9) + g.ph * 3) % fr.length];
      // kiting gulls face into the wind (ahead, +x); leaving ones turn and run with it
      r.draw(f, g.x, g.y, leaving ? -g.s : g.s, g.s, 0, packColor(1, 0.92, 0.84, 1));
    }
  }

  // ---------------------------------------------------------------- menus

  private anchor() {
    // in the air ahead of the bow, over the open water
    const r = game.r;
    if (this.shotName === 'settings') return { x: r.VW * 0.53, y: r.VH * 0.47 };
    if (this.shotName === 'credits') return { x: r.VW * 0.5, y: r.VH * 0.6 };
    return { x: r.VW * 0.67, y: r.VH * 0.6 };
  }
  private showMenu(focus?: string) {
    const page = this.mainPage();
    if (focus) page.focus = focus;
    if (!this.menu) this.menu = new FloatMenu({ page, parent: this.root, anchor: () => this.anchorEased(), align: this.shotName === 'credits' ? 'center' : 'left' });
    else this.menu.show(page);
  }
  /** the menu's anchor glides between its spots as the camera moves */
  private anc: { x: number; y: number } | null = null;
  private anchorEased() {
    const a = this.anchor();
    if (!this.anc) this.anc = { ...a };
    const k = 1 - Math.exp(-(game.rdt || 1 / 60) * 3);
    this.anc.x += (a.x - this.anc.x) * k;
    this.anc.y += (a.y - this.anc.y) * k;
    // the words ride the camera's drift a little, like something in the scene
    const v = game.r.view, m = this.shot(this.shotName);
    return { x: this.anc.x - (v.x - m.x) * 0.6, y: this.anc.y - (v.y - m.y) * 0.6 };
  }
  private mainPage(): FloatPage {
    const items: FloatPage['items'] = [];
    const cont = hasSave();
    if (cont) items.push({ id: 'continue', label: 'Continue', sub: `Day ${game.save.day ?? 1}`, pick: () => this.depart(() => continueV4()) });
    items.push({ id: 'new', label: 'New expedition', pick: () => (cont ? this.confirmNew() : this.depart(() => this.startNew())) });
    items.push({ id: 'settings', label: 'Settings', pick: () => this.openSettingsHere() });
    items.push({ id: 'credits', label: 'Credits', tone: 'quiet', pick: () => this.openCredits() });
    return { items };
  }
  private confirmNew() {
    audio.play('whoosh', { vol: 0.1, pitch: 0.9 });
    this.menu?.show({
      heading: 'Start over?',
      focus: 'keep',
      onBack: () => this.showMenu('new'),
      items: [
        ...textLines(['This replaces your expedition,', 'your photos and your field guide.']),
        { id: 'keep', label: 'Keep my save', gap: 4, pick: () => this.showMenu('new') },
        { id: 'fresh', label: 'Start fresh', tone: 'danger', pick: () => this.depart(() => { clearSave(); this.startNew(); }) },
      ],
    });
  }
  private openSettingsHere() {
    audio.play('whoosh', { vol: 0.1, pitch: 1.2 });
    this.go('settings', 2.4);
    this.menu?.show(settingsPage(() => { game.persist(); this.go('menu', 2.4); this.showMenu('settings'); }));
  }
  private openCredits() {
    audio.play('whoosh', { vol: 0.1, pitch: 0.8 });
    this.go('credits', 3);
    this.menu?.show(creditsPage(() => { this.go('menu', 2.6); this.showMenu('credits'); }));
  }
  private depart(fn: () => void) {
    if (this.leaving) return;
    this.leaving = true;
    audio.play('whoosh', { vol: 0.14, pitch: 0.7 });
    void this.menu?.close();
    this.go('depart', 2.6);
    setTimeout(fn, 450);
  }
  startNew() {
    game.save = newSave();
    game.save.flags['v4'] = true;
    game.persist();
    goShip4();
  }

  /** jump to the finished reveal */
  skip() {
    if (this.skipped) return;
    this.skipped = true;
    if (this.shotName === 'intro') this.go('menu', 1.8);
    this.cloudT0 = Math.min(this.cloudT0, this.t);
    // the name still gathers, just quickly
    this.cloud.t = Math.max(this.cloud.t, this.cloud.done - 1.4);
    this.cloudSmall.t = Math.max(this.cloudSmall.t, this.cloudSmall.done - 1.2);
    void this.caption?.close();
    this.caption = null;
    if (!this.menu) setTimeout(() => { if (!this.leaving) this.showMenu(); }, 500);
  }

  update(dt: number) {
    // slow cinematic fade-in (game.go starts a quick one after enter)
    if (this.t === 0 && !this.skipped) { game.r.post.fade = 1; game.fadeTo(0, 0.4); }
    this.t += dt;
    const T = this.t;
    // beats of the opening
    if (!this.skipped) {
      if (T > 1.0 && !this.caption) {
        this.caption = new FloatMenu({ page: { items: textLines(['Day 21  ·  somewhere south of the charts']) }, parent: this.root, passive: true, anchor: () => ({ x: game.r.VW * 0.5, y: game.r.VH * 0.84 }), align: 'center' });
      }
      if (T > 2.6 && this.shotName === 'intro') this.go('menu', 7.5);
      if (T > 4.6 && this.caption) { void this.caption.close(); this.caption = null; }
      if (T > 9.4) { this.skipped = true; this.showMenu(); }
    }
    if (T > this.cloudT0) { this.cloud.update(dt); this.cloudSmall.update(dt); }
    // the boat: pitching on the swell, heaving with it
    const hA = this.ocean.heightAt(PIVOT[0] - 160), hB = this.ocean.heightAt(PIVOT[0] + 160);
    this.rot = damp(this.rot, Math.atan2(hB - hA, 320) * 0.5 + Math.sin(T * 0.55) * 0.006, 3, dt);
    this.bob = clamp((this.ocean.heightAt(PIVOT[0]) - S4.WATER) * 0.35, -20, 20);
    if (!Number.isFinite(this.bob)) this.bob = 0;
    if (this.main.xf) { this.main.xf[2] = this.rot; this.main.xf[4] = this.bob; }
    this.ocean.setMask(CUTLINE.map(([x, y]) => this.shipToWorld(x, y)));
    this.underway.update(dt);
    // the sun sits low over the horizon, wherever the camera looks
    const hy = game.r.projectY(this.ocean.horizon, BAND_P.horizon) / game.r.VH;
    this.weather.sunY = clamp(hy - 0.19, 0.06, 0.9);
    // little lives: Mori glances up at the gulls (and at the name when it forms); Chunk fidgets
    this.nextLook -= dt;
    if (T > 5.4 && T < 5.5 && !this.mori.look) { this.mori.look = 'up'; setTimeout(() => { if (this.mori.look === 'up') this.mori.look = null; }, 2600); }
    if (this.nextLook <= 0) {
      this.nextLook = 7 + Math.random() * 8;
      this.mori.look = 'up';
      setTimeout(() => { if (this.mori.look === 'up') this.mori.look = null; }, 1400 + Math.random() * 900);
    }
    this.nextChunk -= dt;
    if (this.nextChunk <= 0) {
      this.nextChunk = 6 + Math.random() * 7;
      const a = Math.random();
      void this.chunk.play(a < 0.4 ? 'tilt' : a < 0.75 ? 'sniff' : 'proud', 'sit');
    }
    this.st.update(dt);
    audio.update(dt);
  }
  render(r: Renderer, dt: number) {
    this.direct(game.rdt || dt);
    this.st.updateCamera(dt, r);
    this.st.render(r, dt);
  }
  exit() {
    window.removeEventListener('keydown', this.onKey);
    this.menu?.destroy();
    this.caption?.destroy();
    this.root.remove();
    this.st.clear();
    cineState.focus = null;
  }
}

/** the golden-hour sky as a translucent wash over the day sky: an 8 px wide strip, tiled, the bands
 *  between its colours ordered-dithered (bottom = the horizon) */
function paintGoldenSky(): PixelBuffer {
  const H = 300, W = 8;
  const stops: [string, number][] = [
    ['#2a346c', 0.64], ['#36407e', 0.6], ['#4a4890', 0.56], ['#664f96', 0.52], ['#845896', 0.48], ['#a2608e', 0.44],
    ['#c26a84', 0.4], ['#da7a78', 0.38], ['#ec9070', 0.36], ['#f6aa6c', 0.34], ['#ffc272', 0.3], ['#ffd68a', 0.26],
  ];
  const cols = stops.map(([h, a]) => hex(h, Math.round(a * 255)));
  const b = new PixelBuffer(W, H);
  const n = cols.length - 1;
  for (let y = 0; y < H; y++) {
    // more rows of warm colour low down, where the light is
    const t = Math.pow(y / (H - 1), 0.75) * n;
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) b.set(x, y, cols[Math.min(n, f > bayer(x, y) ? i + 1 : i)]);
  }
  return b;
}
