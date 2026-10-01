// Skill-tree icons (24px) and UI / app glyphs (24px app icons, 16px tiny symbols shown at text size).

import { Pen, RAMP, H, rp, hash, alpha, tone, IconSet, Pt } from './pen';
import { frame, ring, lens, halo, sparkle, wisp, bez } from './parts';

export const SKILLS: IconSet = {};
export const UI: IconSet = {};

const GREEN = rp('#0c2410', '#18461a', '#2a7226', '#46a036', '#86d05a', '#d4f8a0');
const GOLD = rp('#3e1a06', '#7a3a0c', '#b86a16', '#e8a030', '#fad26a', '#fff6cc');
const PAPER = rp('#5a4a36', '#8e7a5c', '#bca886', '#e0d2ae', '#f6eed6', '#fffcf2');
const WHITE = rp('#4e5460', '#848c96', '#b4bcc2', '#dce2e2', '#f4f6f2', '#ffffff');
const SCREEN = rp('#06101a', '#0c1c2c', '#14304a', '#1e4a6c', '#3a7aa0', '#8ad0f0');

/** L-shaped focus brackets in the four corners */
function brackets(p: Pen, x0: number, y0: number, x1: number, y1: number, len: number, ramp: number[]) {
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    const m = Pen.or(p.maskBox(sx > 0 ? cx : cx - len + 1, sy > 0 ? cy : cy - 1, len, 2), p.maskBox(sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - len + 1, 2, len));
    p.slab(m, ramp, 3);
  }
}

// ================================================================ camera branch
SKILLS.card = {
  draw: p => {
    // an SD card: notched corner, gold contacts, a label
    const card = p.maskPoly([7, 2, 18, 2, 18, 22, 4, 22, 4, 5]);
    p.slab(card, RAMP.navy, 3, { hi: 2, lo: -1 });
    for (let x = 7; x <= 16; x += 2) p.slab(p.maskBox(x, 3, 1, 4), GOLD, 4, { bevel: false });
    p.slab(p.maskBox(6, 10, 10, 9, 1), WHITE, 4);
    p.rect(7, 12, 7, 1, RAMP.blue[3]); p.rect(7, 14, 5, 1, RAMP.steel[3]); p.rect(7, 16, 6, 1, RAMP.steel[3]);
    p.px(15, 17, RAMP.red[3]);
    p.slab(p.maskBox(18, 9, 2, 4), RAMP.navy, 3);
  },
};

SKILLS.lens = {
  draw: p => {
    // telephoto lens, side on: mount, zoom ring, barrel, glass front
    p.tube([[2.6, 12], [5, 12]], 4.4, RAMP.chrome, { cap: 'flat' });
    const b = p.tube([[5, 12], [16.6, 12]], 5.4, RAMP.iron, { cap: 'flat', lift: 0.6 });
    p.fill(b, (x, y) => (x >= 8 && x <= 12 && x % 2 === 0 ? RAMP.iron[1] : x === 14 ? RAMP.red[3] : -1));
    p.tube([[16.4, 12], [19.4, 12]], 6.6, RAMP.iron, { cap: 'flat', lift: 1 });
    p.fill(p.maskEllipse(19.6, 12, 2, 6.2), (x, y) => (y < 9 ? H('#7aa0e0') : y < 12 ? H('#2c3f86') : H('#141c44')));
    p.px(19, 8, H('#ffffff'));
  },
};

SKILLS.af = {
  draw: p => {
    brackets(p, 2, 2, 21, 21, 6, GREEN);
    p.ball(12, 12, 2.6, 2.6, GREEN, { lift: 1, spec: 0.9 });
  },
  post: p => { halo(p, 12, 12, 6, '#a8ff80', 90); },
};

