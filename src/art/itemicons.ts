// Pixel-art icons for every item, skill and a few UI glyphs (16x16, crisp 1px outline).
// Icons are either hand-placed pixel maps or small procedural paintings; every one is auto-centred,
// outlined, and optionally given an un-outlined "post" layer (glows, steam, sound arcs).

import { PixelBuffer } from './pixel';
import { C, hex, withAlpha } from './color';
import { OUTLINE } from './palettes';

// ---------------------------------------------------------------- palette
// One shared palette so all icons read as a set. Map rows use these single-character keys.
const HEX: Record<string, string> = {
  k: '#0b0f12', K: '#262d33', w: '#f7f6ee', W: '#cdd3d1',
  '1': '#262c31', '2': '#3e474e', '3': '#65717a', '4': '#97a2a6', '5': '#d2d9d8',
  b: '#3b2a1f', B: '#6a4f37', n: '#9c7a55', N: '#c9a878',
  g: '#1d4a36', G: '#347a45', l: '#6fb150', L: '#b8de74',
  r: '#6e1b1e', R: '#b8382b', e: '#e8704a', p: '#f59aa4',
  y: '#8a5f12', Y: '#d8a02a', h: '#f8dd82',
  o: '#9c4a1c', O: '#e0853a',
  u: '#1e3360', U: '#3b659e', i: '#7fb0d8',
  c: '#138a86', C: '#3fd1c1', j: '#aaf7ea',
  v: '#43287a', V: '#7d54c2', x: '#c4a3ea',
  f: '#4a3223', F: '#7a5838', d: '#a88455',
  S: '#7d7447', s: '#bdb07a', a: '#445026', A: '#6f7d38', m: '#9aa450',
  t: '#454b53', T: '#7a8189', q: '#b9c0c4',
  z: '#12151b', Z: '#1f252c',
};
const P: Record<string, C> = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, hex(v)]));
const H = (s: string, a = 255) => hex(s, a);
const ramp = (...h: string[]) => h.map(x => hex(x));

const R_STONE = ramp('#3a3f47', '#565c65', '#7a8189', '#a4abb1', '#cfd4d6');
const R_AMBER = ramp('#6a3c08', '#a8640f', '#dc9a26', '#f5c95a', '#fff0b0');
const R_MOON = ramp('#77714a', '#aaa468', '#d6d196', '#f1edc4', '#fffdf0');
const R_POO = ramp('#2a1a10', '#4a3020', '#6e4a30', '#916b45');
const R_GLOW = ramp('#0f4a50', '#137274', '#1aa39c', '#3fd1c1', '#8ff0e0', '#dafff5');
const R_METAL = ramp('#1c2126', '#3d464d', '#6d777c', '#9aa3a5', '#d2d9d8');
const R_LEAF = ramp('#133029', '#1f4d31', '#347a45', '#5fa84d', '#9fd46a');
const R_RED = ramp('#4a1016', '#942522', '#c9432f', '#ee7650', '#ffb08a');
const R_CREAM = ramp('#8a7650', '#b8a372', '#dccb98', '#f3e8c4', '#fffaf0');
const R_JADE = ramp('#0c3b2c', '#13604a', '#1f8a68', '#3fb88a', '#9ff0c8');

type Draw = (b: PixelBuffer) => void;
interface IconDef { draw: Draw; post?: Draw; center?: boolean }

/** Paint a 16-row pixel map; '.' is transparent, other characters index the palette (or the override). */
function map(rows: string[], over: Record<string, string> = {}): Draw {
  const pal: Record<string, C> = { ...P };
  for (const [k, v] of Object.entries(over)) pal[k] = hex(v);
  if (rows.length !== 16 || rows.some(r => r.length !== 16)) console.warn('itemicons: malformed pixel map', rows);
  return b => {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c !== undefined) b.set(x, y, c);
      }
    }
  };
}

const px = (b: PixelBuffer, pts: [number, number][], c: C) => { for (const [x, y] of pts) b.set(x, y, c); };
/** Half ellipse (top half) - mushroom caps, brackets. */
function dome(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, ramp: C[]) {
  b.ellipseFn(cx, cy, rx, ry, (x, y, nx, ny) => {
    if (ny > 0.05) return -1;
    const l = -nx * 0.55 - ny * 0.7 + 0.35;
    const i = Math.max(0, Math.min(ramp.length - 1, Math.round((l * 0.5 + 0.5) * (ramp.length - 1) + (((x + y) & 1) ? 0.2 : -0.2))));
    return ramp[i];
  });
}
/** Soft glow halo (post layer). */
function halo(b: PixelBuffer, cx: number, cy: number, r: number, col: string, a = 90) {
  const c0 = hex(col);
  b.discFn(cx, cy, r, (x, y, nx, ny) => {
    if (b.opaque(x, y)) return -1;
    const d = Math.sqrt(nx * nx + ny * ny);
    const k = (1 - d) * a;
    if (k < 14 || ((x + y) & 1 && d > 0.6)) return -1;
    return withAlpha(c0, k);
  });
}
function wisp(b: PixelBuffer, x: number, y: number, h: number, col: string, a = 200, dir = 1) {
  for (let i = 0; i < h; i++) {
    const xx = x + Math.round(Math.sin((i / h) * Math.PI * 1.6) * dir);
    b.blend(xx, y - i, hex(col, Math.round(a * (1 - i / (h + 1)))));
  }
}

/** Filled ellipse rotated by ang radians; fn gets local normalised coords. */
function rotEllipse(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, ang: number, fn: (x: number, y: number, u: number, v: number) => C | -1) {
  const r = Math.max(rx, ry) + 1, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      if (u * u + v * v <= 1) { const c = fn(x, y, u, v); if (c !== -1) b.set(x, y, c); }
    }
}

// ---------------------------------------------------------------- icons
const ICON: Record<string, IconDef> = {};
const def = (id: string, draw: Draw, post?: Draw, center = true) => (ICON[id] = { draw, post, center });

