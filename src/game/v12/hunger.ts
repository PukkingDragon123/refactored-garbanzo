// V12 hunger: replaces stamina. There is no energy bar, no sprint and nothing to drain except Mori's
// stomach. Hunger (0 = full .. 1 = starving) rises with time (game hours) and a little faster with
// hard work (climbing, swimming, wading); food from the backpack, Joshu's breakfast and dinner, and
// dishes cooked at the fire bring it back down (feed). As it rises Mori's stomach growls: a funny
// synthesised growl (audio 'growl'), a little clutch-the-belly animation and a floating "*grrrowl*".
// Too hungry (TOO_HUNGRY) and he refuses to take photos ("Can't focus...") until he has eaten.
// Starving out on the trail (1.0) and he sits down where he is: the loop module (loop.ts) sends Aroha
// to carry him home (the old funny carry-home).
//
// API (the V12 contract): hunger(), tooHungryForPhotos(), feed(amount), onGrowl(fn)
// plus: addHunger(n), passHours(h), tickHunger(dt, o), setHunger(h), growl(), onStarving(fn),
// hungerWord() for lines that describe how he feels.

import { game } from '../game';
import { bucket } from '../v10/store';
import { audio } from '../../core/audio';
import { floatText } from '../../ui/v12/float';

/** the thresholds: a first growl, a louder one, too hungry for photos, starving */
export const PECKISH = 0.45, HUNGRY = 0.65, TOO_HUNGRY = 0.8, STARVING = 1;

/** hunger per game hour (1 game hour is about three real minutes out on the trails) */
const PER_HOUR = { rest: 0.045, idle: 0.07, walk: 0.085, work: 0.1, wade: 0.11, climb: 0.15, swim: 0.16 } as const;
export type HungerActivity = keyof typeof PER_HOUR;

interface HungerState {
  h: number;
  /** the highest threshold already announced (0 none, 1 peckish, 2 hungry, 3 too hungry, 4 starving) */
  lvl: number;
  /** day the starving fired on */
  starved: number;
}
const S = () => bucket<HungerState>('hunger', () => ({ h: 0.2, lvl: 0, starved: 0 }));
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export function hunger(): number { return clamp(S().h); }
export function tooHungryForPhotos(): boolean { return hunger() >= TOO_HUNGRY; }
/** a word for how he feels (for barks and the notebook) */
export function hungerWord(h = hunger()): string {
  return h >= TOO_HUNGRY ? 'starving' : h >= HUNGRY ? 'hungry' : h >= PECKISH ? 'peckish' : h >= 0.2 ? 'fine' : 'full';
}

type GrowlFn = (level: number) => void;
const fns: GrowlFn[] = [];
/** called on every growl with the level (1 peckish .. 3 too hungry .. 4 starving); returns an unsubscribe */
export function onGrowl(fn: GrowlFn): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }
type StarveFn = () => void;
const starveFns: StarveFn[] = [];
/** called once a day when Mori starves out on the trail (the loop module sends Aroha) */
export function onStarving(fn: StarveFn): () => void { starveFns.push(fn); return () => { const i = starveFns.indexOf(fn); if (i >= 0) starveFns.splice(i, 1); }; }

const levelOf = (h: number) => (h >= STARVING ? 4 : h >= TOO_HUNGRY ? 3 : h >= HUNGRY ? 2 : h >= PECKISH ? 1 : 0);

/** eat: hunger drops by `amount` (a light snack ~0.15, a packed lunch ~0.35, a hot meal 0.6+) */
export function feed(amount: number): void {
  if (!(amount > 0)) return;
  const s = S();
  const was = s.h;
  s.h = clamp(s.h - amount);
  s.lvl = Math.min(s.lvl, levelOf(s.h));
  if (was >= TOO_HUNGRY && s.h < TOO_HUNGRY) {
    setTimeout(() => void floatText({ text: pick(['Ahh. Much better. I can think again.', 'Food. Glorious food. Okay, where was I?', 'Right! Camera hands are back.']), style: 'happy', ms: 2400 }), 900);
  }
  nextGrowl = 40 + Math.random() * 30;
  game.persist();
}

/** hunger rises (hard work, a long trail, bad food...) */
export function addHunger(n: number, _why = ''): void {
  if (!(n > 0)) return;
  const s = S();
  s.h = clamp(s.h + n);
}

/** set it outright (a new morning, debug) */
export function setHunger(h: number): void {
  const s = S();
  s.h = clamp(h);
  s.lvl = levelOf(s.h);
  nextGrowl = 30;
}

