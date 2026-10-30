// V12 cooking close-up (the showpiece, in the spirit of a ramen counter): the camera pushes in on the
// camp fire and the whole meal is made by hand, station by station.
//   1 PICK     food from the pack (and the camp stash) lies on a woven flax mat: tap it onto the board
//   2 CHOP     the knife sweeps over each thing that wants cutting: chop as it crosses the marks
//   3 ADD      drag what's prepared into the cast-iron pot, in the right order (roots first, greens last)
//   4 COOK     keep the bubbling in the sweet spot on Joshu's old boiler gauge: stir to calm it, throw a
//              log on to bring it up; the pocket watch shows how long until it's done
//   5 SEASON   a pinch of sea salt from the paua shell: hold over the pot, let go, taste
//   6 PLATE    ladle it into the carved bowl without slopping it
//   7 GARNISH  drop a sprig on top as it swings over the bowl
// The dish in the bowl looks the way it was cooked (glossy and steaming, pale and lumpy, or charred),
// and the result goes through the old rules (src/game/v11/cooking.ts finishCook): the recipe, the
// quality (PERFECT / GOOD / ROUGH = undercooked / BURNT) and the portions.

import { game } from '../../../game/game';
import { ITEMS } from '../../../game/items';
import { count, remove, give, stacks } from '../../../game/inventory';
import { stashCount, stashRemove, stashStacks, stashAdd } from '../../../game/v11/stash';
import * as CK from '../../../game/v11/cooking';
import type { Method, CookResult, Tag } from '../../../game/v11/cooking';
import type { CookOpts, CookOutcome } from '../../v11/cooking';
import { CookSound } from '../../v11/cooksfx';
import { PAL } from '../../../art/palettes';
import { paintRock, paintLog, paintGroundFern } from '../../../art/flora';
import { runCloseup } from './stage';
import type { Closeup, SetScene, Grade } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, easeInOut, blit, blitF, copyWin, itemSprite, shadowOval, glow, pmap, up, drawWord, area, ellipse, poly, line, dot, Z } from './kit';
import type { C } from './kit';
import { drawHand } from './hands';

type From = 'pack' | 'stash' | 'debug';
/** how big (units) the food is on the chopping board */
const CHOP = 40;
interface Stock { id: string; n: number; from: From }
interface Prep {
  id: string; from: From;
  chop: boolean;
  /** cut positions (sprite px) and how clean each was */
  cuts: number[]; cutQ: number[];
  /** where it sits now (set px), where it's going */
  x: number; y: number; tx: number; ty: number;
  state: 'row' | 'chop' | 'held' | 'fly' | 'pot';
  spread: number;
  fly?: { t: number; x0: number; y0: number };
}
interface InPot { id: string; x: number; y: number; ph: number; sink: number }

const RANK: Record<Tag, number> = { starch: 0, bread: 0, grub: 1, mushroom: 1, fish: 2, shellfish: 2, fruit: 3, herb: 4 };
const rankOf = (id: string) => Math.min(9, ...(CK.INGREDIENTS[id]?.tags ?? []).map(t => RANK[t] ?? 2));

// palettes
const NIGHT = ramp('#06050b', '#0b0912', '#120d16', '#1c1218', '#2a1814', '#3a2216');
const DRIFT = ramp('#2a241e', '#463e34', '#625848', '#80745e', '#9e9076', '#bcae92', '#d8ccb0');
const FLAX = ramp('#2a2410', '#463c18', '#665a24', '#867832', '#a69646', '#c4b462', '#ded086');
const IRON = ramp('#0a090b', '#141317', '#1e1d21', '#2a282b', '#3a3636', '#4e4844', '#6a6058');
const FIRE = ramp('#4a0c06', '#8a1e0a', '#c8400e', '#ec7018', '#fca62c', '#ffd866', '#fff6c8');
const BRASS = ramp('#3a2408', '#6a4416', '#9a6a22', '#c8962e', '#e8c45a', '#fff0a8');
const RIMU = ramp('#2a1008', '#46200e', '#642e14', '#82401c', '#a05628', '#c0723a', '#dc9654');
const PAUA = ramp('#123a4a', '#1e5a6a', '#2a7a7a', '#3a8a6a', '#5a6aa0', '#7a5aa8', '#4aa0b0', '#8ad0c8');
const SPRIG = pmap([
  '...o.....',
  '..olo.o..',
  '..olloko.',
  '.oollkko.',
  'olllokoo.',
  '.ookko...',
  '...ko.oo.',
  '..okoolko',
  '..okkllo.',
  '..ok.oo..',
  '..ok.....',
  '...o.....',
], { o: '#0e2408', l: '#7ac04a', k: '#3a7a26' });

export class CookSet implements SetScene {
  intro = { text: 'COOKING!', style: 'shout' as const };
  canAbort = true;
  // layout (set px)
  SW = 470; GY = 146; HZ = 56;
  PX = 262; RY = 66; FX = 262;
  BX = 410; BY = 142;
  DX = 216; DY = 70;
  cam = 0; camTo = 0;
  bg!: PixelBuffer; fg!: PixelBuffer;
  potBuf!: PixelBuffer; dialBuf: PixelBuffer | null = null; bowlBuf!: PixelBuffer;
  // the meal
  phase: 'pick' | 'chop' | 'add' | 'cook' | 'season' | 'plate' | 'garnish' | 'end' = 'pick';
  pt = 0;
  stock: Stock[] = [];
  chosen: { id: string; from: From }[] = [];
  used: { id: string; from: From }[] = [];
  items: Prep[] = [];
  pot: InPot[] = [];
  method: Method = 'pot';
  heat: [number, number] = [0.45, 0.75];
  // chop
  chopI = -1; knifeX = 0; knifeDir = -1; knifeDown = 0; marks: number[] = []; marked: boolean[] = []; chopQ: number[] = []; chopWait = 0;
  // add
  sel = 0; drag: Prep | null = null; orderMiss = 0; lastRank = -1;
  // cook
  F = 0.7; B = 0.2; flareIn = 3; acc = 0; scorch = 0; cookT = 0; cookDur = 9; inBand = 0; stirA = 0; stir = 0; lastStir = 0; stick = 0; prevAng: number | null = null; logs: { t: number; x: number; y: number }[] = []; hotT = 0; coldT = 0;
  // season
  salt = 0; salting = false; tasteT = -1; seasonTries = 0; seasonQ = 1;
  // plate
  ladle = { x: 0, y: 0, fill: 0, held: false, dip: 0, pour: 0 }; bowlFill = 0; spilled = 0; auto = 0;
  // garnish
  sprig = { x: 0, y: 0, vy: 0, dropped: false, landed: false, off: 0 };
  // hands
  hx = 160; hy = 120;
  result: CookResult | null = null;
  sound = new CookSound();
  coachName: string;
  private said: Record<string, number> = {};
  private lines: Record<string, () => void> = {};
  private debugStock: boolean;

  constructor(readonly o: CookOpts & { debug?: boolean }, readonly done: (r: CookOutcome) => void) {
    this.coachName = o.coach ?? 'mori';
    this.debugStock = !!o.debug;
    this.sound.start();
  }

  // ------------------------------------------------------------ the larder
  private larder(): Stock[] {
    const out: Stock[] = [];
    const seen = new Set<string>();
    const taken = (id: string, from: From) => this.chosen.filter(c => c.id === id && c.from === from).length;
    if (this.debugStock) {
      for (const [id, n] of [['vil_kumara', 2], ['pipi', 4], ['v10_fish', 2], ['kawakawa', 3], ['berry_ember', 3], ['plant_dunelily', 2]] as [string, number][]) { seen.add(id); out.push({ id, n: n - taken(id, 'debug'), from: 'debug' }); }
    }
    for (const s of stacks()) if (CK.isIngredient(s.id) && !seen.has(s.id)) { seen.add(s.id); out.push({ id: s.id, n: count(s.id) - taken(s.id, 'pack'), from: 'pack' }); }
    if (this.o.where === 'camp') {
      const seen2 = new Set<string>();
      for (const s of stashStacks()) if (CK.isIngredient(s.id) && !seen.has(s.id) && !seen2.has(s.id)) { seen2.add(s.id); out.push({ id: s.id, n: stashCount(s.id) - taken(s.id, 'stash'), from: 'stash' }); }
    }
    return out.slice(0, 8);
  }
  private say(c: Closeup, text: string, o: { who?: string; style?: 'say' | 'shout' | 'happy' | 'scared' | 'whisper'; ms?: number; key?: string; cool?: number } = {}) {
    if (o.key) { if ((this.said[o.key] ?? -99) > c.t - (o.cool ?? 6)) return; this.said[o.key] = c.t; }
    const who = o.who ?? this.coachName;
    const color = who === 'joshu' ? '#bfe0ff' : who === 'aroha' ? '#ffd0e0' : '#fff6dc';
    const x = who === 'mori' ? Math.round(c.W * 0.62) : Math.round(c.W * 0.3);
    // one line at a time per speaker: a new line replaces the last
    this.lines[who]?.();
    this.lines[who] = c.say(text, x, who === 'mori' ? 34 : 20, { style: o.style ?? 'say', ms: o.ms ?? 2200, color });
  }

