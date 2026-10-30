// In-world answers for a tense moment (Mori and Joshu in the standoff with Aroha). V12: no cards; the
// answers float as pixel text over the heads of whoever would say them, each speaker's in a column
// with their name in their colour, tracking the actors as the camera moves (src/ui/v12/float.ts).
// Keys 1-9, a click or a tap picks one. `tick` gets the elapsed seconds so the caller can animate
// the clock in the scene (the slingshot drawing tighter).

import { floatChoices } from '../v12/float';

export interface ChoiceCard {
  text: string;
  /** who'd say it: their name over their answers, which float over their head */
  who: string;
  name: string;
  color: string;
  /** CSS anchor over the speaker's head (Actor.cssAnchor) */
  anchor: () => [number, number] | null;
}
export interface CardOpts {
  /** seconds before it resolves null (no answer); 0 = no limit */
  timeout?: number;
  /** each frame: seconds elapsed, 0..1 of the timeout */
  tick?: (t: number, k: number) => void;
}

/** show the answers; resolves with the picked index, or null when the time runs out */
export function choiceCards(cards: ChoiceCard[], o: CardOpts = {}): Promise<number | null> {
  return floatChoices(cards.map(c => ({ text: c.text, group: c.who, anchor: c.anchor, name: c.name, color: c.color })), { timeout: o.timeout, tick: o.tick });
}
