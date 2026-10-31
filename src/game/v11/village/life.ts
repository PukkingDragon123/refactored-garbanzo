// V12 Te Kāinga, alive: the village keeps the island's clock. Each villager has a day in four parts,
// read from the game hour while Mori is there (src/game/v12/clock.ts), and walks from one part to the
// next on their own, a few at a time:
//
//   morning  5:30-10:30   Huia tends the hāngī pit, Tamati in the gardens, Mere pegs out the washing,
//                         Manu and the kids feed the pigs, the hens and the goats, Rāwiri checks the
//                         hīnaki, Koro greets Hinerua at the pou, Hana warms up on the hue kiri
//   midday  10:30-16:45   Hēmi adzes the waka (chips flying), Mere weaves under the shelter, Rāwiri
//                         fishes off the landing, Huia cooks, Tamati digs; Pīpī and Ani play tag round
//                         the houses and Mikaere flies his manu tukutuku over the marae
//   evening 16:45-22:30   everyone drifts to the fire on the marae; Aunty Hana plays her guitar (heard
//                         for real, louder as Mori comes closer), the others sing, clap and listen,
//                         Pīpī dances; the lamps come on in the windows
//   night   22:30-5:30    people go home to bed (they walk to their door and are gone), a lamp or two
//                         burns late; Koro dozes by the embers; Rāwiri goes eeling by torchlight
//
// They greet Mori as he passes (a wave; by name once they've met him), say something about what
// they're doing if he lingers, and chips, soil, grain and steam come off the work. A festival night
// (festival.ts) or a scripted moment (c.hold) leaves everyone where the story put them.

import type { FieldScene } from '../../scenes/field';
import type { Actor } from '../../../world/actor';
import { game } from '../../game';
import { Custom, AnimProp, LightSource } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { A, propAnims } from '../../assets';
import { rand, clamp } from '../../../core/math';
import { audio } from '../../../core/audio';
import type { Music } from '../../../core/audio';
import { sprite } from '../../sites2/common';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import { hourOfClock } from '../../v12/clock';
import { registerLifeAnims } from '../../../art/v11/village/anims2';
import * as LA from '../../../art/v11/village/lifeart';
import { FireJam } from '../../../ui/v12/closeup/guitarsynth';
import { closeupOpen } from '../../../ui/v12/closeup/stage';
import { setCarry } from '../carry';
import type { VCtx, VillagerRT, Station } from './ctx';
import { bark } from './ctx';
import { X } from './layout';
import { vf } from './lore';

export type Phase = 'morning' | 'midday' | 'evening' | 'night';
export const PHASES: Phase[] = ['morning', 'midday', 'evening', 'night'];
export function phaseOfHour(h: number): Phase {
  h = ((h % 24) + 24) % 24;
  if (h >= 5.5 && h < 10.5) return 'morning';
  if (h >= 10.5 && h < 16.75) return 'midday';
  if (h >= 16.75 && h < 22.5) return 'evening';
  return 'night';
}
/** the hour in the village scene */
export function hourOf(f: FieldScene): number {
  if (currentExpedition()) return ((expeditionHour() % 24) + 24) % 24;
  const cl = (f as unknown as { clock?: { t: number } }).clock;
  return cl ? hourOfClock(cl.t) : 12;
}

