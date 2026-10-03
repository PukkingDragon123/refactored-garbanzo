// V11 predators: Aroha fights back, and the party reacts.
//
// When a predator threatens anyone (stalking, charging, attacking within reach), Aroha takes over
// from her guide routine at once: she gets between it and whoever it's after (dashing in, or vaulting
// in with a flip), slings rapid volleys at its brow, flips back out of a charge, lobs improvised
// grenades (a horopito pepper bomb, a kawakawa smoke ball, firestone crackers) when it's close or
// won't quit, and shouts what to do. Once it's gone she calls the all-clear and goes back to
// guiding. Chunk hides behind Mori, Jenna and Joshu back off and yell; everyone flinches at a roar.
//
// Uses the V7 combat anims (COMBAT_ANIMS: slingReady, slingDraw, slingRelease, grenadeThrow, flipBack,
// dashStrike, roll, landCrouch, vault, dodge) when the cast has them, else sensible older ones.

import type { FieldScene } from '../scenes/field';
import type { Actor } from '../../world/actor';
import type { Animal } from '../wild/animal';
import { game } from '../game';
import { rand, clamp } from '../../core/math';
import { audio } from '../../core/audio';
import { ANIMS7 } from '../../art/v7/anims7';
import {
  anim7, isPredator, predState, targetPos, PREDATORS, onPredator, PredEvent, PredInfo,
} from './predators-core';
import { PredFx, GrenadeKind } from './predators-fx';
import { ballistic } from './predators-sling';
import { sfx11 } from './predators-sfx';

// the combat moves module (performMove: the clip with its root motion and its release / land moments).
// Loaded if the build has it; without it the volleys and throws run on fixed timings.
interface MovesMod { performMove(a: Actor, anim: string, o?: { then?: string; onRelease?: () => void; onLand?: () => void; minX?: number; maxX?: number; dir?: 1 | -1 }): Promise<void> }
let moves: MovesMod | null = null;
for (const load of Object.values(import.meta.glob<MovesMod>('./moves.ts'))) void load().then(m => { moves = m; }).catch(() => {});
/** a move clip played through performMove, when both exist */
const moveFor = (name: string) => (moves && ANIMS7[name] ? moves : null);

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type Act = 'idle' | 'aim' | 'shoot' | 'throw' | 'flip' | 'dash';

export class ArohaCombat {
  engaged = false;
  /** the ambush script drives her: hands off */
  script = false;
  private act: Act = 'idle';
  private actT = 0;
  private volley = 0;
  private cool = { shot: 0, gren: 0, flip: 0, call: 0, dash: 0 };
  private flip: { x0: number; x1: number; dur: number; h: number } | null = null;
  private heldGuide: unknown = null;
  private calmT = 0;
  private gi = 0;
  private volleys = 0;
  private aimAt: Animal | null = null;
  private offs: (() => void)[] = [];
  private lastTarget = '';
  /** a performMove clip is playing (its release moment fires the shot or the throw) */
  private moving = false;

  constructor(readonly s: FieldScene, readonly fx: PredFx) {
    this.offs.push(onPredator((ev, info) => this.onEvent(ev, info)));
  }

  get actor(): Actor | null {
    const a = this.s.actors.get('aroha');
    return a && a.visible && a.alpha > 0.5 ? a : null;
  }

  /** predators that are a danger to the group right now */
  threats(): Animal[] {
    const s = this.s, p = s.player;
    return s.animals.filter(a => {
      if (!isPredator(a)) return false;
      const st = predState(a);
      if (st.script) return false;
      const near = Math.abs(a.x - p.x) < 300;
      return near && (st.phase === 'stalk' || st.phase === 'charge' || st.phase === 'attack' || (!!st.target && st.phase !== 'retreat'));
    });
  }

  update(dt: number) {
    const a = this.actor;
    for (const k of Object.keys(this.cool) as (keyof ArohaCombat['cool'])[]) this.cool[k] = Math.max(0, this.cool[k] - dt);
    if (!a || this.script) return;
    const th = this.threats();
    if (!this.engaged && th.length && !this.s.cutscene) this.engage(a);
    if (!this.engaged) return;
    if (!th.length) {
      this.calmT += dt;
      if (this.calmT > 2.2 && this.act === 'idle' && !this.moving) this.disengage(a);
    } else this.calmT = 0;
    this.fight(a, th[0], dt);
  }

