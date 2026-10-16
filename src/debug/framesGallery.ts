// ?gallery=frames&id=<beast id>: every frame of every anim of one registered beast, adult and juvenile
// (&scale=3, &anim=leap for one anim). Used to check new species art (e.g. the Rocky Hills' torhopper).

import { PixelBuffer } from '../art/pixel';
import { hex } from '../art/color';
import { showGallery } from './gallery';

export async function framesGallery(q: URLSearchParams) {
  const B = await import('../art/beasts');
  await import('../art/v9/wild/register');
  await import('../game/v11/species-tiger');
  await import('../game/v11/species-hills');
  const id = q.get('id') ?? 'torhopper';
  const only = q.get('anim');
  const scale = +(q.get('scale') ?? 3);
  const anims = (B.BEAST_ANIMS as Record<string, Record<string, { frames: number }>>)[id] ?? {};
  const items: { name: string; buf: PixelBuffer }[] = [];
  const bar = new PixelBuffer(4, 62);
  for (let y = 0; y < 62; y++) for (let x = 0; x < 4; x++) bar.set(x, y, hex(y % 10 < 5 ? '#e8d8b0' : '#4a6a2a'));
  items.push({ name: 'Mori 62px', buf: bar });
  for (const juv of [false, true]) for (const [a, info] of Object.entries(anims)) {
    if (only && a !== only) continue;
    for (let i = 0; i < info.frames; i++) items.push({ name: `${juv ? 'juv ' : ''}${a} ${i}`, buf: B.renderAny(id, a, i, undefined, juv ? 'juvenile' : 'adult').buf });
  }
  showGallery(items, scale, '#7d8a78');
}
