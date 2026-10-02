// V9 catch presentation (the DOM half; the in-world half, the fish bursting out of the water into
// Mori's raised hands with a bouncy zoom, sparkles and confetti, lives in ../v4/fishing.ts):
//
//  - a big banner along the bottom: the fish's icon popping out of a spinning sunburst in a gold
//    slot, "I caught a SNOUT BASS!" letter by letter, the pun line, the length, stars and NEW /
//    RARE badges, then "continue" (skippable once it has landed)
//  - the catch photo for the research system: a zoomed-in snapshot of the game itself at the "I
//    caught it!" moment (Mori holding the fish up, the boat and sea behind), filed as a raw photo
//    with a 'caught' subject boxed round the fish (and a close-up of the snout louse, when there is
//    one), with a little polaroid flying into the corner

import { el } from '../ui';
import { game } from '../../game/game';
import { addRawPhoto, type PhotoSubject } from '../../game/photos';
import { PixelBuffer } from '../../art/pixel';
import { fishIcon, canvasOf } from '../../art/v9/fish';
import type { FishDef } from '../v4/fishing';
import { pxIcon } from '../pxicons';

const CSS = `
.fcs { position: absolute; left: 50%; bottom: max(14px, 4vh); z-index: 28; width: min(600px, 94vw); transform: translateX(-50%); pointer-events: none;
  display: flex; align-items: center; gap: 14px; box-sizing: border-box; padding: 6px 16px 8px 8px;
  border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round; image-rendering: pixelated;
  font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: #3a2614; filter: drop-shadow(0 6px 0 rgba(0,0,0,0.35));
  animation: fcsIn 0.42s cubic-bezier(.2,1.6,.4,1) both; }
.fcs.out { animation: fcsOut 0.25s ease-in both; }
@keyframes fcsIn { from { transform: translateX(-50%) translateY(60px) scale(0.6); opacity: 0; } }
@keyframes fcsOut { to { transform: translateX(-50%) translateY(40px) scale(0.85); opacity: 0; } }
.fcs .ic { position: relative; flex: none; width: var(--icw); height: var(--icw); background: var(--sk-slot) center / 100% 100% no-repeat; image-rendering: pixelated; }
.fcs .ic .sun { position: absolute; inset: 8%; border-radius: 50%; overflow: hidden; }
.fcs .ic .sun::before { content: ''; position: absolute; inset: -40%; background: repeating-conic-gradient(from 0deg, rgba(255,226,120,0.85) 0 12deg, rgba(255,190,70,0.35) 12deg 24deg); animation: fcsSpin 6s linear infinite; }
@keyframes fcsSpin { to { transform: rotate(360deg); } }
.fcs .ic canvas { position: absolute; left: 50%; top: 50%; width: 82%; height: 82%; transform: translate(-50%, -50%); image-rendering: pixelated; animation: fcsPop 0.6s 0.15s cubic-bezier(.2,2,.4,1) both; }
@keyframes fcsPop { from { transform: translate(-50%, -50%) scale(0) rotate(-40deg); } }
.fcs .tx { flex: 1; min-width: 0; }
.fcs .l1 { font-size: clamp(15px, 2.2vw, 21px); line-height: 1.05; }
.fcs .l1 b { white-space: nowrap; font: 700 clamp(22px, 3.6vw, 36px) 'Jersey 10', 'Silkscreen', monospace; letter-spacing: 0.04em; color: #ffe27a; text-transform: uppercase;
  text-shadow: 0 3px 0 #5a2a0a, 2px 0 0 #5a2a0a, -2px 0 0 #5a2a0a, 0 -2px 0 #5a2a0a, 2px 2px 0 #5a2a0a, -2px 2px 0 #5a2a0a; }
.fcs .l1 i { font-style: normal; display: inline-block; animation: fcsLetter 0.3s cubic-bezier(.2,2.2,.4,1) both; }
@keyframes fcsLetter { from { transform: translateY(-14px) scale(0.3); opacity: 0; } }
.fcs .pun { font-size: clamp(14px, 2vw, 19px); margin-top: 2px; color: #5a3a1a; opacity: 0; transition: opacity 0.3s; }
.fcs .pun.on { opacity: 1; }
.fcs .row { display: flex; align-items: center; gap: 10px; margin-top: 3px; font: 700 clamp(14px, 1.9vw, 18px) 'Jersey 10', 'Silkscreen', monospace; opacity: 0; transition: opacity 0.3s; }
.fcs .row.on { opacity: 1; }
.fcs .st { color: #e8b030; letter-spacing: 2px; font-size: 1.25em; text-shadow: 0 2px 0 #6a4a1a; }
.fcs .bd { color: #fff; padding: 0 6px; border-radius: 2px; box-shadow: 0 0 0 2px #2a1a10; font-size: 0.85em; }
.fcs .bd.new { background: #3f8a34; } .fcs .bd.rare { background: #b04a8a; animation: fcsRare 0.8s ease-in-out infinite alternate; }
@keyframes fcsRare { to { background: #e07ac0; } }
.fcs .go { position: absolute; right: 14px; bottom: 2px; font: 700 12px 'Jersey 10', 'Silkscreen', monospace; color: #6a4a2a; opacity: 0; transition: opacity 0.3s; letter-spacing: 0.06em; }
.fcs .go.on { opacity: 1; animation: fcsBlink 1s ease-in-out infinite alternate; }
@keyframes fcsBlink { to { opacity: 0.45; } }
.fcp { position: absolute; z-index: 29; right: max(16px, 3vw); top: max(14px, 4vh); width: 120px; padding: 5px 5px 16px; background: #fbf6ea; box-shadow: 0 0 0 2px #2a1a10, 0 6px 0 rgba(0,0,0,0.3);
  pointer-events: none; animation: fcpIn 0.6s cubic-bezier(.2,1.4,.4,1) both, fcpOut 0.5s 2.6s ease-in both; transform-origin: 50% 0; font: 700 11px 'Jersey 10', monospace; color: #6a4a2a; text-align: center; }
.fcp img { display: block; width: 100%; image-rendering: pixelated; box-shadow: 0 0 0 1px #8a7a5a; }
.fcp div { position: absolute; left: 0; right: 0; bottom: 2px; }
@keyframes fcpIn { from { transform: translate(-30vw, 30vh) rotate(-30deg) scale(1.8); opacity: 0; } to { transform: rotate(4deg); } }
@keyframes fcpOut { to { transform: rotate(10deg) translateY(-20px) scale(0.6); opacity: 0; } }
`;
let styled = false;
const style = () => { if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; } };

