// V9 fishing, the wide view off the stern: everything the fishing minigame draws into the world
// (on the ship's fishing layer, in front of the sea bands) and the life under the water.
//
//  - the sea in cross-section below the surface line: sunlit turquoise just under the surface
//    deepening to navy, slanting light shafts, drifting motes, the Kittiwake's keel, rudder and
//    propeller seen through the water, and a dim seabed of sand, rock and swaying kelp far below
//  - fish shadows: dark translucent silhouettes of the actual species (a snout bass's trunk, a
//    puffer's ball, a kahawai's sail) at their true size, cruising at their own depths. Bigger,
//    rarer fish keep further out and deeper. They notice the bait, turn, approach, hover, peck at
//    it (the float taps), and then lunge and drag it under
//  - the float, the line (rod tip to float, float down to the bait; during the fight rod tip to the
//    fish's mouth) coloured by tension, splashes, ripples and bubbles
//  - the leaping fish, the catch bursting out of the water, sparkles and confetti for the show
//
// Sizes: fish are world-scale (Mori is 62 px = 1.8 m, so a 40 cm fish is ~14 px). The float, the
// line and effects are drawn in screen pixels (1 / zoom world px) so they read at any zoom.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, WHITE } from '../../gfx/renderer';
import { local, A } from '../../game/assets';
import { PixelBuffer } from '../../art/pixel';
import { hex, rgba } from '../../art/color';
import { fishShadow, fishSide } from '../../art/v9/fish';
import { fbm1, hash2 } from '../../core/math';
import type { FishDef } from '../v4/fishing';
import { PX_M } from '../v6/fishfight';

export type ShadeState = 'cruise' | 'notice' | 'approach' | 'nibble' | 'bite' | 'flee' | 'hooked' | 'leave';
export interface Shade {
  def: FishDef;
  /** cm */
  len: number;
  /** sprite length, px */
  px: number;
  /** centre of the body */
  x: number; y: number; vx: number; vy: number;
  /** -1..1, smooth (turning squashes the silhouette through zero) */
  face: number; faceT: number;
  state: ShadeState; t: number; sub: number;
  tx: number; ty: number;
  speed: number;
  /** tail beat phase, fade in/out */
  ph: number; alpha: number;
  wary: number; nib: number; boost: number;
  home: number;
  lead?: Shade; off?: [number, number];
  gone?: boolean;
}
export type ViewEvent = 'notice' | 'nibble' | 'bite' | 'stolen' | 'spooked' | 'bored';

export interface ViewHost {
  seaY(x: number): number;
  /** world polyline of the hull bottom (the sea stops above it inside the hull) */
  hullLine?(): [number, number][];
  /** draw the hull below the waterline, tinted */
  drawHullUnder?(r: Renderer, color: number): void;
}

interface Drop { x: number; y: number; vx: number; vy: number; life: number; c: number; s: number; g: number }
interface Ring { x: number; r: number; life: number; max: number }
interface Bub { x: number; y: number; vy: number; life: number; s: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const col = (h: number, a = 1) => packColor(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255, a);

// ------------------------------------------------------------------ baked textures
const WATER_STOPS: [number, number][] = [[0, 0x6cc2de], [5, 0x4aa8d0], [18, 0x3590c2], [55, 0x2878b0], [110, 0x1f6298], [180, 0x19508a], [250, 0x144272], [330, 0x10365e], [480, 0x0b2748]];
const WATER_H = 480;
function waterColor(d: number): [number, number, number] {
  let i = 0;
  while (i < WATER_STOPS.length - 2 && d > WATER_STOPS[i + 1][0]) i++;
  const [d0, c0] = WATER_STOPS[i], [d1, c1] = WATER_STOPS[i + 1];
  const t = clamp((d - d0) / (d1 - d0), 0, 1);
  const ch = (c: number, s: number) => (c >> s) & 255;
  return [ch(c0, 16) + (ch(c1, 16) - ch(c0, 16)) * t, ch(c0, 8) + (ch(c1, 8) - ch(c0, 8)) * t, ch(c0, 0) + (ch(c1, 0) - ch(c0, 0)) * t];
}
function frame(key: string, make: () => PixelBuffer, ax?: number, ay?: number): Frame {
  if (local.has(key)) return local.get(key);
  const b = make();
  return local.add(key, b, ax ?? b.w / 2, ay ?? b.h / 2);
}
const waterFrame = () => frame('fsh9:water', () => {
  // 3 texels wide and sampled in the middle column, so the AA sampler never blends in atlas padding
  const b = new PixelBuffer(3, WATER_H);
  for (let y = 0; y < WATER_H; y++) { const [r, g, bl] = waterColor(y); b.data.fill(rgba(r, g, bl), y * 3, y * 3 + 3); }
  return b;
}, 0, 0);
/** the float: red cap, white body, dark outline and a little antenna */
const bobberFrame = () => frame('fsh9:bobber', () => {
  const rows = ['...k...', '..krk..', '.krRrk.', 'krRrrrk', 'krrrrrk', 'kwWwwwk', 'kwWwwwk', '.kwwwk.', '..kwk..', '...k...'];
  const P: Record<string, number> = { k: hex('#1a1014'), r: hex('#d8342a'), R: hex('#ff8a6a'), w: hex('#e0e6ec'), W: hex('#ffffff') };
  const b = new PixelBuffer(7, 10);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (P[ch]) b.data[y * 7 + x] = P[ch]; }));
  return b;
}, 3.5, 6);
/** a wriggle of bait on the hook */
const baitFrame = () => frame('fsh9:bait', () => {
  const rows = ['.pp', 'pPp', 'gp.'];
  const P: Record<string, number> = { p: hex('#e86a8a'), P: hex('#ffb0c0'), g: hex('#d8dee4') };
  const b = new PixelBuffer(3, 3);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (P[ch]) b.data[y * 3 + x] = P[ch]; }));
  return b;
}, 1.5, 1.5);
/** a four-point sparkle, 7x7 */
const sparkFrame = () => frame('fsh9:spark', () => {
  const b = new PixelBuffer(7, 7);
  const c0 = hex('#fff6c0'), c1 = hex('#ffffff'), c2 = hex('#ffd84a');
  for (let i = 0; i < 7; i++) { b.set(3, i, i === 3 ? c1 : Math.abs(i - 3) === 1 ? c0 : c2); b.set(i, 3, i === 3 ? c1 : Math.abs(i - 3) === 1 ? c0 : c2); }
  b.set(2, 2, c2); b.set(4, 2, c2); b.set(2, 4, c2); b.set(4, 4, c2);
  return b;
});
const shadowFrames = new Map<string, Frame[]>();
function shadowsOf(id: string, px: number): Frame[] {
  const k = `${id}:${Math.round(px)}`;
  let f = shadowFrames.get(k);
  if (!f) {
    f = [-1, -0.5, 0, 0.5, 1].map((sw, i) => frame(`fsh9:sh:${k}:${i}`, () => fishShadow(id, px, sw * 0.9)));
    shadowFrames.set(k, f);
  }
  return f;
}
const sideFrames = new Map<string, Frame>();
export function sideFrame(id: string, px: number, arch = 0): Frame {
  const k = `${id}:${Math.round(px)}:${arch}`;
  let f = sideFrames.get(k);
  if (!f) { f = frame(`fsh9:side:${k}`, () => fishSide(id, px, { arch })); sideFrames.set(k, f); }
  return f;
}
/** forget frames cached for an old scene's atlas */
export function resetViewFrames() { shadowFrames.clear(); sideFrames.clear(); }

