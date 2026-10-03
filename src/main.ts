import './styles.css';
import { game } from './game/game';
import { bakeAssets } from './game/assets';
import { bindAllArt } from './game/bindart';
import { installSkin } from './ui/skin';
import { installPaper } from './ui/v11/paper/css';
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
  installPaper();
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
  // the render resolution picked in Settings; ?gfx=low|medium|high tries a graphics preset (not kept)
  const res = game.save.settings.quality;
  if (res > 0 && res < 1) { game.r.quality = Math.max(0.35, res); window.dispatchEvent(new Event('resize')); }
  const gfx = params.get('gfx');
  if (gfx === 'low' || gfx === 'medium' || gfx === 'high') game.r.setGfx(gfx);
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
  // developer panel: a "clean reload" jump to a story point (Settings > Developer tools)
  else if (params.has('devjump')) await (await import('./debug/devpanel')).bootJump(params.get('devjump')!);
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
    moriOS: async (report = true, field = false) => (await import('./ui/v4/moriOS')).openMoriOS({ report, field }),
    /** the salvaged laptop on the island (needs flag v9:laptop for the HUD button / L key) */
    fieldLaptop: async () => (await import('./game/v9/research9')).openFieldLaptop(game.scene as never),
    noodles: async () => (await import('./ui/v4/noodles')).runNoodleGame(),
    /** the Aroha standoff: on the beach where Mori stands (island scene), else the old full-screen close-up */
    standoff: async () => {
      const a = await import('./game/v4/islearoha');
      const st = (game.scene as unknown as { story?: { s?: { aroha?: unknown } } } | null)?.story;
      if (st?.s?.aroha) return a.standoffOnly(st as never);
      return (await import('./ui/v6/standoff')).runNegotiation(a.ROUNDS, a.EXTRA);
    },
    ramen: async () => (await import('./ui/v6/ramen')).runRamenPour(),
    engine: async () => (await import('./ui/v6/engine')).runEngineRepair({}),
    /** the outboard repair close-up on the beach (window.__outboard.go('plug' | 'prime' | 'start') jumps a job) */
    outboard: async () => (await import('./game/v10/boatfix')).runOutboardRepair(),
    /** the 3D hands module (HANDS3D.enabled = false brings back the pixel hands; ?gallery=hands3d to look at them) */
    hands3d: async () => import('./art/v11/hands3d'),
    /** stand Mori at the stern (ship scene) and go fishing; resolves with the catch or null (window.__fish) */
    fish: async (opts: { fish?: string; skipTo?: 'fight' } = {}) => {
      const s = game.scene as unknown as { player: { x: number; y: number; facing: number }; snapCamera?(): void; cutscene: boolean };
      const { SPOTS } = await import('./art/ship5');
      s.player.x = SPOTS.fishing[0] + 8; s.player.y = SPOTS.fishing[1]; s.player.facing = -1;
      s.snapCamera?.();
      s.cutscene = true;
      const c = await (await import('./ui/v4/fishing')).goFishing(s as never, opts);
      s.cutscene = false;
      (window as unknown as { __fish?: unknown }).__fish = c ? { fish: c.fish.id, len: c.len, stars: c.stars, parasite: c.parasite ?? null } : null;
      return c;
    },
    /** check the catch hold: Mori holds a fish up in one hand (mode 'overhead' = raised, 'chest' = shoulder height; null to put it down) */
    hold: async (id: string | null = 'snoutbass', len = 47, mode: 'chest' | 'overhead' = 'chest', louse = false, atStern = false) => {
      const s = game.scene as unknown as { player: { x: number; y: number; poseOverride: string | null }; setHeld?(spr: unknown, mode?: string): void; snapCamera?(): void };
      const { FISH_BY_ID, holdSprite } = await import('./ui/v4/fishing');
      if (atStern) { const { SPOTS } = await import('./art/ship5'); s.player.x = SPOTS.fishing[0] + 8; s.player.y = SPOTS.fishing[1]; s.snapCamera?.(); }
      if (!id || !FISH_BY_ID[id]) { s.setHeld?.(null); s.player.poseOverride = null; return; }
      s.player.poseOverride = mode === 'overhead' ? 'fishRaise' : 'fishHold';
      s.setHeld?.(holdSprite(FISH_BY_ID[id], len, louse), mode);
    },
    /** skip the cast: a fish of this species is already on the line, straight into the fight in the wide view */
    fishFight: async (id = 'snoutbass') => (window as unknown as { zl: { fish(o: object): Promise<unknown> } }).zl.fish({ fish: id, skipTo: 'fight' }),
    steady: async () => (await import('./ui/v6/camp')).holdSteady('Hold the tent pole steady', 'Press <span class="key">Space</span> as the pole comes upright. Three pegs!'),
    knot: async () => (await import('./ui/v6/camp')).lashingKnot(),
    /** the rogue-wave finale on the ship (skips the storm search) */
    wave: async () => (await import('./game/v4/storm')).rogueWave(game.scene as never),
    /**
     * dress the cast: zl.outfit('mori', 'winter'), zl.outfit('all', 'storm'), zl.outfit('jenna') to undress;
     * outfits: casual, winter, winterHood, storm. Returns who wears what.
     */
    outfit: async (who = 'all', name = 'casual') => {
      const w = await import('./art/v7/wardrobe');
      for (const id of who === 'all' ? ['mori', 'jenna', 'joshu', 'aroha'] : [who]) w.setOutfit(id, name);
      return Object.fromEntries(['mori', 'jenna', 'joshu', 'aroha'].map(id => [id, w.outfitOf(id)]));
    },
    /** the HD close-up bust of anyone, for checking (zl.closeup('mori', 'shocked')) */
    closeup: async (who = 'mori', expr = 'neutral', ms = 4000) => {
      const ui = game.ui as unknown as { bubbles?: { cu?: { show(id: string, e: string, o: { name: string; talking: () => boolean }): void; hide(): void } } };
      const cu = ui.bubbles?.cu;
      if (!cu) return 'no closeups';
      cu.show(who, expr, { name: who, talking: () => true });
      setTimeout(() => cu.hide(), ms);
      return 'ok';
    },
    /** V9: the Trycop close-up (the parasitised crab when the island is loaded) */
    trycop: async () => { const w = await import('./game/v9/wildlife'); return (await import('./ui/v9/trycop')).examineTrycop(game.scene as never, w.W9.crabs.find(c => c.spec.parasite) ?? null); },
    /** V9: a jewel hornet ambush at the nearest nest bush (or where Mori stands); resolves 'escaped' | 'stung' */
    ambush: async () => (await import('./game/v9/hornets')).debugAmbush(game.scene as never),
    /** ship scene: switch to the afternoon on deck and spawn the open-ocean wildlife */
    deck: async () => {
      const s = game.scene as unknown as { phase: string };
      s.phase = 'deck';
      return (await import('./game/v4/seafauna')).startDeckLife(game.scene as never);
    },
    /** island story helpers (state, interactables, markers, teleport): see src/game/v9/islezl.ts */
    isle: null as unknown,
    /** V11 carrying (src/game/v11/carry.ts): zl.carry('water'), zl.carry('planks', 'joshu', { count: 2 }), zl.carry(null) */
    carry: async (kind: string | null = 'water', who = 'player', o: Record<string, unknown> = {}) => {
      const { setCarry } = await import('./game/v11/carry');
      const s = game.scene as unknown as { player?: { body: unknown }; actor?(id: string): unknown };
      const a = who === 'player' ? s.player?.body : s.actor?.(who);
      if (!a) return 'no actor';
      setCarry(a as never, kind, o);
      return kind;
    },
    /** the cinematic camera and post FX (cineTo, cinePunch, cineLook...): (await zl.cine()).cinePunch() */
    cine: () => import('./game/v11/cine'),
    /** V11 physical UI kit sampler book (see src/ui/v11/paper/index.ts) */
    paper: async () => (await import('./ui/v11/paper/demo')).paperDemo(),
    /** V11 the Zealandia Encyclopedia book (optionally at an entry: 'sp:glasscrab', 'cat:flora') */
    ency: async (key?: string) => (await import('./ui/v11/encybook')).openEncyclopedia({ key }),
    /** V11 Mori's field journal (quests), the camp board */
    journal: async (id?: string) => (await import('./ui/v11/journalbook')).openJournal({ quest: id }),
    board: async () => (await import('./ui/v10/campboard')).openBoard(),
    /** dev: document the first n species (stand-in photos) so the encyclopedia has pages */
    devDoc: async (n = 8) => {
      const d = await import('./debug/devpoints');
      const { SPECIES } = await import('./game/species');
      for (const sp of SPECIES.slice(0, n)) d.documentSpecies(sp.id, Object.keys(sp.behaviors).slice(0, 2));
      game.persist();
      return n;
    },
  };
  void import('./game/v9/islezl').then(m => { (window as unknown as { zl: { isle: unknown } }).zl.isle = m.ISLE; });
  // Mori's 3D hands for the cooking minigame register with it (if it's in the build)
  void import('./art/v11/hands3d/cookhands');
  // build Mori's 3D hands in the background (a worker) so the first close-up has them ready
  setTimeout(() => { void import('./art/v11/hands3d').then(m => m.prewarmHands3d('mori')); }, 3000);
  // developer panel toggles left on (noclip, overlay...): only then is the dev module loaded
  try {
    if (/"(noclip|hud|instant)":true|"fast":[2-9]/.test(localStorage.getItem('zl-dev-prefs') ?? '')) void import('./debug/devpanel').then(m => m.applyToggles());
  } catch { /* storage blocked */ }
  (window as unknown as { zl: Record<string, unknown> }).zl.dev = async () => (await import('./debug/devpanel')).openDevPanel();
}

boot();
