// V12 darkroom close-up (developing the day's photos at camp): under the red safelight, the print
// slides into the developer tray and the picture comes up out of the white. Rock the tray (drag left
// and right, or A / D) so it develops evenly; left still it goes blotchy. Lift it out with the tongs
// (tap / Space) when the blacks are black and the whites still clean: too soon it's pale, too late it
// goes muddy. The pocket watch is the darkroom timer. Then it's rinsed and pegged on the line to dry.
// The print is the day's own first photo, brought down to a toned, dithered pixel print.

import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, blit, shadowOval, area, ellipse, line, dot, glow, Z } from './kit';
import { drawHand } from './hands';

export interface DarkOpts { img?: string; world?: [number, number] }

const RED = ramp('#0a0202', '#200606', '#3a0a08', '#5a120c', '#7a1c12', '#a02a18', '#c84a2a', '#e8805a');
const PRINT = ramp('#140808', '#2a1010', '#4a1c16', '#6a3024', '#8a4a36', '#b06a50', '#d8987a', '#f0c8a8');
const PW = 64, PH = 46;

/** the photo as luminance at the print's fine size (or a painted fern scene if there's none) */
function loadLum(src: string | undefined, done: (l: Float32Array) => void) {
  const w = PW * Z, h = PH * Z;
  const fallback = () => {
    const l = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      // a tree fern against a pale sky over dark hills: fronds arching out of the crown
      const dx = u - 0.55, dy = v - 0.3, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const frond = r < 0.36 && Math.abs(Math.sin(a * 4 + r * 3)) > 0.86 - r * 0.6 && dy < 0.25 + r * 0.3;
      const trunk = Math.abs(u - 0.55 - (v - 0.3) * 0.08) < 0.018 && v > 0.3;
      const hill = v > 0.68 + Math.sin(u * 7) * 0.05 + vnoise(u * 6, 0, 2) * 0.06;
      l[y * w + x] = hill ? 0.12 + vnoise(u * 30, v * 30, 1) * 0.12 : frond || trunk ? 0.16 : 0.92 - v * 0.35;
    }
    done(l);
  };
  if (!src) { fallback(); return; }
  const im = new Image();
  im.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      // cover-crop into the print
      const k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
      g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      const d = g.getImageData(0, 0, w, h).data;
      const l = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) l[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      done(l);
    } catch { fallback(); }
  };
  im.onerror = fallback;
  im.src = src;
}

export class DarkSet implements SetScene {
  intro = { text: 'DEVELOPING...', style: 'whisper' as const };
  canAbort = true;
  bg!: PixelBuffer;
  lum: Float32Array | null = null;
  // the print: sliding in, developing, lifted, rinsed, hung
  stage: 'in' | 'dev' | 'lift' | 'hang' = 'in';
  st = 0; L = 0; uneven = 0; rock = 0; tilt = 0; lastDir = 0; still = 0;
  tx = 0; ty = 0; t = 0;
  tray = { x: 120, y: 120 };
  constructor(readonly o: DarkOpts) { }

