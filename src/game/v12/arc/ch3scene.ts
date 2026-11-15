// V12 Te Ara Matatū, chapter 3: Te Pō Kānapanapa, the Glow Forest at Night. In the sunken valley
// (loc 'glowforest'), where the skull's glowing eye pointed.
//
//   1. arrive        the title; Aroha: what lives here only comes out at night. Make camp by the big
//                    glowcap at the valley's mouth and wait for dark (the valley reloads at night; the
//                    crew are told; nobody comes looking yet) (arc:ch3:camp)
//   2. the lights    a NEW animal: the Mokotūrama, the lantern gecko (./species1.ts), foraging between the
//                    glowcaps past the lit pool. STEALTH: lamp off (L), crouched, in cover, still. It
//                    reads the light on Mori and every movement: spooked, it shuts every light off and
//                    freezes, then bolts. Photograph it glowing (swinging its lantern) or feeding
//                    without it noticing you (arc:ch3:unseen).
//   3. the hunter    SET PIECE. The moment the shutter clicks, the forest falls silent and the glowcaps
//                    dim together. Matikuku Nui, driven out of Te Kāinga on the night of the claw, has
//                    come down to the valley, and it hunts by the lights. It walks the valley floor to
//                    every light it sees and sniffs the cover. A lamp left on draws it straight to Mori;
//                    standing in the open, moving, sprinting, it sees him; crouched in a bush or behind
//                    the glowing logs, it doesn't. Seen: it roars (the tell), then charges and swipes.
//                    Survive until it gives up and goes (the watch counts it down), or slip out of the
//                    valley at either end while it isn't on you (arc:ch3:survived).
//   4. the waystone  the lights come back on, and the geckos' glow runs along the valley floor to a
//                    carved stone nobody could see in the dark: the fourth watcher, its eye turned east
//                    toward the steam of Te Riu Wera (arc:ch3:done). Then torches through the trees: the
//                    crew have come looking (the day loop's carry-home).

import type { FieldScene } from '../../scenes/field';
import type { Animal } from '../../wild/animal';
import type { Interactable } from '../../../world/npc';
import type { HideSpot } from '../../../world/player';
import type { Env } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { Prop, Custom } from '../../../world/props';
import { sprite } from '../../sites2/common';
import { glowGround, GLOWFOREST } from '../../sites10/glowforest';
import { currentExpedition, setExpeditionHour, tagScene } from '../../v10/expedition';
import { rumour, addNote } from '../../v10/regions';
import { bucket } from '../../v10/store';
import { dayNumber } from '../../v10/day';
import { judgeSubject } from '../../photos';
import { moriHidden, hitMori } from '../wilds';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { floatSky, floatCaption } from '../../../ui/v12/float';
import { carvedStone, lanternLog } from '../../../art/v12/arc/props1';
import { GLOW_ID, GLOW_CTX, spawnGlowGecko, geckoBody, geckoLight } from './species1';
import { F, setF, active, say, aroha, sleep, onShot, lateTick, hints } from './kit1';

// ------------------------------------------------------------------ where (glowforest world x)
const CAMP_X = 330;
const GECKO_X = 1700, GECKO_HOME: [number, number] = [1480, 2090];
const GECKO_FUNGI = [1520, 1590, 1680, 1760, 1830, 1940, 2020];
const LOGS = [{ x: 880, seed: 5 }, { x: 1640, seed: 9 }];
const BUSHES = [500, 1400, 1950];
const WAYSTONE_X = 2150;
const HUNT_SECS = 100;
const gy = (x: number) => glowGround(x);
const shown = () => active('arc_ch3') || F('arc:ch3:done');

