// V12 floating text. Every line the player reads floats in the world: dialogue by the speaker, barks,
// prompts over objects, notices near Mori, area names in the sky, the answers to a question. No boxes,
// no toasts, no panels.
//
// Everything is drawn into ONE low-res overlay canvas on the pixel grid (1 canvas pixel per art pixel,
// shown at the HUD's whole-number scale with `image-rendering: pixelated`), in the game's bitmap fonts
// (src/ui/pxfont.ts: 'body' / 'bold' / 'tiny' / Mori's 'script' hand). Each glyph has a hard 1 px dark
// ring and a drop pixel so text reads over sky, sand or night, and every letter moves by whole pixels.
//
// Letters type in one by one and move by style:
//   say      a gentle rise-and-settle as each letter lands
//   shout    big chunky letters that pop in, shake, burst marks at the corners, a screen micro-shake
//   whisper  small, faint, wavering
//   scared   pale letters that tremble and stutter as they type
//   happy    a bouncy wave        laugh   a bigger, faster bounce
//   sad      slow typing, letters droop and sag
//   think    Mori's marker hand, the whole thought drifts; little dots rise from the head
//   radio    phosphor green, crackling flicker and a tiny pixel walkie-talkie
//   notice   small, near Mori, drifts up and dissolves
// The speaker is told by a tint and a small name in their colour, never by a box. Lines anchored to an
// actor follow them, are clamped on screen, and stack instead of overlapping.
//
// API: floatText / floatNotice / FloatStyle (the V12 contract), plus floatLine (a handle the dialogue
// uses), floatChoices (answers near Mori), floatPrompt (the "E  Talk" word over a target), floatSky
// (area names and title cards), floatCaption, floatPickup, floatToast, clearFloats, floatPromptRect.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { pxTextBuf, pxMeasure } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { pxIconBuf } from '../pxicons';
import { hudScale } from '../v11/hudpx';
import type { PixelBuffer } from '../../art/pixel';

export type FloatStyle = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'laugh' | 'sad' | 'think' | 'radio' | 'notice';
/** a live point on screen in CSS px relative to the UI root (null while it isn't visible) */
export type Anchor = () => [number, number] | null;

export interface FloatOpts {
  text: string;
  /** anchor: an actor (follows it) or a world point; neither = near Mori */
  actor?: unknown;
  x?: number;
  y?: number;
  style?: FloatStyle;
  /** how long it stays after typing out (ms) */
  ms?: number;
  /** a CSS point (relative to the UI root) or a live anchor, instead of an actor / world point */
  at?: [number, number] | Anchor;
  /** the speaker's name, drawn small in their colour above the line */
  name?: string;
  /** the speaker's colour (tints the text and the name) */
  color?: string;
  /** typing blip pitch; 0 = silent */
  voice?: number;
  /** typing speed multiplier */
  speed?: number;
  /** stay until dismissed (conversation lines) */
  hold?: boolean;
  /** 'right': docked to the right of the anchor, left aligned (close-up cut-ins); default above it */
  place?: 'above' | 'right';
  /** a small tag before a notice ("FIND", "MAP") */
  tag?: string;
  /** the tag's colour */
  accent?: string;
}

export interface FloatHandle {
  /** resolves when every letter is out */
  readonly typed: Promise<void>;
  /** resolves when the text has gone */
  readonly done: Promise<void>;
  isTyped(): boolean;
  /** type the rest at once */
  skip(): void;
  /** show the little "more" arrow (the line waits for the player) */
  wait(on: boolean): void;
  /** take it away (letters lift off and vanish) */
  dismiss(): void;
  alive(): boolean;
}

// ---------------------------------------------------------------- colours and helpers
const OUT = '#120a06';
const rgb = (h: string): [number, number, number] => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hx2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export function mixHex(a: string, b: string, k: number): string {
  const A = rgb(a), B = rgb(b);
  return '#' + hx2(A[0] + (B[0] - A[0]) * k) + hx2(A[1] + (B[1] - A[1]) * k) + hx2(A[2] + (B[2] - A[2]) * k);
}
/** a speaker colour made readable on dark outlines: the name tag and the text tint */
const nameCol = (c: string) => { const [r, g, b] = rgb(c); const l = (r * 3 + g * 4 + b) / 8; return mixHex(c, '#ffffff', l < 90 ? 0.55 : l < 150 ? 0.35 : 0.15); };
const tintCol = (c: string) => mixHex(mixHex(c, '#ffffff', 0.72), '#fff6e4', 0.3);

const hash = (a: number, b: number) => {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
};
const now = () => performance.now() / 1000;
let reduced = false;
try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* */ }

// V12: the old text furniture never shows (the dialogue panel, the toast stack, the caption and title
// card boxes, the V1 HUD, the region-map button); their callers float their text instead
try {
  const st = document.createElement('style');
  st.textContent = `#ui > .hud, #ui > .toasts, #ui > .dialogue, #ui > .caption, #ui > .titlecard, #ui .v10-mapb, #ui .hm-keys, #ui .bt-route { display: none !important; }`;
  document.head.appendChild(st);
} catch { /* */ }

// ---------------------------------------------------------------- the overlay canvas
let cv: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let S = 3, CW = 0, CH = 0;
let rootRect: DOMRect | null = null;

function layer(): boolean {
  const root = (game as unknown as { ui?: { root?: HTMLElement } }).ui?.root;
  if (!root) return false;
  if (cv && cv.parentElement === root) return true;
  cv = document.createElement('canvas');
  cv.className = 'v12-float';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:7;image-rendering:pixelated;image-rendering:crisp-edges';
  root.appendChild(cv);
  g = cv.getContext('2d');
  CW = CH = 0;
  return !!g;
}
function fitLayer() {
  const root = game.ui.root;
  const R = root.getBoundingClientRect();
  rootRect = R;
  const s = hudScale();
  const w = Math.max(1, Math.ceil(R.width / s)), h = Math.max(1, Math.ceil(R.height / s));
  if (w !== CW || h !== CH || s !== S || !cv!.width) {
    S = s; CW = w; CH = h;
    cv!.width = w; cv!.height = h;
    cv!.style.width = w * s + 'px';
    cv!.style.height = h * s + 'px';
    if (g) g.imageSmoothingEnabled = false;
  }
}

// ---------------------------------------------------------------- sprites (cached canvases)
interface Spr { c: HTMLCanvasElement; w: number; h: number }
const sprites = new Map<string, Spr>();
function bufSpr(b: PixelBuffer): Spr { return { c: b.toCanvas(1), w: b.w, h: b.h }; }
function sprite(key: string, make: () => Spr): Spr {
  let s = sprites.get(key);
  if (!s) { s = make(); sprites.set(key, s); }
  return s;
}
/** a glyph's letter pixels (origin: 1 px left of the glyph, 3 px above its cap line) */
const fillSpr = (font: PxFontId, ch: string, col: string) => sprite(`f|${font}|${ch}|${col}`, () => bufSpr(pxTextBuf(ch, { font, color: col, pad: 1, bounce: false })));
/** the glyph's dark ring and drop pixel, same origin */
const silSpr = (font: PxFontId, ch: string, col: string) => sprite(`o|${font}|${ch}|${col}`, () => bufSpr(pxTextBuf(ch, { font, color: col, outline: col, shadow: col, bounce: false })));
const iconSpr = (name: string) => sprite('i|' + name, () => bufSpr(pxIconBuf(name)));
/** a keycap with its label in the tiny caps */
const keySpr = (label: string) => sprite('k|' + label, () => {
  const lab = label.toUpperCase();
  const tw = Math.max(5, pxMeasure(lab, 'tiny'));
  const w = tw + 6, h = 11;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = OUT; x.fillRect(1, 0, w - 2, h); x.fillRect(0, 1, w, h - 2);
  x.fillStyle = '#8a7048'; x.fillRect(1, 1, w - 2, h - 2);
  x.fillStyle = '#f2e4bc'; x.fillRect(1, 1, w - 2, h - 4);
  x.fillStyle = '#fffaea'; x.fillRect(2, 1, w - 4, 1);
  const t = pxTextBuf(lab, { font: 'tiny', color: '#3a2614' }).toCanvas(1);
  x.drawImage(t, Math.floor((w - tw) / 2), 0);
  return { c, w, h };
});
/** an item icon from a pixel buffer (pickups) */
const bufIcon = (key: string, b: PixelBuffer) => sprite('b|' + key, () => bufSpr(b));
/** pixel art drawn from rows */
function rowsSpr(key: string, rows: string[], pal: Record<string, string>): Spr {
  return sprite('r|' + key, () => {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const p = pal[r[i]]; if (p) { x.fillStyle = p; x.fillRect(i, j, 1, 1); } } });
    return { c, w, h };
  });
}
const MORE = ['kkkkkkk', 'kccccck', '.kccck.', '..kck..', '...k...'];
const RADIO = [
  '.k.......', '.kk......', '.ok......', '.ok......', 'kkkkkkk..', 'kgggggk..', 'kgdgdgk..', 'kgggggk..', 'kgdgdgk..', 'kgggggk..', 'kgLggLk..', 'kgggggk..', 'kkkkkkk..',
];
const DOT = (r: number) => {
  const n = r * 2 + 3, rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let s = '';
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - (n - 1) / 2, y - (n - 1) / 2);
      s += d <= r + 0.2 ? 'c' : d <= r + 1.25 ? 'k' : '.';
    }
    rows.push(s);
  }
  return rows;
};

