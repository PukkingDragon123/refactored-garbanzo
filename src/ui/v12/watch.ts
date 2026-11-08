// V12 timers are watches (user, latest: "real modern watch, cool, interactive, show stamina"). Every
// clock and countdown the player reads (the time of day on the HUD, "back before dark", a QTE's time
// limit, a close-up's clock) is Mori's field watch, painted as pixel art: a chunky composite case with
// faceted shoulders, four knurled pushers (the LIGHT one ringed orange), a brushed steel bezel with the
// compass on it, rugged vented strap ends, and a colour display behind flat sapphire glass:
//   time    the time in big pixel digits, the day, the sun's arc to dusk and dark
//   body    stamina in big digits, the heart (beating at its rate), hunger in five pips
//   sun     how long until dark; LATE when it is
//   timer   (countdowns) the seconds left in big digits
// and round the edge of every face the segmented ring: stamina (the pips hunger has locked are hatched
// out), or for a timer, the time left. It glows in the dark (the backlight), buzzes when stamina runs
// out, and when a countdown runs out it shakes and goes red. Everything is fillRect on whole pixels.
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
  /** V12 field watch: the face shown in clock mode (default 'time') */
  face?: WatchFace;
  /** stamina 0..1 (the ring); left out, a clock's ring shows the daylight left */
  stamina?: number;
  /** the cap hunger puts on stamina (the pips above it are hatched out) */
  staminaMax?: number;
  /** winded: the ring blinks red */
  winded?: boolean;
  /** beats a minute (the body face) */
  bpm?: number;
  /** hunger 0..1 (the body face's five pips) */
  hunger?: number;
  /** the expedition day (the time face) */
  day?: number;
  /** the backlight on (it also comes on by itself after dark) */
  light?: boolean;
  /** a pusher held in */
  press?: 'light' | 'mode' | 'start' | 'back' | null;
  /** 0..1 a buzz (the whole watch jitters a pixel) */
  buzz?: number;
}
export type WatchFace = 'time' | 'body' | 'sun';

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

/** the canvas a watch of case `size` needs (the strap ends, the pushers and the shake margin included) */
export function watchSize(size: number, wrist = false): { w: number; h: number } {
  const s = Math.max(14, Math.round(size));
  return { w: s + 2 * pusherOut(s) + 6, h: s + 2 * strapLen(s, wrist) + 6 };
}
const pusherOut = (s: number) => Math.max(1, Math.round(s * 0.07));
const strapLen = (s: number, wrist: boolean) => Math.round(s * (wrist ? 0.5 : 0.2));

/** the old brass pocket watch (kept, unused: V12 timers and the clock are the field watch below) */
export function drawPocketWatch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t01: number, opts: WatchOpts = {}): void {
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

// ---------------------------------------------------------------- the field watch
const CASE = ['#0b0e11', '#151a1f', '#1f262c', '#2b343b', '#3b4650', '#52606b', '#6e7d88'];
const STEEL = ['#23272c', '#3c434a', '#5d666e', '#858e95', '#adb5ba', '#d6dcdf', '#f2f5f6'];
const STRAPC = ['#0f1214', '#181d20', '#22292d', '#2e373c', '#3d484e'];
const ORANGE = ['#7a2a06', '#d4560e', '#ff8a2a', '#ffc27a'];
const SCR = { bg: '#0a1215', bgLit: '#0c2a2e', grid: '#0f1b1f', gridLit: '#12383c', dim: '#6f9c98', dimLit: '#8fd8d0', ink: '#e8f6f0', inkLit: '#f4fffb' };
const RING = { off: '#1a2529', offLit: '#1e3a3c', lock: '#3a2416', lockHatch: '#6a3a1a', g: ['#1e8a4c', '#4ae08a'], a: ['#b87a10', '#ffcc3a'], r: ['#a01e10', '#ff5a3a'], t: ['#2a8ad0', '#7ad0ff'] };

/** a few letters in a tiny 3x5 face for the display's labels (what the watch needs, nothing more) */
const TINY: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', W: '101101111111101', Y: '101101010010010', '%': '101001010100101', ':': '000010000010000', '!': '010010010000010',
  '-': '000000111000000', ' ': '000000000000000', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111',
};