// ================================================================ tools
def('camera', map([
  '................',
  '................',
  '................',
  '..3333..........',
  '.2444311111.RR..',
  '.44441333331444.',
  '.32213uwiuu3122.',
  '.32213uiuuu3122.',
  '.32213uuuuU3122.',
  '.32213uuuUU3122.',
  '.32213uUUUu3122.',
  '.11111333331111.',
  '......11111.....',
  '................',
  '................',
  '................',
]));
def('knife', map([
  '................',
  '............54..',
  '...........543..',
  '..........543...',
  '.........543....',
  '........543.....',
  '.......543......',
  '......343.......',
  '.....eRr........',
  '....eRr.........',
  '...ewr..........',
  '..eRr...........',
  '.eRr............',
  '.rr.............',
  '................',
  '................',
]));
def('jar', map([
  '................',
  '................',
  '....33333333....',
  '....45555554....',
  '....22222222....',
  '...wiiiiiiiiU...',
  '...wiiiiiiiiU...',
  '...wiiGGiiiiU...',
  '...wiGlGGiiiU...',
  '...iiiGGiiiiU...',
  '...iiiiGiiiiU...',
  '...iiiiiiiiUU...',
  '....UUUUUUUU....',
  '................',
  '................',
  '................',
], { i: '#a9cfe6', U: '#6d9cc0', G: '#4f8f3f', l: '#9fd46a' }));
def('net', map([
  '................',
  '...nnnnnn.......',
  '..nWqWqWqn......',
  '.nWqWqWqWqn.....',
  '.nqWqWqWqWn.....',
  '.nWqWqWqWqn.....',
  '.nqWqWqWqWn.....',
  '..nWqWqWqn......',
  '...nnnnnnB......',
  '.........BB.....',
  '..........BB....',
  '...........BB...',
  '............BB..',
  '.............bb.',
  '................',
  '................',
]));
def('trowel', map([
  '................',
  '.......45.......',
  '......3455......',
  '.....334555.....',
  '.....334455.....',
  '....33344555....',
  '....33344455....',
  '....23334455....',
  '.....233445.....',
  '......2334......',
  '.......33.......',
  '......BnNB......',
  '......BnnB......',
  '......BnnB......',
  '.......bb.......',
  '................',
]));
def('tweezers', map([
  '................',
  '......3553......',
  '.....45..54.....',
  '.....45..54.....',
  '.....4....4.....',
  '.....5....5.....',
  '......4..4......',
  '......5..5......',
  '......4..4......',
  '.......45.......',
  '.......54.......',
  '.......44.......',
  '.......33.......',
  '................',
  '................',
  '................',
]));
def('gloves', map([
  '................',
  '.......wi.......',
  '....wi.wi.wi....',
  '....ii.ii.ii.wi.',
  '....ii.ii.ii.iU.',
  '....iiiiiiiiiiU.',
  '.wi.iiiiiiiiiiU.',
  '.iiiiiiiiiiiiiU.',
  '..iiiiiiiiiiiUU.',
  '...iiiiiiiiiUU..',
  '....UiiiiiiUU...',
  '....wwwwwwwww...',
  '....WWWWWWWWW...',
  '................',
  '................',
  '................',
], { i: '#7ec4e8', U: '#4b8cc0', w: '#e8f6ff', W: '#a8cce0' }));
def('hammer', b => {
  b.rect(7, 6, 2, 8, P.B); b.rect(7, 6, 1, 8, P.n);
  b.rect(6, 10, 4, 4, P.R); b.rect(6, 10, 1, 4, P.e); b.rect(9, 10, 1, 4, P.r);
  b.rect(2, 3, 10, 3, P['4']); b.rect(2, 3, 10, 1, P['5']); b.rect(2, 5, 10, 1, P['3']);
  b.rect(1, 2, 3, 5, P['3']); b.rect(1, 2, 1, 5, P['4']);
  px(b, [[12, 3], [13, 4], [14, 5], [12, 4]], P['4']);
  px(b, [[12, 5], [13, 6], [14, 7]], P['3']);
});
def('headlamp', map([
  '................',
  '................',
  '................',
  '......3333......',
  '.....344443.....',
  '....34hhhY43....',
  '.AAA3hwhhhY3AAA.',
  '.aaa3hhhhYY3aaa.',
  '....34YYYY43....',
  '.....344443.....',
  '......3333......',
  '................',
  '................',
  '................',
  '................',
  '................',
]), b => {
  const cx = 8;
  for (let i = 0; i < 3; i++) b.blend(cx - 2 + i * 2, 1, H('#fff4b0', 150));
  b.blend(cx - 4, 2, H('#fff4b0', 110)); b.blend(cx + 3, 2, H('#fff4b0', 110));
});
def('translator', map([
  '................',
  '................',
  '....ZZZZZZZZ....',
  '....ZuUUUReZ....',
  '....ZUiUUUUZ....',
  '....ZUUwUUUZ....',
  '....ZUUUwUUZ....',
  '....ZUUwUUUZ....',
  '....ZUUUwwUZ....',
  '....ZUUUUUwZ....',
  '....ZuUUUUUZ....',
  '....ZuuUUUuZ....',
  '....ZZZ33ZZZ....',
  '....ZZZZZZZZ....',
  '................',
  '................',
]));
def('ghillie', map([
  '................',
  '......GGGG......',
  '.....GlGGGG.....',
  '.....Gzzzzg.....',
  '.....Gzzzzg.....',
  '....GlGzzGgg....',
  '...GlGAGGAgGg...',
  '...lGAlGAGgAg...',
  '..GlGAGlGAGgAg..',
  '..lGAlGAGlAgGg..',
  '.GlGAGlGAGgAGgg.',
  '.lGAlGAGlAgGAgg.',
  '.GAlGAGlAGgAGAg.',
  '.lG.lG.AG.gA.gA.',
  '................',
  '................',
]));
def('binoculars', map([
  '................',
  '................',
  '..zzzz....zzzz..',
  '..Z11Z....Z11Z..',
  '..YYYY....YYYY..',
  '.YuuuuY33YuuuuY.',
  '.YuwuuY44YuwuuY.',
  '.YuuuuY33YuuuuY.',
  '.yuuUuy22yuuUuy.',
  '..yyyy....yyyy..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]));

// ================================================================ materials
def('canvas', b => {
  for (let y = 4; y <= 11; y++) b.rect(2, y, 10, 1, y < 5 ? H('#d8cc92') : y < 7 ? P.s : y < 10 ? H('#9e9460') : P.S);
  b.ellipse(12, 7.5, 2.4, 4.1, P.S);
  b.ellipse(12, 7.5, 1.7, 3.1, H('#d8cc92'));
  b.ellipse(12, 7.5, 1, 2, P.S);
  b.set(12, 7, H('#5a5230')); b.set(12, 8, H('#5a5230'));
  b.rect(6, 4, 2, 8, P.d); b.rect(6, 4, 1, 8, P.N); b.set(8, 12, P.d); b.set(8, 13, P.F);
});
def('poles', b => {
  const pole = (x0: number, y0: number, x1: number, y1: number, bend: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend]); }
    for (const [x, y] of pts) { b.set(x, y, P['5']); b.set(x + 1, y, P['3']); }
    b.rect(x0, y0 - 1, 2, 2, P.z); b.rect(x1, y1, 2, 2, P.z);
  };
  pole(1, 13, 11, 2, 0); pole(5, 14, 14, 4, 1.4);
});
def('rope', b => {
  b.ellipseFn(8, 8, 6.4, 5.6, (x, y, nx, ny) => {
    const r = Math.sqrt(nx * nx + ny * ny);
    if (r < 0.28) return -1;
    const ring = Math.floor(r * 3.4);
    const a = Math.atan2(ny, nx);
    const tw = ((Math.floor(a * 3.2 + r * 9 + ring) % 2) + 2) % 2;
    const base = ring % 2 ? [P.F, P.d] : [P.d, P.N];
    return ny < -0.55 && tw ? P.N : base[tw];
  });
  px(b, [[12, 12], [13, 13], [13, 14]], P.d); px(b, [[12, 13], [14, 14]], P.F);
});
def('flax', map([
  '................',
  '.....mLmLm......',
  '....mLmLmLm.....',
  '....LmLmLmL.....',
  '.....mLmLm......',
  '.....LmLmL......',
  '......mLm.......',
  '......dNd.......',
  '......FdF.......',
  '......LmL.......',
  '.....mLmLm......',
  '.....LmLmL......',
  '....mLmLmLm.....',
  '....LmLmLmL.....',
  '...mL.mL.mL.....',
  '................',
], { m: '#a8ad5c', L: '#dcd98f' }));
def('wood', b => {
  const log = (cx: number, cy: number) => {
    b.disc(cx, cy, 3.3, P.b);
    b.disc(cx - 0.3, cy - 0.3, 2.6, P.N);
    b.disc(cx - 0.3, cy - 0.3, 1.6, P.n);
    b.set(Math.floor(cx - 0.3), Math.floor(cy - 0.3), P.B);
    b.set(Math.floor(cx + 2), Math.floor(cy + 1), P.B);
  };
  log(4.5, 10.5); log(11.5, 10.5); log(8, 5);
});
def('stone', b => {
  b.shadedEllipse(6, 10, 5, 3.6, R_STONE);
  b.shadedEllipse(11.5, 6, 3.4, 2.6, R_STONE);
  b.shadedEllipse(12, 11.5, 2.3, 1.8, ramp('#40342d', '#6e5d4f', '#8a7663', '#a9937b', '#cdb89d'));
});
def('plank', b => {
  const plank = (x: number, y: number, w: number, c1: string, c2: string, c3: string) => {
    b.rect(x, y, w, 4, H(c2)); b.rect(x, y, w, 1, H(c1)); b.rect(x, y + 3, w, 1, H(c3));
    for (let i = x + 2; i < x + w - 1; i += 4) b.set(i, y + 2, H(c3));
  };
  plank(1, 3, 13, '#dcc08e', '#b08c5c', '#7a5c3a');
  plank(2, 9, 12, '#cfb07c', '#a07c4e', '#6e5032');
  px(b, [[14, 3], [14, 4]], H('#b08c5c')); b.set(14, 5, 0); b.set(13, 6, 0);
  b.set(3, 5, P['4']); b.set(12, 11, P['4']); b.set(4, 11, P['4']);
});
def('scrap', b => {
  b.rect(2, 3, 3, 10, P['3']); b.rect(2, 10, 9, 3, P['3']);
  b.rect(2, 3, 1, 10, P['4']); b.rect(2, 10, 9, 1, P['4']);
  b.set(3, 5, P.z); b.set(3, 7, P.z); b.set(7, 11, P.z);
  px(b, [[4, 4], [3, 9], [9, 12], [10, 11]], P.o); px(b, [[4, 8], [8, 12]], P.O);
  b.disc(11.5, 5.5, 2.8, P['2']); b.disc(11.5, 5.5, 2.2, P['4']); b.disc(11.5, 5.5, 1, P.z);
  b.set(10, 4, P['5']);
});
def('resin', b => {
  b.shadedEllipse(8, 10, 4.6, 4.2, R_AMBER);
  b.poly([5, 8, 8, 1.5, 11, 8], R_AMBER[3]);
  b.poly([8, 3, 9.5, 7, 7.5, 7], R_AMBER[4]);
  b.set(6, 8, P.w); b.set(6, 9, R_AMBER[4]);
  px(b, [[9, 11], [10, 11], [9, 12]], H('#5a3208'));
  b.set(10, 10, H('#5a3208'));
}, b => { b.blend(12, 6, H('#fff0b0', 170)); b.blend(3, 12, H('#fff0b0', 120)); });
def('wire', b => {
  b.ellipseFn(8, 8, 6.2, 5.2, (x, y, nx, ny) => {
    const r = Math.sqrt(nx * nx + ny * ny);
    if (r < 0.4) return -1;
    const band = Math.floor(r * 7) % 2;
    const lit = ny < -0.2 || nx < -0.4;
    return band ? (lit ? P.h : P.O) : (lit ? P.O : P.o);
  });
  px(b, [[13, 11], [14, 12], [14, 13], [13, 14]], P.O);
});
def('pipe', map([
  '................',
  '................',
  '..zzzz..........',
  '.BzzzzB.........',
  '.BnNnnB.........',
  '.BnNnnB.........',
  '.BnnYnB.........',
  '.BnYYYB.........',
  '..BnYnBBBBBBB...',
  '...BBBbbbbbbbzz.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]), b => { wisp(b, 3, 1, 2, '#e8ecf0', 140); });
def('mussel', map([
  '................',
  '................',
  '..........uu....',
  '.........uUUu...',
  '........uUiUu...',
  '.......uUiiUu...',
  '......uUUiUUu...',
  '.....uUUiUUUu...',
  '....uUUUUUUu....',
  '...uUUUUUUu.....',
  '..uuUUUUuu......',
  '..zuuuuu........',
  '...zzz..........',
  '................',
  '................',
  '................',
], { u: '#1b2338', U: '#34466b', i: '#9fb8d8', z: '#0e121c' }));
def('battery', map([
  '................',
  '................',
  '...33......ee...',
  '..1111111111111.',
  '..2444444444442.',
  '..2AAAAAAAAAAA2.',
  '..2AAAAAhhAAAA2.',
  '..2AAAAhhAAAAA2.',
  '..2AAAhhhhhAAA2.',
  '..2AAAAAhhAAAA2.',
  '..2AAAAhhAAAAA2.',
  '..2aaaaaaaaaaa2.',
  '..1111111111111.',
  '................',
  '................',
  '................',
]));

// ================================================================ plants
def('fernfrond', b => {
  const pt = (t: number): [number, number] => [3 + t * 9 + Math.sin(t * 3) * 1.2, 14 - t * 12.5];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = pt(t);
    const [x2, y2] = pt(Math.min(1, t + 0.02));
    let dx = x2 - x, dy = y2 - y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    const L = t < 0.12 ? 0 : (1 - t) * 4.2 + 0.6;
    if (i % 2 === 0 && L > 0) {
      for (let k = 1; k <= L; k++) b.set(x + nx * k - dx * k * 0.35, y + ny * k - dy * k * 0.35, k === Math.floor(L) ? H('#9fd46a') : H('#4f9650'));
      for (let k = 1; k <= L; k++) b.set(x - nx * k - dx * k * 0.35, y - ny * k - dy * k * 0.35, k === Math.floor(L) ? P.w : H('#b9c6c4'));
    }
  }
  for (let i = 0; i <= 40; i++) { const [x, y] = pt(i / 40); b.set(x, y, i < 8 ? P.B : H('#2c6a3b')); }
});
def('flaxleaf', b => {
  const blade = (x0: number, y0: number, x1: number, y1: number, bend: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend, y0 + (y1 - y0) * t]); }
    b.stroke(pts, t => (1 - t) * 1.5 + 0.2, (t, x) => (x < pts[Math.min(12, Math.round(t * 12))][0] - 0.4 ? H('#9fd46a') : t > 0.85 ? H('#c9432f') : H('#347a45')));
  };
  blade(8, 14, 2, 2, -1.2); blade(8, 14, 13, 3, 1.2); blade(8, 14, 8, 1, 0.4);
  b.rect(6, 13, 5, 2, H('#6a4f37'));
});
def('kawakawa', map([
  '................',
  '.......L........',
  '......lGG.......',
  '.....lGlGG......',
  '....lGGlGGG.....',
  '...lGGGlGGGG....',
  '...lG.GlGGGGg...',
  '..lGGGGlGGG.Gg..',
  '..lGGGGlGGGGGg..',
  '.lGGGG.lGGGGGGg.',
  '.lGGGGGlGGGGGGg.',
  '.lGGGGgBgGGGGGg.',
  '..lGGg.B.gGGgg..',
  '.......B........',
  '.......B........',
  '................',
], { G: '#3f8f45', l: '#8ccf5f', g: '#24603a', L: '#c4e67f' }));
def('ratabloom', b => {
  b.ellipse(5, 13, 2.6, 1.3, H('#347a45')); b.ellipse(11, 13, 2.6, 1.3, H('#24603a'));
  b.rect(7, 11, 2, 3, H('#6a4f37'));
  const spikes = 26;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const len = 4.6 + ((i * 7) % 3) * 0.55;
    for (let k = 0; k <= len; k++) b.set(8 + Math.cos(a) * k, 7 + Math.sin(a) * k * 0.92, k > len - 1 ? P.h : (i % 2 ? P.R : P.e));
  }
  b.disc(8, 7, 2.2, H('#942522')); b.set(7, 6, P.e);
});
def('pitcher', map([
  '................',
  '........lGG.....',
  '.......lGGGg....',
  '....eRRRRe......',
  '....RzzzzR......',
  '.....lGGg.......',
  '.....lGRg.......',
  '....lGGGGg......',
  '...lGGRGGGg.....',
  '...lGGGGRGg.....',
  '...lGRGGGGg.....',
  '...lGGGGRGg.....',
  '....lGGGGg......',
  '.....gggg.......',
  '......BB........',
  '................',
], { G: '#5a9a3c', l: '#a8d466', g: '#346a2a' }));
def('moonfruit', b => {
  b.shadedEllipse(8, 9, 5, 4.8, R_MOON);
  b.rect(8, 2, 1, 3, P.B);
  b.poly([9, 3, 13, 1, 13, 4], H('#5fa84d')); b.line(9, 3, 12, 2, H('#9fd46a'));
  b.set(6, 7, P.w);
}, b => { halo(b, 8, 9, 7.5, '#fff8c0', 70); b.blend(3, 4, H('#fffbe0', 200)); b.blend(13, 11, H('#fffbe0', 160)); });
def('moss', b => {
  b.shadedEllipse(8, 11, 6.5, 2.8, R_STONE);
  b.ellipseFn(8, 10, 6, 3.6, (x, y, nx, ny) => {
    if (ny > 0.35) return -1;
    const n = ((x * 7 + y * 13) % 5);
    return ny < -0.5 ? (n < 2 ? H('#c6d86a') : H('#9dba45')) : n < 2 ? H('#7a9b31') : n < 4 ? H('#5c7c25') : H('#9dba45');
  });
  for (const [x, y] of [[5, 5], [8, 4], [11, 5]] as [number, number][]) { b.set(x, y + 1, H('#7a9b31')); b.set(x, y, H('#b85a30')); }
});

