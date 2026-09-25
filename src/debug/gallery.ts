// Debug sprite gallery: open with ?gallery=<name> to inspect generated pixel art at scale.
import { PixelBuffer } from '../art/pixel';

export type GalleryItem = { name: string; buf: PixelBuffer };

export function showGallery(items: GalleryItem[], scale = 3, bg = '#6d7f86') {
  document.body.innerHTML = '';
  document.body.style.cssText = `margin:0;background:${bg};font:12px monospace;color:#fff;display:flex;flex-wrap:wrap;gap:12px;padding:12px;align-items:flex-end`;
  for (const it of items) {
    const wrap = document.createElement('div');
    const c = it.buf.toCanvas(scale);
    c.style.imageRendering = 'pixelated';
    c.style.display = 'block';
    wrap.appendChild(c);
    const l = document.createElement('div');
    l.textContent = `${it.name} ${it.buf.w}x${it.buf.h}`;
    wrap.appendChild(l);
    document.body.appendChild(wrap);
  }
}