  layout(c: Closeup) {
    if (!this.lum) loadLum(this.o.img, l => { this.lum = l; });
    this.tray = { x: c.W * 0.42, y: c.H * 0.64 };
    this.tx = this.tray.x + 50; this.ty = this.tray.y - 30;
    const W = c.W, H = c.H;
    const bg = new PixelBuffer(W * Z, H * Z);
    this.bg = bg;
    const lx = W * 0.42, ly = 18;
    // the darkroom: a plank wall, a bench, all in the safelight's red, darker away from the bulb
    area(bg, 0, 0, W, H, (u, v, x, y) => {
      const d = Math.hypot(u - lx, (v - ly) * 1.3) / (W * 0.75);
      const fall = clamp01(1 - d) * 0.8;
      if (v < H * 0.5) {
        const plank = (u + Math.floor(v / 22) * 7) % 26;
        let k = 0.12 + fall * 0.5 + (vnoise(u * 0.1, v * 1.4, 2) - 0.5) * 0.1;
        if (plank < 0.7) k -= 0.12;
        return rd(RED, k, x, y);
      }
      // the bench top: worn planks running across, a dark front edge
      if (v > H - 10) return rd(RED, 0.05 + fall * 0.15, x, y);
      const g = Math.sin(v * 1.6 + vnoise(u * 0.04, v * 0.2, 3) * 4);
      return rd(RED, 0.18 + fall * 0.55 + (g > 0.85 ? -0.12 : 0) + (vnoise(u * 0.3, v * 0.3, 4) - 0.5) * 0.1, x, y);
    });
    // the bulb's halo on the wall (three dithered rings), the cord, the bulb
    glow(bg, lx, ly, 70, 0.9, hex('#ff5a3a'));
    line(bg, lx, 0, lx, ly - 6, hex('#1a0606'), Math.max(2, Math.round(Z * 0.7)));
    ellipse(bg, lx, ly, 6, 7, (nx, ny, _u, _v, x, y) => rd(ramp('#a01808', '#e83a1a', '#ff8a5a', '#ffd0b0'), 0.75 - (nx * nx + ny * ny) * 0.5 - ny * 0.2, x, y));
    area(bg, lx - 3, ly - 9, lx + 3, ly - 5, (_u, v, x, y) => rd(ramp('#2a0a06', '#5a1a10', '#8a3a2a'), 0.6 - (v - ly + 9) * 0.1, x, y));
    // the drying line along the top, and the two other trays (stop, fixer) to the right
    line(bg, 0, 34, W, 30, hex('#5a2a1a'), Math.max(1, Math.round(Z * 0.5)));
    for (let i = 0; i < 2; i++) this.trayAt(bg, this.tray.x + 80 + i * 56, this.tray.y + 6, 0.6, 0, true);
  }
  /** an enamel tray (units centre), with liquid; rock tilts it */
  private trayAt(px: PixelBuffer, cx: number, cy: number, liquid: number, tilt: number, small = false) {
    const w = small ? 44 : 78, h = small ? 18 : 30;
    shadowOval(px, cx + 3, cy + h / 2 + 2, w / 2 + 3, 4, 0.7);
    // the rim and the inside, enamel white gone pink under the light
    area(px, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2 + 3, (u, v, x, y) => {
      const lu = (u - cx) / (w / 2), lv = (v - cy - tilt * lu * 1.5) / (h / 2);
      if (Math.abs(lu) > 1 || lv < -1 || lv > 1.2) return -1;
      const cr = Math.max(0, Math.abs(lu) - 0.9) / 0.1, cv = Math.max(0, Math.abs(lv) - 0.85) / 0.15;
      if (cr * cr + cv * cv > 1) return -1;
      if (lv > 1) return rd(RED, 0.3 - (lv - 1) * 0.5, x, y);
      const rim = Math.abs(lu) > 0.94 || Math.abs(lv) > 0.86;
      if (rim) return rd(RED, 0.75 - lv * 0.2, x, y);
      // the liquid: dark, with ripples that catch the safelight
      const rip = Math.sin(u * 0.9 + v * 0.3 + this.t * 3 + tilt * 6) * Math.sin(v * 1.7 - this.t * 2);
      return rd(RED, 0.18 + liquid * 0.15 + (rip > 0.75 ? 0.25 : 0) - lv * 0.05, x, y);
    });
  }