// ================================================================ fungi
def('glowcap', b => {
  b.rect(7, 8, 3, 6, H('#bff5ea')); b.rect(9, 8, 1, 6, H('#7fd8c8'));
  dome(b, 8.5, 8.5, 6, 6, R_GLOW);
  b.rect(3, 8, 11, 1, H('#137274'));
  b.rect(12, 11, 2, 3, H('#bff5ea'));
  dome(b, 12.8, 11.5, 2.4, 2.4, R_GLOW);
  px(b, [[6, 4], [10, 5], [5, 6]], H('#dafff5'));
}, b => { halo(b, 8.5, 7, 8, '#6ff0e0', 80); });
def('bracket', b => {
  b.rect(1, 1, 3, 14, P.b); b.rect(2, 1, 1, 14, P.B);
  const shelf = (cy: number, r: number) => {
    b.ellipseFn(3, cy, r, r * 0.55, (x, y, nx, ny) => {
      if (x < 4) return -1;
      if (ny > 0.35) return ny > 0.7 ? -1 : H('#6e4a2a');
      const d = Math.sqrt(nx * nx + ny * ny);
      const band = Math.floor(d * 4) % 2;
      return band ? H('#d2a868') : H('#a87a44');
    });
  };
  shelf(4, 9.5); shelf(8.5, 8); shelf(12.5, 6);
});
def('inkcap', b => {
  b.rect(7, 9, 2, 6, P.w); b.rect(8, 9, 1, 6, P.W);
  b.ellipseFn(8, 6, 4.2, 5.4, (x, y, nx, ny) => {
    if (ny > 0.62) return -1;
    return nx < -0.35 ? P.x : nx > 0.4 ? P.v : P.V;
  });
  px(b, [[4, 9], [6, 10], [7, 10], [10, 10], [12, 9], [11, 10]], P.v);
  px(b, [[6, 11], [11, 11]], H('#2a1850'));
  b.set(6, 3, H('#e8d8fa'));
}, b => { b.blend(6, 12, H('#43287a', 200)); b.blend(11, 13, H('#43287a', 170)); });

