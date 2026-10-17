// V11 NPCs in the world: who lives where, their routines, their homes, and the quest bits that sit in
// the scenes. Everything is put in by location id when a field scene opens (field10.ts onLocEnter):
//
//   island (home shore)  Te Puni ranger station on the bush track (Hine, Doug, Rosie; from Day 3): the
//                        storm-wrecked hut, the tall kahikatea with the radio in it (a slingshot
//                        target); Marge's hut in the palm grove (from Day 2); Marge's sketchbook pages
//                        and Ngaio's old nets along the shore; the craftspeople visiting camp
//   coast                the Helix camp on the east headland (Dr Varga, Teo), a Helix live trap
//   fernwood / mangrove  Helix live traps; the fallen tōtara (Tīpene's quest); Teo, now and then
//   hills                the trappers' camp (Rua, Sunny) at the hills site's huntersCamp anchor if it
//                        exports one (HILLS_SPOTS.huntersCamp, or the site's spots), else a sensible x;
//                        the trap stakes and Sunny's cans
//
// Routines: each person walks between their own spots, doing their own things (their idle clips carry
// the quirks), turns to face Mori when he comes close, sits by their fire after dark.

import { game } from '../../game';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Actor } from '../../../world/actor';
import { Custom, Prop } from '../../../world/props';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { packColor } from '../../../gfx/renderer';
import { sprite } from '../../sites10/kit';
import type { Point10 } from '../../sites10/kit';
import type { TripRun } from '../../v10/field10';
import { discover } from '../../v10/regions';
import { dayPhase } from '../../v10/day';
import { expeditionHour } from '../../v10/expedition';
import { questStatus } from '../../quests';
import { count } from '../../inventory';
import { findArt } from '../../v10/finds';
import { addShootTarget } from '../predators-core';
import { hasSlingshot } from '../predators';
import { registerNpcArt } from '../../../art/v11/npcs/register';
import * as PL from '../../../art/v11/npcs/places';
import { hasMet, PEOPLE } from '../social';
import { converse } from './talk';
import { questMenu } from './quests';
import { F, setF, V, setV, day, sleep, AROUND, loopOn } from './state';
import { L } from './types';

// ------------------------------------------------------------------ where
/** the home-shore spots (island world x) */
export const SPOTS = {
  station: 6400, tree: 6478, hine: 6360, doug: 6470, rosie: 6320,
  marge: 3060, margeHut: 3130,
  /** camp visitors: Tīpene by the lean-to, Ngaio at the wreck end where the nets wash up */
  tipene: 2338, carving: 2356, ngaio: 1436, weaving: 1450,
  pages: [690, 3640, 4420, 5660], nets: [1080, 4560],
};
const HELIX_X = 1930;
const HILLS_FALLBACK = 1650;

// ------------------------------------------------------------------ helpers
type Ground = (x: number) => number;
const groundFn = (f: FieldScene, r: TripRun | null): Ground => (x: number) => (r ? r.groundAt(x) : f.st.terrain.groundY(x));
function prop(f: FieldScene, key: string, gen: () => import('../../../art/jungle-core').Sprite, x: number, y: number, z: number, when?: () => boolean) {
  const c = sprite(key, gen);
  if (!c) return;
  const p = new Prop(c.f, x, y, z);
  f.main.add(new Custom(z, (rr, st) => { if (!when || when()) p.draw(rr, st); }));
}
const nightNow = (f: FieldScene) => {
  const s = f as unknown as { clock?: { t: number } };
  if (s.clock) return s.clock.t > 3.35;
  const h = expeditionHour() % 24;
  return h >= 19 || h < 6;
};
const free = (f: FieldScene) => !f.cutscene && !game.ui.blocking && !game.ui.bubbles.active;

interface Spot { x: number; anim?: string; dur?: [number, number] }
interface PersonOpts {
  face?: 1 | -1;
  /** where they go during the day (with what they do there) */
  spots: Spot[];
  /** after dark: sit here */
  night?: number;
  speed?: number;
  run?: boolean;
  /** say something the first time Mori comes near */
  hello?: { lines: [string, string, string?][]; r?: number };
  /** shown only while this holds */
  when?: () => boolean;
}
export const SPAWNED = new Map<string, Actor>();

