// MoriOS: Mori's field laptop. A cosy retro desktop with an animated nature wallpaper and a fat-pug
// cursor. Apps: Spreadsheets (seabird survey + temperature chart), Reports (the morning report: read
// the data and fill it in), Photos, Discoveries (species log), Files (with Jenna's locked folder),
// Plankton Sort (a quick research minigame) and a tiny terminal Jenna installed "for emergencies".

import { game } from '../../game/game';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { rawPhotos } from '../../game/photos';

const CSS = `
.mos-wrap { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(6,4,8,0.7); animation: mosIn 0.25s ease-out both; }
@keyframes mosIn { from { opacity: 0; } }
.mos-lap { position: relative; width: min(96vw, 1100px); height: min(88vh, 660px); background: #2a2630; border-radius: 10px; padding: 16px 16px 26px; box-sizing: border-box;
  box-shadow: 0 0 0 3px #141018, 0 10px 0 #141018, inset 0 0 0 2px #4a4452; animation: mosPop 0.35s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes mosPop { from { transform: scale(0.9) translateY(20px); } }
.mos-lap::after { content: 'MoriBook'; position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); font: 700 11px 'Silkscreen', monospace; color: #8a8494; letter-spacing: 0.2em; }
.mos-lap::before { content: ''; position: absolute; top: 6px; left: 50%; width: 5px; height: 5px; margin-left: -2px; background: #141018; border-radius: 50%; box-shadow: 0 0 0 1px #4a4452; }
.mos-scr { position: relative; width: 100%; height: 100%; overflow: hidden; background: #0e1622; font-family: 'Pixelify Sans', 'Silkscreen', monospace; color: #1e1a24; -webkit-font-smoothing: none;
  cursor: var(--pug) 3 3, auto; user-select: none; }
.mos-scr * { cursor: inherit; }
.mos-scr input, .mos-scr select { cursor: var(--pug) 3 3, text; }
.mos-wall { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.mos-icons { position: absolute; left: 10px; top: 10px; display: grid; grid-auto-flow: column; grid-template-rows: repeat(auto-fill, 84px); gap: 4px 10px; height: calc(100% - 50px); }
.mos-ic { width: 74px; text-align: center; color: #fff; font-size: 13px; text-shadow: 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000; padding: 4px 0; border-radius: 3px; }
.mos-ic canvas { width: 48px; height: 48px; image-rendering: pixelated; display: block; margin: 0 auto 2px; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.5)); }
.mos-ic:hover { background: rgba(255,255,255,0.14); }
.mos-ic.new::after { content: '!'; position: relative; top: -64px; left: 22px; background: #e8483a; color: #fff; font: 700 11px 'Silkscreen', monospace; padding: 0 4px; border-radius: 6px; }
.mos-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 34px; background: #e8e2d4; box-shadow: inset 0 2px 0 #fff, 0 -2px 0 #7a7484; display: flex; align-items: center; gap: 6px; padding: 0 6px; font-size: 13px; }
.mos-start { display: flex; align-items: center; gap: 5px; font: 700 13px 'Silkscreen', monospace; padding: 3px 9px; background: #d8d0c0; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #7a7484; }
.mos-start canvas { width: 20px; height: 20px; image-rendering: pixelated; }
.mos-tabs { display: flex; gap: 4px; flex: 1; overflow: hidden; }
.mos-tab { padding: 3px 10px; background: #d8d0c0; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #7a7484; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
.mos-tab.on { box-shadow: inset 2px 2px 0 #7a7484, inset -2px -2px 0 #fff; background: #cac2b0; }
.mos-tray { display: flex; gap: 10px; align-items: center; padding: 3px 10px; box-shadow: inset 2px 2px 0 #7a7484, inset -2px -2px 0 #fff; }
.mos-tray .wf { color: #a8382a; }
.mos-win { position: absolute; min-width: 260px; background: #f4efe4; box-shadow: 0 0 0 2px #1e1a24, 4px 6px 0 rgba(0,0,0,0.35); display: flex; flex-direction: column; animation: mosWin 0.18s cubic-bezier(.2,1.5,.4,1) both; }
@keyframes mosWin { from { transform: scale(0.92); opacity: 0; } }
.mos-win .tb { display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 8px; background: var(--wc, #3a78c0); color: #fff; font: 700 13px 'Silkscreen', monospace; letter-spacing: 0.04em; }
.mos-win .tb canvas { width: 16px; height: 16px; image-rendering: pixelated; }
.mos-win .tb .tt { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mos-win .tb .x { width: 18px; height: 16px; background: #e8483a; box-shadow: inset 1px 1px 0 #ff8a7a, inset -1px -1px 0 #8a1a10; text-align: center; line-height: 15px; font-size: 11px; }
.mos-win .bd { flex: 1; overflow: auto; padding: 8px 10px; font-size: 14px; line-height: 1.35; }
.mos-win.dark .bd { background: #141018; color: #9dffd8; font-family: 'Silkscreen', monospace; font-size: 12px; }
.xl { border-collapse: collapse; font-size: 13px; }
.xl td, .xl th { border: 1px solid #b8b0a0; padding: 2px 8px; text-align: right; min-width: 52px; }
.xl th { background: #e0d8c4; text-align: center; font-weight: 700; }
.xl td.sel { background: #bfe0ff; box-shadow: inset 0 0 0 2px #3a78c0; }
.xl tr.sum td { font-weight: 700; background: #f8f0d8; }
.fx { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; font-size: 13px; }
.fx b { background: #e0d8c4; padding: 1px 6px; }
.fx span { flex: 1; background: #fff; padding: 1px 6px; box-shadow: inset 1px 1px 0 #7a7484; }
.rp label { display: block; margin: 7px 0 2px; font-weight: 700; color: #3a2614; }
.rp select, .rp input { font: inherit; font-size: 14px; color: #1e1a24; min-width: 120px; padding: 2px 6px; border: 0; box-shadow: inset 1px 1px 0 #7a7484, inset -1px -1px 0 #fff; background: #fff; }
.rp .bad { box-shadow: 0 0 0 2px #e8483a; }
.rp .ok { box-shadow: 0 0 0 2px #4ab04a; }
.rp .tip { color: #a8382a; font-size: 12px; min-height: 1em; }
.rp .thumbs { display: flex; gap: 8px; }
.rp .thumbs canvas { width: 96px; height: 64px; image-rendering: pixelated; box-shadow: 0 0 0 2px #7a7484; }
.rp .thumbs canvas.on { box-shadow: 0 0 0 3px #3a78c0; }
.mbtn { font: 700 13px 'Silkscreen', monospace; padding: 4px 12px; background: #d8d0c0; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #7a7484; border: 0; margin-top: 10px; }
.mbtn:active { box-shadow: inset 2px 2px 0 #7a7484, inset -2px -2px 0 #fff; }
.mbtn.go { background: #5aa447; color: #fff; box-shadow: inset 2px 2px 0 #8ad870, inset -2px -2px 0 #2a6a1a; }
.done-stamp { margin-top: 10px; padding: 8px; background: #e0f4d8; box-shadow: 0 0 0 2px #4ab04a; color: #2a6a1a; font-weight: 700; }
.gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.gal figure { margin: 0; background: #fff; padding: 4px 4px 2px; box-shadow: 0 0 0 1px #b8b0a0, 2px 2px 0 rgba(0,0,0,0.15); }
.gal canvas, .gal img { width: 100%; image-rendering: pixelated; display: block; }
.gal figcaption { font-size: 11px; color: #5a4a3a; padding-top: 2px; }
.big canvas, .big img { width: 100%; image-rendering: pixelated; }
.disc { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px dashed #c8c0b0; }
.disc canvas { width: 48px; height: 48px; image-rendering: pixelated; background: #e8f0f4; flex: none; box-shadow: 0 0 0 1px #b8b0a0; }
.disc b { color: #2f6b2a; } .disc i { color: #7a6a58; font-size: 12px; }
.disc.lock { opacity: 0.55; } .disc.lock canvas { filter: brightness(0); opacity: 0.4; }
.fl { display: flex; flex-direction: column; gap: 2px; }
.fl div { padding: 2px 6px; display: flex; gap: 6px; align-items: center; }
.fl div:hover { background: #bfe0ff; }
.fl canvas { width: 16px; height: 16px; image-rendering: pixelated; }
.np { white-space: pre-wrap; font-family: 'Pixelify Sans', monospace; font-size: 14px; background: #fff; padding: 8px; box-shadow: inset 1px 1px 0 #7a7484; min-height: 100%; box-sizing: border-box; }
.term { white-space: pre-wrap; }
.term input { background: transparent; border: 0; color: #9dffd8; font: inherit; outline: none; width: 70%; }
.pk { position: relative; }
.pk canvas { width: 100%; image-rendering: pixelated; display: block; }
.pk .bins { display: flex; gap: 6px; margin-top: 6px; }
.pk .bins button { flex: 1; font: 700 12px 'Silkscreen', monospace; padding: 6px; border: 0; background: #d8d0c0; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #7a7484; }
`;