  // ------------------------------------------------------------ layout and the painted set
  layout(c: Closeup) {
    const H = c.H;
    this.SW = Math.max(c.W, 470);
    this.GY = H - 34;
    this.HZ = Math.round(this.GY - 90);
    this.RY = this.GY - 80; this.PX = 262; this.FX = 262;
    this.BX = this.SW - 62; this.BY = this.GY - 2;
    this.DX = this.PX - 50; this.DY = this.RY + 4;
    this.paintSet(H);
    this.potBuf = paintPot();
    this.bowlBuf = paintBowl();
    if (this.phase !== 'pick') this.dialBuf = paintDial(this.heat);
    this.stock = this.larder();
    this.layoutRow();
  }
  private paintSet(H: number) {
    const SW = this.SW, GY = this.GY, HZ = this.HZ, FX = this.FX;
    const bg = new PixelBuffer(SW * Z, H * Z), fg = new PixelBuffer(SW * Z, H * Z);
    this.bg = bg; this.fg = fg;
    const fy = GY - 8;
    // the night behind, warm where the fire reaches; packed earth lit in rings round the fire
    area(bg, 0, 0, SW, H, (u, v, x, y) => {
      const d = Math.hypot((u - FX) / 1.6, (v - fy) * 1.2);
      const edge = HZ + 6 + Math.sin(u * 0.045) * 3 + Math.sin(u * 0.13 + 1) * 1.5;
      if (v < edge || (v < edge + 3 && dith(x, y) < (edge + 3 - v) / 4)) return rd(NIGHT, v / (HZ + 6) * 0.55 + Math.max(0, 1 - d / 260) * 0.45 + (vnoise(u * 0.06, v * 0.1, 2) - 0.5) * 0.08, x, y);
      const lit = clamp01(1 - d / 230);
      let k = 0.12 + lit * 0.62 + (vnoise(u * 0.22, v * 0.45, 3) - 0.5) * 0.24 + (vnoise(u * 1.3, v * 1.3, 4) - 0.5) * 0.1;
      const g = hash(Math.floor(u * 1.5), Math.floor(v * 1.5), 9);
      if (g < 0.035) k -= 0.28; else if (g > 0.975) k += 0.22;
      return rd(PAL.soil, k, x, y);
    });
    // tree trunks at the edge of the clearing, running up out of frame, lit on the fire side
    for (let i = 0; i < 5; i++) {
      const tx = 30 + i * (SW - 60) / 4 + (hash(i, 1, 21) - 0.5) * 40, tw = 9 + (i * 5) % 7;
      if (Math.abs(tx - FX) < 70) continue;
      const foot = HZ + 4 + (i % 2) * 3, side = Math.sign(FX - tx), far = clamp01(0.5 + (1 - Math.abs(tx - FX) / 300));
      area(bg, tx - tw - 8, 0, tx + tw + 8, foot + 2, (u, v, x, y) => {
        const flare = v > foot - 8 ? (v - foot + 8) * 0.6 : 0;
        const half = tw + flare + Math.sin(v * 0.21 + i) * 0.6;
        const s = (u - tx) / half;
        if (Math.abs(s) > 1) return -1;
        if (Math.abs(s) > 1 - 0.8 / half) return PAL.bark[0];
        // bark: deep vertical furrows, lichen flecks, the fire's light on one side
        const furrow = Math.sin(u * 1.9 + Math.sin(v * 0.07 + i) * 2.4);
        let k = 0.2 + s * side * 0.18 + (furrow > 0.75 ? -0.1 : furrow < -0.6 ? 0.05 : 0) + (vnoise(u * 0.8, v * 0.15, i) - 0.5) * 0.12;
        if (vnoise(u * 0.5, v * 0.5, 40 + i) > 0.8) k += 0.12;
        return rd(PAL.bark, k * far, x, y);
      });
    }
    // the bush and the tree ferns at the edge of the firelight
    for (let i = 0; i < 9; i++) {
      const f = paintGroundFern(31 + i * 7, (18 + (i * 7) % 13) * Z, PAL.fern).buf;
      const x = i * SW / 8 - 20 + (i % 3) * 9, y = HZ + 8 - f.h / Z;
      const lit = clamp01(1 - Math.abs(x + f.w / Z / 2 - FX) / 260);
      blit(bg, f, x, y, { dark: 0.8 - lit * 0.35 });
    }
    // the tent at the back right, lit from the fire
    paintTent(bg, SW - 150, HZ - 50, 120, 62, FX);
    // pebbles and twigs
    for (let i = 0; i < 16; i++) {
      const w = 6 + (i * 5) % 9, h = 4 + (i * 3) % 5;
      const x = hash(i, 1, 5) * SW, y = HZ + 14 + hash(i, 2, 5) * (H - HZ - 20);
      if (Math.abs(x - FX) < 70 && Math.abs(y - fy) < 20) continue;
      if (i % 4 === 3) { const a = hash(i, 3, 5) * 3; line(bg, x, y, x + Math.cos(a) * 12, y + Math.sin(a) * 3, (t, fx2, fy2, sd) => rd(PAL.bark, 0.45 - sd * 0.2 - t * 0.1, fx2, fy2), Math.max(2, Z)); continue; }
      const r = paintRock(400 + i, w * Z, h * Z, PAL.stoneWarm, 0).buf;
      shadowOval(bg, x + w / 2, y + h, w * 0.6, 2, 0.6);
      blit(bg, r, x, y);
    }
    // the fire pit: the ash bed, the back stones, the logs
    ellipse(bg, FX, fy, 48, 10, (nx, ny, u, v, x, y) => rd(ramp('#141010', '#2a2220', '#4a3c34', '#6a5a4c', '#8a7a6a'), 0.32 + (vnoise(u * 0.6, v * 0.9, 6) - 0.5) * 0.5 - ny * 0.15 - (nx * nx) * 0.1, x, y));
    const ringN = 12;
    for (let i = 0; i < ringN; i++) {
      const a = i / ringN * Math.PI * 2;
      const sx = FX + Math.cos(a) * 50, sy = fy + Math.sin(a) * 11;
      const w = 18 + (i * 7) % 8, h = 11 + (i * 5) % 5;
      const r = paintRock(90 + i * 3, w * Z, h * Z, PAL.stoneWarm, 0).buf;
      const front = Math.sin(a) > 0.1;
      // the fire side of each stone glows
      r.map((col, x, y) => (y < r.h * 0.5 && dith(x, y) < 0.55 - y / r.h ? mix(col, hex('#ff9a40'), 0.35) : col));
      blit(front ? fg : bg, r, sx - w / 2, sy - h + 4);
    }
    blit(bg, paintLog(5, 54 * Z, 4 * Z).buf, FX - 30, fy - 8);
    blit(bg, paintLog(9, 50 * Z, 4 * Z).buf, FX - 22, fy - 4, { fx: true });
    // the tripod over the fire: the back leg, then the two front ones (in front of the pot)
    leg(bg, FX + 6, -4, FX + 40, GY - 26, 2);
    leg(fg, FX - 2, -4, FX - 58, GY + 6, 3);
    leg(fg, FX + 2, -4, FX + 62, GY + 4, 3);
    // a chain of little iron links from the top down to the pot's bail
    for (let y = -2; y < this.RY - 16; y += 2.6) {
      const flat = Math.round(y / 2.6) % 2 === 0;
      ellipse(fg, FX, y + 1.3, flat ? 1.1 : 0.5, 1.5, (nx, ny, _u, _v, x, yy) => (nx * nx + ny * ny > 0.35 || !flat ? rd(ramp('#141210', '#3a3632', '#6a625a', '#9a9288'), 0.5 - nx * 0.35, x, yy) : -1));
    }
    // the woodpile left of the fire
    for (let i = 0; i < 4; i++) {
      const l = paintLog(40 + i, (24 + (i % 2) * 4) * Z, 3 * Z).buf;
      blit(bg, l, FX - 92 + (i % 2) * 6 + Math.floor(i / 2) * 2, GY - 6 - Math.floor(i / 2) * 6 - (i % 2) * 2, { fx: i % 2 === 1 });
    }
    // the driftwood board on the left
    paintBoard(bg, 26, GY - 44, 172, 32);
    // the woven flax mat in front
    paintMat(bg, 6, GY + 3, 214, Math.max(18, H - GY - 5));
    // the paua shell of sea salt, right of the fire
    paintShell(bg, FX + 52, GY - 2);
    // the bowl on its flat stone, the sprig beside it
    blit(bg, paintRock(777, 70 * Z, 14 * Z, PAL.stone, 0.2).buf, this.BX - 35, this.BY + 2);
    blit(bg, up(SPRIG, Z), this.BX + 36, this.BY + 4);
    blit(bg, up(SPRIG, Z), this.BX + 41, this.BY + 6, { fx: true });
  }
  private layoutRow() {
    const row = this.items.filter(p => p.state === 'row');
    row.forEach((p, i) => { p.tx = 44 + i * 26; p.ty = this.GY - 34; });
  }

  // ------------------------------------------------------------ update
  update(c: Closeup, dt: number) {
    this.pt += dt;
    this.cam = lerp(this.cam, this.camTo, 1 - Math.exp(-dt * 5));
    if (Math.abs(this.cam - this.camTo) < 0.5) this.cam = this.camTo;
    // the hand follows the pointer (a little behind, like a real hand)
    const wx = c.ptr.x + this.cam, wy = c.ptr.y;
    this.hx = lerp(this.hx, wx, 1 - Math.exp(-dt * 18));
    this.hy = lerp(this.hy, wy, 1 - Math.exp(-dt * 18));
    for (const p of this.items) {
      if (p.state === 'row' || p.state === 'chop') { p.x = lerp(p.x, p.tx, 1 - Math.exp(-dt * 10)); p.y = lerp(p.y, p.ty, 1 - Math.exp(-dt * 10)); }
      if (p.state === 'fly' && p.fly) {
        p.fly.t += dt / 0.45;
        const k = easeInOut(p.fly.t);
        p.x = lerp(p.fly.x0, this.PX, k); p.y = lerp(p.fly.y0, this.RY, k) - Math.sin(k * Math.PI) * 30;
        if (p.fly.t >= 1) this.intoPot(c, p);
      }
    }
    // the fire
    this.updateFire(c, dt);
    switch (this.phase) {
      case 'pick': this.updPick(c); break;
      case 'chop': this.updChop(c, dt); break;
      case 'add': this.updAdd(c); break;
      case 'cook': this.updCook(c, dt); break;
      case 'season': this.updSeason(c, dt); break;
      case 'plate': this.updPlate(c, dt); break;
      case 'garnish': this.updGarnish(c, dt); break;
      case 'end': if (this.pt > 0.9) this.finish(c); break;
    }
    this.sound.update(dt, this.F, 0, this.phase === 'cook' ? this.B : this.pot.length ? 0.3 : 0.15);
  }
  private go(p: CookSet['phase']) { this.phase = p; this.pt = 0; }

  private updateFire(c: Closeup, dt: number) {
    if (this.phase !== 'cook') this.F = lerp(this.F, 0.6, dt * 0.5);
    // logs thrown on catch after a moment
    for (const l of this.logs) l.t += dt;
    for (const l of this.logs.filter(q => q.t >= 0.5 && q.t - dt < 0.5)) {
      this.F = Math.min(1.05, this.F + 0.26);
      c.parts.burst('spark', this.FX + (Math.random() - 0.5) * 30, this.GY - 14, 16, 70, { c: ['#ffb040', '#ff7020'], life: 0.9, g: 30, up: 30 });
      c.sfx('fireLight', { vol: 0.35 }); c.shake(1.5, 0.15);
      void l;
    }
    this.logs = this.logs.filter(l => l.t < 0.6);
    // embers and the odd spark
    if (Math.random() < dt * (3 + this.F * 8)) c.parts.add('ember', this.FX + (Math.random() - 0.5) * 50 - this.cam, this.GY - 18, (Math.random() - 0.5) * 10, -20 - Math.random() * 30, { c: '#ff8030', life: 1 + Math.random() });
  }

  // ------------------------------------------------------------ 1 pick
  private matSpots(): { s: Stock; x: number; y: number }[] {
    const st = this.stock.filter(s => s.n > 0);
    const n = st.length, w = 200;
    return st.map((s, i) => ({ s, x: Math.round(18 + (i + 0.5) * w / Math.max(4, n)), y: this.GY + 6 + Math.round((this.bg.h - this.GY - 10) / 2) }));
  }
  private updPick(c: Closeup) {
    this.camTo = 0;
    if (this.pt < 0.1 && !this.said.pickIntro) { this.said.pickIntro = c.t; this.say(c, this.o.title ?? 'What are we cooking with?', { who: this.coachName === 'mori' ? 'mori' : this.coachName }); }
    const spots = this.matSpots();
    const mx = c.ptr.x + this.cam, my = c.ptr.y;
    let pickId: number | null = null;
    if (c.ptr.pressed) {
      spots.forEach((sp, i) => { if (Math.abs(mx - sp.x) < 13 && Math.abs(my - sp.y) < 13) pickId = i; });
      // tap a chosen thing on the board to put it back
      const back = this.items.findIndex(p => p.state === 'row' && Math.abs(mx - p.x) < 12 && Math.abs(my - p.y) < 12);
      if (back >= 0 && pickId === null) { this.putBack(c, back); return; }
      if (this.chosen.length && this.cookHit(c, mx, my)) { this.startCooking(c); return; }
    }
    for (let k = 1; k <= 8; k++) if (c.hit('Digit' + k)) pickId = k - 1;
    if (c.hit('Backspace') && this.items.length) this.putBack(c, this.items.length - 1);
    if ((c.hit('Enter') || c.hit('Space')) && this.chosen.length) { this.startCooking(c); return; }
    if (pickId !== null && spots[pickId]) this.pick(c, spots[pickId].s, spots[pickId].x, spots[pickId].y);
  }
  private cookHit(_c: Closeup, x: number, y: number) { return Math.abs(x - this.PX) < 46 && y > this.RY - 30 && y < this.RY + 50; }
  private pick(c: Closeup, s: Stock, x: number, y: number) {
    if (this.chosen.length >= 6) { this.say(c, 'That’s plenty. Any more and it won’t fit.', { who: 'mori', key: 'full' }); c.sfx('wrong', { vol: 0.3 }); return; }
    this.chosen.push({ id: s.id, from: s.from });
    const ing = CK.INGREDIENTS[s.id];
    this.items.push({ id: s.id, from: s.from, chop: !!ing?.chop, cuts: [], cutQ: [], x, y, tx: x, ty: y, state: 'row', spread: 0 });
    this.layoutRow();
    this.stock = this.larder();
    c.sfx('pluck', { vol: 0.4, pitch: 1 + this.chosen.length * 0.06 });
    c.parts.burst('dust', x - this.cam, y + 4, 5, 20, { c: '#d8cc86', life: 0.4 });
    if (CK.riskyIn([s.id]).length) this.say(c, 'You sure about that one? Fire doesn’t make a bad mushroom good.', { key: 'risky', cool: 30 });
  }
  private putBack(c: Closeup, i: number) {
    const p = this.items[i];
    this.items.splice(i, 1);
    const j = this.chosen.findIndex(q => q.id === p.id && q.from === p.from);
    if (j >= 0) this.chosen.splice(j, 1);
    this.layoutRow();
    this.stock = this.larder();
    c.sfx('paperSlide', { vol: 0.3 });
  }
  /** what these make, and the way it's cooked */
  private planNow(): { method: Method; recipe: CK.Recipe | null; dish: string } {
    const ids = this.chosen.map(q => q.id);
    for (const m of ['pot', 'pan', 'skewer'] as Method[]) { const r = CK.recipeFor(m, ids); if (r) return { method: m, recipe: r, dish: r.dish }; }
    return { method: 'pot', recipe: null, dish: CK.ADHOC.pot.dish };
  }
  private startCooking(c: Closeup) {
    const pl = this.planNow();
    this.method = pl.method;
    const p = CK.plan(this.method, this.chosen.map(q => q.id));
    this.heat = p.heat;
    this.cookDur = clamp(p.time * 0.7, 7, 12);
    this.dialBuf = paintDial(this.heat);
    // the food comes out of the pack now (it goes back if Mori stops before it's cooked)
    for (const q of this.chosen) {
      const ok = q.from === 'pack' ? remove(q.id, 1) : q.from === 'stash' ? stashRemove(q.id, 1) : true;
      if (ok) this.used.push(q);
    }
    c.sfx('whoosh', { vol: 0.3 });
    // chop the ones that want it, in board order
    this.chopI = -1;
    this.nextChop(c);
  }

