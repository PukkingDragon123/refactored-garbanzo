// Actor: a V2 character on stage. Composites a pre-rendered body frame, a separately rendered head
// (any expression, talking mouth, blinking, look direction) and a front-arm layer, and adds cartoon
// life on top: squash & stretch, hops, shakes, emote icons, scripted walking and talking for bubbles.

import type { Renderer, Frame } from '../gfx/renderer';
import { packColor, WHITE } from '../gfx/renderer';
import type { Drawable, Stage, Layer } from './stage';
import type { Terrain } from './terrain';
import { PixelBuffer } from '../art/pixel';
import type { Speaker } from '../ui/bubbles';
import { atlas, A } from '../game/assets';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { approach, clamp, rand } from '../core/math';

// ------------------------------------------------------------------ art binding (src/art/people.ts, src/art/emotes.ts)

export type Look = 'fwd' | 'up' | 'down' | 'back';
export interface BodyFrameArt { back: PixelBuffer; front: PixelBuffer | null; ax: number; ay: number; hx: number; hy: number; look?: Look; hand?: [number, number]; headBehind?: boolean; hrot?: number; hflip?: boolean; hair?: number }
export interface PeopleArt {
  ANIMS: Record<string, { frames: number; fps: number; loop: boolean; dist?: number; talk?: string }>;
  CHAR_ANIMS: Record<string, string[]>;
  CHAR_INFO: Record<string, { name: string; short: string; voice: number; height: number }>;
  renderBody(id: string, anim: string, frame: number): BodyFrameArt;
  renderHead(id: string, o: { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look; hair?: number }): { buf: PixelBuffer; ax: number; ay: number };
  renderPortrait(id: string, expr: string, o?: { mouth?: 0 | 1 | 2; blink?: boolean }): PixelBuffer;
  /** per-character anim table (e.g. the pug has his own frame counts) */
  animFor?(id: string, anim: string): { frames: number; fps: number; loop: boolean; dist?: number; talk?: string } | null;
  /** posture transition clip between two anims (sit down, stand up...) */
  transitionFor?(id: string, from: string, to: string): string | null;
  /** outfits: what a character wears (sprites, portraits and close-ups all follow it) */
  OUTFITS?: string[];
  outfitOf?(id: string): string;
  setOutfit?(id: string, outfit: string): string;
}
export interface EmoteArt {
  EMOTE_INFO: Record<string, { frames: number; fps: number; loop: boolean }>;
  emoteFrames(kind: string): PixelBuffer[];
}

let people: PeopleArt | null = null;
let emotes: EmoteArt | null = null;
export function bindActorArt(p: PeopleArt | null, e: EmoteArt | null) {
  people = p;
  emotes = e;
}
export const peopleArt = () => people;

interface BodyCache { back: Frame; front: Frame | null; ax: number; ay: number; hx: number; hy: number; look: Look; hand: [number, number] | null; headBehind: boolean; hrot: number; hflip: boolean; hair: number }
const bodyCache = new Map<string, BodyCache>();
const headCache = new Map<string, Frame>();
const emoteCache = new Map<string, Frame[]>();
const SLEEP = new Set(['sleep', 'sleepBunk', 'sleepBag']);
let zFrames: Frame[] | null = null;
/** pixel Z glyphs (big, small) with a dark outline, for the sleeping effect */
function zGlyphs(): Frame[] {
  if (zFrames) return zFrames;
  const make = (rows: string[], key: string) => {
    const w = rows[0].length + 2, h = rows.length + 2;
    const pb = new PixelBuffer(w, h);
    const on = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] === '#';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (on(x - 1, y - 1)) pb.data[y * w + x] = y < h / 2 ? 0xfffff4ec : 0xffe8d8c8;
      else if (on(x - 2, y - 1) || on(x, y - 1) || on(x - 1, y - 2) || on(x - 1, y)) pb.data[y * w + x] = 0xff3a2436;
    }
    return atlas.add(key, pb, w / 2, h / 2);
  };
  zFrames = [
    make(['#####', '...#.', '..#..', '.#...', '#####'], 'fx:z5'),
    make(['###', '.#.', '###'], 'fx:z3'),
  ];
  return zFrames;
}

