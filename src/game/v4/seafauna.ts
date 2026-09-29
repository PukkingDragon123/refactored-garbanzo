// Ocean life around the Kittiwake for the afternoon on deck: an albatross soaring round the mast,
// red-billed gulls begging at the stern, shearwaters skimming the swell, a pod of Hector's dolphins
// leaping off the bow, flying fish bursting out of the waves and a right whale blowing far off.
// Each critter speaks the camera's subject interface so photos score them like any other animal.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { local, A } from '../assets';
import { rand } from '../../core/math';
import { Obj, P, T, hex } from '../../art/ship4/kit';
import type { Animal } from '../wild/animal';
import type { ShipScene4 } from './ship';
import { game } from '../game';
import { audio } from '../../core/audio';

type Kind = 'albatross' | 'redgull' | 'shearwater' | 'hectors' | 'flyingfish' | 'rightwhale';

// ------------------------------------------------------------------ sprites

function sprite(w: number, h: number, draw: (o: Obj) => void) {
  const o = new Obj(w + 2, h + 2);
  const inner = new Obj(w, h);
  draw(inner);
  o.put(inner.b, 1, 1);
  o.outline(0.7);
  return o.b;
}
const WHITE = T('#f4f2ec', { sh: 0.12, deep: 0.26 });
const GREY = T('#8a96a4', { sh: 0.16, deep: 0.3 });
const SOOT = T('#4a4452', { sh: 0.16, deep: 0.3, hi: 0.14 });

/** bird in side view: wing pose -1 (down) .. 1 (up); spread = wingspan px */
function bird(k: 'albatross' | 'redgull' | 'shearwater', pose: number) {
  const span = k === 'albatross' ? 46 : k === 'redgull' ? 22 : 24;
  const bh = k === 'albatross' ? 7 : 5;
  const H = 14 + Math.round(Math.abs(pose) * (k === 'albatross' ? 8 : 5));
  const W = span + 4;
  const body = k === 'shearwater' ? SOOT : WHITE;
  const wingTop = k === 'albatross' ? SOOT : k === 'redgull' ? GREY : SOOT;
  return sprite(W, H, o => {
    const cx = W / 2, cy = H / 2 + pose * 2;
    // wings: two tapering strokes from the shoulder out to the tips
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < span / 2; i++) {
        const u = i / (span / 2);
        const x = cx + s * i;
        const y = cy - pose * u * u * (k === 'albatross' ? 9 : 6) + (1 - u) * 0;
        const th = Math.max(1, Math.round((1 - u * 0.8) * (k === 'albatross' ? 3 : 2)));
        for (let j = 0; j < th; j++) o.px(x, y + j, u > 0.7 && k !== 'shearwater' ? P.black[1] : j === 0 ? wingTop[2] : wingTop[1]);
      }
    }
    // body, head, bill, tail
    o.ell(cx + 1, cy + 1, bh + 2, bh / 2 + 0.5, (nx, ny) => (ny < -0.2 ? body[3] : ny > 0.5 ? body[1] : body[2]));
    o.ell(cx + bh + 3, cy, 2.2, 2, body[2]);
    o.px(cx + bh + 4, cy - 1, P.black[0]);
    const bill = k === 'albatross' ? P.yellow : k === 'redgull' ? P.red : P.dark;
    o.px(cx + bh + 5, cy, bill[2]); o.px(cx + bh + 6, cy, bill[2]); if (k === 'albatross') o.px(cx + bh + 7, cy + 1, bill[1]);
    o.px(cx - bh - 2, cy + 1, body[1]); o.px(cx - bh - 3, cy + 1, body[1]);
  });
}

function dolphin(tilt: -1 | 0 | 1) {
  return sprite(30, 14, o => {
    const G = T('#7a8a9a', { sh: 0.14, deep: 0.3 });
    for (let x = 0; x < 30; x++) {
      const u = x / 29;
      const yc = 7 + tilt * (u - 0.5) * 8 + Math.sin(u * Math.PI) * -1.5;
      const hh = Math.sin(Math.min(1, u * 1.2) * Math.PI) * 3.2 + 0.6;
      for (let y = Math.round(yc - hh); y <= Math.round(yc + hh); y++) o.px(x, y, y > yc + hh * 0.3 ? P.white[2] : y < yc - hh * 0.5 ? G[1] : G[2]);
    }
    // rounded dorsal fin (Hector's "Mickey Mouse ear"), black flipper, face
    const fx = 14, fy = Math.round(7 + tilt * (14 / 29 - 0.5) * 8 - 4);
    o.ell(fx, fy, 2.4, 2.4, P.black[2]);
    o.px(24, Math.round(7 + tilt * 2.5), P.black[0]);
    o.poly([0, 3 + tilt * -2, 3, 6 + tilt * -2, 0, 10 + tilt * -2], G[1]);
  });
}

