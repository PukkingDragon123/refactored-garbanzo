// V12 five more field events: short set pieces drawn into the expedition events table
// (src/game/v10/events.ts EVENTS, weighted; each fires a little while into a visit). Every one has a
// tell, a choice or an action, and a reward:
//
//   stampede     a rumble in the ground, dust on the skyline, then a herd comes thundering through.
//                Dive flat (a QTE), duck into cover and hold still (the herd parts round you, slow
//                motion, the photograph of the trip), or stand there and get flattened.
//   foghunt      fog rolls in and something with eyes circles in it. Get low, keep still: it loses you
//                and walks past (photograph it going). Move, and it comes for you.
//   rival        Teo from Helix spots the same animal and races you to it, camera up: beat him to a
//                good photograph before the watch runs out (bonus RP), or watch his flash scare it off.
//   flashflood   Te Tuawhenua's braided river: rain in the ranges, the river turns brown and rises.
//                Sprint for the banks on your stamina or scramble up a boulder; too slow and it takes you.
//   eyes         after dark a ring of glowing eyes closes in. Stay still and they come to look at you,
//                a whole mob of night animals: a rare night photograph. Move and they're gone.
//
// FX are small pixel particles and pixel rects (the water, the eyes, dust), no soft sprites.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { TripRun } from '../v10/field10';
import type { TripEvent } from '../v10/events';
import { EVENTS } from '../v10/events';
import type { Animal } from '../wild/animal';
import type { RawPhoto } from '../photos';
import { judgeSubject } from '../photos';
import { SPECIES_BY_ID } from '../species';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import type { Renderer } from '../../gfx/renderer';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { rand, clamp } from '../../core/math';
import { floatText, floatNotice, floatChoices } from '../../ui/v12/float';
import { cineShake, cineSlowmo, cineBars } from '../v11/cine';
import { isPredator } from '../v11/predators-core';
import { hitMori, moriHidden } from './wilds';
import { qte } from './qte';
import { STAMINA_ZL } from './stamina';
import { addHunger } from './hunger';
import { dayNumber } from '../v10/day';
import { addNote } from '../v10/regions';
import { tr } from '../v10/translator';
import { TUA } from './backcountry/gen';
import { tuaGround } from './backcountry/gen';

// ------------------------------------------------------------------ helpers
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
const live = (f: FieldScene) => game.scene === (f as never);
const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };
const V = (k: string) => game.save.vars[k] ?? 0;
const bump = (k: string, n = 1) => { game.save.vars[k] = V(k) + n; game.persist(); };
function addRP(n: number, why: string) {
  const s = game.save;
  s.rp += n;
  s.totalRp += n;
  game.persist();
  floatNotice(`${why} +${n} RP`, 3000, { tag: 'FIELD', accent: '#7fe0d0' });
}
type Style = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'laugh' | 'sad' | 'think';
const mori = (text: string, style: Style = 'say', ms = 2600) => floatText({ text, style, ms });
/** Aroha, through the translator, only if she came along */
function aroha(r: TripRun, text: string, style: 'say' | 'whisper' | 'shout' = 'say') {
  if (!r.guide) return;
  const t = tr(text, { style: style === 'say' ? undefined : style }).text;
  game.ui.bubbles.bark('aroha', t, { style } as never);
}
const note = (r: TripRun, id: string, text: string) => addNote({ id, loc: r.loc, x: Math.round(r.p.x), text });

/** shots taken in a scene go to whoever is listening right now (one chain per scene) */
type ShotFn = (ph: RawPhoto) => void;
const shotFns = new WeakMap<FieldScene, Set<ShotFn>>();
function onShots(f: FieldScene, fn: ShotFn): () => void {
  let set = shotFns.get(f);
  if (!set) {
    const s = new Set<ShotFn>();
    set = s;
    shotFns.set(f, s);
    const go = (n = 0) => {
      if (!f.cam) { if (n < 40) setTimeout(() => go(n + 1), 300); return; }
      const prev = f.cam.onShot;
      f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); for (const g of [...s]) { try { g(ph); } catch (e) { console.warn('[fieldevents] shot', e); } } };
    };
    go();
  }
  set.add(fn);
  return () => { set!.delete(fn); };
}
/** identified subjects of a species in a photo */
const ids = (ph: RawPhoto, sp: string) => ph.subjects.filter(s => s.species === sp && judgeSubject(s, ph).identified);
function dust(f: FieldScene, x: number, y: number, n: number, k = 1) {
  const P = f.main.particles;
  for (let i = 0; i < n; i++) P.spawn({ frame: A.dot2, x: x + rand.range(-10, 10), y: y - rand.range(0, 4), vx: rand.range(-30, 30) * k, vy: rand.range(-40, -10) * k, ay: 60, life: rand.range(0.6, 1.2), color: [0.62, 0.54, 0.42], alpha: 0.7, alpha1: 0, floorY: y + 2, onFloor: 'die' });
}
/** drive an animal by hand (its brain off), so a set piece goes where it should */
function holdAnimal(a: Animal) { a.held = true; a.noticed = true; }
function freeAnimal(a: Animal) { a.held = false; }

