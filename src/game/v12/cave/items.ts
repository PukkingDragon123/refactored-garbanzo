// V12 Te Rua Pōuri finds: cave water, a cave crystal, bat guano from the roost at the mouth, a skin
// swab from a blind salamander (caught in the catch close-up and let go), and the lost caver's journal
// (definitions with weights and lab text, and their illustrated item art). Imported at boot by
// ./species.ts so saves that carry them load anywhere.

import { defineItem, ITEMS } from '../../items';
import { artGroup, fp, RP, rp, hash, jar, H } from '../../../art/v11/items/kit';

if (!ITEMS.smp_cavewater) {
  defineItem({ id: 'smp_cavewater', name: 'Cave water', kind: 'material', stack: 6, weight: 0.4, where: 'Te Rua Pōuri',
    desc: 'A jar of water from the dark stream: cold enough to ache, clear as glass, with something tiny and white swimming in it.',
    lab: { rp: 18, time: 4, text: 'Hard water, full of dissolved limestone: this is how the cave was made, one drop at a time. Under the microscope: blind white shrimp no bigger than a grain of rice, copepods, and bacteria that live on the minerals themselves, with no sunlight anywhere in their food chain.' } });
  defineItem({ id: 'smp_cavecrystal', name: 'Cave crystal', kind: 'material', stack: 4, weight: 0.3, where: 'Te Ana Tioata, the crystal gallery',
    desc: 'A blade of crystal from the gallery wall, clear at the tip, milky at the root. It glows a little blue in the dark, and keeps glowing after the lamp is put out.',
    lab: { rp: 28, time: 5, text: 'Calcite, laced with traces of something that phosphoresces: it soaks up the lantern\'s light and gives it back slowly. The gallery\'s blue glow is the walls remembering every light that ever passed.' } });
  defineItem({ id: 'smp_guano', name: 'Bat guano', kind: 'material', stack: 6, weight: 0.3, where: 'The bat roost at Te Kūaha',
    desc: 'A jar of dry, crumbly bat droppings from under the roost. Smells of ammonia and old moths.',
    lab: { rp: 14, time: 3, text: 'The cave\'s fertiliser. Full of moth wings and beetle shells: the bats feed outside and bring the forest in. The cave wētā, the springtails and half the life down here live on this heap.' } });
  defineItem({ id: 'smp_salswab', name: 'Blind salamander swab', kind: 'material', stack: 4, weight: 0.05, where: 'The pools of Te Awa Pōuri',
    desc: 'A cotton swab of skin mucus from a blind salamander, sealed in a glass tube. The salamander went back in the pool none the worse.',
    lab: { rp: 30, time: 5, species: 'blindsal', text: 'The skin is packed with light-sensitive cells: no eyes, but the whole animal can feel the difference between light and dark. Its DNA says its family has been in this cave for millions of years, cut off since the headland rose.' } });
  defineItem({ id: 'dc_journal', name: 'The caver\'s journal', kind: 'key', stack: 1, weight: 0.3, where: 'The lost caver\'s camp by the lake',
    desc: 'An oilskin notebook, swollen with damp, pencil entries in a neat hand. Inside the cover: "D. Pike, NZ Speleological Society, 1974. If found, please return."' });
}

const art = artGroup('Finds, taonga & samples');

art('smp_cavewater', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.tin, level: 0.8,
    fill: (inner, top) => p.fill(inner, (x, y) => {
      if (y < top) return -1;
      const W = rp('#20343c', '#2e4a54', '#46666e', '#6a8c92', '#9cbcc0', '#d8f0f0');
      return p.tn(W, 0.62 - (x - 4) * 0.02 + (y === top ? 0.25 : 0) + (hash(x, y, 3) > 0.9 ? 0.2 : 0), x, y, 0.4);
    }),
    label: { y: 17, h: 4 },
  });
  // a blind white shrimp swimming in it
  for (const [x, y] of [[10, 10], [11, 10], [12, 10], [13, 11], [9, 9], [12, 9]] as const) p.px(x, y, H(x === 9 ? '#c8c0b8' : '#f2ece4'));
});