// ---------------------------------------------------------------- text: markup -> tokens
// *emphasis*, _aside_, <b>/<mark> keyword, <em>, <i>, <span class="key">E</span> a keycap, <br>,
// the glyph tokens hand-written text uses (♪ ♥ ★ ✓ ▶ ...) as painted icons; other tags are dropped.
type Mark = 0 | 1 | 2 | 3; // plain, emphasis, keyword, aside
interface Tok { t: 'c' | 'sp' | 'nl' | 'icon' | 'key'; ch: string; mark: Mark }
const ICON_OF: Record<string, string> = { '♪': 'note', '♫': 'note', '♥': 'heart', '❤': 'heart', '★': 'star', '☆': 'star0', '✓': 'check', '✔': 'check', '✕': 'cross', '✗': 'cross', '▶': 'play', '◀': 'back', '▼': 'down' };
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', deg: '°' };

export function parseFloatText(src: string): Tok[] {
  const s = src
    .replace(/\*([^*]+)\*?/g, '\u0001$1\u0002')
    .replace(/(^|[\s(“"'‘])_([^_]+)_?/g, '$1\u0005$2\u0006');
  const out: Tok[] = [];
  const stack: Mark[] = [0];
  const mark = () => stack[stack.length - 1];
  let key: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\u0001') { stack.push(1); continue; }
    if (c === '\u0005') { stack.push(3); continue; }
    if (c === '\u0003') { stack.push(2); continue; }
    if (c === '\u0002' || c === '\u0006' || c === '\u0004') { if (stack.length > 1) stack.pop(); continue; }
    if (c === '<') {
      const j = s.indexOf('>', i);
      if (j < 0) { out.push({ t: 'c', ch: c, mark: mark() }); continue; }
      const tag = s.slice(i + 1, j).trim().toLowerCase();
      i = j;
      if (/^span[^>]*class="[^"]*\bkey\b/.test(tag)) { key = ''; continue; }
      if (tag === '/span' && key !== null) { if (key.trim()) out.push({ t: 'key', ch: key.trim(), mark: 0 }); key = null; continue; }
      if (/^br\b/.test(tag)) { out.push({ t: 'nl', ch: '\n', mark: 0 }); continue; }
      if (/^(b|strong|mark)\b/.test(tag)) { stack.push(2); continue; }
      if (/^em\b/.test(tag)) { stack.push(1); continue; }
      if (/^i\b/.test(tag)) { stack.push(3); continue; }
      if (/^\/(b|strong|mark|em|i)\b/.test(tag)) { if (stack.length > 1) stack.pop(); continue; }
      continue;
    }
    let ch = c;
    if (c === '&') {
      const j = s.indexOf(';', i);
      if (j > i && j - i < 9) {
        const name = s.slice(i + 1, j);
        const v = name[0] === '#' ? String.fromCodePoint(parseInt(name[1] === 'x' ? name.slice(2) : name.slice(1), name[1] === 'x' ? 16 : 10) || 63) : ENT[name];
        if (v !== undefined) { ch = v; i = j; }
      }
    } else if (c >= '\ud800' && c <= '\udbff') {
      // a surrogate pair (emoji and the like): never drawn
      i++;
      continue;
    }
    if (key !== null) { key += ch; continue; }
    if (ch === '\n') { out.push({ t: 'nl', ch, mark: 0 }); continue; }
    if (ch === ' ' || ch === '\t' || ch === ' ') { out.push({ t: 'sp', ch: ' ', mark: mark() }); continue; }
    if (ICON_OF[ch]) { out.push({ t: 'icon', ch: ICON_OF[ch], mark: mark() }); continue; }
    if (/[​-‏️]/.test(ch)) continue;
    out.push({ t: 'c', ch, mark: mark() });
  }
  // collapse runs of spaces
  return out.filter((t, k) => !(t.t === 'sp' && out[k - 1]?.t === 'sp'));
}
const plainOf = (toks: Tok[]) => toks.map(t => (t.t === 'icon' ? '*' : t.t === 'nl' ? ' ' : t.ch)).join('');

// ---------------------------------------------------------------- looks
interface Look {
  font: PxFontId;
  /** whole-number glyph scale */
  k: number;
  fill: string;
  /** a second fill for the lower half of each letter (sky titles) */
  fill2?: string;
  out: string;
  em: string;
  kw: string;
  aside: string;
  /** characters per second */
  speed: number;
  maxW: number;
  /** extra letter spacing (art px) */
  track: number;
  /** extruded drop below the ring (sky titles) */
  depth: number;
}
const FM: Record<PxFontId, [number, number, number]> = { body: [6, 2, 11], bold: [6, 2, 11], tiny: [5, 1, 8], script: [8, 3, 14] };

function lookFor(style: FloatStyle | 'prompt' | 'caption' | 'option', speaker: string | undefined, plainLen: number): Look {
  const L: Look = { font: 'body', k: 1, fill: '#fff6e4', out: OUT, em: '#ff7a52', kw: '#ffe066', aside: '#b8ac98', speed: 46, maxW: 168, track: 0, depth: 0 };
  const tint = speaker ? tintCol(speaker) : null;
  switch (style) {
    case 'say': if (tint) L.fill = tint; break;
    case 'shout':
      L.font = 'bold'; L.k = plainLen <= 30 ? 2 : 1; L.speed = 62; L.maxW = L.k === 2 ? 132 : 176;
      L.fill = tint ? mixHex(tint, '#ffffff', 0.35) : '#ffffff'; L.em = '#ff5a3a';
      break;
    case 'whisper': L.fill = '#aeb6c6'; L.out = '#1a1c26'; L.em = '#d8a090'; L.kw = '#d8cc90'; L.aside = '#7e8494'; L.speed = 34; L.maxW = 150; break;
    case 'scared': L.fill = '#dce8ff'; L.speed = 40; break;
    case 'happy': L.fill = tint ? mixHex(tint, '#fff2b0', 0.35) : '#fff2c0'; L.speed = 50; break;
    case 'laugh': L.fill = '#fff0a0'; L.speed = 54; break;
    case 'sad': L.fill = '#a9bde0'; L.out = '#0c1018'; L.speed = 26; break;
    case 'think': L.font = 'script'; L.fill = '#e4dcff'; L.speed = 40; L.maxW = 160; break;
    case 'radio': L.fill = '#9dffd8'; L.out = '#03120c'; L.kw = '#ffe45a'; L.em = '#ffb070'; L.aside = '#4fae90'; L.speed = 52; L.maxW = 170; break;
    case 'notice': L.fill = '#fff1cc'; L.speed = 80; L.maxW = 180; break;
    case 'prompt': L.fill = '#fff6dc'; L.speed = 140; L.maxW = 200; break;
    case 'caption': L.font = 'script'; L.fill = '#f6ecd4'; L.speed = 40; L.maxW = 260; break;
    case 'option': L.fill = '#fff6dc'; L.speed = 400; L.maxW = 168; break;
  }
  return L;
}

// ---------------------------------------------------------------- items
type Kind = 'line' | 'bark' | 'notice' | 'prompt' | 'option' | 'sky' | 'caption' | 'pickup';
interface Gl { t: Tok['t']; ch: string; mark: Mark; x: number; row: number; w: number; born: number; i: number }
interface Item {
  id: number;
  kind: Kind;
  style: FloatStyle | 'prompt' | 'caption' | 'option';
  look: Look;
  gl: Gl[];
  rows: number;
  rowW: number[];
  W: number;
  H: number;
  lh: number;
  /** name tag above the text */
  name: Gl[] | null;
  nameW: number;
  nameCol: string;
  nameH: number;
  /** extra space on the left (radio glyph, keycap) */
  lead: number;
  anchor: Anchor | null;
  /** what to do while the anchor is off screen */
  lost: 'top' | 'hide' | 'mori';
  place: 'above' | 'right' | 'fixed';
  align: 'center' | 'left';
  prio: number;
  t0: number;
  pre: number;
  shown: number;
  pause: number;
  typedAt: number;
  hold: boolean;
  ttl: number;
  outAt: number;
  stag: number;
  waiting: boolean;
  voice: number;
  blips: number;
  /** drift up per second after typing (notices, pickups) */
  rise: number;
  icon: Spr | null;
  tag: Gl[] | null;
  tagCol: string;
  // placement
  px: number;
  py: number;
  off: number;
  placed: boolean;
  vis: boolean;
  ax: number;
  ay: number;
  // promises
  resTyped: () => void;
  resDone: () => void;
  typed: Promise<void>;
  done: Promise<void>;
  isTyped: boolean;
  gone: boolean;
  /** option sets: selected / hovered */
  sel?: boolean;
  dim?: boolean;
  keyLabel?: string;
  /** fixed placement (sky, caption) */
  fixed?: () => [number, number];
  /** sky pieces share one exit time */
  group?: number;
}

let items: Item[] = [];
let nextId = 1;
let raf = 0;
let lastT = 0;

function advOf(font: PxFontId, ch: string): number {
  return sprite(`a|${font}|${ch}`, () => ({ c: null as unknown as HTMLCanvasElement, w: pxMeasure(ch + 'l', font) - pxMeasure('l', font), h: 0 })).w;
}
function tokW(t: Tok, L: Look): number {
  if (t.t === 'icon') return (iconSpr(t.ch).w - 1) * L.k;
  if (t.t === 'key') return (keySpr(t.ch).w + 2) * L.k;
  return (advOf(L.font, t.ch) + L.track) * L.k;
}
function layoutToks(toks: Tok[], L: Look, maxW: number): { gl: Gl[]; rows: number; rowW: number[] } {
  const gl: Gl[] = [];
  let x = 0, row = 0, i = 0, n = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t.t === 'nl') { row++; x = 0; i++; continue; }
    if (t.t === 'sp') {
      if (x > 0) { const w = tokW(t, L); gl.push({ ...t, x, row, w, born: -1, i: n++ }); x += w; }
      i++;
      continue;
    }
    let j = i, ww = 0;
    while (j < toks.length && toks[j].t !== 'sp' && toks[j].t !== 'nl') { ww += tokW(toks[j], L); j++; }
    if (x > 0 && x + ww > maxW) { row++; x = 0; }
    for (let k = i; k < j; k++) {
      const w = tokW(toks[k], L);
      if (x > 0 && x + w > maxW && ww > maxW) { row++; x = 0; }
      gl.push({ ...toks[k], x, row, w, born: -1, i: n++ });
      x += w;
    }
    i = j;
  }
  const rows = row + 1;
  const rowW = new Array(rows).fill(0);
  for (const q of gl) if (q.t !== 'sp') rowW[q.row] = Math.max(rowW[q.row], q.x + q.w - (q.t === 'c' ? L.k : 0));
  // drop spaces that ended up at the end of a row
  return { gl: gl.filter(q => !(q.t === 'sp' && q.x >= rowW[q.row])), rows, rowW };
}

