// V12 Te Kāinga life: small hand-placed pixel sprites for the living village and its side quests.
// Each is drawn from a character map (pixel by pixel), mirrored where the real thing is symmetrical,
// then shaded by hand-picked rules (a light side, a shadow side), never built from primitive shapes:
//   manuKite      Mikaere's manu tukutuku: a raupō bird-kite on a mānuka frame, a painted face,
//                 feather tufts at the wingtips; tailTuft is one of the tufts along its tail line
//   litWindow     a whare window at night: a flax blind rolled up, lamplight inside, a silhouette
//   kohatu        a hāngī stone: black vesicular river stone, holes, a worn highlight (and the pale
//                 sandstone Huia warns about)
//   anuhe         the kūmara caterpillar: striped, a horn on its tail
//   trotters      trotter prints across a patch of mud
//   paretaniwha   the bronze harakeke Whaea Mere wants (the island's flax, re-inked in bronze and red)
//   tauihu        Uncle Hēmi's carved hawk prow, finished, red ochre and a pāua eye

import { PixelBuffer } from '../../pixel';
import { hex, mix } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { plant } from '../../jungle-plants';

/** a sprite from a character map ('.' is clear), anchored bottom-centre unless told otherwise */
function pm(rows: string[], pal: Record<string, string>, ax?: number, ay?: number): Sprite {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const b = new PixelBuffer(w, h);
  const cols: Record<string, C> = {};
  for (const k in pal) cols[k] = hex(pal[k]);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = cols[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return { buf: b, ax: ax ?? Math.floor(w / 2), ay: ay ?? h - 1 };
}
/** a symmetrical map from its left half (the last column is the centre line) */
const mirror = (half: string[]) => half.map(r => r + r.slice(0, -1).split('').reverse().join(''));

// ------------------------------------------------------------------ the kite
const KITE_HALF = [
  '..........ooo',
  '.........oeww',
  '........owkww',
  '........owwwe',
  '.f.......owee',
  'fFo.....ooRrs',
  '.fFoooooRRrrs',
  '..oRRRRRRrrrs',
  '..ossssssssss',
  '...oddRRRRrrs',
  '....oodRRRrrs',
  '......odRRrrs',
  '.......odRrrs',
  '........odRrs',
  '.........odrs',
  '..........ods',
  '...........oe',
  '...........of',
  '............F',
];
export function manuKite(): Sprite {
  const s = pm(mirror(KITE_HALF), { o: '#1a0e06', R: '#b8a060', r: '#d8c486', d: '#8a7438', s: '#5a3418', w: '#f0ead8', k: '#140a06', e: '#b83c24', f: '#f4f0e8', F: '#2a2420' }, 12, 8);
  // the light comes from the upper left: the right wing turns away from it (dithered, by hand-picked tones)
  const b = s.buf, lite = hex('#d8c486'), mid = hex('#b8a060'), dk = hex('#8a7438');
  for (let y = 0; y < b.h; y++) for (let x = 13; x < b.w; x++) {
    const c = b.get(x, y);
    if (c === lite && (x + y) % 2 === 0) b.set(x, y, mid);
    else if (c === mid && (x + y) % 3 === 0) b.set(x, y, dk);
  }
  // raupō leaf seams running out along the wings
  for (const [x, y] of [[5, 7], [8, 7], [16, 7], [19, 7], [6, 9], [18, 9]] as [number, number][]) b.set(x, y, dk);
  return s;
}
export const tailTuft = (): Sprite => pm(['.f.f.', 'ffFff', '.fFf.', '..F..'], { f: '#f4f0e8', F: '#2a2420' }, 2, 0);

// ------------------------------------------------------------------ a lit window (14 x 12, the whare's opening)
export function litWindow(v: number): Sprite {
  const W = 14, H = 12, b = new PixelBuffer(W, H);
  const AMB = ['#5a2c10', '#8a4a1a', '#c27a2a', '#eaa846', '#ffd27a', '#fff0b8'].map(c => hex(c));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // a lamp low in the room: brightest at the bottom middle, falling off to the corners
    const d = Math.hypot((x - 7.5 - (v ? 1.5 : -1)) / 7, (y - 11) / 9);
    let t = 4.6 - d * 4.2 + ((x + y * 3 + v) % 4 === 0 ? 0.5 : 0);
    if ((x + y) % 2) t -= 0.35;
    b.set(x, y, AMB[Math.max(0, Math.min(5, Math.round(t)))]);
  }
  // the rolled flax blind across the top, the twine ties
  for (let x = 0; x < W; x++) { b.set(x, 0, hex(x % 3 ? '#4e3a1a' : '#3a2a12')); b.set(x, 1, hex(x % 2 ? '#7a5e2a' : '#5e4620')); }
  b.set(3, 2, hex('#3a2a12')); b.set(10, 2, hex('#3a2a12'));
  // someone inside: a head and a shoulder against the lamp (the other window: a hanging kete)
  const SIL = hex('#2a140a');
  const fig = v ? ['..oo..', '.oooo.', '.oooo.', '..oo..', 'oooooo', 'oooooo'] : ['.oo.', 'oooo', 'oooo', '.oo.', '.oo.', 'oooo'];
  const ox = v ? 2 : 9, oy = H - fig.length;
  fig.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'o') b.set(ox + x, oy + y, SIL); });
  return { buf: b, ax: 0, ay: 0, glow: b.clone() };
}

