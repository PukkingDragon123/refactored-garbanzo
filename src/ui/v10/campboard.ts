// V11 the camp board: a cork board on two driftwood posts, covered in pinned notes. The crew's
// requests are handwritten on whatever paper they had (Jenna's graph paper, Joshu's kraft, Aroha's
// flax paper), each with the asker's photo pinned to the corner; the agency's come in over the radio
// and are pinned up as typed telex slips. New notes have a red pin and a NEW stamp; taken ones get
// Mori's initial; ready ones a HAND IN stamp; done ones are struck through and pushed down to the
// done pile. Click a note to take it down and read it (take it on, hand things in), Esc to step back.

import { game } from '../../game/game';
import { uiIconURL, itemIconURL } from '../../art/itemicons';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { REQUESTS, reqState, acceptReq, handIn } from '../../game/v10/campquests';
import type { Req, ReqState } from '../../game/v10/campquests';
import { bucket } from '../../game/v10/store';
import { el } from '../ui';
import { pushKeys } from '../laptop-kit';
import { guardInput } from '../../core/input';
import {
  installPaper, paperTex, coverTex, edgeClip, pin, stamp, checkbox, struck, tallyMarks, polaroid, svgInk, roughRect, roughLine, paperSfx,
  escHtml as esc, tilt, hashStr,
} from '../v11/paper';
import type { PaperKind } from '../v11/paper';

const seenB = () => bucket<{ seen: string[] }>('board', () => ({ seen: [] }));

/** a request waiting to be handed in, or a new one nobody has looked at */
export function news(): boolean {
  const seen = seenB().seen;
  return REQUESTS.some(r => { const s = reqState(r); return s === 'ready' || (s === 'open' && !seen.includes(r.id)); });
}

const GIVER: Record<string, string> = { jenna: 'Jenna', joshu: 'Joshu', aroha: 'Aroha', agency: 'Field office' };
const PAPER: Record<string, PaperKind> = { jenna: 'graph', joshu: 'kraft', aroha: 'flax', agency: 'telex' };
const PIN: Record<ReqState, 'red' | 'blue' | 'green' | 'yellow' | 'white'> = { open: 'red', active: 'blue', ready: 'green', done: 'white', locked: 'white' };