export interface Banner { el: HTMLElement; /** the text has finished landing */ ready(): boolean; finish(): void; close(): Promise<void> }

/** the "I caught a ...!" banner. head: the line before the name; name; pun; meta row html */
export function showBanner(icon: PixelBuffer, head: string, name: string, pun: string, meta: string): Banner {
  style();
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const sc = vmin < 500 ? 3 : 4;
  const b = el('div', 'fcs');
  b.style.setProperty('--icw', Math.round(icon.w * sc * 1.24) + 'px');
  const ic = el('div', 'ic', '<div class="sun"></div>');
  ic.appendChild(canvasOf(icon, sc));
  const tx = el('div', 'tx');
  const l1 = el('div', 'l1', `${head} `);
  const nm = el('b');
  const letters = [...name.toUpperCase()];
  letters.forEach((ch, i) => { const s = el('i', '', ch === ' ' ? '&nbsp;' : ch); s.style.animationDelay = (0.25 + i * 0.045).toFixed(3) + 's'; nm.appendChild(s); });
  l1.appendChild(nm);
  l1.appendChild(document.createTextNode('!'));
  const pe = el('div', 'pun', pun);
  const row = el('div', 'row', meta);
  const go = el('div', 'go', `${pxIcon('play')} CONTINUE`);
  tx.append(l1, pe, row);
  b.append(ic, tx, go);
  game.ui.modalLayer.appendChild(b);
  const tLand = 0.3 + letters.length * 0.045 + 0.2;
  const timers = [
    setTimeout(() => pe.classList.add('on'), tLand * 1000),
    setTimeout(() => row.classList.add('on'), (tLand + 0.25) * 1000),
    setTimeout(() => go.classList.add('on'), (tLand + 0.55) * 1000),
  ];
  const t0 = performance.now();
  let done = false;
  return {
    el: b,
    ready: () => done || performance.now() - t0 > (tLand + 0.2) * 1000,
    finish() {
      done = true;
      for (const t of timers) clearTimeout(t);
      for (const s of nm.querySelectorAll('i')) (s as HTMLElement).style.animationDelay = '0s';
      pe.classList.add('on'); row.classList.add('on'); go.classList.add('on');
    },
    close() {
      for (const t of timers) clearTimeout(t);
      b.classList.add('out');
      return new Promise(r => setTimeout(() => { b.remove(); r(); }, 240));
    },
  };
}

