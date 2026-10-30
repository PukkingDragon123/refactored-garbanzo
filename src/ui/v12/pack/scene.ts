// V12 Backpack: Mori's pack lifts off his back and hangs open in the air beside him, over the world
// (src/ui/v12/pack/art.ts paints it). The world stays there behind it, dimmed by a dither (never
// blurred). No panels: the pack itself and the things in it.
//
//  - the block space: fifteen compartments sewn into the lining (5 x 3). Every item takes its
//    footprint (src/game/v11/footprints.ts) and is drawn with its own artwork. Drag it to move it;
//    turn it with R, a right click, the wheel, a second finger (twist), or the brass swivel hanging
//    off the front of the pack. Drop a stack on the same thing to top it up
//  - drag something out of the pack and let go: it drops to the ground at Mori's feet, in the world
//    (src/game/v11/ground.ts). Whatever lies there shows by his feet, ready to be dragged back in
//  - tools never take a compartment: they hang in the webbing loops inside the flap
//  - pick something and its name floats beside the pack in the bitmap hand, with a line about it and
//    the action words (EAT, TURN, DROP, and whatever other modules registered: COOK, THROW), a dotted
//    line to the item. Words only: no cards, no boxes
//  - the physical buttons: the swivel (turn), the flap (click it to shut the pack), the haul loop
//    (shake it all down and repack), and at camp the trail marker plank (set off). A click outside
//    the pack (or Esc) shuts it too
//  - at camp the stash chest floats open beside the pack (modes 'stash' and 'prep'); packing up for
//    the day (prep) puts Joshu's lunch on the chest lid and the crew's last word in the air
// The way in and out (the camera making room, the hunger contract) is src/ui/v12/pack/index.ts.

import { game } from '../../../game/game';
import { ITEMS } from '../../../game/items';
import type { Stack, Place } from '../../../game/inventory';
import { onInvChange } from '../../../game/inventory';
import { PACK, toolSlotOf, stackDims, Container } from '../../../game/v11/backpack';
import type { Occ } from '../../../game/v11/backpack';
import { footprint, cells as fpCells } from '../../../game/v11/footprints';
import { STASH, STASH_AREAS, stashStacks } from '../../../game/v11/stash';
import { pileNear, dropOnGround, takeFromPile } from '../../../game/v11/ground';
import type { Pile } from '../../../game/v11/ground';
import { itemArtCanvas, itemArtBuffer } from '../../../art/v11/itemart';
import { itemIcon, ICON_IDS } from '../../../art/itemicons';
import { foodInfo, canEat, eatFood } from '../../../game/v10/forage10';
import { feed } from '../../../game/v12/hunger';
import { PixelBuffer } from '../../../art/pixel';
import { css, sfx, pushKeys, reduced } from '../../laptop-kit';
import { pxWrap } from '../../pxfont';
import { bufCanvas } from '../../pxkit';
import { paintBundle } from '../../v11/bagart';
import { pxWord, wordOut, wordAnim } from '../pxwords';
import type { Word } from '../pxwords';
import { useOf } from './uses';
import * as ART from './art';
import type { PackLayout, ChestLayout, Rect } from './art';

const CELL = ART.CELL;

export type PackMode = 'pack' | 'stash' | 'prep';
export interface PrepHooks {
  /** what Joshu would pack for lunch today (null: already taken / nothing in the stores) */
  lunch?: () => { id: string; n: number }[] | null;
  /** Mori took it (mark the day's lunch as taken) */
  tookLunch?: () => void;
  /** a last word from the crew: [who, line] */
  tip?: () => [string, string] | null;
}
export interface SceneOpts {
  mode?: PackMode;
  prep?: PrepHooks;
  /** css px of the world point (null: no world); the pack lifts off his back, hangs beside him */
  project: (x: number, y: number) => [number, number] | null;
  /** Mori in the world: where he stands and which way he faces */
  mori: { x: number; y: number; facing: number; height: number } | null;
}
export type PackResult = 'closed' | 'go';

type Where = 'pack' | 'stash' | 'ground' | 'offer';
interface Loose { s: Stack; where: 'ground' | 'offer'; pile?: Pile; x: number; y: number; r: 0 | 1 }
interface Ref { s: Stack; where: Where; lo?: Loose; tool?: string }
type Target = { kind: 'grid'; cont: 'pack' | 'stash'; p: Place; ok: boolean; merge: Stack | null } | { kind: 'ground'; x: number; y: number } | { kind: 'none' };
interface Drag { ref: Ref; el: HTMLElement; pid: number; r: 0 | 1; gx: number; gy: number; px: number; py: number; target: Target }

const STYLE = `
.bp12 { position: absolute; inset: 0; z-index: 36; pointer-events: auto; touch-action: none; overflow: hidden; user-select: none; -webkit-user-select: none; }
.bp12 canvas { image-rendering: pixelated; display: block; }
.bp12 .dim { position: absolute; left: 0; top: 0; }
.bp12 .pk, .bp12 .ch { will-change: transform; }
.bp12 .lidG { position: absolute; left: 0; top: 0; }
.bp12 .st, .bp12 .wl { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.bp12 .wl { pointer-events: none; z-index: 60; }
.bp12 .ab { position: absolute; left: 0; top: 0; }
.bp12 .grp { position: absolute; }
.bp12 .it { position: absolute; cursor: grab; touch-action: none; }
.bp12 .it .rot { position: absolute; pointer-events: none; }
.bp12 .it .halo { position: absolute; opacity: 0; }
.bp12 .it.hov .halo { opacity: 0.75; }
.bp12 .it.sel .halo { opacity: 1; animation: bp12Glow 1.1s steps(2) infinite; }
@keyframes bp12Glow { 50% { opacity: 0.55; } }
.bp12 .it.sel .rot, .bp12 .it.hov .rot { transform: translateY(-1px); }
.bp12 .it.sel .rot.r90, .bp12 .it.hov .rot.r90 { transform: translateY(-1px) rotate(90deg); }
.bp12 .it .rot.r90 { transform: rotate(90deg); }
.bp12 .it .n { position: absolute; pointer-events: none; }
.bp12 .it.lift { cursor: grabbing; z-index: 50; }
.bp12 .it.lift .sh { transform: translate(2px, 3px); opacity: 0.8; }
.bp12 .it.hidden { visibility: hidden; }
.bp12 .it.pop { animation: bp12Pop 0.36s steps(4) both; animation-delay: var(--d, 0s); }
@keyframes bp12Pop { 0% { transform: translateY(-8px); opacity: 0; } 50% { transform: translateY(1px); opacity: 1; } 75% { transform: translateY(-1px); } 100% { transform: translateY(0); opacity: 1; } }
.bp12 .it.thud { animation: bp12Thud 0.2s steps(2); }
@keyframes bp12Thud { 50% { transform: translateY(1px); } }
.bp12 .it.nudge { animation: bp12Nudge 0.32s steps(4); }
@keyframes bp12Nudge { 25% { transform: translateX(-2px); } 50% { transform: translateX(2px); } 75% { transform: translateX(-1px); } }
.bp12 .it.eat { animation: bp12Eat 0.42s steps(5) both; }
@keyframes bp12Eat { 40% { transform: translateY(-6px); } 100% { transform: translateY(40px); opacity: 0; } }
.bp12 .tool { position: absolute; cursor: pointer; }
.bp12 .tool .halo { position: absolute; opacity: 0; }
.bp12 .tool.hov .halo, .bp12 .tool.sel .halo { opacity: 1; }
.bp12 .hot { position: absolute; cursor: pointer; }
.bp12 .ghost { position: absolute; pointer-events: none; }
.bp12 .act { position: absolute; pointer-events: auto; cursor: pointer; padding: 3px; margin: -3px; }
.bp12 .pk.shake { animation: bp12Shake 0.5s steps(8) both; }
@keyframes bp12Shake { 15% { transform: translate(-3px, -1px); } 30% { transform: translate(3px, -3px); } 45% { transform: translate(-2px, 0); } 60% { transform: translate(2px, -2px); } 80% { transform: translate(-1px, 0); } }
.bp12 .lidS { transform-origin: 50% 0; }
.bp12 .turn { cursor: pointer; }
`;

// ---------------------------------------------------------------- pictures

