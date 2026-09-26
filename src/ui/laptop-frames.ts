// Pixel-art panel frames painted at art resolution: Rowan's canvas backpack, the workbench, the campfire
// stones, and the camera body used by the standalone photo review.

import { PixelBuffer } from '../art/pixel';
import { C, withAlpha, mix } from '../art/color';
import { H, noise, fabric, stitch, chamfer, drawText, textWidth } from './laptop-kit';

const OUT = H('#0b0f12');

function cornerPatch(b: PixelBuffer, x: number, y: number, fx: number, fy: number, s = 13) {
  const L1 = H('#4a311d'), L2 = H('#6d4b2c'), L3 = H('#8d6640'), T = H('#d9c68e');
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    if (i + j > s + 3) continue;
    const px = fx > 0 ? x + i : x - i, py = fy > 0 ? y + j : y - j;
    const n = noise(px, py, 7);
    b.set(px, py, i + j > s + 1 ? L1 : n > 0.8 ? L3 : n < 0.15 ? L1 : L2);
  }
  for (let k = 0; k <= s; k++) { const i = k, j = s + 1 - k; if (k % 3 !== 2) b.set(fx > 0 ? x + i : x - i, fy > 0 ? y + j - 2 : y - j + 2, T); }
  const rx = fx > 0 ? x + 4 : x - 5, ry = fy > 0 ? y + 4 : y - 5;
  b.rect(rx, ry, 2, 2, H('#e8c070')); b.set(rx + 1, ry + 1, H('#8a6420')); b.set(rx, ry, H('#fff0b8'));
}

/** Rowan's backpack: olive canvas with seams, stitching, leather corners and straps. */
export function paintCanvasFrame(b: PixelBuffer, w: number, h: number, o: { inner?: [number, number, number, number][]; tint?: 'olive' | 'tan' } = {}) {
  const tan = o.tint === 'tan';
  const c1 = H(tan ? '#8a7a52' : '#5d6939'), c2 = H(tan ? '#7e6f4a' : '#555f34'), c3 = H(tan ? '#9c8c60' : '#6c7843');
  chamfer(b, 0, 0, w, h, OUT, 4);
  chamfer(b, 1, 1, w - 2, h - 2, H(tan ? '#5a4c30' : '#3a4322'), 3);
  fabric(b, 3, 3, w - 6, h - 6, c1, c2, c3, 3);
  // light top edge / dark bottom edge (piping)
  b.rect(4, 3, w - 8, 1, H(tan ? '#b09c6c' : '#7c8a50'));
  b.rect(4, h - 4, w - 8, 1, H(tan ? '#4a3e26' : '#2e361a'));
  const T = H('#d6cc96');
  stitch(b, 6, 6, w - 7, 6, T); stitch(b, 6, h - 7, w - 7, h - 7, T);
  stitch(b, 6, 6, 6, h - 7, T); stitch(b, w - 7, 6, w - 7, h - 7, T);
  // inner pockets / recessed areas
  for (const [x, y, ww, hh] of o.inner ?? []) {
    b.rect(x - 1, y - 1, ww + 2, hh + 2, H(tan ? '#4a3e26' : '#2a3118'));
    fabric(b, x, y, ww, hh, H(tan ? '#6e6040' : '#48522c'), H(tan ? '#665a3c' : '#424b28'), H(tan ? '#7a6c48' : '#525e33'), 9);
    b.rect(x, y + hh, ww, 1, H(tan ? '#a8966a' : '#6c7843'));
    b.rect(x, y, ww, 1, H(tan ? '#3e3420' : '#262c16'));
  }
  cornerPatch(b, 2, 2, 1, 1); cornerPatch(b, w - 3, 2, -1, 1); cornerPatch(b, 2, h - 3, 1, -1); cornerPatch(b, w - 3, h - 3, -1, -1);
  // top straps with buckles
  for (const sx of [Math.round(w * 0.22), Math.round(w * 0.78) - 7]) {
    b.rect(sx, 0, 7, 11, H('#5a3c22')); b.rect(sx + 1, 0, 5, 11, H('#7a5430')); b.rect(sx + 1, 0, 1, 11, H('#9a7040'));
    stitch(b, sx + 1, 1, sx + 1, 9, T, 1, 2); stitch(b, sx + 5, 1, sx + 5, 9, T, 1, 2);
    b.rect(sx - 1, 7, 9, 5, H('#b08a3a')); b.rect(sx, 8, 7, 3, H('#5a3c22')); b.rect(sx - 1, 7, 9, 1, H('#f0d080'));
    b.rect(sx + 3, 8, 1, 3, H('#e8c070'));
  }
}

