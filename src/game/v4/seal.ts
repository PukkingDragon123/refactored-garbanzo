// V4 island: the Corvex Seal. Asleep on the seal rocks like a black boulder with a red face; woken
// (by Chunk, naturally) it rears up and roars, then gallops after Mori along the beach in heaving
// bounds with the odd lunge. It is all sprint and no stamina: a few hundred metres on it flops down,
// pants, and falls straight back to sleep. If it catches you it just... lies on you.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';
import { paintSeal, SEAL_POSES, SEAL_AX, SEAL_AY } from '../../art/island4/creatures';
import { groundY } from '../../art/island4/layout';
import type { IslandScene4 } from './island';

export type SealState = 'sleep' | 'wake' | 'roar' | 'chase' | 'lunge' | 'pin' | 'tired' | 'asleep';

let frames: Record<string, Frame[]> | null = null;
function F() {
  if (frames && frames.sleep?.[0]?.tex) return frames;
  frames = {};
  for (const [k, list] of Object.entries(SEAL_POSES)) frames[k] = list.map((p, i) => local.add(`seal:${k}${i}`, paintSeal(p), SEAL_AX, SEAL_AY));
  return frames;
}

export class CorvexSeal implements Drawable {
  species = 'corvexseal';
  z = 35;
  x: number;
  y: number;
  p = 1;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  state: SealState = 'sleep';
  t = 0;
  private st = 0;
  private zT = 0;
  /** world x where it runs out of steam */
  tireX = 5000;
  onCatch: (() => void) | null = null;
  onTired: (() => void) | null = null;
  private lungeT = 2.5;
  /** seconds spent chasing (it runs out of steam either way) */
  chaseT = 0;
  body = {
    bounds: (a: CorvexSeal) => ({ x0: a.x - 62, y0: a.y - (a.state === 'roar' ? 78 : 46), x1: a.x + 70, y1: a.y }),
    points: (a: CorvexSeal): [number, number][] => [[a.x, a.y - 20], [a.x - 40, a.y - 12], [a.x + 40, a.y - 24], [a.x + 58, a.y - (a.state === 'roar' ? 60 : 30)], [a.x - 20, a.y - 30]],
  };

  constructor(readonly s: IslandScene4, x: number) {
    this.x = x;
    this.y = groundY(x) + 1;
  }

  get behavior() {
    return this.state === 'chase' || this.state === 'lunge' || this.state === 'roar' ? 'charging' : this.state === 'tired' ? 'exhausted' : 'sleeping';
  }
  photoInfo() {
    return { species: 'corvexseal', behavior: this.behavior, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: this.facing, noticed: this.state !== 'sleep' && this.state !== 'asleep', juvenile: false, p: 1, hidden: 0 };
  }

  set(state: SealState) {
    this.state = state;
    this.st = 0;
    this.act = state === 'chase' || state === 'lunge' ? 'attack' : 'idle';
    this.eco.attacksPlayer = state === 'chase' || state === 'lunge' ? 1 : 0;
    this.anger = this.eco.attacksPlayer;
    if (state === 'roar') {
      audio.play('roar', { vol: 0.8, pitch: 0.7 });
      audio.play('callGrunt', { vol: 0.9, pitch: 0.45 });
      this.s.st.shake(5, 0.8);
    }
  }

  update(dt: number, st: Stage) {
    this.t += dt;
    this.st += dt;
    const p = this.s.player;
    this.y = groundY(this.x) + 1;
    switch (this.state) {
      case 'sleep':
      case 'asleep':
        this.speed = 0;
        this.zT -= dt;
        if (this.zT <= 0) {
          this.zT = 1.4;
          this.s.main.particles.spawn({ frame: A.dot2, x: this.x + 62, y: this.y - 44, vx: 8, vy: -14, life: 2.2, color: [0.95, 0.95, 1], alpha: 0.8, alpha1: 0, size: 1.4, size1: 2.4 });
        }
        if (rand.chance(dt * 0.3)) this.s.sfx('callGrunt', this.x, 0.2, 0.4);
        break;
      case 'wake':
        if (this.st > 0.9) this.set('roar');
        break;
      case 'roar':
        if (this.st > 1.6) this.set('chase');
        break;
      case 'chase':
      case 'lunge': {
        const d = p.x - this.x;
        this.facing = d >= 0 ? 1 : -1;
        this.lungeT -= dt;
        if (this.state === 'chase' && this.lungeT <= 0 && Math.abs(d) < 150) { this.set('lunge'); this.lungeT = rand.range(1.8, 3); this.s.sfx('callGrunt', this.x, 0.7, 0.5); }
        if (this.state === 'lunge' && this.st > 0.45) this.set('chase');
        const v = this.state === 'lunge' ? 150 : 86;
        // a heaving gallop: surges on the down-beat
        const surge = 0.65 + 0.55 * Math.max(0, Math.sin(this.t * 9));
        this.speed = v * surge;
        this.x += this.facing * this.speed * dt;
        if (Math.abs(d) < 34 && p.y > groundY(p.x) - 20) { this.set('pin'); this.onCatch?.(); }
        this.chaseT += dt;
        if (this.x > this.tireX || this.chaseT > 9) { this.set('tired'); this.onTired?.(); }
        if (Math.floor(this.t * 9) % 2 === 0 && rand.chance(dt * 10)) st.shake(1.2, 0.1);
        if (rand.chance(dt * 6)) this.s.main.particles.spawn({ frame: A.dot2, x: this.x - 20 + rand.range(-20, 20), y: this.y - 1, vx: -this.facing * rand.range(20, 60), vy: rand.range(-50, -20), ay: 200, life: 0.6, color: [0.92, 0.84, 0.64], alpha: 0.9, alpha1: 0, floorY: this.y + 2 });
        break;
      }
      case 'pin':
        this.speed = 0;
        break;
      case 'tired':
        this.speed = 0;
        if (this.st > 5) this.set('asleep');
        break;
    }
  }

  private frame(): Frame {
    const fr = F();
    const i = (k: number, n: number) => ((Math.floor(k) % n) + n) % n;
    switch (this.state) {
      case 'sleep': case 'asleep': return fr.sleep[i(this.t / 1.3, 2)];
      case 'wake': return fr.wake[0];
      case 'roar': return fr.roar[i(this.t * 8, 2)];
      case 'chase': case 'lunge': return fr.gallop[i(this.t * (this.state === 'lunge' ? 14 : 9), 4)];
      case 'pin': return fr.tired[i(this.t * 2, 2)];
      case 'tired': return fr.tired[i(this.t * 3, 2)];
    }
  }

  draw(r: Renderer) {
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y, 2.2, 0.7, 0, packColor(0, 0, 0, 0.4));
    r.endShadows();
    r.draw(this.frame(), this.x, this.y, this.facing, 1);
  }
}
