import { showGallery, GalleryItem } from './gallery';
import * as F from '../art/flora';
import * as L from '../art/landscape';
import { PAL } from '../art/palettes';
import { hex } from '../art/color';
import * as K from '../art/camp';
import * as CH from '../art/characters';
import * as FA from '../art/fauna';
import { SerpentPainter } from '../art/serpent';
import { PixelBuffer } from '../art/pixel';

/** ?gallery=camp4: the island camp props (east-lit, west-lit, and a calm and a gusting wind frame) on sand. */
async function camp4Gallery() {
  const [CA, CV] = await Promise.all([import('../art/island4/camp'), import('../game/v10/campart')]);
  const items: GalleryItem[] = [];
  const t0 = performance.now();
  const add = (n: string, s: import('../art/island4/campkit').CampSprite) => {
    items.push({ name: n, buf: s.buf });
    if (s.alt) items.push({ name: n + ' W', buf: s.alt.buf });
    if (s.wind) items.push({ name: n + ' w3', buf: s.wind[3] });
    if (s.gust) items.push({ name: n + ' g2', buf: s.gust[2] });
  };
  add('tarpTent', CV.tarpTent()); add('dome', CA.domeTent()); add('leanTo', CA.leanTo()); add('fire', CA.firePit(false));
  add('cook', CA.cookBench()); add('rack', CA.dryingRack()); add('research', CA.researchTable()); add('storage', CA.storage());
  add('salvage', CA.storage(1)); add('chunkBed', CA.chunkBed()); add('elec', CA.electronics()); add('log', CA.logBench(40));
  add('wood', CA.woodPile(3)); add('lantern', CA.lantern()); add('pole', CA.pole(52)); add('bedroll', CA.bedroll());
  add('tech', CV.techBench()); add('board', CV.campBoard()); add('sign', CV.trailSign()); add('rock', CV.fishRock());
  add('rod', CV.rodInRock()); add('pot', CV.pot()); add('target', CV.target());
  items.push({ name: 'hanglantern', buf: CV.hangingLantern().buf });
  CV.signalFlags().frames.forEach((f, i) => items.push({ name: 'flag' + i, buf: f[1] }));
  const ms = performance.now() - t0;
  showGallery(items, 3, '#cdb98e');
  const note = document.createElement('div');
  note.textContent = `painted in ${ms.toFixed(0)} ms`;
  document.body.prepend(note);
}

/** ?gallery=icons: every item, skill and UI icon at 1x / 2x / 3x on the leather inventory tile. */
async function iconGallery() {
  const [{ installSkin }, I] = await Promise.all([import('../ui/skin'), import('../art/itemicons')]);
  installSkin();
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#2a1a10;font:11px monospace;color:#f2e4bc;display:flex;flex-wrap:wrap;gap:10px;padding:12px;align-items:flex-end';
  const sets: [string, string[], (id: string) => PixelBuffer, (id: string, s: number) => string][] = [
    ['item', I.ICON_IDS.items(), I.itemIcon, I.itemIconURL],
    ['skill', I.ICON_IDS.skills(), I.skillIcon, I.skillIconURL],
    ['ui', I.ICON_IDS.ui(), I.uiIcon, I.uiIconURL],
  ];
  for (const [kind, ids, buf, url] of sets)
    for (const id of ids) {
      const w = buf(id).w;
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;gap:3px;align-items:flex-start';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;align-items:center';
      for (const k of [1, 2, 3]) {
        const tile = document.createElement('div');
        const px = w * k;
        tile.style.cssText = `width:${Math.round(px * 1.42)}px;height:${Math.round(px * 1.42)}px;display:grid;place-items:center;background:var(--sk-slot) center/100% 100% no-repeat;image-rendering:pixelated`;
        const img = document.createElement('img');
        img.src = url(id, (k * w) / 16);
        img.style.cssText = `width:${px}px;height:${px}px;image-rendering:pixelated`;
        tile.appendChild(img);
        row.appendChild(tile);
      }
      const l = document.createElement('div');
      l.textContent = `${kind}:${id} ${w}px`;
      card.append(row, l);
      document.body.appendChild(card);
    }
}

