// Pause menu (Esc).

import { game } from '../game/game';
import { el } from './ui';
import { audio } from '../core/audio';
import { openJournal } from './journal';
import { openSettings } from '../game/scenes/title';

export function openPause(opts: { onReturn?: () => void } = {}) {
  audio.play('uiOpen');
  game.paused = true;
  const box = el('div', 'panel settings', '<h2>Paused</h2>');
  const close = game.ui.modal(box, () => { game.paused = false; });
  const add = (label: string, fn: () => void, cls = 'btn ghost') => {
    const b = el('button', cls, label);
    b.onclick = () => { audio.play('ui'); fn(); };
    box.appendChild(b);
  };
  add('Resume', () => close(), 'btn');
  add('Field Guide', () => { close(); openJournal(); });
  add('Settings', () => openSettings());
  if (opts.onReturn) add('End expedition and review photos', () => { close(); opts.onReturn!(); });
  add('Save and quit to title', () => {
    close();
    game.persist();
    import('../game/scenes/title').then(m => game.go(() => new m.TitleScene()));
  });
}
