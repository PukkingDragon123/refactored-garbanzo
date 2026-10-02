// V10 Region Map: Mori's own map of the island, a real sheet of aged paper he unrolls on the table.
// Only Joshu's old chart is on it at first (a faint coastline, a compass rose, rhumb lines, a sea
// serpent); every stretch Mori walks is sketched in ink and then washed with colour, and from then
// on that land is alive: surf, rivers, smoke, clouds, birds, the odd whale (regionmap-fx.ts paints
// and animates it). Names are hand-inked; notes and animal sketches are pinned to the paper.
//
// Found places are illustrated checkpoint pins, and the ways on Mori has seen are little flagged
// stakes. Tap one for its card; "Set off" draws the route in ink from where Mori is, walks (or sails)
// a marker along it while the clock runs, then rolls the map up and returns the target: from camp
// the caller sets off (field10 departFromCamp); on an expedition (opts.travelFrom) the caller moves
// on to that checkpoint (maptravel travelOn). Pan with a drag, zoom with the wheel or a pinch.
// openRegionMap() resolves with the target ('loc' or 'loc@x') or null.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { el } from '../ui';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix } from '../../art/color';
import { clamp, hash2 } from '../../core/math';
import { W, H, INK, INK2, MARKS, paintMap, paintPaper } from './regionmap-art';
import { LiveMap, currentSeedState, lastShown, markShown, routeEnds, sketchCard } from './regionmap-fx';
import type { SeedState } from './regionmap-fx';
import { SEA_LANES, REGION_NAMES } from './mapgeo';
import {
  LOCATIONS, location, isFound, isRumoured, mapPoint, explored, discoveries, discoveriesAt, mapNotes, homeCost, syncReachable, lastPos,
  onMapChange, BINS, xRange, seenBins, isIsland,
} from '../../game/v10/regions';
import type { LocationDef, Discovery } from '../../game/v10/regions';
import { currentExpedition, expeditionHour, clockText } from '../../game/v10/expedition';
import { energy, maxEnergy } from '../../game/v10/energy';
import { dayNumber } from '../../game/v10/day';
import { junctions, tripTo, tripNeed, routePath, targetId, arrivalHour } from '../../game/v10/maptravel';
import type { Target, TripCost } from '../../game/v10/maptravel';
import { speciesSprite } from '../icons';
import { SPECIES_BY_ID } from '../../game/species';
// Caveat (SIL Open Font License, see src/assets/fonts/Caveat-OFL.txt): Mori's handwriting
import caveatLatin from '../../assets/fonts/caveat-latin.woff2';
import caveatExt from '../../assets/fonts/caveat-latinext.woff2';

export interface RegionMapOpts {
  /** no travelling from camp (during an expedition) */
  readOnly?: boolean;
  /** on an expedition: travel on from here to another checkpoint (or home) */
  travelFrom?: { loc: string; x: number };
  /** where Mori is ("you are here") */
  here?: { loc: string; x: number };
  /** select this location when the map opens */
  focus?: string;
}

