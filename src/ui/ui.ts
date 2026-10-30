// HTML overlay UI: the layers, the viewfinder, the letterbox, modals. V12: no HUD, no dialogue box and
// no toasts; every line of text floats in the world (src/ui/v12/float.ts): say() runs through the
// floating dialogue, toast() is a floating notice near Mori, titleCard() writes big letters in the sky
// and showCaption() floats a caption low on the screen.

import { portrait } from '../game/assets';
import { CREW } from '../art/characters';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';
import { Bubbles } from './bubbles';
import { portraitURL as v2Portrait, peopleArt } from '../world/actor';
import { floatToast, floatCaption, floatSky } from './v12/float';

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
  /** the floating dialogue (conversations, barks, answers) */
  readonly bubbles: Bubbles;
  private portraitCache = new Map<string, string>();
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
    // (the old dialogue panel and toast stack stay as empty, never-shown elements for older callers)
    this.dlg = root.appendChild(el('div', 'dialogue panel'));
    this.bubbles = new Bubbles(root);
    this.toasts = root.appendChild(el('div', 'toasts'));
    this.modalLayer = root.appendChild(el('div'));
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

  /** Show a sequence of dialogue lines; resolves with the index of the last choice (or -1). V12: the
   *  lines float by their speakers like every other conversation. */
  async say(lines: Line[]): Promise<number> {
    const c = await this.bubbles.say(lines.map(l => ({ who: l.who, text: l.text, expr: l.expr, choices: l.choices })));
    await new Promise(res => setTimeout(res, 120));
    return c;
  }

  /** a notice floating up near Mori (the old toast; the tag becomes a small coloured word) */
  toast(text: string, tag = 'NOTE', kind: '' | 'teal' | 'coral' = '', ms = 3200) {
    floatToast(text, tag, kind, ms);
  }

  letterbox(on: boolean) {
    this.letter.classList.toggle('on', on);
  }

  /** a caption floating low on the screen */
  async showCaption(text: string, ms = 2600) {
    await floatCaption(text, ms);
    await new Promise(r => setTimeout(r, 200));
  }

  /** a chapter / day / arrival card: big pixel letters in the sky */
  async titleCard(ch: string, name: string, sub = '', ms = 3200) {
    await floatSky(name, sub, ch, ms);
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
