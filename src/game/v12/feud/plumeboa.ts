// V12 The Giant Feathered Boa in the world: its Body (the spine painter, src/art/serpent.ts, with the
// plumboa look's feathers) shaped by what it is doing, and its mind on top of the wildlife brain.
//
// The body is a chain of spine points, head first. The act shapes it:
//   free     gliding through the grass, the body settling on the ground behind the head
//   rear     the threat: the neck raised in an S, the ruff thrown up into a frill, a hiss
//   coil     lying in ambush, resting, digesting (loose S-coils round the head)
//   wrap     constricting: three coils thrown round the prey, squeezing on every breath out
// A swallowed meal shows as a bulge that slides down the body.
//
// Acts: wander ambush strike constrict swallow digest ruff (the threat display) brawl (the director's fight)
// drag retreat flinch stunned rest cine.
// It strikes if Mori steps on it (or stands at its head while it's riled): a hiss, the ruff, then the
// lunge. Pebbles cost it nerve like any predator; at 0 it glides off into cover.

import type { Renderer } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import type { FieldScene } from '../../scenes/field';
import { Animal, Body, SPECIALS, HOOKS } from '../../wild/animal';
import type { Box } from '../../wild/world';
import { BODY_MAKERS, drawEmote } from '../../wild/bodies';
import { SerpentPainter, followSpine, makeSpine, SerpentState } from '../../../art/serpent';
import { SERPENT_LOOKS } from '../../../art/fauna';
import { DynamicSprite, trackSceneTexture } from '../../../gfx/atlas';
import { A } from '../../assets';
import { game } from '../../game';
import { clamp, damp, lerp, rand } from '../../../core/math';
import { registerPredator, predState, emitPred } from '../../v11/predators-core';
import { sfx11 } from '../../v11/predators-sfx';
import { hitMori, moriHidden } from '../wilds';
import { floatText } from '../../../ui/v12/float';
import { PLUMEBOA_ID } from './species';
import { featherBurst, dustBurst } from './fx';

const T = PLUMEBOA_ID;
type Pt = [number, number];

// ------------------------------------------------------------------ the mind the director shares
export interface BoaMind {
  task: string | null;
  foe: Animal | null;
  /** the animal in its coils / the carcass in its jaws */
  victim: Animal | null;
  carcass: Animal | null;
  /** where to strike (world point) for the strike act */
  aim: Pt | null;
  /** strike at: 'prey' (catch it), 'mori' (hit him), 'foe' (bite the Bearer) */
  aimKind: 'prey' | 'mori' | 'foe' | null;
  /** walk target for drag / goto */
  tx: number;
  will: number;
  /** after a strike at Mori: not again for a while */
  cool: number;
  /** a strike landed on the foe this many times (the director reads it) */
  bites: number;
}
const MINDS = new WeakMap<Animal, BoaMind>();
export function boaMind(a: Animal): BoaMind {
  let m = MINDS.get(a);
  if (!m) { m = { task: null, foe: null, victim: null, carcass: null, aim: null, aimKind: null, tx: a.x, will: 3, cool: 0, bites: 0 }; MINDS.set(a, m); }
  return m;
}
/** a big grazer's body: centre, half length, half height (for the coils) */
export function preyBox(v: Animal): { cx: number; cy: number; hl: number; hh: number } {
  const b = v.body?.bounds(v);
  if (!b) return { cx: v.x, cy: v.y - 14, hl: 24, hh: 14 };
  return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, hl: (b.x1 - b.x0) / 2, hh: (b.y1 - b.y0) / 2 };
}

// ------------------------------------------------------------------ the body
const LOOK = SERPENT_LOOKS[T];
const R0 = LOOK.radius;
const SP = 4;

