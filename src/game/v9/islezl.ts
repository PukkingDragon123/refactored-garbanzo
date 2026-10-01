// Debug helpers for the island (window.zl.isle): where everyone is, which interactables are live and
// which carry a quest marker, teleporting, and the forage spots. Used by the progression test.

import { game } from '../game';
import { groundY, ISL } from '../../art/island4/layout';
import { trackedQuest, currentStepIndex, activeQuests, questStatus } from '../quests';
import { forage } from './forage';
import type { IslandScene4 } from '../v4/island';

const scene = () => game.scene as unknown as IslandScene4;
const strip = (h: string) => h.replace(/<[^>]+>/g, '').trim();

export const ISLE = {
  /** a snapshot of the story state */
  state() {
    const s = scene(), p = s?.player;
    if (!p) return { scene: game.scene?.constructor.name ?? null };
    const q = trackedQuest();
    return {
      scene: game.scene!.constructor.name, x: Math.round(p.x), y: Math.round(p.y), pstate: p.state, cut: s.cutscene, bub: game.ui.bubbles.active, blocking: game.ui.blocking,
      modal: game.ui.modalOpen, inWreck: s.inWreck, locked: s.st.cam.locked, t: +s.clock.t.toFixed(2), fade: +game.r.post.fade.toFixed(2),
      quest: q ? `${q.id}:${currentStepIndex(q)}:${q.steps[currentStepIndex(q)]?.text ?? 'done'}` : null,
      active: activeQuests().map(a => a.id), chunk: [Math.round(s.chunk.x), Math.round(s.chunk.y), s.chunk.visible], tools: game.save.tools.slice(),
    };
  },
  /** live interactables (marked = has a quest marker) */
  its(all = false) {
    const s = scene();
    return s.interact.map((it, i) => ({ i, x: Math.round(it.x), y: Math.round(it.y), label: strip(String(it.label)), on: !it.enabled || it.enabled(), quest: !!it.quest && (!it.enabled || it.enabled()) && it.quest(), standX: it.standX }))
      .filter(o => all || o.on);
  },
  /** quest marker world points (interactables + quest points) */
  marks() {
    const s = scene();
    const pts: [number, number][] = [];
    for (const it of s.interact) if (it.quest && (!it.enabled || it.enabled()) && it.quest()) pts.push([Math.round(it.x), Math.round(it.y)]);
    for (const q of s.questPoints) if (q.on()) pts.push([Math.round(q.x()), Math.round(q.y())]);
    return pts;
  },
  /** stand Mori on the sand at x */
  tp(x: number) {
    const s = scene(), p = s.player;
    p.state = 'normal'; p.climb = null; p.vx = p.vy = 0;
    p.x = Math.max(14, Math.min(ISL.W - 14, x)); p.y = groundY(p.x); p.onGround = true; p.surface = null;
    s.snapCamera();
    return [p.x, p.y];
  },
  /** run interactable i (as if E was pressed next to it); resolves when its action is done */
  async use(i: number) {
    const s = scene();
    const it = s.interact[i];
    await s.runAction(it);
  },
  forage() { return forage()?.list() ?? []; },
  quest(id: string) { return questStatus(id); },
};
