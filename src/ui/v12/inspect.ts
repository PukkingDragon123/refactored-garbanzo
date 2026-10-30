// V12: inspecting Mori. Click or tap him (or press Tab / I) and the world gently slows almost to a
// stop while the camera eases in close on him (the cinematic camera, src/game/v11/cine.ts: the lens
// racks focus onto him and the rest of the scene goes soft). He turns to the camera, and three things
// on him light up with a soft pixel outline and a small floating word:
//   CAMERA    on its strap: equip it (he raises it: the photo mode) or put it away
//   BACKPACK  on his back: he swings it off and the view drops to first person (src/ui/v12/pack)
//   NOTE      the paper sticking out of his pocket: he pulls it out (the notebook, src/ui/v12/notebook)
// Hover pulses them (the word waves). Esc / Tab, a click on empty space or a tap away eases back out.
// Keys inside: C / Q camera, B / I backpack, N / J note, arrows and Enter to pick.
//
// The camera, pack and note are painted here at world scale and drawn in the world next to Mori's
// sprite (so the light, the depth of field and the zoom treat them like him). When his sprite carries
// them itself (a frame with named points 'gearCam', 'gearPack', 'gearNote'), those points place the
// highlights and nothing extra is drawn.

import { game } from '../../game/game';
import { cineTo, cineRelease, cineSlowmo } from '../../game/v11/cine';
import type { Stage, Layer } from '../../world/stage';
import { Custom } from '../../world/props';
import { local } from '../../game/assets';
import type { Atlas } from '../../gfx/atlas';
import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { hasAnim7 } from '../../art/v7/anim-contract';
import { animInfo } from '../../world/actor';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix } from '../../art/color';
import type { C } from '../../art/color';
import { bayer } from '../../core/math';
import { audio } from '../../core/audio';
import { pushKeys, reduced } from '../laptop-kit';
import { pxWord, wordOut, wordAnim, wordLayer, wordScale } from './pxwords';
import type { Word } from './pxwords';
import { floatText } from './float';
import { tooHungryForPhotos } from '../../game/v12/hunger';

type Spot = 'camera' | 'backpack' | 'note';
interface BodyLike {
  x: number; y: number; facing: number; p?: number; anim: string;
  setExpr(e: string, d?: number): void; react(k: string): void; showEmote(k: string, d?: number): void;
  point(name: string): [number, number] | null; update(dt: number): void;
}
interface PlayerLike {
  x: number; y: number; vx: number; facing: number; state: string; poseOverride: string | null; height: number;
  body: BodyLike; camera?: boolean;
}
interface SceneLike {
  player?: PlayerLike;
  st?: Stage;
  main?: Layer;
  cam?: { active: boolean; raise(on: boolean): void } | null;
  cutscene?: boolean;
  hud?: { refresh(f?: boolean): void } | null;
}

let running: Promise<void> | null = null;
/** inspecting Mori right now */
export const inspecting = () => !!running;

/** is the world point on Mori (for the click / tap that opens the inspection)? */
export function moriAt(wx: number, wy: number): boolean {
  const p = (game.scene as unknown as SceneLike | null)?.player;
  if (!p || p.state === 'climb' || p.state === 'swim') return false;
  const h = Math.max(30, p.height || 62);
  return Math.abs(wx - p.x) < 10 && wy > p.y - h - 2 && wy < p.y + 3;
}

/** can Mori be inspected here, now? */
export function canInspect(): boolean {
  const sc = game.scene as unknown as SceneLike | null;
  return !!(sc?.player && sc.st && sc.main && !sc.cutscene && !game.ui.blocking && !running);
}

/** Inspect Mori: the camera eases in and his camera, backpack and note paper can be picked.
 *  Resolves when the camera has eased back out. */
export function inspectMori(o: { pick?: Spot } = {}): Promise<void> {
  if (running) return running;
  const sc = game.scene as unknown as SceneLike | null;
  if (!sc?.player || !sc.st || !sc.main || sc.cutscene) return Promise.resolve();
  running = new Inspection(sc as Required<Pick<SceneLike, 'player' | 'st' | 'main'>> & SceneLike).run(o.pick).catch(e => console.error('[inspect]', e)).finally(() => { running = null; });
  return running;
}

