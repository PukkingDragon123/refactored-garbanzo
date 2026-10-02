// Developer panel (Settings > Developer tools): a test tool, clearly labelled as one. Jump to any
// scene or story point, skip quest steps so the story moves on, cheats (items, Research Points,
// energy, skills, laptop apps, the Region Map, the boat, the day and the clock, blackouts, camp and
// expedition events), a flag editor, noclip / fast move, an FPS overlay, instant photos, and save
// management (export / import / reset / quick slots).
//
// Lazy-loaded from the Settings window; nothing here is imported in normal play. Mouse, keyboard
// (arrows / Tab move, Enter / Space press, 1-5 switch tabs, Esc closes) and touch all work, and the
// layout folds down to phone width. Painted pixel icons only (src/ui/pxicons.ts).

import { game } from '../game/game';
import { el } from '../ui/ui';
import { audio } from '../core/audio';
import { pxIcon, pxIconCss } from '../ui/pxicons';
import { pushKeys, esc } from '../ui/laptop-kit';
import { itemIconURL } from '../art/itemicons';
import { ITEMS } from '../game/items';
import { add, count } from '../game/inventory';
import { newSave, clearSave } from '../game/save';
import type { SaveData } from '../game/save';
import { trackedQuest } from '../game/quests';
import * as P from './devpoints';
import type { DevChapter, QuestDef } from './devpoints';

// ---------------------------------------------------------------- prefs (this browser only)
interface Prefs { tab: string; reloadAfter: boolean; cleanReload: boolean; noclip: boolean; fast: number; hud: boolean; instant: boolean }
const PREF_KEY = 'zl-dev-prefs';
const prefs: Prefs = { tab: 'scenes', reloadAfter: true, cleanReload: false, noclip: false, fast: 1, hud: false, instant: false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}')); } catch { /* storage blocked */ }
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ } }

