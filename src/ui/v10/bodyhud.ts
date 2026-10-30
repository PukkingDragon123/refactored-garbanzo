// V11 body HUD, in the spirit of Dave the Diver's gauges: a status plate in the top-left corner.
//   - Mori's medallion: a brass ring round his in-game pixel head (the small sprite head, never the
//     close-up face) on a little disc of sky that follows the time of day; he blinks, looks tired
//     when he's running low, queasy when he's ill, pleased when something good happens.
//   - the stamina flask (on expeditions): a glass flask whose liquid is his energy. It sloshes when
//     he moves, bubbles, shifts from teal to yellow to red as it drains, pulses and blinks when he's
//     low, and cracks with a flash when a climb or a swim takes a big gulp. The number sits on a tag
//     beside it and ticks down.
//   - the pack: a spring scale that stretches with the load (kg / capacity), red and shaking when
//     it's too heavy to run.
//   - ailment chips (a tummy ache, dizziness) with their time running out.
//   - the edge of the screen darkens in dithered pixels as he tires; illness tints it.
// Hud2 mounts it and ticks it. Click the flask (or press H) for a snack.

import { el } from '../ui';
import { game } from '../../game/game';
import { energy, maxEnergy, packWeight, packCapacity, onExpedition, lowness, hasAilment, dizziness, onSpend, EAT_KEY, ailments } from '../../game/v10/energy';
import { peopleArt } from '../../world/actor';
import { Art, col, dith, shadeC, mixC, pxCanvas } from '../v11/paper/px';
import { PxW, outlined, tw, plate, skyAt, gaugeColor, hudScale } from '../v11/hudpx';
import { hudHour } from '../v11/hudclock';

const CSS = `
.h2 .v10dim { position: absolute; inset: 0; pointer-events: none; }
.h2 .v10dim .pp-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.6s steps(6); }
.h2 .v10dim .pp-cv.on { opacity: 1; }
.h2 .v10dim .low.pulse { animation: bhPulse 2.4s steps(6) infinite; }
@keyframes bhPulse { 50% { opacity: 0.55; } }
.h2 .bh { position: absolute; left: 10px; top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; pointer-events: none; }
.h2 .bh canvas.hx { display: block; image-rendering: pixelated; pointer-events: auto; }
.h2 .bh .plate { cursor: pointer; }
.h2 .bh.shake .plate { animation: bhShake 0.36s steps(6); }
@keyframes bhShake { 20% { transform: translate(-6px, 0); } 40% { transform: translate(6px, -3px); } 60% { transform: translate(-3px, 3px); } 80% { transform: translate(3px, 0); } }
.h2 .bh .wt.off, .h2 .bh .ail.off { display: none; }
.h2 .bh .wt.heavy { animation: bhShake 0.5s steps(5) infinite; }
.h2 .bh.pop .plate { animation: bhPop 0.3s steps(5); }
@keyframes bhPop { 40% { transform: translateY(-6px); } }
body.touchmode .h2 .bh { top: 6px; left: 6px; }
`;

let styled = false;
// V12: no HUD and no stamina, so the plate is hidden unless something asks for it again
let mode: 'auto' | 'always' | 'never' = 'never';
/** show the body HUD always / never / on expeditions only (default) */
export function setBodyHud(m: 'auto' | 'always' | 'never') { mode = m; }
const shown = () => (mode === 'always' ? true : mode === 'never' ? false : onExpedition());

export interface BodyHud {
  /** (kept for the V2 API: the pack readout is the spring scale now) */
  ownsPack(): boolean;
  update(dt: number): void;
  destroy(): void;
  /** a happy flash on Mori's face (something good happened) */
  cheer?(): void;
}

// ---------------------------------------------------------------- painting

const OUT = col('#140c06'), CREAM = col('#fff1cc'), BRASS = col('#c8962e'), BRASS_L = col('#f4d27a'), BRASS_D = col('#7a5414');
const WOOD = col('#3e2814');

