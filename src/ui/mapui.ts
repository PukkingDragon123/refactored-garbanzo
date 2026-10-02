// Jeep map: an illustrated pixel map of the explored coast of Zealandia; pick a site and time.

import { game } from '../game/game';
import { el } from './ui';
import { PixelBuffer } from '../art/pixel';
import { hex, mix, shade } from '../art/color';
import { PAL } from '../art/palettes';
import { bayer, clamp, fbm2 } from '../core/math';
import { SiteId, SPECIES } from '../game/species';
import { SITE_NAMES } from '../game/story';
import { TIMES, TIME_LABEL, TimeOfDay } from '../world/timeofday';
import { speciesSprite } from './icons';
import { audio } from '../core/audio';
import { startTrip } from '../game/scenes/travel';
import { pxIcon } from './pxicons';

const W = 360, H = 220;
export const SITE_POS: Record<SiteId | 'camp', [number, number]> = {
  camp: [72, 150], fernwood: [128, 128], canopy: [172, 96], falls: [226, 58], mangrove: [214, 170], coast: [306, 118],
};
const SITE_DESC: Record<SiteId, string> = {
  fernwood: 'Tree ferns, fallen logs and leaf litter. Legged serpents and armoured mammals forage in the sunbeams.',
  canopy: 'Rope bridges between kauri giants forty metres up. Gliders of every kind cross the gaps.',
  falls: 'A thundering waterfall and sheer cliffs where the birds nest out of reach of climbing vipers.',
  mangrove: 'Black water, prop roots and mudbanks. Crocodiles bask here. Something bigger hunts them.',
  coast: 'Reef, kelp and deep blue water. Put on the dive gear and meet what lives offshore.',
};

let mapURL = '';
function paintMap() {
  if (mapURL) return mapURL;
  const b = new PixelBuffer(W, H);
  const paper = hex('#e9dcb8'), paper2 = hex('#d8c795'), sea = hex('#9cc3c4'), sea2 = hex('#86b1b6');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - W * 0.53) / (W * 0.44), ny = (y - H * 0.52) / (H * 0.42);
      const d = Math.hypot(nx, ny * 1.05) + (fbm2(x * 0.02, y * 0.02, 4, 3) - 0.5) * 0.55;
      let c: number;
      if (d > 1) {
        c = (d < 1.06) ? sea2 : sea;
        if (d < 1.12 && (x + y) % 5 === 0) c = hex('#b7d6d4');
        if ((y % 9 === 0) && (x % 14 < 3) && d > 1.2) c = sea2;
      } else {
        const hgt = 1 - d + (fbm2(x * 0.05, y * 0.05, 3, 9) - 0.5) * 0.4 - (x < W * 0.3 ? 0.2 : 0);
        c = hgt > 0.62 ? hex('#8a8672') : hgt > 0.45 ? hex('#6f8a52') : hgt > 0.2 ? hex('#5f8a4c') : hex('#7ea45a');
        if (d > 0.93) c = hex('#e3cf8f');
        const forest = fbm2(x * 0.09, y * 0.09, 2, 5);
        if (hgt > 0.15 && hgt < 0.6 && forest > 0.55 && (x + y * 3) % 4 === 0) c = hex('#3f6b3a');
      }
      if (bayer(x, y) < 0.08) c = mix(c, paper2, 0.3);
      b.data[y * W + x] = c;
    }
  // mountains & volcano
  const peak = (px: number, py: number, s: number, volcano = false) => {
    for (let k = 0; k < s; k++) {
      b.hline(px - k, px + k, py + k, k < s * 0.35 ? hex('#f2efe6') : shade(hex('#8a8672'), -0.1));
      b.set(px + k, py + k, hex('#5a5646'));
    }
    if (volcano) { b.set(px, py, hex('#e8603c')); b.set(px, py - 2, hex('#b0a8a0')); b.set(px + 1, py - 4, hex('#c8c0b8')); }
  };
  peak(250, 72, 14, true);
  peak(228, 44, 9);
  peak(274, 50, 8);
  peak(200, 40, 7);
  // river from the falls to the mangroves
  let rx = 226, ry = 60;
  for (let i = 0; i < 130; i++) {
    b.set(rx, ry, hex('#5f98b0'));
    b.set(rx + 1, ry, hex('#7fb2c6'));
    ry += 0.85;
    rx += Math.sin(i * 0.15) * 0.8 - 0.1;
  }
  // dashed track from camp
  const path: [number, number][] = [[72, 150], [128, 128], [172, 96], [226, 58]];
  const path2: [number, number][] = [[128, 128], [180, 150], [214, 170]];
  const path3: [number, number][] = [[172, 96], [250, 108], [306, 118]];
  for (const p of [path, path2, path3]) for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i];
    const n = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < n; s += 1) if (Math.floor(s / 3) % 2 === 0) b.set(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, hex('#7a3a20'));
  }
  // compass rose
  const cx = 30, cy = 30;
  for (let k = -9; k <= 9; k++) { b.set(cx + k, cy, hex('#6a5436')); b.set(cx, cy + k, hex('#6a5436')); }
  b.poly([cx, cy - 12, cx - 3, cy - 3, cx + 3, cy - 3], PAL.red[4]);
  // ship
  b.rect(30, 170, 10, 3, PAL.red[4]);
  b.rect(33, 167, 4, 3, PAL.white[6]);
  // border
  for (let x = 0; x < W; x++) { b.set(x, 0, hex('#6a5436')); b.set(x, H - 1, hex('#6a5436')); b.set(x, 2, hex('#6a5436')); b.set(x, H - 3, hex('#6a5436')); }
  for (let y = 0; y < H; y++) { b.set(0, y, hex('#6a5436')); b.set(W - 1, y, hex('#6a5436')); b.set(2, y, hex('#6a5436')); b.set(W - 3, y, hex('#6a5436')); }
  void clamp; void paper;
  mapURL = b.toDataURL(3);
  return mapURL;
}

