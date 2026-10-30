// V12 menus: floating pixel text. The title, pause and settings menus have no panels, boxes or
// buttons: their options are words hanging in the air over the scene, drawn letter by letter in the
// game's bitmap font (src/ui/v11/paper/pxfont.ts) on whole device pixels.
//
//   - every letter bobs on its own little swell; the options arrive on the wind (blown in from the
//     right, dithering in) and leave on it (torn off to the left, dithering out)
//   - the option under the pointer / keyboard focus lifts in a travelling wave, turns gold with a
//     dithered glow round its letters, and an underline shimmers along beneath it; a small pixel
//     caret bobs beside it
//   - values are pixel glyphs too: sliders are rows of blocks, choices have pixel arrows, toggles a
//     pixel tick box; left / right (or a click / tap on them) change them
//   - keys: up / down (W / S) move, Enter / Space / E pick, left / right (A / D) change a value,
//     Esc / Backspace go back; the mouse hovers and clicks, a tap picks
//
//   const m = new FloatMenu({ page, anchor, align, modal })   show a page of items
//   m.show(page)                                               the old words blow away, the new arrive
//   await m.close()                                            everything blows away, then it is removed
//
// The anchor is a point in the game view (art px, VW x VH) asked every frame, so a scene can pin the
// words to a spot in its world and they drift with its camera. Mirror buttons for screen readers and
// tests sit off-screen (data-fm="<item id>").

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { pushKeys } from '../laptop-kit';
import { Art, bayer, col } from '../v11/paper/px';
import { pxDraw, pxMeasure, pxWrap } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { PixelBuffer } from '../../art/pixel';

/** 'block': upright bold capitals (the options); 'hand': Mori's marker hand (notes, headings) */
export type Face = 'block' | 'hand';

export type FMKind = 'action' | 'slider' | 'choice' | 'toggle' | 'text';

export interface FMItem {
  id: string;
  label: string;
  /** 'action' (default) picks; 'slider' / 'choice' / 'toggle' carry a value; 'text' is a plain line */
  kind?: FMKind;
  /** slider: 0..1; choice: an index into choices; toggle: on / off */
  get?: () => number | boolean;
  set?: (v: number | boolean) => void;
  /** slider: how many steps from 0 to 1 (default 10) */
  steps?: number;
  /** choice labels */
  choices?: string[];
  /** the value as text (slider default: a percentage) */
  fmt?: (v: number | boolean) => string;
  /** a small handwritten line shown under the menu while this option has the focus */
  hint?: string | (() => string);
  /** a small handwritten note beside the label (Continue: the day) */
  sub?: string;
  tone?: 'danger' | 'quiet';
  /** text items: 'hand' (Mori's hand, small) or 'block' (caps, like the options) */
  face?: Face;
  /** extra space above (text px) */
  gap?: number;
  pick?: () => void;
}

export interface FloatPage {
  items: FMItem[];
  /** a small handwritten line above the options */
  heading?: string;
  /** id of the item to focus first */
  focus?: string;
  /** Esc / Backspace / right click */
  onBack?: () => void;
  /** size of the words on this page (1 = the menu's size) */
  scale?: number;
}

export interface FloatMenuOpts {
  page: FloatPage;
  /** where the menu hangs, in art px of the game view (asked every frame); default: the view centre */
  anchor?: () => { x: number; y: number };
  /** the anchor is the menu's left edge ('left'), its middle ('center') or its right edge */
  align?: 'left' | 'center' | 'right';
  /** vertical: the anchor is the top of the menu ('top') or its middle ('middle', default) */
  valign?: 'top' | 'middle';
  /** default: the UI root */
  parent?: HTMLElement;
  /** counts as a modal while open (the game ignores its keys and clicks) */
  modal?: boolean;
  /** size multiplier for the words (1 = default) */
  scale?: number;
  /** words only (captions): no keys, clicks pass through */
  passive?: boolean;
}

// ---------------------------------------------------------------- glyph sprites

