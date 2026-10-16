// V11 NPCs: the shapes the conversation runner, the quests and the scenes share.
import type { BubbleLine } from '../../../ui/bubbles';
import type { FieldScene } from '../../scenes/field';
import type { Actor } from '../../../world/actor';

/** whoever is running a conversation with someone */
export interface TalkHost {
  id: string;
  say(lines: BubbleLine[]): Promise<number>;
  /** the scene and the person's actor, when they're standing there */
  f: FieldScene | null;
  a: Actor | null;
}
/** an entry in the conversation menu */
export interface MenuOpt {
  label: string;
  run: (h: TalkHost) => Promise<void>;
  /** a quest step points at it (it goes first) */
  quest?: boolean;
}
export type Line = [string, string, string?];
export const L = (c: Line[]): BubbleLine[] => c.map(([who, text, expr]) => ({ who, text, expr: expr ?? 'neutral' }));
