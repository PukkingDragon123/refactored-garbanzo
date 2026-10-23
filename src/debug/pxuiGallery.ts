// ?gallery=pxui : the bitmap fonts (src/ui/pxfont.ts) and the pixel UI kit pieces, for checking by eye.

import { pxTextCanvas } from '../ui/pxfont';
import type { PxFontId } from '../ui/pxfont';

export function pxuiGallery(q: URLSearchParams) {
  const k = +(q.get('k') ?? 3);
  document.body.style.cssText = 'margin:0;background:#3a3226;overflow:auto;height:auto';
  const host = document.createElement('div');
  host.style.cssText = `padding:12px;display:flex;flex-direction:column;gap:${4 * k}px;align-items:flex-start`;
  document.body.appendChild(host);
  const add = (c: HTMLCanvasElement, bg = '#e8d4a2') => {
    const w = document.createElement('div');
    w.style.cssText = `background:${bg};padding:${2 * k}px;line-height:0`;
    c.style.width = c.width * k + 'px'; c.style.height = c.height * k + 'px';
    c.style.imageRendering = 'pixelated';
    w.appendChild(c);
    host.appendChild(w);
  };
  const pangram = 'The quick brown fox jumps over the lazy dog. 0123456789';
  const only = q.get('f');
  const fonts: PxFontId[] = (['body', 'bold', 'tiny', 'script'] as PxFontId[]).filter(f => !only || only === f);
  for (const f of fonts) {
    add(pxTextCanvas(`${f}: ABCDEFGHIJKLMNOPQRSTUVWXYZ`, { font: f }));
    add(pxTextCanvas('abcdefghijklmnopqrstuvwxyz', { font: f }));
    add(pxTextCanvas(pangram + ' (!?) & %+-=/ ā ē ī ō ū é ×·°…', { font: f, maxW: 300 }));
  }
  if (only) return;
  add(pxTextCanvas('What are we cooking with?', { font: 'script', color: '#fff3cc', outline: '#3a2a14', shadow: '#3a2a14' }), '#6a5034');
  add(pxTextCanvas('Firewood · Huhu grubs · Kawakawa tea · Mānuka honey', { font: 'script', bleed: '#4a3a20' }));
  add(pxTextCanvas([{ text: 'FOUND ', color: '#2f5a22', font: 'bold' }, { text: 'on the beach after a storm, and in the forest after the wind. ' }, { text: 'Not analysed yet.', color: '#7a5a2a' }], { maxW: 96 }));
}
