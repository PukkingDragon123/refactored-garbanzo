// Bodies: how animals are drawn. BeastBody uses pre-rendered pose frames (mammals, birds, frogs);
// SpineBody drives the procedural serpent painter (serpents, crocodile, gecko, pteramander).

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { PixelBuffer } from '../../art/pixel';
import { DynamicSprite } from '../../gfx/atlas';
import { SerpentPainter, followSpine, makeSpine, SerpentState, SerpentLook } from '../../art/serpent';
import { SERPENT_LOOKS } from '../../art/fauna';
import { hex } from '../../art/color';
import type { Animal, Body } from './animal';
import type { Box } from './world';
import { A, local } from '../assets';
import { game } from '../game';
import { emoteAnim } from '../../world/actor';
import { clamp, damp, lerp, rand } from '../../core/math';

// ------------------------------------------------------------------ art binding (src/art/beasts.ts)
export interface BeastArt {
  BEAST_ANIMS: Record<string, Record<string, { frames: number; fps: number; loop: boolean }>>;
  BEAST_INFO: Record<string, { name: string; kind: string; len: number; height: number }>;
  renderBeast(id: string, anim: string, frame: number, eye?: string, variant?: 'adult' | 'juvenile'): { buf: PixelBuffer; ax: number; ay: number; head: [number, number]; eye: [number, number] };
}
let beasts: BeastArt | null = null;
export function bindBeastArt(b: BeastArt | null) {
  beasts = b;
}
export const hasBeast = (id: string) => !!beasts?.BEAST_ANIMS[id];

interface CachedFrame { fr: Frame; ax: number; ay: number; head: [number, number]; w: number; h: number; pts: [number, number][] }
let cacheOwner: unknown = null;
const frameCache = new Map<string, CachedFrame>();

function beastFrame(id: string, anim: string, frame: number, eye: string, juv: boolean): CachedFrame | null {
  if (!beasts) return null;
  if (cacheOwner !== local) { frameCache.clear(); cacheOwner = local; }
  const key = `${id}.${anim}.${frame}.${eye}.${juv ? 'j' : 'a'}`;
  let c = frameCache.get(key);
  if (!c) {
    const o = beasts.renderBeast(id, anim, frame, eye, juv ? 'juvenile' : 'adult');
    // silhouette sample points (local, relative to anchor)
    const pts: [number, number][] = [];
    const b = o.buf, step = Math.max(2, Math.floor(Math.min(b.w, b.h) / 5));
    for (let y = 1; y < b.h; y += step) for (let x = 1; x < b.w; x += step) if (b.data[y * b.w + x] >>> 24 > 128) pts.push([x - o.ax, y - o.ay]);
    if (!pts.length) pts.push([0, -b.h / 2]);
    c = { fr: local.add('bst:' + key, o.buf, o.ax, o.ay), ax: o.ax, ay: o.ay, head: [o.head[0] - o.ax, o.head[1] - o.ay], w: b.w, h: b.h, pts };
    frameCache.set(key, c);
  }
  return c;
}

/** Pre-render the common frames of a species (during scene load, to avoid hitches). */
export function warmBeast(id: string, juvenile = false) {
  if (!beasts?.BEAST_ANIMS[id]) return;
  for (const [anim, info] of Object.entries(beasts.BEAST_ANIMS[id])) for (let i = 0; i < info.frames; i++) beastFrame(id, anim, i, 'open', juvenile);
}

const FALLBACK: Record<string, string[]> = {
  walk: ['walk', 'idle'], run: ['run', 'walk', 'idle'], eat: ['eat', 'idle'], dig: ['dig', 'eat', 'idle'], alert: ['alert', 'idle'],
  sleep: ['sleep', 'idle'], call: ['call', 'alert', 'idle'], groom: ['groom', 'preen', 'idle'], preen: ['preen', 'groom', 'idle'],
  threat: ['threat', 'quills', 'clatter', 'screech', 'alert', 'idle'], attack: ['charge', 'fight', 'grab', 'strike', 'run', 'walk'],
  fly: ['fly', 'glide'], glide: ['glide', 'fly'], soar: ['soar', 'glide', 'fly'], dive: ['dive', 'glide', 'fly'], swim: ['swim', 'idle'],
  climb: ['climb', 'walk', 'idle'], cling: ['idle'], peek: ['peek', 'alert', 'idle'], burrow: ['burrow', 'dig', 'idle'], ball: ['ball', 'sleep'],
  play: ['play', 'run', 'walk'], browse: ['browse', 'eat', 'idle'], wallow: ['wallow', 'sleep', 'idle'], crack: ['crack', 'eat', 'idle'],
  feed: ['feed', 'eat', 'idle'], hop: ['hop', 'walk'], bob: ['bob', 'idle'], stalk: ['stalk', 'walk'], strike: ['strike', 'eat'],
  clatter: ['clatter', 'call', 'idle'], carry: ['carry', 'fly'], land: ['land', 'glide', 'fly'], hang: ['hang', 'idle'], grab: ['grab', 'eat'],
  leap: ['leap', 'run'], fight: ['fight', 'leap', 'run'], tongue: ['tongue', 'idle'], hide: ['hide', 'idle'], quills: ['quills', 'threat', 'idle'],
  charge: ['charge', 'run'], idle: ['idle'], roll: ['roll', 'ball'], screech: ['screech', 'call'],
};

