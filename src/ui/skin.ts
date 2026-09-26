// The V3 UI skin: every window is a sheet of parchment in a chunky wooden frame with a green title
// tab, green pixel buttons with dark outlines, square close boxes and stitched inventory slots.
// Everything is generated as pixel art at startup (9-slice border images + a panel painter for
// canvas backdrops), and all UI text uses pixel fonts.

import { PixelBuffer } from '../art/pixel';
import { C } from '../art/color';
import { H, noise } from './laptop-kit';

const toURL = (b: PixelBuffer) => {
  const cv = document.createElement('canvas');
  cv.width = b.w; cv.height = b.h;
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  return cv.toDataURL();
};

export const PAL = {
  out: H('#2a1a10'),
  wood1: H('#5a3a1e'), wood2: H('#7a5028'), wood3: H('#9c6a36'), wood4: H('#c08a48'),
  parch1: H('#e8d5a6'), parch2: H('#f2e4bc'), parch3: H('#d9c290'), parchEdge: H('#b89c68'),
  green1: H('#1f3a1c'), green2: H('#3f7a34'), green3: H('#5aa447'), green4: H('#8ed06a'),
  ink: H('#3a2614'),
};

/** Paint a parchment window with a wooden frame into b (art pixels). Inner rects become recessed wells. */
export function paintParchment(b: PixelBuffer, w: number, h: number, o: { inner?: [number, number, number, number][]; frame?: number } = {}) {
  const F = o.frame ?? 5;
  // outline + wood frame with grain, bevel highlight and a darker inner lip
  b.rect(1, 0, w - 2, h, PAL.out); b.rect(0, 1, w, h - 2, PAL.out);
  b.rectFn(1, 1, w - 2, h - 2, (x, y) => {
    const g = noise(x >> 1, y * 3, 11);
    return g > 0.8 ? PAL.wood3 : g < 0.2 ? PAL.wood1 : PAL.wood2;
  });
  b.rect(2, 1, w - 4, 1, PAL.wood4); b.rect(1, 2, 1, h - 4, PAL.wood3);
  b.rect(2, h - 2, w - 4, 1, PAL.wood1); b.rect(w - 2, 2, 1, h - 4, PAL.wood1);
  // nails in the corners
  for (const [x, y] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) { b.set(x, y, H('#e8d08a')); b.set(x + 1, y + 1, H('#3a2614')); }
  // parchment
  const x0 = F, y0 = F, pw = w - F * 2, ph = h - F * 2;
  b.rect(x0 - 1, y0 - 1, pw + 2, ph + 2, PAL.out);
  b.rectFn(x0, y0, pw, ph, (x, y) => {
    const n = noise(x, y, 5), m = noise(x >> 3, y >> 3, 9);
    if (n > 0.93) return PAL.parch3;
    if (m > 0.78 && n > 0.5) return PAL.parch1;
    return PAL.parch2;
  });
  // burnt edges of the paper
  b.rect(x0, y0, pw, 1, PAL.parchEdge); b.rect(x0, y0 + ph - 1, pw, 1, PAL.parch3);
  b.rect(x0, y0, 1, ph, PAL.parch3); b.rect(x0 + pw - 1, y0, 1, ph, PAL.parch3);
  for (const [x, y, ww, hh] of o.inner ?? []) well(b, x, y, ww, hh);
}

/** A recessed tan well (list areas, slots). */
export function well(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  b.rect(x - 1, y - 1, w + 2, h + 2, PAL.parchEdge);
  b.rectFn(x, y, w, h, (xx, yy) => (noise(xx, yy, 13) > 0.9 ? H('#cdb07a') : H('#dcc493')));
  b.rect(x, y, w, 1, H('#b8986a'));
}

