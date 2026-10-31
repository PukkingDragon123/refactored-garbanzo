// V12 timers are watches. Every countdown the player reads (a QTE's time limit, a minigame clock,
// "back before dark", the time of day) is shown as a small brass pocket watch painted as pixel art:
// an engraved brass case with a crown and bow, a domed glass with a pixel glint, a cream dial with
// numerals and minute ticks, blued hands and a sweeping second hand that ticks. Running out, it
// wobbles and shakes and the hands turn red; a dithered red wedge on the dial shows what is left.
// Everything is fillRect on whole pixels (no smoothing, no gradients: light and shade are dithered).
//
//   drawWatch(ctx, x, y, size, t01, opts)   paint one at (x, y) top-left, `size` px across the case
//                                           (t01: countdown fraction left, 1 -> 0; or opts.hour)
//   showWatch({ secs, onEnd, anchor, ... }) a DOM canvas watch over the world (integer scaled), counting
//                                           down `secs` (or driven by set(t01) when manual)
//   watchSize(size)                         the canvas size drawWatch needs for a case of `size`

import { game } from '../../game/game';

export interface WatchOpts {
  /** 'countdown' (t01 = fraction left) or 'clock' (the time of day: opts.hour) */
  mode?: 'countdown' | 'clock';
  /** clock mode: the hour of day shown (14.5 = 2:30) */
  hour?: number;
  /** clock mode: an hour marked in red on the dial (dark) */
  deadline?: number;
  /** total seconds of a countdown (the second hand ticks once a second of it, at least 12 ticks a turn) */
  secs?: number;
  /** 0..1 how hard it shakes (default: from t01 in the last quarter) */
  shake?: number;
  /** clock mode: the sky window under the twelve (default on for cases of 34 px and up) */
  sky?: boolean;
  /** the hands red (default: the last fifth of a countdown) */
  red?: boolean;
  /** seconds, for the shake and the glint (default: performance.now) */
  time?: number;
  /** a wristwatch on a strap (close-ups of Mori's arm) instead of the pocket watch's bow */
  wrist?: boolean;
}

// the palette (brass, dial, blued steel, red)
const BR = ['#3a2408', '#6a4416', '#9a6a22', '#c8962e', '#e8c45a', '#fff0a8'];
const DIAL = ['#f4ead0', '#e2d4b0', '#c8b48a'];
const INK = '#2a1a0c', BLUE = ['#1c2a6a', '#3a52b0'], RED = ['#7a1a10', '#d0402a'], GLASS = '#ffffff';
const STRAP = ['#3a2010', '#5a3418', '#7a4a22'];

/** 4x4 ordered dither */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** tiny 3x5 digits for the dial */
const DIG: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

/** finer 5x7 numerals for big cases */
const DIG7: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

/** the canvas a watch of case `size` needs (the bow / strap and the shake margin included) */
export function watchSize(size: number, wrist = false): { w: number; h: number } {
  const s = Math.max(14, Math.round(size));
  return wrist ? { w: s + 6, h: s + Math.round(s * 0.7) + 6 } : { w: s + 6, h: s + Math.round(s * 0.28) + 6 };
}

/**
 * Paint a watch with its top-left at (x, y). `size` is the case's diameter in pixels (14..96);
 * t01 is the fraction of a countdown left (ignored in clock mode).
 */
