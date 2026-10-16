// V10 Region Map pixel UI kit: everything around the painted map is drawn here as pixel art in code
// (whole-number scaled canvases, never vectors, gradients or blur): place-name banners and the big
// region lettering in the map font, illustrated checkpoint pins (a shape per kind of place, a picture
// per place, a ring in the colour of its region), the flagged stakes of the ways on, Mori's token,
// buttons, paper panels (a 9-slice with a dithered drop shadow and a red pin), gauges, the parchment
// roll and the wood of the table.

import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix } from '../../art/color';
import { bayer, clamp, hash2 } from '../../core/math';
import { drawText, measure, wrap, GH } from './mapfont';
import type { TextOpts } from './mapfont';
import type { LocationDef } from '../../game/v10/regions';

export const UI = {
  ink: hex('#2a1a0c'), ink2: hex('#5e4026'), ink3: hex('#8a6c48'), red: hex('#a8281e'), red2: hex('#d84a32'), green: hex('#2f6b2a'),
  paper: hex('#f4e6c4'), paper2: hex('#e8d4a6'), paper3: hex('#d2b884'), hi: hex('#fff6dc'), shadow: hex('#1c1008'),
  gold: hex('#e8b440'), gold2: hex('#a8781c'), teal: hex('#3ab8a8'), teal2: hex('#8ef0dc'), wood: hex('#5a3a1e'), wood2: hex('#3a2412'), wood3: hex('#7e5630'),
  night: hex('#1a2430'), night2: hex('#2c3a48'),
};

const urlCache = new Map<string, string>();
export function cachedURL(key: string, make: () => PixelBuffer): string {
  let u = urlCache.get(key);
  if (!u) { u = make().toDataURL(1); urlCache.set(key, u); }
  return u;
}

// ------------------------------------------------------------------ text plates
export type PlateKind = 'place' | 'camp' | 'new' | 'rumour' | 'sel' | 'small' | 'dark' | 'here';
/** a place name on a little paper banner with folded ends (and its te reo name on a strip below) */
export function plate(text: string, kind: PlateKind = 'place', sub?: string): PixelBuffer {
  const bold = kind === 'camp' || kind === 'sel';
  const tw = measure(text, { bold });
  const sw = sub ? measure(sub) : 0;
  const pad = 5, bodyH = GH + 2;
  const w = Math.max(tw, sw - 4) + pad * 2 + 8, h = bodyH + (sub ? GH - 1 : 0) + 3;
  const b = new PixelBuffer(w, h);
  const body = kind === 'camp' ? hex('#b8321e') : kind === 'new' ? hex('#f8de8a') : kind === 'dark' || kind === 'here' ? UI.night : kind === 'rumour' ? hex('#e6d6b0') : UI.paper;
  const body2 = kind === 'camp' ? hex('#8a1e12') : kind === 'new' ? hex('#d8b050') : kind === 'dark' || kind === 'here' ? hex('#0e161e') : UI.paper3;
  const hi = kind === 'camp' ? hex('#e8644a') : kind === 'dark' || kind === 'here' ? UI.night2 : UI.hi;
  const edge = kind === 'sel' ? UI.red : UI.ink;
  const x0 = 4, x1 = w - 5;
  // the folded tails behind the banner
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    for (let y = 3; y < bodyH + 2; y++) for (let k = 1; k <= 4; k++) {
      const x = ex + side * k;
      const notch = k >= 3 && Math.abs(y - (bodyH + 4) / 2) < 5 - k;
      if (notch) continue;
      b.set(x, y, k === 4 || y === 3 || y === bodyH + 1 ? edge : body2);
    }
  }
  // the banner body
  for (let y = 0; y < bodyH; y++) for (let x = x0; x <= x1; x++) {
    const e = y === 0 || y === bodyH - 1 || x === x0 || x === x1;
    b.set(x, y, e ? edge : y === 1 ? hi : y >= bodyH - 3 ? body2 : body);
  }
  if (kind === 'rumour') for (let x = x0; x <= x1; x++) { if ((x >> 1) % 2) { b.set(x, 0, body); b.set(x, bodyH - 1, body); } }
  const tc = kind === 'camp' ? hex('#fff2dc') : kind === 'dark' || kind === 'here' ? hex('#f4e6c0') : kind === 'rumour' ? UI.ink3 : kind === 'sel' ? hex('#7a1a10') : UI.ink;
  drawText(b, text, Math.round((w - tw) / 2), 0, tc, { bold, shadow: kind === 'camp' ? hex('#5a120a') : kind === 'dark' || kind === 'here' ? hex('#000000') : undefined });
  if (sub) {
    const sy = bodyH - 1;
    const sx0 = Math.round((w - sw) / 2) - 3, sx1 = sx0 + sw + 5;
    for (let y = sy; y < sy + GH - 1; y++) for (let x = sx0; x <= sx1; x++) {
      const e = y === sy + GH - 2 || x === sx0 || x === sx1;
      b.set(x, y, e ? edge : y === sy ? body2 : UI.paper2);
    }
    drawText(b, sub, sx0 + 3, sy - 3, UI.ink2);
  }
  return b;
}