// ------------------------------------------------------------------ the schedule
interface Slot { st?: Station[]; home?: boolean; tag?: boolean; kite?: boolean; roam?: [number, number] }
const S = (x: number, anim: string, face?: 1 | -1, stay?: number): Station => ({ x, anim, face, stay });
/** a seat round the marae fire (dx < 0: the west side, facing east) */
const fire = (dx: number, anim: string): Station => S(X.fire + dx * 1.25, anim, dx < 0 ? 1 : -1, 999);
const KITE_X = X.marae[1] - 14;
export const SCHED: Record<string, Partial<Record<Phase, Slot>>> = {
  koro: {
    morning: { st: [S(X.pou + 20, 'bless', -1, 40), S(X.koroSeat, 'sit', -1, 999)] },
    midday: { st: [S(X.koroSeat, 'sit', -1, 70), S(X.marae[0] + 40, 'armsCrossed', 1, 18), S(X.wakaBuild - 44, 'talk', 1, 22)] },
    evening: { st: [fire(-36, 'sit')] },
    night: { st: [fire(-30, 'doze')] },
  },
  huia: {
    morning: { st: [S(X.hangi + 18, 'kneelWork', -1, 40), S(X.cookFire - 10, 'stir', 1, 30), S(X.woodpile - 14, 'kneelWork', 1, 14)] },
    midday: { st: [S(X.cookFire - 10, 'stir', 1, 40), S(X.hangi + 18, 'kneelWork', -1, 20), S(X.foodBench - 8, 'craft', 1, 25)] },
    evening: { st: [S(X.hangi + 18, 'kneelWork', -1, 24), fire(78, 'clapSit')] },
    night: { home: true },
  },
  mere: {
    morning: { st: [S(X.laundry - 18, 'hangWash', 1, 30), S(X.laundry + 22, 'hangWash', 1, 20), S(X.shelter, 'craft', 1, 999)] },
    midday: { st: [S(X.shelter, 'craft', 1, 60), S(X.flax + 6, 'kneelWork', 1, 16)] },
    evening: { st: [fire(62, 'sing')] },
    night: { home: true },
  },
  tamati: {
    morning: { st: [S(X.garden[0] + 90, 'dig', 1, 34), S(X.garden[0] + 200, 'kneelWork', 1, 26)] },
    midday: { st: [S(X.garden[0] + 90, 'dig', 1, 34), S(X.garden[0] + 200, 'kneelWork', 1, 26), S(X.kumaraKete + 8, 'carryIdle~crate', 1, 6)] },
    evening: { st: [fire(96, 'clapSit')] },
    night: { home: true },
  },
  manu: {
    morning: { st: [S(X.pen[0] + 44, 'pour', 1, 24), S(X.coop - 18, 'scatter', 1, 22), S(X.goats[0] + 10, 'pet', 1, 16)] },
    midday: { st: [S(X.pen[0] + 44, 'pour', 1, 24), S(X.coop - 18, 'kneelWork', 1, 18), S(X.goats[0] + 10, 'pet', 1, 16)] },
    evening: { st: [fire(48, 'sitGround')] },
    night: { home: true },
  },
  rawiri: {
    morning: { st: [S(X.hinaki + 6, 'kneelWork', -1, 30), S(X.smokeRack - 18, 'craft', 1, 30), S(150, 'fishWait', -1, 60)] },
    midday: { st: [S(150, 'fishWait', -1, 70), S(X.smokeRack - 18, 'craft', 1, 22)] },
    evening: { st: [S(X.smokeRack - 18, 'craft', 1, 25), fire(-66, 'sing')] },
    night: { st: [S(X.hinaki + 6, 'fishWait', -1, 999)] },
  },
  hemi: {
    morning: { st: [S(X.shed - 50, 'armsCrossed', 1, 14), S(X.wakaBuild - 26, 'hammer', 1, 50)] },
    midday: { st: [S(X.wakaBuild - 26, 'hammer', 1, 50), S(X.wakaBuild + 40, 'hammer', -1, 30), S(X.shed - 50, 'armsCrossed', 1, 12)] },
    evening: { st: [fire(-84, 'clapSit')] },
    night: { home: true },
  },
  hana: {
    morning: { st: [S(X.hanaBench, 'strumSit', -1, 999)] },
    midday: { st: [S(X.hanaBench, 'strumSit', -1, 50), S(X.marae[0] + 90, 'snakeDance', 1, 24)] },
    evening: { st: [fire(114, 'guitarSit')] },
    night: { home: true },
  },
  pipi: { morning: { st: [S(X.coop - 50, 'scatter', 1, 999)] }, midday: { tag: true }, evening: { st: [fire(26, 'snakeDance')] }, night: { home: true } },
  ani: { morning: { st: [S(X.laundry + 40, 'hangWash', -1, 25), S(X.goats[0] + 40, 'pet', 1, 999)] }, midday: { tag: true }, evening: { st: [fire(36, 'clapSit')] }, night: { home: true } },
  mikaere: { morning: { roam: [X.whare3 - 40, X.goats[1]] }, midday: { kite: true }, evening: { st: [fire(-16, 'sitGround')] }, night: { home: true } },
};
/** front doors (where people go in at night and come out in the morning) */
const HOME: Record<string, number> = {
  koro: X.wharenui + 6, huia: X.wharenui + 6, mere: X.whare1 - 8, tamati: X.whare1 - 8, manu: X.whare1 - 8,
  rawiri: X.whare2 - 8, hemi: X.whare2 - 8, ani: X.whare2 - 8, hana: X.whare3 - 8, pipi: X.whare3 - 8, mikaere: X.whare3 - 8,
};
const HOUSES = [{ x: X.whare1, v: 0, late: true }, { x: X.whare2, v: 1, late: false }, { x: X.whare3, v: 0, late: true }];
const TAG_RANGE: [number, number] = [X.whare1 - 60, X.whare3 + 40];
const KIDS = new Set(['pipi', 'ani', 'mikaere', 'manu']);

