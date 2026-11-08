// V12 the night of the claw: the fight. Matikuku Nui comes through the gateway at the east end of Te
// Kāinga and works west along Te Huarahi, the market lane, for the goats. Every barricade stops it
// until it has smashed it down (three blows: sound, cracked, smashed). Get close and it swipes; stand
// in its path and it charges. It must not reach the goats.
//
// How it ends (no hit points anywhere: src/game/v11/predators-core.ts):
//   asleep  enough tranquilliser darts and it slumps in the lane (the best ending: photograph it)
//   fled    its nerve breaks (flares, bangers, spray, the sling, Aroha) and it runs back out the gate
//   lost    it reaches the goats, takes one and goes; the barricades can be lashed again for another night
//
// Its tells (the reads the player learns):
//   swipe   it rises on its hind legs, the claw lifts and glints: back off or jump clear
//   charge  it drops low, paws twice and huffs: get out of its line (behind a barricade, a hide, a jump)
//   smash   it rears at a barricade and brings the claw down: a moment when it is wide open
// The creature itself (art, body, mind) is src/game/v12/feud; this file only scripts it, through the
// small adapter in ./bearer.ts.

import type { FieldScene } from '../../scenes/field';
import { Custom } from '../../../world/props';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { clamp, rand } from '../../../core/math';
import { X } from '../../v11/village/layout';
import { villageGround } from '../../v11/village/scene';
import { villageCtx } from '../../v11/village/scene';
import { bark } from '../../v11/village/ctx';
import { cineBars, cineShake, cineSlowmo } from '../../v11/cine';
import { sfx11 } from '../../v11/predators-sfx';
import { hitMori, moriHidden } from '../wilds';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { ResolveTag } from './hud';
import { setBarricade } from './prep';
import type { Barricade } from './prep';
import { makeBearer } from './bearer';
import type { BearerCtl } from './bearer';
import { F, setF, V, setV } from './quest';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

type Phase = 'intro' | 'advance' | 'barricade' | 'swipe' | 'charge' | 'recover' | 'goat' | 'asleep' | 'fled' | 'done';

/** what each blow does to a barricade: state after hits 1, 2, 3 */
const BAR_AFTER: (0 | 1 | 2)[] = [0, 1, 2];

export interface Raid {
  f: FieldScene;
  bear: BearerCtl;
  bars: Barricade[];
  tag: ResolveTag;
  phase: Phase;
  t: number;
  /** cooldowns (s) */
  swipeCd: number;
  chargeCd: number;
  roarCd: number;
  barkCd: number;
  /** blows landed on the barricade it is at */
  blows: number;
  knocks: number;
  busy: boolean;
}
let cur: Raid | null = null;
export const raidNow = () => cur;

/** the next standing barricade west of x (or null) */
function nextBar(r: Raid, x: number): Barricade | null {
  let best: Barricade | null = null;
  for (const b of r.bars) if (b.state >= 0 && b.state < 2 && b.x < x + 4 && (!best || b.x > best.x)) best = b;
  return best;
}
const goatLine = () => X.goats[1] + 30;

// ---------------------------------------------------------------- the defenders' voices
const BARKS = {
  arrive: [['koro', 'Haere atu! Back to your hills!'], ['rawiri', 'It’s at the gate! Torches!'], ['tamati', 'Get the kids in the wharenui!']],
  smash: [['manu', 'It’s tearing the stakes out like weeds!'], ['rawiri', 'Hold, hold!'], ['hemi', 'That was MY door!'], ['tamati', 'Two more! It has to get through two more!']],
  hit: [['rawiri', 'Ka pai, Mori!'], ['tamati', 'It felt that one!'], ['manu', 'Again! Again!']],
  close: [['koro', 'Not so close, boy! The claw!'], ['huia', 'Mori! Get back from it!']],
  goats: [['ani', 'It’s going for Pōtiki!'], ['rawiri', 'The goats! Stop it!']],
};
function say(r: Raid, k: keyof typeof BARKS) {
  if (r.barkCd > 0) return;
  r.barkCd = 3.2;
  const [who, text] = rand.pick(BARKS[k]);
  bark(who, text, { expr: k === 'hit' ? 'excited' : 'scared' });
}

