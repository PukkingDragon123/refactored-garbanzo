// Chunk: a chunky fawn pug in a red puffer jacket. Small quadruped rig (body ellipse, four stubby
// legs, curly tail) painted with the same flat cel tones and dark outline as the anime cast, plus a
// hand-drawn head with big ringed eyes, a squashed black muzzle and a tongue that is always out.

import { PixelBuffer } from '../pixel';
import { Canvas, finish, trimPair, P2, FLAT } from '../people-rig';
import { flat } from './body';
import { tones } from '../portrait/kit';
import { hex, C } from '../color';
import type { HeadOpts } from './heads';

type Pal = [C, C, C, C];
const PAL = {
  fawn: tones('#e4b87c', { sh: 0.14, deep: 0.3, hi: 0.1 }) as Pal,
  paw: tones('#ecc690', { sh: 0.14, deep: 0.3 }) as Pal,
  mask: tones('#3e2c2a', { sh: 0.1, deep: 0.2, hi: 0.22 }) as Pal,
  coat: tones('#e0463a', { sh: 0.18, deep: 0.34, hi: 0.12 }) as Pal,
  fleece: tones('#f6eedc', { sh: 0.1, deep: 0.22 }) as Pal,
  belly: tones('#f2c8a8', { sh: 0.1 }) as Pal,
  tag: tones('#f0c040') as Pal,
};

export interface DogPose {
  /** torso ellipse centre (ground space: x forward, y up) */
  body: P2;
  /** body angle, + = nose up */
  tilt: number;
  /** body length / height scale (turning foreshortens it) */
  sx?: number;
  sy?: number;
  /** paws: front near, front far, hind near, hind far (ground space) */
  fn: P2; ff: P2; hn: P2; hf: P2;
  /** hind legs folded under the body (sitting) */
  sitting?: boolean;
  /** extra head offset from the neck point (ground px) */
  head?: P2;
  look?: 'fwd' | 'up' | 'down';
  /** tail wag offset (-1..1) */
  tail: number;
  /** on its back, legs in the air: head drawn upside down */
  belly?: boolean;
  /** curled up asleep: legs tucked away */
  curl?: boolean;
  /** legs hidden (swimming, carried in arms) */
  noLegs?: boolean;
  headBehind?: boolean;
  hrot?: number;
  /** front near paw drawn over the head (covering the face, head resting on paws) */
  pawFront?: boolean;
}

const RX = 8.6, RY = 5.2;
/** body-local point → ground */
function bl(p: DogPose, lx: number, ly: number): P2 {
  const c = Math.cos(p.tilt), s = Math.sin(p.tilt);
  const X = lx * (p.sx ?? 1), Y = ly * (p.sy ?? 1);
  return [p.body[0] + X * c - Y * s, p.body[1] + X * s + Y * c];
}

export function dogStand(o: Partial<DogPose> = {}): DogPose {
  return {
    body: [0, 8.2], tilt: 0.04,
    fn: [5.4, 1.3], ff: [6.9, 1.3], hn: [-5.4, 1.3], hf: [-3.9, 1.3],
    tail: 0, ...o,
  };
}

// ------------------------------------------------------------------ painting

const CW = 64, CH = 50, OX = 32, OY = 42;

function leg(c: Canvas, p: DogPose, joint: P2, paw: P2, near: boolean) {
  const j = c.B(joint), q = c.B(paw);
  const pal = PAL.fawn;
  c.limb(j, q, near ? 2.1 : 1.9, near ? 1.7 : 1.5, s => flat(pal, s.v * -0.5 + 0.1 - (near ? 0 : 0.55), true));
  // paw: a little oval pointing forward, lighter toes
  c.blob(q[0] + 0.6, q[1] + 0.3, 1.9, 1.3, s => flat(PAL.paw, (s.v < 0 ? 0.3 : -0.1) - (near ? 0 : 0.55), true));
  c.merge({ line: 0.3, ao: 0.12 });
  void p;
}

function tail(c: Canvas, p: DogPose) {
  // curly donut tail on top of the rump
  const w = p.tail * 0.7;
  const t = c.B(bl(p, -7.4 + w * 0.3, 4.6));
  c.blob(t[0] + w, t[1], 2.3, 2.1, s => {
    const r = Math.hypot(s.u, s.v);
    if (r < 0.38) return -1;
    return flat(PAL.fawn, (s.v < -0.1 ? 0.8 : 0) - (s.u > 0.3 ? 0.4 : 0));
  });
  c.merge({ line: 0.35, ao: 0.1 });
}