const CSS = `
.cb-wrap { position: absolute; inset: 0; z-index: 62; display: flex; align-items: center; justify-content: center; pointer-events: auto; background: radial-gradient(ellipse at 50% 50%, rgba(16,10,4,0.4), rgba(6,3,1,0.8)); animation: cbFade 0.3s ease-out both; }
@keyframes cbFade { from { opacity: 0; } }
.cb-board { position: relative; width: min(96vw, 64em); height: min(92vh, 38em); padding: 1.1em; border-radius: 0.4em; animation: cbUp 0.5s cubic-bezier(.2,1.25,.4,1) both;
  box-shadow: 0 1.2em 2.4em rgba(0,0,0,0.6), inset 0 0 0 0.2em rgba(255,240,200,0.12); }
@keyframes cbUp { from { transform: translateY(60%) rotate(-3deg); } }
.cb-board.bye { animation: cbDown 0.35s ease-in both; }
@keyframes cbDown { to { transform: translateY(70%) rotate(3deg); opacity: 0; } }
.cb-cork { position: absolute; inset: 1.1em; overflow-y: auto; overflow-x: hidden; box-shadow: inset 0 0.3em 0.8em rgba(40,20,0,0.55); border-radius: 0.15em; scrollbar-width: thin; }
.cb-grid { position: relative; display: grid; grid-template-columns: 3fr 2fr; gap: 0 1.4em; padding: 1.4em 1.6em 2em; min-height: 100%; }
.cb-col h3 { margin: 0 0 0.6em; display: inline-block; padding: 0.2em 0.8em; font-size: 1.05em; letter-spacing: 0.12em; text-transform: uppercase; color: #2a1e10; transform: rotate(-1.5deg); box-shadow: 0 0.12em 0.2em rgba(0,0,0,0.35); }
.cb-notes { display: flex; flex-wrap: wrap; gap: 1.1em 1em; align-items: flex-start; }
.cb-n { position: relative; width: 12.5em; cursor: pointer; transition: transform 0.2s; filter: drop-shadow(0 0.25em 0.3em rgba(30,15,0,0.5)); }
.cb-n:hover, .cb-n.sel { transform: translateY(-0.25em) rotate(0deg) !important; z-index: 3; }
.cb-n.sel { filter: drop-shadow(0 0 0.25em #ffe08a) drop-shadow(0 0.35em 0.35em rgba(30,15,0,0.5)); }
.cb-n .in { padding: 0.95em 0.85em 0.8em; color: var(--pp-ink); background-size: 256px 256px; min-height: 7em; }
.cb-n .t { font-size: 1.35em; font-weight: 700; line-height: 1; margin-right: 1.8em; }
.cb-n .who { font-size: 1em; color: var(--pp-pencil); margin: 0.1em 0 0.25em; }
.cb-n .d { font-size: 1.05em; line-height: 1.05; }
.cb-n .stp { margin-top: 0.35em; font-size: 1.05em; line-height: 1.05; display: flex; gap: 0.35em; align-items: flex-start; }
.cb-n .rw { margin-top: 0.4em; display: flex; flex-wrap: wrap; gap: 0.3em 0.6em; align-items: center; font-size: 0.95em; }
.cb-n .rw img { width: 1.4em; height: 1.4em; image-rendering: pixelated; vertical-align: middle; }
.cb-n .ph { position: absolute; right: -0.9em; top: -0.8em; width: 3.4em; z-index: 2; }
.cb-n .ph .pp-polaroid { padding: 0.2em 0.2em 0.7em; }
.cb-n .st { position: absolute; left: 50%; bottom: -0.3em; transform: translateX(-50%); z-index: 3; font-size: 0.8em; pointer-events: none; }
.cb-n .pp-pin { left: 46%; top: -0.4em; }
.cb-n .ini { position: absolute; right: 0.5em; bottom: 0.3em; font-size: 1.5em; color: #26408a; transform: rotate(-10deg); }
.cb-n.agency .in { font-size: 0.92em; }
.cb-n.agency .t, .cb-n.agency .d, .cb-n.agency .who { font-family: var(--pp-type); font-size-adjust: 0.56; font-weight: 400; }
.cb-n.agency .t { font-size: 1.05em; text-transform: uppercase; letter-spacing: 0.04em; }
.cb-n.agency .d { font-size: 0.85em; line-height: 1.25; }
.cb-n.done { width: 9em; opacity: 0.85; }
.cb-n.done .in { min-height: 0; }
.cb-n.done .d, .cb-n.done .stp, .cb-n.done .rw { display: none; }
.cb-empty { width: 14em; }
.cb-empty .in { padding: 1em; font-size: 1.15em; color: var(--pp-pencil); background-size: 256px; }
.cb-pile { grid-column: 1 / -1; margin-top: 1.4em; padding-top: 0.6em; border-top: 0.12em dashed rgba(60,30,0,0.35); }
.cb-pile .cb-notes { gap: 0.5em; }
.cb-sign { position: absolute; left: 50%; top: -0.9em; transform: translateX(-50%) rotate(-1deg); padding: 0.25em 1.2em; font-size: 1.35em; letter-spacing: 0.14em; color: #f4e6c4; z-index: 5;
  box-shadow: 0 0.2em 0.3em rgba(0,0,0,0.45); text-shadow: 0 0.08em 0 rgba(0,0,0,0.6); }
.cb-x { position: absolute; right: -0.6em; top: -0.8em; width: 2.6em; height: 2.6em; cursor: pointer; z-index: 6; filter: drop-shadow(0 0.1em 0.15em rgba(0,0,0,0.5)); transition: transform 0.15s; }
.cb-x:hover { transform: rotate(-8deg) scale(1.1); }
.cb-rp { position: absolute; right: 2.2em; top: -0.7em; z-index: 5; }
.cb-zoom { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(20,10,0,0.6); }
.cb-zoom .cb-n { width: min(24em, 86vw); font-size: 1.15em; cursor: default; animation: cbLift 0.35s cubic-bezier(.2,1.3,.4,1) both; transform: rotate(-1deg) !important; }
@keyframes cbLift { from { transform: scale(0.6) rotate(-6deg); opacity: 0; } }
.cb-zoom .acts { display: flex; gap: 1.2em; justify-content: center; margin-top: 0.8em; }
.cb-act { position: relative; display: inline-block; padding: 0.2em 0.9em 0.3em; font-size: 1.45em; font-weight: 700; color: #26408a; cursor: pointer; background: #f4ead0; box-shadow: 0 0.15em 0.3em rgba(0,0,0,0.45); transform: rotate(-1.5deg); }
.cb-act + .cb-act { transform: rotate(1.2deg); }
.cb-act svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.cb-act:hover { color: #a8321e; }
.cb-act.dim { color: #8a8070; cursor: default; }
.cb-msg { text-align: center; font-size: 1.2em; color: #fbefd0; margin-top: 0.6em; text-shadow: 0 0.05em 0.3em rgba(0,0,0,0.8); min-height: 1.3em; }
@media (max-width: 720px) { .cb-grid { grid-template-columns: 1fr; } .cb-n { width: 11em; } }
`;
let styled = false;

