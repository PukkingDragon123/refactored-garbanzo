// MoriOS pixel skin: the laptop shell, window chrome, buttons, panels and badges painted as pixel art
// at startup and handed to the stylesheet as CSS variables (9-slice border images and sprites). The
// look keeps the old "aero" spirit (sky-blue chrome, gel buttons, glass gadgets) but every edge is a
// hard pixel: stepped corners instead of radii, banded fills instead of gradients, checker-dithered
// glass instead of translucency and blur, offset shadows instead of soft ones.
// Every piece is drawn at 1 art px and shown at K screen px per art px (--k, 2 by default).

import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';

const H = (s: string, a = 255): C => hex(s, a);
const url = (b: PixelBuffer) => `url(${b.toDataURL()})`;

/** a stepped-corner box mask: true inside (r = how many stair steps at each corner) */
function inside(x: number, y: number, w: number, h: number, r: number, rb = r): boolean {
  const cx = Math.min(x, w - 1 - x), top = y, bot = h - 1 - y;
  const cy = Math.min(top, bot), rr = top < bot ? r : rb;
  if (cx >= rr || cy >= rr) return true;
  return cx + cy >= rr;
}
/** distance (in pixels) from the outer edge of a stepped box */
function depth(x: number, y: number, w: number, h: number, r: number, rb = r): number {
  if (!inside(x, y, w, h, r, rb)) return -1;
  let d = 0;
  while (d < 8 && inside(x - 1 - d, y, w, h, r, rb) && inside(x + 1 + d, y, w, h, r, rb) && inside(x, y - 1 - d, w, h, r, rb) && inside(x, y + 1 + d, w, h, r, rb)) d++;
  return d;
}

/** a banded, outlined button / panel: rows of colour top to bottom, a lit left edge, a shaded right */
function box(w: number, h: number, o: { r?: number; rb?: number; out: string; rows: (y: number, h: number) => string; lit?: string; dark?: string; inner?: string; dither?: [string, string] }): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const out = H(o.out);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = depth(x, y, w, h, o.r ?? 2, o.rb);
    if (d < 0) continue;
    if (d === 0) { b.set(x, y, out); continue; }
    if (d === 1 && o.inner) { b.set(x, y, H(o.inner)); continue; }
    let c = o.rows(y, h);
    if (o.dither && (x + y) % 2 === 0) c = o.dither[0];
    else if (o.dither) c = o.dither[1];
    if (d === 1 && o.lit && (x < w / 2 && y < h - 2)) c = o.lit;
    if (d === 1 && o.dark && (x > w / 2 || y >= h - 2) && !(y < 2)) c = o.dark;
    b.set(x, y, H(c, c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255));
  }
  return b;
}

// ---------------------------------------------------------------- the pieces

/** the laptop shell round the screen: silver plastic, a dark glass bezel, a 9-slice (8, 8, 12, 8) */
function lap(): PixelBuffer {
  const W = 40, Hh = 44, T = 8, B = 12, S = 8;
  const b = new PixelBuffer(W, Hh);
  const PL = ['#f4f8fb', '#e2eaf0', '#d0dce6', '#bccad6', '#a6b6c4'];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const d = depth(x, y, W, Hh, 4, 3);
    if (d < 0) continue;
    // the screen opening
    if (x >= S && x < W - S && y >= T && y < Hh - B) continue;
    if (d === 0) { b.set(x, y, H('#1e2a36')); continue; }
    // the glass bezel: 3px of dark round the opening
    const ix = Math.min(x - (S - 3), (W - S + 2) - x), iy = Math.min(y - (T - 3), (Hh - B + 2) - y);
    if (ix >= 0 && iy >= 0 && x >= S - 3 && x < W - S + 3 && y >= T - 3 && y < Hh - B + 3) {
      const e = Math.min(ix, iy);
      b.set(x, y, e === 0 ? H('#8a9cac') : e === 1 ? H('#16202a') : H('#0e161e'));
      continue;
    }
    // plastic: a lit top edge, banded body, the thicker chin darker
    let c = d === 1 ? (y < Hh / 2 ? PL[0] : PL[3]) : y < 3 ? PL[1] : y > Hh - B + 4 ? PL[3] : PL[2];
    if (d === 1 && x > W / 2 && y > 2) c = PL[4];
    if (y === Hh - 3 && d > 1) c = PL[4];
    b.set(x, y, H(c));
  }
  return b;
}

