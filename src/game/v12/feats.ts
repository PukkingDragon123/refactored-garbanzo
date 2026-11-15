// V12 feats: the island's achievements (user: "hard achievements, gameplay not boring, felt super
// exciting always"). About forty, from a first photo to things almost nobody will do: a night of the
// claw without being touched, every rare animal at its spot, every behaviour of every species in the
// guide. The hidden legends stay "???" in the notebook until they are earned.
//
//   FEATS                 the list: { id, title, desc, tier, hidden?, check(), progress?() }
//   hasFeat(id)           earned?
//   featStat(key, n = 1)  bump a counter (game.save.vars['fs:' + key]); featCount(key) reads it
//   onFeat(fn)            called with the feat when one is earned (returns an unsubscribe)
//   featTally()           earned / total per tier
//   tickFeats()           installs the event taps once, then checks (called with the quests, ~4x a second)
//   grantAllFeats() / resetFeats()   for the developer panel
//
// Earned feats are game.save.flags['feat:' + id] (and the day, vars['fs:at:' + id]). The moment one is
// earned it floats up by Mori as a notice tagged with its tier, with the star chime. No toasts.
//
// The taps: every field scene's camera (onShot, chained like the feud's director), the predators
// (onPredator: darts putting one to sleep, Mori knocked flat), the quest hook, the bench (onCrafted),
// the morning (onNewDay: was yesterday's trip clean?), eating (onEaten), and Mori being hit (wilds.ts
// hitMori counts fs:hits and the day of the last one, fs:hitDay). Everything else is read off the
// save's flags and vars as it stands.

import { game } from '../game';
import { audio } from '../../core/audio';
import { SPECIES_BY_ID } from '../species';
import type { RawPhoto } from '../photos';
import { judgeShot } from './shotvalue';
import { RARE } from './rare';
import { onLocEnter } from '../v10/field10';
import { onPredator } from '../v11/predators-core';
import { onQuestEvent, setQuestHook } from '../quests';
import { onCrafted } from '../v11/bpcraft';
import { bpSave } from '../v11/blueprints';
import { onNewDay } from '../v10/day';
import { onEaten } from '../v10/forage10';
import { floatNotice } from '../../ui/v12/float';

export type FeatTier = 'bronze' | 'silver' | 'gold' | 'legend';
export interface FeatDef {
  id: string;
  title: string;
  desc: string;
  tier: FeatTier;
  /** shown as "???" until earned */
  hidden?: boolean;
  check(): boolean;
  /** how far along: [have, need] */
  progress?(): [number, number];
}

// ---------------------------------------------------------------- the save

const F = (k: string) => !!game.save?.flags?.[k];
const V = (k: string) => game.save?.vars?.[k] ?? 0;
const setV = (k: string, n: number) => { game.save.vars[k] = n; };
const day = () => Math.max(1, game.save?.day || 1);

function bump(key: string, n = 1): number {
  const s = game.save;
  if (!s) return 0;
  s.vars ??= {};
  const v = (s.vars['fs:' + key] ?? 0) + n;
  s.vars['fs:' + key] = v;
  pulse();
  return v;
}
/** bump a feat counter (game.save.vars['fs:' + key]) and save */
export function featStat(key: string, n = 1): number {
  const v = bump(key, n);
  game.persist();
  return v;
}
/** a feat counter's value */
export const featCount = (key: string) => V('fs:' + key);
export const hasFeat = (id: string) => F('feat:' + id);

// ---------------------------------------------------------------- what the feats read

