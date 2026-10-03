// MoriOS: Mori's field laptop, a glossy "aero" desktop. The pixel Bliss wallpaper sits under
// drifting pixel clouds, sun rays and lens flares, with bubbles floating up off the grass (click
// them). Windows open, close, minimise and maximise on springs; icons hop and squash; gel buttons
// squish with soft pops; a pug cursor leaves a sparkle trail. On touch screens fingers work directly
// (tap, drag title bars, swipe to scroll, pinch the spreadsheet, hold for a right-click menu), with
// bigger hit targets and windows that open maximised on phone-sized screens; the tray toggle turns
// the laptop into a trackpad for the pug cursor instead (see ../v7/aeroCursor). Keyboard: Esc closes (menus first, then
// the lid), Tab / arrows move a focus glow, Enter or Space clicks.
// Apps: Spreadsheets (seabird survey + temperature chart), Reports (the morning report: read the
// data and fill it in), Camera (import the real photos off the camera), Photos, Files (with Jenna's
// locked folder), Plankton Sort and Bubble Pop (quick minigames) and a tiny terminal Jenna installed
// "for emergencies". Field mode (the salvaged laptop on the island): no reports, a battery that drains.
// V10 research loop (see ../v10): Upload Everything (photos, the backpack's specimens into the research
// crate with a lab analysis each, field notes, then the day report), the Zealandia Encyclopedia
// (replaces the Research Log), ZEA Mail (the agency that pays Research Points: targets, praise and
// snark) and the Skill Tree (spend RP). The tray shows the RP balance and unread agency mail.
// A fresh laptop only has the Report, the Spreadsheet and Upload Everything: every other app unlocks
// with progress and downloads itself through the installer toast (./moriApps).
// Performance: while open, the world behind is frozen (game.covered); the wallpaper stops animating
// under a maximised window; particles, cursor and icons cost nothing when idle.

import { game } from '../../game/game';
import { el } from '../ui';
import { guardInput } from '../../core/input';
import { pendingCount, uploadDueCount, unreadMail, atCamp, handInCount, pendingNotes } from '../../game/v9/research9';
import { rawPhotos } from '../../game/photos';
import { SPECIES_BY_ID } from '../../game/species';
import { researchApps, OSCtx, esc } from './moriResearch';
import { RESEARCH_CSS } from '../v7/aeroResearchCss';
import { CSS10 } from '../v10/css10';
import { icon10 } from '../v10/icons10';
import { encyclopediaApp } from '../v10/encyclopedia';
import { uploadAllApp } from '../v10/uploadAll';
import { agencyApp } from '../v10/agency';
import { skillTreeApp } from '../v10/skilltree';
import { freshTotal } from '../v10/encyData';
import bliss from '../../assets/bliss.jpg';
import { AERO_CSS } from '../v7/aeroCss';
import { Spring, Fx, sfx, canvas, R, E, icon, cloudSprite, clamp, bubSprite } from '../v7/aeroFx';
import { VCursor } from '../v7/aeroCursor';
import { gi, glyphURL, batteryGi } from '../v7/aeroGlyphs';
import { UNLOCK_BY_ID, installed, unlockable, isFresh, markInstalled, markOpened } from './moriApps';
import { bookOpen } from '../v11/paper/book';

let styled = false;

/** tiny 9x9 pixel glyphs (window controls, dropdown arrow) with a 1px drop shadow */
const GLYPHS: Record<string, string[]> = {
  min: ['.........', '.........', '.........', '.........', '.........', '.........', '..#####..', '..#####..', '.........'],
  max: ['.........', '.#######.', '.#######.', '.#.....#.', '.#.....#.', '.#.....#.', '.#######.', '.........', '.........'],
  res: ['...#####.', '...#####.', '.#####.#.', '.#####.#.', '.#...###.', '.#...#...', '.#####...', '.........', '.........'],
  x: ['.........', '.##...##.', '..##.##..', '...###...', '...###...', '..##.##..', '.##...##.', '.........', '.........'],
  arr: ['.........', '.........', '.#######.', '..#####..', '...###...', '....#....', '.........', '.........', '.........'],
};
function glyph(k: string, col = '#ffffff', sh = 'rgba(10,40,70,0.75)'): string {
  return canvas(10, 10, g => {
    for (const [o, c] of [[1, sh], [0, col]] as const) GLYPHS[k].forEach((r, y) => { for (let x = 0; x < 9; x++) if (r[x] === '#') R(g, x + o, y + o, 1, 1, c); });
  }).toDataURL();
}

// ------------------------------------------------------------------ fake photos (pixel art)

type PhotoKind = 'albatross' | 'dolphins' | 'sunset' | 'jennaSleep' | 'joshuFish' | 'chunkBucket' | 'chunkFace' | 'blurry' | 'butt';
function photo(kind: PhotoKind, w = 96, h = 64): HTMLCanvasElement {
  return canvas(w, h, g => {
    const sky = (top: string, bot: string) => { for (let y = 0; y < h; y++) { const t = y / h; g.fillStyle = t < 0.5 ? top : bot; g.fillRect(0, y, w, 1); } };
    if (kind === 'albatross' || kind === 'blurry') {
      sky('#8ac8e8', '#b8e0f0'); R(g, 0, 46, w, 18, '#3a7a9a'); R(g, 0, 46, w, 1, '#bfe6ff');
      const cx = 48, cy = 24;
      for (let i = -26; i <= 26; i++) { const y = cy + Math.abs(i) * 0.25 - Math.cos(i * 0.12) * 2; R(g, cx + i, Math.round(y), 1, 2, Math.abs(i) > 16 ? '#2a2630' : '#f4efe4'); }
      E(g, cx, cy + 1, 6, 3, '#f4efe4'); R(g, cx + 5, cy, 4, 1, '#e8c060');
      if (kind === 'blurry') { g.globalAlpha = 0.35; g.drawImage(g.canvas, 4, 1); g.drawImage(g.canvas, -3, 2); g.globalAlpha = 1; }
    } else if (kind === 'dolphins') {
      sky('#9ad0e8', '#c8e8f4'); R(g, 0, 40, w, 24, '#2a6a8a');
      for (const [x, y, s] of [[28, 30, 1], [58, 26, -1]] as const) {
        for (let i = -9; i <= 9; i++) R(g, x + i * s, Math.round(y + (i * i) * 0.09), 1, 4, i < -6 ? '#5a6a7a' : '#7a8a9a');
        R(g, x + 9 * s, y + 5, 2, 1, '#5a6a7a');
      }
      for (let i = 0; i < 12; i++) R(g, 20 + i * 5, 41 + (i % 2), 3, 1, '#ffffff');
    } else if (kind === 'sunset') {
      for (let y = 0; y < h; y++) { const t = y / 42; g.fillStyle = y < 42 ? `rgb(${240 - t * 60},${140 - t * 60},${90 + t * 40})` : '#3a2a4a'; g.fillRect(0, y, w, 1); }
      E(g, 62, 38, 9, 9, '#ffd87a');
      R(g, 0, 42, w, 22, '#3a2a4a');
      for (let i = 0; i < 20; i++) R(g, 50 + Math.random() * 24, 44 + i, 4, 1, '#e8a060');
      R(g, 14, 36, 30, 7, '#2a1c28'); R(g, 20, 28, 12, 8, '#2a1c28'); R(g, 26, 16, 1, 12, '#2a1c28');
    } else if (kind === 'jennaSleep') {
      R(g, 0, 0, w, h, '#2a2440'); R(g, 10, 36, 76, 28, '#3a3640');
      R(g, 20, 14, 26, 18, '#e070b8'); R(g, 50, 14, 26, 18, '#4ac8e8');
      E(g, 48, 40, 14, 9, '#f472b0'); E(g, 40, 46, 6, 4, '#fcd8c2');
      for (let i = 0; i < 3; i++) R(g, 70 + i * 5, 26 - i * 5, 3, 3, '#ffffff');
    } else if (kind === 'joshuFish') {
      sky('#8ac8e8', '#b8e0f0'); R(g, 0, 48, w, 16, '#6e4c32');
      E(g, 40, 32, 9, 14, '#e2d6b8'); E(g, 40, 16, 6, 6, '#f0b494'); R(g, 34, 10, 12, 3, '#2c3a5a'); E(g, 40, 22, 6, 5, '#dedad2');
      E(g, 66, 34, 18, 7, (nx, ny) => (ny < 0 ? '#3a9a9a' : '#e8e2d4')); R(g, 82, 28, 6, 12, '#3a9a9a'); R(g, 54, 32, 2, 2, '#1a1014');
    } else if (kind === 'chunkBucket' || kind === 'chunkFace' || kind === 'butt') {
      R(g, 0, 0, w, h, kind === 'chunkFace' ? '#5a4632' : '#8ac8e8');
      if (kind === 'chunkBucket') {
        R(g, 0, 50, w, 14, '#6e4c32');
        g.fillStyle = '#e8b840'; g.beginPath(); g.moveTo(28, 30); g.lineTo(68, 30); g.lineTo(64, 58); g.lineTo(32, 58); g.fill();
        E(g, 48, 26, 13, 11, '#e4b87c'); E(g, 48, 30, 7, 5, '#3e2c2a'); E(g, 42, 24, 3, 3, '#ffffff'); E(g, 54, 24, 3, 3, '#ffffff'); R(g, 42, 24, 2, 2, '#1a1012'); R(g, 54, 24, 2, 2, '#1a1012'); R(g, 47, 33, 3, 3, '#f07a90');
      } else if (kind === 'chunkFace') {
        E(g, 48, 34, 30, 26, '#e4b87c'); E(g, 48, 42, 16, 12, '#3e2c2a'); E(g, 34, 28, 8, 8, '#ffffff'); E(g, 62, 28, 8, 8, '#ffffff'); E(g, 34, 28, 5, 5, '#1a1012'); E(g, 62, 28, 5, 5, '#1a1012'); R(g, 45, 50, 6, 8, '#f07a90');
        E(g, 18, 12, 8, 7, '#3e2c2a'); E(g, 78, 12, 8, 7, '#3e2c2a');
      } else {
        R(g, 0, 48, w, 16, '#6e4c32');
        E(g, 48, 34, 22, 16, '#e0463a'); E(g, 30, 36, 8, 10, '#e4b87c'); E(g, 30, 30, 4, 4, '#e4b87c'); E(g, 30, 28, 2.5, 2.5, '#c49058');
      }
    }
  });
}

// ------------------------------------------------------------------ data

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BIRDS = ['Vanebill', 'Sackjaw', 'Tern', 'Scythewing'];
const COUNTS = [
  [3, 7, 12, 9], [4, 6, 10, 14], [2, 9, 8, 11], [5, 5, 14, 10], [3, 8, 11, 15], [4, 10, 9, 12], [6, 7, 13, 16],
];
const TEMP = [14.2, 14.0, 13.7, 13.5, 13.1, 12.9, 12.4];
const sumCol = (i: number) => COUNTS.reduce((a, r) => a + r[i], 0);

const FILES: { path: string; name: string; text: string; lock?: boolean }[] = [
  { path: 'Documents', name: 'chunk_diet_plan_FINAL_v7_REAL.docx', text: 'CHUNK DIET PLAN (v7)\n\nBreakfast: 1/2 cup kibble\nLunch: nothing (he will beg, stay strong)\nDinner: 1/2 cup kibble\nTreats: ONE biscuit per day\n\nStatus: failed on day 1 (noodles?? how)\nStatus: failed on day 2 (Joshu)\nStatus: failed on day 3 (Jenna, "he looked sad")' },
  { path: 'Documents', name: 'thesis_draft_47.doc', text: 'Chapter 1: Introduction\n\nSeabirds of the Southern Ocean are\n\n[the rest of this page is blank. It has been blank for eight months.]' },
  { path: 'Documents', name: 'packing_list.txt', text: 'Camera (x2)\nSpare batteries (x9)\nField notebooks\nNoodles (x80)\nMore noodles\nChunk\'s puffer jacket (he gets COLD)\nChunk\'s backup puffer jacket\nToothbrush?' },
  { path: 'Music', name: 'whale_songs_vol2.mp3', text: '~ ooOOOOoooo... wuuuuuhhh... ooOOooo ~\n\n(Jenna says it\'s "the most relaxing thing she\'s ever heard" and then fell asleep on her keyboard.)' },
  { path: 'Music', name: 'joshu_sea_shanties_live.wav', text: 'Recorded at 2 a.m. in the galley.\nContains 14 verses of "The Wellerman" and one verse about his knee.' },
  { path: 'Downloads', name: 'how_to_tie_a_bowline.pdf', text: 'The rabbit comes out of the hole, goes around the tree, and back down the hole.\n\n(Joshu wrote underneath: "THE RABBIT IS NOT THE POINT, DOC")' },
  { path: 'Jenna\'s Stuff', name: 'fishcount_ai.py', text: '# fish counter v3 "Captain Count"\n# counts: birds, fish, clouds (mostly not clouds)\n# known bug: classifies Chunk as potato (0.93 confidence)\n\ndef count(frame):\n    return vibes(frame) * 1.0  # TODO: real math', lock: true },
  { path: 'Jenna\'s Stuff', name: 'definitely_not_a_diary.txt', text: 'Day 23: Dad made pancakes shaped like fish. Mori said they were "anatomically incorrect" and ate four. Chunk stole one. Best day of the trip so far. (Don\'t tell them I wrote this.)', lock: true },
];

// ------------------------------------------------------------------ OS

