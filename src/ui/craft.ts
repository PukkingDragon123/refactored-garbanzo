// Crafting: workbench, campfire and by-hand recipes. Shows ingredients (have/need), tool requirements,
// locked "???" recipes with what unlocks them, batch crafting, and a juicy pop-in result.

import { game } from '../game/game';
import { ITEMS } from '../game/items';
import { RECIPES, Recipe, Station, recipeState, craft, missingText } from '../game/crafting';
import { count, hasTool, freeSlots } from '../game/inventory';
import { SKILL_BY_ID, BRANCHES } from '../game/skills';
import { QUEST_BY_ID } from '../game/quests';
import { itemIconURL, uiIconURL } from '../art/itemicons';
import { el } from './ui';
import { paintParchment } from './skin';
import { sfx, css, wait, pixelBackdrop, reduced, pushKeys, esc } from './laptop-kit';
import { pxIcon } from './pxicons';

const STATION: Record<Station, { name: string; sub: string; verb: string; tool: string }> = {
  bench: { name: 'Workbench', sub: 'Planks, nails and good intentions', verb: 'Craft', tool: 'hammer' },
  fire: { name: 'Campfire', sub: 'Lou’s kitchen rules apply', verb: 'Cook', tool: 'stew' },
  hand: { name: 'Field crafting', sub: 'Knees, knife and patience', verb: 'Make', tool: 'knife' },
};
const NOTE: Record<string, string> = {
  lure: 'Lures pull shy animals out of hiding. Set one down on an expedition, then wait somewhere quiet.',
  food: 'Eat before heading out: a full belly buys a buff for the next expedition.',
  tool: 'Tools live on your belt, not in the backpack.',
  material: 'Useful for camp building and more crafting.',
};
const EAT: Record<string, string> = { energy: 'Energy for a long day', steady: 'Steady hands: less camera shake', quiet: 'Light feet: animals hear you less' };
const KIND_LABEL: Record<string, string> = { tool: 'Tool', material: 'Material', plant: 'Plant', fungus: 'Fungus', insect: 'Insect', animal: 'Animal sample', lure: 'Lure', food: 'Food', key: 'Key item' };