function noteHtml(r: Req, s: ReqState, big = false): string {
  const seed = hashStr(r.id);
  const kind = PAPER[r.giver] ?? 'journal';
  const face = r.giver === 'agency' ? uiIconURL('battery', 3) : game.ui.portraitURL(r.giver, 'neutral');
  const steps = s === 'open' && !big ? '' : r.steps.map((st, i) => {
    const ok = st.done();
    const pr = st.progress?.();
    return `<div class="stp pp-hand">${checkbox(ok ? 'done' : 'todo', seed + i)}<span>${ok ? struck(esc(st.text), seed + i) : esc(st.text)}${pr && !ok ? ` ${tallyMarks(Math.min(pr[0], 12), Math.min(pr[1], 12), seed + i)}` : ''}</span></div>`;
  }).join('');
  const give = s === 'ready' && r.give ? `<div class="rw pp-hand">${r.give.map(([id, n]) => `<span><img src="${itemIconURL(id, 2)}" alt=""> ${Math.min(count(id), 99)}/${n} ${esc(ITEMS[id]?.name ?? id)}</span>`).join('')}</div>` : '';
  const rw = [r.reward.rp ? stamp(`+${r.reward.rp} RP`, { color: 'blue', rot: '-4deg', style: 'font-size:0.62em' }) : '', ...(r.reward.items ?? []).map(([id, n]) => `<span><img src="${itemIconURL(id, 2)}" alt=""> ${n} ${esc(ITEMS[id]?.name ?? id)}</span>`)].join('');
  const st = s === 'open' ? stamp('New', { color: 'red', rot: '-8deg' }) : s === 'ready' ? stamp('Hand in', { color: 'green', rot: '6deg' }) : s === 'done' ? stamp('Done', { color: 'red', rot: '-10deg' }) : '';
  const clip = edgeClip(seed, r.giver === 'agency' ? { top: 'perforated', bottom: 'perforated' } : { top: 'deckle', right: 'deckle', bottom: 'torn', left: 'deckle', amp: 0.7 });
  return `${pin({ color: PIN[s] })}${face && s !== 'done' ? `<div class="ph" style="transform:rotate(${tilt(seed + 3, 8)})">${polaroid(face, '', { w: '100%' })}</div>` : ''}<div class="in pp-hand" style="background-image:${paperTex(kind)};clip-path:${clip}">
    <div class="t">${s === 'done' ? struck(esc(r.title), seed) : esc(r.title)}</div><div class="who">${r.giver === 'agency' ? 'HALCYON FIELD OFFICE' : `from ${esc(GIVER[r.giver])}`}</div>
    <div class="d">${esc(r.desc)}</div>${steps}${give}${s !== 'done' ? `<div class="rw">${rw}</div>` : ''}${s === 'active' || s === 'ready' ? '<span class="ini">M.</span>' : ''}</div>${st ? `<span class="st">${st}</span>` : ''}`;
}