const WILD5 = ['kea', 'ruru', 'tuna', 'ngaokeoke', 'titiwai'];
/** the rare animals (each comes to its spot; a species with two spots counts once: its flag is per species) */
let rareSp: string[] | null = null;
const rareSpecies = () => (rareSp ??= [...new Set(RARE.map(r => r.species))]);
const shot = (sp: string) => featCount('sp:' + sp) > 0 || !!game.save?.seen?.[sp];
const rareN = () => rareSpecies().filter(sp => F('v12:rare:' + sp)).length;
const anyRare = () => Object.keys(game.save?.flags ?? {}).some(k => k.startsWith('v12:rare:') && game.save.flags[k]);
const uploads = () => V('v9:uploads');
const questsDone = () => Object.values(game.save?.quests ?? {}).filter(s => s === 'done').length;
const madeTotal = () => { try { return Object.values(bpSave().made).reduce((a, n) => a + (n || 0), 0); } catch { return 0; } };
const crafts = () => Math.max(featCount('crafts'), madeTotal());
const seenN = () => Object.keys(game.save?.seen ?? {}).filter(k => game.save.seen[k] && SPECIES_BY_ID[k]).length;
/** every behaviour of every species: documented (photo or video evidence) / all */
function guideProgress(): [number, number] {
  const s = game.save;
  let n = 0, of = 0;
  for (const sp of Object.values(SPECIES_BY_ID)) {
    for (const b of Object.keys(sp.behaviors ?? {})) {
      of++;
      const k = `${sp.id}:${b}`;
      if (s?.evPhoto?.[k] || s?.evVideo?.[k]) n++;
    }
  }
  return [n, of];
}
const atLeast = (n: number, of: number): [number, number] => [Math.min(n, of), of];

// ---------------------------------------------------------------- the feats

