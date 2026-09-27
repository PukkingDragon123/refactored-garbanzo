// Dave-the-Diver-style busts for the five castaways (face looks right). Each design = FaceSpec +
// hair behind, clothes, hair in front and props, painted with the portrait kit.

import { Pic, Pt, tones } from './kit';
import { paintFace, lock, EXPR_PARAMS, PExpr, FaceSpec } from './face';
import { hex, mix, shade, C } from '../color';
import type { PixelBuffer } from '../pixel';

export type BustId = 'rowan' | 'crowe' | 'aroha' | 'lou' | 'pip';

interface Design {
  face: FaceSpec;
  back?(p: Pic, H: C[], m: number): void;
  body(p: Pic): void;
  front?(p: Pic, H: C[], m: number, ctx: Ctx): void;
  hair: string;
}
interface Ctx { skin: number; feat: number; talk: 0 | 1 | 2; expr: PExpr; S: C[]; small: boolean }

// ------------------------------------------------------------------ shared bust pieces

/** shoulders + chest silhouette with a cel shadow on the back side */
function torso(p: Pic, base: string, o: { broad?: number; shadowX?: number; m?: number } = {}) {
  const b = o.broad ?? 1;
  const T = tones(base, { sh: 0.2, deep: 0.38 });
  const m = o.m ?? p.m(3, true, 0.5);
  const cx = 96;
  p.fill([[74, 138], [114, 138], [138 + 6 * b, 146], [162 + 12 * b, 164], [174 + 14 * b, 200], [18 - 14 * b, 200], [26 - 10 * b, 164], [52 - 4 * b, 146]], T[2], m);
  p.where([m], (u, v) => u < (o.shadowX ?? 58) + (v - 150) * 0.25, T[1]);
  p.where([m], (u, v) => v > 188 && u < cx, T[1]);
  return { m, T };
}

// ------------------------------------------------------------------ designs

