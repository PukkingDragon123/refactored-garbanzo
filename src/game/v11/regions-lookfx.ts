// V11 region looks, the runtime: applies a place's atmosphere pack (regions-look.ts) to a field scene.
// The grade wraps the scene's own envHook (so the time of day, caves, events still work underneath);
// the air, the ambient wildlife and the sounds are drawables on the scene's layers (they die with the
// scene); signature plants are scattered along the walk line once, away from anything interactive.
// On the home island the pack follows Mori: the grade eases from one stretch's look into the next.

import type { Env, Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage, Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import type { FieldScene } from '../scenes/field';
import { game } from '../game';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { Rng, clamp, rand } from '../../core/math';
import { sprite } from '../sites2/common';
import { plant, fungus } from '../../art/jungle-plants';
import type { PlantKind, FungusKind } from '../../art/jungle-plants';
import type { TimeOfDay } from '../../world/timeofday';
import { LOOKS } from './regions-look';
import type { Look, Grade, AirSpec, CritterSpec, RGB } from './regions-look';

// ------------------------------------------------------------------ which place a scene is
/** the location a field scene plays (the V10 tag, a site's loc, a landing's cfg, the forest on Day 1) */
export function lookLocOf(f: FieldScene, tagged: string | null): string | null {
  if (tagged) return tagged;
  const s = f.site as unknown as { id?: string; loc?: string };
  const cfg = (f as unknown as { cfg?: { loc?: string } }).cfg;
  if (cfg?.loc) return cfg.loc;
  if (s.loc) return s.loc;
  if (s.id === 'forest') return 'forest';
  if (s.id === ('Glass Reef' as never)) return 'glassreef';
  return null;
}

// ------------------------------------------------------------------ the grade
interface G { amb: RGB; fog: RGB; fogK: number; sat: number; contrast: number; exposure: number; bloom: number; vignette: number; gain: RGB }
const ID: G = { amb: [1, 1, 1], fog: [0.6, 0.7, 0.75], fogK: 0, sat: 1, contrast: 1, exposure: 1, bloom: 0, vignette: 0, gain: [1, 1, 1] };
const full = (g?: Grade): G => ({
  amb: g?.amb ?? ID.amb, fog: g?.fog ?? ID.fog, fogK: g?.fogK ?? 0, sat: g?.sat ?? 1, contrast: g?.contrast ?? 1, exposure: g?.exposure ?? 1,
  bloom: g?.bloom ?? 0, vignette: g?.vignette ?? 0, gain: g?.gain ?? ID.gain,
});
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ease(g: G, to: G, k: number) {
  g.amb = lerp3(g.amb, to.amb, k); g.fog = lerp3(g.fog, to.fog, k); g.gain = lerp3(g.gain, to.gain, k);
  g.fogK += (to.fogK - g.fogK) * k; g.sat += (to.sat - g.sat) * k; g.contrast += (to.contrast - g.contrast) * k;
  g.exposure += (to.exposure - g.exposure) * k; g.bloom += (to.bloom - g.bloom) * k; g.vignette += (to.vignette - g.vignette) * k;
}
const lum = (c: RGB) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
function gradeEnv(env: Env, g: G) {
  const m = (c: RGB, k: RGB): RGB => [c[0] * k[0], c[1] * k[1], c[2] * k[2]];
  env.ambientTop = m(env.ambientTop, g.amb);
  env.ambientBottom = m(env.ambientBottom, g.amb);
  if (g.fogK > 0.001) {
    // the haze colour at the brightness the time of day already gave the fog
    const tint = (c: RGB): RGB => { const s = lum(c) / Math.max(0.05, lum(g.fog)); return lerp3(c, [g.fog[0] * s, g.fog[1] * s, g.fog[2] * s], g.fogK); };
    env.fogTop = tint(env.fogTop);
    env.fogBottom = tint(env.fogBottom);
  }
  env.saturation *= g.sat;
  env.contrast *= g.contrast;
  env.exposure *= g.exposure;
  env.bloom += g.bloom;
  env.vignette += g.vignette;
  // (gain is shared with the time preset: always a new array)
  env.gain = [env.gain[0] * g.gain[0], env.gain[1] * g.gain[1], env.gain[2] * g.gain[2]];
}

const on = (times: TimeOfDay[] | undefined, tod: TimeOfDay) => !times || times.includes(tod);

// ------------------------------------------------------------------ the air
/** particles drifting through the view around the camera */
class Air implements Drawable {
  z = 64;
  private acc = new Map<string, number>();
  constructor(readonly f: FieldScene, public specs: () => AirSpec[]) {}
  update(dt: number, st: Stage) {
    const f = this.f, tod = f.tod;
    const cx = st.cam.x, cy = st.cam.y, W = game.r.VW / Math.max(0.5, st.cam.zoom) * 0.6, H = game.r.VH / Math.max(0.5, st.cam.zoom) * 0.6;
    const main = f.main;
    if (!main) return;
    for (const s of this.specs()) {
      if (!on(s.times, tod)) continue;
      const a = (this.acc.get(s.kind) ?? 0) + dt * s.rate * RATE[s.kind];
      let n = Math.floor(a);
      this.acc.set(s.kind, a - n);
      while (n-- > 0) emit(s.kind, f, main, cx + rand.range(-W, W), cy + rand.range(-H, H), st);
    }
  }
  draw() {}
}
/** particles per second at rate 1 */
const RATE: Record<string, number> = {
  pollen: 5, spores: 6, glowspores: 9, motes: 4, dust: 5, grit: 14, spray: 9, ash: 9, embers: 2.5, drizzle: 40, drips: 3, mist: 1.2,
  petals: 1.6, leaves: 1.4, seeds: 5, snow: 10, bubbles: 3, midges: 2, smoke: 1,
};
function groundAt(f: FieldScene, x: number, y: number) {
  return f.st.terrain.surfaceBelow(x, y - 4)?.y ?? f.st.terrain.groundY(x);
}
function emit(kind: string, f: FieldScene, L: Layer, x: number, y: number, st: Stage) {
  const w = st.wind;
  const night = f.tod === 'night';
  switch (kind) {
    case 'pollen': L.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-3, 3) + w * 4, vy: rand.range(-3, 2), life: rand.range(4, 8), color: [1, 0.9, 0.55], alpha: 0.75, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1, wobble: 4, wobbleF: 0.7, size: 0.8 }); break;
    case 'spores': L.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-2, 2) + w * 2, vy: rand.range(-4, 1), life: rand.range(5, 9), color: [0.86, 1, 0.82], alpha: 0.55, alpha1: 0, fadeIn: 0.4, glow: true, intensity: night ? 1.4 : 0.8, wobble: 5, wobbleF: 0.5, size: 0.7 }); break;
    case 'glowspores': { const c: RGB = rand.chance(0.5) ? [0.4, 1, 0.85] : [0.7, 0.6, 1]; L.glowParticles.spawn({ frame: A.dot, x, y: y + 60, vx: rand.range(-3, 3), vy: rand.range(-12, -5), life: rand.range(5, 10), color: c, alpha: 1, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 2.2, wobble: 6, wobbleF: 0.6, size: rand.range(0.6, 1.2) }); break; }
    case 'motes': L.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-1.5, 1.5), vy: rand.range(-1.5, 1.5), life: rand.range(4, 8), color: [1, 0.96, 0.85], alpha: 0.6, alpha1: 0, fadeIn: 0.4, glow: true, intensity: 0.9, wobble: 3, wobbleF: 0.6, size: 0.6 }); break;
    case 'dust': L.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-2, 2), vy: rand.range(-1, 1.5), life: rand.range(5, 9), color: [0.95, 0.92, 0.85], alpha: 0.4, alpha1: 0, fadeIn: 0.4, glow: true, intensity: 0.6, wobble: 2, wobbleF: 0.4, size: 0.5 }); break;
    case 'grit': L.particles.spawn({ frame: A.dot2, x: x - 300, y: groundAt(f, x, y) - rand.range(2, 60), vx: 90 + w * 60, vy: rand.range(-6, 4), life: rand.range(2, 4), color: [0.78, 0.66, 0.5], alpha: 0.6, alpha1: 0, size: 0.6 }); break;
    case 'spray': L.particles.spawn({ frame: A.soft, x: x - 200, y: groundAt(f, x, y) - rand.range(10, 90), vx: 40 + w * 40, vy: rand.range(-10, 2), life: rand.range(1.5, 3), color: [0.94, 0.97, 1], alpha: 0.3, alpha1: 0, size: rand.range(0.3, 0.6), size1: rand.range(1.2, 2.2) }); if (rand.chance(0.5)) L.particles.spawn({ frame: A.dot2, x: x - 150, y: groundAt(f, x, y) - rand.range(4, 50), vx: 60 + w * 50, vy: rand.range(-20, 0), ay: 30, life: rand.range(1, 2), color: [1, 1, 1], alpha: 0.7, alpha1: 0, size: 0.5 }); break;
    case 'ash': L.particles.spawn({ frame: A.dot2, x, y: y - 120, vx: rand.range(-4, 4) + w * 8, vy: rand.range(6, 14), life: rand.range(6, 10), color: [0.55, 0.53, 0.5], alpha: 0.85, alpha1: 0.3, vrot: rand.range(-2, 2), flutter: 0.6, size: 0.7, floorY: groundAt(f, x, y) + rand.range(2, 30), onFloor: 'stop' }); break;
    case 'embers': { const gy = groundAt(f, x, y); L.glowParticles.spawn({ frame: A.dot, x, y: gy - rand.range(0, 10), vx: rand.range(-6, 6) + w * 6, vy: rand.range(-30, -14), life: rand.range(1.5, 3), color: [1, 0.55, 0.2], color1: [0.6, 0.15, 0.05], alpha: 1, alpha1: 0, glow: true, intensity: 2.2, wobble: 5, wobbleF: 2, size: 0.6 }); break; }
    case 'drizzle': L.particles.spawn({ frame: A.dot2, x: x + rand.range(-60, 60), y: y - 160, vx: -20 + w * 20, vy: rand.range(220, 280), life: 1.6, color: [0.82, 0.88, 0.95], alpha: 0.32, alpha1: 0.2, size: 0.5, rot: 1.45, floorY: groundAt(f, x, y), onFloor: 'die' }); break;
    case 'drips': { const gy = groundAt(f, x, y); L.particles.spawn({ frame: A.dot2, x, y: gy - rand.range(140, 220), vy: 40, ay: 420, life: 2, color: [0.75, 0.9, 0.95], alpha: 0.8, alpha1: 0.6, size: 0.6, floorY: gy, onFloor: 'die' }); break; }
    case 'mist': L.particles.spawn({ frame: A.soft, x: x - 120, y: groundAt(f, x, y) - rand.range(10, 70), vx: 8 + w * 10, vy: rand.range(-3, 1), life: rand.range(6, 10), color: [0.9, 0.94, 0.96], alpha: 0.14, alpha1: 0, fadeIn: 0.5, size: rand.range(2.5, 4), size1: rand.range(5, 7) }); break;
    case 'petals': { const gy = groundAt(f, x, y); L.particles.spawn({ frame: A.dot2, x, y: y - 150, vx: rand.range(-4, 6) + w * 8, vy: rand.range(10, 18), life: 12, color: rand.chance(0.7) ? [0.9, 0.18, 0.12] : [1, 0.42, 0.3], alpha: 1, alpha1: 0.6, vrot: rand.range(1, 4), flutter: 1, size: 0.9, floorY: gy + rand.range(2, 30), onFloor: 'stop' }); break; }
    case 'leaves': if (A.leaves.length) { const gy = groundAt(f, x, y); L.particles.spawn({ frame: A.leaves[Math.floor(rand.next() * A.leaves.length)], x, y: y - 160, vx: 5 + w * 10, vy: rand.range(12, 20), life: 14, color: rand.chance(0.35) ? [0.85, 0.6, 0.3] : [0.75, 0.85, 0.55], alpha: 1, alpha1: 0.7, vrot: rand.range(1, 3), flutter: 1, floorY: gy + rand.range(2, 26), onFloor: 'stop' }); } break;
    case 'seeds': L.glowParticles.spawn({ frame: A.dot, x: x - 200, y, vx: 50 + w * 50, vy: rand.range(-6, 6), life: rand.range(5, 8), color: [1, 0.98, 0.9], alpha: 0.5, alpha1: 0, glow: true, intensity: 0.6, wobble: 6, wobbleF: 1.4, size: 0.7 }); break;
    case 'snow': L.particles.spawn({ frame: A.dot2, x, y: y - 100, vx: rand.range(-2, 2), vy: rand.range(4, 9), life: rand.range(8, 14), color: [0.85, 0.92, 0.95], alpha: 0.45, alpha1: 0, size: rand.range(0.4, 0.7), wobble: 3, wobbleF: 0.5 }); break;
    case 'bubbles': L.particles.spawn({ frame: A.dot2, x, y: y + 90, vx: rand.range(-3, 3), vy: rand.range(-30, -16), life: rand.range(3, 5), color: [0.85, 0.95, 1], alpha: 0.7, alpha1: 0, size: rand.range(0.5, 1), wobble: 4, wobbleF: 2 }); break;
    case 'midges': { const gy = groundAt(f, x, y); for (let i = 0; i < 10; i++) L.particles.spawn({ frame: A.dot2, x: x + rand.range(-6, 6), y: gy - rand.range(20, 60) + rand.range(-5, 5), vx: rand.range(-3, 3), vy: rand.range(-2, 2), life: rand.range(3, 6), color: [0.12, 0.12, 0.1], alpha: 0.8, alpha1: 0, size: 0.4, wobble: 9, wobbleF: 4 }); break; }
    case 'smoke': L.particles.spawn({ frame: A.soft, x: x - 100, y: groundAt(f, x, y) - rand.range(40, 120), vx: 6 + w * 8, vy: rand.range(-4, -1), life: rand.range(8, 12), color: [0.8, 0.78, 0.74], alpha: 0.08, alpha1: 0, fadeIn: 0.3, size: rand.range(2, 3), size1: rand.range(5, 7) }); break;
  }
}
// ------------------------------------------------------------------ ambient wildlife
interface Flyer { x: number; y: number; vx: number; vy: number; ph: number; t: number; life: number; kind: string; n: number; spread: number[] }
/** birds and bats on a parallax layer of their own: flocks crossing the far sky, gulls gliding, swifts
 *  and swallows darting, bats flitting at dusk, a hawk circling high */
