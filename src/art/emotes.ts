// Cartoon reaction marks shown above heads (people and animals). Chunky, bright, dark outline.

import { PixelBuffer } from './pixel';
import { C, hex } from './color';

export type EmoteKind = 'exclaim' | 'question' | 'interrobang' | 'heart' | 'anger' | 'sweat' | 'dots' | 'music' | 'zzz' | 'laugh' | 'sparkle' | 'idea' | 'gloom' | 'shock' | 'alarm' | 'eye' | 'star' | 'skull';

export const EMOTE_INFO: Record<EmoteKind, { frames: number; fps: number; loop: boolean }> = {
  exclaim: { frames: 2, fps: 6, loop: true }, question: { frames: 2, fps: 4, loop: true }, interrobang: { frames: 2, fps: 6, loop: true },
  heart: { frames: 2, fps: 4, loop: true }, anger: { frames: 2, fps: 6, loop: true }, sweat: { frames: 3, fps: 5, loop: true },
  dots: { frames: 4, fps: 3, loop: true }, music: { frames: 4, fps: 5, loop: true }, zzz: { frames: 4, fps: 3, loop: true },
  laugh: { frames: 2, fps: 6, loop: true }, sparkle: { frames: 3, fps: 8, loop: true }, idea: { frames: 2, fps: 4, loop: true },
  gloom: { frames: 3, fps: 4, loop: true }, shock: { frames: 2, fps: 10, loop: true }, alarm: { frames: 2, fps: 8, loop: true },
  eye: { frames: 3, fps: 3, loop: true }, star: { frames: 4, fps: 8, loop: true }, skull: { frames: 2, fps: 4, loop: true },
};

const OL = hex('#1b1a1f');
const W = hex('#ffffff'), Y = hex('#ffd84a'), Y2 = hex('#f0a020'), RD = hex('#e8413a'), RD2 = hex('#a8201e'), PK = hex('#ff7aa8'), PK2 = hex('#d2437a');
const BL = hex('#6ec8ff'), BL2 = hex('#2a86d0'), PU = hex('#8a6ae0'), PU2 = hex('#5a3eb0'), GR = hex('#7ae07a'), CY = hex('#bff4ff');

/** Draw from ASCII rows: each char maps to a colour ('.' = empty). Outline added after. */
function glyph(rows: string[], pal: Record<string, C>, w = 20, h = 20, dx = 0, dy = 0, into?: PixelBuffer) {
  const b = into ?? new PixelBuffer(w, h);
  const oy = h - rows.length - 1 + dy;
  const ox = Math.floor((w - rows[0].length) / 2) + dx;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && pal[ch] !== undefined) b.set(ox + x, oy + y, pal[ch]); }));
  return b;
}
const done = (b: PixelBuffer) => { b.outline(OL); return b; };

const EXC = ['.YY.', 'YWWY', 'YWWY', 'YWWY', 'YWWY', '.YY.', '.YY.', '....', '.YY.', 'YWWY', '.YY.'];
const QST = ['.WWWW.', 'WWYYWW', 'WY..WW', '...WWY', '..WWY.', '..WY..', '..YY..', '......', '..WW..', '..WW..'];

