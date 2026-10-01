// The storm. Something massive slams into the Kittiwake; the sky goes black in minutes, lightning,
// mountainous swell, the lights stutter and everything loose starts sliding. In the flash of the
// impact Chunk bolts. Joshu hands out the foul-weather gear, and only then does Mori notice the dog is
// gone: the search leads to the galley, where something is whimpering under the mess table. Carry him
// up to the wheelhouse, and then the rogue wave: a full cinematic as a wall of water rises off the
// bow, curls over the boat... and blackout.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import type { ShipScene4 } from './ship';
import { SPOTS, S4, UNDER_TABLE } from './ship';
import { LADDERS } from '../../art/ship5';
import type { Actor } from '../../world/actor';
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
import { climbFrame } from '../../art/ladder';

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
      // 3 px wide on a 2 px step: the overlap closes sub-pixel gaps when the camera is zoomed out
      // (the light falls off smoothly over the crest: no hard seam where the face meets the back)
      const face = clamp((26 - d) / 52);
      r.draw(g, x, Math.round(top), 0.75, (h + 14) / 64, 0, lit(0.62 + 0.38 * face));
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


// ---------------------------------------------------------------- the storm
// The steps, each of which survives a reload (the flag that marks it done in brackets):
//  1. the calm before, then IMPACT [v4:stormStarted]: in the white flash Chunk bolts and is gone
//  2. Joshu hands out the foul-weather gear in the bunk room [v4:raincoat]; only then does Mori notice
//     that Chunk is missing
//  3. the search: in the galley something whimpers under the mess table, the hanging cloth shakes;
//     look under it [v4:chunkFound] and Mori picks him up
//  4. carry him up the companionway to the wheelhouse: the rogue wave [v4:bridge]

type Lv = 'lower' | 'deck';
const lvOf = (y: number): Lv => (y > S4.lower.ceil ? 'lower' : 'deck');
/** Joshu hands out the gear by the bunk room locker; Jenna waits her turn beside him */
const GEAR_JOSHU = 386, GEAR_JENNA = 408;
/** where Mori crouches to look under the table (just left of it, by the dog bowls) */
const LOOK_X = 279;
/** the wheelhouse: Joshu at the wheel, Jenna holding on behind him */
const helmX = () => SPOTS.helm[0] - 14, JENNA_BRIDGE = 244;

/** this storm's session state (the scene is rebuilt on a reload, and runStorm with it) */
interface StormRun { s: ShipScene4; heard: boolean; crewReady: boolean; whimperT: number; barkT: number; li: number; dead: boolean }
let run: StormRun | null = null;

/** game-time ticker on the scene's stage (dies with the scene) */
function tick(s: ShipScene4, fn: (dt: number) => boolean | void) {
  const u = updater(dt => { if (fn(dt) === false) u.dead = true; });
  s.st.layer('sea-horizon').add(u);
  return u;
}

/** a crew member climbs a ladder (hands on the rungs the whole way) */
function climbActor(s: ShipScene4, a: Actor, L: { x: number; top: number; bottom: number }, dir: 1 | -1): Promise<void> {
  a.stopWalk();
  a.x = L.x;
  a.terrain = null;
  a.y = dir > 0 ? L.top : L.bottom;
  a.setAnim('climb');
  const to = dir > 0 ? L.bottom : L.top;
  let fy = a.y;
  return new Promise(res => tick(s, dt => {
    // turn to the ladder first, then climb with the frame locked to the place on it (rung by rung)
    const d = to - fy, step = a.inTransition ? 0 : 40 * dt;
    a.x = L.x;
    if (a.inTransition || Math.abs(d) > step) {
      fy += Math.sign(d) * step;
      const dd = Math.round(fy - L.top);
      a.y = L.top + dd;
      if (!a.inTransition) a.holdFrame = climbFrame(dd, L.bottom - L.top);
      return;
    }
    a.y = to;
    a.terrain = s.st.terrain;
    a.setAnim(a.idleAnim === 'climb' ? 'idle' : a.idleAnim);
    res();
    return false;
  }));
}

