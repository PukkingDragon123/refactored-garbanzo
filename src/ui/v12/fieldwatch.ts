// V12 Mori's field watch, up close (user: "full detailed UI and zoom in, super detailed and cool, works
// like a menu"). Click the HUD's watch (or press C) and it comes up off the corner to fill the middle of
// the screen as a big pixel-art object: a vented rubber strap running out of frame, a faceted composite
// case with a carbon weave and hex screws, a brushed steel bezel engraved with the minutes and the
// compass, four knurled pushers with their names engraved beside them, and behind flat sapphire glass a
// colour display that works like a real one:
//   the menu    a carousel of apps; UP / DOWN (W S, arrows, the wheel) to scroll, START (E, Enter, a
//               click on the app) to open, BACK (Esc, Backspace, right click) to go back or put it away
//   CLOCK       the time in big segment digits, seconds round the edge, the day, dusk and dark
//   BODY        stamina (with what hunger has locked), the heart's trace beating at its rate, hunger, the pack
//   SUN         the sun's arc over the day, how long until dark, when to head back
//   COMPASS     the rose turning with the way Mori faces, an arrow home, the place he's in
//   QUEST       the objective he's working on
//   NOTEBOOK, BACKPACK, CAMERA  shortcuts (the watch goes away and the thing opens)
//   LIGHT       the backlight left on
// Picking CLOCK, BODY or SUN also sets what the small watch on the HUD shows. The world softens behind
// it and freezes, like the notebook. No hands: the watch floats on its own.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';
import { pxDraw, pxMeasure, pxWrap } from '../pxfont';
import type { PxFontId } from '../pxfont';
import { softenScene } from './soften';
import { hudHour } from '../v11/hudclock';
import { stamina, staminaMax, isWinded, heartRate } from '../../game/v12/stamina';
import { hunger, hungerWord } from '../../game/v12/hunger';
import { DUSK_HOUR, DARK_HOUR } from '../../game/v12/clock';
import { trackedQuest, currentStepIndex } from '../../game/quests';

// ---------------------------------------------------------------- palette
const H = (s: string) => hex(s);
const CASE = ['#07090b', '#0e1215', '#151a1f', '#1d242a', '#262f36', '#323d46', '#45525c', '#5f6e79'].map(H);
const STEEL = ['#1c2025', '#30363c', '#4a525a', '#6a737b', '#8e979e', '#b3bbc0', '#d7dde0', '#f3f6f7'].map(H);
const STRAP = ['#0a0c0d', '#121618', '#1a2023', '#232b2f', '#2e383d', '#3b474d'].map(H);
const ORANGE = ['#6a2406', '#b8480c', '#ff7a1a', '#ffb062', '#ffe0b8'].map(H);
const D = {
  bg: H('#071014'), bgLit: H('#0a2427'), grid: H('#0c171b'), gridLit: H('#0f3034'),
  ink: H('#eaf7f1'), dim: H('#6f9c98'), faint: H('#2d4a4c'),
  green: H('#4ae08a'), greenD: H('#1e8a4c'), amber: H('#ffcc3a'), amberD: H('#b87a10'),
  red: H('#ff5a3a'), redD: H('#a01e10'), blue: H('#7ad0ff'), blueD: H('#2a6aa8'),
  orange: H('#ff8a2a'), lock: H('#3a2416'), lockH: H('#6a3a1a'), sun: H('#ffc838'), sunL: H('#fff4b0'),
};

const W = 312, HGT = 320, CX = 156, CY = 160, R = 96, RB = R * 0.86, RS = R * 0.7;

// ---------------------------------------------------------------- the apps
type AppId = 'clock' | 'body' | 'sun' | 'compass' | 'quest' | 'notebook' | 'backpack' | 'camera' | 'light';
interface App { id: AppId; name: string; icon: string[]; col: C }
// 11 x 11 icons, '#' the colour, '+' a highlight, 'o' a dark detail
const APPS: App[] = [
  { id: 'clock', name: 'CLOCK', col: D.blue, icon: ['...#####...', '..#.....#..', '.#...+...#.', '#....+....#', '#....+....#', '#....+++..#', '#.........#', '#.........#', '.#.......#.', '..#.....#..', '...#####...'] },
  { id: 'body', name: 'BODY', col: D.red, icon: ['...........', '.##...##...', '####.####..', '#########..', '#########..', '.#######...', '..#####....', '...###.....', '....#......', '...........', '...........'] },
  { id: 'sun', name: 'SUN', col: D.sun, icon: ['.....#.....', '..#.....#..', '....###....', '...#####...', '#.#######.#', '...#####...', '....###....', '..#.....#..', '.....#.....', '###########', '...........'] },
  { id: 'compass', name: 'COMPASS', col: D.orange, icon: ['...#####...', '..#..#..#..', '.#..###..#.', '#...###...#', '#..#####..#', '#....o....#', '#...ooo...#', '#...ooo...#', '.#..ooo..#.', '..#.....#..', '...#####...'] },
  { id: 'quest', name: 'QUEST', col: D.amber, icon: ['.#.........', '.#######...', '.########..', '.#######...', '.######....', '.#.........', '.#.........', '.#.........', '.#.........', '###........', '...........'] },
  { id: 'notebook', name: 'NOTEBOOK', col: H('#c8a06a'), icon: ['.########..', '.#......##.', '.#.####.##.', '.#......##.', '.#.####.##.', '.#......##.', '.#.###..##.', '.#......##.', '.#......##.', '.########..', '...........'] },
  { id: 'backpack', name: 'BACKPACK', col: H('#8ab46a'), icon: ['....###....', '...#...#...', '.#########.', '#####.#####', '#.........#', '#..#####..#', '#..#...#..#', '#..#####..#', '#.........#', '###########', '...........'] },
  { id: 'camera', name: 'CAMERA', col: H('#c8d0d8'), icon: ['...........', '...###.....', '.#########.', '#####.#####', '####.o.####', '###.ooo.###', '####.o.####', '#####.#####', '###########', '...........', '...........'] },
  { id: 'light', name: 'LIGHT', col: H('#9af0e0'), icon: ['....###....', '...#####...', '..#######..', '..#######..', '..#######..', '...#####...', '....###....', '....###....', '....###....', '.....#.....', '...........'] },
];

export interface FieldWatchOpts {
  /** the HUD watch's screen rect: the big one comes up from there and goes back to it */
  from?: DOMRect | null;
  /** shortcuts the HUD wires in (run after the watch is put away) */
  pack?: () => void;
  camera?: () => void;
}

let open: FieldWatch | null = null;
export const fieldWatchOpen = () => !!open;

