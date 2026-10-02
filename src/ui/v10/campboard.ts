// V10 the camp board: requests from the crew (left) and the agency's field office (right, once the
// radio works). Take a request on, follow its progress, hand things in.

import { game } from '../../game/game';
import { uiIconURL, itemIconURL } from '../../art/itemicons';
import { ITEMS } from '../../game/items';
import { sfx } from '../laptop-kit';
import { campPanel, itemChips, esc } from './campkit';
import { REQUESTS, reqState, acceptReq, handIn } from '../../game/v10/campquests';
import type { Req } from '../../game/v10/campquests';
import { bucket } from '../../game/v10/store';
import { pxIcon } from '../pxicons';

const seenB = () => bucket<{ seen: string[] }>('board', () => ({ seen: [] }));

/** a request waiting to be handed in, or a new one nobody has looked at */
export function news(): boolean {
  const seen = seenB().seen;
  return REQUESTS.some(r => { const s = reqState(r); return s === 'ready' || (s === 'open' && !seen.includes(r.id)); });
}

const GIVER: Record<string, string> = { jenna: 'Jenna', joshu: 'Joshu', aroha: 'Aroha', agency: 'Field office' };
const STATE: Record<string, [string, string]> = {
  open: ['NEW', 'var(--amber)'], active: ['ON IT', 'var(--teal)'], ready: ['HAND IN', 'var(--amber2)'], done: ['DONE', '#8db34a'],
};

export async function openBoard() {
  const p = campPanel({ title: 'The camp board', sub: 'Requests from the crew, and from the field office.', icon: 'notes', rp: true, width: 'min(96vw, 64em)' });
  const render = () => {
    p.body.innerHTML = '';
    const grid = p.body.appendChild(document.createElement('div'));
    grid.className = 'cp-grid2';
    const col = (title: string, icon: string, list: Req[], empty: string) => {
      const c = grid.appendChild(document.createElement('div'));
      c.className = 'cp-col';
      c.innerHTML = `<h4>${icon ? `<img src="${icon}" alt="">` : ''}${esc(title)}</h4>`;
      if (!list.length) c.insertAdjacentHTML('beforeend', `<div class="cp-empty">${esc(empty)}</div>`);
      for (const r of list) c.appendChild(card(r));
    };
    const vis = (r: Req) => reqState(r) !== 'locked';
    const order = (r: Req) => ({ ready: 0, open: 1, active: 2, done: 3, locked: 4 }[reqState(r)]);
    const crew = REQUESTS.filter(r => r.giver !== 'agency' && vis(r)).sort((a, b) => order(a) - order(b));
    const ag = REQUESTS.filter(r => r.giver === 'agency' && vis(r)).sort((a, b) => order(a) - order(b));
    col('Crew requests', game.ui.portraitURL('joshu', 'happy'), crew, 'Nothing pinned up yet. Check back tomorrow.');
    col('Field office', uiIconURL('battery', 2), ag, game.save.flags['v10:agency'] ? 'No requests from the office right now.' : 'Jenna is still trying to get the radio working.');
    // everything on the board has now been seen
    const seen = seenB().seen;
    for (const r of REQUESTS) if (reqState(r) === 'open' && !seen.includes(r.id)) seen.push(r.id);
    game.persist();
  };
  const card = (r: Req) => {
    const s = reqState(r);
    const c = document.createElement('div');
    c.className = 'cp-card';
    const [tag, col] = STATE[s] ?? ['', 'var(--teal)'];
    const face = r.giver === 'agency' ? uiIconURL('battery', 2) : game.ui.portraitURL(r.giver, 'neutral');
    const steps = s === 'open' ? '' : r.steps.map(st => {
      const pr = st.progress?.();
      const ok = st.done();
      return `<p style="font-size:0.85em;${ok ? 'color:var(--teal2)' : ''}">${ok ? pxIcon('check') : pxIcon('pip0')} ${esc(st.text)}${pr && !ok ? ` <b style="font-family:var(--pix)">${pr[0]}/${pr[1]}</b>` : ''}</p>`;
    }).join('');
    const rw = [r.reward.rp ? `<span class="cp-chip ok"><img src="${uiIconURL('rp', 2)}" alt="">+${r.reward.rp} RP</span>` : '', ...(r.reward.items ?? []).map(([id, n]) => `<span class="cp-chip ok"><img src="${itemIconURL(id, 2)}" alt="">${n}× ${esc(ITEMS[id]?.name ?? id)}</span>`), r.giver !== 'agency' && r.reward.bond ? `<span class="cp-chip ok">${pxIcon('heart')} ${GIVER[r.giver]}</span>` : ''].join('');
    c.innerHTML = `<div style="display:flex;gap:0.6em;align-items:flex-start">
      ${face ? `<img src="${face}" alt="" style="width:2.4em;height:2.4em;image-rendering:pixelated;flex:none;box-shadow:0 0 0 2px rgba(0,0,0,0.4)">` : ''}
      <div style="flex:1;min-width:0">
        <div style="display:flex;gap:0.5em;align-items:center;flex-wrap:wrap"><h3>${esc(r.title)}</h3><span class="cp-tag" style="--c:${col}">${tag}</span></div>
        <p style="opacity:0.7;font-size:0.8em">${esc(GIVER[r.giver])}</p>
        ${s === 'done' ? '' : `<p>${esc(r.desc)}</p>${steps}${s === 'ready' && r.give ? `<div>${itemChips(r.give)}</div>` : ''}<div style="margin-top:0.25em">${rw}</div>`}
      </div>
      ${s === 'open' ? '<button class="btn take">Take it on</button>' : s === 'ready' ? '<button class="btn teal give">Hand in</button>' : ''}
    </div>`;
    const take = c.querySelector('.take') as HTMLButtonElement | null;
    if (take) take.onclick = () => { acceptReq(r.id); sfx('pageTurn'); render(); };
    const give = c.querySelector('.give') as HTMLButtonElement | null;
    if (give) give.onclick = () => { if (handIn(r.id)) { sfx('coin'); render(); } else sfx('wrong'); };
    return c;
  };
  render();
  await p.closed;
}
