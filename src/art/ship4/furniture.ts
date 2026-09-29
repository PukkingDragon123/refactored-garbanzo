// Ship furniture and fittings for the V4 Kittiwake. Each painter returns an outlined sprite buffer
// sized for the ~58 px anime cast. Colours are mid-dark so the scene lighting (dim warm lamps,
// window light) does the mood; emissive bits (bulbs, screens, tank light) come back as `glow`.

import { PixelBuffer } from '../pixel';
import { Obj, obj, P, T, Tone, hex, mix, shade, C, rng } from './kit';

export interface Sp { buf: PixelBuffer; glow?: PixelBuffer }

/** paint a glow buffer the same size as an object buffer (for bulbs / screens) */
function glowOf(w: number, h: number, draw: (o: Obj) => void): PixelBuffer {
  const g = new Obj(w + 2, h + 2);
  const inner = new Obj(w, h);
  draw(inner);
  g.put(inner.b, 1, 1);
  return g.b;
}

// ------------------------------------------------------------------ windows & lights

export function porthole(r = 7, sky = '#8ab8d0'): Sp {
  const d = r * 2 + 1;
  const glass = T(sky, { sh: 0.12, hi: 0.18 });
  const buf = obj(d, d, o => {
    o.ell(r + 0.5, r + 0.5, r + 0.5, r + 0.5, (nx, ny) => {
      const rr = Math.hypot(nx, ny);
      if (rr > 0.7) return (-nx - ny) > 0.3 ? P.brass[3] : (-nx - ny) > -0.5 ? P.brass[2] : P.brass[1];
      // glass with a sky gradient and a diagonal glint
      if (Math.abs(nx + ny + 0.3) < 0.12 && rr < 0.6) return glass[3];
      return ny < -0.1 ? glass[2] : glass[1];
    });
    // rivets
    for (let a = 0; a < 8; a++) o.px(r + Math.round(Math.cos(a * 0.785) * (r - 0.6)), r + Math.round(Math.sin(a * 0.785) * (r - 0.6)), P.brass[0]);
  });
  const glow = glowOf(d, d, o => o.ell(r + 0.5, r + 0.5, r * 0.62, r * 0.62, (nx, ny) => (ny < 0 ? hex('#6a90a8') : hex('#3a5a70'))));
  return { buf, glow };
}

export function windowRect(w: number, h: number, o2: { curtain?: Tone; sky?: string; mullion?: boolean } = {}): Sp {
  const glass = T(o2.sky ?? '#8ab8d0', { sh: 0.14, hi: 0.2 });
  const buf = obj(w, h, o => {
    o.box(0, 0, w, h, P.plankD);
    o.rect(2, 2, w - 4, h - 4, (x, y) => {
      if (Math.abs(x - y * 0.8 - 3) < 1.2 && y < h * 0.6) return glass[3];
      return y < (h - 4) * 0.5 ? glass[2] : glass[1];
    });
    if (o2.mullion) { o.vline(Math.floor(w / 2), 2, h - 3, P.plankD[1]); o.hline(2, w - 3, Math.floor(h / 2), P.plankD[1]); }
    if (o2.curtain) {
      const c = o2.curtain;
      o.rect(0, 0, 4, h, (x, y) => (x === 3 ? c[1] : (y % 5 === 0 ? c[1] : c[2])));
      o.rect(w - 4, 0, 4, h, (x, y) => (x === 0 ? c[1] : (y % 5 === 0 ? c[1] : c[2])));
      o.hline(0, w - 1, 0, c[0]);
    }
  });
  const glow = glowOf(w, h, o => o.rect(2, 2, w - 4, h - 4, (x, y) => (y < (h - 4) * 0.5 ? hex('#5a8098') : hex('#3a5a70'))));
  return { buf, glow };
}

/** hanging bulb lamp with a brass shade; cord length in px */
export function hangLamp(cord = 8, shadeT: Tone = P.brass): Sp {
  const w = 11, h = cord + 10;
  const buf = obj(w, h, o => {
    o.vline(5, 0, cord, hex('#2a2024'));
    o.poly([1, cord + 6, 3, cord + 1, 8, cord + 1, 10, cord + 6], (x, y) => (x < 4 ? shadeT[3] : x > 7 ? shadeT[1] : shadeT[2]));
    o.hline(1, 9, cord + 6, shadeT[0]);
    o.ell(5.5, cord + 7.6, 2.2, 1.8, hex('#fff0b8'));
  });
  const glow = glowOf(w, h, o => o.ell(5.5, cord + 7.6, 2.6, 2.1, hex('#ffe8a0')));
  return { buf, glow };
}

export function wallLamp(): Sp {
  const buf = obj(9, 11, o => {
    o.rect(3, 6, 3, 5, P.brass[1]);
    o.poly([0, 6, 2, 0, 7, 0, 9, 6], (x) => (x < 3 ? P.cream[3] : x > 6 ? P.cream[1] : P.cream[2]));
    o.hline(1, 7, 6, P.brass[0]);
  });
  const glow = glowOf(9, 11, o => o.poly([1, 6, 2.5, 1, 6.5, 1, 8, 6], hex('#ffe0a0')));
  return { buf, glow };
}

// ------------------------------------------------------------------ beds & soft things

