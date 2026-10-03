// V11 body HUD: no bars. On expeditions Mori's state shows on Mori and around the edge of the
// screen: when he runs low he sweats (an emote now and then) and breathes hard (energy.ts plays the
// breathing), the screen edge darkens and pulses, and a small canteen appears in the corner with
// what's left in it (click it, or press H, for a snack). An overloaded pack shows as a pencilled
// note by the canteen; a stomach ache or dizziness tints the edge of the screen (and gets a note).
// Hud2 mounts it and ticks it.

import { el } from '../ui';
import { game } from '../../game/game';
import { energy, maxEnergy, packWeight, packCapacity, onExpedition, lowness, hasAilment, dizziness, onSpend, EAT_KEY } from '../../game/v10/energy';
import { svgInk, roughRect, roughLine } from '../v11/paper';

const CSS = `
.h2 .v10dim { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.6s;
  background: radial-gradient(ellipse 72% 68% at 50% 52%, transparent 52%, rgba(14, 6, 4, 0.55) 78%, rgba(8, 2, 2, 0.92) 100%); }
.h2 .v10dim.pulse { animation: v10Breath 2.4s ease-in-out infinite; }
.h2 .v10dim i { position: absolute; inset: 0; opacity: 0; transition: opacity 1s; }
.h2 .v10dim i.sick { background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 60%, rgba(90, 120, 20, 0.35) 100%); }
.h2 .v10dim i.dizzy { background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(120, 60, 160, 0.32) 100%); animation: v10Swirl 3.2s ease-in-out infinite; }
@keyframes v10Breath { 50% { filter: brightness(1.35); transform: scale(0.985); } }
@keyframes v10Swirl { 0%, 100% { transform: translate(-1.5%, 0.5%) scale(1.02); } 50% { transform: translate(1.5%, -0.5%) scale(1.04); } }
`;

let styled = false;
let mode: 'auto' | 'always' | 'never' = 'auto';
/** show the body HUD always / never / on expeditions only (default) */
export function setBodyHud(m: 'auto' | 'always' | 'never') { mode = m; }
const shown = () => (mode === 'always' ? true : mode === 'never' ? false : onExpedition());

export interface BodyHud {
  /** (kept for the V2 API: the pack readout is the canteen note now) */
  ownsPack(): boolean;
  update(dt: number): void;
  destroy(): void;
}

/** a canteen drawn in ink with the water level showing through */
function canteenSvg(level: number): string {
  const top = 12 + (1 - level) * 30;
  return svgInk(30, 48, [
    { d: `M6 ${top.toFixed(1)} L24 ${top.toFixed(1)} L24 43 Q15 46 6 43 Z`, c: 'none', fill: 'rgba(90,160,220,0.75)', w: 0 },
    { d: roughRect(4, 9, 22, 36, { seed: 3, double: false, rough: 0.8 }), c: '#f4e6c4', w: 2.2 },
    { d: roughRect(10, 2, 10, 7, { seed: 5, double: false, rough: 0.5 }), c: '#f4e6c4', w: 2 },
    { d: roughLine(4, 22, 26, 22, { seed: 7, double: false }) + roughLine(4, 34, 26, 34, { seed: 9, double: false }), c: '#f4e6c4', w: 1, opacity: 0.5 },
  ]);
}

/** add the canteen and the edge dim to the HUD root */
export function mountBodyHud(root: HTMLElement, _who?: HTMLElement): BodyHud {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const dim = root.insertBefore(el('div', 'v10dim', '<i class="sick"></i><i class="dizzy"></i>'), root.firstChild);
  const can = root.appendChild(el('div', 'hm-can pp-hand', '<div class="bottle"></div><span></span>'));
  can.title = `Eat a snack (${EAT_KEY.replace('Key', '')})`;
  can.addEventListener('pointerdown', e => { e.stopPropagation(); if (!game.ui.blocking) void import('../../game/v10/forage10').then(m => m.quickEat()); });
  const bottle = can.querySelector('.bottle') as HTMLElement, label = can.querySelector('span') as HTMLElement;
  const sick = dim.querySelector('.sick') as HTMLElement, dizzy = dim.querySelector('.dizzy') as HTMLElement;
  let on: boolean | null = null, t = 1, sweatT = 3, lastLvl = -1, lastLab = '';
  const off = onSpend(n => { if (n >= 4) can.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 220 }); });
  return {
    ownsPack: () => false,
    update(dt: number) {
      t += dt;
      const now = shown();
      if (now !== on) { on = now; if (!now) { dim.style.opacity = '0'; can.classList.remove('on'); } t = 1; }
      if (!on) return;
      // the edge of the screen darkens and breathes as he tires; ailments tint it
      const low = lowness();
      dim.style.opacity = (low > 0 ? 0.25 + low * 0.75 : 0).toFixed(3);
      dim.classList.toggle('pulse', low > 0.55);
      sick.style.opacity = hasAilment('stomach') ? '1' : '0';
      dizzy.style.opacity = Math.min(1, dizziness() * 1.4).toFixed(2);
      // sweat drops on Mori when he's worn out
      if (low > 0.25) {
        sweatT -= dt;
        if (sweatT <= 0) {
          sweatT = 6 - low * 3 + Math.random() * 2;
          const p = (game.scene as unknown as { player?: { body?: { showEmote?(e: string, t?: number): void } }; cutscene?: boolean } | null);
          if (p && !p.cutscene && !game.ui.blocking) p.player?.body?.showEmote?.('sweat', 1.2);
        }
      }
      if (t < 0.25) return;
      t = 0;
      const f = energy() / maxEnergy();
      const w = packWeight(), cap = packCapacity();
      const over = w > cap;
      const ail = hasAilment('stomach') ? 'tummy ache' : hasAilment('dizzy') ? 'dizzy' : '';
      // the canteen only comes out when it's needed
      const need = f < 0.35 || over || !!ail;
      can.classList.toggle('on', need);
      can.classList.toggle('crit', f < 0.15);
      const lvl = Math.round(f * 20) / 20;
      if (lvl !== lastLvl) { lastLvl = lvl; bottle.innerHTML = canteenSvg(Math.max(0.04, Math.min(1, f / 0.5))); }
      const lab = `${f < 0.35 ? `running low <span class="key">${EAT_KEY.replace('Key', '')}</span> eat` : ''}${over ? `<span class="hm-ail">pack too heavy (${w.toFixed(1)}/${cap} kg)</span>` : ''}${ail ? `<span class="hm-ail">${ail}</span>` : ''}`;
      if (lab !== lastLab) { lastLab = lab; label.innerHTML = lab; }
    },
    destroy() {
      off();
      dim.remove();
      can.remove();
    },
  };
}
