// Afterimages behind fast movers (motion blur for actors; the camera's own smear is in the renderer's
// post pass). Wrap a mover's draw in drawTrail(): it keeps the last few world positions of that mover,
// and while it moves fast enough a short trail of afterimages is laid behind it, the sprite's own pixels
// at the places it was a moment ago, each a hard-pixel ordered dither (fewer pixels the older it is),
// its colours half washed toward a cool tint. They fade over a couple of frames once it slows. Drawn
// as pixel art: whole art-pixel offsets, no translucency, no soft edges (Renderer.echoBegin / echoEnd).
//
//   drawTrail(r, this, x, y, () => r.draw(...), { min: 120, full: 220 })
//
// Off with Settings > Motion blur (Renderer.motionBlurOn) and on the Low preset. `held` marks the mover
// as the subject the camera tracks (Renderer.hold), so the camera's smear leaves it sharp.

import { hexColor, type Renderer } from './renderer';

export interface TrailOpts {
  /** world speed (px/s) where the trail starts, and where it is at full strength */
  min?: number;
  full?: number;
  /** afterimages (at most 4) and the time between them (s) */
  echoes?: number;
  spacing?: number;
  /** the colour the afterimages are washed toward (0xrrggbb) */
  tint?: number;
  /** coverage of the nearest afterimage at full strength (0..1) */
  cover?: number;
  /** this is the camera's subject (Renderer.hold) */
  held?: boolean;
}

const N = 10;
interface Track { x: Float64Array; y: Float64Array; t: Float64Array; n: number; head: number; k: number; last: number }
const tracks = new WeakMap<object, Track>();
const ex = new Float64Array(4), ey = new Float64Array(4), ec = new Float64Array(4);

/** the position `age` s before the newest sample (linear between samples), or false past the history */
function at(tr: Track, age: number, out: [number, number]): boolean {
  const t0 = tr.t[tr.head] - age;
  for (let i = 0; i < tr.n - 1; i++) {
    const a = (tr.head - i + N) % N, b = (a - 1 + N) % N;
    if (tr.t[b] <= t0) {
      const span = tr.t[a] - tr.t[b], u = span > 1e-6 ? (t0 - tr.t[b]) / span : 0;
      out[0] = tr.x[b] + (tr.x[a] - tr.x[b]) * u;
      out[1] = tr.y[b] + (tr.y[a] - tr.y[b]) * u;
      return true;
    }
  }
  return false;
}

const tmp: [number, number] = [0, 0];

/**
 * Draw a mover (`draw` emits its sprites on the current layer at world position x, y) with its
 * afterimages. `key` is the mover itself (its history is kept per object).
 */
export function drawTrail(r: Renderer, key: object, x: number, y: number, draw: () => void, o: TrailOpts = {}) {
  const now = r.time;
  let tr = tracks.get(key);
  if (!tr) {
    tr = { x: new Float64Array(N), y: new Float64Array(N), t: new Float64Array(N), n: 0, head: 0, k: 0, last: now };
    tracks.set(key, tr);
  }
  // a gap (off screen, a scene change, a pause) or a jump (a teleport) starts the history again
  const px = tr.x[tr.head], py = tr.y[tr.head];
  if (tr.n && (now - tr.t[tr.head] > 0.25 || Math.hypot(x - px, y - py) > 80)) tr.n = 0;
  if (!tr.n || now > tr.t[tr.head] + 1e-4) {
    tr.head = tr.n ? (tr.head + 1) % N : 0;
    tr.x[tr.head] = x; tr.y[tr.head] = y; tr.t[tr.head] = now;
    tr.n = Math.min(N, tr.n + 1);
  } else {
    tr.x[tr.head] = x; tr.y[tr.head] = y;
  }
  // speed over the last ~1/20 s
  let vx = 0, vy = 0;
  if (tr.n > 1) {
    const age = Math.min(0.05, now - tr.t[(tr.head - tr.n + 1 + N) % N]);
    if (age > 1e-3 && at(tr, age, tmp)) { vx = (x - tmp[0]) / age; vy = (y - tmp[1]) / age; }
  }
  // strength: up at once, down over a couple of frames
  const min = o.min ?? 110, full = Math.max(min + 1, o.full ?? 200);
  const want = Math.max(0, Math.min(1, (Math.hypot(vx, vy) - min) / (full - min)));
  const dt = Math.max(0, now - tr.last);
  tr.last = now;
  tr.k = want >= tr.k ? want : tr.k + (want - tr.k) * (1 - Math.exp(-dt / 0.035));

  if (o.held) r.hold(true, vx, vy);
  if (!r.motionBlurOn || r.gfx.motionTaps === 0 || tr.k < 0.04 || tr.n < 2) {
    draw();
    if (o.held) r.hold(false);
    return;
  }
  const mark = r.echoBegin();
  draw();
  const n = Math.max(1, Math.min(4, o.echoes ?? 3)), sp = o.spacing ?? 1 / 30, cover = o.cover ?? 0.6;
  let m = 0;
  for (let j = 0; j < n; j++) {
    if (!at(tr, sp * (j + 1), tmp)) break;
    ex[m] = tmp[0] - x;
    ey[m] = tmp[1] - y;
    // fewer pixels the older it is (the oldest is a sparse stipple)
    ec[m] = cover * tr.k * (1 - j / n);
    m++;
  }
  // farthest first, so nearer afterimages draw over older ones
  if (m > 1) {
    for (let i = 0, k = m - 1; i < k; i++, k--) {
      let t = ex[i]; ex[i] = ex[k]; ex[k] = t;
      t = ey[i]; ey[i] = ey[k]; ey[k] = t;
      t = ec[i]; ec[i] = ec[k]; ec[k] = t;
    }
  }
  r.echoEnd(mark, ex, ey, ec, m, hexColor(o.tint ?? 0xcfe2ff));
  if (o.held) r.hold(false);
}
