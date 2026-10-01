// V10 region atlas data: every location of the expedition map, where its scene runs on the map,
// how it is reached ("go deeper" from a shallower place) and the map's fixed geography (the coast).
// Plain data only (regions.ts registers it); map coordinates are 0..1 of the map (3:2, north up).

import type { LocationDef } from './regions';

/** map size in map pixels (the pixel-art map is painted at this resolution) */
export const MAP_W = 960, MAP_H = 640;
const P = (x: number, y: number): [number, number] => [x / MAP_W, y / MAP_H];
const PATH = (...pts: [number, number][]) => pts.map(([x, y]) => P(x, y));

/** the home island scene's width (src/art/island4/layout.ts ISL.W) */
export const ISLE_W = 6900;

/** where a location's scene is reached from, and what the way costs */
export interface RouteDef {
  /** location the way starts from */
  from: string;
  /** world x of the way out in that scene (its far end, or a side route) */
  at: number;
  /** world x the player arrives at in this scene */
  enter?: number;
  /** prompt over the way out, e.g. 'Climb the giant kauri' */
  label: string;
  /** the walk / climb / swim: hours and energy */
  hours: number;
  energy: number;
  /** what the route is like, for the card and the map line */
  kind: 'walk' | 'climb' | 'swim' | 'wade' | 'dive' | 'tunnel';
  /** an item the way needs (e.g. rope to get down a collapsed stair) */
  needs?: { item: string; n: number; why: string };
  /** a line Mori or Aroha says on the way */
  say?: string;
}

/** map extension of a location (the contract's LocationDef carries these optional fields) */
export interface AtlasLoc extends LocationDef {
  sub?: string;
  /** the walk through the scene on the map; world x runs along it (knots: world x of each point) */
  path: [number, number][];
  knots?: number[];
  /** the world x range the path covers */
  xr: [number, number];
  /** ways in */
  routes?: RouteDef[];
  /** known from the start (camp, the wreck) */
  known?: boolean;
  /** shown as '???' until found */
  secret?: boolean;
  /** rough terrain words for the card */
  terrain: string;
  /** spawn x when fast-travelling here */
  arriveX?: number;
}