// ---------------------------------------------------------------- start
export async function startRaid(f: FieldScene, bars: Barricade[]) {
  if (cur || F('raid:started') && !F('raid:lost')) return;
  delete game.save.flags['raid:lost'];
  setF('raid:started');
  setV('raid:tries', V('raid:tries') + 1);
  const c = villageCtx();
  if (c) c.hold = true;
  // the roar first, from out in the dark past the gate
  audio.play('wrong', { vol: 0 });
  sfx11('tigerRoar', { x: X.gate + 240, vol: 0.9, pitch: 0.62 });
  cineShake(4, 0.8);
  await sleep(900);
  bark('koro', 'E tū! Everyone up! It’s here!', { expr: 'shocked' });
  const bear = await makeBearer(f, X.gate + 230);
  if (!bear) { floatNotice('(The Bearer could not be found tonight.)', 2400); return; }
  const r: Raid = { f, bear, bars, tag: new ResolveTag(), phase: 'intro', t: 0, swipeCd: 2, chargeCd: 6, roarCd: 8, barkCd: 0, blows: 0, knocks: 0, busy: false };
  cur = r;
  f.main.add(new Custom(98, () => {}, (dt: number) => tick(r, dt)));
  // the entrance: through the gateway, a stop, a roar
  cineBars(true);
  f.cutscene = true;
  await bear.moveTo(X.gate - 40, 70);
  await bear.act('roar');
  cineShake(6, 0.6);
  say(r, 'arrive');
  cineBars(false);
  f.cutscene = false;
  if (V('raid:tries') <= 1) floatNotice('Keep it from the goats. Darts put it to sleep; flares, bangers, spray and stones break its nerve. Watch the claw.', 5200, { tag: 'THE NIGHT OF THE CLAW', accent: '#ffd27a' });
  r.phase = 'advance';
  const exit = f.exit.bind(f);
  f.exit = () => { end(r); exit(); };
}

function end(r: Raid) {
  if (cur !== r) return;
  cur = null;
  r.tag.hide();
  const c = villageCtx();
  if (c) c.hold = false;
}

// ---------------------------------------------------------------- the director, every frame
function tick(r: Raid, dt: number) {
  if (cur !== r) return;
  r.t += dt;
  r.swipeCd -= dt; r.chargeCd -= dt; r.roarCd -= dt; r.barkCd -= dt;
  const b = r.bear, f = r.f, p = f.player;
  r.tag.set(b.nerve());
  r.tag.update(dt);
  if (r.phase === 'done' || r.phase === 'intro') return;
  // the endings come from its body (darts, broken nerve)
  if (b.asleep() && r.phase !== 'asleep') { void asleep(r); return; }
  if (b.nerve() <= 0.001 && r.phase !== 'fled' && r.phase !== 'asleep') { void fled(r); return; }
  if (r.busy || b.stunned()) return;
  const dx = p.x - b.x, adx = Math.abs(dx);
  const ahead = Math.sign(dx) === b.facing || adx < 20;
  const bar = nextBar(r, b.x);
  // at the goats: lost
  if (b.x <= goatLine()) { void lost(r); return; }
  // Mori within reach of the claw: swipe
  if (adx < 96 && r.swipeCd <= 0 && !moriHidden(f)) { void swipe(r); return; }
  // Mori standing in its path on open ground (no barricade between them): charge
  const barBetween = bar && ((p.x < bar.x && bar.x < b.x) || (p.x > bar.x && bar.x > b.x));
  if (ahead && adx > 120 && adx < 300 && !barBetween && r.chargeCd <= 0 && !moriHidden(f)) { void charge(r); return; }
  // at a barricade: smash it down
  if (bar && b.x - bar.x < 52) { void smash(r, bar); return; }
  // otherwise on toward the goats, with a roar now and then
  if (r.roarCd <= 0) { r.roarCd = 9 + rand.next() * 6; void roar(r); return; }
  if (b.x < X.goats[1] + 260) say(r, 'goats');
  else if (adx < 140) say(r, 'close');
  r.busy = true;
  const to = bar ? bar.x + 46 : goatLine() - 10;
  void b.moveTo(Math.max(to, b.x - 70), 38).finally(() => { r.busy = false; });
}