/** big lettering across the land: a cream bold face with a dark outline and a drop shadow */
export function bigText(text: string, track = 2): PixelBuffer {
  const o: TextOpts = { bold: true, track };
  const w = measure(text, o) + 4, b = new PixelBuffer(w, GH + 3);
  drawText(b, text, 2, 1, hex('#fbf0d0'), { ...o, outline: hex('#2a1a0c') });
  // a drop shadow below the outline, dithered
  const sh = new PixelBuffer(w, GH + 3);
  for (let y = 0; y < b.h - 1; y++) for (let x = 0; x < b.w - 1; x++) if ((b.data[y * b.w + x] >>> 24) && !(b.data[(y + 1) * b.w + x + 1] >>> 24) && bayer(x, y) < 0.5) sh.set(x + 1, y + 1, hex('#1a0e06'));
  for (let i = 0; i < b.data.length; i++) if (!(b.data[i] >>> 24) && (sh.data[i] >>> 24)) b.data[i] = sh.data[i];
  return b;
}

// ------------------------------------------------------------------ checkpoint pins
const PIC_PAL: Record<string, string> = {
  k: '#2a1a10', w: '#fbf6e8', r: '#a8281e', R: '#e05a3a', g: '#3e7a34', G: '#86c050', d: '#1e3e22', b: '#2e6a9a', B: '#9ad4ee', y: '#e0a818',
  s: '#7e786c', S: '#c4beb0', n: '#5e3e22', N: '#b08048', o: '#e07a2a', c: '#3fe0cc', p: '#8a5ab8', t: '#dcc48e', m: '#5a4630',
};
export const PICS: Record<string, string[]> = {
  camp: ['.....kr....', '.....krr...', '.....k.....', '....kwk....', '...kwwnk...', '..kwwwnnk..', '.kwwwknnnk.', 'kwwwkkknnnk', 'kkkkkkkkkkk', '.ttttttttt.', '...........'],
  'isle-wreck': ['....k......', '....k..k...', '...kk..k...', '..kwwk.k...', '.knnnnnkk..', 'knNNNNnnnk.', '.knnnnnnnk.', '..kbbbbbk..', '.bBbbbBbbb.', 'bbbbbbbbbbb', '...........'],
  'isle-grove': ['..ggg.ggg..', '.gGGgkgGGg.', 'g..gGkGg..g', '....gkg....', '.....k.....', '.....n.....', '....n......', '....n......', '....n......', '...tttt....', '..tttttt...'],
  'isle-stream': ['....b......', '....bb.....', '.....bb....', '....bBb....', '...bBb.....', '...bb......', '....bb.....', '.....bBb...', '....bBBbb..', '..bbBBBbbb.', '.bbbbbbbbbb'],
  'isle-seals': ['...........', '...........', '........kk.', '.......knnk', '......knnnk', '..kkkknnnk.', '.knnnnnnnk.', 'knnNNNnnk..', 'kkkkkkkkk..', '.sssssssss.', 'sssssssssss'],
  'isle-cave': ['...kkkkk...', '..ksssssk..', '.kssSSSssk.', 'kssk.c.kssk', 'ksk.c.c.ksk', 'ksk..c..ksk', 'ksk.....ksk', 'ksk.....ksk', 'ksbbbbbbbsk', 'kkkkkkkkkkk', '...........'],
  'isle-track': ['....k......', '.kNNNNNNk..', '.kNNNNNNNk.', '.kNNNNNNk..', '....k......', '..kNNNNNNk.', '.kNNNNNNNk.', '..kNNNNNNk.', '....n......', '....n......', '..ggnggg...'],
  fernwood: ['.....g.....', '....gGg....', '..g.gGg.g..', '.gGggGggGg.', '..gGgGgGg..', 'g..gGGGg..g', '.gg.gGg.gg.', '..ggGGGgg..', '....gnG....', '.....n.....', '....nnn....'],
  canopy: ['..ddgggdd..', '.dgGGgGGgd.', 'dgGGgggGGgd', 'dggggdggggd', '.ddgddddgd.', '....kSk....', '....kSk....', '....kSk....', '....kSk....', '...kSSSk...', '..nnnnnnn..'],
  falls: ['sssssssss..', 'sSSSbBbSss.', 'ss..bBwb.s.', 's...bwBb...', '....bBwb...', '....bwBb...', '...bBwBbb..', '..bBwwwBbb.', '.bBBwBwBBb.', 'bbbbbbbbbbb', '...........'],
  mangrove: ['...........', '..ddgggdd..', '.dgGGgGGgd.', 'dggggggggdd', '.ddgddgddd.', '..k.k.k.k..', '.k..k.k..k.', 'k..k...k..k', 'mbbmbbbmbbm', 'bBbbbBbbbBb', '...........'],
  coast: ['.....k.....', '....kk.....', '...kdk.....', '..kddk.....', '.kdddkk....', 'bbbbbbbbbbb', 'bBbbBBbbBbb', 'bbbBbbbBbbb', '.....tttttt', '...tttwttt.', 'tttttttttt.'],
  deep: ['k.........k', 'kk.......kk', '.kdk...kdk.', '..kddkddk..', '...kdddk...', '....kdk....', '....kdk....', 'bbbbkdkbbbb', 'bBbbbbbbBbb', 'bbbBbbbBbbb', '.bbbbbbbbb.'],
  grotto: ['...sssss...', '..sSSSSSs..', '.sSSsssSSs.', 'sSs.....sSs', 'sS.......Ss', 'sS.......Ss', 'sS..bbb..Ss', 'bbbbBBBbbbb', 'bBbbbbbbBbb', 'bbbBbbbBbbb', '...........'],
  village: ['.....rr....', '....rNNr...', '...rNNNNr..', '..rNNNNNNr.', '.rNNNNNNNNr', 'rNNNNNNNNNr', '.RnnnkknnR.', '.RnnnkknnR.', '.RnnnkknnR.', '.Rkkkkkkkr.', '...........'],
  ruins: ['...........', '....kkk....', '...kSSSk...', '..kSssSSk..', '.kSSSSSSSk.', '.ksssssssk.', 'kSSSSSSSSSk', 'ksssrsrsssk', 'kSSSSSSSSSk', 'kkkkkkkkkkk', '...........'],
  fossils: ['.kk.....kk.', 'kwwk...kwwk', 'kwwwkkkwwwk', '.kwwwwwwwk.', '..kwwwwwk..', '.kwwwwwwwk.', 'kwwwkkkwwwk', 'kwwk...kwwk', '.kk.....kk.', '...........', '...........'],
  glowforest: ['...kkkkk...', '..kpcppck..', '.kppppcppk.', 'kpcppppppck', 'kkkkkkkkkkk', '....kwk....', '....kwk....', '..c.kwk.c..', '....kwk....', '...kwwwk...', '..ggggggg..'],
  geovalley: ['..w...w....', '.w...w...w.', '..w...w..w.', '.w...w..w..', '..w..w...w.', '...........', '....kkk....', '..kkBBBkk..', '.kyBBBBByk.', 'kyyyyyyyyyk', '.kkkkkkkkk.'],
  unknown: ['..kkkkkkk..', '.kSSSSSSSk.', 'kSskkkkksSk', 'kSk.....kSk', 'kSk.ddd.kSk', 'kSk.d.d.kSk', 'kSk.ddd.kSk', 'kSk.....kSk', 'kSskkkkksSk', '.kSSSSSSSk.', '..kkkkkkk..'],
  forest: ['.....d.....', '....dgd....', '..d.dgd.d..', '.dgdgGgdgd.', '.dgddgddgd.', 'dgGgdgdgGgd', 'dgggdGdgggd', '.ddgggggdd.', '..ddkdkdd..', '....k.k....', '...........'],
  hills: ['...........', '....kkk....', '...kSSSk...', '...kssSk...', '..kkSSkkk..', '.kSSskSSSk.', '.ksSSkssSk.', 'kkkkkkkkkkk', 'tNttNttNttt', 'NtttttNtttN', '...........'],
  fishgrounds: ['...........', '...........', '....kkkk...', '.k.kbBBbk..', '.kkbBwBBbk.', '.kbBBBBBBkk', '.kkbBBBBbk.', '.k.kbbbbk..', '....kkkk...', 'bBbbbBbbbBb', '...........'],
  glassreef: ['...p...o...', '..pp..oo...', '.p.p.o.o.y.', '..ppoo..yy.', '...pok.yy..', '...kpkoy...', '....kpk....', '..ccckccc..', '.cBcccccBc.', 'bbbbbbbbbbb', '...........'],
  motuahi: ['....w.w....', '...w.ww....', '....ww.....', '....ooo....', '...kRoRk...', '..kssRssk..', '.kssssSssk.', 'ksssssSSssk', 'bbbbbbbbbbb', 'bBbbbBbbbBb', '...........'],
  farcoast: ['gggggg.....', 'GGGGGGg....', 'sssSSws....', 'sssSSws....', 'ssSSswBs...', 'ssSSsBws...', 'sSSssBws...', 'sSssswBs...', 'bbbbBwBbbbb', 'bBbbbwbbBbb', 'bbbbbbbbbbb'],
  star: ['.....k.....', '....krk....', '....krk....', '..k.krk.k..', '.kkkkwkkkk.', 'krrrwwwrrrk', '.kkkkwkkkk.', '..k.kyk.k..', '....kyk....', '....kyk....', '.....k.....'],
};
const PIC_BY_KIND: Record<string, string> = { camp: 'camp', village: 'village', ruin: 'ruins', cave: 'isle-cave', fossil: 'fossils', ocean: 'fishgrounds', island: 'motuahi', ecosystem: 'glowforest' };
export const RING: Record<string, [string, string]> = {
  home: ['#e8b848', '#9a6a1c'], interior: ['#7cc05a', '#3a7428'], south: ['#e88a4a', '#984a1a'], east: ['#6ab0e0', '#2a6a98'], ocean: ['#5ac0e8', '#1e5a88'], isle2: ['#e8784a', '#984020'],
};
/** the medallion's outline for each kind of place: round, a house, an arch, a shield, a hexagon */
type Shape = 'round' | 'house' | 'arch' | 'shield' | 'hex' | 'drop';
const SHAPE: Record<string, Shape> = { camp: 'house', village: 'house', cave: 'arch', ruin: 'shield', fossil: 'shield', ecosystem: 'hex', ocean: 'drop', island: 'drop', site: 'round' };
function inShape(s: Shape, x: number, y: number): number {
  // returns a signed distance-ish (>= 0 inside) on a 19 x 19 box centred at 9.5
  const dx = x + 0.5 - 9.5, dy = y + 0.5 - 9.5;
  switch (s) {
    case 'house': return Math.min(8.6 - Math.abs(dx), 9 - dy, (dy + 9.4) - Math.abs(dx) * 0.95 + 0.5);
    case 'arch': return Math.min(8.6 - Math.abs(dx), 9 - dy, dy < -0.5 ? 8.6 - Math.hypot(dx, dy + 0.5) : 99);
    case 'shield': return Math.min(8.6 - Math.abs(dx), dy + 9, 9.4 - dy - Math.abs(dx) * 0.55);
    case 'hex': return Math.min(9 - Math.abs(dy), 9.4 - Math.abs(dx) - Math.abs(dy) * 0.55);
    case 'drop': return Math.min(9.3 - Math.hypot(dx, dy + 1), dy < -2 ? 99 : 9.3 - Math.hypot(dx, dy + 1));
    default: return 9.3 - Math.hypot(dx, dy);
  }
}
/** an illustrated checkpoint pin: a medallion on a stake, the place's picture inside */
export function pinBuffer(L: LocationDef, o: { dim?: boolean } = {}): PixelBuffer {
  const rows = PICS[L.id] ?? PICS[PIC_BY_KIND[L.kind] ?? ''] ?? PICS.star;
  const [rl, rd] = L.id === 'camp' ? ['#e8584a', '#8a1a14'] : RING[L.region] ?? RING.home;
  const shape: Shape = L.id === 'camp' ? 'house' : SHAPE[L.kind] ?? 'round';
  const b = new PixelBuffer(23, 30);
  const ox = 2, oy = 1;
  const ink = hex('#1e1208'), lit = hex(rl), dk = hex(rd), paper = hex('#f8eed4'), paper2 = hex('#e6d4a8');
  // the ground shadow (a dithered ellipse) and the stake
  for (let y = 25; y < 30; y++) for (let x = 3; x < 20; x++) { const e = ((x - 11.5) / 7.5) ** 2 + ((y - 27.5) / 2.2) ** 2; if (e < 1 && bayer(x, y) < 0.55) b.set(x, y, hex('#1a1008')); }
  for (let y = 19; y < 28; y++) { const hw = Math.max(0, (27 - y) * 0.34); for (let x = Math.round(11.5 - hw - 0.5); x <= Math.round(11.5 + hw - 0.5); x++) b.set(x, y, x <= 11 ? dk : ink); b.set(Math.round(11.5 - hw - 1), y, ink); b.set(Math.round(11.5 + hw), y, ink); }
  for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
    const d = inShape(shape, x, y);
    if (d < 0) continue;
    const ang = Math.atan2(y - 9.5, x - 9.5);
    const top = Math.sin(ang + Math.PI * 0.75) > 0.15;
    b.set(ox + x, oy + y, d < 1 ? ink : d < 2.6 ? (top ? lit : dk) : d < 3.4 ? ink : y > 13 ? paper2 : paper);
  }
  // a glint on the rim
  b.set(ox + 4, oy + 3, hex('#fff6d8')); b.set(ox + 5, oy + 3, hex('#fff6d8'));
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = PIC_PAL[r[x]]; if (c) b.set(ox + 4 + x, oy + 4 + y, hex(c)); } });
  if (o.dim) for (let i = 0; i < b.data.length; i++) if (b.data[i] >>> 24) b.data[i] = mix(b.data[i], hex('#8a7a5e'), 0.45);
  return b;
}
export const pinURL = (L: LocationDef, dim = false) => cachedURL('pin:' + L.id + dim, () => pinBuffer(L, { dim }));

