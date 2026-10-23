// Physical UI kit: the things you stick on paper, as pixel sprites. Push pins (a lit round head, a
// steel point and a hard dithered shadow), paper clips, masking tape (see-through, dithered, with
// zigzag torn ends), rubber stamps (blocky caps in uneven ink, rotated in pixel space so the
// staircase edges stay crisp), polaroids, sticky notes, torn scraps of any paper, ink checkboxes,
// strike-throughs, underlines and circles round words, tally marks, luggage tags. Each helper
// returns an HTML string (the book lays pages out as HTML); the styles live in css.ts.
//
// Nothing here rotates a DOM element: pixel art never gets resampled. tilt() is kept for callers
// and now gives 0deg; pieces that should sit askew (stamps) are drawn askew, pixel by pixel.

import { rng, hashStr, hash2, fbm } from './rng';
import { svgInk, roughRect, roughEllipse, underline, tick, cross, strike, tally, INK, INK_RED, INK_BLUE, PENCIL, parseColor } from './ink';
import { paperTileArt } from './textures';
import type { PaperKind } from './textures';
import { Art, col, dith, PX, spriteURL, pxCanvas, keyOf, shadeC, mixC } from './px';
import { drawText, textWidth } from './pxfont';

export const escHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** (pixel art never rotates a DOM element: always '0deg'; kept so callers stay the same) */
export function tilt(_seed: number | string, _max = 2.5): string { return '0deg'; }
/** the angle tilt() used to give, in degrees: for drawing something askew in pixel space */
export function tiltDeg(seed: number | string, max = 2.5): number {
  const R = rng(typeof seed === 'string' ? hashStr(seed) : seed * 7 + 3);
  return (R() - 0.5) * 2 * max;
}
/** a small deterministic pixel nudge (x, y in CSS px, multiples of 2) to break up a grid of notes */
export function nudge(seed: number | string, max = 3): string {
  const R = rng((typeof seed === 'string' ? hashStr(seed) : seed) * 13 + 5);
  const v = () => Math.round((R() - 0.5) * 2 * max) * PX;
  return `translate(${v()}px, ${v()}px)`;
}

// ---------------------------------------------------------------- tape