function torso(c: Canvas, p: DogPose) {
  const o = c.B(p.body);
  const tc = Math.cos(p.tilt), ts = Math.sin(p.tilt);
  const fx: P2 = [tc, -ts], uy: P2 = [-ts, -tc];
  const sx = p.sx ?? 1, sy = p.sy ?? 1;
  const rx = RX * sx, ry = RY * sy;
  // fawn body first (rump and belly show outside the jacket)
  c.frame(o, fx, uy, [-rx - 2, rx + 2, -ry - 2, ry + 2], (lx, ly) => {
    const nx = lx / rx, ny = ly / ry;
    if (nx * nx + ny * ny > 1) return -1;
    if (p.belly) return flat(PAL.belly, ny * 0.8 + 0.1);
    return flat(PAL.fawn, ny * 0.9 - 0.15);
  });
  c.merge({ line: 0.2, ao: 0 });
  // puffer jacket: quilted channels across the back, puffy (a little bigger than the body)
  const jr = 0.8;
  c.frame(o, fx, uy, [-rx - 2, rx + 2, -ry - 2, ry + 2], (lx, ly) => {
    const nx = lx / (rx + jr), ny = ly / (ry + jr);
    if (nx * nx + ny * ny > 1) return -1;
    const back = p.belly ? ny < -0.1 : true;
    if (!back) return -1;
    if (lx < -rx * 0.7 || lx > rx * 0.74) return -1;
    if (!p.belly && ny < -0.78) return -1;
    // fleece collar at the neck edge
    if (lx > rx * 0.54) return flat(PAL.fleece, ny * 0.8 + 0.2 + (lx > rx * 0.66 ? 0.2 : 0));
    // channels
    const u = (lx + rx * 0.7) / 3.1;
    const ph = u - Math.floor(u);
    if (ph < 0.14) return flat(PAL.coat, -0.85);
    const puff = Math.sin(ph * Math.PI);
    return flat(PAL.coat, (p.belly ? -ny : ny) * 0.75 + puff * 0.45 - 0.3);
  });
  c.merge({ line: 0.3, ao: 0.1 });
  // little gold tag on the collar
  if (!p.belly && !p.curl) {
    const g = c.B(bl(p, rx * 0.66, -ry * 0.36));
    c.px(g[0], g[1], PAL.tag[2]);
    c.px(g[0], g[1] + 1, PAL.tag[1]);
    c.merge({ line: 0 });
  }
}

export interface DogFrame {
  back: PixelBuffer; front: PixelBuffer | null; ax: number; ay: number; hx: number; hy: number;
  look?: 'fwd' | 'up' | 'down'; hand?: [number, number]; headBehind?: boolean; hrot?: number; hflip?: boolean;
}

export function paintChunk(p: DogPose): DogFrame {
  const was = FLAT.on;
  FLAT.on = true;
  const c = new Canvas(CW, CH, OX, OY);
  const hipJ = bl(p, -5.3, -1.6), shJ = bl(p, 5.2, -1.4);
  const hipF = bl(p, -3.9, -1.2), shF = bl(p, 6.4, -1.2);
  const legs = !p.curl && !p.noLegs;
  if (legs) {
    leg(c, p, shF, p.ff, false);
    leg(c, p, hipF, p.hf, false);
  }
  if (p.belly) tail(c, p);
  torso(c, p);
  if (legs) {
    if (p.sitting) {
      // folded haunch: a round thigh against the body, paw tucked forward
      const th = c.B(bl(p, -5.2, -1.4));
      c.blob(th[0], th[1], 3.4, 3, s => flat(PAL.fawn, -s.v * 0.8 + 0.1));
      c.merge({ line: 0.35, ao: 0.1 });
      const q = c.B(p.hn);
      c.blob(q[0] + 0.6, q[1] + 0.3, 2, 1.3, s => flat(PAL.paw, s.v < 0 ? 0.3 : -0.1));
      c.merge({ line: 0.3, ao: 0.1 });
    } else leg(c, p, hipJ, p.hn, true);
    if (p.pawFront) c.useFront(true);
    leg(c, p, shJ, p.fn, true);
    c.useFront(false);
  }
  if (!p.belly) tail(c, p);
  finish(c.back, 0);
  let fr: PixelBuffer | null = c.front;
  if (fr) {
    let any = false;
    for (let i = 0; i < fr.data.length; i++) if (fr.data[i] >>> 24) { any = true; break; }
    if (any) finish(fr, 0);
    else fr = null;
  }
  FLAT.on = was;
  const tr = trimPair(c.back, fr, 1);
  const neck = bl(p, RX * 0.8, p.belly ? RY * 0.62 : RY * 0.34);
  const hd = p.head ?? [0, 0];
  const nb = c.B([neck[0] + hd[0], neck[1] + hd[1]]);
  const pw = c.B(p.fn);
  return {
    back: tr.a, front: tr.b, ax: OX - tr.ox, ay: OY - tr.oy,
    hx: Math.round(nb[0]) - tr.ox, hy: Math.round(nb[1]) - tr.oy,
    look: p.look, hand: [Math.round(pw[0]) - tr.ox, Math.round(pw[1]) - tr.oy],
    headBehind: p.headBehind, hrot: p.hrot, hflip: p.belly,
  };
}