// ---------------------------------------------------------------- the things on him (world scale)

const H = (s: string) => hex(s);
const OUT = H('#120c08');
function rp(r: C[], t: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1), i = Math.floor(f);
  return f - i > 0.25 + bayer(x, y) * 0.5 ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
const CV = [H('#1e1f10'), H('#3a3c20'), H('#55592e'), H('#6e733e'), H('#8a8f52'), H('#a6aa6c')];
const RUST = [H('#3a160c'), H('#6a2c16'), H('#954222'), H('#b85c30'), H('#d27a46')];
const ROLL = [H('#4a3a08'), H('#8a6c14'), H('#c49a22'), H('#e8bc3a'), H('#f8d86a')];
const STEEL = [H('#1a1c1e'), H('#3a3e42'), H('#62686e'), H('#8e959a'), H('#c0c6ca')];
const BODY = [H('#0e0e10'), H('#1e1e22'), H('#2e2e34'), H('#45454c'), H('#5e5e66')];

/** his pack seen from the side: canvas body, a rust lid, the yellow bedroll, a bottle in the side pocket */
function paintPackProp(): PixelBuffer {
  const b = new PixelBuffer(15, 22);
  // the bedroll across the top
  for (let y = 0; y < 5; y++) for (let x = 2; x < 14; x++) b.set(x, y, (x === 5 || x === 10) ? H('#3a2a10') : rp(ROLL, 0.75 - y * 0.12, x, y));
  // the body
  for (let y = 4; y < 21; y++) for (let x = 0; x < 14; x++) {
    const rx = Math.min(x, 13 - x), ry = Math.min(y - 4, 20 - y);
    if (rx + ry < 2) continue;
    const t = 0.62 - (x / 13) * 0.32 - ((y - 4) / 16) * 0.12 + ((x + y * 2) % 4 === 0 ? -0.05 : 0);
    b.set(x, y, rp(CV, t, x, y));
  }
  // the lid flap and its strap
  for (let y = 4; y < 10; y++) for (let x = 1; x < 13; x++) if (y < 9 || (x > 2 && x < 11)) b.set(x, y, rp(RUST, 0.7 - (x / 12) * 0.3 - (y - 4) * 0.05, x, y));
  for (let y = 9; y < 14; y++) { b.set(6, y, H('#2a1a0c')); b.set(7, y, H('#4a2e16')); }
  b.set(6, 12, H('#d8b048')); b.set(7, 12, H('#f6d870'));
  // the side pocket with a steel bottle
  for (let y = 12; y < 20; y++) for (let x = 11; x < 15; x++) b.set(x, y, rp(CV, 0.3 - (y - 12) * 0.02, x, y));
  for (let y = 9; y < 13; y++) for (let x = 12; x < 14; x++) b.set(x, y, rp(STEEL, 0.8 - (x - 12) * 0.3, x, y));
  b.outline(OUT);
  return b;
}
/** the camera on its strap: black body, a silver top plate, the big lens looking out */
function paintCamProp(): PixelBuffer {
  const b = new PixelBuffer(11, 11);
  // strap stubs going up to his shoulder
  b.set(1, 0, H('#4a2e16')); b.set(1, 1, H('#4a2e16')); b.set(2, 2, H('#6a4422'));
  for (let y = 3; y < 10; y++) for (let x = 0; x < 10; x++) {
    if ((x === 0 || x === 9) && (y === 3 || y === 9)) continue;
    b.set(x, y, y === 3 ? rp(STEEL, 0.7, x, y) : rp(BODY, 0.75 - (x / 9) * 0.3 - (y - 4) * 0.06, x, y));
  }
  b.set(8, 2, STEEL[3]); b.set(7, 2, STEEL[2]); // the shutter
  // the lens: a ring with glass
  b.discFn(5, 6.5, 2.7, (x, y, nx, ny) => (Math.hypot(nx, ny) > 0.72 ? STEEL[2] : nx < -0.1 && ny < -0.1 ? H('#9ad8f0') : H('#1a3a5a')));
  b.set(4, 5, H('#e8f8ff'));
  b.outline(OUT);
  return b;
}
/** the folded note paper sticking up out of the pocket */
function paintNoteProp(): PixelBuffer {
  const b = new PixelBuffer(6, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
    if (x === 5 && y === 0) continue;
    b.set(x, y, y === 7 ? H('#6a7a3a') : mix(H('#f4ead0'), H('#c8b88e'), x / 7 + (y % 2 && x > 0 && x < 4 && y < 6 ? 0.35 : 0)));
  }
  b.set(4, 0, H('#c8b88e')); b.set(4, 1, H('#a89870'));
  b.outline(OUT);
  return b;
}
/** a soft pixel outline round a prop: a solid ring and a dithered halo outside it */
function haloOf(src: PixelBuffer): PixelBuffer {
  const pad = 2, b = new PixelBuffer(src.w + pad * 2, src.h + pad * 2);
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < src.w && y < src.h && (src.get(x, y) >>> 24) > 40;
  for (let y = -pad; y < src.h + pad; y++) for (let x = -pad; x < src.w + pad; x++) {
    if (op(x, y)) continue;
    const near = op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1);
    const far = !near && [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dy]) => op(x + dx, y + dy));
    if (near) b.set(x + pad, y + pad, H('#ffffff'));
    else if (far && ((x + y) & 1) === 0) b.set(x + pad, y + pad, hex('#ffffff', 140));
  }
  return b;
}

