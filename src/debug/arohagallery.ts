// ?gallery=aroha : Aroha's sprite (every outfit), her own idle / walk / run, the cast's combat set frame
// by frame (Aroha, and Mori's slingshot), and her portraits and HD close-up busts.
// ?gallery=combat&who=mori : the combat set for someone else.
import { showGallery, GalleryItem } from './gallery';
import { PixelBuffer } from '../art/pixel';
import * as P from '../art/v7';
import { renderAnimePortrait, renderAnimePortraitHD } from '../art/anime/portraits';
import { COMBAT_ANIMS } from '../art/v7/anim-contract';

const CW = 132, CH = 112, OX = 66, OY = 96;
/** a body frame with its head on, composited the way the Actor draws it (rotation included) */
export function composite(id: string, anim: string, frame: number, expr = 'neutral'): PixelBuffer {
  const out = new PixelBuffer(CW, CH);
  for (let x = 0; x < CW; x++) out.data[(OY + 1) * CW + x] = 0xff4a5a60;
  const b = P.renderBody(id, anim, frame);
  const h = P.renderHead(id, { expr, mouth: 0, blink: false, look: (b.look ?? 'fwd') as 'fwd', hair: b.hair ?? 0 });
  const blit = (src: PixelBuffer, x0: number, y0: number) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.data[y * src.w + x]; if (v >>> 24) out.set(x0 + x, y0 + y, v); } };
  const head = () => {
    const cx = OX + (b.hx - b.ax), cy = OY + (b.hy - b.ay), rot = b.hrot ?? 0, ky = b.hflip ? -1 : 1;
    const c = Math.cos(rot), s = Math.sin(rot), R = 40;
    for (let Y = Math.floor(cy - R); Y <= cy + R; Y++) for (let X = Math.floor(cx - R); X <= cx + R; X++) {
      const dx = X + 0.5 - cx, dy = Y + 0.5 - cy;
      const u = Math.floor(dx * c + dy * s + h.ax), v = Math.floor((-dx * s + dy * c) / ky + h.ay);
      if (u < 0 || v < 0 || u >= h.buf.w || v >= h.buf.h) continue;
      const p = h.buf.data[v * h.buf.w + u];
      if (p >>> 24) out.set(X, Y, p);
    }
  };
  if (b.headBehind) head();
  blit(b.back, OX - b.ax, OY - b.ay);
  if (!b.headBehind) head();
  if (b.front) blit(b.front, OX - b.ax, OY - b.ay);
  return out;
}

export function runArohaGallery(name: string) {
  const q = new URLSearchParams(location.search);
  const who = name === 'combat' ? q.get('who') ?? 'aroha' : 'aroha';
  const items: GalleryItem[] = [];
  if (name === 'aroha') {
    for (const o of ['', '@ship', '@winter', '@winterHood', '@storm']) items.push({ name: 'aroha' + o, buf: composite('aroha' + o, 'idle', 0) });
    for (const e of ['neutral', 'happy', 'angry', 'smug', 'surprised', 'sad', 'determined', 'teasing']) items.push({ name: 'portrait ' + e, buf: renderAnimePortrait('aroha', e) });
    for (const e of ['neutral', 'smug', 'angry', 'laugh']) items.push({ name: 'HD ' + e, buf: renderAnimePortraitHD('aroha', e) });
    for (const a of ['idle', 'walk', 'run']) { const n = P.animFor('aroha', a)?.frames ?? 1; for (let f = 0; f < n; f += a === 'idle' ? 4 : 2) items.push({ name: `${a} ${f}`, buf: composite('aroha', a, f) }); }
  }
  for (const a of [...COMBAT_ANIMS, 'slingAim', 'slingStandoff']) {
    if (name === 'aroha' && who !== 'aroha') break;
    const n = P.animFor(who, a)?.frames ?? 1;
    for (let f = 0; f < n; f++) items.push({ name: `${a} ${f}`, buf: composite(who, a, f, 'determined') });
  }
  showGallery(items, 2, '#6d7f86');
}