/**
 * Paint Mori's field watch with its top-left at (x, y). `size` is the case's diameter in pixels (14..96);
 * t01 is the fraction of a countdown left (ignored in clock mode).
 */
export function drawWatch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t01: number, opts: WatchOpts = {}): void {
  const S = Math.max(14, Math.round(size));
  const left = Math.max(0, Math.min(1, t01));
  const clock = opts.mode === 'clock';
  const T = opts.time ?? performance.now() / 1000;
  const shake = Math.max(opts.shake ?? (clock ? 0 : left < 0.25 ? (0.25 - left) / 0.25 : 0), opts.buzz ?? 0);
  const red = opts.red ?? (!clock && left < 0.2);
  const hour = (((opts.hour ?? 12) % 24) + 24) % 24;
  const lit = !!opts.light || (clock && (hour >= 19.5 || hour < 5.6));
  // (whole pixels only: a fractional fillRect would smear)
  const px = (X: number, Y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), 1, 1); };
  const rect = (X: number, Y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); };
  const jx = shake > 0 ? Math.round(Math.sin(T * 47) * 1.3 * shake + Math.sin(T * 23) * 0.6 * shake) : 0;
  const jy = shake > 0 ? Math.round(Math.cos(T * 39) * 0.9 * shake) : 0;
  const po = pusherOut(S), sl = strapLen(S, !!opts.wrist);
  const R = S / 2;
  const cx = Math.round(x + 3 + po + R) + jx, cy = Math.round(y + 3 + sl + R) + jy;
  const m = Math.max(1, Math.round(S / 64));
  const d01 = (X: number, Y: number) => dith(X, Y);

  // ---- the strap ends: vented rubber, a keeper loop on the bottom one
  const sw = Math.round(S * 0.56) | 0;
  for (const dir of [-1, 1]) {
    const y0 = dir < 0 ? cy - R - sl + 1 : cy + R - 2;
    for (let i = 0; i < sl + 1; i++) {
      const taper = Math.round(Math.max(0, (dir < 0 ? sl - i : i) - sl * 0.6) * 0.25);
      for (let k = taper; k < sw - taper; k++) {
        const X = cx - (sw >> 1) + k, Y = y0 + i;
        const edge = k === taper || k === sw - 1 - taper;
        let c = edge ? STRAPC[0] : STRAPC[2 + (k < sw * 0.35 ? 1 : 0) - (k > sw * 0.75 ? 1 : 0)];
        // vent slots across the strap
        if (!edge && (i % 4 === 2) && k > taper + 1 && k < sw - taper - 2) c = STRAPC[0];
        if (!edge && (i % 4 === 1) && k > taper + 1 && k < sw - taper - 2 && k < sw * 0.4) c = STRAPC[3];
        px(X, Y, c);
      }
    }
    // the keeper loop on the lower end
    if (dir > 0 && sl >= 6) { const ky = cy + R + Math.round(sl * 0.55); rect(cx - (sw >> 1) - 1, ky, sw + 2, Math.max(2, m + 1), STRAPC[3]); rect(cx - (sw >> 1) - 1, ky, sw + 2, 1, STRAPC[4]); }
  }
  // ---- the lugs: chunky shoulders where the strap meets the case, a screw head in each
  for (const dir of [-1, 1]) for (const side of [-1, 1]) {
    const lx = cx + side * (sw >> 1) - (side > 0 ? 2 : 0), ly = cy + dir * (R - 1);
    for (let i = 0; i < Math.max(3, Math.round(S * 0.1)); i++) for (let k = 0; k < 3; k++) px(lx + k - (side > 0 ? 0 : 1), ly + dir * i - (dir < 0 ? 0 : 0), k === 0 ? CASE[side < 0 ? 4 : 1] : CASE[2]);
    if (S >= 30) px(lx + (side > 0 ? 1 : 0), ly + dir * 2, STEEL[4]);
  }
  // ---- the pushers: knurled, two a side; the LIGHT one (upper left) ringed orange; a held one sits in
  const pushers: [string, number, number][] = [['light', -1, -0.42], ['back', -1, 0.42], ['mode', 1, -0.42], ['start', 1, 0.42]];
  for (const [id, side, f] of pushers) {
    const held = opts.press === id;
    const out = held ? Math.max(0, po - 1) : po;
    const ph = Math.max(2, Math.round(S * 0.13)), py0 = Math.round(cy + f * R * 1.35 - ph / 2);
    // the case's edge at the pusher's height (they sit on the faceted shoulders)
    const dyp = (py0 + ph / 2) - cy, ex = Math.sqrt(Math.max(0, R * R * 0.93 - dyp * dyp));
    const px0 = side < 0 ? Math.round(cx - ex) - out : Math.round(cx + ex) - 1;
    for (let i = 0; i < out + 1; i++) for (let j = 0; j < ph; j++) {
      const knurl = j % 2 === 0;
      const c = id === 'light' && i === (side < 0 ? out : 0) ? ORANGE[held ? 1 : 2] : j === 0 ? STEEL[5] : j === ph - 1 ? STEEL[1] : knurl ? STEEL[3] : STEEL[2];
      px(px0 + i, py0 + j, c);
    }
  }
  // ---- the case: faceted shoulders (a 12-sided body) in matte composite, lit from the top left
  const facets = 12;
  const inCase = (dx: number, dy: number) => {
    const a = Math.atan2(dy, dx), seg = Math.PI * 2 / facets;
    const k = Math.cos(((a % seg) + seg) % seg - seg / 2);
    return Math.hypot(dx, dy) * k <= R * Math.cos(seg / 2) + 0.25;
  };
  const Rb = R * 0.86, Rs = R * 0.72;
  for (let Y = Math.floor(cy - R - 1); Y <= Math.ceil(cy + R + 1); Y++) for (let X = Math.floor(cx - R - 1); X <= Math.ceil(cx + R + 1); X++) {
    const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (!inCase(dx, dy)) continue;
    if (!inCase(dx * 1.06, dy * 1.06)) { px(X, Y, CASE[0]); continue; }
    if (d > Rb) {
      // the facet's normal decides its light: facets turned to the top left are lit
      const a = Math.atan2(dy, dx), seg = Math.PI * 2 / facets, fa = Math.floor((a + Math.PI) / seg) * seg - Math.PI + seg / 2;
      const l = 0.5 + (-Math.cos(fa) * 0.55 - Math.sin(fa) * 0.75) * 0.5;
      const v = Math.max(0, Math.min(CASE.length - 1.01, 1 + l * 4 + d01(X, Y) - 0.5));
      let c = CASE[Math.floor(v)];
      // field wear: pale scuffs on the lit shoulders
      if (S >= 28 && dith(X * 3, Y * 5) > 0.93 && l > 0.5) c = CASE[6];
      px(X, Y, c);
      continue;
    }
    if (d > Rs) {
      // the bezel: brushed steel (radial streaks), a bevel lit on the top left, the compass on it
      const an = Math.atan2(dy, dx);
      const l = 0.55 + (-dx - dy) / (Rb * 2.4) + (Math.sin(an * 40) > 0.6 ? 0.08 : 0) + (d > Rb - 1 ? 0.15 : d < Rs + 1 ? -0.25 : 0);
      const v = Math.max(0, Math.min(STEEL.length - 1.01, l * 6 + d01(X, Y) - 0.5));
      px(X, Y, STEEL[Math.floor(v)]);
      continue;
    }
    // the display
    const grid = ((X + Y) & 1) === 0 && d01(X, Y) < 0.15;
    px(X, Y, grid ? (lit ? SCR.gridLit : SCR.grid) : lit ? SCR.bgLit : SCR.bg);
  }
  // the compass on the bezel: N in orange at the top, ticks every 30 degrees
  const bezR = (Rb + Rs) / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2, X = Math.round(cx - 0.5 + Math.cos(a) * bezR), Y = Math.round(cy - 0.5 + Math.sin(a) * bezR);
    if (i % 3 === 0 && S >= 34) continue;
    px(X, Y, i % 3 === 0 ? STEEL[6] : STEEL[1]);
  }
  if (S >= 34) {
    const letters: [string, number, string][] = [['N', -Math.PI / 2, ORANGE[2]], ['E', 0, STEEL[6]], ['S', Math.PI / 2, STEEL[6]], ['W', Math.PI, STEEL[6]]];
    for (const [L, a, c] of letters) tinyText(Math.round(cx + Math.cos(a) * bezR - 1.5), Math.round(cy + Math.sin(a) * bezR - 2.5), L, c, 1);
  }

  // ---- the display's contents
  const ink = lit ? SCR.inkLit : SCR.ink, dim = lit ? SCR.dimLit : SCR.dim;
  // the ring: stamina (hatched where hunger caps it), a timer's time left, or the daylight left
  const seg = S >= 40 ? 24 : S >= 28 ? 16 : 12;
  const span = Math.PI * 1.5, a0r = Math.PI * 0.75; // from bottom-left round the top to bottom-right
  let fill: number, cap = 1, ringC: string[];
  if (!clock) { fill = left; ringC = red ? RING.r : left < 0.4 ? RING.a : RING.t; }
  else if (opts.stamina !== undefined) {
    fill = opts.stamina; cap = opts.staminaMax ?? 1;
    ringC = fill < 0.25 ? RING.r : fill < 0.5 ? RING.a : RING.g;
    if (opts.winded && Math.floor(T * 4) % 2 === 0) ringC = RING.r;
  } else {
    const day0 = 6, day1 = opts.deadline ?? 20.5;
    fill = Math.max(0, Math.min(1, (day1 - hour) / (day1 - day0)));
    ringC = fill < 0.2 ? RING.r : fill < 0.4 ? RING.a : RING.a.map((c, i) => (i ? '#ffd86a' : '#c88a1a'));
  }
  const ro = Rs - 1.2, ri = Math.max(2, Rs - Math.max(2, Math.round(S / 16)) - 1);
  for (let Y = Math.floor(cy - ro - 1); Y <= cy + ro + 1; Y++) for (let X = Math.floor(cx - ro - 1); X <= cx + ro + 1; X++) {
    const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > ro || d < ri) continue;
    let a = Math.atan2(dy, dx) - a0r;
    while (a < 0) a += Math.PI * 2;
    if (a > span) continue;
    const u = a / span, si = Math.floor(u * seg);
    // gaps between the pips
    if ((u * seg - si) > 0.78) continue;
    const on = (si + 0.5) / seg <= fill;
    const locked = (si + 0.5) / seg > cap;
    const outer = d > (ri + ro) / 2;
    px(X, Y, on ? ringC[outer ? 1 : 0] : locked ? (((X + Y) & 1) ? RING.lockHatch : RING.lock) : lit ? RING.offLit : RING.off);
  }

  const face: WatchFace | 'timer' = !clock ? 'timer' : opts.face ?? 'time';
  const big = Rs * 2 >= 26;
  const lab = S >= 40;
  if (face === 'timer') {
    const secs = Math.max(0, Math.ceil(left * (opts.secs ?? 10)));
    const txt = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : String(secs).padStart(2, '0');
    if (lab) tinyText(cx - tinyW('TIMER') / 2, Math.round(cy - Rs * 0.56), 'TIMER', dim, 1);
    bigDigits(txt, cx, cy, red ? RING.r[1] : ink);
  } else if (face === 'time') {
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    const h12 = ((hh + 11) % 12) + 1;
    // the colon blinks with the seconds
    const colon = Math.floor(T) % 2 === 0;
    bigDigits(`${h12}${colon ? ':' : ' '}${String(mm).padStart(2, '0')}`, cx, cy - (lab ? 1 : 0), ink);
    if (lab) {
      const top = opts.day ? `DAY ${opts.day}` : hh < 12 ? 'AM' : 'PM';
      tinyText(cx - tinyW(top) / 2, Math.round(cy - Rs * 0.56), top, dim, 1);
      // the sun's arc: sunrise on the left, dusk (amber) and dark (blue) marked, the sun or moon on it
      sunArc(cx, Math.round(cy + Rs * 0.48), Math.round(Rs * 0.46), hour, opts.deadline);
      if (opts.day) tinyText(cx - 3, Math.round(cy + Rs * 0.55), hh < 12 ? 'AM' : 'PM', dim, 1);
    }
  } else if (face === 'body') {
    const st = Math.round((opts.stamina ?? 1) * 100);
    if (lab) { const lc = opts.winded ? RING.r[1] : dim, lx = cx - Math.round((tinyW('STA') + 4) / 2), ly = Math.round(cy - Rs * 0.56); bolt(lx, ly, lc); tinyText(lx + 4, ly, 'STA', lc, 1); }
    bigDigits(`${st}%`, cx, cy - (lab ? 1 : 0), opts.winded && Math.floor(T * 4) % 2 === 0 ? RING.r[1] : ink);
    if (lab) {
      // the heart (beating at its rate) and the beats a minute, hunger as five pips
      const bpm = Math.round(opts.bpm ?? 70);
      const beat = (T * bpm / 60) % 1 < 0.18;
      const hx = Math.round(cx - Rs * 0.6), hy = Math.round(cy + Rs * 0.36);
      heart(hx, hy, beat);
      tinyText(hx + 7, hy, String(bpm), ink, 1);
      const hu = opts.hunger ?? 0, pips = Math.round((1 - hu) * 5);
      const fx = Math.round(cx + Rs * 0.06), fy = hy + 6 + m;
      for (let i = 0; i < 5; i++) rect(fx + i * 3, fy, 2, 2, i < pips ? (hu > 0.65 ? RING.a[1] : '#9ad86a') : lit ? RING.offLit : RING.off);
      fork(fx - 4, fy - 1);
    }
  } else {
    const dl = opts.deadline ?? 20.5, rest = dl - hour;
    const late = rest <= 0;
    if (lab) tinyText(cx - tinyW(late ? 'HOME!' : 'DARK') / 2, Math.round(cy - Rs * 0.56), late ? 'HOME!' : 'DARK', late ? RING.r[1] : dim, 1);
    if (late) { if (Math.floor(T * 3) % 2 === 0) bigDigits('LATE', cx, cy - 1, RING.r[1]); }
    else { const hh = Math.floor(rest), mm = Math.floor((rest - hh) * 60); bigDigits(`${hh}:${String(mm).padStart(2, '0')}`, cx, cy - 1, rest < 1 ? RING.a[1] : ink); }
    if (lab) sunArc(cx, Math.round(cy + Rs * 0.5), Math.round(Rs * 0.46), hour, opts.deadline);
  }
  // ---- the glass: flat sapphire, a short diagonal glint that drifts across now and then
  const g = ((T * 0.18) % 1.6) - 0.3;
  if (g > 0 && g < 1) {
    const gx = Math.round(cx - Rs * 0.7 + g * Rs * 0.9), gy = Math.round(cy - Rs * 0.62 + g * Rs * 0.3);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < Math.max(2, Math.round(S / 14)); i++) px(gx + i, gy - i, '#ffffff');
    ctx.globalAlpha = 1;
  }
  px(Math.round(cx - Rs * 0.62), Math.round(cy - Rs * 0.35), 'rgba(255,255,255,0.35)');

  // ---- helpers (closures over this watch)
  function tinyW(t: string) { return t.length * 4 - 1; }
  function tinyText(X: number, Y: number, t: string, c: string, k: number) {
    for (let i = 0; i < t.length; i++) {
      const g = TINY[t[i].toUpperCase()] ?? TINY[' '];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') rect(X + (i * 4 + q) * k, Y + r * k, k, k, c);
    }
  }
  function bigDigits(t: string, X: number, Y: number, c: string) {
    // big displays: 5x7 digits (3x5 letters doubled); small ones: 3x5
    const gw = big ? 5 : 3, gh = big ? 7 : 5, gap = 1;
    const wOf = (ch: string) => (ch === ':' || ch === ' ' ? 1 : ch === '%' ? 3 : /[A-Z]/.test(ch) ? 3 : gw);
    let W = 0;
    for (const ch of t) W += wOf(ch) + gap;
    W -= gap;
    let x0 = Math.round(X - W / 2);
    const y0 = Math.round(Y - gh / 2);
    for (const ch of t) {
      if (ch === ':') { rect(x0, y0 + Math.round(gh * 0.25), 1, 1, c); rect(x0, y0 + Math.round(gh * 0.7), 1, 1, c); x0 += 1 + gap; continue; }
      if (ch === ' ') { x0 += 1 + gap; continue; }
      if (/[A-Z%]/.test(ch)) { const g = TINY[ch]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') rect(x0 + q, y0 + r + (gh - 5), 1, 1, c); x0 += 3 + gap; continue; }
      const src = big ? DIG7 : DIG;
      src[ch]?.forEach((row, yy) => { for (let xx = 0; xx < gw; xx++) if (row[xx] === '#') rect(x0 + xx, y0 + yy, 1, 1, c); });
      x0 += gw + gap;
    }
  }
  function sunArc(X: number, Y: number, r: number, h: number, deadline?: number) {
    const t0 = 6, t1 = 21;
    const at = (hh: number): [number, number] => { const u = Math.max(0, Math.min(1, (hh - t0) / (t1 - t0))); const a = Math.PI + u * Math.PI; return [Math.round(X + Math.cos(a) * r), Math.round(Y + Math.sin(a) * r * 0.55)]; };
    for (let i = 0; i <= 30; i++) { const [ax, ay] = at(t0 + (i / 30) * (t1 - t0)); if (i % 2 === 0) px(ax, ay, dim); }
    rect(X - r - 1, Y, r * 2 + 3, 1, dim);
    const [dx0, dy0] = at(17.5); rect(dx0, dy0 - 1, 1, 3, RING.a[1]);
    const [dx1, dy1] = at(deadline ?? 20.5); rect(dx1, dy1 - 1, 1, 3, '#6aa8ff');
    const day = h >= t0 && h <= t1;
    const [sx, sy] = at(day ? h : t1);
    if (day) { rect(sx - 1, sy - 1, 3, 3, '#ffc838'); px(sx - 1, sy - 1, '#fff4b0'); px(sx + 1, sy + 1, '#d08a10'); }
    else { rect(sx - 1, sy - 1, 2, 3, '#e8e0b8'); px(sx + 1, sy - 1, '#e8e0b8'); }
  }
  function heart(X: number, Y: number, beat: boolean) {
    const rows = beat ? ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] : ['.......', '.##.##.', '.#####.', '..###..', '...#...', '.......'];
    rows.forEach((row, yy) => { for (let xx = 0; xx < 7; xx++) if (row[xx] === '#') px(X + xx - 1, Y + yy - 1, (xx + yy) < 4 ? '#ff8a8a' : '#e03a3a'); });
  }
  function bolt(X: number, Y: number, c: string) {
    for (const [dx, dy] of [[2, 0], [1, 1], [0, 2], [1, 2], [2, 2], [1, 3], [0, 4]]) px(X + dx, Y + dy, c);
  }
  function fork(X: number, Y: number) {
    for (let i = 0; i < 4; i++) px(X + 1, Y + i, dim);
    px(X, Y, dim); px(X + 2, Y, dim);
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
