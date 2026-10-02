// The field laptop: a full-screen pixel-art rugged laptop covered in stickers, running "FieldOS 3.1".
// Apps: Microscope (samples), Photos (review), Skills (research tree), Field Guide, Notes (quests).

import { game } from '../game/game';
import { labSamples } from '../game/lab';
import { rawPhotos } from '../game/photos';
import { SKILLS, canUnlock } from '../game/skills';
import { readyFactCount } from '../game/research';
import { trackedQuest, currentStepIndex } from '../game/quests';
import { skillIconURL, uiIconURL } from '../art/itemicons';
import { el } from './ui';
import { gi } from './v7/aeroGlyphs';
import { sfx, css, wait, reduced, pushKeys, esc, bufCanvas, countUp, AppCtx, AppMount, LaptopAppId } from './laptop-kit';
import { RIG, STICKERS, paintLid, paintDeck, paintBackdrop, paintWallpaper, stickerBuffer, DECK } from './laptop-art';
import { mountSamples } from './laptop-samples';
import { mountSkills } from './laptop-skills';
import { mountGuide } from './laptop-guide';
import { mountQuests } from './laptop-quests';
import { mountPhotoRoll } from './photoreview';

export type LaptopApp = LaptopAppId;

interface AppDef { id: Exclude<LaptopApp, 'home'>; name: string; title: string; icon: () => string; accent: string; badge: () => number; mount: AppMount }

const APPS: AppDef[] = [
  { id: 'samples', name: 'Microscope', title: 'Microscope — sample analysis', icon: () => skillIconURL('micro', 1), accent: '#9b7ce0', badge: () => labSamples().filter(x => x.times === 0).length, mount: mountSamples },
  { id: 'photos', name: 'Photos', title: 'Photos — camera roll', icon: () => uiIconURL('photos', 1), accent: '#f4b43c', badge: () => rawPhotos().length, mount: (h, ctx) => { const c = mountPhotoRoll(h, () => ctx.refresh(), ctx); return c; } },
  { id: 'skills', name: 'Skills', title: 'Research tree', icon: () => uiIconURL('tree', 1), accent: '#3fbca6', badge: () => SKILLS.filter(s => canUnlock(s.id).ok).length, mount: mountSkills },
  { id: 'guide', name: 'Field Guide', title: 'Zealandia Field Guide', icon: () => uiIconURL('book', 1), accent: '#8db34a', badge: () => readyFactCount(), mount: mountGuide },
  { id: 'quests', name: 'Notes', title: 'Notes — to do', icon: () => uiIconURL('notes', 1), accent: '#e8c050', badge: () => 0, mount: mountQuests },
];
const CLOCK: Record<string, string> = { dawn: '06:12', day: '12:34', dusk: '18:47', night: '22:05' };