  private engage(a: Actor) {
    this.engaged = true;
    this.calmT = 0;
    this.volleys = 0;
    // her guide routine steps aside
    const g = this.s as unknown as { guide: unknown };
    if (g.guide) { this.heldGuide = g.guide; g.guide = null; }
    a.fidget = false;
    a.stopWalk();
    this.say('Kia tūpato! Everyone behind me!', 'determined', 'shout');
    this.cool.call = 3;
  }

  private disengage(a: Actor) {
    this.engaged = false;
    this.act = 'idle';
    this.flip = null;
    a.oy = 0;
    a.fidget = true;
    a.idleAnim = 'idle';
    a.setAnim('idle');
    const g = this.s as unknown as { guide: unknown };
    if (this.heldGuide && !g.guide) g.guide = this.heldGuide;
    this.heldGuide = null;
    this.say(rand.next() < 0.5 ? 'Ka pai. It’s gone. Everyone breathe.' : 'All clear. Don’t go near that mud again, eh?', 'happy');
  }

  /** a short line from Aroha, shouted or not */
  say(text: string, expr = 'serious', style: 'shout' | 'say' = 'say') {
    if (!this.actor) return;
    game.ui.bubbles.bark('aroha', text, { style, expr } as never);
  }

  private fight(a: Actor, t: Animal | undefined, dt: number) {
    const s = this.s;
    this.actT += dt;
    // a flip in progress
    if (this.flip) {
      const f = this.flip;
      const k = clamp(this.actT / f.dur);
      a.x = f.x0 + (f.x1 - f.x0) * ease(k);
      a.oy = -Math.sin(k * Math.PI) * f.h;
      if (k >= 1) {
        this.flip = null;
        a.oy = 0;
        a.play(anim7('landCrouch', 'crouch'), 'idle').catch(() => {});
        this.act = 'idle';
        this.actT = 0;
        s.st.shake(0.8, 0.1);
      }
      return;
    }
    // nothing to fight (it left): finish what she's doing and stand easy
    if (!t) {
      if (this.moving || (this.act === 'dash' && a.walking)) return;
      if (this.act !== 'idle') { this.act = 'idle'; this.actT = 0; this.setPose(a, anim7('slingReady', 'slingAim'), 0); }
      return;
    }
    const st = predState(t);
    const dx = t.x - a.x, dist = Math.abs(dx);
    const toward = Math.sign(dx) || 1;
    // a move clip is carrying her: let it finish
    if (this.moving) return;
    // dodge: the rush is coming straight at her
    const charging = t.act === 'charge' || t.act === 'pounce' || t.act === 'swipe';
    if (charging && this.cool.flip <= 0 && Math.sign(a.x - t.x) === t.facing && dist < 78) {
      this.startFlip(a, a.x - toward * 52);
      return;
    }
    if (this.act === 'dash') {
      if (!a.walking) { this.act = 'idle'; this.actT = 0; }
      return;
    }
    // where she wants to be: between it and whoever it's after
    const tg = st.target;
    const [gx0] = tg ? targetPos(s, tg) : [s.player.x];
    const protecting = !tg || !(tg.kind === 'actor' && tg.a === a);
    const want = protecting ? gx0 + Math.sign(t.x - gx0 || toward) * 30 : a.x - toward * Math.max(0, 95 - dist);
    if (this.act === 'idle' && Math.abs(want - a.x) > 26 && this.cool.dash <= 0) {
      const far = Math.abs(want - a.x) > 90;
      if (far && dist > 90) {
        // a vault over the group to get in front
        this.startFlip(a, want, 0.55, 34, anim7('vault', 'flipBack', 'jump'));
      } else {
        this.act = 'dash';
        this.actT = 0;
        a.walkTo(want, 210, anim7('dashStrike', 'run')).catch(() => {});
        audio.play('whoosh', { vol: 0.35, pitch: 1.3 });
        this.cool.dash = 0.6;
      }
      return;
    }
    a.faceTo(t.x);
    // grenades: when it's close and coming, or it won't quit
    const close = dist < 190 && (t.act === 'charge' || t.act === 'stalk' || t.act === 'roar');
    if (this.act === 'idle' && this.cool.gren <= 0 && (close || (this.volleys >= 2 && st.nerve > 2.5)) && dist > 40) {
      this.act = 'throw';
      this.actT = 0;
      this.aimAt = t;
      const mv = moveFor('grenadeThrow');
      if (mv) {
        // thrown on the clip's release moment
        this.moving = true;
        a.holdFrame = null;
        const kind = this.nextGrenade();
        this.cool.gren = 7;
        void mv.performMove(a, 'grenadeThrow', { then: anim7('slingReady', 'slingAim'), minX: s.minX + 10, maxX: s.maxX - 10, onRelease: () => { if (this.aimAt && !this.aimAt.dead) this.throwAt(a, this.aimAt, kind); this.aimAt = null; } })
          .finally(() => { this.moving = false; this.act = 'idle'; this.actT = 0; this.aimAt = null; });
        return;
      }
      a.play(anim7('grenadeThrow', 'point'), anim7('slingReady', 'slingAim')).catch(() => {});
      return;
    }
    if (this.act === 'throw') {
      if (this.actT > 0.24 && this.aimAt) {
        const kind = this.nextGrenade();
        this.throwAt(a, this.aimAt, kind);
        this.aimAt = null;
        this.cool.gren = 7;
        this.act = 'idle';
        this.actT = 0;
      }
      return;
    }
    // slingshot volleys at the brow
    if (this.act === 'idle' && this.cool.shot <= 0 && dist > 36 && dist < 340 && t.hidden < 0.8) {
      this.act = 'aim';
      this.actT = 0;
      this.volley = 3;
      this.setPose(a, anim7('slingDraw', 'slingAim'), anim7('slingDraw', 'slingAim') === 'slingAim' ? 1 : 99);
      return;
    }
    if (this.act === 'aim' && this.actT > 0.16) {
      const mv = moveFor('slingRelease');
      if (mv) {
        // the pebble leaves on the clip's release moment
        this.moving = true;
        this.volley--;
        this.act = 'shoot';
        this.actT = 0;
        a.holdFrame = null;
        void mv.performMove(a, 'slingRelease', { then: anim7('slingReady', 'slingAim'), minX: s.minX + 10, maxX: s.maxX - 10, onRelease: () => { if (!t.dead && !t.gone) this.shootAt(a, t); } })
          .finally(() => { this.moving = false; });
        return;
      }
      this.shootAt(a, t);
      this.volley--;
      this.act = 'shoot';
      this.actT = 0;
      this.setPose(a, anim7('slingRelease', 'slingshot'), anim7('slingRelease', 'slingshot') === 'slingshot' ? 2 : null);
      return;
    }
    if (this.act === 'shoot' && this.actT > 0.2) {
      if (this.volley > 0 && t.hidden < 0.8) { this.act = 'aim'; this.actT = 0; this.setPose(a, anim7('slingDraw', 'slingAim'), anim7('slingDraw', 'slingAim') === 'slingAim' ? 1 : 99); }
      else { this.act = 'idle'; this.actT = 0; this.cool.shot = 0.9 + rand.next() * 0.5; this.volleys++; this.setPose(a, anim7('slingReady', 'slingAim'), 0); }
      return;
    }
    // what to do: shouted at the others
    if (this.cool.call <= 0) {
      const d = PREDATORS[t.species];
      const lines = d?.advice ?? [];
      if (lines.length) this.say(lines[Math.floor(rand.next() * lines.length)], 'determined', 'shout');
      this.cool.call = 4.5 + rand.next() * 2;
    }
  }

