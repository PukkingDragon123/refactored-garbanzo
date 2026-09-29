// The storm. Something massive slams into the Kittiwake; the sky goes black in minutes, lightning,
// mountainous swell, the lights stutter and everything loose starts sliding. Chunk bolts. Find him
// (he hides somewhere small and dark), carry him to the bridge, and then the rogue wave: a full
// cinematic as a wall of water rises off the bow, curls over the boat... and blackout.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import type { ShipScene4 } from './ship';
import { SPOTS, S4 } from './ship';
import { startQuest } from '../quests';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import { Custom } from '../../world/props';
import { updater } from '../../world/ocean';
import * as FU from '../../art/ship4/furniture';
import type { Interactable } from '../../world/npc';
import { el } from '../../ui/ui';
import { A } from '../assets';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = () => game.save.flags;

/** the wall of water */
class GiantWave {
  cx = 2500;
  H = 0;
  curl = 0;
  on = false;
  constructor(readonly s: ShipScene4) {}
  draw(r: Renderer) {
    if (!this.on || this.H < 2) return;
    const s = this.s;
    const L = s.weather.lightning;
    const lit = (c: [number, number, number], k = 1) => packColor(clamp(c[0] + L * 0.5 * k), clamp(c[1] + L * 0.55 * k), clamp(c[2] + L * 0.6 * k), 1);
    const deep: [number, number, number] = [0.1, 0.22, 0.26], mid: [number, number, number] = [0.18, 0.38, 0.42], face: [number, number, number] = [0.34, 0.6, 0.6], foam: [number, number, number] = [0.9, 0.96, 0.98];
    const H = this.H, cx = this.cx;
    for (let x = cx - 760; x < cx + 700; x += 2) {
      const d = x - cx;
      const h = H * Math.exp(-((d / (d < 0 ? 260 : 440)) ** 2));
      if (h < 1) continue;
      const sea = s.seaY(x);
      const top = sea - h;
      const colH = sea - top + 12;
      // body of the wave: deep at the base, lighter translucent green-teal up the face, foam cap
      r.rect(x, top, 2, colH, lit(deep, 0.4));
      r.rect(x, top, 2, Math.min(colH, h * 0.55), lit(mid, 0.6));
      if (d < 60) r.rect(x, top, 2, Math.min(colH, h * 0.3), lit(face, 0.8));
      r.rect(x, top, 2, 3, lit(foam));
      // streaks of foam running down the face, and wind-blown bands across it
      if (((x + Math.floor(s.time * 30)) % 23) < 2 && d < 0) r.rect(x, top + 6, 2, h * 0.5, packColor(0.7, 0.82, 0.85, 0.55));
      for (let k = 1; k < 4; k++) { const by = top + h * (0.22 * k) + Math.sin(x * 0.03 + k * 2 + s.time) * 4; if (d < 80) r.rect(x, by, 2, 1, packColor(0.62, 0.78, 0.8, 0.45)); }
    }
    // the curling lip hanging out over the front face
    if (this.curl > 0.02) {
      const peakX = cx, peakY = s.seaY(cx) - H;
      for (let i = 0; i < 90; i++) {
        const t = i / 90;
        const x = peakX - this.curl * 190 * t;
        const y = peakY - Math.sin(t * Math.PI * 0.55) * 26 * this.curl + this.curl * 120 * t * t;
        const th = 14 * (1 - t * 0.6) * this.curl + 2;
        r.rect(x, y, 3, th, lit(t > 0.7 ? foam : face, 0.8));
        r.rect(x, y, 3, 2, lit(foam));
        // spray blown off the lip
        if (Math.random() < 0.08) r.rect(x + rand.range(-6, 6), y - rand.range(0, 12), 1, 1, packColor(1, 1, 1, 0.8));
      }
    }
  }
}