export function bunk(w: number, blanket: Tone, o2: { pillow?: Tone; plaid?: Tone; stripes?: boolean; plush?: Tone[] } = {}): PixelBuffer {
  const h = 20;
  return obj(w, h, o => {
    // wooden frame with a rail
    o.box(0, 12, w, 8, P.plank);
    o.rect(0, 0, 3, h, (x) => (x === 0 ? P.plank[3] : P.plank[1]));
    o.rect(w - 3, 0, 3, h, (x) => (x === 2 ? P.plank[0] : P.plank[1]));
    // mattress + blanket
    o.rect(3, 8, w - 6, 5, P.white[2]);
    o.rect(3, 12, w - 6, 1, P.white[1]);
    const bx = 14;
    o.rect(bx, 6, w - 3 - bx, 7, (x, y) => {
      if (o2.plaid) { const p = o2.plaid; const on = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0; if (x % 6 === 0 || y === 3) return p[1]; return on ? blanket[2] : blanket[1]; }
      if (o2.stripes && Math.floor(x / 4) % 2 === 0) return blanket[1];
      return y === 0 ? blanket[3] : y > 4 ? blanket[1] : blanket[2];
    });
    // blanket fold
    o.rect(bx, 6, 4, 7, (x, y) => (x === 3 ? blanket[0] : y === 0 ? blanket[3] : blanket[2]));
    // pillow
    const pl = o2.pillow ?? P.white;
    o.ell(8, 7.5, 5, 2.8, (nx, ny) => (ny < -0.2 ? pl[3] : ny > 0.5 ? pl[1] : pl[2]));
    // plushies sitting on the bed
    (o2.plush ?? []).forEach((c, i) => {
      const x = w - 12 - i * 8;
      o.ball(x, 3.5, 3.2, 3, c);
      o.px(x - 1, 3, P.black[0]); o.px(x + 1, 3, P.black[0]);
      o.px(x - 2, 0, c[2]); o.px(x + 2, 0, c[2]);
    });
  });
}

export function dogBed(): PixelBuffer {
  return obj(26, 10, o => {
    o.ell(13, 6, 13, 4.5, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? (ny < 0 ? P.red[3] : P.red[1]) : ny < 0.2 ? P.white[1] : P.white[2]));
    o.ell(13, 5, 8.4, 2.2, P.white[2]);
    // paw print on the side
    o.px(20, 8, P.red[0]); o.px(21, 7, P.red[0]); o.px(22, 8, P.red[0]); o.px(21, 9, P.red[0]);
  });
}

export function dogBowl(food = true): PixelBuffer {
  return obj(9, 4, o => {
    o.rect(0, 1, 9, 3, (x, y) => (y === 2 ? P.steel[1] : P.steel[2]));
    o.hline(1, 7, 3, P.steel[0]);
    if (food) o.hline(1, 7, 0, hex('#8a5a34'));
    else o.hline(1, 7, 0, hex('#6ab0d0'));
  });
}

export function rug(w: number, t: Tone, border: Tone): PixelBuffer {
  return obj(w, 3, o => {
    o.rect(0, 0, w, 3, (x, y) => (x < 2 || x >= w - 2 ? border[2] : y === 1 && x % 4 < 2 ? border[2] : t[2]));
    o.hline(0, w - 1, 2, t[1]);
  });
}

// ------------------------------------------------------------------ storage

export function shelf(w: number, seed: number, kind: 'books' | 'jars' | 'mixed' | 'tins' = 'books'): PixelBuffer {
  const R = rng(seed);
  const h = 13;
  const books = [P.red, P.navy, P.green, P.olive, P.brass, P.teal, P.orange, P.cream];
  return obj(w, h, o => {
    o.box(0, 10, w, 3, P.plank);
    let x = 1;
    while (x < w - 2) {
      const r = R();
      const pick = kind === 'mixed' ? (r < 0.6 ? 'book' : r < 0.8 ? 'jar' : 'box') : kind === 'books' ? (r < 0.92 ? 'book' : 'gap') : kind === 'tins' ? 'tin' : 'jar';
      if (pick === 'book') {
        const bw = 2 + Math.floor(R() * 2), bh = 6 + Math.floor(R() * 4);
        const t = books[Math.floor(R() * books.length)];
        const lean = R() < 0.12;
        o.rect(x, 10 - bh, bw, bh, (i, j) => (i === 0 ? t[3] : j === 1 ? t[1] : t[2]));
        if (lean) o.px(x + bw, 10 - bh + 1, t[1]);
        x += bw;
      } else if (pick === 'jar') {
        const c = [P.glass, P.green, P.yellow, P.teal][Math.floor(R() * 4)];
        o.rect(x, 4, 4, 6, (i, j) => (j === 0 ? P.brass[2] : i === 0 ? c[3] : c[2]));
        o.px(x + 1, 6, hex('#e8f4f0'));
        x += 5;
      } else if (pick === 'tin') {
        const c = [P.red, P.blue, P.yellow, P.green][Math.floor(R() * 4)];
        o.rect(x, 5, 4, 5, (i, j) => (j === 0 || j === 4 ? P.steel[3] : i === 3 ? c[1] : c[2]));
        x += 5;
      } else if (pick === 'box') {
        o.box(x, 5, 6, 5, P.canvas);
        x += 7;
      } else x += 2;
    }
  });
}

export function crate(w = 18, h = 16, t: Tone = P.plank, stencil = false): PixelBuffer {
  return obj(w, h, o => {
    o.box(0, 0, w, h, t);
    o.rect(2, 2, w - 4, h - 4, (x, y) => (Math.abs(x - y * ((w - 4) / (h - 4))) < 1.1 ? t[1] : t[2]));
    o.hline(0, w - 1, 0, t[3]);
    o.hline(0, w - 1, 2, t[1]);
    o.hline(0, w - 1, h - 3, t[1]);
    if (stencil) { o.rect(4, Math.floor(h / 2) - 1, w - 8, 2, (x) => (x % 3 === 2 ? -1 : t[0])); }
  });
}

export function barrel(h = 20): PixelBuffer {
  const w = 14;
  return obj(w, h, o => {
    o.rect(0, 0, w, h, (x, y) => {
      const t = P.plank;
      const bulge = Math.abs(x - w / 2 + 0.5) / (w / 2);
      if (y === 2 || y === h - 3 || y === Math.floor(h / 2)) return P.steel[1];
      return bulge > 0.75 ? t[1] : x < w / 2 - 2 ? t[3] : t[2];
    });
    o.hline(1, w - 2, 0, P.plank[1]);
  });
}

export function sack(): PixelBuffer {
  return obj(14, 13, o => {
    o.poly([1, 13, 0, 7, 3, 2, 5, 0, 9, 0, 11, 2, 14, 7, 13, 13], (x, y) => (x > 10 ? P.canvas[1] : y < 3 ? P.canvas[3] : P.canvas[2]));
    o.hline(5, 9, 1, P.rope[1]);
  });
}