export const FEATS: FeatDef[] = [
  // ---- bronze: the first time for everything
  { id: 'first_frame', tier: 'bronze', title: 'First Frame', desc: 'Get an animal on film, sharp enough to name.', check: () => featCount('ids') >= 1 },
  { id: 'patience', tier: 'bronze', title: 'Patience', desc: 'Wait at a rare animal’s spot until it walks in.', check: anyRare },
  { id: 'ten_on_file', tier: 'bronze', title: 'Ten on File', desc: 'Upload ten photos to the laptop.', check: () => uploads() >= 10, progress: () => atLeast(uploads(), 10) },
  { id: 'bench_work', tier: 'bronze', title: 'Bench Work', desc: 'Make something from a blueprint at the bench.', check: () => crafts() >= 1 },
  { id: 'grubs_up', tier: 'bronze', title: 'Grub’s Up', desc: 'Eat a huhu grub. Raw or steamed, it still counts.', check: () => featCount('huhu') >= 1 },
  { id: 'double_act', tier: 'bronze', title: 'Double Act', desc: 'Two different species named in one frame.', check: () => featCount('duo') >= 1 },
  { id: 'hot_water', tier: 'bronze', title: 'Hot Water', desc: 'Soak your feet in the hot pools at the end of the gorge.', check: () => F('wild:soaked') },
  { id: 'glued', tier: 'bronze', title: 'Glued', desc: 'Get squirted by a velvet worm.', check: () => F('wild:slimed') },
  { id: 'daylight_robbery', tier: 'bronze', title: 'Daylight Robbery', desc: 'Leave your pack open for a kea. It will not say sorry.', check: () => F('wild:keaThief') },
  { id: 'lights_out', tier: 'bronze', title: 'Lights Out', desc: 'Put a predator to sleep with a dart.', check: () => featCount('sleeps') >= 1 },
  { id: 'week_out', tier: 'bronze', title: 'A Week Out', desc: 'Still standing on day seven.', check: () => day() >= 7, progress: () => atLeast(day(), 7) },
  { id: 'odd_jobs', tier: 'bronze', title: 'Odd Jobs', desc: 'Tick off five quests.', check: () => questsDone() >= 5, progress: () => atLeast(questsDone(), 5) },

  // ---- silver: you have to mean it
  { id: 'backcountry_five', tier: 'silver', title: 'Backcountry Five', desc: 'Photograph the kea, the ruru, the tuna, the ngaokeoke and the titiwai.', check: () => WILD5.every(shot), progress: () => [WILD5.filter(shot).length, WILD5.length] },
  { id: 'not_a_scratch', tier: 'silver', title: 'Not a Scratch', desc: 'Walk out and home again on the same day without being hit once.', check: () => featCount('cleanDays') >= 1 },
  { id: 'sharp_eye', tier: 'silver', title: 'Sharp Eye', desc: 'Ten new pictures worth three stars or more.', check: () => featCount('star3') >= 10, progress: () => atLeast(featCount('star3'), 10) },
  { id: 'still_waters', tier: 'silver', title: 'Still Waters', desc: 'Five rare animals, each waited for at its spot.', check: () => rareN() >= 5, progress: () => atLeast(rareN(), 5) },
  { id: 'sandman', tier: 'silver', title: 'Sandman', desc: 'Darts put five predators to sleep.', check: () => featCount('sleeps') >= 5, progress: () => atLeast(featCount('sleeps'), 5) },
  { id: 'tinkerer', tier: 'silver', title: 'Tinkerer', desc: 'Make ten things at the bench.', check: () => crafts() >= 10, progress: () => atLeast(crafts(), 10) },
  { id: 'naturalist', tier: 'silver', title: 'Field Naturalist', desc: 'Twenty-five species on file.', check: () => seenN() >= 25, progress: () => atLeast(seenN(), 25) },
  { id: 'archivist', tier: 'silver', title: 'Archivist', desc: 'A hundred photos uploaded.', check: () => uploads() >= 100, progress: () => atLeast(uploads(), 100) },
  { id: 'on_the_card', tier: 'silver', title: 'On the Card', desc: 'Photograph Matikuku Nui.', check: () => F('feud:photo:bearer') || F('raid:photo') || featCount('sp:bearer') > 0 },
  { id: 'gatekeeper', tier: 'silver', title: 'Gatekeeper', desc: 'Keep Matikuku Nui from the goats of Te Kāinga.', check: () => F('raid:won') },
  { id: 'storm_wings', tier: 'silver', title: 'Wings Like a Storm', desc: 'Photograph Te Pouākai up close.', check: () => F('tb:photo') },
  { id: 'bounty_hunter', tier: 'silver', title: 'Bounty Hunter', desc: 'Five bounties in a row for the agency.', check: () => V('bounty:streak') >= 5, progress: () => atLeast(V('bounty:streak'), 5) },

  // ---- gold: hard
  { id: 'untouchable', tier: 'gold', title: 'Untouchable', desc: 'Win the night of the claw without being hit once.',
    check: () => F('raid:won') && V('fs:raidTry') > 0 && V('fs:raidTry') === V('raid:tries') && V('fs:raidClean') === 1 && V('fs:hits') === V('fs:raidHits0') },
  { id: 'silent_partner', tier: 'gold', title: 'Silent Partner', desc: 'Every rare animal on the island, each waited for at its spot.', check: () => rareN() >= rareSpecies().length, progress: () => [rareN(), rareSpecies().length] },
  { id: 'night_owl', tier: 'gold', title: 'Night Owl', desc: 'Twenty-five new pictures of animals doing something, after dark.', check: () => featCount('nightBeh') >= 25, progress: () => atLeast(featCount('nightBeh'), 25) },
  { id: 'five_stars', tier: 'gold', title: 'Five Stars', desc: 'Ten new pictures worth five stars.', check: () => featCount('star5') >= 10, progress: () => atLeast(featCount('star5'), 10) },
  { id: 'full_guide', tier: 'gold', title: 'Full Guide', desc: 'Every behaviour of every species, documented.', check: () => { const [n, of] = guideProgress(); return of > 0 && n >= of; }, progress: guideProgress },
  { id: 'iron_stomach', tier: 'gold', title: 'Iron Stomach', desc: 'Eat huhu raw, ten times.', check: () => featCount('huhuRaw') >= 10, progress: () => atLeast(featCount('huhuRaw'), 10) },
  { id: 'clean_week', tier: 'gold', title: 'Seven Clean Days', desc: 'Seven days out in a row without being hit.', check: () => V('fs:cleanBest') >= 7, progress: () => atLeast(Math.max(V('fs:cleanStreak'), V('fs:cleanBest')), 7) },
  { id: 'claw_and_plume', tier: 'gold', title: 'Claw and Plume', desc: 'Matikuku Nui and Huruhuru, fighting, in one frame.', check: () => F('feud:photo:fight') },
  { id: 'banded', tier: 'gold', title: 'Banded', desc: 'Fit a band to the Thunderbird’s leg, and let it go.', check: () => F('tb:tagged') },
  { id: 'faster_than_varga', tier: 'gold', title: 'Faster Than Varga', desc: 'Get there before Varga does.', check: () => F('arc:ch2:beatVarga') },
  { id: 'ghost', tier: 'gold', title: 'Ghost', desc: 'Get through chapter three without being seen.', check: () => F('arc:ch3:unseen') },
  { id: 'agency_legend', tier: 'gold', title: 'Agency Legend', desc: 'Fifteen bounties in a row.', check: () => V('bounty:streak') >= 15, progress: () => atLeast(V('bounty:streak'), 15) },
  { id: 'everyones_friend', tier: 'gold', title: 'Everyone’s Friend', desc: 'Finish fourteen side quests.', check: () => V('side:done') >= 14, progress: () => atLeast(V('side:done'), 14) },
  { id: 'end_of_the_trail', tier: 'gold', title: 'End of the Trail', desc: 'See the story through to its end.', check: () => F('arc:done') },

  // ---- legend: almost nobody
  { id: 'thunder_and_claw', tier: 'legend', hidden: true, title: 'Thunder and Claw', desc: 'Matikuku Nui and Te Pouākai, both photographed on the same day.',
    check: () => V('fs:day:thunderbird') > 0 && V('fs:day:thunderbird') === V('fs:day:bearer') },
  { id: 'one_breath', tier: 'legend', hidden: true, title: 'One Breath', desc: 'All of chapter five’s dive without coming up for air.', check: () => F('arc:ch5:noSurface') },
  { id: 'no_sling', tier: 'legend', hidden: true, title: 'No Sling', desc: 'Chapter six, and never once reach for a weapon.', check: () => F('arc:ch6:unarmed') },
  { id: 'perfect_finale', tier: 'legend', hidden: true, title: 'Perfect Finale', desc: 'The finale without a single mistake.', check: () => F('arc:ch7:perfect') },
  { id: 'legend_of_the_island', tier: 'legend', title: 'Legend of the Island', desc: 'Earn every other feat.',
    check: () => FEATS.every(f => f.id === 'legend_of_the_island' || hasFeat(f.id)), progress: () => [FEATS.filter(f => f.id !== 'legend_of_the_island' && hasFeat(f.id)).length, FEATS.length - 1] },
];
export const FEAT_BY_ID: Record<string, FeatDef> = Object.fromEntries(FEATS.map(f => [f.id, f]));
export const TIERS: FeatTier[] = ['bronze', 'silver', 'gold', 'legend'];

