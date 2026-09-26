// Comic speech bubbles anchored above characters' heads, with typewriter text, voice blips,
// shout / whisper / thought / phone styles, choices, reactions and ambient "barks".

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';

export type BubbleStyle = 'say' | 'shout' | 'whisper' | 'think' | 'phone';

export interface Speaker {
  name: string;
  /** dialogue blip pitch */
  voice: number;
  /** name-tag colour */
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
}

const CSS = `
.bubbles { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.bub { position: absolute; left: 0; top: 0; max-width: min(34em, 46vw); min-width: 5em; transform-origin: 50% 100%;
  pointer-events: none; will-change: transform; }
.bub .box { position: relative; background: #fffaf0; color: #1b1a1f; border: 3px solid #1b1a1f; border-radius: 14px; padding: 0.55em 0.85em 0.6em;
  font-family: var(--body); font-size: 1.05em; line-height: 1.38; box-shadow: 0 4px 0 rgba(12, 16, 20, 0.35), 0 10px 22px rgba(4, 10, 9, 0.35); }
.bub .nm { position: absolute; left: 10px; top: -0.95em; font-family: var(--pix); font-size: 0.82em; padding: 0.08em 0.6em 0.12em; border: 3px solid #1b1a1f;
  border-radius: 8px; color: #fff; background: var(--c, #3fbca6); white-space: nowrap; letter-spacing: 0.03em; }
.bub .tx em { font-style: normal; color: #c2442e; font-weight: 600; }
.bub .tx i { font-style: italic; color: #4b5c63; }
.bub .tail { position: absolute; bottom: -15px; width: 22px; height: 16px; left: var(--tx, 50%); transform: translateX(-50%); }
.bub .tail::before, .bub .tail::after { content: ''; position: absolute; left: 0; top: 0; width: 0; height: 0; border-style: solid; }
.bub .tail::before { border-width: 16px 11px 0 11px; border-color: #1b1a1f transparent transparent transparent; }
.bub .tail::after { left: 4px; top: -1px; border-width: 11px 7px 0 7px; border-color: #fffaf0 transparent transparent transparent; }
.bub .more { position: absolute; right: 8px; bottom: 3px; font-size: 0.7em; color: #6b6f78; animation: bubNext 0.7s ease-in-out infinite; opacity: 0; }
.bub.done .more { opacity: 1; }
.bub .chs { display: flex; flex-direction: column; gap: 0.35em; margin-top: 0.5em; pointer-events: auto; }
.bub .chs button { text-align: left; font-family: var(--body); font-size: 0.95em; background: #f1e6c8; color: #1b1a1f; border: 2px solid #1b1a1f;
  border-radius: 8px; padding: 0.3em 0.6em; cursor: pointer; }
.bub .chs button:hover, .bub .chs button.sel { background: #ffd57a; transform: translateX(3px); }
.bub .chs .key { box-shadow: none; background: #1b1a1f; color: #fffaf0; }
.bub.pop { animation: bubPop 0.28s cubic-bezier(.2,1.6,.4,1) both; }
.bub.out { animation: bubOut 0.16s ease-in both; }
.bub.shout .box { background: #fff3c4; border-width: 4px; border-radius: 4px; font-weight: 600; font-size: 1.18em; text-transform: none;
  clip-path: polygon(0 8%, 6% 0, 18% 6%, 30% 0, 44% 7%, 58% 0, 72% 6%, 86% 0, 100% 8%, 97% 30%, 100% 52%, 96% 74%, 100% 94%, 86% 100%, 70% 94%, 54% 100%, 38% 94%, 22% 100%, 6% 94%, 0 100%, 3% 72%, 0 50%, 4% 28%);
  padding: 0.8em 1.1em; }
.bub.shout .inner { animation: bubShake 0.12s linear infinite; }
.bub.shout .tail::after { border-color: #fff3c4 transparent transparent transparent; }
.bub.whisper .box { border-style: dashed; background: #f4f1ea; color: #4d5058; font-size: 0.95em; }
.bub.think .box { border-radius: 40px; background: #f7f7ff; color: #3f4459; font-style: italic; }
.bub.think .tail { width: 30px; height: 30px; bottom: -30px; }
.bub.think .tail::before { border: 3px solid #1b1a1f; border-radius: 50%; width: 12px; height: 12px; background: #f7f7ff; left: 2px; top: 0; }
.bub.think .tail::after { border: 3px solid #1b1a1f; border-radius: 50%; width: 6px; height: 6px; background: #f7f7ff; left: 14px; top: 18px; }
.bub.phone .box { background: #13262b; color: #8ff0dc; border-color: #0a1316; font-family: var(--pix); letter-spacing: 0.03em; border-radius: 6px; }
.bub.phone .box::before { content: '🔊 TRANSLATE'; display: block; font-size: 0.7em; color: #3fbca6; margin-bottom: 0.25em; opacity: 0.9; }
.bub.phone .tail::after { border-color: #13262b transparent transparent transparent; }
.bub.phone .nm { display: none; }
.bub.bark .box { font-size: 0.9em; padding: 0.35em 0.7em; }
.bub.bark .nm { display: none; }
.bub.edge .tail { display: none; }
@keyframes bubPop { 0% { transform: var(--pos) scale(0.4); opacity: 0; } 100% { transform: var(--pos) scale(1); opacity: 1; } }
@keyframes bubOut { to { transform: var(--pos) scale(0.7); opacity: 0; } }
@keyframes bubNext { 50% { transform: translateY(2px); } }
@keyframes bubShake { 0% { transform: translate(0, 0); } 25% { transform: translate(1px, -1px); } 50% { transform: translate(-1px, 1px); } 75% { transform: translate(1px, 1px); } }
@media (prefers-reduced-motion: reduce) { .bub.shout .inner { animation: none; } }
`;

