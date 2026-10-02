// V11 Backpack screen. Mori swings his pack off, the world blurs and freezes behind, and the pack
// drops onto the ground in front of you: an old olive canvas rucksack with leather trim, its lid
// buckled shut. The buckles pop, the lid flips back, and the contents settle into the compartment.
//
//  - the compartment is a tile grid (Backpack Hero / RE4): every item takes its footprint shape
//    (src/game/v11/footprints.ts), drawn with its illustrated artwork (src/art/v11/itemart.ts, the old
//    icon until it has some). Drag and drop to rearrange; R / right click / the wheel turns the item in
//    hand (two fingers, or the turn button, on touch); a stack shows its count in the corner; dropping
//    a stack on the same thing tops it up; what doesn't fit is refused with a nudge
//  - the tools ride in their own holders round the outside: the camera on its strap, the binoculars
//    case, the jar pocket, the knife sheath, the slingshot loop, the phone pocket...
//  - the brass spring balance hanging beside the pack weighs it (energy.ts packWeight against
//    packCapacity); its tag says the kilos in Mori's hand and the rod drops into the red when it's
//    too heavy. Change the load and the balance bobs
//  - pick something up (or hover it) and its specimen tag swings in: the artwork, its name in
//    hand-lettering, a line about it, its weight, and eat / use / drop / inspect (inspect turns the
//    tag over for the full field notes)
//  - the ground: anything lying by Mori (a gift with no room, what he dropped) lies next to the bag;
//    drag it in, or drag things out of the bag to leave them there
//  - Repack shakes the bag and everything resettles biggest first
//  - at camp the stash chest stands beside the pack (mode 'stash'), and packing up at the trail sign
//    (mode 'prep') adds Joshu's packed lunch on the chest lid, the crew's last word and the sign to
//    set off by
//
// Opened through openBackpack (src/ui/backpack.ts) everywhere the old pack opened.

import { game } from '../../game/game';
import { ITEMS } from '../../game/items';
import type { ItemKind } from '../../game/items';
import type { Stack, Place } from '../../game/inventory';
import { onInvChange } from '../../game/inventory';
import { PACK, packAreas, toolSlotOf, stackCells, stackDims, Container } from '../../game/v11/backpack';
import type { Occ } from '../../game/v11/backpack';
import { footprint, cells as fpCells } from '../../game/v11/footprints';
import { STASH, STASH_AREAS, stashStacks } from '../../game/v11/stash';
import { pileNear, dropOnGround, takeFromPile, groundPiles } from '../../game/v11/ground';
import type { Pile } from '../../game/v11/ground';
import { itemArtCanvas } from '../../art/v11/itemart';
import { itemIcon } from '../../art/itemicons';
import { packWeight, packCapacity, weightOf } from '../../game/v10/energy';
import { foodInfo, canEat, eatFood, timesSick } from '../../game/v10/forage10';
import { analysisRp } from '../../game/lab';
import { el } from '../ui';
import { css, sfx, esc, pushKeys, reduced } from '../laptop-kit';
import { pxIconBuf } from '../pxicons';
import { packIcons } from './packicons';
import { ensureHandFont, handLetter, onHandFont } from './handletter';
import * as ART from './bagart';
import type { BagLayout, ChestLayout, Rect, GroundKind, HolderId } from './bagart';
import { packOff } from './takeoff';

packIcons();
const CELL = ART.CELL;
/** where the spring balance hangs (stage x of its tube's centre) */
const SCALE_X = 38;

export type PackMode = 'pack' | 'stash' | 'prep';
export interface PrepHooks {
  /** what Joshu would pack for lunch today (null: already taken / nothing in the stores) */
  lunch?: () => { id: string; n: number }[] | null;
  /** Mori took it (mark the day's lunch as taken) */
  tookLunch?: () => void;
  /** a last word from the crew: [who, line] */
  tip?: () => [string, string] | null;
}
export interface PackOpts {
  mode?: PackMode;
  /** old callers' eat hook (ignored: eating goes through v10/forage10 eatFood here) */
  onEat?: (id: string) => void | Promise<void>;
  /** play the take-off in the world (default yes) */
  anim?: boolean;
  prep?: PrepHooks;
}
export type PackResult = 'closed' | 'go';

/** item uses other modules provide (the card's Use action): by item id or by kind */
type UseFn = (id: string) => void | Promise<void>;
const USES: Record<string, { label: string; fn: UseFn; icon?: string }> = {};
export function registerItemUse(idOrKind: string, label: string, fn: UseFn, icon = 'v11hand') { USES[idOrKind] = { label, fn, icon }; }
const useOf = (id: string) => USES[id] ?? USES['kind:' + (ITEMS[id]?.kind ?? '')] ?? null;

// ---------------------------------------------------------------- styles

