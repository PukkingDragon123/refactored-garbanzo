import './styles.css';
import { game } from './game/game';
import { bakeAssets } from './game/assets';
import { bindAllArt } from './game/bindart';
import { installSkin } from './ui/skin';
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
  installSkin();
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
  if (params.has('builds')) for (const kv of params.get('builds')!.split(',')) { const [k, v] = kv.split(':'); game.save.builds[k] = +v; }
  if (params.has('tod')) game.save.campTime = params.get('tod') as TimeOfDay;
  if (scene === 'site') await flow.goField((params.get('site') ?? 'fernwood') as SiteId, (params.get('tod') ?? 'day') as TimeOfDay);
  else if (scene === 'camp') await flow.goCamp();
  else if (scene === 'tent') await flow.goTent();
  else if (scene === 'boat') await flow.goPrologue();
  else if (scene === 'ship4') await flow.goShip4();
  else if (scene === 'wake4') await flow.goBeachWake();
  else if (scene === 'island4') await (await import('./game/v4/islandflow')).goIsland();
  else {
    const { TitleScene } = await import('./game/scenes/title');
    await game.setNow(new TitleScene());
  }
  load.style.opacity = '0';
  setTimeout(() => load.remove(), 700);
  game.fadeTo(0, 1.2);
  (window as unknown as { game: typeof game }).game = game;
  // debug helpers for testing UIs from the console
  (window as unknown as { zl: unknown }).zl = {
    laptop: async (app?: string) => (await import('./ui/laptop')).openLaptop({ app: app as never }),
    review: async () => (await import('./ui/photoreview')).openPhotoRoll(),
    pack: async () => (await import('./ui/backpack')).openBackpack({}),
    craft: async (st = 'bench') => (await import('./ui/craft')).openCrafting(st as never),
    map: async () => (await import('./game/travel2')).openTravelMap(),
    quest: async (id: string) => (await import('./game/quests')).startQuest(id),
    flag: (k: string, v = true) => { game.save.flags[k] = v; },
    moriOS: async (report = true) => (await import('./ui/v4/moriOS')).openMoriOS({ report }),
    noodles: async () => (await import('./ui/v4/noodles')).runNoodleGame(),
    standoff: async () => { const a = await import('./game/v4/islearoha'); return (await import('./ui/v6/standoff')).runNegotiation(a.ROUNDS, a.EXTRA); },
    ramen: async () => (await import('./ui/v6/ramen')).runRamenPour(),
    engine: async () => (await import('./ui/v6/engine')).runEngineRepair({}),
    /** stand Mori at the stern (ship scene) and go fishing; resolves with the catch or null */
    fish: async () => {
      const s = game.scene as unknown as { player: { x: number; y: number; facing: number }; snapCamera?(): void; cutscene: boolean };
      const { SPOTS } = await import('./art/ship5');
      s.player.x = SPOTS.fishing[0] + 8; s.player.y = SPOTS.fishing[1]; s.player.facing = -1;
      s.snapCamera?.();
      s.cutscene = true;
      const c = await (await import('./ui/v4/fishing')).goFishing(s as never);
      s.cutscene = false;
      (window as unknown as { __fish?: unknown }).__fish = c ? { fish: c.fish.id, len: c.len, stars: c.stars } : null;
      return c;
    },
    /** just the underwater fight close-up, for one fish id (hold Space to reel) */
    fishFight: async (id = 'snapper', dep0?: number) => {
      const { FISH } = await import('./ui/v4/fishing');
      const { runFishFight } = await import('./ui/v6/fishfight');
      const { Hold } = await import('./ui/v4/mini');
      const hold = new Hold(document.body);
      const f = FISH.find(x => x.id === id) ?? FISH[0];
      const r = await runFishFight(f, hold, { cancelled: () => false, caughtSub: `${f.name} · 42 cm`, dep0 });
      hold.dispose();
      (window as unknown as { __fish?: unknown }).__fish = r;
      return r;
    },
    steady: async () => (await import('./ui/v6/camp')).holdSteady('Hold the tent pole steady', 'Press <span class="key">Space</span> as the pole comes upright. Three pegs!'),
    knot: async () => (await import('./ui/v6/camp')).lashingKnot(),
    /** the rogue-wave finale on the ship (skips the storm search) */
    wave: async () => (await import('./game/v4/storm')).rogueWave(game.scene as never),
  };
}

boot();