// ------------------------------------------------------------------ the view
export class FishView {
  /** mean sea level on the boat plane */
  readonly level: number;
  shades: Shade[] = [];
  /** the float on the water (dip: px pushed under, fly: 0..1 in the air) */
  bobber: { x: number; y: number; dip: number; fly: number; tilt: number } | null = null;
  bait: { x: number; y: number; alive: boolean; depth: number } | null = null;
  /** the line: from the rod tip to the float (wait), or to the hooked fish's mouth (fight) */
  line: { tip: [number, number]; to: [number, number]; ten: number; sag: number; under?: [number, number] } | null = null;
  /** cast preview: rod tip, landing x, bait depth; pulse 0..1 */
  aim: { tip: [number, number]; x: number; depth: number; t: number } | null = null;
  /** the hooked fish (drawn darker, with a bubble trail) */
  hooked: Shade | null = null;
  /** a real fish in the air: leap or the catch bursting out */
  flier: { id: string; px: number; x: number; y: number; rot: number; flip: number } | null = null;
  /** 0..1 how much of the underwater view shows (fades in as the camera pulls out) */
  under = 0;
  onEvent: ((e: ViewEvent, s: Shade) => void) | null = null;
  private drops: Drop[] = [];
  private rings: Ring[] = [];
  private bubs: Bub[] = [];
  private motes: { x: number; y: number; z: number }[] = [];
  private sparks: { x: number; y: number; t: number; life: number; s: number; vx: number; vy: number; c?: number; conf?: boolean; rot?: number }[] = [];
  private time = 0;
  private mask: { x: number[]; y: number[] } | null = null;
  /** the area fish live in */
  area = { x0: -600, x1: 20, tipX: 36, reach: 500 };

  constructor(readonly host: ViewHost, level: number) {
    this.level = level;
    for (let i = 0; i < 90; i++) this.motes.push({ x: Math.random(), y: Math.random(), z: Math.random() });
  }

  // ---------------------------------------------------------------- geometry
  surface(x: number) { return this.host.seaY(x); }
  /** the seabed: sand in long dunes with rocky outcrops */
  bed(x: number) { return this.level + 238 + (fbm1(x * 0.006, 3, 5) - 0.5) * 40 - this.rock(x); }
  /** height of a rock outcrop at x (0 = open sand) */
  rock(x: number) {
    // reefs: patches of boulders, each a lumpy dome, big ones in the middle of a patch
    const P = 260, c = Math.floor(x / P);
    let h = 0;
    for (let k = c - 1; k <= c + 1; k++) {
      if (hash2(k, 3, 7) > 0.55) continue;
      const pc = k * P + hash2(k, 4, 7) * 120, pw = 50 + hash2(k, 5, 7) * 70;
      for (let j = 0; j < 5; j++) {
        const cx = pc + (hash2(k, 10 + j, 7) - 0.5) * pw * 2, rw = 9 + hash2(k, 20 + j, 7) * 18;
        const rh = (5 + hash2(k, 30 + j, 7) * 16) * (1 - Math.abs(cx - pc) / (pw * 1.4));
        const d = (x - cx) / rw;
        if (Math.abs(d) < 1 && rh > 0) h = Math.max(h, rh * Math.sqrt(1 - d * d) * (0.9 + (fbm1(x * 0.2, 2, 9 + j) - 0.5) * 0.3));
      }
    }
    return Math.max(0, h);
  }
  private maskAt(x: number) {
    const m = this.mask;
    if (!m || x < m.x[0] || x > m.x[m.x.length - 1]) return -Infinity;
    let i = 1;
    while (i < m.x.length - 1 && m.x[i] < x) i++;
    const t = (x - m.x[i - 1]) / Math.max(1e-6, m.x[i] - m.x[i - 1]);
    return m.y[i - 1] + (m.y[i] - m.y[i - 1]) * t;
  }

