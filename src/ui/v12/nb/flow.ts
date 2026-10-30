// V12 notebook: laying content out on ruled pages. A Flow writes handwriting onto the rules (each
// line of text sits on a ruled line), floats pictures to the right with text wrapping beside them,
// keeps headings with what follows, and runs on to new pages as needed. Everything it places is an
// op (a painter called with the page's buffer), so pages are painted at the notebook's own pixel
// resolution. Ops can animate: anim(key) gives a pen animation's progress (0 not started .. 1 done)
// and pen(x, y) says where the nib is, so the book can draw the pen there.

import type { Art } from '../../v11/paper/px';
import {
  PW, LINE, NLINES, TEXT_X, TEXT_R, TEXT_W, lineY, hand, handW, wrap, C, plot, wavyPx, tickPx, boxPx, arrowPx, stampAt, doodleArt,
} from './art';
import type { PaperKind, Px, HandOpts } from './art';
import { hashStr } from '../../v11/paper/rng';

export interface Hit { x: number; y: number; w: number; h: number; act: string; arg?: string }
export interface Ctx {
  a: Art;
  /** seconds since the notebook opened (idle wiggles) */
  time: number;
  /** a pen animation's progress: 0 not started .. 1 done (1 when there is none) */
  anim(key: string): number;
  /** where the animated pen's nib is now (page px) */
  pen(x: number, y: number, tool?: 'pen' | 'pencil' | 'stamp'): void;
  /** a picture (null until it has loaded: the page repaints when it arrives) */
  pic(key: string, load: () => Promise<Art | null>): Art | null;
  /** the page number an anchor lands on (null while unknown) */
  pageNo(anchor: string): number | null;
}
export type Op = (c: Ctx) => void;
export interface Anim { key: string; dur: number; sound?: 'pencil' | 'stamp' | 'tick'; done?: () => void }
export interface Page {
  id: string;
  section: string;
  paper: PaperKind;
  seed: number;
  ops: Op[];
  hits: Hit[];
  anims: Anim[];
  /** the running head (small caps at the top) */
  head?: string;
  /** page number (set by the book) */
  num?: number;
  /** no paper of its own (the inside cover) */
  art?: () => Art;
}

export interface TextO extends HandOpts {
  color?: number;
  indent?: number;
  /** blank lines after */
  after?: number;
  center?: boolean;
  hit?: { act: string; arg?: string };
  /** never leave this last on a page */
  keep?: number;
}

export class Flow {
  pages: Page[] = [];
  /** anchor -> page id */
  anchors: Record<string, string> = {};
  line = 0;
  private p: Page | null = null;
  private n = 0;
  /** a float on the right: text lines up to `until` stop at x */
  private fl: { x: number; until: number } | null = null;

  constructor(readonly section: string, readonly base: string, readonly o: { paper?: PaperKind; head?: string } = {}) {}

  get cur(): Page { if (!this.p) this.page(); return this.p!; }
  /** start a new page */
  page(id?: string, o: { paper?: PaperKind; head?: string } = {}): Page {
    const pid = id ?? `${this.base}${this.n ? '#' + (this.n + 1) : ''}`;
    this.n++;
    const p: Page = { id: pid, section: this.section, paper: o.paper ?? this.o.paper ?? 'ruled', seed: hashStr(pid) % 9973, ops: [], hits: [], anims: [], head: o.head ?? this.o.head };
    this.pages.push(p);
    this.p = p;
    this.line = 0;
    this.fl = null;
    return p;
  }
  /** start a fresh page for a new item (unless this page is still empty) */
  fresh(id: string, o: { paper?: PaperKind; head?: string } = {}): Page {
    if (this.p && this.p.ops.length === 0 && this.line === 0) { this.p.id = id; this.p.seed = hashStr(id) % 9973; if (o.head) this.p.head = o.head; return this.p; }
    return this.page(id, o);
  }
  anchor(key: string) { this.anchors[key] = this.cur.id; }
  room() { return NLINES - this.line; }
  need(n: number) { if (!this.p || this.room() < n) this.page(); }
  gap(n = 1) { this.line = Math.min(NLINES, this.line + n); }
  op(f: Op) { this.cur.ops.push(f); }
  hit(x: number, y: number, w: number, h: number, act: string, arg?: string) { this.cur.hits.push({ x, y, w, h, act, arg }); }
  anim(a: Anim) { this.cur.anims.push(a); }
  /** the right edge of the text column on line k (floats push it in) */
  right(k = this.line) { return this.fl && k < this.fl.until ? this.fl.x : TEXT_R; }
  /** the top pixel of the current line's slot */
  top(k = this.line) { return lineY(k) - LINE + 2; }