const ROWAN: Design = {
  // a young Darwin-style naturalist: swept chestnut hair, sideburns and stubble, field coat, cravat, a finch friend
  hair: '#6a3a1e',
  face: {
    skin: '#eab48e', chin: [1, 1], jawW: 1.04, cheek: 0,
    nose: { len: 0.95, size: 1, bump: 0.6 },
    eyes: { style: 'bold', iris: '#3a6a3a', size: 1.06, y: 0.5 },
    brow: { col: '#3e200e', w: 4.4, arch: 0.7, len: 1.15 },
    lip: '#b0584c',
  },
  back(p, H, m) {
    // volume at the back, falling over the collar
    p.fill([[50, 70], [48, 44], [62, 22], [86, 12], [110, 12], [126, 22], [118, 32], [90, 30], [72, 40], [66, 64], [70, 100], [58, 108], [50, 92]], H[1], m);
  },
  body(p) {
    // dark olive field coat with wide lapels, cream shirt, rust cravat, satchel strap, beetle pin
    const { m, T } = torso(p, '#4a5a34', { broad: 1 });
    const sh = p.m(4, true, 0.45);
    p.fill([[78, 134], [112, 136], [118, 160], [98, 176], [80, 160]], hex('#efe6d2'), sh);
    p.where([sh], (u) => u < 90, hex('#d4c8ae'));
    const lap = p.m(3, true, 0.5);
    p.fill([[64, 138], [80, 136], [96, 178], [72, 200], [54, 200], [50, 160]], T[3], lap);
    p.fill([[116, 136], [132, 142], [146, 168], [120, 200], [104, 200], [110, 170]], T[3], lap);
    p.stroke([[80, 138], [96, 176]], 1.4, 1.2, T[0], lap);
    p.stroke([[114, 138], [110, 172]], 1.4, 1.2, T[0], lap);
    const cv = p.m(5, true, 0.5);
    const K = tones('#b8502a');
    p.fill([[84, 134], [110, 136], [106, 148], [96, 152], [86, 146]], K[2], cv);
    p.fill([[92, 148], [102, 148], [106, 172], [98, 176], [90, 170]], K[2], cv);
    p.fill([[92, 148], [96, 150], [95, 172], [90, 170]], K[1], cv, { clip: [cv] });
    p.ell(97, 146, 4, 3, K[3], cv, { clip: [cv] });
    const strap = p.m(6, true, 0.5);
    p.stroke([[132, 142], [100, 178], [62, 200]], 8, 8, hex('#6a3e22'), strap);
    p.stroke([[132, 140], [100, 176], [62, 198]], 1.6, 1.6, hex('#9a6436'), strap, { clip: [strap] });
    // binoculars hanging on the chest
    const bn = p.m(8, true, 0.5);
    p.stroke([[86, 138], [92, 164]], 1.4, 1.4, hex('#3a2418'), bn);
    p.stroke([[112, 138], [108, 164]], 1.4, 1.4, hex('#3a2418'), bn);
    for (const x of [90, 106]) {
      p.fill([[x - 6, 162], [x + 5, 162], [x + 6, 184], [x - 6, 184]], hex('#2a2a30'), bn, { sharp: true });
      p.fill([[x - 6, 162], [x + 5, 162], [x + 5, 166], [x - 6, 166]], hex('#4a4a54'), bn, { sharp: true, clip: [bn] });
      p.ell(x, 185, 5, 2, hex('#6ab0c8'), bn);
      p.stroke([[x - 3, 170], [x - 3, 180]], 1.2, 1.2, hex('#5a5a66'), bn, { clip: [bn] });
    }
    p.fill([[95, 170], [101, 170], [101, 176], [95, 176]], hex('#1a1a20'), bn, { sharp: true });
    // field notebook in the breast pocket
    const nb = p.m(8, true, 0.5);
    p.fill([[60, 168], [72, 166], [74, 184], [62, 186]], hex('#a8342a'), nb, { sharp: true });
    p.stroke([[62, 170], [72, 168]], 1, 1, hex('#f0e0c0'), nb, { clip: [nb] });
    // beetle pin on the lapel (iridescent)
    const bt = p.m(7, true, 0.5);
    p.ell(128, 160, 3.4, 4.4, hex('#1e7a6a'), bt);
    p.ell(127, 158.5, 1.4, 1.6, hex('#8ae8c8'), bt, { clip: [bt] });
    p.stroke([[128, 156], [128, 164]], 0.7, 0.7, hex('#0e3a34'), bt, { clip: [bt] });
    void m;
  },
  front(p, H, m, c) {
    // swept-back wavy hair with a loose lock over the brow
    p.fill([[54, 60], [56, 36], [74, 18], [100, 12], [122, 18], [134, 34], [132, 46], [118, 38], [102, 34], [86, 38], [76, 48], [74, 66], [66, 78], [58, 74]], H[2], m);
    for (const [a, b, t] of [[[80, 22], [102, 18], [124, 28]], [[70, 32], [90, 26], [112, 30]], [[62, 46], [72, 36], [92, 34]]] as Pt[][]) p.stroke([a, b, t], 2.6, 1, H[3], m, { clip: [m] });
    lock(p, [112, 34], [124, 40], [128, 54], 8, H, m);
    lock(p, [100, 34], [108, 44], [110, 56], 6, H, m);
    // weathered explorer's hat with a leather band and a tucked feather
    const hat = p.m(10, true, 0.45);
    const Hh = tones('#9a7a4a');
    p.fill([[58, 34], [62, 12], [80, 0], [104, -2], [124, 6], [132, 26], [128, 34], [96, 28], [72, 32]], Hh[2], hat);
    p.fill([[62, 12], [80, 4], [100, 2], [96, 10], [78, 14], [66, 22]], Hh[3], hat, { clip: [hat] });
    p.where([hat], (u, v) => u < 72 && v > 8, Hh[1]);
    p.fill([[58, 28], [96, 22], [130, 22], [132, 30], [96, 30], [58, 36]], hex('#4a2a1a'), hat);
    p.fill([[30, 40], [60, 30], [100, 26], [140, 26], [160, 32], [150, 38], [120, 36], [96, 36], [70, 40], [44, 46]], Hh[2], hat);
    p.fill([[44, 44], [70, 38], [96, 34], [120, 34], [150, 36], [150, 38], [120, 38], [96, 38], [70, 42], [46, 48]], Hh[0], hat, { clip: [hat] });
    const fth = p.m(11, true, 0.4);
    p.stroke([[70, 30], [60, 14], [58, -2]], 5, 1.5, hex('#2a6a5a'), fth);
    p.stroke([[70, 30], [61, 14], [58, 0]], 1, 0.6, hex('#e8e0c8'), fth, { clip: [fth] });
    p.stroke([[66, 22], [60, 10]], 2, 1, hex('#e8a83a'), fth, { clip: [fth] });
    // sideburns down the jaw
    p.fill([[70, 66], [80, 66], [84, 90], [82, 104], [74, 100], [70, 84]], H[2], m);
    p.stroke([[76, 70], [80, 88]], 1.6, 1, H[3], m, { clip: [m] });
    // light stubble shadow along the jaw and chin
    if (!c.small) p.fill([[84, 102], [100, 112], [118, 116], [130, 112], [128, 122], [116, 126], [98, 122], [84, 112]], mix(c.S[1], hex('#6a4a38'), 0.3), c.skin, { clip: [c.skin] });
    // a little finch perched on the shoulder (hidden in sprite heads)
    if (!c.small) {
      const f = p.m(9, true, 0.45);
      p.ell(150, 132, 9, 6.5, hex('#8a6a44'), f, {}, -0.2);
      p.ell(158, 126, 5.5, 5, hex('#8a6a44'), f);
      p.fill([[162, 124], [168, 126], [162, 128]], hex('#3a2a1a'), f, { sharp: true });
      p.ell(158, 125, 1.1, 1.1, hex('#141010'), f);
      p.fill([[140, 130], [128, 128], [142, 136]], hex('#5a4228'), f, { sharp: true });
      p.ell(150, 134, 5, 3, hex('#c89a64'), f, { clip: [f] });
      p.stroke([[144, 128], [152, 130], [156, 134]], 1.4, 1, hex('#4a3420'), f, { clip: [f] });
      p.stroke([[146, 138], [146, 142]], 1, 1, hex('#3a2a1a'), f);
    }
  },
};

