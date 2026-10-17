// V11 NPCs: dialogue portraits and HD close-up busts, drawn with the same portrait kit and rules as
// the main cast (src/art/anime/portraits.ts): smooth shapes, flat cel tones, an ink outline; the
// eye / brow / mouth templates come from the shared expression set. Each face is built to read on its
// own at a glance: the hat or the hair is the silhouette, then the face, then the collar.

import type { PortraitDesign, PortraitMats, PortraitExpr } from '../../anime/portraits';
import { tones } from '../../portrait/kit';
import type { Pic, Pt } from '../../portrait/kit';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { PixelBuffer } from '../../pixel';

type Tone = [C, C, C, C];
const PW = 56, CX = 28;
const T = (h: string, o: Parameters<typeof tones>[1] = {}): Tone => tones(h, o);
const col = (h: string) => hex(h);
type M = PortraitMats;

/** a closed outline from its left half: bottom-left → ... → the centre point, mirrored to the right */
const mirror = (pts: Pt[]): Pt[] => [...pts, ...pts.slice(0, -1).reverse().map(([u, v]): Pt => [PW - u, v])];

/** shoulders and chest: k 0 narrow (a girl's), 1 broad (a big man's) */
function shoulders(p: Pic, m: M, c: Tone, k: number, mat = m.cloth) {
  const l = (a: number, b: number) => a + (b - a) * k;
  p.fill(mirror([[l(3, -4), 60], [l(6, -2), l(51, 51.6)], [l(14, 3), l(46.4, 47.6)], [l(CX - 6, 11), l(45.6, 46.2)], [CX, 45.4]]), c[2], mat);
  p.where([mat], (u, v) => u > PW - l(14, 12) || v > 58.2, c[1]);
}
/** an open collar: skin in a V down from the throat (the neck's material, so the jaw shadow stays off it) */
function vNeck(p: Pic, m: M, skin: Tone, depth = 52, w = 6) {
  p.fill([[CX - w, 45.2], [CX + w, 45.2], [CX, depth]], skin[2], m.neck, { sharp: true });
}
/** shirt collar points either side of the V */
function collarPoints(p: Pic, m: M, c: Tone, w = 8, depth = 50.6) {
  p.fill([[CX - w - 0.6, 44.6], [CX - 1, depth - 0.4], [CX - 3.2, depth + 1.8], [CX - w - 2.2, 48]], c[3], m.cloth2);
  p.fill([[CX + w + 0.6, 44.6], [CX + 1, depth - 0.4], [CX + 3.2, depth + 1.8], [CX + w + 2.2, 48]], c[2], m.cloth2);
}
/** set a pixel only over something already drawn */
const over = (b: PixelBuffer, x: number, y: number, c: C) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h && b.get(x, y) >>> 24) b.set(x, y, c); };
/** round spectacles drawn over the finished face, centred on each eye (design units; S = scale) */
function ringSpecs(b: PixelBuffer, S: number, ex: number, ey: number, r: number, c: C, w = 7, lens?: C) {
  for (const cx of [ex + w / 2, PW - ex - w / 2]) {
    const cy = ey + 2.2;
    const n = Math.round(40 * S);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      over(b, (cx + Math.cos(a) * r) * S, (cy + Math.sin(a) * r * 0.86) * S, c);
    }
    if (lens) for (let y = -r; y <= r; y += 1 / S) for (let x = -r; x <= r; x += 1 / S) if ((x / r) ** 2 + (y / (r * 0.86)) ** 2 < 0.55 && x < -r * 0.2 && y < -r * 0.2) over(b, (cx + x) * S, (cy + y) * S, mix(b.get(Math.round((cx + x) * S), Math.round((cy + y) * S)), lens, 0.4));
  }
  // the bridge
  for (let x = ex + w + r * 0.3; x < PW - ex - w - r * 0.3; x += 0.5 / S) over(b, x * S, (ey + 1.4) * S, c);
}
/** a few freckles across the nose and cheeks */
function freckles(b: PixelBuffer, S: number, c: C, ey: number) {
  for (const [x, y] of [[-7, 7], [-5, 8], [-9, 8.5], [-3, 6.5], [7, 7], [5, 8], [9, 8.5], [3, 6.5], [-6, 9.6], [6, 9.6]]) over(b, (CX + x) * S, (ey + y) * S, c);
}

