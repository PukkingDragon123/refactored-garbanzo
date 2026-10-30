// V12 notebook: the tabs and what's behind them, assembled into one run of pages. QUESTS, the FIELD
// GUIDE, PEOPLE, the MAP (a spread) and SKETCH pages (blank, for drawing; there are always a couple
// more than the last one drawn on). Each section after the first starts on a left-hand page in a
// two-page spread (a padding page with a doodle fills the gap).

import { nbSave } from '../notebook';
import { Flow } from './flow';
import type { Page } from './flow';
import { C, PW, PH, TEXT_X, hand, handW, doodleArt, insideCoverArt } from './art';
import type { TabIcon } from './art';
import { questPages } from './quests';
import { guidePages } from './guide';
import { peoplePages } from './people';
import { mapPages } from './map';
import { hashStr } from '../../v11/paper/rng';

export interface Section { id: TabIcon; color: string; pages: Page[]; anchors: Record<string, string> }
export interface Built {
  /** slot 0 is the inside of the front cover, then the pages */
  slots: Page[];
  /** section id -> its first slot */
  starts: Record<string, number>;
  sections: Section[];
  /** anchor (quest id, entry key, person...) -> slot */
  anchors: Record<string, number>;
  /** the first page with a pen animation waiting */
  fresh: string | null;
}

function sketchPages(): Section {
  const S = nbSave();
  const f = new Flow('sketch', 's:1', { head: 'sketches', paper: 'plain' });
  // pages in use, plus two blank ones
  let used = 0;
  for (let i = 1; i <= 60; i++) if (S.draw['s:' + i]) used = i;
  const n = Math.max(S.sketches ?? 2, used + 2);
  for (let i = 1; i <= n; i++) {
    const p = f.page('s:' + i, { paper: i % 3 === 0 ? 'graph' : 'plain', head: 'sketches' });
    if (i === 1) {
      p.ops.push(c => {
        hand(c.a, 'Sketches', TEXT_X, 46, C.ink, { bold: true, scale: 2 });
        if (!S.draw['s:1']) {
          hand(c.a, 'take the pencil from the spine', TEXT_X, 66, C.pencil, { pencil: true });
          hand(c.a, 'and draw. (any page will do)', TEXT_X, 77, C.pencil, { pencil: true });
        }
      });
    }
  }
  return { id: 'sketch', color: '#9a9488', pages: f.pages, anchors: { sketch: 's:1' } };
}

/** a padding page: blank, with the odd doodle */
function padPage(section: string, seed: number): Page {
  const names = ['palm', 'fish', 'shell', 'leaf', 'bird', 'wave', 'sun', 'feather', 'crab'];
  const d = names[seed % names.length];
  return {
    id: 'pad:' + section, section, paper: 'ruled', seed: hashStr('pad:' + section) % 9973, hits: [], anims: [],
    ops: [c => { if (seed % 3 !== 0) c.a.blit(doodleArt(d, 40, C.pencilLt, { pencil: true, seed }), PW - 60, PH - 70); }],
  };
}

export function buildAll(spread: boolean): Built {
  const q = questPages(), g = guidePages(), p = peoplePages(), m = mapPages(), s = sketchPages();
  const sections: Section[] = [
    { id: 'quests', color: '#c8503c', pages: q.pages, anchors: q.anchors },
    { id: 'guide', color: '#6a9a4a', pages: g.pages, anchors: g.anchors },
    { id: 'people', color: '#4a7ab8', pages: p.pages, anchors: p.anchors },
    { id: 'map', color: '#d8a838', pages: m.pages, anchors: m.anchors },
    s,
  ];
  const inside: Page = { id: 'inside', section: 'cover', paper: 'kraft', seed: 5, ops: [], hits: [], anims: [], art: insideCoverArt };
  const slots: Page[] = [inside];
  const starts: Record<string, number> = {};
  sections.forEach((sec, i) => {
    // sections after the first start on a left page (an even slot) in a spread
    if (spread && i > 0 && slots.length % 2 === 1) slots.push(padPage(sec.id, i * 7 + slots.length));
    starts[sec.id] = slots.length;
    slots.push(...sec.pages);
  });
  if (spread && slots.length % 2 === 1) slots.push(padPage('end', 3));
  const byId = new Map(slots.map((pg, i) => [pg.id, i]));
  const anchors: Record<string, number> = {};
  for (const sec of sections) for (const [k, id] of Object.entries(sec.anchors)) { const i = byId.get(id); if (i !== undefined) anchors[k] = i; }
  slots.forEach((pg, i) => { if (i > 0) pg.num = i; });
  return { slots, starts, sections, anchors, fresh: q.fresh };
}
export { handW };
