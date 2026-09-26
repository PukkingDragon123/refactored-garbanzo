// Pixel icons for gadgets, clues and species cards (rendered once to data URLs).

import { PixelBuffer } from '../art/pixel';
import { hex, shade } from '../art/color';
import { PAL, OUTLINE } from '../art/palettes';
import { SERPENT_LOOKS, BIRDS, MAMMALS, drawBird, drawMammal, birdPoses, mammalPoses } from '../art/fauna';
import { SerpentPainter } from '../art/serpent';

const cache = new Map<string, string>();
const memo = (k: string, fn: () => string) => {
  let v = cache.get(k);
  if (!v) { v = fn(); cache.set(k, v); }
  return v;
};

function icon(draw: (b: PixelBuffer) => void, s = 16) {
  const b = new PixelBuffer(s, s);
  draw(b);
  b.outline(OUTLINE);
  return b.toDataURL(4);
}

export const ICONS: Record<string, () => string> = {
  fruit: () => icon(b => { b.shadedEllipse(8, 9, 5, 5, PAL.red.slice(2, 7)); b.set(8, 3, PAL.bark[4]); b.set(9, 2, PAL.leafOlive[5]); b.set(10, 2, PAL.leafOlive[5]); }),
  grub: () => icon(b => { b.rect(4, 7, 9, 7, PAL.bark[4]); b.rect(4, 7, 9, 1, PAL.bark[6]); for (let i = 0; i < 4; i++) b.disc(6 + i * 2, 6, 1.4, PAL.canvas[6]); }),
  fish: () => icon(b => { b.ellipse(8, 8, 5, 3, PAL.metal[6]); b.poly([2, 5, 4, 8, 2, 11], PAL.metal[5]); b.set(11, 7, hex('#101010')); b.rect(5, 9, 6, 1, PAL.metal[4]); }),
  caller: () => icon(b => { b.rect(3, 6, 7, 5, PAL.bark[5]); b.poly([10, 5, 14, 3, 14, 13, 10, 11], PAL.yellow[5]); b.set(5, 8, PAL.red[6]); }),
  trap: () => icon(b => { b.rect(3, 5, 10, 8, PAL.olive[4]); b.disc(8, 9, 2.5, PAL.metal[2]); b.disc(8, 9, 1.3, hex('#6fa0c0')); b.set(11, 6, PAL.red[6]); b.rect(7, 13, 2, 3, PAL.bark[3]); }),
  lens: () => icon(b => { b.disc(8, 8, 6, PAL.metal[2]); b.disc(8, 8, 4, hex('#3b6f8a')); b.set(6, 6, hex('#e8fbff')); b.set(7, 6, hex('#a8d8f0')); }),
  af: () => icon(b => { b.rect(2, 2, 12, 12, 0); for (const [x, y] of [[2, 2], [11, 2], [2, 11], [11, 11]]) { b.rect(x, y, 3, 1, PAL.moss[6]); b.rect(x, y, 1, 3, PAL.moss[6]); } b.rect(12, 2, 1, 3, PAL.moss[6]); b.rect(2, 12, 3, 1, PAL.moss[6]); b.disc(8, 8, 1.5, PAL.moss[6]); }),
  film: () => icon(b => { b.rect(3, 3, 10, 10, PAL.metal[2]); b.rect(4, 5, 8, 6, PAL.yellow[5]); for (let x = 4; x < 12; x += 2) { b.set(x, 3, PAL.metal[5]); b.set(x, 12, PAL.metal[5]); } }),
  video: () => icon(b => { b.rect(2, 5, 9, 7, PAL.metal[3]); b.poly([11, 7, 14, 5, 14, 12, 11, 10], PAL.metal[4]); b.disc(5, 8, 1.2, PAL.red[6]); }),
  headlamp: () => icon(b => { b.rect(2, 7, 12, 3, PAL.bark[3]); b.disc(8, 8, 3, PAL.metal[4]); b.disc(8, 8, 2, PAL.yellow[6]); }),
  dive: () => icon(b => { b.disc(8, 8, 6, PAL.canvasOrange[5]); b.disc(8, 8, 3.5, hex('#6fb8d8')); b.set(6, 6, hex('#ffffff')); }),
  ghillie: () => icon(b => { for (let i = 0; i < 26; i++) b.set(3 + (i * 7) % 10, 3 + (i * 5) % 11, i % 2 ? PAL.leafDeep[4] : PAL.leafOlive[4]); b.shadedEllipse(8, 9, 5, 5, PAL.leafDeep.slice(2, 7)); }),
  rp: () => icon(b => { b.shadedEllipse(8, 8, 6, 6, PAL.yellow.slice(2, 7)); b.rect(7, 5, 2, 6, PAL.yellow[2]); b.rect(6, 5, 3, 1, PAL.yellow[2]); }),
  camera: () => icon(b => { b.rect(2, 5, 12, 8, PAL.metal[2]); b.rect(3, 4, 4, 1, PAL.metal[3]); b.disc(8, 9, 3, PAL.metal[1]); b.disc(8, 9, 1.8, hex('#4c6f86')); b.set(12, 6, PAL.red[6]); }),
  // clues
  shells: () => icon(b => { for (const [x, y] of [[5, 10], [9, 11], [11, 7]]) b.shadedEllipse(x, y, 2.5, 1.8, PAL.canvas.slice(3, 7)); b.line(2, 13, 14, 13, PAL.soil[4]); }),
  fur: () => icon(b => { for (let i = 0; i < 7; i++) b.line(4 + i, 12, 6 + i * 1.2, 4 + (i % 3), PAL.bark[4 + (i % 3)]); }),
  scute: () => icon(b => { b.poly([3, 11, 8, 3, 13, 11], PAL.canvas[4]); b.line(5, 10, 11, 10, PAL.canvas[2]); b.set(8, 7, hex('#3a2020')); b.set(9, 8, hex('#3a2020')); }),
  burrow: () => icon(b => { b.ellipse(8, 11, 6, 3, PAL.soil[4]); b.ellipse(8, 11, 3, 1.6, hex('#0b0706')); }),
  scat: () => icon(b => { b.shadedEllipse(7, 10, 3, 2.4, PAL.soil.slice(2, 6)); b.shadedEllipse(10, 9, 2.5, 2, PAL.soil.slice(2, 6)); b.set(9, 8, PAL.leafOlive[6]); b.set(6, 9, PAL.leafOlive[6]); }),
  skin: () => icon(b => { for (let x = 2; x < 14; x++) { const y = 8 + Math.round(Math.sin(x * 0.7) * 3); b.set(x, y, hex('#a8f0d8')); b.set(x, y + 1, hex('#e8ffd0')); } }),
  bigskin: () => icon(b => { for (let x = 1; x < 15; x++) { const y = 8 + Math.round(Math.sin(x * 0.5) * 3); b.rect(x, y - 1, 1, 4, x % 3 ? PAL.canvas[4] : PAL.canvas[2]); } }),
  egg: () => icon(b => { b.shadedEllipse(6, 10, 3, 3.5, PAL.canvas.slice(3, 7)); b.shadedEllipse(11, 11, 2.4, 2.4, PAL.canvas.slice(3, 7)); b.set(6, 9, PAL.bark[3]); b.set(10, 11, PAL.bark[3]); }),
  nest: () => icon(b => { b.ellipse(8, 10, 6, 3.5, PAL.moss[4]); b.ellipse(8, 9, 3.5, 1.8, PAL.moss[2]); b.disc(7, 9, 1.3, PAL.white[6]); }),
  bones: () => icon(b => { for (let i = 0; i < 5; i++) { b.disc(3 + i * 2.5, 9 + (i % 2), 1.4, PAL.white[6]); b.set(3 + i * 2.5, 7 + (i % 2), PAL.white[5]); } }),
};