/** chunky curl: dark base, mid body, crescent light on the upper left */
function curl(p: Pic, x: number, y: number, r: number, H: C[], m: number, back: number) {
  p.ell(x, y, r, r * 0.9, back ? H[1] : H[2], m);
  p.ell(x - r * 0.18, y - r * 0.2, r * 0.72, r * 0.62, back ? H[2] : H[3], m, { clip: [m] });
  p.ell(x - r * 0.02, y - r * 0.02, r * 0.66, r * 0.58, back ? H[1] : H[2], m, { clip: [m] });
  p.ell(x + r * 0.3, y + r * 0.45, r * 0.5, r * 0.28, back ? H[0] : H[1], m, { clip: [m] });
}


const CROWE: Design = {
  hair: '#e6e0d6',
  face: {
    skin: '#f0b496', chin: [0, 2], jawW: 1.1, cheek: 1,
    nose: { len: 0.9, size: 1.45, bump: 1.5 },
    eyes: { style: 'narrow', iris: '#3a5a86', size: 0.9, y: 1 },
    brow: { col: '#f2eee6', w: 5.2, arch: 0.4, len: 1.25 },
    lip: '#a8484a', lines: true, blushCol: '#e05a4a',
  },
  body(p) {
    // cream cable-knit sweater, blue overall bib with brass buttons, red kerchief
    const { m, T } = torso(p, '#e4d6b8', { broad: 1.15 });
    for (let x = 30; x < 180; x += 12) p.stroke([[x, 150], [x + 3, 176], [x, 200]], 2.4, 2.4, T[1], m, { clip: [m] });
    const bib = p.m(4, true, 0.5);
    const B = tones('#3a5a8c');
    p.fill([[70, 164], [138, 164], [140, 200], [66, 200]], B[2], bib, { sharp: true });
    p.stroke([[60, 148], [74, 166]], 7, 7, B[2], bib);
    p.stroke([[146, 152], [134, 166]], 7, 7, B[2], bib);
    p.where([bib], (u, v) => u < 80, B[1]);
    for (const [x, y] of [[74, 168], [132, 168]] as Pt[]) { p.ell(x, y, 3.2, 3.2, hex('#e8b848'), bib, { clip: [bib] }); p.dot(x - 1, y - 1, hex('#fff0b0')); }
    const k = p.m(5, true, 0.5);
    const K = tones('#c8382c');
    p.fill([[76, 136], [118, 140], [112, 152], [98, 164], [84, 152]], K[2], k);
    p.fill([[96, 150], [108, 150], [104, 170], [96, 172]], K[1], k);
    p.ell(100, 147, 4, 3, K[3], k, { clip: [k] });
  },
  front(p, H, m, c) {
    // beard: full white beard over the jaw and neck; mustache over the lip
    const bd = p.m(8, true, 0.35);
    p.fill([[70, 88], [80, 104], [98, 116], [118, 118], [132, 110], [136, 120], [128, 138], [112, 152], [92, 154], [74, 140], [66, 116]], H[2], bd);
    for (const [x, y] of [[80, 126], [96, 140], [112, 136], [124, 124], [90, 120], [106, 150]] as Pt[]) p.ell(x, y, 6, 4, H[3], bd, { clip: [bd] });
    for (const [x, y] of [[72, 118], [86, 144], [104, 128], [120, 146]] as Pt[]) p.ell(x, y, 5, 3, H[1], bd, { clip: [bd] });
    // mouth opening through the beard when talking/shouting
    const open = c.talk > 0 || c.expr === 'shocked' || c.expr === 'laugh' || c.expr === 'surprised' || c.expr === 'angry';
    if (open) p.ell(123, 112, c.talk === 2 || c.expr === 'shocked' || c.expr === 'laugh' ? 7 : 5, c.talk === 2 || c.expr === 'shocked' || c.expr === 'laugh' ? 6 : 3.4, hex('#5a1620'), bd, { clip: [bd] });
    const mu = p.m(8, true, 0.35);
    p.fill([[128, 98], [118, 101], [106, 106], [110, 110], [122, 106], [134, 106], [140, 104], [136, 99]], H[2], mu);
    p.stroke([[112, 106], [122, 103], [134, 103]], 1.6, 1.2, H[3], mu, { clip: [mu] });
    // pipe
    if (c.expr !== 'laugh' && c.expr !== 'shocked' && c.expr !== 'eat' && c.talk === 0) {
      const pm = p.m(9, true, 0.5);
      p.stroke([[132, 108], [146, 112], [154, 110]], 3, 3, hex('#5a3420'), pm);
      p.fill([[150, 100], [160, 100], [161, 112], [158, 116], [151, 116], [149, 110]], hex('#8a5230'), pm);
      p.fill([[151, 100], [159, 100], [159, 103], [151, 103]], hex('#2a1810'), pm, { sharp: true });
      p.dot(154, 101, hex('#ff8a3a'));
    }
    // red knit beanie with a ribbed cuff
    const bn = p.m(6, true, 0.45);
    const R = tones('#b8382c');
    p.fill([[50, 72], [52, 42], [70, 18], [96, 10], [120, 16], [134, 34], [136, 52], [120, 56], [90, 58], [66, 66]], R[2], bn);
    p.fill([[48, 64], [70, 56], [98, 52], [124, 48], [138, 50], [138, 60], [122, 62], [96, 64], [72, 70], [50, 80]], R[1], bn);
    for (let x = 52; x < 138; x += 5) p.stroke([[x, 72 - (x - 50) * 0.22], [x, 62 - (x - 50) * 0.18]], 1.6, 1.6, R[0], bn, { clip: [bn] });
    for (let x = 60; x < 130; x += 7) p.stroke([[x, 46 - Math.abs(x - 95) * 0.1], [x + 2, 24 + Math.abs(x - 95) * 0.25]], 1.2, 1, R[3], bn, { clip: [bn] });
    // hair tufts under the cap at the back
    p.fill([[48, 78], [60, 76], [64, 92], [56, 98], [50, 90]], H[2], m, { under: true });
  },
};

