// V11 predators: tigerAmbush, the forest's introduction to its predators, played inside whatever
// field scene the group is in (no scene load). Fast and stylish, Dave the Diver style:
//
//   the hush       the birds go quiet and fly off, the ambience drains away, Aroha raises a hand
//   the bulge      the mud of a wallow ahead heaves and two small eyes surface
//   the eruption   the Cerebral Tiger bursts out of the mud and charges the group
//   freeze-frame   slow motion, the camera slams in, the name card: "CEREBRAL TIGER" + Mori's note
//   Aroha          flips in over everyone's heads, lands in front, a three-shot slingshot volley to the
//                  brow, then a pepper-smoke cracker grenade at its feet
//   the retreat    sneezing and stung, it backs into the wallow and sinks out of sight
//   after          Mori terrified, Jenna / Joshu lines if they are there, Chunk peeks out from hiding,
//                  Aroha explains forest predators (and promises Mori a slingshot of his own)
//
// It also documents the sighting (the encyclopedia shows the Cerebral Tiger as sighted) and leaves the
// tiger lurking in its wallow (resting for a good while), so the forest can be photographed and
// survived properly afterwards.

import type { FieldScene } from '../scenes/field';
import type { Actor } from '../../world/actor';
import type { Animal } from '../wild/animal';
import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { AmbushOpts } from './predators';
import { game } from '../game';
import { audio } from '../../core/audio';
import { A } from '../assets';
import { rand, clamp } from '../../core/math';
import { cineTo, cineRelease, cineBars, cineSlowmo } from './cine';
import { attachPredators } from './predators-scene';
import { anim7, predState, onPredator, emitPred, restore } from './predators-core';
import { spawnTiger, addMudWallow, warmTiger, tigerBody, animDur, MudWallow } from './predators-tiger';
import { sfx11, hush } from './predators-sfx';
import { TIGER_ID, TIGER_SPECIES } from './species-tiger';

let running = false;
/** is the ambush playing right now? (scene follower code can check this) */
export const ambushRunning = () => running;
/** the current beat, for tests (window.__ambBeat) */
const beat = (b: string) => { (window as unknown as { __ambBeat?: string }).__ambBeat = b; };

