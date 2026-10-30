// V12 harder wilds: the deeper Mori goes, the less the island wants him there. Every attack has a tell
// you can read and an answer in your kit:
//
//   charge   quillhogs, bonefaces and the torhopper rams. The TELL: it stops dead, lowers its head,
//            paws and snorts (dust kicked back, a snort in the air, an angry mark). Then it COMMITS to
//            a straight-line charge it can't steer. Jump it, get out of the line, get into cover or
//            under the hide cloak (it loses you), or plink it with the sling during the tell (it's
//            stunned, then it bolts). After the charge it skids and stands blowing for a moment.
//   swoop    gale hawks over their ground. The TELL: it hangs in the wind above you and screams.
//            Then a stoop onto where you stood, and away. Move, or be hidden.
//   stings   paper-wasp nests under the branches. The TELL: the nest shivers and the buzz rises.
//            Then the swarm: run, or vanish into cover; they give up on what they can't see.
//
// A hit costs something real (no stamina here): knocked flat and stunned, something shaken out of the
// pack onto the ground, and hungrier for it; enough stings make Mori dizzy.
//
// Fair early, hostile deep: home shore and the near forest are tier 0 (nothing new), the Fernwood,
// the canopy, the falls, the coast and the mangroves tier 1 (provoked only, long tells), the high
// country and beyond tier 2 (territorial, quicker tells, wider ground). Up there without the sling or
// the hide cloak it's worse, and Aroha says so.

import type { FieldScene } from '../scenes/field';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { game } from '../game';
import { local } from '../assets';
import { audio } from '../../core/audio';
import { rand, clamp } from '../../core/math';
import { floatText } from '../../ui/v12/float';
import { SPECIALS } from '../wild/animal';
import type { Animal } from '../wild/animal';
import { addShootTarget, dropSomething, onPredator } from '../v11/predators-core';
import { sfx11 } from '../v11/predators-sfx';
import { addHunger } from './hunger';
import { addAilment } from '../v10/energy';
import { perks } from '../skills';
import { paintWaspNest, paintWasp } from '../../art/v12/thunderbird';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { TBArt } from '../../art/v12/thunderbird';

// ---------------------------------------------------------------- how dangerous is this place
const TIER: Record<string, number> = {
  fernwood: 1, canopy: 1, falls: 1, mangrove: 1, coast: 1, grotto: 1,
  hills: 2, ruins: 2, fossils: 2, glowforest: 2, geovalley: 2, unknown: 2,
};
export const tierOf = (loc: string | null) => (loc ? TIER[loc] ?? 0 : 0);
const hasSling = () => game.save.tools.includes('slingshot');
const hasCloak = () => game.save.tools.includes('hide_cloak');

/** Mori can't be seen: in a hide, under the hide cloak (crouched, still), or crouched in a bush */
export function moriHidden(f: FieldScene): boolean {
  const p = f.player;
  if (p.state === 'hide') return true;
  if (!p.crouch) return false;
  if (hasCloak() && Math.abs(p.vx) < 12) return true;
  return f.pois.some(q => q.kind === 'cover' && Math.abs(q.x - p.x) < ((q as { w?: number }).w ?? 18) + 6) && Math.abs(p.vx) < 8;
}

// the hide cloak: crouched under it, Mori is much harder to see (the player's visibility reads perks)
{
  const P = perks as unknown as { visibility: () => number };
  const base = P.visibility;
  P.visibility = () => {
    const p = (game.scene as unknown as { player?: { crouch?: boolean } } | null)?.player;
    return base() * (hasCloak() && p?.crouch ? 0.4 : 1);
  };
}

