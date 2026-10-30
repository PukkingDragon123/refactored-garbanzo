// V12 trails: the island is a network you walk. No map travel, no checkpoints, no "head back to camp"
// button: camp is the hub on the beach, and every other place is a scene whose edges and side paths
// are trail ends. Walk off a scene's edge (hold the direction at the edge) or take a branch at a
// signposted crossroads (walk up to the post and press up / down, or click a plank) and Mori sets off:
// a short fade, the trail's hours pass (and his stomach notices), and he walks in at the matching end
// of the next place. The trails going deeper can be shut: by gear not made yet (gear.ts: rope for a
// cliff, a snorkel for the pool...), by the hour (no setting off inland late in the day), or by the
// story (Koro's blessing). Walking back toward camp is always open.
//
// Every place is at most a few trails from the beach: the stream mouth (Te Wao Nui up the stream, the
// mangroves down it), the glowworm cave (the grotto), the bush track at the east end (Fernwood); Te
// Wao Nui's ridge end splits for Fernwood and the Rocky Hills; Fernwood for the canopy and the falls...
//
// field10.ts calls installTrails() for every field scene once the V10 day loop is running.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { Interactable } from '../../world/npc';
import { Custom, Prop } from '../../world/props';
import { local } from '../assets';
import { packColor } from '../../gfx/renderer';
import type { Frame } from '../../gfx/renderer';
import { audio } from '../../core/audio';
import { location, isIsland, findLocation } from '../v10/regions';
import { ISLE_W } from '../v10/atlas';
import { currentExpedition, expeditionHour, goExpedition, isIslandScene, siteDef } from '../v10/expedition';
import { dayPhase, leaveCamp } from '../v10/day';
import { floatText, floatNotice } from '../../ui/v12/float';
import { passHours } from './hunger';
import type { HungerActivity } from './hunger';
import { GATES, gateOk } from './gear';
import type { GateId } from './gear';
import { paintSignpost, paintKeyHint } from './signpost';
import type { ArmSpec, ArmBox } from './signpost';
import { hourOfClock, LATE_HOUR } from './clock';

export type Arm = 'up' | 'down';
export type TrailKind = 'path' | 'climb' | 'swim' | 'wade' | 'dive' | 'tunnel';
/** one end of a trail: a scene ('loc') and where in it ('W' / 'E' edge, or a world x), and for a
 *  branch off the walk line at a signpost, which way the plank's chevron points */
export interface TrailEnd { loc: string; at: 'W' | 'E' | number; arm?: Arm }
export interface TrailDef {
  id: string;
  a: TrailEnd;
  b: TrailEnd;
  /** game hours on the trail */
  hours: number;
  kind: TrailKind;
  /** shut until the gear is made (only going deeper; the way home is always open) */
  gate?: GateId;
  /** Mori's line setting off deeper */
  say?: string;
}

const T = (id: string, a: TrailEnd, b: TrailEnd, hours: number, kind: TrailKind, o: { gate?: GateId; say?: string } = {}): TrailDef => ({ id, a, b, hours, kind, ...o });

