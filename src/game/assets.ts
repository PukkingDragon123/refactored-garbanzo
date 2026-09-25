// Bakes every reusable sprite into the global atlas at startup.

import { Atlas, disposeSceneTextures } from '../gfx/atlas';
import type { Frame, Renderer } from '../gfx/renderer';
import { PixelBuffer } from '../art/pixel';
import * as FX from '../art/fx';
import * as CH from '../art/characters';
import * as FA from '../art/fauna';
import * as K from '../art/camp';
import { PAL } from '../art/palettes';

export let atlas: Atlas;
/** Scene-local atlas for props generated per scene; recreated on every scene change. */
export let local: Atlas;
export function newLocalAtlas(r: Renderer) {
  local?.dispose();
  disposeSceneTextures();
  local = new Atlas(r, 2048);
  return local;
}

export const A = {
  glow: null as unknown as Frame,
  glowHard: null as unknown as Frame,
  soft: null as unknown as Frame,
  dot: null as unknown as Frame,
  dot2: null as unknown as Frame,
  spark: null as unknown as Frame,
  leaves: [] as Frame[],
  petals: [] as Frame[],
  drop: null as unknown as Frame,
  bubble: null as unknown as Frame,
  shadow: null as unknown as Frame,
  shaft: null as unknown as Frame,
  cone: null as unknown as Frame,
  ring: null as unknown as Frame,
  caustics: null as unknown as Frame,
  blob: null as unknown as Frame,
};

export type CharAnims = Record<string, Frame[]>;
export const chars: Record<string, CharAnims> = {};
export const birds: Record<string, Record<string, Frame[]>> = {};
export const mammals: Record<string, Record<string, Frame[]>> = {};
export const props: Record<string, Frame> = {};
export const propAnims: Record<string, Frame[]> = {};

function charAnims(id: string, spec: CH.CharSpec, full: boolean) {
  const size = CH.charSize(spec);
  const add = (name: string, poses: CH.Pose[]) => atlas.addAnim(`${id}.${name}`, poses.map(p => CH.drawCharacter(spec, p)), size.w / 2, size.h);
  const set: CharAnims = {};
  set.idle = add('idle', [0, 1, 2, 3].map(i => CH.idlePose(i / 4)));
  set.walk = add('walk', [0, 1, 2, 3, 4, 5, 6, 7].map(i => CH.walkPose(i / 8)));
  const talk = [0, 1].map(i => { const p = CH.idlePose(0); p.mouth = i ? 'open' : 'smile'; return p; });
  set.talk = add('talk', talk);
  const blink = CH.idlePose(0); blink.eyes = 'closed';
  set.blink = add('blink', [blink]);
  const happy = CH.idlePose(0); happy.eyes = 'happy'; happy.mouth = 'grin'; happy.armF = -2.2;
  set.happy = add('happy', [happy]);
  const wow = CH.idlePose(0); wow.eyes = 'wide'; wow.mouth = 'o'; wow.armF = -0.8; wow.armB = 0.6;
  set.wow = add('wow', [wow]);
  if (full) {
    set.run = add('run', [0, 1, 2, 3, 4, 5, 6, 7].map(i => CH.walkPose(i / 8, 1.5)));
    set.crouch = add('crouch', [0, 1].map(i => { const p = CH.idlePose(i / 2); p.crouch = 1; return p; }));
    set.crouchWalk = add('crouchWalk', [0, 1, 2, 3, 4, 5].map(i => { const p = CH.walkPose(i / 6, 0.6); p.crouch = 1; return p; }));
    const cam = CH.basePose(); cam.camera = 'raised'; cam.eyes = 'squint';
    set.cam = add('cam', [cam]);
    const camC = CH.basePose(); camC.camera = 'raised'; camC.crouch = 1; camC.eyes = 'squint';
    set.camCrouch = add('camCrouch', [camC]);
    const jump = CH.basePose(); jump.footF = [3, 4]; jump.footB = [-2, 2]; jump.armF = -1.8; jump.armB = 1.2; jump.mouth = 'o';
    set.jump = add('jump', [jump]);
    const fall = CH.basePose(); fall.footF = [2, 2]; fall.footB = [-1, 3]; fall.armF = -2.4; fall.armB = -2.2; fall.eyes = 'wide';
    set.fall = add('fall', [fall]);
    set.climb = add('climb', [0, 1, 2, 3].map(i => { const p = CH.basePose(); p.armF = -2.8 + (i % 2) * 0.4; p.armB = -2.6 - (i % 2) * 0.4; p.footF = [0, (i % 2) * 3]; p.footB = [0, ((i + 1) % 2) * 3]; return p; }));
    const scared = CH.basePose(); scared.eyes = 'wide'; scared.mouth = 'open'; scared.armF = -2.6; scared.armB = -2.4; scared.lean = -2;
    set.scared = add('scared', [scared]);
    const swim = [0, 1, 2, 3].map(i => { const p = CH.walkPose(i / 4, 0.8); p.armF = -2.6 + Math.sin(i * 1.6) * 0.6; p.armB = -2.3; return p; });
    set.swim = add('swim', swim);
  }
  chars[id] = set;
}