const HAS_ICON = (() => { let s: Set<string> | null = null; return () => (s ??= new Set(ICON_IDS.items())); })();
const picCache = new Map<string, PixelBuffer>();
/** an item's picture at 1x as pixels: its artwork, else its icon, else a tied bundle */
function picBuf(id: string): PixelBuffer {
  let b = picCache.get(id);
  if (b) return b;
  b = itemArtBuffer(id) ?? null as unknown as PixelBuffer;
  if (!b) {
    const cv = itemArtCanvas(id);
    if (cv && cv.width > 0) {
      try {
        const g = cv.getContext('2d', { willReadFrequently: true });
        const d = g?.getImageData(0, 0, cv.width, cv.height);
        if (d) { b = new PixelBuffer(cv.width, cv.height); b.bytes.set(d.data); }
      } catch { /* a tainted or GPU canvas: fall through */ }
    }
  }
  if (!b) b = HAS_ICON().has(id) ? itemIcon(id) : paintBundle(id, ITEMS[id]?.kind ?? 'material', footprint(id));
  picCache.set(id, b);
  return b;
}
/** scale a picture by whole pixels to fit a box (nearest; shrinks by whole factors too) */
function fitBuf(src: PixelBuffer, bw: number, bh: number, up = true): PixelBuffer {
  const k = Math.min(bw / src.w, bh / src.h);
  if (k >= 0.8 && (k < 2 || !up)) return src;
  if (k >= 2) return scaleBuf(src, Math.floor(k));
  const d = Math.ceil(1 / k);
  const out = new PixelBuffer(Math.max(1, Math.floor(src.w / d)), Math.max(1, Math.floor(src.h / d)));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    // keep the most opaque, most central sample of each block
    let best = 0;
    for (let j = 0; j < d && !best; j++) for (let i = 0; i < d; i++) { const c = src.get(x * d + ((i + (d >> 1)) % d), y * d + ((j + (d >> 1)) % d)); if (c >>> 24 > 120) { best = c; break; } }
    if (best) out.set(x, y, best);
  }
  return out;
}
function scaleBuf(src: PixelBuffer, k: number): PixelBuffer {
  if (k === 1) return src;
  const out = new PixelBuffer(src.w * k, src.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = src.data[Math.floor(y / k) * src.w + Math.floor(x / k)];
  return out;
}
const cv = (b: PixelBuffer, cls = '') => { const c = bufCanvas(b, cls); c.style.position = 'absolute'; return c; };
const at = (e: HTMLElement, x: number, y: number, w?: number, h?: number) => {
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if (w !== undefined) e.style.width = w + 'px';
  if (h !== undefined) e.style.height = h + 'px';
};
const div = (cls: string) => { const e = document.createElement('div'); e.className = cls; return e; };
const firstSentence = (s: string) => { const m = s.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : s).trim(); };
const inR = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

// ---------------------------------------------------------------- the scene

export class PackScene {
  readonly mode: PackMode;
  root = div('bp12');
  stage = div('st');
  words = div('wl');
  /** css px per art px (the stage) and for the words (never smaller than 2 css px when it fits) */
  s = 2; ws = 2;
  SW = 0; SH = 0;
  portrait = false;
  L: PackLayout;
  CL: ChestLayout | null = null;
  PX = 0; PY = 0; CX = 0; CY = 0;
  signR: Rect | null = null;
  /** where it lifts off from (Mori's back, stage px) and where his mouth is (eating) */
  from: [number, number] | null = null;
  mouth: [number, number] | null = null;
  // layers
  dim: HTMLCanvasElement | null = null;
  shadow: HTMLCanvasElement | null = null;
  looseEl = div('ab'); dragEl = div('ab');
  pk = div('grp pk'); ch: HTMLElement | null = null;
  lidG = div('lidG');
  packItems = div('ab'); chestItems = div('ab'); toolsEl = div('ab');
  ghostEl = div('ghost'); loopsCv: HTMLCanvasElement | null = null;
  lidS!: HTMLCanvasElement; turnEl = div('hot turn'); turnCv: HTMLCanvasElement | null = null;
  // state
  itemEls = new Map<Stack, HTMLElement>();
  refs = new WeakMap<HTMLElement, Ref>();
  toolEls = new Map<string, HTMLElement>();
  loose: Loose[] = [];
  sel: Ref | null = null;
  hover: Ref | null = null;
  drag: Drag | null = null;
  pending: { ref: Ref; x: number; y: number; pid: number; el: HTMLElement } | null = null;
  pointers = new Map<number, [number, number]>();
  twist: { a: number } | null = null;
  touch = false;
  opened = false;
  closing = false;
  busy = false;
  result: PackResult = 'closed';
  private info: HTMLElement[] = [];
  private hint: { el: Word; key: string } | null = null;
  private offs: (() => void)[] = [];
  private resolve!: (r: PackResult) => void;
  private lunchTaken = false;

  constructor(readonly o: SceneOpts) {
    this.mode = o.mode ?? 'pack';
    const tools = game.save.tools.filter(id => ITEMS[id]).length;
    this.L = ART.packLayout(5, 3, Math.max(1, Math.ceil(tools / 4)));
    if (this.mode !== 'pack') this.CL = ART.chestLayout(STASH_AREAS[0].cols, STASH_AREAS[0].rows);
    css('bp12', STYLE);
  }

  // ------------------------------------------------------------ open / close
  async run(): Promise<PackResult> {
    const done = new Promise<PackResult>(r => (this.resolve = r));
    // everything placed; what has no room (an old save, a gift) drops to the ground at Mori's feet
    const spill = PACK.reconcile();
    for (const s of spill) { const i = game.save.inv.indexOf(s); if (i >= 0) game.save.inv.splice(i, 1); }
    if (spill.length && !dropOnGround(spill, { quiet: true })) for (const s of spill) this.loose.push({ s, where: 'ground', x: 0, y: 0, r: flatR(s.id) });
    if (this.mode !== 'pack') STASH.reconcile();
    this.layout();
    this.build();
    if (this.mode === 'prep') this.offerLunch();
    this.layGround();
    game.ui.modalLayer.appendChild(this.root);
    this.sync();
    for (const e of this.itemEls.values()) if (this.refs.get(e)?.where === 'pack' || this.refs.get(e)?.where === 'stash') e.classList.add('hidden');
    this.listen();
    await this.openAnim();
    return done;
  }

  /** scale and positions (art px): the pack hangs in the air beside Mori, the chest beyond it */
  private layout() {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const L = this.L, CL = this.CL;
    this.portrait = vh > vw * 1.1;
    const sign = this.mode === 'prep' ? 26 : 0;
    const GAP = 16;
    const gw = CL && !this.portrait ? L.W + GAP + CL.W : Math.max(L.W, CL?.W ?? 0);
    const gh = (CL && this.portrait ? L.H + GAP + CL.H : Math.max(L.H, CL?.H ?? 0)) + sign + 10;
    // big enough to work in, small enough to leave Mori in view: whole device pixels per art pixel
    const fw = CL ? 0.94 : this.portrait ? 0.9 : 0.6, fh = vh < 520 ? 0.84 : CL ? 0.8 : 0.66;
    const k = Math.max(1, Math.floor(Math.min((vw * dpr * fw) / gw, (vh * dpr * fh) / gh) + 0.02));
    this.s = k / dpr;
    this.ws = Math.max(this.s, Math.min(Math.floor(2 * dpr) / dpr, Math.floor(((vh * dpr) / 150)) / dpr));
    this.SW = Math.ceil(vw / this.s); this.SH = Math.ceil(vh / this.s);
    const SW = this.SW, SH = this.SH;
    // Mori on screen (stage px): his middle, his back (it lifts off from there), his mouth
    const m = this.o.mori;
    let mx = SW / 2, my = SH / 2, side = 1;
    if (m) {
      const c = this.o.project(m.x, m.y - m.height * 0.5), bk = this.o.project(m.x - m.facing * 7, m.y - m.height * 0.6), mo = this.o.project(m.x + m.facing * 2, m.y - m.height * 0.82);
      if (c) { mx = c[0] / this.s; my = c[1] / this.s; }
      if (bk) this.from = [bk[0] / this.s, bk[1] / this.s];
      if (mo) this.mouth = [mo[0] / this.s, mo[1] / this.s];
      // the side with more room (in front of him when it's even)
      side = SW - mx > mx + 30 ? 1 : mx > SW - mx + 30 ? -1 : (m.facing >= 0 ? 1 : -1);
    }
    const near = Math.round(Math.max(18, SW * 0.05));
    let gx = m ? (side > 0 ? mx + near : mx - near - gw) : (SW - gw) / 2;
    if (this.portrait) gx = (SW - gw) / 2;
    gx = Math.round(Math.max(6, Math.min(SW - gw - 6, gx)));
    let gy = Math.round(Math.max(6, Math.min(SH - gh - 6, (m && !this.portrait ? my : SH / 2) - gh / 2)));
    if (this.portrait && m) gy = Math.round(Math.max(6, Math.min(SH - gh - 6, my < SH / 2 ? my + 40 : my - 40 - gh)));
    if (!CL) { this.PX = gx + Math.round((gw - L.W) / 2); this.PY = gy; }
    else if (!this.portrait) {
      // the pack nearest Mori, the chest beyond it, their bottoms level
      const packFirst = side > 0;
      this.PX = packFirst ? gx : gx + CL.W + GAP;
      this.CX = packFirst ? gx + L.W + GAP : gx;
      const base = gy + Math.max(L.H, CL.H);
      this.PY = base - L.H; this.CY = base - CL.H - 8;
    } else {
      this.CX = Math.round((SW - CL.W) / 2); this.CY = gy;
      this.PX = Math.round((SW - L.W) / 2); this.PY = gy + CL.H + GAP;
    }
    if (sign) this.signR = { x: Math.round(this.PX + L.W / 2 - 31), y: this.PY + L.H + 2, w: 62, h: 22 };
  }

