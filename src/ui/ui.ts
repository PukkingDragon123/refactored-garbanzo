// HTML overlay UI: HUD, viewfinder, dialogue (typewriter + portraits), toasts, letterbox, modals.

import { portrait } from '../game/assets';
import { CREW } from '../art/characters';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';
import { Bubbles } from './bubbles';
import { iconize, pxIcon } from './pxicons';
import { portraitURL as v2Portrait, peopleArt } from '../world/actor';
import { Art, col, dith } from './v11/paper/px';
import { drawText, textWidth } from './v11/paper/pxfont';
import { outlined, hudScale } from './v11/hudpx';

/**
 * A chapter / arrival title card as pixel art: the chapter word in small caps on a dark tab, the
 * name in big blocky caps with a hard outline and drop, a brass rule with diamond ends, the subtitle
 * in Mori's pixel hand, all on a dithered dark band. Bitmap text only: crisp at any size.
 */
function titleCardArt(ch: string, name: string, sub: string, maxW: number): Art {
  const NM = name.toUpperCase(), CH = ch.toUpperCase();
  let k = 3;
  while (k > 1 && textWidth(NM, { face: 'block', scale: k, spacing: 1 }) > maxW - 40) k--;
  const nw = textWidth(NM, { face: 'block', scale: k, spacing: 1 });
  const cw = CH ? textWidth(CH, { face: 'block', bold: false, spacing: 3 }) : 0;
  const sk = 2;
  const sw = sub ? textWidth(sub, { scale: sk }) : 0;
  const W = Math.max(nw, cw, sw) + 80;
  const H = (CH ? 16 : 4) + 7 * k + 10 + (sub ? 11 * sk + 8 : 4) + 10;
  const a = new Art(W, H);
  const out = col('#1a0e06'), cream = col('#f6ead0'), teal = col('#9ff0dc'), brass = col('#e0b048'), brassD = col('#7a5414'), amber = col('#ffd57a');
  // the band: dithered darkness, thicker in the middle, ragged ends
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ex = Math.min(x, W - 1 - x) / 40, ey = Math.min(y, H - 1 - y) / 10;
    const cov = Math.min(1, Math.min(ex, 1) * 0.75) * Math.min(1, ey + 0.35);
    if (dith(x, y, cov * 0.8)) a.put(x, y, col('#06080a', 0.78));
  }
  let y = 4;
  if (CH) {
    const tx = Math.round(W / 2 - cw / 2);
    a.rect(tx - 6, y, cw + 12, 11, out); a.rect(tx - 5, y + 1, cw + 10, 9, col('#21403a'));
    drawText(a, CH, tx, y + 9, teal, { face: 'block', bold: false, spacing: 3 });
    y += 16;
  }
  const nx = Math.round(W / 2 - nw / 2), ny = y + 7 * k;
  drawText(a, NM, nx + k, ny + k, col('#000000', 0.55), { face: 'block', scale: k, spacing: 1 });
  outlined(a, NM, nx, ny, (px, py) => (py - (ny - 7 * k) < k ? col('#fffaf0') : cream), out, { face: 'block', scale: k, spacing: 1 });
  y = ny + 6;
  // the rule
  const rw = Math.round(Math.max(nw, sw) * 0.8), rx = Math.round(W / 2 - rw / 2);
  a.rect(rx, y, rw, 1, brass); a.rect(rx, y + 1, rw, 1, brassD);
  for (const dx of [rx - 3, rx + rw + 1]) { a.put(dx + 1, y - 1, brass); a.rect(dx, y, 3, 1, brass); a.put(dx + 1, y + 1, brassD); }
  y += 4;
  if (sub) {
    const sx = Math.round(W / 2 - sw / 2);
    outlined(a, sub, sx, y + 8 * sk, amber, out, { scale: sk });
  }
  return a;
}

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
    this.dlg.innerHTML = `<div class="portrait"><img alt=""></div><div class="body"><div class="name pix"></div><div class="text"></div><div class="choices"></div><div class="next">${pxIcon('down', { scale: 2 })}</div></div>`;
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
    return iconize(s.replace(/\*([^*]+)\*?/g, '<em>$1</em>'));
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
    const t = el('div', `toast panel ${kind}`, `<span class="ic">${tag}</span><span>${iconize(text)}</span>`);
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
    const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&middot;/g, '\u00b7').replace(/&[a-z]+;/g, '');
    const s = hudScale();
    const art = titleCardArt(plain(ch), plain(name), plain(sub), Math.floor((window.innerWidth * 0.92) / s));
    const cv = art.canvas();
    cv.className = 'tc-px';
    cv.style.width = art.w * s + 'px';
    cv.style.height = art.h * s + 'px';
    this.card.innerHTML = '';
    this.card.appendChild(cv);
    this.card.setAttribute('aria-label', plain(`${ch} ${name} ${sub}`));
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
