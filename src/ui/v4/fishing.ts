// Stardew-inspired fishing. Hold to charge the cast, let go to throw; the bobber sits on the swell
// (drawn in the world by the host) until something bites: hit the button on the big dip. Then the
// reel bar: keep the green zone on the fish (hold to lift, let go to sink) until the catch meter fills.
// Each fish has its own temper: smooth, darting, sinking, floating or a bit of everything.

import { game } from '../../game/game';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { Hold, loop, wait } from './mini';

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

export interface FishingHost {
  player: { x: number; y: number; facing: number; poseOverride: string | null; body: { handPos(): [number, number] | null; setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void } };
  /** water surface y at world x */
  seaY(x: number): number;
  /** rod tip in world space */
  rodTip(): [number, number];
  /** show / move / hide the bobber and line in the world */
  setBobber(b: { x: number; y: number; dip: number; fly: number } | null): void;
  st: { shake(a: number, t: number): void };
}

const CSS = `
.fsh-pow { position: absolute; left: 50%; bottom: 18%; transform: translateX(-50%); width: min(300px, 60vw); z-index: 25; pointer-events: none; text-align: center;
  font: 700 13px 'Silkscreen', monospace; color: #fff; text-shadow: 0 2px 0 #000; }
.fsh-pow .bar { height: 16px; margin-top: 4px; background: #2a1c14; box-shadow: 0 0 0 3px #3a2614, 0 0 0 5px #c8a048; position: relative; overflow: hidden; }
.fsh-pow .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #5aa447, #e8b840 70%, #e8483a); }
.fsh-bang { position: absolute; z-index: 25; font: 700 36px 'Silkscreen', monospace; color: #fff; text-shadow: 0 3px 0 #a8382a, 3px 0 0 #a8382a, -3px 0 0 #a8382a, 0 -3px 0 #a8382a; transform: translate(-50%, -100%); animation: fshBang 0.2s cubic-bezier(.2,2,.4,1) both; pointer-events: none; }
@keyframes fshBang { from { transform: translate(-50%, -100%) scale(0.2); } }
.fsh-reel { position: absolute; right: max(4vw, 20px); top: 50%; transform: translateY(-50%); z-index: 25; display: flex; gap: 8px; align-items: stretch; pointer-events: auto;
  border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round; image-rendering: pixelated; padding: 6px;
  animation: fshIn 0.25s cubic-bezier(.2,1.5,.4,1) both; }
@keyframes fshIn { from { transform: translateY(-50%) translateX(40px); opacity: 0; } }
.fsh-reel canvas { image-rendering: pixelated; display: block; }
.fsh-card { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); z-index: 26; min-width: min(360px, 86vw); text-align: center; pointer-events: auto;
  border-style: solid; border-width: calc(var(--sk-u, 3px) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u, 3px) * 6) / 0 round; image-rendering: pixelated; padding: 10px 16px;
  font-family: 'Pixelify Sans', monospace; color: #3a2614; animation: fshCard 0.35s cubic-bezier(.2,1.7,.4,1) both; }
@keyframes fshCard { from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } }
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

export async function goFishing(host: FishingHost): Promise<FishCatch | null> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const ui = game.ui.modalLayer;
  game.ui.modalOpen++;
  const p = host.player;
  const hold = new Hold(document.body);
  let result: FishCatch | null = null;
  try {
    // ---------------- cast: charge the power bar
    p.poseOverride = 'fishWait';
    const pow = el('div', 'fsh-pow', 'HOLD TO CAST<div class="bar"><i></i></div>');
    ui.appendChild(pow);
    const bar = pow.querySelector('i') as HTMLElement;
    let power = 0, dir = 1, charging = false, cast = -1;
    await new Promise<void>(res => loop(dt => {
      if (hold.down) {
        charging = true;
        power += dir * dt * 1.25;
        if (power >= 1) { power = 1; dir = -1; }
        if (power <= 0) { power = 0; dir = 1; }
      } else if (charging) { cast = power; res(); return false; }
      bar.style.width = power * 100 + '%';
      return true;
    }));
    pow.remove();
    // throw: wind up, whip, the bobber arcs out
    audio.play('whoosh', { vol: 0.5 });
    p.poseOverride = 'fishCast';
    await wait(380);
    const dist = 40 + cast * 150;
    const bx = p.x + p.facing * dist;
    const t0 = performance.now();
    await new Promise<void>(res => loop(() => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      const hand = host.rodTip();
      const x = hand[0] + (bx - hand[0]) * k, y0 = hand[1], y1 = host.seaY(bx);
      host.setBobber({ x, y: y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 40, dip: 0, fly: 1 - k });
      if (k >= 1) { res(); return false; }
      return true;
    }));
    audio.play('splash', { vol: 0.4 });
    p.poseOverride = 'fishWait';
    // ---------------- wait for a bite
    const fish = pickFish(cast);
    let bite = false, missed = false;
    const tBite = 1.6 + Math.random() * 3.2;
    const nibbles = [tBite * 0.4, tBite * 0.7].filter(() => Math.random() < 0.8);
    const tw0 = performance.now();
    let bang: HTMLElement | null = null;
    await new Promise<void>(res => loop(() => {
      const t = (performance.now() - tw0) / 1000;
      let dip = 0;
      for (const n of nibbles) if (t > n && t < n + 0.18) dip = 2;
      if (t > tBite) {
        dip = 6;
        if (!bang) {
          bang = el('div', 'fsh-bang', '!');
          const sc = game.scene as unknown as { css?(x: number, y: number): [number, number] };
          const [cx, cy] = sc.css ? sc.css(p.x, p.y - 70) : [innerWidth / 2, innerHeight / 3];
          bang.style.left = cx + 'px';
          bang.style.top = cy + 'px';
          ui.appendChild(bang);
          audio.play('alert', { vol: 0.5 });
          p.body.setExpr('surprised', 1);
        }
        if (hold.hit()) { bite = true; res(); return false; }
        if (t > tBite + 0.9) { missed = true; res(); return false; }
      } else if (hold.hit()) { /* pulled too early: nothing yet */ }
      host.setBobber({ x: bx, y: host.seaY(bx), dip, fly: 0 });
      return true;
    }));
    (bang as HTMLElement | null)?.remove();
    if (missed || !bite) {
      host.setBobber(null);
      p.poseOverride = null;
      game.ui.toast('It got away... Wait for the big dip, then press right away.', 'FISHING', 'coral', 3200);
      return null;
    }
    // ---------------- reel
    p.poseOverride = 'fishReel';
    host.st.shake(1, 0.2);
    const reel = el('div', 'fsh-reel');
    const BW = 26, BH = 150, MW = 8;
    const s = Math.max(2, Math.min(3, Math.floor((innerHeight * 0.62) / BH)));
    const cv = el('canvas');
    cv.width = BW + MW + 6; cv.height = BH;
    cv.style.width = (BW + MW + 6) * s + 'px';
    cv.style.height = BH * s + 'px';
    reel.appendChild(cv);
    ui.appendChild(reel);
    const g = cv.getContext('2d')!;
    const zoneH = Math.round(BH * (0.3 - fish.diff * 0.0016));
    let zy = BH - zoneH, zv = 0;
    let fy = BH * 0.6, fv = 0, ftgt = fy, fT = 0;
    let prog = 0.3;
    let outcome: 'caught' | 'lost' | null = null;
    let spin = 0, sfxT = 0;
    const fishIc = fishCanvas(fish, 1);
    await new Promise<void>(res => loop((dt, t) => {
      // player's zone: hold lifts, release sinks, bounces a little on the floor
      zv += (hold.down ? -420 : 380) * dt;
      zv = Math.max(-260, Math.min(260, zv));
      zy += zv * dt;
      if (zy > BH - zoneH) { zy = BH - zoneH; zv = -zv * 0.35; }
      if (zy < 0) { zy = 0; zv = 0; }
      // the fish
      fT -= dt;
      const d = fish.diff / 100;
      if (fT <= 0) {
        const tmp = fish.temper === 'mixed' ? (['smooth', 'dart', 'sinker', 'floater'] as Temper[])[Math.floor(Math.random() * 4)] : fish.temper;
        if (tmp === 'dart') { ftgt = 10 + Math.random() * (BH - 20); fT = 0.3 + Math.random() * 0.6 * (1 - d); }
        else if (tmp === 'sinker') { ftgt = Math.min(BH - 8, fy + 20 + Math.random() * 40); fT = 0.6 + Math.random(); }
        else if (tmp === 'floater') { ftgt = Math.max(8, fy - 20 - Math.random() * 40); fT = 0.6 + Math.random(); }
        else { ftgt = 20 + Math.random() * (BH - 40); fT = 0.8 + Math.random() * 1.2; }
      }
      const acc = (fish.temper === 'dart' ? 60 : 26) * (0.5 + d);
      fv += Math.sign(ftgt - fy) * acc * dt * 10;
      fv *= 1 - dt * (fish.temper === 'smooth' ? 3 : 2);
      fv = Math.max(-140 * (0.4 + d), Math.min(140 * (0.4 + d), fv));
      fy = Math.max(6, Math.min(BH - 6, fy + fv * dt + Math.sin(t * 9) * 0.3));
      const inZone = fy > zy && fy < zy + zoneH;
      prog += (inZone ? 0.3 : -0.2 - d * 0.1) * dt;
      prog = Math.max(0, Math.min(1, prog));
      if (inZone) { spin += dt * 12; sfxT -= dt; if (sfxT <= 0) { sfxT = 0.12; audio.play('rope', { vol: 0.12, pitch: 1.6 }); } }
      if (prog >= 1) { outcome = 'caught'; res(); return false; }
      if (prog <= 0) { outcome = 'lost'; res(); return false; }
      host.setBobber({ x: bx - p.facing * (prog * dist * 0.7), y: host.seaY(bx) + 2, dip: 3 + Math.sin(t * 20) * 2, fly: 0 });
      // draw
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#6e4c32'; g.fillRect(0, 0, BW, BH);
      for (let y = 2; y < BH - 2; y++) { g.fillStyle = y < BH * 0.3 ? '#3a8aa8' : y < BH * 0.7 ? '#2a6a8a' : '#1e4a6a'; g.fillRect(3, y, BW - 6, 1); }
      for (let i = 0; i < 6; i++) { const yy = (t * 14 + i * 25) % (BH - 4); g.fillStyle = 'rgba(200,240,255,0.5)'; g.fillRect(6 + ((i * 7) % (BW - 14)), BH - 3 - yy, 1, 1); }
      g.fillStyle = inZone ? 'rgba(120,230,110,0.8)' : 'rgba(90,190,80,0.6)';
      g.fillRect(4, Math.round(zy), BW - 8, zoneH);
      g.fillStyle = inZone ? '#c8ffb0' : '#8ad870';
      g.fillRect(4, Math.round(zy), BW - 8, 2); g.fillRect(4, Math.round(zy + zoneH - 2), BW - 8, 2);
      g.save();
      g.translate(Math.round(BW / 2 - fishIc.width / 2), Math.round(fy - fishIc.height / 2));
      if (fv > 0) { g.translate(fishIc.width, 0); g.scale(-1, 1); }
      g.drawImage(fishIc, 0, 0);
      g.restore();
      // catch meter
      g.fillStyle = '#2a1c14'; g.fillRect(BW + 3, 0, MW, BH);
      const ph = Math.round((BH - 4) * prog);
      g.fillStyle = prog > 0.66 ? '#5aa447' : prog > 0.33 ? '#e8b840' : '#e8483a';
      g.fillRect(BW + 5, BH - 2 - ph, MW - 4, ph);
      // reel handle
      g.fillStyle = '#c8a048';
      g.fillRect(BW - 2 + Math.round(Math.cos(spin) * 2), BH - 12 + Math.round(Math.sin(spin) * 2), 3, 3);
      return true;
    }));
    reel.remove();
    host.setBobber(null);
    if (outcome !== 'caught') {
      p.poseOverride = null;
      audio.play('wrong', { vol: 0.5 });
      p.body.setExpr('sad', 1.5);
      game.ui.toast(`The ${fish.name.toLowerCase()} slipped the hook!`, 'FISHING', 'coral', 3000);
      return null;
    }
    // ---------------- the catch
    const len = Math.round(fish.len[0] + Math.random() * (fish.len[1] - fish.len[0]));
    const q = (len - fish.len[0]) / (fish.len[1] - fish.len[0]);
    const stars = q > 0.85 ? 3 : q > 0.5 ? 2 : 1;
    result = { fish, len, stars };
    p.poseOverride = 'celebrate';
    audio.play('discover', { vol: 0.7 });
    p.body.showEmote('sparkle', 1.6);
    const card = el('div', 'fsh-card');
    card.innerHTML = `${fish.rare ? '<div class="rare">★ RARE ★</div>' : ''}<h4>${fish.name}</h4><div class="mi">${fish.maori ?? ''}</div>`;
    card.appendChild(fishCanvas(fish, 4));
    card.appendChild(el('div', 'st', '★'.repeat(stars) + '☆'.repeat(3 - stars)));
    card.appendChild(el('div', '', `<b>${len} cm</b>`));
    card.appendChild(el('div', 'ft', fish.fact));
    card.appendChild(el('div', 'ok', 'press to continue'));
    ui.appendChild(card);
    await wait(500);
    hold.hit();
    await new Promise<void>(res => loop(() => { if (hold.hit()) { res(); return false; } return true; }));
    card.remove();
    p.poseOverride = null;
    const V = game.save.vars;
    V['v4:fishCaught'] = (V['v4:fishCaught'] ?? 0) + 1;
    game.save.flags['fish:' + fish.id] = true;
    game.persist();
    return result;
  } finally {
    hold.dispose();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    guardInput(250);
  }
}
