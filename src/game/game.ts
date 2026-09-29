// Game: owns the renderer, input, save data and the active scene; drives the main loop.

import { Renderer } from '../gfx/renderer';
import { Input } from '../core/input';
import { SaveData, newSave, writeSave } from './save';
import { UI } from '../ui/ui';
import { clamp } from '../core/math';
import { atlas, local, newLocalAtlas } from './assets';

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
  private fadeTarget = 0;
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
    await this.fadeTo(1, speed);
    this.scene?.exit?.();
    this.ui.clearScene();
    this.scene = null;
    newLocalAtlas(this.r);
    const s = typeof next === 'function' ? await next() : next;
    await this.enterScene(s);
    this.scene = s;
    this.busy = false;
    this.fadeTo(0, speed);
  }

  /** Immediately set a scene (first boot). */
  async setNow(s: Scene) {
    this.scene?.exit?.();
    this.scene = null;
    await this.enterScene(s);
    this.scene = s;
  }

  /** Run a scene's enter(); scenes that expose `readyP` go live as soon as they're built, while
   *  the rest of enter() (opening dialogue, cutscenes) keeps running on the live scene. */
  private async enterScene(s: Scene) {
    const done = Promise.resolve(s.enter?.());
    const ready = (s as { readyP?: Promise<void> }).readyP;
    done.catch(e => console.error('scene enter failed', e));
    await (ready ? Promise.race([ready, done]) : done);
  }

  /** Animate the dissolve fade toward v; resolves when it gets there (or is superseded). */
  fadeTo(v: number, speed = 2) {
    this.fadeTarget = v;
    this.fadeSpeed = speed;
    return new Promise<void>(res => {
      const chk = () => {
        if (this.fadeTarget !== v || Math.abs(this.r.post.fade - v) < 1e-3) res();
        else requestAnimationFrame(chk);
      };
      chk();
    });
  }

  start() {
    let last = performance.now();
    const frame = (now: number) => {
      // (tests can raise the step cap to fast-forward slow headless renders: window.__dtCap)
      const rdt = Math.min((window as unknown as { __dtCap?: number }).__dtCap ?? 0.05, (now - last) / 1000);
      let dt = rdt;
      last = now;
      if (this.paused) dt = 0;
      dt *= this.slowmo;
      this.time += dt;
      const post = this.r.post;
      if (post.fade !== this.fadeTarget) {
        const d = this.fadeTarget - post.fade;
        post.fade = Math.abs(d) <= this.fadeSpeed * rdt ? this.fadeTarget : clamp(post.fade + Math.sign(d) * this.fadeSpeed * rdt, 0, 1);
      }
      post.flash = Math.max(0, post.flash - rdt * 4);
      // textures are (re)uploaded right before each GPU flush, so lazily generated frames never draw blank
      this.r.beforeFlush = () => { atlas?.upload(); local?.upload(); };
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
