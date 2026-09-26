// Pixel art for the field laptop: rugged lid + bezel (taped corner, webcam, screws, scuffs), the keyboard
// deck (keys, grilles, power button), the tent backdrop, the island wallpaper and a sheet of stickers.
// All coordinates are art pixels in the 320x180 "rig" (scaled by an integer factor on screen).

import { PixelBuffer } from '../art/pixel';
import { C, mix, withAlpha, shade } from '../art/color';
import { bayer } from '../core/math';
import { H, noise, drawText, textWidth, chamfer, rotateNN } from './laptop-kit';

export const RIG = {
  w: 320, h: 180,
  lid: { x: 8, y: 1, w: 304, h: 148 },
  /** screen, in rig coordinates */
  screen: { x: 34, y: 12, w: 252, h: 126 },
  deckY: 149,
  cam: { x: 160, y: 6 },
};
const L = RIG.lid, S = RIG.screen;
/** screen rect in lid-local coordinates */
const SX = S.x - L.x, SY = S.y - L.y;

const OUT = H('#0b0f12');
const BODY = [H('#1f262a'), H('#283035'), H('#30393e'), H('#39434a'), H('#46525a'), H('#5a666e')];
const RUB = [H('#4a2c0c'), H('#7a4c14'), H('#b27424'), H('#d8952e'), H('#f0b848'), H('#ffd88a')];

// ---------------------------------------------------------------- lid
export function paintLid(): PixelBuffer {
  const w = L.w, h = L.h;
  const b = new PixelBuffer(w, h);
  chamfer(b, 0, 0, w, h, OUT, 5);
  // shell with vertical light falloff and fine speckle
  b.rectFn(1, 1, w - 2, h - 2, (x, y) => {
    const dx = Math.min(x - 1, w - 2 - x), dy = Math.min(y - 1, h - 2 - y);
    if (dx + dy < 4) return -1;
    const t = y / h;
    let i = t < 0.18 ? 3 : t < 0.75 ? 2 : 1;
    const n = noise(x, y, 1);
    if (n > 0.93) i = Math.min(5, i + 1);
    else if (n < 0.05) i = Math.max(0, i - 1);
    return BODY[i];
  });
  // rim light / shadow
  for (let x = 6; x < w - 6; x++) { b.set(x, 1, BODY[5]); b.set(x, 2, BODY[4]); b.set(x, h - 2, BODY[0]); }
  for (let y = 6; y < h - 6; y++) { b.set(1, y, BODY[4]); b.set(w - 2, y, BODY[1]); }
  // recessed screen well
  const x0 = SX - 3, y0 = SY - 3, x1 = SX + S.w + 2, y1 = SY + S.h + 2;
  b.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, H('#15191c'));
  b.rect(x0, y0, x1 - x0 + 1, 1, H('#0c0f11'));
  b.rect(x0, y1, x1 - x0 + 1, 1, BODY[4]);
  b.rect(x1, y0, 1, y1 - y0 + 1, BODY[3]);
  b.rect(x0 + 1, y0 + 1, x1 - x0 - 1, 1, H('#1b2024'));
  b.rect(SX - 1, SY - 1, S.w + 2, S.h + 2, H('#050708'));
  b.rect(SX, SY, S.w, S.h, H('#07090b'));
  // scuffs, scratches, worn paint
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(noise(i, 3, 5) * w), y = Math.floor(noise(i, 7, 5) * h);
    if (x > x0 - 1 && x < x1 + 1 && y > y0 - 1 && y < y1 + 1) continue;
    const len = 2 + Math.floor(noise(i, 1, 9) * 5);
    const dir = noise(i, 2, 9) > 0.5 ? 1 : -1;
    for (let k = 0; k < len; k++) {
      const px = x + k, py = y + (k * dir) / 2;
      if (b.get(px, py) >>> 24) b.set(px, py, noise(i, k, 3) > 0.5 ? BODY[4] : BODY[3]);
    }
  }
  for (let i = 0; i < 40; i++) {
    const edge = noise(i, 11, 2);
    const x = edge < 0.5 ? Math.floor(noise(i, 1, 2) * w) : noise(i, 5, 2) > 0.5 ? 2 : w - 3;
    const y = edge < 0.5 ? (noise(i, 4, 2) > 0.5 ? 2 : h - 3) : Math.floor(noise(i, 6, 2) * h);
    if (b.get(x, y) >>> 24) { b.set(x, y, H('#8a949a')); if (noise(i, 8, 2) > 0.5) b.set(x + 1, y, H('#6d777c')); }
  }
  // screws at the bezel corners
  for (const [x, y] of [[SX - 9, SY - 6], [SX + S.w + 7, SY - 6], [SX - 9, SY + S.h + 4], [SX + S.w + 7, SY + S.h + 4]] as number[][]) screw(b, x, y);
  // carry latch on the top edge
  b.rect(134, 0, 36, 4, OUT); b.rect(135, 0, 34, 3, RUB[2]); b.rect(135, 0, 34, 1, RUB[4]); b.rect(135, 2, 34, 1, RUB[1]);
  for (let x = 138; x < 168; x += 3) b.set(x, 1, RUB[1]);
  // webcam, mic holes, privacy slider
  const cx = RIG.cam.x - L.x, cy = RIG.cam.y - L.y;
  b.rect(cx - 9, cy - 2, 5, 4, H('#15191c')); b.rect(cx - 8, cy - 1, 2, 2, H('#6d777c'));
  b.disc(cx, cy, 2.6, H('#3a434a')); b.disc(cx, cy, 1.8, H('#07090b')); b.set(cx - 1, cy - 1, H('#6fa0c0')); b.set(cx, cy, H('#1c3a52'));
  b.set(cx + 9, cy, H('#101316')); b.set(cx + 11, cy, H('#101316'));
  // brand plate on the bottom bezel
  const brand = 'FIELDBOOK';
  const bx = Math.round(w / 2 - (textWidth(brand) + 10) / 2), by = SY + S.h + 4;
  drawText(b, brand, bx, by, H('#56626a'), H('#15191c'));
  drawText(b, 'R7', bx + textWidth(brand) + 4, by, RUB[3], H('#15191c'));
  // rubber corner bumpers
  bumper(b, 0, 0, 1, 1); bumper(b, w - 1, 0, -1, 1); bumper(b, 0, h - 1, 1, -1); bumper(b, w - 1, h - 1, -1, -1);
  // duct tape over a cracked top-left bumper
  crack(b);
  tape(b, 2, 20, 23, -0.85, 7, 1);
  tape(b, 12, 4, 18, 0.72, 6, 2);
  return b;
}