/** earned / total per tier */
export function featTally(): Record<FeatTier, [number, number]> {
  const t = { bronze: [0, 0], silver: [0, 0], gold: [0, 0], legend: [0, 0] } as Record<FeatTier, [number, number]>;
  for (const f of FEATS) { t[f.tier][1]++; if (hasFeat(f.id)) t[f.tier][0]++; }
  return t;
}
/** the day a feat was earned (0: not, or before days were kept) */
export const featDay = (id: string) => V('fs:at:' + id);
/** a feat's progress, safely */
export function featProgress(f: FeatDef): [number, number] | null {
  if (!f.progress) return null;
  try { const [n, of] = f.progress(); return [Math.max(0, Math.min(n, of)), of]; } catch { return null; }
}

// ---------------------------------------------------------------- earning one

type FeatFn = (f: FeatDef) => void;
const featFns: FeatFn[] = [];
/** called with a feat the moment it is earned (returns an unsubscribe) */
export function onFeat(fn: FeatFn): () => void { featFns.push(fn); return () => { const i = featFns.indexOf(fn); if (i >= 0) featFns.splice(i, 1); }; }

const TIER_WORD: Record<FeatTier, string> = { bronze: 'BRONZE FEAT', silver: 'SILVER FEAT', gold: 'GOLD FEAT', legend: 'LEGENDARY FEAT' };
const TIER_ACCENT: Record<FeatTier, string> = { bronze: '#f2a868', silver: '#d6e2ee', gold: '#ffd84a', legend: '#94dcb0' };

