// Actor: a V2 character on stage. Composites a pre-rendered body frame, a separately rendered head
// (any expression, talking mouth, blinking, look direction) and a front-arm layer, and adds cartoon
// life on top: squash & stretch, hops, shakes, emote icons, scripted walking and talking for bubbles.

import type { Renderer, Frame } from '../gfx/renderer';
import { packColor, WHITE } from '../gfx/renderer';
import type { Drawable, Stage, Layer } from './stage';
import type { Terrain } from './terrain';
import type { PixelBuffer } from '../art/pixel';
import type { Speaker } from '../ui/bubbles';
import { atlas, A } from '../game/assets';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { approach, clamp, rand } from '../core/math';

// ------------------------------------------------------------------ art binding (src/art/people.ts, src/art/emotes.ts)

export type Look = 'fwd' | 'up' | 'down';
export interface BodyFrameArt { back: PixelBuffer; front: PixelBuffer | null; ax: number; ay: number; hx: number; hy: number; look?: Look; hand?: [number, number]; headBehind?: boolean }
export interface PeopleArt {
  ANIMS: Record<string, { frames: number; fps: number; loop: boolean }>;
  CHAR_ANIMS: Record<string, string[]>;
  CHAR_INFO: Record<string, { name: string; short: string; voice: number; height: number }>;
  renderBody(id: string, anim: string, frame: number): BodyFrameArt;
  renderHead(id: string, o: { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look }): { buf: PixelBuffer; ax: number; ay: number };
  renderPortrait(id: string, expr: string, o?: { mouth?: 0 | 1 | 2; blink?: boolean }): PixelBuffer;
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

interface BodyCache { back: Frame; front: Frame | null; ax: number; ay: number; hx: number; hy: number; look: Look; hand: [number, number] | null; headBehind: boolean }
const bodyCache = new Map<string, BodyCache>();
const headCache = new Map<string, Frame>();
const emoteCache = new Map<string, Frame[]>();

function bodyFrame(id: string, anim: string, frame: number): BodyCache | null {
  if (!people) return null;
  const key = `${id}.${anim}.${frame}`;
  let b = bodyCache.get(key);
  if (!b) {
    const art = people.renderBody(id, anim, frame);
    b = {
      back: atlas.add('pb:' + key, art.back, art.ax, art.ay),
      front: art.front ? atlas.add('pf:' + key, art.front, art.ax, art.ay) : null,
      ax: art.ax, ay: art.ay, hx: art.hx, hy: art.hy, look: art.look ?? 'fwd', hand: art.hand ?? null, headBehind: !!art.headBehind,
    };
    bodyCache.set(key, b);
  }
  return b;
}

function headFrame(id: string, expr: string, mouth: 0 | 1 | 2, blink: boolean, look: Look): Frame | null {
  if (!people) return null;
  const key = `${id}|${expr}|${mouth}|${blink ? 1 : 0}|${look}`;
  let f = headCache.get(key);
  if (!f) {
    const h = people.renderHead(id, { expr, mouth, blink, look });
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

export function animInfo(anim: string) {
  return people?.ANIMS[anim] ?? { frames: 1, fps: 1, loop: true };
}

/** Pre-render a character's body frames for the given anims (call during loading to avoid hitches). */
export function warmActor(id: string, anims?: string[]) {
  if (!people) return;
  const list = anims ?? people.CHAR_ANIMS[id] ?? [];
  for (const a of list) {
    const n = people.ANIMS[a]?.frames ?? 1;
    for (let i = 0; i < n; i++) bodyFrame(id, a, i);
  }
  for (const e of ['neutral', 'happy']) for (const m of [0, 1, 2] as const) headFrame(id, e, m, false, 'fwd');
  headFrame(id, 'neutral', 0, true, 'fwd');
}

// ------------------------------------------------------------------ actor

export const CHAR_COLORS: Record<string, string> = {
  rowan: '#3d6fb0', crowe: '#b73a2c', aroha: '#8a4b2a', lou: '#d2842e', pip: '#e0762a', phone: '#13262b',
};
export const CHAR_NAMES: Record<string, string> = {
  rowan: 'Rowan', crowe: 'Crowe', aroha: 'Aroha', lou: 'Lou', pip: 'Pip', phone: 'Phone',
};
export const CHAR_VOICE: Record<string, number> = { rowan: 1, crowe: 0.66, aroha: 1.08, lou: 0.9, pip: 1.45, phone: 1.6 };

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
  get height() {
    return people?.CHAR_INFO[this.id]?.height ?? 64;
  }

  /** Loop an animation (no-op if already playing). */
  setAnim(anim: string) {
    if (this.anim === anim && !this.once) return;
    if (this.once) { const o = this.once; this.once = null; o.res(); }
    this.anim = anim;
    this.animT = 0;
    this.holdFrame = null;
  }

  /** Play an animation once, then switch to `then` (default: previous idle). */
  play(anim: string, then = this.idleAnim): Promise<void> {
    if (this.once) { const o = this.once; this.once = null; o.res(); }
    this.anim = anim;
    this.animT = 0;
    this.holdFrame = null;
    const info = animInfo(anim);
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

  update(dt: number) {
    this.animT += dt;
    // one-shot completion
    if (this.once) {
      const info = animInfo(this.anim);
      if (this.animT >= info.frames / info.fps) {
        const o = this.once;
        this.once = null;
        if (!animInfo(o.anim).loop) {
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
        if (!this.once && this.anim !== this.walkAnim) { this.anim = this.walkAnim; }
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
    const info = animInfo(this.anim);
    if (this.holdFrame !== null) return Math.min(info.frames - 1, this.holdFrame);
    const i = Math.floor(this.animT * info.fps);
    return info.loop ? i % info.frames : Math.min(info.frames - 1, i);
  }

  /** world position of the top of the head (for emotes and bubbles) */
  headTop(): [number, number] {
    const b = bodyFrame(this.id, this.anim, this.frameIndex());
    if (!b) return [this.x, this.y - 70 + this.hop];
    const hx = this.x + this.ox + this.facing * (b.hx - b.ax) * this.sqx;
    const hy = this.y + this.oy + this.hop + (b.hy - b.ay) * this.sqy;
    return [hx, hy - 26 * this.sqy];
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
        if (on && (this.anim === this.idleAnim) && people?.CHAR_ANIMS[this.id]?.includes('talk') && this.walkX === null) this.setAnim('talk');
        if (!on && this.anim === 'talk') this.setAnim(this.idleAnim);
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
    const b = bodyFrame(this.id, this.anim, fi);
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
    const head = headFrame(this.id, expr, this.mouth, blink, lk);
    const nod = this.nodT > 0 ? Math.sin((this.nodT / 0.35) * Math.PI) * 1.5 : 0;
    const hx = x + f * (b.hx - b.ax) * this.sqx, hy = y + (b.hy - b.ay) * this.sqy + nod;
    const sx = f * this.sqx, sy = this.sqy;
    if (b.headBehind && head) r.draw(head, hx, hy, sx, sy, 0, col);
    r.draw(b.back, x, y, sx, sy, 0, col);
    if (!b.headBehind && head) r.draw(head, hx, hy, sx, sy, 0, col);
    if (b.front) r.draw(b.front, x, y, sx, sy, 0, col);
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
    const b = bodyFrame(this.id, this.anim, this.frameIndex());
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
  const key = `${id}|${expr}|${scale}`;
  let u = portraitCache.get(key);
  if (!u) {
    u = people.renderPortrait(id, expr).toDataURL(scale);
    portraitCache.set(key, u);
  }
  return u;
}
