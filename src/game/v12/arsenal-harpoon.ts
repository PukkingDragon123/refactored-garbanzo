// V12 the rubber speargun under water (the weapon belt's 'harpoon', src/game/v12/arsenal.ts): the only
// weapon Mori has in the water, and hidden out of it. The belt (arsenal-belt.ts) hands it the controls
// whenever he is under water:
//
//   G          up: the speargun comes out in front of him at arm's length, level, both hands on it;
//              G again (or a click) fires at what's marked. A push on the stick for a moment lowers it.
//   marked     the nearest spearable fish ahead of him (DIVE_CTX.spearables, cream corner brackets and a
//              dotted sight line), or, when a shark (DIVE_CTX.chargers) is winding up at him or right on
//              him, the shark (red brackets): that shot is the blunt bang-head
//   a fish     a short ring QTE (src/game/v12/qte.ts) round the moving fish times the lead. Timed: the
//              shaft flies on its line to where the fish will be, takes it (Spearable.take(): a clean
//              catch, no gore), the catch goes in DIVE_CTX.catches and DIVE_CTX.onCatch hears the
//              struggle; the reel ratchets it back in on the line. Missed: the shaft goes where the fish
//              was, the fish nearby scatter (Spearable.spook) and the shaft is reeled back in.
//              Shafts: six a dive (the tank's startAir loads them); a shaft goes into the bag with each
//              catch, a missed one comes back on the line.
//   a shark    no QTE, a reflex: the shaft goes out short with the blunt bang-head on, a deep boom on the
//              snout, Charger.repel(): it veers off and loses interest for a while. It costs no shaft;
//              the bands take a moment to re-cock.
//
// Nothing here kills. The speargun in his hands is src/art/v12/arms7.ts ('armSwimHarpoon'), the item
// art src/art/v12/weapons.ts, the sounds arsenal-sfx.ts, the shock ring and the sand puff arsenal-fx.ts.
// Events for the story and feats: onHarpoon(fn) ('fired' | 'catch' | 'miss' | 'bang' | 'empty').

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { FieldScene } from '../scenes/field';
import { game } from '../game';
import { A, local } from '../assets';
import { clamp, rand } from '../../core/math';
import { itemIcon } from '../../art/itemicons';
import { ITEMS } from '../items';
import { floatText, floatNotice, floatPickup } from '../../ui/v12/float';
import { qte, qteRunning } from './qte';
import { isPredator, deter, emitPred } from '../v11/predators-core';
import type { Animal } from '../wild/animal';
import { sfxArm } from './arsenal-sfx';
import { harpoonFrames } from './arsenal-fx';
import { ammo, setAmmo, ammoMax, ownsWeapon } from './arsenal';
import { DIVE_CTX } from './dive/ctx';
import type { Spearable, Charger } from './dive/ctx';

/** shaft speed (px/s), its line's reach, the bang-head's reach */
const SPEED = 560, REACH = 300, BANG_REACH = 120;
/** a fish to spear is looked for this far ahead; a shark counts as "on him" this close */
const LOOK = 300, CLOSE = 84;

export type HarpoonEvent = 'fired' | 'catch' | 'miss' | 'bang' | 'empty';
export interface HarpoonInfo { species?: string; item?: string | null; x?: number; y?: number; charger?: Charger }
type HFn = (ev: HarpoonEvent, info: HarpoonInfo) => void;
const fns: HFn[] = [];
/** listen to the speargun (returns an unsubscribe) */
export function onHarpoon(fn: HFn): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }
const emit = (ev: HarpoonEvent, info: HarpoonInfo = {}) => { for (const f of fns.slice()) { try { f(ev, info); } catch (e) { console.error(e); } } };