/** put someone in the scene with a routine and a "talk" interaction */
function person(f: FieldScene, id: string, g: Ground, o: PersonOpts): Actor {
  registerNpcArt();
  const s0 = o.spots[0];
  const a = f.addActor(id, s0.x, g(s0.x), o.face ?? -1);
  a.z = 44;
  a.idleAnim = s0.anim ?? 'idle';
  a.setAnim(a.idleAnim);
  SPAWNED.set(id, a);
  let busy = false, t = rand.range(1, 4), helloed = false;
  const name = () => (hasMet(id) ? PEOPLE[id]?.name ?? id : 'the stranger');
  (f.interact as Interactable[]).push({
    get x() { return a.x; }, get y() { return a.y; }, w: 16, h: 22,
    get label() { return hasMet(id) ? `Talk to ${name()}` : `Say hello to ${PEOPLE[id]?.group === 'ranger' && id === 'rosie' ? 'the girl in the hat' : 'the stranger'}`; },
    get standX() { return a.x + (f.player.x < a.x ? -22 : 22); },
    enabled: () => a.visible && !busy && (!o.when || o.when()),
    quest: () => a.visible && questHint(id),
    action: async () => {
      if (f.cutscene || busy || game.ui.bubbles.active) return;
      busy = true;
      a.stopWalk();
      a.faceTo(f.player.x);
      a.setAnim('idle');
      f.cutscene = true;
      try { await converse({ id, say: l => f.say(l), f, a }); }
      finally { f.cutscene = false; busy = false; a.setAnim(a.idleAnim); f.hud?.refresh(true); }
    },
  } as Interactable);
  // the routine
  f.main.add(new Custom(0, () => {}, dt => {
    if (o.when && !o.when()) { a.visible = false; return; }
    a.visible = true;
    if (busy || f.cutscene) return;
    const p = f.player;
    const near = Math.abs(p.x - a.x) < 46 && Math.abs(p.y - a.y) < 40;
    if (o.hello && !helloed && !hasMet(id) && Math.abs(p.x - a.x) < (o.hello.r ?? 150) && free(f)) {
      helloed = true;
      a.faceTo(p.x);
      void f.say(L(o.hello.lines).map(l => ({ ...l, close: false })));
    }
    if (near && !a.walking) { a.faceTo(p.x); return; }
    t -= dt;
    if (t > 0 || a.walking) return;
    if (nightNow(f) && o.night !== undefined) {
      if (Math.abs(a.x - o.night) > 4) { void a.walkTo(o.night, o.speed ?? 34, 'walk').then(() => { a.idleAnim = 'sitGround'; a.setAnim('sitGround'); }); }
      t = 8;
      return;
    }
    const sp = rand.pick(o.spots);
    t = rand.range(...(sp.dur ?? [5, 10]));
    const go = () => { a.idleAnim = sp.anim ?? 'idle'; a.setAnim(a.idleAnim); };
    if (Math.abs(a.x - sp.x) < 6) go();
    else void a.walkTo(sp.x + rand.range(-6, 6), o.speed ?? 34, o.run && rand.chance(0.5) ? 'run' : 'walk').then(go);
  }));
  return a;
}

/** a quest step points at them (cheap: checked a few times a second) */
const hintCache = new Map<string, { t: number; v: boolean }>();
function questHint(id: string): boolean {
  const now = performance.now(), c = hintCache.get(id);
  if (c && now - c.t < 500) return c.v;
  let v = false;
  try { v = questMenu(id).some(m => m.quest); } catch { v = false; }
  hintCache.set(id, { t: now, v });
  return v;
}

/** a find that sits somewhere until a flag is set */
function onceFind(r: TripRun, pt: Point10, flag: string, active: () => boolean) {
  r.addFind({ ...pt, when: () => active() && !F(flag), after: () => { setF(flag); pt.after?.(); } });
}