/** the network (camp is on the beach: the island scene's locations are all depth 0) */
export const TRAILS: TrailDef[] = [
  // ---- from the beach
  T('beach-forest', { loc: 'isle-stream', at: 3918, arm: 'up' }, { loc: 'forest', at: 'W' }, 0.25, 'path', { say: 'Up the stream, into the trees. Te Wao Nui.' }),
  T('beach-mangrove', { loc: 'isle-stream', at: 3918, arm: 'down' }, { loc: 'mangrove', at: 'W' }, 0.75, 'wade', { gate: 'staff', say: 'The water’s getting darker. And warmer. I don’t love either of those things.' }),
  T('cave-grotto', { loc: 'isle-cave', at: 5250, arm: 'down' }, { loc: 'grotto', at: 'W' }, 0.25, 'swim', { gate: 'snorkel', say: 'There’s a current under the glowworms. It goes somewhere. Deep breath...' }),
  T('track-fernwood', { loc: 'isle-track', at: 'E' }, { loc: 'fernwood', at: 'W' }, 0.5, 'path', { say: 'The bush track just... keeps going. Into the ferns.' }),
  // ---- Te Wao Nui, the great forest: its ridge end splits
  T('forest-fernwood', { loc: 'forest', at: 'E', arm: 'up' }, { loc: 'fernwood', at: 'W', arm: 'up' }, 0.5, 'path', { say: 'Up over the ridge. The ferns on the other side are taller than the trees here.' }),
  T('forest-hills', { loc: 'forest', at: 'E' }, { loc: 'hills', at: 'W' }, 1, 'climb', { gate: 'grip', say: 'Up and out of the forest, onto the open tops.' }),
  // ---- Fernwood: the kauri and the stream
  T('fernwood-canopy', { loc: 'fernwood', at: 'E', arm: 'up' }, { loc: 'canopy', at: 'W' }, 0.75, 'climb', { gate: 'gloves', say: 'Okay. Don’t look down. Don’t look down. Don’t... I looked down.' }),
  T('fernwood-falls', { loc: 'fernwood', at: 'E' }, { loc: 'falls', at: 'W' }, 0.5, 'path', { say: 'Hear that? That’s not thunder. That’s water.' }),
  // ---- the falls
  T('falls-hills', { loc: 'falls', at: 620, arm: 'up' }, { loc: 'hills', at: 'W', arm: 'down' }, 0.75, 'climb', { gate: 'grip', say: 'Up through the last of the trees. There’s sky up there. A LOT of sky.' }),
  T('falls-fossils', { loc: 'falls', at: 'E' }, { loc: 'fossils', at: 'W' }, 1, 'climb', { gate: 'rope', say: 'The rock up here is striped like a cake. Every stripe is a million years.' }),
  T('hills-fossils', { loc: 'hills', at: 'E' }, { loc: 'fossils', at: 'E', arm: 'up' }, 0.75, 'climb', { gate: 'rope', say: 'Down the back of the ridge. Carefully. The gorge is right below us.' }),
  // ---- the canopy, the old pā, the village
  T('canopy-ruins', { loc: 'canopy', at: 'E' }, { loc: 'ruins', at: 'W' }, 0.75, 'climb', { say: 'Those are walls. Somebody built walls up here.' }),
  T('mangrove-village', { loc: 'mangrove', at: 'E' }, { loc: 'village', at: 'W' }, 0.75, 'wade', { say: 'Someone cut steps into this bank. People live up here.' }),
  T('village-ruins', { loc: 'village', at: 'E' }, { loc: 'ruins', at: 'E' }, 0.75, 'path', { gate: 'blessing', say: 'With Koro’s blessing, then. Up the old track.' }),
  T('ruins-unknown', { loc: 'ruins', at: 'E', arm: 'down' }, { loc: 'unknown', at: 'E' }, 1, 'tunnel', { gate: 'rope', say: 'Tie it off. Twice. Okay. Three times.' }),
  // ---- the deep interior
  T('fossils-glow', { loc: 'fossils', at: 'E' }, { loc: 'glowforest', at: 'W' }, 1, 'climb', { gate: 'lantern', say: 'It’s midday and it’s dark down there. And something down there is... glowing.' }),
  T('glow-geo', { loc: 'glowforest', at: 'E' }, { loc: 'geovalley', at: 'W' }, 1, 'path', { gate: 'boots', say: 'Smells like rotten eggs. Steam over the ridge. Oh no. Oh, yes.' }),
  T('geo-unknown', { loc: 'geovalley', at: 'E' }, { loc: 'unknown', at: 'W' }, 1, 'climb', { gate: 'lantern', say: 'There’s a hole in the world down there.' }),
  // ---- under the headland
  T('grotto-deep', { loc: 'grotto', at: 'E' }, { loc: 'deep', at: 'E' }, 0.25, 'dive', { gate: 'wetsuit', say: 'One... two... three...' }),
  T('deep-coast', { loc: 'deep', at: 'W' }, { loc: 'coast', at: 1520, arm: 'down' }, 0.25, 'swim', { say: 'Air. AIR. And... a beach I’ve never seen.' }),
];