// ------------------------------------------------------------------ timing helpers
/** wait in game time (slow motion stretches it) */
function waitGame(sec: number): Promise<void> {
  return new Promise(res => {
    let acc = 0, last = performance.now();
    const step = (now: number) => {
      const d = Math.min((window as unknown as { __dtCap?: number }).__dtCap ?? 0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!game.paused) acc += d * game.slowmo;
      if (acc >= sec) res(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const waitReal = (sec: number) => new Promise<void>(r => setTimeout(r, sec * 1000));
/** run fn(dt, k) every frame for `sec` game seconds (k: 0..1) */
function during(sec: number, fn: (dt: number, k: number) => void): Promise<void> {
  return new Promise(res => {
    let acc = 0, last = performance.now();
    const step = (now: number) => {
      const d = Math.min((window as unknown as { __dtCap?: number }).__dtCap ?? 0.05, Math.max(0, (now - last) / 1000)) * (game.paused ? 0 : game.slowmo);
      last = now;
      acc += d;
      try { fn(d, clamp(acc / sec)); } catch (e) { console.error(e); }
      if (acc >= sec) res(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ------------------------------------------------------------------ small set dressing
/** a handful of birds bursting out of the canopy and away */
class Flock implements Drawable {
  z = 3;
  dead = false;
  private t = 0;
  private birds: { x: number; y: number; vx: number; vy: number; ph: number }[] = [];
  constructor(x: number, y: number, dir: number) {
    for (let i = 0; i < 7; i++) this.birds.push({ x: x + rand.range(-60, 60), y: y + rand.range(-30, 20), vx: dir * rand.range(50, 110), vy: rand.range(-70, -30), ph: rand.next() * 6 });
  }
  update(dt: number) {
    this.t += dt;
    for (const b of this.birds) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 8 * dt; }
    if (this.t > 5) this.dead = true;
  }
  draw(r: Renderer) {
    const col = packColor(0.12, 0.12, 0.1, clamp(1.5 - this.t * 0.3));
    for (const b of this.birds) {
      const up = Math.sin(this.t * 22 + b.ph) > 0;
      r.draw(A.dot, b.x - 1.5, b.y + (up ? -1 : 0), 2, 1, up ? -0.5 : 0.3, col);
      r.draw(A.dot, b.x + 1.5, b.y + (up ? -1 : 0), 2, 1, up ? 0.5 : -0.3, col);
      r.draw(A.dot, b.x, b.y, 1, 1, 0, col);
    }
  }
}

/** two little glints where the eyes break the mud */
class EyeGlint implements Drawable {
  z = 98;
  dead = false;
  on = 0;
  constructor(readonly a: Animal) {}
  draw(r: Renderer) {
    if (this.on <= 0.01 || this.a.hidden > 0.9) return;
    const b = tigerBody(this.a);
    const [hx, hy] = b.head(this.a);
    const ex = hx + this.a.facing * 6, ey = hy + 13;
    const k = this.on * (0.7 + 0.3 * Math.sin(performance.now() / 120));
    r.fxDraw(A.glow, ex, ey, 0.12, 0.08, 0, packColor(1, 0.75, 0.3, 1), 2.4 * k);
    r.fxDraw(A.spark, ex, ey, 0.5, 0.5, performance.now() / 400, packColor(1, 0.9, 0.6, 1), 1.6 * k);
  }
}

// ------------------------------------------------------------------ the name card
function nameCard(): { show(): void; hide(): Promise<void> } {
  const id = 'v11-namecard-css';
  if (!document.getElementById(id)) {
    const st = document.createElement('style');
    st.id = id;
    st.textContent = `
.v11-card { position: fixed; inset: 0; pointer-events: none; z-index: 40; overflow: hidden; font-family: 'Jersey 10', 'Silkscreen', monospace; }
.v11-card .band { position: absolute; left: -10%; right: -10%; top: 58%; height: 8.6em; transform: rotate(-4deg) translateX(-120%); background:
  linear-gradient(180deg, transparent 0 6%, rgba(12,8,6,0.94) 6% 94%, transparent 94%); box-shadow: 0 0.4em 0 rgba(0,0,0,0.35);
  transition: transform 0.22s cubic-bezier(.2,1.4,.4,1); font-size: clamp(9px, 1.6vmin, 16px); }
.v11-card.on .band { transform: rotate(-4deg) translateX(0); }
.v11-card.off .band { transform: rotate(-4deg) translateX(120%); transition: transform 0.28s cubic-bezier(.6,0,.9,.4); }
.v11-card .band::before, .v11-card .band::after { content: ''; position: absolute; left: 0; right: 0; height: 0.35em; background: #c8402e; }
.v11-card .band::before { top: 6%; } .v11-card .band::after { bottom: 6%; }
.v11-card .ttl { position: absolute; left: 14%; top: 1.1em; color: #fff4dc; font-size: 4.6em; letter-spacing: 0.08em; line-height: 1;
  text-shadow: 0.06em 0.06em 0 #c8402e, 0.12em 0.12em 0 rgba(0,0,0,0.6); transform: scale(1.7); opacity: 0; transition: transform 0.25s cubic-bezier(.2,1.8,.4,1) 0.12s, opacity 0.1s 0.12s; }
.v11-card.on .ttl { transform: scale(1); opacity: 1; animation: v11shake 0.25s steps(3) 0.3s 2; }
.v11-card .sci { position: absolute; left: 14.4%; top: 5.9em; color: #d8c8a8; font-family: 'Pixelify Sans', monospace; font-style: italic; font-size: 1.35em; letter-spacing: 0.06em; opacity: 0; transition: opacity 0.3s 0.35s; }
.v11-card.on .sci { opacity: 0.9; }
.v11-card .tag { position: absolute; left: 6.5%; top: 1.6em; color: #c8402e; border: 0.18em solid #c8402e; padding: 0.1em 0.4em; font-size: 1.5em; transform: rotate(-12deg) scale(2); opacity: 0; transition: transform 0.18s cubic-bezier(.2,1.8,.4,1) 0.45s, opacity 0.1s 0.45s; letter-spacing: 0.1em; }
.v11-card.on .tag { transform: rotate(-12deg) scale(1); opacity: 1; }
.v11-card .note { position: absolute; right: 9%; top: 0.9em; width: 17em; padding: 0.6em 0.9em 0.7em; color: #2a2116; background: #f2e6c8; font-family: var(--hand, 'Segoe Print', 'Comic Sans MS', cursive);
  font-size: 1.3em; line-height: 1.25; transform: rotate(3deg) translateY(-30%); opacity: 0; box-shadow: 0.25em 0.3em 0 rgba(0,0,0,0.45); transition: transform 0.3s cubic-bezier(.2,1.5,.4,1) 0.7s, opacity 0.15s 0.7s;
  clip-path: polygon(0 4%, 6% 0, 14% 3%, 25% 0, 36% 2%, 49% 0, 61% 3%, 73% 0, 86% 2%, 100% 0, 99% 96%, 90% 100%, 78% 97%, 64% 100%, 50% 97%, 37% 100%, 22% 97%, 9% 100%, 0 97%); }
.v11-card.on .note { transform: rotate(3deg) translateY(0); opacity: 1; }
.v11-card .note b { color: #b0301e; font-weight: 700; text-decoration: underline wavy #b0301e; }
.v11-card .note i { display: block; text-align: right; font-size: 0.8em; opacity: 0.75; margin-top: 0.2em; }
@keyframes v11shake { 0% { transform: translate(0, 0); } 33% { transform: translate(0.05em, -0.04em); } 66% { transform: translate(-0.05em, 0.04em); } }
.v11-flash { position: fixed; inset: 0; background: #fff8e8; opacity: 0; pointer-events: none; z-index: 39; transition: opacity 0.35s; }
.v11-flash.on { opacity: 0.55; transition: none; }`;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.className = 'v11-card';
  el.innerHTML = `<div class="band"><div class="tag">PREDATOR</div><div class="ttl">CEREBRAL TIGER</div><div class="sci">${TIGER_SPECIES.sci}</div>
    <div class="note">Hides under the mud. Thinks before it bites. <b>Do NOT</b> be the thing it is thinking about.<i>— M.</i></div></div>`;
  const fl = document.createElement('div');
  fl.className = 'v11-flash';
  return {
    show() {
      document.body.appendChild(fl);
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.classList.add('on'); fl.classList.add('on'); requestAnimationFrame(() => fl.classList.remove('on')); });
    },
    async hide() {
      el.classList.add('off');
      await waitReal(0.32);
      el.remove();
      fl.remove();
    },
  };
}

// ------------------------------------------------------------------ the ambush
interface Held { guide: unknown; buddyMode: string | null }

export async function tigerAmbush(o: AmbushOpts): Promise<void> {
  const s = o.scene as FieldScene;
  if (!s || !s.st || !s.player || !s.main || running) return;
  const ctl = attachPredators(s);
  if (!ctl) return;
  running = true;
  const p = s.player, st = s.st;
  const ground = (x: number) => st.terrain.groundY(x);
  // which side it comes from: +1 = it is ahead to the right and charges left at the group
  const dir: 1 | -1 = o.dir ?? (o.x >= p.x ? 1 : -1);
  // it erupts 150-260 px ahead of Mori on that side, wherever exactly the caller asked
  const x = clamp(p.x + dir * clamp((o.x - p.x) * dir, 150, 260), s.minX + 90, s.maxX - 90);
  const toGroup = -dir as 1 | -1;
  const held: Held = { guide: (s as unknown as { guide: unknown }).guide ?? null, buddyMode: null };
  const buddy = (s as unknown as { buddy?: { mode: string; release(): void } }).buddy;
  const music = s.site?.music;
  let tiger: Animal | null = null;
  let spawnedAroha = false;
  let ar: Actor | null = null;
  const offs: (() => void)[] = [];
  const glint: { g: EyeGlint | null } = { g: null };
  try {
    // ---- take the scene
    s.cutscene = true;
    s.hud?.show(false);
    s.cam?.raise(false);
    ctl.sling.lower();
    p.vx = 0;
    p.state = 'normal';
    p.poseOverride = null;
    p.facing = dir;
    (s as unknown as { guide: unknown }).guide = null;
    if (buddy) { held.buddyMode = buddy.mode; buddy.mode = 'script'; }
    ctl.aroha.script = true;
    for (const a of s.actors.values()) { a.stopWalk(); a.faceTo(x); }
    ar = s.actors.get('aroha') ?? null;
    if (!ar || !ar.visible) {
      // she's not with them: she'll come flying in from behind
      ar = ar ?? s.addActor('aroha', p.x + toGroup * 190, ground(p.x + toGroup * 190), dir);
      ar.x = p.x + toGroup * 190;
      ar.visible = false;
      spawnedAroha = true;
    }
    // the stage: a wallow ahead, the tiger hidden under it (painted now, before the hush)
    const wallow: MudWallow = addMudWallow(s, x, 140);
    warmTiger();
    tiger = spawnTiger(s, x, { lurk: true, facing: toGroup });
    const T = tiger;
    // it comes at the group but never past the spot in front of where Aroha lands
    const stopX = p.x + dir * (34 + 78);
    const adv = (d: number) => { T.x += toGroup * d; if ((T.x - stopX) * dir < 0) T.x = stopX; T.y = ground(T.x); };
    const gy = ground(p.x);
    const tst = predState(T);
    tst.script = true;
    T.setAct('cine', 999);
    T.anim = 'wallow';
    T.hidden = 0.99;
    T.y = wallow.y;
    glint.g = s.main.add(new EyeGlint(T));

    // ---- the hush
    beat('hush');
    cineBars(true);
    const mid = (p.x + x) / 2;
    void cineTo(st, { x: mid, y: gy - 52, zoom: 1.12, secs: 1.4 });
    hush(true, 1.6);
    audio.setMusic('none');
    s.main.add(new Flock(x + dir * 30, ground(x) - 170, dir));
    audio.play('wingFlap', { vol: 0.6, pitch: 0.9 });
    setTimeout(() => audio.play('wingFlap', { vol: 0.45, pitch: 1.2 }), 180);
    const withAroha = !!ar.visible;
    game.ui.bubbles.bark(p.id, withAroha ? '...I don’t hear anything.' : '...Hey. Why did everything just go quiet?', { style: 'whisper', expr: 'worried' } as never);
    await waitGame(1.7);
    if (!spawnedAroha) {
      ar.setAnim(anim7('crouch', 'idle'));
      game.ui.bubbles.bark('aroha', 'Exactly. Nobody move.', { style: 'whisper', expr: 'serious' } as never);
    } else {
      const someone = ['jenna', 'joshu'].find(id => s.actors.get(id)?.visible);
      if (someone) game.ui.bubbles.bark(someone, someone === 'jenna' ? 'Guys? The birds stopped.' : 'Something’s off. Stay close.', { style: 'whisper', expr: 'worried' } as never);
    }
    const chunk = s.actors.get('chunk');
    if (chunk?.visible) { chunk.faceTo(x); chunk.play('bark', 'idle').catch(() => {}); game.ui.bubbles.bark('chunk', 'Grrrr...', { expr: 'angry' } as never); }
    await waitGame(1.1);

    // ---- the mud bulges, two eyes come up
    beat('bulge');
    void cineTo(st, { x: x - dir * 26, y: ground(x) - 44, zoom: 1.6, secs: 1.5, focus: 1 });
    audio.setHeartbeat(0.55);
    await during(1.5, (_d, k) => { wallow.bulge = ease(k) * 0.9; wallow.busy = 1; });
    T.hidden = 0;
    T.anim = 'wallow';
    glint.g.on = 1;
    sfx11('glorp', { x, vol: 1, pitch: 0.6 });
    p.body.setExpr('scared', 0);
    game.ui.bubbles.bark(p.id, '...the mud is looking at me.', { style: 'whisper', expr: 'scared' } as never);
    await during(0.9, (_d, k) => { wallow.bulge = 0.9 + Math.sin(k * 20) * 0.05; });

    // ---- ERUPTION
    beat('erupt');
    wallow.bulge = 0;
    glint.g.on = 0;
    T.anim = 'emerge';
    tigerBody(T).restart();
    tigerBody(T).wet = 1;
    wallow.erupt(x + toGroup * 16, 1.3);
    sfx11('tigerRoar', { x, vol: 1.2, delay: 0.1 });
    game.r.post.flash = 0.5;
    st.shake(7, 0.7);
    emitPred('ambush', { a: T });
    void cineTo(st, { x: (p.x + x) / 2 + dir * 20, y: gy - 50, zoom: 1.3, secs: 0.22 });
    for (const a of [p.body, ...s.actors.values()]) {
      if (!a.visible) continue;
      a.react('jump');
      a.showEmote(a.id === 'aroha' ? 'exclaim' : 'shock', 1.4);
      if (a.id !== 'aroha') a.setExpr('scared', 6);
    }
    p.poseOverride = 'surprised';
    if (chunk?.visible) chunk.play('jump', 'hide').catch(() => {});
    await waitGame(animDur('emerge') * 0.92);

    // ---- the charge, and the freeze-frame
    beat('charge');
    T.anim = 'charge';
    let v = 40;
    await during(0.42, dt => { v = Math.min(150, v + 340 * dt); adv(v * dt); T.vx = toGroup * v; });
    cineSlowmo(0.04);
    const card = nameCard();
    void cineTo(st, { x: T.x + toGroup * 18, y: T.y - 34, zoom: 2.3, secs: 0.3, focus: 1 });
    sfx11('sting', { vol: 1 });
    card.show();
    beat('card');
    await waitReal(2.5);
    await card.hide();
    cineSlowmo(0.32);

    // ---- Aroha flips in over everyone and lands in front
    beat('flip');
    const land = p.x + dir * 34;
    const flipFrom = ar.x;
    ar.visible = true;
    ar.alpha = 1;
    ar.faceTo(T.x);
    ar.play(anim7('flipBack', 'vault', 'jump'), anim7('landCrouch', 'crouch')).catch(() => {});
    audio.play('whoosh', { vol: 0.8, pitch: 0.9 });
    void cineTo(st, { x: (land + T.x) / 2 - dir * 10, y: gy - 40, zoom: 1.65, secs: 0.6 });
    const flipDur = 0.5;
    await during(flipDur, (dt, k) => {
      ar!.x = flipFrom + (land - flipFrom) * ease(k);
      ar!.y = ground(clamp(ar!.x, s.minX + 4, s.maxX - 4));
      ar!.oy = -Math.sin(k * Math.PI) * 46;
      // the tiger keeps coming, in slow motion
      adv(70 * dt);
    });
    ar.oy = 0;
    ar.x = land;
    ar.y = ground(land);
    ar.play(anim7('landCrouch', 'crouch'), anim7('slingReady', 'slingAim')).catch(() => {});
    st.shake(1.5, 0.15);
    for (let i = 0; i < 8; i++) s.main.particles.spawn({ frame: A.dot2, x: land + rand.range(-8, 8), y: ground(land) - 1, vx: rand.range(-50, 50), vy: rand.range(-40, -10), ay: 160, life: 0.6, color: [0.5, 0.42, 0.3], alpha: 0.8, alpha1: 0 });
    game.ui.bubbles.bark('aroha', 'OI! Not today!', { style: 'shout', expr: 'determined' } as never);
    cineSlowmo(0.6);

    beat('volley');
    // ---- the volley: three pebbles to the brow, each one a flinch, then it skids to a stop
    let hits = 0;
    offs.push(onPredator((ev, info) => {
      if (ev !== 'hit' || info.a !== T) return;
      hits++;
      tigerBody(T).restart();
      T.anim = 'flinch';
    }));
    for (let i = 0; i < 3; i++) {
      ar.idleAnim = anim7('slingDraw', 'slingAim');
      ar.setAnim(ar.idleAnim);
      if (ar.idleAnim === 'slingAim') ar.holdFrame = 1;
      await during(0.13, dt => adv((hits ? 30 : 90) * dt));
      ctl.aroha.shootAt(ar, T, 0.5);
      ar.setAnim(anim7('slingRelease', 'slingshot'));
      if (anim7('slingRelease', 'slingshot') === 'slingshot') ar.holdFrame = 2;
      await during(0.2, dt => { adv((hits ? 20 : 70) * dt); if (T.anim === 'flinch' && tigerBody(T).done) T.anim = 'charge'; });
    }
    cineSlowmo(1);
    await during(0.35, dt => adv(20 * dt));
    // it skids to a halt and roars in her face
    beat('roar');
    T.anim = 'roar';
    tigerBody(T).restart();
    sfx11('tigerRoar', { x: T.x, vol: 1.1 });
    st.shake(3, 0.8);
    void cineTo(st, { x: (ar.x + T.x) / 2, y: gy - 42, zoom: 1.55, secs: 0.5 });
    await waitGame(animDur('roar') * 0.7);

    // ---- the grenade: pepper smoke and crackers at its feet
    beat('grenade');
    ar.holdFrame = null;
    ar.play(anim7('grenadeThrow', 'point'), anim7('slingReady', 'slingAim')).catch(() => {});
    await waitGame(0.22);
    ctl.aroha.throwAt(ar, T, 'combo');
    await waitGame(0.55);
    T.anim = 'flinch';
    tigerBody(T).restart();
    sfx11('sneeze', { x: T.x, delay: 0.5 });
    sfx11('sneeze', { x: T.x, delay: 1.4, pitch: 1.1 });
    await waitGame(0.5);
    T.anim = 'shake';
    await waitGame(0.9);

    // ---- the retreat: back into the mud, a last glare, gone
    beat('retreat');
    T.anim = 'retreat';
    sfx11('tigerGrowl', { x: T.x });
    const backTo = wallow.x;
    const x0 = T.x;
    await during(1.5, (_dt, k) => { T.x = x0 + (backTo - x0) * ease(k); T.y = ground(T.x); T.vx = -toGroup * 25; T.facing = toGroup; });
    T.x = wallow.x; T.y = wallow.y; T.vx = 0;
    T.anim = 'submerge';
    tigerBody(T).restart();
    sfx11('glorp', { x: T.x, pitch: 0.5, vol: 1 });
    await waitGame(animDur('submerge'));
    T.anim = 'wallow';
    glint.g.on = 1;
    await waitGame(0.7);
    glint.g.on = 0;
    T.hidden = 0.99;
    sfx11('glorp', { x: T.x, pitch: 0.7 });
    emitPred('submerge', { a: T });
    audio.setHeartbeat(0);
    hush(false, 3);

    // ---- everyone reacts
    beat('talk');
    p.poseOverride = anim7('sitShock', 'scared');
    void cineTo(st, { x: (p.x + ar.x) / 2, y: gy - 46, zoom: 1.35, secs: 0.8 });
    const lines: { who: string; text: string; expr?: string; style?: 'shout' | 'whisper' | 'say'; onShow?: () => void; auto?: number }[] = [];
    lines.push({ who: p.id, text: 'W-w-what... WHAT was THAT?!', expr: 'shocked', style: 'shout' });
    if (s.actors.get('jenna')?.visible) lines.push({ who: 'jenna', text: 'It had a FOREHEAD. Why did the mud monster have a forehead?!', expr: 'shocked' });
    if (s.actors.get('joshu')?.visible) lines.push({ who: 'joshu', text: 'Forty years at sea. Never seen a cat climb out of a puddle.', expr: 'surprised' });
    if (chunk?.visible) lines.push({ who: 'chunk', text: '...whimper.', expr: 'sad', onShow: () => { chunk.play('shake', 'idle').catch(() => {}); } });
    lines.push(
      { who: 'aroha', text: 'Cerebral tiger. Built like a hippo, thinks like a chess player. It lies in the wallows with just its eyes out and waits for something to walk close.', expr: 'serious', onShow: () => { ar!.setAnim('idle'); ar!.faceTo(p.x); } },
      { who: 'aroha', text: 'The forest is full of hunters like that. They hide, they test you, and they hate a fair fight. Stand tall. Make noise. Sting them on the brow. And never, ever run.', expr: 'serious' },
      { who: p.id, text: 'Never run. Right. Got it. Noted. My legs did NOT get the memo.', expr: 'worried', onShow: () => { p.poseOverride = null; } },
      { who: 'aroha', text: 'You need a slingshot of your own, Mori. I’ll show you how to make one.', expr: 'determined' },
      { who: p.id, text: 'Yes. Yes please. Today. Ideally right now.', expr: 'nervous' },
    );
    await s.say(lines as never);
  } catch (e) {
    console.error('[tigerAmbush]', e);
  } finally {
    for (const f of offs) f();
    if (glint.g) glint.g.dead = true;
    document.querySelectorAll('.v11-card, .v11-flash').forEach(e => e.remove());
    cineSlowmo(1);
    cineBars(false);
    audio.setHeartbeat(0);
    hush(false, 2);
    if (music) audio.setMusic(music);
    if (ar) { ar.oy = 0; ar.holdFrame = null; ar.idleAnim = spawnedAroha ? 'idle' : ar.idleAnim.startsWith('sling') ? 'idle' : ar.idleAnim; ar.setAnim(ar.idleAnim); }
    p.poseOverride = null;
    p.frozen = false;
    // the tiger: home in its wallow, resting a good while before it hunts again
    if (tiger) {
      const tst = predState(tiger);
      tst.script = false;
      restore(tiger);
      tst.rest = 150;
      tst.phase = 'lurk';
      tiger.setAct('lurk', 60);
      tiger.mem.under = 1;
      tiger.mem.dip = 6;
    }
    documentSighting(s, x);
    game.save.flags['v11:tigerMet'] = true;
    game.save.flags['v11:slingPromise'] = true;
    game.persist();
    await cineRelease(st, 0.8).catch(() => {});
    (s as unknown as { guide: unknown }).guide = held.guide;
    if (buddy && held.buddyMode !== null) buddy.release();
    ctl.aroha.script = false;
    s.cutscene = false;
    s.hud?.show(true);
    // a stand-in Aroha heads off again
    if (spawnedAroha && ar) {
      const a = ar;
      game.ui.bubbles.bark('aroha', 'I’ll be close. Stay out of the mud.', { expr: 'serious' } as never);
      a.walkTo(a.x + toGroup * 260, 90, 'run').then(() => { a.visible = false; }).catch(() => {});
    }
    emitPred('ambushEnd', { a: tiger });
    beat('done');
    running = false;
  }
}

/** the sighting goes into the field notes, filed at once: the encyclopedia shows the tiger as sighted */
async function documentSighting(s: FieldScene, x: number) {
  try {
    const [reg, r9] = await Promise.all([import('../v10/regions'), import('../v9/research9')]);
    const run = (await import('../v10/field10')).run as unknown as { loc?: string } | null;
    const loc = run?.loc ?? s.site?.id ?? 'forest';
    const id = 'sp:' + TIGER_ID;
    reg.discover({ id, kind: 'species', name: TIGER_SPECIES.name, loc, x: Math.round(x), icon: TIGER_ID, note: 'Burst out of a mud wallow and charged us. Aroha drove it off.' } as never, true);
    const d = reg.discoveries().find(q => q.id === id);
    if (d) r9.fileNote(d);
    game.ui.toast(`New field note: <b>${TIGER_SPECIES.name}</b>. Sighted, no photo yet. Get one. From far away.`, 'RESEARCH', 'teal', 5200);
  } catch (e) { console.warn('[tigerAmbush] sighting', e); }
}

