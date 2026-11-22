// V12 Big Hank's wares: the trade, as floating words in the world (no panel, no box). The goods hang
// in the air beside Hank, each one its weapon's little painted icon and its name in the menus' bold
// pixel letters, every letter bobbing on its own swell; the price trails after it as the things Hank
// wants, each a tiny painted item icon and a count (red when Mori is short), and agency vouchers (the
// research points: "they spend in Auckland"). The focused ware lifts in a travelling wave, turns gold
// with an underline shimmering under it, and Hank's sales patter for it is written in Mori's hand
// under the list. When Mori pays, what Hank takes flies out of Mori's pack over to Hank, one thing at a
// time, and the weapon flies back.
//
//   const r = await openWares({ wares, anchor, mori, hank, onBuy })   resolves when Mori walks away
//
// Keys: up / down (W / S) choose, Enter / Space / E buy, Esc / Backspace leave; the mouse hovers and
// clicks, a tap buys. Every letter, icon and count is drawn on whole pixels at the HUD's scale.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { pushKeys } from '../laptop-kit';
import { pxTextBuf, pxMeasure } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { pxIconBuf, PX_ICONS } from '../pxicons';
import { itemIcon } from '../../art/itemicons';
import { itemArtBuffer } from '../../art/v11/itemart';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { hudScale } from '../v11/hudpx';
import { ITEMS } from '../../game/items';

export interface WarePrice { items: [string, number][]; rp?: number }
export interface Ware {
  key: string;
  /** the pixel icon (src/ui/pxicons.ts) */
  icon: string;
  name: string;
  /** a small note after the name ("x2", "owned") */
  note?: string;
  price: WarePrice;
  /** Hank's patter, written under the list while it has the focus */
  patter: string;
  /** a ware he won't sell (yet): shown dimmed with why */
  locked?: string;
}
export interface WaresOpts {
  wares: Ware[];
  heading?: string;
  /** CSS points (relative to the UI root) of Hank's head and Mori's, asked every frame */
  hank: () => [number, number] | null;
  mori: () => [number, number] | null;
  /** how many of an item Mori has, and his vouchers */
  have: (item: string) => number;
  rp: () => number;
  /** Mori buys: return the new list (or null to leave), or false if it fell through */
  onBuy: (w: Ware) => Promise<Ware[] | null | false>;
}