const AROHA: Design = {
  hair: '#2a1a14',
  face: {
    skin: '#b97a52', chin: [-1, 0], jawW: 0.95, cheek: 0.5,
    nose: { len: 0.55, size: 0.95 },
    eyes: { style: 'lash', iris: '#2a1810', size: 1.18, y: -0.5 },
    brow: { col: '#1e120e', w: 3.6, arch: 1.8 },
    lip: '#9a4a40', blushCol: '#d86a5a', lips: true,
  },
  back(p, H, m) {
    // long hair falling behind the shoulders
    p.fill([[48, 60], [56, 30], [80, 16], [108, 16], [126, 28], [118, 40], [88, 44], [70, 70], [66, 110], [60, 150], [46, 188], [26, 176], [34, 130], [40, 96]], H[1], m);
    for (const x of [36, 46, 56]) p.stroke([[x + 10, 60], [x + 4, 120], [x - 4, 178]], 2, 1, H[2], m, { clip: [m] });
    // top-knot with huia-style feathers
    p.ell(70, 14, 13, 10, H[2], m);
    p.ell(66, 11, 7, 4, H[3], m, { clip: [m] });
    const fe = p.m(7, true, 0.4);
    for (const [a, l] of [[-2.75, 30], [-2.45, 27]] as [number, number][]) {
      const x0 = 64, y0 = 12, x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
      p.stroke([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 2], [x1, y1]], 5, 2, hex('#161218'), fe);
      p.stroke([[x0 + (x1 - x0) * 0.78, y0 + (y1 - y0) * 0.78], [x1, y1]], 4.6, 2, hex('#f4f0e6'), fe, { clip: [fe] });
      p.stroke([[x0, y0], [x1, y1]], 0.8, 0.6, hex('#5a5260'), fe, { clip: [fe] });
    }
    p.ell(76, 22, 6, 3, hex('#8ad0b0'), p.m(6, true, 0.5), {}, -0.4);
  },
  body(p) {
    // kahu huruhuru (feather cloak) over the shoulders with a taniko border
    const { m, T } = torso(p, '#a8743e', { broad: 1 });
    for (let y = 150; y < 200; y += 7) for (let x = 20 + ((y / 7) % 2) * 5; x < 180; x += 10) p.fill([[x, y], [x + 5, y + 2], [x + 4, y + 9], [x + 1, y + 9]], (x + y) % 3 ? T[3] : T[1], m, { clip: [m] });
    const tb = p.m(4, true, 0.5);
    p.fill([[40, 150], [80, 138], [118, 140], [150, 150], [152, 160], [118, 150], [80, 148], [42, 160]], hex('#1e1418'), tb);
    for (let x = 44; x < 150; x += 8) p.fill([[x, 157 - (x < 100 ? (100 - x) * 0.06 : 0)], [x + 4, 150], [x + 8, 157]], x % 16 ? hex('#c8382c') : hex('#f0e6d0'), tb, { clip: [tb], sharp: true });
    // pounamu pendant on a cord
    const pn = p.m(5, true, 0.5);
    p.stroke([[80, 132], [96, 150], [110, 134]], 1.2, 1.2, hex('#3a2418'), pn);
    p.fill([[92, 150], [100, 150], [102, 160], [97, 168], [92, 162]], hex('#3a9a6a'), pn);
    p.ell(96, 156, 1.8, 2.5, hex('#8ae0b0'), pn, { clip: [pn] });
  },
  front(p, H, m) {
    // hairline + side-swept locks framing the face, in front of the ear
    p.fill([[54, 56], [58, 34], [80, 20], [106, 18], [124, 26], [132, 40], [122, 38], [104, 34], [88, 40], [78, 54], [74, 72], [66, 86], [58, 80]], H[2], m);
    lock(p, [96, 30], [84, 48], [78, 78], 12, H, m);
    lock(p, [110, 26], [118, 34], [128, 46], 9, H, m);
    lock(p, [74, 50], [70, 74], [72, 104], 9, H, m);
    p.stroke([[100, 24], [110, 26], [122, 32]], 2, 1, H[3], m, { clip: [m] });
    // pounamu drop earring
    const er = p.m(5, true, 0.5);
    p.stroke([[68, 96], [68, 102]], 1, 1, hex('#3a2418'), er);
    p.fill([[66, 102], [71, 102], [71, 112], [68, 115], [65, 111]], hex('#3a9a6a'), er);
  },
};