function bodyFrame(id: string, anim: string, frame: number): BodyCache | null {
  if (!people) return null;
  const key = `${id}.${anim}.${frame}`;
  let b = bodyCache.get(key);
  if (!b) {
    const art = people.renderBody(id, anim, frame);
    b = {
      back: atlas.add('pb:' + key, art.back, art.ax, art.ay),
      front: art.front ? atlas.add('pf:' + key, art.front, art.ax, art.ay) : null,
      ax: art.ax, ay: art.ay, hx: art.hx, hy: art.hy, look: art.look ?? 'fwd', hand: art.hand ?? null, headBehind: !!art.headBehind, hrot: art.hrot ?? 0, hflip: !!art.hflip, hair: art.hair ?? 0,
    };
    bodyCache.set(key, b);
  }
  return b;
}

function headFrame(id: string, expr: string, mouth: 0 | 1 | 2, blink: boolean, look: Look, hair = 0): Frame | null {
  if (!people) return null;
  const key = `${id}|${expr}|${mouth}|${blink ? 1 : 0}|${look}|${hair}`;
  let f = headCache.get(key);
  if (!f) {
    const h = people.renderHead(id, { expr, mouth, blink, look, hair });
    f = atlas.add('ph:' + key, h.buf, h.ax, h.ay);
    headCache.set(key, f);
  }
  return f;
}

export function emoteAnim(kind: string): Frame[] {
  let fr = emoteCache.get(kind);
  if (!fr) {
    if (!emotes) return [];
    const bufs = emotes.emoteFrames(kind);
    fr = bufs.map((b, i) => atlas.add(`em:${kind}#${i}`, b, b.w / 2, b.h));
    emoteCache.set(kind, fr);
  }
  return fr;
}

export function animInfo(anim: string, id?: string) {
  return (id && people?.animFor?.(id, anim)) || people?.ANIMS[anim] || { frames: 1, fps: 1, loop: true };
}

/** Pre-render a character's body frames for the given anims (call during loading to avoid hitches). */
export function warmActor(id: string, anims?: string[]) {
  if (!people) return;
  const list = anims ?? people.CHAR_ANIMS[id] ?? [];
  for (const a of list) {
    const n = animInfo(a, id).frames;
    for (let i = 0; i < n; i++) bodyFrame(id, a, i);
  }
  for (const e of ['neutral', 'happy']) for (const m of [0, 1, 2] as const) headFrame(id, e, m, false, 'fwd');
  headFrame(id, 'neutral', 0, true, 'fwd');
}

// ------------------------------------------------------------------ actor

export const CHAR_COLORS: Record<string, string> = {
  mori: '#4a6a2a', jenna: '#d04890', joshu: '#2c3a5a', aroha: '#8a4b2a', chunk: '#c8402e',
  rowan: '#4a6a2a', crowe: '#2c3a5a', lou: '#2c3a5a', pip: '#d04890', phone: '#13262b',
};
export const CHAR_NAMES: Record<string, string> = {
  mori: 'Mori', jenna: 'Jenna', joshu: 'Joshu', aroha: 'Aroha', chunk: 'Chunk',
  rowan: 'Mori', crowe: 'Joshu', lou: 'Joshu', pip: 'Jenna', phone: 'Phone',
};
export const CHAR_VOICE: Record<string, number> = { mori: 1, jenna: 1.5, joshu: 0.62, aroha: 1.12, chunk: 1.9, rowan: 1, crowe: 0.62, lou: 0.62, pip: 1.5, phone: 1.6 };

export type ReactKind = 'jump' | 'shake' | 'shrink' | 'nod' | 'bounce' | 'recoil' | 'tremble' | 'stretch' | 'land';

export class Actor implements Drawable {
  z = 40;
  x: number;
  y: number;
  facing = 1;
  anim = 'idle';
  private animT = 0;
  private once: { anim: string; then: string; res: () => void } | null = null;
  /** frame override (hold a specific frame of the current anim) */
  holdFrame: number | null = null;
  baseExpr = 'neutral';
  expr = 'neutral';
  private exprT = 0;
  look: Look | null = null;
  talking = false;
  private mouth: 0 | 1 | 2 = 0;
  private mouthT = 0;
  private blinkT = 2 + rand.next() * 3;
  private blinking = 0;
  sqx = 1;
  sqy = 1;
  private hop = 0;
  private hopV = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  private tremble = 0;
  private emote: { kind: string; t: number; dur: number } | null = null;
  alpha = 1;
  visible = true;
  tint = WHITE;
  shadow = true;
  /** walking */
  private walkX: number | null = null;
  private walkSpeed = 50;
  private walkRes: (() => void) | null = null;
  walkAnim = 'walk';
  idleAnim = 'idle';
  vx = 0;
  terrain: Terrain | null = null;
  /** layer holding this actor (for bubble anchors under transformed layers) */
  layer: Layer | null = null;
  /** parallax of the layer (1 = gameplay plane) */
  p = 1;
  /** extra draw offset (e.g. sitting on a seat) */
  ox = 0;
  oy = 0;
  /** idle behaviour: occasional look-around / fidget */
  fidget = true;
  private fidgetT = 3 + rand.next() * 5;
  /** head bob on talk */
  private nodT = 0;