const CSS = `
.mapui { width: min(1100px, 96vw); padding: 1.1em 1.3em; display: grid; grid-template-columns: 1fr 19em; gap: 1.2em; }
.mapui .mapwrap { position: relative; aspect-ratio: ${W}/${H}; background: #e9dcb8; box-shadow: 0 0 0 3px #6a5436, 0 8px 20px rgba(0,0,0,0.5); }
.mapui .mapwrap > img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.mapui .pin { position: absolute; transform: translate(-50%, -100%); cursor: pointer; display: flex; flex-direction: column; align-items: center; background: none; border: 0; padding: 0; }
.mapui .pin .dot { width: 18px; height: 18px; background: var(--coral); border: 3px solid #fff4dc; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 3px 4px rgba(0,0,0,0.35); }
.mapui .pin .lbl { font-family: var(--pix); font-size: 0.8em; color: #2a2014; background: rgba(255, 244, 220, 0.9); padding: 1px 6px; margin-top: 4px; white-space: nowrap; }
.mapui .pin.sel .dot { background: var(--amber); animation: pinBob 0.8s ease-in-out infinite; }
.mapui .pin.locked { cursor: default; opacity: 0.55; }
.mapui .pin.locked .dot { background: #8a8070; }
.mapui .pin.camp .dot { background: var(--teal); }
@keyframes pinBob { 50% { transform: rotate(-45deg) translate(3px, -3px); } }
.mapui .side h2 { margin-bottom: 0.1em; }
.mapui .side p { font-size: 0.95em; line-height: 1.5; opacity: 0.9; margin: 0.4em 0 0.8em; }
.mapui .times { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0.4em 0 1em; }
.mapui .times button { font-size: 0.9em; }
.mapui .times button.on { background: var(--teal); }
.mapui .fauna { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1em; }
.mapui .fauna img { height: 2.1em; image-rendering: pixelated; background: rgba(255,255,255,0.06); padding: 3px; }
.mapui .fauna img.sil { filter: brightness(0) invert(0.35); }
.mapui .lbl2 { font-family: var(--pix); color: var(--teal2); font-size: 0.8em; letter-spacing: 0.1em; text-transform: uppercase; }
@media (max-width: 760px) { .mapui { grid-template-columns: 1fr; } }
`;
let styled = false;

