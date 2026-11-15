// V12 Te Moana Rimurimu: the dive's air tank (bpdata 'air_tank', the 'scuba' gate), Mori's breath on it,
// and the catch going home.
//
//   startAir(f)       the scene calls it on enter: a full tank, six shafts in the speargun, the breathing
//                     and the bubbles start, the swim's stamina drain eases off
//   airLeft()         the tank's fill 0..1 (1 when not diving): the field watch's air ring reads it
//   airDepth()        metres under, now (the watch's dive face)
//   stopAir()         on leave
//   bankCatches(f?)   the dive's catch (DIVE_CTX.catches) into the pack; what doesn't fit goes back
//   diveWear(p, dt)   (src/world/player.ts, every frame) the diver's outfit while he's in the water with
//                     the gear: the wetsuit alone, or the full kit (tank, mask, fins) and its swim clip
//
// The tank: about four minutes in the shallows, less the deeper he goes (it breathes denser air down
// there), less again when he kicks hard (Shift) or a shark is winding up nearby. It refills fast at the
// boat's ladder (DIVE_CTX.ladder) or with his head at the surface. Every breath is the regulator's hiss
// in, the exhaust's burble out and a puff of bubbles from beside his mask that wobble up and pop at the
// surface. Low air: the watch beeps, the breathing quickens and a line floats by him (30%, 15%, 6%). At
// nothing: an emergency ascent, a short cine (bars, the camera in on him, a hard kick to the ladder): he
// is never killed, but about half of the catch slips out of the bag on the way up.

import type { FieldScene } from '../../scenes/field';
import type { Player } from '../../../world/player';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { Custom } from '../../../world/props';
import { PixelBuffer } from '../../../art/pixel';
import { hex } from '../../../art/color';
import { itemIcon } from '../../../art/itemicons';
import { game } from '../../game';
import { local } from '../../assets';
import { audio } from '../../../core/audio';
import { clamp, rand } from '../../../core/math';
import { floatText } from '../../../ui/v12/float';
import { cineBars, cineTo, cineRelease } from '../../v11/cine';
import { add, fits } from '../../inventory';
import { ITEMS } from '../../items';
import { gateOk } from '../gear';
import { isActive } from '../../v11/blueprints';
import { setSwimDrain } from '../stamina';
import { sfxArm } from '../arsenal-sfx';
import { setAmmo, ammoMax } from '../arsenal';
import { WATCH_DIVE } from '../../../ui/v12/watch';
import { DIVE_CTX, diving } from './ctx';
// (the diver's swim clip and the speargun in his hands)
import '../../../art/v12/arms7';

/** seconds a full tank lasts in the shallows, finning along */
const AIR_SECS = 235;
/** seconds to fill it from empty at the ladder / the surface */
const FILL_SECS = 5;

interface Bub { x: number; y: number; vx: number; vy: number; s: number; t: number; ph: number }
interface Drop { id: string; x: number; y: number; vx: number; vy: number; t: number }
interface Asc { x0: number; y0: number; t: number; dur: number; res: () => void }
const S = {
  f: null as FieldScene | null,
  view: null as Custom | null,
  air: 1,
  depth: 0,
  t: 0,
  /** time into the current half of the breath, and which half */
  breath: 0,
  inhale: true,
  /** low-air lines said this time down (1: 30%, 2: 15%, 3: 6%) */
  warned: 0,
  alarmT: 0,
  ascent: null as Asc | null,
  busy: false,
  /** the lowest the tank got since it was last full (a big refill gets a word) */
  lowest: 1,
  bubbles: [] as Bub[],
  pops: [] as { x: number; y: number; t: number }[],
  drops: [] as Drop[],
};
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** start the tank for a dive (called by the scene on enter) */
export function startAir(f: FieldScene): void {
  stopAir();
  S.f = f;
  S.air = 1; S.t = 0; S.breath = 0; S.inhale = true; S.warned = 0; S.alarmT = 0; S.ascent = null; S.busy = false; S.lowest = 1;
  S.bubbles = []; S.pops = []; S.drops = [];
  // six shafts in the quiver, the gun cocked
  setAmmo('harpoon', ammoMax('harpoon'));
  setSwimDrain(0.3);
  S.view = new Custom(62, r => draw(r), dt => update(dt));
  f.main.add(S.view);
}
/** the tank's fill 0..1 (1 when not diving) */
export function airLeft(): number { return S.f && diving() ? S.air : 1; }
/** metres under the surface right now (0 when not diving) */
export function airDepth(): number { return S.f && diving() ? S.depth : 0; }
/** the emergency ascent is running */
export const ascending = () => !!S.ascent || S.busy;
/** stop on leave */
export function stopAir(): void {
  if (S.view && S.f) S.f.main.remove(S.view);
  S.view = null;
  S.f = null;
  S.air = 1;
  S.depth = 0;
  S.ascent = null;
  S.busy = false;
  setSwimDrain(1);
}
/** dev / tests: set the tank (0..1) */
export function setAir(v: number) { S.air = clamp(v); if (S.air > 0.5) S.warned = 0; }

