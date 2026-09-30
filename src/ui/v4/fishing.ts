// Fishing off the stern, played in the scene rather than in a popup. Hold to wind up: Mori draws the
// rod back further the longer you hold (the charge swings, so time the release), and a dotted arc
// over the water shows where the cast will land. Let go to whip it out; the bobber arcs into the
// sea and rides the swell. Nibbles tap it; on the real bite it's yanked under with a splash: strike
// right away. Then the camera cuts under the boat for the fight (see ../v6/fishfight.ts), and a
// landed fish comes back up in Mori's hands. Each fish has its own temper: smooth, darting,
// sinking, floating or a bit of everything, and the harder ones run more often and harder.

import { game } from '../../game/game';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { Hold, loop, wait } from './mini';
import { runFishFight, fishSprite } from '../v6/fishfight';

export type Temper = 'smooth' | 'dart' | 'sinker' | 'floater' | 'mixed';
export interface FishDef {
  id: string; name: string; maori?: string; temper: Temper; diff: number; len: [number, number];
  cols: [string, string, string]; shape: 'round' | 'long' | 'flat' | 'moon'; rare?: boolean; fact: string;
}

export const FISH: FishDef[] = [
  { id: 'bluecod', name: 'Blue Cod', maori: 'Rāwaru', temper: 'smooth', diff: 22, len: [28, 45], cols: ['#3a6ab0', '#6a9ad8', '#e8e0c8'], shape: 'round', fact: 'Curious and bold. Will swim right up to a diver to see what they’re doing.' },
  { id: 'gurnard', name: 'Red Gurnard', maori: 'Kumukumu', temper: 'mixed', diff: 34, len: [25, 40], cols: ['#c8402e', '#f07050', '#f8d8a0'], shape: 'long', fact: 'Walks on the seabed with finger-like fins, and grunts when you catch it.' },
  { id: 'tarakihi', name: 'Tarakihi', temper: 'smooth', diff: 30, len: [25, 42], cols: ['#8a98a8', '#c8d4e0', '#2a2630'], shape: 'flat', fact: 'Silver with a black saddle behind its head, like it’s wearing a tiny cape.' },
  { id: 'kahawai', name: 'Kahawai', temper: 'dart', diff: 55, len: [35, 60], cols: ['#4a7a6a', '#8ab8a0', '#e8f0e8'], shape: 'long', fact: 'Fights like it has somewhere very important to be.' },
  { id: 'snapper', name: 'Snapper', maori: 'Tāmure', temper: 'mixed', diff: 45, len: [30, 70], cols: ['#d87a6a', '#f4b0a0', '#5ac8e8'], shape: 'round', fact: 'Pink with tiny electric-blue spots. The big old ones can live 60 years.' },
  { id: 'johndory', name: 'John Dory', maori: 'Kuparu', temper: 'sinker', diff: 48, len: [25, 50], cols: ['#a8a088', '#d8d0b0', '#2a2630'], shape: 'flat', fact: 'Paper-thin, with a dark "thumbprint" spot. Sneaks up on prey head-on.' },
  { id: 'maomao', name: 'Blue Maomao', temper: 'floater', diff: 32, len: [20, 32], cols: ['#2a58c0', '#4a88f0', '#8ac0ff'], shape: 'round', fact: 'Travels in electric-blue schools near the surface. Gerald in the tank is one.' },
  { id: 'opah', name: 'Opah', maori: 'Moonfish', temper: 'dart', diff: 78, len: [80, 140], cols: ['#c8505a', '#f08a8a', '#f4d8e0'], shape: 'moon', rare: true, fact: 'The only fish known to be warm-blooded all over. A once-in-a-lifetime catch.' },
];

export interface FishCatch { fish: FishDef; len: number; stars: number }

/** a world-space effect pixel (packed ABGR with alpha) */
export interface FishFx { x: number; y: number; c: number }

