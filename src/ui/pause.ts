// Pause menu (Esc): a spiral notepad page with the options written on it in pencil; hovering one
// underlines it in red ink. The field journal and the encyclopedia are real books from here.

import { game } from '../game/game';
import { el } from './ui';
import { audio } from '../core/audio';
import { openSettings } from '../game/scenes/title';
import { installPaper, paperTex, edgeClip, svgInk, underline, doodle, escHtml as esc, INK_RED, paperSfx } from './v11/paper';

const CSS = `
.pz-pause { position: relative; width: min(23em, 90vw); padding: 2.2em 1.6em 1.4em 2.2em; color: var(--pp-ink); background-size: 256px 256px; box-shadow: none !important;
  filter: drop-shadow(0 0.5em 0.8em rgba(0,0,0,0.55)); transform: rotate(-1.2deg); animation: pzIn 0.35s cubic-bezier(.2,1.3,.4,1) both; }
@keyframes pzIn { from { transform: translateY(40%) rotate(-6deg); opacity: 0; } }
.pz-pause::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 calc(1.9em - 1px), rgba(70, 110, 160, 0.18) calc(1.9em - 1px) 1.9em) 0 1.6em / 100% calc(100% - 1.6em) no-repeat; }
.pz-pause .rings { position: absolute; left: 0; right: 0; top: 0.35em; display: flex; justify-content: space-around; padding: 0 1.2em; }
.pz-pause .rings i { width: 0.9em; height: 1.5em; border-radius: 0.5em; border: 0.18em solid #8a9096; border-bottom-color: transparent; background: none; box-shadow: inset 0 0.1em 0 rgba(255,255,255,0.5); }
.pz-pause h2 { margin: 0.2em 0 0.1em !important; font-size: 1.8em !important; text-align: left; letter-spacing: 0.04em; border: 0 !important; color: #2a2440 !important; text-shadow: none !important; display: block !important; padding: 0 !important; }
.pz-pause .where { font-size: 1.2em; color: var(--pp-pencil); margin-bottom: 0.5em; }
.pz-pause .opt { position: relative; display: flex; align-items: center; gap: 0.6em; width: 100%; padding: 0.12em 0.2em; margin: 0.05em 0; border: 0; background: none; cursor: pointer; text-align: left; color: var(--pp-ink); font-size: 1.55em; line-height: 1.2; }
.pz-pause .opt .d { width: 1.2em; height: 1.2em; flex: none; opacity: 0.8; }
.pz-pause .opt .k { margin-left: auto; font-size: 0.55em; color: var(--pp-pencil); }
.pz-pause .opt .ul { position: absolute; left: 1.6em; right: 18%; bottom: 0.05em; height: 0.35em; opacity: 0; }
.pz-pause .opt:hover .ul, .pz-pause .opt:focus-visible .ul { opacity: 1; }
.pz-pause .opt:focus-visible { outline: none; }
.pz-pause .opt.red { color: #8a2a1a; }
.pz-pause .sep { height: 0.6em; }
`;
let styled = false;

export function openPause(opts: { onReturn?: () => void } = {}) {
  installPaper();
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  audio.play('uiOpen', { vol: 0.4 });
  paperSfx('slide', 0.7);
  game.paused = true;
  const sc = game.scene as unknown as { site?: { name?: string } } | null;
  const where = sc?.site?.name ? `${sc.site.name}, day ${game.save.day ?? 1}` : `Day ${game.save.day ?? 1}`;
  const box = el('div', 'pz-pause', `<div class="rings">${'<i></i>'.repeat(7)}</div><h2 class="pp-head">Paused</h2><div class="where pp-hand">${esc(where)}</div>`);
  box.style.backgroundImage = paperTex('journal');
  box.style.clipPath = edgeClip(5, { top: 'perforated', right: 'deckle', bottom: 'deckle', left: 'deckle', amp: 0.6 });
  const close = game.ui.modal(box, () => { game.paused = false; });
  let n = 0;
  const add = (label: string, d: string, fn: () => void, key = '', cls = '') => {
    const b = el('button', `opt pp-hand ${cls}`, `<span class="d">${doodle(d, { size: '100%', pencil: true, seed: n })}</span><span>${label}</span>${key ? `<span class="k pp-pix">${key}</span>` : ''}<span class="ul">${svgInk(100, 6, [{ d: underline(100, { seed: ++n }), c: INK_RED, w: 1.8 }], { stretch: true, w: '100%', h: '100%' })}</span>`);
    b.onclick = () => { paperSfx('pencil', 0.6); fn(); };
    box.appendChild(b);
    return b;
  };
  add('Back to it', 'footprints', () => close(), 'Esc');
  add('Field journal', 'pin', () => { close(); void import('./v11/journalbook').then(m => m.openJournal()); }, 'J');
  add('Encyclopedia', 'magnifier', () => { close(); void import('./v11/encybook').then(m => m.openEncyclopedia()); }, 'G');
  add('Settings', 'compass', () => openSettings());
  box.appendChild(el('div', 'sep'));
  if (opts.onReturn) add('End the expedition', 'tent', () => { close(); opts.onReturn!(); }, '', 'red');
  add('Save &amp; quit', 'boat', () => {
    close();
    game.persist();
    import('../game/scenes/title').then(m => game.go(() => new m.TitleScene(), undefined, undefined, 'page'));
  }, '', 'red');
  (box.querySelector('.opt') as HTMLButtonElement | null)?.focus();
}
