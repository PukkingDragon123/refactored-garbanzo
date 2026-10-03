// Physical UI kit: a real book. A cover that slides up and swings open, pages laid out like print
// (content flows from page to page, sentences split across the turn), and a true page curl: the
// corner follows your finger, the sheet folds along the perpendicular bisector of where the corner
// was and where it is, the reverse of the page shows on the flap, and shading runs along the fold
// (the curl's highlight, the shadow it casts on the page underneath, the flap's drop shadow).
//
// Two-page spreads on wide screens, one page at a time (curling off to the left) on phones in
// portrait. Turn by dragging a page edge or corner, clicking the outer edge, the drawn arrows, the
// arrow keys / A D / Page Up Down, or by touching the tabs on the fore-edge (they move to the left
// side as you pass them, like a real thumb index). Ribbons mark pages. Esc (or the key that opened
// the book) closes it: the cover swings shut and the book slides away.
//
// See index.ts for the API overview.

import { game } from '../../../game/game';
import { guardInput } from '../../../core/input';
import { pushKeys } from '../../laptop-kit';
import { el } from '../../ui';
import { installPaper, handReady } from './css';
import { paperBg, paperTex, coverTex } from './textures';
import type { PaperKind } from './textures';
import { fillSketches, doodle, doodleNames } from './sketch';
import { svgInk, roughArrow, roughLine, INK, PENCIL } from './ink';
import { paperSfx } from './sound';
import { hashStr, rng } from './rng';
import { escHtml } from './decor';

// ---------------------------------------------------------------- public types

export interface BookBlock {
  /** the block's html (one paragraph, a figure, a list...) */
  html: string;
  cls?: string;
  /** start a new page before this block */
  brk?: boolean;
  /** never leave this block last on a page (headings) */
  keep?: boolean;
  /** plain-text paragraph that may be split between pages at sentence ends */
  split?: boolean;
}

export interface BookSection {
  id: string;
  /** the tab this section belongs to */
  tab?: string;
  /** running heads: left page, right page */
  head?: { l?: string; r?: string };
  /** flowing content (laid out over as many pages as it needs)... */
  blocks?: () => BookBlock[];
  /** ...or fixed pages (each string is one page's content) */
  pages?: () => string[];
  /** spread mode: begin on a left-hand page (default true) */
  startLeft?: boolean;
  /** page class(es) for this section's pages */
  cls?: string;
  /** paper for this section's pages (the book's paper by default) */
  paper?: PaperKind;
  /** called when one of the section's pages comes into view (first time per open) */
  shown?: (page: HTMLElement, index: number, book: BookHandle) => void;
}

export interface BookTab { id: string; label: string; color: string; icon?: string; section: string }
export interface BookRibbon { section: string; color: string; label?: string }

export interface BookLook {
  title: string;
  sub?: string;
  /** cover colour */
  color: string;
  material?: 'leather' | 'cloth';
  /** foil colour for the title */
  foil?: string;
  /** an elastic band round the cover (field notebooks) */
  band?: string;
  /** html stamped / stuck on the cover (doodles, stickers) */
  emblem?: string;
  /** a paper label on the cover, handwritten */
  label?: string;
  /** the inside of the cover */
  inside?: 'endpaper' | PaperKind;
  /** the page paper */
  paper?: PaperKind;
  /** rounded corners and corner protectors */
  corners?: boolean;
}

export interface BookOpts {
  id: string;
  look: BookLook;
  sections: BookSection[];
  tabs?: BookTab[];
  ribbons?: BookRibbon[];
  /** open at this section (default: the first) */
  start?: string;
  /** a key that also closes the book (the one that opened it, e.g. 'KeyJ') */
  key?: string;
  /** data-act clicks inside pages (return true if handled) */
  onAct?: (act: string, el: HTMLElement, book: BookHandle, ev: MouseEvent) => boolean | void;
  /** extra keys while open (return true if handled) */
  onKey?: (e: KeyboardEvent, book: BookHandle) => boolean | void;
  /** blank (padding) page content */
  blank?: (seed: number) => string;
  onClose?: () => void;
  /** extra class on the wrap (theme hooks) */
  cls?: string;
}

export interface BookHandle {
  readonly root: HTMLElement;
  /** resolves when the book has closed */
  readonly closed: Promise<void>;
  goto(section: string, o?: { page?: number; instant?: boolean }): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  /** re-lay out (a section or everything) and redraw the open pages */
  refresh(section?: string): void;
  /** replace the sections (and optionally tabs / ribbons), keeping the place */
  setSections(s: BookSection[], tabs?: BookTab[], ribbons?: BookRibbon[]): void;
  close(): Promise<void>;
  current(): { section: string; page: number };
  /** the page elements on screen now */
  visiblePages(): HTMLElement[];
  isOpen(): boolean;
}

// ---------------------------------------------------------------- styles