const REGION_NAME: Record<string, string> = { home: 'Home shore', interior: 'The interior', south: 'The south', east: 'The east coast', ocean: 'Open sea', isle2: 'Offshore' };
const KIND_NAME: Record<string, string> = { camp: 'Camp', site: 'Wild place', village: 'Village', ruin: 'Ruins', cave: 'Cave', fossil: 'Fossil bed', ecosystem: 'Strange ecosystem', ocean: 'Open sea', island: 'Island' };
const ROUTE_WORD: Record<string, string> = { walk: 'a walk', climb: 'a climb', swim: 'a swim', wade: 'a wade', dive: 'a dive', tunnel: 'a rope descent' };
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h % 1 ? h.toFixed(1) : h} h`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeO = (t: number) => 1 - Math.pow(1 - t, 3);

// ------------------------------------------------------------------ pictograms for the checkpoint pins
const PIC_PAL: Record<string, string> = {
  k: '#2a1a10', w: '#fbf6e8', r: '#a8281e', R: '#e05a3a', g: '#3e7a34', G: '#86c050', d: '#1e3e22', b: '#2e6a9a', B: '#9ad4ee', y: '#e0a818',
  s: '#7e786c', S: '#c4beb0', n: '#5e3e22', N: '#b08048', o: '#e07a2a', c: '#3fe0cc', p: '#8a5ab8', t: '#dcc48e', m: '#5a4630',
};
const PICS: Record<string, string[]> = {
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
const RING: Record<string, [string, string]> = {
  home: ['#e0b048', '#9a6a1c'], interior: ['#7cc05a', '#3a7428'], south: ['#e08a4a', '#984a1a'], east: ['#6ab0e0', '#2a6a98'], ocean: ['#6ab0e0', '#2a5a88'], isle2: ['#e0784a', '#984020'],
};
const urlCache = new Map<string, string>();
/** a sprite sheet (frames side by side) with a soft drop shadow baked in, offset (dx, dy) */
function shadowed(b: PixelBuffer, frames: number, dx: number, dy: number): PixelBuffer {
  const fw = b.w / frames, ow = fw + dx, out = new PixelBuffer(ow * frames, b.h + dy);
  const sh = hex('#1e1208', 90);
  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < fw; x++) if (b.data[y * b.w + f * fw + x] >>> 24) out.set(f * ow + x + dx, y + dy, sh);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < fw; x++) { const c = b.data[y * b.w + f * fw + x]; if (c >>> 24) out.set(f * ow + x, y, c); }
  }
  return out;
}
function badgeURL(L: LocationDef): string {
  const key = 'b:' + L.id;
  let u = urlCache.get(key);
  if (u) return u;
  const rows = PICS[L.id] ?? PICS[PIC_BY_KIND[L.kind] ?? ''] ?? PICS.star;
  const [rl, rd] = L.id === 'camp' ? ['#e8584a', '#8a1a14'] : RING[L.region] ?? RING.home;
  const b = new PixelBuffer(19, 25);
  const ink = hex('#21140a'), lit = hex(rl), dk = hex(rd), paper = hex('#f6ead0'), paper2 = hex('#e4d2a6');
  for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
    const d = Math.hypot(x + 0.5 - 9.5, y + 0.5 - 9.5);
    if (d > 9.3) continue;
    const ang = Math.atan2(y - 9.5, x - 9.5);
    const top = Math.sin(ang + Math.PI * 0.75) > 0.2;
    b.set(x, y, d > 8.3 ? ink : d > 6.6 ? (top ? lit : dk) : d > 5.8 ? ink : y > 13 ? paper2 : paper);
  }
  // the pin's point
  for (let y = 18; y < 25; y++) { const hw = Math.max(0, (24 - y) * 0.42); for (let x = Math.round(9.5 - hw - 0.5); x <= Math.round(9.5 + hw - 0.5); x++) b.set(x, y, x <= 9 ? dk : ink); b.set(Math.round(9.5 - hw - 1), y, ink); b.set(Math.round(9.5 + hw), y, ink); }
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = PIC_PAL[r[x]]; if (c) b.set(4 + x, 4 + y, hex(c)); } });
  u = shadowed(b, 1, 2, 2).toDataURL(1);
  urlCache.set(key, u);
  return u;
}
/** a stake with a red flax ribbon (three frames, side by side) */
function stakeURL(known: boolean): string {
  const key = 'stake:' + known;
  let u = urlCache.get(key);
  if (u) return u;
  const fw = 9, b = new PixelBuffer(fw * 3, 15);
  const red = hex(known ? '#d03a2a' : '#b89a6a'), red2 = hex(known ? '#8a1c14' : '#8a6a44'), wood = hex('#6a4a2a'), wood2 = hex('#3a2414');
  const rib = [[[3, 1], [4, 1], [5, 2], [6, 2], [5, 3], [7, 3]], [[3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [6, 4]], [[3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [5, 3]]];
  for (let f = 0; f < 3; f++) {
    const ox = f * fw;
    for (let y = 1; y < 14; y++) { b.set(ox + 2, y, wood2); b.set(ox + 3, y, y % 3 ? wood : wood2); }
    b.set(ox + 2, 0, wood2); b.set(ox + 3, 0, wood);
    rib[f].forEach(([x, y], k) => b.set(ox + x, y, k % 2 ? red2 : red));
  }
  u = shadowed(b, 3, 1, 1).toDataURL(1);
  urlCache.set(key, u);
  return u;
}
/** Mori as a map token, two frames (standing and stepping) */
function moriURL(boat = false): string {
  const key = 'mori:' + boat;
  let u = urlCache.get(key);
  if (u) return u;
  const pal: Record<string, string> = { k: '#1e140c', n: '#3a2414', s: '#e0a878', b: '#2e5a8a', B: '#4a7ab0', N: '#5a4a3a', o: '#c86a2a', w: '#f4f0e4', r: '#b0281e' };
  const fr = boat
    ? [['....w....', '...ww....', '..www....', '.wwww....', 'wwwww.k..', '....k....', 'rrrrrrrrr', '.rrrrrrr.', '..bbbbb..'], ['....w....', '...ww....', '..www....', '.wwwwww..', 'wwwwww.k.', '....k....', 'rrrrrrrrr', '.rrrrrrr.', '.bbbbbbb.']]
    : [['...kkk...', '..knnnk..', '..kssskk.', '..ksssko.', '...kkkko.', '.kbBBbkko', 'kbBbbbbko', 'ksbbbbbsk', '.kbbbbbk.', '..kNkNk..', '..kNkNk..', '..kk.kk..'], ['...kkk...', '..knnnk..', '..kssskk.', '..ksssko.', '...kkkko.', '.kbBBbkko', 'kbBbbbbko', 'ksbbbbbsk', '.kbbbbbk.', '..kNkkN..', '.kN...kN.', '.kk....kk']];
  const fw = 9, fh = fr[0].length;
  const b = new PixelBuffer(fw * 2, fh);
  fr.forEach((rows, f) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) b.set(f * fw + x, y, hex(c)); } }));
  u = shadowed(b, 2, 1, 1).toDataURL(1);
  urlCache.set(key, u);
  return u;
}

// ------------------------------------------------------------------ species sketches
const inked = new Map<string, PixelBuffer | null>();
const pending = new Map<string, Promise<void>>();
/** the species sprite as a little sepia sketch (ink outline, a light wash inside), at most 18px */
function inkSpecies(id: string): Promise<void> {
  if (inked.has(id)) return Promise.resolve();
  let p = pending.get(id);
  if (p) return p;
  p = new Promise<void>(res => {
    let url = '';
    try { url = speciesSprite(id); } catch { url = ''; }
    if (!url) { inked.set(id, null); res(); return; }
    const img = new Image();
    img.onload = () => {
      const s = 3, w0 = Math.floor(img.width / s), h0 = Math.floor(img.height / s);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const src = g.getImageData(0, 0, img.width, img.height).data;
      const k = Math.max(1, Math.ceil(Math.max(w0, h0 * 1.4) / 18));
      const w = Math.max(1, Math.floor(w0 / k)), h = Math.max(1, Math.floor(h0 / k));
      const b = new PixelBuffer(w + 2, h + 2);
      const op = new Uint8Array((w + 2) * (h + 2));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = (x * k + Math.floor(k / 2)) * s + 1, sy = (y * k + Math.floor(k / 2)) * s + 1;
        const i = (sy * img.width + sx) * 4;
        if (src[i + 3] < 100) continue;
        const lum = (src[i] * 0.3 + src[i + 1] * 0.55 + src[i + 2] * 0.15) / 255;
        op[(y + 1) * (w + 2) + x + 1] = 1;
        b.set(x + 1, y + 1, lum < 0.28 ? INK2 : mix(hex('#c8ad78'), hex('#8a6c48'), clamp(1 - lum)));
      }
      for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
        if (op[y * (w + 2) + x]) continue;
        const n = (x > 0 && op[y * (w + 2) + x - 1]) || (x < w + 1 && op[y * (w + 2) + x + 1]) || (y > 0 && op[(y - 1) * (w + 2) + x]) || (y < h + 1 && op[(y + 1) * (w + 2) + x]);
        if (n) b.set(x, y, INK);
      }
      inked.set(id, b);
      res();
    };
    img.onerror = () => { inked.set(id, null); res(); };
    img.src = url;
  });
  pending.set(id, p);
  return p;
}

interface Spot { x: number; y: number; d: Discovery }
/** discovery marks laid out beside their path, alternating sides so they don't sit on the trail */
function spots(): Spot[] {
  const out: Spot[] = [];
  const used = new Map<string, number>();
  for (const d of discoveries()) {
    if (d.kind === 'location') continue;
    const L = location(d.loc);
    if (!L) continue;
    const x = d.x ?? (xRange(L)[0] + xRange(L)[1]) / 2;
    const [u, v] = mapPoint(d.loc, x), [u2, v2] = mapPoint(d.loc, x + 60);
    let nx = -(v2 - v) * H, ny = (u2 - u) * W;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const key = `${d.loc}:${Math.round(x / 120)}`;
    const k = used.get(key) ?? 0;
    used.set(key, k + 1);
    const side = k % 2 ? -1 : 1, ring = 11 + Math.floor(k / 2) * 11;
    out.push({ x: u * W + nx * ring * side + (k > 1 ? (k % 3) * 3 : 0), y: v * H + ny * ring * side, d });
  }
  return out;
}
/** the trail walked through each place (map px), split where it hasn't been walked */
function walkedTrails(): { pts: [number, number][]; beach: boolean }[] {
  const out: { pts: [number, number][]; beach: boolean }[] = [];
  for (const L of LOCATIONS) {
    if (!L.path) continue;
    const bins = seenBins(L.id), [a, b] = xRange(L);
    let run: [number, number][] = [];
    const flush = () => { if (run.length > 1) out.push({ pts: run, beach: isIsland(L) }); run = []; };
    for (let i = 0; i < BINS; i++) {
      if (!bins[i]) { flush(); continue; }
      const x0 = a + ((b - a) * i) / BINS, x1 = a + ((b - a) * (i + 1)) / BINS;
      for (let k = run.length ? 1 : 0; k <= 3; k++) { const [u, v] = mapPoint(L.id, x0 + ((x1 - x0) * k) / 3); run.push([u * W, v * H]); }
    }
    flush();
  }
  return out;
}

// ------------------------------------------------------------------ the window
const HAND = `'RM Caveat', 'Caveat', 'Segoe Print', 'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', cursive`;
const FONTS = `
@font-face { font-family: 'RM Caveat'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(${caveatExt}) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'RM Caveat'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(${caveatLatin}) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
`;
const CSS = `
.rm11 { position: absolute; inset: 0; z-index: 60; pointer-events: auto; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; opacity: 0; transition: opacity 0.25s;
  background: radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%), repeating-linear-gradient(90deg, rgba(0,0,0,0.0) 0 118px, rgba(0,0,0,0.28) 118px 121px, rgba(255,255,255,0.03) 121px 123px), linear-gradient(176deg, #4a2c16, #3a2210 40%, #2c1a0c 70%, #24150a);
  background-color: #2c1a0c; }
.rm11::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.35;
  background: repeating-linear-gradient(178deg, rgba(255,220,170,0.035) 0 2px, rgba(0,0,0,0.05) 2px 5px, rgba(0,0,0,0) 5px 9px); }
.rm11.on { opacity: 1; }
.rm11 canvas.sh { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.rm11 .ov { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.rm11 .ov > * { position: absolute; left: 0; top: 0; }
.rm11.drag { cursor: grabbing; }
.rm11 .lbl { white-space: nowrap; font-family: ${HAND}; font-weight: 700; color: #2e1c0e; line-height: 1; font-size: 19px; letter-spacing: 0.01em;
  text-shadow: 0 0 2px rgba(246,234,208,0.95), 0 0 4px rgba(246,234,208,0.8), 0 1px 0 rgba(246,234,208,0.9); }
.rm11 .lbl small { display: block; font-weight: 500; font-size: 0.74em; color: #5e3e22; margin-top: -1px; }
.rm11 .lbl.sm { font-size: 16px; }
.rm11 .lbl.q { color: #7a6040; font-weight: 500; font-style: italic; }
.rm11 .lbl.sel { color: #9a2a1c; }
.rm11 .lbl.new { animation: rmWrite 1.4s steps(14) both; }
@keyframes rmWrite { from { clip-path: inset(-20% 100% -20% 0); } to { clip-path: inset(-20% -5% -20% 0); } }
.rm11 .reg { font-family: ${HAND}; font-weight: 600; color: rgba(40,24,10,0.62); white-space: nowrap; letter-spacing: 0.16em; transform-origin: 50% 50%;
  text-shadow: 0 0 3px rgba(240,226,190,0.55); }
.rm11 .reg.sea { color: rgba(64,52,36,0.55); letter-spacing: 0.3em; font-weight: 500; text-shadow: none; }
.rm11 .reg.title { color: rgba(46,28,12,0.9); letter-spacing: 0.08em; font-weight: 700; text-shadow: none; }
.rm11 .reg.tiny { color: rgba(60,40,20,0.75); letter-spacing: 0.04em; font-weight: 500; text-shadow: none; }
.rm11 .cp { width: 0; height: 0; pointer-events: none; }
.rm11 .cp i { position: absolute; left: -19px; top: -50px; width: 42px; height: 54px; background-size: 100% 100%; image-rendering: pixelated;
  transition: transform 0.15s; transform-origin: 50% 100%; }
.rm11 .cp.hov i, .rm11 .cp.sel i { transform: translateY(-5px) scale(1.08); }
.rm11 .cp.sel::after { content: ''; position: absolute; left: -21px; top: -47px; width: 38px; height: 38px; border: 2px dashed #a8281e; border-radius: 50%; animation: rmSpin 7s linear infinite; }
.rm11 .cp.dim i { opacity: 0.72; }
.rm11 .cp.drop i { animation: rmDrop 0.7s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes rmDrop { 0% { transform: translateY(-46px) scale(1.3); opacity: 0; } 55% { opacity: 1; } 100% { transform: none; opacity: 1; } }
.rm11 .cp.stamp i { animation: rmStamp 0.5s ease-out; }
@keyframes rmStamp { 0% { transform: scale(1); } 35% { transform: translateY(-8px) scale(1.25); } 100% { transform: none; } }
.rm11 .cp.small i { left: -14px; top: -37px; width: 31px; height: 40px; }
.rm11 .cp.small.sel::after { left: -16px; top: -35px; width: 28px; height: 28px; }
@keyframes rmSpin { to { transform: rotate(360deg); } }
.rm11 .jn { width: 0; height: 0; }
.rm11 .jn i { position: absolute; left: -6px; top: -29px; width: 20px; height: 32px; background-size: 300% 100%; image-rendering: pixelated; animation: rmFlag 0.6s steps(3) infinite; }
.rm11 .jn.sel i, .rm11 .jn.hov i { transform: translateY(-3px) scale(1.15); }
.rm11 .jn b { position: absolute; left: 8px; top: -30px; font: 700 15px ${HAND}; color: #8a2a1a; text-shadow: 0 0 2px #f6ead0, 0 0 3px #f6ead0; }
@keyframes rmFlag { from { background-position: 0 0; } to { background-position: -300% 0; } }
.rm11 .here { width: 0; height: 0; }
.rm11 .here::before { content: ''; position: absolute; left: -16px; top: -10px; width: 32px; height: 20px; border-radius: 50%; border: 2px solid #c8301e; box-shadow: 0 0 0 2px rgba(255,240,200,0.5); animation: rmBreath 2.4s ease-in-out infinite; }
.rm11 .here i { position: absolute; left: -9px; top: -24px; width: 20px; height: 26px; background-size: 200% 100%; image-rendering: pixelated; animation: rmBob 2.4s ease-in-out infinite; }
.rm11 .here b { position: absolute; right: 14px; top: -22px; transform: rotate(-4deg); font: 700 16px ${HAND}; color: #b0281e; white-space: nowrap; text-shadow: 0 0 2px #f6ead0, 0 0 4px #f6ead0; }
.rm11 .here b::after { content: ' →'; }
@keyframes rmBreath { 0%, 100% { transform: scale(0.82); opacity: 0.95; } 50% { transform: scale(1.18); opacity: 0.45; } }
@keyframes rmBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.rm11 .walker { width: 0; height: 0; }
.rm11 .walker i { position: absolute; left: -10px; top: -26px; width: 22px; height: 28px; background-size: 200% 100%; image-rendering: pixelated; animation: rmStep 0.36s steps(2) infinite; }
.rm11 .walker.boat i { left: -11px; top: -20px; width: 24px; height: 24px; animation-duration: 0.9s; }
@keyframes rmStep { from { background-position: 0 0; } to { background-position: -200% 0; } }
.rm11 .note { max-width: 12em; padding: 5px 8px 6px; font: 600 15px/1.05 ${HAND}; color: #3a2414; background: linear-gradient(170deg, #f8ecc8, #ecdcae); box-shadow: 1px 2px 0 rgba(40,24,10,0.25), 0 0 0 1px rgba(120,90,50,0.25); white-space: normal; }
.rm11 .note::before { content: ''; position: absolute; left: 50%; top: -4px; width: 7px; height: 7px; margin-left: -3px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a70, #a8281e 60%, #5a120c); box-shadow: 1px 1px 0 rgba(0,0,0,0.3); }
.rm11 .note.pencil { background: none; box-shadow: none; color: #5e4026; font-weight: 500; font-size: 14px; text-shadow: 0 0 2px rgba(246,234,208,0.9); }
.rm11 .note.pencil::before { display: none; }
.rm11 .top { position: absolute; left: 50%; top: clamp(6px, 1.2vh, 12px); transform: translateX(-50%); display: flex; align-items: center; gap: 0.8em; white-space: nowrap; pointer-events: none; z-index: 3; }
.rm11 .top .pz-tab { font-size: 1.3em !important; }
.rm11 .top .st { font-family: var(--head); color: #ffe9a8; text-shadow: 0 2px 0 #1a0e06; font-size: 1.05em; letter-spacing: 0.05em; padding: 0.15em 0.6em; background: rgba(26,14,6,0.55); }
.rm11 .top .st i { font-style: normal; color: #8ad8ff; }
.rm11 .top .st em { font-style: normal; color: #ffb38a; }
.rm11 .x { position: absolute; right: clamp(8px, 1.6vw, 18px); top: clamp(6px, 1.2vh, 12px); z-index: 3; }
.rm11 .tools { position: absolute; left: clamp(12px, 2vw, 26px); bottom: clamp(14px, 2.4vw, 30px); display: flex; flex-direction: column; gap: 8px; z-index: 3; }
.rm11 .tools button { width: 46px; height: 46px; padding: 0 !important; font-size: 1.3em !important; }
.rm11 .legend { position: absolute; left: clamp(70px, 7.4vw, 92px); bottom: clamp(14px, 2.4vw, 30px); padding: 10px 12px 8px; font: 600 16px/1.05 ${HAND}; color: #3a2614;
  background: linear-gradient(172deg, #f6e8c4, #e8d4a4); box-shadow: 2px 3px 0 rgba(20,10,4,0.35), 0 0 0 1px rgba(110,80,40,0.35); display: grid; grid-template-columns: auto auto; gap: 3px 12px; pointer-events: none; transform: rotate(-0.8deg); z-index: 3; }
.rm11 .legend::before { content: ''; position: absolute; left: 50%; top: -5px; width: 9px; height: 9px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a70, #a8281e 60%, #5a120c); }
.rm11 .legend.off { display: none; }
.rm11 .legend span { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.rm11 .legend img { width: 20px; height: 24px; image-rendering: pixelated; object-fit: contain; }
.rm11 .legend .ln { display: inline-block; width: 20px; height: 3px; }
.rm11 .card { position: absolute; right: clamp(16px, 2.6vw, 36px); top: clamp(64px, 9vh, 84px); width: min(22em, 38vw); max-height: calc(100% - clamp(100px, 15vh, 130px)); overflow: auto; padding: 16px 16px 14px; display: none; pointer-events: auto; color: #3a2614;
  background: linear-gradient(174deg, #f8ecc8 0%, #f0dfb4 60%, #e6d0a0 100%); box-shadow: 3px 5px 0 rgba(20,10,4,0.38), 0 0 0 1px rgba(110,80,40,0.4), inset 0 0 24px rgba(160,120,60,0.25); transform: rotate(0.5deg); z-index: 4; }
.rm11 .card.on { display: block; animation: rmCard 0.28s cubic-bezier(.2,1.4,.4,1); }
@keyframes rmCard { from { transform: translateY(-16px) rotate(-2deg); opacity: 0; } to { transform: rotate(0.5deg); opacity: 1; } }
.rm11 .card::before { content: ''; position: absolute; left: 50%; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a70, #a8281e 60%, #5a120c); box-shadow: 1px 2px 0 rgba(0,0,0,0.3); }
.rm11 .card h3 { margin: 6px 0 0; font: 700 1.9em/1 ${HAND}; color: #2a1a0c; }
.rm11 .card .sub { font: 500 1.08em/1.1 ${HAND}; color: #6a4a2a; margin-bottom: 0.5em; }
.rm11 .card .row { display: flex; justify-content: space-between; gap: 0.6em; font-size: 0.92em; margin: 0.2em 0; border-bottom: 1px dotted rgba(110,80,40,0.35); }
.rm11 .card .row b { color: #3a2614; font-weight: 600; text-align: right; }
.rm11 .card .pips i { display: inline-block; width: 0.7em; height: 0.7em; margin-left: 2px; background: #d8c494; box-shadow: inset 0 0 0 1px #8a6a44; transform: rotate(45deg) scale(0.8); }
.rm11 .card .pips i.on { background: #a8382a; box-shadow: inset 0 0 0 1px #5a1a10; }
.rm11 .card .bar { height: 7px; background: #d8c494; box-shadow: inset 0 0 0 1px #8a6a44; margin: 0.25em 0 0.55em; }
.rm11 .card .bar > div { height: 100%; background: linear-gradient(#8ad05a 0 50%, #5a9a3a 50%); }
.rm11 .card p { margin: 0.45em 0; font-size: 0.92em; line-height: 1.28; }
.rm11 .card .sp { display: flex; flex-wrap: wrap; gap: 4px; margin: 0.35em 0; }
.rm11 .card .sp img { height: 26px; image-rendering: pixelated; background: rgba(120,80,30,0.12); padding: 2px; }
.rm11 .card .finds { font-size: 0.86em; color: #5e4026; }
.rm11 .card .hand { font: 600 1.12em/1.1 ${HAND}; color: #5e3a1e; }
.rm11 .card .go { width: 100%; margin-top: 0.7em; font-size: 1.1em !important; padding: 0.4em 0.9em !important; }
.rm11 .card .why { font-size: 0.86em; color: #a8382a; margin-top: 0.45em; }
.rm11 .card .x2 { position: absolute; right: 8px; top: 8px; }
.rm11 .hint { position: absolute; left: 50%; bottom: clamp(12px, 2.2vw, 26px); transform: translateX(-50%); padding: 0.3em 0.9em; font: 600 17px ${HAND}; color: #f2e4bc; background: rgba(26,14,6,0.6); pointer-events: none; white-space: nowrap; z-index: 3; transition: opacity 0.4s; }
.rm11.busy .tools, .rm11.busy .legend, .rm11.busy .hint { opacity: 0; transition: opacity 0.3s; pointer-events: none; }
@media (max-width: 720px), (max-height: 520px) {
  .rm11 .card { left: 10px; right: 10px; top: auto; bottom: 10px; width: auto; max-height: 50%; transform: none; padding: 14px 12px 12px; }
  .rm11 .card.on { animation: rmSheet 0.28s ease-out; }
  @keyframes rmSheet { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
  .rm11 .legend { display: none; }
  .rm11 .legend.show { display: grid; left: 10px; right: auto; bottom: auto; top: 56px; font-size: 14px; }
  .rm11 .hint { display: none; }
  .rm11 .tools { left: auto; right: 10px; bottom: auto; top: 56px; }
  .rm11 .tools button { width: 42px; height: 42px; }
  .rm11 .top .pz-tab { font-size: 1.05em !important; }
  .rm11 .top .st { font-size: 0.86em; }
  .rm11 .top { left: 10px; transform: none; gap: 0.4em; }
  .rm11 .lbl { font-size: 17px; }
  .rm11 .lbl.sm { font-size: 14px; }
}
`;
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  document.head.appendChild(el('style', '', FONTS + CSS));
  try { void document.fonts?.load(`700 20px 'RM Caveat'`); void document.fonts?.load(`500 20px 'RM Caveat'`); } catch { /* no font loading API */ }
}

interface Lab { el: HTMLElement; x: number; y: number; dx: number; dy: number; min: number; max?: number; scaled?: number; rot?: number; region?: [number, number]; loc?: string; pri?: number; w?: number; h?: number; sub?: HTMLElement | null }
interface Pin { el: HTMLElement; x: number; y: number; id: string; loc: string; t: Target; small: boolean; min: number }

/** open the Region Map; resolves with the target picked for travel ('loc' or 'loc@x'; null: closed) */
export function openRegionMap(o: RegionMapOpts = {}): Promise<string | null> {
  ensureStyle();
  syncReachable();
  const ui = game.ui;
  ui.modalOpen++;
  audio.play('pageTurn', { vol: 0.55 });
  const root = el('div', 'rm11');
  const travelMode: 'camp' | 'on' | 'none' = o.travelFrom ? 'on' : o.readOnly ? 'none' : 'camp';
  root.innerHTML = `<canvas class="sh"></canvas><div class="ov"></div>
    <div class="top"><span class="pz-tab">Region Map</span><span class="st"></span></div>
    <button class="pz-x x" title="Close (Esc)"></button>
    <div class="tools"><button class="btn ghost zi" title="Zoom in (+)">+</button><button class="btn ghost zo" title="Zoom out (−)">−</button><button class="btn ghost zc" title="Where am I? (C)">◎</button><button class="btn ghost zl" title="Legend">?</button></div>
    <div class="legend"></div>
    <div class="card"></div>
    <div class="hint">Drag to pan · wheel or pinch to zoom · tap a checkpoint</div>`;
  ui.modalLayer.appendChild(root);
  requestAnimationFrame(() => root.classList.add('on'));
  // the table covers the whole screen: freeze the world behind it once it has faded in
  let covering = false;
  const coverT = window.setTimeout(() => { game.covered++; covering = true; }, 300);
  const cv = root.querySelector('canvas.sh') as HTMLCanvasElement, ov = root.querySelector('.ov') as HTMLElement;
  const card = root.querySelector('.card') as HTMLElement, st = root.querySelector('.st') as HTMLElement, leg = root.querySelector('.legend') as HTMLElement;
  const g = cv.getContext('2d')!;
  const phone = () => root.clientWidth <= 720 || root.clientHeight <= 520;
  if (phone()) leg.classList.add('off');

  // ---- header: day, clock, energy
  const cur = currentExpedition();
  const hour0 = cur ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
  const header = (h = hour0, e = energy(), to?: number) => {
    st.innerHTML = `Day ${dayNumber()} · ${clockText(h)}${to !== undefined ? ` <em>→ ${clockText(to)}</em>` : ''} · <i>Energy ${Math.round(e)}/${maxEnergy()}</i>`;
  };
  header();
  // ---- legend
  const lg = (u: string, t: string, cls = '') => `<span><img src="${u}" alt="" class="${cls}">${t}</span>`;
  const campL = location('camp')!;
  leg.innerHTML = [
    lg(badgeURL(campL), 'Camp'), lg(badgeURL(location('fernwood') ?? campL), 'Checkpoint'),
    `<span><img src="${stakeURL(true)}" alt="" style="object-fit:none;object-position:0 0;width:9px;height:15px;transform:scale(1.4)">Way on</span>`,
    `<span><b style="font-size:1.2em;color:#7a6040;width:20px;text-align:center">?</b>Heard of</span>`,
    `<span><i class="ln" style="background:repeating-linear-gradient(90deg,#c8a86a 0 6px,#6e5432 6px 8px)"></i>Trail walked</span>`,
    `<span><i class="ln" style="background:repeating-linear-gradient(90deg,#a8281e 0 3px,transparent 3px 7px)"></i>Way taken</span>`,
    `<span><img src="${MARKS_URL('artifact')}" alt="">Find</span>`, `<span><img src="${MARKS_URL('note')}" alt="">Note</span>`,
  ].join('');

  // ---- the live map
  const paper0 = new Uint32Array(W * H);
  let live: LiveMap | null = null;
  let artOn = false;
  let nowState: SeedState = currentSeedState();
  const prevShown = lastShown();

  // ---- view
  let scale = 1, ox = 0, oy = 0, vw = 1, vh = 1, dpr = 1;
  const topPad = () => (phone() ? 50 : 60);
  const fitScale = () => Math.min(vw / (W + 40), (vh - topPad() - 10) / (H + 30));
  const minScale = () => fitScale() * 0.92;
  const maxScale = 6.5;
  const clampView = () => {
    scale = clamp(scale, minScale(), maxScale);
    const mw = W * scale, mh = H * scale, m = 36;
    ox = mw + m * 2 <= vw ? (vw - mw) / 2 : clamp(ox, vw - mw - m, m);
    const t0 = topPad();
    oy = mh + m * 2 <= vh - t0 ? t0 + (vh - t0 - mh) / 2 : clamp(oy, vh - mh - m, t0 + m * 0.4);
  };
  const camAt = (mx: number, my: number, s: number) => ({ s, x: mx, y: my });
  const applyCam = (c: { s: number; x: number; y: number }) => { scale = c.s; ox = vw / 2 - c.x * scale; oy = (vh + topPad() * 0.6) / 2 - c.y * scale; clampView(); };
  const camNow = () => ({ s: scale, x: (vw / 2 - ox) / scale, y: ((vh + topPad() * 0.6) / 2 - oy) / scale });
  const fit = () => {
    vw = Math.max(1, root.clientWidth); vh = Math.max(1, root.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  };
  let tween: { a: { s: number; x: number; y: number }; b: { s: number; x: number; y: number }; t0: number; d: number; done?: () => void } | null = null;
  const tweenTo = (b: { s: number; x: number; y: number }, d: number) => new Promise<void>(res => { const old = tween; tween = { a: camNow(), b, t0: performance.now(), d, done: res }; old?.done?.(); });
  const boxCam = (x0: number, y0: number, x1: number, y1: number, lo = 1.3, hi = 3.4) => {
    const s = clamp(Math.min((vw * 0.8) / Math.max(40, x1 - x0), ((vh - topPad()) * 0.75) / Math.max(30, y1 - y0)), Math.max(minScale(), lo), hi);
    return camAt((x0 + x1) / 2, (y0 + y1) / 2, s);
  };

  // ---- here (Mori)
  const here = o.here ?? (cur ? lastPos() : { loc: 'camp', x: 1980 });
  const hereP = (() => { if (!here || !location(here.loc)) return null; const [u, v] = mapPoint(here.loc, here.x); return [u * W, v * H] as [number, number]; })();
  const from = o.travelFrom ?? null;

  // ---- the overlay: checkpoints, labels, notes
  let labs: Lab[] = [];
  let pins: Pin[] = [];
  let sel: Pin | null = null, hov: Pin | null = null;
  const hereEl = el('div', 'here', `<i style="background-image:url(${moriURL()})"></i><b>you are here</b>`);
  const walker = el('div', 'walker', `<i></i>`);
  const seenLabels = new Set<string>(prevShown?.found ?? []);
  const buildOverlay = () => {
    ov.innerHTML = '';
    labs = []; pins = [];
    const lab = (cls: string, html: string, x: number, y: number, o2: Partial<Lab> = {}) => {
      const e = el('div', cls, html);
      ov.appendChild(e);
      const l: Lab = { el: e, x, y, dx: 0, dy: 0, min: 0, ...o2 };
      labs.push(l);
      return l;
    };
    // the paper's own writing: the cartouche, the seas, the scale bar
    lab('reg title', 'Te Whenua Huna', 520, 600, { scaled: 26 });
    lab('reg tiny', `the hidden land · surveyed by Mori, day ${dayNumber()}`, 520, 612, { scaled: 10 });
    lab('reg sea', 'TE MOANA NUI', 560, 26, { scaled: 15 });
    lab('reg sea', 'TE MOANA NUI', 90, 600, { scaled: 13, rot: -4 });
    lab('reg tiny', '4 hours on foot', 728, 595, { scaled: 9 });
    lab('reg tiny', 'from Joshu’s old chart', 880, 616, { scaled: 8 });
    for (const r of REGION_NAMES) lab('reg', esc(r.text), r.at[0], r.at[1], { scaled: r.size, rot: r.rot, region: r.at });
    // places
    let shore = 0;
    const jn = junctions();
    for (const L of LOCATIONS) {
      const [x, y] = [L.pos[0] * W, L.pos[1] * H];
      if (isFound(L.id)) {
        const isle = isIsland(L) && L.id !== 'camp';
        const up = isle && shore++ % 2 === 0;
        const isNew = !seenLabels.has(L.id) && !!prevShown;
        const t: Target = { loc: L.id };
        const reach = canTravel(t);
        const e = el('div', `cp${isle ? ' small' : ''}${reach ? '' : ' dim'}${isNew ? ' drop' : ''}`, `<i style="background-image:url(${badgeURL(L)})"></i>`);
        ov.appendChild(e);
        pins.push({ el: e, x, y, id: targetId(t), loc: L.id, t, small: isle, min: isle ? 1.45 : 0 });
        const nm = `${esc(L.name)}${L.sub && !isle ? `<small>${esc(L.sub)}</small>` : ''}`;
        const fs = isle ? 16 : 19;
        const l = lab(`lbl${isle ? ' sm' : ''}${isNew ? ' new' : ''}`, nm, x, y, { dy: up ? -60 : 3, min: isle ? 2.1 : 0.9, loc: L.id, pri: L.id === 'camp' ? 0 : isle ? 2 : 1, w: L.name.length * fs * 0.42 + 6, h: fs * 1.05 });
        l.sub = l.el.querySelector('small');
      } else if (isRumoured(L.id)) {
        lab('lbl q', L.secret ? '???' : `${esc(L.name)}?`, x, y, { dy: -10, loc: L.id, min: 0.9, pri: 3, w: (L.secret ? 3 : L.name.length + 1) * 8 + 6, h: 20 });
        const e = el('div', 'cp dim', '');
        pins.push({ el: e, x, y, id: L.id, loc: L.id, t: { loc: L.id }, small: true, min: 99 });
      }
    }
    // ways on: little flagged stakes where a route leaves a scene
    for (const j of jn) {
      const [u, v] = mapPoint(j.from, j.route.at);
      const x = u * W, y = v * H;
      const t: Target = { loc: j.from, at: j.route.at };
      const e = el('div', `jn`, `<i style="background-image:url(${stakeURL(j.known)})"></i>${j.known ? '' : '<b>?</b>'}`);
      ov.appendChild(e);
      pins.push({ el: e, x, y, id: targetId(t), loc: j.from, t, small: true, min: 1.7 });
    }
    // notes pinned to the paper, find notes pencilled in
    for (const n of mapNotes()) { const [u, v] = mapPoint(n.loc, n.x); lab('note', esc(n.text), u * W + 12, v * H - 16, { min: 2.1, rot: (hash2(n.x, n.text.length, 3) - 0.5) * 6 }); }
    for (const s of spots()) if (s.d.note && s.d.kind !== 'species') lab('note pencil', esc(s.d.note), s.x + 6, s.y + 4, { min: 3 });
    if (hereP) ov.appendChild(hereEl);
    ov.appendChild(walker);
    walker.style.display = 'none';
    // place names are culled where they would overlap: the camp first, then the places, then the beach
    labs.sort((a, b) => (a.pri ?? -1) - (b.pri ?? -1));
    overlayDirty = true;
  };
  const place = () => {
    const u = unrollX();
    const taken: [number, number, number, number][] = [];
    const showSub = scale >= 1.9;
    for (const l of labs) {
      const sx = ox + l.x * scale + l.dx, sy = oy + l.y * scale + l.dy;
      let vis = scale >= l.min && (l.max === undefined || scale <= l.max) && sx > -300 && sx < vw + 300 && sy > -80 && sy < vh + 80 && sx < u + 40;
      if (vis && l.region && live) vis = live.stateAt(l.region[0], l.region[1]) === 3;
      if (vis && l.pri !== undefined && l.w && l.h) {
        const hh = l.h * (l.sub && showSub ? 1.8 : 1);
        const b: [number, number, number, number] = [sx - l.w / 2, sy, sx + l.w / 2, sy + hh];
        if (taken.some(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1])) vis = false;
        else taken.push(b);
      }
      if (l.sub) { const d = showSub ? '' : 'none'; if (l.sub.style.display !== d) l.sub.style.display = d; }
      l.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      if (l.scaled) {
        const fs = Math.max(8, l.scaled * scale * (l.region ? 0.4 : 0.5));
        l.el.style.fontSize = fs.toFixed(1) + 'px';
        l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) rotate(${l.rot ?? 0}deg)`;
      } else l.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translateX(-50%)${l.rot ? ` rotate(${l.rot}deg)` : ''}`;
      l.el.classList.toggle('sel', !!l.loc && !!sel && sel.loc === l.loc && sel.t.at === undefined);
    }
    for (const p of pins) {
      const sx = ox + p.x * scale, sy = oy + p.y * scale;
      const vis = scale >= p.min && sx > -60 && sx < vw + 60 && sy > -60 && sy < vh + 80 && sx < u;
      p.el.style.display = vis ? '' : 'none';
      if (vis) p.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
      p.el.classList.toggle('sel', p === sel);
      p.el.classList.toggle('hov', p === hov && p !== sel);
    }
    if (hereP) {
      const sx = ox + hereP[0] * scale, sy = oy + hereP[1] * scale;
      hereEl.style.display = sx < u && !trip ? '' : 'none';
      hereEl.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
    }
    if (trip && trip.walkerP) { walker.style.display = ''; walker.style.transform = `translate(${Math.round(ox + trip.walkerP[0] * scale)}px, ${Math.round(oy + trip.walkerP[1] * scale)}px)`; }
  };

  // ---- travel rules
  function canTravel(t: Target): boolean {
    if (travelMode === 'none') return false;
    const L = location(t.loc);
    if (!L || !isFound(L.id)) return false;
    if (travelMode === 'on' && L.trip) return false;
    return !!tripTo(t, travelMode === 'on' ? from : null) || (travelMode === 'on' && t.loc === 'camp');
  }

  // ---- the frame loop
  let raf = 0, last = performance.now(), renderAcc = 1, dirty = true, placeSig = '', overlayDirty = true;
  const perf = { n: 0, live: 0, present: 0, maxLive: 0, maxPresent: 0 };
  (window as unknown as { __rmPerf?: unknown }).__rmPerf = perf;
  const openAt = performance.now();
  let closing: { at: number; done: () => void } | null = null;
  const OPEN_RISE = 0.28, OPEN_UNROLL = 0.85;
  let paperAt = 0;
  let unroll = 0, rollY = 1;
  const unrollX = () => ox + W * scale * unroll;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // opening: the roll rises from below, then unrolls left to right
    if (!closing) {
      const openT = (now - openAt) / 1000;
      rollY = 1 - easeO(clamp(openT / OPEN_RISE));
      // the unroll starts once the roll is up and the parchment is ready (it waits, bobbing a little)
      if (paperAt) { const u0 = Math.max(openAt + OPEN_RISE * 1000, paperAt); unroll = easeIO(clamp((now - u0) / 1000 / OPEN_UNROLL)); }
      else { unroll = 0; if (openT > OPEN_RISE) rollY = 0.012 * Math.sin(now / 140); }
    } else {
      const t = (now - closing.at) / 1000;
      unroll = 1 - easeIO(clamp((t - 0.05) / 0.5));
      rollY = easeO(clamp((t - 0.58) / 0.26));
      if (t > 0.9) { const d = closing.done; closing.done = () => {}; d(); }
    }
    if (tween) {
      const tk = clamp((now - tween.t0) / 1000 / tween.d);
      const k = easeIO(tk);
      const a = tween.a, b = tween.b;
      const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k);
      applyCam({ s, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      if (tk >= 1) { const d = tween.done; tween = null; d?.(); }
      dirty = true;
    }
    if (trip) stepTrip(dt);
    const tp0 = performance.now();
    if (live) {
      live.update(dt);
      renderAcc += dt;
      if (renderAcc >= 1 / 30) {
        renderAcc = 0;
        const m = 4;
        live.render(-ox / scale - m, -oy / scale - m, (vw - ox) / scale + m, (vh - oy) / scale + m);
        dirty = true;
      }
    }
    const tp1 = performance.now();
    if (dirty || unroll < 1 || closing) { present(); dirty = false; }
    const sig = `${scale.toFixed(4)},${ox.toFixed(1)},${oy.toFixed(1)},${unroll.toFixed(3)},${rollY.toFixed(3)},${trip?.walkerP?.[0].toFixed(1) ?? ''},${trip?.walkerP?.[1].toFixed(1) ?? ''},${sel?.id ?? ''},${hov?.id ?? ''}`;
    if (sig !== placeSig || overlayDirty) { placeSig = sig; overlayDirty = false; place(); }
    const tp2 = performance.now();
    perf.n++; perf.live += tp1 - tp0; perf.present += tp2 - tp1; perf.maxLive = Math.max(perf.maxLive, tp1 - tp0); perf.maxPresent = Math.max(perf.maxPresent, tp2 - tp1);
  };

  const present = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const sw = W * scale, sh = H * scale;
    const ux = ox + sw * unroll;
    const lift = rollY * (vh + 80);
    if (unroll > 0.001) {
      // the sheet's shadow on the table
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = `rgba(10,5,2,${0.12 - k * 0.025})`;
        g.fillRect(ox + 4 - k * 2 + 6, oy + lift + 6 - k * 2 + 6, ux - ox + k * 4 - 6, sh + k * 4);
      }
      g.save();
      g.beginPath(); g.rect(0, 0, ux, vh); g.clip();
      g.imageSmoothingEnabled = scale * dpr < 0.98;
      const view = live?.view;
      if (view) {
        // only the visible part of the map
        const x0 = clamp(Math.floor(-ox / scale), 0, W), y0 = clamp(Math.floor((-oy - lift) / scale), 0, H);
        const x1 = clamp(Math.ceil((vw - ox) / scale) + 1, 0, W), y1 = clamp(Math.ceil((vh - oy - lift) / scale) + 1, 0, H);
        if (x1 > x0 && y1 > y0) g.drawImage(view, x0, y0, x1 - x0, y1 - y0, ox + x0 * scale, oy + lift + y0 * scale, (x1 - x0) * scale, (y1 - y0) * scale);
      }
      // routes in ink: the preview of the selected trip, then the one being travelled
      drawRoutes(lift);
      g.restore();
    }
    if (unroll < 0.999) drawRoll(ux, lift);
    const ot = lift ? `translateY(${lift.toFixed(1)}px)` : '', oo = unroll > 0.98 ? '1' : '0';
    if (ov.style.transform !== ot) ov.style.transform = ot;
    if (ov.style.opacity !== oo) ov.style.opacity = oo;
  };

  /** the rolled-up part of the sheet: a paper cylinder at the unrolling edge */
  const drawRoll = (ux: number, lift: number) => {
    const sh = H * scale;
    const d = clamp(sh * 0.085, 16, 52) * (1 - unroll * 0.55);
    const x = ux - d * 0.25, y0 = oy + lift - d * 0.12, y1 = oy + lift + sh + d * 0.12;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // its shadow on the sheet and the table
    const shg = g.createLinearGradient(x - 18, 0, x + d + 10, 0);
    shg.addColorStop(0, 'rgba(0,0,0,0)'); shg.addColorStop(0.35, 'rgba(10,5,2,0.28)'); shg.addColorStop(1, 'rgba(10,5,2,0)');
    g.fillStyle = shg;
    g.fillRect(x - 18, y0 + 8, d + 28, y1 - y0);
    const cg = g.createLinearGradient(x, 0, x + d, 0);
    cg.addColorStop(0, '#5a3e20'); cg.addColorStop(0.1, '#9c7c4c'); cg.addColorStop(0.3, '#e2cc9a'); cg.addColorStop(0.48, '#f6e6bc'); cg.addColorStop(0.7, '#d4b884'); cg.addColorStop(0.9, '#8a6a3e'); cg.addColorStop(1, '#4a3018');
    g.fillStyle = cg;
    g.fillRect(x, y0, d, y1 - y0);
    // paper layers wound on the roll
    g.fillStyle = 'rgba(90,60,28,0.18)';
    for (let k = 1; k < 4; k++) g.fillRect(x + d * (0.12 + k * 0.05), y0, 1, y1 - y0);
    // end caps showing the spiral
    for (const yy of [y0, y1]) {
      g.fillStyle = '#c8a874';
      g.beginPath(); g.ellipse(x + d / 2, yy, d / 2, d * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(74,48,24,0.7)'; g.lineWidth = 1;
      for (let r = 0.9; r > 0.15; r -= 0.2) { g.beginPath(); g.ellipse(x + d / 2 + (0.9 - r) * 2, yy, (d / 2) * r, d * 0.2 * r, 0, 0, Math.PI * 2); g.stroke(); }
    }
  };

  // ---- routes drawn in ink (screen space): a pencil preview, the trip being travelled in red
  type Pt = [number, number];
  let preview: Pt[] | null = null;
  interface Trip { pts: Pt[]; len: number; seg: number[]; prog: number; sea: boolean; walkerP: Pt | null; t: number; t0: number; dur: number; h0: number; h1: number; e0: number; e1: number; stepT: number; done: () => void; target: Pin | null }
  let trip: Trip | null = null;
  const polyLen = (pts: Pt[]) => { const seg = [0]; for (let k = 1; k < pts.length; k++) seg.push(seg[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return seg; };
  const pointAt = (pts: Pt[], seg: number[], d: number): Pt => {
    for (let k = 1; k < pts.length; k++) if (d <= seg[k]) { const t = (d - seg[k - 1]) / Math.max(1e-6, seg[k] - seg[k - 1]); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]; }
    return pts[pts.length - 1];
  };
  const drawDots = (pts: Pt[], upto: number, col: string, r: number, gap: number, lift: number) => {
    const seg = polyLen(pts);
    const total = Math.min(upto, seg[seg.length - 1]);
    g.fillStyle = col;
    const step = gap / scale;
    for (let d = 0; d <= total; d += step) {
      const [x, y] = pointAt(pts, seg, d);
      g.beginPath(); g.arc(ox + x * scale, oy + lift + y * scale, r, 0, Math.PI * 2); g.fill();
    }
  };
  const drawRoutes = (lift: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (preview && !trip) drawDots(preview, 1e9, 'rgba(90,60,30,0.55)', 1.6, 7, lift);
    if (trip) {
      drawDots(trip.pts, trip.len * trip.prog, trip.sea ? 'rgba(30,80,120,0.9)' : 'rgba(150,32,22,0.92)', 2.3, 8, lift);
      // the destination ringed in red ink when the line arrives
      if (trip.prog >= 1) {
        const [x, y] = trip.pts[trip.pts.length - 1];
        g.strokeStyle = 'rgba(150,32,22,0.9)'; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(ox + x * scale, oy + lift + y * scale, 15, 10, -0.2, 0, Math.PI * 2 * clamp(trip.t / 0.3)); g.stroke();
      }
    }
  };
  const stepTrip = (dt: number) => {
    const tr = trip!;
    tr.t = Math.max(tr.t, (performance.now() - tr.t0) / 1000);
    const k = clamp(tr.t / tr.dur);
    tr.prog = easeIO(k);
    tr.walkerP = pointAt(tr.pts, tr.seg, tr.len * tr.prog);
    header(tr.h0 + (tr.h1 - tr.h0) * k, tr.e0 + (tr.e1 - tr.e0) * k, tr.h1);
    tr.stepT -= dt;
    if (k < 1 && tr.stepT <= 0) { tr.stepT = tr.sea ? 0.7 : 0.3; audio.play(tr.sea ? 'splash' : 'stepSoft', { vol: tr.sea ? 0.08 : 0.14, pitch: 0.9 + Math.random() * 0.25 }); }
    dirty = true;
    if (k >= 1 && tr.t >= tr.dur + 0.55) { const d = tr.done; tr.done = () => {}; d(); }
  };

  // ---- the card
  const showCard = (p: Pin | null) => {
    sel = p;
    preview = null;
    if (!p) { card.classList.remove('on'); dirty = true; return; }
    const L = location(p.loc);
    if (!L) return;
    const found = isFound(L.id), rum = isRumoured(L.id);
    const isJn = p.t.at !== undefined;
    const name = found || !L.secret ? L.name : '???';
    let html = `<button class="pz-x x2" title="Close"></button>`;
    if (isJn) {
      const j = junctions().find(q => q.from === p.loc && Math.round(q.route.at) === Math.round(p.t.at!));
      const T = j ? location(j.to) : null;
      html += `<h3>A way on</h3><div class="sub">${esc(L.name)} · ${j ? ROUTE_WORD[j.route.kind] : 'a trail'}</div>`;
      if (j) html += `<p class="hand">“${esc(j.route.label)}”</p><div class="row"><span>Leads to</span><b>${T && isFound(T.id) ? esc(T.name) : 'somewhere unknown'}</b></div><div class="row"><span>The way itself</span><b>${fmtH(j.route.hours)} · −${j.route.energy} energy</b></div>`;
      if (j?.route.needs) html += `<div class="row"><span>Needs</span><b>${j.route.needs.n} × ${esc(j.route.needs.item)}</b></div>`;
      html += `<p class="finds">A checkpoint: travel here and Mori starts at the foot of the way on.</p>`;
    } else {
      html += `<h3>${esc(name)}</h3><div class="sub">${found && L.sub ? esc(L.sub) + ' · ' : ''}${REGION_NAME[L.region] ?? L.region} · ${KIND_NAME[L.kind] ?? L.kind}</div>`;
      if (!found) {
        html += `<p>${rum ? (L.secret ? 'Something is out there. Aroha won’t say its name.' : 'Heard of, never seen. ' + esc(L.desc)) : 'Unexplored.'}</p><p class="finds">Find the way there on foot: it lies beyond somewhere you have already been.</p>`;
      } else {
        const ds = discoveriesAt(L.id);
        const sp = [...new Set(ds.filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
        const fc = ds.filter(d => d.kind !== 'species' && d.kind !== 'location').length;
        const ex = Math.round(explored(L.id) * 100);
        html += `<div class="row"><span>Difficulty</span><span class="pips">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= L.difficulty ? 'on' : ''}"></i>`).join('')}</span></div>`;
        if (L.terrain) html += `<div class="row"><span>Terrain</span><b>${esc(L.terrain)}</b></div>`;
        html += `<div class="row"><span>Explored</span><b>${ex}%</b></div><div class="bar"><div style="width:${ex}%"></div></div><p>${esc(L.desc)}</p>`;
        if (sp.length) html += `<div class="sp">${sp.slice(0, 12).map(s => `<img src="${speciesSprite(s)}" alt="" title="${esc(SPECIES_BY_ID[s]?.name ?? s)}">`).join('')}</div>`;
        html += `<div class="finds">${sp.length} species sketched here · ${fc} find${fc === 1 ? '' : 's'} noted</div>`;
        const ways = LOCATIONS.filter(t => t.routes?.some(r => r.from === L.id));
        if (ways.length) html += `<div class="finds">Ways on: ${ways.map(t => (isFound(t.id) ? esc(t.name) : '???') + ` (${ROUTE_WORD[t.routes!.find(r => r.from === L.id)!.kind]})`).join(', ')}</div>`;
      }
    }
    // the trip
    const herePlace = travelMode === 'on' ? from?.loc : 'camp';
    if (found || isJn) {
      if (!isJn && L.id === 'camp' && travelMode !== 'on') html += `<p class="finds">Home. Expeditions leave from the trailhead signpost.</p>`;
      else if (!isJn && herePlace === L.id && travelMode === 'on') html += `<div class="why" style="color:#2f6b2a">You are here.</div>`;
      else if (travelMode === 'none') html += `<div class="why">Fast travel starts from camp.</div>`;
      else if (travelMode === 'on' && L.trip) html += `<div class="why">The Kitten sails from camp.</div>`;
      else {
        const c: TripCost | null = travelMode === 'on' && L.id === 'camp' && !isJn ? homeCost(from!.loc, from!.x) : tripTo(p.t, travelMode === 'on' ? from : null);
        if (c) {
          const homeTrip = travelMode === 'on' && L.id === 'camp';
          if (!homeTrip && !isJn && travelMode === 'camp') { const hc = homeCost(L.id); html += `<div class="row"><span>${L.trip ? 'By boat' : 'From camp'}</span><b>${fmtH(c.hours)} · −${c.energy} energy</b></div><div class="row"><span>${L.trip ? 'Sail home' : 'Walk home'}</span><b>${fmtH(hc.hours)} · −${hc.energy} energy</b></div>`; }
          else html += `<div class="row"><span>${homeTrip ? 'Walk home' : 'From here'}</span><b>${fmtH(c.hours)} · −${c.energy} energy</b></div>`;
          const need = homeTrip ? 0 : tripNeed(c);
          const ok = energy() >= need;
          const arrive = arrivalHour(c.hours);
          html += `<button class="btn go"${ok ? '' : ' disabled'}>${homeTrip ? 'Head home' : 'Set off'} · arrive ${clockText(arrive)}</button>${ok ? '' : `<div class="why">Too tired: you need ${need} energy for this trip.</div>`}`;
          const rp = routePath(p.t, travelMode === 'on' ? from : null, SEA_LANES);
          preview = rp?.pts ?? null;
        } else html += `<div class="why">No known trail from here.</div>`;
      }
    }
    card.innerHTML = html;
    card.classList.add('on');
    card.querySelector('.x2')?.addEventListener('pointerdown', e => { e.stopPropagation(); showCard(null); });
    card.querySelector('.go')?.addEventListener('pointerdown', e => { e.stopPropagation(); void setOff(p); });
    card.addEventListener('pointerdown', e => e.stopPropagation());
    audio.play('ui', { vol: 0.35 });
    dirty = true;
  };

  // ---- setting off: ink the route, walk the marker along it, the clock runs; then roll up
  let leaving = false;
  const setOff = async (p: Pin) => {
    if (leaving || trip) return;
    const L = location(p.loc);
    if (!L) return;
    const homeTrip = travelMode === 'on' && L.id === 'camp' && p.t.at === undefined;
    const c = homeTrip ? homeCost(from!.loc, from!.x) : tripTo(p.t, travelMode === 'on' ? from : null);
    if (!c) return;
    if (!homeTrip && energy() < tripNeed(c)) return;
    leaving = true;
    audio.play('uiOpen');
    card.classList.remove('on');
    root.classList.add('busy');
    const rp = homeTrip
      ? routePath({ loc: 'camp' }, from, SEA_LANES)
      : routePath(p.t, travelMode === 'on' ? from : null, SEA_LANES);
    const pts = rp?.pts ?? [hereP ?? [L.pos[0] * W, L.pos[1] * H], [L.pos[0] * W, L.pos[1] * H]];
    preview = null;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    live?.finishReveal();
    await tweenTo(boxCam(x0 - 30, y0 - 40, x1 + 30, y1 + 30, 1.1, 3), 0.55);
    const seg = polyLen(pts);
    const sea = !!rp?.sea;
    walker.className = 'walker' + (sea ? ' boat' : '');
    (walker.firstElementChild as HTMLElement).style.backgroundImage = `url(${moriURL(sea)})`;
    const h0 = travelMode === 'on' ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
    await new Promise<void>(res => {
      trip = { pts, len: seg[seg.length - 1], seg, prog: 0, sea, walkerP: pts[0], t: 0, t0: performance.now(), dur: clamp(1.3 + c.hours * 0.55, 1.6, 4.4), h0, h1: h0 + c.hours, e0: energy(), e1: energy() - c.energy, stepT: 0, done: res, target: p };
    });
    audio.play('place', { vol: 0.6 });
    p.el.classList.remove('stamp'); void p.el.offsetWidth; p.el.classList.add('stamp');
    await sleep(380);
    finish(homeTrip ? 'camp' : p.id);
  };

  // ---- input: drag, pinch, wheel, tap, hover
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; ox: number; oy: number } | null = null;
  let pinch: { d: number; s: number; mx: number; my: number } | null = null;
  const local = (e: PointerEvent | WheelEvent) => { const r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const zoomAt = (sx: number, sy: number, k: number) => {
    const mx = (sx - ox) / scale, my = (sy - oy) / scale;
    scale = clamp(scale * k, minScale(), maxScale);
    ox = sx - mx * scale; oy = sy - my * scale;
    clampView(); dirty = true;
  };
  const hit = (sx: number, sy: number): Pin | null => {
    let best: Pin | null = null, bd = phone() ? 30 : 24;
    for (const p of pins) {
      if (scale < p.min || p.el.style.display === 'none') continue;
      const px = ox + p.x * scale, py = oy + p.y * scale - (p.small ? 16 : 24);
      const d = Math.hypot(px - sx, py - sy) * (p.t.at !== undefined ? 1.15 : 1);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const busy = () => leaving || !!trip || !!closing || unroll < 0.98;
  root.addEventListener('pointerdown', e => {
    if (busy()) { if (live?.revealing) live.finishReveal(); return; }
    root.setPointerCapture(e.pointerId);
    const p = local(e);
    pts.set(e.pointerId, p);
    tween = null;
    if (pts.size === 1) down = { ...p, t: performance.now(), ox, oy };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, mx: ((a.x + b.x) / 2 - ox) / scale, my: ((a.y + b.y) / 2 - oy) / scale };
      down = null;
    }
  });
  root.addEventListener('pointermove', e => {
    const p = local(e);
    if (!pts.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !busy()) { const h = hit(p.x, p.y); if (h !== hov) { hov = h; root.style.cursor = h ? 'pointer' : ''; dirty = true; } }
      return;
    }
    pts.set(e.pointerId, p);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      scale = clamp(pinch.s * (d / Math.max(1, pinch.d)), minScale(), maxScale);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      ox = cx - pinch.mx * scale; oy = cy - pinch.my * scale;
      clampView(); dirty = true;
    } else if (down) {
      if (Math.hypot(p.x - down.x, p.y - down.y) > 6) root.classList.add('drag');
      ox = down.ox + p.x - down.x; oy = down.oy + p.y - down.y;
      clampView(); dirty = true;
    }
  });
  const up = (e: PointerEvent) => {
    const p = local(e);
    if (down && pts.size === 1 && Math.hypot(p.x - down.x, p.y - down.y) < 8 && performance.now() - down.t < 500) {
      const h = hit(p.x, p.y);
      if (h && h === sel && canTravel(h.t) && e.pointerType !== 'mouse') { /* a second tap keeps the card */ }
      showCard(h);
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) { down = null; root.classList.remove('drag'); }
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('wheel', e => { e.preventDefault(); if (busy()) return; tween = null; const p = local(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
  const tool = (sel2: string, fn: () => void) => root.querySelector(sel2)!.addEventListener('pointerdown', e => { e.stopPropagation(); if (!busy()) fn(); });
  tool('.zi', () => void tweenTo({ ...camNow(), s: clamp(scale * 1.45, minScale(), maxScale) }, 0.25));
  tool('.zo', () => void tweenTo({ ...camNow(), s: clamp(scale / 1.45, minScale(), maxScale) }, 0.25));
  tool('.zc', () => { const c = hereP ?? [campL.pos[0] * W, campL.pos[1] * H]; void tweenTo(camAt(c[0], c[1], Math.max(scale, 2.4)), 0.45); });
  tool('.zl', () => { if (phone()) { leg.classList.toggle('show'); leg.classList.remove('off'); } else leg.classList.toggle('off'); });

  // ---- open / close
  let done: (v: string | null) => void = () => {};
  const result = new Promise<string | null>(r => (done = r));
  let finished = false;
  const finish = (v: string | null) => {
    if (finished) return;
    finished = true;
    window.removeEventListener('keydown', kh, true);
    window.removeEventListener('resize', rs);
    off();
    if (live && nowState) markShown(nowState);
    card.classList.remove('on');
    root.classList.add('busy');
    audio.play(v === null ? 'uiBack' : 'rustle', { vol: 0.5 });
    // zoom out a little, roll the sheet up, put it away
    tween = null;
    const fitCam = camAt(W / 2, H / 2, fitScale());
    void tweenTo(scale > fitScale() * 1.6 ? { s: Math.max(fitScale(), scale * 0.55), x: camNow().x, y: camNow().y } : fitCam, 0.3).then(() => {
      audio.play('pageTurn', { vol: 0.45 });
      closing = { at: performance.now(), done: () => {
        cancelAnimationFrame(raf);
        clearTimeout(coverT);
        if (covering) { game.covered = Math.max(0, game.covered - 1); covering = false; }
        root.classList.remove('on');
        setTimeout(() => root.remove(), 260);
        ui.modalOpen = Math.max(0, ui.modalOpen - 1);
        guardInput(300);
        done(v);
      } };
    });
  };
  const kh = (e: KeyboardEvent) => {
    const k = e.code;
    if (k === 'Escape' || k === 'KeyM' || k === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (trip || leaving) { if (trip) trip.t = Math.max(trip.t, trip.dur); return; }
      if (live?.revealing) { live.finishReveal(); return; }
      if (sel && k === 'Escape') showCard(null); else finish(null);
      return;
    }
    if (busy()) return;
    const step = 70;
    if (k === 'ArrowLeft' || k === 'KeyA') ox += step; else if (k === 'ArrowRight' || k === 'KeyD') ox -= step;
    else if (k === 'ArrowUp' || k === 'KeyW') oy += step; else if (k === 'ArrowDown' || k === 'KeyS') oy -= step;
    else if (k === 'Equal' || k === 'NumpadAdd') { zoomAt(vw / 2, vh / 2, 1.25); return; }
    else if (k === 'Minus' || k === 'NumpadSubtract') { zoomAt(vw / 2, vh / 2, 1 / 1.25); return; }
    else if (k === 'KeyC') { const c = hereP ?? [campL.pos[0] * W, campL.pos[1] * H]; void tweenTo(camAt(c[0], c[1], Math.max(scale, 2.4)), 0.45); return; }
    else if (k === 'Enter' && sel) { if (card.querySelector('.go:not([disabled])')) void setOff(sel); return; }
    else return;
    e.preventDefault(); e.stopPropagation(); tween = null; clampView(); dirty = true;
  };
  window.addEventListener('keydown', kh, true);
  const rs = () => { const c = camNow(); fit(); applyCam(c); dirty = true; };
  window.addEventListener('resize', rs);
  root.querySelector('.x')!.addEventListener('pointerdown', e => { e.stopPropagation(); if (!leaving) finish(null); });
  let changeT = 0;
  const off = onMapChange(() => { if (changeT) return; changeT = window.setTimeout(() => { changeT = 0; refresh(); }, 120); });

  // ---- what the map shows
  const refreshTrails = () => {
    if (!live) return;
    const ways: { pts: [number, number][]; kind: string }[] = [];
    for (const k of nowState.routes) { const [a, b] = k.split('>'); const e = routeEnds(a, b); if (e) ways.push({ pts: [e[0], e[1]], kind: e[2] }); }
    const lanes: [number, number][][] = [];
    for (const L of LOCATIONS) if (L.trip && isFound(L.id) && SEA_LANES[L.id]) lanes.push(SEA_LANES[L.id]);
    live.setTrails(walkedTrails(), ways, lanes);
    const sk: { s: PixelBuffer; x: number; y: number }[] = [], mk: { kind: string; x: number; y: number }[] = [];
    for (const s of spots()) {
      if (s.d.kind === 'species' && s.d.icon) {
        const ic = inked.get(s.d.icon);
        if (ic) { sk.push({ s: sketchCard(ic), x: s.x, y: s.y }); continue; }
        if (!inked.has(s.d.icon)) void inkSpecies(s.d.icon).then(() => { if (!finished) refreshTrails(); });
        continue;
      }
      mk.push({ kind: s.d.kind, x: s.x, y: s.y });
    }
    for (const n of mapNotes()) { const [u, v] = mapPoint(n.loc, n.x); mk.push({ kind: 'note', x: u * W + 6, y: v * H - 6 }); }
    live.setMarks(sk, mk);
  };
  const refresh = () => {
    if (!live) return;
    const was = nowState;
    nowState = currentSeedState();
    if (artOn) live.setExplored(nowState, was, true);
    refreshTrails();
    buildOverlay();
    dirty = true;
  };

  // ---- debug hooks (screenshots, tests)
  (window as unknown as { __rm?: unknown }).__rm = {
    cam: (x: number, y: number, s: number) => { tween = null; applyCam(camAt(x, y, s)); dirty = true; },
    skip: () => live?.finishReveal(),
    all: () => { live?.revealEverything(); overlayDirty = true; dirty = true; },
    view: () => ({ scale, ox, oy, vw, vh }),
    pick: (id: string) => { const p = pins.find(q => q.id === id); if (p) showCard(p); return !!p; },
    go: () => { if (sel) void setOff(sel); },
  };

  // ---- first frame: the parchment (quick), then the painted map (in slices, while it unrolls)
  fit();
  applyCam(camAt(W / 2, H / 2, fitScale()));
  buildOverlay();
  raf = requestAnimationFrame(frame);
  void paintPaper().then(p => {
    if (finished) return;
    paper0.set(p);
    paperAt = performance.now();
    live = new LiveMap(paper0);
    refreshTrails();
    dirty = true;
    return paintMap();
  }).then(art => {
    if (finished || !art || !live) return;
    live.setArt(art);
    artOn = true;
    live.setExplored(nowState, prevShown, true);
    refreshTrails();
    // once unrolled: swoop to where Mori is, or to what is being inked in
    const go = async () => {
      while (unroll < 0.995 && !finished) await sleep(30);
      if (finished) return;
      const rb = live?.revealBox;
      const focus = o.focus ? location(o.focus) : null;
      let c = hereP ? camAt(hereP[0], hereP[1], phone() ? 1.7 : 2.3) : camAt(W / 2, H / 2, fitScale());
      if (focus) c = camAt(focus.pos[0] * W, focus.pos[1] * H, 2.3);
      else if (rb) c = boxCam(rb[0] - 20, rb[1] - 20, rb[2] + 20, rb[3] + 20, 1.4, 3);
      await tweenTo(c, 0.8);
      if (live?.revealing) audio.play('rustle', { vol: 0.25 });
      if (focus) { const p = pins.find(q => q.loc === focus.id && q.t.at === undefined); if (p) showCard(p); }
      markShown(nowState);
    };
    void go();
    setTimeout(() => { const h = root.querySelector('.hint') as HTMLElement | null; if (h) h.style.opacity = '0'; }, 6000);
    // the species sketches load in the background
    const ids = [...new Set(discoveries().filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
    void Promise.all(ids.map(inkSpecies)).then(() => { if (!finished) { refreshTrails(); dirty = true; } });
  }).catch(e => console.warn('[regionmap]', e));
  return result;
}

const MARKS_URL = (k: string) => {
  const key = 'mk:' + k;
  let u = urlCache.get(key);
  if (u === undefined) { const b = MARKS[k]; u = b ? b.toDataURL(3) : ''; urlCache.set(key, u); }
  return u;
};