const CSS = `
.lt-root { position: absolute !important; inset: 0; max-width: none !important; max-height: none !important; overflow: hidden !important; background: #0b0d0a; font-variant-ligatures: none; opacity: 0; transition: opacity 0.25s; cursor: default; }
.lt-root.on { opacity: 1; }
.lt-wrap { padding: 0 !important; background: #000 !important; }
.lt-bg { position: absolute; left: 0; top: 0; image-rendering: pixelated; }
.lt-rig { position: absolute; width: calc(var(--s) * 320); height: calc(var(--s) * 180); }
.lt-art { position: absolute; image-rendering: pixelated; display: block; }
.lt-deck { left: 0; top: calc(var(--s) * 149); width: calc(var(--s) * 320); height: calc(var(--s) * 31); }
.lt-lid { position: absolute; left: calc(var(--s) * 8); top: calc(var(--s) * 1); width: calc(var(--s) * 304); height: calc(var(--s) * 148); transform-origin: 50% 100%; transition: transform 0.62s cubic-bezier(.2,1.25,.35,1), filter 0.62s; }
.lt-root.closed .lt-lid { transform: perspective(calc(var(--s) * 420)) rotateX(-78deg); filter: brightness(0.55); transition-timing-function: cubic-bezier(.6,0,.8,.4); transition-duration: 0.42s; }
.lt-lid > .lt-art { left: 0; top: 0; width: 100%; height: 100%; }
.lt-stk { position: absolute; image-rendering: pixelated; cursor: pointer; }
.lt-stk:hover { animation: ltWig 0.45s ease-in-out; filter: brightness(1.08); }
.lt-stk.boop { animation: ltBoop 0.35s cubic-bezier(.2,1.8,.4,1); }
@keyframes ltWig { 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
@keyframes ltBoop { 40% { transform: scale(1.15) rotate(-3deg); } }
.lt-shine { position: absolute; inset: 0; pointer-events: none; -webkit-mask: var(--m) 0 0 / 100% 100%; mask: var(--m) 0 0 / 100% 100%; background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.8) 48%, rgba(200,255,230,0.5) 52%, transparent 62%) 0 0 / 300% 100% no-repeat; animation: ltShine 3.4s ease-in-out infinite 1s; image-rendering: pixelated; }
@keyframes ltShine { 0% { background-position: 110% 0; } 45%, 100% { background-position: -30% 0; } }
.lt-new { position: absolute; font-family: var(--pix); font-size: calc(var(--s) * 3); line-height: 1; color: #10201c; background: #9ff0c8; padding: 0 calc(var(--s) * 0.75); transform: rotate(-8deg); pointer-events: none; box-shadow: 0 calc(var(--s) * 0.5) 0 rgba(0,0,0,0.4); animation: ltNew 1.6s ease-in-out infinite; }
@keyframes ltNew { 50% { transform: rotate(-8deg) translateY(calc(var(--s) * -0.7)); } }
.lt-led { position: absolute; width: calc(var(--s) * 2); height: calc(var(--s) * 2); background: #3a2a10; }
.lt-led.charge { background: #f4b43c; box-shadow: 0 0 calc(var(--s) * 2) #f4b43c, 0 0 calc(var(--s) * 5) rgba(244,180,60,0.5); animation: ltPulse 1.8s ease-in-out infinite; }
.lt-led.power { width: calc(var(--s) * 5); height: calc(var(--s) * 5); border-radius: 50%; background: transparent; box-shadow: 0 0 0 calc(var(--s) * 0.6) rgba(63,188,166,0.85), 0 0 calc(var(--s) * 3) rgba(63,188,166,0.7); opacity: 0; transition: opacity 0.4s; }
.lt-led.cam { width: calc(var(--s) * 1); height: calc(var(--s) * 1); background: #2a3a2a; }
.lt-root.lit .lt-led.power { opacity: 1; }
.lt-root.lit .lt-led.cam { background: #7dff8a; box-shadow: 0 0 calc(var(--s) * 2) #7dff8a; }
@keyframes ltPulse { 50% { opacity: 0.35; box-shadow: 0 0 calc(var(--s) * 1) #f4b43c; } }
.lt-deckglow { position: absolute; left: calc(var(--s) * 40); right: calc(var(--s) * 40); top: calc(var(--s) * 149); height: calc(var(--s) * 20); background: radial-gradient(ellipse at 50% 0%, rgba(120,220,200,0.18), transparent 70%); opacity: 0; transition: opacity 0.6s; pointer-events: none; }
.lt-root.lit .lt-deckglow { opacity: 1; }
.lt-screen { position: absolute; left: calc(var(--s) * 26); top: calc(var(--s) * 11); width: calc(var(--s) * 252); height: calc(var(--s) * 126); overflow: hidden; background: #050708; font-size: calc(var(--s) * 4); color: var(--paper); font-family: var(--body); line-height: 1.3; }
.lt-glass { position: absolute; inset: 0; pointer-events: none; z-index: 40; background:
  linear-gradient(118deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.02) 22%, transparent 34%),
  radial-gradient(ellipse at 50% 45%, transparent 62%, rgba(0,0,0,0.28) 100%),
  repeating-linear-gradient(180deg, rgba(0,0,0,0.07) 0 calc(var(--s) * 0.5), transparent calc(var(--s) * 0.5) var(--s));
  box-shadow: inset 0 0 calc(var(--s) * 4) rgba(0,0,0,0.55); }
.lt-power { position: absolute; inset: 0; z-index: 35; pointer-events: none; background: #d8fff4; opacity: 0; transform: scaleY(0.004); }
.lt-power.on { animation: ltOn 0.5s ease-out forwards; }
.lt-power.off { animation: ltOff 0.34s ease-in forwards; }
@keyframes ltOn { 0% { opacity: 1; transform: scale(0.3, 0.004); } 35% { opacity: 1; transform: scale(1, 0.004); } 60% { opacity: 0.9; transform: scale(1, 1); } 100% { opacity: 0; transform: scale(1, 1); } }
@keyframes ltOff { 0% { opacity: 0; transform: scale(1, 1); } 20% { opacity: 1; transform: scale(1, 1); } 60% { opacity: 1; transform: scale(1, 0.006); } 100% { opacity: 1; transform: scale(0, 0.006); } }
.lt-boot { position: absolute; inset: 0; z-index: 30; background: #050807; padding: 2.2em 3em; font-family: var(--pix); color: #8ff0dc; font-size: 0.95em; display: none; }
.lt-boot.on { display: block; }
.lt-boot .logo { display: flex; align-items: center; gap: 0.6em; margin-bottom: 1.1em; }
.lt-boot .logo img { width: 4em; image-rendering: pixelated; }
.lt-boot .logo b { font-size: 2em; color: #f1e8d0; font-weight: 600; letter-spacing: 0.04em; }
.lt-boot .logo span { display: block; font-size: 0.8em; color: #6aa89a; }
.lt-boot .ln { white-space: pre; line-height: 1.5; min-height: 1.5em; }
.lt-boot .ln i { font-style: normal; color: #f4b43c; }
.lt-boot .pb { margin-top: 1em; width: 22em; height: 0.9em; box-shadow: 0 0 0 0.2em #1f4a42; }
.lt-boot .pb div { height: 100%; width: 0; background: repeating-linear-gradient(90deg, #3fbca6 0 0.75em, #8ff0dc 0.75em 1em); transition: width 0.12s; }
.lt-os { position: absolute; inset: 0; opacity: 0; transition: opacity 0.35s; }
.lt-os.on { opacity: 1; }
.lt-wall { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.lt-desk { position: absolute; left: 0.75em; top: 0.75em; display: grid; grid-template-columns: repeat(2, 7em); grid-auto-rows: 6.4em; gap: 0.4em 0.3em; z-index: 2; }
.lt-di { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.25em; padding: 0.35em 0.2em 0.2em; background: none; border: 0; color: var(--paper); font: inherit; cursor: pointer; border-radius: 0; }
.lt-di img { width: 4em; height: 4em; image-rendering: pixelated; filter: drop-shadow(0 0.25em 0 rgba(0,0,0,0.45)); transition: transform 0.12s; }
.lt-di span { font-family: var(--pix); font-size: 0.82em; line-height: 1.1; text-align: center; padding: 0.05em 0.35em; text-shadow: 0 0.12em 0 #000, 0 0 0.3em rgba(0,0,0,0.8); }
.lt-di:hover img { transform: translateY(-0.2em) rotate(-3deg); }
.lt-di:hover span, .lt-di:focus-visible span { background: rgba(63,188,166,0.85); text-shadow: none; color: #06241e; }
.lt-di:focus-visible { outline: none; }
.lt-di .bdg { position: absolute; right: 1.05em; top: 0.05em; min-width: 1.5em; height: 1.5em; padding: 0 0.3em; display: grid; place-items: center; background: #e8614a; color: #fff; font-family: var(--pix); font-size: 0.8em; box-shadow: 0 0 0 0.18em #10201c, 0 0.25em 0 rgba(0,0,0,0.4); animation: ltBadge 1.8s ease-in-out infinite; }
@keyframes ltBadge { 0%, 70%, 100% { transform: none; } 80% { transform: translateY(-0.25em) scale(1.08); } 90% { transform: translateY(0.05em); } }
.lt-bin { position: absolute; right: 0.75em; bottom: 2.75em; width: 6em; z-index: 2; }
.lt-note { position: absolute; right: 1.2em; top: 1em; width: 17em; background: #fbe99a; color: #3b3226; padding: 0.7em 0.85em 0.8em; transform: rotate(1.6deg); box-shadow: 0 0.35em 0 rgba(0,0,0,0.35); font-family: var(--hand); font-size: 1em; line-height: 1.25; z-index: 2; cursor: pointer; transition: transform 0.15s; }
.lt-note:hover { transform: rotate(0deg) translateY(-0.2em); }
.lt-note::before { content: ''; position: absolute; top: -0.5em; left: 38%; width: 4em; height: 1em; background: rgba(255,255,255,0.45); transform: rotate(-4deg); }
.lt-note h4 { margin: 0 0 0.2em; font-family: var(--pix); font-weight: 500; font-size: 0.8em; letter-spacing: 0.1em; color: #a86a18; text-transform: uppercase; }
.lt-note b { font-family: var(--pix); font-weight: 500; font-size: 0.95em; display: block; margin-bottom: 0.15em; }
.lt-note .prog { font-family: var(--pix); font-size: 0.8em; color: #6a5a2a; }
.lt-rpw { position: absolute; right: 1.2em; top: 8.6em; z-index: 2; display: flex; align-items: center; gap: 0.5em; padding: 0.45em 0.8em 0.45em 0.5em; background: rgba(16,32,28,0.82); box-shadow: 0 0 0 0.2em rgba(143,240,220,0.25); font-family: var(--pix); }
.lt-rpw img { width: 2.4em; image-rendering: pixelated; }
.lt-rpw b { font-size: 1.6em; color: var(--amber2); font-weight: 500; line-height: 1; }
.lt-rpw span { font-size: 0.7em; opacity: 0.75; display: block; }
.lt-wm { position: absolute; right: 0.8em; bottom: 2.5em; font-family: var(--pix); font-size: 0.62em; color: rgba(255,255,255,0.45); text-align: right; line-height: 1.3; pointer-events: none; text-shadow: 0 0.1em 0 rgba(0,0,0,0.5); z-index: 1; }
.lt-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 2em; z-index: 20; display: flex; align-items: center; gap: 0.35em; padding: 0 0.35em; background: linear-gradient(180deg, #24413a, #142a25); box-shadow: inset 0 0.12em 0 rgba(143,240,220,0.3), 0 -0.1em 0 #0b0f12; font-family: var(--pix); font-size: 1em; }
.lt-start { display: flex; align-items: center; gap: 0.35em; height: 1.55em; padding: 0 0.55em 0 0.3em; background: #3fbca6; color: #06241e; border: 0; font: inherit; font-size: 0.85em; cursor: pointer; box-shadow: inset 0 -0.18em 0 rgba(0,0,0,0.25); }
.lt-start img { width: 1.4em; image-rendering: pixelated; }
.lt-start:hover { filter: brightness(1.1); }
.lt-tasks { display: flex; gap: 0.3em; flex: 1; min-width: 0; }
.lt-task { display: flex; align-items: center; gap: 0.35em; height: 1.55em; padding: 0 0.6em 0 0.3em; background: rgba(255,255,255,0.08); border: 0; color: var(--paper); font: inherit; font-size: 0.78em; cursor: pointer; box-shadow: inset 0 -0.15em 0 rgba(0,0,0,0.3); max-width: 13em; white-space: nowrap; overflow: hidden; }
.lt-task img { width: 1.35em; image-rendering: pixelated; }
.lt-task.on { background: rgba(143,240,220,0.22); box-shadow: inset 0 -0.18em 0 var(--teal); }
.lt-tray { display: flex; align-items: center; gap: 0.75em; font-size: 0.78em; padding: 0 0.4em; }
.lt-tray .rp { display: flex; align-items: center; gap: 0.3em; color: var(--amber2); }
.lt-tray .rp img { width: 1.35em; image-rendering: pixelated; }
.lt-tray .rp.bump { animation: ltBump 0.45s cubic-bezier(.2,1.8,.4,1); }
@keyframes ltBump { 40% { transform: scale(1.35); } }
.lt-tray .bat { display: flex; align-items: center; gap: 0.2em; opacity: 0.9; }
.lt-tray .bat img { width: 1.5em; image-rendering: pixelated; }
.lt-tray .clk { text-align: right; line-height: 1.05; }
.lt-tray .clk small { display: block; font-size: 0.8em; opacity: 0.7; }
.lt-shut { height: 1.55em; width: 1.9em; border: 0; background: #e8614a; color: #fff; font: inherit; font-size: 0.85em; cursor: pointer; box-shadow: inset 0 -0.18em 0 rgba(0,0,0,0.25); }
.lt-shut:hover { filter: brightness(1.12); }
.lt-menu { position: absolute; left: 0.35em; bottom: 2.1em; z-index: 25; width: 14em; background: #10201c; box-shadow: 0 0 0 0.2em #0b0f12, 0 0 0 0.35em rgba(143,240,220,0.35), 0 0.6em 1.2em rgba(0,0,0,0.5); padding: 0.4em; display: none; animation: ltMenu 0.16s ease-out; }
.lt-menu.on { display: block; }
@keyframes ltMenu { from { transform: translateY(0.6em); opacity: 0; } }
.lt-menu .hd { font-family: var(--pix); font-size: 0.8em; color: var(--teal2); padding: 0.2em 0.4em 0.4em; border-bottom: 0.12em solid rgba(143,240,220,0.2); margin-bottom: 0.3em; }
.lt-menu button { display: flex; align-items: center; gap: 0.5em; width: 100%; background: none; border: 0; color: var(--paper); font-family: var(--pix); font-size: 0.85em; padding: 0.3em 0.4em; cursor: pointer; text-align: left; }
.lt-menu button:hover { background: rgba(63,188,166,0.3); }
.lt-menu button img { width: 1.6em; image-rendering: pixelated; }
.lt-win { position: absolute; left: 0.5em; top: 0.5em; right: 0.5em; bottom: 2.5em; z-index: 10; display: flex; flex-direction: column; background: #0f1c19; box-shadow: 0 0 0 0.25em #0b0f12, 0 0 0 0.4em var(--ac), 0 0.6em 1.2em rgba(0,0,0,0.55); transform-origin: var(--ox, 50%) var(--oy, 50%); animation: ltWin 0.26s cubic-bezier(.2,1.15,.4,1); }
.lt-win.out { animation: ltWinOut 0.16s ease-in forwards; }
@keyframes ltWin { from { transform: scale(0.08); opacity: 0; } }
@keyframes ltWinOut { to { transform: scale(0.08); opacity: 0; } }
.lt-wt { height: 1.7em; flex: none; display: flex; align-items: center; gap: 0.45em; padding: 0 0.25em 0 0.45em; background: linear-gradient(90deg, var(--ac), color-mix(in srgb, var(--ac) 35%, #10201c) 55%, #10201c); font-family: var(--pix); font-size: 0.9em; color: #0b0f12; }
.lt-wt img { width: 1.3em; image-rendering: pixelated; }
.lt-wt .ttl { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.lt-wt .ctl { display: flex; gap: 0.2em; }
.lt-wt .ctl button { width: 1.35em; height: 1.2em; border: 0; background: rgba(241,232,208,0.18); color: var(--paper); font-family: var(--pix); font-size: 0.85em; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.lt-wt .ctl button.x { background: #e8614a; color: #fff; }
.lt-wt .ctl button:hover { filter: brightness(1.2); }
.lt-wb { flex: 1; min-height: 0; position: relative; overflow: hidden; }
.lt-mini { position: absolute; left: 50%; top: 45%; width: 30em; transform: translate(-50%, -50%); z-index: 12; background: #f4f1e6; color: #2a2014; box-shadow: 0 0 0 0.25em #0b0f12, 0 0 0 0.4em #9aa3a5, 0 0.6em 1.2em rgba(0,0,0,0.5); animation: ltWin 0.22s cubic-bezier(.2,1.15,.4,1); }
.lt-mini .lt-wt { --ac: #9aa3a5; }
.lt-mini pre { margin: 0; padding: 0.8em 1em 1em; font-family: var(--pix); font-size: 0.82em; line-height: 1.5; white-space: pre-wrap; }
.lt-fly { position: absolute; z-index: 60; pointer-events: none; font-family: var(--pix); font-size: 1.1em; color: var(--amber2); text-shadow: 0 0.12em 0 #000; display: flex; align-items: center; gap: 0.25em; transition: transform 0.75s cubic-bezier(.5,-0.4,.7,1), opacity 0.75s; }
.lt-fly img { width: 1.4em; image-rendering: pixelated; }
@media (prefers-reduced-motion: reduce) { .lt-lid { transition: none !important; } .lt-shine, .lt-new, .lt-di .bdg, .lt-led.charge { animation: none !important; } }
`;

