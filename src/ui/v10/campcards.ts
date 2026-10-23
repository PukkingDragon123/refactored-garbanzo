// V10 camp cards: the day's photos shown round the fire (a polaroid swinging in at the top of the
// screen while the crew comments), and the end-of-day summary card before the next morning.

import { game } from '../../game/game';
import { el } from '../ui';
import { css, sfx, wait, esc } from '../laptop-kit';
import { discoveries } from '../../game/v10/regions';
import { dayState } from '../../game/v10/day';
import { installPaper, paperTex, edgeClip, stamp, paperSfx, pinURL, pxCanvas, col, dith } from '../v11/paper';

const CSS = `
#ui .cpp-wrap, #ui .cpp-wrap *, #ui .cdc, #ui .cdc * { font-size-adjust: none; }
.cpp-wrap { position: absolute; left: 50%; top: 3%; transform: translateX(-50%); z-index: 12; pointer-events: none; }
.cpp-pol { position: relative; background: #f4efe2; padding: 10px 10px 40px; box-shadow: 0 0 0 2px #2a2016, 8px 8px 0 2px rgba(0,0,0,0.35); animation: cppIn 0.6s steps(8) both; image-rendering: pixelated; }
.cpp-pol.out { animation: cppOut 0.4s steps(5) both; }
@keyframes cppIn { from { transform: translateY(-120%); } 60% { transform: translateY(6%); } to { transform: translateY(var(--dy, 0px)); } }
@keyframes cppOut { to { transform: translateY(-140%); opacity: 0; } }
.cpp-pol img { display: block; width: min(34vw, 440px); aspect-ratio: 16 / 9; object-fit: cover; image-rendering: pixelated; background: #1a1a1a; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.3); }
.cpp-pol .cap { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; font-family: var(--pp-hand); font-size: 20px; line-height: 24px; color: #3b3226; }
.cpp-pol::before { content: ''; position: absolute; left: calc(50% - 1px); top: -40px; width: 2px; height: 40px; background: #a89478; }
.cpp-pol::after { content: ''; position: absolute; left: calc(50% - 10px); top: -10px; width: 20px; height: 24px; background: var(--cpp-pin) center / 100% 100% no-repeat; image-rendering: pixelated; }
.cdc { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: #0c0806; color: var(--pp-ink); text-align: center; animation: cdcIn 1.6s steps(12) both; pointer-events: auto; }
.cdc > .pp-cv.vg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
@keyframes cdcIn { from { opacity: 0; } }
.cdc .pg { position: relative; width: min(600px, 90vw); padding: 48px 40px 36px; background-size: 256px 256px; filter: drop-shadow(8px 10px 0 rgba(0,0,0,0.55)); animation: cdcPage 1.2s steps(14) both; image-rendering: pixelated; }
@keyframes cdcPage { from { transform: translateY(60vh); } 70% { transform: translateY(-2%); } }
.cdc .pg::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(180deg, transparent 0 30px, rgba(70,110,160,0.2) 30px 32px) 0 60px / 100% calc(100% - 60px) no-repeat; }
.cdc .t { position: relative; font-family: var(--pp-hand); font-size: 40px; line-height: 48px; font-weight: 700; color: #2a2440; animation: cdcWrite 1.6s 0.9s steps(20) both; }
@keyframes cdcWrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.cdc .s { position: relative; margin-top: 8px; font-family: var(--pp-hand); font-size: 20px; line-height: 24px; animation: cdcIn 1.4s 1.6s steps(8) both; }
.cdc .st { position: relative; margin-top: 20px; display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; font-family: var(--pp-hand); font-size: 20px; line-height: 24px; animation: cdcIn 1.4s 2.1s steps(8) both; }
.cdc .st b { display: block; font-family: var(--pp-head); font-size: 37.3333px; line-height: 40px; color: #26408a; font-weight: 400; }
.cdc .nx { position: relative; margin-top: 20px; font-family: var(--pp-hand); font-size: 20px; line-height: 24px; color: var(--pp-pencil); animation: cdcIn 1.4s 2.5s steps(8) both; }
.cdc .go { position: relative; margin-top: 26px; display: inline-block; font-family: var(--pp-hand); font-size: 30px; line-height: 36px; font-weight: 700; color: #a8321e; cursor: pointer; animation: cdcIn 1.2s 2.8s steps(8) both; }
.cdc .go:hover { color: #26408a; }
.cdc .go .key { font-size: 16px !important; }
.cdc .stp { position: absolute; right: -20px; top: -24px; animation: cdcIn 0.5s 3.2s steps(4) both; }
`;