export function net(w: number, h: number): PixelBuffer {
  return obj(w, h, o => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const drape = Math.sin((x / w) * Math.PI) * 3;
      if ((x + Math.floor(y + drape)) % 4 === 0 || (x - Math.floor(y + drape) + 400) % 4 === 0) o.px(x, y, y < 2 ? P.rope[3] : P.rope[1]);
    }
    for (let x = 0; x < w; x += 6) o.ell(x + 2, h - 2, 1.6, 1.6, P.orange[2]);
  }, false);
}

// ------------------------------------------------------------------ furniture

export function desk(w: number, t: Tone = P.plank): PixelBuffer {
  return obj(w, 18, o => {
    o.box(0, 0, w, 3, t);
    o.rect(1, 3, 3, 15, (x) => (x === 0 ? t[2] : t[1]));
    o.rect(w - 12, 3, 11, 12, (x, y) => (y === 5 ? t[0] : x === 10 ? t[1] : t[2]));
    o.px(w - 7, 2 + 4, P.brass[2]); o.px(w - 7, 3 + 9, P.brass[2]);
    o.rect(w - 4, 15, 3, 3, t[1]);
  });
}

export function chair(t: Tone = P.plank): PixelBuffer {
  return obj(12, 24, o => {
    o.rect(0, 0, 3, 24, (x) => (x === 0 ? t[3] : t[1]));
    o.box(0, 12, 12, 3, t);
    o.rect(9, 15, 2, 9, t[1]);
    o.rect(2, 15, 2, 9, t[2]);
    o.rect(1, 2, 2, 8, (x, y) => (y % 3 === 0 ? t[0] : t[2]));
  });
}

export function stool(): PixelBuffer {
  return obj(12, 14, o => {
    o.box(0, 0, 12, 3, P.plank);
    o.line(2, 3, 0, 13, P.plank[1]); o.line(9, 3, 11, 13, P.plank[1]); o.line(5, 3, 5, 13, P.plank[2]);
    o.hline(2, 9, 9, P.plank[1]);
  });
}

export function table(w: number, h = 20, t: Tone = P.plank): PixelBuffer {
  return obj(w, h, o => {
    o.box(0, 0, w, 4, t);
    o.rect(3, 4, 3, h - 4, (x) => (x === 0 ? t[2] : t[1]));
    o.rect(w - 6, 4, 3, h - 4, (x) => (x === 2 ? t[0] : t[1]));
    o.hline(3, w - 4, 7, t[1]);
  });
}

export function bench(w: number): PixelBuffer {
  return obj(w, 12, o => {
    o.box(0, 0, w, 3, P.plank);
    o.rect(2, 3, 2, 9, P.plank[1]);
    o.rect(w - 4, 3, 2, 9, P.plank[1]);
    o.rect(0, 0, w, 1, P.plank[3]);
  });
}

export function chessBoard(): PixelBuffer {
  // tabletop chessboard mid-game, seen slightly from above
  return obj(18, 7, o => {
    o.rect(0, 4, 18, 3, P.plankD[1]);
    o.rect(1, 3, 16, 2, (x) => ((x >> 1) % 2 ? P.cream[3] : P.plankD[2]));
    const pc = (x: number, h: number, c: C) => { o.vline(x, 3 - h, 2, c); o.px(x, 3 - h - 1, c); };
    pc(2, 2, hex('#f4ecdc')); pc(4, 1, hex('#f4ecdc')); pc(7, 3, hex('#f4ecdc'));
    pc(11, 2, hex('#2a2024')); pc(13, 3, hex('#2a2024')); pc(15, 1, hex('#2a2024'));
  });
}

export function bookcase(w: number, h: number, seed: number): PixelBuffer {
  const shelves = Math.floor((h - 4) / 13);
  return obj(w, h, o => {
    o.box(0, 0, w, h, P.plankD);
    o.rect(2, 2, w - 4, h - 4, P.plankD[0]);
    for (let i = 0; i < shelves; i++) o.put(shelf(w - 6, seed + i * 7, i % 3 === 2 ? 'mixed' : 'books'), 2, 2 + i * 13);
  });
}

export function cupboard(w: number, h: number, t: Tone = P.cream): PixelBuffer {
  return obj(w, h, o => {
    o.box(0, 0, w, h, t);
    const n = Math.max(1, Math.round(w / 14));
    for (let i = 0; i < n; i++) {
      const x0 = 2 + Math.floor((i * (w - 4)) / n), x1 = 2 + Math.floor(((i + 1) * (w - 4)) / n) - 2;
      o.rect(x0, 2, x1 - x0, h - 4, (x, y) => (x === 0 || y === 0 ? t[3] : x === x1 - x0 - 1 || y === h - 5 ? t[1] : t[2]));
      o.px(i % 2 ? x0 + 1 : x1 - 2, Math.floor(h / 2), P.brass[2]);
    }
  });
}

export function counter(w: number, sink = false): PixelBuffer {
  return obj(w, 24, o => {
    o.box(0, 0, w, 3, P.white);
    o.put(cupboard(w - 2, 20, P.navy), 0, 3);
    if (sink) {
      o.rect(Math.floor(w / 2) - 6, 0, 12, 2, P.steel[0]);
      o.rect(Math.floor(w / 2) + 3, -1, 2, 1, P.steel[2]);
    }
  });
}

export function stove(): Sp {
  const buf = obj(24, 28, o => {
    o.box(0, 6, 24, 22, P.dark);
    o.rect(3, 12, 18, 11, (x, y) => (y === 0 ? P.black[0] : x === 17 ? P.dark[0] : P.black[2]));
    o.hline(5, 18, 14, P.steel[3]);
    o.box(0, 4, 24, 3, P.steel);
    for (const x of [3, 9, 15, 21]) o.px(x, 8, P.brass[2]);
    // pot on the burner
    o.box(3, 0, 10, 5, P.steel);
    o.hline(2, 13, 0, P.steel[0]);
    o.rect(15, 1, 7, 3, (x) => (x === 6 ? P.dark[0] : P.dark[2]));
    o.hline(21, 23, 2, P.dark[1]);
  });
  const glow = glowOf(24, 28, o => { o.rect(4, 19, 16, 3, (x) => (x % 3 === 0 ? hex('#ff9040') : hex('#c8401a'))); });
  return { buf, glow };
}