const OPEN_LAND = new Set(['backcountry', 'fernwood', 'forest', 'hills', 'coast', 'geovalley', 'fossils', 'falls']);
const MISTY = new Set(['fernwood', 'forest', 'canopy', 'swamp', 'mangrove', 'backcountry', 'ruins', 'glowforest', 'falls', 'hills']);
const DARKOK = (loc: string) => loc !== 'deep' && loc !== 'grotto' && loc !== 'deepcave' && loc !== 'village';

// ================================================================== 1. the stampede
const STAMPEDERS = ['torhopper', 'boneface', 'quillhog', 'strider'];
async function stampede(r: TripRun) {
  const f = r.f, p = r.p;
  const here = new Set((f.site.spawns ?? []).map(s => s.species));
  const sp = STAMPEDERS.find(s => here.has(s) && SPECIES_BY_ID[s]) ?? STAMPEDERS.find(s => SPECIES_BY_ID[s]);
  if (!sp) return;
  const name = SPECIES_BY_ID[sp].name;
  const side: 1 | -1 = p.facing >= 0 ? 1 : -1;
  // the tell: the ground hums, then shakes; dust on the skyline ahead
  void mori('...Do you feel that? The ground is... humming.', 'whisper', 2400);
  aroha(r, 'Shh. Feel it in your feet. Something big is running. A lot of something.', 'whisper');
  for (let i = 0; i < 5 && live(f); i++) {
    audio.play('thunderClose' as never, { vol: 0.16 + i * 0.08, pitch: 0.38 + i * 0.02 });
    cineShake(1 + i * 0.7, 0.8, f.st);
    dust(f, p.x + side * (520 - i * 40), r.groundAt(p.x + side * (520 - i * 40)), 6 + i * 3, 1.4);
    await sleep(850);
  }
  if (!live(f)) return;
  const n0 = f.animals.length;
  const x0 = clamp(p.x + side * 640, 60, f.site.width - 60);
  f.spawnRule({ species: sp, n: [5, 7], x: [x0 - 50, x0 + 50], herd: true, chance: 1 }, false);
  const herd = f.animals.slice(n0).filter(a => a.species === sp);
  if (!herd.length) return;
  const spd = new Map<Animal, number>();
  for (const a of herd) { holdAnimal(a); a.act = 'flee'; a.anim = 'run'; a.facing = -side; spd.set(a, rand.range(205, 250)); a.x += rand.range(-30, 60) * side; }
  audio.setDanger(0.8);
  void mori(`${name.toUpperCase()}S! A whole herd! Coming straight at me!`, 'shout', 2200);
  // the choice, fast: the watch is the herd
  let plan = 'stand' as 'dive' | 'cover' | 'stand';
  let safe = false, dived = false;
  let bonusPaid = false;
  const off = onShots(f, ph => {
    if (bonusPaid) return;
    const got = ids(ph, sp);
    if (got.length < 2) return;
    bonusPaid = true;
    const inside = plan === 'cover' && safe;
    addRP(inside ? 45 : 22, inside ? 'From inside the stampede' : 'The stampede');
    setF('fe:stampede:photo');
    setTimeout(() => void mori(inside ? 'From INSIDE the herd. Nobody has a picture like this. Nobody sane.' : 'Got them! Blurry hooves of doom, but got them.', 'happy', 2800), 500);
  });
  let done = false, impact = false, t = 0;
  r.tickers.push(dt => {
    if (done) return;
    t += dt;
    for (const a of herd) {
      if (a.gone || !a.held) continue;
      const v = spd.get(a) ?? 220;
      a.x += -side * v * dt;
      a.vx = -side * v;
      a.y = r.groundAt(a.x);
      a.anim = 'run';
      if (rand.chance(dt * 9)) dust(f, a.x, a.y, 2);
      if ((a.x - p.x) * -side > 650) { a.gone = true; }
    }
    // (a dive being made is resolved when its QTE is: the herd goes over him meanwhile)
    if (!impact && (plan !== 'dive' || dived) && herd.some(a => (a.x - p.x) * -side > -24)) {
      impact = true;
      if (plan === 'cover' && moriHidden(f)) { safe = true; cineSlowmo(0.3); setTimeout(() => cineSlowmo(1, 0.6), 1100); cineShake(3, 1.2, f.st); }
      else if (plan === 'dive' && safe) { cineShake(2, 0.6, f.st); }
      else { safe = false; hitMori(f, p.x + side * 30, { sev: plan === 'cover' ? 3 : 2, drop: true }); }
    }
    if (t > 16 || herd.every(a => a.gone)) {
      done = true;
      for (const a of herd) if (!a.gone) freeAnimal(a);
    }
  });
  const pick = await floatChoices([{ text: 'Dive flat!' }, { text: 'Duck into cover, hold still' }, { text: 'Stand and shoot' }], { timeout: 1.8, watch: true });
  plan = pick === 0 ? 'dive' : pick === 1 ? 'cover' : 'stand';
  if (plan === 'dive') {
    const res = await qte({ kind: 'ring', f, label: 'DIVE!', difficulty: 0.5 });
    safe = res.ok;
    dived = true;
    if (res.ok) {
      p.vx = -side * 60; p.vy = -60; p.onGround = false;
      p.poseOverride = 'fallBack';
      setTimeout(() => { if (p.poseOverride === 'fallBack') p.poseOverride = null; }, 1300);
    }
  } else if (plan === 'cover') {
    void floatText({ text: 'Get LOW. Crouch!', style: 'think', ms: 1400 });
    p.crouch = true;
  }
  // wait for it to pass
  for (let i = 0; i < 60 && !done && live(f); i++) await sleep(200);
  off();
  audio.setDanger(0);
  if (!live(f)) return;
  bump('fe:stampedes');
  if (safe) {
    addRP(plan === 'cover' ? 20 : 12, plan === 'cover' ? 'Held your ground' : 'Dived clear');
    void mori(plan === 'cover' ? 'They went round me. Like a river round a rock. Did that... did that just happen?' : 'Face full of dirt. Still alive. I’ll take it.', 'happy', 3000);
    aroha(r, plan === 'cover' ? 'You stayed still. They thought you were a stump. Clever stump.' : 'Ha! You dive like a kererū. Are you hurt?');
  } else {
    void mori('Ow. Ow. Everything. I am a doormat. A very flat photographer.', 'sad', 2800);
    aroha(r, 'Next time, get down or get in the scrub. Up, come on.');
  }
  note(r, 'note:stampede:' + dayNumber(), `A ${name.toLowerCase()} stampede came through here.`);
}

