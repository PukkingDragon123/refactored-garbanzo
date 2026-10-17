// V11 HUD, pixel art in the spirit of Dave the Diver: chunky, present, readable, every piece a small
// canvas painted in art pixels and shown at 3x (2x on phones), so nothing is ever smooth.
//   top left    Mori's status plate (bodyhud.ts): his medallion, the stamina flask and its number,
//               the pack's spring scale, ailment chips
//   top right   the research points on an ink-stamp counter that ticks up (a "+15 RP" stamp slams
//               down when points come in), the sun-and-moon dial with the time and the day, and the
//               quest note: a scrap of Mori's journal pinned under them with the current step in his
//               pixel handwriting. When a step is done it's ticked and struck through in ink, pixel
//               by pixel, then the next one is written in. After a while it rolls up to its title
//               strip; hover it (or tap) to unroll it, click it to open the field journal (J).
//   top centre  a banner with the place name when you walk somewhere new
//   bottom left the kit: the backpack with a fill gauge, the field laptop with its upload badge,
//               the instant camera with the film count and the print developing out of its slot
//   bottom      the controls line for the first seconds of a scene
// The API is the V2 Hud2 one (setPlace, setKeys, setLaptop, show, refresh, update, flyItem, banner,
// packPos, bumpPack, destroy), so every scene keeps working.

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { trackedQuest, currentStepIndex, setQuestNotice } from '../game/quests';
import type { QuestDef } from '../game/quests';
import { capacity } from '../game/inventory';
import { itemIconURL, uiIconURL } from '../art/itemicons';
import { mountBodyHud, BodyHud } from './v10/bodyhud';
import { installPaper, scrap, stamp, paperSfx, escHtml as esc, setTransitionFocus, rasterStrokes, tick, strike, paperTileArt } from './v11/paper';
import { Art, col, dith, shadeC, mixC, spriteURL, PX } from './v11/paper/px';
import { drawText, wrapText } from './v11/paper/pxfont';
import { PxW, outlined, tw, plate, hudScale } from './v11/hudpx';
import { hudHour, paintDial } from './v11/hudclock';

const OUT = col('#140c06'), CREAM = col('#fff1cc'), INKC = col('#2a2440'), PENC = col('#6a6458');

/** a keycap, a manila tag and a paper slip as 9-slice sprites (2 CSS px per art pixel) */
const keycapURL = () => spriteURL('hud:keycap', 8, 10, a => {
  plate(a, 0, 0, 8, 9, col('#f2e4bc'), { r: 1, shadow: false });
  a.rect(1, 7, 6, 1, col('#b89c68')); a.rect(0, 9, 8, 1, col('#140c06', 0.5));
});
const tagURL = () => spriteURL('hud:tag', 22, 14, a => {
  const H = 12, base = col('#e8cc92'), dk = col('#c8a464');
  for (let y = 0; y < H; y++) for (let x = 0; x < 20; x++) {
    const notch = Math.abs(y - 5.5);
    if (x < Math.floor(notch) - 1) continue;
    const edge = x === Math.max(0, Math.floor(notch) - 1) || y === 0 || y === H - 1 || x === 19;
    a.put(x, y, edge ? OUT : y >= H - 3 ? dk : base);
  }
  a.ellipse(6, 6, 1.6, 1.6, col('#3a2614'));
  for (let y = 2; y < H + 2; y++) for (let x = 2; x < 22; x++) if (!(a.get(x, y) >>> 24) && (a.get(x - 2, y - 2) >>> 24) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.4));
});
const slipURL = () => spriteURL('hud:slip', 16, 16, a => {
  const tile = paperTileArt('card');
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) a.put(x, y, mixC(col('#f6eed8'), tile.d[y * 128 + x], 0.3));
  for (let i = 0; i < 14; i++) { a.put(i, 0, OUT); a.put(i, 13, OUT); a.put(0, i, OUT); a.put(13, i, OUT); }
  a.put(0, 0, 0); a.put(13, 0, 0); a.put(0, 13, 0); a.put(13, 13, 0);
  for (let i = 1; i < 13; i++) a.put(i, 12, col('#d8c8a0'));
  for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) if (!(a.get(x, y) >>> 24) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.38));
});

