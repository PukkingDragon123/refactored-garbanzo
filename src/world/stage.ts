// Stage: an ordered stack of parallax layers holding drawables, particles, terrain and a camera.
// Used by the camp, every expedition site and in-engine cutscenes.

import type { Renderer, Env } from '../gfx/renderer';
import { Particles } from './particles';
import { Terrain } from './terrain';
import { TimeOfDay, TimePreset, timePreset, Mood } from './timeofday';
import { clamp, damp, rand } from '../core/math';

export interface Drawable {
  z: number;
  draw(r: Renderer, st: Stage): void;
  update?(dt: number, st: Stage): void;
  dead?: boolean;
}

export class Layer {
  items: Drawable[] = [];
  particles = new Particles(900);
  glowParticles = new Particles(900);
  private dirty = true;
  screen = false;
  visible = true;
  /** optional rigid transform for everything on this layer: [pivotX, pivotY, rot, tx, ty] */
  xf: [number, number, number, number, number] | null = null;
  constructor(
    readonly name: string,
    public p: number,
    public fog = 0,
    public receive = 1,
    public emissive = 0,
    public py = p,
  ) {}
  add<T extends Drawable>(d: T): T {
    this.items.push(d);
    this.dirty = true;
    return d;
  }
  remove(d: Drawable) {
    const i = this.items.indexOf(d);
    if (i >= 0) this.items.splice(i, 1);
  }
  markDirty() {
    this.dirty = true;
  }
  sort(always = false) {
    if (this.dirty || always) {
      this.items.sort((a, b) => a.z - b.z);
      this.dirty = false;
    }
  }
}

export interface CamState {
  x: number;
  y: number;
  zoom: number;
  tx: number;
  ty: number;
  tzoom: number;
  follow: number;
  zoomLerp: number;
  shake: number;
  shakeT: number;
  /** when set, camera is driven directly (cutscenes) */
  locked: boolean;
  /** additive view offset (handheld camera sway), world px */
  ox?: number;
  oy?: number;
}

export class Stage {
  layers: Layer[] = [];
  private byName = new Map<string, Layer>();
  terrain = new Terrain();
  preset: TimePreset;
  env: Env;
  time = 0;
  wind = 0.6;
  /** world bounds for the camera on the p=1 plane */
  minX = 0;
  maxX = 1000;
  minY = -200;
  maxY = 360;
  cam: CamState = { x: 320, y: 180, zoom: 1, tx: 320, ty: 180, tzoom: 1, follow: 4, zoomLerp: 3, shake: 0, shakeT: 0, locked: false };
  /** hook for per-frame env modulation (lightning flashes, danger tint...) */
  envHook: ((env: Env, dt: number) => void) | null = null;
  waterY: number | null = null;

  constructor(readonly tod: TimeOfDay, mood: Mood = { shade: 0 }) {
    this.preset = timePreset(tod, mood);
    this.env = { ...this.preset.env };
  }

  addLayer(name: string, p: number, fog = 0, receive = 1, emissive = 0, py = p) {
    const l = new Layer(name, p, fog, receive, emissive, py);
    this.layers.push(l);
    this.byName.set(name, l);
    return l;
  }
  addScreenLayer(name: string, emissive = 0.5) {
    const l = this.addLayer(name, 0, 0, 0, emissive, 0);
    l.screen = true;
    return l;
  }
  layer(name: string) {
    const l = this.byName.get(name);
    if (!l) throw new Error('No layer ' + name);
    return l;
  }
  hasLayer(name: string) {
    return this.byName.has(name);
  }

  shake(amount: number, time = 0.4) {
    this.cam.shake = Math.max(this.cam.shake, amount);
    this.cam.shakeT = Math.max(this.cam.shakeT, time);
  }

  update(dt: number) {
    this.time += dt;
    for (const l of this.layers) {
      for (let i = l.items.length - 1; i >= 0; i--) {
        const d = l.items[i];
        d.update?.(dt, this);
        if (d.dead) l.items.splice(i, 1);
      }
      l.particles.update(dt);
      l.glowParticles.update(dt);
    }
  }

  /** Camera clamp and smoothing; call once per frame before render. */
  updateCamera(dt: number, r: Renderer) {
    const c = this.cam;
    if (!c.locked) {
      c.zoom = damp(c.zoom, c.tzoom, c.zoomLerp, dt);
      c.x = damp(c.x, c.tx, c.follow, dt);
      c.y = damp(c.y, c.ty, c.follow, dt);
    }
    const halfW = r.VW / 2 / c.zoom, halfH = r.VH / 2 / c.zoom;
    if (this.maxX - this.minX > halfW * 2) c.x = clamp(c.x, this.minX + halfW, this.maxX - halfW);
    else c.x = (this.minX + this.maxX) / 2;
    if (this.maxY - this.minY > halfH * 2) c.y = clamp(c.y, this.minY + halfH, this.maxY - halfH);
    else c.y = this.maxY - halfH;
    let sx = 0, sy = 0;
    if (c.shakeT > 0) {
      c.shakeT -= dt;
      const k = c.shake * Math.min(1, c.shakeT * 3);
      sx = (rand.next() - 0.5) * 2 * k;
      sy = (rand.next() - 0.5) * 2 * k;
      if (c.shakeT <= 0) c.shake = 0;
    }
    r.view.x = c.x + (c.ox ?? 0);
    r.view.y = c.y + (c.oy ?? 0);
    r.view.zoom = c.zoom;
    r.view.shakeX = sx;
    r.view.shakeY = sy;
  }

  render(r: Renderer, dt: number) {
    const env = this.env;
    Object.assign(env, this.preset.env);
    env.ambientTop = [...this.preset.env.ambientTop];
    env.ambientBottom = [...this.preset.env.ambientBottom];
    env.fogTop = [...this.preset.env.fogTop];
    env.fogBottom = [...this.preset.env.fogBottom];
    env.waterAxis = this.waterY;
    this.envHook?.(env, dt);
    r.env = env;
    for (const l of this.layers) {
      if (!l.visible) continue;
      if (l.screen) r.screen(l.fog, l.receive, l.emissive);
      else r.layer(l.p, l.fog, l.receive, l.emissive, l.py);
      l.sort();
      if (l.xf) r.pushTransform(l.xf[0], l.xf[1], l.xf[2], l.xf[3], l.xf[4]);
      for (const d of l.items) d.draw(r, this);
      l.particles.draw(r);
      l.glowParticles.draw(r);
      if (l.xf) r.popTransform();
    }
  }

  /** Remove every drawable and particle (scene teardown). */
  clear() {
    for (const l of this.layers) {
      l.items.length = 0;
      l.particles.clear();
      l.glowParticles.clear();
    }
  }
}
