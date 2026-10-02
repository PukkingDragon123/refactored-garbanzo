// V4 ship: the rogue wave on screen. The art (art/giantwave.ts) is repainted ten times a second into
// two textures, while the wave itself moves smoothly:
//  - the body (face, back, barrel, the waves running ahead) on a layer just behind the boat, and again,
//    column by column, in front of the hull below the cutaway line (as the near sea is), through the near
//    band's drawColumn hook: the wave owns those columns of the sea
//  - the curl and its claws on a layer in front of everything, with the spray flung off the claws
// It is also a height field on the near sea (heightAt: the boat rides up its face) that flattens the
// regular swell around itself, so its surface meets the sea's without a step. It draws with the near
// band's own layer settings and emissive, so its colours are the sea's colours under the same light.

import type { Frame, Renderer } from '../../gfx/renderer';
import { frameOf, packColor } from '../../gfx/renderer';
import type { Texture } from '../../gfx/gl';
import { trackSceneTexture } from '../../gfx/atlas';
import { BODY, GiantWaveArt, HMAX, LIP, TX } from '../../art/giantwave';
import type { SurfaceField } from '../../world/ocean';
import { clamp, lerp, rand, smoothstep } from '../../core/math';
import type { ShipScene4 } from './ship';

interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number; big: boolean }

export class GiantWave {
  /** world x of the crest */
  cx = 1300;
  /** height (world px) and curl (0 a steep swell .. 1 the lip pitched right over) the cutscene wants */
  H = 0;
  curl = 0;
  on = false;
  readonly art = new GiantWaveArt();
  readonly field: SurfaceField;
  private t = 0;
  private acc = 1;
  /** the lip is painted the frame after the body (the paint is split over two frames) */
  private lipDue = false;
  private dirty = { body: false, lip: false };
  private tex: { body: Texture | null; lip: Texture | null } = { body: null, lip: null };
  private fr: { body: Frame | null; lip: Frame | null } = { body: null, lip: null };
  private drops: Drop[] = [];
  private emitAcc = 0;
  /** the crest's speed (world px/s, negative: coming in) */
  private vcx = 0;
  private lastCx = 1300;
  private deep: number;

  constructor(readonly s: ShipScene4) {
    this.field = {
      offset: x => (this.on ? -this.art.profile(x - this.cx) : 0),
      frontK: 0,
      calm: x => this.calmAt(x),
      drawColumn: (r, x, top, w, bottom) => this.column(r, x, top, w, bottom),
    };
    s.ocean.fields.push(this.field);
    const d = this.art.pal.deep;
    this.deep = packColor((d & 255) / 255, ((d >>> 8) & 255) / 255, ((d >>> 16) & 255) / 255);
  }

  /** the art owns the sea's columns once the swell around it is fully flattened */
  private get active() {
    return this.on && this.art.H >= 80 && !!this.fr.body;
  }
  private calmAt(x: number) {
    if (!this.on) return 0;
    const u = x - this.cx, H = this.art.H;
    const a = -(130 + 0.32 * H) - 300, b = 360 + 0.5 * H;
    return smoothstep(0, 80, H) * smoothstep(a - 220, a - 20, u) * (1 - smoothstep(b + 20, b + 220, u));
  }
  private get sea() {
    return this.s.ocean.y;
  }

  // ---------------------------------------------------------------- update

  update(dt: number) {
    if (!this.on) return;
    this.t += dt;
    if (dt > 0) this.vcx = lerp(this.vcx, (this.cx - this.lastCx) / dt, Math.min(1, dt * 6));
    this.lastCx = this.cx;
    // the lip's half of the last paint
    if (this.lipDue) {
      this.lipDue = false;
      this.art.paintLip();
      this.dirty.lip = true;
    } else {
      this.acc += dt;
      if (this.acc >= 0.1) {
        this.acc = 0;
        const oc = this.s.ocean;
        this.art.paintBody(Math.min(HMAX, this.H), clamp(this.curl), this.t, this.cx, oc.stormStrip('near'));
        this.dirty.body = true;
        this.lipDue = true;
      }
    }
    this.spray(dt);
  }

