// V4: washed ashore. A short first-person wake-up: lying on the sand looking straight up, eyes
// full of salt water. Heavy blinks, blur and glare, droplets on the eyes, breathing, gulls, palm
// fronds and a pōhutukawa against the sky... then Mori sits up and the morning beach swims into
// focus: the sun low over a calm, glittering sea, a gold-lit cloud bank, islands in the haze, the
// headland, the surf lapping up the glassy sand. Then a big Trycop crab (the live V9 rig, painted up
// close) scuttles out from under the taupata to inspect his hand: eyes swivelling on their stalks,
// antennae twitching, mouthparts working and frothing... and it pinches him. He flinches, it rears
// in threat with both claws up, and scuttles off. Then back to side-view gameplay.

import type { Scene } from '../game';
import { game } from '../game';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, defaultEnv } from '../../gfx/renderer';
import { bigFrame, DynamicSprite } from '../../gfx/atlas';
import { local, A } from '../assets';
import { hex } from '../../art/color';
import * as L from '../../art/landscape';
import { paintPOV, droplet, povCrab, povShore, povHand, POV_W, POV_PAD, POV_HORIZON, POV_SUN, POV_HAND } from '../../art/island4/pov';
import { foreground } from '../../art/jungle-fg';
import { Sk } from '../../art/beasts-core';
import { drawTrycop, trycopRest, trycopCanvas, TrycopPose } from '../../art/v9/wild/trycop';
import { clamp, damp, noise1, smoothstep } from '../../core/math';
import { audio } from '../../core/audio';
import { el } from '../../ui/ui';

const W = POV_W;
/** the close crab's scale (1 = the in-world sprite) */
const CK = 4;
/** the crab's beat on the timeline (seconds) */
const C0 = 11, C_STOP = C0 + 3, C_PINCH = C0 + 6.2, C_REAR = C0 + 7, C_FLEE = C0 + 8.2;
/** the sand under the crab */
const CRAB_Y = 686;
/** the little finger's tip, which the crab pinches */
const PINKY = { x: POV_HAND.x + 17, y: POV_HAND.y + 6 };

interface Crab { x: number; y: number; vx: number; t: number; wait: number }

export class BeachWakeScene implements Scene {
  pausable = false;
  private t = 0;
  private pov!: Frame;
  private fronds: Frame[] = [];
  private drops: { f: Frame; x: number; y: number; v: number; life: number }[] = [];
  private dropFr: Frame[] = [];
  private cloudFr: Frame[] = [];
  private clouds: { f: Frame; x: number; y: number; v: number }[] = [];
  private crabFr: Frame[] = [];
  private crabs: Crab[] = [];
  private grains: { x: number; y: number; v: number; life: number }[] = [];
  private gulls = [{ x: -200, y: 120, v: 70, s: 1 }, { x: 300, y: 200, v: 46, s: 0.7 }, { x: 760, y: 90, v: 58, s: 0.85 }];
  private gust = 0;
  private cap: HTMLElement | null = null;
  private done = false;
  private beat = 0;
  private breathT = 0;
  // ---- the close crab and Mori's hand
  private handFr: Frame[] = [];
  private crabSpr: DynamicSprite | null = null;
  private P: TrycopPose = trycopRest();
  private cx = 1120;
  private cvx = 0;
  private rasterT = 0;
  private crushTip: [number, number] = [-40, -12];
  private pinched = false;
  private flinch = 0;
  private handOff = 0;
  private shake = 0;
  private scuttleT = 0;