// ------------------------------------------------------------------ the catch photo
// A real snapshot of the moment: the game canvas cropped and zoomed in on Mori holding the catch up,
// with the boat, sea and sky behind (the DOM banner isn't in the canvas, so it stays out of the shot).
const PW = 400, PH = 225;
type Box = [number, number, number, number];
const subject = (species: string, behavior: string, bbox: Box, centre: number): PhotoSubject => ({
  species, behavior, bbox, visible: 1, inFrame: 1, focus: 1, motion: 1, shake: 1, size: bbox[3] - bbox[1], facing: 1, centre, noticed: false,
});
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** run fn right after the next frame is drawn (the WebGL canvas is only readable then) */
function afterFrame<T>(fn: () => T): Promise<T> {
  return new Promise(res => {
    const prev = game.afterRender;
    game.afterRender = () => { prev?.(); res(fn()); };
  });
}

/** copy the canvas region around a world-space box (main plane) into a 16:9 photo; returns the image and a world → photo mapper */
function snap(around: Box, minW: number): { img: string; map: (b: Box) => Box } {
  const r = game.r, cv = r.canvas;
  const k = cv.width / r.VW;
  const X = (x: number) => r.projectX(x, 1) * k, Y = (y: number) => r.projectY(y, 1) * (cv.height / r.VH);
  let x0 = X(around[0]), y0 = Y(around[1]), x1 = X(around[2]), y1 = Y(around[3]);
  // breathing room round the subject, at least minW world px across, 16:9
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let h = Math.max((y1 - y0) * 1.3, ((x1 - x0) * 1.3) * PH / PW, (minW * (X(1) - X(0))) * PH / PW);
  h = Math.min(h, cv.height, cv.width * PH / PW);
  const w = h * PW / PH;
  x0 = Math.max(0, Math.min(cv.width - w, cx - w / 2));
  y0 = Math.max(0, Math.min(cv.height - h, cy - h / 2));
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cv, x0, y0, w, h, 0, 0, PW, PH);
  const img = c.toDataURL('image/jpeg', 0.88);
  const map = (b: Box): Box => [clamp01((X(b[0]) - x0) / w), clamp01((Y(b[1]) - y0) / h), clamp01((X(b[2]) - x0) / w), clamp01((Y(b[3]) - y0) / h)];
  return { img, map };
}

const site = 'sea' as const;
const timeOf = () => (game.save.campTime ?? 'day') as never;

/** take the catch photo on the next frame: `around` frames Mori and the fish, `fish` is the fish's box (world).
 *  Filed as a raw photo with a 'caught' subject; a little polaroid flies into the corner. */
export function catchPhoto(f: FishDef, len: number, around: Box, fish: Box): Promise<string> {
  return afterFrame(() => {
    const { img, map } = snap(around, 72);
    const bb = map(fish);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    addRawPhoto({ img, site, time: timeOf(), day: game.save.day, video: false, light: 1, subjects: [subject(f.id, 'caught', bb, clamp01(1 - Math.hypot(cx - 0.5, cy - 0.5) / 0.5))], af: f.id, notes: [`Caught off the stern, ${len} cm`] });
    style();
    const pol = el('div', 'fcp', `<img src="${img}" alt=""><div>PHOTO SAVED</div>`);
    game.ui.modalLayer.appendChild(pol);
    setTimeout(() => pol.remove(), 3300);
    return img;
  });
}

/** the close-up of the snout louse peering out of the trunk (world point, its box in world px) */
export function lousePhoto(louse: Box): Promise<string> {
  return afterFrame(() => {
    const { img, map } = snap(louse, 34);
    addRawPhoto({ img, site, time: timeOf(), day: game.save.day, video: false, light: 1, subjects: [subject('snoutlouse', 'attached', map(louse), 1)], af: 'snoutlouse', notes: ['Close-up of the trunk tip'] });
    return img;
  });
}

/** the icon of a fish as a canvas (field guide, cards) */
export const fishIconCanvas = (id: string, scale = 3) => canvasOf(fishIcon(id), scale);
