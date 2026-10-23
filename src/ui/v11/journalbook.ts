// V11: Mori's field journal, the quest log as a real notebook. An olive leather notebook with an
// elastic band; ruled pages; every quest is a handwritten page: the date, the title, a pencil sketch
// of whoever asked (taped in) and a doodle of where it happens, the story so far, the steps as an ink
// checklist (done ones ticked and struck through, the current one arrowed and underlined, the next
// one pencilled in faintly), hints as pencil notes in the margin, progress as tally marks, the
// reward. The tracked quest carries the red ribbon bookmark; "follow this one" moves it. Finished
// quests get a DONE stamp in the back of the book. Steps ticked since the journal was last opened
// are inked in as you watch.
//
// openJournal({ quest }) opens it (J, the touch JOURNAL button, the HUD's note scrap, the pause menu).

import { game } from '../../game/game';
import { QUESTS, QUEST_BY_ID, questStatus, currentStepIndex, trackedQuest } from '../../game/quests';
import type { QuestDef } from '../../game/quests';
import { bucket } from '../../game/v10/store';
import {
  openBook, sketchImg, doodle, svgInk, roughArrow, stamp, tape, checkbox, struck, marked, tallyMarks, paperSfx,
  escHtml as esc, tilt, hashStr, INK_RED,
} from './paper';
import type { BookSection, BookBlock, BookHandle } from './paper';

const CSS = `
#ui .jb .ppb-ct, #ui .jb .ppb-ct * { font-size-adjust: none; }
.jb .ppb-in::before { content: ''; position: absolute; inset: 9% 0 5% 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 22px, rgba(70, 110, 160, 0.2) 22px 24px); }
.jb .ppb-pg.r .ppb-in::before { border-left: 2px solid rgba(190, 70, 60, 0.32); left: 9%; }
.jb .ppb-pg.l .ppb-in::before { border-right: 2px solid rgba(190, 70, 60, 0.32); right: 9%; }
.jb-date { text-align: right; font-size: 20px; line-height: 24px; color: var(--pp-pencil); }
#ui .jb .jb-title { font-family: var(--pp-head); font-size: 37.3333px; line-height: 40px; color: #2a2440; margin: 2px 0 4px; letter-spacing: 0; }
.jb-from { font-size: 20px; line-height: 24px; color: var(--pp-pencil); }
.jb-top { position: relative; min-height: 132px; }
.jb-top .who { position: absolute; right: 0; top: 2px; width: 112px; text-align: center; }
.jb-top .who .pic { position: relative; background: #fbf8f0; padding: 6px 6px 26px; box-shadow: 0 0 0 2px #d6ccb4, 4px 4px 0 2px rgba(34, 22, 8, 0.3); }
.jb-top .who .pic span { position: absolute; left: 0; right: 0; bottom: 2px; font-size: 20px; line-height: 22px; }
.jb-top .head { margin-right: 124px; }
.jb-p { font-size: 20px; line-height: 24px; margin: 4px 0 10px; }
.jb-p.cont { margin-top: 0; }
.jb-steps { list-style: none; margin: 6px 0; padding: 0 0 0 34px; font-size: 20px; line-height: 24px; }
.jb-steps li { position: relative; display: flex; gap: 8px; align-items: flex-start; margin: 6px 0; }
.jb-steps li > .pp-check { margin-top: 0; }
.jb-steps li.done { color: #6a6458; }
.jb-steps li.next { color: #a09684; }
.jb-steps li.next .pp-check { opacity: 0.5; }
.jb-steps li .arw { position: absolute; left: -34px; top: 2px; width: 30px; height: 20px; }
.jb-steps li .tl { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.jb-hint { margin: 2px 0 10px 32px; font-size: 20px; line-height: 24px; color: var(--pp-pencil); }
.jb-hint b { font-weight: 700; }
.jb-rew { display: flex; align-items: center; gap: 12px; margin: 12px 0 6px; font-size: 20px; line-height: 24px; color: var(--pp-pencil); }
.jb-track { display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 0; font-size: 20px; line-height: 24px; color: #26408a; cursor: pointer; }
.jb-track:hover { color: #a8321e; }
.jb-track.on { color: #a8321e; cursor: default; }
.jb-done-st { position: absolute; right: 4%; top: 30%; z-index: 3; }
.jb-inside { text-align: center; padding-top: 10%; }
.jb-inside .t { font-size: 40px; line-height: 48px; color: #2a2440; }
.jb-inside .s { font-size: 20px; line-height: 24px; color: var(--pp-pencil); margin-top: 8px; }
#ui .jb .jb-lab { font-family: var(--pp-label); font-size: 16px; line-height: 18px; letter-spacing: 4px; color: #6a5a40; text-transform: uppercase; }
.jb-idx { list-style: none; margin: 6px 0; padding: 0; font-size: 20px; line-height: 24px; }
.jb-idx li { display: flex; gap: 8px; align-items: flex-start; margin: 8px 0; cursor: pointer; }
.jb-idx li:hover b { color: #a8321e; }
.jb-idx li b { font-weight: 700; }
.jb-idx li small { display: block; font-size: 20px; color: var(--pp-pencil); }
.jb-idx li.dn { color: #6a6458; cursor: default; }
#ui .jb .jb-h { font-family: var(--pp-label); font-size: 16px; line-height: 18px; letter-spacing: 2px; text-transform: uppercase; color: #5a4a34; margin: 14px 0 6px; padding-bottom: 4px; box-shadow: 0 2px 0 rgba(90, 74, 52, 0.35); }
`;
let styled = false;

