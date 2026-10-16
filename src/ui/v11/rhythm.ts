// V11 the hue kiri lessons: a rhythm game in a full-screen pixel-art close-up. Mori sits with the
// instrument across his knees under the evening sky of Te Kāinga; the notes come down a serpent's
// back toward the neck as gleaming scales, one lane per place on the neck. Hit them as they reach the
// pāua pads (D F J K, the arrow keys, 1-4, or tap the lanes): his real (3D) hands fret and pluck, the
// strings shiver, and the melody plays only when he hits it, over Ngaio's band (a slit drum, bone
// clappers, a drone). Timing windows (tino pai / pai / auē), a combo and a multiplier, held notes,
// three difficulties, four songs unlocked over time, and Aunty Ngaio's comments as he plays.
// Everything on screen is pixel art: painted into the close-up's 320x180 buffer, text in the Kiri
// bitmap font (pxfont.ts).
//
//   runHueKiri({ teacher, song, diff, music })  ->  the result, or null if he put it down first

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import type { Music } from '../../core/audio';
import { openCloseup, CW, CH, rgb, hx, put, mixc, dith, hash } from '../v6/closeup';
import type { Closeup } from '../v6/closeup';
import { loop } from '../v4/mini';
import { closeupHands, HANDS3D } from '../../art/v11/hands3d';
import type { HandsController } from '../../art/v11/hands3d';
import { drawPxBuf, pxWidth, pxWrap } from './pxfont';
import { KiriSynth } from './rhythm-audio';
import { SONGS, SONG_BY_ID, DIFFS, DIFF_NAME, DIFF_EN, buildChart, bestOf, bestStars, recordResult, diffOpen } from './rhythm-songs';
import type { Song, Diff, Chart, Note } from './rhythm-songs';

export interface LessonResult { song: string; diff: Diff; score: number; stars: number; acc: number; perfect: number; good: number; miss: number; maxCombo: number; newBest: boolean }
export interface LessonOpts {
  /** who teaches (their comments): 'ngaio' by default */
  teacher?: string;
  teacherName?: string;
  /** start straight into a song (skips the song choice) */
  song?: string;
  diff?: Diff;
  /** music to restore afterwards */
  music?: Music;
  /** a single performance (the festival): no song choice, no replay */
  once?: boolean;
}

// ------------------------------------------------------------------ palette
const C = {
  ink: hx('#0c0810'), ink2: hx('#1a1018'),
  paper: hx('#f0e2c0'), paper2: hx('#d8c49a'), paper3: hx('#b49c70'),
  wood: [hx('#1e0e08'), hx('#3a1e10'), hx('#5a3018'), hx('#7a4424'), hx('#9a5a30'), hx('#b8743e')],
  ochre: [hx('#2a0806'), hx('#4e100c'), hx('#761a12'), hx('#9a2a1a'), hx('#b83c24'), hx('#d45a34')],
  gourd: [hx('#2a1206'), hx('#4a2610'), hx('#7a4418'), hx('#a8682a'), hx('#c88c40'), hx('#e4b060')],
  skin: [hx('#5a5440'), hx('#8a826a'), hx('#b4ac90'), hx('#d4ccae'), hx('#ece6cc'), hx('#fffcec')],
  gold: hx('#f8d060'), gold2: hx('#c89020'), green: hx('#7ad870'), red: hx('#e05a3a'), grey: hx('#8a8090'), white: hx('#fff8e8'),
  paua: hx('#5ac8b0'), pounamu: hx('#3aa86a'),
};
const LANE = [
  { c: hx('#e2563a'), d: hx('#7a1e14'), l: hx('#ffb08a'), key: 'D' },
  { c: hx('#4cc070'), d: hx('#14502a'), l: hx('#b8f4b0'), key: 'F' },
  { c: hx('#f2c040'), d: hx('#7a5410'), l: hx('#fff0a8'), key: 'J' },
  { c: hx('#4cc8d8'), d: hx('#145a66'), l: hx('#b8f4ff'), key: 'K' },
];
const KEYS: Record<string, number> = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyA: 0, KeyS: 1, KeyL: 3 };

// ------------------------------------------------------------------ geometry
const HIT_Y = 128, HOR_Y = -14, CX = 128, LANE_W = 40, DEPTH = 3.2;
const laneX = (i: number) => CX + (i - 1.5) * LANE_W;
/** z 0 (at the pads) .. 1 (far up the highway) -> screen point */
const proj = (x: number, z: number): [number, number] => { const d = 1 + z * DEPTH; return [CX + (x - CX) / d, HOR_Y + (HIT_Y - HOR_Y) / d]; };
const zOfY = (y: number) => ((HIT_Y - HOR_Y) / (y - HOR_Y) - 1) / DEPTH;
const NECK_Y = 150;
/** where on the neck the left hand frets for a lane */
const fretX = (i: number) => 52 + i * 44;