SKILLS.af2 = {
  draw: p => {
    brackets(p, 1, 2, 22, 21, 5, GOLD);
    // a little lizard being tracked
    const Lz = RAMP.lime;
    p.tube(bez([6, 15], [10, 9], [16, 12], 12), t => 1.8 - t * 0.6, Lz, { spec: 1 });
    p.tube(bez([16, 12], [19, 14], [19, 17], 8), t => 1.2 - t * 0.8, Lz);
    p.ball(5.4, 15.6, 2.2, 1.7, Lz, { ang: 0.6, lift: 0.4 });
    p.px(5, 15, H('#141a08'));
    for (const [x, y, dx, dy] of [[9, 12, -1, 2], [12, 11, 1, 2], [9, 11, -1, -2], [13, 11, 1, -2]] as number[][]) p.line(x, y, x + dx, y + dy, Lz[2]);
  },
};

SKILLS.stab = {
  draw: p => {
    // a camera held steady: amber shake marks cancelled either side
    p.slab(p.maskBox(5, 8, 14, 10, 2), RAMP.iron, 2);
    p.slab(p.maskBox(5, 6, 14, 3, 1), RAMP.chrome, 3);
    p.slab(p.maskBox(8, 4, 5, 3), RAMP.chrome, 3);
    ring(p, 12, 13, 2.6, 4, RAMP.steel);
    lens(p, 12, 13, 2.6);
  },
  post: p => {
    for (const x of [2, 21]) for (let y = 7; y <= 18; y++) p.blend(x + ((y % 4 < 2) ? 0 : x < 12 ? -1 : 1), y, H('#f4b43c', 235));
    for (const x of [0, 23]) for (let y = 9; y <= 16; y++) p.blend(x + ((y % 4 < 2) ? 0 : x < 12 ? 1 : -1), y, H('#f4b43c', 140));
  },
};

SKILLS.video = {
  draw: p => {
    // a video camera: body, lens hood, flip screen, a red REC light
    p.slab(p.maskBox(3, 7, 13, 11, 2), RAMP.iron, 3);
    p.slab(p.maskPoly([16, 9.5, 22, 6, 22, 19, 16, 15.5]), RAMP.iron, 2);
    p.slab(p.maskBox(5, 4, 6, 3, 1), RAMP.iron, 3);
    p.slab(p.maskBox(5, 10, 6, 5, 1), SCREEN, 3);
    p.px(6, 11, SCREEN[5]);
    p.ball(13.6, 9.6, 1.4, 1.4, RAMP.red, { lift: 1.4, spec: 0.8 });
  },
  post: p => { halo(p, 13.6, 9.6, 3.2, '#ff6040', 120); },
};

SKILLS.lens2 = {
  draw: p => {
    // a big white super-telephoto with the red ring
    p.tube([[2, 12], [4.4, 12]], 4, RAMP.iron, { cap: 'flat', lift: 1 });
    const b = p.tube([[4.4, 12], [17, 12]], t => 4.6 + t * 1.8, WHITE, { cap: 'flat' });
    p.fill(b, (x) => (x === 15 ? RAMP.red[3] : x === 8 || x === 10 ? WHITE[2] : -1));
    p.tube([[17, 12], [21, 12]], 7.2, WHITE, { cap: 'flat', lift: -0.4 });
    p.fill(p.maskEllipse(21.4, 12, 1.6, 6.8), (x, y) => (y < 9 ? H('#7aa0e0') : y < 13 ? H('#2c3f86') : H('#141c44')));
    p.px(21, 7, H('#ffffff'));
  },
};

SKILLS.shutter = {
  draw: p => {
    // aperture iris: six overlapping blades round a small opening
    ring(p, 12, 12, 8.4, 10.6, RAMP.iron, { lift: 0.6 });
    p.fill(p.maskDisc(12, 12, 8.4), (x, y) => {
      const dx = x + 0.5 - 12, dy = y + 0.5 - 12;
      const d = Math.hypot(dx, dy);
      if (d < 2.8) return d < 1.6 ? H('#9cc8f0') : H('#2c4b80');
      const a = Math.atan2(dy, dx) + d * 0.09;
      const f6 = (((a / (Math.PI * 2)) * 6) % 6 + 6) % 6;
      const blade = Math.floor(f6), fr = f6 - blade;
      if (fr < 0.14) return RAMP.iron[1];
      const lit = Math.cos(blade / 6 * Math.PI * 2 + 2.4);
      return RAMP.steel[Math.max(1, Math.min(4, Math.round(2.6 + lit * 1.4 + (fr > 0.75 ? 0.6 : 0))))];
    });
  },
};

