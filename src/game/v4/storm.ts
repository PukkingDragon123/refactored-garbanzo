// The storm. Something massive slams into the Kittiwake; the sky goes black in minutes, lightning,
// mountainous swell, the lights stutter and everything loose starts sliding. In the flash of the
// impact Chunk bolts. Joshu hands out the foul-weather gear, and only then does Mori notice the dog is
// gone: the search leads to the galley, where something is whimpering under the mess table. Carry him
// up to the wheelhouse, and then the rogue wave: a full cinematic as a wall of water rises off the
// bow, curls over the boat... and blackout.

import { game } from '../game';
import type { ShipScene4 } from './ship';
import { SPOTS, S4, UNDER_TABLE } from './ship';
import { LADDERS } from '../../art/ship5';
import type { Actor } from '../../world/actor';
import { startQuest } from '../quests';
import { audio } from '../../core/audio';
import { clamp, rand, smoothstep } from '../../core/math';
import { Custom } from '../../world/props';
import { updater } from '../../world/ocean';
import * as FU from '../../art/ship4/furniture';
import type { Interactable } from '../../world/npc';
import { el } from '../../ui/ui';
import { A } from '../assets';
import { GiantWave } from './giantwave';
import { HMAX } from '../../art/giantwave';
import { climbFrame } from '../../art/ladder';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = () => game.save.flags;

// ---------------------------------------------------------------- the storm
// The steps, each of which survives a reload (the flag that marks it done in brackets):
//  1. the calm before, then IMPACT [v4:stormStarted]: in the white flash Chunk bolts and is gone
//  2. Joshu hands out the foul-weather gear in the bunk room [v4:raincoat]; only then does Mori notice
//     that Chunk is missing
//  3. the search: in the galley something whimpers under the mess table, the hanging cloth shakes;
//     look under it [v4:chunkFound] and Mori picks him up
//  4. carry him up the companionway to the wheelhouse: the rogue wave [v4:bridge]

type Lv = 'lower' | 'deck';
const lvOf = (y: number): Lv => (y > S4.lower.ceil ? 'lower' : 'deck');
/** Joshu hands out the gear by the bunk room locker; Jenna waits her turn beside him */
const GEAR_JOSHU = 386, GEAR_JENNA = 408;
/** where Mori crouches to look under the table (just left of it, by the dog bowls) */
const LOOK_X = 279;
/** the wheelhouse: Joshu at the wheel, Jenna holding on behind him */
const helmX = () => SPOTS.helm[0] - 14, JENNA_BRIDGE = 244;

/** this storm's session state (the scene is rebuilt on a reload, and runStorm with it) */
interface StormRun { s: ShipScene4; heard: boolean; crewReady: boolean; whimperT: number; barkT: number; li: number; dead: boolean }
let run: StormRun | null = null;

/** game-time ticker on the scene's stage (dies with the scene) */
function tick(s: ShipScene4, fn: (dt: number) => boolean | void) {
  const u = updater(dt => { if (fn(dt) === false) u.dead = true; });
  s.st.layer('sea-horizon').add(u);
  return u;
}

/** a crew member climbs a ladder (hands on the rungs the whole way) */
function climbActor(s: ShipScene4, a: Actor, L: { x: number; top: number; bottom: number }, dir: 1 | -1): Promise<void> {
  a.stopWalk();
  a.x = L.x;
  a.terrain = null;
  a.y = dir > 0 ? L.top : L.bottom;
  a.setAnim('climb');
  const to = dir > 0 ? L.bottom : L.top;
  let fy = a.y;
  return new Promise(res => tick(s, dt => {
    // turn to the ladder first, then climb with the frame locked to the place on it (rung by rung)
    const d = to - fy, step = a.inTransition ? 0 : 40 * dt;
    a.x = L.x;
    if (a.inTransition || Math.abs(d) > step) {
      fy += Math.sign(d) * step;
      const dd = Math.round(fy - L.top);
      a.y = L.top + dd;
      if (!a.inTransition) a.holdFrame = climbFrame(dd, L.bottom - L.top);
      return;
    }
    a.y = to;
    a.terrain = s.st.terrain;
    a.setAnim(a.idleAnim === 'climb' ? 'idle' : a.idleAnim);
    res();
    return false;
  }));
}