  /** handwriting, wrapped and flowed over pages ('\n' starts a new line) */
  text(s: string, o: TextO = {}) {
    const sc = o.scale ?? 1, lines = sc;
    const ind = o.indent ?? 0;
    const color = o.color ?? C.ink;
    let first = true;
    for (const para of s.split('\n')) {
      let rest = para.replace(/\s+/g, ' ').trim();
      do {
        this.need(first ? (o.keep ?? 0) + lines : lines);
        const k = this.line + lines - 1;
        const w = this.right(this.line) - TEXT_X - ind;
        const ls = wrap(rest, w, o);
        const ln = ls[0];
        const raw = rest.startsWith(ln) ? ln : ln.replace(/-$/, '');
        rest = ls.length > 1 ? rest.slice(raw.length).trim() : '';
        const x = o.center ? Math.round(TEXT_X + ind + (w - handW(ln, o)) / 2) : TEXT_X + ind, y = lineY(k);
        const opts = { ...o };
        if (ln) this.op(c => { hand(c.a, ln, x, y, color, opts); });
        if (o.hit && ln) this.hit(x - 2, y - 9 * sc, handW(ln, o) + 4, 11 * sc, o.hit.act, o.hit.arg);
        this.line += lines;
        first = false;
      } while (rest.length);
    }
    if (o.after) this.gap(o.after);
  }
  /** a title in big handwriting with a wavy red underline */
  title(s: string, o: { color?: number; sub?: string; under?: number } = {}) {
    const ls = wrap(s, TEXT_W - 4, { bold: true, scale: 2 });
    this.need(ls.length * 2 + 3);
    for (const ln of ls) {
      const y = lineY(this.line + 1), x = TEXT_X;
      this.op(c => hand(c.a, ln, x, y, o.color ?? C.ink, { bold: true, scale: 2 }));
      this.line += 2;
    }
    const w = Math.min(TEXT_W, Math.max(...ls.map(l => handW(l, { bold: true, scale: 2 }))) + 6);
    const y = lineY(this.line - 1) + 3, p = wavyPx(TEXT_X - 2, y, TEXT_X + w, hashStr(s), 0.7);
    this.op(c => plot(c.a, p, o.under ?? C.red));
    if (o.sub) this.text(o.sub, { color: C.pencil, pencil: true });
  }
  /** a small heading in block caps with a pencil rule (kept with the next 2 lines) */
  heading(s: string, right = '') {
    this.need(3);
    const y = lineY(this.line) - 2, t = s.toUpperCase();
    const w = handW(t, { block: true, spacing: 1 });
    const seed = hashStr(s);
    this.op(c => {
      hand(c.a, t, TEXT_X, y, C.brown, { block: true, spacing: 1 });
      plot(c.a, wavyPx(TEXT_X + w + 4, y - 3, (right ? TEXT_R - handW(right) - 6 : TEXT_R), seed, 0.4), C.pencilLt, Infinity, { pencil: true });
      if (right) hand(c.a, right, TEXT_R - handW(right), y, C.pencil, { pencil: true });
    });
    this.line++;
  }