// ================================================================ insects
def('lanternbeetle', map([
  '................',
  '......z..z......',
  '.......zz.......',
  '......zZZz......',
  '......ZUUZ......',
  '...zzZUUUUZzz...',
  '.....ZUZZUZ.....',
  '..zzZUZzZUZZzz..',
  '....ZUZzZUZZ....',
  '..zzZZZzZZZZzz..',
  '....ZZZzZZZZ....',
  '.....LhhhhL.....',
  '.....hwwwwh.....',
  '......LhhL......',
  '................',
  '................',
], { Z: '#1c2a3a', U: '#3d6a8a', L: '#b8e05a', h: '#e8f870' }), b => { halo(b, 8, 12, 6, '#d8ff70', 110); });
def('weta', b => {
  b.ellipseFn(9, 9, 5, 3.2, (x, y, nx, ny) => ((x % 2) ? (ny < -0.3 ? H('#a07048') : H('#7a4e2e')) : (ny < -0.3 ? H('#8a5c38') : H('#5e3a22'))));
  b.disc(3.5, 9, 2.3, H('#6a4028')); b.set(3, 8, P.z); b.set(2, 9, H('#a07048'));
  b.line(10, 7, 13, 3, H('#8a5c38')); b.line(11, 7, 14, 3, H('#5e3a22'));
  b.line(13, 3, 15, 12, H('#5e3a22'));
  px(b, [[14, 6], [15, 8]], H('#e8d8c0'));
  b.line(5, 11, 4, 14, H('#5e3a22')); b.line(8, 12, 8, 14, H('#5e3a22'));
  b.line(3, 7, 1, 1, H('#3a2416')); b.line(3, 7, 6, 1, H('#3a2416'));
});
def('skymoth', map([
  '................',
  '..dddd....dddd..',
  '.dOOOOd..dOOOOd.',
  '.OOzzOOddOOzzOO.',
  '.OzhhzOzzOzhhzO.',
  '.OzhzzOzzOzzhzO.',
  '.OOzzOOzzOOzzOO.',
  '..OOOOOzzOOOOO..',
  '...dOOOzzOOOd...',
  '..dOOdOzzOdOOd..',
  '..dOOOdzzdOOOd..',
  '...ddd.zz.ddd...',
  '.......zz.......',
  '................',
  '................',
  '................',
], { O: '#e0a050', d: '#9c5a24', h: '#f8e070', z: '#241810' }));
def('mantis', b => {
  const G1 = H('#2f7a3a'), G2 = H('#5fae4a'), G3 = H('#a8dc6a'), G0 = H('#1d4a2a');
  b.ellipseFn(10, 10, 4.5, 3, (x, y, nx, ny) => (ny < -0.3 ? G2 : Math.abs(ny) < 0.12 ? G0 : G1));
  b.line(6, 9, 4, 4, G2); b.line(7, 9, 5, 4, G1);
  b.poly([2, 3, 5, 2, 5, 5], G2); b.set(3, 3, P.z);
  b.line(4, 6, 2, 8, G3); b.line(2, 8, 3, 10, G2);
  b.line(8, 12, 7, 14, G1); b.line(11, 12, 12, 14, G1);
  px(b, [[9, 8], [11, 8], [13, 9]], G3);
});
def('dragonfly', map([
  '................',
  '......CUUC......',
  '.......UU.......',
  '.iiwwwiUUiwwwii.',
  '..iiiiiUUiiiii..',
  '.iiwwwiUUiwwwii.',
  '..iiiiiUUiiiii..',
  '.......UU.......',
  '.......uU.......',
  '.......UU.......',
  '.......uU.......',
  '.......UU.......',
  '.......uU.......',
  '.......UC.......',
  '................',
  '................',
], { i: '#b8def0', w: '#eaf8ff', U: '#2f6fb8', u: '#1c4a88', C: '#3fd1c1' }));
def('grub', b => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.15 + i / 14 * 1.25); pts.push([8 + Math.cos(a) * 4.2, 7.5 + Math.sin(a) * 4.2]); }
  b.stroke(pts, t => 2.6 - t * 0.9, (t, x, y) => ((Math.floor(t * 9) % 2) ? R_CREAM[2] : (y < 7 ? R_CREAM[4] : R_CREAM[3])));
  const [hx, hy] = pts[0];
  b.disc(hx, hy, 1.8, H('#8a4a1c')); b.set(hx, hy - 1, H('#c47a3a'));
});

// ================================================================ animal samples
def('furtuft', b => {
  b.line(0, 13, 15, 11, P.b); b.line(0, 14, 15, 12, P.f); b.line(10, 12, 12, 9, P.b);
  const cols = [H('#4e2e1a'), H('#7a4e2e'), H('#a8784a'), H('#d0a472')];
  rotEllipse(b, 6.5, 9, 4.2, 2.6, -0.5, (x, y, u, v) => (v < -0.3 ? cols[2] : v < 0.3 ? cols[1] : cols[0]));
  for (let i = 0; i < 6; i++) {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([4 + i * 1.3 + t * (3 + i * 0.4), 9 - t * (5 + (i % 3)) + Math.sin(t * 3 + i) * 0.8]); }
    b.stroke(pts, t => 0.9 - t * 0.5, t => cols[Math.min(3, 1 + Math.floor(t * 3))]);
  }
});
def('feather', b => {
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = 2 + t * 11.5, y = 14 - t * 12.5;
    const w = t < 0.15 ? 0 : Math.sin(Math.min(1, (t - 0.1) / 0.9) * Math.PI * 0.95) * 2.8 + 0.4;
    const bar = Math.floor(t * 9) % 2;
    for (let k = -w; k <= w; k += 0.5) {
      const xx = x + k * 0.72, yy = y + k * 0.72;
      b.set(xx, yy, k < 0 ? (bar ? H('#f0e6d0') : H('#7a5030')) : (bar ? H('#d8ccb4') : H('#5e3a22')));
    }
  }
  for (let i = 0; i <= 30; i++) { const t = i / 30; b.set(2 + t * 11.5, 14 - t * 12.5, t < 0.2 ? H('#e8dcc0') : H('#bfae90')); }
});
def('scale', b => {
  b.poly([8, 1.5, 13.5, 8, 8, 14.5, 2.5, 8], H('#6a7a58'));
  b.poly([8, 2.5, 8, 13.5, 3.5, 8], H('#8a9a70'));
  b.line(8, 2, 8, 14, H('#c2cfa0'));
  b.line(9, 3, 9, 13, H('#4e5c40'));
  px(b, [[5, 7], [6, 10], [11, 6], [11, 9]], H('#a8b888'));
});
def('shedskin', b => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([1.5 + t * 12.5, 8 + Math.sin(t * Math.PI * 2) * 3.4]); }
  b.stroke(pts, t => 1.9 - t * 0.9, (t, x, y) => (((Math.floor(x) + Math.floor(y)) % 2) ? H('#e8dcb8') : H('#c8b890')));
  const [hx, hy] = pts[0];
  b.disc(hx + 0.5, hy, 2.1, H('#efe4c4')); b.set(hx, hy - 1, H('#8a8070'));
});
def('dropping', b => {
  b.shadedEllipse(7, 11.5, 5, 2.6, R_POO);
  b.shadedEllipse(8, 8.5, 3.8, 2.2, R_POO);
  b.shadedEllipse(8.5, 6, 2.4, 1.6, R_POO);
  b.set(9, 4, R_POO[2]);
  px(b, [[5, 11], [6, 12]], H('#9aa890')); b.set(10, 9, H('#e8e4d8'));
}, b => {
  b.blend(13, 3, H('#20262c', 230)); b.blend(12, 2, H('#cde', 150)); b.blend(14, 2, H('#cde', 150));
  wisp(b, 3, 7, 4, '#a8c868', 150); wisp(b, 12, 8, 3, '#a8c868', 130, -1);
});
def('quill', b => {
  for (let i = 0; i <= 34; i++) {
    const t = i / 34;
    const x = 1.5 + t * 13, y = 14 - t * 12.5;
    const band = t > 0.12 && Math.floor(t * 7) % 2;
    const c = t < 0.12 ? P.w : band ? H('#1a1612') : H('#efe4c8');
    b.set(x, y, c);
    if (t > 0.1 && t < 0.92) b.set(x + 1, y, band ? H('#3a3028') : H('#cfc2a0'));
  }
  px(b, [[3, 12], [5, 10], [4, 11]], P.w);
});
def('bone', b => {
  const B1 = H('#f2ead2'), B2 = H('#d8cca8'), B3 = H('#a89a78');
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 3.6, y = 11.5 - i * 3.3;
    b.line(x - 2.2, y - 2.4, x + 2.2, y + 2.4, B3);
    b.line(x - 2.6, y + 0.6, x - 0.6, y + 2.6, B2); b.line(x + 0.6, y - 2.6, x + 2.6, y - 0.6, B2);
    b.disc(x, y, 1.9, B2); b.disc(x - 0.4, y - 0.4, 1.2, B1);
  }
  b.set(11, 5, H('#6a5a42')); b.set(8, 8, H('#6a5a42'));
});
def('eggshell', b => {
  const zig = (x: number) => 5 + [0, -2, 1, -1, 2, 0, -1][x % 7];
  b.ellipseFn(7.5, 8.5, 5.4, 6.2, (x, y, nx, ny) => {
    if (y < zig(x)) return -1;
    if (y < zig(x) + 2 && ny < -0.2) return H('#c8b48a');
    return nx < -0.35 ? H('#fff8e4') : nx > 0.5 ? H('#d8c49a') : H('#f0e2bc');
  });
  px(b, [[4, 10], [6, 12], [9, 11], [10, 9], [5, 8], [8, 13], [11, 12]], H('#d8a02a'));
  px(b, [[7, 10], [3, 12]], H('#b8801a'));
  b.poly([12, 3, 15, 4, 14, 6, 12, 6], H('#f0e2bc')); b.set(13, 4, H('#d8a02a'));
});
def('plate', b => {
  const pts = [3, 5, 6, 2, 10, 2, 13, 5, 13, 11, 8, 14, 3, 11];
  b.poly(pts, H('#b8a47e'));
  b.polyFn(pts, (x, y) => (x + y < 11 ? H('#dccca4') : x - y > 3 || y > 11 ? H('#8a7658') : -1));
  b.line(8, 3, 8, 13, H('#efe2c0')); b.line(9, 4, 9, 12, H('#7a6848'));
  px(b, [[5, 7], [6, 10], [11, 7], [11, 9], [5, 5]], H('#6a5a42'));
  b.line(10, 4, 12, 6, H('#2a1e16')); b.line(10, 6, 11, 7, H('#2a1e16'));
});

