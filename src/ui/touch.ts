// On-screen controls for touch devices: a floating pixel joystick on the left, a console-style
// action cluster on the right that changes with context (walking / camera raised), and a small
// menu bar on top. Everything drives the same virtual keys the keyboard uses.

import { game } from '../game/game';
import { el } from './ui';

// ---- tiny pixel icons (8x8 bitmaps -> data URLs) ----
const ICONS: Record<string, string[]> = {
  jump: ['...##...', '..####..', '.######.', '########', '...##...', '...##...', '...##...', '...##...'],
  hand: ['..#.#...', '.##.##..', '.##.##.#', '.######.', '.######.', '..#####.', '..####..', '..####..'],
  cam: ['........', '..##....', '########', '#..##..#', '#.#..#.#', '#..##..#', '########', '........'],
  back: ['...#....', '..##....', '.#######', '########', '.#######', '..##....', '...#....', '........'],
  bag: ['..####..', '.#....#.', '########', '#.#..#.#', '#......#', '#.####.#', '#......#', '########'],
  book: ['.##..##.', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '.##..##.', '...##...'],
  menu: ['........', '########', '########', '........', '########', '########', '........', '########'],
  plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
  minus: ['........', '........', '........', '########', '########', '........', '........', '........'],
  lung: ['...##...', '...##...', '.#.##.#.', '###..###', '###..###', '###..###', '.##..##.', '........'],
  crouch: ['...##...', '...##...', '..####..', '.#.##.#.', '..####..', '.##..##.', '##....##', '........'],
  run: ['....##..', '....##..', '..####..', '.#.##.#.', '...###..', '..#...#.', '.#.....#', '........'],
  rec: ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'],
};
function icon(name: string, col = '#fff8e0', shadow = 'rgba(0,0,0,0.55)') {
  const g = ICONS[name];
  const c = document.createElement('canvas');
  c.width = 10; c.height = 10;
  const x = c.getContext('2d')!;
  for (const [off, fill] of [[1, shadow], [0, col]] as const) {
    x.fillStyle = fill;
    g.forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] === '#') x.fillRect(i + off, j + off, 1, 1); });
  }
  return c.toDataURL();
}

// pixel ring for the joystick base and a chunky knob
function ringImg() {
  const S = 48, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d')!;
  const r0 = S / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const d = Math.hypot(i + 0.5 - r0, j + 0.5 - r0);
    let col = '';
    if (d < r0 - 0.5 && d > r0 - 2.5) col = '#1a1410';
    else if (d <= r0 - 2.5 && d > r0 - 4.5) col = (j < r0 ? '#c8b48a' : '#8a7654');
    else if (d <= r0 - 4.5 && d > r0 - 6) col = '#1a1410';
    else if (d <= r0 - 6) col = 'rgba(20,28,24,0.55)';
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  // direction notches
  x.fillStyle = '#f0e4c0';
  for (const [a, b] of [[r0 - 1, 8], [r0 - 1, S - 10], [8, r0 - 1], [S - 10, r0 - 1]]) x.fillRect(a, b, 2, 2);
  return c.toDataURL();
}
function knobImg() {
  const S = 22, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d')!;
  const r0 = S / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i + 0.5 - r0, dy = j + 0.5 - r0, d = Math.hypot(dx, dy);
    let col = '';
    if (d < r0 - 0.3 && d > r0 - 2) col = '#1a1410';
    else if (d <= r0 - 2) {
      const l = -dx * 0.5 - dy;
      col = l > 5 ? '#ffe9a8' : l > 0 ? '#f0b43a' : l > -5 ? '#c8841c' : '#8a5410';
    }
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  x.fillStyle = '#fff8e0';
  x.fillRect(7, 5, 3, 2); x.fillRect(6, 7, 2, 2);
  return c.toDataURL();
}