const pend = (): [Promise<void>, () => void] => { let r!: () => void; const p = new Promise<void>(res => (r = res)); return [p, r]; };

interface MakeOpts {
  kind: Kind;
  style: Item['style'];
  text: string;
  anchor: Anchor | null;
  lost?: Item['lost'];
  place?: Item['place'];
  align?: Item['align'];
  speaker?: string;
  name?: string;
  voice?: number;
  speed?: number;
  hold?: boolean;
  ttl?: number;
  prio?: number;
  pre?: number;
  rise?: number;
  look?: Partial<Look>;
  tag?: string;
  accent?: string;
  icon?: Spr | null;
  keyLabel?: string;
  fixed?: () => [number, number];
  delay?: number;
}

function make(o: MakeOpts): Item {
  const toks = parseFloatText(o.text);
  const L = { ...lookFor(o.style, o.speaker, plainOf(toks).length), ...(o.look ?? {}) };
  if (o.speed) L.speed *= o.speed;
  const lead = (o.style === 'radio' ? 12 : 0) + (o.keyLabel ? keySpr(o.keyLabel).w + 3 : 0) + (o.icon ? o.icon.w + 2 : 0);
  const maxW = Math.max(60, Math.min(L.maxW, Math.floor((CW || 400) * (o.kind === 'sky' ? 0.92 : 0.66)) - lead));
  const lay = layoutToks(toks, L, maxW);
  const [fm0, fm1, fm2] = FM[L.font];
  const lh = fm2 * L.k;
  let name: Gl[] | null = null, nameW = 0;
  if (o.name) {
    const nl = layoutToks(parseFloatText(o.name.toUpperCase()), { ...L, font: 'tiny', k: 1, track: 1 }, 999);
    name = nl.gl; nameW = nl.rowW[0] ?? 0;
  }
  let tag: Gl[] | null = null, tagW = 0;
  if (o.tag) {
    const tl = layoutToks(parseFloatText(o.tag.toUpperCase()), { ...L, font: 'tiny', k: 1, track: 1 }, 999);
    tag = tl.gl; tagW = (tl.rowW[0] ?? 0) + 5;
  }
  const textW = Math.max(0, ...lay.rowW);
  const nameH = name ? 9 : 0;
  const W = Math.max(textW + lead + tagW, nameW);
  const H = nameH + (lay.rows - 1) * lh + (fm0 + fm1) * L.k + 3 + L.depth;
  const [typed, resTyped] = pend();
  const [done, resDone] = pend();
  const it: Item = {
    id: nextId++, kind: o.kind, style: o.style, look: L, gl: lay.gl, rows: lay.rows, rowW: lay.rowW, W, H, lh,
    name, nameW, nameCol: o.speaker ? nameCol(o.speaker) : '#fff1cc', nameH, lead: lead + tagW,
    anchor: o.anchor, lost: o.lost ?? 'top', place: o.place ?? 'above', align: o.align ?? 'center', prio: o.prio ?? 5,
    t0: now() + (o.delay ?? 0), pre: o.pre ?? 0, shown: 0, pause: 0, typedAt: -1, hold: !!o.hold, ttl: o.ttl ?? 2.6,
    outAt: -1, stag: 0.01, waiting: false, voice: o.voice ?? 0, blips: 0, rise: o.rise ?? 0,
    icon: o.icon ?? null, tag, tagCol: o.accent ?? '#7fe0d0',
    px: 0, py: 0, off: 0, placed: false, vis: false, ax: 0, ay: 0,
    resTyped, resDone, typed, done, isTyped: false, gone: false,
    keyLabel: o.keyLabel, fixed: o.fixed,
  };
  if (!it.gl.length) { it.isTyped = true; it.typedAt = now(); resTyped(); }
  return it;
}

function add(it: Item): Item {
  if (!layer()) { it.isTyped = true; it.resTyped(); it.gone = true; it.resDone(); return it; }
  fitLayer();
  items.push(it);
  if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  if (it.style === 'shout' && it.kind !== 'sky' && !reduced) {
    const st = (game.scene as { st?: { shake?(a: number, t: number): void } } | null)?.st;
    try { st?.shake?.(2, 0.22); } catch { /* */ }
  }
  return it;
}

function leave(it: Item, fast = false) {
  if (it.outAt >= 0 || it.gone) return;
  const n = Math.max(1, it.gl.length);
  it.outAt = now();
  it.stag = fast ? Math.min(0.008, 0.1 / n) : Math.min(0.02, 0.36 / n);
  it.waiting = false;
  if (!it.isTyped) { it.isTyped = true; it.resTyped(); }
}

function handle(it: Item): FloatHandle {
  return {
    typed: it.typed,
    done: it.done,
    isTyped: () => it.isTyped,
    skip: () => skipItem(it),
    wait: (on: boolean) => { it.waiting = on; },
    dismiss: () => leave(it, it.kind === 'line'),
    alive: () => !it.gone && it.outAt < 0,
  };
}
function skipItem(it: Item) {
  if (it.isTyped) return;
  const t = now();
  let j = 0;
  for (const q of it.gl) if (q.born < 0) q.born = t + (j++) * 0.004;
  it.shown = it.gl.length;
  it.pre = 0;
}

// ---------------------------------------------------------------- anchors
type SpeakerLike = { name?: string; color?: string; voice?: number; anchor?: () => [number, number] | null };
type BubblesLike = { speaker(id: string): SpeakerLike | undefined };
const bubbles = () => (game as unknown as { ui?: { bubbles?: BubblesLike } }).ui?.bubbles;

