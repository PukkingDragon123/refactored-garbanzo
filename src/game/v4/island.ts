import type { Scene } from '../game';
import type { Renderer } from '../../gfx/renderer';
export class IslandScene implements Scene {
  async enter() {}
  update(dt: number) { void dt; }
  render(r: Renderer, dt: number) { void r; void dt; }
  exit() {}
}
