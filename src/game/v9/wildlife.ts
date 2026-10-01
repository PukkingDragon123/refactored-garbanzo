// V9 island wildlife that isn't part of the V4 shore life: the Trycop crab, the jewel hornets and
// their nests, parasites, and the small ambient life of the sand, turf and bush. Spawned once when
// the island scene starts (called from islestory.ts enter()).

import type { IslandScene4 } from '../v4/island';
import type { Animal } from '../wild/animal';
import { game } from '../game';
import { audio } from '../../core/audio';
import { TrycopCrab, disposeTrycopSprites, placeMoult } from './trycop';
import { startHornets } from './hornets';
import { WILD9 } from './species-wild';

/** everything this module spawned in the current island scene (for debug hooks) */
export const W9 = {
  scene: null as IslandScene4 | null,
  crabs: [] as TrycopCrab[],
};

/** a photo subject that isn't drawn by itself (a parasite on a host, a colony...) */
export interface Subject {
  species: string;
  x: number;
  y: number;
  z: number;
  p: number;
  vx: number;
  vy: number;
  facing: number;
  dead: boolean;
  gone: boolean;
  hidden: number;
  eco: { attacksPlayer: number; aggro: number };
  anger: number;
  act: string;
  body: { bounds: (a: never) => { x0: number; y0: number; x1: number; y1: number }; points: (a: never) => [number, number][] };
  photoInfo(): { species: string; behavior: string | null; box: { x0: number; y0: number; x1: number; y1: number }; pts: [number, number][]; speed: number; facing: number; noticed: boolean; juvenile: boolean; p: number; hidden: number };
}

const OFF = { x0: -1e5, y0: -1e5, x1: -1e5 + 1, y1: -1e5 + 1 };

/** the root barnacle under a rearing Trycop: only in frame while the crab shows its underside */
function rootBarnacle(c: TrycopCrab): Subject {
  const box = () => {
    const q = c.sacPoint();
    const k = c.k;
    return q ? { x0: q[0] - 4 * k, y0: q[1] - 3 * k, x1: q[0] + 4 * k, y1: q[1] + 3 * k } : OFF;
  };
  const S: Subject = {
    species: 'rootbarnacle', get x() { return c.x; }, get y() { return c.y; }, z: c.z + 0.1, p: 1, vx: 0, vy: 0, facing: 1,
    dead: false, gone: false, get hidden() { return c.sacPoint() ? 0 : 1; }, eco: { attacksPlayer: 0, aggro: 0 }, anger: 0, act: 'idle',
    body: { bounds: () => box(), points: () => { const b = box(); return [[(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], [b.x0 + 1, b.y0 + 1], [b.x1 - 1, b.y1 - 1]]; } },
    photoInfo() { const b = box(); return { species: 'rootbarnacle', behavior: 'attached', box: b, pts: S.body.points(never()), speed: 0, facing: 1, noticed: false, juvenile: false, p: 1, hidden: S.hidden }; },
  } as Subject;
  return S;
}
const never = () => undefined as never;

const NAMES: Record<string, string> = Object.fromEntries(WILD9.map(s => [s.id, s.name]));
const FIRST_LINES: Record<string, string> = {
  trycop: 'Three claws. THREE. A crusher, a cutter and a little fork for its salad. I love it.',
  rootbarnacle: 'That orange sac under the crab... it is not the crab. Something is living INSIDE it.',
};

export function startWildlife9(s: IslandScene4) {
  disposeTrycopSprites();
  W9.scene = s;
  W9.crabs = [];
  const put = (a: Subject | TrycopCrab, draw = true) => {
    if (draw) s.main.add(a as TrycopCrab);
    s.animals.push(a as unknown as Animal);
  };
  // ---------------------------------------------------------------- Trycop crabs (seal rocks, west rock pools)
  const crabs = [
    new TrycopCrab(s, { x: 4160, crevice: 4105, range: [4085, 4250], k: 1.1, hue: 0, parasite: false, seed: 3 }),
    new TrycopCrab(s, { x: 4540, crevice: 4605, range: [4470, 4625], k: 1.22, hue: 0.3, parasite: true, seed: 7 }),
    new TrycopCrab(s, { x: 300, crevice: 385, range: [270, 405], k: 1.0, hue: 0.12, parasite: false, seed: 11 }),
  ];
  for (const c of crabs) {
    put(c);
    W9.crabs.push(c);
    if (c.spec.parasite) put(rootBarnacle(c), false);
    s.interact.push({
      get x() { return c.x; }, get y() { return c.y; }, w: 22, h: 20, label: 'Examine the Trycop crab',
      enabled: () => c.state !== 'hide' && c.state !== 'retreat' && !s.cutscene,
      action: async () => {
        const { examineTrycop } = await import('../../ui/v9/trycop');
        await examineTrycop(s, c);
      },
    } as never);
  }
  placeMoult(s, 4495);
  // ---------------------------------------------------------------- ember bushes and the jewel hornets
  startHornets(s);
  // ---------------------------------------------------------------- first photos of these species count for the story
  const prev = s.cam.onShot;
  s.cam.onShot = ph => {
    prev?.(ph);
    countPhoto(s, ph.subjects.filter(x => x.inFrame > 0.3 && x.visible > 0.3).map(x => x.species));
  };
}

/** first photo of one of our species: flag it, count it toward the island photo quest, a toast and a line from Mori */
export function countPhoto(s: IslandScene4, species: string[]) {
  let fresh = 0;
  for (const sp of new Set(species)) {
    if (!NAMES[sp] || game.save.flags['v4:photo:' + sp]) continue;
    game.save.flags['v4:photo:' + sp] = true;
    game.save.vars['v4:islePhotos'] = (game.save.vars['v4:islePhotos'] ?? 0) + 1;
    fresh++;
    game.ui.toast(`New species photographed: <b>${NAMES[sp]}</b>`, 'FIELD GUIDE', 'teal', 3600);
    const line = FIRST_LINES[sp];
    if (line && !game.ui.bubbles.active) s.bark('mori', line, { expr: 'excited' });
  }
  if (fresh) { audio.play('discover', { vol: 0.5 }); game.persist(); s.hud?.refresh(true); }
}
