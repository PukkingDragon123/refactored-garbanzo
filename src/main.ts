import './styles.css';
import { game } from './game/game';
import { bakeAssets } from './game/assets';
import { bindAllArt } from './game/bindart';
import { loadSave, newSave } from './game/save';
import { audio } from './core/audio';
import { el } from './ui/ui';
import { setupTouch } from './ui/touch';
import type { SiteId } from './game/species';
import type { TimeOfDay } from './world/timeofday';

const params = new URLSearchParams(location.search);

async function boot() {
  const gq = params.get('gallery');
  if (gq) {
    const m = await import('./debug/galleries');
    m.runGallery(gq);
    return;
  }
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  try {
    game.init(canvas, ui);
  } catch (e) {
    ui.innerHTML = `<div class="loading"><div class="logo">Project Zealandia</div><div class="lbl">This game needs WebGL2, which this browser could not start. Try a recent Chrome, Edge, Firefox or Safari.</div></div>`;
    console.error(e);
    return;
  }
  const load = el('div', 'loading', `<div class="logo">PROJECT ZEALANDIA</div><div class="bar"><div></div></div><div class="lbl">Loading</div>`);
  ui.appendChild(load);
  const bar = load.querySelector('.bar div') as HTMLElement, lbl = load.querySelector('.lbl') as HTMLElement;
  await bakeAssets(game.r, (k, label) => { bar.style.width = k * 100 + '%'; lbl.textContent = label; });
  bindAllArt();
  game.save = loadSave() ?? newSave();
  audio.masterVolume = 0.8;
  audio.musicVolume = game.save.settings.music;
  audio.sfxVolume = game.save.settings.sfx;
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  setupTouch();
  game.r.post.fade = 1;
  game.fadeTo(1);
  game.start();
  const scene = params.get('scene');
  const flow = await import('./game/scenes/flow');
  if (params.has('flags')) for (const f of params.get('flags')!.split(',')) game.save.flags[f] = true;
  if (params.has('tod')) game.save.campTime = params.get('tod') as TimeOfDay;
  if (scene === 'site') await flow.goField((params.get('site') ?? 'fernwood') as SiteId, (params.get('tod') ?? 'day') as TimeOfDay);
  else if (scene === 'camp') await flow.goCamp();
  else if (scene === 'tent') await flow.goTent();
  else if (scene === 'boat') await flow.goPrologue();
  else {
    const { TitleScene } = await import('./game/scenes/title');
    await game.setNow(new TitleScene());
  }
  load.style.opacity = '0';
  setTimeout(() => load.remove(), 700);
  game.fadeTo(0, 1.2);
  (window as unknown as { game: typeof game }).game = game;
}

boot();
