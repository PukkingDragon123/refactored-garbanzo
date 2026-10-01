// FieldCamera (V2): a real camera, not a point-and-win button.
// - handheld sway + hand tremor (worse zoomed in, after running, at night; better crouched, bracing,
//   holding your breath, with the stabiliser skill or kawakawa tea)
// - autofocus picks what is under the AF box, including leaves in front of the animal
// - the shutter records every animal in frame with occlusion (foreground alpha masks), focus,
//   motion blur (relative to your panning), shake, size, composition and behaviour
// - motion/shake blur is baked into the stored image; photos are stored raw for review later

import { game } from './game';
import type { Stage } from '../world/stage';
import type { PixelBuffer } from '../art/pixel';
import type { Animal } from './wild/animal';
import type { WildHost } from './wild/world';
import { addRawPhoto, PhotoSubject, RawPhoto, rawPhotos } from './photos';
import { SPECIES_BY_ID } from './species';
import { perks } from './skills';
import { audio } from '../core/audio';
import { clamp, damp } from '../core/math';

/** A foreground prop that can block the shot. The mask is the sprite's own pixels. */
export interface Occluder {
  mask: PixelBuffer;
  x: number;
  y: number;
  ax: number;
  ay: number;
  /** horizontal scale (negative = flipped) */
  sx: number;
  sy: number;
  /** parallax plane */
  p: number;
  /** draw order within the same plane */
  z: number;
}

const FRAME = { x0: 0.06, y0: 0.07, x1: 0.94, y1: 0.93 };
const depthOf = (p: number) => 1 / (1 + p);

interface RecStat { a: Animal; t: number; beh: Map<string, number>; best: PhotoSubject | null }

export class FieldCamera {
  active = false;
  mode: 'photo' | 'video' = 'photo';
  zoom = 1.6;
  shots: number;
  shotsTaken = 0;
  occluders: Occluder[] = [];
  /** AF */
  afTarget: Animal | null = null;
  afForeground: Occluder | null = null;
  afState: 'none' | 'hunting' | 'locked' = 'none';
  private afT = 0;
  focus = 0.5;
  /** handheld */
  private swayT = Math.random() * 10;
  breath = 1;
  holding = false;
  breathless = 0;
  private swayX = 0;
  private swayY = 0;
  private swayVX = 0;
  private swayVY = 0;
  private camPX = 0;
  private camPY = 0;
  private camVX = 0;
  private camVY = 0;
  private mx = 0.5;
  private my = 0.5;
  cooldown = 0;
  /** instant print developing after a shot: 0 (just ejected) .. 1 (dry) */
  develop = 1;
  private shakeK = 0;
  private lastMx = 0;
  private lastMy = 0;
  private jolt = 0;
  private joltT = 3;
  private recoil = 0;
  /** video */
  recording = false;
  private recT = 0;
  private recStats = new Map<Animal, RecStat>();
  private recThumb: string | null = null;
  private vf: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  /** extra light at the player (headlamp) for exposure */
  lamp = 0;
  onShot: ((p: RawPhoto) => void) | null = null;

  constructor(readonly host: WildHost, readonly site: RawPhoto['site']) {
    this.shots = perks.shots() + (game.save.buff === 'energy' ? 4 : 0);
    this.vf = game.ui.vf;
    this.vf.innerHTML = `<div class="frame"><div class="grid"></div><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div></div>
      <div class="focus"></div><div class="subject"></div>
      <div class="top"><span class="mode">PHOTO</span><span class="rec">● REC <span class="rt">0.0</span>s</span><span class="shots"></span></div>
      <div class="info"><span class="zoom"></span><span class="af">AF</span><span class="stab"></span><span class="light"></span></div>
      <div class="breathbar"><i></i></div><div class="lcd"></div>`;
    for (const k of ['focus', 'subject', 'mode', 'shots', 'zoom', 'af', 'rt', 'stab', 'light', 'breathbar', 'lcd']) this.els[k] = this.vf.querySelector('.' + k) as HTMLElement;
    injectCss();
    this.els.lcd.addEventListener('pointerdown', e => { e.stopPropagation(); this.shakePrint(); });
  }