export class PlumeBody implements Body {
  readonly painter = new SerpentPainter(LOOK);
  pts: Pt[];
  private spr: DynamicSprite;
  private ox = 0;
  private oy = 0;
  private t = rand.next() * 10;
  private skip = 0;
  private tongue = 0;
  private tongueT = 0;
  private blinkT = 3;
  private legPhase = 0;
  /** ruff lift 0..1, reared neck height px, wrap / coil blends */
  ruff = 0;
  rearH = 0;
  private wrapK = 0;
  private coilK = 0;
  /** the swallowed meal: bulge size and where it is along the body (0 head .. 1 tail) */
  swell = 0;
  swellAt = 0.1;
  /** the head's own target (strikes, fight lunges) */
  aim: Pt | null = null;
  /** the head is pulled toward the aim this fast (1/s) */
  aimK = 10;
  jaw = 0;
  /** extra rear height asked for by the act */
  rearTo = 0;
  ruffTo = 0;
  private repaint = true;

  constructor(readonly a: Animal) {
    this.pts = makeSpine(a.x, a.y - R0, a.facing, LOOK.length, SP);
    this.spr = new DynamicSprite(game.r, 900, 460, 0, 0);
    trackSceneTexture(this.spr.tex);
  }

  private ground(a: Animal) {
    return (x: number) => {
      const s = a.host.terrain.surfaceBelow(x, this.pts[0][1] - 30, 0, false);
      return s ? s.y : a.host.terrain.groundY(x);
    };
  }

