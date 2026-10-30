// The HUD (src/ui/hud2.ts mounts this when CLASSIC_HUD is on): only what the player uses, painted at
// the screen's own resolution (about one device pixel per art pixel, never chunky blocks):
//   top right   the brass pocket watch with the time of day (src/ui/v12/watch.ts), and under it the
//               objective note: a small pinned scrap of journal paper with the current step in Mori's
//               marker hand. When a step is done it's ticked and struck through in ink, then the next
//               one is written in. After a while it rolls up to its title; hover it (or tap) to unroll
//               it, click it to open the field journal (J).
//   bottom left the kit as real objects that are the buttons themselves (no plates behind them): the
//               rucksack (I), the field guide (G), the field laptop (L, with its upload badge) and the
//               instant camera with the film left on its own counter window and the print developing
//               out of its slot (src/ui/v11/kitart.ts). Hover lifts an object and a glint runs across
//               it; pressing pushes it down; a small keycap hint sits by it on a keyboard.
// Words are the floating words of the menus and dialogue (src/ui/v12/float.ts): the place name floats
// in the sky when you arrive somewhere new, big moments and new jobs are notices near Mori, pickups
// rise off the spot. There is no research counter, no status plate and no controls line.
// The API is the V2 Hud2 one (setPlace, setKeys, setLaptop, show, refresh, update, flyItem, banner,
// packPos, bumpPack, destroy), so every scene keeps working.

import { el } from '../ui';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { trackedQuest, currentStepIndex, setQuestNotice } from '../../game/quests';
import type { QuestDef } from '../../game/quests';
import { capacity } from '../../game/inventory';
import { itemIcon, itemIconURL } from '../../art/itemicons';
import { mountBodyHud, BodyHud } from '../v10/bodyhud';
import { installPaper, paperSfx, setTransitionFocus, rasterStrokes, tick } from './paper';
import { Art, col, mixC, shadeC, bayer } from './paper/px';
import { pxDraw, pxMeasure, pxWrap } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { PixelBuffer } from '../../art/pixel';
import { hudHour } from './hudclock';
import { drawWatch, watchSize } from '../v12/watch';
import { slingOwnsG } from '../../game/v11/predators';
import { floatSky, floatNotice, floatPickup } from '../v12/float';
import { paintKitIcon, paintKitButton, KIT_SIZE } from './kitart';
import type { KitKind } from './kitart';

const CSS = `
.h2 { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s steps(4); }
.h2.off { opacity: 0; }
.h2 canvas.hd { display: block; image-rendering: pixelated; }
.h2 .hr { position: absolute; right: 12px; top: 10px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.h2 .hr .dial.off { display: none; }
.h2 .hq { position: relative; pointer-events: auto; cursor: pointer; }
.h2 .hq.off { display: none; }
.h2 .hq.slide { animation: hxSlide 0.4s steps(8); }
@keyframes hxSlide { from { transform: translateY(-30px); opacity: 0; } }
.h2 .hk { position: absolute; left: 12px; bottom: 8px; display: flex; align-items: flex-end; gap: 4px; }
.h2 .hk canvas { pointer-events: auto; cursor: pointer; }
.h2 .hk .kw { position: relative; display: flex; flex-direction: column; align-items: center; }
.h2 .hk .kw.off { display: none; }
.h2 .hk canvas.kit { transform-origin: 50% 100%; }
.h2 .hk canvas.kl { position: absolute; bottom: 100%; left: 50%; pointer-events: none; opacity: 0; transform: translate(-50%, 6px); image-rendering: pixelated; }
.h2 .hk .kw.hov canvas.kl { opacity: 1; transform: translate(-50%, 0); animation: klPop 0.24s steps(4), klBob 1.8s steps(6) 0.24s infinite; }
@keyframes klPop { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes klBob { 50% { transform: translate(-50%, -2px); } }
.h2 .hk canvas.kit.press { transform: translateY(2px) scale(1.07, 0.9); }
.h2 .hk canvas.kit.pack.hov { animation: kHop 0.5s steps(5); }
@keyframes kHop { 30% { transform: translateY(-5px) scale(0.96, 1.05); } 60% { transform: translateY(0) scale(1.05, 0.95); } }
.h2 .hk canvas.kit.guide.hov { animation: kWig 0.45s steps(6); }
@keyframes kWig { 20% { transform: translateX(-2px) translateY(-2px); } 45% { transform: translateX(2px) translateY(-2px); } 70% { transform: translateX(-1px); } }
.h2 .hk canvas.kit.lap.hov { animation: kBoot 0.6s steps(6); filter: brightness(1.12); }
@keyframes kBoot { 0% { filter: brightness(0.6); } 35% { filter: brightness(1.45); } 55% { filter: brightness(0.9); } 100% { filter: brightness(1.12); } }
.h2 .hk canvas.kit.cam.hov { animation: kHop 0.4s steps(4); }
.h2 .hk canvas.kit.use { animation: kUse 0.32s steps(4); }
.h2 .hk canvas.kit.cam.use { animation: kFlash 0.4s steps(4); }
@keyframes kUse { 0% { transform: translateY(2px) scale(1.08, 0.88); } 50% { transform: translateY(-4px) scale(0.95, 1.06); } }
@keyframes kFlash { 0% { filter: brightness(3); transform: scale(1.06); } 100% { filter: brightness(1); } }
.h2 .hk canvas.off { display: none; }
body.touchmode .h2 .hk { bottom: auto; top: 8px; left: 8px; }
body.touchmode .h2 .hr { right: 8px; top: 6px; }
.flyitem { position: absolute; width: 32px; height: 32px; image-rendering: pixelated; pointer-events: none; z-index: 9; }
`;
let styled = false;