// ------------------------------------------------------------------ head

// o outline, F fawn, f fawn shadow, L fawn light, K dark (ears / muzzle), k dark light,
// N nose, W white (eye ring / glint), E eye, M mouth, T tongue, t tongue shadow
const HEAD = [
  '....oooooo....',
  '..ooLLLFFFoo..',
  '.oKKLLFFFFFFo.',
  'oKKKKFFFFFFFFo',
  'oKKKoFFFfFFFFo',
  '.oKoFFFfFFFFKo',
  '.oFFFFFFFFFKKo',
  '.oFFFFFFFFFKko',
  '.ofFFFFFFFKKKNo',
  '..ofFFFFKKKKKo.',
  '...offFKKKKKo..',
  '....ooooooooo..',
];
const HEAD_PAL: Record<string, string> = {
  o: '#2e1c16', F: '#e4b87c', f: '#c49058', L: '#f4d49c', K: '#3e2c2a', k: '#5e4642', N: '#140c0c',
  W: '#ffffff', E: '#1a1012', M: '#5a1a22', T: '#f07a90', t: '#c8506a', w: '#d8d0cc',
};
const HEAD_ANCHOR: [number, number] = [4, 9];
const EYE: [number, number] = [7, 5];

// eye overlays at EYE (4 wide x 3 tall): the white ring is what makes the derpy pug look
const DOG_EYES: Record<string, string[]> = {
  open: ['.WW.', 'WEEW', 'WEWW'],
  wide: ['WWWW', 'WEWW', 'WWWW'],
  tiny: ['WWWW', 'WWEW', 'WWWW'],
  half: ['oooo', 'WEEW', '.WW.'],
  closed: ['....', 'oooo', '....'],
  happy: ['.oo.', 'o..o', '....'],
  sad: ['o...', 'WEEW', 'WEWW'],
  derp: ['.WW.', 'WWEW', 'EWWW'],
  angry: ['...o', 'WEEo', 'WEWW'],
};
const DOG_EXPR: Record<string, { eye: string; mouth: string; sweat?: boolean; blush?: boolean }> = {
  neutral: { eye: 'open', mouth: 'tongue' },
  happy: { eye: 'happy', mouth: 'tongue', blush: true },
  laugh: { eye: 'happy', mouth: 'open', blush: true },
  excited: { eye: 'wide', mouth: 'open', blush: true },
  surprised: { eye: 'wide', mouth: 'o' },
  shocked: { eye: 'tiny', mouth: 'o', sweat: true },
  scared: { eye: 'tiny', mouth: 'wobble', sweat: true },
  worried: { eye: 'sad', mouth: 'wobble', sweat: true },
  sad: { eye: 'sad', mouth: 'closed' },
  tired: { eye: 'half', mouth: 'tongue' },
  sleep: { eye: 'closed', mouth: 'tongue' },
  eat: { eye: 'happy', mouth: 'chomp' },
  angry: { eye: 'angry', mouth: 'grr' },
  grumpy: { eye: 'half', mouth: 'closed' },
  derp: { eye: 'derp', mouth: 'tongue' },
  thinking: { eye: 'derp', mouth: 'closed' },
  smug: { eye: 'half', mouth: 'tongue' },
  teasing: { eye: 'half', mouth: 'tongue' },
  determined: { eye: 'angry', mouth: 'closed' },
  serious: { eye: 'open', mouth: 'closed' },
  bark: { eye: 'wide', mouth: 'bark' },
  injured: { eye: 'half', mouth: 'wobble' },
};
export const CHUNK_EXPRS = Object.keys(DOG_EXPR);
// mouth overlays, origin = (col 7, row 9): the muzzle underside
const DOG_MOUTH: Record<string, string[]> = {
  tongue: ['.....', '..MTT', '...Tt', '....o'],
  closed: ['.....', '..MMk', '.....', '.....'],
  open: ['.....', '.MMMk', '.MTTM', '..MM.'],
  o: ['.....', '..MMk', '..MMk', '.....'],
  chomp: ['.....', '.MMMk', '..TT.', '.....'],
  wobble: ['.....', '.M.Mk', '..M..', '.....'],
  grr: ['.....', '.WMWk', '.....', '.....'],
  bark: ['.....', 'MMMMk', 'MTTTM', '.MMM.'],
};

