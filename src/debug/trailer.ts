// ?trailer=1: a hands-off cinematic tour of the island for the user to screen-record as promotional
// footage (user: "promotional content ... beautiful, no text, just gameplay"). Every piece of UI and
// text is hidden; each shot jumps to a dev point, hides or drives Mori, and moves the camera; the
// shots are cut with blackouts over two CC0 tracks (src/assets/trailer/CREDITS.md).
//   ?trailer=1           the whole trailer (about 90 s); one click starts it (browsers need a gesture
//                        before audio plays); nothing on screen but the game
//   &shot=N              just shot N (1-based), held, for previewing
//   &loop=1              start again at the end
//   &nomusic=1           the game's own ambience only

import { game } from '../game/game';
import { audio } from '../core/audio';
import { cineTo, cineBars, cineBlackout, cineRelease, cineFocusOn, cineShake, cineSlowmo } from '../game/v11/cine';
import { bootJump, closeAll } from './devpanel';
import townTheme from '../assets/trailer/town-theme.mp3';
import nextToYou from '../assets/trailer/next-to-you.mp3';

interface Mover { x: number; y: number; vx?: number; alpha?: number; underwater?: boolean; facing?: number }
interface Sc {
  st: Parameters<typeof cineTo>[0];
  player?: Mover;
  animals?: { species: string; x: number; y: number; gone?: boolean; dead?: boolean }[];
  hud?: { show(on: boolean): void } | null;
  cutscene?: boolean;
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const sc = () => game.scene as unknown as Sc | null;
const KEYS = ['KeyD', 'ArrowRight', 'KeyA', 'ArrowLeft', 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'ShiftLeft'];
const letGo = () => { for (const k of KEYS) game.input.release(k); };

// ---------------------------------------------------------------- hiding everything
const CSS = `
body.trailer #ui > *:not(.letterbox) { visibility: hidden !important; }
body.trailer .v12-float, body.trailer .h2, body.trailer .dv-panel { display: none !important; }
body.trailer, body.trailer canvas { cursor: none !important; }
`;
function hideAll() {
  const s = sc();
  s?.hud?.show(false);
  game.ui.bubbles.clear();
  if (game.ui.dialogueOpen) { game.ui.dialogueOpen = false; game.ui.dlg.classList.remove('on'); }
}

// ---------------------------------------------------------------- music
const tracks: Record<string, HTMLAudioElement> = {};
function track(id: 'town' | 'next'): HTMLAudioElement {
  return tracks[id] ??= Object.assign(new Audio(id === 'town' ? townTheme : nextToYou), { preload: 'auto', volume: 0 });
}
let playing: HTMLAudioElement | null = null;
function fadeVol(a: HTMLAudioElement, to: number, secs: number) {
  const from = a.volume, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step); else if (to === 0) a.pause();
  };
  requestAnimationFrame(step);
}
function music(id: 'town' | 'next', at = 0, secs = 2) {
  if (NOMUSIC) return;
  const a = track(id);
  if (playing === a) return;
  if (playing) fadeVol(playing, 0, secs);
  a.currentTime = at;
  void a.play().catch(() => {});
  fadeVol(a, 0.85, secs);
  playing = a;
}

// ---------------------------------------------------------------- camera helpers (relative to Mori at the start of a shot)
let ox = 0, oy = 0;
function anchor() { const p = sc()?.player; ox = p?.x ?? 0; oy = p?.y ?? 0; }
async function at(dx: number, dy: number, zoom: number) {
  const s = sc(); if (!s) return;
  await cineTo(s.st, { x: ox + dx, y: oy + dy, zoom, secs: 0.01, ease: 'linear', focus: null });
}
async function pan(dx: number, dy: number, zoom: number, secs: number, ease: 'linear' | 'smooth' = 'linear') {
  const s = sc(); if (!s) return;
  await cineTo(s.st, { x: ox + dx, y: oy + dy, zoom, secs, ease, focus: null, sway: 0.15 });
}
function hideMori(on = true) { const p = sc()?.player; if (p) p.alpha = on ? 0 : 1; }
/** hold a direction for a while (Mori walks or swims it) */
async function drive(keys: string[], secs: number) {
  for (const k of keys) game.input.press(k);
  await sleep(secs * 1000);
  for (const k of keys) game.input.release(k);
}
const near = (species: string) => {
  const s = sc(), p = s?.player;
  return s?.animals?.filter(a => a.species === species && !a.gone && !a.dead).sort((a, b) => Math.abs(a.x - (p?.x ?? 0)) - Math.abs(b.x - (p?.x ?? 0)))[0] ?? null;
};

/** the nearest of a species, waiting up to 5 s for it to spawn */
async function waitFor(species: string) {
  for (let i = 0; i < 25; i++) { const a = near(species); if (a) return a; await sleep(200); }
  console.warn('[trailer] no', species);
  return null;
}

