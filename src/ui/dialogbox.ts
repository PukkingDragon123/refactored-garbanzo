// Stardew-Valley-style dialogue box: a wooden-framed parchment text panel along the bottom of the
// screen with the speaker's front-facing anime portrait in its own frame (name plate underneath).
// The portrait talks while the text types, blinks, and swaps expression per line; shouts shake the
// box, whispers go grey, thoughts go italic. The text itself is typed by Bubbles (same typewriter).

import { el } from './ui';
import { peopleArt } from '../world/actor';

const CSS = `
.dbx-wrap { position: absolute; left: 0; right: 0; bottom: max(6px, 1.6vh); display: flex; justify-content: center; pointer-events: none; z-index: 6;
  opacity: 0; transform: translateY(18px); transition: opacity 0.16s, transform 0.2s cubic-bezier(.2,1.5,.4,1); --ps: 3; }
.dbx-wrap.on { opacity: 1; transform: none; }
.dbx { display: flex; align-items: stretch; gap: 6px; width: min(97vw, 1000px); }
.dbx .dtx, .dbx .dpt { border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round;
  image-rendering: pixelated; filter: drop-shadow(0 5px 0 rgba(0,0,0,0.35)); }
.dbx .dtx { position: relative; flex: 1; min-height: calc(60px * var(--ps) + 1.6em); color: #3a2614; font-family: 'Jersey 15', 'Pixelify Sans', 'Silkscreen', monospace;
  font-size: clamp(15px, 2.05vw, 23px); line-height: 1.38; padding: 0.15em 0.45em; -webkit-font-smoothing: none; }
.dbx .dtx .tx .w { white-space: nowrap; }
.dbx .dtx .tx .c { opacity: 0; }
.dbx .dtx .tx .c.on { opacity: 1; display: inline-block; white-space: pre; animation: dbxCh 0.14s steps(2) both; }
.dbx .dtx .tx .c.s.on { display: inline; animation: none; white-space: pre-wrap; }
@keyframes dbxCh { from { transform: translateY(-3px); opacity: 0; } }
.dbx .dtx .tx em { font-style: normal; color: #b8301e; }
.dbx .dtx .tx em .c.on { animation: dbxCh 0.14s steps(2) both, dbxShake 0.25s steps(2) infinite 0.2s; }
.dbx .dtx .tx mark { background: none; color: #2f6b2a; }
.dbx .dtx .tx mark .c.on { background: linear-gradient(transparent 55%, rgba(255,214,70,0.75) 55%, rgba(255,214,70,0.75) 92%, transparent 92%); }
.dbx .dtx .tx i { font-style: normal; color: #7a6a58; }
@keyframes dbxShake { 50% { transform: translate(1px, -1px); } }
.dbx .dtx .caret { display: inline-block; width: 0.42em; height: 0.85em; background: #3a2614; vertical-align: -0.08em; margin-left: 1px; animation: dbxCaret 0.5s steps(1) infinite; }
@keyframes dbxCaret { 50% { opacity: 0; } }
.dbx .dtx .more { position: absolute; right: 0.2em; bottom: 0.05em; width: 0.9em; height: 0.6em; background: #c8841c; box-shadow: 0 0 0 2px #3a2614;
  clip-path: polygon(0 0, 100% 0, 50% 100%); opacity: 0; animation: dbxMore 0.6s steps(2) infinite; }
.dbx.done .dtx .more { opacity: 1; }
@keyframes dbxMore { 50% { transform: translateY(3px); } }
.dbx .dtx .chs { display: flex; flex-direction: column; gap: 0.2em; margin-top: 0.35em; pointer-events: auto; }
.dbx .dtx .chs button { text-align: left; font-family: inherit; font-size: 0.92em; color: #3a2614; background: rgba(120,80,30,0.12); border: 0;
  box-shadow: inset 0 0 0 2px rgba(90,60,20,0.35); padding: 0.18em 0.6em; cursor: pointer; }
.dbx .dtx .chs button.sel, .dbx .dtx .chs button:hover { background: rgba(90,164,71,0.3); box-shadow: inset 0 0 0 2px #3f7a34; }
.dbx .dtx .chs button.sel::before { content: '▶ '; color: #2f6b2a; }
.dbx .dtx .chs .key { margin: 0 0.35em 0 0 !important; }
.dbx .dtx .nmx { font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 0.62em; color: #6a4a2a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.1em; display: none; }
.dbx.noport .dtx .nmx { display: block; }
.dbx .dpt { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 0; background: none; }
.dbx.noport .dpt { display: none; }
.dbx .dpt .well { position: relative; width: calc(56px * var(--ps)); height: calc(60px * var(--ps)); background: radial-gradient(circle at 50% 42%, var(--pc1, #f4e0b0), var(--pc2, #c89a5a));
  box-shadow: inset 0 0 0 2px rgba(58,38,20,0.45); overflow: hidden; }
.dbx .dpt canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; transform-origin: 50% 100%; }
.dbx.bob .dpt canvas { animation: dbxBob 0.32s cubic-bezier(.2,1.8,.4,1); }
@keyframes dbxBob { 30% { transform: translateY(-4%) scale(1.03, 0.98); } }
.dbx.shake .dpt canvas, .dbx.shout .dtx { animation: dbxShakeBox 0.1s steps(2) infinite; }
@keyframes dbxShakeBox { 50% { transform: translate(2px, -1px); } }
.dbx .dpt .plate { margin-top: 4px; font-family: 'Jersey 10', 'Silkscreen', 'Pixelify Sans', monospace; font-weight: 700; font-size: clamp(11px, 1.35vw, 16px); letter-spacing: 0.08em;
  text-transform: uppercase; color: #fff; background: var(--pc3, #2f6b2a); padding: 0.18em 0.8em 0.12em; box-shadow: 0 0 0 2px #2a1a10, 0 3px 0 2px #2a1a10; white-space: nowrap; }
.dbx.shout .dtx { font-weight: 700; }
.dbx.whisper .dtx .tx { color: #7a6a58; }
.dbx.think .dtx .tx { color: #5a4a6a; font-style: italic; }
@media (max-width: 720px), (max-height: 620px) { .dbx-wrap { --ps: 2; } }
@media (max-height: 520px) { .dbx-wrap { --ps: 1.5; --sk-u: 2px; bottom: 4px; } .dbx .dtx { font-size: 14px; min-height: calc(60px * var(--ps) + 1.2em); } .dbx .dpt .plate { font-size: 10px; } }
@media (max-width: 460px) { .dbx .dtx { font-size: 14px; } }
`;

