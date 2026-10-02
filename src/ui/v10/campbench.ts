// V10 Jenna's tech bench: upgrade the field gear (camera body, backpack, boots, snorkel and wetsuit,
// headlamp, translator) with materials and Research Points. Buying one plays a little scene of Jenna
// at work (sparks, hammering, "Done!").

import { game } from '../../game/game';
import { uiIconURL } from '../../art/itemicons';
import { sfx, wait } from '../laptop-kit';
import { campPanel, itemChips, pips, refreshRp, esc } from './campkit';
import { GEAR, gearLevel, nextStep, blockers, buyGear } from '../../game/v10/campgear';
import type { GearId, GearStep } from '../../game/v10/campgear';
import type { CampDay } from '../../game/v10/campday';
import { C10 } from '../../game/v10/campcrew';
import { groundY } from '../../art/island4/layout';
import { addBond } from '../../game/v10/day';
import { rand } from '../../core/math';
import { A } from '../../game/assets';

const HELLO = ['Welcome to Jenna’s Workshop! No refunds. No warranty. Lots of love.', 'What are we breaking today? I mean FIXING. Fixing.', 'Bring me parts, get back miracles. Mostly miracles.', 'Step into my office. Mind Kevin.'];

export async function openBench(cd: CampDay) {
  const p = campPanel({ title: 'Jenna’s workbench', sub: rand.pick(HELLO), iconURL: game.ui.portraitURL('jenna', 'happy') || uiIconURL('hammer', 4), rp: true });
  let bought: { id: GearId; step: GearStep } | null = null;
  const render = () => {
    p.body.innerHTML = '';
    for (const g of GEAR) {
      const lv = gearLevel(g.id), st = nextStep(g.id), bl = blockers(g.id);
      const cur = lv > 0 ? g.steps[lv - 1].name : g.base;
      const card = p.body.appendChild(document.createElement('div'));
      card.className = 'cp-card';
      card.innerHTML = `<div style="display:flex;gap:0.8em;align-items:flex-start">
        <img src="${uiIconURL(g.icon, 3)}" alt="" style="width:2.8em;height:2.8em;image-rendering:pixelated;flex:none">
        <div style="flex:1;min-width:0">
          <h3>${esc(g.name)} ${pips(lv, g.steps.length)}</h3>
          <p style="opacity:0.75">${esc(cur)}</p>
          ${st ? `<p><b style="font-family:var(--pix);color:var(--teal2)">Next: ${esc(st.name)}</b> &middot; ${esc(st.desc)}</p>
          <p style="color:var(--amber2)">${esc(st.effect)}</p>
          <div>${itemChips(st.items)}<span class="cp-chip ${game.save.rp >= st.rp ? 'ok' : 'no'}"><img src="${uiIconURL('rp', 2)}" alt="">${st.rp} RP</span></div>
          ${bl.filter(b => b !== 'materials' && !b.startsWith('Needs ' + st.rp)).map(b => `<p style="color:#ffb3a4;font-size:0.82em">${esc(b)}</p>`).join('')}` : '<p style="color:var(--teal2)">Fully upgraded. Jenna is very proud.</p>'}
        </div>
        ${st ? `<button class="btn${bl.length ? ' ghost' : ''} up" ${bl.length ? 'disabled' : ''}>Upgrade</button>` : ''}
      </div>`;
      const b = card.querySelector('.up') as HTMLButtonElement | null;
      if (b) b.onclick = () => {
        const step = buyGear(g.id);
        if (!step) { sfx('wrong'); return; }
        sfx('craft');
        bought = { id: g.id, step };
        p.close();
      };
    }
    const tip = p.body.appendChild(document.createElement('p'));
    tip.className = 'cp-empty';
    tip.textContent = 'Materials come from the beach and your expeditions; Research Points from your uploads. Some upgrades need skills from the laptop’s skill tree.';
    refreshRp(p);
  };
  render();
  await p.closed;
  const b = bought as { id: GearId; step: GearStep } | null;
  if (b) await upgradeScene(cd, b.step);
}

/** Jenna at work on the upgrade */
async function upgradeScene(cd: CampDay, step: GearStep) {
  const st = cd.st, s = cd.s, j = s.jenna;
  await st.cut(async () => {
    cd.hold('jenna');
    st.place(j, C10.bench + 22, -1, 'wrench');
    const p = s.player;
    p.facing = 1;
    const sx = C10.bench + 12, sy = groundY(C10.bench) - 22;
    for (let i = 0; i < 6; i++) {
      j.setAnim(i % 2 ? 'hammer' : 'wrench');
      sfx(i % 2 ? 'hammer' : 'scanBeep', { vol: 0.3, pitch: 1.2 + rand.next() * 0.6 });
      for (let k = 0; k < 4; k++) s.main.glowParticles.spawn({ frame: A.dot, x: sx, y: sy, vx: rand.range(-40, 40), vy: rand.range(-60, -20), ay: 180, life: 0.4, color: [1, 0.85, 0.45], alpha: 1, alpha1: 0, glow: true, intensity: 2.5 });
      await wait(380);
    }
    j.setAnim('idle');
    j.faceTo(p.x);
    sfx('skillUnlock');
    await st.say([
      // (the speech bubbles want HTML: a bare & would never end)
      { who: 'jenna', text: `Done! ${esc(step.name)}.`, expr: 'excited', react: 'bounce' },
      { who: 'jenna', text: esc(step.jenna), expr: 'smug' },
    ]);
    addBond('jenna', 3);
  });
  cd.release('jenna');
  game.ui.toast(`Upgraded: <b>${esc(step.name)}</b>. ${esc(step.effect)}`, 'GEAR', 'teal', 5000);
  s.hud?.refresh(true);
}
