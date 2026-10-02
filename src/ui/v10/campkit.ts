// V10 camp screens: a shared panel (the "field kit" look of the HUD), keyboard scope and a few
// widgets (a meter bar, item chips) for the bench, the board, the pack screen and the day cards.

import { game } from '../../game/game';
import { el } from '../ui';
import { css, sfx, pushKeys, esc } from '../laptop-kit';
import { itemIconURL, uiIconURL } from '../../art/itemicons';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';

const CSS = `
.cp-wrap { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(3, 8, 7, 0.55); animation: cpFade 0.18s ease-out; pointer-events: auto; }
@keyframes cpFade { from { opacity: 0; } }
.cp-root { position: relative; width: min(94vw, 58em); max-height: min(92vh, 40em); display: flex; flex-direction: column; padding: 1em 1.2em 1.1em; color: var(--paper); animation: cpPop 0.25s cubic-bezier(.2,1.5,.4,1); }
@keyframes cpPop { from { transform: translateY(14px) scale(0.97); opacity: 0; } }
.cp-head { display: flex; align-items: center; gap: 0.75em; margin-bottom: 0.7em; }
.cp-head img.ic { width: 2.6em; height: 2.6em; image-rendering: pixelated; filter: drop-shadow(0 3px 0 rgba(0,0,0,0.35)); }
.cp-head .t { font-family: var(--pix); font-size: 1.55em; color: var(--amber2); line-height: 1; text-shadow: 0 3px 0 rgba(0,0,0,0.45); }
.cp-head .s { font-family: var(--hand); font-size: 0.95em; opacity: 0.85; margin-top: 0.15em; }
.cp-head .sp { flex: 1; }
.cp-head .rp { font-family: var(--pix); font-size: 1.05em; color: var(--amber2); display: flex; align-items: center; gap: 0.3em; }
.cp-head .rp img { width: 1.2em; height: 1.2em; image-rendering: pixelated; }
.cp-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding-right: 0.2em; }
.cp-foot { display: flex; gap: 0.6em; justify-content: flex-end; align-items: center; margin-top: 0.8em; flex-wrap: wrap; }
.cp-foot .hint { margin-right: auto; font-size: 0.85em; opacity: 0.75; font-family: var(--hand); }
.cp-card { position: relative; background: rgba(4, 12, 10, 0.45); box-shadow: inset 0 0 0 2px rgba(241,232,208,0.12); padding: 0.7em 0.85em; }
.cp-card + .cp-card { margin-top: 0.55em; }
.cp-card.sel { box-shadow: inset 0 0 0 2px var(--amber), 0 0 14px rgba(244,180,60,0.25); }
.cp-card h3 { margin: 0; font-family: var(--pix); font-weight: 600; font-size: 1.15em; color: var(--amber2); }
.cp-card p { margin: 0.3em 0 0; font-size: 0.9em; line-height: 1.4; opacity: 0.92; }
.cp-chip { display: inline-flex; align-items: center; gap: 0.3em; font-family: var(--pix); font-size: 0.85em; padding: 0.12em 0.45em 0.12em 0.2em; margin: 0.25em 0.3em 0 0; background: rgba(241,232,208,0.1); }
.cp-chip img { width: 1.5em; height: 1.5em; image-rendering: pixelated; }
.cp-chip.no { color: #ffb3a4; background: rgba(232,97,74,0.16); }
.cp-chip.ok { color: var(--teal2); }
.cp-tag { display: inline-block; font-family: var(--pix); font-size: 0.72em; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.12em 0.5em; color: #10201c; background: var(--c, var(--teal)); }
.cp-bar { position: relative; height: 0.9em; background: rgba(0,0,0,0.4); box-shadow: inset 0 0 0 1px rgba(241,232,208,0.18); overflow: hidden; }
.cp-bar i { position: absolute; left: 0; top: 0; bottom: 0; width: var(--v, 0%); background: var(--c, var(--teal)); box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2); transition: width 0.4s; }
.cp-bar i.over { background: var(--coral); }
.cp-bar b { position: absolute; left: var(--m, 100%); top: -2px; bottom: -2px; width: 2px; background: var(--amber2); }
.cp-pips { display: inline-flex; gap: 3px; vertical-align: middle; }
.cp-pips i { width: 0.6em; height: 0.6em; background: rgba(0,0,0,0.45); box-shadow: inset 0 0 0 1px rgba(241,232,208,0.25); }
.cp-pips i.on { background: var(--teal); box-shadow: none; }
.cp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8em; }
@media (max-width: 640px) { .cp-grid2 { grid-template-columns: 1fr; } .cp-root { padding: 0.8em; } }
.cp-col h4 { margin: 0 0 0.45em; font-family: var(--pix); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.85em; color: var(--teal2); display: flex; align-items: center; gap: 0.4em; }
.cp-col h4 img { width: 1.6em; height: 1.6em; image-rendering: pixelated; border-radius: 2px; }
.cp-empty { opacity: 0.7; font-family: var(--hand); font-size: 0.95em; padding: 0.4em 0.2em; }
`;

