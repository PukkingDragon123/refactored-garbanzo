// V11 body HUD, in the spirit of Dave the Diver's gauges: a status plate in the top-left corner.
//   - Mori's medallion (medallion.ts): his bust rendered from the 3D rig at high resolution, in an
//     engraved brass bezel on stitched leather, over a sky disc that follows the time of day, his name
//     on a stitched ribbon. He breathes, blinks, his hair stirs in the wind (and streams back when he
//     runs), his mouth moves when he talks, and his face follows what happens: pleased when something
//     good happens, tired (and yawning) at night or when he's spent, a grimace and rumble lines when
//     his stomach growls (game/v12/hunger.ts onGrowl), a flinch and a red flash when he's knocked down,
//     wide eyes and a tremble while a predator is on him (game/v11/predators-core.ts onPredator), and
//     whatever his in-game face is doing otherwise. Click it (or tap it) to inspect him.
//   - the lunch tin (on expeditions): how full he is (V12 hunger; energy() reads as fullness). Five rice
//     bowls painted down a chipped enamel tin fill from the bottom; they jiggle when he moves, steam
//     curls off the lid when he's just eaten, the tin blinks red when he's empty, and a big gulp of
//     hunger rattles it. A wooden tag hung from the handle says FULL, FINE, PECKISH, HUNGRY or STARVING.
//   - the pack: a spring scale that stretches with the load (kg / capacity), red and shaking when
//     it's too heavy to run.
//   - ailment chips (a tummy ache, dizziness) with their time running out.
//   - the edge of the screen darkens in dithered pixels as he tires; illness tints it.
// Hud2 mounts it and ticks it. Click the tin (or press H) for a snack.

import { el } from '../ui';
import { game } from '../../game/game';
import { energy, maxEnergy, packWeight, packCapacity, onExpedition, lowness, hasAilment, dizziness, onSpend, EAT_KEY, ailments } from '../../game/v10/energy';
import { onGrowl, hunger, TOO_HUNGRY } from '../../game/v12/hunger';
import { onPredator } from '../../game/v11/predators-core';
import { CHAR_INFO } from '../../art/v7/index';
import { Art, col, dith, shadeC, mixC, pxCanvas } from '../v11/paper/px';

import { PxW, outlined, tw, plate, gaugeColor, hudText, hudTextW, rivet, BRASS6, brassAt, leatherAt, hnoise } from '../v11/hudpx';
import { hudHour } from '../v11/hudclock';
import { paintMedallion, MED } from './medallion';

const CSS = `
.h2 .v10dim { position: absolute; inset: 0; pointer-events: none; }
.h2 .v10dim .pp-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.6s steps(6); }
.h2 .v10dim .pp-cv.on { opacity: 1; }
.h2 .v10dim .low.pulse { animation: bhPulse 2.4s steps(6) infinite; }
@keyframes bhPulse { 50% { opacity: 0.55; } }
.h2 .bh { position: absolute; left: 8px; top: 6px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; pointer-events: none; }
.h2 .bh canvas.hx { display: block; image-rendering: pixelated; pointer-events: auto; }
.h2 .bh .plate { cursor: pointer; }
.h2 .bh.shake .plate { animation: bhShake 0.36s steps(6); }
@keyframes bhShake { 20% { transform: translate(-6px, 0); } 40% { transform: translate(6px, -3px); } 60% { transform: translate(-3px, 3px); } 80% { transform: translate(3px, 0); } }
.h2 .bh.tremble .plate { animation: bhTremble 0.2s steps(2) infinite; }
@keyframes bhTremble { 50% { transform: translate(2px, 0); } }
.h2 .bh .wt.off, .h2 .bh .ail.off { display: none; }
.h2 .bh .wt.heavy { animation: bhShake 0.5s steps(5) infinite; }
.h2 .bh.pop .plate { animation: bhPop 0.3s steps(5); }
@keyframes bhPop { 40% { transform: translateY(-6px); } }
body.touchmode .h2 .bh { top: 4px; left: 4px; }
`;