/** short names painted on the planks */
const SIGN: Record<string, string> = {
  'isle-stream': 'THE BEACH', 'isle-cave': 'SEA CAVE', 'isle-track': 'BUSH TRACK', camp: 'CAMP',
  forest: 'TE WAO NUI', fernwood: 'FERNWOOD', canopy: 'THE CANOPY', falls: 'THE FALLS', hills: 'ROCKY HILLS',
  mangrove: 'MANGROVES', village: 'TE KĀINGA', ruins: 'THE OLD PĀ', fossils: 'BONE CLIFFS', glowforest: 'GLOW FOREST',
  geovalley: 'HOT VALLEY', unknown: 'KOROKORO', grotto: 'SEA GROTTO', deep: 'THE DEEP', coast: 'SERPENT COAST',
};
const VERB: Record<TrailKind, string> = { path: 'Walk to', climb: 'Climb to', swim: 'Swim to', wade: 'Wade to', dive: 'Dive to', tunnel: 'Rope down to' };
const ACT: Record<TrailKind, HungerActivity> = { path: 'walk', climb: 'climb', swim: 'swim', wade: 'wade', dive: 'swim', tunnel: 'climb' };

const placeName = (loc: string) => (isIsland(location(loc)) ? 'the beach' : location(loc)?.name ?? loc);
const hoursText = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h === 1 ? '1 hour' : `${h} hours`);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const other = (s: 'a' | 'b') => (s === 'a' ? 'b' : 'a');

// ---------------------------------------------------------------- depth from camp
let depthMap: Map<string, number> | null = null;
/** trails from the beach to a place (0 on the beach) */
export function depthOf(loc: string): number {
  if (!depthMap) {
    const d = new Map<string, number>();
    const q: string[] = [];
    for (const t of TRAILS) for (const e of [t.a, t.b]) if (isIsland(location(e.loc)) && !d.has(e.loc)) { d.set(e.loc, 0); q.push(e.loc); }
    while (q.length) {
      const cur = q.shift()!;
      for (const t of TRAILS) for (const [x, y] of [[t.a, t.b], [t.b, t.a]] as const) if (x.loc === cur && !d.has(y.loc)) { d.set(y.loc, d.get(cur)! + 1); q.push(y.loc); }
    }
    depthMap = d;
  }
  if (isIsland(location(loc))) return 0;
  return depthMap.get(loc) ?? 9;
}

/** the hour of day where Mori is now */
export function hourNow(f?: FieldScene | null): number {
  const s = (f ?? game.scene) as unknown as { clock?: { t: number } } | null;
  if (s && isIslandScene(s) && s.clock) return hourOfClock(s.clock.t);
  if (currentExpedition()) return expeditionHour();
  if (s?.clock) return hourOfClock(s.clock.t);
  return 12;
}

// ---------------------------------------------------------------- the scene's trail ends
interface EndRef { t: TrailDef; side: 'a' | 'b'; end: TrailEnd }
interface Junction { x: number; edge: 'W' | 'E' | null; ends: EndRef[]; sign: Prop | null; arms: ArmBox[]; armIts: Interactable[]; specs: (EndRef | { info: string; go: number; dir: 'left' | 'right' })[] }
interface SceneTrails {
  f: FieldScene;
  W: number;
  junctions: Junction[];
  edge: { W: EndRef | null; E: EndRef | null };
  /** the edge exits wait until Mori has walked away from an edge he arrived at */
  armed: { W: boolean; E: boolean };
  holdT: number;
  t: number;
  near: Junction | null;
  told: boolean;
}
const scenes = new WeakMap<FieldScene, SceneTrails>();

function endsIn(loc: string): EndRef[] {
  const out: EndRef[] = [];
  const island = loc === 'island';
  for (const t of TRAILS) for (const side of ['a', 'b'] as const) {
    const e = t[side];
    if (island ? isIsland(location(e.loc)) : e.loc === loc) out.push({ t, side, end: e });
  }
  return out;
}

