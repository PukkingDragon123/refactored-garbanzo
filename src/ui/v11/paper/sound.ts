// Physical UI kit: sound hooks. Every physical action has its own synthesized sound in
// src/core/audio.ts (page flips, riffles, the cover creaking open, a pencil scratch, a stamp, a push
// pin into cork, tape tearing, a sheet sliding, the ink-bleed swell); this maps the kit's verbs onto
// them with a little pitch variation so repeats don't sound mechanical.

import { audio } from '../../../core/audio';
import type { Sfx } from '../../../core/audio';

export type PaperSound = 'flip' | 'riffle' | 'open' | 'close' | 'pencil' | 'stamp' | 'pin' | 'tape' | 'slide' | 'ink' | 'tick';

const MAP: Record<PaperSound, [Sfx, number]> = {
  flip: ['pageFlip', 0.8], riffle: ['pageRiffle', 0.7], open: ['bookOpen', 0.8], close: ['bookClose', 0.75], pencil: ['pencil', 0.7],
  stamp: ['stamp', 0.85], pin: ['pinPush', 0.8], tape: ['tapeRip', 0.6], slide: ['paperSlide', 0.7], ink: ['inkBleed', 0.6], tick: ['pencil', 0.45],
};

/** play a paper sound (vol multiplies the kit's default level) */
export function paperSfx(s: PaperSound, vol = 1, pitch?: number) {
  const [name, v] = MAP[s];
  try { audio.play(name, { vol: v * vol, pitch: pitch ?? 0.92 + Math.random() * 0.16 }); } catch { /* audio not ready */ }
}
