// V12 Backpack: the way in and out. The pack lifts off Mori's back and hangs open in the air beside
// him over the world, dimmed by a dither (src/ui/v12/pack/scene.ts). When he is being inspected
// (src/ui/v12/inspect.ts) the close camera slides over to make room for it; opened any other way
// (the camp chest, the trail sign, a heap he can't fit) the world just slows down while it is open.
// Everything that opened the old pack (openBackpack, openBackpack11) comes here.

import { game } from '../../../game/game';
import { migratePack } from '../../../game/v11/backpack';
import { cineTo, cineSlowmo, cineState } from '../../../game/v11/cine';
import type { Stage } from '../../../world/stage';
import { reduced } from '../../laptop-kit';
import { PackScene } from './scene';
import type { PackMode, PrepHooks, PackResult } from './scene';

export type { PackMode, PrepHooks, PackResult };
export interface PackOpts12 {
  mode?: PackMode;
  /** old callers' eat hook (ignored: eating goes through v10/forage10 eatFood and the hunger contract) */
  onEat?: (id: string) => void | Promise<void>;
  /** (kept for old callers) */
  anim?: boolean;
  prep?: PrepHooks;
  /** opened from the inspection of Mori: the close camera makes room beside him */
  fromInspect?: boolean;
}

let current: Promise<PackResult> | null = null;
let open = false;
export const packOpen12 = () => open;

interface SceneLike {
  player?: { x: number; y: number; facing: number; height: number; vx: number; body?: { p?: number } };
  st?: Stage;
  cutscene?: boolean;
}

/** css px of a world point on the gameplay plane */
function project(x: number, y: number): [number, number] | null {
  const r = game.r;
  if (!r || !game.scene) return null;
  return game.ui.artToCss(r.projectX(x, 1), r.projectY(y, 1), r.VW, r.VH) as [number, number];
}

// ---------------------------------------------------------------- debug handle (window.zl.bp12)
const BP12_ZL = {
  /** how long the last opening took (ms) */
  last: null as Record<string, unknown> | null,
  open: (mode: PackMode = 'pack') => openPack12({ mode }),
  /** ms to paint each piece */
  timeArt: async () => {
    const A = await import('./art');
    const L = A.packLayout();
    const t: Record<string, number> = {};
    const time = (k: string, f: () => unknown) => { const t0 = performance.now(); f(); t[k] = Math.round(performance.now() - t0); };
    time('pack', () => A.paintPack(L));
    time('lids', () => { A.paintLidOpen(L); A.paintLidShut(L); });
    time('dim', () => A.paintDim(640, 360, [{ x: 300, y: 180, r: 120 }]));
    return t;
  },
};
(function hook() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (w.zl) w.zl.bp12 = BP12_ZL;
  else setTimeout(hook, 500);
})();

/** Open the Backpack. Resolves when it's shut; 'go' when Mori set off from the trail marker (mode 'prep'). */
export function openPack12(o: PackOpts12 = {}): Promise<PackResult> {
  if (current) return current;
  current = (async () => {
    migratePack();
    game.ui.modalOpen++;
    open = true;
    const sc = game.scene as unknown as SceneLike | null;
    const p = sc?.player;
    const slowed = !o.fromInspect && !!p && !sc?.cutscene && game.slowmo > 0.5;
    // the HUD steps aside (the inspection has already put it away)
    const hud = [game.ui.sceneLayer, game.ui.prompts, game.ui.hud];
    const was = hud.map(h => h.style.opacity);
    try {
      const t0 = performance.now();
      if (p) p.vx = 0;
      if (slowed) {
        cineSlowmo(0.15, 0.3);
        for (const h of hud) { h.style.transition = 'opacity 0.25s'; h.style.opacity = '0'; }
      }
      // inspecting: the close camera slides over so Mori stands to one side and the pack has room
      if (o.fromInspect && p && sc?.st && cineState.shot) {
        const c = sc.st.cam, r = game.r;
        const cssPerWorld = c.zoom * (window.innerHeight / r.VH);
        const portrait = window.innerHeight > window.innerWidth * 1.1;
        if (!portrait) {
          const want = window.innerWidth * (p.facing >= 0 ? 0.3 : 0.7);
          const now = project(p.x, p.y)?.[0] ?? window.innerWidth / 2;
          const dx = (now - want) / cssPerWorld;
          if (Math.abs(dx) > 4) await cineTo(sc.st, { x: c.x + dx, y: c.y, zoom: c.zoom, secs: reduced() ? 0.05 : 0.45, focus: p.body?.p ?? 1, dof: 1.35, sway: 0.08 });
        }
      }
      const scene = new PackScene({ mode: o.mode, prep: o.prep, project, mori: p ? { x: p.x, y: p.y, facing: p.facing || 1, height: p.height || 62 } : null });
      const run = scene.run();
      BP12_ZL.last = { build: Math.round(performance.now() - t0), mode: o.mode ?? 'pack', fromInspect: !!o.fromInspect };
      return await run;
    } catch (e) {
      console.error('[backpack]', e);
      return 'closed' as PackResult;
    } finally {
      open = false;
      if (slowed) {
        cineSlowmo(1, 0.3);
        hud.forEach((h, i) => { h.style.opacity = was[i] ?? ''; });
      }
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      game.persist();
      const hd = (game.scene as unknown as { hud?: { refresh(f?: boolean): void } | null })?.hud;
      hd?.refresh(true);
    }
  })().finally(() => { current = null; });
  return current;
}