// ================================================================== Hine: the senior ranger
const HINE: PortraitDesign = {
  skin: T('#a86a42', { sh: 0.12, deep: 0.28, hi: 0.07 }),
  eyes: 'almond', iris: ['#140a06', '#4a2a16', '#8a5a30'], lash: '#140a08', brow: '#1e1410', browH: 2, browArch: 0.8,
  blush: '#c0644e', blushK: 0.5, lip: '#7a3e30', weathered: false,
  faceW: 1.04, chin: 0.2, eyeX: 16, eyeY: 26, mouthY: 38, neck: [5.8, 6.8],
  cheek: [CX - 9, 30, 3.2, 1.6],
  back(p, m) {
    const [, hs, hb] = T('#2e2a2c', { sh: 0.2 });
    // hair drawn back to a low bun behind the neck
    p.fill([[CX - 14.6, 30], [CX - 15.4, 18], [CX + 15.4, 18], [CX + 14.6, 30], [CX + 12, 36], [CX - 12, 36]], hb, m.hairB);
    void hs;
  },
  body(p, m) {
    const shirt = T('#7e7a48', { sh: 0.16 }), green = T('#44582a', { sh: 0.18 });
    shoulders(p, m, shirt, 0.62);
    // green epaulettes on the shoulders, buttoned down
    p.fill([[3.4, 50.6], [12, 47.2], [14, 49.2], [5, 52.6]], green[2], m.acc, { sharp: true });
    p.fill([[PW - 3.4, 50.6], [PW - 12, 47.2], [PW - 14, 49.2], [PW - 5, 52.6]], green[1], m.acc, { sharp: true });
    vNeck(p, m, this.skin, 51.4, 5.6);
    collarPoints(p, m, shirt, 7.4, 50);
    // the fern badge on the near pocket
    p.fill([[9, 54], [17, 54], [17, 60], [9, 60]], shirt[1], m.cloth2, { sharp: true });
    p.ell(13, 56.6, 2.1, 2.4, col('#e8e0c0'), p.m(8, true, 0.4));
    p.where([m.cloth2], (u, v) => v > 53.4 && v < 54.6 && u > 9 && u < 17, shirt[3]);
  },
  front(p, m) {
    const felt = T('#9a7a52', { sh: 0.2, deep: 0.36, hi: 0.12 }), band = T('#30401c');
    // a lock of grey-black hair at each temple, a grey streak
    const [, hs, hb, hl] = T('#2e2a2c', { sh: 0.2, hi: 0.3 });
    p.fill([[CX - 14.8, 26], [CX - 15.2, 16], [CX - 9, 14.6], [CX - 12.4, 21.6]], hb, m.hair);
    p.fill([[CX + 14.8, 26], [CX + 15.2, 16], [CX + 9, 14.6], [CX + 12.4, 21.6]], hs, m.hair);
    p.where([m.hair], (u, v) => u < CX - 12.6 && v > 16 && v < 22, hl);
    // the ranger hat: a pinched crown, a broad stiff brim across the brow
    const mc = p.m(6, true, 0.5);
    p.fill([[CX - 11.6, 13.4], [CX - 10.6, 4.6], [CX - 4, 1.4], [CX, 3.2], [CX + 4, 1.4], [CX + 10.6, 4.6], [CX + 11.6, 13.4]], felt[2], mc);
    p.where([mc], (u, v) => u > CX + 5 || Math.abs(u - CX) < 0.8, felt[1]);
    p.where([mc], (u, v) => v > 10 && v < 13.6, band[2]);
    const mb = p.m(7, true, 0.5);
    p.ell(CX, 14.4, 27.5, 3.4, felt[2], mb);
    p.where([mb], (u, v) => v > 14.8, felt[1]);
    p.where([mb], (u, v) => v < 13.2 && u < CX - 4, felt[3]);
  },
  post(b) {
    // laugh lines either side of the mouth
    const sk = this.skin;
    for (const sd of [-1, 1]) { over(b, CX + sd * 5, 36, sk[1]); over(b, CX + sd * 5, 37, sk[1]); }
  },
  postHD(b, S) {
    const sk = this.skin;
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) over(b, (CX + sd * (5.2 + i * 0.12)) * S, (35.4 + i * 0.6) * S, sk[1]);
    // crow's feet from smiling into the sun
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) over(b, (CX + sd * (14.6 + i * 0.4)) * S, (26.4 + i * 0.9) * S, mix(sk[1], sk[2], 0.5));
  },
};

// ================================================================== Doug: the birder
const DOUG: PortraitDesign = {
  skin: T('#f0b494', { sh: 0.12, deep: 0.28, hi: 0.06 }),
  eyes: 'man', iris: ['#10222c', '#3a6a82', '#7aaac0'], lash: '#3a2018', brow: '#a06a44', browH: 2, browArch: 1.2,
  blush: '#f08a78', blushK: 0.8, lip: '#b0604a', noseBridge: true, adam: false,
  faceW: 0.94, chin: 1.4, eyeX: 17, eyeY: 25, mouthY: 38, neck: [5, 6],
  back(p, m) {
    // a mop of curls round the back and sides
    const [, hs, hb] = T('#b48c70', { sh: 0.2 });
    for (const [x, y, r] of [[CX - 15, 14, 5], [CX - 16.4, 22, 4.6], [CX + 15, 14, 5], [CX + 16.4, 22, 4.6], [CX - 9, 6, 6], [CX + 9, 6, 6], [CX, 4, 6.4]] as [number, number, number][]) p.ell(x, y, r, r * 0.92, hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 8, hs);
  },
  body(p, m) {
    const shirt = T('#9a7a52', { sh: 0.16 });
    shoulders(p, m, shirt, 0.3);
    p.where([m.cloth], (u, v) => v > 47 && Math.abs(u - CX) > 15 && ((u * 0.7 + v) % 5) < 0.8, shirt[1]);
    collarPoints(p, m, shirt, 7, 49);
    // the binocular strap round the neck
    p.stroke([[CX - 10, 46], [CX - 12, 52], [CX - 11, 60]], 1.2, 1.2, col('#1e1e22'), m.acc);
    p.stroke([[CX + 10, 46], [CX + 12, 52], [CX + 11, 60]], 1.2, 1.2, col('#16161a'), m.acc);
  },
  front(p, m) {
    const beard = T('#b48c70', { sh: 0.16, deep: 0.3, hi: 0.1 });
    const [, hs, hb, hl] = T('#b48c70', { sh: 0.2, hi: 0.18 });
    // the curly fringe: a row of fat curls along the hairline
    for (let i = 0; i < 7; i++) p.ell(CX - 12 + i * 4, 11.6 + Math.abs(i - 3) * 0.7 - (i % 2) * 0.8, 3.4, 3, hb, m.hair);
    p.where([m.hair], (u, v) => ((u + v * 0.6) % 4) < 0.9, hs);
    p.where([m.hair], (u, v) => v < 10 && u < CX, hl);
    // the big beard: from the sideburns over the jaw, down to the collar
    const B: Pt[] = mirror([[CX - 14.4, 22], [CX - 15.6, 31], [CX - 14.6, 41], [CX - 10, 50], [CX - 4, 53.6], [CX, 54.4]]);
    const inner: Pt[] = [[CX + 12.6, 26], [CX + 10, 33], [CX + 5, 35.4], [CX, 35.2], [CX - 5, 35.4], [CX - 10, 33], [CX - 12.6, 26]];
    p.fill([...B, ...inner], beard[2], m.beard);
    p.where([m.beard], (u, v) => Math.abs(Math.sin(u * 0.9 + Math.sin(v * 0.5) * 2)) < 0.25 && v > 38, beard[1]);
    p.where([m.beard], (u, v) => u > CX + 7 || v > 50, beard[1]);
    p.where([m.beard], (u, v) => (u - CX + 8) ** 2 / 16 + (v - 42) ** 2 / 20 < 1, beard[3]);
    // the moustache over the mouth
    p.fill([[CX - 8, 37], [CX - 4, 34.8], [CX, 35.6], [CX + 4, 34.8], [CX + 8, 37], [CX + 4, 38], [CX, 37.4], [CX - 4, 38]], beard[3], m.acc);
  },
  post(b) { ringSpecs(b, 1, 17, 25, 4.4, col('#1a1416'), 6); },
  postHD(b, S) { ringSpecs(b, S, 17, 25, 4.4, col('#1a1416'), 6, col('#d8f0ff')); },
};

