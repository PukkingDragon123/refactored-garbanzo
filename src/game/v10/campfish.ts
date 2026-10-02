// V10 fishing at camp: Mori casts off the flat rock at the west end of the beach, reusing the ship's
// fishing game (src/ui/v4/fishing.ts) through an island FishingHost. There is no hull here: the sea
// is "behind" the walk line on the island, so for the cross-section view the water is drawn over
// the beach to the west of the rock (toward the wreck, which then stands half sunk on the left), the
// rock's face slopes down under the surface, and the earth below the beach is filled in on the right.
// The catch goes to Joshu's smoker (the larder: better dinners and breakfasts) or back in the sea.

import { game } from '../game';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { Custom } from '../../world/props';
import type { Layer } from '../../world/stage';
import { local } from '../assets';
import { ISL, groundY } from '../../art/island4/layout';
import { hash2 } from '../../core/math';
import { wait } from '../v4/islestory';
import { gripOf } from '../../art/v9/fish';
import type { HeldSprite } from '../../ui/v4/fishing';
import { dayState, dayNumber, addBond } from './day';
import type { CampDay } from './campday';
import { C10 } from './campcrew';

const LEVEL = ISL.GY + 3;
/** the rock's face meets the water here; under the surface it slopes down to SLOPE */
const EDGE = C10.rock - 26, SLOPE = C10.rock + 12;
const MASK: [number, number][] = [[EDGE, LEVEL], [EDGE + 4, LEVEL + 9], [EDGE + 10, LEVEL + 27], [EDGE + 16, LEVEL + 49], [EDGE + 22, LEVEL + 87], [EDGE + 30, LEVEL + 147], [SLOPE, 2000], [SLOPE + 4000, 2000]];
const HELD_FIST: [number, number] = [0.5, -1.5];

function maskAt(x: number) {
  if (x < MASK[0][0]) return -Infinity;
  for (let i = 1; i < MASK.length; i++) {
    const [x0, y0] = MASK[i - 1], [x1, y1] = MASK[i];
    if (x <= x1) return y0 + (y1 - y0) * ((x - x0) / Math.max(1e-6, x1 - x0));
  }
  return 2000;
}

/** the island side of the fishing game */
class IsleFishHost {
  heldBox: [number, number, number, number] | null = null;
  private held: HeldSprite | null = null;
  private heldMode: 'chest' | 'overhead' = 'chest';
  private heldXf: { gx: number; gy: number; f: number; rot: number; ax: number; ay: number } | null = null;
  private heldFrames = new WeakMap<object, Frame>();
  private heldN = 0;
  private fishDraw: ((r: Renderer) => void) | null = null;
  private items: Custom[] = [];

  constructor(readonly cd: CampDay) {}
  get player() { return this.cd.s.player; }
  get st() { return this.cd.s.st; }
  get hud() { return this.cd.s.hud; }

  install() {
    const s = this.cd.s, st = s.st;
    // the fishing world goes on its own plane in front of everything (the beach west of the rock turns to sea)
    const layer: Layer = st.hasLayer('v10fish') ? st.layer('v10fish') : st.addLayer('v10fish', 1, 0, 0, 0, 1);
    const under = () => (window as unknown as { __fishView?: { under: number } }).__fishView?.under ?? 0;
    this.items.push(layer.add(new Custom(0, rr => {
      if (!this.fishDraw) return;
      this.fishDraw(rr);
      this.drawLand(rr, under());
    })));
    this.items.push(s.main.add(new Custom(95, rr => this.drawHeld(rr))));
  }
  uninstall() {
    const s = this.cd.s;
    for (const c of this.items) (c as { dead?: boolean }).dead = true;
    this.items = [];
    this.fishDraw = null;
    this.held = null;
    void s;
  }

  // ---------------------------------------------------------------- the FishingHost contract
  seaY(x: number) {
    const t = this.cd.s.st.time;
    return LEVEL + Math.sin(x * 0.045 + t * 1.3) * 0.7 + Math.sin(x * 0.013 - t * 0.8) * 1.1;
  }
  rodTip(): [number, number] {
    const p = this.player;
    const h = p.body.handPos() ?? [p.x, p.y - 30];
    const a = 0.55, L = 17;
    return [h[0] + Math.cos(a) * L * p.facing, h[1] - Math.sin(a) * L];
  }
  setFishDraw(fn: ((r: Renderer) => void) | null) { this.fishDraw = fn; }
  setHeld(spr: HeldSprite | null, mode: 'chest' | 'overhead' = 'chest') { this.held = spr; this.heldMode = mode; }
  /** the water stops at the rock (and never reaches the land behind it) */
  hullLine(): [number, number][] { return MASK.map(([x, y]) => [x, y]); }
  /** a calm cove: the water hardly drifts */
  cruise() { return 3; }
  heldPoint(u: number, v: number): [number, number] | null {
    const X = this.heldXf;
    if (!X) return null;
    const c = Math.cos(X.rot), sn = Math.sin(X.rot);
    const lx = (u - X.ax) * X.f, ly = v - X.ay;
    return [X.gx + lx * c - ly * sn, X.gy + lx * sn + ly * c];
  }