export function runGallery(name: string) {
  if (name === 'icons') { void iconGallery(); return; }
  if (name === 'camp4') { void camp4Gallery(); return; }
  if (name === 'aroha' || name === 'combat') { void import('./arohagallery').then(m => m.runArohaGallery(name)); return; }
  const items: GalleryItem[] = [];
  if (name === 'flora') {
    items.push({ name: 'treefern', buf: F.paintTreeFern(3, { height: 90 }).buf });
    items.push({ name: 'treefern-silver', buf: F.paintTreeFern(7, { height: 60, silver: true }).buf });
    items.push({ name: 'nikau', buf: F.paintNikau(5, 80).buf });
    items.push({ name: 'kauri', buf: F.paintKauri(9, 200, 18).buf });
    items.push({ name: 'groundfern', buf: F.paintGroundFern(11, 16).buf });
    items.push({ name: 'bush', buf: F.paintBush(12, 50, 30).buf });
    items.push({ name: 'bush-fl', buf: F.paintBush(13, 40, 26, PAL.leafTeal, PAL.flowerPink).buf });
    items.push({ name: 'grass', buf: F.paintGrassTuft(14, 10).buf });
    items.push({ name: 'flowers', buf: F.paintFlowerClump(15, PAL.flowerGold).buf });
    items.push({ name: 'mush', buf: F.paintMushrooms(16).buf });
    items.push({ name: 'mush-glow', buf: F.paintMushrooms(17, true).buf });
    items.push({ name: 'rock', buf: F.paintRock(18, 30, 20).buf });
    items.push({ name: 'log', buf: F.paintLog(19, 70, 7).buf });
    items.push({ name: 'vine', buf: F.paintVine(20, 80).buf });
    items.push({ name: 'mangrove', buf: F.paintMangrove(21, 90, 100).buf });
    items.push({ name: 'bigleaf', buf: F.paintBigLeaf(22, 60).buf });
    items.push({ name: 'crown', buf: F.paintCrown(23, 110, 60) });
    items.push({ name: 'rata', buf: F.paintRata(24, 30, 20) });
    items.push({ name: 'trunk', buf: F.paintTrunk({ width: 22, height: 120, seed: 4, bark: PAL.bark, moss: 0.6, vines: 2 }).buf });
  } else if (name === 'land') {
    items.push({ name: 'sky', buf: L.paintSky(240, 135, [{ t: 0, c: hex('#23305e') }, { t: 0.55, c: hex('#c9707a') }, { t: 1, c: hex('#ffcf8f') }], 20, { x: 170, y: 120, r: 80, c: hex('#fff0c0'), k: 0.9 }) });
    items.push({ name: 'cloud', buf: L.paintCloud(3, 80, 30, [hex('#6a5a8a'), hex('#a0789a'), hex('#e0a0a0'), hex('#ffd0b0')]) });
    items.push({ name: 'streak', buf: L.paintStreak(4, 120, 6, hex('#d88a8a'), hex('#ffc0a0')) });
    items.push({ name: 'sun', buf: L.paintSun(10, hex('#fff6d8'), hex('#ffd27a')) });
    items.push({ name: 'moon', buf: L.paintMoon(9, hex('#e8ecf0'), hex('#b8c0cc'), hex('#8890a0')) });
    items.push({ name: 'ridge', buf: L.paintRidge(300, 90, { seed: 5, base: 85, amp: 60, freq: 0.012, body: hex('#5a6a8a'), lit: hex('#7a88a6'), shadow: hex('#46526e'), snow: hex('#e0e8f0'), snowLine: 40, fogTo: hex('#9aa8c0'), fogStart: 55, peaks: [{ x: 200, h: 80, w: 60, cone: true }] }) });
    items.push({ name: 'treeline', buf: L.paintTreeline(300, 70, { seed: 6, base: 60, amp: 14, ramp: [hex('#1d3b3a'), hex('#264c46'), hex('#305e52'), hex('#3d6f5c')], rMin: 5, rMax: 11, fern: 0.6, emergent: 0.4, palms: 0.3 }) });
    items.push({ name: 'mist', buf: L.paintMist(300, 30, hex('#cfe0dc'), 3) });
    items.push({ name: 'aurora', buf: L.paintAurora(300, 90, 2) });
  }
  if (name === 'camp') {
    items.push({ name: 'lab', buf: K.paintLabTent().buf });
    items.push({ name: 'gear', buf: K.paintGearTent().buf });
    items.push({ name: 'radio', buf: K.paintRadioTent().buf });
    items.push({ name: 'mast', buf: K.paintRadioMast(120).buf });
    items.push({ name: 'jeep', buf: K.paintJeep().buf });
    K.paintWheels().forEach((w, i) => items.push({ name: 'wheel' + i, buf: w }));
    items.push({ name: 'crate', buf: K.paintCrate().buf });
    items.push({ name: 'barrel', buf: K.paintBarrel().buf });
    items.push({ name: 'bench', buf: K.paintBench().buf });
    items.push({ name: 'firepit', buf: K.paintFirePit().buf });
    K.paintFlames().forEach((w, i) => items.push({ name: 'flame' + i, buf: w }));
    items.push({ name: 'lantern', buf: K.paintLantern() });
    items.push({ name: 'kitchen', buf: K.paintKitchen().buf });
    items.push({ name: 'sign', buf: K.paintSignpost().buf });
    items.push({ name: 'cork', buf: K.paintCorkboard().buf });
    items.push({ name: 'hammock', buf: K.paintHammock().buf });
    items.push({ name: 'dock', buf: K.paintDock().buf });
    items.push({ name: 'boat', buf: K.paintRowboat().buf });
    items.push({ name: 'ship', buf: K.paintShip(150).buf });
    items.push({ name: 'clothes', buf: K.paintClothesline().buf });
    items.push({ name: 'gate', buf: K.paintGate().buf });
    items.push({ name: 'gen', buf: K.paintGenerator().buf });
    items.push({ name: 'table', buf: K.paintTable().buf });
  }
  if (name === 'chars') {
    for (const id of Object.keys(CH.CREW)) {
      const sp = CH.CREW[id];
      items.push({ name: id, buf: CH.drawCharacter(sp, CH.idlePose(0)) });
      for (let i = 0; i < 4; i++) items.push({ name: id + ' w' + i, buf: CH.drawCharacter(sp, CH.walkPose(i / 4)) });
      if (id === 'otis') {
        const p = CH.basePose(); p.camera = 'raised';
        items.push({ name: 'otis cam', buf: CH.drawCharacter(sp, p) });
        const c = CH.basePose(); c.crouch = 1;
        items.push({ name: 'otis crouch', buf: CH.drawCharacter(sp, c) });
      }
    }
  }
  if (name === 'fauna') {
    for (const [id, look] of Object.entries(FA.SERPENT_LOOKS)) {
      if (look.length > 200) continue;
      const sp = new SerpentPainter(look);
      const n = 24, spc = look.length / n;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) pts.push([look.length + 20 - i * spc, 30 + Math.sin(i * 0.5) * look.radius * 1.4 - (i < 3 ? (3 - i) * 2 : 0)]);
      const buf = new PixelBuffer(Math.ceil(look.length * 1.3 + 40), 60);
      sp.paint(buf, { pts, facing: 1, jaw: id === 'sprinter' || id === 'ironjaw' ? 0.6 : 0, tongue: 0.8, legPhase: 1, legLift: 1, grounded: true, groundY: () => 50, flatten: 0 }, 0, 0, 0);
      items.push({ name: id, buf });
    }
    for (const [id, bs] of Object.entries(FA.BIRDS)) {
      items.push({ name: id + ' stand', buf: FA.drawBird(bs, FA.birdPoses.stand(0)) });
      items.push({ name: id + ' fly', buf: FA.drawBird(bs, FA.birdPoses.fly(1)) });
      items.push({ name: id + ' fly2', buf: FA.drawBird(bs, FA.birdPoses.fly(4)) });
      items.push({ name: id + ' disp', buf: FA.drawBird(bs, FA.birdPoses.display(1)) });
    }
    for (const [id, ms] of Object.entries(FA.MAMMALS)) {
      items.push({ name: id, buf: FA.drawMammal(ms, FA.mammalPoses.stand(0)) });
      items.push({ name: id + ' w', buf: FA.drawMammal(ms, FA.mammalPoses.walk(1)) });
      items.push({ name: id + ' sp', buf: FA.drawMammal(ms, id === 'shieldback' ? FA.mammalPoses.ball() : id === 'quillhog' ? FA.mammalPoses.quill(1) : id === 'sailglider' ? FA.mammalPoses.glide() : id === 'delver' ? FA.mammalPoses.dig(0) : FA.mammalPoses.leap()) });
    }
  }
  showGallery(items, name === 'land' ? 2 : name === 'chars' ? 5 : name === 'fauna' ? 4 : 3);
}