// ================================================================== the home shore
function island(f: FieldScene, r: TripRun | null) {
  if (!loopOn()) return;
  const g = groundFn(f, r);
  // ---------------------------------------------------------------- the ranger station
  if (AROUND.rangers()) {
    prop(f, 'n:tree', PL.tallTree, SPOTS.tree, g(SPOTS.tree) + 2, -6.5);
    prop(f, 'n:station', () => PL.station(false), SPOTS.station, g(SPOTS.station) + 2, -6, () => !F('q_roof:returned'));
    prop(f, 'n:stationFixed', () => PL.station(true), SPOTS.station, g(SPOTS.station) + 2, -6, () => F('q_roof:returned'));
    radioInTree(f, r, g);
    person(f, 'hine', g, {
      spots: [{ x: SPOTS.hine, anim: 'idle', dur: [6, 12] }, { x: SPOTS.station + 8, anim: 'hammer', dur: [5, 9] }, { x: SPOTS.station - 60, anim: 'idle', dur: [4, 8] }],
      night: SPOTS.station - 30, speed: 40,
      hello: { lines: [['hine', 'Kia ora! You’ll be one of the shipwreck lot. Come up, come up. Mind the creek.', 'happy']] },
    });
    person(f, 'doug', g, {
      spots: [{ x: SPOTS.doug, anim: 'idle', dur: [8, 14] }, { x: SPOTS.tree - 20, anim: 'idle', dur: [6, 10] }, { x: SPOTS.station + 120, anim: 'idle', dur: [5, 9] }],
      night: SPOTS.station - 10, speed: 38,
    });
    person(f, 'rosie', g, {
      spots: [{ x: SPOTS.rosie, anim: 'idle', dur: [3, 6] }, { x: SPOTS.station + 90, anim: 'idle', dur: [2, 5] }, { x: SPOTS.station - 110, anim: 'kneel', dur: [3, 6] }, { x: SPOTS.tree + 30, anim: 'cheer', dur: [2, 3] }],
      night: SPOTS.station + 4, speed: 52, run: true,
      hello: { lines: [['rosie', 'MUM! MUM! A PERSON! A real one with a CAMERA!', 'excited']], r: 200 },
    });
    if (!F('n:seen:station')) f.main.add(new Custom(0, () => {}, () => {
      if (F('n:seen:station') || Math.abs(f.player.x - SPOTS.station) > 220) return;
      setF('n:seen:station');
      discover({ id: 'n:station', kind: 'landmark', name: 'Te Puni ranger station', loc: 'isle-track', x: SPOTS.station, note: 'The rangers’ station: the storm took half the roof.' }, false);
    }));
  }
  // ---------------------------------------------------------------- Marge in the grove
  if (AROUND.marge()) {
    prop(f, 'n:margeHut', PL.margeHut, SPOTS.margeHut, g(SPOTS.margeHut) + 2, -5);
    person(f, 'marge', g, {
      spots: [{ x: SPOTS.marge, anim: 'idle', dur: [8, 14] }, { x: SPOTS.margeHut + 50, anim: 'idle', dur: [6, 10] }, { x: SPOTS.marge - 80, anim: 'idle', dur: [6, 12] }],
      night: SPOTS.margeHut - 24, speed: 22,
      hello: { lines: [['marge', 'Hello? Hello! Oh, how marvellous, a visitor! Do come and look at this beetle before it leaves!', 'excited']], r: 170 },
    });
    if (!F('n:seen:grove')) f.main.add(new Custom(0, () => {}, () => {
      if (F('n:seen:grove') || Math.abs(f.player.x - SPOTS.margeHut) > 200) return;
      setF('n:seen:grove');
      discover({ id: 'n:margehut', kind: 'landmark', name: 'Marge’s hut', loc: 'isle-grove', x: SPOTS.margeHut, note: 'A palm-frond hut: a naturalist lives here!' }, false);
    }));
  }
  // ---------------------------------------------------------------- shore finds for the quests
  if (r) {
    SPOTS.pages.forEach((x, i) => onceFind(r, {
      id: 'n:page:' + i, kind: 'artifact', name: 'A sketchbook page', x, art: () => findArt.glint('#f4ecd8'),
      take: { item: 'q_page', verb: 'Pick up the sketchbook page', time: 0.8, line: ['A page of beetles. Beautiful ones.', 'Ferns, drawn leaf by leaf. Marge’s.', 'A very cross bird. Labelled “VERY CROSS BIRD”.', 'A map of the grove with a little X: “best tea leaves”.'][i] },
    }, 'n:pageGot:' + i, () => questStatus('q_pages') === 'active'));
    SPOTS.nets.forEach((x, i) => onceFind(r, {
      id: 'n:net:' + i, kind: 'artifact', name: 'An old fishing net', x, art: () => findArt.glint('#3680a2'),
      take: { item: 'q_net', verb: 'Pull the old net free', time: 1.4, line: 'Blue nylon net, tangled in the rocks. Ngaio’s going to love this.' },
    }, 'n:netGot:' + i, () => questStatus('q_nets') === 'active'));
  }
  // ---------------------------------------------------------------- visitors at camp
  campVisitors(f);
}