function flyingFish(f: number) {
  return sprite(14, 8, o => {
    o.ell(7, 4, 5.5, 1.8, (nx, ny) => (ny < 0 ? hex('#4a78c8') : hex('#d8e4f0')));
    // wing fins spread (flutter on f)
    o.poly([5, 3, 9, 3, 11, f ? -1 : 0], hex('#9ac8f0'));
    o.poly([5, 5, 9, 5, 11, f ? 9 : 8], hex('#7aa8e0'));
    o.px(11, 3, P.black[0]);
    o.poly([1, 2, 3, 4, 1, 6], hex('#4a78c8'));
  });
}

function whale(kind: 'back' | 'fluke' | 'spout', f = 0) {
  if (kind === 'spout') {
    return sprite(22, 26, o => {
      for (let i = 0; i < 70; i++) {
        const t = i / 70, side = i % 2 ? 1 : -1;
        const x = 11 + side * t * (6 + f * 2) + Math.sin(i) * 1.2, y = 25 - t * (22 + f * 2);
        o.px(x, y, t > 0.7 ? hex('#e8f0f4') : hex('#ffffff'));
        if (t > 0.5) o.px(x + side, y + 1, hex('#dce8f0'));
      }
    });
  }
  if (kind === 'fluke') {
    return sprite(26, 16, o => {
      const G = T('#2a3440', { sh: 0.16, deep: 0.3, hi: 0.16 });
      o.rect(11, 8, 4, 8, G[1]);
      o.poly([13, 9, 0, 2, 4, 1, 13, 5, 22, 1, 26, 2], (x, y) => (y < 3 ? G[3] : G[2]));
      for (let i = 0; i < 6; i++) o.px(3 + i * 4, 3 + (i % 2), hex('#e8f0f4'));
    });
  }
  return sprite(40, 9, o => {
    const G = T('#2a3440', { sh: 0.16, deep: 0.3, hi: 0.16 });
    o.ell(20, 9, 20, 7, (nx, ny) => (ny < -0.5 ? G[3] : G[2]));
    o.px(26, 4, hex('#c8c0b0')); o.px(27, 4, hex('#c8c0b0')); o.px(10, 5, hex('#c8c0b0'));
  });
}

let frames: Record<string, Frame[]> | null = null;
function F(): Record<string, Frame[]> {
  if (frames) return frames;
  const add = (n: string, bufs: ReturnType<typeof sprite>[]) => bufs.map((b, i) => local.add(`sea:${n}${i}`, b, b.w / 2, b.h / 2));
  frames = {
    albatross: add('alb', [bird('albatross', 0), bird('albatross', 0.6), bird('albatross', -0.5)]),
    redgull: add('gull', [bird('redgull', 0.8), bird('redgull', 0), bird('redgull', -0.8), bird('redgull', 0)]),
    shearwater: add('shear', [bird('shearwater', 0.2), bird('shearwater', -0.3)]),
    hectors: add('dol', [dolphin(-1), dolphin(0), dolphin(1)]),
    flyingfish: add('ff', [flyingFish(0), flyingFish(1)]),
    whaleBack: add('wb', [whale('back')]),
    whaleFluke: add('wf', [whale('fluke')]),
    whaleSpout: add('ws', [whale('spout', 0), whale('spout', 1)]),
  };
  return frames;
}

// ------------------------------------------------------------------ critters

export class SeaCritter implements Drawable {
  z = 60;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  p = 1;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  scale = 1;
  speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  t = rand.next() * 10;
  behavior: string;
  visible = true;
  private phase = 0;
  private cycle = rand.range(3, 7);
  body: { bounds: (a: SeaCritter) => { x0: number; y0: number; x1: number; y1: number }; points: (a: SeaCritter) => [number, number][] };