class Fliers implements Drawable {
  z = 0;
  private list: Flyer[] = [];
  private t = 0;
  private seed = true;
  constructor(readonly f: FieldScene, readonly p: number, readonly specs: () => CritterSpec[]) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    for (const b of this.list) {
      b.t += dt;
      if (b.kind === 'hawk') { b.x += Math.cos(b.t * 0.25) * 24 * dt + 4 * dt; b.y += Math.sin(b.t * 0.25) * 8 * dt; }
      else if (b.kind === 'swifts' || b.kind === 'swallows' || b.kind === 'bats') {
        const k = b.kind === 'bats' ? 3.5 : 1.6;
        b.vx += Math.sin(b.t * k + b.ph) * 120 * dt; b.vy += Math.cos(b.t * k * 1.3 + b.ph) * 90 * dt;
        const sp = Math.hypot(b.vx, b.vy), max = b.kind === 'bats' ? 70 : 140;
        if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
      } else { b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(b.t * 0.8 + b.ph) * 4 * dt; }
    }
    this.list = this.list.filter(b => b.t < b.life);
    if (this.t > 0) return;
    const first = this.seed;
    this.seed = false;
    this.t = rand.range(1.5, 4);
    const tod = this.f.tod;
    const cx = st.cam.x * this.p;
    for (const s of this.specs()) {
      if (!on(s.times, tod)) continue;
      const cur = this.list.filter(b => b.kind === s.kind).length;
      if (cur >= s.n) continue;
      if (!first && !rand.chance(0.5)) continue;
      const dir = rand.chance(0.5) ? 1 : -1;
      const sky = s.kind === 'flock' || s.kind === 'parakeets' || s.kind === 'seabirds' || s.kind === 'gulls' || s.kind === 'hawk';
      const n = s.kind === 'flock' ? rand.int(5, 11) : s.kind === 'parakeets' ? rand.int(3, 6) : s.kind === 'seabirds' ? rand.int(6, 14) : s.kind === 'gulls' ? rand.int(1, 3) : 1;
      const spread = Array.from({ length: n * 2 }, () => rand.range(-1, 1));
      const speed = s.kind === 'hawk' ? 0 : s.kind === 'gulls' ? 26 : s.kind === 'seabirds' ? 34 : s.kind === 'parakeets' ? 60 : 40;
      // (y in screen terms at this layer: the far sky for flocks, around the view for the darting kinds)
      this.list.push({ kind: s.kind, x: s.kind === 'hawk' || first ? cx + rand.range(-260, 260) : cx - dir * 420, y: sky ? rand.range(30, 110) : rand.range(70, 200), vx: dir * speed * rand.range(0.8, 1.2), vy: rand.range(-3, 3), ph: rand.range(0, 6), t: 0, life: s.kind === 'hawk' ? 60 : sky ? 30 : rand.range(6, 12), n, spread });
    }
  }
  draw(r: Renderer, st: Stage) {
    const night = this.f.tod === 'night';
    // (layer coords: world y such that it lands at screen y on this layer)
    const y0 = (st.cam.y - 180) * this.p;
    for (const b of this.list) {
      const fade = Math.min(1, b.t / 1.5, (b.life - b.t) / 1.5);
      if (fade <= 0) continue;
      const white = b.kind === 'gulls' || b.kind === 'seabirds';
      const col = white ? packColor(0.95, 0.96, 0.95, fade) : b.kind === 'parakeets' ? packColor(0.3, 0.55, 0.25, fade) : night ? packColor(0.05, 0.05, 0.07, fade) : packColor(0.12, 0.12, 0.14, fade);
      const size = b.kind === 'hawk' ? 5 : b.kind === 'gulls' ? 4 : b.kind === 'bats' ? 2.5 : b.kind === 'swifts' || b.kind === 'swallows' ? 2.5 : 2;
      for (let i = 0; i < b.n; i++) {
        const ox = b.n > 1 ? b.spread[i * 2] * (8 + b.n * 2) - i * 3 * Math.sign(b.vx || 1) : 0, oy = b.n > 1 ? b.spread[i * 2 + 1] * 6 : 0;
        const flap = b.kind === 'hawk' || b.kind === 'gulls' ? Math.sin(b.t * 1.5 + i) * 0.3 : Math.sin(b.t * (b.kind === 'bats' ? 18 : 11) + i * 1.7);
        bird(r, b.x + ox, y0 + b.y + oy, size, flap, col);
      }
    }
  }
}
/** a bird in pixels: a body and two wing strokes that flap */
function bird(r: Renderer, x: number, y: number, s: number, flap: number, col: number) {
  const up = Math.round(flap * s * 0.6);
  r.rect(x - 0.5, y - 0.5, 1, 1, col);
  for (let i = 1; i <= Math.ceil(s); i++) {
    const dy = Math.round(-up * (i / s) + (i / s) * (i / s) * 1.2);
    r.rect(x - 0.5 - i, y - 0.5 + dy, 1, 1, col);
    r.rect(x - 0.5 + i, y - 0.5 + dy, 1, 1, col);
  }
}

