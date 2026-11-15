// V12 notebook: the FEATS tab. A trophy page first: the tally per tier (each tier's medal and how many
// of its feats are earned), then the medal case, every feat as a medal pinned in rows (earned ones in
// their metal, locked ones an embossed blank, hidden ones a blank with a question mark pressed up).
// Medals earned since the notebook was last open drop into their place one by one. Then a page run per
// tier: each feat's medal, its title (in its tier's ink, or greyed while locked; "???" while a hidden
// one is locked), what it asks in pencil, the day it was earned, and a pixel progress bar with the
// count for the ones that count something. The data is src/game/v12/feats.ts.

import { game } from '../../../game/game';
import { audio } from '../../../core/audio';
import { FEATS, TIERS, featTally, featProgress, featDay, hasFeat } from '../../../game/v12/feats';
import type { FeatDef, FeatTier } from '../../../game/v12/feats';
import { paintMedal, MEDAL_N, TIER_INK } from '../featsprites';
import type { MedalKind } from '../featsprites';
import { Flow } from './flow';
import type { Page, Ctx } from './flow';
import { C, TEXT_X, TEXT_R, TEXT_W, LINE, hand, handW, wrap, plot, wavyPx } from './art';
import { col, dith, mixC, shadeC } from '../../v11/paper/px';
import { hashStr } from '../../v11/paper/rng';

const TIER_NAME: Record<FeatTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legend: 'Legend' };
const INK: Record<FeatTier, number> = { bronze: col(TIER_INK.bronze), silver: col(TIER_INK.silver), gold: col(TIER_INK.gold), legend: col(TIER_INK.legend) };
const BAR: Record<FeatTier, number> = { bronze: col('#c47c3c'), silver: col('#8a96a2'), gold: col('#e0b030'), legend: col('#389464') };

const kindOf = (f: FeatDef): MedalKind => (hasFeat(f.id) ? f.tier : f.hidden ? 'hidden' : 'blank');
const titleOf = (f: FeatDef) => (hasFeat(f.id) || !f.hidden ? f.title : '???');
const descOf = (f: FeatDef) => (hasFeat(f.id) || !f.hidden ? f.desc : 'A hidden feat. Nobody tells you what it is.');

/** a medal earned since the notebook last showed it drops into place (once) */
const seenKey = (id: string) => 'fs:seen:' + id;
const isFresh = (f: FeatDef) => hasFeat(f.id) && !(game.save.vars[seenKey(f.id)] ?? 0);
function markSeen(id: string) { game.save.vars[seenKey(id)] = 1; game.persist(); }

/** a medal on the page: k=1 notebook px per sprite pixel; a fresh one drops in with its anim */
function medalAt(c: Ctx, f: FeatDef, x: number, y: number, fresh: boolean) {
  if (!fresh) { paintMedal(c.a, kindOf(f), x, y); return; }
  const k = c.anim('feat:' + f.id);
  if (k <= 0) { paintMedal(c.a, f.hidden ? 'hidden' : 'blank', x, y); return; }
  if (k < 1) {
    // it drops onto its blank from above, catching the light on the way
    paintMedal(c.a, f.hidden ? 'hidden' : 'blank', x, y);
    const drop = Math.round((1 - k) * 5);
    paintMedal(c.a, f.tier, x, y, { drop, glint: k, shadow: drop < 2 });
    c.pen(x + 8, y - drop, 'stamp');
    return;
  }
  paintMedal(c.a, f.tier, x, y);
}

/** the progress bar, pixel by pixel: a pencilled frame, the tier's colour filling it, the count */
function barAt(c: Ctx, x: number, y: number, w: number, n: number, of: number, tier: FeatTier, seed: number) {
  const fill = of > 0 ? Math.round((w - 2) * Math.min(1, n / of)) : 0;
  const base = BAR[tier], lt = shadeC(base, 0.35), dk = shadeC(base, -0.3);
  for (let i = 0; i < w; i++) for (let j = 0; j < 6; j++) {
    const edge = i === 0 || i === w - 1 || j === 0 || j === 5;
    if (edge) { if (!((i === 0 || i === w - 1) && (j === 0 || j === 5))) c.a.put(x + i, y + j, C.pencil); continue; }
    const inside = i - 1 < fill;
    if (inside) c.a.put(x + i, y + j, j === 1 ? lt : j === 4 ? dk : base);
    else if (dith(x + i, y + j, 0.18)) c.a.put(x + i, y + j, mixC(C.pencilLt, col('#f0e6c8'), 0.3));
  }
  // tally ticks every tenth along the frame
  for (let t = 1; t < 10; t++) { const tx = x + Math.round((w - 1) * t / 10); c.a.put(tx, y + 5, C.pencil); }
  hand(c.a, `${n}/${of}`, x + w + 4, y + 6, C.pencil, { pencil: true });
  void seed;
}