let styled = false;

// ------------------------------------------------------------------ pixel helpers

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
function grid(g: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x0 = 0, y0 = 0) {
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); } } });
}
function R(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function E(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number) => string | null)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const v = typeof c === 'string' ? c : c(nx, ny);
    if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); }
  }
}
function outline(g: CanvasRenderingContext2D, w: number, h: number, col = '#1a1014') {
  const d = g.getImageData(0, 0, w, h);
  const src = d.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  const [r, gg, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (op(x, y)) continue;
    if (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1)) { const i = (y * w + x) * 4; d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = 255; }
  }
  g.putImageData(d, 0, 0);
}

/** the fat pug cursor: a chunky pug head with the pointer tip at its nose (top-left) */
function pugCursor(): string {
  const c = canvas(30, 30, g => {
    // pointer tip
    g.fillStyle = '#e4b87c';
    g.beginPath(); g.moveTo(2, 2); g.lineTo(13, 7); g.lineTo(7, 13); g.closePath(); g.fill();
    // head
    E(g, 16, 16, 11, 10, (nx, ny) => (nx + ny < -0.7 ? '#f4d49c' : ny > 0.55 ? '#c49058' : '#e4b87c'));
    // ears
    E(g, 7.5, 9, 3.2, 3.6, '#3e2c2a'); E(g, 25, 9, 3.2, 3.6, '#3e2c2a');
    // muzzle, nose, tongue
    E(g, 16, 20.5, 6, 4.2, '#3e2c2a'); R(g, 14, 18, 4, 2, '#140c0c'); R(g, 15, 23, 3, 3, '#f07a90');
    // big ringed eyes
    for (const ex of [11, 21]) { E(g, ex, 14, 3.2, 3.2, '#ffffff'); E(g, ex, 14, 2, 2, '#1a1012'); R(g, ex - 1, 13, 1, 1, '#ffffff'); }
    // forehead wrinkle
    R(g, 14, 9, 5, 1, '#c49058');
    outline(g, 30, 30, '#2e1c16');
  });
  return `url(${c.toDataURL()})`;
}

// desktop icons (16x16 grids)
const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  report: { rows: ['..wwwwwwwwww....', '..wbbbbbbbbw....', '..wwwwwwwwww....', '..wkkkkkkkkw....', '..wwwwwwwwww....', '..wkkkkkkkw.....', '..wwwwwwwwww....', '..wkkkkkkkkw....', '..wwwwwwwwww....', '..wkkkkkw.......', '..wwwwwwwwww....', '..wgggwwwwww....', '..wgggwwwwww....', '..wwwwwwwwww....', '................', '................'], pal: { w: '#f4efe4', b: '#3a78c0', k: '#7a7484', g: '#5aa447' } },
  sheet: { rows: ['gggggggggggggg..', 'gwwwwgwwwwgwww..', 'gwwwwgwwwwgwww..', 'gggggggggggggg..', 'gwwwwgwwwwgwww..', 'gwwwwgwwbbgwww..', 'gggggggggggggg..', 'gwwwwgwbbbgwww..', 'gwwwwgwbbbgwbb..', 'gggggggggggggg..', 'gwwbbgwbbbgwbb..', 'gwwbbgwbbbgwbb..', 'gggggggggggggg..', '................', '................', '................'], pal: { g: '#2a7a3a', w: '#f4efe4', b: '#5aa447' } },
  photo: { rows: ['................', '..kkkk..........', '.kkkkkkkkkkkkkk.', '.kwwwwwwwwwwwwk.', '.kwsssssssssswk.', '.kwsssssssyysk..', '.kwssssssssyswk.', '.kwsssmmsssssswk', '.kwssmmmmssmmswk', '.kwsmmmmmmmmmmwk', '.kwggggggggggwk.', '.kwwwwwwwwwwwwk.', '.kkkkkkkkkkkkkk.', '................', '................', '................'], pal: { k: '#2a2630', w: '#f4efe4', s: '#8ac8e8', y: '#ffd84a', m: '#5a8a4a', g: '#3a6a3a' } },
  disc: { rows: ['................', '....bbbbbb......', '...bwwwwwwb.....', '..bwwgggwwwb....', '..bwgggggwwb....', '..bwggkgggwb....', '..bwgggggwwb....', '..bwwgggwwwb....', '...bwwwwwwbb....', '....bbbbbb.bb...', '............bb..', '.............bb.', '..............b.', '................', '................', '................'], pal: { b: '#6a4a2a', w: '#d8f0f8', g: '#5aa447', k: '#1a1014' } },
  folder: { rows: ['................', '.yyyyy..........', 'yYYYYYyyyyyyyyy.', 'yYYYYYYYYYYYYYy.', 'yyyyyyyyyyyyyyyy', 'yYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', 'yyyyyyyyyyyyyyyy', '................', '................', '................', '................'], pal: { y: '#c8901a', Y: '#f0c040' } },
  game: { rows: ['................', '....cccccc......', '...cwwwwwwc.....', '..cwwgwwwwwc....', '..cwgggwwrwc....', '..cwwgwwrwrc....', '..cwwwwwwrwc....', '..cwwwwwwwwc....', '...cwwwwwwc.....', '....cccccc......', '......cc........', '.....cccc.......', '................', '................', '................', '................'], pal: { c: '#3a9a9a', w: '#d8f4f4', g: '#5aa447', r: '#e8483a' } },
  term: { rows: ['kkkkkkkkkkkkkkkk', 'kddddddddddddddk', 'kdgddddddddddddk', 'kddgdddddddddddk', 'kdgddggggddddddk', 'kddddddddddddddk', 'kddddddddddddddk', 'kddddddddddddddk', 'kddddddddddddddk', 'kkkkkkkkkkkkkkkk', '......kkkk......', '....kkkkkkkk....', '................', '................', '................', '................'], pal: { k: '#2a2630', d: '#141018', g: '#9dffd8' } },
  bin: { rows: ['................', '....kkkkkk......', '..kkkkkkkkkk....', '...kwwwwwwk.....', '...kwkwkwkk.....', '...kwkwkwkk.....', '...kwkwkwkk.....', '...kwkwkwkk.....', '...kwkwkwkk.....', '...kwwwwwwk.....', '....kkkkkk......', '................', '................', '................', '................', '................'], pal: { k: '#5a5a64', w: '#c8c8d0' } },
  doc: { rows: ['..wwwwwww.......', '..wkkkkkww......', '..wwwwwwwww.....', '..wkkkkkkkw.....', '..wwwwwwwww.....', '..wkkkkkkkw.....', '..wwwwwwwww.....', '..wkkkkw..w.....', '..wwwwwwwww.....', '................', '................', '................', '................', '................', '................', '................'], pal: { w: '#f4efe4', k: '#7a7484' } },
  lock: { rows: ['.....kkkk.......', '....k....k......', '....k....k......', '...yyyyyyyy.....', '...yYYYYYYy.....', '...yYYkkYYy.....', '...yYYkkYYy.....', '...yYYYYYYy.....', '...yyyyyyyy.....', '................', '................', '................', '................', '................', '................', '................'], pal: { k: '#7a7484', y: '#c8901a', Y: '#f0c040' } },
};
function icon(name: string, scale = 1): HTMLCanvasElement {
  const d = ICONS[name] ?? ICONS.doc;
  return canvas(16 * scale, 16 * scale, g => { g.scale(scale, scale); grid(g, d.rows, d.pal); });
}

