// Comic speech bubbles anchored above characters' heads, with typewriter text, voice blips,
// shout / whisper / thought / phone styles, choices, reactions and ambient "barks".

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { guardInput } from '../core/input';
import { SPECIES, CLUES } from '../game/species';
import { ITEMS } from '../game/items';

// ---------------------------------------------------------------- pixel bubble skins
function px(w: number, h: number, rows: (x: number, y: number) => string | null): string {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows(x, y); if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
  return `url(${cv.toDataURL()})`;
}
/** 9-slice bubble: stepped pixel corners, `k`px outline. */
function bubbleImg(fill: string, ink: string, o: { k?: number; dash?: boolean; jag?: boolean; cloud?: boolean } = {}) {
  const k = o.k ?? 1, N = 9;
  return px(N, N, (x, y) => {
    const d = Math.min(x, y, N - 1 - x, N - 1 - y);
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    // stepped corner cut
    if (cx + cy < (o.cloud ? 3 : 2)) return null;
    if (o.jag && (x + y) % 3 === 0 && d === 0) return null;
    const edge = d < k || cx + cy < (o.cloud ? 3 : 2) + k;
    if (edge) return o.dash && (x + y) % 2 === 0 && d === 0 ? null : ink;
    if (d === k && y > N / 2 && fill === '#ffffff') return '#d8d8e0';
    return fill;
  });
}
function tailImg(fill: string, ink: string) {
  return px(9, 7, (x, y) => {
    const half = 4 - Math.floor(y * 4 / 6);
    const dx = Math.abs(x - 4 + Math.floor(y / 3));
    if (dx > half) return null;
    return dx === half || y === 6 ? ink : fill;
  });
}
let skinned = false;
function installBubbleSkin() {
  if (skinned) return;
  skinned = true;
  const r = document.documentElement.style;
  r.setProperty('--bub-img', bubbleImg('#ffffff', '#0c0a0c'));
  r.setProperty('--bub-shout', bubbleImg('#ffffff', '#0c0a0c', { k: 2, jag: true }));
  r.setProperty('--bub-dash', bubbleImg('#f4f4f6', '#6a6a78', { dash: true }));
  r.setProperty('--bub-cloud', bubbleImg('#ffffff', '#0c0a0c', { cloud: true }));
  r.setProperty('--bub-phone', bubbleImg('#10201c', '#9dffd8'));
  r.setProperty('--tail-img', tailImg('#ffffff', '#0c0a0c'));
  r.setProperty('--tail-phone', tailImg('#10201c', '#9dffd8'));
  r.setProperty('--think-img', px(8, 9, (x, y) => {
    const a = Math.hypot(x - 5, y - 2) , b = Math.hypot(x - 2.5, y - 7);
    if (a < 2.6) return a > 1.6 ? '#0c0a0c' : '#ffffff';
    if (b < 1.6) return b > 0.8 ? '#0c0a0c' : '#ffffff';
    return null;
  }));
}

// words that get a highlighter: species, clues, places, key items
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

/** Split formatted HTML into per-character spans (tags kept), grouping words so lines wrap on spaces. */
function charSpans(html: string): string {
  let out = '', i = 0, k = 0, inWord = false;
  const open = () => { if (!inWord) { out += '<span class="w">'; inWord = true; } };
  const close = () => { if (inWord) { out += '</span>'; inWord = false; } };
  while (i < html.length) {
    const ch = html[i];
    if (ch === '<') {
      const j = html.indexOf('>', i);
      const tag = html.slice(i, j + 1);
      // keep words intact across inline tags by closing the word only on closing tags followed by a space
      out += tag;
      i = j + 1;
      continue;
    }
    let tok = ch;
    if (ch === '&') { const j = html.indexOf(';', i); tok = html.slice(i, j + 1); }
    i += tok.length;
    if (tok === ' ') { close(); out += `<span class="c s"> </span>`; k++; continue; }
    open();
    out += `<span class="c" style="--i:${k++}">${tok}</span>`;
  }
  close();
  return out;
}

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
.bub { position: absolute; left: 0; top: 0; max-width: min(30em, 46vw); min-width: 5em; transform-origin: 50% 100%; pointer-events: none; will-change: transform; }
.bub .box { position: relative; color: #0c0a0c; font-family: 'Pixelify Sans', 'Silkscreen', monospace; font-size: 1.05em; line-height: 1.32;
  border-style: solid; border-width: 9px; border-image: var(--bub-img) 3 fill / 9px / 0 stretch; image-rendering: pixelated; padding: 0.15em 0.35em 0.2em;
  filter: drop-shadow(0 4px 0 rgba(0,0,0,0.45)); -webkit-font-smoothing: none; }
