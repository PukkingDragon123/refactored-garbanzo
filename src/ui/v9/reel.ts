// V9 fishing reel: an on-screen reel in the gold-and-leather UI style (bottom corner, thumb-sized)
// that you wind by dragging round in circles (mouse or touch; the angular speed is the reeling
// speed), with the mouse wheel, or with the keyboard (hold Space / W / Up to crank steadily, add
// Shift to crank hard). It shows everything the fight needs: a tension gauge round the rim (green,
// amber, red), the spool turning with the line (backwards, buzzing, when a fish takes line off the
// drag), a line-out counter, ratchet clicks as it turns, and it shakes when the line is straining.
//
// FishInput merges the reel with the hold / tap input used for casting and striking (keyboard, and
// a press anywhere on the screen that isn't the reel).

import { el } from '../ui';
import { audio } from '../../core/audio';
import { PixelBuffer } from '../../art/pixel';
import { hex, C, withAlpha } from '../../art/color';
import type { HandsController } from '../../art/v11/hands3d';

const CSS = `
.frl { position: absolute; right: max(14px, 2.4vw); bottom: max(12px, 3vh); z-index: 27; touch-action: none; user-select: none; -webkit-user-select: none;
  display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: auto; cursor: grab; transition: opacity 0.35s, transform 0.35s cubic-bezier(.2,1.5,.4,1); }
.frl.off { opacity: 0; transform: translateY(40px) scale(0.8); pointer-events: none; }
.frl.drag { cursor: grabbing; }
.frl canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; filter: drop-shadow(0 5px 0 rgba(0,0,0,0.35)); }
.frl .ctr { font: 700 16px 'Jersey 10', 'Silkscreen', monospace; letter-spacing: 0.06em; color: #ffe9a8; text-shadow: 0 2px 0 #1a0e06, 2px 0 0 #1a0e06, -2px 0 0 #1a0e06, 0 -2px 0 #1a0e06;
  border-style: solid; border-width: 6px; border-image: var(--sk-tab) 4 fill / 6px / 0 stretch; image-rendering: pixelated; padding: 0 8px; line-height: 1.15; white-space: nowrap; margin-top: -10px; }
.frl .ctr b { color: #fff; font-weight: 700; }
.frl .ctr.warn { color: #ff9a7a; }
.frl .tip { position: absolute; bottom: calc(100% + 4px); right: 50%; transform: translateX(50%); white-space: nowrap; pointer-events: none;
  font: 700 17px 'Jersey 10', 'Silkscreen', monospace; letter-spacing: 0.05em; color: #fff6dc; text-shadow: 0 2px 0 #000, 0 0 10px rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.4s; }
.frl .tip.on { opacity: 1; animation: frlTip 0.9s ease-in-out infinite alternate; }
@keyframes frlTip { to { transform: translateX(50%) translateY(-4px); } }
`;
let styled = false;

// gold, leather and brass from the V8 skin (src/ui/skin.ts)
const G = { o: hex('#1a0e06'), g0: hex('#6a4406'), g1: hex('#a87410'), g2: hex('#e0a818'), g3: hex('#ffd84a'), g4: hex('#fff2a8') };
const L = { d: hex('#2a1408'), l0: hex('#4a2a12'), l1: hex('#6a3e1c'), l2: hex('#8a5628'), l3: hex('#a86e36'), l4: hex('#c48a4a') };
const WOOD = [hex('#3a1e0c'), hex('#6a3a1a'), hex('#9a5e2e'), hex('#c88a4e'), hex('#eab878')];
const LINE = [hex('#9aa8b4'), hex('#d8e2ea'), hex('#ffffff')];
const GAUGE: C[] = [hex('#5ac84a'), hex('#9ad84a'), hex('#e8d040'), hex('#f0a030'), hex('#e85a30'), hex('#ff3020')];
const TAU = Math.PI * 2;
const ART = 64;