// ================================================================== 2. the hunt in the fog
const STALKERS = ['boneface', 'sprinter', 'flicker'];
async function fogHunt(r: TripRun) {
  const f = r.f, p = r.p, st = f.st;
  let fogT = 55;
  const prev = st.envHook;
  st.envHook = (env, dt) => {
    prev?.(env, dt);
    const k = Math.max(0, Math.min(1, fogT / 8, (55 - fogT) / 5)) * 0.78;
    if (k <= 0) return;
    env.fogTop = [env.fogTop[0] + (0.72 - env.fogTop[0]) * k, env.fogTop[1] + (0.76 - env.fogTop[1]) * k, env.fogTop[2] + (0.78 - env.fogTop[2]) * k];
    env.fogBottom = [env.fogBottom[0] + (0.8 - env.fogBottom[0]) * k, env.fogBottom[1] + (0.84 - env.fogBottom[1]) * k, env.fogBottom[2] + (0.84 - env.fogBottom[2]) * k];
    env.contrast -= 0.25 * k;
  };
  aroha(r, 'Fog. Fast. Stay close to me.', 'whisper');
  void mori('Where did THAT come from? I can’t see my own boots.', 'whisper', 2400);
  // the eyes: one pair that means it, and a couple of glints that might be nothing
  const side: 1 | -1 = rand.chance(0.5) ? 1 : -1;
  let watch = 0.15, ang = side > 0 ? 0 : Math.PI, phase = 'stalk' as 'stalk' | 'lunge' | 'gone', still = 0, t = 0;
  const phaseNow = () => phase;
  const eyes = { x: p.x + side * 240, y: p.y - 26, blink: 0 };
  const decoys = [0, 1, 2].map(i => ({ x: p.x + rand.range(-300, 300), y: p.y - rand.range(14, 50), ph: rand.range(0, 6), on: i < 2 }));
  const EYE = packColor(1, 0.78, 0.3, 1), DECOY = packColor(0.7, 0.95, 0.6, 1);
  const drawEye = (rr: Renderer, x: number, y: number, c: number, k: number) => {
    rr.fxRect(Math.round(x) - 2, Math.round(y), 1, 1, c, 2.6 * k, true);
    rr.fxRect(Math.round(x) + 2, Math.round(y), 1, 1, c, 2.6 * k, true);
  };
  f.main.add(new Custom(62, rr => {
    if (phase === 'gone' || fogT <= 0) return;
    const fade = Math.min(1, (55 - fogT) / 6, fogT / 4);
    if (eyes.blink <= 0) drawEye(rr, eyes.x, eyes.y, EYE, fade * (0.6 + watch * 0.6));
    for (const d of decoys) if (d.on && Math.sin(t * 0.7 + d.ph) > 0.4) drawEye(rr, d.x, d.y, DECOY, fade * 0.5);
  }));
  let ended = false;
  r.tickers.push(dt => {
    if (ended) return;
    fogT = Math.max(0, fogT - dt);
    t += dt;
    if (phase !== 'stalk') return;
    const moving = Math.abs(p.vx) > 10 || p.running || !p.onGround;
    const low = moriHidden(f) || (p.crouch && Math.abs(p.vx) < 6);
    watch += moving ? dt * (p.running ? 0.32 : 0.16) : low ? -dt * 0.06 : dt * 0.02;
    watch = clamp(watch, 0, 1.05);
    if (!moving && low) still += dt;
    audio.setDanger(0.3 + watch * 0.7);
    // it circles, closer the more it has of him
    ang += dt * (0.35 + watch * 0.4);
    const dist = 250 - watch * 205;
    eyes.x += (p.x + Math.cos(ang) * dist - eyes.x) * Math.min(1, dt * 1.5);
    eyes.y = r.groundAt(eyes.x) - 24 - Math.sin(t * 1.3) * 2;
    eyes.blink -= dt;
    if (rand.chance(dt * 0.4)) eyes.blink = 0.15;
    if (rand.chance(dt * (0.15 + watch * 0.3))) f.sfx('callGrowl', eyes.x, 0.25 + watch * 0.35, 0.55);
    if (watch >= 1) phase = 'lunge';
    else if (still > 16 || fogT < 8) phase = 'gone';
  });
  while (phaseNow() === 'stalk' && live(f)) await sleep(200);
  ended = true;
  audio.setDanger(0);
  if (!live(f)) return;
  if (phaseNow() === 'lunge') {
    f.sfx('roar', eyes.x, 0.8, 0.8);
    game.r.post.flash = Math.max(game.r.post.flash, 0.35);
    cineShake(6, 0.5, f.st);
    hitMori(f, eyes.x, { sev: 2, drop: true });
    phase = 'gone';
    await sleep(1600);
    void mori('It came out of NOWHERE. All teeth and fog. I never even saw it.', 'scared', 3000);
    aroha(r, 'You moved. In fog, the hunter hunts what moves. Next time, be a stone.');
    return;
  }
  phase = 'gone';
  // it lost him: and walks right past, out of the fog
  const sp = STALKERS.find(s => (f.site.spawns ?? []).some(x => x.species === s) && SPECIES_BY_ID[s]) ?? STALKERS.find(s => SPECIES_BY_ID[s]);
  void mori('...It’s going. It lost me. Don’t. Breathe.', 'whisper', 2400);
  addRP(18, 'Kept still in the fog');
  bump('fe:fogsurvived');
  if (!sp) return;
  const dir: 1 | -1 = eyes.x > p.x ? 1 : -1;
  const n0 = f.animals.length;
  const sx = clamp(p.x + dir * 130, 60, f.site.width - 60);
  f.spawnRule({ species: sp, n: [1, 1], x: [sx, sx + 2], chance: 1 }, false);
  const a = f.animals[n0];
  if (!a || a.species !== sp) return;
  holdAnimal(a);
  a.facing = dir;
  a.anim = 'walk';
  a.act = 'wander';
  let shot = false;
  const off = onShots(f, ph => {
    if (shot || !ids(ph, sp).length) return;
    shot = true;
    addRP(30, `The ${SPECIES_BY_ID[sp].name} in the fog`);
    setF('fe:fog:photo');
  });
  let tt = 0;
  r.tickers.push(dt => {
    if (a.gone || !a.held) return;
    tt += dt;
    a.x += dir * 34 * dt;
    a.vx = dir * 34;
    a.y = r.groundAt(a.x);
    a.anim = 'walk';
    if (tt > 14) { a.gone = true; off(); }
  });
  setTimeout(() => { if (!shot) void floatText({ text: 'It walked right past me. Close enough to smell. Camera, CAMERA...', style: 'think', ms: 2600 }); }, 1800);
}

