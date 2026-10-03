// V11 cooking close-up. The camera drops to the fire: a ring of stones, the logs, live flames, and over
// them the pot on its tripod, the pan on the stones or green skewers across two forked sticks.
// Food comes out of the pack (and the camp stash) onto the mat at the top; anything that wants
// cutting goes on the driftwood board first (tap to chop), then into the pot / onto the pan / onto
// the skewer. The cooking is physical:
//  - the fire dies down on its own: tap the woodpile to throw a log on (it takes a moment to catch),
//    hold the flax fan to make it roar for a bit
//  - each dish wants a heat (the band on the gauge by the fire); too cool and nothing happens, too
//    hot and it catches
//  - the pot wants stirring (circle round it, or S) or it sticks; the pan and the skewer want
//    turning (tap them, or T) or one side burns
//  - the food changes colour as it cooks (raw -> golden -> black), steam rolls off the pot, the pan
//    sizzles louder the hotter it is, and Joshu (or Mori on his own) calls out what it needs
//  - Serve takes it off the heat: PERFECT / GOOD / UNDERCOOKED / BURNT, the dish and how many portions
//    (a recipe cooked right is learned, src/game/v11/cooking.ts)
// The recipe notebook (the book in the corner) lists what Mori knows and hints at the rest.
//
// TODO(hands3d): the 3D close-up hands module (mountHands3d) will hold the knife, the spoon and the
// fan here. registerCookHands(fn) is the hook: when one is registered it is mounted over the stage
// and told what Mori's hands are doing ('idle' | 'chop' | 'stir' | 'fan' | 'turn' | 'add' | 'serve').

import { game } from '../../game/game';
import { ITEMS } from '../../game/items';
import { count, remove, give, stacks } from '../../game/inventory';
import { stashCount, stashRemove, stashStacks, stashAdd } from '../../game/v11/stash';
import * as CK from '../../game/v11/cooking';
import type { Method, Quality, CookResult } from '../../game/v11/cooking';
import { restore } from '../../game/v10/energy';
import { dayState, dayNumber } from '../../game/v10/day';
import { itemIcon, ICON_IDS } from '../../art/itemicons';
import { itemArtCanvas } from '../../art/v11/itemart';
import { pxIconBuf } from '../pxicons';
import { el } from '../ui';
import { css, sfx, esc, pushKeys, reduced } from '../laptop-kit';
import { packIcons } from './packicons';
import { handLetter, ensureHandFont } from './handletter';
import { paintBundle, paintTag } from './bagart';
import { footprint } from '../../game/v11/footprints';
import { CookSound } from './cooksfx';
import { guardInput } from '../../core/input';
import { registerItemUse } from './backpack';

packIcons();

const CW = 320, CH = 180;

// ---------------------------------------------------------------- the hands hook (3D close-up hands)
export type HandsAction = 'idle' | 'chop' | 'stir' | 'fan' | 'turn' | 'add' | 'serve';
export interface CookHands { act(a: HandsAction, x: number, y: number): void; dispose(): void }
type HandsFactory = (host: HTMLElement, o: { width: number; height: number; method: Method }) => CookHands;
let handsFactory: HandsFactory | null = null;
/** the 3D hands module registers itself here (TODO(hands3d): mountHands3d) */
export function registerCookHands(f: HandsFactory) { handsFactory = f; }

// ---------------------------------------------------------------- pixels

const rgb = (r: number, g: number, b: number) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
const hx = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(n >> 16, (n >> 8) & 255, n & 255); };
const R = (c: number) => c & 255, G = (c: number) => (c >>> 8) & 255, B = (c: number) => (c >>> 16) & 255, A = (c: number) => c >>> 24;
const mix = (a: number, b: number, t: number) => rgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
function ramp(r: number[], t: number, x: number, y: number) {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1), i = Math.floor(f);
  return f - i > 0.3 + dith(x, y) * 0.4 ? r[Math.min(r.length - 1, i + 1)] : r[i];
}

class Px {
  readonly buf = new Uint32Array(CW * CH);
  set(x: number, y: number, c: number) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < CW && y < CH) this.buf[y * CW + x] = c; }
  get(x: number, y: number) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < CW && y < CH ? this.buf[y * CW + x] : 0; }
  blend(x: number, y: number, c: number, a: number) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= CW || y >= CH || a <= 0) return; const i = y * CW + x; this.buf[i] = a >= 1 ? c : mix(this.buf[i], c, a); }
  add(x: number, y: number, r: number, g: number, b: number) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= CW || y >= CH) return;
    const i = y * CW + x, v = this.buf[i];
    this.buf[i] = rgb(Math.min(255, R(v) + r), Math.min(255, G(v) + g), Math.min(255, B(v) + b));
  }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  ellipse(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, nx: number, ny: number) => number | -1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = fn(x, y, nx, ny);
      if (c !== -1) this.set(x, y, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, w: number, fn: (t: number, x: number, y: number) => number) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (let k = -Math.floor(w / 2); k < Math.ceil(w / 2); k++) this.set(x + k, y, fn(t, x + k, y));
    }
  }
  /** blit a sprite (nearest, scaled), tinted toward a colour by k, darkened by dark 0..1 */
  sprite(sp: Sprite, cx: number, cy: number, sx: number, sy: number, tint = 0, tc = 0, dark = 0, flipY = false) {
    const w = Math.round(sp.w * Math.abs(sx)), h = Math.round(sp.h * Math.abs(sy));
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = Math.min(sp.w - 1, Math.floor(x / Math.abs(sx))), v0 = Math.min(sp.h - 1, Math.floor(y / Math.abs(sy)));
      const v = flipY ? sp.h - 1 - v0 : v0;
      let c = sp.d[v * sp.w + u];
      if (A(c) < 100) continue;
      if (tint > 0) c = mix(c, tc, tint);
      if (dark > 0) c = mix(c, hx('#1a0e08'), dark);
      this.set(x0 + x, y0 + y, c);
    }
  }
}
interface Sprite { w: number; h: number; d: Uint32Array }
const spriteCache = new Map<string, Sprite>();
function spriteOf(id: string): Sprite {
  const hit = spriteCache.get(id);
  if (hit) return hit;
  let sp: Sprite;
  const art = itemArtCanvas(id);
  if (art && art.width > 0) {
    const k = Math.max(1, Math.ceil(Math.max(art.width, art.height) / 32));
    const w = Math.max(1, Math.floor(art.width / k)), h = Math.max(1, Math.floor(art.height / k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, w, h);
    sp = { w, h, d: new Uint32Array(g.getImageData(0, 0, w, h).data.buffer.slice(0)) };
  } else {
    const b = new Set(ICON_IDS.items()).has(id) ? itemIcon(id) : paintBundle(id, ITEMS[id]?.kind ?? 'food', footprint(id));
    sp = { w: b.w, h: b.h, d: new Uint32Array(b.data) };
  }
  spriteCache.set(id, sp);
  return sp;
}
/** a sprite as a canvas at 1x */
function spriteCanvas(sp: Sprite): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h;
  const u8 = new Uint8ClampedArray(sp.w * sp.h * 4);
  u8.set(new Uint8Array(sp.d.buffer, sp.d.byteOffset, sp.w * sp.h * 4));
  c.getContext('2d', { willReadFrequently: true })!.putImageData(new ImageData(u8, sp.w, sp.h), 0, 0);
  return c;
}
function bufURLCanvas(b: { w: number; h: number; bytes: Uint8Array }, scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  c.getContext('2d', { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  c.style.width = b.w * scale + 'px'; c.style.height = b.h * scale + 'px';
  return c;
}
const icon = (n: string) => { const c = bufURLCanvas(pxIconBuf(n)); c.className = 'ic'; return c; };

// ---------------------------------------------------------------- scenery

type Setting = 'morning' | 'day' | 'dusk' | 'field';
function paintBase(set: Setting): Uint32Array {
  const p = new Px();
  const sky = set === 'morning' ? ['#2a2a4a', '#5a4a6a', '#c88a6a', '#f0c890'] : set === 'dusk' ? ['#0e0c1e', '#1e1830', '#3a2840', '#6a3a3a'] : set === 'field' ? ['#0e140e', '#16200f', '#1e2c14', '#2a3a1a'] : ['#3a6a9a', '#5a8ab8', '#8ab8d8', '#c8e0e8'];
  const SKY = sky.map(hx);
  const GROUND = (set === 'field' ? ['#1a140c', '#2a2014', '#3a2e1c', '#4e3e26', '#625030'] : ['#5a4a32', '#7a6644', '#9a8458', '#b8a070', '#d2bc8c']).map(hx);
  const HORIZON = 62;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c: number;
    if (y < HORIZON) c = ramp(SKY, y / HORIZON, x, y);
    else {
      const v = (y - HORIZON) / (CH - HORIZON);
      c = ramp(GROUND, 0.25 + v * 0.55 + (hash(x >> 1, y >> 1, 3) - 0.5) * 0.25, x, y);
    }
    p.set(x, y, c);
  }
  if (set !== 'field') {
    // the sea along the horizon and a far headland
    for (let x = 0; x < CW; x++) for (let y = HORIZON - 8; y < HORIZON; y++) p.set(x, y, ramp(set === 'dusk' ? ['#14182a', '#1e2638'].map(hx) : ['#2a5a7a', '#4a7a9a', '#8ab0c0'].map(hx), (y - HORIZON + 8) / 8 + (hash(x >> 2, y, 5) - 0.5) * 0.3, x, y));
    for (let x = 220; x < 320; x++) { const h = Math.round(10 * Math.sin((x - 220) / 100 * Math.PI) + hash(x >> 2, 1, 7) * 2); for (let y = HORIZON - 8 - h; y < HORIZON - 8; y++) p.set(x, y, hx(set === 'dusk' ? '#0e1018' : '#4a5a6a')); }
  } else {
    // trunks and ferns in the dark
    for (const tx of [24, 70, 250, 296]) for (let y = 0; y < HORIZON + 10; y++) for (let x = tx - 5; x < tx + 5; x++) p.set(x, y, ramp(['#0c0a06', '#16120a', '#201a10'].map(hx), (x - tx + 5) / 10 * 0.8, x, y));
  }
  // palm silhouettes either side (camp) / fern fronds (field)
  const LEAF = hx(set === 'day' ? '#2a4a2a' : '#0a0e0a');
  for (const [bx, dir] of [[8, 1], [312, -1]] as [number, number][]) {
    for (let i = 0; i < 6; i++) {
      const a = -0.3 - i * 0.45 * dir;
      for (let k = 0; k < 40; k++) {
        const x = bx + Math.cos(a) * k * dir, y = 30 + Math.sin(a) * k * 0.6 + (k * k) * 0.012;
        p.set(x, y, LEAF); p.set(x, y + 1, LEAF);
        if (k % 3 === 0) { p.set(x + 1, y + 3, LEAF); p.set(x - 1, y + 3, LEAF); }
      }
    }
  }
  // the log seat at the back
  for (let x = 86; x < 236; x++) for (let y = 86; y < 96; y++) {
    const v = (y - 86) / 10;
    p.set(x, y, ramp(['#2a1a0c', '#4a3018', '#6a4424', '#8a5c32'].map(hx), 0.85 - v * 0.8 + (hash(x >> 3, y, 9) - 0.5) * 0.2, x, y));
  }
  // the driftwood board, bottom left
  for (let y = 136; y < 177; y++) for (let x = 4; x < 104; x++) {
    const sk = (y - 136) * 0.12;
    if (x < 4 + sk || x > 104 - (40 - (y - 136)) * 0.05) continue;
    const grain = Math.sin((y * 2.1 + hash(x >> 4, 3, 2) * 30) * 0.4) * 0.08;
    const e = y === 136 || y === 176 ? -0.35 : 0;
    p.set(x, y, ramp(['#2e241a', '#4a3a2a', '#66523c', '#7e6a50', '#968266'].map(hx), 0.62 - (y - 136) / 80 + grain + e + (hash(x, y, 4) > 0.97 ? -0.2 : 0), x, y));
  }
  // its edge and the shadow it throws on the sand
  for (let x = 6; x < 104; x++) { p.set(x, 177, hx('#3a2e1c')); p.set(x, 178, hx('#5a4a32')); p.set(x, 135, hx('#b4a07c')); }
  // the woodpile, bottom right
  for (const [lx, ly] of [[256, 166], [284, 166], [270, 156], [298, 156], [284, 146]] as [number, number][]) logSprite(p, lx, ly, 13, 5);
  return p.buf;
}
function logSprite(p: Px, cx: number, cy: number, rx: number, ry: number) {
  const BARK = ['#24160a', '#3e2814', '#5a3a1e', '#764e2a'].map(hx);
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if (Math.abs(y) > ry) continue;
    const end = x > rx - 3;
    const c = end ? (x === rx || Math.abs(y) === ry ? hx('#3a2614') : hash(x, y, 1) > 0.5 ? hx('#c8a070') : hx('#b08858')) : ramp(BARK, 0.7 - (y + ry) / (ry * 2) * 0.7 + (hash(x >> 1, y, 3) - 0.5) * 0.25, cx + x, cy + y);
    p.set(cx + x, cy + y, c);
  }
}

