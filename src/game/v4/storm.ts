// The storm. Something massive slams into the Kittiwake; the sky goes black in minutes, lightning,
// mountainous swell, the lights stutter and everything loose starts sliding. Chunk bolts. Find him
// (he hides somewhere small and dark), carry him to the bridge, and then the rogue wave: a full
// cinematic as a wall of water rises off the bow, curls over the boat... and blackout.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import type { ShipScene4 } from './ship';
import { SPOTS, S4 } from './ship';
import { startQuest } from '../quests';
import { audio } from '../../core/audio';
import { clamp, rand, noise2 } from '../../core/math';
import { Custom } from '../../world/props';
import { updater } from '../../world/ocean';
import * as FU from '../../art/ship4/furniture';
import type { Interactable } from '../../world/npc';
import { el } from '../../ui/ui';
import { A, local } from '../assets';
import { PixelBuffer } from '../../art/pixel';
import { rgba } from '../../art/color';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = () => game.save.flags;

/**
 * The wall of water. Side view, rolling in from the bow: a long back slope, a steep concave face
 * toward the boat, a drawdown trough sucked out in front of it, and (as it breaks) a thick lip that
 * pitches forward and curls down over a shadowed barrel. Light glows through the thin water near
 * the crest; foam laces run down the face, whitewater boils at its foot, spray streams off the lip,
 * and lightning flares the whole face.
 */
