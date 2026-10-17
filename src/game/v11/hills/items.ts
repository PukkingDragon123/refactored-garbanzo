// V11 Rocky Hills finds: a granite sample, a mountain daisy and a spaniard seed head (definitions with
// weights and lab text, and their illustrated item art). Imported at boot by species-hills.ts so saves
// that carry them load anywhere.

import { defineItem, ITEMS } from '../../items';
import { artGroup, fp, RP, rp, hash, tone, noise2 } from '../../../art/v11/items/kit';

if (!ITEMS.smp_granite) {
  defineItem({ id: 'smp_granite', name: 'Granite sample', kind: 'material', stack: 6, weight: 0.6, where: 'The Rocky Hills',
    desc: 'A chip off a tor: pink, white and black crystals, rough as sandpaper.',
    lab: { rp: 16, time: 4, text: 'Coarse granite: pink potassium feldspar, milky quartz and flakes of black biotite, crystals that grew slowly as magma cooled kilometres underground. The tors are what is left after the softer rock around them weathered away.' } });
  defineItem({ id: 'plt_daisy', name: 'Mountain daisy', kind: 'plant', stack: 6, weight: 0.1, where: 'The Rocky Hills',
    desc: 'A big white daisy on a woolly stalk, from a rosette of silver leaves like felt.',
    lab: { rp: 14, time: 4, text: 'A Celmisia, a tikumu. Its leaves are covered in a mat of silver hairs that hold a layer of still air against the wind and frost and reflect the strong alpine sun. The torhoppers nip the flowers off; the leaves are too tough even for them.' } });
  defineItem({ id: 'plt_spaniard', name: 'Spaniard seed head', kind: 'plant', stack: 6, weight: 0.2, where: 'The Rocky Hills',
    desc: 'A golden spike of seeds wrapped in needle-tipped bracts. Handle with gloves. Or not at all.',
    lab: { rp: 15, time: 4, text: 'Aciphylla, the spear grass: a carrot relative armed like a hedgehog. Every leaf and bract ends in a hard needle. Here the torhoppers are its only browsers, and they eat it from the top down, very slowly, with their lips curled back.' } });
}

const art = artGroup('Finds, taonga & samples');

// a granite chip: pink feldspar, white quartz, black mica, a rough sparkle
art('smp_granite', fp(1, 1), p => {
  const m = p.lump(12, 13, 9.6, 8, 91, 0.22, 0.3);
  const dome = p.dome(m, 4);
  const pink = rp('#3a2622', '#6a4840', '#9a7064', '#c49a88', '#e6c4b0', '#fff0e4');
  p.fill(m, (x, y) => {
    const gx = (dome(x + 1, y) - dome(x - 1, y)) / 2, gy = (dome(x, y + 1) - dome(x, y - 1)) / 2;
    const l = p.lum(-gx, -gy, 1);
    const h = hash(x, y, 11), n = noise2(x * 0.4, y * 0.4, 13);
    const R = h > 0.86 ? RP.charcoal : n > 0.55 ? pink : RP.paper;
    return p.tn(R, l + (h < 0.06 ? 0.25 : 0), x, y, 0.5);
  });
  p.px(8, 8, tone(RP.paper[5], 0)); p.px(15, 10, tone(RP.paper[5], 0));
});

// a mountain daisy: silver leaves, a woolly stalk, a white flower with a gold eye
art('plt_daisy', fp(1, 1), p => {
  const silver = rp('#3e4a43', '#6b7a6f', '#9fad9f', '#c4d0c2', '#e2e8de', '#ffffff');
  const white = rp('#8a9296', '#b8c0c2', '#dfe4e2', '#f2f4f0', '#fbfcf8', '#ffffff');
  const gold = rp('#6a4808', '#9a6a10', '#c8921c', '#e8b830', '#f8d860', '#fff4b0');
  for (const [cx, cy, a] of [[8, 19, -0.7], [16, 19, 0.7], [12, 20, 0]] as const) {
    const m = p.maskEllipse(cx, cy, 5.5, 2.2, a);
    p.lit(m, silver, (x, y) => 0.55 + (y < cy ? 0.25 : -0.1) + (hash(x, y, 3) > 0.8 ? 0.1 : 0));
  }
  p.line(12, 18, 12, 10, silver[2]); p.line(13, 18, 13, 11, silver[3]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = p.maskEllipse(12.5 + Math.cos(a) * 4, 8 + Math.sin(a) * 3.4, 2.4, 1.1, a);
    p.lit(m, white, () => 0.6 + Math.sin(a + 2.3) * 0.25);
  }
  const eye = p.maskEllipse(12.5, 8, 2, 1.8);
  p.lit(eye, gold, (x, y) => 0.7 - (y - 7) * 0.12);
});

// a spaniard seed head: a golden spike with needle bracts
art('plt_spaniard', fp(1, 1), p => {
  const gold = rp('#4a3008', '#7a5410', '#a8781c', '#d0a030', '#ecc860', '#fff0b0');
  for (let y = 3; y < 22; y++) {
    const w = 1.6 + (y > 12 ? 0.6 : 0);
    for (let x = 12 - w; x <= 12 + w; x++) p.px(x, y, gold[x < 12 ? 3 : 2]);
    if (y % 3 === 0 && y > 4 && y < 20) {
      const L = 2 + (y / 22) * 4;
      for (let k = 0; k < L; k++) { p.px(13 + k, y - k * 0.6, gold[k > L - 2 ? 5 : 3]); p.px(11 - k, y - k * 0.6, gold[k > L - 2 ? 4 : 2]); }
    }
  }
});