/** the beach's own signposts (camp and the crossroads), with planks along the walk too */
const ISLAND_INFO: { x: number; arms: { info: string; go: number; dir: 'left' | 'right' }[] }[] = [
  { x: 2420, arms: [{ info: 'THE WRECK', go: 900, dir: 'left' }, { info: 'STREAM MOUTH', go: 3860, dir: 'right' }, { info: 'SEA CAVE', go: 5200, dir: 'right' }] },
  { x: 3918, arms: [{ info: 'CAMP', go: 2300, dir: 'left' }, { info: 'SEAL ROCKS', go: 4330, dir: 'right' }] },
  { x: 5250, arms: [{ info: 'CAMP', go: 2300, dir: 'left' }] },
];

/** a sign's frames are painted per scene (the local atlas is rebuilt on every scene change) */
let hintUp: Frame | null = null, hintDown: Frame | null = null, hintOwner: unknown = null;
function hints() {
  if (hintOwner !== local) { hintOwner = local; hintUp = local.add('v12:hintUp', paintKeyHint('up'), 5, 5); hintDown = local.add('v12:hintDown', paintKeyHint('down'), 5, 5); }
  return { up: hintUp!, down: hintDown! };
}

/** the scene's trails: signposts, the edge exits, the branches (and the arrival, if Mori is walking in) */
export function installTrails(f: FieldScene, loc: string | 'island') {
  const W = loc === 'island' ? ISLE_W : f.site.width;
  const ends = endsIn(loc);
  const S: SceneTrails = { f, W, junctions: [], edge: { W: null, E: null }, armed: { W: true, E: true }, holdT: 0, t: 0, near: null, told: false };
  scenes.set(f, S);
  // ---- junctions: the two edges, and numeric ends grouped within 200 px
  const byKey = new Map<string, Junction>();
  const jn = (x: number, edge: 'W' | 'E' | null): Junction => ({ x, edge, ends: [], sign: null, arms: [], armIts: [], specs: [] });
  for (const r of ends) {
    if (r.end.at === 'W' || r.end.at === 'E') {
      const k = r.end.at;
      if (!r.end.arm) S.edge[k] = r;
      if (!byKey.has(k)) byKey.set(k, jn(k === 'W' ? 120 : W - 120, k));
      byKey.get(k)!.ends.push(r);
    } else {
      const x = r.end.at;
      let j = [...byKey.values()].find(q => !q.edge && Math.abs(q.x - x) < 200);
      if (!j) { j = jn(x, null); byKey.set('x' + x, j); }
      j.ends.push(r);
    }
  }
  if (loc === 'island') for (const s of ISLAND_INFO) {
    let j = [...byKey.values()].find(q => !q.edge && Math.abs(q.x - s.x) < 200);
    if (!j) { j = jn(s.x, null); byKey.set('i' + s.x, j); }
    j.x = s.x;
    for (const a of s.arms) j.specs.push(a);
  }
  S.junctions = [...byKey.values()];
  // ---- the forest walks itself out at its west end (its story calls walkOutEdge)
  const ownWest = 'onWalkOut' in f;
  if (ownWest && S.edge.W) S.armed.W = false;
  // ---- signposts
  const under = !!f.site.underwater;
  S.junctions.forEach((j, i) => buildSign(S, j, i, under));
  // ---- per frame
  f.main.add(new Custom(62, rr => drawHints(S, rr), dt => update(S, dt, ownWest)));
  // ---- the old exits go: no "head back to camp" from anywhere a trail leads home
  if (ends.length) f.interact = f.interact.filter(it => it.label !== 'Head back to camp');
  // ---- walking in?
  arrive(S, loc);
}

function armSpecFor(S: SceneTrails, j: Junction, r: EndRef): ArmSpec {
  const to = r.t[other(r.side)];
  const deeper = depthOf(to.loc) > depthOf(r.end.loc);
  const shut = deeper && !gateOk(r.t.gate);
  const dir: 'left' | 'right' = r.end.arm ? (j.x < S.W / 2 ? 'right' : 'left') : r.end.at === 'W' ? 'left' : 'right';
  return { text: SIGN[to.loc] ?? (location(to.loc)?.name ?? to.loc).toUpperCase(), dir, mark: r.end.arm, lock: shut && r.t.gate ? GATES[r.t.gate].icon : null };
}