function earn(f: FeatDef, quiet = false) {
  if (hasFeat(f.id)) return;
  game.save.flags['feat:' + f.id] = true;
  setV('fs:at:' + f.id, day());
  game.persist();
  if (!quiet) {
    // the moment: a notice floating up by Mori tagged with the tier, and the chime (a legend gets the
    // discovery sting under it)
    try { floatNotice(f.title, f.tier === 'legend' ? 5200 : f.tier === 'gold' ? 4400 : 3600, { tag: TIER_WORD[f.tier], accent: TIER_ACCENT[f.tier] }); } catch { /* no world yet */ }
    try {
      audio.play('star', { vol: 0.7, pitch: f.tier === 'bronze' ? 0.9 : f.tier === 'silver' ? 1 : 1.12 });
      if (f.tier === 'gold' || f.tier === 'legend') setTimeout(() => audio.play('discover', { vol: 0.45, pitch: f.tier === 'legend' ? 0.8 : 1 }), 260);
    } catch { /* no audio */ }
  }
  for (const fn of featFns.slice()) { try { fn(f); } catch (e) { console.error('[feats]', e); } }
}

function checkAll(quiet = false) {
  for (const f of FEATS) {
    if (hasFeat(f.id)) continue;
    let ok = false;
    try { ok = f.check(); } catch { ok = false; }
    if (ok) earn(f, quiet);
  }
}

// ---------------------------------------------------------------- the taps

let dirty = true;
/** something happened: check on the next tick */
function pulse() { dirty = true; }

/** a photo just taken: who is in it (named), how good, by night, doing what */
function onPhoto(ph: RawPhoto) {
  const v = judgeShot(ph, game.save.raw ?? []);
  if (!v.length) return;
  bump('ids');
  // a picture already on file (or on the roll) counts once: no farming the same frame
  const fresh = v.filter(x => x.kind !== 'same');
  for (const x of v) {
    bump('sp:' + x.species);
    if (x.species === 'bearer') setV('fs:day:bearer', day());
  }
  if (v.length >= 2) bump('duo');
  if (fresh.some(x => x.stars >= 3)) bump('star3');
  if (fresh.some(x => x.stars >= 5)) bump('star5');
  if (ph.time === 'night' && fresh.some(x => x.key.split('|')[1] !== 'still')) bump('nightBeh');
  game.persist();
}

interface CamHost { cam?: { onShot: ((p: RawPhoto) => void) | null } | null }
const hooked = new WeakSet<object>();
function hookCam(f: CamHost) {
  const cam = f?.cam;
  if (!cam || hooked.has(cam) || !('onShot' in cam)) return;
  hooked.add(cam);
  const prev = cam.onShot;
  cam.onShot = (ph: RawPhoto) => { prev?.(ph); try { onPhoto(ph); } catch (e) { console.warn('[feats] photo', e); } };
}