interface Live {
  el: HTMLElement;
  box: HTMLElement;
  tx: HTMLElement;
  who: string;
  full: string;
  shown: number;
  speed: number;
  pause: number;
  done: boolean;
  bark: boolean;
  ttl: number;
  w: number;
  h: number;
}

let styled = false;

export class Bubbles {
  readonly root: HTMLElement;
  private speakers = new Map<string, Speaker>();
  private live: Live[] = [];
  private advance: (() => void) | null = null;
  private skipTyping = false;
  active = false;
  private keyHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: PointerEvent) => void;

  constructor(parent: HTMLElement) {
    if (!styled) {
      document.head.appendChild(el('style', '', CSS));
      styled = true;
    }
    this.root = parent.appendChild(el('div', 'bubbles'));
    this.keyHandler = e => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.onAdvance();
      }
    };
    this.clickHandler = e => {
      if (!this.active || e.button !== 0) return;
      if ((e.target as HTMLElement).closest?.('.chs')) return;
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

  private fmt(s: string) {
    return s.replace(/\*([^*]+)\*?/g, '<em>$1</em>').replace(/_([^_]+)_?/g, '<i>$1</i>');
  }

  private make(line: BubbleLine, bark: boolean): Live {
    const sp = this.speakers.get(line.who);
    const style = line.style ?? 'say';
    const b = el('div', `bub pop ${style}${bark ? ' bark' : ''}`);
    b.innerHTML = `<div class="inner"><div class="box"><div class="nm"></div><div class="tx"></div><div class="chs"></div><div class="more">▼</div></div><div class="tail"></div></div>`;
    const nm = b.querySelector('.nm') as HTMLElement;
    nm.textContent = sp?.name ?? line.who;
    b.style.setProperty('--c', sp?.color ?? '#3fbca6');
    this.root.appendChild(b);
    const lv: Live = {
      el: b, box: b.querySelector('.box') as HTMLElement, tx: b.querySelector('.tx') as HTMLElement, who: line.who,
      full: line.text, shown: 0, speed: 46 * (line.speed ?? 1) * (style === 'shout' ? 1.3 : style === 'whisper' ? 0.8 : 1), pause: 0,
      done: false, bark, ttl: bark ? 2.4 + line.text.length * 0.045 : Infinity, w: 0, h: 0,
    };
    // pre-size the box with the full text so it doesn't grow while typing
    lv.tx.innerHTML = this.fmt(line.text);
    lv.w = b.offsetWidth;
    lv.h = b.offsetHeight;
    lv.tx.style.minHeight = lv.tx.offsetHeight + 'px';
    lv.tx.style.minWidth = Math.min(lv.tx.offsetWidth, 520) + 'px';
    lv.tx.innerHTML = '';
    this.live.push(lv);
    this.place(lv);
    audio.play(('bubblePop' as unknown) as 'ui', { vol: 0.35, pitch: 0.9 + (sp?.voice ?? 1) * 0.15 });
    return lv;
  }

  private kill(lv: Live) {
    lv.el.classList.remove('pop');
    lv.el.classList.add('out');
    setTimeout(() => lv.el.remove(), 170);
    this.live = this.live.filter(x => x !== lv);
    if (!lv.bark) this.speakers.get(lv.who)?.talk?.(false);
  }

  private place(lv: Live) {
    const sp = this.speakers.get(lv.who);
    const rootR = this.root.getBoundingClientRect();
    const W = rootR.width, H = rootR.height;
    const a = sp?.anchor() ?? null;
    const w = lv.el.offsetWidth || lv.w, h = lv.el.offsetHeight || lv.h;
    let x: number, y: number, edge = false;
    if (a) {
      x = a[0] - w / 2;
      y = a[1] - h - 22;
    } else {
      x = W / 2 - w / 2;
      y = H * 0.12;
      edge = true;
    }
    const margin = 12;
    const cx = Math.max(margin, Math.min(W - w - margin, x));
    const cy = Math.max(margin + 14, Math.min(H - h - margin, y));
    if (a && (cy !== y || a[1] < 0 || a[1] > H)) edge = true;
    lv.el.classList.toggle('edge', edge);
    if (a) lv.el.style.setProperty('--tx', `${Math.max(16, Math.min(w - 16, a[0] - cx))}px`);
    const pos = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
    lv.el.style.setProperty('--pos', pos);
    if (!lv.el.classList.contains('pop') && !lv.el.classList.contains('out')) lv.el.style.transform = pos;
  }

  /** per-frame: typewriter + follow speakers */
  update(dt: number) {
    for (const lv of [...this.live]) {
      if (lv.el.classList.contains('pop') && lv.el.getAnimations().length === 0) lv.el.classList.remove('pop');
      this.place(lv);
      if (!lv.done) {
        if (this.skipTyping && !lv.bark) {
          lv.shown = lv.full.length;
        } else if (lv.pause > 0) lv.pause -= dt;
        else {
          const before = Math.floor(lv.shown);
          lv.shown = Math.min(lv.full.length, lv.shown + dt * lv.speed);
          const now = Math.floor(lv.shown);
          if (now > before) {
            const ch = lv.full[now - 1];
            if (/[.!?]/.test(ch) && lv.full[now] === ' ') lv.pause = 0.22;
            else if (/[,;:—]/.test(ch)) lv.pause = 0.1;
            if (ch && /[a-z0-9]/i.test(ch) && now % 2 === 0) {
              const sp = this.speakers.get(lv.who);
              audio.play('dialogBlip', { pitch: (sp?.voice ?? 1) * (0.94 + Math.random() * 0.12), vol: lv.bark ? 0.25 : 0.45 });
            }
          }
        }
        lv.tx.innerHTML = this.fmt(this.visibleText(lv.full, Math.floor(lv.shown)));
        if (lv.shown >= lv.full.length) {
          lv.done = true;
          lv.el.classList.add('done');
          if (!lv.bark) this.speakers.get(lv.who)?.talk?.(false);
          this.skipTyping = false;
        }
      } else if (lv.bark) {
        lv.ttl -= dt;
        if (lv.ttl <= 0) this.kill(lv);
      }
    }
  }

  /** slice text by visible characters while keeping *emphasis* markers balanced */
  private visibleText(full: string, n: number) {
    let out = '', count = 0;
    for (let i = 0; i < full.length && count < n; i++) {
      out += full[i];
      if (full[i] !== '*' && full[i] !== '_') count++;
    }
    return out;
  }

  private onAdvance() {
    const cur = this.live.find(l => !l.bark);
    if (cur && !cur.done) {
      this.skipTyping = true;
      return;
    }
    const a = this.advance;
    if (a) {
      this.advance = null;
      a();
    }
  }

  /** Blocking conversation. Resolves with the index of the last choice made (or -1). */
  async say(lines: BubbleLine[]): Promise<number> {
    this.active = true;
    game.ui.dialogueOpen = true;
    let choice = -1;
    try {
      for (const line of lines) {
        for (const lv of this.live.filter(l => !l.bark)) this.kill(lv);
        const sp = this.speakers.get(line.who);
        sp?.react?.({ expr: line.expr, emote: line.emote, react: line.react });
        if (line.others) for (const [id, r] of Object.entries(line.others)) this.speakers.get(id)?.react?.(r);
        line.onShow?.();
        if (!line.text) continue;
        const lv = this.make(line, false);
        sp?.talk?.(true);
        await new Promise<void>(res => {
          const chk = () => (lv.done ? res() : requestAnimationFrame(chk));
          chk();
        });
        if (line.choices) {
          choice = await this.ask(lv, line.choices);
        } else if (line.auto !== undefined) {
          await new Promise<void>(res => {
            const t = setTimeout(() => { this.advance = null; res(); }, line.auto);
            this.advance = () => { clearTimeout(t); res(); };
          });
        } else {
          await new Promise<void>(res => (this.advance = res));
          audio.play('ui', { vol: 0.25 });
        }
      }
    } finally {
      for (const lv of this.live.filter(l => !l.bark)) this.kill(lv);
      this.active = false;
      this.advance = null;
      game.ui.dialogueOpen = false;
      guardInput(250);
    }
    return choice;
  }

  private ask(lv: Live, choices: string[]): Promise<number> {
    const chs = lv.el.querySelector('.chs') as HTMLElement;
    lv.el.querySelector('.more')?.remove();
    return new Promise<number>(res => {
      let sel = 0;
      const btns: HTMLButtonElement[] = [];
      const finish = (i: number) => {
        window.removeEventListener('keydown', kh, true);
        audio.play('ui');
        res(i);
      };
      choices.forEach((c, i) => {
        const b = el('button', i === 0 ? 'sel' : '', `<span class="key">${i + 1}</span> ${this.fmt(c)}`);
        b.addEventListener('pointerdown', e => { e.stopPropagation(); finish(i); });
        b.addEventListener('pointerenter', () => { sel = i; btns.forEach((x, k) => x.classList.toggle('sel', k === sel)); });
        chs.appendChild(b);
        btns.push(b);
      });
      const kh = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= choices.length) { e.preventDefault(); e.stopPropagation(); finish(n - 1); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); sel = (sel + 1) % choices.length; }
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); sel = (sel + choices.length - 1) % choices.length; }
        else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); finish(sel); }
        btns.forEach((x, k) => x.classList.toggle('sel', k === sel));
      };
      window.addEventListener('keydown', kh, true);
      this.place(lv);
    });
  }

  /** Non-blocking ambient line (NPC chatter, animal-spotting remarks). */
  bark(who: string, text: string, o: { style?: BubbleStyle; expr?: string; emote?: string } = {}) {
    if (this.live.some(l => l.bark && l.who === who)) return;
    const sp = this.speakers.get(who);
    if (!sp || !sp.anchor()) return;
    sp.react?.({ expr: o.expr, emote: o.emote });
    this.make({ who, text, style: o.style }, true);
  }

  clear() {
    for (const lv of [...this.live]) lv.el.remove();
    this.live = [];
    this.advance = null;
    this.active = false;
  }
}