export function portrait(id: string, expr: 'neutral' | 'happy' | 'wow' | 'talk' | 'worried' = 'neutral', scale = 6): string {
  const spec = CH.CREW[id];
  const p = CH.idlePose(0);
  if (expr === 'happy') { p.eyes = 'happy'; p.mouth = 'grin'; }
  if (expr === 'wow') { p.eyes = 'wide'; p.mouth = 'o'; }
  if (expr === 'talk') p.mouth = 'open';
  if (expr === 'worried') { p.eyes = 'squint'; p.mouth = 'closed'; }
  p.armF = 0.1;
  const full = CH.drawCharacter(spec, p);
  const crop = Math.min(full.h, spec.headR * 2 + 16);
  const top = Math.max(0, full.h - spec.legLen - spec.bodyH - spec.headR * 2 - 8);
  const out = new PixelBuffer(full.w + 4, crop + 2);
  for (let y = 0; y < crop; y++) for (let x = 0; x < full.w; x++) out.data[(y + 1) * out.w + x + 2] = full.data[(y + top) * full.w + x];
  return out.toDataURL(scale);
}

function birdAnims(id: string) {
  const s = FA.BIRDS[id];
  const P = FA.birdPoses;
  const mk = (name: string, n: number, fn: (i: number) => FA.BirdPose) => {
    const bufs = Array.from({ length: n }, (_, i) => FA.drawBird(s, fn(i)));
    return atlas.addAnim(`${id}.${name}`, bufs, bufs[0].w / 2, bufs[0].h);
  };
  birds[id] = {
    stand: mk('stand', 2, P.stand), walk: mk('walk', 4, P.walk), peck: mk('peck', 2, P.peck), fly: mk('fly', 6, P.fly),
    glide: mk('glide', 1, P.glide), dive: mk('dive', 1, P.dive), swim: mk('swim', 2, P.swim), display: mk('display', 2, P.display), call: mk('call', 2, P.call),
  };
}

function mammalAnims(id: string) {
  const s = FA.MAMMALS[id];
  const P = FA.mammalPoses;
  const mk = (name: string, n: number, fn: (i: number) => FA.MammalPose) => {
    const bufs = Array.from({ length: n }, (_, i) => FA.drawMammal(s, fn(i)));
    return atlas.addAnim(`${id}.${name}`, bufs, bufs[0].w / 2, bufs[0].h);
  };
  mammals[id] = {
    stand: mk('stand', 2, P.stand), walk: mk('walk', 4, P.walk), run: mk('run', 4, P.run), eat: mk('eat', 2, P.eat), ball: mk('ball', 1, P.ball),
    rear: mk('rear', 2, P.rear), dig: mk('dig', 2, P.dig), glide: mk('glide', 1, P.glide), quill: mk('quill', 2, P.quill), leap: mk('leap', 1, P.leap),
  };
}

