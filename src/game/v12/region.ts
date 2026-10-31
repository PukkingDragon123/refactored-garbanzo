// V12 big regions: several neighbouring places played as ONE continuous side-scrolling map. A region
// is a scene (its location id is the scene's tag) whose world x runs through its parts end to end; each
// part keeps its own location id (the map, the notebook, finds, rare animals, quests and saves all still
// speak of 'fernwood' or 'falls') with its own local x, so (loc, x) <-> region world x is just an offset.
// The trails between the parts are gone: you walk them. The trails out of the region stay (trails.ts).
//
//   Te Wao Nui, the great forest (one map, 13,700 px, about an hour and a half of walking end to end):
//
//   UPPER      [fallen kauri]                                   [the high limb]      [the auk ledges]
//               1490-2020                                          9620-9960         12200-13690
//   MAIN   beach ═ edge ═ ford ═ giants ═ wallows ═ (bridge) ═ grove ═ ridge ╬ over the ridge ═ fern grove ═ (bridge) ═ mamaku ═ kauri ╬ river bush ╬ FALLS ═ cliff shore ═> gorge
//   LOWER                                     [Te Kōawa creek]                       [the frog pool]                       ╵
//                                               3260-3680                              7790-8210                     the goat track
//
// This module is plain data (no game imports) so anything can ask where a place is.

export interface RegionPart {
  /** the location id of this stretch */
  loc: string;
  /** where it starts in the region's world x */
  x0: number;
  /** its own length (its local x runs 0..w) */
  w: number;
}
export interface RegionDef {
  /** the scene's location id (its tag) */
  scene: string;
  W: number;
  parts: RegionPart[];
}

/** Te Wao Nui + Fernwood Floor + Thunder Falls */
export const FOREST_REGION: RegionDef = {
  scene: 'forest',
  W: 13700,
  parts: [
    { loc: 'forest', x0: 0, w: 6000 },
    { loc: 'fernwood', x0: 6000, w: 4400 },
    { loc: 'falls', x0: 10400, w: 3300 },
  ],
};
export const REGIONS: RegionDef[] = [FOREST_REGION];

/** the region a location is played in (and its stretch), or null for a place with its own scene */
export function regionOf(loc: string | null | undefined): { r: RegionDef; part: RegionPart } | null {
  if (!loc) return null;
  for (const r of REGIONS) for (const part of r.parts) if (part.loc === loc) return { r, part };
  return null;
}
/** the region played by a scene tagged `scene` */
export const regionByScene = (scene: string | null | undefined): RegionDef | null => REGIONS.find(r => r.scene === scene) ?? null;
/** the scene a location is played in ('fernwood' -> 'forest'; anything else: itself) */
export const sceneLocOf = (loc: string): string => regionOf(loc)?.r.scene ?? loc;
/** the stretches a scene plays ([{ loc: scene, x0: 0 }] for an ordinary scene) */
export function partsOf(scene: string | null | undefined, w = 0): RegionPart[] {
  const r = regionByScene(scene);
  return r ? r.parts : scene ? [{ loc: scene, x0: 0, w }] : [];
}
/** the stretch of a region scene at world x */
export function partAt(r: RegionDef, x: number): RegionPart {
  for (const p of r.parts) if (x < p.x0 + p.w) return p;
  return r.parts[r.parts.length - 1];
}
/** a location's local x -> its scene's world x */
export const toWorld = (loc: string, x: number): number => (regionOf(loc)?.part.x0 ?? 0) + x;
/** a scene's world x -> the location there and its local x */
export function toLocal(scene: string, x: number): { loc: string; x: number } {
  const r = regionByScene(scene);
  if (!r) return { loc: scene, x };
  const p = partAt(r, x);
  return { loc: p.loc, x: x - p.x0 };
}
/** two locations played in the same region scene */
export const sameRegion = (a: string, b: string) => { const ra = regionOf(a), rb = regionOf(b); return !!ra && ra.r === rb?.r; };