  private setPose(a: Actor, anim: string, frame: number | null) {
    a.idleAnim = anim;
    a.setAnim(anim);
    const n = ANIMS7[anim]?.frames ?? 1;
    a.holdFrame = frame === null ? null : Math.min(n - 1, frame);
  }

  private startFlip(a: Actor, to: number, dur = 0.5, h = 22, anim = anim7('flipBack', 'jump')) {
    const s = this.s;
    const x1 = Math.max(s.minX + 10, Math.min(s.maxX - 10, to));
    a.stopWalk();
    this.flip = { x0: a.x, x1, dur, h };
    this.act = 'flip';
    this.actT = 0;
    a.holdFrame = null;
    a.play(anim, 'idle').catch(() => {});
    a.react('stretch');
    audio.play('whoosh', { vol: 0.5, pitch: 1.15 });
    this.cool.flip = 1.4;
  }

  /** a pebble at its brow (the ballistic solve, a touch of scatter) */
  shootAt(a: Actor, t: Animal, power = 1) {
    const [hx, hy] = t.body.head(t);
    const ox = a.x + a.facing * 7, oy = a.y + a.oy - 40;
    const lead = t.vx * 0.12;
    const tx = hx + lead + rand.range(-3, 3), ty = hy + 9 + rand.range(-3, 3);
    const v = 430;
    const sol = ballistic(tx - ox, ty - oy, v) ?? [Math.sign(tx - ox) * v * 0.7, -v * 0.7];
    this.fx.firePebble(ox, oy, sol[0], sol[1], 'aroha', power);
    sfx11('bandSnap', { x: a.x, pitch: 1.1 });
  }

