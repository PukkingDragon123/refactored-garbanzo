// Emerald Canopy: rope bridges between kauri giants forty metres above the forest floor.

import { game } from '../game';
import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { Prop, Custom } from '../../world/props';
import { addSky, addClouds, addFarImage, layerSpan } from '../../world/scenery';
import { addTrunkLayer, scatter, aid } from './kit';
import { local, A } from '../assets';
import * as F from '../../art/flora';
import * as L from '../../art/landscape';
import * as S from '../../art/sitesart';
import { PAL } from '../../art/palettes';
import { hex } from '../../art/color';
import { packColor } from '../../gfx/renderer';
import { timePreset } from '../../world/timeofday';
import { Rng, rand } from '../../core/math';
import { Skyribbon, LureViper } from '../wildlife/serpents';
import { GaleHawk } from '../wildlife/birds';
import { SailPossum, FlickerMarten } from '../wildlife/mammals';
import { Terrain } from '../../world/terrain';

const W = 2400;
const TRUNKS = [120, 560, 1000, 1440, 1880, 2320];
const BY = 195; // bridge level

export function bridgeY(x: number) {
  for (let i = 0; i < TRUNKS.length - 1; i++) {
    const a = TRUNKS[i] + 30, b = TRUNKS[i + 1] - 30;
    if (x > a && x < b) return BY + Math.sin(((x - a) / (b - a)) * Math.PI) * 12;
  }
  return BY;
}

