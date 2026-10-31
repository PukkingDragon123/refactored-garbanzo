// V12 guitar close-up: Aunty Hana's old steel-string across Mori's lap by the fire, seen from his
// eyes. The neck runs off to the left (the headstock and its tuners, the bone nut, the rosewood board
// with its frets and pearl dots), the body sits on his thigh to the right: a tobacco-burst spruce top
// with the grain running along it, the binding and purfling, a pāua rosette round the sound hole (the
// cut edge of the top, a brace and the maker's label inside), the tortoiseshell pickguard worn pale by
// years of picks, the rosewood bridge, the bone saddle and its pins. All of it lies on a woven flax mat
// in the firelight. His gloved left hand holds the chord shapes on the neck; the right holds a pick
// over the sound hole.
//
// A rhythm game. Notes slide along the strings from the headstock to the brass bar at the top of the
// body, and are played as they reach it:
//   strum   a carved bone comb across all six strings, the chord stamped on it: SPACE / down (or W /
//           up for an up-stroke; either plays it). Holding the right chord shape matters: 1-4 (or the
//           chord tags, or the arrows) change the left hand's chord; a strum in the wrong shape sounds
//           sour
//   pluck   a pick on one string: D F J K for the D, G, B and high e strings
//   hold    a flax cord trailing behind a note: keep the key down until it ends (let it ring)
// Touch: tap the sound hole to strum, tap a string at the brass bar to pluck it, tap a chord tag.
// The strings shake when played (only the length that speaks, from the fretted fret to the bridge),
// the guitar sounds through a Karplus-Strong synth (guitarsynth.ts), Hana plays the bass line under
// you, the pocket watch runs down the song, and the stamp says how it went.

import { game } from '../../../game/game';
import { audio } from '../../../core/audio';
import type { Music } from '../../../core/audio';
import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult, Grade } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, area, ellipse, line, dot, blit, pmap, up, drawWord, wordW, Z } from './kit';
import type { C, TextStyle } from './kit';
import { drawHand } from './hands';
import { GuitarSynth, CHORDS, SHAPES, OPEN } from './guitarsynth';
import type { Voice } from './guitarsynth';

// ---------------------------------------------------------------- the songs (Hana's own)
interface Bar { ch: string; s?: string; m?: string }
export interface SongDef { id: string; name: string; sub: string; bpm: number; chords: string[]; bars: Bar[] }
// each bar is eight eighth-notes: s = strums (D down, U up), m = plucks (0-3: the D, G, B, e strings),
// '=' holds the note before it on, '.' rests
export const SONGS: SongDef[] = [
  { id: 'ahi', name: 'Te Ahi', sub: 'The Fire', bpm: 76, chords: ['G', 'C', 'D'], bars: [
    { ch: 'G', s: 'D...D...' }, { ch: 'G', s: 'D...D...' }, { ch: 'C', s: 'D...D...' }, { ch: 'G', s: 'D...D...' },
    { ch: 'D', s: 'D...D...' }, { ch: 'C', s: 'D...D...' }, { ch: 'G', s: 'D...D===' }, { ch: 'G', m: '0.1.2.3.' },
    { ch: 'C', s: 'D.......', m: '....2.3.' }, { ch: 'D', s: 'D.......', m: '....2.3=' }, { ch: 'G', s: 'D...D.D.' }, { ch: 'G', s: 'D=======' },
  ] },
  { id: 'hoki', name: 'Hoki Mai', sub: 'Come Home', bpm: 88, chords: ['G', 'Em', 'C', 'D'], bars: [
    { ch: 'G', s: 'D.D.D.D.' }, { ch: 'Em', s: 'D.D.D.D.' }, { ch: 'C', s: 'D.D.D.D.' }, { ch: 'D', s: 'D.D.D.D.' },
    { ch: 'G', s: 'D.DU.UDU' }, { ch: 'Em', s: 'D.DU.UDU' }, { ch: 'C', s: 'D.DU.UDU' }, { ch: 'D', s: 'D===....', m: '....3.2.' },
    { ch: 'G', s: 'D.......', m: '..3.2.1=' }, { ch: 'Em', s: 'D.......', m: '..1.2.3=' }, { ch: 'C', s: 'D.......', m: '..3.2.1.' }, { ch: 'D', s: 'D.......', m: '..2.3===' },
    { ch: 'G', s: 'D.DU.UDU' }, { ch: 'Em', s: 'D.DU.UDU' }, { ch: 'C', s: 'D.DU.UDU' }, { ch: 'D', s: 'D.DU.U..' }, { ch: 'G', s: 'D=======' },
  ] },
  { id: 'manu', name: 'Te Rere o te Manu', sub: 'The Kite’s Flight', bpm: 100, chords: ['Am', 'C', 'G', 'D'], bars: [
    { ch: 'Am', s: 'D.......', m: '..1.2.3.' }, { ch: 'C', s: 'D.......', m: '..1.2.3.' }, { ch: 'G', s: 'D.......', m: '..1.2.3.' }, { ch: 'D', s: 'D.......', m: '..2.3.2.' },
    { ch: 'Am', m: '01230123' }, { ch: 'C', m: '01230123' }, { ch: 'G', m: '01230123' }, { ch: 'D', s: 'D===....', m: '....3=2=' },
    { ch: 'Am', s: 'D.DU.UDU' }, { ch: 'C', s: 'D.DU.UDU' }, { ch: 'G', s: 'D.DU.UDU' }, { ch: 'D', s: 'D.DU.UDU' },
    { ch: 'Am', s: 'D.......', m: '..3===2=' }, { ch: 'C', s: 'D.......', m: '..3===1=' }, { ch: 'G', s: 'D.D.D.D.' }, { ch: 'D', s: 'D.D.', m: '....0123' }, { ch: 'Am', s: 'D=======' },
  ] },
];
export const SONG_BY_ID: Record<string, SongDef> = Object.fromEntries(SONGS.map(s => [s.id, s]));
/** best accuracy (0..100) on a song */
export const songBest = (id: string) => game.save?.vars?.['v12g:best:' + id] ?? 0;
/** Hana teaches the songs in order: the next opens once the last one went well enough */
export function songOpen(id: string): boolean {
  if (id === 'ahi') return true;
  if (id === 'hoki') return songBest('ahi') >= 45;
  if (id === 'manu') return songBest('hoki') >= 70;
  return false;
}

