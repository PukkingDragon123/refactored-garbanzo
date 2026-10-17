// Physical UI kit: a real book, as pixel art. Painted boards (pebbled leather or cloth, an embossed
// foil frame, metal corners, the elastic band, a paper label), a cover that swings open frame by
// frame (squashed in whole columns, never smoothly resampled), pages laid out like print (content
// flows from page to page, sentences split across the turn) and a page turn that folds along a
// vertical line: the sheet's front is clipped, its back slides in as a pure translation, so every
// edge stays on the pixel grid, and the curl's highlight and shadows are dithered bands on a
// low-resolution canvas.
//
// Two-page spreads on wide screens, one page at a time on phones in portrait. Turn by dragging a
// page edge, clicking the outer edge, the drawn arrows, the arrow keys / A D / Page Up Down, or by
// touching the tabs on the fore-edge (they move to the left side as you pass them, like a real thumb
// index). Ribbons mark pages. Esc (or the key that opened the book) closes it: the cover swings shut
// and the book slides away.
//
// See index.ts for the API overview.

import { game } from '../../../game/game';
import { guardInput } from '../../../core/input';
import { pushKeys } from '../../laptop-kit';
import { el } from '../../ui';
import { installPaper, handReady } from './css';
import { paperBg, paperTex, coverArtOf, paperTileArt, ditherBg } from './textures';
import type { PaperKind } from './textures';
import { fillSketches, doodle, doodleNames } from './sketch';
import { svgInk, roughArrow, roughLine, INK, PENCIL } from './ink';
import { paperSfx } from './sound';
import { hashStr, rng } from './rng';
import { escHtml } from './decor';
import { Art, PX, col, dith, shadeC, mixC, spriteURL, pxCanvas, bayer } from './px';
import { drawText, textWidth, wrapText } from './pxfont';

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
  /** a name for the page this block lands on: goto(anchor) and ribbons can point at it */
  anchor?: string;
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
  /** an elastic band round the cover (field notebooks): any CSS colour (gradients use their first colour) */
  band?: string;
  /** html stamped / stuck on the cover (doodles, stickers) */
  emblem?: string;
  /** a paper label on the cover, handwritten (html: <br> breaks lines, other tags are dropped) */
  label?: string;
  /** the inside of the cover */
  inside?: 'endpaper' | PaperKind;
  /** the page paper */
  paper?: PaperKind;
  /** corner protectors */
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

// ---------------------------------------------------------------- pixel pieces

/** a vertical strip of dithered shade, darkest at `from` ('l' or 'r') */
const shadeStrip = (from: 'l' | 'r', w: number, k: number) => spriteURL(`gut:${from}:${w}:${k}`, w, 4, a => {
  const c = col('#28180a', 0.5);
  for (let x = 0; x < w; x++) {
    const d = from === 'l' ? x : w - 1 - x;
    const cov = k * Math.pow(1 - d / w, 1.6);
    for (let y = 0; y < 4; y++) if (dith(x, y, cov)) a.put(x, y, c);
  }
});
/** the fore-edge: a stack of page edges */
const pageEdgeURL = () => spriteURL('pagesEdge', 4, 2, a => {
  const cs = ['#efe4c6', '#d8c8a0', '#f4ead0', '#c8b48a'].map(c => col(c));
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) a.put(x, y, cs[x]);
});
/** the close button: a dark leather patch with a cream X */
const closeURL = () => spriteURL('bookX', 13, 13, a => {
  const out = col('#1a0e06'), lea = col('#5a3a1e'), lt = col('#7a5028'), x = col('#f4e6c4');
  a.rect(1, 0, 11, 13, out); a.rect(0, 1, 13, 11, out);
  a.rect(1, 1, 11, 11, lea); a.rect(2, 1, 9, 1, lt); a.rect(1, 2, 1, 9, lt);
  for (let i = 0; i < 7; i++) { a.put(3 + i, 3 + i, x); a.put(9 - i, 3 + i, x); a.put(4 + i, 3 + i, shadeC(x, -0.2)); }
});
/** a little red "new" dot */
const dotURL = () => spriteURL('newDot', 7, 7, a => { a.ellipse(3.5, 3.5, 3.5, 3.5, col('#f8ecd0')); a.ellipse(3.5, 3.5, 2.6, 2.6, col('#c8321e')); a.put(2, 2, col('#f08a6a')); });