// ---------------------------------------------------------------- a hit
const OW = ['OOF!', 'Ow ow ow...', 'Nope. Nope nope nope.', 'I am NOT a threat! I am NOT!'];
/** something reached Mori: knocked back (and down, for a big one), stunned, a thing dropped, hungrier */
export function hitMori(f: FieldScene, from: number, o: { sev: 1 | 2 | 3; drop?: boolean; what?: string }) {
  const p = f.player;
  if (p.state === 'stunned' || p.hurtT > 0.4) return;
  const dir = Math.sign(p.x - from) || 1;
  p.cancelWork();
  f.cam?.raise(false);
  p.hurtT = 1.2 + o.sev * 0.2;
  p.vx = dir * (110 + o.sev * 45);
  p.vy = -(80 + o.sev * 30);
  p.onGround = false;
  p.body.react('jump');
  p.body.setExpr('scared', 2.5);
  p.body.showEmote('star', 1.4 + o.sev * 0.2);
  game.r.post.flash = Math.max(game.r.post.flash, 0.2 + o.sev * 0.08);
  f.st.shake(2 + o.sev * 1.5, 0.35);
  sfx11('thud', { x: p.x, vol: 0.5 + o.sev * 0.15 });
  if (o.sev >= 2) {
    p.state = 'stunned';
    p.poseOverride = 'fallBack';
    setTimeout(() => { if (p.poseOverride === 'fallBack') p.poseOverride = 'sitShock'; }, 480);
    setTimeout(() => { if (p.poseOverride === 'sitShock' || p.poseOverride === 'fallBack') p.poseOverride = null; if (p.state === 'stunned') p.state = 'normal'; }, 900 + o.sev * 350);
  }
  addHunger(0.025 + o.sev * 0.025, 'predator');
  const lost = o.drop ? dropSomething(f, p.x + dir * 14, p.y) : null;
  const line = OW[Math.floor(rand.next() * OW.length)];
  void floatText({ text: lost ? `${line} ...I dropped ${lost}!` : line, style: 'scared', ms: 2400 });
}

// ---------------------------------------------------------------- the charge (quillhog, boneface, torhopper)
const CHARGERS: Record<string, { speed: number; tell: string; run: string; snort: string; sev: 1 | 2 | 3; call: string }> = {
  quillhog: { speed: 190, tell: 'threat', run: 'run', snort: 'HRRMPH!', sev: 2, call: 'callGrunt' },
  boneface: { speed: 175, tell: 'alert', run: 'charge', snort: 'HRAWNK!', sev: 3, call: 'callHonk' },
  torhopper: { speed: 230, tell: 'alert', run: 'run', snort: 'BRRT! BRRT!', sev: 2, call: 'callBark' },
};
type Mem = Record<string, number>;
const sceneOf = (a: Animal) => a.host as unknown as FieldScene;