// ---------------------------------------------------------------- styles

const CSS = `
.ck11 { position: absolute; inset: 0; z-index: 37; background: radial-gradient(ellipse at 50% 60%, #2a1c10, #07060a 75%); overflow: hidden; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; font-family: 'Jersey 15', 'Pixelify Sans', monospace; animation: ck11In 0.5s ease-out both; }
@keyframes ck11In { from { opacity: 0; } }
.ck11.out { animation: ck11Out 0.4s ease-in both; }
@keyframes ck11Out { to { opacity: 0; } }
.ck11 .stage { position: absolute; left: 0; top: 0; width: ${CW}px; height: ${CH}px; transform-origin: 0 0; }
.ck11 canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
.ck11 .stage > canvas.main { position: absolute; left: 0; top: 0; animation: ck11Zoom 0.9s cubic-bezier(.2,.8,.3,1) both; }
@keyframes ck11Zoom { from { transform: scale(1.3); filter: brightness(0.3) blur(3px); } }
.ck11 canvas.ic { display: inline-block; vertical-align: middle; flex: none; }
.ck11 .mat { position: absolute; left: 50px; top: 3px; width: 220px; height: 26px; display: flex; gap: 2px; align-items: center; padding: 0 4px; box-sizing: border-box;
  background: repeating-linear-gradient(90deg, #8a7a44 0 2px, #a8945a 2px 4px, #6a5a32 4px 5px); box-shadow: 0 0 0 1px #2a2010, 0 2px 0 rgba(0,0,0,0.5); overflow-x: auto; scrollbar-width: none; }
.ck11 .chip { position: relative; flex: none; width: 22px; height: 22px; display: grid; place-items: center; cursor: grab; touch-action: none; }
.ck11 .chip canvas { max-width: 22px; max-height: 22px; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.6)); }
.ck11 .chip b { position: absolute; right: 0; bottom: -1px; font-weight: normal; font-size: 7px; color: #fff8e0; text-shadow: 1px 0 0 #120e07, -1px 0 0 #120e07, 0 1px 0 #120e07, 0 -1px 0 #120e07; }
.ck11 .chip.stash::after { content: ''; position: absolute; left: 1px; top: 1px; width: 3px; height: 3px; background: #c8a070; box-shadow: 0 0 0 1px #3a2614; }
.ck11 .chip:hover { filter: brightness(1.2); }
.ck11 .mat .none { font-size: 7px; color: #2a2010; padding-left: 4px; white-space: nowrap; }
.ck11 .drag { position: absolute; pointer-events: none; z-index: 20; filter: drop-shadow(2px 3px 0 rgba(0,0,0,0.45)); }
.ck11 .btn11 { all: unset; box-sizing: border-box; position: absolute; height: 18px; min-width: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; cursor: pointer;
  border-style: solid; border-width: 3px; border-image: var(--sk-btn-wood) 4 fill / 3px / 0 stretch; color: #fff6dc; font-size: 7px; letter-spacing: 0.06em; text-shadow: 0 1px 0 rgba(0,0,0,0.7); z-index: 5; }
.ck11 .btn11.green { border-image-source: var(--sk-btn); }
.ck11 .btn11.amber { border-image-source: var(--sk-btn-amber); }
.ck11 .btn11:hover { filter: brightness(1.15); }
.ck11 .btn11[hidden] { display: none; }
.ck11 .btn11.pulse { animation: ck11Pulse 0.9s steps(4) infinite; }
@keyframes ck11Pulse { 50% { filter: brightness(1.35) drop-shadow(0 0 3px #ffe070); } }
.ck11 .say { position: absolute; left: 6px; top: 34px; max-width: 150px; font-size: 7.5px; line-height: 8.5px; color: #0c0a0c; background: #fff; padding: 3px 5px 4px; box-shadow: 0 0 0 1px #0c0a0c, 2px 2px 0 1px rgba(0,0,0,0.4); transform-origin: 10% 0; animation: ck11Pop 0.3s cubic-bezier(.2,1.7,.4,1) both; z-index: 6; }
.ck11 .say b { display: block; font-weight: normal; font-size: 5.5px; letter-spacing: 0.12em; color: #fff; background: #0c0a0c; margin: -3px -5px 2px; padding: 1px 4px; box-shadow: inset 3px 0 0 var(--c, #3fbca6); }
.ck11 .say.shout { animation: ck11Pop 0.3s cubic-bezier(.2,1.7,.4,1) both, ck11Shk 0.12s steps(2) 3 0.3s; }
@keyframes ck11Pop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.06); opacity: 1; } }
@keyframes ck11Shk { 50% { transform: translate(1px, -1px); } }
.ck11 .hint { position: absolute; left: 0; right: 0; bottom: 3px; text-align: center; font-size: 7px; color: rgba(255,246,228,0.9); text-shadow: 0 1px 0 #000; pointer-events: none; transition: opacity 0.5s; z-index: 5; }
.ck11 .hint .ic { margin: 0 2px; }
.ck11 .pick { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; gap: 14px; padding-bottom: 40px; z-index: 8; background: radial-gradient(ellipse at 50% 70%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45)); }
.ck11 .pick button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 7px; color: #fff3cc; text-shadow: 0 1px 0 #000; padding: 3px; }
.ck11 .pick button:hover { filter: brightness(1.25); transform: translateY(-2px); }
.ck11 .pick button canvas { filter: drop-shadow(0 2px 0 rgba(0,0,0,0.5)); }
.ck11 .pick .ttl { position: absolute; left: 0; right: 0; top: 52px; display: flex; justify-content: center; pointer-events: none; }
.ck11 .res { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 9; background: rgba(6,4,2,0.55); animation: ck11In 0.3s both; }
.ck11 .res .word { position: absolute; top: 18px; left: 0; right: 0; text-align: center; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 26px; letter-spacing: 0.06em; color: #fff7d8;
  text-shadow: 3px 3px 0 #c8341e, -1px -1px 0 #3a1408, 1px -1px 0 #3a1408, -1px 1px 0 #3a1408; transform: rotate(-4deg); animation: ck11Word 0.5s cubic-bezier(.25,1.8,.45,1) both; }
.ck11 .res .word.bad { color: #e8f2ff; text-shadow: 3px 3px 0 #2a4a8a, -1px -1px 0 #0a1428, 1px -1px 0 #0a1428, -1px 1px 0 #0a1428; }
@keyframes ck11Word { 0% { transform: rotate(-4deg) scale(2.4); opacity: 0; } 100% { transform: rotate(-4deg) scale(1); opacity: 1; } }
.ck11 .res .tag { position: relative; width: 112px; height: 120px; margin-top: 30px; animation: ck11Pop 0.45s cubic-bezier(.2,1.6,.4,1) both 0.25s; }
.ck11 .res .tag > * { position: absolute; }
.ck11 .res .new { right: -10px; top: 6px; transform: rotate(14deg); font-size: 7px; color: #a8281a; border: 1px solid #a8281a; padding: 1px 3px 0; background: rgba(255,240,200,0.6); letter-spacing: 0.08em; }
.ck11 .res .tag .n { left: 0; right: 0; top: 88px; text-align: center; font-size: 7.5px; color: #3a2e18; }
.ck11 .res .go { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); }
.ck11 .book { position: absolute; inset: 0; z-index: 10; background: rgba(4,3,2,0.6); display: grid; place-items: center; animation: ck11In 0.25s both; }
.ck11 .book .page { position: relative; width: 236px; height: 168px; background: #e8d6a6; box-shadow: 0 0 0 1px #4a3818, 3px 3px 0 1px rgba(0,0,0,0.4), inset 0 0 18px rgba(120,80,30,0.35);
  background-image: repeating-linear-gradient(0deg, transparent 0 10px, rgba(90,110,140,0.18) 10px 11px); padding: 6px 8px; box-sizing: border-box; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 8px; align-content: start; overflow: hidden; }
.ck11 .book .page::before { content: ''; position: absolute; left: 50%; top: 4px; bottom: 4px; width: 1px; background: rgba(90,60,20,0.35); }
.ck11 .book .rc { min-height: 28px; font-size: 6.5px; line-height: 7.5px; color: #3a2e18; }
.ck11 .book .rc .ings { display: flex; gap: 1px; align-items: center; flex-wrap: wrap; margin-top: 1px; }
.ck11 .book .rc .ings span { display: inline-flex; align-items: center; font-size: 6px; }
.ck11 .book .rc.unk { color: #8a7650; }
.ck11 .book .rc .st { color: #2f6b2a; }
.ck11 .book .x { position: absolute; right: -6px; top: -6px; z-index: 2; }
`;