/** walk a crew member anywhere aboard, taking the nearest ladder between decks */
async function moveActor(s: ShipScene4, a: Actor, x: number, lv: Lv, speed = 62) {
  a.idleAnim = 'idle';
  a.terrain = s.st.terrain;
  if (lvOf(a.y) !== lv) {
    const L = [...LADDERS].sort((p, q) => Math.abs(p.x - a.x) + Math.abs(p.x - x) - (Math.abs(q.x - a.x) + Math.abs(q.x - x)))[0];
    await a.walkTo(L.x, speed, speed > 85 ? 'run' : 'walk');
    await climbActor(s, a, L, lv === 'deck' ? -1 : 1);
  }
  await a.walkTo(x, speed, speed > 85 ? 'run' : 'walk');
}

/** stand a crew member somewhere at once */
function put(s: ShipScene4, a: Actor, x: number, y: number, facing: 1 | -1, anim: string) {
  a.stopWalk();
  a.terrain = s.st.terrain;
  a.x = x; a.y = y; a.facing = facing;
  a.idleAnim = anim; a.setAnim(anim);
  a.alpha = 1;
}

/** Chunk has bolted: curled up under the mess table behind the cloth that slid off it */
function hideChunk(s: ShipScene4) {
  const c = s.chunk;
  s.carrying = false;
  s.buddy.mode = 'script';
  s.buddy.reset();
  c.stopWalk();
  c.terrain = s.st.terrain;
  c.x = UNDER_TABLE[0]; c.y = UNDER_TABLE[1]; c.facing = -1; c.z = 45; c.alpha = 1;
  c.idleAnim = 'hide'; c.setAnim('hide');
  c.setExpr('scared');
  s.underTable = { shake: 0, lift: 0 };
}

/** Mori has Chunk in his arms */
function carryChunk(s: ShipScene4) {
  const p = s.player;
  s.buddy.mode = 'script';
  s.chunk.stopWalk();
  s.chunk.alpha = 1;
  s.underTable = null;
  s.carrying = true;
  s.chunk.setExpr('sad');
  p.animMap = { idle: 'carryPupIdle', walk: 'carryPup', run: 'carryPupRun', climb: 'carryPupClimb', crouch: 'carryPupIdle', crouchWalk: 'carryPup', brace: 'carryPupIdle', slip: 'carryPup', jump: 'carryPupIdle', fall: 'carryPupIdle' };
}

/** the quick change: a twirl, a puff of rustling oilskin, a zip, and they're in their storm gear */
async function quickChange(s: ShipScene4, a: Actor, outfit: string) {
  audio.play('rustle', { vol: 0.6 });
  const puff = () => {
    for (let i = 0; i < 16; i++) s.main.particles.spawn({ frame: A.soft, x: a.x + rand.range(-9, 9), y: a.y - rand.range(4, 34), vx: rand.range(-30, 30), vy: rand.range(-30, 4), life: rand.range(0.45, 0.8), size: 0.22, size1: 0.6, color: [0.95, 0.93, 0.85], alpha: 0.75, alpha1: 0 });
  };
  puff();
  a.react('shrink');
  for (let i = 0; i < 4; i++) {
    a.facing = (a.facing * -1) as 1 | -1;
    if (i === 1) { a.outfit = outfit; puff(); a.react('stretch'); }
    await wait(85);
  }
  audio.play('zipper', { vol: 0.55 });
  a.react('bounce');
}