/** the island's field laptop on the belt (see game/v9/research9.ts) */
interface HudLaptop {
  shown: () => boolean;
  /** photos waiting on the camera */
  badge: () => number;
  open: () => void;
}
interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}
type CamLike = { active?: boolean; shots?: number; develop?: number; v10?: boolean; developLeft?(): number };
type SceneLike = { player?: { x: number; y: number; vx?: number }; cutscene?: boolean; st?: { cam: { x: number; y: number; zoom: number } }; cam?: CamLike } | null;
interface NoteRow { text: string; state: 'todo' | 'done'; tick: number; strike: number; reveal: number; seed: number; old?: boolean }

// ---------------------------------------------------------------- resolution
/** the kit's icons are drawn this much larger than their 52-unit design box */
const KIT_K = 1.6;
/** CSS px per design unit: 1 at 1280 x 720, in proportion to the screen above and below that (a phone
 *  in landscape about 0.72, 1080p 1.5) */
function hudUi(): number {
  const w = window.innerWidth, h = window.innerHeight;
  return Math.max(0.72, Math.min(1.8, Math.min(w / 1280, h / 720)));
}
const dprOf = () => window.devicePixelRatio || 1;
/** device px per design unit */
const hudK = () => dprOf() * hudUi();

/** device px per art pixel for the kit icons (user: "not that high resolution"): every screen gets the
 *  same ~34 px icon art, shown at a whole number of device pixels */
const kitPx = () => Math.max(2, Math.round(hudK() * 2));
const KIT_NAMES: Record<KitKind, string> = { pack: 'Backpack', guide: 'Field guide', lap: 'Laptop', cam: 'Camera' };

/** a canvas painted at device resolution: w x h design units */
class HdCanvas {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  art: Art | null = null;
  k = 1;
  private px = 1;
  constructor(parent: HTMLElement, cls: string) {
    this.el = parent.appendChild(document.createElement('canvas'));
    this.el.className = 'hd ' + cls;
    this.g = this.el.getContext('2d')!;
  }
  /** paint at w x h design units; px = device px per art pixel (1 = full resolution, 2+ = chunkier) */
  draw(wu: number, hu: number, paint: (a: Art, k: number) => void, px = 1) {
    const k = hudK() / px, dpr = dprOf();
    const W = Math.max(1, Math.ceil(wu * k)), H = Math.max(1, Math.ceil(hu * k));
    if (!this.art || this.art.w !== W || this.art.h !== H || this.px !== px) {
      this.art = new Art(W, H);
      this.px = px;
      this.el.width = W; this.el.height = H;
      this.el.style.width = (W * px) / dpr + 'px';
      this.el.style.height = (H * px) / dpr + 'px';
    } else this.art.d.fill(0);
    this.k = k;
    paint(this.art, k);
    this.g.putImageData(this.art.img, 0, 0);
  }
  /** the design-unit point under a pointer event */
  hit(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.el.getBoundingClientRect(), u = hudUi();
    return [(e.clientX - r.left) / u, (e.clientY - r.top) / u];
  }
}

