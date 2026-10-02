// ?gallery=hands: the V7 cast composited like the Actor draws them (body, head, front arm), to check
// hands, fingers, secondary motion and carried objects at sprite scale.
//   &ids=mori,jenna     who (default: all four)
//   &anims=idle:0,walk:3 clip:frame pairs (a bare clip shows every frame of it)
//   &outfit=winter      what they wear (default: their everyday clothes)
//   &scale=4            zoom
import { PixelBuffer } from '../art/pixel';
import { showGallery, GalleryItem } from './gallery';

export async function handsGallery(q: URLSearchParams) {
  const V7 = await import('../art/v7');
  const ids = (q.get('ids') ?? 'mori,jenna,joshu,aroha').split(',');
  const outfit = q.get('outfit');
  const scale = +(q.get('scale') ?? 4);
  const anims = (q.get('anims') ?? 'idle:0,walk:2,walk:8,run:3,talk:0,talk:1,wave:1,point:0,carryIdle:0,carryWalk:3').split(',');
  const items: GalleryItem[] = [];
  const t0 = performance.now();
  for (const id of ids) {
    const art = outfit ? `${id}@${outfit}` : id;
    for (const a of anims) {
      const [anim, f] = a.split(':');
      const n = V7.animFor(art, anim)?.frames ?? 1;
      const frames = f === undefined ? [...Array(n).keys()] : [+f];
      for (const fi of frames) items.push({ name: `${id} ${anim}${frames.length > 1 || f !== undefined ? ':' + fi : ''}`, buf: compose(V7, art, anim, fi, q.get('expr') ?? 'neutral') });
    }
  }
  const ms = performance.now() - t0;
  showGallery(items, scale, q.get('bg') ?? '#8a9a8c');
  const note = document.createElement('div');
  note.id = 'note';
  note.textContent = `${items.length} frames in ${ms.toFixed(0)} ms`;
  document.body.prepend(note);
}

type V7 = typeof import('../art/v7');
/** body + head + front layer, as Actor.draw stacks them */
export function compose(V: V7, art: string, anim: string, frame: number, expr = 'neutral'): PixelBuffer {
  const b = V.renderBody(art, anim, frame);
  const h = V.renderHead(art, { expr, mouth: 0, blink: false, look: b.look ?? 'fwd', hair: b.hair });
  const PAD = 26;
  const out = new PixelBuffer(b.back.w + PAD * 2, b.back.h + PAD * 2);
  const blit = (src: PixelBuffer, ox: number, oy: number, flipY = false) => {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.data[(flipY ? src.h - 1 - y : y) * src.w + x];
      if (c >>> 24) out.set(ox + x, oy + y, c);
    }
  };
  const hx = PAD + b.hx - h.ax, hy = PAD + b.hy - (b.hflip ? h.buf.h - h.ay : h.ay);
  if (b.headBehind) blit(h.buf, hx, hy, !!b.hflip);
  blit(b.back, PAD, PAD);
  if (!b.headBehind) blit(h.buf, hx, hy, !!b.hflip);
  if (b.front) blit(b.front, PAD, PAD);
  // the ground anchor
  out.set(PAD + b.ax, PAD + b.ay + 1, 0xff3030ff);
  return out;
}