function chargeAct(a: Animal, dt: number): boolean | void {
  const c = CHARGERS[a.species], f = sceneOf(a), p = f.player, m = a.mem as Mem;
  const tier = (m.tier ??= tierOf(curLoc));
  if (m.ph === undefined) {
    // the tell: stop dead, face him, paw and snort
    m.ph = 0; m.t = 0; m.dir = Math.sign(p.x - a.x) || a.facing;
    a.vx = 0;
    a.face(p.x);
    a.showEmote('anger', 1.3, true);
    f.sfx(c.call, a.x, 0.7, 0.8);
    void floatText({ text: c.snort, x: a.x, y: a.y - 40, style: 'shout', ms: 900 });
  }
  m.t += dt;
  // stunned by a pebble: dizzy for a moment, then it bolts
  if ((m.stun ?? 0) > 0) {
    m.stun -= dt;
    a.vx = 0;
    a.anim = 'idle';
    if (m.stun <= 0) { a.fear = 0.9; a.anger = 0; a.threat = { kind: 'point', x: p.x, y: p.y }; return false; }
    return;
  }
  const gy = f.st.terrain.groundY(a.x);
  if (m.ph === 0) {
    const T = tier >= 2 ? 0.85 : 1.15;
    a.vx = 0;
    a.anim = c.tell;
    a.face(p.x);
    m.dir = Math.sign(p.x - a.x) || m.dir;
    // the paw: dust kicked out behind it, a shiver
    if (Math.floor(m.t * 7) !== Math.floor((m.t - dt) * 7)) {
      a.x += (Math.floor(m.t * 7) % 2 ? 1 : -1);
      dust(f, a.x - m.dir * 10, gy, -m.dir);
    }
    if (moriHidden(f)) { lostHim(a); return false; }
    if (m.t > T) { m.ph = 1; m.t = 0; m.x0 = a.x; audio.play('roar', { vol: 0.25, pitch: 2.2 }); }
    return;
  }
  if (m.ph === 1) {
    // the charge: committed to a straight line
    a.facing = m.dir as 1 | -1;
    a.anim = c.run;
    a.x += m.dir * c.speed * dt;
    a.y = gy;
    if (Math.floor(m.t * 9) !== Math.floor((m.t - dt) * 9)) dust(f, a.x - m.dir * 8, gy, -m.dir);
    const pg = f.st.terrain.groundY(p.x);
    const jumped = p.y < pg - 18;
    if (Math.abs(a.x - p.x) < 16 && Math.abs(a.y - p.y) < 30 && !jumped && !moriHidden(f) && (m.hit ?? 0) === 0) {
      m.hit = 1;
      hitMori(f, a.x - m.dir * 20, { sev: tier === 0 ? 1 : c.sev, drop: tier >= 2 || (tier === 1 && rand.chance(0.5)) });
      aroha(f, c.sev >= 3 ? 'Off the track! Get BEHIND something!' : 'Jump it, or get out of its line!');
    }
    if (Math.abs(a.x - m.x0) > 280 || m.t > 1.7 || (moriHidden(f) && Math.abs(a.x - p.x) > 30)) { m.ph = 2; m.t = 0; }
    return;
  }
  // the skid and the blow: it stands there, sides heaving
  a.anim = 'idle';
  a.x += m.dir * Math.max(0, 120 - m.t * 300) * dt;
  if (m.t > 1) { a.anger = 0.2; a.habit = 0; return false; }
}
function lostHim(a: Animal) {
  a.anger = 0;
  a.aw = 0.2;
  a.noticed = false;
  a.threat = null;
  a.showEmote('question', 1.4, true);
  (a.mem as Mem).cool = 1;
}
function dust(f: FieldScene, x: number, y: number, dir: number) {
  const fr = dot();
  for (let i = 0; i < 3; i++) f.main.particles.spawn({ frame: fr, x: x + rand.range(-3, 3), y: y - 2, vx: dir * rand.range(20, 60), vy: rand.range(-40, -10), ay: 120, life: 0.6, alpha: 0.8, alpha1: 0, floorY: y, color: [0.62, 0.52, 0.4] } as never);
}
let dotF: Frame | null = null;
let dotOwner: unknown = null;
/** a 2 px clod of dust */
function dot(): Frame {
  if (dotOwner !== local || !dotF) {
    dotOwner = local;
    const b = new PixelBuffer(2, 2);
    b.set(0, 0, hex('#e8dcc8')); b.set(1, 0, hex('#b8a890')); b.set(0, 1, hex('#b8a890'));
    dotF = local.add('v12:dust', b, 1, 1);
  }
  return dotF;
}

// ---------------------------------------------------------------- the swoop (gale hawks)
function swoopAct(a: Animal, dt: number): boolean | void {
  const f = sceneOf(a), p = f.player, m = a.mem as Mem;
  const tier = (m.tier ??= tierOf(curLoc));
  if (m.ph === undefined) { m.ph = 0; m.t = 0; f.sfx('callScreech', a.x, 0.8, 1.1); }
  m.t += dt;
  const pg = f.st.terrain.groundY(p.x);
  if (m.ph === 0) {
    // the tell: it hangs in the wind over him and screams
    a.anim = 'fly';
    a.flyTo(p.x, pg - 120, a.eco.run * 0.8, dt, 400);
    a.face(p.x);
    if (m.t > 0.2 && !m.said) { m.said = 1; void floatText({ text: 'KEEE-EEE!', x: a.x, y: a.y - 20, style: 'shout', ms: 900 }); a.showEmote('anger', 1, true); }
    if (moriHidden(f)) { lostHim(a); a.setAct('soar', 8); return; }
    if (m.t > (tier >= 2 ? 1.0 : 1.4) && Math.abs(a.x - p.x) < 140) { m.ph = 1; m.t = 0; m.tx = p.x; m.ty = pg - 28; m.x0 = a.x; m.y0 = a.y; audio.play('whoosh', { vol: 0.5, pitch: 1.4 }); }
    if (m.t > 4) return false;
    return;
  }
  if (m.ph === 1) {
    // the stoop onto where he stood
    a.anim = 'dive';
    const k = Math.min(1, m.t / 0.45), e = k * k;
    a.x = m.x0 + (m.tx - m.x0) * e;
    a.y = m.y0 + (m.ty - m.y0) * e;
    a.face(m.tx + (m.tx - m.x0));
    if (k >= 1) {
      if (Math.abs(p.x - m.tx) < 24 && !moriHidden(f) && p.y > pg - 40) {
        hitMori(f, m.x0, { sev: 1, drop: rand.chance(tier >= 2 ? 0.6 : 0.3) });
        aroha(f, 'Hawk! Keep your head down near their ground!');
      }
      m.ph = 2; m.t = 0;
    }
    return;
  }
  // pull up and away
  a.anim = 'fly';
  a.flyTo(m.tx + Math.sign(m.tx - m.x0 || 1) * 260, m.ty - 200, a.eco.run, dt, 400);
  if (m.t > 1.3) { a.anger = 0; return false; }
}

