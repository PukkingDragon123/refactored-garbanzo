// Pause (Esc): no menu box. The live scene softens behind (the lens racks out of focus, the colour
// drains, the light drops: src/ui/v12/soften.ts) and the options float over it as words
// (src/ui/v12/floatmenu.ts): Resume, Notebook, Settings, Save & quit to the title (and End the
// expedition on an expedition). Settings open in place, as more floating words.

import { game } from '../game/game';
import { audio } from '../core/audio';
import { FloatMenu } from './v12/floatmenu';
import type { FloatPage } from './v12/floatmenu';
import { settingsPage } from './v12/settingsmenu';
import { softenScene } from './v12/soften';

let menu: FloatMenu | null = null;

/** is the pause menu up */
export const pauseOpen = () => !!menu;

export function openPause(opts: { onReturn?: () => void } = {}) {
  if (menu) return;
  audio.play('uiOpen', { vol: 0.3 });
  audio.play('whoosh', { vol: 0.12, pitch: 0.7 });
  const wasPaused = game.paused;
  game.paused = true;
  softenScene(true);
  const sc = game.scene as unknown as { site?: { name?: string } } | null;
  const day = game.save.day ?? 1;
  const where = sc?.site?.name ? `${sc.site.name}, day ${day}` : `Day ${day}`;

  let done = false;
  const finish = (then?: () => void) => {
    if (done) return;
    done = true;
    const m = menu;
    menu = null;
    softenScene(false);
    game.paused = wasPaused && !then ? wasPaused : false;
    void m?.close();
    then?.();
  };
  const resume = () => finish();

  const main = (): FloatPage => {
    const page: FloatPage = {
      heading: `Paused  ·  ${where}`,
      onBack: resume,
      items: [
        { id: 'resume', label: 'Resume', hint: 'Back to it (Esc).', pick: resume },
        {
          id: 'notebook', label: 'Notebook', hint: 'Quests, the field guide, people and sketches.',
          pick: () => finish(() => { void import('./v12/notebook').then(n => n.openNotebook()); }),
        },
        { id: 'settings', label: 'Settings', pick: () => { audio.play('whoosh', { vol: 0.1, pitch: 1.2 }); menu?.show(settingsPage(() => { game.persist(); menu?.show({ ...main(), focus: 'settings' }); })); } },
      ],
    };
    if (opts.onReturn) {
      const back = opts.onReturn;
      page.items.push({ id: 'end', label: 'End the expedition', tone: 'danger', gap: 3, hint: 'Walk back to camp with what you have.', pick: () => finish(back) });
    }
    page.items.push({
      id: 'quit', label: 'Save & quit', tone: 'danger', gap: opts.onReturn ? 0 : 3, hint: 'Your expedition is saved. Back to the title.',
      pick: () => finish(() => {
        game.persist();
        void import('../game/scenes/title').then(m => game.go(() => new m.TitleScene(), undefined, undefined, 'page'));
      }),
    });
    return page;
  };
  menu = new FloatMenu({ page: main(), modal: true, parent: game.ui.modalLayer, align: 'center' });
}