// ---------------------------------------------------------------- sprites
const cache = new Map<string, HTMLCanvasElement>();
function cv(b: PixelBuffer): HTMLCanvasElement { return b.toCanvas(1); }
function sprite(key: string, make: () => PixelBuffer): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) { c = cv(make()); cache.set(key, c); }
  return c;
}
const INK = '#140c06';
/** one letter in the bold face: a fill, a lighter top half, a dark ring and drop */
function glyph(ch: string, top: string, bot: string, font: PxFontId = 'bold'): HTMLCanvasElement {
  return sprite(`g|${font}|${ch}|${top}|${bot}`, () => {
    const b = pxTextBuf(ch, { font, color: bot, outline: INK, shadow: INK, pad: 1, bounce: false });
    const fill = hex(bot), hi = hex(top);
    const mid = Math.floor(b.h / 2);
    for (let y = 0; y < mid; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === fill) b.set(x, y, hi);
    return b;
  });
}
const advance = (ch: string, font: PxFontId = 'bold') => (ch === ' ' ? pxMeasure(' ', font) + 1 : pxMeasure(ch, font) + 1);
/** a small item icon: the 24px art halved by keeping each 2x2 block's commonest colour, re-inked */
function smallIcon(id: string): HTMLCanvasElement {
  return sprite('i|' + id, () => {
    const src = itemArtBuffer(id) ?? itemIcon(id);
    // fit the footprint's art (24 per cell) into ~12px: scale = ceil(max side / 12)
    const k = Math.max(2, Math.ceil(Math.max(src.w, src.h) / 12));
    const w = Math.ceil(src.w / k), h = Math.ceil(src.h / k);
    const out = new PixelBuffer(w + 2, h + 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const count = new Map<number, number>();
      let opaque = 0;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const c = src.get(x * k + i, y * k + j);
        if ((c >>> 24) < 160) continue;
        opaque++;
        count.set(c, (count.get(c) ?? 0) + 1);
      }
      if (opaque * 2 < k * k) continue;
      let best = 0, bn = -1;
      for (const [c, n] of count) if (n > bn) { bn = n; best = c; }
      out.set(x + 1, y + 1, best);
    }
    const ink = hex(INK), snap = out.data.slice();
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
      if (snap[y * out.w + x] >>> 24) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < out.w && Y < out.h && (snap[Y * out.w + X] >>> 24); })) out.set(x, y, ink);
    }
    return out;
  });
}
const pxIc = (name: string) => sprite('p|' + name, () => pxIconBuf(name));
const tiny = (text: string, c: string) => sprite(`t|${text}|${c}`, () => pxTextBuf(text, { font: 'tiny', color: c, outline: INK, pad: 1, bounce: false }));
const script = (text: string, c: string, maxW: number) => sprite(`s|${text}|${c}|${maxW}`, () => pxTextBuf(text, { font: 'script', color: c, outline: INK, shadow: INK, pad: 1, maxW, bounce: false }));
// agency vouchers: a little paper ticket with a stamp
if (!PX_ICONS.voucher) PX_ICONS.voucher = { rows: ['aaaaaaaa', 'abbbbccb', 'abddbccb', 'abbbbbbb', 'aaaaaaaa'], pal: { a: '#c8b88a', b: '#f4ecd0', c: '#c83a2a', d: '#3a5aa8' } };

// ---------------------------------------------------------------- the overlay
interface Row { w: Ware; y: number; nameX: number; priceX: number; h: number; born: number }
interface Flyer { c: HTMLCanvasElement; from: () => [number, number] | null; to: () => [number, number] | null; t: number; dur: number; arc: number; done?: () => void }

