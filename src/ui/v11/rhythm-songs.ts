// V11 hue kiri songs: the tunes Aunty Ngaio teaches, written as melodies (one character per eighth
// note: 1-9 the degrees of the song's scale, '-' holds the note on, '.' a rest; a bar is 8), and the
// charts the lessons are played from, made from the melody per difficulty:
//   easy    the notes on the beat, on three lanes, no holds shorter than a beat
//   normal  every note of the melody on four lanes, the long ones held
//   hard    all of that, grace notes into the long notes, and two-lane chords on the downbeats
// Lanes follow the melody's contour (low notes left, high notes right), so the hands move the way
// the tune does. Progress (best score, stars) and which songs are unlocked live in the save.

import { game } from '../../game/game';
import { bucket } from '../../game/v10/store';

export type Diff = 'easy' | 'normal' | 'hard';
export const DIFFS: Diff[] = ['easy', 'normal', 'hard'];
export const DIFF_NAME: Record<Diff, string> = { easy: 'Māmā', normal: 'Waenga', hard: 'Uaua' };
export const DIFF_EN: Record<Diff, string> = { easy: 'gentle', normal: 'steady', hard: 'hard' };

export interface Song {
  id: string;
  name: string;
  en: string;
  bpm: number;
  /** midi root and scale (semitones from the root for degrees 1..9) */
  root: number;
  scale: number[];
  /** the melody, bar by bar */
  bars: string[];
  /** the band's groove: pahū hits per bar (eighths: 2 accent, 1 normal, 0 rest) */
  groove: number[];
  /** shown before it is unlocked */
  lockText: string;
  unlocked: () => boolean;
  /** Ngaio introducing it */
  intro: string;
}

const MAJ = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const MIN = [0, 3, 5, 7, 10, 12, 15, 17, 19];
const f = (k: string) => !!game.save.flags['v11v:' + k];

export const SONGS: Song[] = [
  {
    id: 'awa', name: 'Te Awa', en: 'The River', bpm: 84, root: 55, scale: MAJ,
    bars: [
      '1-3-5---', '6-5-3---', '1-3-5-6-', '5-------',
      '8-6-5---', '6-5-3-2-', '1-2-3-5-', '3-------',
      '5.5.6-5-', '3-2-1---', '5.5.6-8-', '6-------',
      '8-6-5-3-', '5-3-2---', '1-2-3-2-', '1-------',
    ],
    groove: [2, 0, 1, 0, 2, 0, 1, 1],
    lockText: 'Ngaio teaches it first.',
    unlocked: () => f('kiriGiven'),
    intro: 'Te Awa. The first song every child here learns: the river going down to the sea. Slow, like water. Let it carry you.',
  },
  {
    id: 'oriori', name: 'Oriori mō Hinerua', en: 'A Lullaby for Hinerua', bpm: 72, root: 57, scale: MIN,
    bars: [
      '5---3-2-', '1---3---', '2-3-5-3-', '2-------',
      '5---6-5-', '3---2-1-', '2-3-2-1-', '1-------',
      '8---6-5-', '6---5-3-', '5-3-2-3-', '5-------',
      '3-5-6-5-', '3---2-3-', '2---1---', '1-------',
    ],
    groove: [2, 0, 0, 1, 1, 0, 0, 0],
    lockText: 'After Koro’s story of Hinerua.',
    unlocked: () => f('story') && f('kiriGiven'),
    intro: 'The lullaby we sing so she sleeps well. Quiet. If you play it loud, Koro will hear from the other end of the village.',
  },
  {
    id: 'ia', name: 'Te Ia', en: 'The Current', bpm: 108, root: 53, scale: MAJ,
    bars: [
      '1.3.5.3.', '6.5.3.5-', '1.3.5.6.', '8-6-5---',
      '5.6.8.6.', '5.3.2.3-', '1.2.3.5.', '3-2-1---',
      '3.5.3.5.', '6.8.6.5-', '3.5.6.8.', '9-8-6---',
      '8.6.5.3.', '5.3.2.1-', '2.3.5.3.', '1-------',
    ],
    groove: [2, 0, 1, 1, 2, 0, 1, 1],
    lockText: 'Two stars on Te Awa first.',
    unlocked: () => f('kiriGiven') && bestStars('awa') >= 2,
    intro: 'Te Ia, the current. Faster. This is the one the young ones play to show off. Show off for me.',
  },
  {
    id: 'po', name: 'Te Pō o Hinerua', en: 'Hinerua’s Night', bpm: 120, root: 50, scale: MIN,
    bars: [
      '1.1.3.5.', '6.5.3.1.', '1.1.3.5.', '8-6-5---',
      '5.5.6.8.', '9.8.6.5.', '3.5.6.5.', '3-------',
      '8.8.6.5.', '6.5.3.5.', '1.3.5.6.', '8-------',
      '9.8.6.8.', '6.5.3.2.', '1.2.3.5.', '1-------',
    ],
    groove: [2, 1, 1, 0, 2, 1, 1, 1],
    lockText: 'Get ready for the festival.',
    unlocked: () => f('kiriGiven') && (f('prep:dance') || f('festival')),
    intro: 'The festival song. Everyone dances to this one, so it has to be strong. Strong, not loud!',
  },
];
export const SONG_BY_ID: Record<string, Song> = Object.fromEntries(SONGS.map(s => [s.id, s]));

