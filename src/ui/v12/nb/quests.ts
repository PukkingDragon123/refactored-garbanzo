// V12 notebook: the QUESTS tab. An index of what's on Mori's list (the tracked one starred and
// carrying the ribbon), then a page per quest in his handwriting: who asked, the title underlined in
// red, a portrait of whoever asked taped in (or a doodle), the story so far, the steps as a pen
// checklist (done ones ticked and struck through, the current one arrowed and underlined with tally
// marks for progress and the hint in pencil, the next one pencilled in faintly), the reward stamp.
// Steps finished since the notebook was last shown are ticked by the pen as you watch; a finished
// quest gets a DONE stamp. The data and the logic are the quest system's (src/game/quests.ts).

import { game } from '../../../game/game';
import { QUESTS, questStatus, currentStepIndex, trackedQuest } from '../../../game/quests';
import type { QuestDef } from '../../../game/quests';
import { nbSave } from '../notebook';
import { Flow } from './flow';
import type { Page } from './flow';
import { C, TEXT_X, TEXT_R, lineY, hand, handW, photoAt, artOfData, doodleArt, plot, wavyPx, tapeAt } from './art';
import { hashStr } from '../../v11/paper/rng';

const NAMES: Record<string, string> = { story: '', rowan: 'Mori', mori: 'me', crowe: 'Captain Crowe', aroha: 'Aroha', lou: 'Lou', pip: 'Pip', jenna: 'Jenna', joshu: 'Joshu', chunk: 'Chunk' };
const DOODLE_WORDS: [RegExp, string][] = [
  [/\b(fish|catch|rod|smoker)/i, 'fish'], [/\b(storm|wave|sea|boat|ship|kittiwake|engine|deck|kitten|sail|outboard|hull)\b/i, 'boat'],
  [/\bcrab/i, 'crab'], [/\b(shell|beachcomb)/i, 'shell'], [/\b(chunk|dog|pug)\b/i, 'pug'], [/\b(track|footprint|follow)/i, 'footprints'],
  [/\b(photo|camera|pics)/i, 'camera'], [/\b(fire|dinner|breakfast|kitchen|cook)/i, 'fire'], [/\b(camp|tent|sleep|bed)\b/i, 'tent'],
  [/\b(village|find|map|region|ground)\b/i, 'pin'], [/\b(feather|bird|hawk)/i, 'feather'], [/\b(flax|kawakawa|bush|forest|leaf|tea)\b/i, 'leaf'],
  [/\b(fossil|rock|stone)/i, 'mountain'], [/\b(hornet|insect)/i, 'magnifier'], [/\b(rise|morning|day)\b/i, 'sun'],
];
const doodleFor = (q: QuestDef) => { const t = `${q.title} ${q.desc}`; for (const [re, d] of DOODLE_WORDS) if (re.test(t)) return d; return 'star'; };
const whoOf = (q: QuestDef) => NAMES[q.giver] ?? q.giver.charAt(0).toUpperCase() + q.giver.slice(1);
const hasPortrait = (q: QuestDef) => !['story', 'rowan', 'mori'].includes(q.giver);

/** a person's portrait (the dialogue portrait, at its own pixels) */
export async function portraitArt(id: string) {
  try {
    const [{ registerNpcArt }, { renderPortrait }] = await Promise.all([import('../../../art/v11/npcs/register'), import('../../../art/v7')]);
    registerNpcArt();
    const b = renderPortrait(id, 'neutral');
    return artOfData(b.w, b.h, b.data);
  } catch { return null; }
}

export interface QuestBuild { pages: Page[]; anchors: Record<string, string>; fresh: string | null }

