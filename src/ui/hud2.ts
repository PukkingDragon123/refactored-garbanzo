// V2 HUD: location + day, tracked quest, backpack button with slot count, RP counter, key hints,
// and little item icons that fly into the backpack when you collect something.

import { el } from './ui';
import { game } from '../game/game';
import { trackedQuest, currentStepIndex } from '../game/quests';
import { capacity } from '../game/inventory';
import { itemIconURL, uiIconURL } from '../art/itemicons';

const CSS = `
.h2 { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s; }
.h2.off { opacity: 0; }
.h2 .loc { position: absolute; left: 16px; top: 14px; padding: 0.45em 0.9em; display: flex; flex-direction: column; gap: 1px; }
.h2 .loc b { font-family: var(--pix); color: var(--amber2); font-weight: 600; font-size: 1.05em; letter-spacing: 0.02em; }
.h2 .loc span { font-size: 0.8em; opacity: 0.8; }
.h2 .quest { position: absolute; right: 16px; top: 14px; max-width: min(24em, 36vw); padding: 0.5em 0.9em 0.55em; }
.h2 .quest .t { font-family: var(--pix); color: var(--teal2); font-size: 0.78em; letter-spacing: 0.08em; text-transform: uppercase; display: flex; gap: 0.5em; align-items: center; }
.h2 .quest .t i { font-style: normal; color: var(--amber2); }
.h2 .quest .s { font-size: 0.9em; line-height: 1.35; margin-top: 2px; }
.h2 .quest .pb { height: 5px; background: rgba(255,255,255,0.12); margin-top: 5px; }
.h2 .quest .pb > div { height: 100%; background: var(--teal); transition: width 0.3s; }
.h2 .quest.flash { animation: qflash 0.9s ease-out; }
@keyframes qflash { 0% { box-shadow: 0 0 0 3px var(--amber2), 0 10px 30px var(--shadow); } 100% { box-shadow: 0 0 0 2px rgba(4,10,9,0.7), 0 10px 30px var(--shadow); } }
.h2 .bar { position: absolute; left: 16px; bottom: 14px; display: flex; gap: 8px; align-items: flex-end; }
.h2 .btn2 { pointer-events: auto; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 0.35em 0.55em 0.3em; font-family: var(--pix); font-size: 0.78em; color: var(--paper); }
.h2 .btn2 img { width: 2.6em; height: 2.6em; image-rendering: pixelated; }
.h2 .btn2 .k { position: absolute; left: 4px; top: 2px; font-size: 0.85em; opacity: 0.6; }
.h2 .btn2:hover { filter: brightness(1.15); transform: translateY(-1px); }
.h2 .btn2.bump { animation: bump 0.35s cubic-bezier(.2,1.8,.4,1); }
@keyframes bump { 40% { transform: scale(1.18); } }
.h2 .rp { position: absolute; right: 16px; bottom: 14px; padding: 0.35em 0.8em; font-family: var(--pix); display: flex; gap: 0.45em; align-items: center; font-variant-numeric: tabular-nums; }
.h2 .rp img { width: 1.4em; image-rendering: pixelated; }
.h2 .rp b { color: var(--amber2); font-weight: 600; }
.h2 .keys { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); font-size: 0.78em; opacity: 0.72; white-space: nowrap; text-shadow: 0 1px 2px #000; }
.flyitem { position: absolute; width: 36px; height: 36px; image-rendering: pixelated; pointer-events: none; z-index: 9; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); }
.pickup { position: absolute; transform: translate(-50%, -100%); font-family: var(--pix); font-size: 0.95em; color: #fff4c4; text-shadow: 0 2px 0 #1b1a1f, 0 0 6px rgba(0,0,0,0.6); pointer-events: none; animation: pickupRise 1.3s ease-out forwards; white-space: nowrap; }
@keyframes pickupRise { 0% { opacity: 0; transform: translate(-50%, -80%) scale(0.7); } 15% { opacity: 1; transform: translate(-50%, -110%) scale(1.1); } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1); } }
`;

let styled = false;

export interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}

export class Hud2 {
  readonly root: HTMLElement;
  private loc: HTMLElement;
  private quest: HTMLElement;
  private pack: HTMLElement;
  private rpEl: HTMLElement;
  private keys: HTMLElement;
  private shownRp = -1;
  private lastQuestKey = '';
  private t = 0;

