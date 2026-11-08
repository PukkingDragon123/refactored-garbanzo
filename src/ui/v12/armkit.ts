// V12 the HUD kit's weapon button (src/ui/v11/hud2classic.ts mounts it beside the backpack, the guide,
// the laptop and the camera): the weapon on the belt that G uses right now, as a real object. It only
// shows once Mori carries more than Aroha's slingshot (src/game/v12/arsenal.ts).
//
// The weapon is its own hand-painted item art (src/art/v12/weapons.ts) at the kit's resolution (one art
// pixel per kit art pixel, about two device pixels), lying on a strip of stitched leather with brass
// studs that holds its ammo: the round's little pixel icon and the count punched in pale bold digits
// (red when it's empty). Like the other kit buttons: hover lifts it, a glint runs over it, its name
// floats over it in the menu font and a keycap says T; press squashes it, a click (or T) moves the
// belt on to the next weapon, which swings in with a little wobble and a leather creak.

import { audio } from '../../core/audio';
import { Art, col, shadeC, mixC, bayer } from '../v11/paper/px';
import { pxDraw } from '../pxfont';
import { pxIconBuf } from '../pxicons';
import { PixelBuffer } from '../../art/pixel';
import { itemArtBuffer } from '../../art/v11/itemart';
import { paintKitButton } from '../v11/kitart';
import { WEAPON_BY_ID, selectedWeapon, ammo, ammoMax, cycleWeapon, ownsAnyWeapon, ownedWeapons } from '../../game/v12/arsenal';

const CSS = `
.h2 .hk canvas.kit.arm.hov { animation: kArm 0.5s steps(5); }
@keyframes kArm { 25% { transform: rotate(-6deg) translateY(-3px); } 55% { transform: rotate(4deg); } 80% { transform: rotate(-1deg); } }
.h2 .hk canvas.kit.arm.swap { animation: kSwap 0.42s steps(6); }
@keyframes kSwap { 0% { transform: translateX(-10px) rotate(-14deg) scale(0.9); } 60% { transform: translateX(2px) rotate(5deg); } }
`;
let styled = false;

interface Opts {
  /** device px per kit art pixel, device px per design unit (the HUD's own scale functions) */
  px: () => number;
  k: () => number;
  /** paint a kit button's floating name onto a label canvas */
  label: (cv: HTMLCanvasElement, text: string) => void;
}

/** the leather ammo strip: brass studs, a stitch line, the round's icon and the count */
function paintStrip(a: Art, x0: number, y0: number, w: number, n: number, max: number, icon: string) {
  const h = 9;
  const lea = ['#2a140a', '#4a2614', '#6e3c20', '#94582e', '#b87a46'].map(c => col(c));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = y === 0 || y === h - 1 || x === 0 || x === w - 1;
    const l = 3 - y * 0.35 - (x / w) * 0.6 + (bayer(x, y) - 0.5) * 0.7;
    const c = edge ? lea[0] : lea[Math.max(1, Math.min(4, Math.round(l)))];
    a.put(x0 + x, y0 + y, c);
  }
  for (let x = 2; x < w - 2; x += 2) a.put(x0 + x, y0 + 1, col('#c8a070'));
  for (const sx of [2, w - 3]) { a.put(x0 + sx, y0 + 4, col('#f6d888')); a.put(x0 + sx, y0 + 5, col('#8a6220')); }
  // the round's icon and the count
  const ic = pxIconBuf(icon);
  const iy = y0 + Math.round((h - ic.h) / 2);
  for (let y = 0; y < ic.h; y++) for (let x = 0; x < ic.w; x++) { const c = ic.get(x, y); if (c >>> 24) a.put(x0 + 5 + x, iy + y, c); }
  const t = `${n}/${max}`;
  const b = new PixelBuffer(t.length * 8 + 4, 12);
  pxDraw(b, t, 1, 1, { font: 'bold', color: '#ffffff', bounce: false });
  const fill = n > 0 ? col('#fff2cc') : col('#ff8a6a'), ink = col('#1a0c06');
  let tx = x0 + 7 + ic.w;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!(b.get(x, y) >>> 24)) continue;
    a.put(tx + x, y0 + y - 1, fill);
    if (!(b.get(x, y + 1) >>> 24)) a.put(tx + x, y0 + y, ink);
  }
  void tx;
}

export class ArmKitButton {
  readonly wrap: HTMLElement;
  private cv: HTMLCanvasElement;
  private lab: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private art: Art | null = null;
  private st = { hover: false, press: false, lift: 0, glint: -1 };
  private key = '';
  private shown = '';