/** bring the watch up (resolves when it is put away again) */
export function openFieldWatch(o: FieldWatchOpts = {}): Promise<void> {
  if (open) return Promise.resolve();
  const sc = game.scene as unknown as { player?: unknown; cutscene?: boolean } | null;
  if (!sc?.player || sc.cutscene || game.ui.blocking) return Promise.resolve();
  return new Promise(res => { open = new FieldWatch(o, () => { open = null; res(); }); });
}

// ---------------------------------------------------------------- the watch
class FieldWatch {
  private root: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private base: PixelBuffer;
  private buf: PixelBuffer;
  private k = 2;
  private screen: 'menu' | AppId = 'menu';
  private sel = 0;
  private pos = 0;
  private press: Record<string, number> = {};
  private t0 = performance.now();
  private enterT = 0;
  private closing = false;
  private coveredOn = false;
  private softOn = false;
  private raf = 0;
  private heading = 90;
  private ecg: number[] = [];
  private after: (() => void) | null = null;
  private keyFn: (e: KeyboardEvent) => void;
  private wheelFn: (e: WheelEvent) => void;

  constructor(private o: FieldWatchOpts, private done: () => void) {
    css();
    this.root = document.createElement('div');
    this.root.className = 'fw';
    this.cv = this.root.appendChild(document.createElement('canvas'));
    this.cv.width = W; this.cv.height = HGT;
    this.g = this.cv.getContext('2d')!;
    this.base = new PixelBuffer(W, HGT);
    paintBody(this.base);
    this.buf = new PixelBuffer(W, HGT);
    const face = game.save?.vars?.['hud:watchFace'] ?? 0;
    this.sel = Math.max(0, APPS.findIndex(a => a.id === (['clock', 'body', 'sun'] as AppId[])[face]));
    this.pos = this.sel;
    game.ui.modalLayer.appendChild(this.root);
    game.ui.modalOpen++;
    softenScene(true); this.softOn = true;
    this.layout(true);
    audio.play('ui', { vol: 0.12, pitch: 2.2 });
    setTimeout(() => audio.play('ui', { vol: 0.1, pitch: 3.2 }), 160);
    this.keyFn = e => this.key(e);
    this.wheelFn = e => { e.preventDefault(); this.nav(e.deltaY > 0 ? 1 : -1); };
    window.addEventListener('keydown', this.keyFn, true);
    this.root.addEventListener('wheel', this.wheelFn, { passive: false });
    this.root.addEventListener('contextmenu', e => { e.preventDefault(); this.back(); });
    this.root.addEventListener('pointerdown', e => this.click(e));
    window.addEventListener('resize', this.onResize);
    const loop = () => { if (!this.root.isConnected) return; this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  private onResize = () => this.layout(false);

  /** whole-number scale that fits the screen; placed in the middle (or flying up from the HUD) */
  private layout(first: boolean) {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((innerHeight * 0.94 * dpr) / HGT, (innerWidth * 0.9 * dpr) / W);
    this.k = Math.max(1, Math.floor(fit));
    const w = (W * this.k) / dpr, h = (HGT * this.k) / dpr;
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    if (first && this.o.from) {
      const f = this.o.from, s = Math.max(0.12, f.width / w);
      this.cv.style.setProperty('--fx', `${f.left + f.width / 2 - innerWidth / 2}px`);
      this.cv.style.setProperty('--fy', `${f.top + f.height / 2 - innerHeight / 2}px`);
      this.cv.style.setProperty('--fs', String(s));
      this.cv.classList.add('from');
      // (a forced style flush, then off: the transition runs from the corner at once)
      void this.cv.getBoundingClientRect();
      this.cv.classList.remove('from');
    }
  }

  // ---------------------------------------------------------------- input
  private key(e: KeyboardEvent) {
    if (this.closing) return;
    const c = e.code;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (c === 'KeyW' || c === 'ArrowUp' || c === 'KeyA' || c === 'ArrowLeft') { take(); this.push('up'); this.nav(-1); }
    else if (c === 'KeyS' || c === 'ArrowDown' || c === 'KeyD' || c === 'ArrowRight') { take(); this.push('down'); this.nav(1); }
    else if (c === 'KeyE' || c === 'Enter' || c === 'Space') { take(); this.push('start'); this.select(); }
    else if (c === 'Escape' || c === 'Backspace' || c === 'KeyC' || c === 'KeyQ') { take(); this.push('back'); this.back(); }
    else if (c === 'KeyL') { take(); this.push('up'); this.toggleLight(); }
    else take();
  }
  private nav(d: number) {
    if (this.screen !== 'menu') { if (this.screen === 'quest' || this.screen === 'body') return; this.screen = 'menu'; }
    this.sel = (this.sel + d + APPS.length) % APPS.length;
    audio.play('ui', { vol: 0.06, pitch: 3.6 });
  }
  private select() {
    if (this.screen !== 'menu') { this.back(); return; }
    const a = APPS[this.sel];
    audio.play('ui', { vol: 0.1, pitch: 2.8 });
    setTimeout(() => audio.play('ui', { vol: 0.08, pitch: 3.6 }), 80);
    if (a.id === 'notebook') { this.close(() => { void import('./notebook').then(m => m.openNotebook({})); }); return; }
    if (a.id === 'backpack') { this.close(() => this.o.pack?.()); return; }
    if (a.id === 'camera') { this.close(() => this.o.camera?.()); return; }
    if (a.id === 'light') { this.toggleLight(); return; }
    this.screen = a.id;
    // what the HUD's small watch shows follows the last of these looked at
    const face = a.id === 'clock' ? 0 : a.id === 'body' ? 1 : a.id === 'sun' ? 2 : -1;
    if (face >= 0 && game.save) game.save.vars['hud:watchFace'] = face;
  }
  private back() {
    if (this.screen !== 'menu') { this.screen = 'menu'; audio.play('ui', { vol: 0.08, pitch: 2.0 }); return; }
    this.close();
  }
  private toggleLight() {
    if (!game.save) return;
    game.save.vars['watch:light'] = game.save.vars['watch:light'] ? 0 : 1;
    audio.play('ui', { vol: 0.1, pitch: game.save.vars['watch:light'] ? 3.4 : 2.4 });
  }
  private push(id: string) { this.press[id] = 0.14; }

  /** clicks: on a pusher, on the menu's apps, outside the watch (put it away) */
  private click(e: PointerEvent) {
    if (this.closing) return;
    if (e.button === 2) return;
    const r = this.cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * HGT;
    if (x < 0 || y < 0 || x > W || y > HGT) { this.close(); return; }
    for (const p of PUSHERS) {
      if (Math.abs(x - p.x) < 12 && Math.abs(y - p.y) < 13) {
        this.push(p.id);
        if (p.id === 'up') this.nav(-1); else if (p.id === 'down') this.nav(1); else if (p.id === 'start') this.select(); else this.back();
        return;
      }
    }
    const d = Math.hypot(x - CX, y - CY);
    if (d > R + 6) { this.close(); return; }
    if (d < RS && this.screen === 'menu') {
      const off = Math.round((y - CY) / 30);
      if (off === 0) this.select(); else this.nav(off);
    } else if (d < RS) this.back();
  }

  // ---------------------------------------------------------------- close
  private close(then?: () => void) {
    if (this.closing) return;
    this.closing = true;
    this.after = then ?? null;
    audio.play('ui', { vol: 0.1, pitch: 1.8 });
    this.cv.classList.add('out');
    if (this.coveredOn) { this.coveredOn = false; game.covered = Math.max(0, game.covered - 1); }
    if (this.softOn) { this.softOn = false; softenScene(false); }
    setTimeout(() => {
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', this.keyFn, true);
      window.removeEventListener('resize', this.onResize);
      this.root.remove();
      game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
      this.done();
      this.after?.();
    }, 260);
  }

  // ---------------------------------------------------------------- every frame
  private frame() {
    const now = performance.now(), T = (now - this.t0) / 1000;
    const dt = Math.min(0.05, (now - (this.enterT || now)) / 1000);
    this.enterT = now;
    // freeze the world once it has softened (one still frame behind the watch)
    if (!this.coveredOn && !this.closing && T > 0.45) { this.coveredOn = true; game.covered++; }
    for (const k of Object.keys(this.press)) this.press[k] = Math.max(0, this.press[k] - dt);
    this.pos += (this.sel - this.pos) * Math.min(1, dt * 14);
    if (Math.abs(this.sel - this.pos) > APPS.length / 2) this.pos = this.sel;
    const b = this.buf;
    b.data.set(this.base.data);
    paintPushers(b, this.press);
    const lit = !!game.save?.vars?.['watch:light'] || isNight();
    this.paintDisplay(b, T, dt, lit);
    paintGlass(b, T);
    this.g.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), W, HGT), 0, 0);
  }

  // ---------------------------------------------------------------- the display
  private paintDisplay(b: PixelBuffer, T: number, dt: number, lit: boolean) {
    const bg = lit ? D.bgLit : D.bg, gr = lit ? D.gridLit : D.grid;
    for (let y = Math.floor(CY - RS); y <= CY + RS; y++) for (let x = Math.floor(CX - RS); x <= CX + RS; x++) {
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
      if (d > RS) continue;
      b.set(x, y, d > RS - 1.2 ? CASE[0] : (x % 4 === 0 || y % 4 === 0) && d < RS - 3 ? gr : bg);
    }
    // the status bar: the time, GPS, the battery
    const hour = hudHour() ?? 12;
    const tStr = fmtH(hour);
    txt(b, tStr, CX - pxMeasure(tStr, 'tiny') / 2, CY - RS + 9, 'tiny', D.dim);
    if (Math.floor(T * 1.2) % 2 === 0) { b.set(CX - 22, CY - RS + 11, D.green); b.set(CX - 21, CY - RS + 11, D.green); }
    battery(b, CX + 16, CY - RS + 9, D.dim, D.green);
    if (this.screen === 'menu') this.menu(b, T);
    else if (this.screen === 'clock') this.appClock(b, T, hour);
    else if (this.screen === 'body') this.appBody(b, T, dt);
    else if (this.screen === 'sun') this.appSun(b, T, hour);
    else if (this.screen === 'compass') this.appCompass(b, T, dt);
    else if (this.screen === 'quest') this.appQuest(b);
    // the stamina ring round every screen (hatched where hunger locks it; red and blinking winded)
    ring(b, stamina(), staminaMax(), isWinded() && Math.floor(T * 4) % 2 === 0, lit);
    // the hint along the bottom
    if (this.screen === 'menu' || this.screen === 'clock') { const hint = this.screen === 'menu' ? 'START  OPEN' : 'BACK  MENU'; txt(b, hint, CX - pxMeasure(hint, 'tiny') / 2, CY + RS - 14, 'tiny', D.faint); }
  }

  private menu(b: PixelBuffer, T: number) {
    // the carousel: the picked app big in a frame, its neighbours smaller and fading above and below
    const n = APPS.length;
    for (let off = -2; off <= 2; off++) {
      let i = Math.round(this.pos) + off;
      i = ((i % n) + n) % n;
      const a = APPS[i];
      const dy = (i - this.pos + n * 10) % n;
      const rel = dy > n / 2 ? dy - n : dy;
      const y = CY + rel * 30;
      if (Math.abs(rel) > 1.9) continue;
      const big = Math.abs(rel) < 0.5;
      const fade = Math.abs(rel) > 1.2;
      if (big) {
        // the frame: an orange-edged bar with notched corners
        for (let x = CX - 46; x <= CX + 46; x++) for (let yy = y - 13; yy <= y + 13; yy++) {
          const edge = x === CX - 46 || x === CX + 46 || yy === y - 13 || yy === y + 13;
          const corner = (Math.abs(x - CX) > 44 && Math.abs(yy - y) > 11);
          if (corner) continue;
          if (edge) b.set(x, yy, D.orange);
          else if ((x + yy) % 2 === 0) b.set(x, yy, D.faint);
        }
        icon(b, a.icon, CX - 40, y - 11, a.col, 2);
        txt(b, a.name, CX - 14, y - 4, 'bold', D.ink);
        // the arrow on the right edge
        for (let k = 0; k < 4; k++) { b.set(CX + 40 - k, y - k, D.orange); b.set(CX + 40 - k, y + k, D.orange); }
      } else {
        icon(b, a.icon, CX - 30, y - 5, fade ? D.faint : a.col, 1);
        txt(b, a.name, CX - 14, y - 3, 'body', fade ? D.faint : D.dim);
      }
    }
    // the page dots on the right inside the ring
    for (let i = 0; i < n; i++) {
      const a = -0.55 + (i / (n - 1)) * 1.1;
      const x = Math.round(CX + Math.cos(a) * (RS - 11)), y = Math.round(CY + Math.sin(a) * (RS - 11));
      b.set(x, y, i === this.sel ? D.orange : D.faint);
      if (i === this.sel) { b.set(x - 1, y, D.orange); b.set(x, y - 1, D.orange); b.set(x, y + 1, D.orange); }
    }
    void T;
  }

  private appClock(b: PixelBuffer, T: number, hour: number) {
    title(b, 'CLOCK', D.blue);
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60), h12 = ((hh + 11) % 12) + 1;
    const ss = Math.floor((hour * 3600) % 60);
    segText(b, `${h12}:${String(mm).padStart(2, '0')}`, CX - 4, CY - 4, 13, 24, 3, D.ink, Math.floor(T * 2) % 2 === 0);
    txt(b, hh < 12 ? 'AM' : 'PM', CX + 40, CY - 14, 'bold', D.blue);
    txt(b, String(ss).padStart(2, '0'), CX + 40, CY + 2, 'body', D.dim);
    const day = (game.save as unknown as { vars?: Record<string, number> })?.vars?.['v10:day'] ?? null;
    const dl = `DAY ${dayN() ?? day ?? 1}`;
    txt(b, dl, CX - pxMeasure(dl, 'bold') / 2, CY - 36, 'bold', D.dim);
    const l1 = `DUSK ${fmtH(DUSK_HOUR)}`, l2 = `DARK ${fmtH(DARK_HOUR)}`;
    txt(b, l1, CX - 44, CY + 24, 'tiny', D.amber);
    txt(b, l2, CX + 6, CY + 24, 'tiny', D.blue);
    // the seconds round the inside of the ring (in the island's own time)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2, r = RS - 13;
      const x = Math.round(CX + Math.cos(a) * r), y = Math.round(CY + Math.sin(a) * r);
      b.set(x, y, i <= ss ? (i % 5 === 0 ? D.ink : D.blue) : i % 5 === 0 ? D.dim : D.faint);
    }
  }

  private appBody(b: PixelBuffer, T: number, dt: number) {
    const st = stamina(), cap = staminaMax(), wind = isWinded(), bpm = heartRate(), hu = hunger();
    title(b, 'BODY', D.red);
    // stamina: big digits and a long segmented bar (the locked part hatched)
    txt(b, wind ? 'WINDED!' : 'STAMINA', CX - 44, CY - 38, 'tiny', wind ? D.red : D.dim);
    const col = st < 0.25 ? D.red : st < 0.5 ? D.amber : D.green;
    segText(b, `${Math.round(st * 100)}`, CX - 30, CY - 22, 9, 16, 2, col, true);
    txt(b, '%', CX - 4, CY - 22, 'bold', col);
    for (let i = 0; i < 20; i++) {
      const x = CX + 6 + i * 2, on = (i + 0.5) / 20 <= st, lock = (i + 0.5) / 20 > cap;
      for (let y = CY - 30; y < CY - 18; y++) b.set(x, y, on ? (y < CY - 24 ? col : shadeOf(col)) : lock ? ((x + y) & 1 ? D.lockH : D.lock) : D.faint);
    }
    if (cap < 0.99) txt(b, 'HUNGER CAP', CX + 6, CY - 16, 'tiny', D.lockH);
    // the heart's trace: a strip scrolling left, a spike every beat
    // (worked out from the clock, not sampled per frame: smooth at any frame rate)
    const now = performance.now() / 1000, period = 60 / Math.max(40, bpm);
    const wave = (t: number) => { const ph = ((t % period) + period) % period / period; return ph < 0.03 ? -1 : ph < 0.055 ? 4 : ph < 0.075 ? 9 : ph < 0.1 ? -5 : ph < 0.12 ? -1 : ph > 0.24 && ph < 0.34 ? 2 : 0; };
    this.ecg = Array.from({ length: 70 }, (_, i) => wave(now - (69 - i) * 0.03));
    const ph = (((now % period) + period) % period) / period;
    const ex = CX - 44, ey = CY + 6;
    for (let x = 0; x < 70; x++) for (let y = -10; y <= 10; y++) if (x % 7 === 0 || y % 5 === 0) b.set(ex + x, ey + y, D.faint);
    let py = ey;
    this.ecg.forEach((val, i) => {
      const y = ey - val;
      for (let yy = Math.min(py, y); yy <= Math.max(py, y); yy++) b.set(ex + i, yy, D.green);
      py = y;
    });
    const beat = ph < 0.2;
    heartIcon(b, CX + 30, ey - 8, beat);
    txt(b, String(bpm), CX + 30, ey + 2, 'bold', D.ink);
    txt(b, 'BPM', CX + 30, ey + 11, 'tiny', D.dim);
    // hunger: five pips and the word
    const pips = Math.round((1 - hu) * 5);
    txt(b, 'FOOD', CX - 44, CY + 22, 'tiny', D.dim);
    for (let i = 0; i < 5; i++) for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) b.set(CX - 26 + i * 7 + x, CY + 22 + y, i < pips ? (hu > 0.65 ? D.amber : D.green) : D.faint);
    txt(b, hungerWord(hu).toUpperCase(), CX + 12, CY + 22, 'tiny', hu > 0.65 ? D.amber : D.ink);
    void T;
  }

  private appSun(b: PixelBuffer, T: number, hour: number) {
    title(b, 'SUN', D.sun);
    const t0 = 6, t1 = 21, r = 44, bx = CX, by = CY + 10;
    const at = (h: number): [number, number] => { const u = Math.max(0, Math.min(1, (h - t0) / (t1 - t0))); const a = Math.PI + u * Math.PI; return [Math.round(bx + Math.cos(a) * r), Math.round(by + Math.sin(a) * r * 0.6)]; };
    // the sky under the arc, banded by the hour (dithered, no gradients)
    for (let x = -r; x <= r; x++) for (let y = 0; y <= r * 0.6; y++) {
      const nx = x / r, ny = y / (r * 0.6);
      if (nx * nx + ny * ny > 1) continue;
      const u = (x + r) / (2 * r), hrs = t0 + u * (t1 - t0);
      const c = hrs < DUSK_HOUR ? H('#123048') : hrs < DARK_HOUR ? H('#3a2236') : H('#0c1430');
      if (((bx + x) + (by - y)) % 2 === 0) b.set(bx + x, by - y, c);
    }
    for (let i = 0; i <= 40; i++) { const [x, y] = at(t0 + (i / 40) * (t1 - t0)); b.set(x, y, i % 2 ? D.dim : D.faint); }
    for (let x = bx - r - 2; x <= bx + r + 2; x++) b.set(x, by, D.dim);
    const mark = (h: number, c: C, lab: string, left: boolean) => { const [x, y] = at(h); for (let k = -2; k <= 2; k++) b.set(x, y + k, c); txt(b, lab, left ? x - pxMeasure(lab, 'tiny') - 2 : x + 3, y - 8, 'tiny', c); };
    mark(DUSK_HOUR, D.amber, 'DUSK', true);
    mark(DARK_HOUR, D.blue, 'DARK', false);
    const day = hour >= t0 && hour <= t1;
    const [sx, sy] = at(day ? hour : t1);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) b.set(sx + x, sy + y, x + y < 0 ? D.sunL : D.sun);
    if (Math.floor(T * 2) % 2 === 0) for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) b.set(sx + dx, sy + dy, D.sun);
    const rest = DARK_HOUR - hour;
    const late = rest <= 0;
    txt(b, late ? 'GET HOME' : 'DARK IN', CX - pxMeasure(late ? 'GET HOME' : 'DARK IN', 'tiny') / 2, CY + 16, 'tiny', late ? D.red : D.dim);
    if (!late) segText(b, fmtD(rest), CX, CY + 32, 7, 12, 2, rest < 1 ? D.amber : D.ink, true);
    else if (Math.floor(T * 3) % 2 === 0) txt(b, 'LATE!', CX - pxMeasure('LATE!', 'bold') / 2, CY + 26, 'bold', D.red);
    const back = `BACK BY ${fmtH(DUSK_HOUR)}`;
    txt(b, back, CX - pxMeasure(back, 'tiny') / 2, CY - 34, 'tiny', D.amber);
  }

  private appCompass(b: PixelBuffer, T: number, dt: number) {
    title(b, 'COMPASS', D.orange);
    const sc = game.scene as unknown as { player?: { x: number; facing: number } } | null;
    const p = sc?.player;
    const want = p && p.facing < 0 ? 270 : 90;
    let dh = want - this.heading;
    while (dh > 180) dh -= 360;
    while (dh < -180) dh += 360;
    this.heading += dh * Math.min(1, dt * 5);
    // the rose: ticks and letters turning so the way he faces is at the top
    const r = 36, cx = CX, cy = CY + 2;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = ((deg - this.heading) * Math.PI) / 180 - Math.PI / 2;
      const big = deg % 90 === 0, mid = deg % 30 === 0;
      for (let k = 0; k < (big ? 5 : mid ? 3 : 2); k++) b.set(Math.round(cx + Math.cos(a) * (r - k)), Math.round(cy + Math.sin(a) * (r - k)), big ? D.ink : D.dim);
      if (big) {
        const L = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : 'W';
        txt(b, L, Math.round(cx + Math.cos(a) * (r - 11)) - 2, Math.round(cy + Math.sin(a) * (r - 11)) - 3, 'tiny', deg === 0 ? D.orange : D.ink);
      }
    }
    // the lubber line at the top
    for (let k = 0; k < 4; k++) b.set(cx, cy - r - 2 - k, D.orange);
    // home: an arrow pointing the way to camp
    const loc = sceneLoc();
    const wh = wayHomeFn ? wayHomeFn(loc, p?.x ?? 0) : { dir: 0 as const, name: 'The island', depth: 0 };
    const home = wh.dir < 0 ? 270 : wh.dir > 0 ? 90 : this.heading;
    const ha = ((home - this.heading) * Math.PI) / 180 - Math.PI / 2;
    const tip: [number, number] = [cx + Math.cos(ha) * 24, cy + Math.sin(ha) * 24];
    for (let s = 0; s <= 24; s++) { const x = Math.round(cx + Math.cos(ha) * s), y = Math.round(cy + Math.sin(ha) * s); b.set(x, y, D.orange); b.set(x + 1, y, D.orange); }
    for (let k = 1; k < 6; k++) {
      const la = ha + Math.PI * 0.82, rb = ha - Math.PI * 0.82;
      b.set(Math.round(tip[0] + Math.cos(la) * k), Math.round(tip[1] + Math.sin(la) * k), D.orange);
      b.set(Math.round(tip[0] + Math.cos(rb) * k), Math.round(tip[1] + Math.sin(rb) * k), D.orange);
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) b.set(cx + x, cy + y, D.ink);
    const word = wh.dir === 0 ? (wh.depth === 0 ? 'CAMP: HERE' : 'HOME: THIS WAY') : `CAMP: ${wh.dir < 0 ? 'WEST' : 'EAST'}`;
    txt(b, word, CX - pxMeasure(word, 'tiny') / 2, CY + 42, 'tiny', D.orange);
    const nm = wh.name.toUpperCase().slice(0, 18);
    txt(b, nm, CX - pxMeasure(nm, 'tiny') / 2, CY - 38, 'tiny', D.dim);
    void T;
  }

  private appQuest(b: PixelBuffer) {
    title(b, 'QUEST', D.amber);
    const q = trackedQuest();
    if (!q) { txt(b, 'NOTHING TRACKED', CX - pxMeasure('NOTHING TRACKED', 'tiny') / 2, CY, 'tiny', D.dim); return; }
    const i = currentStepIndex(q);
    const step = q.steps[Math.min(i, q.steps.length - 1)];
    let y = CY - 34;
    for (const line of pxWrap(q.title.toUpperCase(), 92, 'tiny').slice(0, 2)) { txt(b, line, CX - pxMeasure(line, 'tiny') / 2, y, 'tiny', D.amber); y += 8; }
    y += 3;
    for (const line of pxWrap(step?.text ?? '', 96, 'body').slice(0, 5)) { txt(b, line, CX - pxMeasure(line, 'body') / 2, y, 'body', D.ink); y += 10; }
    const pr = step?.progress?.();
    if (pr) {
      const [a, n] = pr;
      for (let k = 0; k < n; k++) for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 8; xx++) b.set(CX - n * 5 + k * 10 + xx, y + 4 + yy, k < a ? D.green : D.faint);
    }
    const sx = `STEP ${Math.min(i + 1, q.steps.length)} OF ${q.steps.length}`;
    txt(b, sx, CX - pxMeasure(sx, 'tiny') / 2, CY + 38, 'tiny', D.dim);
  }
}