const TAPE: Record<string, string> = { cream: '#efe2b4', blue: '#b4d0ea', green: '#c0dca4', pink: '#f2bccb' };
/** a strip of masking tape (place it with style: left/top) */
export function tape(o: { w?: string; rot?: string; style?: string; color?: 'cream' | 'blue' | 'green' | 'pink'; seed?: number } = {}): string {
  const c = o.color ?? 'cream', seed = o.seed ?? 3;
  return pxCanvas(`tape:${c}:${seed % 7}`, a => paintTape(a, TAPE[c] ?? TAPE.cream, seed), { cls: `pp-tape ${c}`, style: `width:${o.w ?? '4.2em'};${o.style ?? ''}` });
}
function paintTape(a: Art, hex: string, seed: number) {
  const W = a.w, H = a.h;
  const base = col(hex, 0.78), sheen = col('#fffdf0', 0.5), edge = col(hex, 0.92), shade = shadeC(col(hex, 0.85), -0.12);
  const zig = (y: number, s: number) => Math.round(hash2(y >> 1, s, seed) * 2);
  for (let y = 0; y < H; y++) {
    const l = zig(y, 1), r = W - 1 - zig(y, 2);
    for (let x = l; x <= r; x++) {
      let c = base;
      if (y === 0) c = edge;
      else if (y === H - 1) c = shade;
      else if (((x + y * 2) % 11 === 0) && dith(x, y, 0.6)) c = sheen;
      a.px(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- pins and clips

const PIN: Record<string, [string, string, string]> = {
  red: ['#e2533a', '#a8281a', '#ffd2c8'], blue: ['#4a7ad8', '#234a9a', '#d8e8ff'], green: ['#4aa848', '#23702a', '#e0ffd0'],
  yellow: ['#f0c43a', '#b88a10', '#fff8d0'], white: ['#e8e4dc', '#9a948a', '#ffffff'],
};
/** a push pin sprite as a data URL */
export function pinURL(color = 'red'): string {
  const [m, d, h] = PIN[color] ?? PIN.red;
  return spriteURL('pin:' + color, 10, 12, a => {
    const sh = col('#140a00', 0.32);
    // shadow on the paper below-right, then the needle, then the head
    a.ellipse(6.2, 7, 3.2, 2.6, (x, y) => (dith(x, y, 0.6) ? sh : 0));
    a.line(5, 7, 7, 10, col('#3a3e44'));
    a.put(7, 10, col('#8a9096'));
    a.ellipse(4.5, 4.5, 3.6, 3.6, col(d));
    a.ellipse(4.2, 4.1, 2.9, 2.9, col(m));
    a.put(3, 2, col(h)); a.put(2, 3, col(h)); a.put(3, 3, shadeC(col(h), -0.1));
    a.put(6, 6, shadeC(col(d), -0.25));
  });
}
/** a push pin; colour name */
export function pin(o: { color?: 'red' | 'blue' | 'green' | 'yellow' | 'white'; style?: string } = {}): string {
  return `<i class="pp-pin ${o.color ?? 'red'}" style="background-image:url(${pinURL(o.color ?? 'red')});${o.style ?? ''}"></i>`;
}

/** a paper clip sprite */
export function clipURL(): string {
  return spriteURL('clip', 8, 21, a => {
    const s = col('#8a9096'), hi = col('#e8eef2'), dk = col('#4a5056');
    // outer loop
    a.line(1, 4, 1, 17, s); a.line(2, 18, 5, 18, s); a.line(6, 17, 6, 2, s); a.line(5, 1, 3, 1, s); a.put(2, 2, s);
    // inner loop
    a.line(3, 4, 3, 14, s); a.put(4, 15, s); a.line(4, 3, 4, 3, s);
    a.line(1, 5, 1, 9, hi); a.put(5, 1, hi);
    a.line(7, 3, 7, 17, col('#140a00', 0.25)); a.line(2, 19, 6, 19, col('#140a00', 0.25));
    a.put(6, 18, dk);
  });
}
/** a paper clip clipped over an edge */
export function clip(o: { style?: string; rot?: string; color?: string } = {}): string {
  return `<i class="pp-clip" style="background-image:url(${clipURL()});${o.style ?? ''}"></i>`;
}

// ---------------------------------------------------------------- rubber stamps

const STAMP_INK: Record<string, string> = { red: INK_RED, blue: INK_BLUE, green: '#2f6b3a', black: '#2a2630' };

/** rotate a buffer by deg in pixel space (nearest neighbour: crisp staircases) */
export function rotateArt(src: Art, deg: number): Art {
  if (Math.abs(deg) < 0.5) return src;
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const W = Math.ceil(Math.abs(src.w * c) + Math.abs(src.h * s)) + 2, H = Math.ceil(Math.abs(src.w * s) + Math.abs(src.h * c)) + 2;
  const out = new Art(W, H);
  const cx = src.w / 2, cy = src.h / 2, ox = W / 2, oy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
    const sx = Math.floor(dx * c + dy * s + cx), sy = Math.floor(-dx * s + dy * c + cy);
    const v = src.get(sx, sy);
    if (v >>> 24) out.put(x, y, v);
  }
  return out;
}

/** the art of a stamp (before rotation), its text in blocky caps */
function stampArt(text: string, small: string, round: boolean, hex: string, size: 'sm' | 'md' | 'lg', seed: number): Art {
  const k = size === 'lg' ? 2 : 1;
  const T = text.toUpperCase(), S = small.toUpperCase();
  const tw = textWidth(T, { face: 'block', scale: k, spacing: 1 }), sw = S ? textWidth(S, { face: 'block', scale: 1, bold: false, spacing: 1 }) : 0;
  const ink = col(hex), wet = shadeC(col(hex), -0.22);
  let a: Art;
  if (round) {
    const half = Math.max(tw, sw) / 2 + 2;
    const rIn = Math.ceil(Math.sqrt(half * half + (S ? 64 : 20)));
    const D = (rIn + 4) * 2;
    a = new Art(D + 2, D + 2);
    const c = (D + 2) / 2;
    a.ring(c, c, D / 2, D / 2, ink); a.ring(c, c, D / 2 - 1, D / 2 - 1, ink);
    a.ring(c, c, rIn, rIn, ink);
    const by = S ? Math.round(c - 1) : Math.round(c + 3.5 * k);
    drawText(a, T, Math.round(c - tw / 2), by, ink, { face: 'block', scale: k, spacing: 1 });
    if (S) drawText(a, S, Math.round(c - sw / 2), by + 9, ink, { face: 'block', bold: false, spacing: 1 });
  } else {
    const top = size === 'sm' ? 3 : 6;
    const H = top * 2 + 7 * k + (S ? 9 : 0), W = tw + (size === 'sm' ? 8 : 14 + (k > 1 ? 4 : 0));
    a = new Art(W, H);
    const frame = (i: number) => { a.rect(i, i, W - i * 2, 1, ink); a.rect(i, H - 1 - i, W - i * 2, 1, ink); a.rect(i, i, 1, H - i * 2, ink); a.rect(W - 1 - i, i, 1, H - i * 2, ink); };
    frame(0);
    if (size !== 'sm') { frame(1); frame(3); }
    const by = top + 7 * k;
    drawText(a, T, Math.round((W - tw) / 2), by, ink, { face: 'block', scale: k, spacing: 1 });
    if (S) drawText(a, S, Math.round((W - sw) / 2), by + 9, ink, { face: 'block', bold: false, spacing: 1 });
  }
  // uneven inking: worn patches and pin holes, a few wet spots
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const v = a.get(x, y);
    if (!(v >>> 24)) continue;
    const n = fbm(x / 6, y / 6, seed, 2), h = hash2(x, y, seed);
    if (h < 0.08 || (n < 0.34 && dith(x, y, (0.34 - n) * 3.5))) a.put(x, y, 0);
    else if (h > 0.95 || n > 0.72) a.put(x, y, wet);
  }
  return a;
}

/**
 * A rubber stamp: blocky caps inside a double border (or a ring), in red / blue / green / black
 * ink, inked unevenly and stamped slightly askew. `fresh` plays the stamp-down animation when it
 * appears (pair it with paperSfx('stamp')). size: 'sm' | 'md' | 'lg' (a style with a small
 * font-size picks 'sm').
 */
export function stamp(text: string, o: { color?: 'red' | 'blue' | 'green' | 'black'; rot?: string; shape?: 'box' | 'round'; small?: string; fresh?: boolean; style?: string; seed?: number; size?: 'sm' | 'md' | 'lg' } = {}): string {
  const hex = STAMP_INK[o.color ?? 'red'] ?? INK_RED;
  const seed = o.seed ?? hashStr(text);
  const round = o.shape === 'round';
  const fs = /font-size:\s*([\d.]+)em/.exec(o.style ?? '');
  const size = o.size ?? (fs && +fs[1] < 0.75 ? 'sm' : 'md');
  const deg = o.rot !== undefined ? parseFloat(o.rot) || 0 : tiltDeg(seed, 7);
  const key = keyOf('stamp', text, o.small ?? '', round, hex, size, Math.round(deg), seed % 97);
  const url = stampURL(key, () => rotateArt(stampArt(text, o.small ?? '', round, hex, size, seed), deg));
  const [w, h] = stampSize.get(key)!;
  const style = (o.style ?? '').replace(/font-size:\s*[\d.]+em;?/, '');
  return `<span class="pp-stamp${round ? ' round' : ''}${o.fresh ? ' fresh' : ''}" role="img" aria-label="${escHtml(text)}${o.small ? ' ' + escHtml(o.small) : ''}" style="--c:${hex};width:${w * PX}px;height:${h * PX}px;background-image:url(${url});${style}"></span>`;
}
const stampURLs = new Map<string, string>();
const stampSize = new Map<string, [number, number]>();
function stampURL(key: string, make: () => Art): string {
  let u = stampURLs.get(key);
  if (!u) {
    const a = make();
    u = a.url(PX);
    stampURLs.set(key, u);
    stampSize.set(key, [a.w, a.h]);
  }
  return u;
}

// ---------------------------------------------------------------- photos, notes, scraps

/** a polaroid: a photo (or any image URL) in a white frame with a handwritten caption */
export function polaroid(img: string, cap = '', o: { rot?: string; w?: string; style?: string; tape?: boolean; pin?: string; cls?: string; bg?: string; attrs?: string } = {}): string {
  const pic = o.bg ? `<span class="ph" style="${o.bg}"></span>` : img ? `<img class="ph" src="${img}" alt="" draggable="false">` : '<span class="ph none"></span>';
  return `<span class="pp-polaroid ${o.cls ?? ''}" style="width:${o.w ?? '10em'};${o.style ?? ''}"${o.attrs ? ' ' + o.attrs : ''}>${o.tape ? tape({ w: '3.6em', style: 'position:absolute;left:50%;top:-0.7em;margin-left:-1.8em' }) : ''}${o.pin ? pin({ color: o.pin as 'red', style: 'position:absolute;left:50%;top:-6px;margin-left:-10px' }) : ''}${pic}${cap ? `<span class="cap pp-hand">${escHtml(cap)}</span>` : ''}</span>`;
}

/** a sticky note (yellow, pink, blue, green) with handwriting */
export function sticky(html: string, o: { color?: 'yellow' | 'pink' | 'blue' | 'green'; rot?: string; w?: string; style?: string; cls?: string } = {}): string {
  const c = o.color ?? 'yellow';
  return `<span class="pp-sticky ${c} ${o.cls ?? ''}" style="width:${o.w ?? '9em'};${o.style ?? ''}">${pxCanvas('sticky:' + c, a => paintSticky(a, c), { cls: 'pp-bgcv' })}<span class="pp-hand">${html}</span></span>`;
}
const STICKY: Record<string, [string, string, string]> = {
  yellow: ['#f8e886', '#e6c84a', '#fff6b8'], pink: ['#fac4d0', '#e494a8', '#ffe2ea'], blue: ['#c8e2f8', '#94bce4', '#e6f2ff'], green: ['#d4f0b8', '#a4d27e', '#eaffd8'],
};
function paintSticky(a: Art, c: string) {
  const [m, d, l] = (STICKY[c] ?? STICKY.yellow).map(x => col(x));
  const W = a.w - 2, H = a.h - 2;
  const sh = col('#281e00', 0.3);
  // hard dithered shadow, the note, a darker glued strip at the top, the curl at the bottom right
  for (let y = 2; y < H + 2; y++) for (let x = 2; x < W + 2; x++) if (dith(x, y, 0.55)) a.px(x, y, sh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = m;
    if (y < 3) k = mixC(m, d, 0.35);
    else if (y > H - 7 && dith(x, y, (y - (H - 7)) / 9)) k = d;
    if (x === 0 || y === 0) k = l;
    a.put(x, y, k);
  }
  for (let i = 0; i < 5; i++) for (let j = 0; j <= i; j++) a.put(W - 1 - j, H - 5 + i, i === j ? shadeC(d, -0.15) : 0);
  for (let i = 0; i < 4; i++) a.put(W - 5 + i, H - 1 - i, shadeC(d, -0.25));
}

const SCRAP_EDGE: Record<string, number> = { straight: 0, deckle: 2, torn: 4, perforated: 1 };
/** paint a sheet of paper with pixel edges, toasted rims and a hard shadow, at any size */
export function paintSheet(a: Art, kind: PaperKind, seed: number, edges: { top?: string; right?: string; bottom?: string; left?: string }, o: { shadow?: number; edge?: number; ruled?: number; margin?: boolean } = {}) {
  const sd = o.shadow ?? 2;
  const W = a.w - sd, H = a.h - sd;
  const tile = paperTileArt(kind);
  const R = rng(seed * 991 + 7);
  const prof = (kind2: string | undefined, n: number) => {
    const maxD = SCRAP_EDGE[kind2 ?? 'straight'] ?? 0;
    const out = new Int8Array(Math.max(1, n));
    if (!maxD) return out;
    let d = 0, run = 0;
    for (let i = 0; i < n; i++) {
      if (kind2 === 'perforated') { out[i] = (i % 5) < 2 ? 1 : 0; continue; }
      if (run <= 0) { d = Math.max(0, Math.min(maxD, d + (R() < 0.5 ? -1 : 1) * (R() < 0.7 ? 1 : 2))); run = 1 + Math.floor(R() * (kind2 === 'torn' ? 3 : 5)); }
      run--;
      out[i] = d;
    }
    return out;
  };
  const top = prof(edges.top, W), bot = prof(edges.bottom, W), lef = prof(edges.left, H), rig = prof(edges.right, H);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && y >= top[x] && y < H - bot[x] && x >= lef[y] && x < W - rig[y];
  const ek = o.edge ?? 0.5;
  const burn = col('#7a4a1a', 0.42), burn2 = col('#5a3410', 0.55);
  const sh = col('#1e1406', 0.34);
  const ox = (seed * 37) % 128, oy = (seed * 91) % 128;
  if (sd) for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (!inside(x, y) && inside(x - sd, y - sd) && dith(x, y, 0.6)) a.px(x, y, sh);
  const ruled = o.ruled ?? 0, rule = col('#4a6ea0', 0.26), marg = col('#be463c', 0.3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let c = tile.d[((y + oy) % 128) * 128 + ((x + ox) % 128)];
    if (ruled && y > ruled * 1.5 && (y % ruled) === ruled - 1) c = mixC(c, rule | 0xff000000, 0.26);
    if (o.margin && x === Math.round(W * 0.1)) c = mixC(c, marg | 0xff000000, 0.3);
    // distance to the edge (cheap: the 4 neighbours a few steps out)
    let dE = 4;
    for (let k = 1; k <= 3 && dE === 4; k++) if (!inside(x - k, y) || !inside(x + k, y) || !inside(x, y - k) || !inside(x, y + k)) dE = k;
    a.put(x, y, c);
    if (ek > 0 && dE === 1) a.px(x, y, dith(x, y, 0.5 + ek * 0.5) ? burn2 : burn);
    else if (ek > 0 && dE === 2 && dith(x, y, ek * 0.55)) a.px(x, y, burn);
    else if (ek > 0.5 && dE === 3 && dith(x, y, (ek - 0.5) * 0.4)) a.px(x, y, burn);
  }
}

/** a scrap of paper with ragged pixel edges (any paper kind) holding html */
export function scrap(html: string, o: { kind?: PaperKind; rot?: string; w?: string; style?: string; cls?: string; seed?: number; edges?: { top?: string; right?: string; bottom?: string; left?: string; amp?: number } } = {}): string {
  const seed = o.seed ?? html.length;
  const kind = o.kind ?? 'journal';
  const edges = o.edges ?? { top: 'torn', right: 'deckle', bottom: 'torn', left: 'deckle' };
  const bg = pxCanvas(`sheet:${kind}:${seed % 41}:${keyOf(edges)}`, a => paintSheet(a, kind, seed, edges, { edge: 0.45 }), { cls: 'pp-bgcv pp-sheet' });
  return `<span class="pp-scrap ${o.cls ?? ''}" style="width:${o.w ?? 'auto'};${o.style ?? ''}">${bg}<span class="pp-scrap-in">${html}</span></span>`;
}

// ---------------------------------------------------------------- ink marks

export type CheckState = 'todo' | 'done' | 'now' | 'fail';
/**
 * An ink checkbox: a hand-drawn box, ticked (done), crossed (fail) or empty. `fresh` draws the
 * tick on, pixel by pixel.
 */
export function checkbox(state: CheckState, seed = 1, fresh = false): string {
  const strokes = [{ d: roughRect(3, 4, 16, 16, { seed, double: false, rough: 0.9 }), c: state === 'todo' ? PENCIL : INK, w: 1.6 }];
  if (state === 'done') strokes.push({ d: tick(24, seed), c: INK_BLUE, w: 2.6, draw: fresh ? 0.45 : 0 } as never);
  if (state === 'fail') strokes.push({ d: cross(22, seed), c: INK_RED, w: 2.2, draw: fresh ? 0.35 : 0 } as never);
  if (state === 'now') strokes.push({ d: 'M8 12 L14 12', c: INK_RED, w: 2.4 } as never);
  return svgInk(24, 24, strokes, { cls: `pp-check ${state}`, w: '24px', h: '24px' });
}

/** a line of text struck through with a pen stroke (done steps) */
export function struck(html: string, seed = 1, fresh = false, colr = INK): string {
  return `<span class="pp-struck">${html}${svgInk(100, 6, [{ d: strike(100, seed), c: colr, w: 1.6, draw: fresh ? 0.4 : 0 }], { cls: 'pp-strike', stretch: true })}</span>`;
}

/** text with a hand-drawn underline (or a loose circle round it) */
export function marked(html: string, o: { mode?: 'under' | 'circle' | 'box'; color?: string; seed?: number; draw?: number } = {}): string {
  const seed = o.seed ?? html.length;
  const c = o.color ?? INK_RED;
  const svg = o.mode === 'circle'
    ? svgInk(100, 40, [{ d: roughEllipse(50, 20, 49, 18, { seed }), c, w: 1.6, draw: o.draw }], { cls: 'pp-circ', stretch: true })
    : o.mode === 'box'
      ? svgInk(100, 40, [{ d: roughRect(1, 2, 98, 36, { seed }), c, w: 1.5, draw: o.draw }], { cls: 'pp-circ', stretch: true })
      : svgInk(100, 6, [{ d: underline(100, { seed }), c, w: 1.7, draw: o.draw }], { cls: 'pp-under', stretch: true });
  return `<span class="pp-marked ${o.mode ?? 'under'}">${html}${svg}</span>`;
}

/** tally marks for a count ("|||| ||" for 7), optionally "of n" as faint pencil marks */
export function tallyMarks(n: number, of = 0, seed = 1): string {
  const t = tally(n, 16, seed);
  let html = n > 0 ? svgInk(t.w, 16, [{ d: t.d, c: INK_BLUE, w: 1.6 }], { cls: 'pp-tally', h: '16px', w: `${Math.round(t.w / 16 * 8) * 2}px` }) : '';
  if (of > n) {
    const r = tally(of - n, 16, seed + 9);
    html += svgInk(r.w, 16, [{ d: r.d, c: PENCIL, w: 1.1, opacity: 0.45 }], { cls: 'pp-tally ghost', h: '16px', w: `${Math.round(r.w / 16 * 8) * 2}px` });
  }
  return `<span class="pp-tallies">${html}</span>`;
}

/** a manila luggage tag on a string (labels, prices, the interaction prompt) */
export function luggageTag(html: string, o: { rot?: string; style?: string; cls?: string } = {}): string {
  return `<span class="pp-tag ${o.cls ?? ''}" style="${o.style ?? ''}">${pxCanvas('tag', a => paintTag(a), { cls: 'pp-bgcv' })}${html}</span>`;
}
/** a manila tag: notched left end, reinforced hole, darker lower edge */
export function paintTag(a: Art, hex = '#e2c48c') {
  const W = a.w - 2, H = a.h - 2;
  const tile = paperTileArt('kraft');
  const base = col(hex), dk = shadeC(base, -0.2), out = col('#3a2614'), sh = col('#1e1406', 0.34);
  const notch = Math.min(Math.floor(H / 2), 8);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && x >= Math.abs(y - (H - 1) / 2) - (H / 2 - notch) && x >= 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (!inside(x, y) && inside(x - 2, y - 2) && dith(x, y, 0.6)) a.px(x, y, sh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    a.put(x, y, edge ? out : y >= H - 3 ? dk : mixC(base, tile.d[(y % 128) * 128 + (x % 128)] | 0xff000000, 0.35));
  }
  const hx = notch + 2, hy = Math.floor(H / 2);
  a.ring(hx + 0.5, hy + 0.5, 2.6, 2.6, shadeC(base, 0.25));
  a.ellipse(hx + 0.5, hy + 0.5, 1.5, 1.5, col('#281808'));
}

export { INK, INK_RED, INK_BLUE, PENCIL, parseColor };