interface Walker { x: number; vx: number; t: number; dir: number; kind: string; stop: number; flee: number }
/** crabs scuttling and skinks darting on the ground near the walk line; they bolt from Mori */
class Grounders implements Drawable {
  z = 3;
  private list: Walker[] = [];
  private seeded = false;
  constructor(readonly f: FieldScene, readonly specs: () => CritterSpec[]) {}
  update(dt: number, st: Stage) {
    const f = this.f, p = f.player;
    if (!p) return;
    const want = this.specs().filter(s => (s.kind === 'crabs' || s.kind === 'skinks') && on(s.times, f.tod));
    if (!this.seeded) {
      this.seeded = true;
      for (const s of want) for (let i = 0; i < s.n; i++) this.list.push({ kind: s.kind, x: st.cam.x + rand.range(-500, 500), vx: 0, t: rand.range(0, 4), dir: rand.chance(0.5) ? 1 : -1, stop: rand.range(0.5, 3), flee: 0 });
    }
    for (const w of this.list) {
      w.t += dt;
      const d = w.x - p.x;
      if (Math.abs(d) < 46 && w.flee <= 0) { w.flee = rand.range(1.2, 2); w.dir = Math.sign(d) || 1; }
      if (w.flee > 0) { w.flee -= dt; w.vx = w.dir * (w.kind === 'skinks' ? 110 : 70); }
      else {
        w.stop -= dt;
        if (w.stop <= 0) { w.stop = rand.range(0.6, 3); if (rand.chance(0.5)) w.dir = -w.dir; w.vx = rand.chance(0.4) ? 0 : w.dir * (w.kind === 'skinks' ? 60 : 22); }
      }
      w.x += w.vx * dt;
      // keep them about the view
      if (Math.abs(w.x - st.cam.x) > 600) { w.x = st.cam.x + rand.range(-500, 500); w.flee = 0; w.vx = 0; }
    }
  }
  draw(r: Renderer) {
    const f = this.f;
    for (const w of this.list) {
      if (w.x < r.visibleX0(10) || w.x > r.visibleX1(10)) continue;
      const gy = groundAt(f, w.x, f.player?.y ?? 0);
      const moving = Math.abs(w.vx) > 1;
      if (w.kind === 'crabs') {
        const leg = moving && Math.floor(w.t * 14) % 2 === 0;
        const body = packColor(0.78, 0.3, 0.16, 1), dark = packColor(0.4, 0.12, 0.06, 1);
        r.rect(w.x - 2, gy - 3, 4, 2, body);
        r.rect(w.x - 1, gy - 4, 2, 1, body);
        r.rect(w.x - 3, gy - (leg ? 1 : 2), 1, 1, dark); r.rect(w.x + 2, gy - (leg ? 2 : 1), 1, 1, dark);
        r.rect(w.x - 3, gy - 4, 1, 1, body); r.rect(w.x + 2, gy - 4, 1, 1, body);
      } else {
        const skin = packColor(0.36, 0.42, 0.24, 1), belly = packColor(0.6, 0.6, 0.36, 1);
        const s = w.dir;
        r.rect(w.x - 2, gy - 2, 5, 1, skin);
        r.rect(w.x + (s > 0 ? 3 : -3), gy - 2, 1, 1, skin);
        r.rect(w.x - (s > 0 ? 5 : -3), gy - 1, 3, 1, skin);
        r.rect(w.x - 1, gy - 1, 3, 1, belly);
        if (moving && Math.floor(w.t * 16) % 2) { r.rect(w.x - 1, gy, 1, 1, skin); r.rect(w.x + 2, gy - 1, 1, 1, skin); }
      }
    }
  }
}