interface Bubble { x: number; y: number; v: number }
interface FlaskSt { level: number; tilt: number; tiltV: number; amp: number; t: number; bubbles: Bubble[]; crack: number; flash: number; shown: number }

/** Mori's head sprite for the medallion (cached per expression / blink) */
const heads = new Map<string, Art | null>();
function headArt(id: string, expr: string, blink: boolean): Art | null {
  const k = `${id}|${expr}|${blink ? 1 : 0}`;
  if (heads.has(k)) return heads.get(k)!;
  let a: Art | null = null;
  try {
    const p = peopleArt();
    const h = p?.renderHead(id, { expr, mouth: 0, blink, look: 'fwd' });
    if (h) { a = new Art(h.buf.w, h.buf.h); a.d.set(h.buf.data); }
  } catch { a = null; }
  heads.set(k, a);
  return a;
}

function paintMedallion(a: Art, cx: number, cy: number, id: string, expr: string, blink: boolean, hour: number, warn: boolean) {
  const R = 21;
  // hard shadow, outline, brass ring with rivets, the sky disc
  a.ellipse(cx + 2, cy + 2, R + 1, R + 1, (x, y) => (dith(x, y, 0.6) ? col('#000000', 0.42) : 0));
  a.ellipse(cx, cy, R + 1, R + 1, OUT);
  a.ellipse(cx, cy, R, R, (x, y) => {
    const d = (x - cx) + (y - cy);
    return d < -10 ? BRASS_L : d > 12 ? BRASS_D : BRASS;
  });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.39;
    const rx = Math.round(cx + Math.cos(ang) * (R - 2)), ry = Math.round(cy + Math.sin(ang) * (R - 2));
    a.put(rx, ry, BRASS_L); a.put(rx + 1, ry + 1, BRASS_D);
  }
  const ri = R - 4;
  a.ellipse(cx, cy, ri + 1, ri + 1, warn ? col('#d8322a') : OUT);
  const [top, bot] = skyAt(hour);
  const night = hour < 5.5 || hour > 20.5;
  a.ellipse(cx, cy, ri, ri, (x, y) => {
    const k = (y - (cy - ri)) / (ri * 2);
    let c = dith(x, y, k) ? bot : top;
    if (night && ((x * 7 + y * 13) % 41 === 0)) c = col('#fff6d0');
    return c;
  });
  // a sun or moon low in the disc
  const sunX = cx + Math.round(Math.cos(((hour - 6) / 14) * Math.PI) * -9), sunY = cy - 8;
  if (!night && hour > 5.5) a.ellipse(sunX, sunY, 3, 3, (x, y) => (x + y < sunX + sunY ? col('#fff4b0') : col('#ffd048')));
  else a.ellipse(cx + 7, cy - 9, 3, 3, (x, y) => ((x - cx - 8) * (x - cx - 8) + (y - cy + 10) * (y - cy + 10) < 5 ? 0 : col('#f0ecd0')));
  // a little hill for him to stand behind
  a.ellipse(cx, cy + ri + 8, ri + 6, 12, (x, y) => ((x * x + y) % 3 === 0 ? col('#3a6a2a') : col('#4a8a34')));
  // the head, sitting in the disc (clipped to it)
  const h = headArt(id, expr, blink);
  if (h) {
    const k = h.h > ri * 2 + 6 ? 1 : 1;
    void k;
    const hx = Math.round(cx - h.w / 2), hy = Math.round(cy + ri - h.h + 3);
    for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
      const c = h.d[y * h.w + x];
      if (!(c >>> 24)) continue;
      const X = hx + x, Y = hy + y;
      if ((X - cx) * (X - cx) + (Y - cy) * (Y - cy) <= ri * ri) a.put(X, Y, c);
    }
  }
  // a glint on the glass over the disc
  for (let i = 0; i < 4; i++) a.px(cx - ri + 4 + i, cy - ri + 7 - i, col('#ffffff', 0.55));
}

