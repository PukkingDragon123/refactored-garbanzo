// V12 touch: no on-screen buttons. Phones play with gestures on the world itself:
//   tap                  walk there / use what you tapped (the same as a click)
//   tap the floating     use it (the prompt's word over a target)
//     prompt
//   tap Mori             inspect him (camera, backpack, notebook)
//   drag                 a small translucent pixel thumb-stick appears where the thumb landed: walk,
//                        push up to climb, down to crouch; a quick flick up jumps
//   second thumb tap     jump (while the other thumb walks)
//   two-finger tap       pause (or lower the camera when it's up)
//   camera up            drag aims, tap snaps, pinch zooms
// Gestures only start on the game canvas, so anything drawn over it (a minigame, a menu, the
// notebook) gets its own taps. Everything drives the same virtual keys and clicks the keyboard and
// mouse use (core/input.ts). The V11 button pad is kept in src/ui/v11/touchpad.ts.

import { game } from '../game/game';
import { el } from './ui';
import { floatNotice, floatPromptRect, worldToCss } from './v12/float';

const CSS = `
.tstick { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 30; display: none; }
.tstick.on { display: block; }
.tstick canvas { position: absolute; image-rendering: pixelated; image-rendering: crisp-edges; }
body.touchmode, body.touchmode #app { touch-action: none; overscroll-behavior: none; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
`;

/** the thumb-stick: a thin dithered pixel ring and a small knob, translucent */
function ringCanvas(): HTMLCanvasElement {
  const S = 33, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d')!;
  const r0 = (S - 1) / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const d = Math.hypot(i - r0, j - r0);
    let col = '';
    if (d > r0 - 1 && d <= r0) col = 'rgba(18,10,6,0.55)';
    else if (d > r0 - 2 && d <= r0 - 1) col = j < r0 ? 'rgba(255,246,220,0.7)' : 'rgba(200,184,150,0.6)';
    else if (d > r0 - 3 && d <= r0 - 2) col = 'rgba(18,10,6,0.45)';
    else if (d <= r0 - 3 && (i + j) % 4 === 0) col = 'rgba(18,10,6,0.18)';
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  // four notches
  x.fillStyle = 'rgba(255,246,220,0.75)';
  for (const [a, b] of [[r0, 5], [r0, S - 6], [5, r0], [S - 6, r0]]) x.fillRect(a, b, 1, 1);
  return c;
}
function knobCanvas(): HTMLCanvasElement {
  const S = 11, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d')!;
  const r0 = (S - 1) / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - r0, dy = j - r0, d = Math.hypot(dx, dy);
    let col = '';
    if (d > r0 - 0.6 && d <= r0 + 0.4) col = 'rgba(18,10,6,0.7)';
    else if (d <= r0 - 0.6) col = -dx * 0.5 - dy > 1.5 ? 'rgba(255,248,224,0.85)' : 'rgba(240,226,190,0.7)';
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  return c;
}

interface P { id: number; x0: number; y0: number; x: number; y: number; t0: number; mode: 'pending' | 'stick' | 'aim' | 'pinch' | 'done'; lx: number; ly: number; flicked: boolean }