const CSS = `
.cft-root { font-variant-ligatures: none; position: relative; width: min(94vw, 58em); height: min(92vh, 37em); padding: calc(var(--px) * 13) calc(var(--px) * 13) calc(var(--px) * 11); color: var(--paper); display: flex; flex-direction: column; overflow: hidden !important; }
.cft-root > :not(.k-backdrop) { position: relative; z-index: 1; }
.cft-head { display: flex; align-items: center; gap: 0.7em; margin: 0 0 0.55em; min-height: 2.6em; }
.cft-head .badge { width: 2.6em; height: 2.6em; image-rendering: pixelated; filter: drop-shadow(0 3px 0 rgba(0,0,0,0.35)); }
.cft-head .t { font-family: var(--pix); font-size: 1.55em; color: var(--amber2); line-height: 1; text-shadow: 0 3px 0 rgba(0,0,0,0.45); }
.cft-head .s { font-family: var(--hand); font-size: 1em; opacity: 0.85; }
.cft-head .x { margin-left: auto; }
.cft-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(15em, 20em) 1fr; gap: calc(var(--px) * 7); }
.cft-list { overflow-y: auto; padding: 0.35em; display: flex; flex-direction: column; gap: 0.3em; scrollbar-width: thin; scrollbar-color: rgba(241,232,208,0.3) transparent; }
.cft-rec { display: grid; grid-template-columns: 2.5em 1fr auto; align-items: center; gap: 0.55em; padding: 0.3em 0.5em 0.3em 0.3em; background: rgba(0,0,0,0.18); border: 0; color: var(--paper); font: inherit; text-align: left; cursor: pointer; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.25); transition: transform 0.1s, background 0.12s; }
.cft-rec:hover { background: rgba(255,255,255,0.08); transform: translateX(2px); }
.cft-rec.sel { background: rgba(244,180,60,0.2); box-shadow: inset 0 0 0 2px var(--amber); }
.cft-rec .ic { width: 2.5em; height: 2.5em; display: grid; place-items: center; background: rgba(0,0,0,0.28); box-shadow: inset 0 -3px 0 rgba(0,0,0,0.25); }
.cft-rec .ic img { width: 2.25em; height: 2.25em; image-rendering: pixelated; }
.cft-rec .nm { font-family: var(--pix); font-size: 0.98em; line-height: 1.1; min-width: 0; }
.cft-rec .nm i { font-style: normal; color: var(--amber2); font-size: 0.85em; }
.cft-rec .nm small { display: block; font-family: var(--body); font-size: 0.72em; opacity: 0.75; margin-top: 0.15em; white-space: normal; }
.cft-rec .st { font-family: var(--pix); font-size: 0.68em; padding: 0.15em 0.45em; letter-spacing: 0.06em; white-space: nowrap; }
.cft-rec .st.ok { background: var(--teal); color: #06241e; }
.cft-rec .st.missing { background: rgba(232,97,74,0.25); color: #ffb3a4; }
.cft-rec .st.tool, .cft-rec .st.full { background: rgba(155,124,224,0.25); color: #d8c8ff; }
.cft-rec.locked .nm { opacity: 0.6; }
.cft-rec.locked .ic img { filter: brightness(0) opacity(0.45); }
.cft-detail { position: relative; padding: 0.8em 1em; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.cft-out { display: grid; grid-template-columns: auto 1fr; gap: 1em; align-items: center; }
.cft-out .big { width: 6.4em; height: 6.4em; display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, rgba(255,230,160,0.28), rgba(0,0,0,0.25) 70%); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.3), inset 0 -5px 0 rgba(0,0,0,0.2); }
.cft-out .big img { width: 5.4em; height: 5.4em; image-rendering: pixelated; filter: drop-shadow(0 4px 0 rgba(0,0,0,0.35)); }
.cft-out .big.wobble img { animation: crWob 0.35s ease-in-out infinite; }
@keyframes crWob { 25% { transform: rotate(-7deg) translateY(-2px); } 75% { transform: rotate(7deg) translateY(1px); } }
.cft-out .nm { font-family: var(--pix); font-size: 1.45em; color: var(--amber2); line-height: 1.05; }
.cft-out .kind { font-family: var(--pix); font-size: 0.75em; letter-spacing: 0.1em; text-transform: uppercase; color: var(--teal2); margin: 0.25em 0 0.35em; }
.cft-out .desc { font-size: 0.92em; line-height: 1.4; opacity: 0.92; }
.cft-sec { font-family: var(--pix); font-size: 0.78em; letter-spacing: 0.12em; text-transform: uppercase; color: var(--amber); margin: 0.9em 0 0.35em; }
.cft-ings { display: flex; flex-wrap: wrap; gap: 0.45em; }
.cft-ing { display: flex; align-items: center; gap: 0.45em; padding: 0.25em 0.6em 0.25em 0.25em; background: rgba(0,0,0,0.22); box-shadow: inset 0 0 0 2px rgba(143,240,220,0.35); font-size: 0.92em; }
.cft-ing img { width: 2em; height: 2em; image-rendering: pixelated; }
.cft-ing b { font-family: var(--pix); font-weight: 500; margin-left: 0.25em; color: var(--teal2); font-variant-numeric: tabular-nums; }
.cft-ing.no { box-shadow: inset 0 0 0 2px rgba(232,97,74,0.55); }
.cft-ing.no b { color: #ff9a86; }
.cft-ing.no img { opacity: 0.6; }
.cft-tool { align-self: flex-start; display: inline-flex; align-items: center; gap: 0.45em; font-size: 0.9em; padding: 0.2em 0.6em 0.2em 0.25em; background: rgba(0,0,0,0.22); }
.cft-tool img { width: 1.8em; height: 1.8em; image-rendering: pixelated; }
.cft-tool.no { color: #ff9a86; }
.cft-foot { margin-top: auto; position: sticky; bottom: 0; display: flex; align-items: center; gap: 0.8em; flex-wrap: wrap; padding-top: 0.8em; }
.cft-batch { display: flex; align-items: center; gap: 0.25em; font-family: var(--pix); }
.cft-batch .btn { padding: 0.3em 0.6em; font-size: 0.95em; }
.cft-batch b { min-width: 2.2em; text-align: center; font-size: 1.1em; font-variant-numeric: tabular-nums; }
.cft-time { font-family: var(--pix); font-size: 0.85em; opacity: 0.8; }
.cft-go { margin-left: auto; font-size: 1.15em !important; padding: 0.55em 1.3em !important; }
.cft-go:not(:disabled) { animation: crGlow 1.6s ease-in-out infinite; }
@keyframes crGlow { 50% { filter: brightness(1.15); } }
.cft-msg { font-size: 0.85em; color: #ffb3a4; min-height: 1.3em; margin-top: 0.35em; }
.cft-msg.ok { color: var(--teal2); }
.cft-prog { position: absolute; left: 1.1em; right: 1.1em; bottom: 1em; height: 1.3em; background: rgba(0,0,0,0.45); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.5); display: none; }
.cft-prog.on { display: block; }
.cft-prog div { height: 100%; width: 0; background: repeating-linear-gradient(90deg, var(--amber) 0 10px, var(--amber2) 10px 20px); box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2); }
.cft-prog span { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--pix); font-size: 0.8em; color: var(--ink); text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
.cft-locked { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; gap: 0.6em; }
.cft-locked .q { width: 6em; height: 6em; display: grid; place-items: center; border: 3px dashed rgba(241,232,208,0.35); }
.cft-locked .q img { width: 4.5em; image-rendering: pixelated; filter: brightness(0) opacity(0.5); }
.cft-locked .t { font-family: var(--pix); font-size: 1.4em; color: var(--paper3); }
.cft-locked p { max-width: 24em; line-height: 1.45; font-size: 0.95em; opacity: 0.9; margin: 0; }
.cft-locked b { color: var(--amber2); font-family: var(--pix); font-weight: 500; }
.cft-result { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35em; background: radial-gradient(circle at 50% 45%, rgba(255,220,140,0.35), rgba(10,16,14,0.88) 70%); z-index: 5; cursor: pointer; animation: kFade 0.2s; }
.cft-result .cft-badge { font-family: var(--pix); font-size: 1em; letter-spacing: 0.2em; color: var(--ink); background: var(--amber); padding: 0.15em 0.8em; transform: rotate(-4deg); animation: crStamp 0.35s cubic-bezier(.2,1.8,.4,1) both 0.15s; }
.cft-result img { width: 7em; height: 7em; image-rendering: pixelated; animation: crPop 0.55s cubic-bezier(.2,1.7,.4,1) both; filter: drop-shadow(0 6px 0 rgba(0,0,0,0.4)); }
.cft-result .n { font-family: var(--pix); font-size: 1.5em; color: var(--paper); text-shadow: 0 3px 0 rgba(0,0,0,0.5); animation: crPop 0.4s ease-out both 0.25s; }
.cft-result .h { font-size: 0.8em; opacity: 0.7; }
.cft-result .spark { position: absolute; width: 0.5em; height: 0.5em; background: var(--amber2); box-shadow: 0 0 6px var(--amber); animation: crSpark 0.8s ease-out forwards; }
@keyframes crPop { 0% { transform: scale(0.2) rotate(-20deg); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes crStamp { 0% { transform: scale(2.2) rotate(-4deg); opacity: 0; } 100% { transform: scale(1) rotate(-4deg); opacity: 1; } }
@keyframes crSpark { to { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; } }
.cft-note { margin-top: 0.6em; align-self: flex-start; max-width: 30em; background: #fbe99a; color: #3b3226; font-family: var(--hand); font-size: 0.98em; line-height: 1.3; padding: 0.45em 0.8em 0.4em; transform: rotate(-1.2deg); box-shadow: 0 3px 0 rgba(0,0,0,0.35); position: relative; }
.cft-note::before { content: ''; position: absolute; top: -0.45em; left: 42%; width: 3.2em; height: 0.9em; background: rgba(240,220,150,0.75); transform: rotate(3deg); }
.cft-note b { font-family: var(--pix); font-weight: 500; font-size: 0.85em; }
.cft-empty { font-family: var(--hand); font-size: 1.1em; opacity: 0.8; padding: 1em; text-align: center; }
`;