/** Joshu and Jenna make their way down to the locker with the gear */
async function gatherAtLocker(s: ShipScene4) {
  const r = run;
  const L = S4.lower.floor;
  await Promise.all([
    moveActor(s, s.joshu, GEAR_JOSHU, 'lower', 70),
    moveActor(s, s.jenna, GEAR_JENNA, 'lower', 70),
  ]);
  if (r !== run || F()['v4:raincoat']) return;
  put(s, s.joshu, GEAR_JOSHU, L, -1, 'serve');
  put(s, s.jenna, GEAR_JENNA, L, -1, 'scared');
  r!.crewReady = true;
}

/** everyone else up to the wheelhouse (after the gear is handed out) */
async function crewToBridge(s: ShipScene4) {
  const r = run;
  await Promise.all([
    moveActor(s, s.joshu, helmX(), 'deck', 70),
    (async () => { await wait(500); await moveActor(s, s.jenna, JENNA_BRIDGE, 'deck', 70); })(),
  ]);
  if (r !== run || s.phase !== 'storm') return;
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
}

export async function runStorm(s: ShipScene4) {
  if (F()['v4:bridge']) return;
  if (s.phase === 'storm' || s.phase === 'wave') return;
  s.phase = 'storm';
  run = { s, heard: false, crewReady: false, whimperT: 3, barkT: 9, li: 0, dead: false };
  // nobody wanders off on their daily routine from here on
  (s.story as unknown as { crew?: { stop(): void } | null })?.crew?.stop();
  s.sky.birds = false;
  // older saves: Chunk was found before the gear step existed
  if (F()['v4:chunkFound']) F()['v4:raincoat'] = true;
  if (!F()['v4:stormStarted']) await stormIntro(s);
  else restoreStorm(s);
  startQuest('v4storm', true);
  stormLife(s);
  s.hud?.refresh(true);
}

