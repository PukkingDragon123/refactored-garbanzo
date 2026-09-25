// Keyboard + mouse/touch input with per-frame edge detection and action bindings.

export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'run' | 'interact' | 'camera' | 'mode'
  | 'journal' | 'pause' | 'place' | 'zoomIn' | 'zoomOut' | 'confirm' | 'skip' | 'recall'
  | 'g1' | 'g2' | 'g3' | 'g4' | 'g5';

const BINDINGS: Record<Action, string[]> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  camera: ['KeyQ'],
  mode: ['KeyV'],
  journal: ['KeyJ', 'Tab'],
  pause: ['Escape', 'KeyP'],
  place: ['KeyF'],
  zoomIn: ['Equal', 'NumpadAdd', 'KeyX'],
  zoomOut: ['Minus', 'NumpadSubtract', 'KeyZ'],
  confirm: ['Enter', 'Space', 'KeyE'],
  skip: ['Escape'],
  recall: ['KeyR'],
  g1: ['Digit1'],
  g2: ['Digit2'],
  g3: ['Digit3'],
  g4: ['Digit4'],
  g5: ['Digit5'],
};

let guardUntil = 0;
/** Ignore gameplay key/click edges for a moment (after a dialogue or menu closes). */
export function guardInput(ms = 250) {
  guardUntil = Math.max(guardUntil, performance.now() + ms);
}
const guarded = () => performance.now() < guardUntil;

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  private keys = new Set<string>();
  private pressedKeys = new Set<string>();
  private releasedKeys = new Set<string>();
  /** Mouse position in art pixels (view space). */
  mx = 240;
  my = 135;
  mouseDown = [false, false, false];
  mousePressed = [false, false, false];
  mouseReleased = [false, false, false];
  wheel = 0;
  moved = false;
  lastDevice: 'mouse' | 'keyboard' | 'touch' = 'mouse';
  /** set by UI when a modal overlay owns input */
  blocked = false;
  /** set by the on-screen shutter button */
  shutter = false;
  onAnyKey: ((code: string) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private viewSize: () => { w: number; h: number }) {
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      this.lastDevice = 'keyboard';
      this.onAnyKey?.(e.code);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      this.releasedKeys.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = [false, false, false];
    });
    const setPos = (e: PointerEvent | MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const v = this.viewSize();
      this.mx = ((e.clientX - rect.left) / rect.width) * v.w;
      this.my = ((e.clientY - rect.top) / rect.height) * v.h;
    };
    window.addEventListener('pointermove', e => {
      setPos(e);
      this.moved = true;
      if (e.pointerType === 'mouse') this.lastDevice = 'mouse';
    });
    canvas.addEventListener('pointerdown', e => {
      setPos(e);
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      this.mouseDown[b] = true;
      this.mousePressed[b] = true;
      this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse';
    });
    window.addEventListener('pointerup', e => {
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      if (this.mouseDown[b]) this.mouseReleased[b] = true;
      this.mouseDown[b] = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
  }

  /** Virtual key press (touch controls). */
  press(code: string) {
    if (!this.keys.has(code)) this.pressedKeys.add(code);
    this.keys.add(code);
  }
  release(code: string) {
    if (this.keys.has(code)) this.releasedKeys.add(code);
    this.keys.delete(code);
  }
  keyDown(code: string) {
    return this.keys.has(code);
  }
  keyHit(code: string) {
    return this.pressedKeys.has(code);
  }
  down(a: Action) {
    if (this.blocked) return false;
    return BINDINGS[a].some(k => this.keys.has(k));
  }
  hit(a: Action) {
    if (this.blocked || guarded()) return false;
    return BINDINGS[a].some(k => this.pressedKeys.has(k));
  }
  /** Same as hit() but ignores UI blocking (for UI navigation). */
  hitRaw(a: Action) {
    if (guarded()) return false;
    return BINDINGS[a].some(k => this.pressedKeys.has(k));
  }
  released(a: Action) {
    return BINDINGS[a].some(k => this.releasedKeys.has(k));
  }
  axisX() {
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
  }
  click(b = 0) {
    return !this.blocked && !guarded() && this.mousePressed[b];
  }
  held(b = 0) {
    return !this.blocked && this.mouseDown[b];
  }
  consumeClick(b = 0) {
    this.mousePressed[b] = false;
  }
  endFrame() {
    this.shutter = false;
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.mousePressed = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.wheel = 0;
    this.moved = false;
  }
  static label(a: Action) {
    const k = BINDINGS[a][0];
    return k.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Left', '').replace('Right', '');
  }
}