function paintRibbon(a: Art, cx: number, y: number, text: string) {
  const w = tw(text, { face: 'block', spacing: 1 }) + 10;
  const x0 = Math.round(cx - w / 2), red = col('#b8321e'), redD = col('#7a1a10');
  // tails
  for (const s of [-1, 1]) {
    const tx = s < 0 ? x0 - 5 : x0 + w;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 5; i++) {
      const notch = s < 0 ? i : 4 - i;
      if (Math.abs(j - 4) < 3 - notch && notch < 2) continue;
      a.put(tx + i, y + 2 + j, i === (s < 0 ? 0 : 4) || j === 0 || j === 8 ? OUT : redD);
    }
  }
  plate(a, x0, y, w, 11, red, { r: 1 });
  outlined(a, text, x0 + 5, y + 9, CREAM, redD, { face: 'block', spacing: 1 });
}

function paintFlask(a: Art, x0: number, y0: number, st: FlaskSt, frac: number, low: boolean, blinkOn: boolean) {
  const W = 22, H = 46;
  const [liq, liqD, liqL] = gaugeColor(frac);
  const glass = col('#1a2a2e'), glassL = col('#2c4448');
  const outC = low && blinkOn ? col('#e83a2a') : OUT;
  // shadow
  for (let y = y0 + 9; y < y0 + H + 2; y++) for (let x = x0 + 2; x < x0 + W + 2; x++) if (dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.4));
  // cap and neck
  plate(a, x0 + 6, y0, 10, 6, col('#a8402a'), { r: 1, shadow: false });
  a.rect(x0 + 8, y0 + 6, 6, 3, OUT); a.rect(x0 + 9, y0 + 6, 4, 3, BRASS);
  // the body: rounded glass in a brass frame
  const bx = x0, by = y0 + 9, bw = W, bh = H - 9;
  const inside = (x: number, y: number) => {
    if (x < bx || y < by || x >= bx + bw || y >= by + bh) return false;
    const cx = x < bx + 4 ? bx + 4 - x : x >= bx + bw - 4 ? x - (bx + bw - 5) : 0;
    const cy = y < by + 4 ? by + 4 - y : y >= by + bh - 4 ? y - (by + bh - 5) : 0;
    return cx * cx + cy * cy <= 17;
  };
  const gx0 = bx + 2, gx1 = bx + bw - 2, gy0 = by + 2, gy1 = by + bh - 2;
  const innerH = gy1 - gy0;
  const surf = gy1 - Math.round(st.level * innerH);
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) { a.put(x, y, outC); continue; }
    if (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2)) { a.put(x, y, (x + y) % 5 === 0 ? BRASS_L : x < bx + bw / 2 ? BRASS : BRASS_D); continue; }
    // liquid surface: a sloshing line tilted against the way he moves
    const sx = surf + st.tilt * (x - (bx + bw / 2)) + Math.sin(x * 0.8 + st.t * 7) * st.amp;
    const yS = Math.round(sx);
    let c = glass;
    if (x <= gx0 + 1) c = glassL;
    if (y > yS) c = x === gx0 ? liqL : x >= gx1 - 2 ? liqD : (y - yS) % 6 === 0 && dith(x, y, 0.3) ? liqL : liq;
    else if (y === yS) c = liqL;
    a.put(x, y, c);
  }
  // brass bands, a glint
  for (const yy of [by + Math.round(bh * 0.3), by + Math.round(bh * 0.72)]) for (let x = bx + 1; x < bx + bw - 1; x++) if (inside(x, yy)) a.put(x, yy, (x & 1) ? BRASS : BRASS_L);
  for (let y = gy0 + 3; y < gy0 + 13; y++) a.px(gx0 + 2, y, col('#ffffff', 0.5));
  // bubbles
  for (const b of st.bubbles) if (b.y > surf + 1) a.px(Math.round(b.x), Math.round(b.y), liqL);
  // a crack and a flash after a big gulp
  if (st.crack > 0) {
    const c = col('#ffffff', Math.min(1, st.crack * 2));
    let x = gx0 + 6, y = gy0 + 2;
    for (let i = 0; i < 9; i++) { a.px(x, y, c); y += 2; x += i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0; a.px(x, y - 1, c); }
    a.px(x + 1, y, c); a.px(x + 2, y + 1, c);
  }
  if (st.flash > 0) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (inside(x, y) && dith(x, y, st.flash * 0.7)) a.px(x, y, col('#ffffff', 0.85));
}