interface Art { pack: Frame; packH: Frame; cam: Frame; camH: Frame; note: Frame; noteH: Frame }
const artCache = new WeakMap<Atlas, Art>();
function propArt(): Art | null {
  const at = local as Atlas | undefined;
  if (!at) return null;
  let a = artCache.get(at);
  if (a) return a;
  try {
    const p = paintPackProp(), c = paintCamProp(), n = paintNoteProp();
    a = {
      pack: at.add('v12:insp:pack', p), packH: at.add('v12:insp:packH', haloOf(p)),
      cam: at.add('v12:insp:cam', c), camH: at.add('v12:insp:camH', haloOf(c)),
      note: at.add('v12:insp:note', n), noteH: at.add('v12:insp:noteH', haloOf(n)),
    };
    artCache.set(at, a);
    return a;
  } catch (e) { console.warn('[inspect] art', e); return null; }
}

// ---------------------------------------------------------------- the inspection

const LABEL: Record<Spot, string> = { camera: 'CAMERA', backpack: 'BACKPACK', note: 'NOTE' };
const ORDER: Spot[] = ['backpack', 'camera', 'note'];

class Inspection {
  private p: PlayerLike;
  private st: Stage;
  private layer: HTMLElement;
  private words: HTMLElement;
  private k = 2;
  private labels = new Map<Spot, Word>();
  private hover: Spot | null = null;
  private busy = false;
  private done = false;
  private alpha = 0;
  private alphaTo = 1;
  private pulseT = 0;
  private drawables: Custom[] = [];
  private offs: (() => void)[] = [];
  private resolve!: () => void;
  private poseSet = false;
  private camWasUp = false;
  /** the close shot on him */
  private shot: { x: number; y: number; zoom: number; focus: number; dof: number; sway: number } | null = null;
  /** the props are hidden (the pack is off his back, the note is out) */
  private hide: Partial<Record<Spot, boolean>> = {};
  private hudWas: string[] = [];

  constructor(readonly sc: SceneLike & { player: PlayerLike; st: Stage; main: Layer }) {
    this.p = sc.player;
    this.st = sc.st;
    this.layer = document.createElement('div');
    this.layer.className = 'insp12';
    this.layer.style.cssText = 'position:absolute;inset:0;z-index:34;pointer-events:auto;touch-action:none;cursor:default';
    this.k = wordScale();
    this.words = wordLayer(this.k);
    this.layer.appendChild(this.words);
  }

  /** which things he has on him */
  private spots(): Spot[] {
    const out: Spot[] = ['backpack', 'note'];
    if (game.save.tools.includes('camera')) out.splice(1, 0, 'camera');
    return out;
  }

