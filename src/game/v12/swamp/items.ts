// V12 Te Repo Raupō finds: a peat core, a raupō root, the ember toad's toxin (taken with gloves on) and
// Koro's grandfather's pounamu matau from the whare on the hidden island (definitions with weights and
// lab text, and their illustrated item art). Imported at boot by ./species.ts so saves that carry them
// load anywhere.

import { defineItem, ITEMS } from '../../items';
import { artGroup, fp, RP, rp, hash, jar, H } from '../../../art/v11/items/kit';

if (!ITEMS.smp_peat) {
  defineItem({ id: 'smp_peat', name: 'Peat core', kind: 'material', stack: 6, weight: 0.5, where: 'Te Repo Raupō',
    desc: 'A plug of black swamp peat in a jar: wet, layered, smelling of old tea and eggs.',
    lab: { rp: 16, time: 4, text: 'Peat: the swamp\'s dead plants, waterlogged so they never rot. Each layer is a few years of raupō and sphagnum. The pollen grains caught in it are a calendar: under the microscope the bottom of the core is older than the first people on the island.' } });
  defineItem({ id: 'plt_raupo', name: 'Raupō root', kind: 'plant', stack: 6, weight: 0.3, where: 'Te Repo Raupō',
    desc: 'A thick white rhizome from under the mud, and a velvet brown seed head.',
    lab: { rp: 14, time: 4, text: 'Typha, raupō. The rhizome is all starch: the old people dug it and baked it, and pressed the golden pollen into cakes. The leaves thatched their whare and the down from the seed heads stuffed their pillows. The plant spreads through the mud, not by seed: a whole bed can be one plant.' } });
  defineItem({ id: 'smp_embertoxin', name: 'Ember toad toxin', kind: 'material', stack: 4, weight: 0.1, where: 'Te Repo Raupō',
    desc: 'A few drops of milky orange skin secretion in a stoppered vial. Do not lick. Do not even think about licking.',
    lab: { rp: 26, time: 5, species: 'embertoad', text: 'An alkaloid cocktail, much like the ones in poison frogs: it jams the nerves\' sodium channels. In a tiny dose it numbs; in a bigger one it scrambles balance, which explains the spinning. Every molecule of it came from the ants and beetles the toad eats.' } });
  defineItem({ id: 'swp_matau', name: 'Pounamu matau', kind: 'key', stack: 1, weight: 0.1, where: 'The whare on the hidden island',
    desc: 'A fish hook of greenstone, polished by hands and water, its flax lashing long rotted away. Koro\'s grandfather\'s.' });
}

const art = artGroup('Finds, taonga & samples');

art('smp_peat', fp(1, 1), p => {
  jar(p, 4, 1, 16, 22, {
    lid: RP.tin, level: 0.84,
    fill: (inner, top) => p.fill(inner, (x, y) => {
      if (y < top) return -1;
      // layers: black peat, brown raupō fibre, a pale ash band
      const band = Math.floor((y + Math.sin(x * 0.7) * 0.7) / 2.5) % 4;
      const R = band === 2 ? RP.mud : band === 3 && y > 16 ? rp('#5a5244', '#7a7060', '#9a907c', '#b8ae98', '#d0c8b0', '#e8e0cc') : rp('#0e0a08', '#1e1610', '#2e2218', '#3e2e20', '#56402c', '#6e5238');
      return p.tn(R, 0.45 + (y === top ? 0.3 : 0) - (x - 4) * 0.02 + (hash(x, y, 7) > 0.88 ? 0.2 : 0), x, y, 0.4);
    }),
    label: { y: 16, h: 4 },
  });
});