function buildSign(S: SceneTrails, j: Junction, i: number, under: boolean) {
  const f = S.f;
  // planks: up branches, the edge / walk planks, down branches
  const ups = j.ends.filter(r => r.end.arm === 'up'), downs = j.ends.filter(r => r.end.arm === 'down'), edges = j.ends.filter(r => !r.end.arm);
  const info = j.specs.filter((s): s is { info: string; go: number; dir: 'left' | 'right' } => 'info' in s);
  const order: Junction['specs'] = [...ups, ...edges, ...info, ...downs];
  j.specs = order;
  if (under || !order.length) return;
  const specs: ArmSpec[] = order.map(s => ('info' in s ? { text: s.info, dir: s.dir } : armSpecFor(S, j, s)));
  const key = `v12sign:${f.site.id}:${i}:` + specs.map(s => `${s.text}${s.dir}${s.mark ?? ''}${s.lock ?? ''}`).join('|');
  const art = paintSignpost(specs, Math.round(j.x));
  const fr = local.add(key, art.buf, art.ax, art.ay);
  const gy = groundAt(f, j.x);
  const prop = new Prop(fr, j.x, gy + 1, -2.2);
  f.main.add(prop);
  j.sign = prop;
  j.arms = art.arms;
  // click a plank to take it (the post itself reads the sign)
  order.forEach((s, k) => {
    const b = art.arms[k];
    const x0 = j.x + b.x0, x1 = j.x + b.x1, y1 = gy + 1 + b.y1;
    const it: Interactable = {
      x: (x0 + x1) / 2, y: y1 - 5, w: Math.max(6, (x1 - x0) / 2 - 4), h: 0,
      get label() { return 'info' in s ? `Along the beach to ${s.info.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}` : armLabel(s); },
      standX: j.x + ((x0 + x1) / 2 < j.x ? -14 : 14),
      action: () => ('info' in s ? walkAlong(f, s.go) : takeTrail(f, s.t, s.side)),
    };
    j.armIts.push(it);
    f.interact.push(it);
  });
  f.interact.push({
    x: j.x, y: gy, w: 10, h: 26, standX: j.x - 12,
    label: 'Read the signpost',
    action: () => readSign(S, j),
  } as Interactable);
}

function armLabel(r: EndRef): string {
  const to = r.t[other(r.side)];
  const deeper = depthOf(to.loc) > depthOf(r.end.loc);
  const shut = deeper && r.t.gate && !gateOk(r.t.gate) ? ` <span style="opacity:.75">(needs ${GATES[r.t.gate].gear})</span>` : '';
  return `${VERB[r.t.kind]} ${placeName(to.loc)} <span style="opacity:.75">· ${hoursText(r.t.hours)}</span>${shut}`;
}

function readSign(S: SceneTrails, j: Junction) {
  const parts: string[] = [];
  for (const s of j.specs) {
    if ('info' in s) { parts.push(`${s.dir === 'left' ? 'West' : 'East'}: ${s.info.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`); continue; }
    const to = s.t[other(s.side)];
    const way = s.end.arm === 'up' ? 'Up' : s.end.arm === 'down' ? 'Down' : s.end.at === 'W' ? 'West' : 'East';
    const deeper = depthOf(to.loc) > depthOf(s.end.loc);
    const shut = deeper && s.t.gate && !gateOk(s.t.gate) ? ` (needs ${GATES[s.t.gate].gear})` : '';
    parts.push(`${way}: ${placeName(to.loc)}, ${hoursText(s.t.hours)}${shut}`);
  }
  audio.play('woodCreak', { vol: 0.25, pitch: 1.4 });
  parts.forEach((p, i) => setTimeout(() => void floatText({ x: j.x, y: groundAt(S.f, j.x) - 90 - i * 2, text: p, style: 'say', ms: 3000 }), i * 900));
}

function groundAt(f: FieldScene, x: number) { return f.st.terrain.surfaceBelow(x, -400)?.y ?? f.st.terrain.groundY(x); }

/** an info plank on the beach: Mori just walks that way */
function walkAlong(f: FieldScene, x: number) {
  const p = f.player;
  void p.walkTo(Math.max(p.minX, Math.min(p.maxX, x)), 60).catch(() => {});
}

