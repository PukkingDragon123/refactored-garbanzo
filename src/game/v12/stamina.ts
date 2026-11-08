// V12 stamina (user, latest: "show stamina"): Mori's breath, read on his field watch's ring
// (src/ui/v12/watch.ts, src/ui/v11/hud2classic.ts). Sprinting (Shift, or the touch stick pushed all the
// way) burns it fast; climbing, swimming and wading burn it slowly; walking refills it a little and
// standing still or crouching refills it quickly, after a breath. Hunger lowers the cap: a hungry
// Mori can't fill his lungs all the way (src/game/v12/hunger.ts). Run it to nothing and he's winded
// for a few seconds: no sprint, a heavy walk, slower on ladders and in the water, panting.
//
//   stamina()        0..1 now        staminaMax()   0..1 the cap hunger allows
//   heartRate()      beats a minute (the watch's BODY face): rests near 64, climbs to ~170 flat out
//   tickStamina(dt, o)  once a frame from the body tick (src/game/v10/energy.ts tickBody)

import { clamp } from '../../core/math';
import { hunger } from './hunger';
import { audio } from '../../core/audio';
import type { Player } from '../../world/player';

/** per second, as a fraction of a full tank */
const DRAIN = { sprint: 0.17, climb: 0.055, swim: 0.07, wade: 0.03 } as const;
const REGEN = { rest: 0.2, walk: 0.07 } as const;
/** seconds after the last drain before it starts to come back */
const CATCH = 0.7;
/** seconds winded once it hits empty */
const WINDED = 3.2;

const st = { s: 1, catchT: 0, winded: 0, bpm: 66, emptyAt: -1, lowWarned: false };
type Listener = (e: 'winded' | 'recovered' | 'low') => void;
const fns: Listener[] = [];
export function onStamina(fn: Listener): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }
const emit = (e: 'winded' | 'recovered' | 'low') => { for (const f of fns.slice()) f(e); };

/** the cap hunger allows: full when fed, about 55% starving */
export function staminaMax(): number { return clamp(1 - Math.max(0, hunger() - 0.35) * 0.7, 0.5, 1); }
export function stamina(): number { return clamp(st.s, 0, staminaMax()); }
export function isWinded(): boolean { return st.winded > 0; }
export function heartRate(): number { return Math.round(st.bpm); }
/** fill it back up (a meal, a night's sleep) */
export function refillStamina(k = 1) { st.s = Math.min(staminaMax(), st.s + k); st.winded = 0; }

export type StaminaAct = 'idle' | 'rest' | 'walk' | 'wade' | 'climb' | 'swim' | 'work';

/** once a frame: drain for what he's doing, refill when he eases off, and tell the player body */
export function tickStamina(dt: number, p: Player, act: StaminaAct, live: boolean) {
  if (!(dt > 0)) return;
  const cap = staminaMax();
  let drain = 0;
  if (live) {
    if (p.running) drain = DRAIN.sprint;
    else if (act === 'climb') drain = DRAIN.climb;
    else if (act === 'swim') drain = DRAIN.swim;
    else if (act === 'wade') drain = DRAIN.wade;
  }
  if (drain > 0) {
    st.s = Math.max(0, st.s - drain * dt);
    st.catchT = CATCH;
  } else {
    st.catchT = Math.max(0, st.catchT - dt);
    if (st.catchT <= 0) st.s = Math.min(cap, st.s + (act === 'walk' ? REGEN.walk : act === 'work' ? REGEN.walk : REGEN.rest) * (st.winded > 0 ? 0.6 : 1) * dt);
  }
  if (st.s > cap) st.s = Math.max(cap, st.s - 0.25 * dt);
  // empty: winded
  if (st.s <= 0.002 && st.winded <= 0 && drain > 0) {
    st.winded = WINDED;
    audio.play('wrong', { vol: 0.18, pitch: 0.55 });
    p.body.setExpr('tired', WINDED);
    p.body.showEmote?.('sweat', 2);
    emit('winded');
  }
  if (st.winded > 0) { st.winded -= dt; if (st.winded <= 0) { st.winded = 0; emit('recovered'); } }
  if (st.s < 0.22 && !st.lowWarned && drain > 0) { st.lowWarned = true; emit('low'); }
  if (st.s > 0.4) st.lowWarned = false;
  // the heart: chases a target set by the effort, slowly back down
  const target = st.winded > 0 ? 172 : p.running ? 150 + (1 - st.s) * 22 : act === 'climb' || act === 'swim' ? 118 : act === 'wade' ? 104 : act === 'walk' ? 88 : 64 + (1 - st.s) * 30;
  st.bpm += (target - st.bpm) * Math.min(1, dt * (target > st.bpm ? 1.6 : 0.45));
  // what the player body reads
  p.winded = st.winded > 0;
  p.staminaK = 0.55 + 0.45 * clamp(st.s / 0.35);
}

export const STAMINA_ZL = { get: stamina, set: (v: number) => { st.s = clamp(v); }, max: staminaMax, bpm: heartRate, winded: isWinded };
