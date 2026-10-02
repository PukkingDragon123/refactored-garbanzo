// V10: Jenna's homemade translator. Aroha speaks te reo Māori; the gadget clipped to her belt (a
// phone, two speakers and a lot of tape) turns it into English, mostly. Early builds pick the wrong
// word, then buzz and correct themselves ("Wash the cliff... *bzzt* WATCH the cliff"). The camp module
// upgrades it by raising game.save.vars['v10:translator'] (0 prototype .. 3 perfect).
// Every Aroha line on an expedition goes through it (installTranslator wraps the speech bubbles) and
// gets a little gadget tag on her bubble; other modules can use tr() for lines anywhere.

import { game } from '../game';
import type { BubbleLine, BubbleStyle } from '../../ui/bubbles';
import { el } from '../../ui/ui';
import { rand } from '../../core/math';

export const translatorLevel = () => Math.max(0, Math.min(3, game.save.vars['v10:translator'] ?? 0));
const VERSION = ['0.3', '0.7', '1.4', '2.0'];
/** chance a line comes out wrong first, per translator level */
const ERR = [0.42, 0.24, 0.1, 0];

/** near-miss words the speech engine reaches for first */
const SWAP: Record<string, string> = {
  watch: 'wash', careful: 'cheerful', cliff: 'cliché', snake: 'snack', snakes: 'snacks', bird: 'beard', birds: 'beards', quiet: 'diet',
  look: 'cook', here: 'hair', stop: 'shop', rock: 'sock', rocks: 'socks', water: 'waiter', tree: 'three', trees: 'threes', path: 'bath',
  fish: 'wish', slow: 'snow', down: 'clown', run: 'bun', hide: 'ride', climb: 'crime', eggs: 'legs', track: 'tractor', tracks: 'tractors',
  nest: 'vest', nests: 'vests', mud: 'mug', river: 'liver', rain: 'brain', stream: 'cream', cave: 'cake', ferns: 'fans', forest: 'florist',
  leaf: 'loaf', leaves: 'loaves', moss: 'boss', deep: 'sheep', dark: 'shark', hot: 'pot', steam: 'team', bones: 'phones', old: 'gold',
  dangerous: 'delicious', poison: 'poisson', follow: 'swallow', glow: 'glue', feet: 'feast', back: 'bark', camera: 'camel', photo: 'potato',
  photos: 'potatoes', home: 'gnome', quickly: 'quackly', quick: 'quack', mushroom: 'mush room', mushrooms: 'mush rooms', hole: 'mole',
  wait: 'weight', breathe: 'brie', listen: 'glisten', smell: 'spell', jump: 'lump', ground: 'gown', stay: 'stew', step: 'steep', edge: 'hedge',
  swim: 'slim', tide: 'tie-dye', warm: 'worm', cold: 'gold', bridge: 'fridge', trust: 'toast', friend: 'fiend', grandmother: 'grand mother ship',
  tired: 'tyred', sleep: 'sheep', eat: 'heat', food: 'mood', good: 'goop', walk: 'wok', sun: 'bun', night: 'knight', light: 'lite',
};
const FRENCH: [RegExp, string][] = [
  [/\bwatch\b/i, 'Attention'], [/\bcareful\b/i, 'Attention'], [/\bhello\b/i, 'Bonjour'], [/\bfish\b/i, 'Poisson'], [/\bsnake\b/i, 'Serpent'], [/\bthank you\b/i, 'Merci'],
];

const tag = (glitch: boolean) => `<b class="trx${glitch ? ' glitch' : ''}" data-v="${VERSION[translatorLevel()]}"></b>`;
export const isTranslated = (text: string) => text.startsWith('<b class="trx');

function caseLike(w: string, model: string) {
  if (model === model.toUpperCase() && model.length > 1) return w.toUpperCase();
  if (model[0] === model[0].toUpperCase()) return w[0].toUpperCase() + w.slice(1);
  return w;
}

/** the first clause of a line (up to the first stop/comma/dash), and the rest */
function clause(text: string): [string, string] {
  const m = text.match(/^(.{6,}?)([.,!?;:—…]|\s-\s)(\s|$)/);
  if (!m) return [text, ''];
  return [m[1], text.slice(m[1].length)];
}