  constructor(readonly id: string, x: number, y: number, facing = 1) {
    this.x = x;
    this.y = y;
    this.facing = facing;
  }

  get name() {
    return CHAR_NAMES[this.id] ?? this.id;
  }

  /**
   * What this character is wearing ('casual', 'winter', 'winterHood', 'storm'). Setting it dresses the
   * character everywhere (this sprite, other actors with the same id, dialogue portraits, close-ups).
   */
  get outfit(): string {
    return people?.outfitOf?.(this.id) ?? 'casual';
  }
  set outfit(o: string) {
    people?.setOutfit?.(this.id, o);
  }
  /** the art id frames are rendered and cached under: 'mori' or 'mori@winter' */
  private get artId() {
    const o = this.outfit;
    return o === 'casual' ? this.id : `${this.id}@${o}`;
  }
  get height() {
    return people?.CHAR_INFO[this.id]?.height ?? 64;
  }

  /** posture transition in progress: plays a clip, then switches to `to` */
  private trans: { to: string } | null = null;
  /** insert posture transitions (sit down / stand up / lie down / get up) automatically */
  transitions = true;

  /** Loop an animation (no-op if already playing). */
  setAnim(anim: string) {
    if (this.anim === anim && !this.once && !this.trans) return;
    if (this.trans?.to === anim) return;
    if (this.once) { const o = this.once; this.once = null; o.res(); }
    const from = this.trans ? this.trans.to : this.anim;
    this.trans = null;
    const clip = this.transitions ? people?.transitionFor?.(this.id, from, anim) : null;
    this.anim = clip ?? anim;
    if (clip) this.trans = { to: anim };
    this.animT = 0;
    this.holdFrame = null;
  }

  /** Play an animation once, then switch to `then` (default: previous idle). */
  play(anim: string, then = this.idleAnim): Promise<void> {
    if (this.once) { const o = this.once; this.once = null; o.res(); }
    this.trans = null;
    this.anim = anim;
    this.animT = 0;
    this.holdFrame = null;
    const info = animInfo(anim, this.id);
    if (info.loop) {
      // looping anims played "once" run one cycle
      return new Promise(res => {
        this.once = { anim, then, res };
      });
    }
    return new Promise(res => {
      this.once = { anim, then, res };
    });
  }

  setExpr(e: string, dur = 0) {
    this.expr = e;
    this.exprT = dur;
    if (!dur) this.baseExpr = e;
  }

  clearEmote() {
    this.emote = null;
  }

  showEmote(kind: string, dur = 1.6) {
    this.emote = { kind, t: 0, dur };
    const s: Record<string, string> = {
      exclaim: 'emoteSurprise', interrobang: 'emoteSurprise', alarm: 'emoteSurprise', shock: 'emoteSurprise', question: 'emoteQuestion',
      laugh: 'emoteLaugh', anger: 'emoteAngry', heart: 'emoteHeart', sweat: 'emoteSweat', sparkle: 'emoteHeart', idea: 'emoteQuestion', music: 'emoteHeart',
    };
    if (s[kind]) audio.play(s[kind] as 'ui', { vol: 0.45 });
  }

  react(kind: ReactKind | string) {
    switch (kind) {
      case 'jump': this.hopV = -120; this.sqx = 0.8; this.sqy = 1.25; break;
      case 'bounce': this.hopV = -60; this.sqx = 0.9; this.sqy = 1.12; break;
      case 'land': this.sqx = 1.25; this.sqy = 0.78; break;
      case 'shake': this.shakeT = 0.45; this.shakeAmp = 1.6; break;
      case 'tremble': this.tremble = 1.4; break;
      case 'shrink': this.sqx = 1.12; this.sqy = 0.82; break;
      case 'stretch': this.sqx = 0.86; this.sqy = 1.16; break;
      case 'recoil': this.hopV = -40; this.x -= this.facing * 3; this.sqx = 1.1; this.sqy = 0.9; break;
      case 'nod': this.nodT = 0.35; break;
    }
  }