  update(dt: number, a: Animal) {
    this.t += dt;
    const act = a.act;
    const g = this.ground(a);
    const m = boaMind(a);
    // ---- what the act asks of the body
    const wrap = act === 'constrict' && !!m.victim;
    const coiling = !wrap && (act === 'ambush' || act === 'rest' || act === 'digest' || act === 'sleep');
    // standing its ground (rearing, striking, swallowing): what is behind the neck lies in a pile of coils
    const still = !wrap && !coiling && (act === 'ruff' || act === 'brawl' || act === 'strike' || act === 'flinch' || act === 'stunned' || act === 'swallow' || act === 'idle' || act === 'cine');
    const rearing = act === 'ruff' || act === 'brawl' || (act === 'strike' && (a.mem.ph ?? 0) === 0) || act === 'flinch';
    this.rearH = damp(this.rearH, rearing ? (this.rearTo || 46) : act === 'swallow' ? 6 : act === 'strike' ? 14 : 0, 5, dt);
    this.ruff = damp(this.ruff, this.ruffTo || (act === 'ruff' || act === 'brawl' ? 1 : act === 'strike' ? 0.75 : act === 'constrict' ? 0.35 : act === 'flinch' ? 0.2 : 0), 6, dt);
    this.wrapK = damp(this.wrapK, wrap ? 1 : 0, 2.5, dt);
    this.coilK = damp(this.coilK, coiling || still || wrap ? 1 : 0, 1.5, dt);
    this.jaw = Math.max(a.jaw, act === 'ruff' ? 0.55 + Math.sin(this.t * 3) * 0.1 : act === 'swallow' ? 1 : act === 'drag' ? 0.5 : 0);
    const swellTo = act === 'swallow' ? Math.min(1, a.actT / 5) : act === 'digest' ? 1 : 0;
    this.swell = damp(this.swell, swellTo, act === 'digest' || act === 'swallow' ? 1 : 0.15, dt);
    if (act === 'swallow') this.swellAt = 0.06 + Math.min(1, a.actT / 6) * 0.12;
    else if (this.swell > 0.05) this.swellAt = Math.min(0.48, this.swellAt + dt * 0.004);
    // ---- the head
    const pts = this.pts;
    const [hx, hy] = pts[0];
    let tx = a.x, ty = g(a.x) - R0 * 0.9 - this.rearH;
    let k = Math.min(1, dt * 10);
    if (this.aim) { tx = this.aim[0]; ty = this.aim[1]; k = Math.min(1, dt * this.aimK); }
    else if (rearing) tx = a.x + Math.sin(this.t * 1.7) * 3;
    if (wrap && m.victim) {
      const v = preyBox(m.victim);
      const dir = m.victim.facing;
      tx = v.cx + dir * (v.hl * 0.55 + R0 * 0.6); ty = v.cy - v.hh - R0 * 0.35 + Math.sin(this.t * 2) * 1.5;
      k = Math.min(1, dt * 4);
    }
    const nx = lerp(hx, tx, k), ny = lerp(hy, ty, k);
    this.legPhase += Math.hypot(nx - hx, ny - hy) * 0.1;
    pts[0][0] = nx; pts[0][1] = ny;
    followSpine(pts, SP, 0.12);
    const n = pts.length;
    // ---- settle onto the ground (the neck stays up when it rears; the coils round a kill stay put)
    const neckN = Math.max(4, Math.ceil((this.rearH * 1.7 + 24) / SP));
    const gy0 = g(a.x);
    const wrapN = this.wrapK > 0.3 && m.victim ? this.wrapCount(m.victim) : 0;
    for (let i = wrapN + 1; i < n; i++) {
      const p = pts[i], u = i / n;
      const rr = this.painter.radiusAt(u);
      let y = g(p[0]) - rr * 0.85;
      if (i < neckN && this.rearH > 1) y -= this.rearH * Math.pow(1 - i / neckN, 1.5);
      else y += Math.sin(this.legPhase - i * 0.35) * Math.sin(u * Math.PI) * 0.8;
      p[1] = lerp(p[1], y, 0.5);
    }
    // ---- coils: lying in wait, resting, digesting (the whole body); standing its ground or holding a kill
    //      (everything behind the neck / the last coil): a flat pile of loops behind the head
    if (this.coilK > 0.01) {
      const from = wrap ? wrapN + 1 : coiling ? 1 : neckN;
      const cxp = (wrap && m.victim ? preyBox(m.victim).cx - m.victim.facing * preyBox(m.victim).hl : pts[Math.min(n - 1, from)][0]) - a.facing * R0 * 3.4;
      const left = n - from;
      // as many loops as the length left makes
      const loops = Math.max(0.8, Math.min(2.6, (left * SP) / (Math.PI * 2 * R0 * 3 * 1.15)));
      for (let i = Math.max(1, from); i < n; i++) {
        const u = (i - from) / Math.max(1, left), uu = i / n;
        const ang = u * Math.PI * 2 * loops + (a.facing > 0 ? Math.PI : 0);
        const rad = R0 * 1.5 + u * R0 * 3;
        const qx = cxp + Math.cos(ang) * rad * 1.15 * -a.facing;
        const qy = Math.min(gy0 - R0 * 1.2 + Math.sin(ang) * rad * 0.3, g(qx) - this.painter.radiusAt(uu) * 0.85);
        pts[i][0] = lerp(pts[i][0], qx, this.coilK * 0.08);
        pts[i][1] = lerp(pts[i][1], qy, this.coilK * 0.08);
      }
      if (!wrap) followSpine(pts, SP, 0);
    }
    // ---- the wrap: the neck lies along the prey's back, then two and a half rings of coil round it,
    //      squeezing on every breath out
    if (this.wrapK > 0.01 && m.victim) {
      const v = preyBox(m.victim);
      const dir = m.victim.facing;
      const R = (v.hh + R0 * 0.35) * (1 - 0.06 * (0.5 + 0.5 * Math.sin(this.t * 2.2)));
      const rx = R * 0.4;
      const pitch = Math.max(R0 * 1.8, v.hl * 0.9);
      const neck = R0 * 1.1;
      const x0 = v.cx + dir * v.hl * 0.45, top = v.cy - R;
      const ringL = Math.PI * (R + rx);
      const M = this.wrapCount(m.victim);
      for (let i = 1; i <= M; i++) {
        const s = i * SP;
        let qx: number, qy: number;
        if (s < neck) { qx = x0 - dir * s * 0.7; qy = top + (s / neck) * 3; }
        else {
          const ang = ((s - neck) / ringL) * Math.PI * 2;
          qx = x0 - dir * neck * 0.7 - dir * (ang / (Math.PI * 2)) * pitch + dir * Math.sin(ang) * rx;
          // the coils flatten where they lie on the ground under the kill
          qy = Math.min(v.cy - Math.cos(ang) * R + 2, g(qx) - this.painter.radiusAt(i / n) * 0.8);
        }
        const kk = this.wrapK * 0.55;
        pts[i][0] = lerp(pts[i][0], qx, kk);
        pts[i][1] = lerp(pts[i][1], qy, kk);
      }
    }
    // ---- tongue, blinks
    this.tongueT -= dt;
    if (this.tongueT < 0 && rand.next() < dt * (act === 'wander' || act === 'ambush' || act === 'ruff' ? 1.6 : 0.4)) this.tongueT = 0.4;
    this.tongue = this.tongueT > 0 ? Math.sin((this.tongueT / 0.4) * Math.PI) : 0;
    this.blinkT -= dt;
    if (this.blinkT < -0.15) this.blinkT = 2 + rand.next() * 4;
    this.repaint = true;
  }

