// Rowan's backpack: stacked slot grid (capacity grows with skills), tool belt, item details and actions
// (eat, drop; crafting happens at the workbench), sorting and a capacity meter.
// V10: the pack's weight (kg / capacity) and Mori's energy in the header, each item's weight, and Eat
// for anything edible (energy back; unidentified forage is a gamble, researched poison asks first).

import { game } from '../game/game';
import { ITEMS, ItemKind } from '../game/items';
import { stacks, capacity, freeSlots, count, remove } from '../game/inventory';
import { RECIPE_BY_ID } from '../game/crafting';
import { analysisRp } from '../game/lab';
import { SKILL_BY_ID } from '../game/skills';
import { PixelBuffer } from '../art/pixel';
import { itemIconURL, uiIconURL } from '../art/itemicons';
import { el } from './ui';
import { paintParchment } from './skin';
import { sfx, css, wait, pixelBackdrop, reduced, pushKeys, esc, confirmPop, H, fabric, stitch, uiPx, noise } from './laptop-kit';
import { packWeight, packCapacity, weightOf, energy, maxEnergy } from '../game/v10/energy';
import { foodInfo, canEat, eatFood, timesSick } from '../game/v10/forage10';

const KIND: Record<ItemKind, { label: string; color: string }> = {
  tool: { label: 'Tool', color: '#9aa3a5' }, material: { label: 'Material', color: '#c9a878' }, plant: { label: 'Plant', color: '#8db34a' },
  fungus: { label: 'Fungus', color: '#3fbca6' }, insect: { label: 'Insect', color: '#f4b43c' }, animal: { label: 'Animal sample', color: '#e8614a' },
  lure: { label: 'Lure', color: '#9b7ce0' }, food: { label: 'Food', color: '#e0853a' }, key: { label: 'Key item', color: '#ffd57a' },
  shell: { label: 'Shell', color: '#f0c8b0' },
};
const SORT_ORDER: ItemKind[] = ['lure', 'food', 'shell', 'animal', 'insect', 'plant', 'fungus', 'material', 'key', 'tool'];
const EAT: Record<string, string> = { energy: 'Energy for a long day in the field', steady: 'Steady hands: less camera shake next trip', quiet: 'Light feet: animals hear you less next trip' };
const MAX_SLOTS = 24;