// ------------------------------------------------------------------ what they say
const GREET: Record<Phase, string[]> = {
  morning: ['Mōrena, {n}!', 'Mōrena, {n}. Sleep well?', 'Up with the hens, {n}!'],
  midday: ['Kia ora, {n}!', 'Hey, {n}! Hot one today.', 'There he is. Kia ora, {n}.'],
  evening: ['Come and sit by the fire, {n}.', 'Kia ora, {n}! Hungry?', 'Just in time for the singing, {n}.'],
  night: ['Pō mārie, {n}.', 'Still up, {n}? Pō mārie.'],
};
const KID_GREET = ['{n}! {n}! Watch this!', 'Hi {n}!', '{n}, play with us!'];
const LINES: Record<string, Partial<Record<Phase, string[]>>> = {
  koro: { morning: ['I say good morning to her every day. She has never once answered. Very rude.'], midday: ['Sit with me a while, e tama. Watch the village work.'], evening: ['Listen to Hana. Her father played that same guitar, by this same fire.'], night: ['The embers keep an old man company.'] },
  huia: { morning: ['Stones in the fire before the sun’s up. The hāngī waits for nobody.', 'Mind the pit, Mori. Those stones would cook you too.'], midday: ['Taste this. No, don’t ask what’s in it. Taste.', 'Too thin. Still too thin.'], evening: ['Kai’s nearly up. Wash your hands.'] },
  mere: { morning: ['A good drying day. The wind does half my work.'], midday: ['Three over, one under. Watch my hands, not my face.', 'Hear the flax? It sings when it’s ready.'], evening: ['Sing, Mori. Nobody’s listening to you, they’re all listening to themselves.'] },
  tamati: { morning: ['Dew’s still on them. Best time to look for anuhe.'], midday: ['Every mound has a name. That one’s Koro. He’s lumpy.'] },
  manu: { morning: ['Feeding time! Don’t stand between the big pig and the bucket.'], midday: ['Captain’s been watching you. That’s not good.'] },
  rawiri: { morning: ['Two eels in the hīnaki this morning. Fat ones.'], midday: ['Shh. Bro. Fish.'], night: ['Eels come up at night. Torch, spear, patience.'] },
  hemi: { morning: ['Morning is for looking. Afternoon is for cutting.'], midday: ['Mind your eyes. The chips fly.', 'Listen to the wood. It tells you where it wants to split.'] },
  hana: { morning: ['Morning fingers are stiff fingers. Practice, practice.'], midday: ['One, two, ONE two! Ani, your feet!'], evening: ['Sit down, Mori. Next one’s a singing one.', 'Want to try? Come and talk to me.'] },
};
const SONG = ['Mahana te ahi, mahana te pō...', 'Hoki mai, hoki mai ki te kāinga...', 'Ka rere te manu, ka rere, ka rere...', 'E te awa, e moe, e moe...'];
const FIRE_BANTER = ['Louder, Tamati!', 'Hana! The one about the eel!', 'Again! From the top!', 'Who’s flat? Somebody’s flat.', 'Aue, my knees. Keep playing.'];

// ------------------------------------------------------------------ state
interface Life {
  c: VCtx;
  phase: Phase;
  /** the phase the clock said last check (a change is a crossing; null until the scene's clock has run) */
  hp: Phase | null;
  gen: Record<string, number>;
  /** walking to a new phase's spot: when to set off */
  goT: Record<string, number>;
  greetT: Record<string, number>;
  lineT: Record<string, number>;
  near: Record<string, number>;
  fxT: Record<string, number>;
  tag: { it: string; pause: number; re: number };
  globalT: number;
  checkT: number;
  sing: number;
  jam: FireJam | null;
  ducked: boolean;
  mood: number;
}
const LIVES = new WeakMap<VCtx, Life>();
export const lifeOf = (c: VCtx | null) => (c ? LIVES.get(c) ?? null : null);
/** what part of the day the village is in (null: not in the village) */
export const villagePhase = (c: VCtx | null): Phase | null => lifeOf(c)?.phase ?? null;

let forced: Phase | null = null;
/** testing: the next village built starts in this part of the day */
export function forcePhase(p: Phase | null) { forced = p; }

function initialPhase(c: VCtx): Phase {
  if (forced) { const p = forced; forced = null; return p; }
  const hp = phaseOfHour(hourOf(c.f));
  if (c.tod === 'night') return hp === 'night' ? 'night' : 'evening';
  if (c.tod === 'dusk') return 'evening';
  if (c.tod === 'dawn') return 'morning';
  return hp === 'morning' ? 'morning' : 'midday';
}