/** walk a crew member anywhere aboard, taking the nearest ladder between decks */
async function moveActor(s: ShipScene4, a: Actor, x: number, lv: Lv, speed = 62) {
  a.idleAnim = 'idle';
  a.terrain = s.st.terrain;
  if (lvOf(a.y) !== lv) {
    const L = [...LADDERS].sort((p, q) => Math.abs(p.x - a.x) + Math.abs(p.x - x) - (Math.abs(q.x - a.x) + Math.abs(q.x - x)))[0];
    await a.walkTo(L.x, speed, speed > 85 ? 'run' : 'walk');
    await climbActor(s, a, L, lv === 'deck' ? -1 : 1);
  }
  await a.walkTo(x, speed, speed > 85 ? 'run' : 'walk');
}

/** stand a crew member somewhere at once */
function put(s: ShipScene4, a: Actor, x: number, y: number, facing: 1 | -1, anim: string) {
  a.stopWalk();
  a.terrain = s.st.terrain;
  a.x = x; a.y = y; a.facing = facing;
  a.idleAnim = anim; a.setAnim(anim);
  a.alpha = 1;
}

/** Chunk has bolted: curled up under the mess table behind the cloth that slid off it */
function hideChunk(s: ShipScene4) {
  const c = s.chunk;
  s.carrying = false;
  s.buddy.mode = 'script';
  s.buddy.reset();
  c.stopWalk();
  c.terrain = s.st.terrain;
  c.x = UNDER_TABLE[0]; c.y = UNDER_TABLE[1]; c.facing = -1; c.z = 45; c.alpha = 1;
  c.idleAnim = 'hide'; c.setAnim('hide');
  c.setExpr('scared');
  s.underTable = { shake: 0, lift: 0 };
}

/** Mori has Chunk in his arms */
function carryChunk(s: ShipScene4) {
  const p = s.player;
  s.buddy.mode = 'script';
  s.chunk.stopWalk();
  s.chunk.alpha = 1;
  s.underTable = null;
  s.carrying = true;
  s.chunk.setExpr('sad');
  p.animMap = { idle: 'carryPupIdle', walk: 'carryPup', run: 'carryPupRun', climb: 'carryPupClimb', crouch: 'carryPupIdle', crouchWalk: 'carryPup', brace: 'carryPupIdle', slip: 'carryPup', jump: 'carryPupIdle', fall: 'carryPupIdle' };
}

/** the quick change: a twirl, a puff of rustling oilskin, a zip, and they're in their storm gear */
async function quickChange(s: ShipScene4, a: Actor, outfit: string) {
  audio.play('rustle', { vol: 0.6 });
  const puff = () => {
    for (let i = 0; i < 16; i++) s.main.particles.spawn({ frame: A.soft, x: a.x + rand.range(-9, 9), y: a.y - rand.range(4, 34), vx: rand.range(-30, 30), vy: rand.range(-30, 4), life: rand.range(0.45, 0.8), size: 0.22, size1: 0.6, color: [0.95, 0.93, 0.85], alpha: 0.75, alpha1: 0 });
  };
  puff();
  a.react('shrink');
  for (let i = 0; i < 4; i++) {
    a.facing = (a.facing * -1) as 1 | -1;
    if (i === 1) { a.outfit = outfit; puff(); a.react('stretch'); }
    await wait(85);
  }
  audio.play('zipper', { vol: 0.55 });
  a.react('bounce');
}

/** Joshu and Jenna make their way down to the locker with the gear */
async function gatherAtLocker(s: ShipScene4) {
  const r = run;
  const L = S4.lower.floor;
  await Promise.all([
    moveActor(s, s.joshu, GEAR_JOSHU, 'lower', 70),
    moveActor(s, s.jenna, GEAR_JENNA, 'lower', 70),
  ]);
  if (r !== run || F()['v4:raincoat']) return;
  put(s, s.joshu, GEAR_JOSHU, L, -1, 'serve');
  put(s, s.jenna, GEAR_JENNA, L, -1, 'scared');
  r!.crewReady = true;
}