type Style = 'item' | 'focus' | 'danger' | 'dangerF' | 'quiet' | 'quietF' | 'hint' | 'head' | 'value' | 'valueF';
interface StyleDef { top: string; mid: string; bot: string; ink: string; glow?: string }
const STYLES: Record<Style, StyleDef> = {
  item: { top: '#ffffff', mid: '#fff0d6', bot: '#e9c99c', ink: '#1b1020' },
  focus: { top: '#fffbe6', mid: '#ffdc78', bot: '#f29a3a', ink: '#2a1004', glow: '#ffb340' },
  danger: { top: '#ffe2d6', mid: '#ffb8a0', bot: '#e07658', ink: '#200a0c' },
  dangerF: { top: '#fff0e6', mid: '#ffc4a4', bot: '#ff6a46', ink: '#2a0806', glow: '#ff6a3a' },
  quiet: { top: '#e4f4ee', mid: '#b8d6cc', bot: '#8cb0a6', ink: '#101a20' },
  quietF: { top: '#f4fffa', mid: '#c4f4e2', bot: '#6ad8b8', ink: '#08201a', glow: '#5ae0c0' },
  hint: { top: '#fff6e4', mid: '#ffe8c4', bot: '#f0cc98', ink: '#1b1020' },
  head: { top: '#d8fff2', mid: '#9ff0dc', bot: '#62c6b0', ink: '#0c2420' },
  value: { top: '#ffffff', mid: '#f4e6cc', bot: '#d8b88c', ink: '#1b1020' },
  valueF: { top: '#ffffff', mid: '#fff0b8', bot: '#ffc860', ink: '#2a1004' },
};
const PAD = 3;
const GW = 14, GH = 12;
const sprites = new Map<string, HTMLCanvasElement>();
const masks = new Map<string, Uint8Array>();
const advs = new Map<string, number>();
/** the game's bitmap faces (src/ui/pxfont.ts, the same as the floating dialogue): 'block' is the bold
 *  print (6 px caps), 'hand' Mori's marker hand (8 px caps); both sit on glyph row 7 */
const FONT: Record<Face, PxFontId> = { block: 'bold', hand: 'script' };
const CAP: Record<Face, number> = { block: 6, hand: 8 };

function maskOf(ch: string, face: Face): Uint8Array {
  const k = face + ch;
  let m = masks.get(k);
  if (m) return m;
  const b = new PixelBuffer(GW, GH);
  pxDraw(b, ch, 0, 8 - CAP[face], { font: FONT[face], color: '#ffffff', bounce: false });
  m = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (b.get(x, y) >>> 24) m[y * GW + x] = 1;
  masks.set(k, m);
  return m;
}
/** advance of a character in text px */
function adv(ch: string, face: Face): number {
  const k = face + ch;
  let v = advs.get(k);
  if (v === undefined) { v = pxMeasure(ch + ch, FONT[face]) - pxMeasure(ch, FONT[face]) + (face === 'block' ? 1 : 0); advs.set(k, v); }
  return v;
}

/** one letter in a style, at a dither level 1..4 (4 = solid): fill ramp, ink outline, a hard drop
 *  shadow, and (focus styles) a dithered glow ring */
function glyphSprite(ch: string, face: Face, style: Style, level: number): HTMLCanvasElement {
  const key = `${face}|${style}|${level}|${ch}`;
  let cv = sprites.get(key);
  if (cv) return cv;
  const m = maskOf(ch, face);
  const W = GW + PAD * 2, H = GH + PAD * 2;
  const inM = (x: number, y: number) => { const gx = x - PAD, gy = y - PAD; return gx >= 0 && gy >= 0 && gx < GW && gy < GH && m[gy * GW + gx] === 1; };
  const dist = (x: number, y: number, r: number) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (inM(x + i, y + j)) return true;
    return false;
  };
  const S = STYLES[style];
  const top = col(S.top), mid = col(S.mid), bot = col(S.bot), ink = col(S.ink), shadow = col(S.ink, 0.6);
  const glow = S.glow ? col(S.glow, 0.9) : 0, glowO = S.glow ? col(S.glow, 0.55) : 0;
  const a = new Art(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const keep = level >= 4 || bayer(x, y) < level / 4;
    if (!keep) continue;
    let c = 0;
    if (inM(x, y)) {
      const gy = y - PAD;
      c = gy <= 2 ? top : gy >= 6 ? bot : mid;
      // the top edge of every stroke catches the light
      if (!inM(x, y - 1)) c = top;
    } else if (dist(x, y, 1)) c = ink;
    else if (dist(x, y - 1, 1)) c = shadow;
    else if (glow && dist(x, y, 2)) c = (x + y) & 1 ? 0 : glow;
    else if (glow && dist(x, y, 3)) c = bayer(x, y) < 0.25 ? glowO : 0;
    if (c) a.put(x, y, c);
  }
  cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.getContext('2d')!.putImageData(a.img, 0, 0);
  sprites.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- layout

interface Glyph { ch: string; x: number; r: number }
interface Row {
  item: FMItem;
  /** index among the page's rows */
  i: number;
  face: Face;
  /** caps scale: 1 = the options' size, < 1 = small handwriting */
  small: boolean;
  glyphs: Glyph[];
  /** label width in text px (at its own scale) */
  w: number;
  /** top of the row in device px from the menu's top (set by layout) */
  y: number;
  h: number;
  sub: Glyph[] | null;
  /** last frame's hit box (device px) and the widget's parts */
  box: [number, number, number, number] | null;
  parts: { k: 'dec' | 'inc' | 'bar' | 'val'; box: [number, number, number, number] }[];
  pop: number;
}
interface Page {
  def: FloatPage;
  rows: Row[];
  head: Row | null;
  born: number;
  dying: number | null;
  /** label column width (text px) when the page has value rows */
  labelCol: number;
  w: number;
  h: number;
  /** device px it was laid out for */
  at: number;
  /** room kept under the options for the focused one's hint */
  hintH: number;
  align: 'left' | 'center' | 'right';
}