  constructor(readonly species: Kind, readonly s: ShipScene4, x: number, y: number, readonly home: [number, number]) {
    this.x = x;
    this.y = y;
    this.behavior = species === 'albatross' ? 'soaring' : species === 'redgull' ? 'flying' : species === 'shearwater' ? 'skimming' : species === 'hectors' ? 'leaping' : species === 'flyingfish' ? 'gliding' : 'spouting';
    const half = (): [number, number] => {
      const f = this.frame();
      return f ? [f.w * 0.5, f.h * 0.5] : [8, 6];
    };
    this.body = {
      bounds: a => { const [hw, hh] = half(); return { x0: a.x - hw, y0: a.y - hh, x1: a.x + hw, y1: a.y + hh }; },
      points: a => { const [hw, hh] = half(); return [[a.x, a.y], [a.x - hw * 0.6, a.y], [a.x + hw * 0.6, a.y], [a.x, a.y - hh * 0.5], [a.x, a.y + hh * 0.5]]; },
    };
  }

  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: 1, noticed: false, juvenile: false, p: this.p, hidden: this.hidden };
  }

  private frame(): Frame | null {
    const fr = F();
    const sp = this.species;
    if (sp === 'rightwhale') return fr.whaleBack[0];
    const list = fr[sp];
    if (!list) return null;
    if (sp === 'albatross') return list[Math.sin(this.t * 0.7) > 0.93 ? (Math.floor(this.t * 6) % 2 ? 1 : 2) : 0];
    if (sp === 'hectors') return list[this.vy < -20 ? 0 : this.vy > 20 ? 2 : 1];
    return list[Math.floor(this.t * (sp === 'redgull' ? 9 : 6)) % list.length];
  }

  update(dt: number) {
    this.t += dt;
    const s = this.s;
    const sea = (x: number) => s.ocean ? s.ocean.heightAt(x) : 366;
    const sp = this.species;
    if (sp === 'albatross') {
      // huge lazy loops around the ship
      const a = this.t * 0.16;
      const nx = 820 + Math.cos(a) * 760, ny = 150 + Math.sin(a * 2) * 70;
      this.vx = (nx - this.x) / dt * 0.02 || 0;
      this.facing = Math.cos(a + Math.PI / 2) < 0 ? -1 : 1;
      this.x += (nx - this.x) * Math.min(1, dt * 1.2);
      this.y += (ny - this.y) * Math.min(1, dt * 1.2);
      this.speed = 60;
    } else if (sp === 'redgull') {
      // flap around the stern; hover over the fishing spot now and then (begging)
      this.phase -= dt;
      const tx = this.home[0] + Math.sin(this.t * 0.4 + this.cycle) * (this.home[1] - this.home[0]) * 0.5 + (this.home[1] - this.home[0]) * 0.5;
      const ty = 160 + Math.sin(this.t * 0.9 + this.cycle) * 40;
      const beg = Math.sin(this.t * 0.25 + this.cycle) > 0.6;
      this.behavior = beg ? 'begging' : 'flying';
      const gx = beg ? 110 + Math.sin(this.t * 2) * 10 : tx, gy = beg ? 200 + Math.sin(this.t * 3) * 4 : ty;
      this.vx += (gx - this.x) * dt * 1.4 - this.vx * dt * 1.2;
      this.vy += (gy - this.y) * dt * 1.4 - this.vy * dt * 1.2;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (Math.abs(this.vx) > 4) this.facing = Math.sign(this.vx);
      this.speed = Math.hypot(this.vx, this.vy);
      if (rand.next() < dt * 0.05) s.sfx('birdCall', this.x, 0.3, 1.5);
    } else if (sp === 'shearwater') {
      this.x += this.facing * 70 * dt;
      this.y = sea(this.x) - 10 + Math.sin(this.t * 3) * 3;
      if (this.x > this.home[1] + 200) { this.x = this.home[0] - 200; }
      this.speed = 70;
    } else if (sp === 'hectors') {
      // porpoise off the bow: leap, splash, swim under, repeat
      this.phase += dt;
      const L = 1.6;
      if (this.phase > this.cycle) { this.phase = 0; this.cycle = rand.range(1.5, 3.5); }
      const k = this.phase / L;
      this.x += 60 * dt;
      if (this.x > this.home[1]) this.x = this.home[0];
      if (k < 1) {
        const base = sea(this.x) + 4;
        const prev = this.y;
        this.y = base - Math.sin(k * Math.PI) * 26;
        this.vy = (this.y - prev) / Math.max(dt, 1e-3);
        this.hidden = k < 0.05 || k > 0.95 ? 0.9 : 0;
        if (k > 0.94 && k - dt / L <= 0.94) s.splash(this.x, sea(this.x), 0.6);
        this.visible = true;
        this.behavior = this.x > 1500 && this.x < 1700 ? 'bowriding' : 'leaping';
      } else { this.visible = false; this.hidden = 1; }
      this.speed = 60;
    } else if (sp === 'flyingfish') {
      this.phase -= dt;
      if (this.phase <= 0 && !this.visible) {
        this.phase = rand.range(0.9, 1.5);
        this.visible = true;
        this.x = rand.range(this.home[0], this.home[1]);
        this.y = sea(this.x);
        this.vx = rand.pick([-1, 1]) * rand.range(90, 130);
        this.vy = -60;
        this.facing = Math.sign(this.vx);
        s.splash(this.x, this.y, 0.3);
      }
      if (this.visible) {
        this.x += this.vx * dt;
        this.vy += 40 * dt;
        this.y = Math.min(sea(this.x) - 6, this.y + this.vy * dt);
        if (this.phase <= 0) { this.visible = false; this.phase = rand.range(6, 14); s.splash(this.x, sea(this.x), 0.3); }
      }
      this.hidden = this.visible ? 0 : 1;
      this.speed = Math.abs(this.vx);
    } else if (sp === 'rightwhale') {
      this.phase += dt;
      if (this.phase > 18) this.phase = 0;
      this.behavior = this.phase > 12 && this.phase < 15 ? 'fluking' : 'spouting';
      this.hidden = this.phase > 8 && this.phase < 12 ? 1 : 0;
      this.y = (s.ocean ? s.ocean.bandSurfaceY('mid', this.x) : 330) + 1;
      if (this.phase > 2 && this.phase - dt <= 2) s.sfx('callWhale', this.x, 0.25, 0.6);
    }
  }

  draw(r: Renderer) {
    if (!this.visible || this.hidden >= 1) return;
    const fr = F();
    if (this.species === 'rightwhale') {
      const ph = this.phase;
      if (ph < 8) {
        r.draw(fr.whaleBack[0], this.x, this.y + 2);
        if (ph > 1 && ph < 4.5) r.draw(fr.whaleSpout[Math.floor(ph * 3) % 2], this.x + 4, this.y - 12, 1, 1, 0, packColor(1, 1, 1, Math.min(1, (4.5 - ph))));
      } else if (ph > 12 && ph < 15) {
        const k = Math.sin(((ph - 12) / 3) * Math.PI);
        r.draw(fr.whaleFluke[0], this.x, this.y - k * 8, 1, Math.max(0.2, k));
      }
      return;
    }
    const f = this.frame();
    if (!f) return;
    r.draw(f, this.x, this.y, this.facing, 1);
    // soft water shadow for low flyers
    if (this.species === 'shearwater' || this.species === 'flyingfish') {
      r.beginShadows();
      r.draw(A.shadow, this.x, (this.s.ocean?.heightAt(this.x) ?? 366) + 1, 0.4, 0.4, 0, packColor(0, 0, 0, 0.25));
      r.endShadows();
    }
  }
}