export function drawWatch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t01: number, opts: WatchOpts = {}): void {
  const S = Math.max(14, Math.round(size));
  const left = Math.max(0, Math.min(1, t01));
  const clock = opts.mode === 'clock';
  const T = opts.time ?? performance.now() / 1000;
  const shake = opts.shake ?? (clock ? 0 : left < 0.25 ? (0.25 - left) / 0.25 : 0);
  const red = opts.red ?? (!clock && left < 0.2);
  const px = (X: number, Y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(X, Y, 1, 1); };
  const rect = (X: number, Y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(X, Y, w, h); };
  // shaking: whole-pixel jitter, a wobble of the bow
  const jx = shake > 0 ? Math.round(Math.sin(T * 47) * 1.4 * shake + Math.sin(T * 23) * shake) : 0;
  const jy = shake > 0 ? Math.round(Math.cos(T * 39) * 1.1 * shake) : 0;
  const top = opts.wrist ? Math.round(S * 0.35) + 3 : Math.round(S * 0.28) + 3;
  const R = S / 2;
  const cx = Math.round(x + 3 + R) + jx, cy = Math.round(y + top + R) + jy;
  const ox = cx - R, oy = cy - R;
  // ---- the strap (wrist) or the bow and crown (pocket)
  if (opts.wrist) {
    const sw = Math.max(4, Math.round(S * 0.42));
    const len = Math.round(S * 0.35) + 3;
    for (const dir of [-1, 1]) {
      const y0 = dir < 0 ? cy - R - len + 1 : cy + R - 1;
      for (let i = 0; i < len; i++) for (let k = 0; k < sw; k++) {
        const c = k === 0 || k === sw - 1 ? STRAP[0] : (i + k) % 5 === 0 ? STRAP[1] : STRAP[2];
        px(cx - (sw >> 1) + k, y0 + i, c);
      }
      // stitches
      for (let i = 1; i < len; i += 2) { px(cx - (sw >> 1) + 1, y0 + i, STRAP[1]); px(cx + (sw >> 1) - 2 + (sw & 1), y0 + i, STRAP[1]); }
    }
    rect(cx + R - 1, cy - 1, 2, 3, BR[3]);
    px(cx + R, cy - 1, BR[5]);
  } else {
    // crown: a knurled brass knob on a stem, the bow ring above it (it swings a little when shaking)
    const sway = shake > 0 ? Math.round(Math.sin(T * 19) * 1.5 * shake) : 0;
    const cw = Math.max(3, Math.round(S * 0.16)) | 1;
    const ch = Math.max(2, Math.round(S * 0.09));
    const sy = cy - R - ch - 1;
    rect(cx - 1, cy - R - 2, 2, 3, BR[2]);
    for (let i = 0; i < cw; i++) for (let j = 0; j < ch; j++) px(cx - (cw >> 1) + i, sy + j, i === 0 || i === cw - 1 ? BR[1] : i % 2 ? BR[4] : BR[3]);
    rect(cx - (cw >> 1), sy - 1, cw, 1, BR[1]);
    const br = Math.max(3, Math.round(S * 0.13));
    const bcx = cx + sway, bcy = sy - br;
    for (let a = 0; a < 64; a++) {
      const an = (a / 64) * Math.PI * 2;
      const X = Math.round(bcx + Math.cos(an) * br), Y = Math.round(bcy + Math.sin(an) * br * 0.9);
      if (Y > sy - 1) continue;
      px(X, Y, Math.sin(an) < -0.3 && Math.cos(an) < 0.3 ? BR[4] : Math.sin(an) > 0.3 ? BR[1] : BR[3]);
    }
  }
  // ---- the case: brass ring, lit from the top-left, dithered bands, engraved dots
  const th = Math.max(2, Math.round(S / 9));
  const Rd = R - th;
  for (let Y = Math.floor(oy); Y <= Math.ceil(oy + S); Y++) for (let X = Math.floor(ox); X <= Math.ceil(ox + S); X++) {
    const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > R) continue;
    if (d > R - 1) { px(X, Y, BR[0]); continue; }
    if (d > Rd) {
      // the light: top-left bright, bottom-right dark, quantised with the dither
      const l = (-dx - dy) / (R * 1.5) * 0.5 + 0.5 + (d > Rd + th * 0.5 ? 0.12 : -0.05);
      const v = Math.max(0, Math.min(4.99, l * 4 + dith(X, Y) - 0.5));
      let c = BR[1 + Math.floor(v)];
      // engraving: a ring of punched dots and a little scroll every so often
      const an = Math.atan2(dy, dx);
      if (S >= 24 && Math.abs(d - (Rd + th * 0.5)) < 0.6 && Math.round(((an + Math.PI) / (Math.PI * 2)) * 48) % 2 === 0) c = BR[1];
      // big cases: a scroll engraved round the outer half of the band, a bright bead on the inner edge
      if (S >= 40 && d > Rd + th * 0.62 && d < R - 1.4 && Math.sin(an * 34 + (d - Rd) * 2.4) > 0.72) c = BR[1];
      if (S >= 40 && d < Rd + 1.1 && (Math.round(an * 30) & 1)) c = BR[4];
      px(X, Y, c);
      continue;
    }
    // the dial: cream, a shadow under the bezel on the lower right, a few warm specks
    const edge = d > Rd - 1.2 && dx + dy > -R * 0.2;
    // big dials: a guilloche of fine dithered rings round the centre
    const guil = S >= 40 && d < Rd * 0.42 && d > 2.5 && Math.round(d) % 2 === 0 && dith(X, Y) < 0.45;
    px(X, Y, edge ? DIAL[2] : guil || ((dx + dy) / Rd > 0.8 && dith(X, Y) < 0.5) ? DIAL[1] : DIAL[0]);
  }
  // inner bezel line
  for (let a = 0; a < 120; a++) { const an = (a / 120) * Math.PI * 2; px(Math.round(cx - 0.5 + Math.cos(an) * (Rd + 0.2)), Math.round(cy - 0.5 + Math.sin(an) * (Rd + 0.2)), BR[1]); }
  // ---- the red wedge: what is left of the countdown (or the deadline's mark on a clock)
  const ang = (f: number) => f * Math.PI * 2 - Math.PI / 2; // 0 = twelve o'clock, clockwise
  if (!clock && left > 0) {
    const a0 = ang(1 - left), a1 = ang(1);
    for (let Y = Math.floor(cy - Rd); Y <= cy + Rd; Y++) for (let X = Math.floor(cx - Rd); X <= cx + Rd; X++) {
      const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > Rd * 0.72 || d < 1.5) continue;
      let an = Math.atan2(dy, dx);
      if (an < -Math.PI / 2) an += Math.PI * 2;
      if (an >= a0 && an <= a1 && dith(X, Y) < (red ? 0.5 : 0.3)) px(X, Y, red ? '#e88a70' : '#e8c0a0');
    }
  }
  if (clock && opts.deadline !== undefined) {
    const f = ((opts.deadline % 12) + 12) % 12 / 12, a = ang(f);
    for (let r = Rd * 0.55; r < Rd - 1; r += 0.5) px(Math.round(cx - 0.5 + Math.cos(a) * r), Math.round(cy - 0.5 + Math.sin(a) * r), RED[1]);
  }
  // ---- minute ticks and numerals (line weights grow with the case: a watch painted at screen
  // resolution keeps its proportions instead of going to hairlines)
  const m = Math.max(1, Math.round(S / 70));
  const dot = (X: number, Y: number, c: string, size: number) => { const o = Math.floor((size - 1) / 2); rect(X - o, Y - o, size, size, c); };
  const ticks = S >= 30 ? 60 : 12;
  for (let i = 0; i < ticks; i++) {
    const a = ang(i / ticks), hour = ticks === 12 || i % 5 === 0;
    const r0 = Rd - (hour ? Math.max(2, Math.round(S / 14)) : Math.max(1, Math.round(S / 50))) - 0.5, r1 = Rd - 0.8 - m * 0.5;
    for (let r = r0; r <= r1; r += 0.5) dot(Math.round(cx - 0.5 + Math.cos(a) * r), Math.round(cy - 0.5 + Math.sin(a) * r), hour ? INK : '#8a7a5a', hour ? m : Math.max(1, m - 1));
  }
  if (S >= 34) {
    const all = false; // (all twelve crowd the dial; the sub-seconds take six)
    const nums = (all ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [12, 3, 6, 9]).filter(n => n !== 6 || S < 44);
    // big cases use the finer 5x7 numerals
    const big = S >= 76, gw = big ? 5 : 3, gh = big ? 7 : 5, src = big ? DIG7 : DIG;
    for (const n of nums) {
      const a = ang((n % 12) / 12), r = Rd - Math.max(5, Math.round(S / 7)) - 1.5 - (big ? m * 2 : 0);
      const s = String(n), w = (s.length * (gw + 1) - 1) * m;
      const nx = Math.round(cx + Math.cos(a) * r - w / 2), ny = Math.round(cy + Math.sin(a) * r - (gh * m) / 2);
      for (let k = 0; k < s.length; k++) src[s[k]].forEach((row, yy) => { for (let xx = 0; xx < gw; xx++) if (row[xx] === '#') rect(nx + (k * (gw + 1) + xx) * m, ny + yy * m, m, m, INK); });
    }
  }
  // ---- the sky window (clock mode): a domed aperture under the twelve, like a moon-phase watch,
  // showing the island's sky for the hour: dawn pink, day blue, dusk orange, night navy with stars;
  // the sun crosses it by day and a crescent moon by night, over a little hill horizon
  if (clock && S >= 34 && opts.sky !== false) {
    const h = (((opts.hour ?? 12) % 24) + 24) % 24;
    const ww = Rd * 0.5, wh = Rd * 0.32, wcx = cx, wcy = Math.round(cy - Rd * 0.12);
    const night = h < 5 || h >= 20.5, dawn = h >= 5 && h < 7, dusk = h >= 17 && h < 20.5;
    const [top, bot] = night ? ['#0e1640', '#26306a'] : dawn ? ['#4a4a8a', '#f0a070'] : dusk ? ['#4a3a7a', '#f08a4a'] : ['#3a7ec8', '#a8d4f0'];
    const inWin = (X: number, Y: number) => { const dx = (X + 0.5 - wcx) / ww, dy = (Y + 0.5 - wcy) / wh; return dy <= 0 && dx * dx + dy * dy <= 1; };
    for (let Y = Math.floor(wcy - wh) - 1; Y <= wcy + 1; Y++) for (let X = Math.floor(wcx - ww) - 1; X <= wcx + ww + 1; X++) {
      if (inWin(X, Y)) {
        const t = (Y + 0.5 - (wcy - wh)) / wh;
        px(X, Y, dith(X, Y) < t ? bot : top);
      } else if (inWin(X - 1, Y) || inWin(X + 1, Y) || inWin(X, Y + 1) || inWin(X, Y - 1)) px(X, Y, BR[1]); // the brass lip
    }
    // stars at night (a few twinkle)
    if (night || h >= 19.5 || h < 5.5) for (let i = 0; i < 9; i++) {
      const sx = Math.round(wcx - ww * 0.85 + ((i * 37) % 17) / 17 * ww * 1.7), sy = Math.round(wcy - wh * 0.15 - ((i * 23) % 11) / 11 * wh * 0.8);
      if (inWin(sx, sy) && (i % 3 !== 0 || Math.floor(T * 1.5 + i) % 2 === 0)) px(sx, sy, i % 4 === 0 ? '#fff6c0' : '#c8d0ff');
    }
    // the sun by day, the moon by night, riding an arc from the left horizon to the right
    const day = h >= 6 && h < 18, u = day ? (h - 6) / 12 : (((h - 18) + 24) % 24) / 12;
    const bx = wcx - ww * 0.72 + u * ww * 1.44, by = wcy - wh * 0.18 - Math.sin(u * Math.PI) * wh * 0.62;
    const br = Math.max(1.6, wh * 0.3);
    for (let Y = Math.floor(by - br - 1); Y <= by + br + 1; Y++) for (let X = Math.floor(bx - br - 1); X <= bx + br + 1; X++) {
      if (!inWin(X, Y)) continue;
      const d = Math.hypot(X + 0.5 - bx, Y + 0.5 - by);
      if (day) {
        if (d <= br) px(X, Y, X + Y < bx + by - 0.5 ? '#fff4b0' : '#ffc838');
        else if (d <= br + 1 && dith(X, Y) < 0.5) px(X, Y, '#ffe890'); // a dithered glow
      } else if (d <= br && Math.hypot(X + 0.5 - (bx + br * 0.55), Y + 0.5 - (by - br * 0.3)) > br * 0.85) px(X, Y, X + Y < bx + by ? '#fffbe8' : '#e8e0b8'); // a crescent
    }
    // a little island horizon along the bottom of the window
    for (let X = Math.floor(wcx - ww); X <= wcx + ww; X++) {
      const hh = 1 + Math.round(1 + Math.sin((X - wcx) * 0.5) * 0.8 + Math.sin((X - wcx) * 1.3 + 1) * 0.6);
      for (let k = 0; k < hh; k++) if (inWin(X, wcy - k)) px(X, wcy - k, night ? '#14201a' : k === hh - 1 ? '#5a8a3a' : '#2e5426');
    }
  }
  // ---- the hands: tapered blued steel with a lit edge
  const hand = (f: number, len: number, wide: number, col: string[], tail = 0) => {
    const a = ang(f), ca = Math.cos(a), sa = Math.sin(a);
    const w = wide * m;
    for (let r = -tail; r <= len; r += 0.5) {
      const X = Math.round(cx - 0.5 + ca * r), Y = Math.round(cy - 0.5 + sa * r);
      const ww = Math.max(1, Math.round(w * (r < 0 ? 0.8 : 1 - (r / len) * 0.55)));
      dot(X, Y, col[0], ww);
      if (wide > 1 && r < len - 1) dot(X + (Math.abs(sa) > Math.abs(ca) ? Math.ceil(ww / 2) : 0), Y + (Math.abs(sa) > Math.abs(ca) ? 0 : Math.ceil(ww / 2)), col[1], Math.max(1, Math.round(ww / 2)));
    }
  };
  let hF: number, mF: number, sF: number;
  if (clock) {
    const h = opts.hour ?? 12;
    hF = ((h % 12) + 12) % 12 / 12;
    mF = h - Math.floor(h);
    sF = Math.floor((T % 60)) / 60; // a real ticking second hand
  } else {
    const used = 1 - left;
    const n = Math.max(12, Math.round(opts.secs ?? 12));
    sF = Math.floor(used * n) / n; // ticks
    mF = used;
    hF = used / 12;
  }
  const hc = red ? RED : BLUE;
  hand(hF, Rd * 0.48, 2, hc);
  hand(mF, Rd * 0.72, S >= 28 ? 2 : 1, hc);
  if (S >= 44) {
    // a sub-seconds dial at six o'clock: a sunk ring with ticks and its own little hand
    const sr = Math.max(3, Math.round(Rd * 0.24)), scx = cx, scy = Math.round(cy + Rd * 0.5);
    for (let a = 0; a < 96; a++) { const an = (a / 96) * Math.PI * 2; dot(Math.round(scx - 0.5 + Math.cos(an) * sr), Math.round(scy - 0.5 + Math.sin(an) * sr), a % 24 === 0 ? INK : DIAL[2], Math.max(1, m - (a % 24 === 0 ? 0 : 1))); }
    const sa = ang(sF);
    for (let r = 0; r <= sr - 1; r += 0.5) dot(Math.round(scx - 0.5 + Math.cos(sa) * r), Math.round(scy - 0.5 + Math.sin(sa) * r), red ? RED[1] : BLUE[0], Math.max(1, m - 1));
    dot(scx - 1, scy - 1, INK, m + 1);
  } else hand(sF, Rd * 0.86, 1, red ? [RED[1], RED[1]] : [BR[2], BR[2]], Math.max(1, Rd * 0.18));
  rect(cx - m, cy - m, 2 * m, 2 * m, BR[4]);
  rect(cx - m, cy - m, m, m, BR[5]);
  // ---- the domed glass: an arc of glint on the top-left, a spark that comes and goes
  for (let a = 0; a < 20; a++) {
    const an = Math.PI * 1.08 + (a / 20) * Math.PI * 0.32;
    const X = Math.round(cx - 0.5 + Math.cos(an) * (Rd - 2.5)), Y = Math.round(cy - 0.5 + Math.sin(an) * (Rd - 2.5));
    if ((a & 1) === 0 || S >= 30) { ctx.globalAlpha = 0.75; px(X, Y, GLASS); ctx.globalAlpha = 1; }
  }
  const tw = (Math.sin(T * 2.3) + 1) / 2;
  if (tw > 0.6) {
    const gx = Math.round(cx - Rd * 0.42), gy = Math.round(cy - Rd * 0.5);
    px(gx, gy, GLASS);
    if (tw > 0.85) { px(gx - 1, gy, GLASS); px(gx + 1, gy, GLASS); px(gx, gy - 1, GLASS); px(gx, gy + 1, GLASS); }
  }
}