export function openMap() {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  audio.play('uiOpen');
  const s = game.save;
  let sel: SiteId = s.sites[s.sites.length - 1];
  let tod: TimeOfDay = 'day';
  const box = el('div', 'mapui panel');
  const close = game.ui.modal(box);
  const mapwrap = box.appendChild(el('div', 'mapwrap'));
  mapwrap.innerHTML = `<img src="${paintMap()}" alt="Map of explored Zealandia">`;
  const side = box.appendChild(el('div', 'side'));
  const pins: Record<string, HTMLElement> = {};
  const addPin = (id: SiteId | 'camp') => {
    const [x, y] = SITE_POS[id];
    const unlocked = id === 'camp' || s.sites.includes(id as SiteId);
    const p = el('button', 'pin' + (id === 'camp' ? ' camp' : '') + (unlocked ? '' : ' locked'), `<div class="dot"></div><div class="lbl">${id === 'camp' ? 'Base Camp' : unlocked ? SITE_NAMES[id as SiteId] : '???'}</div>`);
    p.style.left = (x / W) * 100 + '%';
    p.style.top = (y / H) * 100 + '%';
    if (unlocked && id !== 'camp') p.onclick = () => { sel = id as SiteId; audio.play('ui'); render(); };
    mapwrap.appendChild(p);
    pins[id] = p;
  };
  (['camp', 'fernwood', 'canopy', 'falls', 'mangrove', 'coast'] as const).forEach(addPin);
  const render = () => {
    for (const [k, p] of Object.entries(pins)) p.classList.toggle('sel', k === sel);
    const fauna = SPECIES.filter(sp => sp.sites.includes(sel));
    side.innerHTML = `<div class="lbl2">Destination</div><h2>${SITE_NAMES[sel]}</h2><p>${SITE_DESC[sel]}</p><div class="lbl2">Time of day</div>`;
    const times = side.appendChild(el('div', 'times'));
    for (const t of TIMES) {
      const locked = t === 'night' && !s.tools.includes('headlamp');
      const b = el('button', 'btn ghost' + (t === tod ? ' on' : ''), locked ? 'Night (needs headlamp)' : TIME_LABEL[t]);
      b.disabled = locked;
      b.onclick = () => { tod = t; audio.play('ui'); render(); };
      times.appendChild(b);
    }
    side.appendChild(el('div', 'lbl2', 'Known fauna'));
    const fa = side.appendChild(el('div', 'fauna'));
    for (const sp of fauna) {
      const i = el('img', s.seen[sp.id] ? '' : 'sil');
      i.src = speciesSprite(sp.id);
      i.alt = s.seen[sp.id] ? sp.name : 'Unknown';
      i.title = s.seen[sp.id] ? `${sp.name} (${sp.times.map(x => TIME_LABEL[x]).join(', ')})` : 'Unknown species';
      fa.appendChild(i);
    }
    if (sel === 'coast' && !s.flags.divegear) side.appendChild(el('p', '', '<i>Needs dive gear from Pip.</i>'));
    const go = el('button', 'btn', `Drive! ${pxIcon('play')}`);
    go.style.width = '100%';
    go.disabled = sel === 'coast' && !s.flags.divegear;
    go.onclick = () => { audio.play('engine'); close(); startTrip(sel, tod); };
    side.appendChild(go);
    const cancel = el('button', 'btn ghost', 'Stay in camp');
    cancel.style.cssText = 'width:100%;margin-top:6px';
    cancel.onclick = () => { audio.play('uiBack'); close(); };
    side.appendChild(cancel);
  };
  render();
}