/** Draw an animal's emote above its head. */
export function drawEmote(r: Renderer, a: Animal, hx: number, hy: number) {
  const e = a.emote;
  if (!e) return;
  const fr = emoteAnim(e.kind);
  if (!fr.length) return;
  const i = Math.floor(e.t * 8) % fr.length;
  const pop = e.t < 0.15 ? 0.4 + (e.t / 0.15) * 0.8 : e.t < 0.28 ? 1.2 - ((e.t - 0.15) / 0.13) * 0.2 : 1;
  const fade = clamp((e.dur - e.t) / 0.25);
  r.emissive(0.9);
  r.draw(fr[i], hx, hy - 6 - Math.sin(e.t * 5), pop, pop, 0, packColor(1, 1, 1, fade));
  r.emissive();
}

export class BeastBody implements Body {
  private t = 0;
  private cur = 'idle';
  private last: CachedFrame | null = null;
  constructor(readonly id: string) {}

  private resolve(a: Animal): string {
    const anims = beasts?.BEAST_ANIMS[this.id];
    if (!anims) return 'idle';
    for (const n of FALLBACK[a.anim] ?? [a.anim, 'idle']) if (anims[n]) return n;
    return anims.idle ? 'idle' : Object.keys(anims)[0];
  }

  update(dt: number, a: Animal) {
    const name = this.resolve(a);
    if (name !== this.cur) { this.cur = name; this.t = 0; }
    // gait speed follows actual movement
    const moving = name === 'walk' || name === 'run' || name === 'stalk' || name === 'climb';
    const k = moving ? clamp(Math.abs(a.vx || a.vy) / Math.max(8, name === 'run' ? a.eco.run * 0.8 : a.eco.walk), 0.4, 1.8) : 1;
    this.t += dt * k;
  }

  private frame(a: Animal): CachedFrame | null {
    const info = beasts?.BEAST_ANIMS[this.id]?.[this.cur];
    if (!info) return this.last;
    const n = Math.floor(this.t * info.fps);
    const i = info.loop ? n % info.frames : Math.min(info.frames - 1, n);
    const f = beastFrame(this.id, this.cur, i, a.eye, a.juvenile);
    if (f) this.last = f;
    return f;
  }

  draw(r: Renderer, a: Animal) {
    const f = this.frame(a);
    if (!f) {
      r.rect(a.x - 6, a.y - 10, 12, 10, packColor(0.5, 0.4, 0.3, 1));
      return;
    }
    if (a.hidden >= 0.98) return;
    const s = a.scale;
    const alpha = a.alpha * (a.anim === 'burrow' || a.anim === 'peek' ? 1 : 1 - a.hidden * 0.55);
    // blob shadow for ground animals
    if (a.medium === 'ground' && a.hidden < 0.5) {
      r.beginShadows();
      r.draw(A.shadow, a.x, a.y, Math.max(0.35, (f.w * s) / 40), 0.8, 0, packColor(0, 0, 0, 0.35 * alpha));
      r.endShadows();
    }
    const col = packColor(1, 1, 1, alpha);
    if ((a.anim === 'burrow' || a.act === 'burrow' || a.act === 'sentinel') && a.hidden > 0.02) {
      // sink into the burrow: draw only the part above ground
      const keep = Math.max(1, Math.round(f.h * (1 - a.hidden)));
      const tex = f.fr;
      const tw = tex.tex.w, th = tex.tex.h;
      const u0 = tex.u0 * tw, v0 = tex.v0 * th;
      const sub: Frame = { tex: tex.tex, u0: u0 / tw, v0: v0 / th, u1: (u0 + f.w) / tw, v1: (v0 + keep) / th, w: f.w, h: keep, ax: f.ax, ay: keep };
      r.draw(sub, a.x, a.y, a.facing * s, s, 0, col);
    } else {
      const rot = a.medium === 'air' && (this.cur === 'glide' || this.cur === 'soar' || this.cur === 'dive') ? clamp(a.vy / 400, -0.35, 0.6) * a.facing : 0;
      r.draw(f.fr, a.x, a.y, a.facing * s, s, rot, col);
    }
    const [hx, hy] = this.head(a);
    drawEmote(r, a, hx, hy - 8 * s);
  }

