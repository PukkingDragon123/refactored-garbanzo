// V11 predators: Mori's slingshot. Once the slingshot is on the tool belt (save.tools, crafted from
// Aroha's blueprint) he can ready it, draw and let fly, in any field scene:
//
//   keyboard   G readies it (tap again to lower). Hold G to draw, release to shoot: it aims itself at
//              the nearest predator ahead (else something to knock down, else a lob straight ahead).
//   mouse      with it up, hold the left button to draw and release to shoot at the pointer: the
//              pebble flies a real arc, and the dotted arc shows where it will land.
//   touch      the SLING button: press, drag your thumb back like pulling the band (the shot goes the
//              other way, further the further you pull), let go. A quick tap fires at the nearest threat.
//
// Ammo: a pouch of pebbles (save.vars['v11:pebbles'], 15 at most). Empty, he scoops a handful off the
// ground (a moment on one knee). Readied, he plants his feet; push a direction for a moment to lower
// it and walk. The band stretches as he draws (a creak that rises), snaps forward on release.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { FieldScene } from '../scenes/field';
import { game } from '../game';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { clamp } from '../../core/math';
import { ANIMS7 } from '../../art/v7/anims7';
import { PX_ICONS, pxIcon, pxIconURL } from '../../ui/pxicons';
import { anim7, isPredator, shootTargets } from './predators-core';
import { PredFx, G_PEBBLE } from './predators-fx';
import { sfx11 } from './predators-sfx';

const POUCH = 15;
export const pebbles = () => game.save.vars['v11:pebbles'] ?? POUCH;
const setPebbles = (n: number) => { game.save.vars['v11:pebbles'] = Math.max(0, Math.min(POUCH, n)); };

// pixel icons for the HUD chip and the touch button
if (!PX_ICONS.pebble) {
  PX_ICONS.pebble = { rows: ['.ab.', 'abbc', 'bbcc', '.cd.'], pal: { a: '#e8e2d2', b: '#b4ad9c', c: '#857e70', d: '#5a554c' } };
  PX_ICONS.sling = {
    rows: ['a...a', 'ab.ab', '.bab.', '..b..', '..c..', '..c..', '..c..'],
    pal: { a: '#e8c890', b: '#b0804a', c: '#7a5432' },
  };
}

const speedOf = (draw: number) => 190 + 250 * draw;

/** launch velocity that lands on (dx, dy) from the origin at speed v (the low arc); null if out of reach */
export function ballistic(dx: number, dy: number, v: number, g = G_PEBBLE): [number, number] | null {
  const X = Math.abs(dx), Y = -dy;
  if (X < 1) return [0, -v];
  const v2 = v * v, disc = v2 * v2 - g * (g * X * X + 2 * Y * v2);
  if (disc < 0) return null;
  const th = Math.atan((v2 - Math.sqrt(disc)) / (g * X));
  return [Math.sign(dx) * v * Math.cos(th), -v * Math.sin(th)];
}

export class PlayerSling {
  ready = false;
  drawing = false;
  /** 0..1 how far the band is drawn */
  draw = 0;
  /** launch velocity for the current aim (world px/s) */
  vel: [number, number] = [200, -120];
  private gDown = false;
  private gT = 0;
  private wasReady = false;
  private idleT = 0;
  private cool = 0;
  private snapT = 0;
  private scoopT = -1;
  private turnT = 0;
  private releaseT = 0;
  private creakT = 0;
  private mouseDraw = false;
  private lastMouse = -9;
  private shots = 0;
  // touch
  private tDown = false;
  private tStart: [number, number] = [0, 0];
  private tPull: [number, number] = [0, 0];
  private tRelease = false;
  private chip: HTMLElement | null = null;
  private btn: HTMLElement | null = null;
  private onDown: ((e: PointerEvent) => void) | null = null;

  constructor(readonly s: FieldScene, readonly fx: PredFx) {
    // with the sling up, the left button draws it instead of walking Mori to the pointer
    this.onDown = (e: PointerEvent) => {
      if (!this.ready || e.button !== 0 || e.pointerType === 'touch') return;
      game.input.consumeClick(0);
      this.mouseDraw = true;
      this.lastMouse = performance.now();
    };
    game.r.canvas.addEventListener('pointerdown', this.onDown);
    this.makeTouchButton();
  }

  /** can he use it here and now? */
  get available(): boolean {
    const s = this.s, p = s.player;
    return game.save.tools.includes('slingshot') && !!p && !p.underwater && s.site?.id !== 'boat' && !s.cutscene && !game.ui.blocking && !s.cam?.active && p.state !== 'climb' && p.state !== 'hide' && p.state !== 'swim' && p.state !== 'stunned';
  }