// ------------------------------------------------------------------ raster helpers
type Buf = Uint32Array;
const rect = (b: Buf, x: number, y: number, w: number, h: number, c: number) => { for (let j = Math.max(0, y | 0); j < Math.min(CH, (y + h) | 0); j++) for (let i = Math.max(0, x | 0); i < Math.min(CW, (x + w) | 0); i++) b[j * CW + i] = c; };
/** translucent by ordered dither (stays pixel art: no in-between colours) */
const drect = (b: Buf, x: number, y: number, w: number, h: number, c: number, a: number) => { for (let j = Math.max(0, y | 0); j < Math.min(CH, (y + h) | 0); j++) for (let i = Math.max(0, x | 0); i < Math.min(CW, (x + w) | 0); i++) if (dith(i, j) < a) b[j * CW + i] = c; };
const dput = (b: Buf, x: number, y: number, c: number, a: number) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < CW && y < CH && dith(x, y) < a) b[y * CW + x] = c; };
const disc = (b: Buf, cx: number, cy: number, r: number, c: number) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(b, x, y, c); };
const ring = (b: Buf, cx: number, cy: number, r: number, w: number, c: number) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d > r - w) put(b, x, y, c); } };
const line = (b: Buf, x0: number, y0: number, x1: number, y1: number, c: number) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) put(b, Math.round(x0 + (x1 - x0) * i / Math.max(1, n)), Math.round(y0 + (y1 - y0) * i / Math.max(1, n)), c); };
const text = (b: Buf, s: string, x: number, y: number, c: number, o: { scale?: number; shadow?: number; outline?: number } = {}) => drawPxBuf(b, CW, CH, s, x, y, c, o);
const textC = (b: Buf, s: string, cx: number, y: number, c: number, o: { scale?: number; shadow?: number; outline?: number } = {}) => text(b, s, Math.round(cx - pxWidth(s, o.scale ?? 1) / 2), y, c, o);
/** a carved wooden plaque with a lit top edge and an inked border */
function plaque(b: Buf, x: number, y: number, w: number, h: number, o: { paper?: boolean } = {}) {
  rect(b, x - 1, y - 1, w + 2, h + 2, C.ink);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    let c: number;
    if (o.paper) c = (hash(X, Y, 3) > 0.94) ? C.paper2 : (j === 0 ? C.white : C.paper);
    else { const grain = Math.sin((Y + Math.sin(X * 0.15) * 2) * 0.9) > 0.7; c = j === 0 ? C.wood[5] : j === h - 1 ? C.wood[1] : grain ? C.wood[2] : C.wood[3]; }
    put(b, X, Y, c);
  }
  if (!o.paper) { put(b, x + 2, y + 2, C.wood[1]); put(b, x + w - 3, y + 2, C.wood[1]); put(b, x + 2, y + h - 3, C.wood[1]); put(b, x + w - 3, y + h - 3, C.wood[1]); }
}
/** a pixel star (filled when earned) */
function star(b: Buf, cx: number, cy: number, on: boolean) {
  const rows = ['....#....', '...###...', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'];
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') put(b, cx - 4 + i, cy - 4 + j, on ? (j < 3 ? C.white : j < 6 ? C.gold : C.gold2) : (j < 4 ? C.grey : C.ink2)); });
}
/** a key cap with a letter on it */
function keycap(b: Buf, x: number, y: number, label: string, hot = false) {
  const w = pxWidth(label) + 6;
  rect(b, x, y, w, 11, C.ink);
  rect(b, x + 1, y + 1, w - 2, 8, hot ? C.gold : C.paper);
  rect(b, x + 1, y + 9, w - 2, 1, hot ? C.gold2 : C.paper3);
  text(b, label, x + 3, y + 2, C.ink);
  return w;
}

// ------------------------------------------------------------------ the backdrop (painted once)
function paintBackdrop(): Buf {
  const b = new Uint32Array(CW * CH);
  const sky = [hx('#120c24'), hx('#1e1436'), hx('#2e1c44'), hx('#4a2448'), hx('#6e3044'), hx('#9a4436'), hx('#c8663a'), hx('#e89a4a')];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const t = Math.min(1, y / 86) * (sky.length - 1);
    const i = Math.floor(t), fr = t - i;
    b[y * CW + x] = fr > dith(x, y) ? sky[Math.min(sky.length - 1, i + 1)] : sky[i];
  }
  // first stars
  for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i, 1) * CW), y = Math.floor(hash(i, 2) * 40); put(b, x, y, hash(i, 3) > 0.7 ? C.white : hx('#8a7ab0')); }
  // the hills and the village roofs against the sunset: dark shapes, a rim of warm light
  const ridge = (x: number) => 70 + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.051 + 1) * 3;
  const sil = hx('#1a1020'), sil2 = hx('#24142a');
  for (let x = 0; x < CW; x++) for (let y = Math.floor(ridge(x)); y < CH; y++) b[y * CW + x] = sil2;
  const roof = (cx: number, base: number, half: number, h: number, carved: boolean) => {
    for (let y = 0; y < h; y++) { const hw = (y / h) * half; for (let x = -hw; x <= hw; x++) put(b, Math.round(cx + x), base - h + y, sil); }
    for (let y = base; y < CH; y++) for (let x = -half * 0.8; x <= half * 0.8; x++) put(b, Math.round(cx + x), y, sil);
    if (carved) { for (let y = 0; y < h; y++) { const hw = (y / h) * half; put(b, Math.round(cx - hw), base - h + y, hx('#5a1a14')); put(b, Math.round(cx + hw), base - h + y, hx('#5a1a14')); } for (let y = 0; y < 6; y++) put(b, cx, base - h - y, hx('#5a1a14')); }
  };
  roof(30, 92, 34, 26, true); roof(250, 88, 26, 20, false); roof(300, 94, 22, 18, false); roof(196, 96, 18, 14, false);
  // a nīkau against the sky
  for (let y = 40; y < 96; y++) put(b, 282 + Math.round(Math.sin(y * 0.05) * 2), y, sil);
  for (let k = 0; k < 8; k++) { const a = -Math.PI + k * (Math.PI / 7); for (let r = 0; r < 18; r++) put(b, Math.round(282 + Math.cos(a) * r), Math.round(40 + Math.sin(a) * r * 0.6 + r * r * 0.02), sil); }
  // the flax mat he sits on, lit by the fire from the left
  for (let y = 100; y < CH; y++) for (let x = 0; x < CW; x++) {
    const weave = ((Math.floor(x / 3) + Math.floor(y / 3)) & 1) ? (x % 3 === 0 ? 0 : 1) : (y % 3 === 0 ? 0 : 1);
    const lit = Math.max(0, 1 - Math.hypot(x - 10, (y - 120) * 1.6) / 220) * 1.4 + (y - 100) / 160;
    const ramp = [hx('#1a120a'), hx('#2e2010'), hx('#4a3418'), hx('#6a4c22'), hx('#8a6a32')];
    const v = Math.min(4, Math.max(0, Math.floor(lit * 3.2 + weave + dith(x, y) * 0.9)));
    b[y * CW + x] = ramp[v];
  }
  return b;
}