let styled = false;
// V12: no HUD and no stamina, so the plate is hidden unless something asks for it again
let mode: 'auto' | 'always' | 'never' = 'never';
/** show the body HUD always / never / on expeditions only (default) */
export function setBodyHud(m: 'auto' | 'always' | 'never') { mode = m; }
const shown = () => (mode === 'always' ? true : mode === 'never' ? false : onExpedition());

export interface BodyHud {
  /** (kept for the V2 API: the pack readout is the spring scale now) */
  ownsPack(): boolean;
  update(dt: number): void;
  destroy(): void;
  /** a happy flash on Mori's face (something good happened) */
  cheer?(): void;
}

// ---------------------------------------------------------------- painting

const OUT = col('#140c06'), CREAM = col('#fff1cc');
const BRASS = BRASS6[3], BRASS_L = BRASS6[4], BRASS_D = BRASS6[1];
const WOOD = col('#4a2e16');

interface Bubble { x: number; y: number; v: number }
interface FlaskSt { level: number; tilt: number; tiltV: number; amp: number; t: number; bubbles: Bubble[]; crack: number; flash: number; shown: number }

/** the lunch tin: 32 x 70 art px. A chipped enamel tin with a wire handle, a lid with a brass latch,
 *  and five rice bowls painted down its front that fill from the bottom with how full he is (the top
 *  one half full in between). The bowls jiggle when he moves, steam curls off the lid when he's just
 *  eaten, the tin's edge blinks red when he's empty, and a big gulp of hunger rattles it with a flash. */