export function buildCanopy(st: Stage, sc: ExpeditionScene): SiteContent {
  const r = game.r;
  const tod = st.tod;
  st.preset = timePreset(tod, { shade: 0.15, haze: [0.62, 0.8, 0.78], hazeK: 0.3 });
  st.minX = 0;
  st.maxX = W;
  st.minY = -140;
  st.maxY = 300;
  const rng = new Rng(202);
  addSky(st, r);
  addClouds(st, r, 0.03, 10, 120, 8, 21, 0.05);
  // sea of treetops far below
  addFarImage(st, r, 'tops0', 0.1, 0.55, w => L.paintTreeline(w, 120, { seed: 31, base: 100, amp: 18, ramp: ['#46705e', '#52806a', '#5f8f74', '#6f9f80'].map(h => hex(h)), rMin: 8, rMax: 15, fern: 0.4, emergent: 0.5 }), 180, 0, 0.1);
  const mist = st.addLayer('mist0', 0.15, 0.3, 0, 0.3);
  const ms = layerSpan(st, 0.15, 100);
  mist.add(new Prop({ ...local.add('mist0', L.paintMist(ms.w, 40, hex('#dfeee8'), 5, 0.8), 0, 0) }, ms.x0, 230));
  addFarImage(st, r, 'tops1', 0.25, 0.38, w => L.paintTreeline(w, 150, { seed: 32, base: 130, amp: 30, ramp: ['#284a40', '#30584a', '#3a6654', '#48765e'].map(h => hex(h)), rMin: 12, rMax: 24, fern: 0.2, emergent: 0.7 }), 170, 0, 0.25);
  addTrunkLayer(st, r, 'trunks', 0.5, 0.22, -150, 460, 33, ['#1f3a32', '#27463b', '#315345'], 0.35, [22, 34], { vines: 0.8 }, 0.25);
  const mist2 = st.addLayer('mist1', 0.6, 0.1, 0, 0.3);
  const ms2 = layerSpan(st, 0.6, 100);
  mist2.add(new Prop({ ...local.add('mist1', L.paintMist(ms2.w, 50, hex('#e8f4ee'), 8, 0.6), 0, 0) }, ms2.x0, 250));

  const main = st.addLayer('main', 1, 0, 1, 0);
  // giant trunks
  for (const tx of TRUNKS) {
    const o = S.paintGiantTrunk(tx, 38, 480);
    main.add(new Prop(local.add(aid('gt'), o.buf, o.ax, o.ay), tx, 340, -6));
  }
  // branches: upper (walkable via vines) and lower (for gliders)
  const upper: [number, number, number][] = [[560, 1, 170], [1000, -1, 190], [1440, 1, 180], [1880, -1, 160], [120, 1, 150]];
  const lower: [number, number, number][] = [[560, -1, 140], [1000, 1, 150], [1440, -1, 150], [1880, 1, 150]];
  const flowers: [number, number][] = [];
  const branchSurf = (x0: number, dir: number, len: number, y: number) => {
    const o = S.paintBranch(Math.round(x0 + y), len, 6, dir);
    main.add(new Prop(local.add(aid('br'), o.buf, o.ax, o.ay), x0 + dir * 16, y, -4));
    const pts: [number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push([x0 + dir * (16 + t * len), y - 6 - Math.sin(t * 2.2) * 3 + t * 4 + (1 - t * 0.55) * 0]);
    }
    if (dir < 0) pts.reverse();
    st.terrain.addPlatform(pts, 'branch');
    return pts;
  };
  const upperSurfs = upper.map(([x, d, len]) => ({ pts: branchSurf(x, d, len, 118), x, d, len }));
  lower.forEach(([x, d, len]) => branchSurf(x, d, len, 262));
  // vines from upper branches down to the bridges
  for (const u of upperSurfs) {
    const vx = u.x + u.d * (u.len * 0.55 + 16);
    st.terrain.addClimb(vx, 112, bridgeY(vx) - 1, 'vine');
    const o = F.paintVine(Math.round(vx), Math.ceil(bridgeY(vx) - 108));
    main.add(new Prop(local.add(aid('vine'), o.buf, o.ax, o.ay), vx, 110, 6, { sway: 0.5 }));
    // rata blossoms near the branch tip
    const fx = u.x + u.d * (u.len * 0.8 + 16);
    const fo = S.paintBranch(1, 1, 1);
    void fo;
    const rb = F.paintRata(Math.round(fx), 30, 18);
    main.add(new Prop(local.add(aid('rata'), rb, 15, 18), fx, 112, 7, { sway: 0.4 }));
    flowers.push([fx, 112]);
  }
  // bridge level (solid walk surface)
  const pts: [number, number][] = [];
  for (let x = 40; x <= W - 40; x += 6) pts.push([x, bridgeY(x)]);
  st.terrain.addGround(pts, 'bridge');
  // platforms + bridges drawing
  main.add(new Custom(20, (rr, s) => {
    const x0 = Math.max(40, rr.visibleX0(20)), x1 = Math.min(W - 40, rr.visibleX1(20));
    const sway = Math.sin(s.time * 0.8) * 0.6;
    for (let x = Math.floor(x0 / 4) * 4; x < x1; x += 4) {
      const onPlat = TRUNKS.some(t => Math.abs(x - t) < 30);
      const y = bridgeY(x) + (onPlat ? 0 : sway * Math.sin(((x % 440) / 440) * Math.PI));
      rr.rect(x, y, 3, 2, onPlat ? packColor(0.42, 0.3, 0.19, 1) : packColor(0.5, 0.36, 0.22, 1));
      rr.rect(x, y + 2, 3, 1, packColor(0.25, 0.17, 0.1, 1));
      if (!onPlat) {
        rr.rect(x, y - 13, 4, 1, packColor(0.62, 0.52, 0.34, 1));
        if (x % 12 === 0) rr.rect(x, y - 13, 1, 13, packColor(0.55, 0.45, 0.3, 1));
      } else if (x % 16 === 0) rr.rect(x, y + 3, 2, 10, packColor(0.3, 0.2, 0.12, 1));
    }
  }));
  // epiphyte clumps: hide spots on the bridges
  const hides = [340, 800, 1220, 1660, 2100].map(x => ({ x, w: 40, y: bridgeY(x), cover: 0.8 }));
  for (const h of hides) {
    const o = F.paintBush(rng.int(1, 999), 44, 26, PAL.leafTeal, rng.chance(0.5) ? PAL.flowerPink : undefined);
    main.add(new Prop(local.add(aid('epi'), o.buf, o.ax, o.ay), h.x, h.y + 1, 70, { sway: 0.5 }));
  }
  // hanging vines & leaves in the foreground
  const fg = st.addLayer('fg', 1.3, 0, 0.8);
  const fs = layerSpan(st, 1.3, 150);
  scatter(fg, fs.x0, fs.x0 + fs.w, [60, 150], 44, () => -60, (g) => F.paintVine(g.int(1, 999), g.range(80, 200), PAL.leafDeep), 0.8);
  scatter(fg, fs.x0, fs.x0 + fs.w, [90, 200], 45, () => 330, (g) => F.paintBigLeaf(g.int(1, 999), g.range(60, 90)), 2);
  // drifting petals / insects
  main.add(new Custom(99, () => {}, (dt, s) => {
    if (rand.chance(dt * 1.5)) main.particles.spawn({ frame: rand.pick(A.petals), x: s.cam.x + rand.range(-260, 260), y: s.cam.y - 150, vx: rand.range(-8, 8), vy: 12, life: 14, wobble: 20, wobbleF: 2.5, color: [1, 1, 1], alpha: 1, alpha1: 0.5 });
    if ((tod === 'night' || tod === 'dusk') && rand.chance(dt * 2)) main.glowParticles.spawn({ frame: A.dot2, x: s.cam.x + rand.range(-260, 260), y: s.cam.y + rand.range(-100, 100), life: rand.range(4, 7), color: [0.7, 1, 0.5], alpha: 1, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 2.4, wobble: 14, wobbleF: 1.4, lightR: 12 });
  }));
  const perches = TRUNKS.slice(1, -1).map(x => ({ x: x + 4, y: 20, kind: 'tree' as const }));
  // perch stubs on trunk tops
  for (const p of perches) main.add(new Custom(-3, rr => rr.rect(p.x - 8, p.y, 16, 3, packColor(0.35, 0.3, 0.26, 1))));
  const upAt = (i: number) => { const u = upperSurfs[i % upperSurfs.length]; const x = u.x + u.d * (40 + rand.next() * (u.len - 30)); return [x, Terrain.yAt({ pts: u.pts, oneWay: true, kind: 'branch' }, x) ?? 112] as [number, number]; };
  return {
    hides,
    clues: [{ id: 'scat-scales', x: 840, y: bridgeY(840) }, { id: 'shed-ribbon', x: upperSurfs[2].x + 100, y: 112 }],
    spawns: [
      { species: 'skyribbon', n: 3, times: ['dawn', 'day', 'dusk'], respawn: 30, make: (_c, i) => { const [x, y] = upAt(i + 1); return new Skyribbon(x, y - 3, rand.sign()); } },
      { species: 'galehawk', n: 1, times: ['dawn', 'day', 'dusk'], respawn: 60, make: () => new GaleHawk(1000, 20, perches) },
      { species: 'sailglider', n: 2, times: ['dusk', 'night', 'dawn'], respawn: 30, make: (_c, i) => { const [x, y] = upAt(i); return new SailPossum(x, y, flowers); } },
      { species: 'lurevip', n: 1, times: ['dusk', 'night'], make: () => { const [x, y] = upAt(3); return new LureViper(x, y - 3, -1); } },
      { species: 'flicker', n: 1, times: ['day', 'dawn'], respawn: 90, when: () => rand.chance(0.5), make: () => new FlickerMarten(1500, bridgeY(1500)) },
    ],
    jeepX: 70,
    spawnX: 150,
    waterY: null,
    camY: 150,
    followY: true,
    noJeep: true,
    exitLabel: 'Climb down to the jeep',
    ambience: 'canopy',
    music: 'explore',
    onUpdate: (s) => canopyStory(s),
  };
  void sc;
}

function canopyStory(sc: ExpeditionScene) {
  const s = game.save;
  if (s.flags.sawGlide) return;
  const glider = sc.creatures.find(c => c.id === 'skyribbon' && c.state === 'glide' && Math.abs(c.x - sc.player.x) < 220);
  if (glider) {
    s.flags.sawGlide = true;
    game.ui.say([{ who: 'otis', text: 'Did that snake just... *fly*? Record it! Video mode is *V* — if Pip sold me the video module.', expr: 'wow' }]);
  }
}