// ================================================================ lures
def('fruitlure', b => {
  b.disc(11.5, 4.5, 2.6, R_MOON[3]); b.set(11, 3, R_MOON[4]); b.set(12, 5, R_MOON[1]);
  rotEllipse(b, 7.5, 8.5, 6.4, 3.4, -0.72, (x, y, u, v) => (Math.abs(v) < 0.14 ? H('#9fd46a') : v < 0 ? H('#5fa84d') : u > 0.7 ? H('#24603a') : H('#347a45')));
  for (const t of [-0.25, 0.3]) {
    const cx = 7.5 + Math.cos(-0.72) * t * 6.4, cy = 8.5 + Math.sin(-0.72) * t * 6.4;
    for (let k = -3; k <= 3; k++) b.set(cx + Math.sin(0.72) * k * 1.05, cy + Math.cos(0.72) * k * 1.05, k % 2 ? H('#e8cc98') : H('#b89060'));
  }
  b.set(2, 13, H('#1f5a36')); b.set(1, 14, H('#1f5a36'));
});
def('grublure', b => {
  b.disc(5.5, 5, 1.6, R_CREAM[3]); b.disc(8, 4, 1.7, R_CREAM[4]); b.disc(10.5, 5, 1.6, R_CREAM[3]);
  px(b, [[5, 4], [8, 3], [10, 4]], H('#8a4a1c'));
  b.ellipseFn(8, 10, 6, 4.8, (x, y, nx, ny) => (ny < -0.62 ? -1 : nx < -0.4 ? H('#e09058') : nx > 0.4 ? H('#8a3e1c') : H('#c06a38')));
  b.rect(2, 6, 12, 2, H('#d87a44')); b.rect(2, 6, 12, 1, H('#f0a868'));
  b.rect(4, 10, 8, 1, H('#8a3e1c'));
});
def('fishbait', b => {
  b.shadedEllipse(7, 9, 5, 2.8, R_METAL);
  b.poly([11, 9, 15, 5.5, 15, 12.5], H('#6d777c'));
  b.line(12, 9, 14, 7, H('#9aa3a5'));
  b.set(4, 8, P.z); b.set(3, 8, P.w);
  b.line(5, 11, 9, 11, H('#b85a4a'));
}, b => { wisp(b, 5, 5, 4, '#b8d070', 170); wisp(b, 9, 5, 3, '#b8d070', 140, -1); });
def('scentlure', b => {
  b.rect(6, 1, 4, 3, H('#a8784a')); b.rect(6, 1, 1, 3, H('#c89a68'));
  b.rect(5, 4, 6, 1, H('#6d777c'));
  b.ellipseFn(8, 10, 4.4, 5, (x, y, nx, ny) => (ny < -0.62 ? -1 : ny < -0.1 ? (nx < -0.3 ? H('#d8ecf4') : H('#9ec0cc')) : nx < -0.35 ? H('#7a4a8a') : H('#4a2a5a')));
  b.set(6, 8, P.w);
}, b => { wisp(b, 3, 6, 4, '#c090e0', 160); wisp(b, 13, 7, 4, '#c090e0', 140, -1); });
def('glowlure', b => {
  b.shadedEllipse(8, 8.5, 5.4, 5.2, R_AMBER);
  b.rect(6, 7, 1, 4, H('#dafff5')); b.rect(9, 8, 1, 3, H('#dafff5'));
  dome(b, 6.5, 7.5, 2.2, 2, R_GLOW); dome(b, 9.5, 8.5, 1.8, 1.7, R_GLOW);
  b.set(5, 5, P.w);
}, b => { halo(b, 8, 8.5, 8, '#80f0d8', 80); });
def('caller', b => {
  b.rect(1, 7, 10, 3, P.n); b.rect(1, 7, 10, 1, P.N); b.rect(1, 9, 10, 1, P.B);
  b.rect(1, 6, 2, 5, P.B);
  b.set(6, 8, P.b); b.set(8, 8, P.b);
  b.rect(11, 7.5, 1, 2, H('#b85a30'));
}, b => {
  for (const r of [2.5, 4.5]) for (let a = -0.9; a <= 0.9; a += 0.18) b.blend(11.5 + Math.cos(a) * r, 8.5 + Math.sin(a) * r, H('#fff4c8', r < 3 ? 230 : 160));
});
def('trap', b => {
  b.rect(3, 2, 10, 12, H('#5a6a34'));
  b.rect(3, 2, 10, 1, H('#8a9a50'));
  px(b, [[4, 5], [5, 5], [11, 10], [11, 11], [10, 12], [4, 12], [12, 4]], H('#3a4424'));
  px(b, [[10, 3], [6, 12], [12, 7]], H('#8a9a50'));
  b.disc(8, 7, 2.6, P.z); b.disc(8, 7, 1.7, H('#2c4b80')); b.set(7, 6, P.i);
  b.rect(6, 11, 4, 2, H('#c8d0c8')); b.set(11, 3, P.R);
  b.rect(1, 6, 2, 3, P.z); b.rect(13, 6, 2, 3, P.z);
});