// ---------------------------------------------------------------- the close-up

export interface CookOpts {
  /** at camp the stash is the larder too; in the field there's only what's in the pack */
  where: 'camp' | 'field';
  setting?: Setting;
  /** the cookware is already decided (else Mori picks) */
  method?: Method;
  /** who's around to give tips ('joshu' at camp; none = Mori talks to himself) */
  coach?: 'joshu' | 'aroha' | null;
  /** what it's for, shown at the start */
  title?: string;
}
export interface CookOutcome { result: CookResult | null; ids: string[] }

interface InPot { id: string; chopped: boolean; from: 'pack' | 'stash'; x: number; y: number; a: number }
interface Board { id: string; from: 'pack' | 'stash'; chops: number; need: number; t: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'steam' | 'smoke' | 'spark' | 'ember' | 'bubble' | 'chunk'; c?: number };

const METHOD_NAME: Record<Method, string> = { pot: 'the pot', pan: 'the pan', skewer: 'the skewers' };

let running: Promise<CookOutcome> | null = null;
let current: unknown = null;

export function runCooking(o: CookOpts): Promise<CookOutcome> {
  if (running) return running;
  const ck = new Cook(o);
  current = ck;
  running = ck.run().finally(() => { running = null; current = null; });
  return running;
}

class Cook {
  root: HTMLElement;
  stage: HTMLElement;
  cv: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  img: ImageData;
  px = new Px();
  base: Uint32Array;
  s = 1;
  method: Method | null;
  fire = 0.55;
  fireTarget = 0.55;
  fan = 0;
  fanning = false;
  heatPot = 0.2;
  pot: InPot[] = [];
  board: Board | null = null;
  done = 0;
  sideA = 0; sideB = 0; side: 0 | 1 = 0;
  stick = 0;
  care = 1;
  burnSmoke = 0;
  stirAng = 0;
  stirSpin = 0;
  lastStir = 0;
  logs: { x: number; y: number; t: number }[] = [];
  parts: Particle[] = [];
  t = 0;
  knifeT = 0;
  turnT = 0;
  sound = new CookSound();
  hands: CookHands | null = null;
  mat!: HTMLElement;
  serveBtn!: HTMLElement;
  hintEl!: HTMLElement;
  sayEl: HTMLElement | null = null;
  sayT = 0;
  tipCool: Record<string, number> = {};
  drag: { id: string; from: 'pack' | 'stash'; e: HTMLElement; pid: number; board?: boolean } | null = null;
  stirPid = -1; stirPrev: number | null = null;
  fanPid = -1;
  private raf = 0;
  private offs: (() => void)[] = [];
  private resolve!: (o: CookOutcome) => void;
  private finished = false;
  private used: string[] = [];

  constructor(readonly o: CookOpts) {
    css('ck11', CSS);
    void ensureHandFont();
    this.method = o.method ?? null;
    this.root = el('div', 'ck11');
    this.stage = this.root.appendChild(el('div', 'stage'));
    this.cv = this.stage.appendChild(el('canvas', 'main') as HTMLCanvasElement);
    this.cv.width = CW; this.cv.height = CH;
    this.g = this.cv.getContext('2d')!;
    this.img = this.g.createImageData(CW, CH);
    this.base = paintBase(o.setting ?? (o.where === 'field' ? 'field' : 'day'));
  }