/** CSS point of a world point on the gameplay plane */
export function worldToCss(x: number, y: number): [number, number] | null {
  const r = (game as unknown as { r?: { projectX(x: number, p: number): number; projectY(y: number, p: number): number; VW: number; VH: number } }).r;
  const R = rootRect ?? (game as unknown as { ui?: { root?: HTMLElement } }).ui?.root?.getBoundingClientRect();
  if (!r || !R) return null;
  const sx = r.projectX(x, 1), sy = r.projectY(y, 1);
  return [(sx / r.VW) * R.width, (sy / r.VH) * R.height];
}
/** Mori's head (the player), wherever he is */
export function moriAnchor(): Anchor {
  return () => {
    const sc = game.scene as { player?: { id?: string; body?: { cssAnchor?(): [number, number] | null } } } | null;
    const id = sc?.player?.id ?? 'mori';
    const b = bubbles();
    const sp = b?.speaker(id) ?? b?.speaker('mori') ?? b?.speaker('rowan');
    if (sp?.anchor) return sp.anchor();
    return sc?.player?.body?.cssAnchor?.() ?? null;
  };
}
interface Resolved { anchor: Anchor | null; name?: string; color?: string; voice?: number }
function resolveActor(a: unknown): Resolved {
  if (typeof a === 'string') {
    const sp = bubbles()?.speaker(a);
    if (sp?.anchor) { const f = sp.anchor; return { anchor: () => f(), name: sp.name, color: sp.color, voice: sp.voice }; }
    const ac = (game.scene as { actor?(id: string): { cssAnchor?(): [number, number] | null } | undefined } | null)?.actor?.(a);
    if (ac?.cssAnchor) return { anchor: () => ac.cssAnchor!() };
    return { anchor: null };
  }
  if (a && typeof a === 'object') {
    const o = a as { anchor?: unknown; cssAnchor?: unknown; x?: unknown; y?: unknown; id?: unknown; name?: unknown; color?: unknown; voice?: unknown };
    if (typeof o.anchor === 'function') { const f = o.anchor as Anchor; return { anchor: () => f.call(a), name: o.name as string, color: o.color as string, voice: o.voice as number }; }
    if (typeof o.cssAnchor === 'function') {
      const sp = typeof o.id === 'string' ? bubbles()?.speaker(o.id) : undefined;
      const f = o.cssAnchor as Anchor;
      return { anchor: () => f.call(a), name: sp?.name, color: sp?.color, voice: sp?.voice };
    }
    if (typeof o.x === 'number' && typeof o.y === 'number') return { anchor: () => worldToCss(o.x as number, o.y as number) };
  }
  return { anchor: null };
}
const staticAt = (p: [number, number]): Anchor => () => p;

// ---------------------------------------------------------------- the frame
function topMargin() {
  const lb = (game as unknown as { ui?: { letter?: HTMLElement } }).ui?.letter;
  return lb?.classList.contains('on') ? Math.ceil(CH * 0.11) + 3 : 4;
}
function botMargin() {
  const lb = (game as unknown as { ui?: { letter?: HTMLElement } }).ui?.letter;
  return lb?.classList.contains('on') ? Math.ceil(CH * 0.11) + 3 : 4;
}
const modalUp = () => { const u = (game as unknown as { ui?: { modalOpen?: number } }).ui; return (u?.modalOpen ?? 0) > 0 || ((game as unknown as { covered?: number }).covered ?? 0) > 0; };

function loop(ms: number) {
  raf = 0;
  const dt = Math.min(0.25, Math.max(0, (ms - lastT) / 1000));
  lastT = ms;
  if (!cv || !g || !cv.isConnected) { if (!layer()) { items = []; return; } }
  fitLayer();
  const t = now();
  tick(t, dt);
  placeAll(t, dt);
  draw(t);
  items = items.filter(it => !it.gone);
  if (items.length || optionSets.length) raf = requestAnimationFrame(loop);
  else g!.clearRect(0, 0, CW, CH);
}

const PUNCT_LONG = /[.!?…]/, PUNCT_SHORT = /[,;:—–]/;
function tick(t: number, dt: number) {
  for (const it of items) {
    if (it.gone) continue;
    if (t < it.t0) continue;
    // typing
    if (!it.isTyped) {
      if (it.pre > 0) { it.pre -= dt; continue; }
      if (it.pause > 0) { it.pause -= dt; continue; }
      const before = Math.floor(it.shown);
      let sp = it.look.speed;
      if (it.style === 'scared' && hash(it.id, Math.floor(it.shown)) < 0.18) sp *= 0.35;
      if (it.style === 'radio' && hash(it.id * 7, Math.floor(t * 6)) < 0.12) sp *= 0.2;
      it.shown = Math.min(it.gl.length, it.shown + dt * sp);
      const n = Math.floor(it.shown);
      for (let k = before; k < n; k++) {
        const q = it.gl[k];
        if (q.born < 0) q.born = t;
        if (q.t === 'c' && /[a-z0-9]/i.test(q.ch) && it.voice > 0) {
          it.blips++;
          if (it.blips % 2 === 0) blip(it);
        }
        if (k === n - 1) {
          const nx = it.gl[k + 1];
          if (PUNCT_LONG.test(q.ch) && (!nx || nx.t === 'sp')) it.pause = it.style === 'sad' ? 0.36 : it.style === 'scared' ? 0.3 : 0.2;
          else if (PUNCT_SHORT.test(q.ch)) it.pause = 0.09;
        }
      }
      if (it.shown >= it.gl.length) {
        for (const q of it.gl) if (q.born < 0) q.born = t;
        it.isTyped = true;
        it.typedAt = t;
        it.resTyped();
      }
    } else if (it.typedAt < 0) it.typedAt = t;
    // time out
    if (it.outAt < 0 && it.isTyped && !it.hold && t - it.typedAt > it.ttl) leave(it);
    if (it.outAt >= 0 && t > it.outAt + it.gl.length * it.stag + 0.14) { it.gone = true; it.resDone(); }
  }
}

function blip(it: Item) {
  const st = it.style;
  const base = it.voice * (0.94 + Math.random() * 0.12);
  const pitch = st === 'shout' ? base * 0.86 : st === 'whisper' ? base * 1.08 : st === 'radio' ? base * 1.35 : st === 'sad' ? base * 0.9 : st === 'scared' ? base * (1.05 + Math.random() * 0.2) : base;
  const vol = it.kind === 'bark' ? 0.22 : st === 'shout' ? 0.62 : st === 'whisper' ? 0.16 : st === 'radio' ? 0.28 : 0.42;
  try { audio.play('dialogBlip', { pitch, vol }); } catch { /* */ }
}

interface Rect { x: number; y: number; w: number; h: number }
const hit = (r: Rect, x: number, y: number, w: number, h: number, pad = 2) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y;

function natural(it: Item, t: number): [number, number] | null {
  if (it.fixed) return it.fixed();
  let a = it.anchor?.() ?? null;
  if (!a && it.lost === 'mori') a = moriAnchor()() ?? null;
  if (it.kind === 'notice' && modalUp()) a = [((rootRect?.width ?? 0) * 0.5), (rootRect?.height ?? 0) * 0.86];
  if (!a) {
    if (it.lost === 'hide') return null;
    if (it.lost === 'mori' || it.kind === 'notice' || it.kind === 'pickup') return [Math.round(CW / 2 - it.W / 2), Math.round(CH * 0.62 - it.H)];
    return [Math.round(CW / 2 - it.W / 2), topMargin() + 6];
  }
  const ax = a[0] / S, ay = a[1] / S;
  it.ax = ax; it.ay = ay;
  const drift = it.rise && it.typedAt >= 0 ? Math.min(14, (t - it.typedAt) * it.rise) : 0;
  if (it.place === 'right') return [Math.round(ax + 4), Math.round(ay - it.H / 2 - drift)];
  const gap = it.kind === 'notice' ? 10 : it.kind === 'prompt' ? 2 : it.style === 'think' ? 12 : 4;
  return [Math.round(ax - it.W / 2), Math.round(ay - it.H - gap - drift)];
}

function placeAll(t: number, dt: number) {
  const top = topMargin(), bot = CH - botMargin();
  const placed: Rect[] = [];
  // the answers first (their own columns), then everything else by priority, newest first
  for (const set of optionSets) placeOptions(set, placed, top, bot);
  const order = items.filter(it => it.kind !== 'option' && !it.gone).sort((a, b) => a.prio - b.prio || b.id - a.id);
  const hideWorld = modalUp();
  for (const it of order) {
    if (t < it.t0 && it.kind !== 'sky') { it.vis = false; continue; }
    if (hideWorld && (it.kind === 'bark' || it.kind === 'prompt')) { it.vis = false; continue; }
    const nat = natural(it, t);
    if (!nat) { it.vis = false; continue; }
    let [x, y] = nat;
    x = Math.max(3, Math.min(CW - it.W - 3, x));
    const ny = Math.max(top, Math.min(bot - it.H, y));
    y = ny;
    if (it.kind !== 'sky') {
      // stack above whatever is in the way (below it once there's no room above), never beside it:
      // text stays over its speaker
      let guard = 0, down = false, r: Rect | undefined;
      while ((r = placed.find(p => hit(p, x, y, it.W, it.H))) && guard++ < 12) {
        const up = r.y - it.H - 2;
        if (!down && up >= top) y = up;
        else { down = true; y = r.y + r.h + 2; }
      }
    }
    const off = y - ny;
    if (!it.placed || it.kind === 'sky') { it.off = off; it.placed = true; }
    else { it.off += (off - it.off) * Math.min(1, dt * 14); if (Math.abs(off - it.off) < 0.5) it.off = off; }
    it.px = x;
    it.py = Math.max(top, Math.min(bot - it.H, Math.round(ny + it.off)));
    it.vis = true;
    // (the sky words are scenery: lines near the heads don't make way for them)
    if (it.kind !== 'sky' && it.outAt < 0) placed.push({ x: it.px, y: it.py, w: it.W, h: it.H });
  }
}