// ------------------------------------------------------------------ charts
export interface Note { t: number; lane: number; hold: number; midi: number; hit?: 'perfect' | 'good' | 'miss'; held?: number; done?: boolean }
export interface Chart { notes: Note[]; beats: number; spb: number; song: Song; diff: Diff }

export function buildChart(song: Song, diff: Diff): Chart {
  const spb = 60 / song.bpm, e8 = spb / 2;
  const raw: { i: number; deg: number; len: number }[] = [];
  const flat = song.bars.join('');
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i];
    if (ch < '1' || ch > '9') continue;
    let len = 1;
    while (flat[i + len] === '-') len++;
    raw.push({ i, deg: +ch, len });
  }
  const lanes = diff === 'easy' ? 3 : 4;
  const laneOf = (deg: number) => Math.min(lanes - 1, Math.floor(((deg - 1) / 9) * lanes));
  const notes: Note[] = [];
  for (const [k, n] of raw.entries()) {
    if (diff === 'easy' && n.i % 2 === 1) continue;
    const midi = song.root + song.scale[n.deg - 1];
    const hold = n.len >= (diff === 'easy' ? 4 : 3) ? (n.len - 1) * e8 : 0;
    const t = n.i * e8;
    notes.push({ t, lane: laneOf(n.deg), hold, midi });
    if (diff === 'hard') {
      // a grace note into a long note, from the neighbouring lane
      if (n.len >= 4 && k > 0 && raw[k - 1].i < n.i - 1) notes.push({ t: t - e8, lane: Math.max(0, Math.min(3, laneOf(n.deg) + (n.deg > raw[k - 1].deg ? -1 : 1))), hold: 0, midi: midi - 2 });
      // chords on the downbeat of every other bar
      if (n.i % 16 === 0) { const l2 = laneOf(n.deg) >= 2 ? laneOf(n.deg) - 2 : laneOf(n.deg) + 2; notes.push({ t, lane: l2, hold: 0, midi: midi + 7 }); }
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  // no two notes on the same lane closer than an eighth
  const out: Note[] = [];
  const last: number[] = [-9, -9, -9, -9];
  for (const n of notes) { if (n.t - last[n.lane] < e8 * 0.9) continue; last[n.lane] = n.t + n.hold; out.push(n); }
  return { notes: out, beats: (flat.length / 2), spb, song, diff };
}

// ------------------------------------------------------------------ progress
interface RState { best: Record<string, { score: number; stars: number; acc: number }>; plays: number }
const S = () => bucket<RState>('rhythm11', () => ({ best: {}, plays: 0 }));
export function bestStars(song: string, diff?: Diff): number {
  const b = S().best;
  if (diff) return b[song + '@' + diff]?.stars ?? 0;
  return Math.max(0, ...DIFFS.map(d => b[song + '@' + d]?.stars ?? 0));
}
export function bestOf(song: string, diff: Diff) { return S().best[song + '@' + diff] ?? null; }
export function recordResult(song: string, diff: Diff, score: number, stars: number, acc: number): boolean {
  const s = S();
  s.plays++;
  const k = song + '@' + diff, prev = s.best[k];
  const better = !prev || score > prev.score;
  if (better) s.best[k] = { score, stars: Math.max(stars, prev?.stars ?? 0), acc };
  else if (stars > prev.stars) prev.stars = stars;
  game.persist();
  return better;
}
/** hard is open once the song has been cleared on steady */
export const diffOpen = (song: string, d: Diff) => d !== 'hard' || bestStars(song, 'normal') >= 1;
export const songsUnlocked = () => SONGS.filter(s => s.unlocked());