// ---------------------------------------------------------------- the DOM helper
export type WatchAnchor = 'mori' | [number, number] | (() => [number, number] | null);
export interface ShowWatchOpts extends WatchOpts {
  /** seconds to count down (real time; ignored when manual) */
  secs?: number;
  onEnd?: () => void;
  /** where: over Mori, a fixed CSS point, or a function giving CSS coords each frame (the watch's centre) */
  anchor?: WatchAnchor;
  /** the case's size in art pixels (default 30) */
  size?: number;
  /** driven from outside with set(t01) / setHour(h) (no own clock) */
  manual?: boolean;
  /** close on its own after this many seconds (clock mode) */
  hold?: number;
}
export interface WatchHandle { el: HTMLCanvasElement; set(t01: number): void; setHour(h: number): void; close(): void }

let cssOn = false;
function css() {
  if (cssOn) return;
  cssOn = true;
  const st = document.createElement('style');
  st.textContent = `.v12-watch { position: absolute; z-index: 45; pointer-events: none; image-rendering: pixelated; image-rendering: crisp-edges; transform: translate(-50%, -50%); }
.v12-watch.in { animation: v12-watch-in 0.24s steps(4) both; }
.v12-watch.out { animation: v12-watch-out 0.2s steps(3) both; }
@keyframes v12-watch-in { from { transform: translate(-50%, -30%); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }
@keyframes v12-watch-out { from { opacity: 1; } to { transform: translate(-50%, -30%); opacity: 0; } }`;
  document.head.appendChild(st);
}