/** spawn the afternoon's wildlife and hook up photo counting */
export function startDeckLife(s: ShipScene4) {
  const add = (c: SeaCritter, layer = 'main-sea') => {
    const L = s.st.hasLayer(layer) ? s.st.layer(layer) : s.st.layer('sea-near');
    L.add(c);
    s.animals.push(c as unknown as Animal);
  };
  if (!s.st.hasLayer('main-sea')) {
    // critters live outside the ship's rocking transform, on the gameplay plane
    const l = s.st.addLayer('main-sea', 1, 0, 1, 0, 1);
    // keep it right after the ship but before the front swell
    const i = s.st.layers.indexOf(l), j = s.st.layers.findIndex(x => x.name === 'sea-near');
    s.st.layers.splice(i, 1);
    s.st.layers.splice(j, 0, l);
  }
  add(new SeaCritter('albatross', s, 300, 120, [0, 1640]));
  for (let i = 0; i < 3; i++) add(new SeaCritter('redgull', s, rand.range(40, 500), rand.range(130, 200), [0, 520]));
  for (let i = 0; i < 4; i++) { const c = new SeaCritter('shearwater', s, -200 - i * 26, 340, [-300, 1900]); c.p = 1; add(c); }
  for (let i = 0; i < 3; i++) { const c = new SeaCritter('hectors', s, 1560 + i * 34, 370, [1420, 1860]); (c as unknown as { phase: number }).phase = -i * 0.5; add(c); }
  for (let i = 0; i < 2; i++) add(new SeaCritter('flyingfish', s, 0, 370, [-150, 1800]));
  const wh = new SeaCritter('rightwhale', s, 1100, 330, [900, 1300]);
  wh.p = BAND_MID;
  s.st.layer('sea-mid').add(wh);
  s.animals.push(wh as unknown as Animal);
  // photo counting: each species once
  const prev = s.cam.onShot;
  s.cam.onShot = ph => {
    prev?.(ph);
    const seen = new Set(ph.subjects.filter(x => x.inFrame > 0.4 && x.visible > 0.4).map(x => x.species));
    let fresh = 0;
    for (const sp of seen) {
      if (!['albatross', 'redgull', 'shearwater', 'hectors', 'flyingfish', 'rightwhale'].includes(sp)) continue;
      if (game.save.flags['v4:photo:' + sp]) continue;
      game.save.flags['v4:photo:' + sp] = true;
      game.save.vars['v4:photoSpecies'] = (game.save.vars['v4:photoSpecies'] ?? 0) + 1;
      fresh++;
    }
    if (fresh) { audio.play('discover', { vol: 0.5 }); game.persist(); s.hud?.refresh(true); }
  };
}

const BAND_MID = 0.6;
