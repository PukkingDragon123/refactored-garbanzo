// V12 Te Ara Matatū, chapters 1 to 3: the things Mori brings back (definitions and their item art).
//   arc_rubbing   the kōwhaiwhai rubbing from the sealed whare's rafters: a map of the five old places
//   arc_bone      a fragment of the old taniwha's skull from the Bone Cliffs (four make the skull)

import { defineItem, ITEMS } from '../../items';
import { artGroup, fp, RP, rp, hash, H } from '../../../art/v11/items/kit';

if (!ITEMS.arc_rubbing) {
  defineItem({ id: 'arc_rubbing', name: 'Kōwhaiwhai rubbing', kind: 'key', stack: 1, weight: 0.1, where: 'The sealed whare at the Old Pā',
    desc: 'Charcoal on notebook paper, taken off the painted rafters of the whare the watchers were guarding: a running pattern of koru, and in it, if you know how to look, five eyes and the paths between them.' });
  defineItem({ id: 'arc_bone', name: 'Skull fragment', kind: 'material', stack: 4, weight: 0.8, where: 'Te Toka Iwi, the Bone Cliffs',
    desc: 'A piece of a skull bigger than a canoe\'s prow, heavy as stone because it IS stone now: bone turned to rock grain by grain.',
    lab: { rp: 22, time: 5, text: 'Permineralised bone: the spaces in the bone filled with silica and iron while the original tissue slowly dissolved. Under the microscope the growth rings still show, like a tree\'s. This animal grew for more than sixty years. The orbit is enormous for the skull: something that hunted in the dark.' } });
}

const art = artGroup('Te Ara Matatū');

art('arc_rubbing', fp(1, 1), p => {
  // a torn page from the notebook, a little curled, the charcoal pattern rubbed over it
  const paper = RP.paper, char = rp('#0e0c0e', '#1c191c', '#2c282b', '#403a3c', '#5a5254', '#8a8284');
  for (let y = 2; y < 22; y++) for (let x = 3; x < 21; x++) {
    const torn = (x === 3 || x === 20) && hash(x, y, 3) > 0.6;
    if (torn) continue;
    const curl = y > 18 && x > 16 ? -1 : 0;
    p.px(x, y, p.tn(paper, 0.72 - (x - 3) * 0.012 + curl * 0.25 + (hash(x, y, 1) > 0.85 ? -0.12 : 0), x, y, 0.4));
  }
  // the kōwhaiwhai: a running koru, the charcoal grain catching the paper's tooth
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, x = 5 + t * 13, y = 12 + Math.sin(t * Math.PI * 3) * 4;
    const px = Math.round(x), py = Math.round(y);
    if (hash(px, py, 5) > 0.25) p.px(px, py, char[1 + (i % 3 === 0 ? 1 : 0)]);
  }
  for (const [cx, cy, s] of [[7, 8, 1], [12, 16, -1], [17, 8, 1]] as [number, number, number][]) {
    for (let a = 0; a < 9; a += 0.35) {
      const r = 0.5 + a * 0.32, x = Math.round(cx + Math.cos(a * s) * r), y = Math.round(cy + Math.sin(a * s) * r);
      if (hash(x, y, 9) > 0.2) p.px(x, y, char[2]);
    }
  }
  // the five eyes: little rubbed-out circles, one pressed hard (the place it shows next)
  for (const [x, y, hard] of [[6, 4, 0], [11, 5, 0], [16, 4, 1], [9, 20, 0], [14, 19, 0]] as [number, number, number][]) {
    p.px(x, y, char[hard ? 0 : 3]); p.px(x + 1, y, char[hard ? 0 : 3]);
    if (hard) { p.px(x, y + 1, H('#a83a24')); p.px(x + 1, y + 1, H('#a83a24')); }
  }
});

art('arc_bone', fp(1, 1), p => {
  const bone = rp('#3a3020', '#5e4e34', '#857050', '#a89070', '#c8b290', '#e2d0ae');
  // a curved slab of skull: the rim of an eye socket along one edge, pitted, a crack across it
  for (let y = 3; y < 21; y++) for (let x = 3; x < 21; x++) {
    const d = Math.hypot(x - 16, y - 7);
    const inside = x + y * 0.4 > 8 && x - y * 0.3 < 18 && y < 20 - (x > 15 ? (x - 15) * 0.8 : 0) && d > 4.2;
    if (!inside) continue;
    let l = 0.75 - (y - 3) * 0.022 - (x - 3) * 0.01 + (d < 5.6 ? 0.2 : 0);
    if (hash(x, y, 7) > 0.88) l -= 0.25;
    if (Math.abs(y - (8 + x * 0.55)) < 0.6 && x < 14) l -= 0.4;
    p.px(x, y, p.tn(bone, l, x, y, 0.5));
  }
  // the socket's inner edge in shade
  for (let a = 1.6; a < 4.2; a += 0.15) { const x = Math.round(16 + Math.cos(a) * 4.5), y = Math.round(7 + Math.sin(a) * 4.5); if (x > 3 && y > 3) p.px(x, y, bone[1]); }
});
