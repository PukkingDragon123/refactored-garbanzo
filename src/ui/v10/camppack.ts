// V10 packing for the day (the trail sign at camp): energy, the pack's weight against what Mori can
// comfortably carry, the food and the tools he's taking, a packed lunch from Joshu's stores, a last
// word from the crew; then "Set off" opens the region map (src/ui/v10/regionmap.ts, the map module's)
// or, without it, Mori heads out along the home island on foot.

import { game } from '../../game/game';
import { uiIconURL, itemIconURL } from '../../art/itemicons';
import { ITEMS } from '../../game/items';
import { stacks, add, count } from '../../game/inventory';
import { openBackpack } from '../backpack';
import { sfx } from '../laptop-kit';
import { campPanel, esc } from './campkit';
import { energy, maxEnergy, packWeight, packCapacity, encumbrance } from '../../game/v10/energy';
import { gearFx, gearLevel, GEAR_BY_ID } from '../../game/v10/campgear';
import { dayState, dayNumber, leaveCamp } from '../../game/v10/day';
import { currentExpedition } from '../../game/v10/expedition';
import type { CampDay } from '../../game/v10/campday';
import { rand } from '../../core/math';

/** the map module's region map, if it is in the build (no hard dependency: it may not exist yet) */
const MAP = import.meta.glob('./regionmap.ts');
type MapMod = { openRegionMap?: (...a: unknown[]) => unknown };

const TIPS: [string, string][] = [
  ['joshu', 'Pack food, lad. You won’t find a galley out there.'],
  ['aroha', 'Heavy pack, short day. Light pack, long day. Choose.'],
  ['jenna', 'Did you charge the camera? I charged the camera. You’re welcome.'],
  ['joshu', 'Back before dark. I mean it.'],
  ['aroha', 'If your legs start shaking, turn round. The island will still be there tomorrow.'],
  ['jenna', 'Bring me back something shiny! Or squishy! Or both!'],
];