export async function bakeAssets(r: Renderer, progress: (k: number, label: string) => void) {
  atlas = new Atlas(r, 2048);
  newLocalAtlas(r);
  const step = async (k: number, label: string) => {
    progress(k, label);
    await new Promise(res => setTimeout(res, 0));
  };
  await step(0.05, 'Sharpening pencils');
  A.glow = atlas.add('glow', FX.glowTex(64, 2.2), 32, 32);
  A.glowHard = atlas.add('glowHard', FX.glowTex(32, 1.2), 16, 16);
  A.soft = atlas.add('soft', FX.softTex(32), 16, 16);
  A.dot = atlas.add('dot', FX.dot(1), 0.5, 0.5);
  A.dot2 = atlas.add('dot2', FX.dot(2), 1, 1);
  A.spark = atlas.add('spark', FX.sparkTex(), 3.5, 3.5);
  A.leaves = [0, 1, 2, 3].map(i => atlas.add('leaf' + i, FX.leafTex(i, i % 2 ? PAL.leafOlive : PAL.leafDeep), 2.5, 2));
  A.petals = [PAL.flowerPink[4], PAL.red[5], PAL.flowerGold[5]].map((c, i) => atlas.add('petal' + i, FX.petalTex(c), 1.5, 1));
  A.drop = atlas.add('drop', FX.dropTex(), 0.5, 3);
  A.bubble = atlas.add('bubble', FX.bubbleTex(3), 3.5, 3.5);
  A.shadow = atlas.add('shadow', FX.blobShadow(32, 8), 16, 4);
  A.shaft = atlas.add('shaft', FX.shaftTex(48, 256), 24, 0);
  A.cone = atlas.add('cone', FX.coneTex(128, 64), 0, 32);
  A.ring = atlas.add('ring', FX.ringTex(8), 9, 9);
  A.caustics = atlas.add('caustics', FX.causticsTex(128), 64, 64);
  A.blob = atlas.add('blob', FX.ditherBlob(8), 8, 8);
  await step(0.15, 'Packing the crew');
  for (const id of Object.keys(CH.CREW)) charAnims(id, CH.CREW[id], id === 'otis');
  await step(0.45, 'Counting feathers');
  for (const id of Object.keys(FA.BIRDS)) birdAnims(id);
  await step(0.6, 'Grooming mammals');
  for (const id of Object.keys(FA.MAMMALS)) mammalAnims(id);
  await step(0.75, 'Pitching tents');
  const addP = (name: string, o: { buf: PixelBuffer; ax: number; ay: number }) => (props[name] = atlas.add(name, o.buf, o.ax, o.ay));
  addP('lab', K.paintLabTent());
  addP('gear', K.paintGearTent());
  addP('radioTent', K.paintRadioTent());
  addP('mast', K.paintRadioMast(150));
  const jeep = K.paintJeep();
  addP('jeep', jeep);
  propAnims.wheel = atlas.addAnim('wheel', K.paintWheels(11), 12, 12);
  addP('crate', K.paintCrate(18, 14, true, 4));
  addP('crateS', K.paintCrate(12, 10, false, 5));
  addP('barrel', K.paintBarrel(PAL.blue));
  addP('barrelR', K.paintBarrel(PAL.red));
  addP('bench', K.paintBench(34));
  addP('firepit', K.paintFirePit());
  propAnims.flame = atlas.addAnim('flame', K.paintFlames(16, 22), 8, 22);
  props.lantern = atlas.add('lantern', K.paintLantern(), 3.5, 0);
  addP('lanternPost', K.paintLanternPost(44));
  addP('kitchen', K.paintKitchen());
  addP('sign', K.paintSignpost());
  addP('cork', K.paintCorkboard());
  addP('hammock', K.paintHammock());
  addP('dock', K.paintDock(96));
  addP('rowboat', K.paintRowboat());
  addP('ship', K.paintShip(150));
  addP('shipBig', K.paintShip(300));
  addP('clothes', K.paintClothesline(48));
  addP('gate', K.paintGate());
  addP('generator', K.paintGenerator());
  addP('table', K.paintTable());
  await step(0.95, 'Loading film');
  atlas.upload();
  await step(1, 'Ready');
}
