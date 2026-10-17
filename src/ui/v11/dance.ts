// V11 the serpent dance: a call-and-response dance game played in the world (the festival goes on
// round it). The partner calls four steps on the beat (they show on the upper cord and the partner
// dances them), then Mori answers with the same four on the next four beats: ← → ↓ ↑ (or A D S W,
// or tap the arrows). Timing (tino pai / pai / auē), a combo and the crowd's mood, and a world hook
// for every call and every step so the scene can make Mori sway, crouch, rise... or trip over his
// own feet and tread on his partner's toes.
// The strip at the bottom of the screen is pixel art: painted into a small canvas at integer scale,
// text in the Kiri bitmap font.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import type { Music } from '../../core/audio';
import { el } from '../ui';
import { guardInput } from '../../core/input';
import { loop } from '../v4/mini';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';
import { bayer } from '../../core/math';
import { drawPx, pxWidth, pxWrap } from './pxfont';
import { KiriSynth } from './rhythm-audio';
import { SONG_BY_ID } from './rhythm-songs';

export type Dir = 0 | 1 | 2 | 3; // ← ↓ ↑ →
export const DIR_GLYPH = ['←', '↓', '↑', '→'];
export type Judge = 'perfect' | 'good' | 'miss' | 'stray';
export interface DanceHooks {
  /** the partner shows a step (call) */
  call?(d: Dir): void;
  /** Mori's answer (or the miss of one) */
  step?(d: Dir, j: Judge, combo: number): void;
  /** every beat (the crowd claps) */
  beat?(n: number): void;
  /** a line from the partner while dancing (between phrases) */
  phrase?(i: number, ok: number): string | null;
}
export interface DanceOpts {
  mode: 'practice' | 'festival';
  partner: string;
  partnerName?: string;
  /** the music to come back to */
  music?: Music;
  hooks?: DanceHooks;
}
export interface DanceResult { score: number; acc: number; perfect: number; good: number; miss: number; stumbles: number; maxCombo: number; rating: 'graceful' | 'spirited' | 'brave' }

const MOTIFS: Dir[][] = [
  [0, 3, 0, 3], [0, 1, 3, 2], [1, 1, 1, 2], [1, 0, 3, 2], [3, 3, 0, 0], [2, 1, 2, 1],
  [0, 0, 3, 2], [3, 1, 0, 2], [1, 2, 1, 2], [0, 3, 1, 2], [3, 0, 3, 1], [2, 2, 1, 1],
];
const KEYDIR: Record<string, Dir> = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3 };
const AW = 240, AH = 60;
const P = {
  ink: hex('#0c0810'), flax: [hex('#2e2410'), hex('#4e3e1a'), hex('#725c26'), hex('#9a7e36'), hex('#c2a24c'), hex('#ecd690')],
  paper: hex('#f0e2c0'), paper2: hex('#b49c70'), gold: hex('#f8d060'), green: hex('#7ad870'), grey: hex('#8a8090'), red: hex('#e05a3a'), white: hex('#fff8e8'),
  ochre: hex('#9a2a1a'), ochre2: hex('#d45a34'), paua: hex('#5ac8b0'), dark: hex('#1a1018'),
  dir: [hex('#e2563a'), hex('#4cc070'), hex('#f2c040'), hex('#4cc8d8')],
};
const ARROW: string[][] = [
  ['...#....', '..##....', '.#######', '########', '.#######', '..##....', '...#....'],
  ['..###...', '..###...', '..###...', '#######.', '.#####..', '..###...', '...#....'],
  ['...#....', '..###...', '.#####..', '#######.', '..###...', '..###...', '..###...'],
  ['....#...', '....##..', '#######.', '########', '#######.', '....##..', '....#...'],
];

function arrow(b: PixelBuffer, cx: number, cy: number, d: Dir, s: number, col: C, dim = false) {
  const g = ARROW[d];
  const ox = Math.round(cx - 4 * s), oy = Math.round(cy - 3.5 * s);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') for (let a = 0; a < s; a++) for (let c = 0; c < s; c++) b.set(ox + i * s + a + dx, oy + j * s + c + dy, P.ink); });
  g.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') for (let a = 0; a < s; a++) for (let c = 0; c < s; c++) {
    const X = ox + i * s + a, Y = oy + j * s + c;
    const hi = j * s + c < 2 * s;
    if (dim && bayer(X, Y) > 0.55) continue;
    b.set(X, Y, hi ? P.white : col);
  } });
}

