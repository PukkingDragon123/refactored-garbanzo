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
  escHtml as esc, tilt, hashStr, nudge, pxCanvas, spriteURL, Art, col, dith, shadeC, coverArtOf,
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
.cb-wrap { position: absolute; inset: 0; z-index: 62; display: flex; align-items: center; justify-content: center; pointer-events: auto; background: rgba(14, 8, 3, 0.62); animation: cbFade 0.3s steps(4) both; }
.cb-wrap > .pp-cv.vg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
#ui .cb-wrap, #ui .cb-wrap * { font-size-adjust: none; }
@keyframes cbFade { from { opacity: 0; } }
.cb-board { position: relative; isolation: isolate; width: min(96vw, 1240px); height: min(92vh, 740px); padding: 22px; animation: cbUp 0.5s steps(8) both; }
.cb-board > .pp-bgcv.frame { width: calc(100% + 8px); height: calc(100% + 8px); }
@keyframes cbUp { from { transform: translateY(60%); } 70% { transform: translateY(-2%); } }
.cb-board.bye { animation: cbDown 0.35s steps(6) both; }
@keyframes cbDown { to { transform: translateY(70%); opacity: 0; } }
.cb-cork { position: absolute; inset: 22px; overflow-y: auto; overflow-x: hidden; box-shadow: inset 6px 6px 0 rgba(40, 20, 0, 0.45), inset 0 0 0 2px #2a1608; scrollbar-width: thin; image-rendering: pixelated; }
.cb-grid { position: relative; display: grid; grid-template-columns: 3fr 2fr; gap: 0 28px; padding: 28px 32px 40px; min-height: 100%; }
#ui .cb-col h3 { margin: 0 0 14px; display: inline-block; padding: 4px 16px 6px; font-family: var(--pp-label); font-size: 16px; line-height: 18px; letter-spacing: 2px; text-transform: uppercase; color: #2a1e10; box-shadow: 0 0 0 2px #2a1608, 4px 4px 0 2px rgba(0,0,0,0.35); }
.cb-notes { display: flex; flex-wrap: wrap; gap: 26px 22px; align-items: flex-start; }
.cb-n { position: relative; width: 250px; cursor: pointer; transition: transform 0.12s steps(2); filter: drop-shadow(4px 6px 0 rgba(30, 15, 0, 0.45)); }
.cb-n:hover, .cb-n.sel { transform: translateY(-4px) !important; z-index: 3; }
.cb-n.sel { filter: drop-shadow(0 0 0 #ffe08a) drop-shadow(2px 0 0 #ffe08a) drop-shadow(-2px 0 0 #ffe08a) drop-shadow(0 2px 0 #ffe08a) drop-shadow(0 -2px 0 #ffe08a) drop-shadow(4px 8px 0 rgba(30,15,0,0.45)); }
.cb-n .in { padding: 20px 16px 16px; color: var(--pp-ink); background-size: 256px 256px; min-height: 140px; image-rendering: pixelated; font-size: 20px; line-height: 24px; }
.cb-n .t { font-size: 20px; line-height: 24px; font-weight: 700; margin-right: 36px; }
.cb-n .who { color: var(--pp-pencil); margin: 2px 0 6px; }
.cb-n .stp { margin-top: 6px; display: flex; gap: 8px; align-items: flex-start; }
.cb-n .rw { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
.cb-n .rw img { width: 32px; height: 32px; image-rendering: pixelated; vertical-align: middle; }
.cb-n .ph { position: absolute; right: -16px; top: -16px; width: 68px; z-index: 2; }
.cb-n .ph .pp-polaroid { padding: 4px 4px 12px; }
.cb-n .st { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); z-index: 3; pointer-events: none; }
.cb-n .pp-pin { left: 46%; top: -8px; }
.cb-n .ini { position: absolute; right: 10px; bottom: 6px; font-size: 30px; line-height: 30px; color: #26408a; font-weight: 700; }
#ui .cb-n.agency .t, #ui .cb-n.agency .d, #ui .cb-n.agency .who { font-family: var(--pp-head); font-size: 18.6667px; line-height: 22px; font-weight: 400; }
#ui .cb-n.agency .t { font-family: var(--pp-label); font-size: 16px; line-height: 20px; text-transform: uppercase; letter-spacing: 1px; }
.cb-n.done { width: 180px; opacity: 0.88; }
.cb-n.done .in { min-height: 0; }
.cb-n.done .d, .cb-n.done .stp, .cb-n.done .rw { display: none; }
.cb-empty { width: 280px; }
.cb-empty .in { padding: 20px; color: var(--pp-pencil); background-size: 256px; }
.cb-pile { grid-column: 1 / -1; margin-top: 28px; padding-top: 14px; border-top: 2px dashed rgba(60, 30, 0, 0.45); }
.cb-pile .cb-notes { gap: 12px; }
#ui .cb-sign { position: absolute; left: 50%; top: -20px; transform: translateX(-50%); padding: 4px 26px 8px; isolation: isolate; font-family: var(--pp-head); font-size: 37.3333px; line-height: 40px; letter-spacing: 2px; color: #f4e6c4; z-index: 5;
  text-shadow: 2px 2px 0 #1a0e06, -2px 0 0 #1a0e06, 0 -2px 0 #1a0e06, 2px 0 0 #1a0e06; }
.cb-x { position: absolute; right: -14px; top: -16px; width: 39px; height: 39px; cursor: pointer; z-index: 6; background: center / 100% 100% no-repeat; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.4)); transition: transform 0.1s steps(2); }
.cb-x:hover { transform: translateY(-2px); }
.cb-rp { position: absolute; right: 44px; top: -14px; z-index: 5; }
.cb-zoom { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(20, 10, 0, 0.62); }
.cb-zoom .cb-n { width: min(480px, 86vw); cursor: default; animation: cbLift 0.3s steps(5) both; }
@keyframes cbLift { from { transform: translateY(40px); opacity: 0; } }
.cb-zoom .acts { display: flex; gap: 24px; justify-content: center; margin-top: 18px; }
.cb-act { position: relative; isolation: isolate; display: inline-block; padding: 6px 20px 10px; font-size: 30px; line-height: 32px; font-weight: 700; color: #26408a; cursor: pointer; background: #f4ead0; box-shadow: 0 0 0 2px #2a1608, 4px 4px 0 2px rgba(0,0,0,0.45); }
.cb-act .pp-cv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.cb-act:hover { color: #a8321e; transform: translateY(-2px); }
.cb-act.dim { color: #8a8070; cursor: default; }
.cb-msg { text-align: center; font-size: 20px; line-height: 24px; color: #fbefd0; margin-top: 12px; text-shadow: 2px 2px 0 #140c06; min-height: 24px; }
@media (max-width: 720px) { .cb-grid { grid-template-columns: 1fr; padding: 24px 14px 32px; } .cb-n { width: 220px; } }
`;
let styled = false;

function noteHtml(r: Req, s: ReqState, big = false): string {
  const seed = hashStr(r.id);
  const kind = PAPER[r.giver] ?? 'journal';
  const face = r.giver === 'agency' ? uiIconURL('battery', 3) : game.ui.portraitURL(r.giver, 'neutral');
  void tilt;
  const steps = s === 'open' && !big ? '' : r.steps.map((st, i) => {
    const ok = st.done();
    const pr = st.progress?.();
    return `<div class="stp pp-hand">${checkbox(ok ? 'done' : 'todo', seed + i)}<span>${ok ? struck(esc(st.text), seed + i) : esc(st.text)}${pr && !ok ? ` ${tallyMarks(Math.min(pr[0], 12), Math.min(pr[1], 12), seed + i)}` : ''}</span></div>`;
  }).join('');
  const give = s === 'ready' && r.give ? `<div class="rw pp-hand">${r.give.map(([id, n]) => `<span><img src="${itemIconURL(id, 2)}" alt=""> ${Math.min(count(id), 99)}/${n} ${esc(ITEMS[id]?.name ?? id)}</span>`).join('')}</div>` : '';
  const rw = [r.reward.rp ? stamp(`+${r.reward.rp} RP`, { color: 'blue', rot: '-4deg', size: 'sm' }) : '', ...(r.reward.items ?? []).map(([id, n]) => `<span><img src="${itemIconURL(id, 2)}" alt=""> ${n} ${esc(ITEMS[id]?.name ?? id)}</span>`)].join('');
  const st = s === 'open' ? stamp('New', { color: 'red', rot: '-8deg' }) : s === 'ready' ? stamp('Hand in', { color: 'green', rot: '6deg' }) : s === 'done' ? stamp('Done', { color: 'red', rot: '-10deg' }) : '';
  const clip = edgeClip(seed, r.giver === 'agency' ? { top: 'perforated', bottom: 'perforated' } : { top: 'deckle', right: 'deckle', bottom: 'torn', left: 'deckle', amp: 0.7 });
  return `${pin({ color: PIN[s] })}${face && s !== 'done' ? `<div class="ph">${polaroid(face, '', { w: '100%' })}</div>` : ''}<div class="in pp-hand" style="background-image:${paperTex(kind)};clip-path:${clip}">
    <div class="t">${s === 'done' ? struck(esc(r.title), seed) : esc(r.title)}</div><div class="who">${r.giver === 'agency' ? 'HALCYON FIELD OFFICE' : `from ${esc(GIVER[r.giver])}`}</div>
    <div class="d">${esc(r.desc)}</div>${steps}${give}${s !== 'done' ? `<div class="rw">${rw}</div>` : ''}${s === 'active' || s === 'ready' ? '<span class="ini">M.</span>' : ''}</div>${st ? `<span class="st">${st}</span>` : ''}`;
}

const button = (label: string, act: string, seed: number, dim = false) =>
  `<span class="cb-act pp-hand${dim ? ' dim' : ''}" data-a="${act}">${svgInk(100, 40, [{ d: roughRect(3, 4, 94, 32, { seed, rough: 1 }), c: dim ? '#8a8070' : '#26408a', w: 2 }], { stretch: true })}${esc(label)}</span>`;

/** the board's driftwood frame: weathered planks, nail heads, a hard shadow */
function paintFrame(a: Art) {
  const W = a.w - 4, H = a.h - 4;
  const wood = coverArtOf('leather', '#6a4422');
  const out = col('#1a0e06'), lt = col('#a8763c'), dk = col('#3a2410');
  for (let y = 4; y < H + 4; y++) for (let x = 4; x < W + 4; x++) if ((x >= W || y >= H) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.45));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = wood.d[(y % 128) * 128 + (x % 128)];
    // plank grain: long streaks
    if (((y * 3 + Math.floor(x / 37)) % 11) === 0) c = shadeC(c, -0.15);
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c = out;
    else if (x === 1 || y === 1) c = lt;
    else if (x === W - 2 || y === H - 2) c = dk;
    else if (x > 10 && y > 10 && x < W - 11 && y < H - 11) continue;
    else if (x === 10 || y === 10) c = dk;
    a.put(x, y, c);
  }
  for (const [x, y] of [[5, 5], [W - 6, 5], [5, H - 6], [W - 6, H - 6], [Math.round(W / 2), 5], [Math.round(W / 2), H - 6]]) {
    a.put(x, y, col('#d8d0b8')); a.put(x + 1, y, col('#8a8070')); a.put(x, y + 1, col('#8a8070')); a.put(x + 1, y + 1, col('#4a443a'));
  }
}
/** the name board over it */
function paintSign(a: Art) {
  const W = a.w - 4, H = a.h - 4;
  const wood = coverArtOf('leather', '#4a2e14');
  for (let y = 4; y < H + 4; y++) for (let x = 4; x < W + 4; x++) if ((x >= W || y >= H) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.45));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = wood.d[(y % 128) * 128 + (x % 128)];
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c = col('#140a04');
    else if (y === 1) c = shadeC(c, 0.25);
    else if (y === H - 2) c = shadeC(c, -0.3);
    a.put(x, y, c);
  }
}
const closeURL = () => spriteURL('cbX', 13, 13, a => {
  const out = col('#1a0e06'), lea = col('#5a3a1e'), lt = col('#7a5028'), x = col('#f4e6c4');
  a.rect(1, 0, 11, 13, out); a.rect(0, 1, 13, 11, out);
  a.rect(1, 1, 11, 11, lea); a.rect(2, 1, 9, 1, lt); a.rect(1, 2, 1, 9, lt);
  for (let i = 0; i < 7; i++) { a.put(3 + i, 3 + i, x); a.put(9 - i, 3 + i, x); a.put(4 + i, 3 + i, shadeC(x, -0.2)); }
});
function vignette(a: Art) {
  const c = col('#050302');
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const dx = (x / a.w - 0.5) / 0.55, dy = (y / a.h - 0.5) / 0.52;
    if (dith(x, y, Math.max(0, Math.min(1, (Math.sqrt(dx * dx + dy * dy) - 0.62) / 0.5)) * 0.9)) a.put(x, y, c);
  }
}

export async function openBoard(): Promise<void> {
  installPaper();
  if (!styled) { styled = true; document.head.appendChild(el('style', '', CSS)); }
  const wrap = el('div', 'cb-wrap');
  const board = wrap.appendChild(el('div', 'cb-board'));
  wrap.insertAdjacentHTML('afterbegin', pxCanvas('vignette', a => vignette(a), { cls: 'vg' }));
  void coverTex; void svgInk; void roughLine;
  board.innerHTML = `${pxCanvas('cbframe', a => paintFrame(a), { cls: 'pp-bgcv frame' })}<div class="cb-sign">${pxCanvas('cbsign', a => paintSign(a), { cls: 'pp-bgcv' })}CAMP BOARD</div><div class="cb-x" title="Close (Esc)" style="background-image:url(${closeURL()})"></div><div class="cb-cork"><div class="cb-grid"></div></div>`;
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
    const empty = (txt: string, seed: number) => `<div class="cb-n cb-empty" style="transform:${nudge(seed, 2)}">${pin({ color: 'yellow' })}<div class="in pp-hand" style="background-image:${paperTex('journal')};clip-path:${edgeClip(seed, { bottom: 'torn' })}">${esc(txt)}</div></div>`;
    const column = (title: string, list: Req[], emptyTxt: string, bg: string) => `<div class="cb-col"><h3 style="background:${bg}">${esc(title)}</h3><div class="cb-notes">${list.length ? list.map(r => `<div class="cb-n ${r.giver}" data-id="${r.id}" style="transform:${nudge(r.id, 3)}">${noteHtml(r, reqState(r))}</div>`).join('') : empty(emptyTxt, title.length)}</div></div>`;
    grid.innerHTML = column('Crew requests', crew, 'Nothing pinned up yet. Check back tomorrow.', `${paperTex('card')} 0 0/256px`)
      + column('Field office', ag, game.save.flags['v10:agency'] ? 'No requests from the office right now.' : 'Jenna is still trying to get the radio working.', `${paperTex('telex')} 0 0/256px`)
      + (done.length ? `<div class="cb-pile"><h3 style="background:${paperTex('kraft')} 0 0/256px">Done pile</h3><div class="cb-notes">${done.map(r => `<div class="cb-n done ${r.giver}" data-id="${r.id}" style="transform:${nudge(r.id, 2)}">${noteHtml(r, 'done')}</div>`).join('')}</div></div>` : '');
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
