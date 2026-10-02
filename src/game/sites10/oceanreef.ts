// V10 Glass Reef, the snorkel dive from the anchored Kitten: clear blue water over pale sand,
// three bommies crusted with coral (a Lantern Cod in the shade of the big one's overhang), staghorn
// and table coral, brain domes, sea fans and anemones, light shafts from the surface and the
// Kitten's hull overhead. The reef fish are the V9 species (art from art/v9/fish), swimming free:
// a school of Glass Maomao, Mirror Dory, Spinnaker Kahawai, Snout Bass and Sixfinger Gurnard on the
// sand, a Bubble Puffer, a Ribbon Eelfish and the Hammerbrow Snapper. They speak the camera's
// subject interface, so they can be photographed. Broken coral twigs on the rubble to collect.
// Swim up to the Kitten to climb back aboard (the trip carries on from its stop).

import type { Env, Frame, Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { FieldScene, FieldSite } from '../scenes/field';
import type { Animal } from '../wild/animal';
import type { Drawable } from '../../world/stage';
import { Custom, Prop } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import * as R from '../../art/v10/reef10';
import * as K from '../../art/v10/boat10';
import { fishSide } from '../../art/v9/fish';
import { sprite, shafts } from '../sites2/common';
import { SPECIES_BY_ID } from '../species';
import { ITEMS } from '../items';
import { add, fits } from '../inventory';
import { itemIconURL } from '../../art/itemicons';
import { boatSave } from '../v10/boat';
import { dayNumber } from '../v10/day';
import { discover, revealMap } from '../v10/regions';
import type { BubbleLine } from '../../ui/bubbles';

const { RF } = R;
const KITTEN_X = 150;

type V2 = [number, number];
interface Box { x0: number; y0: number; x1: number; y1: number }
const fishFrames = new Map<string, { f: Frame; pts: V2[]; w: number; h: number }[]>();
let fishOwner: unknown = null;
function framesFor(id: string, len: number) {
  if (fishOwner !== game.r) { fishFrames.clear(); fishOwner = game.r; }
  const key = id + ':' + len;
  let fr = fishFrames.get(key);
  if (fr) return fr;
  fr = [-0.28, 0, 0.28, 0].map(sw => {
    const b = fishSide(id, len, { swing: sw });
    const pts: V2[] = [];
    const st = Math.max(2, Math.floor(Math.min(b.w, b.h) / 4));
    for (let y = 1; y < b.h; y += st) for (let x = 1; x < b.w; x += st) if (b.data[y * b.w + x] >>> 24 > 128) pts.push([x - b.w / 2, y - b.h / 2]);
    if (!pts.length) pts.push([0, 0]);
    return { f: bigFrame(game.r, b, Math.round(b.w / 2), Math.round(b.h / 2)), pts, w: b.w, h: b.h };
  });
  fishFrames.set(key, fr);
  return fr;
}

/** one reef fish: cruises its patch of reef, turns at the ends, darts off if you rush it */
class ReefFish implements Drawable {
  z = 30; p = 1; py = 1;
  x: number; y: number; vx = 0; vy = 0; facing: 1 | -1 = 1;
  dead = false; gone = false; hidden = 0; noticed = false; juvenile = false;
  speed = 0; act = 'swim'; anger = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  behavior: string | null = null;
  body: { bounds: (a: ReefFish) => Box; points: (a: ReefFish) => V2[]; head: (a: ReefFish) => V2 };
  private t = rand.next() * 10;
  private fear = 0;
  constructor(readonly species: string, readonly len: number, readonly home: [number, number], readonly band: [number, number], readonly cruise: number, readonly s: ReefDiveScene, readonly mode: 'swim' | 'bottom' | 'hover' = 'swim') {
    this.x = rand.range(home[0], home[1]);
    this.y = rand.range(band[0], band[1]);
    this.facing = rand.chance(0.5) ? 1 : -1;
    this.body = { bounds: a => a.box(), points: a => a.pts(), head: a => [a.x + a.facing * a.len * 0.45, a.y] };
  }
  private fr() { const fs = framesFor(this.species, this.len); return fs[Math.floor(this.t * (3 + Math.abs(this.vx) * 0.12)) % fs.length]; }
  box(): Box { const f = this.fr(); return { x0: this.x - f.w / 2, x1: this.x + f.w / 2, y0: this.y - f.h / 2, y1: this.y + f.h / 2 }; }
  pts(): V2[] { const f = this.fr(); return f.pts.map(([x, y]) => [this.x + x * this.facing, this.y + y] as V2); }
  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.box(), pts: this.pts(), speed: this.speed, facing: this.facing, noticed: this.noticed, juvenile: false, p: 1, hidden: this.hidden };
  }
  update(dt: number) {
    this.t += dt;
    const p = this.s.player;
    const dx = this.x - p.x, dy = this.y - (p.y - 10);
    const d = Math.hypot(dx, dy);
    const rush = Math.hypot(p.vx, p.vy) > 55;
    if (d < (rush ? 70 : 34)) { this.fear = 1.6; this.noticed = true; }
    this.fear = Math.max(0, this.fear - dt);
    let want = this.cruise * this.facing;
    if (this.fear > 0) want = Math.sign(dx || 1) * this.cruise * 3.2;
    if (this.mode === 'hover') want *= 0.25 + 0.75 * Math.max(0, Math.sin(this.t * 0.4));
    if (this.mode === 'bottom') want *= Math.sin(this.t * 0.7) > 0 ? 1 : 0.1;
    if (this.fear <= 0 && ((this.x < this.home[0] && this.facing < 0) || (this.x > this.home[1] && this.facing > 0))) this.facing = this.facing > 0 ? -1 : 1;
    this.vx += (want - this.vx) * Math.min(1, dt * (this.fear > 0 ? 5 : 1.4));
    if (Math.abs(this.vx) > 2) this.facing = this.vx > 0 ? 1 : -1;
    const ty = this.mode === 'bottom' ? R.groundReef(this.x) - this.len * 0.18 - 2 : clamp(this.y + Math.sin(this.t * 0.5) * 6, this.band[0], this.band[1]);
    this.vy += ((ty - this.y) * 0.8 - this.vy) * Math.min(1, dt * 2);
    if (this.fear > 0) this.vy += Math.sign(dy || -1) * 10 * dt;
    this.x += this.vx * dt;
    this.y = Math.min(this.y + this.vy * dt, R.groundReef(this.x) - this.len * 0.18 - 1);
    this.speed = Math.hypot(this.vx, this.vy);
    this.behavior = this.fear > 0 ? null : this.mode === 'bottom' ? null : null;
  }
  draw(r: Renderer) {
    const f = this.fr();
    r.draw(f.f, this.x, this.y, this.facing, 1, Math.atan2(this.vy, Math.abs(this.vx) + 20) * 0.4 * this.facing);
  }
}