/** the reel widget (visual only; FishInput feeds it) */
export class Reel {
  readonly el: HTMLElement;
  readonly cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private buf = new PixelBuffer(ART, ART);
  private img: ImageData;
  private ctr: HTMLElement;
  private tipEl: HTMLElement;
  /** handle angle (rad) */
  angle = -Math.PI / 2;
  /** spool angle (rad): turns with the handle, backwards when the drag slips */
  spool = 0;
  /** 0..1+ line tension (gauge, shaking) */
  tension = 0;
  /** line out, metres */
  line = 0;
  /** turns per second the drag is paying out (for the buzz and the backward spin) */
  drag = 0;
  /** gauge off (casting / waiting) */
  gauge = false;
  private clickAcc = 0;
  private dragAcc = 0;
  private scale = 3;
  private shake = 0;
  /** Mori's 3D hand on the knob: an overlay twice the reel's size, centred on it */
  private hands: HandsController | null = null;
  private handBox: HTMLElement | null = null;
  private dead = false;

  constructor(parent: HTMLElement) {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    this.el = el('div', 'frl off');
    this.cv = el('canvas');
    this.cv.width = ART; this.cv.height = ART;
    this.g = this.cv.getContext('2d')!;
    this.img = new ImageData(ART, ART);
    this.ctr = el('div', 'ctr', 'LINE <b>0.0</b> m');
    this.tipEl = el('div', 'tip', '');
    this.el.append(this.tipEl, this.cv, this.ctr);
    parent.appendChild(this.el);
    this.fit();
    window.addEventListener('resize', this.fit);
    this.draw();
    void import('../../art/v11/hands3d').then(m => {
      if (this.dead || !m.HANDS3D.enabled) return;
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;pointer-events:none;';
      this.el.appendChild(box);
      this.handBox = box;
      this.placeBox();
      this.hands = m.mountHands3d(box, { who: 'mori', side: 'right', grid: [ART * 2, ART * 2], scale: 3.6, lights: 'ui', pixel: 3, fov: 34 });
      this.hands.right?.shoulderAt(ART * 2.3, ART * 3.8, 50).setPose('crank');
    });
  }
  private placeBox() {
    const b = this.handBox;
    if (!b) return;
    const s = ART * this.scale;
    b.style.width = b.style.height = s * 2 + 'px';
    // the reel canvas sits under the tip label; centre the box on the canvas
    b.style.left = `calc(50% - ${s}px)`;
    b.style.top = `${this.cv.offsetTop + s / 2 - s}px`;
    this.hands?.layout();
  }
  private fit = () => {
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    this.scale = Math.max(2, Math.min(4, Math.floor((vmin * 0.34) / ART)));
    this.cv.style.width = this.cv.style.height = ART * this.scale + 'px';
    this.placeBox();
  };
  show(on: boolean) { this.el.classList.toggle('off', !on); }
  tip(text: string) { this.tipEl.innerHTML = text; this.tipEl.classList.toggle('on', !!text); }
  /** reel centre and radius in client px (for the drag) */
  centre(): [number, number, number] {
    const r = this.cv.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2];
  }

  /** advance the visuals: dTurn = turns wound in this frame (>= 0) */
  update(dt: number, dTurn: number) {
    this.spool += dTurn * TAU - this.drag * TAU * dt * 1.4;
    // ratchet clicks: six per turn when winding in, a fast buzz when the drag pays line out
    this.clickAcc += dTurn * 6;
    if (this.clickAcc >= 1) {
      const n = Math.floor(this.clickAcc);
      this.clickAcc -= n;
      audio.play('reelClick', { vol: 0.2 + Math.min(0.25, dTurn * 3), pitch: 0.9 + Math.min(0.6, dTurn / Math.max(dt, 1e-3) * 0.18) + Math.random() * 0.06 });
    }
    if (this.drag > 0.05) {
      this.dragAcc -= dt;
      if (this.dragAcc <= 0) { this.dragAcc = 0.11; audio.play('reelDrag', { vol: 0.16 + Math.min(0.3, this.drag * 0.2), pitch: 0.8 + Math.min(0.8, this.drag * 0.3) }); }
    }
    // shake with the strain
    this.shake = Math.max(0, this.tension - 0.62) * 9;
    const sx = this.shake > 0.2 ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake > 0.2 ? (Math.random() - 0.5) * this.shake : 0;
    this.cv.style.transform = sx || sy ? `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${(sx * 0.4).toFixed(1)}deg)` : '';
    const warn = this.line > 16;
    this.ctr.classList.toggle('warn', warn);
    this.ctr.innerHTML = `LINE <b>${this.line.toFixed(1)}</b> m`;
    this.draw();
    const h = this.hands?.right;
    if (h && this.hands) {
      // fingertips round the knob, the wrist circling with it; a touch of strain when the line is tight
      const c = ART / 2 - 0.5, kx = c + Math.cos(this.angle) * 17, ky = c + Math.sin(this.angle) * 17;
      h.setPose('crank', 1, { force: Math.min(1, this.tension) });
      h.reachTo(ART / 2 + kx + (sx || 0) / this.scale, ART / 2 + ky + (sy || 0) / this.scale, 18, { with: 'pinch', fingers: [-0.55, -0.45, -0.7], palm: [-0.35, -0.2, -0.9], follow: 30 });
      this.hands.frame(dt);
    }
  }

  // ------------------------------------------------------------ pixel art
  private draw() {
    const b = this.buf, c = ART / 2 - 0.5;
    b.clear();
    const T = this.tension;
    for (let y = 0; y < ART; y++) for (let x = 0; x < ART; x++) {
      const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let col: C = 0;
      // tension gauge: 18 segments on an arc over the top (from lower-left round to lower-right)
      if (r >= 27.5 && r < 31.5) {
        const u = ((a + Math.PI * 1.25) % TAU + TAU) % TAU / (Math.PI * 1.5);
        if (u <= 1) {
          const seg = Math.floor(u * 18), inSeg = (u * 18) % 1;
          if (r < 28.5 || r > 30.5 || inSeg < 0.14) col = G.o;
          else if (this.gauge && seg / 18 < Math.min(1, T)) col = GAUGE[Math.min(5, Math.floor(seg / 3))];
          else col = r > 29.5 ? L.l0 : L.d;
          // flash the whole gauge red when it's about to go
          if (this.gauge && T > 0.92 && (performance.now() / 90 | 0) % 2 && r >= 28.5 && r <= 30.5 && inSeg >= 0.14) col = hex('#ff5040');
        }
      }
      // gold rim with a black outline, lit from the top-left
      else if (r >= 23.5 && r < 27.5) {
        if (r < 24.3 || r >= 26.9) col = G.o;
        else {
          const lit = -(dx + dy) / (r || 1);
          col = lit > 0.55 ? G.g4 : lit > 0.1 ? G.g3 : lit > -0.45 ? G.g2 : G.g1;
          // knurling: little notches round the rim
          if (((a / TAU) * 40 + 40) % 1 < 0.22) col = lit > 0 ? G.g2 : G.g0;
        }
      }
      // leather side plate with a stitched ring
      else if (r < 23.5) {
        const n = hash(x, y);
        col = n > 0.88 ? L.l4 : n > 0.5 ? L.l3 : L.l2;
        if (dy - dx > 14) col = n > 0.7 ? L.l2 : L.l1;
        if (Math.abs(r - 21) < 0.5 && ((a / TAU) * 36 + 36) % 1 < 0.5) col = L.l4;
        if (Math.abs(r - 21.6) < 0.5 && ((a / TAU) * 36 + 36) % 1 >= 0.5) col = L.d;
        // the spool window: line wound on the spool, dark notches turning with it
        if (r < 16.5) {
          if (r > 15.6) col = G.o;
          else if (r > 14.6) col = G.g1;
          else if (r > 6) {
            const k = Math.floor((r - 6) * 1.6 + (a * 3.2)) % 3;
            col = LINE[(k + 3) % 3];
            const sa = ((a - this.spool) % (TAU / 6) + TAU / 6) % (TAU / 6);
            if (r > 11 && sa < 0.16) col = hex('#5a6a78');
            if (this.drag > 0.3 && r > 12.5 && hash(x + Math.floor(performance.now() / 50), y) < 0.1) col = hex('#ffffff');
          } else if (r > 5) col = G.o;
          else col = r < 1.6 ? G.g4 : -(dx + dy) > 0 ? G.g3 : G.g1;
        }
      }
      if (col) b.data[y * ART + x] = col;
    }
    // the handle: a brass arm from the hub to a big wooden knob
    const ha = this.angle, ex = c + Math.cos(ha) * 17, ey = c + Math.sin(ha) * 17;
    for (let s = 0; s <= 1; s += 0.02) {
      const x = c + (ex - c) * s, y = c + (ey - c) * s;
      for (let w = -1.6; w <= 1.6; w += 0.5) {
        const X = Math.round(x - Math.sin(ha) * w), Y = Math.round(y + Math.cos(ha) * w);
        b.set(X, Y, Math.abs(w) > 1.2 ? G.o : w < 0 ? G.g3 : G.g1);
      }
    }
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d > 6.6) continue;
      const X = Math.round(ex) + x, Y = Math.round(ey) + y;
      if (d > 5.6) b.set(X, Y, G.o);
      else {
        const lit = -(x + y) / (d || 1) * (d / 5.6);
        b.set(X, Y, WOOD[lit > 0.55 ? 4 : lit > 0.1 ? 3 : lit > -0.4 ? 2 : 1]);
      }
    }
    b.set(Math.round(ex) - 2, Math.round(ey) - 3, withAlpha(hex('#fff6e0'), 255));
    // hub screw over the arm
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) b.set(Math.round(c) + x, Math.round(c) + y, x * x + y * y > 3 ? G.o : x + y < 0 ? G.g4 : G.g2);
    this.img.data.set(b.bytes);
    this.g.putImageData(this.img, 0, 0);
  }

  dispose() {
    this.dead = true;
    this.hands?.destroy();
    window.removeEventListener('resize', this.fit);
    this.el.remove();
  }
}

