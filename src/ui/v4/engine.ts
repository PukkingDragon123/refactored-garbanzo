// Engine repair with Jenna: four quick stages, Jenna coaching from her tablet the whole way.
//  1. Unstick the fuel valve  - alternate A / D (or tap the left and right side) to crank it round
//  2. Bleed the air lock      - hold to open the bleed screw, let go while the needle is in the green
//  3. Replace the blown fuse  - pick the right fuse (Jenna is only mostly sure which colour)
//  4. Start her up            - press three times as the marker crosses the zone

import { openMini, pixelCanvas, Hold, loop, wait, px, portraitCanvas } from './mini';
import { audio } from '../../core/audio';
import { peopleArt } from '../../world/actor';
import { game } from '../../game/game';

type Stage = 'valve' | 'bleed' | 'fuse' | 'start';
const STAGES: Stage[] = ['valve', 'bleed', 'fuse', 'start'];

export async function runEngineRepair(o: { onStep?: (k: string) => void | Promise<void> } = {}): Promise<boolean> {
  const m = openMini('engine', `<h3>Engine Repair</h3><div class="steps">${STAGES.map(() => '<i></i>').join('')}</div><div class="say"><canvas></canvas><div class="t"></div></div><div class="stage"></div><div class="res"></div><div class="hint"></div>`);
  const W = 160, H = 96;
  const { g, cv } = pixelCanvas(m.box.querySelector('.stage') as HTMLElement, W, H, 4);
  const sayT = m.box.querySelector('.say .t') as HTMLElement;
  const sayC = m.box.querySelector('.say canvas') as HTMLCanvasElement;
  const hint = m.box.querySelector('.hint') as HTMLElement;
  const res = m.box.querySelector('.res') as HTMLElement;
  const steps = [...m.box.querySelectorAll('.steps i')] as HTMLElement[];
  const hold = new Hold(cv);
  const art = peopleArt();
  const jenna = (expr: string, text: string) => {
    sayT.innerHTML = `<b>JENNA:</b> ${text}`;
    if (art) {
      const c = portraitCanvas(art.renderPortrait('jenna', expr));
      sayC.width = c.width; sayC.height = c.height;
      sayC.getContext('2d')!.drawImage(c, 0, 0);
    }
  };
  let stage = 0;
  let shake = 0;
  // shared scene: engine block backdrop
  const backdrop = (t: number) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px2 = x % 32, py2 = y % 22;
      px.dot(g, x, y, px2 === 0 || py2 === 0 ? '#3e4c52' : (px2 === 1 || py2 === 1) ? '#6a7a80' : '#56666c');
    }
    // pipes
    px.rect(g, 0, 8, W, 4, '#8a4a2a'); px.rect(g, 0, 8, W, 1, '#b0643a');
    px.rect(g, 0, 16, W, 3, '#6a7a80');
    // warm caged bulb
    const k = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 7);
    g.globalAlpha = 0.25 * k; px.ell(g, 140, 26, 26, 22, '#ffb060'); g.globalAlpha = 1;
    px.ell(g, 140, 24, 3, 3, '#ffe8a0');
  };
  // stage state
  let valveA = 0, valveProg = 0, lastSide = 0;
  let needle = 0.1, bleedOpen = false, bleedDone = false, sprayT = 0;
  const fuses = [
    { col: '#d83a3a', a: 10 }, { col: '#3a78e0', a: 15 }, { col: '#e8c040', a: 20 }, { col: '#4ab04a', a: 30 },
  ];
  let fusePick = -1, fuseDone = false, zapT = 0;
  let markT = 0, hits = 0, missT = 0, cough = 0;
  let done = false, fail = false;

  const kd = (e: KeyboardEvent) => {
    if (STAGES[stage] !== 'valve') {
      if (STAGES[stage] === 'fuse' && /^Digit[1-4]$/.test(e.code)) pickFuse(+e.code.slice(5) - 1);
      return;
    }
    const side = e.code === 'KeyA' || e.code === 'ArrowLeft' ? -1 : e.code === 'KeyD' || e.code === 'ArrowRight' ? 1 : 0;
    if (side) { e.preventDefault(); crank(side); }
  };
  const crank = (side: number) => {
    if (side === lastSide) { shake = 0.1; return; }
    lastSide = side;
    valveProg = Math.min(1, valveProg + 0.085);
    valveA += 0.5;
    audio.play('woodCreak', { vol: 0.3, pitch: 1.4 + Math.random() * 0.3 });
    if (valveProg >= 1) next();
  };
  const pd = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    if (STAGES[stage] === 'valve') crank(x < W / 2 ? -1 : 1);
    else if (STAGES[stage] === 'fuse') {
      for (let i = 0; i < 4; i++) { const fx = 26 + i * 20; if (x > fx - 5 && x < fx + 6 && y > 64 && y < 90) pickFuse(i); }
    }
  };
  window.addEventListener('keydown', kd, true);
  cv.addEventListener('pointerdown', pd);

  const pickFuse = (i: number) => {
    if (fuseDone) return;
    fusePick = i;
    if (fuses[i].a === 15) {
      fuseDone = true;
      audio.play('place', { vol: 0.6 });
      jenna('excited', 'Blue! Fifteen amps! I KNEW that. I totally knew that.');
      setTimeout(next, 900);
    } else {
      zapT = 0.4;
      shake = 0.35;
      audio.play('alert', { vol: 0.5 });
      game.r.post.flash = 0.2;
      jenna('shocked', fuses[i].a < 15 ? 'NOT THAT ONE! That’s a ten, it’ll just blow again!' : 'Too big! That’s how boats catch fire, Mori!');
      setTimeout(() => { if (!fuseDone) fusePick = -1; }, 450);
    }
  };

  const enter = (i: number) => {
    steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
    const k = STAGES[i];
    void o.onStep?.(k);
    res.textContent = '';
    if (k === 'valve') { jenna('determined', 'The fuel valve’s seized! Crank it! Left, right, left, right!'); hint.innerHTML = 'Alternate <span class="key">A</span> <span class="key">D</span> (or tap left / right)'; }
    if (k === 'bleed') { jenna('worried', 'Now bleed the air out. Open the screw... and stop when the needle hits the green. NOT past it!'); hint.innerHTML = 'Hold <span class="key">Space</span>, release in the green'; }
    if (k === 'fuse') { jenna('thinking', 'Fuse F3 is toast. It needs a fifteen amp... Dad colour-codes them... it’s the... blue one? Blue is fifteen!'); hint.innerHTML = 'Click the right fuse (or press <span class="key">1</span>-<span class="key">4</span>)'; }
    if (k === 'start') { jenna('excited', 'Okay okay okay! When I say NOW, hit the starter! Three good cranks!'); hint.innerHTML = 'Press <span class="key">Space</span> when the marker is in the zone (3x)'; }
  };
  const next = () => {
    if (stage >= STAGES.length - 1) { done = true; steps.forEach(s => { s.classList.remove('on'); s.classList.add('done'); }); return; }
    stage++;
    audio.play('star', { vol: 0.4 });
    enter(stage);
  };
  enter(0);

  await new Promise<void>(resolve => {
    loop((dt, t) => {
      if (m.closed) { fail = true; resolve(); return false; }
      shake = Math.max(0, shake - dt);
      zapT = Math.max(0, zapT - dt);
      sprayT = Math.max(0, sprayT - dt);
      g.save();
      if (shake > 0) g.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 3));
      backdrop(t);
      const k = STAGES[stage];
      if (k === 'valve') {
        // pipe + big red wheel
        px.rect(g, 0, 50, W, 10, '#8a9aa0'); px.rect(g, 0, 50, W, 2, '#b8c4c8'); px.rect(g, 0, 58, W, 2, '#5a6a70');
        px.rect(g, 74, 40, 12, 30, '#6a7a80');
        const cx = 80, cy = 55;
        for (let a = 0; a < Math.PI * 2; a += 0.02) {
          for (let r = 17; r < 21; r++) px.dot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r > 19 ? '#8a2a22' : r > 18 ? '#c8403a' : '#e0564a');
        }
        for (let i = 0; i < 4; i++) {
          const a = valveA + (i * Math.PI) / 2;
          for (let r = 3; r < 18; r++) px.dot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, '#c8403a');
        }
        px.ell(g, cx, cy, 4, 4, '#b8c4c8');
        // progress
        px.rect(g, 30, 84, 100, 6, '#2a1c14'); px.rect(g, 31, 85, 98 * valveProg, 4, '#e8b840');
        px.text(g, 'L', 14, 50, '#ffe8a0', 10); px.text(g, 'R', 140, 50, '#ffe8a0', 10);
      } else if (k === 'bleed') {
        // gauge
        const cx = 80, cy = 62;
        px.ell(g, cx, cy, 30, 30, (nx, ny) => (Math.hypot(nx, ny) > 0.88 ? '#c8a048' : '#f4efe4'));
        for (let a = -2.4; a <= -0.74; a += 0.01) { const z = (a + 2.4) / 1.66; const col = z > 0.72 && z < 0.86 ? '#4ab04a' : z > 0.86 ? '#d83a3a' : '#c8c0b0'; for (let r = 20; r < 25; r++) px.dot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, col); }
        if (!bleedDone) {
          if (hold.down) { bleedOpen = true; needle = Math.min(1.05, needle + dt * 0.42); if (Math.random() < 0.5) audio.play('hiss', { vol: 0.12, pitch: 1.6 }); }
          else if (bleedOpen) {
            bleedOpen = false;
            if (needle > 0.72 && needle < 0.86) { bleedDone = true; res.textContent = 'Air out!'; jenna('happy', 'Perfect! Hear that? That’s the sound of no more bubbles!'); setTimeout(next, 1000); }
            else if (needle >= 0.86) { sprayT = 1; needle = 0.2; res.textContent = 'PSSHHH!'; res.classList.add('bad'); jenna('laugh', 'Pffft! Diesel on your glasses! Again, again!'); audio.play('hiss', { vol: 0.6 }); shake = 0.3; }
            else { res.textContent = 'A bit more...'; res.classList.add('bad'); }
          } else needle = Math.max(0.1, needle - dt * 0.08);
          if (needle > 1) { sprayT = 1; needle = 0.2; bleedOpen = false; audio.play('hiss', { vol: 0.6 }); jenna('laugh', 'PAST THE RED! Spray! Oh no. Oh no, that’s so funny. Try again!'); }
        }
        const na = -2.4 + needle * 1.66;
        for (let r = 0; r < 22; r++) px.dot(g, cx + Math.cos(na) * r, cy + Math.sin(na) * r, '#2a2024');
        px.ell(g, cx, cy, 3, 3, '#2a2024');
        if (bleedOpen) for (let i = 0; i < 4; i++) px.dot(g, 118 + Math.random() * 10, 50 - Math.random() * 20, '#dff4ff');
        if (sprayT > 0) { g.globalAlpha = sprayT * 0.6; px.rect(g, 0, 0, W, H, '#6a5a2a'); g.globalAlpha = 1; }
        px.text(g, 'PSI', cx, cy + 10, '#6a4a2a', 7, 'center');
      } else if (k === 'fuse') {
        // fuse box with the blown slot, tray of four fuses
        px.rect(g, 40, 14, 80, 42, '#8a9aa0'); px.rect(g, 43, 17, 74, 36, '#2a2630');
        for (let i = 0; i < 6; i++) { const x = 48 + i * 11; const blown = i === 2; px.rect(g, x, 26, 7, 14, blown ? (fuseDone ? fuses[1].col : '#141014') : ['#d83a3a', '#e8c040', '#3a78e0', '#4ab04a', '#e8c040', '#d83a3a'][i]); if (blown && !fuseDone) px.text(g, 'F3', x + 3, 42, '#ff8a70', 6, 'center'); }
        if (zapT > 0) for (let i = 0; i < 6; i++) px.dot(g, 70 + Math.random() * 20, 22 + Math.random() * 22, '#fff0a0');
        px.rect(g, 12, 62, 136, 30, '#6e4c32'); px.rect(g, 12, 62, 136, 2, '#8a6444');
        fuses.forEach((f, i) => {
          const x = 26 + i * 20, y = 66 + (fusePick === i ? -4 : Math.sin(t * 3 + i) > 0.9 ? -1 : 0);
          if (fuseDone && i === 1) return;
          px.rect(g, x - 3, y, 7, 12, f.col); px.rect(g, x - 3, y, 2, 12, '#ffffff55');
          px.rect(g, x - 1, y + 12, 1, 4, '#c8c8c8'); px.rect(g, x + 1, y + 12, 1, 4, '#c8c8c8');
          px.text(g, String(f.a), x, y + 3, '#1a1014', 6, 'center');
          px.text(g, String(i + 1), x, 84, '#f4e0c0', 6, 'center');
        });
      } else if (k === 'start') {
        // starter panel with a sweeping marker
        px.rect(g, 20, 20, 120, 50, '#2a2630'); px.rect(g, 22, 22, 116, 46, '#3a3640');
        markT += dt * (1.3 + hits * 0.35);
        const mx = 30 + (Math.sin(markT * 2.2) * 0.5 + 0.5) * 100;
        const z0 = 72, z1 = 92;
        px.rect(g, 30, 40, 100, 10, '#1a1418');
        px.rect(g, z0, 40, z1 - z0, 10, '#4ab04a');
        px.rect(g, mx - 1, 36, 3, 18, '#ffe8a0');
        for (let i = 0; i < 3; i++) px.ell(g, 64 + i * 16, 62, 4, 4, i < hits ? '#7aff9a' : '#141014');
        missT = Math.max(0, missT - dt);
        cough = Math.max(0, cough - dt);
        if (cough > 0) for (let i = 0; i < 5; i++) { g.globalAlpha = cough; px.ell(g, 140 + Math.random() * 10, 16 - Math.random() * 10, 3, 3, '#6a6a70'); g.globalAlpha = 1; }
        if (hold.hit() && !done) {
          if (mx >= z0 && mx <= z1) {
            hits++;
            cough = 0.8;
            shake = 0.25;
            audio.play('engine', { vol: 0.4 + hits * 0.15, pitch: 0.7 + hits * 0.1 });
            res.textContent = ['Cough!', 'Splutter!', 'VROOOM!'][hits - 1];
            res.classList.remove('bad');
            if (hits >= 3) { jenna('excited', 'SHE LIVES!!!'); setTimeout(() => { done = true; }, 900); }
            else jenna('excited', hits === 1 ? 'Ooh! Again! NOW!' : 'Almost! One more! NOW NOW NOW!');
          } else {
            missT = 0.4;
            res.textContent = 'Clunk.';
            res.classList.add('bad');
            audio.play('wrong', { vol: 0.4 });
            jenna('worried', 'Wait for it... wait for it...');
          }
        }
      }
      g.restore();
      if (k !== 'start') hold.hit();
      if (done) { resolve(); return false; }
      return true;
    });
  });
  window.removeEventListener('keydown', kd, true);
  cv.removeEventListener('pointerdown', pd);
  hold.dispose();
  await wait(300);
  m.close();
  return !fail;
}