// ================================================================== Rosie: the junior ranger
const ROSIE: PortraitDesign = {
  skin: T('#fbd2b4', { sh: 0.1, deep: 0.22, hi: 0.05 }),
  eyes: 'girl', iris: ['#1a3018', '#4a8a3a', '#9ad070'], lash: '#4a2418', brow: '#b05a2e', blush: '#f49080', rosy: true,
  faceW: 0.9, chin: -1.6, eyeX: 18, eyeY: 27, mouthY: 38, neck: [4, 4.6],
  back(p, m) {
    const [, hs, hb] = T('#c8642c', { sh: 0.18 });
    // the bunches sticking out either side under the hat
    p.fill([[CX - 13, 24], [CX - 22, 27], [CX - 24.4, 33], [CX - 20, 35], [CX - 13, 30]], hb, m.hairB);
    p.fill([[CX + 13, 24], [CX + 22, 27], [CX + 24.4, 33], [CX + 20, 35], [CX + 13, 30]], hs, m.hairB);
    p.ell(CX, 18, 14.4, 9, hb, m.hairB);
  },
  body(p, m) {
    const tee = T('#c83a2a'), white = T('#f2ece4'), denim = T('#34466a', { sh: 0.16 });
    shoulders(p, m, white, 0, m.cloth);
    p.where([m.cloth], (u, v) => Math.floor(v / 2) % 2 === 0, tee[2]);
    p.where([m.cloth], (u, v) => u > PW - 14 && Math.floor(v / 2) % 2 === 0, tee[1]);
    // the overalls bib and straps, a brass button on each
    p.fill([[CX - 9, 60], [CX - 8.4, 52.4], [CX + 8.4, 52.4], [CX + 9, 60]], denim[2], m.cloth2, { sharp: true });
    p.stroke([[CX - 7, 52.6], [CX - 11, 46.6]], 2.4, 2.4, denim[2], m.cloth2);
    p.stroke([[CX + 7, 52.6], [CX + 11, 46.6]], 2.4, 2.4, denim[1], m.cloth2);
    p.ell(CX - 7, 53.4, 1, 1, col('#e0c060'), m.acc);
    p.ell(CX + 7, 53.4, 1, 1, col('#c8a040'), m.acc);
    p.where([m.cloth2], (u, v) => v > 55 && v < 58.6 && Math.abs(u - CX) < 4, denim[1]);
  },
  front(p, m) {
    const hat = T('#e8b424', { sh: 0.18, hi: 0.1 }), band = T('#c83a2a');
    const [, hs, hb] = T('#c8642c', { sh: 0.18 });
    // a short straight fringe
    p.fill([[CX - 13, 21], [CX - 12, 15], [CX + 12, 15], [CX + 13, 21], [CX + 8, 19.6], [CX + 3, 21], [CX - 2, 19.4], [CX - 7, 20.8]], hb, m.hair);
    p.where([m.hair], (u) => u > CX + 7, hs);
    // the big floppy sun hat: a soft crown and a wide wavy brim drooping at the sides
    const mc = p.m(6, true, 0.5), mb = p.m(7, true, 0.5);
    p.fill([[CX - 12.4, 15], [CX - 11, 5], [CX - 4, 1.6], [CX + 4, 1.6], [CX + 11, 5], [CX + 12.4, 15]], hat[2], mc);
    p.where([mc], (u, v) => v > 11.6 && v < 15, band[2]);
    p.where([mc], (u) => u > CX + 6, hat[1]);
    p.fill([[CX - 27, 21], [CX - 24, 14.4], [CX - 12, 12.4], [CX, 12], [CX + 12, 12.4], [CX + 24, 14.4], [CX + 27, 21], [CX + 22, 18.6], [CX + 12, 16.6], [CX, 16.2], [CX - 12, 16.6], [CX - 22, 18.6]], hat[2], mb);
    p.where([mb], (u, v) => v > 16 || u > CX + 18, hat[1]);
    p.where([mb], (u, v) => v < 14 && u < CX - 8, hat[3]);
  },
  post(b) { freckles(b, 1, col('#d8805a'), 27); },
  postHD(b, S) { freckles(b, S, col('#d07a56'), 27); for (const [x, y] of [[-8, 8], [8, 8.2], [-4, 7.6], [4, 7.8]]) over(b, (CX + x) * S + 1, (27 + y) * S + 1, col('#d8865e')); },
};