// ---------------------------------------------------------------- ink words on paper
/** a line in one of the game's bitmap faces (the menus' words), each font pixel gp x gp device px */
function inkText(a: Art, text: string, x: number, y: number, gp: number, font: PxFontId, c: number | ((row: number) => number), upTo = Infinity): number {
  if (!text) return 0;
  const w = pxMeasure(text, font) + 4, b = new PixelBuffer(w, 16);
  pxDraw(b, text, 1, 1, { font, color: '#ffffff', bounce: font === 'script' });
  let n = 0;
  for (let gy = 0; gy < b.h; gy++) for (let gx = 0; gx < b.w; gx++) {
    if (!(b.get(gx, gy) >>> 24) || gx > upTo) continue;
    const cc = typeof c === 'number' ? c : c(gy);
    for (let j = 0; j < gp; j++) for (let i = 0; i < gp; i++) a.put(x + gx * gp + i, y + gy * gp + j, cc);
    n++;
  }
  void n;
  return (w - 4) * gp;
}

/** a kit button's name, floating over it on hover: the menus' bold bitmap face, cream with a dark drop */
function paintKitLabel(cv: HTMLCanvasElement, text: string) {
  const px = kitPx(), dpr = dprOf();
  const W = pxMeasure(text, 'bold') + 6, H = 16;
  if (cv.width === W && cv.dataset.t === text && cv.dataset.px === String(px)) return;
  const a = new Art(W, H);
  inkText(a, text, 2, 2, 1, 'bold', col('#140c06'));
  inkText(a, text, 1, 3, 1, 'bold', col('#140c06'));
  inkText(a, text, 3, 3, 1, 'bold', col('#140c06'));
  inkText(a, text, 2, 4, 1, 'bold', col('#140c06'));
  inkText(a, text, 2, 3, 1, 'bold', row => (row < 6 ? col('#fff6dc') : col('#f0c868')));
  cv.width = W; cv.height = H;
  cv.style.width = (W * px) / dpr + 'px';
  cv.style.height = (H * px) / dpr + 'px';
  cv.dataset.t = text; cv.dataset.px = String(px);
  cv.getContext('2d')!.putImageData(a.img, 0, 0);
}

export class Hud2Classic {
  readonly root: HTMLElement;
  private hr: HTMLElement;
  private watchCv: HTMLCanvasElement;
  private noteBox: HTMLElement;
  private note: HdCanvas;
  private kit: Record<KitKind, HdCanvas>;
  private kitSt: Record<KitKind, { hover: boolean; press: boolean; lift: number; glint: number; key: string }>;
  private kitBox: HTMLElement;
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
  // the place name
  private placeName = '';
  private dayShown = -1;
  private namedAt = new Map<string, number>();
  // misc
  private moved = false;
  private idleT = 0;
  private t = 0;
  private acc = 0;
  private bannerT = 0;
  private packFill = 0;
  private bump = 0;
  private kitKey = '';