  // ------------------------------------------------------------ 2 chop
  private nextChop(c: Closeup) {
    const i = this.items.findIndex((p, k) => k > this.chopI && p.chop && !p.cuts.length);
    if (i < 0) {
      for (const p of this.items) if (p.state === 'chop') p.state = 'row';
      this.layoutRow();
      this.go('add');
      this.say(c, this.coachName === 'joshu' ? 'Into the pot. Roots first, they take longest. Greens last.' : 'Into the pot. Hard things first, soft things last.', { key: 'addIntro', cool: 99 });
      return;
    }
    if (this.chopI < 0) this.say(c, this.coachName === 'joshu' ? 'Cut it on the marks, lad. Even pieces cook even.' : 'Chop on the marks. Even pieces.', { key: 'chopIntro', cool: 99 });
    this.chopI = i;
    const p = this.items[i];
    p.state = 'chop';
    const w = itemSprite(p.id, CHOP).w / Z;
    p.tx = 112; p.ty = this.GY - 28;
    const n = w >= 30 ? 4 : 3;
    this.marks = [];
    for (let k = 0; k < n; k++) this.marks.push(w * (0.18 + 0.64 * (k + 0.5) / n) + (hash(i, k, 4) - 0.5) * 2);
    this.marked = this.marks.map(() => false);
    this.knifeX = p.tx + w / 2 + 10;
    this.knifeDir = -1;
    this.chopWait = 0.35;
    this.go('chop');
  }
  private updChop(c: Closeup, dt: number) {
    this.camTo = 0;
    const p = this.items[this.chopI];
    const w = itemSprite(p.id, CHOP).w / Z;
    const left = p.x - w / 2, right = p.x + w / 2;
    this.knifeDown = Math.max(0, this.knifeDown - dt * 6);
    if (this.chopWait > 0) { this.chopWait -= dt; return; }
    // the knife sweeps across, quicker each cut
    const speed = 34 + this.marked.filter(Boolean).length * 6;
    this.knifeX += this.knifeDir * speed * dt;
    if (this.knifeX < left + 2) { this.knifeX = left + 2; this.knifeDir = 1; }
    if (this.knifeX > right + 6) { this.knifeX = right + 6; this.knifeDir = -1; }
    if (c.act() && this.knifeDown <= 0.2) {
      this.knifeDown = 1;
      // the nearest mark still to cut
      const lx = this.knifeX - left;
      let best = -1, bd = 1e9;
      this.marks.forEach((m, i) => { if (!this.marked[i] && Math.abs(m - lx) < bd) { bd = Math.abs(m - lx); best = i; } });
      if (best < 0) return;
      const dpx = bd;
      const q = dpx < 2 ? 1 : dpx < 4.5 ? 0.75 : dpx < 8 ? 0.45 : 0.15;
      this.marked[best] = true;
      p.cuts.push(clamp(lx, 1, w - 1)); p.cutQ.push(q);
      p.cuts.sort((a, b) => a - b);
      this.chopQ.push(q);
      this.sound.chop();
      c.shake(q >= 0.75 ? 1 : 2, 0.1);
      const raw = hex(CK.INGREDIENTS[p.id]?.raw ?? '#c8a060');
      c.parts.burst('crumb', this.knifeX - this.cam, p.y + 6, q >= 0.75 ? 5 : 9, 50, { c: [raw, mix(raw, hex('#ffffff'), 0.3)], g: 220, life: 0.6, floor: this.GY - 16 });
      const word = q >= 1 ? 'CLEAN!' : q >= 0.75 ? 'NICE' : q >= 0.45 ? 'OK' : 'RAGGED';
      c.say(word, Math.round(this.knifeX - this.cam), p.y - 30, { style: q >= 1 ? 'shout' : q >= 0.45 ? 'happy' : 'scared', ms: 600, color: q >= 0.75 ? '#ffe680' : '#e8d8c0' });
      if (this.marked.every(Boolean)) {
        c.sfx('qteHit', { vol: 0.3, pitch: 1.2 });
        this.chopWait = 0.5;
        setTimeoutish(this, 0.5, () => { p.state = 'row'; this.layoutRow(); this.nextChop(c); });
      }
    }
  }

  // ------------------------------------------------------------ 3 add (in order)
  private updAdd(c: Closeup) {
    this.camTo = 20;
    const row = this.items.filter(p => p.state === 'row');
    if (!row.length && !this.drag && !this.items.some(p => p.state === 'fly')) { this.startCook(c); return; }
    const mx = c.ptr.x + this.cam, my = c.ptr.y;
    if (c.ptr.pressed && !this.drag) {
      const hit = row.find(p => Math.abs(mx - p.x) < 13 && Math.abs(my - p.y) < 13);
      if (hit) { this.drag = hit; hit.state = 'held'; c.sfx('pluck', { vol: 0.35 }); }
    }
    if (this.drag) {
      this.drag.x = mx; this.drag.y = my;
      if (!c.ptr.down) {
        const d = this.drag;
        this.drag = null;
        if (Math.abs(mx - this.PX) < 40 && my > this.RY - 36 && my < this.RY + 30) this.intoPot(c, d);
        else { d.state = 'row'; this.layoutRow(); c.sfx('place', { vol: 0.3 }); }
      }
    }
    // keys: pick with the arrows, Space drops it in
    if (row.length) {
      if (c.hit('ArrowLeft') || c.hit('KeyA')) this.sel = (this.sel + row.length - 1) % row.length;
      if (c.hit('ArrowRight') || c.hit('KeyD')) this.sel = (this.sel + 1) % row.length;
      this.sel = Math.min(this.sel, row.length - 1);
      if (c.hit('Space') || c.hit('Enter')) { const p = row[this.sel]; p.state = 'fly'; p.fly = { t: 0, x0: p.x, y0: p.y }; c.sfx('whoosh', { vol: 0.2, pitch: 1.4 }); }
    }
  }
  private intoPot(c: Closeup, p: Prep) {
    p.state = 'pot';
    p.fly = undefined;
    const r = rankOf(p.id);
    if (r < this.lastRank) {
      this.orderMiss++;
      this.say(c, rankOf(p.id) === 0 ? 'Roots go in first or they stay hard...' : 'Hmm. That one should have gone in later.', { key: 'order', cool: 4 });
    }
    this.lastRank = Math.max(this.lastRank, r);
    const n = Math.max(1, p.cuts.length + 1);
    for (let i = 0; i < n; i++) this.pot.push({ id: p.id, x: (hash(this.pot.length, i, 2) - 0.5) * 44, y: (hash(i, this.pot.length, 7) - 0.5) * 9, ph: Math.random() * 6, sink: 1 });
    this.sound.splash(false);
    c.sfx('splash', { vol: 0.35, pitch: 1.2 + Math.random() * 0.3 });
    c.shake(1, 0.1);
    c.parts.burst('drop', this.PX - this.cam, this.RY, 14, 70, { c: ['#9ab8c8', '#d8eef8'], g: 260, life: 0.7, spread: 2.2 });
    c.parts.burst('steam', this.PX - this.cam, this.RY - 4, 4, 10, { c: '#d8d0c8', life: 1.2, up: 12 });
    this.layoutRow();
  }