/** fish jumping out of the scene's water now and then (rings and a splash) */
class Jumpers implements Drawable {
  z = 26;
  private j: { x: number; y: number; t: number; d: number; dir: number }[] = [];
  private t = rand.range(2, 6);
  constructor(readonly f: FieldScene, readonly n: () => number) {}
  update(dt: number, st: Stage) {
    for (const q of this.j) q.t += dt;
    this.j = this.j.filter(q => q.t < q.d + 1.2);
    this.t -= dt;
    if (this.t > 0 || this.n() <= 0) return;
    this.t = rand.range(4, 10) / this.n();
    const water = this.f.st.terrain.water.filter(w => w[1] > st.cam.x - 300 && w[0] < st.cam.x + 300 && w[3] - w[2] > 10);
    if (!water.length) return;
    const w = water[Math.floor(rand.next() * water.length)];
    const x = clamp(st.cam.x + rand.range(-280, 280), w[0] + 20, w[1] - 20);
    this.j.push({ x, y: w[2], t: 0, d: 0.7, dir: rand.chance(0.5) ? 1 : -1 });
  }
  draw(r: Renderer) {
    for (const q of this.j) {
      if (q.t < q.d) {
        const k = q.t / q.d;
        const fx = q.x + q.dir * k * 14, fy = q.y - Math.sin(k * Math.PI) * 14;
        const c = packColor(0.75, 0.8, 0.8, 1);
        r.rect(fx - 2, fy - 1, 4, 2, c);
        r.rect(fx - q.dir * 3, fy - (k < 0.5 ? 2 : 0), 1, 2, c);
        if (k > 0.85 && k < 0.9) this.f.splash(fx, q.y, 0.35);
      }
      const rk = Math.min(1, q.t / (q.d + 1.2));
      for (const x0 of [q.x, q.x + q.dir * 14]) r.fxDraw(A.dot2, x0, q.y + 0.5, 2 + rk * 8, 0.35, 0, packColor(0.9, 0.97, 1, 1), (1 - rk) * 0.45);
    }
  }
}