const CSS = `
.touch { position: absolute; inset: 0; pointer-events: none; display: none; z-index: 30; --tu: clamp(3px, 0.62vmin, 6px);
  font-family: 'Silkscreen', 'Pixelify Sans', monospace; image-rendering: pixelated; -webkit-user-select: none; user-select: none; }
.touch.on { display: block; }
.touch.hide .tc-l, .touch.hide .tc-r, .touch.hide .tc-top { opacity: 0; pointer-events: none !important; }
.touch .tc-l, .touch .tc-r, .touch .tc-top { transition: opacity 0.2s; }
/* joystick zone: the whole lower-left; the stick appears where your thumb lands */
.tc-l { position: absolute; left: 0; bottom: 0; width: 42%; height: 62%; pointer-events: auto; touch-action: none; }
.tc-stick { position: absolute; width: calc(var(--tu) * 30); height: calc(var(--tu) * 30); margin: calc(var(--tu) * -15) 0 0 calc(var(--tu) * -15);
  background: var(--tc-ring) center / 100% 100% no-repeat; image-rendering: pixelated; opacity: 0.55; transition: opacity 0.15s; }
.tc-l.act .tc-stick { opacity: 1; }
.tc-knob { position: absolute; left: 50%; top: 50%; width: calc(var(--tu) * 13); height: calc(var(--tu) * 13); margin: calc(var(--tu) * -6.5) 0 0 calc(var(--tu) * -6.5);
  background: var(--tc-knob) center / 100% 100% no-repeat; image-rendering: pixelated; filter: drop-shadow(0 calc(var(--tu) * 1.2) 0 rgba(0,0,0,0.45)); }
.tc-l.run .tc-knob { filter: drop-shadow(0 calc(var(--tu) * 1.2) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 calc(var(--tu) * 2) #ffd060); }
.tc-l .tc-lab { position: absolute; left: 50%; bottom: calc(var(--tu) * -5); transform: translateX(-50%); font-size: calc(var(--tu) * 2.4); color: #fff4d0;
  text-shadow: 0 2px 0 #000; white-space: nowrap; opacity: 0.8; }
/* action buttons */
.tc-r { position: absolute; right: calc(var(--tu) * 4); bottom: calc(var(--tu) * 4); width: calc(var(--tu) * 50); height: calc(var(--tu) * 44); }
.tc-b { position: absolute; pointer-events: auto; touch-action: none; width: calc(var(--tu) * 15); height: calc(var(--tu) * 15);
  border-style: solid; border-width: calc(var(--tu) * 2.2); border-image: var(--sk-btn) 4 fill / calc(var(--tu) * 2.2) / 0 stretch;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--tu) * 0.6);
  color: #fff8e0; font-size: calc(var(--tu) * 2.1); text-shadow: 0 2px 0 rgba(0,0,0,0.7); box-sizing: border-box;
  filter: drop-shadow(0 calc(var(--tu) * 1.2) 0 rgba(0,0,0,0.45)); transition: transform 0.06s; }
.tc-b i { display: block; width: calc(var(--tu) * 6); height: calc(var(--tu) * 6); background: var(--ic) center / 100% 100% no-repeat; image-rendering: pixelated; }
.tc-b.down { border-image-source: var(--sk-btn-down); transform: translateY(calc(var(--tu) * 0.9)) scale(0.96); filter: none; }
.tc-b.big { width: calc(var(--tu) * 20); height: calc(var(--tu) * 20); }
.tc-b.big i { width: calc(var(--tu) * 8); height: calc(var(--tu) * 8); }
.tc-b.amber { border-image-source: var(--sk-btn-amber); }
.tc-b.red { border-image-source: var(--sk-btn-red); }
.tc-b.wood { border-image-source: var(--sk-btn-wood); }
.tc-b.sm { width: calc(var(--tu) * 11); height: calc(var(--tu) * 11); font-size: calc(var(--tu) * 1.7); }
.tc-b.sm i { width: calc(var(--tu) * 4.6); height: calc(var(--tu) * 4.6); }
.tc-b.pulse { animation: tcPulse 0.9s steps(4) infinite; }
@keyframes tcPulse { 50% { filter: drop-shadow(0 calc(var(--tu) * 1.2) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 calc(var(--tu) * 2.4) #ffe070); } }
.tc-b.off { opacity: 0.45; }
.tc-b[hidden] { display: none; }
.tc-b .tc-cap { position: absolute; bottom: calc(100% + var(--tu) * 1.2); right: 0; max-width: calc(var(--tu) * 44); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: calc(var(--tu) * 2); color: #2a2116; padding: calc(var(--tu) * 0.8) calc(var(--tu) * 1.6);
  border-style: solid; border-width: calc(var(--tu) * 1.2); border-image: var(--sk-frame) 6 fill / calc(var(--tu) * 1.2) / 0 stretch; text-shadow: none; }
.tc-b .tc-cap:empty { display: none; }
/* zoom rocker (camera) */
.tc-zoom { position: absolute; right: calc(var(--tu) * 62); bottom: calc(var(--tu) * 6); display: none; flex-direction: column; gap: calc(var(--tu) * 1.5); }
.touch.cam .tc-zoom { display: flex; }
.tc-zoom .tc-b { position: relative; }
.tc-zoomv { font-size: calc(var(--tu) * 2.2); color: #fff8e0; text-align: center; text-shadow: 0 2px 0 #000; }
/* top bar */
.tc-top { position: absolute; top: calc(var(--tu) * 2); left: 50%; transform: translateX(-50%); display: flex; gap: calc(var(--tu) * 1.6); }
.tc-top .tc-b { position: relative; }
/* breath meter while holding */
.tc-breath { position: absolute; left: 50%; bottom: calc(var(--tu) * 5); transform: translateX(-50%); width: calc(var(--tu) * 34); height: calc(var(--tu) * 3.2);
  border-style: solid; border-width: calc(var(--tu) * 1); border-image: var(--sk-frame) 6 fill / calc(var(--tu) * 1) / 0 stretch; display: none; }
.tc-breath b { display: block; height: 100%; width: var(--v, 100%); background: linear-gradient(#bfe8ff 0 40%, #3a8ad8 40%); }
.touch.cam .tc-breath { display: block; }
@media (orientation: portrait) {
  .touch { --tu: clamp(3px, 0.9vmin, 6px); }
  .tc-top { top: auto; bottom: calc(var(--tu) * 52); }
}
/* the HUD makes room for the thumbs */
body.touchmode .h2 .keys, body.touchmode .h2 .belt, body.touchmode .h2 .btn2, body.touchmode .h2 .rp { display: none; }
body.touchmode .h2 .bar { bottom: auto; top: 7em; transform: scale(0.78); transform-origin: 0 0; }
body.touchmode .h2 .quest { top: auto; bottom: 46%; max-width: 30vw; opacity: 0.9; }
`;