for (const sp of Object.keys(CHARGERS)) SPECIALS[sp] = { ...(SPECIALS[sp] ?? {}), attack: chargeAct };
SPECIALS.galehawk = { ...(SPECIALS.galehawk ?? {}), attack: swoopAct };

// a pebble during the tell or the charge stuns a charger
onPredator((ev, info) => {
  const a = info.a;
  if (ev !== 'plinked' || !a || a.act !== 'attack' || !CHARGERS[a.species]) return;
  const m = a.mem as Mem;
  if ((m.ph ?? 0) <= 1) { m.stun = 1.4; a.showEmote('star', 1.4, true); void floatText({ text: 'stunned!', x: a.x, y: a.y - 36, style: 'notice', ms: 1200 }); }
});

// ---------------------------------------------------------------- the paper-wasp nests
interface Wasp { x: number; y: number; vx: number; vy: number; ph: number }
const NESTS: Record<string, number[]> = { fernwood: [0.62], canopy: [0.35, 0.8], falls: [0.3], ruins: [0.4, 0.75], glowforest: [0.5], mangrove: [0.55] };
const wframes = new Map<string, Frame>();
let wOwner: unknown = null;
function wFrame(key: string, make: () => TBArt): Frame {
  if (wOwner !== local) { wOwner = local; wframes.clear(); }
  let fr = wframes.get(key);
  if (!fr) { const a = make(); fr = local.add('v12:w:' + key, a.buf, a.ax, a.ay); wframes.set(key, fr); }
  return fr;
}
class WaspNest implements Drawable {
  z = 22;
  state: 'idle' | 'alert' | 'swarm' | 'calm' = 'idle';
  private t = 0;
  private st = 0;
  private wasps: Wasp[] = [];
  private stings = 0;
  private stingT = 0;
  private shake = 0;
  private off: () => void;
  private buzzT = 0;
  constructor(readonly f: FieldScene, public x: number, public y: number, readonly tier: number) {
    for (let i = 0; i < 4; i++) this.wasps.push({ x, y: y + 30, vx: 0, vy: 0, ph: rand.range(0, 6) });
    this.off = addShootTarget({ x, y: y + 20, r: 12, hit: () => this.provoke(true), alive: () => this.state !== 'swarm' });
  }
  private provoke(hard = false) {
    if (this.state === 'swarm' || this.state === 'alert') return;
    this.state = 'alert'; this.st = hard ? 0.7 : 0;
    sfx11('fizz', { x: this.x, vol: 0.5, pitch: 1.8 });
    void floatText({ text: 'bzzZZZ...', x: this.x, y: this.y + 4, style: 'whisper', ms: 1200 });
  }
  update(dt: number) {
    const f = this.f, p = f.player;
    this.t += dt; this.st += dt;
    this.shake = Math.max(0, this.shake - dt);
    const d = Math.hypot(p.x - this.x, (p.y - 30 - (this.y + 20)) * 0.7);
    const H = moriHidden(f);
    if (this.state === 'idle' || this.state === 'calm') {
      if (this.state === 'calm' && this.st > 20) this.state = 'idle';
      if (this.state === 'idle' && d < (this.tier >= 2 ? 90 : 70) && !H && (p.noise > 0.2 || d < 40)) this.provoke();
    } else if (this.state === 'alert') {
      this.shake = 0.1;
      if (this.st > 1.1) {
        this.state = 'swarm'; this.st = 0; this.stings = 0;
        while (this.wasps.length < 9 + this.tier * 3) this.wasps.push({ x: this.x + rand.range(-3, 3), y: this.y + 34, vx: rand.range(-30, 30), vy: rand.range(10, 40), ph: rand.range(0, 6) });
        aroha(f, 'Wasps! Run, or get into cover. They give up on what they can’t see!');
      }
    } else if (this.state === 'swarm') {
      // they give up when they can't see him, when he's far enough, or after a while
      if (H || d > 340 || this.st > 9) { this.state = 'calm'; this.st = 0; if (H) void floatText({ text: '...they’ve lost me. Don’t. Move.', style: 'whisper', ms: 2000 }); }
      this.stingT -= dt;
      const near = this.wasps.some(w => Math.abs(w.x - p.x) < 9 && Math.abs(w.y - (p.y - 34)) < 22);
      if (near && this.stingT <= 0) {
        this.stingT = 0.9;
        this.stings++;
        sfx11('sting', { x: p.x, vol: 0.6 });
        p.body.react('shake');
        p.body.showEmote('sweat', 1);
        addHunger(0.02, 'sting');
        void floatText({ text: this.stings > 2 ? 'OW! OW! GET OFF!' : 'OW!', style: 'scared', ms: 900 });
        if (this.stings === 3) { addAilment('dizzy', 12, 0.45, 'wasps'); const lost = dropSomething(f, p.x, p.y); if (lost) void floatText({ text: `I dropped ${lost}!`, style: 'scared', ms: 1800 }); }
      }
    }
    // the wasps
    const swarm = this.state === 'swarm';
    for (const w of this.wasps) {
      w.ph += dt * 9;
      const tx = swarm ? p.x + Math.sin(w.ph * 0.7) * 10 : this.x + Math.sin(w.ph * 0.33) * 14;
      const ty = swarm ? p.y - 34 + Math.cos(w.ph * 0.9) * 12 : this.y + 34 + Math.cos(w.ph * 0.41) * 8;
      const k = swarm ? 7 : 3;
      w.vx += (tx - w.x) * k * dt - w.vx * 2.2 * dt + rand.range(-60, 60) * dt;
      w.vy += (ty - w.y) * k * dt - w.vy * 2.2 * dt + rand.range(-60, 60) * dt;
      w.x += w.vx * dt; w.y += w.vy * dt;
    }
    if (!swarm && this.wasps.length > 4) this.wasps.length = Math.max(4, this.wasps.length - (Math.random() < dt * 2 ? 1 : 0));
    this.buzzT -= dt;
    if (this.buzzT <= 0 && (swarm || d < 160)) { this.buzzT = swarm ? 0.6 : 2.2; sfx11('fizz', { x: swarm ? p.x : this.x, vol: swarm ? 0.35 : 0.12, pitch: 2.4 }); }
  }
  draw(r: Renderer) {
    const nest = wFrame('nest', paintWaspNest);
    const sx = this.shake > 0 ? (Math.floor(this.t * 30) % 2 ? 1 : -1) : 0;
    r.draw(nest, Math.round(this.x + sx), Math.round(this.y));
    const wf = [0, 1].map(i => wFrame('wasp' + i, () => { const b = paintWasp()[i]; return { buf: b, ax: 3, ay: 2 }; }));
    for (const w of this.wasps) r.draw(wf[Math.floor(w.ph) % 2], Math.round(w.x), Math.round(w.y), w.vx < 0 ? -1 : 1, 1);
  }
  dispose() { this.off(); }
}

