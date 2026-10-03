// V11 predators: the per-scene controller. attachPredators(scene) (FieldScene.enter calls it for
// every field scene; tigerAmbush makes sure of it) adds one drawable to the gameplay layer that runs
// everything predator-related there: projectiles and effects (predators-fx), Mori's slingshot
// (predators-sling), Aroha's combat AI and the party's reactions (predators-aroha), the "Stand tall
// and shout!" action when something is coming for you, the hit-stop on a good hit, fruit to knock
// down in the forest, and the tigers' frames being painted ahead of time.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { FieldScene } from '../scenes/field';
import type { Interactable } from '../../world/npc';
import { game } from '../game';
import { local, A } from '../assets';
import { itemIcon } from '../../art/itemicons';
import { add } from '../inventory';
import { ITEMS } from '../items';
import { audio } from '../../core/audio';
import { rand, clamp } from '../../core/math';
import { isPredator, predState, deterArea, emitPred, addShootTarget, anim7, onPredator } from './predators-core';
import { energy } from '../v10/energy';
import { PredFx } from './predators-fx';
import { PlayerSling } from './predators-sling';
import { ArohaCombat, PartyReact } from './predators-aroha';
import { TigerBody, warmTigerStep, wallowsOf, spawnTiger } from './predators-tiger';
import { sfx11 } from './predators-sfx';
import { TIGER_ID } from './species-tiger';

const ctls = new WeakMap<FieldScene, PredatorScene>();

// console / test helpers: zlPred.give(), zlPred.tiger(dx), zlPred.ambush(dx), zlPred.state()
const evLog: string[] = [];
onPredator((ev, info) => { evLog.push(ev + (info.who ? ':' + info.who : '')); if (evLog.length > 40) evLog.shift(); });
const here = () => { const s = game.scene as unknown as FieldScene; return s && s.animals && s.player ? s : null; };
(window as unknown as { zlPred?: unknown }).zlPred = {
  give: (n = 15) => { add('slingshot', 1); game.save.vars['v11:pebbles'] = n; game.persist(); here()?.hud?.refresh(); },
  tiger: (dx = 320, lurk = true) => { const s = here(); if (!s) return null; attachPredators(s); return spawnTiger(s, s.player.x + s.player.facing * dx, { lurk, facing: (s.player.facing >= 0 ? -1 : 1) }); },
  ambush: async (dx = 230) => {
    const s = here(); if (!s) return;
    const m = await import('./predators-ambush');
    await m.tigerAmbush({ scene: s, x: s.player.x + s.player.facing * dx, dir: s.player.facing >= 0 ? 1 : -1 });
  },
  ctl: () => { const s = here(); return s ? predatorsOf(s) : null; },
  state: () => {
    const s = here(); if (!s) return null;
    return {
      x: Math.round(s.player.x), cut: s.cutscene, slowmo: game.slowmo, energy: Math.round(energy()), ev: evLog.slice(-8),
      tigers: s.animals.filter(a => isPredator(a)).map(a => { const q = predState(a); return { x: Math.round(a.x), act: a.act, anim: a.anim, phase: q.phase, nerve: +q.nerve.toFixed(2), stun: +q.stun.toFixed(2), hidden: a.hidden, aw: +a.aw.toFixed(2) }; }),
      actors: [...s.actors.values()].map(a => ({ id: a.id, x: Math.round(a.x), vis: a.visible, anim: a.anim })),
    };
  },
};

/** the controller of a scene, if attached */
export const predatorsOf = (s: FieldScene) => ctls.get(s) ?? null;

/** hook a field scene up to the predator systems (idempotent) */
export function attachPredators(s: FieldScene): PredatorScene | null {
  if (!s || !s.main || !s.player || !s.st) return null;
  let c = ctls.get(s);
  if (c && !c.disposed) return c;
  c = new PredatorScene(s);
  ctls.set(s, c);
  const ex = s.exit.bind(s);
  const cc = c;
  s.exit = () => { cc.dispose(); ex(); };
  return c;
}

export class PredatorScene implements Drawable {
  z = 97;
  disposed = false;
  readonly fx: PredFx;
  readonly sling: PlayerSling;
  readonly aroha: ArohaCombat;
  readonly party: PartyReact;
  private shout: Interactable;
  private shoutOn = false;
  private shoutCool = 0;
  private warmDone = false;
  private hitstopUntil = 0;