type BtnOpts = { cls?: string; icon?: string; label?: string; code?: string; hold?: boolean; tap?: () => void; pos?: [number, number] };

export function setupTouch() {
  document.head.appendChild(el('style', '', CSS));
  const root = el('div', 'touch');
  root.style.setProperty('--tc-ring', `url(${ringImg()})`);
  root.style.setProperty('--tc-knob', `url(${knobImg()})`);
  game.ui.root.appendChild(root);
  // keep thumbs on the controls from also steering the virtual mouse (camera aim)
  root.addEventListener('pointermove', e => e.stopPropagation());
  const inp = game.input;
  const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

  // ---------- joystick ----------
  const L = root.appendChild(el('div', 'tc-l'));
  const stick = L.appendChild(el('div', 'tc-stick'));
  const knob = stick.appendChild(el('div', 'tc-knob'));
  const lab = stick.appendChild(el('div', 'tc-lab', 'MOVE'));
  const home = () => { stick.style.left = '22%'; stick.style.top = '66%'; knob.style.transform = ''; };
  home();
  let sid = -1, ox = 0, oy = 0, jx = 0, jy = 0;
  const held = new Set<string>();
  const setKey = (code: string, on: boolean) => {
    if (on && !held.has(code)) { held.add(code); inp.press(code); } else if (!on && held.has(code)) { held.delete(code); inp.release(code); }
  };
  const camOn = () => !!(game.scene as { cam?: { active?: boolean } } | null)?.cam?.active;
  const applyStick = () => {
    const m = Math.hypot(jx, jy);
    if (camOn()) {
      // camera raised: the stick aims the lens instead of walking
      for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft']) setKey(k, false);
      lab.textContent = 'AIM';
      return;
    }
    setKey('ArrowRight', jx > 0.3);
    setKey('ArrowLeft', jx < -0.3);
    setKey('ArrowUp', jy < -0.6);
    setKey('ArrowDown', jy > 0.6);
    const run = m > 0.92 && Math.abs(jx) > 0.6;
    setKey('ShiftLeft', run);
    L.classList.toggle('run', run);
    lab.textContent = run ? 'RUN!' : jy < -0.6 ? 'CLIMB' : jy > 0.6 ? 'CROUCH' : 'MOVE';
  };
  const radius = () => stick.getBoundingClientRect().width * 0.38;
  L.addEventListener('pointerdown', e => {
    if (sid !== -1) return;
    e.preventDefault(); e.stopPropagation();
    sid = e.pointerId;
    L.setPointerCapture(e.pointerId);
    const r = L.getBoundingClientRect();
    ox = e.clientX; oy = e.clientY;
    stick.style.left = `${e.clientX - r.left}px`;
    stick.style.top = `${e.clientY - r.top}px`;
    L.classList.add('act');
    jx = jy = 0;
    buzz(6);
  });
  L.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    e.preventDefault();
    const R = radius();
    let dx = (e.clientX - ox) / R, dy = (e.clientY - oy) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    const wasRun = Math.hypot(jx, jy) > 0.92;
    jx = dx; jy = dy;
    if (!wasRun && Math.hypot(jx, jy) > 0.92) buzz(5);
    knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    applyStick();
  });
  const endStick = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    sid = -1; jx = jy = 0;
    L.classList.remove('act', 'run');
    applyStick();
    home();
    lab.textContent = camOn() ? 'AIM' : 'MOVE';
  };
  L.addEventListener('pointerup', endStick);
  L.addEventListener('pointercancel', endStick);

  // ---------- buttons ----------
  const btn = (parent: HTMLElement, o: BtnOpts) => {
    const b = el('div', `tc-b ${o.cls ?? ''}`);
    if (o.icon) { const i = b.appendChild(el('i')); i.style.setProperty('--ic', `url(${icon(o.icon)})`); }
    const t = b.appendChild(el('span', 'tc-t', o.label ?? ''));
    const cap = b.appendChild(el('span', 'tc-cap'));
    if (o.pos) { b.style.right = `calc(var(--tu) * ${o.pos[0]})`; b.style.bottom = `calc(var(--tu) * ${o.pos[1]})`; }
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', o.label ?? o.icon ?? '');
    let pid = -1;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (pid !== -1) return;
      pid = e.pointerId;
      try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      b.classList.add('down');
      buzz();
      if (o.code) inp.press(o.code);
      o.tap?.();
      if (o.code && !o.hold) setTimeout(() => { if (pid === -1) inp.release(o.code!); }, 90);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      b.classList.remove('down');
      if (o.code) inp.release(o.code);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    parent.appendChild(b);
    return { b, t, cap };
  };

  const R = root.appendChild(el('div', 'tc-r'));
  // walking layout (diamond): Jump (A) bottom-right, Use (B) left of it, Camera above, Crouch below-left
  const jump = btn(R, { cls: 'big', icon: 'jump', label: 'JUMP', code: 'Space', hold: true, pos: [0, 8] });
  const use = btn(R, { cls: 'big amber', icon: 'hand', label: 'USE', code: 'KeyE', pos: [22, 0] });
  const cam = btn(R, { cls: 'wood', icon: 'cam', label: 'CAM', code: 'KeyQ', pos: [3, 30] });
  const crouch = btn(R, { cls: 'wood sm', icon: 'crouch', label: 'DUCK', code: 'KeyS', hold: true, pos: [44, 3] });
  // camera layout: big red shutter, hold-breath, lower camera, video mode
  const shoot = btn(R, { cls: 'big red', icon: 'rec', label: 'SNAP', pos: [0, 8], tap: () => { inp.shutter = true; } });
  const breath = btn(R, { cls: 'amber', icon: 'lung', label: 'HOLD', code: 'ShiftLeft', hold: true, pos: [23, 2] });
  const lower = btn(R, { cls: 'wood', icon: 'back', label: 'LOWER', code: 'KeyQ', pos: [3, 30] });
  const mode = btn(R, { cls: 'wood sm', icon: 'cam', label: 'MODE', code: 'KeyV', pos: [46, 3] });
  const Z = root.appendChild(el('div', 'tc-zoom'));
  btn(Z, { cls: 'wood sm', icon: 'plus', label: 'ZOOM', code: 'KeyX', hold: true });
  const zv = Z.appendChild(el('div', 'tc-zoomv', '1.6x'));
  btn(Z, { cls: 'wood sm', icon: 'minus', label: 'WIDE', code: 'KeyZ', hold: true });
  const B = root.appendChild(el('div', 'tc-breath'));
  const bFill = B.appendChild(el('b'));

  const top = root.appendChild(el('div', 'tc-top'));
  btn(top, { cls: 'wood sm', icon: 'bag', label: 'PACK', code: 'KeyI' });
  btn(top, { cls: 'wood sm', icon: 'book', label: 'GUIDE', code: 'KeyJ' });
  btn(top, { cls: 'wood sm', icon: 'menu', label: 'MENU', code: 'Escape' });

  const walkSet = [jump, use, cam, crouch], camSet = [shoot, breath, lower, mode];

  // ---------- per-frame context ----------
  let lastCam: boolean | null = null, lastNear = '';
  const tick = () => {
    requestAnimationFrame(tick);
    if (!root.classList.contains('on')) return;
    const sc = game.scene as unknown as { cam?: { active?: boolean; zoom?: number; develop?: number; breathLeft?: number }; nearIt?: { label: string } | null; player?: unknown } | null;
    const c = !!sc?.cam?.active;
    const inWorld = !!sc?.player;
    root.classList.toggle('hide', game.ui.blocking || !inWorld);
    if (c !== lastCam) {
      lastCam = c;
      root.classList.toggle('cam', c);
      for (const x of walkSet) x.b.hidden = c;
      for (const x of camSet) x.b.hidden = !c;
      if (sid !== -1) applyStick();
      lab.textContent = c ? 'AIM' : 'MOVE';
    }
    if (c && sc?.cam) {
      zv.textContent = `${(sc.cam.zoom ?? 1).toFixed(1)}x`;
      shoot.b.classList.toggle('off', (sc.cam.develop ?? 1) < 1);
      shoot.t.textContent = (sc.cam.develop ?? 1) < 1 ? 'WAIT' : 'SNAP';
      const br = (sc.cam as { breath?: number }).breath;
      bFill.style.setProperty('--v', `${Math.round((br ?? 1) * 100)}%`);
      // aim with the stick: push the virtual mouse around the view
      if (sid !== -1) {
        const r = game.r;
        inp.mx = Math.max(0, Math.min(r.VW, inp.mx + jx * r.VW * 0.02));
        inp.my = Math.max(0, Math.min(r.VH, inp.my + jy * r.VH * 0.02));
      }
    }
    const near = !c && sc?.nearIt ? sc.nearIt.label : '';
    if (near !== lastNear) {
      lastNear = near;
      use.cap.textContent = near;
      use.b.classList.toggle('pulse', !!near);
      use.b.classList.toggle('off', !near);
    }
  };
  requestAnimationFrame(tick);

  const coarse = matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  const setOn = (on: boolean) => { root.classList.toggle('on', on); document.body.classList.toggle('touchmode', on); };
  if (coarse) setOn(true);
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setOn(true); });
  window.addEventListener('keydown', () => setOn(false));
  (window as unknown as { zlTouch?: (on: boolean) => void }).zlTouch = setOn;
}