const CSS = `
.h2 { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s steps(4); }
.h2.off { opacity: 0; }
.h2 canvas.hx { display: block; image-rendering: pixelated; }
/* top right: the stamp counter and the dial, the quest note under them */
.h2 .hr { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.h2 .hr .row { display: flex; align-items: flex-start; gap: 6px; }
.h2 .hr .rp { pointer-events: auto; cursor: help; }
.h2 .hr .rp.pop { animation: hxPop 0.36s steps(6); }
@keyframes hxPop { 30% { transform: translateY(-6px) scale(1.12); } 60% { transform: translateY(2px); } }
.h2 .hr .dial.off { display: none; }
.h2 .hq { position: relative; pointer-events: auto; cursor: pointer; }
.h2 .hq.off { display: none; }
.h2 .hq.slide { animation: hxSlide 0.4s steps(6); }
@keyframes hxSlide { from { transform: translateY(-40px); opacity: 0; } }
.h2 .hq .new-q { position: absolute; right: -8px; top: -14px; pointer-events: none; }
.h2 .hq-plus { position: absolute; pointer-events: none; z-index: 3; animation: hxPlus 2.2s steps(22) forwards; }
@keyframes hxPlus { 0% { transform: translateY(8px); opacity: 0; } 12% { transform: none; opacity: 1; } 75% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
/* the place banner */
.h2 .hb { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); pointer-events: none; }
.h2 .hb.off { display: none; }
.h2 .hb.in { animation: hxDrop 0.5s steps(7) both; }
.h2 .hb.out { animation: hxRise 0.45s steps(6) forwards; }
@keyframes hxDrop { 0% { transform: translate(-50%, -120%); } 60% { transform: translate(-50%, 8px); } 100% { transform: translate(-50%, 0); } }
@keyframes hxRise { to { transform: translate(-50%, -140%); } }
/* the kit in the bottom corner */
.h2 .hk { position: absolute; left: 10px; bottom: 10px; pointer-events: auto; cursor: pointer; }
.h2 .hk.bump { animation: hxPop 0.36s steps(6); }
body.touchmode .h2 .hk { pointer-events: none; bottom: auto; top: 168px; left: 6px; }
body.touchmode .h2 .hr { right: 6px; top: 6px; }
/* the controls line */
.hm-keys { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); white-space: nowrap; transition: opacity 1.2s steps(6); opacity: 0.95;
  font-family: var(--pp-head); font-size: 18.6667px; line-height: 24px; color: #fff1cc; letter-spacing: 1px;
  text-shadow: 2px 0 0 #140c06, -2px 0 0 #140c06, 0 2px 0 #140c06, 0 -2px 0 #140c06, 2px 2px 0 #140c06, -2px 2px 0 #140c06, 2px -2px 0 #140c06, -2px -2px 0 #140c06; }
#ui .hm-keys, #ui .hm-keys * { font-size-adjust: none; }
.hm-keys.gone { opacity: 0; }
#ui .hm-keys .key { display: inline-block; min-width: 24px; margin: 0 4px 0 8px !important; padding: 0 5px 2px !important; font-family: var(--pp-label) !important; font-size: 16px !important; line-height: 18px; color: #3a2614 !important;
  background: none !important; box-shadow: none !important; text-shadow: none; border-style: solid; border-width: 4px 4px 6px; border-image: var(--hx-key) 4 4 6 fill / 4px 4px 6px stretch; image-rendering: pixelated; }
body.touchmode .hm-keys { display: none; }
/* the big stamped note */
.hm-ban { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); pointer-events: none; z-index: 4; text-align: center; animation: hxBan 3.4s steps(34) both; }
.hm-ban .pp-scrap-in { padding: 18px 30px 20px; }
.hm-ban .s { font-size: 20px; line-height: 24px; margin-top: 10px; max-width: 520px; color: var(--pp-ink); }
@keyframes hxBan { 0% { opacity: 0; transform: translate(-50%, -30px); } 8% { opacity: 1; transform: translate(-50%, 0); } 88% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -12px); } }
.flyitem { position: absolute; width: 48px; height: 48px; image-rendering: pixelated; pointer-events: none; z-index: 9; filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.4)); }
.pickup { position: absolute; transform: translate(-50%, -100%); font-family: var(--pp-hand); font-size: 20px; line-height: 24px; font-weight: 700; color: #fff6dc; pointer-events: none; white-space: nowrap;
  text-shadow: 2px 0 0 #140c06, -2px 0 0 #140c06, 0 2px 0 #140c06, 0 -2px 0 #140c06, 2px 2px 0 #140c06, -2px 2px 0 #140c06, 2px -2px 0 #140c06, -2px -2px 0 #140c06; animation: pickupRise 1.3s steps(16) forwards; }
#ui .pickup { font-size-adjust: none; }
@keyframes pickupRise { 0% { opacity: 0; transform: translate(-50%, -60%); } 15% { opacity: 1; transform: translate(-50%, -120%); } 100% { opacity: 0; transform: translate(-50%, -300%); } }
/* the interaction prompt: a manila tag */
#ui .prompt.panel { border: 0 !important; border-image: none !important; box-shadow: none !important; background: none !important; clip-path: none !important; animation: hxBob 1.2s steps(2) infinite;
  border-style: solid !important; border-width: 4px 6px 6px 18px !important; border-image: var(--hx-tag) 4 6 6 18 fill / 4px 6px 6px 18px stretch !important; image-rendering: pixelated;
  padding: 0 6px 0 2px; color: #3a2614; font-family: var(--pp-hand); font-size: 20px; line-height: 24px; font-weight: 400; }
#ui .prompt.panel, #ui .prompt.panel * { font-size-adjust: none; -webkit-font-smoothing: none; }
@keyframes hxBob { 50% { margin-top: -4px; } }
#ui .prompt.panel .key { font-family: var(--pp-label) !important; font-size: 16px !important; line-height: 16px; padding: 0 4px 2px !important; margin: 0 6px 0 0 !important; vertical-align: 1px; color: #3a2614 !important;
  background: none !important; box-shadow: none !important; border-style: solid; border-width: 4px 4px 6px; border-image: var(--hx-key) 4 4 6 fill / 4px 4px 6px stretch; }
/* toasts: little paper slips */
#ui .toast.panel { border: 0 !important; box-shadow: none !important; background: none !important; clip-path: none !important;
  border-style: solid !important; border-width: 8px !important; border-image: var(--hx-slip) 8 fill / 8px / 0 repeat !important; image-rendering: pixelated;
  color: var(--pp-ink); font-family: var(--pp-hand); font-size: 20px; line-height: 24px; padding: 2px 8px 4px; animation: hxToast 0.35s steps(5); }
#ui .toast.panel.out { animation: hxToastOut 0.4s steps(5) forwards; }
@keyframes hxToast { from { transform: translateX(40px); opacity: 0; } }
@keyframes hxToastOut { to { transform: translateX(40px); opacity: 0; } }
#ui .toast.panel, #ui .toast.panel * { font-size-adjust: none; -webkit-font-smoothing: none; }
#ui .toast.panel .ic { font-family: var(--pp-label) !important; font-size: 16px !important; line-height: 18px; padding: 2px 6px !important; color: #fff1cc !important; background: #a8321e !important; box-shadow: 0 0 0 2px #140c06 !important; transform: none; }
#ui .toast.panel.teal .ic { background: #26408a !important; }
#ui .toast.panel.coral .ic { background: #c8321e !important; }
#ui .toast.panel b { color: #2a2440; font-weight: 700; }
/* the region-map button from the expedition runtime: a folded map in the corner */
#ui .v10-mapb { left: 10px; top: auto; bottom: 110px; padding: 0 8px 0 0; background: none; box-shadow: none; opacity: 0.9; }
#ui .v10-mapb:hover { opacity: 1; transform: translateY(-2px); }
#ui .v10-mapb i { background: none; }
#ui .v10-mapb .k { display: none; }
#ui .v10-mapb .t { font-family: var(--pp-label); font-size-adjust: none; font-size: 16px; color: #fff1cc; text-transform: uppercase;
  text-shadow: 2px 0 0 #140c06, -2px 0 0 #140c06, 0 2px 0 #140c06, 0 -2px 0 #140c06; }
body.touchmode #ui .v10-mapb { bottom: auto; top: 230px; left: 6px; }
`;