  constructor(parent: HTMLElement, o: HudOpts) {
    installPaper();
    if (!styled) { styled = true; document.head.appendChild(el('style', '', CSS)); }
    this.onBackpack = o.onBackpack;
    this.root = parent.appendChild(el('div', 'h2'));
    this.body = mountBodyHud(this.root);
    // top right: the watch, the note under it
    this.hr = this.root.appendChild(el('div', 'hr'));
    this.watchCv = this.hr.appendChild(document.createElement('canvas'));
    this.watchCv.className = 'hd dial';
    this.watchCv.title = 'The time (Mori\'s pocket watch)';
    this.noteBox = this.hr.appendChild(el('div', 'hq off'));
    this.note = new HdCanvas(this.noteBox, 'note');
    this.noteBox.addEventListener('click', e => { e.stopPropagation(); if (this.openT <= 0 && document.body.classList.contains('touchmode')) { this.reveal(6); return; } this.openJournal(); });
    this.noteBox.addEventListener('pointerenter', () => { this.hover = true; this.noteDirty = true; });
    this.noteBox.addEventListener('pointerleave', () => { this.hover = false; this.noteDirty = true; });
    this.noteBox.title = 'What am I doing? (J opens the journal)';
    // bottom left: the kit, each object its own button
    this.kitBox = this.root.appendChild(el('div', 'hk'));
    const mk = (id: KitKind, key: string, title: string) => {
      const wrap = this.kitBox.appendChild(el('div', 'kw ' + id));
      const lab = wrap.appendChild(document.createElement('canvas'));
      lab.className = 'kl';
      const c = new HdCanvas(wrap, 'kit ' + id);
      c.el.title = title;
      const st = { hover: false, press: false, lift: 0, glint: -1, key };
      const react = (cls: string) => { c.el.classList.remove(cls); void c.el.offsetWidth; c.el.classList.add(cls); };
      c.el.addEventListener('pointerenter', () => {
        st.hover = true; st.glint = 0;
        paintKitLabel(lab, KIT_NAMES[id]);
        wrap.classList.add('hov');
        react('hov');
        audio.play('ui', { vol: 0.06, pitch: id === 'pack' ? 1.3 : id === 'guide' ? 1.5 : id === 'lap' ? 1.9 : 1.7 });
      });
      c.el.addEventListener('pointerleave', () => { st.hover = false; st.press = false; wrap.classList.remove('hov'); c.el.classList.remove('press', 'hov'); });
      c.el.addEventListener('pointerdown', e => { e.stopPropagation(); st.press = true; c.el.classList.add('press'); });
      c.el.addEventListener('pointerup', e => {
        e.stopPropagation();
        c.el.classList.remove('press');
        if (st.press) { react('use'); this.useKit(id); }
        st.press = false;
      });
      return [c, st] as const;
    };
    const [pk, ps] = mk('pack', 'I', 'Backpack (I)');
    const [gd, gs] = mk('guide', 'G', 'Field guide (G)');
    const [lp, ls] = mk('lap', 'L', 'Field laptop (L)');
    const [cm, cs] = mk('cam', '', 'Camera: film left');
    this.kit = { pack: pk, guide: gd, lap: lp, cam: cm };
    this.kitSt = { pack: ps, guide: gs, lap: ls, cam: cs };
    this.setPlace(o.place, o.sub);
    setQuestNotice(q => this.noticeQuest(q));
    // transitions centre their iris / first ink blot on Mori
    setTransitionFocus(() => {
      const s = game.scene as SceneLike;
      const p = s?.player, c = s?.st?.cam;
      if (!p || !c) return null;
      const r = game.r;
      return [Math.max(0, Math.min(1, r.projectX(p.x, 1) / r.VW)), Math.max(0, Math.min(1, r.projectY(p.y - 20, 1) / r.VH))];
    });
    this.refresh(true);
    // a fresh scene: show what we're doing for a few seconds
    this.reveal(6);
    this.paint(true);
  }

  // ---------------------------------------------------------------- API
  /** a new place (or a new day): its name floats in the sky */
  setPlace(place: string, sub = '') {
    const day = game.save.day || 1;
    if (place === this.placeName && day === this.dayShown) return;
    const newDay = day !== this.dayShown && this.dayShown >= 0 && /day/i.test(sub);
    this.placeName = place;
    this.dayShown = day;
    if (!place) return;
    const now = performance.now(), was = this.namedAt.get(place + '|' + day);
    if (was !== undefined && now - was < 150000 && !newDay) return;
    this.namedAt.set(place + '|' + day, now);
    void floatSky(place, '', newDay || /day/i.test(sub) ? `Day ${day}` : '', 2600, { soft: true });
  }
  /** (the controls line is gone: the kit's keycaps show the keys) */
  setKeys(_html: string) { /* */ }
  /** put the field laptop in the kit (null removes it); L opens it too */
  setLaptop(l: HudLaptop | null) { this.lap = l; this.refresh(); }
  show(on: boolean) { this.root.classList.toggle('off', !on); }

  /** backpack screen position (for flying pickups), relative to the UI root */
  packPos(): [number, number] {
    const r = this.kit.pack.el.getBoundingClientRect(), p = game.ui.root.getBoundingClientRect();
    if (!r.width) return [p.width * 0.06, p.height * 0.92];
    return [r.left - p.left + r.width / 2, r.top - p.top + r.height * 0.55];
  }
  bumpPack() { this.bump = 0.3; }