const FW = 32, FH = 70;
const BOWL_FULL = ['...wWWWw....', '.wwwWwwwwww.', 'kkkkkkkkkkkk', 'kBbbbbbbbbBk', '.kbbRbbRbbk.', '..kbbbbbbk..', '...kkkkkk...'];
const BOWL_HALF = ['............', '..wwwwwwww..', 'kkkkkkkkkkkk', 'kBbbbbbbbbBk', '.kbbRbbRbbk.', '..kbbbbbbk..', '...kkkkkk...'];
const BOWL_EMPTY = ['............', '............', 'kkkkkkkkkkkk', 'kdddddddddbk', '.kddddddddk.', '..kddddddk..', '...kkkkkk...'];
function paintTin(a: Art, x0: number, y0: number, st: FlaskSt, frac: number, low: boolean, blinkOn: boolean) {
  const enamel = col('#3a7a8a'), tin = col('#b8c0c4');
  const outC = low && blinkOn ? col('#e83a2a') : OUT;
  // the hard shadow
  for (let y = y0 + 10; y < y0 + FH + 2; y++) for (let x = x0 + 3; x < x0 + FW + 2; x++) if (dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.4));
  // the wire handle, swung up over the lid
  const HANDLE = ['......kkkkkkkkkkkkkkkkkkkk......', '.....kwwwwwwwwwwwwwwwwwwwwsk.....', '....kwk..................kwk....', '....kwk..................kwk....', '....kwk..................kwk....', '...kkskk................kkskk...'];
  HANDLE.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = r[i]; if (c !== '.') a.put(x0 + i, y0 + j, c === 'k' ? OUT : c === 'w' ? col('#e0e4e6') : col('#7a8086')); } });
  // the lid: domed, lighter enamel, a rolled tin rim under it
  for (let y = 5; y < 15; y++) for (let x = 1; x < FW - 1; x++) {
    const inset = y === 5 ? 3 : y === 6 ? 1 : 0;
    if (x < 1 + inset || x >= FW - 1 - inset) continue;
    const edge = x === 1 + inset || x === FW - 2 - inset || y === 5;
    let c = y < 8 ? shadeC(enamel, 0.3) : shadeC(enamel, 0.12);
    if (x > FW - 6) c = shadeC(c, -0.2);
    if (y >= 13) c = y === 13 ? col('#dfe4e6') : col('#8a9296');
    a.put(x0 + x, y0 + y, edge ? outC : c);
  }
  // the body: enamel with rolled rims, side shading, chips showing tin, scratches
  const bx = x0, by = y0 + 15, bw = FW, bh = FH - 15;
  const inside = (x: number, y: number) => {
    if (x < bx || y < by || x >= bx + bw || y >= by + bh) return false;
    const ux = x < bx + 4 ? bx + 4 - x : x >= bx + bw - 4 ? x - (bx + bw - 5) : 0;
    const uy = y >= by + bh - 4 ? y - (by + bh - 5) : 0;
    return ux * ux + uy * uy <= 17;
  };
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1);
    if (edge) { a.put(x, y, outC); continue; }
    let c = enamel;
    if (x < bx + 4) c = shadeC(enamel, 0.22);
    else if (x > bx + bw - 6) c = shadeC(enamel, -0.3);
    else if (x > bx + bw - 9 && dith(x, y, 0.5)) c = shadeC(enamel, -0.15);
    if (y === by + 1 || y === by + bh - 4) c = tin;
    if (y === by + 2 || y === by + bh - 3) c = shadeC(tin, -0.35);
    if (hnoise(x, y, 51) > 0.975) c = col('#dfe4e6');
    else if (hnoise(x >> 1, y, 53) > 0.96) c = shadeC(c, -0.2);
    a.put(x, y, c);
  }
  // the brass latch over the lid's rim
  for (let y = 11; y < 19; y++) for (let x = 13; x < 19; x++) {
    const edge = x === 13 || x === 18 || y === 11 || y === 18;
    a.put(x0 + x, y0 + y, edge ? OUT : y === 12 ? BRASS_L : x === 17 ? BRASS_D : BRASS);
  }
  a.put(x0 + 15, y0 + 15, OUT); a.put(x0 + 16, y0 + 15, BRASS_D);
  // the bowls, bottom up: full, half full, empty
  const n = Math.max(0, Math.min(5, frac * 5));
  const full = Math.floor(n + 0.001), half = n - full >= 0.4;
  const jig = Math.abs(st.tilt) > 0.12 ? Math.round(Math.sin(st.t * 18)) : 0;
  const P: Record<string, number> = { k: col('#1a1a2a'), w: col('#f4f0e4'), W: col('#ffffff'), B: col('#5a8ae0'), b: col('#2a52b0'), R: col('#e8432a'), d: col('#141c38') };
  for (let i = 0; i < 5; i++) {
    const rows = i < full ? BOWL_FULL : i === full && half ? BOWL_HALF : BOWL_EMPTY;
    const ox = x0 + 9 + (i % 2 ? jig : -jig), oy = y0 + FH - 14 - i * 9;
    rows.forEach((r, j) => { for (let k = 0; k < 12; k++) if (r[k] !== '.') a.put(ox + k - 1, oy + j, P[r[k]]); });
  }
  // steam off the lid
  for (const b of st.bubbles) {
    const X = x0 + Math.round(b.x), Y = y0 + Math.round(b.y);
    if (Y < y0 + 5 && Y >= y0 - 8) a.px(X, Y, col('#ffffff', 0.55));
  }
  // a rattle: a dent and a flash
  if (st.crack > 0) { const c = col('#ffffff', Math.min(1, st.crack * 2)); for (let i = 0; i < 5; i++) a.px(x0 + 5 + i, y0 + 24 + (i % 2), c); }
  if (st.flash > 0) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (inside(x, y) && dith(x, y, st.flash * 0.6)) a.px(x, y, col('#ffffff', 0.8));
}