// ---------------------------------------------------------------- per frame
function update(S: SceneTrails, dt: number, ownWest: boolean) {
  const f = S.f, p = f.player;
  S.t += dt;
  if (game.scene !== f) return;
  // re-arm an edge once Mori has walked away from it
  if (!S.armed.W && p.x > 70 && !(ownWest && S.edge.W)) S.armed.W = true;
  if (!S.armed.E && p.x < S.W - 70) S.armed.E = true;
  const free = !f.cutscene && !game.ui.blocking && !busy && (p.state === 'normal' || p.underwater);
  // the nearest signpost with branches
  S.near = null;
  if (free && p.onGround) for (const j of S.junctions) if (Math.abs(p.x - j.x) < 30 && j.specs.length) { S.near = j; break; }
  if (!free) { S.holdT = 0; return; }
  // pick a branch at a signpost: up / down
  if (S.near && !f.cam?.active) {
    const inp = game.input;
    const want: Arm | null = inp.hit('up') ? 'up' : inp.hit('down') ? 'down' : null;
    if (want) {
      const r = S.near.specs.find((s): s is EndRef => !('info' in s) && s.end.arm === want);
      if (r) { void takeTrail(f, r.t, r.side); return; }
    }
    if (!S.told && !game.save.flags['v12:signTip'] && S.near.specs.some(s => !('info' in s) && !!s.end.arm)) {
      S.told = true;
      game.save.flags['v12:signTip'] = true;
      readSign(S, S.near);
    }
  }
  // walk off an edge: hold the direction at the very edge for a moment
  const ax = game.input.axisX();
  const atW = S.edge.W && S.armed.W && p.x <= p.minX + 3 && ax < 0;
  const atE = S.edge.E && S.armed.E && p.x >= p.maxX - 3 && ax > 0;
  if (atW || atE) {
    S.holdT += dt;
    if (S.holdT > 0.25) { S.holdT = 0; const r = (atW ? S.edge.W : S.edge.E)!; void takeTrail(f, r.t, r.side); }
  } else S.holdT = 0;
}

/** key hints by the branch planks while Mori stands at a post, a glow on the plank under the mouse */
function drawHints(S: SceneTrails, rr: import('../../gfx/renderer').Renderer) {
  const f = S.f;
  for (const j of S.junctions) {
    if (!j.sign) continue;
    const gy = j.sign.y;
    j.armIts.forEach((it, k) => {
      const b = j.arms[k];
      if (f.hovered === it) {
        const c = packColor(1, 0.92, 0.6, 0.9);
        rr.fxRect(j.x + b.x0 - 1, gy + b.y0 - 1, b.x1 - b.x0 + 2, 1, c);
        rr.fxRect(j.x + b.x0 - 1, gy + b.y1, b.x1 - b.x0 + 2, 1, c);
        rr.fxRect(j.x + b.x0 - 1, gy + b.y0, 1, b.y1 - b.y0, c);
        rr.fxRect(j.x + b.x1, gy + b.y0, 1, b.y1 - b.y0, c);
      }
    });
    if (S.near !== j) continue;
    const h = hints();
    j.specs.forEach((s, k) => {
      if ('info' in s || !s.end.arm) return;
      const b = j.arms[k];
      if (!b) return;
      const right = b.x1 > 0 && Math.abs(b.x1) >= Math.abs(b.x0);
      const bob = Math.round(Math.sin(S.t * 5 + k) * 1.5);
      const x = right ? j.x + b.x1 + 8 : j.x + b.x0 - 8;
      rr.fxDraw(s.end.arm === 'up' ? h.up : h.down, x, gy + (b.y0 + b.y1) / 2 + bob, 1, 1, 0, packColor(1, 1, 1, 1), 1, false);
    });
  }
}

// ---------------------------------------------------------------- taking a trail
let busy = false;
let pend: { loc: string; end: TrailEnd; from: string; t: TrailDef } | null = null;

