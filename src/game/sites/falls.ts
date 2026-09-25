// Thunder Falls: a plunge pool beneath sheer cliffs where the birds nest out of the vipers' reach.

import { game } from '../game';
import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { Prop, Custom } from '../../world/props';
import { addSky, addClouds, addFarImage, addGroundStrip, layerSpan } from '../../world/scenery';
import { scatter, aid, addGlowFungi } from './kit';
import { local, A } from '../assets';
import { bigFrame } from '../../gfx/atlas';
import * as F from '../../art/flora';
import * as L from '../../art/landscape';
import * as S from '../../art/sitesart';
import { PAL } from '../../art/palettes';
import { hex } from '../../art/color';
import { packColor } from '../../gfx/renderer';
import { timePreset } from '../../world/timeofday';
import { Rng, rand } from '../../core/math';
import { Strider, CragViper } from '../wildlife/serpents';
import { CragAuk, TorrentDipper, GaleHawk } from '../wildlife/birds';
import { Shieldback, Delver } from '../wildlife/mammals';
import { setFlag } from '../story';

const W = 1800;
const WY = 236;
const FX0 = 1130, FX1 = 1226;

export function fallsGround(x: number) {
  if (x < 860) return 224 + Math.sin(x * 0.01) * 3 + Math.sin(x * 0.037) * 1.2;
  if (x > 1440) return 228;
  return 250; // pool bed
}

