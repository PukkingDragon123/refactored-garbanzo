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
  await import('../game/v12/swamp/species');
  const ids = (q.get('id') ?? 'torhopper').split(',');
  const only = q.get('anim');
  const scale = +(q.get('scale') ?? 3);
  const anims = 0;
  const items: { name: string; buf: PixelBuffer }[] = [];
  const bar = new PixelBuffer(4, 62);
  for (let y = 0; y < 62; y++) for (let x = 0; x < 4; x++) bar.set(x, y, hex(y % 10 < 5 ? '#e8d8b0' : '#4a6a2a'));
  items.push({ name: 'Mori 62px', buf: bar });
  // (several ids, comma separated: the adults only)
  for (const id of ids) for (const juv of ids.length > 1 ? [false] : [false, true]) for (const [a, info] of Object.entries((B.BEAST_ANIMS as Record<string, Record<string, { frames: number }>>)[id] ?? {})) {
    if (only && a !== only) continue;
    for (let i = 0; i < info.frames; i++) items.push({ name: `${juv ? 'juv ' : ''}${a} ${i}`, buf: B.renderAny(id, a, i, undefined, juv ? 'juvenile' : 'adult').buf });
  }
  void anims;
  showGallery(items, scale, '#7d8a78');
}