function screw(b: PixelBuffer, x: number, y: number) {
  b.disc(x + 1, y + 1, 1.8, H('#101316'));
  b.set(x, y, H('#8a949a')); b.set(x + 1, y, H('#6d777c')); b.set(x, y + 1, H('#6d777c')); b.set(x + 1, y + 1, H('#3d464d'));
}

function bumper(b: PixelBuffer, cx: number, cy: number, fx: number, fy: number) {
  const R = 22, T = 6;
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const inLegX = j < T && i < R - (j > T - 3 ? 1 : 0);
    const inLegY = i < T && j < R;
    if (!inLegX && !inLegY) continue;
    if (i + j < 3) continue;
    if ((i === R - 1 && j < T) || (j === R - 1 && i < T)) { b.set(cx + i * fx, cy + j * fy, OUT); continue; }
    const edge = i === 0 || j === 0 || (i + j === 3);
    const inner = (inLegX && j === T - 1 && i >= T) || (inLegY && i === T - 1 && j >= T);
    let c = RUB[3];
    if (edge) c = OUT;
    else if (inner) c = RUB[1];
    else if (i === 1 || j === 1) c = RUB[4];
    else if ((inLegX && i > T && i % 3 === 0) || (inLegY && j > T && j % 3 === 0)) c = RUB[2];
    else if (noise(cx + i * fx, cy + j * fy, 4) > 0.9) c = RUB[2];
    b.set(cx + i * fx, cy + j * fy, c);
  }
  // corner screw
  b.set(cx + 3 * fx, cy + 3 * fy, RUB[0]); b.set(cx + 3 * fx + fx, cy + 3 * fy, RUB[1]);
}

function crack(b: PixelBuffer) {
  const pts = [[4, 2], [5, 4], [4, 6], [6, 8], [7, 11], [6, 13]];
  for (const [x, y] of pts) b.set(x, y, H('#2a1806'));
}

/** A strip of silver duct tape centred at (x,y), length len, angle a, width wd, with torn ends. */
function tape(b: PixelBuffer, x: number, y: number, len: number, a: number, wd: number, seed: number) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const r = len / 2 + wd;
  for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
    const dx = xx - x, dy = yy - y;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const tear = (noise(Math.round(v), seed, 3) - 0.5) * 3;
    if (Math.abs(v) > wd / 2 || Math.abs(u) > len / 2 + tear) continue;
    if (!b.inside(xx, yy)) continue;
    const crinkle = noise(Math.round(u / 2), Math.round(v), seed + 4);
    let c = crinkle > 0.8 ? H('#d9dfe0') : crinkle < 0.2 ? H('#8a9296') : H('#b3babd');
    if (v < -wd / 2 + 1) c = H('#e6eaea');
    if (v > wd / 2 - 1) c = H('#7c8488');
    if (Math.abs(u) > len / 2 + tear - 1) c = mix(c, b.get(xx, yy) >>> 24 ? b.get(xx, yy) : c, 0.35);
    b.set(xx, yy, c);
  }
}