const LOU: Design = {
  // the cook: older, sharp and very much in charge. Asymmetric blonde bob, sunglasses up top, pearls, lipstick
  hair: '#d8b070',
  face: {
    skin: '#f0c4a4', chin: [0, 0], jawW: 1.02, cheek: 0.5,
    nose: { len: 0.85, size: 1.05 },
    eyes: { style: 'lash', iris: '#4a6a8a', size: 0.92, y: 0.5 },
    brow: { col: '#8a6a44', w: 2.4, arch: 2.4, len: 1 },
    lip: '#b8384a', lines: true, lips: true, blushCol: '#e07a6a',
  },
  back(p, H, m) {
    // short stacked back of the bob
    p.fill([[48, 70], [46, 44], [60, 24], [84, 12], [104, 12], [118, 22], [96, 34], [74, 48], [70, 72], [62, 92], [52, 86]], H[1], m);
    for (const y of [48, 60, 72, 82]) p.stroke([[50, y], [62, y - 6], [70, y - 4]], 2, 1, H[0], m, { clip: [m] });
  },
  body(p) {
    // lavender cardigan over a cream blouse, white apron, a name badge
    const { m, T } = torso(p, '#9a86b8', { broad: 1.05 });
    void T;
    const bl = p.m(4, true, 0.45);
    p.fill([[80, 134], [112, 136], [114, 156], [96, 166], [80, 156]], hex('#f2e8d8'), bl);
    const ap = p.m(5, true, 0.4);
    const A = tones('#f4f0e6');
    p.fill([[70, 166], [130, 166], [134, 200], [66, 200]], A[2], ap, { sharp: true });
    p.stroke([[72, 168], [84, 142]], 3, 3, A[2], ap);
    p.stroke([[128, 168], [114, 142]], 3, 3, A[2], ap);
    p.where([ap], (u) => u < 80, A[1]);
    const bd = p.m(6, true, 0.5);
    p.fill([[140, 162], [158, 164], [157, 174], [139, 172]], hex('#f6f2e6'), bd, { sharp: true });
    p.fill([[140, 162], [158, 164], [158, 167], [140, 165]], hex('#c8384a'), bd, { sharp: true });
    p.stroke([[143, 170], [154, 171]], 1, 1, hex('#3a3040'), bd);
    void m;
  },
  front(p, H, m, c) {
    // the bob: long angled front sweeping past the jaw, spiky volume at the crown, lowlights
    p.fill([[56, 58], [58, 34], [76, 16], [102, 10], [124, 16], [136, 32], [134, 48], [122, 53], [108, 49], [95, 52], [87, 58], [89, 80], [91, 102], [85, 112], [74, 106], [68, 88], [58, 78]], H[2], m);
    for (const [a, b, t] of [[[96, 16], [114, 26], [122, 46]], [[80, 20], [90, 34], [88, 76]], [[118, 22], [128, 34], [130, 46]]] as Pt[][]) p.stroke([a, b, t], 3, 1.2, H[3], m, { clip: [m] });
    for (const [a, b, t] of [[[88, 24], [96, 40], [86, 100]], [[70, 30], [78, 44], [78, 64]]] as Pt[][]) p.stroke([a, b, t], 2, 1, H[1], m, { clip: [m] });
    // spiky crown
    for (const [x, y] of [[62, 24], [72, 14], [84, 8]] as Pt[]) p.fill([[x - 6, y + 10], [x, y - 6], [x + 6, y + 10]], H[2], m, { sharp: true });
    // sunglasses pushed up on the head
    if (!c.small) {
      const sg = p.m(7, true, 0.4);
      p.stroke([[66, 30], [90, 22], [118, 20]], 2.4, 2, hex('#1a1418'), sg);
      p.ell(98, 20, 9, 5, hex('#2a2230'), sg, {}, -0.15);
      p.ell(118, 18, 6, 4.5, hex('#2a2230'), sg);
      p.stroke([[94, 18], [100, 17]], 1.2, 1.2, hex('#8a8aa8'), sg, { clip: [sg] });
    }
    // pearl stud
    p.ell(66, 94, 2.2, 2.2, hex('#f6f2ea'), p.m(8, true, 0.3));
    p.dot(65.5, 93.5, hex('#ffffff'));
  },
};