  /** a big moment ("NEW PLACE ON THE MAP"): floating words near Mori */
  banner(title: string, sub = '') {
    const now = performance.now();
    if (now - this.bannerT < 600) return;
    this.bannerT = now;
    floatNotice(sub || title, 3800, sub ? { tag: title, accent: '#ffd05a' } : {});
    setTimeout(() => paperSfx('stamp', 0.5), 120);
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
    const sc = game.scene as SceneLike;
    const inp = game.input;
    const free = !game.ui.blocking && !sc?.cutscene;
    // keys: I is the scene's, J journal, G the field guide (in the field G is the slingshot's), L laptop
    if (free && inp.keyHit('KeyJ')) this.openJournal();
    if (free && inp.keyHit('KeyG') && !slingOwnsG()) void this.openEncyclopedia();
    if (this.lap && inp.keyHit('KeyL') && free && this.lap.shown()) this.lap.open();
    // the note unrolls when something changes, then rolls up to its title
    const moving = inp.axisX() !== 0 || inp.down('jump');
    if (moving) { this.moved = true; this.idleT = 0; } else this.idleT += dt;
    if (this.openT > 0) { this.openT -= dt; if (this.openT <= 0) this.noteDirty = true; }
    if (this.idleT > 24 && free) { this.idleT = -40; this.reveal(5); }
    if (this.holdT > 0) { this.holdT -= dt; if (this.holdT <= 0) this.lastKey = ''; }
    // the note's ink: the tick drawn on, the strike, the new step written in
    let anim = false;
    for (const r of this.rows) {
      if (r.state === 'done' && r.tick < 1) { r.tick = Math.min(1, r.tick + dt / 0.45); anim = true; }
      if (r.state === 'done' && r.tick > 0.6 && r.strike < 1) { r.strike = Math.min(1, r.strike + dt / 0.4); anim = true; }
      if (r.reveal < 1) { r.reveal = Math.min(1, r.reveal + dt / 0.9); anim = true; }
    }
    if (anim) this.noteDirty = true;
    // the kit's buttons: lift on hover, down on press, the glint runs once
    for (const id of Object.keys(this.kitSt) as KitKind[]) {
      const s = this.kitSt[id];
      const want = s.press ? -1 : s.hover ? 3 : 0;
      s.lift += (want - s.lift) * Math.min(1, dt * 18);
      if (Math.abs(want - s.lift) < 0.05) s.lift = want;
      if (s.glint >= 0) { s.glint += dt / 0.45; if (s.glint > 1) s.glint = -1; }
    }
    this.bump = Math.max(0, this.bump - dt);
    this.body?.update(dt);
    this.acc += dt;
    if (this.acc >= 0.25) { this.acc = 0; if (this.holdT <= 0) this.refresh(); }
    this.paint(false, dt);
  }

  /** "+2 Flax" floats up off the spot; the item flies into the backpack */
  flyItem(id: string, n: number, name: string, cssX: number, cssY: number) {
    let buf = null;
    try { buf = itemIcon(id); } catch { buf = null; }
    floatPickup(`+${n} ${name}`, cssX, cssY, buf ? { key: id, buf } : null);
    const root = game.ui.root;
    const img = el('img', 'flyitem');
    img.src = itemIconURL(id, 2);
    img.style.left = Math.round(cssX - 16) + 'px';
    img.style.top = Math.round(cssY - 16) + 'px';
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
    // the pocket watch: brass case, cream dial, blued hands on the time of day
    const hour = hudHour();
    this.watchCv.classList.toggle('off', hour === null);
    if (hour !== null) {
      const k = hudK(), S = Math.round(88 * k), ws = watchSize(S);
      if (this.watchCv.width !== ws.w || this.watchCv.height !== ws.h) { this.watchCv.width = ws.w; this.watchCv.height = ws.h; }
      this.watchCv.style.width = ws.w / dprOf() + 'px';
      this.watchCv.style.height = ws.h / dprOf() + 'px';
      const g = this.watchCv.getContext('2d')!;
      g.clearRect(0, 0, ws.w, ws.h);
      drawWatch(g, 0, 0, S, 1, { mode: 'clock', hour });
    }
    if (this.noteDirty && this.noteQ) { this.noteDirty = false; this.paintNote(); }
    this.paintKit();
  }