// ------------------------------------------------------------------ fake photos (pixel art)

type PhotoKind = 'albatross' | 'dolphins' | 'sunset' | 'jennaSleep' | 'joshuFish' | 'chunkBucket' | 'chunkFace' | 'blurry' | 'butt';
function photo(kind: PhotoKind, w = 96, h = 64): HTMLCanvasElement {
  return canvas(w, h, g => {
    const sky = (top: string, bot: string) => { for (let y = 0; y < h; y++) { const t = y / h; g.fillStyle = t < 0.5 ? top : bot; g.fillRect(0, y, w, 1); } };
    if (kind === 'albatross' || kind === 'blurry') {
      sky('#8ac8e8', '#b8e0f0'); R(g, 0, 46, w, 18, '#3a7a9a'); R(g, 0, 46, w, 1, '#bfe6ff');
      const cx = 48, cy = 24;
      for (let i = -26; i <= 26; i++) { const y = cy + Math.abs(i) * 0.25 - Math.cos(i * 0.12) * 2; R(g, cx + i, Math.round(y), 1, 2, Math.abs(i) > 16 ? '#2a2630' : '#f4efe4'); }
      E(g, cx, cy + 1, 6, 3, '#f4efe4'); R(g, cx + 5, cy, 4, 1, '#e8c060');
      if (kind === 'blurry') { g.globalAlpha = 0.35; g.drawImage(g.canvas, 4, 1); g.drawImage(g.canvas, -3, 2); g.globalAlpha = 1; }
    } else if (kind === 'dolphins') {
      sky('#9ad0e8', '#c8e8f4'); R(g, 0, 40, w, 24, '#2a6a8a');
      for (const [x, y, s] of [[28, 30, 1], [58, 26, -1]] as const) {
        for (let i = -9; i <= 9; i++) R(g, x + i * s, Math.round(y + (i * i) * 0.09), 1, 4, i < -6 ? '#5a6a7a' : '#7a8a9a');
        R(g, x + 9 * s, y + 5, 2, 1, '#5a6a7a');
      }
      for (let i = 0; i < 12; i++) R(g, 20 + i * 5, 41 + (i % 2), 3, 1, '#ffffff');
    } else if (kind === 'sunset') {
      for (let y = 0; y < h; y++) { const t = y / 42; g.fillStyle = y < 42 ? `rgb(${240 - t * 60},${140 - t * 60},${90 + t * 40})` : '#3a2a4a'; g.fillRect(0, y, w, 1); }
      E(g, 62, 38, 9, 9, '#ffd87a');
      R(g, 0, 42, w, 22, '#3a2a4a');
      for (let i = 0; i < 20; i++) R(g, 50 + Math.random() * 24, 44 + i, 4, 1, '#e8a060');
      R(g, 14, 36, 30, 7, '#2a1c28'); R(g, 20, 28, 12, 8, '#2a1c28'); R(g, 26, 16, 1, 12, '#2a1c28');
    } else if (kind === 'jennaSleep') {
      R(g, 0, 0, w, h, '#2a2440'); R(g, 10, 36, 76, 28, '#3a3640');
      R(g, 20, 14, 26, 18, '#e070b8'); R(g, 50, 14, 26, 18, '#4ac8e8');
      E(g, 48, 40, 14, 9, '#f472b0'); E(g, 40, 46, 6, 4, '#fcd8c2');
      for (let i = 0; i < 3; i++) R(g, 70 + i * 5, 26 - i * 5, 3, 3, '#ffffff');
    } else if (kind === 'joshuFish') {
      sky('#8ac8e8', '#b8e0f0'); R(g, 0, 48, w, 16, '#6e4c32');
      E(g, 40, 32, 9, 14, '#e2d6b8'); E(g, 40, 16, 6, 6, '#f0b494'); R(g, 34, 10, 12, 3, '#2c3a5a'); E(g, 40, 22, 6, 5, '#dedad2');
      E(g, 66, 34, 18, 7, (nx, ny) => (ny < 0 ? '#3a9a9a' : '#e8e2d4')); R(g, 82, 28, 6, 12, '#3a9a9a'); R(g, 54, 32, 2, 2, '#1a1014');
    } else if (kind === 'chunkBucket' || kind === 'chunkFace' || kind === 'butt') {
      R(g, 0, 0, w, h, kind === 'chunkFace' ? '#5a4632' : '#8ac8e8');
      if (kind === 'chunkBucket') {
        R(g, 0, 50, w, 14, '#6e4c32');
        g.fillStyle = '#e8b840'; g.beginPath(); g.moveTo(28, 30); g.lineTo(68, 30); g.lineTo(64, 58); g.lineTo(32, 58); g.fill();
        E(g, 48, 26, 13, 11, '#e4b87c'); E(g, 48, 30, 7, 5, '#3e2c2a'); E(g, 42, 24, 3, 3, '#ffffff'); E(g, 54, 24, 3, 3, '#ffffff'); R(g, 42, 24, 2, 2, '#1a1012'); R(g, 54, 24, 2, 2, '#1a1012'); R(g, 47, 33, 3, 3, '#f07a90');
      } else if (kind === 'chunkFace') {
        E(g, 48, 34, 30, 26, '#e4b87c'); E(g, 48, 42, 16, 12, '#3e2c2a'); E(g, 34, 28, 8, 8, '#ffffff'); E(g, 62, 28, 8, 8, '#ffffff'); E(g, 34, 28, 5, 5, '#1a1012'); E(g, 62, 28, 5, 5, '#1a1012'); R(g, 45, 50, 6, 8, '#f07a90');
        E(g, 18, 12, 8, 7, '#3e2c2a'); E(g, 78, 12, 8, 7, '#3e2c2a');
      } else {
        R(g, 0, 48, w, 16, '#6e4c32');
        E(g, 48, 34, 22, 16, '#e0463a'); E(g, 30, 36, 8, 10, '#e4b87c'); E(g, 30, 30, 4, 4, '#e4b87c'); E(g, 30, 28, 2.5, 2.5, '#c49058');
      }
    }
  });
}