  run(): Promise<CookOutcome> {
    const p = new Promise<CookOutcome>(r => (this.resolve = r));
    game.ui.modalLayer.appendChild(this.root);
    game.ui.modalOpen++;
    this.fit();
    this.buildUI();
    this.listen();
    this.sound.start();
    sfx('fireLight' as never, { vol: 0.3 });
    if (handsFactory) { try { this.hands = handsFactory(this.stage, { width: CW, height: CH, method: this.method ?? 'pot' }); } catch (e) { console.error(e); } }
    if (!this.method) this.pickMethod(); else this.begin();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(now); };
    this.raf = requestAnimationFrame(loop);
    return p;
  }

  private fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    // cover the screen when that crops only a sliver, else fit it whole (wide and tall phones)
    const cover = Math.max(vw / CW, vh / CH), contain = Math.min(vw / CW, vh / CH);
    const s = cover / contain < 1.1 ? cover : contain;
    this.s = s;
    this.stage.style.transform = `scale(${s})`;
    this.stage.style.left = Math.round((vw - CW * s) / 2) + 'px';
    this.stage.style.top = Math.round((vh - CH * s) / 2) + 'px';
  }

  private buildUI() {
    const st = this.stage;
    // the mat with the food on it
    this.mat = st.appendChild(el('div', 'mat'));
    this.fillMat();
    // the notebook, leave
    const bk = st.appendChild(el('button', 'btn11'));
    bk.appendChild(icon('v11book'));
    bk.title = 'Recipe notebook';
    bk.style.left = '4px'; bk.style.top = '6px';
    bk.addEventListener('click', e => { e.stopPropagation(); void this.openBook(); });
    const x = st.appendChild(el('button', 'btn11'));
    x.appendChild(icon('v11x'));
    x.title = 'Leave it (Esc)';
    x.style.right = '4px'; x.style.top = '6px';
    x.addEventListener('click', e => { e.stopPropagation(); this.leave(); });
    // serve
    this.serveBtn = st.appendChild(el('button', 'btn11 green'));
    this.serveBtn.appendChild(icon('v11eat'));
    this.serveBtn.appendChild(el('span', '', 'SERVE'));
    this.serveBtn.style.left = '254px'; this.serveBtn.style.top = '120px';
    this.serveBtn.hidden = true;
    this.serveBtn.addEventListener('click', e => { e.stopPropagation(); this.serve(); });
    this.hintEl = st.appendChild(el('div', 'hint'));
  }

  /** what can go in: food from the pack (and at camp, the stash) */
  private larder(): { id: string; n: number; from: 'pack' | 'stash' }[] {
    const out: { id: string; n: number; from: 'pack' | 'stash' }[] = [];
    const seen = new Set<string>();
    for (const s of stacks()) if (CK.isIngredient(s.id) && !seen.has(s.id)) { seen.add(s.id); out.push({ id: s.id, n: count(s.id), from: 'pack' }); }
    if (this.o.where === 'camp') {
      const seen2 = new Set<string>();
      for (const s of stashStacks()) if (CK.isIngredient(s.id) && !seen.has(s.id) && !seen2.has(s.id)) { seen2.add(s.id); out.push({ id: s.id, n: stashCount(s.id), from: 'stash' }); }
    }
    return out;
  }

  fillMat() {
    this.mat.innerHTML = '';
    const l = this.larder();
    if (!l.length) { this.mat.appendChild(el('span', 'none', 'Nothing to cook in the pack. Berries, shellfish, fish, roots...')); return; }
    for (const f of l) {
      const c = this.mat.appendChild(el('div', 'chip' + (f.from === 'stash' ? ' stash' : '')));
      const sp = spriteOf(f.id);
      const cv = spriteCanvas(sp);
      c.appendChild(cv);
      c.appendChild(el('b', '', String(f.n)));
      c.title = `${ITEMS[f.id]?.name ?? f.id}${f.from === 'stash' ? ' (from the stash)' : ''}`;
      (c as unknown as { __f: typeof f }).__f = f;
    }
  }

  private pickMethod() {
    const pk = this.stage.appendChild(el('div', 'pick'));
    const ttl = pk.appendChild(el('div', 'ttl'));
    ttl.appendChild(handLetter(this.o.title ?? 'What are we cooking with?', { px: 13, color: '#fff3cc', bleed: '#3a2a14', maxW: 220 }));
    const opts: [Method, string][] = [['pot', 'v11pot'], ['pan', 'v11fire'], ['skewer', 'v11knife']];
    for (const [m] of opts) {
      if (this.o.where === 'field' && m === 'pan') continue;
      const b = pk.appendChild(el('button', ''));
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 40;
      const px = new Px();
      // a little portrait of the cookware
      px.buf.fill(0);
      this.drawWare(px, m, 32, 20, 0.62, true);
      const u8 = new Uint8ClampedArray(CW * CH * 4); u8.set(new Uint8Array(px.buf.buffer));
      const id = new ImageData(u8, CW, CH);
      const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH; tmp.getContext('2d')!.putImageData(id, 0, 0);
      cv.getContext('2d')!.drawImage(tmp, 0, 0, 64, 40, 0, 0, 64, 40);
      b.appendChild(cv);
      b.appendChild(el('span', '', m === 'pot' ? 'POT' : m === 'pan' ? 'PAN' : 'SKEWERS'));
      b.addEventListener('click', e => { e.stopPropagation(); this.method = m; pk.remove(); sfx('place', { vol: 0.5, pitch: 0.8 }); this.begin(); });
    }
  }

  private begin() {
    const m = this.method!;
    this.hint(m === 'pot' ? 'Food into the pot · keep the fire up · stir' : 'Food on · keep the fire up · turn it');
    const c = this.o.coach;
    if (c) setTimeout(() => this.say(c, c === 'joshu' ? `${m === 'pot' ? 'Pot’s on.' : m === 'pan' ? 'Pan’s hot.' : 'Sticks are ready.'} What are you making, lad?` : 'Show me what you’ve got.'), 700);
    else setTimeout(() => this.say('mori', 'Right. Cooking. How hard can it be?'), 700);
    this.hands?.act('idle', 160, 110);
  }

  // ------------------------------------------------------------ input
  private toCanvas(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.stage.getBoundingClientRect();
    return [(e.clientX - r.left) / this.s, (e.clientY - r.top) / this.s];
  }
  private listen() {
    const down = (e: PointerEvent) => this.onDown(e), move = (e: PointerEvent) => this.onMove(e), up = (e: PointerEvent) => this.onUp(e);
    this.root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const rs = () => this.fit();
    window.addEventListener('resize', rs);
    this.offs.push(() => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('resize', rs); });
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'KeyF') this.fanning = false; };
    window.addEventListener('keyup', keyUp);
    this.offs.push(() => window.removeEventListener('keyup', keyUp));
    this.offs.push(pushKeys(e => {
      if (this.finished) return true;
      if (e.code === 'Escape') { if (this.root.querySelector('.book')) { this.root.querySelector('.book')!.remove(); return true; } this.leave(); return true; }
      if (!this.method) return true;
      if (e.code === 'KeyW') { this.addLog(); return true; }
      if (e.code === 'KeyF') { this.fanning = true; return true; }
      if (e.code === 'KeyS') { this.stir(0.9); return true; }
      if (e.code === 'KeyT') { this.turn(); return true; }
      if (e.code === 'KeyC' || e.code === 'Space') { this.chop(); return true; }
      if (e.code === 'Enter') { if (!this.serveBtn.hidden) this.serve(); return true; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const f = this.larder()[n - 1]; if (f) this.addFood(f.id, f.from); return true; }
      return true;
    }));
  }

  private onDown(e: PointerEvent) {
    if (this.finished || !this.method) return;
    const t = e.target as HTMLElement;
    const chip = t.closest('.chip') as HTMLElement | null;
    if (chip) {
      const f = (chip as unknown as { __f: { id: string; from: 'pack' | 'stash' } }).__f;
      e.preventDefault();
      const d = el('div', 'drag');
      const sp = spriteOf(f.id);
      const cv = spriteCanvas(sp);
      d.appendChild(cv);
      this.stage.appendChild(d);
      this.drag = { id: f.id, from: f.from, e: d, pid: e.pointerId };
      this.moveDrag(e);
      sfx('rustle', { vol: 0.3, pitch: 1.4 });
      return;
    }
    if (t.closest('button') || t.closest('.mat')) return;
    const [x, y] = this.toCanvas(e);
    // the board: chop (or pick the chopped food up)
    if (this.board && x < 106 && y > 128) {
      if (this.board.chops >= this.board.need) {
        const d = el('div', 'drag');
        d.appendChild(this.boardCanvas());
        this.stage.appendChild(d);
        this.drag = { id: this.board.id, from: this.board.from, e: d, pid: e.pointerId, board: true };
        this.moveDrag(e);
      } else this.chop();
      return;
    }
    // the woodpile
    if (x > 240 && y > 138) { this.addLog(); return; }
    // the fan by the woodpile
    if (x > 212 && x <= 240 && y > 140) { this.fanning = true; this.fanPid = e.pointerId; this.hands?.act('fan', x, y); return; }
    // the cookware: stir the pot, turn the pan / skewer
    const ware = this.method === 'pot' ? (Math.hypot((x - 160) / 30, (y - 106) / 12) < 1.4) : (Math.abs(x - 160) < 48 && Math.abs(y - 112) < 16);
    if (ware) {
      if (this.method === 'pot') { this.stirPid = e.pointerId; this.stirPrev = Math.atan2((y - 106) * 2.4, x - 160); }
      else this.turn();
      return;
    }
    // the fire itself: fanning it with a hand
    if (Math.abs(x - 160) < 40 && y > 118 && y < 158) { this.fanning = true; this.fanPid = e.pointerId; }
  }
  private moveDrag(e: { clientX: number; clientY: number }) {
    const d = this.drag;
    if (!d) return;
    const [x, y] = this.toCanvas(e);
    d.e.style.left = Math.round(x - 12) + 'px'; d.e.style.top = Math.round(y - 12) + 'px';
  }
  private onMove(e: PointerEvent) {
    if (this.drag && e.pointerId === this.drag.pid) { this.moveDrag(e); return; }
    if (e.pointerId === this.stirPid && this.method === 'pot') {
      const [x, y] = this.toCanvas(e);
      const a = Math.atan2((y - 106) * 2.4, x - 160);
      if (this.stirPrev !== null) {
        let da = a - this.stirPrev;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > 0.02) this.stir(Math.abs(da));
      }
      this.stirPrev = a;
    }
  }
  private onUp(e: PointerEvent) {
    if (e.pointerId === this.fanPid) { this.fanning = false; this.fanPid = -1; }
    if (e.pointerId === this.stirPid) { this.stirPid = -1; this.stirPrev = null; }
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    this.drag = null;
    d.e.remove();
    const [x, y] = this.toCanvas(e);
    const onWare = this.method === 'pot' ? Math.hypot((x - 160) / 40, (y - 104) / 26) < 1.2 : Math.abs(x - 160) < 60 && y > 80 && y < 135;
    const onBoard = x < 110 && y > 120;
    if (d.board) { if (onWare) this.boardIn(); return; }
    if (onBoard && CK.INGREDIENTS[d.id]?.chop) { this.toBoard(d.id, d.from); return; }
    if (onWare) { this.addFood(d.id, d.from, true); return; }
    // a tap: the sensible place
    if (y < 34) this.addFood(d.id, d.from);
  }

  // ------------------------------------------------------------ actions
  private take(id: string, from: 'pack' | 'stash'): boolean {
    const ok = from === 'pack' ? remove(id, 1) : stashRemove(id, 1);
    if (ok) { this.used.push(`${from}:${id}`); this.fillMat(); }
    return ok;
  }
  /** a tap on the mat: choppable things go on the board, the rest straight in */
  addFood(id: string, from: 'pack' | 'stash', direct = false) {
    if (!direct && CK.INGREDIENTS[id]?.chop && !this.board) { this.toBoard(id, from); return; }
    if (this.pot.length >= 8) { this.say('mori', 'That’s plenty in there.'); sfx('wrong', { vol: 0.3 }); return; }
    if (!this.take(id, from)) return;
    this.dropIn(id, from, false);
  }
  private dropIn(id: string, from: 'pack' | 'stash', chopped: boolean) {
    const m = this.method!;
    const n = this.pot.length;
    const x = m === 'pot' ? 160 + Math.cos(n * 2.4) * 12 : m === 'pan' ? 136 + (n % 4) * 16 : 128 + n * 13;
    const y = m === 'pot' ? 106 + Math.sin(n * 2.4) * 3 : m === 'pan' ? 114 + Math.floor(n / 4) * 5 : 102;
    this.pot.push({ id, chopped, from, x, y, a: n * 2.4 });
    if (CK.INGREDIENTS[id]?.chop && !chopped) this.care -= 0.12;
    // a new cold thing slows the lot down a little
    this.done *= (this.pot.length - 1) / this.pot.length;
    this.sideA *= (this.pot.length - 1) / this.pot.length; this.sideB *= (this.pot.length - 1) / this.pot.length;
    this.sound.splash(m !== 'pot' && this.heatPot > 0.4);
    for (let i = 0; i < 6; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0.5, max: 0.5, kind: m === 'pot' ? 'bubble' : 'spark' });
    this.serveBtn.hidden = false;
    this.hands?.act('add', x, y);
    this.coachOnAdd();
  }
  private toBoard(id: string, from: 'pack' | 'stash') {
    if (this.board) { this.boardIn(); }
    if (!this.take(id, from)) return;
    this.board = { id, from, chops: 0, need: 4, t: 0 };
    sfx('place', { vol: 0.45, pitch: 0.8 });
    this.hint('Tap the board to chop');
  }
  chop() {
    const b = this.board;
    if (!b) return;
    if (b.chops >= b.need) { this.boardIn(); return; }
    b.chops++;
    this.knifeT = 0.18;
    this.sound.chop();
    this.hands?.act('chop', 54, 152);
    for (let i = 0; i < 3; i++) this.parts.push({ x: 54 + (Math.random() - 0.5) * 20, y: 150, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 20, life: 0.4, max: 0.4, kind: 'chunk', c: hx(CK.INGREDIENTS[b.id]?.raw ?? '#c8b878') });
    if (b.chops >= b.need) this.hint('Drag it into ' + METHOD_NAME[this.method!] + ' (or tap again)');
  }
  private boardIn() {
    const b = this.board;
    if (!b) return;
    this.board = null;
    this.dropIn(b.id, b.from, b.chops >= b.need);
  }
  addLog() {
    if (this.logs.length > 2) return;
    this.logs.push({ x: 284, y: 150, t: 0 });
    sfx('whoosh', { vol: 0.2, pitch: 1.3 });
  }
  stir(k: number) {
    if (this.method !== 'pot' || !this.pot.length) return;
    this.stirSpin += k * 2.5;
    this.lastStir = this.t;
    this.stick = Math.max(0, this.stick - k * 0.6);
    if (Math.random() < 0.3) sfx('splash', { vol: 0.08, pitch: 2.4 });
    this.hands?.act('stir', 160, 104);
  }
  turn() {
    if (this.method === 'pot' || !this.pot.length || this.turnT > 0) return;
    this.side = this.side ? 0 : 1;
    this.turnT = 0.3;
    sfx('hiss', { vol: 0.25, pitch: 1.8 });
    this.hands?.act('turn', 160, 110);
  }

  // ------------------------------------------------------------ talking
  say(who: string, text: string, shout = false) {
    this.sayEl?.remove();
    const nm = who === 'mori' ? 'MORI' : who.toUpperCase();
    const c = who === 'joshu' ? '#2c3a5a' : who === 'aroha' ? '#8a4b2a' : '#4a6a2a';
    const b = this.stage.appendChild(el('div', 'say' + (shout ? ' shout' : '')));
    b.style.setProperty('--c', c);
    b.appendChild(el('b', '', nm));
    b.appendChild(document.createTextNode(text));
    this.sayEl = b;
    this.sayT = 3.6;
  }
  private tip(k: string, lines: string[], cool = 7, shout = false) {
    if ((this.tipCool[k] ?? 0) > this.t) return;
    this.tipCool[k] = this.t + cool;
    const who = this.o.coach ?? 'mori';
    this.say(who, lines[Math.floor(Math.random() * lines.length)], shout);
  }
  private coachOnAdd() {
    const ids = this.pot.map(p => p.id);
    const pl = CK.plan(this.method!, ids);
    if (pl.recipe && !CK.knowsRecipe(pl.recipe.id) && this.o.coach === 'joshu' && pl.recipe.teach?.who === 'joshu') this.tip('rec', ['Oh, now that’s the start of something. Keep going.'], 20);
    if (CK.riskyIn([ids[ids.length - 1]]).length) this.tip('risky', ['You sure about that one? Fire doesn’t make a bad mushroom good.', 'Cooking it won’t make it safe, you know.'], 30);
  }
  hint(t: string) { this.hintEl.textContent = t; this.hintEl.style.opacity = '1'; }

  // ------------------------------------------------------------ the simulation
  private frame(now: number) {
    const dt = Math.min(0.05, 1 / 60);
    void now;
    if (!this.finished) this.step(dt);
    this.draw();
    this.g.putImageData(this.img, 0, 0);
  }

  private step(dt: number) {
    this.t += dt;
    // the fire: dies down, logs catch, the fan roars it up
    for (const l of this.logs) l.t += dt;
    const landed = this.logs.filter(l => l.t > 0.55);
    for (const l of landed) { this.fireTarget = Math.min(1, this.fireTarget + 0.32); sfx('land', { vol: 0.3, pitch: 0.7 }); for (let i = 0; i < 14; i++) this.parts.push({ x: 160 + (Math.random() - 0.5) * 30, y: 138, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 60, life: 1, max: 1, kind: 'ember' }); }
    this.logs = this.logs.filter(l => l.t <= 0.55);
    this.fireTarget = Math.max(0.05, this.fireTarget - dt * (this.method ? 0.028 : 0.01));
    this.fan += ((this.fanning ? 0.32 : 0) - this.fan) * Math.min(1, dt * (this.fanning ? 4 : 1.5));
    if (this.fanning && Math.random() < dt * 3) sfx('whoosh', { vol: 0.12, pitch: 1.6 });
    this.fire += (this.fireTarget - this.fire) * Math.min(1, dt * 0.9);
    const heat = Math.min(1.2, this.fire + this.fan);
    // the cookware lags behind the fire (the pot most of all)
    this.heatPot += (heat - this.heatPot) * Math.min(1, dt * (this.method === 'pot' ? 0.6 : 1.6));
    if (this.turnT > 0) this.turnT -= dt;
    if (this.knifeT > 0) this.knifeT -= dt;
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) { this.sayEl?.remove(); this.sayEl = null; } }
    this.stirSpin *= Math.pow(0.2, dt);
    this.stirAng += this.stirSpin * dt;
    // cooking
    const m = this.method;
    let sizzle = 0, boil = 0;
    if (m && this.pot.length) {
      const ids = this.pot.map(p => p.id);
      const pl = CK.plan(m, ids);
      const [lo, hi] = pl.heat;
      const h = this.heatPot;
      const rate = h < lo ? Math.pow(h / lo, 2) * 0.55 : h <= hi ? 1 : 1 + (h - hi) * 4;
      const step = (rate / pl.time) * dt;
      if (m === 'pot') {
        this.done += step;
        boil = Math.max(0, (h - 0.3) / 0.7);
        // not stirred: it sticks and catches
        if (h > lo && this.t - this.lastStir > 4) { this.stick += dt * 0.25; this.care -= dt * 0.02; }
        if (this.stick > 0.5) this.done += step * this.stick;
        if (h > hi + 0.08) this.care -= dt * 0.03;
      } else {
        if (this.side === 0) this.sideA += step * 1.7; else this.sideB += step * 1.7;
        this.sideA += step * 0.15; this.sideB += step * 0.15;
        this.done = (this.sideA + this.sideB) / 2;
        if (Math.abs(this.sideA - this.sideB) > 0.45) this.care -= dt * 0.04;
        sizzle = Math.min(1, h * 1.2) * (m === 'pan' ? 1 : 0.55);
      }
      this.care = Math.max(0, Math.min(1, this.care));
      const burnt = this.maxSide() > 1.15;
      this.burnSmoke = burnt ? Math.min(1, this.burnSmoke + dt) : Math.max(0, this.burnSmoke - dt * 0.5);
      // steam and smoke
      if (m === 'pot' && Math.random() < dt * (2 + boil * 14)) this.parts.push({ x: 160 + (Math.random() - 0.5) * 36, y: 100, vx: (Math.random() - 0.5) * 6, vy: -10 - boil * 14, life: 2.2, max: 2.2, kind: 'steam' });
      if (m !== 'pot' && Math.random() < dt * (h * 10)) this.parts.push({ x: 160 + (Math.random() - 0.5) * 50, y: 106, vx: (Math.random() - 0.5) * 8, vy: -14 - h * 10, life: 1.5, max: 1.5, kind: 'steam' });
      if (m === 'pan' && Math.random() < dt * sizzle * 18) this.parts.push({ x: 136 + Math.random() * 50, y: 112, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 0.35, max: 0.35, kind: 'spark' });
      if (this.burnSmoke > 0 && Math.random() < dt * 14 * this.burnSmoke) this.parts.push({ x: 160 + (Math.random() - 0.5) * 30, y: 100, vx: (Math.random() - 0.5) * 8, vy: -16, life: 2.6, max: 2.6, kind: 'smoke' });
      // the coach
      const d = this.done;
      if (h > hi + 0.12) this.tip('hot', this.o.coach === 'joshu' ? ['Too hot, lad! It’ll catch!', 'Ease off! Let the fire settle!'] : ['Too hot, too hot...'], 6, true);
      else if (h < lo - 0.1 && d < 0.85) this.tip('cold', this.o.coach === 'joshu' ? ['Fire’s dying. Feed it!', 'That won’t cook on candle heat. Another log.'] : ['The fire needs a log.'], 8);
      if (m === 'pot' && this.t - this.lastStir > 5 && h > lo) this.tip('stir', this.o.coach === 'joshu' ? ['Give it a stir or it’ll stick!', 'Stir, stir, stir!'] : ['I should stir that.'], 7);
      if (m !== 'pot' && Math.abs(this.sideA - this.sideB) > 0.3) this.tip('turn', this.o.coach === 'joshu' ? ['Turn it! The bottom’s nearly done!', 'Flip it over, lad!'] : ['Better turn it.'], 6);
      if (d > 0.9 && d < 1.06) { this.tip('done', this.o.coach === 'joshu' ? ['That’s it! Take it off now!', 'Perfect. Off the heat, quick!'] : ['That smells done.'], 30, true); this.serveBtn.classList.add('pulse'); }
      else this.serveBtn.classList.remove('pulse');
      if (this.maxSide() > 1.12) this.tip('burn', this.o.coach === 'joshu' ? ['It’s burning! Off! OFF!'] : ['Is that smoke?!'], 8, true);
    }
    this.sound.update(dt, this.fire, sizzle * (this.pot.length ? 1 : 0.2), boil * (this.pot.length ? 1 : 0.3));
    // particles
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark' || p.kind === 'chunk') p.vy += 160 * dt;
      if (p.kind === 'ember') { p.vy += 20 * dt; p.vx *= 0.98; }
      if (p.kind === 'steam' || p.kind === 'smoke') p.vx += Math.sin(this.t * 2 + p.y * 0.1) * 6 * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    if (Math.random() < dt * (3 + this.fire * 10)) this.parts.push({ x: 160 + (Math.random() - 0.5) * 40, y: 132, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * 50 * this.fire, life: 0.9, max: 0.9, kind: 'ember' });
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  }
  private maxSide() { return this.method === 'pot' ? this.done : Math.max(this.sideA, this.sideB); }

  // ------------------------------------------------------------ drawing
  private draw() {
    const p = this.px;
    p.buf.set(this.base);
    const heat = Math.min(1.2, this.fire + this.fan);
    // the warm light of the fire over everything near it
    const glow = 0.25 + heat * 0.6 + Math.sin(this.t * 13) * 0.03;
    for (let y = 70; y < CH; y++) for (let x = 60; x < 260; x++) {
      const d = Math.hypot((x - 160) / 110, (y - 140) / 50);
      if (d > 1) continue;
      const k = (1 - d) * (1 - d) * glow;
      p.add(x, y, 60 * k, 26 * k, 4 * k);
    }
    this.drawFire(p, heat);
    if (this.method) this.drawWare(p, this.method, 160, 0, heat, false);
    this.drawBoard(p);
    this.drawFan(p);
    for (const l of this.logs) {
      const k = Math.min(1, l.t / 0.55);
      const x = l.x + (160 - l.x) * k, y = l.y + (138 - l.y) * k - Math.sin(k * Math.PI) * 40;
      logSprite(p, Math.round(x), Math.round(y), 11, 4);
    }
    // the gauges by the fire: heat (with the dish's band) and how done it is
    if (this.method && this.pot.length) this.drawGauges(p, heat);
    // particles
    for (const q of this.parts) {
      const a = q.life / q.max;
      if (q.kind === 'steam') { const r = 2 + (1 - a) * 5; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && dith(q.x + x, q.y + y) < a * 0.5) p.blend(q.x + x, q.y + y, hx('#e8e4dc'), 0.5 * a); }
      else if (q.kind === 'smoke') { const r = 3 + (1 - a) * 7; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && dith(q.x + x, q.y + y) < a * 0.65) p.blend(q.x + x, q.y + y, hx('#2a2622'), 0.7 * a); }
      else if (q.kind === 'ember') p.set(q.x, q.y, a > 0.5 ? hx('#ffd060') : hx('#e8501c'));
      else if (q.kind === 'spark') { p.set(q.x, q.y, hx('#fff0b0')); }
      else if (q.kind === 'bubble') { p.set(q.x, q.y, hx('#d8e8f0')); }
      else if (q.kind === 'chunk') { p.set(q.x, q.y, q.c ?? hx('#c8b878')); p.set(q.x + 1, q.y, q.c ?? hx('#c8b878')); }
    }
    this.img.data.set(new Uint8ClampedArray(p.buf.buffer));
  }

  private drawFire(p: Px, heat: number) {
    // the stone ring
    const STONE = ['#2a2a2a', '#4a4844', '#6a6660', '#8a867c', '#aaa498'].map(hx);
    const ring = (front: boolean) => {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const sy = Math.sin(a);
        if ((sy > 0) !== front) continue;
        const cx = 160 + Math.cos(a) * 46, cy = 140 + sy * 13;
        const r = 7 + hash(i, 1, 9) * 3;
        p.ellipse(cx, cy, r, r * 0.65, (x, y, nx, ny) => ramp(STONE, 0.65 - ny * 0.45 - nx * 0.15 + (hash(x, y, 2) - 0.5) * 0.15, x, y));
      }
    };
    ring(false);
    // the ash bed and the logs
    p.ellipse(160, 141, 40, 10, (x, y) => ramp(['#1a1410', '#2a2018', '#3a2c20'].map(hx), hash(x >> 1, y, 4) * 0.8, x, y));
    const logs = 2 + Math.round(this.fire * 3);
    for (let i = 0; i < logs; i++) {
      const a = -0.5 + i * 0.4;
      for (let k = -18; k <= 18; k++) {
        const x = 160 + Math.cos(a) * k, y = 140 + Math.sin(a) * k * 0.35;
        for (let w = -2; w <= 2; w++) p.set(x, y + w, w === -2 ? hx('#5a3a1e') : hash(k, i, 3) < this.fire * 0.5 ? hx('#ff7a2a') : hx('#2a1a0e'));
      }
    }
    // the flames
    const H = 10 + heat * 40;
    const FL = ['#5a1408', '#a8280e', '#e85014', '#ff9a2a', '#ffd860', '#fff6d0'].map(hx);
    for (let x = 122; x < 199; x++) {
      const u = (x - 160) / 38;
      const shape = Math.max(0, 1 - u * u);
      const n = Math.sin(x * 0.5 + this.t * 9) * 0.25 + Math.sin(x * 0.23 - this.t * 6.3) * 0.3 + hash(x, Math.floor(this.t * 14), 5) * 0.35;
      const h = H * shape * (0.65 + n * 0.5);
      for (let y = 0; y < h; y++) {
        const k = y / Math.max(1, h);
        const c = ramp(FL, (1 - k) * 0.95 * (0.5 + shape * 0.5) + 0.05, x, 138 - y);
        if (k > 0.75 && dith(x, y) < (k - 0.75) * 4) continue;
        p.set(x, 138 - y, c);
      }
    }
    ring(true);
  }

  /** the cookware and what's in it (cx, the scene centre; preview draws it at (cx, cy) small) */
  drawWare(p: Px, m: Method, cx: number, cy: number, heat: number, preview: boolean) {
    const IRON = ['#141416', '#24242a', '#38383e', '#505058', '#70707a', '#9a9aa4'].map(hx);
    const STICK = ['#2a1a0c', '#4a3018', '#6a4828', '#8a6438'].map(hx);
    const done = preview ? 0 : this.done;
    if (m === 'pot') {
      const py = preview ? cy : 104;
      if (!preview) {
        // the tripod and its chain
        p.line(112, 152, 160, 34, 3, (t, x, y) => ramp(STICK, 0.6 - t * 0.2 + (hash(x, y, 1) - 0.5) * 0.2, x, y));
        p.line(208, 152, 160, 34, 3, (t, x, y) => ramp(STICK, 0.4 + (hash(x, y, 1) - 0.5) * 0.2, x, y));
        p.line(176, 156, 160, 34, 3, (t, x, y) => ramp(STICK, 0.75 + (hash(x, y, 1) - 0.5) * 0.2, x, y));
        for (let y = 36; y < py - 10; y++) p.set(160, y, (y & 2) ? hx('#8a8a90') : hx('#4a4a50'));
        p.line(140, py - 6, 160, py - 12, 1, () => hx('#6a6a70')); p.line(180, py - 6, 160, py - 12, 1, () => hx('#6a6a70'));
      }
      const rx = preview ? 18 : 28, ry = preview ? 6 : 9, depth = preview ? 12 : 20;
      // the body
      for (let y = 0; y <= depth; y++) {
        const w = rx - (y / depth) * (y / depth) * 5;
        for (let x = -w; x <= w; x++) {
          const u = x / w;
          p.set(cx + x, py + y, ramp(IRON, 0.62 - u * 0.4 - y / depth * 0.15 + (Math.abs(u) > 0.92 ? -0.2 : 0), cx + x, py + y));
        }
      }
      p.ellipse(cx, py + depth, rx - 5, ry * 0.6, (x, y) => ramp(IRON, 0.2, x, y));
      // the rim and the broth
      p.ellipse(cx, py, rx, ry, (x, y, nx, ny) => { const r = nx * nx + ny * ny; return r > 0.72 ? ramp(IRON, 0.75 - ny * 0.4, x, y) : -1; });
      const broth = this.brothColor();
      p.ellipse(cx, py + 1, rx - 3, ry - 2.5, (x, y, nx, ny) => {
        const sw = Math.sin(nx * 6 + this.t * 2 + this.stirAng * 3) * 0.08 + Math.sin(ny * 5 - this.t * 1.7) * 0.06;
        return preview ? hx('#2a3a44') : ramp([mix(broth, hx('#000000'), 0.35), broth, mix(broth, hx('#ffffff'), 0.25)], 0.5 - ny * 0.3 + sw + (hash(x, y, Math.floor(this.t * 6)) < this.heatPot * 0.05 ? 0.5 : 0), x, y);
      });
      if (!preview) for (const q of this.pot) {
        const a = q.a + this.stirAng;
        const x = cx + Math.cos(a) * 13, y = py + 1 + Math.sin(a) * 3.5;
        const ing = CK.INGREDIENTS[q.id];
        const col = this.cookCol(q.id, done);
        const n = q.chopped ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const ox = x + (k - (n - 1) / 2) * 5, oy = y + (k % 2);
          const r = q.chopped ? 2 : 3;
          p.ellipse(ox, oy, r, r * 0.6, (xx, yy, nx, ny) => ny < -0.2 ? mix(col, hx('#ffffff'), 0.2) : col);
        }
        void ing;
      }
      return;
    }
    if (m === 'pan') {
      const py = preview ? cy : 116;
      // the pan on the stones, its handle off to the right
      p.ellipse(cx, py + 2, preview ? 24 : 36, preview ? 7 : 11, (x, y, nx, ny) => ramp(IRON, 0.25 - ny * 0.2, x, y));
      p.ellipse(cx, py, preview ? 22 : 33, preview ? 6 : 9, (x, y, nx, ny) => { const r = nx * nx + ny * ny; return r > 0.8 ? ramp(IRON, 0.7 - ny * 0.3, x, y) : ramp(IRON, 0.3 + (hash(x, y, 7) - 0.5) * 0.1 + (preview ? 0 : this.heatPot * 0.12), x, y); });
      const hx0 = cx + (preview ? 22 : 33);
      for (let x = 0; x < (preview ? 16 : 30); x++) for (let w = 0; w < 3; w++) p.set(hx0 + x, py - 1 - x * 0.12 + w, w === 0 ? IRON[4] : IRON[1]);
      if (!preview) for (const q of this.pot) {
        const sp = spriteOf(q.id);
        const dn = this.side === 0 ? this.sideB : this.sideA;
        const k = Math.min(1, dn);
        const col = this.cookCol(q.id, dn);
        const flip = this.turnT > 0 ? Math.abs(Math.cos((this.turnT / 0.3) * Math.PI)) : 1;
        p.sprite(sp, q.x, q.y - 4 - (this.turnT > 0 ? Math.sin((this.turnT / 0.3) * Math.PI) * 8 : 0), 0.62, 0.4 * flip, 0.35 * k, col, Math.max(0, dn - 1.05) * 3, this.side === 1);
      }
      return;
    }
    // the skewer across two forked sticks
    const sy = preview ? cy : 100;
    if (!preview) {
      for (const fx of [108, 212]) {
        p.line(fx, 154, fx, sy + 2, 3, (t, x, y) => ramp(STICK, 0.65 + (hash(x, y, 2) - 0.5) * 0.2, x, y));
        p.line(fx, sy + 4, fx - 4, sy - 4, 2, () => STICK[2]); p.line(fx, sy + 4, fx + 4, sy - 4, 2, () => STICK[3]);
      }
    }
    const x0 = preview ? cx - 28 : 100, x1 = preview ? cx + 28 : 232;
    for (let x = x0; x < x1; x++) { p.set(x, sy, hx('#9a7a4a')); p.set(x, sy + 1, hx('#5a4228')); }
    if (!preview) for (const q of this.pot) {
      const sp = spriteOf(q.id);
      const dn = this.side === 0 ? this.sideB : this.sideA;
      const col = this.cookCol(q.id, dn);
      const sq = this.turnT > 0 ? Math.abs(Math.cos((this.turnT / 0.3) * Math.PI)) : 1;
      p.sprite(sp, q.x, sy, 0.55, 0.55 * Math.max(0.2, sq), 0.35 * Math.min(1, dn), col, Math.max(0, dn - 1.05) * 3, this.side === 1);
    }
    void heat;
  }

  /** an ingredient's colour at a doneness */
  private cookCol(id: string, d: number) {
    const ing = CK.INGREDIENTS[id];
    const raw = hx(ing?.raw ?? '#c8b878'), cooked = hx(ing?.cooked ?? '#c89048');
    if (d < 1) return mix(raw, cooked, Math.max(0, Math.min(1, d)));
    return mix(cooked, hx('#2a1a10'), Math.min(1, (d - 1) * 3));
  }
  private brothColor() {
    if (!this.pot.length) return hx('#4a6a7a');
    let r = 0, g = 0, b = 0;
    for (const q of this.pot) { const c = this.cookCol(q.id, this.done * 0.9); r += R(c); g += G(c); b += B(c); }
    const n = this.pot.length;
    const avg = rgb(r / n, g / n, b / n);
    return mix(hx('#5a7a8a'), avg, Math.min(0.85, 0.3 + this.done * 0.6));
  }

  private boardCanvas(): HTMLCanvasElement {
    const b = this.board!;
    const sp = spriteOf(b.id);
    const c = spriteCanvas(sp);
    return c;
  }
  private drawBoard(p: Px) {
    const b = this.board;
    if (!b) return;
    const sp = spriteOf(b.id);
    const k = b.chops;
    // the food, cut into strips with gaps as it's chopped
    const scale = Math.min(2, 40 / Math.max(sp.w, sp.h));
    const w = Math.round(sp.w * scale), h = Math.round(sp.h * scale);
    const x0 = 54 - w / 2, y0 = 154 - h / 2;
    const strips = k + 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = sp.d[Math.min(sp.h - 1, Math.floor(y / scale)) * sp.w + Math.min(sp.w - 1, Math.floor(x / scale))];
      if (A(c) < 100) continue;
      const strip = Math.floor((x / w) * strips);
      p.set(x0 + x + strip * 3 - k * 1.5, y0 + y, c);
    }
    // the knife coming down
    if (this.knifeT > 0) {
      const kx = x0 + (k / (b.need + 1)) * w + 6, ky = y0 - 6 + (1 - this.knifeT / 0.18) * 10;
      for (let i = 0; i < 16; i++) { p.set(kx + i * 0.3, ky + i, hx('#d8dce0')); p.set(kx + 1 + i * 0.3, ky + i, hx('#a8acb4')); }
      for (let i = 0; i < 7; i++) { p.set(kx - 2 - i * 0.2, ky - 1 - i, hx('#6a3e1c')); p.set(kx - 1 - i * 0.2, ky - 1 - i, hx('#8a5428')); }
    }
  }
  private drawFan(p: Px) {
    // a flax fan leaning on the woodpile; it waves while fanning
    const a = this.fanning ? Math.sin(this.t * 22) * 0.5 : 0.2;
    const bx = 226, by = 172;
    for (let i = 0; i < 18; i++) {
      const x = bx + Math.sin(a) * i, y = by - Math.cos(a) * i;
      p.set(x, y, hx('#6a3e1c'));
    }
    const tx = bx + Math.sin(a) * 18, ty = by - Math.cos(a) * 18;
    p.ellipse(tx, ty - 7, 8, 9, (x, y, nx, ny) => (Math.round((nx + 1) * 5) % 2 ? hx('#8db34a') : hx('#5a8a2a')));
  }
  private drawGauges(p: Px, heat: number) {
    const ids = this.pot.map(q => q.id);
    const pl = CK.plan(this.method!, ids);
    // heat: a vertical stick of the fire's strength with the band the dish likes
    const gx = 244, gy0 = 64, gh = 50;
    p.rect(gx - 1, gy0 - 1, 6, gh + 2, hx('#120e07'));
    for (let y = 0; y < gh; y++) {
      const v = 1 - y / gh;
      const inBand = v >= pl.heat[0] && v <= pl.heat[1];
      p.rect(gx, gy0 + y, 4, 1, inBand ? hx('#5a8a2a') : v > pl.heat[1] ? hx('#7a2a1a') : hx('#2a2a3a'));
    }
    const hy = gy0 + Math.round((1 - Math.min(1, this.heatPot)) * gh);
    p.rect(gx - 3, hy, 10, 2, hx('#ffd04a')); p.set(gx - 3, hy + 2, hx('#8a5a10'));
    // doneness: a notched stick, raw -> good -> perfect -> burnt
    const dx0 = 128, dy = 56, dw = 64;
    p.rect(dx0 - 1, dy - 1, dw + 2, 6, hx('#120e07'));
    for (let x = 0; x < dw; x++) {
      const v = x / dw * 1.3;
      const c = v < 0.72 ? hx('#5a6a7a') : v < 0.88 ? hx('#a8944a') : v <= 1.08 ? hx('#7ac84a') : v <= 1.18 ? hx('#c8842a') : hx('#5a1a10');
      p.rect(dx0 + x, dy, 1, 4, c);
    }
    const mx = dx0 + Math.round(Math.min(1.3, this.maxSide()) / 1.3 * dw);
    p.rect(mx - 1, dy - 3, 3, 10, hx('#fff6dc')); p.rect(mx, dy - 2, 1, 8, hx('#3a2614'));
    void heat;
  }

  // ------------------------------------------------------------ the end
  private serve() {
    if (this.finished || !this.pot.length || !this.method) return;
    this.finished = true;
    this.serveBtn.hidden = true;
    this.hands?.act('serve', 160, 104);
    const ids = this.pot.map(q => q.id);
    const care = Math.max(0, Math.min(1, this.care + (this.pot.every(q => q.chopped || !CK.INGREDIENTS[q.id]?.chop) ? 0.05 : 0)));
    const res = CK.finishCook(this.method, ids, this.method === 'pot' ? this.done : Math.max(this.sideA, this.sideB) > 1.18 ? Math.max(this.sideA, this.sideB) : (this.sideA + this.sideB) / 2, care);
    sfx(res.quality === 'burnt' ? 'wrong' : 'catchJingle', { vol: 0.5 });
    const box = this.stage.appendChild(el('div', 'res'));
    const word = { perfect: 'PERFECT!', good: 'GOOD', raw: 'UNDERCOOKED', burnt: 'BURNT' }[res.quality];
    box.appendChild(el('div', 'word' + (res.quality === 'burnt' || res.quality === 'raw' ? ' bad' : ''), word));
    const tag = box.appendChild(el('div', 'tag'));
    tag.appendChild(bufURLCanvas(paintTag(112, 120)));
    const sp = spriteOf(res.dish);
    const pc = spriteCanvas(sp);
    const k = Math.max(1, Math.floor(Math.min(80 / sp.w, 44 / sp.h)));
    pc.style.width = sp.w * k + 'px'; pc.style.height = sp.h * k + 'px';
    pc.style.left = Math.round(56 - (sp.w * k) / 2) + 'px'; pc.style.top = Math.round(38 - (sp.h * k) / 2) + 'px';
    tag.appendChild(pc);
    const nm = handLetter(ITEMS[res.dish]?.name ?? res.dish, { px: 12, maxW: 100 });
    nm.style.left = Math.round(56 - nm.width / 2) + 'px'; nm.style.top = '62px';
    tag.appendChild(nm);
    tag.appendChild(el('div', 'n', `${res.portions} portion${res.portions > 1 ? 's' : ''}`));
    if (res.learned) { tag.appendChild(el('div', 'new', 'NEW RECIPE')); sfx('discover', { vol: 0.5 }); }
    const go = box.appendChild(el('button', 'btn11 green go'));
    go.appendChild(icon('v11eat'));
    go.appendChild(el('span', '', 'TUCK IN'));
    const end = () => { if (this.closed) return; this.closeUp({ result: res, ids }); };
    go.addEventListener('click', e => { e.stopPropagation(); end(); });
    const offk = pushKeys(e => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { end(); return true; } return true; });
    this.offs.push(offk);
    // the coach's verdict
    const c = this.o.coach;
    const line = res.quality === 'perfect' ? (c === 'joshu' ? 'Now THAT is cooking. I’ll make a sailor of you yet.' : 'Oh, that’s good. That’s really good.')
      : res.quality === 'good' ? (c === 'joshu' ? 'Not bad, lad. Not bad at all.' : 'Edible! Better than edible!')
        : res.quality === 'raw' ? (c === 'joshu' ? 'Bit underdone. We’ll live. Probably.' : 'Crunchy. Is it meant to be crunchy?')
          : (c === 'joshu' ? '...Chunk’ll eat it.' : 'Well. Charcoal is technically a food group.');
    setTimeout(() => this.say(c ?? 'mori', line), 600);
  }

  closed = false;
  private leave() {
    if (this.finished) return;
    this.finished = true;
    // whatever went in comes back out (it wasn't cooked)
    for (const u of this.used) { const [from, id] = u.split(':'); if (from === 'pack') give(id, 1); else stashAdd(id, 1); }
    this.closeUp({ result: null, ids: [] });
  }
  private closeUp(out: CookOutcome) {
    if (this.closed) return;
    this.closed = true;
    this.root.classList.add('out');
    this.sound.stop();
    this.hands?.dispose();
    setTimeout(() => {
      cancelAnimationFrame(this.raf);
      for (const f of this.offs) f();
      this.root.remove();
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      guardInput(300);
      game.persist();
      this.resolve(out);
    }, reduced() ? 10 : 400);
  }

  // ------------------------------------------------------------ the notebook
  async openBook() {
    sfx('pageTurn', { vol: 0.5 });
    await openRecipeBook(this.stage);
  }
}

