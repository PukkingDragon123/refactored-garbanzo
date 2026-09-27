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
  hair: '#3a2218',
  face: {
    skin: '#e9b58f', chin: [0, 0], jawW: 0.98, cheek: -1,
    nose: { len: 0.75, size: 0.9 },
    eyes: { style: 'soft', iris: '#4a2a1a', size: 1.02 },
    brow: { col: '#2a1810', w: 3.2, arch: 1.2 },
    lip: '#b85a50',
  },
  back(p, H, m) {
    // big curly mass behind the head and down the nape (chunky curls with crescent lights)
    const curls: [number, number, number][] = [[60, 48, 19], [52, 68, 15], [54, 88, 13], [60, 104, 11], [66, 116, 8], [74, 28, 18], [96, 20, 16], [116, 26, 13], [46, 50, 12]];
    for (const [x, y, r] of curls) curl(p, x, y, r, H, m, 1);
    // top-knot bun + blue tie
    p.ell(66, 12, 15, 11.5, H[2], m);
    p.ell(62, 8, 9, 5, H[3], m, { clip: [m] });
    p.ell(66, 16, 12, 6, H[2], m, { clip: [m] });
    p.ell(74, 21, 8, 3.2, hex('#3a78c8'), p.m(6, true, 0.5), {}, -0.45);
  },
  body(p) {
    // blue field parka with a stand-up collar, zip, camera strap across the chest
    const { m, T } = torso(p, '#3d6fb0', { broad: 0.85 });
    p.fill([[62, 126], [80, 140], [106, 142], [118, 128], [128, 146], [108, 158], [78, 156], [54, 142]], T[3], m);
    p.where([m], (u, v) => v > 151 && v < 158 && u > 70 && u < 114, T[1]);
    p.stroke([[112, 156], [116, 178], [118, 200]], 2.2, 2.2, T[0], m);
    const strap = p.m(4, true, 0.5);
    p.stroke([[54, 142], [98, 168], [146, 200]], 9, 9, hex('#7a4a2a'), strap);
    p.stroke([[54, 140], [98, 166], [146, 198]], 2, 2, hex('#a8703e'), strap, { clip: [strap] });
    const pb = p.m(5, true, 0.5);
    p.fill([[136, 166], [152, 168], [151, 182], [137, 180]], hex('#d8543e'), pb, { sharp: true });
    p.ell(144, 174, 3, 3, hex('#ffe08a'), pb, { clip: [pb] });
  },
  front(p, H, m, c) {
    // curly fringe: chunky clumps over the forehead, falling toward the face
    const fr: [number, number, number][] = [[70, 34, 12], [84, 26, 12], [100, 26, 12], [114, 32, 11], [125, 42, 9], [60, 52, 10], [92, 38, 9], [108, 42, 8], [120, 52, 6], [132, 50, 5]];
    for (const [x, y, r] of fr) curl(p, x, y, r, H, m, 0);
    // side hair framing the face down to the ear
    p.fill([[56, 44], [70, 40], [80, 52], [82, 66], [78, 76], [70, 74], [58, 70]], H[1], m);
    p.stroke([[68, 48], [75, 56], [77, 66]], 2.4, 1.2, H[2], m, { clip: [m] });
    curl(p, 76, 72, 5, H, m, 0);
    // round glasses: thin dark frames, faint lens glare (sprite heads draw their own 1px frames)
    if (c.small) return;
    const gl = p.m(7, false);
    const ink = hex('#1c1418');
    ring(p, [102, 79], 11.5, 10.5, 2.2, ink, gl);
    ring(p, [126.5, 79], 5.6, 9.8, 2, ink, gl);
    p.stroke([[113.5, 77], [117, 75.5], [121, 77]], 2, 2, ink, gl);
    p.stroke([[90.5, 77], [72, 75]], 2, 1.6, ink, gl);
    p.stroke([[95, 72], [98, 70.5]], 1.6, 1.6, hex('#ffffff'), gl);
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
  hair: '#2a1c16',
  face: {
    skin: '#9c6a46', chin: [0, 1], jawW: 1.2, cheek: 2.5,
    nose: { len: 0.7, size: 1.4 },
    eyes: { style: 'soft', iris: '#24140e', size: 0.98, y: 0.5 },
    brow: { col: '#1e1410', w: 4.4, arch: 0.8 },
    lip: '#7a3a32', blushCol: '#d0605a',
  },
  body(p) {
    // red aloha shirt with white hibiscus + a white apron bib
    const { m, T } = torso(p, '#c83a36', { broad: 1.25 });
    const fl: Pt[] = [[36, 170], [60, 188], [150, 176], [170, 196], [40, 196], [158, 160]];
    for (const [x, y] of fl) { for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; p.ell(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 3.4, hex('#f6ece0'), m, { clip: [m] }); } p.ell(x, y, 2, 2, hex('#f0b848'), m, { clip: [m] }); }
    p.fill([[80, 138], [96, 152], [112, 140], [118, 150], [96, 164], [74, 150]], T[3], m);
    const ap = p.m(4, true, 0.4);
    const A = tones('#f2ece0');
    p.fill([[64, 168], [134, 168], [138, 200], [60, 200]], A[2], ap, { sharp: true });
    p.stroke([[66, 170], [80, 142]], 3.4, 3.4, A[2], ap);
    p.stroke([[132, 170], [118, 142]], 3.4, 3.4, A[2], ap);
    p.where([ap], (u) => u < 76, A[1]);
    p.fill([[84, 180], [114, 180], [114, 196], [84, 196]], A[1], ap, { clip: [ap], sharp: true });
  },
  front(p, H, m) {
    // short hair at the temple, then the teal patterned head wrap with a knot at the back
    p.fill([[58, 64], [62, 50], [76, 50], [80, 70], [72, 80], [62, 78]], H[2], m);
    const wr = p.m(6, true, 0.45);
    const W = tones('#2aa8a0');
    p.fill([[50, 68], [52, 40], [72, 18], [100, 12], [124, 20], [136, 38], [136, 54], [118, 52], [92, 52], [70, 58], [58, 66]], W[2], wr);
    p.where([wr], (u, v) => u < 70 || v > 50, W[1]);
    for (let y = 18; y < 58; y += 7) for (let x = 54 + (y % 2) * 3; x < 136; x += 8) p.ell(x, y, 1.5, 1.5, hex('#f8d850'), wr, { clip: [wr] });
    const band = p.m(6, true, 0.45);
    p.fill([[52, 64], [72, 54], [96, 48], [122, 46], [138, 48], [138, 56], [120, 55], [96, 56], [72, 62], [54, 72]], hex('#e8483a'), band);
    // knot + tails at the back of the head
    p.ell(44, 50, 9, 7, W[2], wr);
    p.fill([[40, 54], [30, 76], [36, 80], [46, 58]], W[1], wr);
    p.fill([[46, 56], [44, 82], [51, 82], [52, 58]], W[2], wr);
    // small gold stud
    p.ell(68, 94, 1.6, 1.6, hex('#f0c040'), p.m(5, true, 0.5));
  },
};