  // ------------------------------------------------------------ 4 cook
  private startCook(c: Closeup) {
    this.go('cook');
    this.F = (this.heat[0] + this.heat[1]) / 2 + 0.16;
    this.B = this.F * 0.8;
    this.lastStir = c.t;
    this.say(c, this.coachName === 'joshu' ? 'Keep the needle in the green. Stir to calm it, a log to wake it.' : 'Keep the needle in the green. Stir it down, feed the fire up.', { key: 'cookIntro', cool: 99, ms: 3000 });
  }
  private updCook(c: Closeup, dt: number) {
    this.camTo = 40;
    this.cookT += dt;
    const [lo, hi] = this.heat;
    // stirring: circling round inside the pot (or holding S / Space)
    const mx = c.ptr.x + this.cam, my = c.ptr.y;
    let stirNow = 0;
    const inPot = Math.abs(mx - this.PX) < 44 && my > this.RY - 26 && my < this.RY + 26;
    if (c.ptr.down && inPot) {
      const a = Math.atan2((my - this.RY) * 3, mx - this.PX);
      if (this.prevAng !== null) {
        let d = a - this.prevAng;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        stirNow = Math.min(1.4, Math.abs(d) / dt / 7);
        this.stirA += d;
      }
      this.prevAng = a;
    } else this.prevAng = null;
    if (c.key('KeyS') || c.key('Space')) { stirNow = Math.max(stirNow, 0.8); this.stirA += dt * 5; }
    this.stir = lerp(this.stir, stirNow, 1 - Math.exp(-dt * 8));
    if (this.stir > 0.25) this.lastStir = c.t;
    if (this.stir > 0.3 && Math.random() < dt * 6) this.sound.splash(false);
    // stoke: tap the woodpile (or W / F)
    const wpx = this.FX - 80;
    if ((c.ptr.pressed && Math.abs(mx - wpx) < 22 && Math.abs(my - (this.GY - 10)) < 14) || c.hit('KeyW') || c.hit('KeyF')) {
      if (this.logs.length < 2) { this.logs.push({ t: 0, x: wpx, y: this.GY - 12 }); c.sfx('woodCreak', { vol: 0.35, pitch: 1.3 }); }
    }
    // the fire dies down; the pot follows the fire; stirring pulls the bubbling down
    this.F = Math.max(0.1, this.F - dt * (0.045 + Math.sin(c.t * 0.9) * 0.012));
    // now and then the wind gets under the fire and it flares up
    this.flareIn -= dt;
    if (this.flareIn <= 0) {
      this.flareIn = 2.6 + Math.random() * 2.2;
      if (this.cookT > 1.5) {
        this.F = Math.min(1.05, this.F + 0.14 + Math.random() * 0.06);
        c.sfx('gust', { vol: 0.25, pitch: 1.2 });
        c.parts.burst('spark', this.FX - this.cam, this.GY - 16, 12, 80, { c: ['#ffb040', '#ff7020'], life: 0.8, g: 40, up: 40 });
        this.say(c, 'Whoa, it flared up!', { who: 'mori', key: 'flare', cool: 8, style: 'scared' });
      }
    }
    const target = clamp01(this.F * 1.08 - this.stir * 0.35);
    this.B = lerp(this.B, target, 1 - Math.exp(-dt * 1.4));
    this.B = clamp01(this.B + Math.sin(c.t * 2.3) * dt * 0.02);
    // cooking: right in the band is right on time
    const rate = this.B < lo ? Math.pow(Math.max(0, this.B / lo), 2) * 0.7 : this.B > hi ? 1.15 : 1;
    this.acc += rate * dt / this.cookDur;
    if (this.B >= lo && this.B <= hi) this.inBand += dt;
    if (this.B > hi) { this.scorch += (this.B - hi) * dt * 0.9; this.hotT += dt; } else this.hotT = 0;
    if (this.B < lo) this.coldT += dt; else this.coldT = 0;
    if (c.t - this.lastStir > 4 && this.B > lo) { this.stick += dt * 0.025; if (c.t - this.lastStir > 4.2) this.say(c, 'It’s catching on the bottom! Stir!', { key: 'stick', cool: 6, style: 'shout' }); }
    if (this.hotT > 1.2) this.say(c, this.coachName === 'joshu' ? 'Too hot, lad! Stir it down!' : 'Too hot! Stir!', { key: 'hot', cool: 5, style: 'shout' });
    if (this.coldT > 2) this.say(c, this.coachName === 'joshu' ? 'It’s gone off the boil. Another log.' : 'It’s going cold... another log.', { key: 'cold', cool: 6 });
    // the pot: steam, bubbles, the odd spit when it's too hot, smoke when it catches
    if (Math.random() < dt * (2 + this.B * 14)) c.parts.add('steam', this.PX + (Math.random() - 0.5) * 50 - this.cam, this.RY - 2, (Math.random() - 0.5) * 6, -14 - this.B * 16, { c: '#d8d0c8', life: 1.2 + Math.random(), s: 1 + this.B });
    if (this.B > hi + 0.08 && Math.random() < dt * 8) { c.parts.add('drop', this.PX + (Math.random() - 0.5) * 50 - this.cam, this.RY - 1, (Math.random() - 0.5) * 50, -60 - Math.random() * 40, { c: '#c8b090', g: 300, life: 0.6 }); if (Math.random() < 0.3) c.sfx('hiss', { vol: 0.15, pitch: 1.8 }); }
    if (this.scorch > 0.15 && Math.random() < dt * this.scorch * 12) c.parts.add('smoke', this.PX + (Math.random() - 0.5) * 30 - this.cam, this.RY - 2, (Math.random() - 0.5) * 6, -18, { c: '#2a2624', life: 1.6, s: 1.5 });
    for (const q of this.pot) q.sink = lerp(q.sink, 0.35 + this.B * 0.3, dt * 2);
    c.watch = { t01: 1 - clamp01(this.acc), x: Math.round(this.PX - this.cam + 64), y: this.RY - 24, size: 26, secs: Math.round(this.cookDur) };
    if (this.acc >= 1 || this.cookT >= this.cookDur * 1.5) {
      c.sfx('qteHit', { vol: 0.4 });
      this.say(c, this.acc >= 1 ? (this.scorch > 0.3 ? 'Ooh. Smells a bit... smoky.' : 'That’s cooked! Now a pinch of salt.') : 'It’ll have to do. Salt!', { key: 'cooked', cool: 99 });
      this.go('season');
    }
  }

  // ------------------------------------------------------------ 5 season
  private updSeason(c: Closeup, dt: number) {
    this.camTo = 60;
    this.B = lerp(this.B, 0.35, dt * 0.6);
    const mx = c.ptr.x + this.cam;
    const auto = c.key('Space') || c.key('KeyE');
    if (auto) { this.hx = this.PX; this.hy = this.RY - 30; }
    const holding = (c.ptr.down && !c.ptr.pressed) || auto || (c.ptr.pressed && c.ptr.down);
    if (this.tasteT >= 0) {
      this.tasteT += dt;
      if (this.tasteT > 0.9) {
        this.tasteT = -1;
        const [a, b] = [0.4, 0.68];
        if (this.salt < a && this.seasonTries < 3) { this.say(c, 'Needs a pinch more.', { who: 'mori' }); c.sfx('munch', { vol: 0.3 }); }
        else {
          this.seasonQ = this.salt < a ? 0.5 : this.salt > b ? (this.salt > 0.9 ? 0.1 : 0.35) : 1 - Math.abs(this.salt - (a + b) / 2) / ((b - a) / 2) * 0.25;
          this.say(c, this.salt > b ? 'Bleh! Salty...' : this.salt < a ? 'Bit bland. Fine.' : 'Mmm! Just right.', { who: 'mori', style: this.salt > b ? 'scared' : 'happy' });
          c.sfx(this.salt > b ? 'wrong' : 'munch', { vol: 0.35 });
          this.go('plate');
          this.ladle = { x: this.PX + 10, y: this.RY - 30, fill: 0, held: false, dip: 0, pour: 0 };
          return;
        }
      }
      return;
    }
    if (holding) {
      if (!this.salting) { this.salting = true; c.sfx('rustle', { vol: 0.2, pitch: 1.8 }); }
      // grains fall from the pinch: only what lands in the pot counts
      const over = Math.abs(this.hx - this.PX) < 30 && this.hy < this.RY + 4;
      if (over) this.salt += dt * 0.34;
      if (Math.random() < dt * 40) c.parts.add('grain', this.hx - this.cam + (Math.random() - 0.5) * 3, this.hy + 2, (Math.random() - 0.5) * 8, 20, { c: Math.random() < 0.5 ? '#ffffff' : '#c8c8c0', g: 280, life: 0.5, floor: over ? this.RY + 1 : this.GY });
      if (this.salt > 0.75) this.say(c, 'Whoa, whoa! Enough!', { key: 'salty', cool: 4, style: 'shout' });
      else if (this.salt > 0.42) this.say(c, 'That’s about it...', { key: 'nearly', cool: 6, style: 'whisper' });
    } else if (this.salting) {
      this.salting = false;
      this.seasonTries++;
      this.tasteT = 0;
    }
    void mx;
  }

  // ------------------------------------------------------------ 6 plate
  private updPlate(c: Closeup, dt: number) {
    this.camTo = this.SW - c.W;
    this.B = lerp(this.B, 0.3, dt * 0.6);
    const L = this.ladle;
    const auto = c.key('Space') || c.key('Enter');
    let tx = c.ptr.x + this.cam, ty = c.ptr.y;
    if (auto) {
      // keys: the ladle goes by itself, steadily
      this.auto += dt;
      const toPot = L.fill < 0.5;
      tx = toPot ? this.PX : this.BX; ty = toPot ? this.RY + 2 : this.BY - 6;
      L.x = lerp(L.x, tx, 1 - Math.exp(-dt * 3)); L.y = lerp(L.y, ty, 1 - Math.exp(-dt * 3));
    } else if (c.ptr.down || !c.touch) {
      const px = L.x, py = L.y;
      L.x = lerp(L.x, tx, 1 - Math.exp(-dt * 16)); L.y = lerp(L.y, ty, 1 - Math.exp(-dt * 16));
      // carried too fast, it slops over the side
      const v = Math.hypot(L.x - px, L.y - py) / dt;
      if (L.fill > 0.2 && v > 240) {
        const lost = dt * (v - 240) / 300;
        L.fill = Math.max(0, L.fill - lost); this.spilled += lost;
        c.parts.burst('drop', L.x - this.cam, L.y, 2, 40, { c: this.brothCol(), g: 300, life: 0.6, floor: this.GY + 4 });
        if (Math.random() < dt * 6) c.sfx('splash', { vol: 0.15, pitch: 2 });
        this.say(c, 'Careful, it’s slopping!', { key: 'slop', cool: 5, who: 'mori', style: 'scared' });
      }
    }
    const inPot = Math.abs(L.x - this.PX) < 30 && Math.abs(L.y - this.RY) < 12;
    const overBowl = Math.abs(L.x - this.BX) < 24 && Math.abs(L.y - (this.BY - 4)) < 16;
    if (L.fill < 0.5 && inPot && (c.ptr.down || auto)) {
      L.dip += dt;
      if (L.dip > 0.35) { L.fill = 1; L.dip = 0; c.sfx('splash', { vol: 0.3, pitch: 1.5 }); c.parts.burst('drop', L.x - this.cam, L.y, 6, 30, { c: this.brothCol(), g: 260, life: 0.5 }); }
    } else L.dip = 0;
    if (L.fill > 0 && overBowl && (!c.ptr.down || auto) && L.pour <= 0) L.pour = 0.001;
    if (L.pour > 0) {
      L.pour += dt;
      if (Math.random() < 0.6) c.parts.add('drop', L.x - this.cam - 3, L.y + 2, (Math.random() - 0.5) * 6, 30, { c: this.brothCol(), g: 300, life: 0.25, floor: this.BY - 6 });
      if (L.pour > 0.45) {
        this.bowlFill = Math.min(2, this.bowlFill + L.fill);
        L.fill = 0; L.pour = 0;
        c.sfx('splash', { vol: 0.3, pitch: 1.1 });
        c.parts.burst('steam', this.BX - this.cam, this.BY - 8, 4, 10, { c: '#d8d0c8', life: 1.2, up: 10 });
        if (this.bowlFill >= 1.9 || (this.bowlFill >= 1 && this.spilled > 0.6)) {
          this.go('garnish');
          this.sprig = { x: this.BX, y: this.BY - 44, vy: 0, dropped: false, landed: false, off: 0 };
          this.say(c, 'And something green on top...', { who: 'mori', key: 'garnish', cool: 99 });
        }
      }
    }
  }
  brothCol(): C {
    const cs = this.pot.map(q => hex(CK.INGREDIENTS[q.id]?.cooked ?? '#c89048'));
    let c = hex('#a8783c');
    cs.forEach((x, i) => { c = mix(c, x, 1 / (i + 2)); });
    return c;
  }

  // ------------------------------------------------------------ 7 garnish
  private updGarnish(c: Closeup, dt: number) {
    this.camTo = this.SW - c.W;
    const s = this.sprig;
    if (!s.dropped) {
      s.x = this.BX + Math.sin(this.pt * 2.4) * 26;
      if (c.act() && this.pt > 0.3) { s.dropped = true; c.sfx('whoosh', { vol: 0.2, pitch: 1.6 }); }
    } else if (!s.landed) {
      s.vy += 420 * dt; s.y += s.vy * dt;
      if (s.y >= this.BY - 10) {
        s.y = this.BY - 10; s.landed = true;
        s.off = Math.abs(s.x - this.BX) / 22;
        if (s.off > 1) { s.y = this.BY + 6; this.say(c, 'Oops. Missed the bowl.', { who: 'mori' }); c.sfx('wrong', { vol: 0.3 }); }
        else { c.sfx('pluck', { vol: 0.4, pitch: 1.4 }); c.parts.burst('star', s.x - this.cam, s.y, s.off < 0.3 ? 8 : 4, 30, { c: '#ffe680', life: 0.6 }); }
        this.go('end');
      }
    }
  }