/** portrait well colours per character */
const TINT: Record<string, [string, string, string]> = {
  mori: ['#e8f0c8', '#8aa86a', '#4a6a2a'],
  jenna: ['#fbe0f0', '#d890c0', '#b04a8a'],
  joshu: ['#dfe8f4', '#7a90b0', '#2c3a5a'],
  aroha: ['#f4e4c4', '#c8945a', '#8a4a24'],
  chunk: ['#fde8c8', '#e8a868', '#c8402e'],
};
const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };

export const hasPortrait = (id: string) => (ALIAS[id] ?? id) in TINT;

let styled = false;

export class PortraitBox {
  readonly root: HTMLElement;
  readonly box: HTMLElement;
  /** where line content (text, choices, more arrow) is mounted */
  readonly area: HTMLElement;
  private cv: HTMLCanvasElement;
  private plate: HTMLElement;
  private nmx: HTMLElement;
  private who = '';
  private expr = 'neutral';
  private mouth: 0 | 1 | 2 = 0;
  private mouthT = 0;
  private blinkT = 2.5;
  private blink = 0;
  private drawn = '';
  private cache = new Map<string, HTMLCanvasElement>();
  talking: () => boolean = () => false;
  active = false;

  constructor(parent: HTMLElement) {
    if (!styled) {
      document.head.appendChild(el('style', '', CSS));
      styled = true;
    }
    this.root = parent.appendChild(el('div', 'dbx-wrap'));
    this.root.innerHTML = `<div class="dbx"><div class="dtx"><div class="nmx"></div><div class="area"></div></div><div class="dpt"><div class="well"><canvas width="56" height="60"></canvas></div><div class="plate"></div></div></div>`;
    this.box = this.root.querySelector('.dbx') as HTMLElement;
    this.area = this.root.querySelector('.area') as HTMLElement;
    this.cv = this.root.querySelector('canvas') as HTMLCanvasElement;
    this.plate = this.root.querySelector('.plate') as HTMLElement;
    this.nmx = this.root.querySelector('.nmx') as HTMLElement;
  }

