// V4 ship: the Kittiwake under way. Everything that sells the boat moving through the water, on top of
// the ocean bands (which slide aft at the cruise speed, each with its own parallax, carrying the sun
// glitter and the passing whitecaps with them):
//  - the bow wave: water heaped white against the stem and a frothy curl running aft along the hull;
//    spray flung up off the stem, small and now and then in calm water, big when she buries her nose
//    in the storm
//  - the stern wake: white water churning up behind the transom, a pale prop wash under the surface,
//    and a long trail of foam patches left on the sea, spreading and breaking up as they drift away
//  - foam streaks peeling off the bow wave and sliding aft along the waterline
//  - wind streaks: thin lines blowing aft across the sky and the far sea (behind the boat) and across
//    the deck and the near water (in front of it), with the true wind plus the boat's own speed
// It all follows the engine (s.engineOn: she coasts to a stop and picks up speed again) and the
// weather (calm to full storm). Waterline effects never draw above the cutaway mask while a deck is
// open, and while fishing the stern wake and the wind lines make way for the fishing view's own.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { SurfaceField } from '../../world/ocean';
import type { ShipScene4 } from './ship';
import { clamp, damp, hash2, lerp, smoothstep } from '../../core/math';

/** cruising speed through the water (px/s at the boat plane) with the engine running, and adrift */
const CRUISE = 30, DRIFT = 2;
/** ship-local points where the stem and the stern meet the still waterline */
const STEM: [number, number] = [507, 206];
const STERN: [number, number] = [55, 206];

interface Foam { x: number; life: number; max: number; w: number; seed: number }
interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number }
interface Streak { x: number; life: number; max: number; len: number; v: number; dy: number; seed: number }
interface Wind { x: number; y: number; len: number; v: number; life: number; max: number; a: number; dbl: boolean; seed: number }
interface View { x0: number; x1: number; y0: number; y1: number }

const rnd = Math.random;

export class Underway {
  /** 0 stopped .. 1 full ahead: follows the engine with the boat's inertia */
  speed = 1;
  private started = false;
  private t = 0;
  /** 0..1 while the fishing view is up (it draws its own wake and wind) */
  private fishK = 0;
  /** world x of the stem / stern at the waterline (updated each frame) */
  private stemX = STEM[0];
  private sternX = STERN[0];
  /** bow wave height (px) and how deep the stem is in the water (+ = buried) */
  private bowA = 0;
  private dig = 0;
  private digV = 0;
  private sprayT = 1;
  private foam: Foam[] = [];
  private streaks: Streak[] = [];
  private drops: Drop[] = [];
  private wind: { far: Wind[]; near: Wind[] } = { far: [], near: [] };
  private views: { far: View; near: View } = { far: { x0: 0, x1: 640, y0: -40, y1: 320 }, near: { x0: 0, x1: 640, y0: -40, y1: 320 } };
  private acc = { foam: 0, streak: 0, far: 0, near: 0 };
  /** the bow wave as a height field on the near water (fauna riding the bow see it too) */
  readonly field: SurfaceField;

  constructor(readonly s: ShipScene4) {
    this.field = { offset: x => this.bowOffset(x), frontK: 0 };
    s.ocean.fields.push(this.field);
  }