  get zoomMax() {
    return perks.zoomMax();
  }

  raise(on: boolean) {
    if (this.active === on) return;
    this.active = on;
    this.vf.classList.toggle('on', on);
    if (!on && this.recording) this.stopRecording();
    if (on) audio.play('zoom', { vol: 0.3 });
    const r = game.r;
    if (!on) { r.post.dof = false; r.post.ca = 0; }
  }
  /** call when lowering the camera so the view stops swaying */
  settle(st: Stage) {
    st.cam.ox = 0;
    st.cam.oy = 0;
  }

  /** frame rectangle in screen art px */
  frameScreen() {
    const r = game.r;
    return { x0: FRAME.x0 * r.VW, y0: FRAME.y0 * r.VH, x1: FRAME.x1 * r.VW, y1: FRAME.y1 * r.VH };
  }

  /**
   * Per-frame update while the camera is raised. Steers the stage camera.
   * brace: crouching / hiding / leaning on something.
   */
  update(dt: number, st: Stage, px: number, py: number, brace: boolean, animals: Animal[]) {
    const inp = game.input;
    const r = game.r;
    this.cooldown -= dt;
    this.breathless = Math.max(0, this.breathless - dt * 0.18);
    if (!this.active) { this.breath = Math.min(1, this.breath + dt * 0.3); return; }
    // zoom
    if (inp.wheel) { this.zoom = clamp(this.zoom - inp.wheel * 0.2, 1.1, this.zoomMax); audio.play('zoom', { vol: 0.25, pitch: 1 + this.zoom * 0.1 }); }
    if (inp.down('zoomIn')) this.zoom = clamp(this.zoom + dt * 1.3, 1.1, this.zoomMax);
    if (inp.down('zoomOut')) this.zoom = clamp(this.zoom - dt * 1.3, 1.1, this.zoomMax);
    if (inp.hit('mode')) {
      if (perks.video()) {
        if (this.recording) this.stopRecording();
        this.mode = this.mode === 'photo' ? 'video' : 'photo';
        audio.play('ui');
      } else game.ui.toast('Learn <b>Video mode</b> in the Camera skill tree first.', 'CAMERA', 'coral');
    }
    // hold breath (Shift) to steady the shot for a few seconds
    this.holding = inp.down('run') && this.breath > 0.02;
    this.breath = clamp(this.breath + (this.holding ? -dt / 3.2 : dt * 0.28));
    if (this.holding && this.breath <= 0.02) this.breathless = Math.max(this.breathless, 0.5);
    // aim: mouse steers the view around the photographer
    this.mx = damp(this.mx, clamp(inp.mx / r.VW), 9, dt);
    this.my = damp(this.my, clamp(inp.my / r.VH), 9, dt);
    // handheld motion: slow sway + fast tremor
    this.swayT += dt;
    const steady = perks.shake() * (brace ? 0.55 : 1) * (this.holding ? 0.3 : 1) * (1 + this.breathless * 2.5) * (this.host.tod === 'night' ? 1.25 : 1);
    const a = this.zoom * steady * 1.35;
    const s = this.swayT;
    // random hand jolts (less when holding your breath or bracing), and recoil after each shot
    this.joltT -= dt;
    if (this.joltT <= 0) { this.joltT = 1.2 + Math.random() * 3; this.jolt = (this.holding ? 0.4 : 1) * (brace ? 0.6 : 1); }
    this.jolt = Math.max(0, this.jolt - dt * 4);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    const jx = Math.sin(s * 61) * this.jolt * 3.2 * a, jy = (Math.cos(s * 53) * this.jolt * 2.4 + this.recoil * 7) * a;
    const sx = (Math.sin(s * 1.3) + Math.sin(s * 2.9) * 0.5) * 1.4 * a + (Math.sin(s * 23) * 0.5 + Math.sin(s * 37) * 0.3) * 0.5 * a + jx;
    const sy = (Math.cos(s * 1.1) + Math.sin(s * 3.7) * 0.4) * 1.0 * a + (Math.cos(s * 29) * 0.5 + Math.sin(s * 41) * 0.3) * 0.45 * a + jy;
    this.swayVX = (sx - this.swayX) / Math.max(dt, 1e-4);
    this.swayVY = (sy - this.swayY) / Math.max(dt, 1e-4);
    this.swayX = sx;
    this.swayY = sy;
    const reachX = 250, reachY = 130;
    st.cam.tx = px + (this.mx - 0.5) * 2 * reachX;
    st.cam.ty = py + (this.my - 0.5) * 2 * reachY;
    st.cam.tzoom = this.zoom;
    st.cam.follow = 7;
    st.cam.zoomLerp = 6;
    st.cam.ox = sx / this.zoom;
    st.cam.oy = sy / this.zoom;
    // camera (panning) velocity, world px/s
    this.camVX = damp(this.camVX, (st.cam.x - this.camPX) / Math.max(dt, 1e-4), 12, dt);
    this.camVY = damp(this.camVY, (st.cam.y - this.camPY) / Math.max(dt, 1e-4), 12, dt);
    this.camPX = st.cam.x;
    this.camPY = st.cam.y;
    this.updateAF(dt, st, animals);
    r.post.dof = true;
    r.post.focus = this.focus;
    r.post.dofStrength = 2 + this.zoom * 1.5;
    r.post.ca = 0.0022;
    this.updateDevelop(dt);
    const fire = inp.shutter || (inp.click(0) && inp.lastDevice !== 'touch');
    if (fire && this.cooldown <= 0 && !game.ui.blocking) {
      if (this.mode === 'photo' && this.develop < 1) {
        this.cooldown = 0.35;
        this.shakeK = Math.min(1, this.shakeK + 0.35);
        audio.play('wrong', { vol: 0.35 });
        this.els.lcd.classList.add('nag');
        setTimeout(() => this.els.lcd.classList.remove('nag'), 400);
      } else if (this.mode === 'photo') this.shoot(animals);
      else if (this.recording) this.stopRecording();
      else this.startRecording();
    }
    if (this.recording) this.updateRecording(dt, animals);
    this.updateUI();
  }