/** the recipe notebook: what Mori knows (how, from what, how well he's done it) and hints at the rest */
export function openRecipeBook(host?: HTMLElement): Promise<void> {
  css('ck11', CSS);
  return new Promise(res => {
    let own: HTMLElement | null = null;
    if (!host) {
      // standalone (from the Backpack): a small scaled stage of its own
      own = el('div', 'ck11');
      own.style.background = 'transparent';
      const st = own.appendChild(el('div', 'stage'));
      const s = Math.max(1, Math.min(window.innerWidth / CW, window.innerHeight / CH));
      st.style.transform = `scale(${s})`;
      st.style.left = Math.round((window.innerWidth - CW * s) / 2) + 'px';
      st.style.top = Math.round((window.innerHeight - CH * s) / 2) + 'px';
      game.ui.modalLayer.appendChild(own);
      host = st;
    }
    const bk = host.appendChild(el('div', 'book'));
    const page = bk.appendChild(el('div', 'page'));
    for (const r of CK.RECIPES) {
      const known = CK.knowsRecipe(r.id);
      const rc = page.appendChild(el('div', 'rc' + (known ? '' : ' unk')));
      if (known) {
        const h = handLetter(r.name, { px: 9, maxW: 100, color: '#2a2414' });
        rc.appendChild(h);
        const ings = rc.appendChild(el('div', 'ings'));
        ings.appendChild(icon(r.method === 'pot' ? 'v11pot' : r.method === 'pan' ? 'v11fire' : 'v11knife'));
        for (const n of r.needs) {
          const sp = el('span', '');
          const id = n.id ?? Object.keys(CK.INGREDIENTS).find(k => CK.INGREDIENTS[k].tags.includes(n.tag!)) ?? '';
          if (id) { const s = spriteOf(id); const c = spriteCanvas(s); c.style.width = '10px'; c.style.height = '10px'; sp.appendChild(c); }
          sp.appendChild(document.createTextNode(`${n.n}${n.tag ? ' ' + n.tag : ''}`));
          ings.appendChild(sp);
        }
        const best = CK.bestQuality(r.id);
        if (best) rc.appendChild(el('div', 'st', best === 'perfect' ? 'cooked perfectly' : `cooked ×${CK.timesCooked(r.id)}`));
      } else {
        rc.appendChild(el('div', '', '? ? ?'));
        rc.appendChild(el('div', '', esc(r.hint)));
      }
    }
    const x = page.appendChild(el('button', 'btn11 x'));
    x.appendChild(icon('v11x'));
    const close = () => { bk.remove(); own?.remove(); offk(); res(); };
    x.addEventListener('click', e => { e.stopPropagation(); close(); });
    bk.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === bk) close(); });
    const offk = pushKeys(e => { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyB') { close(); return true; } return !own ? undefined : true; }, !!own);
  });
}

