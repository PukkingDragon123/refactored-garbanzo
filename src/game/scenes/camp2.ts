// Camp Kittiwake: the castaways' beach camp beside the wreck, with the jungle edge next door.
// You salvage the wreck, build the tent / fire / workbench / radio yourself, collect at the jungle
// edge, craft, talk to the crew, and it's where the story's big moments happen: waking up on the
// beach, the noise in the night, Aroha's arrival, and every report after an expedition.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { FieldScene, FieldSite, SpawnV2 } from './field';
import { Prop, Custom } from '../../world/props';
import { addSky, addClouds, addFarImage, layerSpan } from '../../world/scenery';
import { bigFrame } from '../../gfx/atlas';
import { local, A } from '../assets';
import * as L from '../../art/landscape';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix, shade } from '../../art/color';
import { Rng, bayer, clamp, rand } from '../../core/math';
import { audio } from '../../core/audio';
import { ResourceNode, NodeArt } from '../../world/resources';
import { Actor } from '../../world/actor';
import type { Speaker } from '../../ui/bubbles';
import { BUILDS, advanceBuild, buildDone, buildLevel, missingText, nextStage, stageState } from '../crafting';
import { ITEMS } from '../items';
import { add as invAdd } from '../inventory';
import { questStatus, startQuest } from '../quests';
import * as script from '../script';
import { openCrafting } from '../../ui/craft';
import { openTravelMap } from '../travel2';
import { goTent } from './flow';
import type { TimeOfDay } from '../../world/timeofday';
import type { Sprite } from '../../art/jungle-core';
import { tree, canopyClump } from '../../art/jungle-trees';
import { plant, fungus, deadwood } from '../../art/jungle-plants';
import { foreground } from '../../art/jungle-fg';

// ------------------------------------------------------------------ art adapter (src/art/castaway.ts, src/art/jungle.ts, src/art/boat.ts)
type AnyFn = (...a: unknown[]) => unknown;
let castaway: Record<string, AnyFn> | null = null;
let jungleX: Record<string, AnyFn> | null = null;
let wreckFn: (() => Sprite) | null = null;
export function bindCampArt(c: Record<string, unknown> | null, j: Record<string, unknown> | null, wreck: (() => Sprite) | null) {
  castaway = c as Record<string, AnyFn> | null;
  jungleX = j as Record<string, AnyFn> | null;
  wreckFn = wreck;
}
const call = <T>(mod: Record<string, AnyFn> | null, name: string, ...args: unknown[]): T | null => {
  try {
    const f = mod?.[name];
    return f ? (f(...args) as T) : null;
  } catch (e) {
    console.warn('camp art', name, e);
    return null;
  }
};

let uid = 0;
const fr = (s: Sprite | null, tag = 'c'): Frame | null => (s ? local.add(`${tag}${uid++}`, s.buf, s.ax, s.ay) : null);
const glowFr = (s: Sprite | null): Frame | null => (s?.glow ? local.add(`cg${uid++}`, s.glow, s.ax, s.ay) : null);

export const CAMP_W = 2200;
const GY = 284;
export function campGround(x: number) {
  if (x < 110) return GY + 10 - (110 - x) * 0.5;
  if (x < 620) return GY + 4 + Math.sin(x * 0.03) * 2 + Math.sin(x * 0.011) * 3;
  if (x < 1300) return GY + Math.sin(x * 0.013) * 1.5;
  return GY - 2 + Math.sin(x * 0.009) * 4 + Math.sin(x * 0.037) * 1.2;
}

const SPOTS = { wreck: 330, radio: 690, bench: 790, tent: 930, fire: 1080, kitchen: 1150, flag: 1235, map: 1270, jungle: 1320 };

export interface CampOpts {
  noiseNight?: boolean;
}

/** a construction spot that redraws as it's built */
class BuildSpot {
  frames: (Frame | null)[] = [];
  glows: (Frame | null)[] = [];
  constructor(readonly id: string, readonly x: number, readonly paint: (stage: number) => Sprite | null) {}
  frame(stage: number) {
    if (!(stage in this.frames)) {
      const s = this.paint(stage);
      this.frames[stage] = fr(s, 'b');
      this.glows[stage] = glowFr(s);
    }
    return this.frames[stage];
  }
}

export class CampScene extends FieldScene {
  opts: CampOpts;
  builds: Record<string, BuildSpot> = {};
  private fireT = 0;
  private bush: { x: number; shake: number } = { x: 1420, shake: 0 };
  private scared = false;
  phoneSpeaker: Speaker | null = null;

  constructor(o: CampOpts = {}) {
    const tod: TimeOfDay = o.noiseNight ? 'night' : game.save.campTime;
    super(makeCampSite(), tod);
    this.opts = o;
    this.allowPack = true;
  }

  hudOpts() {
    const t = { dawn: 'Morning', day: 'Midday', dusk: 'Evening', night: 'Night' }[this.tod];
    return {
      place: 'Camp Kittiwake', sub: `Day ${game.save.day} · ${t}`,
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> interact · <span class="key">Q</span> camera · <span class="key">I</span> backpack',
    };
  }