function lockReason(r: Recipe): string {
  if (r.skill) {
    const sk = SKILL_BY_ID[r.skill];
    const br = BRANCHES.find(b => b.id === sk?.branch);
    return sk ? `Learn <b>${esc(sk.name)}</b> in the ${br?.name ?? ''} skill tree (${sk.cost} RP, laptop)` : 'Locked';
  }
  if (r.flag) {
    const q = QUEST_BY_ID[r.flag];
    return q ? `Complete <b>${esc(q.title)}</b> for ${q.giver === 'lou' ? 'Lou' : 'the crew'}` : 'Not yet known';
  }
  return 'Locked';
}
const shortLock = (r: Recipe) => (r.skill ? `Skill: ${SKILL_BY_ID[r.skill]?.name ?? r.skill}` : r.flag ? `Quest: ${QUEST_BY_ID[r.flag]?.title ?? r.flag}` : 'Locked');

/** How many times the recipe can be made right now (ingredients only, capped by a quick fit check). */
function maxBatch(r: Recipe) {
  if (recipeState(r) !== 'ok') return 0;
  if (ITEMS[r.out]?.kind === 'tool') return 1;
  let n = Infinity;
  for (const [id, k] of r.needs) n = Math.min(n, Math.floor(count(id) / k));
  return Math.max(1, Math.min(n, 20));
}