const NAMES: Record<string, string> = { story: '', rowan: 'Mori', mori: 'me', crowe: 'Captain Crowe', aroha: 'Aroha', lou: 'Lou', pip: 'Pip', jenna: 'Jenna', joshu: 'Joshu', chunk: 'Chunk' };
const DOODLE_WORDS: [RegExp, string][] = [
  [/\b(fish|catch|rod|smoker)/i, 'fish'], [/\b(storm|wave|sea|boat|ship|kittiwake|engine|deck|kitten|sail|outboard|hull)\b/i, 'boat'],
  [/\bcrab/i, 'crab'], [/\b(shell|beachcomb)/i, 'shell'], [/\b(chunk|dog|pug)\b/i, 'pug'], [/\b(track|footprint|follow|joshu)/i, 'footprints'],
  [/\b(photo|camera|pics)/i, 'camera'], [/\b(fire|dinner|breakfast|kitchen|cook)/i, 'fire'], [/\b(camp|tent|sleep|bed)\b/i, 'tent'],
  [/\b(village|find|map|region|ground)\b/i, 'pin'], [/\b(feather|bird|hawk)/i, 'feather'], [/\b(flax|kawakawa|bush|forest|leaf|tea)\b/i, 'leaf'],
  [/\b(fossil|rock|stone)/i, 'mountain'], [/\b(hornet|insect)/i, 'magnifier'], [/\b(rise|morning|day)\b/i, 'sun'],
];
function doodleFor(q: QuestDef): string {
  const t = `${q.title} ${q.desc}`;
  for (const [re, d] of DOODLE_WORDS) if (re.test(t)) return d;
  return 'star';
}

/** steps the journal has already shown as done (so newly finished ones get inked in live) */
const seenB = () => bucket<{ done: Record<string, number> }>('journal', () => ({ done: {} }));