  /** a grenade lobbed at its feet */
  throwAt(a: Actor, t: Animal, kind: GrenadeKind) {
    const ox = a.x + a.facing * 6, oy = a.y + a.oy - 46;
    const tx = t.x + t.vx * 0.5, ty = this.s.st.terrain.groundY(tx) - 4;
    // a high lob: pick the speed that lands it with a 55 degree throw
    const dx = tx - ox, dy = ty - oy;
    const th = 0.96, g = 380;
    const c = Math.cos(th), sn = Math.sin(th);
    const denom = 2 * c * c * (Math.abs(dx) * Math.tan(th) + dy);
    const v = denom > 0 ? Math.sqrt((g * dx * dx) / denom) : 260;
    this.fx.throwGrenade(ox, oy, Math.sign(dx) * v * c, -v * sn, kind, 'aroha');
    const names: Record<GrenadeKind, string> = { pepper: 'Pepper, coming up!', smoke: 'Smoke!', cracker: 'Cover your ears!', combo: 'Eat THIS!' };
    this.say(names[kind], 'determined', 'shout');
  }

  private nextGrenade(): GrenadeKind {
    const k: GrenadeKind[] = ['pepper', 'smoke', 'cracker'];
    return k[this.gi++ % k.length];
  }

  // ---------------------------------------------------------------- her commentary on what happens
  private onEvent(ev: PredEvent, info: PredInfo) {
    if (!this.actor || this.script) return;
    if (ev === 'knockdown' && info.who === 'mori') this.say('Mori! Get up, get UP! Behind me!', 'angry', 'shout');
    else if (ev === 'knockdown' && info.who === 'chunk') this.say('Not the dog, you overgrown pudding!', 'angry', 'shout');
    else if (ev === 'break' && this.engaged) this.say('That’s it! Go on! Haere atu!', 'determined', 'shout');
    else if (ev === 'submerge' && this.engaged) this.say('It’s gone under. Don’t go near that mud.', 'serious');
    else if (ev === 'plinked' && info.who === 'mori' && this.cool.call <= 0) { this.say('Oi! Not at the wildlife, Mori. Only the ones that want to eat you.', 'angry'); this.cool.call = 6; }
    else if (ev === 'hit' && info.head && this.engaged && info.x !== undefined && this.lastTarget !== 'cheer' && rand.next() < 0.35) { this.lastTarget = 'cheer'; this.say('Right on the brow! Ka pai!', 'happy', 'shout'); setTimeout(() => { this.lastTarget = ''; }, 6000); }
  }

  dispose() { for (const o of this.offs) o(); this.offs = []; }
}

