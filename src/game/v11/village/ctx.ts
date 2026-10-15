// V11 Te Kāinga: the shared state of one visit (the scene, the villagers' actors and routines, the
// animals, the time of day) and small helpers every village module uses: lines through Jenna's
// translator for the villagers (Mori and the crew speak English), barks, waits.

import type { FieldScene } from '../../scenes/field';
import type { Actor } from '../../../world/actor';
import type { BubbleLine } from '../../../ui/bubbles';
import type { TimeOfDay } from '../../../world/timeofday';
import type { Livestock } from './livestock';
import { tr } from '../../v10/translator';
import { game } from '../../game';

const ENGLISH = new Set(['mori', 'rowan', 'jenna', 'joshu', 'chunk']);

export interface Station {
  x: number;
  anim: string;
  face?: 1 | -1;
  /** seconds to stay (default random 18..40) */
  stay?: number;
}
export interface VillagerRT {
  id: string;
  a: Actor;
  stations: Station[];
  i: number;
  t: number;
  /** a kid: runs between random spots in this range */
  roam?: [number, number];
  /** scripted: the routine leaves this one alone */
  held: boolean;
}

export interface VCtx {
  f: FieldScene;
  ground: (x: number) => number;
  tod: TimeOfDay;
  night: boolean;
  /** the festival is on tonight */
  festival: boolean;
  vill: Record<string, VillagerRT>;
  live: Livestock | null;
  /** everything routine is paused (a cutscene, the festival show) */
  hold: boolean;
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** one line, through the translator for the villagers (clean: no stumble, for solemn moments) */
export function line(l: BubbleLine, clean = false): BubbleLine {
  if (ENGLISH.has(l.who) || l.who === 'aroha') return l;
  return { ...l, ...tr(l.text, { style: l.style, clean }) };
}
export function say(f: FieldScene, lines: BubbleLine[], clean = false): Promise<number> {
  return f.say(lines.map(l => line(l, clean)));
}
export function bark(who: string, text: string, o: { expr?: string; emote?: string; clean?: boolean } = {}) {
  const t = ENGLISH.has(who) || who === 'aroha' ? text : tr(text, { clean: o.clean }).text;
  game.ui.bubbles.bark(who, t, { expr: o.expr, emote: o.emote } as never);
}
export function actorOf(c: VCtx, id: string): Actor | null {
  if (id === 'aroha') return c.f.guide?.a ?? c.f.actors.get('aroha') ?? null;
  return c.vill[id]?.a ?? c.f.actors.get(id) ?? null;
}