export function buildFalls(st: Stage, sc: ExpeditionScene): SiteContent {
  const r = game.r;
  const tod = st.tod;
  st.preset = timePreset(tod, { shade: 0.2, haze: [0.7, 0.84, 0.86], hazeK: 0.3 });
  st.minX = 0;
  st.maxX = W;
  st.waterY = WY;
  const rng = new Rng(303);
  addSky(st, r);
  addClouds(st, r, 0.03, 10, 100, 6, 41);
  addFarImage(st, r, 'mtn', 0.08, 0.45, w => L.paintRidge(w, 140, { seed: 12, base: 138, amp: 90, freq: 0.012, body: hex('#58698c'), lit: hex('#7a8aac'), shadow: hex('#435070'), snow: hex('#e6ecf4'), snowLine: 45, fogTo: hex('#94a6c0'), fogStart: 90, sharp: 0.8 }), 40);
  // distant waterfall ribbon in the hills
  const hills = addFarImage(st, r, 'hills', 0.22, 0.34, w => {
    const b = L.paintRidge(w, 160, { seed: 13, base: 158, amp: 70, freq: 0.008, body: hex('#3a5c52'), lit: hex('#4c7062'), shadow: hex('#2c4a42'), fogTo: hex('#6f8f86'), fogStart: 120, sharp: 0.4, gullies: 0.6 });
    for (let y = 30; y < 150; y++) for (let k = 0; k < 3; k++) b.set(w * 0.62 + k + Math.sin(y * 0.1) * 0.5, y, k === 1 ? hex('#e8f6f4') : hex('#b8d8d8'));
    return b;
  }, 70);
  void hills;
  addFarImage(st, r, 'trees', 0.4, 0.2, w => L.paintTreeline(w, 150, { seed: 14, base: 130, amp: 20, ramp: ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'].map(h => hex(h)), rMin: 10, rMax: 18, fern: 0.8, emergent: 0.3 }), 96);
  const mid = st.addLayer('mid', 0.7, 0.08, 0.5);
  const ms = layerSpan(st, 0.7);
  scatter(mid, ms.x0, ms.x0 + ms.w * 0.55, [50, 100], 15, () => 226, g => (g.chance(0.6) ? F.paintTreeFern(g.int(1, 999), { height: g.range(70, 120), silver: g.chance(0.4) }) : F.paintNikau(g.int(1, 999), g.range(70, 110))), 1);

  const main = st.addLayer('main', 1, 0, 1, 0);
  // cliff massif with the waterfall notch
  const cliffW = W - 1060, cliffH = 280;
  const ledges = [70, 112, 150];
  const cliff = S.paintCliff(9, cliffW, cliffH, PAL.stoneWarm, ledges.map(l => l + 40), true);
  // carve the waterfall channel darker + the hollow behind the curtain
  for (let y = 0; y < cliffH; y++) for (let x = FX0 - 1060; x < FX1 - 1060; x++) if (cliff.opaque(x, y)) cliff.set(x, y, y > 170 + 40 ? hex('#1a1612') : hex('#2d2620'));
  main.add(new Prop({ ...bigFrame(r, cliff), ax: 0, ay: 0 }, 1060, -40, -8));
  // ground: shore on the left, pool bed, ledge on the right
  addGroundStrip(main, r, 0, 880, 200, 80, fallsGround, { top: PAL.moss, soil: PAL.stoneWarm, stones: PAL.stone.slice(2), litter: [PAL.moss[5], PAL.stone[5]] }, -3, 9);
  addGroundStrip(main, r, 1430, W - 1430, 200, 80, fallsGround, { top: PAL.moss, soil: PAL.stoneWarm, stones: PAL.stone.slice(2) }, -3, 10);
  main.add(new Custom(-2, rr => {
    rr.water(0.75, 2.2, 1);
    rr.rect(850, WY, 600, 50, packColor(0.1, 0.26, 0.3, 1));
    rr.water(0);
  }));
  st.terrain.addGround([[0, fallsGround(0)], ...Array.from({ length: 110 }, (_, i) => [i * 8, fallsGround(i * 8)] as [number, number]), [870, 232], [900, 236]]);
  st.terrain.addGround([[1430, 232], [1440, 228], [W, 228]]);
  // stepping stones across the pool (and the path behind the falls)
  const stones: [number, number][] = [[930, 232], [985, 231], [1040, 232], [1095, 230], [1270, 231], [1330, 232], [1390, 231]];
  for (const [x, y] of stones) {
    const o = F.paintRock(rng.int(1, 999), 22, 12, PAL.stone, 0.5);
    main.add(new Prop(local.add(aid('st'), o.buf, o.ax, o.ay), x, y + 5, 1));
  }
  st.terrain.addGround([[900, 236], [930, 227], [985, 226], [1040, 227], [1095, 225], [1140, 206], [1220, 206], [1270, 226], [1330, 227], [1390, 226], [1430, 232]], 'rock');
  // path behind the curtain
  main.add(new Custom(-1, rr => { rr.rect(1128, 206, 100, 6, packColor(0.25, 0.22, 0.18, 1)); rr.rect(1128, 206, 100, 1, packColor(0.45, 0.42, 0.36, 1)); }));
  // the waterfall: scrolling tileable texture
  const fallsTex = bigFrame(r, S.paintFallsTex(FX1 - FX0, 128));
  main.add(new Custom(80, (rr, s) => {
    const h = 128;
    const off = (s.time * 150) % h;
    rr.emissive(0.18);
    for (let y = -40 - off; y < WY; y += h) {
      const top = Math.max(y, -40), bot = Math.min(y + h, WY);
      if (bot <= top) continue;
      rr.drawSub(fallsTex, 0, top - y, FX1 - FX0, bot - top, FX0, top, 1, 1, packColor(1, 1, 1, 0.86));
    }
    rr.emissive();
    // churning foam
    for (let i = 0; i < 18; i++) {
      const x = FX0 - 10 + ((i * 37 + s.time * 40) % (FX1 - FX0 + 20));
      rr.fxDraw(A.soft, x, WY - 2 + Math.sin(s.time * 6 + i) * 2, 0.7, 0.35, 0, packColor(0.95, 1, 1, 0.8), 1, false);
    }
    // rainbow in the spray
    if (s.tod !== 'night') {
      const cols: [number, number, number][] = [[1, 0.3, 0.3], [1, 0.65, 0.3], [1, 1, 0.4], [0.4, 1, 0.5], [0.4, 0.7, 1], [0.6, 0.45, 1]];
      cols.forEach((c, k) => {
        for (let a = 0.25; a < 1.35; a += 0.06) {
          const rad = 90 - k * 2.2;
          rr.fxDraw(A.dot2, 1180 + Math.cos(Math.PI - a * 1.7) * rad * 1.3, WY - 20 - Math.sin(a * 1.7) * rad * 0.9, 1.2, 1.2, 0, packColor(c[0], c[1], c[2], 1), s.tod === 'day' ? 0.12 : 0.08);
        }
      });
    }
  }, (dt, s) => {
    const gp = main.particles;
    for (let i = 0; i < 3; i++) if (rand.chance(dt * 25)) gp.spawn({ frame: A.soft, x: rand.range(FX0 - 20, FX1 + 20), y: WY - 4, vx: rand.range(-30, 30), vy: rand.range(-40, -10), life: rand.range(1.5, 3), size: 0.3, size1: 1.6, color: [0.9, 0.97, 1], alpha: 0.35, alpha1: 0, drag: 0.8 });
    if (rand.chance(dt * 20)) gp.spawn({ frame: A.dot, x: rand.range(FX0, FX1), y: WY - 2, vx: rand.range(-50, 50), vy: rand.range(-110, -50), ay: 260, life: 1, color: [0.9, 1, 1], alpha: 1, alpha1: 0 });
    void s;
  }));
  // giant shed skin draped over the rocks
  if (!game.save.clues['giant-skin']) {
    const o = S.paintGiantSkin(190);
    main.add(new Prop(local.add('skin', o.buf, o.ax, o.ay), 560, fallsGround(560) + 4, 4));
  }
  // shore vegetation and hides
  scatter(main, 20, 840, [60, 130], 16, fallsGround, g => (g.chance(0.4) ? F.paintRock(g.int(1, 999), g.int(20, 36), g.int(12, 22)) : g.chance(0.5) ? F.paintGroundFern(g.int(1, 999), g.range(14, 22)) : F.paintGrassTuft(g.int(1, 99), 12)), 1, -1);
  const hides = [300, 760, 1520].map(x => ({ x, w: 44, y: fallsGround(x), cover: 0.85 }));
  for (const h of hides) {
    const o = F.paintBush(rng.int(1, 999), 50, 28, PAL.leafTeal);
    main.add(new Prop(local.add(aid('hide'), o.buf, o.ax, o.ay), h.x, h.y + 2, 70, { sway: 0.6 }));
  }
  const holes = [420, 470];
  for (const hx of holes) main.add(new Custom(2, rr => rr.rect(hx - 5, fallsGround(hx) - 1, 10, 3, packColor(0.05, 0.03, 0.02, 1))));
  addGlowFungi(main, [[200, fallsGround(200)], [640, fallsGround(640)], [1600, 228]], tod === 'night');
  const fg = st.addLayer('fg', 1.3, 0, 0.8);
  const fs = layerSpan(st, 1.3, 150);
  scatter(fg, fs.x0, fs.x0 + fs.w, [70, 160], 17, () => 300, g => (g.chance(0.5) ? F.paintBigLeaf(g.int(1, 999), g.range(50, 80)) : F.paintGroundFern(g.int(1, 999), 26, PAL.leafDeep)), 2);

  const ledgePerches = ledges.flatMap((ly, i) => [0, 1, 2].map(k => ({ x: 1480 + k * 90 + i * 25, y: ly, kind: 'ledge' as const })));
  const dipperPerches = [{ x: 1095, y: 225 }, { x: 1270, y: 226 }, { x: 1040, y: 227 }, { x: 1330, y: 227 }];
  const path: [number, number][] = [[1470, 226], [1500, 200], [1470, 175], [1510, 150], [1545, 128], [1560, 112]];
  return {
    hides,
    clues: [{ id: 'giant-skin', x: 660, y: fallsGround(660) }, { id: 'eggshell', x: 1600, y: 228 }, { id: 'falls-nest', x: 1178, y: 206 }],
    spawns: [
      { species: 'cragauk', n: 5, times: ['dawn', 'day', 'dusk'], make: (_c, i) => { const p = ledgePerches[(i * 2) % ledgePerches.length]; return new CragAuk(p.x, p.y, ledgePerches, p); } },
      { species: 'torrentdipper', n: 2, times: ['dawn', 'day'], respawn: 40, make: () => new TorrentDipper(1095, 225, dipperPerches) },
      { species: 'cragviper', n: 1, times: ['day', 'dusk'], respawn: 50, make: () => new CragViper(1470, 226, path) },
      { species: 'galehawk', n: 1, times: ['dawn', 'day'], when: () => rand.chance(0.5), make: () => new GaleHawk(1600, 60, [{ x: 1700, y: 70 }]) },
      { species: 'strider', n: 2, times: ['dawn', 'day', 'dusk'], respawn: 40, make: (_c, i) => { const x = [250, 700][i % 2]; return new Strider(x, fallsGround(x) - 4, rand.sign()); } },
      { species: 'shieldback', n: 1, times: ['dawn', 'day', 'dusk'], make: () => new Shieldback(520, 0) },
      { species: 'delver', n: 1, times: ['dawn', 'day', 'dusk'], make: () => new Delver(holes[0], fallsGround(holes[0]), holes) },
    ],
    jeepX: 90,
    spawnX: 170,
    waterY: WY,
    camY: 135,
    ambience: 'falls',
    music: 'explore',
    onClue: async (s, id) => {
      if (id === 'giant-skin') {
        setFlag('foundSkin');
        s.cutscene = true;
        game.ui.letterbox(true);
        s.st.shake(1, 0.5);
        await game.ui.say([
          { who: 'otis', text: 'This is a shed skin. A *snake* skin.', expr: 'wow' },
          { who: 'otis', text: 'It’s... it goes on and on. The scales are the size of my hand. Whatever wore this is fifteen metres long.', expr: 'worried' },
          { who: 'otis', text: 'And it’s fresh. The trail leads south, toward the mangroves. I need to show Dr. Vance. *Right now.*', expr: 'worried' },
        ]);
        game.ui.letterbox(false);
        s.cutscene = false;
      }
    },
  };
  void sc;
}