const CSS = `
.bp11 { position: absolute; inset: 0; z-index: 36; pointer-events: auto; touch-action: none; overflow: hidden; user-select: none; -webkit-user-select: none; font-family: 'Jersey 15', 'Pixelify Sans', monospace; }
.bp11 .bg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: auto !important; opacity: 0; transition: opacity 0.3s; }
.bp11 .bg.veil { background: rgba(14, 10, 4, 0.55); }
.bp11.on .bg { opacity: 1; }
.bp11 canvas.ic { display: inline-block; vertical-align: middle; flex: none; }
.bp11 .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 45% 55%, rgba(8,6,2,0.05) 25%, rgba(8,6,2,0.62) 100%); opacity: 0; transition: opacity 0.35s; }
.bp11.on .dim { opacity: 1; }
.bp11 canvas, .bp11 img { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
.bp11 .gnd { position: absolute; left: 0; transform-origin: 0 0; opacity: 0; transition: opacity 0.35s; }
.bp11.on .gnd { opacity: 1; }
.bp11 .stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.bp11 .abs { position: absolute; left: 0; top: 0; }
.bp11 .bag { position: absolute; will-change: transform; }
.bp11 .bag.drop { animation: bp11Drop 0.5s cubic-bezier(.3,1.5,.5,1) both; }
@keyframes bp11Drop { 0% { transform: translateY(-46px); opacity: 0; } 55% { opacity: 1; } }
.bp11 .bag.shake { animation: bp11Shake 0.5s steps(10) both; }
@keyframes bp11Shake { 20% { transform: translate(-3px, -2px) rotate(-1.5deg); } 40% { transform: translate(3px, -4px) rotate(1.5deg); } 60% { transform: translate(-2px, -1px) rotate(-1deg); } 80% { transform: translate(2px, -2px) rotate(0.6deg); } }
.bp11 .bag.out { transition: transform 0.4s cubic-bezier(.5,0,.8,.4), opacity 0.4s; transform: translateY(60px); opacity: 0; }
.bp11 .flap { position: absolute; transform-origin: 50% 0; backface-visibility: hidden; }
.bp11 .lid { position: absolute; transform-origin: 50% 100%; }
.bp11 .cells, .bp11 .items, .bp11 .tools { position: absolute; left: 0; top: 0; }
.bp11 .it { position: absolute; cursor: grab; touch-action: none; }
.bp11 .it .fc { position: absolute; left: 0; top: 0; opacity: 0.9; }
.bp11 .it.sel .fc { filter: brightness(1.9) sepia(1) hue-rotate(5deg) saturate(2.4); opacity: 1; }
.bp11 .it.hov .fc { filter: brightness(1.5); opacity: 1; }
.bp11 .it.lift .fc { opacity: 0; }
.bp11 .it .art { position: absolute; pointer-events: none; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.55)); }
.bp11 .it .n { position: absolute; font-size: 9px; line-height: 1; color: #fff8e0; pointer-events: none; text-shadow: 1px 0 0 #120e07, -1px 0 0 #120e07, 0 1px 0 #120e07, 0 -1px 0 #120e07, 1px 1px 0 #120e07; letter-spacing: 0.02em; }
.bp11 .it .n.max { color: #ffd24a; }
.bp11 .it.lift { cursor: grabbing; z-index: 50; }
.bp11 .it.lift .art { filter: drop-shadow(2px 4px 0 rgba(0,0,0,0.45)); }
.bp11 .it.settle { animation: bp11Settle 0.42s cubic-bezier(.3,1.6,.5,1) both; animation-delay: var(--d, 0s); }
@keyframes bp11Settle { 0% { transform: translateY(-26px) rotate(var(--rr, -5deg)); opacity: 0; } 50% { opacity: 1; } }
.bp11 .it.thud { animation: bp11Thud 0.22s ease-out; }
@keyframes bp11Thud { 40% { transform: translateY(1px) scale(1.04, 0.96); } }
.bp11 .it.nudge { animation: bp11Nudge 0.36s ease-out; }
@keyframes bp11Nudge { 20% { transform: translateX(-2px) rotate(-2deg); } 45% { transform: translateX(2px) rotate(2deg); } 70% { transform: translateX(-1px); } }
.bp11 .it.hidden { visibility: hidden; }
.bp11 .ghost { position: absolute; width: ${CELL}px; height: ${CELL}px; pointer-events: none; }
.bp11 .ghost.ok { background: rgba(140, 220, 90, 0.28); box-shadow: inset 0 0 0 1px rgba(170, 255, 120, 0.8); }
.bp11 .ghost.bad { background: rgba(230, 80, 50, 0.3); box-shadow: inset 0 0 0 1px rgba(255, 120, 90, 0.85); }
.bp11 .ghost.merge { background: rgba(255, 210, 80, 0.3); box-shadow: inset 0 0 0 1px rgba(255, 230, 120, 0.9); }
.bp11 .tool { position: absolute; cursor: pointer; display: grid; place-items: center; }
.bp11 .tool canvas { filter: drop-shadow(0 1px 0 rgba(0,0,0,0.5)); }
.bp11 .tool.sel { outline: 1px solid rgba(255, 220, 110, 0.9); outline-offset: -1px; }
.bp11 .scale { position: absolute; transform-origin: 50% 0; }
.bp11 .gtag { position: absolute; transform-origin: 50% 0; }
.bp11 .strapline { position: absolute; height: 3px; background: linear-gradient(#a86f38 0 1px, #6d3d1b 1px 2px, #311809 2px); transform-origin: 0 50%; box-shadow: 0 1px 0 rgba(0,0,0,0.4); }
.bp11 .card { position: absolute; width: 112px; height: 164px; transform-origin: 50% 0; perspective: 500px; pointer-events: auto; }
.bp11 .card .str { position: absolute; left: 55px; bottom: 100%; width: 1px; background: #d8c690; box-shadow: 1px 0 0 rgba(0,0,0,0.3); }
.bp11 .card .face { position: absolute; inset: 0; backface-visibility: hidden; transition: transform 0.45s cubic-bezier(.3,1.3,.5,1); color: #2e2414; }
.bp11 .card .face canvas.paper { position: absolute; left: 0; top: 0; }
.bp11 .card .back { transform: rotateY(180deg); }
.bp11 .card.flip .front { transform: rotateY(-180deg); }
.bp11 .card.flip .back { transform: rotateY(0deg); }
.bp11 .card.swing { animation: bp11Swing 0.7s cubic-bezier(.3,1.4,.5,1) both; }
@keyframes bp11Swing { 0% { transform: rotate(-14deg) translateY(-30px); opacity: 0; } 40% { opacity: 1; } 65% { transform: rotate(4deg); } }
.bp11 .card .pic { position: absolute; left: 6px; top: 15px; width: 100px; height: 52px; display: grid; place-items: center; }
.bp11 .card .nm { position: absolute; left: 4px; right: 4px; top: 66px; display: flex; justify-content: center; }
.bp11 .card .note { position: absolute; left: 9px; right: 8px; top: 92px; font-size: 7.5px; line-height: 8.6px; color: #3a2e18; }
.bp11 .card .facts { position: absolute; left: 8px; right: 8px; top: 120px; display: flex; gap: 5px; align-items: center; font-size: 7.5px; line-height: 1; color: #3a2e18; white-space: nowrap; }
.bp11 .card .facts span { display: inline-flex; align-items: center; gap: 2px; }
.bp11 .card .stamp { position: absolute; right: 7px; top: 56px; transform: rotate(-12deg); font-size: 7px; padding: 1px 3px 0; border: 1px solid currentColor; letter-spacing: 0.06em; opacity: 0.85; }
.bp11 .card .stamp.safe { color: #2f6b2a; } .bp11 .card .stamp.unknown { color: #a8661a; } .bp11 .card .stamp.poison { color: #a8382a; }
.bp11 .card .acts { position: absolute; left: 5px; right: 5px; bottom: 6px; display: flex; gap: 3px; justify-content: center; }
.bp11 .card .acts button { all: unset; box-sizing: border-box; width: 24px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer;
  background: #c8a868; box-shadow: inset 0 0 0 1px #5a4628, inset 0 -2px 0 rgba(0,0,0,0.18); font-size: 5.5px; letter-spacing: 0.04em; color: #2e2414; text-transform: uppercase; }
.bp11 .card .acts button:hover { background: #dcc080; }
.bp11 .card .acts button:active { transform: translateY(1px); }
.bp11 .card .acts button.red { background: #c88a6a; }
.bp11 .card .acts button.go { background: #a8c070; }
.bp11 .card .acts button:disabled { opacity: 0.45; cursor: default; }
.bp11 .card .back .txt { position: absolute; left: 9px; right: 8px; top: 18px; bottom: 30px; font-size: 7px; line-height: 8.2px; color: #3a2e18; overflow: hidden; }
.bp11 .card .back .txt b { color: #2f5a22; font-weight: normal; letter-spacing: 0.04em; }
.bp11 .card .back .txt i { font-style: normal; color: #7a5a2a; }
.bp11 .card .hint { position: absolute; left: 0; right: 0; top: 60px; text-align: center; font-size: 7.5px; color: #6a5634; }
.bp11 .btns { position: absolute; display: flex; gap: 4px; }
.bp11 .pbtn { all: unset; box-sizing: border-box; height: 18px; min-width: 18px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; cursor: pointer;
  border-style: solid; border-width: 3px; border-image: var(--sk-btn-wood) 4 fill / 3px / 0 stretch; color: #fff6dc; font-size: 7px; letter-spacing: 0.06em; text-shadow: 0 1px 0 rgba(0,0,0,0.7); }
.bp11 .pbtn:hover { filter: brightness(1.15); }
.bp11 .pbtn:active { transform: translateY(1px); }
.bp11 .pbtn.green { border-image-source: var(--sk-btn); }
.bp11 .pbtn.amber { border-image-source: var(--sk-btn-amber); }
.bp11 .pbtn[hidden] { display: none; }
.bp11 .keys { position: absolute; font-size: 6.5px; color: rgba(255, 246, 220, 0.75); white-space: nowrap; text-shadow: 0 1px 0 #000; letter-spacing: 0.03em; }
.bp11 .keys b { color: #ffe9a8; font-weight: normal; }
.bp11 .tipb { position: absolute; max-width: 120px; font-size: 7.5px; line-height: 8.5px; color: #0c0a0c; background: #fff; padding: 3px 5px 4px; box-shadow: 0 0 0 1px #0c0a0c, 2px 2px 0 1px rgba(0,0,0,0.4); animation: bp11Pop 0.35s cubic-bezier(.2,1.7,.4,1) both 0.9s; }
.bp11 .tipb b { display: block; font-size: 6px; letter-spacing: 0.1em; color: #6a5634; }
@keyframes bp11Pop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.06); opacity: 1; } }
.bp11 .sign { position: absolute; cursor: pointer; }
.bp11 .sign:hover { filter: brightness(1.12); }
.bp11 .sign .lbl { position: absolute; left: 8px; top: 9px; width: 44px; text-align: center; font-size: 8px; color: #fff3cc; text-shadow: 0 1px 0 #2a1408; letter-spacing: 0.05em; pointer-events: none; }
.bp11 .chest { position: absolute; }
.bp11 .chest.in { animation: bp11Drop 0.5s cubic-bezier(.3,1.5,.5,1) both 0.15s; }
.bp11 .rotb { position: absolute; width: 20px; height: 20px; display: none; place-items: center; z-index: 60; border-radius: 50%; background: rgba(20,14,6,0.75); box-shadow: 0 0 0 1px #ffd24a; }
.bp11.touch .rotb.on { display: grid; }
.bp11 .floatmsg { position: absolute; font-size: 8px; color: #fff3cc; text-shadow: 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000; pointer-events: none; animation: bp11Float 1.1s ease-out forwards; white-space: nowrap; }
@keyframes bp11Float { 0% { transform: translateY(4px); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-16px); opacity: 0; } }
`;

// ---------------------------------------------------------------- small helpers

const KIND_WORD: Record<ItemKind, string> = { tool: 'tool', material: 'material', plant: 'plant', fungus: 'fungus', insect: 'insect', animal: 'sample', lure: 'lure', food: 'food', key: 'keepsake', shell: 'shell' };
const kgText = (v: number) => (v < 0.1 ? `${Math.max(1, Math.round(v * 1000))} g` : v < 1 ? `${Math.round(v * 1000 / 10) * 10} g` : `${v.toFixed(1)} kg`);
const firstSentence = (s: string) => { const m = s.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : s).trim(); };

/** the item's picture at 1x: its artwork when it has some, else the old icon (copied straight onto a
 *  canvas: no image encoding, which is slow when the GPU is busy) */