// ================================================================== 3. the rival photographer
async function rival(r: TripRun) {
  const f = r.f, p = r.p;
  const side: 1 | -1 = p.facing >= 0 ? 1 : -1;
  // the animal they both want: something in view, harmless, not hiding; else one turns up
  let target: Animal | null = f.animals
    .filter(a => !a.gone && !a.dead && a.hidden < 0.5 && SPECIES_BY_ID[a.species] && (SPECIES_BY_ID[a.species].danger ?? 0) < 2 && !isPredator(a) && Math.abs(a.x - p.x) < 650)
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] ?? null;
  if (!target) {
    const sp = rand.pick((f.site.spawns ?? []).filter(s => (!s.medium || s.medium === 'ground') && !s.poi && (!s.times || s.times.includes(f.tod))));
    if (!sp) return;
    const n0 = f.animals.length;
    const x = clamp(p.x + side * 300, 60, f.site.width - 60);
    f.spawnRule({ ...sp, n: [1, 1], x: [x - 10, x + 10], chance: 1, later: false, poi: undefined, when: undefined, times: undefined }, false);
    target = f.animals[n0] ?? null;
  }
  if (!target) return;
  const tgt = target;
  const name = SPECIES_BY_ID[tgt.species]?.name ?? tgt.species;
  // Teo, camera up, from behind Mori
  try { (await import('../../art/v11/npcs/register')).registerNpcArt(); } catch { /* */ }
  if (!live(f)) return;
  const mine = !f.actors.has('teo');
  const tx0 = clamp(p.x - side * 200, 40, f.site.width - 40);
  let teo: import('../../world/actor').Actor | null = null;
  try { teo = f.actors.get('teo') ?? f.addActor('teo', tx0, r.groundAt(tx0), side); teo.z = 44; } catch { teo = null; }
  const teoSay = (text: string, style: Style = 'say', ms = 2400) => floatText(teo ? { actor: 'teo', text, style, ms } : { text, style, ms, name: 'Teo', color: '#3a7ac8' });
  void teoSay(`MORI! Is that a ${name}? Dr Varga pays a bonus for the first good shot! Race you!`, 'shout', 2600);
  await sleep(1200);
  void mori('Oh, it is ON, Teo.', 'happy', 1800);
  audio.setDanger(0.35);
  let won = false, lost = false;
  const off = onShots(f, ph => {
    if (won || lost) return;
    const ok = ph.subjects.some(s => s.species === tgt.species && judgeSubject(s, ph).identified && judgeSubject(s, ph).stars >= 2);
    if (ok) won = true;
  });
  const { showWatch } = await import('../../ui/v12/watch');
  const SECS = 40;
  const w = showWatch({ mode: 'countdown', secs: SECS, anchor: 'mori', onEnd: () => { if (!won) lost = true; } });
  // Teo hurries toward it, re-aiming as it moves
  let t = 0, at = 0;
  while (!won && !lost && live(f) && t < SECS + 2) {
    if (teo) {
      const d = tgt.x - teo.x;
      if (Math.abs(d) > 46) { void teo.walkTo(tgt.x - Math.sign(d) * 40, 44); at = 0; }
      else { at += 0.25; teo.faceTo(tgt.x); if (at > 2.2) lost = true; }
    } else if (t > SECS * 0.7) lost = true;
    if (tgt.gone || tgt.dead) lost = true;
    await sleep(250);
    t += 0.25;
  }
  w.close();
  off();
  audio.setDanger(0);
  if (!live(f)) return;
  if (won) {
    addRP(35, `Beat Teo to the ${name}`);
    bump('fe:rival:won');
    void teoSay('No WAY. You were so fast! ...Okay, yours is better anyway. Don’t tell Dr Varga I said that.', 'laugh', 3000);
    void import('../v11/social').then(m => m.addAffinity('teo', 4, 'a photo race')).catch(() => {});
  } else {
    // his flash goes off; the animal bolts
    game.r.post.flash = Math.max(game.r.post.flash, 0.3);
    audio.play('shutter', { vol: 0.6 });
    tgt.fear = 1; tgt.aw = 1.2;
    if (teo) tgt.threat = { kind: 'point', x: teo.x, y: teo.y } as never;
    void teoSay('Got it! ...Oh. Oops. The flash. Sorry, sorry! It’s gone. My bad.', 'say', 2800);
    setTimeout(() => void mori('He LEFT THE FLASH ON. In daylight. Teo. Teo, buddy.', 'laugh', 2600), 2400);
  }
  await sleep(3600);
  if (teo && mine && live(f)) {
    const away = clamp(teo.x - side * 600, 20, f.site.width - 20);
    await Promise.race([teo.walkTo(away, 50), sleep(9000)]);
    if (live(f)) { teo.layer?.remove(teo); f.actors.delete('teo'); }
  }
}