const colCache = new Map<string, C>();
const col = (h: string) => { let c = colCache.get(h); if (c === undefined) { c = hex(h); colCache.set(h, c); } return c; };

export function renderChunkHead(o: HeadOpts): { buf: PixelBuffer; ax: number; ay: number } {
  const W = Math.max(...HEAD.map(r => r.length)) + 1, H = HEAD.length + 4;
  const b = new PixelBuffer(W, H);
  const put = (rows: string[], x0: number, y0: number, onlyOver: boolean) => {
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.') continue;
        const x = x0 + i, y = y0 + j;
        if (onlyOver && !(b.get(x, y) >>> 24)) continue;
        const h = HEAD_PAL[ch];
        if (h) b.set(x, y, col(h));
      }
    });
  };
  put(HEAD, 0, 0, false);
  const ex = DOG_EXPR[o.expr] ?? DOG_EXPR.neutral;
  const ly = o.look === 'up' ? -1 : o.look === 'down' ? 0 : 0;
  const eye = o.blink && ex.eye !== 'happy' && ex.eye !== 'closed' ? 'closed' : ex.eye;
  put(DOG_EYES[eye] ?? DOG_EYES.open, EYE[0], EYE[1] + ly, true);
  // far eye peeking past the muzzle
  if (eye === 'open' || eye === 'wide' || eye === 'tiny' || eye === 'sad' || eye === 'derp' || eye === 'angry') {
    b.set(12, 5 + ly, col('#ffffff'));
    b.set(12, 6 + ly, col(eye === 'tiny' ? '#ffffff' : '#1a1012'));
  } else if (eye === 'closed' || eye === 'happy' || eye === 'half') b.set(12, 6 + ly, col('#2e1c16'));
  let m = ex.mouth;
  if (o.mouth === 1) m = m === 'tongue' || m === 'closed' ? 'open' : m;
  if (o.mouth === 2) m = 'bark';
  put(DOG_MOUTH[m] ?? DOG_MOUTH.tongue, 7, 9, false);
  if (ex.blush) { b.set(6, 8, col('#f49a9a')); b.set(7, 8, col('#f49a9a')); }
  if (ex.sweat) { b.set(1, 1, col('#7cc4f0')); b.set(1, 2, col('#4f9fd8')); }
  // re-outline anything the mouth/tongue added below the head
  const src = b.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] >>> 24 > 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (src[y * W + x] >>> 24) continue;
      if (y > 9 && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1))) {
        const nb = op(x, y - 1) ? src[(y - 1) * W + x] : op(x - 1, y) ? src[y * W + x - 1] : src[y * W + x + 1];
        if (nb === col('#f07a90') || nb === col('#c8506a') || nb === col('#5a1a22')) b.set(x, y, col('#2e1c16'));
      }
    }
  return { buf: b, ax: HEAD_ANCHOR[0], ay: HEAD_ANCHOR[1] };
}

// ------------------------------------------------------------------ animations

export interface AnimInfo { frames: number; fps: number; loop: boolean }
const A = (frames: number, fps: number, loop = true): AnimInfo => ({ frames, fps, loop });