// ------------------------------------------------------------------ data

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BIRDS = ['Albatross', 'Petrel', 'Gull', 'Shearwater'];
const COUNTS = [
  [3, 7, 12, 9], [4, 6, 10, 14], [2, 9, 8, 11], [5, 5, 14, 10], [3, 8, 11, 15], [4, 10, 9, 12], [6, 7, 13, 16],
];
const TEMP = [14.2, 14.0, 13.7, 13.5, 13.1, 12.9, 12.4];
const sumCol = (i: number) => COUNTS.reduce((a, r) => a + r[i], 0);

const FILES: { path: string; name: string; text: string; lock?: boolean }[] = [
  { path: 'Documents', name: 'chunk_diet_plan_FINAL_v7_REAL.docx', text: 'CHUNK DIET PLAN (v7)\n\nBreakfast: 1/2 cup kibble\nLunch: nothing (he will beg, stay strong)\nDinner: 1/2 cup kibble\nTreats: ONE biscuit per day\n\nStatus: failed on day 1 (noodles?? how)\nStatus: failed on day 2 (Joshu)\nStatus: failed on day 3 (Jenna, "he looked sad")' },
  { path: 'Documents', name: 'thesis_draft_47.doc', text: 'Chapter 1: Introduction\n\nSeabirds of the Southern Ocean are\n\n[the rest of this page is blank. It has been blank for eight months.]' },
  { path: 'Documents', name: 'packing_list.txt', text: 'Camera (x2)\nSpare batteries (x9)\nField notebooks\nNoodles (x80)\nMore noodles\nChunk\'s puffer jacket (he gets COLD)\nChunk\'s backup puffer jacket\nToothbrush?' },
  { path: 'Music', name: 'whale_songs_vol2.mp3', text: '♪ ooOOOOoooo... wuuuuuhhh... ooOOooo ♪\n\n(Jenna says it\'s "the most relaxing thing she\'s ever heard" and then fell asleep on her keyboard.)' },
  { path: 'Music', name: 'joshu_sea_shanties_live.wav', text: 'Recorded at 2 a.m. in the galley.\nContains 14 verses of "The Wellerman" and one verse about his knee.' },
  { path: 'Downloads', name: 'how_to_tie_a_bowline.pdf', text: 'The rabbit comes out of the hole, goes around the tree, and back down the hole.\n\n(Joshu wrote underneath: "THE RABBIT IS NOT THE POINT, DOC")' },
  { path: 'Jenna\'s Stuff', name: 'fishcount_ai.py', text: '# fish counter v3 "Captain Count"\n# counts: birds, fish, clouds (mostly not clouds)\n# known bug: classifies Chunk as potato (0.93 confidence)\n\ndef count(frame):\n    return vibes(frame) * 1.0  # TODO: real math', lock: true },
  { path: 'Jenna\'s Stuff', name: 'definitely_not_a_diary.txt', text: 'Day 23: Dad made pancakes shaped like fish. Mori said they were "anatomically incorrect" and ate four. Chunk stole one. Best day of the trip so far. (Don\'t tell them I wrote this.)', lock: true },
];

// ------------------------------------------------------------------ OS

interface Win { el: HTMLElement; id: string; tab: HTMLElement }