  // ------------------------------------------------------------ the end
  private finish(c: Closeup) {
    if (this.result) return;
    const ids = this.used.map(q => q.id);
    const chopQ = this.chopQ.length ? this.chopQ.reduce((a, b) => a + b, 0) / this.chopQ.length : 1;
    const orderQ = Math.max(0, 1 - this.orderMiss * 0.34);
    const band = this.cookT > 0 ? this.inBand / this.cookT : 0.5;
    const plate = clamp01(1 - this.spilled / 1.2);
    const garnish = clamp01(1 - this.sprig.off);
    const care = clamp01(0.22 * chopQ + 0.12 * orderQ + 0.3 * band + 0.14 * this.seasonQ + 0.12 * plate + 0.1 * garnish - this.stick);
    const done = clamp(this.acc + this.scorch * 0.35, 0, 1.6);
    this.result = CK.finishCook(this.method, ids.length ? ids : ['ration'], done, care);
    if (this.debugStock) for (const q of this.used.filter(u => u.from === 'debug')) void q;
    const q = this.result.quality;
    const grade: Grade = q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : q === 'raw' ? 'rough' : 'fail';
    if (q === 'perfect') c.parts.burst('star', this.BX - this.cam, this.BY - 10, 12, 50, { c: '#ffe680', life: 0.9 });
    c.finish(grade, care, { word: q === 'burnt' ? 'BURNT' : q === 'raw' ? 'ROUGH' : undefined });
    const line = q === 'perfect' ? (this.coachName === 'joshu' ? 'Now THAT is cooking. I’ll make a sailor of you yet.' : 'Oh, that’s good. That’s really good.')
      : q === 'good' ? (this.coachName === 'joshu' ? 'Not bad, lad. Not bad at all.' : 'Edible! Better than edible!')
        : q === 'raw' ? (this.coachName === 'joshu' ? 'Bit underdone. We’ll live. Probably.' : 'Crunchy. Is it meant to be crunchy?')
          : (this.coachName === 'joshu' ? '...Chunk’ll eat it.' : 'Well. Charcoal is technically a food group.');
    this.say(c, line, { ms: 3200 });
  }
  trophy(_c: Closeup) {
    const r = this.result;
    if (!r) return null;
    const b = new PixelBuffer(64 * Z, 34 * Z);
    this.drawBowl(b, 32, 14, true);
    const name = ITEMS[r.dish]?.name ?? r.dish;
    return { img: b, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: `${r.learned ? 'NEW RECIPE · ' : ''}${r.portions} PORTION${r.portions > 1 ? 'S' : ''}` };
  }
  onAbort() {
    // whatever went in comes back out (it wasn't cooked)
    for (const q of this.used) { if (q.from === 'pack') give(q.id, 1); else if (q.from === 'stash') stashAdd(q.id, 1); }
    this.used = [];
    this.done({ result: null, ids: [] });
  }
  dispose() {
    this.sound.stop();
    if (this.result) this.done({ result: this.result, ids: this.used.map(q => q.id) });
    else if (this.used.length) this.onAbort();
    else this.done({ result: null, ids: [] });
  }

  // ------------------------------------------------------------ drawing (units, painted at the fine grid)
  draw(c: Closeup, px: PixelBuffer) {
    const cam = Math.round(this.cam * Z) / Z;
    copyWin(px, this.bg, cam);
    const t = c.t;
    this.drawFire(px, cam, t);
    this.drawPot(c, px, cam, t);
    // the front of the fire pit and the tripod legs
    const off = Math.round(cam * Z), fg = this.fg, FW = fg.w, D = px.data, W = px.w, rows = Math.min(px.h, Math.ceil((this.GY + 14) * Z));
    for (let y = 0; y < rows; y++) { const r = y * FW + off, o = y * W; for (let x = 0; x < W; x++) { const v = fg.data[r + x]; if (v >>> 24 > 128) D[o + x] = v; } }
    if (this.dialBuf) this.drawDial(px, cam, t);
    this.drawLogsFlying(px, cam);
    this.drawBowlStation(c, px, cam);
    this.drawBoard(c, px, cam, t);
    this.drawHands(c, px, cam, t);
    this.drawPrompts(c, px, cam);
  }

  private drawFire(px: PixelBuffer, cam: number, t: number) {
    const fx = this.FX - cam, base = this.GY - 10, top = this.RY + 32;
    const Fh = 10 + this.F * 22;
    area(px, fx - 42, top - 6, fx + 42, base + 1, (u, v, x, y) => {
      const dx = (u - fx) / 42;
      const h = Fh * (1 - dx * dx) * (0.68 + 0.32 * vnoise(u * 0.32, t * 3, 7));
      // tongues: noise scrolling up through the flame, a fast flicker on top
      const k = (base - v) / Math.max(1, h) + (vnoise(u * 0.45, v * 0.3 + t * 6, 8) - 0.5) * 0.55 + 0.1 * Math.sin(u * 2.1 - t * 19);
      if (k < 0 || k > 1) return -1;
      return rd(FIRE, 1 - k * 0.97, x, y);
    });
    // embers glowing in the logs
    for (let i = 0; i < 26; i++) {
      const x = fx - 30 + hash(i, 1, 3) * 60, y = base + 2 + hash(i, 2, 3) * 4;
      if (Math.sin(t * (3 + i % 4) + i) > 0.1) dot(px, x, y, hash(i, 3, 3) > 0.5 ? hex('#ff9a30') : hex('#ffd060'), Math.max(1, Math.round(Z / 2)));
    }
  }

  private drawPot(c: Closeup, px: PixelBuffer, cam: number, t: number) {
    const pb = this.potBuf;
    const cx = this.PX - cam;
    // the wire bail up to the hook
    for (let i = 0; i < 60; i++) {
      const a0 = Math.PI * (i / 60), a1 = Math.PI * ((i + 1) / 60);
      line(px, cx - Math.cos(a0) * 38, this.RY + 2 - Math.sin(a0) * 18, cx - Math.cos(a1) * 38, this.RY + 2 - Math.sin(a1) * 18, (_t, x, y, sd) => (sd < 0 ? hex('#8a847c') : hex('#2a2622')), Math.max(2, Math.round(Z * 0.7)));
    }
    blit(px, pb, cx - pb.w / Z / 2, this.RY - 12);
    // the fire lights the belly from below
    glow(px, cx, this.RY + 46, 40, 0.35 + this.F * 0.25, hex('#ff8a30'));
    // what's in the pot
    const cy = this.RY + 1, rx = 31, ry = 7;
    const broth = this.pot.length ? mix(hex('#5a7480'), this.brothCol(), clamp01(this.acc * 1.3)) : hex('#4a6a78');
    const dark = mix(broth, hex('#0a0806'), 0.45), deep = mix(broth, hex('#0a0806'), 0.65), lit = mix(broth, hex('#fff0d0'), 0.35), shine = mix(broth, hex('#ffffff'), 0.6);
    const served = this.phase === 'plate' || this.phase === 'garnish' || this.phase === 'end';
    const level = served ? clamp01(1 - this.bowlFill * 0.3) : 1;
    const B = this.B;
    ellipse(px, cx, cy, rx, ry, (nx, ny, u, v, x, y) => {
      // the back of the surface is in the pot's shadow, the front catches the sky
      let k = 0.52 - ny * 0.28 + (level < 1 ? -0.2 : 0);
      k += Math.sin(u * 0.6 + t * (2 + B * 8)) * Math.sin(v * 1.3 - t * 3) * (0.1 + B * 0.25) + (vnoise(u * 0.4 + t, v * 0.8, 2) - 0.5) * 0.2;
      if (nx * nx + ny * ny > 0.82 && ny < 0) return deep;
      if (this.scorch > 0.3 && hash(x >> 1, y >> 1, Math.floor(t * 3)) < this.scorch * 0.15) return mix(broth, hex('#1a1210'), 0.6);
      // the sky's reflection, a long soft streak
      if (Math.abs(ny + 0.1 + nx * 0.25) < 0.08 && nx > -0.6 && nx < 0.2 && dith(x, y) < 0.7) return shine;
      return k < 0.32 ? dark : k > 0.72 ? lit : rd([dark, broth, lit], k, x, y);
    });
    // the food bobbing
    for (const q of this.pot) {
      const sp = itemSprite(q.id, 9);
      const bob = Math.sin(t * (1.5 + B * 3) + q.ph) * (0.5 + B * 1.2);
      const qx = cx + q.x * (served ? level : 1) - sp.w / Z / 2, qy = cy + q.y + bob - sp.h / Z * (1 - q.sink);
      const cooked = hex(CK.INGREDIENTS[q.id]?.cooked ?? '#c89048');
      blit(px, sp, qx, qy, { tint: cooked, tk: clamp01(this.acc) * 0.6, dark: this.scorch > 0.4 ? 0.4 : 0 });
      // the broth laps over the lower part
      area(px, qx, qy + sp.h / Z - 1.2, qx + sp.w / Z, qy + sp.h / Z, (_u, _v, x, y) => (dith(x, y) < 0.75 ? broth : -1));
    }
    // bubbles: a few when it simmers, a rolling boil when it's hot
    const nb = Math.floor(B * 22);
    for (let i = 0; i < nb; i++) {
      const sp = 0.8 + B * 2, ph = (t * sp + hash(i, 9, 1)) % 1, gen = Math.floor(t * sp + hash(i, 9, 1));
      const bx = cx + (hash(i, gen, 2) - 0.5) * rx * 1.6, by = cy + (hash(i, 4, gen) - 0.5) * ry * 1.4;
      const r = (B > 0.6 ? 1.4 : 0.9) * (ph < 0.7 ? 0.5 + ph : 0);
      if (r > 0) ellipse(px, bx, by, r, r * 0.8, (nx, ny) => (nx * nx + ny * ny > 0.45 ? (ny < 0 ? shine : dark) : -1));
      else if (ph > 0.9) dot(px, bx, by - 1, hex('#e8f0f0'));
    }
    // too hot: foam climbs the rim
    if (B > this.heat[1] + 0.06 && this.phase === 'cook') {
      area(px, cx - rx, cy - ry - 2, cx + rx, cy - ry * 0.2, (u, v, x, y) => {
        const fy = cy - ry * 0.6 + Math.sin(u * 0.8 + t * 9) * 1.5;
        return Math.abs(v - fy) < 1 && dith(x, y) < (B - this.heat[1]) * 3 ? (v < fy ? hex('#f8f4ec') : hex('#c8c0b0')) : -1;
      });
    }
    // the stirring spoon in Mori's hand
    if (this.phase === 'cook') {
      const a = this.stirA;
      const sx = cx + Math.cos(a) * 18, sy = cy + Math.sin(a) * 4;
      spoon(px, sx, sy, sx + 10, sy - 34);
      drawHand(px, 'grip', sx + 10, sy - 34, { rot: 3, from: [sx + 70, sy + 80] });
      if (this.stir > 0.3 && Math.random() < 0.5) c.parts.add('drop', sx + (Math.random() - 0.5) * 4, sy, (Math.random() - 0.5) * 30, -30, { c: lit, g: 260, life: 0.3 });
    }
  }

  private drawDial(px: PixelBuffer, cam: number, t: number) {
    const d = this.dialBuf!;
    const cx = this.DX - cam, cy = this.DY;
    // the bracket clipped to the rim
    line(px, cx + 8, cy + 6, cx + 20, cy + 10, (_t, x, y, sd) => (sd < 0 ? hex('#6a625a') : hex('#141210')), Math.max(2, Z));
    blit(px, d, cx - d.w / Z / 2, cy - d.h / Z / 2);
    // the needle (it trembles when it boils)
    const B = this.phase === 'cook' ? this.B : this.B * 0.8;
    const jit = Math.sin(t * 31) * B * 0.05 + Math.sin(t * 17) * 0.01;
    const a = Math.PI * (7 / 6) - (clamp01(B) + jit) * Math.PI * (4 / 3);
    line(px, cx - Math.cos(a) * 2, cy + Math.sin(a) * 2, cx + Math.cos(a) * 9.5, cy - Math.sin(a) * 9.5, (tt, _x, _y, sd) => (tt > 0.7 ? (sd < 0 ? hex('#ff6a4a') : hex('#a01a10')) : (sd < 0 ? hex('#3a2a1a') : hex('#0a0604'))), Math.max(2, Math.round(Z * 0.7)));
    ellipse(px, cx, cy, 1.4, 1.4, (nx, ny, _u, _v, x, y) => rd(ramp('#5a3a10', '#c8962e', '#fff0a8'), 0.6 - (nx + ny) * 0.4, x, y));
    // the glass catches the light
    line(px, cx - 7, cy - 4, cx - 4, cy - 8, hex('#ffffff'), Math.max(1, Math.round(Z * 0.5)));
    const [lo, hi] = this.heat;
    if (this.phase === 'cook' && B >= lo && B <= hi) for (let i = 0; i < 3; i++) if (Math.sin(t * 6 + i * 2) > 0.6) dot(px, cx - 3 + i * 3, cy + 15, hex('#9af07a'), Math.max(1, Math.round(Z / 2)));
  }