art('smp_cavecrystal', fp(1, 1), p => {
  const g = rp('#0e2a3a', '#1c4a62', '#2e7090', '#5aa4c4', '#9cdcf0', '#e8fcff');
  // a long hexagonal blade, broken at the root, lit face, dark face, a bright ridge, the tip
  for (let y = 2; y < 22; y++) {
    const t = (y - 2) / 20;
    const cx = 13 - t * 3, half = y < 6 ? (y - 2) * 0.9 : 3.4 - t * 0.6;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - cx) / Math.max(1, half);
      const l = u < -0.25 ? 0.8 : u > 0.4 ? 0.3 : 0.6;
      p.px(x, y, p.tn(g, l + (hash(x, y, 9) > 0.92 ? 0.15 : 0), x, y, 0.3));
    }
    p.px(Math.round(cx - 0.6), y, g[5]);
  }
  // the milky root and its broken heel of stone
  for (let x = 7; x < 15; x++) for (let y = 19; y < 23; y++) p.px(x, y, y > 20 ? H(hash(x, y, 2) > 0.5 ? '#5a5258' : '#3a3438') : H('#c8dce4'));
});

art('smp_guano', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    cork: true, level: 0.66,
    fill: (inner, top) => p.fill(inner, (x, y) => {
      if (y < top) return -1;
      const B = rp('#140e0a', '#24180e', '#3a2a1a', '#56402a', '#7a5e40', '#a08060');
      const bit = hash(x, y, 5);
      return bit > 0.9 ? H('#c8b898') : p.tn(B, 0.5 + (y === top ? 0.3 : 0) - (x - 4) * 0.02 + (bit - 0.5) * 0.3, x, y, 0.5);
    }),
    label: { y: 15, h: 4 },
  });
});

art('smp_salswab', fp(1, 1), p => {
  // a glass tube with a cork, a wooden swab stick inside, the cotton tip faintly pink
  const glass = rp('#3a4a52', '#5a6e78', '#8aa0aa', '#bccad0', '#e4eef2', '#ffffff');
  for (let y = 3; y < 22; y++) for (let x = 8; x < 15; x++) {
    if (y === 21 && (x === 8 || x === 14)) continue;
    if (x === 8 || x === 14) p.px(x, y, glass[1]);
    else if (x === 9) p.px(x, y, glass[4]);
    else if (y === 21) p.px(x, y, glass[2]);
  }
  for (let y = 3; y < 6; y++) for (let x = 9; x < 14; x++) p.px(x, y, H(y === 3 ? '#b0804a' : '#8a5a30'));
  for (let y = 6; y < 17; y++) { p.px(11, y, H('#c8a070')); p.px(12, y, H('#9a7448')); }
  for (let y = 16; y < 20; y++) for (let x = 10; x < 14; x++) p.px(x, y, H(y === 16 || x === 10 ? '#fff4f2' : hash(x, y, 4) > 0.5 ? '#f0c4c4' : '#e8d8d4'));
  for (let y = 6; y < 21; y += 3) p.px(13, y, glass[3]);
});

art('dc_journal', fp(1, 1), p => {
  // a swollen oilskin notebook, its corners curled, an elastic band, a stub of pencil
  const cover = rp('#1a1e14', '#2a3020', '#3e4630', '#566046', '#707a5c', '#9aa080');
  for (let y = 4; y < 21; y++) for (let x = 3; x < 20; x++) {
    const curl = (x === 3 && y < 7) || (x === 19 && y > 18);
    if (curl) continue;
    const l = 0.5 + (y < 6 ? 0.2 : 0) - (x > 17 ? 0.2 : 0) + (hash(x, y, 7) > 0.85 ? 0.12 : 0) - (hash(x, y, 8) > 0.93 ? 0.2 : 0);
    p.px(x, y, p.tn(cover, l, x, y, 0.4));
  }
  // the page edges, the elastic, the pencil
  for (let x = 4; x < 19; x++) p.px(x, 21, H(x % 2 ? '#d8ccb0' : '#bcae90'));
  for (let y = 4; y < 22; y++) p.px(15, y, H('#5a2a20'));
  for (let x = 6; x < 20; x++) p.px(x, 2 + Math.round((x - 6) * 0.05), H(x > 17 ? '#2a2a2a' : x > 16 ? '#e8c890' : '#c8963a'));
  p.px(20, 3, H('#5a5a5a'));
});