export async function openPackPrep(cd: CampDay) {
  const d = dayState(), day = dayNumber();
  const p = campPanel({ title: 'Pack for the day', sub: `Day ${day}. Where to, nature boy?`, icon: 'pack', closeLabel: 'Not yet' });
  let go = false;
  const render = () => {
    const e = energy(), em = Math.max(1, maxEnergy());
    const w = packWeight(), cap = Math.max(0.1, packCapacity()), enc = encumbrance();
    const over = w > cap;
    const foods = stacks().filter(s => ITEMS[s.id]?.kind === 'food' || ITEMS[s.id]?.eat);
    const foodN = foods.reduce((a, s) => a + s.n, 0);
    const kcal = foods.reduce((a, s) => a + (ITEMS[s.id]?.energy ?? 0) * s.n, 0);
    const lunch = (d.events['lunch'] ?? 0) === day;
    const packLv = gearLevel('pack');
    const [tw, tt] = TIPS[(day + rand.int(0, 2)) % TIPS.length];
    p.body.innerHTML = `
      <div class="cp-grid2">
        <div class="cp-card">
          <h3>Energy</h3>
          <div class="cp-bar" style="--c:var(--teal);margin-top:0.4em"><i style="--v:${Math.round((e / em) * 100)}%"></i></div>
          <p>${Math.round(e)} / ${Math.round(em)}${gearFx.wellFed() ? ' &middot; <span style="color:var(--teal2)">well fed: walking costs 10% less today</span>' : d.meals.breakfast === day ? '' : ' &middot; <span style="color:var(--amber2)">no breakfast yet</span>'}</p>
          <p style="opacity:0.75;font-size:0.82em">Walking, climbing and swimming use it up. Run out and somebody has to carry you home.</p>
        </div>
        <div class="cp-card">
          <h3>Load</h3>
          <div class="cp-bar" style="--c:${over ? 'var(--coral)' : 'var(--amber)'};--m:${Math.min(100, (cap / Math.max(cap, w)) * 100)}%;margin-top:0.4em"><i class="${over ? 'over' : ''}" style="--v:${Math.min(100, (w / Math.max(cap, w)) * 100)}%"></i><b></b></div>
          <p>${w.toFixed(1)} kg of ${cap.toFixed(1)} kg comfortable${over ? ' &middot; <span style="color:#ffb3a4">too heavy: you’ll tire faster</span>' : enc > 0.75 ? ' &middot; <span style="color:var(--amber2)">nearly full</span>' : ''}</p>
          ${packLv ? `<p style="opacity:0.75;font-size:0.82em">Pack upgrade: ${esc(GEAR_BY_ID.pack.steps[packLv - 1].name)} (+${gearFx.packBonus()} kg)</p>` : '<p style="opacity:0.75;font-size:0.82em">Jenna can make the pack carry more (her bench).</p>'}
        </div>
      </div>
      <div class="cp-card">
        <h3>Food</h3>
        ${foods.length ? `<div>${foods.map(s => `<span class="cp-chip"><img src="${itemIconURL(s.id, 2)}" alt="">${s.n}× ${esc(ITEMS[s.id]?.name ?? s.id)}</span>`).join('')}</div>` : '<p style="color:#ffb3a4">Nothing to eat in your pack.</p>'}
        <p style="opacity:0.8;font-size:0.85em">${foodN ? `${foodN} thing${foodN > 1 ? 's' : ''} to eat${kcal ? ` (about ${Math.round(kcal)} energy)` : ''}.` : 'Take something: berries, pipi, a ship biscuit.'} Quick-eat with <span class="key">H</span> when you flag, or from the pack (Tab).</p>
        ${lunch ? '<p style="color:var(--teal2);font-size:0.85em">Joshu packed you lunch.</p>' : '<button class="btn teal lunch" style="margin-top:0.4em">Take a packed lunch from Joshu’s stores</button>'}
      </div>
      <div class="cp-card">
        <h3>Tools</h3>
        <div>${game.save.tools.map(t => `<span class="cp-chip" title="${esc(ITEMS[t]?.name ?? t)}"><img src="${itemIconURL(t, 2)}" alt="">${esc(ITEMS[t]?.name ?? t)}</span>`).join('')}</div>
        <p style="opacity:0.8;font-size:0.85em">${game.save.tools.includes('headlamp') ? 'Headlamp: for caves and coming home late.' : 'No headlamp: stay out of the dark.'}</p>
      </div>
      <p class="cp-empty"><b style="font-family:var(--pix);color:var(--amber2)">${esc(tw === 'joshu' ? 'Joshu' : tw === 'aroha' ? 'Aroha' : 'Jenna')}:</b> “${esc(tt)}”</p>`;
    const lb = p.body.querySelector('.lunch') as HTMLButtonElement | null;
    if (lb) lb.onclick = () => {
      d.events['lunch'] = day;
      const fish = d.larder > 0;
      if (fish) d.larder--;
      add('ration', fish ? 2 : 1);
      if (count('tea') < 1 && (game.save.quests['r_tea'] === 'done')) add('tea', 1);
      game.persist();
      sfx('zipper');
      render();
    };
  };
  // footer: repack, set off
  const repack = document.createElement('button');
  repack.className = 'btn ghost';
  repack.innerHTML = 'Repack <span class="key">B</span>';
  repack.onclick = async () => { p.root.style.visibility = 'hidden'; await openBackpack({}); p.root.style.visibility = ''; render(); };
  const off = document.createElement('button');
  off.className = 'btn';
  off.innerHTML = 'Set off &rarr;';
  off.onclick = () => { go = true; p.close(); };
  const x = p.foot.querySelector('.x')!;
  p.foot.insertBefore(repack, x);
  p.foot.appendChild(off);
  p.onKey(e => { if (e.code === 'Enter') { go = true; p.close(); return true; } if (e.code === 'KeyB') { repack.click(); return true; } });
  render();
  await p.closed;
  if (go) await setOff(cd);
}

/** off on the day's expedition: the region map, or (without it) the home island on foot */
async function setOff(cd: CampDay) {
  const load = MAP['./regionmap.ts'];
  let m: MapMod | null = null;
  if (load) { try { m = (await load()) as MapMod; } catch (e) { console.warn('[camppack] region map', e); } }
  if (m?.openRegionMap) {
    const scene = cd.s;
    await Promise.resolve(m.openRegionMap());
    // it counts as leaving once an expedition is under way (or the camp scene is gone)
    for (let i = 0; i < 30; i++) {
      if (currentExpedition() || game.scene !== scene) { leaveCamp(currentExpedition()); return; }
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }
  // no map in this build: explore the home island on foot
  leaveCamp('home');
  cd.s.bark('joshu', rand.pick(['Off you go! Back before dark!', 'Fair winds, Doc!', 'Mind the seal!']), { expr: 'happy' });
  game.ui.toast('Off you go: east past the palm grove and the stream, or west past the wreck. Come back into camp when you’re done for the day.', 'EXPEDITION', 'teal', 6000);
  void uiIconURL;
}