// ------------------------------------------------------------------ install
export function installLife(c: VCtx) {
  registerLifeAnims();
  const f = c.f;
  const L: Life = {
    c, phase: 'midday', hp: null, gen: {}, goT: {}, greetT: {}, lineT: {}, near: {}, fxT: {},
    tag: { it: 'pipi', pause: 0, re: 0 }, globalT: 3, checkT: 2, sing: 6, jam: null, ducked: false, mood: 0,
  };
  LIVES.set(c, L);
  if (!c.festival) setPhase(c, initialPhase(c), true);
  else L.phase = 'evening';
  windows(L);
  lateFire(L);
  kite(L);
  nightTorch(L);
  f.main.add(new Custom(0, () => {}, dt => tick(L, dt)));
}

/** move the village into a part of the day (instant: everyone is simply there) */
export function setPhase(c: VCtx, ph: Phase, instant = false) {
  const L = LIVES.get(c);
  if (!L || c.festival) return;
  L.phase = ph;
  for (const rt of Object.values(c.vill)) assign(L, rt, ph, instant);
  if (ph !== 'evening') L.mood = 0;
}

function assign(L: Life, rt: VillagerRT, ph: Phase, instant: boolean) {
  const c = L.c, a = rt.a, sl = SCHED[rt.id]?.[ph];
  if (!sl) return;
  const gen = (L.gen[rt.id] = (L.gen[rt.id] ?? 0) + 1);
  rt.roam = undefined;
  rt.ext = undefined;
  setCarry(a, null);
  if (rt.held) { a.visible = true; }
  if (sl.home) {
    rt.stations = [];
    rt.ext = 'home';
    const hx = HOME[rt.id] ?? a.x;
    if (instant) { a.stopWalk(); a.visible = false; place(c, a, hx); return; }
    L.goT[rt.id] = rand.range(0.5, 8);
    return;
  }
  if (!a.visible) { a.visible = true; place(c, a, HOME[rt.id] ?? a.x); }
  if (sl.tag) { rt.ext = 'tag'; rt.stations = []; if (instant) place(c, a, rand.range(TAG_RANGE[0], TAG_RANGE[1])); a.idleAnim = 'idle'; a.setAnim('idle'); return; }
  if (sl.roam) { rt.roam = sl.roam; rt.stations = []; rt.t = rand.range(0.5, 3); if (instant) place(c, a, rand.range(sl.roam[0], sl.roam[1])); a.idleAnim = 'idle'; a.setAnim('idle'); return; }
  const st = sl.kite ? [S(KITE_X, 'kite', 1, 999)] : sl.st ?? [];
  if (!st.length) return;
  rt.stations = st;
  rt.i = 0;
  const s0 = st[0];
  if (instant) {
    a.stopWalk();
    place(c, a, s0.x);
    if (s0.face) a.facing = s0.face;
    a.idleAnim = s0.anim;
    a.setAnim(s0.anim);
    rt.t = s0.stay !== undefined && s0.stay < 999 ? rand.range(4, s0.stay) : 999;
    return;
  }
  rt.ext = 'go';
  L.goT[rt.id] = rand.range(0.3, 6);
  void gen;
}
function place(c: VCtx, a: Actor, x: number) { a.x = x; a.y = c.ground(x); }

/** set off for the spot a new part of the day asked for (or the door at bedtime) */
function setOff(L: Life, rt: VillagerRT) {
  const c = L.c, a = rt.a, gen = L.gen[rt.id];
  const home = rt.ext === 'home';
  const tx = home ? HOME[rt.id] ?? a.x : rt.stations[0]?.x ?? a.x;
  const kid = KIDS.has(rt.id);
  const sp = kid ? 70 : 40;
  void a.walkTo(tx, sp, kid ? 'run' : 'walk').then(() => {
    if (L.gen[rt.id] !== gen || rt.held || c.hold) return;
    if (Math.abs(a.x - tx) > 4) { L.goT[rt.id] = 1; return; }
    if (home) { a.visible = false; return; }
    const s = rt.stations[0];
    if (!s) return;
    if (s.face) a.facing = s.face;
    a.idleAnim = s.anim;
    a.setAnim(s.anim);
    rt.ext = undefined;
    rt.i = 0;
    rt.t = s.stay !== undefined && s.stay < 999 ? s.stay * rand.range(0.8, 1.2) : 999;
  });
  L.goT[rt.id] = 9999;
}