interface Win {
  el: HTMLElement; id: string; tab: HTMLElement; bd: HTMLElement;
  x: number; y: number; w: number; h: number;
  max: boolean; min: boolean; minning: boolean; closing: boolean; drag: boolean; anim: boolean;
  prev: { x: number; y: number; w: number; h: number } | null;
  sx: Spring; sy: Spring; tx: Spring; ty: Spring; rot: Spring; a: number; aT: number; lastTb: number;
  onKey?: (e: KeyboardEvent) => boolean;
}
interface Pop { el: HTMLElement; anchor?: Element; onClose?: () => void }
type MenuItem = [string, string | null, () => void] | '-';

/** a desktop icon: the aero set plus the V10 icons (upall, enc, mail, skills, the encyclopedia's) */
const ico = (name: string, scale = 2) => icon10(name, scale) ?? icon(name, scale);

/**
 * Open the laptop. report: the ship's morning report is due; field: the salvaged laptop on the island
 * (and at camp); app: launch an app straight away ('upall' for Upload Everything, 'enc', 'mail', 'skills').
 */
export async function openMoriOS(o: { report: boolean; field?: boolean; app?: string }): Promise<void> {
  if (!styled) { document.head.appendChild(el('style', '', AERO_CSS + RESEARCH_CSS + CSS10)); styled = true; }
  const field = !!o.field;
  if (field) o = { ...o, report: false };
  // the salvaged laptop's battery: a little lower every time it's opened
  const opens = field ? (game.save.vars['v9:lapOpens'] = (game.save.vars['v9:lapOpens'] ?? 0) + 1) : 0;
  const batt = field ? Math.max(6, 71 - opens * 3) : 87;
  const wrap = el('div', 'mos-wrap');
  wrap.innerHTML = `<div class="mos-lap"><div class="mos-scr">
      <div class="mos-bg"><img alt="" draggable="false"></div>
      <div class="mos-sun"></div><div class="mos-rays"></div>
      <div class="mos-flare f2"></div><div class="mos-flare f0"></div><div class="mos-flare f1"></div><div class="mos-flare f3"></div>
      <div class="mos-icons"></div><div class="mos-gad"></div><div class="mos-wins"></div>
      <div class="mos-bar"><div class="mos-orb ctl" title="Start"></div><div class="mos-tabs"></div>
        <div class="mos-tray"><span class="tp ctl" data-direct="1" title="Touch mode"></span><span class="rpc ctl" title="Research Points (Skill Tree)"></span><span class="ml ctl" title="ZEA Mail"></span><span class="cm ctl" title="Camera connected"></span><span class="wf" title="${field ? 'No internet: shipwrecked' : 'No internet: middle of the ocean'}">${gi('wifix')} Wi-Fi</span><span class="bt${batt < 25 ? ' lo' : ''}" title="${field ? 'Charged off the wreck’s battery. Mostly.' : 'Battery'}">${batteryGi(batt)} ${batt}%</span><span class="clk"></span></div><div class="mos-peek ctl" title="Show desktop"></div></div>
      <div class="mos-menus"></div><div class="mos-focus"></div>
    </div><div class="mos-brand"><i></i>MoriBook</div></div>`;
  if (field) wrap.classList.add('field');
  // painted glyphs the stylesheets use (ticks on picked photos and owned skills)
  wrap.style.setProperty('--ckw', `url(${glyphURL('check', { col: '#ffffff', edge: '#1c5e0e' })})`);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => wrap.querySelector(s) as T;
  const lap = $('.mos-lap'), scr = $('.mos-scr'), bgEl = $('.mos-bg'), wins = $('.mos-wins'), tabs = $('.mos-tabs'), bar = $('.mos-bar');
  const orb = $('.mos-orb'), peek = $('.mos-peek'), clk = $('.clk'), menus = $('.mos-menus'), ring = $('.mos-focus'), iconsEl = $('.mos-icons'), gad = $('.mos-gad');
  ($('.mos-bg img') as HTMLImageElement).src = bliss;
  orb.appendChild(icon('pug', 1.34));
  const lid = el('div', 'gel red sm mos-lid ctl', `${gi('close')} Close lid`);
  lid.dataset.direct = '1';
  lid.title = 'Close the laptop (Esc)';
  lap.appendChild(lid);
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  // the laptop covers the screen: freeze the world behind it so the desktop gets the GPU
  game.covered++;
  sfx.open();

  let open: Win[] = [];
  let active: Win | null = null;
  let zTop = 10;
  let closed = false;
  let finish = () => {};
  const fx = new Fx();
  fx.back.className = 'mos-fxb'; fx.front.className = 'mos-fxf';
  scr.insertBefore(fx.back, iconsEl);
  scr.appendChild(fx.front);

  // ---- geometry
  const S = { w: 0, h: 0, dh: 0 };
  // the screen's rect, read at most once per frame (pointer moves and effects ask for it constantly)
  let scrR: DOMRect | null = null, scrK = 1;
  const scrPt = (cx: number, cy: number) => {
    if (!scrR) { scrR = scr.getBoundingClientRect(); scrK = scrR.width / (scr.offsetWidth || 1) || 1; }
    return { x: (cx - scrR.left) / scrK, y: (cy - scrR.top) / scrK };
  };
  const center = (e: Element) => { const r = e.getBoundingClientRect(); return scrPt(r.left + r.width / 2, r.top + r.height / 2); };
  let bgW = 0, bgH = 0;
  const measure = () => {
    S.w = scr.clientWidth; S.h = scr.clientHeight; S.dh = S.h - bar.offsetHeight;
    bgW = Math.max(S.w, S.h * 16 / 9) * 1.06; bgH = bgW * 9 / 16;
    bgEl.style.width = bgW + 'px'; bgEl.style.height = bgH + 'px';
    fx.resize(S.w, S.h);
  };
  measure();

  // ---- the cursor (mouse rides it, touch drives it like a trackpad)
  const cur = new VCursor(wrap, () => scr.getBoundingClientRect(), t => !!t.closest('[data-direct]'));
  // touch: direct by default; the tray toggle (remembered) switches to the trackpad
  cur.direct = game.save.vars['v4:trackpad'] !== 1;
  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
  const bigUI = () => wrap.classList.add('big');
  if (coarse() || ('ontouchstart' in window && navigator.maxTouchPoints > 0)) bigUI();
  wrap.classList.toggle('direct', cur.direct);
  const tpBtn = $('.mos-tray .tp');
  const tpLabel = () => { tpBtn.innerHTML = cur.direct ? `${gi('touch')} Touch` : `${gi('pad')} Trackpad`; tpBtn.title = cur.direct ? 'Direct touch (tap to use the trackpad cursor instead)' : 'Trackpad cursor (tap for direct touch)'; };
  tpLabel();
  tpBtn.addEventListener('click', () => {
    cur.setDirect(!cur.direct);
    game.save.vars['v4:trackpad'] = cur.direct ? 0 : 1;
    game.persist();
    wrap.classList.toggle('direct', cur.direct);
    tpLabel();
    retrigger(tpBtn, 'pop');
    sfx.pick();
    touchHint(true);
  });
  let trailAcc = 0;
  let ringOn = false;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  cur.onMove = (x, y, dx, dy) => {
    const p = scrPt(x, y);
    par.tx = clamp(p.x / (S.w || 1) - 0.5, -0.6, 0.6); par.ty = clamp(p.y / (S.h || 1) - 0.5, -0.6, 0.6);
    trailAcc += Math.hypot(dx, dy);
    if (trailAcc > 13 && p.x > 0 && p.y > 0 && p.x < S.w && p.y < S.h) { trailAcc = 0; fx.trail(p.x + 4, p.y + 6); }
    ringOn = false; ring.classList.remove('on');
  };
  let hintEl: HTMLElement | null = null;
  const touchHint = (always = false) => {
    if (!always && cur.direct && game.save.vars['v4:touchHint']) return;
    if (cur.direct) { game.save.vars['v4:touchHint'] = 1; }
    hintEl?.remove();
    const h = el('div', 'mos-hint', cur.direct
      ? `<b>Touch mode</b>Tap to click · Swipe to scroll · Pinch the spreadsheet<br>Drag a title bar to move a window · Hold for more<br>(Tray: ${gi('touch')} Touch switches to the trackpad cursor)`
      : `<b>Chunk is your trackpad</b>Drag anywhere to move the cursor · Tap to click<br>Hold (or two-finger tap) for more · Two fingers scroll<br>Tap, then drag, to move windows`);
    wrap.appendChild(h);
    hintEl = h;
    setTimeout(() => { h.classList.add('bye'); setTimeout(() => h.remove(), 450); }, 5600);
  };
  cur.onFirstTouch = () => { bigUI(); touchHint(); };
  // the on-screen keyboard can cover a text field: keep the focused one in view
  wrap.addEventListener('focusin', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement && cur.isTouch) setTimeout(() => { if (t.isConnected) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, 350);
  });

  // ---- wallpaper: drifting pixel clouds in the wallpaper's own pixel grid, sun rays, lens flares
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const c = cloudSprite(i * 7 + 3);
    c.className = 'mos-cloud';
    bgEl.appendChild(c);
    return { c, x: Math.random() * 170 - 10, y: 3 + ((i * 37) % 34) + Math.random() * 3, v: 0.35 + Math.random() * 0.9 + (i % 3) * 0.25, d: 0.4 + (i % 3) * 0.3 };
  });
  const flares = [...wrap.querySelectorAll<HTMLElement>('.mos-flare')].map((e, i) => ({ e, k: [0.55, 0.85, 1.15, 0.38][i], s: [110, 70, 26, 14][i] }));

  // ---- gadgets (clock + sea & sky), with a few water droplets on the glass
  gad.innerHTML = field
    ? `<div><canvas class="clockc" width="48" height="48"></canvas></div><div><h4>Island</h4><p>Signal: none</p><p>Battery <span class="dn">${batt}%</span></p><p>Sand in keyboard: yes</p></div>`
    : `<div><canvas class="clockc" width="48" height="48"></canvas></div><div><h4>Sea & Sky</h4><p>Water 12.4°C <span class="dn">${gi('down', { k: 1 })}</span></p><p>Barometer <span class="dn">falling</span></p><p>Wi-Fi: 1,400 km away</p></div>`;
  const DROPS = [[8, 10], [84, 58], [44, 84], [20, 70], [90, 14], [62, 30]];
  gad.querySelectorAll(':scope > div').forEach((d, i) => { for (let k = 0; k < 3; k++) { const [x, y] = DROPS[(i * 3 + k) % DROPS.length]; const dr = el('i', 'mos-drop'); dr.style.cssText = `left:${x}%;top:${y}%`; d.appendChild(dr); } });
  const clockG = (gad.querySelector('.clockc') as HTMLCanvasElement).getContext('2d')!;
  const line = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) => {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= n; i++) R(g, Math.round(x0 + ((x1 - x0) * i) / n) - (w > 1 ? 1 : 0), Math.round(y0 + ((y1 - y0) * i) / n) - (w > 1 ? 1 : 0), w, w, c);
  };
  const gameClock = () => ({ h: 8 + Math.floor(game.time / 60) % 4, m: Math.floor(game.time) % 60 });
  const drawClock = () => {
    const g = clockG, { h, m } = gameClock();
    g.clearRect(0, 0, 48, 48);
    E(g, 24, 24, 23, 23, (nx, ny) => (Math.hypot(nx, ny) > 0.9 ? '#1a4a70' : ny < -0.1 ? '#ffffff' : ny < 0.45 ? '#eef8ff' : '#d4ecfa'));
    E(g, 24, 13, 15, 8, (_, ny) => (ny < 0 ? 'rgba(255,255,255,0.6)' : null));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; R(g, Math.round(24 + Math.sin(a) * 17) - (i % 3 ? 0 : 1), Math.round(24 - Math.cos(a) * 17) - (i % 3 ? 0 : 1), i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#3a6a90'); }
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2, ma = (m / 60) * Math.PI * 2;
    line(g, 24, 24, 24 + Math.sin(ha) * 10, 24 - Math.cos(ha) * 10, '#12304a', 2);
    line(g, 24, 24, 24 + Math.sin(ma) * 15, 24 - Math.cos(ma) * 15, '#1a98d8');
    E(g, 24, 24, 2, 2, '#e8483a');
  };

  // ---- per-frame animation hooks
  const anims = new Set<(dt: number) => boolean>();
  const animate = (f: (dt: number) => boolean) => { anims.add(f); };
  const floatText = (x: number, y: number, t: string, color?: string) => {
    const f = el('div', 'mos-float', t);
    f.style.left = x + 'px'; f.style.top = y + 'px';
    if (color) f.style.color = color;
    scr.appendChild(f);
    setTimeout(() => f.remove(), 950);
  };
  const retrigger = (e: Element, cls: string) => { e.classList.remove(cls); void (e as HTMLElement).offsetWidth; e.classList.add(cls); };

  // ---- balloons from the tray
  let bal: HTMLElement | null = null;
  /** the app installer toast (see the downloads below) */
  let dlEl: HTMLElement | null = null;
  const balloon = (title: string, text: string, ms = 6500, bo: { icon?: string; onClick?: () => void } = {}) => {
    bal?.remove();
    const b = el('div', 'mos-balloon' + (bo.onClick ? ' ctl act' : ''), `<b></b><span>${text}</span>`);
    const bb = b.querySelector('b') as HTMLElement;
    bb.appendChild(ico(bo.icon ?? 'pug', 1));
    bb.appendChild(document.createTextNode(title));
    scr.appendChild(b);
    bal = b;
    if (dlEl) b.style.bottom = `calc(var(--bar) + ${dlEl.offsetHeight + 22}px)`;
    const kill = () => { if (!b.isConnected) return; b.classList.add('bye'); setTimeout(() => b.remove(), 320); if (bal === b) bal = null; };
    b.addEventListener('click', () => { kill(); if (bo.onClick) { lastPress = center(b); bo.onClick(); } });
    setTimeout(kill, ms);
    sfx.pick();
  };

  // ---- popovers & menus
  let pops: Pop[] = [];
  const closePops = () => {
    for (const p of pops) { p.el.classList.add('bye'); setTimeout(() => p.el.remove(), 150); p.onClose?.(); }
    if (navCur && pops.some(p => p.el.contains(navCur))) navCur = navBack && navBack.isConnected ? navBack : null;
    pops = [];
    orb.classList.remove('on');
  };
  const openPop = (content: HTMLElement, x: number, y: number, opt: { anchor?: Element; bottom?: boolean; side?: boolean; onClose?: () => void } = {}) => {
    closePops();
    measure();
    const p = el('div', 'mos-pop');
    p.appendChild(content);
    if (content.classList.contains('mos-menu')) content.style.maxHeight = Math.max(80, S.dh - 8) + 'px';
    menus.appendChild(p);
    const pw = p.offsetWidth, ph = p.offsetHeight;
    const px = clamp(x, 4, Math.max(4, S.w - pw - 4));
    let py = opt.bottom ? S.dh - ph - 4 : opt.side ? clamp(y - ph / 2, 4, Math.max(4, S.dh - ph - 4)) : y;
    if (!opt.side && py + ph > S.dh - 4) py = Math.max(4, y - ph - (opt.anchor ? (opt.anchor as HTMLElement).offsetHeight + 6 : 0));
    p.style.left = px + 'px'; p.style.top = py + 'px';
    p.style.transformOrigin = `${clamp(x - px, 0, pw)}px ${opt.bottom || py < y ? ph : 0}px`;
    pops.push({ el: p, anchor: opt.anchor, onClose: opt.onClose });
    sfx.menu();
    if (ringOn) { navBack = navCur; const first = p.querySelector<HTMLElement>('.ctl'); if (first) setNav(first); }
    return p;
  };
  const menu = (x: number, y: number, items: MenuItem[]) => {
    const m = el('div', 'mos-menu');
    for (const it of items) {
      if (it === '-') { m.appendChild(el('hr')); continue; }
      const [label, ic, act] = it;
      const mi = el('div', 'mi ctl');
      if (ic) mi.appendChild(ico(ic, 1));
      mi.appendChild(el('span', '', label));
      mi.addEventListener('click', () => { closePops(); act(); });
      m.appendChild(mi);
    }
    openPop(m, x, y);
  };

  // ---- form controls built for the pug cursor (no native pickers needed)
  const arrow = glyph('arr', '#0a4a78', 'rgba(255,255,255,0.85)');
  const dropdown = (opts: string[], ph = '(choose)') => {
    const d = el('div', 'dd ctl ph', ph);
    d.style.setProperty('--arr', `url(${arrow})`);
    const api = { el: d, value: '', onChange: () => {} };
    d.addEventListener('click', () => {
      if (pops.some(p => p.anchor === d)) { closePops(); return; }
      const r = d.getBoundingClientRect();
      const p = scrPt(r.left, r.bottom + 3);
      const m = el('div', 'mos-menu');
      m.style.minWidth = d.offsetWidth + 'px';
      for (const op of opts) {
        const mi = el('div', 'mi ctl' + (op === api.value ? ' hov' : ''), op);
        mi.addEventListener('click', () => {
          api.value = op; d.textContent = op; d.classList.remove('ph', 'ok', 'bad');
          closePops(); sfx.pick(); retrigger(d, 'mos-wiggle');
          const c = center(d); fx.sparkle(c.x + d.offsetWidth * 0.3, c.y, 7, 60);
          api.onChange();
        });
        m.appendChild(mi);
      }
      openPop(m, p.x, p.y, { anchor: d });
    });
    return api;
  };
  let numActive: { type: (k: string) => void } | null = null;
  const numField = () => {
    const w = el('div', 'numf');
    const v = el('div', 'v ctl ph', '0');
    w.appendChild(v);
    const api = { el: w, v, value: '', onChange: () => {}, type: (_k: string) => {} };
    const set = (s: string) => { api.value = s; v.textContent = s || '0'; v.classList.toggle('ph', !s); v.classList.remove('ok', 'bad'); api.onChange(); };
    api.type = (k: string) => {
      if (k === 'back') { set(api.value.slice(0, -1)); sfx.tick(0); }
      else if (k === 'ok') closePops();
      else if (api.value.length < 3) { set((api.value + k).replace(/^0+(?=\d)/, '')); sfx.tick(+k); }
      retrigger(v, 'mos-wiggle');
    };
    v.addEventListener('click', () => {
      if (pops.some(p => p.anchor === v)) { closePops(); return; }
      const kp = el('div', 'mos-menu kp');
      for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok']) {
        const b = el('div', 'gel ctl' + (k === 'ok' ? ' green' : k === 'back' ? ' glass' : ''), k === 'back' ? gi('bksp') : k === 'ok' ? 'OK' : k);
        b.addEventListener('click', () => { api.type(k); if (k !== 'ok') { const c = center(b); fx.sparkle(c.x, c.y, 4, 40); } });
        kp.appendChild(b);
      }
      const r = v.getBoundingClientRect();
      // short screens: the pad opens beside the field so the number stays in view
      const side = S.dh < 520;
      const p = side ? scrPt(r.right + 10, r.top + r.height / 2) : scrPt(r.left, r.bottom + 3);
      v.classList.add('on');
      numActive = api;
      openPop(kp, p.x, p.y, { anchor: v, side, onClose: () => { v.classList.remove('on'); if (numActive === api) numActive = null; } });
    });
    return api;
  };
  const progress = (cls = '') => {
    const e = el('div', 'prog ' + cls, '<i></i><span></span>');
    const i = e.querySelector('i') as HTMLElement, s = e.querySelector('span') as HTMLElement;
    const sp = new Spring(0, 170, 13);
    let running = false;
    const api = {
      el: e,
      set: (f: number, label?: string, instant = false) => {
        sp.target = clamp(f, 0, 1);
        if (instant) sp.snap(sp.target);
        if (label !== undefined) s.textContent = label;
        if (!running) { running = true; animate(dt => { sp.step(dt); i.style.width = clamp(sp.x, 0, 1.04) * 100 + '%'; if (sp.rest(0.001)) { running = false; return false; } return e.isConnected; }); }
      },
      edge: () => { const r = i.getBoundingClientRect(); return scrPt(r.right, r.top + r.height / 2); },
    };
    return api;
  };

  // ---- windows
  const place = (W: Win) => { const s = W.el.style; s.left = W.x + 'px'; s.top = W.y + 'px'; s.width = W.w + 'px'; s.height = W.h + 'px'; };
  const visibleWins = () => open.filter(w => !w.closing && !w.min && !w.minning);
  const topWin = () => visibleWins().sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0] ?? null;
  const focus = (W: Win | null) => {
    if (W) W.el.style.zIndex = String(++zTop);
    active = W;
    for (const x of open) { x.el.classList.toggle('act', x === W); x.tab.classList.toggle('on', x === W); }
  };
  const tabCenter = (W: Win) => center(W.tab);
  const kSet = (W: Win, k: [number, number, number, number], d = 20) => { [W.sx, W.sy, W.tx, W.ty].forEach((s, i) => { s.k = k[i]; s.d = d; }); };
  const minimize = (W: Win) => {
    if (W.min || W.minning || W.closing) return;
    const t = tabCenter(W);
    W.el.style.transformOrigin = '50% 50%';
    kSet(W, [190, 300, 210, 300], 22);
    W.tx.target = t.x - (W.x + W.w / 2); W.ty.target = t.y - (W.y + W.h / 2);
    W.sx.target = 0.1; W.sy.target = 0.06; W.aT = 0; W.minning = true;
    W.tab.classList.add('min');
    sfx.min();
    if (active === W) focus(topWin());
  };
  const restore = (W: Win) => {
    if (!W.min && !W.minning) return;
    const t = tabCenter(W);
    W.min = W.minning = false;
    W.el.style.display = '';
    W.el.style.transformOrigin = '50% 50%';
    kSet(W, [260, 210, 240, 200], 17);
    W.tx.x = t.x - (W.x + W.w / 2); W.ty.x = t.y - (W.y + W.h / 2); W.sx.x = 0.1; W.sy.x = 0.06;
    W.tx.target = W.ty.target = 0; W.sx.target = W.sy.target = 1; W.a = 0; W.aT = 1;
    W.tab.classList.remove('min');
    focus(W);
    sfx.restore();
    fx.sparkle(t.x, t.y - 10, 8, 70);
  };
  const toggleMax = (W: Win) => {
    measure();
    const old = { x: W.x, y: W.y, w: W.w, h: W.h };
    if (!W.max) { W.prev = old; Object.assign(W, { x: 0, y: 0, w: S.w, h: S.dh, max: true }); }
    else { Object.assign(W, W.prev ?? { x: 20, y: 20, w: Math.min(480, S.w - 20), h: Math.min(400, S.dh - 20) }, { max: false }); }
    W.el.classList.toggle('max', W.max);
    place(W);
    W.el.style.transformOrigin = '0 0';
    kSet(W, [300, 280, 300, 280], 21);
    W.tx.x = old.x - W.x; W.ty.x = old.y - W.y; W.sx.x = old.w / W.w; W.sy.x = old.h / W.h;
    W.tx.target = W.ty.target = 0; W.sx.target = W.sy.target = 1;
    (W.el.querySelector('.ctrls .mx') as HTMLElement).style.setProperty('--gl', `url(${glyph(W.max ? 'res' : 'max', '#1a3a5a', 'rgba(255,255,255,0.9)')})`);
    sfx.click();
    focus(W);
  };
  const closeWin = (W: Win) => {
    if (W.closing) return;
    W.closing = true;
    W.el.style.transformOrigin = '50% 50%';
    kSet(W, [420, 380, 300, 300], 26);
    W.sx.target = 0.72; W.sy.target = 0.55; W.aT = 0;
    W.el.style.pointerEvents = 'none';
    W.tab.remove();
    const cx = W.x + W.w / 2, cy = W.y + W.h / 2;
    fx.bubbles(cx, cy, 10, Math.min(W.w, 260)); fx.sparkle(cx, cy, 8, 110);
    sfx.close();
    if (active === W) focus(topWin());
  };
  let lastPress = { x: 0, y: 0 };
  const small = () => S.w < 700 || S.dh < 430;
  const win = (id: string, title: string, ic: string, w: number, h: number, body: HTMLElement | string, opt: { dark?: boolean; from?: { x: number; y: number } } = {}): Win | null => {
    const ex = open.find(x => x.id === id && !x.closing);
    if (ex) { if (ex.min || ex.minning) restore(ex); focus(ex); retrigger(ex.el, 'mos-wiggle'); sfx.click(); return null; }
    measure();
    const n = visibleWins().length;
    const ww = Math.min(w, S.w - 12), hh = Math.min(h, S.dh - 12);
    const x0 = Math.min(iconsEl.offsetWidth + 20, S.w - ww - 6);
    const x = clamp(x0 + n * 28, 6, Math.max(6, S.w - ww - 6)), y = clamp(10 + n * 24, 4, Math.max(4, S.dh - hh - 4));
    const e = el('div', 'mos-win' + (opt.dark ? ' dark' : ''));
    e.innerHTML = `<div class="tb"><span class="ic"></span><span class="tt"></span><div class="ctrls"><b class="mn ctl" title="Minimise"></b><b class="mx ctl" title="Maximise"></b><b class="x ctl" title="Close"></b></div></div><div class="bd"></div>`;
    (e.querySelector('.ic') as HTMLElement).appendChild(ico(ic, 1));
    (e.querySelector('.tt') as HTMLElement).textContent = title;
    const [mn, mx, xx] = [...e.querySelectorAll<HTMLElement>('.ctrls b')];
    mn.style.setProperty('--gl', `url(${glyph('min', '#1a3a5a', 'rgba(255,255,255,0.9)')})`);
    mx.style.setProperty('--gl', `url(${glyph('max', '#1a3a5a', 'rgba(255,255,255,0.9)')})`);
    xx.style.setProperty('--gl', `url(${glyph('x')})`);
    const bd = e.querySelector('.bd') as HTMLElement;
    if (typeof body === 'string') bd.innerHTML = body; else bd.appendChild(body);
    wins.appendChild(e);
    const tab = el('div', 'mos-tab ctl');
    tab.appendChild(ico(ic, 1));
    tab.appendChild(el('span', 'tt', title));
    tabs.appendChild(tab);
    const W: Win = { el: e, id, tab, bd, x, y, w: ww, h: hh, max: false, min: false, minning: false, closing: false, drag: false, anim: true, prev: null,
      sx: new Spring(0.3, 330, 16), sy: new Spring(0.2, 250, 14), tx: new Spring(0, 260, 20), ty: new Spring(0, 260, 20), rot: new Spring(0, 220, 14), a: 0, aT: 1, lastTb: 0 };
    W.sx.target = W.sy.target = 1;
    // phone-sized screens: windows open maximised (restore / drag gives a window that fits)
    if (small()) {
      W.prev = { x: 4, y: 4, w: Math.min(ww, S.w - 8), h: Math.min(hh, S.dh - 8) };
      Object.assign(W, { x: 0, y: 0, w: S.w, h: S.dh, max: true });
      e.classList.add('max');
      mx.style.setProperty('--gl', `url(${glyph('res', '#1a3a5a', 'rgba(255,255,255,0.9)')})`);
    }
    place(W);
    const from = opt.from ?? lastPress;
    e.style.transformOrigin = `${clamp(from.x - x, -200, ww + 200)}px ${clamp(from.y - y, -200, hh + 200)}px`;
    e.style.opacity = '0';
    open.push(W);
    focus(W);
    sfx.open();
    e.addEventListener('pointerdown', () => { if (active !== W) focus(W); });
    tab.addEventListener('click', () => { if (W.min || W.minning) restore(W); else if (active === W) minimize(W); else { focus(W); retrigger(e, 'mos-wiggle'); } });
    for (const b of [mn, mx, xx]) b.addEventListener('pointerdown', ev => ev.stopPropagation());
    mn.addEventListener('click', () => minimize(W));
    mx.addEventListener('click', () => toggleMax(W));
    xx.addEventListener('click', () => closeWin(W));
    const tb = e.querySelector('.tb') as HTMLElement;
    tb.addEventListener('click', ev => {
      if ((ev.target as Element).closest('.ctrls')) return;
      const now = performance.now();
      if (now - W.lastTb < 380) { W.lastTb = 0; toggleMax(W); } else W.lastTb = now;
    });
    tb.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || (ev.target as Element).closest('.ctrls')) return;
      const p0 = scrPt(ev.clientX, ev.clientY);
      let ox = p0.x - W.x, oy = p0.y - W.y, lx = p0.x, lt = performance.now(), moved = false;
      const mv = (m: PointerEvent) => {
        const p = scrPt(m.clientX, m.clientY);
        if (!moved) {
          if (Math.hypot(p.x - p0.x, p.y - p0.y) < 4) return;
          moved = true; W.drag = true;
          if (W.max && W.prev) { const f = ox / W.w; W.max = false; e.classList.remove('max'); W.w = W.prev.w; W.h = W.prev.h; ox = f * W.w; oy = Math.min(oy, 16); mx.style.setProperty('--gl', `url(${glyph('max', '#1a3a5a', 'rgba(255,255,255,0.9)')})`); }
          e.style.transformOrigin = `${ox}px ${oy}px`;
          W.sx.k = W.sy.k = 300; W.sx.d = W.sy.d = 16;
          W.sx.target = W.sy.target = 1.03;
        }
        W.x = clamp(p.x - ox, -W.w + 90, S.w - 90); W.y = clamp(p.y - oy, 0, S.dh - 28);
        const now = performance.now();
        const vx = ((p.x - lx) / Math.max(1, now - lt)) * 1000;
        lx = p.x; lt = now;
        W.rot.target = clamp(vx / 240, -5, 5);
        place(W);
      };
      const up = (u: PointerEvent) => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        if (!moved) return;
        W.drag = false; W.rot.target = 0; W.sx.target = W.sy.target = 1;
        W.sy.v -= 1.6; W.sx.v += 1.1;
        sfx.press();
        if (scrPt(u.clientX, u.clientY).y <= 3 && !W.max) toggleMax(W);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    return W;
  };

  // ---- the research apps (camera import, photos: ./moriResearch; the V10 loop: ../v10)
  const os: OSCtx = {
    field,
    win: (id, title, ic, w, h, body) => win(id, title, ic, w, h, body),
    find: id => open.find(x => x.id === id && !x.closing) ?? null,
    closeWin: id => { const W = open.find(x => x.id === id && !x.closing); if (W) closeWin(W); },
    fx, center, animate, retrigger, floatText, progress,
    closed: () => closed,
    from: e => { lastPress = center(e); },
    badges: () => badges(),
    oldPhotos: ([['albatross', 'Fluting vanebill, day 20. Whistled at me the whole time.'], ['dolphins', 'Moonfin porpoises riding the bow wave'], ['sunset', 'The Kittiwake at sunset (Jenna took this one)'], ['jennaSleep', 'Jenna, asleep on her keyboard at 3 a.m. "zzzzzzzzzzzzzzzz" x 4000'], ['joshuFish', 'Joshu and The Fish That Was Bigger Last Time He Told It'], ['chunkBucket', 'Chunk in a bucket. He chose this.']] as [PhotoKind, string][])
      .map(([k, cap]) => ({ key: k, cap, make: () => photo(k) })),
    balloon: (title, text, ms, bo) => balloon(title, text, ms, bo),
    open: (app, arg) => { closePops(); openApp(app, arg); },
    has: app => available(app),
    refresh: () => { RA.refresh(); ENC.refresh(); MAIL.refresh(); SK.refresh(); UP.refresh(); badges(); },
    sessionDone: ses => {
      const got = MAIL.react(ses);
      MAIL.refresh();
      badges();
      const m = got.find(x => x.tag === 'upload') ?? got[0];
      // (the agency's replies wait in the inbox until ZEA Mail is installed)
      if (m && installed('mail')) setTimeout(() => { if (!closed) balloon('New mail from ZEA', `<b>${esc(m.subj)}</b>${got.length > 1 ? ` (+${got.length - 1} more)` : ''}`, 7000, { icon: 'mail', onClick: () => openApp('mail', m.id) }); }, 900);
    },
    icon: (name, scale) => ico(name, scale),
  };
  const RA = researchApps(os);
  const ENC = encyclopediaApp(os, RA);
  const MAIL = agencyApp(os);
  const SK = skillTreeApp(os, MAIL);
  const UP = uploadAllApp(os, RA);
  /** desktop & tray badges: photos waiting on the camera, the haul to upload, new encyclopedia pages, unread mail, the RP balance */
  const trayCam = $('.mos-tray .cm'), trayRp = $('.mos-tray .rpc'), trayMail = $('.mos-tray .ml');
  // the camera chip imports through the Camera app once it's installed, Upload All before that
  trayCam.addEventListener('click', () => { lastPress = center(trayCam); openApp(installed('cam') ? 'cam' : 'upall'); });
  trayRp.addEventListener('click', () => { lastPress = center(trayRp); openApp('skills'); });
  trayMail.addEventListener('click', () => { lastPress = center(trayMail); openApp('mail'); });
  let lastPend = -1, lastRp = -1, lastMail = -1;
  const count = (k: string, n: number) => { const e = iconEls[k]; if (e) { e.dataset.n = n ? String(n) : ''; e.classList.toggle('cnt', n > 0); } };
  const badges = () => {
    const n = pendingCount();
    count('cam', n);
    count('upall', uploadDueCount());
    count('mail', unreadMail());
    iconEls.enc?.classList.toggle('new', freshTotal() > 0);
    iconEls.skills?.classList.toggle('new', SK.buyable() > 0);
    trayCam.style.display = n ? '' : 'none';
    // the RP and mail chips belong to their apps: hidden until those are installed
    trayRp.style.display = installed('skills') ? '' : 'none';
    if (unlocksOn) checkUnlocks();
    if (n !== lastPend) {
      trayCam.innerHTML = '';
      trayCam.appendChild(icon('cam', 0.75));
      trayCam.appendChild(document.createTextNode(String(n)));
      if (lastPend >= 0 && n > lastPend) retrigger(trayCam, 'pop');
      lastPend = n;
    }
    const rp = game.save.rp;
    if (rp !== lastRp) { trayRp.innerHTML = `${gi('gem')} ${rp} RP`; if (lastRp >= 0) retrigger(trayRp, 'pop'); lastRp = rp; }
    const um = installed('mail') ? unreadMail() : 0;
    trayMail.style.display = um ? '' : 'none';
    if (um !== lastMail) {
      trayMail.innerHTML = '';
      trayMail.appendChild(ico('mail', 0.75));
      trayMail.appendChild(document.createTextNode(String(um)));
      if (lastMail >= 0 && um > lastMail) retrigger(trayMail, 'pop');
      lastMail = um;
    }
  };

  // ---- apps
  const apps: Record<string, () => void> = {
    sheet: () => {
      const b = el('div');
      b.innerHTML = `<div class="ribbon"><span class="on">Home</span><span>Insert</span><span>Data</span><span>Chunk</span></div><div class="fx"><b class="ref">B2</b><i>fx</i><span class="val">3</span><div class="zm"><div class="gel sm glass ctl zo">−</div><em>100%</em><div class="gel sm glass ctl zi">+</div></div></div>`;
      const t = el('table', 'xl');
      // zoom: the − / + buttons, or pinch with two fingers
      let zoom = 1;
      const zEl = b.querySelector('.zm em') as HTMLElement;
      const setZoom = (z: number) => { zoom = clamp(Math.round(z * 20) / 20, 0.6, 1.8); t.style.zoom = String(zoom); zEl.textContent = Math.round(zoom * 100) + '%'; };
      (b.querySelector('.zo') as HTMLElement).addEventListener('click', () => { setZoom(zoom - 0.1); sfx.tick(2); });
      (b.querySelector('.zi') as HTMLElement).addEventListener('click', () => { setZoom(zoom + 0.1); sfx.tick(5); });
      let pinch: { d: number; z: number } | null = null;
      const tdist = (ev: TouchEvent) => Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
      b.addEventListener('touchstart', ev => { if (ev.touches.length === 2) pinch = { d: tdist(ev) || 1, z: zoom }; }, { passive: true });
      b.addEventListener('touchmove', ev => { if (pinch && ev.touches.length === 2) { ev.preventDefault(); setZoom(pinch.z * tdist(ev) / pinch.d); } }, { passive: false });
      b.addEventListener('touchend', ev => { if (ev.touches.length < 2) pinch = null; });
      t.innerHTML = `<tr><th></th>${BIRDS.map(x => `<th>${x}</th>`).join('')}<th>Water °C</th></tr>` +
        COUNTS.map((r, i) => `<tr><th>${DAYS[i]}</th>${r.map((v, j) => `<td class="hv" data-v="${v}" data-f="${v}" data-r="${String.fromCharCode(66 + j)}${i + 2}">${v}</td>`).join('')}<td class="hv" data-v="${TEMP[i]}" data-f="${TEMP[i]}" data-r="F${i + 2}">${TEMP[i].toFixed(1)}</td></tr>`).join('') +
        `<tr class="sum"><th>SUM</th>${BIRDS.map((_, j) => `<td class="ctl" data-v="?" data-f="=SUM(${String.fromCharCode(66 + j)}2:${String.fromCharCode(66 + j)}8)" data-r="${String.fromCharCode(66 + j)}9">?</td>`).join('')}<td class="ctl" data-f="(average)" data-v="?" data-r="F9">?</td></tr>`;
      b.appendChild(t);
      const cap = el('div', 'cap', '<b>Chart:</b> water temperature this week');
      b.appendChild(cap);
      const chart = canvas(220, 96, g => {
        const sky = ['#f6fcff', '#eef8ff', '#e4f4fe', '#daf0fc', '#d0ebfa'];
        for (let y = 0; y < 96; y++) R(g, 0, y, 220, 1, sky[Math.floor(y / 20)]);
        for (let i = 0; i < 5; i++) R(g, 18, 10 + i * 17, 198, 1, '#c6def0');
        const Y = (v: number) => 10 + (14.4 - v) * 32;
        const at = (x: number) => { const f = clamp((x - 26) / 30, 0, 6); const i = Math.min(5, Math.floor(f)); return Y(TEMP[i] + (TEMP[i + 1] - TEMP[i]) * (f - i)); };
        for (let x = 26; x <= 206; x++) { const y = Math.round(at(x)); R(g, x, y + 2, 1, 86 - y, x % 2 ? '#bfe8fb' : '#b4e2f8'); R(g, x, y + 2, 1, 2, '#8fd6f6'); }
        for (let x = 26; x <= 206; x++) R(g, x, Math.round(at(x)), 1, 2, '#1a8ad0');
        TEMP.forEach((v, i) => { const x = 26 + i * 30, y = Math.round(Y(v)); E(g, x + 0.5, y + 1, 3, 3, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? '#0a5f8e' : ny < -0.1 ? '#ffffff' : '#5fd0f4')); });
        R(g, 18, 86, 198, 1, '#7a9ab4');
      });
      chart.className = 'chart';
      const cw = el('div');
      cw.style.cssText = 'position:relative;width:440px;max-width:100%;padding-bottom:18px';
      cw.appendChild(chart);
      DAYS.forEach((d, i) => { const s = el('span', '', d); s.style.cssText = `position:absolute;bottom:0;left:${((26 + i * 30) / 220) * 100}%;transform:translateX(-50%);font:16px/1 'Jersey 15','Pixelify Sans',monospace;color:#3a5a78`; cw.appendChild(s); });
      const cu = el('span', '', '°C'); cu.style.cssText = `position:absolute;left:4px;top:8px;font:16px/1 'Jersey 15','Pixelify Sans',monospace;color:#3a5a78`; cw.appendChild(cu);
      b.appendChild(cw);
      const ref = b.querySelector('.ref') as HTMLElement, val = b.querySelector('.val') as HTMLElement;
      t.addEventListener('click', ev => {
        const td = (ev.target as HTMLElement).closest('td') as HTMLElement | null;
        if (!td) return;
        t.querySelectorAll('td.sel').forEach(x => x.classList.remove('sel'));
        td.classList.add('sel');
        ref.textContent = td.dataset.r ?? '';
        val.textContent = td.dataset.f ?? '';
        // SUM cells compute when clicked (Mori has to actually look); the total counts up
        if (td.dataset.v === '?') {
          const j = (td.dataset.r ?? 'B').charCodeAt(0) - 66;
          const fin = j < 4 ? sumCol(j) : TEMP.reduce((a, v) => a + v, 0) / TEMP.length;
          const txt = j < 4 ? String(fin) : fin.toFixed(1);
          td.dataset.v = txt;
          let tt = 0, lastN = -1;
          animate(dt => {
            tt += dt;
            const f = Math.min(1, tt / 0.6), e2 = 1 - Math.pow(1 - f, 3);
            const n = fin * e2;
            td.textContent = j < 4 ? String(Math.round(n)) : n.toFixed(1);
            const step = Math.floor(e2 * 8);
            if (step !== lastN) { lastN = step; sfx.tick(step); }
            if (f >= 1) {
              td.textContent = txt;
              retrigger(td, 'bump');
              const c = center(td); fx.sparkle(c.x, c.y, 12, 80);
              sfx.beep();
              return false;
            }
            return td.isConnected;
          });
        }
      });
      win('sheet', 'seabird_survey_wk3.xls', 'sheet', 600, 480, b);
    },
    report: () => {
      const b = el('div', 'rp');
      const head = (s: string) => `<div class="head"><b>${s}</b></div>`;
      if (field) {
        b.innerHTML = head('Reports') + `<p>No reports due. The university thinks we’re three weeks from port.</p><p><i>(The last one is still in the outbox. So is the boat, technically.)</i></p>`;
        win('report', 'reports', 'report', 450, 240, b);
        return;
      }
      if (game.save.flags['v4:report']) {
        b.innerHTML = head('Morning Report · Day 23') + `<div class="done-stamp"><b>${gi('check')} Submitted</b>It will upload to the university the moment we have signal. (In about three weeks.)</div>`;
        win('report', 'morning_report_day23.doc', 'report', 470, 250, b);
        return;
      }
      if (!o.report) {
        b.innerHTML = head('Morning Report · Day 23') + `<p>Template ready. Needs today’s rounds first: fish fed, engine checked, captain and Jenna checked on.</p><p><i>(Mori’s rule: no fiction in the data.)</i></p>`;
        win('report', 'morning_report_day23.doc', 'report', 470, 260, b);
        return;
      }
      b.innerHTML = `<div class="head"><b>Morning Report · Day 23 · RV Kittiwake</b><div class="gel sm glass ctl opsheet">Survey sheet</div></div>
        <div class="q"><label>1. Most sighted seabird this week</label><div class="s1"></div><div class="tip t1"></div></div>
        <div class="q"><label>2. Total vanebill sightings this week</label><div class="s2"></div><div class="tip t2"></div></div>
        <div class="q"><label>3. Water temperature trend</label><div class="s3"></div><div class="tip t3"></div></div>
        <div class="q"><label>4. Photo of the day</label><div class="thumbs"></div><div class="tip t4"></div></div>
        <div class="act"><div class="gel green big go ctl">Send report ${gi('send')}</div><div class="pw"></div></div><div class="out"></div>`;
      const opSheet = b.querySelector('.opsheet') as HTMLElement;
      opSheet.addEventListener('click', () => { lastPress = center(opSheet); apps.sheet(); });
      const q1 = dropdown(BIRDS), q2 = numField(), q3 = dropdown(['Rising', 'Falling', 'Steady']);
      (b.querySelector('.s1') as HTMLElement).appendChild(q1.el);
      (b.querySelector('.s2') as HTMLElement).appendChild(q2.el);
      (b.querySelector('.s3') as HTMLElement).appendChild(q3.el);
      const answered = progress();
      (b.querySelector('.pw') as HTMLElement).replaceWith(answered.el);
      const th = b.querySelector('.thumbs') as HTMLElement;
      let pick = -1;
      const upd = () => { const n = [q1.value, q2.value, q3.value, pick >= 0 ? 'y' : ''].filter(Boolean).length; answered.set(n / 4, `${n}/4 answered`); };
      q1.onChange = q2.onChange = q3.onChange = upd;
      upd();
      // photo of the day: the shots Mori actually took today (camera roll + uploaded), newest first
      const shots = reportPhotos();
      if (!shots.length) th.appendChild(el('div', 'tip', 'No photos from today yet. Go and take one!'));
      shots.forEach((sh, i) => {
        const f = el('div', 'th ctl');
        const img = el('img') as HTMLImageElement;
        img.src = sh.img; img.draggable = false;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block';
        f.title = sh.bird ? 'Seabird' : 'Photo';
        f.appendChild(img);
        f.addEventListener('click', () => {
          pick = i;
          th.querySelectorAll('.th').forEach((x, j) => x.classList.toggle('on', j === i));
          th.classList.remove('ok', 'bad');
          sfx.pick();
          const cc = center(f); fx.sparkle(cc.x, cc.y, 8, 70);
          upd();
        });
        th.appendChild(f);
      });
      const go = b.querySelector('.go') as HTMLElement;
      go.addEventListener('click', () => {
        const ok1 = q1.value === 'Scythewing', ok2 = +q2.value === sumCol(0), ok3 = q3.value === 'Falling', ok4 = pick >= 0 && !!shots[pick]?.bird;
        const mark = (e: HTMLElement, ok: boolean) => { e.classList.remove('ok', 'bad'); e.classList.add(ok ? 'ok' : 'bad'); if (!ok) retrigger(e, 'mos-shake'); };
        mark(q1.el, ok1); mark(q2.v, ok2); mark(q3.el, ok3); mark(th, ok4);
        (b.querySelector('.t1') as HTMLElement).textContent = ok1 ? '' : 'Check the spreadsheet: click the SUM row to total each column.';
        (b.querySelector('.t2') as HTMLElement).textContent = ok2 ? '' : 'Add up the Vanebill column (or click its SUM cell).';
        (b.querySelector('.t3') as HTMLElement).textContent = ok3 ? '' : 'Look at the temperature chart in the spreadsheet.';
        (b.querySelector('.t4') as HTMLElement).textContent = ok4 ? '' : pick < 0 ? 'Pick a photo of the day.' : 'The university wants a seabird in focus. That one isn’t it.';
        if (!(ok1 && ok2 && ok3 && ok4)) { sfx.bad(); retrigger(go, 'mos-shake'); return; }
        // all correct: the report is done the moment it validates; the rest is the victory lap
        game.save.flags['v4:report'] = true;
        game.persist();
        iconsEl.querySelector('.mos-ic.new')?.classList.remove('new');
        answered.set(1, '4/4 answered');
        const act = go.parentElement as HTMLElement;
        go.remove();
        const send = progress('aq');
        act.innerHTML = '';
        act.appendChild(el('span', '', 'Packing into the outbox…'));
        act.appendChild(send.el);
        send.set(0, '0%', true);
        let tt = 0, lastQ = -1;
        animate(dt => {
          tt += dt;
          const f = Math.min(1, tt / 1.7), e2 = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          send.set(e2, Math.round(e2 * 100) + '%');
          const q = Math.floor(e2 * 10);
          if (q !== lastQ) { lastQ = q; sfx.tick(q); if (b.isConnected) { const p = send.edge(); fx.sparkle(p.x, p.y, 3, 40); fx.bubbles(p.x, p.y, 1, 8); } }
          if (f < 1) return true;
          sfx.win();
          if (b.isConnected) {
            act.innerHTML = '';
            (b.querySelector('.out') as HTMLElement).innerHTML = `<div class="done-stamp">${shots[pick] ? `<img src="${shots[pick].img}" style="width:96px;float:right;margin-left:8px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transform:rotate(3deg)">` : ''}<b>${gi('check')} Report complete!</b>Scythewings lead the week, ${sumCol(0)} vanebills, and the water is cooling fast. Cooling fast... huh. Might mention that to Joshu.</div>`;
            const c = center(b);
            fx.confetti(c.x - b.offsetWidth * 0.3, c.y - b.offsetHeight / 2, 70, b.offsetWidth * 0.5); fx.confetti(c.x + b.offsetWidth * 0.3, c.y - b.offsetHeight / 2, 70, b.offsetWidth * 0.5);
            fx.bubbles(c.x, c.y, 16, b.offsetWidth * 0.6);
            fx.sparkle(c.x, c.y, 18, 160);
            const W = open.find(w => w.id === 'report');
            if (W) { W.sy.v -= 2.2; W.sx.v += 1.4; W.anim = true; W.el.style.transformOrigin = '50% 100%'; }
          }
          balloon('Report queued', 'It will upload the moment we find signal. Close the lid when you’re ready.', 8000);
          return false;
        });
      });
      win('report', 'morning_report_day23.doc', 'report', 500, 480, b);
    },
    photos: () => RA.photos(),
    cam: () => RA.cam(),
    disc: () => ENC.open(),
    enc: () => ENC.open(),
    upall: () => UP.open(),
    mail: () => MAIL.open(),
    skills: () => SK.open(),
    files: () => {
      const b = el('div');
      b.innerHTML = `<div class="addr"><div class="gel glass sm">${gi('back', { col: '#3a5a78' })}</div><span>Computer ${gi('crumb')} MoriBook ${gi('crumb')} Files</span></div>`;
      const list = el('div', 'fl');
      b.appendChild(list);
      let unlocked = false;
      const folders = [...new Set(FILES.map(f => f.path))];
      const render = () => {
        list.innerHTML = '';
        for (const fo of folders) {
          const locked = fo === 'Jenna\'s Stuff' && !unlocked;
          const row = el('div', 'row dir');
          row.appendChild(icon(locked ? 'lock' : 'folder', 1));
          row.appendChild(el('span', '', fo));
          list.appendChild(row);
          if (locked) {
            const r2 = el('div', 'pwrow');
            r2.innerHTML = `<span>Password:</span><input class="mos-in pw" style="width:130px" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><div class="gel sm ctl">Unlock</div>`;
            const pw = r2.querySelector('.pw') as HTMLInputElement;
            pw.classList.add('ctl');
            const tryIt = () => {
              const v = pw.value.trim().toLowerCase();
              if (v === 'chunk123' || v === 'chunk') {
                unlocked = true; sfx.unlock();
                const c = center(r2); fx.sparkle(c.x, c.y, 16, 120); fx.confetti(c.x, c.y, 26, 80);
                render();
              } else { sfx.bad(); pw.value = ''; pw.placeholder = 'hint: her favourite dog + 123'; retrigger(pw, 'mos-shake'); }
            };
            (r2.querySelector('.gel') as HTMLElement).addEventListener('click', tryIt);
            pw.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') tryIt(); });
            list.appendChild(r2);
            continue;
          }
          for (const f of FILES.filter(x => x.path === fo)) {
            const r = el('div', 'row f ctl');
            r.appendChild(icon('doc', 1));
            r.appendChild(el('span', '', f.name));
            r.addEventListener('click', () => { const np = el('div', 'np'); np.textContent = f.text; win('f:' + f.name, f.name, 'doc', 430, 320, np); });
            list.appendChild(r);
          }
        }
      };
      render();
      win('files', 'Files', 'folder', 470, 430, b);
    },
    plankton: () => {
      const b = el('div', 'pk');
      b.innerHTML = `<div class="top"><b>Plankton Sort</b><div class="tm"></div><span class="sc"></span></div><div style="margin:-2px 0 8px;color:#3a5a78">Sort yesterday’s sample before the slide dries!</div><div class="cvw"></div>
        <div class="bins"><div class="gel ctl" data-k="0">Copepod <span class="k">1</span></div><div class="gel green ctl" data-k="1">Diatom <span class="k">2</span></div><div class="gel pink ctl" data-k="2">Larva <span class="k">3</span></div></div><div class="res"></div>`;
      const tm = progress('');
      (b.querySelector('.tm') as HTMLElement).replaceWith(tm.el);
      const cvw = b.querySelector('.cvw') as HTMLElement;
      const cv = canvas(160, 80, () => {});
      cv.className = 'spec';
      cvw.appendChild(cv);
      const g = cv.getContext('2d')!;
      const sc = b.querySelector('.sc') as HTMLElement, res = b.querySelector('.res') as HTMLElement;
      let cur2 = 0, score = 0, miss = 0, left = 25, t0 = 0, over = false, wob = 0;
      const drawSpec = () => {
        R(g, 0, 0, 160, 80, '#cfeef8');
        E(g, 80, 40, 70, 36, (nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.96 ? '#0a5f8e' : d > 0.9 ? '#9adcf4' : ny < -0.55 && nx < -0.1 ? '#ffffff' : '#eefbff'; });
        if (over) return;
        const oy = Math.round(Math.sin(wob) * 1.5);
        if (cur2 === 0) { E(g, 80, 40 + oy, 12, 7, '#e8a060'); R(g, 90, 36 + oy, 16, 1, '#c87a3a'); R(g, 90, 44 + oy, 16, 1, '#c87a3a'); R(g, 60, 39 + oy, 8, 1, '#c87a3a'); E(g, 74, 38 + oy, 2, 2, '#1a1014'); R(g, 76, 36 + oy, 3, 1, '#ffd0a0'); }
        else if (cur2 === 1) { for (let i = 0; i < 5; i++) { E(g, 64 + i * 8, 40 + (i % 2) * 3 + oy, 4, 6, '#6ac04a'); E(g, 64 + i * 8, 40 + (i % 2) * 3 + oy, 2, 3, '#b8f0a0'); } }
        else { E(g, 80, 40 + oy, 8, 10, '#f4c8e0'); E(g, 80, 34 + oy, 5, 4, '#e090b8'); R(g, 74, 48 + oy, 12, 2, '#e090b8'); E(g, 78, 33 + oy, 1.5, 1.5, '#1a1014'); E(g, 83, 33 + oy, 1.5, 1.5, '#1a1014'); }
      };
      const start = () => {
        cur2 = Math.floor(Math.random() * 3); score = 0; miss = 0; left = 25; t0 = performance.now(); over = false;
        res.innerHTML = '';
        tm.set(1, '25s', true);
        tm.el.className = 'prog';
        drawSpec();
        animate(dt => {
          if (closed || !b.isConnected) return false;
          wob += dt * 5;
          drawSpec();
          left = 25 - (performance.now() - t0) / 1000;
          sc.textContent = `${score} sorted`;
          tm.set(Math.max(0, left) / 25, `${Math.max(0, Math.ceil(left))}s`);
          tm.el.className = 'prog' + (left < 6 ? ' hot' : left < 12 ? ' warn' : '');
          if (left > 0) return true;
          over = true;
          drawSpec();
          if (score >= 8 && !game.save.flags['v4:plankton']) { game.save.flags['v4:plankton'] = true; game.save.rp = (game.save.rp ?? 0) + 5; game.persist(); }
          sfx.star();
          res.innerHTML = `<h3>Done! ${score} sorted, ${miss} oops</h3>${score >= 8 ? '<div style="color:#2a8a18">Great sorting! The slide is saved.</div>' : '<div>Sort 8 or more to save the slide.</div>'}`;
          const again = el('div', 'gel ctl', 'Again!');
          again.style.marginTop = '6px';
          again.addEventListener('click', start);
          res.appendChild(again);
          const c = center(cv);
          if (score >= 8) fx.confetti(c.x, c.y - 30, 50, 160); else fx.bubbles(c.x, c.y, 8, 120);
          return false;
        });
      };
      const sort = (k: number, btn?: Element) => {
        if (over) return;
        const c = center(cv);
        if (k === cur2) { score++; sfx.pop(score); fx.sparkle(c.x, c.y, 10, 90); fx.bubbles(c.x, c.y + 10, 3, 60); floatText(c.x, c.y - 20, '+1'); }
        else { miss++; sfx.bad(); retrigger(cv, 'mos-shake'); floatText(c.x, c.y - 20, 'oops', '#ffd0c8'); }
        if (btn) retrigger(btn, 'mos-wiggle');
        cur2 = Math.floor(Math.random() * 3);
        drawSpec();
      };
      b.querySelectorAll<HTMLElement>('.bins .gel').forEach(btn => btn.addEventListener('pointerdown', () => sort(+btn.dataset.k!, btn)));
      start();
      const W = win('plankton', 'Plankton Sort', 'game', 430, 370, b);
      if (W) W.onKey = e => { const k = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3; if (k < 0 || e.repeat) return false; const btn = b.querySelectorAll('.bins .gel')[k]; btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 90); sort(k, btn); return true; };
    },
    bubbles: () => {
      const b = el('div', 'bp pk');
      b.innerHTML = `<div class="top"><b>Bubble Pop</b><div class="tm"></div><span class="sc"></span></div><div style="margin:-2px 0 8px;color:#3a5a78">Pop them all! Golden Chunk bubbles are worth 5.</div><div class="cvw"></div><div class="res"></div>`;
      const tm = progress('aq');
      (b.querySelector('.tm') as HTMLElement).replaceWith(tm.el);
      const W0 = 200, H0 = 120;
      const cv = canvas(W0, H0, () => {});
      (b.querySelector('.cvw') as HTMLElement).appendChild(cv);
      const g = cv.getContext('2d')!;
      const sc = b.querySelector('.sc') as HTMLElement, res = b.querySelector('.res') as HTMLElement;
      const pug = icon('pug', 1);
      type B = { x: number; y: number; r: number; v: number; ph: number; gold: boolean };
      let bs: B[] = [], score = 0, combo = 0, left = 0, spawn = 0, over = true;
      const draw = () => {
        const cols = ['#bfeaff', '#b0e4fd', '#a2ddfa', '#94d6f6', '#86cff2', '#79c7ee'];
        for (let y = 0; y < H0; y++) R(g, 0, y, W0, 1, cols[Math.floor((y / H0) * cols.length)]);
        for (let i = 0; i < 6; i++) R(g, 20 + i * 34 + Math.round(Math.sin(left + i) * 3), 0, 6, H0, 'rgba(255,255,255,0.12)');
        R(g, 0, H0 - 10, W0, 10, '#6cc83c'); R(g, 0, H0 - 10, W0, 2, '#a6e86a');
        for (const q of bs) {
          const s = bubSprite(q.r);
          g.drawImage(s, Math.round(q.x - q.r), Math.round(q.y - q.r));
          if (q.gold) { g.globalAlpha = 0.9; g.drawImage(pug, Math.round(q.x - q.r * 0.7), Math.round(q.y - q.r * 0.7), Math.round(q.r * 1.4), Math.round(q.r * 1.4)); g.globalAlpha = 1; R(g, Math.round(q.x - q.r * 0.5), Math.round(q.y - q.r * 0.7), 2, 1, '#fff'); }
        }
      };
      const start = () => {
        bs = []; score = 0; combo = 0; left = 20; spawn = 0; over = false; res.innerHTML = '';
        tm.set(1, '20s', true);
        animate(dt => {
          if (closed || !b.isConnected) return false;
          left -= dt; spawn -= dt;
          if (spawn <= 0) { spawn = 0.28 + Math.random() * 0.35; const gold = Math.random() < 0.09; bs.push({ x: 12 + Math.random() * (W0 - 24), y: H0 + 8, r: gold ? 9 : 4 + Math.floor(Math.random() * 6), v: 16 + Math.random() * 18 + (20 - left) * 0.8, ph: Math.random() * 6, gold }); }
          for (const q of bs) { q.y -= q.v * dt; q.ph += dt * 3; q.x += Math.sin(q.ph) * 8 * dt; }
          const esc = bs.filter(q => q.y < -q.r).length;
          if (esc) combo = 0;
          bs = bs.filter(q => q.y >= -q.r);
          sc.textContent = `${score} pts${combo > 2 ? ` · x${combo}` : ''}`;
          tm.set(Math.max(0, left) / 20, `${Math.max(0, Math.ceil(left))}s`);
          draw();
          if (left > 0) return true;
          over = true;
          sfx.star();
          res.innerHTML = `<h3>${score} points!</h3>`;
          const again = el('div', 'gel ctl', 'Again!');
          again.addEventListener('click', start);
          res.appendChild(again);
          const c = center(cv); fx.confetti(c.x, c.y - 40, 40, 200);
          return false;
        });
      };
      cv.addEventListener('pointerdown', ev => {
        if (over) return;
        const r = cv.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width) * W0, y = ((ev.clientY - r.top) / r.height) * H0;
        let hit = -1, best = 1e9;
        bs.forEach((q, i) => { const d = Math.hypot(q.x - x, q.y - y); if (d < q.r + 4 && d < best) { best = d; hit = i; } });
        const p = scrPt(ev.clientX, ev.clientY);
        if (hit < 0) { combo = 0; return; }
        const q = bs.splice(hit, 1)[0];
        combo++;
        const pts = (q.gold ? 5 : 1) * (combo > 4 ? 2 : 1);
        score += pts;
        sfx.pop(combo);
        if (q.gold) sfx.bark();
        fx.sparkle(p.x, p.y, q.gold ? 16 : 7, q.gold ? 120 : 70);
        fx.ring(p.x, p.y, 'rgba(230,252,255,0.95)', q.r * 5);
        floatText(p.x, p.y - 14, '+' + pts, q.gold ? '#ffe27a' : undefined);
      });
      draw();
      start();
      win('bubbles', 'Bubble Pop', 'bubbles', 440, 400, b);
    },
    term: () => {
      const b = el('div', 'term');
      const chips = el('div', 'chips');
      const out = el('div', '', 'JennaShell v0.3 (installed "for emergencies")\ntype "help"\n\n');
      const ln = el('div', 'ln', '<span>&gt;</span><input spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="send" placeholder="tap here to type">');
      b.append(chips, out, ln);
      const inp = ln.querySelector('input') as HTMLInputElement;
      inp.classList.add('ctl');
      const cmds: Record<string, string> = {
        help: 'commands: help, whoami, ls, fortune, weather, sudo feed chunk, jenna, joshu, clear',
        whoami: 'mori. marine biologist. noodle enthusiast. owned by a pug.',
        ls: 'thesis_draft_47.doc  noodles/  chunk_photos/ (2,041 files)  DO_NOT_DELETE_jenna_code/',
        weather: 'barometer: FALLING. falling fast. (Jenna: "that\'s probably fine")',
        'sudo feed chunk': 'permission denied: chunk is on a diet (v7).',
        jenna: 'hi mori!!! if you\'re reading this you\'re in my terminal!!! get out!!! (love you, nerd)',
        joshu: 'Joshu does not use computers. Joshu uses the sun, the stars and his knee.',
      };
      const fortunes = ['A pug\'s wrinkles need cleaning every day. Chunk disagrees.', 'A vanebill can glide for a week without one flap.', 'The ocean is 94% of the living space on Earth. Chunk is 94% snacks.', 'Sea otters hold hands when they sleep.'];
      const run = (raw: string) => {
        const v = raw.trim().toLowerCase();
        if (v === 'clear') { out.textContent = ''; return; }
        const r = v === 'fortune' ? fortunes[Math.floor(Math.random() * fortunes.length)] : cmds[v] ?? (v ? `${v}: command not found (try "help")` : '');
        out.textContent += `> ${v}\n${r}\n\n`;
        const bd = b.parentElement;
        if (bd) bd.scrollTop = bd.scrollHeight;
        sfx.type();
      };
      for (const c of ['help', 'whoami', 'ls', 'fortune', 'weather', 'jenna', 'joshu', 'sudo feed chunk', 'clear']) {
        const ch = el('div', 'gel sm glass ctl', c);
        ch.addEventListener('click', () => run(c));
        chips.appendChild(ch);
      }
      if (!cur.isTouch) setTimeout(() => inp.focus(), 60);
      // tapping the terminal (not a chip) puts the cursor in the prompt, which brings up the keyboard
      b.addEventListener('click', ev => { if (!(ev.target as Element).closest('.chips') && document.activeElement !== inp) inp.focus(); });
      inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key !== 'Enter') return;
        run(inp.value);
        inp.value = '';
      });
      win('term', 'JennaShell', 'term', 500, 360, b, { dark: true });
    },
    bin: () => {
      const b = el('div', '', `<p>Recycle Bin (2,038 items)</p><div class="gal"></div><p><i>All of them are photos of Chunk. Mori cannot bring himself to empty it.</i></p>`);
      const gal = b.querySelector('.gal') as HTMLElement;
      for (const k of ['chunkFace', 'chunkBucket', 'butt'] as PhotoKind[]) { const f = el('figure', 'ctl'); f.appendChild(photo(k)); f.addEventListener('click', () => { sfx.bark(); const c = center(f); fx.sparkle(c.x, c.y, 10, 80); floatText(c.x, c.y - 20, 'boof!', '#ffe27a'); }); gal.appendChild(f); }
      win('bin', 'Recycle Bin', 'bin', 440, 370, b);
    },
  };

  // ---- desktop icons
  const desk: [string, string, string, boolean?][] = field ? [
    ['upall', 'Upload All', 'upall'], ['cam', 'Camera', 'cam'], ['enc', 'Encyclo-pedia', 'enc'], ['mail', 'ZEA Mail', 'mail'], ['skills', 'Skill Tree', 'skills'], ['photos', 'Photos', 'photo'],
    ['report', 'Reports', 'report'], ['sheet', 'Spread-sheets', 'sheet'], ['files', 'Files', 'folder'], ['plankton', 'Plankton Sort', 'game'], ['bubbles', 'Bubble Pop', 'bubbles'], ['bin', 'Recycle Bin', 'bin'], ['term', 'Jenna-Shell', 'term'],
  ] : [
    ['report', 'Reports', 'report', o.report && !game.save.flags['v4:report']], ['sheet', 'Spread-sheets', 'sheet'], ['cam', 'Camera', 'cam'], ['photos', 'Photos', 'photo'],
    ['enc', 'Encyclo-pedia', 'enc'], ['mail', 'ZEA Mail', 'mail'], ['skills', 'Skill Tree', 'skills'], ['upall', 'Upload All', 'upall'],
    ['files', 'Files', 'folder'], ['plankton', 'Plankton Sort', 'game'], ['bubbles', 'Bubble Pop', 'bubbles'], ['term', 'JennaShell', 'term'], ['bin', 'Recycle Bin', 'bin'],
  ];
  const launch = (id: string, from?: Element) => {
    if (from) {
      retrigger(from, 'pop');
      iconsEl.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
      from.classList.add('sel');
      const c = center(from); lastPress = c; fx.bubbles(c.x, c.y - 10, 6, 40);
    }
    closePops();
    openApp(id);
  };
  const iconEls: Record<string, HTMLElement> = {};
  /** put an installed app's icon on the desktop, in catalogue order (fresh: the NEW badge) */
  const addIcon = (id: string) => {
    const dd = desk.find(x => x[0] === id);
    if (!dd || iconEls[id]) return;
    const [, name, ic, isNew] = dd;
    const d = el('div', 'mos-ic ctl' + (isNew ? ' new' : '') + (id === 'upall' && field ? ' big0' : ''));
    d.appendChild(ico(ic, 2));
    d.appendChild(el('span', '', name));
    if (isFresh(id)) d.appendChild(el('i', 'nw', 'NEW'));
    d.addEventListener('click', () => launch(id, d));
    const after = desk.slice(desk.indexOf(dd) + 1).map(x => iconEls[x[0]]).find(Boolean);
    iconsEl.insertBefore(d, after ?? null);
    iconEls[id] = d;
    return d;
  };
  for (const [id] of desk) if (installed(id)) addIcon(id);

  // ---- app downloads: an unlocked app arrives through the installer toast in the tray corner
  /** turn the unlock checks on once the desktop has settled (not under the report's opening windows) */
  let unlocksOn = false;
  const queue: string[] = [];
  let dlCur: string | null = null;
  const pendingOpen: Record<string, () => void> = {};
  const queued = (id: string) => dlCur === id || queue.includes(id);
  /** worth a button: installed, downloading, or its unlock is met (it downloads on demand) */
  const available = (id: string) => installed(id) || queued(id) || !UNLOCK_BY_ID[id] || UNLOCK_BY_ID[id].when();
  /** balloons sit above the installer while it's up */
  const stackBal = () => { if (bal) bal.style.bottom = dlEl ? `calc(var(--bar) + ${dlEl.offsetHeight + 22}px)` : ''; };
  const checkUnlocks = () => {
    if (closed) return;
    let added = false;
    for (const u of unlockable()) if (!queued(u.id)) { queue.push(u.id); added = true; }
    if (added && !dlEl) void runDownloads();
  };
  const runDownloads = async () => {
    const box = el('div', 'mos-dl', `<div class="hd">${gi('dl')}<b>MoriStore</b><span>Downloading</span></div><div class="ls"></div>`);
    dlEl = box;
    scr.appendChild(box);
    const ls = box.querySelector('.ls') as HTMLElement, hdS = box.querySelector('.hd span') as HTMLElement;
    sfx.beep();
    stackBal();
    for (;;) {
      while (queue.length && !closed) {
        const id = queue.shift()!;
        dlCur = id;
        const u = UNLOCK_BY_ID[id];
        hdS.textContent = queue.length ? `Downloading · ${queue.length + 1} to go` : 'Downloading';
        const row = el('div', 'row', `<span class="ic"></span><span class="t"><b>${esc(u.name)}</b><small>${esc(u.why)}</small></span><em>0%</em><span class="bar"><i></i></span>`);
        (row.querySelector('.ic') as HTMLElement).appendChild(ico(desk.find(x => x[0] === id)?.[2] ?? 'doc', 1));
        ls.appendChild(row);
        // three rows at most: the oldest finished one goes
        while (ls.children.length > 3) ls.firstElementChild?.remove();
        stackBal();
        const bar = row.querySelector('.bar i') as HTMLElement, pct = row.querySelector('em') as HTMLElement;
        const T = queue.length > 1 ? 0.75 : 1.25;
        await new Promise<void>(res => {
          let t = 0, lastQ = -1;
          animate(dt => {
            t += dt;
            const f = Math.min(1, t / T);
            // the bar fills in whole pixel blocks
            const q = Math.floor(f * 12);
            if (q !== lastQ) { lastQ = q; bar.style.width = (q / 12) * 100 + '%'; pct.textContent = Math.round((q / 12) * 100) + '%'; if (q % 3 === 0) sfx.tick(q / 2); }
            if (f >= 1 || closed) { res(); return false; }
            return true;
          });
        });
        if (closed) { dlCur = null; return; }
        markInstalled(id);
        dlCur = null;
        row.classList.add('done');
        pct.textContent = 'Installed';
        const d = addIcon(id);
        if (d) {
          retrigger(d, 'pop');
          const c = center(d);
          fx.sparkle(c.x, c.y - 10, 14, 90); fx.ring(c.x, c.y - 8, 'rgba(255,240,160,0.95)', 60); fx.bubbles(c.x, c.y, 6, 40);
        }
        sfx.unlock();
        if (id === 'mail') { MAIL.welcome(); MAIL.refresh(); }
        lastRp = -1; lastMail = -1;
        badges();
        const go = pendingOpen[id];
        delete pendingOpen[id];
        if (go) go();
      }
      hdS.textContent = 'All done';
      await new Promise<void>(r => setTimeout(r, 1700));
      if (closed || !queue.length) break;
    }
    if (dlEl === box) dlEl = null;
    box.classList.add('bye');
    setTimeout(() => box.remove(), 320);
    stackBal();
  };
  /** open an app: straight away if installed; after its download if it's coming; otherwise say why not */
  const openApp = (id: string, arg?: string) => {
    const go = () => {
      if (closed) return;
      markOpened(id);
      iconEls[id]?.querySelector('.nw')?.remove();
      if (id === 'enc') ENC.open(arg); else if (id === 'mail') MAIL.open(arg); else if (id === 'skills') SK.open(arg); else if (id === 'upall') UP.open(); else apps[id]?.();
    };
    const u = UNLOCK_BY_ID[id];
    if (!u || installed(id)) { go(); return; }
    if (queued(id) || u.when()) { pendingOpen[id] = go; if (!queued(id)) { queue.push(id); if (!dlEl) void runDownloads(); } return; }
    sfx.bad();
    balloon(`${u.name}: not installed yet`, esc(u.hint ?? 'It will download later.'), 5500, { icon: desk.find(x => x[0] === id)?.[2] ?? 'doc' });
  };
  const refresh = () => {
    iconsEl.querySelectorAll('.mos-ic').forEach((d, i) => setTimeout(() => { retrigger(d, 'pop'); sfx.pop(i); const c = center(d); fx.sparkle(c.x, c.y - 10, 4, 40); }, i * 70));
  };
  const blow = () => { sfx.bubbles(); for (let i = 0; i < 6; i++) setTimeout(() => fx.bubbles(S.w * (0.1 + Math.random() * 0.8), S.dh - 10, 6, 80), i * 120); };
  const pet = (x: number, y: number) => { sfx.bark(); fx.sparkle(x, y, 14, 90); floatText(x, y - 16, `${gi('heart')} boof!`, '#ffc4e4'); };

  // ---- start menu
  const startMenu = () => {
    if (pops.some(p => p.anchor === orb)) { closePops(); return; }
    const m = el('div', 'mos-start');
    const l = el('div', 'l'), r = el('div', 'r');
    m.append(l, r);
    for (const [id, name, ic] of desk) {
      if (!iconEls[id]) continue;
      const mi = el('div', 'mi ctl');
      mi.appendChild(ico(ic, 1));
      mi.appendChild(el('span', '', name.replace('Spread-sheets', 'Spreadsheets').replace('Encyclo-pedia', 'Encyclopedia').replace('Upload All', 'Upload Everything').replace('Jenna-Shell', 'JennaShell')));
      if (isFresh(id)) mi.appendChild(el('i', 'nw', 'NEW'));
      mi.addEventListener('click', () => { closePops(); lastPress = center(orb); openApp(id); });
      l.appendChild(mi);
    }
    const av = el('div', 'av');
    av.appendChild(icon('pug', 2));
    r.append(av, el('div', 'nm', 'Mori'));
    for (const [label, id] of [['Documents', 'files'], ['Pictures', 'photos'], ['Encyclopedia', 'enc'], ['ZEA Mail', 'mail'], ['Games', 'plankton'], ['Blow bubbles', '*b'], ['Pet Chunk', '*p']] as const) {
      if (id[0] !== '*' && !iconEls[id]) continue;
      const mi = el('div', 'mi ctl', label);
      mi.addEventListener('click', () => { closePops(); if (id === '*b') blow(); else if (id === '*p') { const c = center(orb); pet(c.x + 20, c.y - 30); } else { lastPress = center(orb); openApp(id); } });
      r.appendChild(mi);
    }
    r.appendChild(el('div', 'sp'));
    const pw = el('div', 'gel red sm ctl', `${gi('power')} Close lid`);
    pw.addEventListener('click', () => finish());
    r.appendChild(pw);
    openPop(m, 4, 0, { anchor: orb, bottom: true });
    orb.classList.add('on');
  };
  orb.addEventListener('click', startMenu);
  peek.addEventListener('click', () => {
    const vis = visibleWins();
    if (vis.length) vis.forEach(minimize); else open.filter(w => w.min && !w.closing).forEach(restore);
  });

  // ---- global pointer feedback: squish, pop, ripple; clicking bubbles on the desktop
  let pressed: Element[] = [];
  let bubCombo = 0, bubT = 0;
  const isDesk = (t: Element) => t === scr || t === iconsEl || !!t.closest('.mos-bg');
  wrap.addEventListener('pointerdown', e => {
    const t = e.target as Element;
    const p = scrPt(e.clientX, e.clientY);
    lastPress = p;
    if (pops.length && !t.closest('.mos-pop') && !pops.some(pp => pp.anchor && pp.anchor.contains(t))) closePops();
    const c = t.closest('.ctl');
    if (c) { c.classList.add('press'); pressed.push(c); sfx.press(); }
    if (p.x >= 0 && p.y >= 0 && p.x <= S.w && p.y <= S.h && e.button === 0) fx.ring(p.x, p.y);
    if (isDesk(t) && e.button === 0) {
      iconsEl.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
      if (fx.popAt(p.x, p.y)) { const now = performance.now(); bubCombo = now - bubT < 1500 ? bubCombo + 1 : 0; bubT = now; sfx.pop(bubCombo); fx.sparkle(p.x, p.y, 6, 60); if (bubCombo >= 2) floatText(p.x, p.y - 12, 'x' + (bubCombo + 1)); }
    }
  }, true);
  const release = () => { pressed.forEach(c => c.classList.remove('press')); pressed = []; };
  wrap.addEventListener('pointerup', release, true);
  wrap.addEventListener('pointercancel', release, true);
  wrap.addEventListener('dragstart', e => e.preventDefault());
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    const t = e.target as Element;
    const p = scrPt(e.clientX, e.clientY);
    const w = t.closest('.mos-win'), ic = t.closest('.mos-ic'), tab = t.closest('.mos-tab');
    if (t.closest('.mos-pop')) return;
    if (ic) {
      const id = Object.keys(iconEls).find(k => iconEls[k] === ic)!;
      menu(p.x, p.y, [['Open', desk.find(d => d[0] === id)?.[2] ?? null, () => launch(id, ic)], ['Refresh', null, refresh]]);
    } else if (w || tab) {
      const W = open.find(x => x.el === w || x.tab === tab);
      if (!W) return;
      menu(p.x, p.y, [
        [W.min ? 'Restore' : 'Minimise', null, () => (W.min ? restore(W) : minimize(W))],
        [W.max ? 'Restore size' : 'Maximise', null, () => toggleMax(W)],
        '-', ['Close', null, () => closeWin(W)],
      ]);
    } else if (t.closest('.mos-scr') && !t.closest('.mos-bar')) {
      menu(p.x, p.y, [['Blow bubbles', 'bubbles', blow], ['Refresh', null, refresh], ['Pet Chunk', 'pug', () => pet(p.x, p.y)], '-', ['Close lid', null, () => finish()]]);
    }
  });

  // ---- keyboard: Esc closes, Tab / arrows move a focus glow, Enter or Space clicks
  let navCur: HTMLElement | null = null, navBack: HTMLElement | null = null;
  const fr = { x: new Spring(0, 420, 30), y: new Spring(0, 420, 30), w: new Spring(0, 420, 30), h: new Spring(0, 420, 30) };
  const hit = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!h && (h === e || e.contains(h) || h.closest('.ctl') === e);
  };
  const navList = (): HTMLElement[] => {
    if (pops.length) return [...pops[pops.length - 1].el.querySelectorAll<HTMLElement>('.ctl')];
    const aw = active && !active.min && !active.minning ? active : null;
    const inWin = aw ? [...aw.bd.querySelectorAll<HTMLElement>('.ctl'), ...aw.el.querySelectorAll<HTMLElement>('.tb .ctl')].filter(e => e.offsetParent !== null) : [];
    const rest = [...iconsEl.querySelectorAll<HTMLElement>('.ctl'), ...bar.querySelectorAll<HTMLElement>('.ctl'), lid].filter(hit);
    return [...inWin, ...rest];
  };
  const setNav = (e: HTMLElement | null) => {
    navCur = e;
    if (!e) return;
    if (!ringOn) { const r = e.getBoundingClientRect(), s = scrPt(r.left, r.top); fr.x.snap(s.x); fr.y.snap(s.y); fr.w.snap(r.width); fr.h.snap(r.height); }
    ringOn = true;
    ring.classList.add('on');
    e.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (hovEl !== e) { hovEl?.classList.remove('hov'); hovEl = e; e.classList.add('hov'); if (e.classList.contains('mos-ic')) sfx.hover(); }
    sfx.tick(3);
  };
  const activate = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    const init: PointerEventInit = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 78, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, view: window };
    e.dispatchEvent(new PointerEvent('pointerdown', init));
    e.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    e.dispatchEvent(new MouseEvent('click', init));
    if (e instanceof HTMLInputElement) e.focus();
    if (!ringOn) return;
    const n = navCur;
    const stale = !n || !n.isConnected || !!n.closest('.mos-pop.bye') || open.some(w => w.closing && w.el.contains(n));
    setNav(stale ? navList()[0] ?? null : n);
  };
  const navDir = (dx: number, dy: number) => {
    const list = navList();
    if (!navCur || !list.includes(navCur)) { setNav(list[0] ?? null); return; }
    const a = navCur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null, bs = 1e9;
    for (const e of list) {
      if (e === navCur) continue;
      const r = e.getBoundingClientRect(), vx = r.left + r.width / 2 - ax, vy = r.top + r.height / 2 - ay;
      const along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const s = along + Math.abs(vx * dy - vy * dx) * 2.5;
      if (s < bs) { bs = s; best = e; }
    }
    if (best) setNav(best); else if (navCur) retrigger(navCur, 'mos-wiggle');
  };
  const kd = (e: KeyboardEvent) => {
    // a book lifted out over the laptop (the Encyclopedia) has the keyboard
    if (bookOpen()) return;
    const inText = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.code === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (pops.length) { closePops(); if (navCur && ringOn) setNav(navCur); }
      else if (inText) (e.target as HTMLElement).blur();
      else finish();
      return;
    }
    if (inText && e.code !== 'Tab') return;
    if (numActive && /^(Digit|Numpad)\d$/.test(e.code)) { numActive.type(e.code.slice(-1)); e.preventDefault(); e.stopPropagation(); return; }
    if (numActive && e.code === 'Backspace') { numActive.type('back'); e.preventDefault(); e.stopPropagation(); return; }
    if (!pops.length && active?.onKey?.(e)) { e.preventDefault(); e.stopPropagation(); return; }
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.code === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (inText) (e.target as HTMLElement).blur();
      const list = navList();
      if (!list.length) return;
      const i = navCur ? list.indexOf(navCur) : -1;
      setNav(list[(i < 0 ? (e.shiftKey ? list.length - 1 : 0) : i + (e.shiftKey ? -1 : 1) + list.length) % list.length]);
    } else if (dir[e.code]) {
      e.preventDefault(); e.stopPropagation();
      navDir(...dir[e.code]);
    } else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && navCur && ringOn) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) activate(navCur);
    }
  };
  window.addEventListener('keydown', kd, true);

  // ---- resize
  const ro = new ResizeObserver(() => {
    scrR = null;
    cur.invalidate();
    measure();
    for (const W of open) {
      if (W.max) { W.w = S.w; W.h = S.dh; }
      else { W.w = Math.min(W.w, S.w - 8); W.h = Math.min(W.h, S.dh - 8); W.x = clamp(W.x, -W.w + 90, Math.max(0, S.w - 90)); W.y = clamp(W.y, 0, Math.max(0, S.dh - 28)); }
      place(W);
    }
  });
  ro.observe(scr);

  // ---- the frame loop
  let hovEl: Element | null = null;
  /** write a transform only when it changed (an unchanged string still costs a style recalc) */
  const tfs = new WeakMap<HTMLElement, string>();
  const setTf = (e: HTMLElement, t: string) => { if (tfs.get(e) !== t) { tfs.set(e, t); e.style.transform = t; } };
  let last = performance.now(), T = 0, clockT = 0;
  /** the wallpaper is out of sight under a maximised window: its clouds, flares and bubbles rest */
  let wallHidden = false;
  const frame = (now: number) => {
    if (closed) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now; T += dt;
    // the screen rect is re-read lazily once per frame (it only moves while the lid springs open)
    scrR = null;
    cur.update(dt);
    if (cur.hoverDirty) {
      cur.hoverDirty = false;
      const t = cur.target();
      const h = (t?.closest('.ctl, .hv') as HTMLElement | null) ?? null;
      if (h !== hovEl) {
        hovEl?.classList.remove('hov');
        h?.classList.add('hov');
        if (h && (h.classList.contains('mos-ic') || h.classList.contains('mos-orb') || (h.classList.contains('gel') && !h.closest('.kp')))) sfx.hover();
        hovEl = h;
      }
      cur.setLink(!!h && !h.classList.contains('hv'));
    }
    // parallax + clouds + flares (skipped while a maximised window hides the wallpaper)
    const hidden = open.some(W => W.max && !W.min && !W.minning && !W.closing && !W.anim);
    if (hidden !== wallHidden) { wallHidden = hidden; scr.classList.toggle('wallq', hidden); }
    if (!hidden) {
      const k = Math.min(1, dt * 3.5);
      par.x += (par.tx - par.x) * k; par.y += (par.ty - par.y) * k;
      const mx = (bgW - S.w) / 2, my = (bgH - S.h) / 2;
      setTf(bgEl, `translate(${(-mx - par.x * mx * 1.2).toFixed(1)}px,${(-my - par.y * my * 1.2).toFixed(1)}px)`);
      const px = bgW / 160;
      for (const c of clouds) {
        c.x += c.v * dt * 0.6;
        if (c.x > 168) c.x = -c.c.width - Math.random() * 20;
        setTf(c.c, `translate(${(c.x * px - par.x * 26 * c.d).toFixed(1)}px,${(c.y * px - par.y * 10 * c.d).toFixed(1)}px) scale(${px.toFixed(3)})`);
      }
      const sx0 = S.w * 0.03, sy0 = -S.h * 0.02, cx0 = S.w * (0.5 + par.x * 0.5), cy0 = S.h * (0.5 + par.y * 0.5);
      for (const f of flares) {
        const x = sx0 + (cx0 - sx0) * f.k, y = sy0 + (cy0 - sy0) * f.k;
        setTf(f.e, `translate(${(x - f.s / 2).toFixed(1)}px,${(y - f.s / 2).toFixed(1)}px)`);
        f.e.style.opacity = (0.55 + Math.sin(T * 0.7 + f.k * 5) * 0.25).toFixed(2);
      }
    }
    // windows
    for (const W of open.slice()) {
      for (const s of [W.sx, W.sy, W.tx, W.ty, W.rot]) s.step(dt);
      if (W.drag) W.rot.target *= Math.exp(-dt * 7);
      W.a += (W.aT - W.a) * Math.min(1, dt * (W.closing ? 14 : W.minning ? 7 : 12));
      if (W.closing && W.a < 0.04) { W.el.remove(); open = open.filter(x => x !== W); continue; }
      if (W.minning && (W.a < 0.04 || W.sx.x < 0.13)) {
        W.minning = false; W.min = true; W.el.style.display = 'none';
        for (const s of [W.sx, W.sy]) s.snap(1);
        for (const s of [W.tx, W.ty, W.rot]) s.snap(0);
        W.a = 0; W.anim = false; W.el.style.transform = ''; W.el.style.opacity = '';
        const t = tabCenter(W); fx.sparkle(t.x, t.y - 6, 6, 50); retrigger(W.tab, 'mos-wiggle');
        continue;
      }
      if (W.min) continue;
      const still = !W.drag && W.sx.rest() && W.sy.rest() && W.tx.rest(0.3) && W.ty.rest(0.3) && W.rot.rest(0.02) && Math.abs(W.a - W.aT) < 0.01;
      if (!still) {
        W.anim = true;
        W.el.style.transform = `translate(${W.tx.x.toFixed(2)}px,${W.ty.x.toFixed(2)}px) rotate(${W.rot.x.toFixed(3)}deg) scale(${W.sx.x.toFixed(4)},${W.sy.x.toFixed(4)})`;
        W.el.style.opacity = String(clamp(W.a, 0, 1));
      } else if (W.anim) {
        W.anim = false;
        for (const s of [W.sx, W.sy, W.tx, W.ty, W.rot]) s.snap();
        W.el.style.transform = ''; W.el.style.opacity = '';
      }
    }
    // focus glow
    if (ringOn && navCur) {
      if (!navCur.isConnected) { ringOn = false; ring.classList.remove('on'); }
      else {
        const r = navCur.getBoundingClientRect(), s = scrPt(r.left, r.top), kk = r.width / (navCur.offsetWidth || r.width || 1);
        fr.x.target = s.x - 3; fr.y.target = s.y - 3; fr.w.target = r.width / (kk || 1) + 6; fr.h.target = r.height / (kk || 1) + 6;
        for (const s2 of Object.values(fr)) s2.step(dt);
        ring.style.transform = `translate(${fr.x.x.toFixed(1)}px,${fr.y.x.toFixed(1)}px)`;
        ring.style.width = fr.w.x.toFixed(1) + 'px'; ring.style.height = fr.h.x.toFixed(1) + 'px';
      }
    }
    for (const f of [...anims]) if (!f(dt)) anims.delete(f);
    fx.step(dt, !wallHidden, S.dh);
    fx.draw();
    clockT -= dt;
    if (clockT <= 0) {
      clockT = 0.25;
      const { h, m } = gameClock();
      clk.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (gad.offsetParent) drawClock();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // open the report straight away when it is due
  const reportDue = o.report && !game.save.flags['v4:report'];
  if (reportDue) {
    setTimeout(() => { if (closed) return; lastPress = center(iconEls.sheet); apps.sheet(); }, 450);
    setTimeout(() => { if (closed) return; lastPress = center(iconEls.report); apps.report(); balloon('Morning report due', 'Fill it in from the survey spreadsheet, then send it.'); }, 650);
  }
  // the camera plugs in: its icon hops, the tray lights up and a balloon offers the import (at camp
  // with specimens or field notes too: Upload Everything)
  // (Tua's welcome waits until ZEA Mail is installed: it's sent by the download)
  const welcomed = installed('mail') ? MAIL.welcome() : null;
  badges();
  // newly unlocked apps start downloading once the desktop has settled
  setTimeout(() => { if (closed) return; unlocksOn = true; checkUnlocks(); }, reportDue ? 4000 : 1100);
  const pend = pendingCount();
  const nItems = atCamp() ? handInCount() : 0, nNotes = pendingNotes().length;
  if (o.app && !reportDue) setTimeout(() => { if (!closed) { lastPress = center(iconEls[o.app!] ?? orb); openApp(o.app!); } }, 520);
  if (pend || nItems || nNotes) {
    setTimeout(() => {
      if (closed) return;
      if (pend) {
        const ci = iconEls.cam ?? iconEls.upall;
        retrigger(ci, 'pop');
        ci.classList.add('plug');
        const c = center(ci);
        fx.sparkle(c.x, c.y - 10, 14, 90); fx.bubbles(c.x, c.y, 8, 50); fx.ring(c.x, c.y - 8, 'rgba(160,255,200,0.95)', 60);
        sfx.beep(); setTimeout(() => sfx.pick(), 160);
      }
      if (nItems || nNotes) { const ui = iconEls.upall; if (ui) { retrigger(ui, 'pop'); const c = center(ui); fx.sparkle(c.x, c.y - 10, 12, 80); } }
      if ((reportDue && bal) || o.app) return;
      if (nItems || nNotes) {
        const parts = [pend ? `${pend} photo${pend === 1 ? '' : 's'}` : '', nItems ? `${nItems} specimen${nItems === 1 ? '' : 's'}` : '', nNotes ? `${nNotes} field note${nNotes === 1 ? '' : 's'}` : ''].filter(Boolean);
        balloon(atCamp() && field ? 'Back at camp' : 'Ready to upload', `<b>${parts.join(', ')}</b> to upload. Click here to upload everything in one go.`, 9000, { icon: 'upall', onClick: () => UP.open() });
      } else balloon('Camera connected', `<b>${pend} new photo${pend === 1 ? '' : 's'}</b> on the ZX-7. Click here to upload ${pend === 1 ? 'it' : 'them'}.`, 9000, { icon: 'cam', onClick: () => openApp(installed('cam') ? 'cam' : 'upall') });
    }, reportDue ? 9000 : 800);
  } else if (field && opens === 1) {
    setTimeout(() => { if (!closed) balloon('It boots!', `Sand in the hinges, ${batt}% battery, and every file survived. The camera plugs in here when you have photos to upload.`, 8000); }, 900);
  }
  // agency mail waiting
  const um = installed('mail') ? unreadMail() : 0;
  if (um && !o.app) setTimeout(() => {
    if (closed || bal) return;
    balloon('ZEA Mail', welcomed ? 'A message from the Zealandia Expedition Agency, the people who sent the expedition. (Tua says hi.)' : `<b>${um} unread message${um === 1 ? '' : 's'}</b> from the agency.`, 7000, { icon: 'mail', onClick: () => openApp('mail') });
  }, reportDue ? 20000 : pend || nItems || nNotes ? 10500 : field && opens === 1 ? 9500 : 1600);
  lid.addEventListener('click', () => finish());

  await new Promise<void>(res => { finish = () => { finish = () => {}; res(); }; });
  closed = true;
  game.covered = Math.max(0, game.covered - 1);
  window.removeEventListener('keydown', kd, true);
  ro.disconnect();
  cur.destroy();
  lap.style.animation = 'none';
  lap.style.transition = 'transform 0.28s cubic-bezier(.5,0,.8,.4), opacity 0.28s';
  lap.style.transform = 'perspective(900px) rotateX(-58deg) scale(0.9, 0.5)';
  lap.style.opacity = '0';
  wrap.classList.add('bye');
  game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
  sfx.close();
  setTimeout(() => wrap.remove(), 300);
  guardInput(300);
}

/** today's real photos for the report: camera roll and uploads, newest first; bird = a usable seabird in it */
function reportPhotos(): { img: string; bird: boolean }[] {
  const bird = (sp: string) => SPECIES_BY_ID[sp]?.group === 'Bird';
  const day = game.save.day;
  const out: { img: string; bird: boolean; t: number }[] = [];
  for (const p of rawPhotos()) if (p.day === day && !p.video) out.push({ img: p.img, t: p.id, bird: p.subjects.some(x => bird(x.species) && x.visible > 0.4 && x.inFrame > 0.4 && x.focus > 0.35) });
  for (const u of game.save.uploads ?? []) if (u.day === day && !u.video) out.push({ img: u.img, t: u.id, bird: u.subjects.some(x => bird(x.species) && x.ok) });
  out.sort((a, b) => b.t - a.t);
  // keep at least one bird shot in the choice even if it's older
  const pick = out.slice(0, 5);
  const b = out.find(x => x.bird);
  if (b && !pick.includes(b)) pick[pick.length - 1] = b;
  return pick;
}