/** the station radio up the kahikatea: a slingshot target (or stones) until it falls */
function radioInTree(f: FieldScene, r: TripRun | null, g: Ground) {
  const x = SPOTS.tree + 14, gy = g(SPOTS.tree);
  const topY = gy - 176;
  const c = sprite('n:radio', PL.radio);
  let fallY = topY, vy = 0, falling = false;
  const up = () => questStatus('q_roof') === 'active' && F('q_roof:given') && !F('q_roof:down');
  const onGround = () => F('q_roof:down') && !F('q_roof:got');
  const knock = () => {
    if (!up() || falling) return;
    falling = true;
    audio.play('rustle', { vol: 0.6 });
    f.bark('doug', 'Got it! Ooh, it’s coming down! Mind your heads!', { expr: 'excited' });
  };
  if (c) f.main.add(new Custom(-5.5, rr => {
    if (up() || falling) rr.draw(c.f, x, falling ? fallY : topY);
    else if (onGround()) rr.draw(c.f, x, gy + 1);
  }, dt => {
    if (!falling) return;
    vy += 420 * dt;
    fallY += vy * dt;
    if (fallY >= gy) { falling = false; fallY = gy; setF('q_roof:down'); audio.play('land', { vol: 0.5 }); f.st.shake(1, 0.2); }
  }));
  const off = addShootTarget({ x, y: topY - 8, r: 10, hit: () => knock(), alive: () => game.scene === f && up() });
  void off;
  // no slingshot (or no luck with it): stones, by hand
  (f.interact as Interactable[]).push({
    x: SPOTS.tree, y: gy, w: 18, h: 26, standX: SPOTS.tree - 18,
    get label() { return hasSlingshot() ? 'The radio is up there: ready the slingshot (G) and aim high. Or throw stones' : 'Throw stones at the radio in the tree'; },
    enabled: () => up() && !falling,
    action: async () => {
      const p = f.player;
      p.facing = 1;
      await p.body.play('pick', 'idle').catch(() => {});
      audio.play('swish' as never, { vol: 0.5 });
      if (rand.chance(0.4)) knock();
      else f.bark('mori', rand.pick(['Missed. By a mile.', 'Closer! No. Not closer.', 'That one hit a bird. Sorry, bird.']), { expr: 'worried' });
    },
  } as Interactable);
  if (r) r.addFind({
    id: 'n:radioFallen', kind: 'artifact', name: 'The station radio', x: x + 4, y: gy,
    take: { item: 'q_radio', verb: 'Pick up the station radio', time: 0.8, line: 'Cracked, wet, wound in tape. Jenna will either fix it or adopt it.' },
    when: () => onGround(), after: () => setF('q_roof:got'),
  });
}