export async function runStorm(s: ShipScene4) {
  if (F()['v4:bridge']) return;
  const say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  const p = s.player;
  s.phase = 'storm';
  F()['v4:stormStarted'] = true;
  game.persist();
  s.hud?.refresh(true);
  // the calm before
  s.cutscene = true;
  for (const a of s.animals) (a as unknown as { gone: boolean }).gone = true;
  audio.setMusic('none' as never);
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
  game.r.post.flash = 0.35;
  s.power = 0;
  p.body.react('jump');
  p.body.setExpr('shocked', 2);
  s.chunk.react('jump');
  s.jenna.setAnim('scared');
  await wait(700);
  s.power = 1;
  // the sky turns
  s.st.layer('sea-horizon').add(updater(dt => { s.weather.storm = Math.min(1, s.weather.storm + dt * 0.1); audio.setStorm(s.weather.storm); }));
  audio.setAmbience('boatStorm', false);
  audio.setMusic('storm');
  // Joshu back to the wheel (if he was cooking); Jenna to her cabin
  s.joshu.x = SPOTS.helm[0] - 14; s.joshu.y = S4.bridge.floor; s.joshu.idleAnim = 'steer'; s.joshu.setAnim('steer');
  await say([
    { who: 'joshu', text: 'WHAT IN THE... Something HIT us! Everyone grab hold of something!', style: 'shout', expr: 'shocked' },
    { who: 'jenna', text: 'Was that a WHALE?! Dad! Was that a WHALE?!', style: 'shout', expr: 'scared' },
    { who: 'joshu', text: 'Doesn’t matter what it was! There’s a front coming in behind it, and it’s coming FAST. I’m bringing her about!', style: 'shout', expr: 'determined' },
    { who: 'mori', text: 'Okay. Okay okay okay. Everyone’s okay. Everyone’s...', expr: 'worried' },
  ]);
  // Chunk bolts for the hold
  s.buddy.mode = 'stay';
  s.chunk.setExpr('scared');
  s.chunk.walkTo(s.chunk.x + (s.chunk.x > SPOTS.holdHide[0] ? -60 : 60), 150, 'run').catch(() => {});
  await wait(600);
  s.chunk.alpha = 0;
  s.chunk.x = SPOTS.holdHide[0]; s.chunk.y = S4.lower.floor; s.chunk.facing = -1;
  s.chunk.idleAnim = 'hide'; s.chunk.setAnim('hide');
  s.chunk.stopWalk();
  setTimeout(() => (s.chunk.alpha = 1), 400);
  await say([
    { who: 'mori', text: '...Chunk?', expr: 'worried' },
    { who: 'mori', text: 'CHUNK?!', style: 'shout', expr: 'scared' },
  ]);
  s.jenna.x = SPOTS.jennaBunk[0]; s.jenna.y = S4.lower.floor; s.jenna.idleAnim = 'cower'; s.jenna.setAnim('cower');
  s.cutscene = false;
  startQuest('v4storm', true);
  s.hud?.refresh(true);
  game.ui.toast('The deck is pitching! Hold <b>S</b> to brace so you don’t slide. Find Chunk!', 'STORM', 'coral', 6500);
  // loose things start to slide
  const add = (buf: ReturnType<typeof FU.crate>, n: string, x: number, y: number, x0: number, x1: number) => s.addSlider(buf, n, x, y, x0, x1);
  add(FU.dogBowl(true), 'bowl', 680, S4.house.floor, 530, 712);
  add(FU.chair(), 'chair', 850, S4.house.floor, 728, 892);
  add(FU.stool(), 'stool', 820, S4.lower.floor, 648, 930);
  add(FU.crate(18, 16), 'crate', 560, S4.lower.floor, 408, 632);
  add(FU.bucket(), 'bucket', 150, S4.main.y, 56, 500);
  add(FU.cooler(), 'cooler', 300, S4.main.y, 56, 500);
  add(FU.crate(22, 18, FU.P.plank, true), 'crate2', 1300, S4.main.y, 1130, 1580);
  // storm life: rolling seas, extra jolts, spray over the rails
  let joltT = 5;
  s.st.layer('sea-horizon').add(updater(dt => {
    if (s.phase !== 'storm') return;
    joltT -= dt;
    if (joltT <= 0) {
      joltT = rand.range(5, 9);
      s.jolt += rand.pick([-1, 1]) * rand.range(0.05, 0.1);
      s.st.shake(4, 0.6);
      audio.play('waveCrash', { vol: 0.5 });
      if (s.level() !== 'lower') for (let i = 0; i < 26; i++) s.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-120, 120), y: S4.main.y - rand.range(0, 30), vx: rand.range(-40, 40) - 80, vy: rand.range(-120, -40), ay: 300, life: 1, color: [0.85, 0.92, 1], alpha: 0.9, alpha1: 0, floorY: S4.main.y + 1 });
    }
  }));
  // the hiding spot + Jenna in the storm
  s.interact.push({ x: SPOTS.holdHide[0], y: S4.lower.floor, w: 18, h: 18, label: 'Chunk!', standX: SPOTS.holdHide[0] + 18, enabled: () => s.phase === 'storm' && !F()['v4:chunkFound'], action: () => findChunk(s) } as Interactable);
  s.interact.push({ x: SPOTS.jennaBunk[0], y: S4.lower.floor, w: 14, h: 18, label: 'Jenna!', standX: SPOTS.jennaBunk[0] - 20, enabled: () => s.phase === 'storm', action: () => say([
    { who: 'jenna', text: F()['v4:chunkFound'] ? 'You found him!! Okay! Bridge! Go go go, I’m right behind you!' : 'I’m FINE! I’m totally fine! This is fine! FIND CHUNK!', expr: 'scared', style: 'shout' },
  ]).then(() => {}) } as Interactable);
  // barks while searching
  const lines = ['He hates thunder. He hides somewhere small and dark...', 'Chunk! Buddy! Where are you?!', 'Not in my cabin... think. Small. Dark. Near food?'];
  let li = 0;
  const tip = setInterval(() => {
    if (s.phase !== 'storm' || F()['v4:chunkFound']) { clearInterval(tip); return; }
    if (!game.ui.bubbles.active) s.bark('mori', lines[li++ % lines.length], { expr: 'worried' });
  }, 11000);
  // reaching the bridge with Chunk starts the finale
  const watch = setInterval(() => {
    if (F()['v4:bridge']) { clearInterval(watch); return; }
    if (F()['v4:chunkFound'] && !s.cutscene && p.y <= S4.bridge.floor + 2 && p.x > S4.bridge.x0 && p.state !== 'climb') { clearInterval(watch); rogueWave(s); }
  }, 250);
}

