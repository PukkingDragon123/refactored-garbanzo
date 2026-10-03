// V11 contract: how much room an item takes in the Backpack's tile grid. Item artwork registers its
// real shape (src/art/v11/itemart.ts registerItemArt(id, painter, footprint)); anything without art
// falls back to the defaults below (by id, then by kind). Masks are rows of '#' (filled) and '.'
// (empty).
//
// The defaults try to read like the real things lying in a pack: long fronds, planks and poles stand
// up the side (1x3, 1x4), a fish or a loaf lies across (2x1), a coil of rope or a rolled cape takes a
// square, the Trycop's shed claw is an L. Small samples, berries and shells are one cell (their
// stack shares it).
import { ITEMS } from '../items';

export interface Footprint { w: number; h: number; mask?: string[] }
const REG: Record<string, Footprint> = {};
export function registerFootprint(id: string, fp: Footprint): void { REG[id] = fp; }

const F = (w: number, h: number, mask?: string[]): Footprint => (mask ? { w, h, mask } : { w, h });

/** the item defaults (the artwork overrides them with registerFootprint) */
const DEFAULTS: Record<string, Footprint> = {
  // tools (they normally ride in the pack's own loops and sheaths, see src/game/v11/backpack.ts)
  camera: F(2, 2), knife: F(1, 2), jar: F(1, 2), net: F(1, 4), trowel: F(1, 2), tweezers: F(1, 1), gloves: F(1, 1),
  hammer: F(1, 2), headlamp: F(1, 1), translator: F(1, 1), ghillie: F(2, 2), binoculars: F(2, 1),
  // salvage and building materials
  canvas: F(3, 1), poles: F(1, 4), rope: F(2, 2), flax: F(1, 2), wood: F(1, 3), stone: F(1, 1), plank: F(1, 3),
  scrap: F(2, 1), resin: F(1, 1), wire: F(1, 1), battery: F(2, 1), driftglass: F(1, 1), kelp: F(1, 2), flint: F(1, 1), clay: F(1, 1),
  v10_pumice: F(1, 1), v10_obsidian: F(1, 1), v10_sulphur: F(1, 1),
  // plants and fungi
  fernfrond: F(1, 3), flaxleaf: F(1, 3), kawakawa: F(1, 1), ratabloom: F(1, 1), pitcher: F(1, 2), moonfruit: F(1, 1), moss: F(1, 1),
  glowcap: F(1, 1), bracket: F(2, 1), inkcap: F(1, 1), plant_seaholly: F(1, 2), plant_saltfern: F(1, 2), plant_glowmoss: F(1, 1),
  plant_dunelily: F(1, 1), plt_ghostfern: F(1, 2), plt_lanterncap: F(1, 1), plt_thermomat: F(2, 1), plt_cavelichen: F(1, 1),
  plt_pavine: F(1, 2), plt_throatfern: F(1, 1), v10_kelpholdfast: F(2, 2, ['##', '#.']),
  // animal samples and fossils
  feather: F(1, 2), quill: F(1, 2), shedskin: F(2, 1), bone: F(1, 1), plate: F(1, 1), v10_coral: F(1, 2, ['#', '#']),
  fos_vertebra: F(2, 1), fos_ammonite: F(1, 1), fos_leaf: F(2, 1), fos_tooth: F(1, 1), fos_shell: F(1, 1),
  // shells
  shell_trycop: F(2, 2, ['##', '#.']),
  // lures and gadgets
  trap: F(1, 2), caller: F(1, 1),
  // food
  ration: F(1, 1), stew: F(1, 2), tea: F(1, 2), v10_fish: F(2, 1), vil_rewena: F(2, 1), vil_kumara: F(1, 1), vil_tea: F(1, 2),
  // finds and keepsakes
  taonga_toki: F(1, 2), art_bottle: F(1, 2), gift_kete: F(2, 2), joshu_cap: F(2, 1), joshu_log: F(1, 1),
};

export function footprint(id: string): Footprint {
  const r = REG[id] ?? DEFAULTS[id];
  if (r) return r;
  const d = ITEMS[id];
  const nm = id + ' ' + (d?.name ?? '');
  switch (d?.kind) {
    case 'tool': return { w: 1, h: 2 };
    case 'material': return /plank|log|branch|pole|stick|drift/i.test(nm) ? { w: 1, h: 3 } : { w: 1, h: 1 };
    case 'plant': return /frond|fern|leaf|stalk|reed|cane/i.test(nm) ? { w: 1, h: 2 } : { w: 1, h: 1 };
    case 'food': return /fish|loaf|bread|eel|skewer|kebab|box|parcel/i.test(nm) ? { w: 2, h: 1 } : /flask|bottle|billy|tin/i.test(nm) ? { w: 1, h: 2 } : { w: 1, h: 1 };
    default: return { w: 1, h: 1 };
  }
}
/** cells a footprint fills (honouring the mask), for grid fitting */
export function cells(fp: Footprint, rot = false): [number, number][] {
  const out: [number, number][] = [];
  const w = rot ? fp.h : fp.w, h = rot ? fp.w : fp.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = rot ? y : x, sy = rot ? w - 1 - x : y;
    if (!fp.mask || fp.mask[sy]?.[sx] === '#') out.push([x, y]);
  }
  return out;
}
/** how many grid cells an item fills (for sorting and the fill gauge) */
export function cellCount(id: string): number { return cells(footprint(id)).length; }