/** shoals of little fish turning in the blue far off (underwater) */
class Shoals implements Drawable {
  z = 0;
  private s: { x: number; y: number; ph: number; n: number; sp: number[] }[] = [];
  constructor(readonly n: number, readonly p: number) {
    const rng = new Rng(77);
    for (let i = 0; i < n; i++) this.s.push({ x: rng.range(0, 2000) * p, y: rng.range(60, 260), ph: rng.range(0, 6), n: rng.int(14, 30), sp: Array.from({ length: 64 }, () => rng.range(-1, 1)) });
  }
  draw(r: Renderer, st: Stage) {
    const t = st.time;
    for (const q of this.s) {
      const cx = q.x + Math.sin(t * 0.07 + q.ph) * 120, cy = q.y + Math.sin(t * 0.11 + q.ph) * 30 + (st.cam.y - 180) * this.p;
      for (let i = 0; i < q.n; i++) {
        const a = t * 0.6 + q.ph + i * 0.2;
        const x = cx + q.sp[i * 2] * 26 + Math.cos(a) * 6, y = cy + q.sp[i * 2 + 1] * 10 + Math.sin(a * 1.3) * 3;
        const glint = Math.sin(t * 2 + i) > 0.85;
        r.rect(x, y, 2, 1, glint ? packColor(0.85, 0.95, 1, 0.9) : packColor(0.25, 0.4, 0.5, 0.7));
      }
    }
  }
}