  // ---------------------------------------------------------------- building the place
  buildCamp() {
    const r = game.r;
    const st = this.st;
    const night = this.tod === 'night';
    st.minX = 0;
    st.maxX = CAMP_W;
    st.waterY = GY + 12;
    const rng = new Rng(7);
    addSky(st, r);
    addClouds(st, r, 0.03, 30, 150, 8, 12, 0.05);
    // distant volcano + ridge
    const volc = call<PixelBuffer>(castaway, 'volcanoStrip', layerSpan(st, 0.07).w, 7);
    if (volc) {
      const span = layerSpan(st, 0.07);
      const l = st.addLayer('mtn', 0.07, 0.5, 0, 0);
      l.add(new Prop({ ...bigFrame(r, volc), ax: 0, ay: 0 }, span.x0, 250 - volc.h));
    } else {
      addFarImage(st, r, 'mtn', 0.07, 0.5, w => L.paintRidge(w, 150, {
        seed: 5, base: 150, amp: 70, freq: 0.01, body: hex('#4f6386'), lit: hex('#7386a8'), shadow: hex('#3c4a6a'), snow: hex('#e6ecf4'), snowLine: 40,
        fogTo: hex('#94a6c0'), fogStart: 80, peaks: [{ x: w * 0.78, h: 140, w: 110, cone: true }], sharp: 0.7,
      }), 110);
    }
    // the sea behind the beach
    const seaP = 0.12;
    const seaSpan = layerSpan(st, seaP);
    const sea = new PixelBuffer(seaSpan.w, 110);
    const pr = st.preset;
    const skyLow = pr.sky[pr.sky.length - 1].c, deep = hex(night ? '#0a1628' : '#1d4a66');
    for (let y = 0; y < 110; y++) for (let x = 0; x < seaSpan.w; x++) {
      const t = Math.pow(y / 109, 0.6);
      let c = mix(mix(skyLow, hex('#6aa6c0'), 0.3), deep, t);
      if ((y < 14 && (x * 7 + y * 13) % 23 === 0) || ((x + y * 5) % 41 === 0 && y < 50)) c = mix(c, hex('#ffffff'), 0.4 - y / 120);
      if (bayer(x, y) < 0.1 * (1 - t)) c = shade(c, 0.1);
      sea.data[y * seaSpan.w + x] = c;
    }
    const seaL = st.addLayer('sea', seaP, 0.3, 0, 0);
    seaL.add(new Prop({ ...bigFrame(r, sea), ax: 0, ay: 0 }, seaSpan.x0, 238));
    seaL.add(new Custom(1, (rr, s) => {
      for (let i = 0; i < 30; i++) {
        const gx = seaSpan.x0 + ((i * 97.3) % seaSpan.w), gy = 240 + ((i * 31) % 50);
        const a = Math.max(0, Math.sin(s.time * 2 + i * 1.7));
        rr.fxDraw(A.dot2, gx, gy, 1.5, 0.5, 0, packColor(1, 0.95, 0.85, 1), a * (night ? 0.3 : 0.8));
      }
    }));
    // jungle wall on the right (far -> near)
    const edge = (p: number) => SPOTS.jungle * p - 90;
    const strips: [string, number, number, number][] = [['jfar', 0.28, 0.35, 0], ['jmid', 0.45, 0.2, 1], ['jnear', 0.65, 0.1, 2]];
    for (const [name, p, fog, depth] of strips) {
      const span = layerSpan(st, p);
      let buf = call<PixelBuffer>(jungleX, 'forestStrip', depth, 30 + depth, span.w);
      if (!buf) buf = L.paintTreeline(span.w, 220, { seed: 22 + depth, base: 180, amp: 40, ramp: ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'].map(h => hex(h)), rMin: 10, rMax: 20, fern: 0.7, emergent: 0.35, palms: 0.2 });
      const ex = edge(p) - span.x0;
      for (let yy = 0; yy < buf.h; yy++) for (let xx = 0; xx < buf.w; xx++) if (xx < ex - (buf.h - yy) * 0.5 + (bayer(xx, yy) - 0.5) * 10) buf.data[yy * buf.w + xx] = 0;
      const lay = st.addLayer(name, p, fog, 0.15, 0);
      lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, GY + 6 - buf.h));
    }
    // mid layer: palms on the beach, big trees at the jungle edge
    const mid = st.addLayer('mid', 0.82, 0.05, 0.6, 0);
    for (let x = 420; x < 1250; x += rng.range(110, 190)) {
      const s = tree('palm', rng.int(1, 999), rng.range(170, 230));
      const f = fr(s);
      if (f) mid.add(new Prop(f, x * 0.82, GY - 4, rng.next(), { sway: 1.4 }));
    }
    for (let x = SPOTS.jungle; x < CAMP_W + 200; x += rng.range(70, 120)) {
      const k = rng.next();
      const kind = k < 0.25 ? 'kauri' : k < 0.45 ? 'rata' : k < 0.7 ? 'treefern' : k < 0.85 ? 'nikau' : 'fig';
      const s = tree(kind, rng.int(1, 999));
      const f = fr(s);
      if (f) mid.add(new Prop(f, x * 0.82, GY - 2, rng.next(), { sway: kind === 'treefern' || kind === 'nikau' ? 1.2 : 0.3 }));
    }
    // gameplay plane
    const main = st.addLayer('main', 1, 0, 1, 0);
    this.main = main;
    // ground: rocks -> sand -> soil
    const beach = call<PixelBuffer>(castaway, 'beachStrip', CAMP_W, 3);
    const gbuf = new PixelBuffer(CAMP_W, 90);
    for (let x = 0; x < CAMP_W; x++) {
      const top = Math.round(campGround(x) - (GY - 20));
      for (let y = Math.max(0, top); y < 90; y++) {
        const jungle = clamp((x - SPOTS.jungle + 60) / 120);
        const bc = beach ? beach.data[Math.min(beach.h - 1, y - top) * beach.w + (x % beach.w)] : 0;
        let c = bc && bc >>> 24 ? bc : mix(hex('#d8c08a'), hex('#b09060'), clamp((y - top) / 60));
        if (jungle > 0) c = mix(c, mix(hex('#3a2c1c'), hex('#241a10'), clamp((y - top) / 40)), jungle * (bayer(x, y) < jungle ? 1 : 0.7));
        if (y === top) c = shade(c, 0.12);
        gbuf.data[y * CAMP_W + x] = c;
      }
    }
    main.add(new Prop({ ...bigFrame(r, gbuf), ax: 0, ay: 0 }, 0, GY - 20, -10));
    st.terrain.addGround(Array.from({ length: Math.ceil(CAMP_W / 10) + 1 }, (_, i) => [i * 10, campGround(i * 10)] as [number, number]), 'ground');
    // the wreck on the rocks
    const wr = wreckFn?.() ?? null;
    const wf = fr(wr, 'wreck');
    if (wf) main.add(new Prop(wf, SPOTS.wreck, campGround(SPOTS.wreck) + 8, -2));
    // shore rocks and debris
    for (let i = 0; i < 6; i++) {
      const s = deadwood('rock', 40 + i, rng.range(28, 44));
      const f = fr(s);
      if (f) main.add(new Prop(f, 120 + i * 90 + rng.range(-20, 20), campGround(120 + i * 90) + 3, -1));
    }
    // beach dressing
    for (let x = 640; x < 1280; x += rng.range(30, 70)) {
      const s = rng.chance(0.5) ? plant('grass', rng.int(1, 999), 18) : plant('sedge', rng.int(1, 999), 16);
      const f = fr(s);
      if (f) main.add(new Prop(f, x, campGround(x) + 2, -1, { sway: 1.5 }));
    }
    // jungle undergrowth
    for (let x = SPOTS.jungle - 20; x < CAMP_W; x += rng.range(22, 48)) {
      const k = rng.next();
      const s = k < 0.3 ? plant('fern', rng.int(1, 999)) : k < 0.45 ? plant('crownfern', rng.int(1, 999)) : k < 0.55 ? plant('taro', rng.int(1, 999)) : k < 0.65 ? plant('shrub', rng.int(1, 999)) : k < 0.72 ? deadwood('rottenlog', rng.int(1, 999)) : k < 0.8 ? fungus(rng.chance(0.5) ? 'lantern' : 'bluecap', rng.int(1, 999)) : plant('kiokio', rng.int(1, 999));
      const f = fr(s);
      const g = glowFr(s);
      const y = campGround(x) + 2;
      if (f) main.add(new Prop(f, x, y, 1 + rng.next(), { sway: 0.8 }));
      if (g) main.add(new Custom(1.5, rr => { if (night) { rr.emissive(1); rr.draw(g, x, y); rr.emissive(); } }));
    }
    // foreground occluders at the jungle edge
    const front = st.addLayer('front', 1.35, 0, 0.5, 0);
    for (let x = SPOTS.jungle + 60; x < CAMP_W + 400; x += rng.range(160, 260)) {
      const kind = (['leaves', 'fronds', 'monstera', 'flax'] as const)[rng.int(0, 3)];
      const s = foreground(kind, rng.int(1, 999));
      const f = fr(s);
      if (!f) continue;
      const wx = x * 1.35, wy = GY + 70;
      front.add(new Prop(f, wx, wy, rng.next(), { sway: 0.6, tint: packColor(0.55, 0.62, 0.58, 1) }));
      this.occluders.push({ mask: s.buf, x: wx, y: wy, ax: s.ax, ay: s.ay, sx: 1, sy: 1, p: 1.35, z: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const s = canopyClump(90 + i, 260, 120);
      const f = fr(s);
      if (f) front.add(new Prop(f, (SPOTS.jungle + 300 + i * 420) * 1.35, 30, 0, { sway: 0.3, tint: packColor(0.45, 0.52, 0.5, 1) }));
    }
    this.buildStructures();
    this.buildNodes(rng);
    this.buildPOIs();
  }

  private buildStructures() {
    const main = this.main;
    const night = () => this.tod === 'night';
    const spot = (id: string, x: number, paint: (s: number) => Sprite | null) => {
      const b = new BuildSpot(id, x, paint);
      this.builds[id] = b;
      const y = campGround(x) + 2;
      main.add(new Custom(5, rr => {
        const lvl = buildLevel(id);
        const f = b.frame(lvl);
        if (f) rr.draw(f, x, y);
        else this.placeholder(rr, id, lvl, x, y);
        const g = b.glows[lvl];
        if (g && (night() || id === 'fire')) { rr.emissive(1); rr.draw(g, x, y); rr.emissive(); }
      }));
      this.interact.push({
        x, y, w: 24, h: 24, standX: x - 26,
        get label() { return spotLabel(id); },
        action: () => this.useSpot(id),
      } as never);
    };
    spot('tent', SPOTS.tent, s => call<Sprite>(castaway, 'tentStage', s, { open: s >= 4, night: false }));
    spot('fire', SPOTS.fire, s => (s === 0 ? null : call<Sprite>(castaway, 'campfire', Math.min(2, s - 1), { pot: !!game.save.flags['kitchen'] })));
    spot('bench', SPOTS.bench, s => call<Sprite>(castaway, 'workbench', Math.min(2, s)));
    spot('radio', SPOTS.radio, s => call<Sprite>(castaway, 'radioStation', Math.min(2, s)));
    // fixed props
    const fixed = (name: string, x: number, ...args: unknown[]) => {
      const s = call<Sprite>(castaway, name, ...args);
      const f = fr(s);
      if (f) main.add(new Prop(f, x, campGround(x) + 2, 3));
    };
    if (game.save.flags['kitchen']) fixed('kitchen', SPOTS.kitchen);
    fixed('logBench', SPOTS.fire - 44);
    fixed('flagpole', SPOTS.flag);
    fixed('sign', SPOTS.map);
    // fire light + flames
    main.add(new Custom(6, (rr, s) => {
      if (buildLevel('fire') < 3) return;
      const x = SPOTS.fire, y = campGround(x);
      const k = 0.85 + 0.15 * Math.sin(s.time * 11) * Math.sin(s.time * 3.7);
      rr.light(x, y - 12, this.tod === 'night' ? 230 : 120, 1, 0.62, 0.3, (this.tod === 'night' ? 3.2 : 1.4) * k);
      rr.fxDraw(A.glow, x, y - 10, 0.8, 0.7, 0, packColor(1, 0.6, 0.25, 1), 2.4 * k);
    }, (dt, s) => {
      if (buildLevel('fire') < 3) return;
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.05;
        const x = SPOTS.fire, y = campGround(x) - 6;
        main.glowParticles.spawn({ frame: A.soft, x: x + rand.range(-5, 5), y, vx: rand.range(-6, 6), vy: rand.range(-40, -26), life: rand.range(0.4, 0.8), color: [1, 0.72, 0.3], color1: [1, 0.25, 0.08], alpha: 0.95, alpha1: 0, size: rand.range(0.25, 0.4), size1: 0.05, glow: true, intensity: 2.6 });
        if (rand.chance(0.18)) main.glowParticles.spawn({ frame: A.dot, x, y: y - 6, vx: rand.range(-12, 12), vy: rand.range(-60, -30), life: rand.range(1, 2), color: [1, 0.8, 0.4], alpha: 1, alpha1: 0, glow: true, intensity: 3, wobble: 6, wobbleF: 2 });
      }
      void s;
    }));
  }

  private placeholder(r: Renderer, id: string, lvl: number, x: number, y: number) {
    const c = packColor(0.5, 0.45, 0.35, 1);
    if (id === 'tent') {
      if (lvl === 0) { for (let i = 0; i < 4; i++) r.rect(x - 30 + i * 20, y - 4, 2, 4, c); return; }
      const h = [0, 30, 36, 40, 40][lvl] ?? 40;
      r.rect(x - 34, y - h, 68, h, lvl >= 2 ? packColor(0.45, 0.5, 0.3, 1) : c);
    } else if (id === 'fire') {
      if (lvl >= 1) r.rect(x - 12, y - 4, 24, 4, packColor(0.5, 0.5, 0.5, 1));
      if (lvl >= 2) r.rect(x - 8, y - 9, 16, 5, packColor(0.4, 0.28, 0.18, 1));
    } else r.rect(x - 16, y - 8 - lvl * 8, 32, 8 + lvl * 8, c);
  }

  private buildNodes(rng: Rng) {
    const res = (kind: string, depleted: boolean, seed: number): Sprite | null => call<Sprite>(jungleX, 'resourceSprite', kind, depleted, seed);
    const node = (key: string, kind: string, x: number, contents?: [string, number][]) => {
      const n: NodeArt = { normal: fr(res(kind, false, x)) ?? A.blob, depleted: fr(res(kind, true, x)), glow: glowFr(res(kind, false, x)) };
      const nd = new ResourceNode('camp:' + key, kind, x, campGround(x) + 2, n);
      if (contents) nd.contents = contents;
      this.addNode(nd);
      return nd;
    };
    // wreck salvage
    node('crate1', 'crate', 250, [['canvas', 1], ['rope', 1]]);
    node('crate2', 'crate', 300, [['poles', 4]]);
    node('crate3', 'crate', 380, [['plank', 3], ['scrap', 1]]);
    node('crate4', 'crate', 440, [['ration', 3], ['battery', 1]]);
    node('crate5', 'crate', 520, [['plank', 2], ['scrap', 2], ['wire', 1]]);
    node('toolbox', 'crate', 560, []);
    node('tidepool1', 'shells', 160);
    node('tidepool2', 'shells', 205);
    if (questStatus('pipe') === 'active' || questStatus('pipe') === 'done') node('pipe', 'shells', 185, [['pipe', 1], ['mussel', 1]]);
    node('stones1', 'stones', 600);
    node('stones2', 'stones', 1290);
    node('drift1', 'driftwood', 700);
    node('drift2', 'driftwood', 1010);
    node('drift3', 'driftwood', 1210);
    node('seaweed', 'seaweed', 140);
    // jungle edge
    node('flax1', 'flax', 1340);
    node('flax2', 'flax', 1530);
    node('fern1', 'treefern', 1400);
    node('kawa1', 'kawakawa', 1460);
    node('moon1', 'moonfruit', 1620);
    node('moss1', 'mossrock', 1690);
    node('glow1', 'glowcap', 1760);
    node('brack1', 'bracket', 1840);
    node('ink1', 'inkcap', 1900);
    node('grub1', 'grublog', 1960);
    node('thorn1', 'thornfur', 2040);
    node('feath1', 'feather', 1580);
    node('beetle1', 'lanternbeetle', 1720);
    node('weta1', 'weta', 1870);
    node('moth1', 'skymoth', 1480);
    void rng;
    // the toolbox holds the hammer, trowel, gloves and tweezers
    const tb = this.nodes.find(n => n.key === 'camp:toolbox');
    if (tb) tb.contents = [];
  }

  private buildPOIs() {
    const g = campGround;
    const P = this.pois;
    P.push({ kind: 'burrow', x: 1390, y: g(1390) }, { kind: 'burrow', x: 1430, y: g(1430) }, { kind: 'burrow', x: 1470, y: g(1470) });
    P.push({ kind: 'cover', x: 1420, y: g(1420), w: 18 }, { kind: 'cover', x: 1650, y: g(1650), w: 20 }, { kind: 'cover', x: 1950, y: g(1950), w: 20 });
    P.push({ kind: 'sun', x: 1240, y: g(1240) }, { kind: 'sun', x: 1560, y: g(1560) });
    P.push({ kind: 'soft', x: 1600, y: g(1600) }, { kind: 'soft', x: 1880, y: g(1880) });
    P.push({ kind: 'fruit', x: 1620, y: g(1620), amount: 20 });
    for (const x of [1560, 1760, 1980, 2120]) P.push({ kind: 'trunk', x, y: g(x), y1: g(x) - 170 });
    P.push({ kind: 'perch', x: 1760, y: g(1760) - 150 }, { kind: 'perch', x: 1980, y: g(1980) - 140 }, { kind: 'perch', x: 1235, y: g(1235) - 70 });
    P.push({ kind: 'branch', x: 1990, y: g(1990) - 120 }, { kind: 'flower', x: 1760, y: g(1760) - 110 });
    this.sunspots.push({ x: 1240, w: 60 }, { x: 1560, w: 50 });
  }

  // ---------------------------------------------------------------- crew
  placeCrew() {
    const s = game.save;
    const night = this.tod === 'night';
    const g = campGround;
    const crowe = this.addActor('crowe', night ? SPOTS.fire - 50 : SPOTS.flag - 20, g(SPOTS.flag), -1);
    crowe.idleAnim = night || buildDone('fire') ? 'pipe' : 'idle';
    crowe.setAnim(crowe.idleAnim);
    const lou = this.addActor('lou', buildDone('fire') ? SPOTS.fire + 26 : SPOTS.kitchen, g(SPOTS.kitchen), -1);
    lou.idleAnim = buildDone('fire') ? 'cook' : 'idle';
    lou.setAnim(lou.idleAnim);
    const pip = this.addActor('pip', buildLevel('radio') > 0 ? SPOTS.radio + 18 : SPOTS.bench + 20, g(SPOTS.bench), -1);
    pip.idleAnim = buildLevel('radio') > 0 || buildDone('bench') ? 'wrench' : 'tinker';
    pip.setAnim(pip.idleAnim);
    if (s.flags['aroha:met'] && !this.opts.noiseNight) {
      const ar = this.addActor('aroha', SPOTS.fire + 70, g(SPOTS.fire + 70), -1);
      ar.idleAnim = 'staff';
      ar.setAnim('staff');
    }
    if (night) for (const a of this.actors.values()) { a.idleAnim = 'sitGround'; a.setAnim('sitGround'); }
    for (const [id, a] of this.actors) {
      this.interact.push({ x: a.x, y: a.y, w: 12, h: 30, label: `Talk to ${a.name}`, get standX() { return a.x + (a.facing > 0 ? 26 : -26); }, action: () => this.talk(id) } as never);
    }
  }

  async talk(id: string) {
    const a = this.actors.get(id)!;
    a.faceTo(this.player.x);
    this.player.body.faceTo(a.x);
    if (id === 'aroha' && game.save.flags['aroha:met']) {
      const c = await this.say([{ who: 'aroha', text: game.save.sites.length ? 'Kia ora. Where are we heading?' : 'Kia ora, Doc.', expr: 'happy', choices: game.save.sites.length ? ['Open the map', 'Just chatting'] : undefined }]);
      if (c === 0) { await openTravelMap(); return; }
    }
    const t = script.campTalk(id);
    await this.say(t.lines);
    t.after?.();
    game.persist();
    this.hud?.refresh(true);
  }

  // ---------------------------------------------------------------- building
  async useSpot(id: string) {
    const def = BUILDS[id];
    if (buildDone(id)) {
      if (id === 'tent') { goTent(); return; }
      if (id === 'bench') { await openCrafting('bench', { onCraft: (_r: string, sec: number) => this.player.doWork('build', sec).then(() => undefined) }); this.hud?.refresh(true); return; }
      if (id === 'fire') {
        if (game.save.flags['kitchen']) { await openCrafting('fire', { onCraft: (_r: string, sec: number) => this.player.doWork('kneel', sec).then(() => undefined) }); this.hud?.refresh(true); return; }
        this.bark('rowan', 'Nice and warm.', { expr: 'happy' });
        return;
      }
      if (id === 'radio') { this.bark('pip', 'The radio! It hisses. Hissing is good!', { expr: 'happy' }); return; }
      return;
    }
    if (id === 'radio' && questStatus('radio') !== 'active') { this.bark('pip', 'Ooh, don’t touch my junk pile! It’s going to be a radio mast one day.', { expr: 'worried' }); return; }
    const st = nextStage(id)!;
    const state = stageState(id);
    if (state === 'tool') { this.bark('rowan', `I need a ${ITEMS[st.tool!]?.name.toLowerCase() ?? st.tool} for this.`, { expr: 'thinking', emote: 'question' }); audio.play('wrong', { vol: 0.5 }); return; }
    if (state === 'missing') { this.bark('rowan', `${st.label}: I still need ${missingText(st.needs)}.`, { expr: 'thinking' }); audio.play('wrong', { vol: 0.4 }); return; }
    const anim = def.anim;
    let sfxT = 0;
    const ok = await this.player.doWork(anim, st.time, () => {
      sfxT -= 1 / 60;
      if (sfxT <= 0) { sfxT = anim === 'kneel' ? 0.5 : 0.32; audio.play((anim === 'kneel' ? 'dig' : 'hammer') as 'ui', { vol: 0.5, pitch: 0.9 + rand.next() * 0.2 }); }
    });
    if (!ok) return;
    advanceBuild(id);
    audio.play('craft' as 'ui', { vol: 0.6 });
    this.st.shake(1.2, 0.2);
    this.player.body.react('bounce');
    this.player.body.showEmote('sparkle', 1.2);
    for (let i = 0; i < 16; i++) this.main.particles.spawn({ frame: A.dot2, x: this.builds[id].x + rand.range(-20, 20), y: campGround(this.builds[id].x) - rand.range(0, 30), vx: rand.range(-40, 40), vy: rand.range(-60, -10), ay: 200, life: 0.8, color: [0.85, 0.78, 0.6], alpha: 1, alpha1: 0, floorY: campGround(this.builds[id].x) + 1 });
    game.ui.toast(`${def.name}: <b>${st.label}</b> ✓`, 'BUILD', 'teal', 2200);
    if (buildDone(id)) this.onBuilt(id);
    game.persist();
    this.hud?.refresh(true);
  }

  async onBuilt(id: string) {
    this.cutscene = true;
    try {
      if (id === 'tent') await this.say(script.TENT_BUILT);
      if (id === 'fire') {
        audio.play('fireLight' as 'ui', { vol: 0.7 });
        const lou = this.actors.get('lou');
        if (lou) { await lou.walkTo(SPOTS.fire + 26, 60); lou.idleAnim = 'cook'; lou.setAnim('cook'); }
        await this.say(script.FIRE_BUILT);
      }
      if (id === 'bench') await this.say([{ who: 'pip', text: 'A workbench! Now you can craft lures. And I can finally sort my screws.', expr: 'happy', emote: 'sparkle' }]);
    } finally {
      this.cutscene = false;
    }
    // laptop moment once the tent stands
    if (id === 'tent' && !game.save.flags['laptop']) {
      game.save.flags['laptop'] = true;
      this.cutscene = true;
      await this.say(script.LAPTOP_READY);
      this.cutscene = false;
    }
  }

  // ---------------------------------------------------------------- salvage specials
  async collect(n: ResourceNode) {
    if (n.key === 'camp:toolbox' && !n.depleted) {
      const ok = await this.player.doWork('pull', 2.2);
      if (!ok) return;
      for (const t of ['hammer', 'trowel', 'gloves', 'tweezers']) invAdd(t, 1);
      n.deplete();
      audio.play('collectPop' as 'ui', { vol: 0.7 });
      game.ui.toast('Found the ship’s toolbox: <b>hammer, trowel, lab gloves, tweezers</b>', 'TOOLS', 'teal', 4200);
      this.bark('rowan', 'The toolbox! Crowe’s hammer, a trowel, and my old field kit!', { expr: 'happy', emote: 'sparkle' });
      game.persist();
      return;
    }
    await super.collect(n);
    if (n.kind === 'crate' && n.depleted) {
      const got = n.contents?.map(([id]) => id) ?? [];
      if (got.includes('canvas')) this.bark('rowan', script.CAMP_BARK.canvas, { expr: 'happy' });
      else if (got.includes('poles')) this.bark('rowan', script.CAMP_BARK.poles, { expr: 'happy' });
    }
    if (n.kind === 'flax' && !game.save.flags['said:rope'] && game.save.quests['castaways'] === 'active') {
      game.save.flags['said:rope'] = true;
      this.bark('rowan', 'Now strip the leaves for fibre, and twist it into rope. I can do that from my backpack.', { expr: 'thinking', emote: 'idea' });
    }
    if (n.def?.gives.some(([id]) => ITEMS[id]?.lab) && !game.save.flags['said:sample']) {
      game.save.flags['said:sample'] = true;
      this.bark('rowan', script.CAMP_BARK.firstSample, { expr: 'happy', emote: 'sparkle' });
    }
  }

  // ---------------------------------------------------------------- story moments
  async arrival() {
    const s = game.save;
    this.cutscene = true;
    const p = this.player;
    p.x = 470;
    p.y = campGround(470);
    p.facing = 1;
    p.body.setAnim('lie');
    p.body.setExpr('sleep');
    this.st.cam.locked = true;
    this.st.cam.x = 520;
    this.st.cam.y = 170;
    this.st.cam.zoom = 1.6;
    audio.setMusic('castaway' as never);
    audio.setAmbience('beach' as never, false);
    const crowe = this.actors.get('crowe')!, pip = this.actors.get('pip')!, lou = this.actors.get('lou')!;
    crowe.x = 160; crowe.visible = false;
    pip.x = 620; pip.visible = false;
    lou.x = 900; lou.visible = false;
    await wait(1500);
    await this.say(script.WAKE_UP);
    await p.body.play('wake', 'sitGround');
    p.body.setExpr('tired');
    await wait(400);
    // look at the wreck
    this.st.cam.locked = false;
    this.st.cam.tzoom = 1.1;
    this.st.cam.tx = 380;
    this.st.cam.ty = 190;
    await wait(1200);
    await this.say(script.SEE_WRECK);
    await p.body.play('getUp', 'idle');
    p.body.setExpr('worried');
    // the crew staggers ashore
    crowe.visible = true;
    crowe.y = campGround(160) + 14;
    crowe.walkAnim = 'carry';
    crowe.walkTo(360, 30, 'carry');
    audio.play('splashBig' as 'ui', { vol: 0.5 });
    this.st.cam.tx = 420;
    await wait(1800);
    pip.visible = true;
    pip.y = campGround(620);
    pip.react('jump');
    pip.walkTo(520, 50);
    lou.visible = true;
    lou.walkTo(560, 45);
    await wait(1500);
    crowe.faceTo(p.x);
    await this.say(script.CREW_ASHORE);
    crowe.setAnim('idle');
    this.st.cam.tzoom = 1;
    // everyone to their jobs
    crowe.walkTo(SPOTS.flag - 20, 45);
    pip.walkTo(SPOTS.bench + 20, 50);
    lou.walkTo(SPOTS.kitchen, 45);
    s.flags['arrived'] = true;
    game.persist();
    await game.ui.titleCard('Chapter 1', 'Castaways', 'Salvage the wreck. Build a camp. Survive the night.', 3000);
    this.cutscene = false;
    audio.setMusic('build' as never);
    // Crowe's rope tip
    setTimeout(() => { if (!this.cutscene) this.say(script.CROWE_ROPE); }, 12000);
  }

  /** the first night: investigate the rustling bush */
  async noiseNightStart() {
    this.cutscene = false;
    this.lampOn = true; // phone torch
    audio.setMusic('spooky' as never);
    audio.setHeartbeat(0.3);
    for (const a of this.actors.values()) { a.setAnim('lie'); a.setExpr('sleep'); a.idleAnim = 'lie'; a.showEmote('zzz', 999); }
    this.player.x = SPOTS.tent + 40;
    this.player.y = campGround(this.player.x);
    this.player.facing = 1;
    this.hud?.setKeys('<span class="key">A</span><span class="key">D</span> move · the phone torch lights the way');
    await this.say(script.NOISE_OUTSIDE);
  }

  private async jumpscare() {
    if (this.scared) return;
    this.scared = true;
    const s = game.save;
    this.cutscene = true;
    const p = this.player;
    p.vx = 0;
    audio.setMusic('none' as never);
    audio.setHeartbeat(0.9);
    this.st.cam.tzoom = 1.5;
    this.st.cam.tx = this.bush.x - 20;
    await wait(1400);
    // the bush explodes
    const ar = this.addActor('aroha', this.bush.x + 4, campGround(this.bush.x), -1);
    ar.z = 55;
    game.ui.bubbles.register('aroha', ar.speaker());
    audio.play('jumpscare' as 'ui', { vol: 1.1 });
    this.st.shake(8, 0.6);
    game.r.post.flash = 0.9;
    this.st.cam.zoom = 2.1;
    for (let i = 0; i < 40; i++) this.main.particles.spawn({ frame: A.leaves[i % A.leaves.length], x: this.bush.x + rand.range(-14, 14), y: campGround(this.bush.x) - rand.range(4, 40), vx: rand.range(-120, 120), vy: rand.range(-160, -40), ay: 260, life: 1.4, color: [0.5, 0.8, 0.4], alpha: 1, alpha1: 0, vrot: rand.range(-8, 8), flutter: 1, floorY: campGround(this.bush.x) + 1 });
    ar.play('lunge', 'staff');
    ar.setExpr('angry');
    p.body.react('jump');
    p.body.showEmote('shock', 1.8);
    p.body.setExpr('shocked');
    p.body.play('fallBack', 'sitShock');
    audio.setHeartbeat(0);
    // phone speaker at Rowan's hand
    this.phoneSpeaker = {
      name: 'Phone', voice: 1.6, color: '#13262b',
      anchor: () => {
        const h = p.body.handPos() ?? [p.x + p.facing * 10, p.y - 30];
        const r = game.r;
        const [cx, cy] = game.ui.artToCss(r.projectX(h[0], 1), r.projectY(h[1] - 10, 1), r.VW, r.VH);
        return [cx, cy];
      },
    };
    game.ui.bubbles.register('phone', this.phoneSpeaker);
    await wait(700);
    this.st.cam.tzoom = 1.3;
    const lines = script.JUMPSCARE.map(l => ({ ...l }));
    // phone beats: Rowan holds the phone up while it talks
    for (const l of lines) {
      if (l.who === 'phone') l.onShow = () => { p.body.setAnim('phone'); audio.play('scanBeep' as 'ui', { vol: 0.4 }); };
      if (l.text.startsWith('What in blazes')) l.onShow = () => { const c = this.actors.get('crowe'); if (c) { c.showEmote('question', 1.2); c.setExpr('grumpy'); c.walkTo(this.bush.x - 80, 70); } };
      if (l.text.startsWith('Hahaha')) l.onShow = () => ar.setAnim('staff');
    }
    const crowe = this.actors.get('crowe');
    if (crowe) { crowe.setAnim('idle'); crowe.setExpr('neutral'); crowe.clearEmote(); }
    await this.say(lines);
    s.flags['noise:found'] = true;
    s.flags['aroha:met'] = true;
    if (!s.sites.includes('fernwood')) s.sites.push('fernwood');
    game.persist();
    // morning
    await game.fadeTo(1, 1);
    s.day++;
    s.campTime = 'dawn';
    game.persist();
    const { CampScene } = await import('./camp2');
    await game.ui.titleCard(`Day ${s.day}`, 'Morning', '', 1600);
    game.go(() => new CampScene(), [0.02, 0.02, 0.03], 3);
    game.save.flags['aroha:morning'] = false;
  }

  async arohaMorning() {
    const s = game.save;
    this.cutscene = true;
    const ar = this.actors.get('aroha');
    const p = this.player;
    p.x = SPOTS.fire - 60;
    p.y = campGround(p.x);
    this.snapCamera();
    this.st.cam.tx = SPOTS.fire;
    await wait(800);
    const lines = script.MORNING_AROHA.map(l => ({ ...l }));
    for (const l of lines) {
      if (l.text.startsWith('Yes. Yes. Long story')) l.onShow = () => {
        // a curious strider strolls up behind Pip
        const pip = this.actors.get('pip')!;
        const st = this.spawnStrider(pip.x + 90);
        st.setAct('investigate', 10);
        st.curio = 1;
      };
      if (l.text.startsWith('Here, I drew you a map')) l.onShow = () => { ar?.play('explain', 'staff'); audio.play('pageTurn'); };
    }
    await this.say(lines);
    s.flags['aroha:morning'] = true;
    game.persist();
    await game.ui.titleCard('Chapter 2', 'First Contact', 'Aroha will take you anywhere on her map. Talk to her at the fire.', 3200);
    this.cutscene = false;
    audio.setMusic('aroha' as never);
  }

  spawnStrider(x: number) {
    this.spawnRule({ species: 'strider', n: [1, 1], x: [x, x + 1] }, false);
    return this.animals[this.animals.length - 1];
  }

  // ---------------------------------------------------------------- frame
  async enter() {
    await super.enter();
    const s = game.save;
    this.placeCrewSpeakers();
    if (!s.flags['arrived']) await this.arrival();
    else if (this.opts.noiseNight) await this.noiseNightStart();
    else if (s.flags['aroha:met'] && !s.flags['aroha:morning']) await this.arohaMorning();
    else {
      audio.setMusic(this.tod === 'night' ? 'night' : buildDone('tent') ? 'camp' : 'build' as never);
      audio.setAmbience('beach' as never, this.tod === 'night');
      // gentle nudges
      if (questStatus('castaways') === 'active' && buildDone('tent') && buildDone('fire') && (s.vars['analyses'] ?? 0) >= 1 && !s.flags['slept:1'] && !s.flags['said:dusk']) {
        s.flags['said:dusk'] = true;
        this.cutscene = true;
        await this.say(script.DUSK);
        this.cutscene = false;
      }
    }
  }

  private placeCrewSpeakers() {
    for (const [id, a] of this.actors) game.ui.bubbles.register(id, a.speaker());
  }

  update(dt: number) {
    super.update(dt);
    // spooky night: the bush rustles; walking up to it springs the scare
    if (this.opts.noiseNight && !this.scared) {
      this.bush.shake -= dt;
      if (this.bush.shake <= 0) {
        this.bush.shake = rand.range(2.5, 5);
        this.sfx('rustleBush', this.bush.x, 0.8);
        for (let i = 0; i < 6; i++) this.main.particles.spawn({ frame: A.leaves[i % A.leaves.length], x: this.bush.x + rand.range(-10, 10), y: campGround(this.bush.x) - rand.range(10, 30), vx: rand.range(-20, 20), vy: rand.range(-40, -10), ay: 120, life: 1.2, color: [0.4, 0.6, 0.35], alpha: 1, alpha1: 0, flutter: 1, floorY: campGround(this.bush.x) + 1 });
      }
      const d = this.bush.x - this.player.x;
      audio.setHeartbeat(clamp(1 - d / 500) * 0.8);
      if (d < 70) this.jumpscare();
    }
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }
}

function spotLabel(id: string) {
  const def = BUILDS[id];
  if (buildDone(id)) return id === 'tent' ? 'Enter the tent' : id === 'bench' ? 'Workbench: craft' : id === 'fire' ? (game.save.flags['kitchen'] ? 'Campfire: cook' : 'Campfire') : 'Radio mast';
  const st = nextStage(id)!;
  const miss = missingText(st.needs);
  return `${def.name}: ${st.label}${miss ? ` <span style="opacity:0.7">(${miss})</span>` : ''}`;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function makeCampSite(): FieldSite {
  const s = game.save;
  const spawns: SpawnV2[] = [
    { species: 'strider', n: [1, 2], x: [1500, 2100], times: ['dawn', 'day', 'dusk'], later: true, chance: 0.9 },
    { species: 'delver', n: [3, 5], x: [1370, 1500], herd: true, juveniles: 0.35, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'nutcracker', n: [3, 5], x: [1560, 1700], herd: true, times: ['dawn', 'day'], chance: 0.8 },
    { species: 'barkgecko', n: [1, 3], x: [1540, 2140], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'mossfrog', n: [2, 4], x: [1700, 2100], herd: true, times: ['dusk', 'night'], chance: 1 },
    { species: 'hunterbat', n: [1, 1], x: [1600, 2150], poi: 'branch', medium: 'trunk', times: ['night'], chance: 0.6 },
    { species: 'shieldback', n: [1, 1], x: [1700, 2100], times: ['dawn', 'dusk'], chance: 0.5, later: true },
  ];
  return {
    id: 'camp', name: 'Camp Kittiwake', width: CAMP_W, camY: 186, spawnX: s.flags['arrived'] ? 1000 : 470, exitX: 0, waterY: null,
    ambience: 'beach' as never, music: 'camp' as never, ground: 'sand', noGuide: true, noExit: true,
    spawns: s.flags['arrived'] ? spawns : [],
    insects: [
      { kind: 'butterfly', x: [1300, 2000], y: [200, 260], n: 5, times: ['day', 'dawn'] },
      { kind: 'firefly', x: [1300, 2150], y: [190, 270], n: 18, times: ['dusk', 'night'] },
      { kind: 'skymoth', x: [1300, 2100], y: [180, 250], n: 4, times: ['dusk', 'night'] },
      { kind: 'dragonfly', x: [600, 1300], y: [240, 270], n: 3, times: ['day'] },
      { kind: 'bee', x: [1400, 1800], y: [230, 270], n: 5, times: ['day'] },
    ],
    build: f => (f as CampScene).buildCamp(),
    onEnter: f => { (f as CampScene).placeCrew(); },
  };
}
