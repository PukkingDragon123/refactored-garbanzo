// The status plate's medallion: the player's bust (src/art/v7/bust.ts, rendered from the 3D rig at
// high resolution) in an ornate brass and leather frame, painted pixel by pixel:
//   - a stitched leather backing with a hard drop shadow
//   - a brass bezel turned like a torus (lit from the top left), engraved with a twisted-rope band,
//     eight domed rivets, a koru crest on top and a dark lip where it meets the glass
//   - behind him a sky disc that follows the time of day: a dithered gradient, the sun on its arc with
//     its rays (low, big and orange at the ends of the day), the moon with its craters and twinkling
//     stars at night, drifting pixel clouds, a far ridge and the sea with a glint on it
//   - his bust clipped to the disc, tinted by the sky and rim-lit on the side of the sun or moon
//   - the glass: an arc of glint and a spark; the bezel casting a dithered shadow inside it
//   - his name on a stitched red ribbon below
// Life (breathing, blinking, the wind in his hair, the expression, a growl, a flinch) comes in through
// MedallionState; bodyhud.ts drives it.

import { Art, col, dith, mixC, shadeC } from '../v11/paper/px';
import { skyAt, hudText, hudTextW, rivet, leatherAt, brassAt, BRASS6, hnoise } from '../v11/hudpx';
import { renderBust7 } from '../../art/v7/bust';
import type { Bust } from '../../art/v7/bust';

export interface MedallionState {
  id: string;
  name: string;
  expr: string;
  blink: boolean;
  mouth: 0 | 1 | 2;
  /** hair in the wind, -1..1 */
  wind: number;
  hour: number;
  /** seconds (twinkle, clouds, sparks) */
  t: number;
  /** breathing: the bust rises this many px (0 or 1) */
  breath: number;
  /** the inner lip blinks red (he's running low) */
  warn: boolean;
  /** 0..1: growl marks by his stomach */
  growl: number;
  /** 0..1: a red flash (hit) */
  hurt: number;
}

/** the bust's resolution against the in-game sprite */
export const BUST_K = 2.3;
/** layout (art px): the medallion's box, its centre and radii */
export const MED = { W: 84, H: 96, cx: 41, cy: 42, R: 36, Rs: 30, RL: 39 };

const OUT = col('#140c06');
const LEATHER = col('#5a3018'), LEATHER_D = col('#1e0e06'), THREAD = col('#d8b07a');

/** the top row with ink in a bust (cached) */
const tops = new WeakMap<Bust, number>();
function topRow(b: Bust): number {
  let t = tops.get(b);
  if (t !== undefined) return t;
  t = 0;
  outer: for (let y = 0; y < b.buf.h; y++) for (let x = 0; x < b.buf.w; x++) if (b.buf.data[y * b.buf.w + x] >>> 24) { t = y; break outer; }
  tops.set(b, t);
  return t;
}

const CLOUD = ['....####......', '..########.##.', '.#############', '##############', '.############.'];
const KORU = [
  '......####......',
  '....##BBBB##....',
  '...#BB####BB#...',
  '..#B##....##B#..',
  '..#B#.##...#B#..',
  '.##B#.#B#.#B##..',
  '#BBB##BB#BBB#B##',
  '################',
];