// ------------------------------------------------------------------ the frame
function tick(L: Life, dt: number) {
  const c = L.c, f = c.f;
  if (game.scene !== f || !(dt > 0)) return;
  const busy = c.hold || f.cutscene;
  // the clock
  L.checkT -= dt;
  if (L.checkT <= 0) {
    L.checkT = 2;
    const hp = phaseOfHour(hourOf(f));
    if (L.hp === null) L.hp = hp;
    else if (hp !== L.hp && !busy && !c.festival) { L.hp = hp; if (hp !== L.phase) setPhase(c, hp); }
  }
  music(L, dt, busy);
  if (busy || c.festival) return;
  for (const rt of Object.values(c.vill)) {
    if (rt.held) continue;
    if ((rt.ext === 'go' || rt.ext === 'home') && L.goT[rt.id] !== undefined && L.goT[rt.id] < 999) {
      L.goT[rt.id] -= dt;
      if (L.goT[rt.id] <= 0) setOff(L, rt);
    }
    if (rt.a.visible) workFx(L, rt, dt);
  }
  tagGame(L, dt);
  social(L, dt);
}

// ------------------------------------------------------------------ tag round the houses
function tagGame(L: Life, dt: number) {
  const c = L.c;
  const kids = Object.values(c.vill).filter(rt => rt.ext === 'tag' && !rt.held && rt.a.visible);
  if (kids.length < 2) return;
  const T = L.tag;
  let it = kids.find(k => k.id === T.it);
  if (!it) { it = kids[0]; T.it = it.id; T.pause = 1.5; }
  const A0 = it.a;
  if (T.pause > 0) {
    T.pause -= dt;
    if (A0.walking) A0.stopWalk();
    if (A0.anim !== 'idle' && A0.anim !== 'cheer') A0.setAnim('idle');
    if (T.pause <= 0) { A0.idleAnim = 'idle'; void A0.play('point', 'idle'); }
  } else {
    const prey = kids.filter(k => k !== it).sort((p, q) => Math.abs(p.a.x - A0.x) - Math.abs(q.a.x - A0.x))[0];
    T.re -= dt;
    if (T.re <= 0) { T.re = 0.35; void A0.walkTo(clamp(prey.a.x, TAG_RANGE[0], TAG_RANGE[1]), 96, 'run'); }
    if (Math.abs(prey.a.x - A0.x) < 9) {
      bark(it.id, rand.pick(['Tag! You’re it!', 'Got you!', 'TAG!']), { expr: 'excited', clean: true });
      A0.stopWalk();
      void A0.play('cheer', 'idle');
      prey.a.stopWalk();
      T.it = prey.id;
      T.pause = 1.8;
      audio.play('collectPop', { vol: 0.12, pitch: 1.6 });
    }
  }
  // the others run from whoever's it (dodging back past them at the ends of the yard)
  for (const k of kids) {
    if (k === it) continue;
    const a = k.a, d = a.x - A0.x;
    if (Math.abs(d) < 70 && !a.walking) {
      let tx = a.x + Math.sign(d || 1) * rand.range(60, 120);
      if (tx < TAG_RANGE[0] || tx > TAG_RANGE[1]) tx = A0.x - Math.sign(d || 1) * rand.range(40, 80);
      void a.walkTo(clamp(tx, TAG_RANGE[0], TAG_RANGE[1]), rand.range(84, 100), 'run');
    } else if (!a.walking && rand.chance(dt * 0.4)) void a.play(rand.pick(['jump', 'laugh', 'wave']), 'idle');
  }
}

// ------------------------------------------------------------------ greetings and a word in passing
function social(L: Life, dt: number) {
  const c = L.c, f = c.f, p = f.player, now = c.f.st.time;
  L.globalT -= dt;
  for (const rt of Object.values(c.vill)) {
    const a = rt.a;
    if (!a.visible || rt.held || rt.ext === 'tag') continue;
    const d = Math.abs(a.x - p.x);
    L.near[rt.id] = d < 70 ? (L.near[rt.id] ?? 0) + dt : 0;
    if (L.globalT > 0 || game.ui.bubbles.active || f.cutscene) continue;
    const met = vf('met:' + rt.id);
    const n = met ? 'Mori' : 'e hoa';
    if (d < 84 && now - (L.greetT[rt.id] ?? -999) > 150) {
      L.greetT[rt.id] = now;
      L.globalT = rand.range(3, 6);
      const kid = KIDS.has(rt.id) && rt.id !== 'manu';
      const line = rand.pick(kid ? KID_GREET : GREET[L.phase]).replace(/\{n\}/g, n);
      a.faceTo(p.x);
      const sitting = /sit|Sit|craft|kneel|dig|stir|fish|doze|guitar|strum|hammer/.test(a.anim);
      if (!sitting && !a.walking) void a.play('wave', a.idleAnim);
      bark(rt.id, met || kid ? line : rand.pick(['Kia ora! You must be Aroha’s friend.', 'Haere mai! Welcome, welcome.']), { expr: 'happy', clean: true });
      continue;
    }
    if (L.near[rt.id] > 2.5 && now - (L.lineT[rt.id] ?? -999) > 45) {
      const ls = LINES[rt.id]?.[L.phase];
      L.lineT[rt.id] = now;
      if (!ls?.length) continue;
      L.globalT = rand.range(4, 7);
      bark(rt.id, rand.pick(ls), { expr: 'happy', clean: true });
    }
  }
}