  update(c: Closeup, dt: number) {
    this.t += dt;
    this.st += dt;
    // rocking: the pointer moving left-right over the tray (or A / D)
    const k = c.axis()[0];
    let dir = 0;
    if (c.ptr.down && Math.abs(c.ptr.vx) > 25) dir = Math.sign(c.ptr.vx);
    else if (k) dir = k;
    if (dir && dir !== this.lastDir) { this.rock = Math.min(1, this.rock + 0.35); this.lastDir = dir; c.sfx('trickle', { vol: 0.15, pitch: 1.2 + Math.random() * 0.3 }); }
    this.rock = Math.max(0, this.rock - dt * 0.6);
    this.tilt = lerp(this.tilt, dir * 0.12 * (0.5 + this.rock), dt * 8);
    if (this.stage === 'in') { if (this.st > 0.9) { this.stage = 'dev'; this.st = 0; c.sfx('splash', { vol: 0.25, pitch: 1.6 }); } return; }
    if (this.stage === 'dev') {
      // it develops on its own; still water develops it unevenly
      this.L += dt / 7;
      if (this.rock < 0.2) this.uneven = Math.min(1, this.uneven + dt * 0.09); else this.uneven = Math.max(0, this.uneven - dt * 0.03);
      if (this.rock < 0.15) { this.still += dt; if (this.still > 2.2) { c.say('Rock the tray, or it goes blotchy!', c.W / 2, 50, { style: 'scared', ms: 1600 }); this.still = -2; } }
      else this.still = 0;
      c.watch = { t01: 1 - clamp01(this.L), x: c.W - 24, y: 26, size: 28, secs: 7 };
      // the tongs follow the pointer
      this.tx = lerp(this.tx, c.ptr.x, 1 - Math.exp(-dt * 14)); this.ty = lerp(this.ty, c.ptr.y, 1 - Math.exp(-dt * 14));
      if (c.act() || c.hit('KeyE')) { this.stage = 'lift'; this.st = 0; c.sfx('splash', { vol: 0.3, pitch: 1.3 }); c.parts.burst('drop', this.tray.x, this.tray.y - 6, 12, 50, { c: '#e8805a', g: 260, life: 0.6 }); }
      else if (this.L > 1.45) { this.stage = 'lift'; this.st = 0; }
      return;
    }
    if (this.stage === 'lift') { if (this.st > 1.1) { this.stage = 'hang'; this.st = 0; c.sfx('pinPush', { vol: 0.4 }); } return; }
    if (this.stage === 'hang' && this.st > 0.9) this.end(c);
  }
  private end(c: Closeup) {
    const L = this.L, U = this.uneven;
    const off = Math.abs(L - 0.885);
    const grade = off < 0.07 && U < 0.3 ? 'perfect' : L >= 0.74 && L <= 1.05 && U < 0.65 ? 'good' : L >= 0.6 && L <= 1.2 ? 'rough' : 'fail';
    c.finish(grade, clamp01(1 - off * 2.5 - U * 0.3), { word: grade === 'fail' ? (L < 0.6 ? 'TOO PALE' : 'TOO DARK') : undefined });
  }
  trophy() {
    const b = new PixelBuffer(PW * Z + 6 * Z, PH * Z + 6 * Z);
    this.paintPrint(b, 3, 3, 0);
    return { img: b, name: 'The print', sub: this.uneven > 0.5 ? 'A BIT BLOTCHY' : this.L > 1.05 ? 'DARK AND MOODY' : this.L < 0.74 ? 'GHOSTLY' : 'SHARP AND CLEAN' };
  }
  /** the print at unit (x, y) top-left: paper white coming down to the picture as it develops */
  private paintPrint(px: PixelBuffer, x: number, y: number, under: number) {
    const lum = this.lum, w = PW * Z, L = this.L;
    area(px, x - 1.5, y - 1.5, x + PW + 1.5, y + PH + 1.5, (u, v, fx, fy) => {
      const lx = Math.floor((u - x) * Z), ly = Math.floor((v - y) * Z);
      if (lx < 0 || ly < 0 || lx >= w || ly >= PH * Z) return rd(PRINT, 0.9 - under * 0.3, fx, fy);
      const l = lum ? lum[ly * w + lx] : 0.6;
      // blotches where the developer sat still
      const local = L * (1 + this.uneven * (vnoise(u * 0.12, v * 0.12, 9) - 0.5) * 0.9);
      let val = lerp(1, l, clamp01(local));
      if (local > 1) val *= 1 - (local - 1) * 1.6;
      val = clamp01(val - under * 0.25);
      return rd(PRINT, val, fx, fy);
    });
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const tr = this.tray, t = this.t;
    this.trayAt(px, tr.x, tr.y, 1, this.tilt);
    const px0 = tr.x - PW / 2, py0 = tr.y - PH / 2 - 2;
    if (this.stage === 'in') {
      // the paper slides in from the left and settles under the liquid
      const k = clamp01(this.st / 0.9);
      this.paintPrint(px, lerp(px0 - 120, px0, k), py0 - Math.sin(k * Math.PI) * 10, 0);
    } else if (this.stage === 'dev') {
      const sway = this.tilt * 10;
      this.paintPrint(px, px0 + sway, py0, 0.25);
      // the liquid over it: ripples drawn as faint highlights, a meniscus at the paper's edge
      area(px, px0 + sway, py0, px0 + sway + PW, py0 + PH, (u, v, fx, fy) => (Math.sin(u * 0.8 + v * 0.25 + t * 3 + this.tilt * 8) * Math.sin(v * 1.5 - t * 2) > 0.86 && dith(fx, fy) < 0.5 ? hex('#e8805a') : -1));
      // the tongs waiting in Mori's hand
      tongs(px, this.tx, this.ty, false);
      drawHand(px, 'grip', this.tx + 2, this.ty + 18, { rot: 3, from: [this.tx + 60, c.H + 40] });
      c.prompt(px, this.L < 0.5 ? 'ROCK THE TRAY' : 'LIFT IT OUT... NOW?', c.W / 2, 16 + 34, this.L < 0.5 ? 'mouse' : 'SPACE');
    } else if (this.stage === 'lift') {
      // up out of the tray, dripping, over to the line
      const k = clamp01(this.st / 1.1);
      const x = lerp(px0, c.W * 0.2, k), y = lerp(py0, 36, k) - Math.sin(k * Math.PI) * 14;
      this.paintPrint(px, x, y, 0);
      if (Math.random() < 0.6) c.parts.add('drop', x + Math.random() * PW, y + PH, 0, 20, { c: '#e8805a', g: 300, life: 0.5 });
      tongs(px, x + PW / 2, y - 2, true);
      drawHand(px, 'grip', x + PW / 2 + 2, y + 14, { rot: 3, from: [x + PW / 2 + 60, c.H + 40] });
    } else {
      // pegged on the line to dry
      const x = c.W * 0.2, y = 36 + Math.sin(this.st * 6) * Math.max(0, 1 - this.st) * 2;
      this.paintPrint(px, x, y, 0);
      for (const pxx of [x + 6, x + PW - 6]) area(px, pxx - 1.5, y - 5, pxx + 1.5, y + 3, (u, v, fx, fy) => rd(ramp('#3a1008', '#7a3a24', '#b06a4a'), 0.6 - (u - pxx) * 0.2, fx, fy));
    }
    void hash; void dot; void mix; void clamp; void blit;
  }
}
/** darkroom tongs (bamboo, rubber tips), units */
function tongs(px: PixelBuffer, x: number, y: number, closed: boolean) {
  const gap = closed ? 0.8 : 2.4;
  for (const s of [-1, 1]) line(px, x + s * gap, y, x + s * 1.2, y + 18, (_t, fx, fy, sd) => rd(ramp('#2a0a06', '#6a2a14', '#a05a30', '#d08a5a'), 0.6 - sd * 0.4, fx, fy), Math.max(2, Math.round(Z * 0.9)));
  for (const s of [-1, 1]) dot(px, x + s * gap, y, hex('#1a0606'), Math.max(1, Math.round(Z * 0.7)));
}

/** develop a print; resolves with ok / score / perfect */
export function runDarkroom(o: DarkOpts): Promise<CloseupResult> { return runCloseup(new DarkSet(o), { world: o.world, noPush: true }); }
