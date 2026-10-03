// V10 camp cards: the day's photos shown round the fire (a polaroid swinging in at the top of the
// screen while the crew comments), and the end-of-day summary card before the next morning.

import { game } from '../../game/game';
import { el } from '../ui';
import { css, sfx, wait, esc } from '../laptop-kit';
import { discoveries } from '../../game/v10/regions';
import { dayState } from '../../game/v10/day';
import { installPaper, paperTex, edgeClip, stamp, paperSfx } from '../v11/paper';

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
.cdc { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 45%, #1a120a, #05060c 75%); color: var(--pp-ink); text-align: center; animation: cdcIn 1.6s ease-out both; pointer-events: auto; }
@keyframes cdcIn { from { opacity: 0; } }
.cdc .pg { position: relative; width: min(30em, 90vw); padding: 2.4em 2em 1.8em; background-size: 256px 256px; filter: drop-shadow(0 0.6em 1em rgba(0,0,0,0.6)); transform: rotate(-1.2deg); animation: cdcPage 1.2s cubic-bezier(.2,1.1,.4,1) both; }
@keyframes cdcPage { from { transform: translateY(60vh) rotate(-6deg); } }
.cdc .pg::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(180deg, transparent 0 calc(1.7em - 1px), rgba(70,110,160,0.16) calc(1.7em - 1px) 1.7em) 0 3em / 100% calc(100% - 3em) no-repeat; }
.cdc .t { position: relative; font-size: clamp(26px, 4vw, 44px); color: #2a2440; animation: cdcWrite 1.6s 0.9s steps(20) both; }
@keyframes cdcWrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.cdc .s { position: relative; margin-top: 0.4em; font-size: clamp(16px, 2vw, 22px); line-height: 1.15; animation: cdcIn 1.4s 1.6s ease-out both; }
.cdc .st { position: relative; margin-top: 1em; display: flex; gap: 1.2em; flex-wrap: wrap; justify-content: center; font-size: clamp(14px, 1.7vw, 19px); animation: cdcIn 1.4s 2.1s ease-out both; }
.cdc .st b { display: block; font-size: 1.9em; color: #26408a; font-weight: 700; line-height: 1; }
.cdc .nx { position: relative; margin-top: 1em; font-size: clamp(14px, 1.6vw, 18px); color: var(--pp-pencil); animation: cdcIn 1.4s 2.5s ease-out both; }
.cdc .go { position: relative; margin-top: 1.3em; display: inline-block; font-size: clamp(18px, 2.2vw, 26px); font-weight: 700; color: #a8321e; cursor: pointer; animation: cdcIn 1.2s 2.8s ease-out both; }
.cdc .go:hover { color: #26408a; }
.cdc .go .key { font-size: 0.55em !important; }
.cdc .stp { position: absolute; right: -1em; top: -1.2em; animation: cdcIn 0.5s 3.2s both; }
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
    <span class="stp">${stamp('Day done', { color: 'red', shape: 'round', small: 'lights out', rot: '12deg' })}</span></div>`);
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