/** a stake with a red flax ribbon (three frames, side by side) */
export function stakeURL(known: boolean): string {
  return cachedURL('stake:' + known, () => {
    const fw = 11, b = new PixelBuffer(fw * 3, 19);
    const red = hex(known ? '#d03a2a' : '#c8a46a'), red2 = hex(known ? '#8a1c14' : '#8a6a44'), wood = hex('#7a5430'), wood2 = hex('#3a2414'), ink = hex('#1e1208');
    const rib = [[[4, 1], [5, 1], [6, 2], [7, 2], [8, 3], [6, 3], [9, 3], [7, 4]], [[4, 1], [5, 2], [6, 2], [7, 3], [8, 3], [9, 4], [6, 3], [8, 4]], [[4, 1], [5, 1], [6, 1], [7, 2], [8, 2], [9, 2], [6, 2], [7, 3]]];
    for (let f = 0; f < 3; f++) {
      const ox = f * fw;
      for (let y = 1; y < 16; y++) { b.set(ox + 2, y, ink); b.set(ox + 3, y, y % 4 ? wood : wood2); b.set(ox + 4, y, ink); }
      b.set(ox + 3, 0, ink); b.set(ox + 3, 16, ink);
      for (let x = 1; x < 7; x++) if (bayer(x, 17) < 0.6) b.set(ox + x, 17, hex('#1a1008'));
      rib[f].forEach(([x, y], k) => b.set(ox + x, y, k % 2 ? red2 : red));
    }
    return b;
  });
}
/** Mori as a map token, two frames (standing and stepping); in the Kitten on a sea trip */
export function moriURL(boat = false): string {
  return cachedURL('mori:' + boat, () => {
    const pal: Record<string, string> = { k: '#1e140c', n: '#3a2414', s: '#e0a878', b: '#2e5a8a', B: '#4a7ab0', N: '#5a4a3a', o: '#c86a2a', w: '#f4f0e4', r: '#b0281e', y: '#e8c050' };
    const fr = boat
      ? [['....w....', '...ww....', '..www....', '.wwww....', 'wwwww.k..', '....k....', 'rrrrrrrrr', '.rrrrrrr.', '..bbbbb..'], ['....w....', '...ww....', '..www....', '.wwwwww..', 'wwwwww.k.', '....k....', 'rrrrrrrrr', '.rrrrrrr.', '.bbbbbbb.']]
      : [['...kkk...', '..kyyyk..', '.kkkkkkk.', '..kssskk.', '..ksssko.', '...kkkko.', '.kbBBbkko', 'kbBbbbbko', 'ksbbbbbsk', '.kbbbbbk.', '..kNkNk..', '..kNkNk..', '..kk.kk..'], ['...kkk...', '..kyyyk..', '.kkkkkkk.', '..kssskk.', '..ksssko.', '...kkkko.', '.kbBBbkko', 'kbBbbbbko', 'ksbbbbbsk', '.kbbbbbk.', '..kNkkN..', '.kN...kN.', '.kk....kk']];
    const fw = 10, fh = fr[0].length + 1;
    const b = new PixelBuffer(fw * 2, fh);
    fr.forEach((rows, f) => {
      for (let x = 1; x < 9; x++) if (bayer(x, fh - 1) < 0.6) b.set(f * fw + x, fh - 1, hex('#1a1008'));
      rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) b.set(f * fw + x, y, hex(c)); } });
    });
    return b;
  });
}