  // ---------------------------------------------------------------- occlusion
  /** is the screen point covered by an occluder in front of plane p / z? */
  private covered(sx: number, sy: number, p: number, z: number, list = this.occluders): Occluder | null {
    const r = game.r;
    for (const o of list) {
      if (!(o.p > p + 1e-3 || (Math.abs(o.p - p) < 1e-3 && o.z > z))) continue;
      const zz = Math.pow(r.view.zoom, o.p);
      const cx = r.projectX(o.x, o.p), cy = r.projectY(o.y, o.p);
      const u = Math.floor((sx - cx) / (o.sx * zz) + o.ax), v = Math.floor((sy - cy) / (o.sy * zz) + o.ay);
      if (u < 0 || v < 0 || u >= o.mask.w || v >= o.mask.h) continue;
      if (o.mask.data[v * o.mask.w + u] >>> 24 > 110) return o;
    }
    return null;
  }

  private updateAF(dt: number, st: Stage, animals: Animal[]) {
    const r = game.r;
    const cx = r.VW / 2, cy = r.VH / 2;
    const bw = 34, bh = 24;
    // nearest animal under the AF box
    let best: Animal | null = null, bd = Infinity;
    for (const a of animals) {
      if (a.dead || a.gone || a.hidden > 0.9) continue;
      const b = a.body?.bounds(a);
      if (!b) continue;
      const x0 = r.projectX(b.x0, a.p), x1 = r.projectX(b.x1, a.p), y0 = r.projectY(b.y0, a.p), y1 = r.projectY(b.y1, a.p);
      if (x1 < cx - bw || x0 > cx + bw || y1 < cy - bh || y0 > cy + bh) continue;
      const d = Math.hypot((x0 + x1) / 2 - cx, (y0 + y1) / 2 - cy);
      if (d < bd) { bd = d; best = a; }
    }
    // foliage in front of the AF point steals focus unless tracking AF holds a locked subject
    let fg: Occluder | null = null;
    let hits = 0;
    const probe: [number, number][] = [[0, 0], [-10, -6], [10, -6], [-10, 6], [10, 6]];
    let occ: Occluder | null = null;
    for (const [ox, oy] of probe) {
      const o = this.covered(cx + ox, cy + oy, best ? best.p : 0.9, best ? best.z : 0);
      if (o) { hits++; occ = o; }
    }
    if (hits >= 3) fg = occ;
    if (fg && perks.afTracking() && best && this.afTarget === best && this.afState === 'locked') fg = null;
    const same = fg ? this.afForeground === fg : this.afTarget === best && !this.afForeground;
    if (!same) {
      this.afTarget = fg ? null : best;
      this.afForeground = fg;
      this.afState = fg || best ? 'hunting' : 'none';
      this.afT = 0;
    }
    if (this.afState === 'hunting') {
      this.afT += dt;
      if (this.afT >= perks.afTime()) { this.afState = 'locked'; audio.play('focus', { vol: 0.45 }); }
    }
    const tgt = fg ? depthOf(fg.p) : best ? depthOf(best.p) : 0.5;
    const wob = this.afState === 'hunting' ? Math.sin(this.afT * 28) * 0.05 : 0;
    this.focus = damp(this.focus, tgt + wob, 10, dt);
    void st;
  }