const CSS = `
.bp-root { position: relative; width: min(94vw, 60em); height: min(92vh, 36em); padding: calc(var(--px) * 14) calc(var(--px) * 13) calc(var(--px) * 11); color: var(--paper); display: flex; flex-direction: column; overflow: hidden !important; font-variant-ligatures: none; }
.bp-root > :not(.k-backdrop) { position: relative; z-index: 1; }
.bp-head { display: flex; align-items: center; gap: 0.7em; margin-bottom: 0.6em; }
.bp-head .badge { width: calc(var(--px) * 16); height: calc(var(--px) * 16); image-rendering: pixelated; filter: drop-shadow(0 3px 0 rgba(0,0,0,0.35)); }
.bp-head .t { font-family: var(--pix); font-size: 1.55em; color: var(--amber2); line-height: 1; text-shadow: 0 3px 0 rgba(0,0,0,0.45); }
.bp-head .s { font-family: var(--hand); font-size: 0.98em; opacity: 0.85; }
.bp-cap { margin-left: auto; display: flex; flex-direction: column; gap: 0.2em; align-items: flex-end; font-family: var(--pix); font-size: 0.85em; }
.bp-cap .bar { display: flex; gap: 2px; }
.bp-cap .bar i { width: 0.5em; height: 0.8em; background: rgba(0,0,0,0.35); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.3); }
.bp-cap .bar i.on { background: var(--teal); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.25); }
.bp-cap.full .bar i.on { background: var(--coral); }
.bp-cap.full b { color: #ffb3a4; }
.bp-head .btn { font-size: 0.9em; }
.bp-v10 { display: grid; grid-template-columns: auto 7.5em; gap: 0.25em 0.5em; align-items: center; font-family: var(--pix); font-size: 0.85em; margin-left: 0.6em; }
.bp-v10 span { text-align: right; white-space: nowrap; }
.bp-v10 .m { height: 0.8em; background: rgba(0,0,0,0.35); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.3); position: relative; }
.bp-v10 .m i { position: absolute; left: 0; top: 0; bottom: 0; width: var(--v, 0%); background: var(--c, var(--amber)); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.25); transition: width 0.3s; }
.bp-v10 .en { --c: #8ac83a; }
.bp-v10 .en.low { --c: var(--coral); }
.bp-v10 .kg.over { --c: var(--coral); }
.bp-v10 span.over b { color: #ffb3a4; }
.bp-facts .warn { color: #9a5a08; }
.bp-facts .bad { color: #a8382a; font-weight: 700; }
.bp-facts .good { color: #2f6b2a; }
.bp-body { flex: 1; min-height: 0; display: grid; grid-template-columns: auto 1fr; gap: calc(var(--px) * 8); }
.bp-left { display: flex; flex-direction: column; gap: 0.5em; min-height: 0; }
.bp-grid { display: grid; grid-template-columns: repeat(6, calc(var(--px) * 20)); grid-auto-rows: calc(var(--px) * 20); gap: calc(var(--px) * 1); padding: calc(var(--px) * 3); }
.bp-slot { position: relative; border: 0; padding: 0; background: var(--tile) center / 100% 100% no-repeat; image-rendering: pixelated; cursor: pointer; transition: transform 0.1s, filter 0.12s; }
.bp-slot:hover { transform: translateY(-2px); filter: brightness(1.12); }
.bp-slot:focus-visible { outline: 2px solid var(--teal2); outline-offset: 1px; }
.bp-slot.sel { box-shadow: 0 0 0 calc(var(--px) * 1) var(--amber), 0 0 12px rgba(244,180,60,0.55); z-index: 2; }
.bp-slot img { position: absolute; left: 50%; top: 46%; width: calc(var(--px) * 16); height: calc(var(--px) * 16); transform: translate(-50%, -50%); image-rendering: pixelated; filter: drop-shadow(0 calc(var(--px) * 1) 0 rgba(0,0,0,0.35)); }
.bp-slot.pop img { animation: bpPop 0.35s cubic-bezier(.2,1.7,.4,1) both; animation-delay: var(--d, 0s); }
@keyframes bpPop { from { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } }
.bp-slot .n { position: absolute; right: calc(var(--px) * 2); bottom: calc(var(--px) * 1); font-family: var(--pix); font-size: 0.9em; color: var(--paper); text-shadow: 1px 0 0 #10201c, -1px 0 0 #10201c, 0 1px 0 #10201c, 0 -1px 0 #10201c, 0 2px 0 #10201c; line-height: 1; }
.bp-slot .n.max { color: var(--amber2); }
.bp-slot .dot { position: absolute; left: calc(var(--px) * 2); top: calc(var(--px) * 2); width: calc(var(--px) * 3); height: calc(var(--px) * 3); background: var(--c); box-shadow: 0 0 0 1px rgba(0,0,0,0.5); }
.bp-slot.empty { cursor: default; }
.bp-slot.empty:hover { transform: none; filter: none; }
.bp-slot.locked { cursor: help; opacity: 0.85; }
.bp-slot.locked:hover { transform: none; }
.bp-belt { display: grid; grid-template-columns: auto repeat(6, calc(var(--px) * 18)); grid-auto-rows: calc(var(--px) * 18); align-items: center; gap: calc(var(--px) * 1); padding: calc(var(--px) * 4) calc(var(--px) * 4); margin-top: auto; background: var(--belt) center / 100% 100%; image-rendering: pixelated; align-self: flex-start; }
.bp-belt .lbl { grid-row: 1 / span 2; }
.bp-belt .lbl { font-family: var(--pix); font-size: 0.72em; letter-spacing: 0.12em; color: var(--amber2); writing-mode: vertical-rl; transform: rotate(180deg); margin-right: 0.2em; text-shadow: 0 1px 0 rgba(0,0,0,0.6); }
.bp-belt .bp-slot { width: calc(var(--px) * 18); height: calc(var(--px) * 18); }
.bp-belt .bp-slot img { width: calc(var(--px) * 16); height: calc(var(--px) * 16); }
.bp-detail { position: relative; padding: 1em 1.1em; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.bp-dtop { display: grid; grid-template-columns: auto 1fr; gap: 0.9em; align-items: center; }
.bp-dtop .big { width: calc(var(--px) * 36); height: calc(var(--px) * 36); display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, rgba(255,240,190,0.22), rgba(0,0,0,0.25) 70%); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.3), inset 0 -5px 0 rgba(0,0,0,0.2); }
.bp-dtop .big img { width: calc(var(--px) * 32); height: calc(var(--px) * 32); image-rendering: pixelated; filter: drop-shadow(0 4px 0 rgba(0,0,0,0.35)); animation: bpBob 2.4s ease-in-out infinite; }
@keyframes bpBob { 50% { transform: translateY(-3px); } }
.bp-dtop .nm { font-family: var(--pix); font-size: 1.4em; color: var(--amber2); line-height: 1.05; }
.bp-chip { display: inline-block; font-family: var(--pix); font-size: 0.7em; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.15em 0.5em; margin-top: 0.35em; color: #10201c; background: var(--c); }
.bp-desc { font-size: 0.92em; line-height: 1.45; margin: 0.75em 0 0.5em; opacity: 0.95; }
.bp-facts { display: flex; flex-direction: column; gap: 0.3em; font-size: 0.86em; }
.bp-facts div { display: flex; gap: 0.5em; align-items: baseline; }
.bp-facts dt { font-family: var(--pix); color: var(--teal2); font-size: 0.85em; letter-spacing: 0.06em; min-width: 5.4em; text-transform: uppercase; }
.bp-facts .rp { color: var(--amber2); font-family: var(--pix); }
.bp-acts { display: flex; flex-wrap: wrap; gap: 0.45em; margin-top: auto; padding-top: 0.8em; }
.bp-acts .btn { font-size: 0.92em; }
.bp-acts .btn.drop { background: rgba(232,97,74,0.18); color: #ffb3a4; box-shadow: inset 0 0 0 2px rgba(232,97,74,0.5); margin-left: auto; }
.bp-acts .btn .p { display: inline-block; height: 0.35em; width: 0; background: var(--ink); vertical-align: middle; margin-left: 0.4em; }
.bp-empty { margin: auto; text-align: center; font-family: var(--hand); font-size: 1.1em; opacity: 0.85; line-height: 1.4; }
.bp-empty img { width: 4em; image-rendering: pixelated; opacity: 0.6; display: block; margin: 0 auto 0.4em; }
.bp-toast { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); z-index: 20; display: flex; align-items: center; gap: 0.5em; font-family: var(--pix); font-size: 1.25em; color: var(--paper); background: rgba(16,32,28,0.92); padding: 0.4em 0.9em 0.4em 0.5em; box-shadow: 0 0 0 3px var(--amber), 0 6px 0 rgba(0,0,0,0.4); animation: bpToast 1.3s ease-out forwards; pointer-events: none; }
.bp-toast img { width: 2.4em; image-rendering: pixelated; }
@keyframes bpToast { 0% { transform: translate(-50%, -30%) scale(0.6); opacity: 0; } 14% { transform: translate(-50%, -50%) scale(1.06); opacity: 1; } 22% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { transform: translate(-50%, -80%); opacity: 0; } }
.bp-hint { font-size: 0.75em; opacity: 0.7; font-family: var(--pix); margin-top: 0.3em; }
`;