/** the forest's walk-out at its west end (the story hands it here once the day loop runs) */
export async function walkOutEdge(f: FieldScene, side: 'W' | 'E'): Promise<boolean> {
  const S = scenes.get(f);
  const r = S?.edge[side];
  if (!r) return false;
  await takeTrail(f, r.t, r.side);
  return true;
}

function refuse(f: FieldScene, line: string) {
  const p = f.player;
  audio.play('wrong', { vol: 0.4 });
  p.body.setExpr('thinking', 2);
  p.body.showEmote('question', 1.4);
  void floatText({ text: line, style: 'think', ms: 3200 });
  // a step back from the edge so he doesn't walk straight into it again
  const W = f.site.width;
  if (p.x < 40) void p.walkTo(64, 50).catch(() => {});
  else if (p.x > W - 40) void p.walkTo(W - 64, 50).catch(() => {});
}

/** set off along a trail from end `side` (gates, the walk off, the fade, the hours, the next scene) */
export async function takeTrail(f: FieldScene, t: TrailDef, side: 'a' | 'b'): Promise<void> {
  if (busy || f.cutscene || game.ui.blocking) return;
  const here = t[side], there = t[other(side)];
  const deeper = depthOf(there.loc) > depthOf(here.loc);
  if (deeper) {
    if (t.gate && !gateOk(t.gate)) { refuse(f, GATES[t.gate].why); return; }
    if (hourNow(f) >= LATE_HOUR) { refuse(f, hourNow(f) >= 18.5 ? 'It’s getting dark. Camp. Now.' : 'The sun’s getting low. Not today: I need to be home before dark.'); return; }
    // the first time over a cliff or under the water is a tricky moment (a QTE); after that he knows the way
    const hard = t.kind === 'climb' || t.kind === 'tunnel' || t.kind === 'swim' || t.kind === 'dive';
    if (hard && !game.save.flags['v12:crossed:' + t.id]) {
      const climb = t.kind === 'climb' || t.kind === 'tunnel';
      const { qte } = await import('./qte');
      const res = await qte({ kind: climb ? 'seq' : 'hold', f, label: climb ? 'FIND THE HOLDS!' : 'DEEP BREATH...', difficulty: Math.min(0.9, 0.3 + depthOf(there.loc) * 0.1), count: climb ? 3 + Math.min(2, depthOf(there.loc) - 1) : undefined });
      if (!res.ok) { refuse(f, climb ? 'Whoa! Nope. My foot slipped. Again, slower.' : 'Pfaah! Not enough air. Breathe, and try again.'); return; }
      game.save.flags['v12:crossed:' + t.id] = true;
    }
  }
  const L = location(there.loc);
  if (!L) return;
  busy = true;
  f.cutscene = true;
  const p = f.player;
  const W = f.site.width;
  try {
    f.cam?.raise(false);
    if (deeper && t.say) void floatText({ text: t.say, style: 'say', ms: 2600 });
    // the day starts properly the moment Mori sets off along a trail
    if (dayPhase() === 'morning') leaveCamp(there.loc);
    // walk off: over the edge, or into the branch at the post
    if (here.at === 'W' && !here.arm) { p.minX = -80; await Promise.race([p.walkTo(-28, 60), sleep(2400)]); }
    else if (here.at === 'E' && !here.arm) { p.maxX = W + 80; await Promise.race([p.walkTo(W + 28, 60), sleep(2400)]); }
    else {
      const j = scenes.get(f)?.junctions.find(q => q.ends.some(r => r.t === t));
      const sx = j?.x ?? p.x;
      await Promise.race([p.walkTo(sx + (p.x < sx ? -6 : 6), 60), sleep(1800)]);
      const fade = (async () => { for (let k = 0; k < 10; k++) { p.alpha = 1 - k / 10; await sleep(45); } })();
      await Promise.race([p.walkTo(sx + (here.arm === 'up' ? 14 : -14) * (j && j.x < W / 2 ? 1 : -1), 40), sleep(700)]);
      await fade;
    }
    audio.play(t.kind === 'swim' || t.kind === 'dive' || t.kind === 'wade' ? 'splash' : 'rustle', { vol: 0.35 });
    game.r.post.fadeColor = [0, 0, 0];
    await game.fadeTo(1, 3.2);
    // the trail: its hours, and Mori's stomach
    passHours(t.hours, ACT[t.kind]);
    const startHour = isIslandScene(f) ? hourNow(f) : undefined;
    pend = { loc: there.loc, end: there, from: here.loc, t };
    const at = await arrivalX(there);
    await goExpedition(there.loc, { at, hours: t.hours, from: here.loc, startHour, style: 'walk' });
  } catch (e) {
    console.error('[trails] takeTrail', e);
    pend = null;
  } finally {
    busy = false;
    if (game.scene === f) {
      f.cutscene = false;
      p.alpha = 1;
      p.minX = 12;
      p.maxX = W - 12;
      if (game.r.post.fade > 0.5) void game.fadeTo(0, 2);
    }
  }
}