/** Mori was hit (the predators' knockdown; wilds.ts hitMori counts its own) */
function hit() {
  setV('fs:hits', V('fs:hits') + 1);
  setV('fs:hitDay', day());
  game.persist();
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  onLocEnter((f, loc) => {
    hookCam(f as unknown as CamHost);
    // a day out (anywhere but home: camp and the shore)
    if (loc && loc !== 'island' && loc !== 'camp') { setV('fs:fieldDay', day()); game.persist(); }
  });
  onPredator((ev, info) => {
    if (ev === 'asleep') featStat('sleeps');
    else if (ev === 'knockdown' && info.who === 'mori') hit();
  });
  const prevQ = onQuestEvent;
  setQuestHook((kind, q) => { prevQ?.(kind, q); pulse(); });
  onCrafted(() => featStat('crafts'));
  onEaten((id, fx) => {
    if (id === 'huhu') { featStat('huhu'); featStat('huhuRaw'); }
    else if (id === 'huhu_cooked') featStat('huhu');
    void fx;
  });
  onNewDay(d => {
    // was the last day out a clean one?
    const fd = V('fs:fieldDay');
    if (fd > 0 && fd < d && fd > V('fs:dayDone')) {
      setV('fs:dayDone', fd);
      if (V('fs:hitDay') === fd) setV('fs:cleanStreak', 0);
      else {
        featStat('cleanDays');
        setV('fs:cleanStreak', V('fs:cleanStreak') + 1);
        setV('fs:cleanBest', Math.max(V('fs:cleanBest'), V('fs:cleanStreak')));
      }
      game.persist();
    }
    pulse();
  });
}

/** flags whose first moment is remembered by day (the Thunderbird's photo happens only once) */
const DAY_OF: [string, string][] = [['tb:photo', 'fs:day:thunderbird'], ['raid:photo', 'fs:day:bearer'], ['feud:photo:bearer', 'fs:day:bearer']];
let saveSeen: unknown = null;
const flagWas = new Set<string>();
let n = 0;

/** a new save in hand: feats it had already earned before feats were kept are earned quietly */
function adopt() {
  saveSeen = game.save;
  flagWas.clear();
  for (const [fl, dv] of DAY_OF) if (F(fl)) { flagWas.add(fl); if (!V(dv)) setV(dv, -1); }
  if (!V('fs:v')) { checkAll(true); setV('fs:v', 1); game.persist(); }
}

/** the taps (once), the trackers, the checks: call it with the quests (a few times a second) */
export function tickFeats() {
  if (!game.save) return;
  install();
  if (game.save !== saveSeen) adopt();
  // whatever scene is up: its camera is watched (onLocEnter covers the trips; this the rest)
  hookCam(game.scene as unknown as CamHost);
  // first moments, by day
  for (const [fl, dv] of DAY_OF) if (!flagWas.has(fl) && F(fl)) { flagWas.add(fl); setV(dv, day()); pulse(); }
  // the night of the claw: hits counted from the moment the gate goes down
  const inRaid = F('raid:started') && !F('raid:won') && !F('raid:lost');
  if (inRaid) {
    const tries = V('raid:tries');
    if (V('fs:raidTry') !== tries) { setV('fs:raidTry', tries); setV('fs:raidHits0', V('fs:hits')); setV('fs:raidClean', 1); }
    else if (V('fs:hits') > V('fs:raidHits0')) setV('fs:raidClean', 0);
  }
  if (++n % 4 === 0 || dirty) { dirty = false; checkAll(); }
}

// ---------------------------------------------------------------- dev

/** the developer panel: earn every feat (quietly, or with every notice) */
export function grantAllFeats(loud = false) {
  for (const f of FEATS) earn(f, !loud);
  game.persist();
}
/** the developer panel: forget every feat (and, with counters, every feat counter) */
export function resetFeats(counters = false) {
  const s = game.save;
  for (const k of Object.keys(s.flags)) if (k.startsWith('feat:')) delete s.flags[k];
  for (const k of Object.keys(s.vars)) if (k.startsWith('fs:at:') || k.startsWith('fs:seen:') || (counters && k.startsWith('fs:') && k !== 'fs:v')) delete s.vars[k];
  game.persist();
}
