// On-screen controls for touch devices (shown after the first touch).

import { game } from '../game/game';
import { el } from './ui';

const CSS = `
.touch { position: absolute; inset: 0; pointer-events: none; display: none; }
.touch.on { display: block; }
.touch .pad { position: absolute; bottom: 18px; display: flex; gap: 10px; pointer-events: auto; }
.touch .pad.l { left: 18px; }
.touch .pad.r { right: 18px; flex-wrap: wrap; width: 220px; justify-content: flex-end; }
.touch button { width: 58px; height: 58px; border-radius: 50%; border: 2px solid rgba(241,232,208,0.35); background: rgba(16,32,28,0.55); color: var(--paper); font-family: var(--pix); font-size: 15px; touch-action: none; }
.touch button:active, .touch button.down { background: rgba(244,180,60,0.7); color: var(--ink); }
.touch button.big { width: 72px; height: 72px; background: rgba(232,97,74,0.6); }
`;

export function setupTouch() {
  document.head.appendChild(el('style', '', CSS));
  const root = el('div', 'touch');
  game.ui.root.appendChild(root);
  const L = root.appendChild(el('div', 'pad l'));
  const R = root.appendChild(el('div', 'pad r'));
  const btn = (parent: HTMLElement, label: string, code: string, cls = '') => {
    const b = el('button', cls, label);
    b.setAttribute('aria-label', label);
    const down = (e: Event) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); game.input.press(code); };
    const up = (e: Event) => { e.preventDefault(); b.classList.remove('down'); game.input.release(code); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    parent.appendChild(b);
    return b;
  };
  btn(L, '◀', 'ArrowLeft');
  btn(L, '▶', 'ArrowRight');
  btn(L, '▼', 'ArrowDown');
  btn(R, 'Zoom−', 'KeyZ');
  btn(R, 'Zoom+', 'KeyX');
  btn(R, 'Guide', 'KeyJ');
  btn(R, 'Jump', 'Space');
  btn(R, 'Use', 'KeyE');
  btn(R, 'Cam', 'KeyQ');
  const shoot = el('button', 'big', '●');
  shoot.setAttribute('aria-label', 'Shutter');
  shoot.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game.input.shutter = true; });
  R.appendChild(shoot);
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') root.classList.add('on'); });
  window.addEventListener('keydown', () => root.classList.remove('on'));
}