.bub .nm { position: absolute; left: -2px; top: -1.75em; font-family: 'Silkscreen', 'Pixelify Sans', monospace; font-weight: 700; font-size: 0.72em; padding: 0.15em 0.6em 0.1em 0.5em;
  color: #fff; background: #0c0a0c; white-space: nowrap; letter-spacing: 0.06em; text-transform: uppercase; box-shadow: inset 0.35em 0 0 var(--c, #3fbca6), 0 3px 0 rgba(0,0,0,0.4); }
.bub .inner { position: relative; isolation: isolate; }
.bub .tx { position: relative; }
.bub .tx .w { white-space: nowrap; }
.bub .tx .c.s.on { display: inline; animation: none; white-space: pre-wrap; }
.bub .tx .c { display: inline; opacity: 0; }
.bub .tx .c.on { opacity: 1; display: inline-block; white-space: pre; animation: chPop 0.18s cubic-bezier(.2,1.9,.4,1) both; }
.bub .tx .sp { display: inline; white-space: pre-wrap; }
@keyframes chPop { 0% { transform: translateY(-5px) scale(1.5); opacity: 0; } 100% { transform: none; opacity: 1; } }
/* highlighted words: *emphasis* shakes in red, keywords get a yellow marker and a wave */
.bub .tx em { font-style: normal; color: #d0301e; }
.bub .tx em .c.on { animation: chPop 0.18s cubic-bezier(.2,1.9,.4,1) both, chShake 0.25s steps(2) infinite 0.2s; }
.bub .tx mark { background: none; color: #0c0a0c; }
.bub .tx mark .c.on { background: linear-gradient(transparent 40%, #ffe45a 40%, #ffe45a 92%, transparent 92%); }
.bub .tx mark .c.on { animation: chPop 0.18s cubic-bezier(.2,1.9,.4,1) both, chWave 1.2s ease-in-out infinite; animation-delay: 0s, calc(var(--i, 0) * 0.07s); }
.bub .tx i { font-style: normal; color: #6a6a78; }
@keyframes chShake { 0% { transform: translate(0, 0); } 50% { transform: translate(1px, -1px); } }
@keyframes chWave { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
/* typing indicator (before the line) and caret (while typing) */
.bub .typing { display: none; gap: 0.25em; padding: 0.15em 0.1em; }
.bub.pre .typing { display: flex; }
.bub.pre .tx { visibility: hidden; height: 0; overflow: hidden; }
.bub .typing b { width: 0.42em; height: 0.42em; background: #0c0a0c; animation: tyDot 0.9s steps(3) infinite; }
.bub .typing b:nth-child(2) { animation-delay: 0.15s; } .bub .typing b:nth-child(3) { animation-delay: 0.3s; }
@keyframes tyDot { 0%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-4px); opacity: 1; } }
.bub .caret { display: inline-block; width: 0.45em; height: 0.9em; background: #0c0a0c; vertical-align: -0.1em; margin-left: 1px; animation: caret 0.5s steps(1) infinite; }
.bub.done .caret { display: none; }
@keyframes caret { 50% { opacity: 0; } }
.bub .tail { position: absolute; bottom: -12px; width: 18px; height: 14px; left: var(--tx, 50%); transform: translateX(-50%); background: var(--tail-img) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
.bub .more { position: absolute; right: 2px; bottom: -3px; width: 0.8em; height: 0.55em; background: #0c0a0c; clip-path: polygon(0 0, 100% 0, 50% 100%); animation: bubNext 0.6s steps(2) infinite; opacity: 0; }
.bub.done .more { opacity: 1; }
.bub .chs { display: flex; flex-direction: column; gap: 0.3em; margin-top: 0.45em; pointer-events: auto; }
.bub .chs button { text-align: left; font-family: 'Pixelify Sans', monospace; font-size: 0.95em; background: #fff; color: #0c0a0c; border: 0; box-shadow: 0 0 0 3px #0c0a0c;
  padding: 0.25em 0.6em; margin: 3px; cursor: pointer; }
.bub .chs button:hover, .bub .chs button.sel { background: #0c0a0c; color: #fff; transform: translateX(4px); }
.bub .chs button.sel::before { content: '▶ '; }
.bub .chs .key { box-shadow: none !important; background: #0c0a0c !important; color: #fff !important; }
.bub .chs button.sel .key { background: #fff !important; color: #0c0a0c !important; }
/* anime effects */
.bub .fx { position: absolute; pointer-events: none; }
.bub .fx.burst { inset: -1.6em -2.2em; z-index: -1; opacity: 0; background: repeating-conic-gradient(from 0deg, #0c0a0c 0 3deg, transparent 3deg 14deg);
  -webkit-mask: radial-gradient(closest-side, transparent 58%, #000 60%, #000 92%, transparent 100%); mask: radial-gradient(closest-side, transparent 58%, #000 60%, #000 92%, transparent 100%); }
.bub.shout .fx.burst { opacity: 0.9; animation: burstSpin 0.4s steps(3) infinite; }
@keyframes burstSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(4deg) scale(1.04); } 100% { transform: rotate(8deg) scale(1); } }
.bub .fx.marks { right: -0.9em; top: -1.4em; font-family: 'Silkscreen', monospace; font-weight: 700; font-size: 1.3em; color: #0c0a0c; display: none; text-shadow: 2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff; transform: rotate(12deg); }
.bub.shout .fx.marks { display: block; animation: marksPop 0.35s cubic-bezier(.2,1.9,.4,1) both; }
@keyframes marksPop { from { transform: rotate(12deg) scale(0); } }
.bub.shout .box { font-size: 1.2em; font-weight: 700; --bub-img: var(--bub-shout); }
.bub.shout .inner { animation: bubShake 0.1s steps(2) infinite; }
.bub.whisper .box { --bub-img: var(--bub-dash); color: #55555f; font-size: 0.95em; }
.bub.whisper .fx.marks { display: block; content: ''; }
.bub.think .box { --bub-img: var(--bub-cloud); color: #3a3a48; }
.bub.think .tail { background-image: var(--think-img); width: 16px; height: 18px; bottom: -18px; }
.bub.phone .box { --bub-img: var(--bub-phone); color: #9dffd8; font-family: 'Silkscreen', monospace; font-size: 0.95em; letter-spacing: 0.02em; }
.bub.phone .box::before { content: '◉ TRANSLATE.EXE'; display: block; font-size: 0.7em; color: #3fbca6; margin-bottom: 0.25em; animation: caret 1s steps(1) infinite; }
.bub.phone .tail { background-image: var(--tail-phone); }
.bub.phone .nm, .bub.phone .typing b, .bub.phone .caret { background: #9dffd8; color: #0c0a0c; }
.bub.phone .tx mark { background: none; color: #ffe45a; }
.bub.bark .box { font-size: 0.9em; }
.bub.bark .nm { display: none; }
.bub.edge .tail { display: none; }
.bub .pp { transform-origin: var(--tx, 50%) 100%; }
.bub.pop .pp { animation: bubPop 0.3s cubic-bezier(.2,1.7,.4,1) both; }
.bub.out .pp { animation: bubOut 0.14s steps(3) both; }
@keyframes bubPop { 0% { transform: scale(0.2, 0.2); opacity: 0; } 40% { transform: scale(1.18, 0.86); opacity: 1; } 70% { transform: scale(0.94, 1.06); } 100% { transform: none; } }
@keyframes bubOut { to { transform: scale(1.25, 0.2); opacity: 0; } }
@keyframes bubNext { 50% { transform: translateY(3px); } }
@keyframes bubShake { 0% { transform: translate(0, 0); } 50% { transform: translate(2px, -1px); } 100% { transform: translate(-1px, 1px); } }
@media (prefers-reduced-motion: reduce) { .bub.shout .inner, .bub .tx .c.on, .bub.shout .fx.burst { animation: none !important; } }
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
  chars: HTMLElement[];
  plain: string;
  pre: number;
  caret: HTMLElement;
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
      installBubbleSkin();
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
    return s
      .replace(/\*([^*]+)\*?/g, '\u0001$1\u0002')
      .replace(keywords(), '<mark>$1</mark>')
      .replace(/\u0001/g, '<em>').replace(/\u0002/g, '</em>')
      .replace(/_([^_]+)_?/g, '<i>$1</i>');
  }

  private make(line: BubbleLine, bark: boolean): Live {
    const sp = this.speakers.get(line.who);
    const style = line.style ?? 'say';
    const b = el('div', `bub ${style}${bark ? ' bark' : ' pre'}`);
    b.style.visibility = 'hidden';
    const marks = style === 'shout' ? (/[?]/.test(line.text) ? '!?' : '!!') : '';
    b.innerHTML = `<div class="pp"><div class="inner"><div class="fx burst"></div><div class="box"><div class="nm"></div><div class="typing"><b></b><b></b><b></b></div><div class="tx"></div><div class="chs"></div><div class="more"></div></div><div class="tail"></div><div class="fx marks">${marks}</div></div></div>`;
    const nm = b.querySelector('.nm') as HTMLElement;
    nm.textContent = sp?.name ?? line.who;
    b.style.setProperty('--c', sp?.color ?? '#3fbca6');
    this.root.appendChild(b);
    const tx = b.querySelector('.tx') as HTMLElement;
    tx.innerHTML = charSpans(this.fmt(line.text));
    const chars = [...tx.querySelectorAll('.c')] as HTMLElement[];
    const caret = el('span', 'caret');
    const lv: Live = {
      el: b, box: b.querySelector('.box') as HTMLElement, tx, who: line.who,
      full: line.text, shown: 0, speed: 46 * (line.speed ?? 1) * (style === 'shout' ? 1.3 : style === 'whisper' ? 0.8 : 1), pause: 0,
      done: false, bark, ttl: bark ? 2.4 + line.text.length * 0.045 : Infinity, w: 0, h: 0,
      chars, plain: chars.map(c => c.textContent ?? '').join(''), pre: bark ? 0 : 0.32, caret,
    };
    lv.w = b.offsetWidth;
    lv.h = b.offsetHeight;
    this.live.push(lv);
    // position first, then reveal and pop in place (never animates in from the corner)
    this.place(lv);
    b.style.visibility = '';
    void b.offsetWidth;
    b.classList.add('pop');
    setTimeout(() => b.classList.remove('pop'), 360);
    audio.play(('bubblePop' as unknown) as 'ui', { vol: 0.35, pitch: 0.9 + (sp?.voice ?? 1) * 0.15 });
    if (style === 'shout') (game.scene as { st?: { shake(a: number, t: number): void } } | null)?.st?.shake(2, 0.25);
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
    if (!lv.el.classList.contains('out')) lv.el.style.transform = pos;
  }

  /** per-frame: typewriter + follow speakers */
  update(dt: number) {
    for (const lv of [...this.live]) {
      this.place(lv);
      if (!lv.done) {
        if (lv.pre > 0 && !this.skipTyping) {
          lv.pre -= dt;
          if (lv.pre <= 0) { lv.el.classList.remove('pre'); this.place(lv); }
          continue;
        }
        if (lv.el.classList.contains('pre')) { lv.el.classList.remove('pre'); this.place(lv); }
        const before = Math.floor(lv.shown);
        if (this.skipTyping && !lv.bark) {
          lv.shown = lv.chars.length;
        } else if (lv.pause > 0) lv.pause -= dt;
        else {
          lv.shown = Math.min(lv.chars.length, lv.shown + dt * lv.speed);
          const now = Math.floor(lv.shown);
          if (now > before) {
            const ch = lv.plain[now - 1];
            if (/[.!?]/.test(ch) && lv.plain[now] === ' ') lv.pause = 0.22;
            else if (/[,;:—]/.test(ch)) lv.pause = 0.1;
            if (ch && /[a-z0-9]/i.test(ch) && now % 2 === 0) {
              const sp = this.speakers.get(lv.who);
              audio.play('dialogBlip', { pitch: (sp?.voice ?? 1) * (0.94 + Math.random() * 0.12), vol: lv.bark ? 0.25 : 0.45 });
            }
          }
        }
        const now = Math.floor(lv.shown);
        for (let i = before; i < now; i++) lv.chars[i]?.classList.add('on');
        if (now > 0 && now < lv.chars.length) lv.chars[now - 1].after(lv.caret);
        if (lv.shown >= lv.chars.length) {
          for (const c of lv.chars) c.classList.add('on');
          lv.caret.remove();
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
