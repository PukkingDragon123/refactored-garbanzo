// Contact-sheet PNG writer for procedural pixel art, runnable in plain Node (no browser, no canvas).
//
// Usage from a preview script bundled with esbuild:
//   import { writeSheet } from '../scripts/sheet.mjs';
//   writeSheet('/tmp/out.png', [{ buf, label: 'rowan idle 0' }, ...], { scale: 3, cols: 8, bg: 0x6d7f86 });
// `buf` is a PixelBuffer (or anything with w, h and a Uint8Array `bytes` in RGBA order).
// Labels are drawn with a tiny built-in 3x5 font (A-Z, 0-9 and a few symbols).

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Encode RGBA bytes as a PNG buffer. */
export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 3x5 font, rows top->bottom, 3 bits each
const FONT = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
  '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '_': [0, 0, 0, 0, 7], ' ': [0, 0, 0, 0, 0],
  '#': [5, 7, 5, 7, 5], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '+': [0, 2, 7, 2, 0], '=': [0, 7, 0, 7, 0], x: [0, 5, 2, 5, 0],
};

/**
 * Lay out buffers in a grid and write a PNG.
 * opts: scale (integer, default 3), cols (default auto), bg (0xRRGGBB, default 0x6d7f86), pad (px, default 6),
 *       checker (bool, draw a checkerboard behind transparent pixels)
 */
export function writeSheet(path, items, opts = {}) {
  const scale = opts.scale ?? 3, pad = opts.pad ?? 6, bg = opts.bg ?? 0x6d7f86;
  const n = items.length;
  const cols = opts.cols ?? Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.ceil(n / cols);
  const cw = Math.max(...items.map(it => it.buf.w)) * scale + pad * 2;
  const labelH = items.some(it => it.label) ? 9 : 0;
  const rowH = [];
  for (let r = 0; r < rows; r++) {
    let m = 0;
    for (let c = 0; c < cols; c++) { const it = items[r * cols + c]; if (it) m = Math.max(m, it.buf.h * scale); }
    rowH.push(m + pad * 2 + labelH);
  }
  const W = cw * cols, H = rowH.reduce((a, b) => a + b, 0);
  const out = new Uint8Array(W * H * 4);
  const br = (bg >> 16) & 255, bgc = (bg >> 8) & 255, bb = bg & 255;
  for (let i = 0; i < W * H; i++) { out[i * 4] = br; out[i * 4 + 1] = bgc; out[i * 4 + 2] = bb; out[i * 4 + 3] = 255; }
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  };
  let y0 = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const it = items[r * cols + c];
      if (!it) continue;
      const { buf } = it;
      const bytes = buf.bytes;
      const ox = c * cw + pad, oy = y0 + pad + (rowH[r] - pad * 2 - labelH - buf.h * scale);
      for (let y = 0; y < buf.h; y++)
        for (let x = 0; x < buf.w; x++) {
          const i = (y * buf.w + x) * 4;
          const a = bytes[i + 3] / 255;
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const px = ox + x * scale + sx, py = oy + y * scale + sy;
              let dr = br, dg = bgc, db = bb;
              if (opts.checker) { const k = ((px >> 3) + (py >> 3)) & 1 ? 12 : -12; dr += k; dg += k; db += k; }
              put(px, py, bytes[i] * a + dr * (1 - a), bytes[i + 1] * a + dg * (1 - a), bytes[i + 2] * a + db * (1 - a));
            }
        }
      if (it.label) {
        let lx = c * cw + pad;
        const ly = y0 + rowH[r] - labelH;
        for (const ch of String(it.label).toUpperCase()) {
          const g = FONT[ch] ?? FONT[' '];
          for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy] & (4 >> xx)) put(lx + xx, ly + yy, 255, 255, 255);
          lx += 4;
        }
      }
    }
    y0 += rowH[r];
  }
  writeFileSync(path, encodePNG(W, H, out));
  return { w: W, h: H };
}
