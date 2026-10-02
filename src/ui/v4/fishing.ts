// Fishing off the stern, all in the scene. The camera pulls far out and down so the stern, the sea
// surface and the water below it fill the screen in cross-section (../v9/fishview.ts): fish
// shadows cruise at their own depths, bigger and rarer ones further out and deeper.
//
//  cast    hold (Space, or hold the screen) to wind up: Mori draws the rod back further the longer
//          you hold (the charge swings, so time the release); a dotted arc shows where the float
//          lands and a dashed drop how deep the bait will sink (further = deeper). Land it near a
//          shadow, but not right on top of a shallow one or it bolts
//  wait    the bait sinks; a fish notices it, turns, comes over, hovers and pecks (the float taps),
//          then lunges and drags the float under with a splash: strike right away (press / tap).
//          Strike early and it bolts; too late and it steals the bait. Wind the reel to bring the
//          float back and cast again
//  fight   in the same wide view: spin the on-screen reel (../v9/reel.ts; drag in circles, the mouse
//          wheel, or hold Space) to wind the fish in while it rests, ease off while it runs, or the
//          line snaps (../v6/fishfight.ts). The line goes white, amber, red; the reel shakes; the drag
//          buzzes as it takes line
//  catch   the fish bursts out of the water into Mori's raised hand (he holds it up by the tail in
//          one fist), the camera zooms in with a bounce, sparkles and confetti, a jingle, and the
//          banner: "I caught a SNOUT BASS!" with the pun, the length and stars (../v9/catchshow.ts).
//          The moment is photographed (a zoomed crop of the game frame) for the laptop. Now and then
//          a snout bass has a passenger in its trunk...
//
// goFishing(host) resolves with { fish, len, stars } or null (cancelled / got away). Escape cancels
// at any point before the catch (and skips the show after it).

import { game } from '../../game/game';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import type { Renderer } from '../../gfx/renderer';
import { FightSim, PX_M, REEL_M } from '../v6/fishfight';
import { FishView, Shade, resetViewFrames } from '../v9/fishview';
import { Reel, FishInput } from '../v9/reel';
import { showBanner, catchPhoto, lousePhoto } from '../v9/catchshow';
import { fishIcon, fishSide, louseIcon, louseSide, sidePoint, canvasOf, gripOf } from '../../art/v9/fish';
import { pxIcon, pxRating } from '../pxicons';

export type Temper = 'smooth' | 'dart' | 'sinker' | 'floater' | 'mixed';
export interface FishDef {
  id: string; name: string; sci: string;
  /** fight style */
  temper: Temper;
  /** 0..100 */
  diff: number;
  /** cm */
  len: [number, number];
  /** where it lives: depth (0 just under the surface .. 1 on the bottom) and distance from the stern (0 .. 1 = a full cast) */
  depth: [number, number]; dist: [number, number];
  /** how common */
  weight: number;
  rare?: boolean;
  /** cruising speed px/s, schools */
  speed: number; school?: [number, number];
  /** pecks before the real bite, and how long you have to strike (s) */
  nibbles: [number, number]; window: number;
  /** the catch banner's pun */
  pun: string;
  fact: string;
  parasite?: { id: string; chance: number };
}

