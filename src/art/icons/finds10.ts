// V10 expedition finds: taonga, artifacts, fossils, rock / soil / water samples, plants and fungi from
// the deep places, the village's gifts and Joshu's lost things.

import { Pen, RAMP, H, rp, IconSet, Pt } from './pen';
import { sparkle, halo } from './parts';

export const FINDS10: IconSet = {};

const POUNAMU = rp('#062a1a', '#0c4a2c', '#14703e', '#2a9a56', '#5cc88a', '#bff2d2');
const BASALT = rp('#0e1014', '#1c2028', '#2c323c', '#444c58', '#68727e', '#a8b2bc');
const LIME = rp('#4a4436', '#6e6650', '#968c70', '#bcb292', '#dcd4b6', '#f6f0dc');
const OCHRE = rp('#3a1a0a', '#6a3412', '#9a5422', '#c47a36', '#e0a056', '#f6cc8a');
const WATER = rp('#0a2a3a', '#14465e', '#226a86', '#3a90aa', '#6ab8c8', '#c4eef2');

/** a specimen jar with a fill colour */
function jar(p: Pen, fill: string[] | string, o: { dark?: boolean } = {}) {
  const f = typeof fill === 'string' ? rp('#101010', fill, fill, fill, fill, '#ffffff') : rp(...fill);
  p.slab(p.maskBox(7, 8, 10, 13, 2), RAMP.glass, 3);
  p.slab(p.maskBox(8, 12, 8, 8, 1), f, o.dark ? 1 : 2);
  p.slab(p.maskBox(6, 5, 12, 4, 1), RAMP.wood, 3);
  p.px(9, 10, H('#ffffff')); p.px(9, 11, H('#e8fff8'));
}
/** a cloth sample bag with a tag */
function bag(p: Pen, ramp: string[]) {
  const m = p.maskFn((x, y) => { const dx = (x - 12) / 7, dy = (y - 15) / 7; return dx * dx + dy * dy < 1 || (y > 6 && y < 11 && Math.abs(x - 12) < 3); });
  p.puff(m, rp(...ramp), { r: 3 });
  p.rect(9, 9, 6, 1, H('#5a3a1e'));
  p.slab(p.maskBox(15, 5, 5, 4), RAMP.cream, 3);
}

