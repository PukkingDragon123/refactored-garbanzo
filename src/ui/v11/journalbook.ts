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
.jb .ppb-in::before { content: ''; position: absolute; inset: 9% 0 5% 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 calc(1.45em - 1px), rgba(70, 110, 160, 0.16) calc(1.45em - 1px) 1.45em); }
.jb .ppb-pg.r .ppb-in::before { border-left: 1px solid rgba(190, 70, 60, 0.28); left: 9%; }
.jb .ppb-pg.l .ppb-in::before { border-right: 1px solid rgba(190, 70, 60, 0.28); right: 9%; }
.jb-date { text-align: right; font-size: 1.15em; color: var(--pp-pencil); margin-bottom: 0.1em; }
.jb-title { font-size: 1.85em; line-height: 0.98; color: #2a2440; margin: 0.05em 0 0.15em; }
.jb-from { font-size: 1.12em; color: var(--pp-pencil); }
.jb-top { position: relative; min-height: 6.6em; }
.jb-top .who { position: absolute; right: 0; top: 0.1em; width: 5.6em; text-align: center; }
.jb-top .who .pic { position: relative; background: #fbf8f0; padding: 0.3em 0.3em 1.3em; box-shadow: 0 0.1em 0.3em rgba(40, 28, 10, 0.35); }
.jb-top .who .pic span { position: absolute; left: 0; right: 0; bottom: 0.1em; font-size: 1.05em; }
.jb-top .head { margin-right: 6.4em; }
.jb-p { font-size: 1.22em; line-height: 1.1; margin: 0.25em 0 0.45em; }
.jb-p.cont { margin-top: 0; }
.jb-steps { list-style: none; margin: 0.3em 0; padding: 0; font-size: 1.22em; line-height: 1.08; }
.jb-steps li { position: relative; display: flex; gap: 0.45em; align-items: flex-start; margin: 0.32em 0; }
.jb-steps li.done { color: #6a6458; }
.jb-steps li.next { color: #a09684; }
.jb-steps li.next .pp-check { opacity: 0.5; }
.jb-steps li .arw { position: absolute; left: -1.75em; top: 0.05em; width: 1.5em; height: 1em; }
.jb-steps li .tl { display: block; margin-top: 0.15em; }
.jb-hint { margin: 0.2em 0 0.5em 1.4em; font-size: 1.05em; line-height: 1.08; color: var(--pp-pencil); transform: rotate(-0.8deg); }
.jb-hint b { font-weight: 700; }
.jb-rew { display: flex; align-items: center; gap: 0.6em; margin: 0.6em 0 0.3em; font-size: 1.1em; color: var(--pp-pencil); }
.jb-track { display: inline-block; margin: 0.5em 0 0; font-size: 1.15em; color: #26408a; cursor: pointer; }
.jb-track:hover { color: #a8321e; }
.jb-track.on { color: #a8321e; cursor: default; }
.jb-done-st { position: absolute; right: 4%; top: 22%; z-index: 3; font-size: 1.3em; }
.jb-inside { text-align: center; padding-top: 10%; }
.jb-inside .t { font-size: 2.4em; color: #2a2440; line-height: 1; }
.jb-inside .s { font-size: 1.3em; color: var(--pp-pencil); margin-top: 0.4em; line-height: 1.15; }
.jb-idx { list-style: none; margin: 0.3em 0; padding: 0; font-size: 1.2em; line-height: 1.08; }
.jb-idx li { display: flex; gap: 0.45em; align-items: flex-start; margin: 0.32em 0; cursor: pointer; }
.jb-idx li:hover b { color: #a8321e; }
.jb-idx li b { font-weight: 700; }
.jb-idx li small { display: block; font-size: 0.85em; color: var(--pp-pencil); }
.jb-idx li.dn { color: #6a6458; cursor: default; }
.jb-h { font-size: 0.9em; letter-spacing: 0.14em; text-transform: uppercase; color: #5a4a34; margin: 0.6em 0 0.2em; }
`;
let styled = false;

const NAMES: Record<string, string> = { story: '', rowan: 'Mori', mori: 'me', crowe: 'Captain Crowe', aroha: 'Aroha', lou: 'Lou', pip: 'Pip', jenna: 'Jenna', joshu: 'Joshu', chunk: 'Chunk' };
const DOODLE_WORDS: [RegExp, string][] = [
  [/fish|catch|rod|smoker/i, 'fish'], [/storm|wave|sea|boat|ship|kittiwake|engine|deck|kitten|sail|outboard|hull/i, 'boat'],
  [/crab/i, 'crab'], [/shell|beachcomb/i, 'shell'], [/chunk|dog|pug/i, 'pug'], [/track|footprint|follow|joshu/i, 'footprints'],
  [/photo|camera|pics/i, 'camera'], [/fire|dinner|breakfast|kitchen|cook/i, 'fire'], [/camp|tent|sleep|bed/i, 'tent'],
  [/village|find|map|region|ground/i, 'pin'], [/feather|bird|hawk/i, 'feather'], [/flax|kawakawa|bush|forest|leaf|tea/i, 'leaf'],
  [/fossil|rock|stone/i, 'mountain'], [/hornet|insect/i, 'magnifier'], [/rise|morning|day/i, 'sun'],
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
    ? `<div class="who"><div class="pic" style="transform:rotate(${tilt(seed, 4)})">${sketchImg(portrait, { size: 200, seed, box: ['100%', '4.6em'], wash: 0.5 })}<span class="pp-hand">${esc(who)}</span>${tape({ seed, w: '3em', style: 'left:1.3em;top:-0.55em' })}</div></div>`
    : `<div class="who" style="transform:rotate(${tilt(seed, 6)})">${doodle(doodleFor(q), { size: '5em', pencil: true, seed })}</div>`;
  out.push({ html: `<div class="jb-top"><div class="head"><div class="jb-date pp-hand">${q.chapter !== undefined ? `chapter ${q.chapter}` : q.main ? '' : 'odd job'}</div><div class="jb-title pp-head">${esc(q.title)}</div><div class="jb-from pp-hand">${q.giver === 'story' ? (q.main ? 'the story so far' : '') : q.giver === 'mori' || q.giver === 'rowan' ? 'a note to self' : `asked by ${esc(who)}`}</div></div>${pic}${done ? `<span class="jb-done-st">${stamp('Done', { color: 'red', shape: 'round', small: 'ticked off', rot: '-14deg' })}</span>` : ''}</div>` });
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
      rows.push(`<li class="now"><span class="arw">${svgInk(30, 18, [{ d: sh, c: INK_RED, w: 2 }, { d: hd, c: INK_RED, w: 2 }], { stretch: true })}</span>${checkbox('todo', seed + i)}<span>${marked(esc(s.text), { mode: 'under', seed: seed + i })}${pr ? `<span class="tl">${tallyMarks(Math.min(pr[0], 30), Math.min(pr[1], 30), seed + i)}<span class="pp-hand" style="font-size:0.8em;color:var(--pp-pencil)"> ${pr[0]} of ${pr[1]}</span></span>` : ''}</span></li>`);
      if (s.hint) rows.push(`<li class="hint-row" style="display:block"><div class="jb-hint pp-hand">${esc(s.hint)}</div></li>`);
    } else rows.push(`<li class="next">${checkbox('todo', seed + i)}<span>${esc(s.text)}</span></li>`);
  }
  out.push({ html: `<div class="pp-hand jb-h" style="font-family:var(--pp-pix)">${done ? 'All done' : 'To do'}</div>`, keep: true });
  out.push({ html: `<ul class="jb-steps pp-hand">${rows.join('')}</ul>` });
  const r = q.reward;
  if (r && (r.rp || r.text || r.items?.length)) {
    out.push({ html: `<div class="jb-rew pp-hand">${r.rp ? stamp(`+${r.rp} RP`, { color: 'blue', rot: '-4deg' }) : ''}<span>${esc(r.text ?? (r.items?.length ? 'Something for the pack.' : ''))}</span></div>` });
  }
  if (!done) out.push({ html: tracked ? `<div class="jb-track on pp-hand">${doodle('star', { size: '1em', color: INK_RED })} bookmarked: this is what I'm on</div>` : `<div class="jb-track pp-hand" data-act="track" data-q="${esc(q.id)}">${doodle('star', { size: '1em', color: '#26408a' })} follow this one</div>` });
  return out;
}

function insidePages(active: QuestDef[], doneN: number, tracked: QuestDef | null): string[] {
  const day = game.save.day || 1;
  const left = `<div class="jb-inside"><div class="pp-pix" style="font-size:0.85em;letter-spacing:0.3em;color:#6a5a40">FIELD JOURNAL</div><div class="t pp-head">Mori</div><div class="s pp-hand">If found, please return to<br>the Kittiwake (or what's left of her),<br>or to a very worried pug.</div><div style="margin:1em auto 0;width:6em;transform:rotate(-6deg)">${doodle('pug', { size: '6em', pencil: true })}</div><div class="s pp-hand" style="margin-top:0.8em">day ${day}${doneN ? ` · ${doneN} job${doneN === 1 ? '' : 's'} ticked off` : ''}</div></div>`;
  const items = active.map((q, i) => `<li data-act="goto" data-k="q:${esc(q.id)}">${checkbox(q === tracked ? 'now' : 'todo', i + 3)}<span><b>${esc(q.title)}</b>${q === tracked ? ` ${stamp('now', { color: 'red', rot: '-6deg', style: 'font-size:0.5em' })}` : ''}<small>${esc(q.steps[currentStepIndex(q)]?.text ?? 'nearly there')}</small></span></li>`).join('');
  const right = `<div class="jb-h pp-pix">On my list</div>${active.length ? `<ul class="jb-idx pp-hand">${items}</ul>` : '<div class="pp-hand jb-p">Nothing on the list. Enjoy it while it lasts.</div>'}${doneN ? `<div class="pp-hand" style="font-size:1.05em;color:var(--pp-pencil);margin-top:0.6em" data-act="goto" data-k="j:done">done ones are in the back <span style="color:#26408a;cursor:pointer">(look)</span></div>` : ''}`;
  return [left, right];
}

function doneBlocks(done: QuestDef[]): BookBlock[] {
  const out: BookBlock[] = [{ html: `<div class="jb-inside" style="padding-top:2%"><div class="t pp-head" style="font-size:2em">Done &amp; dusted</div></div>` }];
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
    for (const q of active) sections.push({
      id: 'q:' + q.id, head: { l: q.main ? 'Story' : 'Odd jobs', r: q.title },
      blocks: () => questBlocks(q, q === tracked, ink),
      shown: () => {
        const cur = currentStepIndex(q);
        const b = seenB();
        if ((b.done[q.id] ?? 0) < cur) { b.done[q.id] = cur; game.persist(); paperSfx('pencil'); }
      },
    });
    if (done.length) {
      sections.push({ id: 'j:done', head: { l: 'Done', r: 'Done & dusted' }, blocks: () => doneBlocks(done) });
      for (const q of done.slice(0, 12)) sections.push({ id: 'q:' + q.id, head: { l: 'Done', r: q.title }, blocks: () => questBlocks(q, false, ink) });
    }
    return { sections, ribbons: tracked ? [{ section: 'q:' + tracked.id, color: '#b8321e', label: tracked.title }] : [], tracked };
  };
  const b0 = build();
  const start = o.quest && QUEST_BY_ID[o.quest] ? 'q:' + o.quest : b0.tracked ? 'q:' + b0.tracked.id : 'j:inside';
  const book = openBook({
    id: 'journal', key: 'KeyJ', cls: 'jb',
    look: { title: 'Field Journal', color: '#3c4a2c', material: 'leather', foil: '#d8c48a', band: 'linear-gradient(90deg,#1a1410,#3a2a20,#1a1410)', label: 'Mori<br><small style="font-size:0.7em">field notes</small>', inside: 'kraft', paper: 'journal' },
    sections: b0.sections, ribbons: b0.ribbons,
    start: b0.sections.some(s => s.id === start) ? start : 'j:inside',
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