  /** how many spine points the coils round a kill take */
  private wrapCount(victim: Animal): number {
    const v = preyBox(victim);
    const R = v.hh + R0 * 0.35;
    return Math.min(this.pts.length - 2, Math.floor((R0 * 1.1 + Math.PI * (R + R * 0.4) * 2.1) / SP));
  }

  /** run the body a few seconds ahead (a spawn settles into its coils before anyone sees it) */
  settle(a: Animal, secs = 3) {
    const keep = this.coilK;
    this.coilK = a.act === 'ambush' || a.act === 'rest' ? 1 : keep;
    for (let t = 0; t < secs; t += 1 / 30) this.update(1 / 30, a);
  }

  bounds(): Box {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < this.pts.length; i += 2) {
      const p = this.pts[i];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    const lift = this.ruff * R0 * 2.6;
    return { x0: x0 - R0, y0: y0 - R0 * 1.4 - lift, x1: x1 + R0, y1: y1 + R0 };
  }
  head(): [number, number] { return [this.pts[0][0], this.pts[0][1] - R0]; }
  points(): [number, number][] {
    const out: [number, number][] = [];
    const n = this.pts.length;
    for (let i = 0; i < n; i += 4) {
      const p = this.pts[i];
      out.push([p[0], p[1]], [p[0], p[1] - this.painter.radiusAt(i / n) * 0.8]);
    }
    return out;
  }
  /** the point along the body nearest x (for "stepped on") */
  nearest(x: number, y: number): number {
    let best = Infinity;
    for (let i = 0; i < this.pts.length; i += 3) best = Math.min(best, Math.hypot(this.pts[i][0] - x, (this.pts[i][1] - y) * 1.4));
    return best;
  }

  draw(r: Renderer, a: Animal) {
    if (a.hidden >= 0.98) return;
    const b = this.bounds();
    if (b.x1 < r.visibleX0(80) || b.x0 > r.visibleX1(80)) return;
    const buf = this.spr.buf;
    this.skip = (this.skip + 1) % 2;
    if (this.skip === 0 && this.repaint) {
      this.repaint = false;
      this.ox = Math.floor((b.x0 + b.x1) / 2 - buf.w / 2);
      this.oy = Math.floor((b.y0 + b.y1) / 2 - buf.h / 2);
      // a reared neck: the head still looks level along the ground at what it faces, not at the sky
      const p0 = this.pts[0], p4 = this.pts[Math.min(this.pts.length - 1, 5)];
      const elev = Math.atan2(p4[1] - p0[1], Math.abs(p0[0] - p4[0]) + 1e-3);
      const tilt = this.rearH > 8 ? -Math.max(0, elev) * 0.85 * Math.min(1, this.rearH / 30) : 0;
      const st: SerpentState = {
        pts: this.pts, facing: a.facing, jaw: this.jaw, tongue: this.tongue, legPhase: this.legPhase, legLift: 0, grounded: true,
        groundY: this.ground(a), flatten: 0, swell: this.swell > 0.04 ? { at: this.swellAt, k: this.swell * 0.95 } : undefined,
        blink: this.blinkT < 0 || a.act === 'sleep', eye: a.act === 'ruff' || a.act === 'strike' || a.act === 'brawl' ? 'angry' : a.eye === 'scared' ? 'alert' : a.eye,
        crest: this.ruff, headTilt: a.act === 'swallow' ? -0.25 : tilt + (a.act === 'ruff' ? 0.12 : 0),
      };
      this.painter.paint(buf, st, this.ox, this.oy, this.t);
      this.spr.upload();
    }
    r.beginShadows();
    r.draw(A.shadow, (b.x0 + b.x1) / 2, b.y1 - 2, Math.max(0.5, (b.x1 - b.x0) / 34), 0.9, 0, packColor(0, 0, 0, 0.3));
    r.endShadows();
    r.draw(this.spr.frame, this.ox, this.oy, 1, 1, 0, packColor(1, 1, 1, a.alpha));
    const [hx, hy] = this.head();
    drawEmote(r, a, hx, hy - R0 * 2.4 - this.ruff * 18);
  }
}
BODY_MAKERS[T] = a => new PlumeBody(a);
export const boaBody = (a: Animal) => a.body as PlumeBody;