// ------------------------------------------------------------------ the party
const LINES: Record<string, { notice: string[]; charge: string[] }> = {
  mori: { notice: ['Is that... is that a TIGER? Why is it shaped like a SOFA?', 'Okay. Okay okay okay. Big. Very big.'], charge: ['Nope nope nope nope!', 'It’s coming! IT’S COMING!'] },
  jenna: { notice: ['Mori. MORI. Mud-cat. Two o’clock.', 'I’m not screaming. This is my normal voice.'], charge: ['AAAAH!', 'Why is it FAST? It’s shaped like a fridge!'] },
  joshu: { notice: ['Steady... nobody make any sudden... that includes you, dog.', 'That thing’s got a forehead like a lighthouse.'], charge: ['Back! Get back!', 'Run! No, don’t run! Do the other thing!'] },
  chunk: { notice: ['Grrr... wuff?', '...whine.'], charge: ['YIP!', 'Awooo!'] },
};

/** everyone else's reactions: Chunk hides behind Mori, the others back off; lines when it shows up and charges */
export class PartyReact {
  private said = new Set<string>();
  private cool = 0;
  private hidT = 0;
  private offs: (() => void)[] = [];
  private buddyHeld: { mode: string } | null = null;
  constructor(readonly s: FieldScene) {
    this.offs.push(onPredator((ev, info) => this.onEvent(ev, info)));
  }
  private onEvent(ev: PredEvent, info: PredInfo) {
    if (this.s.cutscene) return;
    if (ev === 'notice' || ev === 'ambush' || ev === 'charge') {
      const kind = ev === 'charge' ? 'charge' : 'notice';
      const who = ['mori', 'jenna', 'joshu', 'chunk'].filter(id => id === 'mori' || this.s.actors.get(id)?.visible);
      const pick = who[Math.floor(rand.next() * who.length)];
      if (this.cool <= 0 && pick) {
        const l = LINES[pick][kind];
        const key = pick + kind;
        if (!this.said.has(key) || rand.next() < 0.3) {
          this.said.add(key);
          game.ui.bubbles.bark(pick === 'mori' ? this.s.player.id : pick, l[Math.floor(rand.next() * l.length)], { style: kind === 'charge' ? 'shout' : 'say', expr: 'scared' } as never);
          this.cool = 3.5;
        }
      }
      if (ev === 'charge' || ev === 'ambush') this.s.player.body.setExpr('scared', 3);
    }
    void info;
  }
  update(dt: number) {
    this.cool -= dt;
    const s = this.s, p = s.player;
    const th = s.animals.filter(a => isPredator(a) && !predState(a).script && (predState(a).phase === 'stalk' || predState(a).phase === 'charge') && Math.abs(a.x - p.x) < 260);
    const buddy = (s as unknown as { buddy?: { mode: string; release(): void } }).buddy;
    if (th.length) {
      const t = th[0];
      const away = -Math.sign(t.x - p.x) || -1;
      this.hidT = 3;
      // Chunk: behind Mori, head down
      const chunk = s.actors.get('chunk');
      if (chunk?.visible) {
        if (buddy && buddy.mode !== 'script') { this.buddyHeld = { mode: buddy.mode }; buddy.mode = 'script'; }
        const hide = p.x + away * 18;
        if (Math.abs(chunk.x - hide) > 6 && !chunk.walking) chunk.walkTo(hide, 140, 'run').catch(() => {});
        else if (!chunk.walking && chunk.anim !== 'hide') { chunk.idleAnim = 'hide'; chunk.setAnim('hide'); chunk.faceTo(t.x); }
      }
      for (const id of ['jenna', 'joshu']) {
        const act = s.actors.get(id);
        if (!act?.visible || act.walking) continue;
        const d = Math.abs(act.x - t.x);
        if (d < 150 && t.act === 'charge') {
          act.walkTo(act.x + away * 50, 120, 'run').then(() => { act.faceTo(t.x); act.setAnim('scared'); }).catch(() => {});
        }
      }
    } else if (this.hidT > 0) {
      this.hidT -= dt;
      if (this.hidT <= 0) {
        const chunk = s.actors.get('chunk');
        if (chunk) { chunk.idleAnim = 'idle'; if (chunk.anim === 'hide') chunk.play('shake', 'idle').catch(() => {}); }
        for (const id of ['jenna', 'joshu']) { const act = s.actors.get(id); if (act && act.anim === 'scared') act.setAnim(act.idleAnim); }
        if (buddy && this.buddyHeld) { buddy.release(); this.buddyHeld = null; }
      }
    }
  }
  dispose() { for (const o of this.offs) o(); this.offs = []; }
}

void sfx11;