// ================================================================== 4. the flash flood on the braids
async function flashFlood(r: TripRun) {
  const f = r.f, p = r.p;
  const fl = TUA.S.flats;
  const z0 = fl.x0 + 90, z1 = fl.x1 - 90;
  // it waits for Mori to be out on the flats
  for (let i = 0; i < 1200 && live(f); i++) {
    if (p.x > z0 + 200 && p.x < z1 - 200 && !f.cutscene && !game.ui.blocking) break;
    await sleep(500);
  }
  if (!live(f) || p.x < z0 || p.x > z1) return;
  const G = (x: number) => tuaGround(x);
  // the tell: rain somewhere up in the ranges, the river's voice, sticks coming down
  audio.play('thunder' as never, { vol: 0.3, pitch: 0.8 });
  void mori('Thunder? It’s sunny. ...Up in the ranges, it isn’t.', 'think', 2400);
  aroha(r, 'Listen to the river. It’s changed its voice. Mori, get off the stones. NOW.', 'shout');
  await sleep(2600);
  if (!live(f)) return;
  void mori('It’s brown. The water’s BROWN. And it’s... coming UP.', 'scared', 2200);
  audio.setDanger(0.7);
  const MAX = 30, RISE = 15, HOLD = 9, FALL = 8;
  let t = 0, done = false;
  const level = (x: number) => {
    const k = t < RISE ? t / RISE : t < RISE + HOLD ? 1 : Math.max(0, 1 - (t - RISE - HOLD) / FALL);
    const edge = clamp(Math.min(x - z0, z1 - x) / 260, 0, 1);
    return MAX * k * k * (0.35 + 0.65 * edge);
  };
  // the boulders become islands (stand on them: a platform on top), and can be scrambled up
  const rocks = TUA.boulders.filter(b => b.x > z0 + 60 && b.x < z1 - 60 && b.h >= 10);
  for (const b of rocks) f.st.terrain.addPlatform([[b.x - b.w / 2 + 3, G(b.x) - b.h + 2], [b.x + b.w / 2 - 3, G(b.x) - b.h + 2]], 'rock');
  let onRock = false;
  for (const b of rocks) {
    (f.interact as import('../../world/npc').Interactable[]).push({
      x: b.x, y: G(b.x), w: Math.round(b.w / 2) + 8, h: 20, standX: b.x - b.w / 2 - 6,
      label: 'Scramble up the boulder!', enabled: () => !done && t > 0 && !onRock,
      action: async () => {
        const res = await qte({ kind: 'seq', f, count: 4, time: 3.2, label: 'CLIMB!', difficulty: 0.45, pose: 'climb' });
        if (!res.ok) { void mori('Slipped! Again!', 'scared', 1400); return; }
        p.x = b.x; p.y = G(b.x) - b.h + 1; p.vy = 0; p.vx = 0;
        onRock = true;
      },
    });
  }
  // the water: a muddy, foaming band over the flats, painted a pixel column at a time
  const MUD = [packColor(0.36, 0.27, 0.17, 0.9), packColor(0.42, 0.32, 0.2, 0.88), packColor(0.3, 0.22, 0.14, 0.92)];
  const FOAM = packColor(0.86, 0.8, 0.66, 0.95), FOAM2 = packColor(0.66, 0.58, 0.44, 0.9);
  f.main.add(new Custom(52, rr => {
    if (t <= 0 || (done && level((z0 + z1) / 2) <= 0)) return;
    const x0 = Math.max(z0, Math.floor(rr.visibleX0(4))), x1 = Math.min(z1, Math.ceil(rr.visibleX1(4)));
    const ph = Math.floor(t * 10);
    for (let x = x0; x <= x1; x++) {
      const L = level(x);
      if (L < 0.6) continue;
      const g = G(x);
      const wave = Math.round(Math.sin(x * 0.11 + t * 4) * 1.2 + Math.sin(x * 0.037 - t * 2.3));
      const top = Math.round(g - L) + wave;
      rr.rect(x, top, 1, Math.round(g + 7 - top), MUD[(x + ph) % 3 === 0 ? 1 : (x * 7 + ph) % 5 === 0 ? 2 : 0]);
      rr.rect(x, top, 1, 1, ((x + ph * 2) & 7) < 5 ? FOAM : FOAM2);
      if (((x * 13 + ph) % 23) === 0) rr.rect(x, top + 2, 1, 1, FOAM2);
    }
  }));
  let swept = false, lastHit = -9;
  const P = f.main.particles;
  r.tickers.push(dt => {
    if (done) return;
    t += dt;
    // sticks and foam riding down
    if (rand.chance(dt * 6)) {
      const x = rand.range(Math.max(z0, p.x - 300), Math.min(z1, p.x + 300));
      P.spawn({ frame: A.dot2, x, y: G(x) - level(x) + 1, vx: rand.range(40, 90), vy: 0, life: 1.6, color: [0.5, 0.38, 0.22], alpha: 1, alpha1: 0.6 });
    }
    if (onRock) { p.vx = 0; if (p.y > G(p.x) - 6) onRock = false; }
    const L = level(p.x);
    const depth = Math.max(0, p.y - (G(p.x) - L));
    if (depth > 8 && !onRock) {
      p.vx *= Math.max(0, 1 - dt * (depth / 14));
      STAMINA_ZL.set(STAMINA_ZL.get() - dt * 0.03 * (depth / 10));
      if (rand.chance(dt * 4)) f.splash(p.x, G(p.x) - L, 0.6);
    }
    if (depth > 22 && !onRock && t - lastHit > 3) {
      lastHit = t;
      swept = true;
      hitMori(f, p.x - 40, { sev: 2, drop: true });
      p.vx = 160;
      STAMINA_ZL.set(0);
      addHunger(0.05, 'flood');
    }
    if (t > RISE + HOLD + FALL) done = true;
  });
  while (!done && live(f)) await sleep(250);
  audio.setDanger(0);
  if (!live(f)) return;
  bump('fe:floods');
  if (!swept) {
    addRP(onRock ? 26 : 22, onRock ? 'Rode out the flood' : 'Outran the flood');
    void mori(onRock ? 'An island. I was an island. A very small, very scared island.' : 'Made the bank. My lungs are on fire. The river is VERY angry.', 'happy', 3000);
    aroha(r, 'Rivers out here come down like that in minutes. Always know where your high ground is.');
    setF('fe:flood:escaped');
  } else {
    void mori('It just... picked me up. Like I was nothing. I’m soaked to the soul.', 'sad', 3000);
    aroha(r, 'You’re alive. That’s the lesson paid for. Next time, run the moment the voice changes.');
  }
  note(r, 'note:flood:' + dayNumber(), 'A flash flood came down the braids here.');
}

