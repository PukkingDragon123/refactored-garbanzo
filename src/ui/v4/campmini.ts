// V4 camp minigames: holding the tent pole steady while Joshu hammers the pegs (timed presses on a
// swinging marker), and Aroha's lashing knot for the drying rack (over, under, around, pull: follow
// the sequence before the flax slips).

import { openMini, pixelCanvas, Hold, loop, wait, px } from './mini';
import { el } from '../ui';
import { audio } from '../../core/audio';

/** three pegs: press when the swinging marker is in the green. Resolves true with no misses. */
export async function holdSteady(title: string, hint: string): Promise<boolean> {
  const m = openMini('steady', `<h3>${title}</h3><div class="steps"><i></i><i></i><i></i></div><div class="res"></div><div class="hint">${hint}</div>`);
  const W = 180, H = 70;
  const { g } = pixelCanvas(m.box, W, H, 4);
  m.box.insertBefore(m.box.querySelector('.cv')!, m.box.querySelector('.res'));
  const hold = new Hold(m.box);
  const steps = [...m.box.querySelectorAll('.steps i')] as HTMLElement[];
  const res = m.box.querySelector('.res') as HTMLElement;
  let hits = 0, misses = 0, tries = 0;
  let zone = 0.5, zw = 0.2, phase = 0, flash = 0, hammer = 0;
  steps[0].classList.add('on');
  await new Promise<void>(done => {
    loop(dt => {
      if (m.closed) { done(); return false; }
      phase += dt * (1.6 + hits * 0.5);
      const pos = 0.5 + Math.sin(phase * 2) * 0.45;
      flash = Math.max(0, flash - dt * 3);
      hammer = Math.max(0, hammer - dt * 5);
      if (hold.hit()) {
        tries++;
        const ok = Math.abs(pos - zone) < zw / 2;
        if (ok) { hits++; audio.play('hammer' as never, { vol: 0.6 }); res.className = 'res'; res.textContent = 'Thunk!'; hammer = 1; }
        else { misses++; audio.play('wrong', { vol: 0.4 }); res.className = 'res bad'; res.textContent = 'Wobble!'; }
        flash = 1;
        steps.forEach((s, i) => { s.classList.toggle('done', i < hits); s.classList.toggle('on', i === hits); });
        zone = 0.3 + Math.random() * 0.4;
        zw = Math.max(0.12, 0.2 - hits * 0.03);
        if (hits >= 3) { setTimeout(() => done(), 500); return false; }
      }
      // draw: a sandy scene with the pole and the swinging bar
      px.rect(g, 0, 0, W, H, '#bfe0ee');
      px.rect(g, 0, 44, W, 26, '#e0c088');
      px.rect(g, 86, 6 + hammer * 2, 6, 40, '#8a6a44');
      px.rect(g, 84, 44, 10, 4, '#5a4424');
      px.ell(g, 106, 22 - hammer * 10, 8, 5, '#6a7a80');
      px.rect(g, 104, 22 - hammer * 10, 4, 22, '#6e4c32');
      const bx = 20, bw = W - 40, by = 56;
      px.rect(g, bx - 1, by - 1, bw + 2, 8, '#3a2614');
      px.rect(g, bx, by, bw, 6, '#c8b48a');
      px.rect(g, bx + (zone - zw / 2) * bw, by, zw * bw, 6, '#5aa447');
      px.rect(g, bx + pos * bw - 1, by - 3, 3, 12, flash > 0.5 ? '#ffffff' : '#2a1a10');
    });
  });
  hold.dispose();
  await wait(300);
  m.close();
  return misses === 0 && tries >= 3;
}

const KNOT: { key: string; code: string[]; name: string }[] = [
  { key: '↑', code: ['ArrowUp', 'KeyW'], name: 'over' },
  { key: '↓', code: ['ArrowDown', 'KeyS'], name: 'under' },
  { key: '←', code: ['ArrowLeft', 'KeyA'], name: 'around' },
  { key: '→', code: ['ArrowRight', 'KeyD'], name: 'pull tight' },
];

/** Aroha's lashing: repeat her sequence (4 then 5 moves) before the flax slips. */
export async function lashingKnot(): Promise<boolean> {
  const m = openMini('knot', `<h3>Lash the frame</h3><div class="say"><div class="t">Watch Aroha’s hands, then do the same: <b>over, under, around, pull tight</b>.</div></div><div class="seq" style="display:flex;gap:6px;justify-content:center;font-family:Silkscreen,monospace;font-size:22px;min-height:1.6em"></div><div class="res"></div><div class="hint">Arrow keys or <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span>. Tap the arrows on touch screens.</div><div class="row pads"></div>`);
  const seqEl = m.box.querySelector('.seq') as HTMLElement, res = m.box.querySelector('.res') as HTMLElement, pads = m.box.querySelector('.pads') as HTMLElement;
  let press: ((i: number) => void) | null = null;
  KNOT.forEach((k, i) => { const b = el('button', 'btn', k.key); b.addEventListener('click', () => press?.(i)); pads.appendChild(b); });
  const kd = (e: KeyboardEvent) => { const i = KNOT.findIndex(k => k.code.includes(e.code)); if (i >= 0) { e.preventDefault(); e.stopPropagation(); press?.(i); } };
  window.addEventListener('keydown', kd, true);
  let mistakes = 0;
  for (const len of [4, 5]) {
    const seq = Array.from({ length: len }, (_, i) => (i < 4 && len === 4 ? i : Math.floor(Math.random() * 4)));
    // show the sequence
    seqEl.innerHTML = seq.map(i => `<span style="opacity:0.35">${KNOT[i].key}</span>`).join('');
    const spans = [...seqEl.querySelectorAll('span')] as HTMLElement[];
    for (let i = 0; i < seq.length; i++) { spans[i].style.opacity = '1'; spans[i].style.color = '#b04a8a'; audio.play('rope' as never, { vol: 0.3 }); await wait(420); spans[i].style.color = ''; spans[i].style.opacity = '0.35'; }
    res.className = 'res'; res.textContent = 'Your turn!';
    let at = 0;
    const ok = await new Promise<boolean>(done => {
      const stop = loop((dt, t) => { if (t > 3.4 + len * 0.6) { stop(); done(false); return false; } });
      press = i => {
        if (i === seq[at]) { spans[at].style.opacity = '1'; spans[at].style.color = '#2f6b2a'; audio.play('rope' as never, { vol: 0.4, pitch: 1.1 + at * 0.05 }); at++; if (at >= seq.length) { stop(); done(true); } }
        else { stop(); done(false); }
      };
    });
    press = null;
    if (!ok) { mistakes++; res.className = 'res bad'; res.textContent = 'It slipped! Again...'; audio.play('wrong', { vol: 0.4 }); await wait(900); }
    else { res.className = 'res'; res.textContent = 'Tight!'; await wait(600); }
  }
  window.removeEventListener('keydown', kd, true);
  m.close();
  return mistakes === 0;
}