  private drawLogsFlying(px: PixelBuffer, cam: number) {
    for (const l of this.logs) {
      const k = clamp01(l.t / 0.5);
      const x = lerp(l.x, this.FX, k) - cam, y = lerp(l.y, this.GY - 14, k) - Math.sin(k * Math.PI) * 26, a = k * 3;
      line(px, x - Math.cos(a) * 7, y - Math.sin(a) * 2, x + Math.cos(a) * 7, y + Math.sin(a) * 2, (_t, xx, yy, sd) => rd(PAL.bark, 0.55 - sd * 0.35, xx, yy), Math.max(3, Z * 2));
      dot(px, x + Math.cos(a) * 7, y + Math.sin(a) * 2, hex('#c8a070'), Math.max(1, Z - 1));
    }
  }

  private drawBowlStation(c: Closeup, px: PixelBuffer, cam: number) {
    const bx = this.BX - cam, by = this.BY;
    if (bx < -40 || bx > c.W + 40) return;
    this.drawBowl(px, bx, by - 8, false);
    if (this.bowlFill > 0 && Math.random() < 0.05 + this.bowlFill * 0.05) c.parts.add('steam', bx + (Math.random() - 0.5) * 30, by - 12, 0, -10, { c: '#d8d0c8', life: 1.4 });
    const s = this.sprig;
    if (s.landed) blit(px, up(SPRIG, Z), s.x - cam - 4, s.y - 8);
  }
  /** the carved bowl (and what's in it) with its rim's centre at (cx, cy), units */
  drawBowl(px: PixelBuffer, cx: number, cy: number, trophy: boolean) {
    const bb = this.bowlBuf;
    blit(px, bb, cx - bb.w / Z / 2, cy - 6);
    const fill = trophy ? 2 : this.bowlFill;
    if (fill <= 0) return;
    const q = this.result?.quality ?? (this.acc + this.scorch * 0.35 > 1.18 ? 'burnt' : this.acc < 0.72 ? 'raw' : 'good');
    let broth = this.pot.length ? this.brothCol() : hex('#a8783c');
    if (q === 'raw') broth = mix(broth, hex('#d8d0b0'), 0.4);
    if (q === 'burnt') broth = mix(broth, hex('#1e1410'), 0.6);
    const dark = mix(broth, hex('#0a0806'), 0.35), lit = mix(broth, hex('#fff4d8'), q === 'perfect' ? 0.55 : 0.3), shine = hex('#fffaf0');
    const rx = 21, ry = 5.5, sy = cy + (2 - fill) * 1.5;
    ellipse(px, cx, sy, rx, ry, (nx, ny, u, v, x, y) => {
      if (ny < -0.55) return dark;
      // the glossy sheen of a good broth; a dull film when it's raw; a scorched skin when burnt
      if (q === 'perfect' && Math.abs(ny + 0.05 + nx * 0.2) < 0.12 && nx > -0.65 && nx < -0.05) return dith(x, y) < 0.6 ? shine : lit;
      if (q === 'burnt' && vnoise(u * 0.8, v * 1.6, 3) > 0.62) return hex('#120c08');
      const k = 0.5 - ny * 0.2 + (vnoise(u * 0.5, v, 4) - 0.5) * (q === 'raw' ? 0.5 : 0.2);
      return rd([dark, broth, lit], k, x, y);
    });
    // the pieces: neat when it went well, lumpy and pale raw, charcoal when burnt
    const ids = this.used.length ? this.used.map(u => u.id) : ['pipi', 'vil_kumara', 'kawakawa'];
    for (let i = 0; i < 9; i++) {
      const id = ids[i % ids.length];
      const ing = CK.INGREDIENTS[id];
      let col = hex(q === 'raw' ? (ing?.raw ?? '#d8c8a0') : (ing?.cooked ?? '#c89048'));
      if (q === 'burnt') col = hash(i, 1, 1) < 0.6 ? hex('#1a1210') : hex('#3a2a20');
      const x = cx + (hash(i, 3, 11) - 0.5) * rx * 1.5, y = sy + (hash(i, 5, 11) - 0.5) * ry * 1.2;
      const r = q === 'raw' ? 1.6 : 1.1;
      ellipse(px, x, y, r * 1.2, r, (nx, ny, _u, _v, fx, fy) => rd([mix(col, hex('#000000'), 0.4), col, mix(col, hex('#ffffff'), 0.35)], 0.55 - (nx + ny) * 0.45, fx, fy));
    }
    if (trophy && this.sprig.landed && this.sprig.off <= 1) blit(px, up(SPRIG, Z), cx + (this.sprig.x - this.BX) - 4, sy - 8);
  }

  private drawBoard(c: Closeup, px: PixelBuffer, cam: number, t: number) {
    // the stock on the mat (pick)
    if (this.phase === 'pick') {
      const spots = this.matSpots();
      const mx = c.ptr.x + cam, my = c.ptr.y;
      spots.forEach((sp, i) => {
        const s = itemSprite(sp.s.id, 20);
        const sw = s.w / Z, sh = s.h / Z;
        const hov = Math.abs(mx - sp.x) < 13 && Math.abs(my - sp.y) < 13 && !c.touch;
        const x = sp.x - cam - sw / 2, y = sp.y - sh / 2 - (hov ? 2 : 0);
        shadowOval(px, sp.x - cam, sp.y + sh / 2, sw / 2, 2, 0.8);
        if (hov) { const o = s.clone(); o.outline(hex('#ffe680')); blit(px, o, x - 1 / Z, y - 1 / Z); }
        blit(px, s, x, y);
        drawWord(px, '' + sp.s.n, sp.x - cam + 7, sp.y + 2, { size: 'small', color: '#fff6dc', align: 'left' });
        if (!c.touch && i < 8) drawWord(px, '' + (i + 1), sp.x - cam - 10, sp.y - 13, { size: 'small', color: '#c8b890', align: 'left' });
      });
      if (!spots.length && !this.items.length) drawWord(px, 'NOTHING TO COOK. FIND FOOD: FISH, SHELLFISH, ROOTS, BERRIES', 110 - cam, this.GY + 10, { size: 'small', color: '#fff6dc', style: 'whisper', t });
    }
    // the prepared things in a row along the back of the board
    for (const p of this.items) {
      if (p.state === 'pot' || p.state === 'held' || p.state === 'fly' || p.state === 'chop') continue;
      this.drawPrep(c, px, p, cam, false);
    }
    // the one being chopped, big
    if (this.phase === 'chop' && this.chopI >= 0) {
      const p = this.items[this.chopI];
      if (p.state === 'chop') {
        const sp = itemSprite(p.id, CHOP);
        const w = sp.w / Z, h = sp.h / Z, left = p.x - w / 2 - cam, top = p.y - h / 2;
        shadowOval(px, p.x - cam, p.y + h / 2 - 1, w / 2 + 2, 3, 0.8);
        drawPieces(px, sp, p.cuts, left, top, p.cuts.length ? 1.5 : 0);
        // the cut marks: dotted, ticked off as they're cut
        if (!this.marked.every(Boolean)) this.marks.forEach((m, i) => {
          if (this.marked[i]) return;
          const x = left + m;
          const col = Math.sin(t * 8) > 0 ? hex('#fff6dc') : hex('#ffe680');
          for (let y = top - 6; y < top + h + 4; y += 2.5) line(px, x, y, x, y + 1.2, col, Math.max(1, Math.round(Z * 0.5)));
          ellipse(px, x, top - 8, 1.6, 1.2, (nx, ny) => (ny > 0.2 && Math.abs(nx) < 1 - ny ? hex('#ffe680') : -1));
        });
      }
    }
    // dragged or flying food
    for (const p of this.items) if (p.state === 'held' || p.state === 'fly') this.drawPrep(c, px, p, cam, true);
  }
  private drawPrep(c: Closeup, px: PixelBuffer, p: Prep, cam: number, lifted: boolean) {
    const sp = itemSprite(p.id, 16);
    const w = sp.w / Z, h = sp.h / Z;
    const x = p.x - cam - w / 2, y = p.y - h / 2;
    if (!lifted) shadowOval(px, p.x - cam, p.y + h / 2, w / 2 + 1, 2, 0.8);
    else shadowOval(px, p.x - cam + 4, p.y + 18, w / 2, 2, 0.5);
    if (p.cuts.length) {
      // chopped: the pieces, the cuts scaled down from the big board view
      const k = w / (itemSprite(p.id, CHOP).w / Z);
      drawPieces(px, sp, p.cuts.map(v => v * k), x - p.cuts.length * 0.5, y, 1);
    } else blit(px, sp, x, y);
    if (this.phase === 'add' && !lifted && !c.touch) {
      const row = this.items.filter(q => q.state === 'row');
      if (row[this.sel] === p) ellipse(px, p.x - cam, y - 4, 2, 1.6, (nx, ny) => (ny > -0.2 && Math.abs(nx) < 1 - ny * 0.5 ? hex('#ffe680') : -1));
    }
  }

  private drawHands(c: Closeup, px: PixelBuffer, cam: number, t: number) {
    const hx = this.hx - cam, hy = this.hy, H = c.H;
    switch (this.phase) {
      case 'pick': if (c.ptr.y > 20) drawHand(px, 'open', hx, hy + 4, { from: [hx + 30, H + 40] }); break;
      case 'chop': {
        const p = this.items[this.chopI];
        if (!p) break;
        const w = itemSprite(p.id, CHOP).w / Z;
        // the left hand steadies it, the right hand holds the knife
        drawHand(px, 'open', p.x - cam - w / 2 - 4, p.y - 2, { left: true, from: [p.x - cam - w / 2 - 40, H + 40] });
        const lift = (1 - this.knifeDown) * 5;
        const kx = this.knifeX - cam, ky = p.y + 12 - lift;
        shadowOval(px, kx + 2, p.y + 8, 3, 2, 0.6);
        knife(px, kx, ky);
        drawHand(px, 'grip', kx, ky, { rot: 3, from: [kx + 60, H + 40] });
        break;
      }
      case 'add':
        if (!this.drag && !c.touch && c.ptr.y > 20) drawHand(px, 'open', hx, hy + 4, { from: [hx + 30, H + 40] });
        if (this.drag) drawHand(px, 'pinch', this.drag.x - cam, this.drag.y - 6, { from: [this.drag.x - cam + 40, H + 40] });
        break;
      case 'season': {
        const jig = this.salting ? Math.sin(t * 40) * 0.6 : 0;
        drawHand(px, 'pinch', hx + jig, hy, { from: [hx + 40, H + 40] });
        break;
      }
      case 'plate': {
        const L = this.ladle;
        const lx = L.x - cam, ly = L.y;
        ladle(px, lx, ly, L.fill, this.brothCol(), L.pour > 0 ? L.pour * 6 : 0);
        drawHand(px, 'grip', lx + 8, ly - 30, { rot: 3, from: [lx + 60, H + 40] });
        break;
      }
      case 'garnish': {
        const s = this.sprig;
        if (s.landed) break;
        const sx = s.x - cam, sy = s.y;
        blit(px, up(SPRIG, Z), sx - 4, sy - 2);
        if (!s.dropped) { drawHand(px, 'pinch', sx, sy - 2, { from: [sx + 50, -40] }); shadowOval(px, sx, this.BY - 6, 4, 1.5, 0.5); }
        break;
      }
    }
  }

