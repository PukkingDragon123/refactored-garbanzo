// V12 dialogue: simple floating text by the speaker (src/ui/v12/float.ts), no bubbles or boxes.
// Conversations and ambient barks keep the old Bubbles API (say / bark / register / clear and the
// BubbleLine options: style, expr, emote, react, others, auto, choices, close, speed, onShow), so the
// story calls work unchanged. The line's style and the speaker's expression pick the letters' motion:
// shouts shake and grow, whispers waver, scared lines tremble, happy ones bounce, sad ones droop,
// thoughts drift, the phone crackles. Answers float near Mori. The big dramatic moments of the main
// cast still bring in the close-up cut-in, with the line floating beside the bust.

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';
import { SPECIES, CLUES } from '../game/species';
import { ITEMS } from '../game/items';
import { CloseUps, isCastId } from './closeup';
import { PortraitBox } from './dialogbox';
import { floatLine, floatChoices, moriAnchor, clearFloats } from './v12/float';
import type { FloatHandle, FloatStyle } from './v12/float';

const CHUNK_IDS = ['chunk'];

// words that get the keyword colour: species, clues, places, key items
let KEYWORDS: RegExp | null = null;
function keywords(): RegExp {
  if (KEYWORDS) return KEYWORDS;
  const words = new Set<string>(['Zealandia', 'Kittiwake', 'Thunder Falls', 'Fernwood', 'Emerald Canopy', 'Blackwater', 'Serpent Coast', 'Camp Kittiwake', 'laptop', 'workbench', 'research points', 'RP']);
  for (const sp of SPECIES) { words.add(sp.name); if (sp.name.split(' ').length > 1) words.add(sp.name.split(' ').slice(-1)[0] + 's'); }
  for (const c of CLUES) words.add(c.name);
  for (const it of Object.values(ITEMS)) if (it.name.length > 4 && (it.kind === 'tool' || it.kind === 'key' || it.kind === 'lure')) words.add(it.name);
  const list = [...words].filter(w => w.length > 2).sort((a, b) => b.length - a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  KEYWORDS = new RegExp(`\\b(${list.join('|')})\\b`, 'g');
  return KEYWORDS;
}

export type BubbleStyle = 'say' | 'shout' | 'whisper' | 'think' | 'phone';

export interface Speaker {
  name: string;
  /** dialogue blip pitch */
  voice: number;
  /** the speaker's colour (tints their text and names them) */
  color: string;
  /** CSS px (relative to #ui) of the point just above the head, or null when not visible */
  anchor(): [number, number] | null;
  /** called when the speaker starts/stops talking; mouth flaps are driven by the actor */
  talk?(on: boolean): void;
  /** start-of-line reaction: expression, emote icon and body reaction ids are interpreted by the actor */
  react?(o: { expr?: string; emote?: string; react?: string }): void;
}

export interface BubbleLine {
  who: string;
  text: string;
  style?: BubbleStyle;
  /** facial expression for the speaker during the line */
  expr?: string;
  /** emote icon popped above the speaker's head */
  emote?: string;
  /** body reaction: 'jump' | 'shake' | 'shrink' | 'nod' | 'bounce' | 'recoil' ... */
  react?: string;
  choices?: string[];
  /** auto-advance after this many ms once fully typed (cutscenes) */
  auto?: number;
  /** reactions for OTHER characters at the start of the line: id -> reaction */
  others?: Record<string, { expr?: string; emote?: string; react?: string }>;
  /** run when the line appears (camera moves, sfx...) */
  onShow?: () => void;
  /** typing speed multiplier */
  speed?: number;
  /** cinematic close-up of the speaker: true forces one, false prevents it (default: the big dramatic lines) */
  close?: boolean;
}

/** the letters' motion for a line: its style first, then the speaker's face */
export function floatStyleOf(style: BubbleStyle | undefined, expr: string | undefined, text: string): FloatStyle {
  if (style === 'shout') return 'shout';
  if (style === 'whisper') return 'whisper';
  if (style === 'think') return 'think';
  if (style === 'phone') return 'radio';
  const e = expr ?? '';
  const bang = /!["'’”)*_]*\s*$/.test(text) && text.length < 70;
  if (e === 'scared' || e === 'nervous' || e === 'terrified') return 'scared';
  if (e === 'laugh') return 'laugh';
  if (e === 'excited' || e === 'happy' || e === 'wow' || e === 'derp') return 'happy';
  if (e === 'sad' || e === 'tired' || e === 'injured' || e === 'cry') return 'sad';
  if (e === 'sleep') return 'whisper';
  if ((e === 'shocked' || e === 'angry') && bang) return 'shout';
  return 'say';
}

/** names for the older cast that may not stand in the scene */
const NAMES: Record<string, string> = {
  otis: 'Otis', imogen: 'Dr. Vance', bolt: 'Bolt', pip: 'Pip', lou: 'Mama Lou', sid: 'Sid', captain: 'Captain Brannigan', radio: 'Radio',
};

export class Bubbles {
  /** (kept for the V2 API; the text itself floats on the V12 overlay) */
  readonly root: HTMLElement;
  private speakers = new Map<string, Speaker>();
  private advance: (() => void) | null = null;
  active = false;
  private keyHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: PointerEvent) => void;
  readonly cu: CloseUps;
  /** (the portrait box is retired: every line floats) */
  readonly pb: PortraitBox;
  /** kept for the V2 API; every mode floats now */
  mode: 'box' | 'bubble' = 'bubble';
  private cur: FloatHandle | null = null;
  private barks = new Map<string, FloatHandle>();
  private choosing = false;
  private lastWho = '';

  constructor(parent: HTMLElement) {
    this.cu = new CloseUps(parent);
    this.root = parent.appendChild(el('div', 'bubbles'));
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    this.pb = new PortraitBox(parent);
    this.keyHandler = e => {
      if (!this.active || this.choosing) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.onAdvance();
      }
    };
    this.clickHandler = e => {
      if (!this.active || this.choosing || e.button !== 0) return;
      this.onAdvance();
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('pointerdown', this.clickHandler);
  }

  register(id: string, s: Speaker) {
    this.speakers.set(id, s);
  }
  unregister(id: string) {
    this.speakers.delete(id);
  }
  clearSpeakers() {
    this.speakers.clear();
  }
  speaker(id: string) {
    return this.speakers.get(id);
  }

  /** keywords get their colour; *emphasis* and _asides_ are read by the floating text itself */
  private fmt(s: string) {
    return s.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag: string | undefined, txt: string | undefined) => tag ?? (txt ?? '').replace(keywords(), '\u0003$1\u0004'));
  }

  /** the big dramatic moments of the main cast bring the close-up in (a line's `close` overrides) */
  private wantClose(line: BubbleLine) {
    if (!isCastId(line.who)) return false;
    if (line.close !== undefined) return line.close;
    if (CHUNK_IDS.includes(line.who)) return false;
    return line.style === 'shout' && ['shocked', 'angry', 'scared', 'surprised'].includes(line.expr ?? '');
  }

  private show(line: BubbleLine, close: boolean): FloatHandle {
    const sp = this.speakers.get(line.who);
    const narr = line.who === 'narrator';
    const turn = line.who !== this.lastWho;
    this.lastWho = line.who;
    const name = narr ? undefined : sp?.name ?? NAMES[line.who] ?? (line.who ? line.who[0].toUpperCase() + line.who.slice(1) : undefined);
    const anchor = close
      ? () => (this.cu.active ? this.cu.anchor() : sp?.anchor() ?? null)
      : narr ? () => { const r = game.ui.root.getBoundingClientRect(); return [r.width / 2, r.height * 0.84] as [number, number]; }
      : sp ? () => sp.anchor() : () => null;
    return floatLine({
      text: this.fmt(line.text), kind: 'line', hold: true,
      style: narr && !line.style ? 'think' : floatStyleOf(line.style, line.expr, line.text),
      at: anchor, place: close ? 'right' : 'above',
      // the name rides on the first line of each turn, and always when the speaker is out of sight
      name: name && (turn || !sp || !sp.anchor()) ? name : undefined,
      color: sp?.color, voice: sp?.voice ?? 1, speed: line.speed, pre: 0.14, lost: 'top',
    });
  }

  private endCurrent() {
    if (this.cur) { this.cur.dismiss(); this.cur = null; }
  }

  private onAdvance() {
    const cur = this.cur;
    if (cur && !cur.isTyped()) {
      cur.skip();
      return;
    }
    const a = this.advance;
    if (a) {
      this.advance = null;
      a();
    }
  }

  /** per-frame upkeep (the floating text animates itself) */
  update(_dt: number) {
    for (const [who, h] of this.barks) if (!h.alive()) this.barks.delete(who);
  }

  /** Blocking conversation. Resolves with the index of the last choice made (or -1). */
  async say(lines: BubbleLine[]): Promise<number> {
    this.active = true;
    game.ui.dialogueOpen = true;
    this.lastWho = '';
    let choice = -1;
    try {
      for (const line of lines) {
        this.endCurrent();
        const sp = this.speakers.get(line.who);
        sp?.react?.({ expr: line.expr, emote: line.emote, react: line.react });
        if (line.others) for (const [id, r] of Object.entries(line.others)) this.speakers.get(id)?.react?.(r);
        line.onShow?.();
        if (!line.text) continue;
        // a speaker's bark gives way to their line
        this.barks.get(line.who)?.dismiss();
        const close = this.wantClose(line);
        let h: FloatHandle | null = null;
        if (close) this.cu.show(line.who as never, line.expr ?? 'neutral', { name: sp?.name ?? line.who, style: line.style, talking: () => !!h && !h.isTyped() });
        else this.cu.hide();
        h = this.show(line, close);
        this.cur = h;
        sp?.talk?.(true);
        await h.typed;
        sp?.talk?.(false);
        if (line.choices) {
          choice = await this.ask(line.choices);
        } else if (line.auto !== undefined) {
          await new Promise<void>(res => {
            const t = setTimeout(() => { this.advance = null; res(); }, line.auto);
            this.advance = () => { clearTimeout(t); res(); };
          });
        } else {
          h.wait(true);
          await new Promise<void>(res => (this.advance = res));
          audio.play('ui', { vol: 0.25 });
        }
      }
    } finally {
      this.endCurrent();
      this.cu.hide();
      this.active = false;
      this.advance = null;
      this.choosing = false;
      game.ui.dialogueOpen = false;
      guardInput(250);
    }
    return choice;
  }

  private async ask(choices: string[]): Promise<number> {
    this.choosing = true;
    try {
      const i = await floatChoices(choices.map(c => ({ text: this.fmt(c) })), { anchor: moriAnchor() });
      return i ?? 0;
    } finally {
      this.choosing = false;
    }
  }

  /** Non-blocking ambient line (NPC chatter, animal-spotting remarks). */
  bark(who: string, text: string, o: { style?: BubbleStyle; expr?: string; emote?: string } = {}) {
    const live = this.barks.get(who);
    if (live?.alive()) return;
    const sp = this.speakers.get(who);
    if (!sp || !sp.anchor()) return;
    sp.react?.({ expr: o.expr, emote: o.emote });
    const h = floatLine({
      text: this.fmt(text), kind: 'bark', style: floatStyleOf(o.style, o.expr, text), at: () => sp.anchor(),
      color: sp.color, voice: sp.voice, ms: 2400 + text.length * 45, lost: 'hide',
    });
    this.barks.set(who, h);
  }

  clear() {
    clearFloats(['line', 'bark', 'option'], true);
    this.barks.clear();
    this.cur = null;
    this.advance = null;
    this.active = false;
  }
}