  // ---------------------------------------------------------------- fish population
  /** fill the water with shadows for this view: `pick` chooses a species for a spot (dist 0..1 from the stern, depth 0..1) */
  populate(n: number, pick: (dist: number, depth: number) => FishDef | null) {
    this.shades = [];
    for (let i = 0; i < n * 3 && this.shades.length < n; i++) this.spawn(pick, false);
  }
  /** one new shadow (or a little school) somewhere in the area; arriving ones swim in from the far side */
  spawn(pick: (dist: number, depth: number) => FishDef | null, arrive: boolean) {
    const A = this.area;
    const dist = arrive ? 1.05 + Math.random() * 0.1 : Math.pow(Math.random(), 0.8) * 1.05;
    const depth = Math.random();
    const def = pick(clamp(dist, 0, 1), depth);
    if (!def) return;
    const x = arrive ? A.x0 - 30 : clamp(A.tipX - 30 - dist * A.reach, A.x0 + 20, A.x1 - 10);
    const d = clamp(depth * 0.6 + (def.depth[0] + Math.random() * (def.depth[1] - def.depth[0])) * 0.4, def.depth[0], def.depth[1]);
    const count = def.school ? def.school[0] + Math.floor(Math.random() * (def.school[1] - def.school[0] + 1)) : 1;
    let lead: Shade | undefined;
    for (let k = 0; k < count; k++) {
      // further out = bigger: the far fish sit at the top of their size range
      const q = clamp(0.25 + dist * 0.55 + (Math.random() - 0.5) * 0.5, 0, 1);
      const len = Math.round(def.len[0] + (def.len[1] - def.len[0]) * q);
      const s: Shade = {
        def, len, px: Math.max(5, (len / 100) * PX_M), x: x + (k ? (Math.random() - 0.5) * 30 : 0), y: 0, vx: 0, vy: 0,
        face: Math.random() < 0.5 ? -1 : 1, faceT: 0, state: 'cruise', t: 0, sub: 0, tx: x, ty: 0,
        speed: def.speed * (0.75 + Math.random() * 0.4), ph: Math.random() * 10, alpha: arrive ? 0 : 1, wary: 0, nib: 0, boost: 0, home: x,
      };
      s.faceT = s.face;
      s.y = this.depthY(s.x, d) + (k ? (Math.random() - 0.5) * 16 : 0);
      s.ty = s.y;
      if (arrive) { s.tx = A.x0 + 60 + Math.random() * 120; s.face = s.faceT = 1; }
      if (lead) { s.lead = lead; s.off = [(Math.random() - 0.5) * 34, (Math.random() - 0.5) * 18]; } else lead = s;
      this.shades.push(s);
    }
  }
  /** world y for a depth fraction (0 just under the surface .. 1 on the bottom) */
  depthY(x: number, d: number) {
    const top = this.level + 12, bot = this.bed(x) - 6;
    return top + (bot - top) * d;
  }
  /** a splash on landing: fish right under it bolt, fish nearby get curious */
  plop(x: number) {
    const surf = this.surface(x);
    for (const s of this.shades) {
      if (s.state !== 'cruise' || s.lead) continue;
      const dx = Math.abs(s.x - x), dy = s.y - surf;
      if (dx < 20 + s.px * 0.4 && dy < 70) this.scare(s);
      else if (Math.hypot(dx, dy) < 150) s.boost = 2.5;
    }
  }
  scare(s: Shade) {
    s.state = 'flee'; s.t = 0; s.wary = 9;
    s.faceT = this.bait ? (s.x < this.bait.x ? -1 : 1) : -s.faceT;
    this.onEvent?.('spooked', s);
    for (const f of this.shades) if (f.lead === s) { f.state = 'flee'; f.t = 0; f.wary = 9; f.faceT = s.faceT; }
  }
  /** is some fish interested in the bait right now */
  engaged(): Shade | null {
    return this.shades.find(s => s.state === 'notice' || s.state === 'approach' || s.state === 'nibble' || s.state === 'bite') ?? null;
  }
  mouth(s: Shade): [number, number] { return [s.x + Math.sign(s.face || s.faceT) * s.px * 0.5, s.y + s.px * 0.04]; }