function paintTag(a: Art, x: number, y: number, value: number, low: boolean, blinkOn: boolean, label: string) {
  const txt = String(Math.max(0, Math.round(value)));
  const w = Math.max(30, tw(txt, { face: 'block', scale: 2, spacing: 1 }) + 10, tw('ENERGY', { face: 'block', bold: false, spacing: 1 }) + 4);
  plate(a, x, y, w, 21, low && blinkOn ? col('#8a1e14') : WOOD, { r: 2 });
  outlined(a, txt, Math.round(x + w / 2 - tw(txt, { face: 'block', scale: 2, spacing: 1 }) / 2), y + 17, low ? col('#ffb0a0') : CREAM, OUT, { face: 'block', scale: 2, spacing: 1 });
  const lw = tw(label, { face: 'block', bold: false, spacing: 1 });
  outlined(a, label, Math.round(x + w / 2 - lw / 2), y + 32, low && blinkOn ? col('#ff8a6a') : CREAM, OUT, { face: 'block', bold: false, spacing: 1 });
  return w;
}

function paintScale(a: Art, w: number, kg: number, cap: number, t: number) {
  const over = kg > cap, k = kg / Math.max(1, cap);
  // the spring scale: hook, barrel with a pointer, a weight on the hook stretching the spring
  const sx = 3;
  a.rect(sx + 2, 0, 3, 2, OUT); a.put(sx + 3, 1, BRASS_L);
  plate(a, sx, 2, 7, 7, BRASS, { r: 1, shadow: false });
  const pin = 3 + Math.min(4, Math.round(k * 3));
  a.rect(sx + 2, pin, 3, 1, col('#d8322a'));
  const stretch = Math.min(5, Math.round(k * 4));
  for (let i = 0; i < stretch + 1; i++) a.put(sx + ((i & 1) ? 2 : 4), 9 + i, col('#9aa0a6'));
  const wy = 10 + stretch;
  plate(a, sx, wy, 7, 5, over ? col('#c8321e') : col('#6a5a44'), { r: 1, shadow: false });
  // text and the load bar
  const txt = `${kg.toFixed(1)}/${Math.round(cap)}KG`;
  outlined(a, txt, 15, 9, over ? col('#ff9a80') : CREAM, OUT, { face: 'block', spacing: 1 });
  const bx = 15, by = 12, bw = w - bx - 4;
  plate(a, bx, by, bw, 5, col('#2a1a0c'), { r: 0, shadow: false });
  const fillW = Math.round(Math.min(1.25, k) / 1.25 * (bw - 2));
  const [gc] = gaugeColor(Math.max(0, 1 - k * 0.8));
  for (let x = 0; x < fillW; x++) for (let y = 0; y < 3; y++) a.put(bx + 1 + x, by + 1 + y, y === 0 ? shadeC(gc, 0.3) : gc);
  const capX = bx + 1 + Math.round((1 / 1.25) * (bw - 2));
  a.rect(capX, by - 1, 1, 7, over && Math.floor(t * 4) % 2 ? col('#ff4a3a') : CREAM);
}

function paintChip(a: Art, kind: 'stomach' | 'dizzy', left: number, t: number) {
  const w = a.w, h = a.h;
  const fill = kind === 'stomach' ? col('#3e7a2a') : col('#6a3a8e');
  plate(a, 0, 0, w - 2, h - 2, fill, { r: 2 });
  // the icon: a swirl (tummy) or a spiral of stars (dizzy)
  const ic = kind === 'stomach' ? col('#d8f0a0') : col('#f0d0ff');
  const cx = 7, cy = 6;
  for (let i = 0; i < 14; i++) {
    const ang = i * 0.7 + (kind === 'dizzy' ? t * 6 : t * 2), r = i * 0.28;
    a.put(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), ic);
  }
  const label = kind === 'stomach' ? 'TUMMY ACHE' : 'DIZZY';
  outlined(a, label, 14, 9, CREAM, OUT, { face: 'block', bold: false, spacing: 1 });
  // time left as pips
  const n = Math.max(0, Math.ceil(left * 5));
  for (let i = 0; i < 5; i++) a.rect(w - 14 + i * 2, 4, 1, 4, i < n ? CREAM : shadeC(fill, -0.3));
}