/** whole-number scale of an art pixel on screen (at least 2) */
function pixelScale(): number {
  const root = game.ui.root;
  const w = root.getBoundingClientRect().width || window.innerWidth;
  return Math.max(2, Math.round(w / Math.max(1, game.r.VW)));
}

function anchorCss(a: WatchAnchor | undefined): [number, number] | null {
  if (Array.isArray(a)) return a;
  if (typeof a === 'function') return a();
  const s = game.scene as unknown as { player?: { x: number; y: number; height: number }; css?: (x: number, y: number) => [number, number] } | null;
  if (!s?.player || !s.css) return [window.innerWidth / 2, window.innerHeight * 0.3];
  const [x, y] = s.css(s.player.x + 26, s.player.y - s.player.height - 18);
  return [x, y];
}

/** a pocket watch over the world: a countdown (secs / onEnd), or a clock (mode 'clock', hour) */
export function showWatch(o: ShowWatchOpts = {}): WatchHandle {
  css();
  const size = Math.round(o.size ?? 30);
  const { w, h } = watchSize(size, o.wrist);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.className = 'v12-watch in';
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  // (on the UI root above the prompt and marker layers, so nothing paints over it)
  game.ui.root.appendChild(cv);
  const scene = game.scene;
  let left = 1, hour = o.hour ?? 12, closed = false, ended = false;
  const t0 = performance.now();
  let lastTick = -1;
  const frame = () => {
    if (closed) return;
    // (the scene changed under it: it goes with the scene)
    if (game.scene !== scene) { close(); return; }
    const now = performance.now(), el = (now - t0) / 1000;
    if (!o.manual && o.secs && o.mode !== 'clock') left = Math.max(0, 1 - el / o.secs);
    // a tick each second of a countdown (and in the last seconds, louder)
    const secLeft = o.secs ? Math.ceil(left * o.secs) : 0;
    if (o.mode !== 'clock' && o.secs && secLeft !== lastTick) {
      if (lastTick >= 0) void import('../../core/audio').then(m => m.audio.play('qteTick' as never, { vol: left < 0.25 ? 0.22 : 0.1, pitch: left < 0.25 ? 1.3 : 0.9 }));
      lastTick = secLeft;
    }
    const k = pixelScale();
    cv.style.width = `${w * k}px`;
    cv.style.height = `${h * k}px`;
    const at = anchorCss(o.anchor);
    if (at) { cv.style.left = `${Math.round(at[0])}px`; cv.style.top = `${Math.round(at[1])}px`; }
    g.clearRect(0, 0, w, h);
    drawWatch(g, 0, 0, size, left, { ...o, hour, time: now / 1000 });
    if (!ended && !o.manual && o.mode !== 'clock' && o.secs && left <= 0) { ended = true; o.onEnd?.(); close(); return; }
    if (o.hold && el >= o.hold) { close(); return; }
    requestAnimationFrame(frame);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    cv.classList.remove('in');
    cv.classList.add('out');
    setTimeout(() => cv.remove(), 220);
  };
  requestAnimationFrame(frame);
  return { el: cv, set: v => { left = Math.max(0, Math.min(1, v)); }, setHour: v => { hour = v; }, close };
}