/** the calm before, the impact, Joshu's orders */
async function stormIntro(s: ShipScene4) {
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const p = s.player;
  s.cutscene = true;
  p.cancelWork?.();
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  audio.setMusic('none' as never);
  // Chunk comes and presses against Mori's legs: he can feel it coming
  await Promise.race([s.buddy.come(p.x - p.facing * 16, 70), wait(2600)]);
  s.chunk.stopWalk();
  s.chunk.alpha = 1;
  s.chunk.faceTo(p.x);
  await say([
    { who: 'mori', text: 'Huh. The birds are gone. All of them. At once.', expr: 'thinking' },
    { who: 'chunk', text: '*low growl*', expr: 'angry', close: false },
  ]);
  await wait(900);
  // ---- IMPACT
  audio.play('shipCrash', { vol: 1 });
  audio.play('thunderClose', { vol: 0.6 });
  s.jolt = 0.22;
  s.st.shake(10, 1.4);
  game.r.post.flash = 1;
  s.power = 0;
  p.body.react('jump');
  p.body.setExpr('shocked', 2);
  // in the white-out: Chunk bolts, Joshu is thrown at the wheel, Jenna grabs hold of whatever is near
  hideChunk(s);
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  s.joshu.outfit = 'storm';
  s.jenna.stopWalk();
  s.jenna.terrain = s.st.terrain;
  if (s.jenna.y < S4.lower.ceil && s.jenna.y > S4.bridge.floor + 4 && s.jenna.x > S4.bridge.x0 && s.jenna.x < S4.bridge.x1) s.jenna.y = S4.bridge.floor;
  s.jenna.idleAnim = 'scared'; s.jenna.setAnim('scared');
  F()['v4:stormStarted'] = true;
  game.persist();
  await wait(700);
  s.power = 1;
  // the sky turns
  tick(s, dt => {
    if (s.phase !== 'storm' && s.phase !== 'wave') return false;
    s.weather.storm = Math.min(1, s.weather.storm + dt * 0.1);
    audio.setStorm(s.weather.storm);
    return s.weather.storm < 1;
  });
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  await say([
    { who: 'joshu', text: 'WHAT IN THE... Something HIT us! Everyone grab hold of something!', style: 'shout', expr: 'shocked' },
    { who: 'jenna', text: 'Was that a WHALE?! Dad! Was that a WHALE?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'Doesn’t matter what it was! There’s a front coming in behind it, and it’s coming FAST. I’m bringing her about!', style: 'shout', expr: 'determined' },
    { who: 'joshu', text: 'Foul-weather gear, both of you! Oilskins and harnesses, NOW! I’ll lash the wheel and bring them down to the bunk room!', style: 'shout', expr: 'serious' },
    { who: 'mori', text: 'Okay. Okay okay okay. Gear. Bunk room. Everyone’s okay. Everyone’s...', expr: 'worried' },
  ]);
  s.cutscene = false;
  void gatherAtLocker(s);
  game.ui.toast('The deck is pitching! Hold <b>S</b> to brace so you don’t slide. Get your <b>foul-weather gear</b> from Joshu in the <b>bunk room</b>.', 'STORM', 'coral', 6500);
}

/** a reload mid-storm: straight back to where it was */
function restoreStorm(s: ShipScene4) {
  const f = F(), p = s.player, L = S4.lower.floor;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  s.weather.storm = 1;
  audio.setStorm(1);
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  const geared = !!f['v4:raincoat'];
  p.body.outfit = geared ? 'storm' : 'ship';
  s.jenna.outfit = geared ? 'storm' : 'ship';
  s.joshu.outfit = 'storm';
  if (!geared) {
    put(s, s.joshu, GEAR_JOSHU, L, -1, 'serve');
    put(s, s.jenna, GEAR_JENNA, L, -1, 'scared');
    run!.crewReady = true;
  } else {
    put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
    put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  }
  if (f['v4:chunkFound']) {
    carryChunk(s);
    game.ui.toast('Carry Chunk up to the <b>wheelhouse</b> (the companionway ladder in the galley).', 'STORM', 'coral', 5000);
  } else {
    hideChunk(s);
    game.ui.toast(geared ? 'Chunk is missing! Search below deck.' : 'Get your <b>foul-weather gear</b> from Joshu in the <b>bunk room</b>.', 'STORM', 'coral', 5000);
  }
}

/** the storm while you play: loose things sliding, jolts and spray, the search, the trip to the wheelhouse */
function stormLife(s: ShipScene4) {
  const p = s.player, r = run!;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const L = S4.lower.floor;
  // loose things start to slide
  const add = (buf: ReturnType<typeof FU.crate>, n: string, x: number, y: number, x0: number, x1: number) => s.addSlider(buf, n, x, y, x0, x1);
  if (!s.sliders.length) {
    // the dog bowl that used to slide in the mess now sits by the bunks (Chunk's hiding table has the mess)
    add(FU.stool(), 'stool', 360, L, 344, 372);
    add(FU.crate(14, 12), 'crate', 470, L - 6, 434, 492);
    add(FU.bucket(), 'bucket', 90, S4.main.y, 44, 190);
    add(FU.cooler(), 'cooler', 170, S4.main.y, 44, 190);
    add(FU.crate(18, 14, FU.P.plank, true), 'crate2', 400, S4.main.y - 3, 360, 500);
  }
  // storm life: extra jolts, spray over the rails, the whimpering under the table
  let joltT = 5;
  tick(s, dt => {
    if (s.phase !== 'storm' || run !== r) return s.phase === 'wave' ? false : undefined;
    joltT -= dt;
    if (joltT <= 0) {
      joltT = rand.range(5, 9);
      s.jolt += rand.pick([-1, 1]) * rand.range(0.05, 0.1);
      s.st.shake(4, 0.6);
      audio.play('waveCrash', { vol: 0.5 });
      if (s.level() !== 'lower') for (let i = 0; i < 26; i++) s.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-120, 120), y: S4.main.y - rand.range(0, 30), vx: rand.range(-40, 40) - 80, vy: rand.range(-120, -40), ay: 300, life: 1, color: [0.85, 0.92, 1], alpha: 0.9, alpha1: 0, floorY: S4.main.y + 1 });
    }
    const f = F();
    const u = s.underTable;
    if (u) {
      u.shake = Math.max(0, u.shake - dt * 0.9);
      // geared up and searching: the galley's where he is. Walking in, Mori hears him.
      const inGalley = s.level() === 'lower' && p.state !== 'climb' && p.x > 196 && p.x < 340;
      if (f['v4:raincoat'] && !f['v4:chunkFound'] && !r.heard && inGalley && !s.cutscene && !game.ui.blocking) {
        r.heard = true;
        whimper(s, 1);
        p.body.showEmote('question', 2.2);
        p.facing = UNDER_TABLE[0] >= p.x ? 1 : -1;
        game.ui.bubbles.clear();
        s.bark('mori', '...What was that? Something under the table?', { expr: 'surprised' });
      }
      // every so often the cloth trembles and something whimpers (louder close by)
      r.whimperT -= dt;
      if (r.whimperT <= 0 && f['v4:raincoat'] && !f['v4:chunkFound']) {
        r.whimperT = rand.range(3.5, 6);
        const near = s.level() === 'lower' && Math.abs(p.x - UNDER_TABLE[0]) < 150;
        if (near || r.heard) whimper(s, near ? 1 : 0.5);
      }
    }
    // search barks, until he hears him
    if (f['v4:raincoat'] && !f['v4:chunkFound'] && !r.heard) {
      r.barkT -= dt;
      if (r.barkT <= 0) {
        r.barkT = 11;
        const lines = ['Chunk! Buddy! Where are you?!', 'He hates thunder. He hides somewhere small and dark...', 'Not in the bunks... think. Small. Dark. Near food?'];
        if (!game.ui.bubbles.active && !s.cutscene) s.bark('mori', lines[r.li++ % lines.length], { expr: 'worried' });
      }
    }
    // reaching the wheelhouse with Chunk starts the finale
    if (f['v4:chunkFound'] && s.carrying && !s.cutscene && !game.ui.blocking && p.y <= S4.bridge.floor + 2 && p.x > S4.bridge.x0 && p.x < S4.bridge.x1 && p.state !== 'climb' && p.onGround) {
      void rogueWave(s);
      return false;
    }
  });
  // quest markers: the gear, the galley, under the table
  s.questPoints.push({ x: () => (UNDER_TABLE[0] - 20), y: () => L - 40, on: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !F()['v4:chunkFound'] && !r.heard });
  // Joshu hands out the gear
  s.interact.push({
    get x() { return s.joshu.x; }, get y() { return s.joshu.y; }, w: 14, h: 18, label: 'Get your foul-weather gear', get standX() { return s.joshu.x - 20; },
    quest: () => true,
    enabled: () => run === r && s.phase === 'storm' && r.crewReady && !F()['v4:raincoat'] && !s.cutscene,
    action: () => giveGear(s),
  } as unknown as Interactable);
  // look under the table
  s.interact.push({
    x: UNDER_TABLE[0], y: L, w: 16, h: 16, label: 'Look under the table', standX: LOOK_X,
    quest: () => true,
    enabled: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !F()['v4:chunkFound'] && r.heard && !s.cutscene,
    action: () => findChunk(s),
  } as Interactable);
  // Jenna, holding on in the wheelhouse
  s.interact.push({
    get x() { return s.jenna.x; }, get y() { return s.jenna.y; }, w: 14, h: 18, label: 'Jenna!', get standX() { return s.jenna.x + 20; },
    enabled: () => run === r && s.phase === 'storm' && !!F()['v4:raincoat'] && !s.cutscene && lvOf(s.jenna.y) === 'deck' && !s.jenna.walking,
    action: () => say([
      { who: 'jenna', text: F()['v4:chunkFound'] ? 'You found him!! Okay! Bridge! Go go go, I’m right behind you!' : 'I’m FINE! I’m totally fine! This is fine! FIND CHUNK!', expr: 'scared', style: 'shout' },
    ]).then(() => {}),
  } as unknown as Interactable);
}

