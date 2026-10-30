// V12 notebook: the book itself. One canvas at the notebook's own pixel resolution, shown at a whole
// number of device pixels per art pixel over a dithered dimming of the frozen scene. Mori's hands
// bring the closed notebook up from his pocket, the elastic band snaps off, the cover swings open
// (squashed in whole columns), and the pages turn with a real curl: the sheet wraps round a cylinder
// that follows the corner you drag (or that a click or a key sends over), the curl's underside and
// its rim are shaded with ordered dithering, the page beneath gets the curl's dithered shadow, and
// in one-page mode the sheet's back shows the front's ink through it. Paper tabs on the fore-edge
// jump to a section (riffling through the pages between), the ribbon marks the tracked quest, and a
// pen, a pencil and an eraser stand in the spine: take one to draw on any page.

import { game } from '../../../game/game';
import { guardInput } from '../../../core/input';
import { pushKeys } from '../../laptop-kit';
import { audio } from '../../../core/audio';
import { paperSfx } from '../../v11/paper/sound';
import { installPixelFonts } from '../../v11/paper/pxfont';
import { Art, col, dith, mixC } from '../../v11/paper/px';
import { hash2 } from '../../v11/paper/rng';
import { nbSave, onQuestMark } from '../notebook';
import type { NotebookOpts } from '../notebook';
import { trackedQuest } from '../../../game/quests';
import {
  PW, PH, C, paperArt, coverArt, bandArt, handArt, toolStandArt, toolHoldArt, tabArt, ribbonAt, showThrough, outlined, hand, handW, COVER_HEX, leatherArt,
} from './art';
import type { ToolKind } from './art';
import type { Page, Ctx } from './flow';
import { buildAll } from './content';
import type { Built } from './content';
import { decodeStrokes, encodeStrokes, rasterStroke, simplify, MAX_STROKES } from './ink';
import type { InkStroke } from './ink';
import { prewarmNotebookMap } from './map';
import { hasAnim7 } from '../../../art/v7/anim-contract';
import { animInfo } from '../../../world/actor';

const SMAX = 4, BR = 3;
const SHADE = col('#2a1808'), WHITE = col('#fffaf0'), EDGE = col('#8a6a40'), DIM = col('#0c0806');
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

type V2 = [number, number];
interface Turn {
  /** +1 forward (the right page goes over), -1 back */
  dir: 1 | -1;
  /** the position it lands on when it completes */
  to: number;
  lu: Art | null; ru: Art | null; front: Art; back: Art;
  G0: V2; P: V2;
  drag: boolean;
  peek: boolean;
  anim: { a: V2; b: V2; t0: number; dur: number; lift: number; commit: boolean; drop?: boolean } | null;
}
interface Stroke { slot: number; id: string; tool: 'pen' | 'pencil' | 'eraser'; pts: number[] }
interface Rect { x: number; y: number; w: number; h: number }
const inR = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** the player, as far as the notebook needs him (his pose while he takes it out and reads) */
interface Holder { poseOverride: string | null; vx: number }
const clipMs = (anim: string) => { const i = animInfo(anim, 'mori'); return Math.max(250, Math.min(1600, (i.frames / Math.max(1, i.fps)) * 1000)); };

let nb: Notebook | null = null;
/** open (resolves when it has been put away) */
export async function showNotebook(o: NotebookOpts): Promise<void> {
  if (nb) { nb.goto(o); return nb.closed; }
  const n = new Notebook(o);
  nb = n;
  try { await n.closed; } finally { if (nb === n) nb = null; }
}
export function notebookGoto(o: NotebookOpts) { nb?.goto(o); }
export const notebookShown = () => !!nb;

class Notebook {
  readonly closed: Promise<void>;
  private closedRes!: () => void;
  private root: HTMLDivElement;
  private bg: HTMLCanvasElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private F!: Art;
  private CW = 0; private CH = 0; private cs = 1;
  spread = true;
  private built!: Built;
  /** spread index (two pages) or slot (one page) */
  private pos = 0;
  private cache = new Map<string, Art>();
  private pics = new Map<string, Art | null>();
  private picPages = new Map<string, Set<string>>();
  private layers = new Map<string, Uint8Array>();
  private strokes = new Map<string, InkStroke[]>();
  private doneAnims = new Set<string>();
  private pending = new Set<string>();
  private running: { key: string; slot: number; t0: number; dur: number; done?: () => void; stamped?: boolean } | null = null;
  private penAt: { slot: number; x: number; y: number; tool: 'pen' | 'pencil' | 'stamp' } | null = null;
  private t = 0;
  private last = 0;
  private dirty = true;
  private dead = false;
  private phase: 'opening' | 'open' | 'closing' = 'opening';
  /** the cover: 0 shut .. 1 open; the band 0 on .. 1 off; the slide up from the pocket 0 .. 1 */
  private openK = 0; private bandK = 0; private slideK = 0;
  private turn: Turn | null = null;
  private queue: number[] = [];
  private tool: ToolKind | null = null;
  private stroke: Stroke | null = null;
  private lastStroke: string | null = null;
  private ptr: V2 | null = null;
  private down: { x: number; y: number; t: number; id: number; zone: 'fwd' | 'back' | 'page' | null; moved: boolean; touch: boolean } | null = null;
  private vel: { x: number; t: number; vx: number } = { x: 0, t: 0, vx: 0 };
  private hint: { text: string; until: number } | null = null;
  private target: number | null = null;
  private bobY = 0;
  private handCache = new Map<number, ReturnType<typeof handArt>>();
  private boardCache = new Map<string, Art>();
  private popKeys: () => void = () => {};
  private offMark: () => void = () => {};
  private saveT = 0;
  private openKey: string;
  private hits: { r: Rect; act: string; arg?: string; slot?: number }[] = [];