// ---------------------------------------------------------------- helpers
let wayHomeFn: ((loc: string | null, x: number) => { dir: -1 | 0 | 1; name: string; depth: number }) | null = null;
let locOfFn: ((f: never) => string | null) | null = null;
let dayFn: (() => number) | null = null;
void import('../../game/v12/trails').then(m => { wayHomeFn = m.wayHome; }).catch(() => {});
void import('../../game/v10/field10').then(m => { locOfFn = m.locOf as never; }).catch(() => {});
void import('../../game/v10/day').then(m => { dayFn = m.dayNumber; }).catch(() => {});
const dayN = () => { try { return dayFn?.() ?? null; } catch { return null; } };
function sceneLoc(): string | null {
  try { return locOfFn ? locOfFn(game.scene as never) : null; } catch { return null; }
}
const isNight = () => { const h = hudHour(); return h !== null && (h >= 19.5 || h < 5.6); };
const fmtH = (h: number) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}${hh < 12 ? 'A' : 'P'}`; };
const fmtD = (h: number) => `${Math.floor(h)}:${String(Math.floor((h - Math.floor(h)) * 60)).padStart(2, '0')}`;
const shadeOf = (c: C): C => { const r = c & 255, g = (c >> 8) & 255, bb = (c >> 16) & 255; return ((255 << 24) | (Math.round(bb * 0.62) << 16) | (Math.round(g * 0.62) << 8) | Math.round(r * 0.62)) >>> 0; };
function txt(b: PixelBuffer, t: string, x: number, y: number, font: PxFontId, c: C) { pxDraw(b, t, Math.round(x), Math.round(y), { font, color: c }); }
function title(b: PixelBuffer, t: string, c: C) { txt(b, t, CX - pxMeasure(t, 'bold') / 2, CY - RS + 19, 'bold', c); for (let x = CX - 20; x <= CX + 20; x++) if (x % 2 === 0) b.set(x, CY - RS + 31, D.faint); }
function icon(b: PixelBuffer, rows: string[], x: number, y: number, c: C, k: number) {
  rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const ch = row[xx]; if (ch === '.') continue; const col = ch === '+' ? D.ink : ch === 'o' ? D.bg : c; for (let a = 0; a < k; a++) for (let q = 0; q < k; q++) b.set(x + xx * k + q, y + yy * k + a, col); } });
}
function battery(b: PixelBuffer, x: number, y: number, frame: C, fill: C) {
  for (let i = 0; i < 9; i++) { b.set(x + i, y, frame); b.set(x + i, y + 4, frame); }
  for (let j = 0; j < 5; j++) { b.set(x, y + j, frame); b.set(x + 8, y + j, frame); }
  b.set(x + 9, y + 1, frame); b.set(x + 9, y + 2, frame); b.set(x + 9, y + 3, frame);
  for (let i = 1; i < 6; i++) for (let j = 1; j < 4; j++) b.set(x + i, y + j, fill);
}
function heartIcon(b: PixelBuffer, x: number, y: number, big: boolean) {
  const rows = big ? ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] : ['.......', '.##.##.', '.#####.', '..###..', '...#...', '.......'];
  rows.forEach((row, yy) => { for (let xx = 0; xx < 7; xx++) if (row[xx] === '#') b.set(x + xx, y + yy, xx + yy < 4 ? H('#ff9a9a') : D.red); });
}
/** segment digits (a modern watch's numerals): w x h each, stroke t, centred on x; the colon blinks */
function segText(b: PixelBuffer, s: string, x: number, y: number, w: number, h: number, t: number, c: C, colon: boolean) {
  const SEG: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
  const gap = Math.max(2, t);
  let width = 0;
  for (const ch of s) width += (ch === ':' ? t + gap : w + gap);
  width -= gap;
  let x0 = Math.round(x - width / 2);
  const y0 = Math.round(y - h / 2), hm = Math.floor(h / 2);
  const hbar = (X: number, Y: number) => { for (let i = 1; i < w - 1; i++) for (let j = 0; j < t; j++) if (!((i === 1 || i === w - 2) && (j === 0 || j === t - 1) && t > 2)) b.set(X + i, Y + j, c); };
  const vbar = (X: number, Y: number, len: number) => { for (let j = 1; j < len - 1; j++) for (let i = 0; i < t; i++) b.set(X + i, Y + j, c); };
  for (const ch of s) {
    if (ch === ':') { if (colon) for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) { b.set(x0 + i, y0 + Math.round(h * 0.3) + j, c); b.set(x0 + i, y0 + Math.round(h * 0.7) - t + j, c); } x0 += t + gap; continue; }
    const on = SEG[ch] ?? '';
    if (on.includes('a')) hbar(x0, y0);
    if (on.includes('g')) hbar(x0, y0 + hm - Math.floor(t / 2));
    if (on.includes('d')) hbar(x0, y0 + h - t);
    if (on.includes('f')) vbar(x0, y0, hm + 1);
    if (on.includes('b')) vbar(x0 + w - t, y0, hm + 1);
    if (on.includes('e')) vbar(x0, y0 + hm, h - hm);
    if (on.includes('c')) vbar(x0 + w - t, y0 + hm, h - hm);
    x0 += w + gap;
  }
}
/** the stamina ring round the inside of the display: segments over 270 degrees, the hunger-locked part hatched */
function ring(b: PixelBuffer, st: number, cap: number, blink: boolean, lit: boolean) {
  const seg = 36, span = Math.PI * 1.5, a0 = Math.PI * 0.75, ro = RS - 2.5, ri = RS - 7;
  const col = blink || st < 0.25 ? [D.redD, D.red] : st < 0.5 ? [D.amberD, D.amber] : [D.greenD, D.green];
  for (let y = Math.floor(CY - ro); y <= CY + ro; y++) for (let x = Math.floor(CX - ro); x <= CX + ro; x++) {
    const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    if (d > ro || d < ri) continue;
    let a = Math.atan2(y + 0.5 - CY, x + 0.5 - CX) - a0;
    while (a < 0) a += Math.PI * 2;
    if (a > span) continue;
    const u = a / span, si = Math.floor(u * seg);
    if (u * seg - si > 0.74) continue;
    const on = (si + 0.5) / seg <= st, lock = (si + 0.5) / seg > cap;
    b.set(x, y, on ? col[d > (ri + ro) / 2 ? 1 : 0] : lock ? ((x + y) & 1 ? D.lockH : D.lock) : lit ? D.gridLit : D.faint);
  }
  // the bolt at the ring's foot
  const bx = CX - 4, by = CY + RS - 9;
  for (const [dx, dy] of [[3, 0], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [1, 4]]) b.set(bx + dx, by + dy, col[1]);
}

// ---------------------------------------------------------------- the body of the watch (painted once)
const PUSHERS: { id: 'up' | 'down' | 'start' | 'back'; x: number; y: number; side: -1 | 1; label: string }[] = [
  { id: 'up', x: CX - R - 4, y: CY - 46, side: -1, label: 'UP' },
  { id: 'down', x: CX - R - 4, y: CY + 46, side: -1, label: 'DOWN' },
  { id: 'start', x: CX + R + 4, y: CY - 46, side: 1, label: 'START' },
  { id: 'back', x: CX + R + 4, y: CY + 46, side: 1, label: 'BACK' },
];

function hs(x: number, y: number, s: number) { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const pick = (r: C[], v: number, x: number, y: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v + bay(x, y) - 0.5)))];

function paintBody(b: PixelBuffer) {
  // ---- the strap: a wide vented rubber band running out of frame top and bottom
  const sw = 112;
  for (let y = 0; y < HGT; y++) {
    if (y > CY - R + 20 && y < CY + R - 20) continue;
    const top = y < CY;
    for (let x = CX - sw / 2; x < CX + sw / 2; x++) {
      const u = (x - (CX - sw / 2)) / sw;
      // the band is curved: lit along the left third, a ridge down each edge
      let v = 2.6 + Math.sin(u * Math.PI) * 1.4 - u * 1.2;
      if (u < 0.06 || u > 0.94) v = 1.2;
      const yy = top ? CY - R - y : y - (CY + R);
      // molded ribs across it and a row of vents
      const rib = ((yy + 400) % 14) < 2;
      const vent = ((yy + 400) % 14) >= 6 && ((yy + 400) % 14) <= 9 && u > 0.22 && u < 0.78 && Math.abs(((u - 0.22) / 0.56) * 5 % 1 - 0.5) < 0.32;
      if (vent) { b.set(Math.round(x), y, STRAP[0]); continue; }
      b.set(Math.round(x), y, pick(STRAP, v + (rib ? 1.1 : 0) + (hs(x, y, 3) > 0.96 ? 0.6 : 0), Math.round(x), y));
    }
  }
  // a steel keeper loop on the lower strap, and the brand stamped into the upper one
  for (let y = CY + R + 26; y < CY + R + 34; y++) for (let x = CX - sw / 2 - 3; x < CX + sw / 2 + 3; x++) {
    const v = y < CY + R + 28 ? 6 : y > CY + R + 32 ? 1.5 : 3.6 - (x - CX) / sw;
    b.set(x, y, pick(STEEL, v, x, y));
  }
  pxDraw(b, 'ZEALANDIA', CX - pxMeasure('ZEALANDIA', 'tiny') / 2, CY - R - 34, { font: 'tiny', color: STRAP[4] });
  pxDraw(b, 'FIELD', CX - pxMeasure('FIELD', 'tiny') / 2, CY - R - 26, { font: 'tiny', color: STRAP[4] });
  // ---- the lugs: chunky horns from the case into the strap
  for (const dir of [-1, 1]) for (const side of [-1, 1]) {
    const lx = CX + side * (sw / 2 - 8), ly = CY + dir * (R - 8);
    for (let j = 0; j < 30; j++) for (let i = -10; i <= 10; i++) {
      const y = ly + dir * j, x = lx + i;
      const w = 10 - j * 0.12;
      if (Math.abs(i) > w) continue;
      const l = 3.4 - i / 10 * side * 1.4 - (dir > 0 ? j * 0.03 : -j * 0.02) + (Math.abs(i) > w - 1 ? -1.5 : 0);
      b.set(x, y, weave(x, y, l));
    }
    // a hex screw in each lug
    screw(b, lx + side * 1, ly + dir * 18);
  }
  // ---- the case: a 12-faceted composite body, carbon weave, each facet lit by its turn to the light
  const facets = 12, seg = (Math.PI * 2) / facets;
  const inCase = (dx: number, dy: number, k = 1) => { const a = Math.atan2(dy, dx); const q = Math.cos((((a % seg) + seg) % seg) - seg / 2); return Math.hypot(dx, dy) * q <= R * k * Math.cos(seg / 2); };
  for (let y = CY - R - 2; y <= CY + R + 2; y++) for (let x = CX - R - 2; x <= CX + R + 2; x++) {
    const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
    if (!inCase(dx, dy)) continue;
    if (d < RB) continue;
    if (!inCase(dx, dy, 0.985)) { b.set(x, y, CASE[0]); continue; }
    const a = Math.atan2(dy, dx), fa = Math.floor((a + Math.PI) / seg) * seg - Math.PI + seg / 2;
    const l = 0.5 + (-Math.cos(fa) * 0.55 - Math.sin(fa) * 0.75) * 0.5;
    // the facet's crease (a lit edge on the upper ones)
    const aa = (((a + Math.PI) % seg) + seg) % seg;
    const crease = aa < 0.05 || aa > seg - 0.05;
    let v = 1.4 + l * 4.4 + (crease ? 1.2 : 0) - (d > R - 3 ? 0.8 : 0) + (d < RB + 2 ? -1.4 : 0);
    b.set(x, y, weave(x, y, v));
    // field wear: scuffs and a scratch or two on the lit shoulders
    if (l > 0.55 && hs(x, y, 7) > 0.985) b.set(x, y, CASE[7]);
  }
  // ---- the bezel: brushed steel, engraved minutes (10..60) and the compass letters
  for (let y = CY - RB; y <= CY + RB; y++) for (let x = CX - RB; x <= CX + RB; x++) {
    const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
    if (d > RB || d < RS) continue;
    const an = Math.atan2(dy, dx);
    let v = 4 + (-dx - dy) / (RB * 1.6) * 2.2 + (Math.sin(an * 90 + d * 0.3) > 0.55 ? 0.6 : 0);
    if (d > RB - 1.5) v = 6.4; else if (d > RB - 3) v -= 1.2;
    if (d < RS + 1.5) v = 1.2;
    b.set(x, y, pick(STEEL, v, x, y));
  }
  const br = (RB + RS) / 2;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const five = i % 5 === 0;
    if (five && i % 15 !== 0) {
      const n = String((i / 5) * 5 || 60);
      const tx = Math.round(CX + Math.cos(a) * br - pxMeasure(n, 'tiny') / 2), ty = Math.round(CY + Math.sin(a) * br - 2.5);
      pxDraw(b, n, tx + 1, ty + 1, { font: 'tiny', color: STEEL[6] });
      pxDraw(b, n, tx, ty, { font: 'tiny', color: STEEL[0] });
    } else if (!five) {
      for (let k = 0; k < 2; k++) b.set(Math.round(CX + Math.cos(a) * (RB - 3 - k)), Math.round(CY + Math.sin(a) * (RB - 3 - k)), STEEL[1]);
    }
  }
  const letters: [string, number, C][] = [['N', -Math.PI / 2, ORANGE[2]], ['E', 0, STEEL[0]], ['S', Math.PI / 2, STEEL[0]], ['W', Math.PI, STEEL[0]]];
  for (const [L, a, c] of letters) {
    const tx = Math.round(CX + Math.cos(a) * br - 1.5), ty = Math.round(CY + Math.sin(a) * br - 2.5);
    pxDraw(b, L, tx + 1, ty + 1, { font: 'tiny', color: STEEL[6] });
    pxDraw(b, L, tx, ty, { font: 'tiny', color: c });
  }
  // the lume triangle at twelve
  for (let k = 0; k < 4; k++) for (let i = -k; i <= k; i++) b.set(CX + i, Math.round(CY - RB + 2 + k), ORANGE[k < 2 ? 3 : 2]);
  // ---- the pushers' names float beside them in the menus' words, with their keys
  for (const p of PUSHERS) {
    const key = p.id === 'up' ? 'W' : p.id === 'down' ? 'S' : p.id === 'start' ? 'E' : 'ESC';
    const w = pxMeasure(p.label, 'bold'), kw = pxMeasure(key, 'tiny') + 4;
    const tx = p.side < 0 ? p.x - 14 - w : p.x + 14;
    const ty = p.y - 5;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pxDraw(b, p.label, tx + dx, ty + dy, { font: 'bold', color: hex('#140c06') });
    pxDraw(b, p.label, tx, ty, { font: 'bold', color: p.id === 'start' ? ORANGE[3] : hex('#fff2d8') });
    // the keycap under the word
    const kx = p.side < 0 ? tx + w - kw : tx, ky = ty + 12;
    for (let x = 0; x < kw; x++) for (let y = 0; y < 9; y++) {
      const edge = x === 0 || y === 0 || x === kw - 1 || y === 8;
      if (edge && (x === 0 || x === kw - 1) && (y === 0 || y === 8)) continue;
      b.set(kx + x, ky + y, edge ? hex('#140c06') : y > 6 ? hex('#a89c88') : hex('#e8dcc4'));
    }
    pxDraw(b, key, kx + 2, ky + 2, { font: 'tiny', color: hex('#2a2016') });
    // a leader line from the word to the pusher
    for (let i = 0; i < 6; i++) if (i % 2 === 0) b.set(p.side < 0 ? p.x - 8 - i : p.x + 8 + i, p.y, hex('#fff2d8'));
  }
}

/** carbon weave on the composite: two-tone twill, lit by v */
function weave(x: number, y: number, v: number): C {
  const tw = ((Math.floor((x + y) / 2) + Math.floor((x - y) / 6)) & 1) === 0;
  return pick(CASE, v + (tw ? 0.45 : -0.3), x, y);
}
function screw(b: PixelBuffer, x: number, y: number) {
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    if (Math.abs(i) + Math.abs(j) * 0.6 > 3.6) continue;
    const v = 4 - (i + j) * 0.5;
    b.set(x + i, y + j, pick(STEEL, v, x + i, y + j));
  }
  // the hex socket
  for (const [i, j] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 0]]) b.set(x + i, y + j, i === 0 && j === 0 ? STEEL[0] : STEEL[1]);
}
/** the four pushers: knurled steel, START ringed orange; a pressed one sits in */
function paintPushers(b: PixelBuffer, press: Record<string, number>) {
  for (const p of PUSHERS) {
    const held = (press[p.id] ?? 0) > 0;
    const out = held ? 5 : 8, ph = 18;
    // the stem from the case
    const x0 = p.side < 0 ? Math.round(CX - Math.sqrt(R * R * 0.93 - (p.y - CY) ** 2)) - out : Math.round(CX + Math.sqrt(R * R * 0.93 - (p.y - CY) ** 2));
    for (let i = 0; i < out + 1; i++) for (let j = 0; j < ph; j++) {
      const X = x0 + i, Y = p.y - ph / 2 + j;
      const tip = p.side < 0 ? i < 2 : i > out - 2;
      let c = j === 0 ? STEEL[6] : j === ph - 1 ? STEEL[0] : (j % 2 === 0 ? STEEL[4] : STEEL[2]);
      if (tip) c = j < 3 ? STEEL[7] : STEEL[3];
      if (p.id === 'start' && (p.side < 0 ? i === out - 1 : i === 1)) c = ORANGE[held ? 1 : 2];
      if (held && j > 0 && j < ph - 1 && !tip) c = j % 2 === 0 ? STEEL[3] : STEEL[1];
      b.set(X, Y, c);
    }
  }
}
/** the flat sapphire glass: a soft (dithered) diagonal glare and a glint that drifts */
function paintGlass(b: PixelBuffer, T: number) {
  for (let y = Math.floor(CY - RS); y <= CY + RS; y++) for (let x = Math.floor(CX - RS); x <= CX + RS; x++) {
    const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
    if (d > RS - 1) continue;
    const band = dx + dy;
    if (band < -RS * 0.7 && band > -RS * 0.95 && bay(x, y) < 0.18) b.blend(x, y, hex('#ffffff', 46));
    if (Math.abs(band + RS * 0.55) < 1 && d > RS * 0.55 && bay(x, y) < 0.5) b.blend(x, y, hex('#ffffff', 40));
  }
  const g = ((T * 0.22) % 1.8) - 0.4;
  if (g > 0 && g < 1) {
    const gx = Math.round(CX - RS * 0.7 + g * RS * 1.1), gy = Math.round(CY - RS * 0.6 + g * RS * 0.35);
    for (let i = 0; i < 6; i++) b.blend(gx + i, gy - i, hex('#ffffff', 150));
  }
}

let cssOn = false;
function css() {
  if (cssOn) return;
  cssOn = true;
  const st = document.createElement('style');
  st.textContent = `
.fw { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
.fw canvas { image-rendering: pixelated; image-rendering: crisp-edges; transition: transform 0.32s steps(7), opacity 0.2s steps(3); transform: translate(0, 0) scale(1); }
.fw canvas.from { transition: none; transform: translate(var(--fx), var(--fy)) scale(var(--fs)); opacity: 0.4; }
.fw canvas.out { transform: translate(0, 40%) scale(0.6); opacity: 0; transition: transform 0.24s steps(5), opacity 0.24s steps(4); }`;
  document.head.appendChild(st);
}

// ---------------------------------------------------------------- the C key
let keysOn = false;
export function installWatchKeys(o: () => FieldWatchOpts) {
  if (keysOn || typeof window === 'undefined') return;
  keysOn = true;
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyC' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || open) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const sc = game.scene as unknown as { cutscene?: boolean; player?: unknown; cam?: { active?: boolean } } | null;
    if (!sc?.player || sc.cutscene || game.ui.blocking || game.paused || sc.cam?.active) return;
    if ((game.ui as unknown as { bubbles?: { active?: boolean } }).bubbles?.active) return;
    void openFieldWatch(o());
  });
}
