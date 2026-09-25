// Fernwood Floor: the primeval forest floor under tree ferns and kauri giants.

import { game } from '../game';
import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { Prop, Custom } from '../../world/props';
import { addSky, addGroundStrip, layerSpan } from '../../world/scenery';
import { addTrunkLayer, addCanopyCeiling, addShafts, scatter, addGlowFungi, aid, Shaft } from './kit';
import { local, A } from '../assets';
import * as F from '../../art/flora';
import { PAL } from '../../art/palettes';
import { packColor } from '../../gfx/renderer';
import { timePreset } from '../../world/timeofday';
import { Rng, rand } from '../../core/math';
import { Strider, Sprinter } from '../wildlife/serpents';
import { Shieldback, Quillhog, Delver, FlickerMarten } from '../wildlife/mammals';

export const FW_W = 2200;
export function fernGround(x: number) {
  let y = 226 + Math.sin(x * 0.006) * 4 + Math.sin(x * 0.021) * 1.5;
  if (x > 1240 && x < 1440) y += Math.sin(((x - 1240) / 200) * Math.PI) * 18; // creek hollow
  return y;
}

export function buildFernwood(st: Stage, sc: ExpeditionScene): SiteContent {
  const r = game.r;
  const tod = st.tod;
  st.preset = timePreset(tod, { shade: 0.65, haze: [0.4, 0.62, 0.48], hazeK: 0.55 });
  st.minX = 0;
  st.maxX = FW_W;
  const night = tod === 'night';
  const rng = new Rng(101);
  addSky(st, r);
  addTrunkLayer(st, r, 'far', 0.12, 0.66, -10, 250, 1, ['#4f7a6a', '#5a8674', '#6a947e'], 2.4, [8, 16], { canopy: true, ferns: 0.6, vines: 0.4 });
  addTrunkLayer(st, r, 'far2', 0.28, 0.46, -10, 252, 2, ['#2f5446', '#386052', '#456d5a'], 1.6, [12, 22], { canopy: true, ferns: 0.8, vines: 0.5 });
  addTrunkLayer(st, r, 'mid1', 0.48, 0.26, -10, 250, 3, ['#1a3129', '#223d32', '#2c4b3c'], 1.1, [16, 30], { canopy: true, ferns: 1, vines: 0.6 }, 0.3);
  // mid props p .72: sprite tree ferns & kauri trunks
  const mid = st.addLayer('mid', 0.72, 0.1, 0.6);
  const ms = layerSpan(st, 0.72);
  scatter(mid, ms.x0, ms.x0 + ms.w, [45, 95], 11, () => 226, (g) => {
    const k = g.next();
    if (k < 0.5) return F.paintTreeFern(g.int(1, 9999), { height: g.range(90, 150), silver: g.chance(0.35) });
    if (k < 0.8) return F.paintTrunk({ width: g.range(20, 32), height: 260, seed: g.int(1, 999), bark: PAL.barkGrey, moss: 0.6, vines: g.int(0, 3), smooth: true });
    return F.paintBush(g.int(1, 999), g.int(40, 70), g.int(22, 36));
  }, 1);
  // canopy ceiling with gaps for light shafts
  const shaftXs = [330, 620, 980, 1180, 1600, 1980];
  addCanopyCeiling(st, r, 0.9, shaftXs, -30, 80);

  // ---------------------------------------------------------------- main
  const main = st.addLayer('main', 1, 0, 1, 0);
  addGroundStrip(main, r, 0, FW_W, 200, 80, fernGround, { top: PAL.moss, soil: PAL.soil, stones: PAL.stone.slice(2), roots: true, litter: [PAL.bark[4], PAL.bark[5], PAL.leafOlive[3], PAL.canvasOrange[2]] }, -3, 5);
  st.terrain.addGround(Array.from({ length: FW_W / 8 + 1 }, (_, i) => [i * 8, fernGround(i * 8)] as [number, number]));
  // creek
  const wy = 236;
  st.waterY = null;
  main.add(new Custom(-2, rr => {
    rr.water(0.8, 1.2, 0.8);
    rr.rect(1252, wy, 176, 20, packColor(0.12, 0.22, 0.2, 1));
    rr.water(0);
  }));
  for (const [x, y] of [[1290, 234], [1330, 236], [1372, 234], [1410, 232]] as [number, number][]) {
    const o = F.paintRock(rng.int(1, 999), 16, 9, PAL.stone, 0.6);
    main.add(new Prop(local.add(aid('stone'), o.buf, o.ax, o.ay), x, y + 3, 1));
    st.terrain.addPlatform([[x - 7, y - 4], [x + 7, y - 4]], 'rock');
  }
  // bridge the gaps between stones so walking across is smooth
  st.terrain.addPlatform([[1240, fernGround(1240)], [1283, 230], [1297, 230], [1323, 232], [1337, 232], [1365, 230], [1379, 230], [1403, 228], [1440, fernGround(1440)]], 'rock');
  // fallen mossy log (platform)
  const log = F.paintLog(7, 110, 8);
  main.add(new Prop(local.add('fwlog', log.buf, log.ax, log.ay), 640, fernGround(640) + 3, 5));
  st.terrain.addPlatform([[588, fernGround(588) - 12], [692, fernGround(692) - 14]], 'root');
  // background props on main (behind player)
  scatter(main, 20, FW_W, [60, 140], 12, fernGround, (g, x) => {
    if (x > 1230 && x < 1450) return null;
    const k = g.next();
    if (k < 0.35) return F.paintTreeFern(g.int(1, 9999), { height: g.range(60, 110), silver: g.chance(0.3) });
    if (k < 0.55) return F.paintRock(g.int(1, 999), g.int(18, 34), g.int(12, 20));
    if (k < 0.85) return F.paintGroundFern(g.int(1, 999), g.range(14, 22));
    return F.paintFlowerClump(g.int(1, 99), g.chance(0.5) ? PAL.flowerGold : PAL.flowerViolet);
  }, 1, -1);
  // hide bushes (in front of the player)
  const hides = [420, 780, 1100, 1560, 1900].map(x => ({ x, w: 44, y: fernGround(x), cover: 0.85 }));
  for (const h of hides) {
    const o = F.paintBush(rng.int(1, 999), 52, 30, rng.chance(0.5) ? PAL.leafDeep : PAL.leafTeal, rng.chance(0.3) ? PAL.flowerPink : undefined);
    main.add(new Prop(local.add(aid('hide'), o.buf, o.ax, o.ay), h.x, h.y + 2, 70, { sway: 0.6 }));
  }
  // burrows for delvers
  const holes = [930, 985, 1040];
  for (const hx of holes) main.add(new Custom(2, rr => {
    rr.rect(hx - 5, fernGround(hx) - 1, 10, 3, packColor(0.05, 0.03, 0.02, 1));
    rr.rect(hx - 7, fernGround(hx) - 2, 14, 1, packColor(0.35, 0.25, 0.16, 1));
  }));
  // shafts
  const shafts: Shaft[] = shaftXs.map((x, i) => ({ x: x + 20, w: rng.range(30, 54), a: -0.18 + rng.range(-0.05, 0.05), phase: i * 1.7 }));
  const sunK = tod === 'day' ? 1 : tod === 'dawn' || tod === 'dusk' ? 0.8 : 0;
  const shCol: [number, number, number] = tod === 'day' ? [1, 0.95, 0.75] : tod === 'dusk' ? [1, 0.7, 0.4] : [1, 0.8, 0.7];
  if (sunK > 0) addShafts(st, main, shafts, shCol, -30, 300, sunK);
  // night fungi & fireflies
  addGlowFungi(main, [[210, 0], [505, 0], [870, 0], [1160, 0], [1480, 0], [1730, 0], [2050, 0]].map(([x]) => [x, fernGround(x)]), night);
  main.add(new Custom(99, () => {}, (dt, s) => {
    const cx = s.cam.x;
    if ((night || tod === 'dusk') && rand.chance(dt * 3)) main.glowParticles.spawn({ frame: A.dot2, x: cx + rand.range(-260, 260), y: rand.range(120, 220), life: rand.range(4, 8), color: [0.7, 1, 0.4], alpha: 1, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 2.6, wobble: 14, wobbleF: 1.4, lightR: 14 });
    if (rand.chance(dt * 0.8)) main.particles.spawn({ frame: rand.pick(A.leaves), x: cx + rand.range(-260, 260), y: 20, vy: 12, vx: 4, life: 16, floorY: fernGround(cx), onFloor: 'stop', flutter: 18, color: [1, 1, 1], alpha: 1, alpha1: 0.6 });
    if (!night && rand.chance(dt * 0.3)) main.particles.spawn({ frame: rand.pick(A.petals), x: cx + rand.range(-200, 200), y: 150, vx: rand.range(-10, 10), vy: -4, life: 7, wobble: 18, wobbleF: 3, color: [1, 1, 1], alpha: 1, alpha1: 0 });
  }));
  // foreground
  const fg = st.addLayer('fg', 1.32, 0, 0.8);
  const fs = layerSpan(st, 1.32, 150);
  scatter(fg, fs.x0, fs.x0 + fs.w, [50, 120], 13, () => 300, (g) => {
    const k = g.next();
    if (k < 0.45) return F.paintBigLeaf(g.int(1, 999), g.range(50, 85));
    if (k < 0.75) return F.paintGroundFern(g.int(1, 999), g.range(22, 32), PAL.leafDeep);
    return F.paintGrassTuft(g.int(1, 99), g.range(18, 28), PAL.leafDeep, 10);
  }, 2.2);

  const G = (x: number) => fernGround(x);
  return {
    hides,
    clues: [{ id: 'grub-shells', x: 520, y: G(520) }, { id: 'burrow', x: 1000, y: G(1000) }, { id: 'fur-tuft', x: 1650, y: G(1650) }, { id: 'scute', x: 1830, y: G(1830) }],
    spawns: [
      { species: 'strider', n: 3, times: ['dawn', 'day', 'dusk'], respawn: 25, make: (_c, i) => { const x = [700, 1150, 1700, 400][i % 4] + rand.range(-60, 60); return new Strider(x, G(x) - 4, rand.sign()); } },
      { species: 'shieldback', n: 2, times: ['dawn', 'day', 'dusk'], respawn: 30, make: (_c, i) => new Shieldback([560, 1500, 1950][i % 3] + rand.range(-40, 40), 0) },
      { species: 'delver', n: 2, times: ['dawn', 'day', 'dusk'], make: (_c, i) => new Delver(holes[i % 3], G(holes[i % 3]), holes) },
      { species: 'quillhog', n: 2, times: ['dusk', 'night'], respawn: 30, make: (_c, i) => new Quillhog([820, 1600, 2000][i % 3] + rand.range(-40, 40), 0) },
      { species: 'sprinter', n: 1, times: ['dusk', 'night'], respawn: 45, make: () => { const x = rand.chance(0.5) ? 1500 : 900; return new Sprinter(x, G(x) - 16, rand.sign()); } },
      { species: 'flicker', n: 1, times: ['dawn', 'day', 'dusk'], respawn: 60, when: () => rand.chance(0.6), make: () => new FlickerMarten(rand.chance(0.5) ? 1700 : 300, 0) },
    ],
    shafts: sunK > 0 ? shafts : [],
    jeepX: 110,
    spawnX: 190,
    waterY: null,
    camY: 135,
    ambience: 'forest',
    music: 'explore',
    onEnter: (s) => { void s; if (game.save.chapter === 1 && !game.save.flags.fwTut) { game.save.flags.fwTut = true; tutorial(); } },
  } satisfies SiteContent;
  void sc;
}

async function tutorial() {
  await new Promise(r => setTimeout(r, 1200));
  await game.ui.say([
    { who: 'otis', text: 'Okay, Otis. Camera ready. Hold *right mouse* (or press *Q*) to raise it, *click* to shoot, *scroll* to zoom.' },
    { who: 'otis', text: 'Animals spook if they spot me. *Crouch* with S, and press S by a bush to *hide* in it. Running is loud.' },
    { who: 'otis', text: 'A photo of an animal *doing* something is evidence. And I’ve got lures: pick one with *1-5*, drop it with *F*.' },
  ]);
}