  // ---------------------------------------------------------------- update
  update(dt: number) {
    const s = this.s, w = s.weather, oc = s.ocean;
    this.t += dt;
    const storm = w.storm;
    // the engine: she picks up way over a few seconds and coasts to a stop more slowly
    if (!this.started) { this.started = true; this.speed = s.engineOn ? 1 : 0; }
    const on = s.engineOn ? 1 : 0;
    this.speed = damp(this.speed, on, on > this.speed ? 0.7 : 0.45, dt);
    if (Math.abs(this.speed - on) < 0.002) this.speed = on;
    w.cruise = lerp(DRIFT, CRUISE - storm * 5, this.speed);
    this.fishK = damp(this.fishK, s.fishDraw ? 1 : 0, 4, dt);
    oc.caps = 1 - this.fishK * 0.6;
    const cr = w.cruise;
    // where the hull meets the water
    const stem = s.shipToWorld(STEM[0], STEM[1]), stern = s.shipToWorld(STERN[0], STERN[1]);
    this.stemX = stem[0];
    this.sternX = stern[0];
    const raw = oc.heightAt(stem[0]) - this.bowOffset(stem[0]);
    const dig = stem[1] - raw;
    if (this.t <= dt) this.dig = dig;
    this.digV = damp(this.digV, (dig - this.dig) / Math.max(1e-3, dt), 12, dt);
    this.dig = dig;
    // the bow wave builds with speed and the sea; she shoves up more when her nose is buried
    const bowT = this.speed * (4.6 + storm * 3.5) * clamp(1 + dig * 0.12, 0.25, 2.2);
    this.bowA = damp(this.bowA, bowT, 6, dt);
    // spray off the stem: a little puff now and then in calm water, a burst when she slams into a crest
    this.sprayT -= dt;
    const surfStem = oc.heightAt(stem[0] + 3);
    if (this.speed > 0.15 && this.digV > 22 && dig > 1 && this.sprayT < 0.6) {
      // she buries her nose: a sheet of spray (the sea's own, grey in the storm light)
      oc.spray(stem[0] + 4, surfStem - 1, clamp(this.digV * 0.012 * (0.4 + storm), 0.12, 1), 0.7, -1);
      this.flick(stem[0], surfStem, 10);
      this.sprayT = 0.9;
    } else if (this.sprayT <= 0 && this.speed > 0.3) {
      // a little white spray flicked up off the stem
      this.flick(stem[0], surfStem, Math.round((5 + rnd() * 6 + storm * 8) * this.speed));
      this.sprayT = (0.7 + rnd() * 1.3) / (0.7 + storm);
    }
    const app = this.apparent();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life += dt;
      d.vy += 230 * dt;
      d.vx += (-app * 0.6 - d.vx) * Math.min(1, dt * 1.8);
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.life >= d.max || (d.vy > 0 && d.y > oc.heightAt(d.x))) this.drops.splice(i, 1);
    }
    // wake foam boiling up behind the stern, left on the sea to drift away aft
    this.acc.foam += dt * this.speed * (9 + storm * 5);
    for (; this.acc.foam >= 1; this.acc.foam--) this.foam.push({ x: this.sternX - 8 - rnd() * 22, life: 0, max: 6 + rnd() * 6, w: 5 + rnd() * 6, seed: (rnd() * 1e6) | 0 });
    for (let i = this.foam.length - 1; i >= 0; i--) {
      const f = this.foam[i];
      f.life += dt; f.x -= cr * dt * (1 - 0.25 * Math.exp(-f.life * 1.5)); f.w += dt * 0.7;
      if (f.life >= f.max) this.foam.splice(i, 1);
    }
    // streaks peeling off the bow wave (and here and there along the hull) and sliding aft
    this.acc.streak += dt * this.speed * (3.2 + storm * 3);
    for (; this.acc.streak >= 1; this.acc.streak--) {
      const fromBow = rnd() < 0.7;
      const x = fromBow ? this.stemX - 36 - rnd() * 50 : this.sternX + 30 + rnd() * (this.stemX - this.sternX - 100);
      this.streaks.push({ x, life: 0, max: 7 + rnd() * 8, len: 2 + Math.round(rnd() * 6), v: 1.02 + rnd() * 0.16, dy: rnd() < 0.28 ? 2 + Math.round(rnd() * 4) : 0, seed: (rnd() * 1e6) | 0 });
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const q = this.streaks[i];
      q.life += dt; q.x -= cr * q.v * dt;
      if (q.life >= q.max || q.x < this.sternX - 6) this.streaks.splice(i, 1);
    }
    if (this.foam.length > 220) this.foam.splice(0, this.foam.length - 220);
    if (this.streaks.length > 120) this.streaks.splice(0, this.streaks.length - 120);
    this.updateWind(dt);
  }

  /** white drops flung up and forward off the stem, soon blown back aft */
  private flick(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.drops.length < 160; i++) {
      this.drops.push({ x: x + 1 + rnd() * 6, y: y - 1 - rnd() * 2, vx: 18 + rnd() * 46, vy: -(28 + rnd() * 52) * (0.7 + this.s.weather.storm * 0.6), life: 0, max: 0.45 + rnd() * 0.4 });
    }
  }

  /** the wind over the boat: the true wind plus her own way through the air (px/s, toward -x) */
  private apparent() {
    const w = this.s.weather;
    return Math.max(0, -(w.windSpeed - w.cruise));
  }

  private updateWind(dt: number) {
    const w = this.s.weather, storm = w.storm;
    const app = this.apparent();
    const rate = Math.max(0, app - 6) * (0.2 - storm * 0.07) * (0.7 + w.gust * 0.6);
    for (const which of ['far', 'near'] as const) {
      const list = this.wind[which], V = this.views[which];
      const far = which === 'far';
      this.acc[which] += dt * rate * (far ? 1.4 : 1);
      for (; this.acc[which] >= 1; this.acc[which]--) {
        if (list.length > 90) continue;
        const len = (16 + rnd() * 40 + storm * (12 + rnd() * 30)) * (far ? 0.8 : 1);
        // the far ones mostly up in the sky (over the busy sea they'd be lost), the near ones anywhere
        list.push({
          x: V.x0 + rnd() * (V.x1 - V.x0 + 160), y: V.y0 + Math.pow(rnd(), far ? 1.6 : 1) * (V.y1 - V.y0) * (far ? 0.75 : 1), len,
          v: (60 + app * 2.2) * (0.8 + rnd() * 0.4) * (far ? 0.7 : 1), life: 0, max: (0.45 + rnd() * 0.65) * (1 - storm * 0.3),
          a: Math.min(0.9, (0.5 + rnd() * 0.3) * (1 + storm * 0.1)), dbl: rnd() < 0.35, seed: (rnd() * 1e6) | 0,
        });
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.life += dt; q.x -= q.v * dt; q.y += Math.sin(this.t * 2.6 + q.seed) * dt * 5;
        if (q.life >= q.max) list.splice(i, 1);
      }
    }
  }

  /** the heap of water at the stem (world y offset, negative = up), with a shallow trough behind it */
  private bowOffset(x: number) {
    const A = this.bowA;
    if (A < 0.05) return 0;
    const u = x - this.stemX;
    if (u > 22 || u < -120) return 0;
    let k: number;
    if (u >= 0) k = 1 - smoothstep(0, 22, u);
    else if (u >= -70) k = smoothstep(-70, -2, u);
    else k = -0.3 * Math.sin(((u + 70) / -50) * Math.PI);
    return -A * k;
  }

  // ---------------------------------------------------------------- drawing
  /** how far waterline foam may ride up the hull above the cutaway line: a little against the closed
   *  hull, none at all while the lower deck is open */
  private clipY(x: number, extra = 0): number {
    const m = this.s.ocean.maskY(x);
    if (m === -Infinity) return -Infinity;
    return m - (2 + extra) * this.s.hullA;
  }

  /** on the near water (the boat plane): bow wave, waterline streaks, the stern's churn and wake */
  drawNear(r: Renderer) {
    const s = this.s, oc = s.ocean, w = s.weather;
    const storm = w.storm;
    const vx0 = r.visibleX0(8), vx1 = r.visibleX1(8);
    const light = 0.94 + w.lightning * 0.7;
    const tick = Math.floor(this.t * 12);
    // foam white, its shaded underside, and the darker dimple of water under the foam (for contrast
    // against the bright crest of the band)
    const W0 = (a: number) => packColor(light, light, light, a);
    const W1 = (a: number) => packColor(light * 0.84, light * 0.93, light * 0.98, a);
    const SH = (a: number) => packColor(0.08, 0.26, 0.34, a);
    const px = (x: number, y: number, c: number, clip: number) => { if (y >= clip) r.rect(x, y, 1, 1, c); };
    r.emissive(0.24);
    // ---- the stern: white water heaped up and churning behind the transom, the prop wash under it
    const wake = this.speed * (1 - this.fishK * 0.85);
    if (wake > 0.02 && this.sternX + 8 > vx0 && this.sternX - 140 < vx1) {
      const sx = Math.round(this.sternX);
      for (let x = sx - 52; x <= sx + 2; x++) {
        const u = clamp((sx - x) / 52); // 0 at the transom .. 1 aft
        const k = wake * (1 - u * 0.5);
        const clip = this.clipY(x);
        // the churned water heaps up right behind the transom
        const top = Math.round(oc.heightAt(x)) - (u < 0.35 ? 2 : u < 0.7 ? 1 : 0);
        const rows = 2 + Math.round(k * (3 + storm * 1.5));
        for (let j = 0; j < rows; j++) {
          if (hash2(x * 5 + j, tick, 31) < 0.1 + u * 0.3 + j * 0.1) continue;
          px(x, top + j, j === 0 ? W0(0.96) : W1(0.85), clip);
        }
        px(x, top + rows, SH(0.25 * k), clip);
        // clots of foam heaved up out of the boil
        if (hash2(x, tick, 47) < 0.22 * k * (1 + storm)) px(x, top - 1 - Math.floor(hash2(x, tick, 53) * 2), W0(0.85), clip);
      }
      // prop wash: pale streaks pouring aft just under the surface
      for (let i = 0; i < 8; i++) {
        const d = (this.t * (s.weather.cruise * 1.5 + 14) + i * 19) % 120;
        const x = Math.round(sx - 2 - d);
        const a = wake * 0.34 * (1 - d / 120);
        if (a < 0.02) continue;
        const y = Math.round(oc.heightAt(x) + 3 + (i % 3) * 3 + Math.sin(this.t * 3 + i) * 1.2);
        r.rect(x, y, 6 + (i % 4) * 3, 1, packColor(0.82, 0.96, 1, a));
      }
    }
    // ---- the wake: patches of foam left on the sea, spreading out and breaking up as they drift aft
    const fk = 1 - this.fishK * 0.85;
    if (fk > 0.02) for (const f of this.foam) {
      if (f.x < vx0 - 14 || f.x > vx1 + 14) continue;
      const u = f.life / f.max;
      const a = (u < 0.05 ? u / 0.05 : 1 - u * u) * fk;
      if (a <= 0.02) continue;
      const n = Math.max(2, Math.round(f.w));
      const x0 = Math.round(f.x - n / 2);
      const gen = Math.floor(u * 8);
      const rows = u < 0.25 ? 3 : u < 0.6 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        if (hash2(f.seed + i, gen, 5) < 0.08 + u * 0.55) continue;
        const x = x0 + i;
        const clip = this.clipY(x);
        const y = Math.round(oc.heightAt(x)) - (hash2(f.seed, i, 7) > 0.7 ? 1 : 0);
        px(x, y, W0(0.92 * a), clip);
        if (rows > 1 && hash2(f.seed + i, 3, 9) < 0.8) px(x, y + 1, W1(0.82 * a), clip);
        if (rows > 2 && hash2(f.seed + i, 6, 9) < 0.55) px(x, y + 2, W1(0.6 * a), clip);
        // a little pulled under the surface
        if (u < 0.5 && hash2(f.seed + i, 4, 9) < 0.3) px(x, y + 3, packColor(0.8, 0.95, 1, 0.3 * a), clip);
      }
    }
    // ---- foam streaks sliding aft along the waterline (and a few just under the surface)
    for (const q of this.streaks) {
      if (q.x < vx0 || q.x > vx1) continue;
      const u = q.life / q.max;
      const near = clamp((q.x - this.sternX) / 30);
      const a = (u < 0.08 ? u / 0.08 : 1 - u * u * 0.6) * near * (q.dy ? 0.32 : 0.95);
      if (a <= 0.02) continue;
      const x0 = Math.round(q.x);
      for (let j = 0; j < q.len; j++) {
        if (j > 0 && hash2(q.seed + j, Math.floor(u * 9), 11) < 0.15) continue;
        const x = x0 + j;
        const clip = this.clipY(x);
        const y = Math.round(Math.max(oc.heightAt(x), clip)) + q.dy;
        px(x, y, W0(a), clip);
        if (!q.dy && j > 0 && j < q.len - 1) px(x, y + 1, W1(a * 0.75), clip);
      }
    }
    // ---- the bow wave: a frothy white heap against the stem, its curl running aft along the hull
    const A = this.bowA;
    if (A > 0.15 && this.stemX + 18 > vx0 && this.stemX - 95 < vx1) {
      const xs = Math.round(this.stemX);
      for (let x = xs - 90; x <= xs + 14; x++) {
        const u = x - xs;
        const I = u >= 0 ? 1 - u / 15 : Math.pow(1 + u / 90, 1.2);
        if (I <= 0.03) continue;
        const clip = this.clipY(x, 6 * smoothstep(-60, 0, u));
        const top = Math.round(oc.heightAt(x) - I * A * 0.9);
        const th = 1 + Math.round(I * (2 + A * 0.7));
        for (let j = 0; j < th; j++) {
          // solid near the stem, lacier further aft and toward the bottom of the foam
          if (j > 0 && hash2(x * 7 + j, tick, 61) < (1 - I) * 0.45 + j * 0.07) continue;
          px(x, top + j, j === 0 || j < th - 1 ? W0(0.96) : W1(0.85), clip);
        }
        if (I > 0.2) px(x, top + th, SH(0.3 * I), clip);
        // the curl: white flecks tossed just above the crest near the stem
        if (u > -20 && hash2(x, tick, 67) < 0.5 * I * clamp(A / 3)) px(x, top - 1 - Math.floor(hash2(x, tick, 71) * 3), W0(0.85), clip);
      }
    }
    // spray drops off the stem
    for (const d of this.drops) {
      const u = d.life / d.max;
      r.rect(Math.round(d.x), Math.round(d.y), 1, 1, W0(0.95 * (1 - u * u)));
    }
    r.emissive();
  }

  /** wind streaks on a layer behind the boat ('far') or in front of it ('near') */
  drawWind(r: Renderer, which: 'far' | 'near') {
    const s = this.s, w = s.weather;
    // remember what this layer can see, for spawning
    const V = this.views[which];
    V.x0 = r.wx(0); V.x1 = r.wx(r.VW); V.y0 = r.wy(0); V.y1 = r.wy(r.VH);
    const fade = 1 - this.fishK * (which === 'near' ? 1 : 0.7);
    if (fade <= 0.02) return;
    const k = 1 / Math.max(0.2, r.layerZoom);
    const L = w.lightning, storm = w.storm;
    const cr = lerp(1, 0.86, storm), cg = lerp(1, 0.92, storm), cb = lerp(1, 0.95, storm);
    // in front of an open deck (the cutaway), keep the wind out of the rooms (the near layer sits a
    // little in front of the boat plane: shift by its parallax to test against the hull)
    const open = which === 'near' ? 1 - Math.min(s.hullA, s.bridgeA) : 0;
    const offX = which === 'near' ? 0.1 * r.view.x : 0;
    for (const q of this.wind[which]) {
      const u = q.life / q.max;
      // quick to appear, holds, then thins away
      let a = (u < 0.15 ? u / 0.15 : u > 0.7 ? (1 - u) / 0.3 : 1) * q.a * fade * (1 + L * 1.5);
      const bx = q.x - offX;
      if (open > 0.02 && bx + q.len > 10 && bx < 570 && q.y > -10 && q.y < 240) a *= 1 - open;
      if (a < 0.01) continue;
      const x = Math.round(q.x), y = Math.round(q.y), len = Math.round(q.len);
      r.rect(x, y, len, k, packColor(cr, cg, cb, Math.min(1, a)));
      if (q.dbl) r.rect(x + Math.round(len * 0.25), y + Math.round(2 * k), Math.round(len * 0.45), k, packColor(cr, cg, cb, Math.min(1, a * 0.5)));
    }
  }
}