// ------------------------------------------------------------------ hāngī stones
export function kohatu(v: number, pale = false): Sprite {
  const rows = v % 2 ? [
    '....ooo.....',
    '..ooGgGoo...',
    '.oGhhGgGGoo.',
    'oGgGvGGhgGGo',
    'oGGgGGvGgGgo',
    '.oGvGgGGGvGo',
    '.oGGGgGvGGo.',
    '..oddGdddo..',
    '...ooooooo..',
  ] : [
    '...oooo.....',
    '.ooGhhGooo..',
    'oGhGgGGgGGo.',
    'oGGvGgGvGgGo',
    'ogGGGGGGgGvo',
    'oGvgGhGGGGGo',
    '.oGGGGvGGdo.',
    '..oddddddo..',
    '...oooooo...',
  ];
  const pal = pale
    ? { o: '#4a3a24', G: '#d8c094', g: '#c4aa7a', h: '#f0e2bc', v: '#b0966a', d: '#9a7e54' }
    : { o: '#0c0a0a', G: '#3a3434', g: '#2a2626', h: '#7a6c64', v: '#100c0c', d: '#1e1a1a' };
  return pm(rows, pal);
}

// ------------------------------------------------------------------ the kūmara caterpillar
export const anuhe = (): Sprite => pm([
  '........k.',
  '.gggggggk.',
  'gGsGsGsGg.',
  '.l.l.l.l..',
], { g: '#4a5a2e', G: '#7a8a4a', s: '#d0d0a4', k: '#3a2a1a', l: '#2a3418' });

// ------------------------------------------------------------------ trotter prints in the mud
export const trotters = (): Sprite => pm([
  '..mmmmmm...mmmmmmmm....',
  '.mMMpMpMmmmMMMpMpMMm...',
  'mMMMMMMMMMMMMMMMMMMMMm.',
  '.mMpMpMMMMMpMpMMMMMm...',
  '...mmmmm..mmmmmm.......',
], { m: '#3a2818', M: '#4e3820', p: '#160e06' });

// ------------------------------------------------------------------ the bronze harakeke
export function paretaniwha(seed: number, size = 30): Sprite {
  const s0 = plant('flax', seed, size);
  const s: Sprite = { ...s0, buf: s0.buf.clone() };
  const BRONZE = ['#1e0c06', '#3e1a0c', '#6a2c12', '#8e4418', '#b0622a', '#d08a44'].map(c => hex(c));
  const RED = hex('#a8281a');
  s.buf.map((c, x, y) => {
    if (c >>> 24 < 128) return c;
    const r = c & 255, g = (c >>> 8) & 255, bl = (c >>> 16) & 255;
    const l = (r * 0.3 + g * 0.55 + bl * 0.15) / 255;
    const k = Math.max(0, Math.min(5, Math.round(l * 7.2 - 0.4)));
    // the red line along the leaf edge that gives it its name
    if (k >= 3 && (x * 7 + y * 3) % 11 === 0) return RED;
    return mix(BRONZE[k], c, 0.12);
  });
  return s;
}

// ------------------------------------------------------------------ Uncle Hēmi's carved hawk prow
export const tauihu = (): Sprite => pm([
  '......ooo.........',
  '....ooeeeoo.......',
  '...oeEEeeeeo......',
  '..oeEpEeeeeeoo....',
  '..oeeEEeeEeeeeoo..',
  '...ooeeeEEeeeeeeo.',
  '..oeeooeeeEEeeeeo.',
  '.oeeeeoeeeeeEEeo..',
  'oeeoeeoeeeeeeeo...',
  'oeo.oeeoeeeeeo....',
  '.o...oeeeeeoo.....',
  '.....wweeeoww.....',
  '....wwwoooowww....',
], { o: '#1a0806', e: '#8a2416', E: '#d45a34', p: '#5ac0b0', w: '#5a3018' });