// ------------------------------------------------------------------ sounds
class Sounds implements Drawable {
  z = -100;
  private next = new Map<number, number>();
  constructor(readonly f: FieldScene, readonly look: () => Look | null) {}
  update(dt: number) {
    const L = this.look();
    if (!L?.sounds || this.f.cutscene) return;
    L.sounds.forEach((s, i) => {
      if (!on(s.times, this.f.tod)) return;
      let t = this.next.get(i) ?? rand.range(s.every[0] * 0.3, s.every[1]);
      t -= dt;
      if (t <= 0) {
        t = rand.range(s.every[0], s.every[1]);
        const pr = s.pitch ?? [0.9, 1.1];
        audio.play(s.sfx, { vol: s.vol, pitch: rand.range(pr[0], pr[1]), pan: rand.range(-0.7, 0.7) });
      }
      this.next.set(i, t);
    });
  }
  draw() {}
}

// ------------------------------------------------------------------ signature plants
function scatterPlants(f: FieldScene, look: Look, x0: number, x1: number, seed: number) {
  if (!look.plants?.length || !f.main) return;
  const rng = new Rng(seed);
  const busy = (x: number) => f.interact.some(it => Math.abs(it.x - x) < 26) || f.pois.some(p => p.kind === 'cover' && Math.abs(p.x - x) < 24);
  const glowOn = f.tod === 'dusk' || f.tod === 'night';
  for (const ps of look.plants) {
    const n = Math.round(((x1 - x0) / 1000) * ps.per);
    for (let i = 0; i < n; i++) {
      const x = rng.range(x0 + 40, x1 - 40);
      if (busy(x)) continue;
      // on the ground (not on a ledge high above it, and not in the water)
      const gy = f.st.terrain.groundY(x);
      if (f.st.terrain.water.some(w => x > w[0] && x < w[1] && gy > w[2] - 2)) continue;
      const v = rng.int(0, 2);
      const size = Math.round(rng.range(ps.size[0], ps.size[1]) / 2) * 2;
      const key = `rl:${ps.kind}:${ps.id}:${v}:${size}`;
      const c = sprite(key, () => (ps.kind === 'plant' ? plant(ps.id as PlantKind, 2100 + v * 13 + size, size) : fungus(ps.id as FungusKind, 2200 + v * 11 + size, size)));
      if (!c) continue;
      const y = gy + (ps.front ? rng.range(3, 7) : 1);
      f.main.add(new Prop(c.f, x, y, ps.front ? 57 : -2.3, { sway: ps.kind === 'plant' ? 0.7 : 0, flip: rng.chance(0.5) }));
      if (c.g && ps.glow) {
        const g = c.g;
        f.main.add(new Custom(ps.front ? 57.1 : -2.2, rr => { if (!glowOn) return; rr.emissive(1); rr.draw(g, x, y); rr.emissive(); rr.light(x, y - 5, 26, 0.4, 1, 0.9, 0.6); }));
      }
    }
  }
}