// ------------------------------------------------------------------ the mind
const host = (a: Animal) => a.host as unknown as FieldScene;
const busyAct = new Set(['strike', 'constrict', 'swallow', 'ruff', 'brawl', 'flinch', 'stunned', 'drag', 'cine', 'retreat']);

function tick(a: Animal, dt: number) {
  const s = host(a), st = predState(a), m = boaMind(a);
  a.fear = 0; a.anger = st.target ? 0.4 : 0; a.curio = 0;
  st.stun = Math.max(0, st.stun - dt);
  st.blind = Math.max(0, st.blind - dt);
  st.sinceHit += dt;
  m.cool = Math.max(0, m.cool - dt);
  if (st.script) return;
  if (st.phase !== 'retreat' && st.sinceHit > 20) st.nerve = Math.min(st.nerve + dt * 0.08, 6);
  if (st.stun > 0.5 && a.act !== 'stunned' && a.act !== 'flinch' && a.act !== 'constrict') { a.setAct('stunned', st.stun); return; }
  if (st.phase === 'retreat') { if (a.act !== 'retreat' && a.act !== 'flinch' && a.act !== 'stunned') a.setAct('retreat', 8); return; }
  // ---- Mori underfoot: it strikes
  const p = s.player, b = boaBody(a);
  if (m.cool <= 0 && !moriHidden(s) && a.act !== 'strike' && a.act !== 'cine' && a.act !== 'retreat' && a.act !== 'stunned') {
    const gy = s.st.terrain.groundY(p.x);
    const onIt = b.nearest(p.x, p.y - 8) < R0 + 4 && p.y > gy - 20;
    const [hx, hy] = b.head();
    const atHead = Math.hypot(p.x - hx, (p.y - 30 - hy) * 0.8) < 70;
    if (onIt || (atHead && (a.act === 'ruff' || a.act === 'brawl'))) {
      m.aim = [p.x, p.y - 26]; m.aimKind = 'mori';
      st.target = { kind: 'player' }; st.phase = 'charge';
      a.setAct('strike', 1.4);
      void floatText({ text: 'HSSSSSSS!', x: hx, y: hy - 30, style: 'shout', ms: 900 });
      return;
    }
  }
  if (busyAct.has(a.act)) return;
  // ---- riled by Mori close to its head: the ruff goes up
  const [hx] = b.head();
  if (!m.task && !moriHidden(s) && Math.abs(p.x - hx) < 120 && a.aw > 0.6 && a.act !== 'digest') {
    st.target = { kind: 'player' };
    a.face(p.x);
    a.setAct('ruff', 2.6);
    return;
  }
  if (st.target && Math.abs(p.x - hx) > 220) { st.target = null; st.phase = 'idle'; }
  // ---- in ambush: a grazer wanders into reach
  if (a.act === 'ambush' && !m.task) {
    const prey = nearPrey(a, 95);
    if (prey) { m.aim = [prey.x, prey.y - 12]; m.aimKind = 'prey'; m.victim = prey; a.setAct('strike', 1.4); }
  }
}
function nearPrey(a: Animal, range: number): Animal | null {
  const [hx] = boaBody(a).head();
  let best: Animal | null = null, bd = range;
  for (const o of a.host.animals) {
    if (o === a || o.dead || o.gone || o.held || !a.eco.prey?.includes(o.species)) continue;
    const d = Math.abs(o.x - hx);
    if (d < bd && Math.abs(o.y - a.y) < 30) { bd = d; best = o; }
  }
  return best;
}

