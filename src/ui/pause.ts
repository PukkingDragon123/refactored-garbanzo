// Pause menu (Esc): a spiral notepad page with the options written on it in pencil; hovering one
// underlines it in red ink. The field journal and the encyclopedia are real books from here.

import { game } from '../game/game';
import { el } from './ui';
import { audio } from '../core/audio';
import { openSettings } from '../game/scenes/title';
import { installPaper, paperTex, edgeClip, svgInk, underline, doodle, escHtml as esc, INK_RED, paperSfx, spriteURL, col } from './v11/paper';

const CSS = `
#ui .pz-pause, #ui .pz-pause * { font-size-adjust: none; }
.pz-pause { position: relative; width: min(460px, 92vw); padding: 44px 32px 28px 44px; color: var(--pp-ink); background-size: 256px 256px; box-shadow: none !important; image-rendering: pixelated;
  filter: drop-shadow(8px 10px 0 rgba(0,0,0,0.5)); animation: pzIn 0.35s steps(6) both; }
@keyframes pzIn { from { transform: translateY(40%); opacity: 0; } }
.pz-pause::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 36px, rgba(70, 110, 160, 0.2) 36px 38px) 0 32px / 100% calc(100% - 32px) no-repeat; }
.pz-pause .rings { position: absolute; left: 0; right: 0; top: 8px; display: flex; justify-content: space-around; padding: 0 24px; }
.pz-pause .rings i { width: 16px; height: 30px; background: var(--pz-ring) center / 100% 100% no-repeat; image-rendering: pixelated; }
#ui .pz-pause h2 { margin: 4px 0 2px !important; font-family: var(--pp-head) !important; font-size: 56px !important; line-height: 56px; text-align: left; letter-spacing: 1px; border: 0 !important; color: #2a2440 !important; text-shadow: none !important; display: block !important; padding: 0 !important; }
.pz-pause .where { font-size: 20px; line-height: 24px; color: var(--pp-pencil); margin-bottom: 10px; }
.pz-pause .opt { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 2px 4px; margin: 0; border: 0; background: none; cursor: pointer; text-align: left; color: var(--pp-ink); font-size: 30px; line-height: 38px; }
.pz-pause .opt .d { width: 30px; height: 30px; flex: none; opacity: 0.85; }
#ui .pz-pause .opt .k { margin-left: auto; font-family: var(--pp-label); font-size: 16px; color: var(--pp-pencil); }
.pz-pause .opt .ul { position: absolute; left: 46px; right: 18%; bottom: 0; height: 8px; opacity: 0; }
.pz-pause .opt:hover .ul, .pz-pause .opt:focus-visible .ul { opacity: 1; }
.pz-pause .opt:hover, .pz-pause .opt:focus-visible { outline: none; transform: translateX(4px); }
.pz-pause .opt.red { color: #8a2a1a; }
.pz-pause .sep { height: 12px; }
`;
let styled = false;

export function openPause(opts: { onReturn?: () => void } = {}) {
  installPaper();
  if (!styled) {
    document.head.appendChild(el('style', '', CSS)); styled = true;
    // a spiral-binding ring: a steel loop half through the page
    document.documentElement.style.setProperty('--pz-ring', `url(${spriteURL('pzRing', 8, 15, a => {
      const s = col('#8a9096'), hi = col('#e8eef2'), dk = col('#3a3e44');
      a.rect(1, 2, 1, 9, s); a.rect(6, 2, 1, 9, s); a.rect(2, 0, 4, 1, s); a.put(1, 1, s); a.put(6, 1, s);
      a.rect(2, 1, 1, 6, hi); a.rect(5, 1, 1, 9, dk);
      a.rect(2, 12, 4, 3, col('#1a1410'));
    }, 2)})`);
  }
  audio.play('uiOpen', { vol: 0.4 });
  paperSfx('slide', 0.7);
  game.paused = true;
  const sc = game.scene as unknown as { site?: { name?: string } } | null;
  const where = sc?.site?.name ? `${sc.site.name}, day ${game.save.day ?? 1}` : `Day ${game.save.day ?? 1}`;
  const box = el('div', 'pz-pause', `<div class="rings">${'<i></i>'.repeat(7)}</div><h2>Paused</h2><div class="where pp-hand">${esc(where)}</div>`);
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
  add('Blueprints', 'compass', () => { close(); void import('./v11/blueprints/folio').then(m => m.openFolio({ at: 'field' })); });
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