  constructor(readonly s: FieldScene) {
    this.fx = s.main.add(new PredFx(s));
    this.sling = new PlayerSling(s, this.fx);
    this.aroha = new ArohaCombat(s, this.fx);
    this.party = new PartyReact(s);
    this.fx.onPebbleHit = (a, head, owner) => {
      this.hitstop(head ? 0.085 : 0.055);
      s.st.shake(head ? 1.6 : 1, 0.12);
      if (owner === 'mori' && head && !game.save.flags['v11:firstBrow']) {
        game.save.flags['v11:firstBrow'] = true;
        game.ui.toast('Right on the brow! A clean hit stings much more.', 'SLING', 'teal', 2600);
      }
      void a;
    };
    // "Stand tall and shout!": E / the USE button whenever something is coming for you
    const p = s.player;
    this.shout = {
      x: p.x, y: p.y, w: 40, h: 40, label: 'Stand tall and shout!',
      enabled: () => this.shoutOn,
      action: () => this.doShout(),
    };
    s.interact.push(this.shout);
    s.main.add(this);
    this.placeFruit();
  }

  update(dt: number) {
    if (this.disposed) return;
    const s = this.s;
    // tigers spawned by a site's spawn list get their own body
    let tiger = false;
    for (const a of s.animals) {
      if (a.species !== TIGER_ID) continue;
      tiger = true;
      if (!(a.body instanceof TigerBody)) { a.body = new TigerBody(a); a.z = 45; }
    }
    if ((tiger || wallowsOf(s).length) && !this.warmDone) this.warmDone = warmTigerStep();
    this.sling.update(dt);
    this.aroha.update(dt);
    this.party.update(dt);
    // the shout prompt follows Mori while something is after him
    const p = s.player;
    this.shoutCool = Math.max(0, this.shoutCool - dt);
    this.shout.x = p.x; this.shout.y = p.y;
    this.shoutOn = this.shoutCool <= 0 && !s.cutscene && !this.sling.ready && s.animals.some(a => isPredator(a) && !predState(a).script && (predState(a).phase === 'stalk' || predState(a).phase === 'charge') && Math.abs(a.x - p.x) < 230);
  }

  draw(r: Renderer) {
    if (this.disposed) return;
    this.sling.render(r);
  }

  /** freeze the world for a moment on a good hit (not over a slow-motion shot) */
  hitstop(secs: number) {
    if (game.slowmo !== 1 && performance.now() > this.hitstopUntil) return;
    const now = performance.now();
    this.hitstopUntil = Math.max(this.hitstopUntil, now + secs * 1000);
    game.slowmo = 0.06;
    setTimeout(() => { if (performance.now() >= this.hitstopUntil - 2 && game.slowmo === 0.06) game.slowmo = 1; }, secs * 1000 + 4);
  }

  private doShout() {
    const s = this.s, p = s.player;
    this.shoutCool = 3.2;
    p.vx = 0;
    p.facing = (() => {
      const t = s.animals.find(a => isPredator(a) && !predState(a).script);
      return t ? (Math.sign(t.x - p.x) || p.facing) as 1 | -1 : p.facing;
    })();
    p.poseOverride = anim7('angry', 'cheer');
    p.body.react('stretch');
    setTimeout(() => { if (p.poseOverride === 'angry' || p.poseOverride === 'cheer') p.poseOverride = null; }, 900);
    const lines = ['HEY! BACK OFF!', 'GO ON! GET OUT OF IT!', 'NOT TODAY, SOFA-CAT!', 'I AM VERY BIG AND VERY LOUD!'];
    game.ui.bubbles.bark(p.id, lines[Math.floor(rand.next() * lines.length)], { style: 'shout', expr: 'angry' } as never);
    sfx11('chuff', { x: p.x, pitch: 1.6, vol: 0.6 });
    audio.play('emoteAngry' as never, { vol: 0.5 });
    deterArea(s, p.x + p.facing * 60, p.y - 20, 240, 'shout', 1);
    emitPred('shout', { who: 'mori' });
  }