  constructor(parent: HTMLElement, readonly o: Opts) {
    if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
    this.wrap = parent.appendChild(document.createElement('div'));
    this.wrap.className = 'kw arm off';
    this.lab = this.wrap.appendChild(document.createElement('canvas'));
    this.lab.className = 'kl';
    this.cv = this.wrap.appendChild(document.createElement('canvas'));
    this.cv.className = 'hd kit arm';
    this.cv.title = 'Weapon belt (T: next weapon, G: use it)';
    this.g = this.cv.getContext('2d')!;
    const react = (cls: string) => { this.cv.classList.remove(cls); void this.cv.offsetWidth; this.cv.classList.add(cls); };
    this.cv.addEventListener('pointerenter', () => {
      this.st.hover = true; this.st.glint = 0;
      this.o.label(this.lab, WEAPON_BY_ID[selectedWeapon()]?.name ?? 'Weapon');
      this.wrap.classList.add('hov'); react('hov');
      audio.play('ui', { vol: 0.06, pitch: 1.1 });
    });
    this.cv.addEventListener('pointerleave', () => { this.st.hover = false; this.st.press = false; this.wrap.classList.remove('hov'); this.cv.classList.remove('press', 'hov'); });
    this.cv.addEventListener('pointerdown', e => { e.stopPropagation(); this.st.press = true; this.cv.classList.add('press'); });
    this.cv.addEventListener('pointerup', e => {
      e.stopPropagation();
      this.cv.classList.remove('press');
      if (this.st.press) this.next();
      this.st.press = false;
    });
  }

  /** the next weapon on the belt (a click, a tap) */
  next() {
    if (ownedWeapons().length < 2) return;
    cycleWeapon(1);
    audio.play('ui', { vol: 0.22, pitch: 0.75 });
    audio.play('rope' as never, { vol: 0.2, pitch: 1.6 });
    this.o.label(this.lab, WEAPON_BY_ID[selectedWeapon()]?.name ?? 'Weapon');
  }

  update(dt: number) {
    const s = this.st;
    const want = s.press ? -1 : s.hover ? 3 : 0;
    s.lift += (want - s.lift) * Math.min(1, dt * 18);
    if (Math.abs(want - s.lift) < 0.05) s.lift = want;
    if (s.glint >= 0) { s.glint += dt / 0.45; if (s.glint > 1) s.glint = -1; }
  }

  /** repaint when something it shows has changed */
  paint(touch: boolean) {
    const on = ownsAnyWeapon();
    this.wrap.classList.toggle('off', !on);
    if (!on) return;
    const id = selectedWeapon(), W = WEAPON_BY_ID[id];
    if (!W) return;
    const n = ammo(id), max = ammoMax(id), px = this.o.px();
    const key = `${id}|${n}|${max}|${px}|${this.o.k()}|${this.st.lift.toFixed(2)}|${this.st.glint.toFixed(2)}|${this.st.hover}|${touch}`;
    if (key === this.key) return;
    this.key = key;
    if (this.shown && this.shown !== id) { this.cv.classList.remove('swap'); void this.cv.offsetWidth; this.cv.classList.add('swap'); if (this.st.hover) this.o.label(this.lab, W.name); }
    this.shown = id;
    // the weapon's own art at one art pixel each; the slingshot (1x2) lies on its side
    const src = itemArtBuffer(W.item);
    const k = this.o.k() / px;
    const box = Math.ceil(52 * 1.6 * k);
    const iw = src ? (W.id === 'sling' ? src.h : src.w) : 24, ih = src ? (W.id === 'sling' ? src.w : src.h) : 24;
    const Wd = Math.max(box, iw + 6), Hd = box + Math.ceil(10 * 1.6 * k);
    const icon = new Art(Wd, box);
    if (src) {
      const ox = Math.round((Wd - iw) / 2), oy = Math.max(0, Math.round((box - 11 - ih) / 2));
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (!(c >>> 24)) continue;
        // (the slingshot turned a quarter so it lies along the strip)
        if (W.id === 'sling') icon.px(ox + y, oy + (src.w - 1 - x), c);
        else icon.px(ox + x, oy + y, c);
      }
    }
    const sw = Math.min(Wd - 4, 40);
    paintStrip(icon, Math.round((Wd - sw) / 2), box - 11, sw, n, max, W.ammoIcon);
    const dpr = window.devicePixelRatio || 1;
    if (!this.art || this.art.w !== Wd || this.art.h !== Hd) {
      this.art = new Art(Wd, Hd);
      this.cv.width = Wd; this.cv.height = Hd;
      this.cv.style.width = (Wd * px) / dpr + 'px';
      this.cv.style.height = (Hd * px) / dpr + 'px';
    } else this.art.d.fill(0);
    paintKitButton(this.art, icon, k * 1.6, { lift: this.st.lift, glint: this.st.glint, key: touch || !this.st.hover ? undefined : 'T', keyGp: Math.max(1, Math.round(k * 1.6 * 0.6)) });
    this.g.putImageData(this.art.img, 0, 0);
  }
}
void shadeC; void mixC;