  constructor(parent: HTMLElement, o: HudOpts) {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    this.root = parent.appendChild(el('div', 'h2'));
    this.loc = this.root.appendChild(el('div', 'loc panel'));
    this.quest = this.root.appendChild(el('div', 'quest panel'));
    const bar = this.root.appendChild(el('div', 'bar'));
    this.pack = bar.appendChild(el('div', 'btn2 panel interactive', `<span class="k">I</span><img src="${uiIconURL('pack', 3)}" alt=""><span class="n"></span>`));
    this.pack.addEventListener('pointerdown', e => { e.stopPropagation(); o.onBackpack?.(); });
    this.rpEl = this.root.appendChild(el('div', 'rp panel', `<img src="${uiIconURL('rp', 3)}" alt=""><b>0</b><span style="opacity:0.7">RP</span>`));
    this.keys = this.root.appendChild(el('div', 'keys'));
    this.setPlace(o.place, o.sub);
    this.keys.innerHTML = o.keys ?? '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> interact · <span class="key">I</span> backpack';
    this.refresh(true);
  }

  setPlace(place: string, sub = '') {
    this.loc.innerHTML = `<b>${place}</b>${sub ? `<span>${sub}</span>` : ''}`;
  }
  setKeys(html: string) {
    this.keys.innerHTML = html;
  }
  show(on: boolean) {
    this.root.classList.toggle('off', !on);
  }

  /** backpack button screen position (for flying pickups) */
  packPos(): [number, number] {
    const r = this.pack.getBoundingClientRect(), p = game.ui.root.getBoundingClientRect();
    return [r.left - p.left + r.width / 2, r.top - p.top + r.height / 2];
  }

  bumpPack() {
    this.pack.classList.remove('bump');
    void this.pack.offsetWidth;
    this.pack.classList.add('bump');
  }

  refresh(force = false) {
    const s = game.save;
    // quest
    const q = trackedQuest();
    let key = 'none';
    if (q) {
      const i = currentStepIndex(q);
      const st = q.steps[i];
      const pr = st?.progress?.();
      key = `${q.id}:${i}:${pr ? pr.join('/') : ''}`;
      if (key !== this.lastQuestKey || force) {
        const flash = this.lastQuestKey !== '' && !this.lastQuestKey.startsWith(`${q.id}:${i}:`);
        this.quest.innerHTML = `<div class="t">${q.main ? 'STORY' : 'QUEST'} · <i>${q.title}</i></div><div class="s">${st ? st.text : 'Complete!'}${pr ? ` <b style="color:var(--amber2)">${pr[0]}/${pr[1]}</b>` : ''}</div>${pr ? `<div class="pb"><div style="width:${Math.round((pr[0] / Math.max(1, pr[1])) * 100)}%"></div></div>` : ''}`;
        if (flash) { this.quest.classList.remove('flash'); void this.quest.offsetWidth; this.quest.classList.add('flash'); }
      }
    }
    this.quest.style.display = q ? '' : 'none';
    this.lastQuestKey = key;
    // backpack
    (this.pack.querySelector('.n') as HTMLElement).textContent = `${s.inv.length}/${capacity()}`;
    // rp count-up
    if (this.shownRp < 0 || force) this.shownRp = s.rp;
  }

  update(dt: number) {
    this.t += dt;
    const s = game.save;
    if (this.shownRp !== s.rp) {
      const d = s.rp - this.shownRp;
      this.shownRp += Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * Math.min(1, dt * 6)));
      if (Math.abs(s.rp - this.shownRp) < 1) this.shownRp = s.rp;
    }
    (this.rpEl.querySelector('b') as HTMLElement).textContent = String(Math.round(this.shownRp));
    if (this.t > 0.25) {
      this.t = 0;
      this.refresh();
    }
  }

  /** icon flies from a screen point into the backpack button, with a floating "+2 Flax" label */
  flyItem(id: string, n: number, name: string, cssX: number, cssY: number) {
    const root = game.ui.root;
    const lab = el('div', 'pickup', `+${n} ${name}`);
    lab.style.left = cssX + 'px';
    lab.style.top = cssY + 'px';
    root.appendChild(lab);
    setTimeout(() => lab.remove(), 1400);
    const img = el('img', 'flyitem');
    img.src = itemIconURL(id, 3);
    img.style.left = cssX - 18 + 'px';
    img.style.top = cssY - 18 + 'px';
    root.appendChild(img);
    const [tx, ty] = this.packPos();
    const dx = tx - cssX, dy = ty - cssY;
    const anim = img.animate([
      { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
      { transform: `translate(${dx * 0.15}px, ${-40 + dy * 0.05}px) scale(1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.9 },
    ], { duration: 850, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => { img.remove(); this.bumpPack(); this.refresh(); };
  }

  destroy() {
    this.root.remove();
  }
}