// ---------------------------------------------------------------- drawing
interface Off { dx: number; dy: number; hide: boolean; big: boolean; col?: string }
function motion(it: Item, q: Gl, t: number): Off {
  const o: Off = { dx: 0, dy: 0, hide: false, big: false };
  if (q.born < 0 || t < q.born) { o.hide = true; return o; }
  const age = t - q.born, i = q.i;
  // leaving: each letter lifts a pixel or two and blinks out
  if (it.outAt >= 0) {
    const tj = it.outAt + i * it.stag;
    if (t > tj + 0.1) { o.hide = true; return o; }
    if (t > tj) o.dy -= t > tj + 0.05 ? 2 : 1;
  }
  if (reduced) return o;
  if (it.kind === 'sky') {
    // big letters drop in from above and land with a little bounce
    const k = it.look.k;
    o.dy += age < 0.04 ? -4 * k : age < 0.08 ? -2 * k : age < 0.13 ? k : 0;
    return o;
  }
  const f = Math.floor(t * 18);
  switch (it.style) {
    case 'say': case 'notice': case 'prompt': case 'option': case 'caption':
      o.dy += age < 0.04 ? 2 : age < 0.08 ? 1 : age < 0.13 ? -1 : 0;
      break;
    case 'shout': {
      // each letter punches up out of the line and slams down onto it
      const k = it.look.k;
      o.dy += age < 0.035 ? -3 * k : age < 0.07 ? -k : age < 0.11 ? k : 0;
      const since = t - it.t0;
      const loud = since < 0.9 || (it.typedAt < 0) || ((t * 0.8) % 1 < 0.1);
      if (loud) { o.dx += hash(i, f) < 0.33 ? -1 : hash(i, f) > 0.66 ? 1 : 0; o.dy += hash(i + 99, f) < 0.3 ? -1 : hash(i + 99, f) > 0.7 ? 1 : 0; }
      break;
    }
    case 'whisper':
      o.dy += Math.round(Math.sin(t * 2.4 + i * 0.55) * 1.1);
      if (age < 0.12) o.col = it.look.out === OUT ? '#5a6070' : '#4a5060';
      break;
    case 'scared': {
      const ff = Math.floor(t * 22);
      o.dx += hash(i * 3, ff) < 0.3 ? -1 : hash(i * 3, ff) > 0.7 ? 1 : 0;
      o.dy += hash(i * 5 + 1, ff) < 0.25 ? -1 : hash(i * 5 + 1, ff) > 0.8 ? 1 : 0;
      o.dy += age < 0.05 ? 1 : 0;
      break;
    }
    case 'happy':
      // a light wave runs along the line (a pixel), each letter hops in
      o.dy -= Math.sin(t * 5.5 - i * 0.45) > 0.55 ? 1 : 0;
      if (age < 0.06) o.dy -= 2; else if (age < 0.11) o.dy -= 1;
      break;
    case 'laugh':
      o.dy -= Math.round(Math.abs(Math.sin(t * 9 - i * 0.7)) * 3);
      if (age < 0.08) o.dy -= 2;
      break;
    case 'sad':
      // each letter lands a pixel high and slowly sinks onto a sagging line
      o.dy += age < 0.5 ? -1 : age < 1.1 ? 0 : 1;
      break;
    case 'think':
      o.dy += Math.sin(t * 2 + i * 0.3) > 0.75 ? -1 : 0;
      o.dy += age < 0.1 ? 1 : 0;
      break;
    case 'radio': {
      const ff = Math.floor(t * 20);
      if (hash(i, ff) < 0.05) o.hide = true;
      else if (hash(i + 31, ff) < 0.06) o.dx += hash(i, ff + 1) < 0.5 ? -1 : 1;
      if (age < 0.06) o.col = '#ffffff';
      break;
    }
  }
  return o;
}
/** whole-item motion (the thought drifts, a radio glitch, a shout's first punch) */
function drift(it: Item, t: number): [number, number] {
  if (reduced) return [0, 0];
  if (it.style === 'think') return [Math.round(Math.sin(t * 0.8 + it.id) * 1), Math.round(Math.sin(t * 1.5 + it.id) * 1.5)];
  // a sad line breathes down, slowly
  if (it.style === 'sad') return [0, Math.sin(t * 1.1 + it.id) > 0.3 ? 1 : 0];
  if (it.style === 'radio') { const p = Math.floor(t * 0.7 + it.id); if ((t * 0.7 + it.id) % 1 < 0.06 && hash(p, it.id) < 0.6) return [hash(p, 3) < 0.5 ? -2 : 2, 0]; }
  if (it.kind === 'prompt') return [0, Math.floor(t * 2.2) % 2 ? -1 : 0];
  if (it.sel) return [2, 0];
  return [0, 0];
}

function colOf(it: Item, q: Gl): string {
  const L = it.look;
  if (it.dim) return q.mark === 2 ? mixHex(L.kw, '#7a7060', 0.4) : '#b8ae98';
  if (it.sel && it.kind === 'option' && q.mark === 0) return '#fff2b0';
  return q.mark === 1 ? L.em : q.mark === 2 ? L.kw : q.mark === 3 ? L.aside : L.fill;
}

function drawGlyphs(it: Item, gl: Gl[], bx: number, by: number, L: Look, rowOff: (row: number) => number, t: number, pass: 0 | 1, colFn: (q: Gl) => string, anim = true) {
  const k = L.k;
  for (const q of gl) {
    if (q.t === 'sp') continue;
    const m = anim ? motion(it, q, t) : { dx: 0, dy: 0, hide: q.born < 0 || t < q.born || (it.outAt >= 0 && t > it.outAt + 0.06), big: false } as Off;
    if (m.hide) continue;
    const gx = bx + rowOff(q.row) + q.x + m.dx, gy = by + q.row * it.lh + m.dy;
    if (q.t === 'icon' || q.t === 'key') {
      if (pass === 0) continue;
      const sp = q.t === 'icon' ? iconSpr(q.ch) : keySpr(q.ch);
      const cap = FM[L.font][0] * k;
      g!.drawImage(sp.c, gx - (q.t === 'icon' ? k : 0), gy + Math.round(cap / 2 - (sp.h * k) / 2), sp.w * k, sp.h * k);
      continue;
    }
    const kk = m.big ? k + 1 : k;
    const ox = m.big ? -Math.floor((q.w / k) / 2) : 0, oy = m.big ? -Math.floor(FM[L.font][0] / 2) : 0;
    if (pass === 0) {
      const s = silSpr(L.font, q.ch, L.out);
      g!.drawImage(s.c, gx - kk + ox, gy - 3 * kk + oy, s.w * kk, s.h * kk);
      if (L.depth) for (let d = 1; d <= L.depth; d++) g!.drawImage(s.c, gx - kk + ox, gy - 3 * kk + oy + d, s.w * kk, s.h * kk);
    } else {
      const c = m.col ?? colFn(q);
      const s = fillSpr(L.font, q.ch, c);
      g!.drawImage(s.c, gx - kk + ox, gy - 3 * kk + oy, s.w * kk, s.h * kk);
      if (L.fill2 && !m.col && c === L.fill) {
        const s2 = fillSpr(L.font, q.ch, L.fill2);
        const split = 3 + Math.ceil(FM[L.font][0] / 2);
        g!.drawImage(s2.c, 0, split, s2.w, s2.h - split, gx - kk + ox, gy - 3 * kk + oy + split * kk, s2.w * kk, (s2.h - split) * kk);
      }
    }
  }
}