HOOKS[T] = {
  tick,
  onThreat: () => true,
  decide: a => { const st = predState(a); return st.script || st.phase === 'retreat' || !!st.target || !!boaMind(a).task || a.act === 'digest'; },
};

// ------------------------------------------------------------------ the acts
const S: Record<string, (a: Animal, dt: number) => boolean | void> = {};
SPECIALS[T] = S;

/** an act has run its course: on a director task it waits for the next move; else the brain decides */
function next(a: Animal): boolean | void {
  const m = boaMind(a);
  if (predState(a).script) return;
  if (m.task === 'fight') { a.setAct('brawl', 99); return; }
  if (m.task) { a.setAct('idle', 1); return; }
  return false;
}

S.idle = a => { a.vx = 0; a.anim = 'idle'; boaBody(a).aim = null; };
S.rest = a => { a.vx = 0; a.hidden = 0; };
S.sleep = S.rest;
S.digest = a => { a.vx = 0; a.hidden = 0; if (a.actT > a.actDur) { boaMind(a).task = null; return false; } };

S.wander = (a, dt) => {
  a.hidden = 0;
  if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.blocked = 0; }
  if (a.groundTo(a.mem.tx, a.eco.walk, dt)) a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]);
};
/** slide to boaMind.tx (the director's errands) */
S.goto = (a, dt) => {
  const m = boaMind(a);
  a.hidden = 0;
  if (a.groundTo(m.tx, a.eco.walk * (a.mem.fast ? 1.8 : 1.2), dt) || a.mem.blocked) { a.mem.blocked = 0; return next(a); }
};

/** never the generic chase: it is an ambusher. Strike if the grazer is in reach, else lie in wait */
S.hunt = a => {
  const m = boaMind(a), prey = a.prey;
  if (prey && !prey.held && !prey.dead && Math.abs(prey.x - boaBody(a).head()[0]) < 95) { m.aim = [prey.x, prey.y - 12]; m.aimKind = 'prey'; m.victim = prey; a.setAct('strike', 1.4); return; }
  a.setAct('ambush', 25);
};
S.eat = a => { a.setAct('digest', 30); };

S.ambush = a => {
  a.vx = 0;
  // still and flat among the fern: the grazers don't see it (but the camera does)
  a.hidden = 0.82;
  boaBody(a).aim = null;
};

/** the strike: draw back, the lunge, then the catch (prey), the bite (the Bearer) or the hit (Mori) */
S.strike = (a, dt) => {
  const s = host(a), m = boaMind(a), b = boaBody(a);
  a.hidden = 0;
  a.vx = 0;
  if (m.aimKind === 'prey' && m.victim && !m.victim.dead) m.aim = [m.victim.x + m.victim.facing * 10, m.victim.y - 14];
  if (m.aimKind === 'mori') m.aim = [s.player.x, s.player.y - 26];
  const aim = m.aim ?? [a.x + a.facing * 60, a.y - 10];
  a.face(aim[0]);
  const ph = a.mem.ph ?? 0;
  const [hx, hy] = b.pts[0];
  if (ph === 0) {
    // the tell: the head draws back and up, the ruff half-raised, a hiss
    b.aim = [a.x - a.facing * 14, a.y - R0 - 30];
    b.aimK = 6;
    if (!a.mem.hiss) { a.mem.hiss = 1; s.sfx('callHiss', a.x, 0.8, 0.55); }
    if (a.actT > (m.aimKind === 'prey' ? 0.25 : 0.45)) { a.mem.ph = 1; a.mem.t1 = a.actT; }
    return;
  }
  if (ph === 1) {
    // the lunge: the head shoots out at the aim
    b.aim = aim; b.aimK = 22;
    a.jaw = 1;
    const reached = Math.hypot(hx - aim[0], hy - aim[1]) < 14 || a.actT - a.mem.t1 > 0.32;
    if (!reached) return;
    a.mem.ph = 2; a.mem.t2 = a.actT;
    dustBurst(s, aim[0], s.st.terrain.groundY(aim[0]), a.facing, 2);
    if (m.aimKind === 'prey' && m.victim && !m.victim.dead && Math.abs(m.victim.x - hx) < 40) {
      // caught: the coils go round it
      grab(a, m.victim);
      return;
    }
    if (m.aimKind === 'mori') {
      const p = s.player;
      const gy = s.st.terrain.groundY(p.x);
      if (Math.hypot(p.x - hx, p.y - 26 - hy) < 34 && p.y > gy - 30 && !moriHidden(s)) hitMori(s, a.x, { sev: 2, drop: rand.chance(0.5), what: 'plumeboa' });
      m.cool = 4;
    }
    if (m.aimKind === 'foe' && m.foe && Math.abs(m.foe.x - hx) < 70) m.bites++;
    return;
  }
  // recover
  b.aim = null; b.aimK = 10;
  if (a.actT - a.mem.t2 > 0.5) {
    const st = predState(a);
    if (m.aimKind === 'mori') { st.target = null; st.phase = 'idle'; a.setAct('ruff', 1.6); }
    else return next(a);
  }
  void dt;
};