// ------------------------------------------------------------------ applying a look
let applied: WeakSet<FieldScene> = new WeakSet();

/**
 * Apply a place's look to a field scene (once per scene). `islandLoc` (the home island) is asked for
 * the stretch under Mori every frame instead of a fixed place.
 */
export function applyRegionLook(f: FieldScene, loc: string | null, islandLoc?: (x: number) => string) {
  if (applied.has(f)) return;
  applied.add(f);
  const fixed = loc ? LOOKS[loc] ?? null : null;
  if (!fixed && !islandLoc) return;
  const cur = { id: loc ?? '', look: fixed };
  const g: G = full(fixed?.grade);
  let target = g;
  // the grade, over the scene's own light
  const prev = f.st.envHook;
  let lastT = performance.now();
  f.st.envHook = (env, dt) => {
    prev?.(env, dt);
    if (islandLoc && f.player) {
      const id = islandLoc(f.player.x);
      if (id !== cur.id) { cur.id = id; cur.look = LOOKS[id] ?? null; target = full(cur.look?.grade); }
      const now = performance.now();
      ease(g, target, clamp((now - lastT) / 1000 * 0.8, 0, 1));
      lastT = now;
    }
    gradeEnv(env, g);
  };
  const look = () => cur.look;
  const main = f.main;
  if (!main) return;
  main.add(new Air(f, () => look()?.air ?? []));
  main.add(new Sounds(f, look));
  const crit = () => look()?.critters ?? [];
  main.add(new Grounders(f, crit));
  main.add(new Jumpers(f, () => crit().filter(c => c.kind === 'fish' && on(c.times, f.tod)).reduce((a, c) => a + c.n, 0)));
  // a far layer for the birds, slotted in among the scene's own far layers
  const pFar = 0.22;
  const st = f.st;
  const sky = insertLayer(st, 'rl-birds', pFar);
  sky.add(new Fliers(f, pFar, () => crit().filter(c => c.kind !== 'crabs' && c.kind !== 'skinks' && c.kind !== 'fish' && c.kind !== 'shoal')));
  const shoal = crit().find(c => c.kind === 'shoal');
  if (shoal) sky.add(new Shoals(shoal.n, pFar));
  // insects for the time of day, signature plants
  const looks = islandLoc ? [] : fixed ? [fixed] : [];
  for (const L of looks) for (const b of L.insects ?? []) {
    if (!on(b.times, f.tod)) continue;
    for (let i = 0; i < b.n; i++) { const x = rand.range(40, f.site.width - 40); const gy = st.terrain.groundY(x); f.insects.spawn(b.kind, x, gy - rand.range(20, b.kind === 'firefly' || b.kind === 'skymoth' ? 120 : 70), 1, 10); }
  }
  if (fixed) scatterPlants(f, fixed, 0, f.site.width, (loc ?? '').length * 977 + 13);
}

/** add a layer to the stage just in front of the scene's farther layers (the birds fly behind the near
 *  scenery, in front of the far ranges) */
function insertLayer(st: Stage, name: string, p: number): Layer {
  const lay = st.addLayer(name, p, 0.12, 0.2, 0, p);
  const i = st.layers.indexOf(lay);
  st.layers.splice(i, 1);
  let at = st.layers.findIndex(l => !l.screen && l.p > p);
  if (at < 0) at = st.layers.length;
  st.layers.splice(at, 0, lay);
  return lay;
}

/** (tests / the developer panel: forget which scenes have a look) */
export function resetLooks() { applied = new WeakSet(); }