// ================================================================ food
def('ration', b => {
  b.rect(2, 3, 12, 11, H('#d8b87c')); b.rect(2, 3, 12, 1, H('#f0d8a0')); b.rect(2, 3, 1, 11, H('#e8cc90'));
  b.rect(2, 13, 12, 1, H('#a8844c')); b.rect(13, 3, 1, 11, H('#b8945c'));
  for (let y = 5; y < 13; y += 3) for (let x = 4; x < 13; x += 3) b.set(x, y, H('#9a7440'));
  b.set(13, 3, 0); b.set(12, 3, 0); b.set(13, 4, 0);
});
def('stew', b => {
  b.ellipse(8, 8, 6.5, 2, H('#c0501e'));
  px(b, [[5, 8], [9, 7], [11, 8]], H('#e8a040')); px(b, [[7, 8], [10, 9]], H('#6fb150'));
  b.ellipseFn(8, 9, 6.6, 5, (x, y, nx, ny) => (ny < 0.05 ? -1 : nx < -0.4 ? H('#a8845c') : nx > 0.45 ? H('#5a4028') : H('#7a5838')));
  b.rect(2, 8, 13, 1, H('#c9a878'));
}, b => { wisp(b, 5, 5, 4, '#ffffff', 170); wisp(b, 9, 4, 4, '#ffffff', 150, -1); wisp(b, 12, 5, 3, '#ffffff', 120); });
def('tea', b => {
  b.rect(3, 5, 8, 9, H('#e8ecf0')); b.rect(3, 5, 2, 9, P.w); b.rect(9, 5, 2, 9, H('#b8c4cc'));
  b.rect(3, 5, 8, 1, H('#2c4b80')); b.rect(3, 13, 8, 1, H('#2c4b80'));
  b.rect(11, 7, 3, 1, H('#b8c4cc')); b.rect(13, 7, 1, 4, H('#b8c4cc')); b.rect(11, 10, 3, 1, H('#b8c4cc'));
  b.rect(4, 6, 6, 1, H('#6a8a2a'));
  px(b, [[6, 9], [7, 9], [5, 10], [6, 10], [7, 10], [8, 10], [6, 11], [7, 11]], H('#4f9650'));
  b.set(6, 12, H('#2c6a3b'));
}, b => { wisp(b, 5, 4, 3, '#ffffff', 170); wisp(b, 8, 3, 3, '#ffffff', 140, -1); });

// ================================================================ skill icons
const SKILL: Record<string, IconDef> = {};
const sdef = (id: string, draw: Draw, post?: Draw) => (SKILL[id] = { draw, post, center: true });

