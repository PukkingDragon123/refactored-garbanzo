// V12 the wild's food: huhu grubs from under the rotten logs, raw or steamed over a geothermal vent
// (src/game/v12/wild/encounters.ts), with their item art. Imported at boot by ./species.ts so saves
// that carry them load anywhere.

import { defineItem, ITEMS } from '../../items';
import { defineFood } from '../../v10/forage10';
import { artGroup, fp, rp } from '../../../art/v11/items/kit';

if (!ITEMS.huhu) {
  defineItem({ id: 'huhu', name: 'Huhu grubs', kind: 'food', stack: 8, weight: 0.05, where: 'Under the rotten logs of Te Tuawhenua',
    desc: 'Fat cream beetle larvae as long as your thumb, out of a rotten log. Eaten raw they taste nutty and buttery. Koro swears by them. Steamed they are better.' });
  defineItem({ id: 'huhu_cooked', name: 'Steamed huhu', kind: 'food', stack: 8, weight: 0.05, where: 'Cooked over the hot pools',
    desc: 'Huhu grubs steamed over a geothermal vent until the skins crisp. Smells like buttered popcorn, tastes like chicken and peanut butter.' });
}
defineFood('huhu', { energy: 9 });
defineFood('huhu_cooked', { energy: 20 });

const art = artGroup('Finds, taonga & samples');
const GRUB = rp('#6a5440', '#a08868', '#d0bc98', '#ece0c4', '#fff6e2', '#fffcf4');
const HEAD = rp('#1a0a04', '#3a1a08', '#5a2a0e', '#8a4a1a', '#b06a2a', '#d08a40');

/** a grub curled in a C, segment by segment, lit from the top left (x, y its middle; s 1 or -1 the curl) */
function grub(p: { px(x: number, y: number, c: number): void }, cx: number, cy: number, s: number, R: number[], H: number[], crisp = false) {
  for (let t = 0; t <= 1; t += 0.04) {
    const a = Math.PI * (0.15 + t * 1.25) * s;
    const x = cx + Math.cos(a) * 5, y = cy + Math.sin(a) * 4;
    const r = 2.4 - Math.abs(t - 0.45) * 1.6;
    for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) {
      if (dx * dx + dy * dy > r * r) continue;
      const seg = Math.floor(t * 11) % 2 === 0;
      const l = 3.2 - (dx + dy) * 0.35 + (seg ? 0.4 : -0.3) - (crisp && (Math.round(x + dx) + Math.round(y + dy)) % 3 === 0 ? 1.2 : 0);
      p.px(Math.round(x + dx), Math.round(y + dy), R[Math.max(0, Math.min(5, Math.round(l)))]);
    }
  }
  // the head at the end of the curl: a shiny brown capsule, the jaws darker
  const ha = Math.PI * 0.15 * s;
  const hx = Math.round(cx + Math.cos(ha) * 5), hy = Math.round(cy + Math.sin(ha) * 4);
  p.px(hx, hy, H[3]); p.px(hx + 1, hy, H[2]); p.px(hx, hy - 1, H[4]); p.px(hx + 1, hy + 1, H[1]); p.px(hx + 2, hy, H[0]);
}

art('huhu', fp(1, 1), p => {
  // on a curl of kawakawa leaf
  const leaf = rp('#0e2a10', '#1c4418', '#2e6422', '#44842e', '#5ea23e', '#7cbe52');
  for (let y = 12; y < 22; y++) for (let x = 2; x < 22; x++) {
    const nx = (x - 12) / 10, ny = (y - 17.5) / 4.5;
    if (nx * nx + ny * ny > 1) continue;
    p.px(x, y, leaf[Math.max(0, Math.min(5, Math.round(3 - ny * 1.2 + (x === 12 ? -1 : 0))))]);
  }
  grub(p, 8, 12, 1, GRUB, HEAD);
  grub(p, 15, 10, -1, GRUB, HEAD);
});

art('huhu_cooked', fp(1, 1), p => {
  // three steamed grubs on a flax skewer, golden and crisped
  const COOK = rp('#5a3410', '#8a5a1e', '#b8842e', '#d8aa4a', '#ecca72', '#f8e2a0');
  for (let x = 1; x < 23; x++) { p.px(x, 12 + Math.round((x - 12) * 0.08), rp('#2a3a10', '#3c5418', '#56722a', '#6e8e36', '#86a646', '#a0be5a')[x % 3 === 0 ? 2 : 3]); }
  grub(p, 6, 11, 1, COOK, HEAD, true);
  grub(p, 12, 13, -1, COOK, HEAD, true);
  grub(p, 18, 11, 1, COOK, HEAD, true);
});