export function openWares(o: WaresOpts): Promise<void> {
  const root = game.ui.root;
  const canvas = document.createElement('canvas');
  canvas.className = 'v12-wares';
  canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:8;image-rendering:pixelated;touch-action:none';
  root.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  game.ui.modalOpen++;
  let S = 2, W = 0, Hh = 0;
  let wares = o.wares;
  let rows: Row[] = [];
  let focus = 0, busy = false, closing = -1, t = 0, last = performance.now();
  let hover = -1;
  const flyers: Flyer[] = [];
  let box = { x: 0, y: 0, w: 0, h: 0 };
  const fit = () => {
    const R = root.getBoundingClientRect();
    const s = hudScale();
    const w = Math.max(1, Math.ceil(R.width / s)), h = Math.max(1, Math.ceil(R.height / s));
    if (w !== W || h !== Hh || s !== S) { S = s; W = w; Hh = h; canvas.width = w; canvas.height = h; canvas.style.width = w * s + 'px'; canvas.style.height = h * s + 'px'; g.imageSmoothingEnabled = false; }
  };
  const ROWH = 15;
  const layout = () => {
    const nameW = Math.max(...wares.map(w => [...w.name.toUpperCase()].reduce((a, c) => a + advance(c), 0) + (w.note ? pxMeasure(w.note, 'tiny') + 6 : 0)));
    // (a ware still on offer keeps its words where they were; new ones blow in)
    const was = new Map(rows.map(r => [r.w.key, r.born]));
    rows = wares.map((w, i) => ({ w, y: i * ROWH, nameX: 20, priceX: 20 + nameW + 10, h: ROWH, born: was.get(w.key) ?? t + i * 0.06 }));
    rows.push({ w: { key: '_leave', icon: '', name: 'That’s all, Hank', price: { items: [] }, patter: '' }, y: wares.length * ROWH + 4, nameX: 20, priceX: 0, h: ROWH, born: was.get('_leave') ?? t + wares.length * 0.06 });
    focus = Math.min(focus, rows.length - 1);
  };
  layout();
  const afford = (w: Ware) => !w.locked && w.price.items.every(([id, n]) => o.have(id) >= n) && (w.price.rp ?? 0) <= o.rp();
  const anchorArt = (f: () => [number, number] | null): [number, number] | null => { const a = f(); return a ? [a[0] / S, a[1] / S] : null; };

  const pick = async (i: number) => {
    if (busy || closing >= 0) return;
    const r = rows[i];
    if (!r) return;
    if (r.w.key === '_leave') { leave(); return; }
    if (!afford(r.w)) { audio.play('wrong', { vol: 0.4 }); r.born = t - 0.5; shake = 0.3; return; }
    busy = true;
    // what he takes flies over to Hank, one thing at a time
    let k = 0;
    for (const [id, n] of r.w.price.items) for (let j = 0; j < Math.min(n, 4); j++) flyers.push({ c: smallIcon(id), from: () => anchorArt(o.mori), to: () => anchorArt(o.hank), t: -(k++) * 0.09, dur: 0.55, arc: 26 });
    if (r.w.price.rp) flyers.push({ c: pxIc('voucher'), from: () => anchorArt(o.mori), to: () => anchorArt(o.hank), t: -(k++) * 0.09, dur: 0.55, arc: 30 });
    audio.play('ui', { vol: 0.3, pitch: 0.9 });
    await new Promise(res => setTimeout(res, 380 + k * 90));
    const next = await o.onBuy(r.w);
    if (next !== false) flyers.push({ c: pxIc(r.w.icon), from: () => anchorArt(o.hank), to: () => anchorArt(o.mori), t: 0, dur: 0.6, arc: 34, done: () => audio.play('collectPop' as never, { vol: 0.5 }) });
    busy = false;
    if (next === null) { leave(); return; }
    if (next) { wares = next; layout(); }
  };
  let shake = 0;
  let resolve: () => void = () => {};
  const leave = () => { if (closing < 0) { closing = t; audio.play('ui', { vol: 0.2, pitch: 0.7 }); } };
  const pop = pushKeys(e => {
    if (closing >= 0) return true;
    const c = e.code;
    if (c === 'ArrowDown' || c === 'KeyS') { focus = (focus + 1) % rows.length; audio.play('ui', { vol: 0.1, pitch: 1.7 }); return true; }
    if (c === 'ArrowUp' || c === 'KeyW') { focus = (focus + rows.length - 1) % rows.length; audio.play('ui', { vol: 0.1, pitch: 1.7 }); return true; }
    if (c === 'Enter' || c === 'Space' || c === 'KeyE') { void pick(focus); return true; }
    if (c === 'Escape' || c === 'Backspace') { leave(); return true; }
    return true;
  });
  const at = (e: PointerEvent): number => {
    const R = root.getBoundingClientRect();
    const x = (e.clientX - R.left) / S, y = (e.clientY - R.top) / S;
    return rows.findIndex(r => x >= box.x - 2 && x <= box.x + box.w + 2 && y >= box.y + r.y - 2 && y < box.y + r.y + r.h - 2);
  };
  canvas.addEventListener('pointermove', e => { const i = at(e); if (i !== hover) { hover = i; if (i >= 0) { focus = i; audio.play('ui', { vol: 0.08, pitch: 1.8 }); } } canvas.style.cursor = i >= 0 ? 'pointer' : ''; });
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const i = at(e); if (i >= 0) { focus = i; void pick(i); } else if (e.pointerType !== 'mouse') leave(); });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); leave(); });

  // ---------------------------------------------------------------- drawing
  const word = (text: string, x: number, y: number, i: number, focused: boolean, dim: boolean, born: number) => {
    let cx = x;
    const top = dim ? '#c4bcae' : focused ? '#fffbe6' : '#ffffff', bot = dim ? '#8a8276' : focused ? '#ffc860' : '#f0dcb8';
    [...text].forEach((ch, k) => {
      const age = t - born - k * 0.018;
      if (age < 0) return;
      const arrive = Math.min(1, age / 0.22);
      const bob = Math.round(Math.sin(t * 2.4 + k * 0.7 + i) * 0.8 + (focused ? -Math.max(0, Math.sin(t * 6 - k * 0.5)) * 1.6 : 0));
      if (ch !== ' ') g.drawImage(glyph(ch, top, bot), Math.round(cx + (1 - arrive) * 14) - 1, y + bob - (focused ? 1 : 0));
      cx += advance(ch);
    });
    return cx;
  };
  const frame = () => {
    if (!canvas.isConnected) return;
    // (real time: the words arrive on time even when the frame rate drops)
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    t += dt;
    shake = Math.max(0, shake - dt);
    fit();
    g.clearRect(0, 0, W, Hh);
    const ha = anchorArt(o.hank);
    // where the list hangs: beside Hank, on whichever side has room
    const listW = Math.max(...rows.map(r => (r.priceX || 0) + priceW(r.w))) + 10;
    const listH = rows.length * ROWH + 26;
    let x0 = ha ? ha[0] - listW - 26 : W / 2 - listW / 2;
    if (x0 < 6) x0 = ha ? ha[0] + 26 : 6;
    x0 = Math.max(6, Math.min(W - listW - 6, x0));
    const y0 = Math.max(10, Math.min(Hh - listH - 56, (ha ? ha[1] : Hh / 2) - listH * 0.55));
    box = { x: Math.round(x0), y: Math.round(y0 + 12), w: listW, h: listH };
    const fade = closing >= 0 ? Math.max(0, 1 - (t - closing) / 0.3) : 1;
    g.globalAlpha = 1;
    if (fade > 0) {
      // the heading in Mori's hand
      const hd = script(o.heading ?? 'Hank’s wares', '#d8fff2', 260);
      if (Math.floor((t - closing) * 20) % 2 === 0 || closing < 0) g.drawImage(hd, box.x + 2, Math.round(y0 - 2 + Math.sin(t * 1.6) * 0.8));
      rows.forEach((r, i) => {
        const yy = box.y + r.y + (closing >= 0 ? Math.round((t - closing) * -40 * (1 + i * 0.2)) : 0);
        const focused = i === focus;
        const leaveRow = r.w.key === '_leave';
        const dim = !leaveRow && !afford(r.w);
        const sx = focused && shake > 0 ? Math.round(Math.sin(t * 60) * 2) : 0;
        // the caret beside the focused ware
        if (focused) g.drawImage(pxIc('play'), box.x + 1 + (Math.floor(t * 4) % 2), yy + 2);
        if (!leaveRow && r.w.icon) { const ic = pxIc(r.w.icon); g.drawImage(ic, box.x + 9 + sx + Math.round((9 - ic.width) / 2), yy + Math.round((9 - ic.height) / 2)); }
        const end = word(r.w.name.toUpperCase(), box.x + r.nameX + sx, yy, i, focused, dim && !focused, r.born);
        if (r.w.note) g.drawImage(tiny(r.w.note, '#9ff0dc'), end + 3, yy + 2);
        // the underline shimmer
        if (focused) for (let x = box.x + r.nameX; x < end; x++) if (((x + Math.floor(t * 18)) % 6) < 4) { g.fillStyle = (x + Math.floor(t * 18)) % 6 < 2 ? '#fff6c8' : '#ffb040'; g.fillRect(x, yy + 11, 1, 1); }
        // the price: what he wants, each a tiny icon and a count
        if (!leaveRow) {
          let px = box.x + r.priceX;
          if (r.w.locked) { g.drawImage(tiny(r.w.locked, '#ffb8a0'), px, yy + 2); return; }
          for (const [id, n] of r.w.price.items) {
            const ic = smallIcon(id);
            g.drawImage(ic, px, yy + Math.round((10 - ic.height) / 2));
            px += ic.width;
            const ok = o.have(id) >= n;
            const tc = tiny('x' + n, ok ? '#fff1cc' : '#ff8a6a');
            g.drawImage(tc, px, yy + 3);
            px += tc.width + 4;
          }
          if (r.w.price.rp) {
            const ic = pxIc('voucher');
            g.drawImage(ic, px, yy + 2);
            px += ic.width + 1;
            const tc = tiny(String(r.w.price.rp), o.rp() >= r.w.price.rp ? '#fff1cc' : '#ff8a6a');
            g.drawImage(tc, px, yy + 3);
            px += tc.width + 4;
          }
          if (!r.w.price.items.length && !r.w.price.rp) g.drawImage(tiny('ON THE HOUSE', '#9ff0dc'), px, yy + 3);
        }
      });
      // Hank's patter for the focused ware, in Mori's hand under the list
      const f = rows[focus]?.w;
      const pat = f && f.key !== '_leave' ? (f.locked ? f.patter : afford(f) ? f.patter : `${f.patter}  (You're short.)`) : 'Walk away. He’ll still be here. He’s always here.';
      const pc = script(pat, '#fff6e4', Math.min(320, Math.max(180, listW)));
      g.drawImage(pc, box.x + 4, box.y + rows.length * ROWH + 6);
      // what he wants, by name, with what Mori has of each
      if (f && f.key !== '_leave' && !f.locked && (f.price.items.length || f.price.rp)) {
        const want = [...f.price.items.map(([id, n]) => `${n} ${(ITEMS[id]?.name ?? id).toLowerCase()} (${o.have(id)})`), ...(f.price.rp ? [`${f.price.rp} vouchers (${o.rp()})`] : [])].join(', ');
        g.drawImage(sprite(`w|${want}`, () => pxTextBuf('Wants ' + want, { font: 'body', color: '#9ff0dc', outline: INK, pad: 1, maxW: Math.min(340, Math.max(200, listW + 40)), bounce: false })), box.x + 4, box.y + rows.length * ROWH + 8 + pc.height);
      }
    }
    // things flying between Mori and Hank
    for (const fl of flyers) {
      fl.t += dt;
      if (fl.t < 0) continue;
      const a = fl.from(), b = fl.to();
      if (!a || !b) { fl.t = fl.dur; continue; }
      const u = Math.min(1, fl.t / fl.dur), e = u * u * (3 - 2 * u);
      const x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e - Math.sin(Math.PI * u) * fl.arc;
      g.drawImage(fl.c, Math.round(x - fl.c.width / 2), Math.round(y - fl.c.height / 2));
      if (u >= 1 && fl.done) { fl.done(); fl.done = undefined; }
    }
    for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].t >= flyers[i].dur) flyers.splice(i, 1);
    if (closing >= 0 && t - closing > 0.35 && !flyers.length) { finish(); return; }
    requestAnimationFrame(frame);
  };
  const priceW = (w: Ware) => {
    if (w.key === '_leave') return 0;
    if (w.locked) return pxMeasure(w.locked, 'tiny') + 4;
    let n = 0;
    for (const [id, k] of w.price.items) n += smallIcon(id).width + tiny('x' + k, '#fff1cc').width + 4;
    if (w.price.rp) n += pxIc('voucher').width + 1 + tiny(String(w.price.rp), '#fff1cc').width + 4;
    if (!w.price.items.length && !w.price.rp) n += tiny('ON THE HOUSE', '#9ff0dc').width;
    return n;
  };
  let fin = false;
  const finish = () => {
    if (fin) return;
    fin = true;
    pop();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    canvas.remove();
    resolve();
  };
  audio.play('bubblePop' as never, { vol: 0.25, pitch: 0.9 });
  return new Promise<void>(res => { resolve = res; requestAnimationFrame(frame); });
}