function drawItem(it: Item, t: number) {
  if (!it.vis || t < it.t0) return;
  const L = it.look;
  const [ddx, ddy] = drift(it, t);
  const bx = it.px + ddx, by = it.py + ddy;
  const inner = it.W - it.lead;
  const rowOff = (row: number) => it.lead + (it.align === 'center' ? Math.floor((inner - it.rowW[row]) / 2) : 0);
  const ty = by + it.nameH + 1;
  // the name, small and in the speaker's colour
  if (it.name) {
    const nx = bx + (it.align === 'center' ? Math.floor((it.W - it.nameW) / 2) : it.lead);
    const NL: Look = { ...L, font: 'tiny', k: 1, track: 1 };
    for (const q of it.name) if (q.born < 0) q.born = it.t0;
    for (const pass of [0, 1] as const) drawGlyphs(it, it.name, nx, by + 1, NL, () => 0, t, pass, () => it.nameCol, false);
  }
  // what leads the first row, right to left from the text: the radio, a pickup's icon, the keycap,
  // a notice's tag
  const x0 = bx + rowOff(0);
  const radioW = it.style === 'radio' ? 12 : 0, iconW = it.icon ? it.icon.w + 2 : 0, keyW = it.keyLabel ? keySpr(it.keyLabel).w + 3 : 0;
  const midY = ty + Math.round((FM[L.font][0] * L.k) / 2);
  const gone = it.outAt >= 0 && t > it.outAt + 0.05;
  if (it.tag && !gone) {
    const NL: Look = { ...L, font: 'tiny', k: 1, track: 1 };
    for (const q of it.tag) if (q.born < 0) q.born = it.t0;
    for (const pass of [0, 1] as const) drawGlyphs(it, it.tag, x0 - it.lead, midY - 3, NL, () => 0, t, pass, () => it.tagCol, false);
  }
  if (radioW && !gone) {
    const on = Math.floor(t * 2.5) % 2 === 0;
    const r = rowsSpr('radio' + (on ? 1 : 0), RADIO, { k: OUT, o: '#3a4a44', g: '#2f7a5e', d: '#173c2e', L: on ? '#ff5a3a' : '#5a1a10' });
    const rx = x0 - radioW;
    g!.drawImage(r.c, rx, ty - 5);
    // crackle: a couple of static pixels off the antenna
    if (!reduced) for (let s = 0; s < 3; s++) {
      const h1 = hash(it.id + s * 13, Math.floor(t * 14));
      if (h1 < 0.45) { g!.fillStyle = h1 < 0.2 ? '#ffffff' : '#9dffd8'; g!.fillRect(rx + 2 + Math.floor(hash(s, Math.floor(t * 14)) * 6) - 2, ty - 7 - Math.floor(h1 * 8), 1, 1); }
    }
  }
  if (it.icon && !gone) {
    const ic = it.icon;
    const age = t - it.t0;
    const pop = reduced ? 0 : age < 0.06 ? -2 : age < 0.12 ? 1 : 0;
    g!.drawImage(ic.c, x0 - radioW - iconW, midY - Math.round(ic.h / 2) + pop);
  }
  if (it.keyLabel && !gone) {
    const kc = keySpr(it.keyLabel);
    g!.drawImage(kc.c, x0 - radioW - iconW - keyW, midY - Math.round(kc.h / 2) - 1);
  }
  // the typing dots while a line is about to start
  if (!it.isTyped && it.shown < 1 && it.pre > 0 && it.kind === 'line') {
    const d = rowsSpr('tdot', DOT(1), { c: '#fff6e4', k: OUT });
    const cx = bx + Math.floor(it.W / 2) - 10;
    for (let n = 0; n < 3; n++) g!.drawImage(d.c, cx + n * 7, ty + 1 - (reduced ? 0 : Math.max(0, Math.round(Math.sin(t * 9 - n * 0.9) * 2))));
  }
  // the letters: every ring first, then every fill (rings never cut into a neighbour)
  const colFn = (q: Gl) => colOf(it, q);
  drawGlyphs(it, it.gl, bx, ty, L, rowOff, t, 0, colFn);
  drawGlyphs(it, it.gl, bx, ty, L, rowOff, t, 1, colFn);
  // shout: burst marks at the corners
  if (it.style === 'shout' && it.outAt < 0 && !reduced) {
    const since = t - it.t0;
    if (since < 0.7 || (t * 0.8) % 1 < 0.1) {
      const k = L.k;
      burst(bx - 3 - k, by + it.nameH - 1, -1, k);
      burst(bx + it.W + 2 + k, by + it.nameH - 1, 1, k);
    }
  }
  // think: the dots rising from the head
  if (it.style === 'think' && it.place === 'above' && it.anchor && it.outAt < 0) {
    const fx = it.ax, fy = it.ay - 1;
    const tx = bx + Math.floor(it.W / 2), tyy = by + it.H + 1;
    for (let d = 0; d < 3; d++) {
      const k = 0.25 + d * 0.27;
      const sp = rowsSpr('dot' + d, DOT(d === 0 ? 0 : d === 1 ? 1 : 1.5), { c: '#e4dcff', k: OUT });
      const bob = reduced ? 0 : Math.round(Math.sin(t * 3 - d * 0.9) * 1);
      if (t - it.t0 < d * 0.12) continue;
      g!.drawImage(sp.c, Math.round(fx + (tx - fx) * k - sp.w / 2), Math.round(fy + (tyy - fy) * k - sp.h / 2) + bob);
    }
  }
  // the "more" arrow when a line waits for the player
  if (it.waiting && it.isTyped && it.outAt < 0) {
    const last = it.gl[it.gl.length - 1];
    const row = last ? last.row : 0;
    const ar = rowsSpr('more', MORE, { k: OUT, c: '#ffe066' });
    const bob = Math.floor(t * 3) % 2;
    g!.drawImage(ar.c, bx + rowOff(row) + it.rowW[row] + 3, ty + row * it.lh + FM[L.font][0] * L.k - 4 + bob);
  }
}

function burst(x: number, y: number, dir: number, k: number) {
  const px: [number, number][] = [];
  for (let i = 0; i < 3 + k; i++) px.push([x + dir * i, y]);
  for (let i = 1; i < 3 + k; i++) px.push([x + dir * (i - 1), y - i]);
  for (let i = 2; i < 4 + k; i++) px.push([x, y - i - 1]);
  g!.fillStyle = OUT;
  for (const [a, b] of px) g!.fillRect(a - 1, b - 1, 3, 3);
  g!.fillStyle = '#fff6dc';
  for (const [a, b] of px) g!.fillRect(a, b, 1, 1);
}

function draw(t: number) {
  const c = g!;
  c.clearRect(0, 0, CW, CH);
  c.imageSmoothingEnabled = false;
  // least important first, so the conversation sits on top
  const order = items.filter(i => i.vis && !i.gone).sort((a, b) => b.prio - a.prio || a.id - b.id);
  for (const it of order) drawItem(it, t);
  if (optionSets.length) { drawOptionNames(t); drawOptionPointers(t); }
}

// ---------------------------------------------------------------- public: lines
/** show a line of floating text; returns a handle (the dialogue uses it to wait / skip / dismiss) */
export function floatLine(o: FloatOpts & { kind?: 'line' | 'bark' | 'notice'; lost?: Item['lost']; pre?: number; prio?: number }): FloatHandle {
  layer();
  if (cv) fitLayer();
  const style = o.style ?? 'say';
  let r: Resolved = { anchor: null };
  if (o.at) r = { anchor: typeof o.at === 'function' ? o.at : staticAt(o.at) };
  else if (o.actor !== undefined && o.actor !== null) r = resolveActor(o.actor);
  else if (typeof o.x === 'number' && typeof o.y === 'number') { const x = o.x, y = o.y; r = { anchor: () => worldToCss(x, y) }; }
  else r = { anchor: moriAnchor() };
  const kind = o.kind ?? (style === 'notice' ? 'notice' : o.hold ? 'line' : 'bark');
  const aimed = !!o.at || (o.actor !== undefined && o.actor !== null) || typeof o.x === 'number';
  const it = make({
    // (a bark over someone who walks off screen goes with them; one by Mori stays near where he is)
    kind, style, text: o.text, anchor: r.anchor, lost: o.lost ?? (kind === 'notice' || !aimed ? 'mori' : kind === 'bark' ? 'hide' : 'top'),
    place: o.place, align: o.place === 'right' ? 'left' : 'center',
    speaker: o.color ?? r.color, name: o.name, voice: o.voice ?? (kind === 'notice' ? 0 : r.voice ?? 1), speed: o.speed,
    hold: o.hold, ttl: (o.ms ?? (kind === 'notice' ? 2600 : 2400 + o.text.length * 45)) / 1000,
    prio: o.prio ?? (kind === 'line' ? 2 : kind === 'bark' ? 4 : 6), pre: o.pre ?? 0, rise: kind === 'notice' ? 5 : 0,
    tag: o.tag, accent: o.accent,
  });
  add(it);
  if (kind === 'notice' && it.gl.length) { try { audio.play('bubblePop' as never, { vol: 0.12, pitch: 1.5 }); } catch { /* */ } }
  return handle(it);
}

/** show a line of floating text in the world; resolves when it has faded */
export async function floatText(o: FloatOpts): Promise<void> {
  await floatLine(o).done;
}

let noticeQ: { text: string; ms: number; tag?: string; accent?: string }[] = [];
let noticeBusy = 0;
/** a world notice near Mori (replaces toasts: "Saved", "New entry", "Too heavy"...) */
export function floatNotice(text: string, ms = 2600, o: { tag?: string; accent?: string } = {}): void {
  // a flood of notices queues: at most three float at once
  const live = items.filter(i => i.kind === 'notice' && i.outAt < 0 && !i.gone).length;
  if (live >= 3 || noticeBusy > 0) { noticeQ.push({ text, ms, ...o }); pumpNotices(); return; }
  noticeBusy = 1;
  setTimeout(() => { noticeBusy = 0; pumpNotices(); }, 260);
  floatLine({ text, style: 'notice', ms, tag: o.tag, accent: o.accent, kind: 'notice' });
}
function pumpNotices() {
  if (!noticeQ.length || noticeBusy) return;
  const live = items.filter(i => i.kind === 'notice' && i.outAt < 0 && !i.gone).length;
  if (live >= 3) { setTimeout(pumpNotices, 400); return; }
  const n = noticeQ.shift()!;
  floatNotice(n.text, n.ms, { tag: n.tag, accent: n.accent });
}