  /** world point the pouch is held at (the shot starts here) */
  origin(): [number, number] {
    const p = this.s.player;
    const h = p.height || 62;
    return [p.x + p.facing * 8, p.y - h * 0.7];
  }

  // ---------------------------------------------------------------- input
  update(dt: number) {
    const s = this.s, p = s.player, inp = game.input;
    this.cool = Math.max(0, this.cool - dt);
    this.snapT = Math.max(0, this.snapT - dt);
    this.updateUi();
    if (this.scoopT >= 0) { this.updateScoop(dt); return; }
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
    // mouse: left button held = drawing
    if (this.mouseDraw) {
      if (!this.drawing) this.beginDraw();
      if (!inp.mouseDown[0]) { this.mouseDraw = false; if (this.drawing) release = true; }
    }
    if (inp.moved) this.lastMouse = performance.now();
    // touch
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
    // the draw
    if (this.drawing) {
      this.draw = Math.min(1, this.draw + dt / 0.55);
      this.creakT -= dt;
      if (this.creakT <= 0 && this.draw < 0.98) { this.creakT = 0.3; sfx11('bandStretch', { vol: 0.6 + this.draw * 0.5, pitch: 0.9 + this.draw * 0.4 }); }
      this.aim();
      p.poseOverride = this.drawPose();
      p.poseFrame = this.drawFrame();
      if (Math.sign(this.vel[0]) !== 0) p.facing = Math.sign(this.vel[0]) as 1 | -1;
    } else if (this.releaseT > 0) {
      this.releaseT -= dt;
      if (this.releaseT <= 0) { p.poseOverride = this.readyPose(); p.poseFrame = this.readyFrame(); }
    } else {
      this.aim();
      this.idleT += dt;
      if (this.idleT > 9) this.lower();
    }
    if (release) this.shoot();
  }

  private readyPose() { return anim7('slingReady', 'slingAim'); }
  private readyFrame(): number | null { return this.readyPose() === 'slingAim' ? 0 : null; }
  private drawPose() { return anim7('slingDraw', 'slingAim'); }
  private drawFrame(): number | null {
    const n = this.drawPose();
    if (n === 'slingAim') return this.draw > 0.35 ? 1 : 0;
    const f = ANIMS7[n]?.frames ?? 1;
    return Math.min(f - 1, Math.floor(this.draw * f));
  }

  raise() {
    const p = this.s.player;
    if (this.ready) return;
    this.ready = true;
    this.idleT = 0;
    p.vx = 0;
    p.frozen = true;
    p.poseOverride = this.readyPose();
    p.poseFrame = this.readyFrame();
    audio.play('rope' as never, { vol: 0.25, pitch: 1.5 });
    this.hint();
  }
  lower() {
    const p = this.s.player;
    this.ready = false;
    this.drawing = false;
    this.draw = 0;
    this.mouseDraw = false;
    if (p) {
      p.frozen = false;
      if (p.poseOverride && /^sling/.test(p.poseOverride)) { p.poseOverride = null; p.poseFrame = null; }
    }
  }

  private beginDraw() {
    if (this.cool > 0) return;
    if (pebbles() <= 0) { this.startScoop(); return; }
    this.drawing = true;
    this.draw = 0;
    this.idleT = 0;
    this.creakT = 0;
  }

  /** where to send it: the pointer (mouse), the pull (touch) or the nearest threat ahead */
  private aim() {
    const s = this.s, p = s.player;
    const [ox, oy] = this.origin();
    const v = speedOf(this.draw);
    const mouseRecent = performance.now() - this.lastMouse < 2500 && game.input.lastDevice === 'mouse';
    if (this.tDown && Math.hypot(this.tPull[0], this.tPull[1]) > 14) {
      // the band pulled back: shoot the other way, the pull sets the power
      const [px, py] = this.tPull;
      const L = Math.hypot(px, py);
      this.draw = Math.max(this.draw, clamp(L / 95));
      const vv = speedOf(clamp(L / 95));
      this.vel = [(-px / L) * vv, (-py / L) * vv];
      return;
    }
    let tx: number, ty: number;
    if (mouseRecent && (this.mouseDraw || !this.gDown)) {
      [tx, ty] = (s.worldMouse() as [number, number]);
    } else {
      const t = this.autoTarget();
      if (t) [tx, ty] = t;
      else { tx = ox + p.facing * (60 + this.draw * 180); ty = s.st.terrain.groundY(tx) - 10; }
    }
    const sol = ballistic(tx - ox, ty - oy, v);
    if (sol) this.vel = sol;
    else { const dir = Math.sign(tx - ox) || p.facing; this.vel = [dir * v * Math.SQRT1_2, -v * Math.SQRT1_2]; }
  }

