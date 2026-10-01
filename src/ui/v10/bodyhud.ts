// V10 body HUD: an ENERGY bar on top of the portrait's gold-trimmed bars, the PACK bar turned into a
// weight readout (kg / capacity), ailment chips (SICK / DIZZY), and the low-energy screen-edge dim.
// Shown on expeditions (see v10/energy.ts onExpedition); Hud2 mounts it and ticks it.

import { el } from '../ui';
import { game } from '../../game/game';
import { energy, maxEnergy, packWeight, packCapacity, onExpedition, lowness, hasAilment, dizziness, onSpend, EAT_KEY } from '../../game/v10/energy';

const CSS = `
.h2 .v10dim { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.6s;
  background: radial-gradient(ellipse 72% 68% at 50% 52%, transparent 52%, rgba(14, 6, 4, 0.55) 78%, rgba(8, 2, 2, 0.92) 100%); }
.h2 .v10dim.pulse { animation: v10Breath 2.4s ease-in-out infinite; }
.h2 .v10dim i { position: absolute; inset: 0; opacity: 0; transition: opacity 1s; }
.h2 .v10dim i.sick { background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 60%, rgba(90, 120, 20, 0.35) 100%); }
.h2 .v10dim i.dizzy { background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(120, 60, 160, 0.32) 100%); animation: v10Swirl 3.2s ease-in-out infinite; }
@keyframes v10Breath { 50% { filter: brightness(1.35); transform: scale(0.985); } }
@keyframes v10Swirl { 0%, 100% { transform: translate(-1.5%, 0.5%) scale(1.02); } 50% { transform: translate(1.5%, -0.5%) scale(1.04); } }
.h2 .who .bars small.v10en { pointer-events: auto; cursor: pointer; display: flex; align-items: center; gap: 0.35em; }
.h2 .who .bars small.v10en b { font-weight: 400; color: #fff6d0; min-width: 1.6em; }
.h2 .who .bars small .v10k { display: inline-grid; place-items: center; min-width: 1.35em; height: 1.35em; padding: 0 0.2em; background: #ffe9a8; color: #2a1408; text-shadow: none; box-shadow: 0 2px 0 #a87410; font-size: 0.85em; margin-left: auto; margin-right: 0.3em; }
body.touchmode .h2 .who .bars small .v10k { display: none; }
.h2 .who .bars small .v10st { padding: 0 0.35em; font-size: 0.85em; color: #fff; text-shadow: none; box-shadow: 0 0 0 1px #1a0e06; }
.h2 .who .bars small .v10st.sick { background: #6a8a1c; }
.h2 .who .bars small .v10st.dizzy { background: #7a3aa8; animation: v10Wob 0.9s ease-in-out infinite; }
@keyframes v10Wob { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
.h2 .who .bars i.v10e::after { background: linear-gradient(#e2fa96 0 35%, #8ac83a 35% 75%, #5a9a2a 75%); }
.h2 .who .bars i.v10e.mid::after { background: linear-gradient(#ffe48a 0 35%, #e8a830 35% 75%, #b87a18 75%); }
.h2 .who .bars i.v10e.low::after { background: linear-gradient(#ff9a7a 0 35%, #e0442e 35% 75%, #a8281a 75%); }
.h2 .who .bars i.v10e.low { animation: v10Low 0.8s steps(2) infinite; }
.h2 .who .bars i.v10e.hit { box-shadow: 0 0 0 2px #1a0e06, 0 0 0 4px #ff5a3a, 0 0 0 6px #1a0e06; }
@keyframes v10Low { 50% { box-shadow: 0 0 0 2px #1a0e06, 0 0 0 4px #ff6a4a, 0 0 0 6px #1a0e06, 0 0 10px 4px rgba(255, 80, 50, 0.55); } }
.h2 .who .bars i.v10w::after { background: linear-gradient(#ffe2a0 0 35%, #d8a050 35% 75%, #a8743a 75%); }
.h2 .who .bars i.v10w.over::after { background: linear-gradient(#ff9a7a 0 35%, #e0442e 35% 75%, #a8281a 75%); }
.h2 .who .bars i.v10w.over { animation: v10Low 1.2s steps(2) infinite; }
.h2 .who .bars small.v10over { color: #ffb3a4; }
`;