/** paint a book board / cover in its material, with a bevel and stepped corners */
function paintBoard(a: Art, look: BookLook, o: { front: boolean; spine?: boolean }) {
  const W = a.w, H = a.h;
  const tile = coverArtOf(look.material ?? 'leather', look.color);
  const base = col(look.color);
  const out = shadeC(base, -0.62), lt = shadeC(base, 0.2), dk = shadeC(base, -0.35);
  const R = 3;
  const inside = (x: number, y: number) => {
    const cx = x < R ? R - x : x >= W - R ? x - (W - 1 - R) : 0, cy = y < R ? R - y : y >= H - R ? y - (H - 1 - R) : 0;
    return cx * cx + cy * cy <= R * R + 1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c = tile.d[(y % 128) * 128 + (x % 128)];
    if (edge) c = out;
    else if (!inside(x - 2, y) || !inside(x, y - 2)) c = mixC(c, lt, 0.55);
    else if (!inside(x + 2, y) || !inside(x, y + 2)) c = mixC(c, dk, 0.55);
    a.put(x, y, c);
  }
  if (!o.front) return;
  const foil = col(look.foil ?? '#e8c870'), foilD = shadeC(foil, -0.45), foilL = shadeC(foil, 0.35);
  // the hinge groove near the spine
  const hx = Math.max(4, Math.round(W * 0.06));
  for (let y = 2; y < H - 2; y++) { a.px(hx, y, dk); a.px(hx + 1, y, mixC(tile.d[(y % 128) * 128 + ((hx + 1) % 128)], lt, 0.5)); }
  // the embossed foil frame (double line)
  const fx0 = Math.round(W * 0.13), fx1 = W - Math.round(W * 0.08), fy0 = Math.round(H * 0.055), fy1 = H - Math.round(H * 0.055);
  const frame = (i: number, c: number) => { a.rect(fx0 + i, fy0 + i, fx1 - fx0 - i * 2, 1, c); a.rect(fx0 + i, fy1 - 1 - i, fx1 - fx0 - i * 2, 1, c); a.rect(fx0 + i, fy0 + i, 1, fy1 - fy0 - i * 2, c); a.rect(fx1 - 1 - i, fy0 + i, 1, fy1 - fy0 - i * 2, c); };
  frame(1, foilD); frame(0, foil); frame(4, foilD); frame(3, mixC(foil, base, 0.35));
  for (const [x, y] of [[fx0 + 3, fy0 + 3], [fx1 - 4, fy0 + 3], [fx0 + 3, fy1 - 4], [fx1 - 4, fy1 - 4]]) { a.rect(x - 1, y - 1, 3, 3, foil); a.put(x, y, foilL); }
  // corner protectors
  if (look.corners) {
    const n = Math.round(W * 0.11), metal = col('#c8b07a'), mD = col('#7a6232'), mL = col('#f0deaa');
    for (let i = 0; i < n; i++) for (let j = 0; j <= n - 1 - i; j++) {
      const edge = j === n - 1 - i;
      a.put(W - 1 - j, i, edge ? mD : i === 0 || j === 0 ? mL : metal);
      a.put(W - 1 - j, H - 1 - i, edge ? mD : j === 0 ? mL : i === 0 ? mD : metal);
    }
  }
  // the title in embossed foil caps, wrapped to the frame
  const maxW = fx1 - fx0 - 16;
  let k = 3;
  let lines = wrapText(look.title.toUpperCase(), maxW / k, { face: 'block', spacing: 1 });
  while (k > 1 && (lines.length > 3 || lines.some(l => textWidth(l, { face: 'block', scale: k, spacing: 1 }) > maxW))) { k--; lines = wrapText(look.title.toUpperCase(), maxW / k, { face: 'block', spacing: 1 }); }
  let ty = Math.round(H * 0.2) + 7 * k;
  const cx = (fx0 + fx1) / 2;
  for (const l of lines) {
    const tw = textWidth(l, { face: 'block', scale: k, spacing: 1 });
    const x0 = Math.round(cx - tw / 2);
    drawText(a, l, x0 + 1, ty + 1, out, { face: 'block', scale: k, spacing: 1 });
    const top = ty - 7 * k;
    drawText(a, l, x0, ty, (x, y) => (y - top < k ? foilL : bayer(x, y) < 0.12 ? foilD : foil), { face: 'block', scale: k, spacing: 1 });
    ty += 9 * k;
  }
  if (look.sub) {
    const s = look.sub.toUpperCase();
    const tw = textWidth(s, { face: 'block', bold: false, spacing: 2 });
    a.rect(Math.round(cx - tw / 2 - 6), ty - 2, Math.round(tw + 12), 1, foilD);
    drawText(a, s, Math.round(cx - tw / 2), ty + 10, foil, { face: 'block', bold: false, spacing: 2 });
  }
  // the elastic band
  if (look.band) {
    const bc = parseBand(look.band), bx = W - Math.round(W * 0.13) - 4;
    for (let y = 0; y < H; y++) for (let i = 0; i < 6; i++) {
      const c = i === 0 ? shadeC(bc, -0.4) : i === 1 ? shadeC(bc, 0.25) : i === 5 ? shadeC(bc, -0.5) : (y + i) % 5 === 0 ? shadeC(bc, 0.1) : bc;
      a.put(bx + i, y, c);
    }
    for (let y = 0; y < H; y++) if (dith(bx + 6, y, 0.6)) a.px(bx + 6, y, col('#000000', 0.35));
  }
  // the handwritten label
  if (look.label) {
    const text = look.label.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const lw = Math.round(W * 0.5), lh = 12 + text.length * 13;
    const lx = Math.round(cx - lw / 2), ly = Math.round(H * 0.64);
    const paper = paperTileArt('card');
    a.rect(lx + 2, ly + 2, lw, lh, col('#000000', 0.35));
    a.rect(lx - 1, ly - 1, lw + 2, lh + 2, col('#5a4a30'));
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) a.put(lx + x, ly + y, paper.d[(y % 128) * 128 + (x % 128)]);
    a.rect(lx + 2, ly + 2, lw - 4, 1, col('#c84a3a', 0.6));
    text.forEach((l, i) => {
      const sc = i === 0 ? 2 : 1;
      const tw = textWidth(l, { scale: sc });
      drawText(a, l, Math.round(lx + lw / 2 - tw / 2), ly + 8 + (i === 0 ? 14 : 14 + 11 * i) - (i === 0 ? 0 : 0), col('#2a2440'), { scale: sc });
    });
  }
}
function parseBand(css: string): number {
  const m = /#[0-9a-f]{3,6}/i.exec(css);
  const hexes = css.match(/#[0-9a-f]{6}/gi);
  return col(hexes && hexes.length > 1 ? hexes[1] : m ? m[0] : '#2a2018');
}
/** the inside of the cover: endpaper (or paper) with a hinge shadow */
function paintInside(a: Art, kind: 'endpaper' | PaperKind) {
  const tile = paperTileArt(kind === 'endpaper' ? 'endpaper' : kind);
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) a.put(x, y, tile.d[(y % 128) * 128 + (x % 128)]);
  const sh = col('#140a02', 0.5);
  for (let x = 0; x < 10; x++) for (let y = 0; y < a.h; y++) if (dith(a.w - 1 - x, y, 0.55 * (1 - x / 10))) a.px(a.w - 1 - x, y, sh);
}
/** a thumb-index tab in a colour: card stock, a darker rim, rounded on its outer end */
function paintTab(a: Art, hex: string, left: boolean) {
  const W = a.w, H = a.h;
  const base = col(hex), out = shadeC(base, -0.6), lt = shadeC(base, 0.22), dk = shadeC(base, -0.2);
  const card = paperTileArt('card');
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const ox = left ? x : W - 1 - x;
    if (ox === 0 && (y <= 1 || y >= H - 2)) return false;
    if (ox === 1 && (y === 0 || y === H - 1)) return false;
    return true;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const ox = left ? x : W - 1 - x;
    let c = mixC(base, card.d[(y % 128) * 128 + (x % 128)], 0.28);
    if ((!inside(x - 1, y) && ox <= 1) || (!inside(x + 1, y) && ox <= 1) || !inside(x, y - 1) || !inside(x, y + 1) || ox === 0) c = out;
    else if (y === 1 || ox === 1) c = lt;
    else if (y === H - 2) c = dk;
    // the end glued under the page is in shadow
    if (W - 1 - ox < 3) c = dk;
    a.put(x, y, c);
  }
}
/** a bookmark ribbon: shaded silk with a V-cut end */
function paintRibbon(a: Art, hex: string) {
  const W = a.w, H = a.h;
  const base = col(hex);
  const shades = [-0.45, -0.1, 0.25, 0.05, -0.15, -0.4];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const notch = Math.abs(x - (W - 1) / 2);
    if (y > H - 1 - (W / 2 - notch)) continue;
    a.put(x, y, shadeC(base, shades[Math.min(shades.length - 1, Math.floor((x / W) * shades.length))]));
  }
}
/** a dithered vignette for the backdrop */
function paintVignette(a: Art) {
  const c = col('#050302');
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const dx = (x / a.w - 0.5) / 0.55, dy = (y / a.h - 0.52) / 0.52;
    const d = Math.sqrt(dx * dx + dy * dy);
    const cov = Math.max(0, Math.min(1, (d - 0.62) / 0.5)) * 0.9;
    if (dith(x, y, cov)) a.put(x, y, c);
  }
}