/** Workbench: warm planks, dark frame and nail heads. */
export function paintWoodFrame(b: PixelBuffer, w: number, h: number, o: { inner?: [number, number, number, number][] } = {}) {
  chamfer(b, 0, 0, w, h, OUT, 3);
  const plankH = 11;
  const tones = [['#8c5f38', '#7a5130', '#a87c4c'], ['#80573a', '#6e4a2e', '#9c7248'], ['#936540', '#7e5634', '#b08452']];
  for (let y = 1; y < h - 1; y++) {
    const pi = Math.floor((y - 1) / plankH);
    const [base, dark, lite] = tones[pi % 3].map(x => H(x));
    const top = (y - 1) % plankH === 0, bot = (y - 1) % plankH === plankH - 1;
    for (let x = 1; x < w - 1; x++) {
      let c = base;
      const g = noise(Math.floor(x / 6), y, pi);
      if (g > 0.82) c = dark;
      else if (g < 0.08) c = lite;
      if (top) c = lite;
      if (bot) c = H('#2c1a0e');
      b.set(x, y, c);
    }
    // knots
    if (!top && !bot && noise(pi, 3, 11) > 0.5 && (y - 1) % plankH === 5) {
      const kx = Math.floor(noise(pi, 9, 2) * (w - 40)) + 20;
      b.ellipse(kx, y, 2.2, 1.4, H('#5a3a20')); b.set(kx, y, H('#3a2412'));
    }
  }
  // frame
  const F1 = H('#4a2e18'), F2 = H('#6a4424');
  b.rect(1, 1, w - 2, 4, F2); b.rect(1, h - 5, w - 2, 4, F1); b.rect(1, 1, 4, h - 2, F2); b.rect(w - 5, 1, 4, h - 2, F1);
  b.rect(1, 1, w - 2, 1, H('#8a5c34'));
  for (let x = 10; x < w - 8; x += 26) { nail(b, x, 2); nail(b, x, h - 4); }
  for (let y = 14; y < h - 8; y += 22) { nail(b, 2, y); nail(b, w - 4, y); }
  for (const [x, y, ww, hh] of o.inner ?? []) {
    b.rect(x - 1, y - 1, ww + 2, hh + 2, H('#2c1a0e'));
    b.rectFn(x, y, ww, hh, (px, py) => (noise(Math.floor(px / 5), py, 21) > 0.85 ? H('#4a3020') : H('#553823')));
    b.rect(x, y + hh, ww, 1, H('#a87c4c'));
  }
}
function nail(b: PixelBuffer, x: number, y: number) {
  b.set(x, y, H('#c3c6c2')); b.set(x + 1, y, H('#7a8087')); b.set(x, y + 1, H('#7a8087')); b.set(x + 1, y + 1, H('#454b53'));
}