// ---------------------------------------------------------------- deck (base with keyboard)
export const DECK = { keys: { x: 70, w: 180 }, charge: { x: 292, y: 159 }, power: { x: 30, y: 158 } };
export function paintDeck(): PixelBuffer {
  const w = RIG.w, h = RIG.h - RIG.deckY;
  const b = new PixelBuffer(w, h);
  // hinge barrel
  b.rect(12, 0, w - 24, 5, OUT);
  b.rect(13, 0, w - 26, 4, H('#1a1f22'));
  b.rect(13, 1, w - 26, 1, H('#4a555c'));
  b.rect(13, 3, w - 26, 1, H('#101316'));
  for (const x of [30, w - 62]) { b.rect(x, 0, 32, 5, OUT); b.rect(x + 1, 0, 30, 4, H('#3d464d')); b.rect(x + 1, 1, 30, 1, H('#8a949a')); b.rect(x + 1, 3, 30, 1, H('#262c31')); }
  // deck surface (a gentle trapezoid toward the viewer)
  const top = 5;
  for (let y = top; y < h; y++) {
    const t = (y - top) / (h - top);
    const inset = Math.round(6 - t * 6);
    for (let x = inset; x < w - inset; x++) {
      const edge = x === inset || x === w - inset - 1;
      const n = noise(x, y, 6);
      let c = y === top ? BODY[5] : y === top + 1 ? BODY[4] : n > 0.94 ? BODY[3] : BODY[2];
      if (edge) c = OUT;
      else if (x === inset + 1) c = BODY[4];
      else if (x === w - inset - 2) c = BODY[1];
      b.set(x, y, c);
    }
  }
  // keyboard well
  const kx = DECK.keys.x, kw = DECK.keys.w;
  b.rect(kx - 3, top + 3, kw + 6, h - top - 3, H('#15191c'));
  b.rect(kx - 3, top + 3, kw + 6, 1, H('#0c0f11'));
  const rows = [
    { y: top + 5, h: 4, keys: ['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'DEL'] },
    { y: top + 11, h: 6, keys: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BK'] },
    { y: top + 19, h: 6, keys: ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'] },
  ];
  for (const r of rows) {
    const n = r.keys.length;
    const wide = r.keys.map(k => (k.length > 2 && r.h > 4 ? 1.6 : 1));
    const tot = wide.reduce((a, c) => a + c, 0);
    const unit = (kw - (n - 1)) / tot;
    let x = kx;
    r.keys.forEach((k, i) => {
      const kwid = Math.round(unit * wide[i]);
      const last = i === n - 1;
      const ww = last ? kx + kw - x : kwid;
      key(b, x, r.y, ww, r.h, k, i, r.y);
      x += ww + 1;
    });
  }
  // speaker grilles
  for (const gx of [18, w - 50]) for (let y = top + 8; y < h - 1; y += 2) for (let x = gx; x < gx + 32; x += 2) b.set(x + (((y - top) / 2) % 2), y, H('#171b1e'));
  // power button + charge LED housing
  const p = DECK.power;
  b.disc(p.x, p.y - RIG.deckY, 3.2, OUT); b.disc(p.x, p.y - RIG.deckY, 2.4, H('#262c31'));
  b.set(p.x, p.y - RIG.deckY - 1, H('#8a949a')); b.set(p.x - 1, p.y - RIG.deckY, H('#6d777c')); b.set(p.x + 1, p.y - RIG.deckY, H('#6d777c')); b.set(p.x, p.y - RIG.deckY + 1, H('#6d777c'));
  const c = DECK.charge;
  b.rect(c.x - 9, c.y - RIG.deckY - 1, 6, 3, H('#6d777c')); b.set(c.x - 3, c.y - RIG.deckY, H('#6d777c'));
  b.rect(c.x - 8, c.y - RIG.deckY, 4, 1, H('#262c31'));
  b.rect(c.x - 1, c.y - RIG.deckY - 1, 3, 3, H('#101316'));
  return b;
}

function key(b: PixelBuffer, x: number, y: number, w: number, h: number, label: string, i: number, row: number) {
  const special = label === 'ESC';
  const pip = label === 'E' && row > 10;
  const cap = special ? H('#d8952e') : pip ? H('#e8614a') : H('#262d31');
  const face = special ? H('#f0b848') : pip ? H('#ff8a70') : H('#313a40');
  const edge = special ? H('#7a4c14') : H('#101316');
  b.rect(x, y, w, h, edge);
  b.rect(x, y, w, h - 1, cap);
  b.rect(x + 1, y, w - 2, h - 2, face);
  b.rect(x + 1, y, w - 2, 1, special ? H('#ffd88a') : H('#46525a'));
  // legend: a couple of pale pixels (worn on some keys)
  const worn = noise(i, row, 8) > 0.7;
  const lc = special ? H('#4a2c0c') : worn ? H('#4a555c') : H('#9aa3a5');
  if (h >= 5 && label.length === 1) { b.set(x + 1, y + 1, lc); b.set(x + 2, y + 1, lc); b.set(x + 1, y + 2, lc); }
  else if (label.length > 1) { for (let k = 0; k < Math.min(w - 2, 3); k++) b.set(x + 1 + k, y + 1, lc); }
}

// ---------------------------------------------------------------- tent backdrop
export function paintBackdrop(w: number, h: number, ox: number, oy: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const deskY = oy + 168;
  b.rectFn(0, 0, w, h, (x, y) => {
    if (y >= deskY) {
      const py = y - deskY;
      const plank = Math.floor((x - ox + 400) / 38);
      const gap = (x - ox + 400) % 38 === 0;
      const n = noise(Math.floor(x / 4), y, plank);
      if (gap) return H('#1a0f08');
      return py === 0 ? H('#8a5e38') : n > 0.8 ? H('#4e321c') : H('#5e3e24');
    }
    // canvas wall with a warm lantern glow top-left and seams
    const gx = (x - (ox + 30)) / (w * 0.7), gy = (y - oy) / (h * 0.9);
    const glow = Math.max(0, 1 - Math.sqrt(gx * gx + gy * gy));
    const seam = (x - ox + 1000) % 64 === 0;
    const base = mix(H('#1c2016'), H('#6a5a34'), glow * 0.75);
    const d = bayer(x, y);
    const c = d < glow * 0.5 ? shade(base, 0.08) : base;
    return seam ? shade(c, -0.25) : ((x + y * 3) % 5 === 0 ? shade(c, -0.06) : c);
  });
  return b;
}

// ---------------------------------------------------------------- wallpaper (island at dawn)
export function paintWallpaper(w = S.w, h = S.h): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const sky = [H('#1d3a5a'), H('#2c5a78'), H('#4a7f92'), H('#8fae9e'), H('#e8c088'), H('#f6d8a0')];
  const horizon = Math.round(h * 0.62);
  b.rectFn(0, 0, w, horizon, (x, y) => {
    const t = y / horizon;
    const f = t * (sky.length - 1) + (bayer(x, y) - 0.5) * 0.9;
    return sky[Math.max(0, Math.min(sky.length - 1, Math.round(f)))];
  });
  // sun
  const sx = Math.round(w * 0.7), sy = horizon - 10;
  b.discFn(sx, sy, 22, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); if (bayer(x, y) > 1 - d) return -1; return mix(b.get(x, y), H('#ffe6a8'), (1 - d) * 0.6); });
  b.disc(sx, sy, 7, H('#fff4d0'));
  // clouds
  const cloud = (cx: number, cy: number, cw: number) => {
    for (let i = 0; i < cw; i += 3) { const r = 2.5 + noise(i, cy, 3) * 2.5; b.disc(cx + i, cy - r * 0.4, r, H('#f6e0c0')); }
    b.rect(cx - 2, cy, cw + 4, 2, H('#e0b890'));
  };
  cloud(24, 26, 26); cloud(150, 16, 20); cloud(200, 38, 16); cloud(80, 44, 12);
  // far mountains (volcano) + mid hills + forest
  const ridge = (base: number, amp: number, freq: number, seed: number, col: C, top: C, peak?: [number, number, number]) => {
    for (let x = 0; x < w; x++) {
      let hgt = base - (Math.sin(x * freq + seed) * 0.5 + Math.sin(x * freq * 2.3 + seed * 2) * 0.3 + noise(Math.floor(x / 3), seed, 1) * 0.25) * amp;
      if (peak) { const d = Math.abs(x - peak[0]) / peak[2]; if (d < 1) hgt = Math.min(hgt, peak[1] + d * d * (base - peak[1]) * 0.9); }
      const yy = Math.round(hgt);
      for (let y = Math.max(0, yy); y < horizon + 6 && y < h; y++) b.set(x, y, y === yy ? top : col);
    }
  };
  ridge(horizon - 12, 10, 0.03, 1.3, H('#5a7a8a'), H('#8aa4a8'), [58, horizon - 44, 26]);
  // snow cap + smoke wisp on the volcano
  for (let y = horizon - 44; y < horizon - 38; y++) for (let x = 50; x < 67; x++) { const c = b.get(x, y); if (c === H('#5a7a8a')) b.set(x, y, H('#dfe8ea')); }
  for (let i = 0; i < 14; i++) b.blend(58 + Math.round(Math.sin(i * 0.6) * 2) + Math.floor(i / 3), horizon - 46 - i, H('#e8eef0', 150 - i * 8));
  ridge(horizon - 4, 9, 0.045, 4.1, H('#3c6a52'), H('#5a8a5a'));
  // waterfall off a cliff on the right
  const fx = Math.round(w * 0.86);
  for (let y = horizon - 22; y < horizon + 4; y++) { b.rect(fx - 6, y, 12, 1, H('#2e4a3a')); }
  for (let y = horizon - 20; y < horizon + 4; y++) { b.set(fx, y, H('#e8f6f4')); b.set(fx + 1, y, (y % 3) ? H('#bfe6e4') : H('#ffffff')); b.set(fx - 1, y, H('#9fd0d0')); }
  // jungle band with crowns
  for (let x = 0; x < w; x++) {
    const top = horizon + 2 - Math.round(Math.abs(Math.sin(x * 0.21 + 1)) * 4 + noise(Math.floor(x / 2), 5, 7) * 3);
    for (let y = top; y < horizon + 12; y++) b.set(x, y, y === top ? H('#4f9650') : y < top + 3 ? H('#2f6a3a') : H('#1d4a2a'));
  }
  // tree ferns silhouettes
  for (const tx of [14, 40, 110, 230]) {
    const ty = horizon + 2;
    for (let y = ty - 16; y < ty + 4; y++) b.set(tx, y, H('#1a3a24'));
    for (let a = 0; a < 8; a++) { const ang = Math.PI + (a / 7) * Math.PI; for (let k = 2; k < 11; k++) b.set(tx + Math.cos(ang) * k, ty - 16 + Math.sin(ang) * k * 0.55 + (k * k) / 26, H('#1f4a2c')); }
  }
  // sea + beach
  const seaY = horizon + 12;
  b.rectFn(0, seaY, w, h - seaY, (x, y) => {
    const t = (y - seaY) / (h - seaY);
    let c = mix(H('#3a7a8a'), H('#1a4a62'), t);
    if ((y + Math.floor(x / 7)) % 5 === 0 && noise(Math.floor(x / 5), y, 2) > 0.55) c = H('#8fd0d0');
    if (Math.abs(x - sx) < 16 - t * 8 && (x + y) % 2 === 0 && t < 0.5) c = H('#f6d8a0');
    return c;
  });
  for (let x = 0; x < w; x++) { const by = seaY + Math.round(Math.sin(x * 0.05) * 1.5); b.set(x, by, H('#e8d29b')); b.set(x, by + 1, H('#d2b77a')); }
  // the Leviathan's fin in the sea, and a Skyribbon gliding
  const lx = Math.round(w * 0.3), ly = seaY + 16;
  for (let i = 0; i < 16; i++) { const hh = Math.round(Math.sin((i / 15) * Math.PI) * 6); for (let y = 0; y < hh; y++) b.set(lx + i, ly - y, y === hh - 1 ? H('#8a4a5a') : H('#3a1a2a')); }
  for (let i = 0; i < 18; i += 3) b.set(lx - 6 + i, ly + 1, H('#bfe6e4'));
  for (let i = 0; i < 12; i++) b.set(170 + i, 30 + Math.round(Math.sin(i * 0.8) * 1.5), H('#2a3a3a'));
  // the wrecked Kittiwake on the beach rocks (tiny)
  const kx = Math.round(w * 0.55), ky = seaY + 2;
  b.poly([kx, ky, kx + 14, ky - 3, kx + 12, ky + 2, kx + 1, ky + 3], H('#e8e0d0'));
  b.rect(kx + 4, ky - 6, 1, 5, H('#6a5040')); b.rect(kx + 2, ky, 12, 1, H('#b8382b'));
  return b;
}

// ---------------------------------------------------------------- stickers
export interface StickerDef {
  id: string;
  /** rig coordinates of the sticker centre */
  x: number; y: number;
  /** rotation (radians) */
  rot: number;
  on: 'lid' | 'deck';
  /** peel corner: 0 none, 1 tr, 2 br, 3 bl, 4 tl */
  peel: number;
  faded?: boolean;
  shine?: boolean;
  title: string;
  art: () => PixelBuffer;
}

/** Wrap a design into a die-cut sticker: white margin, soft shadow, optional peeled corner. */
function dieCut(art: PixelBuffer, o: { margin?: number; paper?: C; peel?: number; faded?: boolean; rot?: number } = {}): PixelBuffer {
  const m = o.margin ?? 1;
  const paper = o.paper ?? H('#f4f1e6');
  const W = art.w + m * 2 + 2, Hh = art.h + m * 2 + 2;
  let s = new PixelBuffer(W, Hh);
  // paper = dilated silhouette
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
    if (!(art.get(x, y) >>> 24)) continue;
    for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (Math.abs(dx) + Math.abs(dy) <= m + (m > 1 ? 1 : 0)) s.set(x + dx + m + 1, y + dy + m + 1, paper);
  }
  s.blit(art, m + 1, m + 1);
  if (o.faded) s.map(c => mix(c, H('#d8d4c8'), 0.28));
  if (o.peel) {
    // fold one corner back: the underside shows (paper grey) with a shadow line
    const tri = 6;
    const corner = o.peel;
    const cx = corner === 1 || corner === 2 ? W - 1 : 0, cy = corner === 2 || corner === 3 ? Hh - 1 : 0;
    const fx = cx === 0 ? 1 : -1, fy = cy === 0 ? 1 : -1;
    // find the first opaque pixel along the diagonal to anchor the fold on the shape
    let k0 = 0;
    while (k0 < Math.min(W, Hh) && !(s.get(cx + k0 * fx, cy + k0 * fy) >>> 24)) k0++;
    const ax = cx + k0 * fx, ay = cy + k0 * fy;
    for (let j = 0; j < tri + 2; j++) for (let i = 0; i < tri + 2; i++) {
      const px = ax + i * fx, py = ay + j * fy;
      if (!s.inside(px, py)) continue;
      if (i + j < tri - 1) s.set(px, py, 0);
      else if (i + j === tri - 1 && s.get(px, py) >>> 24) s.set(px, py, H('#8a8678'));
    }
    // the folded flap
    for (let j = 0; j < tri; j++) for (let i = 0; i < tri; i++) {
      if (i + j > tri - 2) continue;
      const px = ax + (tri - 2 - j) * fx, py = ay + (tri - 2 - i) * fy;
      if (!s.inside(px, py)) continue;
      s.set(px, py, i + j === tri - 2 ? H('#b8b4a4') : H('#e2ddd0'));
    }
  }
  if (o.rot) s = rotateNN(s, o.rot);
  // drop shadow (down-right), under the sticker
  const out = new PixelBuffer(s.w + 1, s.h + 1);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.get(x, y) >>> 24) out.set(x + 1, y + 1, H('#000000', 110));
  out.blit(s, 0, 0);
  return out;
}