  /**
   * A checklist row: a little pen box, the text beside it. state: 'done' (ticked, struck through),
   * 'now' (a red arrow in the margin, underlined), 'todo', 'next' (faint pencil). With `fresh`, the
   * tick and the strike-through are an animation (drawn on by the pen when the page is shown).
   */
  check(s: string, state: 'done' | 'now' | 'todo' | 'next', o: { seed?: number; fresh?: Anim; color?: number; hit?: { act: string; arg?: string }; bold?: boolean; light?: boolean } = {}) {
    const seed = o.seed ?? hashStr(s);
    const bx = TEXT_X, tx = TEXT_X + 12;
    const w = this.right() - tx;
    const ls = wrap(s, w, { bold: o.bold });
    this.need(ls.length);
    const box = boxPx(bx, lineY(this.line) - 8, 7, 7, seed);
    const tick = tickPx(bx, lineY(this.line) - 8, 7, seed);
    const strikes: Px[] = [];
    const rows: { ln: string; y: number }[] = [];
    for (const ln of ls) {
      const y = lineY(this.line);
      rows.push({ ln, y });
      strikes.push(wavyPx(tx - 1, y - 3, tx + handW(ln, { bold: o.bold }) + 1, seed + rows.length, 0.6));
      this.line++;
    }
    const all: Px = [...tick, ...strikes.flat()];
    const key = o.fresh?.key;
    const col = state === 'next' ? C.pencilLt : o.color ?? C.ink;
    const arrow = state === 'now' ? arrowPx(4, lineY(this.line - ls.length) - 4, TEXT_X - 4, lineY(this.line - ls.length) - 4, seed) : null;
    this.op(c => {
      const k = key ? c.anim(key) : 1;
      const done = state === 'done' && k > 0;
      plot(c.a, box, state === 'next' ? C.pencilLt : C.pencil, Infinity, { pencil: true });
      for (const r of rows) hand(c.a, r.ln, tx, r.y, done ? C.pencil : col, { bold: o.bold, pencil: state === 'next' || done });
      if (state === 'now') { plot(c.a, wavyPx(tx - 1, rows[0].y + 2, tx + handW(rows[0].ln, { bold: o.bold }) + 1, seed + 9, 0.5), C.red); if (arrow) plot(c.a, arrow, C.red); }
      if (state === 'done') {
        const n = k >= 1 ? all.length : Math.floor(all.length * k);
        plot(c.a, all.slice(0, Math.min(n, tick.length)), C.blue, Infinity, { w: 1 });
        plot(c.a, all.slice(tick.length, n), o.light ? C.pencilLt : C.ink);
        if (k > 0 && k < 1 && n > 0) { const [px, py] = all[Math.min(n, all.length) - 1]; c.pen(px, py); }
      }
    });
    if (o.fresh) this.anim(o.fresh);
    if (o.hit) this.hit(bx - 2, rows[0].y - 10, TEXT_R - bx, rows.length * LINE + 2, o.hit.act, o.hit.arg);
  }

  /** a float on the right (w x h px), text wraps beside it; draw gets its top-left */
  float(w: number, h: number, draw: (c: Ctx, x: number, y: number) => void, o: { hit?: { act: string; arg?: string }; dy?: number } = {}) {
    const lines = Math.ceil((h + 4) / LINE);
    this.need(Math.min(NLINES, lines + 1));
    const x = TEXT_R - w, y = this.top() + (o.dy ?? 0);
    this.op(c => draw(c, x, y));
    if (o.hit) this.hit(x, y, w, h, o.hit.act, o.hit.arg);
    this.fl = { x: x - 6, until: this.line + lines };
  }
  /** end the float (text goes full width again below it) */
  clearFloat() { if (this.fl) { this.line = Math.max(this.line, this.fl.until); this.fl = null; } }

  /** a block of `h` px across the column (pictures, rows of stamps...) */
  block(h: number, draw: (c: Ctx, x: number, y: number, w: number) => void, o: { hit?: { act: string; arg?: string }; full?: boolean } = {}) {
    const lines = Math.ceil((h + 3) / LINE);
    this.need(lines);
    const x = o.full ? 6 : TEXT_X, y = this.top(), w = o.full ? PW - 12 : this.right() - TEXT_X;
    this.op(c => draw(c, x, y, w));
    if (o.hit) this.hit(x, y, w, h, o.hit.act, o.hit.arg);
    this.line += lines;
  }
  /** a rubber stamp on the current line (animated with `fresh`) */
  stamp(text: string, o: { color?: string; round?: boolean; small?: string; size?: 'sm' | 'md' | 'lg'; deg?: number; x?: number; fresh?: Anim; lines?: number } = {}) {
    const lines = o.lines ?? (o.round ? 4 : o.size === 'lg' ? 3 : 2);
    this.need(lines);
    const y = this.top(), x = o.x ?? TEXT_X;
    const key = o.fresh?.key;
    this.op(c => {
      const k = key ? c.anim(key) : 1;
      if (k <= 0) return;
      stampAt(c.a, text, x, y, { color: o.color, round: o.round, small: o.small, size: o.size, deg: o.deg, k: k < 1 ? k : 1, seed: hashStr(text) % 97 });
      if (k < 1) c.pen(x + 10, y + 6, 'stamp');
    });
    if (o.fresh) this.anim(o.fresh);
    this.line += lines;
  }
  /** a doodle in the margin of the current line */
  doodle(name: string, size: number, o: { x?: number; color?: number; pencil?: boolean; dy?: number } = {}) {
    const x = o.x ?? 2, y = this.top() + (o.dy ?? 0);
    const art = doodleArt(name, size, o.color ?? C.pencil, { pencil: o.pencil ?? true, seed: hashStr(name) % 9 });
    this.op(c => c.a.blit(art, x, y));
  }
}
