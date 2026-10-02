// V10 map travel: checkpoints on the Region Map and the trips between them. A checkpoint is a found
// place, or a way on Mori has seen (the junction where a route leaves a scene, e.g. the foot of the
// giant kauri at the end of the Fernwood Floor). From camp a trip goes out along the known trail
// (regions.ts tripCost: a known way is quicker than finding it); on an expedition Mori can also
// move between checkpoints along the trails he knows, paying the same way (or head home). The map
// draws the route a trip takes (routePath) and animates a little walker along it.
//
// Targets are written 'loc' or 'loc@x' (a junction: arrive in loc's scene at world x).

import { game } from '../game';
import { location, routeChain, tripCost, isIsland, isFound, mapPoint, islandLocAt, xRange, seenBins, BINS, LOCATIONS } from './regions';
import type { Leg, LocationDef } from './regions';
import type { RouteDef } from './atlas';
import { MAP_W, MAP_H } from './atlas';
import { currentExpedition, expeditionHour, goExpedition, passTime, returnToCamp, effortSpend, CAMP_X } from './expedition';
import { energy } from './energy';

export interface Target { loc: string; at?: number }
export const parseTarget = (s: string): Target => { const [loc, at] = s.split('@'); return at !== undefined && at !== '' ? { loc, at: +at } : { loc }; };
export const targetId = (t: Target) => (t.at !== undefined ? `${t.loc}@${Math.round(t.at)}` : t.loc);

/** a way on that Mori has seen (its junction is a checkpoint) */
export interface Junction { from: string; to: string; route: RouteDef; known: boolean }
/** every junction he knows of: the way was travelled, or he has stood where it starts */
export function junctions(): Junction[] {
  const out: Junction[] = [];
  for (const T of LOCATIONS) for (const r of T.routes ?? []) {
    const F = location(r.from);
    if (!F || !isFound(F.id)) continue;
    const [a, b] = xRange(F);
    const bin = Math.max(0, Math.min(BINS - 1, Math.floor(((r.at - a) / (b - a)) * BINS)));
    const bins = seenBins(F.id);
    const near = bins[bin] || bins[Math.max(0, bin - 1)] || bins[Math.min(BINS - 1, bin + 1)];
    if (isFound(T.id) || near) out.push({ from: F.id, to: T.id, route: r, known: isFound(T.id) });
  }
  return out;
}

export interface TripCost { hours: number; energy: number }
const walkCost = (d: number): TripCost => ({ hours: Math.round((d / 2400) * 4) / 4, energy: Math.round(d / 950) });
const sumLegs = (legs: Leg[]) => ({ h: legs.reduce((a, g) => a + g.route.hours, 0), e: legs.reduce((a, g) => a + g.route.energy, 0) });
const roundTrip = (h: number, e: number): TripCost => ({ hours: Math.max(0.5, Math.round(h * 2) / 2), energy: Math.round(e) });
const sameLeg = (a: Leg, b: Leg) => a.from === b.from && a.to === b.to;

/** what a trip costs. From camp: the regions trip cost. From somewhere else: back along the trail to
 *  where the two ways part, then on (legs at the known-trail rate, plus any walk along the beach). */
export function tripTo(t: Target, from: { loc: string; x: number } | null = null): TripCost | null {
  const L = location(t.loc);
  if (!L) return null;
  if (!from || (from.loc === 'camp' && currentExpedition() === null)) {
    // (what goExpedition spends: a junction costs the same as its place)
    const c = tripCost(t.loc);
    return c ? { hours: c.hours, energy: c.energy } : null;
  }
  const F = location(from.loc);
  if (!F) return null;
  const A = isIsland(F) ? [] : routeChain(from.loc, false);
  const Bc = isIsland(L) ? [] : routeChain(t.loc);
  if (!A || !Bc) return null;
  let k = 0;
  while (k < A.length && k < Bc.length && sameLeg(A[k], Bc[k])) k++;
  const up = A.slice(k), down = Bc.slice(k);
  const s1 = sumLegs(up), s2 = sumLegs(down);
  let h = (s1.h + s2.h) * 0.7, e = (s1.e + s2.e) * 0.35;
  if (k === 0) {
    // the trip crosses the home island: walk the beach between the two trailheads
    const xa = up.length ? up[0].route.at : isIsland(F) ? from.x : CAMP_X;
    const xb = down.length ? down[0].route.at : isIsland(L) ? t.at ?? (L.scene as { x: number }).x : CAMP_X;
    const w = walkCost(Math.abs(xa - xb));
    h += w.hours; e += w.energy;
  }
  if (from.loc === t.loc) { const d = Math.abs((t.at ?? xRange(L)[0]) - from.x); const w = walkCost(d * 0.6); h = w.hours; e = w.energy; }
  return roundTrip(h, e);
}
/** energy needed in hand to set off (the trip and a little in reserve) */
export const tripNeed = (c: TripCost) => c.energy + 4;

