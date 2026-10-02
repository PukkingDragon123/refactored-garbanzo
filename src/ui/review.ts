// End-of-expedition photo review: grades, species reveals, evidence and research points.

import { game } from '../game/game';
import type { Shot } from '../game/camera';
import { SPECIES_BY_ID, SiteId } from '../game/species';
import type { TimeOfDay } from '../world/timeofday';
import { addEvidence } from '../game/research';
import { el } from './ui';
import { audio } from '../core/audio';
import { pxIconCss, pxIcon, pxRating } from './pxicons';

const CSS = `
.review { width: min(1100px, 96vw); max-height: 92vh; padding: 1.3em 1.5em; display: flex; flex-direction: column; gap: 0.8em; }
.review .top { display: flex; justify-content: space-between; align-items: baseline; gap: 1em; flex-wrap: wrap; }
.review .top .sum { font-family: var(--pix); color: var(--amber2); font-size: 1.1em; }
.review .shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(15em, 1fr)); gap: 1em; overflow-y: auto; padding: 0.4em; }
.rshot { background: #fbf6e6; color: #2a2014; padding: 0.55em 0.55em 0.7em; box-shadow: 0 5px 12px rgba(0,0,0,0.35); transform: rotate(var(--rot)); animation: dealIn 0.45s cubic-bezier(.2,1.4,.4,1) both; animation-delay: var(--d); }
@keyframes dealIn { from { transform: translateY(30px) rotate(-8deg); opacity: 0; } }
.rshot img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; background: #222; }
.rshot .nm { font-family: var(--hand); font-size: 1.25em; margin-top: 0.25em; display: flex; justify-content: space-between; align-items: baseline; }
.rshot .st { color: #e0a020; letter-spacing: 1px; font-size: 0.95em; }
.rshot .new { font-family: var(--pix); background: var(--coral); color: #fff; font-size: 0.7em; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }
.rshot ul { margin: 0.35em 0 0; padding-left: 1.1em; font-size: 0.78em; line-height: 1.45; color: #5a4a30; }
.rshot .rp { font-family: var(--pix); font-size: 0.85em; color: #1f7a68; margin-top: 0.3em; }
.rshot .vid { font-family: var(--pix); font-size: 0.7em; background: #222; color: #ff6a5a; padding: 1px 5px; }
.review .ev { font-size: 0.9em; line-height: 1.6; max-height: 7em; overflow-y: auto; }
.review .ev div::before { content: ${pxIconCss('check', 2)}; margin-right: 0.4em; }
`;
let styled = false;
const RP_BY_STARS = [0, 2, 5, 10, 18, 30];

export function openReview(shots: Shot[], site: SiteId, tod: TimeOfDay): Promise<void> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  return new Promise(res => {
    const s = game.save;
    const box = el('div', 'review panel');
    let rp = 0;
    const evidence: string[] = [];
    const cards: HTMLElement[] = [];
    const intervals: number[] = [];
    shots.forEach((sh, i) => {
      const wasSeen = sh.species ? !!s.seen[sh.species] : true;
      let gained: string[] = [];
      if (sh.species) {
        gained = addEvidence(sh.species, sh.video ? null : sh.behavior, false);
        if (sh.video) for (const b of sh.videoBehaviors ?? []) gained.push(...addEvidence(sh.species, b, true));
        for (const o of sh.others) gained.push(...addEvidence(o, null, false));
        const best = s.best[sh.species];
        if (!sh.trap && (!best || best.stars <= sh.stars)) s.best[sh.species] = { thumb: sh.thumb, stars: sh.stars, behavior: sh.behavior };
      }
      let earned = RP_BY_STARS[sh.stars] + (sh.species && !wasSeen ? 20 : 0) + gained.filter(g => !g.startsWith('New species')).length * 6;
      if (sh.trap) earned = Math.min(earned, 8);
      rp += earned;
      evidence.push(...gained);
      s.album.push({ id: s.photoId++, species: sh.species, behavior: sh.behavior, others: sh.others, stars: sh.stars, score: sh.score, site, time: tod, video: sh.video, thumb: sh.thumb, notes: sh.notes });
      const name = sh.species ? SPECIES_BY_ID[sh.species].name : 'Scenery';
      const c = el('div', 'rshot');
      c.style.setProperty('--rot', `${(Math.random() * 4 - 2).toFixed(1)}deg`);
      c.style.setProperty('--d', `${i * 0.08}s`);
      c.innerHTML = `<img src="${sh.thumb}" alt=""><div class="nm"><span>${name}${sh.species && !wasSeen ? '<span class="new">NEW!</span>' : ''}${sh.video ? ` <span class="vid">${pxIcon('rec')} VIDEO</span>` : ''}</span><span class="st">${pxRating(sh.stars, 5)}</span></div><ul>${sh.notes.map(n => `<li>${n}</li>`).join('')}</ul><div class="rp">+${earned} RP</div>`;
      if (sh.video && sh.frames && sh.frames.length > 1) {
        const img = c.querySelector('img') as HTMLImageElement;
        let k = 0;
        intervals.push(window.setInterval(() => { k = (k + 1) % sh.frames!.length; img.src = sh.frames![k]; }, 110));
      }
      cards.push(c);
    });
    s.rp += rp;
    s.totalRp += rp;
    for (const k of Object.keys(s.flags)) if (k.startsWith('meal:')) delete s.flags[k];
    game.persist();
    const stars = shots.reduce((a, b) => a + b.stars, 0);
    box.innerHTML = `<div class="top"><h2 style="margin:0">Expedition report</h2><span class="sum">${shots.length} photo${shots.length === 1 ? '' : 's'} · ${stars} ${pxIcon('star')} · +${rp} RP</span></div>`;
    if (!shots.length) box.appendChild(el('p', '', 'No photos this time. Sometimes the jungle just watches you back.'));
    const grid = box.appendChild(el('div', 'shots'));
    cards.forEach(c => grid.appendChild(c));
    if (evidence.length) {
      box.appendChild(el('div', 'pix', '<span style="color:var(--teal2);font-size:0.85em;letter-spacing:0.1em">NEW FIELD NOTES</span>'));
      const ev = box.appendChild(el('div', 'ev'));
      for (const e of evidence) ev.appendChild(el('div', '', e));
    }
    const b = el('button', 'btn', `Drive back to camp ${pxIcon('play')}`);
    b.style.alignSelf = 'flex-end';
    box.appendChild(b);
    const close = game.ui.modal(box, () => { intervals.forEach(clearInterval); res(); }, false);
    b.onclick = () => { audio.play('ui'); close(); };
    if (evidence.some(e => e.startsWith('New species'))) setTimeout(() => audio.play('discover'), 400);
    shots.forEach((sh, i) => setTimeout(() => audio.play('star', { pitch: 0.8 + sh.stars * 0.12, vol: 0.4 }), 300 + i * 80));
  });
}