const CSS = `
.ppb-wrap { position: absolute; inset: 0; z-index: 62; pointer-events: auto; overflow: hidden; touch-action: none; perspective: 2400px;
  display: flex; align-items: center; justify-content: center; -webkit-user-select: none; user-select: none; }
.ppb-dim { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 75% at 50% 52%, rgba(16, 10, 4, 0.45), rgba(6, 3, 1, 0.82)); opacity: 0; transition: opacity 0.4s; }
.ppb-wrap.on .ppb-dim { opacity: 1; }
.ppb-book { position: relative; transform-style: preserve-3d; will-change: transform; }
.ppb-board { position: absolute; border-radius: 0.5em 0.9em 0.9em 0.5em; box-shadow: 0 1.4em 2.6em rgba(0,0,0,0.55), 0 0.3em 0.6em rgba(0,0,0,0.4); }
.ppb-board::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 0.12em rgba(255,255,255,0.08), inset 0 0 1.2em rgba(0,0,0,0.45); }
.ppb-edge { position: absolute; top: 0.25%; bottom: 0.25%; width: 0.55em; pointer-events: none;
  background: repeating-linear-gradient(90deg, #efe4c6 0 1px, #d8c8a0 1px 2px, #f4ead0 2px 3px); box-shadow: inset 0 0 0.4em rgba(80,50,20,0.35); }
.ppb-edge.l { left: -0.45em; border-radius: 0.3em 0 0 0.3em; } .ppb-edge.r { right: -0.45em; border-radius: 0 0.3em 0.3em 0; }
.ppb-single .ppb-edge.l { display: none; }
.ppb-pages { position: absolute; inset: 0; }
.ppb-pg { position: absolute; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; backface-visibility: hidden; }
.ppb-pg.hidden { visibility: hidden; }
.ppb-in { position: absolute; inset: 0; color: var(--pp-ink); }
.ppb-in::after { content: ''; position: absolute; top: 0; bottom: 0; width: 14%; pointer-events: none; }
.ppb-pg.l .ppb-in::after { right: 0; background: linear-gradient(90deg, rgba(60,40,15,0) 0%, rgba(60,40,15,0.07) 55%, rgba(60,40,15,0.28) 100%); }
.ppb-pg.r .ppb-in::after { left: 0; background: linear-gradient(270deg, rgba(60,40,15,0) 0%, rgba(60,40,15,0.07) 55%, rgba(60,40,15,0.3) 100%); }
.ppb-sh { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.ppb-hd { position: absolute; top: 3.2%; left: 9%; right: 9%; display: flex; justify-content: space-between; align-items: baseline; font-size: 0.7em; letter-spacing: 0.16em; text-transform: uppercase; color: #8a7652; opacity: 0.9; white-space: nowrap; overflow: hidden; }
.ppb-pg.l .ppb-hd { left: 8%; right: 11%; } .ppb-pg.r .ppb-hd { left: 11%; right: 8%; }
.ppb-hd:empty { display: none; }
.ppb-ct { position: absolute; top: 7.5%; bottom: 6.5%; overflow: hidden; }
.ppb-pg.l .ppb-ct { left: 8%; right: 11%; } .ppb-pg.r .ppb-ct { left: 11%; right: 8%; }
.ppb-ft { position: absolute; bottom: 2.4%; left: 10%; right: 10%; text-align: center; font-size: 0.75em; color: #9a8662; }
.ppb-bk { position: relative; }
.ppb-bk.ppb-sq1 { font-size: 0.9em; } .ppb-bk.ppb-sq2 { font-size: 0.8em; } .ppb-bk.ppb-sq3 { font-size: 0.7em; }
.ppb-measure { visibility: hidden !important; pointer-events: none !important; left: -200vw !important; }
.ppb-turn { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.ppb-turn.off { display: none; }
.ppb-backw { position: absolute; inset: 0; filter: drop-shadow(0.25em 0.2em 0.45em rgba(30, 18, 5, 0.35)); }
.ppb-lowfx .ppb-backw { filter: none; }
.ppb-ghost { position: absolute; inset: 0; transform: scaleX(-1); opacity: 0.07; filter: blur(0.4px); pointer-events: none; }
.ppb-gutter { position: absolute; top: 0; bottom: 0; width: 4%; margin-left: -2%; pointer-events: none; z-index: 4;
  background: linear-gradient(90deg, rgba(40,25,8,0) 0%, rgba(40,25,8,0.22) 42%, rgba(20,12,2,0.42) 50%, rgba(40,25,8,0.22) 58%, rgba(40,25,8,0) 100%); }
.ppb-single .ppb-gutter { display: none; }
/* while the cover is shut only the right half of the book exists */
.ppb-closed .ppb-board { clip-path: inset(-10% -10% -10% 50%); }
.ppb-closed.ppb-single .ppb-board { clip-path: none; }
.ppb-closed .ppb-edge.l, .ppb-closed .ppb-gutter { visibility: hidden; }
/* the cover */
.ppb-cover { position: absolute; top: -1.1%; height: 102.2%; transform-origin: 0 50%; transform-style: preserve-3d; z-index: 20; pointer-events: none; }
.ppb-cover > .f, .ppb-cover > .b { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 0.2em 0.9em 0.9em 0.2em; overflow: hidden; }
.ppb-cover > .b { transform: rotateY(180deg); border-radius: 0.9em 0.2em 0.2em 0.9em; }
.ppb-cover > .f { box-shadow: inset 0.5em 0 0.8em -0.3em rgba(0,0,0,0.5), inset 0 0 0 0.12em rgba(255,255,255,0.06), inset 0 0 2em rgba(0,0,0,0.35); }
.ppb-cover .ttl { position: absolute; left: 12%; right: 10%; top: 18%; text-align: center; }
.ppb-cover .ttl b { display: block; font-size: 2.1em; line-height: 0.95; letter-spacing: 0.04em; color: var(--foil, #e8c870);
  text-shadow: 0 -1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.55), 0 0 0.6em rgba(255, 220, 140, 0.18); }
.ppb-cover .ttl small { display: block; margin-top: 0.7em; font-size: 0.85em; letter-spacing: 0.3em; text-transform: uppercase; color: var(--foil, #e8c870); opacity: 0.8; }
.ppb-cover .frame { position: absolute; inset: 6% 7% 6% 9%; border: 0.14em solid var(--foil, #e8c870); opacity: 0.45; border-radius: 0.3em; box-shadow: inset 0 0 0 0.3em transparent, inset 0 0 0 0.38em rgba(232,200,112,0.5); }
.ppb-cover .emb { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); opacity: 0.85; }
.ppb-cover .lbl { position: absolute; left: 22%; right: 18%; top: 64%; padding: 0.5em 0.7em; text-align: center; font-size: 1.35em; transform: rotate(-2deg); color: var(--pp-ink); box-shadow: 0 0.15em 0.3em rgba(0,0,0,0.35); }
.ppb-cover .band { position: absolute; top: -2%; bottom: -2%; right: 13%; width: 0.7em; box-shadow: inset 0.15em 0 0.15em rgba(255,255,255,0.15), inset -0.15em 0 0.2em rgba(0,0,0,0.45), 0.2em 0 0.3em rgba(0,0,0,0.35); }
.ppb-cover .cnr { position: absolute; width: 11%; aspect-ratio: 1; background: linear-gradient(135deg, #d8c48a, #8a7238); opacity: 0.9; }
.ppb-cover .cnr.tr { right: 0; top: 0; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.ppb-cover .cnr.br { right: 0; bottom: 0; clip-path: polygon(100% 0, 100% 100%, 0 100%); }
/* tabs on the fore-edge */
.ppb-tabs { position: absolute; inset: 0; pointer-events: none; z-index: 8; }
.ppb-tab { position: absolute; width: 2.3em; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.3em; padding: 0.45em 0 0.5em; cursor: pointer; pointer-events: auto;
  color: #2a1e10; box-shadow: 0.12em 0.15em 0.25em rgba(0,0,0,0.35); transition: left 0.35s cubic-bezier(.3,1.3,.5,1), transform 0.15s; border-radius: 0 0.45em 0.45em 0; }
.ppb-tab.left { border-radius: 0.45em 0 0 0.45em; box-shadow: -0.12em 0.15em 0.25em rgba(0,0,0,0.35); }
.ppb-tab:hover { transform: translateX(0.25em); } .ppb-tab.left:hover { transform: translateX(-0.25em); }
.ppb-tab.on { filter: brightness(1.08); }
.ppb-tab { overflow: hidden; }
.ppb-tab img { width: 1.25em; height: 1.25em; image-rendering: pixelated; flex: none; }
.ppb-tab span { writing-mode: vertical-rl; font-size: 0.72em; letter-spacing: 0.04em; line-height: 1; white-space: nowrap; }
.ppb-tab.tight img { display: none; }
.ppb-tab .nw { position: absolute; top: -0.35em; right: -0.25em; width: 0.8em; height: 0.8em; border-radius: 50%; background: #c8321e; box-shadow: 0 0 0 0.12em #f8ecd0; }
/* ribbons */
.ppb-rib { position: absolute; width: 1.05em; z-index: 9; cursor: pointer; pointer-events: auto; transition: left 0.3s, height 0.3s;
  background: linear-gradient(90deg, rgba(0,0,0,0.25), rgba(255,255,255,0.18) 35%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.3)), var(--c);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 0.6em), 0 100%); box-shadow: 0 0.2em 0.3em rgba(0,0,0,0.3); }
.ppb-rib.lying { pointer-events: none; opacity: 0.92; }
/* arrows and the close mark */
.ppb-nav { position: absolute; bottom: 0.35em; height: 1.5em; width: 3.1em; cursor: pointer; pointer-events: auto; display: grid; place-items: center; opacity: 0.55; z-index: 7; transition: transform 0.15s, opacity 0.2s; }
.ppb-nav:hover { transform: scale(1.15); opacity: 0.95; }
.ppb-nav.off { opacity: 0; pointer-events: none; }
.ppb-nav svg { width: 100%; height: 100%; }
.ppb-x { position: absolute; top: -0.4em; width: 2.2em; height: 2.2em; cursor: pointer; pointer-events: auto; z-index: 12; transition: transform 0.15s; filter: drop-shadow(0 0.1em 0.12em rgba(0,0,0,0.4)); }
.ppb-x:hover { transform: rotate(-8deg) scale(1.08); }
.ppb-hint { position: absolute; left: 50%; bottom: -2.4em; transform: translateX(-50%); font-size: 1em; color: rgba(255, 244, 220, 0.75); white-space: nowrap; pointer-events: none; transition: opacity 0.5s; }
.ppb-pg [data-act], .ppb-pg a { cursor: pointer; }
`;