class GiantWave {
  cx = 2500;
  H = 0;
  curl = 0;
  on = false;
  private spray: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private lastT = 0;
  private grad: Frame | null = null;
  constructor(readonly s: ShipScene4) {}
  /** 1 x 64 vertical ramp of the water body: glowing thin water at the crest down to the deep */
  private ramp(): Frame {
    if (this.grad?.tex) return this.grad;
    const stops: [number, [number, number, number]][] = [[0, [0.66, 0.88, 0.82]], [0.06, [0.46, 0.77, 0.72]], [0.2, [0.27, 0.56, 0.55]], [0.42, [0.14, 0.34, 0.37]], [0.7, [0.07, 0.19, 0.22]], [1, [0.04, 0.1, 0.13]]];
    // 4 texels wide so sampling never bleeds in the atlas neighbours (it's drawn 2 px wide)
    const b = new PixelBuffer(4, 64);
    for (let y = 0; y < 64; y++) {
      const t = y / 63;
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      const k = clamp((t - t0) / (t1 - t0));
      const c = rgba(Math.round((c0[0] + (c1[0] - c0[0]) * k) * 255), Math.round((c0[1] + (c1[1] - c0[1]) * k) * 255), Math.round((c0[2] + (c1[2] - c0[2]) * k) * 255), 255);
      for (let x = 0; x < 4; x++) b.set(x, y, c);
    }
    this.grad = local.add('storm:waveRamp', b, 0, 0);
    return this.grad;
  }
  /** wave height above the undisturbed sea at column x (negative = the drawdown trough) */
  private hAt(x: number) {
    const H = this.H, d = x - this.cx;
    const Lf = 120 + H * 0.3, Lb = 360 + H * 0.7;
    if (d >= 0) return H * Math.exp(-((d / Lb) ** 2) * 1.8);
    const u = -d / Lf;
    if (u <= 1) return H * Math.pow(1 - u, 1.7);
    const v = (u - 1) * Lf;
    return v < 150 ? -H * 0.07 * Math.sin(Math.PI * v / 150) : 0;
  }
  draw(r: Renderer) {
    if (!this.on || this.H < 2) return;
    const s = this.s, t = s.time;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const L = s.weather.lightning;
    const lit = (k: number, a = 1) => packColor(clamp(k + L * 0.25), clamp(k + L * 0.28), clamp(k + L * 0.3), a);
    /** a teal water tone (0 deep .. 1 glowing thin water), flared by lightning */
    const water = (k: number, a = 1) => packColor(clamp(0.05 + 0.5 * k + L * 0.3), clamp(0.13 + 0.68 * k + L * 0.3), clamp(0.16 + 0.6 * k + L * 0.32), a);
    const FOAM = (a: number) => packColor(clamp(0.86 + L * 0.1), clamp(0.94 + L * 0.06), 0.97, a);
    const SHADE = (a: number) => packColor(0.02, 0.07, 0.09, a);
    const H = this.H, cx = this.cx, g = this.ramp();
    const Lf = 120 + H * 0.3;
    const x0 = Math.floor((cx - Lf - 170) / 2) * 2, x1 = cx + 360 + H * 1.4;
    for (let x = x0; x < x1; x += 2) {
      const h = this.hAt(x);
      const sea = s.seaY(x);
      if (h < 0) {
        // the trough: the sea surface sucked down in front of the face, a dark scooped band
        r.rect(x, Math.round(sea + h), 2, Math.round(-h) + 2, SHADE(0.8));
        continue;
      }
      if (h < 1) continue;
      const top = sea - h, d = x - cx;
      const front = d < 0;
      // the body: one stretched ramp column (bright near the crest, deep at the foot); the back is in shadow
      r.draw(g, x, Math.round(top), 0.5, (h + 14) / 64, 0, front ? lit(1) : lit(0.62));
      if (front) {
        // foam lace sliding down the face
        for (let k = 0; k < 6; k++) {
          const yy = top + h * (0.08 + k * 0.15) + Math.sin(x * 0.05 + k * 1.7 + t * 1.3) * 4 + ((t * 18 + k * 7) % 12);
          const n = noise2(x * 0.07, k * 3.1 + t * 0.5, 7);
          if (n > 0.5) r.rect(x, Math.round(yy), 2, n > 0.7 ? 2 : 1, FOAM((0.3 + (n - 0.5) * 1.8) * (1 - k * 0.1)));
        }
        // a few streaks dragged down the steep upper face
        if (-d < 40 + H * 0.2 && noise2(x * 0.11, Math.floor(t * 3), 3) > 0.82) r.rect(x, Math.round(top + 3), 2, Math.round(h * 0.4), FOAM(0.14));
        // whitewater boiling at the foot of the face
        if (-d > Lf * 0.5) {
          const boil = 3 + noise2(x * 0.12, t * 2.2, 9) * 8;
          r.rect(x, Math.round(sea - boil), 2, Math.round(boil) + 2, FOAM(0.75));
        }
      } else if (noise2(x * 0.03, t * 0.2, 11) > 0.72) {
        // wind-torn streaks on the back
        r.rect(x, Math.round(top + h * 0.3 + Math.sin(x * 0.02 + t) * 6), 2, 1, FOAM(0.3));
      }
      // the crest: a ragged white cap
      const cap = 2 + Math.round(noise2(x * 0.18, t * 1.5, 5) * 4 * Math.min(1, h / 60));
      r.rect(x, Math.round(top) - 1, 2, cap, FOAM(0.95));
    }
    // the lip: pitched forward from the crest and falling toward the trough (a thick tapering hook)
    const top = s.seaY(cx) - H;
    if (this.curl > 0.02) {
      const c = this.curl;
      const P0: [number, number] = [cx + 4, top + 2];
      const Q: [number, number] = [cx - Lf * 0.62 * c, top - H * 0.1 * c];
      const P1: [number, number] = [cx - Lf * 0.86 * c, s.seaY(cx - Lf * 0.86 * c) - H * (0.62 - 0.52 * c)];
      // sample the curve finely and bin it into 2 px columns, so the lip, its barrel shadow and its
      // foam skin are drawn as clean columns (no overlapping squares, no ladder of stripes)
      const bins = new Map<number, { y0: number; y1: number; u: number; th: number }>();
      let tipX = P0[0], tipY = P0[1];
      for (let i = 0; i <= 360; i++) {
        const u = i / 360;
        const px = (1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * Q[0] + u * u * P1[0];
        const py = (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * Q[1] + u * u * P1[1];
        const th = Math.max(3, H * (0.18 - 0.13 * u) * (0.5 + 0.5 * c));
        const k = Math.floor(px / 2) * 2, a0 = py - th * 0.5, a1 = py + th * 0.5;
        const b = bins.get(k);
        if (!b) bins.set(k, { y0: a0, y1: a1, u, th });
        else { b.y0 = Math.min(b.y0, a0); b.y1 = Math.max(b.y1, a1); b.u = Math.max(b.u, u); b.th = Math.max(b.th, th); }
        tipX = px; tipY = py;
      }
      for (const [k, b] of bins) {
        // the barrel: the face in shadow under the lip
        const faceY = s.seaY(k) - Math.max(0, this.hAt(k));
        if (faceY > b.y1) r.rect(k, Math.round(b.y1), 2, Math.round(faceY - b.y1), SHADE(0.45 + 0.2 * b.u));
        const y0 = Math.round(b.y0), hh = Math.max(2, Math.round(b.y1 - b.y0));
        r.rect(k, y0, 2, hh, water(0.72 - 0.34 * b.u));
        // darker underside, glowing thin top, foam skin
        r.rect(k, Math.round(b.y1 - b.th * 0.32), 2, Math.max(1, Math.round(b.th * 0.32)), water(0.18));
        r.rect(k, y0 + 2, 2, Math.max(1, Math.round(b.th * 0.2)), water(1, 0.8));
        r.rect(k, y0, 2, 2 + (noise2(k * 0.2, t * 2, 13) > 0.62 ? 1 : 0), FOAM(0.95));
      }
      // the tip explodes into foam where it meets the water
      if (c > 0.85) for (let k = 0; k < 10; k++) r.rect(Math.round(tipX + rand.range(-14, 14)), Math.round(tipY + rand.range(-10, 6)), 3, 2, FOAM(0.85));
    }
    // spray streaming back off the crest and the lip
    const emit = Math.min(40, H * 0.12) * (0.4 + this.curl);
    for (let i = 0; i < emit * dt * 10; i++) {
      const ex = cx + rand.range(-30, 60) - this.curl * rand.range(0, Lf * 0.6);
      this.spray.push({ x: ex, y: top + rand.range(-6, 10), vx: rand.range(30, 140), vy: rand.range(-80, -10), life: rand.range(0.5, 1.3) });
    }
    for (let i = this.spray.length - 1; i >= 0; i--) {
      const q = this.spray[i];
      q.life -= dt; q.vy += 60 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) { this.spray.splice(i, 1); continue; }
      r.rect(Math.round(q.x), Math.round(q.y), 2, 1, FOAM(Math.min(0.8, q.life)));
    }
    if (this.spray.length > 600) this.spray.splice(0, this.spray.length - 600);
  }
}

export async function runStorm(s: ShipScene4) {
  if (F()['v4:bridge']) return;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const p = s.player;
  s.phase = 'storm';
  F()['v4:stormStarted'] = true;
  game.persist();
  s.hud?.refresh(true);
  // the calm before
  s.cutscene = true;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  audio.setMusic('none' as never);
  await say([
    { who: 'mori', text: 'Huh. The birds are gone. All of them. At once.', expr: 'thinking' },
    { who: 'chunk', text: '*low growl*', expr: 'angry', close: false },
  ]);
  await wait(900);
  // ---- IMPACT
  audio.play('shipCrash', { vol: 1 });
  audio.play('thunderClose', { vol: 0.6 });
  s.jolt = 0.22;
  s.st.shake(10, 1.4);
  game.r.post.flash = 0.35;
  s.power = 0;
  p.body.react('jump');
  p.body.setExpr('shocked', 2);
  s.chunk.react('jump');
  s.jenna.setAnim('scared');
  await wait(700);
  s.power = 1;
  // the sky turns
  s.st.layer('sea-horizon').add(updater(dt => { s.weather.storm = Math.min(1, s.weather.storm + dt * 0.1); audio.setStorm(s.weather.storm); }));
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  // Joshu back to the wheel (if he was cooking); Jenna to her cabin
  s.joshu.x = SPOTS.helm[0] - 14; s.joshu.y = S4.bridge.floor; s.joshu.idleAnim = 'steer'; s.joshu.setAnim('steer');
  await say([
    { who: 'joshu', text: 'WHAT IN THE... Something HIT us! Everyone grab hold of something!', style: 'shout', expr: 'shocked' },
    { who: 'jenna', text: 'Was that a WHALE?! Dad! Was that a WHALE?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'Doesn’t matter what it was! There’s a front coming in behind it, and it’s coming FAST. I’m bringing her about!', style: 'shout', expr: 'determined' },
    { who: 'mori', text: 'Okay. Okay okay okay. Everyone’s okay. Everyone’s...', expr: 'worried' },
  ]);
  // Chunk bolts for the hold
  s.buddy.mode = 'stay';
  s.chunk.setExpr('scared');
  s.chunk.walkTo(s.chunk.x + (s.chunk.x > SPOTS.holdHide[0] ? -60 : 60), 150, 'run').catch(() => {});
  await wait(600);
  s.chunk.alpha = 0;
  s.chunk.x = SPOTS.holdHide[0]; s.chunk.y = S4.lower.floor; s.chunk.facing = -1;
  s.chunk.idleAnim = 'hide'; s.chunk.setAnim('hide');
  s.chunk.stopWalk();
  setTimeout(() => (s.chunk.alpha = 1), 400);
  await say([
    { who: 'mori', text: '...Chunk?', expr: 'worried' },
    { who: 'mori', text: 'CHUNK?!', style: 'shout', expr: 'scared' },
  ]);
  s.jenna.x = SPOTS.jennaBunk[0]; s.jenna.y = S4.lower.floor; s.jenna.idleAnim = 'cower'; s.jenna.setAnim('cower');
  s.cutscene = false;
  startQuest('v4storm', true);
  s.hud?.refresh(true);
  game.ui.toast('The deck is pitching! Hold <b>S</b> to brace so you don’t slide. Find Chunk!', 'STORM', 'coral', 6500);
  // loose things start to slide
  const add = (buf: ReturnType<typeof FU.crate>, n: string, x: number, y: number, x0: number, x1: number) => s.addSlider(buf, n, x, y, x0, x1);
  add(FU.dogBowl(true), 'bowl', 288, S4.house.floor, 206, 334);
  add(FU.chair(), 'chair', 322, S4.house.floor, 276, 334);
  add(FU.stool(), 'stool', 360, S4.lower.floor, 344, 420);
  add(FU.crate(14, 12), 'crate', 470, S4.lower.floor - 6, 434, 492);
  add(FU.bucket(), 'bucket', 90, S4.main.y, 44, 190);
  add(FU.cooler(), 'cooler', 170, S4.main.y, 44, 190);
  add(FU.crate(18, 14, FU.P.plank, true), 'crate2', 400, S4.main.y - 3, 360, 500);
  // storm life: rolling seas, extra jolts, spray over the rails
  let joltT = 5;
  s.st.layer('sea-horizon').add(updater(dt => {
    if (s.phase !== 'storm') return;
    joltT -= dt;
    if (joltT <= 0) {
      joltT = rand.range(5, 9);
      s.jolt += rand.pick([-1, 1]) * rand.range(0.05, 0.1);
      s.st.shake(4, 0.6);
      audio.play('waveCrash', { vol: 0.5 });
      if (s.level() !== 'lower') for (let i = 0; i < 26; i++) s.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-120, 120), y: S4.main.y - rand.range(0, 30), vx: rand.range(-40, 40) - 80, vy: rand.range(-120, -40), ay: 300, life: 1, color: [0.85, 0.92, 1], alpha: 0.9, alpha1: 0, floorY: S4.main.y + 1 });
    }
  }));
  // the hiding spot + Jenna in the storm
  // Chunk is wedged in at the forward end of the hold: stand aft of him (the floor ends at the bulkhead)
  s.interact.push({ x: SPOTS.holdHide[0], y: SPOTS.holdHide[1], w: 18, h: 18, label: 'Chunk!', standX: SPOTS.holdHide[0] - 16, quest: () => !F()['v4:chunkFound'], enabled: () => s.phase === 'storm' && !F()['v4:chunkFound'], action: () => findChunk(s) } as Interactable);
  s.interact.push({ x: SPOTS.jennaBunk[0], y: S4.lower.floor, w: 14, h: 18, label: 'Jenna!', standX: SPOTS.jennaBunk[0] - 20, enabled: () => s.phase === 'storm', action: () => say([
    { who: 'jenna', text: F()['v4:chunkFound'] ? 'You found him!! Okay! Bridge! Go go go, I’m right behind you!' : 'I’m FINE! I’m totally fine! This is fine! FIND CHUNK!', expr: 'scared', style: 'shout' },
  ]).then(() => {}) } as Interactable);
  // barks while searching
  const lines = ['He hates thunder. He hides somewhere small and dark...', 'Chunk! Buddy! Where are you?!', 'Not in my cabin... think. Small. Dark. Near food?'];
  let li = 0;
  const tip = setInterval(() => {
    if (s.phase !== 'storm' || F()['v4:chunkFound']) { clearInterval(tip); return; }
    if (!game.ui.bubbles.active) s.bark('mori', lines[li++ % lines.length], { expr: 'worried' });
  }, 11000);
  // reaching the bridge with Chunk starts the finale
  const watch = setInterval(() => {
    if (F()['v4:bridge']) { clearInterval(watch); return; }
    if (F()['v4:chunkFound'] && !s.cutscene && p.y <= S4.bridge.floor + 2 && p.x > S4.bridge.x0 && p.state !== 'climb') { clearInterval(watch); rogueWave(s); }
  }, 250);
}

