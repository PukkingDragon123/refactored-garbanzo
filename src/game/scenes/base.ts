// Base class for side-scrolling Stage scenes: camera follow, interactables, prompts, click-to-walk.

import type { Renderer } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { Stage } from '../../world/stage';
import { Player } from '../../world/player';
import { Interactable, PromptView, nearestInteractable } from '../../world/npc';
import { audio } from '../../core/audio';

export abstract class StageScene implements Scene {
  st!: Stage;
  player!: Player;
  interact: Interactable[] = [];
  prompt!: PromptView;
  cutscene = false;
  lookAhead = 40;
  camY = 135;
  clickToWalk = true;
  private busyAction = false;
  hovered: Interactable | null = null;

  abstract build(): void | Promise<void>;

  async enter() {
    this.prompt = new PromptView(game.ui.prompts);
    await this.build();
    this.snapCamera();
  }

  snapCamera() {
    const c = this.st.cam;
    c.x = c.tx = this.player.x;
    c.y = c.ty = this.camY;
  }

  worldMouse() {
    const r = game.r, c = this.st.cam;
    return [(game.input.mx - r.VW / 2) / c.zoom + c.x, (game.input.my - r.VH / 2) / c.zoom + c.y];
  }

  async runAction(it: Interactable) {
    if (this.busyAction) return;
    this.busyAction = true;
    try {
      if (it.standX !== undefined && Math.abs(this.player.x - it.standX) > 3) await this.player.walkTo(it.standX, 70);
      this.player.facing = it.x >= this.player.x ? 1 : -1;
      audio.play('ui', { vol: 0.5 });
      await it.action();
    } finally {
      this.busyAction = false;
    }
  }

  updateInteraction() {
    const inp = game.input;
    if (this.cutscene || game.ui.blocking || this.busyAction) {
      this.prompt.hide();
      return;
    }
    const [wx, wy] = this.worldMouse();
    // hover over interactables
    this.hovered = null;
    for (const it of this.interact) {
      if (it.enabled && !it.enabled()) continue;
      if (Math.abs(wx - it.x) < it.w && wy > it.y - it.h * 2 && wy < it.y + 6) this.hovered = it;
    }
    const near = nearestInteractable(this.interact, this.player.x, this.player.y);
    const show = this.hovered ?? near;
    if (show) {
      const r = game.r;
      const sx = r.projectX(show.x, 1), sy = r.projectY(show.y - show.h * 2 - 6, 1);
      const [cx, cy] = game.ui.artToCss(sx, sy, r.VW, r.VH);
      const key = show === near ? '<span class="key">E</span> ' : '<span class="key">Click</span> ';
      this.prompt.show(key + show.label, cx, cy);
    } else this.prompt.hide();
    if (near && inp.hit('interact')) {
      this.runAction(near);
      return;
    }
    if (inp.click(0) && this.clickToWalk && this.player.state === 'normal') {
      if (this.hovered) this.runAction(this.hovered);
      else if (wy > 60) this.player.walkTo(Math.max(this.player.minX, Math.min(this.player.maxX, wx)), 64).catch(() => {});
    }
  }

  update(dt: number) {
    if (this.player.state === 'script' && (game.input.axisX() !== 0) && !this.cutscene && !this.busyAction) {
      this.player.state = 'normal';
      this.player.scriptTarget = null;
    }
    this.updateInteraction();
    this.st.update(dt);
    if (!this.st.cam.locked) {
      this.st.cam.tx = this.player.x + this.player.facing * this.lookAhead * (Math.abs(this.player.vx) > 5 ? 1 : 0.5);
      this.st.cam.ty = this.camY;
    }
    audio.update(dt);
  }

  render(r: Renderer, dt: number) {
    this.st.updateCamera(dt, r);
    this.st.render(r, dt);
  }

  exit() {
    this.prompt?.hide();
    this.st?.clear();
  }
}
