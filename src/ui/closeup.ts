// Dave-the-Diver-style cinematic close-ups: a big pixel-art bust of the speaker slides in for
// dramatic lines (shouts, shock, anger, or when a script asks), with speed lines, a colour wash,
// a talking mouth, blinks and a subtle breathing bob. The line's bubble is anchored beside it.

import { el } from './ui';
import { renderBust, BustId, DESIGNS } from '../art/portrait/cast';
import type { PExpr } from '../art/portrait/face';
import type { PixelBuffer } from '../art/pixel';

const CSS = `
.cu { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
.cu .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 60%, transparent 30%, rgba(8,4,12,0.55) 100%); opacity: 0; transition: opacity 0.25s; }
.cu.on .dim { opacity: 1; }
.cu .pn { position: absolute; left: 0; bottom: 0; width: min(62vw, 128vh); height: min(78vh, 96vw); transform: translateX(-105%); transition: transform 0.32s cubic-bezier(.2,1.3,.4,1);
  clip-path: polygon(0 12%, 100% 0, 84% 100%, 0 100%); }
.cu.on .pn { transform: none; }
.cu .bg { position: absolute; inset: 0; background: linear-gradient(160deg, var(--c1, #3a5a8c), var(--c2, #122038)); }
.cu .bg::before { content: ''; position: absolute; left: -50%; top: -50%; width: 200%; height: 200%;
  background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.16) 0deg 1.4deg, transparent 1.4deg 7deg); opacity: 0; }
.cu.speed .bg::before { opacity: 1; animation: cuSpin 0.5s steps(3) infinite; }
@keyframes cuSpin { to { transform: rotate(9deg); } }
.cu .bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 42% 42%, rgba(255,240,210,0.35), transparent 55%); }
.cu .edge { position: absolute; inset: 0; clip-path: polygon(0 12%, 100% 0, 100% 1.6%, 0 13.6%); background: #fff6dc; }
.cu canvas { position: absolute; left: 4%; bottom: -2%; height: 104%; image-rendering: pixelated; image-rendering: crisp-edges; transform-origin: 50% 100%; animation: cuBreath 2.6s ease-in-out infinite; }
@keyframes cuBreath { 50% { transform: translateY(-0.6%) scale(1.005); } }
.cu.shake canvas { animation: cuShake 0.09s steps(2) infinite; }
@keyframes cuShake { 50% { transform: translate(0.6%, -0.4%); } }
.cu .nm { position: absolute; left: 3%; bottom: 5%; font-family: 'Silkscreen', 'Pixelify Sans', monospace; font-weight: 700; font-size: clamp(12px, 1.6vw, 20px); letter-spacing: 0.12em;
  color: #fff; background: #0c0a0c; padding: 0.3em 0.9em 0.25em; box-shadow: inset 0.35em 0 0 var(--c1, #3fbca6), 0 4px 0 rgba(0,0,0,0.4); }
.cu .fl { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.cu.flash .fl { animation: cuFlash 0.25s ease-out; }
@keyframes cuFlash { from { opacity: 0.7; } to { opacity: 0; } }
@media (orientation: portrait) { .cu .pn { width: 100vw; height: 52vh; } }
`;

const COLORS: Record<string, [string, string]> = {
  rowan: ['#3d6fb0', '#101c34'], crowe: ['#b8382c', '#2a0e10'], aroha: ['#a8743e', '#2a1408'], lou: ['#2aa8a0', '#0a2624'], pip: ['#e8762a', '#2a1206'],
};

const cache = new Map<string, HTMLCanvasElement>();
function frame(id: BustId, expr: PExpr, talk: 0 | 1 | 2, blink: boolean): HTMLCanvasElement {
  const key = `${id}|${expr}|${talk}|${blink ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    const buf: PixelBuffer = renderBust(id, expr, { talk, blink, scale: 0.7 });
    c = document.createElement('canvas');
    c.width = buf.w; c.height = buf.h;
    const img = new ImageData(new Uint8ClampedArray(buf.bytes.buffer, buf.bytes.byteOffset, buf.bytes.byteLength).slice(), buf.w, buf.h);
    c.getContext('2d')!.putImageData(img, 0, 0);
    cache.set(key, c);
  }
  return c;
}

export const isCastId = (id: string): id is BustId => id in DESIGNS;

export class CloseUps {
  readonly root: HTMLElement;
  private pn: HTMLElement;
  private cv: HTMLCanvasElement;
  private nm: HTMLElement;
  private who: BustId | null = null;
  private expr: PExpr = 'neutral';
  private t = 0;
  private blinkT = 2;
  private talking: () => boolean = () => false;
  private last = '';

  constructor(parent: HTMLElement) {
    document.head.appendChild(el('style', '', CSS));
    this.root = parent.appendChild(el('div', 'cu'));
    this.root.innerHTML = `<div class="dim"></div><div class="pn"><div class="bg"></div><canvas></canvas><div class="edge"></div><div class="nm"></div></div><div class="fl"></div>`;
    this.pn = this.root.querySelector('.pn') as HTMLElement;
    this.cv = this.root.querySelector('canvas') as HTMLCanvasElement;
    this.nm = this.root.querySelector('.nm') as HTMLElement;
    let last = performance.now();
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
    };
    requestAnimationFrame(tick);
  }

  get active() { return this.who !== null; }

  show(id: BustId, expr: string, o: { name: string; style?: string; talking: () => boolean }) {
    const e = (expr || 'neutral') as PExpr;
    const again = this.who === id;
    this.who = id;
    this.expr = e;
    this.talking = o.talking;
    const [c1, c2] = COLORS[id] ?? COLORS.rowan;
    this.root.style.setProperty('--c1', c1);
    this.root.style.setProperty('--c2', c2);
    this.nm.textContent = o.name.toUpperCase();
    const loud = o.style === 'shout' || e === 'shocked' || e === 'angry' || e === 'scared';
    this.root.classList.toggle('speed', loud);
    this.root.classList.toggle('shake', o.style === 'shout');
    if (!again || loud) { this.root.classList.remove('flash'); void this.root.offsetWidth; this.root.classList.add('flash'); }
    this.root.classList.add('on');
    this.last = '';
    this.draw();
  }

  hide() {
    if (!this.who) return;
    this.who = null;
    this.root.classList.remove('on', 'speed', 'shake');
  }

  /** CSS position for the line's bubble: beside the bust's mouth */
  anchor(): [number, number] {
    const r = this.pn.getBoundingClientRect(), pr = (this.root.parentElement as HTMLElement).getBoundingClientRect();
    return [r.left - pr.left + r.width * 0.98, r.top - pr.top + r.height * 0.5];
  }

  private draw() {
    if (!this.who) return;
    const talk = this.talking() ? ([0, 1, 2, 1] as const)[Math.floor(this.t * 11) % 4] : 0;
    const blink = this.blinkT < 0.12;
    const key = `${this.who}|${this.expr}|${talk}|${blink}`;
    if (key === this.last) return;
    this.last = key;
    const f = frame(this.who, this.expr, talk, blink);
    if (this.cv.width !== f.width) { this.cv.width = f.width; this.cv.height = f.height; }
    const x = this.cv.getContext('2d')!;
    x.clearRect(0, 0, f.width, f.height);
    x.drawImage(f, 0, 0);
  }

  update(dt: number) {
    if (!this.who) return;
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.05) this.blinkT = 2.5 + Math.random() * 3;
    this.draw();
  }
}
