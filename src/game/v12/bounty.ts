// V12 the field office's daily bounty: every morning one hard photograph is pinned to the camp
// request board (the "Field office" column, src/ui/v10/campboard.ts) and read out over Jenna's radio.
// It keeps the late game fresh: a species Mori has already documented (so it can be done), doing one of
// its behaviours he has seen it do, at one time of day, sometimes with a twist:
//
//   "at 3 stars"            the shot has to be really good
//   "within N minutes"      fast: within N minutes of arriving wherever he takes it
//   "from a hide"           Mori unseen when the shutter goes (in a hide, under the cloak, low in cover)
//
// The shot is judged the moment the shutter fires (every field scene's camera is chained), pays its
// bonus RP at once and grows the streak. A bounty left unfinished expires at the next morning and the
// streak goes back to nought.
//
// Save: bucket 'bounty' (the current spec), vars 'bounty:streak', 'bounty:total' (and 'bounty:best').
// The quest on the board is 'b_bounty', reset every morning.
//
// This module is imported at boot (initFieldContent), so everything it needs loads lazily: nothing
// here touches another module until after boot.

import type { FieldScene } from '../scenes/field';
import type { RawPhoto, PhotoSubject } from '../photos';
import type { QuestDef } from '../quests';
import type { Req } from '../v10/campquests';
import type { TimeOfDay } from '../../world/timeofday';

type Mods = {
  G: typeof import('../game');
  Q: typeof import('../quests');
  CQ: typeof import('../v10/campquests');
  D: typeof import('../v10/day');
  SP: typeof import('../species');
  PH: typeof import('../photos');
  FL: typeof import('../../ui/v12/float');
  ST: typeof import('../v10/store');
  W: typeof import('./wilds');
  F10: typeof import('../v10/field10');
};
let M: Mods | null = null;

export type BountyMod = 'none' | 'stars' | 'quick' | 'hide';
export interface Bounty {
  day: number;
  species: string;
  /** the behaviour wanted (null: any) */
  beh: string | null;
  time: TimeOfDay;
  mod: BountyMod;
  /** 'quick': minutes after arriving */
  mins: number;
  rp: number;
  /** the day it was met (0: not yet) */
  done: number;
  /** the day the radio read it out */
  told: number;
}
interface BState { cur: Bounty | null; log: { day: number; species: string; ok: boolean }[] }

export const BOUNTY_ID = 'b_bounty';
const TIME_WORD: Record<TimeOfDay, string> = { dawn: 'at dawn', day: 'in full daylight', dusk: 'at dusk', night: 'after dark' };

// ------------------------------------------------------------------ state
const S = (): BState => M!.ST.bucket<BState>('bounty', () => ({ cur: null, log: [] }));
const save = () => M!.G.game.save;
const V = (k: string) => save().vars[k] ?? 0;
const setV = (k: string, n: number) => { save().vars[k] = n; M!.G.game.persist(); };
const spName = (id: string) => M!.SP.SPECIES_BY_ID[id]?.name ?? id;
const behWord = (b: Bounty) => (b.beh ? (M!.SP.SPECIES_BY_ID[b.species]?.behaviors[b.beh] ?? b.beh).toLowerCase() : '');

/** the bounty posted today (null: none, or not unlocked yet) */
export function currentBounty(): Bounty | null {
  if (!M) return null;
  const b = S().cur;
  return b && b.day === M.D.dayNumber() ? b : null;
}
export const bountyStreak = () => (M ? V('bounty:streak') : 0);

/** the spec in words: "Tui, calling, at dusk, from a hide" */
export function bountyText(b: Bounty): string {
  const parts = [spName(b.species)];
  if (b.beh) parts.push(behWord(b));
  parts.push(TIME_WORD[b.time]);
  if (b.mod === 'stars') parts.push('3 stars or better');
  if (b.mod === 'quick') parts.push(`within ${b.mins} minutes of getting there`);
  if (b.mod === 'hide') parts.push('from a hide, unseen');
  return parts.join(', ');
}