  async enter() {
    const r = game.r;
    this.pov = bigFrame(r, paintPOV());
    for (const [seed, sz] of [[3, 300], [9, 260]] as const) {
      const s = foreground('palm', seed, sz);
      this.fronds.push(local.add('wakeFrond' + seed, s.buf, s.ax, s.ay));
    }
    for (const rr of [3, 5, 7]) this.dropFr.push(local.add('wakeDrop' + rr, droplet(rr), rr + 1, rr + 1));
    for (let i = 0; i < 9; i++) this.drops.push({ f: this.dropFr[i % 3], x: 40 + Math.random() * 560, y: 20 + Math.random() * 300, v: 2 + Math.random() * 6, life: 9 + Math.random() * 4 });
    // morning clouds: lavender undersides, peach-lit tops
    const ramp = ['#8a86a8', '#b0a8c0', '#dccad0', '#fff0e0'].map(h => hex(h));
    for (let i = 0; i < 4; i++) this.cloudFr.push(bigFrame(r, L.paintCloud(21 + i, 110 + i * 20, 30 + i * 4, ramp, 1)));
    for (let i = 0; i < 7; i++) this.clouds.push({ f: this.cloudFr[i % 4], x: Math.random() * (W + 200), y: 30 + Math.random() * 280, v: 3 + Math.random() * 4 });
    for (let i = 0; i < 2; i++) this.crabFr.push(local.add('wakeCrab' + i, povCrab(i), 7, 7));
    // two tiny crabs far off on the wet sand
    this.crabs = [{ x: 420, y: povShore(420) + 22, vx: 0, t: 0, wait: 2 }, { x: 640, y: povShore(640) + 30, vx: 0, t: 0, wait: 5 }];
    for (const f of [0, 1] as const) { const h = povHand(f); this.handFr.push(local.add('wakeHand' + f, h.buf, h.ax, h.ay)); }
    const cv = trycopCanvas(CK);
    this.crabSpr = new DynamicSprite(r, cv.w, cv.h, cv.ox, cv.oy);
    this.P = trycopRest();
    r.post.dof = true;
    r.post.focus = 0;
    r.post.dofStrength = 6;
    r.post.fade = 0;
    game.fadeTo(0, 10);
    audio.setAmbience('beach', false);
    audio.setMusic('none' as never);
    this.cap = el('div', '');
    this.cap.style.cssText = "position:absolute;left:0;right:0;bottom:12%;text-align:center;z-index:20;font-family:'Jersey 15', 'Pixelify Sans',monospace;font-size:clamp(15px,2.2vw,24px);color:#fff;text-shadow:0 2px 0 #000,2px 0 0 #000,-2px 0 0 #000,0 -2px 0 #000;opacity:0;transition:opacity 0.8s;pointer-events:none";
    game.ui.sceneLayer.appendChild(this.cap);
    // dev: ?wakeT=<seconds> fast-forwards the timeline (for checking the later beats)
    const ff = Number(new URLSearchParams(location.search).get('wakeT') ?? 0);
    if (ff > 0) { game.fadeTo(0, 100); while (this.t < ff) this.update(1 / 30); }
  }

  private say(text: string) {
    if (!this.cap) return;
    this.cap.textContent = text;
    this.cap.style.opacity = text ? '1' : '0';
  }

  /** eyelid openness over the timeline */
  private lids(t: number) {
    const seg: [number, number, number][] = [[0, 1.2, 0], [1.2, 2.4, 0.26], [2.4, 2.9, 0], [2.9, 4.2, 0.56], [4.2, 4.55, 0.05], [4.55, 6.4, 1], [6.4, 99, 1]];
    for (let i = 0; i < seg.length; i++) {
      const [a, b, v] = seg[i];
      if (t >= a && t < b) {
        const prev = i ? seg[i - 1][2] : 0;
        const k = smoothstep(0, 1, clamp((t - a) / Math.min(0.5, b - a)));
        return prev + (v - prev) * k;
      }
    }
    return 1;
  }

