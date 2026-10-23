// V12 contract: floating text. Every piece of text the player reads floats in the world (no boxes,
// no toasts): dialogue by the speaker, barks, prompts over objects, notices near Mori. The floating
// text module owns the real implementation (per-letter animation styles); this stub falls back to
// the old toast so callers work today.
import { game } from '../../game/game';

export type FloatStyle = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'laugh' | 'sad' | 'think' | 'radio' | 'notice';
export interface FloatOpts {
  text: string;
  /** anchor: an actor (follows it) or a world point; neither = near Mori */
  actor?: unknown;
  x?: number;
  y?: number;
  style?: FloatStyle;
  /** how long it stays after typing out (ms) */
  ms?: number;
}
/** show a line of floating text in the world; resolves when it has faded */
export async function floatText(o: FloatOpts): Promise<void> {
  game.ui.toast(o.text, '', '', o.ms ?? 2600);
}
/** a world notice near Mori (replaces toasts: "Saved", "New entry", "Too heavy"...) */
export function floatNotice(text: string, ms = 2600): void { void floatText({ text, style: 'notice', ms }); }