export const FISH: FishDef[] = [
  { id: 'bubblepuffer', name: 'Bubble Puffer', sci: 'Physogaster aerophagus', temper: 'floater', diff: 12, len: [14, 26], depth: [0.04, 0.4], dist: [0, 0.55], weight: 1.1, speed: 9, nibbles: [1, 3], window: 1.1, pun: 'I’m so proud I could pop!', fact: 'Gulps air to blow itself up into a floating ball. Captain Bubbles in the tank is one.' },
  { id: 'glassmaomao', name: 'Glass Maomao', sci: 'Scorpis hyalina', temper: 'floater', diff: 24, len: [18, 32], depth: [0.04, 0.32], dist: [0.05, 0.85], weight: 1.0, speed: 20, school: [3, 5], nibbles: [1, 2], window: 0.85, pun: 'I can see right through you!', fact: 'So clear you can count its ribs. Gerald in the tank is one.' },
  { id: 'lanterncod', name: 'Lantern Cod', sci: 'Lychnogadus barbilux', temper: 'smooth', diff: 30, len: [28, 50], depth: [0.45, 0.85], dist: [0, 0.6], weight: 1.0, speed: 10, nibbles: [2, 3], window: 0.95, pun: 'Now that’s a bright idea!', fact: 'Dangles a glowing chin lure in the gloom under the hull and swallows whatever comes to look.' },
  { id: 'snoutbass', name: 'Snout Bass', sci: 'Rhynchoperca radicans', temper: 'sinker', diff: 38, len: [30, 58], depth: [0.7, 1], dist: [0.15, 0.85], weight: 1.0, speed: 12, nibbles: [2, 4], window: 0.9, pun: 'It really nosed its way in!', fact: 'Roots through the sand with a trunk-like snout, sniffing out buried crabs and worms.', parasite: { id: 'snoutlouse', chance: 0.34 } },
  { id: 'sixfinger', name: 'Sixfinger Gurnard', sci: 'Hexadactylus ambulans', temper: 'mixed', diff: 42, len: [24, 42], depth: [0.86, 1], dist: [0.15, 0.8], weight: 0.85, speed: 8, nibbles: [1, 3], window: 0.85, pun: 'It walked right into that one!', fact: 'Walks along the seabed on six finger-like rays, tasting the sand. Grunts when caught.' },
  { id: 'mirrordory', name: 'Mirror Dory', sci: 'Specularia tenuis', temper: 'sinker', diff: 46, len: [24, 48], depth: [0.35, 0.8], dist: [0.35, 1], weight: 0.75, speed: 7, nibbles: [2, 4], window: 0.8, pun: 'Looking good! …Oh wait, that’s me.', fact: 'Paper-thin and mirror-bright: head-on it all but vanishes.' },
  { id: 'hammersnapper', name: 'Hammerbrow Snapper', sci: 'Pagrus malleifrons', temper: 'dart', diff: 55, len: [34, 74], depth: [0.5, 0.95], dist: [0.45, 1], weight: 0.7, speed: 15, nibbles: [2, 4], window: 0.7, pun: 'It really hit the nail on the head!', fact: 'Headbutts shellfish off the rocks with a bony hammer of a brow. The old ones live for decades.' },
  { id: 'spinnaker', name: 'Spinnaker Kahawai', sci: 'Arripis velifer', temper: 'dart', diff: 62, len: [40, 70], depth: [0.06, 0.45], dist: [0.55, 1], weight: 0.6, speed: 28, school: [2, 3], nibbles: [0, 2], window: 0.7, pun: 'Smooth sailing from here!', fact: 'Raises its sail fin to herd baitfish, then sprints. Fights like it has somewhere to be.' },
  { id: 'ribboneel', name: 'Ribbon Eelfish', sci: 'Taeniosoma iridis', temper: 'mixed', diff: 58, len: [60, 120], depth: [0.3, 0.75], dist: [0.4, 1], weight: 0.45, speed: 9, nibbles: [2, 3], window: 0.8, pun: 'That’s a wrap!', fact: 'A silver ribbon with an endless red fin. Sailors took them for sea serpents.' },
  { id: 'sunwheel', name: 'Sun-Wheel Opah', sci: 'Lampris rotasolis', temper: 'smooth', diff: 82, len: [90, 150], depth: [0.55, 1], dist: [0.72, 1], weight: 0.14, rare: true, speed: 11, nibbles: [2, 3], window: 0.75, pun: 'My future’s looking bright!', fact: 'The only warm-blooded fish, spinning its wheel-like fins to keep warm in the deep. A once-in-a-lifetime catch.' },
];
export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map(f => [f.id, f]));

export interface FishCatch { fish: FishDef; len: number; stars: number; parasite?: string }

/** a world-space effect pixel (packed ABGR with alpha); kept for older hosts */
export interface FishFx { x: number; y: number; c: number }

export interface FishingHost {
  player: {
    x: number; y: number; facing: number; poseOverride: string | null; poseFrame?: number | null;
    body: { handPos(): [number, number] | null; headTop(): [number, number]; setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void };
  };
  /** water surface y at world x */
  seaY(x: number): number;
  /** rod tip in world space */
  rodTip(): [number, number];
  /** draw the fishing world (underwater view, shadows, line, float) on a layer in front of the sea */
  setFishDraw(fn: ((r: Renderer) => void) | null): void;
  /** show the catch in Mori's hand (one hand, by the tail; `grip` is the sprite pixel his fist closes on) */
  setHeld?(spr: HeldSprite | null, mode?: 'chest' | 'overhead'): void;
  /** world AABB of the held catch as last drawn, and a sprite pixel of it in world space */
  heldBox?: [number, number, number, number] | null;
  heldPoint?(u: number, v: number): [number, number] | null;
  /** ship-local (the boat plane Mori stands on) → world */
  shipToWorld?(x: number, y: number): [number, number];
  hullLine?(): [number, number][];
  drawHullUnder?(r: Renderer, color: number): void;
  cruise?(): number;
  gear?(): { prop: [number, number]; stern: [number, number]; keel: [number, number][] };
  st: {
    shake(a: number, t: number): void;
    cam: { x: number; y: number; zoom: number; tzoom: number; locked: boolean; tx?: number; ty?: number };
    minX: number; maxX: number; minY: number; maxY: number;
  };
  hud?: { show(on: boolean): void } | null;
  /** the sea: its sun glitter is switched off while the underwater view shows */
  ocean?: { glitter: boolean };
}

export interface FishOpts {
  /** debug: hook this species straight away and go to the fight */
  fish?: string;
  skipTo?: 'fight';
  /** leave the fish in Mori's hand (pose fishHold) when it resolves; the caller clears it with setHeld(null) */
  keepHeld?: boolean;
}

/** the icon of a fish as a pixel canvas (kept for older callers) */
export function fishCanvas(f: FishDef, scale = 3): HTMLCanvasElement {
  return canvasOf(fishIcon(f.id), scale);
}

const CSS = `
.fsh-hint { position: absolute; left: 50%; bottom: max(16px, 5vh); transform: translateX(-50%); z-index: 25; max-width: min(62vw, 640px); text-align: center; pointer-events: none;
  font-family: 'Jersey 15', 'Pixelify Sans', monospace; font-size: clamp(14px, 2vw, 20px); line-height: 1.25; color: rgba(255, 246, 228, 0.95);
  text-shadow: 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.7); opacity: 0; transition: opacity 0.5s; }
.fsh-hint.on { opacity: 1; }
.fsh-hint .key { margin: 0 0.25em !important; }
.fsh-hint b { color: #ffd84a; }
.fsh-hint.warn { color: #ffb0a0; }
`;
let styled = false;