export class ReefDiveScene extends FieldScene {
  fish: ReefFish[] = [];
  private bubT = 0;
  private reach = 0;
  private hull: Frame | null = null;

  constructor() {
    let me: ReefDiveScene | null = null;
    const site: FieldSite = {
      id: 'Glass Reef' as never, name: 'Glass Reef', width: RF.W, camY: 210, followY: true, minY: RF.SURF - 80, maxY: RF.BOT,
      spawnX: KITTEN_X + 30, exitX: 0, waterY: RF.SURF, underwater: true, ambience: 'underwater', music: 'wonder', ground: 'sand',
      noGuide: true, noExit: true, spawns: [], build: () => me!.buildReef(),
    };
    super(site, 'day');
    me = this;
    this.allowPack = true;
  }

  hudOpts() {
    return {
      place: 'Glass Reef', sub: 'Snorkelling under the Kitten',
      keys: '<span class="key">WASD</span> swim · <span class="key">Q</span> camera · <span class="key">E</span> interact · <span class="key">Tab</span> pack',
    };
  }

  buildReef() {
    const st = this.st, r = game.r;
    st.minX = 0; st.maxX = RF.W; st.minY = RF.SURF - 80; st.maxY = RF.BOT;
    st.envHook = env => this.env(env);
    // ---- depth, far reef silhouettes
    const bgL = st.addLayer('deepbg', 0.05, 0, 0, 0);
    const span = layerSpan(st, 0.05, 200);
    const bg = R.paintDeepBg(Math.min(1024, span.w), 520);
    const bgF = bigFrame(r, bg);
    for (let x = 0; x < span.w; x += bg.w) bgL.add(new Prop({ ...bgF, ax: 0, ay: 0 }, span.x0 + x, RF.SURF - 100));
    for (const [p, seed, y] of [[0.3, 3, 250], [0.55, 7, 280]] as const) {
      const l = st.addLayer('farreef' + seed, p, 0.35, 0.3, 0);
      const sp = layerSpan(st, p, 100);
      const fr = bigFrame(r, R.paintFarReef(Math.min(1400, sp.w), 120, seed));
      for (let x = 0; x < sp.w; x += fr.w) l.add(new Prop({ ...fr, ax: 0, ay: 0 }, sp.x0 + x, y - 60));
    }
    const main = st.addLayer('main', 1, 0, 1, 0);
    this.main = main;
    // ---- the floor and the bommies
    for (let x0 = 0; x0 < RF.W; x0 += 950) {
      const ch = R.paintReefFloor(x0, Math.min(950, RF.W - x0));
      const f = bigFrame(r, ch.buf);
      main.add(new Custom(-10, rr => { if (x0 + ch.buf.w >= rr.visibleX0(4) && x0 <= rr.visibleX1(4)) rr.draw(f, x0, ch.y0); }));
    }
    const pts: [number, number][] = [];
    for (let x = 0; x <= RF.W; x += 6) pts.push([x, R.groundReef(x)]);
    st.terrain.addGround(pts, 'ground');
    st.terrain.water.push([-100, RF.W + 100, RF.SURF, RF.BOT + 40]);
    // the dark overhang under the big bommie (the Lantern Cod hides in its shade)
    const [bx, bw] = R.BOMMIES[1];
    main.add(new Custom(-9, rr => { rr.beginShadows(); rr.draw(A.shadow, bx + bw * 0.55, RF.FLOOR - 4, 2.2, 1.1, 0, packColor(0, 0, 0, 0.5)); rr.endShadows(); }));
    // ---- corals
    const kinds: R.CoralKind[] = ['staghorn', 'brain', 'fan', 'anemone', 'table', 'urchin'];
    let seed = 1;
    for (let x = 40; x < RF.W - 20; x += rand.range(22, 46)) {
      const kind = rand.pick(kinds);
      const c = sprite(`coral:${kind}:${seed % 3}`, () => R.coralSprite(kind, seed % 3 + 1));
      seed++;
      if (!c) continue;
      const sway = kind === 'fan' || kind === 'anemone' ? 0.8 : 0;
      main.add(new Prop(c.f, x, R.groundReef(x) + 3, rand.range(-4, 6), { sway, flip: rand.chance(0.5) }));
    }
    // ---- light from the surface, the surface itself, the Kitten's hull overhead
    shafts(this, main, [{ x: 260, w: 70, a: 0.1 }, { x: 760, w: 90, a: 0.14 }, { x: 1250, w: 80, a: 0.12 }, { x: 1700, w: 70, a: 0.1 }], [0.7, 0.92, 1], RF.SURF, 360, 0.9);
    const k = K.kittenHull(6, 'all');
    this.hull = bigFrame(r, k.buf, k.ax, k.ay);
    main.add(new Custom(150, (rr, s) => {
      const x0 = Math.floor(rr.visibleX0(8) / 6) * 6, x1 = rr.visibleX1(8);
      for (let x = x0; x < x1; x += 6) {
        const y = RF.SURF + Math.sin(x * 0.05 + s.time * 1.4) * 1.5;
        rr.rect(x, y - 2, 6, 2, packColor(0.75, 0.95, 1, 0.75));
        rr.rect(x, y, 6, 1, packColor(0.95, 1, 1, 0.6));
      }
      const hf = this.hull!;
      const row = Math.round(hf.ay + K.KWL);
      const bob = Math.sin(s.time * 0.9) * 1.2;
      rr.drawSub(hf, 0, row, hf.w, hf.h - row, KITTEN_X - hf.ax, RF.SURF - K.KWL - hf.ay + row + bob, 1, 1, packColor(0.12, 0.22, 0.3, 0.92));
      rr.fxDraw(A.glow, KITTEN_X + K.KL / 2, RF.SURF + 6, 3, 0.6, 0, packColor(0.8, 0.95, 1, 1), 0.25);
    }));
    this.interact.push({ x: KITTEN_X + K.KL / 2, y: RF.SURF + 26, w: 50, h: 40, label: 'Climb back aboard the Kitten', standX: KITTEN_X + K.KL / 2, action: () => this.surface() });
    // ---- coral twigs on the rubble
    for (const [key, x] of [['c1', 330], ['c2', 1180], ['c3', 1690]] as const) this.coralSpot(key, x);
    // ---- the fish
    const F = (sp: string, len: number, n: number, home: [number, number], band: [number, number], cruise: number, mode: 'swim' | 'bottom' | 'hover' = 'swim') => {
      for (let i = 0; i < n; i++) {
        const f = new ReefFish(sp, len, home, band, cruise * rand.range(0.85, 1.15), this, mode);
        this.fish.push(f);
        main.add(f);
        this.animals.push(f as unknown as Animal);
      }
    };
    F('glassmaomao', 16, 12, [200, 900], [150, 220], 22);
    F('mirrordory', 24, 3, [700, 1400], [200, 250], 14, 'hover');
    F('spinnaker', 36, 4, [900, 1800], [120, 190], 30);
    F('snoutbass', 32, 2, [500, 1300], [270, 300], 12, 'bottom');
    F('sixfinger', 26, 2, [1100, 1800], [280, 300], 8, 'bottom');
    F('bubblepuffer', 18, 2, [300, 1000], [210, 260], 8, 'hover');
    F('ribboneel', 56, 1, [1300, 1800], [250, 285], 10);
    F('lanterncod', 30, 1, [bx + 10, bx + bw], [RF.FLOOR - 26, RF.FLOOR - 12], 6, 'hover');
    F('hammersnapper', 44, 2, [600, 1700], [170, 240], 18);
  }

