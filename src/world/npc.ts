// Camp crew NPCs and generic interactables with on-screen prompts.

import type { Renderer } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import { chars, A } from '../game/assets';
import { rand } from '../core/math';

export class NPC implements Drawable {
  z = 40;
  t = rand.next() * 10;
  facing = -1;
  talking = false;
  mood: 'idle' | 'happy' | 'wow' = 'idle';
  blinkT = 2 + rand.next() * 3;
  pace: [number, number] | null = null;
  vx = 0;
  paceWait = 2;
  lookX: number | null = null;
  visible = true;
  constructor(readonly id: string, public x: number, public y: number, facing = -1) {
    this.facing = facing;
  }
  update(dt: number) {
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + rand.next() * 4;
    if (this.pace && !this.talking) {
      this.paceWait -= dt;
      if (this.paceWait <= 0 && this.vx === 0) {
        this.vx = (rand.next() < 0.5 ? -1 : 1) * 22;
        this.paceWait = 1 + rand.next() * 2;
      }
      if (this.vx !== 0) {
        this.x += this.vx * dt;
        this.facing = Math.sign(this.vx);
        if (this.x < this.pace[0] || this.x > this.pace[1] || this.paceWait <= 0) {
          this.x = Math.max(this.pace[0], Math.min(this.pace[1], this.x));
          this.vx = 0;
          this.paceWait = 2 + rand.next() * 4;
        }
      }
    } else this.vx = 0;
    if (this.lookX !== null && this.vx === 0) this.facing = this.lookX > this.x ? 1 : -1;
  }
  draw(r: Renderer) {
    if (!this.visible) return;
    const set = chars[this.id];
    let f;
    if (this.vx !== 0) f = set.walk[Math.floor(this.t * 9) % set.walk.length];
    else if (this.mood === 'happy') f = set.happy[0];
    else if (this.mood === 'wow') f = set.wow[0];
    else if (this.talking) f = set.talk[Math.floor(this.t * 7) % 2];
    else if (this.blinkT < 0) f = set.blink[0];
    else f = set.idle[Math.floor(this.t * 2.2) % set.idle.length];
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y, 0.75, 0.8, 0, packColor(0, 0, 0, 0.42));
    r.endShadows();
    r.draw(f, this.x, this.y, this.facing, 1);
  }
}

export interface Interactable {
  x: number;
  y: number;
  /** half-width of the click/proximity box */
  w: number;
  h: number;
  label: string;
  key?: string;
  enabled?: () => boolean;
  action: () => void | Promise<void>;
  /** where the player should stand */
  standX?: number;
  /** the current quest step points here: a bouncing marker floats over it */
  quest?: () => boolean;
}

/** Floating "E  Talk to Pip" prompt positioned over the canvas. */
export class PromptView {
  el: HTMLDivElement;
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'prompt panel';
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }
  show(text: string, cssX: number, cssY: number) {
    if (this.el.dataset.t !== text) {
      this.el.innerHTML = text;
      this.el.dataset.t = text;
    }
    this.el.style.display = '';
    this.el.style.left = cssX + 'px';
    this.el.style.top = cssY + 'px';
  }
  hide() {
    this.el.style.display = 'none';
  }
}

export function nearestInteractable(list: Interactable[], x: number, y: number, range = 26): Interactable | null {
  let best: Interactable | null = null, bd = Infinity;
  for (const it of list) {
    if (it.enabled && !it.enabled()) continue;
    const d = Math.abs(it.x - x);
    if (d < it.w + range && Math.abs(it.y - y) < it.h + 30) {
      // whatever the current quest step points at wins over a ladder or a curio next to it
      const score = d - (it.quest?.() ? 1000 : 0);
      if (score < bd) { bd = score; best = it; }
    }
  }
  return best;
}

export type { Stage };
