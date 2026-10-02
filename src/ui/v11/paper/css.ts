// Physical UI kit: the shared stylesheet (type, ink colours, tape, pins, clips, stamps, polaroids,
// sticky notes, scraps, checkboxes, underlines, tags) and installPaper(), which puts it in place,
// adds the SVG filters and warms up the handwriting font so page layout measures the real glyphs.

import { ensureDefs } from './ink';

export const PAPER_CSS = `
:root {
  --pp-hand: 'Caveat', 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
  --pp-pix: 'Jersey 15', 'Pixelify Sans', ui-monospace, monospace;
  --pp-head: 'Jersey 10', 'Jersey 15', ui-monospace, monospace;
  --pp-type: 'Pixelify Sans', 'Jersey 15', ui-monospace, monospace;
  --pp-ink: #2a2440; --pp-pencil: #5c574e; --pp-red: #a8321e; --pp-blue: #26408a; --pp-green: #2f6b3a;
}
#ui .pp-hand, #ui .pp-hand * { font-family: var(--pp-hand); font-size-adjust: none; -webkit-font-smoothing: antialiased; font-weight: 500; }
#ui .pp-pix, #ui .pp-pix * { font-family: var(--pp-pix); font-size-adjust: 0.62; -webkit-font-smoothing: none; font-weight: 400; }
#ui .pp-head, #ui .pp-head * { font-family: var(--pp-head); font-size-adjust: 0.62; -webkit-font-smoothing: none; font-weight: 400; }
#ui .pp-type, #ui .pp-type * { font-family: var(--pp-type); font-size-adjust: 0.56; -webkit-font-smoothing: none; }
.pp-svg { display: inline-block; overflow: visible; vertical-align: middle; }
.pp-draw { stroke-dasharray: 1.02; stroke-dashoffset: 1.02; animation: ppDraw 0.5s ease-out forwards; }
@keyframes ppDraw { to { stroke-dashoffset: 0; } }
.pp-sk { display: inline-block; image-rendering: auto; object-fit: contain; transition: opacity 0.35s; }
.pp-sk.wait { opacity: 0; }
.pp-doodle { opacity: 0.88; }
/* tape, pins and clips */
.pp-tape { position: absolute; display: block; height: 1.1em; z-index: 3; pointer-events: none;
  background: linear-gradient(180deg, rgba(246, 236, 196, 0.78), rgba(232, 218, 166, 0.72)); box-shadow: inset 0 0 0.4em rgba(255, 255, 240, 0.5); }
.pp-tape.blue { background: linear-gradient(180deg, rgba(188, 214, 236, 0.8), rgba(160, 192, 222, 0.75)); }
.pp-tape.green { background: linear-gradient(180deg, rgba(196, 226, 176, 0.8), rgba(170, 206, 150, 0.75)); }
.pp-tape.pink { background: linear-gradient(180deg, rgba(246, 196, 206, 0.8), rgba(232, 170, 186, 0.75)); }
.pp-pin { position: absolute; display: block; width: 0.95em; height: 0.95em; border-radius: 50%; z-index: 4; pointer-events: none;
  background: radial-gradient(circle at 34% 30%, #ffd2c8 0 12%, #e2533a 32%, #a8281a 68%, #5a1008 100%);
  box-shadow: 0.2em 0.35em 0.28em rgba(20, 10, 0, 0.42), inset -0.06em -0.08em 0.12em rgba(0, 0, 0, 0.35); }
.pp-pin::after { content: ''; position: absolute; left: 60%; top: 85%; width: 0.12em; height: 0.5em; background: rgba(20, 10, 0, 0.25); transform: rotate(-35deg); transform-origin: top; border-radius: 0.1em; }
.pp-pin.blue { background: radial-gradient(circle at 34% 30%, #d8e8ff 0 12%, #4a7ad8 32%, #234a9a 68%, #0e2050 100%); }
.pp-pin.green { background: radial-gradient(circle at 34% 30%, #e0ffd0 0 12%, #4aa848 32%, #23702a 68%, #0e3a12 100%); }
.pp-pin.yellow { background: radial-gradient(circle at 34% 30%, #fff8d0 0 12%, #f0c43a 32%, #b88a10 68%, #5a4006 100%); }
.pp-pin.white { background: radial-gradient(circle at 34% 30%, #ffffff 0 14%, #e8e4dc 36%, #b8b2a6 72%, #6a645a 100%); }
.pp-clip { position: absolute; display: block; width: 1.05em; height: 2.2em; z-index: 4; pointer-events: none; }
.pp-clip svg { width: 100%; height: 100%; display: block; overflow: visible; }
/* rubber stamps */
.pp-stamp { position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.38em 0.9em 0.32em; color: var(--c);
  font-family: var(--pp-head); letter-spacing: 0.14em; text-transform: uppercase; line-height: 1; mix-blend-mode: multiply; opacity: 0.84; filter: url(#pp-stamp); white-space: nowrap; }
#ui .pp-stamp, #ui .pp-stamp * { font-family: var(--pp-head); font-size-adjust: 0.62; -webkit-font-smoothing: none; }
.pp-stamp b { font-weight: 400; font-size: 1.2em; color: var(--c); position: relative; }
.pp-stamp small { font-size: 0.62em; letter-spacing: 0.1em; margin-top: 0.15em; position: relative; }
.pp-stamp .pp-stamp-b { position: absolute; inset: 0; width: 100%; height: 100%; }
.pp-stamp.round { width: 5.4em; height: 5.4em; padding: 0; text-align: center; white-space: normal; }
.pp-stamp.round b { font-size: 1.05em; }
.pp-stamp.fresh { animation: ppStamp 0.45s cubic-bezier(.25, 1.5, .45, 1) both; }
@keyframes ppStamp { 0% { scale: 2.3; opacity: 0; } 50% { scale: 0.93; opacity: 0.95; } 70% { scale: 1.03; } 100% { scale: 1; opacity: 0.84; } }
/* polaroids, sticky notes, scraps */
.pp-polaroid { position: relative; display: inline-block; vertical-align: top; background: #fbf8f0; padding: 0.42em 0.42em 1.75em; box-shadow: 0 0.12em 0.3em rgba(40, 28, 10, 0.38), 0 0 0 1px rgba(60, 40, 20, 0.08); }
.pp-polaroid .ph { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #3a3632 center / cover no-repeat; image-rendering: auto; box-shadow: inset 0 0 0.3em rgba(0,0,0,0.4); }
.pp-polaroid .ph.none { background: repeating-linear-gradient(45deg, #ece6d8 0 6px, #e2dbc8 6px 12px); box-shadow: none; }
.pp-polaroid .cap { position: absolute; left: 0.3em; right: 0.3em; bottom: 0.15em; text-align: center; font-size: 1.1em; line-height: 1.1; color: var(--pp-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-sticky { position: relative; display: inline-block; vertical-align: top; padding: 0.55em 0.7em 0.9em; color: var(--pp-ink); line-height: 1.1;
  background: linear-gradient(170deg, #f8e886 0%, #f2da62 70%, #e6c84a 100%); box-shadow: 0 0.25em 0.35em -0.1em rgba(40, 30, 0, 0.35), inset 0 -0.5em 0.6em -0.4em rgba(120, 90, 0, 0.25); }
.pp-sticky.pink { background: linear-gradient(170deg, #fac4d0 0%, #f2a8b8 70%, #e494a8 100%); }
.pp-sticky.blue { background: linear-gradient(170deg, #c8e2f8 0%, #a8ccee 70%, #94bce4 100%); }
.pp-sticky.green { background: linear-gradient(170deg, #d4f0b8 0%, #b8e094 70%, #a4d27e 100%); }
.pp-sticky > .pp-hand { font-size: 1.15em; }
.pp-scrap { display: inline-block; position: relative; vertical-align: top; filter: drop-shadow(0 0.12em 0.16em rgba(40, 25, 10, 0.38)); }
.pp-scrap-in { display: block; padding: 0.7em 0.95em; background-size: 256px 256px; color: var(--pp-ink); }
/* ink checkboxes, strike-throughs, underlines, circles */
.pp-check { vertical-align: -0.28em; overflow: visible; flex: none; }
.pp-struck { position: relative; }
.pp-strike { position: absolute; left: -3%; width: 106%; top: 0.55em; height: 0.35em; overflow: visible; pointer-events: none; }
.pp-marked { position: relative; display: inline-block; }
.pp-under { position: absolute; left: -2%; width: 104%; bottom: -0.32em; height: 0.42em; overflow: visible; pointer-events: none; }
.pp-circ { position: absolute; left: -14%; width: 128%; top: -32%; height: 164%; overflow: visible; pointer-events: none; }
.pp-tallies { display: inline-flex; align-items: center; gap: 0.15em; vertical-align: -0.12em; }
.pp-tally { overflow: visible; }
/* luggage tags */
.pp-tag { position: relative; display: inline-block; padding: 0.28em 0.75em 0.3em 1.45em; color: #3a2614;
  background: linear-gradient(180deg, #e8cc94, #d8b478); clip-path: polygon(0.9em 0, 100% 0, 100% 100%, 0.9em 100%, 0 50%);
  box-shadow: inset 0 -0.2em 0 rgba(120, 80, 30, 0.25); }
.pp-tag .hole { position: absolute; left: 0.62em; top: 50%; width: 0.42em; height: 0.42em; margin-top: -0.21em; border-radius: 50%; background: rgba(40, 24, 8, 0.55); box-shadow: 0 0 0 0.12em #f4e2b8; }
@media (prefers-reduced-motion: reduce) { .pp-draw { animation: none; stroke-dashoffset: 0; } .pp-stamp.fresh { animation: none; } }
`;

let done = false;
/** install the kit's stylesheet and SVG filters, and start loading the handwriting font */
export function installPaper() {
  if (done || typeof document === 'undefined') return;
  done = true;
  const s = document.createElement('style');
  s.dataset.ui = 'paper';
  s.textContent = PAPER_CSS;
  document.head.appendChild(s);
  ensureDefs();
  void handReady();
}

let fontP: Promise<void> | null = null;
/** resolves once the handwriting font is usable (or after a short timeout offline) */
export function handReady(): Promise<void> {
  if (!fontP) {
    fontP = new Promise<void>(res => {
      const t = setTimeout(res, 1600);
      try {
        const f = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (!f) { clearTimeout(t); res(); return; }
        void Promise.all([f.load('500 20px Caveat'), f.load('700 20px Caveat'), f.load('20px "Jersey 15"'), f.load('20px "Jersey 10"')])
          .then(() => { clearTimeout(t); res(); }, () => { clearTimeout(t); res(); });
      } catch { clearTimeout(t); res(); }
    });
  }
  return fontP;
}