async function swipe(r: Raid) {
  const b = r.bear, f = r.f;
  r.busy = true; r.phase = 'swipe'; r.swipeCd = 2.4;
  b.faceTo(f.player.x);
  // the tell: up on its hind legs, the claw lifts and glints
  sfx11('tigerGrowl', { x: b.x, vol: 0.7, pitch: 0.6 });
  void floatText({ text: 'HRRRMMM...', style: 'shout', ms: 900, x: b.x, y: b.y - 150 });
  await b.act('threat', 0.75);
  if (cur !== r || b.stunned()) { r.busy = false; r.phase = 'advance'; return; }
  await b.act('swipe', 0.5);
  // the blow: in front, within reach, not jumping high over it, not hidden
  const p = f.player, dx = (p.x - b.x) * b.facing;
  const high = p.y < villageGround(p.x) - 36;
  if (dx > -12 && dx < 104 && !high && !moriHidden(f)) {
    hitMori(f, b.x, { sev: 2, drop: r.knocks % 2 === 1, what: 'the claw' });
    r.knocks++;
  }
  cineShake(3, 0.25);
  r.busy = false; r.phase = 'advance';
}

async function charge(r: Raid) {
  const b = r.bear, f = r.f;
  r.busy = true; r.phase = 'charge'; r.chargeCd = 9 + rand.next() * 4;
  b.faceTo(f.player.x);
  // the tell: it drops low, paws twice and huffs
  sfx11('chuff', { x: b.x, vol: 0.8, pitch: 0.5 });
  void floatText({ text: 'HUFF! HUFF!', style: 'shout', ms: 1000, x: b.x, y: b.y - 120 });
  await b.act('charge', 1.0);
  if (cur !== r || b.stunned()) { r.busy = false; r.phase = 'advance'; return; }
  // the run: a fixed line, it stops at a standing barricade
  const dir = b.facing, x0 = b.x;
  const bar = nextBar(r, b.x);
  let x1 = x0 + dir * 230;
  if (bar && dir < 0) x1 = Math.max(x1, bar.x + 40);
  x1 = Math.min(x1, X.gate + 40);
  const p = f.player;
  let hit = false;
  const watch = setInterval(() => {
    if (hit || cur !== r) return;
    const d = Math.abs(p.x - b.x), high = p.y < villageGround(p.x) - 30;
    if (d < 60 && !high && !moriHidden(f)) { hit = true; hitMori(f, b.x, { sev: 3, drop: true, what: 'the charge' }); r.knocks++; }
  }, 40);
  await b.moveTo(x1, 210);
  clearInterval(watch);
  sfx11('thud', { x: b.x, vol: 0.8 });
  cineShake(5, 0.4);
  // spent: wide open for a moment
  r.phase = 'recover';
  await b.act('idle', 1.4);
  r.busy = false; r.phase = 'advance';
}

async function smash(r: Raid, bar: Barricade) {
  const b = r.bear;
  r.busy = true; r.phase = 'barricade';
  b.faceTo(bar.x);
  await b.act('smash', 1.2);
  if (cur !== r) return;
  if (!b.stunned()) {
    r.blows++;
    const s = BAR_AFTER[Math.min(2, r.blows - 1)];
    sfx11('crack', { x: bar.x, vol: 0.9, pitch: 0.8 + rand.next() * 0.3 });
    sfx11('thud', { x: bar.x, vol: 0.7 });
    cineShake(4 + r.blows, 0.35);
    if (r.blows >= 2) setBarricade(r.f, bar, s);
    if (r.blows >= 3) { setBarricade(r.f, bar, 2); r.blows = 0; say(r, 'smash'); }
  }
  r.busy = false; r.phase = 'advance';
}

async function roar(r: Raid) {
  const b = r.bear;
  r.busy = true;
  b.faceTo(r.f.player.x);
  sfx11('tigerRoar', { x: b.x, vol: 0.85, pitch: 0.58 + rand.next() * 0.08 });
  cineShake(5, 0.6);
  await b.act('roar', 1.3);
  r.busy = false;
}