  /** the close crab's behaviour: scuttle in, inspect the hand, pinch, rear up, run for it */
  private crab(dt: number) {
    const t = this.t, P = this.P;
    P.t = t;
    if (t < C0 - 0.5 || !this.crabSpr) return;
    let tx = this.cx, speed = 0;
    let low = 0.1, rear = 0, mouth = 0.15 + Math.sin(t * 1.9) * 0.1, froth = 0;
    let cr = 0.08, co = 0.15, reach = 0, cu = 0.05, uo = 0.1;
    let fext = 0, flift = 0, fopen = 0.2, fside = 0;
    let look = Math.sin(t * 0.8) * 0.4;
    if (t < C_STOP) {
      // out from under the taupata, sideways along the sand toward the hand
      tx = 780; speed = 120;
      cr = 0.15; cu = 0.12;
    } else if (t < C_PINCH) {
      // inspecting: hunkered, eyes on the fingers, antennae busy, mouthparts working, the fork tasting
      const it = t - C_STOP;
      tx = PINKY.x - this.crushTip[0] + 30; speed = 26;
      low = 0.35;
      look = -0.55 + Math.sin(it * 2.1) * 0.2;
      mouth = 0.25 + Math.sin(t * 13) * 0.2;
      froth = 0.6;
      const f = (it / 1.6) % 1;
      fext = it > 0.4 ? 1 : 0; fside = -0.7; fopen = f < 0.3 ? 0.9 : 0.1; flift = f < 0.45 ? 0 : f < 0.7 ? (f - 0.45) / 0.25 : 1;
      cu = Math.sin(it * 3) > 0.4 ? -0.4 : 0; uo = 0.5 + Math.sin(t * 12) * 0.4;
      cr = 0.05 + it * 0.04; co = 0.2 + Math.max(0, it - 2) * 0.5;
    } else if (t < C_REAR) {
      // the pinch: crusher out, gaping... snap
      tx = PINKY.x - this.crushTip[0]; speed = 60;
      low = 0.2;
      look = -0.6;
      const pt = t - C_PINCH;
      cr = 0.22; reach = pt < 0.35 ? 0.4 : 0.75; co = pt < 0.35 ? 1 : 0;
      mouth = 0.4; froth = 0.8;
      if (pt >= 0.35 && !this.pinched) this.pinch();
    } else if (t < C_FLEE) {
      // up it rears: claws high and gaping, frothing
      rear = 0.85; low = 0;
      cr = 1; co = 0.8 + Math.sin(t * 12) * 0.2; cu = 1; uo = 0.9 + Math.sin(t * 10 + 1) * 0.1;
      mouth = 0.4 + Math.sin(t * 9) * 0.2; froth = 1;
      look = Math.sin(t * 3) * 0.3;
    } else {
      // and off it goes, back under the bush
      tx = 1200; speed = 260;
      cr = 0.3; cu = 0.3; co = 0.3;
    }
    const dx = tx - this.cx;
    this.cvx = Math.abs(dx) < 1.5 ? 0 : Math.sign(dx) * Math.min(speed, Math.abs(dx) * 4);
    const step = this.cvx * dt;
    this.cx += step;
    const moving = Math.abs(this.cvx) > 3;
    P.gait += Math.abs(step) / (9.3 * CK);
    P.step = damp(P.step, moving ? 1 : 0, 8, dt);
    if (moving) P.dir = Math.sign(this.cvx);
    P.bob = moving ? Math.cos(P.gait * Math.PI * 4) * 0.35 : Math.sin(t * 1.6) * 0.18;
    P.roll = moving ? Math.sin(P.gait * Math.PI * 2) * 0.04 : damp(P.roll, 0, 3, dt);
    if (moving) { this.scuttleT -= dt; if (this.scuttleT <= 0) { this.scuttleT = 0.12; audio.play('rustle', { vol: 0.05, pitch: 2.2 + Math.random() * 0.4 }); } }
    const snap = t >= C_PINCH && t < C_REAR ? 30 : 7;
    P.rear = damp(P.rear, rear, 6, dt);
    P.low = damp(P.low, low, 4, dt);
    P.crush.raise = damp(P.crush.raise, cr, snap, dt);
    P.crush.open = damp(P.crush.open, co, snap * 1.5, dt);
    P.crush.reach = damp(P.crush.reach, reach, 26, dt);
    P.cut.raise = damp(P.cut.raise, cu, 7, dt);
    P.cut.open = damp(P.cut.open, uo, 10, dt);
    P.fork.ext = damp(P.fork.ext, fext, 9, dt);
    P.fork.lift = damp(P.fork.lift, flift, 9, dt);
    P.fork.open = damp(P.fork.open, fopen, 14, dt);
    P.fork.side = damp(P.fork.side, fside, 4, dt);
    P.mouth = damp(P.mouth, clamp(mouth), 14, dt);
    P.froth = damp(P.froth ?? 0, froth, 3, dt);
    P.flick += dt * (t > C_STOP && t < C_FLEE ? 9 : 4);
    for (let i = 0; i < 2; i++) {
      const e = P.eyes[i];
      e.sw = damp(e.sw, look + (i ? 0.08 : -0.08), 9, dt);
      // the eyes duck into their sockets for a moment when the hand jerks
      e.fold = damp(e.fold, this.flinch > 0.5 ? 0.6 : 0, 16, dt);
    }
    for (let i = 0; i < 8; i++) P.shuffle[i] = damp(P.shuffle[i], !moving && t > C_STOP && Math.sin(t * 2.3 + i * 1.7) > 0.93 ? 1.3 : 0, 14, dt);
    // repaint the rig (30 fps is plenty)
    this.rasterT -= dt;
    if (this.rasterT <= 0) {
      this.rasterT = 1 / 30;
      const spr = this.crabSpr, cv = trycopCanvas(CK);
      const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
      const o = drawTrycop(sk, P, { k: CK, phi: 0.52, detail: 2, hue: 0.15 });
      spr.buf.data.set(sk.resolve({ rim: 0.14, bounce: 0.08 }).data);
      spr.upload();
      this.crushTip = [o.crushTip[0], o.crushTip[1]];
    }
  }