async function findChunk(s: ShipScene4) {
  const p = s.player;
  s.cutscene = true;
  p.facing = -1;
  p.poseOverride = 'kneel';
  s.chunk.faceTo(p.x);
  await s.say([
    { who: 'mori', text: 'There you are. Hey. Hey, buddy.', expr: 'worried' },
    { who: 'chunk', text: '*trembling all over*', expr: 'scared', close: false },
    { who: 'mori', text: 'I know. It’s loud. I don’t like it either.', expr: 'sad' },
    { who: 'mori', text: 'C’mere. I’ve got you. I’ve always got you.', expr: 'determined' },
  ]);
  p.poseOverride = null;
  s.carrying = true;
  s.chunk.setExpr('sad');
  p.animMap = { idle: 'carryPupIdle', walk: 'carryPup', run: 'carryPupRun', climb: 'carryPupClimb', crouch: 'carryPupIdle', crouchWalk: 'carryPup', brace: 'carryPupIdle', slip: 'carryPup', jump: 'carryPupIdle', fall: 'carryPupIdle' };
  F()['v4:chunkFound'] = true;
  game.persist();
  s.hud?.refresh(true);
  s.cutscene = false;
  game.ui.toast('Get to the <b>bridge</b>! (forward hatch → deck → roof ladder aft of the deckhouse)', 'STORM', 'coral', 6000);
}

export async function rogueWave(s: ShipScene4) {
  const p = s.player, say = (l: Parameters<ShipScene4['say']>[0]) => s.say(l);
  F()['v4:bridge'] = true;
  game.persist();
  s.phase = 'wave';
  s.cutscene = true;
  s.hud?.show(false);
  p.walkTo(1000, 50).catch(() => {});
  // Jenna made it up too
  s.jenna.x = 952; s.jenna.y = S4.bridge.floor; s.jenna.facing = 1; s.jenna.idleAnim = 'scared'; s.jenna.setAnim('scared');
  await say([
    { who: 'joshu', text: 'There’s my crew. Got the dog? Good lad.', expr: 'serious' },
    { who: 'jenna', text: 'Dad... Dad, what’s THAT?', expr: 'scared' },
  ]);
  // the wall of water rises off the bow
  const wave = new GiantWave(s);
  wave.on = true;
  wave.cx = 1920;
  const L = s.st.addLayer('wave', 1, 0, 0.35, 0.42, 1);
  const li = s.st.layers.indexOf(L), j = s.st.layers.findIndex(x => x.name === 'sea-near');
  s.st.layers.splice(li, 1);
  s.st.layers.splice(j, 0, L);
  L.add(new Custom(0, rr => wave.draw(rr)));
  game.ui.letterbox(true);
  const cam = s.st.cam;
  cam.locked = true;
  let T = 0;
  const up = updater(dt => {
    T += dt;
    cam.zoom += (0.52 - cam.zoom) * Math.min(1, dt * 0.8);
    cam.x += (1480 - cam.x) * Math.min(1, dt * 0.7);
    cam.y += (205 - cam.y) * Math.min(1, dt * 0.7);
    wave.H = Math.min(340, wave.H + dt * 75);
    if (T > 6.5) { wave.cx -= dt * (150 + (T - 6.5) * 130); wave.curl = Math.min(1, wave.curl + dt * 0.45); s.jolt = Math.min(0.3, s.jolt + dt * 0.06); }
    if (Math.random() < dt * 0.6) s.sky.flash({ big: Math.random() < 0.4 });
  });
  s.st.layer('sea-horizon').add(up);
  audio.play('waveCrash', { vol: 0.6 });
  await wait(1800);
  await say([
    { who: 'joshu', text: 'ROGUE WAVE!! GRAB HOLD OF SOMETHING AND DON’T YOU DARE LET GO!', style: 'shout', expr: 'shocked', auto: 2200, close: false },
    { who: 'jenna', text: 'DAAAAAD!!', style: 'shout', expr: 'scared', auto: 1400, close: false },
    { who: 'mori', text: 'I’ve got you, Chunk. I’ve got you.', style: 'whisper', expr: 'scared', auto: 1900, close: false },
  ]);
  for (const a of [s.jenna, s.joshu]) a.setAnim('brace');
  // slow motion as the lip comes over
  game.slowmo = 0.4;
  await new Promise<void>(res => { const chk = () => (wave.cx < 1200 ? res() : requestAnimationFrame(chk)); chk(); });
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
  t.style.cssText = "font-family:'Pixelify Sans',monospace;font-size:clamp(16px,2.4vw,26px);color:#c8d0d8;letter-spacing:0.08em;opacity:0;transition:opacity 1.2s";
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
