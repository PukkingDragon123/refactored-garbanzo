// V4: washed ashore. A short first-person wake-up: lying on the sand looking straight up, eyes
// full of salt water. Heavy blinks, blur and glare, droplets on the eyes, breathing, gulls, palm
// fronds and a pōhutukawa against the sky... then Mori sits up, the beach swims into focus and there,
// at the foot of the headland, is what's left of the Kittiwake. The beach is alive: the swash sliding
// up the glassy sand, the sun glittering on the sea, crabs scuttling between the debris, sand hoppers
// and flies over the kelp, grains of sand streaming past in the wind. Then back to side-view gameplay.

import type { Scene } from '../game';
import { game } from '../game';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, defaultEnv } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { local, A } from '../assets';
import { hex } from '../../art/color';
import * as L from '../../art/landscape';
import { paintPOV, droplet, povCrab, povShore, POV_W, POV_PAD, POV_HORIZON } from '../../art/island4/pov';
import { foreground } from '../../art/jungle-fg';
import { clamp, noise1, smoothstep } from '../../core/math';
import { audio } from '../../core/audio';
import { el } from '../../ui/ui';

const W = POV_W;

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

  async enter() {
    const r = game.r;
    this.pov = bigFrame(r, paintPOV());
    for (const [seed, sz] of [[3, 300], [9, 260]] as const) {
      const s = foreground('palm', seed, sz);
      this.fronds.push(local.add('wakeFrond' + seed, s.buf, s.ax, s.ay));
    }
    for (const rr of [3, 5, 7]) this.dropFr.push(local.add('wakeDrop' + rr, droplet(rr), rr + 1, rr + 1));
    for (let i = 0; i < 9; i++) this.drops.push({ f: this.dropFr[i % 3], x: 40 + Math.random() * 560, y: 20 + Math.random() * 300, v: 2 + Math.random() * 6, life: 9 + Math.random() * 4 });
    const ramp = ['#7a8aa8', '#a8b8d0', '#d8e4f0', '#ffffff'].map(h => hex(h));
    for (let i = 0; i < 4; i++) this.cloudFr.push(bigFrame(r, L.paintCloud(21 + i, 110 + i * 20, 30 + i * 4, ramp, 1)));
    for (let i = 0; i < 7; i++) this.clouds.push({ f: this.cloudFr[i % 4], x: Math.random() * (W + 200), y: 30 + Math.random() * 280, v: 3 + Math.random() * 4 });
    for (let i = 0; i < 2; i++) this.crabFr.push(local.add('wakeCrab' + i, povCrab(i), 7, 7));
    this.crabs = [{ x: 600, y: 668, vx: 0, t: 0, wait: 2 }, { x: 760, y: 700, vx: 0, t: 0, wait: 4 }, { x: 290, y: 650, vx: 0, t: 0, wait: 6 }];
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
    // crabs: dash sideways, freeze, dash again
    for (const c of this.crabs) {
      c.t += dt;
      if (c.wait > 0) { c.wait -= dt; if (c.wait <= 0) c.vx = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 40); continue; }
      c.x += c.vx * dt;
      c.y += Math.sin(c.t * 3) * dt * 4;
      if (Math.random() < dt * 0.9 || c.x < 220 || c.x > 860) { c.wait = 0.6 + Math.random() * 2.4; c.vx = c.x < 220 ? 1 : c.x > 860 ? -1 : 0; if (c.vx) { c.vx *= 50; c.wait = 0; } }
    }
    // wind: gusts that stream grains of sand across the near beach
    this.gust = Math.max(0, this.gust - dt * 0.4);
    if (Math.random() < dt * 0.25) this.gust = 1;
    const n = Math.random() < dt * (6 + this.gust * 40) ? 1 + Math.floor(this.gust * 3) : 0;
    for (let i = 0; i < n; i++) this.grains.push({ x: -40 + Math.random() * 200, y: 630 + Math.random() * 190, v: 120 + Math.random() * 160, life: 2 + Math.random() * 3 });
    for (const g of this.grains) { g.x += g.v * dt * (0.5 + this.gust * 0.8); g.y += Math.sin(g.x * 0.05) * dt * 6; g.life -= dt; }
    this.grains = this.grains.filter(g => g.life > 0 && g.x < W + 60);
    // captions
    if (t > 9.4 && t - dt <= 9.4) this.say('...the Kittiwake.');
    if (t > 11.6 && t - dt <= 11.6) this.say('Chunk...? Jenna? ...JOSHU?!');
    if (t > 13.6 && t - dt <= 13.6) this.say('');
    if (t > 14 && !this.done) {
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
    env.bloom = 1.1 - Math.min(1, t / 9) * 0.75;
    env.bloomThreshold = 0.78 + Math.min(1, t / 10) * 0.16;
    env.vignette = 0.75 - Math.min(0.4, t * 0.04);
    env.saturation = 0.7 + Math.min(0.35, t * 0.04);
    r.env = env;
    r.post.dofStrength = Math.max(0, t < 6.5 ? 6 - t * 0.75 : 1.2 - (t - 6.5) * 0.5);
    r.post.dof = r.post.dofStrength > 0.05;
    r.view.x = 320; r.view.y = 180; r.view.zoom = 1; r.view.shakeX = r.view.shakeY = 0;
    r.screen(0, 0, 0.5, 1);
    // sitting up: pan from the zenith down to the horizon with a little roll
    const up = smoothstep(0, 1, clamp((t - 6.5) / 2.4));
    const look = smoothstep(0, 1, clamp((t - 9) / 1.6));
    const breath = Math.sin(t * (Math.PI * 2 / 3.6)) * (1 - up * 0.6);
    const zoom = 1 + breath * 0.012 + look * 0.1;
    const vy = up * 380 + breath * 2;
    // ...and turn toward the wreck at the foot of the headland, to the west
    const vx = (W - r.VW) / 2 - look * 70;
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
    // drifting clouds, the sun glare, gulls crossing the sky
    for (const c of this.clouds) if (c.y < 330) r.draw(c.f, sx(c.x - 150), sy(c.y), zoom, zoom, 0, packColor(1, 1, 1, 0.9));
    r.emissive(1);
    r.fxDraw(A.glow, sx(540), sy(150), 3 * zoom, 3 * zoom, 0, packColor(1, 0.96, 0.82, 1), 0.9 - up * 0.5);
    r.emissive();
    for (const g of this.gulls) {
      const gy = g.y + Math.sin(g.x * 0.01) * 20, fl = Math.sin(t * 9 * g.s + g.y) > 0 ? 1 : 0, k = zoom * g.s;
      const c = packColor(0.15, 0.15, 0.2, 1);
      r.rect(sx(g.x), sy(gy), 2 * k, 1, c);
      r.rect(sx(g.x - 5 * g.s), sy(gy - fl), 5 * k, 1, c);
      r.rect(sx(g.x + 2 * g.s), sy(gy - fl), 5 * k, 1, c);
    }
    // the sun's glitter dancing on the sea
    for (let i = 0; i < 40; i++) {
      const gy = POV_HORIZON + 6 + ((i * 37) % 100);
      const spread = 30 + (gy - POV_HORIZON) * 1.4;
      const gx = 540 + Math.sin(i * 12.9898) * spread;
      const tw = Math.max(0, Math.sin(t * (2 + (i % 5)) + i * 1.7));
      if (tw > 0.6) r.fxDraw(A.dot2, sx(gx), sy(gy), 1.6 * zoom, 0.6 * zoom, 0, packColor(1, 1, 0.95, 1), (tw - 0.6) * 3);
    }
    // the swash sliding up the glassy sand and back, a lace of foam at its edge
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.22 + i / 2) % 1;
      const k = Math.sin(ph * Math.PI);
      for (let x = -POV_PAD; x < W + POV_PAD; x += 3) {
        const sh = povShore(x);
        const near = clamp((sh - POV_HORIZON) / 340);
        const reach = k * (14 + near * 40) * (0.8 + noise1(x / 40 + i * 7, 3) * 0.4);
        if (reach < 1) continue;
        r.rect(sx(x), sy(sh - 1), 3 * zoom, reach * zoom, packColor(0.7, 0.86, 0.88, 0.22 * k));
        r.rect(sx(x), sy(sh + reach - 1), 3 * zoom, 2 * zoom, packColor(1, 1, 1, 0.65 * k));
      }
    }
    // life on the sand: crabs, sand hoppers and flies over the kelp, streaming grains of sand
    for (const c of this.crabs) r.draw(this.crabFr[c.wait > 0 ? 0 : Math.floor(c.t * 10) % 2], sx(c.x), sy(c.y), zoom * 1.4, zoom * 1.4);
    for (const [kx, ky] of [[700, 606], [90, 660]] as const) {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 1.3 + i * 0.37) % 1;
        const hx = kx + Math.sin(i * 7.1) * 50 + ph * 14, hy = ky + 6 - Math.sin(ph * Math.PI) * 9;
        r.rect(sx(hx), sy(hy), 1.4 * zoom, 1.4 * zoom, packColor(0.7, 0.6, 0.45, 1));
      }
      for (let i = 0; i < 5; i++) {
        const a = t * (3 + i) + i * 2;
        r.rect(sx(kx + Math.cos(a) * (8 + i * 4)), sy(ky - 14 + Math.sin(a * 1.3) * 6), zoom, zoom, packColor(0.08, 0.08, 0.1, 1));
      }
    }
    for (const g of this.grains) r.rect(sx(g.x), sy(g.y), (2 + this.gust * 3) * zoom, zoom, packColor(0.98, 0.9, 0.7, clamp(g.life) * 0.8));
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
  }
}
