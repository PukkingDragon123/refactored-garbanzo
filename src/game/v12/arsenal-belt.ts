// V12 the weapon belt in Mori's hands: picking a weapon and using it, in any field scene. The slingshot
// stays the default and keeps its own controller (src/game/v11/predators-sling.ts); this one runs the
// rest of the belt (src/game/v12/arsenal.ts) with the same feel:
//
//   T          the next weapon on the belt (a floating word over Mori says which, and what's left)
//   G          tap: ready the selected weapon (tap again to lower it); hold: draw / aim, release: let fly.
//              It aims itself at the nearest predator ahead (else something to hit, else straight ahead)
//   mouse      with a weapon up, hold the left button and release at the pointer
//   touch      the weapon button (press, drag back to aim, let go; a tap fires at the nearest threat) and
//              the small cycle button above it
//   bear spray holds: a burst every third of a second while G (or the button) is down
//
// Thrown things (the bolas, the bangers) wind up as you hold (whirled overhead, cocked back) and go
// further the longer you hold; the guns (the flare pistol, the net launcher, the dart rifle) settle
// their aim as you hold. Readied, Mori plants his feet; push a direction for a moment to lower it.
// The dotted arc (or the sight line, or the spray's reach) shows where it will go.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { FieldScene } from '../scenes/field';
import type { Animal } from '../wild/animal';
import { game } from '../game';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import { pxIconURL, pxIconBuf } from '../../ui/pxicons';
import { pxTextBuf } from '../../ui/pxfont';
import { hudScale } from '../../ui/v11/hudpx';
import { floatNotice } from '../../ui/v12/float';
import { isPredator, shootTargets, emitPred } from '../v11/predators-core';
import { ballistic } from '../v11/predators-sling';
import { armClips } from '../../art/v12/arms7';
import { ArsenalFx } from './arsenal-fx';
import { sfxArm } from './arsenal-sfx';
import { WEAPON_BY_ID, selectedWeapon, cycleWeapon, ownsWeapon, ownedWeapons, ammo, setAmmo, ammoMax, onBelt } from './arsenal';
import type { WeaponId, WeaponDef } from './arsenal';

/** launch speed and gravity per weapon (thrown ones scale with the draw) */
const BALL: Record<Exclude<WeaponId, 'sling' | 'spray'>, { v: (draw: number) => number; g: number }> = {
  bolas: { v: d => 230 + 250 * d, g: 380 },
  bangers: { v: d => 210 + 240 * d, g: 380 },
  net: { v: () => 370, g: 300 },
  flare: { v: () => 520, g: 140 },
  tranq: { v: () => 900, g: 70 },
};
const belts = new WeakMap<FieldScene, WeaponBelt>();
/** the belt controller of a scene (the boss fight can read what's up and fire it) */
export const beltOf = (s: FieldScene) => belts.get(s) ?? null;

export class WeaponBelt {
  readonly fx: ArsenalFx;
  ready = false;
  drawing = false;
  /** 0..1: the wind-up of a throw, how settled a gun's aim is */
  draw = 0;
  vel: [number, number] = [200, -100];
  /** the weapon up right now (null: nothing, or the slingshot's turn) */
  cur: WeaponId | null = null;
  private gDown = false;
  private gT = 0;
  private wasReady = false;
  private idleT = 0;
  private cool = 0;
  private turnT = 0;
  private releaseT = 0;
  private pending: { t: number; fire: () => void } | null = null;
  private whirlT = 0;
  private sprayT = 0;
  private mouseDraw = false;
  private lastMouse = -9;
  private tDown = false;
  private tStart: [number, number] = [0, 0];
  private tPull: [number, number] = [0, 0];
  private tRelease = false;
  private chip: HTMLCanvasElement | null = null;
  private chipKey = '';
  private btn: HTMLElement | null = null;
  private cyc: HTMLElement | null = null;
  private onDown: ((e: PointerEvent) => void) | null = null;
  private offBelt: (() => void) | null = null;