function label(lines: { t: string; c: C }[], bg: C, pad = 2, lh = 7, border?: C): PixelBuffer {
  const wd = Math.max(...lines.map(l => textWidth(l.t))) + pad * 2;
  const hasMac = lines.some(l => /[ĀĒĪŌŪ]/.test(l.t));
  const ht = lines.length * lh - (lh - 5) + pad * 2 + (hasMac ? 2 : 0);
  const b = new PixelBuffer(wd, ht);
  b.rect(0, 0, wd, ht, bg);
  if (border !== undefined) { b.rect(0, 0, wd, 1, border); b.rect(0, ht - 1, wd, 1, border); b.rect(0, 0, 1, ht, border); b.rect(wd - 1, 0, 1, ht, border); }
  let y = pad + (hasMac ? 2 : 0);
  for (const l of lines) { drawText(b, l.t, Math.round((wd - textWidth(l.t)) / 2), y, l.c); y += lh; }
  return b;
}

const ART: Record<string, () => PixelBuffer> = {
  serpent: () => {
    const b = new PixelBuffer(26, 14);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([2 + t * 18, 8 + Math.sin(t * Math.PI * 2) * 3]); }
    b.stroke(pts, t => 2.2 - t * 1.4, (t, x, y) => (y < 7 + Math.sin(((x - 2) / 18) * Math.PI * 2) * 3 - 0.4 ? H('#9fd46a') : H('#4f9650')));
    for (const i of [5, 9, 13, 16]) { const [x, y] = pts[i]; b.set(x, y + 2, H('#347a45')); b.set(x - 1, y + 3, H('#347a45')); b.set(x - 2, y + 3, H('#347a45')); }
    b.disc(21, 7, 2.8, H('#6fb150')); b.disc(20.5, 6.4, 1.6, H('#9fd46a'));
    b.set(21, 6, H('#ffffff')); b.set(22, 6, H('#10131a'));
    b.set(24, 8, H('#e8614a')); b.set(25, 7, H('#e8614a')); b.set(25, 9, H('#e8614a'));
    return b;
  },
  snakes: () => {
    const b = label([{ t: 'I   ', c: H('#10131a') }, { t: 'SNAKES', c: H('#10131a') }], H('#ffffff'), 2);
    // big red heart after the I
    const hx = Math.round(b.w / 2) - 1, hy = 2;
    const heart = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
    heart.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '1') b.set(hx + x - 1, hy + y - 1, y === 0 && x < 3 ? H('#ff8a80') : H('#e8303a')); }));
    return b;
  },
  fern: () => {
    const b = new PixelBuffer(18, 26);
    b.ellipse(9, 13, 8.6, 12.6, H('#10131a'));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([6 + Math.sin(t * 2.2) * 4, 23 - t * 20]); }
    for (let i = 3; i < 30; i += 2) {
      const [x, y] = pts[i];
      const L2 = (1 - i / 30) * 5 + 1;
      for (let k = 1; k <= L2; k++) { b.set(x + k, y - k * 0.4, H('#e8ecee')); b.set(x - k * 0.8, y - k * 0.5, H('#b8c2c6')); }
    }
    for (const [x, y] of pts) b.set(x, y, H('#ffffff'));
    return b;
  },
  camera: () => {
    const b = new PixelBuffer(22, 16);
    chamfer(b, 1, 4, 20, 11, H('#3fbca6'), 2);
    b.rect(1, 4, 20, 3, H('#e8e0c8')); b.rect(3, 2, 6, 3, H('#3fbca6')); b.rect(15, 2, 4, 2, H('#10131a'));
    b.disc(11, 10, 4.4, H('#10131a')); b.disc(11, 10, 3.4, H('#e8e0c8')); b.disc(11, 10, 2.4, H('#23325e')); b.set(10, 9, H('#ffffff'));
    b.set(18, 6, H('#e8614a'));
    return b;
  },
  kiwi: () => {
    const b = new PixelBuffer(24, 16);
    b.ellipseFn(10, 8, 8, 6, (x, y, nx, ny) => (ny < -0.4 ? H('#a07a50') : (x + y) % 3 === 0 ? H('#6a4a30') : H('#8a6440')));
    b.disc(15, 5.5, 3, H('#8a6440'));
    b.set(16, 4, H('#10131a'));
    b.line(18, 6, 23, 10, H('#d8c8a0')); b.line(18, 7, 22, 10, H('#b8a880'));
    b.line(8, 13, 7, 15, H('#d8a060')); b.line(12, 13, 13, 15, H('#d8a060'));
    b.set(6, 15, H('#d8a060')); b.set(14, 15, H('#d8a060'));
    return b;
  },
  coffee: () => {
    const b = new PixelBuffer(16, 18);
    b.rect(2, 6, 10, 10, H('#f4f1e6')); b.rect(2, 6, 10, 2, H('#6a4028'));
    b.rect(12, 8, 3, 1, H('#f4f1e6')); b.rect(14, 8, 1, 5, H('#f4f1e6')); b.rect(12, 12, 3, 1, H('#f4f1e6'));
    b.rect(2, 15, 10, 1, H('#c8c0b0'));
    b.set(5, 10, H('#10131a')); b.set(9, 10, H('#10131a')); b.rect(6, 12, 3, 1, H('#e8614a'));
    b.rect(3, 13, 1, 1, H('#f59aa4')); b.rect(10, 13, 1, 1, H('#f59aa4'));
    for (let i = 0; i < 5; i++) { b.set(5 + (i % 2), 4 - i, H('#dcdcdc')); b.set(9 - (i % 2), 4 - i, H('#dcdcdc')); }
    return b;
  },
  flag: () => {
    const w = 15, h = 9;
    const b = new PixelBuffer(w, h);
    b.rect(0, 0, w, h, H('#23325e'));
    for (let x = 0; x < w; x++) { const y1 = Math.round((x / (w - 1)) * (h - 1)), y2 = h - 1 - y1; b.set(x, y1, H('#ffffff')); b.set(x, y2, H('#ffffff')); if (x % 2) { b.set(x, y1, H('#c8102e')); } }
    b.rect(0, 3, w, 3, H('#ffffff')); b.rect(6, 0, 3, h, H('#ffffff'));
    b.rect(0, 4, w, 1, H('#c8102e')); b.rect(7, 0, 1, h, H('#c8102e'));
    return b;
  },
  weta: () => {
    const b = label([{ t: 'SAVE', c: H('#ffffff') }, { t: 'THE', c: H('#ffffff') }, { t: 'WĒTĀ', c: H('#ffd57a') }], H('#2f6a3a'), 2, 7);
    b.rect(0, 0, b.w, 1, H('#4f9650'));
    return b;
  },
  mushroom: () => {
    const b = new PixelBuffer(18, 18);
    b.rect(6, 9, 6, 7, H('#f4ead0')); b.rect(11, 9, 1, 7, H('#d8c8a8'));
    b.ellipseFn(9, 9, 8, 7, (x, y, nx, ny) => (ny > 0.05 ? -1 : ny < -0.6 || nx < -0.5 ? H('#f06a50') : H('#d63a2c')));
    for (const [x, y] of [[5, 5], [10, 3], [13, 6], [8, 7]] as number[][]) { b.set(x, y, H('#ffffff')); b.set(x + 1, y, H('#ffffff')); b.set(x, y + 1, H('#ffffff')); }
    b.set(7, 11, H('#10131a')); b.set(10, 11, H('#10131a')); b.set(8, 13, H('#e8614a')); b.set(9, 13, H('#e8614a'));
    b.set(6, 12, H('#f59aa4')); b.set(11, 12, H('#f59aa4'));
    return b;
  },
  paw: () => {
    const b = new PixelBuffer(14, 14);
    b.disc(7, 7, 6.6, H('#e8c070'));
    b.ellipse(7, 9, 2.8, 2.2, H('#5a3a22'));
    for (const [x, y] of [[3.5, 6], [5.5, 3.8], [8.5, 3.8], [10.5, 6]] as number[][]) b.disc(x, y, 1.2, H('#5a3a22'));
    return b;
  },
  uni: () => {
    const t1 = 'UNIV. OF OTAGO', t2 = '— MARINE BIO';
    const wd = Math.max(textWidth(t1), textWidth(t2)) + 14, ht = 17;
    const b = new PixelBuffer(wd, ht);
    b.rect(0, 0, wd, ht, H('#23325e'));
    b.rect(0, 0, wd, 1, H('#e8c070')); b.rect(0, ht - 1, wd, 1, H('#e8c070'));
    // crest
    b.poly([2, 3, 9, 3, 9, 10, 5.5, 14, 2, 10], H('#e8c070'));
    b.poly([3, 4, 8, 4, 8, 10, 5.5, 13, 3, 10], H('#23325e'));
    b.rect(5, 5, 1, 6, H('#e8c070')); b.rect(4, 7, 3, 1, H('#e8c070'));
    drawText(b, t1, 12, 3, H('#f4ead0'));
    drawText(b, t2, 12, 10, H('#e8c070'));
    return b;
  },
  pip: () => {
    const lines = [{ t: "PIP'S TECH", c: H('#10131a') }, { t: 'WARRANTY', c: H('#10131a') }, { t: 'VOID', c: H('#b8382b') }];
    const b0 = label(lines, H('#f4b43c'), 2, 7);
    const b = new PixelBuffer(b0.w + 9, b0.h + 3);
    b.rect(0, 0, b.w, b.h, H('#f4b43c'));
    b.blit(b0, 0, 0);
    for (let x = 0; x < b.w; x++) for (let y = b.h - 3; y < b.h; y++) b.set(x, y, ((x + y) >> 1) % 2 ? H('#10131a') : H('#f4b43c'));
    // check badge
    b.disc(b.w - 4.5, 5, 3.6, H('#3fbca6'));
    const ck = [[-2, 0], [-1, 1], [0, 2], [1, 1], [2, 0], [3, -1]];
    for (const [dx, dy] of ck) b.set(b.w - 5 + dx, 5 + dy, H('#ffffff'));
    return b;
  },
  koru: () => {
    const b = new PixelBuffer(18, 20);
    const J = [H('#0c3b2c'), H('#13604a'), H('#1f8a68'), H('#3fb88a'), H('#9ff0c8')];
    // spiral stroke
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 3.1;
      const r = 1 + t * 6.2;
      pts.push([9 + Math.cos(a + 2.4) * r, 8.5 + Math.sin(a + 2.4) * r]);
    }
    const tail = pts[pts.length - 1];
    for (let k = 1; k < 8; k++) pts.push([tail[0] - k * 0.25, tail[1] + k * 1.1]);
    b.stroke(pts, t => 1.2 + t * 1.1, (t, x, y) => (x + y < 16 ? J[3] : t > 0.85 ? J[2] : J[2]));
    b.stroke(pts, t => 0.35 + t * 0.4, () => J[1]);
    b.disc(9.4, 8.2, 1.7, J[3]); b.set(8, 7, J[4]);
    for (const [x, y] of pts.slice(12, 40)) if ((x + y) % 7 < 1) b.set(x - 1, y - 1, J[4]);
    return b;
  },
};

