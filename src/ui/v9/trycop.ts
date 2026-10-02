// V9 Trycop close-up: "Examine the Trycop crab" cuts to a full-screen, UI-free pixel shot of the crab
// on a wet basalt ledge at the edge of its rock pool, painted live by the same rig as the world
// sprite at close-up scale (granules, setae, hinged mouthparts, claw denticles, wet speculars). It forages with its fork claw
// and chews, its eyes follow your lens (the pointer), its legs shuffle; froth bubbles at the mouth,
// drips fall from the claws into the water film, which mirrors it; the pool sparkles behind it.
// Space / click takes a photo: the flash startles it into a rearing threat display, and on the
// infected crab that is the only moment you can see the root-barnacle sac under its abdomen.
// Photos go to the raw roll (review and upload them on the laptop). Esc / right-click to leave.

import { openCloseup, CW, CH, hx, mixc, put, blend, ramp, hash, rgb, R, G, B } from '../v6/closeup';
import { loop, wait } from '../v4/mini';
import { Sk } from '../../art/beasts-core';
import { drawTrycop, trycopRest, TrycopPose } from '../../art/v9/wild/trycop';
import { addRawPhoto, PhotoSubject } from '../../game/photos';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { clamp, damp } from '../../core/math';
import type { IslandScene4 } from '../../game/v4/island';
import type { TrycopCrab } from '../../game/v9/trycop';

const K = 4.8, PHI = 0.5;
/** crab origin (ground under the body centre) in the frame */
const OX = 160, OY = 139;
/** the water film on the ledge starts here */
const FILM = 140;

const ROCK = ['#1a1418', '#2a2024', '#3c2e2e', '#504036', '#665240', '#82684e'].map(hx);
const WETR = ['#141a20', '#1e2c34', '#2a4048', '#3a5a60', '#58787a'].map(hx);
const POOL = ['#0e3a44', '#14525a', '#1c6e72', '#2a8a88', '#46a8a0', '#7ccabc', '#b8e8d8'].map(hx);
const FAR = ['#4a4450', '#62585a', '#7c6e66', '#9a8a78', '#b8a68a', '#d8c8a8'].map(hx);
const SKY = ['#8cc0d0', '#a8d4d8', '#c8e4dc', '#e8f0dc', '#fff4dc'].map(hx);
const LICHEN = ['#8a4a14', '#c0701e', '#e09a34', '#f4c060'].map(hx);
const LETTUCE = ['#1e4418', '#2e6424', '#48882e', '#6ea83c', '#9cc858'].map(hx);
const CORAL = ['#5a2a3a', '#8a4052', '#b8607a', '#d888a0'].map(hx);
const BARN = ['#6a6258', '#a09888', '#d0c8b8', '#f0ece0'].map(hx);
const ANEM = ['#4a0a14', '#7a1420', '#b02830', '#e04a48', '#ff8a70'].map(hx);