/** coils round a caught animal: it stops (held), lies limp; the boa squeezes */
export function grab(a: Animal, v: Animal) {
  const m = boaMind(a), s = host(a);
  m.victim = v;
  v.held = true;
  v.anim = 'sleep';
  v.eye = 'closed';
  v.vx = 0;
  v.act = 'held';
  a.setAct('constrict', 9);
  s.sfx('roar', a.x, 0.45, 0.6);
  s.sounds.push({ x: a.x, y: a.y, kind: 'fight', src: a, species: T, radius: 420, t: s.time + 0.0001 });
  featherBurst(s, v.x, v.y - 20, a.facing, 4);
}

S.constrict = (a, dt) => {
  const m = boaMind(a), v = m.victim, s = host(a);
  a.hidden = 0;
  a.vx = 0;
  boaBody(a).aim = null;
  if (!v || v.dead || v.gone) { m.victim = null; return next(a); }
  v.anim = 'sleep';
  // a squeeze on every breath out
  if (Math.floor(a.actT * 0.9) !== Math.floor((a.actT - dt) * 0.9)) s.sfx('callHiss', a.x, 0.25, 0.4);
  if (a.actT > a.actDur) {
    // something is coming for the kill: it keeps its coils round it
    if (m.task === 'guard') { a.actDur += 1.5; return; }
    // a carcass now: it stays where it fell
    m.carcass = v; m.victim = null;
    v.act = 'carcass';
    a.hunger = 0;
    if (m.task) return next(a);
    a.setAct('swallow', 7);
  }
};

/** walk the jaws over the carcass, head first; the meal goes down as a bulge */
S.swallow = a => {
  const m = boaMind(a), c = m.carcass, b = boaBody(a);
  a.vx = 0;
  a.hidden = 0;
  if (!c || c.dead || c.gone) { m.carcass = null; if (a.actT > 1) { a.setAct('digest', 40); } return; }
  const pb = preyBox(c);
  b.aim = [pb.cx + c.facing * pb.hl * (0.9 - Math.min(1, a.actT / 6) * 1.6), pb.cy];
  b.aimK = 3;
  c.alpha = Math.max(0, 1 - Math.max(0, a.actT - 1.5) / 4.5);
  if (a.actT > 6) { c.dead = true; m.carcass = null; b.aim = null; a.setAct('digest', 50); }
};

/** the threat display: neck up, ruff up, hissing, swaying at whatever it faces */
S.ruff = a => {
  const s = host(a), m = boaMind(a), st = predState(a);
  a.vx = 0;
  a.hidden = 0;
  boaBody(a).aim = null;
  if (st.target?.kind === 'player') a.face(s.player.x); else if (m.foe) a.face(m.foe.x);
  if (!a.mem.called) { a.mem.called = 1; s.sfx('callHiss', a.x, 0.9, 0.5); a.showEmote('anger', 1.2, true); }
  if (a.actT >= a.actDur) {
    if (st.target?.kind === 'player') { st.target = null; st.phase = 'idle'; }
    return next(a);
  }
};

/** the director's fight: reared, the ruff up, swaying; the director fires the strikes */
S.brawl = a => {
  const m = boaMind(a);
  a.vx = 0;
  a.hidden = 0;
  if (m.foe) a.face(m.foe.x);
  boaBody(a).aim = null;
};