function questBlocks(q: QuestDef, tracked: boolean, ink: { fresh: number }): BookBlock[] {
  const st = questStatus(q.id);
  const done = st === 'done';
  const cur = done ? q.steps.length : currentStepIndex(q);
  const seed = hashStr(q.id);
  const seen = seenB().done[q.id] ?? 0;
  const out: BookBlock[] = [];
  const who = NAMES[q.giver] ?? q.giver;
  const portrait = q.giver !== 'story' && q.giver !== 'rowan' && q.giver !== 'mori' ? game.ui.portraitURL(q.giver, 'neutral') : '';
  const pic = portrait
    ? `<div class="who"><div class="pic" style="transform:rotate(${tilt(seed, 4)})">${sketchImg(portrait, { size: 200, seed, box: ['100%', '92px'], wash: 0.5 })}<span class="pp-hand">${esc(who)}</span>${tape({ seed, w: '60px', style: 'left:26px;top:-10px' })}</div></div>`
    : `<div class="who" style="transform:rotate(${tilt(seed, 6)})">${doodle(doodleFor(q), { size: '100px', pencil: true, seed })}</div>`;
  out.push({ html: `<div class="jb-top"><div class="head"><div class="jb-date pp-hand">${q.chapter !== undefined ? `chapter ${q.chapter}` : q.main ? '' : 'odd job'}</div><div class="jb-title pp-head">${esc(q.title)}</div><div class="jb-from pp-hand">${q.giver === 'story' ? (q.main ? 'the story so far' : '') : q.giver === 'mori' || q.giver === 'rowan' ? 'a note to self' : `asked by ${esc(who)}`}</div>${done ? '' : tracked ? `<div class="jb-track on pp-hand">${doodle('star', { size: '20px', color: INK_RED })} bookmarked: on it now</div>` : `<div class="jb-track pp-hand" data-act="track" data-q="${esc(q.id)}">${doodle('star', { size: '20px', color: '#26408a' })} follow this one</div>`}</div>${pic}${done ? `<span class="jb-done-st">${stamp('Done', { color: 'red', shape: 'round', small: 'ticked off', rot: '-14deg', size: 'lg' })}</span>` : ''}</div>` });
  out.push({ html: esc(q.desc), cls: 'pp-hand jb-p', split: true });
  // the checklist: what's done, what's now, and the next thing pencilled in
  const rows: string[] = [];
  const last = done ? q.steps.length - 1 : Math.min(q.steps.length - 1, cur + 1);
  for (let i = 0; i <= last; i++) {
    const s = q.steps[i];
    const fresh = i < cur && i >= seen;
    if (fresh) ink.fresh++;
    if (i < cur) rows.push(`<li class="done">${checkbox('done', seed + i, fresh)}<span>${struck(esc(s.text), seed + i, fresh)}</span></li>`);
    else if (i === cur) {
      const pr = s.progress?.();
      const [sh, hd] = roughArrow(2, 8, 26, 10, 0.2, { seed: seed + 7 });
      rows.push(`<li class="now"><span class="arw">${svgInk(30, 18, [{ d: sh, c: INK_RED, w: 2 }, { d: hd, c: INK_RED, w: 2 }], { stretch: true })}</span>${checkbox('todo', seed + i)}<span>${marked(esc(s.text), { mode: 'under', seed: seed + i })}${pr ? `<span class="tl">${tallyMarks(Math.min(pr[0], 30), Math.min(pr[1], 30), seed + i)}<span class="pp-hand" style="color:var(--pp-pencil)">${pr[0]} of ${pr[1]}</span></span>` : ''}</span></li>`);
      if (s.hint) rows.push(`<li class="hint-row" style="display:block"><div class="jb-hint pp-hand">${esc(s.hint)}</div></li>`);
    } else rows.push(`<li class="next">${checkbox('todo', seed + i)}<span>${esc(s.text)}</span></li>`);
  }
  out.push({ html: `<div class="jb-h">${done ? 'All done' : 'To do'}</div>`, keep: true });
  out.push({ html: `<ul class="jb-steps pp-hand">${rows.join('')}</ul>` });
  const r = q.reward;
  if (r && (r.rp || r.text || r.items?.length)) {
    out.push({ html: `<div class="jb-rew pp-hand">${r.rp ? stamp(`+${r.rp} RP`, { color: 'blue', rot: '-4deg' }) : ''}<span>${esc(r.text ?? (r.items?.length ? 'Something for the pack.' : ''))}</span></div>` });
  }
  return out;
}

function insidePages(active: QuestDef[], doneN: number, tracked: QuestDef | null): string[] {
  const day = game.save.day || 1;
  const left = `<div class="jb-inside"><div class="jb-lab">Field journal</div><div class="t pp-hand"><b>Mori</b></div><div class="s pp-hand">If found, please return to<br>the Kittiwake (or what's left of her),<br>or to a very worried pug.</div><div style="margin:20px auto 0;width:120px">${doodle('pug', { size: '120px', pencil: true })}</div><div class="s pp-hand" style="margin-top:16px">day ${day}${doneN ? ` · ${doneN} job${doneN === 1 ? '' : 's'} ticked off` : ''}</div></div>`;
  const items = active.map((q, i) => `<li data-act="goto" data-k="q:${esc(q.id)}">${checkbox(q === tracked ? 'now' : 'todo', i + 3)}<span><b>${esc(q.title)}</b>${q === tracked ? ` ${stamp('now', { color: 'red', rot: '-6deg', size: 'sm' })}` : ''}<small>${esc(q.steps[currentStepIndex(q)]?.text ?? 'nearly there')}</small></span></li>`).join('');
  const right = `<div class="jb-h">On my list</div>${active.length ? `<ul class="jb-idx pp-hand">${items}</ul>` : '<div class="pp-hand jb-p">Nothing on the list. Enjoy it while it lasts.</div>'}${doneN ? `<div class="pp-hand" style="font-size:20px;line-height:24px;color:var(--pp-pencil);margin-top:12px" data-act="goto" data-k="j:done">done ones are in the back <span style="color:#26408a;cursor:pointer">(look)</span></div>` : ''}`;
  return [left, right];
}