  private pinch() {
    this.pinched = true;
    this.flinch = 1;
    this.shake = 1;
    audio.play('callClick', { vol: 0.7, pitch: 0.55 });
    audio.play('hammer', { vol: 0.2, pitch: 2.2 });
    game.r.post.flash = 0.25;
    this.say('OW! Okay! Okay! It is your beach!');
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    // heartbeat early on, breathing throughout
    this.beat -= dt;
    if (t < 5 && this.beat <= 0) { this.beat = 1.05; audio.play('land', { vol: 0.3, pitch: 0.35 }); setTimeout(() => audio.play('land', { vol: 0.22, pitch: 0.32 }), 240); }
    this.breathT -= dt;
    if (t > 1.5 && this.breathT <= 0) { this.breathT = 3.6; audio.play('gust', { vol: 0.12, pitch: 0.55 }); }
    if (t > 5.2 && t - dt <= 5.2) { audio.play('hiss', { vol: 0.25, pitch: 0.5 }); }
    for (const d of this.drops) { d.y += d.v * dt * (t > 6.5 ? 5 : 1); d.life -= dt * (t > 6.5 ? 2.5 : 1); }
    this.drops = this.drops.filter(d => d.life > 0 && d.y < 380);
    for (const c of this.clouds) c.x = (c.x + c.v * dt) % (W + 300);
    for (const g of this.gulls) g.x = ((g.x + g.v * dt + 200) % (W + 500)) - 200;
    // the tiny far crabs: dash sideways, freeze, dash again
    for (const c of this.crabs) {
      c.t += dt;
      if (c.wait > 0) { c.wait -= dt; if (c.wait <= 0) c.vx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 14); continue; }
      c.x += c.vx * dt;
      if (Math.random() < dt * 0.9 || c.x < 330 || c.x > 700) { c.wait = 0.6 + Math.random() * 2.4; c.vx = c.x < 330 ? 1 : c.x > 700 ? -1 : 0; if (c.vx) { c.vx *= 18; c.wait = 0; } }
      c.y = povShore(c.x) + (c.x < 500 ? 22 : 30);
    }
    // wind: gusts that stream grains of sand across the near beach
    this.gust = Math.max(0, this.gust - dt * 0.4);
    if (Math.random() < dt * 0.25) this.gust = 1;
    const n = Math.random() < dt * (6 + this.gust * 40) ? 1 + Math.floor(this.gust * 3) : 0;
    for (let i = 0; i < n; i++) this.grains.push({ x: 120 + Math.random() * 200, y: 600 + Math.random() * 130, v: 120 + Math.random() * 160, life: 2 + Math.random() * 3 });
    for (const g of this.grains) { g.x += g.v * dt * (0.5 + this.gust * 0.8); g.y += Math.sin(g.x * 0.05) * dt * 6; g.life -= dt; }
    this.grains = this.grains.filter(g => g.life > 0 && g.x < W + 60);
    // the close crab, and the hand jerking back from it
    this.crab(dt);
    this.flinch = Math.max(0, this.flinch - dt * 0.9);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.handOff = damp(this.handOff, this.pinched ? (this.flinch > 0.55 ? 22 : 10) : 0, this.flinch > 0.55 ? 30 : 3, dt);
    // captions
    if (t > 9.4 && t - dt <= 9.4) this.say('...land.');
    if (t > 11.2 && t - dt <= 11.2) this.say('Alive. I am actually alive.');
    if (t > 13.4 && t - dt <= 13.4) this.say('');
    if (t > 14.6 && t - dt <= 14.6) this.say('Oh. Hello there, little... not so little.');
    if (t > 16.6 && t - dt <= 16.6) this.say('');
    if (t > C_FLEE + 0.6 && t - dt <= C_FLEE + 0.6) this.say('');
    if (t > C_FLEE + 1.4 && t - dt <= C_FLEE + 1.4) this.say('Chunk...? Jenna? ...JOSHU?!');
    if (t > C_FLEE + 3.6 && t - dt <= C_FLEE + 3.6) this.say('');
    if (t > C_FLEE + 4 && !this.done) {
      this.done = true;
      game.save.flags['v4:beachWoke'] = true;
      game.persist();
      game.r.post.flash = 0.6;
      import('./islandflow').then(m => m.goIsland());
    }
  }

  render(r: Renderer) {
    const t = this.t;
    // exposure: blown out at first, settling as the eyes adjust
    const env = { ...defaultEnv() };
    const ex = t < 6.5 ? 1.75 - (t / 6.5) * 0.6 : Math.max(1, 1.15 - (t - 6.5) * 0.08);
    env.exposure = ex;
    env.bloom = 1.1 - Math.min(1, t / 9) * 0.7;
    env.bloomThreshold = 0.78 + Math.min(1, t / 10) * 0.14;
    env.vignette = 0.75 - Math.min(0.4, t * 0.04);
    env.saturation = 0.7 + Math.min(0.38, t * 0.04);
    r.env = env;
    r.post.dofStrength = Math.max(0, t < 6.5 ? 6 - t * 0.75 : 1.2 - (t - 6.5) * 0.5);
    r.post.dof = r.post.dofStrength > 0.05;
    r.view.x = 320; r.view.y = 180; r.view.zoom = 1; r.view.shakeX = r.view.shakeY = 0;
    r.screen(0, 0, 0.5, 1);
    // sitting up: pan from the zenith down to the horizon with a little roll, then take in the view
    // from the headland across to the sun, and look down at the crab when it comes
    const up = smoothstep(0, 1, clamp((t - 6.5) / 2.4));
    const look = smoothstep(0, 1, clamp((t - 8.8) / 2.6));
    const focus = smoothstep(0, 1, clamp((t - (C0 + 1.2)) / 1.6)) * (1 - smoothstep(0, 1, clamp((t - C_FLEE - 0.8) / 1.4)));
    const breath = Math.sin(t * (Math.PI * 2 / 3.6)) * (1 - up * 0.6);
    const zoom = 1 + breath * 0.012 + focus * 0.04;
    const sh = this.shake * this.shake;
    const vy = up * 366 + breath * 2 + focus * 34 + Math.sin(t * 61) * sh * 4;
    const vx = (W - r.VW) / 2 - (1 - look) * 50 * up + focus * 60 + Math.sin(t * 47) * sh * 5;
    const roll = Math.sin(up * Math.PI) * -0.06;
    r.pushTransform(r.VW / 2, r.VH / 2, roll, 0, 0);
    const ox = r.VW / 2, oy = r.VH / 2;
    const sx = (x: number) => ox + (x - vx - ox) * zoom, sy = (y: number) => oy + (y - vy - oy) * zoom;
    r.draw(this.pov, sx(-POV_PAD), sy(-POV_PAD), zoom, zoom);
    // unfocused eyes: a drifting double image that slowly converges
    const dbl = Math.max(0, 1 - t / 7) * 7 * (0.6 + 0.4 * Math.sin(t * 1.3));
    if (dbl > 0.4) {
      r.draw(this.pov, sx(-POV_PAD) + dbl, sy(-POV_PAD) + dbl * 0.3, zoom, zoom, 0, packColor(1, 1, 1, 0.45));
      r.draw(this.pov, sx(-POV_PAD) - dbl * 0.7, sy(-POV_PAD) - dbl * 0.2, zoom, zoom, 0, packColor(1, 1, 1, 0.3));
    }
    // drifting clouds, the sun's glare, gulls crossing the sky
    for (const c of this.clouds) if (c.y < 330) r.draw(c.f, sx(c.x - 150), sy(c.y), zoom, zoom, 0, packColor(1, 1, 1, 0.9));
    r.emissive(1);
    r.fxDraw(A.glow, sx(POV_SUN.x), sy(POV_SUN.y), 3.4 * zoom, 3 * zoom, 0, packColor(1, 0.92, 0.74, 1), 0.45 + up * 0.15 + Math.sin(t * 0.7) * 0.05);
    r.fxDraw(A.glow, sx(POV_SUN.x), sy(POV_SUN.y), 1.2 * zoom, 1.2 * zoom, 0, packColor(1, 1, 0.94, 1), 0.6 * up);
    r.emissive();
    for (const g of this.gulls) {
      const gy = g.y + Math.sin(g.x * 0.01) * 20, fl = Math.sin(t * 9 * g.s + g.y) > 0 ? 1 : 0, k = zoom * g.s;
      const c = packColor(0.15, 0.15, 0.2, 1);
      r.rect(sx(g.x), sy(gy), 2 * k, 1, c);
      r.rect(sx(g.x - 5 * g.s), sy(gy - fl), 5 * k, 1, c);
      r.rect(sx(g.x + 2 * g.s), sy(gy - fl), 5 * k, 1, c);
    }
    // the sun's glitter dancing down the sea toward us
    for (let i = 0; i < 70; i++) {
      const gy = POV_HORIZON + 3 + ((i * 37) % 112);
      const spread = 12 + (gy - POV_HORIZON) * 1.25;
      const gx = POV_SUN.x + Math.sin(i * 12.9898) * spread + Math.sin(t * 0.6 + i) * 3;
      const tw = Math.max(0, Math.sin(t * (2 + (i % 5)) + i * 1.7));
      if (tw > 0.55) r.fxDraw(A.dot2, sx(gx), sy(gy), (1.2 + (gy - POV_HORIZON) / 60) * zoom, 0.6 * zoom, 0, packColor(1, 0.98, 0.88, 1), (tw - 0.55) * 3);
    }
    // long low swells rolling in, and the surf lapping up the glassy sand and sliding back
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.07 + i / 3) % 1;
      const y = POV_HORIZON + 8 + ph * ph * 100;
      const a = Math.sin(ph * Math.PI) * 0.22;
      for (let x = -POV_PAD; x < W + POV_PAD; x += 4) {
        if (y > povShore(x) - 2) continue;
        if (noise1(x / 30 + i * 9, 6) > 0.62) r.rect(sx(x), sy(y + Math.sin(x * 0.02 + i) * 1.5), 4 * zoom, zoom, packColor(0.86, 0.95, 0.98, a));
      }
    }
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.2 + i / 2) % 1;
      const k = Math.sin(ph * Math.PI);
      for (let x = -POV_PAD; x < W + POV_PAD; x += 3) {
        const shy = povShore(x);
        const near = clamp((shy - POV_HORIZON) / 340);
        const reach = k * (14 + near * 40) * (0.8 + noise1(x / 40 + i * 7, 3) * 0.4);
        if (reach < 1) continue;
        r.rect(sx(x), sy(shy - 1), 3 * zoom, reach * zoom, packColor(0.72, 0.88, 0.9, 0.22 * k));
        r.rect(sx(x), sy(shy + reach - 1), 3 * zoom, 2 * zoom, packColor(1, 1, 1, 0.65 * k));
        // a line of bubbles left behind as it slides back
        if (ph > 0.5 && (x * 7) % 9 < 2) r.rect(sx(x), sy(shy + reach + 2), zoom, zoom, packColor(1, 1, 1, 0.5 * k));
      }
    }
    // life on the sand: tiny crabs far off, sand hoppers and flies over the kelp, streaming grains
    for (const c of this.crabs) r.draw(this.crabFr[c.wait > 0 ? 0 : Math.floor(c.t * 10) % 2], sx(c.x), sy(c.y), zoom * 0.8, zoom * 0.8);
    for (const [kx, ky] of [[560, 600], [330, 640]] as const) {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 1.3 + i * 0.37) % 1;
        const hx = kx + Math.sin(i * 7.1) * 40 + ph * 14, hy = ky + 6 - Math.sin(ph * Math.PI) * 9;
        r.rect(sx(hx), sy(hy), 1.4 * zoom, 1.4 * zoom, packColor(0.7, 0.6, 0.45, 1));
      }
      for (let i = 0; i < 5; i++) {
        const a = t * (3 + i) + i * 2;
        r.rect(sx(kx + Math.cos(a) * (8 + i * 4)), sy(ky - 14 + Math.sin(a * 1.3) * 6), zoom, zoom, packColor(0.08, 0.08, 0.1, 1));
      }
    }
    for (const g of this.grains) r.rect(sx(g.x), sy(g.y), (2 + this.gust * 3) * zoom, zoom, packColor(0.98, 0.9, 0.7, clamp(g.life) * 0.8));
    // Mori's hand on the sand, and the crab come to see what it is (just beyond the fingertips; its
    // claw comes over them when it pinches)
    const hj = this.flinch > 0.55 ? Math.sin(t * 70) * 2 : 0;
    const hand = () => r.draw(this.handFr[this.flinch > 0.2 ? 1 : 0], sx(POV_HAND.x + hj - this.handOff * 0.3), sy(POV_HAND.y + this.handOff), zoom, zoom);
    const over = t >= C_PINCH && t < C_REAR + 0.3;
    if (over) hand();
    if (this.crabSpr && t > C0 - 0.5 && this.cx < 1160) {
      const cs = packColor(0, 0, 0, 0.3);
      r.draw(A.shadow, sx(this.cx), sy(CRAB_Y + 2), 1.25 * CK * zoom, 0.55 * CK * zoom * (1 - this.P.rear * 0.3), 0, cs);
      r.draw(this.crabSpr.frame, sx(this.cx), sy(CRAB_Y), zoom, zoom, 0, packColor(1, 0.96, 0.9, 1));
    }
    if (!over) hand();
    // palm fronds overhead, swaying, backlit
    const sw = Math.sin(t * 0.9) * 0.05;
    r.drawSway(this.fronds[0], sx(-30), sy(-60), -zoom * 1.1, zoom * 1.1, sw, packColor(0.45, 0.55, 0.45, 1));
    r.drawSway(this.fronds[1], sx(360), sy(-110), zoom, zoom, -sw, packColor(0.42, 0.52, 0.44, 1));
    r.popTransform();
    // salt-water droplets on the eyes
    for (const d of this.drops) r.draw(d.f, d.x, d.y, 1.4, 1.4, 0, packColor(1, 1, 1, Math.min(1, d.life / 2)));
    // eyelids
    const o = this.lids(t);
    const lid = (1 - o) * (r.VH / 2 + 10);
    if (lid > 0.5) {
      const edge = (yTop: boolean) => {
        const h = Math.round(lid);
        for (let x = 0; x < r.VW; x += 8) {
          const curve = Math.round(Math.sin((x / r.VW) * Math.PI) * 14 * (1 - o * 0.6));
          if (yTop) r.rect(x, 0, 8, Math.max(0, h + 6 - curve), packColor(0, 0, 0, 1));
          else r.rect(x, r.VH - Math.max(0, h + 6 - curve), 8, Math.max(0, h + 6 - curve), packColor(0, 0, 0, 1));
        }
      };
      edge(true);
      edge(false);
    }
  }

  exit() {
    const r = game.r;
    r.post.dof = false;
    r.post.dofStrength = 3;
    this.cap?.remove();
    this.crabSpr?.dispose();
    this.crabSpr = null;
  }
}
