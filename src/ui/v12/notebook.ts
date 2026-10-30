// V12: Mori's notebook, the note paper he pulls out of his pocket when you inspect him (and with J,
// G or K, or the pause menu). A worn leather field notebook held in his pixel-art hands over the
// softened scene: real page curls (drag a corner, click, swipe, arrow keys), paper tabs for QUESTS,
// the FIELD GUIDE, PEOPLE, the MAP and SKETCH pages, a ribbon on the tracked quest, and a pen, a
// pencil and an eraser tucked in the spine to draw on any page. Quest steps finished since the
// notebook was last shown get ticked and struck through by a pen, stroke by stroke.
//
//   openNotebook({ page, quest, entry, person })   open (or flip an open notebook) at a tab:
//       page 'quests' (at quest id `quest`) | 'guide' (at encyclopedia key `entry`, e.g. 'sp:glasscrab')
//       | 'people' (at person id `person`) | 'map' | 'sketch'; resolves when it has been put away
//   markQuestDone(questId, step?)   a step (or, without step, the whole quest) was finished: the pen
//       ticks it the next time the page is shown (live if it is open) and "noted" floats by Mori
//   notebookOpen()                  is it out?
//
// This file is light (the save, the quest marks and the J / G / K keys); the notebook itself lives in
// ./nb/ and is loaded the first time it is opened.

import { game } from '../../game/game';
import { bucket } from '../../game/v10/store';
import { floatNotice } from './float';

export interface NotebookOpts {
  page?: 'quests' | 'guide' | 'people' | 'map' | 'sketch' | string;
  quest?: string;
  /** a field guide entry key ('sp:<species>', 'it:<item>', 'loc:<place>') */
  entry?: string;
  /** a person id (people tab) */
  person?: string;
}

/** what the notebook keeps in the save (game.save.v10.notebook) */
export interface NbSave {
  v: 1;
  /** quest steps the pen has already ticked (count per quest) */
  seen: Record<string, number>;
  /** finished quests whose DONE stamp has been inked */
  done: Record<string, 1>;
  /** drawings per page id (compact stroke strings, see nb/ink.ts) */
  draw: Record<string, string>;
  /** sketch pages in use */
  sketches: number;
}

function initSave(): NbSave {
  // start from what the quests show now, so an old save doesn't tick everything at once
  const seen: Record<string, number> = {}, done: Record<string, 1> = {};
  try {
    const qs = game.save.quests ?? {};
    for (const [id, st] of Object.entries(qs)) if (st === 'done') done[id] = 1;
    // the V11 journal's own record of inked steps (if it was ever opened)
    const old = (game.save as unknown as { v10?: Record<string, { done?: Record<string, number> }> }).v10?.journal?.done;
    if (old) for (const [k, n] of Object.entries(old)) seen[k] = n;
  } catch { /* a fresh save */ }
  return { v: 1, seen, done, draw: {}, sketches: 2 };
}
export const nbSave = (): NbSave => {
  const b = bucket<NbSave>('notebook', initSave);
  b.seen ??= {}; b.done ??= {}; b.draw ??= {}; b.sketches ??= 2;
  return b;
};

// ---------------------------------------------------------------- opening

type Impl = typeof import('./nb/book');
let impl: Promise<Impl> | null = null;
let current: Promise<void> | null = null;
/** is the notebook out (or coming out)? */
export const notebookOpen = () => !!current;

/** open Mori's notebook (or flip an open one to a tab); resolves when it has been put away */
export function openNotebook(o: NotebookOpts = {}): Promise<void> {
  if (current) { void (impl ?? import('./nb/book')).then(m => m.notebookGoto(o)); return current; }
  const p = (async () => {
    try {
      const m = await (impl ??= import('./nb/book'));
      await m.showNotebook(o);
    } catch (e) { console.error('[notebook]', e); }
  })();
  current = p;
  void p.finally(() => { if (current === p) current = null; });
  return p;
}

// ---------------------------------------------------------------- quest marks

type MarkFn = (questId: string, step?: number) => void;
const markFns = new Set<MarkFn>();
/** (the open notebook listens here to ink a mark live) */
export function onQuestMark(fn: MarkFn): () => void { markFns.add(fn); return () => { markFns.delete(fn); }; }
let lastNotice = -1e9;

/** a quest step (or, without step, the whole quest) was finished: the pen ticks it next time the
 *  notebook is shown (or now, if it is open), and a little "noted" floats by Mori */
export function markQuestDone(questId: string, step?: number): void {
  try {
    const b = nbSave();
    if (step !== undefined) b.seen[questId] = Math.min(b.seen[questId] ?? step, step);
    else delete b.done[questId];
  } catch { /* no save yet */ }
  markFns.forEach(f => { try { f(questId, step); } catch (e) { console.error(e); } });
  const now = performance.now();
  if (!current && now - lastNotice > 2500) { lastNotice = now; try { floatNotice('noted', 1800); } catch { /* no world yet */ } }
}

// ---------------------------------------------------------------- keys: J quests, G field guide, K people

const KEY_TAB: Record<string, string> = { KeyJ: 'quests', KeyG: 'guide', KeyK: 'people' };
let keysOn = false;
/** route J / G / K to the notebook (installed once, when this module loads) */
export function installNotebookKeys() {
  if (keysOn || typeof window === 'undefined') return;
  keysOn = true;
  window.addEventListener('keydown', e => {
    const tab = KEY_TAB[e.code];
    if (!tab || e.repeat || e.ctrlKey || e.metaKey || e.altKey || current) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const sc = game.scene as unknown as { cutscene?: boolean; player?: unknown } | null;
    if (!sc?.player || sc.cutscene || game.ui.blocking || game.paused) return;
    if ((game.ui as unknown as { bubbles?: { active?: boolean } }).bubbles?.active) return;
    void openNotebook({ page: tab });
  });
}
installNotebookKeys();