  constructor(o: NotebookOpts) {
    this.closed = new Promise<void>(r => (this.closedRes = r));
    this.openKey = o.page === 'guide' ? 'KeyG' : o.page === 'people' ? 'KeyK' : 'KeyJ';
    void installPixelFonts();
    this.root = document.createElement('div');
    this.root.className = 'nb12';
    this.root.style.cssText = 'position:absolute;inset:0;z-index:62;pointer-events:auto;overflow:hidden;touch-action:none;';
    this.bg = document.createElement('canvas');
    this.cv = document.createElement('canvas');
    for (const c of [this.bg, this.cv]) { c.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;image-rendering:crisp-edges;'; this.root.appendChild(c); }
    this.bg.style.transition = 'opacity 0.3s steps(4)';
    this.bg.style.opacity = '0';
    this.g = this.cv.getContext('2d')!;
    this.measure();
    this.rebuild();
    this.target = this.slotFor(o);
    this.pos = this.posOf(this.target ?? 1);
    this.target = null;
    game.ui.modalLayer.appendChild(this.root);
    game.ui.modalOpen++;
    // Mori takes the notebook out of his pocket in the world first (the pullNote clip), then it comes
    // up into view and the world freezes behind it
    const sc = game.scene as unknown as { player?: Holder; cutscene?: boolean } | null;
    const p = sc?.player;
    if (p && !sc?.cutscene && hasAnim7('pullNote') && !reduced()) {
      const ms = clipMs('pullNote');
      this.who = { p, prev: p.poseOverride ?? null };
      p.vx = 0;
      p.poseOverride = 'pullNote';
      this.openT = -(ms * 0.7) / 1000;
      audio.play('rustle', { vol: 0.4, pitch: 1.15 });
      setTimeout(() => { if (p.poseOverride === 'pullNote') p.poseOverride = hasAnim7('noteRead') ? 'noteRead' : this.who?.prev ?? null; }, ms);
    }
    this.bindInput();
    this.offMark = onQuestMark(() => { this.rebuild(true); this.dirty = true; });
    window.addEventListener('resize', this.onResize);
    prewarmNotebookMap();
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ sizes and layout

  private measure() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    const wd = w * dpr, hd = h * dpr;
    const needW = PW * 2 + 2 * (SMAX + BR) + 34, needH = PH + 2 * BR + 30;
    const s2 = Math.floor(Math.min(wd / needW, hd / needH));
    const s1 = Math.floor(Math.min(wd / (PW + 2 * (SMAX + BR) + 28), hd / needH));
    // portrait screens show one page; otherwise the spread, unless it would be unreadably small
    const portrait = h > w * 1.05;
    this.spread = !portrait && (s2 >= 2 || s2 >= s1 || s2 / dpr >= 1.3);
    const s = Math.max(1, this.spread ? s2 : s1);
    this.cs = s / dpr;
    this.CW = Math.ceil(w / this.cs); this.CH = Math.ceil(h / this.cs);
    for (const c of [this.bg, this.cv]) {
      c.width = this.CW; c.height = this.CH;
      c.style.width = `${this.CW * this.cs}px`; c.style.height = `${this.CH * this.cs}px`;
    }
    this.F = new Art(this.CW, this.CH);
    this.paintBackdrop();
  }
  /** the dimmed, dithered scene behind (darker towards the edges, in quantised steps) */
  private paintBackdrop() {
    const a = new Art(this.CW, this.CH);
    const on = col('#0c0806', 0.82), off = col('#0c0806', 0.34);
    const cx = this.CW / 2, cy = this.CH * 0.46, R = Math.hypot(cx, cy);
    for (let y = 0; y < this.CH; y++) for (let x = 0; x < this.CW; x++) {
      const d = Math.hypot(x - cx, y - cy) / R;
      const cov = Math.round((0.38 + d * d * 0.5) * 6) / 6;
      a.put(x, y, dith(x, y, cov) ? on : off);
    }
    this.bg.getContext('2d')!.putImageData(a.img, 0, 0);
  }
  private onResize = () => {
    if (this.dead) return;
    const keep = this.visibleSlots()[0];
    const id = this.built.slots[keep]?.id;
    const was = this.spread;
    this.measure();
    if (was !== this.spread) { this.rebuild(); this.cache.clear(); }
    this.turn = null; this.queue = [];
    const i = id ? this.built.slots.findIndex(p => p.id === id) : -1;
    this.pos = this.posOf(i < 0 ? 1 : i);
    this.dirty = true;
  };

  /** where things are this frame (art px) */
  private geo() {
    const spine0 = this.spread ? Math.round(this.CW / 2) : Math.round((this.CW - PW) / 2);
    // held a little low, as you'd hold a notebook to read it
    const top0 = Math.max(this.spread ? 18 : 22, Math.round((this.CH - PH) * (this.spread ? 0.5 : 0.6)) - 8);
    // closed (and sliding): centred on the cover
    const shut = 1 - Math.min(1, this.openK * 1.0);
    const ox = this.spread ? Math.round(-(PW / 2) * easeInOut(shut)) : 0;
    const slide = Math.round((1 - this.slideK) * (this.CH - top0 + 30));
    return { spine: spine0 + ox, top: top0 + slide + this.bobY };
  }
  private posOf(slot: number) { return this.spread ? Math.floor(slot / 2) : Math.max(0, slot); }
  private visibleSlots(p = this.pos): number[] { return this.spread ? [p * 2, p * 2 + 1] : [p]; }
  private maxPos() { return this.spread ? Math.floor((this.built.slots.length - 1) / 2) : this.built.slots.length - 1; }
  private sideOf(slot: number): 'l' | 'r' { return this.spread && slot % 2 === 0 ? 'l' : 'r'; }

  // ------------------------------------------------------------ content

  private rebuild(keep = false) {
    const cur = keep ? this.built?.slots[this.visibleSlots()[this.spread ? 1 : 0]]?.id : null;
    this.built = buildAll(this.spread);
    this.cache.clear();
    this.pending.clear();
    for (const p of this.built.slots) for (const a of p.anims) if (!this.doneAnims.has(a.key)) this.pending.add(a.key);
    if (keep && cur) { const i = this.built.slots.findIndex(p => p.id === cur); if (i >= 0) this.pos = this.posOf(i); }
    this.pos = Math.max(0, Math.min(this.maxPos(), this.pos));
  }
  private slotFor(o: NotebookOpts): number | null {
    const A = this.built.anchors, S = this.built.starts;
    // the pen waiting to tick something off wins over "open at the tracked quest" (J, the inspect pick)
    const fr = this.built.fresh;
    if (fr && A[fr] !== undefined && !o.entry && !o.person && (!o.page || o.page === 'quests') && (!o.quest || o.quest === trackedQuest()?.id)) return A[fr];
    if (o.quest && A['q:' + o.quest] !== undefined) return A['q:' + o.quest];
    if (o.entry && A[o.entry] !== undefined) return A[o.entry];
    if (o.person && A['p:' + o.person] !== undefined) return A['p:' + o.person];
    const pg = o.page === 'notes' || o.page === 'journal' ? 'quests' : o.page === 'ency' || o.page === 'encyclopedia' ? 'guide' : o.page;
    if (pg && pg !== 'quests') return A[pg] ?? S[pg] ?? null;
    // the quests: a page with the pen waiting on it, else the tracked quest, else the list
    if (this.built.fresh && A[this.built.fresh] !== undefined) return A[this.built.fresh];
    const tq = trackedQuest();
    if (tq && A['q:' + tq.id] !== undefined) return A['q:' + tq.id];
    return S.quests ?? 1;
  }
  goto(o: NotebookOpts) {
    const s = this.slotFor(o);
    if (s === null) return;
    if (this.phase !== 'open') { this.target = s; return; }
    this.flipTo(this.posOf(s));
  }

  private tex(slot: number): Art | null {
    const p = this.built.slots[slot];
    if (!p) return null;
    const side = this.sideOf(slot);
    const live = this.running?.slot === slot;
    const key = `${p.id}|${side}`;
    if (!live) { const c = this.cache.get(key); if (c) return c; }
    const a = this.paintPage(p, slot, side);
    if (!live) { this.cache.set(key, a); if (this.cache.size > 80) this.cache.delete(this.cache.keys().next().value!); }
    return a;
  }
  private paintPage(p: Page, slot: number, side: 'l' | 'r'): Art {
    const a = new Art(PW, PH);
    a.d.set(p.art ? p.art().d : paperArt(p.paper, p.seed, side, 1).d);
    if (!p.art) {
      if (p.head) { const t = p.head.toUpperCase(); const w = handW(t, { block: true, spacing: 1 }); hand(a, t, side === 'r' ? PW - 12 - w : 14, 15, C.pencilLt, { block: true, spacing: 1, bold: false }); }
      if (p.num) { const t = String(p.num); hand(a, t, Math.round(PW / 2 - handW(t) / 2), PH - 7, C.pencil, { pencil: true }); }
    }
    const ctx: Ctx = {
      a, time: this.t,
      anim: key => (this.doneAnims.has(key) ? 1 : this.running?.key === key ? Math.min(1, (this.t - this.running.t0) / this.running.dur) : this.pending.has(key) ? 0 : 1),
      pen: (x, y, tool) => { this.penAt = { slot, x, y, tool: tool ?? 'pen' }; },
      pic: (key, load) => this.pic(key, load, p.id),
      pageNo: anchor => this.built.anchors[anchor] ?? null,
    };
    for (const op of p.ops) { try { op(ctx); } catch (e) { console.error('[notebook page]', p.id, e); } }
    // what Mori drew on it
    const L = this.layer(p.id);
    if (L) {
      const pen = C.ink, pencil = C.pencil;
      for (let i = 0; i < L.length; i++) {
        const v = L[i];
        if (!v) continue;
        const x = i % PW, y = (i / PW) | 0;
        if (v === 2) a.d[i] = pen; else if (hash2(x, y, 31) >= 0.16) a.d[i] = pencil;
      }
    }
    return a;
  }
  private pic(key: string, load: () => Promise<Art | null>, pageId: string): Art | null {
    if (this.pics.has(key)) return this.pics.get(key) ?? null;
    let set = this.picPages.get(key);
    if (!set) {
      set = new Set();
      this.picPages.set(key, set);
      void load().catch(() => null).then(a => {
        this.pics.set(key, a);
        for (const id of this.picPages.get(key) ?? []) for (const k of [...this.cache.keys()]) if (k.startsWith(id + '|')) this.cache.delete(k);
        this.dirty = true;
      });
    }
    set.add(pageId);
    return null;
  }
  private layer(id: string): Uint8Array | null {
    let L = this.layers.get(id);
    if (L) return L;
    const s = nbSave().draw[id];
    if (!s) return null;
    const st = decodeStrokes(s);
    this.strokes.set(id, st);
    L = new Uint8Array(PW * PH);
    for (const k of st) rasterStroke(L, PW, PH, k);
    this.layers.set(id, L);
    return L;
  }
  private dropPage(id: string) { for (const k of [...this.cache.keys()]) if (k.startsWith(id + '|')) this.cache.delete(k); }

  // ------------------------------------------------------------ the loop

  private loop = (now: number) => {
    if (this.dead) return;
    // (window.__nbSlow slows the notebook's clock: for capturing the animations frame by frame)
    const dt = Math.min(0.05, (now - this.last) / 1000) * ((window as unknown as { __nbSlow?: number }).__nbSlow ?? 1);
    this.last = now;
    this.t += dt;
    this.update(dt);
    if (this.dirty) { this.dirty = false; this.render(); }
    requestAnimationFrame(this.loop);
  };

  private openT = 0;
  private shown = false;
  private coveredOn = false;
  private putting = false;
  private who: { p: Holder; prev: string | null } | null = null;
  private update(dt: number) {
    const R = reduced();
    // opening: up out of the pocket, the band off, the cover over
    if (this.phase === 'opening') {
      const t0 = this.openT;
      this.openT += dt * (R ? 8 : 1);
      const t = this.openT;
      if (t0 < 0 && t >= 0 || (t0 === 0 && !this.shown)) { this.shown = true; this.bg.style.opacity = '1'; paperSfx('slide', 0.8); }
      if (t < 0) return;
      if (t >= 0.45 && !this.coveredOn) { this.coveredOn = true; game.covered++; }
      const k0 = Math.min(1, t / 0.45);
      this.slideK = backOut(k0);
      if (t > 0.45 && this.bandK === 0) audio.play('pluck', { vol: 0.35, pitch: 0.55 });
      this.bandK = Math.max(0, Math.min(1, (t - 0.45) / 0.18));
      if (t > 0.63 && this.openK === 0) paperSfx('open');
      this.openK = easeInOut(Math.max(0, Math.min(1, (t - 0.63) / 0.5)));
      this.dirty = true;
      if (t >= 1.13) {
        this.phase = 'open';
        this.slideK = 1; this.bandK = 1; this.openK = 1;
        this.hint = { text: matchMedia('(pointer: coarse)').matches ? 'swipe to turn · tap outside to put it away' : 'drag a corner to turn · Esc puts it away', until: this.t + 5 };
        if (this.target !== null) { const s = this.target; this.target = null; this.flipTo(this.posOf(s)); }
      }
    } else if (this.phase === 'closing') {
      this.openT += dt * (R ? 8 : 1);
      const t = this.openT;
      this.openK = 1 - easeInOut(Math.min(1, t / 0.4));
      if (t > 0.4 && this.bandK === 1) audio.play('pluck', { vol: 0.3, pitch: 0.5 });
      this.bandK = 1 - Math.max(0, Math.min(1, (t - 0.4) / 0.15));
      if (t >= 0.55 && !this.putting) {
        // the world comes back as the notebook goes down, and Mori puts it away (the putNote clip)
        this.putting = true;
        if (this.coveredOn) { this.coveredOn = false; game.covered = Math.max(0, game.covered - 1); }
        const w = this.who;
        if (w && hasAnim7('putNote') && !R) {
          w.p.poseOverride = 'putNote';
          audio.play('rustle', { vol: 0.35, pitch: 1.05 });
          setTimeout(() => { if (w.p.poseOverride === 'putNote') w.p.poseOverride = w.prev; }, clipMs('putNote'));
        } else if (w && (w.p.poseOverride === 'noteRead' || w.p.poseOverride === 'pullNote')) w.p.poseOverride = w.prev;
      }
      const k2 = Math.max(0, Math.min(1, (t - 0.55) / 0.32));
      this.slideK = 1 - k2 * k2;
      this.dirty = true;
      if (t >= 0.9) { this.finish(); return; }
    }
    // the gentle bob of a book held in two hands
    const b = this.phase === 'open' ? Math.round(Math.sin(this.t * 1.9) * 0.9) : 0;
    if (b !== this.bobY) { this.bobY = b; this.dirty = true; }
    // a page turning
    const T = this.turn;
    if (T?.anim) {
      const k = Math.min(1, (this.t - T.anim.t0) / T.anim.dur);
      const e = T.peek ? easeOut(k) : easeInOut(k);
      T.P = [T.anim.a[0] + (T.anim.b[0] - T.anim.a[0]) * e, T.anim.a[1] + (T.anim.b[1] - T.anim.a[1]) * e - Math.sin(Math.PI * e) * T.anim.lift];
      this.dirty = true;
      if (k >= 1) {
        const { commit, drop } = T.anim;
        T.anim = null;
        if (!T.peek || commit || drop) {
          if (commit) this.pos = T.to;
          this.turn = null;
          const nx = this.queue.shift();
          if (nx !== undefined) this.startTurn(nx, true);
        }
      }
    }
    // the pen ticking things off on the pages in view
    if (this.phase === 'open' && !this.turn) {
      if (this.running) {
        const k = (this.t - this.running.t0) / this.running.dur;
        if (k >= 0.5 && !this.running.stamped && this.running.key.startsWith('done:')) { this.running.stamped = true; paperSfx('stamp'); }
        if (k >= 1) {
          this.doneAnims.add(this.running.key);
          this.pending.delete(this.running.key);
          try { this.running.done?.(); } catch (e) { console.error(e); }
          this.dropPage(this.built.slots[this.running.slot]?.id ?? '');
          this.running = null;
          this.penAt = null;
        }
        this.dirty = true;
      } else this.nextAnim();
    }
    if (this.hint && this.t > this.hint.until) { this.hint = null; this.dirty = true; }
    // save drawings a moment after the pen lifts
    if (this.saveT > 0) { this.saveT -= dt; if (this.saveT <= 0) game.persist(); }
  }
  private nextAnim() {
    for (const slot of this.visibleSlots()) {
      const p = this.built.slots[slot];
      if (!p) continue;
      for (const a of p.anims) {
        if (this.doneAnims.has(a.key)) continue;
        this.running = { key: a.key, slot, t0: this.t + 0.25, dur: a.dur, done: a.done };
        if (a.sound === 'pencil' || a.sound === 'tick') setTimeout(() => paperSfx('pencil', 0.8), 250);
        this.dirty = true;
        return;
      }
    }
  }

  // ------------------------------------------------------------ turning

  /** turn to a position (several pages away: riffle through) */
  private flipTo(p: number) {
    p = Math.max(0, Math.min(this.maxPos(), p));
    if (p === this.pos && !this.turn) return;
    if (this.turn && !this.turn.peek) { this.queue = [p]; return; }
    this.turn = null;
    const d = p - this.pos;
    if (Math.abs(d) <= 1) { this.queue = []; this.startTurn(p, false); return; }
    paperSfx('riffle');
    const n = Math.min(4, Math.abs(d));
    const q: number[] = [];
    for (let i = 1; i <= n; i++) q.push(this.pos + Math.round((d * i) / n));
    this.queue = q.slice(1);
    this.startTurn(q[0], true);
  }
  private makeTurn(to: number, G0: V2): Turn | null {
    const from = this.pos;
    if (to === from || to < 0 || to > this.maxPos()) return null;
    const dir: 1 | -1 = to > from ? 1 : -1;
    let lu: Art | null, ru: Art | null, front: Art, back: Art;
    if (this.spread) {
      const [fl, fr] = this.visibleSlots(from), [tl, tr] = this.visibleSlots(to);
      if (dir > 0) { lu = this.tex(fl); ru = this.tex(tr); front = this.tex(fr) ?? blank(); back = this.tex(tl) ?? blank(); }
      else { lu = this.tex(tl); ru = this.tex(fr); front = this.tex(tr) ?? blank(); back = this.tex(fl) ?? blank(); }
    } else {
      if (dir > 0) { lu = null; ru = this.tex(to); front = this.tex(from) ?? blank(); }
      else { lu = null; ru = this.tex(from); front = this.tex(to) ?? blank(); }
      back = showThrough(front, (dir > 0 ? from : to) * 7 + 3);
    }
    const P: V2 = dir > 0 ? [G0[0], G0[1]] : [-G0[0], G0[1]];
    return { dir, to, lu, ru, front, back, G0, P, drag: false, peek: false, anim: null };
  }
  private startTurn(to: number, fast: boolean) {
    const G0: V2 = [PW - 1, PH - 8];
    const T = this.makeTurn(to, G0);
    if (!T) return;
    this.turn = T;
    const a: V2 = [...T.P] as V2, b: V2 = T.dir > 0 ? [-(PW - 1), PH - 8] : [G0[0], G0[1]];
    T.anim = { a, b, t0: this.t, dur: reduced() ? 0.05 : fast ? 0.16 : 0.5, lift: fast ? PH * 0.08 : PH * 0.16, commit: true };
    if (!fast) paperSfx('flip');
    this.dirty = true;
  }

  // ------------------------------------------------------------ drawing the frame

  private render() {
    const F = this.F;
    F.d.fill(0);
    const { spine, top } = this.geo();
    const vs = this.visibleSlots();
    const total = this.built.slots.length;
    const shut = this.openK < 0.5;
    const th = this.openK * Math.PI, cth = Math.cos(th);
    // book extents
    const rightW = PW + SMAX + BR, leftOpen = this.spread && !shut;
    const bx0 = leftOpen ? spine - rightW : spine - 1, bx1 = spine + rightW, by0 = top - BR, by1 = top + PH + SMAX + BR;
    // a hard dithered shadow on the scene
    const sh = col('#000000', 0.55);
    for (let y = by0 + 5; y < by1 + 6; y++) for (let x = bx0 + 4; x < bx1 + 5; x++) if (dith(x, y, 0.5)) F.px(x, y, sh);
    // the stacks of pages (thicker on the side that has more of the book)
    const remR = this.spread ? total - (vs[1] + 1) : total - (vs[0] + 1);
    const remL = this.spread ? vs[0] : 0;
    const thick = (n: number) => (n <= 0 ? 0 : Math.max(1, Math.min(SMAX, Math.ceil((n / Math.max(12, total)) * SMAX * 1.6))));
    const tR = thick(remR), tL = thick(remL);
    // the boards
    this.blitArt(this.board(rightW, PH + SMAX + 2 * BR), spine - 1, top - BR);
    if (leftOpen) this.blitArt(this.board(rightW, PH + SMAX + 2 * BR), spine - rightW, top - BR);
    if (!shut || cth < 0.999) {
      this.stack(spine, top, tR, 1);
      if (leftOpen) this.stack(spine, top, tL, -1);
    }
    // the pages
    if (shut) {
      // the right page under the cover as it lifts
      const rs = this.spread ? vs[1] : vs[0];
      const r = this.tex(rs);
      if (r && cth < 0.999) this.blitArt(r, spine, top);
      this.drawCover(spine, top, cth);
    } else if (this.openK < 1) {
      const r = this.tex(this.spread ? vs[1] : vs[0]);
      if (r) this.blitArt(r, spine, top);
      if (this.spread) this.drawInsideSwing(spine, top, -cth, this.tex(vs[0]));
    } else if (this.turn) {
      this.drawTurn(spine, top, this.turn);
    } else {
      if (this.spread) { const l = this.tex(vs[0]); if (l) this.blitArt(l, spine - PW, top); }
      const r = this.tex(this.spread ? vs[1] : vs[0]);
      if (r) this.blitArt(r, spine, top);
    }
    // the crease of the binding
    if (this.spread && !shut) for (let y = top; y < top + PH; y++) { F.px(spine - 1, y, col('#2a1608', 0.55)); if (dith(spine, y, 0.5)) F.px(spine, y, col('#2a1608', 0.3)); }
    this.hits = [];
    if (this.openK >= 1) {
      this.drawRibbon(spine, top, vs);
      this.drawTabs(spine, top, vs, tR, tL);
    }
    if (this.openK > 0.6) this.drawTools(spine, top);
    // the pen at work
    if (this.penAt && this.running && this.openK >= 1 && !this.turn && this.penAt.tool !== 'stamp') {
      const s = this.penAt.slot;
      const px = this.spread && s % 2 === 0 ? spine - PW : spine;
      this.drawHeld(this.penAt.tool === 'pencil' ? 'pencil' : 'pen', px + this.penAt.x, top + this.penAt.y, 0);
    }
    // Mori's hands
    this.drawHands(leftOpen ? bx0 : spine - 1, bx1, by1, shut);
    // the tool in hand follows the pointer
    if (this.tool && this.ptr && this.phase === 'open') this.drawHeld(this.tool, this.ptr[0], this.ptr[1], this.stroke ? 0 : 2);
    if (this.hint) {
      const t = this.hint.text, w = handW(t);
      const y = Math.min(this.CH - 6, by1 + 18);
      outlined(F, t, Math.round(this.CW / 2 - w / 2), y, col('#f4e6c4'));
    }
    this.g.putImageData(F.img, 0, 0);
  }

  private blitArt(src: Art, x: number, y: number) {
    const F = this.F, W = F.w, H = F.h;
    for (let j = 0; j < src.h; j++) {
      const Y = y + j;
      if (Y < 0 || Y >= H) continue;
      const row = j * src.w, frow = Y * W;
      for (let i = 0; i < src.w; i++) {
        const X = x + i;
        if (X < 0 || X >= W) continue;
        const c = src.d[row + i];
        const a = c >>> 24;
        if (a === 255) F.d[frow + X] = c; else if (a) F.px(X, Y, c);
      }
    }
  }
  /** a plain leather board (the back, or the front lying open), stitched round */
  private board(w: number, h: number): Art {
    const k = `${w}x${h}`;
    let a = this.boardCache.get(k);
    if (a) return a;
    a = new Art(w, h);
    const tile = leatherArt();
    const base = col(COVER_HEX), out = mixC(base, col('#000000'), 0.66), lt = mixC(base, col('#ffffff'), 0.2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const corner = (x < 2 || x > w - 3) && (y < 2 || y > h - 3);
      if (corner && (x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      let c = tile.d[(y & 127) * 128 + (x & 127)];
      if (e) c = out; else if (x === 1 || y === 1) c = mixC(c, lt, 0.4);
      a.put(x, y, c);
    }
    this.boardCache.set(k, a);
    return a;
  }
  /** page edges under the top page: dir 1 the right block, -1 the left */
  private stack(spine: number, top: number, t: number, dir: 1 | -1) {
    const F = this.F;
    const cs = [col('#e8dcbc'), col('#cdb88e'), col('#efe4c8'), col('#bca67c')];
    for (let i = t; i >= 1; i--) {
      const c = i === t ? col('#9a8058') : cs[i % 4];
      if (dir > 0) { F.rect(spine + PW - 1 + i, top + i, 1, PH, c); F.rect(spine, top + PH - 1 + i, PW + i, 1, c); }
      else { F.rect(spine - PW - i, top + i, 1, PH, c); F.rect(spine - PW - i, top + PH - 1 + i, PW + i, 1, c); }
    }
  }
  /** the front cover over the right block, squashed toward the spine as it lifts (c = cos of its angle) */
  private coverArtC: Art | null = null;
  private drawCover(spine: number, top: number, c: number) {
    const cw = PW + SMAX + BR + 1, ch = PH + SMAX + 2 * BR;
    if (!this.coverArtC) this.coverArtC = coverArt(cw, ch);
    const src = this.coverArtC;
    const w = Math.max(1, Math.round(cw * c));
    const F = this.F, x0 = spine - 1, y0 = top - BR;
    const dk = (1 - c) * 0.55;
    for (let j = 0; j < ch; j++) {
      const Y = y0 + j;
      if (Y < 0 || Y >= F.h) continue;
      for (let i = 0; i < w; i++) {
        const X = x0 + i;
        if (X < 0 || X >= F.w) continue;
        let v = src.d[j * cw + Math.min(cw - 1, Math.floor(((i + 0.5) / w) * cw))];
        if (!(v >>> 24)) continue;
        if (dk > 0.02 && dith(X, Y, dk)) v = mixC(v, SHADE, 0.5);
        F.d[Y * F.w + X] = v;
      }
    }
    // the elastic band (snapping off to the right)
    if (this.bandK < 1 && c > 0.95) {
      const band = bandArt(ch + 4);
      const bx = x0 + cw - 16 + Math.round(this.bandK * 26);
      for (let j = 0; j < band.h; j++) for (let i = 0; i < band.w; i++) {
        const v = band.d[j * band.w + i];
        if (v >>> 24 && (this.bandK < 0.5 || dith(bx + i, y0 - 2 + j, 1 - (this.bandK - 0.5) * 2))) F.px(bx + i, y0 - 2 + j, v);
      }
    }
  }
  /** the cover (with the pages before this spread) landing on the left: its inside is the left page */
  private drawInsideSwing(spine: number, top: number, c: number, left: Art | null) {
    const F = this.F;
    const bw = PW + SMAX + BR, w = Math.max(1, Math.round(bw * c));
    const board = this.board(bw, PH + SMAX + 2 * BR);
    const pw = Math.max(1, Math.round(PW * c));
    const dk = (1 - c) * 0.5;
    for (let j = 0; j < board.h; j++) {
      const Y = top - BR + j;
      if (Y < 0 || Y >= F.h) continue;
      for (let i = 0; i < w; i++) {
        const X = spine - w + i;
        if (X < 0 || X >= F.w) continue;
        let v = board.d[j * bw + Math.min(bw - 1, Math.floor(((i + 0.5) / w) * bw))];
        // the page on it
        const pi = i - (w - pw), pj = j - BR;
        if (left && pi >= 0 && pj >= 0 && pj < PH) { const pv = left.d[pj * PW + Math.min(PW - 1, Math.floor(((pi + 0.5) / pw) * PW))]; if (pv >>> 24) v = pv; }
        if (!(v >>> 24)) continue;
        if (dk > 0.02 && dith(X, Y, dk)) v = mixC(v, SHADE, 0.5);
        F.d[Y * F.w + X] = v;
      }
    }
  }

  /** the curl: the sheet wraps round a cylinder whose axis is the fold between where its corner was
   *  (G0) and where it is now (P); right-page coordinates, origin at the top of the spine */
  private drawTurn(spine: number, top: number, T: Turn) {
    const F = this.F;
    if (T.lu && this.spread) this.blitArt(T.lu, spine - PW, top);
    if (T.ru) this.blitArt(T.ru, spine, top);
    const [gx, gy] = T.G0, [px, py] = T.P;
    let dx = gx - px, dy = gy - py;
    const L = Math.hypot(dx, dy);
    if (L < 0.75) { this.blitArt(T.front, spine, top); return; }
    dx /= L; dy /= L;
    const mx = (gx + px) / 2, my = (gy + py) / 2;
    const f = Math.min(1, L / (2 * PW));
    const R = Math.max(0.01, PW * 0.1 * Math.pow(Math.sin(Math.PI * f), 0.8));
    const PIR = Math.PI * R, HALF = Math.PI / 2;
    const xMin = this.spread ? -PW - 12 : -Math.min(spine, 60), xMax = PW + 12;
    const fd = T.front.d, bd = T.back.d, W = F.w;
    for (let Y = -48; Y < PH + 48; Y++) {
      const sy = top + Y;
      if (sy < 0 || sy >= F.h) continue;
      const qy = Y + 0.5;
      for (let X = xMin; X < xMax; X++) {
        const sx = spine + X;
        if (sx < 0 || sx >= W) continue;
        const qx = X + 0.5;
        const t = (qx - mx) * dx + (qy - my) * dy;
        let kind = 0, s = 0, ux = 0, uy = 0;
        if (t <= R) {
          s = t <= 0 ? PIR - t : R * (Math.PI - Math.asin(t / R));
          ux = qx + (s - t) * dx; uy = qy + (s - t) * dy;
          if (ux >= 0 && ux < PW && uy >= 0 && uy < PH) kind = t <= 0 ? 1 : 2;
          else {
            s = t <= 0 ? t : R * Math.asin(t / R);
            ux = qx + (s - t) * dx; uy = qy + (s - t) * dy;
            if (ux >= 0 && ux < PW && uy >= 0 && uy < PH) kind = t <= 0 ? 4 : 3;
          }
        }
        const i = sy * W + sx;
        if (kind === 0) {
          // the curl's shadow on the page below
          if (t > R && t < R + 18 && (F.d[i] >>> 24)) { const k = 0.6 * Math.pow(1 - (t - R) / 18, 1.5); if (dith(sx, sy, k)) F.d[i] = mixC(F.d[i], SHADE, 0.42); }
          continue;
        }
        const ix = ux | 0, iy = uy | 0;
        let c = kind <= 2 ? bd[iy * PW + (PW - 1 - ix)] : fd[iy * PW + ix];
        if (!(c >>> 24)) continue;
        if (kind === 3) { const k = 0.55 * Math.pow(s / R / HALF, 1.4); if (dith(sx, sy, k)) c = mixC(c, SHADE, 0.45); }
        else if (kind === 2) { const th = s / R; if (th < HALF + 0.5) { if (dith(sx, sy, 0.55)) c = mixC(c, WHITE, 0.35); } else if (dith(sx, sy, 0.25)) c = mixC(c, SHADE, 0.28); }
        else if (kind === 1) { if (dith(sx, sy, 0.1)) c = mixC(c, SHADE, 0.22); }
        if (kind !== 4 && (ux < 1 || ux >= PW - 1 || uy < 1 || uy >= PH - 1)) c = mixC(c, EDGE, 0.6);
        F.d[i] = c;
      }
    }
  }

  private drawRibbon(spine: number, top: number, vs: number[]) {
    const tq = trackedQuest();
    if (!tq) return;
    const s = this.built.anchors['q:' + tq.id];
    if (s === undefined) return;
    const shown = !this.turn && vs.includes(s);
    let pts: V2[];
    if (shown) {
      const left = this.spread && s % 2 === 0;
      const sx = left ? spine - 8 : spine + 8, sg = left ? -1 : 1;
      pts = [[sx, top - 2], [sx + sg * 10, top + Math.round(PH * 0.45)], [sx + sg * 6, top + PH + 2], [sx + sg * 3, top + PH + 16]];
    } else {
      const after = s > vs[vs.length - 1];
      const sx = this.spread ? spine + (after ? 22 : -22) : spine + 22;
      const sg = after ? 1 : -1;
      pts = [[sx, top + PH - 2], [sx + sg * 2, top + PH + 12], [sx + sg * 5, top + PH + 26]];
    }
    ribbonAt(this.F, pts);
    const e = pts[pts.length - 1];
    this.hits.push({ r: { x: e[0] - 5, y: e[1] - 14, w: 11, h: 16 }, act: 'goto', arg: 'q:' + tq.id });
  }
  private drawTabs(spine: number, top: number, vs: number[], tR: number, tL: number) {
    const secs = this.built.sections;
    const cur = vs[vs.length - 1];
    secs.forEach((sec, i) => {
      const st = this.built.starts[sec.id];
      if (st === undefined) return;
      const right = this.spread ? st >= vs[1] : st >= vs[0];
      const here = vs.some(v => this.built.slots[v]?.section === sec.id);
      const y = top + (this.spread ? 14 : 40) + i * 34;
      const art = tabArt(sec.color, sec.id, right ? 'r' : 'l');
      const out = here ? 3 : 0;
      const x = right ? spine + PW + (st === cur ? 0 : tR) - 4 + out : spine - (this.spread ? PW : 0) - (this.spread ? tL : 0) - art.w + 4 - out;
      if (!right && !this.spread && x < 0) return;
      this.blitArt(art, x, y);
      this.hits.push({ r: { x, y, w: art.w, h: art.h }, act: 'tab', arg: sec.id });
    });
  }
  /** the pen, the pencil and the eraser standing in the spine (unless one is in hand) */
  private toolSpots(spine: number, top: number): { kind: ToolKind; x: number; y: number; art: Art }[] {
    const base = this.spread ? spine : spine + 6;
    const ks: [ToolKind, number, number][] = [['pencil', -9, -12], ['pen', -3, -17], ['eraser', 4, -7]];
    return ks.map(([kind, dx, dy]) => { const art = toolArt(kind); return { kind, x: base + dx - (kind === 'eraser' ? 0 : 3), y: top + dy, art }; });
  }
  private drawTools(spine: number, top: number) {
    for (const t of this.toolSpots(spine, top)) {
      if (this.tool === t.kind) continue;
      this.blitArt(t.art, t.x, t.y);
      this.hits.push({ r: { x: t.x - 2, y: t.y - 2, w: t.art.w + 4, h: Math.min(t.art.h, 26) + 4 }, act: 'tool', arg: t.kind });
    }
  }
  private drawHeld(kind: ToolKind, x: number, y: number, lift: number) {
    const h = heldArt(kind);
    const ox = Math.round(x - h.tx), oy = Math.round(y - h.ty - lift);
    // its shadow on the paper, then the tool
    const sh = col('#1e1406', 0.4);
    for (let j = 0; j < h.art.h; j++) for (let i = 0; i < h.art.w; i++) if (h.art.d[j * h.art.w + i] >>> 24 && dith(ox + i + 3, oy + j + 3 + lift, 0.5)) this.F.px(ox + i + 3, oy + j + 3 + lift, sh);
    this.blitArt(h.art, ox, oy);
  }
  private drawHands(x0: number, x1: number, y1: number, shut: boolean) {
    const len = this.CH - y1 + 8;
    const k = Math.max(40, Math.ceil(len / 8) * 8);
    let h = this.handCache.get(k);
    if (!h) { h = handArt(k); this.handCache.set(k, h); }
    void shut;
    const F = this.F, a = h.art, W = a.w;
    const sh = col('#1e1406', 0.45);
    // the thumbs' hard dithered shadows on the paper, then the hands (the left one mirrored)
    const put = (mirror: boolean, ox: number, oy: number) => {
      for (let j = 0; j < a.h; j++) for (let i = 0; i < W; i++) {
        const si = mirror ? W - 1 - i : i;
        if (h!.thumb.d[j * W + si] >>> 24) { const X = ox + i + (mirror ? -3 : 3), Y = oy + j + 3; if (dith(X, Y, 0.55)) F.px(X, Y, sh); }
      }
      for (let j = 0; j < a.h; j++) for (let i = 0; i < W; i++) {
        const v = a.d[j * W + (mirror ? W - 1 - i : i)];
        if (v >>> 24) F.px(ox + i, oy + j, v);
      }
    };
    put(false, x1 - h.ax, y1 - h.ay);
    put(true, x0 - (W - 1 - h.ax), y1 - h.ay);
  }

  // ------------------------------------------------------------ input

  private toArt(e: PointerEvent | MouseEvent): V2 {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / this.cs, (e.clientY - r.top) / this.cs];
  }
  /** the page (slot and page coordinates) under an art point */
  private pageAt(x: number, y: number): { slot: number; px: number; py: number } | null {
    const { spine, top } = this.geo();
    const vs = this.visibleSlots();
    const py = Math.floor(y - top);
    if (py < 0 || py >= PH) return null;
    if (this.spread && x >= spine - PW && x < spine) return { slot: vs[0], px: Math.floor(x - (spine - PW)), py };
    if (x >= spine && x < spine + PW) return { slot: this.spread ? vs[1] : vs[0], px: Math.floor(x - spine), py };
    return null;
  }
  private bindInput() {
    const el = this.root;
    el.addEventListener('pointerdown', e => this.onDown(e));
    el.addEventListener('pointermove', e => this.onMove(e));
    el.addEventListener('pointerup', e => this.onUp(e));
    el.addEventListener('pointercancel', e => this.onUp(e));
    el.addEventListener('pointerleave', () => { this.ptr = null; this.unpeek(); this.dirty = true; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    this.popKeys = pushKeys(e => this.onKey(e));
  }
  private onKey(e: KeyboardEvent): boolean {
    if (this.phase !== 'open') return true;
    const c = e.code;
    if ((e.ctrlKey || e.metaKey) && c === 'KeyZ') { this.undo(); return true; }
    const tabKey: Record<string, string> = { KeyJ: 'quests', KeyG: 'guide', KeyK: 'people', KeyM: 'map' };
    if (c === 'Escape' || c === 'Tab') { void this.close(); return true; }
    if (tabKey[c]) {
      const vs = this.visibleSlots();
      const inIt = vs.some(v => this.built.slots[v]?.section === tabKey[c]);
      if (inIt && c === this.openKey) void this.close(); else this.goto({ page: tabKey[c] });
      return true;
    }
    if (c === 'ArrowRight' || c === 'KeyD' || c === 'PageDown') { this.flipTo(this.pos + 1); return true; }
    if (c === 'ArrowLeft' || c === 'KeyA' || c === 'PageUp') { this.flipTo(this.pos - 1); return true; }
    if (c === 'Home') { this.flipTo(0); return true; }
    if (c === 'End') { this.flipTo(this.maxPos()); return true; }
    const dg = /^Digit([1-5])$/.exec(c);
    if (dg) { const s = this.built.sections[+dg[1] - 1]; if (s) this.goto({ page: s.id }); return true; }
    if (c === 'KeyP') { this.takeTool(this.tool === 'pencil' ? null : 'pencil'); return true; }
    if (c === 'KeyE' && this.tool) { this.takeTool(this.tool === 'eraser' ? 'pencil' : 'eraser'); return true; }
    return true;
  }
  private takeTool(k: ToolKind | null) {
    if (k === this.tool) k = null;
    this.tool = k;
    this.root.style.cursor = k ? 'none' : '';
    if (k) { audio.play('pluck', { vol: 0.15, pitch: 1.6 }); this.hint = { text: k === 'eraser' ? 'erasing · put it back in the spine when done' : `drawing with the ${k} · put it back in the spine when done`, until: this.t + 3.5 }; }
    else paperSfx('slide', 0.4);
    this.dirty = true;
  }
  private onDown(e: PointerEvent) {
    const [x, y] = this.toArt(e);
    this.ptr = [x, y];
    if (this.phase !== 'open') return;
    try { this.root.setPointerCapture(e.pointerId); } catch { /* */ }
    // tools, tabs, the ribbon
    for (const h of this.hits) {
      if (!inR(h.r, x, y)) continue;
      if (h.act === 'tool') { this.takeTool(h.arg as ToolKind); return; }
      if (this.stroke) return;
      if (h.act === 'tab') { this.goto({ page: h.arg }); paperSfx('flip', 0.5); return; }
      if (h.act === 'goto') { this.gotoAnchor(h.arg ?? ''); return; }
    }
    if (this.turn && !this.turn.peek) return;
    const pg = this.pageAt(x, y);
    // drawing
    if (this.tool) {
      if (pg && this.openK >= 1 && !this.turn) {
        const id = this.built.slots[pg.slot]?.id;
        if (!id) return;
        this.stroke = { slot: pg.slot, id, tool: this.tool, pts: [pg.px, pg.py] };
        this.inkSeg(this.stroke, pg.px, pg.py, pg.px, pg.py);
        return;
      }
      // put the tool back by clicking off the pages near the spine
      if (!pg) { const { spine, top } = this.geo(); if (Math.abs(x - spine) < 20 && y < top + 4) { this.takeTool(null); return; } }
    }
    // links on the page
    if (pg && !this.tool) {
      const p = this.built.slots[pg.slot];
      const hit = p?.hits.find(h => pg.px >= h.x && pg.py >= h.y && pg.px < h.x + h.w && pg.py < h.y + h.h);
      if (hit) { this.act(hit.act, hit.arg); return; }
    }
    const { spine, top } = this.geo();
    const zone = this.zoneAt(x, y, spine, top);
    if (!pg && !zone && !this.tool) {
      // off the book: put it away
      if (!this.inBook(x, y)) { void this.close(); return; }
    }
    this.down = { x, y, t: this.t, id: e.pointerId, zone: zone ?? (pg ? 'page' : null), moved: false, touch: e.pointerType === 'touch' };
    this.vel = { x, t: performance.now(), vx: 0 };
  }
  private inBook(x: number, y: number) {
    const { spine, top } = this.geo();
    const x0 = this.spread ? spine - PW - SMAX - BR - 16 : spine - 16, x1 = spine + PW + SMAX + BR + 16;
    return x >= x0 && x < x1 && y >= top - 24 && y < top + PH + 30;
  }
  private zoneAt(x: number, y: number, spine: number, top: number): 'fwd' | 'back' | null {
    if (y < top - 4 || y > top + PH + SMAX + 4) return null;
    const edge = PW * 0.26;
    if (x >= spine + PW - edge && x < spine + PW + SMAX + 6) return this.pos < this.maxPos() ? 'fwd' : null;
    if (this.spread && x < spine - PW + edge && x >= spine - PW - SMAX - 6) return this.pos > 0 ? 'back' : null;
    if (!this.spread && x >= spine - 6 && x < spine + edge * 0.8) return this.pos > 0 ? 'back' : null;
    return null;
  }
  private onMove(e: PointerEvent) {
    const [x, y] = this.toArt(e);
    this.ptr = [x, y];
    if (this.tool) this.dirty = true;
    if (this.phase !== 'open') return;
    if (this.stroke) {
      const pg = this.pageAt(x, y);
      const { spine, top } = this.geo();
      const s = this.stroke;
      const left = this.spread && s.slot % 2 === 0;
      const px = Math.max(0, Math.min(PW - 1, Math.floor(x - (left ? spine - PW : spine)))), py = Math.max(0, Math.min(PH - 1, Math.floor(y - top)));
      const lx = s.pts[s.pts.length - 2], ly = s.pts[s.pts.length - 1];
      if (px !== lx || py !== ly) {
        s.pts.push(px, py);
        this.inkSeg(s, lx, ly, px, py);
        if (Math.random() < 0.08) paperSfx('tick', 0.25);
      }
      void pg;
      return;
    }
    const d = this.down;
    const { spine, top } = this.geo();
    if (d && e.pointerId === d.id) {
      const now = performance.now();
      const dtm = Math.max(1, now - this.vel.t);
      this.vel = { x, t: now, vx: ((x - this.vel.x) / dtm) * 1000 * 0.5 + this.vel.vx * 0.5 };
      if (!d.moved && Math.hypot(x - d.x, y - d.y) > 3) {
        d.moved = true;
        // a drag from an edge picks the sheet up
        const z = d.zone === 'page' ? (d.touch ? null : null) : d.zone;
        if (z && (!this.turn || this.turn.peek)) {
          const to = this.pos + (z === 'fwd' ? 1 : -1);
          const gy = Math.max(4, Math.min(PH - 4, d.y - top));
          const T = this.turn?.peek && this.turn.dir === (z === 'fwd' ? 1 : -1) ? this.turn : this.makeTurn(to, [PW - 1, gy]);
          if (T) { T.peek = false; T.drag = true; T.anim = null; this.turn = T; paperSfx('flip', 0.35); }
        }
      }
      if (this.turn?.drag) { this.turn.P = constrain(this.turn.G0, [x - spine, y - top]); this.dirty = true; }
      return;
    }
    // hovering near a corner: the page peels up a little
    const z = this.tool ? null : this.zoneAt(x, y, spine, top);
    const nearCorner = z && y > top + PH * 0.55;
    this.root.style.cursor = this.tool ? 'none' : z || this.hits.some(h => inR(h.r, x, y)) || this.linkAt(x, y) ? 'pointer' : '';
    if (nearCorner && !this.turn) {
      const T = this.makeTurn(this.pos + (z === 'fwd' ? 1 : -1), [PW - 1, PH - 8]);
      if (T) {
        T.peek = true;
        const a: V2 = [...T.P] as V2, b: V2 = z === 'fwd' ? [PW - 16, PH - 18] : [-(PW - 16), PH - 18];
        T.anim = { a, b, t0: this.t, dur: 0.22, lift: 0, commit: false };
        this.turn = T;
      }
    } else if (!nearCorner) this.unpeek();
  }
  private linkAt(x: number, y: number) {
    const pg = this.pageAt(x, y);
    if (!pg) return false;
    return !!this.built.slots[pg.slot]?.hits.some(h => pg.px >= h.x && pg.py >= h.y && pg.px < h.x + h.w && pg.py < h.y + h.h);
  }
  private unpeek() {
    const T = this.turn;
    if (!T || !T.peek || T.anim?.drop) return;
    const rest: V2 = T.dir > 0 ? [T.G0[0], T.G0[1]] : [-T.G0[0], T.G0[1]];
    T.anim = { a: [...T.P] as V2, b: rest, t0: this.t, dur: 0.18, lift: 0, commit: false, drop: true };
  }
  private onUp(e: PointerEvent) {
    if (this.stroke) { this.endStroke(); return; }
    const d = this.down;
    this.down = null;
    if (!d || e.pointerId !== d.id) return;
    const T = this.turn;
    if (T?.drag) {
      T.drag = false;
      const vx = this.vel.vx;
      const fwd = T.dir > 0;
      const commit = fwd ? T.P[0] < 0 || vx < -260 : T.P[0] > 0 || vx > 260;
      const flat: V2 = fwd ? (commit ? [-(PW - 1), T.G0[1]] : [T.G0[0], T.G0[1]]) : (commit ? [T.G0[0], T.G0[1]] : [-(PW - 1), T.G0[1]]);
      T.anim = { a: [...T.P] as V2, b: flat, t0: this.t, dur: 0.28, lift: 6, commit };
      if (commit) paperSfx('flip', 0.7);
      return;
    }
    if (d.moved) {
      // a swipe across the page
      const [x] = this.toArt(e);
      const dx = x - d.x;
      if (Math.abs(dx) > 24 && this.t - d.t < 0.6) this.flipTo(this.pos + (dx < 0 ? 1 : -1));
      return;
    }
    // a click on an edge turns
    if (d.zone === 'fwd') this.flipTo(this.pos + 1);
    else if (d.zone === 'back') this.flipTo(this.pos - 1);
    else if (d.zone === 'page' && !this.spread && d.touch) {
      // one page on a phone: a tap on its outer third turns
      const { spine } = this.geo();
      if (d.x > spine + PW * 0.66) this.flipTo(this.pos + 1); else if (d.x < spine + PW * 0.2) this.flipTo(this.pos - 1);
    }
  }
  private act(act: string, arg?: string) {
    if (act === 'goto' && arg) { this.gotoAnchor(arg); return; }
    if (act === 'track' && arg) {
      game.save.tracked = arg;
      game.persist();
      paperSfx('pencil');
      this.rebuild(true);
      this.dirty = true;
    }
  }
  private gotoAnchor(a: string) {
    const s = this.built.anchors[a];
    if (s === undefined) return;
    this.flipTo(this.posOf(s));
  }

  // ------------------------------------------------------------ drawing on the pages

  private inkSeg(s: Stroke, x0: number, y0: number, x1: number, y1: number) {
    let L = this.layers.get(s.id) ?? this.layer(s.id);
    if (!L) { L = new Uint8Array(PW * PH); this.layers.set(s.id, L); }
    rasterStroke(L, PW, PH, { tool: s.tool, pts: [x0, y0, x1, y1] });
    this.dropPage(s.id);
    this.dirty = true;
  }
  private endStroke() {
    const s = this.stroke!;
    this.stroke = null;
    const st: InkStroke = { tool: s.tool, pts: simplify(s.pts, 0.5) };
    const list = this.strokes.get(s.id) ?? decodeStrokes(nbSave().draw[s.id]);
    list.push(st);
    while (list.length > MAX_STROKES) list.shift();
    this.strokes.set(s.id, list);
    this.commitInk(s.id, list);
    this.lastStroke = s.id;
    // a sketch page drawn on: keep two blank ones after it
    const m = /^s:(\d+)$/.exec(s.id);
    if (m) { const S = nbSave(); if (+m[1] + 2 > S.sketches) { S.sketches = +m[1] + 2; this.rebuild(true); } }
  }
  private commitInk(id: string, list: InkStroke[]) {
    const S = nbSave();
    const enc = encodeStrokes(list);
    if (enc) S.draw[id] = enc; else delete S.draw[id];
    // replay what was kept so the page matches the save
    const L = new Uint8Array(PW * PH);
    for (const k of decodeStrokes(enc)) rasterStroke(L, PW, PH, k);
    this.layers.set(id, L);
    this.dropPage(id);
    this.saveT = 0.8;
    this.dirty = true;
  }
  private undo() {
    const id = this.lastStroke;
    if (!id) return;
    const list = this.strokes.get(id);
    if (!list?.length) return;
    list.pop();
    this.commitInk(id, list);
    paperSfx('slide', 0.3);
  }

  // ------------------------------------------------------------ closing

  async close() {
    if (this.phase !== 'open') return;
    if (this.stroke) this.endStroke();
    this.tool = null;
    this.root.style.cursor = '';
    this.turn = null; this.queue = [];
    this.phase = 'closing';
    this.openT = 0;
    this.hint = null;
    paperSfx('close');
    this.bg.style.opacity = '0';
    await this.closed;
  }
  private finish() {
    if (this.dead) return;
    this.dead = true;
    this.popKeys();
    this.offMark();
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    if (this.coveredOn) { this.coveredOn = false; game.covered = Math.max(0, game.covered - 1); }
    const w = this.who;
    if (w && !this.putting && (w.p.poseOverride === 'noteRead' || w.p.poseOverride === 'pullNote')) w.p.poseOverride = w.prev;
    guardInput(300);
    if (this.saveT > 0) game.persist();
    this.closedRes();
  }
}

/** keep the sheet bound at the spine: the corner can't get further from the spine's ends than it was */
function constrain(G0: V2, P: V2): V2 {
  let [x, y] = P;
  for (const S of [[0, 0], [0, PH]] as V2[]) {
    const r = Math.hypot(G0[0] - S[0], G0[1] - S[1]), d = Math.hypot(x - S[0], y - S[1]);
    if (d > r) { x = S[0] + ((x - S[0]) * r) / d; y = S[1] + ((y - S[1]) * r) / d; }
  }
  return [x, y];
}
let blankArt: Art | null = null;
const blank = () => (blankArt ??= paperArt('plain', 1, 'r', 1));
const toolArts = new Map<ToolKind, Art>();
const toolArt = (k: ToolKind) => { let a = toolArts.get(k); if (!a) { a = toolStandArt(k); toolArts.set(k, a); } return a; };
const heldArts = new Map<ToolKind, ReturnType<typeof toolHoldArt>>();
const heldArt = (k: ToolKind) => { let a = heldArts.get(k); if (!a) { a = toolHoldArt(k); heldArts.set(k, a); } return a; };
void DIM;
