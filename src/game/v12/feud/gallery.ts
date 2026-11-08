// V12 The Claw and the Plume: a debug art sheet (zlFeud.gallery() from the console, or the Developer
// panel's "Art sheet" point): every frame of the Bearer's anims and the feathered boa in its poses,
// next to a 62 px Mori-high bar.

import { showGallery, GalleryItem } from '../../../debug/gallery';
import { PixelBuffer } from '../../../art/pixel';
import { hex } from '../../../art/color';
import { BEARER_ANIMS, bearerFrame, paintBearerBig } from '../../../art/v12/feud/bearer';
import { SerpentPainter } from '../../../art/serpent';
import { SERPENT_LOOKS } from '../../../art/fauna';
import { game } from '../../game';

export interface FeudGalleryOpts { anim?: string; frame?: number; scale?: number; big?: number; boa?: boolean; bearer?: boolean; only?: string[] }

function bar(): PixelBuffer {
  const b = new PixelBuffer(6, 62);
  for (let y = 0; y < 62; y++) for (let x = 0; x < 6; x++) b.set(x, y, hex(y % 10 < 5 ? '#e8d8b0' : '#4a6a2a'));
  return b;
}

/** the boa painted in a few poses: lying, ruff up and reared, coiled round a prey-sized gap */
function boaPoses(): GalleryItem[] {
  const look = SERPENT_LOOKS.plumeboa;
  if (!look) return [];
  const out: GalleryItem[] = [];
  const W = 720, H = 260;
  const pose = (name: string, f: (i: number, n: number) => [number, number], crest: number, jaw = 0, swell?: { at: number; k: number }) => {
    const sp = new SerpentPainter(look);
    const n = Math.ceil(look.length / 4) + 1;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) pts.push(f(i, n));
    const buf = new PixelBuffer(W, H);
    sp.paint(buf, { pts, facing: 1, jaw, tongue: 0.4, legPhase: 0, legLift: 0, grounded: true, groundY: () => 240, flatten: 0, crest, swell, eye: crest > 0.5 ? 'angry' : 'open' }, 0, 0, 1.3);
    out.push({ name, buf: buf.trim(1).buf });
  };
  // stretched out, sinuous
  pose('boa lying', (i) => [640 - i * 4, 226 - Math.sin(i * 0.05) * 10 - (i < 6 ? (6 - i) * 0.8 : 0)], 0);
  // the threat: head reared high, ruff up
  pose('boa ruff', (i) => {
    if (i < 22) { const t = i / 22; return [560 - t * 30 + Math.sin(t * 3) * 6, 80 + t * 140]; }
    const j = i - 22;
    return [530 - j * 4, 222 - Math.sin(j * 0.07) * 8];
  }, 1, 0.8);
  // half raised
  pose('boa crest .5', (i) => [640 - i * 4, 224 - Math.sin(i * 0.06) * 12 - (i < 14 ? (14 - i) * 3 : 0)], 0.5, 0.2);
  // swallowing: the bulge
  pose('boa swallow', (i) => [640 - i * 4, 226 - Math.sin(i * 0.05) * 8], 0, 0.3, { at: 0.3, k: 0.9 });
  return out;
}

export function feudGallery(o: FeudGalleryOpts = {}) {
  // the world stops drawing while the sheet is up (it is a debug page from here on)
  (game as unknown as { covered: number }).covered = 99;
  const items: GalleryItem[] = [{ name: 'Mori 62px', buf: bar() }];
  const t0 = performance.now();
  if (o.bearer !== false) {
    for (const [a, info] of Object.entries(BEARER_ANIMS)) {
      if (o.anim && a !== o.anim) continue;
      for (let i = 0; i < info.frames; i++) {
        if (o.frame !== undefined && o.frame !== i) continue;
        if (o.only && !o.only.includes(a + ':' + i)) continue;
        const buf = o.big ? paintBearerBig(a, i, o.big).buf : bearerFrame(a, i).buf;
        items.push({ name: `${a} ${i}`, buf });
      }
    }
  }
  if (o.boa) items.push(...boaPoses());
  showGallery(items, o.scale ?? 2, '#6a7a62');
  const note = document.createElement('div');
  note.textContent = `painted in ${(performance.now() - t0).toFixed(0)} ms`;
  document.body.prepend(note);
}