  private spotFree(id: string) { const d = boatSave().salvage[id]; return d === undefined || dayNumber() > d; }
  private coralSpot(key: string, x: number) {
    const id = 'glassreef:' + key, y = R.groundReef(x);
    const c = sprite('coral:rubble', () => R.coralSprite('rubble', 1));
    if (c) this.main.add(new Custom(8, rr => { if (this.spotFree(id)) rr.draw(c.f, x, y + 1); }));
    this.interact.push({
      x, y: y - 8, w: 16, h: 24, label: 'Pick up the broken coral twig', standX: x,
      enabled: () => this.spotFree(id),
      action: async () => {
        if (!fits('v10_coral', 1)) { audio.play('wrong', { vol: 0.45 }); this.bark('mori', 'No room in the pack.', { expr: 'worried' }); return; }
        const got = add('v10_coral', 1);
        if (got <= 0) return;
        boatSave().salvage[id] = Math.max(1, dayNumber());
        const name = ITEMS['v10_coral']?.name ?? 'Coral fragment';
        const [cx, cy] = this.css(x, y);
        this.hud?.flyItem('v10_coral', got, name, cx, cy);
        game.ui.toast(`+${got} <img src="${itemIconURL('v10_coral', 2)}" style="width:1.5em;height:1.5em;vertical-align:-0.35em;image-rendering:pixelated"> <b>${name}</b>`, 'FOUND', 'teal', 1800);
        audio.play('collectPop', { vol: 0.55 });
        if (!boatSave().seen['said:reefcoral']) { boatSave().seen['said:reefcoral'] = true; this.bark('mori', 'Already broken off by the waves. I’ll only take the loose bits.', { expr: 'happy' }); }
        game.persist();
        this.hud?.refresh(true);
      },
    });
  }