export const iconURL = (id: string) => memo('i:' + id, () => (ICONS[id] ? ICONS[id]() : ICONS.camera()));

/** A sprite portrait of a species for the Field Guide cards. */
import { BEAST_ANIMS, renderBeast, BeastId } from '../art/beasts';

export function speciesSprite(id: string): string {
  return memo('s:' + id, () => {
    let buf: PixelBuffer;
    if (BEAST_ANIMS[id as BeastId]) buf = renderBeast(id as BeastId, 'idle', 0).buf.trim(1).buf;
    else if (SERPENT_LOOKS[id]) {
      const look = SERPENT_LOOKS[id];
      const L = Math.min(look.length, 110);
      const scale = L / look.length;
      const lk = { ...look, length: L, radius: Math.max(2.4, look.radius * (look.length > 150 ? 0.45 : 1)), headLen: look.headLen ? look.headLen * scale * 1.4 : undefined, dorsalFin: look.dorsalFin ? { ...look.dorsalFin, h: 6 } : undefined };
      const sp = new SerpentPainter(lk);
      const n = 20, spc = L / n;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) pts.push([L + 12 - i * spc, 24 + Math.sin(i * 0.55) * lk.radius * 1.3 - (i < 3 ? (3 - i) * 1.5 : 0)]);
      buf = new PixelBuffer(Math.ceil(L + 30), 44);
      sp.paint(buf, { pts, facing: 1, jaw: 0, tongue: 0.6, legPhase: 0.6, legLift: 1, grounded: true, groundY: () => 40, flatten: 0 }, 0, 0, 0);
      buf = buf.trim(1).buf;
    } else if (BIRDS[id]) buf = drawBird(BIRDS[id], birdPoses.stand(0)).trim(1).buf;
    else if (MAMMALS[id]) buf = drawMammal(MAMMALS[id], mammalPoses.stand(0)).trim(1).buf;
    else buf = new PixelBuffer(8, 8);
    return buf.toDataURL(3);
  });
}

export { shade };