// ================================================================== 5. the night of eyes
const NIGHT_MOB = ['quillhog', 'mossfrog', 'delver', 'sailglider', 'hunterbat'];
async function nightEyes(r: TripRun) {
  const f = r.f, p = r.p;
  const here = (f.site.spawns ?? []).filter(s => (!s.times || s.times.includes('night')) && SPECIES_BY_ID[s.species] && !isPredatorId(s.species));
  const pickSp = here.find(s => NIGHT_MOB.includes(s.species))?.species ?? here[0]?.species ?? NIGHT_MOB.find(s => SPECIES_BY_ID[s]);
  if (!pickSp) return;
  const name = SPECIES_BY_ID[pickSp].name;
  const N = 14;
  const eyes = Array.from({ length: N }, (_, i) => {
    const s = i % 2 === 0 ? 1 : -1;
    return { x: p.x + s * rand.range(110, 280), y: 0, dy: rand.range(6, 40), ph: rand.range(0, 7), k: 0, delay: i * 0.35, col: rand.chance(0.6) ? [0.6, 1, 0.55] : [1, 0.85, 0.4] as number[] };
  });
  let t = 0, still = 0, state = 'gather' as 'gather' | 'come' | 'flee' | 'done', fade = 1;
  const stNow = () => state;
  void mori('Oh. Oh no. Oh... wow. Eyes. Everywhere. Don’t move, Mori. Do NOT move.', 'whisper', 3000);
  aroha(r, 'Stay still. They’re only curious. Let them come.', 'whisper');
  f.main.add(new Custom(62, rr => {
    if (state === 'done') return;
    for (const e of eyes) {
      if (e.k <= 0.02) continue;
      const bl = Math.sin(t * 0.9 + e.ph) > 0.93;
      if (bl) continue;
      const c = packColor(e.col[0], e.col[1], e.col[2], 1), I = 2.4 * e.k * fade;
      rr.fxRect(Math.round(e.x) - 1, Math.round(e.y), 1, 1, c, I, true);
      rr.fxRect(Math.round(e.x) + 2, Math.round(e.y), 1, 1, c, I, true);
    }
  }, dt => {
    if (state === 'done') return;
    t += dt;
    const moving = Math.abs(p.vx) > 6 || p.running || !p.onGround;
    if (state === 'gather' || state === 'come') {
      if (moving) { still = 0; if (t > 3) { state = 'flee'; } }
      else still += dt;
      if (state === 'gather' && still > 8) state = 'come';
    }
    for (const e of eyes) {
      if (t < e.delay) continue;
      if (state === 'flee') { e.k = Math.max(0, e.k - dt * (1 + e.ph * 0.2)); continue; }
      e.k = Math.min(1, e.k + dt * 0.8);
      const want = state === 'come' ? 70 : 200;
      const dx = e.x - p.x;
      if (Math.abs(dx) > want) e.x -= Math.sign(dx) * dt * (state === 'come' ? 26 : 8);
      e.x += Math.sin(t * 0.6 + e.ph) * dt * 6;
      e.y = r.groundAt(e.x) - e.dy;
    }
    if (state === 'flee' && eyes.every(e => e.k <= 0)) state = 'done';
  }));
  audio.setDanger(0.25);
  for (let i = 0; i < 120 && live(f) && stNow() !== 'flee' && stNow() !== 'done'; i++) {
    if (stNow() === 'come' && t > 16) break;
    await sleep(200);
  }
  audio.setDanger(0);
  if (!live(f)) return;
  if (stNow() === 'flee' || stNow() === 'done') {
    void mori('...And they’re gone. All of them. I breathed too loud, didn’t I.', 'sad', 2600);
    return;
  }
  // they come out of the dark: a whole mob of them, round his boots
  for (let i = 0; i < 20; i++) { fade = Math.max(0, 1 - i / 20); await sleep(60); }
  state = 'done';
  const n0 = f.animals.length;
  f.spawnRule({ species: pickSp, n: [5, 7], x: [p.x - 90, p.x + 90], herd: true, chance: 1 }, false);
  const mob = f.animals.slice(n0).filter(a => a.species === pickSp);
  for (const a of mob) { a.habit = 1; a.fear = 0; a.curio = 1; }
  void mori(`${name}s. Dozens of eyes and they’re just... ${name}s. Looking at me like I’m the weird one.`, 'whisper', 3200);
  let paid = false;
  const off = onShots(f, ph => {
    if (paid || ph.time !== 'night') return;
    if (ids(ph, pickSp).length < 3) return;
    paid = true;
    addRP(45, 'The night of eyes');
    setF('fe:eyes:photo');
    setTimeout(() => void mori('Three, four, five of them in one frame. At NIGHT. Jenna is going to scream.', 'happy', 2800), 500);
  });
  setTimeout(off, 60000);
  bump('fe:eyes');
  note(r, 'note:eyes:' + dayNumber(), `A night of eyes: a mob of ${name.toLowerCase()}s came to look at me.`);
}
const isPredatorId = (sp: string) => (SPECIES_BY_ID[sp]?.danger ?? 0) >= 2;

// ================================================================== registration
const tod = (r: TripRun) => r.f.tod;
export const FIELD_EVENTS: TripEvent[] = [
  { id: 'stampede', w: 2, every: 3, fits: r => OPEN_LAND.has(r.loc) && tod(r) !== 'night', run: stampede },
  { id: 'foghunt', w: 2, every: 3, fits: r => MISTY.has(r.loc) && tod(r) !== 'day', run: fogHunt },
  { id: 'rivalphoto', w: 2, every: 2, fits: r => OPEN_LAND.has(r.loc) && tod(r) !== 'night' && dayNumber() >= 3, run: rival },
  { id: 'flashflood', w: 3, every: 3, fits: r => r.loc === 'backcountry' && tod(r) !== 'night', run: flashFlood },
  { id: 'nighteyes', w: 3, every: 2, fits: r => tod(r) === 'night' && DARKOK(r.loc), run: nightEyes },
];
let registered = false;
/** add the five set pieces to the expedition events table (idempotent) */
export function registerFieldEvents() {
  if (registered) return;
  registered = true;
  for (const e of FIELD_EVENTS) if (!EVENTS.some(x => x.id === e.id)) EVENTS.push(e);
}
void cineBars; void F;