/** a wrong first try and its correction, or null if this line has nothing to trip over */
function garble(text: string): string | null {
  const [first] = clause(text);
  const roll = rand.next();
  // 1. a near-miss word, then the fix in capitals
  const words = [...first.matchAll(/[A-Za-zāēīōū']+/g)].filter(m => SWAP[m[0].toLowerCase()]);
  if (words.length && roll < 0.62) {
    const m = words[Math.floor(rand.next() * words.length)];
    const wrong = first.slice(0, m.index) + caseLike(SWAP[m[0].toLowerCase()], m[0]) + first.slice((m.index ?? 0) + m[0].length);
    const fixed = text.slice(0, m.index) + m[0].toUpperCase() + text.slice((m.index ?? 0) + m[0].length);
    return `${wrong}... *bzzt* ${fixed}`;
  }
  // 2. the wrong language pack
  const fr = FRENCH.find(([re]) => re.test(first));
  if (fr && roll < 0.8) return `${fr[1]}! ...Pardon. *bzzt* Language: ENGLISH. ${text}`;
  // 3. the speech engine stalls, or reads the punctuation out loud
  const k = rand.next();
  if (k < 0.3) return `[translating... 63%] ...*bzzt* ${text}`;
  if (k < 0.55) return `${first.toUpperCase()} *bzzt* (volume: normal) ${text}`;
  if (k < 0.8 && text.length < 90) return `${text.replace(/[.!?]+$/, '')} full stop. *bzzt* ...${text}`;
  return `(^-^) *bzzt* sorry. ${text}`;
}

/**
 * Aroha's line through the translator: the gadget tag, and sometimes a wrong first try that buzzes
 * and corrects itself. Spread the result into a BubbleLine: { who: 'aroha', ...tr('...'), expr }.
 */
export function tr(text: string, o: { style?: BubbleStyle; shout?: boolean; whisper?: boolean; clean?: boolean; garble?: boolean } = {}): { text: string; style?: BubbleStyle } {
  const style = o.style ?? (o.shout ? 'shout' : o.whisper ? 'whisper' : undefined);
  if (isTranslated(text)) return { text, style };
  const lvl = translatorLevel();
  const bad = !o.clean && (o.garble || rand.next() < ERR[lvl]) ? garble(text) : null;
  if (bad) game.save.vars['v10:trxErrors'] = (game.save.vars['v10:trxErrors'] ?? 0) + 1;
  return { text: tag(!!bad) + (bad ?? text), style };
}

/** old V2 lines still call Mori "Doc" and the crew by their old names */
const fixNames = (t: string) => t.replace(/\bDoc\b/g, 'Mori').replace(/\bPip\b/g, 'Jenna').replace(/\bLou\b/g, 'Joshu');

const CSS = `
.bub .tx .trx { position: absolute; right: -0.55em; top: -2.15em; display: inline-flex; align-items: center; gap: 0.3em; padding: 0.12em 0.5em 0.08em;
  font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 0.62em; font-style: normal; letter-spacing: 0.08em; color: #9dffd8; background: #10201c;
  box-shadow: 0 0 0 2px #0c0a0c, 0 3px 0 2px rgba(0,0,0,0.35); white-space: nowrap; pointer-events: none; }
.bub .tx .trx::before { content: ''; width: 0.5em; height: 0.5em; background: #3fdc8c; box-shadow: 0 0 4px #3fdc8c; animation: trxBlink 1.1s steps(1) infinite; }
.bub .tx .trx::after { content: 'J-TRANS v' attr(data-v); }
.bub .tx .trx.glitch { color: #ffb4a0; animation: trxGlitch 0.18s steps(2) 6; }
.bub .tx .trx.glitch::before { background: #ff5a3a; box-shadow: 0 0 4px #ff5a3a; }
.dbl .tx .trx { position: static; display: inline-flex; margin-right: 0.5em; vertical-align: 0.15em; }
@keyframes trxBlink { 50% { opacity: 0.25; } }
@keyframes trxGlitch { 0% { transform: translate(0, 0); } 50% { transform: translate(-2px, 1px) skewX(-8deg); } 100% { transform: translate(1px, -1px); } }
`;

let installed = false;
/**
 * Route Aroha's lines through the translator whenever `active()` says so (on expeditions): every
 * say() and bark() of hers gets the tag and the odd stumble, and old "Doc" lines say "Mori".
 */
export function installTranslator(active: () => boolean) {
  if (installed || !game.ui?.bubbles) return;
  installed = true;
  document.head.appendChild(el('style', '', CSS));
  const B = game.ui.bubbles as unknown as {
    say(lines: BubbleLine[]): Promise<number>;
    bark(who: string, text: string, o?: { style?: BubbleStyle; expr?: string; emote?: string }): void;
  };
  const say0 = B.say.bind(B), bark0 = B.bark.bind(B);
  B.say = (lines: BubbleLine[]) => say0(active() ? lines.map(l => (l.who === 'aroha' && l.text && !isTranslated(l.text) ? { ...l, ...tr(fixNames(l.text), { style: l.style }) } : l)) : lines);
  B.bark = (who: string, text: string, o?: { style?: BubbleStyle; expr?: string; emote?: string }) =>
    bark0(who, who === 'aroha' && active() && !isTranslated(text) ? tr(fixNames(text)).text : text, o);
}