/** the static part of the shot: bright defocused shore and sky, the pool, the ledge */
function paintBack(tint: number[]): { buf: Uint32Array; wet: Uint8Array } {
  const b = new Uint32Array(CW * CH);
  const wet = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c: number;
    // the pool's far rim: jagged basalt with sunlit facets, the open sea behind it
    const ridge = 66 + Math.sin(x * 0.021 + 1) * 9 + Math.sin(x * 0.057) * 4 + Math.abs(Math.sin(x * 0.11)) * -6 + (hash(x >> 3, 9) - 0.5) * 5;
    if (y >= 50 && y < ridge) {
      c = ramp(['#4a7a98', '#5e92aa', '#7aaabc', '#a8c8d0'].map(hx), 0.6 - (y - 50) / 60 + (Math.sin(x * 0.3 + y) > 0.92 ? 0.3 : 0), x, y);
    } else if (y < ridge) {
      // soft sky and spray, out of focus, the sun up to the left
      const sun = Math.exp(-(((x - 60) / 90) ** 2 + ((y - 10) / 50) ** 2));
      c = ramp(SKY, 0.15 + y / 70 + sun * 0.5 + Math.sin(x * 0.013) * 0.04, x, y);
    } else if (y < 96) {
      // the far rocks of the pool rim, blurred into big soft masses
      // facets: each rock column tilts toward or away from the sun
      const col = Math.floor((x + Math.sin(y * 0.08) * 6) / 14), facet = hash(col, 3) - 0.5;
      const lit = (x - col * 14) / 14 < 0.45 + facet * 0.4 ? 0.18 : -0.05;
      c = ramp(FAR, 0.5 + lit + facet * 0.2 - (y - ridge) / 60, x, y);
      // surf bursting at the foot of the rim
      const foam = Math.sin(x * 0.07 + Math.sin(x * 0.023) * 4) + (hash(x >> 2, y >> 1, 5) - 0.5) * 0.8;
      if (y > 88 && foam > 0.6 - (y - 88) * 0.1) c = mixc(c, hx('#f4f8f0'), 0.7);
    } else if (y < 134) {
      // the rock pool: deep teal, lighter toward us, lazy horizontal light bands
      const t = (y - 96) / 38;
      const band = Math.sin(y * 0.9 + Math.sin(x * 0.05) * 3) > 0.84 ? 0.1 : 0;
      c = ramp(POOL, 0.28 + t * 0.35 + band + Math.sin(x * 0.02 + y * 0.1) * 0.04, x, y);
    } else {
      // the ledge: layered wet basalt, pitted, with a thin film of water toward the front
      const strata = Math.sin(y * 0.55 + Math.sin(x * 0.06) * 2.5);
      const n = hash(x >> 1, y >> 1, 3);
      let v = 0.5 + (strata > 0.7 ? 0.14 : strata < -0.75 ? -0.12 : 0) + (n - 0.5) * 0.16 - (y - 134) / 160;
      if (y < 137) v += 0.22; // the lit lip of the ledge against the pool
      c = ramp(ROCK, v, x, y);
      // orange lichen crusts on the drier rock
      if (y < FILM + 4 && Math.sin(x * 0.15 + Math.sin(y * 0.4) * 2) * Math.sin(x * 0.031 + y * 0.12) > 0.55) c = ramp(LICHEN, 0.4 + (n - 0.5) * 0.6, x, y);
      if (y >= FILM) { c = mixc(c, ramp(WETR, 0.35 + (y - FILM) / 70, x, y), 0.55); wet[y * CW + x] = 1; }
    }
    b[y * CW + x] = c;
  }
  // big bokeh discs of sun on the spray and the pool
  for (let i = 0; i < 22; i++) {
    const cx = hash(i, 1, 9) * CW, cy = i < 12 ? 20 + hash(i, 2, 9) * 70 : 98 + hash(i, 2, 9) * 30;
    const r = i < 12 ? 5 + hash(i, 3, 9) * 9 : 2 + hash(i, 3, 9) * 4;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1 || x < 0 || y < 0 || x >= CW || y >= 134) continue;
      blend(b, x, y, hx('#e8f4f0'), (d > 0.82 ? 0.28 : 0.14) * (i < 12 ? 1 : 0.8));
    }
  }
  // tufts of sea lettuce and pink coralline crust along the ledge; barnacles and limpets
  const blob = (cx: number, cy: number, rx: number, ry: number, pal: number[], seed: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (hash(x, y, seed) - 0.5) * 0.5;
      if (q > 1 || x < 0 || y < 0 || x >= CW || y >= CH) continue;
      b[y * CW + x] = ramp(pal, 0.75 - ((y - cy) / ry) * 0.4 - q * 0.3, x, y);
    }
  };
  for (const [x, y, rx, ry] of [[18, 140, 22, 6], [300, 138, 26, 7], [250, 168, 14, 5], [44, 170, 18, 5]] as const) blob(x, y, rx, ry, LETTUCE, x);
  for (const [x, y, rx, ry] of [[92, 141, 12, 3], [214, 143, 16, 3], [130, 176, 20, 3], [280, 152, 10, 3]] as const) blob(x, y, rx, ry, CORAL, x + 1);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 5, 4) * CW), y = Math.floor(137 + hash(i, 6, 4) * 38);
    if (Math.abs(x - OX) < 70 && y > 142) continue;
    const r = 1.5 + hash(i, 7, 4) * 2;
    for (let yy = -Math.ceil(r); yy <= r; yy++) for (let xx = -Math.ceil(r); xx <= r; xx++) {
      const d = Math.hypot(xx, yy * 1.3) / r;
      if (d > 1) continue;
      put(b, x + xx, y + yy, d < 0.35 ? BARN[0] : ramp(BARN, 0.8 - yy / r * 0.3 - d * 0.3, x + xx, y + yy));
    }
  }
  if (tint[0] !== 1 || tint[1] !== 1 || tint[2] !== 1) for (let i = 0; i < b.length; i++) { const v = b[i]; b[i] = rgb(R(v) * tint[0], G(v) * tint[1], B(v) * tint[2]); }
  return { buf: b, wet };
}