  async run(pick?: Spot) {
    const p = this.p, sc = this.sc;
    const done = new Promise<void>(r => (this.resolve = r));
    game.ui.modalOpen++;
    p.vx = 0;
    // a camera up: lower it to look at him (it goes back up if nothing is picked)
    if (sc.cam?.active) { this.camWasUp = true; sc.cam.raise(false); }
    // the HUD steps aside
    const hud = [game.ui.sceneLayer, game.ui.prompts, game.ui.hud];
    this.hudWas = hud.map(h => h.style.opacity);
    for (const h of hud) { h.style.transition = 'opacity 0.3s'; h.style.opacity = '0'; }
    // the world slows almost to a stop; Mori keeps his own time
    cineSlowmo(0.06, 0.5);
    const tick = (rdt: number) => this.frame(rdt);
    game.frameHooks.push(tick);
    this.offs.push(() => { const i = game.frameHooks.indexOf(tick); if (i >= 0) game.frameHooks.splice(i, 1); });
    // the things on him, drawn in the world beside his sprite
    const pr = new Custom(this.p.body ? 49.9 : 49.9, r => this.drawBehind(r));
    const fr = new Custom(50.1, r => this.drawFront(r));
    sc.main.add(pr); sc.main.add(fr);
    this.drawables = [pr, fr];
    // he turns to the camera
    if (hasAnim7('inspect')) { p.poseOverride = 'inspect'; this.poseSet = true; }
    else { p.body.setExpr('happy', 1.4); p.body.react('nod'); }
    audio.play('whoosh', { vol: 0.18, pitch: 0.7 });
    // the camera eases in close, the lens on him
    const zoom = this.zoom();
    this.shot = { x: p.x, y: p.y - (p.height || 62) * 0.52, zoom, focus: p.body.p ?? 1, dof: 1.35, sway: 0.1 };
    await cineTo(this.st, { ...this.shot, secs: reduced() ? 0.05 : 0.9 });
    if (this.done) return done;
    // the overlay: hover, picks, a click away
    game.ui.modalLayer.appendChild(this.layer);
    this.listen();
    this.showLabels();
    if (pick) void this.pick(pick);
    return done;
  }

  /** a close shot: Mori about half the view high */
  private zoom(): number {
    const h = this.p.height || 62;
    const cur = this.st.cam.zoom;
    return Math.max(cur * 1.4, Math.min(4.2, (game.r.VH * 0.5) / h));
  }

  // ------------------------------------------------------------ where the things are (world px)
  private where(s: Spot): [number, number] {
    const p = this.p, b = p.body, f = b.facing || p.facing || 1;
    const named = b.point(s === 'camera' ? 'gearCam' : s === 'backpack' ? 'gearPack' : 'gearNote');
    if (named) return named;
    // presenting the camera, it is in his hands
    if (s === 'camera' && this.inHands()) { const l = b.point('load'); if (l) return [l[0], l[1] - 4]; }
    const y = b.y, x = b.x;
    if (this.poseSet) {
      // square to the viewer: the pack behind his shoulders, the camera on his chest, the note in the
      // pocket on his hip
      if (s === 'backpack') return [x - f * 1, y - 43];
      if (s === 'camera') return [x + f * 0.5, y - 40];
      return [x + f * 4, y - 30];
    }
    if (s === 'backpack') return [x - f * 7, y - 38];
    if (s === 'camera') return [x + f * 3, y - 30];
    return [x + f * 2, y - 44];
  }
  private onSprite(s: Spot): boolean {
    if (s === 'camera' && this.inHands()) return true;
    return !!this.p.body.point(s === 'camera' ? 'gearCam' : s === 'backpack' ? 'gearPack' : 'gearNote');
  }
  /** his own sprite has the camera in his hands (presenting it, raising it) */
  private inHands(): boolean { const a = this.p.body.anim; return a === 'inspectCamera' || a === 'cameraRaise' || a === 'cameraLower'; }
  private frames(s: Spot, a: Art): [Frame, Frame] {
    return s === 'camera' ? [a.cam, a.camH] : s === 'backpack' ? [a.pack, a.packH] : [a.note, a.noteH];
  }

