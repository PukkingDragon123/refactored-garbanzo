// Tiny painted pixel glyphs for the laptops (MoriOS and FieldOS): ticks, crosses, stars, hearts, arrows,
// the lock, the RP gem, the power button, the battery and so on. The game never shows emoji or
// unicode symbol glyphs; these replace them inline (as <img> data URLs, painted once and cached).
// Each glyph is a little bitmap: '#' the main colour, 'h' its highlight, 'd' its shade, 's' a second
// colour; an optional 1px outline goes round the whole shape.

import { canvas, outline } from './aeroFx';

interface Def { rows: string[]; col: string; s?: string; edge?: string | null }

const DEFS: Record<string, Def> = {
  check: { col: '#3aa822', edge: '#ffffff', rows: [
    '......##', '.....##.', '#h..##..', '##h##...', '.###....', '..#.....'] },
  cross: { col: '#e0402a', edge: '#ffffff', rows: [
    'hh...hh', '.##.##.', '..###..', '..###..', '.##.##.', '##...##'] },
  star: { col: '#f0ae22', edge: '#8a5a08', rows: [
    '....#....', '...h##...', '...h##...', 'hhhh#####', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'] },
  star0: { col: '#c4d2de', edge: '#7a90a4', rows: [
    '....#....', '...###...', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'] },
  heart: { col: '#f0508a', edge: '#ffffff', rows: [
    '.##.##.', '#hh####', '#h#####', '.#####.', '..###..', '...#...'] },
  play: { col: '#ffffff', edge: null, rows: ['#....', '##...', '###..', '####.', '###..', '##...', '#....'] },
  back: { col: '#ffffff', edge: null, rows: ['....#', '...##', '..###', '.####', '..###', '...##', '....#'] },
  crumb: { col: '#3a5a78', edge: null, rows: ['#..', '##.', '###', '##.', '#..'] },
  up: { col: '#ffffff', edge: null, rows: ['...#...', '..###..', '.#####.', '#######'] },
  down: { col: '#ffe27a', edge: null, rows: ['#######', '.#####.', '..###..', '...#...'] },
  ff: { col: '#ffffff', edge: null, rows: ['#...#....', '##..##...', '###.###..', '########.', '###.###..', '##..##...', '#...#....'] },
  power: { col: '#ffffff', edge: null, rows: ['...#...', '.#.#.#.', '#..#..#', '#.....#', '#.....#', '.#...#.', '..###..'] },
  lock: { col: '#f0ae22', s: '#a9b8c6', edge: '#4a3a1a', rows: [
    '..sss..', '.s...s.', '.s...s.', 'hhhhhhh', '###d###', '###d###', '#######'] },
  spark: { col: '#f0ae22', edge: null, rows: ['...#...', '...#...', '..#h#..', '##hhh##', '..#h#..', '...#...', '...#...'] },
  gem: { col: '#22b4e2', edge: '#0a4a78', rows: ['.hhhhh.', 'hh###dd', '.h###d.', '..h#d..', '...d...'] },
  gem0: { col: '#c4d2de', edge: '#7a90a4', rows: ['.#####.', '#######', '.#####.', '..###..', '...#...'] },
  note: { col: '#3a5a78', edge: null, rows: ['...##.', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'] },
  touch: { col: '#f4c8a0', s: '#7a4a2a', edge: null, rows: [
    '..s....', '.s#s...', '.s#s...', '.s#sss.', 'ss####s', 's#####s', 's#####s', '.s###s.', '..sss..'] },
  pad: { col: '#dfeaf2', s: '#3a5a78', edge: null, rows: [
    'sssssss', 's#####s', 's#####s', 's#####s', 'sssssss', 's##s##s', 'sssssss'] },
  bksp: { col: '#3a5a78', edge: null, rows: [
    '..#######', '.#......#', '#..#..#.#', '#...##..#', '#..#..#.#', '.#......#', '..#######'] },
  send: { col: '#ffffff', edge: null, rows: ['##.....', '.###...', '.#####.', '#######', '.#####.', '.###...', '##.....'] },
  dot0: { col: '#9ab0c4', edge: null, rows: ['.###.', '#...#', '#...#', '#...#', '.###.'] },
  wifix: { col: '#ffb4a0', s: '#ff5a3a', edge: null, rows: [
    '..#####..', '.#.....#.', '#..###..#', '..#...#..', '....#....', 's.s......', '.s.......', 's.s......'] },
  max: { col: '#ffffff', edge: null, rows: ['#######', '#######', '#.....#', '#.....#', '#.....#', '#######'] },
  close: { col: '#ffffff', edge: null, rows: ['##...##', '.##.##.', '..###..', '..###..', '.##.##.', '##...##'] },
  clip: { col: '#ffffff', edge: null, rows: ['#....', '##...', '###..', '####.', '###..', '##...', '#....'] },
  dl: { col: '#5cc43c', edge: '#1c5e0e', rows: ['..hhh..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...', '.......', 'ddddddd'] },
};
export type GlyphName = keyof typeof DEFS;

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (c: string, w: string, k: number) => {
  const a = hex(c), b = hex(w);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

export interface GlyphOpts { col?: string; edge?: string | null; k?: number }
const cache = new Map<string, { url: string; w: number; h: number }>();

function paint(name: string, o: GlyphOpts) {
  const d = DEFS[name] ?? DEFS.dot0;
  const col = o.col ?? d.col, edge = o.edge === undefined ? d.edge ?? null : o.edge, k = o.k ?? 2;
  const key = `${name}|${col}|${edge}|${k}`;
  let c = cache.get(key);
  if (c) return c;
  const pal: Record<string, string> = { '#': col, h: mix(col, '#ffffff', 0.55), d: mix(col, '#000000', 0.35), s: d.s ?? mix(col, '#000000', 0.45) };
  const pad = edge ? 1 : 0;
  const w = Math.max(...d.rows.map(r => r.length)) + pad * 2, h = d.rows.length + pad * 2;
  const art = canvas(w, h, g => {
    d.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const p = pal[r[x]]; if (p) { g.fillStyle = p; g.fillRect(x + pad, y + pad, 1, 1); } } });
    if (edge) outline(g, w, h, edge);
  });
  const big = canvas(w * k, h * k, g => { g.imageSmoothingEnabled = false; g.drawImage(art, 0, 0, w * k, h * k); });
  c = { url: big.toDataURL(), w: w * k, h: h * k };
  cache.set(key, c);
  return c;
}

let styled = false;
const style = () => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `img.pg { display: inline-block; vertical-align: -0.1em; image-rendering: pixelated; margin: 0 0.14em; pointer-events: none; flex: none; }
img.pg:first-child { margin-left: 0; } img.pg:last-child { margin-right: 0; }`;
  document.head.appendChild(s);
};

/** data URL of a glyph */
export function glyphURL(name: GlyphName, o: GlyphOpts = {}): string { return paint(name, o).url; }
/** inline <img> markup of a glyph (for innerHTML templates) */
export function gi(name: GlyphName, o: GlyphOpts & { cls?: string } = {}): string {
  style();
  const p = paint(name, o);
  return `<img class="pg${o.cls ? ' ' + o.cls : ''}" src="${p.url}" width="${p.w}" height="${p.h}" alt="" draggable="false">`;
}
/** a glyph element */
export function giEl(name: GlyphName, o: GlyphOpts & { cls?: string } = {}): HTMLImageElement {
  style();
  const p = paint(name, o);
  const i = document.createElement('img');
  i.className = 'pg' + (o.cls ? ' ' + o.cls : '');
  i.src = p.url; i.width = p.w; i.height = p.h; i.alt = ''; i.draggable = false;
  return i;
}
/** a row of five stars, n of them filled */
export function starsGi(n: number, k = 2): string {
  return Array.from({ length: 5 }, (_, i) => gi(i < n ? 'star' : 'star0', { k })).join('');
}
/** a row of five route-difficulty gems */
export function gemsGi(n: number, k = 2): string {
  return Array.from({ length: 5 }, (_, i) => gi(i < n ? 'gem' : 'gem0', { k })).join('');
}

/** the tray battery: a little cell with 1-3 bars lit (red when low) */
const battCache = new Map<number, string>();
export function batteryGi(pct: number): string {
  style();
  const bars = pct > 60 ? 3 : pct > 30 ? 2 : 1;
  const key = bars * 10 + (pct < 25 ? 1 : 0);
  let u = battCache.get(key);
  if (!u) {
    const art = canvas(13, 8, g => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 11, 8); g.fillRect(11, 2, 2, 4);
      g.fillStyle = '#123050'; g.fillRect(1, 1, 9, 6);
      const lit = pct < 25 ? '#ff6a4a' : '#7ae64a';
      for (let i = 0; i < 3; i++) { g.fillStyle = i < bars ? lit : '#2a4a68'; g.fillRect(2 + i * 3, 2, 2, 4); }
    });
    u = canvas(26, 16, g => { g.imageSmoothingEnabled = false; g.drawImage(art, 0, 0, 26, 16); }).toDataURL();
    battCache.set(key, u);
  }
  return `<img class="pg" src="${u}" width="26" height="16" alt="" draggable="false">`;
}