sdef('card', map([
  '................',
  '...zzzzzzzz.....',
  '...zhzhzhzzz....',
  '...zhzhzhzzzz...',
  '...zzzzzzzzzz...',
  '...zwwwwwwwwz...',
  '...zwUUUUUUwz...',
  '...zwwwwwwwwz...',
  '...zZZZZZZZZz...',
  '...zZ3ZZZZZZz...',
  '...zZZZZZZZZz...',
  '...zZZZZZZZZz...',
  '...zzzzzzzzzz...',
  '................',
  '................',
  '................',
]));
sdef('lens', b => {
  b.rect(1, 5, 3, 6, P['4']); b.rect(1, 5, 3, 1, P['5']);
  b.rect(4, 4, 8, 8, P['1']); b.rect(4, 4, 8, 1, P['3']);
  for (let x = 5; x < 11; x += 2) b.rect(x, 5, 1, 6, P['2']);
  b.rect(11, 4, 1, 8, P.R);
  b.ellipse(13, 8, 1.6, 4.2, P['2']); b.ellipse(13.3, 8, 1, 3.2, P.U); b.set(13, 6, P.i);
});
sdef('af', b => {
  const g = H('#8fe070'), d = H('#3f8f35');
  for (const [x, y, sx, sy] of [[2, 2, 1, 1], [13, 2, -1, 1], [2, 13, 1, -1], [13, 13, -1, -1]] as number[][]) {
    for (let k = 0; k < 4; k++) { b.set(x + sx * k, y, g); b.set(x, y + sy * k, g); b.set(x + sx * k, y + sy, d); b.set(x + sx, y + sy * k, d); }
  }
  b.disc(8, 8, 1.6, g); b.set(7, 7, P.w);
});
sdef('stab', b => {
  b.rect(4, 6, 8, 6, P['2']); b.rect(4, 6, 8, 1, P['4']); b.rect(6, 5, 3, 1, P['3']);
  b.disc(8, 9, 2, P['1']); b.disc(8, 9, 1.2, P.U); b.set(7, 8, P.i);
}, b => {
  for (const x of [2, 13]) for (let y = 5; y <= 12; y++) b.blend(x + ((y % 2) ? 0 : (x < 8 ? -1 : 1)), y, H('#f4b43c', 230));
});
sdef('af2', b => {
  const a = H('#f4b43c'), d = H('#a86a18');
  for (const [x, y, sx, sy] of [[1, 2, 1, 1], [14, 2, -1, 1], [1, 13, 1, -1], [14, 13, -1, -1]] as number[][]) {
    for (let k = 0; k < 3; k++) { b.set(x + sx * k, y, a); b.set(x, y + sy * k, a); b.set(x + sx * k, y + sy, d); b.set(x + sx, y + sy * k, d); }
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([4 + t * 8, 8 + Math.sin(t * Math.PI * 2) * 2]); }
  b.stroke(pts, t => 1.2 - t * 0.6, () => H('#6fb150'));
  b.disc(12, 7.5, 1.4, H('#6fb150')); b.set(12, 7, P.z);
});
sdef('video', b => {
  b.rect(2, 5, 9, 7, P['2']); b.rect(2, 5, 9, 1, P['4']);
  b.poly([11, 7, 15, 4.5, 15, 12.5, 11, 10], P['3']);
  b.disc(5, 8.5, 1.5, P.R); b.set(4, 8, P.e);
  b.rect(7, 7, 3, 3, P['1']); b.set(8, 8, P.U);
  b.rect(4, 3, 4, 2, P['3']);
});
sdef('lens2', b => {
  b.rect(1, 5, 2, 6, P['4']);
  b.rect(3, 3, 9, 10, H('#e8ecea')); b.rect(3, 3, 9, 2, P.w); b.rect(3, 11, 9, 2, H('#b8c0bc'));
  b.rect(9, 3, 1, 10, P.R);
  b.rect(5, 5, 1, 6, H('#9aa3a5')); b.rect(7, 5, 1, 6, H('#9aa3a5'));
  b.ellipse(13, 8, 1.8, 5, P['2']); b.ellipse(13.3, 8, 1.1, 3.8, P.u); b.set(13, 5, P.i);
});
sdef('shutter', b => {
  b.disc(8, 8, 6.5, P['1']);
  b.discFn(8, 8, 5.4, (x, y, nx, ny) => {
    const a = Math.atan2(ny, nx) + Math.PI;
    const blade = Math.floor((a / (Math.PI * 2)) * 6);
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d < 0.42) return d < 0.25 ? H('#79a9cf') : H('#2c4b80');
    return blade % 2 ? P['3'] : P['4'];
  });
  b.set(7, 7, P.w);
});
sdef('night', b => {
  b.disc(8, 8, 5.5, H('#f8e8a8'));
  b.disc(10.5, 6.5, 4.6, 0);
  b.set(4, 9, H('#d8c880')); b.set(5, 11, H('#d8c880'));
}, b => {
  for (const [x, y] of [[12, 11], [13, 3]] as [number, number][]) { b.blend(x, y, H('#fff8d0', 250)); b.blend(x - 1, y, H('#fff8d0', 120)); b.blend(x + 1, y, H('#fff8d0', 120)); b.blend(x, y - 1, H('#fff8d0', 120)); b.blend(x, y + 1, H('#fff8d0', 120)); }
});
sdef('boot', map([
  '................',
  '................',
  '.....BBBBB......',
  '.....BnhnB......',
  '.....BhnhB......',
  '.....BnhnB......',
  '.....BhnhBB.....',
  '....BBnnnnBB....',
  '....BnnnnnnBB...',
  '...BnnnnnnnnnB..',
  '..BnnnnnnnnnnnB.',
  '..bbbbbbbbbbbbb.',
  '..z.z.z.z.z.z.z.',
  '................',
  '................',
  '................',
], { B: '#5a3a22', n: '#9a6a3e', h: '#e8d8a8', b: '#2a1a10', z: '#1a1210' }));
sdef('lure', b => {
  b.line(8, 0, 8, 4, H('#d8d0c0'));
  b.rect(7, 4, 3, 1, P['4']);
  b.line(9, 5, 9, 11, P['4']); b.line(9, 11, 7, 13, P['4']); b.line(7, 13, 5, 11, P['4']); b.set(5, 10, P['5']);
  b.disc(9, 7.5, 1.9, R_CREAM[3]); b.disc(9, 9.8, 1.7, R_CREAM[2]); b.set(9, 6, H('#8a4a1c'));
});
sdef('eye', b => {
  b.ellipseFn(8, 9, 6.5, 3.4, (x, y, nx, ny) => (Math.sqrt(nx * nx + ny * ny) > 0.82 ? P.z : P.w));
  b.disc(8, 9, 2.3, H('#2f9a8a')); b.disc(8, 9, 1.1, P.z); b.set(7, 8, P.w);
  b.poly([1, 6, 8, 2, 15, 6, 8, 7.5], H('#4f9650'));
  b.line(2, 6, 14, 6, H('#2c6a3b')); b.line(8, 3, 8, 6, H('#9fd46a'));
});
sdef('track', map([
  '................',
  '..........d.d...',
  '.........d...d..',
  '..........ddd...',
  '.........ddddd..',
  '..........ddd...',
  '................',
  '................',
  '...F.F..........',
  '..F...F.........',
  '...FFF..........',
  '..FFFFF.........',
  '...FFF..........',
  '................',
  '................',
  '................',
], { d: '#b89468', F: '#8a6238' }));
sdef('pack', map([
  '................',
  '......BBBB......',
  '.....B....B.....',
  '....AAAAAAAA....',
  '...AmmmmmmmmA...',
  '...AmAAAAAAmA...',
  '...AmAmmmmAmA...',
  '...AmAmdmmAmA...',
  '...AmAAAAAAmA...',
  '...AmmmmmmmmA...',
  '...AaaaaaaaaA...',
  '...AaAAAAAAaA...',
  '...AaAaaaaAaA...',
  '....aaaaaaaa....',
  '................',
  '................',
]));
sdef('pack2', map([
  '................',
  '..q..ssss...q...',
  '..q.sSSSSs..q...',
  '..q.ssssss..q...',
  '..qAAAAAAAAAq...',
  '..AmmmmmmmmmA...',
  '..AmAAAAAAAmA...',
  '..AmAmmdmmAmA...',
  '..AmAAAAAAAmA...',
  '..AmmmmmmmmmA...',
  '..AaaaaaaaaaA...',
  '..AaAAAAAAAaA...',
  '..AaAaaaaaAaA...',
  '..qaaaaaaaaaq...',
  '..q.........q...',
  '................',
], { q: '#c3c6c2', s: '#c9a878', S: '#9c7a55' }));
sdef('hand', map([
  '................',
  '.......ss.......',
  '....ss.sS.ss....',
  '....sS.sS.sS.ss.',
  '....sS.sS.sS.sS.',
  '....sSssSssSssS.',
  '.ss.sssssssssSS.',
  '.sSssssssssssS..',
  '..sSsssssssssS..',
  '...ssssssssSS...',
  '....sssssssS....',
  '.....SSSSSS.....',
  '................',
  '................',
  '................',
  '................',
], { s: '#e4b287', S: '#b8805a' }), b => {
  for (let i = 0; i < 3; i++) { b.blend(0, 9 + i * 2, H('#ffffff', 200)); b.blend(1, 9 + i * 2, H('#ffffff', 120)); }
});
sdef('eye2', b => {
  b.ellipseFn(7, 9, 6, 3.6, (x, y, nx, ny) => (Math.sqrt(nx * nx + ny * ny) > 0.82 ? P.z : P.w));
  b.disc(7, 9, 2.4, H('#d8a02a')); b.disc(7, 9, 1.2, P.z); b.set(6, 8, P.w);
}, b => {
  const s = H('#fff4b0', 250), s2 = H('#fff4b0', 150);
  b.blend(13, 3, s); b.blend(12, 3, s2); b.blend(14, 3, s2); b.blend(13, 2, s2); b.blend(13, 4, s2);
});
sdef('heart', b => {
  b.disc(5.3, 6, 3.5, P.R); b.disc(10.7, 6, 3.5, P.R);
  b.poly([1.9, 7, 14.1, 7, 8, 14.2], P.R);
  b.poly([8, 9.5, 14, 7, 8, 14.2], H('#942522'));
  b.disc(4.6, 4.8, 1.2, P.e);
  b.rect(7, 5, 2, 6, P.w); b.rect(5, 7, 6, 2, P.w); b.rect(8, 6, 1, 5, H('#e0d8d0')); b.rect(6, 8, 5, 1, H('#e0d8d0'));
});
sdef('micro', map([
  '................',
  '......zz........',
  '......23........',
  '......23..2.....',
  '.....2344.2.....',
  '.....2334.2.....',
  '......234.2.....',
  '......23222.....',
  '......UU..2.....',
  '....33333332....',
  '.....44.4.2.....',
  '.......222......',
  '...2222222222...',
  '...1111111111...',
  '................',
  '................',
]));
sdef('clock', b => {
  b.rect(7, 1, 2, 2, P['3']); b.rect(6, 0, 4, 1, P['4']);
  b.disc(8, 9, 6, P['3']); b.disc(8, 9, 5, P.w); b.disc(7.5, 8.5, 4, H('#f4f5ef'));
  b.line(8, 9, 8, 5, P.z); b.line(8, 9, 11, 10, P.R);
  for (const [x, y] of [[8, 4], [13, 9], [8, 14], [3, 9]] as [number, number][]) b.set(x, y, P['3']);
});
sdef('photoid', b => {
  b.rect(1, 2, 11, 10, P.w); b.rect(2, 3, 9, 6, H('#5fa84d')); b.rect(2, 3, 9, 3, H('#9fd0e8'));
  b.line(3, 7, 9, 5, H('#2c6a3b')); b.disc(4, 5, 1, H('#f8e070'));
  b.disc(10.5, 10, 3.2, P['2']); b.disc(10.5, 10, 2.3, H('#bfe4f4')); b.set(9, 9, P.w);
  b.line(12.5, 12.5, 14.5, 14.5, P.b); b.line(13, 12.5, 15, 14.5, P.B);
});
sdef('dna', b => {
  for (let y = 1; y <= 14; y++) {
    const t = (y - 1) / 13 * Math.PI * 2;
    const a = 8 + Math.sin(t) * 4.5, c = 8 - Math.sin(t) * 4.5;
    if (y % 3 === 0) b.line(a, y, c, y, H('#d8d0e8'));
    b.set(a, y, Math.cos(t) > 0 ? H('#3fd1c1') : H('#1a8a80'));
    b.set(c, y, Math.cos(t) > 0 ? H('#9b5cc0') : H('#d68af0'));
  }
});
sdef('chart', b => {
  b.rect(1, 13, 14, 1, P['3']); b.rect(1, 2, 1, 12, P['3']);
  b.rect(3, 8, 3, 5, H('#3fbca6')); b.rect(3, 8, 1, 5, H('#8ff0dc'));
  b.rect(7, 4, 3, 9, H('#f4b43c')); b.rect(7, 4, 1, 9, H('#ffd57a'));
  b.rect(11, 6, 3, 7, H('#e8614a')); b.rect(11, 6, 1, 7, H('#ff9a80'));
});
sdef('grant', b => {
  b.rect(3, 1, 10, 13, P.w); b.rect(3, 1, 10, 1, H('#e8e0c8')); b.rect(12, 1, 1, 13, H('#d8d0b8'));
  for (let y = 3; y < 10; y += 2) b.rect(5, y, y === 3 ? 6 : 5, 1, H('#9aa3a5'));
  b.disc(10, 11.5, 2.4, P.R); b.disc(9.6, 11, 1.2, P.e);
  b.poly([8.5, 13, 9.5, 13, 8.5, 15.5], P.r); b.poly([10.5, 13, 11.5, 13, 11.5, 15.5], P.r);
});

// Icons shared with items
for (const k of ['ghillie', 'caller', 'trap', 'net']) SKILL[k] = ICON[k];
SKILL['glow'] = ICON['glowlure'];

// ================================================================ UI / app glyphs
const UI: Record<string, IconDef> = {};
const udef = (id: string, draw: Draw, post?: Draw, center = true) => (UI[id] = { draw, post, center });

