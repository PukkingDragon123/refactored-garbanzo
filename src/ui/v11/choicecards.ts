// V11 in-world choice cards: the answers to a tense moment appear as little paper cards over the
// heads of whoever would say them (Mori and Joshu in the standoff with Aroha), tracking the actors
// as the camera moves, instead of a menu panel. Keys 1-9, a click or a tap picks one. Minimal UI:
// no timer bar (the scene shows the clock: the slingshot drawing tighter); `tick` gets the elapsed
// seconds so the caller can animate it.

import { el } from '../ui';
import { game } from '../../game/game';
import { audio } from '../../core/audio';

export interface ChoiceCard {
  text: string;
  /** who'd say it: their name over the card, and the card sits over their head */
  who: string;
  name: string;
  color: string;
  /** CSS anchor over the speaker's head (Actor.cssAnchor) */
  anchor: () => [number, number] | null;
}
export interface CardOpts {
  /** seconds before it resolves null (no answer); 0 = no limit */
  timeout?: number;
  /** each frame: seconds elapsed, 0..1 of the timeout */
  tick?: (t: number, k: number) => void;
}

const CSS = `
.ccards { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.ccard { position: absolute; left: 0; top: 0; pointer-events: auto; max-width: min(15.5em, 36vw); min-width: 7em; text-align: left; cursor: pointer;
  font-family: 'Jersey 15', 'Pixelify Sans', monospace; font-size: clamp(11px, 1.42vw, 15px); line-height: 1.2; color: #2a1a10;
  background: #f4e6c6; border: 0; padding: 0.34em 0.6em 0.36em 1.75em; border-radius: 0;
  box-shadow: 0 0 0 2px #3a2614, 3px 4px 0 2px rgba(10, 6, 2, 0.38); transform-origin: 50% 100%;
  background-image: linear-gradient(transparent 92%, rgba(120, 80, 30, 0.12) 92%); background-size: 100% 1.2em; }
.ccard .k { position: absolute; left: 0.32em; top: 0.38em; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 0.9em; line-height: 1;
  color: #f4e6c6; background: #3a2614; padding: 0.08em 0.28em 0.04em; }
.ccard .who { display: block; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 0.68em; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c, #4a6a2a); margin-bottom: 0.08em; }
.ccard.in { animation: ccIn 0.3s cubic-bezier(.2, 1.7, .4, 1) both; }
.ccard:hover, .ccard.sel { background-color: #fffaec; }
.ccard.pick { animation: ccPick 0.32s ease-out both; }
.ccard.gone { animation: ccGone 0.18s ease-in both; pointer-events: none; }
@keyframes ccIn { from { opacity: 0; translate: 0 10px; scale: 0.7; } }
@keyframes ccPick { 30% { scale: 1.08; } to { opacity: 0; translate: 0 -14px; } }
@keyframes ccGone { to { opacity: 0; translate: 0 6px; scale: 0.9; } }
@media (prefers-reduced-motion: reduce) { .ccard.in, .ccard.pick, .ccard.gone { animation: none; } }
`;
let styled = false;

/** show the cards; resolves with the picked index, or null when the time runs out */
export function choiceCards(cards: ChoiceCard[], o: CardOpts = {}): Promise<number | null> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const root = el('div', 'ccards');
  game.ui.root.appendChild(root);
  const els = cards.map((c, i) => {
    const b = el('button', 'ccard in', `<span class="k">${i + 1}</span><span class="who">${c.name}</span>${c.text}`);
    b.style.setProperty('--c', c.color);
    b.style.rotate = `${((i * 37) % 5) - 2}deg`;
    b.style.animationDelay = `${i * 0.07}s`;
    b.style.visibility = 'hidden';
    root.appendChild(b);
    return b;
  });
  return new Promise(res => {
    let done = false, raf = 0;
    const t0 = performance.now();
    const finish = (i: number | null) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd, true);
      els.forEach((b, k) => b.classList.add(k === i ? 'pick' : 'gone'));
      if (i !== null) audio.play('ui', { vol: 0.4, pitch: 1.2 });
      setTimeout(() => root.remove(), 340);
      res(i);
    };
    els.forEach((b, i) => {
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); finish(i); });
      b.addEventListener('pointerenter', () => audio.play('ui', { vol: 0.12, pitch: 1.6 }));
    });
    const kd = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= cards.length) { e.preventDefault(); e.stopPropagation(); finish(n - 1); }
    };
    window.addEventListener('keydown', kd, true);
    const rootR = () => game.ui.root.getBoundingClientRect();
    const frame = () => {
      if (done) return;
      const t = (performance.now() - t0) / 1000;
      const k = o.timeout ? Math.min(1, t / o.timeout) : 0;
      o.tick?.(t, k);
      if (o.timeout && t >= o.timeout) { finish(null); return; }
      // stack each speaker's cards over their head, the first nearest; keep them on screen
      const R = rootR();
      const stacks = new Map<string, number>();
      for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i], b = els[i];
        const a = c.anchor();
        const w = b.offsetWidth, h = b.offsetHeight;
        const below = stacks.get(c.who) ?? 0;
        stacks.set(c.who, below + h + 7);
        const x = Math.max(8, Math.min(R.width - w - 8, (a ? a[0] : R.width / 2) - w / 2));
        const y = Math.max(8, Math.min(R.height - h - 8, (a ? a[1] : R.height * 0.3) - 26 - h - below));
        b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        b.style.visibility = '';
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
  });
}