/** a fish's own painter for the reel, if its brain gives one (duck-typed; else the catch's item art) */
type OnLine = { drawOnLine?(r: Renderer, x: number, y: number, dir: 1 | -1, t: number): void };
interface Shaft {
  x: number; y: number; vx: number; vy: number;
  /** where it left the gun */
  ox: number; oy: number;
  phase: 'out' | 'reel';
  t: number;
  blunt: boolean;
  reach: number;
  /** what's on it coming back */
  item: string | null; species: string | null; fish: (Spearable & OnLine) | null;
  /** the fish it was fired at (a miss spooks it) */
  aim: Spearable | null;
  /** a shark it was fired at (bang-head) */
  shark: Charger | null;
  reelT: number;
  hit: boolean;
}
type Target = { kind: 'fish'; f: Spearable } | { kind: 'shark'; c: Charger };

export class HarpoonGun {
  ready = false;
  /** the QTE is up (the scene is in its little cutscene: keep the gun up through it) */
  busy = false;
  target: Target | null = null;
  shaft: Shaft | null = null;
  private cool = 0;
  private turnT = 0;
  private idleT = 0;
  private flash = 0;
  private bangs: { x: number; y: number; t: number }[] = [];
  private lastMouse = -9;
  private t = 0;

  constructor(readonly s: FieldScene, readonly o: { hitstop?: (secs: number) => void } = {}) {}

  get owned() { return ownsWeapon('harpoon'); }
  /** can he use it right now (under water, free to act) */
  get available(): boolean {
    const s = this.s, p = s.player;
    if (!p || !p.underwater || !this.owned) return false;
    if (this.busy) return true;
    return !s.cutscene && !game.ui.blocking && !s.cam?.active && p.state !== 'stunned';
  }