/** how he feels on a wooden tag hung from the tin's handle: FULL, FINE, PECKISH, HUNGRY, STARVING */
const tagWord = (frac: number) => { const h = 1 - frac; return h >= 0.8 ? 'STARVING' : h >= 0.65 ? 'HUNGRY' : h >= 0.45 ? 'PECKISH' : h >= 0.2 ? 'FINE' : 'FULL'; };
function tagW(word: string, label: string): number {
  return Math.max(40, hudTextW(word, 'caps', 1) + 14, tw(label, { face: 'block', bold: false, spacing: 1 }) + 10);
}
function paintTag(a: Art, x: number, y: number, w: number, word: string, low: boolean, blinkOn: boolean, label: string, fx: number) {
  // the string from the handle to the tag's eyelet
  const run = Math.max(1, x + 6 - fx);
  for (let i = 0; fx + i < x + 6; i++) a.put(fx + i, y - 14 + Math.round(Math.sin((i / run) * Math.PI) * 2) + Math.round((i / run) * 17), col('#d8c8a0'));
  const base = low && blinkOn ? col('#8a1e14') : WOOD;
  plate(a, x, y, w, 30, base, { r: 3 });
  for (let j = 3; j < 27; j++) for (let i = 3; i < w - 3; i++) if (hnoise(i >> 3, j, 21) > 0.82 && hnoise(x + i, y + j, 5) > 0.3) a.put(x + i, y + j, shadeC(base, -0.12));
  a.put(x + 5, y + 4, OUT); a.put(x + 6, y + 4, BRASS_L); a.put(x + 7, y + 4, OUT); a.put(x + 6, y + 3, BRASS); a.put(x + 6, y + 5, BRASS_D);
  const ww = hudTextW(word, 'caps', 1);
  hudText(a, word, Math.round(x + w / 2 - ww / 2), y + 7, { face: 'caps', c: low ? [col('#ffd0c0'), col('#ffb0a0'), col('#e88070')] : [col('#fffaea'), CREAM, col('#e8c890')], drop: 1 });
  const lw = tw(label, { face: 'block', bold: false, spacing: 1 });
  outlined(a, label, Math.round(x + w / 2 - lw / 2), y + 26, low && blinkOn ? col('#ff8a6a') : col('#f4d27a'), OUT, { face: 'block', bold: false, spacing: 1 });
}