// ================================================================== Celeste: Helix's lead scientist
const CELESTE: PortraitDesign = {
  skin: T('#dcaa88', { sh: 0.12, deep: 0.26, hi: 0.06 }),
  eyes: 'almond', iris: ['#142018', '#4a6a58', '#90b098'], lash: '#0e0a10', brow: '#16121a', browH: 2, browArch: 1.6, browBias: -0.6,
  blush: '#d08070', blushK: 0.4, lip: '#a82e3a',
  faceW: 0.95, chin: 0.4, eyeX: 17, eyeY: 26, mouthY: 38, neck: [4.8, 5.6],
  cheek: [CX - 9.6, 29, 3, 1.3],
  back(p, m) {
    const [, hs, hb] = T('#141420', { sh: 0.2 });
    // a sharp asymmetric bob: longer on her left (viewer right), to the jaw
    p.fill([[CX - 15.6, 34], [CX - 16.4, 16], [CX, 4.6], [CX + 16.4, 16], [CX + 17, 40], [CX + 12, 41.4], [CX - 12, 35]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 11, hs);
  },
  body(p, m) {
    const jacket = T('#dce0e4', { sh: 0.14 }), yel = T('#e0b41e', { sh: 0.16 });
    shoulders(p, m, jacket, 0.22);
    // a high zipped collar, yellow panels on the shoulders, the helix logo
    p.fill([[CX - 9.6, 44], [CX - 8.6, 49.6], [CX + 8.6, 49.6], [CX + 9.6, 44], [CX, 46]], jacket[3], m.cloth2);
    p.where([m.cloth2], (u) => u > CX + 2, jacket[2]);
    p.stroke([[CX, 46], [CX, 60]], 0.8, 0.8, col('#8a9096'), m.acc);
    p.where([m.cloth], (u, v) => v < 52 && Math.abs(u - CX) > 15, yel[2]);
    p.where([m.cloth], (u, v) => v < 52 && u > PW - 13, yel[1]);
    // the logo: a little double helix in yellow
    for (let i = 0; i < 6; i++) { p.dot(CX + 9 + Math.sin(i * 1.2) * 1.4, 53 + i, col('#c89a10')); p.dot(CX + 9 - Math.sin(i * 1.2) * 1.4, 53 + i, col('#e8c030')); }
  },
  front(p, m) {
    const [, hs, hb, hl] = T('#141420', { sh: 0.2, hi: 0.3 });
    // the bob's fringe swept hard to one side, the long side falling past her cheek
    p.fill([[CX - 14.8, 30], [CX - 15.2, 17], [CX - 8, 9.6], [CX + 4, 8.6], [CX + 14, 12], [CX + 16.6, 22], [CX + 16.6, 40.6], [CX + 12.6, 41], [CX + 12.8, 30], [CX + 11.4, 21], [CX + 4, 17.6], [CX - 6, 16.4], [CX - 12, 19.6]], hb, m.hair);
    p.where([m.hair], (u, v) => u > CX + 10 && v > 18, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (12.4 + ((u - CX + 4) / 8) ** 2)) < 0.7 && u < CX + 6 && u > CX - 12, hl);
    // sunglasses pushed up on her head
    const mg = p.m(7, true, 0.4);
    p.fill([[CX - 12, 7.4], [CX - 2, 6.4], [CX - 2.4, 9.6], [CX - 11, 10]], col('#18181e'), mg);
    p.fill([[CX + 12, 7.4], [CX + 2, 6.4], [CX + 2.4, 9.6], [CX + 11, 10]], col('#18181e'), mg);
    p.where([mg], (u, v) => v < 7.6 && u < CX, col('#5a6a7a'));
  },
};