export const CHUNK_ANIMS: Record<string, AnimInfo> = {
  idle: A(4, 3), walk: A(6, 10), run: A(6, 14), zoom: A(4, 18), sniff: A(6, 7), sit: A(2, 1.5), lie: A(2, 1.2),
  sleep: A(2, 0.8), snore: A(2, 0.9), eat: A(4, 8), shiver: A(2, 14), bark: A(2, 6), roll: A(4, 8, false), bellyUp: A(4, 6),
  scratch: A(4, 12), trip: A(4, 10, false), faceplant: A(2, 2), spin: A(8, 12), beg: A(2, 4), sneeze: A(4, 10, false),
  wiggle: A(4, 12), carried: A(2, 3), jump: A(1, 1), fall: A(1, 1), stuck: A(4, 10), dig: A(4, 12), yawn: A(4, 4, false),
  flop: A(4, 10, false), tilt: A(2, 1.5), swim: A(4, 8), turn: A(1, 1), circle: A(8, 8), sitDown: A(2, 10, false),
  standUp: A(2, 10, false), lieDown: A(3, 9, false), getUp: A(3, 9, false), talk: A(2, 6), shake: A(4, 16),
  proud: A(2, 2), hide: A(2, 3), waddle: A(6, 8),
};

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);

function gait(t: number, o: { stride: number; lift: number; bob: number; tilt?: number; speedy?: boolean }): DogPose {
  // diagonal pairs (near front + far hind) move together
  const ph = (q: number) => {
    q = frac(q);
    const st = 0.55;
    if (q < st) return { x: o.stride / 2 - (o.stride * q) / st, y: 0 };
    const k = (q - st) / (1 - st);
    return { x: -o.stride / 2 + o.stride * k, y: Math.sin(k * Math.PI) * o.lift };
  };
  const a = ph(t), b = ph(t + 0.5);
  const bob = Math.cos(TAU * 2 * t) * o.bob;
  const p = dogStand({ body: [0, 8.2 + bob], tilt: (o.tilt ?? 0.04) + Math.sin(TAU * 2 * t) * 0.03 });
  p.fn = [5.4 + a.x, 1.3 + a.y];
  p.hf = [-3.9 + a.x, 1.3 + a.y];
  p.ff = [6.9 + b.x, 1.3 + b.y];
  p.hn = [-5.4 + b.x, 1.3 + b.y];
  p.tail = Math.sin(TAU * t * 2);
  p.head = [0, -bob * 0.4];
  return p;
}

function sitPose(o: Partial<DogPose> = {}): DogPose {
  return dogStand({
    body: [-1.6, 9.2], tilt: 0.72, sitting: true,
    fn: [4.4, 1.3], ff: [5.8, 1.3], hn: [-1.6, 1.3], hf: [-0.6, 1.3],
    head: [-1.4, 0.6], tail: 0, ...o,
  });
}
function liePose(o: Partial<DogPose> = {}): DogPose {
  // sploot: belly on the floor, front paws forward, back legs out behind
  return dogStand({
    body: [0, 5.4], tilt: 0, sy: 0.92,
    fn: [9.4, 1.3], ff: [10.4, 1.4], hn: [-10.6, 1.4], hf: [-9.6, 1.6],
    head: [0.6, -2.4], tail: 0, ...o,
  });
}
function curlPose(br: number): DogPose {
  return dogStand({ body: [0, 5.2 + br * 0.3], tilt: 0, sx: 0.86, sy: 0.9 + br * 0.02, curl: true, head: [0.4, -4.6], tail: 0, look: 'down' });
}
function backPose(k: number, wig = 0): DogPose {
  // on its back: legs up, belly to the sky, head upside down
  return dogStand({
    body: [0, 5.6], tilt: 0, belly: true, sy: 0.95,
    fn: [5.4 + wig, 11.6 + k], ff: [7.2 - wig, 10.8 + k], hn: [-5.2 - wig, 11.2 + k], hf: [-3.6 + wig, 10.4 + k],
    head: [1.2, 0.4], tail: 0,
  });
}