let styled = false;

/** the island's field laptop on the belt (see game/v9/research9.ts) */
export interface HudLaptop {
  shown: () => boolean;
  /** photos waiting on the camera */
  badge: () => number;
  open: () => void;
}

/** 16x16 pixel laptop (lid up, aqua screen) */
const LAP_ROWS = [
  '................', '................', '..kkkkkkkkkkkk..', '..kTTTTTTTTTTk..', '..kTjCCCCCCcTk..', '..kTCjCCCCCcTk..', '..kTCCCCCCccTk..', '..kTCCGGCcccTk..',
  '..kTGGGGGGGGTk..', '..kTTTTTTTTTTk..', '.kkkkkkkkkkkkkk.', 'kqqqqqqqqqqqqqqk', 'kTqTqTqTqTqTqTqk', 'kTTTTTTKKTTTTTTk', '.kkkkkkkkkkkkkk.', '................',
];
const LAP_COL: Record<string, string> = { k: '#0b0f12', T: '#7a8189', q: '#b9c0c4', K: '#454b53', C: '#3fd1c1', c: '#138a86', j: '#eafffb', G: '#6fb150' };
let lapArt: Art | null = null;
function laptopArt(): Art {
  if (lapArt) return lapArt;
  const a = new Art(16, 16);
  LAP_ROWS.forEach((r, y) => { for (let x = 0; x < 16; x++) { const v = LAP_COL[r[x]]; if (v) a.put(x, y, col(v)); } });
  return (lapArt = a);
}
/** an image URL loaded into a paint buffer (null until it's loaded) */
const imgArts = new Map<string, Art | null>();
function imgArt(url: string): Art | null {
  if (imgArts.has(url)) return imgArts.get(url)!;
  imgArts.set(url, null);
  const im = new Image();
  im.onload = () => imgArts.set(url, Art.from(im));
  im.src = url;
  return null;
}

export interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}

type CamLike = { active?: boolean; shots?: number; develop?: number; v10?: boolean; developLeft?(): number };
type SceneLike = { player?: { x: number; y: number; vx?: number; body?: { showEmote?(e: string, t?: number): void } }; cutscene?: boolean; st?: { cam: { x: number; y: number; zoom: number } }; cam?: CamLike } | null;

interface NoteRow { text: string; state: 'todo' | 'done'; tick: number; strike: number; reveal: number; seed: number; old?: boolean }

export class Hud2 {
  readonly root: HTMLElement;
  private hr: HTMLElement;
  private rpW: PxW;
  private dialW: PxW;
  private noteBox: HTMLElement;
  private noteW: PxW;
  private banW: PxW;
  private kitW: PxW;
  private keys: HTMLElement;
  private lap: HudLaptop | null = null;
  private body: BodyHud | null = null;
  private onBackpack?: () => void;
  // the quest note
  private lastKey = '';
  private lastQuest = '';
  private lastStep = -1;
  private noteQ: QuestDef | null = null;
  private rows: NoteRow[] = [];
  private openT = 0;
  private hover = false;
  private holdT = 0;
  private swapT: ReturnType<typeof setTimeout>[] = [];
  private noteDirty = true;
  // the stamp counter
  private rpShown = 0;
  private lastRp = -1;
  private rpTickT = 0;
  // the place banner
  private placeName = '';
  private placeSub = '';
  private dayShown = -1;
  private banT = 0;
  // misc
  private keysT = 7;
  private moved = false;
  private idleT = 0;
  private t = 0;
  private acc = 0;
  private bannerT = 0;
  private kitRegions: { id: 'pack' | 'lap' | 'cam'; x0: number; x1: number }[] = [];
  private packFill = 0;
  private bump = 0;