export interface FishingHost {
  player: { x: number; y: number; facing: number; poseOverride: string | null; poseFrame?: number | null; body: { handPos(): [number, number] | null; setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void } };
  /** water surface y at world x */
  seaY(x: number): number;
  /** rod tip in world space */
  rodTip(): [number, number];
  /** show / move / hide the bobber and line in the world */
  setBobber(b: { x: number; y: number; dip: number; fly: number } | null): void;
  /** optional: draw these effect pixels in the world each frame (cast preview, ripples, splashes) */
  setFx?(px: FishFx[] | null): void;
  /** optional: show the catch in Mori's hands */
  setHeld?(spr: { w: number; h: number; px: Uint32Array } | null): void;
  st: { shake(a: number, t: number): void; cam?: { x: number; y: number; zoom: number; tzoom: number; locked: boolean } };
  hud?: { show(on: boolean): void } | null;
}

const CSS = `
.fsh-hint { position: absolute; left: 0; right: 0; bottom: 14%; z-index: 25; text-align: center; pointer-events: none; font-family: 'Pixelify Sans', monospace;
  font-size: clamp(14px, 2vw, 20px); color: rgba(255, 246, 228, 0.92); text-shadow: 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.6s; }
.fsh-hint.on { opacity: 1; }
.fsh-hint .key { margin: 0 0.25em !important; }
.fsh-card { position: absolute; right: max(5vw, 20px); top: 48%; transform: translateY(-50%); z-index: 26; width: min(320px, 80vw); text-align: center; pointer-events: auto;
  border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round; image-rendering: pixelated; padding: 10px 16px;
  font-family: 'Pixelify Sans', monospace; color: #3a2614; animation: fshCard 0.35s cubic-bezier(.2,1.7,.4,1) both; }
@keyframes fshCard { from { transform: translateY(-50%) translateX(30px) scale(0.8); opacity: 0; } }
.fsh-card h4 { margin: 0; font: 700 18px 'Silkscreen', monospace; color: #2f6b2a; text-transform: uppercase; }
.fsh-card .mi { color: #8a6a4a; font-size: 13px; }
.fsh-card canvas { image-rendering: pixelated; margin: 6px auto; display: block; }
.fsh-card .st { color: #e8b840; font-size: 20px; letter-spacing: 3px; text-shadow: 0 2px 0 #6a4a1a; }
.fsh-card .ft { font-size: 13px; margin-top: 4px; }
.fsh-card .rare { color: #b04a8a; font: 700 12px 'Silkscreen', monospace; }
.fsh-card .ok { margin-top: 8px; font: 700 12px 'Silkscreen', monospace; color: #6a4a2a; }
`;
let styled = false;