export function fridge(): PixelBuffer {
  return obj(18, 38, o => {
    o.box(0, 0, 18, 38, P.white);
    o.hline(1, 16, 13, P.white[0]);
    o.rect(14, 4, 2, 6, P.steel[2]);
    o.rect(14, 17, 2, 8, P.steel[2]);
    // magnets and a photo
    o.rect(3, 18, 5, 6, P.paper[2]); o.rect(4, 19, 3, 3, P.teal[2]);
    o.px(10, 20, P.red[2]); o.px(6, 28, P.yellow[2]); o.px(9, 6, P.blue[2]);
  });
}

export function pansRail(w: number): PixelBuffer {
  return obj(w, 16, o => {
    o.hline(0, w - 1, 1, P.brass[1]);
    let x = 2, i = 0;
    while (x < w - 6) {
      const k = i % 3;
      o.vline(x + 2, 2, 4, P.dark[1]);
      if (k === 0) { o.ball(x + 2.5, 9, 3.4, 3.4, P.dark); o.vline(x + 2, 4, 6, P.dark[1]); }
      else if (k === 1) { o.rect(x + 1, 4, 3, 9, (xx) => (xx === 0 ? P.steel[3] : P.steel[2])); o.ell(x + 2.5, 13, 2, 1.6, P.steel[2]); }
      else { o.vline(x + 2, 4, 11, P.plank[2]); o.ell(x + 2.5, 12, 1.4, 2.2, P.plank[2]); }
      x += 7; i++;
    }
  });
}

export function noodleStash(): PixelBuffer {
  // a tower of instant noodle cups (Mori's breakfast supply)
  return obj(14, 15, o => {
    const cup = (x: number, y: number) => {
      o.rect(x, y, 5, 5, (i, j) => (j === 0 ? P.yellow[2] : j === 2 ? P.red[2] : i === 4 ? P.white[1] : P.white[2]));
    };
    cup(0, 10); cup(5, 10); cup(2, 5); cup(7, 5); cup(4, 0);
  });
}

export function plant(h = 14, pot: Tone = P.rust): PixelBuffer {
  return obj(14, h, o => {
    o.poly([3, h - 6, 11, h - 6, 10, h, 4, h], (x) => (x < 6 ? pot[3] : x > 8 ? pot[1] : pot[2]));
    const L = P.leaf;
    for (const [dx, dy, a] of [[-4, -9, -0.6], [3, -10, 0.5], [-1, -12, -0.1], [5, -6, 0.9], [-6, -5, -1]] as const) {
      const cx = 7 + dx * 0.5, cy = h - 6 + dy * 0.5;
      o.ell(cx + Math.sin(a) * 2, cy, 2.2, 3.4, (nx, ny) => (nx < -0.2 ? L[3] : ny > 0.4 ? L[1] : L[2]));
    }
  });
}

export function clock(): PixelBuffer {
  return obj(11, 11, o => {
    o.ell(5.5, 5.5, 5.5, 5.5, (nx, ny) => (Math.hypot(nx, ny) > 0.74 ? P.brass[2] : P.white[3]));
    o.vline(5, 2, 5, P.black[0]); o.hline(5, 7, 5, P.black[0]);
  });
}

export function lifeRing(): PixelBuffer {
  return obj(15, 15, o => {
    o.ell(7.5, 7.5, 7.5, 7.5, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r < 0.45) return -1;
      const a = Math.atan2(ny, nx);
      const seg = Math.floor((a + Math.PI) / (Math.PI / 2));
      return seg % 2 ? (ny < 0 ? P.red[3] : P.red[2]) : (ny < 0 ? P.white[3] : P.white[2]);
    });
  });
}

export function ropeCoil(): PixelBuffer {
  return obj(16, 7, o => {
    for (let i = 0; i < 3; i++) o.ell(8, 4 - i * 1.2, 8 - i * 1.5, 3 - i * 0.4, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? (ny < 0 ? P.rope[3] : P.rope[1]) : -1));
  });
}

export function poster(kind: 'whale' | 'birds' | 'anime' | 'map' | 'fish' | 'band' | 'chart' | 'code', w = 16, h = 20): PixelBuffer {
  return obj(w, h, o => {
    const paper = kind === 'anime' || kind === 'code' || kind === 'band' ? P.dark : P.paper;
    o.box(0, 0, w, h, paper, { top: false });
    if (kind === 'whale') {
      o.rect(1, 1, w - 2, h - 2, P.navy[2]);
      o.ell(w / 2, h / 2 + 1, w * 0.38, 3.2, (nx, ny) => (ny < 0 ? P.blue[3] : P.blue[1]));
      o.px(w / 2 + w * 0.3, h / 2, P.white[3]);
      o.poly([2, h / 2 - 1, 5, h / 2 + 1, 2, h / 2 + 3], P.blue[2]);
      o.hline(2, w - 3, h - 3, P.white[2]);
    } else if (kind === 'birds') {
      for (let i = 0; i < 6; i++) { const x = 3 + (i % 3) * 5, y = 3 + Math.floor(i / 3) * 8; o.ell(x, y + 2, 2, 1.5, [P.red, P.blue, P.yellow, P.green, P.orange, P.teal][i][2]); o.px(x + 2, y + 1, P.black[0]); o.hline(x - 2, x + 2, y + 5, P.plankD[1]); }
    } else if (kind === 'anime') {
      o.rect(1, 1, w - 2, h - 2, (x, y) => (y < h / 2 ? P.pink[1] : P.lav[1]));
      o.ell(w / 2, h / 2 - 1, 4, 4.4, P.pink[3]);
      o.ell(w / 2, h / 2 + 1, 2.6, 3, P.fawn[3]);
      o.px(w / 2 - 1, h / 2, P.black[0]); o.px(w / 2 + 1, h / 2, P.black[0]);
      o.hline(2, w - 3, h - 3, P.yellow[2]);
      o.px(3, 3, P.white[3]); o.px(w - 4, 5, P.white[3]);
    } else if (kind === 'map') {
      o.rect(1, 1, w - 2, h - 2, P.paper[2]);
      o.poly([4, 6, 9, 4, 12, 8, 10, 13, 5, 12], P.green[2]);
      o.px(9, 8, P.red[2]); o.line(3, h - 4, w - 4, 3, P.plankD[1]);
    } else if (kind === 'fish') {
      for (let i = 0; i < 4; i++) { const y = 3 + i * 4; o.ell(w / 2, y + 1, 5 - i * 0.6, 1.4, [P.teal, P.orange, P.blue, P.yellow][i][2]); o.px(w / 2 - 6 + i, y + 1, P.plankD[1]); }
    } else if (kind === 'band') {
      o.rect(1, 1, w - 2, h - 2, P.black[1]);
      o.hline(2, w - 3, 3, P.pink[2]); o.hline(2, w - 5, 5, P.teal[2]);
      o.ell(w / 2, h / 2 + 3, 4, 4, P.pink[2]);
      o.ell(w / 2, h / 2 + 3, 1.6, 1.6, P.black[0]);
    } else if (kind === 'chart') {
      o.rect(1, 1, w - 2, h - 2, P.paper[3]);
      for (let i = 0; i < 5; i++) o.hline(2, 2 + (i * 7) % (w - 4), 3 + i * 3, P.blue[1]);
      o.line(2, h - 3, w - 3, 5, P.red[2]);
    } else if (kind === 'code') {
      o.rect(1, 1, w - 2, h - 2, P.black[1]);
      for (let i = 0; i < 6; i++) o.hline(2 + (i % 3), 2 + (i % 3) + 3 + ((i * 5) % 7), 3 + i * 2, i % 2 ? P.teal[3] : P.pink[3]);
    }
  });
}