  // ---------------------------------------------------------------- measuring a shot
  private light(): number {
    const h = this.host;
    const base = h.tod === 'night' ? 0.12 : h.tod === 'dusk' || h.tod === 'dawn' ? 0.7 : 1;
    return clamp(base + this.lamp);
  }
  private shutterTime() {
    const L = this.light();
    return (L > 0.85 ? 0.018 : L > 0.5 ? 0.03 : 0.06) * perks.motion();
  }

  /** Measure one animal as it appears right now. */
  measure(a: Animal): PhotoSubject | null {
    const r = game.r;
    const F = this.frameScreen();
    const fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    const info = a.photoInfo();
    const b = info.box;
    const x0 = r.projectX(b.x0, a.p), x1 = r.projectX(b.x1, a.p), y0 = r.projectY(b.y0, a.p), y1 = r.projectY(b.y1, a.p);
    if (x1 < F.x0 || x0 > F.x1 || y1 < F.y0 || y0 > F.y1) return null;
    let inF = 0, vis = 0;
    for (const [wx, wy] of info.pts) {
      const sx = r.projectX(wx, a.p) + r.view.shakeX * 0, sy = r.projectY(wy, a.p);
      if (sx < F.x0 || sx > F.x1 || sy < F.y0 || sy > F.y1) continue;
      inF++;
      if (!this.covered(sx, sy, a.p, a.z)) vis++;
    }
    const n = Math.max(1, info.pts.length);
    const inFrame = inF / n;
    if (inFrame <= 0.05) return null;
    const visible = inF ? (vis / inF) * (1 - info.hidden * 0.8) : 0;
    // focus: distance from the focal plane; hunting AF is soft
    const df = Math.abs(depthOf(a.p) - this.focus);
    let focus = clamp(1 - df * 12);
    if (this.afTarget === a) focus = this.afState === 'locked' ? Math.max(focus, 0.97) : Math.min(focus, 0.55);
    else if (this.afForeground) focus = Math.min(focus, 0.3);
    // motion relative to the panning camera
    const zoom = r.view.zoom;
    const rvx = (a.vx - this.camVX) * zoom, rvy = (a.vy - this.camVY) * zoom;
    const blurPx = Math.hypot(rvx, rvy) * this.shutterTime() + Math.max(0, info.speed - Math.hypot(a.vx, a.vy)) * zoom * this.shutterTime() * 0.4;
    const motion = clamp(1 - blurPx / 8);
    const shakePx = Math.hypot(this.swayVX, this.swayVY) * this.shutterTime();
    const shake = clamp(1 - shakePx / 5);
    const size = (Math.min(y1, F.y1) - Math.max(y0, F.y0)) / fh;
    const scx = ((x0 + x1) / 2 - F.x0) / fw, scy = ((y0 + y1) / 2 - F.y0) / fh;
    const pts = [[0.5, 0.5], [1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
    const dmin = Math.min(...pts.map(([qx, qy]) => Math.hypot(scx - qx, scy - qy)));
    return {
      species: a.species, behavior: info.behavior,
      bbox: [clamp((x0 - F.x0) / fw), clamp((y0 - F.y0) / fh), clamp((x1 - F.x0) / fw), clamp((y1 - F.y0) / fh)],
      visible: clamp(visible), inFrame: clamp(inFrame), focus, motion, shake, size: clamp(size, 0, 1.2), facing: info.facing,
      centre: clamp(1 - dmin / 0.3), noticed: info.noticed, juvenile: info.juvenile,
      // blur direction for baking
      ...({ _bx: rvx, _by: rvy, _blur: blurPx } as object),
    } as PhotoSubject;
  }

  shoot(animals: Animal[]) {
    if (this.shots <= 0) { audio.play('wrong'); game.ui.toast('Memory card full. Head back to camp and review your shots.', 'CAMERA', 'coral'); this.cooldown = 0.6; return; }
    this.shots--;
    this.shotsTaken++;
    this.cooldown = 0.4;
    this.recoil = 1;
    const subjects: PhotoSubject[] = [];
    for (const a of animals) {
      if (a.dead || a.gone) continue;
      const m = this.measure(a);
      if (m) subjects.push(m);
    }
    // group counts
    for (const s of subjects) s.group = subjects.filter(o => o.species === s.species).length;
    const shakePx = Math.hypot(this.swayVX, this.swayVY) * this.shutterTime();
    const sdx = this.swayVX * this.shutterTime(), sdy = this.swayVY * this.shutterTime();
    const af = this.afForeground ? 'foreground' : this.afTarget?.species ?? null;
    const light = this.light();
    audio.play('shutter');
    // the shutter is noisy: nearby animals notice
    this.host.sounds.push({ x: this.host.player.x, y: this.host.player.y, kind: 'shutter', src: null, species: null, radius: 95, t: this.host.time + 0.0001 });
    game.afterRender = () => {
      const img = this.capture(subjects, shakePx > 0.6 ? [sdx, sdy] : null, light);
      const clean = subjects.map(s => { const c = { ...s } as PhotoSubject & Record<string, unknown>; delete c._bx; delete c._by; delete c._blur; return c as PhotoSubject; });
      const notes: string[] = [];
      if (af === 'foreground') notes.push('AF locked on foliage');
      if (this.holding) notes.push('Held breath');
      const photo = addRawPhoto({ img, site: this.site, time: this.host.tod, day: game.save.day, video: false, light, subjects: clean, af, notes });
      game.r.post.flash = 0.35;
      this.lcd(img);
      this.onShot?.(photo);
    };
  }

  /** Copy the viewfinder frame from the canvas and bake shake/motion blur into it. */
  private capture(subjects: PhotoSubject[], shake: [number, number] | null, light: number, w = 400, h = 225, q = 0.82): string {
    const cv = game.r.canvas;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    const sx = cv.width * FRAME.x0, sy = cv.height * FRAME.y0, sw = cv.width * (FRAME.x1 - FRAME.x0), sh = cv.height * (FRAME.y1 - FRAME.y0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, w, h);
    const k = w / (game.r.VW * (FRAME.x1 - FRAME.x0));
    // subject motion blur
    for (const s of subjects as (PhotoSubject & { _bx: number; _by: number; _blur: number })[]) {
      if (s._blur < 1.2) continue;
      const bx = s.bbox[0] * w - 6, by = s.bbox[1] * h - 6, bw = (s.bbox[2] - s.bbox[0]) * w + 12, bh = (s.bbox[3] - s.bbox[1]) * h + 12;
      const src = document.createElement('canvas');
      src.width = Math.max(1, Math.ceil(bw));
      src.height = Math.max(1, Math.ceil(bh));
      src.getContext('2d')!.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
      const len = Math.min(26, s._blur * k), ang = Math.atan2(s._by, s._bx);
      const steps = 8;
      ctx.globalAlpha = 1 / steps * 1.6;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1) - 0.5;
        ctx.drawImage(src, bx + Math.cos(ang) * len * t, by + Math.sin(ang) * len * t);
      }
      ctx.globalAlpha = 1;
    }
    // whole-frame shake
    if (shake) {
      const src = document.createElement('canvas');
      src.width = w;
      src.height = h;
      src.getContext('2d')!.drawImage(c, 0, 0);
      const len = Math.min(18, Math.hypot(shake[0], shake[1]) * k), ang = Math.atan2(shake[1], shake[0]);
      const steps = 7;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.drawImage(src, 0, 0);
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1) - 0.5;
        ctx.drawImage(src, Math.cos(ang) * len * t, Math.sin(ang) * len * t);
      }
      ctx.globalAlpha = 1;
    }
    // dark shots: crush and add sensor noise
    if (light < 0.4 && !perks.nightClean()) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const gain = 0.45 + light;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 60 * (1 - light);
        d[i] = clamp(d[i] * gain + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] * gain + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] * gain + n * 1.2, 0, 255);
      }
      ctx.putImageData(img, 0, 0);
    }
    return c.toDataURL('image/jpeg', q);
  }

  /** The instant print slides out of the camera and slowly develops; shake it (R, mouse wiggle, click) to speed it up. */
  private lcd(img: string) {
    const l = this.els.lcd;
    l.innerHTML = `<div class="pic"><img src="${img}" alt=""></div><span class="cap">DEVELOPING… shake it! <b>R</b></span><span class="n">${rawPhotos().length} to upload</span>`;
    l.classList.remove('on', 'dry');
    void l.offsetWidth;
    l.classList.add('on');
    l.style.setProperty('--d', '0');
    this.develop = 0;
    this.shakeK = 0;
    audio.play('focus' as never, { vol: 0.35, pitch: 0.6 });
    clearTimeout((l as unknown as { _t: number })._t);
  }

  private updateDevelop(dt: number) {
    if (this.develop >= 1) return;
    const inp = game.input;
    const l = this.els.lcd;
    // shaking: R held, fast mouse wiggles, or a tap on the print
    const mv = Math.hypot(inp.mx - this.lastMx, inp.my - this.lastMy) / Math.max(dt, 1e-3);
    this.lastMx = inp.mx; this.lastMy = inp.my;
    if (inp.keyDown?.('KeyR') || mv > 2400) this.shakeK = Math.min(1, this.shakeK + dt * 4);
    this.shakeK = Math.max(0, this.shakeK - dt * 1.6);
    const rate = (1 / 4.2) * (1 + this.shakeK * 3.5) * (this.host.tod === 'night' ? 0.8 : 1);
    this.develop = Math.min(1, this.develop + rate * dt);
    l.style.setProperty('--d', this.develop.toFixed(3));
    l.style.setProperty('--sh', this.shakeK.toFixed(2));
    if (this.shakeK > 0.2 && Math.random() < dt * 8) audio.play('rustle' as never, { vol: 0.12, pitch: 1.6 });
    if (this.develop >= 1) {
      l.classList.add('dry');
      audio.play('collectPop' as never, { vol: 0.35 });
      (l as unknown as { _t: number })._t = window.setTimeout(() => l.classList.remove('on'), 1600);
    }
  }

  /** tap/click on the print to shake it */
  shakePrint() {
    if (this.develop < 1) this.shakeK = Math.min(1, this.shakeK + 0.45);
  }

  // ---------------------------------------------------------------- video
  startRecording() {
    if (this.shots < 3) { audio.play('wrong'); game.ui.toast('A video clip needs 3 shots of card space.', 'CAMERA', 'coral'); return; }
    this.recording = true;
    this.recT = 0;
    this.recStats.clear();
    this.recThumb = null;
    audio.play('recStart');
  }

  private updateRecording(dt: number, animals: Animal[]) {
    this.recT += dt;
    for (const a of animals) {
      if (a.dead || a.gone) continue;
      const m = this.measure(a);
      if (!m || m.inFrame < 0.4) continue;
      let s = this.recStats.get(a);
      if (!s) { s = { a, t: 0, beh: new Map(), best: null }; this.recStats.set(a, s); }
      s.t += dt;
      if (m.behavior) s.beh.set(m.behavior, (s.beh.get(m.behavior) ?? 0) + dt);
      const q = (x: PhotoSubject) => x.visible * x.focus * x.shake * Math.min(1, x.size * 4);
      if (!s.best || q(m) > q(s.best)) s.best = m;
    }
    if (!this.recThumb && this.recT > 1.2) game.afterRender = () => { this.recThumb = this.capture([], null, this.light()); };
    if (this.recT >= 8) this.stopRecording();
  }

  stopRecording() {
    if (!this.recording) return;
    this.recording = false;
    audio.play('recStop');
    this.shots = Math.max(0, this.shots - 3);
    const subjects: PhotoSubject[] = [];
    for (const s of this.recStats.values()) {
      if (s.t < 1 || !s.best) continue;
      const behs = [...s.beh.entries()].filter(([, t]) => t >= 1).sort((x, y) => y[1] - x[1]);
      // video forgives motion (you see the whole movement)
      const sub = { ...s.best, behavior: behs[0]?.[0] ?? s.best.behavior, motion: Math.max(s.best.motion, 0.85) } as PhotoSubject & Record<string, unknown>;
      delete sub._bx; delete sub._by; delete sub._blur;
      subjects.push(sub as PhotoSubject);
    }
    const img = this.recThumb ?? this.capture([], null, this.light());
    const photo = addRawPhoto({ img, site: this.site, time: this.host.tod, day: game.save.day, video: true, light: this.light(), subjects, af: null, notes: [`Clip ${this.recT.toFixed(1)}s`] });
    this.lcd(img);
    this.onShot?.(photo);
  }

  // ---------------------------------------------------------------- HUD
  private updateUI() {
    const e = this.els;
    const f = e.focus;
    f.className = 'focus ' + (this.afForeground ? 'fg ' : '') + (this.afState === 'locked' ? 'locked' : this.afState === 'hunting' ? 'hunting' : '');
    f.style.left = '50%';
    f.style.top = '50%';
    e.mode.textContent = this.mode === 'photo' ? 'PHOTO' : 'VIDEO';
    e.shots.textContent = `▣ ${this.shots}`;
    const steps = Math.round(((this.zoom - 1.1) / Math.max(0.1, this.zoomMax - 1.1)) * 8);
    e.zoom.innerHTML = `${this.zoom.toFixed(1)}x ` + Array.from({ length: 8 }, (_, i) => `<b class="${i < steps ? 'on' : ''}"></b>`).join('');
    e.af.innerHTML = this.afForeground ? '<span style="color:#ffb35a">AF ● FOLIAGE</span>' : this.afState === 'locked' ? 'AF ● LOCK' : this.afState === 'hunting' ? 'AF ○ …' : 'AF';
    const shakePx = Math.hypot(this.swayVX, this.swayVY) * this.shutterTime();
    const stab = Math.round(clamp(1 - shakePx / 5) * 5);
    e.stab.innerHTML = `STEADY ` + Array.from({ length: 5 }, (_, i) => `<b class="${i < stab ? 'on' : ''}"></b>`).join('');
    const L = this.light();
    e.light.innerHTML = `☀ ` + Array.from({ length: 4 }, (_, i) => `<b class="${i < Math.round(L * 4) ? 'on' : ''}"></b>`).join('');
    e.breathbar.classList.toggle('on', this.holding || this.breath < 0.98);
    (e.breathbar.firstElementChild as HTMLElement).style.width = `${Math.round(this.breath * 100)}%`;
    const t = this.afTarget;
    if (t && !t.dead) {
      const known = game.save.seen[t.species];
      const sp = SPECIES_BY_ID[t.species];
      e.subject.innerHTML = `${known ? sp.name : '<i>Unknown animal</i>'}${t.noticed && t.act === 'flee' ? ' <span style="color:#ff8a6a">(fleeing)</span>' : t.noticed ? ' <span style="color:#ffc86a">(watching you)</span>' : ''}`;
      e.subject.classList.add('on');
    } else e.subject.classList.remove('on');
    this.vf.classList.toggle('recording', this.recording);
    if (this.recording) e.rt.textContent = this.recT.toFixed(1);
  }

  destroy() {
    game.r.post.dof = false;
    game.r.post.ca = 0;
    this.vf.classList.remove('on');
    this.vf.innerHTML = '';
  }
}

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.vf .focus.fg { border-color: #ffb35a !important; box-shadow: 0 0 10px rgba(255, 170, 80, 0.5); }
.vf .info .stab, .vf .info .light { display: flex; gap: 0.3em; align-items: center; }
.vf .info .stab b, .vf .info .light b { display: inline-block; width: 5px; height: 10px; background: rgba(255,255,255,0.22); }
.vf .info .stab b.on { background: var(--teal2); }
.vf .info .light b.on { background: var(--amber2); }
.vf .breathbar { position: absolute; left: 50%; bottom: calc(7% + 1.2em); width: 9em; height: 0.4em; transform: translateX(-50%); background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.2s; }
.vf .breathbar.on { opacity: 1; }
.vf .breathbar i { position: absolute; left: 0; top: 0; bottom: 0; background: #bfe8ff; }
.vf .lcd { position: absolute; left: 6%; bottom: calc(7% + 2.4em); width: 12.5em; padding: 0.55em 0.55em 2.2em; background: #f4f1e6; box-shadow: 0 0 0 3px #1b1a1f, 0 8px 0 rgba(0,0,0,0.4);
  opacity: 0; transform: translateY(140%) rotate(-3deg); transition: opacity 0.2s, transform 0.55s steps(7); font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-size: 0.72em; color: #3b3226; pointer-events: auto; cursor: pointer; }
.vf .lcd.on { opacity: 1; transform: translateY(0) rotate(calc(-3deg + var(--sh, 0) * 8deg * var(--w, 1))); animation: prWiggle 0.12s steps(2) infinite; animation-play-state: paused; }
.vf .lcd.on:not(.dry) { animation-play-state: running; animation-duration: calc(0.5s - var(--sh, 0) * 0.4s); }
@keyframes prWiggle { 50% { --w: -1; margin-left: calc(var(--sh, 0) * 6px); } }
.vf .lcd .pic { background: #111; overflow: hidden; }
.vf .lcd img { width: 100%; display: block; image-rendering: pixelated;
  filter: brightness(calc(0.08 + var(--d, 1) * 0.92)) saturate(calc(var(--d, 1) * 1.1)) sepia(calc((1 - var(--d, 1)) * 0.8)) contrast(calc(0.6 + var(--d, 1) * 0.4)) blur(calc((1 - var(--d, 1)) * 1.5px)); }
.vf .lcd .cap { position: absolute; left: 0.6em; bottom: 0.55em; font-weight: 700; }
.vf .lcd.dry .cap { visibility: hidden; }
.vf .lcd .n { position: absolute; right: 0.6em; bottom: 0.55em; opacity: 0.7; }
.vf .lcd.nag { box-shadow: 0 0 0 3px #d0301e, 0 8px 0 rgba(0,0,0,0.4); }
.vf::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.06; background: repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px); }
`;
  document.head.appendChild(s);
}