// ---------------------------------------------------------------- the per-scene controller
let curLoc: string | null = null;
/** per animal: not again before this scene time */
const COOL = new WeakMap<Animal, number>();
let lastAroha = 0;
function aroha(f: FieldScene, text: string) {
  const a = f.actors.get('aroha');
  const now = performance.now();
  if (!a || !a.visible || now - lastAroha < 5000) return;
  lastAroha = now;
  void floatText({ actor: a, text, style: 'shout', ms: 2400 });
}

class Wilds implements Drawable {
  z = 0;
  private t = 0;
  private nests: WaspNest[] = [];
  private warned = false;
  constructor(readonly f: FieldScene, readonly loc: string, readonly tier: number) {
    // the nests hang under real branches where there are some
    const fr = NESTS[loc] ?? [];
    const W = f.site.width;
    for (const k of fr) {
      const want = W * k;
      const br = f.pois.filter(q => q.kind === 'branch').sort((a, b) => Math.abs(a.x - want) - Math.abs(b.x - want))[0];
      if (!br || Math.abs(br.x - want) > 400) continue;
      const n = new WaspNest(f, br.x, br.y, tier);
      this.nests.push(n);
      f.main.add(n);
    }
  }
  update(dt: number) {
    const f = this.f, p = f.player;
    this.t += dt;
    if (f.cutscene || game.ui.blocking) return;
    curLoc = this.loc;
    // the Thunderbird's ridge during the hunt: everything else keeps its head down
    const tb = game.save.flags;
    if (this.loc === 'hills' && p.x > 2400 && tb['tb:storm'] && !tb['tb:driven'] && !tb['tb:tagged']) return;
    if (!this.warned && this.tier >= 2 && this.t > 4 && !hasSling() && !hasCloak()) {
      this.warned = true;
      aroha(f, 'Up here with no sling and no cloak? We’re the slowest thing on the hill. Careful.');
    }
    if (Math.floor(this.t * 2) === Math.floor((this.t - dt) * 2)) return;
    // twice a second: who takes offence
    const bare = !hasSling() && !hasCloak();
    const H = moriHidden(f);
    for (const a of f.animals) {
      if (a.dead || a.gone || a.hidden > 0.5 || a.act === 'attack' || a.juvenile) continue;
      const m = a.mem as Mem;
      if ((COOL.get(a) ?? 0) > this.t) continue;
      const d = Math.abs(a.x - p.x);
      if (CHARGERS[a.species]) {
        // tier 1: only when he's right on top of it and it has seen him; tier 2: its whole patch
        const R = this.tier >= 2 ? 150 : 85;
        if (H || d > R || !a.noticed || a.fear > 0.4 || a.act === 'eat' || a.act === 'lure-go') continue;
        a.anger = Math.min(1, a.anger + (this.tier >= 2 ? 0.35 : 0.2) * (bare ? 1.6 : 1));
        if (a.anger > 0.6) { a.mem = {}; a.setAct('attack', 6); COOL.set(a, this.t + (this.tier >= 2 ? 9 : 14)); }
      } else if (a.species === 'galehawk' && a.medium === 'air') {
        const nearNest = f.pois.some(q => (q.kind === 'nest' || q.kind === 'perch') && Math.abs(q.x - p.x) < 220);
        const chance = this.tier >= 2 ? 0.1 : nearNest ? 0.06 : 0;
        if (H || d > 260 || rand.next() > chance * (bare ? 1.5 : 1)) continue;
        a.mem = {}; a.setAct('attack', 6); COOL.set(a, this.t + 14);
      }
    }
  }
  draw() {}
  dispose() { for (const n of this.nests) n.dispose(); }
}

/** the harder wilds in a field scene (called for every scene as it opens) */
export function attachWilds(f: FieldScene, loc: string | null) {
  curLoc = loc;
  const tier = tierOf(loc);
  if (!loc || tier === 0 || !f.main || !f.player) return;
  // the Thunderbird's ridge: during the hunt the other animals keep their heads down
  const w = new Wilds(f, loc, tier);
  f.main.add(w);
  const ex = f.exit.bind(f);
  f.exit = () => { w.dispose(); ex(); };
}
void clamp; void packColor;