/** pixel sprite for a fish (w x h, facing right) */
export function fishCanvas(f: FishDef, scale = 3): HTMLCanvasElement {
  const W = f.shape === 'moon' ? 30 : f.shape === 'long' ? 32 : 26, H = f.shape === 'moon' ? 22 : f.shape === 'flat' ? 18 : 14;
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const g = c.getContext('2d')!;
  const cells: string[][] = Array.from({ length: H }, () => Array(W).fill(''));
  const put = (x: number, y: number, col: string) => { if (x >= 0 && y >= 0 && x < W && y < H) cells[y][x] = col; };
  const [dark, mid, belly] = f.cols;
  const cx = W * 0.44, cy = H / 2;
  const rx = W * (f.shape === 'long' ? 0.42 : 0.36), ry = H * (f.shape === 'moon' ? 0.44 : f.shape === 'flat' ? 0.42 : 0.36);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny <= 1) put(x, y, ny > 0.35 ? belly : ny < -0.3 ? dark : mid);
  }
  // tail
  for (let y = 0; y < H; y++) { const d = Math.abs(y + 0.5 - cy) / (H * 0.45); const x0 = Math.round(cx - rx - 1 - (1 - d) * 5 * (f.shape === 'moon' ? 0.6 : 1)); for (let x = x0; x < Math.round(cx - rx + 2); x++) if (d < 1 && (d > 0.2 || x > x0 + 2)) put(x, y, dark); }
  // dorsal fin
  for (let x = Math.round(cx - rx * 0.4); x < Math.round(cx + rx * 0.3); x++) put(x, Math.round(cy - ry - 1 + Math.abs(x - cx) * 0.15), dark);
  // details
  const ex = Math.round(cx + rx * 0.62), ey = Math.round(cy - ry * 0.25);
  put(ex, ey, '#ffffff'); put(ex + 1, ey, '#1a1014');
  if (f.id === 'snapper') for (const [x, y] of [[10, 5], [13, 6], [8, 7], [15, 4]]) put(x, y, '#5ac8e8');
  if (f.id === 'tarakihi' || f.id === 'johndory') { for (let y = 3; y < H - 4; y++) put(Math.round(cx + (f.id === 'johndory' ? 0 : rx * 0.3)), y, f.id === 'johndory' && Math.abs(y - cy) < 2 ? '#1a1014' : f.id === 'tarakihi' && y < cy ? '#2a2630' : cells[y][Math.round(cx)] || mid); }
  if (f.id === 'gurnard') for (let k = 0; k < 4; k++) put(Math.round(cx + k), Math.round(cy + ry + 1), '#f07050');
  if (f.id === 'opah') for (let k = 0; k < 12; k++) put(Math.round(cx - rx * 0.7 + Math.random() * rx * 1.4), Math.round(cy - ry * 0.6 + Math.random() * ry), '#ffffff');
  // outline
  const out: string[][] = cells.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cells[y][x]) continue;
    if ((cells[y][x - 1]) || (cells[y][x + 1]) || (cells[y - 1]?.[x]) || (cells[y + 1]?.[x])) out[y][x] = '#1a1014';
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[y][x]) { g.fillStyle = out[y][x]; g.fillRect(x * scale, y * scale, scale, scale); }
  return c;
}