type DogFn = (t: number) => DogPose;
const POSES: Record<string, DogFn> = {
  idle: t => {
    const br = Math.sin(TAU * t);
    const p = dogStand({ body: [0, 8.2 + (br > 0 ? 0.3 : 0)], sy: 1 + br * 0.02 });
    p.tail = Math.floor(t * 4) % 2 ? 0.4 : -0.4;
    return p;
  },
  walk: t => gait(t, { stride: 5.2, lift: 1.6, bob: 0.45 }),
  waddle: t => { const p = gait(t, { stride: 4.2, lift: 1.4, bob: 0.7 }); p.tilt += Math.sin(TAU * t) * 0.06; return p; },
  run: t => {
    const p = gait(t, { stride: 8, lift: 2.8, bob: 1.1, tilt: 0.02 });
    p.body[1] += 1;
    p.head = [0.6, (p.head?.[1] ?? 0) + 0.4];
    return p;
  },
  zoom: t => {
    // full-speed zoomies: stretched out, ears flapping, tongue flying
    const i = Math.floor(t * 4) % 4;
    const ext = i % 2 === 0;
    const p = dogStand({ body: [0, 9.6 + (ext ? 1.4 : 0)], tilt: ext ? 0.08 : -0.1, sx: ext ? 1.1 : 0.94 });
    p.fn = ext ? [9.6, 3.8] : [3.4, 1.3];
    p.ff = ext ? [10.6, 4.4] : [4.6, 1.3];
    p.hn = ext ? [-9.8, 3.6] : [-2.2, 1.3];
    p.hf = ext ? [-8.6, 4] : [-1.2, 1.3];
    p.tail = ext ? 1 : -1;
    p.head = [1, ext ? 0.6 : -0.4];
    return p;
  },
  sniff: t => { const p = gait(t, { stride: 3.6, lift: 1.1, bob: 0.3, tilt: -0.1 }); p.head = [1.6, -4.2]; p.look = 'down'; return p; },
  sit: t => sitPose({ tail: Math.sin(TAU * t) * 0.5, sy: 1 + (Math.sin(TAU * t) > 0 ? 0.02 : 0) }),
  sitDown: t => (t < 0.5 ? dogStand({ body: [-0.8, 8.4], tilt: 0.36, hn: [-3.6, 1.3], hf: [-2.4, 1.3] }) : sitPose()),
  standUp: t => (t < 0.5 ? dogStand({ body: [-0.8, 8.4], tilt: 0.36, hn: [-3.6, 1.3], hf: [-2.4, 1.3] }) : dogStand()),
  lie: t => liePose({ sy: 0.92 + Math.sin(TAU * t) * 0.02 }),
  lieDown: t => [dogStand({ body: [0, 7], tilt: -0.04 }), liePose({ body: [0, 6.2], head: [0.6, -1.6] }), liePose()][Math.min(2, Math.floor(t * 3))],
  getUp: t => [liePose(), liePose({ body: [0, 6.6], head: [0.6, -1] }), dogStand()][Math.min(2, Math.floor(t * 3))],
  sleep: t => curlPose(Math.sin(TAU * t)),
  snore: t => backPose(Math.sin(TAU * t) * 0.3),
  eat: t => {
    // face in the bowl / can, chomping
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [0, 8 - (i % 2) * 0.3], tilt: -0.2 });
    p.fn = [4.8, 1.3];
    p.head = [1.4, -6 + (i % 2) * 1.2];
    p.look = 'down';
    p.tail = i < 2 ? 0.8 : -0.8;
    return p;
  },
  shiver: t => {
    const j = Math.floor(t * 2) % 2 ? 0.5 : -0.5;
    const p = dogStand({ body: [j, 7.6], tilt: 0.02, sy: 0.96, sx: 0.96 });
    p.fn = [4.6, 1.3]; p.ff = [5.8, 1.3]; p.hn = [-4.4, 1.3]; p.hf = [-3.2, 1.3];
    p.head = [-0.6 + j, -0.8];
    p.tail = -1;
    return p;
  },
  bark: t => {
    const up = t < 0.5;
    const p = dogStand({ body: [0, 8.4 + (up ? 0.4 : 0)], tilt: up ? 0.14 : 0.04 });
    p.head = [0.4, up ? 1.2 : 0];
    p.look = up ? 'up' : 'fwd';
    p.tail = up ? 1 : -1;
    return p;
  },
  talk: t => POSES.bark(t * 0.5 + 0.5),
  roll: t => {
    const i = Math.min(3, Math.floor(t * 4));
    if (i === 0) return liePose();
    if (i === 1) return dogStand({ body: [0, 5.6], tilt: 0, sy: 0.9, fn: [6.4, 5.4], ff: [7.4, 4.4], hn: [-6.2, 5], hf: [-5.2, 4.2], head: [0.8, -2.6] });
    return backPose(i === 2 ? -0.6 : 0);
  },
  bellyUp: t => { const i = Math.floor(t * 4) % 4; return backPose(i % 2 ? 0.5 : 0, [0, 0.8, 0, -0.8][i]); },
  scratch: t => {
    const i = Math.floor(t * 4) % 4;
    const p = sitPose();
    p.sitting = false;
    p.hn = [0.6 + (i % 2) * 1.2, 7.2 + (i % 2) * 1.4];
    p.head = [-1.6, 0.4 - (i % 2) * 0.4];
    p.tilt = 0.66;
    p.look = 'up';
    return p;
  },
  trip: t => {
    const i = Math.min(3, Math.floor(t * 4));
    if (i === 0) return gait(0.2, { stride: 8, lift: 2.8, bob: 1.1 });
    if (i === 1) { const p = dogStand({ body: [1, 9.4], tilt: -0.5, fn: [8.4, 3.4], ff: [9, 2.6], hn: [-6.2, 4.6], hf: [-5, 3.8] }); p.head = [0.6, -1.4]; return p; }
    return POSES.faceplant(i === 2 ? 0 : 0.6);
  },
  faceplant: t => {
    // face in the sand, butt in the air, tail wagging anyway
    const p = dogStand({ body: [-0.6, 7.6], tilt: -0.62, fn: [5.6, 0.9], ff: [6.6, 1.2], hn: [-5, 1.3], hf: [-3.8, 1.3] });
    p.head = [0.4, -3.4];
    p.tail = t > 0.5 ? 1 : -1;
    p.look = 'down';
    return p;
  },
  spin: t => {
    // chasing its own tail: flips direction every half cycle with a squashed turning frame
    const i = Math.floor(t * 8) % 8;
    const turn = i === 3 || i === 7;
    const p = gait(t * 2, { stride: 3.6, lift: 1.2, bob: 0.4 });
    if (turn) { p.sx = 0.62; p.head = [-1.6, 0.4]; }
    p.tail = 1;
    return p;
  },
  circle: t => POSES.spin(t),
  turn: () => { const p = dogStand({ sx: 0.62 }); p.head = [-1.6, 0.4]; return p; },
  beg: t => {
    const up = t > 0.5 ? 0.6 : 0;
    const p = sitPose({ body: [-2.2, 10.4 + up], tilt: 1.22 });
    p.fn = [2.8, 11.2 + up * 1.6]; p.ff = [3.6, 10.6 + up * 1.6];
    p.head = [-2.2, 0.6 + up];
    p.tail = up ? 1 : -1;
    p.look = 'up';
    return p;
  },
  sneeze: t => {
    const i = Math.min(3, Math.floor(t * 4));
    const p = dogStand({ tilt: [0.1, 0.22, -0.18, 0.04][i] });
    p.head = [[0, -0.4, 1.4, 0][i], [0.6, 1.4, -1.6, 0][i]];
    p.look = i < 2 ? 'up' : 'fwd';
    return p;
  },
  wiggle: t => {
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [[-0.4, 0.4, -0.4, 0.4][i], 8.2], tilt: [0.08, -0.02, 0.08, -0.02][i] });
    p.hn = [-5.4 + [-0.6, 0.6, -0.6, 0.6][i], 1.3];
    p.tail = i % 2 ? 1 : -1;
    return p;
  },
  carried: t => {
    // held up in someone's arms: legs dangling, body upright-ish, looking unimpressed
    const d = t > 0.5 ? 0.5 : 0;
    const p = dogStand({ body: [0, 10], tilt: 0.9 });
    p.fn = [5, 6 - d]; p.ff = [6, 6.4 + d]; p.hn = [-1.2, 1.6 + d]; p.hf = [0, 2 - d];
    p.head = [-1.4, 0.8];
    p.tail = d ? 0.6 : -0.6;
    return p;
  },
  jump: () => { const p = dogStand({ body: [0, 9.4], tilt: 0.2, fn: [8.4, 5.6], ff: [9.2, 5], hn: [-6.4, 2.4], hf: [-5.6, 2] }); p.tail = 1; return p; },
  fall: () => { const p = dogStand({ body: [0, 9.2], tilt: -0.14, fn: [6.6, 2.2], ff: [7.6, 2], hn: [-6.6, 3.8], hf: [-5.6, 3.2] }); p.head = [0, 0.8]; return p; },
  stuck: t => {
    // wedged (under a crate, in a hole): legs paddling uselessly
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [0, 7.4], tilt: 0.02, sy: 0.9 });
    const a = [0, 1.2, 0, -1.2][i];
    p.fn = [5.4 + a, 1.6 + Math.abs(a)]; p.ff = [6.9 - a, 1.6]; p.hn = [-5.4 - a, 1.6 + Math.abs(a)]; p.hf = [-3.9 + a, 1.6];
    p.tail = i % 2 ? 1 : -1;
    return p;
  },
  dig: t => {
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [-0.6, 7.6], tilt: -0.3 });
    p.fn = [[6.6, 4.6, 6.2, 3.8][i], [1.4, 3.4, 1.3, 3][i]];
    p.ff = [[4.6, 6.4, 4, 6][i], [3, 1.4, 3.2, 1.3][i]];
    p.head = [0.8, -3.4];
    p.look = 'down';
    p.tail = i % 2 ? 1 : -1;
    return p;
  },
  yawn: t => { const i = Math.min(3, Math.floor(t * 4)); const p = sitPose(); p.head = [-1.4, [0.6, 1.4, 1.6, 0.6][i]]; p.look = i === 1 || i === 2 ? 'up' : 'fwd'; return p; },
  flop: t => {
    // dramatic flop over onto its side
    const i = Math.min(3, Math.floor(t * 4));
    if (i === 0) return dogStand({ tilt: 0.1 });
    if (i === 1) return dogStand({ body: [0, 7], tilt: 0.3, sy: 0.9, fn: [7.4, 3.4], hn: [-4.2, 2.6] });
    return liePose({ body: [0, 5], sy: 0.86, fn: [8.4, 5.2], ff: [9.4, 4.4], hn: [-9.6, 4.4], hf: [-8.6, 4], head: [0.6, -2.8] });
  },
  tilt: t => { const p = sitPose(); p.hrot = t > 0.5 ? -0.3 : 0.3; p.head = [-1.4, 0.8]; return p; },
  swim: t => {
    // doggy paddle: only the head and a bit of jacket above the water line
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [0, 6 + (i % 2) * 0.4], tilt: 0.16 });
    p.fn = [7 + [0, 1.6, 0, -1.6][i], 2.6 + (i % 2)];
    p.ff = [7.8 - [0, 1.6, 0, -1.6][i], 2.4];
    p.hn = [-6.8, 3.4]; p.hf = [-6, 3];
    p.head = [0.6, 1];
    return p;
  },
  shake: t => {
    // wet-dog shake: body wobbles side to side fast
    const i = Math.floor(t * 4) % 4;
    const p = dogStand({ body: [[-0.8, 0, 0.8, 0][i], 8.2], tilt: 0.04, sx: [0.94, 1, 0.94, 1][i] });
    p.head = [[-0.8, 0, 0.8, 0][i], 0];
    p.tail = [-1, 0, 1, 0][i];
    return p;
  },
  proud: t => { const p = sitPose({ tilt: 0.8 }); p.head = [-1.2, 1.4]; p.look = 'up'; p.tail = t > 0.5 ? 1 : 0.4; return p; },
  hide: t => { const p = curlPose(Math.sin(TAU * t)); p.pawFront = true; p.curl = false; p.noLegs = false; p.fn = [9.6, 5.2]; p.ff = [9.8, 4.4]; p.hn = [-5.6, 1.2]; p.hf = [-4.4, 1.2]; return p; },
};

export function chunkPose(anim: string, frame: number): DogPose {
  const info = CHUNK_ANIMS[anim] ?? CHUNK_ANIMS.idle;
  const fn = POSES[anim] ?? POSES.idle;
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(t);
}

export function renderChunkBody(anim: string, frame: number): DogFrame {
  return paintChunk(chunkPose(anim, frame));
}