  // ------------------------------------------------------------ drawing in the world
  private drawBehind(r: import('../../gfx/renderer').Renderer) { this.drawSpots(r, ['backpack']); }
  private drawFront(r: import('../../gfx/renderer').Renderer) { this.drawSpots(r, ['camera', 'note']); }
  private drawSpots(r: import('../../gfx/renderer').Renderer, which: Spot[]) {
    if (this.alpha <= 0.01) return;
    const a = propArt();
    if (!a) return;
    const f = this.p.body.facing || 1;
    for (const s of which) {
      if (!this.spots().includes(s) || this.hide[s]) continue;
      const [x, y] = this.where(s);
      const [fr, halo] = this.frames(s, a);
      const hov = this.hover === s;
      const bob = hov ? -1 : 0;
      // the soft outline: a slow pulse, brighter and quicker on the one under the pointer
      const pulse = hov ? 0.75 + Math.sin(this.pulseT * 9) * 0.25 : 0.35 + Math.sin(this.pulseT * 3 + ORDER.indexOf(s)) * 0.18;
      const hx = Math.round(x), hy = Math.round(y) + bob + fr.h / 2 + 2;
      if (s === 'backpack') {
        // (behind him: its glow stays behind him too, an unlit ring drawn before his sprite)
        r.emissive(1);
        r.draw(halo, hx, hy, f, 1, 0, packColor(1, 0.9, 0.6, Math.min(1, this.alpha * (0.45 + pulse * 0.6))));
        r.emissive();
      } else r.fxDraw(halo, hx, hy, f, 1, 0, packColor(1, 0.86, 0.5, this.alpha * pulse), hov ? 2.2 : 1.4, true);
      if (!this.onSprite(s)) r.draw(fr, Math.round(x), Math.round(y) + bob + fr.h / 2, f, 1, 0, packColor(1, 1, 1, this.alpha));
    }
  }

  private frame(rdt: number) {
    if (game.scene !== (this.sc as unknown)) { void this.leave(true); return; }
    this.pulseT += rdt;
    this.alpha += (this.alphaTo - this.alpha) * Math.min(1, rdt * 6);
    // Mori keeps real time while the world crawls (his turn, his breathing, the anims he plays)
    const slow = game.slowmo;
    if (slow < 0.999 && rdt > 0) { try { this.p.body.update(rdt * (1 - slow)); } catch { /* */ } }
    this.placeLabels();
  }

  // ------------------------------------------------------------ the words
  private showLabels() {
    for (const s of this.spots()) {
      if (this.labels.has(s) || this.hide[s]) continue;
      const w = pxWord(LABEL[s], { font: 'bold', color: '#fff0c0', outline: '#1a0e06', delay: ORDER.indexOf(s) * 120, anim: this.hover === s ? 'wave' : 'pop' });
      this.words.appendChild(w);
      this.labels.set(s, w);
    }
    this.placeLabels();
  }
  private hideLabels() {
    for (const w of this.labels.values()) void wordOut(w);
    this.labels.clear();
  }
  private toCss(x: number, y: number): [number, number] {
    const r = game.r, p = this.p.body.p ?? 1;
    return game.ui.artToCss(r.projectX(x, p), r.projectY(y, p), r.VW, r.VH) as [number, number];
  }
  /** each word sits out to the side of its thing (the pack's word on his back side, the others in front) */
  private placeLabels() {
    const f = this.p.body.facing || 1;
    for (const [s, w] of this.labels) {
      const [x, y] = this.where(s);
      const side = s === 'backpack' ? -f : f;
      const [cx, cy] = this.toCss(x + side * (s === 'backpack' ? 10 : 8), y + (s === 'note' ? -5 : 0));
      const k = this.k;
      let lx = side > 0 ? cx / k : cx / k - w.wW;
      let ly = cy / k - w.wH / 2;
      lx = Math.max(2, Math.min(window.innerWidth / k - w.wW - 2, lx));
      ly = Math.max(2, Math.min(window.innerHeight / k - w.wH - 2, ly));
      w.style.left = Math.round(lx) + 'px';
      w.style.top = Math.round(ly) + 'px';
    }
  }