/** Tīpene and Ngaio come down to camp on their visit days and set up by the lean-to and the wreck end */
export const tipeneHere = () => F('n:tipeneMet') && (day() % 2 === 1 || V('n:tipeneFirst') === day() || (F('q_timber:given') && !F('q_timber:done') && day() > V('q_timber:day')));
export const ngaioHere = () => F('n:ngaioMet') && (day() % 2 === 0 || V('n:ngaioFirst') === day() || (F('q_nets:given') && !F('q_nets:done') && day() > V('q_nets:day')));
const atCamp = (here: () => boolean) => () => here() && dayPhase() !== 'night' && dayPhase() !== 'out';
/** put a craftsperson at their camp spot (the first-visit scene calls this for the day they arrive) */
export function addVisitor(f: FieldScene, id: 'tipene' | 'ngaio', from?: number): Actor | null {
  const g = groundFn(f, null);
  if (SPAWNED.get(id) && f.actors.get(id) === SPAWNED.get(id)) return SPAWNED.get(id)!;
  if (id === 'tipene') {
    const tH = atCamp(tipeneHere);
    prop(f, 'n:carving', PL.carving, SPOTS.carving, g(SPOTS.carving) + 2, -2.5, tH);
    const a = person(f, 'tipene', g, { spots: [{ x: SPOTS.tipene, anim: 'idle', dur: [10, 16] }, { x: SPOTS.carving + 30, anim: 'idle', dur: [6, 10] }], speed: 20, face: 1, when: tH });
    if (from !== undefined) { a.x = from; a.y = g(from); }
    return a;
  }
  const nH = atCamp(ngaioHere);
  prop(f, 'n:weaving', PL.weaving, SPOTS.weaving, g(SPOTS.weaving) + 2, -2.5, nH);
  const a = person(f, 'ngaio', g, { spots: [{ x: SPOTS.ngaio, anim: 'idle', dur: [10, 16] }, { x: SPOTS.ngaio - 40, anim: 'kneel', dur: [4, 7] }], speed: 30, face: 1, when: nH });
  if (from !== undefined) { a.x = from; a.y = g(from); }
  return a;
}
function campVisitors(f: FieldScene) {
  if (F('n:tipeneMet')) addVisitor(f, 'tipene');
  if (F('n:ngaioMet')) addVisitor(f, 'ngaio');
}

// ================================================================== the Serpent Coast: Helix camp
function coast(f: FieldScene, r: TripRun | null) {
  const g = groundFn(f, r);
  const W = f.site.width ?? 2400;
  const hx = Math.min(W - 160, HELIX_X);
  prop(f, 'n:helixCamp', PL.helixCamp, hx + 40, g(hx + 40) + 2, -4);
  person(f, 'celeste', g, { spots: [{ x: hx, anim: 'idle', dur: [10, 16] }, { x: hx + 90, anim: 'idle', dur: [6, 10] }], night: hx + 20, speed: 40, face: -1,
    hello: { lines: [['celeste', 'Stop right there. This is a Helix survey site. Who are you?', 'serious']], r: 180 } });
  person(f, 'teo', g, { spots: [{ x: hx - 120, anim: 'kneel', dur: [5, 9] }, { x: hx - 260, anim: 'kneel', dur: [5, 9] }, { x: hx - 40, anim: 'idle', dur: [6, 10] }], night: hx + 40, speed: 30 });
  f.main.add(new Custom(0, () => {}, () => {
    if (F('n:helix:met') || !hasMet('celeste') && !hasMet('teo')) return;
    setF('n:helix:met');
    discover({ id: 'n:helixcamp', kind: 'landmark', name: 'The Helix camp', loc: 'coast', x: hx, note: 'Helix Bioprospecting: the boot prints, the yellow tags.' }, false);
  }));
  if (r) helixTrap(r, 'coast', hx - 600);
}