// ---------------------------------------------------------------- styles

const CSS = `
.ppb-wrap { position: absolute; inset: 0; z-index: 62; pointer-events: auto; overflow: hidden; touch-action: none;
  display: flex; align-items: center; justify-content: center; -webkit-user-select: none; user-select: none; }
.ppb-dim { position: absolute; inset: 0; background: rgba(14, 8, 3, 0.62); opacity: 0; transition: opacity 0.35s steps(5); }
.ppb-dim .pp-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.ppb-wrap.on .ppb-dim { opacity: 1; }
.ppb-book { position: relative; will-change: transform; }
.ppb-board { position: absolute; pointer-events: none; }
.ppb-board > canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.ppb-shadow { position: absolute; pointer-events: none; }
.ppb-edge { position: absolute; top: 4px; bottom: 4px; width: 10px; pointer-events: none; image-rendering: pixelated; box-shadow: inset 0 0 0 2px rgba(90, 60, 24, 0.55); }
.ppb-edge.l { left: -8px; } .ppb-edge.r { right: -8px; }
.ppb-single .ppb-edge.l { display: none; }
.ppb-pages { position: absolute; inset: 0; }
.ppb-pg { position: absolute; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; image-rendering: pixelated; }
.ppb-pg.hidden { visibility: hidden; }
.ppb-in { position: absolute; inset: 0; color: var(--pp-ink); image-rendering: pixelated; }
.ppb-in::after { content: ''; position: absolute; top: 0; bottom: 0; width: 28px; pointer-events: none; image-rendering: pixelated; }
.ppb-pg.l .ppb-in::after { right: 0; background: var(--ppb-gut-r) 0 0 / 28px 8px repeat-y; }
.ppb-pg.r .ppb-in::after { left: 0; background: var(--ppb-gut-l) 0 0 / 28px 8px repeat-y; }
.ppb-sh { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.ppb-hd { position: absolute; top: 3.4%; left: 9%; right: 9%; display: flex; justify-content: space-between; align-items: baseline; color: #8a7652; white-space: nowrap; overflow: hidden;
  font-family: var(--pp-label); font-size: 16px; line-height: 18px; font-size-adjust: none; letter-spacing: 2px; text-transform: uppercase; }
#ui .ppb-hd, #ui .ppb-hd * { font-size-adjust: none; }
.ppb-pg.l .ppb-hd { left: 8%; right: 11%; } .ppb-pg.r .ppb-hd { left: 11%; right: 8%; }
.ppb-hd:empty { display: none; }
.ppb-hd span { padding-bottom: 2px; box-shadow: 0 2px 0 rgba(138, 118, 82, 0.4); }
.ppb-ct { position: absolute; top: 7.5%; bottom: 6.5%; overflow: hidden; }
.ppb-pg.l .ppb-ct { left: 8%; right: 11%; } .ppb-pg.r .ppb-ct { left: 11%; right: 8%; }
.ppb-ft { position: absolute; bottom: 2.4%; left: 10%; right: 10%; text-align: center; color: #9a8662; font-family: var(--pp-label); font-size: 16px; font-size-adjust: none; }
.ppb-bk { position: relative; }
.ppb-bk.ppb-sq1, .ppb-bk.ppb-sq1 * { line-height: 1.05 !important; margin-top: 0 !important; margin-bottom: 0 !important; }
.ppb-bk.ppb-sq2 { font-size: 15px; } .ppb-bk.ppb-sq3 { font-size: 10px; }
.ppb-measure { visibility: hidden !important; pointer-events: none !important; left: -200vw !important; }
.ppb-turn { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.ppb-turn.off { display: none; }
.ppb-backw { position: absolute; inset: 0; }
.ppb-shade { position: absolute; top: 0; height: 100%; pointer-events: none; image-rendering: pixelated; z-index: 3; }
.ppb-ghost { position: absolute; inset: 0; transform: scaleX(-1); opacity: 0.07; pointer-events: none; }
.ppb-gutter { position: absolute; top: 0; bottom: 0; width: 6px; margin-left: -3px; pointer-events: none; z-index: 4;
  background: linear-gradient(90deg, rgba(30, 18, 4, 0.18) 0 2px, rgba(30, 18, 4, 0.5) 2px 4px, rgba(255, 248, 228, 0.22) 4px 6px); }
.ppb-single .ppb-gutter { display: none; }
/* while the cover is shut only the right half of the book exists */
.ppb-closed .ppb-board.back { clip-path: inset(-10% -10% -10% 50%); }
.ppb-closed.ppb-single .ppb-board.back { clip-path: none; }
.ppb-closed .ppb-edge.l, .ppb-closed .ppb-gutter { visibility: hidden; }
/* the cover */
.ppb-cover { position: absolute; z-index: 20; pointer-events: none; overflow: hidden; }
.ppb-cover > canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.ppb-cover .emb { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); opacity: 0.9; }
.ppb-inside { position: absolute; z-index: 19; pointer-events: none; overflow: hidden; display: none; }
.ppb-inside > canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
/* tabs on the fore-edge */
.ppb-tabs { position: absolute; inset: 0; pointer-events: none; z-index: 8; }
.ppb-tab { position: absolute; width: 46px; isolation: isolate; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; padding: 10px 0 8px;
  cursor: pointer; pointer-events: auto; color: #2a1e10; transition: left 0.3s steps(6), transform 0.1s steps(2); overflow: hidden; }
.ppb-tab > .pp-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: -1; }
.ppb-tab:hover { transform: translateX(4px); } .ppb-tab.left:hover { transform: translateX(-4px); }
.ppb-tab img { width: 24px; height: 24px; image-rendering: pixelated; flex: none; }
.ppb-tab span { writing-mode: vertical-rl; font-family: var(--pp-head); font-size: 18.6667px; line-height: 20px; letter-spacing: 1px; white-space: nowrap; font-size-adjust: none; }
#ui .ppb-tab span { font-size-adjust: none; }
.ppb-tab.on span { color: #000; }
.ppb-tab.tight img { display: none; }
.ppb-tab .nw { position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; background: center / 100% 100% no-repeat; image-rendering: pixelated; }
/* ribbons */
.ppb-rib { position: absolute; width: 20px; z-index: 9; cursor: pointer; pointer-events: auto; transition: left 0.3s steps(6), height 0.3s steps(6); }
.ppb-rib > .pp-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.ppb-rib::after { content: ''; position: absolute; left: 4px; right: -4px; top: 4px; bottom: 6px; background: ${'${SHADOW}'}; z-index: -1; }
.ppb-rib.lying { pointer-events: none; }
/* arrows and the close mark */
.ppb-nav { position: absolute; bottom: 6px; height: 28px; width: 60px; cursor: pointer; pointer-events: auto; display: grid; place-items: center; opacity: 0.6; z-index: 7; transition: transform 0.1s steps(2), opacity 0.2s steps(3); }
.ppb-nav:hover { transform: translateY(-2px); opacity: 1; }
.ppb-nav.off { opacity: 0; pointer-events: none; }
.ppb-x { position: absolute; top: -8px; width: 39px; height: 39px; cursor: pointer; pointer-events: auto; z-index: 12; image-rendering: pixelated; background: center / 100% 100% no-repeat;
  filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.4)); transition: transform 0.1s steps(2); }
.ppb-x:hover { transform: translateY(-2px); }
.ppb-hint { position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%); font-size: 20px; line-height: 24px; color: rgba(255, 244, 220, 0.8); white-space: nowrap; pointer-events: none; transition: opacity 0.5s steps(5); }
.ppb-pg [data-act], .ppb-pg a { cursor: pointer; }
`;