SKILLS.night = {
  draw: p => {
    const Mn = rp('#4a4024', '#7c6e3a', '#b8a85c', '#e6d890', '#fff4c4', '#ffffff');
    const moon = Pen.sub(p.maskDisc(10.4, 12.6, 8.4), p.maskDisc(15.6, 9.2, 7.4));
    p.puff(moon, Mn, { r: 3, spec: 1, lift: 0.4 });
    p.pts([[5, 15], [6, 17], [8, 19]], Mn[2]);
  },
  post: p => { sparkle(p, 19, 17, '#fff8d0', true); sparkle(p, 20, 4, '#fff8d0'); sparkle(p, 14, 2, '#fff8d0'); },
};

// ================================================================ field branch
SKILLS.boot = {
  draw: p => {
    const Lt = rp('#1e0e06', '#3e2010', '#64381c', '#8c5428', '#b4783a', '#dca462');
    // a laced hiking boot with a chunky sole
    const rows = [
      '.......bbbbbbb..........',
      '.......bbbbbbb..........',
      '.......bbbbbbb..........',
      '.......bbbbbbb..........',
      '.......bbbbbbbb.........',
      '.......bbbbbbbb.........',
      '.......bbbbbbbb.........',
      '......bbbbbbbbbb........',
      '......bbbbbbbbbbbb......',
      '......bbbbbbbbbbbbbb....',
      '.....bbbbbbbbbbbbbbbbb..',
      '.....bbbbbbbbbbbbbbbbbb.',
      '.....bbbbbbbbbbbbbbbbbb.',
      '.....bbbbbbbbbbbbbbbbbb.',
    ];
    const m = p.maskMap(rows, 'b', -2, 2);
    p.puff(m, Lt, { r: 3, spec: 0.97 });
    p.slab(p.maskBox(3, 16, 20, 3, 1), RAMP.rubber, 3, { tex: x => (x % 3 === 0 ? -1 : 0) });
    p.slab(p.maskBox(5, 2, 7, 2), Lt, 4);
    for (let y = 4; y <= 11; y += 2) { p.px(7, y, GOLD[4]); p.px(10, y, GOLD[4]); p.line(8, y, 9, y + 1, RAMP.cream[4]); }
    p.rect(5, 14, 17, 1, Lt[1]);
  },
};

SKILLS.lure = {
  draw: p => {
    // a grub on a hook on a line
    p.line(12, 0, 12, 4, RAMP.cream[3]);
    p.tube([[12, 4], [12, 15], [10, 19.6], [6.6, 19.2], [5.4, 15.8]], 0.8, RAMP.chrome);
    p.px(5, 14, RAMP.chrome[5]); p.px(6, 15, RAMP.chrome[4]);
    const Cr = rp('#6a5234', '#a88c60', '#d2ba8a', '#ecdcb0', '#fbf2d6', '#ffffff');
    const g = p.tube(bez([16.4, 7], [8, 9], [16, 15], 12), 2, Cr, { spec: 0.95 });
    p.fill(g, (x, y) => (y % 2 ? Cr[2] : -1));
    p.ball(16.6, 6.6, 1.6, 1.5, RAMP.orange, { lift: -0.5 });
  },
};

SKILLS.eye = {
  draw: p => {
    // a calm eye peeking out under a fern-leaf brow: stillness
    const e = p.maskEllipse(12, 14, 9.4, 5);
    p.fill(e, (x, y) => (Math.hypot((x + 0.5 - 12) / 9.4, (y + 0.5 - 14) / 5) > 0.8 ? WHITE[2] : WHITE[4]));
    p.ball(12, 14, 3.6, 3.6, RAMP.teal, { lift: 0.4, spec: 1 });
    p.ball(12, 14, 1.6, 1.6, RAMP.iron, { lift: -1, spec: 1 });
    p.px(10, 12, H('#ffffff')); p.px(11, 12, H('#ffffff'));
    const leaf = p.ball(12, 8.6, 11, 3.4, RAMP.leaf, { spec: 1, clip: (x, y) => y < 11 });
    p.fill(leaf, (x, y) => (y === 8 ? RAMP.leaf[5] : (x + y) % 3 === 0 && y < 8 ? RAMP.leaf[4] : -1));
  },
};