let styled = false;
let mode: 'auto' | 'always' | 'never' = 'auto';
/** show the body HUD always / never / on expeditions only (default) */
export function setBodyHud(m: 'auto' | 'always' | 'never') { mode = m; }
const shown = () => (mode === 'always' ? true : mode === 'never' ? false : onExpedition());

export interface BodyHud {
  /** the PACK bar shows weight right now (Hud2 then leaves it alone) */
  ownsPack(): boolean;
  update(dt: number): void;
  destroy(): void;
}

/** add the energy / weight rows to Hud2's portrait bars (who) and the dim overlay to its root */
export function mountBodyHud(root: HTMLElement, who: HTMLElement): BodyHud {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const bars = who.querySelector('.bars') as HTMLElement;
  const dim = root.insertBefore(el('div', 'v10dim', '<i class="sick"></i><i class="dizzy"></i>'), root.firstChild);
  const lab = el('small', 'v10en', `ENERGY <b>100</b><span class="v10s"></span><span class="v10k">${EAT_KEY.replace('Key', '')}</span>`);
  lab.title = `Eat a snack (${EAT_KEY.replace('Key', '')})`;
  const bar = el('i', 'v10e');
  bars.insertBefore(bar, bars.firstChild);
  bars.insertBefore(lab, bar);
  lab.addEventListener('pointerdown', e => { e.stopPropagation(); if (!game.ui.blocking) void import('../../game/v10/forage10').then(m => m.quickEat()); });
  const packLab = bars.querySelector('small:not(.v10en)') as HTMLElement | null;
  const packBar = bars.querySelector('i.a') as HTMLElement | null;
  const num = lab.querySelector('b') as HTMLElement, st = lab.querySelector('.v10s') as HTMLElement;
  const sick = dim.querySelector('.sick') as HTMLElement, dizzy = dim.querySelector('.dizzy') as HTMLElement;
  let on: boolean | null = null, hitT = 0, t = 1, keyStatus = '';
  const off = onSpend(n => { if (n >= 4) hitT = 0.6; });
  const vis = (v: boolean) => {
    lab.style.display = bar.style.display = v ? '' : 'none';
    if (!v) {
      dim.style.opacity = '0';
      if (packLab) { packLab.textContent = 'PACK'; packLab.classList.remove('v10over'); }
      packBar?.classList.remove('v10w', 'over');
    } else packBar?.classList.add('v10w');
  };
  return {
    ownsPack: () => !!on,
    update(dt: number) {
      t += dt;
      hitT = Math.max(0, hitT - dt);
      const now = shown();
      if (now !== on) { on = now; vis(now); t = 1; }
      if (!on) return;
      bar.classList.toggle('hit', hitT > 0);
      // the dim and ailment tints follow every frame (cheap); the numbers four times a second
      const low = lowness();
      dim.style.opacity = (low > 0 ? 0.25 + low * 0.75 : 0).toFixed(3);
      dim.classList.toggle('pulse', low > 0.55);
      sick.style.opacity = hasAilment('stomach') ? '1' : '0';
      dizzy.style.opacity = Math.min(1, dizziness() * 1.4).toFixed(2);
      if (t < 0.25) return;
      t = 0;
      const e = energy(), m = maxEnergy(), f = e / m;
      num.textContent = String(Math.ceil(e));
      bar.style.setProperty('--v', `${Math.round(f * 100)}%`);
      bar.classList.toggle('mid', f < 0.5 && f >= 0.25);
      bar.classList.toggle('low', f < 0.25);
      const ks = (hasAilment('stomach') ? 's' : '') + (hasAilment('dizzy') ? 'd' : '');
      if (ks !== keyStatus) {
        keyStatus = ks;
        st.innerHTML = (ks.includes('s') ? '<span class="v10st sick">SICK</span>' : '') + (ks.includes('d') ? '<span class="v10st dizzy">DIZZY</span>' : '');
      }
      const w = packWeight(), cap = packCapacity();
      if (packLab) {
        packLab.textContent = `${w > cap ? 'OVERLOADED' : 'PACK'} ${w.toFixed(1)}/${cap} kg`;
        packLab.classList.toggle('v10over', w > cap);
      }
      if (packBar) {
        packBar.style.setProperty('--v', `${Math.round(Math.min(1, w / cap) * 100)}%`);
        packBar.classList.toggle('over', w > cap);
      }
    },
    destroy() {
      off();
      dim.remove();
    },
  };
}