/** the pack's spring scale and its load bar: 168 x 27 */
const SW = 168, SH = 27;
function paintScale(a: Art, kg: number, cap: number, t: number) {
  const over = kg > cap, k = kg / Math.max(1, cap);
  // a leather strip the scale hangs on
  plate(a, 0, 3, SW - 3, SH - 5, col('#3a2210'), { r: 3 });
  for (let j = 5; j < SH - 4; j++) for (let i = 2; i < SW - 5; i++) a.put(i, j, leatherAt(i, j, col('#4a2c16')));
  for (let i = 4; i < SW - 7; i++) if (i % 3) { a.put(i, 5, col('#c89a62')); a.put(i, SH - 5, col('#a07a4a')); }
  // the spring scale: a hook, the brass barrel with its window and red pointer, the coil, the weight
  const sx = 6;
  a.put(sx + 4, 0, OUT); a.put(sx + 5, 0, OUT); a.put(sx + 3, 1, OUT); a.put(sx + 6, 1, OUT); a.put(sx + 4, 1, BRASS_L); a.put(sx + 5, 2, BRASS);
  plate(a, sx, 2, 11, 10, BRASS, { r: 1, shadow: false });
  a.rect(sx + 3, 4, 5, 6, col('#f4ead0'));
  for (let i = 0; i < 3; i++) a.put(sx + 3, 5 + i * 2, col('#8a7a5a'));
  const pin = 4 + Math.min(5, Math.round(k * 4));
  a.rect(sx + 3, pin, 5, 1, col('#d8322a'));
  const stretch = Math.min(7, Math.round(k * 6));
  for (let i = 0; i <= stretch; i++) { a.put(sx + ((i & 1) ? 3 : 7), 12 + i, col('#c8ccd0')); a.put(sx + 5, 12 + i, col('#7a8086')); }
  const wy = 13 + stretch;
  plate(a, sx + 1, Math.min(SH - 7, wy), 9, 6, over ? col('#c8321e') : col('#6a5a44'), { r: 1, shadow: false });
  // the readout and the load bar with its capacity notch and ticks
  const txt = `${kg.toFixed(1)} / ${Math.round(cap)} KG`;
  outlined(a, txt, 24, 13, over ? col('#ff9a80') : CREAM, OUT, { face: 'block', bold: false, spacing: 1 });
  const bx = 24, by = 16, bw = SW - bx - 10;
  plate(a, bx, by, bw, 6, col('#1a0e06'), { r: 0, shadow: false });
  const fillW = Math.round(Math.min(1.25, k) / 1.25 * (bw - 2));
  const [gc] = gaugeColor(Math.max(0, 1 - k * 0.8));
  for (let x = 0; x < fillW; x++) for (let y = 0; y < 4; y++) a.put(bx + 1 + x, by + 1 + y, y === 0 ? shadeC(gc, 0.35) : y === 3 ? shadeC(gc, -0.25) : (x % 6 === 5 ? shadeC(gc, -0.1) : gc));
  const capX = bx + 1 + Math.round((1 / 1.25) * (bw - 2));
  for (let i = 1; i < 5; i++) a.put(bx + 1 + Math.round((i / 5) * (capX - bx - 1)), by + 6, col('#c8a464'));
  a.rect(capX, by - 2, 1, 10, over && Math.floor(t * 4) % 2 ? col('#ff4a3a') : CREAM);
  a.put(capX - 1, by - 2, CREAM); a.put(capX + 1, by - 2, CREAM);
}

/** an ailment chip: 105 x 20 */
const CW = 105, CH = 20;
function paintChip(a: Art, kind: 'stomach' | 'dizzy', left: number, t: number) {
  const fill = kind === 'stomach' ? col('#3e7a2a') : col('#6a3a8e');
  plate(a, 0, 0, CW - 2, CH - 2, fill, { r: 3 });
  for (let j = 2; j < CH - 4; j++) for (let i = 2; i < CW - 4; i++) if (hnoise(i, j, 13) > 0.92) a.put(i, j, shadeC(fill, -0.12));
  // the icon: a gurgling swirl (tummy) or a ring of spinning stars (dizzy)
  const ic = kind === 'stomach' ? col('#d8f0a0') : col('#f0d0ff');
  const cx = 10, cy = 9;
  if (kind === 'stomach') {
    for (let i = 0; i < 22; i++) {
      const ang = i * 0.55 + t * 2, r = i * 0.3;
      a.put(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), i > 18 ? shadeC(ic, -0.3) : ic);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const ang = t * 4 + (i / 3) * Math.PI * 2;
      const X = Math.round(cx + Math.cos(ang) * 5), Y = Math.round(cy + Math.sin(ang) * 2.5);
      a.put(X, Y, CREAM); a.put(X - 1, Y, ic); a.put(X + 1, Y, ic); a.put(X, Y - 1, ic); a.put(X, Y + 1, ic);
    }
  }
  const label = kind === 'stomach' ? 'TUMMY ACHE' : 'DIZZY';
  outlined(a, label, 21, 13, CREAM, OUT, { face: 'block', bold: false, spacing: 1 });
  // time left as pips
  const n = Math.max(0, Math.ceil(left * 5));
  for (let i = 0; i < 5; i++) { a.rect(CW - 20 + i * 3, 5, 2, 7, OUT); a.rect(CW - 20 + i * 3, 6, 1, 5, i < n ? CREAM : shadeC(fill, -0.3)); }
}