export async function runDance(o: DanceOpts): Promise<DanceResult> {
  const fest = o.mode === 'festival';
  const song = SONG_BY_ID[fest ? 'po' : 'awa'];
  const bpm = fest ? 104 : 84, spb = 60 / bpm;
  const phrases = fest ? 8 : 5;
  const synth = new KiriSynth();
  audio.setMusic('none');
  // the steps: four calls, four answers, phrase after phrase (the festival adds doubles later on)
  interface Step { t: number; d: Dir; call: boolean; hit?: Judge; shown?: boolean; dbl?: boolean }
  const steps: Step[] = [];
  const COUNT = 4;
  for (let p = 0; p < phrases; p++) {
    const m = MOTIFS[(p * 5 + (fest ? 3 : 0)) % MOTIFS.length];
    const base = COUNT + p * 8;
    m.forEach((d, i) => {
      const dbl = fest && p >= 4 && i === 3;
      steps.push({ t: (base + i) * spb, d, call: true });
      steps.push({ t: (base + 4 + i) * spb, d, call: false });
      if (dbl) { steps.push({ t: (base + i + 0.5) * spb, d: ((d + 2) % 4) as Dir, call: true, dbl: true }); steps.push({ t: (base + 4 + i + 0.5) * spb, d: ((d + 2) % 4) as Dir, call: false, dbl: true }); }
    });
  }
  steps.sort((a, b) => a.t - b.t);
  const total = (COUNT + phrases * 8 + 1) * spb;
  const melody = song.bars.join('');

  // ---------------------------------------------------------------- the strip
  const wrap = el('div', 'dance11');
  const cv = el('canvas') as HTMLCanvasElement;
  cv.width = AW; cv.height = AH;
  wrap.appendChild(cv);
  const fit = () => {
    const s = Math.max(2, Math.min(5, Math.floor(Math.min(window.innerWidth * 0.72 / AW, window.innerHeight * 0.3 / AH))));
    const w = AW * s, h = AH * s;
    Object.assign(cv.style, { width: w + 'px', height: h + 'px', imageRendering: 'pixelated', display: 'block' });
    Object.assign(wrap.style, { position: 'absolute', left: Math.round((window.innerWidth - w) / 2) + 'px', top: Math.round(window.innerHeight - h - Math.max(96, window.innerHeight * 0.14)) + 'px', zIndex: '33', pointerEvents: 'auto', touchAction: 'none' });
  };
  fit();
  window.addEventListener('resize', fit);
  game.ui.modalLayer.appendChild(wrap);
  const g2 = cv.getContext('2d')!;
  const b = new PixelBuffer(AW, AH);
  const img = new ImageData(AW, AH);

  // ---------------------------------------------------------------- state
  const RING = 34, SPEED = 52, ROW_A = 18, ROW_B = 40;
  let t0 = 0, useAudio = false, perfStart = 0;
  const a0 = synth.now();
  useAudio = a0 !== null;
  if (useAudio) t0 = (a0 as number) + 0.3; else perfStart = performance.now() + 300;
  const now = () => (useAudio ? (synth.now() ?? 0) - t0 : (performance.now() - perfStart) / 1000);
  let score = 0, combo = 0, maxCombo = 0, perfect = 0, good = 0, miss = 0, stumbles = 0, mood = 0.5;
  let lastStep = -999, ringHot = 0, ringBad = 0, lastBeat = -1;
  const pops: { s: string; t: number; c: C }[] = [];
  let line: { s: string; t: number } | null = null;
  let done = false;
  const W8 = { perf: 0.07, good: 0.15 };
  synth.droneOn(song.root);

  const press = (d: Dir) => {
    const tt = now();
    let best: Step | null = null;
    for (const s of steps) { if (s.call || s.hit) continue; const dd = Math.abs(s.t - tt); if (dd <= W8.good && (!best || dd < Math.abs(best.t - tt))) best = s; if (s.t > tt + W8.good) break; }
    if (!best) { ringBad = 0.5; return; }
    if (best.d !== d) {
      // the wrong foot: he goes the wrong way and treads on his partner
      best.hit = 'miss'; miss++; stumbles++; combo = 0; mood = Math.max(0, mood - 0.08); ringBad = 1;
      pops.push({ s: 'AUĒ!', t: 0, c: P.red });
      o.hooks?.step?.(d, 'stray', 0);
      return;
    }
    const dd = Math.abs(best.t - tt);
    best.hit = dd <= W8.perf ? 'perfect' : 'good';
    combo++; maxCombo = Math.max(maxCombo, combo);
    const mult = 1 + Math.min(3, Math.floor(combo / 8));
    if (best.hit === 'perfect') { perfect++; score += 100 * mult; mood = Math.min(1, mood + 0.05); pops.push({ s: 'TINO PAI!', t: 0, c: P.gold }); }
    else { good++; score += 50 * mult; mood = Math.min(1, mood + 0.025); pops.push({ s: 'PAI', t: 0, c: P.green }); }
    ringHot = 1;
    synth.thump(synth.now() ?? 0, 0.3, 100);
    o.hooks?.step?.(d, best.hit, combo);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const d = KEYDIR[e.code];
    if (d !== undefined) { press(d); e.preventDefault(); e.stopPropagation(); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); }
  };
  const onPD = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * AW, y = ((e.clientY - r.top) / r.height) * AH;
    // tap zones: the four arrow buttons drawn on the right
    for (let i = 0; i < 4; i++) { const bx = 158 + i * 20; if (x >= bx - 9 && x <= bx + 9 && y >= 44) { press(i as Dir); return; } }
    void y;
  };
  window.addEventListener('keydown', onKey, true);
  cv.addEventListener('pointerdown', onPD);

  const draw = (tt: number, dt: number) => {
    // the band: a woven flax strip, a tāniko border, the two cords
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const edge = y < 3 || y > AH - 4;
      let c: C;
      if (edge) { const k = Math.floor((x + (y < 3 ? 0 : 2)) / 3) % 3; c = k === 0 ? P.ink : k === 1 ? P.ochre : P.paper; }
      else { const w = ((Math.floor(x / 3) + Math.floor(y / 3)) & 1) ? (x % 3 ? 3 : 2) : (y % 3 ? 2 : 1); c = P.flax[w]; }
      b.set(x, y, c);
    }
    for (const yy of [ROW_A, ROW_B]) for (let x = 6; x < AW - 6; x++) { b.set(x, yy, P.flax[5]); b.set(x, yy + 1, P.flax[1]); }
    // the partner's tag on the upper cord, Mori's on the lower one
    const pn = (o.partnerName ?? o.partner).toUpperCase();
    b.rect(3, ROW_A - 6, pxWidth(pn) + 5, 9, P.ink); drawPx(b, pn, 5, ROW_A - 5, P.paua);
    b.rect(3, ROW_B - 6, pxWidth('MORI') + 5, 9, P.ink); drawPx(b, 'MORI', 5, ROW_B - 5, P.gold);
    // the hit ring: a carved pāua ring on Mori's cord
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, y);
      if (d > 9 || d < 6) continue;
      b.set(RING + x, ROW_B + y, d > 8.2 ? P.ink : ringBad > 0.3 ? P.red : ringHot > 0.3 ? P.gold : (Math.sin(x + y + tt * 3) > 0 ? P.paua : hex('#2a6a7a')));
    }
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (Math.hypot(x, y) < 6 && Math.hypot(x, y) > 4.5) b.set(RING + x, ROW_A + y, P.paper2);
    ringHot = Math.max(0, ringHot - dt * 4); ringBad = Math.max(0, ringBad - dt * 3);
    // the beat ticks along the cords
    for (let k = Math.floor(tt / spb); k * spb < tt + (AW - RING) / SPEED; k++) {
      const x = Math.round(RING + (k * spb - tt) * SPEED);
      if (x < RING - 2 || x >= AW - 4) continue;
      const phrase = Math.floor((k - COUNT) / 4);
      const calling = k >= COUNT && phrase % 2 === 0;
      b.set(x, ROW_A - 2, calling ? P.paper : P.flax[2]); b.set(x, ROW_B - 2, !calling && k >= COUNT ? P.paper : P.flax[2]);
    }
    // the steps
    for (const s of steps) {
      const x = RING + (s.t - tt) * SPEED;
      if (x > AW + 10) break;
      if (x < -10) continue;
      const row = s.call ? ROW_A : ROW_B;
      if (s.call) { if (x < RING - 4) continue; arrow(b, x, row, s.d, 1, P.dir[s.d], x > RING + 70); continue; }
      if (s.hit && s.hit !== 'miss') continue;
      arrow(b, x, row, s.d, 2, s.hit === 'miss' ? P.grey : P.dir[s.d]);
    }
    // the crowd's mood: a tāniko band filling under the tag
    const mw = 54, mx = AW - mw - 8, my = 6;
    b.rect(mx - 1, my - 1, mw + 2, 6, P.ink);
    for (let x = 0; x < mw; x++) for (let y = 0; y < 4; y++) b.set(mx + x, my + y, x < mw * mood ? (((x + y) % 4 < 2) ? P.ochre2 : P.gold) : P.dark);
    drawPx(b, 'IWI', mx - 18, my - 1, P.paper, { outline: P.ink });
    // the score, the combo
    const sc = String(score).padStart(5, '0');
    drawPx(b, sc, AW - 8 - pxWidth(sc), 14, P.paper, { outline: P.ink });
    if (combo >= 2) drawPx(b, combo + ' COMBO', 70, ROW_B + 9, P.gold, { outline: P.ink });
    // the buttons for touch, labelled with the arrows
    for (let i = 0; i < 4; i++) { const bx = 158 + i * 20; b.rect(bx - 8, 46, 17, 11, P.ink); b.rect(bx - 7, 47, 15, 9, P.paper2); drawPx(b, DIR_GLYPH[i], bx - pxWidth(DIR_GLYPH[i]) / 2, 48, P.ink); }
    // judgements pop over the ring
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 0.6) { pops.splice(i, 1); continue; } drawPx(b, p.s, RING + 14, ROW_B - 13 - p.t * 10, p.c, { outline: P.ink }); }
    // the partner's word, if any
    if (line) {
      line.t += dt;
      if (line.t > 3) line = null;
      else { const ls = pxWrap(line.s, 120); ls.slice(0, 2).forEach((s, i) => drawPx(b, s, 64, 5 + i * 9 - (ls.length > 1 ? 0 : -3), P.white, { outline: P.ink })); }
    }
    // count-in words
    if (tt < COUNT * spb && tt > 0) { const w = ['TAHI', 'RUA', 'TORU', 'WHĀ'][Math.min(3, Math.floor(tt / spb))]; drawPx(b, w, AW / 2 - pxWidth(w, 2) / 2, 22, P.gold, { scale: 2, outline: P.ink }); }
    img.data.set(b.bytes);
    g2.putImageData(img, 0, 0);
  };

  const res = await new Promise<DanceResult>(resolve => {
    loop(dt => {
      const tt = now();
      // the band plays the song; every call and every beat
      const e8 = spb / 2, st = Math.floor((tt + 0.1) / e8);
      for (let s = Math.max(lastStep + 1, 0); s <= st; s++) {
        const at = useAudio ? t0 + s * e8 : 0;
        const g = song.groove[s % 8];
        if (g) synth.pahu(at, g === 2 ? 1 : 0.6);
        if (s % 2 === 1) synth.tokere(at, 0.07);
        synth.shaker(at, s % 2 ? 0.03 : 0.05);
        const ch = melody[s % melody.length];
        if (s >= COUNT * 2 && ch >= '1' && ch <= '9') synth.pluck(song.root + song.scale[+ch - 1], at, 0.3, 0.6, true);
        lastStep = s;
      }
      const beat = Math.floor(tt / spb);
      if (beat !== lastBeat && beat >= 0) { lastBeat = beat; o.hooks?.beat?.(beat); if (beat >= COUNT && (beat - COUNT) % 8 === 0) { const ph = (beat - COUNT) / 8; const ln = o.hooks?.phrase?.(ph, combo); if (ln) line = { s: ln, t: 0 }; } }
      for (const s of steps) {
        if (s.t > tt + 0.05) break;
        if (s.call && !s.shown && tt >= s.t) { s.shown = true; o.hooks?.call?.(s.d); }
        if (!s.call && !s.hit && tt - s.t > W8.good) { s.hit = 'miss'; miss++; combo = 0; mood = Math.max(0, mood - 0.05); stumbles += Math.random() < 0.4 ? 1 : 0; ringBad = 0.8; pops.push({ s: 'AUĒ', t: 0, c: P.grey }); o.hooks?.step?.(s.d, 'miss', 0); }
      }
      draw(tt, dt);
      if (tt > total && !done) {
        done = true;
        const n = Math.max(1, steps.filter(s => !s.call).length);
        const acc = (perfect + good * 0.6) / n;
        resolve({ score, acc, perfect, good, miss, stumbles, maxCombo, rating: acc >= 0.8 ? 'graceful' : acc >= 0.5 ? 'spirited' : 'brave' });
        return false;
      }
    });
  });
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', fit);
  synth.stop();
  wrap.remove();
  guardInput(300);
  if (o.music) audio.setMusic(o.music);
  return res;
}