const interactive = (it: FMItem) => (it.kind ?? 'action') !== 'text';
const ease = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function glyphsOf(text: string, face: Face): { g: Glyph[]; w: number } {
  const g: Glyph[] = [];
  let x = 0, n = 0;
  for (const ch of text) {
    g.push({ ch, x, r: hash(n++ + text.length * 13) });
    x += adv(ch, face);
  }
  return { g, w: Math.max(0, x - 1) };
}

let menusOpen = 0;
let modalsUp = 0;
let modalStyled = false;
/** how many floating menus are up (other UI can stay out of their way) */
export const floatMenusOpen = () => menusOpen;

// ---------------------------------------------------------------- the menu

export class FloatMenu {
  readonly cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pages: Page[] = [];
  private cur: Page | null = null;
  private focusI = -1;
  private raf = 0;
  private t0 = performance.now();
  private popKeys: (() => void) | null = null;
  private closing = false;
  private closedRes: (() => void) | null = null;
  private down: { row: Row; part: Row['parts'][number] | null } | null = null;
  private mirror: HTMLElement;
  private dpr = 1;
  /** device px per text px for the options and for the small handwriting */
  private gp = 4;
  private hp = 2;
  private lastHover = -1;
  /** suspended: drawn dimmed, no input (another window is over it) */
  suspended = false;
  /** where the anchor sits on the words (may change between pages) */
  align: 'left' | 'center' | 'right';
  readonly opts: FloatMenuOpts;