  constructor(readonly s: FieldScene, opts: { hitstop?: (secs: number) => void } = {}) {
    this.fx = s.main.add(new ArsenalFx(s));
    this.fx.onHit = (_a: Animal, kind: WeaponId) => {
      opts.hitstop?.(kind === 'net' || kind === 'bolas' ? 0.07 : 0.05);
      s.st.shake(kind === 'spray' ? 0.6 : 1.1, 0.12);
    };
    belts.set(s, this);
    this.onDown = (e: PointerEvent) => {
      if (!this.ready || e.button !== 0 || e.pointerType === 'touch') return;
      game.input.consumeClick(0);
      this.mouseDraw = true;
      this.lastMouse = performance.now();
    };
    game.r.canvas.addEventListener('pointerdown', this.onDown);
    this.makeTouch();
    this.offBelt = onBelt(() => { this.chipKey = ''; this.paintTouch(); });
  }

  /** the selected weapon, if it is one of this controller's (not the slingshot) */
  get weapon(): WeaponDef | null {
    const id = selectedWeapon();
    return id === 'sling' || !ownsWeapon(id) ? null : WEAPON_BY_ID[id];
  }
  get available(): boolean {
    const s = this.s, p = s.player;
    return !!this.weapon && !!p && !p.underwater && s.site?.id !== 'boat' && !s.cutscene && !game.ui.blocking && !s.cam?.active
      && p.state !== 'climb' && p.state !== 'hide' && p.state !== 'swim' && p.state !== 'stunned';
  }