export async function openMoriOS(o: { report: boolean }): Promise<void> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const wrap = el('div', 'mos-wrap');
  wrap.innerHTML = `<div class="mos-lap"><div class="mos-scr"><canvas class="mos-wall" width="320" height="180"></canvas><div class="mos-icons"></div><div class="mos-wins"></div>
    <div class="mos-bar"><div class="mos-start"></div><div class="mos-tabs"></div><div class="mos-tray"><span class="wf" title="No internet: middle of the ocean">✕ Wi-Fi</span><span>▮▮▮ 87%</span><span class="clk"></span></div></div></div></div>`;
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  audio.play('uiOpen', { vol: 0.6 });
  const scr = wrap.querySelector('.mos-scr') as HTMLElement;
  scr.style.setProperty('--pug', pugCursor());
  const wins = wrap.querySelector('.mos-wins') as HTMLElement;
  const tabs = wrap.querySelector('.mos-tabs') as HTMLElement;
  const start = wrap.querySelector('.mos-start') as HTMLElement;
  start.appendChild(canvas(16, 16, g => {
    E(g, 8, 8.5, 6.5, 6, '#e4b87c'); E(g, 3.5, 4, 2, 2, '#3e2c2a'); E(g, 12.5, 4, 2, 2, '#3e2c2a'); E(g, 8, 10.5, 3.4, 2.4, '#3e2c2a');
    R(g, 5, 7, 2, 2, '#1a1012'); R(g, 9, 7, 2, 2, '#1a1012'); R(g, 7, 12, 2, 2, '#f07a90');
  }));
  start.appendChild(document.createTextNode('MoriOS'));
  const clk = wrap.querySelector('.clk') as HTMLElement;
  let open: Win[] = [];
  let zTop = 10;
  let closed = false;

  // ---- animated nature wallpaper: dusk sea, drifting clouds, a whale tail rising and diving, birds
  const wall = wrap.querySelector('.mos-wall') as HTMLCanvasElement;
  const wg = wall.getContext('2d')!;
  wg.imageSmoothingEnabled = false;
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 60 + Math.random() * 40, y: 12 + Math.random() * 40, w: 26 + Math.random() * 30, v: 1.5 + Math.random() * 2 }));
  const birds = Array.from({ length: 5 }, () => ({ x: Math.random() * 320, y: 20 + Math.random() * 50, v: 8 + Math.random() * 10, ph: Math.random() * 6 }));
  let wt = 0, last = performance.now();
  const drawWall = () => {
    if (closed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    wt += dt;
    for (let y = 0; y < 180; y++) {
      const t = y / 110;
      const r = y < 110 ? Math.round(250 - t * 120) : 40, g = y < 110 ? Math.round(170 - t * 90) : 60, b = y < 110 ? Math.round(120 + t * 60) : 96;
      wg.fillStyle = `rgb(${r},${g},${b})`;
      wg.fillRect(0, y, 320, 1);
    }
    E(wg, 230, 100, 18, 18, '#ffe0a0');
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > 340) c.x = -c.w - 10;
      E(wg, c.x, c.y, c.w / 2, 5, 'rgba(255,230,220,0.85)');
      E(wg, c.x + c.w * 0.2, c.y - 3, c.w / 4, 4, 'rgba(255,240,230,0.9)');
    }
    // distant island
    E(wg, 70, 110, 44, 9, '#3a3050');
    E(wg, 80, 104, 16, 8, '#3a3050');
    // sea with shimmering sun path
    for (let y = 110; y < 180; y++) {
      wg.fillStyle = y % 4 === 0 ? '#34506e' : '#2a4260';
      wg.fillRect(0, y, 320, 1);
      const k = (y - 110) / 70;
      for (let i = 0; i < 3; i++) {
        const x = 230 + Math.sin(wt * 1.5 + y * 0.9 + i * 2) * (8 + k * 30);
        wg.fillStyle = 'rgba(255,220,160,0.7)';
        wg.fillRect(Math.round(x), y, 4 + Math.round(k * 6), 1);
      }
    }
    // whale tail: rises, holds, dives (12 s cycle)
    const ph = (wt % 12) / 12;
    const up = ph < 0.15 ? ph / 0.15 : ph < 0.45 ? 1 : ph < 0.6 ? 1 - (ph - 0.45) / 0.15 : 0;
    if (up > 0) {
      const bx = 150, by = 128 - up * 14;
      wg.fillStyle = '#1e2a3a';
      wg.fillRect(bx - 2, by + 6, 5, 16 * up);
      wg.beginPath(); wg.moveTo(bx, by + 8); wg.lineTo(bx - 14, by - 2); wg.lineTo(bx - 9, by + 3); wg.lineTo(bx, by + 4); wg.lineTo(bx + 9, by + 3); wg.lineTo(bx + 14, by - 2); wg.closePath(); wg.fill();
      if (ph > 0.4 && ph < 0.5) for (let i = 0; i < 8; i++) { wg.fillStyle = '#e8f4ff'; wg.fillRect(bx - 12 + Math.random() * 24, by - 2 + Math.random() * 10, 1, 1); }
    }
    for (const b of birds) {
      b.x += b.v * dt;
      if (b.x > 330) { b.x = -10; b.y = 20 + Math.random() * 50; }
      const f = Math.sin(wt * 8 + b.ph) > 0 ? 1 : 0;
      wg.fillStyle = '#2a2230';
      wg.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
      wg.fillRect(Math.round(b.x) - 2, Math.round(b.y) - f, 2, 1);
      wg.fillRect(Math.round(b.x) + 1, Math.round(b.y) - f, 2, 1);
    }
    clk.textContent = `${String(8 + Math.floor(game.time / 60) % 4).padStart(2, '0')}:${String(Math.floor(game.time) % 60).padStart(2, '0')}`;
    requestAnimationFrame(drawWall);
  };
  requestAnimationFrame(drawWall);

  // ---- windows
  const focus = (w: Win) => { w.el.style.zIndex = String(++zTop); tabs.querySelectorAll('.mos-tab').forEach(t => t.classList.remove('on')); w.tab.classList.add('on'); };
  const closeWin = (w: Win) => { w.el.remove(); w.tab.remove(); open = open.filter(x => x !== w); audio.play('uiBack', { vol: 0.4 }); };
  const win = (id: string, title: string, ic: string, color: string, w: number, h: number, body: HTMLElement | string, dark = false): Win | null => {
    const ex = open.find(x => x.id === id);
    if (ex) { focus(ex); return null; }
    const e = el('div', 'mos-win' + (dark ? ' dark' : ''));
    const n = open.length;
    e.style.cssText = `left:${120 + n * 26}px;top:${22 + n * 20}px;width:${w}px;height:${h}px;--wc:${color}`;
    e.innerHTML = `<div class="tb"><span class="ic"></span><span class="tt">${title}</span><span class="x">✕</span></div><div class="bd"></div>`;
    (e.querySelector('.ic') as HTMLElement).appendChild(icon(ic));
    const bd = e.querySelector('.bd') as HTMLElement;
    if (typeof body === 'string') bd.innerHTML = body; else bd.appendChild(body);
    wins.appendChild(e);
    const tab = el('div', 'mos-tab', title);
    tabs.appendChild(tab);
    const W: Win = { el: e, id, tab };
    open.push(W);
    focus(W);
    audio.play('ui', { vol: 0.4 });
    tab.addEventListener('pointerdown', () => focus(W));
    e.addEventListener('pointerdown', () => focus(W));
    (e.querySelector('.x') as HTMLElement).addEventListener('pointerdown', ev => { ev.stopPropagation(); closeWin(W); });
    // drag by the title bar
    const tb = e.querySelector('.tb') as HTMLElement;
    tb.addEventListener('pointerdown', ev => {
      if ((ev.target as HTMLElement).classList.contains('x')) return;
      const sr = scr.getBoundingClientRect();
      const ox = ev.clientX - e.offsetLeft, oy = ev.clientY - e.offsetTop;
      const mv = (m: PointerEvent) => { e.style.left = Math.max(-w + 60, Math.min(sr.width - 60, m.clientX - ox)) + 'px'; e.style.top = Math.max(0, Math.min(sr.height - 60, m.clientY - oy)) + 'px'; };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    // keep windows inside smaller screens
    requestAnimationFrame(() => {
      const sr = scr.getBoundingClientRect();
      if (e.offsetLeft + e.offsetWidth > sr.width) e.style.left = Math.max(4, sr.width - e.offsetWidth - 8) + 'px';
      if (e.offsetTop + e.offsetHeight > sr.height - 36) { e.style.top = '4px'; e.style.height = Math.min(h, sr.height - 44) + 'px'; }
      if (e.offsetWidth > sr.width) e.style.width = sr.width - 8 + 'px';
    });
    return W;
  };

  // ---- apps
  const apps: Record<string, () => void> = {
    sheet: () => {
      const b = el('div');
      b.innerHTML = `<div class="fx"><b class="ref">B2</b><span class="val"></span></div>`;
      const t = el('table', 'xl');
      t.innerHTML = `<tr><th></th>${BIRDS.map(x => `<th>${x}</th>`).join('')}<th>Water °C</th></tr>` +
        COUNTS.map((r, i) => `<tr><th>${DAYS[i]}</th>${r.map((v, j) => `<td data-v="${v}" data-f="${v}" data-r="${String.fromCharCode(66 + j)}${i + 2}">${v}</td>`).join('')}<td data-v="${TEMP[i]}" data-f="${TEMP[i]}" data-r="F${i + 2}">${TEMP[i].toFixed(1)}</td></tr>`).join('') +
        `<tr class="sum"><th>SUM</th>${BIRDS.map((_, j) => `<td data-v="?" data-f="=SUM(${String.fromCharCode(66 + j)}2:${String.fromCharCode(66 + j)}8)" data-r="${String.fromCharCode(66 + j)}9">?</td>`).join('')}<td data-f="(average)" data-v="?" data-r="F9">?</td></tr>`;
      b.appendChild(t);
      const chart = canvas(220, 90, g => {
        R(g, 0, 0, 220, 90, '#ffffff');
        for (let i = 0; i < 5; i++) R(g, 20, 10 + i * 17, 195, 1, '#e8e0d0');
        g.strokeStyle = '#e8483a'; g.lineWidth = 2; g.beginPath();
        TEMP.forEach((v, i) => { const x = 26 + i * 30, y = 10 + (14.4 - v) * 32; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
        TEMP.forEach((v, i) => R(g, 24 + i * 30, 8 + (14.4 - v) * 32, 4, 4, '#a8382a'));
        g.fillStyle = '#5a4a3a'; g.font = '9px monospace'; DAYS.forEach((d, i) => g.fillText(d, 18 + i * 30, 88));
        g.fillText('°C', 2, 12);
      });
      chart.style.cssText = 'width:440px;max-width:100%;image-rendering:pixelated;margin-top:8px;box-shadow:0 0 0 1px #b8b0a0';
      const cap = el('div', '', '<b>Chart:</b> water temperature this week');
      cap.style.cssText = 'font-size:12px;margin-top:8px';
      b.appendChild(cap);
      b.appendChild(chart);
      const ref = b.querySelector('.ref') as HTMLElement, val = b.querySelector('.val') as HTMLElement;
      t.addEventListener('pointerdown', ev => {
        const td = (ev.target as HTMLElement).closest('td') as HTMLElement | null;
        if (!td) return;
        t.querySelectorAll('td.sel').forEach(x => x.classList.remove('sel'));
        td.classList.add('sel');
        ref.textContent = td.dataset.r ?? '';
        val.textContent = td.dataset.f ?? '';
        // SUM cells compute when clicked (Mori has to actually look)
        if (td.dataset.v === '?') {
          const j = (td.dataset.r ?? 'B').charCodeAt(0) - 66;
          td.textContent = j < 4 ? String(sumCol(j)) : (TEMP.reduce((a, v) => a + v, 0) / TEMP.length).toFixed(1);
          td.dataset.v = td.textContent;
          audio.play('scanBeep', { vol: 0.3 });
        }
      });
      win('sheet', 'seabird_survey_wk3.xls', 'sheet', '#2a7a3a', 560, 440, b);
    },
    report: () => {
      const b = el('div', 'rp');
      if (game.save.flags['v4:report']) {
        b.innerHTML = `<b>Morning Report · Day 23</b><div class="done-stamp">✓ Submitted. It will upload to the university the moment we have signal. (In about three weeks.)</div>`;
        win('report', 'morning_report_day23.doc', 'report', '#3a78c0', 460, 220, b);
        return;
      }
      if (!o.report) {
        b.innerHTML = `<b>Morning Report · Day 23</b><p>Template ready. Needs today’s rounds first: fish fed, engine checked, captain and Jenna checked on.</p><p><i>(Mori’s rule: no fiction in the data.)</i></p>`;
        win('report', 'morning_report_day23.doc', 'report', '#3a78c0', 460, 240, b);
        return;
      }
      b.innerHTML = `<b>Morning Report · Day 23 · RV Kittiwake</b>
        <label>1. Most sighted seabird this week</label><select class="q1"><option value="">(choose)</option>${BIRDS.map(x => `<option>${x}</option>`).join('')}</select><div class="tip t1"></div>
        <label>2. Total albatross sightings this week</label><input class="q2" type="number" min="0" max="999" style="width:80px"><div class="tip t2"></div>
        <label>3. Water temperature trend</label><select class="q3"><option value="">(choose)</option><option>Rising</option><option>Falling</option><option>Steady</option></select><div class="tip t3"></div>
        <label>4. Photo of the day</label><div class="thumbs"></div><div class="tip t4"></div>
        <button class="mbtn go">Submit report</button><div class="out"></div>`;
      const th = b.querySelector('.thumbs') as HTMLElement;
      let pick = -1;
      const kinds: PhotoKind[] = ['butt', 'albatross', 'blurry'];
      kinds.forEach((k, i) => {
        const c = photo(k);
        c.title = ['Chunk’s behind', 'Albatross in flight', 'Something blurry'][i];
        c.addEventListener('pointerdown', () => { pick = i; th.querySelectorAll('canvas').forEach((x, j) => x.classList.toggle('on', j === i)); });
        th.appendChild(c);
      });
      (b.querySelector('.go') as HTMLElement).addEventListener('pointerdown', () => {
        const q1 = (b.querySelector('.q1') as HTMLSelectElement), q2 = (b.querySelector('.q2') as HTMLInputElement), q3 = (b.querySelector('.q3') as HTMLSelectElement);
        const ok1 = q1.value === 'Shearwater', ok2 = +q2.value === sumCol(0), ok3 = q3.value === 'Falling', ok4 = pick === 1;
        q1.className = 'q1 ' + (ok1 ? 'ok' : 'bad'); q2.className = 'q2 ' + (ok2 ? 'ok' : 'bad'); q3.className = 'q3 ' + (ok3 ? 'ok' : 'bad');
        (b.querySelector('.t1') as HTMLElement).textContent = ok1 ? '' : 'Check the spreadsheet: click the SUM row to total each column.';
        (b.querySelector('.t2') as HTMLElement).textContent = ok2 ? '' : 'Add up the Albatross column (or click its SUM cell).';
        (b.querySelector('.t3') as HTMLElement).textContent = ok3 ? '' : 'Look at the temperature chart in the spreadsheet.';
        (b.querySelector('.t4') as HTMLElement).textContent = ok4 ? '' : pick === 0 ? 'The university will not accept Chunk’s behind. Again.' : 'Pick the one with an actual bird in it.';
        if (ok1 && ok2 && ok3 && ok4) {
          audio.play('discover', { vol: 0.6 });
          game.save.flags['v4:report'] = true;
          game.persist();
          (b.querySelector('.out') as HTMLElement).innerHTML = `<div class="done-stamp">✓ Report complete! Shearwaters lead the week, ${sumCol(0)} albatross, and the water is cooling fast. Cooling fast... huh. Might mention that to Joshu.</div>`;
          (b.querySelector('.go') as HTMLElement).remove();
        } else audio.play('wrong', { vol: 0.4 });
      });
      win('report', 'morning_report_day23.doc', 'report', '#3a78c0', 480, 470, b);
    },
    photos: () => {
      const b = el('div');
      const gal = el('div', 'gal');
      const list: [PhotoKind, string][] = [['albatross', 'Wandering albatross, day 20. 3.1 m wingspan!'], ['dolphins', 'Hector’s dolphins riding the bow wave'], ['sunset', 'The Kittiwake at sunset (Jenna took this one)'], ['jennaSleep', 'Jenna, asleep on her keyboard at 3 a.m. "zzzzzzzzzzzzzzzz" x 4000'], ['joshuFish', 'Joshu and The Fish That Was Bigger Last Time He Told It'], ['chunkBucket', 'Chunk in a bucket. He chose this.'], ['chunkFace', 'Chunk, 5 a.m., 2 cm from my face']];
      for (const [k, c] of list) {
        const f = el('figure');
        f.appendChild(photo(k));
        f.appendChild(el('figcaption', '', c));
        f.addEventListener('pointerdown', () => {
          const big = el('div', 'big');
          big.appendChild(photo(k, 192, 128));
          big.appendChild(el('p', '', c));
          win('ph:' + k, k + '.png', 'photo', '#6a4a8a', 440, 360, big);
        });
        gal.appendChild(f);
      }
      for (const p of rawPhotos().slice(-8)) {
        const f = el('figure');
        const img = el('img') as HTMLImageElement;
        img.src = p.img;
        f.appendChild(img);
        f.appendChild(el('figcaption', '', 'New today'));
        gal.appendChild(f);
      }
      b.appendChild(gal);
      win('photos', 'Photos', 'photo', '#6a4a8a', 560, 430, b);
    },
    disc: () => {
      const b = el('div');
      const list: [string, string, string, boolean][] = [
        ['Wandering Albatross', 'Diomedea exulans · Toroa', 'Biggest wingspan of any living bird. Can sleep while gliding. Showed off for us on day 20.', true],
        ['Sooty Shearwater', 'Ardenna grisea · Tītī', 'Flies 64,000 km a year in a figure-eight around the Pacific. Most common bird this week.', true],
        ['Hector’s Dolphin', 'Cephalorhynchus hectori · Upokohue', 'One of the smallest dolphins. Rounded dorsal fin like a Mickey Mouse ear.', true],
        ['Blue Maomao', 'Scorpis violacea', 'Schooling reef fish, electric blue. Gerald (tank) is one.', true],
        ['???', 'Not yet observed', 'Something big has been showing up on Jenna’s sonar at night. Probably a whale. Probably.', false],
        ['???', 'Not yet observed', 'Keep your camera ready on deck.', false],
      ];
      for (const [n, sci, t, seen] of list) {
        const d = el('div', 'disc' + (seen ? '' : ' lock'));
        d.appendChild(canvas(24, 24, g => {
          if (n.includes('Albatross')) { for (let i = -10; i <= 10; i++) R(g, 12 + i, 12 + Math.abs(i) * 0.2, 1, 2, Math.abs(i) > 6 ? '#2a2630' : '#f4efe4'); E(g, 12, 13, 3, 2, '#f4efe4'); }
          else if (n.includes('Shearwater')) { for (let i = -9; i <= 9; i++) R(g, 12 + i, 12 - Math.abs(i) * 0.3, 1, 2, '#4a4452'); }
          else if (n.includes('Dolphin')) { E(g, 12, 13, 9, 4, '#7a8a9a'); R(g, 10, 7, 3, 4, '#2a2630'); }
          else if (n.includes('Maomao')) { E(g, 12, 12, 8, 5, '#3a78e0'); R(g, 3, 9, 3, 6, '#2a58c0'); R(g, 16, 11, 1, 1, '#1a1014'); }
          else { E(g, 12, 12, 8, 8, '#8a8494'); R(g, 10, 7, 4, 7, '#f4efe4'); R(g, 10, 16, 4, 2, '#f4efe4'); }
        }));
        d.appendChild(el('div', '', `<b>${n}</b><br><i>${sci}</i><br>${t}`));
        b.appendChild(d);
      }
      win('disc', 'Discoveries', 'disc', '#2f6b2a', 480, 440, b);
    },
    files: () => {
      const b = el('div', 'fl');
      let unlocked = false;
      const folders = [...new Set(FILES.map(f => f.path))];
      const render = () => {
        b.innerHTML = '';
        for (const fo of folders) {
          const row = el('div');
          row.appendChild(icon(fo === 'Jenna\'s Stuff' && !unlocked ? 'lock' : 'folder'));
          row.appendChild(el('b', '', fo));
          b.appendChild(row);
          if (fo === 'Jenna\'s Stuff' && !unlocked) {
            const r2 = el('div');
            r2.style.paddingLeft = '28px';
            r2.innerHTML = `<i>Password:</i> <input class="pw" style="width:110px;font:inherit"> <button class="mbtn" style="margin:0">Unlock</button>`;
            (r2.querySelector('button') as HTMLElement).addEventListener('pointerdown', () => {
              const v = (r2.querySelector('.pw') as HTMLInputElement).value.trim().toLowerCase();
              if (v === 'chunk123' || v === 'chunk') { unlocked = true; audio.play('discover', { vol: 0.5 }); render(); }
              else { audio.play('wrong', { vol: 0.4 }); (r2.querySelector('.pw') as HTMLInputElement).value = ''; (r2.querySelector('.pw') as HTMLInputElement).placeholder = 'hint: her favourite dog + 123'; }
            });
            b.appendChild(r2);
            continue;
          }
          for (const f of FILES.filter(x => x.path === fo)) {
            const r = el('div');
            r.style.paddingLeft = '28px';
            r.appendChild(icon('doc'));
            r.appendChild(el('span', '', f.name));
            r.addEventListener('pointerdown', () => { const np = el('div', 'np'); np.textContent = f.text; win('f:' + f.name, f.name, 'doc', '#8a6a4a', 420, 300, np); });
            b.appendChild(r);
          }
        }
      };
      render();
      win('files', 'Files', 'folder', '#c8901a', 440, 400, b);
    },
    plankton: () => {
      const b = el('div', 'pk');
      b.innerHTML = `<div><b>Plankton Sort</b> · sort yesterday’s sample before the slide dries! <span class="sc"></span></div><div class="cvw"></div><div class="bins"><button data-k="0">Copepod</button><button data-k="1">Diatom</button><button data-k="2">Larva</button></div>`;
      const cvw = b.querySelector('.cvw') as HTMLElement;
      const cv = canvas(160, 80, () => {});
      cvw.appendChild(cv);
      const g = cv.getContext('2d')!;
      const sc = b.querySelector('.sc') as HTMLElement;
      let cur = Math.floor(Math.random() * 3), score = 0, miss = 0, left = 25, t0 = performance.now(), over = false;
      const drawSpec = () => {
        R(g, 0, 0, 160, 80, '#d8f0f4');
        E(g, 80, 40, 70, 36, (nx, ny) => (Math.hypot(nx, ny) > 0.96 ? '#1a1014' : '#eaf8f8'));
        if (over) { g.fillStyle = '#1a1014'; g.font = '10px monospace'; g.fillText(`Done! ${score} sorted, ${miss} oops`, 26, 42); return; }
        if (cur === 0) { E(g, 80, 40, 12, 7, '#e8a060'); R(g, 90, 36, 16, 1, '#c87a3a'); R(g, 90, 44, 16, 1, '#c87a3a'); R(g, 60, 39, 8, 1, '#c87a3a'); E(g, 74, 38, 2, 2, '#1a1014'); }
        else if (cur === 1) { for (let i = 0; i < 5; i++) { E(g, 64 + i * 8, 40 + (i % 2) * 3, 4, 6, '#6ac04a'); E(g, 64 + i * 8, 40 + (i % 2) * 3, 2, 3, '#b8f0a0'); } }
        else { E(g, 80, 40, 8, 10, '#f4c8e0'); E(g, 80, 34, 5, 4, '#e090b8'); R(g, 74, 48, 12, 2, '#e090b8'); E(g, 78, 33, 1.5, 1.5, '#1a1014'); E(g, 83, 33, 1.5, 1.5, '#1a1014'); }
      };
      drawSpec();
      const tick = () => {
        if (closed || over || !b.isConnected) return;
        left = 25 - (performance.now() - t0) / 1000;
        sc.textContent = `${Math.max(0, Math.ceil(left))}s · ${score} sorted`;
        if (left <= 0) { over = true; drawSpec(); if (score >= 8 && !game.save.flags['v4:plankton']) { game.save.flags['v4:plankton'] = true; game.save.rp = (game.save.rp ?? 0) + 5; game.persist(); } audio.play('star', { vol: 0.5 }); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      b.querySelectorAll('.bins button').forEach(btn => btn.addEventListener('pointerdown', () => {
        if (over) return;
        if (+(btn as HTMLElement).dataset.k! === cur) { score++; audio.play('collectPop', { vol: 0.35, pitch: 1 + score * 0.03 }); }
        else { miss++; audio.play('wrong', { vol: 0.3 }); }
        cur = Math.floor(Math.random() * 3);
        drawSpec();
      }));
      win('plankton', 'Plankton Sort', 'game', '#3a9a9a', 380, 330, b);
    },
    term: () => {
      const b = el('div', 'term');
      const out = el('div', '', 'JennaShell v0.3 (installed "for emergencies")\ntype "help"\n\n');
      const line = el('div', '', '&gt; <input>');
      b.appendChild(out);
      b.appendChild(line);
      const inp = line.querySelector('input') as HTMLInputElement;
      const cmds: Record<string, string> = {
        help: 'commands: help, whoami, ls, fortune, weather, sudo feed chunk, jenna, joshu, clear',
        whoami: 'mori. marine biologist. noodle enthusiast. owned by a pug.',
        ls: 'thesis_draft_47.doc  noodles/  chunk_photos/ (2,041 files)  DO_NOT_DELETE_jenna_code/',
        weather: 'barometer: FALLING. falling fast. (Jenna: "that\'s probably fine")',
        'sudo feed chunk': 'permission denied: chunk is on a diet (v7).',
        jenna: 'hi mori!!! if you\'re reading this you\'re in my terminal!!! get out!!! (love you, nerd)',
        joshu: 'Joshu does not use computers. Joshu uses the sun, the stars and his knee.',
      };
      const fortunes = ['A pug\'s wrinkles need cleaning every day. Chunk disagrees.', 'Albatrosses can fly for years without landing.', 'The ocean is 94% of the living space on Earth. Chunk is 94% snacks.', 'Sea otters hold hands when they sleep.'];
      setTimeout(() => inp.focus(), 50);
      inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key !== 'Enter') return;
        const v = inp.value.trim().toLowerCase();
        inp.value = '';
        if (v === 'clear') { out.textContent = ''; return; }
        const r = v === 'fortune' ? fortunes[Math.floor(Math.random() * fortunes.length)] : cmds[v] ?? (v ? `${v}: command not found (try "help")` : '');
        out.textContent += `> ${v}\n${r}\n\n`;
        b.scrollTop = b.scrollHeight;
        audio.play('typing', { vol: 0.25 });
      });
      win('term', 'JennaShell', 'term', '#141018', 460, 300, b, true);
    },
    bin: () => {
      const b = el('div', '', `<p>Recycle Bin (2,038 items)</p><div class="gal"></div><p><i>All of them are photos of Chunk. Mori cannot bring himself to empty it.</i></p>`);
      const gal = b.querySelector('.gal') as HTMLElement;
      for (const k of ['chunkFace', 'chunkBucket', 'butt'] as PhotoKind[]) { const f = el('figure'); f.appendChild(photo(k)); gal.appendChild(f); }
      win('bin', 'Recycle Bin', 'bin', '#5a5a64', 420, 330, b);
    },
  };

  // ---- desktop icons
  const iconsEl = wrap.querySelector('.mos-icons') as HTMLElement;
  const desk: [string, string, string, boolean?][] = [
    ['report', 'Reports', 'report', o.report && !game.save.flags['v4:report']], ['sheet', 'Spread-sheets', 'sheet'], ['photos', 'Photos', 'photo'],
    ['disc', 'Discoveries', 'disc'], ['files', 'Files', 'folder'], ['plankton', 'Plankton Sort', 'game'], ['term', 'JennaShell', 'term'], ['bin', 'Recycle Bin', 'bin'],
  ];
  for (const [id, name, ic, isNew] of desk) {
    const d = el('div', 'mos-ic' + (isNew ? ' new' : ''));
    d.appendChild(icon(ic, 3));
    d.appendChild(document.createTextNode(name));
    d.addEventListener('click', () => apps[id]());
    iconsEl.appendChild(d);
  }
  // open the report straight away when it is due
  if (o.report && !game.save.flags['v4:report']) setTimeout(() => { apps.sheet(); apps.report(); }, 350);
  // ---- close: the lid (Esc, or the power button in the corner)
  const pw = el('div', 'mos-start', '⏻ Close lid');
  pw.style.cssText = 'margin-left:auto';
  (wrap.querySelector('.mos-bar') as HTMLElement).appendChild(pw);
  await new Promise<void>(res => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); } };
    const finish = () => { window.removeEventListener('keydown', kd, true); res(); };
    window.addEventListener('keydown', kd, true);
    pw.addEventListener('pointerdown', finish);
  });
  closed = true;
  wrap.style.transition = 'opacity 0.2s';
  wrap.style.opacity = '0';
  game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
  audio.play('uiBack', { vol: 0.5 });
  setTimeout(() => wrap.remove(), 220);
  guardInput(300);
}