SKILLS.track = {
  draw: p => {
    const Mu = rp('#1c1008', '#3a2412', '#5a3a1e', '#7a5430', '#9c7248', '#c09a6c');
    // two paw prints pressed into mud
    const paw = (cx: number, cy: number, s: number) => {
      const pad = p.ball(cx, cy + 1.4 * s, 3 * s, 2.4 * s, Mu, { spec: 1, lift: -0.6 });
      void pad;
      for (const [dx, dy] of [[-3.2, -2], [-1.1, -3.6], [1.1, -3.6], [3.2, -2]]) p.ball(cx + dx * s, cy + dy * s, 1.3 * s, 1.5 * s, Mu, { spec: 1, lift: -0.6 });
    };
    paw(15.4, 7.4, 1);
    paw(7.6, 16.6, 1);
  },
};

// ================================================================ survival branch
const PACK = rp('#14200c', '#26381a', '#3c5426', '#567234', '#7a944a', '#a8bc6e');
SKILLS.pack = {
  draw: p => {
    // a canvas field pack: flap, front pocket, buckles, top handle
    p.tube([[9, 3.6], [15, 3.6]], 1.2, RAMP.wood, { cap: 'flat' });
    const body = p.maskBox(4, 5, 16, 17, 4);
    p.puff(body, PACK, { r: 4, spec: 1 });
    const flap = p.maskBox(4, 5, 16, 6, 3);
    p.slab(flap, PACK, 4);
    p.rect(4, 10, 16, 1, PACK[1]);
    const pocket = p.maskBox(7, 13, 10, 7, 2);
    p.slab(pocket, PACK, 3);
    for (const x of [8, 15]) { p.slab(p.maskBox(x, 9, 2, 6), RAMP.wood, 3); p.px(x, 13, GOLD[4]); p.px(x + 1, 13, GOLD[3]); }
  },
};

SKILLS.pack2 = {
  draw: p => {
    // bigger expedition pack on a frame with a bedroll strapped on top
    p.tube([[3, 2], [3, 22]], 0.8, RAMP.chrome, { cap: 'flat' });
    p.tube([[21, 2], [21, 22]], 0.8, RAMP.chrome, { cap: 'flat' });
    const body = p.maskBox(4, 8, 16, 15, 4);
    p.puff(body, PACK, { r: 4, spec: 1 });
    p.slab(p.maskBox(4, 8, 16, 5, 3), PACK, 4);
    p.slab(p.maskBox(7, 15, 10, 6, 2), PACK, 3);
    const roll = p.tube([[5, 4.4], [19, 4.4]], 2.8, RAMP.khaki, { cap: 'flat', spec: 1 });
    p.fill(roll, (x) => (x === 8 || x === 16 ? RAMP.wood[2] : -1));
    p.fill(p.maskEllipse(19.4, 4.4, 1.2, 2.8), (x, y) => (y % 2 ? RAMP.khaki[1] : RAMP.khaki[3]));
  },
};

SKILLS.hand = {
  draw: p => {
    const Sk = RAMP.skin;
    // an open hand, quick and nimble
    p.puff(p.maskBox(8, 10, 10, 9, 3), Sk, { r: 3, spec: 1 });
    for (const [x0, y0, x1, y1, r] of [[9.2, 11, 9, 4.4, 1.25], [12, 11, 12, 2.6, 1.3], [14.8, 11, 15.2, 3.6, 1.25], [17.2, 12, 18, 6.4, 1.1]] as number[][]) { const m = p.tube([[x0, y0], [x1, y1]], r, Sk, { spec: 1 }); p.seam(m, Sk[2], 12); }
    const th = p.tube([[9, 16], [5, 11.6]], 1.4, Sk, { spec: 1 });
    p.seam(th, Sk[2], 8);
    p.rect(9, 19, 8, 3, RAMP.khaki[3]); p.rect(9, 19, 8, 1, RAMP.khaki[4]);
  },
  post: p => {
    for (let i = 0; i < 3; i++) { p.blend(1, 10 + i * 3, H('#ffffff', 220)); p.blend(2, 10 + i * 3, H('#ffffff', 150)); p.blend(3, 10 + i * 3, H('#ffffff', 80)); }
  },
};