  private async surface() {
    if (this.cutscene) return;
    this.cutscene = true;
    audio.play('splash', { vol: 0.6 });
    await game.fadeTo(1, 0.8);
    const { goBoatTrip } = await import('./ocean');
    await goBoatTrip('glassreef', { phase: 'stop' });
  }

  private env(env: Env) {
    env.ambientTop = [0.62, 0.86, 1.02];
    env.ambientBottom = [0.34, 0.56, 0.72];
    env.fogTop = [0.42, 0.72, 0.86];
    env.fogBottom = [0.12, 0.3, 0.44];
    env.saturation = 1.05;
    env.bloom = Math.max(env.bloom, 0.35);
  }

  update(dt: number) {
    for (const f of this.fish) f.update(dt);
    super.update(dt);
    const p = this.player;
    // the camera keeps the reef floor in the lower part of the view
    if (!this.st.cam.locked && !this.cam.active) this.st.cam.ty = Math.min(p.y + 6, RF.FLOOR - 76);
    // keep below the surface
    if (p.y < RF.SURF + 18) { p.y = RF.SURF + 18; if (p.vy < 0) p.vy = 0; }
    // bubbles from the snorkel
    this.bubT -= dt;
    if (this.bubT <= 0) {
      this.bubT = rand.range(0.4, 1.4);
      for (let i = 0; i < rand.int(1, 3); i++) this.main.particles.spawn({ frame: A.dot2, x: p.x + p.facing * 6 + rand.range(-2, 2), y: p.y - 46, vx: rand.range(-4, 4), vy: rand.range(-40, -26), life: 2.4, color: [0.9, 1, 1], alpha: 0.85, alpha1: 0.2, wobble: 4, wobbleF: 2 });
    }
    const k = Math.floor(clamp(p.x / RF.W) * 10);
    if (k > this.reach) { this.reach = k; revealMap('glassreef', 0, k / 10); }
  }