const TAG_COL: Record<string, string> = { teal: '#7fe0d0', coral: '#ff9a7a', '': '#ffd05a' };
/** the old toast(text, tag, kind, ms) as a floating notice near Mori */
export function floatToast(html: string, tag = '', kind: string = '', ms = 3200) {
  const t = (tag || '').replace(/<[^>]+>/g, '').trim();
  floatNotice(html, Math.max(1800, Math.min(4200, ms)), { tag: t && t !== 'NOTE' ? t : undefined, accent: TAG_COL[kind] ?? TAG_COL[''] });
}

// ---------------------------------------------------------------- public: prompts
let promptIt: Item | null = null;
let promptKey = '';
let promptAt: [number, number] = [0, 0];
/** the interaction prompt: a small floating word (a keycap glyph on desktop) over a target */
export function floatPrompt(html: string, cssX: number, cssY: number) {
  promptAt = [cssX, cssY];
  const touch = document.body.classList.contains('touchmode');
  let key = '';
  let text = html.replace(/<span class="key">([^<]*)<\/span>\s*/g, (_m, k: string) => { if (!key) key = k; return ''; });
  // only while Mori is near it: a mouse hovering something far off gets the pointer cursor, no word
  if (/^click$/i.test(key)) { floatPromptHide(); return; }
  if (touch) key = '';
  text = text.trim();
  const k = key + '|' + text;
  if (promptIt && !promptIt.gone && promptIt.outAt < 0 && k === promptKey) return;
  if (promptIt && promptIt.outAt < 0) leave(promptIt, true);
  promptKey = k;
  if (!layer()) return;
  fitLayer();
  promptIt = add(make({ kind: 'prompt', style: 'prompt', text, anchor: () => promptAt, lost: 'hide', prio: 3, hold: true, keyLabel: key || undefined }));
}
export function floatPromptHide() {
  if (promptIt && promptIt.outAt < 0) leave(promptIt, true);
  promptIt = null;
  promptKey = '';
}
/** where the prompt is on screen (client px), for taps */
export function floatPromptRect(): DOMRect | null {
  const it = promptIt;
  if (!it || it.gone || it.outAt >= 0 || !it.vis || !rootRect) return null;
  return new DOMRect(rootRect.left + it.px * S - 8, rootRect.top + it.py * S - 8, it.W * S + 16, it.H * S + 16);
}

// ---------------------------------------------------------------- public: area names, title cards, captions
let skyBusy: Promise<void> = Promise.resolve();
let lastSky = '';
let lastSkyT = 0;
let skyCur: Item[] = [];
let skyCurSoft = false;
let hardPending = 0;
const skyLive = () => skyCur.some(p => !p.gone);
/**
 * Big pixel words in the sky: an area name when you arrive, a chapter / day card. The chapter word in
 * small caps, the name in big two-tone block letters that drop in one by one, the subtitle in Mori's
 * hand; then the letters lift off and vanish. One at a time: title cards queue; a `soft` one (an area
 * name) is skipped while anything else is up and gives way at once to a title card.
 */
export function floatSky(title: string, sub = '', chapter = '', ms = 3000, o: { soft?: boolean } = {}): Promise<void> {
  if (o.soft) {
    const key = (chapter + '|' + title).toLowerCase();
    const t = performance.now();
    if (key === lastSky && t - lastSkyT < 20000) return Promise.resolve();
    // a moment's grace, so a title card at the start of a scene wins over the place name
    return new Promise<void>(res => setTimeout(() => {
      if (hardPending > 0 || skyLive()) { res(); return; }
      lastSky = key; lastSkyT = performance.now();
      void showSky(title, sub, chapter, ms, true).then(res, res);
    }, 700));
  }
  hardPending++;
  if (skyCurSoft) for (const p of skyCur) leave(p, true);
  const run = () => showSky(title, sub, chapter, ms, false).finally(() => { hardPending--; });
  const p = skyBusy.then(run, run);
  skyBusy = p.catch(() => {});
  return p;
}
function showSky(title: string, sub: string, chapter: string, ms: number, soft: boolean): Promise<void> {
  const run = async () => {
    if (!layer()) return;
    fitLayer();
    const grp = nextId;
    const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&[a-z]+;/g, '').trim();
    const ttl = plain(title), sb = plain(sub), chp = plain(chapter);
    let k = 3;
    while (k > 1 && (pxMeasure(ttl.toUpperCase(), 'bold') + ttl.length) * k > CW * 0.9) k--;
    const titleLook: Partial<Look> = { font: 'bold', k, fill: '#fffaf0', fill2: '#f0d49a', out: '#1a0e06', speed: 16, maxW: 999, track: 1, depth: 1 };
    const subK = CW > 620 && sb.length < 34 ? 2 : 1;
    const pieces: Item[] = [];
    const y0 = () => topMargin() + Math.round(CH * 0.045);
    const chIt: Item | null = chp ? make({ kind: 'sky', style: 'notice', text: chp.toUpperCase(), anchor: null, prio: 0, hold: true, look: { font: 'tiny', k: 1, fill: '#9ff0dc', speed: 40, track: 2, maxW: 999 }, fixed: (): [number, number] => [Math.round(CW / 2 - chIt!.W / 2), y0()] }) : null;
    const chH = chIt ? chIt.H + 2 : 0;
    const tIt: Item = make({ kind: 'sky', style: 'shout', text: ttl.toUpperCase(), anchor: null, prio: 0, hold: true, look: titleLook, delay: chIt ? 0.3 : 0, fixed: (): [number, number] => [Math.round(CW / 2 - tIt.W / 2), y0() + chH] });
    const sIt: Item | null = sb ? make({ kind: 'sky', style: 'notice', text: sb, anchor: null, prio: 0, hold: true, look: { font: 'script', k: subK, fill: '#ffd57a', speed: 36, maxW: Math.floor(CW * 0.8) }, delay: (chIt ? 0.3 : 0) + ttl.length / 16 + 0.15, fixed: (): [number, number] => [Math.round(CW / 2 - sIt!.W / 2), y0() + chH + tIt.H - FM.bold[1] * k + 2] }) : null;
    for (const p of [chIt, tIt, sIt]) if (p) { p.group = grp; pieces.push(p); }
    // the title's letters thump in: the sky style is 'shout' for its pop, without the shake
    tIt.style = 'say';
    tIt.voice = 0;
    for (const p of pieces) add(p);
    skyCur = pieces;
    skyCurSoft = soft;
    try { audio.play('whoosh' as never, { vol: soft ? 0.12 : 0.25, pitch: 0.8 }); } catch { /* */ }
    const typedAll = Promise.all(pieces.map(p => p.typed));
    await Promise.race([typedAll, new Promise(r => setTimeout(r, 4000))]);
    await new Promise(r => setTimeout(r, Math.max(900, ms - 900)));
    for (const p of pieces) leave(p);
    await Promise.all(pieces.map(p => p.done));
  };
  return run();
}

/** a caption low on the screen (narration: "An hour later...") */
export function floatCaption(text: string, ms = 2600): Promise<void> {
  if (!layer()) return Promise.resolve();
  fitLayer();
  const it: Item = add(make({ kind: 'caption', style: 'caption', text, anchor: null, prio: 0, ttl: ms / 1000, fixed: (): [number, number] => [Math.round(CW / 2 - it.W / 2), Math.round(CH - botMargin() - it.H - CH * 0.06)] }));
  return it.done;
}

/** "+2 Flax" rising off the spot where something was picked up, the item's icon beside it */
export function floatPickup(text: string, cssX: number, cssY: number, icon?: { key: string; buf: PixelBuffer } | null) {
  if (!layer()) return;
  fitLayer();
  const p: [number, number] = [cssX, cssY];
  add(make({ kind: 'pickup', style: 'notice', text, anchor: () => p, lost: 'hide', prio: 5, ttl: 1.1, rise: 9, icon: icon ? bufIcon(icon.key, icon.buf) : null, look: { fill: '#fff6dc', kw: '#ffe066' } }));
}

/** take every floating text of these kinds away (all of them when no kinds are given) */
export function clearFloats(kinds?: string[], instant = false) {
  for (const it of items) {
    if (kinds && !kinds.includes(it.kind)) continue;
    if (instant) { it.gone = true; if (!it.isTyped) { it.isTyped = true; it.resTyped(); } it.resDone(); }
    else leave(it, true);
  }
  if (instant) items = items.filter(i => !i.gone);
  if (!kinds || kinds.includes('prompt')) { promptIt = null; promptKey = ''; }
  if (!kinds || kinds.includes('option')) for (const set of [...optionSets]) set.cancel?.();
}