  // ------------------------------------------------------------ input
  private spotAt(cx: number, cy: number): Spot | null {
    let best: Spot | null = null, bd = Infinity;
    const z = this.st.cam.zoom * (window.innerHeight / game.r.VH);
    for (const s of this.spots()) {
      if (this.hide[s]) continue;
      const [x, y] = this.where(s);
      const [sx, sy] = this.toCss(x, y);
      const rad = (s === 'backpack' ? 12 : 8) * z;
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < rad && d < bd) { bd = d; best = s; }
      // the word itself
      const w = this.labels.get(s);
      if (w) {
        const r = w.getBoundingClientRect();
        if (cx >= r.left - 6 && cx <= r.right + 6 && cy >= r.top - 6 && cy <= r.bottom + 6) { best = s; bd = 0; }
      }
    }
    return best;
  }
  private onBody(cx: number, cy: number): boolean {
    const p = this.p;
    const [x0, y0] = this.toCss(p.x - 9, p.y - (p.height || 62));
    const [x1, y1] = this.toCss(p.x + 9, p.y);
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  }
  private setHover(s: Spot | null) {
    if (s === this.hover) return;
    if (this.hover) { const w = this.labels.get(this.hover); if (w) wordAnim(w, 'pop'); }
    this.hover = s;
    if (s) { const w = this.labels.get(s); if (w) wordAnim(w, 'wave'); audio.play('ui', { vol: 0.12, pitch: 1.6 }); }
    this.layer.style.cursor = s ? 'pointer' : 'default';
    // he shows off the thing under the pointer (the camera lifted off his chest, thumbs in the pack
    // straps, a pat on the pocket)
    this.present(s);
  }
  private present(s: Spot | null) {
    if (!this.poseSet || this.busy || this.done) return;
    const clip = s === 'camera' ? 'inspectCamera' : s === 'backpack' ? 'inspectPack' : s === 'note' ? 'inspectNote' : 'inspect';
    this.p.poseOverride = hasAnim7(clip) ? clip : 'inspect';
  }
  private listen() {
    const L = this.layer;
    L.addEventListener('pointermove', e => { if (!this.busy && e.pointerType === 'mouse') this.setHover(this.spotAt(e.clientX, e.clientY)); });
    L.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (this.busy || this.done) return;
      const s = this.spotAt(e.clientX, e.clientY);
      if (s) { this.setHover(s); void this.pick(s); return; }
      if (this.onBody(e.clientX, e.clientY)) { this.p.body.react('nod'); return; }
      void this.leave();
    });
    L.addEventListener('contextmenu', e => e.preventDefault());
    this.offs.push(pushKeys(e => {
      if (this.done) return true;
      if (this.busy) return e.code === 'Tab' || e.code === 'Escape';
      const c = e.code;
      if (c === 'Escape' || c === 'Tab') { void this.leave(); return true; }
      if (c === 'KeyB' || c === 'KeyI') { void this.pick('backpack'); return true; }
      if ((c === 'KeyC' || c === 'KeyQ') && this.spots().includes('camera')) { void this.pick('camera'); return true; }
      if (c === 'KeyN' || c === 'KeyJ') { void this.pick('note'); return true; }
      if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown' || c === 'KeyA' || c === 'KeyD') {
        const sp = this.spots(), i = this.hover ? sp.indexOf(this.hover) : -1;
        const d = c === 'ArrowLeft' || c === 'ArrowUp' || c === 'KeyA' ? -1 : 1;
        this.setHover(sp[(i + d + sp.length) % sp.length]);
        return true;
      }
      if ((c === 'Enter' || c === 'Space' || c === 'KeyE') && this.hover) { void this.pick(this.hover); return true; }
      return true;
    }));
  }

  // ------------------------------------------------------------ picks
  private async pick(s: Spot) {
    if (this.busy || this.done) return;
    this.busy = true;
    try {
      if (s === 'camera') await this.camera();
      else if (s === 'backpack') await this.backpack();
      else await this.note();
    } catch (e) { console.error('[inspect]', e); }
    this.busy = false;
  }

  /** play one of his clips (if the cast has it), holding the pose override for its length */
  private async clip(anim: string, fallbackMs = 0): Promise<void> {
    const p = this.p;
    if (!hasAnim7(anim)) { if (fallbackMs) await wait(fallbackMs); return; }
    const i = animInfo(anim, 'mori');
    const ms = reduced() ? 60 : Math.max(250, Math.min(1600, (i.frames / Math.max(1, i.fps)) * 1000));
    p.poseOverride = anim;
    await wait(ms);
    p.poseOverride = this.poseSet && !this.done ? 'inspect' : null;
  }

  private async camera() {
    const sc = this.sc, p = this.p;
    const cam = sc.cam;
    if (!cam) {
      audio.play('wrong', { vol: 0.3 });
      this.shake('camera');
      void floatText({ actor: p.body, text: 'Nothing to photograph in here.', style: 'think', ms: 1800 });
      return;
    }
    if (this.camWasUp) {
      // put it away
      this.camWasUp = false;
      audio.play('rustle', { vol: 0.3, pitch: 1.2 });
      await this.leave();
      // (it went down when the inspection began: the player's camera mode played cameraLower then)
      return;
    }
    if (tooHungryForPhotos()) {
      // too hungry to hold it steady: his stomach answers for him
      audio.play('tummy', { vol: 0.7, pitch: 0.9 });
      p.body.react(hasAnim7('growl') ? 'growl' : 'shake');
      p.body.setExpr('sad', 2);
      this.shake('camera');
      void floatText({ actor: p.body, text: 'Too hungry to hold it steady... food first.', style: 'sad', ms: 2400 });
      return;
    }
    // equip: he raises it and the photo mode comes up
    audio.play('focus', { vol: 0.3 });
    await this.leave();
    // (raising it, the player's camera mode plays cameraRaise through its own transition)
    if (game.scene === (sc as unknown) && !sc.cutscene) cam.raise(true);
  }

  private async backpack() {
    this.hideLabels();
    // a hitch of his shoulders, thumbs under the straps, and the pack lifts off his back and hangs
    // open in the air beside him (the camera makes room)
    if (this.poseSet && hasAnim7('inspectPack')) { this.p.poseOverride = 'inspectPack'; await wait(reduced() ? 0 : 380); }
    this.hide.backpack = true;
    audio.play('rustle', { vol: 0.3, pitch: 1.3 });
    const { openBackpack } = await import('../backpack');
    if (this.poseSet) this.p.poseOverride = 'inspect';
    await openBackpack({ fromInspect: true });
    if (this.done) return;
    // back on his back, the camera back on him
    this.hide.backpack = false;
    if (this.shot) await cineTo(this.st, { ...this.shot, secs: reduced() ? 0.05 : 0.45 });
    this.showLabels();
  }

  private async note() {
    this.hideLabels();
    // the note paper out of his pocket, opened in both hands (his sprite holds it now)
    const p = this.p;
    if (hasAnim7('noteRead')) {
      this.hide.note = true;
      p.poseOverride = 'noteRead';
      const i = animInfo('pullNote', 'mori');
      await wait(reduced() ? 60 : Math.min(1600, (i.frames / Math.max(1, i.fps)) * 1000));
    } else { await this.clip('pullNote', 120); this.hide.note = true; }
    audio.play('paperSlide' as never, { vol: 0.35 });
    const { openNotebook } = await import('./notebook');
    await openNotebook({});
    if (this.done) return;
    await this.clip('putNote');
    this.hide.note = false;
    if (this.poseSet) p.poseOverride = 'inspect';
    this.showLabels();
  }

  private shake(s: Spot) {
    const w = this.labels.get(s);
    if (!w) return;
    wordAnim(w, 'shake');
    setTimeout(() => { if (w.isConnected) wordAnim(w, this.hover === s ? 'wave' : 'pop'); }, 600);
  }

  /** ease back out (abort: the scene went away, just tidy up) */
  async leave(abort = false) {
    if (this.done) return;
    this.done = true;
    this.hideLabels();
    for (const f of this.offs) f();
    this.offs = [];
    this.layer.remove();
    this.alphaTo = 0;
    if (this.poseSet && this.p.poseOverride && /^(inspect|pullNote|putNote|noteRead)/.test(this.p.poseOverride)) this.p.poseOverride = null;
    for (const [i, h] of [game.ui.sceneLayer, game.ui.prompts, game.ui.hud].entries()) h.style.opacity = this.hudWas[i] ?? '';
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    cineSlowmo(1, 0.35);
    if (!abort) {
      audio.play('whoosh', { vol: 0.14, pitch: 0.9 });
      await cineRelease(this.st, reduced() ? 0.05 : 0.7);
    }
    for (const d of this.drawables) d.fn = () => {};
    for (const d of this.drawables) this.sc.main.remove(d);
    this.drawables = [];
    // nothing picked with the camera up: it goes back up
    if (this.camWasUp && !abort && game.scene === (this.sc as unknown)) this.sc.cam?.raise(true);
    this.sc.hud?.refresh(true);
    this.resolve();
  }
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