SKILLS.eye2 = {
  draw: p => {
    const e = p.maskEllipse(11, 13, 9.6, 5.6);
    p.fill(e, (x, y) => (Math.hypot((x + 0.5 - 11) / 9.6, (y + 0.5 - 13) / 5.6) > 0.8 ? WHITE[2] : WHITE[4]));
    p.ball(11, 13, 4, 4, GOLD, { lift: 0.4, spec: 1 });
    p.ball(11, 13, 1.8, 1.8, RAMP.iron, { lift: -1, spec: 1 });
    p.px(9, 11, H('#ffffff')); p.px(10, 11, H('#ffffff')); p.px(9, 12, H('#ffffff'));
  },
  post: p => { sparkle(p, 20, 4, '#fff4b0', true); },
};

SKILLS.heart = {
  draw: p => {
    const hrt = p.maskFn((x, y) => { const X = (x + 0.5 - 12) / 8.6, Y = -(y + 0.5 - 10.4) / 8.6; const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; });
    p.puff(hrt, RAMP.red, { r: 4, spec: 0.94 });
    p.slab(Pen.or(p.maskBox(10, 7, 4, 10), p.maskBox(7, 10, 10, 4)), WHITE, 4);
  },
};

// ================================================================ lab branch
SKILLS.micro = {
  draw: p => {
    const Mt = rp('#0e1a1e', '#1c3238', '#2c5058', '#447880', '#6aa8ae', '#b4e4e6');
    // a field microscope: base, arm, tube, stage, eyepiece and a focus knob
    p.slab(p.maskBox(3, 19, 18, 4, 2), Mt, 2);
    p.tube(bez([16, 19], [20, 12], [14.6, 5.6], 12), 1.7, Mt, { spec: 1 });
    p.slab(p.maskBox(5, 13, 12, 2), RAMP.iron, 3);
    p.tube([[8.2, 3], [11, 11]], 1.9, RAMP.chrome, { cap: 'flat' });
    p.tube([[7.6, 1.6], [8.4, 3.4]], 2.3, RAMP.iron, { cap: 'flat', lift: 1 });
    p.tube([[11, 10.8], [11.4, 12.4]], 1.1, RAMP.iron, { cap: 'flat' });
    p.ball(18, 11, 1.8, 1.8, RAMP.chrome, { spec: 0.9 });
    p.px(9, 12, RAMP.glass[4]); p.px(10, 12, RAMP.glass[3]);
  },
};

SKILLS.clock = {
  draw: p => {
    // a stopwatch
    p.slab(p.maskBox(10, 0, 4, 3, 1), RAMP.chrome, 3);
    p.tube([[18.6, 4.4], [20.2, 6]], 1.2, RAMP.chrome);
    p.ball(12, 13.6, 8.6, 8.6, RAMP.chrome, { spec: 0.97 });
    p.fill(p.maskDisc(12, 13.4, 7.6), (x, y) => (Math.hypot(x + 0.5 - 11, y + 0.5 - 12.4) < 5 ? WHITE[5] : WHITE[4]));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; p.px(12 + Math.cos(a) * 6.4, 13.4 + Math.sin(a) * 6.4, i % 3 === 0 ? RAMP.iron[1] : WHITE[2]); }
    p.line(12, 13, 12, 8, RAMP.iron[1]);
    p.line(12, 13, 15, 16, RAMP.red[3]);
    p.px(12, 13, RAMP.red[2]);
  },
};