function paintSky(a: Art, cx: number, cy: number, Rs: number, hour: number, t: number) {
  const [top, bot] = skyAt(hour);
  const h = ((hour % 24) + 24) % 24;
  const night = h < 5.6 || h > 20.4, dusk = (h > 17.5 && h <= 20.4) || (h >= 5.6 && h < 7.4);
  const inDisc = (x: number, y: number) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= Rs * Rs;
  // the gradient: five dithered bands
  for (let y = cy - Rs; y <= cy + Rs; y++) for (let x = cx - Rs; x <= cx + Rs; x++) {
    if (!inDisc(x, y)) continue;
    const k = (y - (cy - Rs)) / (2 * Rs);
    const f = k * 4, i = Math.floor(f), fr = f - i;
    const step = Math.min(4, i + (dith(x, y, fr) ? 1 : 0)) / 4;
    a.put(x, y, mixC(top, bot, step));
  }
  // stars
  if (night || h < 6.2 || h > 19.8) {
    const vis = night ? 1 : 0.5;
    for (let i = 0; i < 26; i++) {
      const sx = cx - Rs + Math.floor(hnoise(i, 3, 9) * 2 * Rs), sy = cy - Rs + Math.floor(hnoise(i, 5, 9) * Rs * 1.3);
      if (!inDisc(sx, sy) || hnoise(i, 7, 9) > vis) continue;
      const tw = Math.sin(t * (1.3 + hnoise(i, 1, 2) * 2) + i * 2.1);
      const c = tw > 0.3 ? col('#fff6d0') : col('#a8b4e0');
      a.put(sx, sy, c);
      if (i % 7 === 0 && tw > 0.6) { a.put(sx - 1, sy, col('#8a96c8')); a.put(sx + 1, sy, col('#8a96c8')); a.put(sx, sy - 1, col('#8a96c8')); a.put(sx, sy + 1, col('#8a96c8')); }
    }
  }
  // the sun on its arc (east at 6, overhead at 12, west at 18), or the moon
  if (!night) {
    const f = Math.max(0, Math.min(1, (h - 6) / 12));
    const sx = Math.round(cx - Math.cos(f * Math.PI) * (Rs - 9)), sy = Math.round(cy + 4 - Math.sin(f * Math.PI) * (Rs - 10));
    const r = dusk ? 5 : 4;
    const core = dusk ? col('#ffd890') : col('#fffbe0'), body = dusk ? col('#ff9a48') : col('#ffe070'), rim = dusk ? col('#e0602e') : col('#f4b83a');
    // rays: eight short spokes, the diagonals dotted, and a dithered halo
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * Math.PI * 2 + t * 0.15;
      for (let rr = r + 2; rr <= r + (i % 2 ? 3 : 4); rr++) {
        const X = Math.round(sx + Math.cos(an) * rr), Y = Math.round(sy + Math.sin(an) * rr);
        if (inDisc(X, Y)) a.put(X, Y, mixC(body, top, i % 2 ? 0.5 : 0.25));
      }
    }
    for (let y = sy - r - 2; y <= sy + r + 2; y++) for (let x = sx - r - 2; x <= sx + r + 2; x++) {
      const d = Math.hypot(x + 0.5 - sx - 0.5, y + 0.5 - sy - 0.5);
      if (!inDisc(x, y)) continue;
      if (d <= r) a.put(x, y, d < r - 2.2 && x - sx + y - sy < 1 ? core : d > r - 1 && x - sx + y - sy > 0 ? rim : body);
      else if (d <= r + 1.6 && dith(x, y, 0.5)) a.put(x, y, mixC(a.get(x, y), body, 0.45));
    }
  } else {
    const f = ((h < 12 ? h + 24 : h) - 20.4) / 9.2;
    const mx = Math.round(cx - Math.cos(f * Math.PI) * (Rs - 10)), my = Math.round(cy + 2 - Math.sin(f * Math.PI) * (Rs - 11));
    const r = 4.5;
    for (let y = my - 5; y <= my + 5; y++) for (let x = mx - 5; x <= mx + 5; x++) {
      if (!inDisc(x, y)) continue;
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my), d2 = Math.hypot(x + 0.5 - mx - 2.4, y + 0.5 - my + 1.2);
      if (d > r) continue;
      if (d2 < r - 0.6) continue; // the crescent's shadow side
      a.put(x, y, d > r - 1 ? col('#c8c4a8') : col('#f4f0d8'));
    }
    // craters on the lit limb, a faint earthshine on the dark side
    a.put(mx - 3, my, col('#c8c4a8')); a.put(mx - 2, my + 2, col('#d8d4b8')); a.put(mx - 3, my - 2, col('#d8d4b8'));
    for (let y = my - 4; y <= my + 4; y++) for (let x = mx - 4; x <= mx + 4; x++) if (inDisc(x, y) && Math.hypot(x + 0.5 - mx, y + 0.5 - my) <= r && Math.hypot(x + 0.5 - mx - 2.4, y + 0.5 - my + 1.2) < r - 0.6 && dith(x, y, 0.25)) a.put(x, y, mixC(top, col('#5a6490'), 0.6));
  }
  // clouds drifting across
  const cl = night ? col('#3a4270') : dusk ? col('#f4b890') : col('#ffffff'), clD = night ? col('#262c52') : dusk ? col('#c87a6a') : col('#c8dcf0');
  for (let n = 0; n < 2; n++) {
    const span = 2 * Rs + 20;
    const ox = cx - Rs - 14 + Math.floor(((t * (0.7 + n * 0.4) + n * 37) % span + span) % span);
    const oy = cy - Rs + 8 + n * 9;
    CLOUD.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { const X = ox + i, Y = oy + j; if (inDisc(X, Y)) a.put(X, Y, j >= 3 ? clD : j === 0 || (j === 1 && i > 4) ? shadeC(cl, 0.1) : cl); } });
  }
  // the far ridge (left) and the sea (right) along the horizon
  const hz = cy + 13;
  const ridge = mixC(bot, night ? col('#101830') : col('#2e5a3a'), night ? 0.6 : 0.45), ridgeL = mixC(ridge, top, 0.25);
  const sea = mixC(bot, night ? col('#0c1430') : col('#2a6a9a'), 0.55);
  for (let x = cx - Rs; x <= cx + Rs; x++) {
    const hill = Math.round(Math.sin((x - cx) * 0.11 + 1.4) * 4 + Math.sin((x - cx) * 0.31) * 1.5 + 3);
    const top0 = x < cx + 6 ? hz - Math.max(0, hill) : hz;
    for (let y = top0; y <= cy + Rs; y++) {
      if (!inDisc(x, y)) continue;
      if (x < cx + 6 && y < hz + 1) a.put(x, y, y === top0 ? ridgeL : ridge);
      else a.put(x, y, y === hz && x >= cx + 6 ? mixC(sea, top, 0.4) : (y - hz) % 3 === 1 && dith(x, y + Math.floor(t * 2), 0.18) ? mixC(sea, bot, 0.5) : sea);
    }
  }
  // the sun's (or moon's) glint on the water
  const gx = cx + 14 + Math.round(Math.sin(t * 1.7) * 2);
  if (inDisc(gx, hz + 2)) { a.put(gx, hz + 2, col('#fff6d0')); a.put(gx + 1, hz + 2, col('#fff6d0')); a.put(gx + 3, hz + 4, mixC(col('#fff6d0'), sea, 0.4)); }
  return { top, bot, night, dusk };
}