  // ---------------------------------------------------------------- input
  update(dt: number) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const b of this.bangs) b.t += dt;
    this.bangs = this.bangs.filter(b => b.t < 0.6);
    this.updateShaft(dt);
    const s = this.s, p = s.player, inp = game.input;
    if (!this.available) { if (this.ready) this.lower(); return; }
    if (this.busy) return;
    if (inp.moved) this.lastMouse = performance.now();
    if (inp.keyHit('KeyG')) { if (!this.ready) this.raise(); else this.fire(); }
    if (!this.ready) return;
    if (inp.click(0) && inp.lastDevice === 'mouse') { inp.consumeClick(0); this.fire(); }
    // held up: he holds station in the water; a push turns him, a longer push puts it away
    const ax = inp.axisX(), ay = (inp.down('down') ? 1 : 0) - (inp.down('up') ? 1 : 0);
    if (ax !== 0 || ay !== 0) {
      this.turnT += dt;
      if (ax !== 0 && ax !== p.facing && this.turnT < 0.3) p.facing = ax as 1 | -1;
      if (this.turnT > 0.34 && !this.shaft) { this.lower(); return; }
    } else this.turnT = 0;
    this.idleT += dt;
    if (this.idleT > 12 && !this.shaft) { this.lower(); return; }
    p.poseOverride = this.shaft && !this.shaft.blunt ? 'armSwimHarpoonE' : 'armSwimHarpoon';
    p.poseFrame = null;
    this.target = this.pick();
  }
  /** touch: the weapon button (raise, then fire) */
  tap() {
    if (!this.available || this.busy) return;
    if (!this.ready) this.raise(); else this.fire();
  }

  raise() {
    if (this.ready || !this.available) return;
    const p = this.s.player;
    this.ready = true;
    this.idleT = 0;
    p.frozen = true;
    p.poseOverride = 'armSwimHarpoon';
    p.poseFrame = null;
    sfxArm('cock', { x: p.x, vol: 0.6 });
    const k = 'v12:armHint:harpoon', n = game.save.vars[k] ?? 0;
    if (n < 2) {
      game.save.vars[k] = n + 1;
      floatNotice('G fires at the marked fish: hit the ring to lead it. A shark on you gets the bang-head.', 4200, { tag: 'Speargun', accent: '#7fe0d0' });
    }
  }
  lower() {
    const p = this.s.player;
    this.ready = false;
    this.target = null;
    if (p) {
      p.frozen = false;
      if (p.poseOverride && /^armSwimHarpoon/.test(p.poseOverride)) { p.poseOverride = null; p.poseFrame = null; }
    }
  }

  /** where the shaft leaves the gun (the muzzle on this frame, else ahead of his hands) */
  muzzle(): [number, number] {
    const p = this.s.player;
    const m = p.body.point('muzzle');
    if (m) return m;
    return [p.x + p.facing * 30, p.y - 22];
  }

  /** what's marked: a shark that's on him, else the nearest fish ahead (or the one by the pointer) */
  private pick(): Target | null {
    const p = this.s.player, [mx, my] = this.muzzle();
    let shark: Charger | null = null, sd = 1e9;
    for (const c of DIVE_CTX.chargers) {
      const dx = c.x - mx, dy = c.y - my, d = Math.hypot(dx, dy);
      const ahead = Math.sign(dx) === p.facing || Math.abs(dx) < 30;
      if (((c.threatening && d < 220 && ahead) || d < CLOSE) && d < sd) { sd = d; shark = c; }
    }
    if (shark) return { kind: 'shark', c: shark };
    const mouse = performance.now() - this.lastMouse < 2500 && game.input.lastDevice === 'mouse';
    let best: Spearable | null = null, bd = 1e9;
    if (mouse) {
      const [wx, wy] = this.s.worldMouse() as [number, number];
      for (const f of DIVE_CTX.spearables) {
        if (!f.alive || Math.sign(f.x - mx) !== p.facing) continue;
        const d = Math.hypot(f.x - wx, f.y - wy);
        if (d < 70 && d < bd && Math.hypot(f.x - mx, f.y - my) < LOOK) { bd = d; best = f; }
      }
    }
    if (!best) for (const f of DIVE_CTX.spearables) {
      if (!f.alive) continue;
      const dx = f.x - mx, dy = f.y - my;
      if (Math.sign(dx) !== p.facing || Math.abs(dy) > Math.abs(dx) * 1.1 + 24) continue;
      const d = Math.hypot(dx, dy);
      if (d < LOOK && d < bd) { bd = d; best = f; }
    }
    return best ? { kind: 'fish', f: best } : null;
  }

  // ---------------------------------------------------------------- firing
  private fire() {
    const s = this.s, p = s.player;
    if (this.shaft || this.cool > 0 || qteRunning()) { sfxArm('click', { x: p.x, vol: 0.5 }); return; }
    this.idleT = 0;
    const tg = this.pick();
    if (tg?.kind === 'shark') { this.bang(tg.c); return; }
    if (ammo('harpoon') <= 0) {
      sfxArm('click', { x: p.x });
      this.cool = 0.6;
      emit('empty');
      void floatText({ text: 'Out of shafts. The rest are in the catch bag. Back to the boat.', style: 'sad', ms: 2600 });
      return;
    }
    if (tg?.kind === 'fish') void this.leadShot(tg.f);
    else this.launch(this.aimAhead(), null);
  }
  /** straight ahead, level (nothing marked) */
  private aimAhead(): [number, number] { const [mx, my] = this.muzzle(); return [mx + this.s.player.facing * 200, my]; }

  /** a fish: the ring times the lead on it */
  private async leadShot(fish: Spearable) {
    const s = this.s;
    const [mx, my] = this.muzzle();
    const dist = Math.hypot(fish.x - mx, fish.y - my);
    const spd = Math.hypot(fish.vx, fish.vy);
    this.busy = true;
    let res = { ok: false, score: 0, perfect: false };
    try {
      res = await qte({
        kind: 'ring', f: s, label: 'LEAD IT!',
        difficulty: clamp(0.2 + spd / 160 + dist / 900, 0.15, 0.9),
        get x() { return fish.x; },
        get y() { return fish.y; },
      });
    } finally { this.busy = false; }
    if (game.scene !== (s as never) || !this.ready) return;
    this.shootFish(fish, res);
  }
  /** the shot itself: timed, to where the fish will be when the shaft gets there; not, to where it is now */
  shootFish(fish: Spearable, res: { ok: boolean; score: number }) {
    const [ox, oy] = this.muzzle();
    let tx = fish.x, ty = fish.y;
    if (res.ok && fish.alive) {
      for (let i = 0; i < 3; i++) { const t = Math.hypot(tx - ox, ty - oy) / SPEED; tx = fish.x + fish.vx * t; ty = fish.y + fish.vy * t; }
      // a less than perfect lead lands off the middle (still on it, mostly)
      const err = (1 - res.score) * fish.r * 0.9 * (rand.chance(0.5) ? 1 : -1);
      ty += err;
    } else {
      // no lead: behind it, and a wobble on the release
      tx = fish.x - fish.vx * 0.18; ty = fish.y + rand.range(-8, 8);
    }
    this.launch([tx, ty], fish);
  }

  private launch(to: [number, number], aim: Spearable | null) {
    const s = this.s, p = s.player;
    const [ox, oy] = this.muzzle();
    let dx = to[0] - ox, dy = to[1] - oy;
    // never back through himself, and not straight up or down
    if (Math.sign(dx) !== p.facing) dx = p.facing * Math.max(8, Math.abs(dx));
    if (Math.abs(dy) > Math.abs(dx) * 1.2) dy = Math.sign(dy) * Math.abs(dx) * 1.2;
    const L = Math.hypot(dx, dy) || 1;
    this.shaft = { x: ox, y: oy, vx: (dx / L) * SPEED, vy: (dy / L) * SPEED, ox, oy, phase: 'out', t: 0, blunt: false, reach: REACH, item: null, species: null, fish: null, aim, shark: null, reelT: 0, hit: false };
    setAmmo('harpoon', ammo('harpoon') - 1);
    this.cool = 0.4;
    sfxArm('harpoonShot', { x: ox });
    p.vx -= p.facing * 16;
    s.st.shake(0.7, 0.1);
    this.muzzleBurst(ox, oy, p.facing);
    emit('fired', { x: ox, y: oy });
  }

  /** the bang-head: short and blunt, on the shark's snout */
  private bang(c: Charger) {
    const s = this.s, p = s.player;
    const [ox, oy] = this.muzzle();
    let dx = c.x - ox, dy = c.y - oy;
    if (Math.sign(dx) !== p.facing) dx = p.facing * Math.max(10, Math.abs(dx));
    const L = Math.hypot(dx, dy) || 1;
    this.shaft = { x: ox, y: oy, vx: (dx / L) * 760, vy: (dy / L) * 760, ox, oy, phase: 'out', t: 0, blunt: true, reach: BANG_REACH, item: null, species: null, fish: null, aim: null, shark: c, reelT: 0, hit: false };
    this.cool = 1.3;
    sfxArm('harpoonShot', { x: ox, pitch: 0.8 });
    p.vx -= p.facing * 22;
    this.muzzleBurst(ox, oy, p.facing);
  }

  private muzzleBurst(x: number, y: number, dir: number) {
    const s = this.s;
    for (let i = 0; i < 8; i++) s.main.particles.spawn({ frame: A.dot, x, y, vx: dir * rand.range(10, 70), vy: rand.range(-30, 10), drag: 2, ay: -30, life: rand.range(0.5, 1.1), size: 0.6, color: [0.85, 0.97, 1], alpha: 0.9, alpha1: 0 });
  }

  // ---------------------------------------------------------------- the shaft on its line
  private updateShaft(dt: number) {
    const sh = this.shaft;
    if (!sh || !(dt > 0)) return;
    const s = this.s, p = s.player;
    sh.t += dt;
    if (sh.phase === 'out') {
      for (let i = 0; i < 3 && sh.phase === 'out'; i++) {
        const h = dt / 3;
        sh.x += sh.vx * h; sh.y += sh.vy * h;
        // (the water drags it a little)
        sh.vx *= 1 - h * 0.4; sh.vy *= 1 - h * 0.4;
        if (sh.blunt) {
          const c = sh.shark;
          if (c && Math.hypot(c.x - sh.x, c.y - sh.y) < 26) { this.bangHit(c, sh); break; }
        } else {
          for (const f of DIVE_CTX.spearables) {
            if (!f.alive || Math.hypot(f.x - sh.x, f.y - sh.y) > f.r + 2) continue;
            this.spearHit(f, sh);
            break;
          }
        }
        if (sh.phase !== 'out') break;
        const gone = Math.hypot(sh.x - sh.ox, sh.y - sh.oy);
        const far = gone >= sh.reach;
        // (the sand or a boulder stops it, once it's clear of the gun: lying on the floor he can still shoot)
        const floor = DIVE_CTX.floorAt(sh.x);
        const ground = floor > 0 && gone > 14 && sh.y >= floor + 1;
        if (far || ground || sh.t > 1.6) {
          if (ground) { sh.y = floor; this.thunk(sh.x, sh.y); }
          this.missed(sh);
        }
      }
      return;
    }
    // reeling in: the ratchet clicks, the line comes tight, the catch kicks on the end of it
    sh.reelT -= dt;
    if (sh.reelT <= 0) { sh.reelT = 0.22; sfxArm('reel', { x: p.x, vol: 0.7 }); }
    const [mx, my] = this.muzzle();
    const dx = mx - sh.x, dy = my - sh.y, d = Math.hypot(dx, dy);
    const v = (sh.item ? 170 : 260) * dt;
    if (d <= v + 4) { this.home(sh); return; }
    sh.x += (dx / d) * v + (sh.item ? Math.sin(sh.t * 30) * 0.6 : 0);
    sh.y += (dy / d) * v;
  }

  private spearHit(f: Spearable & OnLine, sh: Shaft) {
    const s = this.s;
    const species = f.species, x = f.x, y = f.y;
    const item = f.take();
    sh.phase = 'reel';
    sh.reelT = 0.15;
    if (!item) {
      // it slipped off the flopper
      sh.hit = false;
      void floatText({ text: 'Slipped off! Argh.', style: 'sad', ms: 1600 });
      this.spookAround(x, y, 120);
      return;
    }
    sh.hit = true;
    sh.item = item; sh.species = species; sh.fish = typeof f.drawOnLine === 'function' ? f : null;
    DIVE_CTX.catches.push(item);
    for (const fn of DIVE_CTX.onCatch.slice()) { try { fn(species, x, y); } catch (e) { console.error(e); } }
    sfxArm('spearHit', { x });
    this.o.hitstop?.(0.06);
    s.st.shake(0.6, 0.1);
    for (let i = 0; i < 10; i++) s.main.particles.spawn({ frame: A.dot, x, y, vx: rand.range(-50, 50), vy: rand.range(-50, 20), drag: 2.4, ay: -40, life: rand.range(0.5, 1.2), size: 0.7, color: [0.85, 0.97, 1], alpha: 0.9, alpha1: 0 });
    // the rest of the school bolts
    this.spookAround(x, y, 90);
    emit('catch', { species, item, x, y });
  }
  private bangHit(c: Charger, sh: Shaft) {
    const s = this.s, p = s.player;
    sh.phase = 'reel';
    sh.hit = true;
    sh.reelT = 0.2;
    c.repel(p.x, p.y);
    // (a shark that is also one of the island's predators loses its nerve the usual way)
    const a = c as unknown as Animal;
    if (s.animals.includes(a) && isPredator(a)) deter(s, a, 'pebble', 1.6, { x: sh.x, head: true });
    emitPred('fired', { who: 'mori', x: p.x });
    sfxArm('bangHead', { x: sh.x });
    this.o.hitstop?.(0.09);
    s.st.shake(1.6, 0.18);
    this.flash = 0.12;
    this.bangs.push({ x: sh.x, y: sh.y, t: 0 });
    for (let i = 0; i < 18; i++) s.main.particles.spawn({ frame: A.dot, x: sh.x, y: sh.y, vx: rand.range(-90, 90), vy: rand.range(-90, 40), drag: 2.6, ay: -50, life: rand.range(0.6, 1.4), size: rand.range(0.5, 1), color: [0.85, 0.97, 1], alpha: 0.95, alpha1: 0 });
    const k = 'v12:bangSaid', n = game.save.vars[k] ?? 0;
    if (n < 3 || rand.chance(0.3)) { game.save.vars[k] = n + 1; void floatText({ text: rand.pick(['Not today!', 'BONK. Shoo!', 'Back off, big fella!', 'Nope! Nope nope nope.']), style: 'shout', ms: 1500 }); }
    emit('bang', { charger: c, x: sh.x, y: sh.y, species: c.species });
  }
  private missed(sh: Shaft) {
    sh.phase = 'reel';
    sh.reelT = 0.1;
    if (sh.blunt) return;
    // the fish it went for, and the fish round where it ended up, scatter
    if (sh.aim?.alive) sh.aim.spook(sh.x, sh.y);
    this.spookAround(sh.x, sh.y, 140);
    emit('miss', { x: sh.x, y: sh.y, species: sh.aim?.species });
  }
  private spookAround(x: number, y: number, r: number) {
    for (const f of DIVE_CTX.spearables) if (f.alive && Math.hypot(f.x - x, f.y - y) < r) f.spook(x, y);
  }
  private thunk(x: number, y: number) {
    sfxArm('spearHit', { x, vol: 0.5, pitch: 0.7 });
    const fr = harpoonFrames();
    for (let i = 0; i < 7; i++) this.s.main.particles.spawn({ frame: fr.silt[i % fr.silt.length], x: x + rand.range(-3, 3), y, vx: rand.range(-26, 26), vy: rand.range(-30, -6), drag: 1.8, life: rand.range(0.8, 1.6), size: 1, color: [1, 1, 1], alpha: 0.85, alpha1: 0 });
  }
  /** the shaft is home: the catch into the bag, a missed shaft back in the gun */
  private home(sh: Shaft) {
    const s = this.s, p = s.player;
    this.shaft = null;
    if (!sh.blunt) sfxArm('cock', { x: p.x, vol: 0.5 });
    if (sh.item) {
      const name = ITEMS[sh.item]?.name ?? sh.item;
      const k = 'v12:spearSaid', n = game.save.vars[k] ?? 0;
      game.save.vars[k] = n + 1;
      const line = n < 2 || rand.chance(0.35) ? rand.pick([`Got one! ${name}. Dinner!`, `${name}, into the bag.`, 'Clean shot. Thank you, fish.', 'Dinner on a string!']) : null;
      if (line) void floatText({ text: line, style: 'happy', ms: 2000 });
      try {
        const [cx, cy] = s.css(p.x, p.y - 26);
        floatPickup(`+1 ${name}`, cx, cy, { key: 'item:' + sh.item, buf: itemIcon(sh.item) });
      } catch { /* */ }
    } else if (!sh.blunt) {
      // the shaft back in the gun
      setAmmo('harpoon', Math.min(ammoMax('harpoon'), ammo('harpoon') + 1));
    }
    game.persist();
  }

  // ---------------------------------------------------------------- drawing: the marks, the line, the shaft
  render(r: Renderer) {
    const s = this.s, p = s.player;
    if (!p?.underwater) return;
    const sh = this.shaft;
    if (sh) this.drawShaft(r, sh);
    for (const b of this.bangs) this.drawBang(r, b);
    if (!this.ready || this.busy) return;
    const tg = this.target;
    if (!tg) return;
    const [mx, my] = this.muzzle();
    const isShark = tg.kind === 'shark';
    const tx = isShark ? tg.c.x : tg.f.x, ty = isShark ? tg.c.y : tg.f.y;
    const R = isShark ? 22 : tg.f.r + 4;
    const col = isShark ? packColor(1, 0.36, 0.24, 1) : packColor(1, 0.95, 0.78, 1);
    // the sight line: a dot every few px, marching out
    if (!sh) {
      const L = Math.hypot(tx - mx, ty - my), n = Math.floor(L / 4);
      for (let i = 1; i < n - 1; i++) {
        if ((i + Math.floor(this.t * 10)) % 3) continue;
        const u = i / n;
        r.rect(Math.round(mx + (tx - mx) * u), Math.round(my + (ty - my) * u), 1, 1, packColor(1, 0.97, 0.85, 0.55 * (1 - u * 0.5)));
      }
    }
    // corner brackets round the mark, breathing in and out a pixel
    const g = Math.round(R + (Math.sin(this.t * 6) > 0 ? 1 : 0));
    const x0 = Math.round(tx - g), y0 = Math.round(ty - g * 0.75), x1 = Math.round(tx + g), y1 = Math.round(ty + g * 0.75);
    const ink = packColor(0.08, 0.05, 0.03, 0.7);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
      r.rect(cx + sx, cy + sy, 3 * sx, 1, ink); r.rect(cx + sx, cy + sy, 1, 3 * sy, ink);
      r.rect(cx, cy, 3 * sx, 1, col); r.rect(cx, cy, 1, 3 * sy, col);
    }
    if (isShark && Math.floor(this.t * 4) % 2 === 0) {
      // a red pixel '!' over it: this one gets the bang-head
      r.rect(Math.round(tx), y0 - 7, 1, 3, col); r.rect(Math.round(tx), y0 - 3, 1, 1, col);
    }
  }
  private drawShaft(r: Renderer, sh: Shaft) {
    const [mx, my] = this.muzzle();
    const dx = sh.phase === 'out' ? sh.vx : mx - sh.x, dy = sh.phase === 'out' ? sh.vy : my - sh.y;
    const L = Math.hypot(dx, dy) || 1;
    // the shaft points the way it flew (reeling, it points back out along the line)
    const ux = (sh.phase === 'out' ? dx : -dx) / L, uy = (sh.phase === 'out' ? dy : -dy) / L;
    const len = sh.blunt ? 14 : 22;
    const tx = sh.x, ty = sh.y, bx = tx - ux * len, by = ty - uy * len;
    // the line: a pale monofilament from the muzzle to the shaft's tail, a slack belly in it going out
    const lx = bx - mx, ly = by - my, ll = Math.hypot(lx, ly);
    const sag = sh.phase === 'out' ? Math.min(10, ll * 0.06) : 1.2;
    const lineC = packColor(0.86, 0.92, 0.86, 0.7);
    let px0 = 1e9, py0 = 1e9;
    for (let i = 0; i <= Math.ceil(ll); i++) {
      const u = i / Math.max(1, Math.ceil(ll));
      const x = Math.round(mx + lx * u), y = Math.round(my + ly * u + Math.sin(Math.PI * u) * sag);
      if (x === px0 && y === py0) continue;
      px0 = x; py0 = y;
      r.rect(x, y, 1, 1, lineC);
    }
    // the shaft: steel, lit along its top; the notch at the tail; the flint point (or the blunt knob)
    const steel = packColor(0.7, 0.76, 0.79, 1), steelD = packColor(0.36, 0.41, 0.45, 1), lit = packColor(0.9, 0.94, 0.95, 1);
    for (let i = 0; i <= len; i++) {
      const x = Math.round(bx + ux * i), y = Math.round(by + uy * i);
      r.rect(x, y, 1, 1, i < 2 ? steelD : i % 5 === 2 ? lit : steel);
    }
    const hx = Math.round(tx), hy = Math.round(ty);
    if (sh.blunt) {
      // the bang-head: a blunt steel knob, 3 px, lit on top
      r.rect(hx - 1, hy - 1, 3, 3, steelD); r.rect(hx - 1, hy - 1, 2, 1, lit); r.rect(hx, hy, 1, 1, steel);
    } else {
      const flint = packColor(0.3, 0.3, 0.34, 1), flintL = packColor(0.62, 0.62, 0.68, 1);
      r.rect(hx, hy, 1, 1, flintL);
      r.rect(Math.round(tx - ux * 1 - uy), Math.round(ty - uy * 1 + ux), 1, 1, flint);
      r.rect(Math.round(tx - ux * 1 + uy), Math.round(ty - uy * 1 - ux), 1, 1, flint);
      r.rect(Math.round(tx - ux * 2), Math.round(ty - uy * 2), 1, 1, flintL);
      // the flopper: a little hinged barb behind the point
      r.rect(Math.round(tx - ux * 5 - uy * 1.6), Math.round(ty - uy * 5 + ux * 1.6), 1, 1, steelD);
    }
    // the catch on the end of the line, kicking (its own painter, else the item's art)
    if (sh.item && sh.phase === 'reel') {
      const kick = Math.sin(sh.t * 26) * 1.2;
      const dir: 1 | -1 = ux >= 0 ? 1 : -1;
      if (sh.fish?.drawOnLine) sh.fish.drawOnLine(r, tx, ty + kick, dir, sh.t);
      else { const f = iconFrame(sh.item); if (f) r.draw(f, Math.round(tx), Math.round(ty + kick), dir, 1); }
    }
  }
  private drawBang(r: Renderer, b: { x: number; y: number; t: number }) {
    const fr = harpoonFrames();
    const i = Math.min(fr.shock.length - 1, Math.floor((b.t / 0.6) * fr.shock.length));
    r.emissive(0.6);
    r.draw(fr.shock[i], Math.round(b.x), Math.round(b.y), 1, 1, 0, packColor(1, 1, 1, 1 - b.t / 0.6));
    r.emissive();
    if (this.flash > 0) r.light(b.x, b.y, 50, 0.8, 0.95, 1, 1.2 * this.flash / 0.12);
  }

  dispose() {
    this.lower();
    this.shaft = null;
  }
}