interface Bubble { x: number; y: number; vx: number; vy: number; r: number; life: number }
interface Drop { x: number; y: number; vy: number }
interface Ring { x: number; y: number; t: number }

/** time-of-day tint for the shot */
function tintFor(s: IslandScene4): number[] {
  const t = s.clock.t;
  if (t < 2.2) return [1, 1, 1];
  if (t < 2.75) return [1.05, 0.92, 0.8];
  if (t < 3.4) return [0.9, 0.72, 0.78];
  return [0.45, 0.52, 0.72];
}

/** open the close-up for this crab; resolves when the player leaves */
export async function examineTrycop(s: IslandScene4, crab: TrycopCrab | null): Promise<void> {
  const parasite = crab?.spec.parasite ?? true;
  const hue = crab?.spec.hue ?? 0.3;
  const cu = openCloseup();
  s.cam.raise(false);
  const tint = tintFor(s);
  const back = paintBack(tint);
  const buf = cu.buf;
  const P: TrycopPose = trycopRest();
  // lens (pointer) in 0..1
  let mx = 0.5, my = 0.5, lastMove = 0, startle = 0, flash = 0, clock = 0;
  let threat = 0, threatT = 0, idleT = 0, walkT = 0, walkDir = 1, gaitPh = 0;
  let feed = 0, chew = 0, scrape = 3, blinkEye = -1, blinkT = 2, shuffleT = 1, shuffleLeg = -1;
  let bubbleT = 0, dripT = 1.4, shots = 0, parasiteSeen = false, parasiteShot = false;
  const bubbles: Bubble[] = [], drops: Drop[] = [], rings: Ring[] = [];
  let crabBuf: Uint32Array | null = null, crabBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let out: ReturnType<typeof drawTrycop> | null = null;
  let renderT = 0;
  let ended = false;
  cu.hint('<span class="key">Space</span> or click: photograph · move to look · <span class="key">Esc</span>: back', 5200);
  setTimeout(() => { if (!cu.closed) cu.say('Mori', 'Hold still, beautiful. Let me get your good side.', { color: '#4a6a2a', ms: 3000 }); }, 900);

  const shoot = () => {
    if (ended) return;
    const cam = s.cam;
    if (cam.shots <= 0) { audio.play('wrong', { vol: 0.5 }); cu.hint('Film is full. Review your shots on the laptop.', 2600); return; }
    cam.shots--;
    shots++;
    audio.play('shutter');
    // capture this exact frame, then the flash goes off
    const subjects: PhotoSubject[] = [];
    const fb = (b: { x0: number; y0: number; x1: number; y1: number }): [number, number, number, number] => [clamp(b.x0 / CW), clamp(b.y0 / CH), clamp(b.x1 / CW), clamp(b.y1 / CH)];
    const cx = (crabBox.x0 + crabBox.x1) / 2 / CW, cy = (crabBox.y0 + crabBox.y1) / 2 / CH;
    const thirds = Math.min(...[[0.5, 0.5], [1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]].map(([qx, qy]) => Math.hypot(cx - qx, cy - qy)));
    const beh = threat > 0.5 ? 'threat' : P.fork.ext > 0.5 ? 'foraging' : walkT > 0 ? 'scuttling' : null;
    const inF = (b: typeof crabBox) => clamp(((Math.min(b.x1, CW) - Math.max(b.x0, 0)) * (Math.min(b.y1, CH) - Math.max(b.y0, 0))) / Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0)));
    subjects.push({
      species: 'trycop', behavior: beh, bbox: fb(crabBox), visible: 1, inFrame: inF(crabBox), focus: 1, motion: P.crush.reach > 0.3 ? 0.7 : 0.97, shake: 1,
      size: clamp((crabBox.y1 - crabBox.y0) / CH), facing: 1, centre: clamp(1 - thirds / 0.3), noticed: threat > 0.5, juvenile: false, group: 1,
    });
    if (out?.sac && threat > 0.5) {
      const sx = OX + out.sac[0], sy = OY + out.sac[1];
      const sb = { x0: sx - 3.4 * K, y0: sy - 2.2 * K, x1: sx + 3.4 * K, y1: sy + 2.2 * K };
      subjects.push({ species: 'rootbarnacle', behavior: 'attached', bbox: fb(sb), visible: 0.9, inFrame: inF(sb), focus: 1, motion: 1, shake: 1, size: clamp((sb.y1 - sb.y0) / CH * 2.2), facing: 1, centre: 0.6, noticed: false, juvenile: false, group: 1 });
      parasiteShot = true;
    }
    const img = cu.cv.toDataURL('image/jpeg', 0.86);
    const light = s.tod === 'night' ? 0.45 : s.tod === 'dusk' ? 0.8 : 1;
    const photo = addRawPhoto({ img, site: 'coast', time: s.tod, day: game.save.day, video: false, light, subjects, af: 'trycop', notes: ['Close-up'] });
    void photo;
    flash = 1;
    cu.flash();
    // the flash startles it: up it rears, claws high
    startle = 1;
    threat = Math.max(threat, 0.01);
    threatT = 3.4;
    walkT = 0;
    import('../../game/v9/wildlife').then(m => m.countPhoto(s, subjects.map(x => x.species))).catch(() => {});
    if (shots === 1 && !parasite) setTimeout(() => { if (!cu.closed) cu.say('Mori', 'Every spot has a ring round it, like a little eye. Warning paint, maybe?', { color: '#4a6a2a', ms: 3800 }); }, 1400);
    if (parasiteShot && !parasiteSeen) { parasiteSeen = true; setTimeout(() => { if (!cu.closed) cu.say('Mori', 'Got it! That sac is a parasite. A barnacle that grows ROOTS right through its host.', { color: '#4a6a2a', ms: 4400 }); }, 1200); }
  };

  const kd = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); ended = true; }
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) shoot(); }
  };
  const pm = (e: PointerEvent) => {
    const r = cu.cv.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width), ny = clamp((e.clientY - r.top) / r.height);
    const sp = Math.hypot(nx - mx, ny - my);
    if (sp > 0.08) startle = Math.max(startle, 0.35);
    mx = nx; my = ny;
    lastMove = clock;
  };
  const pd = (e: PointerEvent) => { if (e.button === 2) { ended = true; return; } if (e.button === 0) shoot(); };
  const cm = (e: Event) => e.preventDefault();
  window.addEventListener('keydown', kd, true);
  cu.wrap.addEventListener('pointermove', pm);
  cu.wrap.addEventListener('pointerdown', pd);
  cu.wrap.addEventListener('contextmenu', cm);

  await new Promise<void>(resolve => {
    loop((dt) => {
      if (cu.closed) { resolve(); return false; }
      if (ended) { resolve(); return false; }
      clock += dt;
      flash = Math.max(0, flash - dt * 3);
      startle = Math.max(0, startle - dt * 1.6);
      // ---- behaviour
      threatT -= dt;
      const wantThreat = threatT > 0 ? 1 : 0;
      threat = damp(threat, wantThreat, wantThreat ? 7 : 2.5, dt);
      if (threat > 0.6 && parasite && !parasiteSeen && out?.sac) {
        parasiteSeen = true;
        cu.say('Mori', 'Wait. What is that orange sac under it?', { color: '#4a6a2a', ms: 3200 });
      }
      idleT += dt;
      if (idleT > 9 && walkT <= 0 && threat < 0.1) { walkT = 2.4; walkDir = Math.random() < 0.5 ? -1 : 1; idleT = 0; }
      walkT -= dt;
      const walking = walkT > 0 && threat < 0.2;
      if (walking) gaitPh += dt * 1.6;
      // feeding: reach, pinch, lift, chew
      if (threat < 0.2 && !walking) feed += dt / 2.4;
      const f = feed % 1;
      const feeding = threat < 0.2 && !walking;
      P.fork.ext = damp(P.fork.ext, feeding ? (f < 0.86 ? 1 : 0.4) : 0, 8, dt);
      P.fork.open = damp(P.fork.open, f < 0.3 ? 1 : f < 0.42 ? 0.1 : 0.05, 14, dt);
      P.fork.lift = damp(P.fork.lift, f < 0.42 ? 0 : f < 0.72 ? (f - 0.42) / 0.3 : 1, 10, dt);
      P.fork.side = damp(P.fork.side, Math.sin(clock * 0.4) * 0.7, 2, dt);
      chew = f > 0.68 && feeding ? 0.55 + Math.sin(clock * 16) * 0.45 : 0.18 + Math.sin(clock * 2.1) * 0.12;
      P.mouth = damp(P.mouth, threat > 0.4 ? 0.7 + Math.sin(clock * 9) * 0.25 : chew, 14, dt);
      P.froth = damp(P.froth ?? 0, threat > 0.4 ? 1 : chew > 0.6 ? 0.5 : 0.15, 3, dt);
      scrape -= dt;
      const scraping = scrape < 0 && feeding;
      if (scrape < -1.2) scrape = 4 + Math.random() * 4;
      // claws
      const cr = threat > 0.05 ? threat : startle * 0.4;
      P.crush.raise = damp(P.crush.raise, cr + (walking ? 0.12 : 0), 8, dt);
      P.crush.open = damp(P.crush.open, threat > 0.4 ? 0.75 + Math.sin(clock * 6.6) * 0.25 : 0.12 + Math.sin(clock * 0.8) * 0.05, 10, dt);
      P.cut.raise = damp(P.cut.raise, scraping ? -0.45 : cr * 0.95 + (walking ? 0.1 : 0), 7, dt);
      P.cut.open = damp(P.cut.open, scraping ? 0.5 + Math.sin(clock * 13) * 0.4 : threat > 0.4 ? 0.85 + Math.sin(clock * 5.2 + 1) * 0.15 : 0.08, 10, dt);
      P.rear = damp(P.rear, threat * 0.92, 6, dt);
      P.low = damp(P.low, feeding ? 0.4 : 0.1, 3, dt);
      // gait
      P.step = damp(P.step, walking ? 1 : 0, 6, dt);
      P.dir = walkDir;
      P.gait = gaitPh;
      P.bob = walking ? Math.cos(gaitPh * Math.PI * 4) * 0.3 : Math.sin(clock * 1.5) * 0.18 + startle * 0.6;
      P.roll = walking ? Math.sin(gaitPh * Math.PI * 2) * 0.035 : damp(P.roll, (mx - 0.5) * 0.06, 2, dt);
      P.flick += dt * (4 + Math.sin(clock) * 2);
      P.t = clock;
      // eyes follow the lens; they duck when the lens jerks about
      blinkT -= dt;
      if (blinkT < 0) { blinkT = 2 + Math.random() * 3; blinkEye = Math.random() < 0.5 ? 0 : 1; }
      for (let i = 0; i < 2; i++) {
        const e = P.eyes[i];
        const look = (mx - 0.5) * 1.5 + (i ? 0.08 : -0.08);
        e.sw = damp(e.sw, clock - lastMove < 3 ? look : Math.sin(clock * 0.6 + i) * 0.5, 8, dt);
        e.fold = damp(e.fold, startle > 0.5 ? 0.6 : blinkEye === i && blinkT > 1.75 ? 0.5 : 0, 16, dt);
      }
      shuffleT -= dt;
      if (shuffleT < 0) { shuffleT = 0.7 + Math.random() * 2; shuffleLeg = Math.floor(Math.random() * 8); }
      for (let i = 0; i < 8; i++) P.shuffle[i] = damp(P.shuffle[i], i === shuffleLeg && shuffleT > 0.45 && !walking ? 1.4 : 0, 14, dt);
      // ---- froth, drips, rings
      bubbleT -= dt;
      if (out && bubbleT < 0) {
        bubbleT = 0.08 + Math.random() * (threat > 0.4 ? 0.1 : 0.35);
        const m = out.mouth;
        bubbles.push({ x: OX + m[0] + (Math.random() - 0.5) * 8, y: OY + m[1] + 2, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 8, r: 0.8 + Math.random() * (threat > 0.4 ? 2.6 : 1.6), life: 1.2 + Math.random() * 1.8 });
      }
      for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 3 * dt; b.vx *= 0.98; b.life -= dt; }
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0) bubbles.splice(i, 1);
      dripT -= dt;
      if (out && dripT < 0) {
        dripT = 0.7 + Math.random() * 1.8;
        const tip = Math.random() < 0.5 ? out.crushTip : out.cutTip;
        drops.push({ x: OX + tip[0], y: OY + tip[1], vy: 10 });
      }
      for (const d of drops) { d.vy += 260 * dt; d.y += d.vy * dt; }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].y > FILM + 6 + (i % 3) * 5) { rings.push({ x: drops[i].x, y: drops[i].y, t: 0 }); drops.splice(i, 1); }
      for (const r of rings) r.t += dt;
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i].t > 1.2) rings.splice(i, 1);
      // ---- paint the crab (about 30 fps is plenty)
      renderT -= dt;
      if (renderT <= 0 || !crabBuf) {
        renderT = 1 / 30;
        const sk = new Sk(CW, CH, OX, OY);
        out = drawTrycop(sk, P, { k: K, phi: PHI, detail: 2, parasite, hue });
        const cb = sk.resolve({ rim: 0.12, bounce: 0.08 });
        crabBuf = cb.data;
        let x0 = CW, y0 = CH, x1 = 0, y1 = 0;
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (crabBuf[y * CW + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        crabBox = { x0, y0, x1, y1 };
      }
      // ---- composite
      buf.set(back.buf);
      // shimmer on the pool and caustic light sliding over the wet ledge
      for (let y = 97; y < 134; y += 1) for (let x = (y * 7 + Math.floor(clock * 30)) % 9; x < CW; x += 9) {
        const w = Math.sin(x * 0.07 + clock * 2.1 + y * 0.9) + Math.sin(x * 0.023 - clock * 1.3);
        if (w > 1.62) blend(buf, x, y, hx('#bfe8e0'), (w - 1.62) * 2.2 * tint[1]);
      }
      for (let y = FILM; y < CH; y++) for (let x = 0; x < CW; x += 1) {
        const c = Math.sin(x * 0.09 + Math.sin(y * 0.35 + clock * 1.4) * 2 + clock * 0.9) + Math.sin(x * 0.041 - y * 0.2 - clock * 1.1);
        if (c > 1.55) blend(buf, x, y, hx('#a8d0cc'), (c - 1.55) * 0.5 * tint[1]);
      }
      // the crab's reflection in the water film (mirrored about its feet, rippled and darkened)
      if (crabBuf) {
        for (let y = FILM; y < CH; y++) {
          const sy = 2 * OY - y + 2 + Math.round(Math.sin(y * 0.8 + clock * 3) * 0.6);
          if (sy < 0 || sy >= CH) continue;
          const wob = Math.round(Math.sin(y * 0.45 + clock * 2.4) * 1.2 * ((y - FILM) / 30 + 0.2));
          for (let x = crabBox.x0; x <= crabBox.x1; x++) {
            const sx = x + wob;
            if (sx < 0 || sx >= CW) continue;
            const c = crabBuf[sy * CW + sx];
            if (!(c >>> 24) || !back.wet[y * CW + x]) continue;
            blend(buf, x, y, mixc(c, hx('#16323a'), 0.45), 0.55 - (y - FILM) / 90);
          }
        }
        // a soft contact shadow under the body
        for (let y = OY - 3; y < OY + 8; y++) for (let x = OX - 52; x < OX + 52; x++) {
          const d = ((x - OX) / 52) ** 2 + ((y - OY - 2) / 6) ** 2;
          if (d < 1) blend(buf, x, y, hx('#08080a'), (1 - d) * 0.5);
        }
        for (let i = 0; i < crabBuf.length; i++) {
          const c = crabBuf[i];
          if (!(c >>> 24)) continue;
          buf[i] = tint[0] === 1 && tint[1] === 1 ? c : rgb(R(c) * tint[0], G(c) * tint[1], B(c) * tint[2]);
        }
      }
      // drips and their rings in the film
      for (const d of drops) { put(buf, d.x, d.y, hx('#e8f8ff')); put(buf, d.x, d.y + 1, hx('#9ad0e0')); }
      for (const r of rings) {
        const rr = 1 + r.t * 9, a = (1 - r.t / 1.2) * 0.6;
        for (let q = 0; q < 24; q++) { const an = (q / 24) * Math.PI * 2; blend(buf, r.x + Math.cos(an) * rr, r.y + Math.sin(an) * rr * 0.3, hx('#d8f0f0'), a); }
      }
      // froth at the mouth
      for (const b of bubbles) {
        const rr = b.r;
        for (let y = -Math.ceil(rr); y <= rr; y++) for (let x = -Math.ceil(rr); x <= rr; x++) {
          const d = Math.hypot(x, y) / rr;
          if (d > 1) continue;
          if (d > 0.62) blend(buf, b.x + x, b.y + y, hx('#e8f4f8'), 0.75);
          else if (x < 0 && y < 0 && d < 0.4) blend(buf, b.x + x, b.y + y, 0xffffffff, 0.9);
          else blend(buf, b.x + x, b.y + y, hx('#bcdce4'), 0.12);
        }
      }
      // wet glints twinkling on the ledge
      for (let i = 0; i < 18; i++) {
        const ph = (clock * 0.7 + hash(i, 1, 77)) % 1;
        if (ph > 0.12) continue;
        const x = Math.floor(hash(i, Math.floor(clock * 0.7 + hash(i, 1, 77)), 78) * CW), y = Math.floor(138 + hash(i, 3, 78) * 40);
        const a = 1 - ph / 0.12;
        blend(buf, x, y, 0xffffffff, a);
        blend(buf, x - 1, y, 0xffffffff, a * 0.5); blend(buf, x + 1, y, 0xffffffff, a * 0.5); blend(buf, x, y - 1, 0xffffffff, a * 0.5); blend(buf, x, y + 1, 0xffffffff, a * 0.5);
      }
      // a beadlet anemone on the ledge at the left: a glossy red dome crowned with swaying tentacles
      {
        const ax = 40, ay = 150;
        for (let tn = 0; tn < 22; tn++) {
          const u = tn / 21, a = -Math.PI + 0.25 + u * (Math.PI - 0.5) + Math.sin(clock * 1.2 + tn * 0.5) * 0.12;
          const bx = ax + Math.cos(a) * 9, by = ay - 6 + Math.sin(a) * 2.2;
          for (let q = 0; q < 9; q++) {
            const L = q * 0.85, bend = Math.sin(clock * 1.6 + tn + q * 0.3) * q * 0.06;
            const tx = bx + Math.cos(a + bend) * L * 0.6, ty = by + Math.sin(a + bend) * L - q * 0.4;
            put(buf, tx, ty, q > 6 ? ANEM[4] : ANEM[Math.min(3, 1 + (q >> 1))]);
          }
        }
        for (let y = ay - 8; y < ay + 3; y++) for (let x = ax - 11; x <= ax + 11; x++) {
          const d = ((x - ax) / 11) ** 2 + ((y - ay + 2) / 6) ** 2;
          if (d >= 1 || y > ay + 2) continue;
          put(buf, x, y, d > 0.86 ? ANEM[0] : ramp(ANEM, 0.72 - (x - ax) / 26 - (y - ay + 6) / 14, x, y));
        }
        // the blue beads round its collar
        for (let b = 0; b < 5; b++) put(buf, ax - 8 + b * 4, ay - 5 + Math.abs(b - 2) * 0.6, hx('#5ab8f0'));
      }
      // vignette, and the camera flash washing over everything
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const d = ((x - CW / 2) / (CW * 0.62)) ** 2 + ((y - CH / 2) / (CH * 0.7)) ** 2;
        if (d < 0.55 && flash <= 0) continue;
        const i = y * CW + x, v = buf[i];
        let c = v;
        if (d >= 0.55) { const kk = Math.min(0.55, (d - 0.55) * 0.8); c = rgb(R(v) * (1 - kk), G(v) * (1 - kk), B(v) * (1 - kk * 0.8)); }
        if (flash > 0) c = mixc(c, 0xffffffff, flash * 0.75);
        buf[i] = c;
      }
      cu.present();
      return true;
    });
  });
  window.removeEventListener('keydown', kd, true);
  cu.wrap.removeEventListener('pointermove', pm);
  cu.wrap.removeEventListener('pointerdown', pd);
  cu.wrap.removeEventListener('contextmenu', cm);
  if (shots) cu.hint(`${shots} close-up photo${shots > 1 ? 's' : ''} on the roll`, 1400);
  await wait(shots ? 500 : 0);
  await cu.close();
  s.hud?.refresh(true);
  if (shots && !game.ui.bubbles.active) s.bark('mori', parasiteShot ? 'Crab AND parasite. That is going straight on the laptop.' : 'Beautiful. The laptop is going to love these.', { expr: 'happy' });
}