let openNow = false;

/** Open the laptop (optionally straight into an app). Resolves when the lid is closed. */
export function openLaptop(o: { app?: LaptopApp } = {}): Promise<void> {
  if (openNow) return Promise.resolve();
  openNow = true;
  css('laptop', CSS);
  return new Promise<void>(resolve => {
    const root = el('div', 'lt-root k-ui closed');
    const bg = root.appendChild(document.createElement('canvas'));
    bg.className = 'lt-bg';
    const rig = root.appendChild(el('div', 'lt-rig'));
    // base / deck
    rig.appendChild(bufCanvas(paintDeck(), 'lt-art lt-deck'));
    rig.appendChild(el('div', 'lt-deckglow'));
    const charge = rig.appendChild(el('div', 'lt-led charge'));
    const power = rig.appendChild(el('div', 'lt-led power'));
    // lid
    const lid = rig.appendChild(el('div', 'lt-lid'));
    lid.appendChild(bufCanvas(paintLid(), 'lt-art'));
    const screen = lid.appendChild(el('div', 'lt-screen'));
    const camLed = lid.appendChild(el('div', 'lt-led cam'));
    const at = (e: HTMLElement, x: number, y: number, ox = 0, oy = 0) => { e.style.left = `calc(var(--s) * ${x - ox})`; e.style.top = `calc(var(--s) * ${y - oy})`; };
    at(charge, DECK.charge.x, DECK.charge.y - 1);
    at(power, DECK.power.x - 2.5, DECK.power.y - 2.5);
    at(camLed, RIG.cam.x + 5, RIG.cam.y, RIG.lid.x, RIG.lid.y);
    // stickers
    for (const s of STICKERS) {
      const buf = stickerBuffer(s);
      const cv = bufCanvas(buf, 'lt-stk');
      const host = s.on === 'lid' ? lid : rig;
      const ox = s.on === 'lid' ? RIG.lid.x : 0, oy = s.on === 'lid' ? RIG.lid.y : 0;
      const x = Math.round(s.x - buf.w / 2), y = Math.round(s.y - buf.h / 2);
      at(cv, x, y, ox, oy);
      cv.style.width = `calc(var(--s) * ${buf.w})`;
      cv.style.height = `calc(var(--s) * ${buf.h})`;
      cv.title = s.title;
      cv.addEventListener('click', () => {
        cv.classList.remove('boop'); void cv.offsetWidth; cv.classList.add('boop');
        sfx(s.id === 'koru' ? 'fact' : s.id === 'coffee' ? 'gulp' : s.id === 'kiwi' ? 'chirp' : s.id === 'serpent' ? 'hiss' : 'pluck', { vol: 0.5 });
      });
      host.appendChild(cv);
      if (s.shine) {
        const sh = el('div', 'lt-shine');
        at(sh, x, y, ox, oy);
        sh.style.width = cv.style.width; sh.style.height = cv.style.height;
        sh.style.setProperty('--m', `url(${cv.toDataURL()})`);
        host.appendChild(sh);
        const nw = el('div', 'lt-new', 'NEW');
        at(nw, x + buf.w - 7, y - 3, ox, oy);
        host.appendChild(nw);
      }
    }
    screen.appendChild(el('div', 'lt-glass'));
    const powerFx = screen.appendChild(el('div', 'lt-power'));
    const boot = screen.appendChild(el('div', 'lt-boot'));
    const os = screen.appendChild(el('div', 'lt-os'));

    // ------------------------------------------------------------ fit to viewport
    const fit = () => {
      const r = (game.ui?.root ?? document.body).getBoundingClientRect();
      const vw = r.width || innerWidth, vh = r.height || innerHeight;
      let s = Math.min(vw / RIG.w, vh / RIG.h);
      if (s >= 2) s = Math.floor(s);
      rig.style.setProperty('--s', s + 'px');
      const left = Math.round((vw - RIG.w * s) / 2), top = Math.round((vh - RIG.h * s) / 2);
      rig.style.left = left + 'px'; rig.style.top = top + 'px';
      const aw = Math.ceil(vw / s), ah = Math.ceil(vh / s);
      const bb = paintBackdrop(aw, ah, Math.round(left / s), Math.round(top / s));
      bg.width = aw; bg.height = ah;
      bg.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(bb.bytes), aw, ah), 0, 0);
      bg.style.width = aw * s + 'px'; bg.style.height = ah * s + 'px';
      bg.style.left = (left - Math.round(left / s) * s) + 'px';
      bg.style.top = (top - Math.round(top / s) * s) + 'px';
    };

    // ------------------------------------------------------------ OS
    os.innerHTML = `<canvas class="lt-wall"></canvas><div class="lt-desk"></div>
      <div class="lt-wm">FieldOS 3.1 · unregistered copy<br>Pip Nakamura Industries (est. last Tuesday)</div>
      <div class="lt-bar"><button class="lt-start" title="Start"><img src="${uiIconURL('tree', 1)}" alt="">FieldOS</button><div class="lt-tasks"></div>
        <div class="lt-tray"><span class="rp" title="Research points"><img src="${uiIconURL('rp', 1)}" alt=""><b></b></span><span class="bat" title="Battery (charging from the Kittiwake’s batteries)"><img src="${uiIconURL('battery', 1)}" alt=""><span class="pc"></span><img src="${uiIconURL('bolt', 1)}" alt="" style="width:0.9em;margin-left:-0.2em"></span><span class="clk"></span></div>
        <button class="lt-shut" title="Close the lid (Esc)">${gi('power')}</button></div>
      <div class="lt-menu"></div>`;
    const wall = os.querySelector('.lt-wall') as HTMLCanvasElement;
    const wp = paintWallpaper();
    wall.width = wp.w; wall.height = wp.h;
    wall.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(wp.bytes), wp.w, wp.h), 0, 0);
    const desk = os.querySelector('.lt-desk') as HTMLElement;
    const tasks = os.querySelector('.lt-tasks') as HTMLElement;
    const trayRp = os.querySelector('.lt-tray .rp') as HTMLElement;
    const menu = os.querySelector('.lt-menu') as HTMLElement;
    const clk = os.querySelector('.lt-tray .clk') as HTMLElement;
    const bat = os.querySelector('.lt-tray .bat .pc') as HTMLElement;

    let cur: { id: LaptopApp; win: HTMLElement; cleanup: (() => void) | void } | null = null;
    let closing = false;
    let booted = false;
    let lastRp = game.save.rp;
    let popKeys = () => {};

    const ctx: AppCtx = {
      open: (id, arg) => openApp(id, arg),
      refresh: () => refresh(),
      rpFly: (from, amount) => rpFly(from, amount),
      screen,
    };

    const refresh = () => {
      const s = game.save;
      const rpB = trayRp.querySelector('b') as HTMLElement;
      if (s.rp !== lastRp) {
        countUp(rpB, lastRp, s.rp, 600);
        trayRp.classList.remove('bump'); void trayRp.offsetWidth; trayRp.classList.add('bump');
        lastRp = s.rp;
      } else rpB.textContent = String(s.rp);
      clk.innerHTML = `Day ${s.day}<small>${CLOCK[s.campTime] ?? '12:00'}</small>`;
      bat.textContent = `${62 + ((s.day * 13) % 35)}%`;
      // desktop icons + badges
      desk.innerHTML = '';
      for (const a of APPS) {
        const n = a.badge();
        const b = el('button', 'lt-di', `<img src="${a.icon()}" alt=""><span>${a.name}</span>${n ? `<i class="bdg">${n > 99 ? '99+' : n}</i>` : ''}`);
        b.title = a.title;
        b.onclick = () => openApp(a.id, undefined, b);
        desk.appendChild(b);
      }
      const rd = el('button', 'lt-di', `<img src="${uiIconURL('readme', 1)}" alt=""><span>readme.txt</span>`);
      rd.onclick = () => mini('readme.txt', `hi rowan!!\n\ni fixed the laptop. mostly. the E key is red now because it was the only key cap left in the wreck.\n\n- battery runs off the boat. DON'T unplug it\n- do NOT put tea near the keyboard (LOOKING AT YOU CROWE)\n- the microscope app is just the webcam + a lens i taped on. works great tho\n\nlove, pip\n(warranty: void)`);
      desk.appendChild(rd);
      // taskbar
      tasks.innerHTML = '';
      if (cur && cur.id !== 'home') {
        const a = APPS.find(x => x.id === cur!.id)!;
        const t = el('button', 'lt-task on', `<img src="${a.icon()}" alt="">${a.name}`);
        t.onclick = () => openApp('home');
        tasks.appendChild(t);
      }
      renderWidgets();
    };

    let note: HTMLElement | null = null, rpw: HTMLElement | null = null, binEl: HTMLElement | null = null;
    const renderWidgets = () => {
      note?.remove(); rpw?.remove(); binEl?.remove();
      const q = trackedQuest();
      note = el('div', 'lt-note');
      if (q) {
        const i = currentStepIndex(q);
        const st = q.steps[i];
        const pr = st?.progress?.();
        note.innerHTML = `<h4>Tracking</h4><b>${esc(q.title)}</b>${st ? esc(st.text) : 'All done!'}${pr ? ` <span class="prog">(${pr[0]}/${pr[1]})</span>` : ''}`;
      } else note.innerHTML = `<h4>Notes</h4>Nothing tracked. Crowe says: “Rest is also work.”`;
      note.onclick = () => openApp('quests');
      os.appendChild(note);
      rpw = el('div', 'lt-rpw', `<img src="${uiIconURL('rp', 2)}" alt=""><div><b>${game.save.rp}</b><span>research points · ${game.save.totalRp} earned</span></div>`);
      rpw.title = 'Spend research points in Skills';
      rpw.style.cursor = 'pointer';
      rpw.onclick = () => openApp('skills');
      os.appendChild(rpw);
      binEl = el('button', 'lt-di lt-bin', `<img src="${uiIconURL('bin', 1)}" alt=""><span>Bin</span>`);
      binEl.onclick = () => mini('Bin', `sandwich_crowe_DO_NOT_EAT.jpg\nblurry_bird_01.jpg … blurry_bird_46.jpg\ngrant_rejection_letter.pdf\n\n(Pip says the bin is “emotional storage” and cannot be emptied.)`);
      os.appendChild(binEl);
    };

    const mini = (title: string, text: string) => {
      os.querySelector('.lt-mini')?.remove();
      sfx('uiOpen', { vol: 0.6 });
      const m = el('div', 'lt-mini', `<div class="lt-wt"><img src="${uiIconURL('readme', 1)}" alt=""><span class="ttl">${esc(title)} — Notepad</span><span class="ctl"><button class="x" title="Close">×</button></span></div><pre>${esc(text)}</pre>`);
      (m.querySelector('.x') as HTMLElement).onclick = () => { sfx('uiBack'); m.remove(); };
      os.appendChild(m);
    };

    const openApp = (id: LaptopApp, arg?: string, from?: HTMLElement) => {
      if (closing || !booted) return;
      menu.classList.remove('on');
      os.querySelector('.lt-mini')?.remove();
      if (cur) {
        const old = cur;
        cur = null;
        try { old.cleanup?.(); } catch (e) { console.error(e); }
        old.win.classList.add('out');
        setTimeout(() => old.win.remove(), 170);
      }
      if (id === 'home') { sfx('uiBack', { vol: 0.6 }); refresh(); return; }
      const a = APPS.find(x => x.id === id);
      if (!a) return;
      sfx('uiOpen', { vol: 0.7 });
      const win = el('div', 'lt-win');
      win.style.setProperty('--ac', a.accent);
      if (from) {
        const r = from.getBoundingClientRect(), sr = screen.getBoundingClientRect();
        win.style.setProperty('--ox', `${r.left + r.width / 2 - sr.left}px`);
        win.style.setProperty('--oy', `${r.top + r.height / 2 - sr.top}px`);
      }
      win.innerHTML = `<div class="lt-wt"><img src="${a.icon()}" alt=""><span class="ttl">${a.title}</span><span class="ctl"><button title="Minimise">_</button><button title="Maximise">${gi('max', { col: '#f1e8d0' })}</button><button class="x" title="Close app">${gi('close')}</button></span></div><div class="lt-wb"></div>`;
      const btns = win.querySelectorAll('.ctl button');
      (btns[0] as HTMLElement).onclick = () => openApp('home');
      (btns[1] as HTMLElement).onclick = () => { sfx('wrong', { vol: 0.3 }); win.animate?.([{ transform: 'scale(1.01)' }, { transform: 'none' }], { duration: 160 }); };
      (btns[2] as HTMLElement).onclick = () => openApp('home');
      os.insertBefore(win, os.querySelector('.lt-bar'));
      const body = win.querySelector('.lt-wb') as HTMLElement;
      cur = { id, win, cleanup: undefined };
      try { cur.cleanup = a.mount(body, ctx, arg); } catch (e) { console.error(e); body.innerHTML = `<div style="padding:2em;font-family:var(--pix)">This app crashed. Pip has been notified.</div>`; }
      refresh();
    };

    const rpFly = (from: HTMLElement | null, amount: number) => {
      if (!amount) { refresh(); return; }
      const sr = screen.getBoundingClientRect();
      const f = el('div', 'lt-fly', `+${amount}<img src="${uiIconURL('rp', 1)}" alt="">`);
      const r = from?.getBoundingClientRect() ?? { left: sr.left + sr.width / 2, top: sr.top + sr.height / 2, width: 0, height: 0 };
      const tr = trayRp.getBoundingClientRect();
      const k = sr.width / screen.offsetWidth || 1;
      f.style.left = `${(r.left + r.width / 2 - sr.left) / k}px`;
      f.style.top = `${(r.top + r.height / 2 - sr.top) / k}px`;
      screen.appendChild(f);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        f.style.transform = `translate(${(tr.left - r.left - r.width / 2) / k}px, ${(tr.top - r.top - r.height / 2) / k}px) scale(0.7)`;
        f.style.opacity = '0.2';
      }));
      setTimeout(() => { f.remove(); sfx('coin', { vol: 0.5 }); refresh(); }, reduced() ? 50 : 760);
    };

    const startMenu = () => {
      if (menu.classList.contains('on')) { menu.classList.remove('on'); return; }
      sfx('ui', { vol: 0.6 });
      menu.innerHTML = `<div class="hd">FieldOS 3.1 — Rowan</div>`;
      for (const a of APPS) {
        const b = el('button', '', `<img src="${a.icon()}" alt="">${a.name}`);
        b.onclick = () => openApp(a.id);
        menu.appendChild(b);
      }
      const sd = el('button', '', `<img src="${uiIconURL('bolt', 1)}" alt="">Shut the lid`);
      sd.onclick = () => shut();
      menu.appendChild(sd);
      menu.classList.add('on');
    };
    (os.querySelector('.lt-start') as HTMLElement).onclick = e => { e.stopPropagation(); startMenu(); };
    (os.querySelector('.lt-shut') as HTMLElement).onclick = () => shut();
    os.addEventListener('pointerdown', e => { if (!menu.contains(e.target as Node) && !(e.target as HTMLElement).closest('.lt-start')) menu.classList.remove('on'); });

    // ------------------------------------------------------------ boot + lid
    const runBoot = async () => {
      const skip = { v: false };
      const sk = () => { skip.v = true; };
      screen.addEventListener('pointerdown', sk, { once: true });
      const fast = reduced();
      if (!fast) {
        powerFx.classList.add('on');
        sfx('scanBeep', { vol: 0.5, pitch: 0.7 });
        await wait(260);
      }
      boot.classList.add('on');
      boot.innerHTML = `<div class="logo"><img src="${uiIconURL('tree', 2)}" alt=""><div><b>FieldOS 3.1</b><span>© Pip Nakamura Industries · patched on a beach</span></div></div>`;
      const lines = [
        'BIOS  ........ <i>ok</i>   (battery: Kittiwake aux)',
        'Mounting /dev/sample_jar ........ <i>ok</i>',
        `Loading zealandia.db (${game.save.day > 1 ? 'updated' : 'new'}) ........ <i>ok</i>`,
        'Calibrating microscope (webcam + tape) ........ <i>ok</i>',
        `Hello, Rowan. Day ${game.save.day}.`,
      ];
      const pb = el('div', 'pb', '<div></div>');
      for (let i = 0; i < lines.length; i++) {
        if (skip.v || fast) break;
        const ln = boot.appendChild(el('div', 'ln', lines[i]));
        void ln;
        sfx('typing', { vol: 0.35, pitch: 1 + i * 0.05 });
        await wait(150);
      }
      if (!skip.v && !fast) {
        boot.appendChild(pb);
        for (let k = 0; k <= 10 && !skip.v; k++) { (pb.firstElementChild as HTMLElement).style.width = k * 10 + '%'; await wait(28); }
        await wait(120);
      }
      boot.classList.remove('on');
      os.classList.add('on');
      booted = true;
      sfx('discover', { vol: 0.35, pitch: 1.4 });
      screen.removeEventListener('pointerdown', sk);
      refresh();
      if (o.app && o.app !== 'home') openApp(o.app);
    };

    const shut = async () => {
      if (closing) return;
      closing = true;
      menu.classList.remove('on');
      popKeys();
      sfx('uiBack');
      if (cur) { try { cur.cleanup?.(); } catch (e) { console.error(e); } cur = null; }
      if (!reduced()) {
        powerFx.classList.remove('on');
        powerFx.classList.add('off');
        await wait(300);
      }
      root.classList.remove('lit');
      root.classList.add('closed');
      sfx('place', { vol: 0.5, pitch: 0.8 });
      await wait(reduced() ? 20 : 420);
      root.classList.remove('on');
      await wait(reduced() ? 20 : 240);
      window.removeEventListener('resize', fit);
      close();
    };

    const close = game.ui.modal(root, () => { openNow = false; game.persist(); resolve(); }, false);
    const wrap = root.parentElement as HTMLElement;
    wrap.classList.add('lt-wrap');
    fit();
    window.addEventListener('resize', fit);
    popKeys = pushKeys(e => {
      if (e.code === 'Escape') { shut(); return true; }
      if (e.code === 'Tab') return true;
      return false;
    });
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      root.classList.add('on');
      sfx('woodCreak', { vol: 0.4, pitch: 1.3 });
      root.classList.remove('closed');
      await wait(reduced() ? 10 : 430);
      root.classList.add('lit');
      await runBoot();
    }));
  });
}