/** a yellow Helix live trap with an animal in it (only while Teo's worry is a quest) */
function helixTrap(r: TripRun, loc: string, x: number) {
  const key = 'n:htrap:' + loc;
  const who = rand.pick(['delver', 'quillhog', 'shieldback']);
  r.addFind({
    id: key, kind: 'landmark', name: 'A Helix live trap', x, art: PL.helixTrap,
    when: () => questStatus('q_tags') === 'active' && !F(key),
    look: { verb: 'Open the yellow trap and let the animal go', lines: () => [] },
    after: () => {
      if (F(key)) return;
      setF(key);
      setV('q_tags:freed', V('q_tags:freed') + 1);
      audio.play('rope', { vol: 0.5 });
      r.f.spawnRule({ species: who, n: [1, 1], x: [x + 6, x + 10], chance: 1 }, false);
      void r.f.say(L([['mori', 'Easy... there you go. Tag 04-something. Helix. Off you go, little one.', 'happy']]));
    },
  });
}

// ================================================================== Fernwood and the mangroves
function fernwood(f: FieldScene, r: TripRun | null) {
  if (!r) return;
  const g = groundFn(f, r);
  // the fallen tōtara across the stream (cut once Mori takes his block)
  const tx = 1320;
  prop(f, 'n:totara', () => PL.fallenTotara(false), tx, g(tx) + 3, -3, () => !F('n:totaraCut'));
  prop(f, 'n:totaraCut', () => PL.fallenTotara(true), tx, g(tx) + 3, -3, () => F('n:totaraCut'));
  r.addFind({
    id: 'n:totara', kind: 'plant', name: 'The fallen tōtara', x: tx, photo: { w: 120, h: 26 }, note: 'An old tōtara, fallen across the stream years ago.',
    take: { item: 'q_totara', verb: 'Cut a block from the fallen tōtara', time: 3, tools: ['knife'], line: 'Red, straight-grained, and it smells like a pencil. Thank you, tree.' },
    when: () => questStatus('q_timber') === 'active' && !F('n:totaraCut') && count('q_totara') === 0,
    after: () => setF('n:totaraCut'),
  });
  helixTrap(r, 'fernwood', 1900);
  maybeTeo(f, r, g, 700);
}
function mangrove(f: FieldScene, r: TripRun | null) {
  if (!r) return;
  helixTrap(r, 'mangrove', 1100);
  maybeTeo(f, r, groundFn(f, r), 1500);
}
/** Teo, out where he shouldn't be, now and then (once he's been met) */
function maybeTeo(f: FieldScene, _r: TripRun, g: Ground, x: number) {
  if (!hasMet('teo') || V('n:teoRoam') === day() || !rand.chance(0.35)) return;
  setV('n:teoRoam', day());
  person(f, 'teo', g, { spots: [{ x, anim: 'kneel', dur: [6, 10] }, { x: x + 120, anim: 'idle', dur: [5, 8] }], speed: 30 });
}