const PIP: Design = {
  // tech wizard: slim anime girl, pink twin-tails, big round glasses, headphones, kawaii tee
  hair: '#f08cbc',
  face: {
    skin: '#fde2cf', chin: [0, 0], jawW: 0.86, cheek: 0, anime: true,
    nose: { len: 0.3, size: 0.6 },
    eyes: { style: 'lash', iris: '#c0407e', size: 1.3, y: 0 },
    brow: { col: '#d06a9a', w: 2, arch: 1.6, len: 0.8 },
    lip: '#f07888', blushCol: '#ff8aa0',
  },
  back(p, H, m) {
    // back of the head and long twin-tails
    p.fill([[50, 60], [54, 32], [78, 14], [106, 12], [128, 24], [110, 30], [80, 40], [66, 60], [58, 80]], H[1], m);
    p.fill([[54, 56], [36, 70], [24, 104], [22, 148], [30, 184], [44, 196], [48, 160], [46, 116], [54, 84]], H[2], m);
    p.stroke([[44, 70], [32, 110], [34, 160]], 3, 1, H[3], m, { clip: [m] });
    p.stroke([[50, 80], [42, 120], [40, 176]], 1.6, 1, H[1], m, { clip: [m] });
    p.ell(54, 60, 7, 6, hex('#8ae0e8'), p.m(6, true, 0.5));
    p.ell(52, 58, 2.4, 2, hex('#d8fbff'), p.m(6, true, 0.5));
  },
  body(p) {
    // slim shoulders, pastel kawaii tee (smiling cat + stars), lilac overall straps, headphones round the neck
    const tee = p.m(3, true, 0.45);
    const Tt = tones('#fff4fa');
    p.fill([[80, 132], [108, 132], [124, 142], [142, 158], [150, 200], [40, 200], [46, 160], [62, 142]], Tt[2], tee);
    p.where([tee], (u, v) => u < 60 + (v - 150) * 0.2, Tt[1]);
    p.fill([[84, 132], [104, 132], [100, 142], [88, 142]], hex('#ffc6de'), tee, { clip: [tee] });
    const art = p.m(4, false);
    p.ell(96, 178, 12, 10, hex('#ffb0d0'), art, { clip: [tee], retag: true });
    p.fill([[85, 172], [87, 161], [93, 169]], hex('#ffb0d0'), art, { sharp: true });
    p.fill([[99, 169], [105, 161], [107, 172]], hex('#ffb0d0'), art, { sharp: true });
    p.ell(91, 177, 1.4, 1.8, hex('#3a2030'), art);
    p.ell(101, 177, 1.4, 1.8, hex('#3a2030'), art);
    p.stroke([[93, 182], [96, 184], [99, 182]], 1, 1, hex('#3a2030'), art);
    p.ell(86, 181, 2.2, 1.2, hex('#ff8ab4'), art); p.ell(106, 181, 2.2, 1.2, hex('#ff8ab4'), art);
    for (const [x, y] of [[66, 172], [124, 184], [118, 162]] as Pt[]) p.fill([[x, y - 4], [x + 1.4, y - 1], [x + 4, y], [x + 1.4, y + 1], [x, y + 4], [x - 1.4, y + 1], [x - 4, y], [x - 1.4, y - 1]], hex('#ffd84a'), art, { sharp: true, clip: [tee] });
    const ov = p.m(5, true, 0.5);
    p.stroke([[66, 152], [70, 200]], 5, 5, hex('#b89ae8'), ov);
    p.stroke([[128, 154], [124, 200]], 5, 5, hex('#b89ae8'), ov);
    for (const [x, y] of [[68, 180], [126, 180]] as Pt[]) p.ell(x, y, 2.4, 2.4, hex('#fff0a0'), ov, { clip: [ov] });
    // headphones
    const hp = p.m(7, true, 0.5);
    p.stroke([[74, 134], [94, 148], [118, 136]], 3, 3, hex('#4a3a5a'), hp);
    p.ell(74, 136, 7, 8, hex('#5a4a6a'), hp);
    p.ell(74, 136, 4, 5, hex('#ff8ac0'), hp, { clip: [hp] });
    p.ell(118, 138, 5, 7, hex('#5a4a6a'), hp);
  },
  front(p, H, m, c) {
    // soft anime bangs with pointed strands, side locks framing the face
    p.fill([[56, 60], [58, 34], [78, 16], [104, 12], [124, 20], [134, 36], [137, 54], [133, 64], [128, 56], [123, 68], [117, 58], [110, 70], [103, 58], [95, 68], [89, 56], [82, 66], [78, 58], [76, 76], [68, 90], [58, 80]], H[2], m);
    for (const [a, b, t] of [[[86, 22], [104, 20], [122, 30]], [[72, 32], [86, 26], [100, 28]]] as Pt[][]) p.stroke([a, b, t], 3.2, 1.4, H[3], m, { clip: [m] });
    for (const [a, b] of [[[100, 36], [104, 56]], [[114, 38], [118, 58]], [[88, 40], [90, 54]]] as Pt[][]) p.stroke([a, b], 1.4, 0.8, H[1], m, { clip: [m] });
    lock(p, [76, 58], [72, 86], [76, 114], 10, H, m);
    lock(p, [134, 52], [138, 72], [134, 94], 6, H, m);
    // ahoge
    p.stroke([[98, 14], [102, 3], [112, 1]], 2.4, 1, H[2], m);
    // star hair clip
    const cl = p.m(6, true, 0.5);
    p.fill([[118, 24], [120, 18], [122, 24], [128, 25], [123, 28], [125, 34], [120, 30], [115, 34], [117, 28], [112, 25]], hex('#ffd84a'), cl, { sharp: true });
    // big round nerd glasses (sprite heads draw their own)
    if (!c.small) {
      const gl = p.m(8, false);
      const fr = hex('#d0407e');
      ring(p, [104, 84], 13, 12, 2, fr, gl);
      ring(p, [127.5, 83], 6.5, 11.5, 1.8, fr, gl);
      p.stroke([[117, 82], [119.5, 80], [121.5, 81.5]], 1.8, 1.8, fr, gl);
      p.stroke([[91, 82], [76, 80]], 1.8, 1.4, fr, gl);
      p.stroke([[95, 75], [98, 73]], 1.6, 1.6, hex('#ffffff'), gl);
    }
  },
};