  private drawPrompts(c: Closeup, px: PixelBuffer, cam: number) {
    const t = this.pt;
    switch (this.phase) {
      case 'pick': {
        if (this.chosen.length) {
          const pl = this.planNow();
          const known = pl.recipe && CK.knowsRecipe(pl.recipe.id);
          const name = pl.recipe ? (known ? pl.recipe.name : 'Something new...?') : (ITEMS[pl.dish]?.name ?? 'A hotpot');
          drawWord(px, name, this.PX - cam, this.RY - 44, { size: 'body', color: known ? '#ffe680' : '#fff6dc', style: 'happy', t: c.t });
          c.prompt(px, 'COOK!', this.PX - cam, this.RY - 28, 'ENTER', 'shout');
        } else if (this.stock.some(s => s.n > 0)) c.prompt(px, 'PICK FOOD', 110 - cam, this.GY - 4, c.touch ? 'mouse' : '1-8');
        break;
      }
      case 'chop': if (t < 4 && this.chopQ.length < 2) c.prompt(px, 'CHOP ON THE MARKS', 112 - cam, this.GY - 74, 'SPACE'); break;
      case 'add': if (this.items.some(p => p.state === 'row')) c.prompt(px, 'DRAG INTO THE POT', 110 - cam, this.GY - 58, 'SPACE'); break;
      case 'cook': {
        if (t < 6 || this.B > this.heat[1]) c.prompt(px, 'STIR', this.PX - cam, this.RY + 52, c.touch ? 'mouse' : 'S', this.B > this.heat[1] ? 'shout' : 'hint');
        if (t < 6 || this.B < this.heat[0]) c.prompt(px, 'LOG', this.FX - 80 - cam, this.GY - 30, c.touch ? 'mouse' : 'W', this.B < this.heat[0] ? 'shout' : 'hint');
        break;
      }
      case 'season': if (!this.salting && this.tasteT < 0) c.prompt(px, this.seasonTries ? 'A BIT MORE?' : 'HOLD OVER THE POT', this.PX - cam, this.RY - 46, 'SPACE'); break;
      case 'plate': if (this.bowlFill < 0.5 || t < 4) c.prompt(px, this.ladle.fill > 0 ? 'INTO THE BOWL, GENTLY' : 'SCOOP FROM THE POT', (this.PX + this.BX) / 2 - cam, this.RY - 34, 'SPACE'); break;
      case 'garnish': if (!this.sprig.dropped) c.prompt(px, 'DROP IT IN THE MIDDLE', this.BX - cam, this.BY - 66, 'SPACE'); break;
    }
  }
}

// ---------------------------------------------------------------- small timers (scene time)
function setTimeoutish(s: CookSet, secs: number, fn: () => void) { setTimeout(() => { if (s.phase !== 'end') fn(); }, secs * 1000); }