// ================================================================== the Rocky Hills: the trappers
const hillMods = import.meta.glob(['../../sites10/hills*.ts', '../hills/*.ts', '../../sites10/hills/*.ts', '../hills*.ts']);
async function hillsAnchor(f: FieldScene): Promise<number> {
  const site = f.site as unknown as { spots?: Record<string, unknown>; v10?: { spots?: Record<string, unknown> } };
  const pickX = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof (v as { x?: unknown }).x === 'number' ? (v as { x: number }).x : null);
  for (const s of [site.spots, site.v10?.spots]) { const x = pickX(s?.huntersCamp ?? s?.hunters); if (x !== null) return x; }
  for (const load of Object.values(hillMods)) {
    try {
      const m = await load() as Record<string, unknown>;
      for (const v of Object.values(m)) { const o = v as Record<string, unknown> | null; if (o && typeof o === 'object' && 'huntersCamp' in o) { const x = pickX(o.huntersCamp); if (x !== null) return x; } }
    } catch { /* not there */ }
  }
  return Math.min((f.site.width ?? 3200) - 300, HILLS_FALLBACK);
}
async function hills(f: FieldScene, r: TripRun | null) {
  const hx = await hillsAnchor(f);
  if (game.scene !== f) return;
  const g = groundFn(f, r);
  const W = f.site.width ?? 3200;
  prop(f, 'n:hunterCamp', PL.hunterCamp, hx, g(hx) + 2, -4);
  // the fire: a live glow and a little smoke
  const fx = hx + 58, lp = f.main.particles;
  f.main.add(new Custom(-3.8, rr => { const fy = g(fx) - 4; rr.light(fx, fy - 6, 60, 1, 0.62, 0.3, 0.5, 0.12); for (let i = 0; i < 3; i++) rr.fxDraw(A.spark, fx - 3 + i * 3 + Math.sin(f.st.time * 9 + i) * 1.5, fy - 2 - Math.abs(Math.sin(f.st.time * 7 + i * 2)) * 5, 0.7, 0.9, 0, packColor(1, 0.6 + i * 0.1, 0.2, 1), 1.2); },
    dt => { if (rand.chance(dt * 3)) lp.spawn({ frame: A.soft, x: fx + rand.range(-2, 2), y: g(fx) - 10, vx: rand.range(-3, 3) + f.st.wind * 5, vy: rand.range(-22, -12), life: rand.range(1.6, 2.6), color: [0.8, 0.8, 0.82], alpha: 0.28, alpha1: 0, size: 0.3, size1: 1.4 }); }));
  person(f, 'rua', g, { spots: [{ x: hx + 40, anim: 'idle', dur: [10, 18] }, { x: hx - 140, anim: 'kneel', dur: [5, 8] }], night: hx + 44, speed: 28, face: 1,
    hello: { lines: [['sunny', 'Oi! Rua, look! Company!', 'excited']], r: 200 } });
  person(f, 'sunny', g, { spots: [{ x: hx + 96, anim: 'idle', dur: [6, 12] }, { x: hx + 170, anim: 'idle', dur: [4, 8] }, { x: hx - 40, anim: 'idle', dur: [5, 9] }], night: hx + 74, speed: 40, face: -1 });
  f.main.add(new Custom(0, () => {}, () => {
    if (F('n:seen:hunters') || Math.abs(f.player.x - hx) > 220) return;
    setF('n:seen:hunters');
    discover({ id: 'n:huntcamp', kind: 'landmark', name: 'The trappers’ camp', loc: 'hills', x: hx, note: 'Rua and Sunny trap stoats here to save the ground birds.' }, false);
  }));
  cans(f, g, clamp(hx + 190, 80, W - 60));
  traps(f, g, [hx - 320, hx + 330, hx + 520].map(x => clamp(x, 60, W - 60)));
}

/** Sunny's three cans on a log: slingshot targets (or stones) while her bet is on */
function cans(f: FieldScene, g: Ground, x: number) {
  prop(f, 'n:canLog', PL.canLog, x, g(x) + 2, -2.4);
  const c = sprite('n:can', PL.can);
  const on = () => questStatus('q_cans') === 'active' && V('q_cans:hit') < 3;
  const state = [0, 1, 2].map(i => ({ x: x - 14 + i * 14, down: i < V('q_cans:hit'), fall: 0, vy: 0, vx: 0 }));
  const hit = (k: number) => {
    const s = state[k];
    if (s.down || !on()) return;
    s.down = true; s.vy = -90; s.vx = rand.range(40, 80);
    audio.play('clang' as never, { vol: 0.5 });
    setV('q_cans:hit', state.filter(q => q.down).length);
    const n = V('q_cans:hit');
    f.bark('sunny', n >= 3 ? 'NO WAY. All three! ...Come here and collect, then.' : n === 2 ? 'Lucky. That was lucky.' : 'Pfft. One. Anyone can hit one.', { expr: n >= 3 ? 'surprised' : 'smug' });
  };
  if (c) f.main.add(new Custom(-2.3, rr => {
    const gy = g(x) - 9;
    for (const s of state) { if (!s.down) rr.draw(c.f, s.x, gy); else if (s.fall < 1.2) rr.draw(c.f, s.x + s.vx * s.fall, gy + s.vy * s.fall + 200 * s.fall * s.fall, 1, 1, s.fall * 8); }
  }, dt => { for (const s of state) if (s.down && s.fall < 1.2) s.fall += dt; }));
  state.forEach((s, k) => addShootTarget({ x: s.x, y: g(x) - 13, r: 6, hit: () => hit(k), alive: () => game.scene === f && on() && !s.down }));
  (f.interact as Interactable[]).push({
    x, y: g(x), w: 22, h: 18, standX: x - 60,
    get label() { return hasSlingshot() ? 'Sunny’s cans: ready the slingshot (G) and aim. Or throw stones' : 'Throw stones at Sunny’s cans'; },
    enabled: () => on(),
    action: async () => {
      await f.player.body.play('pick', 'idle').catch(() => {});
      const k = state.findIndex(s => !s.down);
      if (k >= 0 && rand.chance(0.35)) hit(k);
      else f.bark('sunny', rand.pick(['HA! Missed!', 'The cans are THAT way, bro.', 'Ooh, so close. Not really.']), { expr: 'laugh' });
    },
  } as Interactable);
}