/** the day loop's dusk warnings: hold them off for the night out (and let them come after) */
function holdFetch(on: boolean) {
  const s = bucket<{ day: number; warned: number; left: number; goal: null; research0: number; dark: number }>('v12loop', () => ({ day: 0, warned: 0, left: 0, goal: null, research0: 0, dark: 0 }));
  if (s.day !== dayNumber()) { s.day = dayNumber(); s.left = 0; s.goal = null; s.research0 = Object.keys(game.save.research ?? {}).length; s.dark = 0; }
  s.warned = on ? Math.max(s.warned, 3) : Math.min(s.warned, 2);
  game.persist();
}

interface Ch3 {
  f: FieldScene;
  busy: boolean;
  lamp: boolean;
  gecko: Animal | null;
  spooks: number;
  /** 1 normal .. ~0.4 the forest gone dark for the hunter */
  dark: number;
  darkTo: number;
  hunt: Hunt | null;
  wayK: number;
  moths: { x: number; y: number; t: number; tx: number; ty: number }[];
  geckoLight: { x: number; y: number; r: number; k: number };
}

export function build(f: FieldScene) {
  const night = f.tod === 'night';
  // the chapter is a night out: the crew's dusk calls and the carry-home wait until it's over
  if (active('arc_ch3') && !F('arc:ch3:survived')) holdFetch(true);
  const S: Ch3 = { f, busy: false, lamp: f.lampOn, gecko: null, spooks: 0, dark: 1, darkTo: 1, hunt: null, wayK: F('arc:ch3:done') ? 1 : 0, moths: [], geckoLight: { x: 0, y: 0, r: 40, k: 0 } };
  // ---------------------------------------------------------------- the glowing logs (hides) and the bushes as hides
  const hides: HideSpot[] = [];
  for (const L of LOGS) {
    const s = sprite(`arc3:log:${L.seed}`, () => lanternLog(L.seed));
    if (!s) continue;
    const y = gy(L.x) + 3;
    f.main.add(new Prop(s.f, L.x, y, 66, { foliage: false }));
    f.occluders.push({ mask: s.s.buf, x: L.x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    if (s.g) { const g = s.g; f.main.add(new Custom(66.1, (r, st) => { r.emissive(1); r.draw(g, L.x, y, 1, 1, 0, packColor(1, 1, 1, (0.6 + 0.3 * Math.sin(st.time * 1.3 + L.x)) * (0.4 + 0.6 * S.dark))); r.emissive(); r.light(L.x + 30, y - 8, 30, 0.4, 1, 0.9, 0.4 * S.dark, 0.1); })); }
    f.pois.push({ kind: 'cover', x: L.x, y: gy(L.x), w: 30 } as never);
    hides.push({ x: L.x, w: 56, y: gy(L.x), cover: 0.92 });
  }
  for (const x of BUSHES) hides.push({ x, w: 34, y: gy(x) + 2, cover: 0.85 });
  for (const h of hides) if (!f.player.hides.some(q => Math.abs(q.x - h.x) < 4)) f.player.hides.push(h);
  // ---------------------------------------------------------------- the waystone at the far end
  const ws = sprite('arc3:waystone', () => carvedStone(21, true));
  if (ws) {
    const y = gy(WAYSTONE_X) + 2;
    f.main.add(new Prop(ws.f, WAYSTONE_X, y, -2.4, { foliage: false }));
    const eye = (ws.s as ReturnType<typeof carvedStone>).eye;
    f.main.add(new Custom(-2.35, (r, st) => {
      if (S.wayK <= 0) return;
      const ex = WAYSTONE_X + eye[0], ey = y + eye[1];
      r.emissive(1);
      r.rect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 2, packColor(0.6, 1, 0.9, S.wayK * (0.7 + 0.3 * Math.sin(st.time * 2))));
      r.emissive();
      r.light(ex, ey, 46, 0.45, 1, 0.85, 0.8 * S.wayK, 0.2);
    }));
  }
  // ---------------------------------------------------------------- the valley's light (darker when the hunter comes)
  const prevEnv = f.st.envHook;
  f.st.envHook = (env: Env, dt: number) => {
    prevEnv?.(env, dt);
    S.dark += (S.darkTo - S.dark) * Math.min(1, dt * 0.8);
    const k = S.dark;
    env.ambientTop = [env.ambientTop[0] * k, env.ambientTop[1] * k, env.ambientTop[2] * k];
    env.ambientBottom = [env.ambientBottom[0] * k, env.ambientBottom[1] * k, env.ambientBottom[2] * k];
    env.vignette += (1 - k) * 0.4;
  };
  // ---------------------------------------------------------------- camp (by day / dusk)
  (f.interact as Interactable[]).push({
    x: CAMP_X, y: gy(CAMP_X) - 12, w: 22, h: 24, standX: CAMP_X - 20,
    label: 'Make camp by the glowcap and wait for dark',
    enabled: () => !S.busy && active('arc_ch3') && !night && !F('arc:ch3:unseen'),
    action: () => campForNight(f, S),
  } as never);
  // ---------------------------------------------------------------- night: the gecko, the lamp, the photo
  if (night && active('arc_ch3') && !F('arc:ch3:survived')) {
    holdFetch(true);
    setF('arc:ch3:camp');
    S.gecko = f.animals.find(a => a.species === GLOW_ID && !a.gone) ?? spawnGlowGecko(f, GECKO_X, { home: GECKO_HOME });
  } else if (night && F('arc:ch3:done')) {
    // after the chapter it lives here: out at night, between the glowcaps
    S.gecko = spawnGlowGecko(f, GECKO_X, { home: GECKO_HOME });
  }
  GLOW_CTX.fungi = () => GECKO_FUNGI;
  GLOW_CTX.lure = a => {
    if (game.scene !== (f as never)) return;
    for (let i = 0; i < 2; i++) S.moths.push({ x: a.x + rand.range(-90, 90), y: a.y - rand.range(40, 80), t: 0, tx: a.x - a.facing * 4, ty: a.y - 16 });
  };
  GLOW_CTX.dimmed = a => {
    if (game.scene !== (f as never) || S.hunt) return;
    S.spooks++;
    if (Math.abs(f.player.x - a.x) > 260) return;
    const lines = ['Every light went OUT. At once. It saw me.', 'Dark again. I\'m too clumsy for this.', 'Out. Like someone pulled a plug.'];
    void say(lines[Math.min(lines.length - 1, S.spooks - 1)], 'whisper', 2600);
    if (S.spooks === 2) setTimeout(() => void aroha(f, S.lamp ? 'Your LAMP, Mori. It sees the lamp. Switch it off.' : 'Slower. Lower. Let it come to the light, not to you.', 'whisper', 3200), 2800);
  };
  if (f.lights.indexOf(S.geckoLight) < 0) f.lights.push(S.geckoLight);
  // the lamp: L switches it off and on
  f.main.add(new Custom(0, () => {}, dt => {
    if (game.scene !== (f as never)) return;
    const inp = game.input;
    if (night && !f.cutscene && !game.ui.blocking && inp.keyHit('KeyL')) {
      S.lamp = !S.lamp;
      audio.play('lanternOn', { vol: 0.3, pitch: S.lamp ? 1.4 : 0.8 });
      void say(S.lamp ? 'Lamp on.' : 'Lamp off. Okay. Okay... eyes, adjust.', 'whisper', 1600);
    }
    if (night) f.lampOn = S.lamp;
    // the gecko's own light, for the camera
    const g = S.gecko;
    if (g && !g.gone) { S.geckoLight.x = g.x; S.geckoLight.y = g.y - 6; S.geckoLight.k = 0.55 * geckoLight(g) * S.dark; } else S.geckoLight.k = 0;
    // moths spiralling in to the lantern
    for (const m of S.moths) { m.t += dt; const k = Math.min(1, m.t / 2.4); m.x += (m.tx + Math.cos(m.t * 7) * 10 * (1 - k) - m.x) * dt * 1.6; m.y += (m.ty + Math.sin(m.t * 9) * 8 * (1 - k) - m.y) * dt * 1.6; }
    S.moths = S.moths.filter(m => m.t < 2.6);
    S.hunt?.tick(dt);
  }));
  f.main.add(new Custom(31, (r, st) => {
    for (const m of S.moths) { const fl = Math.sin(st.time * 30 + m.x) > 0; r.rect(Math.round(m.x), Math.round(m.y), fl ? 2 : 1, 1, packColor(0.85, 0.8, 0.7, 1)); }
  }));
  // the photo
  onShot(f, ph => {
    if (!active('arc_ch3') || F('arc:ch3:unseen') || !S.gecko) return;
    const sub = ph.subjects.find(s => s.species === GLOW_ID);
    if (!sub) return;
    const ok = judgeSubject(sub, ph).identified;
    const a = S.gecko;
    if (!ok) { void say('Too dark, too far or too blurry... I need it clear.', 'think', 2400); return; }
    if (sub.noticed || a.noticed || a.act === 'freeze' || a.act === 'flee' || a.aw > 0.75) { void say('It knew I was there. Its lights went flat. That\'s not the real thing.', 'think', 2800); return; }
    if (sub.behavior !== 'glowing' && sub.behavior !== 'feeding') { void say('It\'s just sitting there. I want it DOING something: the lantern, or eating.', 'think', 2600); return; }
    setF('arc:ch3:unseen');
    audio.play('discover', { vol: 0.6 });
    void (async () => {
      await sleep(500);
      await say(sub.behavior === 'glowing' ? 'Its tail. It\'s holding its tail up like a LANTERN. And it never saw me.' : 'Licking the glow off the mushrooms. And it has no idea I\'m here. Got it.', 'whisper', 3200);
      await aroha(f, 'Mokotūrama. The lantern gecko. My nan said only the very quiet ever see one.', 'whisper', 3200);
      await sleep(1500);
      if (game.scene === (f as never) && !S.hunt) S.hunt = new Hunt(S);
    })();
  });
  // hints and arrival
  const hint = hints(f, [
    { id: 'arc:ch3:h:pool', x: 1230, text: 'The pool\'s lit from inside. And past it... a light that moves when nothing else does.', when: () => night },
    { id: 'arc:ch3:h:log', x: LOGS[0].x, r: 90, text: 'A hollow log full of glowing fungus. I could get right down behind that.', when: () => night },
    { id: 'arc:ch3:h:stone', x: WAYSTONE_X, r: 120, text: 'There\'s a big stone here. Too dark to see what\'s on it.', when: () => !F('arc:ch3:done') },
  ]);
  f.main.add(new Custom(0, () => {}, dt => { if (game.scene === (f as never) && active('arc_ch3')) hint(dt); }));
  const ex = f.exit.bind(f);
  f.exit = () => { S.hunt?.dispose(); if (!S.busy) holdFetch(false); ex(); };
  if (active('arc_ch3')) void arrive(f, S, night);
}

async function arrive(f: FieldScene, S: Ch3, night: boolean) {
  await sleep(2600);
  if (game.scene !== (f as never)) return;
  if (!night && !F('arc:ch3:camp')) {
    if (!F('arc:ch3:title')) { setF('arc:ch3:title'); await floatSky('The Glow Forest at Night', 'Te Pō Kānapanapa', 'Te Ara Matatū · Chapter 3', 3600); }
    await aroha(f, 'Whatever the old people followed down here, it only comes out at night. We camp by the big glowcap and wait.', 'say', 3600);
    return;
  }
  if (night && !F('arc:ch3:unseen')) {
    if (!F('arc:ch3:title')) { setF('arc:ch3:title'); await floatSky('The Glow Forest at Night', 'Te Pō Kānapanapa', 'Te Ara Matatū · Chapter 3', 3600); }
    await aroha(f, 'Lamp off. Crouch. Let your eyes go. Watch for the light that moves.', 'whisper', 3400);
    if (S.lamp) setTimeout(() => void say('(L: lamp off)', 'whisper', 2600), 600);
    return;
  }
  if (night && F('arc:ch3:unseen') && !F('arc:ch3:survived') && !S.hunt) { await sleep(1500); if (game.scene === (f as never) && !S.hunt) S.hunt = new Hunt(S); }
}

/** camp by the glowcap and wait for the dark: the valley reloads at night */
async function campForNight(f: FieldScene, S: Ch3) {
  if (S.busy) return;
  S.busy = true;
  f.cutscene = true;
  try {
    await aroha(f, 'I told Koro we\'d sleep out. He told your dad. Your dad said a lot of words.', 'say', 3000);
    f.player.poseOverride = 'sitGround';
    await sleep(800);
    holdFetch(true);
    if (currentExpedition()) setExpeditionHour(21.5);
    setF('arc:ch3:camp');
    await game.fadeTo(1, 1);
    await floatCaption('The green light under the canopy fades to blue, then to black. The fungi wake.', 3000);
    f.player.poseOverride = null;
    const { FieldScene: FS } = await import('../../scenes/field');
    await game.go(() => { const s = new FS({ ...GLOWFOREST, spawnX: CAMP_X + 20 } as never, 'night'); tagScene(s, 'glowforest'); return s; });
  } finally { f.cutscene = false; S.busy = false; if (f.player.poseOverride === 'sitGround') f.player.poseOverride = null; }
}

// ------------------------------------------------------------------ the hunter

type Bs = import('../feud/director').BearerScript;
class Hunt {
  t = 0;
  ended = false;
  a: Animal | null = null;
  bs: Bs | null = null;
  private watch: { set(t: number): void; close(): void } | null = null;
  private unLate: (() => void) | null = null;
  private onMori = false;
  private seenT = 0;
  constructor(readonly S: Ch3) { void this.start(); }
  get f() { return this.S.f; }
  private async start() {
    const f = this.f, S = this.S;
    audio.setMusic('tension');
    S.darkTo = 0.42;
    // every light in the valley goes down together
    if (S.gecko && !S.gecko.gone) S.gecko.setAct('freeze', 200);
    await sleep(1200);
    void say('...why did everything go dark?', 'whisper', 2200);
    await sleep(2200);
    audio.play('land', { vol: 0.5, pitch: 0.35 });
    await sleep(900);
    audio.play('land', { vol: 0.6, pitch: 0.3 });
    await aroha(f, 'Down. DOWN. Don\'t breathe. Something big is coming up the valley.', 'whisper', 3000);
    if (this.ended || game.scene !== (f as never)) return;
    const D = await import('../feud/director');
    const px = f.player.x, x = clamp(px > 1150 ? px - 620 : px + 620, 60, 2270);
    this.a = D.spawnBearer(f, x, { facing: x > 1000 ? -1 : 1, act: 'wander', home: [0, 2300] });
    this.bs = D.bearerScript(this.a);
    audio.play('roar', { vol: 0.5, pitch: 0.6 });
    await say(this.firstTime() ? 'Matikuku Nui. HERE. It came down here after the village...' : 'It\'s back.', 'scared', 2600);
    const W = await import('../../../ui/v12/watch');
    if (!this.ended) { this.watch = W.showWatch({ mode: 'countdown', manual: true, secs: HUNT_SECS, size: 26, anchor: 'mori' }); this.watch.set(1); }
    this.unLate = lateTick(f, () => {
      if (this.ended || !this.a) return;
      const d = Math.abs(this.a.x - f.player.x);
      audio.setHeartbeat(clamp(1 - d / 520, 0.15, 1));
      audio.setDanger(this.onMori ? 0.9 : clamp(0.6 - d / 1200, 0.15, 0.6));
    });
    void this.brain();
  }
  private firstTime() { return !this.a || true; }
  /** can it see Mori right now? */
  private sees(): boolean {
    const f = this.f, p = f.player, a = this.a;
    if (!a) return false;
    if (moriHidden(f) || p.state === 'hide') return false;
    const d = Math.abs(p.x - a.x);
    const front = Math.sign(p.x - a.x) === a.facing || d < 50;
    const R = this.S.lamp ? 560 : p.running ? 260 : Math.abs(p.vx) > 8 ? (p.crouch ? 70 : 150) : p.crouch ? 34 : 90;
    return d < R * (front ? 1 : 0.45);
  }
  private alive() { return !this.ended && game.scene === (this.f as never) && !!this.a && !!this.bs; }
  private async brain() {
    const f = this.f;
    while (this.alive()) {
      const a = this.a!, bs = this.bs!, p = f.player;
      if (this.sees()) {
        // seen: the tell (it stops, rears, roars), then the charge and the swipe
        this.onMori = true;
        bs.facing = p.x > a.x ? 1 : -1;
        void say(rand.pick(['It sees me. It SEES me.', 'Oh no. Oh no no no.', 'Hide. HIDE.']), 'scared', 1400);
        await bs.act('roar');
        if (!this.alive()) return;
        if (moriHidden(f)) { await this.lose(); continue; }
        const tx = f.player.x;
        let hit = false;
        await Promise.race([bs.walkTo(tx, { run: true, speed: 135 }), this.until(() => Math.abs(this.f.player.x - a.x) < 26 || moriHidden(this.f))]);
        if (!this.alive()) return;
        if (moriHidden(f)) { await this.lose(); continue; }
        if (Math.abs(f.player.x - a.x) < 40) {
          bs.facing = f.player.x > a.x ? 1 : -1;
          await bs.act('swipe');
          if (!this.alive()) return;
          if (Math.abs(f.player.x - a.x) < 46 && !moriHidden(f)) { hitMori(f, a.x, { sev: 3 }); this.S.lamp = false; void say('...lamp. It smashed the lamp off my head. Lamp\'s OFF now.', 'scared', 2600); hit = true; }
        }
        this.onMori = false;
        await bs.act('sniff', { secs: hit ? 4 : 2 });
        continue;
      }
      // not on him: it walks to the lights. A lamp, the glowing logs, the gecko, the cover it smells
      const p2 = f.player;
      const picks: number[] = [...LOGS.map(l => l.x + 20), ...BUSHES, ...GECKO_FUNGI.filter((_, i) => i % 2 === 0)];
      const near = picks.filter(x => Math.abs(x - p2.x) < 420);
      const tx = clamp((near.length && rand.chance(0.7) ? rand.pick(near) : rand.pick(picks)) + rand.range(-20, 20), 40, 2260);
      await Promise.race([bs.walkTo(tx, { speed: 34 }), this.until(() => this.sees())]);
      if (!this.alive() || this.sees()) continue;
      // at cover with Mori in it: the sniff, right over him
      if (Math.abs(p2.x - a.x) < 50 && (moriHidden(f) || p2.state === 'hide')) void say(rand.pick(['It\'s right there. Right THERE.', 'Its breath... I can feel its breath.', 'don\'t move don\'t move don\'t move']), 'whisper', 2000);
      await bs.act('sniff', { secs: rand.range(1.6, 3) });
    }
  }
  /** it loses him: sniffs, snorts, turns away */
  private async lose() {
    this.onMori = false;
    this.bs?.walkTo(this.a!.x, { speed: 1 });
    void say('...it lost me.', 'whisper', 1600);
    await this.bs?.act('sniff', { secs: 2.4 });
  }
  private until(fn: () => boolean) {
    return new Promise<void>(res => { const iv = setInterval(() => { if (fn() || !this.alive()) { clearInterval(iv); res(); } }, 100); });
  }
  tick(dt: number) {
    if (this.ended || !this.a) return;
    const p = this.f.player;
    this.t += dt;
    if (!this.onMori) this.seenT = 0; else this.seenT += dt;
    this.watch?.set(clamp(1 - this.t / HUNT_SECS));
    // slipping out of the valley at either end while it isn't on him
    if (!this.onMori && (p.x < 70 || p.x > 2235) && Math.abs(p.x - this.a.x) > 140) { void this.survive('slip'); return; }
    if (this.t >= HUNT_SECS) void this.survive('wait');
  }
  private async survive(how: 'slip' | 'wait') {
    if (this.ended) return;
    const f = this.f, S = this.S, a = this.a;
    this.ended = true;
    this.watch?.close();
    this.unLate?.();
    audio.setHeartbeat(0);
    audio.setDanger(0);
    setF('arc:ch3:survived');
    if (a && this.bs) {
      const bs = this.bs;
      void (async () => { await bs.act('roar').catch(() => {}); await bs.walkTo(a.x > 1150 ? 2420 : -120, { speed: 40 }).catch(() => {}); a.gone = true; bs.release(); })();
    }
    await say(how === 'slip' ? 'Out. We\'re out of its sight. Keep going... no. Wait. Listen.' : 'It\'s going. It\'s... giving up. It\'s going away up the valley.', 'whisper', 3000);
    await sleep(2400);
    S.darkTo = 1;
    audio.setMusic('wonder');
    void payoff(f, S);
  }
  dispose() {
    this.ended = true;
    this.watch?.close();
    this.unLate?.();
    audio.setHeartbeat(0);
    audio.setDanger(0);
    try { this.bs?.release(); } catch { /* */ }
  }
}

// ------------------------------------------------------------------ the waystone
let paying = false;
async function payoff(f: FieldScene, S: Ch3) {
  if (paying || F('arc:ch3:done') || game.scene !== (f as never)) return;
  paying = true;
  try {
    await sleep(1200);
    // the lights come back, the gecko first, its glow running along the floor to the stone
    if (S.gecko && !S.gecko.gone) { S.gecko.setAct('lure', 20); const b = geckoBody(S.gecko); if (b) b.glowK = 0.1; }
    await aroha(f, 'Look. They\'re coming back on. All of them... and they\'re all lighting the same way.', 'whisper', 3200);
    const t0 = performance.now();
    await new Promise<void>(res => { const step = () => { S.wayK = Math.min(1, (performance.now() - t0) / 2600); if (S.wayK >= 1) res(); else requestAnimationFrame(step); }; step(); });
    for (let i = 0; i < 40; i++) f.main.glowParticles.spawn({ frame: A.dot, x: WAYSTONE_X + rand.range(-30, 30), y: gy(WAYSTONE_X) - rand.range(4, 60), vx: rand.range(-4, 4), vy: rand.range(-12, -3), life: rand.range(2, 4), color: [0.5, 1, 0.88], alpha: 0.9, alpha1: 0, glow: true, intensity: 1.4, wobble: 4, wobbleF: 1 });
    audio.play('discover', { vol: 0.6, pitch: 0.8 });
    await say('A watcher. The fourth one. It was here the whole time, in the dark.', 'whisper', 3000);
    await aroha(f, 'Its eye looks east. Toward the warm wind... Te Riu Wera. The Hot Valley.', 'say', 3200);
    rumour('geovalley');
    addNote({ id: 'note:arc:ch3', loc: 'glowforest', x: WAYSTONE_X, text: 'The fourth watcher, a carved stone in the dark at the valley\'s end. Its eye looks east, toward the steam of Te Riu Wera.' });
    setF('arc:ch3:done');
    holdFetch(false);
    await sleep(2400);
    await say('...are those torches? Up on the rim?', 'think', 2400);
  } finally { paying = false; }
}