  /** the objective note: a small scrap of journal paper, pinned, in Mori's marker hand */
  private paintNote() {
    const q = this.noteQ;
    if (!q) return;
    const open = this.openT > 0 || this.hover;
    const k = hudK(), gp = Math.max(1, Math.round(1.6 * k));
    const W = 250, pad = 12;
    // lay the words out in font pixels
    const maxFont = Math.floor(((W - pad * 2 - 16) * k) / gp);
    let title = q.title;
    while (pxMeasure(title.toUpperCase(), 'bold') > maxFont && title.length > 4) title = title.slice(0, -2);
    if (title !== q.title) title = title.replace(/\s*\S?$/, '') + '...';
    const lines = this.rows.map(r => ({ row: r, lines: pxWrap(r.text, maxFont, 'script') }));
    const step = q.steps[currentStepIndex(q)];
    const pr = step?.progress?.();
    const lh = 13 * gp / k; // a line of the hand in design units
    let H = 32;
    if (open) { for (const l of lines) H += l.lines.length * lh + 4; if (pr) H += 14; H += 6; }
    this.note.draw(W + 6, H + 6, (a, kk) => {
      const P = (v: number) => Math.round(v * kk);
      const torn = (x: number) => (Math.sin(x * 0.9) + Math.sin(x * 0.37 + 2) + Math.sin(x * 2.3) * 0.4) * 0.8 + 2.4;
      const inside = (x: number, y: number) => x >= 0 && x < W && y >= ((Math.floor(x / 6) % 2) ? 0.6 : 0) && y < H - torn(x);
      // a soft dithered shadow under the scrap, then the paper: cream stock with fibres, faint rules, a
      // red margin, a darker torn edge
      const paper = col('#f6ecd2'), fibre = col('#dccaa0'), rule = col('#8ab0d8'), margin = col('#d87a6a'), edge = col('#b89a6a');
      for (let py = 0; py < a.h; py++) for (let px = 0; px < a.w; px++) {
        const x = (px + 0.5) / kk, y = (py + 0.5) / kk;
        if (inside(x, y)) {
          let c = paper;
          const n = hashN(px, py);
          if (n > 0.985) c = fibre; else if (n < 0.012) c = col('#fffaf0');
          if (Math.floor(x * 0.5 + y * 1.3) % 23 === 0 && hashN(px >> 1, py, 3) > 0.6) c = mixC(c, fibre, 0.5);
          if (y > 30 && Math.abs(((y - 30) % lh) - (lh - 2)) < 0.5 / kk + 0.25) c = mixC(c, rule, 0.45);
          if (Math.abs(x - 7) < 0.5) c = mixC(c, margin, 0.55);
          if (!inside(x, y + 1.2) || !inside(x - 0.8, y) || !inside(x + 0.8, y)) c = mixC(c, edge, 0.55);
          else if (!inside(x, y + 2.6) && bayer(px, py) < 0.5) c = mixC(c, edge, 0.25);
          a.put(px, py, c);
        } else if (inside(x - 3, y - 4)) {
          const dd = inside(x - 1.5, y - 2) ? 0.42 : 0.22;
          if (bayer(px, py) < dd) a.put(px, py, col('#000000', 0.5));
        }
      }
      // the pushpin
      paintPin(a, kk, W / 2, 4, q.main ? '#d8402a' : '#3a68c8');
      // the title in red or blue ink capitals
      const titleC = q.main ? col('#a8321e') : col('#26408a');
      inkText(a, title.toUpperCase(), P(pad + 2), P(12), gp, 'bold', row => (row <= 3 ? shadeC(titleC, 0.12) : titleC));
      if (!open) {
        const n = currentStepIndex(q), tot = q.steps.length;
        const st = `${Math.min(n + 1, tot)}/${tot}`;
        inkText(a, st, P(W - pad) - pxMeasure(st, 'body') * gp, P(12), gp, 'body', col('#7a7060'));
        return;
      }
      let y = 30;
      const inkC = col('#2a2a5a'), oldC = col('#8a8478');
      for (const { row, lines: ls } of lines) {
        // the checkbox, drawn by hand; the tick inked on; the words written in; the strike
        const bx = pad, by = y + 3;
        const boxC = row.state === 'done' ? inkC : oldC;
        const bs = 9, lw = Math.max(1, Math.round(kk));
        for (let i = 0; i <= P(bs); i++) for (let t = 0; t < lw; t++) {
          a.put(P(bx) + i, P(by) + t + (i > P(bs) * 0.7 ? 1 : 0), boxC); a.put(P(bx) + i, P(by + bs) - t, boxC);
          a.put(P(bx) + t, P(by) + i, boxC); a.put(P(bx + bs) - t + (i < P(bs) * 0.25 ? 1 : 0), P(by) + i, boxC);
        }
        if (row.state === 'done') {
          const ta = new Art(P(16), P(16));
          rasterStrokes(ta, 32, 32, [{ d: tick(32, row.seed), c: '#26408a', w: 3, draw: 1 }], false, row.tick, 0);
          a.blit(ta, P(bx - 1), P(by - 5));
        }
        let shown = Math.floor(row.text.length * row.reveal);
        let ly = y;
        for (const l of ls) {
          const part = l.slice(0, Math.max(0, shown));
          shown -= l.length + 1;
          const w = inkText(a, part, P(bx + 15), P(ly), gp, 'script', row.old ? oldC : inkC);
          if (row.state === 'done' && row.strike > 0) {
            const sw = Math.round((pxMeasure(l, 'script') * gp) * row.strike);
            const sy = P(ly) + 8 * gp;
            for (let x = 0; x < sw; x++) for (let t = 0; t < Math.max(1, Math.round(kk)); t++) a.put(P(bx + 15) + x, sy + t - (x > sw * 0.6 ? Math.round(kk) : 0), col('#2a2440'));
          }
          void w;
          ly += lh;
        }
        y += ls.length * lh + 4;
      }
      if (pr) {
        // progress as inked pips
        const n = Math.min(pr[1], 12);
        const done = Math.round((pr[0] / Math.max(1, pr[1])) * n);
        for (let i = 0; i < n; i++) {
          const px0 = P(pad + 15 + i * 8), py0 = P(y + 2), s = P(6);
          for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
            const edgeP = xx < Math.max(1, kk) || yy < Math.max(1, kk) || xx >= s - Math.max(1, kk) || yy >= s - Math.max(1, kk);
            a.put(px0 + xx, py0 + yy, edgeP ? col('#2a2440') : i < done ? (yy < s / 3 ? col('#4a68b8') : col('#26408a')) : col('#fbf4e2'));
          }
        }
        inkText(a, `${pr[0]}/${pr[1]}`, P(pad + 20 + n * 8), P(y), gp, 'body', col('#7a7060'));
      }
    });
  }

  /** the kit: each object its own button */
  private paintKit() {
    const sc = game.scene as SceneLike;
    const cam = sc?.cam && typeof sc.cam.shots === 'number' ? sc.cam : null;
    const lapOn = !!this.lap?.shown();
    const badge = lapOn ? this.lap!.badge() : 0;
    const n = game.save.inv.length, cap = Math.max(1, capacity());
    this.packFill += (n / cap - this.packFill) * 0.2;
    const touch = document.body.classList.contains('touchmode');
    const dev = cam && cam.v10 !== false ? Math.max(0, Math.min(1, cam.develop ?? 1)) : 1;
    const shots = Math.max(0, Math.round(cam?.shots ?? 0));
    const k = hudK();
    const states = Object.values(this.kitSt).map(s => `${s.lift.toFixed(2)},${s.glint.toFixed(2)},${s.hover}`).join('|');
    const key = `${k}|${kitPx()}|${lapOn}|${badge}|${!!cam}|${shots}|${Math.round(dev * 12)}|${Math.round(this.packFill * 8)}|${this.bump > 0}|${touch}|${slingOwnsG()}|${states}`;
    if (key === this.kitKey) return;
    this.kitKey = key;
    this.kit.lap.el.parentElement!.classList.toggle('off', !lapOn);
    this.kit.cam.el.parentElement!.classList.toggle('off', !cam);
    const draw = (id: KitKind, info: Parameters<typeof paintKitIcon>[2], extra: { badge?: number } = {}) => {
      const st = this.kitSt[id];
      const hint = touch || !st.hover ? '' : id === 'guide' && slingOwnsG() ? '' : st.key;
      this.kit[id].draw(KIT_SIZE * KIT_K, (KIT_SIZE + 10) * KIT_K, (a, kk) => {
        const ik = kk * KIT_K;
        const icon = paintKitIcon(id, ik, info);
        paintKitButton(a, icon, ik, { lift: st.lift + (id === 'pack' && this.bump > 0 ? 1.5 : 0), glint: st.glint, key: hint || undefined, keyGp: Math.max(1, Math.round(kk)), badge: extra.badge });
      }, kitPx());
    };
    draw('pack', { fill: this.packFill });
    draw('guide', {});
    if (lapOn) draw('lap', { badge }, { badge });
    if (cam) draw('cam', { shots, develop: dev });
  }

  private useKit(id: KitKind) {
    if (game.ui.blocking) return;
    audio.play('ui', { vol: 0.2, pitch: 1.1 });
    if (id === 'pack') this.onBackpack?.();
    else if (id === 'lap') this.lap?.open();
    else if (id === 'guide') { audio.play('pageTurn' as never, { vol: 0.4 }); void this.openEncyclopedia(); }
    else if (id === 'cam') {
      const sc = game.scene as unknown as { cam?: { active: boolean; raise(on: boolean): void }; cutscene?: boolean } | null;
      if (sc?.cam && !sc.cutscene) { audio.play('shutter', { vol: 0.25 }); sc.cam.raise(!sc.cam.active); }
    }
  }

  // ---------------------------------------------------------------- the note
  private reveal(secs: number) {
    if (!trackedQuest()) return;
    const was = this.openT > 0;
    this.openT = Math.max(this.openT, secs);
    if (!was) { this.noteDirty = true; this.noteBox.classList.remove('slide'); void this.noteBox.offsetWidth; this.noteBox.classList.add('slide'); }
  }
  private noticeQuest(q: QuestDef) {
    // a new quest: the note shows it for a moment, then goes back to the tracked one; a notice floats by Mori
    if (trackedQuest()?.id !== q.id) {
      this.drawNote(q, currentStepIndex(q), true);
      this.holdT = 5.5;
      this.lastKey = 'held';
    } else { this.lastKey = ''; this.refresh(); }
    floatNotice(q.title, 3800, { tag: q.main ? 'New' : 'New job', accent: '#ffd05a' });
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

/** a texture hash (0..1) for a device pixel */
function hashN(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** a pushpin seen from above: a domed head lit from the top left with a hard catch-light, its shadow */
function paintPin(a: Art, k: number, cx: number, cy: number, hex: string) {
  const base = col(hex), R = 4.2;
  const tones = [shadeC(base, -0.6), shadeC(base, -0.4), shadeC(base, -0.2), base, shadeC(base, 0.25), shadeC(base, 0.5)];
  for (let py = Math.floor((cy - R - 1) * k); py <= Math.ceil((cy + R + 4) * k); py++) for (let px = Math.floor((cx - R - 1) * k); px <= Math.ceil((cx + R + 4) * k); px++) {
    const x = (px + 0.5) / k, y = (py + 0.5) / k;
    const d = Math.hypot(x - cx, y - cy);
    if (d > R) {
      if (Math.hypot(x - cx - 2.2, y - cy - 2.6) < R && bayer(px, py) < 0.45) a.put(px, py, col('#000000', 0.5));
      continue;
    }
    if (d > R - Math.max(1, Math.round(k * 0.8)) / k) { a.put(px, py, shadeC(base, -0.7)); continue; }
    const nx = (x - cx) / R, ny = (y - cy) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = (-0.5 * nx - 0.62 * ny + 0.6 * nz + 0.2) / 1.2;
    const f = Math.max(0, Math.min(tones.length - 1, l * (tones.length - 1)));
    const i0 = Math.floor(f);
    let c = tones[Math.min(tones.length - 1, i0 + (f - i0 > bayer(px, py) ? 1 : 0))];
    if (Math.hypot(x - cx + 1.4, y - cy + 1.5) < 1.1) c = col('#ffffff');
    a.put(px, py, c);
  }
}