// ================================================================== Teo: Helix's field tech
const TEO: PortraitDesign = {
  skin: T('#f2c0a0', { sh: 0.12, deep: 0.26, hi: 0.05 }),
  eyes: 'man', iris: ['#10203a', '#3a6aa8', '#8ab8e8'], lash: '#3a2a20', brow: '#a07a40', browH: 2, browBias: 0.6, browDrop: 0.4,
  blush: '#f09080', blushK: 0.45, lip: '#b48a74', stubble: '#c8a060', noseBridge: true,
  faceW: 1.08, chin: 0.8, eyeX: 17, eyeY: 26, mouthY: 38, neck: [6.4, 7.6], adam: true,
  cheek: [CX - 8.6, 31, 3.4, 1.8],
  back(p, m) {
    const [, hs, hb] = T('#d4b05c', { sh: 0.2 });
    // blond tufts escaping the beanie round the ears and the nape
    p.fill([[CX - 15, 30], [CX - 16.4, 20], [CX + 16.4, 20], [CX + 15, 30], [CX + 13, 26], [CX - 13, 26]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 10, hs);
  },
  body(p, m) {
    const shell = T('#9aa2aa', { sh: 0.16 }), yel = T('#e0b41e', { sh: 0.16 }), strap = T('#2a2c32');
    shoulders(p, m, shell, 1);
    // yellow yoke across the shoulders, a rolled hood behind the neck, pack straps
    p.where([m.cloth], (u, v) => v < 50.4 && Math.abs(u - CX) > 10, yel[2]);
    p.where([m.cloth], (u, v) => v < 50.4 && u > PW - 12, yel[1]);
    p.fill([[CX - 13, 47], [CX - 10, 43.4], [CX, 44.6], [CX + 10, 43.4], [CX + 13, 47], [CX, 47.6]], shell[1], m.cloth2);
    p.fill([[6, 49], [11.6, 47.4], [13.4, 60], [8.2, 60]], strap[2], m.acc, { sharp: true });
    p.fill([[PW - 6, 49], [PW - 11.6, 47.4], [PW - 13.4, 60], [PW - 8.2, 60]], strap[1], m.acc, { sharp: true });
  },
  front(p, m) {
    const knit = T('#e0b41e', { sh: 0.18, hi: 0.08 });
    // a yellow beanie pulled down to the brows, a folded cuff, ribbed
    const mk = p.m(6, true, 0.5);
    p.fill([[CX - 16, 20], [CX - 15.4, 9], [CX - 8, 2.4], [CX, 1], [CX + 8, 2.4], [CX + 15.4, 9], [CX + 16, 20]], knit[2], mk);
    p.where([mk], (u, v) => v > 14.4, knit[3]);
    p.where([mk], (u, v) => ((u + 40) % 2.4) < 0.7 && v < 14, knit[1]);
    p.where([mk], (u, v) => u > CX + 10 && v < 14.4, knit[1]);
    p.where([mk], (u, v) => Math.abs(v - 14.4) < 0.5, knit[1]);
  },
  post(b) {
    // a big friendly nose
    const sk = this.skin;
    over(b, CX + 1, 33, sk[1]); over(b, CX - 2, 34, sk[1]);
  },
};

// ================================================================== Rua: the old hunter
const RUA: PortraitDesign = {
  skin: T('#986038', { sh: 0.14, deep: 0.3, hi: 0.06 }),
  eyes: 'fierce', iris: ['#140a06', '#5a3a1e', '#9a6a3a'], lash: '#120806', brow: '#cac4bc', browH: 2.5, browBias: -1.2, browDrop: 0.4,
  blush: '#b05a44', blushK: 0.3, lip: '#6a3a2c', weathered: true, noseBridge: true, adam: true,
  faceW: 0.98, chin: 1.2, eyeX: 17, eyeY: 26, mouthY: 39, neck: [5.6, 6.6],
  cheek: [CX - 9, 30, 2.6, 1.2],
  back(p, m) {
    const [, hs, hb] = T('#a8a4a0', { sh: 0.2 });
    p.fill([[CX - 14.6, 30], [CX - 15.6, 18], [CX + 15.6, 18], [CX + 14.6, 30], [CX + 12, 26], [CX - 12, 26]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 10, hs);
  },
  body(p, m) {
    const check = T('#22466e', { sh: 0.16 }), black = col('#0c1018');
    shoulders(p, m, check, 0.55);
    // the swanndri's check: dark bands both ways, black where they cross; a laced neck
    p.where([m.cloth], (u, v) => ((u + 40) % 6) < 2 || ((v + 40) % 6) < 2, check[1]);
    p.where([m.cloth], (u, v) => ((u + 40) % 6) < 2 && ((v + 40) % 6) < 2, black);
    p.fill([[CX - 4.4, 45], [CX + 4.4, 45], [CX + 2, 53], [CX - 2, 53]], this.skin[1], m.neck, { sharp: true });
    p.fill([[CX - 10, 44], [CX - 3, 46], [CX - 4, 49], [CX - 11, 47.4]], check[3], m.cloth2);
    p.fill([[CX + 10, 44], [CX + 3, 46], [CX + 4, 49], [CX + 11, 47.4]], check[2], m.cloth2);
  },
  front(p, m) {
    const hat = T('#2a2624', { sh: 0.2, hi: 0.16 }), mo = T('#d2ccc4', { sh: 0.16 });
    // a battered black felt bush hat, the brim turned down at the front
    const mc = p.m(6, true, 0.5);
    p.fill([[CX - 12, 14], [CX - 11, 5], [CX - 3, 2.6], [CX + 5, 3], [CX + 11.4, 6], [CX + 12, 14]], hat[2], mc);
    p.where([mc], (u, v) => v > 11.4 && v < 14, col('#5a3a20'));
    p.where([mc], (u) => u > CX + 6, hat[1]);
    const mb = p.m(7, true, 0.5);
    p.fill([[CX - 21, 17], [CX - 20, 13.6], [CX, 13], [CX + 20, 13.6], [CX + 21, 17], [CX + 12, 18.4], [CX, 18.8], [CX - 12, 18.4]], hat[2], mb);
    p.where([mb], (u, v) => v > 16.4 || u > CX + 12, hat[1]);
    // a drooping grey moustache
    p.fill([[CX - 9, 41], [CX - 7, 36.4], [CX - 2, 35.2], [CX, 36], [CX + 2, 35.2], [CX + 7, 36.4], [CX + 9, 41], [CX + 6.6, 41.4], [CX + 4.6, 38.4], [CX, 38], [CX - 4.6, 38.4], [CX - 6.6, 41.4]], mo[2], m.beard);
    p.where([m.beard], (u, v) => v > 38.6 || u > CX + 3, mo[1]);
  },
  post(b) {
    // the scar down his right cheek
    for (const [x, y] of [[CX - 10, 31], [CX - 10, 32], [CX - 11, 33], [CX - 11, 34]]) over(b, x, y, col('#c88a68'));
  },
  postHD(b, S) {
    for (let i = 0; i < 9; i++) over(b, (CX - 10 - i * 0.12) * S, (30.6 + i * 0.5) * S, col('#cc9070'));
    for (let i = 0; i < 4; i++) over(b, (CX - 10.8) * S + (i % 2 ? 1 : -1), (31.4 + i) * S, col('#7a4430'));
  },
};

// ================================================================== Sunny: the hunter's apprentice
const SUNNY: PortraitDesign = {
  skin: T('#a87048', { sh: 0.12, deep: 0.28, hi: 0.07 }),
  eyes: 'girl', iris: ['#120806', '#4a2a14', '#8a5a2a'], lash: '#140a08', brow: '#140c08', browH: 2,
  blush: '#c86a52', blushK: 0.8, lip: '#7a3a2c',
  faceW: 1.04, chin: -0.2, eyeX: 17, eyeY: 26, mouthY: 38, neck: [5.4, 6.4],
  cheek: [CX - 9, 31, 3.4, 1.8],
  back(p, m) {
    const [, hs, hb] = T('#1e140e', { sh: 0.18 });
    // a big cloud of curls piled up behind the bandana
    for (const [x, y, r] of [[CX, 2, 9], [CX - 9, 4, 7], [CX + 9, 4, 7], [CX - 15, 12, 6], [CX + 15, 12, 6], [CX - 16, 22, 5], [CX + 16, 22, 5]] as [number, number, number][]) p.ell(x, y, r, r * 0.9, hb, m.hairB);
    p.where([m.hairB], (u, v) => ((u * 1.3 + v) % 4.4) < 1 || u > CX + 10, hs);
  },
  body(p, m) {
    const tank = T('#5a6634', { sh: 0.16 });
    // strong bare shoulders, an olive tank, a whistle on a red lanyard
    p.fill(mirror([[-2, 60], [0, 51.6], [6, 47.4], [CX - 7, 46], [CX, 46]]), this.skin[2], m.neck);
    p.where([m.neck], (u, v) => u > PW - 9, this.skin[1]);
    p.fill(mirror([[4, 60], [6.6, 53], [10, 49], [CX - 8.4, 47.4], [CX - 5, 51.6], [CX, 52.4]]), tank[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 14 || v > 58.6, tank[1]);
    p.stroke([[CX - 6, 46.4], [CX - 2, 52], [CX, 54]], 0.9, 0.9, col('#c8342a'), m.acc);
    p.stroke([[CX + 6, 46.4], [CX + 2, 52], [CX, 54]], 0.9, 0.9, col('#a02a22'), m.acc);
    p.fill([[CX - 1.2, 54], [CX + 1.6, 54], [CX + 1.6, 57], [CX - 1.2, 57]], col('#c8ccd0'), m.acc, { sharp: true });
  },
  front(p, m) {
    const band = T('#c03428', { sh: 0.18 });
    const [, hs, hb] = T('#1e140e', { sh: 0.18 });
    // curls along the hairline, a red bandana tied over the top
    for (let i = 0; i < 6; i++) p.ell(CX - 12.5 + i * 5, 14 + Math.abs(i - 2.5) * 0.9, 3.6, 3.2, hb, m.hair);
    p.where([m.hair], (u, v) => ((u + v) % 3.6) < 0.9, hs);
    const mb = p.m(6, true, 0.5);
    p.fill([[CX - 15.6, 13.6], [CX - 13, 8.4], [CX, 6.6], [CX + 13, 8.4], [CX + 15.6, 13.6], [CX + 10, 12.4], [CX, 11.6], [CX - 10, 12.4]], band[2], mb);
    p.where([mb], (u, v) => v > 10.6 || u > CX + 8, band[1]);
    p.where([mb], (u, v) => ((u * 0.8 + v * 2) % 3) < 0.6, col('#f2e0d0'));
    // the knot and tails at the side
    p.fill([[CX + 14, 10], [CX + 19, 8], [CX + 20.4, 12.6], [CX + 15.6, 13]], band[2], mb);
  },
  post(b, e) {
    // dimples when she grins
    if (['smile', 'laugh', 'grin'].includes(e.mouth)) for (const sd of [-1, 1]) over(b, CX + sd * 6, 38, this.skin[1]);
  },
};

// ================================================================== Tīpene: the master carver
const TIPENE: PortraitDesign = {
  skin: T('#9a6040', { sh: 0.14, deep: 0.3, hi: 0.1 }),
  eyes: 'old', iris: ['#140a06', '#5a3a1e', '#9a6a3a'], lash: '#140a08', brow: '#e8e4dc', browH: 2.5, browArch: 0.6,
  blush: '#b05a44', blushK: 0.5, lip: '#6a3a2c', weathered: true, adam: true,
  faceW: 1.08, chin: 0.4, eyeX: 17, eyeY: 26, mouthY: 38, neck: [6.2, 7.4],
  cheek: [CX - 9, 31, 3.6, 1.8],
  back(p, m) {
    // a fringe of white hair round the back of the bald head
    const [, hs, hb] = T('#e8e4dc', { sh: 0.16 });
    p.fill([[CX - 15.4, 30], [CX - 16.4, 20], [CX - 14, 17], [CX + 14, 17], [CX + 16.4, 20], [CX + 15.4, 30], [CX + 12, 28], [CX - 12, 28]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 10, hs);
  },
  body(p, m) {
    const tee = T('#22252d', { sh: 0.14 }), apron = T('#7a4e32', { sh: 0.18 });
    shoulders(p, m, tee, 0.85);
    // the leather apron's bib and neck strap, a carved bone toki on a cord
    p.fill([[CX - 10, 60], [CX - 9, 51], [CX + 9, 51], [CX + 10, 60]], apron[2], m.cloth2, { sharp: true });
    p.where([m.cloth2], (u) => u > CX + 4, apron[1]);
    p.stroke([[CX - 8, 51.4], [CX - 10.6, 45]], 1.6, 1.6, apron[1], m.acc);
    p.stroke([[CX + 8, 51.4], [CX + 10.6, 45]], 1.6, 1.6, apron[1], m.acc);
    p.stroke([[CX - 4.4, 45.4], [CX, 49.4], [CX + 4.4, 45.4]], 0.7, 0.7, col('#3a2414'), m.acc);
    p.fill([[CX - 1.4, 49.2], [CX + 1.4, 49.2], [CX + 1.8, 54], [CX - 1.8, 54]], col('#f0e6cc'), p.m(8, true, 0.4));
  },
  front(p, m) {
    // the bald dome catching the light; the white goatee
    p.where([m.skin], (u, v) => (u - CX + 5) ** 2 / 28 + (v - 15) ** 2 / 8 < 1, this.skin[3]);
    const g = T('#eeeae2', { sh: 0.14 });
    p.fill([[CX - 6, 39.6], [CX - 4, 37.8], [CX, 38.4], [CX + 4, 37.8], [CX + 6, 39.6], [CX + 4, 44.6], [CX, 46.4], [CX - 4, 44.6]], g[2], m.beard);
    p.fill([[CX - 7, 37.6], [CX - 3, 35.4], [CX, 36], [CX + 3, 35.4], [CX + 7, 37.6], [CX, 37.2]], g[3], m.acc);
    p.where([m.beard], (u, v) => u > CX + 2 || v > 44, g[1]);
  },
  post(b) { ringSpecs(b, 1, 17, 26, 4.2, col('#2a1a10'), 6); },
  postHD(b, S) { ringSpecs(b, S, 17, 26, 4.2, col('#3a2414'), 6, col('#f0f8ff')); },
};

// ================================================================== Ngaio: the weaver
const NGAIO: PortraitDesign = {
  skin: T('#a87048', { sh: 0.12, deep: 0.28, hi: 0.08 }),
  eyes: 'almond', iris: ['#120806', '#3a2212', '#7a4a26'], lash: '#0e0604', brow: '#160c08', browH: 2, browArch: 1.4,
  blush: '#c4604c', blushK: 0.7, lip: '#8a3a30',
  faceW: 0.94, chin: 1.2, eyeX: 17, eyeY: 26, mouthY: 38, neck: [4.8, 5.8],
  cheek: [CX - 9.6, 29, 3, 1.4],
  back(p, m) {
    const [, hs, hb] = T('#1a100c', { sh: 0.18 });
    p.fill([[CX - 15, 32], [CX - 16, 16], [CX, 5], [CX + 16, 16], [CX + 15, 32], [CX + 12, 36], [CX - 12, 36]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 10, hs);
  },
  body(p, m) {
    const tee = T('#ba8a1e', { sh: 0.16 }), net = T('#226282', { sh: 0.18 }), flax = T('#b08e40', { sh: 0.18 });
    shoulders(p, m, tee, 0.18);
    // the woven cape over her shoulders: flax with a band of blue fishing net woven through, a fringe
    const mc = p.m(5, true, 0.5);
    p.fill(mirror([[-1, 60], [1, 51], [8, 46.8], [CX - 9, 45.6], [CX - 5.4, 50.6], [CX - 2, 55], [CX, 56]]), flax[2], mc);
    p.where([mc], (u, v) => ((u * 0.9 + v * 0.9 + 80) % 2.6) < 0.9, flax[1]);
    p.where([mc], (u, v) => v > 50.4 && v < 53.6, net[2]);
    p.where([mc], (u, v) => v > 50.4 && v < 53.6 && ((u - v + 80) % 3) < 1, net[3]);
    p.where([mc], (u) => u > PW - 10, flax[0]);
  },
  front(p, m) {
    const [, hs, hb, hl] = T('#1a100c', { sh: 0.18, hi: 0.26 });
    // hair parted in the middle and drawn into two thick braids down the front over the shoulders
    p.fill([[CX - 14.6, 26], [CX - 15, 15], [CX - 7, 8.6], [CX, 9.6], [CX + 7, 8.6], [CX + 15, 15], [CX + 14.6, 26], [CX + 12.6, 20], [CX + 6, 13.6], [CX + 0.6, 12.6], [CX - 0.6, 12.6], [CX - 6, 13.6], [CX - 12.6, 20]], hb, m.hair);
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 7; i++) p.ell(CX + sd * (14.4 - i * 0.1), 30 + i * 4.4, 2.9 - i * 0.12, 2.6, sd < 0 ? hb : hs, m.hair, {}, sd * 0.5);
    }
    p.where([m.hair], (u, v) => v > 27 && ((v + 40) % 4.4) < 0.9, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (11.6 + ((u - CX + 3) / 7) ** 2 * 1.4)) < 0.6 && Math.abs(u - CX + 3) < 8, hl);
    // a woven headband across the crown
    const mb = p.m(6, true, 0.45);
    p.stroke([[CX - 14.4, 15.4], [CX - 7, 10.6], [CX, 10.2], [CX + 7, 10.6], [CX + 14.4, 15.4]], 2, 2, col('#caa85a'), mb);
    p.where([mb], (u) => ((u + 40) % 2) < 0.8, col('#8a6a28'));
  },
  post(b) {
    // pounamu studs in her ears
    for (const x of [CX - 14, CX + 13]) over(b, x, 30, col('#3a9a64'));
  },
  postHD(b, S) { for (const x of [CX - 14, CX + 13.4]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) over(b, x * S + dx, 30 * S + dy, col(dx + dy === 0 ? '#86d2a4' : '#2a7a4c')); },
};

// ================================================================== Marge: the naturalist hermit
const MARGE: PortraitDesign = {
  skin: T('#eecab8', { sh: 0.12, deep: 0.26, hi: 0.04 }),
  eyes: 'old', iris: ['#1a2a3a', '#5a7a9a', '#a0c0dc'], lash: '#3a2a2a', brow: '#d8d2ca', browH: 2, browArch: 1.6, browBias: 0.4,
  blush: '#e88a80', blushK: 0.9, lip: '#b06a64', weathered: true, rosy: true,
  faceW: 0.92, chin: 0.6, eyeX: 18, eyeY: 27, mouthY: 39, neck: [4.2, 5],
  back(p, m) {
    // a frizz of white hair escaping all round under the helmet
    const [, hs, hb] = T('#f0ebe4', { sh: 0.14 });
    for (const [x, y, r] of [[CX - 16, 18, 4.6], [CX - 17.4, 25, 4], [CX - 15.6, 31, 3.6], [CX + 16, 18, 4.6], [CX + 17.4, 25, 4], [CX + 15.6, 31, 3.6]] as [number, number, number][]) p.ell(x, y, r, r, hb, m.hairB);
    p.where([m.hairB], (u, v) => ((u * 1.6 + v) % 3) < 0.8 || u > CX + 15, hs);
  },
  body(p, m) {
    const jacket = T('#a89a68', { sh: 0.16 }), scarf = T('#b8342a', { sh: 0.18 });
    shoulders(p, m, jacket, 0.08);
    // a safari jacket with bellows pockets bulging, a red neckerchief knotted at the throat
    for (const x of [8, PW - 17]) { p.fill([[x, 53], [x + 9, 53], [x + 9, 60], [x, 60]], jacket[1], m.cloth2, { sharp: true }); p.where([m.cloth2], (u, v) => v > 52.6 && v < 54.2 && u > x && u < x + 9, jacket[3]); }
    p.fill([[CX - 7, 44.6], [CX + 7, 44.6], [CX + 3.4, 50], [CX, 52], [CX - 3.4, 50]], scarf[2], m.acc);
    p.ell(CX, 47.4, 2.2, 1.8, scarf[1], m.acc);
    p.dot(CX + 9, 56, col('#e0d090'));
  },
  front(p, m) {
    const helm = T('#e8dcb8', { sh: 0.16, hi: 0.06 }), band = T('#6a5a3a');
    // the pith helmet: a high dome, a band, a stiff brim, a long feather tucked in the band
    const mh = p.m(6, true, 0.5), mb = p.m(7, true, 0.5);
    p.fill([[CX - 13.6, 16.4], [CX - 13, 7], [CX - 7, 1.4], [CX, 0.4], [CX + 7, 1.4], [CX + 13, 7], [CX + 13.6, 16.4]], helm[2], mh);
    p.where([mh], (u, v) => v > 12.4 && v < 16, band[2]);
    p.where([mh], (u) => u > CX + 6, helm[1]);
    p.where([mh], (u, v) => (u - CX + 5) ** 2 / 10 + (v - 5) ** 2 / 4 < 1, helm[3]);
    p.fill([[CX - 20, 19.6], [CX - 18, 15.4], [CX, 14.6], [CX + 18, 15.4], [CX + 20, 19.6], [CX, 19.2]], helm[2], mb);
    p.where([mb], (u, v) => v > 17.6, helm[1]);
    p.stroke([[CX + 10, 14], [CX + 15, 6], [CX + 21, -1]], 2.2, 0.6, col('#2a5a7a'), p.m(8, true, 0.4));
  },
  post(b) { ringSpecs(b, 1, 18, 27, 4.0, col('#8a6a2a'), 6); },
  postHD(b, S) { ringSpecs(b, S, 18, 27, 4.0, col('#9a7a34'), 6, col('#f0f8ff')); },
};

export const NPC_PORTRAITS: Record<string, PortraitDesign> = {
  hine: HINE, doug: DOUG, rosie: ROSIE, celeste: CELESTE, teo: TEO, rua: RUA, sunny: SUNNY, tipene: TIPENE, ngaio: NGAIO, marge: MARGE,
};
void shade; void ({} as PortraitExpr);