const unlocked = () => {
  const s = save();
  return M!.D.loopStarted() && !!s.flags['v10:agency'] && Object.keys(s.research ?? {}).length >= 3;
};

// ------------------------------------------------------------------ rolling one
function roll(day: number): Bounty | null {
  const s = save(), SP = M!.SP.SPECIES_BY_ID;
  const known = Object.keys(s.research ?? {}).filter(id => SP[id] && SP[id].times?.length);
  if (!known.length) return null;
  const recent = new Set(S().log.slice(-3).map(l => l.species));
  const pool = known.filter(id => !recent.has(id));
  const pickFrom = pool.length ? pool : known;
  // rarer animals come up a little more often (they are the ones worth a bounty)
  const w = pickFrom.map(id => 1 + (SP[id].rarity ?? 1) * 0.6);
  let k = Math.random() * w.reduce((a, x) => a + x, 0), i = 0;
  for (; i < pickFrom.length - 1; i++) { k -= w[i]; if (k <= 0) break; }
  const sp = SP[pickFrom[i]];
  const time = sp.times[Math.floor(Math.random() * sp.times.length)];
  // a behaviour he has already caught it doing (so it is doable), most of the time
  const e = s.research[sp.id];
  const seen = [...new Set([...(e?.beh ?? []), ...(e?.vid ?? [])])].filter(b => sp.behaviors[b]);
  const beh = seen.length && Math.random() < 0.8 ? seen[Math.floor(Math.random() * seen.length)] : null;
  const r = Math.random();
  const mod: BountyMod = r < 0.34 ? 'none' : r < 0.6 ? 'stars' : r < 0.8 ? 'quick' : 'hide';
  const mins = 4 + Math.floor(Math.random() * 5);
  const streak = Math.min(5, V('bounty:streak'));
  const rp = Math.round(30 + (sp.rarity ?? 1) * 10 + (beh ? 15 : 0) + (mod !== 'none' ? 20 : 0) + streak * 6);
  return { day, species: sp.id, beh, time, mod, mins, rp, done: 0, told: 0 };
}

/** expire yesterday's (the streak breaks if it wasn't met) and post today's; idempotent */
export function ensureBounty(): Bounty | null {
  if (!M) return null;
  const st = S(), day = M.D.dayNumber();
  const cur = st.cur;
  let changed = false;
  if (cur && cur.day < day) {
    st.log.push({ day: cur.day, species: cur.species, ok: cur.done > 0 });
    if (st.log.length > 30) st.log.splice(0, st.log.length - 30);
    if (!cur.done && V('bounty:streak') > 0) {
      setV('bounty:streak', 0);
      setTimeout(() => M?.FL.floatNotice('Yesterday’s bounty ran out. Streak back to nought.', 3000, { tag: 'BOUNTY', accent: '#ff9a7a' }), 4000);
    }
    st.cur = null;
    changed = true;
  }
  if (!st.cur && unlocked()) {
    st.cur = roll(day);
    // a fresh note on the board: hidden again, not seen yet
    delete save().quests[BOUNTY_ID];
    const board = M.ST.bucket<{ seen: string[] }>('board', () => ({ seen: [] }));
    board.seen = board.seen.filter(id => id !== BOUNTY_ID);
    changed = true;
  }
  if (changed) M.G.game.persist();
  return currentBounty();
}