export function emoteFrames(kind: EmoteKind): PixelBuffer[] {
  const f: PixelBuffer[] = [];
  const P = { W, Y, R: RD, r: RD2, P: PK, p: PK2, B: BL, b: BL2, U: PU, u: PU2, G: GR, C: CY, y: Y2 };
  switch (kind) {
    case 'exclaim':
      for (let i = 0; i < 2; i++) f.push(done(glyph(EXC, P, 14, 16, 0, -i)));
      break;
    case 'question':
      for (let i = 0; i < 2; i++) f.push(done(glyph(QST, P, 14, 15, i ? 1 : 0, 0)));
      break;
    case 'interrobang':
      for (let i = 0; i < 2; i++) { const b = new PixelBuffer(18, 16); glyph(EXC, P, 18, 16, -4, -i, b); glyph(QST, P, 18, 16, 3, 0, b); f.push(done(b)); }
      break;
    case 'alarm':
      for (let i = 0; i < 2; i++) { const b = new PixelBuffer(16, 16); const pal = { ...P, Y: RD, W: i ? W : hex('#ffd0c8') }; glyph(EXC, pal, 16, 16, -3, -i, b); glyph(EXC, pal, 16, 16, 3, -i, b); f.push(done(b)); }
      break;
    case 'heart': {
      const H = ['.PP.PP.', 'PWPPPPp', 'PPPPPPp', 'PPPPPpp', '.PPPpp.', '..Ppp..', '...p...'];
      f.push(done(glyph(H, P, 12, 11)), done(glyph(H, P, 12, 11, 0, -1)));
      break;
    }
    case 'anger': {
      const A1 = ['.R..R.', 'RRr.Rr', '.r..r.', '......', '.R..R.', 'RRr.Rr', '.r..r.'];
      const A2 = ['R....R', 'RR..RR', '.rRRr.', '.rRRr.', 'RR..RR', 'R....R'];
      f.push(done(glyph(A1, P, 11, 10)), done(glyph(A2, P, 11, 10)));
      break;
    }
    case 'sweat': {
      const S = ['..B.', '.BB.', 'BCBb', 'BBBb', '.bb.'];
      for (let i = 0; i < 3; i++) f.push(done(glyph(S, P, 8, 12, 0, i)));
      break;
    }
    case 'dots':
      for (let i = 0; i < 4; i++) { const b = new PixelBuffer(15, 6); for (let k = 0; k < Math.min(3, i + 1) && i < 3; k++) b.rect(1 + k * 5, 1, 3, 3, W); if (i === 3) for (let k = 0; k < 3; k++) b.rect(1 + k * 5, 1, 3, 3, W); f.push(done(b)); }
      break;
    case 'music': {
      const N = ['..YYY', '..Y.Y', '..Y.Y', '..Y..', 'YYY..', 'YYY..'];
      for (let i = 0; i < 4; i++) { const b = new PixelBuffer(16, 16); glyph(N, P, 16, 16, -3 + (i % 2), -i, b); glyph(N, { ...P, Y: PK }, 16, 16, 4, -((i + 2) % 4), b); f.push(done(b)); }
      break;
    }
    case 'zzz': {
      const Z = ['WWWW', '..W.', '.W..', 'WWWW'];
      for (let i = 0; i < 4; i++) { const b = new PixelBuffer(16, 18); glyph(Z, P, 16, 18, -3, -i, b); if (i > 1) glyph(['WWW', '.W.', 'WWW'], P, 16, 18, 3, -i - 6, b); f.push(done(b)); }
      break;
    }
    case 'laugh':
      for (let i = 0; i < 2; i++) {
        const b = new PixelBuffer(18, 12);
        const L = ['Y.Y.YYY', 'YYY.Y.Y', 'Y.Y.YYY', 'Y.Y.Y.Y'];
        glyph(L, P, 18, 12, -3, -i, b);
        glyph(['Y', 'Y', '.', 'Y'], P, 18, 12, 6, -i, b);
        f.push(done(b));
      }
      break;
    case 'sparkle':
      for (let i = 0; i < 3; i++) {
        const b = new PixelBuffer(13, 13);
        const r = [2, 4, 3][i];
        for (let k = -r; k <= r; k++) { b.set(6 + k, 6, Y); b.set(6, 6 + k, Y); }
        b.set(6, 6, W); b.set(5, 6, W); b.set(6, 5, W);
        if (i === 1) { b.set(4, 4, Y); b.set(8, 8, Y); b.set(8, 4, Y); b.set(4, 8, Y); }
        f.push(done(b));
      }
      break;
    case 'idea': {
      const I = ['.YYY.', 'YWWYY', 'YWYYy', 'YYYYy', '.YYy.', '.WWW.', '.WWW.'];
      for (let i = 0; i < 2; i++) { const b = glyph(I, P, 14, 14); if (i) { b.set(1, 3, Y); b.set(12, 3, Y); b.set(6, 0, Y); } f.push(done(b)); }
      break;
    }
    case 'gloom':
      for (let i = 0; i < 3; i++) { const b = new PixelBuffer(16, 14); for (let k = 0; k < 4; k++) { const h = 6 + ((k + i) % 3) * 2; b.rect(1 + k * 4, 1, 2, h, k % 2 ? PU : PU2); } f.push(done(b)); }
      break;
    case 'shock':
      for (let i = 0; i < 2; i++) {
        const b = new PixelBuffer(30, 18);
        const rays = [[-1, -0.2], [-0.8, -0.7], [-0.35, -1], [0.35, -1], [0.8, -0.7], [1, -0.2]];
        rays.forEach(([dx, dy], k) => {
          const r0 = 7 + (i + k) % 2 * 2, r1 = r0 + 5;
          for (let t = r0; t < r1; t++) b.set(15 + dx * t, 17 + dy * t * 1.2, k % 2 ? Y : W);
        });
        f.push(done(b));
      }
      break;
    case 'eye': {
      for (let i = 0; i < 3; i++) {
        const E = i === 2 ? ['.......', 'WWWWWWW', '.......'] : ['..WWW..', '.WWUWW.', 'WWUuUWW', '.WWUWW.', '..WWW..'];
        f.push(done(glyph(E, P, 13, 9)));
      }
      break;
    }
    case 'star':
      for (let i = 0; i < 4; i++) {
        const b = new PixelBuffer(22, 10);
        for (let k = 0; k < 3; k++) {
          const a = (i / 4 + k / 3) * Math.PI * 2;
          const x = 11 + Math.cos(a) * 8, y = 5 + Math.sin(a) * 3;
          b.set(x, y, Y); b.set(x + 1, y, Y); b.set(x - 1, y, Y); b.set(x, y + 1, Y); b.set(x, y - 1, Y);
        }
        f.push(done(b));
      }
      break;
    case 'skull': {
      const K = ['.WWWW.', 'WWWWWW', 'W..W.W', 'W..W.W', 'WWWWWW', '.W.W.W', '.WWWW.'];
      f.push(done(glyph(K, P, 12, 11)), done(glyph(K, P, 12, 11, 0, -1)));
      break;
    }
  }
  return f;
}