/** everyone else up to the wheelhouse (after the gear is handed out) */
async function crewToBridge(s: ShipScene4) {
  const r = run;
  await Promise.all([
    moveActor(s, s.joshu, helmX(), 'deck', 70),
    (async () => { await wait(500); await moveActor(s, s.jenna, JENNA_BRIDGE, 'deck', 70); })(),
  ]);
  if (r !== run || s.phase !== 'storm') return;
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
}

export async function runStorm(s: ShipScene4) {
  if (F()['v4:bridge']) return;
  if (s.phase === 'storm' || s.phase === 'wave') return;
  s.phase = 'storm';
  run = { s, heard: false, crewReady: false, whimperT: 3, barkT: 9, li: 0, dead: false };
  // nobody wanders off on their daily routine from here on
  (s.story as unknown as { crew?: { stop(): void } | null })?.crew?.stop();
  s.sky.birds = false;
  // older saves: Chunk was found before the gear step existed
  if (F()['v4:chunkFound']) F()['v4:raincoat'] = true;
  if (!F()['v4:stormStarted']) await stormIntro(s);
  else restoreStorm(s);
  startQuest('v4storm', true);
  stormLife(s);
  s.hud?.refresh(true);
}

/** the calm before, the impact, Joshu's orders */
async function stormIntro(s: ShipScene4) {
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const p = s.player;
  s.cutscene = true;
  p.cancelWork?.();
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  audio.setMusic('none' as never);
  // Chunk comes and presses against Mori's legs: he can feel it coming
  await Promise.race([s.buddy.come(p.x - p.facing * 16, 70), wait(2600)]);
  s.chunk.stopWalk();
  s.chunk.alpha = 1;
  s.chunk.faceTo(p.x);
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
  game.r.post.flash = 1;
  s.power = 0;
  p.body.react('jump');
  p.body.setExpr('shocked', 2);
  // in the white-out: Chunk bolts, Joshu is thrown at the wheel, Jenna grabs hold of whatever is near
  hideChunk(s);
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  s.joshu.outfit = 'storm';
  s.jenna.stopWalk();
  s.jenna.terrain = s.st.terrain;
  if (s.jenna.y < S4.lower.ceil && s.jenna.y > S4.bridge.floor + 4 && s.jenna.x > S4.bridge.x0 && s.jenna.x < S4.bridge.x1) s.jenna.y = S4.bridge.floor;
  s.jenna.idleAnim = 'scared'; s.jenna.setAnim('scared');
  F()['v4:stormStarted'] = true;
  game.persist();
  await wait(700);
  s.power = 1;
  // the sky turns
  tick(s, dt => {
    if (s.phase !== 'storm' && s.phase !== 'wave') return false;
    s.weather.storm = Math.min(1, s.weather.storm + dt * 0.1);
    audio.setStorm(s.weather.storm);
    return s.weather.storm < 1;
  });
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  await say([
    { who: 'joshu', text: 'WHAT IN THE... Something HIT us! Everyone grab hold of something!', style: 'shout', expr: 'shocked' },
    { who: 'jenna', text: 'Was that a WHALE?! Dad! Was that a WHALE?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'Doesn’t matter what it was! There’s a front coming in behind it, and it’s coming FAST. I’m bringing her about!', style: 'shout', expr: 'determined' },
    { who: 'joshu', text: 'Foul-weather gear, both of you! Oilskins and harnesses, NOW! I’ll lash the wheel and bring them down to the bunk room!', style: 'shout', expr: 'serious' },
    { who: 'mori', text: 'Okay. Okay okay okay. Gear. Bunk room. Everyone’s okay. Everyone’s...', expr: 'worried' },
  ]);
  s.cutscene = false;
  void gatherAtLocker(s);
  game.ui.toast('The deck is pitching! Hold <b>S</b> to brace so you don’t slide. Get your <b>foul-weather gear</b> from Joshu in the <b>bunk room</b>.', 'STORM', 'coral', 6500);
}

/** a reload mid-storm: straight back to where it was */
function restoreStorm(s: ShipScene4) {
  const f = F(), p = s.player, L = S4.lower.floor;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  s.weather.storm = 1;
  audio.setStorm(1);
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  const geared = !!f['v4:raincoat'];
  p.body.outfit = geared ? 'storm' : 'ship';
  s.jenna.outfit = geared ? 'storm' : 'ship';
  s.joshu.outfit = 'storm';
  if (!geared) {
    put(s, s.joshu, GEAR_JOSHU, L, -1, 'serve');
    put(s, s.jenna, GEAR_JENNA, L, -1, 'scared');
    run!.crewReady = true;
  } else {
    put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
    put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  }
  if (f['v4:chunkFound']) {
    carryChunk(s);
    game.ui.toast('Carry Chunk up to the <b>wheelhouse</b> (the companionway ladder in the galley).', 'STORM', 'coral', 5000);
  } else {
    hideChunk(s);
    game.ui.toast(geared ? 'Chunk is missing! Search below deck.' : 'Get your <b>foul-weather gear</b> from Joshu in the <b>bunk room</b>.', 'STORM', 'coral', 5000);
  }
}

/** the storm while you play: loose things sliding, jolts and spray, the search, the trip to the wheelhouse */
function stormLife(s: ShipScene4) {
  const p = s.player, r = run!;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const L = S4.lower.floor;
  // loose things start to slide
  const add = (buf: ReturnType<typeof FU.crate>, n: string, x: number, y: number, x0: number, x1: number) => s.addSlider(buf, n, x, y, x0, x1);
  if (!s.sliders.length) {
    // the dog bowl that used to slide in the mess now sits by the bunks (Chunk's hiding table has the mess)
    add(FU.stool(), 'stool', 360, L, 344, 372);
    add(FU.crate(14, 12), 'crate', 470, L - 6, 434, 492);
    add(FU.bucket(), 'bucket', 90, S4.main.y, 44, 190);
    add(FU.cooler(), 'cooler', 170, S4.main.y, 44, 190);
    add(FU.crate(18, 14, FU.P.plank, true), 'crate2', 400, S4.main.y - 3, 360, 500);
  }
  // storm life: extra jolts, spray over the rails, the whimpering under the table
  let joltT = 5;
  tick(s, dt => {
    if (s.phase !== 'storm' || run !== r) return s.phase === 'wave' ? false : undefined;
    joltT -= dt;
    if (joltT <= 0) {
      joltT = rand.range(5, 9);
      s.jolt += rand.pick([-1, 1]) * rand.range(0.05, 0.1);
      s.st.shake(4, 0.6);
      audio.play('waveCrash', { vol: 0.5 });
      if (s.level() !== 'lower') for (let i = 0; i < 26; i++) s.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-120, 120), y: S4.main.y - rand.range(0, 30), vx: rand.range(-40, 40) - 80, vy: rand.range(-120, -40), ay: 300, life: 1, color: [0.85, 0.92, 1], alpha: 0.9, alpha1: 0, floorY: S4.main.y + 1 });
    }
    const f = F();
    const u = s.underTable;
    if (u) {
      u.shake = Math.max(0, u.shake - dt * 0.9);
      // geared up and searching: the galley's where he is. Walking in, Mori hears him.
      const inGalley = s.level() === 'lower' && p.state !== 'climb' && p.x > 196 && p.x < 340;
      if (f['v4:raincoat'] && !f['v4:chunkFound'] && !r.heard && inGalley && !s.cutscene && !game.ui.blocking) {
        r.heard = true;
        whimper(s, 1);
        p.body.showEmote('question', 2.2);
        p.facing = UNDER_TABLE[0] >= p.x ? 1 : -1;
        game.ui.bubbles.clear();
        s.bark('mori', '...What was that? Something under the table?', { expr: 'surprised' });
      }
      // every so often the cloth trembles and something whimpers (louder close by)
      r.whimperT -= dt;
      if (r.whimperT <= 0 && f['v4:raincoat'] && !f['v4:chunkFound']) {
        r.whimperT = rand.range(3.5, 6);
        const near = s.level() === 'lower' && Math.abs(p.x - UNDER_TABLE[0]) < 150;
        if (near || r.heard) whimper(s, near ? 1 : 0.5);
      }
    }
    // search barks, until he hears him
    if (f['v4:raincoat'] && !f['v4:chunkFound'] && !r.heard) {
      r.barkT -= dt;
      if (r.barkT <= 0) {
        r.barkT = 11;
        const lines = ['Chunk! Buddy! Where are you?!', 'He hates thunder. He hides somewhere small and dark...', 'Not in the bunks... think. Small. Dark. Near food?'];
        if (!game.ui.bubbles.active && !s.cutscene) s.bark('mori', lines[r.li++ % lines.length], { expr: 'worried' });
      }
    }
    // reaching the wheelhouse with Chunk starts the finale
    if (f['v4:chunkFound'] && s.carrying && !s.cutscene && !game.ui.blocking && p.y <= S4.bridge.floor + 2 && p.x > S4.bridge.x0 && p.x < S4.bridge.x1 && p.state !== 'climb' && p.onGround) {
      void rogueWave(s);
      return false;
    }
  });
  // quest markers: the gear, the galley, under the table
  s.questPoints.push({ x: () => (UNDER_TABLE[0] - 20), y: () => L - 40, on: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !F()['v4:chunkFound'] && !r.heard });
  // Joshu hands out the gear
  s.interact.push({
    get x() { return s.joshu.x; }, get y() { return s.joshu.y; }, w: 14, h: 18, label: 'Get your foul-weather gear', get standX() { return s.joshu.x - 20; },
    quest: () => true,
    enabled: () => run === r && s.phase === 'storm' && r.crewReady && !F()['v4:raincoat'] && !s.cutscene,
    action: () => giveGear(s),
  } as unknown as Interactable);
  // look under the table
  s.interact.push({
    x: UNDER_TABLE[0], y: L, w: 16, h: 16, label: 'Look under the table', standX: LOOK_X,
    quest: () => true,
    enabled: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !F()['v4:chunkFound'] && r.heard && !s.cutscene,
    action: () => findChunk(s),
  } as Interactable);
  // Jenna, holding on in the wheelhouse
  s.interact.push({
    get x() { return s.jenna.x; }, get y() { return s.jenna.y; }, w: 14, h: 18, label: 'Jenna!', get standX() { return s.jenna.x + 20; },
    enabled: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !s.cutscene && lvOf(s.jenna.y) === 'deck' && !s.jenna.walking,
    action: () => say([
      { who: 'jenna', text: F()['v4:chunkFound'] ? 'You found him!! Okay! Bridge! Go go go, I’m right behind you!' : 'I’m FINE! I’m totally fine! This is fine! FIND CHUNK!', expr: 'scared', style: 'shout' },
    ]).then(() => {}),
  } as unknown as Interactable);
}