SKILLS.photoid = {
  draw: p => {
    // a photo of a bird under a magnifying glass
    p.slab(p.maskBox(1, 2, 16, 14, 0), WHITE, 4, { hi: 1, lo: -2 });
    p.fill(p.maskBox(2, 3, 14, 9), (x, y) => (y < 8 ? (x + y) % 9 === 0 ? H('#cfe8f4') : H('#a2d0ea') : RAMP.leaf[3 - (y > 9 ? 1 : 0)]));
    p.ball(6, 7, 1.6, 1.2, RAMP.fur, { lift: 0.5 });
    p.px(5, 6, RAMP.iron[0]);
    p.rect(3, 13, 7, 1, WHITE[2]);
    ring(p, 15.2, 14.4, 3.6, 5.2, RAMP.iron, { lift: 1 });
    p.fill(p.maskDisc(15.2, 14.4, 3.6), (x, y) => alpha(x + y < 28 ? H('#e8f8ff') : H('#a8d4ec'), 200));
    p.tube([[19, 18.2], [21.8, 21]], 1.3, RAMP.briar, { spec: 1 });
  },
};

SKILLS.dna = {
  draw: p => {
    for (let y = 1; y <= 22; y++) {
      const t = (y - 1) / 21 * Math.PI * 2.2;
      const a = 12 + Math.sin(t) * 6.4, c = 12 - Math.sin(t) * 6.4;
      const front = Math.cos(t) > 0;
      if (y % 3 === 0) p.line(Math.min(a, c) + 1, y, Math.max(a, c) - 1, y, front ? WHITE[3] : WHITE[1]);
      const ca = front ? RAMP.teal : RAMP.violet, cc = front ? RAMP.violet : RAMP.teal;
      p.ball(a, y + 0.5, 1.5, 1, ca, { lift: front ? 1 : -1, spec: 1 });
      p.ball(c, y + 0.5, 1.5, 1, cc, { lift: front ? -1 : 1, spec: 1 });
    }
  },
};

SKILLS.chart = {
  draw: p => {
    p.slab(p.maskBox(1, 21, 22, 2), RAMP.iron, 3);
    p.slab(p.maskBox(1, 2, 2, 20), RAMP.iron, 3);
    p.slab(p.maskBox(4, 13, 5, 8), RAMP.teal, 3);
    p.slab(p.maskBox(10, 6, 5, 15), GOLD, 3);
    p.slab(p.maskBox(16, 10, 5, 11), RAMP.red, 3);
    p.line(6, 10, 12, 3, GREEN[4]); p.line(12, 3, 18, 7, GREEN[4]);
  },
};

SKILLS.grant = {
  draw: p => {
    // a typed proposal with a red wax seal and ribbons
    p.slab(p.maskBox(3, 1, 16, 21, 1), PAPER, 4, { hi: 1, lo: -2 });
    for (let y = 4; y <= 14; y += 2) p.rect(5, y, y === 4 ? 10 : y % 4 === 0 ? 11 : 9, 1, PAPER[2]);
    p.tube([[14, 18], [12, 23]], 1, RAMP.red, { cap: 'flat' });
    p.tube([[16, 18], [18.4, 23]], 1, RAMP.red, { cap: 'flat' });
    p.ball(15, 17, 3.8, 3.8, RAMP.red, { spec: 0.93 });
    p.px(14, 16, RAMP.red[4]); p.px(15, 17, RAMP.red[1]); p.px(16, 16, RAMP.red[1]);
  },
};