  // ---------------------------------------------------------------- input
  update(dt: number) {
    const s = this.s, p = s.player, inp = game.input;
    this.cool = Math.max(0, this.cool - dt);
    this.updateChip();
    if (this.btn) this.btn.hidden = !this.weapon || !!s.cam?.active || s.cutscene;
    if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) { const f = this.pending.fire; this.pending = null; f(); } }
    // T: the next weapon on the belt (anywhere the belt works, readied or not)
    const free = !s.cutscene && !game.ui.blocking && !s.cam?.active && !!p;
    if (free && inp.keyHit('KeyT')) this.cycle();
    const w = this.weapon;
    if (this.ready && (!w || w.id !== this.cur)) this.lower();
    if (!this.available) {
      if (this.ready) this.lower();
      this.gDown = false; this.mouseDraw = false; this.tDown = false;
      return;
    }
    // G: tap toggles, hold draws
    const gNow = inp.keyDown('KeyG');
    if (gNow && !this.gDown) { this.gDown = true; this.gT = 0; this.wasReady = this.ready; if (!this.ready) this.raise(); }
    if (this.gDown) this.gT += dt;
    if (this.gDown && gNow && this.gT > 0.16 && !this.drawing) this.beginDraw();
    let release = false;
    if (this.gDown && !gNow) {
      this.gDown = false;
      if (this.drawing) release = true;
      else if (this.wasReady) this.lower();
    }
    if (this.mouseDraw) {
      if (!this.drawing) this.beginDraw();
      if (!inp.mouseDown[0]) { this.mouseDraw = false; if (this.drawing) release = true; }
    }
    if (inp.moved) this.lastMouse = performance.now();
    if (this.tDown && !this.ready) this.raise();
    if (this.tDown && !this.drawing) this.beginDraw();
    if (this.tRelease) { this.tRelease = false; if (this.drawing) release = true; }
    if (!this.ready) return;
    // planted: a tap turns him round, a push lowers it and he walks off
    const ax = inp.axisX();
    if (ax !== 0) {
      this.turnT += dt;
      if (ax !== p.facing && this.turnT < 0.3) p.facing = ax as 1 | -1;
      if (this.turnT > 0.32 && !this.drawing) { this.lower(); return; }
    } else this.turnT = 0;
    if (inp.hit('jump') && !this.drawing) { this.lower(); return; }
    const W = this.weapon!;
    const [rdy, drw] = armClips(W.id);
    if (this.drawing) {
      this.draw = Math.min(1, this.draw + dt / (W.use === 'throw' ? 0.75 : 0.32));
      this.aim();
      if (Math.sign(this.vel[0]) !== 0) p.facing = Math.sign(this.vel[0]) as 1 | -1;
      if (this.releaseT <= 0) p.poseOverride = drw;
      if (W.id === 'bolas') { this.whirlT -= dt; if (this.whirlT <= 0) { this.whirlT = 0.24; sfxArm('whirl', { x: p.x, vol: 0.5 + this.draw * 0.5, pitch: 0.9 + this.draw * 0.5 }); } }
      // the spray keeps going while it's held
      if (W.use === 'spray') { this.sprayT -= dt; if (this.sprayT <= 0) { this.sprayT = W.cool; if (!this.fire()) { this.drawing = false; } } }
    } else if (this.releaseT > 0) {
      this.releaseT -= dt;
      if (this.releaseT <= 0) { p.poseOverride = rdy; p.poseFrame = null; }
    } else {
      this.aim();
      this.idleT += dt;
      if (this.idleT > 9) this.lower();
    }
    if (release) {
      if (W.use === 'spray') { this.drawing = false; this.draw = 0; }
      else this.fire();
    }
  }

  /** T: the next weapon on the belt */
  cycle() {
    const own = ownedWeapons();
    if (own.length < 2) return;
    const id = cycleWeapon(1);
    const w = WEAPON_BY_ID[id];
    audio.play('ui', { vol: 0.25, pitch: 0.8 });
    sfxArm('click', { vol: 0.7, pitch: 0.8 });
    floatNotice(`${w.name}: ${ammo(id)} ${ammo(id) === 1 ? w.unit[0] : w.unit[1]}`, 1600, { tag: 'Belt', accent: '#ffd05a' });
    this.paintTouch();
  }

  raise() {
    const W = this.weapon;
    if (this.ready || !W) return;
    const p = this.s.player;
    this.ready = true;
    this.cur = W.id;
    this.idleT = 0;
    p.vx = 0;
    p.frozen = true;
    p.poseOverride = armClips(W.id)[0];
    p.poseFrame = null;
    audio.play('rope' as never, { vol: 0.25, pitch: 1.3 });
    if (W.id === 'tranq') sfxArm('bolt', { x: p.x, vol: 0.7 });
    this.hint(W);
  }
  lower() {
    const p = this.s.player;
    this.ready = false;
    this.drawing = false;
    this.draw = 0;
    this.mouseDraw = false;
    this.cur = null;
    this.pending = null;
    if (p) {
      p.frozen = false;
      if (p.poseOverride && /^arm[A-Z]/.test(p.poseOverride)) { p.poseOverride = null; p.poseFrame = null; }
    }
  }
  private beginDraw() {
    const W = this.weapon;
    if (!W || this.cool > 0 || this.pending) return;
    if (ammo(W.id) <= 0) { this.empty(W); return; }
    this.drawing = true;
    this.draw = 0;
    this.idleT = 0;
    this.whirlT = 0;
    this.sprayT = 0;
  }
  private empty(W: WeaponDef) {
    const p = this.s.player;
    sfxArm('click', { x: p.x });
    this.cool = 0.6;
    const pick = W.id === 'bolas' || W.id === 'net' ? ' Pick them up where they fell.' : '';
    floatNotice(`No ${W.unit[1]} left.${pick} Hank sells more.`, 2400, { tag: W.short, accent: '#ff9a7a' });
  }

  /** the muzzle (or the throwing hand) on the current frame, else a sensible spot */
  origin(): [number, number] {
    const p = this.s.player;
    const m = p.body.point('muzzle');
    if (m) return m;
    const h = p.height || 62;
    return [p.x + p.facing * 9, p.y - h * (this.weapon?.use === 'throw' ? 0.9 : 0.68)];
  }

  private aim() {
    const s = this.s, p = s.player, W = this.weapon;
    if (!W || W.id === 'spray' || W.id === 'sling') { this.vel = [p.facing * 200, 0]; return; }
    const B = BALL[W.id as keyof typeof BALL];
    const [ox, oy] = this.origin();
    const v = B.v(this.draw);
    const mouseRecent = performance.now() - this.lastMouse < 2500 && game.input.lastDevice === 'mouse';
    if (this.tDown && Math.hypot(this.tPull[0], this.tPull[1]) > 14) {
      const [px, py] = this.tPull, L = Math.hypot(px, py);
      if (W.use === 'throw') this.draw = Math.max(this.draw, clamp(L / 95));
      const vv = B.v(clamp(L / 95));
      this.vel = [(-px / L) * vv, (-py / L) * vv];
      return;
    }
    let tx: number, ty: number;
    if (mouseRecent && (this.mouseDraw || !this.gDown)) [tx, ty] = s.worldMouse() as [number, number];
    else {
      const t = this.autoTarget(W);
      if (t) [tx, ty] = t;
      else { tx = ox + p.facing * (W.use === 'throw' ? 70 + this.draw * 170 : 240); ty = W.use === 'throw' ? s.st.terrain.groundY(tx) - 6 : oy + (W.id === 'net' ? 10 : 0); }
    }
    const sol = ballistic(tx - ox, ty - oy, v, B.g);
    if (sol) this.vel = sol;
    else { const dir = Math.sign(tx - ox) || p.facing; this.vel = [dir * v * Math.SQRT1_2, -v * Math.SQRT1_2]; }
  }
  /** the nearest predator ahead (its legs for the bolas, its middle for the rest), else a target */
  private autoTarget(W: WeaponDef): [number, number] | null {
    const s = this.s, p = s.player;
    let best: [number, number] | null = null, bd = W.id === 'tranq' || W.id === 'flare' ? 620 : 520;
    for (const a of s.animals) {
      if (!isPredator(a) || a.hidden > 0.9) continue;
      const dx = a.x - p.x;
      if (Math.sign(dx) !== p.facing && Math.abs(dx) > 30) continue;
      if (Math.abs(dx) >= bd) continue;
      bd = Math.abs(dx);
      const b = a.body.bounds(a);
      const cy = W.id === 'bolas' ? b.y1 - (b.y1 - b.y0) * 0.3 : W.id === 'net' ? b.y0 + (b.y1 - b.y0) * 0.35 : (b.y0 + b.y1) / 2;
      best = [(b.x0 + b.x1) / 2, cy];
    }
    if (best) return best;
    for (const t of shootTargets()) {
      const dx = t.x - p.x;
      if (Math.sign(dx) !== p.facing || Math.abs(dx) > 320) continue;
      if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = [t.x, t.y]; }
    }
    return best;
  }

  /** let fly; false if there was nothing to fire */
  private fire(): boolean {
    const s = this.s, p = s.player, W = this.weapon;
    if (!W) return false;
    if (ammo(W.id) <= 0) { this.empty(W); this.drawing = false; return false; }
    const keep = W.use === 'spray';
    if (!keep) this.drawing = false;
    if (W.use === 'throw' && this.draw < 0.15) this.draw = 0.3;
    this.aim();
    setAmmo(W.id, ammo(W.id) - 1);
    this.idleT = 0;
    this.cool = W.cool;
    const [, , rel] = armClips(W.id);
    const vel: [number, number] = [this.vel[0], this.vel[1]];
    if (W.use === 'throw') {
      // the throw: step, whip over the top, let go at the top of the arc
      p.poseOverride = rel!;
      p.poseFrame = null;
      this.releaseT = 0.5;
      this.pending = {
        t: 0.13, fire: () => {
          const ox = p.x + p.facing * 8, oy = p.y - (p.height || 62) * 0.92;
          if (W.id === 'bolas') this.fx.throwBolas(ox, oy, vel[0], vel[1]);
          else this.fx.throwBangers(ox, oy, vel[0], vel[1]);
          audio.play('swish' as never, { vol: 0.5 });
        },
      };
    } else {
      const [ox, oy] = this.origin();
      if (W.id === 'flare') { this.fx.fireFlare(ox, oy, vel[0], vel[1]); s.st.shake(1.4, 0.12); p.body.react('recoil'); }
      else if (W.id === 'net') { this.fx.fireNet(ox, oy, vel[0], vel[1]); s.st.shake(1.2, 0.14); p.body.react('recoil'); }
      else if (W.id === 'tranq') {
        // a little drift until the aim settles
        const sp = (1 - this.draw) * 0.06;
        const a = Math.atan2(vel[1], vel[0]) + rand.range(-sp, sp), v = Math.hypot(vel[0], vel[1]);
        this.fx.fireDart(ox, oy, Math.cos(a) * v, Math.sin(a) * v);
        p.body.react('recoil');
        setTimeout(() => sfxArm('bolt', { x: p.x }), 380);
      } else if (W.id === 'spray') {
        this.fx.spray(ox, oy, p.facing as 1 | -1, 'mori', 1);
        // the wind can bring some of it back
        if (Math.sign(s.st.wind) === -p.facing && Math.abs(s.st.wind) > 0.6 && rand.chance(0.5)) {
          setTimeout(() => { p.body.setExpr('injured', 1.6); game.ui.bubbles.bark(p.id, 'Ack! Wind! WIND!', { style: 'shout', expr: 'injured' } as never); }, 500);
        }
      }
      this.releaseT = W.use === 'spray' ? 0 : 0.28;
      if (!keep) this.draw = 0;
    }
    if (ammo(W.id) === 0) setTimeout(() => floatNotice(`That was the last ${W.unit[0]}.`, 1800, { tag: W.short, accent: '#ff9a7a' }), 500);
    game.persist();
    return true;
  }

  // ---------------------------------------------------------------- the ammo words over Mori (no box: pixel words with an ink ring)
  private updateChip() {
    const W = this.weapon;
    if (!this.ready || !W) { if (this.chip) this.chip.style.display = 'none'; return; }
    if (!this.chip) {
      const c = document.createElement('canvas');
      c.className = 'v12-arm-chip';
      c.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-100%);pointer-events:none;z-index:6;image-rendering:pixelated';
      game.ui.sceneLayer.appendChild(c);
      this.chip = c;
    }
    const n = ammo(W.id), S = hudScale();
    const key = `${W.id}|${n}|${S}`;
    if (key !== this.chipKey) {
      this.chipKey = key;
      const ic = pxIconBuf(W.ammoIcon);
      const tx = pxTextBuf(`${n} / ${ammoMax(W.id)}`, { font: 'bold', color: n ? '#fff4d8' : '#ff9a7a', outline: '#140c06', shadow: '#140c06', bounce: false, pad: 1 });
      const w = ic.w + 2 + tx.w, h = Math.max(ic.h, tx.h);
      const g = this.chip.getContext('2d')!;
      this.chip.width = w; this.chip.height = h;
      g.imageSmoothingEnabled = false;
      g.drawImage(ic.toCanvas(1), 0, Math.round((h - ic.h) / 2));
      g.drawImage(tx.toCanvas(1), ic.w + 2, Math.round((h - tx.h) / 2));
      this.chip.style.width = w * S + 'px';
      this.chip.style.height = h * S + 'px';
    }
    this.chip.style.display = '';
    const r = game.r, p = this.s.player, rc = r.canvas.getBoundingClientRect();
    const sx = rc.left + (r.projectX(p.x, 1) / r.VW) * rc.width;
    const sy = rc.top + (r.projectY(p.y - 70, 1) / r.VH) * rc.height;
    this.chip.style.left = `${Math.round(sx)}px`;
    this.chip.style.top = `${Math.round(Math.max(rc.top + 40, sy))}px`;
  }

  private hint(W: WeaponDef) {
    const k = 'v12:armHint:' + W.id;
    const n = game.save.vars[k] ?? 0;
    if (n >= 2) return;
    game.save.vars[k] = n + 1;
    const how: Record<string, string> = {
      bolas: 'Hold G to whirl it, let go to throw. Aim low: it wraps the legs.',
      bangers: 'Hold G to light and wind up, let go to throw. They go off all over the spot.',
      flare: 'Hold G to aim, let go to fire. The flare keeps burning where it lands.',
      net: 'Hold G to aim, let go to fire the net. Small ones stay put; big ones slow down.',
      tranq: 'Hold G to settle the aim, let go to fire a dart. Big ones need several.',
      spray: 'Hold G to spray. Get close: it only reaches a few steps.',
    };
    floatNotice(how[W.id] ?? '', 4200, { tag: W.short, accent: '#7fe0d0' });
  }

  // ---------------------------------------------------------------- touch
  touchStart(x: number, y: number) { this.tDown = true; this.tStart = [x, y]; this.tPull = [0, 0]; }
  touchMove(x: number, y: number) {
    if (!this.tDown) return;
    const r = game.r, c = this.s.st.cam;
    const k = (r.VW / Math.max(1, window.innerWidth)) / Math.max(0.2, c.zoom);
    this.tPull = [(x - this.tStart[0]) * k, (y - this.tStart[1]) * k];
  }
  touchEnd() { if (this.tDown) { this.tDown = false; this.tRelease = true; } }
  private makeTouch() {
    const host = document.querySelector('.touch .tc-r') as HTMLElement | null;
    if (!host) return;
    const b = document.createElement('div');
    b.className = 'tc-b amber v12-arm-btn';
    b.style.right = 'calc(var(--tu) * 25)';
    b.style.bottom = 'calc(var(--tu) * 21)';
    b.setAttribute('role', 'button');
    b.hidden = true;
    let pid = -1;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (pid !== -1) return;
      pid = e.pointerId;
      try { b.setPointerCapture(e.pointerId); } catch { /* */ }
      b.classList.add('down');
      this.touchStart(e.clientX, e.clientY);
    });
    b.addEventListener('pointermove', e => { if (e.pointerId === pid) { e.stopPropagation(); this.touchMove(e.clientX, e.clientY); } });
    const up = (e: PointerEvent) => { if (e.pointerId !== pid) return; pid = -1; b.classList.remove('down'); this.touchEnd(); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    host.appendChild(b);
    this.btn = b;
    // the cycle button: a small one over it
    const c = document.createElement('div');
    c.className = 'tc-b v12-arm-cyc';
    c.style.right = 'calc(var(--tu) * 27)';
    c.style.bottom = 'calc(var(--tu) * 31)';
    c.style.transform = 'scale(0.7)';
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Next weapon');
    c.innerHTML = `<i style="--ic:url(${pxIconURL('play', 2)})"></i><span class="tc-t">NEXT</span>`;
    c.hidden = true;
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.cycle(); });
    host.appendChild(c);
    this.cyc = c;
    this.paintTouch();
  }
  private paintTouch() {
    const W = this.weapon;
    if (this.btn) {
      this.btn.hidden = !W;
      if (W) {
        const k = W.id;
        if (this.btn.dataset.w !== k) {
          this.btn.dataset.w = k;
          this.btn.setAttribute('aria-label', W.name);
          this.btn.innerHTML = `<i style="--ic:url(${pxIconURL(W.icon, 2)})"></i><span class="tc-t">${W.short.toUpperCase()}</span>`;
        }
      }
    }
    if (this.cyc) this.cyc.hidden = ownedWeapons().length < 2;
  }

  // ---------------------------------------------------------------- the aim: the dotted arc, the sight line, the spray's reach
  render(r: Renderer) {
    if (!this.ready || !this.drawing) return;
    const W = this.weapon;
    if (!W) return;
    const s = this.s, p = s.player;
    const [ox, oy] = W.use === 'throw' ? [p.x + p.facing * 8, p.y - (p.height || 62) * 0.92] : this.origin();
    const dotC = packColor(1, 0.97, 0.85, 1);
    if (W.use === 'spray') {
      // the reach: a fan of faint dots ending in a little tick
      for (let i = 1; i <= 6; i++) {
        const x = ox + p.facing * i * 14, h = 4 + i * 5;
        for (const dy of [-h, h]) if ((i + Math.floor(s.time * 8)) % 2 === 0) r.fxDraw(A.dot2, Math.round(x), Math.round(oy + dy * 0.5), 0.8, 0.8, 0, packColor(1, 0.7, 0.45, 1), 0.7);
      }
      return;
    }
    const B = BALL[W.id as keyof typeof BALL];
    let x = ox, y = oy, vx = this.vel[0], vy = this.vel[1];
    const dt = W.id === 'tranq' ? 0.012 : W.id === 'flare' ? 0.02 : 0.035;
    let lx = x, ly = y;
    const steps = W.id === 'tranq' ? 40 : 60;
    for (let i = 0; i < steps; i++) {
      vy += B.g * dt; x += vx * dt; y += vy * dt;
      const gy = s.st.terrain.groundY(x);
      if (y >= gy) { lx = x; ly = gy; break; }
      lx = x; ly = y;
      if (i % 2 === 0) r.fxDraw(A.dot2, Math.round(x), Math.round(y), 0.8, 0.8, 0, dotC, Math.min(1, (1 - i / steps) * (0.6 + this.draw * 0.8)));
    }
    r.fxDraw(A.ring, lx, ly - 1, 0.35, 0.2, 0, packColor(1, 0.95, 0.75, 1), 0.6 + this.draw * 0.6);
  }

  dispose() {
    if (this.onDown) game.r.canvas.removeEventListener('pointerdown', this.onDown);
    this.offBelt?.();
    this.btn?.remove();
    this.cyc?.remove();
    this.chip?.remove();
    this.fx.dispose();
    this.lower();
  }
}
void emitPred;