// ---------------------------------------------------------------- slot tiles (pixel art, cached)
const tileCache = new Map<string, string>();
function tile(kind: 'pocket' | 'locked' | 'loop' | 'loopEmpty', px: number): string {
  const k = kind + px;
  const hit = tileCache.get(k);
  if (hit) return hit;
  const s = kind.startsWith('loop') ? 18 : 20;
  const b = new PixelBuffer(s, s);
  if (kind === 'pocket' || kind === 'locked') {
    b.rect(0, 0, s, s, H('#262c16'));
    fabric(b, 1, 1, s - 2, s - 2, H('#48522c'), H('#424b28'), H('#56623a'), 5);
    b.rect(1, 1, s - 2, 2, H('#2e3519'));
    b.rect(1, s - 2, s - 2, 1, H('#6c7843'));
    b.rect(1, 3, 1, s - 5, H('#3a4322'));
    const T = kind === 'locked' ? H('#8a8458') : H('#b8ae78');
    stitch(b, 3, 4, s - 4, 4, T); stitch(b, 3, s - 4, s - 4, s - 4, T);
    stitch(b, 3, 4, 3, s - 4, T); stitch(b, s - 4, 4, s - 4, s - 4, T);
    if (kind === 'locked') {
      b.rect(2, 2, s - 4, s - 4, H('#353d20'));
      for (let i = 0; i < 4; i++) {
        const x = 4 + i * 4;
        b.set(x, 9, H('#c9bf8a')); b.set(x + 1, 10, H('#c9bf8a')); b.set(x + 2, 11, H('#c9bf8a'));
        b.set(x + 2, 9, H('#c9bf8a')); b.set(x, 11, H('#c9bf8a'));
      }
      b.rect(2, 10, s - 4, 1, H('#262c16'));
    }
  } else {
    const L1 = H('#3e2814'), L2 = H('#6a4424'), L3 = H('#8a5e34');
    b.rect(0, 0, s, s, L1);
    b.rectFn(1, 1, s - 2, s - 2, (x, y) => (noise(x, y, 3) > 0.85 ? L3 : L2));
    b.rect(1, 1, s - 2, 1, L3);
    b.rect(1, s - 2, s - 2, 1, H('#2a1a0c'));
    stitch(b, 2, 3, s - 3, 3, H('#d9c68e'), 1, 1); stitch(b, 2, s - 4, s - 3, s - 4, H('#d9c68e'), 1, 1);
    b.rect(3, 5, s - 6, s - 10, kind === 'loopEmpty' ? H('#24160a') : H('#2e1d0e'));
    b.set(2, 2, H('#e8c070')); b.set(s - 3, 2, H('#e8c070'));
  }
  const cv = document.createElement('canvas');
  cv.width = s; cv.height = s;
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), s, s), 0, 0);
  const u = cv.toDataURL();
  tileCache.set(k, u);
  return u;
}
function beltBg(w: number, h: number): string {
  const b = new PixelBuffer(w, h);
  b.rect(0, 0, w, h, H('#2a1a0c'));
  b.rectFn(1, 2, w - 2, h - 4, (x, y) => (noise(x, y, 12) > 0.88 ? H('#7a5230') : H('#5e3e22')));
  b.rect(1, 2, w - 2, 1, H('#8a6038'));
  b.rect(1, h - 3, w - 2, 1, H('#3a2412'));
  stitch(b, 2, 4, w - 3, 4, H('#d9c68e'), 2, 2); stitch(b, 2, h - 5, w - 3, h - 5, H('#d9c68e'), 2, 2);
  for (let x = 6; x < w - 4; x += 8) { b.set(x, h / 2, H('#2a1a0c')); }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), w, h), 0, 0);
  return cv.toDataURL();
}