// ---------------------------------------------------------------- styles
const CSS = () => `
.dv-wrap { position: absolute; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 8px; background: rgba(10, 8, 4, 0.6); pointer-events: auto; animation: dvFade 0.15s ease-out; }
@keyframes dvFade { from { opacity: 0; } }
.dv { position: relative; width: min(800px, 100%); height: min(700px, 100%); display: flex; flex-direction: column; padding: 0.55em 0.8em 0.6em; font-family: var(--pix); color: #3a2614; }
/* a tall window: the frame without its tiled page (whose edge lines would stripe the list), on a plain page */
.dv.panel { border-image-slice: 6; background: #f2e4bc padding-box !important; }
.dv-jump { display: flex; flex-wrap: wrap; gap: 0.3em; margin: 0.1em 0 0.2em; }
.dv-head { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; }
.dv-head .pz-tab { font-size: 1.2em !important; display: inline-flex; align-items: center; gap: 0.4em; }
.dv-warn { flex: 1; min-width: 12em; font-size: 0.8em; line-height: 1.2; color: #a8382a; display: flex; align-items: center; gap: 0.4em; }
.dv-head .pz-x { flex: none; }
.dv-tabs { display: flex; gap: 0.3em; overflow-x: auto; margin: 0.45em 0 0.35em; padding: 2px 2px 4px; scrollbar-width: none; flex: none; }
.dv-tabs::-webkit-scrollbar { display: none; }
.dv-tabs .btn { font-size: 0.8em; padding: 0.05em 0.6em !important; display: inline-flex; align-items: center; gap: 0.4em; white-space: nowrap; flex: none; }
.dv-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 0.1em 0.35em 0.5em 0.1em; scrollbar-width: thin; scrollbar-color: #8a6a3a transparent; }
.dv-foot { flex: none; display: flex; align-items: center; gap: 0.5em; margin-top: 0.35em; font-size: 0.78em; color: #6a4a2a; min-height: 1.5em; }
.dv-foot .st { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dv-foot .st.ok { color: #2f6b2a; } .dv-foot .st.bad { color: #a8382a; }
.dv h3 { margin: 0.7em 0 0.3em; font-family: var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.95em; color: #2f6b2a; display: flex; align-items: center; gap: 0.45em;
  padding-bottom: 0.15em; background: repeating-linear-gradient(90deg, #b89a6a 0 4px, transparent 4px 8px) left bottom / 100% 2px no-repeat; }
.dv h3:first-child { margin-top: 0.2em; }
.dv-note { font-size: 0.8em; color: #6a4a2a; line-height: 1.3; margin: 0.2em 0 0.4em; }
.dv-tools { display: flex; flex-wrap: wrap; gap: 0.4em 0.8em; align-items: center; margin: 0.1em 0 0.3em; }
.dv-tools input[type=search], .dv-tools input[type=text] { flex: 1 1 12em; }
.dv input[type=search], .dv input[type=text], .dv input[type=number], .dv textarea {
  font: inherit; font-size: 0.95em; color: #3a2614; background: #f8eed0; border: 0; border-radius: 0; min-width: 0; padding: 0.25em 0.5em;
  box-shadow: inset 0 0 0 2px #8a6a3a, inset 0 3px 0 rgba(0, 0, 0, 0.1); -webkit-appearance: none; appearance: none; }
.dv input[type=number] { width: 5em; }
.dv textarea { width: 100%; min-height: 5.5em; resize: vertical; font-size: 0.8em; }
.dv input:focus, .dv textarea:focus { outline: none; box-shadow: inset 0 0 0 2px #3f7a34, 0 0 0 2px #fff3a0; }
.dv-chk { display: inline-flex; align-items: center; gap: 0.4em; font-size: 0.85em; cursor: pointer; user-select: none; }
.dv-chk input { width: 1.1em; height: 1.1em; accent-color: #3f7a34; margin: 0; }
.dv-ch { margin: 0.15em 0 0.45em; }
.dv-ch > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.5em; padding: 0.3em 0.2em; font-family: var(--head); text-transform: uppercase; letter-spacing: 0.08em;
  color: #2f6b2a; font-size: 1em; background: repeating-linear-gradient(90deg, #b89a6a 0 4px, transparent 4px 8px) left bottom / 100% 2px no-repeat; }
.dv-ch > summary::-webkit-details-marker { display: none; }
.dv-ch > summary::before { content: ${pxIconCss('play', 2)}; transition: transform 0.12s; }
.dv-ch[open] > summary::before { transform: rotate(90deg); }
.dv-ch > summary .n { margin-left: auto; font-size: 0.75em; color: #6a4a2a; letter-spacing: 0.02em; }
.dv-ch > summary:focus-visible { outline: 3px solid #fff3a0; outline-offset: 1px; }
.dv-pt { display: flex; align-items: center; gap: 0.6em; width: 100%; text-align: left; padding: 0.4em 0.6em; margin: 0.25em 0; min-height: 2.6em; font: inherit; color: #3a2614; cursor: pointer;
  background: rgba(120, 80, 30, 0.12); border: 0; border-radius: 0; box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.35); }
div.dv-pt { cursor: default; }
button.dv-pt:hover, .dv-pt:focus-visible, .dv-pt:focus-within { background: rgba(90, 164, 71, 0.2); box-shadow: inset 0 0 0 2px #3f7a34; outline: none; }
.dv-pt > .ic { flex: none; width: 1.6em; display: flex; justify-content: center; }
.dv-pt .tx { flex: 1; min-width: 0; }
.dv-pt .tx b { display: block; font-weight: 400; color: #3a2614; font-size: 1em; line-height: 1.15; }
.dv-pt .tx small { display: block; font-size: 0.78em; color: #6a4a2a; line-height: 1.2; overflow-wrap: anywhere; }
.dv-pt .vs { display: flex; gap: 0.3em; flex-wrap: wrap; justify-content: flex-end; }
.dv .dv-b { font-size: 0.72em; padding: 0.02em 0.55em !important; display: inline-flex; align-items: center; gap: 0.35em; white-space: nowrap; }
.dv .dv-b.on { border-image-source: var(--sk-btn); }
.dv-btns { display: flex; flex-wrap: wrap; gap: 0.35em; align-items: center; margin: 0.3em 0; }
.dv-btns .lbl { font-size: 0.85em; color: #6a4a2a; margin-right: 0.2em; }
.dv-card { padding: 0.5em 0.7em; margin: 0.45em 0; background: rgba(120, 80, 30, 0.1); box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.3); }
.dv-card.main { box-shadow: inset 0 0 0 2px #c8841c; }
.dv-qh { display: flex; align-items: baseline; gap: 0.5em; flex-wrap: wrap; }
.dv-qh b { font-weight: 400; font-size: 1.05em; color: #2f6b2a; }
.dv-tag { display: inline-block; font-size: 0.68em; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.05em 0.45em; color: #fff4e0; background: #6a4a2a; }
.dv-tag.main { background: #c8841c; } .dv-tag.on, .dv-tag.active { background: #3f7a34; } .dv-tag.done { background: #2a6a5a; } .dv-tag.hidden { background: #8a7a64; }
.dv-steps { list-style: none; margin: 0.35em 0 0.2em; padding: 0; }
.dv-steps li { display: flex; gap: 0.5em; align-items: flex-start; padding: 0.1em 0; font-size: 0.9em; line-height: 1.2; }
.dv-steps li > span:first-child { flex: none; width: 1.2em; display: flex; justify-content: center; padding-top: 0.1em; }
.dv-steps li.done { opacity: 0.6; }
.dv-steps li.cur { color: #2f6b2a; }
.dv-steps li em { font-style: normal; color: #6a4a2a; font-size: 0.85em; margin-left: 0.3em; }
.dv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5em, 1fr)); gap: 0.3em; }
.dv-item { display: flex; align-items: center; gap: 0.4em; padding: 0.25em 0.4em; min-height: 2.4em; font: inherit; font-size: 0.85em; color: #3a2614; text-align: left; cursor: pointer;
  background: rgba(120, 80, 30, 0.12); border: 0; border-radius: 0; box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.3); }
.dv-item:hover, .dv-item:focus-visible { background: rgba(90, 164, 71, 0.2); box-shadow: inset 0 0 0 2px #3f7a34; outline: none; }
.dv-item img { width: 24px; height: 24px; image-rendering: pixelated; flex: none; }
.dv-item .nm { flex: 1; min-width: 0; line-height: 1.1; overflow-wrap: anywhere; }
.dv-item .nm small { display: block; color: #6a4a2a; font-size: 0.8em; }
.dv-item .n { flex: none; color: #2f6b2a; }
.dv-kv { display: flex; align-items: center; gap: 0.4em; padding: 0.15em 0.2em; min-height: 2.2em; background: repeating-linear-gradient(90deg, rgba(90,60,20,0.25) 0 3px, transparent 3px 6px) left bottom / 100% 1px no-repeat; }
.dv-kv .k { flex: 1; min-width: 0; font-size: 0.85em; overflow-wrap: anywhere; line-height: 1.15; }
.dv-kv input[type=number] { width: 6em; }
.dv-slot { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
.dv-slot .tx { flex: 1 1 12em; font-size: 0.85em; }
.dv-slot .tx b { font-weight: 400; color: #2f6b2a; }
.dv-empty { font-size: 0.85em; color: #6a4a2a; padding: 0.4em 0.2em; }
.dv .btn.dv-b:focus-visible, .dv .dv-tabs .btn:focus-visible { outline: 3px solid #fff3a0; outline-offset: 1px; }
@media (pointer: coarse) { .dv .dv-b { font-size: 0.85em; min-height: 2.3em; } .dv-pt { min-height: 3em; } .dv-tabs .btn { min-height: 2.4em; } .dv-item { min-height: 2.8em; } }
@media (max-width: 600px) {
  .dv-wrap { padding: 4px; }
  .dv { padding: 0.4em 0.5em 0.5em; height: 100%; }
  .dv-warn { order: 3; flex-basis: 100%; }
  div.dv-pt { flex-wrap: wrap; }
  div.dv-pt .vs { width: 100%; justify-content: flex-start; padding-left: 2.2em; }
}
.dv-hud { position: absolute; left: 50%; top: 4px; transform: translateX(-50%); z-index: 80; pointer-events: none; font-family: var(--pix); font-size: 12px; line-height: 1.25;
  color: #fff4d0; background: rgba(26, 14, 6, 0.8); box-shadow: 0 0 0 2px #e0a818, 0 0 0 4px #1a0e06; padding: 3px 8px; white-space: pre; max-width: calc(100vw - 24px); overflow: hidden; }
.dv-hud b { color: #ffd84a; font-weight: 400; }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = el('style', '', CSS());
  s.dataset.ui = 'devpanel';
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- the panel
const TABS: { id: string; label: string; icon: string }[] = [
  { id: 'scenes', label: 'Scenes', icon: 'map' },
  { id: 'quests', label: 'Quests', icon: 'scroll' },
  { id: 'cheats', label: 'Cheats', icon: 'bolt' },
  { id: 'flags', label: 'Flags', icon: 'flag' },
  { id: 'saves', label: 'Saves', icon: 'disk' },
];

interface Panel { wrap: HTMLElement; root: HTMLElement; body: HTMLElement; status: HTMLElement; close(): void }
let panel: Panel | null = null;
let chaptersP: Promise<DevChapter[]> | null = null;
const loadChapters = () => (chaptersP ??= P.chapters());

const ic = (name: string, scale = 2) => pxIcon(name, { scale });
const hudRefresh = () => (game.scene as unknown as { hud?: { refresh?(f?: boolean): void } } | null)?.hud?.refresh?.(true);

/** open the developer panel (from Settings) */
export function openDevPanel() {
  if (panel) return;
  style();
  audio.play('uiOpen');
  const wrap = el('div', 'dv-wrap interactive');
  const root = wrap.appendChild(el('div', 'dv panel'));
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Developer tools');
  root.innerHTML = `<div class="dv-head"><span class="pz-tab">${ic('wrench')} Developer</span>
    <span class="dv-warn">${ic('bolt')}<span>TEST TOOL, not part of the game. Jumps and cheats change your save (it is backed up to the Auto slot first).</span></span>
    <button class="pz-x" aria-label="Close developer tools" title="Close (Esc)"></button></div>
    <div class="dv-tabs" role="tablist"></div><div class="dv-body"></div>
    <div class="dv-foot"><span class="st">Arrows / Tab move · Enter presses · 1-5 switch tabs · Esc closes</span></div>`;
  const tabs = root.querySelector('.dv-tabs') as HTMLElement;
  const body = root.querySelector('.dv-body') as HTMLElement;
  const status = root.querySelector('.dv-foot .st') as HTMLElement;
  for (const [i, t] of TABS.entries()) {
    const b = el('button', 'btn ghost', `${ic(t.icon)}<span>${t.label}</span>`);
    b.dataset.tab = t.id;
    b.setAttribute('role', 'tab');
    b.title = `${t.label} (${i + 1})`;
    b.onclick = () => { audio.play('ui', { vol: 0.5 }); showTab(t.id); };
    tabs.appendChild(b);
  }
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  // typing in a field never reaches the game or the windows underneath (Settings closes on J / Tab)
  root.addEventListener('keydown', e => { if (isField(e.target)) e.stopPropagation(); });
  const pop = pushKeys(e => onKey(e));
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    pop();
    wrap.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    panel = null;
  };
  (root.querySelector('.pz-x') as HTMLElement).onclick = () => { audio.play('uiBack'); close(); };
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) { audio.play('uiBack'); close(); } });
  panel = { wrap, root, body, status, close };
  showTab(TABS.some(t => t.id === prefs.tab) ? prefs.tab : 'scenes');
  requestAnimationFrame(() => (tabs.querySelector('.btn:not(.ghost)') as HTMLElement | null)?.focus());
}

function isField(t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement {
  const e = t as HTMLElement | null;
  return !!e && (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file'].includes((e as HTMLInputElement).type)));
}
function focusables(): HTMLElement[] {
  if (!panel) return [];
  return [...panel.root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, summary')].filter(e => e.offsetParent !== null || e === document.activeElement);
}
function moveFocus(d: number) {
  const f = focusables();
  if (!f.length) return;
  const i = f.indexOf(document.activeElement as HTMLElement);
  const n = f[(i < 0 ? (d > 0 ? 0 : f.length - 1) : (i + d + f.length) % f.length)];
  n.focus();
  n.scrollIntoView({ block: 'nearest' });
}
function onKey(e: KeyboardEvent): boolean {
  if (!panel) return false;
  const t = e.target as HTMLElement;
  if (isField(t) && panel.root.contains(t)) {
    if (e.code === 'Escape') { t.blur(); (t.closest('.dv-body') ? panel.body : panel.root).focus?.(); moveFocus(0); return true; }
    if (e.code === 'Tab') { moveFocus(e.shiftKey ? -1 : 1); return true; }
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'number') { moveFocus(e.code === 'ArrowDown' ? 1 : -1); return true; }
    return false;
  }
  // browser shortcuts (reload, dev tools, copy) pass straight through
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code)) return false;
  const inTabs = !!t?.closest?.('.dv-tabs');
  switch (e.code) {
    case 'Escape': audio.play('uiBack'); panel.close(); return true;
    case 'Tab': moveFocus(e.shiftKey ? -1 : 1); return true;
    case 'ArrowDown': moveFocus(1); return true;
    case 'ArrowUp': moveFocus(-1); return true;
    case 'ArrowRight': case 'ArrowLeft': {
      const d = e.code === 'ArrowRight' ? 1 : -1;
      if (inTabs) {
        const i = TABS.findIndex(x => x.id === prefs.tab);
        const nx = TABS[(i + d + TABS.length) % TABS.length];
        showTab(nx.id);
        (panel.root.querySelector(`.dv-tabs [data-tab="${nx.id}"]`) as HTMLElement | null)?.focus();
      } else moveFocus(d);
      return true;
    }
    case 'PageDown': panel.body.scrollBy({ top: panel.body.clientHeight * 0.8 }); return true;
    case 'PageUp': panel.body.scrollBy({ top: -panel.body.clientHeight * 0.8 }); return true;
    case 'Enter': case 'Space': case 'NumpadEnter':
      if (t && panel.root.contains(t) && (t.tagName === 'BUTTON' || t.tagName === 'SUMMARY' || t.tagName === 'INPUT')) t.click();
      return true;
  }
  const dg = /^Digit([1-5])$/.exec(e.code);
  if (dg) { const nx = TABS[+dg[1] - 1]; showTab(nx.id); (panel.root.querySelector(`.dv-tabs [data-tab="${nx.id}"]`) as HTMLElement | null)?.focus(); return true; }
  return true;
}

function say(msg: string, kind: '' | 'ok' | 'bad' = 'ok') {
  if (!panel) { game.ui.toast(msg, 'DEV', kind === 'bad' ? 'coral' : 'teal', 2600); return; }
  panel.status.className = 'st ' + kind;
  panel.status.innerHTML = msg;
}

function showTab(id: string) {
  if (!panel) return;
  prefs.tab = id;
  savePrefs();
  for (const b of panel.root.querySelectorAll<HTMLElement>('.dv-tabs .btn')) {
    const on = b.dataset.tab === id;
    b.classList.toggle('ghost', !on);
    b.setAttribute('aria-selected', String(on));
  }
  const body = panel.body;
  body.innerHTML = '';
  body.scrollTop = 0;
  const r = { scenes: renderScenes, quests: renderQuests, cheats: renderCheats, flags: renderFlags, saves: renderSaves }[id as 'scenes'];
  void Promise.resolve(r(body)).catch(e => { console.error(e); body.innerHTML = `<div class="dv-empty">Could not build this tab: ${esc(String(e))}</div>`; });
}
const rerender = () => { if (panel) { const y = panel.body.scrollTop; showTab(prefs.tab); panel.body.scrollTop = y; } };

// small DOM helpers
function btn(label: string, fn: () => unknown, o: { icon?: string; cls?: string; title?: string; confirm?: string } = {}) {
  const b = el('button', `btn dv-b ${o.cls ?? 'ghost'}`, `${o.icon ? ic(o.icon) : ''}<span>${label}</span>`);
  if (o.title) b.title = o.title;
  let armed = 0;
  b.onclick = async () => {
    if (o.confirm && armed < performance.now()) {
      armed = performance.now() + 3000;
      (b.lastElementChild as HTMLElement).textContent = o.confirm;
      setTimeout(() => { if (b.isConnected) (b.lastElementChild as HTMLElement).textContent = label; }, 3000);
      audio.play('wrong', { vol: 0.3 });
      return;
    }
    audio.play('ui', { vol: 0.5 });
    try { await fn(); } catch (e) { console.error(e); say('Failed: ' + esc(String(e)), 'bad'); }
  };
  return b;
}
function sec(host: HTMLElement, title: string, icon?: string) {
  host.appendChild(el('h3', '', `${icon ? ic(icon) : ''}${title}`));
}
function row(host: HTMLElement, label?: string) {
  const r = host.appendChild(el('div', 'dv-btns'));
  if (label) r.appendChild(el('span', 'lbl', label));
  return r;
}
function check(label: string, on: boolean, fn: (v: boolean) => void) {
  const l = el('label', 'dv-chk', `<input type="checkbox"${on ? ' checked' : ''}><span>${label}</span>`);
  const i = l.querySelector('input') as HTMLInputElement;
  i.onchange = () => fn(i.checked);
  return l;
}

// ---------------------------------------------------------------- jumping
/** back the save up, close every window, clear whatever the old scene left hanging */
function prepJump() {
  backupAuto();
  closeAll();
  game.paused = false;
  game.slowmo = 1;
  game.ui.letterbox(false);
  game.ui.bubbles.clear();
  if (game.ui.dialogueOpen) { game.ui.dialogueOpen = false; game.ui.dlg.classList.remove('on'); }
  void import('../game/v10/boat').then(m => m.setBoatAway(false));
}
/** close the dev panel and every modal under it (pause, settings...) the way their own close does */
export function closeAll() {
  panel?.close();
  const layer = game.ui.modalLayer;
  for (const w of [...layer.children].reverse()) w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  if (game.ui.modalOpen > 0) { game.ui.modalOpen = 0; layer.innerHTML = ''; }
  game.paused = false;
}

/** a cutscene or conversation is running: its script would carry on into the next scene (and could
 *  set flags in the new save), so a jump then refreshes the page instead */
function midCutscene() {
  const sc = game.scene as unknown as { cutscene?: boolean; story?: { busy?: boolean } } | null;
  return !!(sc?.cutscene || sc?.story?.busy || game.ui.dialogueOpen || game.ui.bubbles.active || (game as unknown as { busy: boolean }).busy);
}
function reloadTo(key: string) {
  backupAuto();
  game.persist();
  const u = new URL(location.href);
  u.searchParams.delete('scene');
  u.searchParams.set('devjump', key);
  game.ui.toast('Reloading the page...', 'DEV', 'teal', 4000);
  setTimeout(() => { location.href = u.toString(); }, 60);
}
async function runPoint(name: string, run: () => Promise<void>, key?: string) {
  if (key && (prefs.cleanReload || midCutscene())) { closeAll(); reloadTo(key); return; }
  prepJump();
  game.ui.toast(`Jumping to <b>${esc(name)}</b>`, 'DEV', 'teal', 2400);
  try { await run(); } catch (e) { console.error('[dev] jump failed', e); game.ui.toast('Jump failed: ' + esc(String(e)), 'DEV', 'coral', 5000); }
}
/** rebuild the scene from the save (after a quest skip), refreshing the page if a cutscene is running */
async function reloadHere(): Promise<boolean> {
  if (prefs.cleanReload || midCutscene()) { reloadTo('reload'); return true; }
  prepJump();
  return P.reloadScene();
}

/** ?devjump=<point>[~<variant>] (a clean-reload jump): run it on boot */
export async function bootJump(key: string) {
  const [id, vi] = key.split('~');
  if (id === 'reload') { try { history.replaceState(null, '', location.pathname); } catch { /* */ } const f = await import('../game/scenes/flow'); await f.continueV4(); return; }
  const all = await loadChapters();
  const p = all.flatMap(c => c.points).find(x => x.id === id);
  const run = p ? (vi !== undefined ? p.variants?.[+vi]?.run : p.run) : null;
  try { history.replaceState(null, '', location.pathname); } catch { /* file:// */ }
  if (!run) { const f = await import('../game/scenes/flow'); await f.goTitle(); return; }
  await run();
}

// ---------------------------------------------------------------- tab: scenes
async function renderScenes(body: HTMLElement) {
  const tools = body.appendChild(el('div', 'dv-tools'));
  const q = tools.appendChild(el('input')) as HTMLInputElement;
  q.type = 'search'; q.placeholder = 'Filter scenes and story points'; q.setAttribute('aria-label', 'Filter scenes');
  tools.appendChild(check('Clean reload (refresh the page on jump)', prefs.cleanReload, v => { prefs.cleanReload = v; savePrefs(); }));
  body.appendChild(el('div', 'dv-note', 'Day 0 and Day 1 points start a fresh save played up to that moment (flags, quests, tools), so they always start the same way. Day 2+ points and places keep your save once it has finished Day 1.'));
  const list = body.appendChild(el('div', '', '<div class="dv-empty">Loading the scene list...</div>'));
  const all = await loadChapters();
  list.innerHTML = '';
  const rows: { e: HTMLElement; text: string; ch: HTMLDetailsElement }[] = [];
  for (const ch of all) {
    const d = list.appendChild(el('details', 'dv-ch')) as HTMLDetailsElement;
    d.open = true;
    d.innerHTML = `<summary>${esc(ch.name)}<span class="n">${ch.points.length}</span></summary>`;
    const box = d.appendChild(el('div', ''));
    for (const p of ch.points) {
      const inner = `<span class="ic">${ic(p.icon ?? 'pip')}</span><span class="tx"><b>${esc(p.name)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</span>`;
      let e: HTMLElement;
      if (p.variants?.length) {
        e = el('div', 'dv-pt', inner);
        const vs = e.appendChild(el('span', 'vs'));
        p.variants.forEach((v, i) => vs.appendChild(btn(esc(v.label), () => runPoint(`${p.name} (${v.label})`, v.run, `${p.id}~${i}`), { cls: 'amber' })));
      } else {
        e = el('button', 'dv-pt', inner);
        e.onclick = () => { audio.play('ui', { vol: 0.5 }); void runPoint(p.name, p.run!, p.id); };
      }
      box.appendChild(e);
      rows.push({ e, text: `${ch.name} ${p.name} ${p.sub ?? ''} ${p.id}`.toLowerCase(), ch: d });
    }
  }
  q.oninput = () => {
    const s = q.value.trim().toLowerCase();
    const shown = new Map<HTMLDetailsElement, number>();
    for (const r of rows) {
      const on = !s || s.split(/\s+/).every(w => r.text.includes(w));
      r.e.style.display = on ? '' : 'none';
      shown.set(r.ch, (shown.get(r.ch) ?? 0) + (on ? 1 : 0));
    }
    for (const [d, n] of shown) { d.style.display = n ? '' : 'none'; if (s && n) d.open = true; }
  };
}

// ---------------------------------------------------------------- tab: quests
function renderQuests(body: HTMLElement) {
  const tools = body.appendChild(el('div', 'dv-tools'));
  tools.appendChild(check('Reload the scene after a skip, so the story picks up the change', prefs.reloadAfter, v => { prefs.reloadAfter = v; savePrefs(); }));
  const after = async (msg: string) => {
    game.persist();
    hudRefresh();
    if (prefs.reloadAfter) {
      closeAll();
      const ok = await reloadHere();
      game.ui.toast(msg + (ok ? '' : ' (this scene cannot be reloaded: use Scenes)'), 'DEV', 'teal', 3000);
    } else { say(msg); rerender(); }
  };
  const active = P.QUESTS.filter(q => P.questStatus(q.id) === 'active');
  const tracked = trackedQuest();
  sec(body, `Active quests (${active.length})`, 'scroll');
  if (!active.length) body.appendChild(el('div', 'dv-empty', 'No active quests. Start one below, or jump to a story point.'));
  const sorted = [...active].sort((a, b) => (b === tracked ? 1 : 0) - (a === tracked ? 1 : 0) || (+b.main) - (+a.main));
  for (const q of sorted) body.appendChild(questCard(q, q === tracked, after));
  // every quest
  const d = body.appendChild(el('details', 'dv-ch')) as HTMLDetailsElement;
  d.innerHTML = `<summary>All quests<span class="n">${P.QUESTS.length}</span></summary>`;
  const box = d.appendChild(el('div', ''));
  const filter = box.appendChild(el('input')) as HTMLInputElement;
  filter.type = 'search'; filter.placeholder = 'Filter quests'; filter.style.width = '100%'; filter.style.margin = '0.3em 0';
  const rows: [HTMLElement, string][] = [];
  for (const q of P.QUESTS) {
    const st = P.questStatus(q.id);
    const r = box.appendChild(el('div', 'dv-kv', `<span class="k">${esc(q.title)} <span class="dv-tag ${st}">${st}</span>${q.main ? ' <span class="dv-tag main">main</span>' : ''}<br><small style="color:#6a4a2a">${esc(q.id)} · ${esc(q.giver)}</small></span>`));
    if (st === 'hidden') r.appendChild(btn('Start', () => { P.startQuest(q.id); game.persist(); hudRefresh(); rerender(); }, { cls: '' }));
    if (st !== 'done') r.appendChild(btn('Complete', () => { P.completeWhole(q); void after(`Completed ${esc(q.title)}.`); }, { cls: 'amber' }));
    if (st !== 'hidden') r.appendChild(btn('Reset', () => { delete game.save.quests[q.id]; if (game.save.tracked === q.id) game.save.tracked = null; game.persist(); hudRefresh(); rerender(); }, { cls: 'red', title: 'Back to not started (flags stay)' }));
    rows.push([r, `${q.title} ${q.id} ${q.giver}`.toLowerCase()]);
  }
  filter.oninput = () => { const s = filter.value.trim().toLowerCase(); for (const [r, t] of rows) r.style.display = !s || t.includes(s) ? '' : 'none'; };
}

function questCard(q: QuestDef, tracked: boolean, after: (msg: string) => Promise<void>) {
  const c = el('div', 'dv-card' + (q.main ? ' main' : ''));
  const cur = P.currentStepIndex(q);
  c.innerHTML = `<div class="dv-qh"><b>${esc(q.title)}</b>${q.main ? '<span class="dv-tag main">main</span>' : '<span class="dv-tag">side</span>'}${tracked ? '<span class="dv-tag on">tracked</span>' : ''}<small style="color:#6a4a2a">${esc(q.id)} · ${esc(q.giver)}</small></div>`;
  const ol = c.appendChild(el('ol', 'dv-steps'));
  q.steps.forEach((s, i) => {
    let prog = '';
    try { const p = s.progress?.(); if (p) prog = ` <em>${p[0]}/${p[1]}</em>`; } catch { /* */ }
    let done = false;
    try { done = s.done(); } catch { /* */ }
    const k = done ? 'done' : i === cur ? 'cur' : 'todo';
    ol.appendChild(el('li', k, `<span>${ic(done ? 'check' : i === cur ? 'play' : 'pip0')}</span><span>${esc(s.text)}${prog}</span>`));
  });
  const b = c.appendChild(el('div', 'dv-btns'));
  const canStep = cur < q.steps.length && P.canSkipStep(q, cur);
  const sb = b.appendChild(btn('Complete step', () => {
    const t = q.steps[cur]?.text ?? '';
    if (P.completeStep(q, cur)) void after(`Step done: ${esc(t)}`);
    else say('No skip rule for this step: use Complete quest.', 'bad');
  }, { icon: 'check', cls: '' }));
  if (!canStep) { sb.disabled = true; sb.title = cur >= q.steps.length ? 'All steps are done' : 'No skip rule for this step: use Complete quest'; }
  b.appendChild(btn('Complete quest', () => { P.completeWhole(q); void after(`Completed ${esc(q.title)}.`); }, { icon: 'star', cls: 'amber' }));
  b.appendChild(btn('Skip to next', async () => {
    const all = await loadChapters();
    if (prefs.cleanReload || midCutscene()) {
      // a cutscene is running: do the same through a page refresh
      closeAll();
      const pid = P.nextPointId(q);
      if (pid) { reloadTo(pid); return; }
      if (q.id === 'v10day') { await (await import('../game/v10/day')).startNextDay(); reloadTo('reload'); return; }
      P.completeWhole(q);
      if (q.next && P.questStatus(q.next) === 'hidden') P.startQuest(q.next, true);
      reloadTo('reload');
      return;
    }
    prepJump();
    const msg = await P.skipToNext(q, all);
    game.ui.toast(esc(msg), 'DEV', 'teal', 3200);
    hudRefresh();
  }, { icon: 'skip', cls: 'amber', title: 'Finish this quest and go to where the next one starts' }));
  return c;
}

// ---------------------------------------------------------------- tab: cheats
async function renderCheats(body: HTMLElement) {
  const [energyM, skillsM, appsM, regionsM, boatM, dayM] = await Promise.all([
    import('../game/v10/energy'), import('../game/v10/skills10'), import('../ui/v4/moriApps'), import('../game/v10/regions'), import('../game/v10/boat'), import('../game/v10/day'),
  ]);
  await Promise.all([import('../game/v10/finds'), import('../game/sites10/ocean')]).catch(() => {});

  // quick links to the sections below (long on a phone)
  const nav = body.appendChild(el('div', 'dv-jump'));
  const NAV: [string, string][] = [['Toggles', 'bug'], ['Research', 'star'], ['Energy', 'bolt'], ['Unlocks', 'check'], ['Kitten', 'boat'], ['Day', 'sun'], ['Camp events', 'flag'], ['Expedition', 'map'], ['Give items', 'gift']];
  for (const [label, icn] of NAV) nav.appendChild(btn(label, () => {
    const h = [...body.querySelectorAll('h3')].find(x => x.textContent?.includes(label === 'Day' ? 'Day ' : label));
    h?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, { icon: icn }));
  // toggles
  sec(body, 'Toggles', 'bug');
  const t = row(body);
  const tg = (label: string, on: () => boolean, flip: () => void, icon: string) => {
    const b = btn(`${label}: ${on() ? 'ON' : 'OFF'}`, () => { flip(); savePrefs(); applyToggles(); rerender(); }, { icon, cls: on() ? '' : 'ghost' });
    t.appendChild(b);
  };
  tg('Noclip (fly)', () => prefs.noclip, () => { prefs.noclip = !prefs.noclip; }, 'skip');
  tg('Debug overlay', () => prefs.hud, () => { prefs.hud = !prefs.hud; }, 'bug');
  tg('Instant photos', () => prefs.instant, () => { prefs.instant = !prefs.instant; }, 'film');
  const sp = row(body, 'Move speed');
  for (const k of [1, 2, 3, 5]) sp.appendChild(btn(`${k}x`, () => { prefs.fast = k; savePrefs(); applyToggles(); rerender(); }, { cls: prefs.fast === k ? '' : 'ghost' }));
  body.appendChild(el('div', 'dv-note', 'Noclip: arrows / WASD fly (Space up, Shift faster). Instant photos: prints are dry at once and the hold-steady ring fills on its own.'));

  // RP and energy
  sec(body, `Research Points (${game.save.rp} RP)`, 'star');
  const rp = row(body);
  for (const n of [10, 100, 1000]) rp.appendChild(btn(`+${n}`, () => { game.save.rp += n; game.save.totalRp += n; game.persist(); hudRefresh(); rerender(); say(`+${n} RP`); }, { icon: 'plus' }));
  rp.appendChild(btn('Zero', () => { game.save.rp = 0; game.persist(); hudRefresh(); rerender(); }, { icon: 'minus', cls: 'red' }));
  sec(body, `Energy (${Math.round(energyM.energy())} / ${energyM.maxEnergy()})`, 'bolt');
  const en = row(body);
  en.appendChild(btn('Refill', () => { energyM.refill(); hudRefresh(); rerender(); say('Energy full, ailments gone.'); }, { icon: 'plus', cls: '' }));
  en.appendChild(btn('Half', () => { const e = energyM.energy(), m = energyM.maxEnergy(); if (e > m / 2) energyM.spend(e - m / 2, 'dev'); else energyM.restore(m / 2 - e); hudRefresh(); rerender(); }, {}));
  en.appendChild(btn('Drain', () => { energyM.spend(energyM.energy() - 5, 'dev'); hudRefresh(); rerender(); say('Drained to 5 (camp never drops lower).'); }, { icon: 'minus' }));
  en.appendChild(btn('Blackout', () => { closeAll(); if (energyM.onExpedition()) energyM.spend(energyM.energy() + 1, 'dev'); else energyM.fireBlackout(); }, { icon: 'moon', cls: 'red', title: 'Mori collapses (on an expedition he is carried home)' }));

  // unlocks
  sec(body, 'Unlocks', 'check');
  const ul = row(body);
  ul.appendChild(btn('All skills', () => {
    skillsM.grantAll10();
    void import('../game/skills').then(m => { for (const s of m.SKILLS) game.save.skills[s.id] = true; game.persist(); });
    hudRefresh(); say('Every skill learned (V10 tree and V2 skills).');
  }, { icon: 'star' }));
  ul.appendChild(btn('All laptop apps', () => { for (const u of appsM.UNLOCKS) appsM.markInstalled(u.id); say(`${appsM.UNLOCKS.length} apps installed on MoriOS.`); }, { icon: 'film' }));
  ul.appendChild(btn('Reveal Region Map', () => { for (const l of regionsM.LOCATIONS) regionsM.revealMap(l.id, -1e9, 1e9); game.persist(); say('The whole map is explored.'); }, { icon: 'map' }));
  ul.appendChild(btn('Find all places', () => { let n = 0; for (const l of regionsM.LOCATIONS) if (regionsM.findLocation(l.id)) n++; game.persist(); say(`${n} new places on the map (fast travel).`); }, { icon: 'flag' }));

  // boat
  const bs = boatM.boatStage();
  sec(body, `The Kitten (stage ${bs}: ${boatM.boatStageName()})`, 'boat');
  const br = row(body, 'Set stage');
  boatM.BOAT_STAGES.forEach((name, i) => br.appendChild(btn(`${i} ${name}`, () => { P.boatTo(i); hudRefresh(); rerender(); say(`Boat at stage ${i} (${name}).`); }, { cls: i === bs ? '' : 'ghost' })));
  row(body).appendChild(btn('Finish the boat repair', () => { P.boatTo(6); hudRefresh(); rerender(); say('The Kitten is launched: boat trips are open.'); }, { icon: 'boat', cls: 'amber' }));

  // day and time
  const ds = dayM.dayState();
  sec(body, `Day ${dayM.dayNumber()} · ${ds.phase}`, 'sun');
  const dr = body.appendChild(el('div', 'dv-tools'));
  const dIn = dr.appendChild(el('input')) as HTMLInputElement;
  dIn.type = 'number'; dIn.min = '1'; dIn.max = '999'; dIn.value = String(dayM.dayNumber()); dIn.setAttribute('aria-label', 'Day number');
  dr.appendChild(btn('Set day', () => { game.save.day = Math.max(1, Math.round(+dIn.value || 1)); if (game.save.day >= 2) game.save.flags['v4:day1'] = true; game.persist(); hudRefresh(); rerender(); say(`Day ${game.save.day}.`); }, { cls: '' }));
  dr.appendChild(btn('Sleep to next day', async () => { await runPoint('the next morning', async () => { await dayM.startNextDay(); const { goIsland } = await import('../game/v4/islandflow'); await goIsland(); }); }, { icon: 'moon' }));
  const ph = row(body, 'Day phase');
  for (const p of ['morning', 'out', 'evening', 'night'] as const) ph.appendChild(btn(p, async () => {
    const cd = (await import('../game/v10/campday')).activeCamp();
    dayM.setPhase(p);
    cd?.mode(p);
    hudRefresh(); rerender(); say(`Phase: ${p}${cd ? '' : ' (no camp scene up: it applies when the camp loads)'}`);
  }, { cls: ds.phase === p ? '' : 'ghost' }));
  const sc = game.scene as unknown as { clock?: { t: number; set(t: number): void }; site?: unknown; tod?: string } | null;
  const tr = row(body, `Time of day${sc?.clock ? ` (clock ${sc.clock.t.toFixed(2)})` : ''}`);
  const CLOCK: [string, number, string][] = [['Dawn', 0.05, 'sun'], ['Morning', 0.7, 'sun'], ['Midday', 1.5, 'sun'], ['Golden', 2.2, 'sun'], ['Dusk', 3.0, 'moon'], ['Night', 3.8, 'moon']];
  for (const [label, v, icn] of CLOCK) {
    const b = tr.appendChild(btn(label, () => { sc?.clock?.set(v); say(`Clock set to ${v} (${label}).`); rerender(); }, { icon: icn }));
    if (!sc?.clock) { b.disabled = true; b.title = 'Only the island scenes run a day clock'; }
  }
  if (sc?.site && !sc.clock) {
    const fr = row(body, 'Reload this place at');
    for (const tod of ['dawn', 'day', 'dusk', 'night'] as const) fr.appendChild(btn(tod, async () => {
      prepJump();
      const [{ FieldScene }, ex] = await Promise.all([import('../game/scenes/field'), import('../game/v10/expedition')]);
      const tag = ex.sceneTag(sc), site = sc.site as ConstructorParameters<typeof FieldScene>[0];
      await game.go(() => { const f = new FieldScene(site, tod); if (tag) ex.tagScene(f, tag); return f; });
    }, { cls: sc.tod === tod ? '' : 'ghost' }));
  }
  const ct = row(body, 'V2 camp time');
  for (const tod of ['dawn', 'day', 'dusk', 'night'] as const) ct.appendChild(btn(tod, () => { game.save.campTime = tod; game.persist(); rerender(); }, { cls: game.save.campTime === tod ? '' : 'ghost' }));

  // camp events
  await import('../game/v10/campevents');
  const camp = (await import('../game/v10/campday')).activeCamp();
  sec(body, `Camp events (${dayM.CAMP_EVENTS.length})`, 'flag');
  body.appendChild(el('div', 'dv-note', camp ? 'Runs the event now at camp (marks it as done today).' : 'No camp scene is up: these jump to the camp morning first, then run.'));
  for (const ev of dayM.CAMP_EVENTS) {
    const r = body.appendChild(el('div', 'dv-kv', `<span class="k">${esc(ev.id)} <span class="dv-tag">${esc(ev.slot)}</span>${dayM.eventDone(ev.id) ? ' <span class="dv-tag done">seen</span>' : ''}</span>`));
    r.appendChild(btn('Run', async () => {
      const zlDay = (await import('../game/v10/campday')).DAY_ZL;
      if ((await import('../game/v10/campday')).activeCamp()) { closeAll(); const res = await zlDay.event(ev.id); if (res !== 'ok') game.ui.toast(esc(String(res)), 'DEV', 'coral'); return; }
      const all = await loadChapters();
      const p = all.flatMap(c => c.points).find(x => x.id === 'camp:morning');
      await runPoint('camp, then ' + ev.id, async () => { await p!.run!(); await zlDay.event(ev.id); });
    }, { icon: 'play', cls: '' }));
  }

  // expedition events
  const [{ EVENTS }, f10] = await Promise.all([import('../game/v10/events'), import('../game/v10/field10')]);
  const run = f10.run;
  sec(body, `Expedition events (${EVENTS.length})`, 'map');
  body.appendChild(el('div', 'dv-note', run ? `On an expedition at ${esc(run.loc)}: runs the event here and now.` : 'Only on an expedition (jump to a Region Map place first).'));
  for (const ev of EVENTS) {
    let fits = false;
    try { fits = !!run && ev.fits(run); } catch { /* */ }
    const r = body.appendChild(el('div', 'dv-kv', `<span class="k">${esc(ev.id)}${ev.once ? ' <span class="dv-tag">once</span>' : ''}${run ? ` <span class="dv-tag ${fits ? 'on' : 'hidden'}">${fits ? 'fits here' : 'does not fit'}</span>` : ''}</span>`));
    const b = r.appendChild(btn('Run', () => { const cur = f10.run; if (!cur) return; closeAll(); void Promise.resolve(ev.run(cur)).catch(e => console.warn(e)); }, { icon: 'play', cls: '' }));
    if (!run) b.disabled = true;
  }
  // items
  sec(body, 'Give items', 'gift');
  const it = body.appendChild(el('div', 'dv-tools'));
  const iq = it.appendChild(el('input')) as HTMLInputElement;
  iq.type = 'search'; iq.placeholder = 'Search items'; iq.setAttribute('aria-label', 'Search items');
  const nIn = it.appendChild(el('input')) as HTMLInputElement;
  nIn.type = 'number'; nIn.min = '1'; nIn.max = '99'; nIn.value = '5'; nIn.setAttribute('aria-label', 'How many'); nIn.title = 'How many';
  const ir = row(body);
  ir.appendChild(btn('All tools', () => { for (const d of Object.values(ITEMS)) if (d.kind === 'tool') add(d.id, 1); game.persist(); hudRefresh(); say('All tools on the belt.'); rerender(); }, { icon: 'wrench' }));
  ir.appendChild(btn('Empty backpack', () => { game.save.inv = []; game.persist(); hudRefresh(); say('Backpack emptied.'); rerender(); }, { icon: 'trash', cls: 'red', confirm: 'Sure? Tap again' }));
  const grid = body.appendChild(el('div', 'dv-grid'));
  const items = Object.values(ITEMS).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const cells: [HTMLElement, string][] = [];
  for (const d of items) {
    const c = el('button', 'dv-item', `<img src="${itemIconURL(d.id, 2)}" alt=""><span class="nm">${esc(d.name)}<small>${esc(d.kind)} · ${esc(d.id)}</small></span><span class="n">${count(d.id) || ''}</span>`);
    c.title = `Give ${d.name}`;
    c.onclick = () => {
      const n = Math.max(1, Math.min(99, Math.round(+nIn.value || 1)));
      const got = add(d.id, n);
      game.persist(); hudRefresh();
      (c.querySelector('.n') as HTMLElement).textContent = String(count(d.id));
      audio.play('ui', { vol: 0.4, pitch: 1.3 });
      say(got ? `+${got} ${esc(d.name)}` : `No room for ${esc(d.name)} (backpack full)`, got ? 'ok' : 'bad');
    };
    grid.appendChild(c);
    cells.push([c, `${d.name} ${d.id} ${d.kind}`.toLowerCase()]);
  }
  iq.oninput = () => { const s = iq.value.trim().toLowerCase(); for (const [c, tx] of cells) c.style.display = !s || tx.includes(s) ? '' : 'none'; };

}

// ---------------------------------------------------------------- tab: flags
function renderFlags(body: HTMLElement) {
  const f = game.save.flags, v = game.save.vars;
  const tools = body.appendChild(el('div', 'dv-tools'));
  const q = tools.appendChild(el('input')) as HTMLInputElement;
  q.type = 'search'; q.placeholder = 'Search flags and counters (e.g. v4:, trg:, v10:ev)'; q.setAttribute('aria-label', 'Search flags');
  const addRow = body.appendChild(el('div', 'dv-tools'));
  const k = addRow.appendChild(el('input')) as HTMLInputElement;
  k.type = 'text'; k.placeholder = 'New flag or counter name'; k.setAttribute('aria-label', 'New flag name');
  addRow.appendChild(btn('Add flag', () => { const key = k.value.trim(); if (!key) return; f[key] = true; game.persist(); hudRefresh(); say(`Flag ${esc(key)} on.`); k.value = ''; draw(); }, { icon: 'plus', cls: '' }));
  addRow.appendChild(btn('Add counter', () => { const key = k.value.trim(); if (!key) return; v[key] = v[key] ?? 1; game.persist(); hudRefresh(); k.value = ''; draw(); }, { icon: 'plus' }));
  body.appendChild(el('div', 'dv-note', 'Flags off stay in the list (false) until removed. Scenes read most flags when they load: reload the scene (Quests tab) or jump to see a change.'));
  const list = body.appendChild(el('div', ''));
  const draw = () => {
    list.innerHTML = '';
    const s = q.value.trim().toLowerCase();
    const fk = Object.keys(f).filter(x => !s || x.toLowerCase().includes(s)).sort();
    const vk = Object.keys(v).filter(x => !s || x.toLowerCase().includes(s)).sort();
    sec(list, `Flags (${fk.length})`, 'flag');
    if (!fk.length) list.appendChild(el('div', 'dv-empty', 'No flags match.'));
    for (const key of fk.slice(0, 400)) {
      const r = list.appendChild(el('div', 'dv-kv', `<span class="k">${esc(key)}</span>`));
      r.appendChild(btn(f[key] ? 'ON' : 'OFF', () => { f[key] = !f[key]; game.persist(); hudRefresh(); draw(); }, { cls: f[key] ? '' : 'ghost', title: 'Toggle' }));
      r.appendChild(btn('', () => { delete f[key]; game.persist(); hudRefresh(); draw(); }, { icon: 'trash', cls: 'red', title: 'Remove ' + key }));
    }
    if (fk.length > 400) list.appendChild(el('div', 'dv-empty', `${fk.length - 400} more: search to narrow it down.`));
    sec(list, `Counters (${vk.length})`, 'timer');
    for (const key of vk.slice(0, 200)) {
      const r = list.appendChild(el('div', 'dv-kv', `<span class="k">${esc(key)}</span>`));
      const n = r.appendChild(el('input')) as HTMLInputElement;
      n.type = 'number'; n.value = String(v[key]); n.setAttribute('aria-label', key);
      n.onchange = () => { v[key] = +n.value || 0; game.persist(); hudRefresh(); say(`${esc(key)} = ${v[key]}`); };
      r.appendChild(btn('', () => { delete v[key]; game.persist(); draw(); }, { icon: 'trash', cls: 'red', title: 'Remove ' + key }));
    }
  };
  q.oninput = draw;
  draw();
}

// ---------------------------------------------------------------- tab: saves
const SLOT_KEY = (n: string) => 'zl-dev-slot:' + n;
interface Slot { t: number; day: number; note: string; save: SaveData }
function readSlot(n: string): Slot | null {
  try { const r = localStorage.getItem(SLOT_KEY(n)); return r ? JSON.parse(r) as Slot : null; } catch { return null; }
}
function writeSlot(n: string, save: SaveData): string {
  const note = describe(save);
  const tryPut = (s: SaveData) => { localStorage.setItem(SLOT_KEY(n), JSON.stringify({ t: Date.now(), day: s.day, note, save: s } as Slot)); };
  try { tryPut(save); return ''; } catch { /* too big: drop the photos */ }
  try { tryPut({ ...save, album: [], raw: [], uploads: save.uploads.map(u => ({ ...u, img: '' })), best: {} }); return ' (photos left out: storage is full)'; } catch { return null as unknown as string; }
}
function describe(s: SaveData) {
  const f = s.flags ?? {};
  const where = f['v4:day1'] ? `Day ${s.day ?? 2} camp loop` : f['v4:isleWoke'] ? 'Day 1 island' : f['v4:bridge'] ? 'the wave' : f['v4:woke'] ? 'Day 0 ship' : f['v4'] ? 'the ship (start)' : 'V2 save';
  return `${where} · ${Object.keys(f).length} flags · ${s.rp ?? 0} RP`;
}
function backupAuto() { try { writeSlot('auto', JSON.parse(JSON.stringify(game.save))); } catch { /* */ } }
function normalize(d: Partial<SaveData>): SaveData {
  const base = newSave();
  return { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) } } as SaveData;
}
async function loadSaveData(d: Partial<SaveData>, label: string) {
  prepJump();
  game.save = normalize(d);
  game.persist();
  game.ui.toast(`Loaded <b>${esc(label)}</b>`, 'DEV', 'teal', 2600);
  const fl = await import('../game/scenes/flow');
  if (game.save.flags['v4']) await fl.continueV4();
  else await fl.goTitle();
}

function renderSaves(body: HTMLElement) {
  const s = game.save;
  let size = 0;
  try { size = JSON.stringify(s).length; } catch { /* */ }
  sec(body, 'This save', 'disk');
  body.appendChild(el('div', 'dv-note', `${esc(describe(s))} · ${Object.keys(s.quests).length} quests · ${s.inv.length} stacks · ${(size / 1024).toFixed(0)} KB`));
  const ex = row(body);
  ex.appendChild(btn('Copy JSON', async () => {
    const txt = JSON.stringify(game.save);
    try { await navigator.clipboard.writeText(txt); say('Save JSON copied to the clipboard.'); }
    catch { area.value = txt; area.select(); say('Clipboard blocked: the JSON is in the box below, copy it from there.', 'bad'); }
  }, { icon: 'disk', cls: '' }));
  ex.appendChild(btn('Download .json', () => {
    const blob = new Blob([JSON.stringify(game.save, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zealandia-save-day${game.save.day}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say('Downloading the save.');
  }, { icon: 'down' }));

  sec(body, 'Import', 'plus');
  const area = body.appendChild(el('textarea')) as HTMLTextAreaElement;
  area.placeholder = 'Paste save JSON here'; area.setAttribute('aria-label', 'Save JSON');
  const ir = row(body);
  ir.appendChild(btn('Load pasted JSON', async () => {
    let d: Partial<SaveData>;
    try { d = JSON.parse(area.value); } catch { say('That is not valid JSON.', 'bad'); return; }
    if (!d || typeof d !== 'object' || !('flags' in d)) { say('That does not look like a save (no flags).', 'bad'); return; }
    await loadSaveData(d, 'the pasted save');
  }, { icon: 'play', cls: 'amber' }));
  const file = el('input') as HTMLInputElement;
  file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
  file.onchange = async () => {
    const fl = file.files?.[0];
    if (!fl) return;
    try { const d = JSON.parse(await fl.text()); await loadSaveData(d, fl.name); } catch { say('Could not read that file as a save.', 'bad'); }
  };
  ir.appendChild(file);
  ir.appendChild(btn('Load a file...', () => file.click(), { icon: 'down' }));

  sec(body, 'Quick slots', 'disk');
  body.appendChild(el('div', 'dv-note', 'Kept in this browser only. Auto is written before every jump and save load.'));
  for (const n of ['1', '2', '3', 'auto']) {
    const sl = readSlot(n);
    const r = body.appendChild(el('div', 'dv-kv dv-slot', `<span class="tx"><b>${n === 'auto' ? 'Auto backup' : 'Slot ' + n}</b><br>${sl ? `${esc(sl.note)} · ${new Date(sl.t).toLocaleString()}` : '<span style="opacity:0.7">empty</span>'}</span>`));
    if (n !== 'auto') r.appendChild(btn('Save here', () => { const w = writeSlot(n, JSON.parse(JSON.stringify(game.save))); if (w === null) say('Storage is full: could not save the slot.', 'bad'); else { say(`Saved to slot ${n}${w}.`); rerender(); } }, { icon: 'disk', cls: '' }));
    if (sl) {
      r.appendChild(btn('Load', () => loadSaveData(sl.save, n === 'auto' ? 'the auto backup' : 'slot ' + n), { icon: 'play', cls: 'amber' }));
      r.appendChild(btn('', () => { try { localStorage.removeItem(SLOT_KEY(n)); } catch { /* */ } rerender(); }, { icon: 'trash', cls: 'red', title: 'Delete this slot' }));
    }
  }

  sec(body, 'Danger', 'cross');
  row(body).appendChild(btn('Reset save (new game)', async () => {
    backupAuto();
    prepJump();
    clearSave();
    const settings = { ...game.save.settings };
    game.save = newSave();
    game.save.settings = settings;
    const fl = await import('../game/scenes/flow');
    await fl.goTitle();
    game.ui.toast('Save reset (the old one is in the Auto slot).', 'DEV', 'coral', 3600);
  }, { icon: 'trash', cls: 'red', confirm: 'Really? Tap again' }));
}

// ---------------------------------------------------------------- toggles: noclip, speed, overlay, instant photos
interface PlayerT { x: number; y: number; vx: number; vy: number; facing: number; state: string; onGround: boolean; climb: unknown; speedK: number; update(dt: number, st: unknown): void }
let patched = false;
async function patchPlayer() {
  if (patched) return;
  patched = true;
  const { Player } = await import('../world/player');
  const proto = Player.prototype as unknown as PlayerT;
  const orig = proto.update;
  proto.update = function (this: PlayerT, dt: number, st: unknown) {
    const main = (game.scene as unknown as { player?: unknown } | null)?.player === this;
    if (main && prefs.noclip) { fly(this, dt); return; }
    if (main && prefs.fast > 1) {
      const k = this.speedK;
      this.speedK = k * prefs.fast;
      try { orig.call(this, dt, st); } finally { this.speedK = k; }
      return;
    }
    orig.call(this, dt, st);
  };
}
function fly(p: PlayerT, dt: number) {
  const inp = game.input, can = !game.ui.blocking;
  const ax = can ? inp.axisX() : 0;
  const ay = can ? (inp.down('down') ? 1 : 0) - (inp.down('up') || inp.down('jump') ? 1 : 0) : 0;
  const sp = (inp.down('run') ? 480 : 200) * dt;
  p.x += ax * sp;
  p.y += ay * sp;
  p.vx = p.vy = 0;
  if (ax) p.facing = ax > 0 ? 1 : -1;
  p.state = 'normal';
  p.climb = null;
  p.onGround = false;
  (p as unknown as { syncBody?(dt: number): void }).syncBody?.(dt);
}

let hudEl: HTMLElement | null = null;
let ticking = false;
let frames = 0, fps = 0, fpsT = performance.now(), hudT = 0;
function tick(now: number) {
  if (!prefs.hud && !prefs.instant) { ticking = false; hudEl?.remove(); hudEl = null; return; }
  requestAnimationFrame(tick);
  frames++;
  if (now - fpsT >= 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
  const sc = game.scene as unknown as { cam?: { develop?: number; v10?: boolean; hold?: number; holdState?: string }; player?: { x: number; y: number; state?: string }; clock?: { t: number }; site?: { name?: string; id?: string }; tod?: string; constructor: { name: string } } | null;
  if (prefs.instant && sc?.cam) {
    const c = sc.cam;
    if ((c.develop ?? 1) < 1) c.develop = 0.9999;
    if (c.v10 && (c.holdState === 'filling' || c.holdState === 'shaky') && (c.hold ?? 0) < 0.999) c.hold = 0.999;
  }
  if (prefs.hud && now - hudT > 200) {
    hudT = now;
    if (!hudEl || !hudEl.isConnected) { hudEl = el('div', 'dv-hud'); game.ui.root.appendChild(hudEl); }
    const p = sc?.player, q = trackedQuest();
    let step = '';
    if (q) { const i = P.currentStepIndex(q); step = `${q.id} ${i}/${q.steps.length}`; }
    let extra = '';
    try {
      const day = game.save.day ?? 1;
      const ph = (game.save as unknown as { v10?: { day?: { phase?: string } } }).v10?.day?.phase ?? '-';
      extra = `Day ${day} ${ph}`;
    } catch { /* */ }
    const name = sc?.site?.name ?? sc?.constructor?.name ?? '-';
    hudEl.innerHTML = `<b>${fps.toFixed(0)} fps</b>  ${esc(String(name))}${sc?.tod ? ' · ' + sc.tod : ''}${sc?.clock ? ' · clock ' + sc.clock.t.toFixed(2) : ''}\n`
      + `${p ? `x ${Math.round(p.x)} y ${Math.round(p.y)} ${p.state ?? ''}` : 'no player'} · ${extra}${step ? ' · ' + esc(step) : ''}`
      + `${prefs.noclip ? ' · NOCLIP' : ''}${prefs.fast > 1 ? ` · ${prefs.fast}x` : ''}${prefs.instant ? ' · INSTANT' : ''}`;
  }
}
/** apply the toggles (also on boot when one was left on) */
export function applyToggles() {
  if (prefs.noclip || prefs.fast > 1) void patchPlayer();
  if ((prefs.hud || prefs.instant) && !ticking) { ticking = true; requestAnimationFrame(tick); }
  if (!prefs.hud && hudEl) { hudEl.remove(); hudEl = null; }
}
/** main.ts calls this at boot when a toggle is stored as on */
export const togglesStored = () => prefs.noclip || prefs.fast > 1 || prefs.hud || prefs.instant;