export function photos(w: number, seed: number): PixelBuffer {
  // a corkboard with pinned photos and notes
  const R = rng(seed);
  const h = 20;
  return obj(w, h, o => {
    o.box(0, 0, w, h, T('#a87a4a'));
    o.rect(1, 1, w - 2, h - 2, (x, y) => ((x * 7 + y * 13) % 5 === 0 ? hex('#8a5e36') : hex('#a87a4a')));
    let x = 2;
    while (x < w - 7) {
      const y = 2 + Math.floor(R() * 7);
      const photo = R() < 0.6;
      const pw = photo ? 7 : 6, ph = photo ? 6 : 6;
      o.rect(x, y, pw, ph, P.white[3]);
      if (photo) o.rect(x + 1, y + 1, pw - 2, ph - 3, [P.teal, P.green, P.blue, P.orange][Math.floor(R() * 4)][1]);
      else for (let k = 0; k < 3; k++) o.hline(x + 1, x + 4, y + 1 + k * 2, P.plankD[1]);
      o.px(x + Math.floor(pw / 2), y, P.red[2]);
      x += pw + 1 + Math.floor(R() * 2);
    }
  });
}

export function frame(w: number, h: number, inner: (o: Obj) => void): PixelBuffer {
  return obj(w, h, o => {
    o.box(0, 0, w, h, P.brass);
    const io = new Obj(w - 4, h - 4);
    inner(io);
    o.put(io.b, 2, 2);
  });
}

export function coatHook(coat: Tone): PixelBuffer {
  return obj(12, 30, o => {
    o.hline(0, 11, 0, P.plank[1]);
    o.px(6, 1, P.brass[2]);
    o.poly([2, 3, 10, 3, 12, 28, 0, 28], (x, y) => (x < 4 ? coat[3] : x > 8 ? coat[1] : y > 24 ? coat[1] : coat[2]));
    o.vline(6, 4, 27, coat[0]);
  });
}

export function seaChest(): PixelBuffer {
  return obj(26, 14, o => {
    o.box(0, 3, 26, 11, P.plank);
    o.ell(13, 3.5, 13, 3.4, (nx, ny) => (ny < -0.3 ? P.plank[3] : P.plank[2]));
    for (const x of [4, 21]) o.vline(x, 1, 13, P.brass[1]);
    o.rect(11, 6, 4, 4, P.brass[2]);
  });
}

export function modelShip(): PixelBuffer {
  return obj(26, 20, o => {
    o.box(0, 16, 26, 4, P.plankD);
    o.rect(1, 2, 24, 14, (x, y) => (x === 0 || y === 0 ? hex('#a8c8d8') : hex('#6a8a9a')));
    o.poly([4, 12, 22, 12, 19, 15, 7, 15], P.red[2]);
    o.vline(12, 4, 12, P.plank[1]);
    o.poly([13, 5, 18, 10, 13, 10], P.white[3]);
    o.poly([11, 6, 11, 11, 7, 11], P.white[2]);
  });
}

export function globe(): PixelBuffer {
  return obj(12, 16, o => {
    o.rect(4, 13, 4, 3, P.plankD[2]);
    o.vline(6, 11, 13, P.brass[1]);
    o.ball(6, 6, 5.5, 5.5, P.blue);
    o.ell(4.6, 5, 2, 2.6, P.green[2]);
    o.px(8, 8, P.green[2]); o.px(9, 7, P.green[2]);
  });
}

export function fishTrophy(): PixelBuffer {
  return obj(26, 12, o => {
    o.box(0, 0, 26, 12, P.plankD);
    o.ell(12, 6, 9, 3.4, (nx, ny) => (ny < -0.3 ? P.teal[3] : ny > 0.4 ? P.white[2] : P.teal[2]));
    o.poly([20, 6, 25, 2, 25, 10], P.teal[1]);
    o.px(6, 5, P.black[0]); o.hline(4, 6, 7, P.teal[0]);
  });
}

// ------------------------------------------------------------------ lab & tech

export function monitor(w = 14, h = 10, screen = '#4ac8e8'): Sp {
  const buf = obj(w, h + 4, o => {
    o.box(0, 0, w, h, P.black);
    o.rect(1, 1, w - 2, h - 2, hex(screen));
    o.rect(Math.floor(w / 2) - 1, h, 3, 3, P.black[1]);
    o.hline(Math.floor(w / 2) - 3, Math.floor(w / 2) + 3, h + 3, P.black[1]);
  });
  const glow = glowOf(w, h + 4, o => {
    const c = hex(screen);
    o.rect(1, 1, w - 2, h - 2, (x, y) => (y % 2 === 0 && x > 1 && x < w - 4 && (x + y) % 5 ? mix(c, hex('#ffffff'), 0.3) : c));
  });
  return { buf, glow };
}

