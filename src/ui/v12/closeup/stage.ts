// V12 close-up stage: the camera pushes in on Mori, the world dims behind a dither, and a big
// hand-painted pixel-art "set" irises open over the screen (the cooking fire, a dig square, a flax
// bush, a mossy log). The set is laid out in units (about 320 x 180) and painted at high density:
// Z fine pixels per unit, each fine pixel 1-2 device pixels, so it reads as polished illustration
// with crisp edges. Each scene paints every frame and reads the pointer (in units) and the keys. The
// stage gives scenes floating per-letter text, particles, shakes, sounds, the brass pocket watch for
// time limits, and the ending: a manila tag drops in on its string and a rubber stamp slams down on it
// (PERFECT / GOOD / ROUGH, or what went wrong). Esc (or the floating BACK) backs out where allowed.

import { game } from '../../../game/game';
import { audio } from '../../../core/audio';
import type { Sfx } from '../../../core/audio';
import { guardInput } from '../../../core/input';
import { pushKeys, reduced } from '../../laptop-kit';
import { drawWatch, watchSize } from '../watch';
import { PixelBuffer, Parts, drawWord, wordW, lineH, dith, hex, mix, blitF, paintBigStamp, pmap, up, clamp01, easeOut, shadeRect, setZ, area, rd, ramp, vnoise, ellipse } from './kit';
import { Z } from './kit';
import type { TextStyle, TextSize } from './kit';
import type { Stage } from '../../../world/stage';

export type Grade = 'perfect' | 'good' | 'rough' | 'fail';
export interface CloseupResult { ok: boolean; score: number; perfect: boolean; grade: Grade; aborted: boolean }

export interface Ptr {
  /** units */
  x: number; y: number;
  down: boolean; pressed: boolean; released: boolean;
  /** units per second */
  vx: number; vy: number;
  touch: boolean;
  /** seconds since the pointer last moved */
  still: number;
}

export interface SetScene {
  /** a word that floats in as the set opens */
  intro?: { text: string; style?: TextStyle };
  /** Esc / BACK backs out (default true) */
  canAbort?: boolean;
  /** (re)lay out for c.W x c.H units (fine buffers are c.W * Z wide) */
  layout(c: Closeup): void;
  update(c: Closeup, dt: number): void;
  draw(c: Closeup, px: PixelBuffer): void;
  /** the picture (fine pixels) and caption on the result tag */
  trophy?(c: Closeup): { img: PixelBuffer; name: string; sub?: string } | null;
  onAbort?(c: Closeup): void;
  dispose?(c: Closeup): void;
}

export interface OpenOpts {
  /** a world point the camera pushes in on (default: Mori) */
  world?: [number, number];
  /** don't move the world camera */
  noPush?: boolean;
}

interface Floater { text: string; x: number; y: number; style: TextStyle; age: number; ms: number; color?: string; outline?: string; size: TextSize; follow?: () => [number, number] }

const INKS: Record<Grade, string> = { perfect: '#c8341e', good: '#2c7a34', rough: '#8a5a1a', fail: '#24346a' };
const WORDS: Record<Grade, string> = { perfect: 'PERFECT', good: 'GOOD', rough: 'ROUGH', fail: 'MISSED' };

// a finger and a mouse for the prompts (hand-drawn, upscaled with the EPX pass)
const FINGER = pmap([
  '...oo....',
  '..owwo...',
  '..owwo...',
  '..owwoo..',
  '..owwowoo',
  'oooowwwwo',
  'owoowwwwo',
  'owwwwwwwo',
  '.owwwwwo.',
  '..owwwwo.',
  '..oooooo.',
], { o: '#1e1008', w: '#f2e2b4' });
const MOUSE = pmap([
  '.ooooooo.',
  'owwwowwwo',
  'owrwowwwo',
  'owwwowwwo',
  'ooooooooo',
  'owwwwwwwo',
  'owwwwwwwo',
  'owwwwwwwo',
  '.owwwwwo.',
  '..ooooo..',
], { o: '#1e1008', w: '#f2e2b4', r: '#c8582e' });

