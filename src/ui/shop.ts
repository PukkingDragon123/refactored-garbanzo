// Pip's gear workshop.

import { game } from '../game/game';
import { el } from './ui';
import { iconURL } from './icons';
import { audio } from '../core/audio';
import { campHud } from './hud';

interface Item { id: string; kind: 'item' | 'upgrade'; name: string; desc: string; price: (lvl: number) => number; max?: number; icon: string; req?: () => boolean }

const ITEMS: Item[] = [
  { id: 'fruit', kind: 'item', name: 'Fruit lure', desc: 'A bundle of ripe fallen fruit. Foragers can’t resist it.', price: () => 10, icon: 'fruit' },
  { id: 'grub', kind: 'item', name: 'Grub pot', desc: 'A pot of wriggling beetle grubs. Serpents and insect-eaters come running.', price: () => 10, icon: 'grub' },
  { id: 'fish', kind: 'item', name: 'Fish bait', desc: 'Smelly fish scraps. Attracts birds and anything that lurks in water.', price: () => 12, icon: 'fish' },
  { id: 'caller', kind: 'item', name: 'Bird caller', desc: 'Plays recorded calls. Birds investigate, and so do hawks.', price: () => 15, icon: 'caller' },
  { id: 'trap', kind: 'item', name: 'Camera trap', desc: 'Strap it to a trunk; it photographs anything that walks by.', price: () => 25, icon: 'trap' },
  { id: 'lens', kind: 'upgrade', name: 'Telephoto lens', desc: 'More zoom for distant or dangerous subjects.', price: l => [0, 80, 200][l] ?? 0, max: 3, icon: 'lens' },
  { id: 'af', kind: 'upgrade', name: 'Autofocus motor', desc: 'Focus locks faster on moving subjects.', price: l => [0, 60, 150][l] ?? 0, max: 3, icon: 'af' },
  { id: 'film', kind: 'upgrade', name: 'Film pouch', desc: '+8 shots per expedition.', price: l => [0, 50, 120][l] ?? 0, max: 3, icon: 'film' },
  { id: 'video', kind: 'upgrade', name: 'Video module', desc: 'Record behaviour sequences. Some facts need video evidence.', price: () => 70, max: 1, icon: 'video' },
  { id: 'ghillie', kind: 'upgrade', name: 'Ghillie poncho', desc: 'Look like a fern. Animals notice you far less.', price: () => 90, max: 1, icon: 'ghillie' },
  { id: 'headlamp', kind: 'upgrade', name: 'Headlamp', desc: 'Lets you go out at night. Nocturnal species await.', price: () => 90, max: 1, icon: 'headlamp' },
];

const CSS = `
.shop { width: min(820px, 95vw); padding: 1.4em 1.6em; }
.shop .head { display: flex; justify-content: space-between; align-items: center; gap: 1em; margin-bottom: 0.8em; flex-wrap: wrap; }
.shop .rp { font-family: var(--pix); font-size: 1.2em; color: var(--amber2); display: flex; align-items: center; gap: 0.4em; }
.shop .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(17em, 1fr)); gap: 0.7em; }
.shop .it { display: grid; grid-template-columns: 3em 1fr auto; gap: 0.7em; align-items: center; padding: 0.6em 0.7em; background: rgba(241,232,208,0.05); border: 1px solid rgba(241,232,208,0.1); }
.shop .it img { width: 3em; image-rendering: pixelated; }
.shop .it .nm { font-family: var(--pix); color: var(--paper); }
.shop .it .ds { font-size: 0.82em; opacity: 0.75; line-height: 1.35; }
.shop .it .own { font-size: 0.78em; color: var(--teal2); font-family: var(--pix); }
.shop .sect { font-family: var(--pix); color: var(--teal2); letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.85em; margin: 0.9em 0 0.4em; }
`;
let styled = false;

export function openShop() {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  audio.play('uiOpen');
  const box = el('div', 'shop panel');
  const close = game.ui.modal(box, () => { game.persist(); campHud(); });
  const render = () => {
    const s = game.save;
    box.innerHTML = `<div class="head"><h2 style="margin:0">Pip’s Gear Workshop</h2><div class="rp"><img src="${iconURL('rp')}" style="width:1.3em;image-rendering:pixelated" alt=""> ${s.rp} RP</div></div>`;
    for (const kind of ['item', 'upgrade'] as const) {
      box.appendChild(el('div', 'sect', kind === 'item' ? 'Lures & gadgets' : 'Camera & field upgrades'));
      const list = box.appendChild(el('div', 'list'));
      for (const it of ITEMS.filter(i => i.kind === kind)) {
        const lvl = kind === 'upgrade' ? s.vars['up:' + it.id] ?? 0 : 0;
        const maxed = kind === 'upgrade' && lvl >= (it.max ?? 1);
        const price = it.price(lvl);
        const row = list.appendChild(el('div', 'it'));
        const own = kind === 'item' ? `Carrying: ${s.vars['it:' + it.id] ?? 0}` : it.max && it.max > 1 ? `Level ${lvl}/${it.max}` : lvl ? 'Owned' : '';
        row.innerHTML = `<img src="${iconURL(it.icon)}" alt=""><div><div class="nm">${it.name}</div><div class="ds">${it.desc}</div><div class="own">${own}</div></div>`;
        const b = el('button', 'btn' + (maxed ? ' ghost' : ''), maxed ? 'Max' : `${price} RP`);
        b.disabled = maxed || s.rp < price;
        b.onclick = () => {
          if (s.rp < price) return;
          s.rp -= price;
          if (kind === 'item') s.vars['it:' + it.id] = (s.vars['it:' + it.id] ?? 0) + 1;
          else s.vars['up:' + it.id] = lvl + 1;
          audio.play('coin');
          render();
        };
        row.appendChild(b);
      }
    }
    const x = el('button', 'btn ghost', 'Done');
    x.style.marginTop = '1em';
    x.onclick = () => { audio.play('uiBack'); close(); };
    box.appendChild(x);
  };
  render();
}
