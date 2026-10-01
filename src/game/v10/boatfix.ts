// V10 outboard repair close-up: Jenna brings the Kitten's two-stroke back from the dead, Dave the
// Diver style. Full screen, no panel: the motor on its sawhorse on the beach with the cowling off,
// the sea and the sky soft behind it, Mori's hands doing the work while Jenna coaches from the corner.
//  1. drain    unscrew the drain plug on the gearcase (alternate A / D, or tap left / right); seawater
//              and sand gush out
//  2. plug     scrub the salt crust off the spark plug with the wire brush (hold and rub left-right)
//  3. prime    squeeze the fuel bulb in rhythm (press as it fills back up); the line turns amber
//  4. start    pull the cord: hold to draw it back, let go in the green. Three pulls: cough,
//              splutter, PUTT-PUTT-PUTT
// Nothing can fail for good: a fumble just means another go. Resolves when the motor runs.

import { openCloseup, CW, CH, hx, mixc, put, blend, ramp, dith, hash } from '../../ui/v6/closeup';
import { Hold, loop } from '../../ui/v4/mini';
import { audio } from '../../core/audio';

const INK = hx('#1a1014');
const SKY = ['#5e86b8', '#78a0cc', '#94b8dc', '#b4d0e8', '#d8e6f0'].map(hx);
const SEA = ['#1e4a66', '#2a6684', '#3a82a0', '#58a0b8', '#86c0cc'].map(hx);
const SAND = ['#9a7a52', '#b89468', '#d2b07e', '#e6c896', '#f4dcae'].map(hx);
const ALU = ['#2a2e32', '#40464c', '#5c646a', '#7e878d', '#a4acb0', '#c8d0d2', '#eef2f2'].map(hx);
const BLK = ['#121014', '#1e1a20', '#2c2830', '#3c3842', '#504a56'].map(hx);
const WOOD = ['#3a2616', '#5a3e24', '#7a5634', '#9a7046', '#b88c5c', '#d4aa78'].map(hx);
const RED = ['#4a0e0c', '#761812', '#a2241a', '#c83826', '#e05a3a', '#f28e66'].map(hx);
const COP = ['#4a2212', '#72381c', '#9a5428', '#c07238', '#dc9656', '#f2c48c'].map(hx);
const SALT = ['#a8aca4', '#c8ccc4', '#e4e6de', '#f6f6f0'].map(hx);
const FUEL = ['#6a3a10', '#9a5a18', '#c88a2a', '#e8b448', '#f8dc88'].map(hx);
const SKIN = ['#8c392f', '#ba805d', '#d49672', '#f3a572', '#f8c090'].map(hx);
const SLEEVE = ['#1e2a3a', '#2c3c52', '#3c5068', '#506882'].map(hx);
const WATER = ['#2a5a6a', '#3a7a8a', '#5aa0aa', '#8ac8c8', '#c8eeee'].map(hx);
const PINK = hx('#e876a8');

type Stage = 'drain' | 'plug' | 'prime' | 'start';

interface Drop { x: number; y: number; vx: number; vy: number; life: number; c: number; s: number }