async function findChunk(s: ShipScene4) {
  const p = s.player;
  s.cutscene = true;
  p.facing = s.chunk.x >= p.x ? 1 : -1;
  p.poseOverride = 'kneel';
  s.chunk.faceTo(p.x);
  await s.say([
    { who: 'mori', text: 'There you are. Hey. Hey, buddy.', expr: 'worried' },
    { who: 'chunk', text: '*trembling all over*', expr: 'scared', close: false },
    { who: 'mori', text: 'I know. It’s loud. I don’t like it either.', expr: 'sad' },
    { who: 'mori', text: 'C’mere. I’ve got you. I’ve always got you.', expr: 'determined' },
  ]);
  p.poseOverride = null;
  s.carrying = true;
  s.chunk.setExpr('sad');
  p.animMap = { idle: 'carryPupIdle', walk: 'carryPup', run: 'carryPupRun', climb: 'carryPupClimb', crouch: 'carryPupIdle', crouchWalk: 'carryPup', brace: 'carryPupIdle', slip: 'carryPup', jump: 'carryPupIdle', fall: 'carryPupIdle' };
  F()['v4:chunkFound'] = true;
  game.persist();
  s.hud?.refresh(true);
  s.cutscene = false;
  game.ui.toast('Get to the <b>wheelhouse</b>! (up the companionway from the galley)', 'STORM', 'coral', 6000);
}