/** window chrome (active / inactive): a 9-slice of 3 (2 at the top); the title bar paints itself */
function win(active: boolean): PixelBuffer {
  const W = 12, Hh = 12;
  return box(W, Hh, {
    r: 3, rb: 1, out: active ? '#0b2340' : '#4a5e74',
    rows: () => (active ? '#1c6cc0' : '#9aaec2'),
    lit: active ? '#6ac0ff' : '#dce6ee', dark: active ? '#164a8a' : '#7a90a8',
  });
}

/** a title-bar control (minimise / maximise / close) */
function ctl(kind: 'b' | 'x'): PixelBuffer {
  const R = kind === 'x' ? ['#ffd6c8', '#f07a5a', '#e4482c', '#b8301c', '#ff9a74'] : ['#f2faff', '#cfe6f8', '#9ccaf0', '#6ea8dc', '#e0f0fb'];
  return box(10, 10, {
    r: 1, out: kind === 'x' ? '#5a1408' : '#0b2340',
    rows: (y, h) => (y < 2 ? R[0] : y < h / 2 ? R[1] : y < h - 2 ? R[2] : R[3]),
    lit: R[0], dark: R[3],
  });
}

const GEL: Record<string, string[]> = {
  // outline, highlight, upper, lower, bottom, lip
  blue: ['#0a5f8e', '#e4fcff', '#9aeeff', '#27bde8', '#0f8fc8', '#6fe6ff'],
  green: ['#1c5e0e', '#f2ffe4', '#c2f592', '#5cc43c', '#389c22', '#9df06a'],
  pink: ['#80205a', '#fff0f8', '#ffc0e2', '#f070b4', '#cc4494', '#ff9ad2'],
  red: ['#6e1406', '#ffe8e0', '#ffb09a', '#ec4a30', '#c42e18', '#ff8a66'],
  glass: ['#5a7a96', '#ffffff', '#f0f7fc', '#d4e4f0', '#bcd2e2', '#e8f4fc'],
  amber: ['#6a3a00', '#fff8d0', '#ffe07a', '#f0a822', '#c87e10', '#ffd65a'],
};
/** a gel button: hard bands top to bottom, a glint, stepped ends (9-slice 4 / 3) */
function gel(c: string, pressed = false): PixelBuffer {
  const P = GEL[c];
  const W = 12, Hh = 12;
  const b = box(W, Hh, {
    r: 2, out: P[0],
    rows: (y, h) => {
      const yy = pressed ? y - 1 : y;
      return yy <= 1 ? P[1] : yy < h / 2 ? P[2] : yy < h - 3 ? P[3] : yy < h - 2 ? P[4] : P[5];
    },
  });
  if (!pressed) { b.set(3, 2, H('#ffffff')); b.set(4, 2, H('#ffffff')); b.set(6, 2, H('#ffffff', 170)); }
  return b;
}

/** a white panel (menus, balloons, the start menu list, fields) */
function panel(o: { out?: string; fill?: string; inner?: string; r?: number } = {}): PixelBuffer {
  return box(10, 10, { r: o.r ?? 2, out: o.out ?? '#1c4468', rows: () => o.fill ?? '#fbfdff', inner: o.inner ?? '#ffffff' });
}

/** checker-dithered glass (gadgets, the start menu frame): two blues on alternate pixels */
function glass(a: string, b2: string, out = '#0b3a66'): PixelBuffer {
  return box(10, 10, { r: 2, out, rows: () => a, inner: '#e8f8ff', dither: [a, b2] });
}

/** a taskbar button (up / pressed in) */
function tab(on: boolean): PixelBuffer {
  return box(10, 12, {
    r: 1, out: '#0b2a4a',
    rows: (y, h) => (on ? (y < h / 2 ? '#1c5ca8' : '#2a74c4') : (y < 2 ? '#a8dcff' : y < h / 2 ? '#5aa8f0' : '#3a8ae0')),
    lit: on ? '#164a8a' : '#c8ecff', dark: on ? '#3a8ae0' : '#1c5ca8',
  });
}