const PIP: Design = {
  hair: '#1c1c26',
  face: {
    skin: '#f2caa8', chin: [-2, -2], jawW: 0.9, cheek: -1,
    nose: { len: 0.55, size: 0.85 },
    eyes: { style: 'bold', iris: '#2a2a3a', size: 1.1, y: 0.5 },
    brow: { col: '#16161e', w: 3.4, arch: 1 },
    lip: '#c06a60', blushCol: '#f08070',
  },
  back(p, H, m) {
    p.ell(78, 52, 30, 32, H[1], m);
  },
  body(p) {
    // dark tee under orange overalls, a wrench in the bib pocket
    const { m, T } = torso(p, '#3a3a44', { broad: 0.8 });
    void T;
    const ov = p.m(4, true, 0.5);
    const O = tones('#e8762a');
    p.fill([[70, 166], [132, 166], [136, 200], [66, 200]], O[2], ov, { sharp: true });
    p.stroke([[58, 148], [72, 168]], 8, 8, O[2], ov);
    p.stroke([[142, 150], [130, 168]], 8, 8, O[2], ov);
    p.where([ov], (u) => u < 80, O[1]);
    p.fill([[88, 172], [114, 172], [114, 190], [88, 190]], O[1], ov, { clip: [ov], sharp: true });
    const wr = p.m(5, true, 0.5);
    p.stroke([[106, 176], [110, 160]], 3, 3, hex('#9aa8b4'), wr);
    p.ell(110.5, 158, 3.6, 3, hex('#9aa8b4'), wr);
    p.ell(111, 157, 1.4, 1.6, O[1], wr, { clip: [wr] });
    for (const [x, y] of [[74, 170], [128, 170]] as Pt[]) p.ell(x, y, 2.6, 2.6, hex('#d8d0c0'), ov, { clip: [ov] });
  },
  front(p, H, m, c) {
    // spiky short hair: locks radiating from the crown, fringe falling over the brow
    const locks: [Pt, Pt, Pt, number][] = [
      [[80, 30], [66, 20], [50, 22], 14], [[84, 26], [80, 10], [72, 2], 12], [[92, 26], [100, 10], [110, 4], 12], [[100, 30], [116, 20], [130, 20], 12],
      [[104, 36], [122, 38], [134, 50], 10], [[98, 40], [112, 52], [118, 66], 9], [[90, 40], [96, 56], [98, 68], 9], [[76, 40], [74, 58], [70, 74], 11], [[66, 42], [56, 58], [52, 76], 12],
    ];
    p.fill([[52, 64], [54, 38], [70, 22], [94, 18], [116, 24], [128, 38], [120, 44], [100, 42], [82, 46], [70, 56], [62, 72]], H[2], m);
    for (const [a, b, t, w] of locks) lock(p, a, b, t, w, H, m);
    // goggles pushed up on the head
    const gg = p.m(7, true, 0.5);
    p.stroke([[50, 50], [80, 38], [118, 34], [134, 40]], 5, 5, hex('#3a2a20'), gg);
    for (const [x, y, r] of [[92, 30, 9], [116, 28, 7.5]] as [number, number, number][]) {
      p.ell(x, y, r, r * 0.9, hex('#b8862a'), gg);
      p.ell(x, y, r * 0.7, r * 0.62, hex('#2ab0b8'), gg, { clip: [gg] });
      p.ell(x - r * 0.25, y - r * 0.2, r * 0.25, r * 0.2, hex('#c8fff8'), gg, { clip: [gg] });
    }
    // grease smudge on the cheek
    p.ell(110, 96, 4, 1.6, mix(c.S[1], hex('#3a3a44'), 0.4), c.skin, { clip: [c.skin] }, -0.3);
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
