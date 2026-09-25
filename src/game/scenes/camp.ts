// Base camp: a side-scrolling hub on the beach edge of the jungle.

import { StageScene } from './base';
import { game } from '../game';
import { Stage } from '../../world/stage';
import { Player } from '../../world/player';
import { NPC } from '../../world/npc';
import { Prop, LightSource, Custom, AnimProp } from '../../world/props';
import { addSky, addClouds, addFarImage, addGroundStrip, layerSpan } from '../../world/scenery';
import { atlas, props, propAnims, A } from '../assets';
import { bigFrame } from '../../gfx/atlas';
import { packColor } from '../../gfx/renderer';
import * as L from '../../art/landscape';
import * as F from '../../art/flora';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix, shade } from '../../art/color';
import { PAL } from '../../art/palettes';
import { Rng, bayer, clamp, rand } from '../../core/math';
import { audio } from '../../core/audio';
import { vanceTalk, sidRumor, objective, LOU_MEALS, setFlag, flag } from '../story';
import { campHud } from '../../ui/hud';
import { openJournal } from '../../ui/journal';
import { openShop } from '../../ui/shop';
import { openMap } from '../../ui/mapui';
import type { TimeOfDay } from '../../world/timeofday';

const GY = 222; // camp ground level

export function campGround(x: number) {
  if (x < 60) return 238;
  if (x < 210) return 238 - ((x - 60) / 150) * 16 + Math.sin(x * 0.05) * 0.8;
  return GY + Math.sin(x * 0.013) * 1.5 + Math.sin(x * 0.041) * 0.8;
}

export class CampScene extends StageScene {
  npcs: Record<string, NPC> = {};
  tod: TimeOfDay;
  constructor(tod?: TimeOfDay, readonly spawnX = 610) {
    super();
    this.tod = tod ?? game.save.campTime;
  }