function pickFish(dist: number): FishDef {
  const r = Math.random();
  if (dist > 0.85 && r < 0.08) return FISH.find(f => f.id === 'opah')!;
  const pool = FISH.filter(f => !f.rare && (dist > 0.5 || f.diff < 50));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 0xRRGGBB + alpha → packed ABGR */
const px = (c: number, a: number) => (Math.round(Math.max(0, Math.min(1, a)) * 255) << 24 | (c & 0xff) << 16 | (c >> 8 & 0xff) << 8 | (c >> 16 & 0xff)) >>> 0;
const FOAM = 0xf4fcff, SPRAY = 0xc8e8f4;

export async function goFishing(host: FishingHost): Promise<FishCatch | null> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const ui = game.ui.modalLayer;
  game.ui.modalOpen++;
  const p = host.player;
  const hold = new Hold(document.body);
  let cancelled = false;
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelled = true; } };
  window.addEventListener('keydown', onKey, true);
  // cinematic framing: no HUD, letterbox, and the camera eases down and out over the water
  host.hud?.show(false);
  game.ui.letterbox(true);
  const cam = host.st.cam;
  const cam0 = cam ? { locked: cam.locked, z: cam.tzoom } : null;
  // framing: Mori at one side, the water he's casting over filling the rest
  const view = { dx: p.facing * 70, y: (p.y - 50 + host.seaY(p.x + p.facing * 90) + 30) / 2, z: (cam0?.z ?? 1) * 1.3 };
  const tickCam = (dt: number) => {
    if (!cam || !cam0) return;
    const k = Math.min(1, dt * 2.2);
    cam.locked = true;
    cam.x += (p.x + view.dx - cam.x) * k;
    cam.y += (view.y - cam.y) * k;
    cam.zoom += (view.z - cam.zoom) * k;
    cam.tzoom = cam.zoom;
  };
  // world effects: short-lived spray and ripples, redrawn into one pixel list each frame
  const fx: FishFx[] = [];
  const parts: { x: number; y: number; vx: number; vy: number; life: number; c: number }[] = [];
  const rings: { x: number; r: number; life: number; max: number }[] = [];
  const splash = (x: number, y: number, n: number, pow = 1) => {
    for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 3, y: y - 1, vx: (Math.random() - 0.5) * 34 * pow, vy: -(22 + Math.random() * 40) * pow, life: 0.5 + Math.random() * 0.3, c: Math.random() < 0.5 ? FOAM : SPRAY });
  };
  const ring = (x: number, max = 1) => rings.push({ x, r: 1, life: max, max });
  const tickFx = (dt: number) => {
    fx.length = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.life <= 0 || (q.vy > 0 && q.y > host.seaY(q.x) + 1)) { parts.splice(i, 1); continue; }
      fx.push({ x: q.x, y: q.y, c: px(q.c, q.life * 3) });
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt; r.r += dt * 9;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const a = Math.min(0.95, r.life / r.max * 1.3);
      for (let k = 0; k < 18; k++) {
        if (k % 2 && r.r > 4) continue;
        const ang = k / 18 * Math.PI * 2;
        fx.push({ x: r.x + Math.cos(ang) * r.r, y: host.seaY(r.x) + Math.sin(ang) * r.r * 0.22, c: px(FOAM, a) });
      }
    }
  };
  /** a world pixel (or a 2x2 blob) with a soft dark drop shadow, so it reads over bright sky and sea */
  const dot = (x: number, y: number, c: number, a: number, sz: number) => {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < sz; j++) fx.push({ x: x + j, y: y + sz, c: px(0x10243a, a * 0.45) });
    for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) fx.push({ x: x + j, y: y + i, c: px(c, a) });
  };
  host.setFx?.(fx);
  const hint = el('div', 'fsh-hint');
  ui.appendChild(hint);
  let hintT: ReturnType<typeof setTimeout> | null = null;
  const say = (html: string, ms = 3600) => { hint.innerHTML = html; hint.classList.add('on'); if (hintT) clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove('on'), ms); };
  const reach = (power: number) => 40 + power * 150;
  const phase = (k: string) => { (window as unknown as { __fishPhase?: string }).__fishPhase = k; };
  let result: FishCatch | null = null;
  try {
    // ---------------- cast: hold to wind up (the pose is the meter), a dotted arc marks the landing
    phase('cast');
    p.poseOverride = 'fishWait';
    say('Hold <span class="key">Space</span> to wind up · let go to cast', 4200);
    let power = 0, dir = 1, charging = false, cast = -1, creak = 0;
    await new Promise<void>(res => loop((dt, t) => {
      if (cancelled) { res(); return false; }
      tickCam(dt);
      if (hold.down) {
        if (!charging) { charging = true; p.body.setExpr('determined'); hint.classList.remove('on'); }
        power += dir * dt * 1.25;
        if (power >= 1) { power = 1; dir = -1; }
        if (power <= 0) { power = 0; dir = 1; }
        p.poseOverride = 'fishCast';
        p.poseFrame = power < 0.34 ? 0 : power < 0.67 ? 1 : 2;
        creak -= dt;
        if (creak <= 0) { creak = 0.16; audio.play('rope', { vol: 0.05 + power * 0.08, pitch: 0.7 + power * 0.9 }); }
      } else if (charging) { cast = power; res(); return false; }
      tickFx(dt);
      if (charging) {
        // the arc the bobber will fly: dots marching out along it, and splash ticks where it lands
        const [hx0, hy0] = host.rodTip();
        const bx = p.x + p.facing * reach(power), by = host.seaY(bx);
        for (let i = 0; i < 14; i++) {
          const k = 0.28 + ((i + t * 2.5) % 14) / 14 * 0.72;
          const x = hx0 + (bx - hx0) * k, y = hy0 + (by - hy0) * k - Math.sin(k * Math.PI) * 40;
          dot(x, y, 0xffffff, 0.55 + k * 0.45, 2);
        }
        // where it will land: a pulsing ring on the water with little splash ticks
        const pulse = 0.6 + Math.sin(t * 9) * 0.3;
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; dot(bx + Math.cos(a) * 8, by + Math.sin(a) * 2, 0xffffff, pulse, 1); }
        for (const [dx, dy] of [[-5, -3], [-4, -4], [5, -3], [4, -4], [0, -5], [0, -6]]) dot(bx + dx, by + dy, FOAM, pulse, 1);
      }
      return true;
    }));
    if (cancelled) return null;
    // throw: the whip forward, then the bobber arcs out
    audio.play('whoosh', { vol: 0.5 });
    p.body.setExpr('happy', 1.2);
    for (const f of [3, 4, 5]) { p.poseFrame = f; await wait(85); }
    const dist = reach(cast);
    const bx = p.x + p.facing * dist;
    const t0 = performance.now();
    await new Promise<void>(res => loop(dt => {
      tickCam(dt); tickFx(dt);
      const k = Math.min(1, (performance.now() - t0) / 700);
      const hand = host.rodTip();
      const x = hand[0] + (bx - hand[0]) * k, y0 = hand[1], y1 = host.seaY(bx);
      host.setBobber({ x, y: y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 40, dip: 0, fly: 1 - k });
      if (k >= 1) { res(); return false; }
      return true;
    }));
    audio.play('splash', { vol: 0.4 });
    splash(bx, host.seaY(bx), 10, 0.8);
    ring(bx, 1.1);
    view.dx = p.facing * Math.max(50, dist * 0.5);
    p.poseFrame = null;
    p.poseOverride = 'fishWait';
    // ---------------- wait for a bite: the bobber rides the swell, nibbles tap it, the bite drags it under
    phase('wait');
    const fish = pickFish(cast);
    let bite = false, missed = false;
    const tBite = 1.6 + Math.random() * 3.2;
    const nibbles = [tBite * 0.4, tBite * 0.7].filter(() => Math.random() < 0.8);
    const nibbled = new Set<number>();
    const tw0 = performance.now();
    let struck = false;
    await new Promise<void>(res => loop((dt, tt) => {
      if (cancelled) { res(); return false; }
      tickCam(dt); tickFx(dt);
      const t = (performance.now() - tw0) / 1000;
      let dip = Math.sin(tt * 2.4) * 0.8;
      for (const n of nibbles) if (t > n && t < n + 0.18) {
        dip = 2;
        if (!nibbled.has(n)) { nibbled.add(n); ring(bx, 0.7); audio.play('bubble', { vol: 0.18, pitch: 1.4 }); }
      }
      if (t > tBite) {
        // yanked under: the float bobs up and is dragged down again, thrashing the water white
        dip = 5 + Math.sin(tt * 26) * 2.5;
        if (!struck) {
          struck = true;
          phase('bite');
          splash(bx, host.seaY(bx), 24, 1.3);
          ring(bx, 1.2); ring(bx, 0.8);
          audio.play('alert', { vol: 0.5 }); audio.play('splash', { vol: 0.35, pitch: 1.2 });
          p.body.setExpr('surprised', 1);
          p.body.showEmote('exclaim', 1.6);
        }
        if (Math.random() < dt * 20) splash(bx, host.seaY(bx), 2, 0.6);
        if (Math.random() < dt * 4) ring(bx, 0.6);
        if (hold.hit()) { bite = true; res(); return false; }
        if (t > tBite + 0.9) { missed = true; res(); return false; }
      } else if (hold.hit()) { /* pulled too early: nothing yet */ }
      host.setBobber({ x: bx, y: host.seaY(bx), dip, fly: 0 });
      return true;
    }));
    if (cancelled) return null;
    if (missed || !bite) {
      host.setBobber(null);
      p.poseOverride = null;
      p.body.showEmote('sweat', 1.4);
      game.ui.toast('It got away... Wait for the big dip, then press right away.', 'FISHING', 'coral', 3200);
      return null;
    }
    // ---------------- strike! Mori hauls back, then the camera cuts under the boat
    p.poseOverride = 'fishReel';
    p.body.setExpr('determined');
    host.st.shake(1, 0.2);
    audio.play('whoosh', { vol: 0.4, pitch: 1.4 });
    splash(bx, host.seaY(bx), 10, 0.9);
    const ts = performance.now();
    await new Promise<void>(res => loop(dt => {
      tickCam(dt); tickFx(dt);
      host.setBobber({ x: bx, y: host.seaY(bx), dip: 7, fly: 0 });
      if (performance.now() - ts > 420) { res(); return false; }
      return true;
    }));
    const len = Math.round(fish.len[0] + Math.random() * (fish.len[1] - fish.len[0]));
    const q = (len - fish.len[0]) / (fish.len[1] - fish.len[0]);
    const stars = q > 0.85 ? 3 : q > 0.5 ? 2 : 1;
    phase('fight');
    const outcome = await runFishFight(fish, hold, { cancelled: () => cancelled, caughtSub: `${fish.name} · ${len} cm` });
    host.setBobber(null);
    if (outcome === 'cancel' || cancelled) return null;
    if (outcome !== 'caught') {
      p.poseOverride = null;
      p.body.setExpr('sad', 1.5);
      p.body.showEmote('gloom', 1.6);
      game.ui.toast(outcome === 'snap' ? `Snap! The ${fish.name.toLowerCase()} broke the line. Ease off when it runs.` : `The ${fish.name.toLowerCase()} slipped the hook!`, 'FISHING', 'coral', 3200);
      return null;
    }
    // ---------------- the catch: Mori holds it up in the scene
    phase('show');
    result = { fish, len, stars };
    const heldW = Math.max(20, Math.min(36, Math.round(len * 0.5)));
    p.poseOverride = 'fishShow';
    p.body.setExpr('excited');
    host.setHeld?.(fishSprite(fish, heldW));
    audio.play('discover', { vol: 0.7 });
    p.body.showEmote('sparkle', 1.6);
    view.dx = p.facing * 4; view.y = p.y - 28; view.z = (cam0?.z ?? 1) * 1.55;
    let flop = 0, flopT = 0.8;
    let card: HTMLElement | null = null;
    const tc = performance.now();
    await new Promise<void>(res => loop(dt => {
      if (cancelled) { res(); return false; }
      tickCam(dt); tickFx(dt);
      // the fish flops in Mori's hands now and then
      flopT -= dt;
      if (flopT <= 0) { flopT = 0.9 + Math.random() * 1.4; flop = 0.45; if (Math.random() < 0.5) audio.play('splash', { vol: 0.1, pitch: 1.8 }); }
      if (flop > 0) { flop -= dt; host.setHeld?.(fishSprite(fish, heldW, flop > 0 ? Math.sin(flop * 30) * 2 : 0)); }
      if (!card && performance.now() - tc > 900) {
        card = el('div', 'fsh-card');
        card.innerHTML = `${fish.rare ? '<div class="rare">★ RARE ★</div>' : ''}<h4>${fish.name}</h4><div class="mi">${fish.maori ?? ''}</div>`;
        card.appendChild(fishCanvas(fish, 4));
        card.appendChild(el('div', 'st', '★'.repeat(stars) + '☆'.repeat(3 - stars)));
        card.appendChild(el('div', '', `<b>${len} cm</b>`));
        card.appendChild(el('div', 'ft', fish.fact));
        card.appendChild(el('div', 'ok', 'press to continue'));
        ui.appendChild(card);
        hold.hit();
      }
      if (card && performance.now() - tc > 1400 && hold.hit()) { res(); return false; }
      return true;
    }));
    (card as HTMLElement | null)?.remove();
    const V = game.save.vars;
    V['v4:fishCaught'] = (V['v4:fishCaught'] ?? 0) + 1;
    game.save.flags['fish:' + fish.id] = true;
    game.persist();
    return result;
  } finally {
    phase('done');
    hold.dispose();
    window.removeEventListener('keydown', onKey, true);
    hint.remove();
    if (hintT) clearTimeout(hintT);
    host.setBobber(null);
    host.setFx?.(null);
    host.setHeld?.(null);
    p.poseFrame = null;
    p.poseOverride = null;
    game.ui.letterbox(false);
    host.hud?.show(true);
    // hand the camera back: it eases home on its own
    if (cam && cam0) { cam.locked = cam0.locked; cam.tzoom = cam0.z; }
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    guardInput(250);
  }
}