/** drag the carcass off in its jaws to boaMind.tx */
S.drag = (a, dt) => {
  const m = boaMind(a), c = m.carcass, b = boaBody(a);
  a.hidden = 0;
  if (!c || c.dead || c.gone) return next(a);
  b.aim = null;
  const arrived = a.groundTo(m.tx, a.eco.walk * 0.8, dt);
  const [hx] = b.pts[0];
  c.x += (hx + a.facing * 10 - c.x) * Math.min(1, dt * 6);
  c.y = host(a).st.terrain.groundY(c.x);
  if (rand.next() < dt * 2) dustBurst(host(a), c.x, c.y, -a.facing, 1);
  if (arrived || a.mem.blocked) { a.mem.blocked = 0; return next(a); }
};
S.steal = S.drag;

/** beaten or stung: away fast, ruff flat, and gone into the fern */
S.retreat = (a, dt) => {
  const s = host(a), m = boaMind(a), st = predState(a);
  a.hidden = 0;
  boaBody(a).aim = null;
  // away from Mori if he is anywhere near (it won't cross him), else away from whatever beat it
  const p = s.player;
  const from = Math.abs(p.x - a.x) < 650 || !m.foe || m.foe.gone ? p.x : m.foe.x;
  const dir = -Math.sign(from - a.x) || -a.facing;
  if (!a.mem.go) { a.mem.go = 1; a.mem.tx = a.x + dir * 520; s.sfx('callHiss', a.x, 0.5, 0.7); emitPred('retreat', { a }); }
  a.groundTo(a.mem.tx, a.eco.run, dt);
  if (Math.abs(a.x - a.mem.tx) < 8 || a.actT > 8 || a.mem.blocked) {
    if (st.phase === 'retreat') { st.phase = 'idle'; st.target = null; }
    m.task = null; m.foe = null;
    a.setAct('ambush', 20);
  }
};

S.flinch = a => {
  const b = boaBody(a), s = host(a);
  a.vx = 0;
  if (!a.mem.f) {
    a.mem.f = 1;
    const [hx, hy] = b.head();
    featherBurst(s, hx - a.facing * 20, hy, -a.facing, 7);
    b.aim = [hx - a.facing * 26, hy - 6];
    b.aimK = 14;
    s.sfx('callHiss', a.x, 0.6, 0.8);
  }
  if (a.actT > 0.5) {
    b.aim = null;
    const st = predState(a);
    if (st.script) return;
    if (st.stun > 0.5) a.setAct('stunned', st.stun);
    else if (st.phase === 'retreat') a.setAct('retreat', 8);
    else return next(a);
  }
};

S.stunned = a => {
  const st = predState(a), b = boaBody(a);
  a.vx = 0;
  b.aim = [a.x + a.facing * 8, a.y - 6];
  b.aimK = 3;
  if (!a.mem.stars) { a.mem.stars = 1; a.showEmote('star', Math.max(1.2, st.stun), true); }
  if (st.stun <= 0 && a.actT > 0.8) { b.aim = null; return next(a); }
};

S.cine = a => { a.vx = 0; };

// ------------------------------------------------------------------ the predator definition
registerPredator({
  species: T, tier: 2, knockEnergy: 20, nerve: 6, stunTime: 1.2, restTime: 50,
  onHit(a, kind) {
    const st = predState(a);
    if (st.script || a.act === 'constrict') return;
    if (kind === 'noise' || kind === 'shout') { if (a.act !== 'strike') a.setAct('ruff', 1.8); return; }
    a.setAct('flinch', 0.6);
  },
  onBreak(a) {
    if (predState(a).script) return;
    const m = boaMind(a);
    if (m.victim) { m.victim.held = false; m.victim = null; }
    m.task = null;
    a.setAct('retreat', 8);
  },
  advice: [
    'Watch where you put your feet! It’s all snake!',
    'When the ruff goes up, BACK OFF!',
    'Get away from its head!',
    'It’s a show! Don’t fall for it, just back away!',
  ],
});

void clamp;