// ---------------------------------------------------------------- at camp, in the field

interface CampLike { s: { bark(who: string, text: string, o?: { expr?: string }): void; clock: { t: number } }; d: { larder: number } }

/** what happens to a finished dish: Mori eats a portion now, the rest is packed (tins and parcels) */
export function serveDish(res: CookResult, o: { eatNow: boolean; shared?: number }): { ate: number; packed: number; dropped: number } {
  let left = res.portions;
  let ate = 0;
  if (o.eatNow) {
    left -= 1 + (o.shared ?? 0);
    ate = CK.servingEnergy(res.dish, res.quality);
    restore(ate);
    const d = ITEMS[res.dish];
    if (d?.eat === 'steady' || d?.eat === 'quiet' || d?.eat === 'energy') game.save.buff = d.eat;
    if (res.quality !== 'raw' && res.quality !== 'burnt' && /chowder|porridge/.test(res.dish)) dayState().buff = { id: 'hearty', day: dayNumber() };
    if (res.quality === 'perfect') dayState().buff = { id: 'hearty', day: dayNumber() };
  }
  let packed = 0, dropped = 0;
  if (left > 0) { packed = give(res.dish, left); dropped = left - packed; }
  game.persist();
  return { ate, packed, dropped };
}

/** cooking at the camp fire (snack / breakfast / dinner): the close-up, then the dish */
export async function cookAtCamp(cd: CampLike, meal: 'breakfast' | 'dinner' | 'snack'): Promise<CookResult | null> {
  const t = cd.s.clock.t;
  const setting: Setting = t < 1 ? 'morning' : t > 2.6 ? 'dusk' : 'day';
  const out = await runCooking({ where: 'camp', setting, coach: 'joshu', title: meal === 'snack' ? 'What are we cooking with?' : meal === 'breakfast' ? 'Breakfast for four' : 'Dinner for four' });
  const r = out.result;
  if (!r) return null;
  // the first time he cooks for himself, Joshu hands over his old billy can for the field
  const firstTime = !CK.hasBilly();
  if (firstTime && !game.save.tools.includes('billy')) { give('billy', 1); }
  if (meal === 'snack') {
    const s = serveDish(r, { eatNow: true });
    game.ui.toast(`${ITEMS[r.dish]?.name ?? r.dish}: <b>+${s.ate} energy</b>${s.packed ? ` · ${s.packed} packed for later` : ''}${s.dropped ? ` · ${s.dropped} on the ground (no room)` : ''}`, 'COOKING', 'teal', 4200);
    if (firstTime) cd.s.bark('joshu', 'Here. My old billy can. Cook for yourself out there, lad.', { expr: 'happy' });
  }
  return r;
}

