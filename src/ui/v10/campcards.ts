// V10 camp cards: the day's photos shown round the fire (a polaroid swinging in at the top of the
// screen while the crew comments), and the end-of-day summary card before the next morning.

import { game } from '../../game/game';
import { el } from '../ui';
import { css, sfx, wait, esc } from '../laptop-kit';
import { discoveries } from '../../game/v10/regions';
import { dayState } from '../../game/v10/day';

const CSS = `
.cpp-wrap { position: absolute; left: 50%; top: 3%; transform: translateX(-50%); z-index: 12; pointer-events: none; }
.cpp-pol { position: relative; background: #f4efe2; padding: 0.55em 0.55em 2.1em; box-shadow: 0 10px 0 rgba(0,0,0,0.35), 0 0 0 2px #2a2016; transform-origin: 50% -2em; animation: cppIn 0.6s cubic-bezier(.2,1.5,.4,1) both; }
.cpp-pol.out { animation: cppOut 0.4s ease-in both; }
@keyframes cppIn { from { transform: translateY(-120%) rotate(-12deg); } 60% { transform: rotate(4deg); } to { transform: rotate(var(--r, -2deg)); } }
@keyframes cppOut { to { transform: translateY(-140%) rotate(8deg); opacity: 0; } }
.cpp-pol img { display: block; width: min(34vw, 22em); aspect-ratio: 16 / 9; object-fit: cover; image-rendering: auto; background: #1a1a1a; }
.cpp-pol .cap { position: absolute; left: 0; right: 0; bottom: 0.45em; text-align: center; font-family: var(--hand); font-size: 1.05em; color: #3b3226; }
.cpp-pol::before { content: ''; position: absolute; left: 50%; top: -2.2em; width: 2px; height: 2.2em; background: #a89478; }
.cpp-pol::after { content: ''; position: absolute; left: calc(50% - 0.45em); top: -0.45em; width: 0.9em; height: 0.9em; background: #c84a3a; box-shadow: 0 2px 0 rgba(0,0,0,0.4); }
.cdc { position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #05060c; color: #f4ecd8; text-align: center; animation: cdcIn 1.6s ease-out both; pointer-events: auto; }
@keyframes cdcIn { from { opacity: 0; } }
.cdc .t { font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: clamp(24px, 4.5vw, 48px); letter-spacing: 0.08em; color: #ffe6a8; text-shadow: 0 0 18px rgba(255,190,90,0.45); animation: cdcRise 2.2s ease-out both; }
@keyframes cdcRise { from { transform: translateY(12px); opacity: 0; } }
.cdc .s { margin-top: 0.5em; font-family: var(--hand); font-size: clamp(13px, 1.7vw, 18px); opacity: 0.8; animation: cdcIn 2s 0.8s ease-out both; }
.cdc .st { margin-top: 1.3em; display: flex; gap: 1.5em; flex-wrap: wrap; justify-content: center; font-size: clamp(12px, 1.5vw, 15px); animation: cdcIn 1.6s 1.4s ease-out both; }
.cdc .st b { display: block; font-family: var(--pix); font-size: 1.7em; color: #9ee6c8; }
.cdc .nx { margin-top: 1.2em; font-size: 0.9em; opacity: 0.7; animation: cdcIn 1.6s 1.8s ease-out both; max-width: 34em; }
.cdc button { margin-top: 1.6em; animation: cdcIn 1.4s 2s ease-out both; }
`;

/** the day's photos, one at a time, swinging in at the top; `each` plays the crew's comment */
export async function showPhotos(pics: { img: string; cap: string }[], each: (i: number) => Promise<void>) {
  css('v10cards', CSS);
  const wrap = el('div', 'cpp-wrap');
  game.ui.modalLayer.appendChild(wrap);
  try {
    for (let i = 0; i < pics.length; i++) {
      const pol = wrap.appendChild(el('div', 'cpp-pol', `<img src="${pics[i].img}" alt=""><div class="cap">${esc(pics[i].cap)}</div>`));
      pol.style.setProperty('--r', `${(i % 2 ? 2.5 : -2.5) + (Math.random() - 0.5) * 2}deg`);
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
  const d = dayState(), s = game.save;
  const species = Object.values(s.research).filter(e => e.day === day).length;
  const photos = s.raw.filter(p => p.day === day).length + s.uploads.filter(u => u.day === day).length;
  const rp = Math.max(0, s.totalRp - (d.dawn?.rp ?? s.totalRp));
  let finds = 0;
  try { finds = discoveries().filter(f => f.day === day).length; } catch { finds = 0; }
  const fish = d.fishDay === day ? d.fishN : 0;
  const stat = (n: number, label: string) => `<div><b>${n}</b>${label}</div>`;
  const card = el('div', 'cdc', `
    <div class="t">Day ${day} Complete</div>
    <div class="s">${esc(LINES[(day - 2 + LINES.length) % LINES.length])}</div>
    <div class="st">${stat(species, species === 1 ? 'species documented' : 'species documented')}${stat(photos, photos === 1 ? 'photo taken' : 'photos taken')}${stat(rp, 'research points')}${finds ? stat(finds, finds === 1 ? 'discovery' : 'discoveries') : ''}${fish ? stat(fish, fish === 1 ? 'fish caught' : 'fish caught') : ''}</div>
    ${s.raw.length ? `<div class="nx">${s.raw.length} photo${s.raw.length > 1 ? 's' : ''} still on the camera. Upload them tomorrow to research them.</div>` : ''}
    <button class="btn">Sleep until Day ${day + 1} <span class="key">Space</span></button>`);
  game.ui.modalLayer.appendChild(card);
  game.ui.modalOpen++;
  game.persist();
  await new Promise<void>(res => {
    const b = card.querySelector('button')!;
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