/** a whimper from under the table, and the cloth trembles */
function whimper(s: ShipScene4, k: number) {
  const u = s.underTable;
  if (!u) return;
  u.shake = Math.min(1, u.shake + 0.8 * k);
  audio.play('rustle', { vol: 0.35 * k });
  setTimeout(() => audio.play('callSqueak', { vol: 0.3 * k, pitch: 0.75 }), 180);
  s.chunk.react('tremble');
}

/** Joshu hands out the oilskins; only then does anyone notice who isn't there */
async function giveGear(s: ShipScene4) {
  const p = s.player, jo = s.joshu, je = s.jenna;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  s.cutscene = true;
  p.facing = jo.x >= p.x ? 1 : -1;
  jo.faceTo(p.x);
  await say([
    { who: 'joshu', text: 'Here. Oilskin, harness, boots. Arms up, lad, quick now.', expr: 'serious' },
  ]);
  await quickChange(s, p.body, 'storm');
  await wait(250);
  await say([
    { who: 'joshu', text: 'If you go out on deck you clip that harness on to something. Jenna! Yours.', expr: 'serious' },
  ]);
  je.faceTo(jo.x);
  await quickChange(s, je, 'storm');
  je.idleAnim = 'scared'; je.setAnim('scared');
  await say([
    { who: 'jenna', text: 'It smells like old fish and Dad.', expr: 'scared' },
    { who: 'joshu', text: 'That’s the smell of staying alive. Right: up to the wheelhouse, all of you, where I can see you.', expr: 'determined' },
    { who: 'mori', text: 'Okay. Chunk, come on, buddy, we’re going up...', expr: 'worried' },
  ]);
  // he looks around for him
  p.facing = (p.facing * -1) as 1 | -1;
  await wait(500);
  p.facing = (p.facing * -1) as 1 | -1;
  p.body.showEmote('question', 1.4);
  await say([
    { who: 'mori', text: '...Chunk?', expr: 'worried' },
    { who: 'jenna', text: 'He was right next to you when we got hit!', expr: 'scared' },
    { who: 'mori', text: 'CHUNK?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'He’ll have gone to ground somewhere. Find that dog and bring him up top, Mori. Jenna, with me. NOW.', expr: 'serious', style: 'shout' },
  ]);
  F()['v4:raincoat'] = true;
  game.persist();
  s.hud?.refresh(true);
  run!.barkT = 4;
  s.cutscene = false;
  void crewToBridge(s);
  game.ui.toast('Chunk is missing! Search below deck: he hides somewhere small and dark when it thunders.', 'STORM', 'coral', 6000);
}

async function findChunk(s: ShipScene4) {
  const p = s.player, c = s.chunk;
  s.cutscene = true;
  game.ui.bubbles.clear();
  p.facing = c.x >= p.x ? 1 : -1;
  p.poseOverride = 'kneel';
  // lift the cloth
  const u = s.underTable;
  if (u) {
    audio.play('rustle', { vol: 0.6 });
    await new Promise<void>(res => tick(s, dt => { u.lift = Math.min(1, u.lift + dt * 3); u.shake = 0; if (u.lift >= 1) { res(); return false; } }));
  }
  c.faceTo(p.x);
  c.react('tremble');
  await s.say([
    { who: 'mori', text: 'There you are. Hey. Hey, buddy.', expr: 'worried' },
    { who: 'chunk', text: '*trembling all over*', expr: 'scared', close: false },
    { who: 'mori', text: 'I know. It’s loud. I don’t like it either.', expr: 'sad' },
    { who: 'mori', text: 'C’mere. I’ve got you. I’ve always got you.', expr: 'determined' },
  ]);
  p.poseOverride = null;
  carryChunk(s);
  F()['v4:chunkFound'] = true;
  game.persist();
  s.hud?.refresh(true);
  s.cutscene = false;
  game.ui.toast('Carry Chunk up to the <b>wheelhouse</b> (the companionway ladder in the galley).', 'STORM', 'coral', 6000);
}

/** a reload during the finale: back in the wheelhouse with Chunk in his arms, and here it comes again */
export async function resumeWave(s: ShipScene4) {
  const p = s.player;
  s.phase = 'storm';
  (s.story as unknown as { crew?: { stop(): void } | null })?.crew?.stop();
  s.sky.birds = false;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  s.weather.storm = 1;
  audio.setStorm(1);
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  for (const a of [p.body, s.jenna, s.joshu]) a.outfit = 'storm';
  put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  p.x = 300; p.y = S4.bridge.floor; p.vx = p.vy = 0; p.facing = 1;
  carryChunk(s);
  s.snapCamera();
  await wait(1200);
  await rogueWave(s);
}

export async function rogueWave(s: ShipScene4) {
  const p = s.player, say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  F()['v4:bridge'] = true;
  game.persist();
  s.phase = 'wave';
  s.cutscene = true;
  s.hud?.show(false);
  // no stray search barks over the finale
  game.ui.bubbles.clear();
  p.walkTo(298, 50).catch(() => {});
  // Joshu at the wheel, Jenna made it up too (if either is still on the way, they're there now)
  const there = (a: Actor) => !a.walking && a.terrain !== null && Math.abs(a.y - S4.bridge.floor) < 2 && a.x > S4.bridge.x0 && a.x < S4.bridge.x1;
  if (!there(s.joshu)) put(s, s.joshu, helmX(), S4.bridge.floor, 1, 'steerHard');
  if (!there(s.jenna)) put(s, s.jenna, JENNA_BRIDGE, S4.bridge.floor, 1, 'scared');
  run = null;
  await say([
    { who: 'joshu', text: 'There’s my crew. Got the dog? Good lad.', expr: 'serious' },
    { who: 'jenna', text: 'Dad... Dad, what’s THAT?', expr: 'scared' },
  ]);
  // the wall of water rises out of the swell off the bow while the camera pulls back to take it all in
  const wave = new GiantWave(s);
  wave.on = true;
  wave.cx = 1340;
  s.rogue = wave;
  // its body behind the boat (the boat rides on its face), its curl and claws in front of everything
  const addAt = (name: string, at: number) => {
    const L = s.st.addLayer(name, 1, 0, 0.6, 0, 1);
    s.st.layers.splice(s.st.layers.indexOf(L), 1);
    s.st.layers.splice(at, 0, L);
    return L;
  };
  addAt('wave-back', s.st.layers.findIndex(x => x.name === 'main')).add(new Custom(0, rr => wave.drawBack(rr)));
  addAt('wave-front', s.st.layers.findIndex(x => x.name === 'sea-near') + 1).add(new Custom(0, rr => wave.drawFront(rr)));
  game.ui.letterbox(true);
  const cam = s.st.cam;
  cam.locked = true;
  // room to frame the boat on the left and the wave on the right
  s.st.maxX = 1260;
  s.waveLift = true;
  let T = 0, go = -1, goReq = false;
  const up = updater(dt => {
    T += dt;
    cam.zoom += (0.52 - cam.zoom) * Math.min(1, dt * 0.8);
    cam.x += ((go >= 0 ? 470 : 560) - cam.x) * Math.min(1, dt * 0.7);
    cam.y += (205 - cam.y) * Math.min(1, dt * 0.7);
    // it builds out of the swell as it comes: rising, steepening, the crest starting to pitch
    const b = smoothstep(0, 5.5, T);
    wave.H = HMAX * Math.pow(b, 0.8);
    // it only comes in once everyone has had their moment, and once it has built up to its full height
    if (goReq && go < 0 && T >= 5.6) go = 0;
    if (go < 0) {
      wave.cx = 1340 - 280 * b;
      wave.curl = 0.22 * smoothstep(1.5, 5.5, T);
    } else {
      // here it comes: the lip pitches forward over the boat
      go += dt;
      wave.cx -= dt * (110 + go * 170);
      wave.curl = Math.max(wave.curl, 0.22 + 0.78 * smoothstep(0, 1.9, go));
    }
    // she rides up the face: bow up, lifted
    const sl = (s.seaY(330) - s.seaY(270)) / 60;
    s.jolt += (clamp(sl * 0.9, -0.25, 0.25) - s.jolt) * Math.min(1, dt * 3);
    wave.update(dt);
    if (Math.random() < dt * 0.6) s.sky.flash({ big: Math.random() < 0.25 });
  });
  s.st.layer('sea-horizon').add(up);
  audio.play('waveCrash', { vol: 0.6 });
  await wait(3200);
  // the lines play as close-up cut-ins: the speakers are tiny in the wide shot
  await say([
    { who: 'joshu', text: 'ROGUE WAVE!! GRAB HOLD OF SOMETHING AND DON’T YOU DARE LET GO!', style: 'shout', expr: 'shocked', auto: 2000, close: true },
    { who: 'jenna', text: 'DAAAAAD!!', style: 'shout', expr: 'scared', auto: 1200, close: true },
    { who: 'mori', text: 'I’ve got you, Chunk. I’ve got you.', style: 'whisper', expr: 'scared', auto: 1700, close: true },
  ]);
  for (const a of [s.jenna, s.joshu]) a.setAnim('brace');
  const until = (f: () => boolean) => new Promise<void>(res => { const chk = () => (f() ? res() : requestAnimationFrame(chk)); chk(); });
  goReq = true;
  await until(() => go >= 0);
  audio.play('waveCrash', { vol: 0.8, pitch: 0.8 });
  // slow motion as the lip comes over
  await until(() => go >= 0.7);
  game.slowmo = 0.45;
  await until(() => wave.cx < 420);
  audio.play('waveCrash', { vol: 1 });
  audio.play('shipCrash', { vol: 1 });
  s.st.shake(14, 1.2);
  game.r.post.flash = 1;
  await wait(260);
  // blackout
  game.slowmo = 1;
  game.r.post.fadeColor = [0, 0, 0];
  game.r.post.fade = 1;
  game.fadeTo(1, 20);
  audio.setStorm(0);
  audio.setMusic('none' as never);
  audio.setAmbience('none', false);
  game.ui.letterbox(false);
  await blackout();
  const { goBeachWake } = await import('../scenes/flow');
  goBeachWake();
}

/** black screen: muffled heartbeat, a few drifting thoughts */
async function blackout() {
  const box = el('div', '');
  box.style.cssText = 'position:absolute;inset:0;z-index:60;background:#000;display:flex;align-items:center;justify-content:center;pointer-events:none';
  const t = el('div', '');
  t.style.cssText = "font-family:'Jersey 15', 'Pixelify Sans',monospace;font-size:clamp(16px,2.4vw,26px);color:#c8d0d8;letter-spacing:0.08em;opacity:0;transition:opacity 1.2s";
  box.appendChild(t);
  game.ui.root.appendChild(box);
  const beat = () => { audio.play('land', { vol: 0.35, pitch: 0.35 }); setTimeout(() => audio.play('land', { vol: 0.25, pitch: 0.32 }), 260); };
  await wait(1400);
  for (const line of ['...', '...cold...', 'salt... everywhere...', 'Chunk...?']) {
    beat();
    t.textContent = line;
    t.style.opacity = '1';
    await wait(2100);
    t.style.opacity = '0';
    await wait(1100);
  }
  beat();
  await wait(1600);
  setTimeout(() => box.remove(), 1500);
}