/** time passes off-screen (a trail between two places, a nap): hunger for those hours */
export function passHours(hours: number, act: HungerActivity = 'walk'): void {
  if (!(hours > 0)) return;
  addHunger(hours * PER_HOUR[act]);
  check(true);
}

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const LINES: Record<number, string[]> = {
  1: ['Hm. Getting peckish.', 'Was that my stomach? That was my stomach.', 'Lunch would be nice. Just saying.'],
  2: ['My stomach is filing formal complaints.', 'I could eat a whole pipi. Shell and all.', 'Note to self: food exists. Find some.'],
  3: ['Can’t... focus... on anything... but food.', 'I need to eat. Like, now. No more photos till I do.', 'Everything looks like a sandwich. Even that rock.'],
  4: ['Legs... wobbly... need... food...'],
};

let nextGrowl = 60;
let away = false;
/** is a cutscene / menu up? (no growls then; they wait) */
let quietFn: () => boolean = () => false;

/**
 * Once a frame from the field scenes (energy.ts tickBody): hunger rises with time and what Mori is
 * doing, and his stomach growls now and then once he's hungry. `live` false (a cutscene, a menu)
 * pauses it. `out`: away from camp (only there can he starve).
 */
export function tickHunger(dt: number, o: { act: HungerActivity; live: boolean; out: boolean }): void {
  away = o.out;
  if (!o.live || !(dt > 0)) return;
  const s = S();
  // (at camp it never gets past "too hungry": Joshu always has something on the fire)
  const cap = o.out ? 1 : TOO_HUNGRY + 0.05;
  if (s.h < cap) s.h = Math.min(cap, s.h + (PER_HOUR[o.act] * dt) / 180);
  check(false);
  if (s.h >= PECKISH) {
    nextGrowl -= dt;
    if (nextGrowl <= 0 && !quietFn()) {
      const lv = levelOf(s.h);
      growl(lv);
      nextGrowl = lv >= 3 ? 26 + Math.random() * 18 : lv >= 2 ? 45 + Math.random() * 25 : 70 + Math.random() * 40;
    }
  }
}

/** a new threshold: announce it with a growl (and fire the starving once) */
function check(quick: boolean) {
  const s = S();
  const lv = levelOf(s.h);
  if (lv > s.lvl) {
    s.lvl = lv;
    if (lv >= 4) {
      if (!away) { s.h = Math.min(s.h, 0.99); s.lvl = 3; return; }
      const day = game.save.day || 1;
      if (s.starved === day) return;
      s.starved = day;
      game.persist();
      growl(4);
      setTimeout(() => { for (const f of starveFns.slice()) { try { f(); } catch (e) { console.error('[hunger] starving', e); } } }, quick ? 200 : 2600);
      return;
    }
    if (quick) nextGrowl = 2; // after a trail: the growl comes as he arrives
    else growl(lv, true);
    game.persist();
  }
}

type BodyLike = { setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void; react(k: string): void; play?(a: string, then?: string): Promise<void> };
/** Mori's stomach growls: the sound, a clutch of the belly, a floating "*grrrowl*", maybe a line */
export function growl(level = levelOf(hunger()), withLine = false): void {
  const lv = Math.max(1, Math.min(4, level));
  audio.play('growl' as never, { vol: 0.45 + lv * 0.12, pitch: 1.12 - lv * 0.06 + Math.random() * 0.08 });
  const sc = game.scene as unknown as { player?: { body: BodyLike; state: string } } | null;
  const b = sc?.player?.body;
  if (b) {
    b.setExpr(lv >= 3 ? 'sad' : 'surprised', 1.6);
    void import('../../art/v7/anim-contract').then(m => {
      if (m.hasAnim7('growl') && b.play && sc?.player?.state === 'normal') b.play('growl', 'idle').catch(() => {});
      else { b.react('shrink'); b.showEmote('sweat', 1.4); }
    }).catch(() => { b.react('shrink'); });
  }
  const g = lv >= 3 ? '*GRRRROOOWWL*' : lv >= 2 ? '*grrrrowl*' : '*grrowl...*';
  void floatText({ text: g, style: lv >= 3 ? 'shout' : 'scared', ms: 1400 });
  if (withLine || lv >= 3 || Math.random() < 0.4) {
    setTimeout(() => void floatText({ text: pick(LINES[lv]), style: lv >= 3 ? 'sad' : 'think', ms: 2800 }), 1500);
  }
  for (const f of fns.slice()) { try { f(lv); } catch (e) { console.error('[hunger] growl', e); } }
}

/** the loop module tells the stomach when to keep quiet (cutscenes, menus) */
export function setHungerQuiet(fn: () => boolean) { quietFn = fn; }

/** debug handle: zl.hunger */
export const HUNGER_ZL = { get: hunger, set: setHunger, feed, growl: (lv?: number) => growl(lv ?? 2, true) };