function picCanvas(id: string): HTMLCanvasElement {
  const art = itemArtCanvas(id);
  if (art && art.width > 0) {
    const c = document.createElement('canvas');
    c.width = art.width; c.height = art.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0);
    return c;
  }
  return bufCanvas(itemIcon(id));
}
/** a picture scaled by whole pixels to fit a box (or shrunk crisply when it is too big) */
function fitPic(id: string, bw: number, bh: number, up = true): HTMLCanvasElement {
  const c = picCanvas(id);
  let k = Math.min(bw / c.width, bh / c.height);
  // (a picture a little bigger than its box just overhangs it: halving pixel art looks worse)
  if (k >= 0.8) {
    k = up && k >= 2 ? Math.floor(k) : 1;
    c.style.width = c.width * k + 'px'; c.style.height = c.height * k + 'px';
    return c;
  }
  const sm = ART.shrinkTo(c, bw, bh);
  sm.style.width = sm.width + 'px'; sm.style.height = sm.height + 'px';
  return sm;
}
/** a painted glyph as a canvas (drawn straight from its pixels) */
function icon(name: string): HTMLCanvasElement { return bufCanvas(pxIconBuf(name), 'ic'); }
/** an element with an icon and a label */
function iconLabel(tag: string, cls: string, ic: string | null, label: string): HTMLElement {
  const e = el(tag as 'div', cls);
  if (ic) e.appendChild(icon(ic));
  if (label) e.appendChild(el('span', '', label));
  return e;
}
function bufCanvas(b: { w: number; h: number; bytes: Uint8Array }, cls = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  if (cls) c.className = cls;
  // (kept on the CPU: these are small, painted once, and copying from them never waits on the GPU)
  c.getContext('2d', { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  c.style.width = b.w + 'px'; c.style.height = b.h + 'px';
  return c;
}
const place = (e: HTMLElement, x: number, y: number, w?: number, h?: number) => {
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if (w !== undefined) e.style.width = w + 'px';
  if (h !== undefined) e.style.height = h + 'px';
};
const groundKind = (): GroundKind => {
  const g = (game.scene as unknown as { player?: { ground?: string } } | null)?.player?.ground;
  return g === 'wood' ? 'deck' : g === 'sand' || g === 'water' ? 'sand' : g === 'leaves' || g === 'grass' ? 'forest' : 'sand';
};

type Where = 'pack' | 'stash' | 'ground' | 'offer';
interface Loose { s: Stack; where: 'ground' | 'offer'; pile?: Pile; spill?: boolean; x: number; y: number }
type Target = { kind: 'grid'; cont: 'pack' | 'stash'; p: Place; ok: boolean; merge: Stack | null } | { kind: 'ground' } | null;
interface Drag {
  s: Stack; from: Where; e: HTMLElement; pid: number;
  gx: number; gy: number; r: 0 | 1; orig: Place | undefined; loose?: Loose;
  /** pointer position (stage px) */
  px: number; py: number;
  /** split off from this stack (shift-drag takes one) */
  splitFrom?: Stack;
  target: Target;
  key?: boolean;
}

// ---------------------------------------------------------------- the screen

let current: Promise<PackResult> | null = null;
/** the screen up right now (null when closed) */
let screen: PackScreen | null = null;
export const backpackOpen = () => !!screen;

/** Open the Backpack (the world part, then the screen). Resolves when it's closed; 'go' when Mori
 *  set off from the trail sign (mode 'prep'). */
export function openBackpack11(o: PackOpts = {}): Promise<PackResult> {
  if (current) return current;
  current = (async () => {
    css('bp11', CSS);
    void ensureHandFont();
    game.ui.modalOpen++;
    let putOn: (() => Promise<void>) | null = null;
    try {
      const off = await packOff({ anim: o.anim });
      putOn = off.putOn;
      const sc = new PackScreen(o, off.backdrop);
      screen = sc;
      const r = await sc.run();
      return r;
    } catch (e) {
      console.error('[backpack]', e);
      return 'closed' as PackResult;
    } finally {
      screen = null;
      try { await putOn?.(); } catch (e) { console.error(e); }
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      game.persist();
      const hud = (game.scene as unknown as { hud?: { refresh(f?: boolean): void } | null })?.hud;
      hud?.refresh(true);
    }
  })().finally(() => { current = null; });
  return current;
}

class PackScreen {
  readonly mode: PackMode;
  root: HTMLElement;
  stage: HTMLElement;
  gndCv: HTMLCanvasElement | null = null;
  s = 2;
  W = 0; H = 0;
  L: BagLayout;
  CL: ChestLayout | null = null;
  bagX = 0; bagY = 0;
  chestX = 0; chestY = 0;
  groundY = 0;
  bagEl!: HTMLElement;
  itemsEl!: HTMLElement;
  cellsEl!: HTMLElement;
  toolsEl!: HTMLElement;
  overCv: HTMLCanvasElement | null = null;
  flapEl!: HTMLElement;
  lidEl!: HTMLElement;
  chestEl: HTMLElement | null = null;
  chestItems: HTMLElement | null = null;
  looseEl!: HTMLElement;
  dragEl!: HTMLElement;
  card!: HTMLElement;
  scaleEl!: HTMLElement;
  rodEl!: HTMLElement;
  slideEl!: HTMLElement;
  gtag!: HTMLElement;
  strapEl!: HTMLElement;
  rotBtn!: HTMLElement;
  cardX = 0; cardY = 0; cardDock = true;
  itemEls = new Map<Stack, HTMLElement>();
  toolEls = new Map<string, HTMLElement>();
  loose: Loose[] = [];
  sel: { s?: Stack; tool?: string } | null = null;
  hover: { s?: Stack; tool?: string } | null = null;
  drag: Drag | null = null;
  pending: { s: Stack; from: Where; x: number; y: number; pid: number; e: HTMLElement; shift: boolean; loose?: Loose } | null = null;
  touch = false;
  pointers = new Set<number>();
  opened = false;
  busy = false;
  closing = false;
  result: PackResult = 'closed';
  private resolve!: (r: PackResult) => void;
  private offs: (() => void)[] = [];
  private raf = 0;
  private wShown = 0; wVel = 0;
  private lastW = -1;
  private hoverT: ReturnType<typeof setTimeout> | null = null;
  private keyCur: { a: string; x: number; y: number } | null = null;

  constructor(o: PackOpts, readonly backdrop: HTMLCanvasElement | null = null) {
    this.mode = o.mode ?? 'pack';
    this.opts = o;
    this.root = el('div', 'bp11');
    this.stage = el('div', 'stage');
    this.L = ART.bagLayout(packAreas());
    if (this.mode !== 'pack') this.CL = ART.chestLayout(STASH_AREAS[0].cols, STASH_AREAS[0].rows);
  }
  private opts: PackOpts;

  // ------------------------------------------------------------ open / close
  async run(): Promise<PackResult> {
    const done = new Promise<PackResult>(r => (this.resolve = r));
    // the pack's contents: everything placed, what has no room comes out on the ground
    const spill = PACK.reconcile();
    if (this.mode !== 'pack') STASH.reconcile();
    this.build(spill);
    game.ui.modalLayer.appendChild(this.root);
    requestAnimationFrame(() => this.root.classList.add('on'));
    this.listen();
    await this.openAnim();
    return done;
  }

  private build(spill: Stack[]) {
    const r = this.root, L = this.L;

    // the frozen world, soft and dim (or just a dark veil)
    if (this.backdrop) { this.backdrop.className = 'bg'; r.appendChild(this.backdrop); }
    else r.appendChild(el('div', 'bg veil'));
    r.appendChild(el('div', 'dim'));
    // ---- layout in art px
    this.fit();
    // ---- the ground strip (full width, behind everything)
    const gc = this.groundCanvas();
    r.appendChild(gc);
    r.appendChild(this.stage);
    const st = this.stage;
    // ---- the spring balance hanging from its peg
    this.buildScale();
    // ---- the bag
    const bag = this.bagEl = st.appendChild(el('div', 'bag drop'));
    place(bag, this.bagX, this.bagY, L.W, L.H);
    const body = bufCanvas(ART.paintBag(L), 'abs');
    bag.appendChild(body);
    this.cellsEl = bag.appendChild(el('div', 'cells'));
    this.toolsEl = bag.appendChild(el('div', 'tools'));
    this.itemsEl = bag.appendChild(el('div', 'items'));
    this.renderTools();
    // the lid, thrown back (hidden until it opens) and the flap, buckled shut
    const lid = this.lidEl = bag.appendChild(el('div', 'lid'));
    lid.appendChild(bufCanvas(ART.paintLid(L)));
    place(lid, L.lid.x, L.lid.y, L.lid.w, L.lid.h);
    lid.style.transform = 'scaleY(0)';
    lid.style.zIndex = '0';
    this.itemsEl.style.zIndex = '2';
    // the lid sits behind the body's top edge
    bag.insertBefore(lid, body);
    const flap = this.flapEl = bag.appendChild(el('div', 'flap'));
    flap.appendChild(bufCanvas(ART.paintFlap(L)));
    place(flap, L.flap.x, L.flap.y);
    flap.style.zIndex = '5';
    // ---- the stash chest
    if (this.CL) {
      const ch = this.chestEl = st.appendChild(el('div', 'chest in'));
      place(ch, this.chestX, this.chestY, this.CL.W, this.CL.H);
      ch.appendChild(bufCanvas(ART.paintChest(this.CL), 'abs'));
      this.chestItems = ch.appendChild(el('div', 'items'));
    }
    // ---- things on the ground, the drag layer, the card
    this.looseEl = st.appendChild(el('div', 'items'));
    this.dragEl = st.appendChild(el('div', 'items'));
    this.dragEl.style.zIndex = '40';
    this.card = st.appendChild(el('div', 'card'));
    this.card.style.display = 'none';
    this.rotBtn = st.appendChild(el('div', 'rotb'));
    this.rotBtn.appendChild(icon('v11rot'));
    this.rotBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.rotate(); });
    this.buildButtons();
    if (this.mode === 'prep') this.buildPrep();
    // ---- the contents
    for (const s of spill) this.loose.push({ s, where: 'ground', spill: true, x: 0, y: 0 });
    const pile = pileNear(80);
    if (pile) for (const s of pile.stacks) this.loose.push({ s, where: 'ground', pile, x: 0, y: 0 });
    this.sync(true);
    this.updateScale(true);
    onHandFont(() => { if (this.sel || this.hover) this.renderCard(); this.updateScale(true); });
  }

  /** work out the scale and where everything goes */
  private fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const L = this.L, CL = this.CL;
    const M = 6, SCW = 44, GAP = 12, CARD_W = 112, CARD_H = 164, GROUND = 30, TOP = 10;
    const portrait = vh > vw * 1.05;
    const bagH = L.H;
    const chestW = CL ? CL.W + GAP + (this.mode === 'prep' ? 40 : 0) : 0;
    let W: number, Hh: number;
    let cardDock = true;
    if (!portrait) {
      W = M + SCW + L.W + chestW + GAP + CARD_W + M;
      Hh = TOP + Math.max(bagH, CL ? CL.H - 10 : 0, CARD_H - 10) + GROUND;
      // too cramped for a card column: let it float
      const sDock = Math.min(vw / W, vh / Hh);
      const W2 = W - CARD_W - GAP;
      const s2 = Math.min(vw / W2, vh / Hh);
      if (CL && s2 > sDock * 1.18) { W = W2; cardDock = false; }
    } else {
      W = Math.max(M + SCW + L.W + M, CL ? CL.W + M * 2 : 0);
      Hh = TOP + bagH + GROUND + (CL ? CL.H + 6 : 0) + CARD_H + 10;
    }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    let s = Math.min(vw / W, vh / Hh, 3.2);
    s = Math.max(1 / dpr, Math.floor(s * dpr) / dpr);
    this.s = s;
    this.W = W; this.H = Hh;
    // centre the composition
    const ox = Math.round((vw / s - W) / 2), oy = Math.round((vh / s - Hh) / 2);
    this.stage.style.transform = `scale(${s})`;
    this.stage.style.width = W + 'px'; this.stage.style.height = Hh + 'px';
    this.stage.style.left = Math.round(ox * s) + 'px'; this.stage.style.top = Math.round(oy * s) + 'px';
    this.bagX = M + SCW; this.bagY = TOP;
    this.groundY = this.bagY + L.body.y + L.body.h - 7;
    if (!portrait) {
      if (CL) { this.chestX = this.bagX + L.W + GAP; this.chestY = this.groundY + 9 - CL.H; }
      const right = this.bagX + L.W + chestW + GAP;
      this.cardDock = cardDock;
      this.cardX = cardDock ? right : (CL ? this.chestX + CL.W - CARD_W : W - CARD_W - M);
      this.cardY = cardDock ? TOP + 8 : TOP;
    } else {
      if (CL) { this.chestX = Math.round((W - CL.W) / 2); this.chestY = this.groundY + GROUND; }
      this.cardDock = true;
      this.cardX = Math.round((W - CARD_W) / 2);
      this.cardY = (CL ? this.chestY + CL.H + 8 : this.groundY + GROUND) + 2;
    }
    this.stageOX = ox; this.stageOY = oy;
  }
  stageOX = 0; stageOY = 0;

  private groundCanvas(): HTMLCanvasElement {
    const vw = window.innerWidth, vh = window.innerHeight, s = this.s;
    const w = Math.ceil(vw / s) + 2, h = Math.max(34, Math.ceil(vh / s - (this.stageOY + this.groundY - 2)) + 2);
    const shadow: Rect = { x: Math.round(this.stageOX + this.bagX + this.L.body.x), y: 8, w: this.L.body.w, h: 8 };
    const b = ART.paintGround(groundKind(), w, h, shadow);
    const c = bufCanvas(b, 'gnd');
    c.style.transform = `scale(${s})`;
    c.style.top = Math.round((this.stageOY + this.groundY - 2) * s) + 'px';
    this.gndCv = c;
    return c;
  }

  private buildScale() {
    const st = this.stage;
    const sc = ART.paintScale();
    const x = SCALE_X;
    const peg = bufCanvas(ART.paintPeg(groundKind()), 'abs');
    place(peg, -10, -2);
    st.appendChild(peg);
    const g = this.scaleEl = st.appendChild(el('div', 'scale'));
    place(g, x - 7, 2, 14, 120);
    const ring = bufCanvas(sc.ring, 'abs'); place(ring, 0, 0); g.appendChild(ring);
    const rod = this.rodEl = g.appendChild(el('div', 'abs'));
    rod.appendChild(bufCanvas(sc.rod)); place(rod, 1, 44);
    const tube = bufCanvas(sc.tube, 'abs'); place(tube, 1, 10); g.appendChild(tube);
    const slide = this.slideEl = g.appendChild(el('div', 'abs'));
    slide.style.cssText += 'width:5px;height:1px;background:#e8381c;box-shadow:0 1px 0 #6a1408';
    // the leather strap from the hook up to the bag's top corner
    this.strapEl = st.appendChild(el('div', 'strapline'));
    // the paper tag on the balance with the kilos written on it
    this.gtag = st.appendChild(el('div', 'gtag'));
  }

  private buildButtons() {
    const st = this.stage, L = this.L;
    const b = st.appendChild(el('div', 'btns'));
    b.style.alignItems = 'center';
    const repack = b.appendChild(iconLabel('button', 'pbtn', 'v11shake', 'REPACK'));
    repack.title = 'Repack (T): shake it all down, biggest first';
    repack.addEventListener('click', e => { e.stopPropagation(); this.repack(); });
    const close = b.appendChild(iconLabel('button', 'pbtn', 'v11x', ''));
    close.title = 'Close (Esc / Tab)';
    close.addEventListener('click', e => { e.stopPropagation(); void this.close(); });
    place(b, this.bagX + L.body.x, this.groundY + 14);
    if (!this.touch && !matchMedia('(pointer: coarse)').matches) {
      const keys = b.appendChild(el('div', 'keys', '<b>drag</b> move · <b>R</b> turn · <b>shift</b> take one · <b>E</b> eat · <b>Esc</b> close'));
      keys.style.position = 'static';
      keys.style.marginLeft = '4px';
      this.keysEl = keys;
    }
  }
  keysEl: HTMLElement | null = null;

  private buildPrep() {
    const st = this.stage, CL = this.CL;
    if (!CL) return;
    const p = this.opts.prep ?? {};
    // the trail sign beside the chest: set off
    const sign = st.appendChild(el('div', 'sign'));
    sign.appendChild(bufCanvas(ART.paintSign()));
    sign.appendChild(el('div', 'lbl', 'SET OFF'));
    place(sign, this.chestX + CL.W + 2, this.groundY + 9 - 70);
    sign.title = 'Set off (Enter)';
    sign.addEventListener('click', e => { e.stopPropagation(); this.result = 'go'; void this.close(); });
    // Joshu's packed lunch waiting on the chest lid
    const lunch = p.lunch?.() ?? null;
    if (lunch?.length) {
      let i = 0;
      for (const l of lunch) {
        if (!ITEMS[l.id]) continue;
        this.loose.push({ s: { id: l.id, n: l.n }, where: 'offer', x: this.chestX + 12 + i * 34, y: this.chestY + 2 });
        i++;
      }
    }
    // the crew's last word
    const tip = p.tip?.();
    if (tip) {
      const [who, text] = tip;
      const tb = st.appendChild(el('div', 'tipb', `<b>${esc(who.toUpperCase())}</b>${esc(text)}`));
      place(tb, this.chestX + 30, Math.max(2, this.chestY - 34));
    }
  }

  private async openAnim() {
    const fast = reduced();
    const L = this.L;
    sfx('land', { vol: 0.45, pitch: 0.7 });
    await this.wait(fast ? 0 : 380);
    // the buckles pop
    sfx('reelClick', { vol: 0.5, pitch: 1.5 });
    await this.wait(fast ? 0 : 110);
    sfx('reelClick', { vol: 0.5, pitch: 1.7 });
    await this.wait(fast ? 0 : 120);
    // the flap swings up and back
    sfx('whoosh', { vol: 0.25, pitch: 1.4 });
    const fl = this.flapEl.animate([
      { transform: 'perspective(260px) rotateX(0deg)' },
      { transform: 'perspective(260px) rotateX(88deg)', opacity: 1, offset: 0.92 },
      { transform: 'perspective(260px) rotateX(92deg)', opacity: 0 },
    ], { duration: fast ? 1 : 260, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
    await fl.finished.catch(() => {});
    this.flapEl.style.visibility = 'hidden';
    const ld = this.lidEl.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.12)', offset: 0.6 }, { transform: 'scaleY(1)' }], { duration: fast ? 1 : 260, easing: 'ease-out', fill: 'forwards' });
    sfx('rustle', { vol: 0.45, pitch: 1.1 });
    await ld.finished.catch(() => {});
    this.lidEl.style.transform = 'scaleY(1)';
    // the contents settle
    this.opened = true;
    let i = 0;
    const order = [...this.itemEls.entries()].sort((a, b) => (b[0].p?.y ?? 0) - (a[0].p?.y ?? 0));
    for (const [, e] of order) {
      e.classList.remove('hidden');
      e.style.setProperty('--d', `${Math.min(i, 16) * 0.035}s`);
      e.style.setProperty('--rr', `${(i % 2 ? 4 : -5)}deg`);
      e.classList.add('settle');
      setTimeout(() => e.classList.remove('settle'), 500 + Math.min(i, 16) * 35);
      i++;
    }
    if (!fast) for (let k = 0; k < Math.min(4, i); k++) setTimeout(() => sfx('place', { vol: 0.25, pitch: 0.8 + k * 0.12 }), 120 + k * 90);
    void L;
    this.bagEl.classList.remove('drop');
    // hand the first item to the card
    const first = game.save.inv.find(s => s.p);
    if (first && !this.touch) { this.sel = { s: first }; this.renderSel(); this.renderCard(true); }
  }

  async close() {
    if (this.closing) return;
    if (this.drag) this.cancelDrag();
    this.closing = true;
    sfx('zipper', { vol: 0.4, pitch: 1.15 });
    this.card.style.display = 'none';
    // contents first, then the lid comes back over and the bag drops away
    for (const e of this.itemEls.values()) e.style.transition = 'opacity 0.15s', e.style.opacity = '0';
    await this.wait(reduced() ? 0 : 140);
    this.lidEl.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: reduced() ? 1 : 160, fill: 'forwards' });
    await this.wait(reduced() ? 0 : 150);
    this.flapEl.style.visibility = '';
    const fl = this.flapEl.animate([{ transform: 'perspective(260px) rotateX(92deg)', opacity: 0 }, { transform: 'perspective(260px) rotateX(88deg)', opacity: 1, offset: 0.08 }, { transform: 'perspective(260px) rotateX(0deg)' }], { duration: reduced() ? 1 : 220, easing: 'cubic-bezier(.3,.4,.6,1)', fill: 'forwards' });
    await fl.finished.catch(() => {});
    sfx('reelClick', { vol: 0.45, pitch: 1.6 });
    this.bagEl.classList.add('out');
    this.chestEl?.classList.add('out');
    this.root.classList.remove('on');
    await this.wait(reduced() ? 0 : 320);
    this.finish();
  }

  private finish() {
    cancelAnimationFrame(this.raf);
    for (const f of this.offs) f();
    this.offs = [];
    // whatever is still unplaced in the pack goes on the ground (when there is a ground)
    const un = game.save.inv.filter(s => !s.p);
    if (un.length) {
      const pile = dropOnGround(un, { quiet: true });
      if (pile) for (const s of un) { const i = game.save.inv.indexOf(s); if (i >= 0) game.save.inv.splice(i, 1); }
    }
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
    r.addEventListener('contextmenu', e => { e.preventDefault(); if (this.drag) this.rotate(); });
    r.addEventListener('wheel', e => { if (this.drag) { e.preventDefault(); this.rotate(); } }, { passive: false });
    const onResize = () => this.relayout();
    window.addEventListener('resize', onResize);
    this.offs.push(() => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', onResize);
    });
    this.offs.push(pushKeys(e => this.onKey(e)));
    this.offs.push(onInvChange(() => { if (!this.drag) this.sync(); }));
    const tick = () => { this.raf = requestAnimationFrame(tick); this.frame(); };
    this.raf = requestAnimationFrame(tick);
  }

  /** the screen was resized: rebuild the layout in place */
  private relayout() {
    if (this.closing) return;
    const keepSel = this.sel;
    this.stage.innerHTML = '';
    this.root.innerHTML = '';
    this.itemEls.clear(); this.toolEls.clear();
    const spill = this.loose;
    this.loose = [];
    this.build([]);
    this.loose = spill;
    this.flapEl.style.visibility = 'hidden';
    this.lidEl.style.transform = 'scaleY(1)';
    this.bagEl.classList.remove('drop');
    this.chestEl?.classList.remove('in');
    this.root.classList.add('on');
    this.opened = true;
    this.sel = keepSel;
    this.sync(true);
    for (const e of this.itemEls.values()) e.classList.remove('hidden');
    this.renderCard(true);
  }

  /** client px -> stage art px */
  private toStage(cx: number, cy: number): [number, number] {
    const r = this.stage.getBoundingClientRect();
    return [(cx - r.left) / this.s, (cy - r.top) / this.s];
  }

  private onDown(e: PointerEvent) {
    if (e.pointerType === 'touch') this.touch = true, this.root.classList.add('touch');
    this.pointers.add(e.pointerId);
    // a second finger turns whatever is in hand
    if (this.drag && this.pointers.size > 1) { e.preventDefault(); this.rotate(); return; }
    if (this.closing || !this.opened) return;
    const t = e.target as HTMLElement;
    const itEl = t.closest('.it') as HTMLElement | null;
    const toolEl = t.closest('.tool') as HTMLElement | null;
    if (itEl) {
      const s = (itEl as unknown as { __s?: Stack }).__s;
      const from = ((itEl as unknown as { __w?: Where }).__w ?? 'pack');
      const lo = (itEl as unknown as { __l?: Loose }).__l;
      if (!s) return;
      e.preventDefault();
      this.pending = { s, from, x: e.clientX, y: e.clientY, pid: e.pointerId, e: itEl, shift: e.shiftKey, loose: lo };
      return;
    }
    if (toolEl) {
      const id = (toolEl as unknown as { __t?: string }).__t;
      if (id) { this.sel = { tool: id }; sfx('ui', { vol: 0.35, pitch: 1.2 }); this.renderSel(); this.renderCard(true); }
      return;
    }
    // a click on the background (not the card or a button): let go of the selection
    if (!t.closest('.card') && !t.closest('.pbtn') && !t.closest('.sign') && !t.closest('.bag') && !t.closest('.chest')) {
      if (this.sel) { this.sel = null; this.renderSel(); this.renderCard(); }
    }
  }

  private onMove(e: PointerEvent) {
    if (this.closing) return;
    const pd = this.pending;
    if (pd && e.pointerId === pd.pid && !this.drag) {
      if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 5) this.startDrag(pd, e);
      return;
    }
    const d = this.drag;
    if (d && e.pointerId === d.pid) { e.preventDefault(); this.moveDrag(e.clientX, e.clientY); return; }
    if (!d && e.pointerType === 'mouse') {
      const t = e.target as HTMLElement;
      const itEl = t.closest?.('.it') as HTMLElement | null;
      const toolEl = t.closest?.('.tool') as HTMLElement | null;
      const s = itEl ? (itEl as unknown as { __s?: Stack }).__s : undefined;
      const tool = toolEl ? (toolEl as unknown as { __t?: string }).__t : undefined;
      const same = (this.hover?.s ?? null) === (s ?? null) && (this.hover?.tool ?? null) === (tool ?? null);
      if (!same) {
        for (const x of this.itemEls.values()) x.classList.remove('hov');
        itEl?.classList.add('hov');
        this.hover = s || tool ? { s, tool } : null;
        if (this.hoverT) clearTimeout(this.hoverT);
        this.hoverT = setTimeout(() => { if (!this.drag) this.renderCard(); }, this.hover ? 90 : 260);
      }
    }
  }

  private onUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    const pd = this.pending;
    if (pd && e.pointerId === pd.pid && !this.drag) {
      this.pending = null;
      // a tap: pick it to look at
      const same = this.sel?.s === pd.s;
      this.sel = { s: pd.s };
      sfx('ui', { vol: 0.35, pitch: 1.15 });
      this.renderSel();
      this.renderCard(!same);
      if (pd.loose?.where === 'offer') this.takeOffer(pd.loose);
      return;
    }
    const d = this.drag;
    if (d && e.pointerId === d.pid) { this.endDrag(); }
  }

  private onKey(e: KeyboardEvent): boolean | void {
    if (this.closing) return true;
    const c = e.code;
    if (c === 'Escape' || c === 'Tab' || c === 'KeyI' || c === 'KeyB') {
      if (this.drag) { this.cancelDrag(); return true; }
      if (this.card.classList.contains('flip')) { this.card.classList.remove('flip'); return true; }
      void this.close();
      return true;
    }
    if (!this.opened) return true;
    if (c === 'KeyR') { if (this.drag) this.rotate(); else if (this.sel?.s) this.rotateInPlace(this.sel.s); return true; }
    if (c === 'KeyT') { this.repack(); return true; }
    if (c === 'Enter' && this.mode === 'prep' && !this.drag && !this.sel) { this.result = 'go'; void this.close(); return true; }
    const sel = this.sel?.s;
    if (c === 'KeyE' && sel && !this.drag) { void this.act('eat'); return true; }
    if ((c === 'KeyX' || c === 'Delete' || c === 'Backspace') && sel && !this.drag) { void this.act('drop'); return true; }
    if (c === 'KeyF' && (sel || this.sel?.tool)) { this.card.classList.toggle('flip'); sfx('pageTurn', { vol: 0.4 }); return true; }
    // keyboard carrying: arrows move the cursor / the item in hand, Enter / Space picks up and puts down
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    if (dir[c]) { this.keyMove(dir[c][0], dir[c][1]); return true; }
    if (c === 'Enter' || c === 'Space') { this.keyPick(); return true; }
    return true;
  }

  // ------------------------------------------------------------ rendering the contents

  private areaRect(cont: 'pack' | 'stash', a: string): Rect | null {
    if (cont === 'pack') { const r = this.L.areas[a]; return r ? { x: this.bagX + r.x, y: this.bagY + r.y, w: r.w, h: r.h } : null; }
    if (!this.CL || a !== 'chest') return null;
    return { x: this.chestX + this.CL.grid.x, y: this.chestY + this.CL.grid.y, w: this.CL.grid.w, h: this.CL.grid.h };
  }

  /** build or update an item's element */
  private itemEl(s: Stack, where: Where, lo?: Loose, rot?: 0 | 1): HTMLElement {
    let e = this.itemEls.get(s);
    const r: 0 | 1 = rot ?? (where === 'pack' || where === 'stash' ? (s.p?.r ?? 0) : 0);
    const key = `${s.id}|${r}|${s.n}`;
    if (!e) {
      e = el('div', 'it');
      this.itemEls.set(s, e);
      if (!this.opened && where === 'pack') e.classList.add('hidden');
    }
    const ex = e as unknown as { __s?: Stack; __w?: Where; __l?: Loose; __k?: string };
    ex.__s = s; ex.__w = where; ex.__l = lo;
    if (ex.__k !== key) {
      ex.__k = key;
      e.innerHTML = '';
      const fp = footprint(s.id);
      const [w, h] = stackDims(s.id, r);
      e.style.width = w * CELL + 'px'; e.style.height = h * CELL + 'px';
      e.appendChild(bufCanvas(ART.paintFootprint(fpCells(fp, !!r), w, h), 'fc'));
      // the picture, drawn unrotated in the footprint's own box and turned with the stack
      const bw = fp.w * CELL, bh = fp.h * CELL;
      const pic = fitPic(s.id, bw, bh);
      pic.classList.add('art');
      const pw = parseFloat(pic.style.width) || pic.width, ph = parseFloat(pic.style.height) || pic.height;
      const cxp = (w * CELL) / 2, cyp = (h * CELL) / 2;
      pic.style.left = Math.round(cxp - pw / 2) + 'px'; pic.style.top = Math.round(cyp - ph / 2) + 'px';
      if (r) pic.style.transform = 'rotate(90deg)';
      e.appendChild(pic);
      const d = ITEMS[s.id];
      if (s.n > 1) {
        // the count sits in the lowest, right-most filled cell
        const cs = fpCells(fp, !!r);
        const [bx, by] = cs.reduce((a, c) => (c[1] > a[1] || (c[1] === a[1] && c[0] > a[0]) ? c : a), cs[0]);
        const n = e.appendChild(el('span', 'n' + (s.n >= (d?.stack ?? 1) ? ' max' : ''), String(s.n)));
        n.style.right = (w - 1 - bx) * CELL + 2 + 'px';
        n.style.bottom = (h - 1 - by) * CELL + 1 + 'px';
      }
      e.title = '';
    }
    return e;
  }

  /** put every element where its stack is (and drop the elements of stacks that are gone) */
  sync(first = false) {
    const live = new Set<Stack>();
    // the pack
    for (const s of game.save.inv) {
      if (!s.p) continue;
      const rr = this.areaRect('pack', s.p.a);
      if (!rr) continue;
      live.add(s);
      const e = this.itemEl(s, 'pack');
      if (e.parentElement !== this.itemsEl && !(this.drag?.s === s)) this.itemsEl.appendChild(e);
      if (this.drag?.s !== s) place(e, rr.x - this.bagX + s.p.x * CELL, rr.y - this.bagY + s.p.y * CELL);
      // the lid pocket's things only show once the lid is open
      if (s.p.a === 'lid' && !this.opened) e.classList.add('hidden');
    }
    // the chest
    if (this.CL && this.chestItems) for (const s of stashStacks()) {
      if (!s.p) continue;
      live.add(s);
      const e = this.itemEl(s, 'stash');
      e.classList.remove('hidden');
      if (e.parentElement !== this.chestItems && this.drag?.s !== s) this.chestItems.appendChild(e);
      if (this.drag?.s !== s) place(e, this.CL.grid.x + s.p.x * CELL, this.CL.grid.y + s.p.y * CELL);
    }
    // the ground (and the lunch on the chest lid)
    this.loose = this.loose.filter(l => l.s.n > 0 && (l.where === 'offer' || !l.pile || l.pile.stacks.includes(l.s)) && (!l.spill || (game.save.inv.includes(l.s) && !l.s.p)));
    // what lies in the world pile but isn't shown yet (dropped just now)
    const pile = pileNear(80);
    if (pile) for (const s of pile.stacks) if (!this.loose.some(l => l.s === s)) this.loose.push({ s, where: 'ground', pile, x: 0, y: 0 });
    let gx = this.bagX + this.L.body.x + this.L.body.w + 4;
    if (this.CL && this.mode !== 'pack') gx = this.bagX + this.L.W + 2;
    const gl = this.loose.filter(l => l.where === 'ground');
    // lay the ground things out in a row along the ground, right of the bag (then left)
    let left = this.bagX + this.L.body.x - 6;
    for (const l of gl) {
      const [w, h] = stackDims(l.s.id, 0);
      const roomRight = !this.CL;
      if (roomRight && gx + w * CELL < this.cardX - 4) { l.x = gx; gx += w * CELL + 3; }
      else { left -= w * CELL + 3; l.x = Math.max(2, left); }
      l.y = this.groundY + 10 - h * CELL;
    }
    for (const l of this.loose) {
      live.add(l.s);
      const e = this.itemEl(l.s, l.where, l);
      e.classList.remove('hidden');
      if (e.parentElement !== this.looseEl && this.drag?.s !== l.s) this.looseEl.appendChild(e);
      if (this.drag?.s !== l.s) place(e, l.x, l.y);
    }
    for (const [s, e] of this.itemEls) if (!live.has(s) && this.drag?.s !== s) { e.remove(); this.itemEls.delete(s); }
    if (this.sel?.s && !live.has(this.sel.s)) { this.sel = null; this.renderCard(); }
    this.renderSel();
    this.renderTools();
    this.updateScale(first);
  }

  private renderSel() {
    for (const [s, e] of this.itemEls) e.classList.toggle('sel', this.sel?.s === s);
    for (const [t, e] of this.toolEls) e.classList.toggle('sel', this.sel?.tool === t);
  }

  /** the tools in their holders */
  private renderTools() {
    const L = this.L;
    const tools = game.save.tools.slice();
    const key = tools.join(',');
    if ((this.toolsEl as unknown as { __k?: string }).__k === key) return;
    (this.toolsEl as unknown as { __k?: string }).__k = key;
    this.toolsEl.innerHTML = '';
    this.toolEls.clear();
    const filled = new Set<string>();
    const spare = L.spare.slice();
    const byHolder = new Map<string, string[]>();
    for (const t of tools) {
      let h: string | null = toolSlotOf(t);
      if (!h || !L.holders[h as HolderId]) h = spare.length ? 'spare' : null;
      if (!h) continue;
      const a = byHolder.get(h) ?? [];
      a.push(t);
      byHolder.set(h, a);
    }
    for (const [h, ids] of byHolder) {
      const rects: Rect[] = h === 'spare' ? ids.map((_, i) => spare[i]).filter(Boolean) : [L.holders[h as HolderId]!];
      ids.forEach((id, i) => {
        let r = h === 'spare' ? rects[i] : rects[0];
        if (!r) return;
        // two tools sharing a holder (the pouch) sit side by side
        if (h !== 'spare' && ids.length > 1) { const w = Math.floor(r.w / ids.length); r = { x: r.x + i * w, y: r.y, w, h: r.h }; }
        filled.add(h);
        const e = this.toolsEl.appendChild(el('div', 'tool'));
        (e as unknown as { __t?: string }).__t = id;
        place(e, r.x, r.y, r.w, r.h);
        e.appendChild(fitPic(id, r.w - 2, r.h - 2, false));
        e.title = ITEMS[id]?.name ?? id;
        this.toolEls.set(id, e);
      });
    }
    this.overCv?.remove();
    this.overCv = bufCanvas(ART.paintBagOver(L, filled), 'abs');
    this.overCv.style.pointerEvents = 'none';
    this.overCv.style.zIndex = '3';
    this.toolsEl.after(this.overCv);
    this.renderSel();
  }

  // ------------------------------------------------------------ the spring balance

  private updateScale(snap = false) {
    const w = packWeight(), cap = Math.max(1, packCapacity());
    if (Math.abs(w - this.lastW) > 0.004 || snap) {
      const was = this.lastW;
      this.lastW = w;
      if (!snap && was >= 0) { this.wVel += (w > was ? 1 : -1) * 0.9; if (w > cap && was <= cap) sfx('woodCreak', { vol: 0.3, pitch: 1.6 }); }
      // the tag with the kilos, inked in pixel digits
      this.gtag.innerHTML = '';
      const over = w > cap;
      this.gtag.appendChild(bufCanvas(ART.paintWeightTag(w, cap), 'abs'));
      this.gtag.title = over ? 'Too heavy: you tire faster and slow down out there.' : 'Heavier packs cost more energy on expeditions.';
    }
  }

  private frame() {
    // the balance: a damped spring toward the load (it bobs when the load changes)
    const cap = Math.max(1, packCapacity());
    const target = Math.min(1.35, packWeight() / cap);
    const k = 70, c = 9, dt = 1 / 60;
    this.wVel += (-(this.wShown - target) * k - this.wVel * c) * dt;
    this.wShown += this.wVel * dt;
    const ext = Math.max(0, this.wShown) * 14;
    const g = this.scaleEl;
    if (!g) return;
    this.rodEl.style.transform = `translateY(${ext.toFixed(2)}px)`;
    // the red slider inside the tube
    const ty = 16 + Math.min(1.3, Math.max(0, this.wShown)) / 1.3 * 40;
    this.slideEl.style.left = '4px'; this.slideEl.style.top = ty.toFixed(2) + 'px';
    const sway = Math.sin(performance.now() / 900) * 0.6 + this.wVel * 1.6;
    g.style.transform = `rotate(${sway.toFixed(2)}deg)`;
    // the strap from the hook to the top of the bag
    const hx = SCALE_X, hy = 2 + 44 + 30 + ext;
    const bx = this.bagX + this.L.body.x + 3, by = this.bagY + this.L.body.y + 2;
    const dx = bx - hx, dy = by - hy;
    const len = Math.hypot(dx, dy);
    place(this.strapEl, hx, hy, len);
    this.strapEl.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    place(this.gtag, hx - 40, 30);
    this.gtag.style.transform = `rotate(${(7 + Math.sin(performance.now() / 700) * 1.5).toFixed(2)}deg)`;
  }

  // ------------------------------------------------------------ the card

  renderCard(swing = false) {
    const cur = (this.drag ? null : this.hover) ?? this.sel;
    const card = this.card;
    if (!cur || (!cur.s && !cur.tool)) {
      card.style.display = 'none';
      card.dataset.k = '';
      return;
    }
    const id = cur.s?.id ?? cur.tool!;
    const d = ITEMS[id];
    if (!d) { card.style.display = 'none'; return; }
    const n = cur.s?.n ?? 1;
    const k = `${id}|${n}|${cur.s ? 's' : 't'}|${this.sel?.s === cur.s && !!cur.s}`;
    if (card.dataset.k === k && card.style.display !== 'none') return;
    const wasFlip = card.classList.contains('flip') && card.dataset.id === id;
    card.dataset.k = k; card.dataset.id = id;
    card.style.display = '';
    card.className = 'card' + (wasFlip ? ' flip' : '');
    // float the card next to the thing when there's no column for it
    let x = this.cardX, y = this.cardY;
    if (!this.cardDock) {
      const e = cur.s ? this.itemEls.get(cur.s) : this.toolEls.get(id);
      if (e) {
        const r = e.getBoundingClientRect(), sr = this.stage.getBoundingClientRect();
        const ex = (r.left - sr.left) / this.s, ey = (r.top - sr.top) / this.s;
        x = ex + r.width / this.s + 6; y = Math.max(4, ey - 30);
        if (x + 112 > this.W - 2) x = ex - 118;
        y = Math.min(y, this.H - 168);
      }
    }
    place(card, Math.round(x), Math.round(y));
    card.innerHTML = '';
    const str = card.appendChild(el('div', 'str'));
    str.style.height = Math.max(4, y + 2) + 'px';
    // ---- the front
    const front = card.appendChild(el('div', 'face front'));
    front.appendChild(bufCanvas(ART.paintTag(112, 164), 'paper'));
    const pic = front.appendChild(el('div', 'pic'));
    pic.appendChild(fitPic(id, 100, 50));
    const nm = front.appendChild(el('div', 'nm'));
    nm.appendChild(handLetter(d.name, { px: 12, maxW: 100 }));
    const fi = foodInfo(id);
    if (fi.edible) {
      const st = front.appendChild(el('div', `stamp ${fi.verdict}`, fi.verdict === 'safe' ? 'EDIBLE' : fi.verdict === 'poison' ? 'POISON' : 'UNKNOWN'));
      st.title = fi.verdict === 'unknown' ? 'Not researched yet: it might be poisonous' : '';
    }
    front.appendChild(el('div', 'note', esc(firstSentence(d.desc))));
    const facts = front.appendChild(el('div', 'facts'));
    const kg = weightOf(id);
    facts.appendChild(iconLabel('span', '', 'v11kg', `${kgText(kg)}${n > 1 ? ` ×${n}` : ''}`));
    if (fi.edible && fi.energy) facts.appendChild(iconLabel('span', '', 'v11bolt', `+${fi.energy}`));
    if (d.lab && analysisRp(id) > 0) facts.appendChild(iconLabel('span', '', 'v11lens', 'RP'));
    const kw = facts.appendChild(el('span', '', KIND_WORD[d.kind] ?? d.kind));
    kw.style.cssText = 'margin-left:auto;opacity:0.7';
    const acts = front.appendChild(el('div', 'acts'));
    const btn = (ic: string, label: string, fn: () => void, cls = '', on = true) => {
      const b = acts.appendChild(iconLabel('button', cls, ic, label)) as HTMLButtonElement;
      b.disabled = !on;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      return b;
    };
    const inPack = !!cur.s && game.save.inv.includes(cur.s);
    const isSel = !!cur.s && this.sel?.s === cur.s;
    if (cur.s && isSel) {
      if (fi.edible) btn('v11eat', 'eat', () => void this.act('eat'), fi.verdict === 'safe' ? 'go' : fi.verdict === 'poison' ? 'red' : '', inPack && canEat(id).ok);
      const u = useOf(id);
      if (u) btn(u.icon ?? 'v11hand', u.label, () => void this.act('use'), '', inPack);
      if (d.kind !== 'key') btn('v11drop', 'drop', () => void this.act('drop'), '', inPack || stashStacks().includes(cur.s));
      btn('v11rot', 'turn', () => this.rotateInPlace(cur.s!), '', !!cur.s.p);
    }
    btn('v11lens', 'look', () => { card.classList.toggle('flip'); sfx('pageTurn', { vol: 0.4 }); });
    if (!isSel && cur.s) acts.style.opacity = '0.75';
    // ---- the back: the full field notes
    const back = card.appendChild(el('div', 'face back'));
    back.appendChild(bufCanvas(ART.paintTag(112, 164), 'paper'));
    const lines: string[] = [esc(d.desc)];
    if (d.where) lines.push(`<b>FOUND</b> ${esc(d.where)}`);
    if (fi.edible) {
      const sick = timesSick(id);
      lines.push(`<b>EATING</b> ${fi.energy ? `+${fi.energy} energy` : 'hardly any energy'}${fi.buff === 'steady' ? ', steady hands next trip' : fi.buff === 'quiet' ? ', light feet next trip' : ''}. ${fi.verdict === 'unknown' ? '<i>Unidentified: it might be poisonous. Analyse a sample first.</i>' : fi.verdict === 'poison' ? '<i>Poisonous (researched).</i>' : fi.risky ? 'Safe (researched).' : ''}${sick ? ` <i>It made you ill ${sick > 1 ? sick + ' times' : 'once'}.</i>` : ''}`);
    }
    if (d.lab) {
      const times = game.save.analyzed[id] ?? 0;
      lines.push(times ? `<b>LAB</b> ${esc(d.lab.text)}` : `<b>LAB</b> <i>Not analysed yet${analysisRp(id) ? ` (+${analysisRp(id)} RP at the laptop)` : ''}.</i>`);
    }
    if (d.kind === 'tool') lines.push('<b>CARRIED</b> in its own place on the pack: tools never take room inside.');
    back.appendChild(el('div', 'txt', lines.join('<br>')));
    const bacts = back.appendChild(el('div', 'acts'));
    const bb = bacts.appendChild(iconLabel('button', '', 'back', 'front')) as HTMLButtonElement;
    bb.addEventListener('pointerdown', e => e.stopPropagation());
    bb.addEventListener('click', e => { e.stopPropagation(); card.classList.remove('flip'); sfx('pageTurn', { vol: 0.35 }); });
    if (swing && !reduced()) { card.classList.add('swing'); sfx('pageTurn', { vol: 0.25, pitch: 1.3 }); }
  }

  // ------------------------------------------------------------ actions

  async act(what: 'eat' | 'use' | 'drop') {
    const s = this.sel?.s;
    if (!s || this.busy) return;
    const id = s.id;
    if (what === 'eat') {
      if (!game.save.inv.includes(s)) return;
      const can = canEat(id);
      if (!can.ok) { sfx('wrong', { vol: 0.4 }); this.float(s, can.reason ?? 'Not now'); return; }
      this.busy = true;
      sfx('munch');
      let r: ReturnType<typeof eatFood> | null = null;
      try { r = eatFood(id, { quiet: true }); } catch (e) { console.error(e); }
      setTimeout(() => sfx('munch', { pitch: 1.2 }), 160);
      this.float(s, r?.fx && r.fx !== 'none' ? (r.fx === 'dizzy' ? 'Uh-oh. Dizzy...' : r.fx === 'big' ? 'Violently sick!' : 'Stomach ache...') : r?.energy ? `+${r.energy} energy` : 'Mm.');
      // (opts.onEat is the old callers' hook: world.ts passes one that eats again, so it is not called)
      this.busy = false;
      this.sync();
      this.renderCard();
      return;
    }
    if (what === 'use') {
      const u = useOf(id);
      if (!u) return;
      this.busy = true;
      try { await u.fn(id); } catch (e) { console.error(e); }
      this.busy = false;
      this.sync(); this.renderCard();
      return;
    }
    if (what === 'drop') {
      if (ITEMS[id]?.kind === 'key') return;
      if (!this.toGround(s)) { sfx('wrong', { vol: 0.4 }); this.float(s, 'Nowhere to put it down here'); return; }
      this.sel = null;
      this.sync();
      this.renderCard();
    }
  }

  /** put a stack down on the ground (out of the pack or the chest) */
  private toGround(s: Stack): boolean {
    const inv = game.save.inv, st = stashStacks();
    const from = inv.includes(s) ? inv : st.includes(s) ? st : null;
    if (!from) return false;
    const pile = dropOnGround([s]);
    if (!pile) return false;
    from.splice(from.indexOf(s), 1);
    sfx('land', { vol: 0.35, pitch: 1.4 });
    game.persist();
    return true;
  }

  private float(s: Stack | null, text: string) {
    const e = s ? this.itemEls.get(s) : null;
    const f = this.stage.appendChild(el('div', 'floatmsg', esc(text)));
    let x = this.bagX + this.L.open.x + 10, y = this.bagY + this.L.open.y;
    if (e) { const r = e.getBoundingClientRect(), sr = this.stage.getBoundingClientRect(); x = (r.left - sr.left) / this.s; y = (r.top - sr.top) / this.s - 8; }
    place(f, Math.round(x), Math.round(y));
    setTimeout(() => f.remove(), 1150);
  }

  repack() {
    if (this.drag || this.busy) return;
    this.bagEl.classList.remove('shake');
    void this.bagEl.offsetWidth;
    this.bagEl.classList.add('shake');
    sfx('rustle', { vol: 0.6 });
    sfx('zipper', { vol: 0.3, pitch: 1.3 });
    // the spilled things get a chance to go back in too
    for (const l of this.loose) if (l.spill) l.s.p = undefined;
    const left = PACK.arrange();
    for (const [s, e] of this.itemEls) if (game.save.inv.includes(s)) { e.style.transition = 'left 0.3s cubic-bezier(.3,1.3,.5,1), top 0.3s cubic-bezier(.3,1.3,.5,1)'; setTimeout(() => { e.style.transition = ''; }, 360); }
    // what still has no room comes out on the ground
    this.loose = this.loose.filter(l => !l.spill);
    for (const s of left) this.loose.push({ s, where: 'ground', spill: true, x: 0, y: 0 });
    game.persist();
    this.sync();
    setTimeout(() => this.bagEl.classList.remove('shake'), 520);
  }

  // ------------------------------------------------------------ drag and drop

  private startDrag(pd: NonNullable<PackScreen['pending']>, e: PointerEvent) {
    this.pending = null;
    let s = pd.s;
    let splitFrom: Stack | undefined;
    // shift-drag (or holding the last of a big stack) takes just one
    if (pd.shift && s.n > 1 && pd.from !== 'offer') {
      splitFrom = s;
      s.n -= 1;
      s = { id: s.id, n: 1 };
      this.itemEl(splitFrom, pd.from);
    }
    const src = splitFrom ? this.itemEls.get(splitFrom)! : pd.e;
    const sr = src.getBoundingClientRect();
    const [px, py] = this.toStage(e.clientX, e.clientY);
    const el0 = this.itemEl(s, pd.from, pd.loose);
    const r: 0 | 1 = pd.from === 'pack' || pd.from === 'stash' ? (s.p?.r ?? 0) : 0;
    const d: Drag = {
      s, from: pd.from, e: el0, pid: pd.pid, r, orig: s.p ? { ...s.p } : undefined, loose: pd.loose,
      gx: px - (sr.left - this.stage.getBoundingClientRect().left) / this.s, gy: py - (sr.top - this.stage.getBoundingClientRect().top) / this.s,
      px, py, splitFrom, target: null,
    };
    this.drag = d;
    el0.classList.remove('hidden', 'settle', 'hov');
    el0.classList.add('lift');
    this.dragEl.appendChild(el0);
    sfx('rustle', { vol: 0.3, pitch: 1.4 });
    this.sel = { s: splitFrom ?? s };
    this.renderSel();
    this.card.style.display = 'none';
    this.moveDrag(e.clientX, e.clientY);
  }

  private moveDrag(cx: number, cy: number) {
    const d = this.drag;
    if (!d) return;
    const [px, py] = this.toStage(cx, cy);
    d.px = px; d.py = py;
    this.placeDragEl();
    d.target = this.findTarget();
    this.showGhost();
  }

  private placeDragEl() {
    const d = this.drag!;
    const x = d.px - d.gx, y = d.py - d.gy;
    place(d.e, Math.round(x), Math.round(y));
    if (this.touch) { this.rotBtn.classList.add('on'); place(this.rotBtn, Math.round(x + parseFloat(d.e.style.width) + 2), Math.round(y - 22)); }
  }

  private findTarget(): Target {
    const d = this.drag!;
    const [w, h] = stackDims(d.s.id, d.r);
    const x = d.px - d.gx, y = d.py - d.gy;
    const cx = x + (w * CELL) / 2, cy = y + (h * CELL) / 2;
    const conts: ['pack' | 'stash', Container][] = [['pack', PACK]];
    if (this.CL) conts.push(['stash', STASH]);
    let best: Target = null, bd = Infinity;
    for (const [name, cont] of conts) {
      for (const a of cont.areas()) {
        const rr = this.areaRect(name, a.id);
        if (!rr) continue;
        if (a.id === 'lid' && !this.opened) continue;
        // the pointer over the area (with a little slack)
        const inside = d.px > rr.x - CELL * 0.5 && d.px < rr.x + rr.w + CELL * 0.5 && d.py > rr.y - CELL * 0.5 && d.py < rr.y + rr.h + CELL * 0.5;
        if (!inside) continue;
        const gx = Math.round((x - rr.x) / CELL), gy = Math.round((y - rr.y) / CELL);
        const p: Place = { a: a.id, x: Math.max(0, Math.min(a.cols - w, gx)), y: Math.max(0, Math.min(a.rows - h, gy)), r: d.r };
        const skip = [d.s, ...(d.splitFrom ? [] : [])];
        const { occ } = cont.occ(skip);
        // dropping onto the same thing tops it up
        const under = this.stackAt(name, a.id, Math.floor((d.px - rr.x) / CELL), Math.floor((d.py - rr.y) / CELL), occ);
        if (under && under !== d.s && under.id === d.s.id && under.n < (ITEMS[under.id]?.stack ?? 1)) return { kind: 'grid', cont: name, p, ok: true, merge: under };
        const ok = w <= a.cols && h <= a.rows && cont.fitsAt(occ, d.s.id, p);
        const dist = Math.hypot(cx - (rr.x + rr.w / 2), cy - (rr.y + rr.h / 2));
        if (dist < bd) { bd = dist; best = { kind: 'grid', cont: name, p, ok, merge: null }; }
      }
    }
    if (best) return best;
    // the ground (below the bag's base, not on the chest)
    if (d.py > this.groundY - 6 && !(this.CL && d.px > this.chestX && d.px < this.chestX + this.CL.W && d.py < this.chestY + this.CL.H) && ITEMS[d.s.id]?.kind !== 'key') return { kind: 'ground' };
    return null;
  }

  private stackAt(cont: 'pack' | 'stash', area: string, x: number, y: number, occ: Occ): Stack | null {
    const c = cont === 'pack' ? PACK : STASH;
    const a = c.area(area), g = occ.get(area);
    if (!a || !g || x < 0 || y < 0 || x >= a.cols || y >= a.rows) return null;
    const v = g[y * a.cols + x];
    return v > 0 ? c.list()[v - 1] ?? null : null;
  }

  private showGhost() {
    const d = this.drag;
    this.cellsEl.innerHTML = '';
    const ce = this.chestItems?.parentElement?.querySelector('.cells.ch') as HTMLElement | null;
    if (ce) ce.innerHTML = '';
    if (!d?.target || d.target.kind !== 'grid') return;
    const t = d.target;
    const rr = this.areaRect(t.cont, t.p.a);
    if (!rr) return;
    let host = this.cellsEl, ox = this.bagX, oy = this.bagY;
    if (t.cont === 'stash' && this.chestEl) {
      host = ce ?? this.chestEl.insertBefore(el('div', 'cells ch'), this.chestItems);
      ox = this.chestX; oy = this.chestY;
    }
    const cls = t.merge ? 'merge' : t.ok ? 'ok' : 'bad';
    const cs = t.merge && t.merge.p ? stackCells(t.merge.id, t.merge.p.r, t.merge.p.x, t.merge.p.y) : stackCells(d.s.id, d.r, t.p.x, t.p.y);
    for (const [x, y] of cs) {
      const a = (t.cont === 'pack' ? PACK : STASH).area(t.p.a);
      if (!a || x < 0 || y < 0 || x >= a.cols || y >= a.rows) continue;
      const g = host.appendChild(el('div', 'ghost ' + cls));
      place(g, rr.x - ox + x * CELL, rr.y - oy + y * CELL);
    }
  }

  rotate() {
    const d = this.drag;
    if (!d) return;
    const fp = footprint(d.s.id);
    if (fp.w === fp.h && !fp.mask) { sfx('ui', { vol: 0.2, pitch: 1.6 }); return; }
    // turn round the grab point
    const [w0, h0] = stackDims(d.s.id, d.r);
    void w0;
    const gx = d.gx, gy = d.gy;
    d.r = d.r ? 0 : 1;
    d.gx = h0 * CELL - gy; d.gy = gx;
    // rebuild the element turned
    this.itemEl(d.s, d.from, d.loose, d.r);
    d.e.classList.add('lift');
    sfx('ui', { vol: 0.35, pitch: 1.7 });
    this.placeDragEl();
    d.target = this.findTarget();
    this.showGhost();
  }

  /** turn a placed stack where it lies (if it fits turned) */
  rotateInPlace(s: Stack) {
    const cont = game.save.inv.includes(s) ? PACK : stashStacks().includes(s) ? STASH : null;
    if (!cont || !s.p) return;
    const fp = footprint(s.id);
    if (fp.w === fp.h && !fp.mask) return;
    const { occ } = cont.occ(s);
    const r: 0 | 1 = s.p.r ? 0 : 1;
    const [w, h] = stackDims(s.id, r);
    const a = cont.area(s.p.a);
    if (!a) return;
    // same corner first, then nudged back inside / around it
    const tries: Place[] = [];
    for (let dy = 0; dy >= -h + 1; dy--) for (let dx = 0; dx >= -w + 1; dx--) tries.push({ a: s.p.a, x: s.p.x + dx, y: s.p.y + dy, r });
    const ok = tries.find(p => p.x >= 0 && p.y >= 0 && p.x + w <= a.cols && p.y + h <= a.rows && cont.fitsAt(occ, s.id, p));
    const e = this.itemEls.get(s);
    if (!ok) { sfx('wrong', { vol: 0.35 }); e?.classList.remove('nudge'); void e?.offsetWidth; e?.classList.add('nudge'); return; }
    s.p = ok;
    sfx('ui', { vol: 0.35, pitch: 1.7 });
    if (e) (e as unknown as { __k?: string }).__k = '';
    game.persist();
    this.sync();
    this.renderCard();
  }

  private endDrag() {
    const d = this.drag;
    if (!d) return;
    this.rotBtn.classList.remove('on');
    const t = this.findTarget();
    this.cellsEl.innerHTML = '';
    this.showGhostClear();
    if (!t || (t.kind === 'grid' && !t.ok)) { this.refuse(t); return; }
    const inv = game.save.inv, st = stashStacks();
    const src = d.from === 'pack' ? inv : d.from === 'stash' ? st : null;
    if (t.kind === 'ground') {
      if (d.from === 'ground' || d.from === 'offer') { this.cancelDrag(); return; }
      // out of the pack (or the chest) onto the ground
      this.drag = null;
      d.e.classList.remove('lift');
      const pile = dropOnGround([d.s]);
      if (!pile) { sfx('wrong', { vol: 0.4 }); this.snapBack(d); return; }
      if (!d.splitFrom) { const list = src ?? []; const i = list.indexOf(d.s); if (i >= 0) list.splice(i, 1); }
      this.itemEls.delete(d.s); d.e.remove();
      sfx('land', { vol: 0.35, pitch: 1.4 });
      this.afterMove();
      return;
    }
    // into a grid
    const dst = t.cont === 'pack' ? inv : st;
    if (t.merge) {
      // onto the same thing: top that stack up
      const max = ITEMS[t.merge.id]?.stack ?? 1;
      const k = Math.min(d.s.n, max - t.merge.n);
      t.merge.n += k;
      d.s.n -= k;
      sfx('collectPop', { vol: 0.4, pitch: 1.2 });
      const me = this.itemEls.get(t.merge);
      if (me) (me as unknown as { __k?: string }).__k = '';
      this.drag = null;
      d.e.classList.remove('lift');
      if (d.s.n <= 0) {
        if (!d.splitFrom) this.removeFromSource(d);
        this.itemEls.delete(d.s); d.e.remove();
        this.afterMove();
      } else this.snapBack(d);
      if (me) { me.classList.remove('thud'); void me.offsetWidth; me.classList.add('thud'); }
      return;
    }
    // taking Joshu's lunch off the chest lid
    if (d.from === 'offer' && d.loose) { this.opts.prep?.tookLunch?.(); }
    if (!d.splitFrom) this.removeFromSource(d);
    d.s.p = { ...t.p };
    if (!dst.includes(d.s)) dst.push(d.s);
    this.drag = null;
    d.e.classList.remove('lift');
    const host = t.cont === 'pack' ? this.itemsEl : this.chestItems!;
    host.appendChild(d.e);
    d.e.classList.remove('thud'); void d.e.offsetWidth; d.e.classList.add('thud');
    const kg = weightOf(d.s.id) * d.s.n;
    sfx('place', { vol: 0.4, pitch: Math.max(0.6, 1.3 - kg * 0.25) });
    this.sel = { s: d.s };
    this.afterMove();
  }

  private showGhostClear() {
    const ce = this.chestEl?.querySelector('.cells.ch') as HTMLElement | null;
    if (ce) ce.innerHTML = '';
  }

  /** take the dragged stack out of where it was (the pack, the chest, the ground, the lunch) */
  private removeFromSource(d: Drag) {
    if (d.from === 'pack' || d.from === 'stash') {
      const list = d.from === 'pack' ? game.save.inv : stashStacks();
      const i = list.indexOf(d.s);
      if (i >= 0) list.splice(i, 1);
    }
    if (d.loose) {
      if (d.loose.pile) takeFromPile(d.loose.pile, d.s);
      if (d.loose.spill) { const i = game.save.inv.indexOf(d.s); if (i >= 0) game.save.inv.splice(i, 1); }
      this.loose = this.loose.filter(l => l !== d.loose);
    }
  }

  private afterMove() {
    game.persist();
    this.sync();
    this.renderCard();
    void groundPiles;
  }

  private refuse(t: Target) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    sfx('wrong', { vol: 0.32 });
    // the things in the way get a shove
    if (t?.kind === 'grid') {
      const cont = t.cont === 'pack' ? PACK : STASH;
      const { occ } = cont.occ(d.s);
      for (const i of cont.blockers(occ, d.s.id, t.p)) {
        const b = cont.list()[i - 1];
        const e = b ? this.itemEls.get(b) : null;
        if (e) { e.classList.remove('nudge'); void e.offsetWidth; e.classList.add('nudge'); }
      }
    }
    this.snapBack(d);
  }

  private cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.rotBtn.classList.remove('on');
    this.cellsEl.innerHTML = '';
    this.snapBack(d);
  }

  /** the item flies back to where it was */
  private snapBack(d: Drag) {
    d.e.classList.remove('lift');
    if (d.splitFrom) {
      d.splitFrom.n += d.s.n;
      this.itemEls.delete(d.s);
      d.e.remove();
      this.sync();
      return;
    }
    if (d.orig) d.s.p = { ...d.orig };
    const host = d.from === 'pack' ? this.itemsEl : d.from === 'stash' ? this.chestItems ?? this.itemsEl : this.looseEl;
    // keep it where it is on screen, then let sync glide it home
    const r = d.e.getBoundingClientRect(), hr = host.getBoundingClientRect();
    host.appendChild(d.e);
    place(d.e, Math.round((r.left - hr.left) / this.s), Math.round((r.top - hr.top) / this.s));
    (d.e as unknown as { __k?: string }).__k = '';
    void d.e.offsetWidth;
    d.e.style.transition = 'left 0.22s cubic-bezier(.3,1.4,.5,1), top 0.22s cubic-bezier(.3,1.4,.5,1)';
    setTimeout(() => { d.e.style.transition = ''; d.e.classList.remove('nudge'); void d.e.offsetWidth; d.e.classList.add('nudge'); }, 230);
    this.sync();
  }

  /** a tap on the lunch: straight into the pack if there's room */
  private takeOffer(l: Loose) {
    const { occ } = PACK.occ();
    const p = PACK.findSpot(occ, l.s.id);
    if (!p) { sfx('wrong', { vol: 0.35 }); this.float(l.s, 'No room for it'); return; }
    this.opts.prep?.tookLunch?.();
    l.s.p = p;
    game.save.inv.push(l.s);
    this.loose = this.loose.filter(x => x !== l);
    sfx('place', { vol: 0.4 });
    this.sel = { s: l.s };
    this.afterMove();
  }

  // ------------------------------------------------------------ keyboard carrying

  private keyMove(dx: number, dy: number) {
    const d = this.drag;
    if (d && d.key) {
      // move the item in hand by a cell
      d.px += dx * CELL; d.py += dy * CELL;
      this.placeDragEl();
      d.target = this.findTarget();
      this.showGhost();
      return;
    }
    // move the selection to the nearest thing in that direction
    const all: { s: Stack; x: number; y: number }[] = [];
    for (const [s, e] of this.itemEls) { const r = e.getBoundingClientRect(); all.push({ s, x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
    if (!all.length) return;
    const cur = this.sel?.s ? all.find(a => a.s === this.sel!.s) : null;
    if (!cur) { this.sel = { s: all[0].s }; this.renderSel(); this.renderCard(true); return; }
    let best: typeof cur | null = null, bd = Infinity;
    for (const a of all) {
      if (a === cur) continue;
      const vx = a.x - cur.x, vy = a.y - cur.y;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.2;
      if (score < bd) { bd = score; best = a; }
    }
    if (best) { this.sel = { s: best.s }; sfx('ui', { vol: 0.25, pitch: 1.3 }); this.renderSel(); this.renderCard(); }
  }

  private keyPick() {
    const d = this.drag;
    if (d) { this.endDrag(); return; }
    const s = this.sel?.s;
    if (!s) return;
    const e = this.itemEls.get(s);
    if (!e) return;
    const r = e.getBoundingClientRect();
    const w: Where = game.save.inv.includes(s) ? 'pack' : stashStacks().includes(s) ? 'stash' : 'ground';
    const lo = this.loose.find(l => l.s === s);
    this.pending = { s, from: lo ? lo.where : w, x: r.left + 4, y: r.top + 4, pid: -7, e, shift: false, loose: lo };
    this.startDrag(this.pending, { clientX: r.left + 12 * this.s, clientY: r.top + 12 * this.s } as PointerEvent);
    if (this.drag) this.drag.key = true;
  }
}

// ---------------------------------------------------------------- debug handle (window.zl.bp)
const invLine = () => game.save.inv.map(s => `${s.id}x${s.n}@${s.p ? `${s.p.a}:${s.p.x},${s.p.y}${s.p.r ? 'r' : ''}` : '-'}`);
async function debugFill() {
  const { add } = await import('../../game/inventory');
  for (const [id, n] of [['ration', 4], ['berry_ember', 9], ['plank', 2], ['wood', 6], ['shell_trycop', 1], ['moonfruit', 3], ['fernfrond', 2], ['rope', 3], ['stone', 5], ['v10_fish', 1], ['tea', 1], ['feather', 2], ['pipi', 6]] as [string, number][]) add(id, n);
  game.persist();
  return invLine();
}
export const BP_ZL = {
  open: (mode: PackMode = 'pack') => openBackpack11({ mode }),
  fill: debugFill,
  give: async (id: string, n = 1) => (await import('../../game/inventory')).give(id, n),
  add: async (id: string, n = 1) => (await import('../../game/inventory')).add(id, n),
  stash: async (id: string, n = 1) => (await import('../../game/v11/stash')).stashAdd(id, n),
  inv: invLine,
  screen: () => screen,
};
function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (w.zl) w.zl.bp = BP_ZL;
  else setTimeout(hookZl, 500);
}
hookZl();