// ================================================================ UI: tiny glyphs (16px)
UI.rp = {
  size: 16,
  draw: p => {
    p.ball(8, 8, 7, 7, GOLD, { spec: 0.96 });
    p.fill(p.maskDisc(8, 8, 4.8), (x, y) => (Math.hypot(x + 0.5 - 7.4, y + 0.5 - 7.4) < 3.2 ? RAMP.teal[3] : RAMP.teal[2]));
    p.map(['.xx.', 'x..x', 'xxx.', 'x.x.', 'x..x'], { x: H('#e8fff4') }, 6, 5);
  },
};
UI.lock = {
  size: 16,
  draw: p => {
    const sh = Pen.sub(p.maskEllipse(8, 6.4, 4.6, 5), p.maskEllipse(8, 6.4, 2.6, 3.2));
    p.fill(sh, (x, y) => (y >= 7 ? -1 : x < 8 ? RAMP.chrome[4] : RAMP.chrome[2]));
    p.slab(p.maskBox(2, 7, 12, 8, 1), GOLD, 3, { hi: 1, lo: -1 });
    p.pts([[7, 9], [8, 9], [7, 10], [8, 10], [7, 11]], RAMP.briar[0]);
  },
};
UI.check = {
  size: 16,
  draw: p => {
    p.tube([[3, 8.6], [6.4, 12], [12.8, 4]], 1.4, GREEN, { lift: 0.6 });
  },
};
const starPts = (cx: number, cy: number, r0: number, r1: number) => {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? r1 : r0; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return pts;
};
UI.star = {
  size: 16,
  draw: p => {
    const m = p.maskPoly(starPts(8, 8.6, 7.6, 3.2));
    p.puff(m, GOLD, { r: 2, spec: 0.95, lift: 0.3 });
    p.px(6, 6, H('#ffffff'));
  },
};
UI.star0 = {
  size: 16,
  draw: p => {
    const m = p.maskPoly(starPts(8, 8.6, 7.6, 3.2));
    p.puff(m, rp('#141c1a', '#202c2a', '#2e3e3a', '#3e524c', '#526a62', '#6a847a'), { r: 2, spec: 1 });
  },
};
UI.question = {
  size: 16,
  draw: p => {
    p.tube([[4.6, 5], [6.6, 2.4], [10, 2.4], [11.6, 5], [9.6, 7.6], [8, 9.4], [8, 10.6]], 1.25, GOLD, { lift: 0.4 });
    p.ball(8, 13.6, 1.4, 1.4, GOLD, { lift: 0.6 });
  },
};
UI.battery = {
  size: 16,
  draw: p => {
    p.slab(p.maskBox(1, 4, 12, 8, 1), WHITE, 3, { hi: 1, lo: -1 });
    p.slab(p.maskBox(13, 6, 2, 4), WHITE, 2);
    p.slab(p.maskBox(2, 5, 10, 6), rp('#0c1a10', '#122818', '#183620', '#204a2a', '#2c6038', '#3c7a48'), 1, { bevel: false });
    p.slab(p.maskBox(3, 6, 7, 4), GREEN, 4, { hi: 1, lo: -1 });
  },
};
UI.bolt = {
  size: 16,
  draw: p => {
    const m = p.maskPoly([10, 0, 3, 9, 7.6, 9, 5, 16, 13, 6, 8.4, 6, 11, 0]);
    p.slab(m, GOLD, 4, { hi: 1, lo: -1 });
  },
};