/** paint the medallion with its top-left at (x0, y0) */
export function paintMedallion(a: Art, x0: number, y0: number, st: MedallionState) {
  const { R, Rs, RL } = MED;
  const cx = x0 + MED.cx, cy = y0 + MED.cy;
  // ---- the leather backing, with a drop shadow and a stitched edge
  for (let y = cy - RL; y <= cy + RL + 3; y++) for (let x = cx - RL; x <= cx + RL + 3; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), ds = Math.hypot(x + 0.5 - cx - 2, y + 0.5 - cy - 3);
    if (d > RL && ds <= RL && dith(x, y, 0.62)) a.px(x, y, col('#000000', 0.45));
  }
  for (let y = cy - RL; y <= cy + RL; y++) for (let x = cx - RL; x <= cx + RL; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > RL || d <= R) continue;
    if (d > RL - 1) { a.put(x, y, LEATHER_D); continue; }
    const lit = (cx - x) + (cy - y) > RL * 0.6 ? 0.08 : (x - cx) + (y - cy) > RL * 0.7 ? -0.18 : 0;
    a.put(x, y, leatherAt(x, y, shadeC(LEATHER, lit)));
  }
  for (let i = 0; i < 132; i++) {
    if (i % 3 === 2) continue;
    const an = (i / 132) * Math.PI * 2;
    const X = Math.round(cx - 0.5 + Math.cos(an) * (R + 1.6)), Y = Math.round(cy - 0.5 + Math.sin(an) * (R + 1.6));
    a.put(X, Y, Math.sin(an) > 0.3 ? shadeC(THREAD, -0.2) : THREAD);
  }
  // ---- the koru crest on top
  const kx = cx - 8, ky = cy - R - 5;
  KORU.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = row[i]; if (c === '.') continue; a.put(kx + i, ky + j, c === '#' ? (j < 3 || i < 6 ? BRASS6[4] : BRASS6[3]) : BRASS6[1]); } });
  a.put(kx + 6, ky + 1, BRASS6[5]); a.put(kx + 5, ky + 2, BRASS6[5]);
  // ---- the bezel: a brass torus lit from the top left, a twisted-rope engraving on its crest
  const L: [number, number, number] = [-0.5, -0.62, 0.6];
  const mid = (R + Rs) / 2 + 0.5, half = (R - Rs) / 2;
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > R || d <= Rs) continue;
    if (d > R - 1) { a.put(x, y, OUT); continue; }
    if (d <= Rs + 1) { a.put(x, y, st.warn ? col('#d8322a') : BRASS6[0]); continue; }
    const u = Math.max(-1, Math.min(1, (d - mid) / half));
    const nz = Math.sqrt(Math.max(0, 1 - u * u));
    const nx = (dx / d) * u, ny = (dy / d) * u;
    let l = (nx * L[0] + ny * L[1] + nz * L[2]) * 0.62 + 0.38;
    const an = Math.atan2(dy, dx);
    if (Math.abs(u) < 0.42 && Math.sin(an * 40 + u * 4.5) > 0.55) l -= 0.32; // the rope's grooves
    if (Math.abs(u) > 0.78) l -= 0.12;
    a.put(x, y, brassAt(x, y, l));
  }
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(an - Math.PI / 2) < 0.5) continue; // the ribbon covers the bottom one
    rivet(a, Math.round(cx - 0.5 + Math.cos(an) * (mid - 0.5)), Math.round(cy - 0.5 + Math.sin(an) * (mid - 0.5)));
  }
  // ---- the sky disc
  const sky = paintSky(a, cx, cy, Rs, st.hour, st.t);
  // ---- the bust, clipped to the disc, tinted by the sky and rim-lit
  const b = renderBust7(st.id, { expr: st.expr, blink: st.blink, mouth: st.mouth, wind: st.wind }, BUST_K);
  const bx = cx - b.ox + 1, by = cy - Rs + 3 - topRow(b) - st.breath + 1;
  const h = ((st.hour % 24) + 24) % 24;
  const sunSide = sky.night ? (h > 12 ? -1 : 1) : h < 12 ? -1 : 1;
  const rimC = sky.night ? col('#9ab0ff') : sky.dusk ? col('#ffb070') : mixC(sky.top, col('#ffffff'), 0.55);
  const tint = sky.night ? col('#1a2450') : sky.dusk ? col('#c05a30') : 0;
  const tintK = sky.night ? 0.3 : sky.dusk ? 0.1 : 0;
  const B = b.buf;
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < B.w && y < B.h && (B.data[y * B.w + x] >>> 24) > 0;
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    let c = B.data[y * B.w + x];
    if (!(c >>> 24)) continue;
    const X = bx + x, Y = by + y;
    const dd = (X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2;
    if (dd > Rs * Rs) continue;
    if (tintK) c = mixC(c, tint, tintK);
    // the rim: just inside the ink line on the side of the light, and along the top of the hair
    const edgeSide = op(x + sunSide, y) && !op(x + sunSide * 2, y);
    const edgeTop = op(x, y - 1) && !op(x, y - 2);
    const isInk = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
    if (!isInk && edgeSide) c = mixC(c, rimC, 0.5);
    else if (!isInk && edgeTop && dith(X, Y, 0.5)) c = mixC(c, rimC, 0.35);
    a.put(X, Y, c);
  }
  // ---- a flinch: the disc's edge flashes red, densest at the rim
  if (st.hurt > 0) for (let y = cy - Rs; y <= cy + Rs; y++) for (let x = cx - Rs; x <= cx + Rs; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > Rs) continue;
    if (dith(x, y, Math.max(0, (d - Rs * 0.45) / (Rs * 0.55)) * st.hurt)) a.put(x, y, mixC(a.get(x, y), col('#e8322a'), 0.6));
  }
  // ---- growl marks by his stomach: two rumbling waves each side, wobbling
  if (st.growl > 0) {
    const WAVE = [0, -1, -1, 0, 1, 1, 0, -1];
    const ph = Math.floor(st.t * 12);
    const len = st.growl < 0.3 ? Math.round(st.growl * 26) : 8;
    for (const sx of [-1, 1]) for (let n = 0; n < 2; n++) {
      const gx0 = cx + sx * (12 + n * 3) - 4, gy = cy + Rs - 12 + n * 4 - Math.round((1 - st.growl) * 3);
      for (let i = 0; i < len; i++) { const yy = gy + WAVE[(i + ph + n * 3) % 8]; a.put(gx0 + i, yy - 1, OUT); a.put(gx0 + i, yy + 1, OUT); }
      for (let i = 0; i < len; i++) a.put(gx0 + i, gy + WAVE[(i + ph + n * 3) % 8], i === 0 || i === 7 ? col('#e8c890') : col('#fff6dc'));
    }
  }
  // ---- the glass: the bezel's shadow on the top left inside, a glint arc, a spark
  for (let y = cy - Rs; y <= cy + Rs; y++) for (let x = cx - Rs; x <= cx + Rs; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > Rs || d < Rs - 2.2) continue;
    if (dx + dy < -Rs * 0.35 && dith(x, y, d > Rs - 1.1 ? 0.7 : 0.35)) a.put(x, y, mixC(a.get(x, y), col('#000000'), 0.35));
  }
  for (let i = 0; i < 18; i++) {
    const an = Math.PI * 1.1 + (i / 18) * Math.PI * 0.34;
    if (i === 6 || i === 7) continue;
    a.px(Math.round(cx - 0.5 + Math.cos(an) * (Rs - 4)), Math.round(cy - 0.5 + Math.sin(an) * (Rs - 4)), col('#ffffff', i % 3 === 0 ? 0.4 : 0.65));
  }
  const tw = (Math.sin(st.t * 0.9) + 1) / 2;
  if (tw > 0.8) {
    const gx = cx + Math.round(Rs * 0.52), gy = cy - Math.round(Rs * 0.55);
    a.px(gx, gy, col('#ffffff', 0.9)); a.px(gx - 1, gy, col('#ffffff', 0.5)); a.px(gx + 1, gy, col('#ffffff', 0.5)); a.px(gx, gy - 1, col('#ffffff', 0.5)); a.px(gx, gy + 1, col('#ffffff', 0.5));
  }
  // ---- the name on a stitched ribbon
  paintRibbon(a, cx, cy + Rs + 1, st.name);
}