/** rAF loop with dt (s); honours window.__dtCap like the game loop (fast-forwarding slow headless runs) */
function loop(fn: (dt: number) => boolean | void): Promise<void> {
  return new Promise(res => {
    let last = performance.now();
    const step = (now: number) => {
      const cap = (window as unknown as { __dtCap?: number }).__dtCap ?? 0.05;
      const dt = Math.max(0, Math.min(cap, (now - last) / 1000));
      last = now;
      if (fn(dt) === false) { res(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const sleep = (s: number, tick?: (dt: number) => void) => { let t = 0; return loop(dt => { t += dt; tick?.(dt); return t < s; }); };
const phase = (k: string) => { (window as unknown as { __fishPhase?: string }).__fishPhase = k; };
const ease = (u: number) => u * u * (3 - 2 * u);

/** pick a species for a spot (dist 0..1 from the stern, depth 0..1) */
function pickFish(dist: number, depth: number): FishDef | null {
  const pool: [FishDef, number][] = [];
  let sum = 0;
  for (const f of FISH) {
    const dd = dist < f.dist[0] ? f.dist[0] - dist : dist > f.dist[1] ? dist - f.dist[1] : 0;
    const dp = depth < f.depth[0] ? f.depth[0] - depth : depth > f.depth[1] ? depth - f.depth[1] : 0;
    if (dd > 0.2 || dp > 0.25) continue;
    const w = f.weight * (1 - dd * 4) * (1 - dp * 3);
    if (w <= 0) continue;
    pool.push([f, w]);
    sum += w;
  }
  let r = Math.random() * sum;
  for (const [f, w] of pool) { r -= w; if (r <= 0) return f; }
  return pool[0]?.[0] ?? null;
}

export interface HeldSprite { w: number; h: number; px: Uint32Array; grip?: [number, number]; louse?: [number, number] }
/** a fish sprite as the host's held-sprite format (with the louse in its trunk, if any). The grip
 *  (where Mori's fist closes, the wrist of the tail) is found on the straight fish and shared by the
 *  flexed ones so the fish stays put in his hand while it flops */
function heldSprite(f: FishDef, len: number, arch = 0, louse = false, grip?: [number, number]): HeldSprite {
  const px = Math.max(6, (len / 100) * PX_M);
  let b = fishSide(f.id, px, { arch });
  let lp: [number, number] | undefined;
  if (louse) {
    b = b.clone();
    const [lx, ly] = sidePoint(f.id, px, 0.975, 0.11);
    b.blit(louseSide(3), Math.round(lx) - 1, Math.round(ly) - 1);
    lp = [Math.round(lx) + 0.5, Math.round(ly) + 0.5];
  }
  const s: HeldSprite = { w: b.w, h: b.h, px: b.data, louse: lp };
  s.grip = grip ?? gripOf(s);
  return s;
}
/** the straight held sprite of a catch (debug: zl.hold) */
export const holdSprite = (f: FishDef, len: number, louse = false) => heldSprite(f, len, 0, louse);
/** the held fish straight and flexed both ways (a flop plays through these) */
function heldSet(f: FishDef, len: number, louse: boolean) {
  const flat = heldSprite(f, len, 0, louse);
  const g = flat.grip!;
  return { flat, flex: [-0.7, -0.35, 0.35, 0.7].map(a => heldSprite(f, len, a, louse, [g[0], g[1]])) };
}

export async function goFishing(host: FishingHost, o: FishOpts = {}): Promise<FishCatch | null> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const ui = game.ui.modalLayer;
  game.ui.modalOpen++;
  const p = host.player, st = host.st, cam = st.cam;
  resetViewFrames();
  const reel = new Reel(ui);
  const inp = new FishInput(reel);
  let cancelled = false;
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelled = true; } };
  window.addEventListener('keydown', onKey, true);
  host.hud?.show(false);
  const prompts = game.ui.prompts;
  const promptsVis = prompts.style.visibility;
  prompts.style.visibility = 'hidden';
  // ---------------------------------------------------------------- camera: far out and down over the water
  const cam0 = { locked: cam.locked, z: cam.tzoom, minX: st.minX, maxX: st.maxX, minY: st.minY, maxY: st.maxY };
  st.minX = Math.min(st.minX, -2000); st.maxX = Math.max(st.maxX, 1400);
  st.minY = Math.min(st.minY, -600); st.maxY = Math.max(st.maxY, 1000);
  const level = host.seaY(p.x);
  const sternX = p.x + p.facing * 22;
  const VIEW_H = 470;
  const wide = () => {
    const z = 360 / VIEW_H, halfW = game.r.VW / 2 / z;
    return { x: sternX + p.facing * 0.48 * halfW, y: level + VIEW_H / 2 - 0.42 * VIEW_H, z, halfW };
  };
  const view = { ...wide(), zv: 0, spring: 0 };
  let follow: [number, number] | null = null;
  const tickCam = (dt: number) => {
    cam.locked = true;
    const k = Math.min(1, dt * 2.6);
    const tx = follow ? follow[0] : view.x, ty = follow ? follow[1] : view.y;
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    if (view.spring > 0) {
      // a bouncy zoom: a spring that overshoots and settles (substepped so slow frames stay stable)
      for (let n = Math.ceil(dt / (1 / 120)), i = 0; i < n; i++) {
        const h = dt / n;
        view.zv += ((view.z - cam.zoom) * 90 - view.zv * 10) * h;
        cam.zoom += view.zv * h;
      }
    } else cam.zoom += (view.z - cam.zoom) * Math.min(1, dt * 2.2);
    cam.tzoom = cam.zoom;
  };
  // ---------------------------------------------------------------- the world view
  const fv = new FishView(host, level);
  const w0 = wide();
  const tip0 = host.rodTip();
  fv.area = { x0: w0.x - w0.halfW + 24, x1: sternX - 12, tipX: tip0[0], reach: Math.min(560, tip0[0] - (w0.x - w0.halfW) - 70) };
  fv.populate(7, pickFish);
  (window as unknown as { __fishView?: FishView }).__fishView = fv;
  host.setFishDraw(r => fv.draw(r));
  const glitter0 = host.ocean?.glitter ?? true;
  if (host.ocean) host.ocean.glitter = false;
  const hint = el('div', 'fsh-hint');
  ui.appendChild(hint);
  let hintT: ReturnType<typeof setTimeout> | null = null;
  const say = (html: string, ms = 3800, warn = false) => {
    hint.innerHTML = html; hint.classList.add('on'); hint.classList.toggle('warn', warn);
    if (hintT) clearTimeout(hintT);
    hintT = setTimeout(() => hint.classList.remove('on'), ms);
  };
  const touch = matchMedia('(pointer: coarse)').matches;
  const HOLD = touch ? 'hold the screen' : 'hold <span class="key">Space</span>';
  const TAP = touch ? 'tap' : 'press <span class="key">Space</span>';
  const tick = (dt: number) => { inp.update(dt); tickCam(dt); fv.update(dt, pickFish); reel.update(dt, inp.dTurn); };
  let result: FishCatch | null = null;
  let keep = false;
  try {
    // ---------------------------------------------------------------- pull out
    phase('intro');
    p.poseOverride = 'fishWait';
    reel.show(true);
    await sleep(o.skipTo ? 0.3 : 1.1, dt => { tick(dt); fv.under = Math.min(1, fv.under + dt * 1.2); });
    fv.under = 1;
    if (cancelled) return null;
    let hooked: Shade | null = null;
    if (o.fish) {
      // debug: a fish of this species already on the line, mid-water off the stern
      const def = FISH_BY_ID[o.fish] ?? FISH[0];
      fv.shades = fv.shades.filter(s => s.def !== def);
      fv.spawn((dist, depth) => (void dist, void depth, def), false);
      hooked = fv.shades[fv.shades.length - 1];
      hooked.lead = undefined;
      hooked.x = fv.area.tipX - fv.area.reach * 0.55; hooked.y = fv.depthY(hooked.x, (def.depth[0] + def.depth[1]) / 2);
    }
    // ================================================================ cast & wait (until something is hooked)
    let bobX = 0;
    while (!hooked) {
      if (cancelled) return null;
      phase('cast');
      p.poseOverride = 'fishWait';
      p.poseFrame = null;
      inp.keyCrank = false;
      fv.bobber = null; fv.bait = null; fv.line = null;
      reel.gauge = false; reel.tension = 0; reel.line = 0; reel.drag = 0;
      reel.tip('');
      say(`${HOLD[0].toUpperCase() + HOLD.slice(1)} to wind up · let go to cast<br><small>Big fish keep further out and deeper. Cast near a shadow.</small>`, 6000);
      inp.clear();
      let power = 0, dir = 1, charging = false, cast = -1, creak = 0, at = 0;
      const reachOf = (pw: number) => 60 + pw * (fv.area.reach - 60);
      const depthOf = (pw: number) => 40 + pw * 190;
      await loop(dt => {
        if (cancelled) return false;
        tick(dt);
        at += dt;
        if (inp.down) {
          if (!charging) { charging = true; p.body.setExpr('determined'); hint.classList.remove('on'); }
          power += dir * dt * 0.95;
          if (power >= 1) { power = 1; dir = -1; }
          if (power <= 0) { power = 0; dir = 1; }
          p.poseOverride = 'fishCast';
          p.poseFrame = power < 0.34 ? 0 : power < 0.67 ? 1 : 2;
          creak -= dt;
          if (creak <= 0) { creak = 0.16; audio.play('rope', { vol: 0.05 + power * 0.08, pitch: 0.7 + power * 0.9 }); }
          const tip = host.rodTip();
          fv.aim = { tip, x: tip[0] + p.facing * reachOf(power), depth: depthOf(power), t: at };
        } else if (charging) { cast = power; return false; }
        return true;
      });
      fv.aim = null;
      if (cancelled) return null;
      // the throw: the whip forward, then the float arcs out
      audio.play('whoosh', { vol: 0.5 });
      p.body.setExpr('happy', 1.2);
      for (const f of [3, 4, 5]) { p.poseFrame = f; await sleep(0.085, tick); }
      const tip = host.rodTip();
      bobX = tip[0] + p.facing * reachOf(cast);
      const maxDepth = depthOf(cast);
      const arcH = 40 + Math.abs(bobX - tip[0]) * 0.18;
      let fk = 0;
      await loop(dt => {
        tick(dt);
        fk = Math.min(1, fk + dt / (0.55 + cast * 0.4));
        const t2 = host.rodTip();
        const x = t2[0] + (bobX - t2[0]) * fk, y = t2[1] + (host.seaY(bobX) - t2[1]) * fk - Math.sin(fk * Math.PI) * arcH;
        fv.bobber = { x, y, dip: 0, fly: 1 - fk, tilt: fk * 3 };
        fv.line = { tip: t2, to: [x, y], ten: 0.3, sag: 0 };
        return fk < 1;
      });
      audio.play('splash', { vol: 0.4 });
      fv.splash(bobX, 10, 0.8);
      fv.ring(bobX, 1.1);
      fv.plop(bobX);
      p.poseFrame = null;
      p.poseOverride = 'fishWait';
      // ---------------------------------------------------------------- wait for a bite
      phase('wait');
      inp.keyCrank = true;
      inp.clear();
      fv.bait = { x: bobX, y: host.seaY(bobX) + 3, alive: true, depth: maxDepth };
      say(`Wait for the float to go <b>under</b>, then ${TAP} to strike!<br><small>Spin the reel to wind in and cast again.</small>`, 5200);
      let dip = 0, dipV = 0, struck = false, biter: Shade | null = null, waitT = 0, nudged = false, stolen = false, recast = false;
      fv.onEvent = (e, s) => {
        if (e === 'nibble') {
          dipV += 26; fv.ring(fv.bobber!.x, 0.6);
          audio.play('bubble', { vol: 0.2, pitch: 1.3 + Math.random() * 0.3 });
          fv.bubble(fv.bait!.x, fv.bait!.y, 2);
        } else if (e === 'bite') {
          biter = s;
          phase('bite');
          dipV += 80;
          fv.splash(fv.bobber!.x, 22, 1.3); fv.ring(fv.bobber!.x, 1.2); fv.ring(fv.bobber!.x, 0.8);
          audio.play('alert', { vol: 0.5 }); audio.play('splash', { vol: 0.4, pitch: 1.2 });
          p.body.setExpr('surprised', 1);
          p.body.showEmote('exclaim', 1.4);
          st.shake(0.6, 0.2);
        } else if (e === 'stolen') {
          stolen = true; biter = null; phase('wait');
          if (fv.bait) fv.bait.alive = false;
          p.body.showEmote('sweat', 1.4);
          say(`It stole the bait! Spin the reel to wind in and cast again.`, 4000, true);
        } else if (e === 'bored') say('It lost interest…', 2200);
      };
      await loop(dt => {
        if (cancelled) return false;
        tick(dt);
        waitT += dt;
        const b = fv.bait!;
        // the bait sinks to its depth, swaying on the swell
        const surf = host.seaY(fv.bobber?.x ?? bobX);
        if (b.alive || b.y > surf + 3) b.y = Math.min(b.y + dt * 18, surf + b.depth);
        // float: rides the swell; dips spring back; dragged under while a fish has it
        const under = biter && biter.state === 'bite' ? 7 + Math.sin(waitT * 26) * 2 : 0;
        dipV += ((under - dip) * 70 - dipV * 9) * dt;
        dip += dipV * dt;
        if (biter?.state === 'bite' && Math.random() < dt * 18) fv.splash(fv.bobber!.x, 2, 0.6);
        // winding the reel brings the float back toward the stern
        if (inp.crank > 0.05) {
          const v = inp.crank * PX_M * REEL_M;
          bobX = Math.min(fv.area.x1 + 4, bobX + v * dt);
          b.x += (bobX - b.x) * Math.min(1, dt * 3);
          b.y = Math.max(surf + 3, b.y - v * dt * 0.8);
          const eng = fv.engaged();
          if (eng && eng.state !== 'bite' && Math.random() < dt * 0.8) fv.scare(eng);
          if (Math.random() < dt * 6) fv.ring(bobX, 0.4);
          if (bobX >= fv.area.x1) { recast = true; return false; }
        }
        fv.bobber = { x: bobX, y: host.seaY(bobX), dip: Math.max(-1, dip), fly: 0, tilt: Math.sin(waitT * 1.7) * 0.08 + (biter ? 0.4 : 0) };
        fv.line = { tip: host.rodTip(), to: [bobX, host.seaY(bobX) - 3], ten: 0.2, sag: Math.min(18, Math.abs(bobX - host.rodTip()[0]) * 0.07) };
        if (inp.hit()) {
          const eng = fv.engaged();
          if (biter && biter.state === 'bite') { struck = true; return false; }
          if (eng) { fv.scare(eng); say('Too early! Wait until the float goes right under.', 3200, true); }
          dipV -= 30;
          fv.ring(bobX, 0.5);
        }
        if (stolen && !nudged) { nudged = true; }
        if (!stolen && waitT > 22 && !fv.engaged() && Math.floor(waitT) % 22 === 0 && waitT % 22 < dt) say('Nothing biting here… wind in and try casting nearer a shadow.', 3800);
        return true;
      });
      fv.onEvent = null;
      if (cancelled) return null;
      if (recast) { fv.bobber = null; fv.bait = null; fv.line = null; audio.play('splash', { vol: 0.15, pitch: 1.6 }); continue; }
      if (struck && biter) hooked = biter;
    }
    // ================================================================ the fight
    phase('fight');
    const fish = hooked.def;
    hooked.state = 'hooked';
    fv.hooked = hooked;
    fv.bait = null;
    p.poseOverride = 'fishReel';
    p.body.setExpr('determined');
    st.shake(1, 0.2);
    audio.play('whoosh', { vol: 0.45, pitch: 1.4 });
    const [mx0, my0] = fv.mouth(hooked);
    const sim = new FightSim(fish, mx0, my0, { tip: host.rodTip(), surface: x => host.seaY(x), bed: x => fv.bed(x), minX: fv.area.x0, maxX: fv.area.x1 });
    (window as unknown as { __fishSim?: FightSim }).__fishSim = sim;
    inp.keyCrank = true;
    inp.clear();
    reel.gauge = true;
    reel.tip(`${pxIcon('spin')} ${touch ? 'SPIN THE REEL!' : 'SPIN THE REEL! (or hold Space)'}`);
    say(`Hooked! <b>Spin the reel</b> to wind it in · <b>ease off</b> when it runs!`, 4500);
    let ft = 0;
    await loop(dt => {
      if (cancelled) return false;
      tick(dt);
      ft += dt;
      const tip = host.rodTip();
      // the rod bows toward the fish with the strain
      const [fx, fy] = [sim.x, sim.y];
      const dl = Math.hypot(fx - tip[0], fy - tip[1]) || 1;
      const bend = Math.min(1.2, sim.ten) * 6;
      const tipB: [number, number] = [tip[0] + (fx - tip[0]) / dl * bend, tip[1] + (fy - tip[1]) / dl * bend + bend * 0.5];
      sim.world.tip = tip;
      const evs = sim.step(dt, inp.crank);
      for (const e of evs) {
        if (e === 'tell') { st.shake(0.4, 0.15); audio.play('splash', { vol: 0.12, pitch: 0.7 }); fv.bubble(sim.x, sim.y, 4); }
        if (e === 'run') { audio.play('whoosh', { vol: 0.3, pitch: 0.6 }); say('It’s <b>running</b>! Ease off the reel!', 2200, true); reel.tip(''); }
        if (e === 'runEnd') say('It’s tiring… <b>wind it in</b>!', 1800);
        if (e === 'leap') { fv.splash(sim.x, 16, 1.1); audio.play('splashBig', { vol: 0.35 }); }
        if (e === 'splash') { fv.splash(sim.x, 14, 1); fv.ring(sim.x, 1); audio.play('splash', { vol: 0.35 }); }
        if (e === 'strain') { p.body.setExpr('worried', 1.2); }
        if (e === 'idle') say('Keep winding or it’ll shake the hook!', 2200, true);
      }
      // the shadow follows the fish's mouth; in the air it's a real fish
      hooked!.faceT = sim.face;
      hooked!.x = sim.x - Math.sign(hooked!.face || sim.face) * hooked!.px * 0.5;
      hooked!.y = sim.y;
      hooked!.vx = sim.vx; hooked!.vy = sim.vy;
      if (sim.leap >= 0) {
        // nose up out of the water, over the top, nose down back in
        hooked!.alpha = 0;
        fv.flier = { id: fish.id, px: hooked!.px, x: sim.x, y: sim.y, rot: -sim.face * (0.7 - sim.leap * 1.4), flip: sim.face };
      } else { hooked!.alpha = 1; fv.flier = null; }
      // line: rod tip, into the water, down to the mouth
      const surfE = host.seaY(sim.x);
      const ex = tipB[0] + (sim.x - tipB[0]) * Math.max(0, Math.min(1, (surfE - tipB[1]) / Math.max(1, sim.y - tipB[1])));
      const ey = host.seaY(ex);
      if (sim.leap >= 0 || sim.y <= ey + 1) fv.line = { tip: tipB, to: [sim.x, sim.y], ten: sim.ten, sag: (1 - Math.min(1, sim.ten * 1.4)) * 10 };
      else fv.line = { tip: tipB, to: [ex, ey], under: [sim.x, sim.y], ten: sim.ten, sag: (1 - Math.min(1, sim.ten * 1.4)) * 10 };
      fv.bobber = { x: ex + 2, y: ey, dip: 1 + Math.sin(ft * 9) * 0.6, fly: 0, tilt: (sim.x < ex ? -1 : 1) * Math.min(0.8, sim.ten) };
      reel.tension = sim.ten; reel.line = sim.lineOut; reel.drag = sim.drag;
      if (inp.crank > 0.4) reel.tip('');
      (window as unknown as { __fishFight?: unknown }).__fishFight = { t: +ft.toFixed(1), ten: +sim.ten.toFixed(2), stam: +sim.stam.toFixed(2), line: +sim.lineOut.toFixed(1), run: +sim.run.toFixed(2), crank: +inp.crank.toFixed(2), end: sim.end };
      return !sim.end;
    });
    reel.tip('');
    if (cancelled) return null;
    const end = sim.end;
    if (end !== 'caught') {
      // got away: snap, spooled, or spat the hook
      fv.hooked = null; fv.flier = null;
      hooked.state = 'flee'; hooked.t = 0; hooked.wary = 20; hooked.alpha = 1; hooked.faceT = -1;
      if (end === 'snap') { audio.play('whoosh', { vol: 0.6, pitch: 1.8 }); audio.play('wrong', { vol: 0.45 }); st.shake(1.4, 0.3); }
      else audio.play('wrong', { vol: 0.4 });
      fv.line = end === 'snap' ? null : fv.line;
      fv.bobber = null;
      p.poseOverride = 'fishWait';
      p.body.setExpr('sad', 1.5);
      p.body.showEmote('gloom', 1.6);
      reel.gauge = false; reel.tension = 0; reel.drag = 0;
      const nm = fish.name.toLowerCase();
      game.ui.toast(end === 'snap' ? `Snap! The ${nm} broke the line. Ease off the reel when it runs.` : end === 'lost' ? `The ${nm} took all the line! Wind in while it rests.` : `The ${nm} spat the hook. Keep the line tight.`, 'FISHING', 'coral', 3600);
      await sleep(1.4, dt => { tick(dt); if (fv.line) fv.line = null; });
      return null;
    }
    // ================================================================ the catch!
    phase('show');
    const len = hooked.len;
    const q = (len - fish.len[0]) / Math.max(1, fish.len[1] - fish.len[0]);
    const stars = q > 0.8 ? 3 : q > 0.45 ? 2 : 1;
    const louse = fish.parasite && Math.random() < fish.parasite.chance ? fish.parasite.id : undefined;
    result = { fish, len, stars, parasite: louse };
    const V = game.save.vars, F = game.save.flags;
    const isNew = !F['fish:' + fish.id];
    V['v4:fishCaught'] = (V['v4:fishCaught'] ?? 0) + 1;
    F['fish:' + fish.id] = true;
    if (louse) F['parasite:' + louse] = true;
    game.persist();
    reel.show(false);
    hint.classList.remove('on');
    fv.hooked = null;
    fv.shades = fv.shades.filter(s => s !== hooked);
    fv.line = null; fv.bobber = null;
    // it bursts out of the water and flies up into Mori's raised hand
    const from: [number, number] = [sim.x, host.seaY(sim.x)];
    fv.splash(from[0], 30, 1.5); fv.ring(from[0], 1.3); fv.ring(from[0], 0.9);
    audio.play('splashBig', { vol: 0.6 });
    st.shake(0.8, 0.25);
    p.poseOverride = 'fishRaise';
    p.poseFrame = null;
    p.body.setExpr('excited');
    const px = hooked.px;
    const held = heldSet(fish, len, !!louse);
    const W = (x: number, y: number): [number, number] => host.shipToWorld?.(x, y) ?? [x, y];
    const f0 = p.facing >= 0 ? 1 : -1;
    // where it will hang: from the fist, head down
    const hangAt = (): [number, number] => {
      const h = p.body.handPos() ?? p.body.headTop();
      return W(h[0], h[1] - 1.5 + (held.flat.w - held.flat.grip![0]) - held.flat.w / 2);
    };
    let bk = 0;
    await loop(dt => {
      tick(dt);
      bk = Math.min(1, bk + dt / 0.6);
      const to = hangAt();
      const e = ease(bk);
      fv.flier = { id: fish.id, px, x: from[0] + (to[0] - from[0]) * e, y: from[1] + (to[1] - from[1]) * e - Math.sin(bk * Math.PI) * 50, rot: f0 * ((1 - bk) * Math.PI * 2.5 + bk * Math.PI / 2), flip: f0 };
      return bk < 1 && !cancelled;
    });
    fv.flier = null;
    host.setHeld?.(held.flat, 'overhead');
    // the camera bounces in on Mori holding it up high
    const [hx, hy] = p.body.headTop();
    view.x = p.x; view.y = hy + 34; view.z = 2.2; view.spring = 1; view.zv = 0;
    audio.play('catchJingle', { vol: 0.8 });
    const fistW = () => { const h = p.body.handPos() ?? p.body.headTop(); return W(h[0], h[1]); };
    { const [fx, fy] = fistW(); fv.sparkle(fx, fy + 6, 14, 18); fv.confetti(fx, fy - 4, 40, 1); }
    p.body.showEmote('sparkle', 2);
    let flopT = 0.7, flop = 0, showT = 0;
    let photo: Promise<string> | null = null;
    // the photo of the moment: Mori and the fish he's holding up, cropped from the frame
    const snapPhoto = () => {
      if (photo) return photo;
      const fb = host.heldBox;
      const [tx, ty] = W(...p.body.headTop());
      // head and shoulders and the fish: a close, chest-up shot
      const around: [number, number, number, number] = [tx - 12, ty - 4, tx + 12, ty + 30];
      if (fb) { around[0] = Math.min(around[0], fb[0] - 3); around[1] = Math.min(around[1], fb[1] - 3); around[2] = Math.max(around[2], fb[2] + 3); around[3] = Math.max(around[3], fb[3]); }
      const fishBox: [number, number, number, number] = fb ? [fb[0], fb[1], fb[2], fb[3]] : [tx - 6, ty - 10, tx + 6, ty];
      audio.play('shutter', { vol: 0.35 });
      return (photo = catchPhoto(fish, len, around, fishBox));
    };
    const show = (dt: number) => {
      tick(dt);
      showT += dt;
      // the fish flops on his fist now and then; sparkles keep popping round it
      flopT -= dt;
      if (flopT <= 0) { flopT = 0.8 + Math.random() * 1.2; flop = 0.4; if (Math.random() < 0.5) audio.play('splash', { vol: 0.08, pitch: 1.9 }); }
      const mode = p.poseOverride === 'fishHold' ? 'chest' : 'overhead';
      if (flop > 0) {
        flop -= dt;
        const w = flop > 0 ? Math.sin(flop * 28) : 0;
        host.setHeld?.(Math.abs(w) < 0.25 ? held.flat : held.flex[w < -0.6 ? 0 : w < 0 ? 1 : w < 0.6 ? 2 : 3], mode);
      }
      if (Math.random() < dt * 5) { const b = host.heldBox; if (b) fv.sparkle((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 1, 14); }
      // once the bounce has settled and the fish is still: click
      if (showT > 1 && !photo && flop <= 0) void snapPhoto();
    };
    await sleep(0.35, show);
    const meta = `<span>${len} cm</span><span class="st">${pxRating(stars, 3)}</span>${isNew ? '<span class="bd new">NEW!</span>' : ''}${fish.rare ? '<span class="bd rare">RARE</span>' : ''}`;
    const banner = showBanner(fishIcon(fish.id), 'I caught a', fish.name, fish.pun, meta);
    inp.clear();
    const waitBanner = (b: ReturnType<typeof showBanner>) => loop(dt => {
      show(dt);
      if (cancelled) return false;
      if (inp.hit()) { if (b.ready()) return false; b.finish(); }
      return true;
    });
    await waitBanner(banner);
    // skipped through before the shutter went: take it now
    if (!cancelled) await snapPhoto();
    await banner.close();
    if (louse && !cancelled) {
      // ...wait. Something in its trunk is looking back.
      p.body.setExpr('surprised', 1.4);
      p.body.showEmote('question', 1.6);
      audio.play('emoteQuestion', { vol: 0.6 });
      const lp = held.flat.louse ? host.heldPoint?.(held.flat.louse[0], held.flat.louse[1]) : null;
      if (lp) { view.x = lp[0]; view.y = lp[1] + 4; } else view.y = hy + 26;
      view.z = 2.9;
      flop = 0; flopT = 9;
      host.setHeld?.(held.flat, 'overhead');
      await sleep(0.9, show);
      audio.play('discover', { vol: 0.6 });
      const lp2 = held.flat.louse ? host.heldPoint?.(held.flat.louse[0], held.flat.louse[1]) : null;
      if (lp2) { fv.sparkle(lp2[0], lp2[1], 10, 8); void lousePhoto([lp2[0] - 4, lp2[1] - 4, lp2[0] + 4, lp2[1] + 4]); }
      const b2 = showBanner(louseIcon(32), 'Wait… I found a', 'Snout Louse', 'That’s snot what I expected!', '<span>A parasite, riding in its trunk</span><span class="bd new">PARASITE</span>');
      inp.clear();
      await waitBanner(b2);
      await b2.close();
    }
    // settle: lower it to shoulder height, still in the one hand
    view.spring = 0;
    view.z = 1.6;
    view.x = p.x; view.y = hy + 34;
    p.poseOverride = 'fishHold';
    p.poseFrame = null;
    host.setHeld?.(held.flat, 'chest');
    keep = !!o.keepHeld && !cancelled;
    await sleep(0.25, tick);
    return result;
  } finally {
    phase('done');
    inp.dispose();
    reel.dispose();
    window.removeEventListener('keydown', onKey, true);
    hint.remove();
    if (hintT) clearTimeout(hintT);
    // not ending on the close-up: ease back in (fading the water out) before the bounds return
    if (cam.zoom < cam0.z * 0.9) {
      fv.line = null; fv.bobber = null; fv.hooked = null; fv.flier = null;
      let k = 0;
      const z0 = cam.zoom;
      await loop(dt => {
        k = Math.min(1, k + dt / 0.7);
        const e = ease(k);
        cam.locked = true;
        cam.x += ((cam.tx ?? p.x) - cam.x) * Math.min(1, dt * 6) * e;
        cam.y += ((cam.ty ?? cam.y) - cam.y) * Math.min(1, dt * 6) * e;
        cam.zoom = z0 + (cam0.z - z0) * e; cam.tzoom = cam.zoom;
        fv.under = 1 - e;
        return k < 1;
      });
    }
    host.setFishDraw(null);
    if (host.ocean) host.ocean.glitter = glitter0;
    fv.clearFx();
    if (!keep) { host.setHeld?.(null); p.poseOverride = null; }
    p.poseFrame = null;
    game.ui.letterbox(false);
    host.hud?.show(true);
    prompts.style.visibility = promptsVis;
    // hand the camera back (it eases home on its own) and restore the scene bounds
    cam.locked = cam0.locked; cam.tzoom = cam0.z;
    st.minX = cam0.minX; st.maxX = cam0.maxX; st.minY = cam0.minY; st.maxY = cam0.maxY;
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    guardInput(300);
  }
}