// ---------------------------------------------------------------- geometry

interface V2 { x: number; y: number }
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const frame = () => new Promise<number>(r => requestAnimationFrame(r));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const snap = (v: number) => Math.round(v / PX) * PX;

/** dithered fill patterns (art resolution) per colour and coverage */
const patCache = new Map<string, CanvasPattern | null>();
function ditherPat(g: CanvasRenderingContext2D, hex: string, a: number, cov: number): CanvasPattern | null {
  const lv = Math.max(1, Math.min(16, Math.round(cov * 16)));
  const k = `${hex}|${a}|${lv}`;
  let p = patCache.get(k);
  if (p === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const x = c.getContext('2d')!;
    const [r, gg, b] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    x.fillStyle = `rgba(${r},${gg},${b},${a})`;
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (lv / 16 > bayer(xx, yy)) x.fillRect(xx, yy, 1, 1);
    p = g.createPattern(c, 'repeat');
    patCache.set(k, p);
  }
  return p;
}

// ---------------------------------------------------------------- the book

let styled = false;
let openCount = 0;
/** is any book open right now (other overlays use this to stay out of its way) */
export const bookOpen = () => openCount > 0;

interface Pos { s: number; p: number }

export function openBook(o: BookOpts): BookHandle {
  installPaper();
  if (!styled) {
    styled = true;
    const st = document.createElement('style');
    st.dataset.ui = 'book';
    st.textContent = CSS.replace('${SHADOW}', ditherBg('#140a02', 0.5));
    document.head.appendChild(st);
    const r = document.documentElement.style;
    r.setProperty('--ppb-gut-l', `url(${shadeStrip('l', 14, 0.42)})`);
    r.setProperty('--ppb-gut-r', `url(${shadeStrip('r', 14, 0.42)})`);
  }
  let sections = o.sections.slice();
  let tabs = o.tabs ?? [];
  let ribbons = o.ribbons ?? [];
  const look = o.look;
  const paper: PaperKind = look.paper ?? 'journal';

  // ---- DOM
  const wrap = el('div', `ppb-wrap ${o.cls ?? ''}`);
  wrap.dataset.book = o.id;
  const dim = wrap.appendChild(el('div', 'ppb-dim', pxCanvas('vignette', a => paintVignette(a))));
  const book = wrap.appendChild(el('div', 'ppb-book'));
  const shadowEl = book.appendChild(el('div', 'ppb-shadow'));
  const board = book.appendChild(el('div', 'ppb-board back'));
  const edgeL = book.appendChild(el('div', 'ppb-edge l'));
  const edgeR = book.appendChild(el('div', 'ppb-edge r'));
  for (const e of [edgeL, edgeR]) e.style.background = `url(${pageEdgeURL()}) 0 0 / 8px 4px repeat`;
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
  const backW = turn.appendChild(el('div', 'ppb-backw'));
  const tBack = backW.appendChild(el('div', 'ppb-pg'));
  tBack.innerHTML = '<div class="ppb-in"></div><div class="ppb-sh"></div>';
  const shadeCv = turn.appendChild(el('canvas', 'ppb-shade'));
  const shadeG = shadeCv.getContext('2d')!;
  const measure = pagesEl.appendChild(el('div', 'ppb-pg r ppb-measure'));
  measure.innerHTML = '<div class="ppb-in"><div class="ppb-hd"></div><div class="ppb-ct"></div></div>';
  const tabsEl = book.appendChild(el('div', 'ppb-tabs'));
  const ribEl = book.appendChild(el('div', 'ppb-tabs'));
  const navPrev = book.appendChild(el('div', 'ppb-nav prev'));
  const navNext = book.appendChild(el('div', 'ppb-nav next'));
  const xBtn = book.appendChild(el('div', 'ppb-x'));
  const hint = book.appendChild(el('div', 'ppb-hint pp-hand'));
  const inside = book.appendChild(el('div', 'ppb-inside'));
  const insideCv = inside.appendChild(el('canvas'));
  const cover = book.appendChild(el('div', 'ppb-cover'));
  const coverCv = cover.appendChild(el('canvas'));
  if (look.emblem) cover.appendChild(el('div', 'emb', look.emblem));
  const boardCv = board.appendChild(el('canvas'));
  [navPrev, navNext].forEach((n, i) => {
    const [s, h] = i === 0 ? roughArrow(92, 22, 10, 24, -0.12, { seed: 4 }) : roughArrow(8, 22, 90, 24, 0.12, { seed: 7 });
    n.innerHTML = svgInk(100, 44, [{ d: s, c: INK, w: 3.4 }, { d: h, c: INK, w: 3.4 }], { stretch: true });
    n.title = i === 0 ? 'Previous page (Left arrow)' : 'Next page (Right arrow)';
  });
  xBtn.style.backgroundImage = `url(${closeURL()})`;
  xBtn.title = 'Close (Esc)';
  void roughLine;

  // ---- geometry state
  let spread = true;
  let W = 400, H = 560;
  const spineX = () => (spread ? W : 0);
  const sizeKey = () => `${spread ? 's' : '1'}${Math.round(W)}x${Math.round(H)}`;

  /** paint a canvas at art resolution for a CSS size */
  const paintCv = (cv: HTMLCanvasElement, cw: number, ch: number, paint: (a: Art) => void) => {
    const a = new Art(Math.round(cw / PX), Math.round(ch / PX));
    paint(a);
    cv.width = a.w; cv.height = a.h;
    cv.getContext('2d')!.putImageData(a.img, 0, 0);
  };

  function measureLayout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tabsW = tabs.length ? 52 : 0;
    spread = vw >= 600 && vw / vh >= 1.08;
    if (spread) {
      const availW = vw - 40 - tabsW * 2, availH = vh - Math.max(64, 92);
      H = Math.min(availH, 780);
      W = Math.min(availW / 2, H * (vh < 560 ? 0.98 : 0.8));
      H = Math.min(H, W / 0.62);
    } else {
      const availW = vw - 22 - tabsW, availH = vh - 104;
      W = Math.min(availW, 580);
      H = Math.min(availH, W * 1.62);
    }
    W = Math.max(180, snap(Math.floor(W))); H = Math.max(240, snap(Math.floor(H)));
    const bw = spread ? W * 2 : W;
    book.style.width = bw + 'px';
    book.style.height = H + 'px';
    wrap.classList.toggle('ppb-single', !spread);
    // type on the pixel grid: 2 CSS px per font pixel (3 on very big pages)
    book.style.fontSize = W >= 880 ? '30px' : '20px';
    // the boards behind the pages, a hard dithered shadow under them
    const m = spread ? { l: 14, t: 12, r: 14, b: 12 } : { l: 6, t: 10, r: 18, b: 10 };
    Object.assign(board.style, { left: -m.l + 'px', top: -m.t + 'px', width: bw + m.l + m.r + 'px', height: H + m.t + m.b + 'px' });
    Object.assign(shadowEl.style, { left: -m.l + 8 + 'px', top: -m.t + 12 + 'px', width: bw + m.l + m.r + 'px', height: H + m.t + m.b + 'px', background: ditherBg('#000000', 0.5) });
    paintCv(boardCv, bw + m.l + m.r, H + m.t + m.b, a => paintBoard(a, look, { front: false }));
    for (const p of [pgL, pgR, tFront, tBack, measure]) { p.style.width = W + 'px'; p.style.height = H + 'px'; }
    pgL.style.display = spread ? '' : 'none';
    pgL.style.transform = 'translate(0px,0px)';
    pgR.style.transform = `translate(${spineX()}px,0px)`;
    gutter.style.left = spineX() + 'px';
    // the cover: a hair bigger than the page
    const cw = W + 6, ch = H + 12;
    Object.assign(cover.style, { left: spineX() + 'px', top: '-6px', width: cw + 'px', height: ch + 'px' });
    paintCv(coverCv, cw, ch, a => paintBoard(a, look, { front: true }));
    coverCv.style.width = cw + 'px';
    Object.assign(inside.style, { top: '-6px', height: ch + 'px' });
    paintCv(insideCv, cw, ch, a => paintInside(a, look.inside ?? 'endpaper'));
    edgeL.style.display = spread ? '' : 'none';
    // the shading canvas for turns covers both pages (and the overhang to the left on phones)
    const sx0 = spread ? 0 : -W, sw = spread ? W * 2 : W * 2;
    Object.assign(shadeCv.style, { left: sx0 + 'px', width: sw + 'px' });
    shadeCv.width = Math.round(sw / PX); shadeCv.height = Math.round(H / PX);
    shadeOrigin = sx0;
    navPrev.style.left = spread ? '1.2%' : '3%';
    navNext.style.right = spread ? '1.2%' : '3%';
    xBtn.style.right = spread ? `${-(tabs.length ? 66 : 36)}px` : '0';
    xBtn.style.top = spread ? '-8px' : '-50px';
  }
  let shadeOrigin = 0;

  // ---- layout: sections -> pages (cached per size)
  const cache = new Map<string, string[]>();
  /** anchor -> [section id, page] for laid-out sections */
  const anchors = new Map<string, [string, number]>();
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
    const wrapB = (b: BookBlock, html = b.html, sq = 0) => `<div class="ppb-bk ${b.cls ?? ''}${sq ? ' ppb-sq' + sq : ''}"${b.anchor ? ` data-anchor="${b.anchor}"` : ''}>${html}</div>`;
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
    const out = pages.map(p => p.join(''));
    // anchors: the first page carrying the anchored block
    out.forEach((h, i) => { for (const m of h.matchAll(/data-anchor="([^"]+)"/g)) if (!anchors.has(m[1]) || anchors.get(m[1])![0] !== sec.id || anchors.get(m[1])![1] > i) anchors.set(m[1], [sec.id, i]); });
    return out;
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
  /** a section id or an anchor -> where it is (laying sections out until it's found) */
  const locate = (id: string): Pos | null => {
    const si = secIndex(id);
    if (si >= 0) return { s: si, p: 0 };
    for (let i = 0; i < sections.length; i++) {
      count(i);
      const a = anchors.get(id);
      if (a && a[0] === sections[i].id) return { s: i, p: a[1] };
    }
    return null;
  };

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
    const head = spread ? (side === 'l' ? sec.head?.l : sec.head?.r) : [...new Set([sec.head?.l, sec.head?.r].filter(Boolean))].join(' · ');
    inner.innerHTML = `<div class="ppb-hd">${head ? `<span>${escHtml(head)}</span>` : ''}</div><div class="ppb-ct">${body}</div>`;
    pgEl.dataset.k = `${sec.id}#${idx}`;
    fillSketches(inner);
  }
  function blankPage(seed: number): string {
    const names = doodleNames();
    const R = rng(seed);
    const d = names[Math.floor(R() * names.length)];
    return `<div style="position:absolute;left:${20 + R() * 40}%;top:${30 + R() * 30}%;opacity:0.5">${doodle(d, { size: '100px', pencil: true, seed })}</div>`;
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
      const top = H * 0.08, span = H * 0.84, th = snap(Math.min(span / n - 6, H * 0.16));
      tabs.forEach((t, i) => {
        const si = secIndex(t.section);
        // a tab is glued to its section's first page: once that page is turned it sits on the left
        const left = spread && si >= 0 && si <= curS;
        const tight = th < 18.67 * (t.label.length * 0.55) + 52;
        const e = el('div', `ppb-tab${left ? ' left' : ''}${tabOf(sections[curS]) === t.id ? ' on' : ''}${tight ? ' tight' : ''}`);
        e.style.top = `${snap(top + i * (span / n))}px`;
        e.style.height = `${th}px`;
        e.style.left = left ? `-46px` : `${spread ? W * 2 : W}px`;
        e.innerHTML = `${pxCanvas(`tab:${t.color}:${left ? 'l' : 'r'}`, a => paintTab(a, t.color, left))}${t.icon ? `<img src="${t.icon}" alt="">` : ''}<span>${escHtml(t.label)}</span>`;
        e.title = t.label;
        e.addEventListener('click', ev => { ev.stopPropagation(); paperSfx('slide', 0.5); void handle.goto(t.section); });
        tabsEl.appendChild(e);
      });
    }
    ribEl.innerHTML = '';
    for (const r of ribbons) {
      const at = locate(r.section);
      if (!at) continue;
      const si = at.s;
      const here = si === curS && at.p >= pos.p && at.p < pos.p + step();
      const e = el('div', 'ppb-rib' + (here ? ' lying' : ''), pxCanvas('rib:' + r.color, a => paintRibbon(a, r.color)));
      if (here) {
        // lying down the gutter of the open page
        e.style.left = `${snap(spread ? W - 34 : W * 0.88)}px`;
        e.style.top = '-8px';
        e.style.height = `${snap(spread ? H * 0.42 : H * 0.1)}px`;
      } else {
        const before = si < curS || (si === curS && at.p < pos.p);
        e.style.left = `${snap(spread ? (before ? W * 0.22 : W * 1.7) : (before ? W * 0.1 : W * 0.75))}px`;
        e.style.top = `${H - 2}px`;
        e.style.height = '52px';
        e.title = r.label ?? 'Bookmark';
        e.addEventListener('click', ev => { ev.stopPropagation(); void handle.goto(r.section); });
      }
      ribEl.appendChild(e);
    }
    navPrev.classList.toggle('off', !prevPos(pos));
    navNext.classList.toggle('off', !nextPos(pos));
  }
  const tabOf = (s?: BookSection) => s?.tab ?? '';

  // ---- the page turn: a vertical fold, all translations and rectangles
  interface TurnSt {
    side: 1 | -1;
    /** (kept: which half was grabbed) */
    hc: number;
    /** the page box of the turning sheet (book coords, left edge) */
    box: number;
    /** the corner in sheet coords (x from the spine: W = flat, -W = turned) */
    P: V2;
    target: Pos;
    /** single mode, going back: the sheet comes back from the left */
    back: boolean;
  }
  let T: TurnSt | null = null;
  let busy = false;

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
    const px = Math.max(-W, Math.min(W, s.P.x));
    s.P = { x: px, y: s.hc };
    const dl = W - px;
    shadeG.clearRect(0, 0, shadeCv.width, shadeCv.height);
    if (dl < PX) {
      tFront.style.clipPath = 'none';
      tBack.style.visibility = 'hidden';
      return;
    }
    tBack.style.visibility = '';
    // the fold (sheet coords, from the spine), on the pixel grid
    const M = Math.max(0, Math.min(W, snap((W + px) / 2)));
    // front: what's left of the page, sheet [0, M]
    tFront.style.clipPath = s.side > 0 ? `inset(0 ${W - M}px 0 0)` : `inset(0 0 0 ${W - M}px)`;
    // back: the flap, sheet [M, W] folded over, shows the next page's outer part: a pure translation
    const tx = s.side > 0 ? spineX() + 2 * M - W : spineX() - 2 * M;
    tBack.style.transform = `translate(${tx}px,0px)`;
    tBack.style.clipPath = s.side > 0 ? `inset(0 ${M}px 0 0)` : `inset(0 0 0 ${M}px)`;
    // shading, dithered on the art-resolution canvas (book x -> canvas x)
    const k = Math.min(1, dl / (W * 0.5));
    const fold = spineX() + s.side * M, freeE = spineX() + s.side * (2 * M - W);
    const cx = (x: number) => (x - shadeOrigin) / PX;
    const Hh = shadeCv.height;
    const band = (x0: number, x1: number, hex: string, a: number, cov0: number, cov1: number, steps = 4) => {
      const a0 = Math.min(x0, x1), a1 = Math.max(x0, x1);
      const n = Math.max(1, Math.min(steps, Math.round((a1 - a0) / PX / 2)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const cov = x1 >= x0 ? cov0 + (cov1 - cov0) * t : cov0 + (cov1 - cov0) * t;
        const xa = x1 >= x0 ? x0 + (x1 - x0) * (i / n) : x0 - (x0 - x1) * ((i + 1) / n);
        const xb = x1 >= x0 ? x0 + (x1 - x0) * ((i + 1) / n) : x0 - (x0 - x1) * (i / n);
        const p = ditherPat(shadeG, hex, a, cov);
        if (!p || cov <= 0.02) continue;
        shadeG.fillStyle = p;
        const ca = Math.round(cx(xa)), cb = Math.round(cx(xb));
        shadeG.fillRect(ca, 0, Math.max(1, cb - ca), Hh);
      }
    };
    const ws = W * (0.05 + 0.1 * k), wc = W * (0.025 + 0.05 * k), wf = W * (0.02 + 0.04 * k);
    // the page underneath, in the lee of the lifted flap
    band(fold, fold + s.side * ws, '#1e1206', 0.9, 0.62 * (0.5 + 0.5 * k), 0);
    // the flap: a bright roll at the fold, then a soft shade across it
    band(fold, fold - s.side * wc, '#fffbee', 0.85, 0.55, 0.05, 3);
    band(fold - s.side * wc, freeE, '#3c2808', 0.8, 0.06 + 0.1 * k, 0.16 * k, 3);
    // the fold line itself
    shadeG.fillStyle = 'rgba(40,24,6,0.55)';
    shadeG.fillRect(Math.round(cx(fold)) - (s.side > 0 ? 1 : 0), 0, 1, Hh);
    // the front, shaded where the flap's free edge lies over it
    band(freeE, freeE - s.side * wf, '#1e1206', 0.9, 0.4 * k, 0, 3);
  }

  function endTurn(done: boolean) {
    const s = T;
    T = null;
    turn.classList.add('off');
    shadeG.clearRect(0, 0, shadeCv.width, shadeCv.height);
    for (const p of [pgL, pgR, tFront, tBack]) (p.lastElementChild as HTMLElement).style.background = '';
    if (!s) return;
    if (done) pos = s.target;
    show();
  }

  /** animate the fold from where it is to the far side (done) or back home (cancel) */
  function animateTo(done: boolean, dur = 520): Promise<void> {
    const s = T;
    if (!s) return Promise.resolve();
    const from = s.P.x;
    // in single mode going back, "done" means the sheet lands flat on the page
    const toFlat = s.back ? done : !done;
    const to = toFlat ? W : -W;
    const d0 = reduced() ? 1 : dur;
    return new Promise(res => {
      const t0 = performance.now();
      const stepF = () => {
        if (T !== s) { res(); return; }
        const t = Math.min(1, (performance.now() - t0) / d0);
        s.P = { x: from + (to - from) * ease(t), y: s.hc };
        applyTurn();
        if (t < 1) requestAnimationFrame(stepF);
        else { endTurn(done); res(); }
      };
      requestAnimationFrame(stepF);
    });
  }

  async function turnTo(dir: 1 | -1, to: Pos, o2: { fast?: boolean; hc?: number } = {}) {
    if (busy || !to) return;
    busy = true;
    try {
      if (T) endTurn(false);
      beginTurn(dir, to, o2.hc ?? H);
      paperSfx('flip', o2.fast ? 0.7 : 1);
      await animateTo(true, o2.fast ? 300 : 540);
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
      // the edge follows the finger (in sheet coords; single-mode back-turns move faster)
      const k = s.back ? 2 : 1;
      const sp = toSheet({ x: drag.x0 + dxp * k, y: drag.y0 + dyp }, s.side);
      const sp0 = toSheet({ x: drag.x0, y: drag.y0 }, s.side);
      s.P = { x: drag.p0.x + (sp.x - sp0.x), y: s.hc };
      applyTurn();
      return;
    }
    if (e.buttons || busy || closing || !opened || reduced()) return;
    // hover: lift the edge a little to invite a turn
    const z = zoneAt(p);
    const want = z && z.corner ? { dir: z.dir, hc: z.hc } : null;
    if (want && !(want.dir > 0 ? nextPos(pos) : prevPos(pos))) return;
    if (want && (!peel || peel.dir !== want.dir || peel.hc !== want.hc)) {
      if (T) endTurn(false);
      const to = want.dir > 0 ? nextPos(pos)! : prevPos(pos)!;
      const s = beginTurn(want.dir, to, want.hc);
      peel = want;
      void tweenP(s.back ? -W * 0.86 : W - W * 0.14, 180);
    } else if (!want && peel) {
      peel = null;
      void tweenP(T?.back ? -W : W, 160).then(() => { if (!peel && T && !drag) endTurn(false); });
    }
  });
  const tweenP = (toX: number, ms: number) => new Promise<void>(res => {
    const s = T;
    if (!s) { res(); return; }
    const from = s.P.x, t0 = performance.now();
    const f = () => {
      if (T !== s || drag) { res(); return; }
      const t = Math.min(1, (performance.now() - t0) / ms), e = easeOut(t);
      s.P = { x: from + (toX - from) * e, y: s.hc };
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
      void animateTo(true, 520).then(() => { busy = false; });
      return;
    }
    // released: past the middle (or flicked) completes the turn
    const fl = d.vx * (d.dir > 0 ? -1 : 1);
    const prog = s.back ? (s.P.x + W) / (2 * W) : (W - s.P.x) / (2 * W);
    const done = prog > 0.42 || fl > 0.45;
    busy = true;
    if (done) paperSfx('flip', 0.8);
    void animateTo(done, 320).then(() => { busy = false; });
  };
  pagesEl.addEventListener('pointerup', endDrag);
  pagesEl.addEventListener('pointercancel', endDrag);
  pagesEl.addEventListener('pointerleave', () => {
    if (peel && !drag) { peel = null; void tweenP(T?.back ? -W : W, 160).then(() => { if (!peel && T && !drag) endTurn(false); }); }
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
  dim.addEventListener('pointerdown', e => { if ((e.target === dim || (e.target as HTMLElement).parentElement === dim) && opened) void handle.close(); });
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
    cache.clear(); anchors.clear();
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

  /** slide the book to a y offset with an easing, in whole pixels */
  const slide = async (x0: number, y0: number, x1: number, y1: number, ms: number, ez: (t: number) => number) => {
    if (reduced()) { book.style.transform = `translate(${x1}px, ${y1}px)`; return; }
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const e = ez(t);
      book.style.transform = `translate(${snap(x0 + (x1 - x0) * e)}px, ${snap(y0 + (y1 - y0) * e)}px)`;
      if (t >= 1) break;
      await frame();
    }
  };
  /**
   * The cover swing, frame by frame like pixel animation: the board narrows to the spine (whole
   * columns, crisp), then in a spread the first left page opens out from the spine.
   */
  const swing = async (open: boolean) => {
    const R = reduced();
    const N = R ? 1 : 10;
    const cw = W + 6;
    for (let i = 1; i <= N; i++) {
      const t = open ? i / N : 1 - i / N;
      const th = t * Math.PI;
      const c = Math.cos(th);
      if (c > 0) {
        const w = Math.max(PX, snap(cw * c));
        cover.style.display = '';
        cover.style.width = w + 'px';
        coverCv.style.width = cw + 'px';
        coverCv.style.transform = `scaleX(${(w / cw).toFixed(4)})`;
        coverCv.style.transformOrigin = '0 0';
        const emb = cover.querySelector('.emb') as HTMLElement | null;
        if (emb) emb.style.transform = `translate(-50%, -50%) scaleX(${(w / cw).toFixed(4)})`;
        if (emb) emb.style.left = `${w / 2}px`;
        inside.style.display = 'none';
        if (spread) pgL.style.clipPath = 'inset(0 0 0 100%)';
      } else {
        cover.style.display = 'none';
        const w = snap(cw * -c);
        if (spread) {
          // the left page lands from the spine outward, the cover's inside edge going ahead of it
          pgL.classList.remove('hidden');
          pgL.style.clipPath = `inset(0 0 0 ${Math.max(0, W - w)}px)`;
          inside.style.display = '';
          Object.assign(inside.style, { left: `${W - w - 4}px`, width: '6px' });
        }
      }
      await wait(R ? 0 : 34);
    }
    inside.style.display = 'none';
    pgL.style.clipPath = '';
    if (!open) { cover.style.display = ''; cover.style.width = cw + 'px'; coverCv.style.transform = ''; const emb = cover.querySelector('.emb') as HTMLElement | null; if (emb) { emb.style.transform = ''; emb.style.left = ''; } }
  };

  async function doOpen() {
    measureLayout();
    await handReady();
    const at = o.start ? locate(o.start) : null;
    pos = at ? { s: at.s, p: spread ? at.p - (at.p % 2) : at.p } : { s: 0, p: 0 };
    show();
    const closedX = spread ? -W / 2 : 0;
    wrap.classList.add('ppb-closed');
    pgL.classList.toggle('hidden', spread);
    tabsEl.style.opacity = '0'; ribEl.style.opacity = '0';
    [navPrev, navNext, xBtn, hint].forEach(x => (x.style.opacity = '0'));
    cover.style.display = '';
    requestAnimationFrame(() => wrap.classList.add('on'));
    paperSfx('slide', 0.8);
    await slide(closedX, window.innerHeight * 0.75, closedX, 0, 480, backOut);
    paperSfx('open');
    const sw0 = swing(true);
    await slide(closedX, 0, 0, 0, 340, ease);
    await sw0;
    wrap.classList.remove('ppb-closed');
    cover.style.display = 'none';
    pgL.classList.remove('hidden');
    tabsEl.style.transition = ribEl.style.transition = 'opacity 0.3s steps(4)';
    tabsEl.style.opacity = '1'; ribEl.style.opacity = '1';
    [navPrev, navNext, xBtn, hint].forEach(x => { x.style.transition = 'opacity 0.3s steps(4), transform 0.1s steps(2)'; x.style.opacity = ''; });
    hint.textContent = spread ? 'drag a page edge, or use the arrow keys' : 'swipe or drag the page edge';
    setTimeout(() => { hint.style.opacity = '0'; }, 3600);
    opened = true;
  }
  void doOpen();

  async function doClose() {
    if (closing) return;
    closing = true;
    if (T) endTurn(false);
    tabsEl.style.opacity = '0'; ribEl.style.opacity = '0';
    [navPrev, navNext, xBtn, hint].forEach(x => (x.style.opacity = '0'));
    paperSfx('close');
    const closedX = spread ? -W / 2 : 0;
    const sw0 = swing(false);
    await slide(0, 0, closedX, 0, 340, ease);
    await sw0;
    if (spread) pgL.classList.add('hidden');
    wrap.classList.add('ppb-closed');
    wrap.classList.remove('on');
    await slide(closedX, 0, closedX, window.innerHeight * 0.85, 380, t => t * t);
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
      const at = locate(id);
      if (!at) return;
      const si = at.s;
      let p = Math.max(0, go.page ?? at.p);
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
      if (id) { for (const k of [...cache.keys()]) if (k.endsWith('|' + id)) cache.delete(k); } else cache.clear(); anchors.clear();
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
      cache.clear(); anchors.clear();
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
  void paperTex; void dotURL;
  return handle;
}

export { INK, PENCIL };
