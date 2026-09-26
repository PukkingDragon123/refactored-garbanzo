// HTML overlay UI: HUD, viewfinder, dialogue (typewriter + portraits), toasts, letterbox, modals.

import { portrait } from '../game/assets';
import { CREW } from '../art/characters';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';
import { Bubbles } from './bubbles';
import { portraitURL as v2Portrait, peopleArt } from '../world/actor';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export interface Line {
  who: string;
  text: string;
  expr?: 'neutral' | 'happy' | 'wow' | 'talk' | 'worried';
  choices?: string[];
}

const DISPLAY_NAMES: Record<string, string> = {
  otis: 'Otis', imogen: 'Dr. Vance', bolt: 'Bolt', pip: 'Pip', lou: 'Mama Lou', sid: 'Sid', captain: 'Captain Brannigan', radio: 'Radio', narrator: '',
};
const VOICE: Record<string, number> = { otis: 0.9, imogen: 1.25, bolt: 0.6, pip: 1.6, lou: 1.0, sid: 1.15, captain: 0.7, radio: 1.1, narrator: 1 };

export class UI {
  readonly hud: HTMLElement;
  readonly vf: HTMLElement;
  readonly prompts: HTMLElement;
  readonly toasts: HTMLElement;
  readonly letter: HTMLElement;
  readonly caption: HTMLElement;
  readonly card: HTMLElement;
  readonly dlg: HTMLElement;
  readonly modalLayer: HTMLElement;
  readonly sceneLayer: HTMLElement;
  /** world-anchored speech bubbles (V2 dialogue) */
  readonly bubbles: Bubbles;
  private portraitCache = new Map<string, string>();
  private typing: { full: string; shown: number; speed: number; done: () => void; who: string } | null = null;
  private advance: (() => void) | null = null;
  modalOpen = 0;
  dialogueOpen = false;