// ---------------------------------------------------------------- the face's moods
/** expressions his in-game face can be in that the medallion mirrors */
const MIRROR = new Set(['injured', 'scared', 'shocked', 'surprised', 'happy', 'laugh', 'excited', 'wow', 'sad', 'cry', 'angry', 'grumpy', 'worried', 'thinking', 'determined', 'eat', 'tired', 'teasing', 'smug', 'sleep']);

// ---------------------------------------------------------------- the widget

/** add the status plate and the edge tints to the HUD root */
export function mountBodyHud(root: HTMLElement, _who?: HTMLElement): BodyHud {
  // V12: hidden (nothing mounted) unless setBodyHud('always' | 'auto') brings it back
  if (mode === 'never') return { ownsPack: () => false, update() { /* */ }, destroy() { /* */ }, cheer() { /* */ } };
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const vign = (key: string, hex: string, k: number) => pxCanvas(`vign:${key}`, a => {
    const c = col(hex);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const dx = (x / a.w - 0.5) / 0.55, dy = (y / a.h - 0.5) / 0.52;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (dith(x, y, Math.max(0, Math.min(1, (d - 0.66) / 0.42)) * k)) a.put(x, y, c);
    }
  }, { cls: key });
  const dim = root.insertBefore(el('div', 'v10dim', vign('low', '#0a0402', 0.95) + vign('sick', '#3a5a10', 0.7) + vign('dizzy', '#4a2a6a', 0.7)), root.firstChild);
  const lowCv = dim.querySelector('.low') as HTMLElement, sickCv = dim.querySelector('.sick') as HTMLElement, dizzyCv = dim.querySelector('.dizzy') as HTMLElement;
  const box = root.appendChild(el('div', 'bh'));
  const plateW = new PxW(box, 'plate');
  const wtW = new PxW(box, 'wt off');
  const ailW = new PxW(box, 'ail off');
  plateW.el.title = 'Mori (click to look him over)';
  plateW.el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (game.ui.blocking) return;
    const [x, y] = plateW.hit(e);
    // the medallion: inspect him; the lunch tin: a snack
    if ((x - MED.cx) ** 2 + (y - MED.cy) ** 2 <= (MED.RL + 2) ** 2 || (x < MED.W && y >= MED.cy + MED.Rs - 2)) {
      void import('../v12/inspect').then(m => { if (m.canInspect()) void m.inspectMori(); });
      return;
    }
    if (shown()) void import('../../game/v10/forage10').then(m => m.quickEat());
  });
  plateW.el.addEventListener('pointermove', e => {
    const [x] = plateW.hit(e);
    plateW.el.title = x < MED.W ? 'Mori (click to look him over)' : `How full he is. Eat a snack (${EAT_KEY.replace('Key', '')})`;
  });
  const st: FlaskSt = { level: energy() / maxEnergy(), tilt: 0, tiltV: 0, amp: 0.6, t: 0, bubbles: [], crack: 0, flash: 0, shown: 0 };
  let acc = 0, blinkT = 3, blink = 0, cheerT = 0, lastOn: boolean | null = null, sweatT = 3;
  // the face's moments: knocked down, a predator on him, a growl, a yawn
  let hurtT = 0, scaredT = 0, growlT = 0, yawnT = 0, yawnWait = 9;
  const shake = () => { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); };
  const off = onSpend(n => {
    if (n < 4) { st.amp = Math.min(2.5, st.amp + 0.6); return; }
    st.crack = 0.7; st.flash = 0.6; st.amp = 3;
    shake();
  });
  const playerId = () => (game.scene as unknown as { player?: { id?: string } } | null)?.player?.id ?? 'mori';
  const offGrowl = onGrowl(level => { growlT = 1.8 + Math.min(3, level) * 0.4; shake(); });
  const offPred = onPredator((ev, info) => {
    if (ev === 'knockdown') { if ((info.who ?? 'mori') === playerId()) { hurtT = 2.2; scaredT = Math.max(scaredT, 3); shake(); } }
    else if (ev === 'notice' || ev === 'stalk' || ev === 'ambush') scaredT = Math.max(scaredT, 4);
    else if (ev === 'charge' || ev === 'attack') scaredT = Math.max(scaredT, 5);
    else if (ev === 'retreat' || ev === 'break' || ev === 'ambushEnd') { scaredT = Math.min(scaredT, 0.5); }
  });
  return {
    ownsPack: () => false,
    cheer() { cheerT = 2.2; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); },
    update(dt: number) {
      st.t += dt;
      const on = shown();
      if (on !== lastOn) { lastOn = on; wtW.el.classList.toggle('off', !on); if (!on) { ailW.el.classList.add('off'); lowCv.classList.remove('on'); } }
      const f = Math.max(0, Math.min(1, energy() / maxEnergy()));
      const low = lowness();
      // the edge of the screen darkens and breathes as he tires; ailments tint it
      lowCv.classList.toggle('on', on && low > 0.05);
      lowCv.style.opacity = on && low > 0.05 ? (0.35 + low * 0.65).toFixed(2) : '';
      lowCv.classList.toggle('pulse', on && low > 0.55);
      sickCv.classList.toggle('on', on && hasAilment('stomach'));
      dizzyCv.classList.toggle('on', on && dizziness() > 0.05);
      const sc = game.scene as unknown as { player?: { vx?: number; body?: { showEmote?(e: string, t?: number): void; expr?: string; talking?: boolean } }; cutscene?: boolean } | null;
      // sweat drops on Mori when he's worn out
      if (on && low > 0.25) {
        sweatT -= dt;
        if (sweatT <= 0) {
          sweatT = 6 - low * 3 + Math.random() * 2;
          if (sc && !sc.cutscene && !game.ui.blocking) sc.player?.body?.showEmote?.('sweat', 1.2);
        }
      }
      // the tin: its level eases to how full he is, the bowls jiggle with his speed
      st.level += (f - st.level) * Math.min(1, dt * 3);
      const vx = sc?.player?.vx ?? 0;
      const want = Math.max(-0.35, Math.min(0.35, -vx / 260));
      st.tiltV += ((want - st.tilt) * 40 - st.tiltV * 6) * dt;
      st.tilt += st.tiltV * dt;
      st.amp = Math.max(0.35 + Math.abs(vx) / 260, st.amp - dt * 1.5);
      st.crack = Math.max(0, st.crack - dt);
      st.flash = Math.max(0, st.flash - dt * 2);
      if (st.level < f - 0.01 && Math.random() < dt * 8) st.bubbles.push({ x: 10 + Math.random() * 12, y: 5, v: 6 + Math.random() * 6 });
      for (const b of st.bubbles) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.6) * dt * 3; }
      st.bubbles = st.bubbles.filter(b => b.y > -8);
      blinkT -= dt;
      if (blinkT <= 0) { blink = 0.14; blinkT = 2.2 + Math.random() * 3.5; if (Math.random() < 0.2) blinkT = 0.3; }
      blink = Math.max(0, blink - dt);
      cheerT = Math.max(0, cheerT - dt);
      hurtT = Math.max(0, hurtT - dt);
      scaredT = Math.max(0, scaredT - dt);
      growlT = Math.max(0, growlT - dt);
      // repaint at 30 fps
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      const ail = ailments();
      const sick = hasAilment('stomach'), dizzy = dizziness() > 0.05;
      const hour = hudHour() ?? 12;
      const hh = ((hour % 24) + 24) % 24;
      const late = hh >= 21.5 || hh < 5;
      let starving = false;
      try { starving = hunger() >= TOO_HUNGRY; } catch { starving = false; }
      // his face: what's happening to him first, then what his in-game face shows, then how he is
      const bodyExpr = sc?.player?.body?.expr;
      const tiredNow = late;
      if (tiredNow && hurtT <= 0 && scaredT <= 0 && growlT <= 0) {
        yawnWait -= 1 / 30;
        if (yawnWait <= 0) { yawnT = 1.4; yawnWait = 10 + Math.random() * 10; }
      }
      yawnT = Math.max(0, yawnT - 1 / 30);
      let expr = 'neutral', mouth: 0 | 1 | 2 = 0;
      if (hurtT > 0) expr = 'injured';
      else if (scaredT > 0) expr = 'scared';
      else if (growlT > 0) { expr = 'worried'; mouth = Math.floor(st.t * 5) % 3 === 0 ? 1 : 0; }
      else if (bodyExpr && bodyExpr !== 'neutral' && MIRROR.has(bodyExpr)) expr = bodyExpr;
      else if (cheerT > 0) expr = 'happy';
      else if (sick) expr = 'worried';
      else if (dizzy) expr = 'scared';
      else if (yawnT > 0) { expr = 'sleep'; mouth = 1; }
      else if (tiredNow) expr = 'tired';
      else if (on && f < 0.3) expr = 'worried';
      else if (starving) expr = 'sad';
      if (sc?.player?.body?.talking && mouth === 0 && expr !== 'injured') mouth = Math.floor(st.t * 9) % 3 === 0 ? 0 : 1;
      box.classList.toggle('tremble', scaredT > 0 && hurtT <= 0);
      // the wind in his hair: a slow gusting sway, streaming back when he runs
      const wind = Math.max(-1, Math.min(1, Math.sin(st.t * 0.8) * 0.45 + Math.sin(st.t * 2.1 + 1) * 0.2 - vx / 220));
      const breathP = scaredT > 0 || hurtT > 0 ? 1.1 : 3.6;
      const breath = Math.sin((st.t / breathP) * Math.PI * 2) > 0.2 ? 1 : 0;
      const blinkOn = Math.floor(st.t * 2.5) % 2 === 0;
      const lowNow = on && f < 0.25;
      const id = playerId();
      const name = (CHAR_INFO[id]?.short ?? 'Mori').toUpperCase();
      const label = lowNow ? `EAT ${EAT_KEY.replace('Key', '')}` : `${Math.round(f * 5)}/5 BOWLS`;
      const word = tagWord(f);
      const tWid = tagW(word, label);
      const wPlate = on ? MED.W + 4 + FW + 6 + tWid + 3 : MED.W;
      plateW.draw(wPlate, MED.H, a => {
        if (on) {
          const fx = MED.W + 2;
          paintTin(a, fx, 10, st, f, lowNow, blinkOn);
          paintTag(a, fx + FW + 6, 30, tWid, word, lowNow, blinkOn, label, fx + FW - 5);
        }
        paintMedallion(a, 0, 0, { id, name, expr, blink: blink > 0, mouth, wind, hour, t: st.t, breath, warn: lowNow && blinkOn, growl: growlT > 0 ? Math.min(1, growlT * 2) : 0, hurt: hurtT > 1.2 ? (hurtT - 1.2) : 0 });
      });
      if (on) {
        const kg = packWeight(), cap = packCapacity();
        wtW.el.classList.toggle('heavy', kg > cap);
        wtW.draw(SW, SH, a => paintScale(a, kg, cap, st.t));
        const show = ail.filter(x => x.kind === 'stomach' || x.kind === 'dizzy');
        ailW.el.classList.toggle('off', !show.length);
        if (show.length) ailW.draw(CW, show.length * (CH + 1), a => {
          show.forEach((x, i) => {
            const c = new Art(CW, CH);
            paintChip(c, x.kind, Math.max(0, 1 - x.t / Math.max(0.01, x.dur)), st.t);
            a.blit(c, 0, i * (CH + 1));
          });
        });
      }
    },
    destroy() {
      off();
      offGrowl();
      offPred();
      dim.remove();
      box.remove();
    },
  };
}