// ------------------------------------------------------------------ the board note and the quest
function makeReq(): Req {
  const b = () => currentBounty();
  return {
    id: BOUNTY_ID, giver: 'agency',
    get title() { const x = b(); return x ? `Bounty: ${spName(x.species)}` : 'Bounty'; },
    get desc() {
      const x = b();
      if (!x) return 'The field office posts a bounty every morning.';
      const streak = V('bounty:streak');
      return `Today’s bounty from the field office: ${bountyText(x)}. Pays ${x.rp} RP the moment the shutter goes.${streak ? ` Streak: ${streak} day${streak === 1 ? '' : 's'}.` : ''} It runs out tomorrow morning.`;
    },
    unlock: () => !!b(),
    steps: [{
      get text() { const x = b(); return x ? `Photograph: ${bountyText(x)}` : 'Photograph the bounty'; },
      done: () => { const x = b(); return !!x && x.done === x.day; },
      get hint() {
        const x = b();
        if (!x) return '';
        const bits = [`${spName(x.species)} ${TIME_WORD[x.time]}.`];
        if (x.mod === 'hide') bits.push('Get into a hide, under the cloak, or low and still in cover before you shoot.');
        if (x.mod === 'quick') bits.push(`The clock starts when you arrive somewhere: ${x.mins} minutes.`);
        if (x.mod === 'stars') bits.push('Sharp, close, facing you, well framed.');
        else bits.push('Two stars or better.');
        return bits.join(' ');
      },
    }],
    reward: { get text() { const x = b(); return x ? `Bounty paid: ${x.rp} RP.` : 'Bounty paid.'; } } as Req['reward'],
    ask: 'Field office, daily bounty. One photograph, today only. Details on the board.',
    thanks: 'Bounty verified and paid. The board here have started a sweepstake on you.',
  };
}
// ------------------------------------------------------------------ judging shots
const hooked = new WeakSet<FieldScene>();
const arrived = new WeakMap<FieldScene, number>();
let lastNear = 0;
function near(text: string) {
  const t = performance.now();
  if (t - lastNear < 9000) return;
  lastNear = t;
  void M?.FL.floatText({ text, style: 'think', ms: 2600 });
}
function hookScene(f: FieldScene) {
  if (hooked.has(f)) return;
  hooked.add(f);
  arrived.set(f, performance.now());
  const go = (n = 0) => {
    if (!f.cam) { if (n < 40) setTimeout(() => go(n + 1), 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); try { judge(f, ph); } catch (e) { console.warn('[bounty] shot', e); } };
  };
  go();
}
function judge(f: FieldScene, ph: RawPhoto) {
  const b = currentBounty();
  if (!b || b.done) return;
  const subs = ph.subjects.filter((s: PhotoSubject) => s.species === b.species);
  if (!subs.length) return;
  const need = b.mod === 'stars' ? 3 : 2;
  let why = '';
  for (const s of subs) {
    const j = M!.PH.judgeSubject(s, ph);
    if (!j.identified) { why = 'Not sharp enough for the office.'; continue; }
    if (b.beh && s.behavior !== b.beh) { why = `They want it ${behWord(b)}. Not this.`; continue; }
    if (ph.time !== b.time) { why = `Right animal. Wrong time: they want it ${TIME_WORD[b.time]}.`; continue; }
    if (j.stars < need) { why = `${j.stars} star${j.stars === 1 ? '' : 's'}. The bounty wants ${need}.`; continue; }
    if (b.mod === 'quick' && (performance.now() - (arrived.get(f) ?? 0)) / 60000 > b.mins) { why = `Too slow. That had to be inside ${b.mins} minutes of getting here.`; continue; }
    if (b.mod === 'hide' && !M!.W.moriHidden(f)) { why = 'It could see me. The bounty wants it from a hide.'; continue; }
    pay(b);
    return;
  }
  if (why) near(why);
}
function pay(b: Bounty) {
  const s = save();
  b.done = b.day;
  s.rp += b.rp;
  s.totalRp += b.rp;
  const streak = V('bounty:streak') + 1;
  setV('bounty:streak', streak);
  setV('bounty:total', V('bounty:total') + 1);
  if (streak > V('bounty:best')) setV('bounty:best', streak);
  // the note on the board ticks itself off (taken on or not)
  const Q = M!.Q;
  if (Q.questStatus(BOUNTY_ID) === 'hidden') Q.startQuest(BOUNTY_ID, true);
  M!.G.game.persist();
  M!.FL.floatNotice(`Bounty met: ${spName(b.species)} +${b.rp} RP${streak > 1 ? ` (streak ${streak})` : ''}`, 3400, { tag: 'BOUNTY', accent: '#ffd05a' });
  const lines = ['THAT’S the one. That’s the bounty. Somebody pay this man.', 'Got it! The field office owes me a coffee. And a sandwich.', 'Bounty shot. On the card. I could kiss this camera.', 'Yes! Yes yes yes. Stay. Still. ...And I’m done. Thank you, beautiful.'];
  setTimeout(() => void M?.FL.floatText({ text: lines[Math.floor(Math.random() * lines.length)], style: 'happy', ms: 2800 }), 700);
}