// ---------------------------------------------------------------- public: answers
export interface FloatOption {
  text: string;
  /** whose answer: options with the same group stack in one column over that anchor */
  group?: string;
  anchor?: Anchor | null;
  name?: string;
  color?: string;
}
export interface FloatChoiceOpts {
  /** seconds before it resolves null (no answer); 0 = no limit. No bar is ever drawn: the scene shows
   *  the clock (or the brass pocket watch, see below) */
  timeout?: number;
  /** each frame: seconds elapsed, 0..1 of the timeout */
  tick?: (t: number, k: number) => void;
  /** show the countdown on the pocket watch (src/ui/v12/watch.ts, the loop module's) */
  watch?: boolean;
  /** where the column floats when an option names no anchor (default: over Mori) */
  anchor?: Anchor | null;
}
interface OptionSet { cancel?: () => void; opts: Item[]; groups: { key: string; ids: number[]; anchor: Anchor | null; name: Gl[] | null; nameW: number; nameCol: string }[]; sel: number; picked: number; t0: number }
let optionSets: OptionSet[] = [];

function placeOptions(set: OptionSet, placed: Rect[], top: number, bot: number) {
  const cols = set.groups.map(gr => {
    const a = (gr.anchor ?? moriAnchor())() ?? null;
    const its = gr.ids.map(i => set.opts[i]);
    const w = Math.max(gr.nameW, ...its.map(i => i.W)) + 8;
    const h = its.reduce((s, i) => s + i.H + 3, 0) + (gr.name ? 9 : 0);
    const ax = a ? a[0] / S : CW / 2, ay = a ? a[1] / S : CH * 0.7;
    return { gr, its, w, h, ax, ay, x: 0 };
  });
  cols.sort((a, b) => a.ax - b.ax);
  let right = 4;
  for (const c of cols) { c.x = Math.max(right, Math.round(c.ax - c.w / 2)); right = c.x + c.w + 8; }
  const over = right - 8 - (CW - 4);
  if (over > 0) for (const c of cols) c.x = Math.max(4, c.x - over);
  for (const c of cols) {
    let y = Math.max(top, Math.min(bot - c.h, Math.round(c.ay - 8 - c.h)));
    if (c.gr.name) y += 9;
    for (const it of c.its) {
      it.px = c.x + 6;
      it.py = y;
      it.vis = true;
      it.placed = true;
      y += it.H + 3;
    }
    placed.push({ x: c.x, y: Math.max(top, Math.round(c.ay - 8 - c.h)), w: c.w, h: c.h });
  }
}

/** the answers float near Mori (or over whoever would say them); keys 1-9, a click or a tap picks one */
export function floatChoices(options: FloatOption[], o: FloatChoiceOpts = {}): Promise<number | null> {
  if (!layer() || !options.length) return Promise.resolve(options.length ? 0 : null);
  fitLayer();
  const touch = document.body.classList.contains('touchmode');
  const set: OptionSet = { opts: [], groups: [], sel: 0, picked: -1, t0: now() };
  options.forEach((op, i) => {
    const gk = op.group ?? '';
    let gr = set.groups.find(q => q.key === gk);
    if (!gr) {
      let name: Gl[] | null = null, nameW = 0;
      if (op.name) { const nl = layoutToks(parseFloatText(op.name.toUpperCase()), { ...lookFor('say', undefined, 0), font: 'tiny', k: 1, track: 1 }, 999); name = nl.gl; nameW = nl.rowW[0] ?? 0; }
      gr = { key: gk, ids: [], anchor: op.anchor ?? o.anchor ?? null, name, nameW, nameCol: op.color ? nameCol(op.color) : '#fff1cc' };
      set.groups.push(gr);
    }
    gr.ids.push(i);
    const it = make({ kind: 'option', style: 'option', text: op.text, anchor: null, prio: 1, hold: true, align: 'left', keyLabel: touch ? undefined : String(i + 1), delay: i * 0.06, speaker: op.color });
    it.fixed = undefined;
    set.opts.push(it);
  });
  optionSets.push(set);
  for (const it of set.opts) { items.push(it); }
  if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  try { audio.play('bubblePop' as never, { vol: 0.2, pitch: 1.2 }); } catch { /* */ }
  const paintSel = () => set.opts.forEach((it, i) => { it.sel = i === set.sel; it.dim = i !== set.sel; });
  paintSel();
  return new Promise<number | null>(res => {
    let fin = false, rafT = 0;
    const finish = (i: number | null) => {
      if (fin) return;
      fin = true;
      cancelAnimationFrame(rafT);
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('pointerdown', pd, true);
      window.removeEventListener('pointermove', pm, true);
      set.picked = i ?? -1;
      set.opts.forEach((it, k) => { if (k === i) { it.sel = true; it.dim = false; setTimeout(() => leave(it), 260); } else leave(it, true); });
      if (i !== null) { try { audio.play('ui', { vol: 0.4, pitch: 1.2 }); } catch { /* */ } }
      void Promise.all(set.opts.map(it => it.done)).then(() => { optionSets = optionSets.filter(s => s !== set); });
      res(i);
    };
    const at = (e: { clientX: number; clientY: number }): number => {
      if (!rootRect) return -1;
      const x = (e.clientX - rootRect.left) / S, y = (e.clientY - rootRect.top) / S;
      const pad = touch ? 5 : 2;
      return set.opts.findIndex(it => it.vis && x >= it.px - 4 - pad && x <= it.px + it.W + pad && y >= it.py - pad && y <= it.py + it.H + pad);
    };
    const pd = (e: PointerEvent) => {
      const i = at(e);
      if (i >= 0) { e.stopPropagation(); e.preventDefault(); set.sel = i; paintSel(); finish(i); }
    };
    const pm = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const i = at(e);
      if (i >= 0 && i !== set.sel) { set.sel = i; paintSel(); try { audio.play('ui', { vol: 0.1, pitch: 1.7 }); } catch { /* */ } }
    };
    const kd = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); set.sel = n - 1; paintSel(); finish(n - 1); return; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); set.sel = (set.sel + 1) % options.length; paintSel(); audio.play('ui', { vol: 0.1, pitch: 1.7 }); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); e.stopPropagation(); set.sel = (set.sel + options.length - 1) % options.length; paintSel(); audio.play('ui', { vol: 0.1, pitch: 1.7 }); }
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); finish(set.sel); }
    };
    window.addEventListener('keydown', kd, true);
    window.addEventListener('pointerdown', pd, true);
    window.addEventListener('pointermove', pm, true);
    set.cancel = () => finish(null);
    // TODO watch: a timed answer with `watch: true` shows its countdown on the brass pocket watch
    // (src/ui/v12/watch.ts, built by the loop module) near Mori; never a bar. Hook it up here once the
    // module lands: open it with o.timeout, wind it with k each frame, put it away in finish().
    const frame = () => {
      if (fin) return;
      const t = now() - set.t0;
      const k = o.timeout ? Math.min(1, t / o.timeout) : 0;
      o.tick?.(t, k);
      if (o.timeout && t >= o.timeout) { finish(null); return; }
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
      rafT = requestAnimationFrame(frame);
    };
    frame();
  });
}

/** options' group names are drawn with the column (the speaker over their answers) */
function drawOptionNames(t: number) {
  for (const set of optionSets) for (const gr of set.groups) {
    if (!gr.name) continue;
    const first = set.opts[gr.ids[0]];
    if (!first?.vis || first.outAt >= 0) continue;
    for (const q of gr.name) if (q.born < 0) q.born = set.t0;
    const L: Look = { ...first.look, font: 'tiny', k: 1, track: 1 };
    for (const pass of [0, 1] as const) drawGlyphs(first, gr.name, first.px, first.py - 9, L, () => 0, t, pass, () => gr.nameCol, false);
  }
}
/** the pointer beside the chosen answer */
function drawOptionPointers(t: number) {
  for (const set of optionSets) set.opts.forEach(it => {
    if (!it.vis || !it.sel || it.outAt >= 0 || t < it.t0) return;
    const ar = rowsSpr('ptr', ['k....', 'kck..', 'kcck.', 'kccck', 'kcck.', 'kck..', 'k....'], { k: OUT, c: '#ffe066' });
    const bob = reduced ? 0 : Math.floor(t * 4) % 2;
    g!.drawImage(ar.c, it.px - 7 + bob, it.py + 1 + Math.round(FM[it.look.font][0] * it.look.k / 2 - 3) + it.nameH);
  });
}

// debug: try the styles from the console (zlFloat.floatText({ text: 'Hi!', actor: 'jenna', style: 'shout' }))
try { (window as unknown as { zlFloat?: unknown }).zlFloat = { floatText, floatNotice, floatSky, floatChoices, floatCaption, floatToast, floatPickup, clearFloats, floatPrompt }; } catch { /* */ }