/** a manila tag at the fine grid: clipped corners, fibres, foxing, rules, a brass eyelet */
function paintTagFine(wu: number, hu: number): PixelBuffer {
  const W = Math.round(wu * Z), H = Math.round(hu * Z);
  const b = new PixelBuffer(W, H);
  const P = ramp('#8a6e3e', '#a88a56', '#c4a670', '#d8bc86', '#e6d09e', '#f2e2b8', '#faf0d0');
  const EY = ramp('#5a3a10', '#a8781e', '#e8c45a', '#fff0a8');
  const cut = Math.round(9 * Z), ex = W / 2, ey = 8 * Z;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < cut && (x < cut - y || x > W - 1 - (cut - y))) continue;
    const u = x / Z, v = y / Z;
    const e = Math.min(x, W - 1 - x, y, H - 1 - y, y < cut ? Math.min(x - (cut - y), W - 1 - (cut - y) - x) : 99);
    let t = 0.74 - v / hu * 0.1 + (vnoise(u * 0.9, v * 0.9, 71) - 0.5) * 0.12 + (vnoise(u * 4, v * 0.6, 72) - 0.5) * 0.08;
    if (vnoise(u * 0.35, v * 0.35, 73) > 0.76) t -= 0.14;
    if (e < 1) t = 0.02; else if (e < Z) t -= 0.18;
    if (v > 24 && (y - 24 * Z) % (9 * Z) === 0 && u > 6 && u < wu - 6) t -= 0.1;
    const d = Math.hypot(x - ex, y - ey) / Z;
    if (d < 2.2) continue;
    if (d < 3.4) { b.set(x, y, rd(EY, 0.6 - (y - ey) / (Z * 4), x, y)); continue; }
    if (d < 4.2) t -= 0.2;
    b.set(x, y, rd(P, t, x, y));
  }
  return b;
}

export class Closeup {
  /** the set's size in units */
  W = 320; H = 180;
  /** device px per fine px */
  s = 2;
  t = 0;
  ptr: Ptr = { x: 160, y: 90, down: false, pressed: false, released: false, vx: 0, vy: 0, touch: false, still: 0 };
  parts = new Parts();
  /** the pocket watch this frame, in units (set it every frame you want it) */
  watch: { t01: number; x: number; y: number; size?: number; secs?: number } | null = null;
  /** frozen: the scene is over (the result tag is up) */
  over = false;
  px!: PixelBuffer;
  private out!: PixelBuffer;
  private keys = new Set<string>();
  private hits = new Set<string>();
  private texts: Floater[] = [];
  private shakeA = 0; private shakeT = 0;
  private root: HTMLElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img!: ImageData;
  private phase: 'in' | 'play' | 'result' | 'out' = 'in';
  private pt = 0;
  private raf = 0;
  private last = 0;
  private offs: (() => void)[] = [];
  private resolve!: (r: CloseupResult) => void;
  private result: CloseupResult | null = null;
  private stamp: { word: string; img: PixelBuffer; tag: PixelBuffer; trophy: { img: PixelBuffer; name: string; sub?: string } | null; slammed: boolean } | null = null;
  private irisAt: [number, number] = [0.5, 0.5];
  private lastMove = { x: 0, y: 0, t: 0 };
  private backBox: [number, number, number, number] | null = null;

  constructor(readonly scene: SetScene, readonly o: OpenOpts = {}) {
    this.root = document.createElement('div');
    this.root.className = 'v12-closeup';
    this.root.style.cssText = 'position:fixed;inset:0;z-index:900;pointer-events:auto;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair;';
    this.cv = this.root.appendChild(document.createElement('canvas'));
    this.cv.style.cssText = 'position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;';
    this.g = this.cv.getContext('2d')!;
  }