// ------------------------------------------------------------------ the route on the map
type Pt = [number, number];
const toPx = ([u, v]: [number, number]): Pt => [u * MAP_W, v * MAP_H];
/** a stretch walked inside one scene (the island counts as one long scene) */
function within(loc: string, x0: number, x1: number, out: Pt[]) {
  const L = location(loc);
  if (!L) return;
  const isle = isIsland(L);
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / (isle ? 160 : 200)));
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    out.push(toPx(isle ? mapPoint(islandLocAt(x), x) : mapPoint(loc, x)));
  }
}
const entryX = (leg: Leg) => leg.route.enter ?? xRange(location(leg.to)!)[0];
const arriveX = (L: LocationDef) => (L.scene.type === 'island' ? L.scene.x : xRange(L)[0]);

export interface RoutePath { pts: Pt[]; sea: boolean }
/** the way a trip goes, in map pixels: along the trails Mori knows, or the Kitten's sea lane */
export function routePath(t: Target, from: { loc: string; x: number } | null, lanes: Record<string, Pt[]>): RoutePath | null {
  const L = location(t.loc);
  if (!L) return null;
  if (L.trip) {
    const lane = lanes[t.loc];
    return lane ? { pts: lane.map(p => [p[0], p[1]] as Pt), sea: true } : { pts: [toPx(mapPoint('camp', CAMP_X)), toPx(L.pos)], sea: true };
  }
  const start = from ?? { loc: 'camp', x: CAMP_X };
  const F = location(start.loc);
  if (!F) return null;
  const A = isIsland(F) ? [] : routeChain(start.loc, false) ?? [];
  const Bc = isIsland(L) ? [] : routeChain(t.loc) ?? [];
  let k = 0;
  while (k < A.length && k < Bc.length && sameLeg(A[k], Bc[k])) k++;
  const up = A.slice(k), down = Bc.slice(k);
  const pts: Pt[] = [];
  // back out of where Mori is
  let curLoc = start.loc, curX = start.x;
  for (let j = up.length - 1; j >= 0; j--) {
    const g = up[j];
    within(curLoc, curX, entryX(g), pts);
    curLoc = g.from; curX = g.route.at;
  }
  // (across the beach) and on
  for (const g of down) {
    within(curLoc, curX, g.route.at, pts);
    curLoc = g.to; curX = entryX(g);
  }
  const endX = t.at ?? (curLoc === t.loc && down.length ? curX : arriveX(L));
  within(curLoc === t.loc || isIsland(L) ? curLoc : t.loc, curX, endX, pts);
  if (!t.at && !isIsland(L)) pts.push(toPx(L.pos));
  // drop repeats
  const out: Pt[] = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.6) out.push(p); }
  return out.length >= 2 ? { pts: out, sea: false } : null;
}

// ------------------------------------------------------------------ going
/** on an expedition: travel to another checkpoint (or head home) along the known trails */
export async function travelOn(from: { loc: string; x: number }, target: string): Promise<void> {
  const t = parseTarget(target);
  if (t.loc === 'camp') { await returnToCamp('walk'); return; }
  const c = tripTo(t, from);
  if (!c) return;
  if (energy() < tripNeed(c)) { game.ui.toast('Too tired for that trip.', 'ENERGY', 'coral', 2400); return; }
  if (c.energy > 0) effortSpend(c.energy, 'travel');
  passTime(c.hours);
  await goExpedition(t.loc, t.at !== undefined ? { at: t.at } : {});
}
/** the clock after a trip of `hours` (camp's departure hour, or the expedition clock) */
export function arrivalHour(hours: number): number {
  const h = currentExpedition() ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
  return h + hours;
}