  constructor(o: FloatMenuOpts) {
    this.opts = o;
    this.align = o.align ?? 'center';
    this.cv = document.createElement('canvas');
    this.cv.className = 'fm-canvas';
    this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:6;touch-action:none;image-rendering:pixelated';
    this.cv.setAttribute('aria-hidden', 'true');
    this.ctx = this.cv.getContext('2d')!;
    this.mirror = document.createElement('div');
    this.mirror.setAttribute('role', 'menu');
    this.mirror.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    const parent = o.parent ?? game.ui.root;
    parent.append(this.cv, this.mirror);
    if (o.modal) {
      game.ui.modalOpen++;
      // over the paused world: the world's own floating words step back while the menu is up
      this.cv.style.zIndex = '9';
      if (!modalStyled) { modalStyled = true; const st = document.createElement('style'); st.textContent = '#ui.fm-modal > canvas { visibility: hidden; }'; document.head.appendChild(st); }
      if (modalsUp++ === 0) game.ui.root.classList.add('fm-modal');
    }
    if (!o.passive) menusOpen++;
    this.cv.addEventListener('pointerdown', e => this.onDown(e));
    this.cv.addEventListener('pointermove', e => this.onMove(e));
    this.cv.addEventListener('pointerup', e => this.onUp(e));
    this.cv.addEventListener('pointerleave', () => { this.down = null; this.cv.style.cursor = ''; });
    this.cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!this.suspended) this.back(); });
    if (o.passive) this.cv.style.pointerEvents = 'none';
    else this.popKeys = pushKeys(e => this.onKey(e));
    this.show(o.page);
    const loop = () => {
      if (!this.cv.isConnected && !this.closing) { this.destroy(); return; }
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private get now() { return (performance.now() - this.t0) / 1000; }
  get open() { return !this.closing; }
  /** the current page's definition */
  get page(): FloatPage | null { return this.cur?.def ?? null; }

  /** show a page: the old words blow away on the wind, the new ones arrive */
  show(def: FloatPage) {
    const t = this.now;
    if (this.cur) this.cur.dying = t;
    const rows: Row[] = [];
    def.items.forEach((it, i) => {
      const kind = it.kind ?? 'action';
      const face: Face = kind === 'text' ? it.face ?? 'hand' : 'block';
      const { g, w } = glyphsOf(face === 'block' ? it.label.toUpperCase() : it.label, face);
      rows.push({ item: it, i, face, small: face === 'hand', glyphs: g, w, y: 0, h: 0, sub: it.sub ? glyphsOf(it.sub, 'hand').g : null, box: null, parts: [], pop: -1 });
    });
    let head: Row | null = null;
    if (def.heading) {
      const { g, w } = glyphsOf(def.heading, 'hand');
      head = { item: { id: '_head', label: def.heading, kind: 'text' }, i: -1, face: 'hand', small: true, glyphs: g, w, y: 0, h: 0, sub: null, box: null, parts: [], pop: -1 };
    }
    const valued = rows.filter(r => ['slider', 'choice', 'toggle'].includes(r.item.kind ?? ''));
    const labelCol = valued.length ? Math.max(...valued.map(r => r.w)) + 10 : 0;
    const p: Page = { def, rows, head, born: t + (this.cur ? 0.18 : 0), dying: null, labelCol, w: 0, h: 0, at: 0, hintH: 0, align: this.align };
    this.pages.push(p);
    this.cur = p;
    const f = def.focus ? rows.findIndex(r => r.item.id === def.focus) : -1;
    this.focusI = f >= 0 && interactive(rows[f].item) ? f : rows.findIndex(r => interactive(r.item));
    this.lastHover = -1;
    this.buildMirror();
  }

  /** blow everything away and remove the menu */
  close(): Promise<void> {
    if (this.closing) return Promise.resolve();
    this.closing = true;
    if (this.cur) this.cur.dying = this.now;
    this.cur = null;
    this.popKeys?.();
    this.popKeys = null;
    this.cv.style.pointerEvents = 'none';
    this.cv.style.cursor = '';
    if (this.opts.modal) {
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      guardInput(250);
      modalsUp = Math.max(0, modalsUp - 1);
      if (!modalsUp) game.ui.root.classList.remove('fm-modal');
    }
    if (!this.opts.passive) menusOpen = Math.max(0, menusOpen - 1);
    this.mirror.remove();
    return new Promise<void>(res => { this.closedRes = res; });
  }

  /** remove at once (scene teardown) */
  destroy() {
    if (!this.closing) void this.close();
    cancelAnimationFrame(this.raf);
    this.cv.remove();
    this.mirror.remove();
    this.closedRes?.();
    this.closedRes = null;
  }

  focusId(id: string) {
    const i = this.cur?.rows.findIndex(r => r.item.id === id) ?? -1;
    if (i >= 0) this.focusI = i;
  }

  // ---------------------------------------------------------------- input

  private rows() { return this.cur?.rows ?? []; }
  private move(d: number) {
    const rows = this.rows();
    if (!rows.length) return;
    let i = this.focusI;
    for (let n = 0; n < rows.length; n++) {
      i = (i + d + rows.length) % rows.length;
      if (interactive(rows[i].item)) break;
    }
    if (i !== this.focusI) { this.focusI = i; audio.play('ui', { vol: 0.16, pitch: 1.5 }); }
  }
  private back() {
    const b = this.cur?.def.onBack;
    if (!b) return;
    audio.play('uiBack', { vol: 0.35 });
    b();
  }
  private pickRow(row: Row) {
    const it = row.item, k = it.kind ?? 'action';
    if (k === 'text') return;
    if (k === 'slider' || k === 'choice') { this.adjust(row, 1, true); return; }
    if (k === 'toggle') { this.adjust(row, 1); return; }
    row.pop = this.now;
    audio.play('ui', { vol: 0.42, pitch: 1.1 });
    it.pick?.();
  }
  /** change a value one step (wrap: a slider past its end goes back to 0, a choice cycles) */
  private adjust(row: Row, d: number, wrap = false) {
    const it = row.item, k = it.kind;
    if (k === 'slider') {
      const n = it.steps ?? 10;
      const v = Number(it.get?.() ?? 0);
      let s = Math.round(v * n) + d;
      if (wrap && s > n) s = 0;
      s = Math.max(0, Math.min(n, s));
      if (s / n === v) return;
      it.set?.(s / n);
      audio.play('ui', { vol: 0.24, pitch: 0.7 + (s / n) * 0.9 });
    } else if (k === 'choice') {
      const n = it.choices?.length ?? 1;
      const v = Number(it.get?.() ?? 0);
      const s = wrap ? (v + d + n) % n : Math.max(0, Math.min(n - 1, v + d));
      if (s === v) return;
      it.set?.(s);
      audio.play('ui', { vol: 0.3, pitch: 0.9 + s * 0.2 });
    } else if (k === 'toggle') {
      it.set?.(!it.get?.());
      audio.play('ui', { vol: 0.3, pitch: it.get?.() ? 1.3 : 0.85 });
    } else return;
    row.pop = this.now;
    this.syncMirror();
  }

  private onKey(e: KeyboardEvent): boolean {
    if (this.closing || this.suspended || !this.cur) return false;
    const c = e.code;
    const row = this.rows()[this.focusI];
    if (c === 'ArrowUp' || c === 'KeyW') { this.move(-1); return true; }
    if (c === 'ArrowDown' || c === 'KeyS' || (c === 'Tab' && !e.shiftKey)) { this.move(1); return true; }
    if (c === 'Tab' && e.shiftKey) { this.move(-1); return true; }
    if (c === 'ArrowLeft' || c === 'KeyA') { if (row) this.adjust(row, -1); return true; }
    if (c === 'ArrowRight' || c === 'KeyD') { if (row) this.adjust(row, 1); return true; }
    if (c === 'Enter' || c === 'Space' || c === 'KeyE' || c === 'NumpadEnter') { if (!e.repeat && row) this.pickRow(row); return true; }
    if (c === 'Escape' || c === 'Backspace') { if (!e.repeat) this.back(); return true; }
    return false;
  }

  private devXY(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (this.cv.width / Math.max(1, r.width)), (e.clientY - r.top) * (this.cv.height / Math.max(1, r.height))];
  }
  private hit(x: number, y: number): { row: Row; part: Row['parts'][number] | null } | null {
    for (const row of this.rows()) {
      if (!row.box || !interactive(row.item)) continue;
      const [x0, y0, x1, y1] = row.box;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        const part = row.parts.find(p => x >= p.box[0] && x <= p.box[2] && y >= p.box[1] && y <= p.box[3]) ?? null;
        return { row, part };
      }
    }
    return null;
  }
  private onMove(e: PointerEvent) {
    if (this.closing || this.suspended) return;
    const [x, y] = this.devXY(e);
    const h = this.hit(x, y);
    this.cv.style.cursor = h ? 'pointer' : '';
    if (e.pointerType !== 'mouse') return;
    if (h && h.row.i !== this.focusI) { this.focusI = h.row.i; audio.play('ui', { vol: 0.14, pitch: 1.5 }); }
    this.lastHover = h ? h.row.i : -1;
  }
  private onDown(e: PointerEvent) {
    audio.unlock();
    if (this.closing || this.suspended) return;
    if (e.button === 2) return;
    const [x, y] = this.devXY(e);
    this.down = this.hit(x, y);
    if (this.down && this.down.row.i !== this.focusI) this.focusI = this.down.row.i;
    if (this.down) e.preventDefault();
  }
  private onUp(e: PointerEvent) {
    if (this.closing || this.suspended || !this.down) return;
    const [x, y] = this.devXY(e);
    const h = this.hit(x, y);
    const d = this.down;
    this.down = null;
    if (!h || h.row !== d.row) return;
    const row = h.row, it = row.item, part = h.part;
    if (part && it.kind === 'slider') {
      if (part.k === 'dec') this.adjust(row, -1);
      else if (part.k === 'inc') this.adjust(row, 1);
      else if (part.k === 'bar') {
        const n = it.steps ?? 10;
        const k = clamp01((x - part.box[0]) / Math.max(1, part.box[2] - part.box[0]));
        const s = Math.round(k * n);
        if (s / n !== Number(it.get?.() ?? 0)) { it.set?.(s / n); row.pop = this.now; audio.play('ui', { vol: 0.24, pitch: 0.7 + (s / n) * 0.9 }); this.syncMirror(); }
      } else this.adjust(row, 1, true);
      return;
    }
    if (part && it.kind === 'choice') { this.adjust(row, part.k === 'dec' ? -1 : 1, part.k !== 'dec'); return; }
    this.pickRow(row);
  }

  // ---------------------------------------------------------------- mirror (screen readers, tests)

  private valueText(it: FMItem): string {
    const v = it.get?.();
    if (v === undefined) return '';
    if (it.fmt) return it.fmt(v);
    if (it.kind === 'slider') return Math.round(Number(v) * 100) + '%';
    if (it.kind === 'choice') return it.choices?.[Number(v)] ?? '';
    if (it.kind === 'toggle') return v ? 'On' : 'Off';
    return '';
  }
  private buildMirror() {
    const m = this.mirror;
    m.innerHTML = '';
    if (!this.cur) return;
    if (this.cur.def.heading) m.setAttribute('aria-label', this.cur.def.heading);
    for (const row of this.cur.rows) {
      const it = row.item;
      if (!interactive(it)) { const p = document.createElement('p'); p.textContent = it.label; m.appendChild(p); continue; }
      const b = document.createElement('button');
      b.dataset.fm = it.id;
      b.setAttribute('role', 'menuitem');
      b.textContent = it.label + (it.kind && it.kind !== 'action' ? ': ' + this.valueText(it) : '');
      b.tabIndex = -1;
      b.onclick = () => { if (!this.closing) this.pickRow(row); };
      m.appendChild(b);
    }
  }
  private syncMirror() {
    if (!this.cur) return;
    for (const row of this.cur.rows) {
      const b = this.mirror.querySelector(`[data-fm="${row.item.id}"]`);
      if (b && row.item.kind && row.item.kind !== 'action') b.textContent = row.item.label + ': ' + this.valueText(row.item);
    }
  }

  // ---------------------------------------------------------------- drawing

  private fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(2, Math.round(window.innerWidth * dpr)), H = Math.max(2, Math.round(window.innerHeight * dpr));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.dpr = dpr;
    // the options' capitals: about 4% of the screen height, never smaller than a phone can read
    const cssW = window.innerWidth, cssH = window.innerHeight;
    this.cap = Math.max(17, Math.min(46, Math.min(cssH * 0.04, cssW * 0.03))) * (this.opts.scale ?? 1);
    this.ctx.imageSmoothingEnabled = false;
  }
  private cap = 28;
  /** the pixel sizes for a page (a page may ask for smaller words: a long settings list) */
  private sizeFor(p: Page) {
    const k = p.def.scale ?? 1;
    this.gp = Math.max(2, Math.round((Math.max(16, this.cap * k) * this.dpr) / 6));
    this.hp = Math.max(1, Math.round(this.gp * 0.45), Math.ceil((12 * this.dpr) / 8));
  }

  /** lay a page out (device px), once per pixel size */
  private layout(p: Page) {
    const gp = this.gp, hp = this.hp;
    if (p.at === gp * 1000 + hp) return;
    p.at = gp * 1000 + hp;
    let y = 0, w = 0;
    if (p.head) { p.head.y = 0; p.head.h = 12 * hp; y += 15 * hp; w = Math.max(w, p.head.w * hp); }
    for (const row of p.rows) {
      y += (row.item.gap ?? 0) * gp;
      row.y = y;
      let h: number, rw: number;
      if (row.small) { h = 13 * hp; rw = row.w * hp; }
      else {
        h = 13 * gp;
        rw = (p.labelCol && row.item.kind && row.item.kind !== 'action' ? p.labelCol + 76 : row.w) * gp;
      }
      row.h = h;
      y += h;
      w = Math.max(w, rw);
    }
    p.w = w;
    p.h = y;
    p.hintH = p.rows.some(r => r.item.hint) ? 3 * gp + 39 * hp : 0;
  }

  private frame() {
    this.fit();
    const ctx = this.ctx, t = this.now;
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    for (let i = this.pages.length - 1; i >= 0; i--) {
      const p = this.pages[i];
      if (p.dying !== null && t > p.dying + 1.4) this.pages.splice(i, 1);
    }
    if (this.closing && !this.pages.length) { this.destroy(); return; }
    for (const p of this.pages) this.drawPage(p, t);
  }

  private origin(p: Page): [number, number] {
    const VW = game.r?.VW ?? 640, VH = game.r?.VH ?? 360;
    const a = this.opts.anchor?.() ?? { x: VW / 2, y: VH / 2 };
    let x = (a.x / VW) * this.cv.width, y = (a.y / VH) * this.cv.height;
    const al = p.align;
    if (al === 'center') x -= p.w / 2;
    else if (al === 'right') x -= p.w;
    if ((this.opts.valign ?? 'middle') === 'middle') y -= (p.h + p.hintH) / 2;
    // keep it on screen
    const m = 8 * this.gp;
    x = Math.max(m, Math.min(this.cv.width - p.w - m * 0.5, x));
    y = Math.max(m * 0.5, Math.min(this.cv.height - p.h - p.hintH - m * 0.5, y));
    return [Math.round(x), Math.round(y)];
  }

  private drawPage(p: Page, t: number) {
    this.sizeFor(p);
    this.layout(p);
    const [ox, oy] = this.origin(p);
    const live = p === this.cur && !this.closing;
    const dim = this.suspended && live;
    if (p.head) this.drawWord(p.head.glyphs, 'hand', 'head', ox, oy + p.head.y, this.hp, p, -1, 0, t, false, 0);
    let focusRow: Row | null = null;
    for (const row of p.rows) {
      const it = row.item;
      const kind = it.kind ?? 'action';
      const focused = live && !dim && row.i === this.focusI && interactive(it);
      if (focused) focusRow = row;
      const gp = row.small ? this.hp : this.gp;
      const tone = it.tone;
      const st: Style = kind === 'text' ? (row.small ? 'hint' : 'item') : tone === 'danger' ? (focused ? 'dangerF' : 'danger') : tone === 'quiet' ? (focused ? 'quietF' : 'quiet') : focused ? 'focus' : 'item';
      const y = oy + row.y;
      // the pop when picked: a quick hop
      const pk = row.pop >= 0 ? clamp01((t - row.pop) / 0.28) : 1;
      const hop = pk < 1 ? Math.sin(pk * Math.PI) * 2.5 : 0;
      this.drawWord(row.glyphs, row.face, st, ox, y, gp, p, row.i, hop, t, focused);
      // a small handwritten note beside the label, on its baseline
      if (row.sub) this.drawWord(row.sub, 'hand', 'hint', ox + (row.w + 6) * this.gp, y + 8 * this.gp - 8 * this.hp, this.hp, p, row.i, 0, t, focused, row.i * 0.07 + 0.2);
      // value widgets
      row.parts = [];
      if (kind === 'slider' || kind === 'choice' || kind === 'toggle') this.drawValue(row, p, ox + p.labelCol * this.gp, y, focused, t);
      // hit box (a little generous, so a thumb finds it)
      const rw = kind === 'text' ? 0 : (p.labelCol && kind !== 'action' ? p.labelCol + 76 : row.w) * this.gp;
      row.box = kind === 'text' ? null : [ox - 6 * this.gp, y - 3 * this.gp, ox + rw + 6 * this.gp, y + row.h - 1 * this.gp];
    }
    if (dim) return;
    // focus: the caret and the shimmering underline
    if (focusRow && live) {
      const gp = this.gp, y = oy + focusRow.y;
      const ctx = this.ctx;
      const bob = Math.round(Math.sin(t * 5) * 0.8 * gp);
      const cx = ox - 7 * gp + bob, cy = y + 1 * gp;
      const caret = this.caret();
      ctx.drawImage(caret, cx, cy, caret.width * gp, caret.height * gp);
      const uw = focusRow.w;
      const uy = y + 10 * gp;
      const glow = focusRow.item.tone === 'danger' ? '#ff7a50' : focusRow.item.tone === 'quiet' ? '#5ae0c0' : '#ffb340';
      ctx.fillStyle = glow;
      for (let x = 0; x < uw; x += 2) ctx.fillRect(ox + x * gp, uy, gp, gp);
      const head = ((t * 0.9) % 1.4) / 1.4 * (uw + 16) - 8;
      ctx.fillStyle = '#fffbe6';
      for (let x = Math.max(0, Math.floor(head)); x < Math.min(uw, head + 7); x++) ctx.fillRect(ox + x * gp, uy, gp, gp);
      if (head > 0 && head < uw) { ctx.fillRect(ox + Math.floor(head + 6) * gp, uy - gp, gp, gp); }
    }
    // the hint for the focused option: a small handwritten line under the menu
    if (live && focusRow) {
      const h = typeof focusRow.item.hint === 'function' ? focusRow.item.hint() : focusRow.item.hint;
      if (h) {
        const maxW = Math.max(p.w, this.cv.width * 0.4) / this.hp;
        pxWrap(h, maxW, 'script').slice(0, 3).forEach((line, li) => {
          this.drawWord(glyphsOf(line, 'hand').g, 'hand', 'hint', ox, oy + p.h + 3 * this.gp + li * 13 * this.hp, this.hp, p, 7 + li, 0, t, false, 0.3);
        });
      }
    }
  }

  private caretCv: HTMLCanvasElement | null = null;
  /** a little pixel arrowhead pointing at the focused option */
  private caret(): HTMLCanvasElement {
    if (this.caretCv) return this.caretCv;
    const rows = ['##....', '#d#...', '#dd#..', '#ddd#.', '#dd#..', '#d#...', '##....'];
    const a = new Art(6, 8);
    const ink = col('#2a1004'), fill = col('#ffdc78'), sh = col('#2a1004', 0.6);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { a.put(x, y, r[x] === '#' ? ink : fill); } });
    for (let x = 0; x < 4; x++) if (!a.get(x, 7)) a.put(x, 7, sh);
    a.put(1, 1, col('#fffbe6'));
    const cv = document.createElement('canvas');
    cv.width = 6; cv.height = 8;
    cv.getContext('2d')!.putImageData(a.img, 0, 0);
    this.caretCv = cv;
    return cv;
  }

  /**
   * One word / line, letter by letter: arriving on the wind (blown in from the right, dithering in),
   * bobbing, lifting in a wave when focused, torn away to the left when its page goes.
   * (`seed` keeps each row's bob out of step; `delay` is when it arrives after its page)
   */
  private drawWord(gs: Glyph[], face: Face, style: Style, x0: number, y0: number, gp: number, p: Page, seed: number, hop: number, t: number, focused: boolean, delay = Math.max(0, seed) * 0.07) {
    const ctx = this.ctx;
    const dim = this.suspended && p === this.cur;
    const base = y0 + 9 * gp; // baseline (glyph row 8 sits on it): one text px of headroom over the caps
    const born = p.born + delay;
    let n = 0;
    for (const g of gs) {
      const i = n++;
      if (g.ch === ' ') continue;
      // arrival
      const ka = clamp01((t - born - i * 0.022) / 0.34);
      if (ka <= 0) continue;
      const ea = ease(ka);
      let dx = (1 - ea) * 9, dy = (1 - ea) * -2.5;
      let level = Math.ceil(ka * 4);
      // leaving: torn off to the left by the wind
      if (p.dying !== null) {
        const v = t - p.dying - i * 0.014 - g.r * 0.08 - delay * 0.4;
        if (v > 0) {
          dx -= v * v * 120 + v * 26;
          dy += Math.sin(v * 8 + g.r * 6) * 2 - v * 9;
          level = Math.min(level, 4 - Math.floor((v / 0.5) * 4));
          if (level <= 0) continue;
        }
      }
      // the swell
      dy += Math.sin(t * 1.7 + i * 0.5 + seed * 0.9) * 0.75;
      if (focused) dy -= 1 + Math.max(0, Math.sin(t * 7 - i * 0.55)) * 0.9;
      dy -= hop;
      if (dim) level = Math.min(level, 2);
      const spr = glyphSprite(g.ch, face, style, level);
      const X = Math.round(x0 + (g.x + dx - PAD) * gp);
      const Y = Math.round(base + (dy - 8 - PAD) * gp);
      ctx.drawImage(spr, X, Y, spr.width * gp, spr.height * gp);
    }
  }

  /** a value: slider blocks, a choice between pixel arrows, a tick box */
  private drawValue(row: Row, p: Page, x0: number, y0: number, focused: boolean, t: number) {
    const ctx = this.ctx, gp = this.gp, it = row.item;
    const ka = clamp01((t - p.born - row.i * 0.07 - 0.12) / 0.34);
    let a = Math.ceil(ka * 4) / 4;
    let dx = (1 - ease(ka)) * 9;
    if (p.dying !== null) {
      const v = t - p.dying - 0.05 - row.i * 0.03;
      if (v > 0) { dx -= v * v * 120 + v * 26; a = Math.min(a, Math.floor((1 - v / 0.5) * 4) / 4); }
    }
    if (this.suspended && p === this.cur) a = Math.min(a, 0.5);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const bob = Math.sin(t * 1.7 + row.i * 0.9 + 3) * 0.75 - (focused ? 1.4 : 0);
    const X = (u: number) => Math.round(x0 + (u + dx) * gp);
    const Y = (v: number) => Math.round(y0 + (v + bob) * gp);
    const ink = focused ? '#2a1004' : '#1b1020';
    const lit = focused ? '#ffdc78' : '#fff0d6';
    const litTop = focused ? '#fffbe6' : '#ffffff';
    const rect = (u: number, v: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(X(u), Y(v), Math.round(w * gp), Math.round(h * gp)); };
    // a pixel arrowhead (3 x 5), pointing left (-1) or right (+1)
    const arrow = (u: number, dir: number, on: boolean) => {
      const c = on ? lit : '#c8b8a0';
      for (let j = 0; j < 5; j++) {
        const len = 3 - Math.abs(j - 2);
        const x = dir < 0 ? u + 3 - len : u;
        rect(x - 0.0, 3 + j, len, 1, c);
      }
    };
    const box = (u0: number, u1: number): [number, number, number, number] => [X(u0) - gp, Y(1) - 2 * gp, X(u1) + gp, Y(10) + 2 * gp];
    const kind = it.kind;
    const v = it.get?.();
    if (kind === 'slider') {
      const n = it.steps ?? 10;
      const k = Math.round(Number(v ?? 0) * n);
      const blocks = 10;
      const on = Math.round((k / n) * blocks);
      arrow(0, -1, focused);
      row.parts.push({ k: 'dec', box: box(-2, 4) });
      for (let b = 0; b < blocks; b++) {
        const u = 5 + b * 4;
        const filled = b < on;
        // ink outline then fill
        rect(u - 0, 2, 3, 7, ink);
        if (filled) { rect(u + 0, 2, 3, 1, ink); rect(u + 0, 3, 3, 5, lit); rect(u, 3, 3, 1, litTop); }
        else { rect(u + 1, 4, 1, 3, focused ? '#6a4a2a' : '#4a3a4a'); }
      }
      const end = 5 + blocks * 4;
      row.parts.push({ k: 'bar', box: [X(5), Y(1) - 2 * gp, X(end - 1), Y(10) + 2 * gp] });
      arrow(end, 1, focused);
      row.parts.push({ k: 'inc', box: box(end - 1, end + 5) });
      const txt = it.fmt ? it.fmt(v ?? 0) : String(Math.round(Number(v ?? 0) * 100));
      this.drawWord(glyphsOf(txt, 'block').g, 'block', focused ? 'valueF' : 'value', x0 + (end + 6) * gp, y0, gp, p, row.i, 0, t, focused, row.i * 0.07 + 0.12);
    } else if (kind === 'choice') {
      const txt = (it.choices?.[Number(v ?? 0)] ?? '').toUpperCase();
      const w = glyphsOf(txt, 'block').w;
      arrow(0, -1, focused);
      row.parts.push({ k: 'dec', box: box(-2, 4) });
      this.drawWord(glyphsOf(txt, 'block').g, 'block', focused ? 'valueF' : 'value', x0 + 6 * gp, y0, gp, p, row.i, 0, t, focused, row.i * 0.07 + 0.12);
      arrow(8 + w, 1, focused);
      row.parts.push({ k: 'inc', box: box(6, 14 + w) });
    } else if (kind === 'toggle') {
      const on = !!v;
      rect(0, 2, 7, 7, ink);
      rect(1, 3, 5, 5, on ? (focused ? '#5a3a1a' : '#2a2030') : '#3a3040');
      if (on) {
        // a chunky tick
        const tick: [number, number][] = [[1, 5], [2, 6], [3, 7], [4, 6], [5, 5], [6, 4], [7, 3], [8, 2]];
        for (const [u, w] of tick) rect(u - 0.0, w, 1, 1, litTop);
        for (const [u, w] of tick) rect(u, w + 1, 1, 1, lit);
      }
      const txt = on ? 'ON' : 'OFF';
      this.drawWord(glyphsOf(txt, 'block').g, 'block', focused ? 'valueF' : 'value', x0 + 11 * gp, y0, gp, p, row.i, 0, t, focused, row.i * 0.07 + 0.12);
    }
    ctx.globalAlpha = 1;
  }
}

/** a floating page of plain lines (credits, a question) with options under them */
export function textLines(lines: string[], face: Face = 'hand'): FMItem[] {
  return lines.map((l, i) => ({ id: 'line' + i, label: l, kind: 'text' as const, face }));
}
