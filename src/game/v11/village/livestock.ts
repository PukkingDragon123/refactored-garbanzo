// V11 Te Kāinga livestock: kunekune pigs in their pen, hens and a rooster scratching round the
// houses, the village dogs (one always asleep in the sun, one following the kids), a pair of goats on
// tethers. Each animal wanders inside its patch, stops to root / peck / graze, calls now and then,
// and the hens scatter flapping when Mori runs through them. The dogs can be patted, the pigs fed
// (a chore: src/game/v11/village/chores.ts).

import type { FieldScene } from '../../scenes/field';
import { Custom } from '../../../world/props';
import { WHITE } from '../../../gfx/renderer';
import { sprite } from '../../sites2/common';
import { beastFrame, FRAMES } from '../../../art/v11/village/animals';
import type { Beast, BeastAnim } from '../../../art/v11/village/animals';
import { rand } from '../../../core/math';
import type { Interactable } from '../../../world/npc';

export interface Animal11 {
  kind: Beast;
  v: number;
  x: number;
  y: number;
  facing: 1 | -1;
  anim: BeastAnim;
  t: number;
  /** seconds left in the current behaviour */
  left: number;
  tx: number | null;
  speed: number;
  home: [number, number];
  /** a resting animal stays put (the dog in the sun) */
  lazy?: boolean;
  /** follows something (the kids' dog) */
  follow?: () => number | null;
  calm: number;
}

const CALL: Record<Beast, { sfx: string; pitch: [number, number]; vol: number; every: [number, number] }> = {
  pig: { sfx: 'callGrunt', pitch: [1.4, 1.8], vol: 0.25, every: [5, 12] },
  hen: { sfx: 'callChirp', pitch: [0.7, 0.9], vol: 0.18, every: [4, 10] },
  rooster: { sfx: 'callTrill', pitch: [0.55, 0.7], vol: 0.25, every: [14, 30] },
  dog: { sfx: 'callBark', pitch: [1.1, 1.3], vol: 0.25, every: [16, 40] },
  goat: { sfx: 'callHonk', pitch: [1.5, 1.8], vol: 0.2, every: [10, 22] },
};
const SPEED: Record<Beast, number> = { pig: 14, hen: 18, rooster: 16, dog: 34, goat: 16 };
const FPS: Record<BeastAnim, number> = { idle: 1.6, walk: 8, eat: 3, sit: 1, lie: 0.7, wag: 9, flap: 12 };

export class Livestock {
  list: Animal11[] = [];
  private callT = new Map<Animal11, number>();
  constructor(readonly f: FieldScene, readonly ground: (x: number) => number) {}

  add(kind: Beast, x: number, home: [number, number], o: Partial<Animal11> = {}): Animal11 {
    const a: Animal11 = { kind, v: o.v ?? Math.floor(rand.range(0, 3)), x, y: this.ground(x), facing: rand.next() < 0.5 ? 1 : -1, anim: o.anim ?? 'idle', t: rand.range(0, 5), left: rand.range(1, 4), tx: null, speed: SPEED[kind] * rand.range(0.85, 1.15), home, calm: 0, ...o };
    this.list.push(a);
    this.callT.set(a, rand.range(...CALL[kind].every));
    return a;
  }

  frame(a: Animal11) {
    const n = FRAMES[a.anim];
    const i = Math.floor(a.t * FPS[a.anim]) % n;
    return sprite(`vil:beast:${a.kind}:${a.v}:${a.anim}:${i}`, () => beastFrame(a.kind, a.v, a.anim, i));
  }

  /** what an animal does next */
  private decide(a: Animal11) {
    const r = rand.next();
    if (a.lazy) { a.anim = r < 0.75 ? 'lie' : 'sit'; a.left = rand.range(6, 14); a.tx = null; return; }
    if (a.follow) {
      const fx = a.follow();
      if (fx !== null && Math.abs(fx - a.x) > 30) { a.tx = Math.max(a.home[0], Math.min(a.home[1], fx - 18 * Math.sign(fx - a.x))); a.anim = 'walk'; a.left = 6; return; }
    }
    if (r < 0.45) { a.tx = rand.range(a.home[0], a.home[1]); a.anim = 'walk'; a.left = 8; }
    else if (r < 0.8) { a.anim = a.kind === 'dog' ? (rand.next() < 0.5 ? 'sit' : 'wag') : 'eat'; a.left = rand.range(2, 5); a.tx = null; }
    else { a.anim = 'idle'; a.left = rand.range(1.5, 4); a.tx = null; }
  }

  update(dt: number) {
    const p = this.f.player;
    const running = Math.abs(p.vx) > 90;
    for (const a of this.list) {
      a.t += dt;
      a.left -= dt;
      a.calm = Math.max(0, a.calm - dt);
      // hens scatter from someone running at them; pigs and goats trot off a little
      const d = a.x - p.x;
      if (running && Math.abs(d) < 34 && !a.lazy && a.calm <= 0 && a.kind !== 'dog') {
        a.tx = Math.max(a.home[0], Math.min(a.home[1], a.x + Math.sign(d || 1) * rand.range(40, 70)));
        a.anim = a.kind === 'hen' || a.kind === 'rooster' ? 'flap' : 'walk';
        a.left = 2;
        a.calm = 3;
        a.speed = SPEED[a.kind] * (a.kind === 'hen' || a.kind === 'rooster' ? 3.2 : 2.2);
        if (a.kind === 'hen' || a.kind === 'rooster') this.f.sfx('wingFlap', a.x, 0.3, 1.4);
        this.f.sfx(CALL[a.kind].sfx, a.x, CALL[a.kind].vol * 1.6, rand.range(...CALL[a.kind].pitch) * 1.15);
      }
      if (a.tx !== null) {
        const dx = a.tx - a.x;
        if (Math.abs(dx) < 2) { a.tx = null; a.speed = SPEED[a.kind]; a.anim = 'idle'; a.left = Math.min(a.left, rand.range(0.5, 2)); }
        else { a.facing = dx > 0 ? 1 : -1; a.x += Math.sign(dx) * Math.min(Math.abs(dx), a.speed * dt); a.y = this.ground(a.x); }
      }
      if (a.left <= 0) this.decide(a);
      let ct = (this.callT.get(a) ?? 5) - dt;
      if (ct <= 0) { const c = CALL[a.kind]; ct = rand.range(...c.every); this.f.sfx(c.sfx, a.x, c.vol, rand.range(...c.pitch)); }
      this.callT.set(a, ct);
    }
  }

  /** add the animals' drawable to the scene (one Custom for all; z puts them behind the people) */
  mount(z = 30) {
    this.f.main.add(new Custom(z, r => {
      const x0 = r.visibleX0(40), x1 = r.visibleX1(40);
      for (const a of this.list) {
        if (a.x < x0 || a.x > x1) continue;
        const c = this.frame(a);
        if (c) r.draw(c.f, Math.round(a.x), Math.round(a.y) + 1, a.facing, 1, 0, WHITE);
      }
    }, dt => this.update(dt)));
  }

  /** an interaction that follows an animal around (pat the dog...) */
  interact(a: Animal11, label: string, action: () => void | Promise<void>, enabled?: () => boolean) {
    (this.f.interact as Interactable[]).push({ get x() { return a.x; }, get y() { return a.y; }, w: 12, h: 12, label, get standX() { return a.x - 16 * a.facing; }, enabled, action });
  }

  nearest(kind: Beast, x: number) {
    let best: Animal11 | null = null;
    for (const a of this.list) if (a.kind === kind && (!best || Math.abs(a.x - x) < Math.abs(best.x - x))) best = a;
    return best;
  }
}