  bounds(a: Animal): Box {
    const f = this.last ?? this.frame(a);
    if (!f) return { x0: a.x - 8, y0: a.y - 12, x1: a.x + 8, y1: a.y };
    const s = a.scale;
    const l = -f.ax * s, rr = (f.w - f.ax) * s;
    const x0 = a.facing > 0 ? a.x + l : a.x - rr, x1 = a.facing > 0 ? a.x + rr : a.x - l;
    const y1 = a.y + (f.h - f.ay) * s;
    const y0 = a.y - f.ay * s + (a.act === 'burrow' ? f.h * s * a.hidden : 0);
    return { x0, y0, x1, y1 };
  }

  head(a: Animal): [number, number] {
    const f = this.last ?? this.frame(a);
    if (!f) return [a.x, a.y - 10];
    return [a.x + f.head[0] * a.facing * a.scale, a.y + f.head[1] * a.scale];
  }

  points(a: Animal): [number, number][] {
    const f = this.last ?? this.frame(a);
    if (!f) return [[a.x, a.y - 5]];
    const s = a.scale;
    return f.pts.map(([x, y]) => [a.x + x * a.facing * s, a.y + y * s] as [number, number]);
  }
}

// ------------------------------------------------------------------ spine bodies

const FALLBACK_LOOK: SerpentLook = {
  length: 60, radius: 3, dorsal: [hex('#2a3018'), hex('#3e4a24'), hex('#566634'), hex('#72844a'), hex('#94a466')], belly: hex('#c8c09a'),
  pattern: 'bands', patternCol: hex('#2a2414'), head: 'slim',
};

type Pt = [number, number];

export class SpineBody implements Body {
  readonly painter: SerpentPainter;
  readonly look: SerpentLook;
  pts: Pt[];
  readonly spacing: number;
  private spr: DynamicSprite;
  private ox = 0;
  private oy = 0;
  private legPhase = 0;
  private wave = 0;
  private tongue = 0;
  private tongueT = 0;
  private blinkT = 3;
  private flatten = 0;
  private t = rand.next() * 10;
  private skip = 0;
  private crest = 0;
  private dewlap = 0;
  private swell = 0;
  /** coiled resting shape */
  private coilK = 0;

  constructor(readonly id: string, a: Animal) {
    this.look = SERPENT_LOOKS[id] ?? FALLBACK_LOOK;
    this.painter = new SerpentPainter(this.look);
    this.spacing = this.look.length > 400 ? 4 : this.look.length > 180 ? 3 : 1.5;
    this.pts = makeSpine(a.x, a.y - this.look.radius, a.facing, this.look.length, this.spacing);
    const L = this.look;
    const pad = L.radius * 4 + (L.legs ? 24 : 10) + (L.dorsalFin ? L.dorsalFin.h + 8 : 0) + 24;
    const w = Math.ceil(Math.min(1400, L.length * 1.05 + pad * 2));
    const h = Math.ceil(Math.max(L.radius * 6 + pad * 2, Math.min(700, L.length * 0.7)));
    this.spr = new DynamicSprite(game.r, w, h, 0, 0);
  }

  get headPt() {
    return this.pts[0];
  }

  private surfY(a: Animal) {
    return (x: number) => {
      const s = a.host.terrain.surfaceBelow(x, this.pts[0][1] - 30, 0, false);
      return s ? s.y : a.host.terrain.groundY(x);
    };
  }

