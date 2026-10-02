// V10: Te Kāinga, the village of Aroha's whānau, the kaitiaki (guardians) of the island. Up the river
// from the mangroves, on a terrace: the canoe landing, kūmara gardens, the carved wharenui, a pātaka
// on its post, drying racks, a steaming hāngī pit and the carved gateway to the old track. Friendly
// people with stories: Koro Wiremu (taonga returned to him are family heirlooms coming home; he knows
// of Te Korokoro and gives his blessing for the old track to the pā), Whaea Mere the weaver (a flax
// bag; bread for the road), Rāwiri the fisher (kūmara, river lore, strange lights on the coast) and
// little Pīpī (who wants her photo taken). Everyone talks through Jenna's translator.

import type { FieldScene } from '../scenes/field';
import type { Site10 } from './kit';
import { arrive10, boulder, propAt, steam, sprite, Rng, hex, mix, PAL, bayer, game, clamp } from './kit';
import { groundStrip, mainLayer, skyAndRidge, jungleWalls, trees, undergrowth, frontFoliage, node } from '../sites2/common';
import { Prop, Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { plant } from '../../art/jungle-plants';
import type { Interactable } from '../../world/npc';
import type { Actor } from '../../world/actor';
import type { BubbleLine } from '../../ui/bubbles';
import { registerVillagers } from '../../art/v10/villagers';
import { tr } from '../v10/translator';
import { add, count, remove } from '../inventory';
import { ITEMS } from '../items';
import { rumour, addNote, discover } from '../v10/regions';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';

const W = 2200, G = 284, RIVER = 230;
export const villageGround = (x: number) => (x < RIVER ? G + 10 - (x / RIVER) * 10 : G + Math.sin(x * 0.008) * 2 + Math.sin(x * 0.031) * 1);
const F = () => game.save.flags;
const flag = (k: string) => { F()[k] = true; game.persist(); };

const WOOD: C[] = [hex('#2a140c'), hex('#4a2414'), hex('#6a3420'), hex('#8a462a'), hex('#a85a34')];
const THATCH: C[] = [hex('#4a3a1c'), hex('#6a5428'), hex('#8c7238'), hex('#ac904c'), hex('#c8aa62')];

/** a whare: woven walls, a thatched gable roof, carved bargeboards (maihi) for the big house */
function whare(w: number, h: number, seed: number, carved: boolean) {
  const b = new PixelBuffer(w + 16, h + 30);
  const cx = (w + 16) / 2, roofH = Math.round(h * 0.55), base = h + 29;
  const rng = new Rng(seed);
  // walls
  for (let y = base - Math.round(h * 0.55); y <= base; y++) for (let x = 10; x < w + 6; x++) b.set(x, y, (x + y) % 6 < 3 ? THATCH[2] : THATCH[1]);
  // the door and the window
  b.rect(cx - 5, base - 18, 10, 18, hex('#120a06'));
  b.rect(cx + 12, base - 20, 7, 6, hex('#120a06'));
  // roof
  for (let y = 0; y < roofH; y++) {
    const half = (y / roofH) * (w / 2 + 8);
    for (let x = -half; x <= half; x++) b.set(cx + x, base - Math.round(h * 0.55) - roofH + y, THATCH[clamp(Math.round(3 - y / roofH * 2 + (bayer(Math.round(cx + x), y) - 0.5) + (rng.next() < 0.05 ? -1 : 0)), 0, 4)]);
  }
  if (carved) {
    // maihi: red carved boards along the roof edges, a koruru face at the peak, poupou at the porch
    for (let y = 0; y < roofH; y++) {
      const half = (y / roofH) * (w / 2 + 8);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.set(cx + s * (half - k), base - Math.round(h * 0.55) - roofH + y, k === 1 && y % 4 === 0 ? WOOD[0] : WOOD[3]);
    }
    b.disc(cx, base - Math.round(h * 0.55) - roofH + 3, 3, WOOD[3]);
    b.set(cx - 1, base - Math.round(h * 0.55) - roofH + 2, hex('#6ab8a8')); b.set(cx + 1, base - Math.round(h * 0.55) - roofH + 2, hex('#6ab8a8'));
    for (const px of [12, w + 2]) for (let y = base - Math.round(h * 0.55); y <= base; y++) { b.set(px, y, y % 5 === 0 ? WOOD[0] : WOOD[3]); b.set(px + 1, y, WOOD[2]); b.set(px + 2, y, y % 7 === 0 ? WOOD[0] : WOOD[3]); }
  }
  b.outline(hex('#140a06'));
  return { buf: b, ax: Math.floor(cx), ay: base };
}
/** a pātaka: a small carved storehouse up on a single post */
function pataka() {
  const b = new PixelBuffer(40, 70);
  for (let y = 34; y < 70; y++) { b.set(19, y, WOOD[2]); b.set(20, y, WOOD[3]); b.set(21, y, WOOD[1]); }
  const s = whare(22, 26, 3, true);
  b.blit(s.buf, 20 - s.ax, 36 - s.ay);
  b.outline(hex('#140a06'));
  return { buf: b, ax: 20, ay: 69 };
}
/** a waka (canoe) pulled up on the bank, a carved prow */
function waka() {
  const b = new PixelBuffer(130, 22);
  for (let x = 0; x < 120; x++) {
    const t = x / 120, top = 10 - Math.sin(t * Math.PI) * 1.5, bot = 10 + Math.sin(t * Math.PI) * 8;
    for (let y = top; y < bot; y++) b.set(x + 4, y, y < top + 2 ? WOOD[4] : WOOD[clamp(Math.round(3 - (y - top) / 4), 0, 4)]);
  }
  for (let y = 0; y < 12; y++) { b.set(122 + (y < 4 ? 2 : 0), y, WOOD[3]); b.set(123, y, y % 3 ? WOOD[3] : WOOD[0]); }
  for (let x = 10; x < 110; x += 9) b.set(x, 9, hex('#e8e0c8'));
  b.outline(hex('#140a06'));
  return { buf: b, ax: 65, ay: 21 };
}
/** the waharoa: the carved gateway in the palisade */
function gateway() {
  const b = new PixelBuffer(60, 96);
  for (const px of [6, 46]) for (let y = 10; y < 96; y++) for (let k = 0; k < 8; k++) b.set(px + k, y, (y + k) % 7 === 0 ? WOOD[0] : WOOD[k < 3 ? 4 : 3]);
  for (let y = 4; y < 14; y++) for (let x = 2; x < 58; x++) b.set(x, y, (x + y) % 5 === 0 ? WOOD[0] : WOOD[3]);
  b.disc(30, 7, 5, WOOD[3]); b.set(28, 6, hex('#6ab8a8')); b.set(32, 6, hex('#6ab8a8'));
  b.outline(hex('#140a06'));
  return { buf: b, ax: 30, ay: 95 };
}
/** a palisade section of sharpened stakes */
function palisade(w: number) {
  const b = new PixelBuffer(w, 48);
  for (let x = 0; x < w; x += 6) { const h = 40 + ((x * 7) % 8); for (let y = 48 - h; y < 48; y++) for (let k = 0; k < 5; k++) if (y > 48 - h + Math.abs(k - 2)) b.set(x + k, y, WOOD[k < 2 ? 3 : 2]); }
  for (let x = 0; x < w; x++) { b.set(x, 20, THATCH[1]); b.set(x, 34, THATCH[1]); }
  b.outline(hex('#140a06'));
  return { buf: b, ax: 0, ay: 47 };
}
/** a drying rack hung with fish and flax */
function rack() {
  const b = new PixelBuffer(60, 40);
  for (const px of [4, 54]) for (let y = 4; y < 40; y++) b.set(px, y, WOOD[2]);
  for (let x = 2; x < 58; x++) b.set(x, 6, WOOD[3]);
  for (let i = 0; i < 8; i++) { const x = 8 + i * 6; for (let y = 7; y < 7 + 10 + (i % 3) * 3; y++) b.set(x, y, i % 2 ? hex('#a8a090') : PAL.moss[3]); b.set(x - 1, 8 + (i % 3) * 3, i % 2 ? hex('#c8c0b0') : PAL.moss[4]); }
  b.outline(hex('#140a06'));
  return { buf: b, ax: 30, ay: 39 };
}

// ------------------------------------------------------------------ the people
interface Person { id: string; x: number; anim: string; face: 1 | -1; pace?: [number, number] }
const PEOPLE: Person[] = [
  { id: 'rawiri', x: 300, anim: 'fishWait', face: -1 },
  { id: 'mere', x: 560, anim: 'sitGround', face: 1 },
  { id: 'koro', x: 980, anim: 'sit', face: 1 },
  { id: 'pipi', x: 1240, anim: 'idle', face: -1, pace: [1150, 1450] },
];
const say = (f: FieldScene, lines: BubbleLine[]) => f.say(lines.map(l => (l.who === 'mori' ? l : { ...l, ...tr(l.text, { style: l.style }) })));
const TAONGA: Record<string, string> = { taonga_toggle: 'the pounamu toggle', taonga_toki: 'the stone toki', taonga_matau: 'the bone matau' };

async function talkKoro(f: FieldScene) {
  const back = Object.keys(TAONGA).filter(id => count(id) > 0);
  if (back.length) {
    for (const id of back) {
      remove(id, 1);
      flag('v10:returned:' + id);
      discover({ id: 'vil:returned:' + id, kind: 'village', name: `${ITEMS[id].name} returned`, loc: 'village', x: 980, note: `Returned ${TAONGA[id]} to Koro Wiremu.` }, true);
    }
    add('vil_rewena', 2);
    add('vil_kumara', 2);
    audio.play('discover');
    await say(f, [
      { who: 'mori', text: `Koro... we found ${back.map(id => TAONGA[id]).join(' and ')}. Aroha said it should come home.`, expr: 'neutral' },
      { who: 'koro', text: back.includes('taonga_toggle') ? 'E hoa... this toggle was my grandmother’s grandmother’s. She lost it diving for kōura in the cave that breathes. We sang for it for a hundred years.' : 'You carried this all the way here, and gave it back. That tells me who you are.', expr: 'happy' },
      { who: 'koro', text: 'Take kai for the road. And you are welcome here, always. Ka pai, e tama.', expr: 'happy' },
    ]);
    game.ui.toast('Taonga returned. Koro gave you <b>rēwena</b> and <b>kūmara</b>.', 'VILLAGE', 'teal', 3600);
  }
  if (!F()['v10:koroBlessing'] && (back.length || F()['v10:koroTalked'])) {
    flag('v10:koroBlessing');
    rumour('unknown');
    addNote({ id: 'note:koro', loc: 'village', x: 980, text: 'Koro: the old track from the gateway climbs to the old pā.' });
    await say(f, [
      { who: 'koro', text: 'The old track beyond the gateway goes up to the pā of our tūpuna. Go with my blessing, and Aroha. Look, photograph, take nothing.', expr: 'serious' },
      { who: 'koro', text: 'And if the carvings show you Te Korokoro, the Throat... remember they were drawn as a warning. Something old sleeps there.', expr: 'worried' },
    ]);
    return;
  }
  if (back.length) return;
  flag('v10:koroTalked');
  await say(f, [rand.pick<BubbleLine>([
    { who: 'koro', text: 'Our people have watched over this island for longer than anyone can count. Kaitiakitanga: we look after it, and it looks after us.', expr: 'neutral' },
    { who: 'koro', text: 'A camera that steals no feathers and takes no eggs. Good. My grandfather would have liked you, I think.', expr: 'happy' },
    { who: 'koro', text: 'The taniwha are not monsters, boy. They are guardians. You will understand when you meet one.', expr: 'serious' },
  ])]);
}
async function talkMere(f: FieldScene) {
  if (!F()['v10:kete']) {
    flag('v10:kete');
    add('gift_kete', 1);
    await say(f, [
      { who: 'mere', text: 'So you are the scientist who carries everything in his arms. Here: a kete. Harakeke, from my own bushes. It holds more than it looks.', expr: 'teasing' },
      { who: 'mori', text: 'It’s beautiful. Thank you, Whaea.', expr: 'happy' },
    ]);
    game.ui.toast('Whaea Mere gave you a <b>woven flax bag</b>.', 'GIFT', 'teal', 3200);
    return;
  }
  if (game.save.vars['v10:bread'] !== game.save.day) {
    game.save.vars['v10:bread'] = game.save.day;
    add('vil_rewena', 1);
    await say(f, [{ who: 'mere', text: 'Bread for the road. Don’t share it with Aroha, she already had three.', expr: 'teasing' }]);
    return;
  }
  await say(f, [rand.pick<BubbleLine>([
    { who: 'mere', text: 'Cut the outer leaves, never the heart. The heart is the baby; the leaves around it are the parents. Same with people.', expr: 'serious' },
    { who: 'mere', text: 'Your translator called me “Whale Mary” this morning. Tell Jenna I want a word with her machine.', expr: 'grumpy' },
  ])]);
}
async function talkRawiri(f: FieldScene) {
  if (!F()['v10:rawiriLights']) {
    flag('v10:rawiriLights');
    rumour('coast');
    addNote({ id: 'note:lights', loc: 'village', x: 300, text: 'Rāwiri saw boat lights off the east coast. Not ours.' });
    await say(f, [
      { who: 'rawiri', text: 'Kia ora, bro. You came up the Blackwater? On foot? With the ironjaws? Respect.', expr: 'surprised' },
      { who: 'rawiri', text: 'Hey, you know who else is out here? Three nights ago I saw lights on the sea, east, past the reef. A boat. Not one of ours. Not yours either.', expr: 'serious' },
    ]);
    return;
  }
  add('vil_kumara', 1);
  await say(f, [rand.pick<BubbleLine>([
    { who: 'rawiri', text: 'Fish bite at the turn of the tide. The eels bite at everything. Have a kūmara.', expr: 'happy' },
    { who: 'rawiri', text: 'Take a kūmara. Aroha says you forget to eat when you are photographing. Bro. Eat.', expr: 'teasing' },
  ])]);
}
async function talkPipi(f: FieldScene, a: Actor) {
  a.setAnim('wave');
  await say(f, [
    { who: 'pipi', text: 'Is that a CAMERA? Take my photo! Take my photo! I’m going to do my scary face!', expr: 'excited' },
    { who: 'mori', text: 'Okay, okay... say “kūmara”!', expr: 'happy' },
  ]);
  a.setAnim('angry');
  audio.play('shutter');
  game.r.post.flash = 0.3;
  await new Promise(r => setTimeout(r, 700));
  a.setAnim('laugh');
  await say(f, [{ who: 'pipi', text: 'Was it scary? It was SO scary. Can I see? ...Aww, I look happy in it.', expr: 'laugh' }]);
  a.setAnim('idle');
}

export const VILLAGE: Site10 = {
  id: 'village', loc: 'village', name: 'Te Kāinga', width: W, camY: 176, spawnX: 120, exitX: 34, waterY: G + 6,
  ambience: 'forest', music: 'aroha', ground: 'grass', noGuide: false,
  build(f) {
    registerVillagers();
    const st = f.st, G0 = { y: villageGround };
    const rng = new Rng(2020);
    skyAndRidge(f, { seed: 61, base: 220 });
    jungleWalls(f, G, [{ p: 0.2, fog: 0.45, depth: 1, seed: 411 }, { p: 0.4, fog: 0.28, depth: 2, seed: 412 }]);
    const mid = st.addLayer('mid', 0.8, 0.06, 0.55, 0);
    trees(f, mid, 0, W / 0.8 + 200, [120, 220], ['nikau', 'treefern', 'rata', 'broadleaf'], { y: x => villageGround(x / 0.8) }, 421, { variants: 3 });
    for (const x of [400, 700, 1700]) { const c = sprite(`vil:midwhare:${x % 3}`, () => whare(50, 40, x, false)); if (c) mid.add(new Prop(c.f, x, villageGround(x / 0.8) + 2, 1, { tint: packColor(0.8, 0.8, 0.82, 1) })); }
    const main = mainLayer(f);
    groundStrip(f, W, G0, [PAL.moss[5], PAL.moss[4], PAL.soil[5], PAL.soil[4]], PAL.soil[1], 431, 120);
    // the river and the canoe landing
    main.add(new Custom(-2, (rr, s2) => {
      rr.water(0.85, 1.4, 0.8);
      rr.rect(0, G + 4, RIVER + 20, 60, packColor(0.1, 0.22, 0.2, 1));
      rr.water(0);
      for (let i = 0; i < 10; i++) rr.fxDraw(A2(), (i * 23 + s2.time * 12) % RIVER, G + 5, 1.4, 0.4, 0, packColor(1, 1, 1, 1), 0.4);
    }));
    propAt(f, 'vil:waka', waka, 170, villageGround(170) + 4, -1);
    // gardens: rows of kūmara mounds
    for (let x = 420; x < 700; x += 22) propAt(f, `vil:kumara:${x % 3}`, () => { const s = plant('taro', 30 + (x % 3), 16); return s; }, x, villageGround(x) + 2, -1);
    // the houses
    propAt(f, 'vil:wharenui', () => whare(150, 110, 7, true), 900, villageGround(900) + 2, -6);
    propAt(f, 'vil:whare1', () => whare(70, 56, 8, false), 1320, villageGround(1320) + 2, -6);
    propAt(f, 'vil:whare2', () => whare(60, 50, 9, false), 1500, villageGround(1500) + 2, -6);
    propAt(f, 'vil:pataka', pataka, 1640, villageGround(1640) + 2, -5);
    propAt(f, 'vil:rack', rack, 760, villageGround(760) + 2, -3);
    propAt(f, 'vil:rack2', rack, 1420, villageGround(1420) + 2, -3);
    // the hāngī pit, steaming
    main.add(new Custom(-1.5, rr => { const x = 1100, y = villageGround(x); rr.rect(x - 14, y - 2, 28, 3, packColor(0.32, 0.24, 0.16, 1)); rr.light(x, y - 10, 50, 1, 0.6, 0.3, 0.3, 0.1); }));
    steam(f, 1100, villageGround(1100) - 3, 10, 0.9);
    // palisade, the carved gateway, the old track beyond
    for (const x of [1760, 1880, 2060]) propAt(f, `vil:pal:${x}`, () => palisade(100), x, villageGround(x) + 3, -7);
    propAt(f, 'vil:gate', gateway, 2000, villageGround(2000) + 3, -4);
    for (const [x, w, h] of [[80, 50, 26], [1180, 40, 20], [2140, 60, 30]] as const) propAt(f, `vil:b:${x}`, () => boulder(x, w, h, PAL.stone, { moss: 0.4 }), x, villageGround(x) + 4, -3);
    undergrowth(f, main, RIVER, W, 0.6, G0, 441, { plants: ['flax', 'grass', 'kawakawa', 'fern', 'flowers', 'astelia'], wood: ['litter', 'rock'] });
    node(f, 'flax1', 'flax', 620);
    node(f, 'kawa1', 'kawakawa', 1180);
    frontFoliage(f, 300, W, [260, 420], ['flax', 'grass', 'fronds'], 1.35, G + 112, 451);
    for (const x of [600, 1300]) f.pois.push({ kind: 'fruit', x, y: villageGround(x), amount: 15 }, { kind: 'flower', x: x + 40, y: villageGround(x) - 30 });
    // the people
    for (const P of PEOPLE) {
      const a = f.addActor(P.id, P.x, villageGround(P.x), P.face);
      a.idleAnim = P.anim;
      a.setAnim(P.anim);
      a.z = 44;
      const name = P.id === 'koro' ? 'Koro Wiremu' : P.id === 'mere' ? 'Whaea Mere' : P.id === 'rawiri' ? 'Rāwiri' : 'Pīpī';
      (f.interact as Interactable[]).push({
        get x() { return a.x; }, get y() { return a.y; }, w: 16, h: 20, label: `Talk to ${name}`, get standX() { return a.x - 22 * a.facing; },
        action: async () => {
          if (f.cutscene) return;
          f.cutscene = true;
          a.faceTo(f.player.x);
          try {
            if (P.id === 'koro') await talkKoro(f);
            else if (P.id === 'mere') await talkMere(f);
            else if (P.id === 'rawiri') await talkRawiri(f);
            else await talkPipi(f, a);
          } finally { f.cutscene = false; f.hud?.refresh(); }
        },
      } as Interactable);
      if (P.pace) {
        const [a0, a1] = P.pace;
        let t = 2;
        main.add(new Custom(0, () => {}, dt => { t -= dt; if (t > 0 || f.cutscene || a.walking) return; t = rand.range(3, 7); a.walkTo(rand.range(a0, a1), 48, 'walk').then(() => a.setAnim(rand.pick(['idle', 'wave', 'cheer']))); }));
      }
    }
    void rng; void mix;
  },
  spawns: [
    { species: 'nutcracker', n: [3, 5], x: [500, 1600], herd: true, times: ['dawn', 'day'], chance: 0.8 },
    { species: 'barkgecko', n: [1, 2], x: [300, 2000], chance: 0.6 },
    { species: 'snakestork', n: [1, 1], x: [30, 220], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'galehawk', n: [1, 1], x: [200, 2100], medium: 'air', times: ['day'], chance: 0.5 },
  ],
  insects: [
    { kind: 'butterfly', x: [300, 1800], y: [200, 270], n: 6, times: ['day', 'dawn'] },
    { kind: 'bee', x: [400, 700], y: [240, 275], n: 6, times: ['day'] },
    { kind: 'dragonfly', x: [0, 230], y: [260, 290], n: 4, times: ['day', 'dusk'] },
    { kind: 'firefly', x: [0, W], y: [190, 280], n: 16, times: ['dusk', 'night'] },
  ],
  onEnter: async f => {
    await arrive10(f, 'Te Kāinga', 'Aroha’s whānau', 'Welcome to my home, Mori. Take your shoes off at the wharenui, and let Koro speak first.');
    if (!F()['v10:villageMet']) {
      flag('v10:villageMet');
      discover({ id: 'vil:kainga', kind: 'village', name: 'Te Kāinga', loc: 'village', x: 900, note: 'The kaitiaki village: Aroha’s whānau.' }, true);
      setTimeout(() => { if (game.scene === f) void say(f, [{ who: 'koro', text: 'Haere mai, haere mai! Welcome. My moko Aroha says you are friends. Then you are friends of ours.', expr: 'happy' }]); }, 4200);
    }
  },
  v10: {
    points: [
      { id: 'vil:wharenui', kind: 'village', name: 'The wharenui', x: 900, photo: { w: 170, h: 140 }, note: 'The carved meeting house: the ancestors are its ridgepole, its rafters, its posts.' },
      { id: 'vil:waka', kind: 'artifact', name: 'The waka', x: 170, photo: { w: 130, h: 22 }, note: 'A river canoe with a carved prow, dug from a single trunk.' },
      { id: 'vil:pataka', kind: 'village', name: 'The pātaka', x: 1640, photo: { w: 40, h: 70 }, note: 'A storehouse on a post, safe from rats and floods.' },
      { id: 'vil:gardens', kind: 'plant', name: 'Kūmara gardens', x: 560, photo: { w: 280, h: 20 }, note: 'Rows of kūmara mounds facing the sun.' },
      { id: 'vil:gate', kind: 'village', name: 'The carved gateway', x: 2000, photo: { w: 60, h: 96 }, note: 'The waharoa, gateway to the old track up to the pā.' },
    ],
  },
};
import { A } from '../assets';
const A2 = () => A.dot2;