  constructor(parent: HTMLElement, o: HudOpts) {
    installPaper();
    if (!styled) {
      styled = true;
      document.head.appendChild(el('style', '', CSS));
      const r = document.documentElement.style;
      r.setProperty('--hx-key', `url(${keycapURL()})`);
      r.setProperty('--hx-tag', `url(${tagURL()})`);
      r.setProperty('--hx-slip', `url(${slipURL()})`);
    }
    this.onBackpack = o.onBackpack;
    this.root = parent.appendChild(el('div', 'h2'));
    this.body = mountBodyHud(this.root);
    // top right
    this.hr = this.root.appendChild(el('div', 'hr'));
    const row = this.hr.appendChild(el('div', 'row'));
    this.rpW = new PxW(row, 'rp');
    this.rpW.el.title = 'Research points';
    this.dialW = new PxW(row, 'dial');
    this.noteBox = this.hr.appendChild(el('div', 'hq off'));
    this.noteW = new PxW(this.noteBox, 'note');
    this.noteBox.addEventListener('click', e => { e.stopPropagation(); if (this.openT <= 0 && document.body.classList.contains('touchmode')) { this.reveal(6); return; } this.openJournal(); });
    this.noteBox.addEventListener('pointerenter', () => { this.hover = true; this.noteDirty = true; });
    this.noteBox.addEventListener('pointerleave', () => { this.hover = false; this.noteDirty = true; });
    this.noteBox.title = 'What am I doing? (J opens the journal)';
    // the banner, the kit, the controls line
    const banBox = this.root.appendChild(el('div', 'hb off'));
    this.banW = new PxW(banBox, 'ban');
    this.kitW = new PxW(this.root, 'hk');
    this.kitW.el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const [x] = this.kitW.hit(e);
      const r = this.kitRegions.find(k => x >= k.x0 && x < k.x1);
      if (r?.id === 'pack') this.onBackpack?.();
      else if (r?.id === 'lap') this.lap?.open();
    });
    this.keys = this.root.appendChild(el('div', 'hm-keys'));
    this.setPlace(o.place, o.sub);
    this.keys.innerHTML = o.keys ?? '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> use · <span class="key">I</span> pack · <span class="key">J</span> journal';
    if (!/journal/.test(this.keys.innerHTML)) this.keys.innerHTML += ' · <span class="key">J</span> journal';
    setQuestNotice(q => this.noticeQuest(q));
    // transitions centre their iris / first ink blot on Mori
    setTransitionFocus(() => {
      const s = game.scene as SceneLike;
      const p = s?.player, c = s?.st?.cam;
      if (!p || !c) return null;
      const r = game.r;
      return [Math.max(0, Math.min(1, r.projectX(p.x, 1) / r.VW)), Math.max(0, Math.min(1, r.projectY(p.y - 20, 1) / r.VH))];
    });
    this.lastRp = game.save.rp;
    this.rpShown = game.save.rp;
    this.refresh(true);
    // a fresh scene: show what we're doing for a few seconds
    this.reveal(6);
    this.paint(true);
  }

  // ---------------------------------------------------------------- API
  setPlace(place: string, sub = '') {
    const day = game.save.day || 1;
    // only a new place (or a new day) gets the banner; the time of day is the dial's job
    if (place === this.placeName && day === this.dayShown) return;
    const firstOfDay = day !== this.dayShown;
    this.placeName = place;
    this.dayShown = day;
    this.placeSub = firstOfDay && /day/i.test(sub) ? `DAY ${day}` : '';
    this.banT = 4.2;
    const box = this.banW.el.parentElement!;
    box.classList.remove('off', 'out', 'in');
    void box.offsetWidth;
    box.classList.add('in');
    this.paintBanner();
  }
  setKeys(html: string) {
    this.keys.innerHTML = html;
    this.keys.classList.remove('gone');
    this.keysT = 6;
  }
  /** put the field laptop in the corner kit (null removes it); L opens it too */
  setLaptop(l: HudLaptop | null) { this.lap = l; this.refresh(); }
  show(on: boolean) { this.root.classList.toggle('off', !on); }

  /** backpack screen position (for flying pickups), relative to the UI root */
  packPos(): [number, number] {
    const r = this.kitW.el.getBoundingClientRect(), p = game.ui.root.getBoundingClientRect();
    if (!r.width) return [p.width * 0.06, p.height * 0.92];
    const s = this.kitW.s || hudScale();
    return [r.left - p.left + 11 * s, r.top - p.top + 18 * s];
  }
  bumpPack() {
    this.bump = 0.3;
    this.kitW.el.classList.remove('bump');
    void this.kitW.el.offsetWidth;
    this.kitW.el.classList.add('bump');
  }

  /** big stamped note in the middle of the screen (a new place on the map...) */
  banner(title: string, sub = '') {
    const now = performance.now();
    if (now - this.bannerT < 600) return;
    this.bannerT = now;
    const b = el('div', 'hm-ban', scrap(`${stamp(title, { color: 'red', fresh: true, size: 'lg' })}${sub ? `<div class="s pp-hand">${esc(sub)}</div>` : ''}`, { kind: 'card', seed: title.length, edges: { top: 'deckle', bottom: 'torn', left: 'deckle', right: 'deckle' } }));
    this.root.appendChild(b);
    setTimeout(() => paperSfx('stamp'), 140);
    setTimeout(() => b.remove(), 3500);
  }

  refresh(force = false) {
    const q = trackedQuest();
    let key = 'none';
    if (q) {
      const i = currentStepIndex(q);
      const pr = q.steps[i]?.progress?.();
      key = `${q.id}:${i}:${pr ? pr.join('/') : ''}`;
      if (key !== this.lastKey || force) {
        const sameQuest = q.id === this.lastQuest;
        const advanced = sameQuest && i > this.lastStep && this.lastStep >= 0;
        if (advanced) this.tickAndWrite(q, this.lastStep, i);
        else this.drawNote(q, i, !sameQuest && this.lastQuest !== '' && !force);
        if (!force && this.lastKey !== '' && (advanced || !sameQuest)) this.reveal(8);
        else if (!force && this.lastKey !== '') this.reveal(4);
        this.lastQuest = q.id;
        this.lastStep = i;
      }
    } else if (this.lastKey !== 'none') { this.noteQ = null; this.rows = []; this.lastQuest = ''; this.lastStep = -1; this.noteDirty = true; }
    this.lastKey = key;
    this.noteBox.classList.toggle('off', !this.noteQ);
  }

  update(dt: number) {
    this.t += dt;
    const s = game.save;
    const sc = game.scene as SceneLike;
    const inp = game.input;
    const free = !game.ui.blocking && !sc?.cutscene;
    // research points: the counter ticks up, a stamp slams down
    if (s.rp > this.lastRp && this.lastRp >= 0) this.rpGain(s.rp - this.lastRp);
    this.lastRp = s.rp;
    if (this.rpShown !== s.rp) {
      this.rpTickT -= dt;
      if (this.rpTickT <= 0) {
        const d = s.rp - this.rpShown;
        this.rpShown += Math.sign(d) * Math.max(1, Math.floor(Math.abs(d) / 6));
        this.rpTickT = 0.045;
        if (Math.random() < 0.5) audio.play('ui', { vol: 0.08, pitch: 1.8 });
      }
    }
    // keys: J journal, G encyclopedia, L laptop
    if (free && inp.keyHit('KeyJ')) this.openJournal();
    if (free && inp.keyHit('KeyG')) void this.openEncyclopedia();
    if (this.lap && inp.keyHit('KeyL') && free && this.lap.shown()) this.lap.open();
    // the note unrolls when something changes, then rolls up to its title strip
    const moving = inp.axisX() !== 0 || inp.down('jump');
    if (moving) { this.moved = true; this.idleT = 0; } else this.idleT += dt;
    if (this.openT > 0) { this.openT -= dt; if (this.openT <= 0) this.noteDirty = true; }
    if (this.idleT > 24 && free) { this.idleT = -40; this.reveal(5); }
    // the controls line fades once you're on your way
    this.keysT -= dt;
    if ((this.keysT <= 0 || (this.moved && this.keysT < 4.5)) && !this.keys.classList.contains('gone')) this.keys.classList.add('gone');
    if (this.banT > 0) {
      this.banT -= dt;
      if (this.banT <= 0) { const box = this.banW.el.parentElement!; box.classList.remove('in'); box.classList.add('out'); setTimeout(() => { if (this.banT <= 0) box.classList.add('off'); }, 460); }
    }
    if (this.holdT > 0) { this.holdT -= dt; if (this.holdT <= 0) this.lastKey = ''; }
    // animations on the note
    let anim = false;
    for (const r of this.rows) {
      if (r.state === 'done' && r.tick < 1) { r.tick = Math.min(1, r.tick + dt / 0.45); anim = true; }
      if (r.state === 'done' && r.tick > 0.6 && r.strike < 1) { r.strike = Math.min(1, r.strike + dt / 0.4); anim = true; }
      if (r.reveal < 1) { r.reveal = Math.min(1, r.reveal + dt / 0.9); anim = true; }
    }
    if (anim) this.noteDirty = true;
    this.bump = Math.max(0, this.bump - dt);
    this.body?.update(dt);
    this.acc += dt;
    if (this.acc >= 0.25) { this.acc = 0; if (this.holdT <= 0) this.refresh(); }
    this.paint(false, dt);
  }

  /** icon flies from a screen point into the backpack, with a pixel "+2 Flax" */
  flyItem(id: string, n: number, name: string, cssX: number, cssY: number) {
    const root = game.ui.root;
    const lab = el('div', 'pickup', `+${n} ${esc(name)}`);
    lab.style.left = Math.round(cssX) + 'px';
    lab.style.top = Math.round(cssY) + 'px';
    root.appendChild(lab);
    setTimeout(() => lab.remove(), 1400);
    const img = el('img', 'flyitem');
    img.src = itemIconURL(id, 3);
    img.style.left = Math.round(cssX - 24) + 'px';
    img.style.top = Math.round(cssY - 24) + 'px';
    root.appendChild(img);
    const [tx, ty] = this.packPos();
    const dx = tx - cssX, dy = ty - cssY;
    const anim = img.animate([
      { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
      { transform: `translate(${Math.round(dx * 0.15)}px, ${Math.round(-40 + dy * 0.05)}px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.5)`, opacity: 0.9 },
    ], { duration: 850, easing: 'steps(14)' });
    anim.onfinish = () => { img.remove(); this.bumpPack(); this.refresh(); };
  }

  destroy() {
    setQuestNotice(null);
    setTransitionFocus(null);
    for (const t of this.swapT) clearTimeout(t);
    this.body?.destroy();
    this.root.remove();
  }

  // ---------------------------------------------------------------- painting
  private paintT = 0;
  private paint(force: boolean, dt = 0) {
    this.paintT += dt;
    if (!force && this.paintT < 1 / 30) return;
    this.paintT = 0;
    // the stamp counter
    const rpTxt = String(Math.max(0, Math.round(this.rpShown)));
    const rw = 30 + tw(rpTxt, { face: 'block', scale: 2, spacing: 1 });
    this.rpW.draw(rw, 26, a => {
      plate(a, 0, 2, rw - 2, 22, col('#2e3a52'), { r: 2 });
      // the stamp: a round blue ink seal with RP in it
      a.ellipse(11, 13, 9, 9, OUT);
      a.ellipse(11, 13, 8, 8, col('#f4ead0'));
      a.ring(11, 13, 7, 7, col('#26408a'));
      drawText(a, 'RP', 7, 16, col('#26408a'), { face: 'block', bold: false, spacing: 0 });
      outlined(a, rpTxt, 24, 20, CREAM, OUT, { face: 'block', scale: 2, spacing: 1 });
    });
    // the sun-and-moon dial
    const hour = hudHour();
    this.dialW.el.classList.toggle('off', hour === null);
    if (hour !== null) this.dialW.draw(72, 44, a => paintDial(a, hour, game.save.day || 1, this.t));
    // the quest note
    if (this.noteDirty && this.noteQ) { this.noteDirty = false; this.paintNote(); }
    // the kit
    this.paintKit();
  }

  private paintBanner() {
    const name = this.placeName.toUpperCase();
    const k = 1;
    const tw0 = tw(name, { face: 'block', scale: k, spacing: 1 });
    const W = tw0 + 36, H = this.placeSub ? 38 : 28;
    this.banW.draw(W, H, a => {
      const red = col('#a8321e'), redD = col('#6e1a10'), redL = col('#d0503a');
      // the folded ends behind
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? 0 : W - 14;
        for (let y = 6; y < 24; y++) for (let x = 0; x < 14; x++) {
          const ox = s < 0 ? x : 13 - x;
          if (ox < Math.abs(y - 15) - 5) continue;
          a.put(x0 + x, y, ox === Math.max(0, Math.abs(y - 15) - 5) || y === 6 || y === 23 ? OUT : redD);
        }
      }
      plate(a, 8, 2, W - 16, 20, red, { r: 1 });
      for (let x = 10; x < W - 10; x++) { a.put(x, 4, redL); if (x % 4 === 0) a.put(x, 19, redD); }
      outlined(a, name, Math.round(W / 2 - tw0 / 2), 16, CREAM, OUT, { face: 'block', scale: k, spacing: 1 });
      if (this.placeSub) {
        const sw = tw(this.placeSub, { face: 'block', bold: false, spacing: 1 }) + 10;
        plate(a, Math.round(W / 2 - sw / 2), 23, sw, 12, col('#3e2814'), { r: 1 });
        outlined(a, this.placeSub, Math.round(W / 2 - sw / 2) + 5, 32, col('#f4d27a'), OUT, { face: 'block', bold: false, spacing: 1 });
      }
    });
  }

  private paintNote() {
    const q = this.noteQ;
    if (!q) return;
    const open = this.openT > 0 || this.hover;
    const W = 124, pad = 7;
    const title = q.title.toUpperCase();
    let tl = title;
    while (tw(tl, { face: 'block', bold: false, spacing: 1 }) > W - 30 && tl.length > 4) tl = tl.slice(0, -2);
    if (tl !== title) tl = tl.replace(/\s*\S?$/, '') + '...';
    // lay the rows out
    const lines: { row: NoteRow; lines: string[] }[] = this.rows.map(r => ({ row: r, lines: wrapText(r.text, W - pad * 2 - 12) }));
    const step = q.steps[currentStepIndex(q)];
    const pr = step?.progress?.();
    let H = 22;
    if (open) { for (const l of lines) H += l.lines.length * 11 + 3; if (pr) H += 10; H += 6; }
    else H = 22;
    this.noteW.draw(W + 2, H + 2, a => {
      // the paper: journal stock, a perforated top, a torn bottom, a hard shadow
      const tile = paperTileArt('journal');
      const torn = (x: number) => Math.round((Math.sin(x * 1.7) + Math.sin(x * 0.53 + 2)) * 0.8 + 1.5);
      const inside = (x: number, y: number) => x >= 0 && x < W && y >= ((x % 6) < 2 ? 1 : 0) && y < H - torn(x);
      for (let y = 2; y < H + 2; y++) for (let x = 2; x < W + 2; x++) if (!inside(x, y) && inside(x - 2, y - 2) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.4));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        let c = tile.d[(y % 128) * 128 + (x % 128)];
        if (y > 18 && (y - 18) % 11 === 10) c = mixC(c, col('#5078aa'), 0.25);
        if (x === 5) c = mixC(c, col('#c0463a'), 0.3);
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        if (edge) c = mixC(c, col('#7a4a1a'), 0.45);
        a.put(x, y, c);
      }
      // the pin
      const px = Math.round(W / 2);
      a.ellipse(px + 1.5, 4.5, 3.4, 3.4, col('#000000', 0.3));
      a.ellipse(px, 3, 3.4, 3.4, OUT);
      a.ellipse(px, 3, 2.6, 2.6, q.main ? col('#e2533a') : col('#4a7ad8'));
      a.put(px - 1, 2, col('#ffe2d8'));
      // the title strip
      outlined(a, tl, pad + 2, 16, q.main ? col('#a8321e') : col('#26408a'), col('#fff8e8'), { face: 'block', bold: false, spacing: 1 });
      if (!open) {
        // rolled up: how far along, and a little arrow to unroll it
        const n = currentStepIndex(q), tot = q.steps.length;
        const st = `${Math.min(n + 1, tot)}/${tot}`;
        drawText(a, st, W - 8 - tw(st, { face: 'block', bold: false }), 16, PENC, { face: 'block', bold: false });
        return;
      }
      let y = 22;
      for (const { row, lines: ls } of lines) {
        // the checkbox, the tick drawn on, the text written in, the strike drawn through
        const bx = pad, by = y + 1;
        const boxC = row.state === 'done' ? INKC : PENC;
        a.rect(bx, by, 8, 1, boxC); a.rect(bx, by + 7, 8, 1, boxC); a.rect(bx, by, 1, 8, boxC); a.rect(bx + 7, by, 1, 8, boxC);
        if (row.state === 'done') {
          const ta = new Art(12, 12);
          rasterStrokes(ta, 24, 24, [{ d: tick(24, row.seed), c: '#26408a', w: 3, draw: 1 }], false, row.tick, 0);
          a.blit(ta, bx - 1, by - 3);
        }
        const total = row.text.length;
        let shown = Math.floor(total * row.reveal);
        let ly = y + 9;
        for (const l of ls) {
          const part = l.slice(0, Math.max(0, shown));
          shown -= l.length + 1;
          drawText(a, part, bx + 12, ly, row.old ? PENC : INKC);
          if (row.state === 'done' && row.strike > 0) {
            const sw = Math.round(tw(l) * row.strike);
            for (let x = 0; x < sw; x++) a.put(bx + 11 + x, ly - 3 - (x > sw * 0.6 ? 1 : 0), col('#2a2440'));
          }
          ly += 11;
        }
        y += ls.length * 11 + 3;
      }
      if (pr) {
        // progress as pips
        const n = Math.min(pr[1], 12);
        const done = Math.round((pr[0] / Math.max(1, pr[1])) * n);
        for (let i = 0; i < n; i++) { a.rect(pad + 12 + i * 5, y + 2, 4, 4, OUT); a.rect(pad + 13 + i * 5, y + 3, 2, 2, i < done ? col('#26408a') : col('#f4ead0')); }
        drawText(a, `${pr[0]}/${pr[1]}`, pad + 16 + n * 5, y + 7, PENC, { face: 'block', bold: false });
      }
      void strike;
    });
  }

  private paintKit() {
    const sc = game.scene as SceneLike;
    const cam = sc?.cam && typeof sc.cam.shots === 'number' ? sc.cam : null;
    const lapOn = !!this.lap?.shown();
    const badge = lapOn ? this.lap!.badge() : 0;
    const n = game.save.inv.length, cap = Math.max(1, capacity());
    this.packFill += (n / cap - this.packFill) * 0.2;
    const W = 30 + (lapOn ? 24 : 0) + (cam ? 50 : 0), H = 30;
    this.kitRegions = [];
    this.kitW.draw(W, H, a => {
      let x = 0;
      // the backpack and its fill gauge
      const pk = imgArt(uiIconURL('pack', 1));
      const by = this.bump > 0 ? -1 : 0;
      plate(a, x, 6, 28, 22, col('#3e2814'), { r: 2 });
      if (pk) a.blit(pk, x + 3, 9 + by);
      const f = Math.min(1, this.packFill);
      const gx = x + 21, gh = 16;
      a.rect(gx, 9, 4, gh + 2, OUT);
      const fill = Math.round(f * gh);
      const gc = f >= 1 ? col('#e83a2a') : f > 0.8 ? col('#f0a03a') : col('#8ccf4a');
      for (let i = 0; i < fill; i++) a.rect(gx + 1, 9 + gh - i, 2, 1, i === fill - 1 ? shadeC(gc, 0.3) : gc);
      if (f >= 0.8) outlined(a, `${n}/${cap}`, x + 1, 6, f >= 1 ? col('#ff9a80') : CREAM, OUT, { face: 'block', bold: false });
      this.kitRegions.push({ id: 'pack', x0: x, x1: x + 28 });
      x += 30;
      // the field laptop with its badge
      if (lapOn) {
        plate(a, x, 6, 22, 22, col('#2a3442'), { r: 2 });
        a.blit(laptopArt(), x + 3, 9);
        if (badge > 0) {
          const t = String(Math.min(99, badge));
          const bw = tw(t, { face: 'block' }) + 6;
          plate(a, x + 22 - bw + 2, 1, bw, 11, col('#c8321e'), { r: 2, shadow: false });
          drawText(a, t, x + 22 - bw + 5, 10, CREAM, { face: 'block' });
        }
        this.kitRegions.push({ id: 'lap', x0: x, x1: x + 22 });
        x += 24;
      }
      // the instant camera, the film left, the print developing out of the top
      if (cam) {
        const dev = cam.v10 !== false ? Math.max(0, Math.min(1, cam.develop ?? 1)) : 1;
        plate(a, x, 6, 48, 22, col('#2e2a26'), { r: 2 });
        const cx = x + 3, cy = 13;
        if (dev < 1) {
          // the print sticking out of the slot, coming up from dark brown in dithered steps
          const pr = new Art(10, 11);
          pr.rect(0, 0, 10, 11, col('#f6f0e2')); pr.rect(0, 0, 10, 1, OUT); pr.rect(0, 0, 1, 11, OUT); pr.rect(9, 0, 1, 11, OUT);
          for (let yy = 1; yy < 8; yy++) for (let xx = 1; xx < 9; xx++) pr.put(xx, yy, dith(xx, yy, dev) ? (yy < 4 ? col('#7ab8e8') : col('#5a9a3a')) : col('#3a2a1a'));
          a.blit(pr, cx + 4, cy - 9 + Math.round((1 - Math.min(1, dev * 3)) * 6));
        }
        // the camera body
        a.rect(cx, cy, 18, 12, OUT);
        a.rect(cx + 1, cy + 1, 16, 10, col('#e8e0d0'));
        a.rect(cx + 1, cy + 7, 16, 4, col('#4a4440'));
        a.rect(cx + 1, cy + 1, 16, 1, col('#ffffff'));
        a.ellipse(cx + 9, cy + 6.5, 4, 4, OUT); a.ellipse(cx + 9, cy + 6.5, 3, 3, col('#3a5a7a')); a.put(cx + 8, cy + 5, col('#bfe0ff'));
        a.rect(cx + 2, cy + 2, 3, 2, col('#2a2a2a')); a.rect(cx + 14, cy - 1, 3, 2, col('#c8321e'));
        for (let i = 0; i < 5; i++) a.put(cx + 3 + i * 3, cy + 10, (i & 1) ? col('#e83a8a') : col('#3ac8e8'));
        // the film count (and the seconds left on the print)
        const shots = Math.max(0, Math.round(cam.shots ?? 0));
        const txt = dev < 1 ? `${Math.ceil(cam.developLeft?.() ?? 0)}S` : String(shots);
        outlined(a, txt, cx + 22, dev < 1 ? 22 : 24, dev < 1 ? col('#f4d27a') : shots <= 2 ? col('#ff8a6a') : CREAM, OUT, { face: 'block', scale: dev < 1 ? 1 : 2, spacing: 1 });
        if (dev >= 1) outlined(a, 'FILM', cx + 22, 7, col('#c8baa4'), OUT, { face: 'block', bold: false });
        this.kitRegions.push({ id: 'cam', x0: x, x1: x + 48 });
      }
    });
  }

  // ---------------------------------------------------------------- the note
  private reveal(secs: number) {
    if (!trackedQuest()) return;
    const was = this.openT > 0;
    this.openT = Math.max(this.openT, secs);
    if (!was) { this.noteDirty = true; this.noteBox.classList.remove('slide'); void this.noteBox.offsetWidth; this.noteBox.classList.add('slide'); }
  }
  private noticeQuest(q: QuestDef) {
    // a new quest: the note shows it (with a NEW stamp) for a moment, then goes back to the tracked one
    if (trackedQuest()?.id !== q.id) {
      this.drawNote(q, currentStepIndex(q), true);
      this.holdT = 5.5;
      this.lastKey = 'held';
    } else { this.lastKey = ''; this.refresh(); }
    this.noteBox.querySelector('.new-q')?.remove();
    this.noteBox.insertAdjacentHTML('beforeend', `<span class="new-q">${stamp(q.main ? 'New' : 'New job', { color: 'red', fresh: true, rot: '8deg' })}</span>`);
    setTimeout(() => this.noteBox.querySelector('.new-q')?.remove(), 5000);
    setTimeout(() => paperSfx('stamp', 0.6), 150);
    this.body?.cheer?.();
    this.reveal(7);
  }
  private drawNote(q: QuestDef, i: number, slideIn: boolean) {
    const st = q.steps[i];
    this.noteQ = q;
    this.rows = [st ? { text: st.text, state: 'todo', tick: 0, strike: 0, reveal: 1, seed: i + 1 } : { text: 'All done!', state: 'done', tick: 1, strike: 0, reveal: 1, seed: i + 1 }];
    this.noteDirty = true;
    this.noteBox.classList.remove('off');
    if (slideIn) paperSfx('slide', 0.6);
  }
  /** the step just finished gets ticked and struck through, then the next one is written in */
  private tickAndWrite(q: QuestDef, from: number, to: number) {
    for (const t of this.swapT) clearTimeout(t);
    this.swapT = [];
    const old = q.steps[from];
    this.noteQ = q;
    this.rows = [{ text: old?.text ?? '', state: 'done', tick: 0, strike: 0, reveal: 1, seed: from + 1 }];
    this.noteDirty = true;
    paperSfx('tick');
    audio.play('ui', { vol: 0.25, pitch: 1.4 });
    this.body?.cheer?.();
    this.swapT.push(setTimeout(() => {
      if (trackedQuest()?.id !== q.id) return;
      const st = q.steps[to];
      this.rows = [{ ...this.rows[0], old: true }, ...(st ? [{ text: st.text, state: 'todo' as const, tick: 0, strike: 0, reveal: 0, seed: to + 1 }] : [])];
      this.noteDirty = true;
      paperSfx('pencil', 0.8);
      // after a moment only the new step stays
      this.swapT.push(setTimeout(() => { if (trackedQuest()?.id === q.id) this.drawNote(q, currentStepIndex(q), false); }, 3200));
    }, 1300));
  }
  private rpGain(n: number) {
    this.rpW.el.classList.remove('pop');
    void this.rpW.el.offsetWidth;
    this.rpW.el.classList.add('pop');
    const e = el('div', 'hq-plus', stamp(`+${n} RP`, { color: 'blue', fresh: true, rot: '-8deg' }));
    const r = this.rpW.el.getBoundingClientRect(), p = this.root.getBoundingClientRect();
    e.style.left = `${Math.round(r.left - p.left - 20)}px`;
    e.style.top = `${Math.round(r.bottom - p.top + 4)}px`;
    this.root.appendChild(e);
    setTimeout(() => paperSfx('stamp', 0.45), 100);
    setTimeout(() => e.remove(), 2300);
    this.body?.cheer?.();
  }

  private openJournal() {
    if (game.ui.blocking) return;
    this.openT = 0;
    this.noteDirty = true;
    void import('./v11/journalbook').then(m => m.openJournal({ quest: trackedQuest()?.id }).then(() => { this.lastKey = ''; this.refresh(); this.reveal(3); }));
  }
  private async openEncyclopedia() {
    if (game.ui.blocking) return;
    const apps = await import('./v4/moriApps');
    if (!apps.installed('enc') && !apps.UNLOCK_BY_ID['enc']?.when()) {
      const who = (game.scene as unknown as { player?: { id?: string } } | null)?.player?.id ?? 'mori';
      game.ui.bubbles.bark(who, 'Nothing to look up yet. Get some photos uploaded first.', { expr: 'thinking' } as never);
      return;
    }
    const m = await import('./v11/encybook');
    await m.openEncyclopedia({});
  }
}

void PX;