export async function runOutboardRepair(): Promise<void> {
  const c = openCloseup();
  const buf = c.buf;
  const hold = new Hold(c.wrap);
  // A / D (or the two halves of the screen) for the plug and the brush
  let dir = 0, tapL = false, tapR = false;
  const kd = (e: KeyboardEvent) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { if (dir !== -1) tapL = true; dir = -1; e.preventDefault(); }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { if (dir !== 1) tapR = true; dir = 1; e.preventDefault(); }
  };
  const ku = (e: KeyboardEvent) => { if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(e.code)) dir = 0; };
  const pd = (e: PointerEvent) => { const left = e.clientX < window.innerWidth / 2; if (left) tapL = true; else tapR = true; dir = left ? -1 : 1; };
  const pu = () => { dir = 0; };
  window.addEventListener('keydown', kd, true);
  window.addEventListener('keyup', ku, true);
  c.wrap.addEventListener('pointerdown', pd);
  window.addEventListener('pointerup', pu);
  const touch = matchMedia('(pointer: coarse)').matches;
  const say = (t: string, o: { shout?: boolean; ms?: number } = {}) => c.say('Jenna', t, { color: '#e876a8', ...o });

  let stage: Stage = 'drain';
  let T = 0;
  const drops: Drop[] = [];
  // state per job
  let plugTurn = 0, lastTap = 0, gush = 0;
  const crust = new Float32Array(64);
  for (let i = 0; i < crust.length; i++) crust[i] = 0.7 + hash(i, 3) * 0.3;
  let brushX = 0, brushV = 0, scrubT = 0;
  let bulb = 0, bulbFill = 1, primed = 0;
  let pull = 0, pulls = 0, pullState: 'ready' | 'drawing' | 'snap' = 'ready', zone = [0.62, 0.82] as [number, number], swing = 0, runK = 0, cough = 0, smoke: Drop[] = [];
  let shake = 0, camX = 0, camTX = 0, done = false;
  const view: Record<Stage, number> = { drain: 0, plug: 40, prime: -36, start: 0 };

  const hint = (h: string, ms = 4200) => c.hint(h, ms);
  say('Drain plug first. Bottom of the leg. Lefty-loosey!');
  hint(touch ? 'Tap <b>left</b> and <b>right</b> in turn to unscrew the drain plug' : 'Press <span class="key">A</span> and <span class="key">D</span> in turn to unscrew the drain plug');

  await new Promise<void>(res => {
    loop((dt) => {
      if (c.closed) { res(); return false; }
      T += dt;
      camX += (camTX - camX) * Math.min(1, dt * 3);
      shake = Math.max(0, shake - dt * 3);
      // ---------------------------------------------------------------- the jobs
      if (stage === 'drain') {
        camTX = view.drain;
        // alternate taps turn the plug an eighth each
        const tap = tapL ? -1 : tapR ? 1 : 0;
        tapL = tapR = false;
        if (tap && tap !== lastTap && plugTurn < 1) {
          lastTap = tap;
          plugTurn = Math.min(1, plugTurn + 0.085);
          audio.play('reelClick', { vol: 0.4, pitch: 0.7 + plugTurn * 0.5 });
          shake = 0.2;
          if (plugTurn >= 1) { gush = 2.4; audio.play('splashBig', { vol: 0.5, pitch: 1.3 }); say('EW. Ew ew ew. That’s the ocean. That was INSIDE her.', { shout: true }); }
        } else if (tap && tap === lastTap && plugTurn < 1) { audio.play('reelClick', { vol: 0.15, pitch: 0.5 }); }
        if (gush > 0) {
          gush -= dt;
          const k = Math.min(1, gush);
          for (let i = 0; i < 6 * k + 1; i++) drops.push({ x: 196 - camX + Math.random() * 3, y: 148, vx: -12 + Math.random() * 30 * k, vy: 10 + Math.random() * 30, life: 1.2, c: Math.random() < 0.3 ? SAND[2] : WATER[1 + Math.floor(Math.random() * 3)], s: 1 });
          if (gush <= 0) {
            stage = 'plug'; T = 0;
            say('Now the spark plug. It’s wearing a little salt jumper. Take it off.');
            hint(touch ? 'Hold and <b>rub left and right</b> to scrub the salt off' : 'Hold <span class="key">Space</span> and rub with <span class="key">A</span> <span class="key">D</span> to scrub the salt off');
          }
        }
      } else if (stage === 'plug') {
        camTX = view.plug;
        // the brush follows A/D (or the side you hold); scrubbing needs Space / a held press
        const want = dir * 26;
        brushV += ((want - brushX) * 18 - brushV * 6) * dt;
        brushX += brushV * dt;
        brushX = Math.max(-26, Math.min(26, brushX));
        const scrubbing = (hold.down || dir !== 0) && Math.abs(brushV) > 20;
        if (scrubbing) {
          scrubT -= dt;
          if (scrubT <= 0) { scrubT = 0.09; audio.play('rustle', { vol: 0.25, pitch: 1.6 + Math.random() * 0.4 }); }
          const ci = Math.floor(((brushX + 26) / 52) * crust.length);
          for (let i = Math.max(0, ci - 5); i < Math.min(crust.length, ci + 5); i++) crust[i] = Math.max(0, crust[i] - dt * 1.6);
          if (Math.random() < dt * 30) drops.push({ x: 160 + brushX - camX, y: 86 + Math.random() * 10, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20, life: 0.6, c: SALT[1 + Math.floor(Math.random() * 3)], s: 1 });
        }
        hold.hit();
        const left = crust.reduce((a, v) => a + v, 0) / crust.length;
        if (left < 0.06) {
          for (let i = 0; i < crust.length; i++) crust[i] = 0;
          stage = 'prime'; T = 0;
          audio.play('collectPop', { vol: 0.5 });
          say('SHINY. Plug back in. Now squeeze the fuel bulb. Squeeze, let it fill, squeeze.');
          hint(touch ? '<b>Tap</b> when the bulb has filled back up' : 'Press <span class="key">Space</span> when the bulb has filled back up');
        }
      } else if (stage === 'prime') {
        camTX = view.prime;
        tapL = tapR = false;
        bulb = Math.max(0, bulb - dt * 3.5);
        bulbFill = Math.min(1, bulbFill + dt * 1.15);
        if (hold.hit()) {
          if (bulbFill > 0.82) {
            primed = Math.min(1, primed + 0.21);
            audio.play('bubble', { vol: 0.5, pitch: 0.7 + primed * 0.4 });
            bulb = 1; bulbFill = 0;
            if (primed >= 1) {
              stage = 'start'; T = 0; pulls = 0;
              say('Fuel’s in. Now pull the cord. Smooth, then let go when it bites. In the GREEN.');
              hint(touch ? '<b>Hold</b> to draw the cord back, <b>let go</b> in the green' : 'Hold <span class="key">Space</span> to draw the cord back, let go in the green');
            }
          } else {
            bulb = 0.5; bulbFill = Math.max(0, bulbFill - 0.3);
            audio.play('wrong', { vol: 0.25 });
            if (Math.random() < 0.4) say('Patience! Let it fill back up first.', { ms: 1800 });
          }
        }
      } else if (stage === 'start') {
        camTX = view.start;
        tapL = tapR = false;
        hold.hit();
        if (pullState === 'ready' && hold.down) { pullState = 'drawing'; swing = 0; audio.play('rope', { vol: 0.4, pitch: 0.8 }); }
        if (pullState === 'drawing') {
          // the draw speeds up as it goes, so the green is a moment, not a place
          swing += dt * (0.75 + pull * 1.3);
          pull = Math.min(1, swing);
          if (!hold.down || pull >= 1) {
            pullState = 'snap';
            const good = pull >= zone[0] && pull <= zone[1];
            if (good) {
              pulls++;
              shake = 0.6 + pulls * 0.3;
              if (pulls === 1) { audio.play('engine', { vol: 0.35, pitch: 0.6 }); cough = 0.6; say('Cough! She coughed! Again!'); }
              else if (pulls === 2) { audio.play('engine', { vol: 0.45, pitch: 0.8 }); cough = 1.2; for (let i = 0; i < 18; i++) smoke.push({ x: 120 - camX, y: 56, vx: -20 + Math.random() * 20, vy: -10 - Math.random() * 14, life: 2 + Math.random(), c: BLK[3], s: 2 + Math.random() * 2 }); say('Splutter! SO close! One more!', { shout: true }); }
              else { runK = 0.01; audio.setEngine(0.75); done = true; void finish(); }
              zone = [0.55 + Math.random() * 0.2, 0]; zone[1] = zone[0] + 0.18 - pulls * 0.02;
            } else {
              audio.play('rope', { vol: 0.3, pitch: 1.4 });
              say(pull < zone[0] ? 'Too soon! Pull it ALL the way.' : 'Too far, it slipped! Let go in the green!', { ms: 2200 });
            }
          }
        }
        if (pullState === 'snap') { pull = Math.max(0, pull - dt * 5); if (pull <= 0) pullState = 'ready'; }
        if (runK > 0) runK = Math.min(1, runK + dt * 0.8);
      }
      cough = Math.max(0, cough - dt);
      // ---------------------------------------------------------------- particles
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 160 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
        if (d.y > 170) { d.y = 170; d.vy *= -0.2; d.vx *= 0.5; }
        if (d.life <= 0) drops.splice(i, 1);
      }
      if (runK > 0 && Math.random() < dt * 20) smoke.push({ x: 108 - camX + Math.random() * 6, y: 60, vx: -30 - Math.random() * 20, vy: -8 - Math.random() * 10, life: 1.6, c: BLK[4], s: 1.5 + Math.random() * 2 });
      for (let i = smoke.length - 1; i >= 0; i--) { const d = smoke[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.s += dt * 2; d.life -= dt; if (d.life <= 0) smoke.splice(i, 1); }
      // ---------------------------------------------------------------- draw
      draw();
      c.present();
      return true;
    });

    async function finish() {
      say('PUTT-PUTT-PUTT-PUTT! SHE LIVES!', { shout: true, ms: 3000 });
      await new Promise(r => setTimeout(r, 900));
      await c.result('PUTT-PUTT!', 'The outboard runs');
      audio.setEngine(0);
      await c.close();
      res();
    }
  });

  window.removeEventListener('keydown', kd, true);
  window.removeEventListener('keyup', ku, true);
  c.wrap.removeEventListener('pointerdown', pd);
  window.removeEventListener('pointerup', pu);
  hold.dispose();
  audio.setEngine(0);

  // ------------------------------------------------------------------ painting
  function draw() {
    const sh = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 4) : 0;
    const vib = runK > 0 ? Math.round(Math.sin(T * 90) * 1.2 * runK) : 0;
    const ox = -Math.round(camX) + sh, oy = sh + vib;
    // sky, sea, sand: soft and out of focus behind the motor
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        let col: number;
        const hz = 64;
        if (y < hz) col = ramp(SKY, 1 - y / hz * 0.9, x, y);
        else if (y < 96) col = ramp(SEA, 0.25 + ((y - hz) / 32) * 0.65 + Math.sin(x * 0.07 + T * 0.8 + y) * 0.04, x, y);
        else col = ramp(SAND, 0.75 - (y - 96) / 120 + (hash(x >> 2, y >> 2) - 0.5) * 0.1, x, y);
        buf[y * CW + x] = col;
      }
      // soft surf line
      if (y === 95 || y === 96) for (let x = 0; x < CW; x++) if (Math.sin(x * 0.11 + T * 1.3) > -0.3) buf[y * CW + x] = mixc(buf[y * CW + x], hx('#ffffff'), 0.5);
    }
    // the sawhorse
    for (const [x0, x1] of [[150, 136], [230, 244]] as const) for (let y = 120; y < CH; y++) { const x = Math.round(x0 + (x1 - x0) * ((y - 120) / 60)); for (let k = 0; k < 7; k++) put(buf, x + k + ox, y + oy, ramp(WOOD, 0.3 + k / 10, x + k, y)); }
    for (let x = 128; x < 262; x++) for (let y = 112; y < 122; y++) put(buf, x + ox, y + oy, ramp(WOOD, 0.75 - (y - 112) / 14, x, y));
    drawMotor(ox, oy);
    // drops and smoke
    for (const d of drops) for (let k = 0; k < d.s; k++) put(buf, Math.round(d.x) + ox + k, Math.round(d.y) + oy, d.c);
    for (const d of smoke) { const a = Math.min(1, d.life) * 0.5; for (let j = -d.s; j <= d.s; j++) for (let i = -d.s; i <= d.s; i++) if (i * i + j * j <= d.s * d.s) blend(buf, Math.round(d.x + i) + ox, Math.round(d.y + j) + oy, d.c, a); }
    drawHands(ox, oy);
    drawGauges();
  }

  function drawMotor(ox: number, oy: number) {
    // powerhead block (cowling off): dark engine, the flywheel on top, the plug on the side
    const X = 190, Y = 40;
    for (let y = Y; y < Y + 46; y++) for (let x = X - 38; x < X + 26; x++) {
      const nx = (x - (X - 6)) / 32, ny = (y - (Y + 23)) / 23;
      if (nx * nx + ny * ny * 0.6 > 1) continue;
      put(buf, x + ox, y + oy, ramp(BLK, 0.55 - nx * 0.3 - ny * 0.25 + ((x + y) % 7 === 0 ? -0.15 : 0), x, y));
    }
    // flywheel with its timing mark
    const fy = Y - 2, fx = X - 6, rot = T * (runK > 0 ? 30 : pullState === 'drawing' ? pull * 6 : cough > 0 ? 8 : 0);
    for (let y = fy - 6; y <= fy + 4; y++) for (let x = fx - 26; x <= fx + 26; x++) {
      const nx = (x - fx) / 26, ny = (y - fy) / 6;
      if (nx * nx + ny * ny > 1) continue;
      let col = ramp(ALU, 0.6 - ny * 0.25 + nx * 0.15, x, y);
      const a = Math.atan2(ny, nx) + rot;
      if (Math.abs(Math.sin(a * 6)) > 0.96) col = ALU[2];
      put(buf, x + ox, y + oy, col);
    }
    // recoil starter cord and handle
    const hx0 = X - 40, hy0 = Y + 6;
    const hpx = hx0 - pull * 70, hpy = hy0 + pull * 26;
    for (let i = 0; i <= 30; i++) { const t = i / 30; put(buf, Math.round(hx0 + (hpx - hx0) * t) + ox, Math.round(hy0 + (hpy - hy0) * t + Math.sin(t * Math.PI) * 3 * (1 - pull)) + oy, hx('#e8e0c8')); }
    for (let y = -2; y <= 2; y++) for (let x = -5; x <= 5; x++) put(buf, Math.round(hpx) + x + ox, Math.round(hpy) + y + oy, ramp(RED, 0.6 - y * 0.15, x, y));
    // the spark plug: white porcelain, the hex, the crust of salt
    const px = 160, py = 78;
    for (let i = 0; i < 52; i++) {
      const x = px - 26 + i;
      for (let y = py; y < py + 14; y++) {
        let col = i < 18 ? ramp(ALU, 0.4 + (y - py) / 30, x, y) : i < 26 ? ramp(ALU, 0.75 - (y - py) / 40, x, y) : ramp(SALT, 0.9 - (y - py) / 30, x, y);
        if (i < 18 && (i % 4 === 0)) col = COP[3 + ((y - py) % 2)];
        const ci = Math.floor((i / 52) * crust.length);
        if (crust[ci] > 0.05 && hash(x, y, 7) < crust[ci] * 0.95) col = ramp(SALT, 0.3 + hash(x, y, 9) * 0.6, x, y);
        put(buf, x + ox, y + oy, col);
      }
    }
    // HT lead to the plug
    for (let x = px + 26; x < px + 44; x++) { put(buf, x + ox, py + 5 + oy, BLK[1]); put(buf, x + ox, py + 6 + oy, BLK[2]); }
    // midsection and leg down to the gearcase, the drain plug
    for (let y = Y + 44; y < 168; y++) for (let x = X - 14; x < X + 8; x++) {
      const w = y > 140 ? 13 : 9;
      if (Math.abs(x - (X - 3)) > w) continue;
      put(buf, x + ox, y + oy, ramp(ALU, 0.62 - (x - (X - 3)) / 30 + (y > 140 ? -0.08 : 0), x, y));
    }
    for (let x = X - 30; x < X + 12; x++) for (let y = 138; y < 142; y++) put(buf, x + ox, y + oy, ramp(ALU, 0.8 - (y - 138) / 8, x, y));
    // drain plug (turns as you unscrew it; gone once it is out)
    if (plugTurn < 1) {
      const dx = 196, dy = 150, ang = plugTurn * Math.PI * 4;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        if (Math.abs(i) + Math.abs(j) * 0.6 > 5) continue;
        const a = Math.atan2(j, i) + ang;
        put(buf, dx + i + ox, dy + j + oy, Math.cos(a * 3) > 0.5 ? ALU[5] : ALU[3]);
      }
      put(buf, dx + ox + Math.round(Math.cos(ang) * 3), dy + oy + Math.round(Math.sin(ang) * 3), INK);
    } else for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) put(buf, 196 + i + ox, 150 + j + oy, INK);
    // fuel line and the primer bulb
    const bx = 108, by = 96;
    for (let x = bx + 10; x < X - 30; x++) put(buf, x + ox, by + Math.round(Math.sin(x * 0.08) * 2) + oy, primed > (x - bx) / 70 ? FUEL[3] : BLK[2]);
    const sq = 1 - bulb * 0.45;
    for (let j = -8; j <= 8; j++) for (let i = -12; i <= 12; i++) {
      const nx = i / 12, ny = j / (8 * sq);
      if (nx * nx + ny * ny > 1) continue;
      put(buf, bx + i + ox, by + j + oy, ramp(BLK, 0.5 - ny * 0.3 + (1 - bulbFill) * -0.2, i, j));
    }
    if (stage === 'prime') {
      // the fill ring: green once the bulb has filled back up
      const r = 15;
      for (let a = 0; a < Math.PI * 2 * bulbFill; a += 0.05) put(buf, Math.round(bx + Math.cos(a - Math.PI / 2) * r) + ox, Math.round(by + Math.sin(a - Math.PI / 2) * r * 0.7) + oy, bulbFill > 0.82 ? hx('#6ae080') : hx('#e8d8a0'));
    }
    // Jenna's cat sticker on the cowling, lying on the sand
    for (let y = 150; y < 166; y++) for (let x = 40; x < 84; x++) {
      const nx = (x - 62) / 22, ny = (y - 160) / 7;
      if (nx * nx + ny * ny > 1) continue;
      put(buf, x + ox, y + oy, ramp(['#8a9096', '#b8c0c4', '#dce2e4', '#f4f6f6'].map(hx), 0.7 - ny * 0.3, x, y));
    }
    for (const [i, j] of [[0, 0], [1, 0], [-1, -1], [2, -1], [0, 1], [1, 1]]) put(buf, 60 + i + ox, 157 + j + oy, PINK);
  }

  function drawHands(ox: number, oy: number) {
    // Mori's forearm and hand reaching in from the bottom right, posed per job
    let hxp = 0, hyp = 0;
    if (stage === 'drain') { hxp = 204; hyp = 156; }
    else if (stage === 'plug') { hxp = 160 + brushX; hyp = 96; }
    else if (stage === 'prime') { hxp = 116; hyp = 104; }
    else { hxp = 150 - pull * 70; hyp = 52 + pull * 26; }
    const ax = hxp + 60, ay = CH + 10;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = ax + (hxp - ax) * t, y = ay + (hyp - ay) * t;
      const w = t > 0.8 ? 5 : 7;
      for (let k = -w; k <= w; k++) put(buf, Math.round(x + k * 0.7) + ox, Math.round(y + k * 0.5) + oy, t > 0.82 ? ramp(SKIN, 0.6 - k / 14, x, y) : ramp(SLEEVE, 0.6 - k / 16, x, y));
    }
    // the tool in hand: a wire brush for the plug
    if (stage === 'plug') {
      for (let x = -10; x <= 10; x++) for (let y = -14; y <= -10; y++) put(buf, Math.round(hxp + x) + ox, Math.round(hyp + y) + oy, ramp(WOOD, 0.6 - (y + 14) / 8, x, y));
      for (let x = -9; x <= 9; x += 2) for (let y = -9; y <= -7; y++) put(buf, Math.round(hxp + x) + ox, Math.round(hyp + y) + oy, ALU[5]);
    }
  }

  function drawGauges() {
    // the pull meter: a bar with the green zone, during the start
    if (stage === 'start') {
      const x0 = 20, y0 = 24, w = 10, h = 110;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = 1 - y / h;
        let col = hx('#2a2430');
        if (v >= zone[0] && v <= zone[1]) col = hx('#3ac060');
        if (v <= pull) col = mixc(col, hx('#f4e0a0'), 0.6);
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) col = INK;
        put(buf, x0 + x, y0 + y, col);
      }
      for (let i = 0; i < 3; i++) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) put(buf, 18 + i * 7 + x, 140 + y, i < pulls ? hx('#f8dc88') : hx('#3a3440'));
    }
    if (stage === 'plug') {
      // how much salt is left
      const left = crust.reduce((a, v) => a + v, 0) / crust.length;
      for (let x = 0; x < 80; x++) for (let y = 0; y < 5; y++) put(buf, 120 + x, 160 + y, x / 80 < 1 - left ? hx('#6ae080') : hx('#2a2430'));
    }
    void dith;
  }
}