udef('rp', b => {
  b.shadedEllipse(8, 8, 6.4, 6.4, ramp('#8a5f12', '#c08418', '#e8a92a', '#f8cf5a', '#fff0b0'));
  b.disc(8, 8, 4.4, H('#1f6a5e')); b.disc(8, 8, 3.6, H('#2f9a88'));
  b.rect(7, 5, 2, 6, H('#dafff5')); b.rect(6, 5, 4, 1, H('#dafff5'));
  px(b, [[6, 10], [7, 11], [9, 11], [10, 10]], H('#dafff5'));
});
udef('lock', map([
  '................',
  '................',
  '.....333333.....',
  '....33....33....',
  '....3......3....',
  '....3......3....',
  '...YYYYYYYYYY...',
  '...YhhhhhhhhY...',
  '...YhhhzzhhhY...',
  '...YhhhzzhhhY...',
  '...YhhhhzhhhY...',
  '...YyyyyyyyyY...',
  '...yyyyyyyyyy...',
  '................',
  '................',
  '................',
]));
udef('check', map([
  '................',
  '................',
  '................',
  '............ll..',
  '...........llG..',
  '..........llG...',
  '..ll.....llG....',
  '..GllG..llG.....',
  '...GllGllG......',
  '....GlllG.......',
  '.....GlG........',
  '......G.........',
  '................',
  '................',
  '................',
  '................',
], { l: '#8fe070', G: '#3f8f35' }));
udef('star', b => {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? 2.9 : 6.6; pts.push(8 + Math.cos(a) * r, 8.3 + Math.sin(a) * r); }
  b.poly(pts, H('#f4b43c'));
  b.polyFn(pts, (x, y) => (x + y < 14 ? H('#ffd57a') : x > 9 && y > 8 ? H('#d08a1c') : -1));
  b.set(6, 6, P.w);
});
udef('star0', b => {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? 2.9 : 6.6; pts.push(8 + Math.cos(a) * r, 8.3 + Math.sin(a) * r); }
  b.poly(pts, H('#3a4a46'));
  b.polyFn(pts, (x, y) => (x + y < 14 ? H('#4e605a') : -1));
});
udef('photos', b => {
  b.rect(4, 1, 11, 10, H('#e8e0c8'));
  b.rect(1, 4, 11, 11, P.w); b.rect(2, 5, 9, 7, H('#9fd0e8')); b.rect(2, 9, 9, 3, H('#4f9650'));
  b.poly([3, 11, 6, 7, 9, 11], H('#2c6a3b')); b.disc(8.5, 6.8, 1.1, H('#f8e070'));
});
udef('tree', b => {
  const ln = H('#8ff0dc');
  b.line(8, 12, 8, 8, ln); b.line(8, 8, 4, 5, ln); b.line(8, 8, 12, 5, ln); b.line(4, 5, 4, 2, ln); b.line(12, 5, 12, 2, ln);
  b.disc(8, 12.5, 2.2, H('#f4b43c')); b.disc(4, 5, 1.8, H('#3fbca6')); b.disc(12, 5, 1.8, H('#9b7ce0')); b.disc(4, 1.8, 1.5, H('#8db34a')); b.disc(12, 1.8, 1.5, H('#e8614a'));
  b.set(7, 12, P.w);
});
udef('book', map([
  '................',
  '..GGGGGGGGGGGw..',
  '..GlllllllllGw..',
  '..GlGGGYGGGlGw..',
  '..GlGGYhYGGlGw..',
  '..GlGYhYhYGlGw..',
  '..GlGGYhYGGlGw..',
  '..GlGYhYhYGlGw..',
  '..GlGGYhYGGlGw..',
  '..GlGGGhGGGlGw..',
  '..GlGGGYGGGlGw..',
  '..GlllllllllGw..',
  '..GGGGGGGGGGGw..',
  '..gRgggggggggW..',
  '...R............',
  '................',
], { G: '#2f6a3a', l: '#4f9650', g: '#1d4a2a' }));
udef('notes', b => {
  b.rect(2, 2, 10, 13, H('#f8e89a')); b.rect(2, 2, 10, 2, H('#e8614a'));
  for (let y = 6; y < 14; y += 2) b.rect(3, y, 8, 1, H('#c8b86a'));
  b.line(9, 12, 14, 3, H('#f4b43c')); b.line(10, 12, 15, 3, H('#c08418'));
  b.set(9, 13, P.z); b.set(14, 2, H('#f59aa4')); b.set(15, 2, H('#f59aa4'));
});
udef('readme', b => {
  b.poly([3, 1, 10, 1, 13, 4, 13, 15, 3, 15], P.w);
  b.poly([10, 1, 13, 4, 10, 4], H('#c8ccd0'));
  for (let y = 6; y < 14; y += 2) b.rect(5, y, y === 12 ? 4 : 6, 1, H('#8a949c'));
});
udef('bin', map([
  '................',
  '......3333......',
  '...4444444444...',
  '...3333333333...',
  '....44344344....',
  '....43343343....',
  '....43343343....',
  '....43343343....',
  '....43343343....',
  '....43343343....',
  '....43343343....',
  '....33333333....',
  '................',
  '................',
  '................',
  '................',
]));
udef('clue', b => {
  b.disc(6.5, 6.5, 5, P['2']); b.disc(6.5, 6.5, 3.8, H('#bfe4f4')); b.disc(5.5, 5.5, 1.5, P.w);
  b.line(10, 10, 14, 14, P.b); b.line(10, 11, 13, 14, P.B); b.line(11, 10, 14, 13, P.n);
});
udef('question', map([
  '................',
  '.....YYYYY......',
  '....YhhhhhY.....',
  '....Yh...hY.....',
  '.........hY.....',
  '........hY......',
  '.......hY.......',
  '......hY........',
  '......hY........',
  '................',
  '......hY........',
  '......YY........',
  '................',
  '................',
  '................',
  '................',
]));
udef('battery', map([
  '................',
  '................',
  '................',
  '................',
  '..wwwwwwwwwwww..',
  '..w..........ww.',
  '..w.llllllll.ww.',
  '..w.llllllll.ww.',
  '..w..........ww.',
  '..wwwwwwwwwwww..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], { l: '#8fe070' }));
udef('bolt', map([
  '................',
  '.........hY.....',
  '........hY......',
  '.......hY.......',
  '......hhhhY.....',
  '........hY......',
  '.......hY.......',
  '......hY........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]));

// ---------------------------------------------------------------- rendering

function build(d: IconDef | undefined): PixelBuffer {
  const src = new PixelBuffer(16, 16);
  const out = new PixelBuffer(16, 16);
  if (!d) {
    UI.question.draw(src);
    d = UI.question;
  } else d.draw(src);
  // centre the painted art (1px margin for the outline)
  let ox = 0, oy = 0;
  if (d.center !== false) {
    const t = src.trim(0);
    if (t.buf.w > 1 || t.buf.h > 1) {
      const w = t.buf.w, h = t.buf.h;
      const nx = Math.max(1, Math.min(15 - w, Math.floor((16 - w) / 2)));
      const ny = Math.max(1, Math.min(15 - h, Math.round((16 - h) / 2)));
      ox = nx - t.ox; oy = ny - t.oy;
      if (w > 14) ox = -t.ox + Math.floor((16 - w) / 2);
      if (h > 14) oy = -t.oy + Math.floor((16 - h) / 2);
    }
  }
  out.blit(src, ox, oy, false, false);
  out.outline(OUTLINE);
  if (d.post) {
    const p = new PixelBuffer(16, 16);
    d.post(p);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = p.get(x - ox, y - oy);
      if (c >>> 24) out.blend(x, y, c);
    }
  }
  return out;
}

const bufCache = new Map<string, PixelBuffer>();
const urlCache = new Map<string, string>();
function cached(key: string, d: IconDef | undefined) {
  let b = bufCache.get(key);
  if (!b) { b = build(d); bufCache.set(key, b); }
  return b;
}
function url(key: string, d: IconDef | undefined, scale: number) {
  const k = key + '@' + scale;
  let u = urlCache.get(k);
  if (!u) {
    try { u = cached(key, d).toDataURL(scale); } catch { u = ''; }
    urlCache.set(k, u);
  }
  return u;
}

/** 16x16 pixel icon for an item id (a '?' glyph for unknown ids). */
export function itemIcon(id: string): PixelBuffer {
  return cached('i:' + id, ICON[id]);
}
/** Cached data URL of an item icon (default scale 3 = 48px). */
export function itemIconURL(id: string, scale = 3): string {
  return url('i:' + id, ICON[id], scale);
}
/** Cached data URL of a skill icon, named in SKILLS[].icon. */
export function skillIconURL(icon: string, scale = 3): string {
  return url('s:' + icon, SKILL[icon] ?? ICON[icon], scale);
}
/** UI glyphs: rp, lock, check, star, star0, photos, tree, book, notes, readme, bin, clue, question, battery, bolt. */
export function uiIconURL(name: string, scale = 3): string {
  return url('u:' + name, UI[name] ?? SKILL[name] ?? ICON[name], scale);
}
export function uiIcon(name: string): PixelBuffer {
  return cached('u:' + name, UI[name] ?? SKILL[name] ?? ICON[name]);
}
export function skillIcon(icon: string): PixelBuffer {
  return cached('s:' + icon, SKILL[icon] ?? ICON[icon]);
}
/** Ids with a hand-made icon (for galleries / tests). */
export const ICON_IDS = { items: () => Object.keys(ICON), skills: () => Object.keys(SKILL), ui: () => Object.keys(UI) };