  // ---------------------------------------------------------------- drawing
  /** the rock under the surface and the earth under the beach, in cross-section */
  private drawLand(r: Renderer, U: number) {
    if (U <= 0.01) return;
    const vx0 = Math.max(EDGE, Math.floor(r.visibleX0(4) / 2) * 2), vx1 = r.visibleX1(4), vy1 = r.wy(r.VH) + 4;
    for (let X = vx0; X < vx1; X += 2) {
      const slope = X < SLOPE;
      const top = slope ? LEVEL + 1 : ISL.BOT - 2;
      const bot = slope ? Math.min(vy1, maskAt(X + 1)) : vy1;
      if (bot <= top) continue;
      // a few bands, darker with depth, with a little grain
      for (let y = top; y < bot; y += 6) {
        const h = Math.min(6, bot - y);
        const dep = Math.min(1, (y - LEVEL) / 260);
        const g = hash2(X >> 1, Math.floor(y / 6), 17) * 0.06;
        const c = slope ? [0.26 - dep * 0.14 + g, 0.28 - dep * 0.14 + g, 0.32 - dep * 0.13 + g] : [0.4 - dep * 0.24 + g, 0.33 - dep * 0.2 + g, 0.24 - dep * 0.14 + g];
        r.rect(X, y, 2, h, packColor(c[0], c[1], c[2], U));
      }
      // the rock's face catches a little light
      if (slope) r.rect(X, bot - 1, 2, 1, packColor(0.5, 0.56, 0.6, 0.7 * U));
    }
    // a dark line under the beach so it reads as ground, not a floating strip
    r.rect(SLOPE, ISL.BOT - 3, vx1 - SLOPE, 1, packColor(0.2, 0.16, 0.12, U));
  }

  private heldFrame(h: HeldSprite): Frame {
    let fr = this.heldFrames.get(h);
    if (fr) return fr;
    const b = new PixelBuffer(h.w, h.h);
    b.data.set(h.px);
    const [gx, gy] = h.grip ?? gripOf(h);
    fr = local.add('v10:held:' + this.heldN++, b, gx + 0.5, gy + 0.5);
    this.heldFrames.set(h, fr);
    return fr;
  }
  /** the catch, held up in one fist by the tail (as on the ship: plumb, tilted out if too long) */
  private drawHeld(r: Renderer) {
    const h = this.held;
    this.heldBox = null;
    this.heldXf = null;
    if (!h) return;
    const p = this.player;
    const hand = p.body.handPos();
    if (!hand) return;
    const fr = this.heldFrame(h);
    const f = p.facing >= 0 ? 1 : -1;
    const gx = Math.round(hand[0] + f * HELD_FIST[0]), gy = Math.round(hand[1] + HELD_FIST[1]);
    const L = fr.w - fr.ax, avail = p.y - 3 - gy;
    let a = Math.PI / 2;
    if (L > avail) a = Math.asin(Math.max(0.35, Math.min(1, avail / L)));
    a += Math.sin(this.cd.s.st.time * 2.3) * 0.03;
    const rot = f * a;
    r.draw(fr, gx, gy, f, 1, rot);
    this.heldXf = { gx, gy, f, rot, ax: fr.ax, ay: fr.ay };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[0, 0], [fr.w, 0], [fr.w, fr.h], [0, fr.h]]) {
      const [wx, wy] = this.heldPoint(u, v)!;
      x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
    }
    this.heldBox = [x0, y0, x1, y1];
    void this.heldMode;
  }
}

/** fish off the camp rocks (three catches a day before the fish wise up) */
export async function fishAtCamp(cd: CampDay) {
  const s = cd.s, st = cd.st, p = cd.p, d = dayState(), day = dayNumber(), jo = s.joshu;
  if (d.fishDay !== day) { d.fishDay = day; d.fishN = 0; }
  if (d.fishN >= 3) {
    s.bark('mori', 'They’ve stopped biting. The fish of this cove have learned my face.', { expr: 'thinking' });
    return;
  }
  // Joshu's on the rock: he makes room
  if (jo.visible && Math.abs(jo.x - (C10.rock + 6)) < 30) {
    cd.hold('joshu');
    s.bark('joshu', 'All yours, lad. They’re biting off the end.', { expr: 'happy' });
    void jo.walkTo(C10.salvage + 30, 32, 'limp').then(() => { jo.facing = -1; jo.idleAnim = 'idle'; jo.setAnim('idle'); });
    await wait(1200);
  }
  const host = new IsleFishHost(cd);
  host.install();
  cd.fishing = true;
  s.cutscene = true;
  try {
    p.x = C10.rock + 2; p.y = groundY(p.x); p.facing = -1; p.vx = 0;
    const { goFishing } = await import('../../ui/v4/fishing');
    const c = await goFishing(host as never, { keepHeld: true });
    if (!c) return;
    d.fishN++;
    game.save.vars['v10:campFish'] = (game.save.vars['v10:campFish'] ?? 0) + 1;
    game.persist();
    const ch = await st.say([{ who: 'mori', text: `A ${c.fish.name}! ${c.len} centimetres.`, expr: 'excited', choices: ['For Joshu’s smoker', 'Let it go'] }]);
    host.setHeld(null);
    p.poseOverride = null;
    if (ch === 0) {
      d.larder++;
      addBond('joshu', 1);
      game.ui.toast(`The ${c.fish.name.toLowerCase()} goes in Joshu’s smoker: a better dinner tonight (larder: ${d.larder}).`, 'FISH', 'teal', 3600);
    } else {
      const { audio } = await import('../../core/audio');
      audio.play('splash', { vol: 0.3 });
      s.bark('mori', 'Off you go. Tell your friends I’m nice.', { expr: 'happy' });
    }
    game.persist();
  } finally {
    host.setHeld(null);
    p.poseOverride = null;
    host.uninstall();
    cd.fishing = false;
    s.cutscene = false;
    cd.release('joshu');
  }
}