  // ------------------------------------------------------------ scene helpers
  key(code: string) { return this.keys.has(code); }
  hit(code: string) { return this.hits.has(code); }
  /** the main action this frame: a click / tap, Space, Enter or E */
  act() { return this.ptr.pressed || this.hits.has('Space') || this.hits.has('Enter') || this.hits.has('KeyE'); }
  /** -1..1 from the arrows / WASD */
  axis(): [number, number] {
    const k = this.keys;
    return [(k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0), (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0)];
  }
  get touch() { return this.ptr.touch || game.input.lastDevice === 'touch'; }
  shake(a = 2, secs = 0.25) { if (reduced()) a = Math.min(a, 1); this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, secs); }
  sfx(n: Sfx, o: { vol?: number; pitch?: number } = {}) { try { audio.play(n, { vol: o.vol ?? 0.5, pitch: o.pitch ?? 1 }); } catch { /* */ } }
  /** floating text in the set (per-letter life, wraps, stays on screen); returns a remover */
  say(text: string, x: number, y: number, o: { style?: TextStyle; ms?: number; color?: string; outline?: string; k?: number; size?: TextSize; follow?: () => [number, number] } = {}): () => void {
    const size: TextSize = o.size ?? (o.k && o.k > 1 ? 'big' : 'body');
    const maxW = Math.max(60, this.W - 16);
    const lines: string[] = [];
    let cur = '';
    for (const w of text.split(' ')) {
      const nxt = cur ? cur + ' ' + w : w;
      if (cur && wordW(nxt, { size }) > maxW) { lines.push(cur); cur = w; } else cur = nxt;
    }
    if (cur) lines.push(cur);
    const fs: Floater[] = lines.map((L, i) => {
      const hw = wordW(L, { size }) / 2 + 3;
      const cx = o.follow ? x : Math.max(hw, Math.min(this.W - hw, x));
      return { text: L, x: cx, y: y + i * lineH(size), style: o.style ?? 'say', age: -i * 0.15, ms: (o.ms ?? 1600) + i * 150, color: o.color, outline: o.outline, size, follow: o.follow };
    });
    this.texts.push(...fs);
    return () => { for (const f of fs) f.ms = Math.min(f.ms, Math.max(0, f.age) * 1000); };
  }
  /** a prompt drawn this frame: a key cap (or the finger / mouse) and a few words (units) */
  prompt(px: PixelBuffer, text: string, x: number, y: number, cap = 'E', style: TextStyle = 'hint') {
    const tw = wordW(text, { size: 'small' });
    const bob = Math.round(Math.sin(this.t * 5) * Z * 0.5);
    const icon = this.touch || cap === 'mouse';
    const cw = icon ? 10 : this.capW(cap);
    const gx = x - (tw + cw + 3) / 2;
    if (icon) blitF(px, up(this.touch ? FINGER : MOUSE, Z), Math.round(gx * Z), Math.round((y - 1) * Z) + bob);
    else this.keycap(px, cap, gx, y - 2, bob);
    drawWord(px, text, gx + cw + 3, y - 1, { size: 'small', style, t: this.t, align: 'left', color: '#fff6dc' });
  }
  private capW(label: string) { return label.length > 1 ? wordW(label, { size: 'small', color: '#1e1008', outline: '#f2e2b4' }) + 6 : 11; }
  /** a painted key cap with a letter (units) */
  keycap(px: PixelBuffer, label: string, x: number, y: number, bobF = 0) {
    const w = this.capW(label), h = 11;
    const FACE = ramp('#a8946e', '#d8c49a', '#f2e2b4', '#fff6dc');
    const yy = y + bobF / Z;
    area(px, x, yy, x + w, yy + h, (u, v, fx, fy) => {
      const lx = u - x, ly = v - yy;
      const r = 2;
      const cx = lx < r ? r - lx : lx > w - r ? lx - (w - r) : 0, cy = ly < r ? r - ly : ly > h - r ? ly - (h - r) : 0;
      if (cx * cx + cy * cy > r * r) return -1;
      const edge = cx * cx + cy * cy > (r - 1 / Z) ** 2 || lx < 1 / Z || ly < 1 / Z || lx > w - 1 / Z || ly > h - 1 / Z;
      if (edge) return hex('#1e1008');
      // the cap's top face and its darker skirt
      return ly > h - 2.5 ? rd(FACE, 0.15, fx, fy) : rd(FACE, 0.85 - ly / h * 0.4 - (lx > w - 2 ? 0.2 : 0), fx, fy);
    });
    drawWord(px, label, x + w / 2, yy + 1, { size: 'small', color: '#1e1008', outline: '#f2e2b4', align: 'center' });
  }
  /** end the scene: the tag and the stamp, then back to the world */
  finish(grade: Grade, score: number, o: { word?: string } = {}) {
    if (this.over) return;
    this.over = true;
    const ok = grade !== 'fail';
    this.result = { ok, score: clamp01(score), perfect: grade === 'perfect', grade, aborted: false };
    const word = o.word ?? WORDS[grade];
    const trophy = this.scene.trophy?.(this) ?? null;
    this.stamp = { word, img: paintBigStamp(word, INKS[grade], word.length), tag: paintTagFine(trophy ? 112 : 96, trophy ? 104 : 56), trophy, slammed: false };
    this.phase = 'result';
    this.pt = 0;
  }

  /** testing: lay the scene out at W x H units (z fine px each), let it run a moment, paint it */
  debugSnap(W: number, H: number, z: number, prep: (c: Closeup) => void, secs = 1): PixelBuffer {
    setZ(z); this.W = W; this.H = H;
    this.px = new PixelBuffer(W * z, H * z);
    this.scene.layout(this);
    prep(this);
    for (let i = 0; i < secs * 30; i++) { this.t += 1 / 30; if (!this.over) this.scene.update(this, 1 / 30); this.parts.step(1 / 30); for (const f of this.texts) f.age += 1 / 30; this.ptr.pressed = false; this.hits.clear(); }
    this.scene.draw(this, this.px);
    this.parts.draw(this.px);
    this.drawTexts();
    return this.px;
  }

  // ------------------------------------------------------------ run
  run(): Promise<CloseupResult> {
    const p = new Promise<CloseupResult>(r => (this.resolve = r));
    // (a console handle for testing: window.__closeup)
    (window as unknown as { __closeup?: unknown }).__closeup = this;
    (game.ui.modalLayer ?? document.body).appendChild(this.root);
    game.ui.modalOpen++;
    this.fit();
    this.listen();
    this.pushIn();
    this.scene.layout(this);
    if (this.scene.intro) this.say(this.scene.intro.text, this.W / 2, Math.round(this.H * 0.16), { style: this.scene.intro.style ?? 'shout', ms: 1500, size: 'big', color: '#ffe680' });
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      try { this.frame(dt); } catch (e) { console.error('[closeup]', e); this.close({ ok: false, score: 0, perfect: false, grade: 'fail', aborted: true }); }
    };
    this.raf = requestAnimationFrame(loop);
    return p;
  }

  private fit() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    const dw = vw * dpr, dh = vh * dpr;
    // 1-2 device px per fine px (more on huge screens, to keep the frame light)
    let s = Math.max(1, Math.round(Math.sqrt(dw * dh / 620000)));
    if (dw * dh / (s * s) > 760000) s++;
    // units of a few fine px, so the set lays out at about 320 x 180
    const z = Math.max(2, Math.round(dh / s / 180));
    setZ(z);
    this.s = s;
    this.W = Math.ceil(dw / s / z);
    this.H = Math.ceil(dh / s / z);
    const FW = this.W * z, FH = this.H * z;
    this.cv.width = FW; this.cv.height = FH;
    const cw = FW * s / dpr, ch = FH * s / dpr;
    this.cv.style.width = cw + 'px'; this.cv.style.height = ch + 'px';
    this.cv.style.left = Math.floor((vw - cw) / 2) + 'px'; this.cv.style.top = Math.floor((vh - ch) / 2) + 'px';
    this.px = new PixelBuffer(FW, FH);
    this.out = new PixelBuffer(FW, FH);
    this.img = new ImageData(new Uint8ClampedArray(this.out.bytes.buffer as ArrayBuffer, this.out.bytes.byteOffset, this.out.bytes.byteLength), FW, FH);
  }

  private toArt(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * this.W, (e.clientY - r.top) / r.height * this.H];
  }

  private listen() {
    const P = this.ptr;
    const move = (e: PointerEvent) => {
      const [x, y] = this.toArt(e);
      const now = performance.now(), dt = Math.max(0.008, (now - this.lastMove.t) / 1000);
      if (this.lastMove.t) { P.vx = P.vx * 0.5 + (x - this.lastMove.x) / dt * 0.5; P.vy = P.vy * 0.5 + (y - this.lastMove.y) / dt * 0.5; }
      this.lastMove = { x, y, t: now };
      P.x = x; P.y = y; P.still = 0;
      P.touch = e.pointerType === 'touch';
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      move(e);
      P.down = true; P.pressed = true;
      try { this.root.setPointerCapture(e.pointerId); } catch { /* */ }
      // the floating BACK
      const b = this.backBox;
      if (b && this.phase === 'play' && P.x >= b[0] && P.x <= b[0] + b[2] && P.y >= b[1] && P.y <= b[1] + b[3]) { P.pressed = false; P.down = false; this.abort(); }
      if (this.phase === 'result' && this.pt > 0.9) this.leave();
    };
    const upH = (e: PointerEvent) => { move(e); if (P.down) P.released = true; P.down = false; };
    this.root.addEventListener('pointerdown', down);
    this.root.addEventListener('pointermove', move);
    this.root.addEventListener('pointerup', upH);
    this.root.addEventListener('pointercancel', upH);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    const keyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    window.addEventListener('keyup', keyUp);
    const blur = () => { this.keys.clear(); P.down = false; };
    window.addEventListener('blur', blur);
    const rs = () => { this.fit(); this.scene.layout(this); };
    window.addEventListener('resize', rs);
    this.offs.push(() => { window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); window.removeEventListener('resize', rs); });
    this.offs.push(pushKeys(e => {
      if (e.repeat) return true;
      this.keys.add(e.code); this.hits.add(e.code);
      if (e.code === 'Escape' && this.phase === 'play') this.abort();
      else if (this.phase === 'result' && this.pt > 0.9 && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape')) this.leave();
      return true;
    }));
  }

  // ------------------------------------------------------------ the camera and the world
  private st: Stage | null = null;
  private wasCut: boolean | undefined;
  private pushIn() {
    const sc = game.scene as unknown as { st?: Stage; player?: { x: number; y: number; height: number }; cutscene?: boolean; css?: (x: number, y: number) => [number, number] } | null;
    if (!sc) return;
    if (typeof sc.cutscene === 'boolean') { this.wasCut = sc.cutscene; sc.cutscene = true; }
    const at: [number, number] | null = this.o.world ?? (sc.player ? [sc.player.x, sc.player.y - (sc.player.height || 60) * 0.4] : null);
    if (at && sc.css) {
      const [cx, cy] = sc.css(at[0], at[1]);
      this.irisAt = [clamp01(cx / window.innerWidth), clamp01(cy / window.innerHeight)];
    }
    if (this.o.noPush || !sc.st?.cam || !at) return;
    this.st = sc.st;
    const st = sc.st;
    void import('../../../game/v11/cine').then(m => {
      if (this.phase === 'out') return;
      try { void m.cineTo(st, { x: at[0], y: at[1], zoom: Math.min(4.5, st.cam.zoom * 1.9), secs: reduced() ? 0.05 : 0.6, ease: 'smooth', focus: null }); } catch { /* */ }
    });
  }
  private pullOut() {
    const st = this.st;
    if (st) void import('../../../game/v11/cine').then(m => { try { void m.cineRelease(st, reduced() ? 0.05 : 0.5); } catch { /* */ } });
    const sc = game.scene as unknown as { cutscene?: boolean } | null;
    if (sc && this.wasCut !== undefined) sc.cutscene = this.wasCut;
  }

  // ------------------------------------------------------------ the frame
  private frame(dt: number) {
    this.t += dt;
    this.pt += dt;
    const P = this.ptr;
    P.still += dt;
    if (P.still > 0.08) { P.vx *= 0.7; P.vy *= 0.7; }
    const inT = reduced() ? 0.12 : 0.55, outT = reduced() ? 0.1 : 0.4;
    if (this.phase === 'in' && this.pt >= inT) {
      this.phase = 'play'; this.pt = 0;
      // the set covers the screen: the world freezes behind it (the GPU is the set's)
      if (!this.covering) { this.covering = true; game.covered++; }
    }
    if (this.phase === 'play' && !this.over) this.scene.update(this, dt);
    if (this.phase === 'result' && this.pt > 3.6) this.leave();
    this.parts.step(dt);
    for (const f of this.texts) f.age += dt;
    this.texts = this.texts.filter(f => f.age * 1000 < f.ms);
    this.shakeT -= dt;
    if (this.shakeT <= 0) this.shakeA = 0;
    // paint the set
    this.watch = this.phase === 'play' ? this.watch : null;
    this.scene.draw(this, this.px);
    this.parts.draw(this.px);
    this.drawTexts();
    if (this.phase === 'result') this.drawResult(this.stamp!);
    else if (this.phase === 'play' && this.scene.canAbort !== false) this.drawBack();
    // composite: shake, the iris and the dithered dim of the world
    const sa = this.shakeA * Z;
    const sx = sa > 0 ? Math.round((Math.random() - 0.5) * 2 * sa) : 0, sy = sa > 0 ? Math.round((Math.random() - 0.5) * 2 * sa) : 0;
    const W = this.px.w, Hh = this.px.h, src = this.px.data, dst = this.out.data;
    let k = 1, dim = 0.7;
    if (this.phase === 'in') { k = easeOut((this.pt - inT * 0.35) / (inT * 0.65)); dim = Math.min(0.7, this.pt / (inT * 0.5) * 0.7); }
    if (this.phase === 'out') { k = 1 - easeOut(this.pt / outT); dim = 0.7 * (1 - this.pt / outT); }
    if (k >= 1) {
      if (!sx && !sy) dst.set(src);
      else for (let y = 0; y < Hh; y++) { const v = y - sy; for (let x = 0; x < W; x++) { const u = x - sx; dst[y * W + x] = u >= 0 && v >= 0 && u < W && v < Hh ? src[v * W + u] : 0xff080404; } }
    } else {
      const ix = this.irisAt[0] * W, iy = this.irisAt[1] * Hh;
      const R = Math.hypot(Math.max(ix, W - ix), Math.max(iy, Hh - iy)) * k;
      const DIM = hex('#06040a'), RIM = hex('#2a1a0c'), RIM2 = hex('#e8c45a');
      const e = 3 * Z;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - ix, (y - iy) * 1.1);
        const th = dith(x, y);
        if (d < R - e + th * e * 2) dst[y * W + x] = src[y * W + x];
        else if (d < R - e * 0.3 + th * e) dst[y * W + x] = RIM2;
        else if (d < R + e + th * e) dst[y * W + x] = RIM;
        else dst[y * W + x] = th < dim ? DIM : 0;
      }
    }
    if (this.phase === 'out' && this.pt >= outT) { this.finishClose(); return; }
    this.g.putImageData(this.img, 0, 0);
    const w = this.watch;
    if (w && k >= 1) {
      const sz = Math.min(96, Math.round((w.size ?? 28) * Z * 0.85)), ws = watchSize(sz);
      drawWatch(this.g, Math.round(w.x * Z - ws.w / 2) + sx, Math.round(w.y * Z - ws.h / 2) + sy, sz, w.t01, { secs: w.secs, time: this.t });
    }
    P.pressed = false; P.released = false;
    this.hits.clear();
  }

  private drawTexts() {
    for (const f of this.texts) {
      const [x, y] = f.follow ? f.follow() : [f.x, f.y];
      const leaving = f.ms / 1000 - f.age < 0.2;
      drawWord(this.px, f.text, x, y - (leaving ? (0.2 - (f.ms / 1000 - f.age)) * 30 : 0), { size: f.size, style: f.style, t: this.t, age: f.age, color: f.color ?? (f.style === 'shout' ? '#ffe680' : f.style === 'scared' ? '#d8e8ff' : '#fff6dc'), outline: f.outline });
    }
  }

  private drawBack() {
    const x = 6, y = 5;
    const label = this.touch ? 'BACK' : 'ESC  BACK';
    const w = wordW(label, { size: 'small' }) + 10;
    this.backBox = [x - 3, y - 3, w + 6, 16];
    const hov = this.ptr.x < x + w + 4 && this.ptr.y < y + 14;
    const c = hex(hov ? '#ffe680' : '#e8d8b0'), d = hex('#1e1008');
    // a little painted arrow, then the words
    const ax = Math.round(x * Z), ay = Math.round((y + 4) * Z), th = Math.max(1, Math.round(Z * 0.6));
    for (let i = 0; i < 3 * Z; i++) for (let k = 0; k < th; k++) {
      this.px.set(ax + i + k + 1, ay - i + 1, d); this.px.set(ax + i + k + 1, ay + i + 1, d);
      this.px.set(ax + i + k, ay - i, c); this.px.set(ax + i + k, ay + i, c);
    }
    drawWord(this.px, label, x + 6, y, { size: 'small', align: 'left', color: hov ? '#ffe680' : '#e8d8b0', style: hov ? 'happy' : 'say', t: this.t });
  }

  private drawResult(s: NonNullable<Closeup['stamp']>) {
    const px = this.px, t = this.pt;
    // the set dims a little behind the tag
    shadeRect(px, 0, 0, this.W, this.H, Math.min(0.45, t * 1.2));
    // the tag swings down on its string
    const tw = s.tag.w / Z, th = s.tag.h / Z;
    const drop = easeOut(t / 0.35);
    const sw = Math.sin(t * 7) * Math.max(0, 1 - t);
    const cx = this.W / 2, ty = -th + (this.H / 2 - th / 2 + th) * drop + sw * 2;
    const tx = cx - tw / 2;
    // the string, a twist of hemp
    for (let fy = -40 * Z; fy < (ty + 8) * Z; fy++) {
      const fx = Math.round(cx * Z + sw * (fy - ty * Z) / 40);
      px.set(fx, fy, (fy >> 1) % 2 ? hex('#d8c8a0') : hex('#a8946e'));
      px.set(fx + 1, fy, hex('#6a5434'));
    }
    // a dithered shadow under the tag, then the tag
    ellipse(px, cx + 3, ty + th / 2 + 4, tw / 2 + 2, th / 2 + 2, (_nx, _ny, _u, _v, fx, fy) => (dith(fx, fy) < 0.35 ? mix(px.data[fy * px.w + fx], hex('#000000'), 0.5) : -1));
    blitF(px, s.tag, Math.round(tx * Z), Math.round(ty * Z));
    if (s.trophy) {
      const im = s.trophy.img;
      const room = (tw - 16) * Z, roomH = 54 * Z;
      const k = Math.max(1, Math.min(2, Math.floor(Math.min(room / im.w, roomH / im.h))));
      blitF(px, im, Math.round(cx * Z - im.w * k / 2), Math.round((ty + 14) * Z + (roomH - im.h * k) / 2), { k });
      drawWord(px, s.trophy.name, cx, ty + 70, { size: 'body', color: '#3a2614', outline: '#f2e2b8', t: this.t, style: 'say' });
      if (s.trophy.sub) drawWord(px, s.trophy.sub, cx, ty + 82, { size: 'small', color: '#6a4c26', outline: '#f2e2b8', t: this.t });
    }
    // the stamp slams down
    if (t > 0.45) {
      if (!s.slammed) {
        s.slammed = true;
        this.shake(3, 0.2);
        this.sfx('stamp', { vol: 0.7 });
        this.sfx(this.result?.ok ? (this.result.perfect ? 'catchJingle' : 'qteHit') : 'qteMiss', { vol: 0.45 });
        for (let i = 0; i < 18; i++) this.parts.add('dust', cx + (Math.random() - 0.5) * s.img.w / Z, ty + th * 0.6 + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 30, { c: '#e8d4a2', life: 0.5 });
      }
      const big = t < 0.5 ? 2 : 1;
      const sy = s.trophy ? ty + th - 24 : ty + th / 2 + 2;
      blitF(px, s.img, Math.round((cx + 12) * Z - s.img.w * big / 2), Math.round(sy * Z - s.img.h * big / 2), { k: big, alpha: 0.9 });
    }
    if (t > 1.1) drawWord(px, this.touch ? 'TAP TO GO ON' : 'SPACE TO GO ON', cx, Math.min(this.H - 12, ty + th + 6), { size: 'small', color: '#e8d8b0', style: 'whisper', t: this.t, age: t - 1.1 });
  }

  // ------------------------------------------------------------ leaving
  private abort() {
    if (this.over || this.scene.canAbort === false) return;
    this.over = true;
    this.scene.onAbort?.(this);
    this.close({ ok: false, score: 0, perfect: false, grade: 'fail', aborted: true });
  }
  private leave() { if (this.result && this.phase === 'result') this.close(this.result); }
  private closing: CloseupResult | null = null;
  private covering = false;
  private uncover() { if (this.covering) { this.covering = false; game.covered = Math.max(0, game.covered - 1); } }
  private close(r: CloseupResult) {
    if (this.closing) return;
    this.closing = r;
    this.uncover();
    this.phase = 'out';
    this.pt = 0;
    this.pullOut();
  }
  private finishClose() {
    cancelAnimationFrame(this.raf);
    this.uncover();
    for (const f of this.offs) f();
    this.offs = [];
    try { this.scene.dispose?.(this); } catch (e) { console.error(e); }
    this.root.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    guardInput(300);
    this.resolve(this.closing!);
  }
}

let open: Promise<CloseupResult> | null = null;
/** is a close-up up right now? */
export const closeupOpen = () => !!open;
/** run a close-up scene; resolves when the set has closed */
export function runCloseup(scene: SetScene, o: OpenOpts = {}): Promise<CloseupResult> {
  if (open) return open.then(() => runCloseup(scene, o));
  const c = new Closeup(scene, o);
  open = c.run().finally(() => { open = null; });
  return open;
}