// ---------------------------------------------------------------- the endings
async function asleep(r: Raid) {
  r.phase = 'asleep';
  const f = r.f;
  setF('raid:won'); setF('raid:asleep');
  cineSlowmo(0.35, 1.2);
  await r.bear.act('sleep');
  r.tag.set(0);
  await sleep(900);
  r.phase = 'done';
  end(r);
  bark('koro', 'Kaua e patu. Don’t touch it. Let it sleep.', { expr: 'serious' });
  await sleep(2600);
  bark('rawiri', 'Mori... you put the great claw to SLEEP!', { expr: 'excited' });
  await sleep(2200);
  floatNotice('It sleeps in the lane. Get close, quietly, and photograph it.', 3600, { tag: 'THE NIGHT OF THE CLAW', accent: '#bff59a' });
  watchPhoto(f);
}

async function fled(r: Raid) {
  r.phase = 'fled';
  setF('raid:won'); setF('raid:fled');
  r.tag.set(0);
  sfx11('tigerGrowl', { x: r.bear.x, vol: 0.6, pitch: 0.75 });
  bark('tamati', 'It’s running! It’s RUNNING!', { expr: 'excited' });
  r.bear.faceTo(X.gate + 400);
  await r.bear.act('retreat', 0.6);
  await r.bear.moveTo(X.gate + 360, 150);
  r.bear.remove();
  r.phase = 'done';
  end(r);
  await sleep(1200);
  bark('koro', 'It will not come back through that gate in a hurry. Come, sit by the fire.', { expr: 'happy' });
}

async function lost(r: Raid) {
  r.phase = 'goat';
  const f = r.f;
  setF('raid:lost');
  delete game.save.flags['raid:started'];
  bark('ani', 'NO! Not Pōtiki!', { expr: 'cry' });
  await r.bear.act('pin', 1.0);
  // it takes the nearest goat with it
  const live = villageCtx()?.live;
  if (live) { const i = live.list.findIndex(g => g.kind === 'goat'); if (i >= 0) live.list.splice(i, 1); }
  await r.bear.moveTo(X.gate + 360, 120);
  r.bear.remove();
  r.phase = 'done';
  end(r);
  // the barricades are down: they must be lashed again
  setV('raid:built', 0);
  await sleep(1500);
  bark('koro', 'It took one. It will be back for the rest. Lash the stakes again; tomorrow night we are ready.', { expr: 'sad' });
  void f;
}

/** the photograph of the sleeping Bearer completes the step */
function watchPhoto(f: FieldScene) {
  const cam = f.cam;
  if (!cam) return;
  const prev = cam.onShot;
  cam.onShot = p => {
    prev?.(p);
    if (!F('raid:photo') && p.subjects.some(s => s.species === 'bearer' && s.visible > 0.35 && s.size > 0.12)) {
      setF('raid:photo');
      floatNotice('Matikuku Nui, asleep in Te Kāinga. Nobody will believe it.', 3000, { tag: 'PHOTO', accent: '#bff59a' });
      setTimeout(() => bark('koro', 'Now come. Sit with me by the fire.', { expr: 'happy' }), 2400);
    }
  };
}

/** after the raid, at the fire with Koro */
export async function fireTalk(f: FieldScene) {
  f.cutscene = true;
  const lines: [string, string, string][] = F('raid:asleep')
    ? [['koro', 'You could have killed it tonight. Hank would have sold you the gun for it.', 'serious'], ['mori', 'It was here first. Like you said.', 'neutral'], ['koro', 'Ae. It was here first. And tomorrow it will wake in its own hills with a sore head, and remember the smell of this gate.', 'happy'], ['koro', 'Our gate has two keepers now. Hinerua in the carving... and you.', 'happy']]
    : [['koro', 'It ran. Good. A running thing remembers where it was hurt.', 'serious'], ['mori', 'Will it come back?', 'worried'], ['koro', 'Not through that gate. Not while you are here.', 'happy'], ['koro', 'Our gate has two keepers now. Hinerua in the carving... and you.', 'happy']];
  for (const [who, text, expr] of lines) { bark(who, text, { expr }); await sleep(Math.max(2400, text.length * 55)); }
  setF('raid:report');
  f.cutscene = false;
}

/** dev / console: the raid controller */
export const RAID_ZL = { now: () => cur, phase: () => cur?.phase ?? null, nerve: () => cur?.bear.nerve() ?? null, clamp };