// ------------------------------------------------------------------ buttons and panels
export type Glyph = 'plus' | 'minus' | 'here' | 'legend' | 'close' | 'fit';
const GLYPHS: Record<Glyph, string[]> = {
  plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
  minus: ['........', '........', '........', '########', '########', '........', '........', '........'],
  here: ['..####..', '.#....#.', '#..##..#', '#.####.#', '#.####.#', '#..##..#', '.#....#.', '..####..'],
  legend: ['.######.', '##....##', '.....##.', '....##..', '...##...', '...##...', '........', '...##...'],
  close: ['##....##', '###..###', '.######.', '..####..', '..####..', '.######.', '###..###', '##....##'],
  fit: ['###..###', '#......#', '#......#', '........', '........', '#......#', '#......#', '###..###'],
};
/** a chunky wooden button with a brass glyph (frames: up, hover, down side by side) */
export function buttonURL(g: Glyph, red = false): string {
  return cachedURL('btn:' + g + red, () => {
    const s = 18, b = new PixelBuffer(s * 3, s + 2);
    for (let f = 0; f < 3; f++) {
      const ox = f * s, down = f === 2 ? 1 : 0;
      const face = red ? [hex('#6a160e'), hex('#9a2416'), hex('#c8402a'), hex('#e8644a')] : [hex('#2e1c0e'), hex('#4e3218'), hex('#6e4a24'), hex('#8e6434')];
      for (let y = 0; y < s + 2; y++) for (let x = 0; x < s; x++) {
        const yy = y - down;
        const corner = (x === 0 || x === s - 1) && (yy === 0 || yy === s - 1);
        if (yy < 0 || corner) continue;
        if (yy >= s) { if (!down && yy === s && x > 0 && x < s - 1) b.set(ox + x, y, hex('#120a04')); continue; }
        const e = x === 0 || x === s - 1 || yy === 0 || yy === s - 1;
        let c = e ? hex('#140c06') : yy === 1 || x === 1 ? face[3] : yy >= s - 3 ? face[0] : x >= s - 2 ? face[1] : face[2];
        if (f === 1 && !e && yy > 1 && yy < s - 3) c = mix(c, hex('#ffe0a0'), 0.18);
        b.set(ox + x, y, c);
      }
      const rows = GLYPHS[g];
      const gc = red ? hex('#fff0dc') : hex('#f4d070'), gd = red ? hex('#5a0e08') : hex('#3a2208');
      rows.forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '#') { b.set(ox + 5 + x + 1, 5 + y + 1 + down, gd); b.set(ox + 5 + x, 5 + y + down, gc); } });
    }
    return b;
  });
}

