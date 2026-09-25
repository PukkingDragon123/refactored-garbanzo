// Heads-up displays for camp and expeditions.

import { game } from '../game/game';
import { objective } from '../game/story';
import { readyFactCount } from '../game/research';
import { iconURL } from './icons';
import { el } from './ui';

export function campHud(_scene?: unknown) {
  const h = game.ui.hud;
  const s = game.save;
  const o = objective();
  const ready = readyFactCount();
  h.innerHTML = `
    <div class="hud-tl"><div class="hud-site panel"><b>Base Camp</b><span>Day ${s.day}</span></div>
      <div class="hud-meters"><div class="meter panel"><img src="${iconURL('rp')}" style="width:1.2em;image-rendering:pixelated" alt=""> <i>${s.rp}</i> RP</div>
      ${ready ? `<div class="meter panel" style="color:var(--amber2)">${ready} fact${ready > 1 ? 's' : ''} ready to deduce</div>` : ''}</div></div>
    <div class="hud-tr"><div class="objective panel"><span class="t">${o.t}</span>${o.text}</div></div>
    <div class="hint panel"><span class="key">A</span><span class="key">D</span> walk &nbsp; <span class="key">E</span> / click interact &nbsp; <span class="key">J</span> Field Guide</div>`;
  h.classList.remove('hidden');
}

export const GADGETS = [
  { id: 'fruit', name: 'Fruit lure', desc: 'Attracts fruit-eaters and foragers' },
  { id: 'grub', name: 'Grub pot', desc: 'Attracts insect-eaters and serpents' },
  { id: 'fish', name: 'Fish bait', desc: 'Attracts birds and water hunters' },
  { id: 'caller', name: 'Bird caller', desc: 'Plays calls that draw birds (and hawks)' },
  { id: 'trap', name: 'Camera trap', desc: 'Snaps photos automatically when animals pass' },
];

export interface ExpHudRefs {
  film: HTMLElement;
  gadgets: HTMLElement[];
  aware: HTMLElement;
  awareBar: HTMLElement;
  awareLabel: HTMLElement;
  obj: HTMLElement;
  clock: HTMLElement;
}

export function expeditionHud(siteName: string, timeLabel: string): ExpHudRefs {
  const h = game.ui.hud;
  const o = objective();
  h.innerHTML = '';
  const tl = h.appendChild(el('div', 'hud-tl'));
  const site = tl.appendChild(el('div', 'hud-site panel', `<b>${siteName}</b><span class="clock">${timeLabel}</span>`));
  const meters = tl.appendChild(el('div', 'hud-meters'));
  const film = meters.appendChild(el('div', 'meter panel', ''));
  const tr = h.appendChild(el('div', 'hud-tr'));
  const obj = tr.appendChild(el('div', 'objective panel', `<span class="t">${o.t}</span>${o.text}`));
  const aware = h.appendChild(el('div', 'awareness panel', `<span class="lbl">Unnoticed</span><div class="bar"><div></div></div>`));
  aware.style.opacity = '0';
  const g = h.appendChild(el('div', 'gadgets'));
  const gadgets = GADGETS.map((gd, i) => {
    const s = g.appendChild(el('div', 'gslot panel', `<span class="k">${i + 1}</span><img src="${iconURL(gd.id)}" alt="${gd.name}"><span class="n"></span>`));
    s.title = `${gd.name}: ${gd.desc}`;
    return s;
  });
  h.appendChild(el('div', 'hint panel', `<span class="key">RMB</span>/<span class="key">Q</span> camera &nbsp;<span class="key">Click</span> shoot &nbsp;<span class="key">Wheel</span> zoom &nbsp;<span class="key">V</span> photo/video<br><span class="key">S</span> crouch / hide in bushes &nbsp;<span class="key">1-5</span>+<span class="key">F</span> place gadget &nbsp;<span class="key">E</span> collect &nbsp;<span class="key">J</span> guide`));
  h.classList.remove('hidden');
  return { film, gadgets, aware, awareBar: aware.querySelector('.bar > div') as HTMLElement, awareLabel: aware.querySelector('.lbl') as HTMLElement, obj, clock: site.querySelector('.clock') as HTMLElement };
}