/** Campfire: charcoal ground, glowing embers, ring of river stones. */
export function paintStoneFrame(b: PixelBuffer, w: number, h: number, o: { inner?: [number, number, number, number][] } = {}) {
  chamfer(b, 0, 0, w, h, OUT, 3);
  b.rectFn(1, 1, w - 2, h - 2, (x, y) => {
    const g = Math.max(0, 1 - Math.hypot((x - w / 2) / (w * 0.55), (y - h) / (h * 0.75)));
    const n = noise(x, y, 4);
    const base = mix(H('#16110f'), H('#5a2410'), Math.min(1, g * 1.2 + (n - 0.5) * 0.15));
    if (g > 0.35 && n > 0.985) return H('#ffb050');
    if (g > 0.2 && n > 0.975) return H('#e8612a');
    return base;
  });
  const stone = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
    const t = noise(seed, 1, 5);
    const ramp = [H('#2a2826'), H(t > 0.5 ? '#4e4a46' : '#4a4e52'), H(t > 0.5 ? '#6e6860' : '#666c72'), H(t > 0.5 ? '#948c80' : '#8c9298'), H('#b8b4ac')];
    b.shadedEllipse(cx, cy, rx, ry, ramp);
  };
  let s = 0;
  for (let x = 4; x < w - 2; x += 9) { stone(x, 4, 5 + noise(s, 2) * 1.5, 3.6, s++); stone(x + 3, h - 5, 5 + noise(s, 2) * 1.5, 3.8, s++); }
  for (let y = 10; y < h - 8; y += 8) { stone(4, y, 3.8, 4.4 + noise(s, 3), s++); stone(w - 5, y + 3, 3.8, 4.4 + noise(s, 3), s++); }
  // warm rim light on the lower stones
  for (let x = 0; x < w; x++) for (let y = h - 10; y < h - 1; y++) { const c = b.get(x, y); if (c >>> 24 && noise(x, y, 8) > 0.7 && y < h - 6) b.set(x, y, mix(c, H('#ff9a50'), 0.18)); }
  for (const [x, y, ww, hh] of o.inner ?? []) {
    b.rect(x - 1, y - 1, ww + 2, hh + 2, H('#0c0a09'));
    b.rect(x, y, ww, hh, withAlpha(H('#1e1714'), 255));
    b.rect(x, y + hh, ww, 1, H('#6a3a1e'));
  }
}

/** Camera body with a rear LCD window [x, y, w, h] and a few physical buttons. */
export function paintCameraBody(b: PixelBuffer, w: number, h: number, lcd: [number, number, number, number]) {
  chamfer(b, 0, 0, w, h, OUT, 6);
  b.rectFn(1, 1, w - 2, h - 2, (x, y) => {
    const dx = Math.min(x - 1, w - 2 - x), dy = Math.min(y - 1, h - 2 - y);
    if (dx + dy < 5) return -1;
    const n = noise(x, y, 2);
    return ((x + y) % 3 === 0 || n > 0.93) ? H('#242a30') : H('#1c2126');
  });
  // top plate highlight + grip on the right
  b.rect(8, 2, w - 16, 1, H('#4a545c'));
  const gx = w - 26;
  b.rectFn(gx, 6, 20, h - 12, (x, y) => (((x * 2 + y) % 4 === 0) ? H('#14181c') : H('#262d33')));
  b.rect(gx, 6, 1, h - 12, H('#3a434a'));
  // LCD bezel
  const [lx, ly, lw, lh] = lcd;
  chamfer(b, lx - 4, ly - 4, lw + 8, lh + 8, H('#0e1114'), 3);
  b.rect(lx - 3, ly - 3, lw + 6, 1, H('#3a434a'));
  b.rect(lx - 1, ly - 1, lw + 2, lh + 2, H('#050708'));
  b.rect(lx, ly, lw, lh, H('#0a0f12'));
  // buttons on the grip side
  const bx = gx + 10, by = Math.round(h * 0.28);
  b.disc(bx, by, 6, H('#2b3238')); b.disc(bx, by, 5, H('#3d464d')); b.disc(bx, by, 2.5, H('#1c2126'));
  b.set(bx - 3, by - 3, H('#6d777c'));
  for (const [i, lab] of [[0, 'PLAY'], [1, 'MENU'], [2, 'DEL']] as [number, string][]) {
    const yy = by + 14 + i * 12;
    b.rect(bx - 6, yy, 12, 7, H('#2b3238')); b.rect(bx - 6, yy, 12, 1, H('#525c63'));
    drawText(b, lab, bx - Math.ceil(textWidth(lab) / 2), yy + 9, i === 0 ? H('#3fbca6') : H('#6d777c'));
  }
  // brand + details on the left of the LCD
  drawText(b, 'FIELD-7', 10, h - 11, H('#6d777c'));
  b.disc(12, 12, 2.2, H('#e8614a')); b.set(11, 11, H('#ffb0a0'));
  drawText(b, 'REC', 17, 10, H('#525c63'));
  // strap lugs
  b.rect(0, 12, 3, 8, H('#3d464d')); b.rect(w - 3, 12, 3, 8, H('#3d464d'));
}