  // ---------------------------------------------------------------- fruit up in the trees (knock it down)
  private placeFruit() {
    const s = this.s;
    const id = s.site?.id ?? '';
    if (!['fernwood', 'forest', 'glowforest', 'canopy'].includes(id)) return;
    const branches = s.pois.filter(p => p.kind === 'branch' && (p.p ?? 1) === 1);
    let n = 0;
    for (const b of branches) {
      if (n >= 3) break;
      if (rand.next() < 0.35) continue;
      const key = `v11:fruit:${id}:${Math.round(b.x)}`;
      if ((game.save.vars[key] ?? -1) === game.save.day) continue;
      s.main.add(new HangingFruit(s, b.x + rand.range(-6, 6), b.y + 4, key));
      n++;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sling.dispose();
    this.aroha.dispose();
    this.party.dispose();
    const i = this.s.interact.indexOf(this.shout);
    if (i >= 0) this.s.interact.splice(i, 1);
    if (game.slowmo === 0.06) game.slowmo = 1;
  }
}

// ------------------------------------------------------------------ a moonfruit cluster hanging from a branch
let fruitOwner: unknown = null;
let fruitFr: Frame | null = null;
class HangingFruit implements Drawable {
  z = 8;
  dead = false;
  private t = rand.next() * 10;
  private fall = -1;
  private vy = 0;
  private y0: number;
  private off: () => void;
  constructor(readonly s: FieldScene, public x: number, public y: number, readonly key: string) {
    this.y0 = y;
    this.off = addShootTarget({ x, y: y + 4, r: 9, hit: () => this.knock(), alive: () => !this.dead && this.fall < 0 });
  }
  private frame(): Frame {
    if (fruitOwner !== local || !fruitFr) { fruitOwner = local; fruitFr = local.add('v11:fruit', itemIcon('moonfruit'), 12, 4); }
    return fruitFr;
  }
  private knock() {
    if (this.fall >= 0) return;
    this.fall = 0;
    this.vy = -30;
    audio.play('rustleBush' as never, { vol: 0.4 });
    for (let i = 0; i < 6; i++) this.s.main.particles.spawn({ frame: A.leaves[i % A.leaves.length], x: this.x + rand.range(-6, 6), y: this.y0, vx: rand.range(-30, 30), vy: rand.range(-30, 10), ay: 60, life: 2, flutter: 1, alpha: 1, alpha1: 0, floorY: this.s.st.terrain.groundY(this.x) });
    game.save.vars[this.key] = game.save.day;
  }
  update(dt: number) {
    this.t += dt;
    if (this.fall < 0) return;
    this.fall += dt;
    this.vy += 420 * dt;
    this.y += this.vy * dt;
    const gy = this.s.st.terrain.groundY(this.x);
    if (this.y >= gy) {
      this.y = gy;
      this.dead = true;
      this.off();
      sfx11('thud', { x: this.x, vol: 0.3, pitch: 2 });
      // it can be picked up where it landed
      const s = this.s;
      const it: Interactable = {
        x: this.x, y: gy, w: 10, h: 10, label: 'Pick up the moonfruit', standX: this.x - 10,
        action: () => {
          const got = add('moonfruit', 2);
          if (!got) { audio.play('wrong', { vol: 0.5 }); return; }
          const i = s.interact.indexOf(it);
          if (i >= 0) s.interact.splice(i, 1);
          drop.dead = true;
          audio.play('collectPop' as never, { vol: 0.5 });
          game.ui.toast(`+${got} ${ITEMS.moonfruit?.name ?? 'Moonfruit'}`, 'FORAGE', 'teal', 1800);
          s.hud?.refresh();
        },
      };
      const fr = this.frame();
      const drop = s.main.add({ z: 21, dead: false, draw: (r: Renderer) => r.draw(fr, it.x, it.y - 6, 0.6, 0.6) } as Drawable & { dead: boolean });
      s.interact.push(it);
    }
  }
  draw(r: Renderer) {
    if (this.dead) return;
    const sway = this.fall < 0 ? Math.sin(this.t * 1.4) * 0.12 : this.fall * 6;
    if (this.fall < 0) r.draw(A.dot, this.x, this.y - 3, 1, 7, 0, packColor(0.3, 0.42, 0.2, 1));
    r.draw(this.frame(), this.x, this.y, 0.6, 0.6, sway);
    void clamp;
  }
}
