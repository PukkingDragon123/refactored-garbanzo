// Physical UI kit: the shared stylesheet (type, ink colours, tape, pins, clips, stamps, polaroids,
// sticky notes, scraps, checkboxes, underlines, tags) and installPaper(), which puts it in place and
// builds the pixel handwriting font so page layout measures the real glyphs.
//
// Everything is pixel art: images and canvases are image-rendering: pixelated, shadows are hard
// offsets (or dithered sprites), no blur, no smooth gradients, no rotated elements.

import { installPixelFonts, HAND_FAMILY } from './pxfont';
import { ditherBg } from './textures';

export const PAPER_CSS = `
:root {
  --pp-hand: ${HAND_FAMILY};
  --pp-pix: 'Jersey 15', 'Pixelify Sans', ui-monospace, monospace;
  --pp-head: 'Jersey 10', 'Jersey 15', ui-monospace, monospace;
  --pp-type: 'Pixelify Sans', 'Jersey 15', ui-monospace, monospace;
  --pp-label: 'Silkscreen', 'Jersey 10', ui-monospace, monospace;
  --pp-ink: #2a2440; --pp-pencil: #5c574e; --pp-red: #a8321e; --pp-blue: #26408a; --pp-green: #2f6b3a;
  --pp-px: 2px;
  /* crisp type: each size is a whole number of CSS px per font pixel */
  --pp-fs-hand: 20px; --pp-fs-hand3: 30px; --pp-fs-hand4: 40px;
  --pp-fs-j10: 18.6667px; --pp-fs-j10x2: 37.3333px; --pp-fs-j10x3: 56px;
  --pp-fs-j15: 27px; --pp-fs-j15x2: 54px;
  --pp-fs-silk: 16px; --pp-fs-silk3: 24px;
}
#ui .pp-hand, #ui .pp-hand * { font-family: var(--pp-hand); font-size-adjust: none; -webkit-font-smoothing: none; font-weight: 400; font-synthesis: none; letter-spacing: 0; }
#ui .pp-hand b, #ui .pp-hand strong, #ui .pp-hand .bold { font-weight: 700; }
#ui .pp-hand i, #ui .pp-hand em { font-style: normal; }
#ui .pp-pix, #ui .pp-pix * { font-family: var(--pp-pix); font-size-adjust: 0.62; -webkit-font-smoothing: none; font-weight: 400; }
#ui .pp-head, #ui .pp-head * { font-family: var(--pp-head); font-size-adjust: 0.62; -webkit-font-smoothing: none; font-weight: 400; }
#ui .pp-type, #ui .pp-type * { font-family: var(--pp-type); font-size-adjust: 0.56; -webkit-font-smoothing: none; }
#ui .pp-label, #ui .pp-label * { font-family: var(--pp-label); font-size-adjust: none; -webkit-font-smoothing: none; font-weight: 400; letter-spacing: 0; text-transform: uppercase; }
/* exact pixel sizes (no font-size-adjust): use these for crisp text */
#ui .pp-x-hand { font-family: var(--pp-hand); font-size-adjust: none; font-size: var(--pp-fs-hand); line-height: 24px; }
#ui .pp-x-j10 { font-family: var(--pp-head); font-size-adjust: none; font-size: var(--pp-fs-j10); line-height: 20px; }
#ui .pp-x-j10x2 { font-family: var(--pp-head); font-size-adjust: none; font-size: var(--pp-fs-j10x2); line-height: 40px; }
#ui .pp-x-j15 { font-family: var(--pp-pix); font-size-adjust: none; font-size: var(--pp-fs-j15); line-height: 28px; }
#ui .pp-x-silk { font-family: var(--pp-label); font-size-adjust: none; font-size: var(--pp-fs-silk); line-height: 18px; }
.pp-cv { display: inline-block; vertical-align: middle; image-rendering: pixelated; image-rendering: crisp-edges; image-rendering: pixelated; }
.pp-cv.wait { opacity: 0; }
.pp-svg { overflow: visible; }
.pp-doodle { opacity: 0.9; }
/* a painted backdrop canvas behind a piece of paper (it reaches 2 art px past for the shadow) */
.pp-bgcv { position: absolute; left: 0; top: 0; width: calc(100% + 4px); height: calc(100% + 4px); z-index: -1; pointer-events: none; display: block; }
/* tape, pins and clips */
.pp-tape { position: absolute; display: block; height: 18px; z-index: 3; pointer-events: none; }
.pp-pin { position: absolute; display: block; width: 20px; height: 24px; z-index: 4; pointer-events: none; background: center / 100% 100% no-repeat; image-rendering: pixelated; }
.pp-clip { position: absolute; display: block; width: 16px; height: 42px; z-index: 4; pointer-events: none; background: 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
/* rubber stamps (pixel sprites, already askew) */
.pp-stamp { position: relative; display: inline-block; vertical-align: middle; background: 0 0 / 100% 100% no-repeat; image-rendering: pixelated; flex: none; }
.pp-stamp.fresh { animation: ppStamp 0.42s steps(7, end) both; }
@keyframes ppStamp { 0% { transform: scale(2.4); opacity: 0; } 45% { transform: scale(0.9); opacity: 1; } 70% { transform: scale(1.06); } 100% { transform: none; opacity: 1; } }
/* polaroids, sticky notes, scraps */
.pp-polaroid { position: relative; display: inline-block; vertical-align: top; background: #fbf8f0; padding: 6px 6px 28px; image-rendering: pixelated;
  box-shadow: 0 0 0 2px #d6ccb4, 4px 4px 0 2px rgba(34, 22, 8, 0.32); }
.pp-polaroid .ph { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #3a3632 center / cover no-repeat; image-rendering: pixelated; box-shadow: inset 0 0 0 2px rgba(20, 14, 6, 0.35); }
.pp-polaroid .ph.none { background: ${ditherBg('#d8cfba', 0.5)}, #ece6d8; box-shadow: inset 0 0 0 2px #d8cfba; }
.pp-polaroid .cap { position: absolute; left: 4px; right: 4px; bottom: 3px; text-align: center; font-size: 20px; line-height: 22px; color: var(--pp-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-sticky { position: relative; isolation: isolate; display: inline-block; vertical-align: top; padding: 10px 14px 16px 12px; color: var(--pp-ink); line-height: 24px; }
.pp-sticky > .pp-hand { position: relative; font-size: 20px; }
.pp-scrap { display: inline-block; position: relative; isolation: isolate; vertical-align: top; }
.pp-scrap-in { display: block; position: relative; padding: 12px 16px 14px; color: var(--pp-ink); }
/* ink checkboxes, strike-throughs, underlines, circles */
.pp-check { vertical-align: -6px; flex: none; }
.pp-struck { position: relative; }
.pp-strike { position: absolute; left: -3%; width: 106%; top: calc(50% - 4px); height: 8px; pointer-events: none; }
.pp-marked { position: relative; display: inline-block; }
.pp-under { position: absolute; left: -2%; width: 104%; bottom: -9px; height: 8px; pointer-events: none; }
.pp-circ { position: absolute; left: -14%; width: 128%; top: -32%; height: 164%; pointer-events: none; }
.pp-tallies { display: inline-flex; align-items: center; gap: 4px; vertical-align: -2px; }
/* luggage tags */
.pp-tag { position: relative; isolation: isolate; display: inline-block; padding: 6px 14px 9px 30px; color: #3a2614; }
@media (prefers-reduced-motion: reduce) { .pp-stamp.fresh { animation: none; } }
`;

let done = false;
/** install the kit's stylesheet and start building the pixel handwriting font */
export function installPaper() {
  if (done || typeof document === 'undefined') return;
  done = true;
  const s = document.createElement('style');
  s.dataset.ui = 'paper';
  s.textContent = PAPER_CSS;
  document.head.appendChild(s);
  void handReady();
}

let fontP: Promise<void> | null = null;
/** resolves once the pixel hand (and, if online, the Jersey faces) can be measured */
export function handReady(): Promise<void> {
  if (!fontP) {
    fontP = new Promise<void>(res => {
      const t = setTimeout(res, 1600);
      void installPixelFonts().then(() => {
        try {
          const f = (document as Document & { fonts?: FontFaceSet }).fonts;
          if (!f) { clearTimeout(t); res(); return; }
          void Promise.all([f.load('20px "PZ Hand"'), f.load('20px "Jersey 15"'), f.load('20px "Jersey 10"'), f.load('16px Silkscreen')])
            .then(() => { clearTimeout(t); res(); }, () => { clearTimeout(t); res(); });
        } catch { clearTimeout(t); res(); }
      });
    });
  }
  return fontP;
}