export async function rogueWave(s: ShipScene4) {
  const p = s.player, say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  F()['v4:bridge'] = true;
  game.persist();
  s.phase = 'wave';
  s.cutscene = true;
  s.hud?.show(false);
  // no stray search barks over the finale
  game.ui.bubbles.clear();
  p.walkTo(298, 50).catch(() => {});
  // Jenna made it up too
  s.jenna.x = 240; s.jenna.y = S4.bridge.floor; s.jenna.facing = 1; s.jenna.idleAnim = 'scared'; s.jenna.setAnim('scared');
  await say([
    { who: 'joshu', text: 'There’s my crew. Got the dog? Good lad.', expr: 'serious' },
    { who: 'jenna', text: 'Dad... Dad, what’s THAT?', expr: 'scared' },
  ]);
  // the wall of water rises off the bow while the camera pulls back to take it all in
  const wave = new GiantWave(s);
  wave.on = true;
  wave.cx = 1100;
  const L = s.st.addLayer('wave', 1, 0, 0.35, 0.42, 1);
  const li = s.st.layers.indexOf(L), j = s.st.layers.findIndex(x => x.name === 'sea-near');
  s.st.layers.splice(li, 1);
  s.st.layers.splice(j, 0, L);
  L.add(new Custom(0, rr => wave.draw(rr)));
  game.ui.letterbox(true);
  const cam = s.st.cam;
  cam.locked = true;
  let T = 0, go = -1;
  const up = updater(dt => {
    T += dt;
    cam.zoom += (0.52 - cam.zoom) * Math.min(1, dt * 0.8);
    cam.x += (1480 - cam.x) * Math.min(1, dt * 0.7);
    cam.y += (205 - cam.y) * Math.min(1, dt * 0.7);
    wave.H = Math.min(340, wave.H + dt * 75);
    // it only comes in once everyone has had their moment
    if (go >= 0) {
      go += dt;
      wave.cx -= dt * (140 + go * 150);
      wave.curl = Math.min(1, wave.curl + dt * 0.5);
      s.jolt = Math.min(0.3, s.jolt + dt * 0.06);
    }
    if (Math.random() < dt * 0.6) s.sky.flash({ big: Math.random() < 0.25 });
  });
  s.st.layer('sea-horizon').add(up);
  audio.play('waveCrash', { vol: 0.6 });
  await wait(3200);
  // the lines play as close-up cut-ins: the speakers are tiny in the wide shot
  await say([
    { who: 'joshu', text: 'ROGUE WAVE!! GRAB HOLD OF SOMETHING AND DON’T YOU DARE LET GO!', style: 'shout', expr: 'shocked', auto: 2000, close: true },
    { who: 'jenna', text: 'DAAAAAD!!', style: 'shout', expr: 'scared', auto: 1200, close: true },
    { who: 'mori', text: 'I’ve got you, Chunk. I’ve got you.', style: 'whisper', expr: 'scared', auto: 1700, close: true },
  ]);
  for (const a of [s.jenna, s.joshu]) a.setAnim('brace');
  go = 0;
  audio.play('waveCrash', { vol: 0.8, pitch: 0.8 });
  // slow motion as the lip comes over
  await wait(700);
  game.slowmo = 0.45;
  await new Promise<void>(res => { const chk = () => (wave.cx < 420 ? res() : requestAnimationFrame(chk)); chk(); });
  audio.play('waveCrash', { vol: 1 });
  audio.play('shipCrash', { vol: 1 });
  s.st.shake(14, 1.2);
  game.r.post.flash = 1;
  await wait(260);
  // blackout
  game.slowmo = 1;
  game.r.post.fadeColor = [0, 0, 0];
  game.r.post.fade = 1;
  game.fadeTo(1, 20);
  audio.setStorm(0);
  audio.setMusic('none' as never);
  audio.setAmbience('none', false);
  game.ui.letterbox(false);
  await blackout();
  const { goBeachWake } = await import('../scenes/flow');
  goBeachWake();
}

/** black screen: muffled heartbeat, a few drifting thoughts */
async function blackout() {
  const box = el('div', '');
  box.style.cssText = 'position:absolute;inset:0;z-index:60;background:#000;display:flex;align-items:center;justify-content:center;pointer-events:none';
  const t = el('div', '');
  t.style.cssText = "font-family:'Jersey 15', 'Pixelify Sans',monospace;font-size:clamp(16px,2.4vw,26px);color:#c8d0d8;letter-spacing:0.08em;opacity:0;transition:opacity 1.2s";
  box.appendChild(t);
  game.ui.root.appendChild(box);
  const beat = () => { audio.play('land', { vol: 0.35, pitch: 0.35 }); setTimeout(() => audio.play('land', { vol: 0.25, pitch: 0.32 }), 260); };
  await wait(1400);
  for (const line of ['...', '...cold...', 'salt... everywhere...', 'Chunk...?']) {
    beat();
    t.textContent = line;
    t.style.opacity = '1';
    await wait(2100);
    t.style.opacity = '0';
    await wait(1100);
  }
  beat();
  await wait(1600);
  setTimeout(() => box.remove(), 1500);
}