const hash = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Input for the fishing minigame. `down` / `hit()`: hold and press (Space, E, Enter, or a press
 * anywhere on screen except the reel) for casting and striking. `crank`: reeling speed in turns per
 * second from the reel drag, the mouse wheel and the keys (when `keyCrank` is on, holding Space
 * cranks after a moment so a quick tap still strikes).
 */
export class FishInput {
  down = false;
  /** turns per second, smoothed */
  crank = 0;
  /** turns wound this frame */
  dTurn = 0;
  keyCrank = false;
  /** the reel is being dragged */
  dragging = false;
  private hitQ = false;
  private keys = new Set<string>();
  private keyT = 0;
  private rot = 0;
  private dragId = -1;
  private lastA = 0;
  private screenId = -1;
  private wheelT = 0;
  constructor(readonly reel: Reel) {
    window.addEventListener('keydown', this.kd, true);
    window.addEventListener('keyup', this.ku, true);
    window.addEventListener('pointerdown', this.pd, true);
    window.addEventListener('pointermove', this.pm, true);
    window.addEventListener('pointerup', this.pu, true);
    window.addEventListener('pointercancel', this.pu, true);
    window.addEventListener('wheel', this.wh, { capture: true, passive: false });
    window.addEventListener('blur', this.blur);
  }
  private static HOLD = ['Space', 'KeyE', 'Enter'];
  private static CRANK = ['KeyW', 'ArrowUp'];
  private kd = (e: KeyboardEvent) => {
    if (FishInput.HOLD.includes(e.code) || FishInput.CRANK.includes(e.code) || e.code.startsWith('Shift')) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (FishInput.HOLD.includes(e.code)) { if (!this.down) this.hitQ = true; this.down = true; this.keyT = 0; }
  };
  private ku = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (FishInput.HOLD.includes(e.code) && !FishInput.HOLD.some(k => this.keys.has(k)) && this.screenId < 0) this.down = false;
  };
  private onReel(e: PointerEvent) {
    const [cx, cy, r] = this.reel.centre();
    return Math.hypot(e.clientX - cx, e.clientY - cy) < r * 1.08 && !this.reel.el.classList.contains('off');
  }
  private pd = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t?.closest?.('button, .fsh-noinput')) return;
    if (this.onReel(e)) {
      e.preventDefault();
      this.dragId = e.pointerId;
      this.dragging = true;
      this.reel.el.classList.add('drag');
      const [cx, cy] = this.reel.centre();
      this.lastA = Math.atan2(e.clientY - cy, e.clientX - cx);
      this.hitQ = true;
      return;
    }
    if (this.screenId < 0) { this.screenId = e.pointerId; if (!this.down) this.hitQ = true; this.down = true; }
  };
  private pm = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    const [cx, cy, r] = this.reel.centre();
    const dx = e.clientX - cx, dy = e.clientY - cy;
    if (Math.hypot(dx, dy) < r * 0.14) return;
    const a = Math.atan2(dy, dx);
    let d = a - this.lastA;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this.lastA = a;
    // either way round winds in; the handle follows the finger
    this.rot += Math.abs(d);
    this.reel.angle = a;
  };
  private pu = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) { this.dragId = -1; this.dragging = false; this.reel.el.classList.remove('drag'); }
    if (e.pointerId === this.screenId) { this.screenId = -1; if (!FishInput.HOLD.some(k => this.keys.has(k))) this.down = false; }
  };
  private wh = (e: WheelEvent) => {
    e.preventDefault();
    const d = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    this.rot += Math.min(2.5, d * 0.0105);
    this.wheelT = 0.25;
  };
  private blur = () => { this.keys.clear(); this.down = false; this.screenId = -1; this.dragId = -1; this.dragging = false; };

  hit() { const h = this.hitQ; this.hitQ = false; return h; }
  clear() { this.hitQ = false; this.rot = 0; }

  update(dt: number) {
    // keyboard crank: W / Up always, Space when cranking is what it's for (after a short hold)
    if (this.down) this.keyT += dt;
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const keyOn = FishInput.CRANK.some(k => this.keys.has(k)) || (this.keyCrank && FishInput.HOLD.some(k => this.keys.has(k)) && this.keyT > 0.18);
    let turns = this.rot / TAU;
    this.rot = 0;
    if (keyOn) {
      const kt = (shift ? 2.4 : 1.25) * dt;
      turns += kt;
      if (!this.dragging) this.reel.angle += kt * TAU;
    } else if (!this.dragging && turns > 0) this.reel.angle += turns * TAU;
    this.dTurn = turns;
    this.wheelT -= dt;
    const inst = turns / Math.max(dt, 1e-3);
    // smooth over ~0.12 s (wheel ticks and finger jitter), but drop fast when the input stops
    const k = 1 - Math.exp(-dt * (inst > this.crank ? 14 : this.dragging || this.wheelT > 0 ? 5 : 12));
    this.crank += (inst - this.crank) * k;
    if (this.crank < 0.01) this.crank = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this.kd, true);
    window.removeEventListener('keyup', this.ku, true);
    window.removeEventListener('pointerdown', this.pd, true);
    window.removeEventListener('pointermove', this.pm, true);
    window.removeEventListener('pointerup', this.pu, true);
    window.removeEventListener('pointercancel', this.pu, true);
    window.removeEventListener('wheel', this.wh, true);
    window.removeEventListener('blur', this.blur);
  }
}