const ISLAND_KNOTS: [number, [number, number]][] = [
  [0, [78, 106]], [420, [98, 110]], [1400, [148, 113]], [2600, [204, 111]], [3300, [232, 107]], [4000, [262, 109]],
  [4700, [292, 113]], [5050, [306, 115]], [5450, [322, 117]], [5900, [344, 118]], [6260, [358, 134]], [6900, [376, 158]],
];
/** the home shore's knots between world x0..x1 (inclusive ends interpolated) */
function shore(x0: number, x1: number): { path: [number, number][]; knots: number[] } {
  const at = (x: number): [number, number] => {
    for (let i = 1; i < ISLAND_KNOTS.length; i++) {
      const [ax, a] = ISLAND_KNOTS[i - 1], [bx, b] = ISLAND_KNOTS[i];
      if (x <= bx) { const t = (x - ax) / (bx - ax); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    }
    return ISLAND_KNOTS[ISLAND_KNOTS.length - 1][1];
  };
  const xs = [x0, ...ISLAND_KNOTS.map(k => k[0]).filter(x => x > x0 && x < x1), x1];
  return { path: xs.map(x => P(...at(x))), knots: xs };
}

export const ATLAS: AtlasLoc[] = [
  // ------------------------------------------------------------ home: the island shore (one long scene)
  {
    id: 'camp', name: 'Kittiwake Camp', sub: 'Te Puni', region: 'home', kind: 'camp', pos: P(176, 112),
    scene: { type: 'island', x: 1980 }, difficulty: 0, known: true, xr: [1400, 2600], ...shore(1400, 2600),
    desc: 'Our camp on the landing beach: the tent, the fire, Jenna’s string lights and the research table.', terrain: 'Sand, driftwood',
  },
  {
    id: 'isle-wreck', name: 'The Wreck', sub: 'West Point', region: 'home', kind: 'site', pos: P(110, 110),
    scene: { type: 'island', x: 900 }, difficulty: 1, known: true, xr: [0, 1400], ...shore(0, 1400),
    desc: 'What is left of the Kittiwake, and the tide pools on the west rocks.', terrain: 'Rock shelf, wet sand',
  },
  {
    id: 'isle-grove', name: 'Palm Grove', sub: 'Te Uru Nīkau', region: 'home', kind: 'site', pos: P(218, 109),
    scene: { type: 'island', x: 2950 }, difficulty: 1, xr: [2600, 3300], ...shore(2600, 3300),
    desc: 'Nīkau palms and tide pools just east of camp. Butterflies, crabs and goldcurrants.', terrain: 'Sand, palm shade',
  },
  {
    id: 'isle-stream', name: 'Stream Mouth', sub: 'Te Ngutu Awa', region: 'home', kind: 'site', pos: P(248, 108),
    scene: { type: 'island', x: 3700 }, difficulty: 1, xr: [3300, 4000], ...shore(3300, 4000),
    desc: 'Where the stream fans out over the sand. Its water comes from somewhere deep inland.', terrain: 'Shallow ford',
  },
  {
    id: 'isle-seals', name: 'Seal Rocks', sub: 'Ngā Toka Kekeno', region: 'home', kind: 'site', pos: P(276, 111),
    scene: { type: 'island', x: 4330 }, difficulty: 1, xr: [4000, 4700], ...shore(4000, 4700),
    desc: 'Black rocks, the Corvex Seal’s favourite nap spot and a lot of crabs.', terrain: 'Rocks, wet sand',
  },
  {
    id: 'isle-cave', name: 'Glowworm Cave', sub: 'Te Ana Titiwai', region: 'home', kind: 'cave', pos: P(312, 115),
    scene: { type: 'island', x: 5120 }, difficulty: 1, xr: [4700, 5900], ...shore(4700, 5900),
    desc: 'Under the cliffs, a sea cave full of glowworms and a still pool, then the hidden cove.', terrain: 'Cave rock, pools',
  },
  {
    id: 'isle-track', name: 'The Bush Track', sub: 'Te Ara Ngahere', region: 'home', kind: 'site', pos: P(360, 136),
    scene: { type: 'island', x: 6200 }, difficulty: 2, xr: [5900, 6900], ...shore(5900, 6900),
    desc: 'Up the bank from the cove and into the bush, where Joshu was found by the creek.', terrain: 'Uphill track, creek',
  },
  // ------------------------------------------------------------ the V2 expedition sites
  {
    id: 'fernwood', name: 'Fernwood Floor', sub: 'Te Ngāhere', region: 'interior', kind: 'site', pos: P(430, 198),
    scene: { type: 'site', site: 'fernwood' }, difficulty: 2, xr: [0, 2600],
    path: PATH([380, 162], [404, 186], [432, 200], [458, 210], [470, 214]), knots: [0, 800, 1560, 2280, 2600],
    routes: [{ from: 'isle-track', at: 6860, label: 'Follow the track deeper into the bush', hours: 1, energy: 10, kind: 'walk', say: 'The track just... keeps going. Into the ferns.' }],
    desc: 'Lowland forest of giant tree ferns and kauri. Striders, delvers and bonefaces, and a lot of things you can’t see.', terrain: 'Forest floor, a stream gully',
  },
  {
    id: 'canopy', name: 'Emerald Canopy', sub: 'Te Tāhuhu o te Ngāhere', region: 'interior', kind: 'site', pos: P(392, 243),
    scene: { type: 'site', site: 'canopy' }, difficulty: 3, xr: [0, 2400],
    path: PATH([446, 230], [412, 240], [374, 246], [334, 250]),
    routes: [{ from: 'fernwood', at: 2290, label: 'Climb the giant kauri (a long climb)', hours: 1.5, energy: 16, kind: 'climb', say: 'Okay. Don’t look down. Don’t look down. Don’t... I looked down.' }],
    desc: 'The old forest up on the plateau: a walkway of colossal branches where the snakes fly.', terrain: 'Branches high above the ground',
  },
  {
    id: 'falls', name: 'Thunder Falls', sub: 'Te Wai Whatitiri', region: 'interior', kind: 'site', pos: P(512, 246),
    scene: { type: 'site', site: 'falls' }, difficulty: 3, xr: [0, 2100],
    path: PATH([476, 222], [500, 238], [520, 256], [538, 276]),
    routes: [{ from: 'fernwood', at: 2560, label: 'Follow the stream uphill toward the roar', hours: 1.5, energy: 14, kind: 'walk', say: 'Hear that? That’s not thunder. That’s water.' }],
    desc: 'Where the river drops off the plateau. Auks nest in the cliffs; dippers walk under the water.', terrain: 'Plunge pool, cliff ledges',
  },
  {
    id: 'mangrove', name: 'Blackwater Mangroves', sub: 'Te Wai Pango', region: 'south', kind: 'site', pos: P(196, 232),
    scene: { type: 'site', site: 'mangrove' }, difficulty: 3, xr: [0, 2700],
    path: PATH([226, 170], [204, 212], [182, 252], [166, 292], [158, 318]),
    routes: [{ from: 'isle-stream', at: 3800, label: 'Wade up the stream, inland', hours: 2, energy: 16, kind: 'wade', say: 'The water’s getting darker. And warmer. I don’t love either of those things.' }],
    desc: 'The stream sinks into a maze of dark channels on its way to the inlet. Ironjaws, and something bigger.', terrain: 'Mudbanks, deep channels',
  },
  {
    id: 'coast', name: 'Serpent Coast', sub: 'Te Tai Nakahi', region: 'east', kind: 'site', pos: P(676, 98),
    scene: { type: 'site', site: 'coast' }, difficulty: 3, xr: [0, 2400],
    path: PATH([640, 92], [676, 100], [706, 96], [736, 88]),
    routes: [{ from: 'deep', at: 60, enter: 1520, label: 'Swim up toward the light', hours: 0.5, energy: 8, kind: 'swim', say: 'Air. AIR. And... a beach I’ve never seen.' }],
    desc: 'Sea cliffs, tide pools, a whale’s bones on the sand, and a fin beyond the reef.', terrain: 'Headland, open sea',
  },
  {
    id: 'deep', name: 'The Deep', sub: 'Te Moana Hōhonu', region: 'ocean', kind: 'ocean', pos: P(526, 62),
    scene: { type: 'site', site: 'deep' }, difficulty: 4, xr: [0, 2200],
    // (x 0 is under the Serpent Coast, the far end under the headland where the grotto's sump comes out)
    path: PATH([620, 70], [570, 58], [512, 62], [456, 82]),
    routes: [{ from: 'grotto', at: 2300, enter: 2100, label: 'Take a deep breath and dive the sump', hours: 0.5, energy: 14, kind: 'dive', say: 'One... two... three...' }],
    desc: 'Out past the reef, under the water: kelp forests, god rays and the Leviathan.', terrain: 'Open water',
  },
  // ------------------------------------------------------------ V10: deeper places
  {
    id: 'grotto', name: 'Sea Grotto', sub: 'Te Ana Wai', region: 'home', kind: 'cave', pos: P(370, 110),
    scene: { type: 'site', site: 'grotto' }, difficulty: 3, xr: [0, 2400],
    path: PATH([316, 124], [348, 112], [390, 106], [428, 102]),
    routes: [{ from: 'isle-cave', at: 5250, label: 'Swim through the back of the pool', hours: 0.5, energy: 12, kind: 'swim', say: 'There’s a current under the glowworms. It goes somewhere.' }],
    desc: 'A flooded cave system under the headland: glowworm vaults, a cave lake and a sump that breathes with the tide.', terrain: 'Flooded passages, rock chimneys',
  },
  {
    id: 'village', name: 'Te Kāinga', sub: 'Aroha’s whānau', region: 'south', kind: 'village', pos: P(208, 356),
    scene: { type: 'site', site: 'village' }, difficulty: 3, xr: [0, 2200],
    path: PATH([172, 330], [196, 350], [222, 366], [250, 378]),
    routes: [{ from: 'mangrove', at: 2640, label: 'Follow the canoe marks upriver', hours: 1.5, energy: 14, kind: 'wade', say: 'Someone cut steps into this bank. People live up here.' }],
    desc: 'The village of the kaitiaki, the island’s guardians, on a terrace above the river. Friendly, if you mind your manners.', terrain: 'River terrace, gardens',
  },
  {
    id: 'ruins', name: 'The Old Pā', sub: 'Te Pā Tawhito', region: 'interior', kind: 'ruin', pos: P(316, 306),
    scene: { type: 'site', site: 'ruins' }, difficulty: 4, xr: [0, 2300],
    path: PATH([322, 262], [312, 292], [318, 322], [332, 350]),
    routes: [{ from: 'canopy', at: 2350, label: 'Cross the vine bridge to the stone terraces', hours: 1.5, energy: 18, kind: 'climb', say: 'Those are walls. Somebody built walls up here.' }],
    desc: 'Overgrown stone terraces of an ancient pā, abandoned long ago. Its carvers knew the serpents well.', terrain: 'Terraces, crumbling stairs',
  },
  {
    id: 'fossils', name: 'Bone Cliffs', sub: 'Te Toka Iwi', region: 'interior', kind: 'fossil', pos: P(596, 266),
    scene: { type: 'site', site: 'fossils' }, difficulty: 4, xr: [0, 2300],
    path: PATH([552, 280], [582, 272], [612, 258], [640, 246]),
    routes: [{ from: 'falls', at: 2040, label: 'Climb the gorge above the falls', hours: 1.5, energy: 18, kind: 'climb', say: 'The rock up here is striped like a cake. Every stripe is a million years.' }],
    desc: 'A gorge cut through layered rock above the falls, with the bones of very old serpents in its walls.', terrain: 'Scree, cliff ledges',
  },
  {
    id: 'glowforest', name: 'The Glowing Forest', sub: 'Te Ngahere Kānapanapa', region: 'interior', kind: 'ecosystem', pos: P(676, 300),
    scene: { type: 'site', site: 'glowforest' }, difficulty: 4, xr: [0, 2300],
    path: PATH([652, 254], [674, 284], [688, 318], [692, 350]),
    routes: [{ from: 'fossils', at: 2250, label: 'Climb down into the dark valley', hours: 1.5, energy: 18, kind: 'climb', say: 'It’s midday and it’s dark down there. And something down there is... glowing.' }],
    desc: 'A sunken valley under a roof of leaves so thick it is always dusk, lit by fungi from below.', terrain: 'Giant fungi, spore hollows',
  },
  {
    id: 'geovalley', name: 'The Hot Valley', sub: 'Te Riu Wera', region: 'south', kind: 'ecosystem', pos: P(650, 408),
    scene: { type: 'site', site: 'geovalley' }, difficulty: 5, xr: [0, 2400],
    path: PATH([688, 364], [666, 396], [636, 422], [602, 440]),
    routes: [{ from: 'glowforest', at: 2250, label: 'Follow the warm wind out of the valley', hours: 1.5, energy: 20, kind: 'walk', say: 'Smells like rotten eggs. Steam over the ridge. Oh no. Oh, yes.' }],
    desc: 'Steam vents, boiling mud and silica terraces in rainbow colours. Life here likes it hot.', terrain: 'Hot ground, mud pools',
  },
  {
    id: 'unknown', name: 'Te Korokoro', sub: 'The Throat', region: 'interior', kind: 'ecosystem', pos: P(522, 470), secret: true,
    scene: { type: 'site', site: 'unknown' }, difficulty: 5, xr: [0, 2400],
    path: PATH([580, 458], [542, 472], [502, 476], [464, 470]),
    routes: [
      { from: 'geovalley', at: 2330, label: 'Go down the old stair into the steam', hours: 2, energy: 22, kind: 'climb', say: 'There’s a hole in the world down there.' },
      { from: 'ruins', at: 2240, enter: 2280, label: 'Rope down the collapsed stair', hours: 1.5, energy: 20, kind: 'tunnel', needs: { item: 'rope', n: 2, why: 'The stair is gone: you need 2 rope to get down.' }, say: 'Tie it off. Twice. Okay. Three times.' },
    ],
    desc: 'A vast sinkhole in the heart of the land. Warm air breathes out of it. Nobody goes there.', terrain: 'Sheer walls, a misty lake',
  },
];

// ------------------------------------------------------------------ the region's shape (always visible)

/** coarse coastline of the main land, clockwise from the north-west (map pixels) */
export const COAST: [number, number][] = [
  [56, 128], [70, 104], [118, 100], [176, 102], [238, 98], [300, 106], [352, 112], [372, 102], [404, 94], [462, 90], [522, 94], [586, 86],
  [634, 82], [700, 78], [752, 80], [806, 98], [852, 128], [890, 180], [906, 240], [902, 320], [884, 400], [862, 466], [822, 514], [764, 542],
  [684, 552], [602, 556], [522, 550], [440, 556], [360, 552], [282, 544], [204, 532], [134, 512], [84, 474], [58, 420], [60, 372], [96, 346],
  [138, 330], [150, 318], [128, 300], [80, 290], [54, 244], [48, 186],
];
/** small islands off the coast (centre, radius) */
export const ISLETS: [number, number, number][] = [[132, 44, 22], [214, 30, 7], [920, 600, 9], [38, 560, 6], [808, 44, 11]];

/** terrain zones painted on the map where explored: kind, centre, radii */
export type Zone10 = 'forest' | 'plateau' | 'swamp' | 'garden' | 'glow' | 'thermal' | 'gorge' | 'sink' | 'terraces' | 'cave' | 'dunes' | 'peaks';
export const ZONES10: [Zone10, number, number, number, number][] = [
  ['dunes', 210, 122, 150, 14], ['forest', 420, 196, 70, 42], ['forest', 360, 150, 40, 28], ['plateau', 380, 250, 90, 34], ['forest', 380, 246, 80, 26],
  ['swamp', 196, 246, 52, 84], ['garden', 214, 362, 52, 26], ['terraces', 318, 306, 30, 56], ['gorge', 596, 266, 62, 24], ['peaks', 600, 210, 70, 30],
  ['glow', 676, 302, 34, 56], ['thermal', 648, 404, 64, 40], ['sink', 522, 470, 70, 26], ['cave', 372, 112, 64, 12], ['peaks', 760, 230, 70, 60],
  ['forest', 760, 360, 60, 80], ['plateau', 520, 330, 70, 40], ['forest', 300, 420, 120, 60], ['forest', 560, 160, 60, 40], ['forest', 700, 150, 60, 40],
];
/** rivers (polylines, map pixels): the home stream, the Awa Pango through the swamp, the falls river */
export const RIVERS: [number, number][][] = [
  [[248, 108], [244, 130], [236, 152], [228, 172]],
  [[228, 172], [206, 214], [184, 254], [168, 294], [150, 318]],
  [[700, 200], [640, 236], [580, 252], [538, 262], [522, 256], [500, 240], [470, 218], [440, 202], [404, 188], [380, 166], [362, 140], [348, 118]],
  [[250, 378], [222, 366], [196, 350], [172, 330], [152, 320]],
  [[602, 440], [560, 462], [522, 470]],
];