  /** spray torn off the claws and the crown, flung ahead and drifting on the wind */
  private spray(dt: number) {
    const w = this.s.weather, wind = w.windSpeed;
    const tips = this.art.tips;
    if (tips.length && this.art.H > 60) {
      this.emitAcc += dt * (50 + 170 * this.art.c) * (this.art.H / HMAX);
      for (; this.emitAcc >= 1; this.emitAcc--) {
        if (this.drops.length > 600) break;
        const tp = tips[(rand.next() * tips.length) | 0];
        const sp = 30 + rand.next() * 90;
        this.drops.push({
          x: this.cx + tp.u, y: this.sea - tp.v,
          vx: tp.dx * sp - 40 - rand.next() * 60 + this.vcx * 0.85, vy: -tp.dy * sp - rand.next() * 30,
          life: 0, max: 0.6 + rand.next() * 1.4, big: rand.next() < 0.3,
        });
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life += dt;
      d.vy += 140 * dt;
      d.vx += (wind * 1.4 - d.vx) * Math.min(1, dt * 0.9);
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.life >= d.max) this.drops.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- drawing

  private upload(r: Renderer, k: 'body' | 'lip') {
    const buf = k === 'body' ? this.art.body : this.art.lip;
    let tex = this.tex[k];
    if (!tex) {
      tex = this.tex[k] = trackSceneTexture(r.texture(buf.w, buf.h, buf.bytes, true));
      this.fr[k] = frameOf(tex);
    } else tex.subImage(0, 0, buf.w, buf.h, buf.bytes);
    this.dirty[k] = false;
  }
  /** the near band's own emissive (the wave is lit exactly as the sea is) */
  private emissive(r: Renderer) {
    const w = this.s.weather;
    r.emissive(lerp(0.14, 0.22, w.storm) + w.lightning * 0.1);
  }

  /** behind the boat: the whole body */
  drawBack(r: Renderer) {
    if (!this.on) return;
    if (this.dirty.body) this.upload(r, 'body');
    if (!this.active) return;
    this.emissive(r);
    const ox = this.cx + BODY.u0, oy = this.sea - BODY.v1;
    r.draw(this.fr.body!, ox, oy, TX, TX);
    const yb = oy + this.art.body.h * TX, vb = r.wy(r.VH) + 4;
    if (vb > yb) r.rect(ox, yb, this.art.body.w * TX, vb - yb, this.deep);
    r.emissive();
  }

  /** the near band's column hook: the wave's columns are the wave's (in front of the hull, below the
   *  cutaway line, it paints its own water as the band would) */
  private column(r: Renderer, x: number, top: number, w: number, bottom: number): boolean {
    if (!this.active) return false;
    const u = x + w / 2 - this.cx;
    if (u < BODY.u0 + 2 || u > BODY.u1 - 2 || this.art.profile(u) < 1.5) return false;
    const m = this.s.ocean.maskY(x + w / 2);
    if (m === -Infinity) return true;
    const ox = this.cx + BODY.u0, oy = this.sea - BODY.v1;
    const it = Math.floor((x + w / 2 - ox) / TX);
    const b = this.art.body;
    if (it < 0 || it >= b.w) return true;
    const j0 = Math.max(this.art.faceTop[it], Math.ceil((Math.max(top, m) - oy) / TX));
    if (j0 < b.h) r.drawSub(this.fr.body!, it, j0, 1, b.h - j0, ox + it * TX, oy + j0 * TX, TX, TX);
    const yb = oy + b.h * TX;
    if (bottom > yb) r.rect(ox + it * TX, yb, TX, bottom - yb, this.deep);
    return true;
  }

  /** in front of everything: the curl, its claws and their spray */
  drawFront(r: Renderer) {
    if (!this.on) return;
    if (this.dirty.lip) this.upload(r, 'lip');
    if (!this.active || !this.fr.lip) return;
    this.emissive(r);
    r.draw(this.fr.lip, this.cx + LIP.u0, this.sea - LIP.v1, TX, TX);
    const L = this.s.weather.lightning;
    const lit = 0.9 + L * 0.5;
    for (const d of this.drops) {
      const k = d.life / d.max;
      const a = (k < 0.1 ? k / 0.1 : 1 - k * k) * 0.95;
      if (a < 0.05) continue;
      // crisp: quantised alpha, whole pixels
      const q = Math.ceil(a * 3) / 3;
      const c = d.big ? packColor(0.93 * lit, 0.96 * lit, 0.94 * lit, q) : packColor(0.79 * lit, 0.85 * lit, 0.82 * lit, q);
      // (whole art pixels at the wide shot's zoom: about two world px each)
      const sz = d.big ? 6 : 4;
      r.rect(Math.round(d.x / 2) * 2, Math.round(d.y / 2) * 2, sz, d.big && k > 0.5 ? 4 : sz, c);
    }
    r.emissive();
  }
}
