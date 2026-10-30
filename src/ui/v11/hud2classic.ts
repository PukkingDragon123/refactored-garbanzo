// The HUD is back (src/ui/hud2.ts mounts this when CLASSIC_HUD is on); dialogue, barks and pickups
// still float in the world. The time of day is the brass pocket watch (src/ui/v12/watch.ts).
//
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

import { el } from '../ui';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { trackedQuest, currentStepIndex, setQuestNotice } from '../../game/quests';
import type { QuestDef } from '../../game/quests';
import { capacity } from '../../game/inventory';
import { itemIconURL } from '../../art/itemicons';
import { mountBodyHud, BodyHud } from '../v10/bodyhud';
import { installPaper, scrap, stamp, paperSfx, escHtml as esc, setTransitionFocus, rasterStrokes, tick, strike, paperTileArt } from './paper';
import { Art, col, dith, shadeC, mixC, spriteURL, PX } from './paper/px';
import { drawText, wrapText } from './paper/pxfont';
import { PxW, outlined, tw, plate, hudScale, hudText, hudTextW, hnoise, leatherAt, paperAt, rivet } from './hudpx';
import { paintPack, paintLaptop, paintCamera, paintGuide } from './kitart';
import { hudHour } from './hudclock';
import { drawWatch, watchSize } from '../v12/watch';
import { slingOwnsG } from '../../game/v11/predators';

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
@media (max-width: 560px) {
  .h2 .hr { right: 6px; top: 6px; }
  .h2 .hr .row { flex-direction: column; align-items: flex-end; gap: 4px; }
  .h2 .hq { position: absolute; right: 0; top: 156px; }
}
/* the controls line */
.hm-keys { position: absolute; right: 14px; bottom: 12px; white-space: nowrap; transition: opacity 1.2s steps(6); opacity: 0.95;
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
interface HudLaptop {
  shown: () => boolean;
  /** photos waiting on the camera */
  badge: () => number;
  open: () => void;
}

/** a kit tile: a riveted plate (leather, enamel or bakelite by its colour) with a stitched inner edge */
function kitTile(a: Art, x: number, y: number, w: number, h: number, base: number) {
  plate(a, x, y, w, h, base, { r: 3 });
  for (let j = 3; j < h - 3; j++) for (let i = 3; i < w - 3; i++) a.put(x + i, y + j, leatherAt(x + i, y + j, a.get(x + i, y + j)));
  for (let i = 4; i < w - 4; i++) if (i % 3) { a.put(x + i, y + 3, shadeC(base, 0.35)); a.put(x + i, y + h - 4, shadeC(base, 0.18)); }
  for (let j = 5; j < h - 5; j++) if (j % 3) { a.put(x + 3, y + j, shadeC(base, 0.3)); a.put(x + w - 4, y + j, shadeC(base, 0.15)); }
}

/** a pushpin seen from above and a little to the side: domed head, catch-light, rim, needle, shadow */
function paintPin(a: Art, x: number, y: number, c: number) {
  const ROWS = ['..kkkk...', '.kLHhhk..', 'kLHhhhdk.', 'khhhhhdk.', 'khhhhddk.', '.kddddk..', '..kkkk...', '....n....', '....n....'];
  const P: Record<string, number> = { k: OUT, H: col('#ffffff'), L: shadeC(c, 0.45), h: c, d: shadeC(c, -0.35), n: col('#b8bcc0') };
  for (let j = 0; j < ROWS.length; j++) for (let i = 0; i < 9; i++) if (ROWS[j][i] !== '.' && dith(x + i + 2, y + j + 3, 0.7)) a.px(x + i + 2, y + j + 3, col('#000000', 0.32));
  ROWS.forEach((r, j) => { for (let i = 0; i < 9; i++) if (r[i] !== '.') a.put(x + i, y + j, P[r[i]]); });
}

/** the research counter: an enamel plate, a rubber-stamped seal, the count, a label */
function paintRpPlate(a: Art, w: number, txt: string, t: number) {
  const navy = col('#26324a'), ink = col('#26408a');
  plate(a, 0, 3, w - 3, 34, navy, { r: 3 });
  for (let j = 6; j < 34; j++) for (let i = 3; i < w - 6; i++) if (hnoise(i >> 2, j, 9) > 0.86) a.put(i, j, shadeC(navy, 0.06));
  for (const [sx, sy] of [[4, 7], [w - 8, 7], [w - 8, 32]]) { a.put(sx, sy, col('#8a96b0')); a.put(sx + 1, sy, col('#4a5670')); a.put(sx, sy - 1, col('#4a5670')); }
  // the seal: a cream paper disc stamped with a double ink ring, dots between, RP in the middle
  const cx = 20, cy = 20;
  for (let y = cy - 16; y <= cy + 16; y++) for (let x = cx - 16; x <= cx + 16; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > 15.5) continue;
    let c = d > 14.6 ? OUT : paperAt(x, y, col('#f4ead0'));
    if (d <= 14.6 && d > 11.8 && hnoise(x, y, 41) > 0.12) c = d > 13.7 || d < 12.7 ? ink : mixC(ink, col('#f4ead0'), 0.15);
    if (d <= 9.6 && d > 8.6 && hnoise(x, y, 43) > 0.2) c = ink;
    a.put(x, y, c);
  }
  for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2 + 0.26; a.put(Math.round(cx - 0.5 + Math.cos(an) * 11), Math.round(cy - 0.5 + Math.sin(an) * 11), mixC(ink, col('#f4ead0'), 0.1)); }
  hudText(a, 'RP', cx - 6, cy - 4, { face: 'caps', c: ink, ring: null });
  // the count and its label
  hudText(a, txt, 40, 7, { face: 'num', c: [col('#fffaea'), CREAM, col('#e8c890')], drop: 1 });
  outlined(a, 'RESEARCH', 40, 31, col('#9fc8ff'), OUT, { face: 'block', bold: false, spacing: 1 });
  void t;
}

interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}

type CamLike = { active?: boolean; shots?: number; develop?: number; v10?: boolean; developLeft?(): number };
type SceneLike = { player?: { x: number; y: number; vx?: number; body?: { showEmote?(e: string, t?: number): void } }; cutscene?: boolean; st?: { cam: { x: number; y: number; zoom: number } }; cam?: CamLike } | null;

interface NoteRow { text: string; state: 'todo' | 'done'; tick: number; strike: number; reveal: number; seed: number; old?: boolean }

export class Hud2Classic {
  readonly root: HTMLElement;
  private hr: HTMLElement;
  private rpW: PxW;
  private watchCv: HTMLCanvasElement;
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
  private kitRegions: { id: 'pack' | 'lap' | 'cam' | 'guide'; x0: number; x1: number }[] = [];
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
    this.watchCv = row.appendChild(document.createElement('canvas'));
    this.watchCv.className = 'hx dial';
    this.watchCv.title = 'The time (Mori\'s pocket watch)';
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
      else if (r?.id === 'guide') { audio.play('pageTurn' as never, { vol: 0.4 }); void this.openEncyclopedia(); }
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
    return [r.left - p.left + 15 * s, r.top - p.top + 30 * s];
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
    // keys: J journal, G encyclopedia (in the field G is the slingshot's: the guide book in the kit), L laptop
    if (free && inp.keyHit('KeyJ')) this.openJournal();
    if (free && inp.keyHit('KeyG') && !slingOwnsG()) void this.openEncyclopedia();
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
    // the stamp counter: an enamel plate with a rubber-stamped ink seal and the count in numerals
    const rpTxt = String(Math.max(0, Math.round(this.rpShown)));
    const nw = hudTextW(rpTxt, 'num', 1);
    const rw = Math.max(44 + nw + 10, 44 + tw('RESEARCH', { face: 'block', bold: false, spacing: 1 }) + 8);
    this.rpW.draw(rw, 40, a => paintRpPlate(a, rw, rpTxt, this.t));
    // the pocket watch: brass case, cream dial, blued hands on the time of day
    const hour = hudHour();
    this.watchCv.classList.toggle('off', hour === null);
    if (hour !== null) {
      const S = 46, ws = watchSize(S), sc = hudScale();
      if (this.watchCv.width !== ws.w) { this.watchCv.width = ws.w; this.watchCv.height = ws.h; }
      this.watchCv.style.width = ws.w * sc + 'px';
      this.watchCv.style.height = ws.h * sc + 'px';
      const g = this.watchCv.getContext('2d')!;
      g.clearRect(0, 0, ws.w, ws.h);
      drawWatch(g, 0, 0, S, 1, { mode: 'clock', hour });
    }
    // the quest note
    if (this.noteDirty && this.noteQ) { this.noteDirty = false; this.paintNote(); }
    // the kit
    this.paintKit();
  }

  private paintBanner() {
    const name = this.placeName.toUpperCase();
    const tw0 = hudTextW(name, 'caps', 1);
    const W = tw0 + 58, H = this.placeSub ? 60 : 44;
    this.banW.draw(W, H, a => {
      const red = col('#a8321e'), redD = col('#6e1a10'), redDD = col('#4a0e06'), redL = col('#d0503a');
      // the folded tails behind, V-notched, with a fold shadow
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? 0 : W - 20;
        for (let y = 9; y < 36; y++) for (let x = 0; x < 20; x++) {
          const ox = s < 0 ? x : 19 - x;
          const notch = Math.abs(y - 22.5) * 0.55 - 3;
          if (ox < notch) continue;
          const edge = ox <= notch + 1 || y === 9 || y === 35;
          a.put(x0 + x, y, edge ? OUT : y === 10 ? red : (x + y) % 9 === 0 ? redDD : redD);
        }
        const fx = s < 0 ? 13 : W - 14;
        for (let y = 30; y < 36; y++) a.put(fx, y, redDD);
      }
      // the band: cloth with a lit top hem, a shaded lower hem, stitching along both and a weave
      plate(a, 12, 3, W - 24, 30, red, { r: 2 });
      for (let y = 5; y < 31; y++) for (let x = 14; x < W - 14; x++) if (hnoise(x, y, 17) > 0.9) a.put(x, y, shadeC(red, -0.1));
      for (let x = 14; x < W - 14; x++) {
        a.put(x, 5, redL);
        if (x % 3) { a.put(x, 7, col('#f0d0a0')); a.put(x, 28, col('#d8a888')); }
        a.put(x, 30, redD);
      }
      hudText(a, name, Math.round(W / 2 - tw0 / 2), 13, { face: 'caps', c: [col('#fffaea'), CREAM, col('#e8c890')], ring: OUT, drop: 1 });
      if (this.placeSub) {
        // the day on a small wooden plaque hung from the banner by two cords
        const sw = hudTextW(this.placeSub, 'caps', 1) + 14;
        const px0 = Math.round(W / 2 - sw / 2);
        for (let y = 33; y < 40; y++) { a.put(px0 + 4, y, col('#d8c8a0')); a.put(px0 + sw - 5, y, col('#d8c8a0')); }
        plate(a, px0, 39, sw, 17, col('#5a3818'), { r: 2 });
        for (let y = 41; y < 54; y++) for (let x = px0 + 2; x < px0 + sw - 2; x++) if (hnoise(x >> 2, y, 23) > 0.8) a.put(x, y, col('#4a2c12'));
        rivet(a, px0 + 4, 42); rivet(a, px0 + sw - 5, 42);
        hudText(a, this.placeSub, px0 + 7, 43, { face: 'caps', c: [col('#fff4b0'), col('#f4d27a'), col('#c89a3a')], ring: OUT, drop: 1 });
      }
    });
  }

  private paintNote() {
    const q = this.noteQ;
    if (!q) return;
    const open = this.openT > 0 || this.hover;
    const W = window.innerWidth < 560 ? 150 : 186, pad = 12, LH = 12;
    const title = q.title.toUpperCase();
    let tl = title;
    while (tw(tl, { face: 'block', bold: true, spacing: 1 }) > W - 50 && tl.length > 4) tl = tl.slice(0, -2);
    if (tl !== title) tl = tl.replace(/\s*\S?$/, '') + '...';
    // lay the rows out
    const lines: { row: NoteRow; lines: string[] }[] = this.rows.map(r => ({ row: r, lines: wrapText(r.text, W - pad * 2 - 16) }));
    const step = q.steps[currentStepIndex(q)];
    const pr = step?.progress?.();
    let H = 32;
    if (open) { for (const l of lines) H += l.lines.length * LH + 4; if (pr) H += 14; H += 8; }
    this.noteW.draw(W + 3, H + 3, a => {
      // the paper: journal stock with fibres, a perforated top, a torn bottom, a fold, a hard shadow
      const tile = paperTileArt('journal');
      const torn = (x: number) => Math.round((Math.sin(x * 1.7) + Math.sin(x * 0.53 + 2) + Math.sin(x * 3.1) * 0.5) * 0.8 + 2);
      const inside = (x: number, y: number) => x >= 0 && x < W && y >= ((x % 7) < 2 ? 1 : 0) && y < H - torn(x);
      for (let y = 3; y < H + 3; y++) for (let x = 3; x < W + 3; x++) if (!inside(x, y) && inside(x - 3, y - 3) && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.42));
      const fold = Math.round(W * 0.64);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        let c = paperAt(x, y, tile.d[(y % 128) * 128 + (x % 128)]);
        if (y > 28 && (y - 28) % LH === LH - 1) c = mixC(c, col('#5078aa'), 0.28);
        if (x === 8) c = mixC(c, col('#c0463a'), 0.32);
        if (x === fold) c = shadeC(c, -0.08); else if (x === fold + 1) c = shadeC(c, 0.08);
        if (y < 3 && (x % 7) === 3) c = shadeC(c, -0.2);
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        if (edge) c = mixC(c, col('#7a4a1a'), 0.5);
        else if (!inside(x, y + 2) && dith(x, y, 0.5)) c = mixC(c, col('#c8a878'), 0.4);
        a.put(x, y, c);
      }
      // a coffee ring in the corner
      for (let i = 0; i < 40; i++) {
        const an = (i / 40) * Math.PI * 2;
        if (i % 9 === 4) continue;
        const X = Math.round(W - 22 + Math.cos(an) * 9), Y = Math.round(H - 14 + Math.sin(an) * 7);
        if (inside(X, Y)) a.put(X, Y, mixC(a.get(X, Y), col('#8a5a2a'), 0.22));
      }
      // the pushpin: a domed head with a catch-light, its rim, the needle and a shadow
      paintPin(a, Math.round(W / 2) - 4, 0, q.main ? col('#d8402a') : col('#3a68c8'));
      // the title strip
      outlined(a, tl, pad + 4, 22, q.main ? col('#a8321e') : col('#26408a'), col('#fff8e8'), { face: 'block', bold: true, spacing: 1 });
      if (!open) {
        // rolled up: how far along
        const n = currentStepIndex(q), tot = q.steps.length;
        const st = `${Math.min(n + 1, tot)}/${tot}`;
        drawText(a, st, W - 10 - tw(st, { face: 'block', bold: false }), 22, PENC, { face: 'block', bold: false });
        return;
      }
      let y = 29;
      for (const { row, lines: ls } of lines) {
        // the checkbox (drawn by hand, a little crooked), the tick drawn on, the text written in, the strike
        const bx = pad, by = y + 2;
        const boxC = row.state === 'done' ? INKC : PENC;
        for (let i = 0; i < 9; i++) {
          a.put(bx + i, by + (i > 6 ? 1 : 0), boxC); a.put(bx + i, by + 8, boxC);
          a.put(bx, by + i, boxC); a.put(bx + 8 + (i < 2 ? 1 : 0), by + i, boxC);
        }
        if (row.state === 'done') {
          const ta = new Art(16, 16);
          rasterStrokes(ta, 32, 32, [{ d: tick(32, row.seed), c: '#26408a', w: 3, draw: 1 }], false, row.tick, 0);
          a.blit(ta, bx - 1, by - 5);
        }
        const total = row.text.length;
        let shown = Math.floor(total * row.reveal);
        let ly = y + 10;
        for (const l of ls) {
          const part = l.slice(0, Math.max(0, shown));
          shown -= l.length + 1;
          drawText(a, part, bx + 15, ly, row.old ? PENC : INKC);
          if (row.state === 'done' && row.strike > 0) {
            const sw = Math.round(tw(l) * row.strike);
            for (let x = 0; x < sw; x++) a.put(bx + 14 + x, ly - 3 - (x > sw * 0.6 ? 1 : 0) + (x % 11 === 5 ? 1 : 0), col('#2a2440'));
          }
          ly += LH;
        }
        y += ls.length * LH + 4;
      }
      if (pr) {
        // progress as inked pips
        const n = Math.min(pr[1], 12);
        const done = Math.round((pr[0] / Math.max(1, pr[1])) * n);
        for (let i = 0; i < n; i++) {
          const px = pad + 15 + i * 7;
          a.rect(px, y + 2, 6, 6, OUT); a.rect(px + 1, y + 3, 4, 4, i < done ? col('#26408a') : col('#f4ead0'));
          if (i < done) a.put(px + 1, y + 3, col('#4a68b8'));
        }
        drawText(a, `${pr[0]}/${pr[1]}`, pad + 20 + n * 7, y + 9, PENC, { face: 'block', bold: false });
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
    const PW = 42, GW = 30, LW = 36, CWd = 86, H = 54, top = 9, ph = 42;
    const W = PW + 3 + GW + 3 + (lapOn ? LW + 3 : 0) + (cam ? CWd : 0);
    this.kitRegions = [];
    this.kitW.draw(W, H, a => {
      let x = 0;
      // the backpack on a leather tile, its fill gauge a little glass tube beside it
      const by = this.bump > 0 ? -1 : 0;
      kitTile(a, x, top, PW, ph, col('#4a2c16'));
      paintPack(a, x + 3, top + 8 + by, this.packFill);
      const f = Math.min(1, this.packFill);
      const gx = x + PW - 10, gh = 30;
      a.rect(gx, top + 5, 6, gh + 4, OUT);
      a.rect(gx + 1, top + 6, 4, gh + 2, col('#1a2426'));
      const fill = Math.round(f * gh);
      const gc = f >= 1 ? col('#e83a2a') : f > 0.8 ? col('#f0a03a') : col('#8ccf4a');
      for (let i = 0; i < fill; i++) { const yy = top + 6 + gh + 1 - i; a.put(gx + 1, yy, shadeC(gc, 0.3)); a.put(gx + 2, yy, gc); a.put(gx + 3, yy, gc); a.put(gx + 4, yy, shadeC(gc, -0.3)); }
      for (let i = 0; i < 4; i++) a.put(gx + 4, top + 8 + i * 8, col('#c8ccd0'));
      a.put(gx + 1, top + 7, col('#ffffff', 0.6));
      if (f >= 0.8) outlined(a, `${n}/${cap}`, x + 2, 7, f >= 1 ? col('#ff9a80') : CREAM, OUT, { face: 'block', bold: false });
      this.kitRegions.push({ id: 'pack', x0: x, x1: x + PW });
      x += PW + 3;
      // the field guide: a strapped leather notebook (click it; in the field G is the slingshot's)
      kitTile(a, x, top, GW, ph, col('#2e3a22'));
      paintGuide(a, x + 4, top + 7 + (this.bump > 0 ? -1 : 0));
      this.kitRegions.push({ id: 'guide', x0: x, x1: x + GW });
      x += GW + 3;
      // the field laptop with its upload badge
      if (lapOn) {
        kitTile(a, x, top, LW, ph, col('#2a3442'));
        paintLaptop(a, x + 5, top + 12, this.t);
        if (badge > 0) {
          const t = String(Math.min(99, badge));
          const bw = hudTextW(t, 'caps', 1) + 8;
          plate(a, x + LW - bw + 3, 0, bw, 15, col('#c8321e'), { r: 3, shadow: false });
          hudText(a, t, x + LW - bw + 7, 3, { face: 'caps', c: [col('#fffaea'), CREAM, col('#f0c8a0')], ring: col('#6e1208'), drop: 0 });
        }
        this.kitRegions.push({ id: 'lap', x0: x, x1: x + LW });
        x += LW + 3;
      }
      // the instant camera, the film left, the print developing out of the top
      if (cam) {
        const dev = cam.v10 !== false ? Math.max(0, Math.min(1, cam.develop ?? 1)) : 1;
        kitTile(a, x, top, CWd, ph, col('#2e2a26'));
        const cx = x + 5, cy = top + 15;
        if (dev < 1) {
          // the print sticking out of the slot, coming up from dark brown in dithered steps
          const pr = new Art(16, 17);
          for (let yy = 0; yy < 17; yy++) for (let xx = 0; xx < 16; xx++) pr.put(xx, yy, yy === 0 || xx === 0 || xx === 15 ? OUT : col('#f6f0e2'));
          for (let yy = 2; yy < 12; yy++) for (let xx = 2; xx < 14; xx++) pr.put(xx, yy, dith(xx, yy, dev) ? (yy < 6 ? col('#7ab8e8') : yy < 8 ? col('#e8f0d0') : col('#5a9a3a')) : col('#3a2a1a'));
          a.blit(pr, cx + 6, cy - 15 + Math.round((1 - Math.min(1, dev * 3)) * 9));
        }
        paintCamera(a, cx, cy);
        // the film count (or the seconds left on the print) on a little counter window
        const shots = Math.max(0, Math.round(cam.shots ?? 0));
        const lx = cx + 33;
        if (dev < 1) {
          outlined(a, 'DRYING', lx, top + 13, col('#c8baa4'), OUT, { face: 'block', bold: false });
          hudText(a, `${Math.ceil(cam.developLeft?.() ?? 0)}`, lx + 2, top + 19, { face: 'num', c: [col('#fff4b0'), col('#f4d27a'), col('#c89a3a')] });
        } else {
          outlined(a, 'FILM', lx, top + 13, col('#c8baa4'), OUT, { face: 'block', bold: false });
          // the counter window: a dark recess with the number on a white wheel
          const st = String(shots), sw = hudTextW(st, 'num', 1);
          a.rect(lx - 1, top + 16, sw + 8, 18, OUT);
          a.rect(lx, top + 17, sw + 6, 16, col('#e8e2d4'));
          a.rect(lx, top + 17, sw + 6, 1, col('#9a948a'));
          a.rect(lx, top + 32, sw + 6, 1, col('#c8c0b0'));
          hudText(a, st, lx + 3, top + 20, { face: 'num', c: shots <= 2 ? [col('#e8432a'), col('#c8321e'), col('#8a1e10')] : [col('#3a3430'), col('#1a1410'), col('#1a1410')], ring: null });
          for (let i = 0; i < 5; i++) a.put(lx + sw + 9, top + 18 + i * 3, i < Math.min(5, shots) ? col('#f4d27a') : col('#4a4440'));
        }
        this.kitRegions.push({ id: 'cam', x0: x, x1: x + CWd });
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
    void import('./journalbook').then(m => m.openJournal({ quest: trackedQuest()?.id }).then(() => { this.lastKey = ''; this.refresh(); this.reveal(3); }));
  }
  private async openEncyclopedia() {
    if (game.ui.blocking) return;
    const apps = await import('../v4/moriApps');
    if (!apps.installed('enc') && !apps.UNLOCK_BY_ID['enc']?.when()) {
      const who = (game.scene as unknown as { player?: { id?: string } } | null)?.player?.id ?? 'mori';
      game.ui.bubbles.bark(who, 'Nothing to look up yet. Get some photos uploaded first.', { expr: 'thinking' } as never);
      return;
    }
    const m = await import('./encybook');
    await m.openEncyclopedia({});
  }
}

void PX;