// ---------------------------------------------------------------- the shots
interface Shot { jump: string; music?: ['town' | 'next', number]; run(): Promise<void> }
const SHOTS: Shot[] = [
  // the palm beach, the surf, the morning
  { jump: 'isle:jenna', music: ['town', 0], run: async () => { hideMori(); await at(-260, -60, 1.25); await pan(260, -70, 1.3, 7.5); } },
  // into the great forest: up the giant trunks
  { jump: 'forest:in', run: async () => { hideMori(); await at(60, -20, 1.3); await pan(260, -24, 1.32, 6.5); } },
  // the fallen kauri lookout: Mori walks along under the canopy
  { jump: 'forest:lookout', run: async () => { await at(40, -50, 1.5); void drive(['KeyD'], 3.2); await pan(140, -60, 1.45, 6); } },
  // the village on festival night
  { jump: 'v:festival', run: async () => { hideMori(); await at(-300, -60, 1.2); await pan(300, -60, 1.25, 7); } },
  // the backcountry's burnt ridge: the long view
  { jump: 'tu:burnt', run: async () => { hideMori(); await at(-200, -90, 1.0); await pan(260, -110, 1.05, 6.5); } },
  // the glow forest at night: a slow push in
  { jump: 'arc:ch3', run: async () => { hideMori(); await at(330, -60, 1.15); await pan(420, -50, 1.5, 6.5, 'smooth'); } },
  // the cave: Mori walks deeper with his lantern
  { jump: 'dc:gallery', run: async () => { await at(60, -50, 1.35); void drive(['KeyD'], 2.6); await pan(170, -60, 1.45, 6); } },
  // the kelp forest: Mori swims through, the kelp parting round him
  { jump: 'dive:kelp', music: ['next', 0], run: async () => { await at(120, -10, 1.35); void drive(['KeyD'], 5.5); await pan(380, -20, 1.3, 7); } },
  // the reef: kingfish and the eagle ray
  { jump: 'dive:reef', run: async () => { await at(0, 0, 1.2); void drive(['KeyD', 'KeyS'], 2); await pan(260, 30, 1.25, 6.5); } },
  // the drop-off: a shark comes to look at him
  { jump: 'dive:dropoff', run: async () => {
    const m = await import('../game/v12/dive/species');
    const s = sc(), p = s?.player, sh = await waitFor('glasseye');
    if (sh && p) { sh.x = p.x + 280; sh.y = p.y - 20; }
    if (s) m.provokeShark(s as never);
    await at(80, 0, 1.15); await pan(120, 10, 1.25, 6.5, 'smooth');
  } },
  // the blue: the Finned Leviathan
  { jump: 'dive:blue', run: async () => {
    const lev = await waitFor('leviathan');
    const p = sc()?.player;
    if (lev && p) { p.x = lev.x - 260; p.y = lev.y + 30; }
    anchor();
    await at(60, 0, 1.0);
    if (lev) { cineSlowmo(0.6, 0.6); await cineFocusOn(lev as never, { zoom: 1.15, secs: 4.5, track: true, dof: 1.2 }); await sleep(2500); cineSlowmo(1, 0.6); }
    else await pan(200, 0, 1.1, 6);
  } },
  // the Thunderbird on the bait
  { jump: 'tb:hunt~1', run: async () => {
    hideMori();
    const s = sc(); const tb = s?.animals?.find(a => /thunder/.test(a.species)) ?? null;
    await at(-60, -80, 1.0);
    if (tb) await cineFocusOn(tb as never, { zoom: 1.3, secs: 5, track: true, dof: 1.3 }); else await pan(120, -120, 1.2, 6);
    await sleep(1500);
  } },
  // the Bearer up close
  { jump: 'feud:bearer', run: async () => {
    const b = near('bearer');
    await at(0, -60, 1.0);
    if (b) { await cineFocusOn(b as never, { zoom: 1.35, secs: 4, track: true, dof: 1.4 }); cineShake(4, 0.6); await sleep(2200); }
    else await pan(200, -60, 1.3, 6);
  } },
  // home: the fire at night, pull back
  { jump: 'camp:night', run: async () => { hideMori(false); await at(0, -40, 1.7); await pan(0, -70, 1.15, 8, 'smooth'); } },
];

// ---------------------------------------------------------------- running it
const P = new URLSearchParams(location.search);
const NOMUSIC = P.has('nomusic');

async function cutTo(shot: Shot) {
  await cineBlackout(0.6);
  closeAll();
  letGo();
  game.paused = false;
  game.slowmo = 1;
  try { await cineRelease(sc()!.st, 0.01); } catch { /* no scene yet */ }
  try { await bootJump(shot.jump); } catch (e) { console.warn('[trailer] jump', shot.jump, e); }
  // let the scene settle, then clear whatever it opened with
  for (let i = 0; i < 40 && (game as unknown as { busy: boolean }).busy; i++) await sleep(100);
  await sleep(900);
  hideAll();
  const s = sc();
  if (s) s.cutscene = false;
  cineBars(false); // (no letterbox: bars hide the tops of things hanging into the frame and leave them floating)
  anchor();
  if (shot.music) music(shot.music[0], shot.music[1]);
}

async function play(only: number | null) {
  const list = only ? [SHOTS[Math.max(0, Math.min(SHOTS.length - 1, only - 1))]] : SHOTS;
  do {
    for (const shot of list) {
      await cutTo(shot);
      const tick = setInterval(hideAll, 250);
      try { await shot.run(); } catch (e) { console.warn('[trailer] shot', shot.jump, e); }
      clearInterval(tick);
      if (only) { await sleep(3e5); return; }
    }
    if (playing) fadeVol(playing, 0, 2.5);
    await cineBlackout(2.5);
    await sleep(2600);
    playing = null;
  } while (P.has('loop'));
}

/** start the trailer (main.ts calls this when ?trailer=1): black until one click, then roll */
export async function startTrailer() {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  document.body.classList.add('trailer');
  audio.musicVolume = 0;
  const only = P.has('shot') ? +P.get('shot')! : null;
  const auto = P.has('auto') || only !== null;
  if (!auto) {
    // a plain black curtain (no words) until the first click or key, so the music is allowed to play
    const curtain = document.body.appendChild(document.createElement('div'));
    curtain.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;cursor:none';
    await new Promise<void>(r => {
      const go = () => { removeEventListener('pointerdown', go); removeEventListener('keydown', go); r(); };
      addEventListener('pointerdown', go);
      addEventListener('keydown', go);
    });
    curtain.remove();
  }
  await play(only);
}