export function questPages(): QuestBuild {
  const S = nbSave();
  const tracked = trackedQuest();
  const act = QUESTS.filter(q => questStatus(q.id) === 'active');
  const active = [...act.filter(q => q === tracked), ...act.filter(q => q !== tracked && q.main), ...act.filter(q => q !== tracked && !q.main)];
  const doneAll = QUESTS.filter(q => questStatus(q.id) === 'done');
  // finished quests whose DONE stamp hasn't been inked yet get a full page too
  const freshDone = doneAll.filter(q => !S.done[q.id]);
  const f = new Flow('quests', 'q:index', { head: 'on my list' });
  let fresh: string | null = null;

  // ---- the index
  f.page('q:index');
  f.title('On my list', { sub: `day ${game.save.day || 1}${doneAll.length ? ` · ${doneAll.length} ticked off` : ''}` });
  f.gap(1);
  if (!active.length) f.text('Nothing on the list. Enjoy it while it lasts.', { color: C.pencil, pencil: true });
  for (const q of active) {
    const cur = currentStepIndex(q);
    const star = q === tracked;
    f.check(q.title, star ? 'now' : 'todo', { seed: hashStr(q.id), bold: true, hit: { act: 'goto', arg: 'q:' + q.id } });
    if (star) { const y = lineY(f.line - 1); f.op(c => c.a.blit(doodleArt('star', 9, C.red, { pencil: false }), TEXT_R - 9, y - 9)); }
    const step = q.steps[cur]?.text ?? 'nearly there';
    f.text(step, { color: C.pencil, pencil: true, indent: 12 });
    if (f.room() > 1) f.gap(0);
  }
  if (doneAll.length) {
    f.gap(1);
    f.text(`${doneAll.length} done and dusted (in the back)`, { color: C.blue, hit: { act: 'goto', arg: 'q:done' } });
  }
  f.op(c => c.a.blit(doodleArt('pug', 34, C.pencil, { pencil: true, seed: 4 }), TEXT_R - 36, lineY(19) - 30));

  // ---- a page per quest
  const pageFor = (q: QuestDef, done: boolean) => {
    const seed = hashStr(q.id);
    const st = S.seen[q.id];
    const cur = done ? q.steps.length : currentStepIndex(q);
    if (st === undefined) S.seen[q.id] = done ? q.steps.length : cur;
    const seen = Math.min(S.seen[q.id], cur);
    f.fresh('q:' + q.id, { head: done ? 'done' : q.main ? 'the story' : 'odd jobs' });
    f.anchor('q:' + q.id);
    const from = q.giver === 'story' ? (q.main ? 'the story so far' : '') : q.giver === 'mori' || q.giver === 'rowan' ? 'a note to self' : `asked by ${whoOf(q)}`;
    const top = [q.chapter !== undefined ? `chapter ${q.chapter}` : q.main ? '' : 'odd job', from].filter(Boolean).join(' · ');
    // the portrait (or a doodle) floats right of the title
    if (hasPortrait(q)) {
      const id = q.giver;
      f.float(48, 56, (c, x, y) => {
        const pic = c.pic('portrait:' + id, () => portraitArt(id));
        photoAt(c.a, pic, x, y + 2, 42, 44, { cap: whoOf(q).split(' ').pop(), tape: false, border: 3 });
        tapeAt(c.a, x + 24, y + 3, 18, 6, -8 + (seed % 12), seed);
      });
    } else {
      const d = doodleFor(q);
      f.float(44, 44, (c, x, y) => c.a.blit(doodleArt(d, 44, C.pencil, { pencil: true, seed: seed % 7 }), x, y + 2));
    }
    if (top) f.text(top, { color: C.pencil, pencil: true });
    // the title, struck through when the whole quest is done
    const tl = q.title;
    const doneKey = done && !S.done[q.id] ? 'done:' + q.id : '';
    f.text(tl, { bold: true, scale: 2, color: C.ink });
    const ty = lineY(f.line - 1);
    const strike = wavyPx(TEXT_X - 2, ty - 6, TEXT_X + Math.min(handW(tl, { bold: true, scale: 2 }), f.right(f.line - 1) - TEXT_X) + 2, seed + 3, 0.8);
    const under = wavyPx(TEXT_X - 2, ty + 3, TEXT_X + Math.min(handW(tl, { bold: true, scale: 2 }), f.right(f.line - 1) - TEXT_X) + 4, seed, 0.6);
    f.op(c => {
      plot(c.a, under, C.red);
      if (!done) return;
      const k = doneKey ? c.anim(doneKey) : 1;
      const n = Math.floor(strike.length * Math.min(1, k * 2));
      plot(c.a, strike, C.ink, n, { w: 1 });
    });
    if (q === tracked) f.text('bookmarked: on it now', { color: C.red, pencil: true });
    else if (!done) f.text('follow this one', { color: C.blue, hit: { act: 'track', arg: q.id } });
    f.text(q.desc, { color: C.ink });
    f.clearFloat();
    f.gap(1);
    f.heading(done ? 'all done' : 'to do');
    const last = done ? q.steps.length - 1 : Math.min(q.steps.length - 1, cur + 1);
    for (let i = 0; i <= last; i++) {
      const s = q.steps[i];
      if (i < cur) {
        const isFresh = i >= seen;
        const step = i;
        const anim = isFresh ? { key: `tick:${q.id}:${i}`, dur: 0.9, sound: 'pencil' as const, done: () => { const b = nbSave(); b.seen[q.id] = Math.max(b.seen[q.id] ?? 0, step + 1); game.persist(); } } : undefined;
        if (isFresh && !fresh) fresh = 'q:' + q.id;
        f.check(s.text, 'done', { seed: seed + i, fresh: anim });
      } else if (i === cur) {
        f.check(s.text, 'now', { seed: seed + i });
        const pr = s.progress?.();
        if (pr) {
          const [n, of] = [Math.min(pr[0], 40), Math.min(pr[1], 40)];
          f.block(9, (c, x, y) => {
            let tx = x + 12;
            for (let k = 0; k < of; k++) {
              const g = k % 5 === 4;
              const col = k < n ? C.blue : C.pencilLt;
              if (g) plot(c.a, wavyPx(tx - 14, y + 4, tx, seed + k, 0.3), col, Infinity, { pencil: k >= n });
              else { for (let j = 0; j < 7; j++) if (k < n || (j + k) % 3 !== 0) c.a.px(tx, y + 1 + j, col); tx += 3; }
              if (g) tx += 4;
            }
            hand(c.a, `${pr[0]} of ${pr[1]}`, tx + 4, y + 8, C.pencil, { pencil: true });
          });
        }
        if (s.hint) f.text(s.hint, { color: C.pencil, pencil: true, indent: 12 });
      } else f.check(s.text, 'next', { seed: seed + i });
    }
    const r = q.reward;
    if (r && (r.rp || r.text || r.items?.length)) {
      f.gap(1);
      if (r.rp) f.stamp(`+${r.rp} RP`, { color: '#26408a', deg: -4, lines: 2 });
      const t = r.text ?? (r.items?.length ? 'Something for the pack.' : '');
      if (t) f.text(t, { color: C.pencil, pencil: true });
    }
    if (done) {
      if (f.room() < 4) f.page();
      if (doneKey && !fresh) fresh = 'q:' + q.id;
      f.stamp('Done', { color: '#a8321e', round: true, small: 'ticked off', size: 'lg', deg: -12, x: TEXT_R - 76, lines: 1,
        fresh: doneKey ? { key: doneKey, dur: 0.7, sound: 'stamp', done: () => { const b = nbSave(); b.done[q.id] = 1; b.seen[q.id] = q.steps.length; game.persist(); } } : undefined });
    }
  };
  for (const q of active) pageFor(q, false);
  for (const q of freshDone) pageFor(q, true);

  // ---- done and dusted
  if (doneAll.length) {
    f.fresh('q:done', { head: 'done' });
    f.anchor('q:done');
    f.title('Done & dusted');
    f.gap(1);
    for (const q of doneAll.slice().reverse()) {
      if (S.done[q.id] === undefined && freshDone.includes(q)) { f.check(q.title, 'done', { seed: hashStr(q.id), hit: { act: 'goto', arg: 'q:' + q.id } }); continue; }
      f.check(q.title, 'done', { seed: hashStr(q.id) });
    }
  }
  const anchors = { ...f.anchors, quests: 'q:index' };
  return { pages: f.pages, anchors, fresh };
}