  /** Open (or keep open) the box for a speaker. */
  show(who: string, name: string, expr: string | undefined, style: string | undefined) {
    const id = ALIAS[who] ?? who;
    const port = id in TINT;
    const changedWho = id !== this.who;
    const e = expr ?? (changedWho ? 'neutral' : this.expr);
    const changedExpr = e !== this.expr || changedWho;
    this.who = id;
    this.expr = e;
    this.box.classList.toggle('noport', !port);
    this.box.className = `dbx${port ? '' : ' noport'} ${style ?? 'say'}`;
    this.plate.textContent = name;
    this.nmx.textContent = port ? '' : name;
    const t = TINT[id];
    if (t) {
      this.box.style.setProperty('--pc1', t[0]);
      this.box.style.setProperty('--pc2', t[1]);
      this.box.style.setProperty('--pc3', t[2]);
    }
    if (changedExpr && this.active) {
      this.box.classList.remove('bob');
      void this.box.offsetWidth;
      this.box.classList.add('bob');
    }
    if (['shocked', 'scared', 'angry', 'surprised'].includes(e) && changedExpr) {
      this.box.classList.add('shake');
      setTimeout(() => this.box.classList.remove('shake'), 260);
    }
    this.area.innerHTML = '';
    this.active = true;
    this.root.classList.add('on');
    this.redraw(true);
  }

  setDone(done: boolean) {
    this.box.classList.toggle('done', done);
  }

  hide() {
    if (!this.active) return;
    this.active = false;
    this.root.classList.remove('on');
    this.who = '';
    this.expr = 'neutral';
    setTimeout(() => { if (!this.active) this.area.innerHTML = ''; }, 200);
  }

  private frame(expr: string, mouth: 0 | 1 | 2, blink: boolean): HTMLCanvasElement | null {
    const art = peopleArt();
    if (!art) return null;
    const key = `${this.who}|${expr}|${mouth}|${blink ? 1 : 0}`;
    let c = this.cache.get(key);
    if (!c) {
      const buf = art.renderPortrait(this.who, expr, { mouth, blink });
      c = document.createElement('canvas');
      c.width = buf.w;
      c.height = buf.h;
      const img = new ImageData(new Uint8ClampedArray(buf.bytes.buffer, buf.bytes.byteOffset, buf.bytes.byteLength).slice(), buf.w, buf.h);
      c.getContext('2d')!.putImageData(img, 0, 0);
      this.cache.set(key, c);
    }
    return c;
  }

  private redraw(force = false) {
    if (!this.who || !(this.who in TINT)) return;
    const key = `${this.expr}|${this.mouth}|${this.blink > 0 ? 1 : 0}`;
    if (!force && key === this.drawn) return;
    const f = this.frame(this.expr, this.mouth, this.blink > 0);
    if (!f) return;
    if (this.cv.width !== f.width || this.cv.height !== f.height) { this.cv.width = f.width; this.cv.height = f.height; }
    const g = this.cv.getContext('2d')!;
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    g.drawImage(f, 0, 0);
    this.drawn = key;
  }

  update(dt: number) {
    if (!this.active) return;
    if (this.talking()) {
      this.mouthT -= dt;
      if (this.mouthT <= 0) {
        const r = Math.random();
        this.mouth = this.mouth === 0 ? (r < 0.55 ? 2 : 1) : r < 0.45 ? 0 : r < 0.72 ? 1 : 2;
        this.mouthT = 0.07 + Math.random() * 0.07;
      }
    } else this.mouth = 0;
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.12;
      this.blinkT = 2 + Math.random() * 3.4;
    }
    this.blink = Math.max(0, this.blink - dt);
    this.redraw();
  }
}