  build() {
    const r = game.r;
    const st = (this.st = new Stage(this.tod, { shade: 0.1, haze: [0.75, 0.82, 0.86], hazeK: 0.15 }));
    st.minX = 0;
    st.maxX = 1420;
    st.waterY = 236;
    const pr = st.preset;
    const night = this.tod === 'night';
    const rng = new Rng(42);

    addSky(st, r);
    addClouds(st, r, 0.03, 20, 110, 7, 11, 0.05);
    // far mountains with the volcano
    addFarImage(st, r, 'mtn', 0.07, 0.5, w => L.paintRidge(w, 130, {
      seed: 5, base: 128, amp: 60, freq: 0.01, body: hex('#58698c'), lit: hex('#7a8aac'), shadow: hex('#435070'), snow: hex('#e6ecf4'), snowLine: 38,
      fogTo: hex('#94a6c0'), fogStart: 70, peaks: [{ x: w * 0.72, h: 118, w: 90, cone: true }], sharp: 0.7,
    }), 70);
    // the sea (p 0.12) with the research ship at anchor
    const seaP = 0.12;
    const seaSpan = layerSpan(st, seaP);
    const sea = new PixelBuffer(seaSpan.w, 90);
    const skyLow = pr.sky[pr.sky.length - 1].c, deep = hex(night ? '#0a1628' : '#1d4a66');
    for (let y = 0; y < 90; y++) for (let x = 0; x < seaSpan.w; x++) {
      const t = Math.pow(y / 89, 0.6);
      let c = mix(mix(skyLow, hex('#6aa6c0'), 0.3), deep, t);
      if ((y < 12 && (x * 7 + y * 13) % 23 === 0) || ((x + y * 5) % 41 === 0 && y < 40)) c = mix(c, hex('#ffffff'), 0.4 - y / 100);
      if (bayer(x, y) < 0.1 * (1 - t)) c = shade(c, 0.1);
      sea.data[y * seaSpan.w + x] = c;
    }
    const seaL = st.addLayer('sea', seaP, 0.3, 0, 0);
    seaL.add(new Prop({ ...bigFrame(r, sea), ax: 0, ay: 0 }, seaSpan.x0, 186));
    seaL.add(new Custom(1, (rr, s) => {
      // glinting sun path + bobbing ship
      for (let i = 0; i < 26; i++) {
        const gx = seaSpan.x0 + ((i * 97.3) % seaSpan.w), gy = 188 + ((i * 31) % 40);
        const a = Math.max(0, Math.sin(s.time * 2 + i * 1.7));
        rr.fxDraw(A.dot2, gx, gy, 1.5, 0.5, 0, packColor(1, 0.95, 0.85, 1), a * (this.tod === 'day' ? 0.8 : 0.5));
      }
      const bob = Math.sin(s.time * 0.9) * 0.6;
      rr.draw(props.ship, -60, 196 + bob, 0.55, 0.55);
      if (night) {
        rr.fxDraw(A.glow, -45, 181 + bob, 0.15, 0.15, 0, packColor(1, 0.9, 0.6, 1), 3);
        rr.fxDraw(A.glow, -60, 176 + bob, 0.1, 0.1, 0, packColor(1, 0.2, 0.2, 1), 3 * (Math.sin(s.time * 3) > 0 ? 1 : 0.2));
      }
    }));
    // forested headland
    const edge = (p: number) => 420 * p - 60;
    const tl = (name: string, p: number, fog: number, seed: number, ramp: string[], base: number, amp: number, rMin: number, rMax: number, y: number) => {
      const span = layerSpan(st, p);
      const buf = L.paintTreeline(span.w, 150, { seed, base, amp, ramp: ramp.map(h => hex(h)), rMin, rMax, fern: 0.7, emergent: 0.35, palms: 0.25 });
      // clear the beach side with a ragged edge
      const ex = edge(p) - span.x0;
      for (let yy = 0; yy < buf.h; yy++) for (let xx = 0; xx < buf.w; xx++) if (xx < ex - (buf.h - yy) * 0.6 + (bayer(xx, yy) - 0.5) * 8) buf.data[yy * buf.w + xx] = 0;
      const lay = st.addLayer(name, p, fog, 0, 0);
      lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, y));
      return lay;
    };
    tl('hill', 0.18, 0.42, 21, ['#27433f', '#2f524a', '#3a6356', '#497460'], 110, 40, 7, 14, 90);
    tl('trees1', 0.3, 0.28, 22, ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'], 120, 22, 8, 16, 100);

    // mid layer: tree ferns & kauri trunks behind camp (p 0.5)
    const mid = st.addLayer('mid', 0.5, 0.16, 0.25, 0);
    const near = st.addLayer('near', 0.75, 0.06, 0.6, 0);
    const midSpan = layerSpan(st, 0.5);
    for (let x = edge(0.5) + 20; x < midSpan.x0 + midSpan.w; x += rng.range(40, 80)) {
      const k = rng.next();
      let o;
      if (k < 0.55) o = F.paintTreeFern(rng.int(1, 999), { height: rng.range(70, 120), silver: rng.chance(0.3) });
      else if (k < 0.75) o = F.paintNikau(rng.int(1, 999), rng.range(80, 120));
      else o = F.paintKauri(rng.int(1, 999), rng.range(200, 240), rng.int(12, 16));
      mid.add(new Prop(atlas.add('m' + x, o.buf, o.ax, o.ay), x, 214 + rng.range(-2, 4), rng.next(), { sway: 1.2 }));
    }
    for (let x = midSpan.x0; x < edge(0.5) + 40; x += rng.range(50, 90)) {
      const o = F.paintNikau(rng.int(1, 999), rng.range(60, 100));
      mid.add(new Prop(atlas.add('mn' + x, o.buf, o.ax, o.ay), x, 216, 0, { sway: 1.5 }));
    }
    // near layer (p .75): bushes and ferns just behind the tents
    const nearSpan = layerSpan(st, 0.75);
    const nearG = (x: number) => 219 + Math.sin(x * 0.02) * 2;
    near.add(new Custom(-1, rr => rr.rect(nearSpan.x0, 218, nearSpan.w, 30, packColor(0.13, 0.21, 0.16, 1))));
    for (let x = nearSpan.x0; x < nearSpan.x0 + nearSpan.w; x += rng.range(24, 50)) {
      const beach = x < edge(0.75) + 60;
      const k = rng.next();
      let o;
      if (beach) o = k < 0.5 ? F.paintGrassTuft(rng.int(1, 99), 14, PAL.leafOlive, 9) : F.paintNikau(rng.int(1, 999), rng.range(50, 80));
      else if (k < 0.4) o = F.paintTreeFern(rng.int(1, 999), { height: rng.range(40, 70) });
      else if (k < 0.8) o = F.paintBush(rng.int(1, 999), rng.int(34, 56), rng.int(18, 28), rng.chance(0.5) ? PAL.leafDeep : PAL.leafTeal, rng.chance(0.25) ? PAL.flowerPink : undefined);
      else o = F.paintGroundFern(rng.int(1, 999), rng.range(12, 18));
      near.add(new Prop(atlas.add('n' + x, o.buf, o.ax, o.ay), x, nearG(x) + 2, rng.next(), { sway: 0.8 }));
    }

    // ---------------------------------------------------------- gameplay layer
    const main = st.addLayer('main', 1, 0, 1, 0);
    // water on the beach side (reflective)
    main.add(new Custom(-5, rr => {
      rr.water(0.85, 1.5, 1);
      rr.rect(-200, 236, 330, 60, packColor(0.1, 0.24, 0.32, 1));
      rr.water(0);
    }));
    addGroundStrip(main, r, 0, 1420, 205, 70, campGround, { top: PAL.moss, soil: PAL.soil, stones: PAL.stone.slice(2), roots: true, litter: [PAL.leafOlive[3], PAL.bark[4]] }, -2, 7);
    // sand overlay on the beach
    const sandW = 260;
    const sandBuf = new PixelBuffer(sandW, 60);
    for (let x = 0; x < sandW; x++) {
      const top = Math.round(campGround(x) - 205);
      for (let y = top; y < 60; y++) {
        const fade = x > 180 ? (x - 180) / 80 : 0;
        if (bayer(x, y) < fade) continue;
        const d = (y - top) / 20;
        const c = PAL.sand[clamp(Math.round(5 - d * 3 + (bayer(x + 3, y) - 0.5) * 1.3), 1, 6)];
        sandBuf.data[y * sandW + x] = c;
      }
    }
    main.add(new Prop({ ...bigFrame(r, sandBuf), ax: 0, ay: 0 }, 0, 205, -1));
    // wet shoreline foam
    main.add(new Custom(-1, (rr, s) => {
      for (let i = 0; i < 14; i++) {
        const x = 70 + i * 6 + Math.sin(s.time * 1.3 + i) * 3;
        rr.fxDraw(A.dot2, x, 236 + Math.sin(s.time * 1.3 + i * 0.7), 2, 0.5, 0, packColor(1, 1, 1, 0.8), 0.9, false);
      }
    }));

    const P = (name: string, x: number, z = 0, opts = {}) => main.add(new Prop(props[name], x, campGround(x) + 1, z, opts));
    // dock + rowboat
    main.add(new Prop(props.dock, 40, 229, 2));
    main.add(new Custom(1, (rr, s) => rr.draw(props.rowboat, 60, 238 + Math.sin(s.time * 1.2) * 0.8, 1, 1, Math.sin(s.time) * 0.02)));
    // radio station
    P('mast', 176, 1);
    P('radioTent', 214, 2);
    P('generator', 250, 3);
    P('crateS', 150, 4);
    // kitchen
    P('kitchen', 380, 2);
    P('barrelR', 332, 3);
    P('clothes', 442, 1);
    // campfire hub
    const fireX = 560;
    P('bench', fireX - 40, 3);
    P('bench', fireX + 42, 3);
    P('firepit', fireX, 6);
    main.add(new AnimProp(propAnims.flame, fireX, GY - 3, 7, 12, { emissive: 1 }));
    main.add(new AnimProp(propAnims.flame, fireX + 5, GY - 4, 7.1, 10, { emissive: 1, sx: 0.7, sy: 0.8 }));
    const fireLight = main.add(new LightSource(fireX, GY - 14, 150, [1, 0.58, 0.26], 1.3, 90, A.glow, 0.9, 0.15, 0.12));
    void fireLight;
    // lab
    P('lab', 730, 1);
    P('cork', 804, 3);
    P('table', 668, 4);
    main.add(new LightSource(730, GY - 12, 46, [1, 0.8, 0.5], 0.7, 91, null, 1, 0.03));
    // gear tent
    P('gear', 930, 1);
    P('crate', 980, 3);
    P('crate', 990, 3.1);
    P('crateS', 874, 3);
    // hammock between trees
    P('hammock', 1040, 2);
    // jeep area
    P('barrel', 1122, 2);
    P('barrel', 1134, 2.1);
    P('sign', 1190, 1);
    main.add(new Custom(4, (rr, s) => {
      const x = 1245, y = campGround(1245);
      rr.beginShadows();
      rr.draw(A.shadow, x, y, 3.4, 1.2, 0, packColor(0, 0, 0, 0.5));
      rr.endShadows();
      rr.draw(props.jeep, x, y - 5);
      const wf = propAnims.wheel;
      rr.draw(wf[0], x - 56 + 24, y - 11);
      rr.draw(wf[0], x - 56 + 88, y - 11);
      if (s.tod === 'night' || s.tod === 'dusk') {
        rr.light(x + 60, y - 22, 60, 1, 0.95, 0.8, 1.4);
        rr.fxDraw(A.glow, x + 48, y - 21, 0.4, 0.4, 0, packColor(1, 0.95, 0.8, 1), 2.5);
      }
    }));
    P('gate', 1350, 1);
    // lantern posts
    for (const lx of [300, 470, 650, 860, 1090]) {
      const post = props.lanternPost;
      main.add(new Prop(post, lx, campGround(lx) + 1, 5));
      main.add(new Custom(5.1, (rr, s) => {
        const sw = Math.sin(s.time * 1.5 + lx) * 0.08;
        rr.emissive(1);
        rr.draw(props.lantern, lx + 7, campGround(lx) - 39, 1, 1, sw);
        rr.emissive();
      }));
      main.add(new LightSource(lx + 7, campGround(lx) - 34, 64, [1, 0.78, 0.45], 0.6, 92, A.glow, 0.35, 0.05, 0));
    }
    // radio mast beacon
    main.add(new Custom(95, (rr, s) => {
      const on = Math.sin(s.time * 2.5) > 0.2;
      if (on) {
        rr.fxDraw(A.glow, 176, campGround(176) - 149, 0.25, 0.25, 0, packColor(1, 0.15, 0.1, 1), 3);
        rr.light(176, campGround(176) - 149, 30, 1, 0.1, 0.05, 1);
      }
    }));

    // NPCs
    const npc = (id: string, x: number, facing = -1, pace?: [number, number]) => {
      const n = main.add(new NPC(id, x, campGround(x) + 1, facing));
      if (pace) n.pace = pace;
      this.npcs[id] = n;
      return n;
    };
    npc('sid', 238, -1);
    npc('lou', 400, 1, [360, 420]);
    npc('imogen', 690, 1);
    npc('pip', 960, -1, [900, 990]);
    npc('bolt', 1180, 1);

    // player
    this.player = main.add(new Player(this.spawnX, campGround(this.spawnX), st.terrain));
    this.player.minX = 70;
    this.player.maxX = 1390;
    st.terrain.addGround(Array.from({ length: 144 }, (_, i) => [i * 10, campGround(i * 10)] as [number, number]));

    // foreground layer
    const fg = st.addLayer('fg', 1.35, 0, 1, 0);
    const fgSpan = layerSpan(st, 1.35, 120);
    for (let x = fgSpan.x0; x < fgSpan.x0 + fgSpan.w; x += rng.range(30, 90)) {
      const k = rng.next();
      let o;
      if (k < 0.5) o = F.paintGrassTuft(rng.int(1, 999), rng.range(14, 22), PAL.moss, 10);
      else if (k < 0.75) o = F.paintGroundFern(rng.int(1, 999), rng.range(16, 26), PAL.leafDeep);
      else o = F.paintBigLeaf(rng.int(1, 999), rng.range(40, 70), PAL.leafDeep);
      fg.add(new Prop(atlas.add('fg' + x, o.buf, o.ax, o.ay), x, 290 + rng.range(-6, 6), 0, { sway: 2 }));
    }

    // ambient particles: embers, smoke, fireflies, pollen
    main.add(new Custom(99, () => {}, (dt, s) => {
      const lp = main.particles, gp = main.glowParticles;
      if (rand.chance(dt * 9)) gp.spawn({ frame: A.dot, x: fireX + rand.range(-5, 5), y: GY - 8, vx: rand.range(-8, 8), vy: rand.range(-40, -20), ay: -6, life: rand.range(0.8, 1.8), color: [1, 0.6, 0.2], color1: [1, 0.25, 0.05], alpha: 1, alpha1: 0, glow: true, intensity: 3, wobble: 10, wobbleF: 5 });
      if (rand.chance(dt * 3)) lp.spawn({ frame: A.soft, x: fireX + rand.range(-3, 3), y: GY - 18, vx: rand.range(-3, 6), vy: -14, life: 3.5, size: 0.3, size1: 1.4, color: [0.5, 0.5, 0.55], alpha: 0.35, alpha1: 0, fadeIn: 0.2, wobble: 4 });
      if ((s.tod === 'night' || s.tod === 'dusk') && rand.chance(dt * 2)) gp.spawn({ frame: A.dot2, x: rand.range(s.cam.x - 250, s.cam.x + 250), y: rand.range(150, 215), life: rand.range(4, 7), color: [0.75, 1, 0.45], alpha: 1, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 2.5, wobble: 12, wobbleF: 1.5, lightR: 12 });
      if (s.tod === 'day' && rand.chance(dt * 2)) lp.spawn({ frame: A.dot, x: rand.range(s.cam.x - 250, s.cam.x + 250), y: rand.range(100, 210), vx: 6, life: 6, color: [1, 0.97, 0.8], alpha: 0.8, alpha1: 0, fadeIn: 0.3, wobble: 6 });
      if (rand.chance(dt * 0.4)) lp.spawn({ frame: rand.pick(A.leaves), x: s.cam.x + rand.range(-260, 260), y: 60, vy: 14, vx: 5, life: 12, floorY: GY, onFloor: 'die', flutter: 16, color: [1, 1, 1], alpha: 1, alpha1: 1 });
    }));

    this.setupInteractions();
    // HUD
    campHud(this);
    audio.setAmbience('camp', night);
    audio.setMusic(night ? 'night' : 'camp');
  }

  setupInteractions() {
    const I = this.interact;
    const talk = async (id: string, fn: () => Promise<void>) => {
      const n = this.npcs[id];
      n.talking = true;
      n.lookX = this.player.x;
      await fn();
      n.talking = false;
      n.lookX = null;
      campHud(this);
    };
    const n = this.npcs;
    I.push({ x: n.imogen.x, y: GY, w: 10, h: 22, label: 'Talk to Dr. Vance', standX: n.imogen.x + 22, action: () => talk('imogen', async () => {
      const t = vanceTalk();
      await game.ui.say(t.lines);
      t.after?.();
      game.persist();
    }) });
    I.push({ x: 730, y: GY, w: 26, h: 20, label: 'Field Guide (research desk)', standX: 730, action: () => openJournal() });
    I.push({ x: 804, y: GY, w: 12, h: 16, label: 'Photo board', standX: 790, action: () => openJournal('album') });
    I.push({ x: n.pip.x, y: GY, w: 10, h: 18, label: 'Pip’s gear workshop', standX: 915, action: () => talk('pip', async () => {
      if (!flag('metPip')) {
        await game.ui.say([
          { who: 'pip', text: 'Otis! You’re alive! Want to see what I built? Of course you do.', expr: 'happy' },
          { who: 'pip', text: 'Lures, camera traps, lenses, a ghillie poncho that makes you look like a fern. Pay me in *research points*.' },
          { who: 'pip', text: 'Good photos earn RP from Dr. Vance. Great photos earn more. Solve Field Guide facts for a big bonus!' },
        ]);
        setFlag('metPip');
      }
      openShop();
    }) });
    I.push({ x: 1245, y: GY, w: 46, h: 18, label: 'Take the jeep', standX: 1200, action: () => talk('bolt', async () => {
      if (game.save.chapter === 0) {
        await game.ui.say([{ who: 'bolt', text: 'Beatrice is gassed up and ready, boss. But you should check in with Dr. Vance first. She’s got that look.' }]);
        return;
      }
      if (!flag('metBolt')) {
        await game.ui.say([
          { who: 'bolt', text: 'This is Beatrice. Seventy years old, never once let me down. Well. Twice.', expr: 'happy' },
          { who: 'bolt', text: 'Pick a site and a time of day. Different critters come out at different hours.' },
        ]);
        setFlag('metBolt');
      }
      openMap();
    }) });
    I.push({ x: n.bolt.x, y: GY, w: 10, h: 22, label: 'Talk to Bolt', standX: n.bolt.x - 20, enabled: () => false, action: () => {} });
    I.push({ x: n.lou.x, y: GY, w: 10, h: 18, label: 'Mama Lou’s kitchen', standX: n.lou.x + 20, action: () => talk('lou', async () => {
      if (game.save.flags['ate']) {
        await game.ui.say([{ who: 'lou', text: 'You already ate, sugar. Go take some pictures and come back hungry.' }]);
        return;
      }
      const c = await game.ui.say([{ who: 'lou', text: 'Hungry? I’ve got three things and none of them are snake.', expr: 'happy', choices: LOU_MEALS.map(m => `${m.name} — <i>${m.desc}</i>`).concat(['Not right now']) }]);
      if (c >= 0 && c < LOU_MEALS.length) {
        const m = LOU_MEALS[c];
        game.save.flags['ate'] = true;
        game.save.flags['meal:' + m.id] = true;
        await game.ui.say([{ who: 'lou', text: m.line }]);
        game.ui.toast(`${m.name}: ${m.desc}`, 'MEAL', '', 3600);
        audio.play('coin');
        game.persist();
      }
    }) });
    I.push({ x: n.sid.x, y: GY, w: 10, h: 20, label: 'Sid’s radio shack', standX: n.sid.x + 22, action: () => talk('sid', async () => {
      await game.ui.say(sidRumor());
    }) });
    I.push({ x: 1040, y: GY, w: 20, h: 14, label: 'Rest in the hammock', standX: 1040, action: async () => {
      const order: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
      const next = order[(order.indexOf(this.tod) + 1) % 4];
      game.save.campTime = next;
      if (next === 'dawn') game.save.day++;
      game.persist();
      audio.play('whoosh');
      await game.go(() => new CampScene(next, 1040));
    } });
  }

  update(dt: number) {
    super.update(dt);
    if (game.input.hit('journal') && !game.ui.blocking) openJournal();
    void objective;
  }
}