art('plt_raupo', fp(1, 1), p => {
  const leaf = rp('#1a240e', '#36491c', '#5a722a', '#879e42', '#a3b556', '#c2cc72');
  const head = rp('#1a0e08', '#3c2212', '#633b1f', '#8e5c34', '#b07c50', '#c89a6a');
  const root = rp('#6a6050', '#9a8e78', '#c4b8a0', '#e0d6c0', '#f2ead8', '#fffaf0');
  // the rhizome lying along the bottom, its white root hairs
  for (let x = 3; x < 21; x++) for (let y = 19; y < 22; y++) p.px(x, y, root[y === 19 ? 4 : y === 20 ? 3 : 1]);
  for (let x = 4; x < 21; x += 3) { p.px(x, 22, root[2]); p.px(x + 1, 23, root[1]); }
  // two leaves and the stalk
  for (let y = 2; y < 19; y++) { p.px(9 + Math.round((19 - y) * 0.12), y, leaf[3]); p.px(10 + Math.round((19 - y) * 0.12), y, leaf[4]); }
  for (let y = 6; y < 19; y++) { p.px(16 - Math.round((19 - y) * 0.18), y, leaf[2]); p.px(17 - Math.round((19 - y) * 0.18), y, leaf[4]); }
  for (let y = 1; y < 19; y++) p.px(13, y, leaf[y < 3 ? 5 : 3]);
  // the cigar head
  for (let y = 5; y < 13; y++) for (let x = 12; x < 15; x++) p.px(x, y, head[x === 12 ? 4 : x === 13 ? 3 : 1] );
  p.px(13, 4, head[5]); p.px(13, 13, head[2]);
});

art('smp_embertoxin', fp(1, 1), p => {
  jar(p, 6, 2, 12, 20, {
    cork: true, level: 0.46,
    fill: (inner, top) => p.fill(inner, (x, y) => (y < top ? -1 : y === top ? H('#ffe0a0', 230) : H(x < 11 ? '#f0a040' : '#d07020', 220))),
    label: { y: 14, h: 4, col: RP.paper, ink: H('#a02010') },
  });
  // a tiny warning toad drawn on the label
  p.px(11, 15, H('#e2601a')); p.px(12, 15, H('#e2601a')); p.px(13, 16, H('#2a1210')); p.px(10, 16, H('#2a1210'));
});

art('swp_matau', fp(1, 1), p => {
  const g = rp('#0a2a1a', '#164a2e', '#246a40', '#3a8a56', '#62ae74', '#9cd4a4');
  // a J of greenstone: the shank down from the lashing, round the bend, up to the point
  const pts: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const x = t < 0.45 ? 9 : t < 0.8 ? 9 + Math.sin((t - 0.45) / 0.35 * Math.PI) * 4.5 + (t - 0.45) * 12 : 17;
    const y = t < 0.45 ? 4 + t / 0.45 * 12 : t < 0.8 ? 16 + Math.sin((t - 0.45) / 0.35 * Math.PI) * 4 : 16 - (t - 0.8) / 0.2 * 8;
    pts.push([x, y]);
  }
  for (const [x, y] of pts) for (let dx = -1.6; dx <= 1.6; dx += 0.5) for (let dy = -1.6; dy <= 1.6; dy += 0.5) {
    if (dx * dx + dy * dy > 2.6) continue;
    const l = 0.5 - dx * 0.18 - dy * 0.2 + (hash(Math.round(x + dx), Math.round(y + dy), 5) > 0.85 ? 0.15 : 0);
    p.px(Math.round(x + dx), Math.round(y + dy), p.tn(g, l, Math.round(x + dx), Math.round(y + dy), 0.3));
  }
  // the barb at the point, the old lashing groove and a scrap of cord
  p.px(16, 8, g[4]); p.px(15, 9, g[3]);
  const cord = RP.flaxDry;
  for (let x = 7; x <= 11; x++) { p.px(x, 3, cord[3]); p.px(x, 4, cord[x & 1 ? 2 : 4]); }
  for (let k = 0; k < 6; k++) p.px(6 - k * 0.6, 4 + k, cord[2 + (k & 1)]);
  p.px(8, 8, g[5]); p.px(8, 9, g[5]);
});
