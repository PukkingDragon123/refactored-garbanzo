// V12 Backpack: the way in and out. Mori swings his pack off in the world (the cast's 'backpackOff'
// clip; the camera pushes in), the view drops to first person (the frozen world slides up and away
// as the ground comes up: src/ui/v12/pack/scene.ts), and closing runs it all backwards: the flap shuts,
// the clips go in, the pack swings back on, and the camera eases back. Everything that opened the
// old pack (openBackpack, openBackpack11) comes here.

import { game } from '../../../game/game';
import { migratePack } from '../../../game/v11/backpack';
import { packOff } from '../../v11/takeoff';
import { PackScene } from './scene';
import type { PackMode, PrepHooks, PackResult } from './scene';
import type { Biome, Tod } from './art';

export type { PackMode, PrepHooks, PackResult };
export interface PackOpts12 {
  mode?: PackMode;
  /** old callers' eat hook (ignored: eating goes through v10/forage10 eatFood and the hunger contract) */
  onEat?: (id: string) => void | Promise<void>;
  /** play the take-off in the world (default yes) */
  anim?: boolean;
  prep?: PrepHooks;
}

let current: Promise<PackResult> | null = null;
let open = false;
export const packOpen12 = () => open;

interface SceneLike {
  player?: { x: number; ground?: string };
  tod?: string;
  site?: { id?: string };
  interact?: { x: number; label: string }[];
  constructor: { name: string };
}

/** which ground Mori is kneeling on */
async function whereAmI(): Promise<{ biome: Biome; tod: Tod; fireSide: -1 | 1 | 0 }> {
  const sc = game.scene as unknown as SceneLike | null;
  const p = sc?.player;
  const todRaw = sc?.tod ?? game.save.campTime ?? 'day';
  const tod: Tod = todRaw === 'night' || todRaw === 'dusk' || todRaw === 'dawn' ? todRaw : 'day';
  let biome: Biome = p?.ground === 'wood' ? 'deck' : p?.ground === 'leaves' || p?.ground === 'grass' ? 'forest' : 'beach';
  let loc: string | null = null;
  try {
    const [{ locOf }, { isIslandScene }, { islandLocAt }, { lookLocOf }] = await Promise.all([import('../../../game/v10/field10'), import('../../../game/v10/expedition'), import('../../../game/v10/regions'), import('../../../game/v11/regions-lookfx')]);
    if (sc && p && isIslandScene(sc)) loc = islandLocAt(p.x);
    else if (sc && (sc as { site?: unknown }).site) loc = lookLocOf(sc as never, locOf(sc as never));
  } catch { /* no location: the ground underfoot decides */ }
  if (loc) {
    if (loc === 'camp') biome = 'camp';
    else if (/cave|grotto|deep/.test(loc)) biome = 'cave';
    else if (/hills|geovalley|fossils/.test(loc)) biome = 'hills';
    else if (/wreck|seals|coast|motuahi|grove|glassreef/.test(loc)) biome = 'beach';
    else if (/forest|fern|canopy|falls|stream|track|mangrove|glow|ruins|village|unknown/.test(loc)) biome = 'forest';
  }
  if (p?.ground === 'wood' && biome !== 'camp') biome = 'deck';
  // at camp: which side the fire is on
  let fireSide: -1 | 1 | 0 = 0;
  if (biome === 'camp' && p) {
    const f = sc?.interact?.find(i => { try { return /fire|cook|breakfast|dinner/i.test(i.label); } catch { return false; } });
    fireSide = f ? (f.x < p.x ? -1 : 1) : -1;
  }
  return { biome, tod, fireSide };
}

// ---------------------------------------------------------------- debug handle (window.zl.bp12)
const BP12_ZL = {
  /** how long the last opening took (ms) and where it was */
  last: null as Record<string, unknown> | null,
  open: (mode: PackMode = 'pack') => openPack12({ mode }),
  where: () => whereAmI(),
  /** ms to paint each piece of the scene (biome: beach / forest / camp / hills / deck / cave) */
  timeArt: async (biome: Biome = 'camp', w = 427, h = 240) => {
    const A = await import('./art');
    const L = A.packLayout();
    const t: Record<string, number> = {};
    const time = (k: string, f: () => unknown) => { const t0 = performance.now(); f(); t[k] = Math.round(performance.now() - t0); };
    time('ground', () => A.paintGround(w, h, { biome, tod: 'day', shadows: [{ x: 100, y: 60, w: 140, h: 90 }], fire: biome === 'camp' ? [-20, 100] : null }));
    time('pack', () => A.paintPack(L));
    time('lids', () => { A.paintLidOpen(L); A.paintLidShut(L); });
    time('knees', () => { A.paintKnee(false); A.paintHand(false); });
    return t;
  },
};
(function hook() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (w.zl) w.zl.bp12 = BP12_ZL;
  else setTimeout(hook, 500);
})();

/** Open the Backpack (the world part, then the scene). Resolves when it's shut; 'go' when Mori set off
 *  from the trail marker (mode 'prep'). */
export function openPack12(o: PackOpts12 = {}): Promise<PackResult> {
  if (current) return current;
  current = (async () => {
    migratePack();
    game.ui.modalOpen++;
    open = true;
    let putOn: (() => Promise<void>) | null = null;
    try {
      const t0 = performance.now();
      const here = await whereAmI();
      const t1 = performance.now();
      const off = await packOff({ anim: o.anim });
      putOn = off.putOn;
      const t2 = performance.now();
      const sc = new PackScene({ mode: o.mode, prep: o.prep, backdrop: off.backdrop, ...here });
      const p = sc.run();
      BP12_ZL.last = { where: Math.round(t1 - t0), off: Math.round(t2 - t1), build: Math.round(performance.now() - t2), ...here };
      return await p;
    } catch (e) {
      console.error('[backpack]', e);
      return 'closed' as PackResult;
    } finally {
      open = false;
      try { await putOn?.(); } catch (e) { console.error(e); }
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      game.persist();
      const hud = (game.scene as unknown as { hud?: { refresh(f?: boolean): void } | null })?.hud;
      hud?.refresh(true);
    }
  })().finally(() => { current = null; });
  return current;
}