// ------------------------------------------------------------------ the radio in the morning
async function announce() {
  const b = currentBounty();
  if (!b || b.told === b.day) return;
  b.told = b.day;
  M!.G.game.persist();
  const st = V('bounty:streak');
  const open = ['Morning, Mori. Field office bounty for today', 'Bounty’s in. The office wants', 'Rise and shine, photographer. Today’s bounty'];
  const text = `*kssht* ${open[Math.floor(Math.random() * open.length)]}: ${bountyText(b)}. ${b.rp} RP.${st >= 2 ? ` That’s ${st} days running, don’t you dare break it.` : ''} Over.`;
  try { (await import('../../core/audio')).audio.play('scanBeep' as never, { vol: 0.4 }); } catch { /* */ }
  await M!.FL.floatText({ text, style: 'radio', name: 'Jenna · radio', color: '#d04890', ms: 4200 });
}

// ------------------------------------------------------------------ install
let installed: Promise<void> | null = null;
/** load what the bounty needs, pin it to the board, watch every field scene's camera, roll each morning */
export function installBounties(): Promise<void> {
  if (installed) return installed;
  installed = (async () => {
    const [G, Q, CQ, D, SP, PH, FL, ST, W, F10] = await Promise.all([
      import('../game'), import('../quests'), import('../v10/campquests'), import('../v10/day'), import('../species'),
      import('../photos'), import('../../ui/v12/float'), import('../v10/store'), import('./wilds'), import('../v10/field10'),
    ]);
    M = { G, Q, CQ, D, SP, PH, FL, ST, W, F10 };
    const req = makeReq();
    if (!CQ.REQ_BY_ID[BOUNTY_ID]) { CQ.REQUESTS.push(req); CQ.REQ_BY_ID[BOUNTY_ID] = req; }
    if (!Q.QUEST_BY_ID[BOUNTY_ID]) {
      const q: QuestDef = {
        id: BOUNTY_ID, giver: 'story', main: false, steps: req.steps,
        get title() { return req.title; },
        get desc() { return req.desc; },
        get reward() { return { text: req.reward.text }; },
      } as QuestDef;
      Q.QUESTS.push(q);
      Q.QUEST_BY_ID[BOUNTY_ID] = q;
    }
    D.onNewDay(() => { try { ensureBounty(); } catch (e) { console.warn('[bounty] new day', e); } });
    D.addCampEvent({ id: 'bounty:radio', slot: 'morning', prio: 1, once: false, when: () => { const b = ensureBounty(); return !!b && b.told !== b.day; }, run: () => announce() });
    F10.onLocEnter(f => {
      hookScene(f);
      ensureBounty();
      // the radio reads it out a little after Mori wakes (if the camp's own events didn't)
      const b = currentBounty();
      if (b && b.told !== b.day) setTimeout(() => { if (M!.G.game.scene === (f as never) && !f.cutscene) void announce(); }, 9000);
    });
    ensureBounty();
  })().catch(e => { console.warn('[bounty] install', e); });
  return installed;
}

// ------------------------------------------------------------------ boot: the whole content pack
/**
 * Install the field content: the daily bounty (this file), five field events (./fieldevents.ts) and
 * fourteen side quests (./sidequests2.ts). Safe to call at boot: everything loads after it, lazily.
 */
export function initFieldContent(): void {
  setTimeout(() => {
    void installBounties();
    void import('./fieldevents').then(m => m.registerFieldEvents()).catch(e => console.warn('[fieldevents] install', e));
    void import('./sidequests2').then(m => m.registerSideQuests2()).catch(e => console.warn('[sidequests2] install', e));
  }, 0);
}