/** Open a crafting station. onCraft is awaited (the game plays its animation) before items change hands. */
export function openCrafting(station: Station, o: { onCraft?: (recipeId: string, seconds: number) => Promise<void> | void } = {}): Promise<void> {
  css('craft', CSS);
  sfx('uiOpen');
  const st = STATION[station];
  const recipes = RECIPES.filter(r => r.station === station);
  return new Promise<void>(resolve => {
    const root = el('div', 'cft-root');
    root.innerHTML = `<div class="cft-head"><img class="badge" src="${itemIconURL(st.tool, 3)}" alt=""><div><div class="t">${st.name}</div><div class="s">${st.sub}</div></div><button class="btn ghost x">Close <span class="key">Esc</span></button></div>
      <div class="cft-body"><div class="cft-list" role="listbox" aria-label="Recipes"></div><div class="cft-detail"></div></div>`;
    const list = root.querySelector('.cft-list') as HTMLElement;
    const detail = root.querySelector('.cft-detail') as HTMLElement;
    let sel = Math.max(0, recipes.findIndex(r => recipeState(r) === 'ok'));
    let batch = 1;
    let busy = false;
    let popKeys = () => {};
    let disposeBg = () => {};

    const close = game.ui.modal(root, () => { popKeys(); disposeBg(); game.persist(); resolve(); }, false);
    const wrap = root.parentElement as HTMLElement;
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap && !busy) { sfx('uiBack'); close(); } });
    (root.querySelector('.x') as HTMLElement).onclick = () => { if (!busy) { sfx('uiBack'); close(); } };

    const inner = (): [number, number, number, number][] => {
      const px = parseFloat(root.style.getPropertyValue('--px')) || 3;
      const rr = root.getBoundingClientRect();
      return [list, detail].map(e => {
        const r = e.getBoundingClientRect();
        return [Math.round((r.left - rr.left) / px), Math.round((r.top - rr.top) / px), Math.round(r.width / px), Math.round(r.height / px)] as [number, number, number, number];
      });
    };
    disposeBg = pixelBackdrop(root, (b, w, h) => {
      const o2 = { inner: inner() };
      paintParchment(b, w, h, o2);
    }, undefined, [list, detail]);

    const renderList = () => {
      list.innerHTML = '';
      if (!recipes.length) list.appendChild(el('div', 'cft-empty', 'Nothing to make here yet.'));
      recipes.forEach((r, i) => {
        const s = recipeState(r);
        const d = ITEMS[r.out];
        const b = el('button', `cft-rec${i === sel ? ' sel' : ''}${s === 'locked' ? ' locked' : ''}`);
        b.setAttribute('role', 'option');
        if (s === 'locked') b.innerHTML = `<span class="ic"><img src="${itemIconURL(r.out, 3)}" alt=""></span><span class="nm">???<small>${esc(shortLock(r))}</small></span><span class="st"><img src="${uiIconURL('lock', 2)}" style="width:1.4em;image-rendering:pixelated" alt="locked"></span>`;
        else {
          const lab = s === 'ok' ? 'READY' : s === 'missing' ? 'NEED' : s === 'tool' ? 'TOOL' : 'FULL';
          b.innerHTML = `<span class="ic"><img src="${itemIconURL(r.out, 3)}" alt=""></span><span class="nm">${esc(d?.name ?? r.out)}${r.n > 1 ? ` <i>×${r.n}</i>` : ''}</span><span class="st ${s}">${lab}</span>`;
        }
        b.onclick = () => { if (busy) return; if (sel !== i) { sel = i; batch = 1; sfx('ui', { vol: 0.6 }); renderList(); renderDetail(); } };
        list.appendChild(b);
      });
      (list.children[sel] as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
    };

    const renderDetail = () => {
      const r = recipes[sel];
      detail.innerHTML = '';
      if (!r) return;
      const s = recipeState(r);
      if (s === 'locked') {
        detail.innerHTML = `<div class="cft-locked"><div class="q"><img src="${itemIconURL(r.out, 3)}" alt=""></div><div class="t">Unknown recipe</div><p>${lockReason(r)}</p></div>`;
        return;
      }
      const d = ITEMS[r.out];
      const out = detail.appendChild(el('div', 'cft-out', `<div class="big"><img src="${itemIconURL(r.out, 4)}" alt=""></div><div><div class="nm">${esc(d?.name ?? r.out)}</div><div class="kind">${KIND_LABEL[d?.kind ?? ''] ?? ''} · makes ${r.n}${d?.kind === 'tool' ? ' (tool belt)' : ''}</div><div class="desc">${esc(d?.desc ?? '')}</div></div>`));
      detail.appendChild(el('div', 'cft-sec', 'Ingredients'));
      const ings = detail.appendChild(el('div', 'cft-ings'));
      const mult = Math.max(1, batch);
      for (const [id, n] of r.needs) {
        const have = count(id), need = n * mult;
        ings.appendChild(el('div', `cft-ing${have >= need ? '' : ' no'}`, `<img src="${itemIconURL(id, 3)}" alt=""><span>${esc(ITEMS[id]?.name ?? id)}</span><b>${have}/${need}</b>`));
      }
      if (r.tool) {
        detail.appendChild(el('div', 'cft-sec', 'Tool'));
        const ok = hasTool(r.tool);
        detail.appendChild(el('div', `cft-tool${ok ? '' : ' no'}`, `<img src="${itemIconURL(r.tool, 3)}" alt="">${esc(ITEMS[r.tool]?.name ?? r.tool)} ${ok ? pxIcon('check') : '— not on your tool belt'}`));
      }
      const have = count(r.out);
      const note = d?.eat ? `<b>${EAT[d.eat] ?? d.eat}.</b> ${NOTE.food}` : NOTE[d?.kind ?? ''] ?? '';
      if (note) detail.appendChild(el('div', 'cft-note', `${note}${have && d?.kind !== 'tool' ? ` <br><b>In your pack: ${have}</b>` : ''}`));
      const foot = detail.appendChild(el('div', 'cft-foot'));
      const mx = maxBatch(r);
      if (d?.kind !== 'tool' && mx > 1) {
        const bt = foot.appendChild(el('div', 'cft-batch'));
        const minus = bt.appendChild(el('button', 'btn ghost', '−'));
        const num = bt.appendChild(el('b', '', '×' + batch));
        const plus = bt.appendChild(el('button', 'btn ghost', '+'));
        const all = bt.appendChild(el('button', 'btn ghost', 'Max'));
        minus.onclick = () => { batch = Math.max(1, batch - 1); sfx('ui', { vol: 0.5, pitch: 0.9 }); renderDetail(); };
        plus.onclick = () => { batch = Math.min(mx, batch + 1); sfx('ui', { vol: 0.5, pitch: 1.1 }); renderDetail(); };
        all.onclick = () => { batch = mx; sfx('ui', { vol: 0.5, pitch: 1.2 }); renderDetail(); };
        num.title = `You can make up to ${mx}`;
      } else batch = 1;
      foot.appendChild(el('div', 'cft-time', `${pxIcon('timer')} ${(r.time * batch).toFixed(1)}s`));
      const go = foot.appendChild(el('button', 'btn cft-go', `${st.verb}${batch > 1 ? ' ×' + batch : ''} <span class="key">${pxIcon('enter')}</span>`)) as HTMLButtonElement;
      go.disabled = s !== 'ok';
      go.onclick = () => doCraft();
      const msg = detail.appendChild(el('div', 'cft-msg'));
      if (s === 'missing') msg.textContent = 'Missing: ' + missingText(r.needs);
      else if (s === 'tool') msg.textContent = `You need a ${ITEMS[r.tool!]?.name ?? r.tool} for this.`;
      else if (s === 'full') msg.textContent = d?.kind === 'tool' ? 'You already have one on your tool belt.' : `No room in the backpack (${freeSlots()} free slots).`;
      else { msg.className = 'cft-msg ok'; msg.textContent = r.n * batch > 1 ? `Makes ${r.n * batch} ${d?.name ?? ''}.` : 'Everything you need is in the pack.'; }
      detail.appendChild(el('div', 'cft-prog', '<div></div><span></span>'));
      void out;
    };

    const doCraft = async () => {
      const r = recipes[sel];
      if (!r || busy || recipeState(r) !== 'ok') { if (r && recipeState(r) !== 'ok') sfx('wrong', { vol: 0.5 }); return; }
      busy = true;
      root.classList.add('busy');
      const n = Math.max(1, Math.min(batch, maxBatch(r)));
      const secs = r.time * n;
      const big = detail.querySelector('.big') as HTMLElement | null;
      big?.classList.add('wobble');
      const go = detail.querySelector('.cft-go') as HTMLButtonElement | null;
      if (go) go.disabled = true;
      const prog = detail.querySelector('.cft-prog') as HTMLElement;
      const bar = prog.querySelector('div') as HTMLElement;
      const lab = prog.querySelector('span') as HTMLElement;
      prog.classList.add('on');
      lab.textContent = station === 'fire' ? 'Cooking…' : station === 'hand' ? 'Working…' : 'Crafting…';
      const t0 = performance.now();
      const dur = reduced() ? 150 : secs * 1000;
      let raf = 0;
      let tick = 0;
      const anim = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        bar.style.width = (k * 100).toFixed(1) + '%';
        if (!o.onCraft && performance.now() - tick > 420) {
          tick = performance.now();
          sfx(station === 'bench' ? 'hammer' : station === 'fire' ? 'fireLight' : 'rope', { vol: 0.35, pitch: 0.9 + Math.random() * 0.2 });
        }
        if (k < 1) raf = requestAnimationFrame(anim);
      };
      raf = requestAnimationFrame(anim);
      try {
        const p = o.onCraft?.(r.id, secs);
        await Promise.all([p instanceof Promise ? p : Promise.resolve(), o.onCraft ? Promise.resolve() : wait(dur)]);
      } catch (e) { console.error(e); }
      cancelAnimationFrame(raf);
      bar.style.width = '100%';
      let made = 0;
      for (let i = 0; i < n; i++) { if (!craft(r)) break; made++; }
      big?.classList.remove('wobble');
      busy = false;
      root.classList.remove('busy');
      if (!made) { sfx('wrong'); renderList(); renderDetail(); return; }
      sfx('craft');
      setTimeout(() => sfx('collectPop', { pitch: 1.1 }), 180);
      showResult(r, made * r.n);
    };

    const showResult = (r: Recipe, qty: number) => {
      const d = ITEMS[r.out];
      const res = detail.appendChild(el('div', 'cft-result', `<div class="cft-badge">${station === 'fire' ? 'COOKED!' : 'CRAFTED!'}</div><img src="${itemIconURL(r.out, 5)}" alt=""><div class="n">+${qty} ${esc(d?.name ?? r.out)}</div><div class="h">${d?.kind === 'tool' ? 'Added to your tool belt' : 'Added to your backpack'} · click to continue</div>`));
      if (!reduced()) for (let i = 0; i < 14; i++) {
        const sp = res.appendChild(el('i', 'spark'));
        const a = (i / 14) * Math.PI * 2;
        sp.style.left = '50%'; sp.style.top = '44%';
        sp.style.setProperty('--dx', `${Math.cos(a) * (5 + (i % 3) * 2)}em`);
        sp.style.setProperty('--dy', `${Math.sin(a) * (4 + (i % 2) * 2)}em`);
        sp.style.animationDelay = `${0.05 + (i % 4) * 0.03}s`;
      }
      const done = () => { if (!res.isConnected) return; res.remove(); batch = 1; renderList(); renderDetail(); };
      res.onclick = done;
      setTimeout(done, reduced() ? 900 : 1700);
    };

    popKeys = pushKeys(e => {
      if (e.code === 'Escape' || e.code === 'Tab') { if (!busy) { sfx('uiBack'); close(); } return true; }
      if (busy) return true;
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') {
        const d = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1;
        sel = (sel + d + recipes.length) % Math.max(1, recipes.length);
        batch = 1; sfx('ui', { vol: 0.5 }); renderList(); renderDetail(); return true;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { doCraft(); return true; }
      if (e.code === 'Equal' || e.code === 'ArrowRight') { const r = recipes[sel]; if (r) { batch = Math.min(maxBatch(r) || 1, batch + 1); renderDetail(); } return true; }
      if (e.code === 'Minus' || e.code === 'ArrowLeft') { batch = Math.max(1, batch - 1); renderDetail(); return true; }
    });

    renderList();
    renderDetail();
  });
}