// ---------------------------------------------------------------- 9-slice images for CSS
function frameImg(): string {
  const b = new PixelBuffer(32, 32);
  paintParchment(b, 32, 32, { frame: 5 });
  return toURL(b);
}
function button(c1: C, c2: C, c3: C, c4: C, pressed = false): string {
  const b = new PixelBuffer(12, 12);
  b.rect(1, 0, 10, 12, PAL.out); b.rect(0, 1, 12, 10, PAL.out);
  b.rect(1, 1, 10, 10, c1);
  b.rect(1, 1, 10, pressed ? 10 : 8, c2);
  b.rect(1, pressed ? 2 : 1, 10, 6, c3);
  if (!pressed) { b.rect(2, 1, 8, 1, c4); b.set(1, 2, c4); }
  return toURL(b);
}
function tab(): string {
  const b = new PixelBuffer(12, 12);
  b.rect(1, 0, 10, 12, PAL.out); b.rect(0, 1, 12, 10, PAL.out);
  b.rect(1, 1, 10, 10, PAL.green2);
  b.rect(1, 1, 10, 4, PAL.green3);
  b.rect(2, 1, 8, 1, PAL.green4);
  b.rect(1, 9, 10, 2, PAL.green1);
  return toURL(b);
}
function slot(): string {
  const b = new PixelBuffer(12, 12);
  b.rect(0, 0, 12, 12, PAL.out);
  b.rect(1, 1, 10, 10, H('#b99a64'));
  b.rect(2, 2, 8, 8, H('#dcc493'));
  b.rect(2, 2, 8, 1, H('#a88a58'));
  b.rect(2, 9, 8, 1, H('#efdcae'));
  return toURL(b);
}
function closeBox(): string {
  const b = new PixelBuffer(9, 9);
  b.rect(0, 0, 9, 9, PAL.out);
  b.rect(1, 1, 7, 7, H('#efe2bd'));
  for (let i = 0; i < 5; i++) { b.set(2 + i, 2 + i, PAL.out); b.set(6 - i, 2 + i, PAL.out); }
  return toURL(b);
}
function bubble(): string {
  const b = new PixelBuffer(12, 12);
  b.rect(2, 0, 8, 12, H('#0c0a0c')); b.rect(0, 2, 12, 8, H('#0c0a0c')); b.rect(1, 1, 10, 10, H('#0c0a0c'));
  b.rect(2, 1, 8, 10, H('#ffffff')); b.rect(1, 2, 10, 8, H('#ffffff'));
  b.rect(2, 9, 8, 1, H('#d8d8e0')); b.rect(10, 3, 1, 6, H('#d8d8e0'));
  return toURL(b);
}

let installed = false;
/** Generate the skin images and install the global pixel theme. */
export function installSkin() {
  if (installed) return;
  installed = true;
  const r = document.documentElement.style;
  r.setProperty('--sk-frame', `url(${frameImg()})`);
  r.setProperty('--sk-btn', `url(${button(PAL.green1, PAL.green2, PAL.green3, PAL.green4)})`);
  r.setProperty('--sk-btn-down', `url(${button(PAL.green1, PAL.green2, PAL.green3, PAL.green4, true)})`);
  r.setProperty('--sk-btn-amber', `url(${button(H('#6a3e0a'), H('#c8841c'), H('#f0b43a'), H('#ffe08a'))})`);
  r.setProperty('--sk-btn-red', `url(${button(H('#4a1410'), H('#a8382a'), H('#d8543e'), H('#ff9a7a'))})`);
  r.setProperty('--sk-btn-wood', `url(${button(PAL.wood1, PAL.wood2, PAL.wood3, PAL.wood4)})`);
  r.setProperty('--sk-tab', `url(${tab()})`);
  r.setProperty('--sk-slot', `url(${slot()})`);
  r.setProperty('--sk-x', `url(${closeBox()})`);
  r.setProperty('--sk-bubble', `url(${bubble()})`);
  const s = document.createElement('style');
  s.dataset.ui = 'skin';
  s.textContent = SKIN_CSS;
  document.head.appendChild(s);
}