  // ---------------------------------------------------------------- per frame
  update(dt: number, pick: (dist: number, depth: number) => FishDef | null) {
    this.time += dt;
    const line = this.host.hullLine?.();
    if (line?.length) {
      const s = [...line].sort((a, b) => a[0] - b[0]);
      this.mask = { x: s.map(p => p[0]), y: s.map(p => p[1]) };
    }
    const bait = this.bait?.alive ? this.bait : null;
    const busy = this.engaged();
    for (const s of this.shades) this.think(s, dt, bait, busy);
    this.shades = this.shades.filter(s => !s.gone);
    // keep the water lively: now and then one fish drifts off and another arrives
    if (this.shades.filter(s => !s.lead).length < 7 && Math.random() < dt * 0.12) this.spawn(pick, true);
    // effects
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const q = this.drops[i];
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.life <= 0 || (q.vy > 0 && q.g > 0 && q.y > this.surface(q.x) + 1)) this.drops.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; r.r += dt * 11; if (r.life <= 0) this.rings.splice(i, 1); }
    for (let i = this.bubs.length - 1; i >= 0; i--) {
      const b = this.bubs[i];
      b.y += b.vy * dt; b.x += Math.sin(b.y * 0.2 + i) * 4 * dt; b.life -= dt;
      if (b.life <= 0 || b.y < this.surface(b.x) + 1) { if (b.life > 0 && b.s > 1) this.ring(b.x, 0.35); this.bubs.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.conf) { p.vy = Math.min(p.vy + 60 * dt, 26); p.vx *= 1 - dt * 1.5; p.rot = (p.rot ?? 0) + dt * 6; }
      if (p.t >= p.life) this.sparks.splice(i, 1);
    }
    // the hooked fish breathes out a trail of bubbles when it fights
    const h = this.hooked;
    if (h && Math.random() < dt * (Math.hypot(h.vx, h.vy) > 30 ? 5 : 1.2)) this.bubble(h.x, h.y - h.px * 0.2, 1);
  }

  private think(s: Shade, dt: number, bait: FishView['bait'], busy: Shade | null) {
    const A = this.area;
    s.t += dt;
    s.wary = Math.max(0, s.wary - dt);
    s.boost = Math.max(0, s.boost - dt);
    s.alpha = Math.min(1, s.alpha + dt * 0.8);
    if (s.state === 'hooked') { s.ph += dt * 14; s.face += (s.faceT - s.face) * Math.min(1, dt * 8); return; }
    let tx = s.tx, ty = s.ty, sp = s.speed;
    const surf = this.surface(s.x);
    if (s.lead && s.state === 'cruise') {
      // school: follow the leader in loose formation
      if (s.lead.gone || s.lead.state === 'hooked') { s.lead = undefined; }
      else { tx = s.lead.x + s.off![0]; ty = s.lead.y + s.off![1]; sp = s.speed * 1.15; if (Math.abs(s.lead.vx) > 3) s.faceT = Math.sign(s.lead.vx); }
    }
    switch (s.state) {
      case 'cruise': {
        if (!s.lead) {
          if (Math.hypot(s.tx - s.x, s.ty - s.y) < 6 || s.t > 14) {
            s.t = 0;
            if (Math.random() < 0.3) { s.tx = s.x; s.ty = s.y; s.sub = 1 + Math.random() * 1.5; }
            else {
              s.tx = clamp(s.home + (Math.random() - 0.5) * 280, A.x0 + 10, A.x1 - 8);
              const d0 = s.def.depth[0], d1 = s.def.depth[1];
              s.ty = this.depthY(s.tx, d0 + Math.random() * (d1 - d0));
            }
          }
          tx = s.tx; ty = s.ty;
          if (s.sub > 0) { s.sub -= dt; sp = 0; }
        }
        // the bait: notice it if it's close and in front (or just close), one fish at a time
        if (bait && !busy && s.wary <= 0 && !s.lead) {
          const [mx, my] = this.mouth(s);
          const d = Math.hypot(bait.x - mx, bait.y - my);
          const R = (78 + s.px * 1.6) * (s.boost > 0 ? 1.5 : 1);
          const ahead = (bait.x - s.x) * Math.sign(s.face) > 0;
          if (d < R && (ahead || d < R * 0.5) && Math.random() < dt * (0.35 + 0.9 * (1 - d / R)) * (s.boost > 0 ? 2 : 1)) {
            s.state = 'notice'; s.t = 0; s.faceT = bait.x < s.x ? -1 : 1;
            this.onEvent?.('notice', s);
          }
        }
        break;
      }
      case 'notice': {
        // a pause and a turn toward it
        sp = 0;
        if (!bait) { s.state = 'cruise'; break; }
        s.faceT = bait.x < s.x ? -1 : 1;
        if (s.t > 0.55) { s.state = 'approach'; s.t = 0; }
        break;
      }
      case 'approach': {
        if (!bait) { s.state = 'cruise'; s.t = 0; break; }
        s.faceT = bait.x < s.x ? -1 : 1;
        tx = bait.x - s.faceT * (s.px * 0.5 + 4); ty = bait.y;
        sp = Math.max(12, s.speed) * clamp(Math.hypot(tx - s.x, ty - s.y) / 30, 0.4, 1.1);
        if (Math.hypot(tx - s.x, ty - s.y) < 3.5 || s.t > 5) {
          s.state = 'nibble'; s.t = 0; s.sub = 0;
          s.nib = s.def.nibbles[0] + Math.floor(Math.random() * (s.def.nibbles[1] - s.def.nibbles[0] + 1));
        }
        break;
      }
      case 'nibble': {
        if (!bait) { s.state = 'cruise'; s.t = 0; break; }
        s.faceT = bait.x < s.x ? -1 : 1;
        const hx = bait.x - s.faceT * (s.px * 0.5 + 4);
        // hover, peck (the mouth touches the bait: the float taps), back off; then the real bite
        const hover = 0.55 + (s.nib % 2) * 0.5 + (s.def.diff > 50 ? 0.4 : 0);
        if (s.t < hover) { tx = hx + Math.sin(s.t * 3) * 1.5; ty = bait.y + Math.sin(s.t * 2.2) * 2; sp = s.speed * 0.4; }
        else if (s.t < hover + 0.14) {
          tx = bait.x - s.faceT * (s.px * 0.5 - 1); ty = bait.y; sp = s.speed * 3;
          if (s.sub === 0) {
            s.sub = 1;
            if (s.nib <= 0) { s.state = 'bite'; s.t = 0; this.onEvent?.('bite', s); break; }
            this.onEvent?.('nibble', s);
          }
        } else if (s.t < hover + 0.5) { tx = hx - s.faceT * 3; ty = bait.y; sp = s.speed * 0.8; }
        else {
          s.t = 0; s.sub = 0; s.nib--;
          // the wary ones sometimes lose interest
          if (s.def.diff > 44 && Math.random() < 0.1) { s.state = 'flee'; s.wary = 6; s.faceT = -s.faceT; this.onEvent?.('bored', s); }
        }
        break;
      }
      case 'bite': {
        // lunge and drag the bait down and away
        if (!bait) { s.state = 'flee'; s.t = 0; break; }
        tx = bait.x - s.faceT * (s.px * 0.5 - 2); ty = bait.y + 4; sp = s.speed * 4;
        if (s.t > s.def.window) { s.state = 'flee'; s.t = 0; s.wary = 12; s.faceT = -s.faceT; this.onEvent?.('stolen', s); }
        break;
      }
      case 'flee': {
        tx = s.x + s.faceT * 200; ty = s.y + 20; sp = s.speed * 2.6;
        if (s.t > 1.3) { s.state = 'cruise'; s.t = 0; s.tx = clamp(s.x + s.faceT * 80, A.x0 + 10, A.x1 - 8); s.ty = s.y; s.home = s.tx; }
        break;
      }
      case 'leave': {
        tx = A.x0 - 120; ty = s.y + 10; sp = s.speed * 1.2;
        if (s.x < A.x0 - 60) s.gone = true;
        break;
      }
    }
    // steer toward the target
    const dx = tx - s.x, dy = ty - s.y, dl = Math.hypot(dx, dy);
    const want = dl > 0.5 ? sp : 0;
    const wx = dl > 0.01 ? dx / dl * want : 0, wy = dl > 0.01 ? dy / dl * want * 0.7 : 0;
    const acc = s.state === 'bite' || s.state === 'flee' || (s.state === 'nibble' && s.sub === 1) ? 10 : 2.2;
    s.vx += (wx - s.vx) * Math.min(1, dt * acc);
    s.vy += (wy - s.vy) * Math.min(1, dt * acc);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.y = clamp(s.y, surf + 5 + s.px * 0.15, this.bed(s.x) - 3 - s.px * 0.2);
    if (s.x > A.x1 && s.state === 'cruise') s.tx = Math.min(s.tx, A.x1 - 30);
    if (s.state === 'cruise' && Math.abs(s.vx) > 2.5) s.faceT = Math.sign(s.vx);
    s.face += (s.faceT - s.face) * Math.min(1, dt * 5);
    s.ph += dt * (3 + Math.hypot(s.vx, s.vy) * 0.35);
    // wander off now and then (fresh fish arrive from the far side)
    if (s.state === 'cruise' && !s.lead && s.t > 3 && Math.random() < dt * 0.012) { s.state = 'leave'; s.t = 0; }
  }

  // ---------------------------------------------------------------- effects
  splash(x: number, n: number, pow = 1, y?: number) {
    const y0 = y ?? this.surface(x);
    for (let i = 0; i < n; i++) {
      this.drops.push({ x: x + (Math.random() - 0.5) * 4 * pow, y: y0 - 1, vx: (Math.random() - 0.5) * 50 * pow, vy: -(28 + Math.random() * 60) * pow, life: 0.6 + Math.random() * 0.4, c: Math.random() < 0.5 ? 0xf4fcff : 0xc8e8f4, s: Math.random() < 0.3 ? 2 : 1, g: 190 });
    }
  }
  ring(x: number, max = 1) { this.rings.push({ x, r: 1.5, life: max, max }); }
  bubble(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.bubs.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, vy: -(14 + Math.random() * 16), life: 4, s: Math.random() < 0.3 ? 2 : 1 });
  }
  /** sparkles popping around a point (screen-size), and a burst of confetti */
  sparkle(x: number, y: number, n: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.6);
      this.sparks.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, t: -Math.random() * 0.5, life: 0.5 + Math.random() * 0.4, s: 0.6 + Math.random() * 0.6, vx: 0, vy: -4 });
    }
  }
  confetti(x: number, y: number, n: number, pow: number) {
    const C = [0xff5a6a, 0xffd84a, 0x5ad0f4, 0x8ae05a, 0xffffff, 0xff9a3a, 0xc88aff];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = (40 + Math.random() * 70) * pow;
      this.sparks.push({ x, y, t: 0, life: 1.6 + Math.random() * 1.2, s: 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: C[i % C.length], conf: true, rot: Math.random() * 6 });
    }
  }
  clearFx() { this.drops = []; this.rings = []; this.bubs = []; this.sparks = []; }

  // ---------------------------------------------------------------- drawing
  draw(r: Renderer) {
    const z = r.layerZoom, k = 1 / z;
    const vx0 = r.visibleX0(4), vx1 = r.visibleX1(4), vy0 = r.wy(0) - 4, vy1 = r.wy(r.VH) + 4;
    r.emissive(0.14);
    if (this.under > 0.01) this.drawWater(r, vx0, vx1, vy0, vy1, k);
    if (this.aim) this.drawAim(r, k);
    this.drawLine(r, k);
    this.drawFx(r, k);
    if (this.flier) {
      const f = this.flier;
      r.draw(sideFrame(f.id, f.px), f.x, f.y, f.flip, 1, f.rot);
    }
    this.drawSparks(r, k);
    r.emissive();
  }

  private drawWater(r: Renderer, vx0: number, vx1: number, vy0: number, vy1: number, k: number) {
    const wf = waterFrame(), U = this.under, t = this.time;
    const a = U >= 0.99 ? WHITE : packColor(1, 1, 1, U);
    const X0 = Math.floor(vx0 / 2) * 2;
    // the water column below the surface, anchored to the mean level so depth colour doesn't bob
    for (let X = X0; X < vx1; X += 2) {
      let top = Math.round(this.surface(X + 1)) + 1;
      top = Math.max(top, Math.ceil(this.maskAt(X + 1)));
      if (top >= vy1) continue;
      const src = clamp(top - this.level, 0, WATER_H - 2);
      const h = Math.min(WATER_H - src, vy1 - top);
      r.drawSub(wf, 1, src, 1, h, X, top, 2, 1, a);
      if (top + h < vy1) r.rect(X, top + h, 2, vy1 - top - h + 2, U >= 0.99 ? col(0x0b2748) : col(0x0b2748, U));
    }
    // light shafts slanting down from the surface, slowly swaying
    const sp = 150;
    for (let i = Math.floor(vx0 / sp) - 1; i <= Math.ceil(vx1 / sp); i++) {
      const h1 = hash2(i, 1, 3), h2 = hash2(i, 2, 3);
      if (h1 < 0.3) continue;
      const x = i * sp + h2 * 80 + Math.sin(t * 0.21 + i) * 14;
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.37 + i * 1.7);
      r.draw(A.shaft, x, this.surface(x) + 2, 1.4 + h1 * 1.6, 1.25, -0.32, packColor(0.75, 0.96, 1, 0.075 * pulse * U));
    }
    // motes drifting in the water (a box that follows the view)
    const bw = vx1 - vx0, bh = vy1 - this.level;
    for (const m of this.motes) {
      const x = vx0 + ((m.x * bw + t * (2 + m.z * 3)) % bw + bw) % bw;
      const y = this.level + 8 + ((m.y * bh + t * (1.2 + m.z * 2.5)) % bh);
      if (y < this.surface(x) + 3 || y > this.bed(x)) continue;
      const s = (m.z > 0.75 ? 1.5 : 1) * k;
      r.rect(x, y, s, s, packColor(0.75, 0.92, 1, (0.18 + m.z * 0.3) * U));
    }
    // the seabed far below: sand dunes, rocks, kelp, lost in the blue
    this.drawBed(r, vx0, vx1, vy1, k);
    // the Kittiwake's keel, rudder and propeller through the water
    this.host.drawHullUnder?.(r, packColor(0.5 * U + (1 - U), 0.68 * U + (1 - U), 0.8 * U + (1 - U), 1));
    // fish shadows, deepest first
    const list = [...this.shades].sort((p, q) => q.y - p.y);
    for (const s of list) this.drawShade(r, s, U);
    // the bait on its line below the float
    if (this.bobber && this.bait && this.bobber.fly <= 0) {
      const b = this.bobber, q = this.bait;
      const by = b.y + b.dip + 2 * k;
      this.seg(r, b.x, by, q.x, q.y, packColor(0.9, 0.95, 1, 0.35 * U), k, 0);
      if (q.alive) r.draw(baitFrame(), q.x, q.y + k, k, k, 0, packColor(1, 1, 1, U));
      else r.rect(q.x, q.y, k, k * 2, packColor(0.85, 0.9, 0.95, 0.8 * U));
    }
    // bubbles
    for (const b of this.bubs) {
      const s = b.s * k;
      r.rect(b.x, b.y, s, s, packColor(0.85, 0.97, 1, 0.75 * U));
      if (b.s > 1) r.rect(b.x - k * 0.5, b.y - k * 0.5, k, k, packColor(1, 1, 1, 0.9 * U));
    }
    // the underside of the surface: a bright meniscus line and a soft glow just below it
    const X0b = Math.floor(vx0 / 2) * 2;
    for (let X = X0b; X < vx1; X += 2) {
      const ys = Math.round(this.surface(X + 1)) + 1;
      if (ys < this.maskAt(X + 1)) continue;
      r.rect(X, ys, 2, k, packColor(0.72, 0.93, 0.98, 0.7 * U));
      r.rect(X, ys + k, 2, 3 * k, packColor(0.6, 0.88, 0.96, 0.18 * U));
      // caustic flicker right under the surface
      const c = Math.sin(X * 0.21 + t * 2.1) + Math.sin(X * 0.057 - t * 1.3);
      if (c > 1.35) r.rect(X, ys + 5 * k + Math.sin(X * 0.4 + t) * 2, 2, k, packColor(0.8, 0.97, 1, 0.22 * U));
    }
  }

  private drawBed(r: Renderer, vx0: number, vx1: number, vy1: number, k: number) {
    const U = this.under, t = this.time;
    const X0 = Math.floor(vx0 / 2) * 2;
    // everything down here is seen through a lot of water: low contrast, pulled toward the deep blue
    const fog = (cr: number, cg: number, cb: number, f: number, al = 1) => packColor(cr + (0.07 - cr) * f, cg + (0.2 - cg) * f, cb + (0.34 - cb) * f, al * U);
    for (let X = X0; X < vx1; X += 2) {
      const yb = this.bed(X + 1);
      if (yb > vy1) continue;
      const rk = this.rock(X + 1), top = Math.round(yb);
      if (rk > 1) {
        // a rock: lit top, darker flanks, a dark foot where it meets the sand
        const slope = this.bed(X + 3) - this.bed(X - 1);
        const litK = slope > 1.5 ? 0.35 : slope < -1.5 ? 0.75 : 0.55;
        const body = Math.max(3, rk * 0.9);
        r.rect(X, top, 2, 2, fog(0.4 * litK + 0.2, 0.46 * litK + 0.22, 0.44 * litK + 0.2, 0.5));
        r.rect(X, top + 2, 2, body * 0.5, fog(0.3 * litK + 0.14, 0.36 * litK + 0.16, 0.36 * litK + 0.16, 0.55));
        r.rect(X, top + 2 + body * 0.5, 2, body * 0.5, fog(0.2, 0.25, 0.27, 0.58));
        r.rect(X, top + 2 + body, 2, vy1 - top, fog(0.3, 0.33, 0.32, 0.6));
        if (hash2(X, 13, 2) < 0.08) r.rect(X, top + 3 + hash2(X, 14, 2) * rk * 0.5, 2, k, fog(0.6, 0.66, 0.6, 0.5));
      } else {
        // sand: a pale rim, faint ripples, darker below
        r.rect(X, top, 2, 2, fog(0.62, 0.62, 0.52, 0.5));
        r.rect(X, top + 2, 2, 5, fog(0.46, 0.48, 0.42, 0.55));
        r.rect(X, top + 7, 2, vy1 - top, fog(0.3, 0.33, 0.32, 0.6));
        if (Math.sin(X * 0.35 + fbm1(X * 0.02, 2, 3) * 6) > 0.85) r.rect(X, top + 3, 2, k, fog(0.6, 0.6, 0.5, 0.5));
        if (hash2(X, 11, 2) < 0.05) r.rect(X, top + 2 + hash2(X, 12, 2) * 6, k * 2, k, fog(0.75, 0.72, 0.62, 0.45));
      }
    }
    // kelp: a stipe up from the rocks, long fronds streaming off it with the current
    const cw = 52;
    for (let i = Math.floor(vx0 / cw) - 2; i <= Math.ceil(vx1 / cw) + 1; i++) {
      if (hash2(i, 21, 4) > 0.36) continue;
      const bx = i * cw + hash2(i, 22, 4) * 40, yb = this.bed(bx) + 3;
      if (yb - 190 > vy1) continue;
      const H = 50 + hash2(i, 23, 4) * 130, ph = hash2(i, 24, 4) * 6;
      const sh = 0.8 + hash2(i, 25, 4) * 0.35;
      const cStem = fog(0.3 * sh, 0.36 * sh, 0.14 * sh, 0.42, 0.95);
      const cLeaf = fog(0.36 * sh, 0.5 * sh, 0.18 * sh, 0.4, 0.9);
      const cLit = fog(0.5 * sh, 0.64 * sh, 0.26 * sh, 0.4, 0.9);
      const stipe = (u: number) => bx + Math.sin(u * 2.6 + t * 0.7 + ph) * 8 * u + Math.sin(t * 1.2 + ph + u * 4) * 2 * u + u * u * 10;
      for (let s = 0; s < H; s += 1.5) {
        const u = s / H;
        r.rect(stipe(u) - 1, yb - s, 2.5, 2, cStem);
      }
      for (let s = 8; s < H; s += 9 + hash2(i, 26, 4) * 4) {
        const u = s / H, x = stipe(u), y = yb - s;
        const side = hash2(i, Math.floor(s), 5) < 0.75 ? 1 : -1, bl = 12 + hash2(i, Math.floor(s), 6) * 14 * (1 - u * 0.5);
        for (let j = 0; j < bl; j += 1.2) {
          const v = j / bl;
          const wv = Math.sin(t * 1.5 + j * 0.3 + ph + s * 0.2) * 2.4 * v;
          const bw = 3.2 * Math.sin(Math.PI * Math.min(1, v * 1.1 + 0.08));
          r.rect(x + side * j * 0.95, y - j * 0.42 + wv - bw * 0.5, 1.5, bw, v < 0.35 ? cLit : cLeaf);
        }
      }
    }
  }

  private drawShade(r: Renderer, s: Shade, U: number) {
    const fr = shadowsOf(s.def.id, s.px);
    // tail beat: the silhouette flexes (faster when darting)
    const w = Math.sin(s.ph);
    const fi = w < -0.6 ? 0 : w < -0.2 ? 1 : w < 0.2 ? 2 : w < 0.6 ? 3 : 4;
    const surf = this.surface(s.x);
    const depth = clamp((s.y - surf) / Math.max(40, this.bed(s.x) - surf), 0, 1);
    const hooked = s === this.hooked;
    // deeper shadows are fainter and bluer; the hooked fish is darker and sharper
    const a = (hooked ? 0.9 : 0.66 - depth * 0.22) * s.alpha * U;
    const sx = Math.abs(s.face) < 0.16 ? 0.16 * Math.sign(s.face || 1) : s.face;
    const pitch = clamp(Math.atan2(s.vy, Math.abs(s.vx) + 6) * 0.55, -0.5, 0.5) * Math.sign(s.face || 1);
    r.draw(fr[fi], s.x, s.y, sx, 1, pitch, packColor(0.02 + depth * 0.04, 0.07 + depth * 0.06, 0.16 + depth * 0.08, a));
    // the lantern cod's lure shows through the water as a blue spark
    if (s.def.id === 'lanterncod') {
      const [mx, my] = this.mouth(s);
      const g = 0.6 + 0.4 * Math.sin(this.time * 3 + s.ph);
      r.fxDraw(A.glow, mx + Math.sign(s.face) * s.px * 0.04, my + s.px * 0.18, 0.08, 0.08, 0, packColor(0.5, 1, 1, 1), 0.9 * g * U);
      r.rect(mx + Math.sign(s.face) * s.px * 0.04, my + s.px * 0.18, 1.2, 1.2, packColor(0.7, 1, 1, 0.9 * U));
    }
  }

  private drawAim(r: Renderer, k: number) {
    const a = this.aim!;
    const [hx, hy] = a.tip;
    const bx = a.x, by = this.surface(bx);
    const dot = (x: number, y: number, c: number, al: number, sz = 2) => {
      r.rect(x, y + sz * k, sz * k, k, packColor(0.06, 0.14, 0.23, al * 0.45));
      r.rect(x, y, sz * k, sz * k, col(c, al));
    };
    // the arc the float will fly, dots marching along it
    const arcH = 40 + Math.abs(bx - hx) * 0.18;
    for (let i = 0; i < 14; i++) {
      const u = 0.1 + ((i + a.t * 2.5) % 14) / 14 * 0.9;
      const x = hx + (bx - hx) * u, y = hy + (by - hy) * u - Math.sin(u * Math.PI) * arcH;
      // a little round bead: dark rim, bright middle
      const al = 0.65 + u * 0.35, rim = packColor(0.1, 0.16, 0.26, 0.6 * al), mid = col(0xfff6c0, al);
      r.rect(x - k, y, 5 * k, 3 * k, rim); r.rect(x, y - k, 3 * k, 5 * k, rim);
      r.rect(x, y, 3 * k, 3 * k, mid); r.rect(x, y, k, k, col(0xffffff, al));
    }
    // where it lands: a pulsing ring on the water, and a dashed drop to where the bait will settle
    const pulse = 0.6 + Math.sin(a.t * 9) * 0.3;
    for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; dot(bx + Math.cos(an) * 9 * k * 1.3, by + Math.sin(an) * 2.2 * k, 0xffffff, pulse, 1); }
    if (this.under > 0.5) {
      for (let y = by + 6; y < by + a.depth; y += 7) r.rect(bx, y, k, 3.5 * k, packColor(1, 1, 1, 0.3 + 0.2 * pulse));
      r.draw(baitFrame(), bx, by + a.depth, k * 1.5, k * 1.5, 0, packColor(1, 1, 1, 0.55 + 0.3 * pulse));
    }
  }

  /** a curved line in screen-pixel dots */
  private seg(r: Renderer, ax: number, ay: number, bx: number, by: number, c: number, k: number, sag: number, vib = 0, shadow = false) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / k) + 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let x = ax + (bx - ax) * u, y = ay + (by - ay) * u + Math.sin(u * Math.PI) * sag;
      if (vib) { const w = vib * Math.sin(Math.PI * u) * Math.sin(this.time * 70 + u * 9); x += w * 0.3; y += w; }
      if (shadow) r.rect(x, y + k, k, k, packColor(0.08, 0.14, 0.22, 0.35));
      r.rect(x, y, k, k, c);
    }
  }

  private drawLine(r: Renderer, k: number) {
    const L = this.line, b = this.bobber;
    if (L) {
      const T = L.ten;
      // white when slack, amber under load, red and humming at the limit
      const c = T < 0.5 ? [0.94, 0.96, 1] : T < 0.8 ? [1, 0.93 - (T - 0.5) * 0.9, 0.7 - (T - 0.5) * 1.8] : [1, 0.6 - (T - 0.8) * 1.6, 0.18];
      const flick = T > 0.9 && Math.floor(this.time * 18) % 2 ? 0.55 : 1;
      const lc = packColor(c[0], c[1], c[2], 0.95 * flick);
      const vib = T > 0.62 ? (T - 0.62) * 3 : 0;
      if (L.under) {
        // above water to where it cuts in, then (fainter) down to the fish
        this.seg(r, L.tip[0], L.tip[1], L.to[0], L.to[1], lc, k, L.sag, vib, true);
        this.seg(r, L.to[0], L.to[1], L.under[0], L.under[1], packColor(c[0], c[1], c[2], 0.55 * this.under * flick), k, L.sag * 0.3, vib);
        // the line tugs the surface into a little peak where it goes in
        r.rect(L.to[0] - k, L.to[1] - k, 3 * k, k, packColor(1, 1, 1, 0.7));
      } else this.seg(r, L.tip[0], L.tip[1], L.to[0], L.to[1], lc, k, L.sag, vib, true);
    }
    if (b) {
      // the float: the part under the surface shows faintly through the water
      const bf = bobberFrame();
      const surf = b.fly > 0 ? Infinity : this.surface(b.x);
      const y = b.y + b.dip;
      const top = y - 6 * k;
      const cut = clamp(Math.round((surf - top) / k), 0, 10);
      if (cut >= 10 || b.fly > 0) r.draw(bf, b.x, y, k, k, b.tilt);
      else {
        if (cut > 0) r.drawSub(bf, 0, 0, 7, cut, b.x - 3.5 * k, top, k, k);
        r.drawSub(bf, 0, cut, 7, 10 - cut, b.x - 3.5 * k, top + cut * k, k, k, packColor(0.8, 0.9, 1, 0.35));
      }
      if (b.fly <= 0) r.rect(b.x - 4 * k, surf, 8 * k, k, packColor(1, 1, 1, 0.6));
    }
  }

  private drawFx(r: Renderer, k: number) {
    for (const q of this.drops) {
      const s = q.s * k;
      r.rect(q.x, q.y + s, s, k, packColor(0.06, 0.14, 0.23, 0.3 * Math.min(1, q.life * 3)));
      r.rect(q.x, q.y, s, s, col(q.c, Math.min(1, q.life * 3)));
    }
    for (const g of this.rings) {
      const a = Math.min(0.95, g.life / g.max * 1.3);
      const y = this.surface(g.x);
      for (let i = 0; i < 20; i++) {
        if (i % 2 && g.r > 5) continue;
        const an = i / 20 * Math.PI * 2;
        r.rect(g.x + Math.cos(an) * g.r * k * 1.4, y + Math.sin(an) * g.r * 0.24 * k, k, k, packColor(0.96, 0.99, 1, a));
      }
    }
  }

  private drawSparks(r: Renderer, k: number) {
    const sf = sparkFrame();
    for (const p of this.sparks) {
      if (p.t < 0) continue;
      const u = p.t / p.life;
      if (p.conf) {
        const w = Math.abs(Math.cos(p.rot ?? 0));
        r.rect(p.x, p.y, Math.max(0.35, w) * 2 * k, 1.4 * k, col(p.c ?? 0xffffff, Math.min(1, (1 - u) * 3)));
      } else {
        const s = (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7 * 0.6) * p.s * k;
        r.draw(sf, p.x, p.y, s, s, 0, packColor(1, 1, 1, 1 - u * u));
      }
    }
  }
}