export function laptop(open = true): Sp {
  const buf = obj(14, 9, o => {
    o.rect(0, 7, 14, 2, (x) => (x === 0 ? P.steel[3] : P.steel[2]));
    if (open) { o.poly([2, 7, 3, 0, 12, 0, 12, 7], P.steel[1]); o.rect(4, 1, 7, 5, hex('#4a8a6a')); }
  });
  const glow = glowOf(14, 9, o => { if (open) o.rect(4, 1, 7, 5, (x, y) => (y === 2 ? hex('#8ad8a0') : hex('#3a8a5a'))); });
  return { buf, glow };
}

export function microscope(): PixelBuffer {
  return obj(10, 16, o => {
    o.box(0, 13, 10, 3, P.dark);
    o.rect(6, 3, 2, 10, P.white[2]);
    o.line(3, 2, 7, 8, P.white[3]);
    o.line(4, 2, 8, 8, P.white[2]);
    o.rect(1, 9, 7, 2, P.dark[2]);
    o.rect(2, 0, 3, 3, P.black[2]);
  });
}

export function jars(n: number, seed: number): PixelBuffer {
  const R = rng(seed);
  return obj(n * 6, 10, o => {
    for (let i = 0; i < n; i++) {
      const x = i * 6, h = 6 + Math.floor(R() * 4);
      const liq = [P.glass, P.teal, P.yellow, P.green][Math.floor(R() * 4)];
      o.rect(x, 10 - h, 5, h, (xx, yy) => (yy === 0 ? P.dark[2] : yy < 2 ? hex('#c8e0e8') : xx === 0 ? liq[3] : liq[2]));
      // specimen inside
      if (R() < 0.7) o.ell(x + 2.5, 10 - h / 2, 1.2, 1.8, [P.orange, P.fawn, P.red][Math.floor(R() * 3)][1]);
    }
  });
}

export function fishTankFrame(w: number, h: number): Sp {
  // tank body (glass, gravel, plants, rocks); the fish and bubbles are animated by the scene
  const buf = obj(w, h + 14, o => {
    // cabinet
    o.box(0, h, w, 14, P.plankD);
    o.rect(3, h + 3, Math.floor(w / 2) - 5, 8, P.plankD[1]);
    o.rect(Math.floor(w / 2) + 2, h + 3, Math.floor(w / 2) - 5, 8, P.plankD[1]);
    // glass box
    o.rect(0, 0, w, h, (x, y) => {
      if (y === 0) return P.dark[1];
      if (x === 0 || x === w - 1) return P.dark[1];
      if (y >= h - 4) return (x * 3 + y) % 4 === 0 ? hex('#c8a870') : y === h - 4 ? hex('#a88a5a') : hex('#8a6a44');
      if (y === 1) return hex('#9ad8e8');
      return y < h * 0.4 ? hex('#3a8aa0') : hex('#2a6a84');
    });
    // plants and a rock
    for (const [x0, hh] of [[4, 12], [8, 16], [w - 9, 14], [w - 5, 10]]) for (let y = 0; y < hh; y++) o.px(x0 + Math.round(Math.sin(y * 0.6) * 1), h - 4 - y, y % 3 ? P.leaf[2] : P.leaf[1]);
    o.ell(w * 0.62, h - 5, 5, 3, (nx, ny) => (ny < -0.2 ? P.steel[3] : P.steel[1]));
  });
  const glow = glowOf(w, h + 14, o => o.rect(1, 1, w - 2, h - 5, (x, y) => (y < 2 ? hex('#a0e8ff') : hex('#1a5a70'))));
  return { buf, glow };
}

export function labBench(w: number): PixelBuffer {
  return obj(w, 22, o => {
    o.box(0, 0, w, 3, P.white);
    o.put(cupboard(w - 2, 18, P.steel), 0, 3);
  });
}

export function whiteboard(w: number, h: number): PixelBuffer {
  return obj(w, h, o => {
    o.box(0, 0, w, h, P.steel);
    o.rect(1, 1, w - 2, h - 3, P.white[3]);
    // doodles: a fish sketch, arrows, a graph
    o.ell(8, 7, 4, 2, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? P.blue[2] : -1));
    o.line(12, 7, 15, 5, P.blue[2]); o.line(12, 7, 15, 9, P.blue[2]);
    o.line(19, 12, 24, 7, P.red[2]); o.line(24, 7, 29, 9, P.red[2]);
    o.hline(19, 30, 13, P.black[1]); o.vline(19, 5, 13, P.black[1]);
    o.hline(3, 11, 12, P.green[2]); o.hline(3, 8, 14, P.green[2]);
    o.rect(2, h - 2, 8, 1, P.dark[2]);
  });
}

export function serverRack(): Sp {
  const buf = obj(14, 30, o => {
    o.box(0, 0, 14, 30, P.black);
    for (let i = 0; i < 6; i++) { o.rect(2, 3 + i * 4, 10, 3, P.dark[2]); o.px(10, 4 + i * 4, i % 2 ? hex('#6aff9a') : hex('#ff6aa8')); }
  });
  const glow = glowOf(14, 30, o => { for (let i = 0; i < 6; i++) o.px(10, 4 + i * 4, i % 2 ? hex('#6aff9a') : hex('#ff6aa8')); });
  return { buf, glow };
}

export function gamingChair(): PixelBuffer {
  return obj(16, 28, o => {
    o.poly([2, 0, 12, 0, 13, 14, 1, 14], (x) => (x < 4 ? P.pink[3] : x > 10 ? P.pink[1] : P.pink[2]));
    o.rect(5, 3, 4, 8, P.black[2]);
    o.box(0, 14, 16, 4, P.black);
    o.vline(8, 18, 24, P.steel[1]);
    o.hline(2, 14, 25, P.steel[1]);
    o.px(2, 26, P.black[0]); o.px(14, 26, P.black[0]); o.px(8, 26, P.black[0]);
  });
}