/** the hue kiri across his knees: the gourd at the right, the neck running off to the left */
function paintInstrument(b: Buf) {
  // the neck: dark carved wood with flax-bound frets, ending off-screen left in the serpent head
  for (let x = -4; x < 236; x++) {
    const yc = NECK_Y + (236 - x) * 0.02;
    for (let j = -5; j <= 5; j++) {
      const Y = Math.round(yc + j);
      let c = j < -3 ? C.wood[4] : j > 3 ? C.wood[1] : C.wood[j < 0 ? 3 : 2];
      if ((x * 3 + Y) % 23 === 0) c = C.wood[1];
      put(b, x, Y, c);
    }
    put(b, x, Math.round(yc - 6), C.ink); put(b, x, Math.round(yc + 6), C.ink);
  }
  for (let i = 0; i < 4; i++) for (const dx of [-21, 21]) {
    const x = fretX(i) + dx;
    for (let j = -5; j <= 5; j++) put(b, x, Math.round(NECK_Y + (236 - x) * 0.02 + j), (j + x) % 2 ? hx('#c8a860') : hx('#8a7038'));
  }
  // the carved serpent head at the end of the neck (just in view)
  for (let y = -8; y <= 8; y++) for (let x = 0; x < 14; x++) { const r = 8 - x * 0.4; if (Math.abs(y) < r) put(b, x, NECK_Y + 4 + y, x < 2 ? C.ink : C.wood[3 - (y > 2 ? 1 : 0)]); }
  put(b, 6, NECK_Y + 1, C.paua); put(b, 7, NECK_Y + 1, C.white);
  // the gourd body
  const gx = 268, gy = 158, rx = 58, ry = 42;
  for (let y = gy - ry; y <= gy + ry; y++) for (let x = gx - rx; x <= gx + rx; x++) {
    const nx = (x - gx) / rx, ny = (y - gy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = 3.4 - nx * 1.2 - ny * 1.4 + (Math.sin(x * 0.5 + y * 0.2) > 0.9 ? -0.6 : 0);
    put(b, x, y, d > 0.92 ? C.ink : C.gourd[Math.max(0, Math.min(5, Math.round(l + dith(x, y) - 0.5)))]);
  }
  // the serpent-skin face: pale with a net of diamond scales, a tāniko cord round its rim
  const fx = gx - 6, fy = gy - 4, frx = 44, fry = 32;
  for (let y = fy - fry; y <= fy + fry; y++) for (let x = fx - frx; x <= fx + frx; x++) {
    const nx = (x - fx) / frx, ny = (y - fy) / fry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const u = (x + y) / 5, v = (x - y) / 5;
    const edge = Math.abs(u - Math.round(u)) < 0.12 || Math.abs(v - Math.round(v)) < 0.12;
    const l = 3.8 - nx * 0.8 - ny * 0.9;
    let c = C.skin[Math.max(0, Math.min(5, Math.round(l + (dith(x, y) - 0.5) * 0.35 - (edge ? 1.4 : 0))))];
    if (d > 0.9) { const k = Math.floor(Math.atan2(ny, nx) * 12 + 40) % 3; c = k === 0 ? C.ink : k === 1 ? C.ochre[3] : C.paper; }
    put(b, x, y, c);
  }
  // the bridge where the strings cross the skin
  rect(b, gx - 2, gy - 18, 6, 26, C.wood[2]); rect(b, gx - 2, gy - 18, 6, 1, C.wood[4]);
}
/** the two strings, from the bridge up the neck (shivering when plucked) */
function drawStrings(b: Buf, t: number, shiver: number[]) {
  for (let s = 0; s < 2; s++) {
    const y0 = NECK_Y - 2 + s * 4;
    for (let x = 4; x < 268; x++) {
      const yb = y0 + (236 - Math.min(x, 236)) * 0.02 + (x > 236 ? (x - 236) * 0.05 : 0);
      let a = 0;
      for (let i = 0; i < 4; i++) if (shiver[i] > 0) a += Math.sin(x * 0.6 + t * 80) * shiver[i] * 1.5 * Math.max(0, 1 - Math.abs(x - fretX(i)) / 160);
      put(b, x, Math.round(yb + a), s ? hx('#d8ccb0') : hx('#f4ead0'));
    }
  }
}

// ------------------------------------------------------------------ teacher lines
const T = {
  start: ['Shoulders down. Breathe. Let the song come to you.', 'Watch the scales coming. Pluck when they touch the pāua.', 'Gentle hands. It’s a skin, not a drum. Well. It’s both.'],
  streak: ['Ka pai! That’s it!', 'Yes! You’re in the river now.', 'Tino pai! Keep that.', 'Listen to you! Koro will be jealous.', 'Kia kaha, keep going!'],
  miss: ['Breathe. The song waits for you.', 'Auē, my ears! Again, slower in your head.', 'Don’t chase it. Let it arrive.', 'You played that like you were swatting sandflies.', 'Eyes on the pāua, not on your fingers.'],
  half: ['Halfway. Don’t think about it.', 'The middle is where everyone rushes. Don’t.'],
  end3: ['Tino pai rawa atu! You made it sing. Hinerua heard that, I promise.', 'E hoa... that was beautiful. You can play at the festival.'],
  end2: ['Ka pai! A few stones in the river, but it flowed.', 'Good! Again tomorrow and it’ll be lovely.'],
  end1: ['You got through it. That counts. Practise, practise.', 'Not bad for a man with a camera instead of hands.'],
  end0: ['Auē. Well. Everyone sounds like that at first. Mostly.', 'The pigs liked it. The pigs are not a good sign.'],
};
const pick = <T0>(a: T0[]) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------ the game
type Phase = 'select' | 'intro' | 'count' | 'play' | 'result';
interface Spark { x: number; y: number; vx: number; vy: number; life: number; c: number }
interface Pop { text: string; x: number; y: number; t: number; c: number }

export async function runHueKiri(o: LessonOpts = {}): Promise<LessonResult | null> {
  const cu: Closeup = openCloseup();
  cu.cv.style.animation = 'none';
  const teacherName = (o.teacherName ?? 'Aunty Ngaio').toUpperCase();
  const prevMusic = o.music;
  audio.setMusic('none');
  const synth = new KiriSynth();
  const bg = paintBackdrop();
  paintInstrument(bg);
  const buf = cu.buf;
  // the hands: right plucks over the skin, left frets on the neck
  let hands: HandsController | null = null;
  try { hands = HANDS3D.enabled ? closeupHands(cu, { who: 'mori', side: 'both', lights: 'campfire', scale: 2.3 }) : null; } catch { hands = null; }
  hands?.right?.shoulderAt(380, 330, 90);
  hands?.left?.shoulderAt(-60, 330, 90);

  // ---------------------------------------------------------------- state
  const songs = SONGS;
  let phase: Phase = o.song ? 'intro' : 'select';
  let sel = Math.max(0, songs.findIndex(s => s.id === (o.song ?? songs.find(x => x.unlocked())?.id ?? 'awa')));
  let diff: Diff = o.diff ?? 'normal';
  let chart: Chart | null = null;
  let song: Song = songs[sel];
  let t0 = 0, clock = 0, useAudio = false, perfStart = 0;
  let score = 0, combo = 0, maxCombo = 0, perfect = 0, good = 0, miss = 0, mana = 0.5, streakMiss = 0;
  const shiver = [0, 0, 0, 0], padHot = [0, 0, 0, 0], padBad = [0, 0, 0, 0];
  const down = [false, false, false, false];
  const sparks: Spark[] = [];
  const pops: Pop[] = [];
  let say: { text: string; t: number } | null = null;
  let introT = 0, resultT = 0, lastStep = -1, halfSaid = false, newBest = false, nextPraise = 10;
  let result: LessonResult | null = null;
  let quit = false, leaving = false;
  let pluckT = 0, pluckLane = 0, countBeat = -1;
  const speak = (s: string) => { say = { text: s, t: 0 }; };
  const laneP: (Pop | null)[] = [null, null, null, null];
  const popAt = (lane: number, p: Pop) => { const old = laneP[lane]; if (old) { const i = pops.indexOf(old); if (i >= 0) pops.splice(i, 1); } laneP[lane] = p; pops.push(p); };
  const win = () => diff === 'easy' ? { perf: 0.075, good: 0.16 } : diff === 'hard' ? { perf: 0.045, good: 0.1 } : { perf: 0.06, good: 0.13 };
  const lead = () => (diff === 'easy' ? 2.3 : diff === 'hard' ? 1.55 : 1.9);

  const now = () => (useAudio ? (synth.now() ?? 0) - t0 : (performance.now() - perfStart) / 1000);
  function start() {
    song = songs[sel];
    chart = buildChart(song, diff);
    score = 0; combo = 0; maxCombo = 0; perfect = 0; good = 0; miss = 0; mana = 0.5; streakMiss = 0; lastStep = -1; halfSaid = false; nextPraise = 10;
    const a = synth.now();
    useAudio = a !== null;
    // the song starts after a four-beat count-in
    const countIn = chart.spb * 4 + 0.4;
    if (useAudio) t0 = (a as number) + countIn; else perfStart = performance.now() + countIn * 1000;
    phase = 'count';
    synth.droneOn(song.root);
    speak(pick(T.start));
    countBeat = -1;
  }

  function judge(lane: number) {
    if (phase !== 'play' || !chart) return;
    padHot[lane] = 1;
    const tt = now(), w = win();
    let best: Note | null = null;
    for (const n of chart.notes) {
      if (n.hit || n.lane !== lane) continue;
      const d = Math.abs(tt - n.t);
      if (d <= w.good && (!best || d < Math.abs(tt - best.t))) best = n;
      if (n.t > tt + w.good) break;
    }
    pluckT = 0.14; pluckLane = lane;
    if (!best) {
      // a stray pluck: a dead note (it only breaks the combo above the gentle songs)
      synth.dud(song.root - 12);
      padBad[lane] = 0.4;
      if (diff !== 'easy') { combo = 0; }
      return;
    }
    const d = Math.abs(tt - best.t);
    best.hit = d <= w.perf ? 'perfect' : 'good';
    best.held = 0;
    const mult = 1 + Math.min(3, Math.floor(combo / 10));
    if (best.hit === 'perfect') { perfect++; score += 100 * mult; mana = Math.min(1, mana + 0.04); }
    else { good++; score += 50 * mult; mana = Math.min(1, mana + 0.02); }
    combo++; streakMiss = 0;
    maxCombo = Math.max(maxCombo, combo);
    synth.pluck(best.midi, 0, 0.55, best.hit === 'perfect' ? 1 : 0.6);
    shiver[lane] = 1;
    const [px] = proj(laneX(lane), 0);
    popAt(lane, { text: best.hit === 'perfect' ? 'TINO PAI!' : 'PAI', x: px, y: HIT_Y - 16, t: 0, c: best.hit === 'perfect' ? C.gold : C.green });
    for (let i = 0; i < (best.hit === 'perfect' ? 14 : 7); i++) sparks.push({ x: px, y: HIT_Y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90 - 20, life: 0.5 + Math.random() * 0.4, c: Math.random() < 0.5 ? LANE[lane].l : C.white });
    if (combo >= nextPraise) { nextPraise += 15; speak(pick(T.streak)); }
  }
  function missNote(n: Note) {
    n.hit = 'miss';
    miss++; combo = 0; streakMiss++;
    mana = Math.max(0, mana - 0.06);
    padBad[n.lane] = 1;
    const [px] = proj(laneX(n.lane), 0);
    popAt(n.lane, { text: 'AUĒ', x: px, y: HIT_Y - 14, t: 0, c: C.grey });
    if (streakMiss === 4) speak(pick(T.miss));
    synth.thump(synth.now() ?? 0, 0.12, 70);
  }
  function finish() {
    if (!chart) return;
    const total = Math.max(1, chart.notes.length);
    const acc = (perfect + good * 0.6) / total;
    const stars = acc >= 0.93 ? 3 : acc >= 0.78 ? 2 : acc >= 0.58 ? 1 : 0;
    newBest = recordResult(song.id, diff, score, stars, acc);
    result = { song: song.id, diff, score, stars, acc, perfect, good, miss, maxCombo, newBest };
    phase = 'result';
    resultT = 0;
    synth.droneOff();
    speak(pick(stars === 3 ? T.end3 : stars === 2 ? T.end2 : stars === 1 ? T.end1 : T.end0));
    audio.play(stars >= 1 ? 'star' : 'uiBack', { vol: 0.5 });
  }

  // ---------------------------------------------------------------- input
  const unlockedAt = (i: number) => songs[i].unlocked();
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) { if (e.code in KEYS) e.preventDefault(); return; }
    const k = e.code;
    if (phase === 'select') {
      if (k === 'ArrowUp' || k === 'KeyW') { sel = (sel + songs.length - 1) % songs.length; audio.play('ui', { vol: 0.3 }); }
      else if (k === 'ArrowDown' || k === 'KeyS') { sel = (sel + 1) % songs.length; audio.play('ui', { vol: 0.3 }); }
      else if (k === 'ArrowLeft' || k === 'KeyA') { const i = DIFFS.indexOf(diff); diff = DIFFS[Math.max(0, i - 1)]; audio.play('ui', { vol: 0.3 }); }
      else if (k === 'ArrowRight' || k === 'KeyD') { const i = DIFFS.indexOf(diff); const nd = DIFFS[Math.min(2, i + 1)]; if (diffOpen(songs[sel].id, nd)) diff = nd; else audio.play('wrong', { vol: 0.3 }); audio.play('ui', { vol: 0.3 }); }
      else if (k === 'Enter' || k === 'Space' || k === 'KeyE') { if (unlockedAt(sel)) { phase = 'intro'; introT = 0; song = songs[sel]; speak(song.intro); audio.play('uiOpen', { vol: 0.4 }); } else audio.play('wrong', { vol: 0.4 }); }
      else if (k === 'Escape') quit = true;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (phase === 'intro') { if (k === 'Enter' || k === 'Space' || k === 'KeyE') start(); else if (k === 'Escape') { if (o.song) quit = true; else phase = 'select'; } e.preventDefault(); e.stopPropagation(); return; }
    if (phase === 'result') {
      if (resultT < 0.8) return;
      if ((k === 'Enter' || k === 'Space' || k === 'KeyR') && !o.once) { phase = 'intro'; introT = 0; speak(song.intro); }
      else if (k === 'Escape' || k === 'KeyE' || ((k === 'Enter' || k === 'Space') && o.once)) quit = true;
      else if (k === 'KeyM' && !o.once) phase = 'select';
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (k === 'Escape') { quit = true; e.preventDefault(); e.stopPropagation(); return; }
    if (k in KEYS) { const l = KEYS[k]; if (!down[l]) { down[l] = true; judge(l); } e.preventDefault(); e.stopPropagation(); }
  };
  const onUp = (e: KeyboardEvent) => { if (e.code in KEYS) { down[KEYS[e.code]] = false; e.preventDefault(); } };
  const toCanvas = (e: PointerEvent): [number, number] => { const r = cu.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * CW, ((e.clientY - r.top) / r.height) * CH]; };
  const pdown = new Map<number, number>();
  const onPD = (e: PointerEvent) => {
    const [x, y] = toCanvas(e);
    if (phase === 'select') {
      for (let i = 0; i < songs.length; i++) if (y >= 44 + i * 22 && y < 44 + i * 22 + 20 && x > 54 && x < 266) { if (sel === i && unlockedAt(i)) { phase = 'intro'; introT = 0; song = songs[i]; speak(song.intro); } sel = i; return; }
      DIFFS.forEach((d, i) => { if (y >= 140 && y < 152 && x >= 70 + i * 62 && x < 70 + i * 62 + 58 && diffOpen(songs[sel].id, d)) diff = d; });
      if (y >= 158 && y < 172 && x > 120 && x < 200 && unlockedAt(sel)) { phase = 'intro'; introT = 0; song = songs[sel]; speak(song.intro); }
      return;
    }
    if (phase === 'intro') { start(); return; }
    if (phase === 'result') { if (resultT > 0.8) { if (o.once || y > 150) quit = true; else { phase = 'intro'; introT = 0; speak(song.intro); } } return; }
    if (phase === 'play' && y > 40) {
      let best = 0, bd = 1e9;
      for (let i = 0; i < 4; i++) { const [px] = proj(laneX(i), Math.max(0, zOfY(Math.min(HIT_Y, y)))); const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } }
      pdown.set(e.pointerId, best);
      down[best] = true;
      judge(best);
    }
  };
  const onPU = (e: PointerEvent) => { const l = pdown.get(e.pointerId); if (l !== undefined) { down[l] = false; pdown.delete(e.pointerId); } };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onUp, true);
  cu.wrap.addEventListener('pointerdown', onPD);
  window.addEventListener('pointerup', onPU);
  if (phase === 'intro') { song = songs[sel]; speak(song.intro); }

  // ---------------------------------------------------------------- the frame
  const draw = (t: number, dt: number) => {
    buf.set(bg);
    // the fire's light flickers on the mat
    const fl = 0.5 + 0.5 * Math.sin(t * 9) * Math.sin(t * 3.3);
    for (let i = 0; i < 26; i++) { const x = Math.floor(hash(i, 9) * 60), y = 104 + Math.floor(hash(i, 8) * 70); dput(buf, x, y, hx('#c88a40'), 0.25 * fl); }
    // embers drifting up on the left
    for (let i = 0; i < 10; i++) { const ph = (t * 0.3 + hash(i, 4)) % 1; put(buf, Math.floor(8 + hash(i, 5) * 30 + Math.sin(t + i) * 4), Math.floor(130 - ph * 120), ph < 0.7 ? C.gold : C.ochre[4]); }
    if (phase === 'play' || phase === 'count' || phase === 'result') drawHighway(t);
    drawStrings(buf, t, shiver);
    drawPads(t);
    if (!(hands?.ready3d)) drawPixelHands(t);
    drawHud(t);
    if (phase === 'select') drawSelect(t);
    if (phase === 'intro') drawIntro(t);
    if (phase === 'result') drawResult(t);
    drawSay(dt);
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; s.vy += 180 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0) { sparks.splice(i, 1); continue; } put(buf, s.x, s.y, s.c); if (s.life > 0.3) put(buf, s.x + 1, s.y, s.c); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 0.7) { pops.splice(i, 1); continue; } const k = p.y < 90 ? 2 : 1; textC(buf, p.text, p.x, p.y - p.t * 18, p.c, { scale: k, outline: C.ink }); }
  };

  function drawHighway(t: number) {
    // the lanes: a serpent's back sliding toward Mori, its scales moving with the song
    const scroll = phase === 'play' || phase === 'count' ? now() : 0;
    for (let y = 2; y <= HIT_Y + 6; y++) {
      const z = Math.max(0, zOfY(Math.min(y, HIT_Y)));
      const [xl] = proj(laneX(0) - LANE_W / 2, z), [xr] = proj(laneX(3) + LANE_W / 2, z);
      for (let x = Math.floor(xl); x <= Math.ceil(xr); x++) {
        const u = (x - xl) / Math.max(1, xr - xl);
        const lane = Math.min(3, Math.floor(u * 4));
        const depthT = z * 6 + scroll * (song.bpm / 60) * 0.5;
        const lu = u * 4 - lane;
        const sv = depthT * 2 + (lane & 1) * 0.5, su = lu * 3;
        const net = Math.abs(((sv + su) % 1 + 1) % 1 - 0.5) < 0.06 || Math.abs(((sv - su) % 1 + 1) % 1 - 0.5) < 0.06;
        const edge = Math.abs(u * 4 - Math.round(u * 4)) < 0.03 * (1 + z * 3);
        const fade = 1 - z * 0.6;
        if (x === Math.floor(xl) || x === Math.ceil(xr)) { put(buf, x, y, C.ink); continue; }
        if (edge) { dput(buf, x, y, LANE[lane].c, 0.75 * fade); continue; }
        if (dith(x, y) < 0.86 * fade + 0.1) put(buf, x, y, net ? LANE[lane].d : C.ink2);
      }
    }
    // beat lines across the back
    if (chart) {
      const tt = now();
      for (let k = Math.ceil(tt / chart.spb); k * chart.spb < tt + lead(); k++) {
        const z = (k * chart.spb - tt) / lead();
        if (z < 0 || z > 1) continue;
        const [xl, y] = proj(laneX(0) - LANE_W / 2, z), [xr] = proj(laneX(3) + LANE_W / 2, z);
        for (let x = Math.ceil(xl) + 1; x < xr; x++) dput(buf, x, y, k % 4 === 0 ? C.paper2 : C.paper3, k % 4 === 0 ? 0.6 : 0.3);
      }
      // the notes: held tails first, then the scales
      for (const n of chart.notes) {
        if (n.hit === 'miss' && tt - n.t > 0.3) continue;
        const z0 = (n.t - tt) / lead();
        if (z0 > 1.05) break;
        if (n.hold > 0) {
          const zEnd = Math.min(1, (n.t + n.hold - tt) / lead());
          const zs = n.hit && n.hit !== 'miss' ? Math.max(0, z0) : z0;
          if (zEnd > 0 && zEnd > zs) {
            const [, ya] = proj(laneX(n.lane), Math.max(0, zs)), [, yb] = proj(laneX(n.lane), zEnd);
            for (let y = Math.floor(yb); y <= Math.ceil(ya); y++) {
              const z = Math.max(0, zOfY(y));
              const [x] = proj(laneX(n.lane), z);
              const w = Math.max(1, 4 / (1 + z * DEPTH));
              const holding = n.hit && n.hit !== 'miss' && down[n.lane];
              for (let dx = -w; dx <= w; dx++) put(buf, x + dx, y, (Math.floor(y + t * 30) & 3) === 0 ? LANE[n.lane].l : holding ? LANE[n.lane].l : LANE[n.lane].c);
            }
          }
        }
        if ((n.hit && n.hit !== 'miss') || z0 < -0.08) continue;
        const [x, y] = proj(laneX(n.lane), Math.max(-0.08, z0));
        const s = 12 / (1 + Math.max(0, z0) * DEPTH);
        drawScale(x, y, s, n.lane, n.hit === 'miss');
      }
    }
  }
  /** a gleaming diamond scale */
  function drawScale(cx: number, cy: number, s: number, lane: number, dead: boolean) {
    const L = LANE[lane];
    const r = Math.max(2, s);
    if (!dead) for (let y = -r * 0.9; y <= r * 0.9; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) { const d = Math.abs(x) / (r * 1.4) + Math.abs(y) / (r * 0.9); if (d <= 1 && d > 0.75) dput(buf, cx + x, cy + y, L.l, 0.35); }
    for (let y = -r * 0.6; y <= r * 0.6; y++) for (let x = -r; x <= r; x++) {
      const d = Math.abs(x) / r + Math.abs(y) / (r * 0.6);
      if (d > 1) continue;
      let c = d > 0.8 ? C.ink : (x + y < -r * 0.3 ? L.l : y > r * 0.15 ? L.d : L.c);
      if (dead) c = d > 0.8 ? C.ink : C.grey;
      put(buf, cx + x, cy + y, c);
    }
    if (!dead && r > 4) put(buf, cx - r * 0.3, cy - 1, C.white);
  }
  function drawPads(t: number) {
    for (let i = 0; i < 4; i++) {
      const [x] = proj(laneX(i), 0);
      const hot = padHot[i], bad = padBad[i];
      const sh = bad > 0 ? Math.round(Math.sin(t * 60) * 2 * bad) : 0;
      // a pāua-shell disc: iridescent rings, inked, in the lane's colour
      for (let y = -6; y <= 6; y++) for (let dx = -11; dx <= 11; dx++) {
        const d = Math.hypot(dx / 11, y / 6);
        if (d > 1) continue;
        const swirl = Math.sin(dx * 0.7 + y * 1.3 + t * 2 + i) > 0.3;
        let c = d > 0.86 ? C.ink : d > 0.6 ? LANE[i].c : swirl ? (down[i] ? LANE[i].l : C.paua) : (down[i] ? LANE[i].c : hx('#2a6a7a'));
        if (bad > 0.3 && d <= 0.86) c = dith(dx + 20, y + 20) < bad * 0.6 ? C.red : c;
        put(buf, x + dx + sh, HIT_Y + y, c);
      }
      if (hot > 0) ring(buf, x, HIT_Y, 12 + (1 - hot) * 8, 1, LANE[i].l);
      padHot[i] = Math.max(0, hot - 0.08);
      padBad[i] = Math.max(0, bad - 0.05);
      shiver[i] = Math.max(0, shiver[i] - 0.04);
      if (phase === 'play' || phase === 'count') keycap(buf, x - 4, HIT_Y + 8, LANE[i].key, down[i]);
    }
  }
  /** the old flat hands, while the 3D ones are still being built */
  function drawPixelHands(t: number) {
    const sk = [hx('#5e3624'), hx('#8a5434'), hx('#b07a52'), hx('#cc9870')];
    const lx = fretX(pluckLane) + (pluckT > 0 ? 0 : Math.sin(t * 2) * 2);
    for (let y = -7; y <= 7; y++) for (let x = -9; x <= 9; x++) if ((x / 9) ** 2 + (y / 7) ** 2 <= 1) put(buf, lx + x, NECK_Y - 6 + y, sk[Math.max(0, Math.min(3, Math.round(2.6 - x / 9 - y / 7)))]);
    for (let k = 0; k < 4; k++) line(buf, lx - 6 + k * 4, NECK_Y - 10, lx - 6 + k * 4, NECK_Y - 3, sk[1]);
    const rx = 252, ry = 140 + (pluckT > 0 ? 4 : 0);
    for (let y = -8; y <= 8; y++) for (let x = -10; x <= 10; x++) if ((x / 10) ** 2 + (y / 8) ** 2 <= 1) put(buf, rx + x, ry + y, sk[Math.max(0, Math.min(3, Math.round(2.6 - x / 10 - y / 8)))]);
  }
  function drawHud(t: number) {
    if (phase === 'select') return;
    // the score plaque, top left: carved wood, the score and the multiplier badge
    plaque(buf, 6, 6, 74, 26);
    text(buf, 'KAUTE', 11, 9, C.wood[1]);
    text(buf, String(score).padStart(6, '0'), 11, 18, C.paper, { shadow: C.wood[0] });
    const mult = 1 + Math.min(3, Math.floor(combo / 10));
    disc(buf, 70, 19, 8, C.ink); disc(buf, 70, 19, 7, mult > 1 ? C.paua : C.wood[2]);
    textC(buf, 'x' + mult, 70, 16, C.white, { shadow: C.ink });
    if (combo >= 2) { text(buf, String(combo), 9, 36, C.gold, { outline: C.ink, scale: combo >= 10 ? 2 : 1 }); text(buf, 'COMBO', 12 + pxWidth(String(combo), combo >= 10 ? 2 : 1), combo >= 10 ? 43 : 38, C.paper, { outline: C.ink }); }
    // the mana gauge down the left: a carved frame, pounamu filling it
    const gx = 8, gy = 58, gh = 64;
    rect(buf, gx - 1, gy - 1, 10, gh + 2, C.ink);
    rect(buf, gx, gy, 8, gh, C.wood[2]);
    const fill = Math.round(gh * mana);
    for (let y = 0; y < fill; y++) for (let x = 1; x < 7; x++) put(buf, gx + x, gy + gh - 1 - y, (x + y) % 5 === 0 ? hx('#9af0b8') : y > fill - 3 ? hx('#b8ffd0') : x < 3 ? hx('#5ad08a') : C.pounamu);
    for (let y = 0; y < gh; y += 8) put(buf, gx + 7, gy + y, C.wood[4]);
    text(buf, 'MANA', 3, gy + gh + 4, C.paper, { outline: C.ink });
    // the song plate, top right, with its progress: a little serpent travelling along a cord
    plaque(buf, 214, 6, 100, 24, { paper: true });
    text(buf, song.name, 219, 9, C.ink);
    if (chart) {
      const total = chart.beats * chart.spb, k = Math.max(0, Math.min(1, now() / total));
      line(buf, 219, 23, 308, 23, C.paper3);
      const sx = 219 + k * 89;
      rect(buf, sx - 3, 21, 7, 4, C.pounamu); put(buf, sx + 3, 22, C.ink); put(buf, sx + 4, 23, C.red);
      void t;
    }
  }
  function drawSay(dt: number) {
    if (!say) return;
    say.t += dt;
    const life = phase === 'select' ? 1e9 : phase === 'intro' ? 1e9 : 4.2;
    if (say.t > life) { say = null; return; }
    // a paper card with the teacher's name tab, the translator's tag
    const lines = pxWrap(say.text, 150);
    const w = 160, h = 10 + lines.length * 10, x = phase === 'select' ? 80 : 98, y = phase === 'result' ? 8 : phase === 'select' ? 6 : 36;
    const pop = Math.min(1, say.t * 8);
    if (pop < 1 && Math.floor(say.t * 40) % 2) return;
    rect(buf, x + 3, y + 3, w, h, C.ink2);
    plaque(buf, x, y, w, h, { paper: true });
    // the tail pointing down-left toward the teacher (off screen, on the left)
    for (let i = 0; i < 5; i++) { put(buf, x + 10 - i, y + h + i, C.ink); for (let j = 0; j < 4 - i; j++) put(buf, x + 11 - i + j, y + h + i - 1, C.paper); }
    rect(buf, x + 2, y - 7, pxWidth(teacherName) + 6, 8, C.ink);
    text(buf, teacherName, x + 5, y - 6, C.paua);
    rect(buf, x + w - 30, y - 5, 28, 6, hx('#10201c'));
    put(buf, x + w - 28, y - 3, C.green); put(buf, x + w - 27, y - 3, C.green);
    drawPxBuf(buf, CW, CH, 'J-TRANS', x + w - 25, y - 4, hx('#9dffd8'), { scale: 1 } as never);
    lines.forEach((l, i) => text(buf, l, x + 5, y + 5 + i * 10, C.ink));
  }
  function drawSelect(t: number) {
    drect(buf, 0, 0, CW, CH, C.ink, 0.45);
    plaque(buf, 50, 30, 220, 146, { paper: false });
    textC(buf, 'HUE KIRI', 160, 34, C.paper, { outline: C.wood[0] });
    songs.forEach((s, i) => {
      const y = 44 + i * 22, on = i === sel, open = s.unlocked();
      rect(buf, 56, y, 208, 20, on ? C.paper : C.paper3);
      rect(buf, 56, y + 19, 208, 1, C.ink);
      if (on) { rect(buf, 56, y, 3, 20, C.ochre[4]); text(buf, '→', 60, y + 6, C.ochre[3]); }
      text(buf, s.name, 70, y + 3, open ? C.ink : C.wood[2]);
      text(buf, open ? s.en : s.lockText, 70, y + 11, open ? C.wood[2] : C.wood[2]);
      if (open) for (let k = 0; k < 3; k++) star(buf, 232 + k * 10, y + 9, bestStars(s.id) > k);
      else { rect(buf, 246, y + 5, 9, 7, C.gold2); ring(buf, 250, y + 5, 3, 1, C.wood[2]); }
    });
    // difficulty tabs
    DIFFS.forEach((d, i) => {
      const x = 70 + i * 62, on = d === diff, open = diffOpen(songs[sel].id, d);
      rect(buf, x, 140, 58, 13, C.ink);
      rect(buf, x + 1, 141, 56, 11, on ? C.gold : open ? C.paper2 : C.wood[2]);
      textC(buf, DIFF_NAME[d], x + 29, 143, open ? C.ink : C.wood[1]);
    });
    text(buf, `(${DIFF_EN[diff]})`, 160 - pxWidth(`(${DIFF_EN[diff]})`) / 2, 155, C.paper2);
    const b0 = bestOf(songs[sel].id, diff);
    if (b0) text(buf, 'BEST ' + b0.score, 214, 155, C.paper2);
    const blink = Math.floor(t * 2) % 2 === 0;
    let kx = 92;
    kx += keycap(buf, kx, 163, 'ENTER', blink) + 3; text(buf, 'play', kx, 165, C.paper); kx += 28;
    kx += keycap(buf, kx, 163, 'ESC') + 3; text(buf, 'put it down', kx, 165, C.paper);
  }
  function drawIntro(t: number) {
    drect(buf, 0, 0, CW, CH, C.ink, 0.3);
    plaque(buf, 70, 96, 180, 26, { paper: true });
    textC(buf, song.name, 160, 100, C.ink, { scale: 1 });
    textC(buf, `${song.en} · ${DIFF_NAME[diff]}`, 160, 110, C.wood[2]);
    if (Math.floor(t * 2) % 2 === 0) { const w = keycap(buf, 118, 128, 'ENTER', true); text(buf, 'begin', 121 + w, 130, C.paper, { outline: C.ink }); }
  }
  function drawResult(t: number) {
    if (!result) return;
    const k = Math.min(1, resultT * 3);
    drect(buf, 0, 0, CW, CH, C.ink, 0.5 * k);
    if (k < 1) return;
    plaque(buf, 70, 46, 180, 112);
    textC(buf, song.name, 160, 50, C.paper, { outline: C.wood[0] });
    for (let i = 0; i < 3; i++) star(buf, 140 + i * 20, 70, result.stars > i && resultT > 0.5 + i * 0.25);
    const rows: [string, string, number][] = [['TINO PAI', String(result.perfect), C.gold], ['PAI', String(result.good), C.green], ['AUĒ', String(result.miss), C.grey], ['COMBO', String(result.maxCombo), C.paper], ['KAUTE', String(result.score), C.paper]];
    rows.forEach(([a, v, c], i) => { text(buf, a, 84, 82 + i * 11, c, { outline: C.ink }); text(buf, v, 236 - pxWidth(v), 82 + i * 11, C.paper, { outline: C.ink }); });
    textC(buf, Math.round(result.acc * 100) + '%', 160, 138, C.white, { scale: 1, outline: C.ink });
    if (result.newBest && Math.floor(t * 3) % 2 === 0) textC(buf, 'NEW BEST!', 160, 128, C.gold, { outline: C.ink });
    if (resultT > 0.8) {
      let kx = o.once ? 120 : 82;
      if (!o.once) { kx += keycap(buf, kx, 162, 'ENTER') + 3; text(buf, 'again', kx, 164, C.paper, { outline: C.ink }); kx += 30; kx += keycap(buf, kx, 162, 'M') + 3; text(buf, 'songs', kx, 164, C.paper, { outline: C.ink }); kx += 30; }
      kx += keycap(buf, kx, 162, 'ESC') + 3; text(buf, 'done', kx, 164, C.paper, { outline: C.ink });
    }
  }

  // ---------------------------------------------------------------- the 3D hands follow the music
  let lFret = 1;
  const handsFrame = (dt: number, t: number) => {
    if (!hands) return;
    const R0 = hands.right, L0 = hands.left;
    pluckT = Math.max(0, pluckT - dt);
    const pk = pluckT > 0 ? Math.sin((pluckT / 0.14) * Math.PI) : 0;
    if (R0) {
      R0.reachTo(250 - pk * 4, 132 + pk * 8, 26 - pk * 8, { with: 'index', fingers: [-0.45, 0.75, -0.3], palm: [0.15, 0.4, -0.9], follow: 18 });
      R0.curl('index', 0.25 + pk * 0.55);
      R0.curl('middle', 0.55); R0.curl('ring', 0.7); R0.curl('little', 0.75); R0.curl('thumb', 0.3);
    }
    if (L0) {
      if (pluckT > 0.1) lFret = pluckLane;
      const fx = fretX(lFret) + Math.sin(t * 1.3) * 1.2;
      L0.reachTo(fx, NECK_Y - 9, 18, { with: 'middle', fingers: [0.35, -0.9, -0.25], palm: [0, 0.2, -1], follow: 10 });
      const press = down.some(Boolean) ? 0.75 : 0.45;
      L0.curl('index', press); L0.curl('middle', press + 0.05); L0.curl('ring', press + 0.1); L0.curl('little', press + 0.1); L0.curl('thumb', 0.4);
    }
    hands.frame(dt);
  };

  // ---------------------------------------------------------------- the loop
  const out = await new Promise<LessonResult | null>(done => {
    loop((dt, t) => {
      if (cu.closed) { done(result); return false; }
      if (phase === 'intro') introT += dt;
      if (phase === 'result') resultT += dt;
      if ((phase === 'count' || phase === 'play') && chart) {
        const tt = now();
        // the band: schedule the next eighths a little ahead on the audio clock
        const e8 = chart.spb / 2, step = Math.floor((tt + 0.12) / e8);
        for (let s = Math.max(lastStep + 1, Math.floor(-chart.spb * 4 / e8)); s <= step; s++) {
          const at = (useAudio ? t0 : 0) + s * e8;
          const when = useAudio ? Math.max(at, synth.now() ?? 0) : 0;
          if (s < 0) { if (s % 2 === 0) synth.count(when, (s / 2) % 4 === 0); }
          else if (s < chart.beats * 2) {
            const g = song.groove[s % 8];
            if (g) synth.pahu(when, g === 2 ? 1 : 0.6);
            if (s % 2 === 1) synth.tokere(when, 0.08);
            synth.shaker(when, s % 2 ? 0.03 : 0.05);
          }
          lastStep = s;
        }
        if (phase === 'count' && tt >= 0) phase = 'play';
        if (phase === 'count') {
          const beat = Math.floor((tt + chart.spb * 4) / chart.spb);
          const words = ['TAHI', 'RUA', 'TORU', 'WHĀ'];
          if (beat >= 0 && beat < 4 && beat !== countBeat) { countBeat = beat; pops.push({ text: words[beat], x: CX, y: 70, t: 0.0, c: beat === 3 ? C.gold : C.paper }); }
        }
        if (phase === 'play') {
          const w = win();
          for (const n of chart.notes) {
            if (n.t > tt + 0.2) break;
            if (!n.hit && tt - n.t > w.good) missNote(n);
            // held notes: points while the key stays down
            if (n.hit && n.hit !== 'miss' && n.hold > 0 && !n.done) {
              if (tt > n.t + n.hold) { n.done = true; if (down[n.lane]) { score += 50; sparks.push({ x: proj(laneX(n.lane), 0)[0], y: HIT_Y, vx: 0, vy: -60, life: 0.6, c: C.gold }); } }
              else if (down[n.lane] && tt > n.t) { n.held = (n.held ?? 0) + dt; score += Math.round(dt * 60 * (1 + Math.min(3, Math.floor(combo / 10)))); shiver[n.lane] = Math.max(shiver[n.lane], 0.5); if (Math.random() < dt * 20) sparks.push({ x: proj(laneX(n.lane), 0)[0] + (Math.random() - 0.5) * 8, y: HIT_Y - 2, vx: (Math.random() - 0.5) * 30, vy: -40, life: 0.3, c: LANE[n.lane].l }); }
              else if (tt > n.t + 0.1) n.done = true;
            }
          }
          if (!halfSaid && tt > chart.beats * chart.spb * 0.5) { halfSaid = true; if (!say) speak(pick(T.half)); }
          if (tt > chart.beats * chart.spb + 1.2) finish();
        }
      }
      draw(t, dt);
      cu.present();
      handsFrame(dt, t);
      if (quit && !leaving) {
        leaving = true;
        synth.stop();
        void cu.close().then(() => done(result));
      }
    });
  });
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('keyup', onUp, true);
  window.removeEventListener('pointerup', onPU);
  hands?.destroy();
  synth.stop();
  if (prevMusic) audio.setMusic(prevMusic);
  void mixc;
  return out;
}

/** a song by id (for other modules) */
export const songName = (id: string) => SONG_BY_ID[id]?.name ?? id;