  constructor(readonly root: HTMLElement) {
    this.sceneLayer = root.appendChild(el('div', 'scene-layer'));
    this.sceneLayer.style.cssText = 'position:absolute;inset:0';
    this.prompts = root.appendChild(el('div'));
    this.prompts.style.cssText = 'position:absolute;inset:0';
    this.hud = root.appendChild(el('div', 'hud hidden'));
    this.vf = root.appendChild(el('div', 'vf'));
    this.letter = root.appendChild(el('div', 'letterbox'));
    this.caption = root.appendChild(el('div', 'caption'));
    this.card = root.appendChild(el('div', 'titlecard'));
    this.dlg = root.appendChild(el('div', 'dialogue panel'));
    this.dlg.innerHTML = `<div class="portrait"><img alt=""></div><div class="body"><div class="name pix"></div><div class="text"></div><div class="choices"></div><div class="next">&#9660;</div></div>`;
    this.bubbles = new Bubbles(root);
    this.toasts = root.appendChild(el('div', 'toasts'));
    this.modalLayer = root.appendChild(el('div'));
    this.dlg.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this.onAdvance();
    });
    window.addEventListener('keydown', e => {
      if (!this.dialogueOpen) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.onAdvance();
      }
    });
  }

  get blocking() {
    return this.modalOpen > 0 || this.dialogueOpen;
  }

  clearScene() {
    this.bubbles.clear();
    this.bubbles.clearSpeakers();
    this.sceneLayer.innerHTML = '';
    this.prompts.innerHTML = '';
    this.hud.innerHTML = '';
    this.hud.classList.add('hidden');
    this.vf.classList.remove('on');
    this.letterbox(false);
    this.caption.classList.remove('on');
  }

  frame(dt: number) {
    this.bubbles.update(dt);
    const t = this.typing;
    if (t) {
      const before = Math.floor(t.shown);
      t.shown = Math.min(t.full.length, t.shown + dt * t.speed);
      const now = Math.floor(t.shown);
      if (now > before) {
        const ch = t.full[now - 1];
        if (ch && /[a-z0-9]/i.test(ch) && now % 2 === 0) audio.play('dialogBlip', { pitch: VOICE[t.who] ?? 1, vol: 0.5 });
        (this.dlg.querySelector('.text') as HTMLElement).innerHTML = this.fmt(t.full.slice(0, now));
      }
      if (t.shown >= t.full.length) {
        this.typing = null;
        t.done();
      }
    }
  }

  private fmt(s: string) {
    return s.replace(/\*([^*]+)\*?/g, '<em>$1</em>');
  }

  portraitURL(who: string, expr: string = 'neutral') {
    if (peopleArt()?.CHAR_INFO[who]) return v2Portrait(who, expr);
    const key = who + ':' + expr;
    let u = this.portraitCache.get(key);
    if (!u && CREW[who]) {
      u = portrait(who, (expr ?? 'neutral') as 'neutral');
      this.portraitCache.set(key, u);
    }
    return u ?? '';
  }

  private onAdvance() {
    if (this.typing) {
      const t = this.typing;
      t.shown = t.full.length;
      (this.dlg.querySelector('.text') as HTMLElement).innerHTML = this.fmt(t.full);
      this.typing = null;
      t.done();
      return;
    }
    const a = this.advance;
    if (a) {
      this.advance = null;
      a();
    }
  }

  /** Show a sequence of dialogue lines; resolves with the index of the last choice (or -1). */
  async say(lines: Line[]): Promise<number> {
    this.dialogueOpen = true;
    this.dlg.classList.add('on');
    let choice = -1;
    for (const line of lines) {
      const img = this.dlg.querySelector('.portrait img') as HTMLImageElement;
      const pw = this.dlg.querySelector('.portrait') as HTMLElement;
      const url = this.portraitURL(line.who, line.expr);
      pw.style.display = url ? '' : 'none';
      if (url) img.src = url;
      img.classList.add('talking');
      (this.dlg.querySelector('.name') as HTMLElement).textContent = DISPLAY_NAMES[line.who] ?? line.who;
      (this.dlg.querySelector('.text') as HTMLElement).innerHTML = '';
      const next = this.dlg.querySelector('.next') as HTMLElement;
      const chs = this.dlg.querySelector('.choices') as HTMLElement;
      chs.innerHTML = '';
      next.classList.remove('on');
      await new Promise<void>(res => {
        this.typing = { full: line.text, shown: 0, speed: 52, done: res, who: line.who };
      });
      img.classList.remove('talking');
      if (line.choices) {
        choice = await new Promise<number>(res => {
          line.choices!.forEach((c, i) => {
            const b = el('button', 'btn ghost', `<span class="key">${i + 1}</span> ${c}`);
            b.addEventListener('pointerdown', e => {
              e.stopPropagation();
              audio.play('ui');
              window.removeEventListener('keydown', kh);
              res(i);
            });
            chs.appendChild(b);
          });
          const kh = (e: KeyboardEvent) => {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= line.choices!.length) {
              window.removeEventListener('keydown', kh);
              audio.play('ui');
              res(n - 1);
            }
          };
          window.addEventListener('keydown', kh);
        });
        chs.innerHTML = '';
      } else {
        next.classList.add('on');
        await new Promise<void>(res => (this.advance = res));
        audio.play('ui', { vol: 0.4 });
      }
    }
    this.dlg.classList.remove('on');
    this.dialogueOpen = false;
    guardInput(300);
    await new Promise(res => setTimeout(res, 120));
    return choice;
  }

  toast(text: string, tag = 'NOTE', kind: '' | 'teal' | 'coral' = '', ms = 3200) {
    const t = el('div', `toast panel ${kind}`, `<span class="ic">${tag}</span><span>${text}</span>`);
    this.toasts.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 420);
    }, ms);
  }

  letterbox(on: boolean) {
    this.letter.classList.toggle('on', on);
  }

  async showCaption(text: string, ms = 2600) {
    this.caption.innerHTML = text;
    this.caption.classList.add('on');
    await new Promise(r => setTimeout(r, ms));
    this.caption.classList.remove('on');
    await new Promise(r => setTimeout(r, 500));
  }

  async titleCard(ch: string, name: string, sub = '', ms = 3200) {
    this.card.innerHTML = `<div class="ch">${ch}</div><div class="nm">${name}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this.card.classList.add('on');
    await new Promise(r => setTimeout(r, ms));
    this.card.classList.remove('on');
    await new Promise(r => setTimeout(r, 900));
  }

  /** Open a modal; returns a close function. */
  modal(content: HTMLElement, onClose?: () => void, dismissable = true) {
    const wrap = el('div', 'modal-wrap');
    wrap.appendChild(content);
    content.classList.add('modal');
    this.modalLayer.appendChild(wrap);
    this.modalOpen++;
    requestAnimationFrame(() => wrap.classList.add('on'));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.modalOpen--;
      guardInput(250);
      window.removeEventListener('keydown', kh);
      wrap.classList.remove('on');
      setTimeout(() => wrap.remove(), 200);
      onClose?.();
    };
    const kh = (e: KeyboardEvent) => {
      if (dismissable && (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyJ')) {
        e.preventDefault();
        audio.play('uiBack');
        close();
      }
    };
    window.addEventListener('keydown', kh);
    if (dismissable) wrap.addEventListener('pointerdown', e => { if (e.target === wrap) { audio.play('uiBack'); close(); } });
    return close;
  }

  /** Convert view art-pixel coords to CSS pixels within the UI root. */
  artToCss(ax: number, ay: number, VW: number, VH: number) {
    const r = this.root.getBoundingClientRect();
    return [(ax / VW) * r.width, (ay / VH) * r.height];
  }
}