  walkTo(x: number, speed = 50, anim = speed > 85 ? 'run' : 'walk'): Promise<void> {
    this.walkRes?.();
    this.walkX = x;
    this.walkSpeed = speed;
    this.walkAnim = anim;
    return new Promise(res => (this.walkRes = res));
  }
  get walking() {
    return this.walkX !== null;
  }
  stopWalk() {
    this.walkX = null;
    this.vx = 0;
    const r = this.walkRes;
    this.walkRes = null;
    r?.();
  }

  faceTo(x: number) {
    if (Math.abs(x - this.x) > 1) this.facing = x > this.x ? 1 : -1;
  }

  private lastPX = NaN;
  private lastPY = NaN;
  /** current frame of the playing clip */
  currentFrame() { return this.frameIndex(); }

  update(dt: number) {
    // locomotion clips advance by distance travelled, so planted feet (and hands on a ladder) never skate
    const inf = animInfo(this.anim, this.id) as { frames: number; fps: number; dist?: number };
    const moved = Number.isFinite(this.lastPX) ? Math.min(12, Math.hypot(this.x - this.lastPX, this.y - this.lastPY)) : 0;
    this.lastPX = this.x; this.lastPY = this.y;
    if (inf.dist && !this.trans && !this.once) this.animT += moved > 0.02 ? (moved / inf.dist) * (inf.frames / inf.fps) : dt * 0.25;
    else this.animT += dt;
    // posture transition finished: continue into the target anim
    if (this.trans) {
      const info = animInfo(this.anim, this.id);
      if (this.animT >= info.frames / info.fps) {
        this.anim = this.trans.to;
        this.trans = null;
        this.animT = 0;
      }
    }
    // one-shot completion
    if (this.once) {
      const info = animInfo(this.anim, this.id);
      if (this.animT >= info.frames / info.fps) {
        const o = this.once;
        this.once = null;
        if (!animInfo(o.anim, this.id).loop) {
          this.holdFrame = null;
        }
        this.anim = o.then;
        this.animT = 0;
        o.res();
      }
    }
    // scripted walking
    if (this.walkX !== null) {
      const d = this.walkX - this.x;
      if (Math.abs(d) < 1.2) {
        this.x = this.walkX;
        this.stopWalk();
        if (this.anim === this.walkAnim) this.setAnim(this.idleAnim);
      } else {
        this.facing = Math.sign(d);
        this.vx = Math.sign(d) * this.walkSpeed;
        this.x += this.vx * dt;
        if (Math.sign(this.walkX - this.x) !== Math.sign(d)) this.x = this.walkX;
        if (!this.once && this.anim !== this.walkAnim && this.trans?.to !== this.walkAnim) this.setAnim(this.walkAnim);
      }
    }
    if (this.terrain) {
      const s = this.terrain.surfaceBelow(this.x, this.y - 10, 0);
      if (s && Math.abs(s.y - this.y) < 14) this.y = s.y;
    }
    // expression timer
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = this.baseExpr;
    }
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.13;
      this.blinkT = 1.8 + rand.next() * 3.8;
      if (rand.next() < 0.18) this.blinkT = 0.25; // double blink
    }
    this.blinking = Math.max(0, this.blinking - dt);
    // talking mouth flaps
    if (this.talking) {
      this.mouthT -= dt;
      if (this.mouthT <= 0) {
        const r = rand.next();
        this.mouth = this.mouth === 0 ? (r < 0.6 ? 2 : 1) : r < 0.45 ? 0 : r < 0.75 ? 1 : 2;
        this.mouthT = 0.06 + rand.next() * 0.08;
      }
    } else this.mouth = 0;
    // squash & stretch spring back
    this.sqx += (1 - this.sqx) * Math.min(1, dt * 10);
    this.sqy += (1 - this.sqy) * Math.min(1, dt * 10);
    // hop physics
    if (this.hopV !== 0 || this.hop < 0) {
      this.hopV += 520 * dt;
      this.hop += this.hopV * dt;
      if (this.hop >= 0) {
        if (this.hopV > 80) { this.sqx = 1.18; this.sqy = 0.85; }
        this.hop = 0;
        this.hopV = 0;
      }
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.tremble = Math.max(0, this.tremble - dt);
    this.nodT = Math.max(0, this.nodT - dt);
    if (this.emote) {
      this.emote.t += dt;
      if (this.emote.t >= this.emote.dur) this.emote = null;
    }
    // idle fidgets: glance around
    if (this.fidget && !this.talking && this.walkX === null && this.anim === this.idleAnim) {
      this.fidgetT -= dt;
      if (this.fidgetT <= 0) {
        this.fidgetT = 4 + rand.next() * 6;
        const r = rand.next();
        if (r < 0.35) { this.look = 'up'; setTimeout(() => { if (this.look === 'up') this.look = null; }, 900); }
        else if (r < 0.55) { this.look = 'down'; setTimeout(() => { if (this.look === 'down') this.look = null; }, 700); }
      }
    }
  }

  private frameIndex() {
    const info = animInfo(this.anim, this.id);
    if (this.holdFrame !== null) return Math.min(info.frames - 1, this.holdFrame);
    const i = Math.floor(this.animT * info.fps);
    return info.loop ? i % info.frames : Math.min(info.frames - 1, i);
  }

  /** world position of the top of the head (for emotes and bubbles) */
  headTop(): [number, number] {
    const b = bodyFrame(this.artId, this.anim, this.frameIndex());
    if (!b) return [this.x, this.y - 84 + this.hop];
    const hx = this.x + this.ox + this.facing * (b.hx - b.ax) * this.sqx;
    const hy = this.y + this.oy + this.hop + (b.hy - b.ay) * this.sqy;
    const h = headFrame(this.artId, this.expr, 0, false, 'fwd');
    const top = h ? (b.hflip ? h.h - h.ay : h.ay) : 17;
    return [hx, hy - top * this.sqy];
  }

  /** CSS anchor above the head (accounts for layer parallax and layer transform) */
  cssAnchor(): [number, number] | null {
    if (!this.visible) return null;
    const r = game.r;
    let [x, y] = this.headTop();
    const xf = this.layer?.xf;
    if (xf) {
      const c = Math.cos(xf[2]), s = Math.sin(xf[2]);
      const dx = x - xf[0], dy = y - xf[1];
      x = xf[0] + xf[3] + dx * c - dy * s;
      y = xf[1] + xf[4] + dx * s + dy * c;
    }
    const sx = r.projectX(x, this.p), sy = r.projectY(y - 4, this.p);
    if (sx < -40 || sx > r.VW + 40 || sy < -60 || sy > r.VH + 40) return null;
    const [cx, cy] = game.ui.artToCss(sx, sy, r.VW, r.VH);
    return [cx, cy];
  }

  /** A bubble speaker bound to this actor. */
  speaker(name = this.name): Speaker {
    return {
      name,
      voice: CHAR_VOICE[this.id] ?? 1,
      color: CHAR_COLORS[this.id] ?? '#3fbca6',
      anchor: () => this.cssAnchor(),
      talk: on => {
        this.talking = on;
        // busy idles name their own talking clip (at the wheel the hands stay on it)
        const tk = animInfo(this.idleAnim, this.id).talk ?? 'talk';
        if (on && (this.anim === this.idleAnim) && tk !== this.idleAnim && (tk !== 'talk' || people?.CHAR_ANIMS[this.id]?.includes('talk')) && this.walkX === null) this.setAnim(tk);
        if (!on && this.anim === tk && tk !== this.idleAnim) this.setAnim(this.idleAnim);
      },
      react: o => {
        if (o.expr) this.setExpr(o.expr, 0);
        if (o.emote) this.showEmote(o.emote);
        if (o.react) this.react(o.react);
      },
    };
  }

  draw(r: Renderer, st?: Stage) {
    if (!this.visible || this.alpha <= 0) return;
    void st;
    const fi = this.frameIndex();
    const art = this.artId;
    const b = bodyFrame(art, this.anim, fi);
    const sh = this.shakeT > 0 ? Math.sin(this.shakeT * 70) * this.shakeAmp : 0;
    const tr = this.tremble > 0 ? (Math.floor(this.tremble * 30) % 2 ? 0.5 : -0.5) : 0;
    const x = this.x + this.ox + sh + tr, y = this.y + this.oy + this.hop;
    const col = this.alpha < 1 ? packColor(((this.tint & 255) / 255), ((this.tint >>> 8) & 255) / 255, ((this.tint >>> 16) & 255) / 255, this.alpha) : this.tint;
    if (this.shadow && this.hop > -40) {
      r.beginShadows();
      const k = 1 + this.hop / 80;
      r.draw(A.shadow, this.x + this.ox, this.y + this.oy, 0.85 * k, 0.9 * k, 0, packColor(0, 0, 0, 0.42 * this.alpha));
      r.endShadows();
    }
    if (!b) {
      // art not bound yet: placeholder capsule
      r.rect(x - 8, y - 60, 16, 60, packColor(0.4, 0.5, 0.6, this.alpha));
      return;
    }
    const f = this.facing;
    const lk: Look = this.look ?? b.look;
    const expr = this.expr;
    const blink = this.blinking > 0;
    const head = headFrame(art, expr, this.mouth, blink, lk, b.hair);
    const nod = this.nodT > 0 ? Math.sin((this.nodT / 0.35) * Math.PI) * 1.5 : 0;
    const hx = x + f * (b.hx - b.ax) * this.sqx, hy = y + (b.hy - b.ay) * this.sqy + nod;
    const sx = f * this.sqx, sy = this.sqy;
    const hr = b.hrot * f;
    const hsy = b.hflip ? -sy : sy;
    if (b.headBehind && head) r.draw(head, hx, hy, sx, hsy, hr, col);
    r.draw(b.back, x, y, sx, sy, 0, col);
    if (!b.headBehind && head) r.draw(head, hx, hy, sx, hsy, hr, col);
    if (b.front) r.draw(b.front, x, y, sx, sy, 0, col);
    // sleeping: Z's drifting up from the head, swaying, growing and fading out
    if (SLEEP.has(this.anim)) {
      const zs = zGlyphs(), t = this.animT;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.32 + i / 3) % 1;
        const a = Math.min(1, ph * 4) * Math.min(1, (1 - ph) * 2.5) * this.alpha;
        const zx = hx + f * (3 + ph * 9) + Math.sin(ph * 6.3 + i) * 2.2, zy = hy - 6 - ph * 16;
        r.emissive(0.6);
        r.draw(ph < 0.4 ? zs[1] : zs[0], zx, zy, 0.7 + ph * 0.5, 0.7 + ph * 0.5, Math.sin(ph * 5 + i) * 0.2, packColor(1, 1, 1, a));
        r.emissive();
      }
    }
    // emote above head
    if (this.emote) {
      const fr = emoteAnim(this.emote.kind);
      if (fr.length) {
        const info = emotes?.EMOTE_INFO[this.emote.kind] ?? { frames: fr.length, fps: 8, loop: true };
        const i = info.loop ? Math.floor(this.emote.t * info.fps) % fr.length : Math.min(fr.length - 1, Math.floor(this.emote.t * info.fps));
        const pop = this.emote.t < 0.18 ? 0.5 + (this.emote.t / 0.18) * 0.7 : this.emote.t < 0.3 ? 1.2 - ((this.emote.t - 0.18) / 0.12) * 0.2 : 1;
        const fade = clamp((this.emote.dur - this.emote.t) / 0.25);
        const [tx, ty] = this.headTop();
        r.emissive(0.9);
        r.draw(fr[i], tx + f * 6, ty - 3 + this.hop * 0 - Math.sin(this.emote.t * 5) * 1, pop, pop, 0, packColor(1, 1, 1, fade * this.alpha));
        r.emissive();
      }
    }
  }

  /** Hand position in world space (for held props & particles). */
  handPos(): [number, number] | null {
    const b = bodyFrame(this.artId, this.anim, this.frameIndex());
    if (!b || !b.hand) return null;
    return [this.x + this.ox + this.facing * (b.hand[0] - b.ax), this.y + this.oy + this.hop + (b.hand[1] - b.ay)];
  }

  /** approach helper for smooth scripted movement */
  nudge(tx: number, speed: number, dt: number) {
    this.x = approach(this.x, tx, speed * dt);
  }
}

/** Portrait data URL for dialogue/UI (cached). */
const portraitCache = new Map<string, string>();
export function portraitURL(id: string, expr = 'neutral', scale = 3): string {
  if (!people || !people.CHAR_INFO[id]) return '';
  const key = `${id}@${people.outfitOf?.(id) ?? ''}|${expr}|${scale}`;
  let u = portraitCache.get(key);
  if (!u) {
    u = people.renderPortrait(id, expr).toDataURL(scale);
    portraitCache.set(key, u);
  }
  return u;
}