// ------------------------------------------------------------------ the work throws things about
const WOOD: [number, number, number][] = [[0.78, 0.6, 0.38], [0.9, 0.76, 0.52], [0.62, 0.44, 0.26]];
const SOIL: [number, number, number][] = [[0.3, 0.2, 0.12], [0.42, 0.3, 0.18], [0.24, 0.16, 0.1]];
function workFx(L: Life, rt: VillagerRT, dt: number) {
  const c = L.c, f = c.f, a = rt.a;
  if (Math.abs(a.x - f.player.x) > 420 || a.walking) return;
  const anim = a.anim;
  const kind = anim === 'hammer' ? 'chip' : anim === 'dig' ? 'soil' : anim === 'scatter' ? 'grain'
    : anim === 'kneelWork' && a.x > X.garden[0] && a.x < X.garden[1] ? 'soil'
    : anim === 'kneelWork' && Math.abs(a.x - X.hangi) < 30 ? 'steam'
    : anim === 'craft' && Math.abs(a.x - X.shelter) < 20 ? 'fibre' : null;
  if (!kind) return;
  L.fxT[rt.id] = (L.fxT[rt.id] ?? rand.range(0, 0.4)) - dt;
  if (L.fxT[rt.id] > 0) return;
  const P = f.main.particles, gy = c.ground(a.x), fc = a.facing;
  if (kind === 'chip') {
    L.fxT[rt.id] = rand.range(0.22, 0.5);
    const n = rand.int(2, 4);
    for (let i = 0; i < n; i++) P.spawn({ frame: A.dot, x: a.x + fc * 13, y: a.y - 13, vx: fc * rand.range(20, 70) + rand.range(-15, 15), vy: rand.range(-80, -30), ay: 260, life: rand.range(0.5, 0.9), color: rand.pick(WOOD), alpha: 1, alpha1: 1, size: rand.range(0.5, 0.9), floorY: gy + 1 });
    if (rand.chance(0.25)) audio.play('hammer', { vol: 0.05, pitch: rand.range(0.8, 1.1) });
  } else if (kind === 'soil') {
    L.fxT[rt.id] = rand.range(0.5, 1.1);
    for (let i = 0; i < 3; i++) P.spawn({ frame: A.dot, x: a.x + fc * 9, y: gy - 3, vx: fc * rand.range(10, 40), vy: rand.range(-60, -25), ay: 240, life: rand.range(0.5, 0.8), color: rand.pick(SOIL), alpha: 1, alpha1: 1, size: rand.range(0.6, 1), floorY: gy + 1 });
  } else if (kind === 'grain') {
    L.fxT[rt.id] = rand.range(0.9, 1.4);
    for (let i = 0; i < 7; i++) P.spawn({ frame: A.dot, x: a.x + fc * 10, y: a.y - 20, vx: fc * rand.range(30, 80), vy: rand.range(-40, 0), ay: 200, life: rand.range(0.6, 1), color: [0.92, 0.82, 0.5], alpha: 1, alpha1: 0.9, size: 0.45, floorY: gy + 1 });
  } else if (kind === 'steam') {
    L.fxT[rt.id] = rand.range(0.3, 0.6);
    P.spawn({ frame: A.soft, x: X.hangi + rand.range(-8, 8), y: c.ground(X.hangi) - 4, vx: rand.range(-3, 3) + f.st.wind * 5, vy: rand.range(-18, -10), life: rand.range(1.6, 2.6), color: [0.86, 0.86, 0.86], alpha: 0.28, alpha1: 0, size: 0.3, size1: 1.4 });
  } else {
    L.fxT[rt.id] = rand.range(1.2, 2.4);
    P.spawn({ frame: A.dot, x: a.x + fc * 8, y: a.y - 12, vx: rand.range(-8, 8), vy: rand.range(-10, 5), ay: 30, life: rand.range(1, 1.6), color: [0.42, 0.56, 0.22], alpha: 1, alpha1: 1, size: 0.5, floorY: gy + 1, flutter: 4 });
  }
}