const SKIN_CSS = `
:root {
  --pix: 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace;
  --body: 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace;
  --hand: 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace;
  --head: 'Silkscreen', 'Pixelify Sans', ui-monospace, monospace;
  --sk-ink: #3a2614; --sk-ink2: #6a4a2a; --sk-green: #2f6b2a; --sk-u: 3px;
}
#ui { font-family: var(--pix); -webkit-font-smoothing: none; font-smooth: never; }
/* parchment window in a wooden frame */
.panel, .pz-panel {
  background: none !important; clip-path: none !important; box-shadow: 0 6px 0 rgba(0,0,0,0.35) !important;
  border-style: solid; border-width: calc(var(--sk-u) * 6); border-image: var(--sk-frame) 6 fill / calc(var(--sk-u) * 6) / 0 round;
  image-rendering: pixelated; color: var(--sk-ink);
  --paper: #3a2614; --paper2: #5a4024; --paper3: #7a5a34; --amber2: #2f6b2a; --teal2: #2a6a5a; --amber: #c8841c;
}
.panel b, .panel h2, .panel h3, .panel h4 { color: var(--sk-green); }
/* green title tab, e.g. <div class="pz-tab">SETTINGS</div> */
.pz-tab, .modal h2 {
  display: inline-block; font-family: var(--head) !important; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: #fff !important; text-shadow: 0 2px 0 #1f3a1c, 2px 0 0 #1f3a1c, -2px 0 0 #1f3a1c, 0 -2px 0 #1f3a1c;
  border-style: solid; border-width: calc(var(--sk-u) * 3); border-image: var(--sk-tab) 4 fill / calc(var(--sk-u) * 3) / 0 stretch;
  padding: 0.1em 0.9em !important; image-rendering: pixelated; font-size: 1.25em !important; line-height: 1.1;
}
.modal h2 { margin: -0.2em auto 0.6em !important; display: table; }
/* chunky green pixel buttons */
.btn, .pz-btn {
  font-family: var(--head) !important; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.95em;
  color: #fff !important; background: none !important; clip-path: none !important; box-shadow: none !important;
  text-shadow: 0 2px 0 rgba(20,40,16,0.9), 1px 0 0 rgba(20,40,16,0.7), -1px 0 0 rgba(20,40,16,0.7);
  border-style: solid; border-width: calc(var(--sk-u) * 3); border-image: var(--sk-btn) 4 fill / calc(var(--sk-u) * 3) / 0 stretch;
  padding: 0.2em 0.9em !important; image-rendering: pixelated; cursor: pointer; transition: transform 0.06s, filter 0.1s;
}
.btn:hover, .pz-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
.btn:active, .pz-btn:active { border-image-source: var(--sk-btn-down); transform: translateY(2px); }
.btn.ghost { border-image-source: var(--sk-btn-wood); }
.btn.amber, .btn.teal { border-image-source: var(--sk-btn-amber); text-shadow: 0 2px 0 rgba(90,50,0,0.9); }
.btn.red, .btn.drop { border-image-source: var(--sk-btn-red); text-shadow: 0 2px 0 rgba(70,10,0,0.9); }
.btn:disabled { filter: grayscale(0.85) brightness(0.8); cursor: not-allowed; transform: none; }
.btn:focus-visible { outline: 3px solid #fff3a0; outline-offset: 2px; }
/* square close box */
.pz-x, .modal .close { width: calc(var(--sk-u) * 9) !important; height: calc(var(--sk-u) * 9) !important; min-width: 0; padding: 0 !important; font-size: 0 !important;
  border: 0 !important; background: var(--sk-x) center / 100% 100% no-repeat !important; image-rendering: pixelated; cursor: pointer; }
.pz-x:hover, .modal .close:hover { filter: brightness(1.15); }
.pz-slot { border: 0; background: var(--sk-slot) center / 100% 100% no-repeat; image-rendering: pixelated; }
.key { font-family: var(--head) !important; font-weight: 700; border-radius: 0 !important; background: #f2e4bc !important; color: #3a2614 !important;
  box-shadow: 0 0 0 2px #2a1a10, 0 3px 0 2px #2a1a10 !important; margin: 0 0.3em !important; font-size: 0.75em !important; }
/* HUD + toasts on parchment */
.hud-site b { color: #2f6b2a !important; }
.hud-site span { color: #6a4a2a; opacity: 1 !important; }
.objective .t { color: #2f6b2a !important; font-family: var(--head) !important; }
.toast .ic { font-family: var(--head) !important; color: #fff !important; background: #3f7a34 !important; box-shadow: 0 0 0 2px #1f3a1c; }
.toast.coral .ic { background: #a8382a !important; }
.toast.teal .ic { background: #2a7a6a !important; }
.toast b { color: #2f6b2a; }
.prompt { color: #3a2614; }
.titlecard .nm, .titlecard .ch, .titlecard .sub { font-family: var(--head) !important; }
.titlecard .nm { text-shadow: 0 4px 0 #2a1a10, 3px 0 0 #2a1a10, -3px 0 0 #2a1a10, 0 -3px 0 #2a1a10; color: #f2e4bc; }
.modal-wrap { background: rgba(10, 8, 4, 0.5); }
/* parchment windows painted on canvas (backpack, crafting, review) */
.bp-root, .cft-root, .phr-cam { color: #3a2614 !important;
  --paper: #3a2614; --paper2: #5a4024; --paper3: #7a5a34; --amber2: #2f6b2a; --teal2: #2a6a5a; --amber: #b8741c; --teal: #3f7a34; --ink: #2a1a10; --pencil: #3a2614; }
.bp-head .t, .cft-head .t { font-family: var(--head) !important; text-transform: uppercase; color: #fff !important; text-shadow: 0 2px 0 #1f3a1c, 2px 0 0 #1f3a1c, -2px 0 0 #1f3a1c, 0 -2px 0 #1f3a1c !important;
  border-style: solid; border-width: calc(var(--sk-u) * 3); border-image: var(--sk-tab) 4 fill / calc(var(--sk-u) * 3) / 0 stretch; padding: 0.05em 0.7em; font-size: 1.3em !important; }
.cft-rec, .cft-ing, .cft-tool, .bp-detail, .cft-detail { background: rgba(120, 80, 30, 0.12) !important; box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.35) !important; color: #3a2614 !important; }
.cft-rec:hover { background: rgba(120, 80, 30, 0.22) !important; }
.cft-rec.sel { background: rgba(90, 164, 71, 0.28) !important; box-shadow: inset 0 0 0 2px #3f7a34 !important; }
.cft-rec .ic, .bp-dtop .big, .cft-out .big { background: var(--sk-slot) center / 100% 100% no-repeat !important; box-shadow: none !important; image-rendering: pixelated; }
.cft-rec .st.ok { background: #3f7a34 !important; color: #fff !important; }
.cft-rec .st.missing, .cft-ing.no, .cft-tool.no { color: #a8382a !important; }
.cft-rec .st.missing { background: rgba(168,56,42,0.18) !important; }
.cft-rec .st.tool, .cft-rec .st.full { background: rgba(90,60,140,0.18) !important; color: #4a3a8a !important; }
.cft-ing.no { box-shadow: inset 0 0 0 2px rgba(168,56,42,0.7) !important; }
.cft-ing.no b { color: #a8382a !important; }
.cft-msg { color: #a8382a !important; } .cft-msg.ok { color: #2f6b2a !important; }
.bp-slot .n { color: #fff !important; }
.bp-toast { color: #3a2614 !important; background: #f2e4bc !important; box-shadow: 0 0 0 3px #2a1a10, 0 6px 0 rgba(0,0,0,0.4) !important; }
.cft-result { background: radial-gradient(circle at 50% 45%, rgba(255,240,190,0.95), rgba(242,228,188,0.96) 70%) !important; }
.cft-result .n { color: #3a2614 !important; text-shadow: none !important; }
.cft-result .cft-badge { background: #3f7a34 !important; color: #fff !important; box-shadow: 0 0 0 3px #1f3a1c; }

.loading .logo { font-family: var(--head); }
`;