  private build() {
    const r = this.root, st = this.stage, L = this.L;
    r.innerHTML = '';
    r.appendChild(st);
    st.style.transform = `scale(${this.s})`;
    st.style.width = this.SW + 'px'; st.style.height = this.SH + 'px';
    st.innerHTML = '';
    // ---- the world behind, dimmed by a dither (lighter round Mori and the pack)
    const spots: { x: number; y: number; r: number }[] = [{ x: this.PX + L.W / 2, y: this.PY + L.H / 2, r: Math.max(L.W, L.H) * 0.75 }];
    if (this.from) spots.push({ x: this.from[0], y: this.from[1] + 10, r: this.SH * 0.32 });
    this.dim = cv(ART.paintDim(this.SW, this.SH, spots), 'dim');
    st.appendChild(this.dim);
    // ---- the shadow the floating pack (and chest) cast down on the world
    this.shadow = cv(ART.paintFloatShadow(Math.round(L.W * 0.8), 12));
    at(this.shadow, Math.round(this.PX + L.W * 0.1), Math.min(this.SH - 14, this.PY + L.H + 8));
    st.appendChild(this.shadow);
    // ---- the sign (prep)
    if (this.signR) {
      const sg = cv(ART.paintSign());
      const hot = div('hot sign');
      at(hot, this.signR.x, this.signR.y, this.signR.w, this.signR.h);
      sg.style.left = '0px'; sg.style.top = '0px';
      hot.appendChild(sg);
      st.appendChild(hot);
      this.hotWord(hot, 'SET OFF', 'sign', () => { this.result = 'go'; void this.close(); });
    }
    // ---- things lying on the ground at Mori's feet
    st.appendChild(this.looseEl);
    // ---- the chest
    if (this.CL) {
      const ch = this.ch = div('grp ch');
      at(ch, this.CX, this.CY, this.CL.W, this.CL.H);
      ch.appendChild(cv(ART.paintChest(this.CL, STASH_AREAS[0].cols, STASH_AREAS[0].rows)));
      ch.appendChild(this.chestItems);
      st.appendChild(ch);
    }
    // ---- the pack
    const pk = this.pk;
    pk.innerHTML = '';
    at(pk, this.PX, this.PY, L.W, L.H);
    // the flap, thrown open above the body: its underside, the tool loops, a click on it shuts the pack
    const lg = this.lidG;
    lg.innerHTML = '';
    at(lg, 0, 0, L.W, L.lid.y + L.lid.h);
    lg.style.transformOrigin = `50% ${L.lid.y + L.lid.h}px`;
    lg.style.transform = 'scaleY(0)';
    const lidO = cv(ART.paintLidOpen(L));
    at(lidO, L.lid.x, L.lid.y);
    lg.appendChild(lidO);
    const lidHot = div('hot lidhit');
    at(lidHot, L.lid.x + 2, L.lid.y + 10, L.lid.w - 4, L.lid.h - 12);
    lg.appendChild(lidHot);
    this.hotWord(lidHot, 'CLOSE', 'lid', () => void this.close());
    lg.appendChild(this.toolsEl);
    pk.appendChild(lg);
    pk.appendChild(cv(ART.paintPack(L)));
    this.loopsCv = null;
    pk.appendChild(this.packItems);
    this.lidS = cv(ART.paintLidShut(L), 'lidS');
    at(this.lidS, L.shut.x, L.shut.y);
    pk.appendChild(this.lidS);
    // the swivel (turn)
    const tu = this.turnEl;
    tu.innerHTML = '';
    at(tu, L.turn.x - 3, L.turn.y, L.turn.w + 6, L.turn.h + 3);
    this.turnCv = cv(ART.paintTurn('idle'));
    at(this.turnCv, 3, 0);
    tu.appendChild(this.turnCv);
    pk.appendChild(tu);
    this.hotWord(tu, 'TURN', 'turn', () => this.turnPressed());
    tu.addEventListener('pointerenter', () => this.paintTurn('hover'));
    tu.addEventListener('pointerleave', () => this.paintTurn('idle'));
    // the haul loop (shake it all down and repack)
    const hd = div('hot handle');
    at(hd, L.handle.x - 2, L.handle.y - 2, L.handle.w + 4, L.handle.h + 2);
    pk.appendChild(hd);
    this.hotWord(hd, 'REPACK', 'handle', () => this.repack());
    st.appendChild(pk);
    this.renderTools();
    // ---- the hand-held item and the words
    st.appendChild(this.dragEl);
    this.dragEl.style.zIndex = '70';
    r.appendChild(this.words);
    this.words.style.transform = `scale(${this.ws})`;
    this.words.style.width = Math.ceil(window.innerWidth / this.ws) + 'px';
    this.words.style.height = Math.ceil(window.innerHeight / this.ws) + 'px';
    this.words.innerHTML = '';
  }

  /** what lies on the ground at Mori's feet (a heap in the world), laid out where it lies */
  private layGround() {
    const keep = this.loose.filter(l => l.where === 'offer' || !l.pile);
    const pile = this.o.mori ? pileNear(80) : null;
    const ground: Loose[] = pile ? pile.stacks.map(s => ({ s, where: 'ground' as const, pile, x: 0, y: 0, r: flatR(s.id) })) : [];
    this.loose = [...keep, ...ground];
    const row = this.loose.filter(l => l.where === 'ground');
    if (!row.length) return;
    const ws = row.map(l => stackDims(l.s.id, l.r));
    const total = ws.reduce((a, [w]) => a + w * CELL + 4, -4);
    const hMax = Math.max(...ws.map(([, h]) => h * CELL));
    // at the heap's spot in the world (or under the pack with no world)
    let cx = this.PX + this.L.W / 2, bottom = this.PY + this.L.H + 4 + hMax;
    const at0 = pile ? this.o.project(pile.x, pile.y) : null;
    if (at0) { cx = at0[0] / this.s; bottom = at0[1] / this.s; }
    let x = Math.round(Math.max(4, Math.min(this.SW - total - 4, cx - total / 2)));
    bottom = Math.max(hMax + 4, Math.min(this.SH - 4, bottom));
    // (never under the pack: below it, or beside it)
    const pr = { x: this.PX - 4, y: this.PY, w: this.L.W + 8, h: this.L.H + 4 };
    if (x < pr.x + pr.w && x + total > pr.x && bottom > pr.y && bottom - hMax < pr.y + pr.h) {
      if (this.PY + this.L.H + 6 + hMax <= this.SH - 4) bottom = this.PY + this.L.H + 6 + hMax;
      else x = Math.round(pr.x - total - 6 >= 4 ? pr.x - total - 6 : Math.min(this.SW - total - 4, pr.x + pr.w + 6));
    }
    row.forEach((l, i) => { l.x = x; l.y = Math.round(bottom - ws[i][1] * CELL); x += ws[i][0] * CELL + 4; });
  }

  private paintTurn(state: 'idle' | 'hover' | 'down') {
    if (!this.turnCv) return;
    const n = cv(ART.paintTurn(state));
    at(n, 3, 0);
    this.turnCv.replaceWith(n);
    this.turnCv = n;
  }

  /** a physical button's word: shown on hover (and for a moment when the pack opens) */
  private hotWord(el: HTMLElement, word: string, key: string, fn: () => void) {
    (el as unknown as { __hot: () => void }).__hot = fn;
    el.addEventListener('pointerenter', () => { if (!this.drag && this.opened) this.showHint(el, word, key); });
    el.addEventListener('pointerleave', () => this.hideHint(key));
  }
  private showHint(el: HTMLElement, word: string, key: string, ms = 0) {
    if (this.hint?.key === key) return;
    this.hideHint();
    const r = this.stageRectOf(el);
    const w = pxWord(word, { font: 'bold', color: '#ffe9a8', anim: 'wave' });
    const [x, y] = this.toWords(r.x + r.w / 2, key === 'turn' || key === 'sign' ? r.y + r.h + 3 : r.y - 2);
    at(w, Math.round(x - w.wW / 2), Math.round(key === 'turn' || key === 'sign' ? y : y - w.wH));
    this.words.appendChild(w);
    this.hint = { el: w, key };
    if (ms) setTimeout(() => this.hideHint(key), ms);
  }
  private hideHint(key?: string) {
    if (!this.hint || (key && this.hint.key !== key)) return;
    void wordOut(this.hint.el);
    this.hint = null;
  }

  /** the pack's offset (stage px) from where it hangs to Mori's back */
  private homeOffset(): [number, number] {
    if (!this.from) return [0, 40];
    return [Math.round(this.from[0] - (this.PX + this.L.W / 2)), Math.round(this.from[1] - (this.PY + this.L.H / 2))];
  }