// ---------------------------------------------------------------- geometry

interface V2 { x: number; y: number }
function clipHalf(poly: V2[], M: V2, n: V2, sign: 1 | -1): V2[] {
  const out: V2[] = [];
  const sd = (p: V2) => ((p.x - M.x) * n.x + (p.y - M.y) * n.y) * sign;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = sd(a), sb = sd(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}
const polyCss = (p: V2[]) => (p.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${p.map(q => `${q.x.toFixed(2)}px ${q.y.toFixed(2)}px`).join(',')})`);
/** a linear-gradient over a w x h box with stops placed by distance (px) from a line through M with unit normal n */
function lineGrad(w: number, h: number, M: V2, n: V2, stops: [number, string][]): string {
  const ang = Math.atan2(n.x, -n.y);
  const L = Math.abs(w * Math.sin(ang)) + Math.abs(h * Math.cos(ang)) || 1;
  const p0 = 0.5 + ((M.x - w / 2) * n.x + (M.y - h / 2) * n.y) / L;
  return `linear-gradient(${((ang * 180) / Math.PI).toFixed(2)}deg, ${stops.map(([d, c]) => `${c} ${((p0 + d / L) * 100).toFixed(2)}%`).join(', ')})`;
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ---------------------------------------------------------------- the book

let styled = false;
let openCount = 0;
/** is any book open right now (other overlays use this to stay out of its way) */
export const bookOpen = () => openCount > 0;

interface Pos { s: number; p: number }

export function openBook(o: BookOpts): BookHandle {
  installPaper();
  if (!styled) { styled = true; const st = document.createElement('style'); st.dataset.ui = 'book'; st.textContent = CSS; document.head.appendChild(st); }
  let sections = o.sections.slice();
  let tabs = o.tabs ?? [];
  let ribbons = o.ribbons ?? [];
  const look = o.look;
  const paper: PaperKind = look.paper ?? 'journal';

  // ---- DOM
  const wrap = el('div', `ppb-wrap ${o.cls ?? ''}`);
  wrap.dataset.book = o.id;
  const dim = wrap.appendChild(el('div', 'ppb-dim'));
  const book = wrap.appendChild(el('div', 'ppb-book'));
  const board = book.appendChild(el('div', 'ppb-board'));
  const edgeL = book.appendChild(el('div', 'ppb-edge l'));
  const edgeR = book.appendChild(el('div', 'ppb-edge r'));
  const pagesEl = book.appendChild(el('div', 'ppb-pages'));
  const mkPage = (cls: string) => {
    const p = pagesEl.appendChild(el('div', `ppb-pg ${cls}`));
    p.innerHTML = '<div class="ppb-in"></div><div class="ppb-sh"></div>';
    return p;
  };
  const pgL = mkPage('l static'), pgR = mkPage('r static');
  const gutter = pagesEl.appendChild(el('div', 'ppb-gutter'));
  const turn = pagesEl.appendChild(el('div', 'ppb-turn off'));
  const tFront = turn.appendChild(el('div', 'ppb-pg'));
  tFront.innerHTML = '<div class="ppb-in"></div><div class="ppb-sh"></div>';
  turn.removeChild(tFront);
  const backW = turn.appendChild(el('div', 'ppb-backw'));
  turn.insertBefore(tFront, backW);
  const tBack = backW.appendChild(el('div', 'ppb-pg'));
  tBack.innerHTML = '<div class="ppb-in"></div><div class="ppb-sh"></div>';
  const measure = pagesEl.appendChild(el('div', 'ppb-pg r ppb-measure'));
  measure.innerHTML = '<div class="ppb-in"><div class="ppb-hd"></div><div class="ppb-ct"></div></div>';
  const tabsEl = book.appendChild(el('div', 'ppb-tabs'));
  const ribEl = book.appendChild(el('div', 'ppb-tabs'));
  const navPrev = book.appendChild(el('div', 'ppb-nav prev'));
  const navNext = book.appendChild(el('div', 'ppb-nav next'));
  const xBtn = book.appendChild(el('div', 'ppb-x'));
  const hint = book.appendChild(el('div', 'ppb-hint pp-hand'));
  const cover = book.appendChild(el('div', 'ppb-cover'));
  cover.innerHTML = '<div class="f"></div><div class="b"></div>';
  const coverF = cover.firstElementChild as HTMLElement, coverB = cover.lastElementChild as HTMLElement;
  [navPrev, navNext].forEach((n, i) => {
    const [s, h] = i === 0 ? roughArrow(92, 22, 10, 24, -0.12, { seed: 4 }) : roughArrow(8, 22, 90, 24, 0.12, { seed: 7 });
    n.innerHTML = svgInk(100, 44, [{ d: s, c: INK, w: 3.4 }, { d: h, c: INK, w: 3.4 }], { stretch: true });
    n.title = i === 0 ? 'Previous page (Left arrow)' : 'Next page (Right arrow)';
  });
  xBtn.innerHTML = svgInk(40, 40, [{ d: roughLine(10, 10, 30, 30, { seed: 3 }) + roughLine(30, 9, 9, 31, { seed: 5 }), c: '#f4e6c4', w: 3.4 }]);
  xBtn.title = 'Close (Esc)';
  if (matchMedia?.('(pointer: coarse)').matches) wrap.classList.add('ppb-lowfx');

  // ---- cover dress
  const mat = look.material ?? 'leather';
  const coverBg = `${coverTex(mat, look.color)} 0 0 / 256px 256px`;
  board.style.background = coverBg;
  board.style.backgroundColor = look.color;
  coverF.style.background = coverBg;
  coverF.style.setProperty('--foil', look.foil ?? '#e8c870');
  coverF.innerHTML = `<div class="frame"></div><div class="ttl pp-head"><b>${escHtml(look.title)}</b>${look.sub ? `<small>${escHtml(look.sub)}</small>` : ''}</div>${look.emblem ? `<div class="emb">${look.emblem}</div>` : ''}${look.label ? `<div class="lbl pp-hand" style="background:${paperTex('card')} 0 0 / 256px">${look.label}</div>` : ''}${look.band ? `<div class="band" style="background:${look.band}"></div>` : ''}${look.corners ? '<i class="cnr tr"></i><i class="cnr br"></i>' : ''}`;
  const insideBg = look.inside === 'endpaper' || !look.inside ? `${paperTex('endpaper')} 0 0 / 256px 256px` : paperBg(look.inside, 3, { edge: 0.4 });
  coverB.style.background = insideBg;

  // ---- geometry state
  let spread = true;
  let W = 400, H = 560;
  const spineX = () => (spread ? W : 0);
  const sizeKey = () => `${spread ? 's' : '1'}${Math.round(W)}x${Math.round(H)}`;

  function measureLayout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fs = parseFloat(getComputedStyle(game.ui.root).fontSize) || 15;
    const tabsW = tabs.length ? fs * 2.6 : 0;
    spread = vw >= 600 && vw / vh >= 1.08;
    if (spread) {
      const availW = vw - 32 - tabsW * 2, availH = vh - Math.max(56, fs * 4.6);
      H = Math.min(availH, 780);
      W = Math.min(availW / 2, H * (vh < 560 ? 0.98 : 0.8));
      H = Math.min(H, W / 0.62);
    } else {
      const availW = vw - 18 - tabsW, availH = vh - Math.max(84, fs * 6);
      W = Math.min(availW, 580);
      H = Math.min(availH, W * 1.62);
    }
    W = Math.max(180, Math.floor(W)); H = Math.max(240, Math.floor(H));
    const bw = spread ? W * 2 : W;
    book.style.width = bw + 'px';
    book.style.height = H + 'px';
    wrap.classList.toggle('ppb-single', !spread);
    // type scales with the page (handwriting needs a little more size than print to read well)
    book.style.fontSize = `${Math.max(14, Math.min(21, W / 22.5)).toFixed(2)}px`;
    board.style.inset = spread ? `-1.6% -1.4% -1.6% -1.4%` : `-1.4% -2.2% -1.4% -0.8%`;
    for (const p of [pgL, pgR, tFront, tBack, measure]) { p.style.width = W + 'px'; p.style.height = H + 'px'; }
    pgL.style.display = spread ? '' : 'none';
    pgL.style.transform = 'translate(0px,0px)';
    pgR.style.transform = `translate(${spineX()}px,0px)`;
    gutter.style.left = spineX() + 'px';
    cover.style.left = spineX() + 'px';
    cover.style.width = W * 1.012 + 'px';
    edgeL.style.display = spread ? '' : 'none';
    // arrows under the outer corners, the close mark on the top-right corner
    navPrev.style.left = spread ? '1.2%' : '3%';
    navNext.style.right = spread ? '1.2%' : '3%';
    xBtn.style.right = `${-(tabs.length ? 3.3 : 1.8)}em`;
  }

  // ---- layout: sections -> pages (cached per size)
  const cache = new Map<string, string[]>();
  const sectionPages = (si: number): string[] => {
    const sec = sections[si];
    if (!sec) return [];
    const key = sizeKey() + '|' + sec.id;
    let pg = cache.get(key);
    if (pg) return pg;
    pg = sec.pages ? sec.pages() : flow(sec);
    if (!pg.length) pg = [''];
    if (spread && (sec.startLeft ?? true) && pg.length % 2) pg = [...pg, BLANK];
    cache.set(key, pg);
    return pg;
  };
  const BLANK = '\u0000blank';
  function flow(sec: BookSection): string[] {
    const blocks = sec.blocks?.() ?? [];
    measure.className = `ppb-pg r ppb-measure ${sec.cls ?? ''}`;
    const ct = measure.querySelector('.ppb-ct') as HTMLElement;
    const hd = measure.querySelector('.ppb-hd') as HTMLElement;
    hd.textContent = sec.head?.r ?? sec.head?.l ?? '';
    const pages: string[][] = [];
    let cur: { html: string; keep: boolean }[] = [];
    ct.innerHTML = '';
    const over = () => ct.scrollHeight > ct.clientHeight + 1;
    const wrapB = (b: BookBlock, html = b.html, sq = 0) => `<div class="ppb-bk ${b.cls ?? ''}${sq ? ' ppb-sq' + sq : ''}">${html}</div>`;
    const push = (html: string) => { ct.insertAdjacentHTML('beforeend', html); };
    const pop = () => { ct.lastElementChild?.remove(); };
    const newPage = () => { pages.push(cur.map(c => c.html)); cur = []; ct.innerHTML = ''; };
    const place = (b: BookBlock, html: string): void => {
      if (b.brk && cur.length) newPage();
      const h = wrapB(b, html);
      push(h);
      if (!over()) { cur.push({ html: h, keep: !!b.keep }); return; }
      pop();
      // a splittable paragraph: fill the rest of this page sentence by sentence
      if (b.split) {
        const parts = html.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“‘(])/);
        if (parts.length > 1) {
          let k = 0;
          for (let n = 1; n < parts.length; n++) {
            push(wrapB(b, parts.slice(0, n).join(' ')));
            const ok = !over();
            pop();
            if (!ok) break;
            k = n;
          }
          if (k > 0) {
            const head = wrapB({ ...b }, parts.slice(0, k).join(' '));
            push(head);
            cur.push({ html: head, keep: false });
            newPage();
            place({ ...b, brk: false, cls: (b.cls ?? '') + ' cont' }, parts.slice(k).join(' '));
            return;
          }
        }
      }
      if (cur.length) {
        // carry any "keep with next" blocks (headings) over with it
        const carry: { html: string; keep: boolean }[] = [];
        while (cur.length && cur[cur.length - 1].keep) { carry.unshift(cur.pop()!); pop(); }
        if (cur.length) newPage(); else { cur = []; ct.innerHTML = ''; }
        for (const c of carry) { push(c.html); cur.push(c); }
        push(h);
        if (!over()) { cur.push({ html: h, keep: !!b.keep }); return; }
        pop();
        if (cur.length) { newPage(); }
      }
      // too tall for an empty page: squeeze it
      for (let sq = 1; sq <= 3; sq++) {
        const hs = wrapB(b, html, sq);
        push(hs);
        if (!over() || sq === 3) { cur.push({ html: hs, keep: false }); return; }
        pop();
      }
    };
    for (const b of blocks) place(b, b.html);
    if (cur.length || !pages.length) newPage();
    ct.innerHTML = '';
    return pages.map(p => p.join(''));
  }

  // ---- position
  let pos: Pos = { s: 0, p: 0 };
  const count = (si: number) => sectionPages(si).length;
  const step = () => (spread ? 2 : 1);
  const nextPos = (q: Pos): Pos | null => {
    if (q.p + step() < count(q.s)) return { s: q.s, p: q.p + step() };
    for (let s = q.s + 1; s < sections.length; s++) if (count(s)) return { s, p: 0 };
    return null;
  };
  const prevPos = (q: Pos): Pos | null => {
    if (q.p - step() >= 0) return { s: q.s, p: q.p - step() };
    for (let s = q.s - 1; s >= 0; s--) { const n = count(s); if (n) return { s, p: spread ? (n - 1) - ((n - 1) % 2) : n - 1 }; }
    return null;
  };
  const secIndex = (id: string) => sections.findIndex(s => s.id === id);

  // ---- rendering a page into an element
  const shownOnce = new Set<string>();
  function renderInto(pgEl: HTMLElement, q: Pos | null, idx: number, side: 'l' | 'r', reverseOf?: HTMLElement) {
    pgEl.classList.toggle('l', side === 'l');
    pgEl.classList.toggle('r', side === 'r');
    const inner = pgEl.firstElementChild as HTMLElement;
    const sh = pgEl.lastElementChild as HTMLElement;
    sh.style.background = '';
    if (reverseOf) {
      // the back of a sheet (single-page mode): plain paper with the front showing through faintly
      inner.innerHTML = `<div class="ppb-ghost">${(reverseOf.firstElementChild as HTMLElement).innerHTML}</div>`;
      inner.style.background = paperBg(paper, 8, { edge: 0.5, foxing: 0.2 });
      pgEl.dataset.k = '';
      return;
    }
    if (!q) { inner.innerHTML = ''; inner.style.background = 'none'; pgEl.dataset.k = ''; return; }
    const sec = sections[q.s];
    const pages = sectionPages(q.s);
    const html = pages[idx] ?? '';
    const seed = hashStr(sec.id) + idx * 7;
    inner.style.background = paperBg(sec.paper ?? paper, seed % 9, { stains: seed % 3 === 0 ? 1 : 0, foxing: 0.25 + (seed % 5) * 0.06, edge: 0.55 });
    pgEl.className = `ppb-pg ${side} ${pgEl.classList.contains('static') ? 'static ' : ''}${sec.cls ?? ''}`;
    const body = html === BLANK ? (o.blank?.(seed) ?? blankPage(seed)) : html;
    const head = spread ? (side === 'l' ? sec.head?.l : sec.head?.r) : [sec.head?.l, sec.head?.r].filter(Boolean).join(' · ');
    inner.innerHTML = `<div class="ppb-hd pp-pix">${head ? `<span>${escHtml(head)}</span>` : ''}</div><div class="ppb-ct">${body}</div>`;
    pgEl.dataset.k = `${sec.id}#${idx}`;
    fillSketches(inner);
  }
  function blankPage(seed: number): string {
    const names = doodleNames();
    const R = rng(seed);
    const d = names[Math.floor(R() * names.length)];
    return `<div style="position:absolute;left:${20 + R() * 40}%;top:${30 + R() * 30}%;transform:rotate(${(R() - 0.5) * 20}deg);opacity:0.5">${doodle(d, { size: '5em', pencil: true, seed })}</div>`;
  }
  const fireShown = (pgEl: HTMLElement) => {
    const k = pgEl.dataset.k;
    if (!k || shownOnce.has(k)) return;
    shownOnce.add(k);
    const [sid, i] = k.split('#');
    const sec = sections.find(s => s.id === sid);
    try { sec?.shown?.(pgEl, +i, handle); } catch (e) { console.error(e); }
  };

  /** draw the spread (or page) at pos */
  function show() {
    if (spread) {
      renderInto(pgL, pos, pos.p, 'l');
      renderInto(pgR, pos, pos.p + 1, 'r');
      fireShown(pgL); fireShown(pgR);
    } else {
      renderInto(pgR, pos, pos.p, 'r');
      fireShown(pgR);
    }
    pgL.classList.remove('hidden'); pgR.classList.remove('hidden');
    updateChrome();
  }

  // ---- tabs, ribbons, arrows
  function updateChrome() {
    const curS = pos.s;
    tabsEl.innerHTML = '';
    if (tabs.length) {
      const n = tabs.length;
      const top = H * 0.08, span = H * 0.84, th = Math.min(span / n - 4, H * 0.16);
      tabs.forEach((t, i) => {
        const si = secIndex(t.section);
        // a tab is glued to its section's first page: once that page is turned it sits on the left
        const left = spread && si >= 0 && si <= curS;
        const e = el('div', `ppb-tab pp-pix${left ? ' left' : ''}${tabOf(sections[curS]) === t.id ? ' on' : ''}${th < parseFloat(book.style.fontSize) * (1.9 + t.label.length * 0.62) ? ' tight' : ''}`);
        e.style.background = `${paperTex('card')} 0 0 / 256px, ${t.color}`;
        e.style.backgroundBlendMode = 'multiply';
        e.style.top = `${top + i * (span / n)}px`;
        e.style.height = `${th}px`;
        e.style.left = left ? `-2.3em` : `${spread ? W * 2 : W}px`;
        e.innerHTML = `${t.icon ? `<img src="${t.icon}" alt="">` : ''}<span>${escHtml(t.label)}</span>`;
        e.title = t.label;
        e.addEventListener('click', ev => { ev.stopPropagation(); paperSfx('slide', 0.5); void handle.goto(t.section); });
        tabsEl.appendChild(e);
      });
    }
    ribEl.innerHTML = '';
    for (const r of ribbons) {
      const si = secIndex(r.section);
      if (si < 0) continue;
      const here = si === curS;
      const e = el('div', 'ppb-rib' + (here ? ' lying' : ''));
      e.style.setProperty('--c', r.color);
      if (here) {
        // lying down the gutter of the open page
        e.style.left = `${spread ? W - (0.6 * parseFloat(book.style.fontSize)) - 22 : W * 0.06}px`;
        e.style.top = '-0.4em';
        e.style.height = `${H * 0.42}px`;
      } else {
        const before = si < curS;
        e.style.left = `${spread ? (before ? W * 0.22 : W * 1.7) : (before ? W * 0.1 : W * 0.75)}px`;
        e.style.top = `${H - 2}px`;
        e.style.height = '2.6em';
        e.title = r.label ?? 'Bookmark';
        e.addEventListener('click', ev => { ev.stopPropagation(); void handle.goto(r.section); });
      }
      ribEl.appendChild(e);
    }
    navPrev.classList.toggle('off', !prevPos(pos));
    navNext.classList.toggle('off', !nextPos(pos));
  }
  const tabOf = (s?: BookSection) => s?.tab ?? '';

  // ---- the page turn
  interface TurnSt {
    side: 1 | -1;
    /** corner y in sheet coords: 0 (top) or H (bottom) */
    hc: number;
    /** the page box of the turning sheet (book coords, left edge) */
    box: number;
    P: V2;
    target: Pos;
    /** single mode, going back: the sheet comes back from the left */
    back: boolean;
  }
  let T: TurnSt | null = null;
  let busy = false;

  const toLocalFront = (s: TurnSt, p: V2): V2 => ({ x: s.side > 0 ? p.x : W - p.x, y: p.y });
  const toLocalBack = (s: TurnSt, p: V2): V2 => ({ x: s.side > 0 ? W - p.x : p.x, y: p.y });
  const dirLocalFront = (s: TurnSt, n: V2): V2 => ({ x: s.side > 0 ? n.x : -n.x, y: n.y });
  const dirLocalBack = (s: TurnSt, n: V2): V2 => ({ x: s.side > 0 ? -n.x : n.x, y: n.y });

  /** set up the turning sheet for a move from pos to `to` (in direction dir) */
  function beginTurn(dir: 1 | -1, to: Pos, hc: number): TurnSt {
    const s: TurnSt = { side: 1, hc, box: spineX(), P: { x: W, y: hc }, target: to, back: false };
    if (spread) {
      if (dir > 0) {
        // the right page turns over to the left: front = current right, back = next left, under = next right
        s.side = 1; s.box = W;
        renderInto(tFront, pos, pos.p + 1, 'r');
        renderInto(tBack, to, to.p, 'l');
        renderInto(pgR, to, to.p + 1, 'r');
      } else {
        // the left page turns back to the right: front = current left, back = previous right, under = previous left
        s.side = -1; s.box = 0;
        renderInto(tFront, pos, pos.p, 'l');
        renderInto(tBack, to, to.p + 1, 'r');
        renderInto(pgL, to, to.p, 'l');
      }
    } else if (dir > 0) {
      s.side = 1; s.box = 0;
      renderInto(tFront, pos, pos.p, 'r');
      renderInto(tBack, null, 0, 'l', tFront);
      renderInto(pgR, to, to.p, 'r');
    } else {
      // single page, going back: the previous sheet swings back in from the left (a forward turn played backwards)
      s.side = 1; s.box = 0; s.back = true;
      renderInto(tFront, to, to.p, 'r');
      renderInto(tBack, null, 0, 'l', tFront);
      s.P = { x: -W, y: hc };
    }
    tFront.style.transform = `translate(${s.box}px,0px)`;
    turn.classList.remove('off');
    T = s;
    applyTurn();
    return s;
  }

  /** draw the current fold */
  function applyTurn() {
    const s = T;
    if (!s) return;
    const C0: V2 = { x: W, y: s.hc };
    let P = s.P;
    // the sheet stays bound at the spine: the corner can't leave a circle of radius W round the spine
    // point at its own height, nor get further than the diagonal from the opposite spine corner
    const B: V2 = { x: 0, y: s.hc }, Tc: V2 = { x: 0, y: H - s.hc };
    const dB = Math.hypot(P.x - B.x, P.y - B.y);
    if (dB > W) P = { x: B.x + ((P.x - B.x) * W) / dB, y: B.y + ((P.y - B.y) * W) / dB };
    const D = Math.hypot(W, H), dT = Math.hypot(P.x - Tc.x, P.y - Tc.y);
    if (dT > D) P = { x: Tc.x + ((P.x - Tc.x) * D) / dT, y: Tc.y + ((P.y - Tc.y) * D) / dT };
    s.P = P;
    const dx = P.x - C0.x, dy = P.y - C0.y, dl = Math.hypot(dx, dy);
    const fsh = tFront.lastElementChild as HTMLElement, bsh = tBack.lastElementChild as HTMLElement;
    const under = spread ? (s.side > 0 ? pgR : pgL) : pgR;
    const ush = under.lastElementChild as HTMLElement;
    if (dl < 0.5) {
      tFront.style.clipPath = 'none';
      tBack.style.visibility = 'hidden';
      fsh.style.background = ''; ush.style.background = '';
      return;
    }
    tBack.style.visibility = '';
    const n: V2 = { x: dx / dl, y: dy / dl };
    const M: V2 = { x: (C0.x + P.x) / 2, y: (C0.y + P.y) / 2 };
    const rect: V2[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    const remain = clipHalf(rect, M, n, 1);
    const flap = clipHalf(rect, M, n, -1);
    // front: what is left of the page
    tFront.style.clipPath = polyCss(remain.map(p => toLocalFront(s, p)));
    // back: the flap, reflected over the fold (a mirror of the reverse side = a rigid motion)
    const a = s.side > 0 ? -1 : 1, b = s.side > 0 ? W : 0;
    const q11 = 1 - 2 * n.x * n.x, q12 = -2 * n.x * n.y, q22 = 1 - 2 * n.y * n.y;
    const mn = M.x * n.x + M.y * n.y;
    const r0x = 2 * mn * n.x, r0y = 2 * mn * n.y;
    // sheet S = (a u + b, v); R(S) = Q S + r0; book = (spine + side * R.x, R.y)
    const m11 = s.side * q11 * a, m12 = s.side * q12, m21 = q12 * a, m22 = q22;
    const tx = spineX() + s.side * (q11 * b + r0x), ty = q12 * b + r0y;
    tBack.style.transform = `matrix(${m11.toFixed(5)},${m21.toFixed(5)},${m12.toFixed(5)},${m22.toFixed(5)},${tx.toFixed(2)},${ty.toFixed(2)})`;
    tBack.style.clipPath = polyCss(flap.map(p => toLocalBack(s, p)));
    // shading: the front darkens as it lifts toward the fold, the flap has a bright curl then a
    // soft shadow, the page underneath gets the shadow of the lifted flap along the fold
    const k = Math.min(1, dl / (W * 0.5));
    const wf = W * (0.08 + 0.14 * k);
    fsh.style.background = lineGrad(W, H, toLocalFront(s, M), dirLocalFront(s, n), [[0, `rgba(40,24,6,${(0.1 + 0.18 * k).toFixed(3)})`], [wf, 'rgba(40,24,6,0)']]);
    const nb = dirLocalBack(s, n), Mb = toLocalBack(s, M);
    const nIn: V2 = { x: -nb.x, y: -nb.y };
    bsh.style.background = lineGrad(W, H, Mb, nIn, [[0, `rgba(30,18,4,${(0.25 + 0.15 * k).toFixed(3)})`], [W * 0.025, 'rgba(255,250,235,0.35)'], [W * 0.09, 'rgba(255,250,235,0.08)'], [W * 0.3, `rgba(40,24,6,${(0.06 + 0.06 * k).toFixed(3)})`], [W * 0.9, 'rgba(40,24,6,0)']]);
    const uM = toLocalFront(s, M), un = dirLocalFront(s, n);
    ush.style.background = lineGrad(W, H, uM, { x: -un.x, y: -un.y }, [[-1, 'rgba(20,12,2,0)'], [0, `rgba(20,12,2,${(0.42 * (0.4 + 0.6 * k)).toFixed(3)})`], [W * (0.05 + 0.1 * k), 'rgba(20,12,2,0)']]);
  }

  function endTurn(done: boolean) {
    const s = T;
    T = null;
    turn.classList.add('off');
    for (const p of [pgL, pgR, tFront, tBack]) (p.lastElementChild as HTMLElement).style.background = '';
    if (!s) return;
    if (done) pos = s.target;
    show();
  }

  /** animate the corner from where it is to the far side (done) or back home (cancel) */
  function animateTo(done: boolean, dur = 520): Promise<void> {
    const s = T;
    if (!s) return Promise.resolve();
    const from = { ...s.P };
    // in single mode going back, "done" means the sheet lands flat on the page (C0)
    const toFlat = s.back ? done : !done;
    const to: V2 = toFlat ? { x: W, y: s.hc } : { x: -W, y: s.hc };
    const lift = (s.hc > H / 2 ? -1 : 1) * H * 0.1;
    const d0 = reduced() ? 1 : dur;
    return new Promise(res => {
      const t0 = performance.now();
      const stepF = () => {
        if (T !== s) { res(); return; }
        const t = Math.min(1, (performance.now() - t0) / d0);
        const e = ease(t);
        s.P = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + lift * Math.sin(Math.PI * e) * (Math.abs(to.x - from.x) / (2 * W)) };
        applyTurn();
        if (t < 1) requestAnimationFrame(stepF);
        else { endTurn(done); res(); }
      };
      requestAnimationFrame(stepF);
    });
  }

  async function turnTo(dir: 1 | -1, to: Pos, o: { fast?: boolean; hc?: number } = {}) {
    if (busy || !to) return;
    busy = true;
    try {
      if (T) endTurn(false);
      beginTurn(dir, to, o.hc ?? H);
      paperSfx('flip', o.fast ? 0.7 : 1);
      await animateTo(true, o.fast ? 300 : 560);
    } finally { busy = false; }
  }

  // ---- pointer: hover peel, drag to turn, click the edge to turn
  interface Drag { id: number; dir: 1 | -1; x0: number; y0: number; p0: V2; moved: boolean; vx: number; lx: number; lt: number; started: boolean; to: Pos }
  let drag: Drag | null = null;
  let peel: { dir: 1 | -1; hc: number } | null = null;
  const bookXY = (e: PointerEvent): V2 => { const r = pagesEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  /** which turn a point on the pages would start: dir and whether it's in the corner / edge zone */
  const zoneAt = (p: V2): { dir: 1 | -1; edge: boolean; corner: boolean; hc: number } | null => {
    if (p.y < 0 || p.y > H) return null;
    const hc = p.y < H * 0.5 ? 0 : H;
    const cornerY = p.y < H * 0.17 || p.y > H * 0.83;
    if (spread) {
      if (p.x > W && p.x <= W * 2) { const edge = p.x > W * 2 - W * 0.16; return { dir: 1, edge, corner: edge && cornerY, hc }; }
      if (p.x >= 0 && p.x < W) { const edge = p.x < W * 0.16; return { dir: -1, edge, corner: edge && cornerY, hc }; }
      return null;
    }
    if (p.x < 0 || p.x > W) return null;
    if (p.x > W * 0.8) return { dir: 1, edge: true, corner: cornerY, hc };
    if (p.x < W * 0.14) return { dir: -1, edge: true, corner: cornerY, hc };
    return null;
  };
  const toSheet = (p: V2, side: 1 | -1): V2 => ({ x: (p.x - spineX()) * side, y: p.y });

  pagesEl.addEventListener('pointerdown', e => {
    if (busy || drag || closing || !opened) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-act], a, button, input, .ppb-noturn')) return;
    const p = bookXY(e);
    const z = zoneAt(p);
    if (!z || !z.edge) return;
    const to = z.dir > 0 ? nextPos(pos) : prevPos(pos);
    if (!to) return;
    e.preventDefault();
    try { pagesEl.setPointerCapture(e.pointerId); } catch { /* */ }
    drag = { id: e.pointerId, dir: z.dir, x0: p.x, y0: p.y, p0: { x: 0, y: 0 }, moved: false, vx: 0, lx: p.x, lt: performance.now(), started: false, to };
    // continue from a hover peel if there is one
    if (!(T && peel && peel.dir === z.dir)) { if (T) endTurn(false); beginTurn(z.dir, to, z.hc); }
    peel = null;
    drag.p0 = { ...T!.P };
  });
  pagesEl.addEventListener('pointermove', e => {
    const p = bookXY(e);
    if (drag && e.pointerId === drag.id) {
      const s = T;
      if (!s) return;
      const dxp = p.x - drag.x0, dyp = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dxp, dyp) > 6) { drag.moved = true; paperSfx('slide', 0.5); }
      const now = performance.now();
      drag.vx = (p.x - drag.lx) / Math.max(1, now - drag.lt);
      drag.lx = p.x; drag.lt = now;
      // the corner follows the finger (in sheet coords; single-mode back-turns move faster)
      const k = s.back ? 2 : 1;
      const sp = toSheet({ x: drag.x0 + dxp * k, y: drag.y0 + dyp }, s.side);
      const sp0 = toSheet({ x: drag.x0, y: drag.y0 }, s.side);
      s.P = { x: drag.p0.x + (sp.x - sp0.x), y: drag.p0.y + (sp.y - sp0.y) };
      applyTurn();
      return;
    }
    if (e.buttons || busy || closing || !opened || reduced()) return;
    // hover: peel the corner a little to invite a turn
    const z = zoneAt(p);
    const want = z && z.corner ? { dir: z.dir, hc: z.hc } : null;
    if (want && !(want.dir > 0 ? nextPos(pos) : prevPos(pos))) return;
    if (want && (!peel || peel.dir !== want.dir || peel.hc !== want.hc)) {
      if (T) endTurn(false);
      const to = want.dir > 0 ? nextPos(pos)! : prevPos(pos)!;
      const s = beginTurn(want.dir, to, want.hc);
      peel = want;
      const goal: V2 = s.back ? { x: -W * 0.9, y: want.hc } : { x: W - W * 0.09, y: want.hc + (want.hc > 0 ? -W * 0.07 : W * 0.07) };
      void tweenP(goal, 180);
    } else if (!want && peel) {
      peel = null;
      void tweenP(T?.back ? { x: -W, y: T.hc } : { x: W, y: T?.hc ?? H }, 160).then(() => { if (!peel && T && !drag) endTurn(false); });
    }
  });
  const tweenP = (to: V2, ms: number) => new Promise<void>(res => {
    const s = T;
    if (!s) { res(); return; }
    const from = { ...s.P }, t0 = performance.now();
    const f = () => {
      if (T !== s || drag) { res(); return; }
      const t = Math.min(1, (performance.now() - t0) / ms), e = easeOut(t);
      s.P = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      applyTurn();
      if (t < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    const s = T;
    if (!s) return;
    if (!d.moved) {
      // a click on the edge: turn the page
      busy = true;
      paperSfx('flip');
      void animateTo(true, 540).then(() => { busy = false; });
      return;
    }
    // released: past the middle (or flicked) completes the turn
    const fl = d.vx * (d.dir > 0 ? -1 : 1) * (spread ? 1 : 1);
    const prog = s.back ? (s.P.x + W) / (2 * W) : (W - s.P.x) / (2 * W);
    const done = prog > 0.42 || fl > 0.45;
    busy = true;
    if (done) paperSfx('flip', 0.8);
    void animateTo(done, 320).then(() => { busy = false; });
  };
  pagesEl.addEventListener('pointerup', endDrag);
  pagesEl.addEventListener('pointercancel', endDrag);
  pagesEl.addEventListener('pointerleave', () => {
    if (peel && !drag) { peel = null; void tweenP(T?.back ? { x: -W, y: T.hc } : { x: W, y: T?.hc ?? H }, 160).then(() => { if (!peel && T && !drag) endTurn(false); }); }
  });
  // content clicks (data-act)
  pagesEl.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || !pagesEl.contains(a)) return;
    e.stopPropagation();
    const act = a.dataset.act!;
    if (o.onAct?.(act, a, handle, e)) return;
    if (act === 'goto' && a.dataset.k) void handle.goto(a.dataset.k);
    else if (act === 'next') void handle.next();
    else if (act === 'prev') void handle.prev();
    else if (act === 'close') void handle.close();
  });
  navPrev.addEventListener('click', e => { e.stopPropagation(); void handle.prev(); });
  navNext.addEventListener('click', e => { e.stopPropagation(); void handle.next(); });
  xBtn.addEventListener('click', e => { e.stopPropagation(); void handle.close(); });
  dim.addEventListener('pointerdown', e => { if (e.target === dim && opened) void handle.close(); });
  // a swipe anywhere on the page (not just the edge) on touch screens turns too
  let sw: { id: number; x: number; y: number; t: number } | null = null;
  pagesEl.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !drag) sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
  pagesEl.addEventListener('pointerup', e => {
    const s0 = sw; sw = null;
    if (!s0 || s0.id !== e.pointerId || drag || busy) return;
    const dx = e.clientX - s0.x, dy = e.clientY - s0.y, dt = performance.now() - s0.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 600) void (dx < 0 ? handle.next() : handle.prev());
  }, true);

  // ---- keys
  const popKeys = pushKeys(e => {
    if (!opened || closing) return true;
    if (o.onKey?.(e, handle)) return true;
    const c = e.code;
    if (c === 'Escape' || (o.key && c === o.key) || c === 'Tab') { void handle.close(); return true; }
    if (c === 'ArrowRight' || c === 'KeyD' || c === 'PageDown') { void handle.next(); return true; }
    if (c === 'ArrowLeft' || c === 'KeyA' || c === 'PageUp') { void handle.prev(); return true; }
    if (c === 'Home') { void handle.goto(sections[0]?.id ?? ''); return true; }
    const dg = /^Digit([1-9])$/.exec(c);
    if (dg && tabs[+dg[1] - 1]) { void handle.goto(tabs[+dg[1] - 1].section); return true; }
    return true;
  });

  // ---- resize
  const onResize = () => {
    if (!opened || closing) return;
    if (T) endTurn(false);
    const cur = sections[pos.s]?.id;
    measureLayout();
    cache.clear();
    const si = Math.max(0, secIndex(cur ?? ''));
    const n = count(si);
    pos = { s: si, p: Math.min(spread ? pos.p - (pos.p % 2) : pos.p, Math.max(0, spread ? n - 1 - ((n - 1) % 2) : n - 1)) };
    show();
  };
  window.addEventListener('resize', onResize);

  // ---- open / close
  let opened = false, closing = false, closedRes: () => void = () => {};
  const closed = new Promise<void>(r => (closedRes = r));
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  // the book covers the screen: freeze the world behind it (one still frame) so the pages get the GPU
  game.covered++;
  openCount++;

  /** the cover's inside shows the left page we open onto (or close from), so it lands seamlessly */
  const dressCoverInside = () => {
    coverB.innerHTML = '';
    coverB.style.background = insideBg;
    if (!spread) return;
    const clone = pgL.firstElementChild!.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute'; clone.style.inset = '0'; clone.style.width = '98.8%';
    coverB.appendChild(clone);
  };

  async function doOpen() {
    measureLayout();
    await handReady();
    const si = Math.max(0, o.start ? secIndex(o.start) : 0);
    pos = { s: si, p: 0 };
    show();
    dressCoverInside();
    const R = reduced();
    const closedX = spread ? -W / 2 : 0;
    wrap.classList.add('ppb-closed');
    pgL.classList.toggle('hidden', spread);
    tabsEl.style.opacity = '0'; ribEl.style.opacity = '0';
    [navPrev, navNext, xBtn, hint].forEach(x => (x.style.opacity = '0'));
    book.style.transition = 'none';
    book.style.transform = `translate(${closedX}px, ${window.innerHeight * 0.75}px) rotate(-7deg) scale(0.92)`;
    cover.style.transition = 'none';
    cover.style.transform = 'rotateY(0deg)';
    requestAnimationFrame(() => wrap.classList.add('on'));
    paperSfx('slide', 0.8);
    await wait(30);
    book.style.transition = R ? 'none' : 'transform 0.5s cubic-bezier(.2,1.25,.4,1)';
    book.style.transform = `translate(${closedX}px, 0px) rotate(-1.5deg) scale(1)`;
    await wait(R ? 0 : 470);
    paperSfx('open');
    cover.style.transition = R ? 'none' : 'transform 0.75s cubic-bezier(.45,.05,.3,1)';
    book.style.transition = R ? 'none' : 'transform 0.75s cubic-bezier(.45,.05,.3,1)';
    cover.style.transform = 'rotateY(-180deg)';
    book.style.transform = 'translate(0px, 0px) rotate(0deg) scale(1)';
    await wait(R ? 0 : 400);
    if (spread) pgL.classList.remove('hidden');
    wrap.classList.remove('ppb-closed');
    await wait(R ? 0 : 360);
    cover.style.display = 'none';
    tabsEl.style.transition = ribEl.style.transition = 'opacity 0.3s';
    tabsEl.style.opacity = '1'; ribEl.style.opacity = '1';
    [navPrev, navNext, xBtn, hint].forEach(x => { x.style.transition = 'opacity 0.3s, transform 0.15s'; x.style.opacity = ''; });
    hint.textContent = spread ? 'drag a page corner, or use the arrow keys' : 'swipe or drag the page edge';
    setTimeout(() => { hint.style.opacity = '0'; }, 3600);
    book.style.transition = 'none';
    opened = true;
  }
  void doOpen();

  async function doClose() {
    if (closing) return;
    closing = true;
    if (T) endTurn(false);
    const R = reduced();
    tabsEl.style.opacity = '0'; ribEl.style.opacity = '0';
    [navPrev, navNext, xBtn, hint].forEach(x => (x.style.opacity = '0'));
    dressCoverInside();
    cover.style.display = '';
    cover.style.transition = 'none';
    cover.style.transform = 'rotateY(-180deg)';
    await wait(20);
    if (spread) pgL.classList.add('hidden');
    wrap.classList.add('ppb-closed');
    paperSfx('close');
    cover.style.transition = R ? 'none' : 'transform 0.55s cubic-bezier(.5,0,.6,1)';
    book.style.transition = R ? 'none' : 'transform 0.55s cubic-bezier(.5,0,.6,1)';
    cover.style.transform = 'rotateY(0deg)';
    book.style.transform = `translate(${spread ? -W / 2 : 0}px, 0px) rotate(-1deg)`;
    await wait(R ? 0 : 560);
    book.style.transition = R ? 'none' : 'transform 0.42s cubic-bezier(.6,-0.2,.7,.4)';
    book.style.transform = `translate(${spread ? -W / 2 : 0}px, ${window.innerHeight * 0.85}px) rotate(6deg) scale(0.92)`;
    wrap.classList.remove('on');
    await wait(R ? 0 : 420);
    popKeys();
    window.removeEventListener('resize', onResize);
    wrap.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    game.covered = Math.max(0, game.covered - 1);
    openCount = Math.max(0, openCount - 1);
    guardInput(300);
    try { o.onClose?.(); } catch (e) { console.error(e); }
    closedRes();
  }

  const handle: BookHandle = {
    root: wrap,
    closed,
    async goto(id, go = {}) {
      const si = secIndex(id);
      if (si < 0) return;
      let p = Math.max(0, go.page ?? 0);
      const n = count(si);
      p = Math.min(p, n - 1);
      if (spread) p -= p % 2;
      const to: Pos = { s: si, p };
      if (to.s === pos.s && to.p === pos.p) return;
      if (go.instant || !opened) { if (T) endTurn(false); pos = to; show(); return; }
      const dir: 1 | -1 = to.s > pos.s || (to.s === pos.s && to.p > pos.p) ? 1 : -1;
      // a jump over several pages riffles through them
      const far = Math.abs(to.s - pos.s) > 1 || Math.abs(to.p - pos.p) > step();
      if (far) paperSfx('riffle');
      await turnTo(dir, to, { fast: far });
    },
    async next() { const to = nextPos(pos); if (to) await turnTo(1, to); },
    async prev() { const to = prevPos(pos); if (to) await turnTo(-1, to); },
    refresh(id) {
      if (id) { for (const k of [...cache.keys()]) if (k.endsWith('|' + id)) cache.delete(k); } else cache.clear();
      if (T) endTurn(false);
      const n = count(pos.s);
      if (pos.p >= n) pos = { s: pos.s, p: Math.max(0, spread ? n - 1 - ((n - 1) % 2) : n - 1) };
      if (opened) show();
    },
    setSections(s, t, r) {
      const cur = sections[pos.s]?.id;
      sections = s.slice();
      if (t) tabs = t;
      if (r) ribbons = r;
      cache.clear();
      const si = Math.max(0, secIndex(cur ?? ''));
      pos = { s: si, p: Math.min(pos.p, Math.max(0, count(si) - 1)) };
      if (spread) pos.p -= pos.p % 2;
      if (T) endTurn(false);
      if (opened) show();
    },
    close: doClose,
    current: () => ({ section: sections[pos.s]?.id ?? '', page: pos.p }),
    visiblePages: () => (spread ? [pgL, pgR] : [pgR]),
    isOpen: () => opened && !closing,
  };
  return handle;
}

export { INK, PENCIL };