// ------------------------------------------------------------------ evening: the guitar, the singing
function music(L: Life, dt: number, busy: boolean) {
  const c = L.c, f = c.f, hana = c.vill.hana?.a;
  const playing = L.phase === 'evening' && !c.festival && !!hana && hana.visible && hana.anim === 'guitarSit' && !c.vill.hana.held;
  const d = Math.abs(f.player.x - X.fire);
  const vol = playing && !busy && !closeupOpen() && !game.ui.blocking ? clamp(1 - (d - 70) / 330, 0, 1) * 0.5 : 0;
  if (playing && !L.jam) L.jam = new FireJam();
  L.jam?.tick(vol);
  // the site's music steps aside for Hana while Mori is in earshot
  if (vol > 0.06 && !L.ducked) { L.ducked = true; audio.setMusic('none'); }
  else if (vol <= 0.01 && L.ducked && !closeupOpen()) { L.ducked = false; audio.setMusic(((f.site as unknown as { music?: Music }).music ?? 'aroha')); }
  if (vol < 0.12 || busy) return;
  L.sing -= dt * (1 + L.mood);
  if (L.sing > 0 || game.ui.bubbles.active) return;
  L.sing = rand.range(7, 11);
  const singers = Object.values(c.vill).filter(rt => rt.a.visible && !rt.held && /sing|clapSit|sitGround|snakeDance/.test(rt.a.anim) && Math.abs(rt.a.x - X.fire) < 160);
  if (!singers.length) return;
  const who = rand.pick(singers);
  if (rand.chance(0.7)) bark(who.id, rand.pick(SONG), { expr: 'happy', clean: true });
  else bark(who.id, rand.pick(FIRE_BANTER), { expr: 'laugh', clean: true });
}

/** a song well played warms the whole fire: more singing, people clap along, the kids get up and dance */
export function raiseMood(c: VCtx, k: number) {
  const L = LIVES.get(c);
  if (!L) return;
  L.mood = clamp(L.mood + k, 0, 1);
  if (L.mood < 0.4) return;
  for (const rt of Object.values(c.vill)) {
    const a = rt.a;
    if (!a.visible || rt.held || rt.ext) continue;
    if (Math.abs(a.x - X.fire) > 160) continue;
    const to = a.anim === 'sit' ? 'sing' : a.anim === 'sitGround' ? (KIDS.has(rt.id) ? 'snakeDance' : 'clapSit') : null;
    if (to) { a.idleAnim = to; a.setAnim(to); }
  }
}

// ------------------------------------------------------------------ lamps in the windows
function lightsOn(L: Life, late: boolean) {
  const h = hourOf(L.c.f);
  if (L.phase === 'night') return late && (h >= 22 || h < 1);
  if (L.phase !== 'evening') return false;
  return h >= 18 || L.c.tod === 'dusk' || L.c.tod === 'night';
}
function windows(L: Life) {
  const c = L.c, f = c.f;
  for (const hs of HOUSES) {
    const cc = sprite(`vil12:win:${hs.v}`, () => LA.litWindow(hs.v));
    if (!cc) continue;
    const wx = hs.x + 14, wy = c.ground(hs.x) + 3 - 38;
    const ls = new LightSource(wx + 7, wy + 8, 54, [1, 0.66, 0.32], 0.4, -5.8, A.glow, 0.12, 0.12, 0.05);
    f.main.add(new Custom(-5.85, rr => {
      const on = lightsOn(L, hs.late);
      ls.on = on;
      if (!on) return;
      rr.emissive(1);
      rr.draw(cc.f, wx, wy);
      rr.emissive();
    }));
    f.main.add(ls);
  }
}

// ------------------------------------------------------------------ the marae fire, lit when the day turns
function lateFire(L: Life) {
  const c = L.c, f = c.f;
  if (c.night || c.tod === 'dusk') return;
  const x = X.fire, y = c.ground(x), big = 1.2;
  const lit = () => L.phase === 'evening' || L.phase === 'night';
  const fl = [new AnimProp(propAnims.flame, x, y - 1, -0.6, 12, { emissive: 1, sx: big, sy: big }), new AnimProp(propAnims.flame, x + 4 * big, y - 2, -0.5, 10, { emissive: 1, sx: 0.7 * big, sy: 0.8 * big }), new AnimProp(propAnims.flame, x - 4 * big, y - 1, -0.5, 9, { emissive: 1, sx: 0.6 * big, sy: 0.7 * big })];
  const ls = new LightSource(x, y - 16 * big, 120 * big, [1, 0.58, 0.26], 0.46, 0.4, A.glow, 0.22 * big, 0.16, 0.03);
  let t = 0;
  f.main.add(new Custom(-0.6, (rr, st) => { if (lit()) for (const p of fl) p.draw(rr); void st; }, dt => {
    for (const p of fl) p.update(dt);
    ls.on = lit();
    if (!ls.on) return;
    t -= dt;
    if (t > 0) return;
    t = 0.08;
    f.main.glowParticles.spawn({ frame: A.dot, x: x + rand.range(-4, 4) * big, y: y - 8 * big, vx: rand.range(-10, 10), vy: rand.range(-60, -30), life: rand.range(0.8, 1.6), color: [1, 0.78, 0.38], alpha: 1, alpha1: 0, glow: true, intensity: 3, wobble: 6, wobbleF: 2 });
  }));
  f.main.add(ls);
}