const button = (label: string, act: string, seed: number, dim = false) =>
  `<span class="cb-act pp-hand${dim ? ' dim' : ''}" data-a="${act}">${svgInk(100, 40, [{ d: roughRect(3, 4, 94, 32, { seed, rough: 1 }), c: dim ? '#8a8070' : '#26408a', w: 2 }], { stretch: true })}${esc(label)}</span>`;

export async function openBoard(): Promise<void> {
  installPaper();
  if (!styled) { styled = true; document.head.appendChild(el('style', '', CSS)); }
  const wrap = el('div', 'cb-wrap');
  const board = wrap.appendChild(el('div', 'cb-board'));
  board.style.background = `${coverTex('leather', '#6a4422')} 0 0 / 256px`;
  board.innerHTML = `<div class="cb-sign pp-head" style="background:${coverTex('leather', '#4a2e14')} 0 0/256px">CAMP BOARD</div><div class="cb-x" title="Close (Esc)">${svgInk(40, 40, [{ d: roughLine(10, 10, 30, 30, { seed: 2 }) + roughLine(30, 9, 9, 31, { seed: 4 }), c: '#f4e6c4', w: 3.6 }])}</div><div class="cb-cork"><div class="cb-grid"></div></div>`;
  const cork = board.querySelector('.cb-cork') as HTMLElement;
  cork.style.background = `${paperTex('cork')} 0 0 / 256px`;
  const grid = board.querySelector('.cb-grid') as HTMLElement;
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  game.covered++;
  paperSfx('slide');
  let res: () => void = () => {};
  const closed = new Promise<void>(r => (res = r));
  let zoom: HTMLElement | null = null;
  let sel = -1;
  let ids: string[] = [];

  const render = () => {
    const vis = (r: Req) => reqState(r) !== 'locked';
    const order = (r: Req) => ({ ready: 0, open: 1, active: 2, done: 3, locked: 4 }[reqState(r)]);
    const crew = REQUESTS.filter(r => r.giver !== 'agency' && vis(r) && reqState(r) !== 'done').sort((a, b) => order(a) - order(b));
    const ag = REQUESTS.filter(r => r.giver === 'agency' && vis(r) && reqState(r) !== 'done').sort((a, b) => order(a) - order(b));
    const done = REQUESTS.filter(r => reqState(r) === 'done');
    const empty = (txt: string, seed: number) => `<div class="cb-n cb-empty" style="transform:rotate(${tilt(seed, 3)})">${pin({ color: 'yellow' })}<div class="in pp-hand" style="background-image:${paperTex('journal')};clip-path:${edgeClip(seed, { bottom: 'torn' })}">${esc(txt)}</div></div>`;
    const col = (title: string, list: Req[], emptyTxt: string, bg: string) => `<div class="cb-col"><h3 class="pp-pix" style="background:${bg}">${esc(title)}</h3><div class="cb-notes">${list.length ? list.map(r => `<div class="cb-n ${r.giver}" data-id="${r.id}" style="transform:rotate(${tilt(r.id, 3)}) translateY(${(hashStr(r.id) % 7) / 10}em)">${noteHtml(r, reqState(r))}</div>`).join('') : empty(emptyTxt, title.length)}</div></div>`;
    grid.innerHTML = col('Crew requests', crew, 'Nothing pinned up yet. Check back tomorrow.', `${paperTex('card')} 0 0/256px`)
      + col('Field office', ag, game.save.flags['v10:agency'] ? 'No requests from the office right now.' : 'Jenna is still trying to get the radio working.', `${paperTex('telex')} 0 0/256px`)
      + (done.length ? `<div class="cb-pile"><h3 class="pp-pix" style="background:${paperTex('kraft')} 0 0/256px;font-size:0.85em">Done pile</h3><div class="cb-notes">${done.map(r => `<div class="cb-n done ${r.giver}" data-id="${r.id}" style="transform:rotate(${tilt(r.id, 6)})">${noteHtml(r, 'done')}</div>`).join('')}</div></div>` : '');
    ids = [...crew, ...ag].map(r => r.id);
    if (sel >= ids.length) sel = ids.length - 1;
    highlight();
    // everything on the board has now been seen
    const seen = seenB().seen;
    for (const r of REQUESTS) if (reqState(r) === 'open' && !seen.includes(r.id)) seen.push(r.id);
    game.persist();
  };
  const highlight = () => grid.querySelectorAll('.cb-n[data-id]').forEach(n => n.classList.toggle('sel', sel >= 0 && (n as HTMLElement).dataset.id === ids[sel]));

  const lift = (id: string) => {
    const r = REQUESTS.find(x => x.id === id);
    if (!r) return;
    const s = reqState(r);
    zoom?.remove();
    zoom = board.appendChild(el('div', 'cb-zoom'));
    const canGive = s === 'ready' && !!r.give && r.give.every(([it, n]) => count(it) >= n);
    zoom.innerHTML = `<div><div class="cb-n ${r.giver}">${noteHtml(r, s, true)}</div><div class="acts">${s === 'open' ? button('Take it on', 'take', 3) : ''}${s === 'ready' ? button('Hand in', 'give', 4, !canGive) : ''}${button('Pin it back', 'back', 5)}</div><div class="cb-msg pp-hand"></div></div>`;
    paperSfx('pin', 0.7);
    zoom.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (e.target === zoom || a?.dataset.a === 'back') { unlift(); return; }
      if (!a) return;
      const msg = zoom!.querySelector('.cb-msg') as HTMLElement;
      if (a.dataset.a === 'take') {
        acceptReq(r.id);
        paperSfx('pencil');
        unlift(true);
      } else if (a.dataset.a === 'give') {
        if (handIn(r.id)) { paperSfx('stamp'); unlift(true); }
        else { paperSfx('tick', 0.6); msg.textContent = 'Not everything is in my pack yet.'; }
      }
    });
  };
  const unlift = (changed = false) => {
    if (!zoom) return;
    zoom.remove();
    zoom = null;
    paperSfx('pin', 0.5);
    if (changed) render();
  };
  grid.addEventListener('click', e => {
    const n = (e.target as HTMLElement).closest('.cb-n[data-id]') as HTMLElement | null;
    if (n) { sel = ids.indexOf(n.dataset.id!); lift(n.dataset.id!); }
  });

  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    popKeys();
    paperSfx('slide', 0.7);
    board.classList.add('bye');
    wrap.style.transition = 'opacity 0.35s';
    wrap.style.opacity = '0';
    setTimeout(() => {
      wrap.remove();
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      game.covered = Math.max(0, game.covered - 1);
      guardInput(300);
      res();
    }, 340);
  };
  (board.querySelector('.cb-x') as HTMLElement).addEventListener('click', close);
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  const popKeys = pushKeys(e => {
    const c = e.code;
    if (c === 'Escape' || c === 'Tab') { if (zoom) unlift(); else close(); return true; }
    if (zoom) {
      if (c === 'Enter' || c === 'Space' || c === 'KeyE') (zoom.querySelector('.cb-act:not(.dim)') as HTMLElement | null)?.click();
      return true;
    }
    if (c === 'ArrowRight' || c === 'ArrowDown' || c === 'KeyD' || c === 'KeyS') { if (ids.length) { sel = (sel + 1) % ids.length; highlight(); paperSfx('tick', 0.3); } return true; }
    if (c === 'ArrowLeft' || c === 'ArrowUp' || c === 'KeyA' || c === 'KeyW') { if (ids.length) { sel = (sel - 1 + ids.length) % ids.length; highlight(); paperSfx('tick', 0.3); } return true; }
    if ((c === 'Enter' || c === 'Space' || c === 'KeyE') && sel >= 0 && ids[sel]) { lift(ids[sel]); return true; }
    return true;
  });
  render();
  await closed;
}