/** cooking out in the field with the billy can over a little fire (from the Backpack) */
export async function cookInField(): Promise<CookResult | null> {
  const out = await runCooking({ where: 'field', setting: 'field', coach: null, title: 'A little fire and the billy can' });
  const r = out.result;
  if (!r) return null;
  const s = serveDish(r, { eatNow: true });
  game.ui.toast(`${ITEMS[r.dish]?.name ?? r.dish}: <b>+${s.ate} energy</b>${s.packed ? ` · ${s.packed} packed` : ''}`, 'COOKING', 'teal', 4200);
  return r;
}

// the billy can cooks out in the field (its Use on the Backpack's tag)
registerItemUse('billy', 'cook', async () => {
  const camp = (game.scene as unknown as { story?: unknown; site?: { id?: string } } | null);
  void camp;
  await cookInField();
}, 'v11pot');

// debug handle (window.zl.cook)
function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (!w.zl) { setTimeout(hookZl, 500); return; }
  w.zl.cook = {
    open: (method?: Method, where: 'camp' | 'field' = 'camp') => runCooking({ where, method, coach: where === 'camp' ? 'joshu' : null }),
    book: () => openRecipeBook(),
    teach: (id: string) => CK.teachRecipe(id, 'debug'),
    screen: () => current,
  };
}
hookZl();