  /** the nearest predator's head ahead, else a shootable target ahead */
  private autoTarget(): [number, number] | null {
    const s = this.s, p = s.player;
    let best: [number, number] | null = null, bd = 560;
    for (const a of s.animals) {
      if (!isPredator(a) || a.hidden > 0.9) continue;
      const dx = a.x - p.x;
      if (Math.sign(dx) !== p.facing && Math.abs(dx) > 30) continue;
      if (Math.abs(dx) < bd) { bd = Math.abs(dx); const [hx, hy] = a.body.head(a); best = [hx, hy + 10]; }
    }
    if (best) return best;
    for (const t of shootTargets()) {
      const dx = t.x - p.x;
      if (Math.sign(dx) !== p.facing || Math.abs(dx) > 300) continue;
      if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = [t.x, t.y]; }
    }
    return best;
  }

  private shoot() {
    const s = this.s, p = s.player;
    this.drawing = false;
    if (this.draw < 0.08) this.draw = 0.25;
    this.aim();
    const [ox, oy] = this.origin();
    const k = 0.6 + this.draw * 0.5;
    this.fx.firePebble(ox, oy, this.vel[0], this.vel[1], 'mori', k);
    setPebbles(pebbles() - 1);
    sfx11('bandSnap', { x: p.x, pitch: 0.95 + this.draw * 0.15 });
    s.st.shake(0.6 + this.draw * 0.8, 0.08);
    this.snapT = 0.14;
    this.cool = 0.3;
    this.draw = 0;
    this.shots++;
    this.releaseT = 0.32;
    p.poseOverride = anim7('slingRelease', 'slingshot');
    p.poseFrame = anim7('slingRelease', 'slingshot') === 'slingshot' ? 2 : null;
    p.body.react('recoil');
    if (pebbles() === 0) game.ui.toast('Pouch empty. Draw again to scoop up a handful of pebbles.', 'SLING', '', 2600);
  }

  // ---------------------------------------------------------------- scooping pebbles
  private startScoop() {
    const p = this.s.player;
    if (p.ground === 'water' || p.wadeK < 0.95) { audio.play('wrong', { vol: 0.4 }); game.ui.toast('No pebbles in the water. Find dry ground.', 'SLING', 'coral', 2000); return; }
    this.scoopT = 0;
    this.drawing = false;
    p.poseOverride = 'pick';
    p.poseFrame = null;
    sfx11('scoop', { x: p.x });
  }
  private updateScoop(dt: number) {
    const p = this.s.player;
    this.scoopT += dt;
    if (this.scoopT > 0.7) {
      this.scoopT = -1;
      setPebbles(pebbles() + 6);
      p.poseOverride = this.ready ? this.readyPose() : null;
      p.poseFrame = this.ready ? this.readyFrame() : null;
      sfx11('scoop', { x: p.x, pitch: 1.2 });
      game.persist();
    }
  }

  // ---------------------------------------------------------------- touch
  touchStart(x: number, y: number) { this.tDown = true; this.tStart = [x, y]; this.tPull = [0, 0]; }
  touchMove(x: number, y: number) {
    if (!this.tDown) return;
    // css px -> world px (the view's zoom)
    const r = game.r, c = this.s.st.cam;
    const k = (r.VW / Math.max(1, window.innerWidth)) / Math.max(0.2, c.zoom);
    this.tPull = [(x - this.tStart[0]) * k, (y - this.tStart[1]) * k];
  }
  touchEnd() { if (this.tDown) { this.tDown = false; this.tRelease = true; } }

  private makeTouchButton() {
    const host = document.querySelector('.touch .tc-r') as HTMLElement | null;
    if (!host) return;
    const b = document.createElement('div');
    b.className = 'tc-b amber v11-sling-btn';
    b.style.right = 'calc(var(--tu) * 25)';
    b.style.bottom = 'calc(var(--tu) * 21)';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', 'Slingshot');
    b.innerHTML = `<i style="--ic:url(${pxIconURL('sling', 2)})"></i><span class="tc-t">SLING</span>`;
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
  }

  // ---------------------------------------------------------------- HUD
  private hint() {
    const n = game.save.vars['v11:slingHints'] ?? 0;
    if (n >= 3) return;
    game.save.vars['v11:slingHints'] = n + 1;
    const touch = document.body.classList.contains('touchmode');
    game.ui.toast(touch
      ? 'Slingshot: press SLING, drag back to pull the band, let go to shoot. A quick tap fires at the nearest threat.'
      : 'Slingshot up. <span class="key">G</span> hold and release, or hold the <b>left mouse button</b> and release at the target. <span class="key">G</span> again lowers it.', 'SLING', 'teal', 5200);
  }
  private updateUi() {
    const avail = game.save.tools.includes('slingshot') && !this.s.cam?.active && !this.s.cutscene;
    if (this.btn) this.btn.hidden = !avail;
    if (!this.ready) { if (this.chip) this.chip.style.display = 'none'; return; }
    if (!this.chip) {
      const c = document.createElement('div');
      c.className = 'v11-sling-chip';
      c.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-100%);display:flex;gap:0.35em;align-items:center;padding:0.1em 0.55em;font-family:"Jersey 10","Silkscreen",monospace;font-size:0.95em;color:#fff4d8;background:rgba(20,14,10,0.72);box-shadow:0 0 0 2px #0c0806,0 3px 0 rgba(0,0,0,0.45);pointer-events:none;z-index:6;letter-spacing:0.05em';
      game.ui.sceneLayer.appendChild(c);
      this.chip = c;
    }
    const n = pebbles();
    const html = `${pxIcon('pebble', { scale: 3 })}<b>${n}</b><span style="opacity:0.7">/ ${POUCH}</span>`;
    if (this.chip.dataset.h !== html) { this.chip.innerHTML = html; this.chip.dataset.h = html; }
    this.chip.style.display = '';
    // it floats over Mori's head (clear of whatever the HUD has at the bottom)
    const r = game.r, p = this.s.player, rc = r.canvas.getBoundingClientRect();
    const sx = rc.left + (r.projectX(p.x, 1) / r.VW) * rc.width;
    const sy = rc.top + (r.projectY(p.y - 66, 1) / r.VH) * rc.height;
    this.chip.style.left = `${Math.round(sx)}px`;
    this.chip.style.top = `${Math.round(Math.max(rc.top + 40, sy))}px`;
  }

  // ---------------------------------------------------------------- drawing: the band, the pouch and the arc
  render(r: Renderer) {
    if (!this.ready) return;
    const s = this.s, p = s.player;
    const [ox, oy] = this.origin();
    const f = p.facing;
    // fork tips held out front, the pouch drawn back toward the cheek along the shot
    const L = Math.hypot(this.vel[0], this.vel[1]) || 1;
    const ux = this.vel[0] / L, uy = this.vel[1] / L;
    const forkX = ox + f * 2, forkY = oy;
    const pull = this.drawing ? 3 + this.draw * 8 : this.snapT > 0 ? -2 * Math.sin(this.snapT * 90) : 2;
    const px = forkX - ux * pull, py = forkY - uy * pull;
    const band = packColor(0.58, 0.36, 0.22, 1);
    for (const dy of [-2.2, 2.2]) this.line(r, forkX, forkY + dy, px, py, band);
    r.draw(A.dot2, px, py, 1, 1, 0, packColor(0.32, 0.2, 0.12, 1));
    if (this.drawing || this.releaseT <= 0) r.draw(A.dot2, px, py - 0.5, 0.7, 0.7, 0, packColor(0.75, 0.72, 0.65, 1));
    if (!this.drawing) return;
    // the dotted arc: where it will go at this draw
    let x = ox, y = oy, vx = this.vel[0], vy = this.vel[1];
    const dt = 0.035;
    let lastX = x, lastY = y;
    for (let i = 0; i < 60; i++) {
      vy += G_PEBBLE * dt;
      x += vx * dt; y += vy * dt;
      const gy = s.st.terrain.groundY(x);
      if (y >= gy) { lastX = x; lastY = gy; break; }
      lastX = x; lastY = y;
      if (i % 2 === 0) {
        const a = (1 - i / 60) * (0.35 + this.draw * 0.45);
        r.fxDraw(A.dot, x, y, 1, 1, 0, packColor(1, 0.97, 0.85, 1), a * 1.3);
      }
    }
    r.fxDraw(A.ring, lastX, lastY - 1, 0.35, 0.2, 0, packColor(1, 0.95, 0.75, 1), 0.6 + this.draw * 0.6);
  }

  private line(r: Renderer, x0: number, y0: number, x1: number, y1: number, c: number) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.3) return;
    r.draw(A.dot, (x0 + x1) / 2, (y0 + y1) / 2, len, 1, Math.atan2(y1 - y0, x1 - x0), c);
  }

  dispose() {
    if (this.onDown) game.r.canvas.removeEventListener('pointerdown', this.onDown);
    this.btn?.remove();
    this.chip?.remove();
    this.lower();
  }
}