interface Note {
  t: number; kind: 'strum' | 'pluck'; lane: number; dir: 'down' | 'up'; len: number; chord: string;
  state: 'wait' | 'hold' | 'done'; grade?: 'perfect' | 'good' | 'sour' | 'miss'; voices?: Voice[]; held?: number;
}
function chart(s: SongDef): Note[] {
  const out: Note[] = [];
  s.bars.forEach((b, bi) => {
    for (const [str, kind] of [[b.s, 'strum'], [b.m, 'pluck']] as [string | undefined, 'strum' | 'pluck'][]) {
      if (!str) continue;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '.' || ch === '=') continue;
        let len = 0;
        for (let j = i + 1; str[j] === '='; j++) len += 0.5;
        out.push({ t: bi * 4 + i * 0.5, kind, lane: kind === 'pluck' ? +ch : -1, dir: ch === 'U' ? 'up' : 'down', len, chord: b.ch, state: 'wait' });
      }
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------- painting helpers
const SPRUCE = ramp('#4a2c10', '#7a4e1c', '#a8722c', '#c8913e', '#deac58', '#f0c878', '#fae0a0');
const BURST = ramp('#140804', '#2a1208', '#45200c', '#663414', '#8a4e20');
const MAHOG = ramp('#1a0804', '#34140a', '#522412', '#70361c', '#8e4c2a');
const ROSE = ramp('#0c0604', '#1a0e08', '#2a1810', '#3a2418', '#4e3222', '#64422c');
const BONE = ramp('#8a7a5a', '#b8a882', '#d8caa4', '#efe4c4', '#fff8e4');
const NICKEL = ramp('#5a5e64', '#8a9098', '#b8bec6', '#e4e8ec', '#ffffff');
const BRASS = ramp('#4a3010', '#7a5418', '#b08430', '#d8b050', '#f4dc8a', '#fff4c4');
const PEARL = ramp('#a8b8c8', '#c8d4e4', '#e8e4f0', '#fff8f0');
const PAUA = ramp('#0e2a3a', '#145a6a', '#1e8a8a', '#3ab0a0', '#6ad0b8', '#5a6ac8', '#8a5ab8');
const FLAX = ramp('#2a1c0a', '#4a3414', '#6e5020', '#94702e', '#b48e40', '#d0aa5a', '#e6c47a');
const OLIVE = ramp('#141a08', '#232e10', '#344418', '#465a20', '#5c742c', '#78923a');
const TORT = ramp('#1a0804', '#3a1608', '#5e2a0e', '#8a4418', '#b86a24');
const INK = hex('#140a06');
const LANE_COL = ['#c8482a', '#2a9a9a', '#e0b030', '#efe6cc'];
const LANE_KEY = ['D', 'F', 'J', 'K'];
const PICK_ROWS = ['.ooooo.', 'oaabaao', 'oabaaao', 'oaaaaao', 'oaaaado', '.oaado.', '..oao..', '...o...'];
const pickArt = (col: string) => pmap(PICK_ROWS, { o: '#1e1008', a: col, b: '#ffffff', d: mixHex(col, '#000000', 0.35) });
function mixHex(a: string, b: string, k: number) { const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); return '#' + [0, 1, 2].map(i => Math.round(p(a, i) * (1 - k) + p(b, i) * k).toString(16).padStart(2, '0')).join(''); }

export interface GuitarOpts {
  song?: string;
  /** who is listening: Hana coaches, the crew cheer */
  who?: 'hana' | 'crew' | 'solo';
  world?: [number, number];
}
export interface GuitarResult extends CloseupResult { song: string; acc: number }

const STRUM_KEYS = ['Space', 'ArrowDown', 'KeyS', 'Enter'];
const UP_KEYS = ['ArrowUp', 'KeyW'];
const LANE_KEYS = [['KeyD'], ['KeyF'], ['KeyJ'], ['KeyK']];

export class GuitarSet implements SetScene {
  canAbort = true;
  intro: { text: string; style: TextStyle };
  song: SongDef;
  notes: Note[];
  bg!: PixelBuffer;
  synth = new GuitarSynth('sfx');
  band = new GuitarSynth('music');
  picks = LANE_COL.map(pickArt);
  // geometry (units)
  cy = 90; nutX = 24; bridgeX = 300; L = 276; markX = 170; holeX = 210; holeR = 15;
  // time
  spb = 0.7; t0 = -1; acc0 = 0; beat = -8; lead = 3; endBeat = 0; t = 0;
  useAudio = false; backNext = 0; backBeat = -4;
  // play state
  held: string;
  amp = [0, 0, 0, 0, 0, 0]; ph = [0, 0, 0, 0, 0, 0];
  score = 0; max = 0; combo = 0; best = 0; misses = 0; streakMiss = 0; perfects = 0; sours = 0;
  rh = { y: 0, from: 0, to: 0, k: 1 }; lhLift = 0;
  hot = [0, 0, 0, 0]; strumHot = 0;
  nextTalk = 0; changeSaid = -1; done = -1; ended = false;
  tags: { x: number; y: number; w: number; h: number; ch: string }[] = [];
  constructor(readonly o: GuitarOpts = {}) {
    this.song = SONG_BY_ID[o.song ?? 'ahi'] ?? SONGS[0];
    this.notes = chart(this.song);
    this.held = this.song.bars[0].ch;
    this.intro = { text: this.song.name.toUpperCase(), style: 'happy' };
    this.spb = 60 / this.song.bpm;
    this.lead = this.song.bpm < 85 ? 3 : 3.5;
    const last = this.notes[this.notes.length - 1];
    this.endBeat = last.t + last.len + 1.5;
    for (const n of this.notes) this.max += 1 + (n.len > 0 ? 0.5 : 0);
    // the strings' voices, ahead of the first strum
    const ms = new Set<number>(OPEN);
    for (const ch of this.song.chords) for (const m of CHORDS[ch]) if (m !== null) ms.add(m);
    this.synth.warm([...ms]);
  }

  // ------------------------------------------------------------ geometry
  fretX(n: number) { return this.nutX + this.L * (1 - Math.pow(2, -n / 12)); }
  sp(x: number) { return lerp(4.3, 5.4, clamp01((x - this.nutX) / this.L)); }
  strY(i: number, x: number) { return this.cy + (i - 2.5) * this.sp(x); }
  /** the body's half-height at x (a figure of eight: two bouts and a waist) */
  bodyH(x: number) {
    // the outline, traced from a dreadnought: round shoulder, upper bout, waist, the big lower bout
    const x0 = this.fretX(14) - 2, x1 = this.bridgeX + 64;
    const s = (x - x0) / (x1 - x0);
    if (s <= 0 || s >= 1) return -1;
    const P: [number, number][] = [[0, 0], [0.015, 17], [0.05, 30], [0.1, 38], [0.19, 42], [0.29, 38.5], [0.37, 34], [0.45, 38], [0.58, 50], [0.7, 55], [0.82, 53], [0.92, 42], [0.975, 24], [1, 0]];
    let i = 0;
    while (i < P.length - 2 && s > P[i + 1][0]) i++;
    const [sa, ra] = P[i], [sb, rb] = P[i + 1];
    const t = (s - sa) / (sb - sa);
    return lerp(ra, rb, (1 - Math.cos(Math.PI * t)) / 2);
  }
  noteX(n: Note, at = n.t) { return this.markX - (at - this.beat) * (this.markX - this.nutX) / this.lead; }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
    this.cy = Math.round(H * 0.52);
    this.nutX = Math.max(28, Math.round(W * 0.085));
    this.bridgeX = Math.round(W * 0.9);
    this.L = this.bridgeX - this.nutX;
    this.markX = this.fretX(15);
    this.holeX = this.fretX(14) + 40;
    this.holeR = 14;
    this.rh.y = this.rh.from = this.rh.to = this.strY(0, this.holeX) - 6;
    this.tags = this.song.chords.map((ch, i) => ({ x: this.nutX + 8 + i * 30, y: 10, w: 24, h: 26, ch }));
    this.paint(W, H);
  }

  // ------------------------------------------------------------ the set, painted once
  private paint(W: number, H: number) {
    const bg = new PixelBuffer(W * Z, H * Z);
    this.bg = bg;
    const cy = this.cy, nut = this.nutX, br = this.bridgeX;
    const bodyX0 = this.fretX(14);
    const fire = (u: number, v: number) => clamp01(1 - Math.hypot((u - W * 0.82) / (W * 0.9), (v + 30) / (H * 1.3)));
    // the flax mat, plaited on the diagonal, lit by the fire off to the top right
    area(bg, 0, 0, W, H, (u, v, fx, fy) => {
      const a = (u + v) / 5, b = (u - v) / 5;
      const ia = Math.floor(a), ib = Math.floor(b);
      const over = (ia + ib) & 1;
      const across = over ? a - ia : b - ib;
      let t = 0.32 + fire(u, v) * 0.45 + Math.sin(across * Math.PI) * 0.18 - (over ? 0 : 0.08);
      if (across < 0.08 || across > 0.92) t -= 0.22;
      t += (vnoise(u * 0.8, v * 0.8, 3) - 0.5) * 0.1;
      if (hash(ia, ib, 5) < 0.06) t -= 0.12;
      return rd(FLAX, t, fx, fy);
    });
    // Mori's thigh under the body: olive canvas, a twill, folds pulling toward the knee
    area(bg, bodyX0 - 10, cy, W, H, (u, v, fx, fy) => {
      // the thigh's top edge rounds over toward the knee, under the waist of the guitar
      const k = (u - bodyX0) / (W - bodyX0);
      const top = cy + 26 + 18 * (k - 0.5) * (k - 0.5) - k * 6 + Math.sin(u * 0.07) * 1.5;
      if (v < top) return -1;
      const fold = Math.sin(u * 0.09 + v * 0.05) * 0.5 + Math.sin(u * 0.21 - v * 0.03) * 0.3;
      let t = 0.45 + fold * 0.2 + fire(u, v) * 0.25 - clamp01((v - top) / 50) * 0.15;
      if (((fx + fy * 2) >> 1) % 5 === 0) t -= 0.06;
      if (v < top + 1.2) t = 0.1;
      return rd(OLIVE, t, fx, fy);
    });
    // the guitar's shadow on the mat (down and to the right of everything)
    area(bg, nut - 26, cy - 50, W, H, (u, v, fx, fy) => {
      const su = u - 4, sv = v - 6;
      const inBody = su > bodyX0 - 2 && Math.abs(sv - cy) < this.bodyH(su);
      const inNeck = su > nut - 22 && su < bodyX0 + 4 && Math.abs(sv - cy) < this.sp(su) * 3 + 3;
      return (inBody || inNeck) && dith(fx, fy) < 0.55 ? mix(bg.data[fy * bg.w + fx], INK, 0.5) : -1;
    });
    // the body: mahogany sides showing along the near edge, then the top
    area(bg, bodyX0 - 2, 0, W, H, (u, v, fx, fy) => {
      const hh = this.bodyH(u);
      const dy = v - cy;
      if (hh <= 0) return -1;
      if (dy > hh && dy < hh + 4.5) return rd(MAHOG, 0.6 - (dy - hh) / 6 + fire(u, v) * 0.2 + (vnoise(u * 0.4, 1, 9) - 0.5) * 0.1, fx, fy);
      if (Math.abs(dy) > hh) return -1;
      const e = hh - Math.abs(dy);
      // binding, black-white purfling, then the burst into the spruce
      if (e < 0.6) return INK;
      if (e < 1.7) return rd(BONE, 0.55 - (dy > 0 ? 0.25 : 0) + fire(u, v) * 0.2, fx, fy);
      if (e < 2.2) return hex('#1a1008');
      if (e < 2.6) return hex('#e8dcc0');
      const nx = (u - (bodyX0 + 60)) / 90, ny = dy / (hh + 1);
      const r = Math.hypot(nx * 1.2, ny);
      const grain = Math.sin(v * 1.9 + vnoise(u * 0.05, v * 0.4, 11) * 5) * 0.5 + 0.5;
      let t = 0.62 - r * 0.25 + (grain > 0.82 ? -0.1 : 0) + (vnoise(u * 0.03, v * 0.6, 12) - 0.5) * 0.08 + fire(u, v) * 0.18 - (dy > 0 ? dy / hh * 0.06 : 0);
      if (e < 9 + vnoise(u * 0.2, v * 0.2, 13) * 4) return rd(BURST, clamp01(t * 1.2 + (e - 2.6) / 14), fx, fy);
      return rd(SPRUCE, t, fx, fy);
    });
    // the pickguard, worn pale where the pick has gone a thousand times
    const pgx = this.holeX + 6, pgy = cy + this.holeR + 9;
    area(bg, pgx - 22, pgy - 14, pgx + 24, pgy + 14, (u, v, fx, fy) => {
      const dx = (u - pgx) / (u < pgx ? 18 : 22), dy = (v - pgy) / 11;
      const d = dx * dx + dy * dy - (u > pgx ? (u - pgx) / 60 : 0);
      if (d > 1 || Math.hypot(u - this.holeX, v - cy) < this.holeR + 7) return -1;
      if (d > 0.88) return INK;
      const m = vnoise(u * 0.35, v * 0.35, 21);
      let t = m > 0.62 ? 0.75 : m > 0.48 ? 0.45 : 0.18;
      t += (vnoise(u * 1.4, v * 1.4, 22) - 0.5) * 0.15;
      const wear = clamp01(1 - Math.hypot((u - this.holeX - 4) / 16, (v - cy - this.holeR - 5) / 6));
      if (wear > 0.3 && hash(fx >> 1, fy, 23) < wear * 0.5) return rd(TORT, 0.95, fx, fy);
      return rd(TORT, t, fx, fy);
    });
    // pick scratches on the top beside the guard
    for (let i = 0; i < 14; i++) {
      const a = hash(i, 1, 31) * Math.PI * 0.6 - 0.3, r0 = this.holeR + 8 + hash(i, 2, 31) * 10;
      const x0 = this.holeX + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0 * 0.5 + 6;
      line(bg, x0, y0, x0 + 3 + hash(i, 3, 31) * 4, y0 + 1.5, hex('#f8e4b0'), 1);
    }
    // the rosette: purfling rings, a ring of pāua shell
    const hx = this.holeX, hr = this.holeR;
    ellipse(bg, hx, cy, hr + 6.2, hr + 6.2, (_nx, _ny, u, v, fx, fy) => {
      const r = Math.hypot(u - hx, v - cy), a = Math.atan2(v - cy, u - hx);
      if (r < hr) return -1;
      if (r < hr + 0.7) return rd(SPRUCE, 0.85 - (v - cy) / hr * 0.3, fx, fy);
      if (r < hr + 1.5 || (r > hr + 4.6 && r < hr + 5.4)) return ((Math.floor(a * 40 + r * 2) & 1) ? hex('#f0e6cc') : hex('#1a1008'));
      if (r < hr + 4.6) { const n = vnoise(a * 6 + 10, r * 0.6, 41); return rd(PAUA, n * 1.1 + Math.sin(a * 3 + r) * 0.15, fx, fy); }
      if (r > hr + 5.8) return INK;
      return -1;
    });
    // inside the sound hole: the dark box, the cut edge of the top, a brace, the maker's label
    ellipse(bg, hx, cy, hr, hr, (_nx, _ny, u, v, fx, fy) => {
      const dx = u - hx, dy = v - cy, r = Math.hypot(dx, dy);
      if (r > hr - 1.4 && dy > 0) return rd(SPRUCE, 0.7 - (r - hr + 1.4) * 0.3, fx, fy);
      if (dy > 5 && dy < 8.5) return rd(ramp('#120a06', '#24160c', '#3a2414'), 0.6 - (dy - 5) / 6 + (dx < 0 ? 0.15 : 0), fx, fy);
      if (dx > 1 && dx < 9 && dy > -9 && dy < 2) {
        const lx = dx - 1, ly = dy + 9;
        if (lx < 0.5 || ly < 0.5) return hex('#3a2a1a');
        if ((ly > 2.5 && ly < 3.2 && lx > 1.5 && lx < 6.5) || (ly > 5 && ly < 5.6 && lx > 1.5 && lx < 5)) return hex('#4a2a1a');
        return rd(ramp('#4a3c28', '#6a5a40', '#8a7a58'), 0.6 - ly / 12, fx, fy);
      }
      return rd(ramp('#060302', '#0e0805', '#160d08'), 0.5 - dy / hr * 0.4 + dx / hr * 0.1, fx, fy);
    });
    // the bridge, the bone saddle, six bridge pins
    area(bg, br - 7, cy - 3 * this.sp(br) - 9, br + 7, cy + 3 * this.sp(br) + 9, (u, v, fx, fy) => {
      const dy = Math.abs(v - cy), hw = 3 * this.sp(br) + 9 - Math.max(0, Math.abs(u - br) - 3) * 2.2;
      if (dy > hw) return -1;
      if (dy > hw - 0.6 || Math.abs(u - br) > 6.4) return INK;
      return rd(ROSE, 0.55 - (v - cy) / 40 + (u < br ? 0.15 : -0.1) + (vnoise(u, v * 0.3, 51) - 0.5) * 0.2, fx, fy);
    });
    area(bg, br - 2.6, cy - 3 * this.sp(br) - 3, br - 1.2, cy + 3 * this.sp(br) + 3, (u, v, fx, fy) => rd(BONE, 0.7 - (u - br + 2.6) * 0.3, fx, fy));
    for (let i = 0; i < 6; i++) {
      const y = this.strY(i, br);
      ellipse(bg, br + 2.6, y, 1.6, 1.6, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.7 ? INK : rd(BONE, 0.7 - ny * 0.3 - nx * 0.2, fx, fy)));
      dot(bg, br + 2.6, y, INK, Math.max(1, Math.round(Z * 0.3)));
    }
    // the neck under the board (its rounded back shows below), the rosewood board, binding
    const neckEnd = this.fretX(20);
    area(bg, nut, cy - 40, neckEnd, cy + 40, (u, v, fx, fy) => {
      const hh = this.sp(u) * 3 + 2.4, dy = v - cy;
      if (u > bodyX0 + 1 && Math.abs(dy) < this.bodyH(u) - 3 && Math.abs(dy) > hh) return -1;
      if (dy > hh && dy < hh + 2.4 && u < bodyX0 + 1) return rd(MAHOG, 0.5 - (dy - hh) / 3, fx, fy);
      if (Math.abs(dy) > hh) return -1;
      const e = hh - Math.abs(dy);
      if (e < 0.5) return INK;
      if (e < 1.4) return rd(BONE, dy < 0 ? 0.75 : 0.45, fx, fy);
      const streak = vnoise(u * 0.08, v * 1.6, 61);
      let t = 0.45 + (streak - 0.5) * 0.45 + (vnoise(u * 0.9, v * 0.9, 62) - 0.5) * 0.1 - dy / hh * 0.08;
      // worn pale under the strings in the first frets
      if (u < this.fretX(5) && Math.abs((dy / this.sp(u) + 2.5) % 1 - 0.5) < 0.2) t += 0.12;
      return rd(ROSE, t, fx, fy);
    });
    // frets: nickel wire with a lit edge, the pearl dots
    for (let n = 1; n <= 20; n++) {
      const x = this.fretX(n), hh = this.sp(x) * 3 + 1.4;
      area(bg, x - 0.6, cy - hh, x + 0.7, cy + hh, (u, v, fx, fy) => rd(NICKEL, 0.75 - (u - x + 0.6) * 0.45 - (v - cy) / hh * 0.1, fx, fy));
    }
    for (const n of [3, 5, 7, 9, 12, 15, 17, 19]) {
      const x = (this.fretX(n) + this.fretX(n - 1)) / 2, s = this.sp(x);
      for (const oy of n === 12 ? [-1.5 * s, 1.5 * s] : [0]) ellipse(bg, x, cy + oy, 1.7, 1.7, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.75 ? hex('#2a2018') : rd(PEARL, 0.6 - ny * 0.3 + vnoise(nx * 3, ny * 3, n) * 0.3, fx, fy)));
    }
    // the headstock (a carved crest), its pāua koru, the bone nut, the six tuners
    const hsx = nut - 30;
    area(bg, hsx - 4, cy - 30, nut + 0.5, cy + 30, (u, v, fx, fy) => {
      const k = (nut - u) / 30, dy = v - cy;
      const hh = this.sp(nut) * 3 + 2.4 + Math.sin(k * Math.PI * 0.8) * 7 - Math.max(0, k - 0.85) * 40;
      if (Math.abs(dy) > hh || u < hsx - 3) return -1;
      const e = hh - Math.abs(dy);
      if (e < 0.6) return INK;
      if (e < 1.5) return rd(BONE, dy < 0 ? 0.7 : 0.4, fx, fy);
      return rd(ROSE, 0.5 + (vnoise(u * 0.1, v * 1.2, 71) - 0.5) * 0.4 + fire(u, v) * 0.1, fx, fy);
    });
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 1 + i * 0.32; dot(bg, nut - 15 + Math.cos(a) * r, cy + Math.sin(a) * r, PAUA[(i * 2) % PAUA.length], Math.max(1, Math.round(Z * 0.4))); }
    area(bg, nut - 0.6, cy - this.sp(nut) * 3 - 2, nut + 1.6, cy + this.sp(nut) * 3 + 2, (u, v, fx, fy) => rd(BONE, 0.8 - (u - nut + 0.6) * 0.25 - (v - cy) / 40, fx, fy));
    for (let i = 0; i < 6; i++) {
      const top = i < 3, tx = nut - 6 - (i % 3) * 8, ty = top ? cy - this.sp(nut) * 3 - 5 : cy + this.sp(nut) * 3 + 5;
      // the post with the string wound round it, the button out past the edge
      ellipse(bg, tx, ty, 1.8, 1.8, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.72 ? INK : rd(NICKEL, 0.7 - ny * 0.4 - nx * 0.2, fx, fy)));
      const by = top ? ty - 7 : ty + 7;
      line(bg, tx, ty + (top ? -1.6 : 1.6), tx, by, rd(NICKEL, 0.4, 0, 0), Math.max(2, Z));
      ellipse(bg, tx, by + (top ? -1.5 : 1.5), 2.6, 2, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.75 ? INK : rd(PEARL, 0.55 - ny * 0.35 + nx * 0.1, fx, fy)));
    }
    // embers' glow along the top edge (the fire is just out of sight)
    area(bg, W * 0.55, 0, W, 10, (u, v, fx, fy) => (dith(fx, fy) < (1 - v / 10) * 0.35 * fire(u, v) ? mix(bg.data[fy * bg.w + fx], hex('#ff9a3a'), 0.35) : -1));
  }

  // ------------------------------------------------------------ the clock
  private now(c: Closeup): number {
    const a = this.synth.now();
    if (a !== null) { this.useAudio = true; return a; }
    return this.acc0 + c.t;
  }

  update(c: Closeup, dt: number) {
    this.t += dt;
    const now = this.now(c);
    if (this.t0 < 0) { this.t0 = now + 0.6; this.backNext = this.t0; this.backBeat = -4; this.coach(c, 'start'); }
    this.beat = (now - this.t0) / this.spb - 4;
    this.backing();
    // strings settle
    for (let i = 0; i < 6; i++) { this.amp[i] *= Math.exp(-dt * 3.2); this.ph[i] += dt * (22 + i * 3) * Math.PI * 2; }
    for (let i = 0; i < 4; i++) this.hot[i] = Math.max(0, this.hot[i] - dt * 5);
    this.strumHot = Math.max(0, this.strumHot - dt * 5);
    this.lhLift = Math.max(0, this.lhLift - dt * 6);
    this.rh.k = Math.min(1, this.rh.k + dt / 0.09);
    this.rh.y = lerp(this.rh.from, this.rh.to, this.rh.k);
    if (this.done >= 0) { this.done += dt; if (this.done > 0.6 && !this.ended) this.end(c); return; }
    // count-in
    if (this.beat < 0) {
      const b = Math.floor(this.beat + 4);
      if (b >= 0 && b !== this.changeSaid && b < 4) { this.changeSaid = b; c.say(['ONE', 'TWO', 'THREE', 'FOUR'][b], c.W / 2, this.cy - 60, { style: b === 3 ? 'shout' : 'say', ms: 480, size: 'big', color: '#ffe680' }); }
    }
    this.input(c);
    this.judgeLate(c);
    this.holds(c, dt);
    this.chordHint(c);
    if (this.t > this.nextTalk && this.who !== 'solo' && Math.random() < dt * 0.15) this.coach(c, 'idle');
    // embers drift up off the top edge
    if (Math.random() < dt * 3) c.parts.add('ember', c.W * (0.6 + Math.random() * 0.4), c.H * 0.02, (Math.random() - 0.5) * 10, 6 + Math.random() * 8, { life: 1.2 });
    c.watch = { t01: 1 - clamp01(this.beat / this.endBeat), x: c.W - 22, y: 24, size: 26, secs: Math.round(this.endBeat * this.spb) };
    if (this.beat > this.endBeat) this.done = 0;
  }
  get who() { return this.o.who ?? 'hana'; }

  /** Hana's bass under you (the root on one and three, a slap on two and four), on the audio clock */
  private backing() {
    const now = this.synth.now();
    if (now === null) return;
    const bars = this.song.bars;
    while (this.backNext < now + 0.2) {
      const b = this.backBeat;
      if (b < 0) this.band.thunk(this.backNext, b === -1 ? 0.22 : 0.15);
      else if (b < bars.length * 4) {
        const ch = bars[Math.floor(b / 4)].ch, root = CHORDS[ch].find(m => m !== null) ?? 43;
        const inBar = b % 4;
        if (inBar === 0 || inBar === 2) this.band.note(root - 12 + (inBar === 2 ? 7 : 0), this.backNext, 0.28, { ring: 1.4, bright: 0.1 });
        else this.band.thunk(this.backNext, 0.1);
      }
      this.backNext += this.spb;
      this.backBeat++;
    }
  }

  // ------------------------------------------------------------ playing
  private input(c: Closeup) {
    const P = c.ptr;
    // the chord hand
    for (let i = 0; i < 4; i++) if (c.hit('Digit' + (i + 1)) || c.hit('Numpad' + (i + 1))) this.setChord(c, this.song.chords[i]);
    const ci = this.song.chords.indexOf(this.held);
    if (c.hit('ArrowLeft')) this.setChord(c, this.song.chords[(ci + this.song.chords.length - 1) % this.song.chords.length]);
    if (c.hit('ArrowRight')) this.setChord(c, this.song.chords[(ci + 1) % this.song.chords.length]);
    // the picking hand
    if (STRUM_KEYS.some(k => c.hit(k))) this.strum(c, 'down');
    if (UP_KEYS.some(k => c.hit(k))) this.strum(c, 'up');
    LANE_KEYS.forEach((ks, i) => { if (ks.some(k => c.hit(k))) this.pluck(c, i); });
    if (P.pressed) {
      const tag = this.tags.find(t => P.x >= t.x && P.x <= t.x + t.w && P.y >= t.y && P.y <= t.y + t.h + 6);
      if (tag) this.setChord(c, tag.ch);
      else if (P.x > this.markX + 8 && Math.abs(P.y - this.cy) < 40) this.strum(c, P.vy < -40 ? 'up' : 'down');
      else if (Math.abs(P.x - this.markX) < 26) {
        let bi = 0, bd = 1e9;
        for (let i = 0; i < 6; i++) { const d = Math.abs(this.strY(i, this.markX) - P.y); if (d < bd) { bd = d; bi = i; } }
        if (bi < 2) this.strum(c, 'down'); else this.pluck(c, bi - 2);
      }
    }
  }
  private down(kind: 'strum' | 'pluck', lane: number, c: Closeup) {
    if (kind === 'strum') return STRUM_KEYS.some(k => c.key(k)) || UP_KEYS.some(k => c.key(k)) || (c.ptr.down && c.ptr.x > this.markX - 26);
    return LANE_KEYS[lane].some(k => c.key(k)) || (c.ptr.down && Math.abs(c.ptr.x - this.markX) < 26);
  }
  private setChord(c: Closeup, ch: string | undefined) {
    if (!ch || ch === this.held) return;
    this.held = ch;
    this.lhLift = 1;
    this.synth.squeak();
    c.sfx('rustle', { vol: 0.06, pitch: 2.2 });
  }
  private win() { return { perfect: 0.075 / this.spb, good: 0.15 / this.spb }; }
  private nearest(kind: 'strum' | 'pluck', lane: number) {
    const w = this.win().good;
    let best: Note | null = null, bd = 1e9;
    for (const n of this.notes) {
      if (n.state !== 'wait' || n.kind !== kind || (kind === 'pluck' && n.lane !== lane)) continue;
      const d = Math.abs(n.t - this.beat);
      if (d < bd && d <= w) { bd = d; best = n; }
      if (n.t - this.beat > w) break;
    }
    return best;
  }
  private strum(c: Closeup, dir: 'down' | 'up') {
    const top = this.strY(0, this.holeX) - 6, bot = this.strY(5, this.holeX) + 6;
    this.rh.from = this.rh.y; this.rh.to = dir === 'down' ? bot : top; this.rh.k = 0;
    this.strumHot = 1;
    const n = this.nearest('strum', -1);
    const sh = CHORDS[this.held];
    for (let i = 0; i < 6; i++) if (sh[i] !== null) this.amp[i] = Math.max(this.amp[i], 1.3 - i * 0.08);
    if (!n) { this.synth.strum(this.held, 0, 0.3, dir, { ring: 1.2 }); return; }
    const off = Math.abs(n.t - this.beat), w = this.win();
    let g: Note['grade'] = off <= w.perfect ? 'perfect' : 'good';
    if (this.held !== n.chord) g = 'sour';
    n.voices = this.synth.strum(this.held, 0, 0.5, dir, { ring: n.len > 0 ? 2.6 : 1.8 });
    if (g === 'sour') this.synth.sour(0, 0.15);
    this.judge(c, n, g, -1);
  }
  private pluck(c: Closeup, lane: number) {
    const s = lane + 2;
    this.hot[lane] = 1;
    const y = this.strY(s, this.holeX);
    this.rh.from = this.rh.y; this.rh.to = y; this.rh.k = 0.4;
    const midi = CHORDS[this.held][s] ?? OPEN[s];
    this.amp[s] = Math.max(this.amp[s], 1.6);
    const n = this.nearest('pluck', lane);
    if (!n) { this.synth.note(midi, 0, 0.32, { ring: 1.2 }); return; }
    const off = Math.abs(n.t - this.beat), w = this.win();
    const g: Note['grade'] = off <= w.perfect ? 'perfect' : 'good';
    n.voices = [this.synth.note(midi, 0, 0.55, { ring: n.len > 0 ? 2.6 : 1.8, bright: 0.8 })];
    this.judge(c, n, g, lane);
  }
  private judge(c: Closeup, n: Note, g: NonNullable<Note['grade']>, lane: number) {
    n.grade = g;
    n.state = n.len > 0 && g !== 'sour' ? 'hold' : 'done';
    n.held = 0;
    this.score += g === 'perfect' ? 1 : g === 'good' ? 0.72 : 0.35;
    if (g === 'sour') { this.sours++; this.combo = 0; } else { this.combo++; this.streakMiss = 0; }
    if (g === 'perfect') this.perfects++;
    this.best = Math.max(this.best, this.combo);
    const y = lane < 0 ? this.cy - this.sp(this.markX) * 3 - 12 : this.strY(lane + 2, this.markX) - 7;
    const word = g === 'perfect' ? 'PERFECT' : g === 'good' ? 'GOOD' : 'SOUR';
    c.say(word, this.markX + 2, y, { style: g === 'sour' ? 'scared' : g === 'perfect' ? 'happy' : 'say', ms: 520, size: 'small', color: g === 'perfect' ? '#ffe680' : g === 'good' ? '#c8f0a0' : '#ffb0a0' });
    const col = lane < 0 ? '#ffe680' : LANE_COL[lane];
    c.parts.burst(g === 'perfect' ? 'star' : 'spark', this.markX, lane < 0 ? this.cy : this.strY(lane + 2, this.markX), g === 'perfect' ? 7 : 4, 50, { c: [col, '#fff6dc'], life: 0.45 });
    if (g === 'sour') this.coach(c, 'sour');
    else if (this.combo > 0 && this.combo % 8 === 0) this.coach(c, 'combo');
  }
  private judgeLate(c: Closeup) {
    const w = this.win().good;
    for (const n of this.notes) {
      if (n.t - this.beat > 0) break;
      if (n.state !== 'wait' || this.beat - n.t <= w) continue;
      n.state = 'done'; n.grade = 'miss';
      this.misses++; this.combo = 0; this.streakMiss++;
      const y = n.kind === 'strum' ? this.cy - this.sp(this.markX) * 3 - 12 : this.strY(n.lane + 2, this.markX) - 7;
      c.say('MISS', this.markX - 6, y, { style: 'whisper', ms: 420, size: 'small', color: '#a8b0c8' });
      if (this.streakMiss === 3) this.coach(c, 'miss');
    }
  }
  private holds(c: Closeup, dt: number) {
    for (const n of this.notes) {
      if (n.state !== 'hold') continue;
      const end = n.t + n.len;
      if (this.down(n.kind, n.lane, c)) {
        n.held = clamp01((this.beat - n.t) / n.len);
        if (n.kind === 'strum') { const sh = CHORDS[this.held]; for (let i = 0; i < 6; i++) if (sh[i] !== null) this.amp[i] = Math.max(this.amp[i], 0.7); }
        else this.amp[n.lane + 2] = Math.max(this.amp[n.lane + 2], 0.9);
        if (Math.random() < dt * 14) c.parts.add('spark', this.markX + (Math.random() - 0.5) * 3, n.kind === 'strum' ? this.cy + (Math.random() - 0.5) * 26 : this.strY(n.lane + 2, this.markX), 0, -20, { c: n.kind === 'strum' ? '#ffe680' : LANE_COL[n.lane], life: 0.3 });
        if (this.beat >= end) { n.state = 'done'; n.held = 1; this.score += 0.5; c.say('RING!', this.markX + 4, this.cy - this.sp(this.markX) * 3 - 20, { style: 'happy', ms: 500, size: 'small', color: '#ffe680' }); }
      } else {
        // let go early: the note is cut short, half the ring is lost
        n.state = 'done';
        this.score += 0.5 * (n.held ?? 0);
        for (const v of n.voices ?? []) v.stop();
      }
    }
  }
  private chordHint(c: Closeup) {
    const nxt = this.notes.find(n => n.state === 'wait' && n.kind === 'strum' && n.t > this.beat - 0.2);
    if (!nxt || nxt.chord === this.held || nxt.t - this.beat > 2.6) return;
    const k = Math.floor(nxt.t * 2);
    if (k === this.changeSaid) return;
    this.changeSaid = k;
    const i = this.song.chords.indexOf(nxt.chord);
    c.say(`CHANGE TO ${nxt.chord}  (${i + 1})`, this.nutX + 70, this.tags[0].y + 34, { style: 'shout', ms: 900, size: 'small', color: '#ffe680' });
  }

  private coach(c: Closeup, why: 'start' | 'combo' | 'miss' | 'sour' | 'idle') {
    if (this.who === 'solo') return;
    this.nextTalk = this.t + 5;
    const hana = this.who === 'hana';
    const L: Record<string, string[]> = hana ? {
      start: [`Start on ${this.held}. Strum when the bone reaches the brass.`, `Fingers on ${this.held}. Listen to my bass, then come in.`],
      combo: ['Ka pai! Now you’re playing.', 'Yes! Like that.', 'Hear it? That’s the song.'],
      miss: ['Breathe. Find the beat again.', 'Listen to the bass. One... two...'],
      sour: ['Wrong shape! Change your chord.', 'Ooh. Check your fingers.'],
      idle: ['Loose wrist. Like flicking water.', 'Don’t look at your hands, feel them.', 'Good. Keep going.'],
    } : {
      start: ['Go on then, Doc! Give us a tune!', 'Quiet, everyone. Mori’s playing.'],
      combo: ['Yeah, Mori!', 'Look at him go!', 'Ka pai, Mori!'],
      miss: ['You’ve got this!', 'Keep going, mate!'],
      sour: ['Ooh. Bit of a wrong one there.', 'Was that on purpose?'],
      idle: ['Lovely.', 'This is nice.', 'Didn’t know you could play.'],
    };
    const who = hana ? 'HANA' : ['JOSHU', 'JENNA', 'AROHA'][Math.floor(Math.random() * 3)];
    const line = L[why][Math.floor(Math.random() * L[why].length)];
    c.say(`${who}: ${line}`, c.W / 2, c.H - 22, { style: why === 'combo' ? 'happy' : why === 'miss' || why === 'sour' ? 'whisper' : 'say', ms: 2400, color: hana ? '#a8e8ec' : '#ffd8a0' });
  }

  private end(c: Closeup) {
    this.ended = true;
    for (const n of this.notes) for (const v of n.voices ?? []) v.stop();
    const acc = clamp01(this.score / this.max);
    const grade: Grade = acc >= 0.9 ? 'perfect' : acc >= 0.7 ? 'good' : acc >= 0.45 ? 'rough' : 'fail';
    // the last chord rings out
    if (grade !== 'fail') this.synth.strum(this.held, 0, 0.45, 'down', { ring: 3 });
    c.finish(grade, acc, { word: grade === 'fail' ? 'OFF KEY' : undefined });
  }
  get acc() { return clamp01(this.score / this.max); }

  trophy() {
    return { img: up(this.picks[0], Z * 3), name: this.song.name, sub: `${Math.round(this.acc * 100)}% IN TIME  x${this.best}` };
  }

  // ------------------------------------------------------------ the frame
  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const cy = this.cy, mk = this.markX;
    // the brass bar the notes are played at, brighter on the beat
    const pulse = this.beat >= 0 ? Math.max(0, 1 - (this.beat % 1) * 3) : 0;
    const hh = this.sp(mk) * 3 + 4;
    area(px, mk - 1.6, cy - hh, mk + 1.6, cy + hh, (u, v, fx, fy) => {
      const e = Math.min(u - mk + 1.6, mk + 1.6 - u);
      if (e < 0.35) return INK;
      return rd(BRASS, 0.55 + pulse * 0.35 - (u - mk) * 0.12 - (v - cy) / hh * 0.1 + (((fy >> 1) % 6 === 0) ? -0.2 : 0), fx, fy);
    });
    // the lane glow when a string is played
    for (let i = 0; i < 4; i++) if (this.hot[i] > 0) { const y = this.strY(i + 2, mk); area(px, mk - 8, y - 2, mk + 8, y + 2, (_u, _v, fx, fy) => (dith(fx, fy) < this.hot[i] * 0.5 ? mix(px.data[fy * px.w + fx], hex(LANE_COL[i]), 0.5) : -1)); }
    // hold trails, then the notes on their strings
    for (const n of this.notes) {
      if (n.state === 'done') continue;
      const x = n.state === 'hold' ? mk : this.noteX(n);
      if (x < this.nutX - 4) continue;
      if (n.len > 0) {
        const xe = Math.max(this.nutX, this.noteX(n, n.t + n.len));
        if (xe < x) this.trail(px, n, xe, x);
      }
      if (n.state === 'hold') continue;
      if (n.kind === 'pluck') {
        const y = this.strY(n.lane + 2, x), pk = up(this.picks[n.lane], Z);
        blit(px, pk, x - 3.5, y - 4);
      } else this.comb(px, n, x);
    }
    // the strings over everything on the guitar
    this.strings(px);
    // the chord hand: fingertips on the strings, the gloved hand reaching round the neck
    this.leftHand(px);
    // the picking hand and its pick
    const rx = this.holeX - 4, ry = this.rh.y;
    drawHand(px, 'pinch', rx, ry, { rot: 0, from: [rx + 34, ry + 120] });
    ellipse(px, rx - 1, ry - 1.2, 1.6, 2.1, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.7 ? INK : rd(TORT, 0.5 - ny * 0.3 + vnoise(nx * 2, ny * 2, 3) * 0.4, fx, fy)));
    // the chord tags hanging off a cord across the top
    this.drawTags(c, px);
    // key prompts for the first bars
    if (this.beat < 6 && this.done < 0) {
      for (let i = 0; i < 4; i++) drawWord(px, c.touch ? '' : LANE_KEY[i], mk - 10, this.strY(i + 2, mk) - 3, { size: 'small', color: LANE_COL[i], t: this.t });
      c.prompt(px, c.touch ? 'TAP THE HOLE TO STRUM, A STRING TO PLUCK' : 'SPACE STRUM   D F J K PLUCK   1-4 CHORD', c.W / 2, c.H - 12, c.touch ? 'mouse' : 'SPACE');
    }
    // the combo, scratched on the mat
    if (this.combo >= 4) drawWord(px, `x${this.combo}`, mk, cy + hh + 6, { size: this.combo >= 16 ? 'body' : 'small', style: 'happy', t: this.t, color: '#ffe680' });
  }

  private trail(px: PixelBuffer, n: Note, x0: number, x1: number) {
    const held = n.state === 'hold';
    if (n.kind === 'pluck') {
      const col = hex(LANE_COL[n.lane]), dk = mix(col, INK, 0.45);
      for (let fx = Math.floor(x0 * Z); fx < x1 * Z; fx++) {
        const u = fx / Z, y = this.strY(n.lane + 2, u);
        const tw = Math.sin(u * 2.2 + this.t * (held ? 12 : 3));
        const fy = Math.round((y + tw * 0.6) * Z);
        px.set(fx, fy - 1, tw > 0 ? col : dk); px.set(fx, fy, held ? hex('#fff6dc') : col); px.set(fx, fy + 1, dk);
      }
    } else {
      const top = this.strY(0, x1) - 3, bot = this.strY(5, x1) + 3;
      area(px, x0, top, x1, bot, (u, v, fx, fy) => (dith(fx, fy) < (held ? 0.4 : 0.22) ? mix(px.data[fy * px.w + fx], hex('#ffe680'), 0.45) : -1));
    }
  }
  /** a carved bone comb across the strings, the chord stamped over it, the stroke's arrow under it */
  private comb(px: PixelBuffer, n: Note, x: number) {
    const top = this.strY(0, x) - 4, bot = this.strY(5, x) + 4;
    const right = n.chord === this.held;
    area(px, x - 2.4, top, x + 2.4, bot, (u, v, fx, fy) => {
      const e = Math.min(u - x + 2.4, x + 2.4 - u, v - top, bot - v);
      if (e < 0.4) return INK;
      for (let i = 0; i < 6; i++) if (Math.abs(v - this.strY(i, x)) < 0.45) return hex('#4a3a24');
      return rd(BONE, 0.75 - (u - x) * 0.18 - (v - top) / (bot - top) * 0.25, fx, fy);
    });
    drawWord(px, n.chord, x, top - 9, { size: 'small', color: right ? '#fff0c0' : '#ffb0a0', outline: '#1e1008' });
    const ay = n.dir === 'down' ? bot + 2 : top - 11;
    for (let k = 0; k < 3; k++) line(px, x - (2 - k) * 0.7, ay + (n.dir === 'down' ? k : 2 - k), x + (2 - k) * 0.7, ay + (n.dir === 'down' ? k : 2 - k), hex('#fff0c0'), 1);
  }

  private strings(px: PixelBuffer) {
    const W = px.w, br = this.bridgeX, sh = SHAPES[this.held] ?? [];
    const THICK = [3, 3, 2, 2, 1, 1].map(t => Math.max(1, Math.round(t * Z / 3)));
    for (let i = 0; i < 6; i++) {
      const wound = i < 3;
      const fr = sh.find(s => s[0] === i)?.[1] ?? 0;
      const sx0 = this.fretX(fr);
      const L = br - sx0;
      const a = this.amp[i], ph = Math.sin(this.ph[i]);
      const hi = hex(wound ? '#f4dca0' : '#ffffff'), body = hex(wound ? '#b88a4a' : '#b8c0c8'), dk = hex(wound ? '#6a4a24' : '#6a7078');
      const th = THICK[i];
      for (let fx = Math.floor((this.nutX - 0.5) * Z); fx < Math.min(W, Math.ceil((br - 1.5) * Z)); fx++) {
        const u = fx / Z;
        let y = this.strY(i, u);
        if (u > sx0 && a > 0.02) y += a * Math.sin(Math.PI * (u - sx0) / L) * ph * (fx & 1 ? 1 : 0.6);
        const fy = Math.round(y * Z);
        // its shadow on the wood, a little down and to the right
        const sy = fy + Math.max(1, Math.round(Z * 0.8));
        if (dith(fx, sy) < 0.6) px.set(fx + 1, sy, mix(px.data[sy * W + fx + 1] ?? 0, INK, 0.45));
        for (let k = 0; k < th; k++) px.set(fx, fy + k, k === 0 ? hi : k === th - 1 && th > 1 ? dk : body);
        if (wound && (fx % 3 === 0)) px.set(fx, fy + Math.min(1, th - 1), dk);
      }
      // a shimmer band while it rings
      if (a > 0.25) {
        const xa = Math.max(sx0, this.markX - 20), xb = Math.min(br - 4, this.holeX + 20);
        area(px, xa, this.strY(i, xa) - a * 0.9, xb, this.strY(i, xa) + a * 0.9 + th / Z, (_u, _v, fx, fy) => (dith(fx, fy) < a * 0.18 ? mix(px.data[fy * px.w + fx], body, 0.5) : -1));
      }
    }
  }

  private leftHand(px: PixelBuffer) {
    const sh = SHAPES[this.held] ?? [];
    const lift = this.lhLift * 3;
    // fingertips (glove leather, a stitched seam) just behind each fret they hold
    for (const [s, f] of sh) {
      const x = this.fretX(f) - (this.fretX(f) - this.fretX(f - 1)) * 0.35, y = this.strY(s, x) - lift;
      ellipse(px, x, y, 2.1, 1.7, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.72 ? INK : rd(ramp('#4a2a12', '#74461e', '#9c622c', '#c48a46', '#e8bc78'), 0.62 - ny * 0.35 - nx * 0.15, fx, fy)));
      line(px, x - 1.2, y + 0.6, x + 1.2, y + 0.6, hex('#efd9a8'), 1);
    }
    const fs = sh.map(s => s[1]);
    const mid = fs.length ? (Math.min(...fs) + Math.max(...fs)) / 2 : 2;
    const hx = this.fretX(mid) - 2, hy = this.cy + this.sp(hx) * 1.6 - lift;
    drawHand(px, 'grip', hx, hy, { rot: 0, left: true, from: [hx - 36, hy + 110] });
    // the fingertips that hold the shape show over the top of the fist
    for (const [s, f] of sh) {
      const x = this.fretX(f) - (this.fretX(f) - this.fretX(f - 1)) * 0.35, y = this.strY(s, x) - lift;
      if (Math.abs(x - hx) < 9 && y > hy - 10) ellipse(px, x, y, 2.1, 1.7, (nx, ny, _u, _v, fx, fy) => (nx * nx + ny * ny > 0.72 ? INK : rd(ramp('#4a2a12', '#74461e', '#9c622c', '#c48a46', '#e8bc78'), 0.62 - ny * 0.35 - nx * 0.15, fx, fy)));
    }
  }

  private drawTags(c: Closeup, px: PixelBuffer) {
    const y0 = this.tags[0].y - 3;
    // the cord, tied from the headstock across
    for (let fx = Math.floor((this.nutX - 6) * Z); fx < (this.tags[this.tags.length - 1].x + 30) * Z; fx++) {
      const u = fx / Z, sag = Math.sin(((u - this.nutX + 6) / (this.tags.length * 30 + 10)) * Math.PI) * 2;
      px.set(fx, Math.round((y0 + sag) * Z), (fx >> 1) % 2 ? hex('#d8c8a0') : hex('#8a7a58'));
    }
    const next = this.notes.find(n => n.state === 'wait' && n.kind === 'strum' && n.t > this.beat - 0.2);
    this.tags.forEach((tg, i) => {
      const on = tg.ch === this.held, want = !!next && next.chord === tg.ch && !on && next.t - this.beat < 2.6;
      const sw = Math.sin(this.t * 3 + i) * (want ? 1.2 : 0.3);
      const x = tg.x + sw, y = tg.y + (on ? 3 : 0);
      area(px, x, y, x + tg.w, y + tg.h, (u, v, fx, fy) => {
        const lx = u - x, ly = v - y;
        if (ly < 4 && (lx < 4 - ly || lx > tg.w - 4 + ly)) return -1;
        const e = Math.min(lx - (ly < 4 ? 4 - ly : 0), tg.w - lx - (ly < 4 ? 4 - ly : 0), ly, tg.h - ly);
        if (e < 0.5) return INK;
        if (Math.hypot(lx - tg.w / 2, ly - 4) < 1.6) return hex('#2a1a0c');
        const base = on ? 0.85 : 0.6;
        return rd(ramp('#8a6e3e', '#a88a56', '#c4a670', '#d8bc86', '#e6d09e', '#f2e2b8'), base - ly / tg.h * 0.2 + (vnoise(u * 0.7, v * 0.7, 81 + i) - 0.5) * 0.12, fx, fy);
      });
      line(px, x + tg.w / 2, y0, x + tg.w / 2, y + 2.5, hex('#a8946e'), 1);
      drawWord(px, String(i + 1), x + 4, y + 5, { size: 'small', color: '#6a4c26', outline: '#f2e2b8', align: 'left' });
      drawWord(px, tg.ch, x + tg.w / 2 + 1, y + 11, { size: 'body', color: on ? '#c8341e' : '#3a2614', outline: '#f2e2b8', style: want ? 'shout' : 'say', t: this.t });
      if (on) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + this.t * 2; dot(px, x + tg.w / 2 + Math.cos(a) * 15, y + tg.h / 2 + Math.sin(a) * 15, hex('#ffe680'), Math.max(1, Math.round(Z * 0.3))); }
    });
    void c;
  }

  onAbort() { for (const n of this.notes) for (const v of n.voices ?? []) v.stop(); }
}

/** play a song on Hana's guitar; resolves with the close-up result plus the song and its accuracy */
export async function runGuitar(o: GuitarOpts = {}): Promise<GuitarResult> {
  const prev = (audio as unknown as { wantMusic?: Music }).wantMusic;
  audio.setMusic('none');
  const set = new GuitarSet(o);
  let r: CloseupResult;
  try { r = await runCloseup(set, { world: o.world }); }
  finally { if (prev && prev !== 'none' && o.who !== 'hana') audio.setMusic(prev); }
  const acc = r.aborted ? 0 : set.acc;
  if (!r.aborted) {
    const k = 'v12g:best:' + set.song.id, best = Math.round(acc * 100);
    if (best > (game.save.vars[k] ?? 0)) game.save.vars[k] = best;
    game.save.vars['v12g:plays'] = (game.save.vars['v12g:plays'] ?? 0) + 1;
    game.persist();
  }
  return { ...r, song: set.song.id, acc };
}