type Sel = { area: 'pack'; i: number } | { area: 'belt'; i: number } | null;

/** Open the backpack. Resolves when it closes. (onEat is kept for old callers: V10 eating goes through v10/forage10.) */
export function openBackpack(o: { onEat?: (id: string) => void | Promise<void> } = {}): Promise<void> {
  void o;
  css('backpack', CSS);
  sfx('zipper');
  return new Promise<void>(resolve => {
    const px = uiPx();
    const root = el('div', 'bp-root k-ui');
    root.innerHTML = `<div class="bp-head"><img class="badge" src="${uiIconURL('pack', 4)}" alt=""><div><div class="t">Rowan’s backpack</div><div class="s">Smells faintly of wet dog and field notes</div></div>
      <div class="bp-cap"><span>Pockets <b class="used"></b></span><div class="bar"></div></div>
      <div class="bp-v10"><span class="el">Energy <b></b></span><div class="m en"><i></i></div><span class="wl">Load <b></b></span><div class="m kg"><i></i></div></div>
      <button class="btn ghost sort" title="Sort and merge stacks">Sort</button><button class="btn ghost x">Close <span class="key">Tab</span></button></div>
      <div class="bp-body"><div class="bp-left"><div class="bp-grid"></div><div class="bp-belt"><span class="lbl">TOOLS</span></div></div><div class="bp-detail"></div></div>`;
    const grid = root.querySelector('.bp-grid') as HTMLElement;
    const belt = root.querySelector('.bp-belt') as HTMLElement;
    const detail = root.querySelector('.bp-detail') as HTMLElement;
    const capEl = root.querySelector('.bp-cap') as HTMLElement;
    const v10El = root.querySelector('.bp-v10') as HTMLElement;
    let sel: Sel = stacks().length ? { area: 'pack', i: 0 } : game.save.tools.length ? { area: 'belt', i: 0 } : null;
    let busy = false;
    let popKeys = () => {};
    let disposeBg = () => {};
    let popIn = true;

    const close = game.ui.modal(root, () => { popKeys(); disposeBg(); game.persist(); resolve(); }, false);
    const wrap = root.parentElement as HTMLElement;
    const tryClose = () => { if (busy) return; sfx('zipper', { pitch: 1.15 }); close(); };
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) tryClose(); });
    (root.querySelector('.x') as HTMLElement).onclick = tryClose;
    (root.querySelector('.sort') as HTMLElement).onclick = () => { if (!busy) sortPack(); };

    root.style.setProperty('--px', px + 'px');
    const inner = (): [number, number, number, number][] => {
      const rr = root.getBoundingClientRect();
      return [grid, detail].map(e => {
        const r = e.getBoundingClientRect();
        return [Math.round((r.left - rr.left) / px), Math.round((r.top - rr.top) / px), Math.round(r.width / px), Math.round(r.height / px)] as [number, number, number, number];
      });
    };

    const toast = (id: string, text: string) => {
      const t = root.appendChild(el('div', 'bp-toast', `<img src="${itemIconURL(id, 3)}" alt="">${text}`));
      setTimeout(() => t.remove(), 1400);
    };

    const renderCap = () => {
      const cap = capacity(), used = stacks().length;
      (capEl.querySelector('.used') as HTMLElement).textContent = `${used}/${cap}`;
      const bar = capEl.querySelector('.bar') as HTMLElement;
      bar.innerHTML = '';
      for (let i = 0; i < cap; i++) bar.appendChild(el('i', i < used ? 'on' : ''));
      capEl.classList.toggle('full', freeSlots() <= 0);
      // V10: energy and the load
      const e = energy(), em = maxEnergy(), w = packWeight(), wc = packCapacity();
      (v10El.querySelector('.el b') as HTMLElement).textContent = `${Math.ceil(e)}/${em}`;
      const en = v10El.querySelector('.en') as HTMLElement;
      en.style.setProperty('--v', `${Math.round((e / em) * 100)}%`);
      en.classList.toggle('low', e / em < 0.25);
      (v10El.querySelector('.wl b') as HTMLElement).textContent = `${w.toFixed(1)}/${wc} kg`;
      (v10El.querySelector('.wl') as HTMLElement).classList.toggle('over', w > wc);
      const kg = v10El.querySelector('.kg') as HTMLElement;
      kg.style.setProperty('--v', `${Math.round(Math.min(1, w / wc) * 100)}%`);
      kg.classList.toggle('over', w > wc);
      v10El.title = w > wc ? 'Over capacity: you tire much faster and slow right down. Drop something heavy.' : 'Heavier packs cost more energy on expeditions and slow you down.';
    };

    const renderGrid = () => {
      const inv = stacks();
      const cap = capacity();
      grid.innerHTML = '';
      const nextSkill = !game.save.skills['pack1'] ? SKILL_BY_ID['pack1'] : !game.save.skills['pack2'] ? SKILL_BY_ID['pack2'] : null;
      for (let i = 0; i < MAX_SLOTS; i++) {
        const st = inv[i];
        const locked = i >= cap;
        const b = el('button', 'bp-slot' + (st ? '' : locked ? ' locked' : ' empty') + (sel?.area === 'pack' && sel.i === i ? ' sel' : '') + (popIn && st ? ' pop' : ''));
        b.style.setProperty('--tile', `url(${tile(locked ? 'locked' : 'pocket', px)})`);
        if (st) {
          const d = ITEMS[st.id];
          b.innerHTML = `<img src="${itemIconURL(st.id, 3)}" alt="${esc(d?.name ?? st.id)}"><span class="dot" style="--c:${KIND[d?.kind ?? 'material'].color}"></span>${st.n > 1 || d?.stack > 1 ? `<span class="n${st.n >= (d?.stack ?? 1) ? ' max' : ''}">${st.n}</span>` : ''}`;
          b.title = `${d?.name ?? st.id} ×${st.n}`;
          b.style.setProperty('--d', `${Math.min(i, 18) * 0.025}s`);
          b.onclick = () => select({ area: 'pack', i });
        } else if (locked) {
          b.title = nextSkill ? `Sewn shut. Learn “${nextSkill.name}” (Survival skills) for more pockets.` : 'Sewn shut';
          b.onclick = () => { sfx('wrong', { vol: 0.35 }); };
        } else {
          b.title = 'Empty pocket';
          b.tabIndex = -1;
        }
        grid.appendChild(b);
      }
    };

    const renderBelt = () => {
      belt.style.setProperty('--belt', `url(${beltBg(128, game.save.tools.length > 6 ? 46 : 27)})`);
      belt.querySelectorAll('.bp-slot').forEach(e => e.remove());
      const tools = game.save.tools;
      tools.forEach((id, i) => {
        const d = ITEMS[id];
        const b = el('button', 'bp-slot' + (sel?.area === 'belt' && sel.i === i ? ' sel' : ''));
        b.style.setProperty('--tile', `url(${tile('loop', px)})`);
        b.innerHTML = `<img src="${itemIconURL(id, 3)}" alt="${esc(d?.name ?? id)}">`;
        b.title = d?.name ?? id;
        b.onclick = () => select({ area: 'belt', i });
        belt.appendChild(b);
      });
      for (let i = tools.length; i < (tools.length > 6 ? 12 : 6); i++) {
        const b = el('button', 'bp-slot empty');
        b.style.setProperty('--tile', `url(${tile('loopEmpty', px)})`);
        b.tabIndex = -1;
        belt.appendChild(b);
      }
    };

    const selectedId = (): string | null => {
      if (!sel) return null;
      if (sel.area === 'pack') return stacks()[sel.i]?.id ?? null;
      return game.save.tools[sel.i] ?? null;
    };

    const renderDetail = () => {
      detail.innerHTML = '';
      const id = selectedId();
      if (!id) {
        detail.innerHTML = `<div class="bp-empty"><img src="${uiIconURL('pack', 4)}" alt="">${stacks().length ? 'Pick something to look at it.' : 'Nothing but lint and a biscuit crumb.<br>Collect things in the field with <span class="key">E</span>.'}</div>`;
        return;
      }
      const d = ITEMS[id];
      const k = KIND[d?.kind ?? 'material'];
      const n = count(id);
      detail.appendChild(el('div', 'bp-dtop', `<div class="big"><img src="${itemIconURL(id, 4)}" alt=""></div><div><div class="nm">${esc(d?.name ?? id)}</div><span class="bp-chip" style="--c:${k.color}">${k.label}</span></div>`));
      detail.appendChild(el('div', 'bp-desc', esc(d?.desc ?? '')));
      const facts = detail.appendChild(el('dl', 'bp-facts'));
      const fact = (label: string, html: string) => facts.appendChild(el('div', '', `<dt>${label}</dt><dd style="margin:0">${html}</dd>`));
      const kg = weightOf(id);
      const kgs = (v: number) => (v < 0.1 ? `${Math.round(v * 1000)} g` : `${v.toFixed(v < 1 ? 2 : 1)} kg`);
      if (d?.kind === 'tool') { fact('Belt', 'Always with you. Tools never take a pocket.'); fact('Weight', kgs(kg)); }
      else {
        fact('Carrying', `${n} <span style="opacity:0.65">(stacks of ${d?.stack ?? 1})</span>`);
        fact('Weight', `${kgs(kg)}${n > 1 ? ` each <span style="opacity:0.65">· ${kgs(kg * n)} in all</span>` : ''}`);
      }
      if (d?.where) fact('Found', esc(d.where));
      if (d?.lab) {
        const rp = analysisRp(id);
        const times = game.save.analyzed[id] ?? 0;
        fact('Laptop', rp > 0 ? `Analyse for <span class="rp">+${rp} RP</span>${times ? ` <span style="opacity:0.65">(analysed ×${times})</span>` : ' <span style="color:var(--teal2)">· new!</span>'}` : `Fully catalogued <span style="opacity:0.65">(×${times})</span>`);
      }
      const fi = foodInfo(id);
      if (fi.edible) {
        const sick = timesSick(id);
        const verdict = fi.verdict === 'unknown' ? `<br><span class="warn">Unidentified: it might be poisonous.</span> Analyse a sample to be sure.${sick ? ` <span class="bad">It made you ill ${sick > 1 ? sick + ' times' : 'once'}.</span>` : ''}`
          : fi.verdict === 'poison' ? '<br><span class="bad">POISONOUS</span> <span style="opacity:0.7">(researched)</span>'
          : fi.risky ? '<br><span class="good">Safe to eat</span> <span style="opacity:0.7">(researched)</span>' : '';
        fact('Eat', `${fi.energy ? `<span class="rp">+${fi.energy} energy</span>` : 'No energy to speak of'}${fi.buff ? ` · ${EAT[fi.buff]}` : ''}${verdict}`);
      }
      if (d?.kind === 'lure') fact('Use', 'Set it down on an expedition to draw animals in.');
      const acts = detail.appendChild(el('div', 'bp-acts'));
      if (d?.kind === 'tool') return;
      if (fi.edible) {
        // (skin: plain = green, amber = a gamble, red = poison)
        const b = acts.appendChild(el('button', `btn${fi.verdict === 'unknown' ? ' amber' : fi.verdict === 'poison' ? ' red' : ''}`,
          fi.verdict === 'unknown' ? 'Eat (risky)' : fi.verdict === 'poison' ? 'Eat anyway' : fi.energy ? `Eat · +${fi.energy}` : 'Eat')) as HTMLButtonElement;
        b.onclick = () => eat(id);
      }
      const usedIn = Object.values(RECIPE_BY_ID).filter(r => r.needs.some(([i]) => i === id));
      if (usedIn.length) acts.appendChild(el('div', 'bp-hint', `Used at the workbench for: ${usedIn.map(r => esc(ITEMS[r.out]?.name ?? r.out)).join(', ')}`));
      if (d?.kind !== 'key') {
        const dr = acts.appendChild(el('button', 'btn drop', 'Drop')) as HTMLButtonElement;
        dr.onclick = () => drop(id);
      }
    };

    const select = (s: Sel) => {
      if (busy) return;
      sel = s;
      sfx('ui', { vol: 0.5, pitch: 1.1 });
      popIn = false;
      renderGrid(); renderBelt(); renderDetail();
    };

    const refresh = () => {
      popIn = false;
      const inv = stacks();
      if (sel?.area === 'pack' && sel.i >= inv.length) sel = inv.length ? { area: 'pack', i: inv.length - 1 } : null;
      renderCap(); renderGrid(); renderBelt(); renderDetail();
    };

    // V10: eatFood does the eating (energy, buffs, the forage gamble); o.onEat is no longer needed
    const eat = async (id: string) => {
      if (busy) return;
      const can = canEat(id);
      if (!can.ok) { sfx('wrong', { vol: 0.4 }); toast(id, can.reason ?? 'Not now'); return; }
      if (foodInfo(id).verdict === 'poison') {
        busy = true;
        const c = await confirmPop(root, `<b>${esc(ITEMS[id]?.name ?? id)}</b> is poisonous. You’ll be ill. Eat it anyway?`, [{ label: 'Eat it' }, { label: 'Keep it', cls: 'ghost' }]);
        busy = false;
        if (c !== 0) return;
      }
      busy = true;
      sfx('munch');
      let r: ReturnType<typeof eatFood> | null = null;
      try { r = eatFood(id, { quiet: true }); } catch (e) { console.error(e); }
      setTimeout(() => sfx('munch', { pitch: 1.2 }), 160);
      const fx = r?.fx ?? 'none';
      toast(id, fx === 'none' ? (r?.energy ? `+${r.energy} energy` : `Ate ${ITEMS[id]?.name ?? id}`) : fx === 'dizzy' ? 'Uh-oh. Dizzy...' : fx === 'big' ? 'Violently sick!' : 'Stomach ache...');
      busy = false;
      refresh();
    };

    const drop = async (id: string) => {
      if (busy) return;
      const n = count(id);
      const name = esc(ITEMS[id]?.name ?? id);
      const btns = n > 1 ? [{ label: 'Drop 1' }, { label: `Drop all ${n}` }, { label: 'Keep', cls: 'ghost' }] : [{ label: 'Drop it' }, { label: 'Keep', cls: 'ghost' }];
      busy = true;
      const c = await confirmPop(root, `Leave <b>${n > 1 ? n + '× ' : ''}${name}</b> behind? Dropped items are gone for good.`, btns);
      busy = false;
      if (c < 0 || c === btns.length - 1) return;
      const k = n > 1 && c === 1 ? n : 1;
      remove(id, k);
      sfx('place', { vol: 0.6 });
      game.persist();
      refresh();
    };

    const sortPack = () => {
      const totals = new Map<string, number>();
      for (const s of stacks()) totals.set(s.id, (totals.get(s.id) ?? 0) + s.n);
      const ids = [...totals.keys()].sort((a, b) => {
        const ka = SORT_ORDER.indexOf(ITEMS[a]?.kind ?? 'material'), kb = SORT_ORDER.indexOf(ITEMS[b]?.kind ?? 'material');
        return ka - kb || (ITEMS[a]?.name ?? a).localeCompare(ITEMS[b]?.name ?? b);
      });
      const cur = selectedId();
      const inv = game.save.inv;
      inv.length = 0;
      for (const id of ids) {
        let left = totals.get(id) ?? 0;
        const max = Math.max(1, ITEMS[id]?.stack ?? 1);
        while (left > 0) { const k = Math.min(max, left); inv.push({ id, n: k }); left -= k; }
      }
      game.persist();
      sfx('rustle', { vol: 0.6 });
      sfx('zipper', { vol: 0.4, pitch: 1.3 });
      if (cur && sel?.area === 'pack') { const i = inv.findIndex(s => s.id === cur); sel = i >= 0 ? { area: 'pack', i } : sel; }
      popIn = true;
      renderCap(); renderGrid(); renderDetail();
    };

    const move = (dx: number, dy: number) => {
      const inv = stacks();
      if (!sel) { sel = inv.length ? { area: 'pack', i: 0 } : null; renderGrid(); renderDetail(); return; }
      if (sel.area === 'pack') {
        let i = sel.i + dx + dy * 6;
        if (dy > 0 && i >= inv.length) { if (game.save.tools.length) { select({ area: 'belt', i: Math.min(game.save.tools.length - 1, sel.i % 6) }); } return; }
        i = Math.max(0, Math.min(inv.length - 1, i));
        select({ area: 'pack', i });
      } else {
        if (dy < 0 && inv.length) { select({ area: 'pack', i: Math.min(inv.length - 1, Math.floor((inv.length - 1) / 6) * 6 + Math.min(5, sel.i)) }); return; }
        const i = Math.max(0, Math.min(game.save.tools.length - 1, sel.i + dx));
        select({ area: 'belt', i });
      }
    };

    popKeys = pushKeys(e => {
      if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyI') { tryClose(); return true; }
      if (busy) return true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { move(1, 0); return true; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { move(-1, 0); return true; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { move(0, 1); return true; }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { move(0, -1); return true; }
      if (e.code === 'Delete' || e.code === 'Backspace') { const id = selectedId(); if (id && sel?.area === 'pack' && ITEMS[id]?.kind !== 'key') drop(id); return true; }
      if (e.code === 'KeyE' || e.code === 'Enter') { const id = selectedId(); if (id && foodInfo(id).edible && sel?.area === 'pack') eat(id); return true; }
    });

    renderCap(); renderGrid(); renderBelt(); renderDetail();
    popIn = false;
    disposeBg = pixelBackdrop(root, (b, w, h) => paintParchment(b, w, h, { inner: inner() }), px, [grid, detail]);

  });
}
