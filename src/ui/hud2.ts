// V2 HUD: location + day, tracked quest, backpack button with slot count, RP counter, key hints,
// and little item icons that fly into the backpack when you collect something.

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { trackedQuest, currentStepIndex } from '../game/quests';
import { capacity } from '../game/inventory';
import { itemIconURL, uiIconURL } from '../art/itemicons';

const CSS = `
.h2 { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s; }
.h2.off { opacity: 0; }
.h2 .loc { position: absolute; left: 16px; top: 14px; padding: 0.45em 0.9em; display: flex; flex-direction: column; gap: 1px; }
.h2 .loc b { font-family: var(--pix); color: var(--amber2); font-weight: 600; font-size: 1.05em; letter-spacing: 0.02em; }
.h2 .loc span { font-size: 0.8em; opacity: 0.8; }
.h2 .quest { position: absolute; right: 16px; top: 14px; width: min(20em, 34vw); padding: 0.55em 0.8em 0.6em; color: #3a2a1a; pointer-events: auto; cursor: pointer; }
.h2 .quest .rb { display: flex; align-items: center; gap: 0.45em; margin: -0.1em 0 0.25em; }
.h2 .quest .rb span { font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-size: 0.66em; letter-spacing: 0.12em; color: #fff; background: #3f7a32; padding: 0.15em 0.55em 0.1em; box-shadow: 0 2px 0 #1f3a18; }
.h2 .quest.side .rb span { background: #b8761c; box-shadow: 0 2px 0 #5a3408; }
.h2 .quest .rb small { font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-size: 0.62em; color: #8a6a44; letter-spacing: 0.08em; margin-left: auto; }
.h2 .quest .rb img { width: 1.9em; height: 1.9em; image-rendering: pixelated; margin: -0.35em 0 -0.35em 0.2em; border-radius: 50%; background: #d8c49a; box-shadow: 0 0 0 2px #6a4a2a; }
.h2 .quest .ti { font-family: 'Jersey 15', 'Pixelify Sans', var(--pix); font-weight: 700; font-size: 1.05em; color: #2a1c10; letter-spacing: 0.02em; line-height: 1.1; }
.h2 .quest .dv { height: 2px; margin: 0.4em 0 0.35em; background: repeating-linear-gradient(90deg, #b89a6a 0 4px, transparent 4px 8px); }
.h2 .quest .st { display: grid; grid-template-columns: 1.1em 1fr auto; gap: 0.1em 0.45em; align-items: start; font-family: 'Jersey 15', 'Pixelify Sans', var(--pix); font-size: 0.88em; line-height: 1.25; margin: 0.12em 0; }
.h2 .quest .st i { font-style: normal; font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-size: 0.85em; text-align: center; line-height: 1.45; }
.h2 .quest .st.done { color: #9a8462; text-decoration: line-through; text-decoration-thickness: 2px; }
.h2 .quest .st.done i { color: #3f7a32; text-decoration: none; }
.h2 .quest .st.next { color: #a8926c; }
.h2 .quest .st.cur { color: #1c120a; font-weight: 600; background: rgba(255, 236, 170, 0.55); margin: 0.2em -0.35em; padding: 0.2em 0.35em; box-shadow: inset 3px 0 0 #3f7a32; }
.h2 .quest .st.cur i { color: #3f7a32; animation: qArrow 0.8s steps(2) infinite; }
.h2 .quest .st b { font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-size: 0.8em; color: #fff; background: #2a1c10; padding: 0.1em 0.4em; }
@keyframes qArrow { 50% { transform: translateX(3px); } }
.h2 .quest .pb { grid-column: 2 / 4; height: 6px; background: #c9b489; box-shadow: inset 0 0 0 1px #8a6a44; margin-top: 0.25em; }
.h2 .quest .pb > div { height: 100%; background: linear-gradient(#8ad05a 0 50%, #5a9a3a 50%); transition: width 0.4s steps(6); }
.h2 .quest .hn { grid-column: 2 / 4; font-size: 0.82em; color: #7a5a38; font-weight: 400; font-style: italic; }
.h2 .quest.min .st.done, .h2 .quest.min .st.next, .h2 .quest.min .hn, .h2 .quest.min .dv { display: none; }
.h2 .quest.flash { animation: qflash 0.9s ease-out; }
.h2 .qbanner { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); font-family: 'Jersey 15', 'Pixelify Sans', var(--pix); font-weight: 700; font-size: 1.5em; letter-spacing: 0.08em;
  color: #fff6d8; padding: 0.35em 1.2em 0.3em; background: #3f7a32; box-shadow: 0 0 0 3px #1f3a18, 0 0 0 6px #fff6d8, 0 0 0 9px #1f3a18, 0 10px 0 6px rgba(0,0,0,0.35);
  text-shadow: 0 3px 0 #1f3a18; white-space: nowrap; pointer-events: none; animation: qBan 2.2s cubic-bezier(.2,1.6,.4,1) both; z-index: 4; }
.h2 .qbanner small { display: block; font-family: 'Jersey 10', 'Silkscreen', var(--pix); font-weight: 400; font-size: 0.45em; letter-spacing: 0.2em; color: #cfe8b8; text-shadow: none; text-align: center; }
@keyframes qBan { 0% { transform: translateX(-50%) scale(2.4) rotate(-6deg); opacity: 0; } 12% { transform: translateX(-50%) scale(0.92) rotate(-2deg); opacity: 1; } 18% { transform: translateX(-50%) scale(1) rotate(-2deg); } 85% { opacity: 1; transform: translateX(-50%) scale(1) rotate(-2deg); } 100% { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.96) rotate(-2deg); } }
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
.h2 .keys { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); font-size: 0.78em; opacity: 0.72; white-space: nowrap; text-shadow: 0 1px 2px #000; }
.h2 .who { position: relative; pointer-events: none; display: flex; align-items: center; margin-right: 0.3em; }
.h2 .who .med { width: 4.6em; height: 4.6em; border-radius: 50%; background: radial-gradient(circle at 50% 38%, #c48a4a, #6a3e1c 70%); box-shadow: 0 0 0 3px #1a0e06, 0 0 0 5px #ffd84a, 0 0 0 7px #a87410, 0 0 0 9px #1a0e06, 0 5px 0 8px rgba(0,0,0,0.35); overflow: hidden; display: grid; place-items: end center; z-index: 2; }
.h2 .who .med img { width: 118%; image-rendering: pixelated; margin-bottom: -0.2em; }
.h2 .who .bars { margin-left: -0.9em; padding-left: 1.2em; display: flex; flex-direction: column; gap: 3px; z-index: 1; }
.h2 .who .bars i { display: block; width: 9em; height: 0.8em; background: #2a1408; box-shadow: 0 0 0 2px #1a0e06, 0 0 0 4px #e0a818, 0 0 0 6px #1a0e06; position: relative; margin: 2px 0 4px 4px; }
.h2 .who .bars i::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: var(--v, 100%); background: linear-gradient(#ff8a6a 0 35%, #d8543e 35% 75%, #a8382a 75%); transition: width 0.3s; }
.h2 .who .bars i.b::after { background: linear-gradient(#8ad8ff 0 35%, #3a8ad8 35% 75%, #2a5aa8 75%); }
.h2 .who .bars small { font-family: var(--head); font-size: 0.72em; color: #ffe9a8; text-shadow: 0 2px 0 #1a0e06, 1px 0 0 #1a0e06, -1px 0 0 #1a0e06; letter-spacing: 0.08em; margin-left: 4px; }
.h2 .belt { display: flex; gap: 4px; padding: 5px; background: linear-gradient(#6a3e1c, #4a2a12); box-shadow: 0 0 0 2px #1a0e06, 0 0 0 4px #e0a818, 0 0 0 6px #1a0e06, 0 6px 0 6px rgba(0,0,0,0.3); }
.h2 .belt span { width: 3.1em; height: 3.1em; background: var(--sk-slot) center / 100% 100%; image-rendering: pixelated; display: grid; place-items: center; transition: transform 0.12s cubic-bezier(.2,1.8,.4,1); }
.h2 .belt span:hover { transform: translateY(-3px) scale(1.06); }
.h2 .belt span img { width: 2.1em; height: 2.1em; image-rendering: pixelated; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.45)); }
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
  private questMin = false;
  private bannerT = 0;
  /** big stamped banner in the middle of the screen (objective complete / new quest) */
  banner(title: string, sub = '') {
    const now = performance.now();
    if (now - this.bannerT < 600) return;
    this.bannerT = now;
    const b = el('div', 'qbanner', `${title}${sub ? `<small>${sub.replace(/</g, '&lt;')}</small>` : ''}`);
    this.root.appendChild(b);
    audio.play('uiOpen', { vol: 0.5, pitch: 1.2 });
    setTimeout(() => b.remove(), 2300);
  }
  private pack: HTMLElement;
  private rpEl: HTMLElement;
  private keys: HTMLElement;
  private who!: HTMLElement;
  private belt!: HTMLElement;
  private beltKey = '';
  private shownRp = -1;
  private lastQuestKey = '';
  private t = 0;

  constructor(parent: HTMLElement, o: HudOpts) {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    this.root = parent.appendChild(el('div', 'h2'));
    this.loc = this.root.appendChild(el('div', 'loc panel'));
    this.quest = this.root.appendChild(el('div', 'quest panel'));
    this.quest.addEventListener('click', () => { this.questMin = !this.questMin; this.quest.classList.toggle('min', this.questMin); });
    const bar = this.root.appendChild(el('div', 'bar'));
    this.who = bar.appendChild(el('div', 'who', `<div class="med"><img alt=""></div><div class="bars"><small>PACK</small><i class="a"></i><small>FILM</small><i class="b"></i></div>`));
    this.belt = bar.appendChild(el('div', 'belt'));
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
        const esc = (t: string) => t.replace(/</g, '&lt;');
        const row = (k: number, cls: string, mark: string) => {
          const x = q.steps[k];
          if (!x) return '';
          const p2 = cls === 'cur' ? pr : undefined;
          return `<div class="st ${cls}"><i>${mark}</i><span>${esc(x.text)}</span>${p2 ? `<b>${p2[0]}/${p2[1]}</b>` : '<span></span>'}${p2 ? `<div class="pb"><div style="width:${Math.round((p2[0] / Math.max(1, p2[1])) * 100)}%"></div></div>` : ''}${cls === 'cur' && x.hint ? `<div class="hn">${esc(x.hint)}</div>` : ''}</div>`;
        };
        const giverImg = q.giver !== 'story' ? game.ui.portraitURL(q.giver, 'neutral') : '';
        this.quest.className = `quest panel${q.main ? '' : ' side'}${this.questMin ? ' min' : ''}`;
        this.quest.innerHTML = `<div class="rb"><span>${q.main ? '★ STORY' : '◆ SIDE'}</span><small>${q.chapter ? `CHAPTER ${q.chapter}` : `STEP ${Math.min(i + 1, q.steps.length)}/${q.steps.length}`}</small>${giverImg ? `<img src="${giverImg}" alt="">` : ''}</div>`
          + `<div class="ti">${esc(q.title)}</div><div class="dv"></div>`
          + (i > 0 ? row(i - 1, 'done', '✔') : '')
          + (st ? row(i, 'cur', '▶') : `<div class="st cur"><i>✔</i><span>Complete!</span><span></span></div>`)
          + row(i + 1, 'next', '○');
        if (flash && this.lastQuestKey.startsWith(`${q.id}:`)) this.banner('OBJECTIVE COMPLETE', 'New objective added');
        else if (flash) this.banner(q.main ? 'NEW STORY QUEST' : 'NEW QUEST', q.title);
        if (flash) { this.quest.classList.remove('flash'); void this.quest.offsetWidth; this.quest.classList.add('flash'); }
      }
    }
    this.quest.style.display = q ? '' : 'none';
    this.lastQuestKey = key;
    // backpack
    (this.pack.querySelector('.n') as HTMLElement).textContent = `${s.inv.length}/${capacity()}`;
    // portrait, pack meter, film (field camera) and tool belt
    const img = this.who.querySelector('img') as HTMLImageElement;
    if (!img.src) { const u = game.ui.portraitURL('rowan', 'happy'); if (u) img.src = u; }
    (this.who.querySelector('i.a') as HTMLElement).style.setProperty('--v', `${Math.round((s.inv.length / Math.max(1, capacity())) * 100)}%`);
    const cam = (game.scene as { cam?: { shots: number } } | null)?.cam;
    const film = this.who.querySelector('i.b') as HTMLElement;
    film.style.display = cam ? '' : 'none';
    (film.previousElementSibling as HTMLElement).style.display = cam ? '' : 'none';
    if (cam) film.style.setProperty('--v', `${Math.round(Math.min(1, cam.shots / 24) * 100)}%`);
    const bk = s.tools.join(',');
    if (bk !== this.beltKey) {
      this.beltKey = bk;
      this.belt.innerHTML = s.tools.slice(0, 8).map(t => `<span title="${t}"><img src="${itemIconURL(t, 3)}" alt=""></span>`).join('') + '<span></span>'.repeat(Math.max(0, 6 - s.tools.length));
    }
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