// ================================================================ UI: app icons (24px)
UI.photos = {
  draw: p => {
    p.slab(p.maskBox(7, 1, 16, 14), PAPER, 3, { hi: 1, lo: -1 });
    p.fill(p.maskBox(8, 2, 14, 9), (x, y) => (y < 7 ? H('#e8a868') : H('#8a6a8a')));
    p.slab(p.maskBox(1, 6, 17, 17), WHITE, 4, { hi: 1, lo: -2 });
    p.fill(p.maskBox(2, 7, 15, 11), (x, y) => (y < 13 ? ((x * 3 + y) % 11 === 0 ? H('#d8f0fc') : H('#9ed0ec')) : RAMP.leaf[y > 15 ? 2 : 3]));
    p.slab(p.maskPoly([2, 18, 7, 11, 11, 15, 13, 13, 17, 18]), RAMP.leaf, 2, { hi: 1, lo: 0 });
    p.ball(13, 9.6, 1.6, 1.6, GOLD, { lift: 1.2 });
  },
};
UI.tree = {
  draw: p => {
    const ln = RAMP.teal[4];
    for (const [a, b, c, d] of [[12, 19, 12, 13], [12, 13, 6, 9], [12, 13, 18, 9], [6, 9, 6, 4], [18, 9, 18, 4]]) { p.line(a, b, c, d, ln); p.line(a + 1, b, c + 1, d, RAMP.teal[2]); }
    p.ball(12.5, 19.4, 3.2, 3.2, GOLD, { spec: 0.93 });
    p.ball(6.5, 9.4, 2.6, 2.6, RAMP.teal, { spec: 0.93 });
    p.ball(18.5, 9.4, 2.6, 2.6, RAMP.violet, { spec: 0.93 });
    p.ball(6.5, 3.4, 2.3, 2.3, GREEN, { spec: 0.93 });
    p.ball(18.5, 3.4, 2.3, 2.3, RAMP.red, { spec: 0.93 });
  },
};
UI.book = {
  draw: p => {
    // the green field guide with a gold-tooled fern on the cover
    p.slab(p.maskBox(5, 3, 16, 20, 1), PAPER, 4, { hi: 0, lo: -1 });
    for (let y = 4; y <= 21; y += 2) p.px(20, y, PAPER[2]);
    p.slab(p.maskBox(2, 1, 17, 21, 1), GREEN, 2, { hi: 2, lo: -1 });
    p.rect(4, 1, 1, 21, GREEN[1]);
    for (let i = 0; i < 6; i++) { const y = 6 + i * 2; p.px(11, y, GOLD[4]); p.px(10 - (i < 5 ? 1 : 0), y + 1, GOLD[3]); p.px(12 + (i < 5 ? 1 : 0), y + 1, GOLD[3]); if (i < 4) { p.px(9, y + 1, GOLD[2]); p.px(14, y + 1, GOLD[2]); } }
    p.line(11, 5, 11, 18, GOLD[3]);
    p.tube([[16, 21], [16, 23]], 0.7, RAMP.red, { cap: 'flat' });
  },
};
UI.notes = {
  draw: p => {
    p.slab(p.maskBox(2, 2, 15, 21), rp('#5a4a1a', '#9a8434', '#cdb456', '#f2de86', '#fbeeb0', '#fffbe0'), 3, { hi: 1, lo: -1 });
    p.slab(p.maskBox(2, 2, 15, 3), RAMP.red, 3);
    for (let x = 4; x <= 15; x += 3) p.px(x, 3, RAMP.iron[1]);
    for (let y = 8; y <= 20; y += 3) p.rect(4, y, 11, 1, H('#c4ac5a'));
    p.tube([[11, 21], [21, 4]], 1.2, GOLD, { cap: 'flat' });
    p.tube([[20.4, 5], [21.8, 2.6]], 1.2, RAMP.pink, { cap: 'flat' });
    p.pts([[11, 21], [10, 22]], RAMP.iron[1]);
  },
};
UI.readme = {
  draw: p => {
    const pg = p.maskPoly([4, 1, 15, 1, 20, 6, 20, 23, 4, 23]);
    p.slab(pg, WHITE, 4, { hi: 1, lo: -2 });
    p.slab(p.maskPoly([15, 1, 20, 6, 15, 6]), WHITE, 2, { hi: 0, lo: 0 });
    for (let y = 9; y <= 20; y += 3) p.rect(7, y, y === 18 ? 6 : 10, 1, RAMP.steel[3]);
  },
};
UI.bin = {
  draw: p => {
    p.slab(p.maskBox(9, 1, 6, 2), RAMP.chrome, 3);
    p.slab(p.maskBox(3, 3, 18, 3, 1), RAMP.chrome, 4);
    const can = p.maskPoly([5, 6, 19, 6, 17.5, 23, 6.5, 23]);
    p.slab(can, RAMP.chrome, 3, { hi: 1, lo: -1 });
    for (const x of [8, 12, 16]) p.fill(can, (xx, y) => (xx === x && y > 7 && y < 21 ? RAMP.chrome[1] : xx === x - 1 && y > 7 && y < 21 ? RAMP.chrome[4] : -1));
  },
};
UI.clue = {
  draw: p => {
    p.tube([[14.6, 14.6], [21.4, 21.4]], 1.8, RAMP.briar, { spec: 0.95 });
    ring(p, 9.6, 9.6, 6, 8, RAMP.brass);
    p.fill(p.maskDisc(9.6, 9.6, 6), (x, y) => alpha(Math.hypot(x + 0.5 - 7.6, y + 0.5 - 7.6) < 2.6 ? H('#ffffff') : x + y < 19 ? H('#d8f2ff') : H('#94c8e6'), 215));
  },
};