export interface CampPanel {
  root: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement;
  close(): void;
  /** resolves when the panel is closed */
  closed: Promise<void>;
  /** keys while open (return true to consume) */
  onKey(fn: (e: KeyboardEvent) => boolean | void): void;
}

/** a camp screen: header (icon, title, subtitle, RP), scrolling body, footer with a close button */
export function campPanel(o: { title: string; sub?: string; icon?: string; iconURL?: string; rp?: boolean; closeLabel?: string; width?: string }): CampPanel {
  css('v10camp', CSS);
  const wrap = el('div', 'cp-wrap interactive');
  const root = wrap.appendChild(el('div', 'cp-root panel k-ui'));
  if (o.width) root.style.width = o.width;
  const ic = o.iconURL ?? (o.icon ? uiIconURL(o.icon, 4) : '');
  root.innerHTML = `<div class="cp-head">${ic ? `<img class="ic" src="${ic}" alt="">` : ''}<div><div class="t">${esc(o.title)}</div>${o.sub ? `<div class="s">${esc(o.sub)}</div>` : ''}</div><div class="sp"></div>${o.rp ? `<div class="rp"><img src="${uiIconURL('rp', 2)}" alt="RP"><span class="rpn">${game.save.rp}</span> RP</div>` : ''}</div><div class="cp-body"></div><div class="cp-foot"><button class="btn ghost x">${esc(o.closeLabel ?? 'Close')} <span class="key">Esc</span></button></div>`;
  const body = root.querySelector('.cp-body') as HTMLElement;
  const foot = root.querySelector('.cp-foot') as HTMLElement;
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  let res: () => void = () => {};
  const closed = new Promise<void>(r => (res = r));
  let keyFn: ((e: KeyboardEvent) => boolean | void) | null = null;
  let done = false;
  const pop = pushKeys(e => {
    if (e.code === 'Escape' || e.code === 'Tab') { close(); return true; }
    if (keyFn && keyFn(e)) return true;
    return false;
  });
  function close() {
    if (done) return;
    done = true;
    sfx('uiBack');
    pop();
    wrap.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    res();
  }
  (root.querySelector('.x') as HTMLElement).onclick = () => close();
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  sfx('uiOpen');
  return { root, body, foot, close, closed, onKey: fn => { keyFn = fn; } };
}

/** refresh the RP readout in a panel's header */
export function refreshRp(p: CampPanel) {
  const n = p.root.querySelector('.rpn');
  if (n) n.textContent = String(game.save.rp);
}

/** "3/4 Sea glass" chips for a cost list */
export function itemChips(items: [string, number][]): string {
  return items.map(([id, n]) => {
    const have = count(id);
    return `<span class="cp-chip ${have >= n ? 'ok' : 'no'}" title="${esc(ITEMS[id]?.name ?? id)}"><img src="${itemIconURL(id, 2)}" alt="">${Math.min(have, 99)}/${n} ${esc(ITEMS[id]?.name ?? id)}</span>`;
  }).join('');
}

export const pips = (n: number, max: number) => `<span class="cp-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
export { esc };