  async enter() {
    await super.enter();
    (this.cam as unknown as { site: string }).site = 'Glass Reef';
    const prev = this.cam.onShot;
    this.cam.onShot = ph => {
      prev?.(ph);
      for (const x of ph.subjects) {
        if (x.inFrame < 0.4 || x.visible < 0.4) continue;
        const fl = 'v10:photo:glassreef:' + x.species;
        if (game.save.flags[fl]) continue;
        game.save.flags[fl] = true;
        discover({ id: 'species:' + x.species, kind: 'species', name: SPECIES_BY_ID[x.species]?.name ?? x.species, loc: 'glassreef', note: 'Photographed on Glass Reef' });
      }
      game.persist();
    };
    const p = this.player;
    p.x = KITTEN_X + 40; p.y = RF.SURF + 40;
    this.st.cam.tzoom = this.st.cam.zoom = 1.3;
    audio.setAmbience('underwater');
    const first = !game.save.flags['v10:reefDived'];
    game.save.flags['v10:reefDived'] = true;
    discover({ id: 'ecosystem:glassreef', kind: 'ecosystem', name: 'Glass Reef', loc: 'glassreef', note: 'Snorkelled from the Kitten' });
    game.persist();
    if (first) await game.ui.titleCard('Snorkel', 'Glass Reef', 'Under the Kitten', 2200);
    await this.say([{ who: 'mori', text: first ? 'Oh... OH. It’s like flying. Fish everywhere, and the water’s so clear it’s like glass.' : 'Back under the glass. Hello, fish.', expr: 'excited' } as BubbleLine]);
  }
}

/** the snorkel dive (from the anchored Kitten on Glass Reef) */
export async function goReefDive(clockT: number) {
  void clockT;
  game.go(() => new ReefDiveScene(), [0.1, 0.3, 0.4], 0.9);
}