/** a paper panel, w x h art px: a 1 px ink edge, a lit top, a dithered drop shadow, an optional pin */
export function panel(w: number, h: number, o: { pin?: boolean; tone?: 'paper' | 'dark' | 'note'; torn?: boolean } = {}): PixelBuffer {
  const b = new PixelBuffer(w + 3, h + 3);
  const tone = o.tone ?? 'paper';
  const base = tone === 'dark' ? [hex('#0e161e'), UI.night, UI.night2, hex('#3a4a5a')] : tone === 'note' ? [hex('#c8b47a'), hex('#e4d29e'), hex('#f4e4b4'), hex('#fff4d0')] : [UI.paper3, UI.paper2, UI.paper, UI.hi];
  for (let y = 0; y < h + 3; y++) for (let x = 0; x < w + 3; x++) {
    if (x >= 3 && y >= 3 && (x >= w || y >= h) && bayer(x, y) < 0.5) b.set(x, y, hex('#120a04'));
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const torn = o.torn && (y === h - 1 || y === h - 2) && hash2(x >> 1, 7, 3) > (y === h - 1 ? 0.45 : 0.85);
    if (torn) continue;
    const e = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    const n = hash2(x >> 1, y >> 1, 11);
    let c = e ? (tone === 'dark' ? hex('#060a0e') : UI.ink) : y === 1 ? base[3] : y >= h - 3 || x >= w - 2 ? base[0] : x === 1 ? base[3] : base[2];
    if (!e && tone !== 'dark' && n > 0.93) c = base[1];
    b.set(x, y, c);
  }
  if (o.pin) {
    const cx = Math.floor(w / 2);
    for (const [dx, dy, c] of [[0, 1, '#ff8a70'], [-1, 2, '#e05a3a'], [0, 2, '#e05a3a'], [1, 2, '#a8281e'], [-1, 3, '#a8281e'], [0, 3, '#a8281e'], [1, 3, '#6a120c'], [0, 4, '#3a0a06'], [1, 5, '#120a04']] as [number, number, string][]) b.set(cx + dx, dy, hex(c));
  }
  return b;
}