/** Rua's trap stakes: set a tunnel trap at each, check them after a night */
function traps(f: FieldScene, g: Ground, xs: number[]) {
  xs.forEach((x, i) => {
    const setK = 'n:trapSet:' + i, chkK = 'n:trapChk:' + i;
    prop(f, 'n:stake', () => PL.stake(false), x, g(x) + 2, -2.6, () => questStatus('q_traps') === 'active' && !F(setK));
    prop(f, 'n:stakeSet', () => PL.stake(true), x, g(x) + 2, -2.6, () => F(setK));
    (f.interact as Interactable[]).push({
      x, y: g(x), w: 16, h: 18, standX: x - 16,
      get label() { return !F(setK) ? 'Set a tunnel trap at the red-flax stake' : day() > V(setK) ? 'Check the tunnel trap' : 'The trap is set (check it after a night)'; },
      enabled: () => questStatus('q_traps') === 'active' && !F(chkK),
      quest: () => questStatus('q_traps') === 'active' && (!F(setK) || day() > V(setK)),
      action: async () => {
        const p = f.player;
        if (!F(setK)) {
          if (!await p.doWork('kneel', 2.2, () => {})) return;
          setF(setK); setV(setK, day());
          setV('q_traps:set', xs.filter((_, k) => F('n:trapSet:' + k)).length);
          audio.play('rope', { vol: 0.5 });
          f.bark('mori', 'Like I forgot it here. Like I forgot it here...', { expr: 'thinking' });
          return;
        }
        if (day() <= V(setK)) { f.bark('mori', 'Too soon. Give it a night.', { expr: 'thinking' }); return; }
        if (!await p.doWork('kneel', 1.6, () => {})) return;
        setF(chkK);
        const caught = i !== 1;
        await f.say(L([caught ? ['mori', 'A stoat. Rua was right: that’s a nest of eggs that hatch this spring.', 'serious'] : ['mori', 'Empty. Bait’s gone, though. Clever thing.', 'thinking']]));
        if (xs.every((_, k) => F('n:trapChk:' + k))) setF('q_traps:checked');
      },
    } as Interactable);
  });
}

// ================================================================== dispatch
export async function spawnFor(f: FieldScene, loc: string | null, r: TripRun | null) {
  if (!loopOn() && loc !== 'island') return;
  try {
    if (loc === 'island') island(f, r);
    else if (loc === 'coast') coast(f, r);
    else if (loc === 'fernwood') fernwood(f, r);
    else if (loc === 'mangrove') mangrove(f, r);
    else if (loc === 'hills') await hills(f, r);
    else if (r && (loc === 'canopy' || loc === 'forest')) maybeTeo(f, r, groundFn(f, r), 900);
  } catch (e) { console.warn('[npcs] spawn', loc, e); }
  void sleep;
}
