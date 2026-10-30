// V12 settings and credits as floating words (src/ui/v12/floatmenu.ts): the volumes, the graphics
// quality and lens options, fullscreen and the developer tools. The title shows these pages in its
// own scene (the camera drops to the deck), the pause menu over the softened game; openSettings()
// shows them anywhere else.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { GFX_HINT, GFX_LABEL, applyGfxPrefs, loadGfxPrefs, saveGfxPrefs } from '../../gfx/quality';
import type { GfxLevel } from '../../gfx/renderer';
import { FloatMenu, textLines } from './floatmenu';
import type { FloatPage, FMItem } from './floatmenu';
import { softenScene } from './soften';

const LEVELS: GfxLevel[] = ['low', 'medium', 'high'];
const RES_MIN = 0.35, RES_STEPS = 13;

/** open the developer panel (Settings > Developer tools, or the backquote key) */
export function openDevTools() {
  void import('../../debug/devpanel').then(m => m.openDevPanel());
}

export function settingsPage(onBack: () => void, o: { heading?: string } = {}): FloatPage {
  const s = game.save.settings;
  const gp = loadGfxPrefs();
  const apply = () => { saveGfxPrefs(gp); applyGfxPrefs(game.r, gp); };
  const items: FMItem[] = [
    { id: 'music', label: 'Music', kind: 'slider', get: () => s.music, set: v => { s.music = Number(v); audio.musicVolume = s.music; } },
    { id: 'sound', label: 'Sound', kind: 'slider', get: () => s.sfx, set: v => { s.sfx = Number(v); audio.sfxVolume = s.sfx; } },
    {
      id: 'gfx', label: 'Graphics', kind: 'choice', choices: LEVELS.map(l => GFX_LABEL[l]),
      get: () => LEVELS.indexOf(gp.level), set: v => { gp.level = LEVELS[Number(v)] ?? 'high'; apply(); },
      hint: () => GFX_HINT[gp.level],
    },
    {
      id: 'res', label: 'Resolution', kind: 'slider', steps: RES_STEPS,
      get: () => Math.max(0, Math.min(1, (s.quality - RES_MIN) / (1 - RES_MIN))),
      set: v => { s.quality = Math.round((RES_MIN + Number(v) * (1 - RES_MIN)) * 100) / 100; game.r.quality = s.quality; window.dispatchEvent(new Event('resize')); },
      fmt: v => Math.round((RES_MIN + Number(v) * (1 - RES_MIN)) * 100) + '%',
      hint: 'How many pixels the world is drawn with. Lower it if the game stutters.',
    },
    { id: 'grain', label: 'Film grain', kind: 'toggle', get: () => gp.grain, set: v => { gp.grain = !!v; apply(); } },
    { id: 'vignette', label: 'Vignette', kind: 'toggle', get: () => gp.vignette, set: v => { gp.vignette = !!v; apply(); } },
  ];
  if (document.fullscreenEnabled) {
    items.push({
      id: 'fullscreen', label: 'Fullscreen', kind: 'toggle', get: () => !!document.fullscreenElement,
      set: v => { (v ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.())?.catch(() => undefined); },
    });
  }
  items.push(
    { id: 'dev', label: 'Developer tools', tone: 'quiet', gap: 3, hint: 'A test tool: jump to any scene, skip quests, cheats, saves. Not part of the game. (` key)', pick: openDevTools },
    { id: 'back', label: 'Back', gap: 2, pick: onBack },
  );
  return { items, heading: o.heading ?? 'Settings', onBack };
}

export function creditsPage(onBack: () => void): FloatPage {
  return {
    heading: 'Project Zealandia',
    onBack,
    focus: 'back',
    items: [
      ...textLines([
        'A pixel-art wildlife photography and research game.',
        'Every sprite, landscape, creature and sound is made in code:',
        'procedural pixel art, a WebGL2 lighting renderer and',
        'synthesised audio.',
        ' ',
        'Inspired by the cosy exploration of Dave the Diver and',
        'the real sunken continent of Zealandia. The animals are',
        'fictional: a world where serpents, not birds, took over.',
      ]),
      { id: 'back', label: 'Back', gap: 4, pick: onBack },
    ],
  };
}

let open: FloatMenu | null = null;
/** settings over whatever is on screen (the scene softens behind them) */
export function openSettings(onClose?: () => void) {
  if (open) return;
  softenScene(true);
  audio.play('uiOpen', { vol: 0.3 });
  const close = () => {
    if (!open) return;
    const m = open;
    open = null;
    game.persist();
    softenScene(false);
    void m.close();
    onClose?.();
  };
  open = new FloatMenu({ page: settingsPage(close), modal: true, parent: game.ui.modalLayer, align: 'center' });
}