// ---------------------------------------------------------------- painted props (units in, fine pixels out)
/** a green-wood pole: round, lit on the fire side, bark stripes and the odd knot */
function leg(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r: number) {
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  area(b, Math.min(x0, x1) - r - 1, Math.min(y0, y1) - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + 1, (u, v, x, y) => {
    const rx = u - x0, ry = v - y0, t = rx * ux + ry * uy;
    if (t < 0 || t > L) return -1;
    const d = (rx * -uy + ry * ux) / r;
    if (Math.abs(d) > 1) return -1;
    if (Math.abs(d) > 1 - 0.8 / r / Z * 2) return PAL.bark[0];
    let k = 0.56 - d * 0.32 - d * d * 0.12 + (vnoise(t * 0.6, d * 2, 5) - 0.5) * 0.2;
    if (Math.sin(t * 1.7 + d) > 0.85) k -= 0.15;
    const knot = (t % 23) - 11;
    if (Math.abs(knot) < 1.2 && Math.abs(d) < 0.6) k = 0.12 + Math.abs(knot) * 0.1;
    return rd(PAL.bark, k, x, y);
  });
}
function paintTent(b: PixelBuffer, x: number, y: number, w: number, h: number, fx: number) {
  const ax = x + w * 0.42;
  const CAN = PAL.canvas;
  area(b, x - 4, y - 6, x + w + 4, y + h, (u, v, X, Y) => {
    const k = (v - y) / h;
    if (k < 0) return Math.abs(u - ax) < 0.6 && v > y - 6 ? hex('#3a2a1a') : -1;
    const l = ax - k * w * 0.42 - Math.sin(k * 3) * 2, r = ax + k * w * 0.58 + Math.sin(k * 2.5) * 2;
    if (u < l || u > r) return -1;
    if (u < l + 0.6 || u > r - 0.6) return CAN[0];
    const lit = clamp01(1 - Math.abs(u - fx) / 260) * 0.6 + 0.12;
    const sag = Math.sin((u - l) / Math.max(1, r - l) * Math.PI) * 0.12;
    let t = lit - sag + (u < ax ? 0.08 : -0.05) + (vnoise(u * 0.7, v * 0.2, 9) - 0.5) * 0.08;
    // seams, the open flap
    if (Math.abs(((u - ax) % 19 + 19) % 19) < 0.4 && Math.abs(u - ax) > 1) t -= 0.12;
    if (u > ax - k * 14 && u < ax + k * 8 && v > y + h * 0.35) return dith(X, Y) < 0.2 ? hex('#2a1c10') : hex('#0e0806');
    return rd(CAN, t, X, Y);
  });
  // a guy rope out to its peg
  line(b, ax + 6, y, ax + 50, y + 62, (t, X, Y) => (dith(X, Y) < 0.6 ? hex('#8a7a5a') : hex('#5a4a34')), Math.max(1, Math.round(Z * 0.6)));
}
function paintBoard(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  // a weathered driftwood plank seen from above: wavy edges, grain, two knots, old knife marks
  const top = (i: number) => Math.sin(i * 0.05) * 1.5 + Math.sin(i * 0.17) * 0.8 + (i < 6 ? (6 - i) * 0.6 : 0) + (i > w - 8 ? (i - w + 8) * 0.7 : 0);
  const bot = (i: number) => h - (Math.sin(i * 0.07 + 1) * 1.2 + (i < 4 ? 4 - i : 0) + (i > w - 5 ? i - w + 5 : 0));
  shadowOval(b, x + w / 2, y + h + 7, w / 2, 3, 0.7);
  area(b, x, y - 2, x + w, y + h + 7, (u, v, X, Y) => {
    const i = u - x, j = v - y;
    if (i < 0 || i > w) return -1;
    const tp = top(i), bt = bot(i);
    if (j < tp - 0.7 || j > bt + 6) return -1;
    if (j < tp) return DRIFT[0];
    if (j >= bt) {
      // the front face of the plank, darker, with end grain
      if (j > bt + 5.3) return DRIFT[0];
      return rd(DRIFT, 0.26 - (j - bt) * 0.03 + (vnoise(i * 0.4, j * 2, 2) - 0.5) * 0.12, X, Y);
    }
    const grain = Math.sin(j * 1.1 + Math.sin(i * 0.045 + j * 0.2) * 3 + vnoise(i * 0.05, j * 0.3, 1) * 4);
    let k = 0.6 + (i / w) * 0.15 - (j / h) * 0.1 + (vnoise(i * 0.8, j * 0.8, 3) - 0.5) * 0.12;
    if (grain > 0.84) k -= 0.24; else if (grain > 0.7) k -= 0.08; else if (grain < -0.92) k += 0.08;
    for (const [kx, ky] of [[w * 0.28, h * 0.55], [w * 0.74, h * 0.3]]) {
      const d = Math.hypot((i - kx) / 3.2, j - ky);
      if (d < 1.1) k = 0.12; else if (d < 2.6 && Math.round(d * 2.5) % 2) k -= 0.2;
    }
    if (j < tp + 0.7) k = 0.88;
    // old knife scores, short and pale
    const sc = (i * 1.3 + j * 2.6) % 31;
    if (sc < 0.5 && hash(Math.floor(i / 4), Math.floor(j / 3), 8) < 0.35) k += 0.15;
    // cracks at the ends
    if ((i < 11 && Math.abs(j - 12 - Math.sin(i) * 0.8) < 0.35) || (i > w - 12 && Math.abs(j - 18 + (w - i) * 0.3) < 0.35)) k = 0.05;
    return rd(DRIFT, k, X, Y);
  });
}
function paintMat(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  // woven harakeke: strips over and under, each with its sheen and edges; frayed ends
  area(b, x - 1, y - 1, x + w + 1, y + h + 1, (u, v, X, Y) => {
    const i = u - x, j = v - y;
    if (j < 0 || j > h) return Math.abs(j) < 0.5 || Math.abs(j - h) < 0.5 ? FLAX[0] : -1;
    if (i < 0 || i > w) return -1;
    const ci = Math.floor(i / 5), cj = Math.floor(j / 4);
    const over = (ci + cj) % 2 === 0;
    const fu = over ? (i % 5) / 5 : (j % 4) / 4;
    let k = (over ? 0.66 : 0.44) - Math.abs(fu - 0.4) * 0.6 + (vnoise(i * 0.6, j * 0.6, ci + cj) - 0.5) * 0.12;
    if ((over && i % 5 > 4.6) || (!over && j % 4 > 3.6)) k = 0.1;
    // the fibres along each strip
    if ((over ? Math.sin(j * 6 + ci) : Math.sin(i * 6 + cj)) > 0.92) k -= 0.1;
    k += (hash(ci, cj, 4) - 0.5) * 0.16 - (j / h) * 0.12;
    if (i < 2 || i > w - 2) { if (hash(X, Y >> 1, 2) < 0.5) return -1; k -= 0.1; }
    return rd(FLAX, k, X, Y);
  });
}
function paintShell(b: PixelBuffer, x: number, y: number) {
  // a paua shell (an ear-shaped outline placed point by point), its rainbow inside full of salt
  const pts: [number, number][] = [[0, 4], [3, 1], [9, 0], [16, 0], [21, 2], [24, 5], [23, 9], [18, 12], [10, 13], [4, 11], [1, 8]].map(([a, c]) => [x + a, y + c]);
  poly(b, pts, (u, v, X, Y) => {
    const lu = u - x, lv = v - y;
    const swirl = Math.sin(lu * 0.55 + lv * 0.35 + Math.sin(lu * 0.2) * 2 + vnoise(lu * 0.4, lv * 0.4, 3) * 2);
    return rd(PAUA, (swirl + 1) / 2, X, Y);
  });
  for (let i = 0; i < pts.length; i++) { const [a, c] = pts[i], [d, e] = pts[(i + 1) % pts.length]; line(b, a, c, d, e, (t, X, Y, sd) => (sd < 0 ? hex('#7a6050') : hex('#2a1a12')), Math.max(2, Z)); }
  // the salt heap: crystals that catch the firelight
  area(b, x + 5, y + 1, x + 21, y + 9, (u, v, X, Y) => {
    const lu = u - x - 13, lv = v - y - 8;
    if (lv > 0 || Math.abs(lu) > 7 + lv * 0.9 || hash(X, Y, 6) > 0.9) return -1;
    return hash(X, Y, 7) < 0.25 ? hex('#c8c8c0') : hash(X, Y, 8) < 0.1 ? hex('#ffe8c0') : rd(ramp('#b8bcc0', '#e0e0dc', '#fafaf6'), 0.7 + lv * 0.08 - lu * 0.03, X, Y);
  });
}
function paintPot(): PixelBuffer {
  // the cast-iron pot: a round belly, the thick lip, the casting seam, pits and soot, two lugs
  const W = 84, H = 60, cx = 42, rimY = 12;
  const b = new PixelBuffer(W * Z, H * Z);
  const prof = (y: number) => { const t = y / 46; return 34 + Math.sin(t * Math.PI * 0.85) * 6 - t * t * 10; };
  const GLOWR = ramp('#3a1a10', '#6a2a14', '#a84a1e', '#d8742a');
  area(b, 0, rimY, W, rimY + 47, (u, vv, x, y) => {
    const v = vv - rimY, hw = prof(v), nx = (u - cx) / hw;
    if (Math.abs(nx) > 1) return -1;
    const bot = 46 - (1 - Math.sqrt(Math.max(0, 1 - nx * nx))) * 8;
    if (v > bot) return -1;
    if (Math.abs(nx) > 1 - 0.8 / hw || v > bot - 0.5) return IRON[0];
    // the fire's glow on the underside
    if (v > bot - 3.5) return rd(GLOWR, 0.3 + vnoise(u * 0.8, v, 2) * 0.6 - (v - bot + 3.5) * 0.05, x, y);
    let k = 0.42 - nx * 0.32 - nx * nx * 0.08 + (v < 6 ? 0.1 : 0) - (v / 46) * 0.08;
    // a warm rim light on the fire side, cool sky on the top
    if (nx > 0.82) k += 0.15;
    k += (vnoise(u * 1.2, v * 1.2, 4) - 0.5) * 0.12;
    if (hash(x, y, 4) < 0.025) k -= 0.2;
    if (vnoise(u * 0.25, v * 0.3, 9) > 0.66) k -= 0.12;
    if (Math.abs(v - 22) < 0.5) k -= 0.14; else if (Math.abs(v - 23) < 0.4 && nx < 0) k += 0.16;
    return rd(IRON, k, x, y);
  });
  // the mouth: the inside back wall, the lip all round
  ellipse(b, cx, rimY, 36, 10, (nx, ny, u, v, x, y) => {
    const inner = ((u - cx) / 33) ** 2 + ((v - rimY) / 8) ** 2 <= 1;
    if (inner) return ny < 0 ? rd(IRON, 0.12 + (ny + 1) * 0.16, x, y) : IRON[1];
    const e = nx * nx + ny * ny;
    if (e > 0.97) return IRON[0];
    return rd(IRON, ny < 0 ? 0.36 - nx * 0.2 : 0.66 - nx * 0.35 + (ny > 0.6 ? 0.1 : 0), x, y);
  });
  line(b, cx - 34, rimY + 3, cx + 10, rimY + 9.6, (t, x, y) => (dith(x, y) < 0.8 ? IRON[6] : -1), Math.max(1, Math.round(Z * 0.6)));
  // the lugs and their rivets
  for (const s of [-1, 1]) {
    area(b, cx + s * 36.5 - (s < 0 ? 5 : 0), rimY + 3, cx + s * 36.5 + (s > 0 ? 5 : 0), rimY + 9, (u, v, x, y) => rd(IRON, 0.32 + (s < 0 ? 0.2 : 0) - (v - rimY - 3) * 0.04 + (vnoise(u, v, 7) - 0.5) * 0.1, x, y));
    dot(b, cx + s * 38.5, rimY + 5.5, IRON[6], Math.max(1, Math.round(Z * 0.5)));
  }
  return b;
}
function paintDial(band: [number, number]): PixelBuffer {
  // Joshu's old boiler gauge: a brass bezel, a cream face painted blue / green / red, ticks, a maker's line
  const R = 13, W = R * 2 + 3, c = R + 1.5;
  const b = new PixelBuffer(W * Z, W * Z);
  const FACE = ramp('#b8a882', '#d8ccaa', '#efe6cc', '#fbf6e4');
  area(b, 0, 0, W, W, (u, v, x, y) => {
    const d = Math.hypot(u - c, v - c);
    if (d > R) return -1;
    if (d > R - 0.5) return BRASS[0];
    if (d > R - 2.4) { const a = Math.atan2(v - c, u - c); return rd(BRASS, 0.55 - Math.sin(a + 0.8) * 0.42 + (d > R - 1.2 ? 0.1 : -0.1), x, y); }
    if (d > R - 2.8) return BRASS[1];
    let col = rd(FACE, 0.8 - (v / W) * 0.35 + (vnoise(u, v, 3) - 0.5) * 0.1, x, y);
    const ang = Math.atan2(c - v, u - c);
    let k = (Math.PI * (7 / 6) - ang) / (Math.PI * (4 / 3));
    if (k < -0.2) k += Math.PI * 2 / (Math.PI * (4 / 3));
    if (d > R - 6.2 && d < R - 3.4 && k >= 0 && k <= 1) col = k < band[0] ? rd(ramp('#24488a', '#3a6ab0', '#5a8ad0'), 0.5 - (d - R + 6) * 0.1, x, y) : k <= band[1] ? rd(ramp('#2a6a24', '#4a9a3a', '#7ac85a'), 0.5, x, y) : rd(ramp('#8a1a10', '#c83a24', '#ea6a40'), 0.5, x, y);
    return col;
  });
  // ticks round the arc
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (7 / 6) - i / 16 * Math.PI * (4 / 3), r0 = i % 4 === 0 ? R - 8.2 : R - 7.2;
    line(b, c + Math.cos(a) * r0, c - Math.sin(a) * r0, c + Math.cos(a) * (R - 6.4), c - Math.sin(a) * (R - 6.4), hex('#2a1a0c'), i % 4 === 0 ? Math.max(2, Math.round(Z * 0.6)) : 1);
  }
  // the maker's tiny engraved line under the hub
  line(b, c - 3, c + 6, c + 3, c + 6, hex('#8a7a5a'), 1);
  return b;
}
function paintBowl(): PixelBuffer {
  // a carved rimu bowl: adze facets round the belly, a pale lip, a dark inside
  const W = 54, H = 22, cx = 27, rimY = 6;
  const b = new PixelBuffer(W * Z, H * Z);
  area(b, 0, 0, W, H, (u, v, x, y) => {
    const nx = (u - cx) / 26, ny = (v - rimY) / 6.5;
    const inRim = nx * nx + ny * ny <= 1;
    const outY = rimY + Math.sqrt(Math.max(0, 1 - nx * nx)) * 15;
    if (!inRim && (v < rimY || v > outY || Math.abs(nx) > 1)) return -1;
    if (inRim) {
      const inner = ((u - cx) / 23) ** 2 + ((v - rimY) / 5) ** 2 <= 1;
      if (inner) return rd(RIMU, 0.1 + (ny + 1) * 0.14 + (vnoise(u * 0.5, v, 2) - 0.5) * 0.08, x, y);
      return nx * nx + ny * ny > 0.96 ? RIMU[1] : rd(RIMU, 0.84 - nx * 0.22, x, y);
    }
    // adze facets: bands of light and dark round the belly, the grain curving with it
    const facet = Math.floor((nx + 1) * 7);
    let k = 0.5 - nx * 0.3 + (facet % 2 ? 0.08 : -0.04) - (v - rimY) / 15 * 0.2;
    if (Math.sin(v * 1.4 + nx * 8 + vnoise(u * 0.3, v * 0.3, 5) * 2) > 0.86) k -= 0.14;
    if (v >= outY - 0.6 || Math.abs(nx) > 0.985) k = 0.04;
    return rd(RIMU, k, x, y);
  });
  return b;
}
/** chopped food: the sprite in pieces at the cuts (units in sprite space), spread apart */
function drawPieces(px: PixelBuffer, sp: PixelBuffer, cuts: number[], x: number, y: number, gap: number) {
  const edges = [0, ...cuts.map(v => Math.round(v * Z)), sp.w];
  const X = Math.round(x * Z), Y = Math.round(y * Z), G = gap * Z;
  for (let s = 0; s < edges.length - 1; s++) {
    const a = edges[s], e = edges[s + 1];
    const ox = X + Math.round(s * G), oy = Y + (s % 2 ? Math.round(Math.min(Z, G / 2)) : 0);
    for (let v = 0; v < sp.h; v++) for (let u = a; u < e; u++) {
      let c = sp.data[v * sp.w + u];
      if (c >>> 24 < 128) continue;
      // the cut faces show the inside, paler
      if (s > 0 && u - a < Math.max(1, Z / 2)) c = mix(c, hex('#fff4d8'), 0.4);
      else if (s < edges.length - 2 && e - u <= 1) c = mix(c, hex('#000000'), 0.3);
      px.set(ox + u, oy + v, c);
    }
  }
}
function knife(px: PixelBuffer, x: number, y: number) {
  // seen from above: a long steel blade with a bright bevel, a brass bolster, a wooden handle, rivets
  const STEEL = ramp('#2a3038', '#4a5460', '#7a8694', '#aab6c0', '#dce6ec', '#ffffff');
  area(px, x - 3, y - 47, x + 3, y - 9, (u, v, X, Y) => {
    const j = (y - 10) - v;
    const w = j > 30 ? Math.max(0.4, 2.6 - (j - 30) * 0.42) : 2.6;
    const i = u - x;
    if (i < -w || i > w) return -1;
    if (i < -w + 0.4) return STEEL[0];
    // the flat, then the bevel down to the edge (right side) that catches the light
    const bev = i > w * 0.35;
    return rd(STEEL, bev ? 0.85 + (i - w * 0.35) * 0.1 : 0.42 + i * 0.06 + (vnoise(u * 2, v * 0.3, 4) - 0.5) * 0.1, X, Y);
  });
  area(px, x - 3, y - 10, x + 3.2, y - 8.4, (u, v, X, Y) => rd(BRASS, 0.75 - (v - y + 10) * 0.25, X, Y));
  area(px, x - 2.4, y - 8.4, x + 2.4, y + 6, (u, v, X, Y) => {
    const i = (u - x) / 2.4;
    if (Math.abs(i) > 0.92) return hex('#2a140a');
    return rd(RIMU, 0.62 - i * 0.35 + (Math.sin(v * 2.2 + i * 3) > 0.8 ? -0.12 : 0), X, Y);
  });
  dot(px, x, y - 5, BRASS[4], Math.max(1, Math.round(Z * 0.5)));
  dot(px, x, y + 2.5, BRASS[4], Math.max(1, Math.round(Z * 0.5)));
}
function spoon(px: PixelBuffer, tx: number, ty: number, hx: number, hy: number) {
  // a carved wooden spoon handle from the broth up to the hand
  line(px, tx, ty, hx, hy, (_t, X, Y, sd) => rd(RIMU, 0.6 - sd * 0.4, X, Y), Math.max(3, Math.round(Z * 1.4)));
}
function ladle(px: PixelBuffer, x: number, y: number, fill: number, broth: C, tip: number) {
  // a tin ladle: the handle up to the hand, the cup tilting as it pours
  line(px, x, y - 2, x + 8, y - 30, (_t, X, Y, sd) => (sd < -0.3 ? hex('#c8d0d8') : sd > 0.3 ? hex('#3a4248') : hex('#8a949c')), Math.max(2, Math.round(Z * 0.9)));
  ellipse(px, x, y - tip * 0.3, 6.5, 3.5 + tip * 0.15, (nx, ny, _u, _v, X, Y) => {
    const e = nx * nx + ny * ny;
    if (e > 0.88) return ny < 0 ? hex('#e0e8ee') : hex('#4a545c');
    if (e > 0.6) return rd(ramp('#3a4248', '#7a848c', '#c8d0d8'), 0.5 - ny * 0.4, X, Y);
    if (fill > 0 && ny > 0.4 - fill * 1.2) return ny < 0 ? mix(broth, hex('#ffffff'), 0.25) : broth;
    return hex('#2a3036');
  });
}

// ---------------------------------------------------------------- entry
/** the cooking close-up; resolves with the dish (null when Mori stops before it's done) */
export function runCookCloseup(o: CookOpts & { debug?: boolean }): Promise<CookOutcome> {
  return new Promise(res => {
    let sent = false;
    const done = (r: CookOutcome) => { if (!sent) { sent = true; res(r); } };
    const set = new CookSet(o, done);
    void runCloseup(set, {}).then(r => { if (r.aborted) done({ result: null, ids: [] }); });
  });
}