export function cans(n: number): PixelBuffer {
  return obj(n * 4, 6, o => {
    for (let i = 0; i < n; i++) o.rect(i * 4, 0, 3, 6, (x, y) => (y === 0 ? P.steel[3] : x === 2 ? [P.teal, P.pink, P.yellow][i % 3][1] : [P.teal, P.pink, P.yellow][i % 3][2]));
  });
}

export function stringLights(w: number, sag: number, cols: string[]): Sp {
  const h = sag + 4;
  const pts: [number, number, string][] = [];
  const buf = obj(w, h, o => {
    for (let x = 0; x < w; x++) {
      const y = Math.round(Math.sin((x / (w - 1)) * Math.PI) * sag);
      o.px(x, y, hex('#2a2024'));
      if (x % 6 === 3) { const c = cols[(x / 6 | 0) % cols.length]; o.px(x, y + 1, hex(c)); o.px(x, y + 2, hex(c)); pts.push([x, y + 1, c]); }
    }
  }, false);
  const glow = glowOf(w, h, o => { for (const [x, y, c] of pts) { o.px(x, y, hex(c)); o.px(x, y + 1, hex(c)); } });
  return { buf, glow };
}

// ------------------------------------------------------------------ engine room

export function engineBlock(): Sp {
  const w = 96, h = 54;
  const buf = obj(w, h, o => {
    const E = P.engine;
    // base skid
    o.box(0, h - 6, w, 6, P.dark);
    // block
    o.rect(8, 16, 74, h - 22, (x, y) => (y === 0 ? E[3] : x === 73 ? E[0] : x > 66 ? E[1] : y > h - 30 ? E[1] : E[2]));
    // cylinder heads
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * 17;
      o.box(x, 6, 14, 11, E);
      o.hline(x, x + 13, 9, E[1]);
      o.rect(x + 5, 0, 4, 7, (xx) => (xx === 0 ? P.steel[3] : P.steel[2]));
    }
    // flywheel
    o.ball(88, h - 22, 8, 12, P.dark);
    o.ell(88, h - 22, 3, 5, P.steel[2]);
    // oil sump drips and rust
    for (const x of [20, 44, 61]) o.vline(x, h - 20, h - 12, P.rust[1]);
    o.rect(24, 26, 16, 7, (x, y) => (y === 0 || y === 6 ? P.steel[1] : P.steel[2]));
    o.hline(26, 37, 29, P.steel[0]);
    // warning label
    o.rect(50, 26, 10, 6, P.yellow[2]);
    o.rect(54, 27, 2, 3, P.black[0]);
  });
  return { buf };
}

export function gauge(): PixelBuffer {
  return obj(9, 9, o => {
    o.ell(4.5, 4.5, 4.5, 4.5, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? P.brass[2] : P.white[3]));
    o.px(2, 5, P.red[2]); o.px(6, 5, P.green[2]);
  });
}

export function fuseBox(): Sp {
  const buf = obj(18, 24, o => {
    o.box(0, 0, 18, 24, P.steel);
    o.rect(2, 3, 14, 16, P.dark[1]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) o.rect(3 + i * 5, 4 + j * 4, 3, 2, j === 2 && i === 1 ? P.red[2] : P.black[3]);
    o.rect(6, 20, 6, 2, P.yellow[2]);
  });
  const glow = glowOf(18, 24, o => { o.px(4, 21, hex('#ff5040')); o.px(13, 21, hex('#60ff80')); });
  return { buf, glow };
}

export function toolBoard(w: number): PixelBuffer {
  return obj(w, 24, o => {
    o.box(0, 0, w, 24, T('#8a6a4a'));
    o.rect(1, 1, w - 2, 22, (x, y) => ((x % 3 === 1 && y % 3 === 1) ? hex('#6a4e34') : hex('#8a6a4a')));
    // wrenches, hammer, saw, screwdrivers
    let x = 3;
    for (let i = 0; i < Math.floor((w - 6) / 6); i++) {
      const k = i % 4;
      if (k === 0) { o.vline(x + 1, 4, 18, P.steel[2]); o.ell(x + 1.5, 4, 2, 2, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? -1 : P.steel[2])); }
      else if (k === 1) { o.vline(x + 1, 6, 20, P.plank[2]); o.rect(x - 1, 4, 5, 3, P.steel[2]); }
      else if (k === 2) { o.vline(x + 1, 4, 12, P.steel[3]); o.rect(x, 12, 3, 7, P.red[2]); }
      else { o.poly([x, 4, x + 4, 4, x + 4, 18, x, 14], P.steel[2]); o.rect(x, 16, 4, 4, P.plank[2]); }
      x += 6;
    }
  });
}

export function valveWheel(): PixelBuffer {
  return obj(13, 13, o => {
    o.ell(6.5, 6.5, 6.5, 6.5, (nx, ny) => { const r = Math.hypot(nx, ny); if (r > 0.72) return ny < 0 ? P.red[3] : P.red[1]; if (r < 0.25) return P.steel[2]; const a = Math.atan2(ny, nx); return Math.abs(Math.sin(a * 2)) < 0.2 ? P.red[2] : -1; });
  });
}

export function extinguisher(): PixelBuffer {
  return obj(7, 16, o => {
    o.rect(1, 3, 5, 13, (x) => (x === 0 ? P.red[3] : x === 4 ? P.red[1] : P.red[2]));
    o.rect(2, 0, 3, 3, P.dark[2]);
    o.line(5, 1, 6, 6, P.black[1]);
    o.rect(2, 8, 3, 3, P.white[3]);
  });
}

export function oilCans(): PixelBuffer {
  return obj(20, 12, o => {
    o.box(0, 2, 8, 10, P.red);
    o.rect(6, 0, 2, 3, P.dark[2]);
    o.box(10, 4, 9, 8, P.yellow);
    o.rect(11, 6, 7, 2, P.black[2]);
  });
}

// ------------------------------------------------------------------ bridge