export const STICKERS: StickerDef[] = [
  // left bezel
  { id: 'serpent', x: 21, y: 34, rot: -0.1, on: 'lid', peel: 0, title: 'A legged serpent. Rowan drew the original on a napkin.', art: ART.serpent },
  { id: 'snakes', x: 20, y: 56, rot: 0.08, on: 'lid', peel: 2, title: '“I ♥ SNAKES”. Crowe calls this a cry for help.', art: ART.snakes },
  { id: 'fern', x: 20, y: 83, rot: -0.14, on: 'lid', peel: 0, title: 'Silver fern.', art: ART.fern },
  { id: 'coffee', x: 21, y: 110, rot: 0.12, on: 'lid', peel: 4, faded: true, title: 'A coffee cup. There is no coffee on this island.', art: ART.coffee },
  { id: 'paw', x: 22, y: 131, rot: -0.2, on: 'lid', peel: 0, title: 'A paw print, from a vet-school friend.', art: ART.paw },
  // top bezel
  { id: 'flag', x: 124, y: 7, rot: 0.1, on: 'lid', peel: 0, title: 'A tiny Union Jack. Crowe stuck it there “for luck”, then denied it.', art: ART.flag },
  // right bezel
  { id: 'camera', x: 299, y: 32, rot: 0.12, on: 'lid', peel: 0, title: 'Camera sticker.', art: ART.camera },
  { id: 'kiwi', x: 298, y: 53, rot: -0.1, on: 'lid', peel: 1, title: 'A kiwi. Obviously.', art: ART.kiwi },
  { id: 'weta', x: 299, y: 79, rot: 0.07, on: 'lid', peel: 0, title: '“SAVE THE WĒTĀ”.', art: ART.weta },
  { id: 'mushroom', x: 298, y: 105, rot: -0.12, on: 'lid', peel: 3, title: 'A happy mushroom.', art: ART.mushroom },
  { id: 'koru', x: 299, y: 128, rot: 0.05, on: 'lid', peel: 0, shine: true, title: 'A pounamu-green koru. Aroha stuck it on while you were asleep. “For new beginnings.”', art: ART.koru },
  // deck
  { id: 'pip', x: 43, y: 170, rot: -0.06, on: 'deck', peel: 0, title: 'PIP’S TECH ✓ WARRANTY VOID. Pip insists this is a certification.', art: ART.pip },
  { id: 'uni', x: 280, y: 171, rot: 0.05, on: 'deck', peel: 1, faded: true, title: 'University of Otago — Marine Bio. Rowan’s old lab. Peeling, like Rowan’s funding.', art: ART.uni },
];

const stickerCache = new Map<string, PixelBuffer>();
export function stickerBuffer(s: StickerDef): PixelBuffer {
  let b = stickerCache.get(s.id);
  if (!b) {
    b = dieCut(s.art(), { margin: s.id === 'uni' || s.id === 'pip' || s.id === 'flag' || s.id === 'weta' || s.id === 'snakes' ? 1 : 1, peel: s.peel, faded: s.faded, rot: s.rot });
    stickerCache.set(s.id, b);
  }
  return b;
}

export { withAlpha };
