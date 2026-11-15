// V12 the Bearer's resolve, as an object: a carved bone tag on a flax cord that drops into the top of
// the screen when Matikuku Nui comes through the gate, its name in floating pixel words beside it. Six
// notches along its edge crack off as its nerve breaks; the tag swings and its rim flashes when a hit
// lands, and it is pulled away when the fight ends. Painted by src/art/v12/raid/art.ts resolvePlaque.

import { resolvePlaque } from '../../../art/v12/raid/art';
import { bufCanvas } from '../../../ui/pxkit';

const CSS = `
.raid-tag { position: fixed; left: 50%; top: 0; z-index: 30; pointer-events: none; transform: translate(-50%, -110%); transition: transform 0.5s steps(6); }
.raid-tag.on { transform: translate(-50%, 0); }
.raid-tag .swing { transform-origin: 50% 0; animation: raidSwing 2.6s steps(8) infinite; }
.raid-tag.hit .swing { animation: raidHit 0.42s steps(5) 1; }
@keyframes raidSwing { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(1deg); } 75% { transform: rotate(-1deg); } }
@keyframes raidHit { 0% { transform: rotate(0); } 20% { transform: rotate(-5deg) translateY(2px); } 50% { transform: rotate(4deg); } 80% { transform: rotate(-2deg); } 100% { transform: rotate(0); } }
.raid-tag .nm { position: absolute; left: 100%; top: 38%; margin-left: 0.6em; white-space: nowrap; font-family: 'Jersey 10', 'Silkscreen', monospace; color: #f4e8c8; letter-spacing: 0.08em;
  text-shadow: 2px 0 0 #140a06, -2px 0 0 #140a06, 0 2px 0 #140a06, 0 -2px 0 #140a06, 2px 2px 0 #5a1a0c; line-height: 1; }
.raid-tag .nm small { display: block; font-family: 'Pixelify Sans', monospace; font-size: 0.55em; color: #e8b47a; letter-spacing: 0.04em; margin-top: 0.2em; }
`;

export class ResolveTag {
  private el: HTMLDivElement;
  private holder: HTMLDivElement;
  private k = 1;
  private hitT = 0;
  private scale = 2;
  constructor(name = 'MATIKUKU NUI', sub = 'the great claw') {
    if (!document.getElementById('raid-tag-css')) {
      const st = document.createElement('style');
      st.id = 'raid-tag-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    // about 2 device px per art pixel at 1280x720, in whole steps with the screen (like the kit)
    this.scale = Math.max(2, Math.round(Math.min(innerWidth / 640, innerHeight / 360)));
    this.el = document.createElement('div');
    this.el.className = 'raid-tag';
    this.holder = document.createElement('div');
    this.holder.className = 'swing';
    this.el.appendChild(this.holder);
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.style.fontSize = 13 * this.scale + 'px';
    nm.innerHTML = `${name}<small>${sub}</small>`;
    this.el.appendChild(nm);
    this.paint();
    (document.getElementById('ui') ?? document.body).appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('on'));
  }
  private paint() {
    this.holder.innerHTML = '';
    this.holder.appendChild(bufCanvas(resolvePlaque(this.k, this.hitT > 0 ? 1 : 0), '', this.scale));
  }
  /** its nerve left (0..1); a drop swings the tag */
  set(k: number) {
    const before = Math.ceil(this.k * 6 - 1e-6), after = Math.ceil(Math.max(0, k) * 6 - 1e-6);
    const dropped = k < this.k - 1e-3;
    this.k = Math.max(0, Math.min(1, k));
    if (dropped) {
      this.hitT = 0.25;
      this.el.classList.remove('hit');
      void this.el.offsetWidth;
      this.el.classList.add('hit');
    }
    if (dropped || before !== after) this.paint();
  }
  update(dt: number) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.paint(); }
  }
  hide() {
    this.el.classList.remove('on');
    setTimeout(() => this.el.remove(), 600);
  }
}