// ------------------------------------------------------------------ Mikaere's kite over the marae
function kite(L: Life) {
  const c = L.c, f = c.f;
  const k = sprite('vil12:kite', LA.manuKite), tuft = sprite('vil12:kiteTuft', LA.tailTuft);
  if (!k || !tuft) return;
  const LINE = packColor(0.92, 0.88, 0.76, 1);
  f.main.add(new Custom(40, (rr, st) => {
    const m = c.vill.mikaere;
    if (!m || !m.a.visible || m.a.anim !== 'kite' || L.phase !== 'midday') return;
    const a = m.a, t = st.time;
    const hx = a.x + a.facing * 7, hy = a.y - 31;
    const kx = Math.round(hx + 34 + st.wind * 16 + Math.sin(t * 0.7) * 12 + Math.sin(t * 2.3) * 3);
    const ky = Math.round(hy - 92 + Math.sin(t * 1.1) * 7 + Math.cos(t * 2.9) * 2);
    // the line, sagging a little under its own weight
    const n = 46;
    for (let i = 0; i <= n; i++) {
      const u = i / n, sag = Math.sin(u * Math.PI) * 9;
      rr.rect(Math.round(hx + (kx - hx) * u), Math.round(hy + (ky - hy) * u + sag), 1, 1, LINE);
    }
    // the tail of feather tufts streaming downwind
    for (let i = 1; i <= 5; i++) {
      const tx = kx + i * 5 + Math.sin(t * 3 + i * 0.9) * 2, ty = ky + 9 + i * 4 + Math.sin(t * 2.2 + i) * 1.5;
      rr.draw(tuft.f, Math.round(tx), Math.round(ty));
    }
    rr.draw(k.f, kx, ky);
  }));
}

// ------------------------------------------------------------------ Rāwiri's torch for the eels
function nightTorch(L: Life) {
  const c = L.c, f = c.f;
  const ls = new LightSource(0, 0, 70, [1, 0.6, 0.28], 0.5, 44.5, A.glow, 0.16, 0.22, 0.08);
  f.main.add(new Custom(44.4, rr => {
    const r = c.vill.rawiri;
    const on = !!r && r.a.visible && L.phase === 'night' && Math.abs(r.a.x - (X.hinaki + 6)) < 30;
    ls.on = on;
    if (!on) return;
    const a = r.a;
    ls.x = a.x - 9; ls.y = a.y - 34;
    rr.emissive(1);
    for (let i = 0; i < 3; i++) rr.fxDraw(A.spark, a.x - 10 + i * 2 + Math.sin(f.st.time * 9 + i) * 1.2, a.y - 33 - Math.abs(Math.sin(f.st.time * 7 + i * 2)) * 4, 0.6, 0.8, 0, packColor(1, 0.6 + i * 0.12, 0.22, 1), 1.2);
    rr.emissive();
  }));
  f.main.add(ls);
}

// ------------------------------------------------------------------ testing
export const LIFE_ZL = {
  phase: (p: Phase) => { const c = curCtx?.(); if (c) setPhase(c, p, false); return p; },
  jump: (p: Phase) => { const c = curCtx?.(); if (c) setPhase(c, p, true); return p; },
  force: forcePhase,
  info: () => { const c = curCtx?.() ?? null, L = lifeOf(c); return L && c ? { phase: L.phase, hp: L.hp, hour: +hourOf(c.f).toFixed(2), mood: L.mood, who: Object.values(c.vill).map(r => `${r.id}:${r.a.anim}:${Math.round(r.a.x)}:${r.a.visible ? 'v' : 'h'}:${r.ext ?? ''}`) } : null; },
};
let curCtx: (() => VCtx | null) | null = null;
export function bindLifeCtx(fn: () => VCtx | null) { curCtx = fn; }