/** the day's photos, one at a time, swinging in at the top; `each` plays the crew's comment */
export async function showPhotos(pics: { img: string; cap: string }[], each: (i: number) => Promise<void>) {
  css('v10cards', CSS);
  document.documentElement.style.setProperty('--cpp-pin', `url(${pinURL('red')})`);
  const wrap = el('div', 'cpp-wrap');
  game.ui.modalLayer.appendChild(wrap);
  try {
    for (let i = 0; i < pics.length; i++) {
      const pol = wrap.appendChild(el('div', 'cpp-pol', `<img src="${pics[i].img}" alt=""><div class="cap">${esc(pics[i].cap)}</div>`));
      pol.style.setProperty('--dy', `${(i % 2 ? 4 : -2)}px`);
      sfx('pageTurn', { vol: 0.6 });
      await wait(650);
      await each(i);
      pol.classList.add('out');
      await wait(380);
      pol.remove();
    }
  } finally {
    wrap.remove();
  }
}

const LINES = [
  'The fire burns down to embers. Somewhere out in the dark, the island is busy.',
  'Four castaways and a pug, asleep under a sky full of strange stars.',
  'The tide comes in. The tide goes out. Tomorrow, more island.',
  'Somewhere out there is something nobody has ever seen. Tomorrow, maybe.',
  'Chunk snores. The sea answers. Camp Kittiwake sleeps.',
];

/** the end-of-day summary; resolves when the player turns in */
export async function dayCard(day: number) {
  css('v10cards', CSS);
  installPaper();
  setTimeout(() => paperSfx('slide'), 300);
  setTimeout(() => paperSfx('stamp'), 3300);
  const d = dayState(), s = game.save;
  const species = Object.values(s.research).filter(e => e.day === day).length;
  const photos = s.raw.filter(p => p.day === day).length + s.uploads.filter(u => u.day === day).length;
  const rp = Math.max(0, s.totalRp - (d.dawn?.rp ?? s.totalRp));
  let finds = 0;
  try { finds = discoveries().filter(f => f.day === day).length; } catch { finds = 0; }
  const fish = d.fishDay === day ? d.fishN : 0;
  const stat = (n: number, label: string) => `<div><b>${n}</b>${label}</div>`;
  const card = el('div', 'cdc', `<div class="pg pp-hand" style="background-image:${paperTex('journal')};clip-path:${edgeClip(day, { top: 'perforated', bottom: 'deckle', left: 'deckle', right: 'deckle' })}">
    <div class="t">Day ${day}</div>
    <div class="s">${esc(LINES[(day - 2 + LINES.length) % LINES.length])}</div>
    <div class="st">${stat(species, 'species documented')}${stat(photos, photos === 1 ? 'photo taken' : 'photos taken')}${stat(rp, 'research points')}${finds ? stat(finds, finds === 1 ? 'discovery' : 'discoveries') : ''}${fish ? stat(fish, 'fish caught') : ''}</div>
    ${s.raw.length ? `<div class="nx">${s.raw.length} photo${s.raw.length > 1 ? 's' : ''} still on the camera. Upload them tomorrow.</div>` : ''}
    <div><span class="go">sleep until day ${day + 1} <span class="key">Space</span></span></div>
    <span class="stp">${stamp('Day done', { color: 'red', shape: 'round', small: 'lights out', rot: '12deg', size: 'lg' })}</span></div>`);
  card.insertAdjacentHTML('afterbegin', pxCanvas('vignette-card', a => { const c = col('#000000'); for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const dx = (x / a.w - 0.5) / 0.5, dy = (y / a.h - 0.45) / 0.5; if (dith(x, y, Math.max(0, Math.min(1, (Math.sqrt(dx * dx + dy * dy) - 0.3) / 0.7)) * 0.85)) a.put(x, y, c); } }, { cls: 'vg' }));
  game.ui.modalLayer.appendChild(card);
  game.ui.modalOpen++;
  game.persist();
  await new Promise<void>(res => {
    const b = card.querySelector('.go') as HTMLElement;
    const go = () => { window.removeEventListener('keydown', kh, true); res(); };
    const kh = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); go(); } };
    setTimeout(() => window.addEventListener('keydown', kh, true), 1200);
    b.addEventListener('click', go, { once: true });
  });
  sfx('ui');
  game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
  card.style.transition = 'opacity 0.6s';
  card.style.opacity = '0';
  await wait(600);
  card.remove();
}