export function helm(): PixelBuffer {
  return obj(24, 32, o => {
    // pedestal
    o.rect(9, 14, 6, 18, (x) => (x === 0 ? P.plank[3] : x === 5 ? P.plank[0] : P.plank[2]));
    o.box(6, 28, 12, 4, P.plankD);
    // the wheel, seen from the side at a slight angle: an ellipse with spokes and handles
    o.ell(12, 12, 10, 11, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.8) return ny < 0 ? P.plank[3] : P.plank[1];
      if (r < 0.2) return P.brass[2];
      const a = Math.atan2(ny, nx);
      return Math.abs(Math.sin(a * 4)) < 0.14 ? P.plank[2] : -1;
    });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; o.px(12 + Math.round(Math.cos(a) * 11.5), 12 + Math.round(Math.sin(a) * 12.5), P.plank[3]); }
  });
}

export function consoleDesk(w: number): Sp {
  const buf = obj(w, 26, o => {
    o.poly([0, 8, w, 4, w, 26, 0, 26], (x, y) => (y < 10 ? P.dark[3] : x > w - 4 ? P.dark[1] : P.dark[2]));
    // radar scope, dials, switches, radio
    o.ell(12, 14, 7, 7, (nx, ny) => (Math.hypot(nx, ny) > 0.82 ? P.black[3] : hex('#1a3a2a')));
    for (let i = 0; i < 5; i++) o.rect(24 + i * 5, 12, 3, 3, [P.red, P.green, P.yellow, P.white, P.green][i][2]);
    o.rect(24, 18, w - 30, 5, P.black[2]);
    o.rect(w - 14, 8, 10, 8, P.dark[1]);
    o.rect(w - 12, 10, 6, 3, hex('#e8a040'));
  });
  const glow = glowOf(w, 26, o => {
    o.ell(12, 14, 5.6, 5.6, (nx, ny) => (Math.abs(nx) < 0.12 || Math.abs(ny) < 0.12 ? hex('#4aff9a') : hex('#0a4a2a')));
    for (let i = 0; i < 5; i++) o.px(25 + i * 5, 13, [hex('#ff5040'), hex('#60ff80'), hex('#ffe060'), hex('#ffffff'), hex('#60ff80')][i]);
    o.rect(w - 12, 10, 6, 3, hex('#ffb040'));
  });
  return { buf, glow };
}

export function chartTable(w: number): PixelBuffer {
  return obj(w, 20, o => {
    o.put(table(w - 2, 20, P.plankD), 0, 0);
    o.rect(3, -1, w - 10, 2, P.paper[3]);
    o.line(6, 0, w - 12, 0, P.blue[1]);
  });
}

export function binoculars(): PixelBuffer {
  return obj(9, 5, o => { o.rect(0, 0, 4, 5, P.black[2]); o.rect(5, 0, 4, 5, P.black[2]); o.rect(3, 2, 3, 1, P.black[1]); o.px(1, 1, P.glass[3]); o.px(6, 1, P.glass[3]); });
}

// ------------------------------------------------------------------ deck gear

export function cooler(): PixelBuffer {
  return obj(20, 12, o => {
    o.box(0, 2, 20, 10, P.blue);
    o.box(0, 0, 20, 3, P.white);
    o.rect(7, 5, 6, 2, P.white[3]);
  });
}

export function bucket(): PixelBuffer {
  return obj(10, 10, o => {
    o.poly([0, 2, 10, 2, 9, 10, 1, 10], (x) => (x < 3 ? P.yellow[3] : x > 7 ? P.yellow[1] : P.yellow[2]));
    o.ell(5, 2, 5, 1.4, P.water[1]);
    o.line(0, 2, 5, -2, P.steel[1]); o.line(5, -2, 10, 2, P.steel[1]);
  });
}

export function rodHolder(): PixelBuffer {
  return obj(12, 40, o => {
    o.rect(4, 26, 4, 14, P.steel[2]);
    o.line(6, 26, 11, 0, P.plank[2]);
    o.line(6, 26, 2, 3, P.plank[1]);
    o.px(11, 0, P.red[2]);
    o.ell(8, 20, 1.6, 1.6, P.steel[3]);
  });
}

export function deckChair(): PixelBuffer {
  return obj(22, 20, o => {
    o.line(0, 20, 14, 0, P.plank[1]); o.line(8, 20, 20, 6, P.plank[1]); o.line(3, 12, 22, 12, P.plank[2]);
    o.poly([4, 11, 16, 1, 20, 6, 10, 11], (x) => ((x >> 1) % 2 ? P.red[2] : P.white[2]));
  });
}

export function winch(): PixelBuffer {
  return obj(26, 18, o => {
    o.box(0, 12, 26, 6, P.dark);
    o.ball(13, 8, 7, 7, P.steel);
    o.ell(13, 8, 5, 5, (nx, ny) => ((Math.floor((nx + 1) * 4) % 2) ? P.rope[2] : P.rope[1]));
    o.line(20, 4, 25, -1, P.steel[1]);
  });
}

export function lifeRaftCanister(): PixelBuffer {
  return obj(28, 14, o => {
    o.ell(14, 8, 14, 6, (nx, ny) => (ny < -0.3 ? P.white[3] : ny > 0.5 ? P.white[1] : P.white[2]));
    for (const x of [7, 14, 21]) o.vline(x, 2, 13, P.orange[2]);
    o.box(4, 12, 20, 2, P.steel);
  });
}

export function antenna(h: number): PixelBuffer {
  return obj(8, h, o => {
    o.vline(4, 0, h - 1, P.steel[2]);
    o.hline(1, 7, 4, P.steel[2]);
    o.ell(4, 1, 1.4, 1.4, P.red[2]);
    o.box(2, h - 4, 5, 4, P.dark);
  });
}

export function herbBox(): PixelBuffer {
  return obj(30, 14, o => {
    o.box(0, 7, 30, 7, P.plank);
    for (let i = 0; i < 6; i++) {
      const x = 3 + i * 4.5;
      o.ell(x, 5, 2.4, 3.2, (nx, ny) => (nx < -0.2 ? P.leaf[3] : ny > 0.3 ? P.leaf[1] : P.leaf[2]));
      if (i % 3 === 1) o.px(x, 3, P.red[2]);
    }
  });
}

export function hatchCover(w: number): PixelBuffer {
  return obj(w, 5, o => {
    o.box(0, 0, w, 5, P.plankD);
    o.hline(2, w - 3, 2, P.brass[1]);
  });
}

export { P, T, hex, mix, shade };
export type { Tone };