export function setupTouch() {
  document.head.appendChild(el('style', '', CSS));
  const canvas = game.r.canvas as HTMLCanvasElement;
  const inp = game.input;
  const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };
  // the stick, drawn where the thumb lands
  const stick = el('div', 'tstick');
  const ring = stick.appendChild(ringCanvas());
  const knob = stick.appendChild(knobCanvas());
  game.ui.root.appendChild(stick);
  const px = () => Math.max(2, Math.round(Math.min(window.innerWidth, window.innerHeight) / 130));
  const sizeStick = () => {
    const k = px();
    ring.style.width = ring.width * k + 'px'; ring.style.height = ring.height * k + 'px';
    ring.style.left = -(ring.width * k) / 2 + 'px'; ring.style.top = -(ring.height * k) / 2 + 'px';
    knob.style.width = knob.width * k + 'px'; knob.style.height = knob.height * k + 'px';
    return k;
  };
  const putKnob = (dx: number, dy: number) => {
    const k = px();
    knob.style.left = Math.round((dx - (knob.width * k) / 2) / k) * k + 'px';
    knob.style.top = Math.round((dy - (knob.height * k) / 2) / k) * k + 'px';
  };

  const held = new Set<string>();
  const setKey = (code: string, on: boolean) => {
    if (on && !held.has(code)) { held.add(code); inp.press(code); } else if (!on && held.has(code)) { held.delete(code); inp.release(code); }
  };
  const tapKey = (code: string, ms = 110) => { inp.press(code); setTimeout(() => { if (!held.has(code)) inp.release(code); }, ms); };
  const pts = new Map<number, P>();
  let stickId = -1;
  let two: { a: number; b: number; t0: number; d0: number } | null = null;

  type SceneLike = { player?: { x: number; y: number; body?: { cssAnchor?(): [number, number] | null } }; cam?: { active?: boolean }; cutscene?: boolean } | null;
  const sc = () => game.scene as unknown as SceneLike;
  const camOn = () => !!sc()?.cam?.active;
  /** gestures are live in the world, when nothing (a dialogue, a menu, a cutscene) owns the input */
  const live = () => { const s = sc(); return !!s?.player && !game.ui.blocking && !s.cutscene; };
  const rootR = () => game.ui.root.getBoundingClientRect();

  const releaseAll = () => {
    for (const k of [...held]) setKey(k, false);
    stickId = -1; two = null;
    pts.clear();
    stick.classList.remove('on');
  };

  const applyStick = (p: P) => {
    const R = Math.min(window.innerWidth, window.innerHeight) * 0.11;
    let dx = (p.x - p.x0) / R, dy = (p.y - p.y0) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    putKnob(dx * R, dy * R);
    setKey('ArrowRight', dx > 0.3);
    setKey('ArrowLeft', dx < -0.3);
    setKey('ArrowUp', dy < -0.6);
    setKey('ArrowDown', dy > 0.6);
    // a quick flick up jumps
    if (!p.flicked && performance.now() - p.t0 < 230 && p.y0 - p.y > R * 0.7) { p.flicked = true; tapKey('Space', 140); buzz(6); }
  };

  /** Mori under the finger? (his head down to his feet) */
  const onMori = (cx: number, cy: number) => {
    const s = sc();
    const p = s?.player;
    if (!p) return false;
    const R = rootR();
    const feet = worldToCss(p.x, p.y), head = p.body?.cssAnchor?.() ?? null;
    if (!feet || !head) return false;
    const x = cx - R.left, y = cy - R.top;
    const half = Math.max(26, (feet[1] - head[1]) * 0.32);
    return Math.abs(x - (head[0] + feet[0]) / 2) < half && y > head[1] - 12 && y < feet[1] + 8;
  };

  const tap = (cx: number, cy: number) => {
    if (camOn()) { inp.shutter = true; buzz(10); return; }
    const pr = floatPromptRect();
    if (pr && cx >= pr.left && cx <= pr.right && cy >= pr.top && cy <= pr.bottom) { tapKey('KeyE'); buzz(); return; }
    if (onMori(cx, cy)) { buzz(); void import('./v12/inspect').then(m => m.inspectMori()); return; }
    // a click on the world there: walk to it, or use the thing tapped
    const r = canvas.getBoundingClientRect();
    inp.mx = ((cx - r.left) / r.width) * game.r.VW;
    inp.my = ((cy - r.top) / r.height) * game.r.VH;
    inp.mousePressed[0] = true;
    inp.mouseReleased[0] = true;
    inp.lastDevice = 'touch';
  };

  let hinted = false, camHinted = false;
  const hint = () => {
    if (!hinted) { hinted = true; setTimeout(() => { if (live()) floatNotice('Drag to walk · tap to go there · tap Mori for his kit', 4600); }, 600); }
  };

  window.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    setOn(true);
    if (e.target !== canvas || !live()) return;
    // ours: keep it from also being a mouse click on the canvas
    e.stopPropagation();
    e.preventDefault();
    const p: P = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), mode: 'pending', lx: e.clientX, ly: e.clientY, flicked: false };
    pts.set(e.pointerId, p);
    const others = [...pts.values()].filter(q => q !== p && q.mode !== 'done');
    if (others.length === 1 && others[0].mode === 'pending' && performance.now() - others[0].t0 < 260) {
      two = { a: others[0].id, b: p.id, t0: performance.now(), d0: Math.hypot(p.x - others[0].x, p.y - others[0].y) };
    }
    hint();
  }, true);

  window.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    e.stopPropagation();
    p.lx = p.x; p.ly = p.y;
    p.x = e.clientX; p.y = e.clientY;
    // two fingers on the camera: pinch to zoom
    if (two && camOn()) {
      const a = pts.get(two.a), b = pts.get(two.b);
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y), k = d / Math.max(1, two.d0);
        if (Math.abs(k - 1) > 0.05) { a.mode = b.mode = 'pinch'; }
        setKey('KeyX', k > 1.06);
        setKey('KeyZ', k < 0.94);
        return;
      }
    }
    if (p.mode === 'pending' && Math.hypot(p.x - p.x0, p.y - p.y0) > 12) {
      if (two && (two.a === p.id || two.b === p.id)) two = null;
      if (camOn()) p.mode = 'aim';
      else if (stickId === -1) {
        p.mode = 'stick';
        stickId = p.id;
        const R = rootR();
        sizeStick();
        stick.style.left = Math.round(p.x0 - R.left) + 'px';
        stick.style.top = Math.round(p.y0 - R.top) + 'px';
        stick.classList.add('on');
        buzz(5);
      } else p.mode = 'done';
    }
    if (p.mode === 'stick') applyStick(p);
    else if (p.mode === 'aim') {
      // the frame follows the finger (relative, so the finger never covers the subject)
      const r = canvas.getBoundingClientRect();
      inp.mx = Math.max(0, Math.min(game.r.VW, inp.mx + ((p.x - p.lx) / r.width) * game.r.VW * 1.3));
      inp.my = Math.max(0, Math.min(game.r.VH, inp.my + ((p.y - p.ly) / r.height) * game.r.VH * 1.3));
      inp.moved = true;
      if (!camHinted) { camHinted = true; floatNotice('Drag to aim · tap to snap · pinch to zoom · two fingers to lower', 4200); }
    }
  }, true);

  const up = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    e.stopPropagation();
    pts.delete(e.pointerId);
    const quick = performance.now() - p.t0 < 380 && Math.hypot(p.x - p.x0, p.y - p.y0) < 14;
    if (two && (two.a === p.id || two.b === p.id)) {
      const other = pts.get(two.a === p.id ? two.b : two.a);
      const wasPinch = p.mode === 'pinch' || other?.mode === 'pinch';
      setKey('KeyX', false); setKey('KeyZ', false);
      if (!wasPinch && quick && performance.now() - two.t0 < 420) {
        // two-finger tap: lower the camera, or pause
        if (camOn()) tapKey('KeyQ'); else tapKey('Escape');
        buzz(12);
      }
      if (other) other.mode = 'done';
      two = null;
      return;
    }
    if (p.mode === 'stick') {
      for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) setKey(k, false);
      stickId = -1;
      stick.classList.remove('on');
      return;
    }
    if (p.mode === 'pending' && quick) {
      // a second thumb tapping while the first one walks: jump
      if (stickId !== -1) { tapKey('Space', 140); buzz(6); return; }
      tap(e.clientX, e.clientY);
    }
  };
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', e => { const p = pts.get(e.pointerId); if (!p) return; pts.delete(e.pointerId); if (p.mode === 'stick') { for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) setKey(k, false); stickId = -1; stick.classList.remove('on'); } setKey('KeyX', false); setKey('KeyZ', false); two = null; }, true);

  // a menu or a dialogue taking over mid-gesture lets go of everything
  const watch = () => {
    requestAnimationFrame(watch);
    if (pts.size && !live()) releaseAll();
  };
  requestAnimationFrame(watch);

  const coarse = matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  function setOn(on: boolean) { document.body.classList.toggle('touchmode', on); }
  if (coarse) setOn(true);
  window.addEventListener('keydown', e => { if (!e.repeat && e.key.length > 0 && !(e.target instanceof HTMLInputElement)) { releaseAll(); setOn(false); } });
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') setOn(false); });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  // no pinch-zoom / double-tap zoom / pull-to-refresh while playing on a phone
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => { if (document.body.classList.contains('touchmode')) e.preventDefault(); });
  (window as unknown as { zlTouch?: (on: boolean) => void }).zlTouch = setOn;
}
