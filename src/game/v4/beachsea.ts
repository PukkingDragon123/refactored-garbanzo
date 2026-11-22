// The sea from the beach as one continuous sheet (art in art/island4/seascape.ts): every screen row
// from the horizon to the sand is drawn with its own parallax, so near water slides past faster than
// far water with no strips and no seams. The swell rolls in as a hand-animated loop of frames (crisp
// frame steps, never cross-faded), and the sun (or moon) lays a path of hand-shaped glints that
// widens toward the beach. Cheap: one textured quad per row per tile and ~90 glint sprites.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../world/stage';
import { game } from '../game';
import { local } from '../assets';
import { paintSeaSheet, paintGlints, SEA_HZ, SEA_ROWS, SEA_FRAMES, seaRowP } from '../../art/island4/seascape';
import type { SeaSheet } from '../../art/island4/seascape';
import { hash2, lerp, smoothstep } from '../../core/math';
import { sunAt } from './islefx';
import type { DayClock } from './islefx';

const ZB = 1.25;
/** seconds for the swell to roll in one wavelength (one loop of the frames) */
const CYCLE = 4.8;
/** extra rows drawn past the sheet (repeating its last rows) so the sea never ends above the sand */
const EXTRA = 40;

let sheetCache: SeaSheet | null = null;

/** world y on its own layer of reference screen row sy at parallax p (see island.ts layerY) */
const rowY = (p: number, sy: number) => 180 + (sy - 180) / Math.pow(ZB, p);

function fogAt(p: number) {
  return p < 0.2 ? lerp(0.25, 0.12, (p - 0.06) / 0.14) : p < 0.42 ? lerp(0.12, 0.05, (p - 0.2) / 0.22) : Math.max(0, lerp(0.05, 0, (p - 0.42) / 0.3));
}

export class BeachSea implements Drawable {
  z = -1e8;
  private f: Frame;
  private sheet: SeaSheet;
  private P: Float32Array;
  private Y: Float32Array;
  private src: Int16Array;
  private glint: Frame[];
  /** `home` is the layer this is added to (restored after the per-row passes); `dy` moves the walk line */
  constructor(readonly clock: DayClock, readonly home: Layer, dy = 0) {
    this.sheet = sheetCache ??= paintSeaSheet(7);
    this.f = bigFrame(game.r, this.sheet.buf);
    const n = SEA_ROWS + EXTRA;
    this.P = new Float32Array(n);
    this.Y = new Float32Array(n + 1);
    this.src = new Int16Array(n);
    for (let i = 0; i <= n; i++) {
      const p = seaRowP(SEA_HZ + i);
      if (i < n) {
        this.P[i] = p;
        this.src[i] = i < SEA_ROWS ? i : SEA_ROWS - 8 + ((i - SEA_ROWS) % 8);
      }
      this.Y[i] = rowY(p, SEA_HZ + i) + dy * p;
    }
    this.glint = paintGlints().map((b, i) => local.add('isle:glint' + i, b, Math.floor(b.w / 2), Math.floor(b.h / 2)));
  }

  /** screen y of reference row i right now */
  private sy(r: Renderer, i: number) { return r.projectY(this.Y[i], seaRowP(SEA_HZ + i)); }

  draw(r: Renderer, st: Stage) {
    const v = r.view, VW = r.VW, VH = r.VH;
    const sh = this.sheet;
    const fr = Math.floor(st.time * (SEA_FRAMES / CYCLE)) % SEA_FRAMES;
    const fy = fr * sh.frameH;
    const n = SEA_ROWS + EXTRA;
    let y0 = Math.floor(r.projectY(this.Y[0], this.P[0]));
    for (let i = 0; i < n; i++) {
      const p = this.P[i];
      const y1 = i + 1 < n ? Math.floor(r.projectY(this.Y[i + 1], seaRowP(SEA_HZ + i + 1))) : VH + 2;
      if (y0 > VH) break;
      if (y1 > y0 && y1 > 0) {
        const z = Math.pow(v.zoom, p), zb = Math.pow(ZB, p);
        const k = z / zb;
        const src = this.src[i];
        const wt = sh.rows[src].w;
        r.screen(fogAt(p), 0.4, 0, 1 / (1 + p));
        // tile n starts at layer x n * wt / zb
        const base = VW / 2 + v.shakeX - v.x * p * z;
        const tileW = wt * k;
        let x = base + Math.floor((0 - base) / tileW) * tileW;
        for (; x < VW; x += tileW) r.drawSub(this.f, 0, fy + src, wt, 1, x, y0, k, y1 - y0);
      }
      y0 = Math.max(y0, y1);
    }
    this.drawGlitter(r, st);
    const L = this.home;
    r.layer(L.p, L.fog, L.receive, L.emissive, L.py);
  }

  /** the sun's (or moon's) path of glints: tight near the horizon, spreading toward the beach */
  private drawGlitter(r: Renderer, st: Stage) {
    const c = this.clock;
    const s = sunAt(c.t);
    const night = c.night;
    const k = s.moon ? 0.55 * night : (1 - night) * (0.75 + 0.45 * smoothstep(0.3, 0.8, s.y));
    if (k < 0.05) return;
    const sx = s.x * r.VW;
    const [cr, cg, cb] = s.c;
    r.screen(0, 0, 1, 0.8);
    const t = st.time;
    for (let j = 0; j < 90; j++) {
      const per = 0.7 + hash2(j, 1, 9) * 1.1;
      const ph = t / per + hash2(j, 2, 9);
      const cyc = Math.floor(ph), life = ph - cyc;
      if (life > 0.42) continue;
      // a new spot each time this glint comes round
      const q = Math.pow(hash2(j, cyc, 11), 0.75);
      const row = Math.floor(2 + q * 84);
      const spread = 6 + row * 1.5;
      const dx = (hash2(j, cyc, 12) + hash2(j, cyc, 13) - 1) * spread * 1.4;
      const fall = Math.exp(-((dx / spread) ** 2) * 1.6);
      if (fall < 0.2) continue;
      const y = Math.round(this.sy(r, row));
      if (y < 0 || y > r.VH) continue;
      // size by nearness, popping in and out (biggest in the middle of its life)
      const mid = life > 0.1 && life < 0.32;
      const g = row < 12 ? (mid ? 1 : 0) : row < 34 ? (mid ? 2 : 1) : row < 62 ? (mid ? (j % 3 ? 2 : 3) : 1) : (mid ? (j % 2 ? 4 : 5) : 2);
      r.draw(this.glint[g], Math.round(sx + dx), y, 1, 1, 0, packColor(cr, cg, cb, Math.min(1, fall * k * 1.2)));
    }
  }
}