/** the start orb: a pixel disc of blue glass with a glint */
function orb(): PixelBuffer {
  const R = 11, D = R * 2 + 1;
  const b = new PixelBuffer(D, D + 1);
  const ramp = ['#eafcff', '#9ae8ff', '#5ad0f8', '#20a8dc', '#0c78b4'];
  for (let y = 0; y <= D; y++) for (let x = 0; x < D; x++) {
    const dx = x - R, dy = y - R;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (y === D) { if (Math.abs(dx) < R - 3) b.set(x, y, H('#000000', 90)); continue; }
    if (d > R + 0.4) continue;
    if (d > R - 0.6) { b.set(x, y, H('#083e66')); continue; }
    const t = (dy + R) / (2 * R);
    let c = t < 0.15 ? ramp[0] : t < 0.45 ? ramp[1] : t < 0.62 ? ramp[3] : t < 0.85 ? ramp[4] : ramp[2];
    if (d > R - 1.6 && dy < 0) c = '#ffffff';
    b.set(x, y, H(c));
  }
  // the glint
  for (let x = -5; x <= 3; x++) b.set(R + x, 4, H('#ffffff', 200));
  for (let x = -6; x <= 4; x++) b.set(R + x, 5, H('#ffffff', 120));
  return b;
}

/** the red "!" badge */
function badge(): PixelBuffer {
  const S = ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'];
  const b = new PixelBuffer(10, 10);
  S.forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '#') b.set(x + 1, y + 1, H(y < 3 ? '#ff8a70' : y < 6 ? '#e8382a' : '#b82418')); });
  const src = b.clone();
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) if (!src.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src.get(x + dx, y + dy) >>> 24)) b.set(x, y, H('#7a1010'));
  for (const y of [2, 3, 4, 5]) b.set(5, y, H('#ffffff'));
  b.set(5, 7, H('#ffffff'));
  return b;
}

/** a little yellow NEW tag */
function newTag(): PixelBuffer {
  return box(8, 8, { r: 1, out: '#7a4a08', rows: (y, h) => (y < h / 2 ? '#fff3a0' : '#ffc838') });
}

/** the pixel sun in the wallpaper's corner: a disc in rings, short rays */
function sun(): PixelBuffer {
  const R = 40, D = R * 2 + 1;
  const b = new PixelBuffer(D, D);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const d = Math.hypot(x - R, y - R);
    const bay = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][x & 3] / 16;
    if (d < 9) b.set(x, y, H('#fffff0'));
    else if (d < 12) b.set(x, y, H('#fff8c8', 230));
    else if (d < 20 && bay < (20 - d) / 8 * 0.6) b.set(x, y, H('#fffce0', 150));
    else if (d < 36 && bay < (36 - d) / 16 * 0.22) b.set(x, y, H('#ffffff', 90));
  }
  return b;
}

/** a water drop on the glass gadget */
function drop(): PixelBuffer {
  const S = ['..#..', '.###.', '#####', '#####', '.###.'];
  const b = new PixelBuffer(5, 5);
  S.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] === '#') b.set(x, y, H(y < 2 ? '#ffffff' : y < 4 ? '#bfeaff' : '#5ab0d8', 230)); });
  b.set(1, 2, H('#ffffff'));
  return b;
}

/** the tail under a balloon (white with the panel's outline, pointing down) */
function tail(): PixelBuffer {
  const b = new PixelBuffer(9, 6);
  for (let y = 0; y < 6; y++) for (let x = y; x < 9 - y; x++) b.set(x, y, x === y || x === 8 - y || y === 5 ? H('#1c4468') : H('#fbfdff'));
  for (let x = 1; x < 8; x++) b.set(x, 0, H('#fbfdff'));
  return b;
}

/** a progress trough */
function trough(): PixelBuffer {
  return box(8, 8, { r: 1, out: '#0b2a46', rows: (y) => (y < 2 ? '#123050' : '#1c4466') });
}

let vars: string | null = null;
/** the CSS custom properties (put them on .mos-wrap) */
export function osSkinVars(): string {
  if (vars) return vars;
  const v: Record<string, string> = {
    '--os-lap': url(lap()),
    '--os-win': url(win(true)), '--os-win-i': url(win(false)),
    '--os-ctl': url(ctl('b')), '--os-ctlx': url(ctl('x')),
    '--os-panel': url(panel()), '--os-field': url(panel({ out: '#5a7a96', r: 1, inner: '#e8eef4' })),
    '--os-glass': url(glass('#7cc4f0', '#4a9ad8')), '--os-glass2': url(glass('#2a7ac8', '#1c5ca8', '#06203c')),
    '--os-tab': url(tab(false)), '--os-tab-on': url(tab(true)),
    '--os-orb': url(orb()), '--os-badge': url(badge()), '--os-new': url(newTag()),
    '--os-sun': url(sun()), '--os-drop': url(drop()), '--os-trough': url(trough()), '--os-tail': url(tail()),
  };
  for (const c of Object.keys(GEL)) { v[`--os-gel-${c}`] = url(gel(c)); v[`--os-gel-${c}-p`] = url(gel(c, true)); }
  vars = Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
  return vars;
}