export interface FeatBuild { pages: Page[]; anchors: Record<string, string> }

export function featPages(): FeatBuild {
  const f = new Flow('feats', 'f:index', { head: 'feats' });
  const tally = featTally();
  const earned = FEATS.filter(x => hasFeat(x.id)).length;

  // ---- the trophy page
  f.page('f:index');
  f.title('Feats', { sub: `${earned} of ${FEATS.length} earned · day ${game.save.day || 1}` });
  // the tally: each tier's medal, its count, its name
  f.block(30, (c, x, y) => {
    const cw = Math.floor(TEXT_W / 4);
    TIERS.forEach((t, i) => {
      const [n, of] = tally[t];
      const mx = x + i * cw;
      paintMedal(c.a, n > 0 ? t : 'blank', mx, y + 1);
      hand(c.a, `${n}/${of}`, mx + MEDAL_N + 3, y + 12, n >= of ? INK[t] : C.ink, { bold: n >= of });
      hand(c.a, TIER_NAME[t].toLowerCase(), mx + 1, y + 28, C.pencil, { pencil: true });
    });
  });
  // the medal case: every feat pinned in rows, in tier order
  f.heading('the medal case');
  const per = 8, pitch = Math.floor(TEXT_W / per);
  for (let r = 0; r < Math.ceil(FEATS.length / per); r++) {
    const row = FEATS.slice(r * per, r * per + per);
    f.need(2);
    const y0 = f.top() + 1;
    row.forEach((ft, i) => {
      const x = TEXT_X + i * pitch + 1;
      const fresh = isFresh(ft);
      f.op(c => medalAt(c, ft, x, y0, fresh));
      if (fresh) f.anim({ key: 'feat:' + ft.id, dur: 0.5, done: () => { markSeen(ft.id); try { audio.play('stamp', { vol: 0.5 }); } catch { /* */ } } });
      f.hit(x - 1, y0 - 1, MEDAL_N + 2, MEDAL_N + 2, 'goto', 'f:' + ft.id);
    });
    f.gap(2);
  }
  f.text('Tap a medal to read it.', { color: C.pencil, pencil: true });

  // ---- a run of pages per tier
  for (const t of TIERS) {
    const list = FEATS.filter(x => x.tier === t);
    const [n, of] = tally[t];
    f.fresh('f:' + t, { head: 'feats · ' + t });
    f.anchor('f:' + t);
    f.title(`${TIER_NAME[t]} feats`, { color: INK[t], sub: n >= of ? 'every one of them' : `${n} of ${of}` });
    for (const ft of list) row(f, ft);
  }
  return { pages: f.pages, anchors: { ...f.anchors, feats: 'f:index' } };
}

/** one feat: its medal in the margin, the title, what it asks, the day it was won, its progress */
function row(f: Flow, ft: FeatDef) {
  const got = hasFeat(ft.id);
  const tx = TEXT_X + MEDAL_N + 4, tw = TEXT_R - tx;
  const title = titleOf(ft);
  const ds = wrap(descOf(ft), tw);
  const pr = got ? null : featProgress(ft);
  const lines = 1 + ds.length + (pr ? 1 : 0);
  const h = lines * LINE + 2;
  f.need(Math.ceil((h + 3) / LINE) + 1);
  f.anchor('f:' + ft.id);
  const seed = hashStr(ft.id);
  const right = got && featDay(ft.id) > 0 ? `day ${featDay(ft.id)}` : '';
  f.block(h, (c, x, y) => {
    const b0 = y + LINE - 2;
    paintMedal(c.a, kindOf(ft), x - 4, y);
    const ink = got ? INK[ft.tier] : C.pencilLt;
    hand(c.a, title, tx, b0, ink, { bold: got, pencil: !got });
    if (got) plot(c.a, wavyPx(tx - 1, b0 + 2, tx + handW(title, { bold: true }) + 1, seed, 0.4), INK[ft.tier], Infinity, { pencil: true });
    if (right) hand(c.a, right, TEXT_R - handW(right), b0, C.pencil, { pencil: true });
    ds.forEach((l, i) => hand(c.a, l, tx, b0 + (i + 1) * LINE, got ? C.ink : C.pencil, { pencil: !got }));
    if (pr) barAt(c, tx, b0 + (ds.length + 1) * LINE - 6, Math.min(70, tw - 30), pr[0], pr[1], ft.tier, seed);
  });
}