/** a horizontal gauge: segments filled to `v` of `max`, a dark frame */
export function gauge(b: PixelBuffer, x: number, y: number, w: number, v: number, max: number, on: C, on2: C) {
  const segs = Math.floor((w - 2) / 4);
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < segs * 4 + 1; xx++) b.set(x + xx, y + yy, yy === 0 || yy === 6 || xx === 0 || xx === segs * 4 ? UI.ink : hex('#1a1008'));
  const n = Math.round((v / max) * segs);
  for (let k = 0; k < segs; k++) for (let yy = 1; yy < 6; yy++) for (let xx = 1; xx < 4; xx++) {
    if (xx === 3 && yy > 0) continue;
    b.set(x + k * 4 + xx, y + yy, k < n ? (yy === 1 ? mix(on, hex('#ffffff'), 0.4) : yy >= 4 ? on2 : on) : hex('#3a2a1a'));
  }
}

// ------------------------------------------------------------------ the table and the roll
/** a tile of planked wood for the table under the map */
export function woodURL(): string {
  return cachedURL('wood', () => {
    const w = 96, h = 64, b = new PixelBuffer(w, h);
    const ramp = [hex('#20120a'), hex('#2c190c'), hex('#36200f'), hex('#402612'), hex('#4a2c15')];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const plank = Math.floor(y / 16), py = y % 16;
      if (py === 0) { b.set(x, y, hex('#120a05')); continue; }
      const grain = Math.sin((x + plank * 31) * 0.09 + Math.sin(y * 0.6 + plank) * 1.4 + hash2(plank, 1, 3) * 6);
      let v = 2 + grain * 0.9 + (hash2(x >> 2, y, plank) - 0.5) * 0.8;
      if (py === 1) v += 1.2;
      if (py === 15) v -= 1.2;
      b.set(x, y, ramp[clamp(Math.round(v), 0, 4)]);
    }
    for (let k = 0; k < 4; k++) { const x = (k * 37 + 11) % w, y = Math.floor(k * 16 + 8); b.set(x, y, hex('#0e0804')); b.set(x + 1, y, hex('#5a3a20')); }
    return b;
  });
}
/** one row of the parchment roll's cylinder, light to shadow across (stretched down the sheet's edge) */
export function rollRow(w: number): PixelBuffer {
  const b = new PixelBuffer(w, 1);
  const ramp = [hex('#4a3018'), hex('#7e6036'), hex('#b49464'), hex('#dcc494'), hex('#f2e2b6'), hex('#e6d0a0'), hex('#c4a670'), hex('#8a6a3e'), hex('#4a3018')];
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    b.set(x, 0, ramp[clamp(Math.round(t * (ramp.length - 1) + (bayer(x, 0) - 0.5) * 0.6), 0, ramp.length - 1)]);
  }
  // the turns of paper wound on it
  for (const t of [0.2, 0.34, 0.46]) b.set(Math.round(t * (w - 1)), 0, hex('#a08050'));
  return b;
}
/** the end cap of the roll: the spiral of the paper seen end on */
export function rollCap(w: number): PixelBuffer {
  const h = Math.max(4, Math.round(w * 0.42));
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
    const r = Math.hypot(dx, dy);
    if (r > 1) continue;
    const ring = Math.floor(r * 4.5 + Math.atan2(dy, dx) / 6.28);
    b.set(x, y, r > 0.86 ? hex('#3a2410') : ring % 2 ? hex('#c8a874') : hex('#e4cc9a'));
  }
  return b;
}

// ------------------------------------------------------------------ text helpers for panels
/** set wrapped text into a buffer; returns the y after the last line */
export function para(b: PixelBuffer, text: string, x: number, y: number, maxW: number, c: C, lead = GH + 1, o: TextOpts = {}): number {
  for (const line of wrap(text, maxW, o)) { drawText(b, line, x, y, c, o); y += lead; }
  return y;
}
export { measure, drawText, wrap, GH };