function paintRibbon(a: Art, cx: number, y: number, text: string) {
  const tw = hudTextW(text, 'caps', 2);
  const w = tw + 18, H = 15, x0 = Math.round(cx - w / 2);
  const red = col('#a8281a'), redD = col('#661208'), redL = col('#d0503a'), redDD = col('#3e0a04');
  // the tails, folded back behind, with a V notch
  for (const s of [-1, 1]) {
    const tx = s < 0 ? x0 - 8 : x0 + w - 2;
    for (let j = 0; j < H - 2; j++) for (let i = 0; i < 10; i++) {
      const oi = s < 0 ? i : 9 - i; // 0 at the far end
      if (oi < Math.abs(j - (H - 3) / 2) * 0.6 - 0.5) continue; // the notch
      const edge = j === 0 || j === H - 3 || oi <= Math.abs(j - (H - 3) / 2) * 0.6 + 0.4;
      a.put(tx + i, y + 4 + j, edge ? OUT : j === 1 ? redD : (i + j) % 7 === 0 ? redDD : redD);
    }
    // the fold's shadow where the tail goes behind
    const fx = s < 0 ? x0 + 1 : x0 + w - 2;
    for (let j = 0; j < H - 4; j++) a.put(fx, y + 5 + j, redDD);
  }
  // the band
  for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) {
    const edge = j === 0 || j === H - 1 || i === 0 || i === w - 1;
    let c = edge ? OUT : j === 1 ? redL : j === H - 2 ? redD : red;
    if (!edge && j > 1 && j < H - 2 && hnoise(x0 + i, y + j, 4) > 0.9) c = shadeC(red, -0.12); // the weave
    a.put(x0 + i, y + j, c);
  }
  for (let i = 0; i < w; i++) { a.px(x0 + i + 2, y + H, col('#000000', 0.4)); }
  // stitching along both edges
  for (let i = 3; i < w - 3; i++) if (i % 3 !== 0) { a.put(x0 + i, y + 2, col('#f0d8b0')); a.put(x0 + i, y + H - 3, shadeC(col('#f0d8b0'), -0.15)); }
  hudText(a, text, Math.round(cx - tw / 2), y + 3, { face: 'caps', spacing: 2, c: [col('#fff8e0'), col('#fff1cc'), col('#e8c890')], ring: redDD, drop: 1, dropC: redDD });
}
