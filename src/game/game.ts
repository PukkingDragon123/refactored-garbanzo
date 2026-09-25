// Game: owns the renderer, input, save data and the active scene; drives the main loop.

import { Renderer } from '../gfx/renderer';
import { Input } from '../core/input';
import { SaveData, newSave, writeSave } from './save';
import { UI } from '../ui/ui';
import { clamp } from '../core/math';

export interface Scene {
  enter?(): void | Promise<void>;
  exit?(): void;
  update(dt: number): void;
  render(r: Renderer, dt: number): void;
  /** optional: called when the pause menu opens */
  pausable?: boolean;
}

class Game {
  r!: Renderer;
  input!: Input;
  ui!: UI;
  save: SaveData = newSave();
  scene: Scene | null = null;
  time = 0;
  private fadeDir = 0;
  private fadeSpeed = 2;
  private busy = false;
  paused = false;
  slowmo = 1;

  init(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.r = new Renderer(canvas);
    this.input = new Input(canvas, () => ({ w: this.r.VW, h: this.r.VH }));
    this.ui = new UI(uiRoot);
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      this.r.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
    };
    fit();
    window.addEventListener('resize', fit);
  }

  persist() {
    writeSave(this.save);
  }

  /** Switch scenes with a pixel-dissolve fade. */
  async go(next: Scene | (() => Scene | Promise<Scene>), color: [number, number, number] = [0.02, 0.03, 0.04], speed = 2.2) {
    if (this.busy) return;
    this.busy = true;
    this.r.post.fadeColor = color;
    this.fadeSpeed = speed;
    this.fadeDir = 1;
    await new Promise<void>(res => {
      const chk = () => (this.r.post.fade >= 1 ? res() : requestAnimationFrame(chk));
      chk();
    });
    this.scene?.exit?.();
    this.ui.clearScene();
    this.scene = null;
    const s = typeof next === 'function' ? await next() : next;
    await s.enter?.();
    this.scene = s;
    this.fadeDir = -1;
    this.busy = false;
  }

  /** Immediately set a scene (first boot). */
  async setNow(s: Scene) {
    this.scene?.exit?.();
    this.scene = null;
    await s.enter?.();
    this.scene = s;
  }

  fadeTo(v: number, speed = 2) {
    this.fadeSpeed = speed;
    this.fadeDir = v > this.r.post.fade ? 1 : -1;
    return new Promise<void>(res => {
      const chk = () => {
        if ((this.fadeDir > 0 && this.r.post.fade >= v) || (this.fadeDir < 0 && this.r.post.fade <= v)) {
          this.r.post.fade = v;
          this.fadeDir = 0;
          res();
        } else requestAnimationFrame(chk);
      };
      chk();
    });
  }

  start() {
    let last = performance.now();
    const frame = (now: number) => {
      const rdt = Math.min(0.05, (now - last) / 1000);
      let dt = rdt;
      last = now;
      if (this.paused) dt = 0;
      dt *= this.slowmo;
      this.time += dt;
      const post = this.r.post;
      if (this.fadeDir) post.fade = clamp(post.fade + this.fadeDir * this.fadeSpeed * rdt, 0, 1);
      if (this.fadeDir < 0 && post.fade <= 0) this.fadeDir = 0;
      post.flash = Math.max(0, post.flash - rdt * 4);
      this.r.begin(dt);
      if (this.scene) {
        try {
          this.scene.update(dt);
          this.scene.render(this.r, dt);
        } catch (e) {
          console.error(e);
        }
      }
      this.r.end();
      this.ui.frame(rdt);
      this.afterRender?.();
      this.afterRender = null;
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** one-shot hook run right after the frame is drawn (used for photo capture) */
  afterRender: (() => void) | null = null;
}

export const game = new Game();