function doneBlocks(done: QuestDef[]): BookBlock[] {
  const out: BookBlock[] = [{ html: `<div class="jb-inside" style="padding-top:2%"><div class="t pp-hand"><b>Done &amp; dusted</b></div></div>` }];
  out.push({ html: `<ul class="jb-idx pp-hand">${done.map((q, i) => `<li class="dn">${checkbox('done', i + 7)}<span>${struck(`<b>${esc(q.title)}</b>`, i + 7)}<small>${esc(q.desc.split(/(?<=[.!?])\s/)[0] ?? '')}</small></span></li>`).join('')}</ul>` });
  return out;
}

let current: BookHandle | null = null;

/** open Mori's field journal (at a quest, else at the bookmarked one); resolves when closed */
export async function openJournal(o: { quest?: string } = {}): Promise<void> {
  if (current?.isOpen()) { if (o.quest) void current.goto('q:' + o.quest); return current.closed; }
  if (!styled) { styled = true; const s = document.createElement('style'); s.dataset.ui = 'journalbook'; s.textContent = CSS; document.head.appendChild(s); }
  const build = () => {
    const tracked = trackedQuest();
    const act = QUESTS.filter(q => questStatus(q.id) === 'active');
    const active = [...act.filter(q => q === tracked), ...act.filter(q => q !== tracked && q.main), ...act.filter(q => q !== tracked && !q.main)];
    const done = QUESTS.filter(q => questStatus(q.id) === 'done').reverse();
    const ink = { fresh: 0 };
    const sections: BookSection[] = [{ id: 'j:inside', pages: () => insidePages(active, done.length, tracked) }];
    /** a run of quests, each starting on a fresh page (anchored, so goto('q:id') finds it) */
    const run = (list: QuestDef[], trk: QuestDef | null) => list.flatMap(q => questBlocks(q, q === trk, ink).map((b, i) => (i === 0 ? { ...b, brk: true, anchor: 'q:' + q.id } : b)));
    if (active.length) sections.push({
      id: 'j:now', head: { l: 'On my list', r: 'On my list' },
      blocks: () => run(active, tracked),
      shown: () => {
        let inked = false;
        const b = seenB();
        for (const q of active) { const cur = currentStepIndex(q); if ((b.done[q.id] ?? 0) < cur) { b.done[q.id] = cur; inked = true; } }
        if (inked) { game.persist(); paperSfx('pencil'); }
      },
    });
    if (done.length) {
      sections.push({ id: 'j:done', head: { l: 'Done', r: 'Done & dusted' }, blocks: () => doneBlocks(done) });
      sections.push({ id: 'j:donepages', head: { l: 'Done', r: 'Done' }, blocks: () => run(done.slice(0, 12), null) });
    }
    return { sections, ribbons: tracked ? [{ section: 'q:' + tracked.id, color: '#b8321e', label: tracked.title }] : [], tracked };
  };
  const b0 = build();
  const start = o.quest && QUEST_BY_ID[o.quest] && questStatus(o.quest) === 'active' ? 'q:' + o.quest : b0.tracked ? 'q:' + b0.tracked.id : 'j:inside';
  const book = openBook({
    id: 'journal', key: 'KeyJ', cls: 'jb',
    look: { title: 'Field Journal', color: '#3c4a2c', material: 'leather', foil: '#d8c48a', band: '#1a1410 #3a2a20', label: 'Mori<br>field notes', inside: 'kraft', paper: 'journal' },
    sections: b0.sections, ribbons: b0.ribbons,
    start,
    onAct: (act, el, b) => {
      if (act === 'track' && el.dataset.q) {
        game.save.tracked = el.dataset.q;
        game.persist();
        paperSfx('pencil');
        const nb = build();
        b.setSections(nb.sections, undefined, nb.ribbons);
        return true;
      }
      return false;
    },
  });
  current = book;
  await book.closed;
  if (current === book) current = null;
}