FINDS10.taonga_toggle = { draw: p => {
  const m = p.maskFn((x, y) => { const dx = x + 0.5 - 12, dy = y + 0.5 - 12, r = Math.hypot(dx, dy); return (r < 8 && r > 3.2 && !(dx > 0 && dy > -2 && dy < 3)) || (Math.abs(dx - 6) < 2 && dy > -1 && dy < 6); });
  p.puff(m, POUNAMU, { r: 3, spec: 0.95 });
  p.ball(12, 12, 1.2, 1.2, RAMP.leaf);
}, post: p => sparkle(p, 17, 6, '#bff2d2') };
FINDS10.taonga_toki = { draw: p => {
  p.slab([4, 15, 13, 7, 20, 9, 18, 13, 8, 20], BASALT, 3);
  p.slab([13, 7, 20, 9, 19, 10, 13, 8], BASALT, 5);
  p.rect(9, 12, 1, 4, H('#141820')); p.rect(11, 11, 1, 4, H('#141820'));
} };
FINDS10.taonga_matau = { draw: p => {
  const pts: Pt[] = [[14, 4], [14, 13], [12, 18], [8, 18], [6, 14], [7, 11]];
  p.tube(pts, 1.6, RAMP.bone);
  p.tube([[7, 11], [9, 12]], 1.2, RAMP.bone);
  p.ball(14, 4, 1.8, 1.8, RAMP.bone);
} };
FINDS10.art_bottle = { draw: p => {
  p.ball(12, 15, 5.5, 6, rp('#0a2a14', '#14462a', '#1e6a3e', '#3a9058', '#6ac08a', '#d8ffe8'), { k: 0.8 });
  p.slab(p.maskBox(10, 4, 4, 7, 1), rp('#0a2a14', '#14462a', '#1e6a3e', '#3a9058', '#6ac08a', '#d8ffe8'), 3);
  p.slab(p.maskBox(10, 2, 4, 3), RAMP.pale, 3);
  p.slab(p.maskBox(9, 13, 6, 4), RAMP.cream, 4, { bevel: false });
} };
FINDS10.art_tag = { draw: p => {
  p.slab([5, 8, 15, 8, 19, 12, 15, 16, 5, 16], RAMP.yellow, 3);
  p.ball(15.5, 12, 1.2, 1.2, RAMP.iron);
  p.rect(7, 10, 6, 1, H('#2a1a08')); p.rect(7, 12, 5, 1, H('#2a1a08')); p.rect(7, 14, 6, 1, H('#2a1a08'));
  p.line(19, 12, 22, 10, H('#1a1a1a'));
} };
FINDS10.art_glyphrub = { draw: p => {
  p.slab(p.maskBox(4, 4, 16, 17, 1), RAMP.cream, 4);
  for (let a = 0; a < 12; a += 0.2) { const r = 1 + a * 0.5; p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r * 0.9), H('#2a2420')); }
} };
FINDS10.fos_vertebra = { draw: p => {
  p.ball(12, 13, 6, 5, RAMP.bone);
  p.tube([[12, 8], [12, 3]], 2, RAMP.bone);
  p.tube([[7, 13], [3, 11]], 1.6, RAMP.bone); p.tube([[17, 13], [21, 11]], 1.6, RAMP.bone);
  p.ball(12, 13, 2, 1.6, RAMP.brownstone);
} };
FINDS10.fos_ammonite = { draw: p => {
  p.ball(12, 12, 8, 8, LIME);
  for (let a = 0; a < 15; a += 0.12) { const r = 0.6 + a * 0.48; p.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), H('#5a503c')); }
} };
FINDS10.fos_leaf = { draw: p => {
  p.slab([3, 8, 18, 4, 21, 15, 6, 20], RAMP.stone, 3);
  for (let i = 0; i < 12; i++) { p.px(6 + i, 16 - i, H('#2a2c30')); if (i % 2) { p.px(6 + i - 1, 16 - i - 2, H('#3a3c42')); p.px(6 + i + 2, 16 - i + 1, H('#3a3c42')); } }
} };
FINDS10.fos_tooth = { draw: p => {
  p.tube([[8, 4], [11, 11], [13, 17], [17, 20]], (t: number) => 3.5 * (1 - t) + 0.6, rp('#0a0808', '#1a1614', '#2a2420', '#3e3630', '#5e544a', '#a89a88'), { cap: 'round' });
  p.line(10, 6, 14, 15, H('#5e544a'));
} };
FINDS10.fos_shell = { draw: p => {
  const m = p.maskFn((x, y) => { const dx = x + 0.5 - 12, dy = y + 0.5 - 18, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); return Math.abs(a) < 1 && r < 12 - Math.abs(Math.sin(a * 5)) && r > 1; });
  p.puff(m, LIME, { r: 3 });
  for (let k = -3; k <= 3; k++) p.line(12, 17, 12 + k * 2.4, 8, H('#7a7058'));
} };
FINDS10.smp_limestone = { draw: p => { p.ball(12, 13, 7, 6, LIME); p.px(9, 11, H('#8a8068')); p.px(14, 15, H('#8a8068')); } };
FINDS10.smp_cavewater = { draw: p => jar(p, ['#0a2a3a', '#14465e', '#226a86', '#3a90aa', '#6ab8c8', '#c4eef2']) };
FINDS10.smp_soil = { draw: p => { p.tube([[6, 16], [18, 8]], 3.5, rp('#0e0806', '#1e140c', '#2e2014', '#42301e', '#5a442c', '#7a6040'), { cap: 'flat' }); p.line(8, 14, 16, 9, H('#e8e0d0')); } };
FINDS10.smp_mud = { draw: p => jar(p, ['#060504', '#0e0c0a', '#1a1612', '#262018', '#36302a', '#5a5040'], { dark: true }) };
FINDS10.smp_falls = { draw: p => jar(p, ['#0a3a4a', '#146a7e', '#2a90a6', '#4ab4c6', '#86d8e2', '#e4fcff']) };
FINDS10.smp_ash = { draw: p => bag(p, ['#2a0e06', '#5a2412', '#8a3c1e', '#b0582c', '#cc7a44', '#e8a46a']) };
FINDS10.smp_hotwater = { draw: p => jar(p, ['#0a3a3a', '#146a66', '#22968c', '#3cc0b0', '#7ae4d4', '#e0fff8']), post: p => { for (const x of [10, 13]) for (let k = 0; k < 4; k++) p.blend(x + (k % 2), 3 - k, H('#ffffff', 120)); } };
FINDS10.smp_sulfur = { draw: p => { for (const [x, y, l] of [[8, 18, 9], [12, 19, 12], [16, 18, 8], [10, 17, 6]] as const) p.tube([[x, y], [x + 1, y - l]], 1.6, RAMP.yellow, { cap: 'flat' }); } };
FINDS10.smp_crystal = { draw: p => {
  p.slab([12, 3, 16, 9, 15, 20, 9, 20, 8, 9], rp('#0a2a1a', '#145a34', '#2a8a52', '#5abc82', '#a4ecc0', '#f0fff6'), 3);
  p.line(12, 4, 12, 19, H('#d4ffe4'));
}, post: p => { halo(p, 12, 12, 9, '#7affb0', 60); sparkle(p, 17, 6, '#e8fff0'); } };
FINDS10.smp_scree = { draw: p => { p.ball(12, 13, 7, 6, OCHRE); for (const y of [10, 13, 16]) p.line(6, y, 18, y - 1, H(y === 13 ? '#e8dcc0' : '#6a3a28')); } };
FINDS10.plt_lanterncap = { draw: p => {
  p.tube([[12, 20], [12, 11]], 1.8, RAMP.cream, { cap: 'flat' });
  const cap = p.maskFn((x, y) => { const dx = (x + 0.5 - 12) / 9, dy = (y + 0.5 - 11) / 6; return dx * dx + dy * dy < 1 && y < 11; });
  p.puff(cap, RAMP.dusk, { r: 3 });
  p.rect(5, 10, 14, 1, H('#7affe0'));
}, post: p => halo(p, 12, 11, 8, '#7affe0', 70) };
FINDS10.plt_ghostfern = { draw: p => { p.tube([[12, 21], [12, 4]], 0.9, RAMP.cream); for (let i = 0; i < 7; i++) { const y = 6 + i * 2.2, l = 6 - i * 0.6; p.line(12, y, 12 - l, y - 2, H('#e8f4f0')); p.line(12, y, 12 + l, y - 2, H('#d4e4e0')); } } };
FINDS10.plt_thermomat = { draw: p => { p.slab([3, 12, 21, 9, 21, 16, 3, 19], RAMP.orange, 3); p.line(4, 13, 20, 10, H('#7aa040')); p.line(4, 16, 20, 13, H('#e8c040')); } };
FINDS10.plt_cavelichen = { draw: p => { p.ball(12, 13, 7, 6, RAMP.stone); for (const [x, y] of [[9, 11], [13, 10], [15, 14], [10, 15], [12, 13]] as const) p.ball(x, y, 2, 1.6, RAMP.silver); } };
FINDS10.plt_pavine = { draw: p => { p.tube([[4, 20], [10, 14], [16, 10], [20, 4]], 1, RAMP.leaf); for (const [x, y] of [[9, 13], [14, 9], [18, 6]] as const) p.tube([[x, y], [x + 3, y + 4]], 1.4, RAMP.red, { cap: 'round' }); } };
FINDS10.plt_throatfern = { draw: p => bag(p, ['#2a1408', '#4a2a12', '#6a4020', '#8a5a30', '#a87848', '#c89a68']) };
FINDS10.gift_kete = { draw: p => {
  const m = p.maskFn((x, y) => y > 8 && y < 21 && Math.abs(x - 12) < 8 - (y - 8) * 0.12);
  p.slab(m, rp('#2a2010', '#4a3a1c', '#6a5428', '#8c7238', '#ac904c', '#c8aa62'), 3, { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : 0) });
  p.tube([[6, 9], [9, 3], [15, 3], [18, 9]], 1, rp('#2a2010', '#4a3a1c', '#6a5428', '#8c7238', '#ac904c', '#c8aa62'));
} };
FINDS10.vil_rewena = { draw: p => { p.ball(12, 14, 8, 6, RAMP.pale); p.line(8, 12, 11, 10, H('#7a4a1c')); p.line(12, 13, 15, 11, H('#7a4a1c')); } };
FINDS10.vil_kumara = { draw: p => { p.ball(12, 13, 8, 5, RAMP.pink, { ang: -0.4 }); p.px(8, 14, H('#3a1010')); p.px(15, 11, H('#3a1010')); } };
FINDS10.vil_tea = { draw: p => { p.ball(12, 15, 6, 6, RAMP.khaki); p.slab(p.maskBox(10, 5, 4, 5), RAMP.khaki, 2); p.slab(p.maskBox(10, 3, 4, 2), RAMP.wood, 3); } };
FINDS10.joshu_compass = { draw: p => { p.ball(12, 13, 8, 8, RAMP.brass); p.ball(12, 13, 5.5, 5.5, RAMP.cream, { flat: 0.6 }); p.line(12, 9, 12, 13, H('#a8382a')); p.line(12, 13, 12, 17, H('#1a1a1a')); p.ball(12, 4, 1.6, 1.4, RAMP.brass); } };
FINDS10.joshu_cap = { draw: p => { p.ball(12, 13, 8, 6, RAMP.red, { clip: (_x, y) => y < 14 }); p.slab([4, 14, 20, 14, 22, 17, 2, 17], rp('#000', '#0c0808', '#181214', '#241c1e', '#342a2c', '#443a3c'), 2); p.ball(12, 8, 1.4, 1.2, RAMP.yellow); } };
FINDS10.joshu_log = { draw: p => { p.slab([5, 5, 18, 4, 19, 20, 6, 21], RAMP.cream, 3); for (const y of [8, 11, 14, 17]) p.line(7, y, 16, y - 0.5, H('#3a4a6a')); p.slab([5, 5, 9, 5, 5, 9], RAMP.khaki, 2); } };