/** world x Mori arrives at for a trail end */
async function arrivalX(e: TrailEnd): Promise<number> {
  if (typeof e.at === 'number') return e.at;
  const W = await sceneWidth(e.loc);
  return e.at === 'W' ? 24 : W - 24;
}
async function sceneWidth(loc: string): Promise<number> {
  const L = location(loc);
  if (!L) return 2400;
  if (L.scene.type === 'island') return ISLE_W;
  if (L.scene.type === 'custom') return loc === 'forest' ? (await import('../v11/forest/layout')).FOREST.W : 2400;
  const def = await siteDef(L.scene.type === 'ocean' ? 'deep' : L.scene.site);
  return def?.width ?? 2400;
}

/** the new scene is up: Mori walks in from the edge (or out of the branch) he came along */
function arrive(S: SceneTrails, loc: string) {
  const a = pend;
  if (!a) return;
  const here = loc === 'island' ? isIsland(location(a.loc)) : a.loc === loc;
  if (!here) return;
  pend = null;
  const f = S.f, p = f.player, e = a.end;
  const W = S.W;
  f.cutscene = true;
  if (e.at === 'W' && !e.arm) { S.armed.W = false; p.x = 14; p.facing = 1; }
  else if (e.at === 'E' && !e.arm) { S.armed.E = false; p.x = W - 14; p.facing = -1; }
  else {
    const j = S.junctions.find(q => q.ends.some(r => r.t === a.t));
    p.x = j?.x ?? (typeof e.at === 'number' ? e.at : p.x);
    p.facing = p.x < W / 2 ? 1 : -1;
    p.alpha = 0;
    if (e.at === 'W') S.armed.W = false;
    if (e.at === 'E') S.armed.E = false;
  }
  p.y = groundAt(f, p.x);
  f.snapCamera();
  void (async () => {
    try {
      await sleep(250);
      const to = e.at === 'W' && !e.arm ? 92 : e.at === 'E' && !e.arm ? W - 92 : p.x + p.facing * 26;
      const fade = (async () => { for (let k = 0; k <= 10; k++) { p.alpha = Math.max(p.alpha, k / 10); await sleep(40); } })();
      await Promise.race([p.walkTo(to, 56), sleep(2600)]);
      await fade;
    } finally {
      p.alpha = 1;
      if (game.scene === f) f.cutscene = false;
    }
    // where we are
    const L = location(a.loc);
    if (L && !isIsland(L)) {
      findLocation(L.id);
      const k = 'v12:been:' + L.id, first = !game.save.flags[k];
      game.save.flags[k] = true;
      floatNotice(first ? `${L.name}${L.sub ? ` · ${L.sub}` : ''}: somewhere new!` : `${L.name}${L.sub ? ` · ${L.sub}` : ''}`, 3200);
    } else floatNotice('Back on the beach. Camp is west along the sand.', 3000);
  })();
}

/** debug handle: zl.trails */
export const TRAILS_ZL = { list: () => TRAILS.map(t => `${t.id}: ${t.a.loc}@${t.a.at}${t.a.arm ?? ''} <-> ${t.b.loc}@${t.b.at}${t.b.arm ?? ''} ${t.hours}h${t.gate ? ' [' + t.gate + (gateOk(t.gate) ? ' ok' : ' shut') + ']' : ''}`), depth: depthOf };