// ---------------------------------------------------------------- the widget

/** add the status plate and the edge tints to the HUD root */
export function mountBodyHud(root: HTMLElement, _who?: HTMLElement): BodyHud {
  // V12: hidden (nothing mounted) unless setBodyHud('always' | 'auto') brings it back
  if (mode === 'never') return { ownsPack: () => false, update() { /* */ }, destroy() { /* */ }, cheer() { /* */ } };
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const vign = (key: string, hex: string, k: number) => pxCanvas(`vign:${key}`, a => {
    const c = col(hex);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const dx = (x / a.w - 0.5) / 0.55, dy = (y / a.h - 0.5) / 0.52;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (dith(x, y, Math.max(0, Math.min(1, (d - 0.66) / 0.42)) * k)) a.put(x, y, c);
    }
  }, { cls: key });
  const dim = root.insertBefore(el('div', 'v10dim', vign('low', '#0a0402', 0.95) + vign('sick', '#3a5a10', 0.7) + vign('dizzy', '#4a2a6a', 0.7)), root.firstChild);
  const lowCv = dim.querySelector('.low') as HTMLElement, sickCv = dim.querySelector('.sick') as HTMLElement, dizzyCv = dim.querySelector('.dizzy') as HTMLElement;
  const box = root.appendChild(el('div', 'bh'));
  const plateW = new PxW(box, 'plate');
  const wtW = new PxW(box, 'wt off');
  const ailW = new PxW(box, 'ail off');
  plateW.el.title = `Mori: energy. Eat a snack (${EAT_KEY.replace('Key', '')})`;
  plateW.el.addEventListener('pointerdown', e => { e.stopPropagation(); if (!game.ui.blocking && shown()) void import('../../game/v10/forage10').then(m => m.quickEat()); });
  const st: FlaskSt = { level: energy() / maxEnergy(), tilt: 0, tiltV: 0, amp: 0.6, t: 0, bubbles: [], crack: 0, flash: 0, shown: 0 };
  let shownVal = energy(), acc = 0, blinkT = 3, blink = 0, cheerT = 0, lastExpr = '', lastOn: boolean | null = null, sweatT = 3;
  const off = onSpend(n => {
    if (n < 4) { st.amp = Math.min(2.5, st.amp + 0.6); return; }
    st.crack = 0.7; st.flash = 0.6; st.amp = 3;
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  });
  const playerId = () => (game.scene as unknown as { player?: { id?: string } } | null)?.player?.id ?? 'mori';
  return {
    ownsPack: () => false,
    cheer() { cheerT = 2.2; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); },
    update(dt: number) {
      st.t += dt;
      const on = shown();
      if (on !== lastOn) { lastOn = on; wtW.el.classList.toggle('off', !on); if (!on) { ailW.el.classList.add('off'); lowCv.classList.remove('on'); } }
      const f = Math.max(0, Math.min(1, energy() / maxEnergy()));
      const low = lowness();
      // the edge of the screen darkens and breathes as he tires; ailments tint it
      lowCv.classList.toggle('on', on && low > 0.05);
      lowCv.style.opacity = on && low > 0.05 ? (0.35 + low * 0.65).toFixed(2) : '';
      lowCv.classList.toggle('pulse', on && low > 0.55);
      sickCv.classList.toggle('on', on && hasAilment('stomach'));
      dizzyCv.classList.toggle('on', on && dizziness() > 0.05);
      // sweat drops on Mori when he's worn out
      if (on && low > 0.25) {
        sweatT -= dt;
        if (sweatT <= 0) {
          sweatT = 6 - low * 3 + Math.random() * 2;
          const p = (game.scene as unknown as { player?: { body?: { showEmote?(e: string, t?: number): void } }; cutscene?: boolean } | null);
          if (p && !p.cutscene && !game.ui.blocking) p.player?.body?.showEmote?.('sweat', 1.2);
        }
      }
      // the liquid: level eases to the energy, the surface leans against his speed and settles
      st.level += (f - st.level) * Math.min(1, dt * 3);
      const vx = (game.scene as unknown as { player?: { vx?: number } } | null)?.player?.vx ?? 0;
      const want = Math.max(-0.35, Math.min(0.35, -vx / 260));
      st.tiltV += ((want - st.tilt) * 40 - st.tiltV * 6) * dt;
      st.tilt += st.tiltV * dt;
      st.amp = Math.max(0.35 + Math.abs(vx) / 260, st.amp - dt * 1.5);
      st.crack = Math.max(0, st.crack - dt);
      st.flash = Math.max(0, st.flash - dt * 2);
      if (Math.random() < dt * (1.5 + low * 4)) st.bubbles.push({ x: 4 + Math.random() * 14, y: 52, v: 6 + Math.random() * 10 });
      for (const b of st.bubbles) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.6) * dt * 3; }
      st.bubbles = st.bubbles.filter(b => b.y > 8);
      // the number ticks toward the real value
      const target = energy();
      shownVal += (target - shownVal) * Math.min(1, dt * 6);
      if (Math.abs(target - shownVal) < 0.5) shownVal = target;
      blinkT -= dt;
      if (blinkT <= 0) { blink = 0.13; blinkT = 2.5 + Math.random() * 3; }
      blink = Math.max(0, blink - dt);
      cheerT = Math.max(0, cheerT - dt);
      // repaint at 30 fps
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      const ail = ailments();
      const sick = hasAilment('stomach'), dizzy = dizziness() > 0.05;
      const expr = cheerT > 0 ? 'happy' : sick ? 'worried' : dizzy ? 'scared' : on && f < 0.15 ? 'tired' : on && f < 0.3 ? 'worried' : 'neutral';
      if (expr !== lastExpr) { lastExpr = expr; }
      const blinkOn = Math.floor(st.t * 2.5) % 2 === 0;
      const lowNow = on && f < 0.25;
      const hour = hudHour() ?? 12;
      const id = playerId();
      const tagTxt = String(Math.max(0, Math.round(shownVal)));
      const tagW = Math.max(30, tw(tagTxt, { face: 'block', scale: 2, spacing: 1 }) + 10, tw('ENERGY', { face: 'block', bold: false, spacing: 1 }) + 4);
      const wPlate = on ? 78 + tagW + 2 : 46;
      plateW.draw(wPlate, 54, a => {
        paintMedallion(a, 23, 23, id, expr, blink > 0, hour, lowNow && blinkOn);
        paintRibbon(a, 23, 41, 'MORI');
        if (on) {
          paintFlask(a, 50, 3, st, f, lowNow, blinkOn);
          paintTag(a, 76, 8, shownVal, lowNow, blinkOn, lowNow ? `EAT ${EAT_KEY.replace('Key', '')}` : 'ENERGY');
        }
      });
      if (on) {
        const kg = packWeight(), cap = packCapacity();
        wtW.el.classList.toggle('heavy', kg > cap);
        wtW.draw(112, 18, a => paintScale(a, 112, kg, cap, st.t));
        const show = ail.filter(x => x.kind === 'stomach' || x.kind === 'dizzy');
        ailW.el.classList.toggle('off', !show.length);
        if (show.length) ailW.draw(112, show.length * 14, a => {
          show.forEach((x, i) => {
            const c = new Art(70, 13);
            paintChip(c, x.kind, Math.max(0, 1 - x.t / Math.max(0.01, x.dur)), st.t);
            a.blit(c, 0, i * 14);
          });
        });
      }
      void hudScale; void mixC; void shadeC;
    },
    destroy() {
      off();
      dim.remove();
      box.remove();
    },
  };
}