  update(dt: number, a: Animal) {
    this.t += dt;
    const L = this.look;
    const r0 = L.radius;
    const [hx, hy] = this.pts[0];
    // head target
    let tx = a.x, ty = a.y;
    const act = a.act;
    const coiling = act === 'coil' || act === 'lure' || act === 'ambush' || act === 'rest' || act === 'digest' || act === 'sleep' || act === 'bask' || act === 'constrict';
    this.coilK = damp(this.coilK, coiling ? 1 : 0, 2, dt);
    if (a.medium === 'ground') ty = a.y - r0 * 0.9 - (act === 'threat' ? r0 * 5 + 6 : act === 'scent' || act === 'investigate' ? r0 * 1.6 : r0 * 0.6);
    else if (a.medium === 'trunk') { ty = a.y; tx = (a.poi?.x ?? a.x) + a.facing * (r0 + 2); }
    else if (a.medium === 'water') ty = Math.max(a.y, (a.host.waterY ?? a.y) + (act === 'lurk' || act === 'surface' ? -r0 * 0.4 : r0 * 1.5));
    const nx = lerp(hx, tx, Math.min(1, dt * 14)), ny = lerp(hy, ty, Math.min(1, dt * (a.medium === 'ground' ? 10 : 6)));
    const d = Math.hypot(nx - hx, ny - hy);
    this.pts[0][0] = nx;
    this.pts[0][1] = ny;
    this.legPhase += d * 0.22;
    this.wave += d * 0.12 + dt * (a.medium === 'water' ? 2.2 : 0);
    followSpine(this.pts, this.spacing, 0.15);
    const n = this.pts.length;
    // settle onto the medium
    if (a.medium === 'ground' && !coiling) {
      const g = this.surfY(a);
      const lift = act === 'threat' ? r0 * 5 : 0;
      for (let i = 1; i < n; i++) {
        const p = this.pts[i];
        const u = i / n;
        const rr = this.painter.radiusAt(u);
        let y = g(p[0]) - rr * 0.85 - (i < 8 ? (8 - i) * lift * 0.12 : 0);
        y += Math.sin(this.wave - i * 0.35) * Math.sin(u * Math.PI) * (L.legs ? 0.4 : 1);
        p[1] = lerp(p[1], y, 0.55);
      }
    } else if (a.medium === 'trunk' && !coiling) {
      // hang down (or up) along the trunk
      const tr = a.poi;
      for (let i = 1; i < n; i++) {
        const p = this.pts[i];
        p[0] = lerp(p[0], (tr?.x ?? p[0]) + Math.sin(i * 0.25 + this.wave) * 2 + a.facing * (r0 + 2), 0.3);
      }
    } else if (a.medium === 'water') {
      for (let i = 1; i < n; i++) {
        const p = this.pts[i];
        p[1] += Math.sin(this.wave * 1.3 - i * 0.18) * 0.35;
      }
    }
    if (coiling) {
      // relax into a loose S/coil around the head position
      const baseY = a.medium === 'ground' ? this.surfY(a)(a.x) : this.pts[0][1] + r0 * 2;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const ang = u * Math.PI * 2.4;
        const rad = 6 + r0 * 3 + u * L.length * 0.08;
        const cx = a.x - a.facing * (rad * 0.6), cy = baseY - r0 * 1.2 - (a.medium === 'ground' ? 0 : -rad * 0.5);
        const qx = cx + Math.cos(ang) * rad * -a.facing, qy = cy + Math.sin(ang) * rad * 0.35 * (a.medium === 'ground' ? 1 : 2);
        const p = this.pts[i];
        p[0] = lerp(p[0], qx, this.coilK * 0.08);
        p[1] = lerp(p[1], Math.min(qy, a.medium === 'ground' ? baseY - this.painter.radiusAt(u) * 0.85 : qy), this.coilK * 0.08);
      }
      followSpine(this.pts, this.spacing, 0);
    }
    // gliding: flatten into a ribbon
    this.flatten = damp(this.flatten, a.medium === 'air' ? 1 : 0, 4, dt);
    this.crest = damp(this.crest, act === 'threat' ? 1 : 0, 6, dt);
    this.dewlap = damp(this.dewlap, act === 'display' ? 1 : 0, 6, dt);
    this.swell = damp(this.swell, a.act === 'digest' ? 1 : 0, 0.5, dt);
    // tongue flicks when scenting / curious
    this.tongueT -= dt;
    if (this.tongueT < 0 && rand.next() < dt * (act === 'scent' || act === 'investigate' || act === 'forage' || act === 'prowl' ? 3 : 0.5)) this.tongueT = 0.35;
    this.tongue = this.tongueT > 0 ? Math.sin((this.tongueT / 0.35) * Math.PI) : 0;
    this.blinkT -= dt;
    if (this.blinkT < -0.15) this.blinkT = 2 + rand.next() * 4;
  }

  bounds(): Box {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const r = this.look.radius;
    for (let i = 0; i < this.pts.length; i += 2) {
      const p = this.pts[i];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return { x0: x0 - r, y0: y0 - r * 1.4, x1: x1 + r, y1: y1 + r * (this.look.legs ? 2.5 : 1) };
  }

  head(): [number, number] {
    return [this.pts[0][0], this.pts[0][1] - this.look.radius];
  }

  points(): [number, number][] {
    const out: [number, number][] = [];
    const n = this.pts.length;
    const stepI = Math.max(1, Math.floor(n / 14));
    for (let i = 0; i < n; i += stepI) {
      const p = this.pts[i];
      const rr = this.painter.radiusAt(i / n);
      out.push([p[0], p[1]], [p[0], p[1] - rr * 0.8]);
    }
    return out;
  }

  draw(r: Renderer, a: Animal) {
    if (a.hidden >= 0.98 && a.act !== 'lurk') return;
    const b = this.bounds();
    const vx0 = r.visibleX0(80), vx1 = r.visibleX1(80);
    if (b.x1 < vx0 || b.x0 > vx1) return;
    const buf = this.spr.buf;
    // big bodies repaint every other frame
    this.skip = (this.skip + 1) % (this.look.length > 400 ? 2 : 1);
    if (this.skip === 0) {
      this.ox = Math.floor((b.x0 + b.x1) / 2 - buf.w / 2);
      this.oy = Math.floor((b.y0 + b.y1) / 2 - buf.h / 2);
      const st: SerpentState & Record<string, unknown> = {
        pts: this.pts, facing: a.facing, jaw: Math.max(a.jaw, this.crest * 0.6), tongue: this.tongue, legPhase: this.legPhase,
        legLift: a.medium === 'ground' && Math.abs(a.vx) > 2 ? 1 : 0.1, grounded: a.medium === 'ground',
        groundY: this.surfY(a), flatten: this.flatten, swell: this.swell > 0.05 ? { at: 0.45, k: this.swell } : undefined,
        blink: this.blinkT < 0 || a.act === 'sleep', submerge: a.medium === 'water' && a.host.waterY !== null ? a.host.waterY : undefined,
        eye: a.eye === 'scared' ? 'alert' : a.eye, crest: this.crest, dewlap: this.dewlap, vertical: a.medium === 'trunk',
      };
      this.painter.paint(buf, st, this.ox, this.oy, this.t);
      this.spr.upload();
    }
    if (a.medium === 'ground') {
      r.beginShadows();
      const w = (b.x1 - b.x0) / 32;
      r.draw(A.shadow, (b.x0 + b.x1) / 2, b.y1 - 1, Math.max(0.5, w), 0.8, 0, packColor(0, 0, 0, 0.32));
      r.endShadows();
    }
    const alpha = a.alpha * (1 - Math.min(0.6, a.hidden * 0.7));
    r.draw(this.spr.frame, this.ox, this.oy, 1, 1, 0, packColor(1, 1, 1, alpha));
    // bioluminescent lure
    if (this.look.lure && (a.act === 'lure' || a.act === 'coil' || a.night)) {
      const tip = this.pts[this.pts.length - 1];
      const k = (a.act === 'lure' ? 1 : 0.4) * (0.8 + 0.2 * Math.sin(this.t * 6));
      r.fxDraw(A.glow, tip[0], tip[1], 0.5, 0.5, 0, packColor(0.7, 1, 0.8, 1), 3 * k);
      r.light(tip[0], tip[1], 55, 0.6, 1, 0.8, 1.4 * k);
    }
    const [hx, hy] = this.head();
    drawEmote(r, a, hx, hy - this.look.radius * 1.5 - 4);
  }

  /** world point of the tail tip (e.g. glowing lure) */
  tail(): Pt {
    return this.pts[this.pts.length - 1];
  }
  dispose() {
    this.spr.dispose();
  }
}

/** V11: species with their own Body class (the predators module registers the Cerebral Tiger's) */
export const BODY_MAKERS: Record<string, (a: Animal) => Body> = {};

/** Pick the right body type for a species. */
export function makeBody(a: Animal): Body {
  const mk = BODY_MAKERS[a.species];
  if (mk) return mk(a);
  if (SERPENT_LOOKS[a.species] || ['strider', 'sprinter', 'skyribbon', 'lurevip', 'titan', 'leviathan', 'mudribbon', 'cragviper', 'ironjaw', 'barkgecko', 'pteramander'].includes(a.species)) return new SpineBody(a.species, a);
  return new BeastBody(a.species);
}