function ring(p: Pic, c: Pt, rx: number, ry: number, w: number, col: C, m: number) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2; pts.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry]); }
  p.stroke(pts, w, w, col, m, { sharp: true });
}

export const DESIGNS: Record<BustId, Design> = { rowan: ROWAN, crowe: CROWE, aroha: AROHA, lou: LOU, pip: PIP };

/** Render a bust. scale = pixels per design unit (0.6 → 120 px square close-up). */
export function renderBust(id: BustId, expr: PExpr = 'neutral', o: { talk?: 0 | 1 | 2; blink?: boolean; scale?: number; headOnly?: boolean; noNeck?: boolean } = {}): PixelBuffer {
  const d = DESIGNS[id] ?? ROWAN;
  const s = o.scale ?? 0.6;
  const W = Math.round(200 * s), Hh = Math.round((o.headOnly ? 150 : 200) * s);
  const p = new Pic(W, Hh, s, 0, 0);
  const H = tones(d.hair, { sh: 0.18, deep: 0.36, hi: 0.22 });
  const hairM = p.m(2, true, 0.4);
  const HY = o.headOnly ? 0 : 9;
  p.ty = HY;
  d.back?.(p, H, hairM);
  p.ty = 0;
  if (!o.headOnly) d.body(p);
  p.ty = HY;
  const ex = EXPR_PARAMS[expr] ?? EXPR_PARAMS.neutral;
  const r = paintFace(p, o.noNeck ? { ...d.face, noNeck: true } : d.face, ex, o.talk ?? 0, !!o.blink);
  d.front?.(p, H, hairM, { skin: r.M.skin, feat: r.M.feat, talk: o.talk ?? 0, expr, S: r.S, small: !!o.noNeck });
  p.ty = 0;
  return p.finish();
}

export { mix, shade };