// console / test helpers: zlHarpoon.state(), zlHarpoon.shoot(true) (the marked fish, the QTE taken as
// timed or not), zlHarpoon.raise()
try {
  const gun = async () => {
    const s = game.scene as unknown as FieldScene;
    const m = await import('./arsenal-belt');
    return s ? m.beltOf(s)?.harpoon ?? null : null;
  };
  (window as unknown as { zlHarpoon?: unknown }).zlHarpoon = {
    raise: async () => { const g = await gun(); g?.raise(); return !!g?.ready; },
    shoot: async (ok = true) => {
      const g = await gun();
      if (!g) return 'no gun';
      if (!g.ready) g.raise();
      const tg = g.target ?? (g as unknown as { pick(): Target | null }).pick();
      if (!tg) return 'no target';
      if (tg.kind === 'shark') { (g as unknown as { bang(c: Charger): void }).bang(tg.c); return 'bang'; }
      g.shootFish(tg.f, { ok, score: ok ? 1 : 0 });
      return 'fish:' + tg.f.species;
    },
    state: async () => { const g = await gun(); return g ? { ready: g.ready, busy: g.busy, target: g.target?.kind ?? null, shaft: g.shaft ? { phase: g.shaft.phase, item: g.shaft.item, blunt: g.shaft.blunt, x: Math.round(g.shaft.x), y: Math.round(g.shaft.y), vx: Math.round(g.shaft.vx), vy: Math.round(g.shaft.vy) } : null, muzzle: g.muzzle().map(Math.round), shafts: ammo('harpoon') } : null; },
  };
} catch { /* */ }

/** the catch's item art, as a frame in the scene's atlas */
const icons = new Map<string, Frame>();
let iconOwner: unknown = null;
function iconFrame(id: string): Frame | null {
  if (iconOwner !== local) { iconOwner = local; icons.clear(); }
  let f = icons.get(id);
  if (f) return f;
  if (!ITEMS[id]) return null;
  const b = itemIcon(id);
  f = local.add('v12harp:icon:' + id, b, b.w / 2, b.h / 2);
  icons.set(id, f);
  return f;
}