/** a whimper from under the table, and the cloth trembles */
function whimper(s: ShipScene4, k: number) {
  const u = s.underTable;
  if (!u) return;
  u.shake = Math.min(1, u.shake + 0.8 * k);
  audio.play('rustle', { vol: 0.35 * k });
  setTimeout(() => audio.play('callSqueak', { vol: 0.3 * k, pitch: 0.75 }), 180);
  s.chunk.react('tremble');
}

/** Joshu hands out the oilskins; only then does anyone notice who isn't there */
async function giveGear(s: ShipScene4) {
  const p = s.player, jo = s.joshu, je = s.jenna;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  s.cutscene = true;
  p.facing = jo.x >= p.x ? 1 : -1;
  jo.faceTo(p.x);
  await say([
    { who: 'joshu', text: 'Here. Oilskin, harness, boots. Arms up, lad, quick now.', expr: 'serious' },
  ]);
  await quickChange(s, p.body, 'storm');
  await wait(250);
  await say([
    { who: 'joshu', text: 'If you go out on deck you clip that harness on to something. Jenna! Yours.', expr: 'serious' },
  ]);
  je.faceTo(jo.x);
  await quickChange(s, je, 'storm');
  je.idleAnim = 'scared'; je.setAnim('scared');
  await say([
    { who: 'jenna', text: 'It smells like old fish and Dad.', expr: 'scared' },
    { who: 'joshu', text: 'That’s the smell of staying alive. Right: up to the wheelhouse, all of you, where I can see you.', expr: 'determined' },
    { who: 'mori', text: 'Okay. Chunk, come on, buddy, we’re going up...', expr: 'worried' },
  ]);
  // he looks around for him
  p.facing = (p.facing * -1) as 1 | -1;
  await wait(500);
  p.facing = (p.facing * -1) as 1 | -1;
  p.body.showEmote('question', 1.4);
  await say([
    { who: 'mori', text: '...Chunk?', expr: 'worried' },
    { who: 'jenna', text: 'He was right next to you when we got hit!', expr: 'scared' },
    { who: 'mori', text: 'CHUNK?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'He’ll have gone to ground somewhere. Find that dog and bring him up top, Mori. Jenna, with me. NOW.', expr: 'serious', style: 'shout' },
  ]);
  F()['v4:raincoat'] = true;
  game.persist();
  s.hud?.refresh(true);
  run!.barkT = 4;
  s.cutscene = false;
  void crewToBridge(s);
  game.ui.toast('Chunk is missing! Search below deck: he hides somewhere small and dark when it thunders.', 'STORM', 'coral', 6000);
}

async function findChunk(s: ShipScene4) {
  const p = s.player, c = s.chunk;
  s.cutscene = true;
  game.ui.bubbles.clear();
  p.facing = c.x >= p.x ? 1 : -1;
  p.poseOverride = 'kneel';
  // lift the cloth
  const u = s.underTable;
  if (u) {
    audio.play('rustle', { vol: 0.6 });
    await new Promise<void>(res => tick(s, dt => { u.lift = Math.min(1, u.lift + dt * 3); u.shake = 0; if (u.lift >= 1) { res(); return false; } }));
  }
  c.faceTo(p.x);
  c.react('tremble');
  await s.say([
    { who: 'mori', text: 'There you are. Hey. Hey, buddy.', expr: 'worried' },
    { who: 'chunk', text: '*trembling all over*', expr: 'scared', close: false },
    { who: 'mori', text: 'I know. It’s loud. I don’t like it either.', expr: 'sad' },
    { who: 'mori', text: 'C’mere. I’ve got you. I’ve always got you.', expr: 'determined' },
  ]);
  p.poseOverride = null;
  carryChunk(s);
  F()['v4:chunkFound'] = true;
  game.persist();
  s.hud?.refresh(true);
  s.cutscene = false;
  game.ui.toast('Carry Chunk up to the <b>wheelhouse</b> (the companionway ladder in the galley).', 'STORM', 'coral', 6000);
}

/** a reload during the finale: back in the wheelhouse with Chunk in his arms, and here it comes again */
export async function resumeWave(s: ShipScene4) {
  const p = s.player;
  s.phase = 'storm';
  (s.story as unknown as { crew?: { stop(): void } | null })?.crew?.stop();
  s.sky.birds = false;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  s.weather.storm = 1;
  audio.setStorm(1);
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  for (const a of [p.body, s.jenna, s.joshu]) a.outfit = 'storm';
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  p.x = 300; p.y = S4.bridge.floor; p.vx = p.vy = 0; p.facing = 1;
  carryChunk(s);
  s.snapCamera();
  await wait(1200);
  await rogueWave(s);
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
  // Joshu at the wheel, Jenna made it up too (if either is still on the way, they're there now)
  const there = (a: Actor) => !a.walking && a.terrain !== null && Math.abs(a.y - S4.bridge.floor) < 2 && a.x > S4.bridge.x0 && a.x < S4.bridge.x1;
  if (!there(s.joshu)) put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  if (!there(s.jenna)) put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  run = null;
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