// ---------------------------------------------------------------- the tick
function update(dt: number) {
  const f = S.f;
  if (!f || game.scene !== (f as never) || !(dt > 0)) return;
  const p = f.player;
  S.t += dt;
  S.depth = Math.max(0, DIVE_CTX.depthAt(p.y));
  const moving = Math.hypot(p.vx, p.vy) > 24;
  const fear = DIVE_CTX.chargers.some(c => c.threatening && Math.hypot(c.x - p.x, c.y - p.y) < 260);
  // ---- the emergency ascent: a hard kick to the ladder
  const a = S.ascent;
  if (a) {
    a.t += dt;
    const u = clamp(a.t / a.dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const lx = DIVE_CTX.ladder.x, ly = DIVE_CTX.ladder.y;
    // up first, then over to the ladder
    const x = a.x0 + (lx - a.x0) * e, y = a.y0 + (ly - a.y0) * Math.min(1, e * 1.35) - Math.sin(u * Math.PI) * 14;
    p.facing = lx >= a.x0 ? 1 : -1;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    if (rand.next() < dt * 14) puff(p, 1, 0.6);
    if (u >= 1) { S.ascent = null; a.res(); }
  } else {
    const ladder = Math.hypot(p.x - DIVE_CTX.ladder.x, p.y - DIVE_CTX.ladder.y) < 64;
    const surface = p.y <= DIVE_CTX.surfaceY + 26;
    if (ladder || surface) {
      // topping up: the boat's hose on the ladder (or his head out of the water)
      S.air = Math.min(1, S.air + dt / FILL_SECS);
      if (S.air >= 0.999) {
        if (S.lowest < 0.5) { void floatText({ text: 'Tank’s full again. Lovely, lovely air.', style: 'happy', ms: 2200 }); sfxArm('airAlarm', { vol: 0.5, pitch: 1.3 }); }
        S.lowest = 1;
      }
    } else if (!f.cutscene || S.busy) {
      const depthK = 1 + Math.max(0, S.depth - 4) / 18;
      const effort = p.running ? 1.9 : moving ? 1.06 : 0.86;
      S.air = Math.max(0, S.air - (dt / AIR_SECS) * depthK * effort * (fear ? 1.3 : 1));
    }
  }
  // while the tank holds air, finning along is easy work (the swim stamina drain stays modest)
  setSwimDrain(S.air > 0 ? 0.3 : 1);
  // ---- low air: the watch beeps, a line floats by him
  if (!S.ascent) {
    // (one line for the worst it has got to: a sudden drop doesn't stack them up)
    const lv = S.air <= 0 ? 4 : S.air < 0.06 ? 3 : S.air < 0.15 ? 2 : S.air < 0.3 ? 1 : 0;
    if (lv > S.warned) {
      S.warned = lv;
      if (lv === 1) { void floatText({ text: 'Air’s getting low. Back to the ladder soon.', style: 'think', ms: 3000 }); sfxArm('airAlarm', { vol: 0.7 }); }
      else if (lv === 2) void floatText({ text: 'Low air! The ladder. NOW.', style: 'scared', ms: 2600 });
      else if (lv === 3) void floatText({ text: 'Sucking the tank dry... come on, come on...', style: 'scared', ms: 2400 });
    }
    if (S.air > 0.5) S.warned = 0;
    S.lowest = Math.min(S.lowest, S.air);
    if (S.air < 0.15) {
      S.alarmT -= dt;
      if (S.alarmT <= 0) { S.alarmT = S.air < 0.06 ? 0.9 : 2.2; sfxArm('airAlarm', { vol: S.air < 0.06 ? 0.75 : 0.5 }); }
    }
    // nothing left: up he goes (after whatever little moment is playing)
    if (S.air <= 0 && !S.busy && !f.cutscene) void emergencyAscent(f);
  }
  // ---- the breath: in through the valve, out in a puff of bubbles; quicker when he works, when it's low, when he's scared
  const per = (p.running ? 1.9 : moving ? 3.2 : 4.1) * (S.air < 0.06 ? 0.45 : S.air < 0.15 ? 0.58 : S.air < 0.3 ? 0.8 : 1) * (fear ? 0.72 : 1);
  S.breath += dt;
  const tense = S.air < 0.3 || fear || p.running;
  if (S.inhale && S.breath > per * 0.42) {
    S.inhale = false; S.breath = 0;
    if (S.air > 0 || S.ascent) { sfxArm('regOut', { vol: tense ? 0.9 : 0.6, pitch: tense ? 1.08 : 1 }); puff(p, p.running ? 9 : 6, 1); }
  } else if (!S.inhale && S.breath > per * 0.58) {
    S.inhale = true; S.breath = 0;
    if (S.air > 0) sfxArm('regIn', { vol: tense ? 0.95 : 0.6, pitch: S.air < 0.15 ? 1.15 : tense ? 1.06 : 1 });
    else if (!S.ascent) sfxArm('regEmpty', { vol: 0.8 });
  }
  // ---- the bubbles: they wobble up, swell as they rise and pop at the surface
  const top = DIVE_CTX.surfaceY + 1;
  for (const b of S.bubbles) {
    b.t += dt;
    b.vy += (-(20 + b.s * 9) - b.vy) * Math.min(1, dt * 3);
    b.vx *= Math.max(0, 1 - dt * 2.2);
    b.x += (b.vx + Math.sin(b.t * (7 - b.s) + b.ph) * (5 + b.s * 2)) * dt;
    b.y += b.vy * dt;
    if (b.s < 3 && rand.next() < dt * 0.25) b.s++;
    if (b.y <= top) { b.t = -1; S.pops.push({ x: b.x, y: top, t: 0 }); }
  }
  S.bubbles = S.bubbles.filter(b => b.t >= 0 && b.t < 14);
  for (const q of S.pops) q.t += dt;
  S.pops = S.pops.filter(q => q.t < 0.35);
  // ---- the dropped catch: tumbling down through the water, gone into the gloom
  for (const d of S.drops) {
    d.t += dt;
    d.vy = Math.min(26, d.vy + 30 * dt);
    d.vx *= Math.max(0, 1 - dt);
    d.x += (d.vx + Math.sin(d.t * 3) * 6) * dt;
    d.y = Math.min(d.y + d.vy * dt, DIVE_CTX.floorAt(d.x) - 6);
  }
  S.drops = S.drops.filter(d => d.t < 4.5);
}

/** where the regulator's exhaust is: beside his mask, a little ahead */
function regAt(p: Player): [number, number] {
  const [hx, hy] = p.body.headTop();
  return [hx + p.facing * 5, hy + 9];
}
/** a puff of bubbles off the exhaust (k: how hard) */
function puff(p: Player, n: number, k: number) {
  const [x, y] = regAt(p);
  for (let i = 0; i < n; i++) {
    if (S.bubbles.length > 110) S.bubbles.shift();
    const big = rand.next() < 0.25 * k;
    S.bubbles.push({ x: x + rand.range(-2, 2), y: y + rand.range(-2, 2), vx: p.facing * rand.range(-6, 18) + rand.range(-8, 8), vy: rand.range(-30, -8), s: big ? 2 : rand.next() < 0.5 ? 1 : 0, t: rand.range(0, 0.2), ph: rand.next() * 6 });
  }
}

// ---------------------------------------------------------------- out of air
async function emergencyAscent(f: FieldScene) {
  if (S.busy) return;
  S.busy = true;
  const p = f.player;
  const wasCut = f.cutscene;
  f.cutscene = true;
  p.vx = 0; p.vy = 0;
  cineBars(true);
  sfxArm('regEmpty', { vol: 1 });
  p.body.setExpr('scared', 3);
  void floatText({ text: 'Nothing... NO AIR! Up, up, UP!', style: 'scared', ms: 1700 });
  try {
    await cineTo(f.st, { x: p.x, y: p.y - 26, zoom: 1.75, secs: 0.45, ease: 'punch' });
    await sleep(450);
    if (game.scene !== (f as never)) return;
    // the catch bag's drawstring gives: about half of it slips out
    const lost = dropCatch(p);
    await cineRelease(f.st, 0.35);
    // a hard kick for the ladder, bubbles streaming
    const d = Math.hypot(DIVE_CTX.ladder.x - p.x, DIVE_CTX.ladder.y - p.y);
    await new Promise<void>(res => { S.ascent = { x0: p.x, y0: p.y, t: 0, dur: clamp(d / 150, 1.1, 4.2), res }; });
    if (game.scene !== (f as never)) return;
    // the spare second stage on the ladder: a huge gulp, then the tank starts filling there
    S.air = Math.max(S.air, 0.18);
    sfxArm('regIn', { vol: 1.1, pitch: 0.82 });
    p.body.setExpr('tired', 3);
    await cineTo(f.st, { x: p.x, y: p.y - 22, zoom: 1.55, secs: 0.6 });
    const n = lost.length;
    await floatText({ text: n ? `Made it... but ${n === 1 ? 'one fish' : `${n} fish`} slipped out of the bag on the way up.` : 'Made it... Never. Doing. That. Again.', style: 'sad', ms: 2600 });
    await cineRelease(f.st, 0.7);
  } finally {
    cineBars(false);
    if (game.scene === (f as never)) f.cutscene = wasCut;
    S.ascent = null;
    S.busy = false;
    S.warned = 0;
  }
}
/** drop about half the catch (the odd one too): they tumble away into the gloom */
function dropCatch(p: Player): string[] {
  const c = DIVE_CTX.catches;
  const n = Math.ceil(c.length / 2);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(...c.splice(Math.floor(rand.next() * c.length), 1));
  out.forEach((id, i) => S.drops.push({ id, x: p.x - p.facing * 6, y: p.y - 14, vx: rand.range(-30, 30), vy: -10 - i * 4, t: -i * 0.12 }));
  if (out.length) audio.play('splash', { vol: 0.25, pitch: 1.4 });
  return out;
}

// ---------------------------------------------------------------- the catch into the pack
/**
 * The dive's catch goes home: every food item taken on this dive (DIVE_CTX.catches) into the pack, the
 * ones that don't fit let go. Clears the catch. Called by the scene when Mori climbs the ladder out.
 */
export function bankCatches(f?: FieldScene | null): { banked: Record<string, number>; left: string[] } {
  const got: Record<string, number> = {};
  const left: string[] = [];
  for (const id of DIVE_CTX.catches) {
    if (ITEMS[id] && fits(id, 1) && add(id, 1) > 0) got[id] = (got[id] ?? 0) + 1;
    else left.push(id);
  }
  DIVE_CTX.catches.length = 0;
  const kinds = Object.keys(got);
  if (kinds.length) {
    game.persist();
    audio.play('collectPop', { vol: 0.55 });
    const s = f ?? S.f;
    if (s?.player) {
      kinds.forEach((id, i) => setTimeout(() => {
        try { const [cx, cy] = s.css(s.player.x, s.player.y - 30); s.hud?.flyItem(id, got[id], ITEMS[id]?.name ?? id, cx, cy); } catch { /* */ }
      }, i * 260));
    }
    const words = kinds.map(id => `${got[id]} ${(ITEMS[id]?.name ?? id).toLowerCase()}`).join(', ');
    void floatText({ text: left.length ? `Into the pack: ${words}. No room for the rest; back they go.` : `Into the pack: ${words}. Dinner!`, style: 'happy', ms: 3200 });
  } else if (left.length) void floatText({ text: 'No room in the pack. Back you go, fish.', style: 'sad', ms: 2600 });
  return { banked: got, left };
}

// ---------------------------------------------------------------- the diver's outfit
let wearT = 0;
let before: string | null = null;
/** dress Mori for the water (every frame, from the player): the wetsuit with the 'wetsuit' gear, the full
 *  dive kit with the 'scuba' gate; back into whatever he wore before once he's out */
export function diveWear(p: Player, dt: number): void {
  if (p.id !== 'mori') return;
  const cur = p.body.outfit;
  const ours = cur === 'dive' || cur === 'wetsuit';
  if (!p.underwater) {
    if (ours) { p.body.outfit = before ?? 'casual'; before = null; }
    if (p.animMap?.swim === 'diveSwim') p.animMap = null;
    return;
  }
  wearT -= dt;
  if (wearT > 0 && ours) return;
  wearT = 0.5;
  const want = gateOk('scuba') ? 'dive' : isActive('wetsuit') ? 'wetsuit' : null;
  if (want && cur !== want) { if (!ours) before = cur; p.body.outfit = want; }
  else if (!want && ours) { p.body.outfit = before ?? 'casual'; before = null; }
  // the diver's level trim and slow flutter with the fins and the tank on
  if (want === 'dive') { if (!p.animMap) p.animMap = { swim: 'diveSwim' }; }
  else if (p.animMap?.swim === 'diveSwim') p.animMap = null;
}

// ---------------------------------------------------------------- painting
type BubFr = { b: Frame[]; pop: Frame[] };
let fr: BubFr | null = null, frOwner: unknown = null;
const dropFr = new Map<string, Frame>();
function frames(): BubFr {
  if (fr && frOwner === local) return fr;
  frOwner = local;
  dropFr.clear();
  const mk = (rows: string[]) => {
    const pal: Record<string, string> = { w: '#ffffff', l: '#d4f4ff', m: '#8cd2ec', d: '#4a98bc', s: '#2a6a8e' };
    const b = new PixelBuffer(rows[0].length, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) b.set(x, y, hex(pal[ch])); }));
    return b;
  };
  // hand-placed bubbles: a speck, a bead, a ring with its glint, a big wobbling cap
  const b = [
    mk(['l']),
    mk(['wl', 'md']),
    mk(['.lm.', 'w..d', 'l..d', '.ds.']),
    mk(['..lmm..', '.w...d.', 'l.....d', 'm.....s', '.dssss.']),
  ].map((buf, i) => local.add('v12air:b' + i, buf, buf.w / 2, buf.h / 2));
  // the pop at the surface: a little broken ring
  const pop = [mk(['.l.l.', 'l...l', '.....', 'm...m', '.m.m.']), mk(['l.....l', '.......', '.......', 'm.....m'])].map((buf, i) => local.add('v12air:p' + i, buf, buf.w / 2, buf.h / 2));
  fr = { b, pop };
  return fr;
}
function dropFrame(id: string): Frame | null {
  let f = dropFr.get(id);
  if (f) return f;
  if (!ITEMS[id]) return null;
  const buf = itemIcon(id);
  f = local.add('v12air:drop:' + id, buf, buf.w / 2, buf.h / 2);
  dropFr.set(id, f);
  return f;
}
function draw(r: Renderer) {
  const F = frames();
  r.emissive(0.35);
  for (const b of S.bubbles) r.draw(F.b[Math.min(3, b.s)], Math.round(b.x), Math.round(b.y), 1, 1, 0, packColor(1, 1, 1, clamp(1 - b.t / 14) * 0.95));
  for (const q of S.pops) r.draw(F.pop[q.t < 0.15 ? 0 : 1], Math.round(q.x), Math.round(q.y), 1, 1, 0, packColor(1, 1, 1, 1 - q.t / 0.35));
  r.emissive();
  for (const d of S.drops) {
    if (d.t < 0) continue;
    const f = dropFrame(d.id);
    if (f) r.draw(f, Math.round(d.x), Math.round(d.y), 1, 1, 0, packColor(1, 1, 1, clamp(1.4 - d.t / 3.2)));
  }
}

// the field watch turns into the dive computer while he's down here (src/ui/v12/watch.ts)
WATCH_DIVE.live = () => (S.f && diving() ? { depth: S.depth, air: S.air } : null);

// console / test helpers: zlAir.state(), zlAir.set(0.1), zlAir.bank()
try {
  (window as unknown as { zlAir?: unknown }).zlAir = {
    state: () => ({ air: +S.air.toFixed(4), depth: +S.depth.toFixed(1), on: !!S.f, diving: diving(), warned: S.warned, ascent: !!S.ascent || S.busy, catches: [...DIVE_CTX.catches], bubbles: S.bubbles.length }),
    set: (v: number) => setAir(v),
    bank: () => bankCatches(),
    start: () => startAir(game.scene as unknown as FieldScene),
    ctx: DIVE_CTX,
  };
} catch { /* */ }