  private async openAnim() {
    const fast = reduced();
    const ms = (n: number) => (fast ? 1 : n);
    // the world dims, a dither stepping in
    this.dim?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(300), easing: 'steps(3)', fill: 'backwards' });
    // the pack lifts off his back, swings out into the air beside him and pops to size, shut
    const [dx, dy] = this.homeOffset();
    sfx('rustle', { vol: 0.4, pitch: 1.1 });
    const pop = this.pk.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(-8deg)`, opacity: 0 },
      { transform: `translate(${Math.round(dx * 0.35)}px, ${Math.round(dy * 0.35) - 10}px) scale(0.7) rotate(4deg)`, opacity: 1, offset: 0.55 },
      { transform: 'translate(0, 2px) scale(1.04) rotate(-1deg)', offset: 0.82 },
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
    ], { duration: ms(460), easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
    this.shadow?.animate([{ opacity: 0, transform: 'scaleX(0.3)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: ms(460), easing: 'steps(4)', fill: 'backwards' });
    if (this.ch) this.ch.animate([{ transform: 'translateY(24px) scale(0.6)', opacity: 0 }, { transform: 'translateY(-3px) scale(1.02)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: ms(420), delay: ms(120), easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
    await pop.finished.catch(() => {});
    sfx('whoosh', { vol: 0.2, pitch: 1.6 });
    await this.wait(fast ? 0 : 90);
    // the clips pop, one then the other
    this.swapShut([true, false]); sfx('reelClick', { vol: 0.5, pitch: 1.5 });
    await this.wait(fast ? 0 : 110);
    this.swapShut([true, true]); sfx('reelClick', { vol: 0.5, pitch: 1.75 });
    await this.wait(fast ? 0 : 100);
    // the flap flips up over the hinge and falls open above the pack
    sfx('whoosh', { vol: 0.25, pitch: 1.4 });
    const a = this.lidS.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ms(150), easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    await a.finished.catch(() => {});
    this.lidS.style.visibility = 'hidden';
    const b2 = this.lidG.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.1)', offset: 0.65 }, { transform: 'scaleY(0.97)', offset: 0.85 }, { transform: 'scaleY(1)' }], { duration: ms(280), easing: 'ease-out', fill: 'forwards' });
    sfx('rustle', { vol: 0.45, pitch: 1.1 });
    await b2.finished.catch(() => {});
    this.lidG.style.transform = 'scaleY(1)';
    b2.cancel();
    // the contents settle, bottom row first
    this.opened = true;
    const order = [...this.itemEls.entries()].filter(([, e]) => e.classList.contains('hidden')).sort((x, y) => (y[0].p?.y ?? 0) - (x[0].p?.y ?? 0));
    order.forEach(([, e], i) => {
      e.classList.remove('hidden');
      e.style.setProperty('--d', `${Math.min(i, 14) * 0.04}s`);
      e.classList.add('pop');
      setTimeout(() => e.classList.remove('pop'), 420 + Math.min(i, 14) * 40);
    });
    if (!fast) for (let k = 0; k < Math.min(4, order.length); k++) setTimeout(() => sfx('place', { vol: 0.22, pitch: 0.8 + k * 0.12 }), 100 + k * 90);
    // what the buttons are, for a moment
    setTimeout(() => { if (!this.sel && !this.drag && !this.closing) this.showHint(this.turnEl, 'TURN', 'turn', 2600); }, fast ? 0 : 500);
    if (this.mode === 'prep') this.showTip();
  }
  private swapShut(rel: [boolean, boolean]) {
    const n = cv(ART.paintLidShut(this.L, rel), 'lidS');
    at(n, this.L.shut.x, this.L.shut.y);
    n.style.transform = this.lidS.style.transform;
    n.style.visibility = this.lidS.style.visibility;
    this.lidS.replaceWith(n);
    this.lidS = n;
  }

  async close() {
    if (this.closing) return;
    if (this.drag) this.cancelDrag();
    this.closing = true;
    this.select(null);
    this.hideHint();
    for (const w of [...this.words.children]) void wordOut(w as HTMLElement);
    const fast = reduced();
    const ms = (n: number) => (fast ? 1 : n);
    sfx('rustle', { vol: 0.4, pitch: 1.2 });
    // the flap comes back over, the clips go in
    this.lidS.style.visibility = '';
    this.swapShut([true, true]);
    this.lidS.style.transform = 'scaleY(0)';
    const a = this.lidG.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ms(140), easing: 'ease-in', fill: 'forwards' });
    await a.finished.catch(() => {});
    const b = this.lidS.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: ms(160), easing: 'cubic-bezier(.3,.4,.6,1)', fill: 'forwards' });
    sfx('whoosh', { vol: 0.2, pitch: 1.2 });
    await b.finished.catch(() => {});
    this.lidS.style.transform = 'scaleY(1)';
    await this.wait(fast ? 0 : 80);
    this.swapShut([false, true]); sfx('reelClick', { vol: 0.5, pitch: 1.6 });
    await this.wait(fast ? 0 : 100);
    this.swapShut([false, false]); sfx('reelClick', { vol: 0.5, pitch: 1.4 });
    await this.wait(fast ? 0 : 110);
    // it swings back onto his back; the world comes back up
    const [dx, dy] = this.homeOffset();
    sfx('rustle', { vol: 0.35, pitch: 0.9 });
    this.pk.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(0, -6px) scale(1.03)', opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(8deg)`, opacity: 0 },
    ], { duration: ms(380), easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' });
    this.ch?.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(24px) scale(0.6)', opacity: 0 }], { duration: ms(300), easing: 'ease-in', fill: 'forwards' });
    this.looseEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(240), fill: 'forwards' });
    this.shadow?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(300), easing: 'steps(3)', fill: 'forwards' });
    this.dim?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(360), easing: 'steps(3)', fill: 'forwards' });
    await this.wait(fast ? 0 : 380);
    this.finish();
  }

  private finish() {
    for (const f of this.offs) f();
    this.offs = [];
    // (no world to leave things in: back into the pack, unplaced; they come out again next time)
    const left = this.loose.filter(l => l.where === 'ground' && !l.pile).map(l => l.s);
    for (const s of left) { s.p = undefined; game.save.inv.push(s); }
    this.root.remove();
    game.persist();
    this.resolve(this.result);
  }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

  // ------------------------------------------------------------ input
  private listen() {
    const r = this.root;
    const down = (e: PointerEvent) => this.onDown(e);
    const move = (e: PointerEvent) => this.onMove(e);
    const up = (e: PointerEvent) => this.onUp(e);
    r.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    r.addEventListener('contextmenu', e => { e.preventDefault(); if (this.drag) this.rotateHeld(); else if (this.hover?.where === 'pack' || this.hover?.where === 'stash' || this.hover?.where === 'ground') this.turnInPlace(this.hover); });
    r.addEventListener('wheel', e => { if (this.drag) { e.preventDefault(); this.rotateHeld(); } }, { passive: false });
    const onResize = () => this.relayout();
    window.addEventListener('resize', onResize);
    this.offs.push(() => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', onResize);
    });
    this.offs.push(pushKeys(e => this.onKey(e)));
    this.offs.push(onInvChange(() => { if (!this.drag && !this.closing) this.sync(); }));
  }

  private relayout() {
    if (this.closing) return;
    const keep = this.sel;
    this.select(null);
    this.hideHint();
    this.layout();
    this.itemEls.clear(); this.toolEls.clear();
    this.packItems.innerHTML = ''; this.chestItems.innerHTML = ''; this.looseEl.innerHTML = ''; this.toolsEl.innerHTML = '';
    this.build();
    const offers = this.loose.filter(l => l.where === 'offer');
    if (offers.length && this.CL) { this.loose = this.loose.filter(l => l.where !== 'offer'); this.offerLunch(offers); }
    this.layGround();
    this.lidS.style.visibility = 'hidden';
    this.lidG.style.transform = 'scaleY(1)';
    this.sync();
    if (keep) this.select(keep);
  }

  /** client px -> stage art px */
  private toStage(cx: number, cy: number): [number, number] { return [cx / this.s, cy / this.s]; }
  /** stage art px -> word layer px */
  private toWords(x: number, y: number): [number, number] { return [(x * this.s) / this.ws, (y * this.s) / this.ws]; }
  private stageRectOf(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return { x: r.left / this.s, y: r.top / this.s, w: r.width / this.s, h: r.height / this.s };
  }

  private onDown(e: PointerEvent) {
    if (e.pointerType === 'touch') this.touch = true;
    this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    // a second finger turns whatever is in hand (and twisting turns it again)
    if (this.drag && this.pointers.size > 1) {
      e.preventDefault();
      this.rotateHeld();
      this.twist = { a: this.pairAngle() };
      return;
    }
    if (this.closing || !this.opened || this.busy) return;
    const t = e.target as HTMLElement;
    const act = t.closest('.act') as HTMLElement | null;
    if (act) { e.preventDefault(); e.stopPropagation(); (act as unknown as { __fn?: () => void }).__fn?.(); return; }
    const itEl = t.closest('.it') as HTMLElement | null;
    if (itEl) {
      const ref = this.refs.get(itEl);
      if (!ref) return;
      e.preventDefault();
      this.pending = { ref, x: e.clientX, y: e.clientY, pid: e.pointerId, el: itEl };
      return;
    }
    const toolEl = t.closest('.tool') as HTMLElement | null;
    if (toolEl) {
      const ref = this.refs.get(toolEl);
      if (ref) { sfx('ui', { vol: 0.35, pitch: 1.2 }); this.select(this.sel?.tool === ref.tool ? null : ref); }
      return;
    }
    const hot = t.closest('.hot') as HTMLElement | null;
    if (hot) {
      e.preventDefault();
      if (hot === this.turnEl) this.paintTurn('down');
      (hot as unknown as { __hot?: () => void }).__hot?.();
      return;
    }
    // on the pack or the chest: let go of what is picked; anywhere else (the world): shut the pack
    if (t.closest('.pk') || t.closest('.ch')) { if (this.sel) this.select(null); return; }
    e.preventDefault();
    void this.close();
  }

  private pairAngle(): number {
    const ps = [...this.pointers.values()];
    if (ps.length < 2) return 0;
    return Math.atan2(ps[1][1] - ps[0][1], ps[1][0] - ps[0][0]);
  }

  private onMove(e: PointerEvent) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (this.closing) return;
    if (this.twist && this.pointers.size > 1 && this.drag) {
      let d = this.pairAngle() - this.twist.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) > 0.8) { this.rotateHeld(); this.twist.a = this.pairAngle(); }
    }
    const pd = this.pending;
    if (pd && e.pointerId === pd.pid && !this.drag) {
      if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 5) this.startDrag(pd, e);
      return;
    }
    const d = this.drag;
    if (d && e.pointerId === d.pid) { e.preventDefault(); this.moveDrag(e.clientX, e.clientY); return; }
    if (!d && e.pointerType === 'mouse') {
      const t = e.target as HTMLElement;
      const itEl = (t.closest?.('.it') ?? t.closest?.('.tool')) as HTMLElement | null;
      const ref = itEl ? this.refs.get(itEl) ?? null : null;
      if ((ref?.s ?? null) !== (this.hover?.s ?? null) || (ref?.tool ?? null) !== (this.hover?.tool ?? null)) {
        this.hoverEl()?.classList.remove('hov');
        this.hover = ref;
        this.hoverEl()?.classList.add('hov');
        if (!this.sel) this.renderInfo(ref, false);
      }
    }
  }
  private hoverEl(): HTMLElement | null {
    const h = this.hover;
    if (!h) return null;
    return h.tool ? this.toolEls.get(h.tool) ?? null : this.itemEls.get(h.s) ?? null;
  }

  private onUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.twist = null;
    if (this.turnCv && (e.target as HTMLElement)?.closest?.('.turn')) this.paintTurn('hover');
    const pd = this.pending;
    if (pd && e.pointerId === pd.pid && !this.drag) {
      this.pending = null;
      sfx('ui', { vol: 0.35, pitch: 1.15 });
      // a tap on the picked item again: a double tap eats food
      if (this.sel?.s === pd.ref.s && this.touch && performance.now() - this.lastTap < 380 && foodInfo(pd.ref.s.id).edible) { void this.eat(pd.ref); return; }
      this.lastTap = performance.now();
      this.select(pd.ref);
      return;
    }
    const d = this.drag;
    if (d && e.pointerId === d.pid) this.endDrag();
  }
  private lastTap = 0;

  private onKey(e: KeyboardEvent): boolean | void {
    if (this.closing) return true;
    const c = e.code;
    if (c === 'Escape' || c === 'Tab' || c === 'KeyI' || c === 'KeyB') {
      if (this.drag) { this.cancelDrag(); return true; }
      if (this.sel && c === 'Escape') { this.select(null); return true; }
      void this.close();
      return true;
    }
    if (!this.opened) return true;
    if (c === 'KeyR') { if (this.drag) this.rotateHeld(); else if (this.sel?.s && !this.sel.tool) this.turnInPlace(this.sel); return true; }
    if (c === 'KeyT') { this.repack(); return true; }
    if (c === 'Enter' && this.mode === 'prep' && !this.drag && !this.sel) { this.result = 'go'; void this.close(); return true; }
    const sel = this.sel;
    if (c === 'KeyE' && sel?.s && !sel.tool && !this.drag) { void this.eat(sel); return true; }
    if ((c === 'KeyX' || c === 'Delete' || c === 'Backspace') && sel?.s && !sel.tool && !this.drag) { this.dropOut(sel); return true; }
    // arrows walk the selection round the pack
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dir[c]) { this.walkSel(dir[c][0], dir[c][1]); return true; }
    return true;
  }

  /** arrow keys: pick the next item in that direction */
  private walkSel(dx: number, dy: number) {
    const all = [...this.itemEls.entries()].map(([s, e]) => ({ ref: this.refs.get(e)!, r: this.stageRectOf(e) })).filter(x => x.ref);
    if (!all.length) return;
    const cur = this.sel ? all.find(x => x.ref.s === this.sel!.s) : null;
    if (!cur) { this.select(all[0].ref); return; }
    const cx = cur.r.x + cur.r.w / 2, cy = cur.r.y + cur.r.h / 2;
    let best: typeof cur | null = null, bd = Infinity;
    for (const x of all) {
      if (x === cur) continue;
      const ox = x.r.x + x.r.w / 2 - cx, oy = x.r.y + x.r.h / 2 - cy;
      const along = ox * dx + oy * dy;
      if (along <= 2) continue;
      const d = along + Math.abs(ox * dy + oy * dx) * 2;
      if (d < bd) { bd = d; best = x; }
    }
    if (best) { sfx('ui', { vol: 0.25, pitch: 1.3 }); this.select(best.ref); }
  }

  // ------------------------------------------------------------ the contents

  private contOf(where: Where): Container | null { return where === 'pack' ? PACK : where === 'stash' ? STASH : null; }
  private listOf(where: Where): Stack[] | null { return where === 'pack' ? game.save.inv : where === 'stash' ? stashStacks() : null; }
  private gridOrigin(where: 'pack' | 'stash'): [number, number] {
    if (where === 'pack') return [this.PX + this.L.grid.x, this.PY + this.L.grid.y];
    return [this.CX + (this.CL?.grid.x ?? 0), this.CY + (this.CL?.grid.y ?? 0)];
  }
  private gridRect(where: 'pack' | 'stash'): Rect | null {
    if (where === 'stash' && !this.CL) return null;
    const [x, y] = this.gridOrigin(where);
    const g = where === 'pack' ? this.L.grid : this.CL!.grid;
    return { x, y, w: g.w, h: g.h };
  }

  /** build or update an item's element */
  private itemEl(s: Stack, where: Where, r: 0 | 1, lo?: Loose): HTMLElement {
    let e = this.itemEls.get(s);
    const key = `${s.id}|${r}|${s.n}`;
    if (!e) { e = div('it'); this.itemEls.set(s, e); }
    this.refs.set(e, { s, where, lo });
    const ex = e as unknown as { __k?: string };
    if (ex.__k !== key) {
      ex.__k = key;
      e.innerHTML = '';
      const fp = footprint(s.id);
      const [w, h] = stackDims(s.id, r);
      e.style.width = w * CELL + 'px'; e.style.height = h * CELL + 'px';
      const bw = fp.w * CELL, bh = fp.h * CELL;
      const pic = fitBuf(picBuf(s.id), bw, bh);
      const rot = div('rot' + (r ? ' r90' : ''));
      at(rot, Math.round((w * CELL - bw) / 2), Math.round((h * CELL - bh) / 2), bw, bh);
      const px = Math.round((bw - pic.w) / 2), py = Math.round((bh - pic.h) / 2);
      const sh = cv(ART.shadowOf(pic), 'sh'); at(sh, px, py);
      const halo = cv(ART.haloOf(pic), 'halo'); at(halo, px - 2, py - 2);
      const art = cv(pic, 'art'); at(art, px, py);
      rot.append(sh, halo, art);
      e.appendChild(rot);
      if (s.n > 1) {
        const d = ITEMS[s.id];
        const cs = fpCells(fp, !!r);
        const [bx, by] = cs.reduce((a, c) => (c[1] > a[1] || (c[1] === a[1] && c[0] > a[0]) ? c : a), cs[0]);
        const n = pxWord('×' + s.n, { font: 'bold', color: s.n >= (d?.stack ?? 1) ? '#ffd24a' : '#fff8e0', anim: 'still' });
        n.classList.add('n');
        at(n, bx * CELL + CELL - n.wW - 1, by * CELL + CELL - n.wH);
        e.appendChild(n);
      }
    }
    return e;
  }

  /** lay every stack where it is */
  sync() {
    const seen = new Set<Stack>();
    const put = (s: Stack, where: Where, parent: HTMLElement, x: number, y: number, r: 0 | 1, lo?: Loose) => {
      if (this.drag?.ref.s === s) { seen.add(s); return; }
      const e = this.itemEl(s, where, r, lo);
      if (e.parentElement !== parent) parent.appendChild(e);
      at(e, x, y);
      seen.add(s);
    };
    for (const s of game.save.inv) if (s.p && s.p.a === 'main') put(s, 'pack', this.packItems, this.L.grid.x + s.p.x * CELL, this.L.grid.y + s.p.y * CELL, s.p.r);
    if (this.CL) for (const s of stashStacks()) if (s.p) put(s, 'stash', this.chestItems, this.CL.grid.x + s.p.x * CELL, this.CL.grid.y + s.p.y * CELL, s.p.r);
    for (const l of this.loose) put(l.s, l.where, this.looseEl, Math.round(l.x), Math.round(l.y), l.r, l);
    for (const [s, e] of this.itemEls) if (!seen.has(s)) { e.remove(); this.itemEls.delete(s); }
    if (this.sel?.s && !this.sel.tool && !seen.has(this.sel.s)) this.select(null);
  }

  /** the tools in the webbing loops inside the flap: the camera and the glass first, then the
   *  blades and the digging tools */
  private renderTools() {
    const L = this.L;
    this.toolsEl.innerHTML = '';
    this.toolEls.clear();
    const order = ['camera', 'binoculars', 'jar', 'translator', 'headlamp', 'tweezers', 'gloves', 'knife', 'trowel', 'net', 'slingshot', 'hammer', 'ghillie'];
    const first = new Set(['camera', 'binoculars', 'jar', 'phone', 'lamp', 'pouch']);
    const rank = (id: string) => (first.has(toolSlotOf(id) ?? '') ? 0 : 100) + (order.indexOf(id) + 1 || 99);
    const tools = game.save.tools.filter(id => ITEMS[id]).sort((a, b) => rank(a) - rank(b));
    const filled = L.slots.map(() => false);
    const place = (ids: string[], slots: typeof L.slots) => ids.slice(0, slots.length).forEach((id, i) => {
      const sl = slots[i], r = sl.r;
      filled[L.slots.indexOf(sl)] = true;
      const pic = fitBuf(itemIcon(id), r.w + 2, r.h + 4, false);
      const e = div('tool');
      at(e, r.x + Math.round((r.w - pic.w) / 2), r.y + Math.round((r.h - pic.h) / 2), pic.w, pic.h);
      const sh = cv(ART.shadowOf(pic)); at(sh, 0, 0);
      const halo = cv(ART.haloOf(pic), 'halo'); at(halo, -2, -2);
      const art = cv(pic); at(art, 0, 0);
      e.append(sh, halo, art);
      this.toolsEl.appendChild(e);
      this.toolEls.set(id, e);
      this.refs.set(e, { s: { id, n: 1 }, where: 'pack', tool: id });
    });
    place(tools, L.slots);
    if (this.loopsCv) this.loopsCv.remove();
    this.loopsCv = cv(ART.paintLoops(L, filled));
    this.loopsCv.style.pointerEvents = 'none';
    this.toolsEl.appendChild(this.loopsCv);
  }

  // ------------------------------------------------------------ picking and the words

  private elOf(ref: Ref | null): HTMLElement | null {
    if (!ref) return null;
    return ref.tool ? this.toolEls.get(ref.tool) ?? null : this.itemEls.get(ref.s) ?? null;
  }

  select(ref: Ref | null) {
    this.elOf(this.sel)?.classList.remove('sel');
    this.sel = ref;
    this.elOf(ref)?.classList.add('sel');
    this.renderInfo(ref ?? (this.touch ? null : this.hover), !!ref);
  }

  /** the item's name floating over it; picked: its note and the action words too */
  private renderInfo(ref: Ref | null, full: boolean) {
    for (const w of this.info) void wordOut(w);
    this.info = [];
    if (!ref || this.closing) return;
    const el = this.elOf(ref);
    const d = ITEMS[ref.s.id];
    if (!el || !d) return;
    this.hideHint();
    const r = this.stageRectOf(el);
    const lines: { w: Word; gap: number }[] = [];
    const name = (d.name + (ref.s.n > 1 ? ` ×${ref.s.n}` : '')).toUpperCase();
    lines.push({ w: pxWord(name, { font: 'bold', color: '#fff3c4', outline: '#1a0e06' }), gap: 1 });
    const acts: { label: string; color: string; fn: () => void }[] = [];
    if (full) {
      const fi = foodInfo(ref.s.id);
      let note = firstSentence(d.desc || '');
      if (fi.edible) note = (fi.verdict === 'unknown' ? 'Never tested. Could be fine. ' : fi.verdict === 'poison' ? 'Poisonous! ' : '') + note;
      if (ref.tool === 'camera') note = 'Equip it from Mori himself: click him and pick the camera.';
      const maxW = Math.max(90, Math.min(150, Math.round((this.SW * this.s) / this.ws * 0.5)));
      pxWrap(note, maxW, 'body').slice(0, 3).forEach((ln, i) => lines.push({ w: pxWord(ln, { font: 'body', color: '#e8dcbc', outline: '#1a0e06', delay: 120 + i * 60, step: 10 }), gap: 0 }));
      if (!ref.tool) {
        const inPack = ref.where === 'pack';
        if (fi.edible && inPack) acts.push({ label: 'EAT', color: fi.verdict === 'poison' ? '#ff8a6a' : '#b4f080', fn: () => void this.eat(ref) });
        const fp = footprint(ref.s.id);
        if (fp.w !== fp.h || fp.mask) acts.push({ label: 'TURN', color: '#ffd76a', fn: () => this.turnInPlace(ref) });
        const u = useOf(ref.s.id);
        if (u && inPack) acts.push({ label: u.label.toUpperCase(), color: '#9ad8ff', fn: () => void this.use(ref) });
        if (ref.where !== 'ground' && ref.where !== 'offer' && d.kind !== 'key') acts.push({ label: 'DROP', color: '#f0b090', fn: () => this.dropOut(ref) });
        if (ref.where === 'ground' || ref.where === 'offer') acts.push({ label: 'TAKE', color: '#b4f080', fn: () => this.take(ref) });
      } else {
        const u = useOf(ref.tool);
        if (u) acts.push({ label: u.label.toUpperCase(), color: '#9ad8ff', fn: () => void this.useTool(ref.tool!) });
      }
    }
    // the action words in a row
    let row: HTMLElement | null = null, rowW = 0, rowH = 0;
    if (acts.length) {
      row = div('ab');
      let x = 0;
      for (const [i, a] of acts.entries()) {
        const w = pxWord(a.label, { font: 'bold', color: a.color, outline: '#1a0e06', delay: 200 + i * 70, anim: 'pop' });
        const b = div('act');
        (b as unknown as { __fn: () => void }).__fn = () => { if (!this.busy) a.fn(); };
        b.addEventListener('pointerenter', () => wordAnim(w, 'wave'));
        b.addEventListener('pointerleave', () => wordAnim(w, 'pop'));
        w.style.position = 'relative';
        b.appendChild(w);
        at(b, x, 0, w.wW + 6, w.wH + 6);
        row.appendChild(b);
        x += w.wW + 10;
        rowH = Math.max(rowH, w.wH);
      }
      rowW = x - 10;
      row.style.width = rowW + 'px'; row.style.height = rowH + 'px';
    }
    // where the block of words goes: beside the pack (or the chest) on the item's side, level with it,
    // a dotted line to it; above the item when it lies on the ground (or there's no room beside)
    const total = lines.reduce((a, l) => a + l.w.wH + l.gap, 0) + (row ? rowH + 3 : 0);
    const bw = Math.max(rowW, ...lines.map(l => l.w.wW));
    const WW = Math.ceil(window.innerWidth / this.ws), WH = Math.ceil(window.innerHeight / this.ws);
    const [ix0, iy0] = this.toWords(r.x, r.y), [ix1, iy1] = this.toWords(r.x + r.w, r.y + r.h);
    const icx = (ix0 + ix1) / 2, icy = (iy0 + iy1) / 2;
    let bx: number, by: number, align: 'left' | 'right' | 'center' = 'center', lead: [number, number, number] | null = null;
    const box = ref.where === 'pack' || ref.tool ? { x: this.PX, y: this.PY, w: this.L.W, h: this.L.H } : ref.where === 'stash' && this.CL ? { x: this.CX, y: this.CY, w: this.CL.W, h: this.CL.H } : null;
    let beside = false;
    if (box) {
      const [bx0, by0] = this.toWords(box.x, box.y), [bx1] = this.toWords(box.x + box.w, box.y + box.h);
      const leftRoom = bx0 - 10, rightRoom = WW - bx1 - 10;
      const preferLeft = icx < (bx0 + bx1) / 2;
      const side = preferLeft ? (leftRoom >= bw ? 'L' : rightRoom >= bw ? 'R' : '') : rightRoom >= bw ? 'R' : leftRoom >= bw ? 'L' : '';
      if (side) {
        beside = true;
        by = Math.round(Math.max(4, Math.min(WH - total - 4, icy - total / 2)));
        if (side === 'L') { bx = Math.round(bx0 - 8 - bw); align = 'right'; lead = [bx + bw + 2, ix0 - 2, Math.round(icy)]; }
        else { bx = Math.round(bx1 + 8); align = 'left'; lead = [ix1 + 2, bx - 2, Math.round(icy)]; }
      } else {
        // no room beside (a tall narrow screen): above the pack, or below it
        bx = Math.round(Math.max(4, Math.min(WW - bw - 4, icx - bw / 2)));
        by = Math.round(by0 - 4 - total);
        if (by < 4) by = Math.round(this.toWords(0, box.y + box.h)[1] + 4);
      }
    }
    if (!beside && !box) {
      bx = Math.round(Math.max(4, Math.min(WW - bw - 4, icx - bw / 2)));
      by = Math.round(iy0 - 4 - total);
      if (by < 4) by = Math.round(iy1 + 4);
      by = Math.min(by, WH - total - 4);
    }
    let y = by!;
    const place = (e: HTMLElement, w: number, h: number) => {
      const x = align === 'left' ? bx! : align === 'right' ? bx! + bw - w : Math.round(bx! + (bw - w) / 2);
      at(e, x, y);
      y += h;
      this.words.appendChild(e);
      this.info.push(e);
    };
    for (const l of lines) { place(l.w, l.w.wW, l.w.wH + l.gap); }
    if (row) { y += 3; place(row, rowW, rowH); }
    // the dotted leader from the words to the item, with a little arrowhead
    if (lead && Math.abs(lead[1] - lead[0]) > 3) {
      const [a, b2, ly] = lead;
      const x0 = Math.min(a, b2), len = Math.abs(b2 - a);
      const ln = new PixelBuffer(len + 1, 5);
      for (let i = 0; i <= len; i++) if (i % 3 !== 2) { ln.set(i, 2, 0xff9ae6ff); ln.set(i, 3, 0xff06101a); }
      const tipX = b2 > a ? len : 0, d = b2 > a ? -1 : 1;
      for (let k = 1; k <= 2; k++) { ln.set(tipX + d * k, 2 - k, 0xff9ae6ff); ln.set(tipX + d * k, 2 + k, 0xff9ae6ff); }
      const c = cv(ln);
      at(c, x0, ly - 2);
      c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 120, fill: 'backwards', easing: 'steps(3)' });
      this.words.appendChild(c);
      this.info.push(c);
    }
  }

  /** a word floating up from a spot (eaten, refused, no room) */
  private say(at0: Rect | null, text: string, color = '#fff3c4', anim: 'shake' | 'wave' | 'pop' = 'pop', ms = 1500) {
    const r = at0 ?? { x: this.PX + this.L.W / 2, y: this.PY + this.L.grid.y, w: 0, h: 0 };
    const w = pxWord(text, { font: 'bold', color, outline: '#1a0e06', anim });
    const [x, y] = this.toWords(r.x + r.w / 2, r.y);
    at(w, Math.round(x - w.wW / 2), Math.max(2, Math.round(y - w.wH - 6)));
    this.words.appendChild(w);
    w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }], { duration: ms, easing: 'steps(6)', fill: 'forwards' });
    setTimeout(() => void wordOut(w), ms);
  }

  // ------------------------------------------------------------ dragging

  private startDrag(pd: NonNullable<PackScene['pending']>, e: PointerEvent) {
    this.pending = null;
    const ref = pd.ref;
    if (ref.where === 'offer' && !this.CL) return;
    const el = pd.el;
    const r0 = el.getBoundingClientRect();
    const r: 0 | 1 = ref.where === 'pack' || ref.where === 'stash' ? (ref.s.p?.r ?? 0) : (ref.lo?.r ?? 0);
    this.select(null);
    this.hover = null;
    el.classList.remove('hov', 'sel');
    el.classList.add('lift');
    this.dragEl.appendChild(el);
    const [px, py] = this.toStage(e.clientX, e.clientY);
    this.drag = { ref, el, pid: e.pointerId, r, gx: (pd.x - r0.left) / this.s, gy: (pd.y - r0.top) / this.s, px, py, target: { kind: 'none' } };
    sfx('rustle', { vol: 0.25, pitch: 1.6 });
    this.moveDrag(e.clientX, e.clientY);
  }

  private moveDrag(cx: number, cy: number) {
    const d = this.drag;
    if (!d) return;
    [d.px, d.py] = this.toStage(cx, cy);
    const x = Math.round(d.px - d.gx), y = Math.round(d.py - d.gy);
    at(d.el, x, y);
    d.target = this.targetAt(x, y, d);
    this.drawGhost(d);
  }

  private targetAt(x: number, y: number, d: Drag): Target {
    const s = d.ref.s;
    const [w, h] = stackDims(s.id, d.r);
    const mx = x + (w * CELL) / 2, my = y + (h * CELL) / 2;
    for (const where of ['pack', 'stash'] as const) {
      const g = this.gridRect(where);
      if (!g) continue;
      if (mx < g.x - CELL / 2 || my < g.y - CELL / 2 || mx > g.x + g.w + CELL / 2 || my > g.y + g.h + CELL / 2) continue;
      const cont = this.contOf(where)!;
      const p: Place = { a: where === 'pack' ? 'main' : 'chest', x: Math.round((x - g.x) / CELL), y: Math.round((y - g.y) / CELL), r: d.r };
      const { occ } = cont.occ(s);
      const ok = cont.fitsAt(occ, s.id, p);
      let merge: Stack | null = null;
      if (!ok) {
        const bl = cont.blockers(occ, s.id, p);
        const list = this.listOf(where)!;
        if (bl.length === 1) { const m = list[bl[0] - 1]; if (m && m !== s && m.id === s.id && m.n < (ITEMS[s.id]?.stack ?? 1)) merge = m; }
      }
      return { kind: 'grid', cont: where, p, ok, merge };
    }
    // on the pack or the chest but not in a grid: nowhere
    const body: Rect = { x: this.PX + this.L.body.x, y: this.PY + this.L.lid.y + 10, w: this.L.body.w, h: this.L.body.y + this.L.body.h - this.L.lid.y - 10 };
    if (inR(body, mx, my)) return { kind: 'none' };
    if (this.CL && inR({ x: this.CX + this.CL.box.x, y: this.CY, w: this.CL.box.w, h: this.CL.H }, mx, my)) return { kind: 'none' };
    if (d.ref.where === 'offer') return { kind: 'none' };
    return { kind: 'ground', x: Math.max(2, Math.min(this.SW - w * CELL - 2, x)), y: Math.max(2, Math.min(this.SH - h * CELL - 2, y)) };
  }

  private drawGhost(d: Drag) {
    const g = this.ghostEl;
    const t = d.target;
    if (t.kind !== 'grid') { g.remove(); return; }
    const s = d.ref.s;
    const [w, h] = stackDims(s.id, d.r);
    const cs = fpCells(footprint(s.id), !!d.r);
    const key = `${s.id}|${d.r}|${t.ok ? 'ok' : t.merge ? 'merge' : 'bad'}`;
    if ((g as unknown as { __k?: string }).__k !== key) {
      (g as unknown as { __k?: string }).__k = key;
      g.innerHTML = '';
      g.appendChild(cv(ART.paintGhost(cs, w, h, t.ok ? 'ok' : t.merge ? 'merge' : 'bad')));
    }
    const [ox, oy] = this.gridOrigin(t.cont);
    at(g, ox + t.p.x * CELL, oy + t.p.y * CELL);
    if (g.parentElement !== this.stage) this.stage.insertBefore(g, this.dragEl);
  }

  private rotateHeld() {
    const d = this.drag;
    if (!d) return;
    const fp = footprint(d.ref.s.id);
    if (fp.w === fp.h && !fp.mask) { d.el.classList.add('nudge'); setTimeout(() => d.el.classList.remove('nudge'), 340); return; }
    d.r = d.r ? 0 : 1;
    this.itemEl(d.ref.s, d.ref.where, d.r, d.ref.lo);
    d.el.classList.add('lift');
    const [w, h] = stackDims(d.ref.s.id, d.r);
    d.gx = (w * CELL) / 2; d.gy = (h * CELL) / 2;
    sfx('reelClick', { vol: 0.3, pitch: 2 });
    this.moveDrag(d.px * this.s, d.py * this.s);
  }

  private endDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.ghostEl.remove();
    d.el.classList.remove('lift');
    const ok = this.moveTo(d.ref, d.target, d.r);
    this.sync();
    const e = this.itemEls.get(d.ref.s);
    if (e && ok) { e.classList.add('thud'); setTimeout(() => e.classList.remove('thud'), 220); sfx('place', { vol: 0.35, pitch: 0.9 + Math.random() * 0.2 }); }
    else if (e) { e.classList.add('nudge'); setTimeout(() => e.classList.remove('nudge'), 340); sfx('wrong', { vol: 0.3 }); }
    const nowRef = e ? this.refs.get(e) ?? null : null;
    if (nowRef && !this.touch) this.select(nowRef);
  }

  private cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.ghostEl.remove();
    d.el.classList.remove('lift');
    this.itemEl(d.ref.s, d.ref.where, d.ref.where === 'pack' || d.ref.where === 'stash' ? (d.ref.s.p?.r ?? 0) : (d.ref.lo?.r ?? 0), d.ref.lo);
    this.sync();
  }

  /** move a stack to a target; false when it could not go there (it stays where it was) */
  private moveTo(ref: Ref, t: Target, r: 0 | 1): boolean {
    const s = ref.s, id = s.id;
    if (t.kind === 'none') return false;
    if (t.kind === 'ground') {
      if (ITEMS[id]?.kind === 'key') { this.say(null, 'Better keep that.', '#ffd76a', 'shake'); return false; }
      // (already lying there)
      if (ref.where === 'ground') return true;
      // it drops out of the air to the ground at Mori's feet, in the world
      this.takeOut(ref);
      s.p = undefined;
      const pile = this.o.mori ? dropOnGround([s]) : null;
      if (!pile) this.loose.push({ s, where: 'ground', x: t.x, y: t.y, r });
      this.layGround();
      return true;
    }
    const list = this.listOf(t.cont)!;
    if (t.merge) {
      const max = ITEMS[id]?.stack ?? 1;
      const k = Math.min(s.n, max - t.merge.n);
      if (k <= 0) return false;
      t.merge.n += k;
      s.n -= k;
      if (s.n <= 0) this.takeOut(ref);
      return true;
    }
    if (!t.ok) return false;
    if (ref.where !== t.cont) {
      this.takeOut(ref);
      list.push(s);
    }
    s.p = t.p;
    return true;
  }

  /** take a stack out of wherever it is (a list, the ground, a heap, the lunch on the chest lid) */
  private takeOut(ref: Ref) {
    const s = ref.s;
    const list = this.listOf(ref.where);
    if (list) { const i = list.indexOf(s); if (i >= 0) list.splice(i, 1); s.p = undefined; }
    if (ref.lo) {
      const i = this.loose.indexOf(ref.lo);
      if (i >= 0) this.loose.splice(i, 1);
      if (ref.lo.pile) takeFromPile(ref.lo.pile, s);
      if (ref.lo.where === 'offer' && !this.lunchTaken) { this.lunchTaken = true; this.o.prep?.tookLunch?.(); }
    }
  }

  // ------------------------------------------------------------ actions

  /** turn an item where it lies (or as near as it fits) */
  private turnInPlace(ref: Ref) {
    const s = ref.s, fp = footprint(s.id);
    const el = this.itemEls.get(s);
    if (fp.w === fp.h && !fp.mask) { if (el) { el.classList.add('nudge'); setTimeout(() => el.classList.remove('nudge'), 340); } return; }
    if (ref.lo) { ref.lo.r = ref.lo.r ? 0 : 1; sfx('reelClick', { vol: 0.3, pitch: 2 }); this.sync(); this.select(this.refs.get(this.itemEls.get(s)!) ?? null); return; }
    const cont = this.contOf(ref.where);
    if (!cont || !s.p) return;
    const r2: 0 | 1 = s.p.r ? 0 : 1;
    const { occ } = cont.occ(s);
    const tries: [number, number][] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) tries.push([dx, dy]);
    tries.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])));
    for (const [dx, dy] of tries) {
      const p: Place = { a: s.p.a, x: s.p.x + dx, y: s.p.y + dy, r: r2 };
      if (cont.fitsAt(occ, s.id, p)) {
        s.p = p;
        sfx('reelClick', { vol: 0.35, pitch: 2 });
        this.sync();
        const e = this.itemEls.get(s);
        if (e) { e.classList.add('thud'); setTimeout(() => e.classList.remove('thud'), 220); }
        this.select(e ? this.refs.get(e) ?? null : null);
        return;
      }
    }
    sfx('wrong', { vol: 0.35 });
    if (el) { el.classList.add('nudge'); setTimeout(() => el.classList.remove('nudge'), 340); this.say(this.stageRectOf(el), 'No room to turn it', '#ffb08a', 'shake'); }
  }

  /** the swivel: turn what is in hand, or what is picked */
  private turnPressed() {
    if (this.drag) { this.rotateHeld(); return; }
    if (this.sel?.s && !this.sel.tool) { this.turnInPlace(this.sel); return; }
    sfx('reelClick', { vol: 0.25, pitch: 1.6 });
    this.say(this.stageRectOf(this.turnEl), 'Pick something to turn', '#ffe9a8');
  }

  /** shake it all down: part stacks top up, everything resettles biggest first */
  private repack() {
    if (this.drag || this.busy) return;
    this.busy = true;
    sfx('rustle', { vol: 0.5, pitch: 0.8 });
    this.pk.classList.add('shake');
    setTimeout(() => {
      this.pk.classList.remove('shake');
      const out = PACK.arrange();
      // (never happens with a pack that was fine; just in case, onto the ground)
      for (const s of out) this.moveTo({ s, where: 'pack' }, { kind: 'ground', x: 0, y: 0 }, flatR(s.id));
      this.select(null);
      this.sync();
      let i = 0;
      for (const [s, e] of this.itemEls) if (game.save.inv.includes(s)) { e.style.setProperty('--d', `${Math.min(i++, 12) * 0.035}s`); e.classList.add('pop'); setTimeout(() => e.classList.remove('pop'), 500 + i * 35); }
      sfx('place', { vol: 0.3 });
      this.busy = false;
    }, reduced() ? 0 : 480);
  }

  /** drop a stack out of the pack (or the chest): it falls to the ground at Mori's feet */
  private dropOut(ref: Ref) {
    if (ITEMS[ref.s.id]?.kind === 'key') { this.say(this.elOf(ref) ? this.stageRectOf(this.elOf(ref)!) : null, 'Better keep that.', '#ffd76a', 'shake'); return; }
    const el = this.elOf(ref);
    const from = el ? this.stageRectOf(el) : null;
    this.select(null);
    this.moveTo(ref, { kind: 'ground', x: this.PX, y: this.PY + this.L.H }, flatR(ref.s.id));
    this.sync();
    // (the one that fell drops in from where it was)
    const fell = this.loose.find(l => l.s.id === ref.s.id && l.where === 'ground');
    const e = fell ? this.itemEls.get(fell.s) : null;
    if (e && from) e.animate([{ transform: `translate(${Math.round(from.x - fell!.x)}px, ${Math.round(from.y - fell!.y)}px)` }, { transform: 'none' }], { duration: reduced() ? 1 : 320, easing: 'cubic-bezier(.5,0,.9,.5)' });
  }

  /** pick something up off the ground (or the lunch off the chest lid) into the pack */
  private take(ref: Ref) {
    const s = ref.s;
    const { occ } = PACK.occ();
    const p = PACK.findSpot(occ, s.id);
    if (!p) { sfx('wrong', { vol: 0.35 }); const el = this.elOf(ref); this.say(el ? this.stageRectOf(el) : null, 'No room in the pack', '#ffb08a', 'shake'); return; }
    this.select(null);
    this.moveTo(ref, { kind: 'grid', cont: 'pack', p, ok: true, merge: null }, p.r);
    this.sync();
    const e = this.itemEls.get(s);
    if (e) { e.classList.add('pop'); setTimeout(() => e.classList.remove('pop'), 400); }
    sfx('place', { vol: 0.35 });
  }

  /** eat one: a bite floats over to Mori's mouth; hunger and the forage gamble */
  private async eat(ref: Ref) {
    const s = ref.s, id = s.id;
    if (ref.where !== 'pack' || this.busy) return;
    const el = this.itemEls.get(s);
    const rr = el ? this.stageRectOf(el) : null;
    const can = canEat(id);
    if (!can.ok) { sfx('wrong', { vol: 0.4 }); this.say(rr, can.reason?.replace(/’/g, "'") ?? 'Not now', '#ffb08a', 'shake', 1900); return; }
    this.busy = true;
    const fi = foodInfo(id);
    this.select(null);
    if (el && rr) {
      // one of it (a copy when it's a stack) arcs out of the pack to his mouth and is gone
      const c = el.cloneNode(true) as HTMLElement;
      c.querySelector('.n')?.remove();
      c.classList.remove('sel', 'hov');
      this.dragEl.appendChild(c);
      at(c, Math.round(rr.x), Math.round(rr.y));
      if (s.n <= 1) el.style.visibility = 'hidden';
      const [tx, ty] = this.mouth ?? [rr.x, rr.y + 60];
      const dx = Math.round(tx - rr.x - rr.w / 2), dy = Math.round(ty - rr.y - rr.h / 2);
      const a = c.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.round(dx * 0.5)}px, ${Math.round(dy * 0.5) - 26}px) scale(0.8)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0 },
      ], { duration: reduced() ? 1 : 420, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
      await a.finished.catch(() => {});
      c.remove();
    }
    let r: ReturnType<typeof eatFood> | null = null;
    try { r = eatFood(id, { quiet: true }); } catch (e) { console.error(e); }
    if (r?.ok) {
      // V12 hunger (src/game/v12/hunger.ts): food fills him up by what it's worth
      try { feed(Math.max(0.05, Math.min(1, fi.energy / 40))); } catch (e) { console.error(e); }
      const line = r.fx === 'none' ? (fi.verdict === 'unknown' ? 'Tastes fine. I think.' : fi.energy >= 20 ? 'Mmm. That hit the spot.' : 'Mm. A bite.') : r.fx === 'dizzy' ? 'Whoa... the ground tilts...' : r.fx === 'big' ? 'Oh no. Oh no no no.' : 'Urgh. My stomach...';
      this.say(rr, line, r.fx === 'none' ? '#c8f0a0' : '#ffb08a', r.fx === 'none' ? 'wave' : 'shake', 2000);
    } else this.say(rr, r?.reason?.replace(/’/g, "'") ?? 'Not now', '#ffb08a', 'shake');
    this.busy = false;
    this.sync();
  }

  private async use(ref: Ref) {
    const u = useOf(ref.s.id);
    if (!u || this.busy) return;
    this.busy = true;
    try { await u.fn(ref.s.id); } catch (e) { console.error(e); }
    this.busy = false;
    this.sync();
    this.select(null);
  }

  /** a tool's use (the billy can: cook): the pack shuts first */
  private async useTool(id: string) {
    const u = useOf(id);
    if (!u || this.busy) return;
    this.busy = true;
    await this.close();
    setTimeout(() => { void Promise.resolve(u.fn(id)).catch(e => console.error(e)); }, 900);
  }

  // ------------------------------------------------------------ the ground and camp

  // ------------------------------------------------------------ camp

  /** prep: Joshu's packed lunch waiting on the chest lid (again: after a resize) */
  private offerLunch(again?: Loose[]) {
    const CL = this.CL;
    const lunch = again ? again.map(l => ({ id: l.s.id, n: l.s.n, s: l.s })) : (this.o.prep?.lunch?.() ?? []).map(l => ({ ...l, s: { id: l.id, n: l.n } as Stack }));
    if (!CL || !lunch.length) return;
    let x = this.CX + CL.lid.x + CL.lid.w - 8;
    for (const l of lunch) {
      if (!ITEMS[l.id]) continue;
      const [w] = stackDims(l.id, flatR(l.id));
      x -= w * CELL + 4;
      this.loose.push({ s: l.s, where: 'offer', x, y: this.CY + CL.lid.y + 2, r: flatR(l.id) });
    }
  }

  /** prep: the crew's last word, floating at the top of the view */
  private showTip() {
    const tip = this.o.prep?.tip?.();
    if (!tip) return;
    const [who, text] = tip;
    const WW = Math.ceil(window.innerWidth / this.ws);
    const lines = pxWrap(text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"'), Math.min(WW - 20, 220), 'body');
    let y = 6;
    const nm = pxWord(who.toUpperCase(), { font: 'bold', color: '#ffd27a', anim: 'pop' });
    at(nm, Math.round(WW / 2 - nm.wW / 2), y);
    this.words.appendChild(nm);
    y += nm.wH + 1;
    const els: HTMLElement[] = [nm];
    lines.forEach((ln, i) => {
      const w = pxWord(ln, { font: 'body', color: '#fff6dc', delay: 200 + i * 300, step: 22, anim: 'wave' });
      at(w, Math.round(WW / 2 - w.wW / 2), y);
      y += w.wH;
      this.words.appendChild(w);
      els.push(w);
    });
    setTimeout(() => { for (const e of els) void wordOut(e); }, 7000);
  }
}

/** things lying about lie on their long side */
const flatR = (id: string): 0 | 1 => { const f = footprint(id); return f.h > f.w ? 1 : 0; };
void ({} as Occ);
